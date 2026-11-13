const fs = require('fs');
const { observeChildProc } = require('./child-proc-diagnostic.cjs');
const path = require('path');
const cp = require('child_process');

let acorn;
try { acorn = require('acorn'); } catch (e) { console.log('SKIP — ត្រូវការ acorn (npm i acorn)'); process.exit(0); }

const ROOT = process.env.EXITCODE_APP_DIR || path.join(__dirname, '../..');
const TOOLS = path.join(ROOT, 'tools/audit-tools');
const RUNALL = path.join(TOOLS, 'run-all.sh');
const ZTO_IMPORT_TEST = 'zto-import/test.js';

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
    const sh = fs.readFileSync(RUNALL, 'utf8').replace(/^\s*#.*$/gm, '');
    const found = new Set();
    for (const m of sh.matchAll(/^\s*(?:run\s+"[^"]*"\s+|(?:[A-Z0-9_]+="[^"\n]*"\s+)*)(?:runall_owned\s+)?node\s+tools\/audit-tools\/([A-Za-z0-9_./-]+\.m?js)(?=\s|$)/gm)) found.add(m[1]);
    for (const m of sh.matchAll(/for t in ([\s\S]*?); do([\s\S]*?)\bdone\b/g)) {
        const command = /^\s*run\s+"\$t"\s+node\s+"tools\/audit-tools\/\$t\.(m?js)"(?=\s|$)/m.exec(m[2]);
        if (!command) continue;
        for (const name of m[1].split(/\s+/)) {
            if (/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)) found.add(name + '.' + command[1]);
        }
    }
    const normal = sh.replace(/^\s*#.*$/gm, '').split(/if \[ -n "\$BASE" \]/)[0];
    if (/^\s*run\s+"[^"]*"\s+node\s+tools\/audit-tools\/zto-import\/test\.js(?=\s|$)/m.test(normal)) found.add(ZTO_IMPORT_TEST);
    return [...found].filter((f) => f !== 'owned-rtdb-command.js' && fs.existsSync(path.join(TOOLS, f)));
}

const checkers = checkersFromRunAll();
const MIN_CHECKERS = 40;
ok('tools/audit-tools/zto-import/test.js ៖ រកឃើញការរត់ពិតក្នុងផ្នែកធម្មតា', checkers.includes(ZTO_IMPORT_TEST));
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
    try { ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true, allowHashBang: true, allowReturnOutsideFunction: true }); }
    catch (e) {
        try { ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true, sourceType: 'module', allowHashBang: true }); }
        catch (moduleError) { offenders.push(rel + ' (parse មិនបាន)'); continue; }
    }
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

