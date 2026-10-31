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
check(!/SETUP_LINK_DSN_KEY|setupLinkDsnInput|setupLinkDsnIsValid/.test(keygenSrc) && !/setupLinkDsnInput/.test(keygenHtml),
    'ZoeKeyGen គ្មានវាល ឬកូនសោ DSN សម្រាប់ Setup Link (ការសម្រេចម្ចាស់ ៖ កំហុសទៅតែ APP_DSN)');
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

const APP_DSN_KEY = (fs.readFileSync(path.join(ROOT, 'ZoeW', 'error-reporting.js'), 'utf8').match(/const APP_DSN = 'https:\/\/([0-9a-f]{32})@/) || [])[1] || '';
check(/^[0-9a-f]{32}$/.test(APP_DSN_KEY), 'ជាន់អប្បបរមា ៖ error-reporting.js មាន APP_DSN', APP_DSN_KEY);
vm.runInContext('function encodeSetup(parsed) { let b64; b64 = ' + encLine + '; return b64; }', ctx);
vm.runInContext('function buildLink(baseUrl, b64) { let lastGeneratedSetupLink; lastGeneratedSetupLink = '
    + linkLine.replace(/\bb64\b/g, 'b64') + '; return lastGeneratedSetupLink; }', ctx);

const APPS = ['ZoeW'];
APPS.forEach((app) => {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    vm.runInContext(sliceFn(src, 'decodeSetupPayload').replace('function decodeSetupPayload', 'function decode_' + app), ctx);
    // ⛔ អានប៉ារ៉ាម៉ែត្រដូច App ពិត (`#setup=` មុន · `?setup=` ចាស់) ➜ មិនមែន `URLSearchParams` ដែលមើលមិនឃើញ fragment
    defineOrStub(src, 'setupParamFromText', 'param_' + app, "return new URL(a).searchParams.get('setup');");
});

const CONFIGS = [
    { name: 'ធម្មតា', cfg: { apiKey: 'AIzaSyABC-123_xyz', authDomain: 'shop-a.firebaseapp.com', databaseURL: 'https://shop-a-default-rtdb.firebaseio.com', projectId: 'shop-a', storageBucket: 'shop-a.appspot.com', messagingSenderId: '123456789012', appId: '1:123456789012:web:abc123' } },
    { name: 'មានអក្សរខ្មែរ', cfg: { apiKey: 'AIza-ខ្មែរ-key', databaseURL: 'https://ហាង-default-rtdb.firebaseio.com', projectId: 'ហាងលេខ១' } },
    { name: 'មាន + និង /', cfg: { apiKey: 'a+b/c=d++//', databaseURL: 'https://x-default-rtdb.firebaseio.com' } },
    { name: 'databaseURL asia', cfg: { apiKey: 'k', databaseURL: 'https://x-default-rtdb.asia-southeast1.firebasedatabase.app' } },
    { name: 'emoji ក្នុង projectId', cfg: { apiKey: 'k', databaseURL: 'https://y-default-rtdb.firebaseio.com', projectId: 'shop-🏬-1' } }
];

// ⛔ re-audit ៖ README របស់ ZoeKeyGen ពិពណ៌នាទម្រង់ Link ដែល builder ពិតបង្កើត (ឯកសារចាស់ ៖ `https://<app-site>/?setup=<config>` ខណៈ Link ពិតជា `#setup=`)
{
    const sample = ctx.buildLink('https://zoeadmin.netlify.app', vm.runInContext('encodeSetup(' + JSON.stringify(CONFIGS[0].cfg) + ')', ctx));
    const form = new URL(sample).hash.indexOf('#setup=') === 0 ? '#setup=' : '?setup=';
    const readme = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/README.md'), 'utf8');
    check(readme.indexOf('/' + form + '<') !== -1 && readme.indexOf('/' + (form === '#setup=' ? '?setup=' : '#setup=') + '<') === -1,
        'README ZoeKeyGen ពិពណ៌នា Link ជា `' + form + '` ដូច builder ពិត', form);
}

CONFIGS.forEach(({ name, cfg }) => {
    const b64 = vm.runInContext('encodeSetup(' + JSON.stringify(cfg) + ')', ctx);
    const link = ctx.buildLink('https://zoeadmin.netlify.app', b64);
    // ⛔ ទិន្នន័យ Config នៅក្នុង fragment (`#setup=`) ➜ មិនទៅដល់ log server · `Referer` · សំណើ Service Worker
    check(new URL(link).hash.indexOf('#setup=') === 0 && !new URL(link).searchParams.has('setup'),
        'Setup Link "' + name + '" ដាក់ទិន្នន័យក្នុង fragment មិនមែន query', link.slice(0, 80));
    APPS.forEach((app) => {
        let out = null, err = null;
        try { out = ctx['decode_' + app](ctx['param_' + app](link)); } catch (e) { err = e.message; }
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

// ── Link ចាស់ដែលមាន `dsn` ─────────────────────────────────────────────────
// ការសម្រេចម្ចាស់ ៖ កំហុសទៅតែ `APP_DSN` ➜ Setup Link គ្មាន DSN ➜ `dsn` ណាមួយក្នុង Link ចាស់ (សូម្បីគម្រោង App) ZoeW ទម្លាក់ពេល decode
//   Setup Link មកពីខាងក្រៅ ➜ DSN = ផ្លូវបញ្ជូនកំហុស (និងទិន្នន័យក្នុងកំហុស) ទៅ server របស់អ្នកវាយប្រហារ។
const BASE_CFG = { apiKey: 'AIzaSyABC', databaseURL: 'https://s-default-rtdb.firebaseio.com', projectId: 's' };
const OLD_DSNS = [
    ['DSN គម្រោង Sentry App', 'https://' + APP_DSN_KEY + '@o1.ingest.sentry.io/456'],
    ['DSN នៃគម្រោង Sentry ផ្សេង', 'https://abc123@o1.ingest.sentry.io/456'],
    ['host ក្រៅ Sentry', 'https://abc@evil.example.com/1'],
    ['អត្ថបទមិនមែន URL', 'not-a-url']
];
OLD_DSNS.forEach(([name, dsn]) => {
    const b64 = Buffer.from(JSON.stringify(Object.assign({}, BASE_CFG, { dsn: dsn })), 'utf8').toString('base64');
    const out = ctx.decode_ZoeW(b64);
    check(!!out && !('dsn' in out) && JSON.stringify(out) === JSON.stringify(BASE_CFG), 'Link ចាស់ ៖ ' + name + ' ➜ ZoeW ទម្លាក់ dsn · Config នៅដដែល', JSON.stringify(out));
});
const fresh = ctx.decode_ZoeW(vm.runInContext('encodeSetup(' + JSON.stringify(BASE_CFG) + ')', ctx));
check(JSON.stringify(fresh) === JSON.stringify(BASE_CFG), 'Link ថ្មីរបស់ ZoeKeyGen ៖ Config តែម្យ៉ាង (គ្មាន dsn)', JSON.stringify(fresh));

console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
process.exit(fail ? 1 : 0);
