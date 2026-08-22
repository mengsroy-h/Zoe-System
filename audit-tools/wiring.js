const acorn = require('acorn');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

let issues = 0;
function bad(app, kind, detail) { console.log('  ⚠ [' + app + '] ' + kind + ': ' + detail); issues++; }

function walk(node, cb) {
    if (!node || typeof node.type !== 'string') return;
    cb(node);
    for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach((c) => walk(c, cb));
        else if (v && typeof v.type === 'string') walk(v, cb);
    }
}

for (const app of APPS) {
    const js = fs.readFileSync(path.join(root, app, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, app, 'index.html'), 'utf8');
    const ast = acorn.parse(js, { ecmaVersion: 2022, sourceType: 'script' });

    // every top-level (global-reachable) function name
    const globals = new Set();
    walk(ast, (n) => { if (n.type === 'FunctionDeclaration' && n.id) globals.add(n.id.name); });

    // --- 1. HTML ids vs getElementById ---
    const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const dupIds = {};
    for (const m of html.matchAll(/\bid="([^"]+)"/g)) dupIds[m[1]] = (dupIds[m[1]] || 0) + 1;
    Object.entries(dupIds).filter(([, n]) => n > 1).forEach(([id, n]) => bad(app, 'duplicate HTML id', id + ' x' + n));

    const jsIds = new Set();
    walk(ast, (n) => {
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' &&
            n.callee.property.name === 'getElementById' && n.arguments.length === 1 &&
            n.arguments[0].type === 'Literal') jsIds.add(n.arguments[0].value);
    });
    jsIds.delete('zoeUpdateBanner');
    // also ids referenced from generated HTML strings
    const genIds = new Set([...js.matchAll(/\bid="([a-zA-Z][\w-]*)"/g)].map((m) => m[1]));
    for (const id of jsIds) {
        if (!htmlIds.has(id) && !genIds.has(id)) bad(app, 'getElementById with no HTML id', id);
    }

    // --- 2. inline on*= handlers in HTML and in generated HTML strings ---
    const calls = new Set();
    const src = html + '\n' + js;
    for (const m of src.matchAll(/\bon(?:click|change|input|submit|keyup|keydown|keypress|load|error)\s*=\s*(["'])(.*?)\1/gs)) {
        for (const c of m[2].matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) calls.add(c[2]);
    }
    const builtins = new Set(['if', 'return', 'this', 'event', 'Number', 'String', 'parseInt', 'parseFloat', 'alert', 'confirm', 'setTimeout', 'JSON', 'Boolean', 'Array', 'Object', 'Date', 'window', 'document']);
    for (const c of calls) {
        if (!builtins.has(c) && !globals.has(c)) bad(app, 'inline handler calls missing function', c);
    }

    // --- 3. data-close targets ---
    for (const m of src.matchAll(/data-close="([^"]+)"/g)) {
        const fn = m[1];
        if (!globals.has(fn)) bad(app, 'data-close target missing', fn);
    }

    // --- 4. onValue(dbRefX) guarded ---
    walk(ast, (n) => {
        if (n.type !== 'CallExpression') return;
        const callee = n.callee;
        const isOnValue = (callee.type === 'MemberExpression' && callee.property.name === 'onValue');
        if (!isOnValue || !n.arguments.length) return;
        const a0 = n.arguments[0];
        if (a0.type !== 'Identifier' || !/^dbRef/.test(a0.name)) return;
        const before = js.slice(Math.max(0, n.start - 800), n.start);
        const guarded = new RegExp('if\\s*\\(\\s*' + a0.name + '\\s*\\)').test(before)
            || new RegExp('if\\s*\\(\\s*!\\s*' + a0.name + '\\s*\\)\\s*return').test(before)
            || new RegExp(a0.name + '\\s*=\\s*(fb|sdk|window\\.firebaseSDK)\\.ref\\(').test(before);
        if (!guarded) {
            bad(app, 'unguarded onValue', a0.name + ' near offset ' + n.start);
        }
    });
}
console.log(issues === 0 ? '\n✅ wiring clean' : '\n❌ ' + issues + ' wiring issue(s)');
process.exit(issues === 0 ? 0 : 1);
