let acorn;
try {
    acorn = require('acorn');
} catch (e) {
    console.error('ត្រូវការ acorn — រត់ `npm i acorn` ជាមុនសិន (ឬកំណត់ NODE_PATH ទៅកន្លែងដែលបានដំឡើង)។');
    process.exit(2);
}
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const APPS = ['ZoeAdmin', 'ZoeW', 'Zoescan', 'ZoeKeyGen'];

const EXPECTED_DIVERGENT = new Set([
    'applySetupLinkFromUrl', 'atTop', 'attemptAuthStorageRecovery', 'cancelPinEntryFlow',
    'cancelPinSetupFlow', 'checkPinAndOpenConfig', 'closeModal', 'ensureAppActivated',
    'forceExpireSession', 'handleConfigQrResult', 'hashPin', 'hashPinLegacy',
    'initDatabaseListeners', 'initFirebase', 'isFirebaseSessionExpired', 'licenseFailureMessage',
    'loginWithFirebase', 'logoutApp', 'openConfigModal', 'openConfigQrScanner', 'openModalHelper',
    'requestPinBeforeConfig', 'retryPendingRoleCheck', 'sanitizePhoneNumber', 'saveFirebaseConfig',
    'saveNewSecurityPin',
    'setupAuthListener', 'setupIOSPullToRefresh', 'showLoginModalWithPrefill', 'showToast',
    'submitActivationKey', 'updateAuthButton', 'verifySecurityPin', 'verifyStoredPin'
]);

function walk(node, cb) {
    if (!node || typeof node.type !== 'string') return;
    cb(node);
    for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => walk(child, cb));
        else if (value && typeof value.type === 'string') walk(value, cb);
    }
}

const fns = {};
for (const app of APPS) {
    const src = fs.readFileSync(path.join(root, app, 'app.js'), 'utf8');
    walk(acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' }), (node) => {
        if (node.type !== 'FunctionDeclaration' || !node.id) return;
        const body = src.slice(node.start, node.end).split('\n').map((l) => l.trim()).join('\n');
        (fns[node.id.name] = fns[node.id.name] || {})[app] = body;
    });
}

const shared = Object.keys(fns).filter((n) => Object.keys(fns[n]).length >= 3).sort();
const unexpected = [];
let identical = 0;

for (const name of shared) {
    const where = Object.keys(fns[name]);
    const uniq = new Set(where.map((a) => fns[name][a]));
    if (uniq.size === 1) { identical++; continue; }
    if (EXPECTED_DIVERGENT.has(name)) continue;
    unexpected.push(name + '  (' + where.join(', ') + ')');
}

console.log('shared by >=3 apps: ' + shared.length +
    '   identical: ' + identical +
    '   expected-divergent: ' + (shared.length - identical - unexpected.length) +
    '   UNEXPECTED: ' + unexpected.length);

if (unexpected.length) {
    console.log('\nUNEXPECTED DRIFT (a shared helper that should be one implementation):');
    unexpected.forEach((line) => console.log('  - ' + line));
    console.log('\nរត់ `node audit-tools/shared-fns.js --show <name>` ដើម្បីមើលកូដទាំង ៤ ជាប់គ្នា។');
    process.exitCode = 1;
} else {
    console.log('\n✅ គ្មានការបែកគ្នាដែលមិនរំពឹងទុកទេ');
}

const showIdx = process.argv.indexOf('--show');
if (showIdx !== -1) {
    process.argv.slice(showIdx + 1).forEach((name) => {
        console.log('\n########## ' + name + ' ##########');
        APPS.forEach((app) => {
            if (!fns[name] || !fns[name][app]) return;
            console.log('--- ' + app + ' ---');
            console.log(fns[name][app]);
        });
    });
}
