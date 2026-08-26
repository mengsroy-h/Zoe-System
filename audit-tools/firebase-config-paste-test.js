let acorn;
try {
    acorn = require('acorn');
} catch (e) {
    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.CFGPASTE_APP_DIR ? path.resolve(process.env.CFGPASTE_APP_DIR) : path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];
const WANTED_FNS = [
    'stripJsCommentsOutsideStrings',
    'matchingBraceIndex',
    'extractFirebaseConfigObject',
    'firebaseObjectTextToJson',
    'normalizeFirebaseConfig',
    'firebaseConfigErrorMessage'
];

function walk(node, cb) {
    if (!node || typeof node.type !== 'string') return;
    cb(node);
    for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => walk(child, cb));
        else if (value && typeof value.type === 'string') walk(value, cb);
    }
}

function loadApp(app) {
    const src = fs.readFileSync(path.join(root, app, 'app.js'), 'utf8');
    const tree = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
    const pieces = [];
    const found = new Set();
    walk(tree, (node) => {
        if (node.type === 'FunctionDeclaration' && node.id && WANTED_FNS.indexOf(node.id.name) !== -1) {
            pieces.push(src.slice(node.start, node.end));
            found.add(node.id.name);
        }
        if (node.type === 'VariableDeclarator' && node.id && node.id.name === 'FIREBASE_CONFIG_KEYS') {
            pieces.push('const FIREBASE_CONFIG_KEYS = ' + src.slice(node.init.start, node.init.end) + ';');
            found.add('FIREBASE_CONFIG_KEYS');
        }
    });
    const missing = WANTED_FNS.concat(['FIREBASE_CONFIG_KEYS']).filter((n) => !found.has(n));
    if (missing.length) throw new Error(app + ' ខ្វះ៖ ' + missing.join(', '));
    const sandbox = { JSON, String, Object, Array, Error, RegExp, console };
    vm.createContext(sandbox);
    vm.runInContext(pieces.join('\n'), sandbox, { filename: app + '/app.js' });
    return sandbox;
}

let passed = 0;
const failures = [];

function check(name, condition, detail) {
    if (condition) passed++;
    else failures.push(name + (detail ? ' — ' + detail : ''));
}

function equal(name, actual, expected) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    check(name, a === b, 'បាន ' + a + ' រំពឹង ' + b);
}

const CONSOLE_SNIPPET = [
    '// Import the functions you need from the SDKs you need',
    'import { initializeApp } from "firebase/app";',
    'import { getAnalytics } from "firebase/analytics";',
    '// TODO: Add SDKs for Firebase products that you want to use',
    '// https://firebase.google.com/docs/web/setup#available-libraries',
    '',
    "// Your web app's Firebase configuration",
    '// For Firebase JS SDK v7.20.0 and later, measurementId is optional',
    'const firebaseConfig = {',
    '  apiKey: "AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE",',
    '  authDomain: "demo-app.firebaseapp.com",',
    '  databaseURL: "https://demo-app-default-rtdb.firebaseio.com",',
    '  projectId: "demo-app",',
    '  storageBucket: "demo-app.firebasestorage.app",',
    '  messagingSenderId: "000000000000",',
    '  appId: "1:000000000000:web:0000000000000000000000",',
    '  measurementId: "G-FAKE000000"',
    '};',
    '',
    '// Initialize Firebase',
    'const app = initializeApp(firebaseConfig);',
    'const analytics = getAnalytics(app);'
].join('\n');

const EXPECTED = {
    apiKey: 'AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE',
    authDomain: 'demo-app.firebaseapp.com',
    databaseURL: 'https://demo-app-default-rtdb.firebaseio.com',
    projectId: 'demo-app',
    storageBucket: 'demo-app.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
    measurementId: 'G-FAKE000000'
};

const apps = {};
APPS.forEach((app) => {
    apps[app] = loadApp(app);
});
const api = apps.ZoeW;

function expectThrow(name, raw, code) {
    let thrown = null;
    try {
        api.normalizeFirebaseConfig(raw);
    } catch (e) {
        thrown = e;
    }
    check(name, thrown !== null && thrown.message === code,
        thrown ? 'បាន ' + thrown.message : 'មិនបោះកំហុសទេ');
    return thrown;
}

equal('snippet ពិតរបស់ Firebase Console ➜ config ពេញ',
    api.normalizeFirebaseConfig(CONSOLE_SNIPPET).config, EXPECTED);

equal('`//` ក្នុង databaseURL មិនត្រូវកាត់ចោល',
    api.normalizeFirebaseConfig(CONSOLE_SNIPPET).config.databaseURL,
    'https://demo-app-default-rtdb.firebaseio.com');

