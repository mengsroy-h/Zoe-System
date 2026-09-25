// ⛔ ថ្នាក់កំហុស៖ `app.js` ហៅ `fb.<name>(...)` ដែល `firebase-loader.js`
// **មិនបាន export ចូល `window.firebaseSDK`** ➜ វា `undefined` លើផលិតកម្ម។
//
// 🔴 នេះជាកំហុសពិតដែលរស់នៅស្ងាត់ៗរហូតដល់ជុំ deep audit៖
//   `firebase-loader.js` នាំចូល `goOnline` **តែមិននាំចូល `goOffline` ទេ**។
//   `forceDatabaseReconnect()` សរសេរថា៖
//       if (canCycleDatabaseConnection() && typeof fb.goOffline === 'function')
//   ➜ លក្ខខណ្ឌនោះ **មិនពិតជានិច្ច** លើផលិតកម្ម ➜ វដ្ត goOffline()+goOnline()
//   ដែល CLAUDE.md ពិពណ៌នាយ៉ាងវែង និងដែល `connection-recovery-test.js`
//   ចាក់សោដោយ ៧៦ assertion **មិនដែលរត់សោះ**។ ផលចំពោះអ្នកប្រើ៖ ក្រោយ
//   បាត់ WiFi យូរ ចំណុចក្រហម «ក្រៅបណ្ដាញ» អាចនៅជាងមួយនាទី ខណៈបណ្តាញ
//   ត្រឡប់មកវិញហើយ — ជាការណ៍ដែលវដ្តនោះមានដើម្បីការពារ។
//
// **មូលហេតុដែលតេស្តមិនចាប់វា**៖ fake SDK ក្នុងតេស្តផ្តល់ `goOffline` ឲ្យ។
// នេះជាថ្នាក់ «តេស្តជាមួយ SDK ក្លែងក្លាយ ជោគជ័យក្លែងក្លាយ» ដដែលនឹងមេរៀន
// CDN ក្នុង CLAUDE.md។ ការការពារតែមួយគត់គឺ **ប្រៀបធៀបផ្ទៃ API ពិត**។
//
// `typeof fb.X === 'function'` ជា guard ដែល **លាក់** កំហុសនេះ — កូដមិន throw
// ទេ វាគ្រាន់តែ **ឈប់ធ្វើការស្ងាត់ៗ**។ ដូច្នេះឧបករណ៍នេះរាយវាជាកំហុស
// ដដែល មិនលើកលែងទេ។
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SDKSURFACE_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

let pass = 0, fail = 0;
const ok = (n, d) => { console.log('   ok    ' + n + (d ? '  ' + d : '')); pass++; };
const bad = (n, d) => { console.log('   FAIL  ' + n + (d ? '\n         ' + d : '')); fail++; };

// ឈ្មោះដែល `fb.X` សំដៅ តែមិនមែនជា export របស់ Firebase (property ផ្ទាល់ខ្លួន)
const NOT_SDK_EXPORTS = new Set([]);

