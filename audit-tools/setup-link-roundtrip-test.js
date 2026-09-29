// កិច្ចសន្យាឆ្លង App៖ ZoeKeyGen encode ➜ ZoeW decode
// ដកកូដ *ពិត* ចេញពី app.js មករត់ក្នុង vm ជាមួយគ្នា។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.SETUPRT_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (n) => { console.log('  ok    ' + n); pass++; };
const bad = (n, d) => { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; };
const check = (c, n, d) => (c ? ok(n) : bad(n, d));

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) throw new Error('រកមិនឃើញ ' + name);
    let i = src.indexOf('{', start), depth = 0, inStr = null, prev = '';
    for (; i < src.length; i++) {
        const c = src[i];
        if (inStr) {
            if (c === inStr && prev !== '\\') inStr = null;
        } else if (c === '"' || c === "'" || c === '`') inStr = c;
        else if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
        prev = prev === '\\' ? '' : c;
    }
    throw new Error('មិនអាចកាត់ ' + name);
}

const ctx = vm.createContext({
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    escape, unescape, encodeURIComponent, decodeURIComponent, JSON, Error, Object, URLSearchParams, URL, console
});

// encoder ពិតរបស់ ZoeKeyGen (បន្ទាត់ដដែលក្នុង generateSetupLink)
const keygenSrc = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/app.js'), 'utf8');
const keygenHtml = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/index.html'), 'utf8');
const genSrc = sliceFn(keygenSrc, 'generateSetupLink');
const encLine = (genSrc.match(/b64 = ([^;]+);/) || [])[1];
check(!!encLine, 'រកឃើញបន្ទាត់ encode ក្នុង generateSetupLink()', genSrc.slice(0, 120));
check(genSrc.indexOf('setupLinkAppSelect') === -1,
    'generateSetupLink() មិនអាស្រ័យលើប្រអប់ជ្រើសរើស App ទៀតទេ (App មានតែ ZoeW)');
// ⛔ កូនសោ Setup Link ចងនឹងកូដ App ➜ ការឃ្លាតធ្វើឲ្យតម្លៃដែលអ្នកលក់
//    រក្សាទុក បាត់ស្ងាត់ៗ។ ការវាស់ត្រូវ **ដេរីវេ** មិនមែនចាក់ជា literal។
//    (ការស៊ីគ្នារវាង ZoeW និង ZoeKeyGen ជារបស់ `license-app-code-test`។)
const keygenAppCode = (keygenSrc.match(/const LICENSE_APP_CODE = '([A-Z]{2,8})';/) || [])[1];
check(!!keygenAppCode, 'រកឃើញ LICENSE_APP_CODE ក្នុង ZoeKeyGen/app.js', keygenAppCode);
check(!!keygenAppCode && keygenSrc.indexOf("const SETUP_LINK_URL_KEY = 'zoekeygen_setup_url_" + keygenAppCode + "';") !== -1,
    'កូនសោ Setup Link ចងនឹងកូដ App ដដែល', keygenAppCode);
check(!!keygenAppCode && keygenSrc.indexOf("const SETUP_LINK_DSN_KEY = 'zoekeygen_setup_dsn_" + keygenAppCode + "';") !== -1,
    'កូនសោ DSN ចងនឹងកូដ App ដដែល', keygenAppCode);
// ⛔ វាស់ **ប្រអប់ជ្រើសរើស App** មិនមែនគ្រប់ `<select>` ៖ ប្រអប់ផ្សេង (ឧ. ប្រភេទដំណឹង) ត្រូវអនុញ្ញាត ➜ ប្រអប់ដែល id
//    និយាយពី App ឬមាន option ជាកូដ App (អក្សរធំ ២–៨ តួ ដូច `LICENSE_APP_CODE`) ទើបរាប់។
const appSelectsIn = (html) => [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].filter((m) =>
    /id="[^"]*App[^"]*"/i.test(m[1]) || /<option value="[A-Z]{2,8}"/.test(m[2]));
const appSelects = appSelectsIn(keygenHtml);
check(appSelects.length === 0 && keygenHtml.indexOf('setupLinkAppSelect') === -1,
    'index.html របស់ ZoeKeyGen គ្មានប្រអប់ជ្រើសរើស App ទៀតទេ', appSelects.map((m) => m[1]));
check(appSelectsIn('<select id="setupLinkAppSelect"><option value="ZOE">ZoeW</option></select>').length === 1
    && appSelectsIn('<select id="x"><option value="ZOE">ZoeW</option></select>').length === 1
    && appSelectsIn('<select id="noticeKindInput"><option value="notice">a</option></select>').length === 0,
    'ទិសផ្ទុយ ៖ ការស្កេនចាប់ប្រអប់ជ្រើសរើស App គំរូ · មិនចាប់ប្រអប់ផ្សេង');
