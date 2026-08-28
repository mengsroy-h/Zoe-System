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

const appJs = readOr(path.join(APP, 'app.js'), 'ZoeW/app.js');
const html = readOr(path.join(APP, 'index.html'), 'ZoeW/index.html');
const css = readOr(path.join(APP, 'style.css'), 'ZoeW/style.css');

console.log('\n=== ១. រចនាសម្ព័ន្ធ ៖ សោត្រូវចាក់ពិត និងដោះបានពិត ===');

check(html.indexOf('id="appLockScreen"') !== -1, 'index.html មានអេក្រង់ចាក់សោ');
check(/data-act="submitAppLockForm"/.test(html), 'ទម្រង់ដោះសោភ្ជាប់ទៅ submitAppLockForm (Enter ដំណើរការ)');
check(/data-act="runAppLockBiometric"/.test(html), 'មានប៊ូតុងស្កេនក្រយៅដៃ/មុខលើអេក្រង់ចាក់សោ');
check(/data-act="forgetAppLockPin"/.test(html), 'មានផ្លូវចេញ «ភ្លេច PIN?» — សោមិនត្រូវក្លាយជាអន្ទាក់');

const initFn = sliceFn(appJs, 'initAppLock');
check(initFn !== '', 'មាន initAppLock() ក្នុង app.js');
check(/^\s{4}initAppLock\(\);\s*$/m.test(appJs),
    'initAppLock() ត្រូវហៅនៅ top level (មុន Firebase និងមុនការគូរទិន្នន័យ)');

const armFn = sliceFn(appJs, 'appLockShouldArm');
check(/appLockPinIsSet\(\)\s*&&\s*!appLockUnlockedThisSession\(\)/.test(armFn),
    'សោចាក់តែពេល **មាន PIN** ហើយ **មិនទាន់ដោះក្នុងវគ្គនេះ**', armFn);

const sessionFn = sliceFn(appJs, 'appLockUnlockedThisSession');
check(/sessionStorage\.getItem\(APP_LOCK_SESSION_KEY\)/.test(sessionFn),
    '⛔ ទង់ដោះសោរស់នៅ sessionStorage (ការផ្ទុកឡើងវិញ ➜ មិនចាក់សោ; បិទបើក App ➜ ចាក់សោ)', sessionFn);

const logoutFn = sliceFn(appJs, 'logoutApp');
check(/clearAppUnlockedForSession\(\)/.test(logoutFn),
    'ចាកចេញ ➜ លុបទង់ដោះសោ (ការចូលបន្ទាប់ត្រូវឆ្លងសោម្តងទៀត)', logoutFn);

const focusFn = sliceFn(appJs, 'safeFocusScanner');
check(/if \(appIsLocked\) return;/.test(focusFn),
    '⛔ ខណៈចាក់សោ ➜ ម៉ាស៊ីនស្កេន hardware មិនដណ្តើមយក focus ពីប្រអប់ PIN', focusFn);

check(/function pullTargetBlocked\(target\) \{\s*\n\s*if \(appIsLocked \|\|/.test(appJs),
    '⛔ ខណៈចាក់សោ ➜ PTR មិនកេះ (កុំឲ្យទាញចុះក្រោមសោ)');

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
check(/body\.app-locked[\s\S]{0,220}?visibility:\s*hidden/.test(css),
    'CSS ៖ ខណៈចាក់សោ ➜ navbar · ទំព័រ · របា Tab ត្រូវលាក់ពិត');

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
            msg: (document.getElementById('appLockMsg') || {}).textContent || ''
        };
    });
    const hashPinIn = (pin) => page.evaluate(async (p) => {
        const enc = new TextEncoder();
        const km = await crypto.subtle.importKey('raw', enc.encode(p), { name: 'PBKDF2' }, false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('zoeadmin_pin_verify_v2'), iterations: 150000, hash: 'SHA-256' }, km, 256);
        return 'pbkdf2:' + Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }, pin);
    const typePin = async (pin) => {
        await page.fill('#appLockPinInput', pin, { timeout: 6000 });
        await page.click('#appLockSubmitBtn', { timeout: 6000 });
        await page.waitForTimeout(900);
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

        let hash = '';
        await group('៣. មាន PIN + វគ្គថ្មី ➜ **ចាក់សោ** ហើយទិន្នន័យលាក់ពិត', async () => {
            hash = await hashPinIn(PIN);
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
