const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PERIODICGUARD_APP_DIR || path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
let pass = 0;
let fail = 0;

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
