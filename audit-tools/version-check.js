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
const APPS = ['ZoeAdmin', 'ZoeW', 'Zoescan', 'ZoeKeyGen'];
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
check('APP_VERSION ដូចគ្នាទាំង ៤ App', versions.length, 1);
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
check(`${RENDER_FN}() byte-identical ទាំង ៤`, new Set(APPS.map((a) => renderBody[a])).size, 1);

console.log('\n-- កន្លែងបង្ហាញ: ប្រអប់ login ប៉ុណ្ណោះ --');
for (const app of APPS) {
    const html = fs.readFileSync(path.join(root, app, 'index.html'), 'utf8');
    const lines = html.split('\n');
    const placeholders = lines.filter((l) => l.includes('data-app-version'));
    check(`${app} មានកន្លែងបង្ហាញកំណែ ១ ប៉ុណ្ណោះ`, placeholders.length, 1);
    const start = lines.findIndex((l) => l.includes('<div id="loginModal"'));
    const at = lines.findIndex((l) => l.includes('data-app-version'));
    const closes = lines.findIndex((l, i) => i > start && l === '</div>');
    check(`${app} កន្លែងនោះនៅក្នុង loginModal`, start !== -1 && at > start && at < closes, true);
}

console.log('');
if (failures) {
    console.log(`❌ ធ្លាក់ ${failures} — កំណែមិនស៊ីគ្នា។ ប្រភពតែមួយគឺ APP_VERSION ក្នុង app.js; manifest.json ត្រូវតាមវា។`);
    process.exit(1);
}
console.log('✅ កំណែ App ស៊ីគ្នាទាំង ៤ (app.js ↔ manifest.json ↔ index.html)');
