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

// ⛔ ZoeW ទទួល Config Supabase ផង ៖ `normalizeFirebaseConfig()` ហៅ helper ទាំងនេះ ➜ ស្រង់វាពេល function នោះយោងវា
const SUPABASE_FNS = ['looksLikeSupabaseConfig', 'normalizeSupabaseConfig', 'supabaseKeyIsSecret', 'supabaseUrlIsAllowed', 'jwtRole',
    'supabaseConfigErrorMessage'];

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
    const wanted = WANTED_FNS.concat(SUPABASE_FNS);
    walk(tree, (node) => {
        if (node.type === 'FunctionDeclaration' && node.id && wanted.indexOf(node.id.name) !== -1 && !found.has(node.id.name)) {
            pieces.push(src.slice(node.start, node.end));
            found.add(node.id.name);
        }
        if (node.type === 'VariableDeclarator' && node.id && (node.id.name === 'FIREBASE_CONFIG_KEYS' || node.id.name === 'SB_CONFIG_KEYS') && !found.has(node.id.name)) {
            pieces.push('const ' + node.id.name + ' = ' + src.slice(node.init.start, node.init.end) + ';');
            found.add(node.id.name);
        }
    });
    const usesSupabase = /looksLikeSupabaseConfig\(/.test(pieces.join('\n'));
    const required = WANTED_FNS.concat(['FIREBASE_CONFIG_KEYS']).concat(usesSupabase ? SUPABASE_FNS.concat(['SB_CONFIG_KEYS']) : []);
    const missing = required.filter((n) => !found.has(n));
    if (missing.length) throw new Error(app + ' ខ្វះ៖ ' + missing.join(', '));
    const sandbox = { JSON, String, Object, Array, Error, RegExp, URL, atob, console, __usesSupabase: usesSupabase };
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

// ── Config Supabase (ZoeW តែប៉ុណ្ណោះ ៖ backend អាជីវកម្មទី ២) ──
check('ZoeW ៖ normalizeFirebaseConfig() ស្គាល់ Config Supabase (helper ពិតត្រូវបានស្រង់)', apps.ZoeW.__usesSupabase === true);
if (apps.ZoeW.__usesSupabase) {
    const zw = apps.ZoeW;
    const PUB = 'sb_publishable_' + 'a'.repeat(30);
    equal('Supabase ៖ JSON ➜ supabaseUrl (គ្មាន / ចុង) · supabaseKey',
        zw.normalizeFirebaseConfig(JSON.stringify({ supabaseUrl: 'https://abc.supabase.co/', supabaseKey: PUB })).config,
        { supabaseUrl: 'https://abc.supabase.co', supabaseKey: PUB });
    equal('Supabase ៖ JSON ពី Setup Link (មាន loginDomain · អក្សរតូច)',
        zw.normalizeFirebaseConfig(JSON.stringify({ supabaseUrl: 'https://abc.supabase.co', supabaseKey: PUB, loginDomain: 'Users.Zoew.INVALID' }, null, 2)).config,
        { supabaseUrl: 'https://abc.supabase.co', supabaseKey: PUB, loginDomain: 'users.zoew.invalid' });
    const err = (raw) => { try { zw.normalizeFirebaseConfig(raw); return null; } catch (e) { return e; } };
    const secret = err(JSON.stringify({ supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'sb_secret_' + 'b'.repeat(30) }));
    check('Supabase ៖ Secret key ➜ SB_SECRET_KEY + សារប្រាប់ឲ្យ Rotate', !!secret && secret.message === 'SB_SECRET_KEY'
        && /Rotate/.test(zw.firebaseConfigErrorMessage(secret)), secret && secret.message);
    const badUrl = err(JSON.stringify({ supabaseUrl: 'http://abc.supabase.co', supabaseKey: PUB }));
    check('Supabase ៖ URL មិនមែន https ➜ SB_BAD_URL', !!badUrl && badUrl.message === 'SB_BAD_URL', badUrl && badUrl.message);
    const noKey = err(JSON.stringify({ supabaseUrl: 'https://abc.supabase.co' }));
    check('Supabase ៖ ខ្វះ supabaseKey ➜ សារជាក់លាក់ Supabase (មិនមែនសារ databaseURL)', !!noKey
        && /supabaseKey/.test(zw.firebaseConfigErrorMessage(noKey)) && !/databaseURL/.test(zw.firebaseConfigErrorMessage(noKey)));
    const badDomain = err(JSON.stringify({ supabaseUrl: 'https://abc.supabase.co', supabaseKey: PUB, loginDomain: 'gmail.com' }));
    check('Supabase ៖ loginDomain មិនបញ្ចប់ .invalid ➜ SB_BAD_DOMAIN', !!badDomain && badDomain.message === 'SB_BAD_DOMAIN');
    const fbFallback = zw.normalizeFirebaseConfig(JSON.stringify(EXPECTED));
    equal('ទិសផ្ទុយ ៖ Config Firebase នៅតែឆ្លងផ្លូវ Firebase ដដែល', fbFallback.config, EXPECTED);
}

console.log('firebase-config-paste-test: ' + (failures.length ? 'FAIL' : 'PASS') + '  (' + passed + ')');
if (failures.length) {
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
}
