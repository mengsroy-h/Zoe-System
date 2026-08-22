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
    escape, unescape, encodeURIComponent, decodeURIComponent, JSON, Error, URLSearchParams, URL, console
});

// encoder ពិតរបស់ ZoeKeyGen (បន្ទាត់ដដែលក្នុង generateSetupLink)
const keygenSrc = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/app.js'), 'utf8');
const genSrc = sliceFn(keygenSrc, 'generateSetupLink');
const encLine = (genSrc.match(/b64 = ([^;]+);/) || [])[1];
check(!!encLine, 'រកឃើញបន្ទាត់ encode ក្នុង generateSetupLink()', genSrc.slice(0, 120));
const linkLine = (genSrc.match(/lastGeneratedSetupLink = ([^;]+);/) || [])[1];
check(!!linkLine, 'រកឃើញបន្ទាត់សាង Link');

vm.runInContext('function encodeSetup(parsed) { let b64; b64 = ' + encLine + '; return b64; }', ctx);
vm.runInContext('function buildLink(baseUrl, b64) { let lastGeneratedSetupLink; lastGeneratedSetupLink = '
    + linkLine.replace(/\bb64\b/g, 'b64') + '; return lastGeneratedSetupLink; }', ctx);

const APPS = ['ZoeW'];
APPS.forEach((app) => {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    vm.runInContext(sliceFn(src, 'decodeSetupPayload').replace('function decodeSetupPayload', 'function decode_' + app), ctx);
});

const CONFIGS = [
    { name: 'ធម្មតា', cfg: { apiKey: 'AIzaSyABC-123_xyz', authDomain: 'shop-a.firebaseapp.com', databaseURL: 'https://shop-a-default-rtdb.firebaseio.com', projectId: 'shop-a', storageBucket: 'shop-a.appspot.com', messagingSenderId: '123456789012', appId: '1:123456789012:web:abc123' } },
    { name: 'មានអក្សរខ្មែរ', cfg: { apiKey: 'AIza-ខ្មែរ-key', databaseURL: 'https://ហាង-default-rtdb.firebaseio.com', projectId: 'ហាងលេខ១' } },
    { name: 'មាន + និង /', cfg: { apiKey: 'a+b/c=d++//', databaseURL: 'https://x-default-rtdb.firebaseio.com' } },
    { name: 'databaseURL asia', cfg: { apiKey: 'k', databaseURL: 'https://x-default-rtdb.asia-southeast1.firebasedatabase.app' } },
    { name: 'emoji ក្នុង projectId', cfg: { apiKey: 'k', databaseURL: 'https://y-default-rtdb.firebaseio.com', projectId: 'shop-🏬-1' } }
];

CONFIGS.forEach(({ name, cfg }) => {
    const b64 = vm.runInContext('encodeSetup(' + JSON.stringify(cfg) + ')', ctx);
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

console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
process.exit(fail ? 1 : 0);
