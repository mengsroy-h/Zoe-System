// Function-surface audit៖ រាប់ និងផ្ទៀងផ្ទាត់ផ្ទៃ function ដែល ship ពិត។
//
// វាមិនអះអាងថា static scan អាចបញ្ជាក់ semantics ១០០% ទេ។ វាបិទចន្លោះដែល
// behavior test ងាយរំលង៖ declaration ឈ្មោះស្ទួនដែល JavaScript hoist/សរសេរជាន់
// ស្ងាត់ៗ, action route ដែលចង្អុលទៅ function មិនមាន និង top-level function ដែល
// គ្មាន call/reference ឬ dispatcher route ណាមួយ។ Anonymous callback ត្រូវបានរាប់
// ក្នុង inventory ហើយត្រូវគ្របបន្ថែមដោយ browser/integration suite។

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = process.env.FNSURFACE_APP_DIR
    ? path.resolve(process.env.FNSURFACE_APP_DIR)
    : path.resolve(__dirname, '..');

const APPS = [
    { name: 'ZoeW', minChars: 400000, minHtml: 40000, minTop: 500, minAll: 700, minRoutes: 80 },
    { name: 'ZoeKeyGen', minChars: 80000, minHtml: 12000, minTop: 100, minAll: 150, minRoutes: 15 }
];

const SHIPPED_HELPERS = [
    'ZoeW/boot-flags.js',
    'ZoeW/error-reporting.js',
    'ZoeW/firebase-loader.js',
    'ZoeW/license-verify.js',
    'ZoeW/netlify/functions/zto-order-detail.js',
    'ZoeW/sw.js',
    'ZoeKeyGen/boot-flags.js',
    'ZoeKeyGen/error-reporting.js',
    'ZoeKeyGen/firebase-loader.js',
    'ZoeKeyGen/license-verify.js',
    'ZoeKeyGen/sw.js',
    'zto-import/Code.gs',
    'zto-import/Watch.gs',
    'zto-import/google-sheets-api/Code.gs'
];

let pass = 0;
let fail = 0;
function check(label, condition, detail) {
    if (condition) {
        pass++;
        console.log('   ok    ' + label);
    } else {
        fail++;
        console.log('   FAIL  ' + label
            + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : ''));
    }
}

function read(rel) {
    try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return ''; }
}

function parse(source, rel) {
    try {
        return acorn.parse(source, {
            ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true
        });
    } catch (scriptError) {
        try {
            return acorn.parse(source, {
                ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true
            });
        } catch (moduleError) {
            check(rel + ' parse បាន', false, moduleError.message);
            return null;
        }
    }
}

function walk(node, visit, functionDepth) {
    if (!node || typeof node !== 'object') return;
    const depth = functionDepth || 0;
    visit(node, depth);
    const nextDepth = depth + ((node.type === 'FunctionDeclaration'
        || node.type === 'FunctionExpression'
        || node.type === 'ArrowFunctionExpression') ? 1 : 0);
    Object.keys(node).forEach((key) => {
        if (key === 'start' || key === 'end') return;
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => walk(child, visit, nextDepth));
        else if (value && typeof value.type === 'string') walk(value, visit, nextDepth);
    });
}

