// ថ្នាក់កំហុសដែលឯកសារនេះចាក់សោ — **ការចាក់សោ App ពេលបើក** (កំណែ 2.22.0)។
//
// សំណើអ្នកប្រើ ៖ «ដាក់ PIN ឬស្កេនម្រាមដៃ/មុខ រាល់ពេលបើក app ZoeW តែរក្សា
// ការចងចាំ session login ៤ ម៉ោងដដែល»។ ការចាក់សោនោះជា **ស្រទាប់ចូលប្រើ**
// មិនមែនស្រទាប់ authentication ទេ — វាមិនប៉ះ Firebase session ឡើយ។
//
// ថ្នាក់កំហុស ៥ ដែលវាបិទ៖
//
// ១. **ការចាក់សោដែលងាប់** — សោដែលមិនចាក់ ជាការការពារដែលមើលទៅដូចមាន។
//    ដូច្នេះការអះអាងមាន **២ ខាង** ជានិច្ច ៖ «ចាក់សោពេលត្រូវចាក់» **និង**
//    «មិនចាក់ពេលមិនត្រូវចាក់» (គ្មាន PIN ➜ App ដើរដូចមុនបេះបិទ)។
//
// ២. **ទិន្នន័យលេចពីក្រោយសោ** — ការបង្ហាញប្រអប់ពីលើ App ដែលនៅមើលឃើញ
//    មិនមែនជាការចាក់សោទេ។ តេស្តវាស់ `visibility` ពិតរបស់ `#appPages`
//    `.app-navbar` និង `.page-tabbar` ក្នុង browser ពិត។
//
// ៣. ⛔ **ការចាក់សោដែលបំផ្លាញលំហូរការងារ** — `location.reload()` កើតឡើង
//    ពិតក្នុង App នេះ ៖ **PTR (ទាញចុះដើម្បី Refresh)** និង
//    `reloadForFirebaseSdk()`។ បើសោចាក់រាល់ការផ្ទុកទំព័រ នោះ **រាល់ការ
//    ទាញចុះ** ត្រូវវាយ PIN ➜ មុខងារនោះក្លាយជាទោស។ ដូច្នេះទង់ដោះសោរស់នៅ
//    ក្នុង `sessionStorage` ➜ ការផ្ទុកឡើងវិញ **ក្នុងវគ្គដដែល** មិនចាក់សោ
//    ចំណែកការបិទ App រួចបើកវិញ (វគ្គថ្មី) ចាក់សោ។ តេស្តវាស់ **ទាំង ២ ខាង**។
//
// ៤. **session ៤ ម៉ោងត្រូវនៅដដែល** — ការចាក់សោមិនត្រូវប៉ះ
//    `zoew_login_time` · `remembered_email` ឬហៅ `fb.signOut` ឡើយ។
//
// ៥. **ការជាប់សោត្រូវពិត** — ៥ ដងខុស ➜ ១ នាទី ហើយ **PIN ត្រឹមត្រូវក៏ត្រូវ
//    បដិសេធដែរ** ក្នុងអំឡុងនោះ។ សោដែលរាប់ខុសមិនមែនជាសោទេ។
//
// ៦. ⛔ **សោដែលចាក់តែពេល «បើក App ថ្មី»** (កំណែ 2.22.1) — របាយការណ៍ពិតពី
//    អ្នកប្រើ ៖ *«ចេញពី app តែអត់ទាន់ clear task ចូល app វិញ អត់លោតអោយវាយ
//    pin ទៀតសោះ»*។ ការចាកចេញទៅ App ផ្សេងមិនបំផ្លាញវគ្គទេ ➜ ទង់ក្នុង
//    `sessionStorage` នៅដដែល ➜ សោមិនដែលចាក់វិញ។ ដូច្នេះឥឡូវការចាក់សោ
//    កើតឡើងតាម **ព្រឹត្តិការណ៍ `visibilitychange`** ដែរ។
//
//    ⛔ **តែថ្នាក់កំហុស ៣ ខាងលើមិនត្រូវបើកឡើងវិញឡើយ** — ការចាក់សោនោះ
//    ត្រូវរស់ជាមួយការពិត ៣ ៖
//    ក. **PTR និង `reloadForFirebaseSdk()` បាញ់ `hidden` មុន unload** ➜ ការ
//       លុបទង់វគ្គត្រង់នោះនឹងធ្វើឲ្យ **រាល់ការទាញចុះត្រូវវាយ PIN**។ ដូច្នេះ
//       ការបាំង (veil) ពេល `hidden` **មិនប៉ះទង់វគ្គ**; ការលុបទង់កើតឡើងតែ
//       ពេល **ត្រឡប់មកវិញពិត** (`visible`)។ តេស្តវាស់ **ទាំង ២ ខាង**។
//    ខ. **ប៊ូតុង «📞 ខល» ជា `<a href="tel:">`** ➜ រាល់ការខល **ចាកចេញពី App**។
//       សោដែលចាក់ក្រោយការខល = លំហូរការងារស្លាប់។ ដូច្នេះសកម្មភាពដែលនាំ
//       អ្នកប្រើចេញ **ដោយចេតនា** (ខល · រើសឯកសារ · ស្កេនជីវមាត្រ · Print)
//       ត្រូវលើកលែង **តែជុំនោះមួយ** — ការចាកចេញលើកក្រោយចាក់សោដដែល។
//    គ. **ការបាំងត្រូវកើតពេល `hidden` មិនមែនពេល `visible`** — បើមិនដូច្នេះ
//       រូបភាពក្នុង **task switcher** នៃទូរស័ព្ទបង្ហាញលេខអតិថិជនទាំងស្រុង។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');

const CHROME = process.env.APPLOCK_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = process.env.APPLOCK_APP_DIR ? path.resolve(process.env.APPLOCK_APP_DIR) : path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('   ok    ' + label); }
function bad(label, detail) {
    fail++;
    console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}
function check(cond, label, detail) { cond ? ok(label) : bad(label, detail); }

function readOr(file, label) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        bad('អានឯកសារ ' + label + ' បាន', String(e.message));
        return '';
    }
}

function matchBrace(src, from, open, close) {
    let depth = 0, i = from, quote = '';
    for (; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === '\\') { i++; continue; }
            if (c === quote) quote = '';
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === open) depth++;
        else if (c === close) { depth--; if (depth === 0) return i; }
    }
    return -1;
}

function sliceFn(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    const end = matchBrace(src, src.indexOf('{', src.indexOf(')', start)), '{', '}');
    if (end === -1) return '';
    return src.slice(start, end + 1);
}

// ⛔ ការអះអាងអំពី **ស្នាមភ្ជាប់** ត្រូវ *ដេរីវេ* មិនមែនចាក់ឈ្មោះ helper ជា
// literal ទី ២ (ច្បាប់ «ការអះអាងលើឯកសារត្រូវវាស់ *ការពិត* មិនមែន *ការជ្រើស
// ពាក្យ*»)។ helper ខាងក្រោមដើរខ្សែសង្វាក់ការហៅពិត ចេញពី function មួយ រួច
// ប្រមូល **កូនសោ storage** ដែលខ្សែសង្វាក់នោះប៉ះ — ទាំងជា string literal
// ទាំងជាឈ្មោះថេរដែលដោះតម្លៃចេញពីកូដពិត។
function constValue(src, name) {
    const m = new RegExp('const\\s+' + name + "\\s*=\\s*'([^']*)'").exec(src);
    return m ? m[1] : '';
}

function chainNames(src, body) {
    const out = [];
    const re = /\b([A-Za-z_$][\w$]*)\b/g;
    let m;
    while ((m = re.exec(body))) {
        if (out.indexOf(m[1]) === -1 && sliceFn(src, m[1]) !== '') out.push(m[1]);
    }
    return out;
}

function chainKeys(src, body, depth) {
    const keys = [];
    const seen = {};
    const walk = (b, d) => {
        if (!b || d < 0) return;
        (b.match(/'(zoew[a-z0-9_]*)'/g) || []).forEach((t) => {
            const k = t.slice(1, -1);
            if (keys.indexOf(k) === -1) keys.push(k);
        });
        (b.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) || []).forEach((n) => {
            const v = constValue(src, n);
            if (v && v.indexOf('zoew') === 0 && keys.indexOf(v) === -1) keys.push(v);
        });
        chainNames(src, b).forEach((n) => {
            if (seen[n]) return;
            seen[n] = true;
            walk(sliceFn(src, n), d - 1);
        });
    };
    walk(body, depth);
    return keys;
}

const appJs = readOr(path.join(APP, 'app.js'), 'ZoeW/app.js');
const html = readOr(path.join(APP, 'index.html'), 'ZoeW/index.html');
const css = readOr(path.join(APP, 'style.css'), 'ZoeW/style.css');

console.log('\n=== ១. រចនាសម្ព័ន្ធ ៖ សោត្រូវចាក់ពិត និងដោះបានពិត ===');

check(html.indexOf('id="appLockScreen"') !== -1, 'index.html មានអេក្រង់ចាក់សោ');
check(/data-act="submitAppLockForm"/.test(html), 'ទម្រង់ដោះសោភ្ជាប់ទៅ submitAppLockForm (Enter ដំណើរការ)');
check(/data-act="runAppLockBiometric"/.test(html), 'មានប៊ូតុងស្កេនក្រយៅដៃ/មុខលើអេក្រង់ចាក់សោ');
// ⛔ វាល PIN មិនត្រូវប្រកាសខ្លួនជា `current-password` ទេ ៖
//   ក. password manager ស្នើរក្សា PIN ➜ PIN ចេញពី vault ដែល sync ឆ្លងឧបករណ៍
//      ➜ សោ«ឧបករណ៍»លែងជាកត្តាដាច់ដោយឡែក ហើយ PIN នោះជាកូនសោដែល derive
//      `lookupSecretKey` និង `zoew_sheet_import_config` (AES ពិត)។
//   ខ. browser autofill **ពាក្យសម្ងាត់គណនី** ចូលវាល PIN ➜ ខុស ៥ ដង
//      ➜ ជាប់សោ ១ នាទី ដោយអ្នកប្រើមិនបានធ្វើអ្វីខុសសោះ។
// វាល PIN ដទៃទាំង ២ (`securityPinInput` · `newSecurityPinInput`) ប្រើ
// `autocomplete="off"` រួចហើយ — វាលនេះត្រូវស៊ីគ្នា។
const pinInputs = (html.match(/<input[^>]*id="(appLockPinInput|securityPinInput|newSecurityPinInput)"[^>]*>/g) || []);
check(pinInputs.length === 3, 'រកឃើញវាល PIN ទាំង ៣ ក្នុង index.html', pinInputs.length);
check(pinInputs.every((t) => /autocomplete="off"/.test(t)),
    '⛔ គ្រប់វាល PIN ប្រកាស `autocomplete="off"` (កុំឲ្យ password manager យក PIN)',
    pinInputs.filter((t) => !/autocomplete="off"/.test(t)).join(' | '));