const linkLine = (genSrc.match(/lastGeneratedSetupLink = ([^;]+);/) || [])[1];
check(!!linkLine, 'រកឃើញបន្ទាត់សាង Link');

// ⛔ រកមិនឃើញ ➜ **ការធ្លាក់ដែលមានឈ្មោះ + stub** មិនមែន crash។
// crash នៅត្រង់នេះបិទបាំងការអះអាងទាំងអស់ខាងក្រោម ➜ tree មុនកែរាយ
// «0 ok, 1 FAIL» ជំនួសបញ្ជីនៃអ្វីដែលពិតជាខ្វះ។
function defineOrStub(src, name, alias, stubBody) {
    let body;
    try {
        body = sliceFn(src, name);
    } catch (e) {
        bad('រកឃើញ ' + name + '() ក្នុងកូដ ship', e.message);
        vm.runInContext('function ' + alias + '(a, b) { ' + stubBody + ' }', ctx);
        return false;
    }
    ok('រកឃើញ ' + name + '() ក្នុងកូដ ship');
    vm.runInContext(body.replace('function ' + name, 'function ' + alias), ctx);
    return true;
}

defineOrStub(keygenSrc, 'setupLinkDsnIsValid', 'setupLinkDsnIsValid', 'return false;');
defineOrStub(keygenSrc, 'buildSetupPayload', 'buildSetupPayload', 'return a;');
vm.runInContext('function encodeSetup(parsed, dsn) { let b64; b64 = ' + encLine + '; return b64; }', ctx);
vm.runInContext('function buildLink(baseUrl, b64) { let lastGeneratedSetupLink; lastGeneratedSetupLink = '
    + linkLine.replace(/\bb64\b/g, 'b64') + '; return lastGeneratedSetupLink; }', ctx);

const APPS = ['ZoeW'];
APPS.forEach((app) => {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    vm.runInContext(sliceFn(src, 'decodeSetupPayload').replace('function decodeSetupPayload', 'function decode_' + app), ctx);
    defineOrStub(src, 'setupLinkDsnIsValid', 'dsnValid_' + app, 'return false;');
});

const CONFIGS = [
    { name: 'ធម្មតា', cfg: { apiKey: 'AIzaSyABC-123_xyz', authDomain: 'shop-a.firebaseapp.com', databaseURL: 'https://shop-a-default-rtdb.firebaseio.com', projectId: 'shop-a', storageBucket: 'shop-a.appspot.com', messagingSenderId: '123456789012', appId: '1:123456789012:web:abc123' } },
    { name: 'មានអក្សរខ្មែរ', cfg: { apiKey: 'AIza-ខ្មែរ-key', databaseURL: 'https://ហាង-default-rtdb.firebaseio.com', projectId: 'ហាងលេខ១' } },
    { name: 'មាន + និង /', cfg: { apiKey: 'a+b/c=d++//', databaseURL: 'https://x-default-rtdb.firebaseio.com' } },
    { name: 'databaseURL asia', cfg: { apiKey: 'k', databaseURL: 'https://x-default-rtdb.asia-southeast1.firebasedatabase.app' } },
    { name: 'emoji ក្នុង projectId', cfg: { apiKey: 'k', databaseURL: 'https://y-default-rtdb.firebaseio.com', projectId: 'shop-🏬-1' } }
];

CONFIGS.forEach(({ name, cfg }) => {
    const b64 = vm.runInContext('encodeSetup(' + JSON.stringify(cfg) + ", '')", ctx);
    const link = ctx.buildLink('https://zoeadmin.netlify.app', b64);
    // អ្វីដែល browser ពិតឲ្យ App ទទួល
    const param = new URL(link).searchParams.get('setup');
    APPS.forEach((app) => {
        let out = null, err = null;
        try { out = ctx['decode_' + app](param); } catch (e) { err = e.message; }
        check(out && JSON.stringify(out) === JSON.stringify(cfg),
            app + ' អាន Setup Link "' + name + '" បានត្រឹមត្រូវ',
            err || JSON.stringify(out));
    });
});

// Config ដែលខ្វះវាលចាំបាច់ ត្រូវតែបដិសេធ មិនមែនទទួលយកស្ងាត់
const badB64 = vm.runInContext('encodeSetup(' + JSON.stringify({ projectId: 'no-keys' }) + ')', ctx);
APPS.forEach((app) => {
    let threw = false;
    try { ctx['decode_' + app](badB64); } catch (e) { threw = true; }
    check(threw, app + ' បដិសេធ Config ដែលខ្វះ apiKey/databaseURL');
});