for (const app of APPS) {
    console.log('\n=== ' + app + ' — `fb.X` ↔ `window.firebaseSDK` ===');
    const appFile = path.join(ROOT, app, 'app.js');
    const loaderFile = path.join(ROOT, app, 'firebase-loader.js');
    if (!fs.existsSync(appFile) || !fs.existsSync(loaderFile)) {
        bad(app + ' ៖ រកមិនឃើញ app.js ឬ firebase-loader.js');
        continue;
    }
    const appSrc = fs.readFileSync(appFile, 'utf8');
    const loaderSrc = fs.readFileSync(loaderFile, 'utf8');

    // ផ្ទៃដែល loader ប្រកាស៖ ប្លុក `window.firebaseSDK = { ... };`
    const decl = /window\.firebaseSDK\s*=\s*\{([\s\S]*?)\};/.exec(loaderSrc);
    if (!decl) { bad(app + ' ៖ រកមិនឃើញការប្រកាស window.firebaseSDK'); continue; }
    const exported = new Set(
        decl[1].split(',').map((s) => s.split(':')[0].trim()).filter((s) => /^[A-Za-z_$][\w$]*$/.test(s))
    );
    ok(app + ' ៖ loader export ' + exported.size + ' ឈ្មោះ');

    // ការនាំចូល ESM ពិត — ឈ្មោះដែល export តែមិនបាននាំចូល នឹងជា ReferenceError
    const imported = new Set();
    (loaderSrc.match(/import\s*\{([\s\S]*?)\}\s*from/g) || []).forEach((blk) => {
        const inner = /\{([\s\S]*?)\}/.exec(blk);
        if (!inner) return;
        inner[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop().trim())
            .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s)).forEach((n) => imported.add(n));
    });
    // ⛔ ZoeW (React) ៖ loader ជា script ធម្មតាដែលផ្ទុក SDK តាម `import()` ថាមវន្ត ➜ `name: xMod.name` ជំនួស
    //    `import { name } from` ។ «បាននាំចូល» = member ដែលអានពី **module ដែលភ្ជាប់ពី `import()` ពិត** ហើយឈ្មោះ key
    //    **ស្មើ** ឈ្មោះ member (key ≠ member ➜ ការប្រើ fn ខុស ដោយស្ងាត់ៗ)
    const dynamicMods = new Set();
    const dynImports = (loaderSrc.match(/import\(BASE \+ '[^']+'\)/g) || []).length;
    for (const m of loaderSrc.matchAll(/var (\w+) = mods\[(\d+)\];/g)) {
        if (Number(m[2]) < dynImports) dynamicMods.add(m[1]);
    }
    const mismatched = [];
    for (const m of decl[1].matchAll(/(\w+)\s*:\s*(\w+)\.(\w+)/g)) {
        if (!dynamicMods.has(m[2])) continue;
        if (m[1] === m[3]) imported.add(m[1]);
        else mismatched.push(m[1] + ' ➜ ' + m[2] + '.' + m[3]);
    }
    if (dynamicMods.size) {
        mismatched.length === 0
            ? ok(app + ' ៖ loader ថាមវន្ត ៖ key នីមួយៗអានពី member ឈ្មោះដដែលនៃ module `import()` (' + dynamicMods.size + ' module)')
            : bad(app + ' ៖ loader ថាមវន្ត ៖ key ≠ member (ការប្រើ function ខុសដោយស្ងាត់)', mismatched.join(', '));
    }
    const exportedNotImported = [...exported].filter((n) => !imported.has(n) && !NOT_SDK_EXPORTS.has(n));
    exportedNotImported.length === 0
        ? ok(app + ' ៖ គ្រប់ឈ្មោះដែល export ត្រូវបាននាំចូលពិត')
        : bad(app + ' ៖ export ឈ្មោះដែលមិនបាននាំចូល ➜ ReferenceError ពេលផ្ទុក',
            exportedNotImported.join(', '));

    // ការប្រើ `fb.X` ក្នុង app.js
    const used = new Map();
    const re = /\bfb\.([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = re.exec(appSrc))) {
        const line = appSrc.slice(0, m.index).split('\n').length;
        if (!used.has(m[1])) used.set(m[1], line);
    }
    ok(app + ' ៖ app.js ប្រើ `fb.X` ' + used.size + ' ឈ្មោះ');

    const missing = [...used.keys()].filter((n) => !exported.has(n));
    missing.length === 0
        ? ok(app + ' ៖ **គ្រប់ `fb.X` មានក្នុង window.firebaseSDK**')
        : bad(app + ' ៖ `fb.X` ដែល loader មិន export ➜ `undefined` លើផលិតកម្ម',
            missing.map((n) => 'fb.' + n + ' (app.js:' + used.get(n) + ')').join(', '));

    // ⛔ ការអះអាងខាងទីពីរ ៖ ឈ្មោះដែល export តែ **គ្មានអ្នកប្រើ** = ទម្ងន់លើស
    //    (សិទ្ធិតូចបំផុត — ច្បាប់ដដែលនឹង ACTION_ALLOWLIST)
    const unusedExports = [...exported].filter((n) => !used.has(n));
    unusedExports.length === 0
        ? ok(app + ' ៖ គ្មាន export ណាដែលគ្មានអ្នកប្រើ')
        : console.log('   note  ' + app + ' ៖ export ដែលមិនប្រើ ៖ ' + unusedExports.join(', '));
}

// === ការអះអាងជាក់លាក់៖ វដ្ត reset backoff ត្រូវរត់បានពិត ===
console.log('\n=== វដ្ត goOffline()+goOnline() ត្រូវអាចរត់លើផលិតកម្ម ===');
for (const app of APPS) {
    const appSrc = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const loaderSrc = fs.readFileSync(path.join(ROOT, app, 'firebase-loader.js'), 'utf8');
    if (!/fb\.goOffline/.test(appSrc)) { ok(app + ' ៖ មិនប្រើ goOffline'); continue; }
    /\bgoOffline\b/.test(loaderSrc)
        ? ok(app + ' ៖ `goOffline` នាំចូល និង export ➜ វដ្ត reset backoff រត់បានពិត')
        : bad(app + ' ៖ app.js ហៅ `fb.goOffline` តែ loader មិន export ➜ '
            + '**វដ្ត reset backoff មិនដែលរត់សោះ** ខណៈតេស្តជោគជ័យ (fake SDK ផ្តល់វាឲ្យ)');
}

console.log('\n' + (fail === 0 ? '✅ ជោគជ័យទាំងអស់ (' + pass + ')' : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
process.exit(fail === 0 ? 0 : 1);
