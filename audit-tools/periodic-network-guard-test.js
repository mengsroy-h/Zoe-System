const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PERIODICGUARD_APP_DIR || path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
let pass = 0;
let fail = 0;
// ⛔ ការចេញដោយ **event loop ស្ងួត** (ឧ. `await` លើ promise ដែលគ្មានអ្នកដោះ)
// ធ្វើឲ្យ node ចេញ **exit 0** ខណៈការអះអាងពាក់កណ្តាល **មិនដែលរត់សោះ** ➜
// `run-all.sh` រាយ PASS។ ដូច្នេះ exit code ចាប់ផ្តើមជា **១** ហើយមានតែបន្ទាត់
// សង្ខេបនៅចុងឯកសារទេដែលអាចបន្ទាបវា — ការធានាដោយ **រចនាសម្ព័ន្ធ**។
process.exitCode = 1;

function ok(label, condition, detail) {
    if (condition) {
        pass++;
        console.log('   ok    ' + label);
    } else {
        fail++;
        console.log('   FAIL  ' + label + (detail === undefined ? '' : '\n         ' + JSON.stringify(detail)));
    }
}

function sliceFn(name) {
    let start = source.indexOf('function ' + name + '(');
    if (start === -1) return '';
    if (source.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0;
    let began = false;
    let end = source.indexOf('{', start);
    for (; end < source.length; end++) {
        if (source[end] === '{') { depth++; began = true; }
        else if (source[end] === '}') {
            depth--;
            if (began && depth === 0) return source.slice(start, end + 1);
        }
    }
    return '';
}

(async () => {
    const sessionFn = sliceFn('runSessionExpiryCheck');
    const licenseFn = sliceFn('runPeriodicLicenseCheck');
    ok('មាន guard សម្រាប់ការពិនិត្យ Session ជាប្រចាំ', !!sessionFn);
    ok('មាន guard សម្រាប់ការពិនិត្យ License ជាប្រចាំ', !!licenseFn);
    ok('ការអាន Firebase token មាន timeout', /withTimeout\(\s*fb\.getIdTokenResult\(/.test(sliceFn('isFirebaseSessionExpired')));
    ok('setInterval ហៅ helper ដែលមាន guard',
        /setInterval\(runSessionExpiryCheck,\s*60000\)/.test(source)
        && /setInterval\(runPeriodicLicenseCheck,\s*LICENSE_RECHECK_INTERVAL_MS\)/.test(source));

    if (sessionFn && licenseFn) {
        let resolveSession;
        let resolveLicense;
        const counts = { session: 0, license: 0, expired: 0, captured: 0 };
        const context = vm.createContext({
            Promise,
            auth: { currentUser: { uid: 'u1' } },
            isModalOpen: false,
            isDatabaseInitialized: true,
            withTimeout: (promise) => promise,
            isFirebaseSessionExpired: () => {
                counts.session++;
                return new Promise((resolve) => { resolveSession = resolve; });
            },
            forceExpireSession: () => { counts.expired++; },
            ensureAppActivated: () => {
                counts.license++;
                return new Promise((resolve) => { resolveLicense = resolve; });
            },
            window: { ZoeErrors: { capture: () => { counts.captured++; } } },
            ZoeErrors: { capture: () => { counts.captured++; } }
        });
        vm.runInContext('let sessionExpiryCheckInFlight = false; let licenseRecheckInFlight = false; let sessionExpiryCheck = "live";\n'
            + sessionFn + '\n' + licenseFn
            + '\nthis.sessionCheck = runSessionExpiryCheck; this.licenseCheck = runPeriodicLicenseCheck;', context);

        const firstSession = context.sessionCheck();
        const secondSession = context.sessionCheck();
        ok('Session interval ២ ជាន់គ្នា ➜ បាញ់ Firebase តែមួយសំណើ', counts.session === 1, counts);
        resolveSession(false);
        await Promise.all([firstSession, secondSession]);
        const thirdSession = context.sessionCheck();
        ok('Session guard ដោះសោវិញក្រោយសំណើចប់', counts.session === 2, counts);
        resolveSession(false);
        await thirdSession;

        // ══════════════════════════════════════════════════════════════
        // ⛔ ច្រកទ្វារ `sessionExpiryCheck === 'pending'` ជា **អន្ទាក់ស្ថាពរ**
        //    បើគ្មាននរណា settle វា ៖ `runSessionExpiryCheck()` មានអ្នកហៅ
        //    **តែមួយ** គឺ `setInterval(…, 60000)` ➜ ទង់ជាប់ `'pending'` =
        //    ច្បាប់ ៤ ម៉ោង **ងាប់ពេញអាយុទំព័រ**។
        //
        //    លំដាប់ពិត ៖ ឧបករណ៍ថ្មី ➜ `proceedAfterLogin()` ➜
        //    `ensureAppActivated()` ត្រឡប់ `false` ➜ **`return` មុនបន្ទាត់
        //    arming** ➜ ទង់នៅតម្លៃដើម `'pending'` ➜ អ្នកប្រើវាយ Activation Key
        //    ➜ `submitActivationKey()` ហៅ `initDatabaseListeners()` **ដោយផ្ទាល់**
        //    ➜ App ប្រើបាន ១០០% ខណៈទង់នៅ `'pending'` ជារៀងរហូត។
        //
        //    ⛔ sandbox ខាងលើចាក់ `sessionExpiryCheck = "live"` ➜ ស្ថានភាព
        //    `'pending'` **មិនដែលត្រូវវាស់សោះ** ➜ ថ្នាក់នេះមើលមិនឃើញ។
        // ══════════════════════════════════════════════════════════════
        const activateFn = sliceFn('submitActivationKey');
        ok('⛔ ជាន់អប្បបរមា ៖ ស្រង់ `submitActivationKey()` ពិតបាន', !!activateFn);
        if (activateFn) {
            const armCounts = { session: 0, listeners: 0, expired: 0, toast: 0 };
            let resolveArmSession = null;
            const armCtx = vm.createContext({
                Promise, console,
                authGeneration: 7,
                auth: { currentUser: { uid: 'u1' } },
                isModalOpen: false,
                withTimeout: (promise) => promise,
                ZoeLicense: { activate: () => Promise.resolve({ valid: true }) },
                LICENSE_APP_CODE: 'ADM',
                ensureAppActivated: () => Promise.resolve(true),
                initDatabaseListeners: () => { armCounts.listeners++; return true; },
                isFirebaseSessionExpired: () => {
                    armCounts.session++;
                    return new Promise((resolve) => { resolveArmSession = resolve; });
                },
                forceExpireSession: () => { armCounts.expired++; },
                refreshLiveToasts: () => {},
                showToast: () => { armCounts.toast++; },
                updateAuthButton: () => {},
                safeFocusScanner: () => {},
                licenseFailureMessage: () => 'x',
                document: { getElementById: () => ({ value: 'KEY-1', disabled: false, textContent: '', focus: () => {} }) },
                window: { ZoeErrors: { capture: () => {} } },
                ZoeErrors: { capture: () => {} }
            });
            // ⛔ ទង់ចាប់ផ្តើមជា `'pending'` — **តម្លៃដើមពិតរបស់ `app.js`**
            vm.runInContext('let sessionExpiryCheckInFlight = false; let isDatabaseInitialized = false;'
                + ' let sessionExpiryCheck = "pending";\n'
                + sessionFn + '\n' + activateFn + '\n'
                + (sliceFn('armSessionExpiryCheck') || '')
                + '\nthis.sessionCheck = runSessionExpiryCheck;'
                + ' this.activate = submitActivationKey;'
                + ' this.flag = () => sessionExpiryCheck;', armCtx);

            // probe ទិសផ្ទុយ ៖ ខណៈ `'pending'` ច្រកទ្វារ **ត្រូវ** ទប់ (ការរចនា)
            await armCtx.sessionCheck();
            ok('⛔ ទិសផ្ទុយ ៖ ខណៈ `pending` ច្រកទ្វារទប់ការពិនិត្យ (ការរចនា)',
                armCounts.session === 0, armCounts);

            await armCtx.activate();
            ok('⛔ ជាន់អប្បបរមា ៖ ផ្លូវ Activate ឈានដល់ `initDatabaseListeners()` ពិត',
                armCounts.listeners === 1, armCounts);
            ok('⛔ ការ Activate ជោគជ័យត្រូវ **arm** ច្រកទ្វារវគ្គ (បើអត់ ➜ ច្បាប់ ៤ ម៉ោង ងាប់ពេញអាយុទំព័រ)',
                armCounts.session === 1, armCounts);
            if (resolveArmSession) resolveArmSession(false);
            await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
            ok('⛔ ក្រោយ arm ចប់ ទង់ត្រូវ settle ចេញពី `pending`',
                armCtx.flag() !== 'pending', armCtx.flag());
            const before = armCounts.session;
            // ⛔ `isFirebaseSessionExpired` របស់ sandbox ត្រឡប់ promise ដែល
            // **តេស្តជាអ្នកដោះ** ➜ `await` ដោយមិនដោះ = ព្យួរ ➜ event loop ស្ងួត
            // ➜ node ចេញ **exit 0 ដោយស្ងាត់** ហើយការអះអាងខាងក្រោមមិនដែលរត់។
            const againCheck = armCtx.sessionCheck();
            ok('⛔ វដ្ត ៦០ វិ. ត្រូវរត់បានវិញក្រោយ Activate',
                armCounts.session === before + 1, armCounts);
            if (resolveArmSession) resolveArmSession(false);
            await againCheck;
        }

        const firstLicense = context.licenseCheck();
        const secondLicense = context.licenseCheck();
        ok('License interval ២ ជាន់គ្នា ➜ បាញ់ Server តែមួយសំណើ', counts.license === 1, counts);
        resolveLicense(true);
        await Promise.all([firstLicense, secondLicense]);
        const thirdLicense = context.licenseCheck();
        ok('License guard ដោះសោវិញក្រោយសំណើចប់', counts.license === 2, counts);
        resolveLicense(true);
        await thirdLicense;
    }

    console.log('\n' + (fail ? 'FAIL ' + fail + '/' + (pass + fail) : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})().catch((error) => {
    console.error(error && error.stack || error);
    process.exit(1);
});