check(/data-act="forgetAppLockPin"/.test(html), 'មានផ្លូវចេញ «ភ្លេច PIN?» — សោមិនត្រូវក្លាយជាអន្ទាក់');

const initFn = sliceFn(appJs, 'initAppLock');
check(initFn !== '', 'មាន initAppLock() ក្នុង app.js');
// ⛔ ZoeW React ហៅវាតាម `oncePerPage('app-lock', initAppLock)` ក្នុងដំណាក់ boot
//    ដំបូង (មុន `load` ➜ មុន Firebase) ➜ ទម្រង់ទាំង ២ ជាការហៅ top level ដដែល។
check(/^\s{4}(initAppLock\(\)|oncePerPage\(['"]app-lock['"], initAppLock\));\s*$/m.test(appJs),
    'initAppLock() ត្រូវហៅនៅ top level (មុន Firebase និងមុនការគូរទិន្នន័យ)');

const armFn = sliceFn(appJs, 'appLockShouldArm');
// ⛔ ដេរីវេ ៖ ច្រកទ្វារត្រូវទាមទារ (ក) វគ្គមិនទាន់ដោះសោ និង (ខ) PIN ដែល
// មានពិត — តាមខ្សែសង្វាក់ការហៅ មិនមែនតាមអក្សរពិតនៃលក្ខខណ្ឌ (ការបញ្ចូល
// ច្រកទ្វារទី ៣ ដោយ **ត្រឹមត្រូវ** មិនត្រូវធ្វើឲ្យអ្នកយាមធ្លាក់)។
check(/!appLockUnlockedThisSession\(\)/.test(armFn),
    'សោចាក់តែពេល **មិនទាន់ដោះក្នុងវគ្គនេះ**', armFn);
check(chainKeys(appJs, armFn, 4).indexOf('zoew_security_pin_hash') !== -1,
    'សោចាក់តែពេល **មាន PIN** (ដេរីវេតាមខ្សែសង្វាក់ការហៅ)', chainKeys(appJs, armFn, 4));

const sessionFn = sliceFn(appJs, 'appLockUnlockedThisSession');
// ⛔ កំណែ 2.22.5 ៖ storage ចូលប្រើតាម shim `appSessionStore` (getter ខ្លួនវា
// បោះពេល browser បិទ site data) ➜ លំនាំត្រូវទទួល **ទាំង ២** ឈ្មោះ។
// ⚠️ អ្វីដែលការអះអាងនេះការពារពិតគឺ **`sessionStorage` ធៀបនឹង `localStorage`**
// (វគ្គ ធៀបនឹងអចិន្ត្រៃយ៍) — មិនមែនផ្លូវចូលប្រើទេ។
check(/(?:appSessionStore|sessionStorage)[^)]*APP_LOCK_SESSION_KEY/.test(sessionFn)
        && !/appLocalStore|localStorage/.test(sessionFn),
    '⛔ ទង់ដោះសោរស់នៅ sessionStorage (ការផ្ទុកឡើងវិញ ➜ មិនចាក់សោ; បិទបើក App ➜ ចាក់សោ)', sessionFn);

const logoutFn = sliceFn(appJs, 'logoutApp');
check(/clearAppUnlockedForSession\(\)/.test(logoutFn),
    'ចាកចេញ ➜ លុបទង់ដោះសោ (ការចូលបន្ទាប់ត្រូវឆ្លងសោម្តងទៀត)', logoutFn);

const focusFn = sliceFn(appJs, 'safeFocusScanner');
check(/if \(appIsLocked\) return;/.test(focusFn),
    '⛔ ខណៈចាក់សោ ➜ ម៉ាស៊ីនស្កេន hardware មិនដណ្តើមយក focus ពីប្រអប់ PIN', focusFn);

check(/function pullTargetBlocked\(target\) \{\s*\n\s*if \(appIsLocked \|\|/.test(appJs),
    '⛔ ខណៈចាក់សោ ➜ PTR មិនកេះ (កុំឲ្យទាញចុះក្រោមសោ)');

const awayFn = sliceFn(appJs, 'noteAppLockAway');
const backFn = sliceFn(appJs, 'relockAppAfterAway');
const guardFn = sliceFn(appJs, 'setupAppLockAwayGuard');
const showFn = sliceFn(appJs, 'showAppLockScreen');
const excuseFn = sliceFn(appJs, 'noteAppLockExcuse');

check(awayFn !== '' && backFn !== '' && guardFn !== '',
    'មានផ្លូវចាក់សោពេលចាកចេញ/ត្រឡប់មក (noteAppLockAway · relockAppAfterAway · setupAppLockAwayGuard)');
check(/visibilitychange/.test(guardFn),
    'ការចាកចេញត្រូវរកឃើញតាម `visibilitychange`', guardFn);
check(!/addEventListener\('(blur|focus|pagehide)'/.test(guardFn),
    "⛔ **មិនប្រើ `blur`/`focus`** — ពួកវាបាញ់ពេលបើកប្រអប់ native ➜ សោក្លែងក្លាយ", guardFn);
check(/setupAppLockAwayGuard\(\)/.test(initFn),
    'ការចុះឈ្មោះកើតឡើងក្នុង initAppLock() ➜ ដំណើរការទោះគ្មាន PIN (ការកំណត់ PIN ពាក់កណ្តាលវគ្គក៏គ្រប)', initFn);

check(/elapsedSince\(appLockExcuseAt\)/.test(awayFn),
    '⛔ បង្អួចលើកលែងវាស់តាម `elapsedSince()` ➜ នាឡិកាថយក្រោយ ➜ Infinity ➜ **ចាក់សោ** (fail-safe)', awayFn);
check(/showAppLockScreen\(true\)/.test(awayFn),
    '⛔ ការបាំងពេល `hidden` ត្រូវ **រក្សាទង់វគ្គ** (បើអត់ ➜ PTR reload ត្រូវវាយ PIN)', awayFn);
check(chainKeys(appJs, awayFn, 4).indexOf('zoew_security_pin_hash') !== -1,
    'គ្មាន PIN ➜ មិនបាំង (ទិសផ្ទុយ — App ដើរដូចមុន)', chainKeys(appJs, awayFn, 4));
check(/showAppLockScreen\(\)/.test(backFn) && !/showAppLockScreen\(true\)/.test(backFn),
    '⛔ ការត្រឡប់មកវិញទើបចាក់សោពិត (លុបទង់វគ្គ ➜ Refresh មិនមែនផ្លូវរំលង)', backFn);
check(/keepSessionFlag !== true\) clearAppUnlockedForSession\(\)/.test(showFn),
    'ការលុបទង់វគ្គជាជម្រើសដែលអ្នកហៅសម្រេច មិនមែនផលរំលងទេ', showFn);
check(/blur\(\)/.test(showFn) && /appLockPinInput/.test(showFn),
    '⛔ ការចាក់សោដក focus ពី App ➜ barcode របស់ម៉ាស៊ីនស្កេនមិនធ្លាក់ចូលវាល App ក្រោមសោ', showFn);

check(/appLockExcuseAt = Date\.now\(\)/.test(excuseFn), 'noteAppLockExcuse() ដាក់ត្រាពេល', excuseFn);
const callFn = sliceFn(appJs, 'handleCallAction');
check(/noteAppLockExcuse\(\)/.test(callFn),
    '⛔ «📞 ខល» (`<a href="tel:">`) ត្រូវលើកលែង — បើអត់ ➜ **រាល់ការខលត្រូវវាយ PIN**', callFn);
check(/noteAppLockExcuse\(\)/.test(sliceFn(appJs, 'biometricUnlockPin')),
    'ការស្កេនជីវមាត្រត្រូវលើកលែង (ប្រអប់ system បាំង App)');
check(/noteAppLockExcuse\(\)/.test(sliceFn(appJs, 'requestCameraPermission')),
    'ការសុំសិទ្ធិកាមេរ៉ាត្រូវលើកលែង');
check(/noteAppLockExcuse\(\)/.test(sliceFn(appJs, 'exportDataAsPDF')),
    'ការបោះពុម្ព (Export PDF) ត្រូវលើកលែង');
check(/input\[type="file"\]/.test(appJs) && /a\[href\^="tel:"\]/.test(appJs),
    'បញ្ជីលើកលែងគ្របការរើសឯកសារ និងតំណ tel: តាម DOM ផ្ទាល់');

const completeFn = sliceFn(appJs, 'completeAppUnlock');
check(/markAppUnlockedForSession\(\)/.test(completeFn) && /hideAppLockScreen\(\)/.test(completeFn),
    'ការដោះសោសម្គាល់វគ្គ ហើយបិទអេក្រង់', completeFn);
check(!/signOut|clearRememberedSession|zoew_login_time|remembered_email/.test(completeFn),
    '⛔ ការដោះសោ **មិនប៉ះ session ៤ ម៉ោង** សោះ', completeFn);
check(!/signOut|clearRememberedSession/.test(initFn + armFn + sessionFn),
    '⛔ ការចាក់សោ **មិនចាកចេញពីប្រព័ន្ធ** — វាជាស្រទាប់ចូលប្រើ មិនមែន auth');

const verifyFn = sliceFn(appJs, 'verifyAppLockPin');
check(/verifyStoredPin\(/.test(verifyFn), 'ការផ្ទៀងផ្ទាត់ប្រើ verifyStoredPin (PBKDF2 ដដែលនឹង PIN ដទៃ)', verifyFn);
check(/registerAppLockFailure\(\)/.test(verifyFn), 'PIN ខុស ➜ រាប់ចំនួនខុស', verifyFn);
check(/appLockLockoutSecondsLeft\(\)/.test(verifyFn), 'ការជាប់សោត្រូវពិនិត្យ **មុន** ការប្រៀបធៀប PIN', verifyFn);

check(/\.app-lock\s*\{[^}]*display:\s*none/.test(css), 'CSS ៖ អេក្រង់ចាក់សោលាក់តាមលំនាំដើម');
check(/\.app-lock\.is-open\s*\{[^}]*display:\s*flex/.test(css), 'CSS ៖ បង្ហាញ/លាក់តាម **class** មិនមែន style.display');
check(/body\.app-locked[\s\S]{0,320}?visibility:\s*hidden/.test(css),
    'CSS ៖ ខណៈចាក់សោ ➜ navbar · ទំព័រ · របា Tab ត្រូវលាក់ពិត');
check(/body\.app-locked \.modal,/.test(css),
    '⛔ CSS ៖ ប្រអប់ដែលបើកនៅ ក៏ត្រូវលាក់ដែរ — ការចាក់សោកណ្តាលការងារកើតឡើងពិត');
// ⛔ របា «មានកំណែថ្មី» សាងដោយ JS ក្រោយ boot ➜ វាមិនស្ថិតក្នុង index.html
// ដូច្នេះការស្កេន markup មិនឃើញវាទេ។ វាធ្លាប់ជា inline `z-index:99999`
// ដែល **ខ្ពស់ជាងអេក្រង់ចាក់សោ (2000)** ➜ វាគូរពីលើសោ ហើយប៊ូតុង
// «Refresh ឥឡូវនេះ» ចុចបានខណៈ App ជាប់សោ។
check(/body\.app-locked \.app-update-banner/.test(css),
    '⛔ CSS ៖ របាកំណែថ្មីក៏ត្រូវលាក់ក្រោមសោដែរ');
check(!/zoeUpdateBanner[\s\S]{0,400}?z-index:\s*9{4,}/.test(appJs),
    '⛔ របាកំណែថ្មីមិនប្រកាស z-index យក្សតាម inline style');
check(/\.app-lock-msg \{[^}]*text-align:\s*center/.test(css),
    'CSS ៖ សាររបស់អេក្រង់ចាក់សោឈរចំកណ្តាល ដូចធាតុដទៃលើកាត');
check(/\.btn-biometric \{[^}]*justify-content:\s*center/.test(css),
    'CSS ៖ ប៊ូតុងស្កេនជីវមាត្រ ៖ រូប + អក្សរឈរចំកណ្តាលជាក្រុមតែមួយ');

console.log('\n=== ១ខ. កុងតាក់ត្រូវមាន *ទិសបិទ* — សោដែលបិទមិនបាន ជាអន្ទាក់ ===');

// 🔴 របាយការណ៍អ្នកប្រើ ៖ *«ចុចបិទមុខងារ ចាក់សោពេលបើក App អត់បាន»*។
//
// មូលហេតុពិត ៖ មុខងារនេះធ្លាប់ដេរីវេ **ដោយផ្ទាល់** ពីវត្តមាននៃ
// `zoew_security_pin_hash` ➜ គ្មានទង់ «បើក/បិទ» ដាច់ដោយឡែកទេ ➜ ពេលមាន
// PIN រួច កុងតាក់ **គ្មានទិសបិទសោះ** ៖ វាត្រឹមបង្ហាញ toast រួច `return`។
// ផ្លូវតែមួយដែលបិទបានគឺ «ភ្លេច PIN?» ដែល **លុប Security PIN សកល +
// ចាកចេញពីប្រព័ន្ធ + បំផ្លាញការតភ្ជាប់ដែលអ៊ិនគ្រីបដោយ PIN** (Lookup API ·
// Sheet Import) ➜ តម្លៃធំពេកសម្រាប់កុងតាក់តែមួយ។
//
// ⛔ នេះជាថ្នាក់ដដែលនឹងជួរ «កុងតាក់ដែលមើលមិនឃើញ តែនៅដើរ ជាអន្ទាក់» ក្នុង
// `CLAUDE.md` — ត្រង់នេះផ្ទុយវិញ ៖ កុងតាក់ **មើលឃើញ ហើយចុចបាន** តែ
// **គ្មានឥទ្ធិពលបិទ**។ ច្បាប់ ៖ ការកំណត់ដែលបង្ហាញជាកុងតាក់ ត្រូវប្តូរបាន
// **ទាំង ២ ទិស** ដោយមិនទាមទារការបំផ្លាញអ្វីផ្សេង។

const flowFn = sliceFn(appJs, 'drawerAppLockFlow');
const sessionKeys = chainKeys(appJs, sliceFn(appJs, 'appLockUnlockedThisSession'), 3);
const armKeys = chainKeys(appJs, armFn, 4)
    .filter((k) => k !== 'zoew_security_pin_hash' && sessionKeys.indexOf(k) === -1);
const flowKeys = chainKeys(appJs, flowFn, 4);
const prefKeys = armKeys.filter((k) => flowKeys.indexOf(k) !== -1);

check(flowFn !== '', 'មានកុងតាក់ drawerAppLockFlow()');
check(prefKeys.length > 0,
    '⛔⛔ កុងតាក់ត្រូវសរសេរ **កូនសោដដែល** នឹងអ្វីដែលច្រកទ្វារចាក់សោអាន — បើអត់ ការចុចមិនអាចប្តូរសាលក្រមបានទេ',
    { armKeys: armKeys, flowKeys: flowKeys, sessionKeys: sessionKeys });

const prefKey = prefKeys[0] || '';
if (prefKey) {
    // ⛔ ការជ្រើសរបស់អ្នកប្រើត្រូវ **រស់រានការបិទ App** ➜ localStorage
    // មិនមែន sessionStorage (បើវគ្គ ➜ បិទបើក App ម្តង សោត្រឡប់មកវិញ)។
    const holders = (appJs.match(/function\s+\w+\([^)]*\)\s*\{/g) || [])
        .map((h) => sliceFn(appJs, (h.match(/function\s+(\w+)/) || [])[1]))
        .filter((b) => b && (b.indexOf("'" + prefKey + "'") !== -1
            || new RegExp('\\b' + (appJs.match(new RegExp("const\\s+([A-Z][A-Z0-9_]*)\\s*=\\s*'" + prefKey + "'")) || [,'__none__'])[1] + '\\b').test(b)));
    check(holders.length > 0 && holders.every((b) => !/appSessionStore|sessionStorage/.test(b)),
        '⛔ ការជ្រើស បើក/បិទ រស់នៅ localStorage ➜ វារស់រានការបិទបើក App', prefKey);
}

// ⛔ ការបិទត្រូវឆ្លងកាត់ PIN ដដែល ៖ វាជា **ការបន្ថយសុវត្ថិភាព** ➜ ទូរស័ព្ទ
// ដែលបើកចោលដោយដោះសោរួច មិនត្រូវឲ្យអ្នកដទៃបិទសោអចិន្ត្រៃយ៍បានដោយចុច ១ ដង។
check(/requestPinBeforeConfig\(/.test(flowFn),
    '⛔ ការប្តូរកុងតាក់ឆ្លងកាត់ PIN ជានិច្ច (ការបិទសោគឺការបន្ថយសុវត្ថិភាព)', flowFn);

// ⛔ ច្បាប់ `PIN_PROMPT_MESSAGES` ៖ សារពិពណ៌នា **អ្វីដែលនឹងកើតក្រោយវាយ PIN**
// ➜ ឈ្មោះតែមួយដែលបម្រើ «បើក» និង «បិទ» = យ៉ាងហោចណាស់ម្ខាងអានសារខុស។
const promptKeys = (flowFn.match(/requestPinBeforeConfig\([^)]*?'([a-zA-Z]+)'\s*\)/g) || [])
    .map((t) => (t.match(/'([a-zA-Z]+)'\s*\)$/) || [])[1]).filter(Boolean);
check(promptKeys.length >= 2 && promptKeys[0] !== promptKeys[1],
    '⛔ ផ្លូវបើក និងផ្លូវបិទប្រើ promptKey **ខុសគ្នា** (សារត្រូវប្រាប់អ្វីដែលនឹងកើតឡើងពិត)', promptKeys);
promptKeys.forEach((k) => {
    check(new RegExp('\\n\\s{8}' + k + ':\\s*\\{').test(appJs),
        'PIN_PROMPT_MESSAGES មានធាតុ «' + k + '» (បើអត់ ➜ អ្នកប្រើឃើញសារ «Config ឬ Reconfig»)', k);
});

// ⛔ ការបិទសោ **មិនមែន** ការលុប PIN ក្លែងខ្លួន ៖ Security PIN សកលការពារ
// Config · នាំចូល Excel · Lookup API · កែទឹកប្រាក់ · លុបទាំងអស់ ➜ ការបិទ
// កុងតាក់តែមួយមិនត្រូវប៉ះពួកវាឡើយ។
const togglePath = [flowFn].concat(chainNames(appJs, flowFn).map((n) => sliceFn(appJs, n))).join('\n');
check(!/signOut|clearRememberedSession|zoew_login_time|remembered_email/.test(togglePath)
    && !/safeStoreRemove\([^)]*'zoew_security_pin_hash'/.test(togglePath),
    '⛔ ផ្លូវកុងតាក់ **មិនប៉ះ** Security PIN · session ៤ ម៉ោង · ការចងចាំអ៊ីមែល (ការបិទសោមិនមែនការលុប PIN ក្លែងខ្លួន)',
    togglePath.slice(0, 300));

// ⛔ ស្លាកត្រូវមាន ៣ ស្ថានភាព — «បិទ» ជាស្ថានភាពពិត មិនមែនត្រឹមតម្លៃដើមក្នុង HTML។
const uiFn = sliceFn(appJs, 'refreshAppLockUi');
check(/'បើក'/.test(uiFn) && /'បិទ'/.test(uiFn) && /'ត្រូវកំណត់ PIN'/.test(uiFn),
    '⛔ ស្លាកកុងតាក់មាន ៣ ៖ «បើក» · «បិទ» · «ត្រូវកំណត់ PIN»', uiFn);

// ⛔ «ភ្លេច PIN?» លុប PIN ➜ វាត្រូវលុបការជ្រើសដែរ ដើម្បីកុំឲ្យ PIN ថ្មី
// ទទួលមរតក «បិទ» ចាស់ដោយស្ងាត់ (អ្នកប្រើនឹងជឿថាសោបើកវិញ ខណៈវាបិទ)។
if (prefKey) {
    const forgetFn = sliceFn(appJs, 'forgetAppLockPin');
    check(chainKeys(appJs, forgetFn, 3).indexOf(prefKey) !== -1,
        '⛔ «ភ្លេច PIN?» ត្រូវលុបការជ្រើស បើក/បិទ ដែរ (PIN ថ្មីមិនទទួលមរតកស្ងាត់)', forgetFn);
}

function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {},
    syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); },
    clearActivation: function () {}
};`;

const FAKE_SDK = function () {
    const noop = () => {};
    window.__signOutCalls = 0;
    window.firebaseSDK = {
        initializeApp: () => ({}),
        getApps: () => [],
        deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: { uid: 'u1', email: 'a@b.c' } }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb({ uid: 'u1', email: 'a@b.c' }), 10); return noop; },
        signInWithEmailAndPassword: () => Promise.resolve({ user: { uid: 'u1' } }),
        signOut: () => { window.__signOutCalls++; return Promise.resolve(); },
        setPersistence: () => Promise.resolve(),
        browserLocalPersistence: {}, browserSessionPersistence: {},
        getDatabase: () => ({}),
        ref: (db, p) => ({ path: p }),
        onValue: (r, cb) => { setTimeout(() => cb({ val: () => (String(r.path) === '.info/connected' ? true : null), exists: () => false }), 20); return noop; },
        off: noop,
        set: () => Promise.resolve(),
        update: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        get: () => Promise.resolve({ val: () => null, exists: () => false }),
        runTransaction: (r, fn) => Promise.resolve({ committed: true, snapshot: { val: () => fn(null) } }),
        increment: (n) => ({ __inc: n }),
        goOffline: noop, goOnline: noop, serverTimestamp: () => Date.now()
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

const PIN = '135790';
const WRONG = '000000';

async function withTimeout(promise, ms, label) {
    let timer = null;
    const guard = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('អស់ពេល: ' + label)), ms); });
    try {
        return await Promise.race([promise, guard]);
    } finally {
        clearTimeout(timer);
    }
}

(async () => {
    if (!fs.existsSync(CHROME)) {
        console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME);
        console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail : '✅ ជោគជ័យ ' + pass) + ' (ផ្នែក browser មិនបានរត់)');
        process.exit(fail ? 1 : 0);
    }
    if (!appJs || !html) {
        console.log('\n❌ ធ្លាក់ ' + (fail || 1) + ' — ផ្នែក browser រំលង ព្រោះអានឯកសារ App មិនបាន');
        process.exit(1);
    }

    const server = await serve(APP);
    const port = server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept().catch(() => {}));
    // ⛔ ការធ្លាក់ត្រូវមានឈ្មោះ ៖ កំហុស runtime ក្នុងទំព័រ ធ្វើឲ្យជំហានបន្ទាប់
    // ធ្លាក់ដោយហេតុផលមើលទៅមិនពាក់ព័ន្ធ។ ត្រូវរាយវាជាមួយការធ្លាក់នោះ។
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e).split('\n')[0]));
    await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
            var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
            setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
        });`);
    await page.route('**', (route) => {
        const u = route.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
        return route.abort();
    });
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript('(' + FAKE_SDK.toString() + ')();');

    const load = () => page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    const settle = () => page.waitForTimeout(2200);
    const state = () => page.evaluate(() => {
        const vis = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return 'missing';
            return getComputedStyle(el).visibility;
        };
        const lock = document.getElementById('appLockScreen');
        return {
            bodyLocked: document.body.classList.contains('app-locked'),
            lockShown: !!lock && getComputedStyle(lock).display !== 'none',
            pages: vis('#appPages'),
            navbar: vis('.app-navbar'),
            tabbar: vis('.page-tabbar'),
            unlockedFlag: sessionStorage.getItem('zoew_app_unlocked'),
            loginTime: localStorage.getItem('zoew_login_time'),
            email: localStorage.getItem('remembered_email'),
            signOuts: window.__signOutCalls,
            submitDisabled: !!(document.getElementById('appLockSubmitBtn') || {}).disabled,
            pinValue: ((document.getElementById('appLockPinInput') || {}).value || '').length,
            msg: (document.getElementById('appLockMsg') || {}).textContent || ''
        };
    });
    const hashPinIn = (pin) => page.evaluate(async (p) => {
        const enc = new TextEncoder();
        const km = await crypto.subtle.importKey('raw', enc.encode(p), { name: 'PBKDF2' }, false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('zoeadmin_pin_verify_v2'), iterations: 150000, hash: 'SHA-256' }, km, 256);
        return 'pbkdf2:' + Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }, pin);
    let pinHash = '';
    // ⚠️ អន្ទាក់ **harness** ដែលវាស់បានក្នុងជុំនេះ (មិនមែនកំហុស App)៖ ក្រោយ
    // វដ្ត «ចាកចេញ ➜ ត្រឡប់មក» បូកការ navigate ច្រើនដង Chromium headless
    // **ឈប់បញ្ជូន input ពិត** ចូលឯកសារនោះ — `page.click` និង `page.press`
    // ត្រឡប់ដោយជោគជ័យ តែ **គ្មាន event ណាមកដល់ `document` សោះ** (វាស់ដោយ
    // listener capture; `page.bringToFront()` មិនជួយ)។ ដូច្នេះមានផ្លូវបម្រុង
    // ដែលហៅ `.click()` ក្នុងទំព័រ — វា **នៅតែឆ្លងកាត់ delegation ពិត ➜
    // submitAppLockForm ➜ verifyAppLockPin** គ្រាន់តែមិនឆ្លងបំពង់ input របស់
    // ឧបករណ៍។ ⛔ មុនធ្លាក់ទៅផ្លូវនោះ តេស្ត **អះអាងធរណីមាត្រពិត** របស់ប៊ូតុង
    // — បើមិនដូច្នេះ ការបម្រុងនឹងលាក់ការធ្លាក់ពិត (ប៊ូតុងដែលចុចមិនកើត)។
    const typePin = async (pin) => {
        await page.fill('#appLockPinInput', pin, { timeout: 6000 });
        await page.click('#appLockSubmitBtn', { timeout: 6000 });
        await page.waitForTimeout(900);
        const untouched = await page.evaluate(() => ((document.getElementById('appLockPinInput') || {}).value || '') !== '');
        if (!untouched) return;
        const box = await page.locator('#appLockSubmitBtn').boundingBox().catch(() => null);
        const vp = page.viewportSize();
        check(!!box && box.width > 0 && box.height > 0 && box.y >= 0 && box.y + box.height <= vp.height + 1,
            'ប៊ូតុង «ដោះសោ» មើលឃើញពិត និងឈរក្នុងអេក្រង់ (មុនប្រើផ្លូវបម្រុងរបស់ harness)', { box: box, vp: vp });
        await page.evaluate(() => { const b = document.getElementById('appLockSubmitBtn'); if (b) b.click(); });
        await page.waitForTimeout(900);
    };

    // ⚠️ Chromium headless **មិនប្តូរ `visibilityState` ទេ** ទោះប្តូរ tab
    // (វាស់បានក្នុងជុំនេះ ៖ `bringToFront` និង CDP `Page.setWebLifecycleState`
    // ទាំង ២ ទុក `visible` ដដែល)។ ដូច្នេះតេស្តជំនួស getter រួចបាញ់
    // ព្រឹត្តិការណ៍ពិត — **កូដដែលរត់គឺកូដពិតរបស់ App** ក្នុង DOM ពិត ជាមួយ
    // CSS ពិត និង storage ពិត; មានតែ **ប្រភពនៃព្រឹត្តិការណ៍** ទេដែលក្លែង។
    const setVisibility = (v) => page.evaluate((next) => {
        if (!window.__visPatched) {
            window.__visPatched = true;
            window.__visState = 'visible';
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__visState });
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__visState === 'hidden' });
        }
        window.__visState = next;
        document.dispatchEvent(new Event('visibilitychange'));
    }, v);
    const leaveApp = async () => { await setVisibility('hidden'); await page.waitForTimeout(400); };
    const returnToApp = async () => { await setVisibility('visible'); await page.waitForTimeout(700); };
    const unlockFresh = async () => {
        await page.evaluate((h) => {
            localStorage.removeItem('zoew_biometric_unlock_v1');
            localStorage.removeItem('zoew_pin_fail_count');
            localStorage.removeItem('zoew_pin_lockout_until');
            localStorage.setItem('zoew_security_pin_hash', h);
            localStorage.setItem('zoew_login_time', '1700000000000');
            localStorage.setItem('remembered_email', 'a@b.c');
            sessionStorage.clear();
        }, pinHash);
        await withTimeout(load(), 30000, 'reload-before-unlock');
        await settle();
        await typePin(PIN);
        const s = await state();
        check(!s.bodyLocked && s.unlockedFlag === '1', 'ចាប់ផ្តើមពីស្ថានភាពដោះសោរួច',
            Object.assign({ pageErrors: pageErrors.slice(-3) }, s));
        return s;
    };

    async function group(title, fn) {
        console.log('\n=== ' + title + ' ===');
        try {
            await fn();
        } catch (e) {
            bad(title + ' ➜ ជំហានបោះកំហុស', String(e && e.message ? e.message : e).split('\n')[0]);
        }
    }

    try {
        await group('២. គ្មាន PIN ➜ **មិនចាក់សោ** (ទិសផ្ទុយ — App ដើរដូចមុន)', async () => {
            await withTimeout(load(), 30000, 'load');
            await settle();
            const s = await state();
            check(!s.bodyLocked && !s.lockShown, '⛔ គ្មាន PIN ➜ App មិនត្រូវចាក់សោ', s);
            check(s.pages === 'visible', 'គ្មាន PIN ➜ ទំព័រនៅមើលឃើញធម្មតា', s);
            check(s.unlockedFlag === '1', 'គ្មាន PIN ➜ សម្គាល់វគ្គថាដោះសោរួច (មិនរង់ចាំសោដែលមិនមាន)', s);
        });

        await group('៣. មាន PIN + វគ្គថ្មី ➜ **ចាក់សោ** ហើយទិន្នន័យលាក់ពិត', async () => {
            pinHash = await hashPinIn(PIN);
            const hash = pinHash;
            await page.evaluate((h) => {
                localStorage.setItem('zoew_security_pin_hash', h);
                localStorage.setItem('zoew_login_time', '1700000000000');
                localStorage.setItem('remembered_email', 'a@b.c');
                sessionStorage.removeItem('zoew_app_unlocked');
            }, hash);
            await withTimeout(load(), 30000, 'reload');
            await settle();
            const s = await state();
            check(s.bodyLocked && s.lockShown, 'មាន PIN + វគ្គថ្មី ➜ អេក្រង់ចាក់សោលេចឡើង', s);
            check(s.pages === 'hidden', '⛔ ទំព័រទិន្នន័យ **លាក់ពិត** ក្រោមសោ', s);
            check(s.navbar === 'hidden' && s.tabbar === 'hidden', '⛔ របាខាងលើ និងរបា Tab ក៏លាក់ដែរ', s);
            check(s.unlockedFlag === null, 'មិនទាន់ដោះសោ ➜ គ្មានទង់ក្នុងវគ្គ', s);
            const focused = await page.evaluate(() => (document.activeElement || {}).id || '');
            check(focused !== 'hwScannerInput', '⛔ ម៉ាស៊ីនស្កេន hardware មិនដណ្តើម focus ខណៈចាក់សោ', focused);
        });

        await group('៣ខ. ⛔ គ្មានស្រទាប់ណាគូរ *ពីលើ* អេក្រង់ចាក់សោ', async () => {
            // វាស់ **អ្វីដែលនៅលើគេពិត** តាម `elementFromPoint` — មិនមែនអាន CSS។
            // របាកំណែថ្មីជាស្រទាប់ដែល JS សាងក្រោយ boot ដូច្នេះការស្កេន markup
            // មើលមិនឃើញវា; មានតែ hit-test ពិតទេដែលចាប់បាន។
            const top = await page.evaluate(() => {
                if (typeof showUpdateAvailableBanner === 'function') showUpdateAvailableBanner();
                const lock = document.getElementById('appLockScreen');
                const w = window.innerWidth, h = window.innerHeight;
                const pts = [[w / 2, h - 6], [w / 2, h - 24], [w / 2, h / 2], [w / 2, 8], [6, h - 12]];
                const out = pts.map(([x, y]) => {
                    const el = document.elementFromPoint(x, y);
                    if (!el) return 'none';
                    if (lock && (el === lock || lock.contains(el))) return 'lock';
                    return el.tagName + '.' + String(el.className || '').slice(0, 40);
                });
                const banner = document.getElementById('zoeUpdateBanner');
                return {
                    hits: out,
                    bannerExists: !!banner,
                    bannerVisibility: banner ? getComputedStyle(banner).visibility : 'missing'
                };
            });
            check(top.bannerExists, 'របាកំណែថ្មីត្រូវសាងបានពិត (បើអត់ ការវាស់នេះទទេ)', top);
            check(top.bannerVisibility === 'hidden', '⛔ របាកំណែថ្មី **លាក់ពិត** ខណៈចាក់សោ', top);
            check(top.hits.every((h) => h === 'lock'), '⛔ គ្រប់ចំណុចនៃអេក្រង់ ➜ អ្វីដែលនៅលើគេជាអេក្រង់ចាក់សោ', top);

            // ⛔ ជាន់ទី ២ ៖ ទោះគ្មានសោ របានេះក៏មិនត្រូវគ្របប្រអប់ដែរ។
            // `visibility: hidden` គ្របលើ z-index ➜ ការវាស់ខាងលើ **មិនអាច**
            // បែងចែក z-index បានទេ។ ការវាស់នេះទើបចាក់សោលំដាប់ជង់ពិត ៖
            // របាដែលឈរលើប្រអប់ បាំងវាល PIN ដែលអ្នកប្រើកំពុងវាយ។
            const overModal = await page.evaluate(() => {
                document.body.classList.remove('app-locked');
                const lock = document.getElementById('appLockScreen');
                if (lock) lock.classList.remove('is-open');
                const modal = document.getElementById('pinModal') || document.querySelector('.modal');
                if (!modal) return { missing: true };
                modal.style.display = 'flex';
                const w = window.innerWidth, h = window.innerHeight;
                const el = document.elementFromPoint(w / 2, h - 6);
                const banner = document.getElementById('zoeUpdateBanner');
                const inBanner = !!(banner && el && (el === banner || banner.contains(el)));
                const inModal = !!(el && el.closest && el.closest('.modal'));
                modal.style.display = '';
                return { inBanner: inBanner, inModal: inModal, tag: el ? el.tagName + '.' + String(el.className || '').slice(0, 40) : 'none' };
            });
            check(!overModal.missing && overModal.inModal && !overModal.inBanner,
                '⛔ របាកំណែថ្មីឈរ **ក្រោម** ប្រអប់ — វាមិនត្រូវបាំងវាល PIN ដែលកំពុងវាយ', overModal);

            await page.evaluate(() => {
                const b = document.getElementById('zoeUpdateBanner');
                if (b) b.remove();
                document.body.classList.add('app-locked');
                const lock = document.getElementById('appLockScreen');
                if (lock) lock.classList.add('is-open');
            });
        });

        await group('៤. session ៤ ម៉ោង **មិនរងផល** ដោយការចាក់សោ', async () => {
            const s = await state();
            check(s.loginTime === '1700000000000', '⛔ `zoew_login_time` នៅដដែល', s.loginTime);
            check(s.email === 'a@b.c', '⛔ អ៊ីមែលដែលចងចាំនៅដដែល', s.email);
            check(s.signOuts === 0, '⛔ ការចាក់សោ **មិនហៅ signOut** សោះ', s.signOuts);
        });

        await group('៥. PIN ខុស ➜ នៅចាក់សោ · រាប់ចំនួន · គ្មានទង់', async () => {
            await typePin(WRONG);
            const s = await state();
            check(s.bodyLocked, '⛔ PIN ខុស ➜ នៅតែចាក់សោ', s);
            check(s.unlockedFlag === null, '⛔ PIN ខុស ➜ មិនសម្គាល់វគ្គថាដោះសោ', s);
            check(s.msg.indexOf('4') !== -1, 'សារប្រាប់ចំនួនដងដែលនៅសល់', s.msg);
            const fails = await page.evaluate(() => localStorage.getItem('zoew_pin_fail_count'));
            check(fails === '1', 'ចំនួនខុសត្រូវកត់ត្រាក្នុង counter ដដែលនឹង PIN ដទៃ', fails);
        });

        await group('៦. ៥ ដងខុស ➜ ជាប់សោ · **PIN ត្រឹមត្រូវក៏ត្រូវបដិសេធ**', async () => {
            for (let i = 0; i < 4; i++) await typePin(WRONG);
            const lockedOut = await page.evaluate(() => localStorage.getItem('zoew_pin_lockout_until'));
            check(!!lockedOut && Number(lockedOut) > Date.now(), '៥ ដងខុស ➜ ចាប់ផ្តើមជាប់សោ ១ នាទី', lockedOut);
            await typePin(PIN);
            const s = await state();
            check(s.bodyLocked && s.unlockedFlag === null,
                '⛔ ក្នុងអំឡុងជាប់សោ ➜ សូម្បី PIN ត្រឹមត្រូវក៏មិនដោះសោដែរ', s);
            await page.evaluate(() => { localStorage.removeItem('zoew_pin_lockout_until'); localStorage.removeItem('zoew_pin_fail_count'); });
        });

        await group('៧. PIN ត្រឹមត្រូវ ➜ ដោះសោ · App មកវិញ · counter សម្អាត', async () => {
            await typePin(PIN);
            const s = await state();
            check(!s.bodyLocked && !s.lockShown, 'PIN ត្រឹមត្រូវ ➜ សោរលាយ', s);
            check(s.pages === 'visible' && s.navbar === 'visible', 'App ត្រឡប់មកមើលឃើញវិញ', s);
            check(s.unlockedFlag === '1', 'វគ្គត្រូវសម្គាល់ថាដោះសោរួច', s);
            check(s.loginTime === '1700000000000' && s.signOuts === 0, '⛔ session ៤ ម៉ោងនៅដដែលក្រោយដោះសោ', s);
            const fails = await page.evaluate(() => localStorage.getItem('zoew_pin_fail_count'));
            check(fails === null, 'ដោះសោបាន ➜ counter ខុសត្រូវសម្អាត', fails);
        });

        await group('៨. ⛔ ការផ្ទុកឡើងវិញក្នុងវគ្គដដែល (PTR · ការស្តារ SDK) ➜ **មិនចាក់សោ**', async () => {
            await withTimeout(load(), 30000, 'reload-same-session');
            await settle();
            const s = await state();
            check(!s.bodyLocked && s.pages === 'visible',
                '⛔ Refresh ក្នុងវគ្គដដែល ➜ មិនសុំ PIN ម្តងទៀត (បើអត់ ➜ រាល់ការទាញចុះត្រូវវាយ PIN)', s);
        });

        await group('៩. បិទ App រួចបើកវិញ (វគ្គថ្មី) ➜ **ចាក់សោម្តងទៀត**', async () => {
            await page.evaluate(() => sessionStorage.clear());
            await withTimeout(load(), 30000, 'reload-new-session');
            await settle();
            const s = await state();
            check(s.bodyLocked && s.pages === 'hidden', '⛔ វគ្គថ្មី ➜ ចាក់សោម្តងទៀត', s);
            check(s.loginTime === '1700000000000', 'ហើយ session ៤ ម៉ោងនៅដដែល — មិនបាច់វាយពាក្យសម្ងាត់', s);
        });

        await group('១០. ចាកចេញ ➜ ទង់ដោះសោត្រូវលុប', async () => {
            await typePin(PIN);
            check((await state()).unlockedFlag === '1', 'ដោះសោវិញបាន');
            await page.evaluate(() => window.logoutApp());
            await page.waitForTimeout(600);
            const flag = await page.evaluate(() => sessionStorage.getItem('zoew_app_unlocked'));
            check(flag === null, '⛔ ចាកចេញ ➜ លុបទង់ ➜ ការចូលបន្ទាប់ត្រូវឆ្លងសោម្តងទៀត', flag);
        });

        await group('១១. ប៊ូតុងជីវមាត្រ ៖ លាក់ពេលមិនទាន់ចង · លេចពេលចងរួច', async () => {
            await page.evaluate(() => { sessionStorage.clear(); localStorage.removeItem('zoew_biometric_unlock_v1'); });
            await withTimeout(load(), 30000, 'reload-bio-off');
            await settle();
            const off = await page.evaluate(() => {
                const b = document.getElementById('appLockBiometricBtn');
                return !!b && getComputedStyle(b).display !== 'none';
            });
            check(off === false, 'មិនទាន់ចងក្រយៅដៃ/មុខ ➜ ប៊ូតុងលាក់', off);
            await page.evaluate(() => {
                sessionStorage.clear();
                localStorage.setItem('zoew_biometric_unlock_v1', JSON.stringify({
                    credentialId: 'abc', mode: 'device', wrapKey: 'a2V5', wrapped: { iv: 'aXY=', data: 'ZGF0YQ==' }
                }));
            });
            await withTimeout(load(), 30000, 'reload-bio-on');
            await settle();
            const on = await page.evaluate(() => {
                const b = document.getElementById('appLockBiometricBtn');
                return !!b && getComputedStyle(b).display !== 'none';
            });
            check(on === true, 'ចងរួច ➜ ប៊ូតុងស្កេនលេចលើអេក្រង់ចាក់សោ', on);
            const autoMsg = await page.evaluate(() => (document.getElementById('appLockMsg') || {}).textContent || '');
            check(autoMsg === '',
                '⛔ ការស្កេនស្វ័យប្រវត្តិដែលបរាជ័យ/ត្រូវបោះបង់ ➜ **ស្ងាត់** (គ្មានសារក្រហមពេលបើក)', autoMsg);
            await page.click('#appLockBiometricBtn', { timeout: 6000 });
            await page.waitForTimeout(900);
            const tapMsg = await page.evaluate(() => (document.getElementById('appLockMsg') || {}).textContent || '');
            check(tapMsg.indexOf('PIN') !== -1,
                'ចុចដោយដៃ ➜ ប្រាប់ការពិត ហើយណែនាំឲ្យវាយ PIN ជំនួស', tapMsg);
        });

        await group('១២. អេក្រង់ចាក់សោសមនឹងអេក្រង់តូច (320px)', async () => {
            await page.setViewportSize({ width: 320, height: 640 });
            await page.waitForTimeout(400);
            const box = await page.evaluate(() => {
                const vw = document.documentElement.clientWidth;
                let over = null;
                document.querySelectorAll('#appLockScreen *').forEach((el) => {
                    if (over) return;
                    const cs = getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return;
                    const b = el.getBoundingClientRect();
                    if (b.width === 0 && b.height === 0) return;
                    if (b.right > vw + 1 || b.left < -1) over = el.tagName + '#' + (el.id || '') + ' right=' + Math.round(b.right) + '/' + vw;
                });
                const card = document.querySelector('.app-lock-card');
                const cb = card ? card.getBoundingClientRect() : null;
                const screen = document.getElementById('appLockScreen');
                return { over: over, top: cb ? Math.round(cb.top) : null, scrollable: screen ? getComputedStyle(screen).overflowY : null };
            });
            check(box.over === null, '⛔ គ្មានធាតុលើសទទឹងនៅ 320px', box);
            check(box.top === null || box.top >= -1, '⛔ កាតមិនចេញក្រៅផ្នែកខាងលើ', box);
            check(box.scrollable === 'auto' || box.scrollable === 'scroll', 'អេក្រង់ចាក់សោរមូរបាន (ក្តារចុចបើក ➜ នៅឈានដល់)', box);
            await page.setViewportSize({ width: 412, height: 880 });
        });

        await group('១៣. ⛔ ចេញពី App (មិន clear task) ➜ ត្រឡប់មក ➜ **ចាក់សោម្តងទៀត**', async () => {
            await unlockFresh();
            await leaveApp();
            const away = await state();
            check(away.bodyLocked && away.pages === 'hidden',
                '⛔ ពេលចាកចេញ ➜ បាំងភ្លាម (រូបក្នុង task switcher មិនលេចលេខអតិថិជន)', away);
            check(away.unlockedFlag === '1',
                '⛔ ការបាំង **មិនប៉ះទង់វគ្គ** — `hidden` បាញ់ពេល PTR reload ដែរ', away);

            await returnToApp();
            const s = await state();
            check(s.bodyLocked && s.lockShown, '⛔ ត្រឡប់ចូល App វិញ ➜ ត្រូវវាយ PIN ម្តងទៀត', s);
            check(s.pages === 'hidden' && s.navbar === 'hidden' && s.tabbar === 'hidden',
                '⛔ ទិន្នន័យលាក់ពិតក្រោយត្រឡប់មក', s);
            check(s.unlockedFlag === null, '⛔ ការត្រឡប់មកទើបលុបទង់វគ្គ ➜ Refresh មិនមែនផ្លូវរំលងសោ', s);
            check(s.loginTime === '1700000000000' && s.signOuts === 0,
                '⛔ session ៤ ម៉ោង **មិនរងផល** — ដោះសោ ➜ ចូលដល់ App ភ្លាម', s);
            const focused = await page.evaluate(() => (document.activeElement || {}).id || '');
            check(focused === 'appLockPinInput',
                '⛔ focus ផ្លាស់ទៅប្រអប់ PIN ➜ barcode មិនធ្លាក់ចូលវាល App ក្រោមសោ', focused);
        });

        await group('១៤. Refresh ខណៈចាក់សោ ➜ **នៅតែចាក់សោ** (មិនមែនផ្លូវរំលង)', async () => {
            await withTimeout(load(), 30000, 'reload-while-locked');
            await settle();
            const s = await state();
            check(s.bodyLocked && s.pages === 'hidden', '⛔ ការផ្ទុកឡើងវិញខណៈចាក់សោ ➜ នៅចាក់សោដដែល', s);
        });

        await group('១៥. ⛔ ការទាញចុះ Refresh (PTR) ក្រោយបាំង ➜ **មិនចាក់សោ**', async () => {
            await unlockFresh();
            await leaveApp();
            const away = await state();
            check(away.bodyLocked && away.unlockedFlag === '1', 'បាំងរួច ហើយទង់វគ្គនៅដដែល', away);
            await withTimeout(load(), 30000, 'ptr-reload-after-veil');
            await settle();
            const s = await state();
            check(!s.bodyLocked && s.pages === 'visible',
                '⛔ PTR/reload ក្រោយព្រឹត្តិការណ៍ `hidden` ➜ **មិនសុំ PIN** (បើអត់ ➜ រាល់ការទាញចុះក្លាយជាទោស)', s);
        });

        await group('១៦. ⛔ «📞 ខល» (`tel:`) ➜ ចាកចេញ ➜ ត្រឡប់មក ➜ **មិនចាក់សោ**', async () => {
            await unlockFresh();
            await page.evaluate(() => {
                const a = document.createElement('a');
                a.href = 'tel:012345678';
                a.id = 'testCallLink';
                a.textContent = 'call';
                document.body.appendChild(a);
                a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            });
            await page.waitForTimeout(150);
            await leaveApp();
            const away = await state();
            check(!away.bodyLocked, '⛔ ការចាកចេញដើម្បីខល ➜ **មិនបាំង**', away);
            await returnToApp();
            const s = await state();
            check(!s.bodyLocked && s.pages === 'visible' && s.unlockedFlag === '1',
                '⛔ ត្រឡប់មកក្រោយខល ➜ **មិនសុំ PIN** (លំហូរការងារនៅរស់)', s);

            await leaveApp();
            await returnToApp();
            const again = await state();
            check(again.bodyLocked && again.unlockedFlag === null,
                '⛔ ទិសផ្ទុយ ៖ ការចាកចេញ **លើកក្រោយ** (គ្មានការខល) ➜ ចាក់សោដដែល — ការលើកលែងប្រើតែម្តង', again);
            await page.evaluate(() => { const a = document.getElementById('testCallLink'); if (a) a.remove(); });
        });

        await group('១៧. ⛔ ការរើសឯកសារ (label ➜ input[type=file]) ➜ **មិនចាក់សោ**', async () => {
            await unlockFresh();
            const clicked = await page.evaluate(() => {
                const label = document.querySelector('label[for="fileInput"]');
                if (!label) return false;
                label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                return true;
            });
            check(clicked, 'រកឃើញប៊ូតុង «យក Barcode ពីរូបភាព» ពិតក្នុង App', clicked);
            await leaveApp();
            await returnToApp();
            const s = await state();
            check(!s.bodyLocked, '⛔ ត្រឡប់មកក្រោយរើសរូបភាព ➜ មិនសុំ PIN', s);
        });

        await group('១៨. ⛔ គ្មាន PIN ➜ ចាកចេញ/ត្រឡប់មក ➜ **មិនចាក់សោសោះ** (ទិសផ្ទុយ)', async () => {
            await page.evaluate(() => { localStorage.removeItem('zoew_security_pin_hash'); sessionStorage.clear(); });
            await withTimeout(load(), 30000, 'reload-no-pin');
            await settle();
            await leaveApp();
            const away = await state();
            check(!away.bodyLocked, '⛔ គ្មាន PIN ➜ ការចាកចេញមិនបាំង', away);
            await returnToApp();
            const s = await state();
            check(!s.bodyLocked && s.pages === 'visible', '⛔ គ្មាន PIN ➜ ត្រឡប់មកមិនចាក់សោ', s);
            await page.evaluate((h) => localStorage.setItem('zoew_security_pin_hash', h), pinHash);
        });

        await group('១៩. ⛔ ចាក់សោកណ្តាលការងារ ➜ ប្រអប់ដែលបើកនៅ ត្រូវលាក់ដែរ', async () => {
            await unlockFresh();
            const opened = await page.evaluate(() => {
                if (typeof window.openModalHelper !== 'function') return false;
                window.openModalHelper('exportDataModal');
                const m = document.getElementById('exportDataModal');
                return !!m && getComputedStyle(m).display !== 'none' && getComputedStyle(m).visibility === 'visible';
            });
            check(opened, 'ប្រអប់សាកល្បងបើកមើលឃើញមុនចាក់សោ', opened);
            await leaveApp();
            await returnToApp();
            const s = await page.evaluate(() => {
                const m = document.getElementById('exportDataModal');
                return {
                    locked: document.body.classList.contains('app-locked'),
                    modal: m ? getComputedStyle(m).visibility : 'missing'
                };
            });
            check(s.locked && s.modal === 'hidden',
                '⛔ ការចាក់សោគ្របប្រអប់ដែលបើកនៅ — បើអត់ ➜ លេខអតិថិជនអានឃើញពីក្រោយសោ', s);
        });

        // ២០. ⛔ របាយការណ៍ពិតពីអ្នកប្រើ (2026-09-10) ៖ *«ដោះសោ Applock រួច
        //     ក៏ api lookup ទាមទារដោះសោដដែល ទាល់តែដោះសោក្នុង api lookup
        //     បានវាលោតមុខងារ មិនទាន់បិទ ZTO»*។
        //
        //     ⛔ ការអានកូដ **បញ្ជាក់ខុស** ៖ `completeAppUnlock(pin)` ពិតជា
        //     កំណត់ `lookupSecretKey` មែន ➜ ជុំមុនសន្និដ្ឋានថា «វាដំណើរការ
        //     រួចហើយ»។ អ្វីដែលការអានកូដមើលមិនឃើញគឺ **អាយុ** នៃតម្លៃទាំង ២ ៖
        //       · ទង់ដោះសោ App Lock រស់ក្នុង `sessionStorage` ➜ **រស់រាន
        //         ការផ្ទុកឡើងវិញ** (ចាំបាច់ — បើអត់ រាល់ការទាញចុះ PTR
        //         ត្រូវវាយ PIN; មើលក្រុម ៨ និង ១៥)។
        //       · `lookupSecretKey` ជា **អថេរក្នុងសតិ** ➜ **ងាប់រាល់ការ
        //         ផ្ទុកឡើងវិញ** ហើយវាដេរីវេពី PIN ដែល **មិនត្រូវរក្សាទុក**។
        //     ➜ ក្រោយ PTR ដំបូង ៖ App Lock **ដោះរួច** ខណៈសោ ZTO **ជាប់វិញ**
        //     ➜ អ្នកប្រើត្រូវវាយ PIN ម្តងទៀតតាមផ្លូវ Lookup ហើយមុខងារ
        //     «ZTO មិនទាន់បិទ» ទើបភ្ញាក់។ PTR ជាកាយវិការស្នូលរបស់ App នេះ
        //     ➜ ថ្នាក់នេះកើត **រាល់ថ្ងៃ**។
        await group('២០. ⛔ ការដោះសោ App Lock ➜ សោ ZTO Lookup ត្រូវរស់រាន **ការផ្ទុកឡើងវិញ**', async () => {
            const ZTO_CFG = {
                enabled: true,
                url: '/.netlify/functions/zto-order-detail',
                headerName: 'x-zto-proxy-key',
                headerValueEnc: 'v1:ZmFrZQ==:ZmFrZQ=='
            };
            const readLock = () => page.evaluate(() => {
                const cfg = typeof ztoStatusFeatureConfig === 'function' ? ztoStatusFeatureConfig() : null;
                return {
                    hasCfg: !!cfg,
                    secret: typeof lookupSecretKey !== 'undefined' ? !!lookupSecretKey : null,
                    ztoLocked: typeof ztoStatusSecretIsLocked === 'function' ? ztoStatusSecretIsLocked(cfg) : null
                };
            });
            await page.evaluate((cfg) => {
                localStorage.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
            }, ZTO_CFG);
            await unlockFresh();
            await page.evaluate((cfg) => {
                localStorage.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
            }, ZTO_CFG);
            const afterPin = await readLock();
            check(afterPin.hasCfg === true,
                'លក្ខខណ្ឌចាំបាច់ ៖ ការកំណត់ ZTO Lookup ត្រូវបានអាន', afterPin);
            check(afterPin.secret === true && afterPin.ztoLocked === false,
                'ដោះសោដោយ PIN ➜ សោ ZTO Lookup ដោះតាមភ្លាម', afterPin);

            await withTimeout(load(), 30000, 'reload-after-unlock');
            await settle();
            const s = await state();
            check(!s.bodyLocked && s.unlockedFlag === '1',
                'លក្ខខណ្ឌចាំបាច់ ៖ ការផ្ទុកឡើងវិញក្នុងវគ្គដដែល **មិនចាក់សោ** (មិនប្តូរឥរិយាបថ PTR)', s);
            const afterReload = await readLock();
            check(afterReload.hasCfg === true,
                'លក្ខខណ្ឌចាំបាច់ ៖ ការកំណត់នៅរស់រានការផ្ទុកឡើងវិញ', afterReload);
            check(afterReload.ztoLocked === false,
                '⛔ ក្រោយ PTR ៖ App Lock ដោះរួច ➜ សោ ZTO Lookup **មិនត្រូវជាប់វិញ**', afterReload);

            // ⛔ ការធ្វើឲ្យសោរស់រានការផ្ទុកឡើងវិញ ជា **ការប្តូរកន្លែងដែល
            //    សោសម្ងាត់រស់នៅ** ➜ បើគ្មានទិសផ្ទុយ វាជា **រន្ធសុវត្ថិភាព**
            //    មិនមែនការកែទេ។
            // ⛔ **លំដាប់សំខាន់** ៖ ការសាក «វគ្គថ្មីមិនត្រូវស្តារ» ត្រូវរត់
            //    ខណៈកំណត់ត្រា **នៅមានពិត** — វាស់បាន ៖ បើលុបកំណត់ត្រាមុន
            //    (តាម `clearAppUnlockedForSession()`) នោះ mutation ដែលដក
            //    ច្រកទ្វារ `appLockShouldArm()` ចេញ **រស់រាន** ព្រោះគ្មាន
            //    អ្វីត្រូវស្តារ ➜ ការអះអាងបៃតង **ដោយចៃដន្យ**។
            const exportable = await page.evaluate(async () => {
                if (typeof lookupSecretKey === 'undefined' || !lookupSecretKey) return 'no-key';
                try {
                    await crypto.subtle.exportKey('raw', lookupSecretKey);
                    return 'EXPORTED';
                } catch (e) { return 'threw'; }
            });
            check(exportable === 'threw',
                '⛔ សោដែលស្តារមកវិញ ត្រូវ **នាំចេញមិនបាន** (extractable:false) — បើនាំចេញបាន script ណាមួយអានសោបាន', exportable);

            const readStored = () => page.evaluate(() => new Promise((resolve) => {
                let done = false;
                const fin = (v) => { if (!done) { done = true; resolve(v); } };
                setTimeout(() => fin('timeout'), 2000);
                try {
                    const req = indexedDB.open('zoew_lookup_key_v1', 1);
                    req.onsuccess = () => {
                        try {
                            const g = req.result.transaction('k', 'readonly').objectStore('k').get('lookupSecretKey');
                            g.onsuccess = () => fin(g.result ? 'PRESENT' : 'gone');
                            g.onerror = () => fin('gone');
                        } catch (e) { fin('gone'); }
                    };
                    req.onerror = () => fin('gone');
                } catch (e) { fin('gone'); }
            }));
            check((await readStored()) === 'PRESENT',
                'លក្ខខណ្ឌចាំបាច់ ៖ សោត្រូវបានរក្សាទុកពិត (បើអត់ ការសាកខាងក្រោមបៃតងដោយចៃដន្យ)');

            // ⛔ ការការពារមាន **២ ជាន់ឯករាជ្យ** ➜ ត្រូវវាស់ដាច់ពីគ្នា ៖
            //    ជាន់ ១ = `restoreLookupSecretKey()` បដិសេធពេល `appLockShouldArm()`
            //    ជាន់ ២ = កំណត់ត្រាត្រូវលុប **ភ្លាមពេលសោចាក់** (`clearAppUnlockedForSession`)
            //    ⛔ ការសាកតាមផ្លូវ boot តែម្យ៉ាង **មិនអាចញែកជាន់ ១ បានទេ** —
            //    វាស់បាន ៖ ជាន់ ២ លុបកំណត់ត្រាមុនការស្តាររត់ ➜ mutation ដែល
            //    ដកជាន់ ១ ចេញ **រស់រាន**។ ដូច្នេះជាន់ ១ ត្រូវវាស់ **ដោយផ្ទាល់
            //    គ្មានការប្រណាំង** ៖ ដាក់ប្រព័ន្ធក្នុងស្ថានភាព «សោគួរចាក់ ហើយ
            //    កំណត់ត្រានៅមាន» រួចហៅការស្តារដោយផ្ទាល់។
            const gate = await page.evaluate(async () => {
                sessionStorage.removeItem('zoew_app_unlocked');
                lookupSecretKey = null;
                const armed = typeof appLockShouldArm === 'function' ? appLockShouldArm() : null;
                const restored = await restoreLookupSecretKey();
                return { armed: armed, restored: restored, secret: !!lookupSecretKey };
            });
            check(gate.armed === true,
                'លក្ខខណ្ឌចាំបាច់ ៖ ស្ថានភាព «សោគួរចាក់» ពិត ខណៈកំណត់ត្រានៅមាន', gate);
            check(gate.restored === false && gate.secret === false,
                '⛔⛔ ជាន់ ១ ៖ សោគួរចាក់ ➜ ការស្តារត្រូវ **បដិសេធ** ទោះកំណត់ត្រានៅមាន', gate);

            await withTimeout(load(), 30000, 'reload-new-session');
            await settle();
            const sNew = await state();
            check(sNew.bodyLocked && sNew.lockShown,
                'លក្ខខណ្ឌចាំបាច់ ៖ វគ្គថ្មី ➜ App Lock ចាក់សោវិញ', sNew);
            const newSession = await readLock();
            check(newSession.secret !== true && newSession.ztoLocked !== false,
                '⛔⛔ វគ្គថ្មី (App Lock ចាក់សោ) ➜ សោ **មិនត្រូវស្តារ** — បើស្តារ នោះការចាក់សោត្រូវរំលងទាំងស្រុង', newSession);
            check((await readStored()) === 'gone',
                '⛔ ជាន់ ២ ៖ សោចាក់ពេល boot ➜ កំណត់ត្រាត្រូវ **លុបភ្លាម** (មិនរស់ក្រោមសោ)');

            await typePin(PIN);
            await page.waitForTimeout(300);
            check((await readStored()) === 'PRESENT',
                'លក្ខខណ្ឌចាំបាច់ ៖ ដោះសោវិញ ➜ សោត្រូវរក្សាទុកម្តងទៀត');
            await page.evaluate(() => {
                if (typeof clearAppUnlockedForSession === 'function') clearAppUnlockedForSession();
            });
            await page.waitForTimeout(400);
            check((await readStored()) === 'gone',
                '⛔ ការចាក់សោពិត / ចាកចេញ ➜ សោដែលរក្សាទុក ត្រូវ **លុបចោល**');

            // ⛔ កំណត់ត្រាដែល **ខូច ឬត្រូវពុល** មិនត្រូវក្លាយជាសោ — `lookupSecretKey`
            //    ដែលមិនមែន CryptoKey ធ្វើឲ្យ `decryptLookupSecret()` បោះ ➜ ផ្លូវ
            //    Lookup ស្លាប់ស្ងាត់ៗ ខណៈ `ztoStatusSecretIsLocked()` រាយថា «ដោះរួច»។
            const poisoned = await page.evaluate(async () => {
                sessionStorage.setItem('zoew_app_unlocked', '1');
                lookupSecretKey = null;
                await new Promise((resolve) => {
                    let done = false;
                    const fin = () => { if (!done) { done = true; resolve(); } };
                    setTimeout(fin, 2000);
                    try {
                        const req = indexedDB.open('zoew_lookup_key_v1', 1);
                        req.onsuccess = () => {
                            try {
                                const tx = req.result.transaction('k', 'readwrite');
                                tx.objectStore('k').put({ type: 'not-a-key', raw: 'AAAA' }, 'lookupSecretKey');
                                tx.oncomplete = fin;
                                tx.onerror = fin;
                            } catch (e) { fin(); }
                        };
                        req.onerror = fin;
                    } catch (e) { fin(); }
                });
                const restored = await restoreLookupSecretKey();
                return { restored: restored, secret: !!lookupSecretKey };
            });
            check(poisoned.restored === false && poisoned.secret === false,
                '⛔ កំណត់ត្រាខូច/ត្រូវពុល ➜ ការស្តារត្រូវ **បដិសេធ** មិនយកវាធ្វើជាសោ', poisoned);
        });

        // ⛔⛔ ជាន់ **ឥរិយាបថ** នៃច្បាប់ «កុងតាក់ត្រូវមានទិសបិទ» (ផ្នែក ១ខ)។
        // ជាន់ស្តាទិចចាក់សោ *ស្នាមភ្ជាប់*; ជាន់នេះចាក់សោ **អ្វីដែលអ្នកប្រើ
        // ធ្វើពិត** ៖ បើកម៉ឺនុយ ➜ ចុចកុងតាក់ ➜ វាយ PIN ➜ បិទបើក App។
        const lockToggleState = () => page.evaluate(() => {
            const btn = document.getElementById('appLockToggleBtn');
            const st = document.getElementById('appLockToggleState');
            const modal = document.getElementById('pinModal');
            return {
                label: st ? String(st.textContent || '').trim() : 'missing',
                isOn: !!btn && btn.classList.contains('is-on'),
                pinHash: !!localStorage.getItem('zoew_security_pin_hash'),
                loginTime: localStorage.getItem('zoew_login_time'),
                email: localStorage.getItem('remembered_email'),
                signOuts: window.__signOutCalls,
                pinModalOpen: !!modal && getComputedStyle(modal).display !== 'none',
                prompt: String((document.getElementById('pinModalDesc') || {}).textContent || '')
            };
        });

        // ⛔ ការចុចត្រូវឆ្លងកាត់ **ធាតុពិតក្នុងម៉ឺនុយ** ៖ ធាតុដែលមើលមិនឃើញ
        // តែចុចបានតាមកូដ ជាការវាស់អ្វីផ្សេង។ ដូច្នេះវាស់ធរណីមាត្រជាមុន។
        const tapLockToggle = async () => {
            const geo = await page.evaluate(() => {
                if (typeof openSideDrawer === 'function') openSideDrawer();
                const group = document.getElementById('drawerGroupLock');
                if (group && !group.classList.contains('is-open')) {
                    const head = document.getElementById('drawerGroupHeadLock');
                    if (head) head.click();
                }
                return null;
            });
            await page.waitForTimeout(500);
            const box = await page.evaluate(() => {
                const btn = document.getElementById('appLockToggleBtn');
                if (!btn) return null;
                const r = btn.getBoundingClientRect();
                const cs = getComputedStyle(btn);
                return { w: r.width, h: r.height, vis: cs.visibility, disp: cs.display };
            });
            check(!!box && box.w > 0 && box.h > 0 && box.vis === 'visible' && box.disp !== 'none',
                'កុងតាក់ «ចាក់សោពេលបើក App» មើលឃើញពិត និងចុចបានក្នុងម៉ឺនុយ', box || geo);
            await page.evaluate(() => {
                const btn = document.getElementById('appLockToggleBtn');
                if (btn) btn.click();
            });
            await page.waitForTimeout(600);
        };

        const answerPin = async (pin) => {
            const opened = await page.evaluate(() => {
                const m = document.getElementById('pinModal');
                return !!m && getComputedStyle(m).display !== 'none';
            });
            if (!opened) return false;
            await page.evaluate((p) => {
                const i = document.getElementById('securityPinInput');
                if (i) i.value = p;
                const b = document.getElementById('pinConfirmBtn');
                if (b) b.click();
            }, pin);
            // PBKDF2 ១៥០,០០០ ជុំ + ការ derive សោ ➜ រង់ចាំតាម **ស្ថានភាព**
            // មិនមែនតាមលេខថេរ។
            for (let i = 0; i < 40; i++) {
                await page.waitForTimeout(200);
                const still = await page.evaluate(() => {
                    const m = document.getElementById('pinModal');
                    return !!m && getComputedStyle(m).display !== 'none';
                });
                if (!still) break;
            }
            await page.waitForTimeout(400);
            return true;
        };

        const freshSession = async () => {
            await page.evaluate(() => { sessionStorage.clear(); });
            await withTimeout(load(), 30000, 'reload-fresh-session');
            await settle();
            return state();
        };

        await group('២១. ⛔⛔ កុងតាក់ «ចាក់សោពេលបើក App» ត្រូវ **បិទបាន**', async () => {
            await unlockFresh();
            const before = await lockToggleState();
            check(before.label === 'បើក' && before.isOn === true,
                'លក្ខខណ្ឌចាំបាច់ ៖ មាន PIN ➜ កុងតាក់រាយ «បើក» (លំនាំដើម)', before);

            await tapLockToggle();
            const asked = await lockToggleState();
            check(asked.pinModalOpen === true,
                '⛔ ការចុចបិទ ➜ សុំ PIN (ការបិទសោគឺការបន្ថយសុវត្ថិភាព)', asked);
            check(/បិទ/.test(asked.prompt),
                '⛔ សារប្រអប់ PIN ប្រាប់ថានឹង **បិទ** — មិនមែន «បើក» (សារកុហក ➜ អ្នកប្រើចុចខុស)', asked.prompt);

            const answered = await answerPin(PIN);
            check(answered, 'ប្រអប់ PIN ទទួលចម្លើយ');
            const after = await lockToggleState();
            check(after.label === 'បិទ' && after.isOn === false,
                '⛔⛔ ក្រោយវាយ PIN ➜ កុងតាក់រាយ «បិទ» ពិត (របាយការណ៍អ្នកប្រើ ៖ «ចុចបិទអត់បាន»)', after);
            check(after.pinHash === true,
                '⛔ ការបិទសោ **មិនលុប Security PIN** — PIN នោះការពារ Config · Lookup API · លុបទាំងអស់', after);
            check(after.loginTime === before.loginTime && after.email === before.email && after.signOuts === before.signOuts,
                '⛔ ការបិទសោ **មិនប៉ះ session ៤ ម៉ោង** និងមិនចាកចេញពីប្រព័ន្ធ', after);
        });

        await group('២១ខ. ⛔ ការបិទត្រូវ **រស់រានការបិទបើក App** (វគ្គថ្មី)', async () => {
            const s = await freshSession();
            check(!s.bodyLocked && !s.lockShown,
                '⛔⛔ បិទរួច ➜ បើក App ជាវគ្គថ្មី **មិនត្រូវសុំ PIN ទៀត**', s);
            check(s.pages === 'visible', 'បិទរួច ➜ ទំព័រមើលឃើញធម្មតា', s);
            const t = await lockToggleState();
            check(t.label === 'បិទ' && t.isOn === false,
                'ស្លាកកុងតាក់នៅ «បិទ» ក្រោយផ្ទុកឡើងវិញ (ការជ្រើសរស់ក្នុង localStorage)', t);
        });

        await group('២១គ. ⛔ ខណៈបិទ ➜ ការចាកចេញ **មិនបាំងអេក្រង់** (ទិសផ្ទុយ)', async () => {
            await leaveApp();
            const s = await state();
            check(!s.bodyLocked && !s.lockShown,
                '⛔ សោបិទ ➜ ការទៅ task switcher មិនត្រូវបាំង App (បើបាំង ➜ កុងតាក់បិទត្រឹមពាក់កណ្តាល)', s);
            await returnToApp();
            const back = await state();
            check(!back.bodyLocked && !back.lockShown,
                '⛔ សោបិទ ➜ ការត្រឡប់មកវិញក៏មិនចាក់សោដែរ', back);
        });

        await group('២១ឃ. ⛔ បើកវិញបាន ➜ វគ្គថ្មីចាក់សោដដែល (ទិសផ្ទុយ)', async () => {
            await tapLockToggle();
            const asked = await lockToggleState();
            check(asked.pinModalOpen === true, 'ការចុចបើកវិញ ➜ សុំ PIN', asked);
            check(/បើក/.test(asked.prompt),
                'សារប្រអប់ PIN ប្រាប់ថានឹង **បើក**', asked.prompt);
            await answerPin(PIN);
            const on = await lockToggleState();
            check(on.label === 'បើក' && on.isOn === true, 'កុងតាក់ត្រឡប់ទៅ «បើក»', on);
            const s = await freshSession();
            check(s.bodyLocked && s.lockShown,
                '⛔⛔ បើកវិញ ➜ វគ្គថ្មី **ចាក់សោពិត** (បើអត់ ➜ កុងតាក់បើកត្រឹមស្លាក)', s);
            check(s.pages === 'hidden', 'បើកវិញ ➜ ទំព័រលាក់ក្រោមសោដដែល', s);
        });

        await group('២១ង. ⛔ PIN ខុស ➜ សោ **មិនត្រូវបិទ**', async () => {
            await typePin(PIN);
            const unlocked = await state();
            check(!unlocked.bodyLocked, 'លក្ខខណ្ឌចាំបាច់ ៖ ដោះសោដើម្បីឈានដល់ម៉ឺនុយ', unlocked);
            await tapLockToggle();
            await answerPin(WRONG);
            const s = await lockToggleState();
            check(s.label === 'បើក' && s.isOn === true,
                '⛔ PIN ខុស ➜ សោនៅ «បើក» ដដែល (បើបិទ ➜ អ្នកដទៃបិទសោបានដោយមិនដឹង PIN)', s);
            const fresh = await freshSession();
            check(fresh.bodyLocked && fresh.lockShown,
                '⛔ PIN ខុស ➜ វគ្គថ្មីនៅតែចាក់សោ', fresh);
        });
    } catch (e) {
        bad('ផ្នែក browser បោះកំហុស', String(e && e.message ? e.message : e));
    }

    await browser.close();
    server.close();

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().then(() => {}, (e) => {
    console.log('  FAIL   ' + (e && e.message ? e.message : e));
    console.log('\n❌ ធ្លាក់ ' + (fail + 1));
    process.exit(1);
});