// អក្សរដែលមិនមែន base64 ត្រូវតែបោះកំហុស មិនមែន crash ស្ងាត់
APPS.forEach((app) => {
    let threw = false;
    try { ctx['decode_' + app]('!!!not-base64!!!'); } catch (e) { threw = true; }
    check(threw, app + ' បដិសេធអក្សរដែលមិនមែន Setup Link');
});

// ── Sentry DSN ក្នុង Setup Link ─────────────────────────────────────────
// អ្នកលក់ដាក់ DSN ម្តង ➜ ឧបករណ៍អតិថិជនរាយការណ៍កំហុសមកវិញដោយស្វ័យប្រវត្តិ។
// បើគ្មានជាន់នេះ `getDsn()` ត្រឡប់ '' ➜ `detachSentry()` ➜ **ងងឹតទាំងស្រុង**។
const BASE_CFG = { apiKey: 'AIzaSyABC', databaseURL: 'https://s-default-rtdb.firebaseio.com', projectId: 's' };
const GOOD_DSN = 'https://abc123@o1.ingest.sentry.io/456';

const withDsn = vm.runInContext('encodeSetup(' + JSON.stringify(BASE_CFG) + ', ' + JSON.stringify(GOOD_DSN) + ')', ctx);
const decodedWithDsn = ctx.decode_ZoeW(withDsn);
check(decodedWithDsn.dsn === GOOD_DSN, 'DSN ត្រឹមត្រូវ ឆ្លងកាត់ Setup Link ដល់ ZoeW', JSON.stringify(decodedWithDsn));
check(decodedWithDsn.apiKey === BASE_CFG.apiKey && decodedWithDsn.databaseURL === BASE_CFG.databaseURL,
    'ការបន្ថែម DSN មិនប៉ះវាល Firebase ណាមួយ');

// ⛔ ទិសផ្ទុយ ៖ DSN ដែលមិនមែនរបស់ Sentry មិនត្រូវចូល payload សោះ។
// Setup Link មកពីខាងក្រៅ ➜ DSN ណាមួយក៏បាន = ផ្លូវបញ្ជូនកំហុស (និងទិន្នន័យ
// ក្នុងកំហុស) ទៅ server របស់អ្នកវាយប្រហារ។ CSP connect-src ជាជាន់ទី ២។
const BAD_DSNS = [
    ['http មិនមែន https', 'http://abc@o1.ingest.sentry.io/1'],
    ['host ក្រៅ Sentry', 'https://abc@evil.example.com/1'],
    ['host ដែលមើលទៅស្រដៀង', 'https://abc@evil-sentry.io/1'],
    ['sentry.io ជា prefix នៃ host ផ្សេង', 'https://abc@sentry.io.evil.com/1'],
    ['អត្ថបទមិនមែន URL', 'not-a-url'],
    ['ទទេ', '']
];
BAD_DSNS.forEach(([name, dsn]) => {
    const b64 = vm.runInContext('encodeSetup(' + JSON.stringify(BASE_CFG) + ', ' + JSON.stringify(dsn) + ')', ctx);
    const out = ctx.decode_ZoeW(b64);
    check(!('dsn' in out), 'DSN បដិសេធ ៖ ' + name + ' ➜ មិនចូល payload', JSON.stringify(out));
});

// អ្នកសម្រេច ២ ខាងត្រូវនិយាយរឿងដដែល — បើអត់ ZoeKeyGen បញ្ជូន DSN ដែល
// ZoeW បោះចោលស្ងាត់ៗ (អ្នកលក់ជឿថាបើករួច ខណៈវាងងឹត)។
const DSN_TABLE = [GOOD_DSN, 'https://k@o2.ingest.us.sentry.io/9', 'https://k@o3.ingest.de.sentry.io/9',
    'https://k@sentry.io/9'].concat(BAD_DSNS.map((r) => r[1]));
let agree = 0;
DSN_TABLE.forEach((dsn) => {
    if (ctx.setupLinkDsnIsValid(dsn) === ctx.dsnValid_ZoeW(dsn)) agree++;
});
check(agree === DSN_TABLE.length,
    'ZoeKeyGen និង ZoeW សម្រេចលើ DSN ដូចគ្នាទាំង ' + DSN_TABLE.length + ' ករណី', 'ស៊ីគ្នា ' + agree);
check(ctx.dsnValid_ZoeW(GOOD_DSN) === true && ctx.dsnValid_ZoeW('https://abc@evil.example.com/1') === false,
    'ជាន់អប្បបរមា ៖ អ្នកសម្រេច DSN ពិតជាបែងចែក (មិនមែនត្រឡប់ថេរ)');

console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
process.exit(fail ? 1 : 0);