// ១ខ — កិច្ចសន្យា exit របស់ `run-all.sh` (`runall-exit-guard.cjs`) ៖ exit code ចាប់ផ្តើម «មិនទាន់សម្រេច» ហើយតែសេចក្តីសង្ខេប
// ទេដែលបន្ថយវា ➜ checker ដែល `await` មិនដែល settle ក្លាយជា FAIL។ ⛔ ការបន្ថយ ២ កន្លែងរំលងកិច្ចសន្យានោះវិញ ៖
//   (ក) ក្នុង listener `exit`/`beforeExit` ៖ រត់ទោះ event loop ហូរអស់ពាក់កណ្តាលការអះអាង
//   (ខ) ក្នុងកូដ top-level ធម្មតា **ក្រោយ** statement ដែលចាប់ផ្តើមការងារ async (IIFE async · `main()` async · `.then`/`.catch`
//       /`.finally`) ៖ វារត់ភ្លាមមុន await ដំបូង ➜ exit 0 ខណៈការអះអាង async មិនទាន់រត់
//   (គ) `process.exitCode = 0` top-level **មុន** ការងារ async ដោយមិនចេញភ្លាម (statement ដដែលគ្មាន `process.exit`) ៖
//       សញ្ញា «មិនទាន់សម្រេច» ត្រូវលុបមុនការអះអាង async រត់ ➜ await ដែលព្យួរ ➜ exit 0 ដូចគ្មាន guard
// ផ្លូវ SKIP ដំបូង (`process.exit(0)` មុនការងារ async) និងការបន្ថយក្នុងខ្លួន function async នៅត្រឹមត្រូវ។
function isMember(node, object, property) {
    return !!node && node.type === 'MemberExpression' && !node.computed && node.object
        && node.object.type === 'Identifier' && node.object.name === object && node.property && node.property.name === property;
}
function nonZeroLiteral(node) { return !!node && node.type === 'Literal' && typeof node.value === 'number' && node.value !== 0; }
function isExitLowering(node) {
    if (node.type === 'CallExpression' && isMember(node.callee, 'process', 'exit')) return !nonZeroLiteral(node.arguments[0]);
    if (node.type === 'AssignmentExpression' && isMember(node.left, 'process', 'exitCode')) return !nonZeroLiteral(node.right);
    return false;
}
const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
function walkNodes(node, visit, intoFunctions) {
    if (!node || typeof node !== 'object') return;
    if (visit(node) === false) return;
    if (!intoFunctions && FUNCTION_TYPES.has(node.type)) return;
    for (const key in node) {
        if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => walkNodes(child, visit, intoFunctions));
        else if (value && typeof value === 'object' && value.type) walkNodes(value, visit, intoFunctions);
    }
}
function exitDecisionOffenders(ast) {
    const found = [];
    const asyncNames = new Set();
    for (const statement of ast.body) {
        if (statement.type === 'FunctionDeclaration' && statement.async && statement.id) asyncNames.add(statement.id.name);
        if (statement.type === 'VariableDeclaration') for (const d of statement.declarations) {
            if (d.id && d.id.type === 'Identifier' && d.init && FUNCTION_TYPES.has(d.init.type) && d.init.async) asyncNames.add(d.id.name);
        }
    }
    walkNodes(ast, (node) => {
        if (node.type !== 'CallExpression' || !node.callee || node.callee.type !== 'MemberExpression') return;
        const target = node.callee.object, method = node.callee.property && node.callee.property.name;
        if (!target || target.type !== 'Identifier' || target.name !== 'process') return;
        if (!['on', 'once', 'addListener', 'prependListener', 'prependOnceListener'].includes(method)) return;
        const event = node.arguments[0];
        if (!event || event.type !== 'Literal' || !['exit', 'beforeExit'].includes(event.value)) return;
        walkNodes(node.arguments[1], (inner) => {
            if (isExitLowering(inner)) found.push({ line: inner.loc.start.line, why: 'ក្នុង listener ' + event.value });
        }, true);
    }, true);
    let asyncStarted = false;
    const loweredBefore = [];
    for (const statement of ast.body) {
        if (FUNCTION_TYPES.has(statement.type)) continue;
        let starts = false, exits = false;
        const lowered = [];
        walkNodes(statement, (node) => {
            if (asyncStarted && isExitLowering(node)) found.push({ line: node.loc.start.line, why: 'top-level ក្រោយការងារ async ចាប់ផ្តើម' });
            if (node.type === 'AssignmentExpression' && isExitLowering(node)) lowered.push(node);
            if (node.type !== 'CallExpression' || !node.callee) return;
            const callee = node.callee;
            if (isMember(callee, 'process', 'exit')) exits = true;
            if (FUNCTION_TYPES.has(callee.type) && callee.async) starts = true;
            if (callee.type === 'Identifier' && asyncNames.has(callee.name)) starts = true;
            if (callee.type === 'MemberExpression' && callee.property && ['then', 'catch', 'finally'].includes(callee.property.name)) starts = true;
        }, false);
        if (starts) {
            for (const node of loweredBefore) found.push({ line: node.loc.start.line, why: 'top-level មុនការងារ async ដោយមិនចេញភ្លាម' });
            loweredBefore.length = 0;
            asyncStarted = true;
        } else if (!asyncStarted && !exits) loweredBefore.push(...lowered);
    }
    return found;
}
{
    const parse = (text) => acorn.parse(text, { ecmaVersion: 'latest', locations: true, allowHashBang: true });
    const cases = [
        ['(async () => { await x; process.exitCode = fail ? 1 : 0; })();', 0],
        ['main().catch(() => { process.exitCode = 1; });\nasync function main() { await x; process.exit(fail ? 1 : 0); }', 0],
        ['if (!dep) { console.log("SKIP"); process.exit(0); }\n(async () => { await x; process.exit(0); })();', 0],
        ['ok(1);\nif (fail) process.exit(1);\nprocess.exitCode = 0;', 0],
        ['(async () => { await x; })();\nprocess.exitCode = 0;', 1],
        ['async function main() { await x; }\nmain();\nprocess.exit(0);', 1],
        ['run().then(() => {});\nif (!fail) process.exitCode = 0;', 1],
        ['process.on("exit", () => { process.exitCode = fail ? 1 : 0; });', 1],
        ['process.once("beforeExit", () => process.exit(0));', 1],
        ['process.on("exit", () => { console.log(summary); });', 0],
        ['process.exitCode = 0;\n(async () => { await x; })();', 1],
        ['let fail = 0;\nprocess.exitCode = fail;\nmain();\nasync function main() { await x; process.exitCode = fail ? 1 : 0; }', 1],
        ['if (!dep) { console.log("SKIP"); process.exitCode = 0; process.exit(0); }\nmain();\nasync function main() { await x; process.exitCode = 0; }', 0],
        ['if (plan) { process.exitCode = 0; } else { run().then(done); }', 0],
        ['ok(1);\nprocess.exitCode = fail ? 1 : 0;', 0]
    ];
    const wrong = cases.map(([text, want]) => ({ text, want, got: exitDecisionOffenders(parse(text)).length }))
        .filter((row) => row.got !== row.want);
    ok('ច្បាប់ AST កិច្ចសន្យា exit ៖ ការបន្ថយក្នុង listener exit · top-level ក្រោយ async · top-level មុន async ដោយមិនចេញ ➜ ចាប់ · ផ្លូវ SKIP/សេចក្តីសង្ខេបត្រឹមត្រូវ ➜ មិនចាប់',
        wrong.length === 0, wrong);
}
const lateLowering = [];
let scannedDecision = 0;
// ⛔ driver `*-test.cjs` (រត់ពី vitest pg ៖ `supabase-*.pg.test.ts`) ក៏ត្រូវតាមកិច្ចសន្យា exit ដូច checker ដែរ ➜ ស្កេនផង
const cjsDrivers = fs.readdirSync(TOOLS).filter((f) => /-test\.cjs$/.test(f) && !f.startsWith('.tmp-poison-')).sort();
ok('driver .cjs ត្រូវបានស្កេនកិច្ចសន្យា exit (≥ ៤)', cjsDrivers.length >= 4, cjsDrivers);
for (const rel of checkers.concat(cjsDrivers)) {
    let src;
    try { src = fs.readFileSync(path.join(TOOLS, rel), 'utf8'); } catch (e) { continue; }
    let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true, allowHashBang: true, allowReturnOutsideFunction: true }); }
    catch (e) {
        try { ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true, sourceType: 'module', allowHashBang: true }); }
        catch (moduleError) { lateLowering.push(rel + '  (parse មិនបាន ➜ វាស់កិច្ចសន្យា exit មិនបាន)'); continue; }
    }
    scannedDecision++;
    for (const row of exitDecisionOffenders(ast)) lateLowering.push(rel + ':' + row.line + '  បន្ថយ exit code ' + row.why);
}
ok('ស្កេនកិច្ចសន្យា exit លើ checker ' + scannedDecision + ' ឯកសារ', scannedDecision >= MIN_CHECKERS, { scannedDecision });
ok('⛔ គ្មាន checker ណាបន្ថយ exit code ក្នុង listener exit ឬនៅ top-level ជុំវិញការងារ async (រំលងកិច្ចសន្យា exit)',
    lateLowering.length === 0, lateLowering.slice(0, 10));

