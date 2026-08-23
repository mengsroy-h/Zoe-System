let acorn;
try {
    acorn = require('acorn');
} catch (e) {
    console.error('ត្រូវការ acorn — រត់ `npm i acorn` ជាមុនសិន (ឬកំណត់ NODE_PATH ទៅកន្លែងដែលបានដំឡើង)។');
    process.exit(2);
}
const fs = require('fs');
const path = require('path');

const root = process.env.VERSION_APP_DIR || path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];
const SEMVER = /^\d+\.\d+\.\d+$/;
const RENDER_FN = 'renderAppVersionLabels';

let failures = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures++;
    console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : '  expected ' + JSON.stringify(expected)}`);
}

function walk(node, cb) {
    if (!node || typeof node.type !== 'string') return;
    cb(node);
    for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => walk(child, cb));
        else if (value && typeof value.type === 'string') walk(value, cb);
    }
}

const declared = {};
const renderBody = {};
const called = {};

for (const app of APPS) {
    const src = fs.readFileSync(path.join(root, app, 'app.js'), 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
    walk(ast, (node) => {
        if (node.type === 'VariableDeclarator' && node.id.name === 'APP_VERSION') {
            declared[app] = node.init && node.init.type === 'Literal' ? node.init.value : null;
        }
        if (node.type === 'FunctionDeclaration' && node.id && node.id.name === RENDER_FN) {
            renderBody[app] = src.slice(node.start, node.end).split('\n').map((l) => l.trim()).join('\n');
        }
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === RENDER_FN) {
            called[app] = (called[app] || 0) + 1;
        }
    });
}

console.log('\n-- ប្រភពតែមួយនៃការពិត: APP_VERSION ក្នុង app.js --');
for (const app of APPS) {
    check(`${app} ប្រកាស APP_VERSION ជា semver`, SEMVER.test(String(declared[app])), true);
}
const versions = [...new Set(APPS.map((a) => declared[a]))];
check('APP_VERSION ដូចគ្នាទាំង ២ App', versions.length, 1);
const version = versions.length === 1 ? versions[0] : null;
console.log(`   កំណែបច្ចុប្បន្ន: ${version}`);

console.log('\n-- manifest.json ត្រូវនឹង APP_VERSION --');
for (const app of APPS) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, app, 'manifest.json'), 'utf8'));
    check(`${app}/manifest.json version`, manifest.version, version);
}

console.log(`\n-- ${RENDER_FN}() មានក្នុងគ្រប់ App និងត្រូវបានហៅ --`);
for (const app of APPS) {
    check(`${app} ប្រកាស ${RENDER_FN}()`, typeof renderBody[app] === 'string', true);
    check(`${app} ហៅ ${RENDER_FN}() យ៉ាងតិចម្ដង`, (called[app] || 0) >= 1, true);
    check(`${app} render យក APP_VERSION មិនមែនអក្សរដិត`, String(renderBody[app]).includes('APP_VERSION'), true);
}
check(`${RENDER_FN}() byte-identical ទាំង ២`, new Set(APPS.map((a) => renderBody[a])).size, 1);

// កន្លែងបង្ហាញកំណែត្រូវមានតែក្នុងកន្តុំដែលរាយខាងក្រោមប៉ុណ្ណោះ។ ការបន្ថែមកន្លែងថ្មី
// ដោយចៃដន្យ (ឧ. ក្នុងតារាង ឬ modal ផ្សេង) ធ្វើឲ្យអ្នកប្រើឃើញកំណែច្រើនកន្លែងមិនស៊ីគ្នា។
const VERSION_SLOTS = {
    ZoeW: [
        { label: 'ប្រអប់ login', open: '<div id="loginModal"', close: '</div>' },
        { label: 'របា Slide (ការកំណត់)', open: '<aside class="side-drawer"', close: '</aside>' }
    ],
    ZoeKeyGen: [
        { label: 'ប្រអប់ login', open: '<div id="loginModal"', close: '</div>' }
    ]
};

console.log('\n-- កន្លែងបង្ហាញកំណែ --');
for (const app of APPS) {
    const html = fs.readFileSync(path.join(root, app, 'index.html'), 'utf8');
    const lines = html.split('\n');
    const slots = VERSION_SLOTS[app];
    const at = lines.map((l, i) => (l.includes('data-app-version') ? i : -1)).filter((i) => i !== -1);
    check(`${app} មានកន្លែងបង្ហាញកំណែ ${slots.length} ប៉ុណ្ណោះ`, at.length, slots.length);
    const covered = new Set();
    slots.forEach((slot) => {
        const start = lines.findIndex((l) => l.includes(slot.open));
        const closes = lines.findIndex((l, i) => i > start && l.trimEnd() === slot.close);
        const hit = at.find((i) => start !== -1 && i > start && i < closes);
        check(`${app} បង្ហាញកំណែក្នុង ${slot.label}`, hit !== undefined, true);
        if (hit !== undefined) covered.add(hit);
    });
    check(`${app} គ្មានកន្លែងបង្ហាញកំណែក្រៅកន្តុំដែលរំពឹងទុក`, at.filter((i) => !covered.has(i)).length, 0);
}

console.log('');
if (failures) {
    console.log(`❌ ធ្លាក់ ${failures} — កំណែមិនស៊ីគ្នា។ ប្រភពតែមួយគឺ APP_VERSION ក្នុង app.js; manifest.json ត្រូវតាមវា។`);
    process.exit(1);
}
console.log('✅ កំណែ App ស៊ីគ្នាទាំង ២ (app.js ↔ manifest.json ↔ index.html)');
