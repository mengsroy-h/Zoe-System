const fs = require('fs');
const path = require('path');
let acorn;
try { acorn = require('acorn'); } catch (e) {
    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}

const ROOT = process.env.STALEWRITE_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW'];

const MEMORY_ARRAYS = ['scanHistory', 'deletedItems'];

const HISTORY_SINKS = ['saveSingleHistoryItemToFirebase', 'saveSingleDeletedItemToFirebase'];

const WRITE_PATHS = ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod'];

// function ដែលអានច្បាប់ចម្លងរបស់ server (fb.get) មុនសរសេរ ត្រូវបានទទួលយក —
// នោះជាលំនាំដែលជុំ ១៣ និង ១៥ បានតម្រូវឲ្យប្រើសម្រាប់ការសរសេរ item ទាំងមូល។
const ACCEPTED = {};

let problems = 0;
let checked = 0;
const serverBacked = [];

function walk(node, visit, parent) {
    if (!node || typeof node.type !== 'string') return;
    visit(node, parent);
    for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'start' || key === 'end') continue;
        const v = node[key];
        if (Array.isArray(v)) v.forEach((c) => { if (c && typeof c.type === 'string') walk(c, visit, node); });
        else if (v && typeof v.type === 'string') walk(v, visit, node);
    }
}

function isMemoryExpression(node, memoryVars) {
    if (!node) return false;
    if (node.type === 'Identifier') return memoryVars.has(node.name);
    if (node.type === 'MemberExpression') {
        // scanHistory[i] / deletedItems[0]
        if (node.object.type === 'Identifier' && MEMORY_ARRAYS.includes(node.object.name)) return true;
        return isMemoryExpression(node.object, memoryVars);
    }
    if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier'
            && MEMORY_ARRAYS.includes(callee.object.name)
            && callee.property.type === 'Identifier'
            && ['find', 'splice', 'shift', 'pop'].includes(callee.property.name)) return true;
        return false;
    }
    if (node.type === 'ObjectExpression') {
        return node.properties.some((p) => p.type === 'SpreadElement' && isMemoryExpression(p.argument, memoryVars));
    }
    if (node.type === 'AssignmentExpression') return isMemoryExpression(node.right, memoryVars);
    if (node.type === 'LogicalExpression') return isMemoryExpression(node.left, memoryVars) || isMemoryExpression(node.right, memoryVars);
    if (node.type === 'ConditionalExpression') return isMemoryExpression(node.consequent, memoryVars) || isMemoryExpression(node.alternate, memoryVars);
    return false;
}

function collectMemoryVars(fnNode) {
    const memoryVars = new Set();
    // ដំណើរការពីរជុំ ដើម្បីចាប់ការភ្ជាប់បន្តបន្ទាប់ (a = scanHistory.find(); b = a;)
    for (let pass = 0; pass < 3; pass++) {
        walk(fnNode, (n) => {
            if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) {
                if (isMemoryExpression(n.init, memoryVars)) memoryVars.add(n.id.name);
            }
            if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') {
                if (isMemoryExpression(n.right, memoryVars)) memoryVars.add(n.left.name);
            }
        });
    }
    return memoryVars;
}

function enclosingFunctionName(stack) {
    for (let i = stack.length - 1; i >= 0; i--) {
        const f = stack[i];
        if (f.id && f.id.name) return f.id.name;
        if (f.__name) return f.__name;
    }
    return '(anonymous)';
}

APPS.forEach((app) => {
    const file = path.join(ROOT, app, 'app.js');
    if (!fs.existsSync(file)) return;
    const src = fs.readFileSync(file, 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, locations: true });

    const functions = [];
    walk(ast, (n, parent) => {
        if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
            let name = (n.id && n.id.name) || null;
            if (!name && parent) {
                if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') name = parent.id.name;
                if (parent.type === 'Property' && parent.key && parent.key.name) name = parent.key.name;
            }
            n.__name = name;
            functions.push(n);
        }
    });

    functions.forEach((fn) => {
        // យកតែ function កម្រិតលើ ដែលមានឈ្មោះ ដើម្បីរាយការណ៍ត្រឹមត្រូវ
        if (!fn.__name && !(fn.id && fn.id.name)) return;
        const fnName = fn.__name || fn.id.name;
        const memoryVars = collectMemoryVars(fn);
        if (!memoryVars.size) return;

        // ការអានច្បាប់ចម្លងរបស់ server សម្រាប់ *node ជាក់លាក់* (មិនមែនការ resync ទាំងមូល)
        // ដែលកើតឡើង *មុន* ការសរសេរ ទើបធ្វើឲ្យការសរសេរនោះទុកចិត្តបាន។
        const serverReadStarts = [];
        walk(fn, (n) => {
            if (n.type !== 'CallExpression') return;
            const c = n.callee;
            const isGet = c.type === 'MemberExpression' && c.property.type === 'Identifier' && c.property.name === 'get';
            if (!isGet) return;
            const argSrc = n.arguments.map((a) => src.slice(a.start, a.end)).join(' ');
            if (WRITE_PATHS.some((wp) => argSrc.indexOf(wp + '/') !== -1)) serverReadStarts.push(n.start);
        });

        walk(fn, (n) => {
            if (n.type !== 'CallExpression') return;
            const callee = n.callee;
            let isWrite = false;
            let payloads = [];

            if (callee.type === 'Identifier' && HISTORY_SINKS.includes(callee.name)) {
                isWrite = true;
                payloads = n.arguments.slice(0, 1);
            } else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
                && ['update', 'set'].includes(callee.property.name)) {
                const argSrc = n.arguments.map((a) => src.slice(a.start, a.end)).join(' ');
                if (WRITE_PATHS.some((p) => argSrc.indexOf(p) !== -1)) {
                    isWrite = true;
                    payloads = n.arguments.slice(1);
                }
            }
            if (!isWrite) return;
            checked++;

            payloads.forEach((p) => {
                const bad = [];
                if (p.type === 'ObjectExpression') {
                    p.properties.forEach((prop) => {
                        if (prop.type === 'Property' && isMemoryExpression(prop.value, memoryVars)) {
                            bad.push(src.slice(prop.start, prop.end).slice(0, 90));
                        }
                    });
                } else if (isMemoryExpression(p, memoryVars)) {
                    bad.push(src.slice(p.start, p.end).slice(0, 90));
                }
                if (!bad.length) return;
                const key = app + '/' + fnName;
                if (ACCEPTED[key]) return;
                if (serverReadStarts.some((st) => st < n.start)) { serverBacked.push(key); return; }
                problems++;
                console.log('  FAIL  ' + key + ' បន្ទាត់ ' + n.loc.start.line
                    + '\n        សរសេរ object ដែលអានពីសតិ (scanHistory/deletedItems) ទៅ Firebase ដោយផ្ទាល់៖'
                    + '\n        ' + bad.join('\n        '));
            });
        });
    });
});

if (problems === 0) {
    console.log('  ok    គ្មានការសរសេរ item ទាំងមូលពីច្បាប់ចម្លងក្នុងសតិ (ពិនិត្យ ' + checked + ' កន្លែងសរសេរ)');
    [...new Set(serverBacked)].forEach((k) => console.log('  ok    អានច្បាប់ចម្លង server មុនសរសេរ: ' + k));
    Object.keys(ACCEPTED).forEach((k) => console.log('  ok    ទទួលយក: ' + k + ' — ' + ACCEPTED[k]));
    process.exit(0);
}
console.log('\nFAIL ' + problems);
process.exit(1);