// ២ — ការវាស់ **ឥរិយាបថ**៖ ពុលការអះអាងទាំងអស់ ➜ checker ត្រូវចេញដោយ exit != 0
console.log('\n=== ការវាស់ឥរិយាបថ ៖ ការអះអាងធ្លាក់ ➜ exit != 0 ===');

const POISON = [
    [/function check\(name, condition, detail\) \{/, 'function check(name, condition, detail) { condition = false;'],
    [/function ok\(label, cond, detail\) \{/, 'function ok(label, cond, detail) { cond = false;'],
    [/function ok\(cond, label, got\) \{/, 'function ok(cond, label, got) { cond = false;'],
    [/function ok\(label, condition, detail\) \{/, 'function ok(label, condition, detail) { condition = false;'],
    [/function ok\(label, cond, got\) \{/, 'function ok(label, cond, got) { cond = false;'],
    [/const ok = \(n, c, d\) => results\.push\(\[n, !!c, d\]\);/, 'const ok = (n, c, d) => results.push([n, false, d]);'],
    [/function check\(row, label, condition\) \{/, 'function check(row, label, condition) { condition = false;'],
    [/async function check\(label, tree, location, body, allow, method = 'PATCH', actor = uid, interleave = null\) \{/,
        "async function check(label, tree, location, body, allow, method = 'PATCH', actor = uid, interleave = null) { allow = !allow;"]
];

function poisonSource(src) {
    // ភស្តុតាងត្រូវមកពីទីតាំងពុលដែលរត់ពិត; uncaught crash មិនអាចប្រើ exit code ជំនួសវាបាន។
    const reached = "if (process.stderr && typeof process.once === 'function' && !process.__zoeExitPoison) { process.__zoeExitPoison = { crashed: false }; process.once('uncaughtExceptionMonitor', () => { process.__zoeExitPoison.crashed = true; }); process.once('exit', () => { if (!process.__zoeExitPoison.crashed) process.stderr.write('\\nZOE_EXITCODE_POISON_REACHED\\n'); }); } ";
    for (const [re, rep] of POISON) {
        const declaration = new RegExp('^[ \t]*' + re.source, 'm');
        if (!declaration.test(src)) continue;
        const instrumented = rep.includes(' {') ? rep.replace(' {', ' { ' + reached)
            : rep.replace('=> ', '=> { ' + reached).replace(/;$/, '; };');
        return src.replace(declaration, () => instrumented);
    }
    // ⛔ node:test៖ ចាក់បរាជ័យក្រោយ callback ពិតបញ្ចប់ មិនមែនជំនួស test body ឬគាំងពេល import។
    if (/from\s*['"]node:test['"]/.test(src)) {
        let tree;
        try { tree = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (_) { return null; }
        const testNames = new Set(tree.body.filter(node => node.type === 'ImportDeclaration' && node.source.value === 'node:test')
            .flatMap(node => node.specifiers).filter(node => node.type === 'ImportSpecifier' && node.imported.name === 'test').map(node => node.local.name));
        const walk = (node, visit) => {
            if (!node || typeof node !== 'object') return;
            if (node.type) visit(node);
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(child => walk(child, visit));
                else if (value && typeof value === 'object') walk(value, visit);
            }
        };
        const candidates = [];
        for (const wrapper of tree.body.filter(node => node.type === 'FunctionDeclaration' && node.params[1]?.type === 'Identifier')) {
            walk(wrapper.body, call => {
                if (call.type !== 'CallExpression' || call.callee.type !== 'Identifier' || !testNames.has(call.callee.name)) return;
                const callback = call.arguments[1];
                if (!callback || !['ArrowFunctionExpression', 'FunctionExpression'].includes(callback.type) || !callback.async) return;
                walk(callback.body, node => {
                    if (node.type === 'AwaitExpression' && node.argument.type === 'CallExpression'
                        && node.argument.callee.type === 'Identifier' && node.argument.callee.name === wrapper.params[1].name
                        && node.argument.arguments.length === 0) candidates.push(node);
                });
            });
        }
        if (candidates.length !== 1) return null;
        const target = candidates[0];
        return src.slice(0, target.start) + '(' + src.slice(target.start, target.end)
            + ', (() => { ' + reached + "throw new Error('ZOE_NODE_TEST_POISON'); })())" + src.slice(target.end);
    }
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
        const decl = new RegExp('((?:let|var)[^;\\n]*?\\b' + id + '\\s*=\\s*)([^;,\\n]*)([;,])');
        if (decl.test(src)) return src.replace(decl, (_match, prefix, value, separator) =>
            prefix + '(function () { ' + reached + 'return (' + value + ') + 1; })()' + separator);
    }
    return null;
}

// ⛔ ថវិកាកូនពុល **ដេរីវេពីពិដានពិត** មិនមែនលេខថេរ។ 🔴 វាស់បាន (CI1156) ៖ ថវិកាថេរ ៦០ វិ. ក្រោមពេលធម្មតារបស់កូន
// (`supabase-datastore-test` ៦៦ វិ. មិនពុល · ពុល ៨៤ វិ. នៅ local) ➜ កូនដែលនឹងចេញ 1 ជាមួយភស្តុតាងពុល ត្រូវសម្លាប់ ហើយរាប់ជា
// unverified ➜ FAIL ក្លែង។ ពិដានពិតតែមួយគឺពិដានរបស់ job នេះក្នុង `run-all.sh` (`RUNALL_JOB_TIMEOUT` ដែល `runall_exec`
// បញ្ជូនជាមួយ `RUNALL_JOB_STARTED_MS` · រត់ផ្ទាល់ ➜ លំនាំដើម `CHECKER_TIMEOUT` ក្នុង run-all.sh) ➜ កូននីមួយៗទទួលពេលដែលនៅសល់រហូតដល់ deadline
// (ពិដាន − `DEADLINE_RESERVE_MS` សម្រាប់ settle/សេចក្តីសង្ខេប) ➜ កូនយឺតតែកំពុងដើរ ទទួលសាលក្រមពិត ហើយកូនដែលព្យួរពិតនៅ
// ក្លាយជា unverified ដែលមានឈ្មោះ **មុន** run-all សម្លាប់ meta-checker ទាំងមូល (ពិដានតេស្តតឹងជាងពិដានទ្វារបម្រុង)។
// ⛔ មិនមែនការបង្កើន `CHECKER_TIMEOUT` ទេ ៖ ពិដានខាងក្រៅនៅដដែល។ `EXITCODE_TIMEOUT_MS` = ពិដានកូនមួយច្បាស់លាស់ (fixture · debug)។
function durationMs(text) {
    const m = /^\s*(\d+(?:\.\d+)?)\s*([smhd]?)\s*$/.exec(String(text === undefined || text === null ? '' : text));
    if (!m) return null;
    const ms = Number(m[1]) * { '': 1000, s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
    return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
}
function runAllDefaultTimeout(text) {
    const m = /^CHECKER_TIMEOUT="\$\{CHECKER_TIMEOUT:-([^}"]+)\}"$/m.exec(String(text || ''));
    return m ? durationMs(m[1]) : null;
}
const DEADLINE_RESERVE_MS = 20000;
const MIN_CHILD_BUDGET_MS = 2000;
const PROCESS_STARTED_AT = (() => {
    const fromRunner = Number(process.env.RUNALL_JOB_STARTED_MS);
    const now = Date.now();
    if (Number.isSafeInteger(fromRunner) && fromRunner <= now && now - fromRunner < 86400000) return fromRunner;
    return now - Math.round(process.uptime() * 1000);
})();
const JOB_CEILING_MS = durationMs(process.env.RUNALL_JOB_TIMEOUT)
    || runAllDefaultTimeout(fs.existsSync(RUNALL) ? fs.readFileSync(RUNALL, 'utf8') : '') || 300000;
const DEADLINE_AT = PROCESS_STARTED_AT + JOB_CEILING_MS - DEADLINE_RESERVE_MS;
const EXPLICIT_CHILD_MS = (() => { const v = parseInt(process.env.EXITCODE_TIMEOUT_MS || '', 10); return Number.isFinite(v) && v > 0 ? v : null; })();
function childBudgetMs(now, deadlineAt, explicitMs) {
    const left = deadlineAt - now;
    return explicitMs === null ? left : Math.min(explicitMs, left);
}
{
    const wrong = [
        ['300', 300000], ['2m', 120000], ['1.5s', 1500], ['1h', 3600000], ['0', null], ['', null], ['abc', null], [undefined, null]
    ].filter(([text, want]) => durationMs(text) !== want).map(([text, want]) => ({ text, want, got: durationMs(text) }));
    const runAllDefault = runAllDefaultTimeout(fs.existsSync(RUNALL) ? fs.readFileSync(RUNALL, 'utf8') : '');
    ok('ថវិកាពុល ៖ អាន DURATION ដូច `timeout` (s · m · h · d · 0 = បិទ) និងពិដានលំនាំដើមពី run-all.sh ពិត',
        wrong.length === 0 && runAllDefault !== null && runAllDefault >= 60000, { wrong, runAllDefault });
    const budgets = [
        childBudgetMs(1000, 281000, null) === 280000,
        childBudgetMs(200000, 281000, null) === 81000,
        childBudgetMs(1000, 281000, 4000) === 4000,
        childBudgetMs(280000, 281000, 4000) === 1000
    ];
    ok('ថវិកាពុល ៖ កូនទទួលពេលដែលនៅសល់រហូតដល់ deadline (កូនយឺតមិនត្រូវសម្លាប់ដោយលេខថេរ) · ពិដានច្បាស់លាស់នៅគោរព',
        budgets.every(Boolean), budgets);
}
// ⛔ ការពុលរត់ **ស្របគ្នាតាមចំនួនកំណត់** មិនមែនម្តងមួយៗ។
// 🔴 វាស់បាន (2.42.8) ៖ checker កូន ១០៨ រត់ជាជួរ ➜ ២៨០ វិ. លើម៉ាស៊ីន ៤ CPU និង **៣៦៧ វិ.** លើម៉ាស៊ីនមួយទៀត ➜ លើសពិដាន
// ៣០០ វិ. របស់ `run-all.sh` ➜ «*** FAIL *** (ព្យួរ)» ខណៈគ្មាន checker ណាខូចសោះ។ ការរត់ស្របគ្នាក្នុងពិដាន
// (`EXITCODE_CONCURRENCY` · លំនាំដើម = CPU ដែលប្រើបានតាម affinity/quota រហូតដល់ ៨) ជាដំណោះស្រាយតាមរចនាសម្ព័ន្ធ ដូច probe ថតទទេរបស់
// `checker-coverage` ⛔ មិនមែនការបង្កើន `CHECKER_TIMEOUT` (នោះលាក់ checker ដែលព្យួរពិត)។
// 🔴 វាស់បាន (2.49.0) ៖ runner CI មាន CPU ២ ➜ lane ២ ដែល ១ ទុកឲ្យ `emu/*` ➜ lane ស្របគ្នាតែ ១ ➜ ២៥៧ វិ. (ម៉ាស៊ីន ៤ CPU) និង
// **លើស ៣០០ វិ.** លើ CI ។ កូនភាគច្រើនរង់ចាំ timer (CPU ពិត ៧៩ វិ. ក្នុង ២៥៧ វិ.) ➜ lane ៤ លើ CPU ២ (`taskset`) ៖ **៩១ វិ.** ហើយពេលកូននីមួយៗ
// ដដែល (គ្មានការប្រជែង) ➜ ជំនាន់នោះដាក់អប្បបរមា ៤។ Container ដែលឃើញ CPU របស់ host ច្រើនជាង quota ត្រូវគោរព
// CPU ដែលប្រើបានពិត; override ច្បាស់លាស់នៅអាចជ្រើស worker បន្ថែមសម្រាប់ការងារ I/O ដែលបានវាស់។
function poisonConcurrency(env, system, readFile) {
    const asked = parseInt(env.EXITCODE_CONCURRENCY || '', 10);
    if (Number.isFinite(asked) && asked >= 1) return Math.min(asked, 16);
    let available = 2;
    try {
        const count = typeof system.availableParallelism === 'function' ? system.availableParallelism() : system.cpus().length;
        if (Number.isFinite(count) && count >= 1) available = count;
    } catch (e) {}
    let quota = null;
    try {
        const [limit, period] = String(readFile('/sys/fs/cgroup/cpu.max', 'utf8')).trim().split(/\s+/);
        if (Number(limit) > 0 && Number(period) > 0) quota = Number(limit) / Number(period);
    } catch (e) {}
    if (quota === null) {
        try {
            const limit = Number(readFile('/sys/fs/cgroup/cpu/cpu.cfs_quota_us', 'utf8'));
            const period = Number(readFile('/sys/fs/cgroup/cpu/cpu.cfs_period_us', 'utf8'));
            if (limit > 0 && period > 0) quota = limit / period;
        } catch (e) {}
    }
    return Math.max(1, Math.min(8, Math.floor(available), quota === null ? Infinity : Math.ceil(quota)));
}
const CONCURRENCY = poisonConcurrency(process.env, require('os'), fs.readFileSync);
{
    const fixtures = [
        [{}, 64, 4, '400000 100000', 4],
        [{}, 64, 8, '200000 100000', 2],
        [{}, 3, null, 'max 100000', 3],
        [{}, 64, 6, 'ខូច', 6],
        [{}, 64, null, 'max 100000', 8],
        [{}, 64, 8, '150000 100000', 2],
        [{ EXITCODE_CONCURRENCY: '12' }, 64, 4, '400000 100000', 12],
        [{ EXITCODE_CONCURRENCY: '0' }, 64, 4, '400000 100000', 4]
    ];
    const wrong = fixtures.map(([env, host, available, quota, want]) => {
        const system = { cpus: () => Array(host), ...(available === null ? {} : { availableParallelism: () => available }) };
        const readFile = file => { if (file.endsWith('/cpu.max')) return quota; throw new Error('ENOENT'); };
        return { got: poisonConcurrency(env, system, readFile), want };
    }).filter(row => row.got !== row.want);
    ok('worker គោរព affinity និង quota CPU ហើយរក្សា override ច្បាស់លាស់', wrong.length === 0, wrong);
}
// ⛔ `emu/*` ចែក RTDB emulator តែមួយ ➜ រត់ក្នុងផ្លូវតែមួយ (ម្តងមួយ) ស្របនឹងក្រុមផ្សេង។
const SERIAL_LANE = (rel) => rel.startsWith('emu/');
const ISOLATED_LANE = (rel) => rel === 'supabase-datastore-test.js';
const OUT_CAP = 4 * 1024 * 1024;
// ⛔ ពិដានពេល settle **តាមរចនាសម្ព័ន្ធ** ៖ SIGKILL នៅពេលផុតថវិកា ហើយបើ `close` មិនមក (ចៅដែលកាន់ pipe) ឬការសម្លាប់
// ធ្លាក់ ➜ ឧបករណ៍កំណត់ម៉ោងទី ២ បញ្ចប់ការរង់ចាំ។ ដំណើរការឈប់ ➜ រង់ចាំ `close` តែ ២ វិ. ដើម្បីកុំឲ្យចៅដែលកាន់ stdout
// ពន្យារសាលក្រមដែលដឹងរួច។
const EXIT_TO_CLOSE_GRACE_MS = 2000;
const HARD_GRACE_MS = 5000;
const liveChildren = new Set();
// ⛔ កូនពុលរត់ក្រោមកិច្ចសន្យា exit ដូច `run-all.sh` (`runall-exit-guard.cjs` របស់ tree ដែលវាស់) ➜ សាលក្រមវាស់ឥរិយាបថដែល
//    run-all ពិតឃើញ។ tree ដែលគ្មានឯកសារនេះ (baseline ចាស់ · fixture) ➜ រត់ដូច runner របស់វា (គ្មាន preload)។
const EXIT_GUARD = path.join(TOOLS, 'runall-exit-guard.cjs');
const EXIT_GUARD_ARGS = fs.existsSync(EXIT_GUARD) ? ['--require', EXIT_GUARD] : [];
ok('កូនពុលរត់ក្រោមកិច្ចសន្យា exit ដូច run-all (run-all.sh ប្រើ preload ➜ ឯកសារមាន)',
    !/runall-exit-guard\.cjs/.test(fs.existsSync(RUNALL) ? fs.readFileSync(RUNALL, 'utf8') : '') || EXIT_GUARD_ARGS.length === 2,
    EXIT_GUARD);

function runPoisonedChild(file, budgetMs) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        let out = '', settled = false, timedOut = false, exitCode = null, exitSignal = null, exited = false;
        let graceTimer = null;
        let child;
        const elapsed = () => Date.now() - t0;
        const lifecycle = { pid: null, spawnMs: null, markerMs: null, exitMs: null, closeMs: null,
            timeoutMs: null, finishMs: null, exitCode: null, exitSignal: null, kill: null, proc: null };
        let snapshot = () => ({ status: 'unavailable' });
        const finish = (code, signal) => {
            if (settled) return;
            settled = true;
            clearTimeout(killTimer); clearTimeout(hardTimer); clearTimeout(graceTimer);
            if (child) {
                liveChildren.delete(child);
                child.stdout.destroy(); child.stderr.destroy();
            }
            lifecycle.finishMs = elapsed();
            resolve({ code, signal, timedOut, out, ms: Date.now() - t0, lifecycle: JSON.parse(JSON.stringify(lifecycle)) });
        };
        const killTimer = setTimeout(() => {
            timedOut = true;
            lifecycle.timeoutMs = elapsed();
            lifecycle.proc = snapshot();
            lifecycle.kill = { requestedMs: elapsed(), signal: 'SIGKILL', result: null };
            try { lifecycle.kill.result = child.kill('SIGKILL'); } catch (e) { lifecycle.kill.result = 'threw'; }
        }, budgetMs);
        const hardTimer = setTimeout(() => finish(exited ? exitCode : null, exited ? exitSignal : 'SIGKILL'),
            budgetMs + HARD_GRACE_MS);
        try {
            child = cp.spawn(process.execPath, EXIT_GUARD_ARGS.concat([file]), {
                cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
                env: Object.assign({}, process.env, { EXITCODE_CHILD: '1' }, EXIT_GUARD_ARGS.length ? { ZOE_RUNALL_EXIT_GUARD: '1' } : {})
            });
        } catch (e) {
            out = String(e && e.message || e);
            finish(null, null);
            return;
        }
        lifecycle.pid = Number.isInteger(child.pid) ? child.pid : null;
        try { snapshot = observeChildProc(child.pid, () => !settled && !exited); } catch (_) {}
        liveChildren.add(child);
        child.on('spawn', () => { if (!settled) lifecycle.spawnMs = elapsed(); });
        let markerTail = '';
        const take = (chunk) => {
            if (settled || out.length >= OUT_CAP) return;
            out += chunk;
            if (lifecycle.markerMs === null) {
                const sample = markerTail + chunk;
                if (/^ZOE_EXITCODE_POISON_REACHED$/m.test(sample)) lifecycle.markerMs = elapsed();
                markerTail = sample.slice(-('ZOE_EXITCODE_POISON_REACHED'.length + 1));
            }
        };
        child.stdout.setEncoding('utf8'); child.stdout.on('data', take);
        child.stderr.setEncoding('utf8'); child.stderr.on('data', take);
        child.on('error', (e) => { out += '\n' + String(e && e.message || e); finish(null, null); });
        child.on('exit', (code, signal) => {
            if (settled) return;
            exited = true; exitCode = code; exitSignal = signal;
            lifecycle.exitMs = elapsed(); lifecycle.exitCode = code; lifecycle.exitSignal = signal;
            clearTimeout(killTimer); clearTimeout(hardTimer);
            graceTimer = setTimeout(() => finish(code, signal), EXIT_TO_CLOSE_GRACE_MS);
        });
        child.on('close', (code, signal) => {
            if (settled) return;
            lifecycle.closeMs = elapsed();
            finish(exited ? exitCode : code, exited ? exitSignal : signal);
        });
    });
}

// ⛔⛔ **timeout · crash ≠ «ការធ្លាក់ឡើងដល់ exit code»**។ 🔴 ជំនាន់មុនរាប់ `rc = 'timeout/crash'` ជា `rc !== 0` ➜
// «ត្រឹមត្រូវ» ➜ checker ដែល **ព្យួរ** ពេលការអះអាងធ្លាក់ (ដែលក្នុង `run-all.sh` ក្លាយជា FAIL (ព្យួរ) ឬ GitHub cancel
// job) ត្រូវរាយថាបៃតង។ ដូច្នេះសាលក្រមមាន ៤ ៖ `failed` (exit ≠ 0 ពិត ➜ ល្អ) · `skipped` · `fake-green` ·
// **`unverified`** (ផុតថវិកា · សម្លាប់ដោយ signal · បើកមិនកើត ➜ វាស់មិនបាន ➜ FAIL មិនមែនលើកលែង)។
function poisonVerdict(r) {
    if (!r || r.timedOut || typeof r.code !== 'number') return 'unverified';
    if (r.signal) return 'unverified';
    if (r.code !== 0) return /^ZOE_EXITCODE_POISON_REACHED$/m.test(String(r.out || '')) ? 'failed' : 'unverified';
    if (/^SKIP\b/m.test(String(r.out || ''))) return 'skipped';
    return 'fake-green';
}
{
    const cases = [
        [{ code: 1, signal: null, timedOut: false, out: 'ZOE_EXITCODE_POISON_REACHED' }, 'failed'],
        [{ code: 1, signal: null, timedOut: false, out: 'SyntaxError: broken source' }, 'unverified'],
        [{ code: 2, signal: null, timedOut: false, out: 'SKIP x' }, 'unverified'],
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

async function runPoisonQueues(jobs, width, worker) {
    const isolated = jobs.filter(ISOLATED_LANE);
    const rest = jobs.filter(rel => !ISOLATED_LANE(rel));
    await runPool(isolated, 1, worker);
    const pending = rest.slice();
    const running = new Set();
    let serialRunning = false;
    while (pending.length || running.size) {
        while (running.size < width) {
            let index = serialRunning ? -1 : pending.findIndex(SERIAL_LANE);
            if (index < 0) index = pending.findIndex(rel => !SERIAL_LANE(rel));
            if (index < 0) break;
            const [rel] = pending.splice(index, 1);
            const serial = SERIAL_LANE(rel);
            if (serial) serialRunning = true;
            const task = Promise.resolve().then(() => worker(rel)).finally(() => {
                running.delete(task);
                if (serial) serialRunning = false;
            });
            running.add(task);
        }
        if (running.size) await Promise.race(running);
    }
}

function checkerBrowserDependency(rel, seen = new Set()) {
    const file = path.resolve(TOOLS, rel);
    const relative = path.relative(ROOT, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || seen.has(file)) return null;
    seen.add(file);
    let source;
    try { source = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    let ast;
    try { ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' }); }
    catch (e) {
        try { ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (parseError) { return null; }
    }
    const staticPath = (node) => {
        if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
        if (node?.type === 'Identifier') {
            if (node.name === '__dirname') return path.dirname(file);
            if (node.name === 'ROOT') return ROOT;
            if (node.name === 'TOOLS') return TOOLS;
        }
        if (node?.type === 'CallExpression' && node.callee.type === 'MemberExpression'
            && node.callee.object.name === 'path' && ['join', 'resolve'].includes(node.callee.property.name)) {
            const parts = node.arguments.map(staticPath);
            if (parts.every(part => typeof part === 'string')) return path[node.callee.property.name](...parts);
        }
        return null;
    };
    const children = [];
    let direct = false;
    const browserModule = node => node?.type === 'Literal' && typeof node.value === 'string'
        && (node.value === 'playwright-core' || node.value.startsWith('playwright-core/'));
    const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (['ImportDeclaration', 'ImportExpression', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)
            && browserModule(node.source)) direct = true;
        if (node.type === 'CallExpression') {
            const name = node.callee.type === 'Identifier' ? node.callee.name : node.callee.property?.name;
            if (name === 'require' && browserModule(node.arguments[0])) direct = true;
            const command = node.arguments[0];
            const nodeCommand = command?.type === 'MemberExpression' && command.object.name === 'process' && command.property.name === 'execPath'
                || command?.type === 'Literal' && command.value === 'node';
            const script = name === 'fork' ? command
                : ['execFile', 'execFileSync', 'spawn', 'spawnSync'].includes(name) && nodeCommand && node.arguments[1]?.type === 'ArrayExpression'
                    ? node.arguments[1].elements[0] : null;
            const child = staticPath(script);
            if (child && /\.[cm]?js$/.test(child)) children.push(path.isAbsolute(child) ? child : path.resolve(ROOT, child));
        }
        for (const [key, value] of Object.entries(node)) {
            if (key === 'start' || key === 'end') continue;
            if (Array.isArray(value)) value.forEach(walk);
            else if (value && typeof value === 'object') walk(value);
        }
    };
    walk(ast);
    if (direct) return [rel];
    for (const child of children) {
        const chain = checkerBrowserDependency(path.relative(TOOLS, child), seen);
        if (chain) return [rel, ...chain];
    }
    return null;
}

const browserExcluded = [];
const runnable = checkers.filter((rel) => {
    const chain = checkerBrowserDependency(rel);
    if (chain) browserExcluded.push(chain);
    return !chain;
});
if (browserExcluded.length) console.log('   (មិនពុល checker browser ' + browserExcluded.length + ' ៖ '
    + browserExcluded.map(chain => chain.join(' → ')).join(' · ') + '; ការវាស់ AST ខាងលើនៅរក្សា)');

// ⛔ `--part=k/n` ៖ checker ពុលទី i ជារបស់ផ្នែក (i mod n) + 1 ➜ ផ្នែកទាំង n រួមគ្នា = checker ពុលទាំងអស់ (តាមរចនាសម្ព័ន្ធ ·
//    គ្មានការជាន់)។ ការអះអាង AST និង fixture រត់គ្រប់ផ្នែក។ មូលហេតុ ៖ 🔴 វាស់បាន (CI1156) ពុល ១២៥ កូនក្នុង ២៧២.៥ វិ. នៃពិដាន
//    ៣០០ វិ. របស់ job តែមួយ ➜ deadline របស់ថវិកាកូនគ្មានរឹម ➜ ផ្នែកនីមួយៗមានពិដាន ៣០០ វិ. ផ្ទាល់ខ្លួន ⛔ មិនមែនបង្កើន CHECKER_TIMEOUT។
const PART = (() => {
    const arg = process.argv.slice(2).find((a) => a.startsWith('--part'));
    if (!arg) return { k: 1, n: 1 };
    const m = /^--part=(\d+)\/(\d+)$/.exec(arg);
    if (!m || +m[2] < 1 || +m[2] > 8 || +m[1] < 1 || +m[1] > +m[2]) return null;
    return { k: +m[1], n: +m[2] };
})();
ok('--part ត្រូវជា k/n (1 ≤ k ≤ n ≤ 8)', PART !== null, process.argv.slice(2).join(' '));
const mine = PART ? runnable.filter((_, i) => i % PART.n === PART.k - 1) : [];
if (PART && PART.n > 1) {
    console.log('   ផ្នែក ' + PART.k + '/' + PART.n + ' ៖ ពុល checker ' + mine.length + ' ក្នុង ' + runnable.length);
    const listedText = fs.existsSync(RUNALL) ? fs.readFileSync(RUNALL, 'utf8').replace(/^\s*#.*$/gm, '') : '';
    const listed = [];
    for (let k = 1; k <= PART.n; k++) {
        if (new RegExp('node\\s+tools/audit-tools/exit-code-integrity\\.js\\s+--part=' + k + '/' + PART.n + '(?=\\s|$)', 'm').test(listedText)) listed.push(k);
    }
    ok('⛔ run-all.sh រត់ផ្នែកទាំង ' + PART.n + ' (ផ្នែកដែលបាត់ = checker ដែលគ្មាននរណាពុល)', listed.length === PART.n, 'ឃើញ ' + listed.join(','));
}

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
// ការសម្លាប់ ៖ `tools/audit-tools/<checker>.js` នៅ **ពុល** ក្នុង working tree ➜
// `git commit -a` បន្ទាប់ ship checker ដែល `cond = false` ជាប់ជាប់ ➜
// **ឧបករណ៍ audit ខ្លួនវាបាក់ដោយស្ងាត់** — ជាថ្នាក់អាក្រក់ជាងបៃតងក្លែងក្លាយ។
//
// ការកែ ៖ ពុលចូល **ឯកសារស្រមោលក្បែរឯកសារដើម** (ថតដដែល ➜ `__dirname`,
// `require` ទាក់ទង និង `__filename` នៅដំណើរការដូចដើម) រួចលុបវាចោល។
// ឯកសារដើម **មិនដែលត្រូវបើកសរសេរសោះ** ➜ ការសម្លាប់នៅចំណុចណាក៏ដោយ
// (រួមទាំង SIGKILL) **មិនអាចធ្វើឲ្យ repo ខូចបានទេ**។ សំណល់ដែលនៅសល់ជា
// ឯកសារ `.tmp-poison-*` ដែលគ្មានគ្រោះថ្នាក់ ហើយត្រូវបោសចោលពេលចាប់ផ្តើម។
const POISON_PREFIX = '.tmp-poison-';
const POISON_DIRS = [TOOLS, path.join(TOOLS, 'emu'), path.join(TOOLS, 'zto-import'), path.join(TOOLS, 'zoew/scripts')];

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
if (!process.env.EXITCODE_CHILD) sweepPoisonLeftovers();

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
    const budgetMs = childBudgetMs(Date.now(), DEADLINE_AT, EXPLICIT_CHILD_MS);
    if (budgetMs < MIN_CHILD_BUDGET_MS) {
        shadows.delete(shadow);
        try { fs.unlinkSync(shadow); } catch (e) {}
        unverified.push(rel + ' (គ្មានពេលនៅសល់មុន deadline ' + JOB_CEILING_MS + 'ms − ' + DEADLINE_RESERVE_MS + 'ms ➜ មិនបានរត់)');
        return;
    }
    let result;
    try {
        result = await runPoisonedChild(shadow, budgetMs);
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
        console.log('ZOE_EXITCODE_CHILD_DIAGNOSTIC ' + JSON.stringify({ checker: rel, code: result.code,
            signal: result.signal, timedOut: result.timedOut, lifecycle: result.lifecycle }));
        const tail = String(result.out || '').trim().split('\n').slice(-14).join(' | ').slice(-1600);
        unverified.push(rel + ' (' + (result.timedOut ? 'ផុតថវិកា ' + budgetMs + 'ms (deadline របស់ job)' : 'signal=' + result.signal + ' code=' + result.code + ' (គ្មានភស្តុតាងពុលដែលបញ្ចប់ដោយគ្មាន uncaught crash)' ) + ') ចុង output ៖ ' + tail);
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
    mine.length = 0;
}
try {
    await runPoisonQueues(mine, CONCURRENCY, poisonOne);
} finally {
    killLiveChildren();
    dropShadows();
    if (!process.env.EXITCODE_CHILD) sweepPoisonLeftovers();
}
const slowest = timings.slice().sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([rel, ms]) => rel + ' ' + (ms / 1000).toFixed(1) + 's').join(' · ');
console.log('   (ពុល ' + timings.length + ' checker ក្នុង ' + ((Date.now() - startedAt) / 1000).toFixed(1)
    + ' វិ. · ស្របគ្នា ' + CONCURRENCY + ' · យឺតជាងគេ ៖ ' + slowest + ')');

const MIN_POISONED = 25;
if (process.env.EXITCODE_CHILD || mine.includes(ZTO_IMPORT_TEST)) {
    ok('tools/audit-tools/zto-import/test.js ៖ ពុលការអះអាងពិតយ៉ាងតិច ៦៩ ➜ exit 1 ហើយឯកសារដើមមិនប្រែ',
        ztoPoison && ztoPoison.rc === 1 && ztoPoison.passed === 0 && ztoPoison.failed >= 69 && ztoPoison.unchanged,
        ztoPoison);
} else {
    console.log('   (tools/audit-tools/zto-import/test.js ពុលក្នុងផ្នែកផ្សេង)');
}
ok('ជាន់អប្បបរមា៖ ពុល checker ដែលមិនប្រើ browser >= ' + MIN_POISONED + ' (ពុលបាន ' + poisoned + ')',
    poisoned >= MIN_POISONED, { poisoned, unpoisonable });
ok('គ្មាន checker ណាចេញ exit 0 ខណៈការអះអាងទាំងអស់ធ្លាក់',
    fakeGreen.length === 0, fakeGreen);
ok('⛔ គ្មាន checker ណាផុតថវិកា ស្លាប់ដោយ signal ឬខ្វះភស្តុតាងថាពុលបានរត់ (crash ≠ assertion)',
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