for (const cfg of APPS) {
    const jsRel = cfg.name + '/app.js';
    const htmlRel = cfg.name + '/index.html';
    const source = read(jsRel);
    const html = read(htmlRel);
    check(cfg.name + '៖ បានអាន app.js និង index.html ពិត',
        source.length > cfg.minChars && html.length > cfg.minHtml,
        { appBytes: source.length, htmlBytes: html.length });
    if (!source || !html) continue;

    const ast = parse(source, jsRel);
    if (!ast) continue;

    const functionNodes = [];
    const declarations = [];
    const identifierCounts = new Map();
    walk(ast, (node, depth) => {
        if (node.type === 'FunctionDeclaration'
            || node.type === 'FunctionExpression'
            || node.type === 'ArrowFunctionExpression') functionNodes.push(node);
        if (node.type === 'FunctionDeclaration' && node.id) {
            declarations.push({ name: node.id.name, top: depth === 0 });
        }
        if (node.type === 'Identifier') {
            identifierCounts.set(node.name, (identifierCounts.get(node.name) || 0) + 1);
        }
    });

    const top = declarations.filter((item) => item.top);
    check(cfg.name + '៖ inventory មាន top-level function >= ' + cfg.minTop,
        top.length >= cfg.minTop, top.length);
    check(cfg.name + '៖ inventory មាន function/callback សរុប >= ' + cfg.minAll,
        functionNodes.length >= cfg.minAll, functionNodes.length);

    const topCounts = new Map();
    top.forEach((item) => topCounts.set(item.name, (topCounts.get(item.name) || 0) + 1));
    const duplicateTop = [...topCounts].filter((entry) => entry[1] > 1)
        .map((entry) => entry[0] + ' ×' + entry[1]);
    check(cfg.name + '៖ គ្មាន top-level function declaration ឈ្មោះស្ទួន',
        duplicateTop.length === 0, duplicateTop);

    const combined = html + '\n' + source;
    const dynamicRoutes = new Set();
    for (const match of combined.matchAll(/(?:data-act|data-close)=["']([^"']+)["']/g)) {
        dynamicRoutes.add(match[1]);
    }
    const allowBlock = /const ACTION_ALLOWLIST = \[([\s\S]*?)\];/.exec(source);
    if (allowBlock) {
        for (const match of allowBlock[1].matchAll(/["']([^"']+)["']/g)) {
            dynamicRoutes.add(match[1]);
        }
    }
    check(cfg.name + '៖ inventory មាន dynamic action route >= ' + cfg.minRoutes,
        dynamicRoutes.size >= cfg.minRoutes, dynamicRoutes.size);

    // ⛔ ZoeW ជា React ៖ ការយោងជាច្រើនរស់ក្នុង JSX (`onClick={togglePanelFromHandle}` · hook · helper របស់ component)
    //    ➜ រាប់ identifier ក្នុង `components.js` (ទិដ្ឋភាពអត្ថបទនៃ `.tsx` — build-audit ២ឃ) ផង ⛔ **លើកលែង** បន្ទាត់
    //    `import`/`export {…}` (ការនាំចូលដោយគ្មានការប្រើ មិនមែនការយោងទេ)
    const componentsText = read(cfg.name + '/components.js');
    if (componentsText) {
        const body = componentsText.replace(/^import [^\n]*;$/gm, '').replace(/^export \{[\s\S]*?\};$/gm, '');
        let jsxRefs = 0;
        for (const t of acorn.tokenizer(body, { ecmaVersion: 'latest', sourceType: 'module' })) {
            if (t.type.label !== 'name') continue;
            identifierCounts.set(t.value, (identifierCounts.get(t.value) || 0) + 1);
            jsxRefs++;
        }
        check(cfg.name + '៖ ជាន់អប្បបរមា ៖ រាប់ការយោងពី JSX (`components.js`) បាន', jsxRefs > 5000, jsxRefs);
    }
    // ⛔ តួ **ដើម** នៃ function ដែលទិដ្ឋភាព checker override (`view-originals.js` — build-audit ២) ៖ ការយោងក្នុងវា
    //    (ឧ. `commitNow()` ➜ `allStores()`) ជាការយោងពិតក្នុងកូដ ship ➜ រាប់ ⛔ **លើកលែង** ឈ្មោះរបស់ function ដែលប្រកាស
    //    (ការប្រកាសខ្លួនឯងមិនមែនការយោង)
    const originalsText = read(cfg.name + '/view-originals.js');
    if (originalsText) {
        const body = originalsText.replace(/^(\s*)(async )?function [A-Za-z_$][\w$]*/gm, '$1$2function ');
        for (const t of acorn.tokenizer(body, { ecmaVersion: 'latest', sourceType: 'module' })) {
            if (t.type.label !== 'name') continue;
            identifierCounts.set(t.value, (identifierCounts.get(t.value) || 0) + 1);
        }
    }

    const topNames = new Set(top.map((item) => item.name));
    const missingRoutes = [...dynamicRoutes].filter((name) => !topNames.has(name)).sort();
    check(cfg.name + '៖ data-act/data-close/allowlist ទាំងអស់មាន function ពិត',
        missingRoutes.length === 0, missingRoutes);

    const orphanTop = [...topNames].filter((name) => {
        return (identifierCounts.get(name) || 0) <= 1 && !dynamicRoutes.has(name);
    }).sort();
    check(cfg.name + '៖ top-level function ទាំងអស់មាន static reference ឬ dispatcher route',
        orphanTop.length === 0, orphanTop);

    const nested = declarations.filter((item) => !item.top);
    const orphanNested = nested.filter((item) => (identifierCounts.get(item.name) || 0) <= 1)
        .map((item) => item.name).sort();
    check(cfg.name + '៖ named nested function ទាំងអស់មាន reference',
        orphanNested.length === 0, orphanNested);

    console.log('         inventory: ' + top.length + ' top-level · '
        + nested.length + ' named nested · ' + functionNodes.length
        + ' function/callback nodes · ' + dynamicRoutes.size + ' dynamic routes');
}

let helperFunctions = 0;
let parsedHelpers = 0;
for (const rel of SHIPPED_HELPERS) {
    const source = read(rel);
    if (!source) {
        check('រកឃើញ shipped helper ' + rel, false, 'missing');
        continue;
    }
    const ast = parse(source, rel);
    if (!ast) continue;
    parsedHelpers++;
    walk(ast, (node) => {
        if (node.type === 'FunctionDeclaration'
            || node.type === 'FunctionExpression'
            || node.type === 'ArrowFunctionExpression') helperFunctions++;
    });
}
check('shipped helper/server files parse បានទាំង ' + SHIPPED_HELPERS.length,
    parsedHelpers === SHIPPED_HELPERS.length, parsedHelpers);
check('shipped helper/server function inventory មិនទទេ', helperFunctions >= 50, helperFunctions);
console.log('         helper/server inventory: ' + helperFunctions
    + ' function/callback nodes ក្នុង ' + parsedHelpers + ' files');

console.log('\nសរុប function surface: ' + pass + ' ok, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