equal('គ្មានវាលលើសពី snippet', api.normalizeFirebaseConfig(CONSOLE_SNIPPET).extras, []);

equal('JSON ធម្មតាដើរដដែល',
    api.normalizeFirebaseConfig(JSON.stringify(EXPECTED)).config, EXPECTED);

equal('single quote ដើរ',
    api.normalizeFirebaseConfig("{ apiKey: 'k', databaseURL: 'https://x.firebaseio.com' }").config,
    { apiKey: 'k', databaseURL: 'https://x.firebaseio.com' });

equal('comma ចុងក្រោយដើរ',
    api.normalizeFirebaseConfig('{ "apiKey": "k", "databaseURL": "https://x.firebaseio.com", }').config,
    { apiKey: 'k', databaseURL: 'https://x.firebaseio.com' });

equal('object តែឯងគ្មាន const ដើរ',
    api.normalizeFirebaseConfig('{\n  apiKey: "k",\n  databaseURL: "https://x.firebaseio.com"\n}').config,
    { apiKey: 'k', databaseURL: 'https://x.firebaseio.com' });

equal('`/* */` comment ត្រូវលុប',
    api.normalizeFirebaseConfig('/* setup */ const firebaseConfig = { apiKey: "k", /* note */ databaseURL: "https://x.firebaseio.com" };').config,
    { apiKey: 'k', databaseURL: 'https://x.firebaseio.com' });

equal('`}` ក្នុង string មិនបំបែកការរាប់វង់ក្រចក',
    api.normalizeFirebaseConfig('const firebaseConfig = { apiKey: "a}b", databaseURL: "https://x.firebaseio.com", projectId: "p" };').config,
    { apiKey: 'a}b', databaseURL: 'https://x.firebaseio.com', projectId: 'p' });

const withExtras = api.normalizeFirebaseConfig(
    '{ "apiKey": "k", "databaseURL": "https://x.firebaseio.com", "sentryDsn": "https://abc@o1.ingest.sentry.io/2", "vapidKey": "v" }');
equal('វាលដែលមិនមែនរបស់ Firebase ត្រូវទម្លាក់', withExtras.config,
    { apiKey: 'k', databaseURL: 'https://x.firebaseio.com' });
equal('វាលដែលទម្លាក់ត្រូវរាយប្រាប់', withExtras.extras.sort(), ['sentryDsn', 'vapidKey']);

equal('វាលទទេត្រូវរំលង',
    api.normalizeFirebaseConfig('{ "apiKey": "k", "databaseURL": "https://x.firebaseio.com", "measurementId": "" }').config,
    { apiKey: 'k', databaseURL: 'https://x.firebaseio.com' });

expectThrow('អត្ថបទទទេ ➜ EMPTY', '   ', 'EMPTY');
expectThrow('អត្ថបទដែលគ្មាន object ➜ NO_OBJECT', 'សួស្តី គ្មាន config ទេ', 'NO_OBJECT');
expectThrow('object ខូច ➜ BAD_SYNTAX', 'const firebaseConfig = { apiKey: "k" databaseURL: };', 'BAD_SYNTAX');

const missingDb = expectThrow('គ្មាន databaseURL ➜ MISSING',
    '{ "apiKey": "k", "projectId": "p" }', 'MISSING');
equal('រាយឈ្មោះវាលដែលខ្វះ', missingDb.missing, ['databaseURL']);
check('សារកំហុសប្រាប់ពី Realtime Database',
    api.firebaseConfigErrorMessage(missingDb).indexOf('Realtime Database') !== -1,
    api.firebaseConfigErrorMessage(missingDb));

const missingKey = expectThrow('គ្មាន apiKey ➜ MISSING',
    '{ "databaseURL": "https://x.firebaseio.com" }', 'MISSING');
equal('រាយ apiKey ថាខ្វះ', missingKey.missing, ['apiKey']);

check('សារ EMPTY ខុសពីសារ NO_OBJECT',
    api.firebaseConfigErrorMessage(new Error('EMPTY')) !== api.firebaseConfigErrorMessage(new Error('NO_OBJECT')));

const SAMPLES = [CONSOLE_SNIPPET, JSON.stringify(EXPECTED),
    "{ apiKey: 'k', databaseURL: 'https://x.firebaseio.com' }"];
SAMPLES.forEach((sample, index) => {
    const results = APPS.map((app) => JSON.stringify(apps[app].normalizeFirebaseConfig(sample)));
    check('App ទាំង ២ ឲ្យលទ្ធផលដូចគ្នា (sample ' + (index + 1) + ')',
        new Set(results).size === 1, results.join(' ≠ '));
});

console.log('firebase-config-paste-test: ' + (failures.length ? 'FAIL' : 'PASS') + '  (' + passed + ')');
if (failures.length) {
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
}
