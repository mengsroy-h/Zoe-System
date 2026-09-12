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

const AUTH_DATABASE_GUARD = sliceFn('captureAuthDatabaseGuard') || 'function captureAuthDatabaseGuard() { return () => true; }';

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
                db: {},
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
                + '\n' + AUTH_DATABASE_GUARD
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

    // សំណើចាស់អាចមកដល់ក្រោយចាកចេញ ឬប្ដូរ database។ ប្រើ helper ដែលកែ DOM
    // ពិត រួមនឹង withTimeout ពិត ដើម្បីកុំឱ្យ stub លាក់ស្នាមភ្ជាប់នេះ។
    const activationNames = ['ensureAppActivated', 'submitActivationKey', 'runPeriodicLicenseCheck', 'withTimeout'];
    const activationFunctions = activationNames.map((name) => {
        const found = sliceFn(name);
        ok('ស្រង់ផ្លូវវគ្គ Activation ពិត ៖ ' + name, !!found);
        return found || 'async function ' + name + '() { return false; }';
    }).join('\n') + '\n' + AUTH_DATABASE_GUARD;
    const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
    function activationContext() {
        const effects = [];
        const reads = [];
        const activations = [];
        const timers = new Map();
        let timerId = 0;
        const elements = new Map();
        const element = (id) => {
            if (!elements.has(id)) elements.set(id, {
                value: id === 'activationKeyInput' ? 'KEY-1' : '', disabled: false, textContent: '',
                focus() { effects.push('focus:' + id); }
            });
            return elements.get(id);
        };
        const deferred = (entries) => new Promise((resolve, reject) => entries.push({ resolve, reject }));
        const context = vm.createContext({
            Promise, Error, console: { error() {} },
            authGeneration: 7, auth: { currentUser: { uid: 'u1' } }, db: {},
            LICENSE_APP_CODE: 'ADM', isDatabaseInitialized: true, isModalOpen: false,
            ZoeLicense: {
                getStatus: () => deferred(reads),
                activate: () => deferred(activations)
            },
            setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
            clearTimeout: (id) => timers.delete(id),
            document: { getElementById: element },
            licenseFailureMessage: (reason) => 'សិទ្ធិ៖' + reason,
            closeModal: (id) => effects.push('close:' + id),
            openModalHelper: (id) => effects.push('open:' + id),
            showToast: (message) => effects.push('toast:' + message),
            updateAuthButton: () => effects.push('auth'),
            safeFocusScanner: () => effects.push('scanner'),
            armSessionExpiryCheck: () => effects.push('arm'),
            initDatabaseListeners: () => { effects.push('listeners'); return true; },
            window: { ZoeErrors: null },
            ZoeErrors: { capture: () => effects.push('error') }
        });
        vm.runInContext('let licenseRecheckInFlight = false;\n' + activationFunctions, context);
        return { context, effects, reads, activations, timers, element };
    }
    const changes = {
        'ជំនាន់ auth': (c) => { c.authGeneration++; },
        'database': (c) => { c.db = {}; },
        'អ្នកប្រើ': (c) => { c.auth.currentUser = { uid: 'u2' }; },
        'អង្គភាព auth': (c) => { c.auth = { currentUser: c.auth.currentUser }; },
        'ចាកចេញ': (c) => { c.authGeneration++; c.auth.currentUser = null; }
    };
    let pendingReached = 0;
    for (const surface of ['ផ្ទៀងផ្ទាត់', 'កាលកំណត់', 'Activate ដំណាក់ទី១', 'Activate ដំណាក់ទី២']) {
        for (const active of [true, false]) {
            for (const change of [null, ...Object.keys(changes)]) {
                const h = activationContext();
                const c = h.context;
                c.isDatabaseInitialized = surface === 'កាលកំណត់';
                let pending;
                if (surface === 'ផ្ទៀងផ្ទាត់') pending = c.ensureAppActivated();
                else if (surface === 'កាលកំណត់') pending = c.runPeriodicLicenseCheck();
                else pending = c.submitActivationKey();
                await tick();
                if (surface === 'Activate ដំណាក់ទី២') {
                    if (h.activations[0]) h.activations[0].resolve({ valid: true });
                    await tick();
                }
                const request = surface === 'Activate ដំណាក់ទី១' ? h.activations[0] : h.reads[0];
                if (request) pendingReached++;
                if (change) changes[change](c);
                h.element('activationKeyInput').value = 'KEY-NEW';
                h.effects.length = 0;
                if (request) request.resolve(surface === 'Activate ដំណាក់ទី១'
                    ? { valid: active, reason: 'revoked' }
                    : { state: active ? 'active' : 'inactive', reason: 'revoked' });
                await tick();
                if (surface === 'Activate ដំណាក់ទី១' && h.reads[0]) {
                    h.reads[0].resolve({ state: 'active' });
                }
                await pending;
                const label = surface + ' · ' + (active ? 'ទទួលយក' : 'បដិសេធ') + ' · ' + (change || 'វគ្គដដែល');
                if (change) {
                    ok('លទ្ធផលចាស់មិនកែ UI/arm/listener ៖ ' + label,
                        h.effects.length === 0 && h.element('activationKeyInput').value === 'KEY-NEW'
                        && (surface !== 'Activate ដំណាក់ទី១' || h.reads.length === 0),
                        { effects: h.effects, input: h.element('activationKeyInput').value, reads: h.reads.length });
                } else {
                    ok('ទិសផ្ទុយ៖ វគ្គដដែលនៅបង្ហាញសាលក្រម ៖ ' + label, h.effects.length > 0, h.effects);
                }
            }
        }
    }
    ok('ជាន់អប្បបរមា៖ គ្រប់លំដាប់ Activation ឈានដល់ promise ព្យួរពិត', pendingReached === 48, pendingReached);

    for (const stage of ['activate', 'status']) {
        const h = activationContext();
        const pending = h.context.submitActivationKey();
        await tick();
        if (stage === 'status') {
            h.activations[0].resolve({ valid: true });
            await tick();
        }
        h.context.authGeneration++;
        h.effects.length = 0;
        const request = stage === 'activate' ? h.activations[0] : h.reads[0];
        if (request) request.reject(new Error('ដាច់បណ្តាញ'));
        await pending;
        ok('ការបដិសេធចាស់មិនបង្ហាញសារក្នុងវគ្គថ្មី ៖ ' + stage, h.effects.length === 0, h.effects);
    }

    {
        const h = activationContext();
        const pending = h.context.runPeriodicLicenseCheck();
        const timeout = [...h.timers.values()].find((entry) => entry.ms === 20000);
        ok('ជាន់អប្បបរមា៖ ការពិនិត្យកាលកំណត់ប្រើពិដានពិត', !!timeout);
        if (timeout) timeout.fn();
        await pending;
        h.context.authGeneration++;
        h.effects.length = 0;
        h.reads[0].resolve({ state: 'inactive', reason: 'revoked' });
        await tick();
        ok('status មកក្រោយ timeout និងប្ដូរវគ្គមិនបើក Activation ឡើងវិញ', h.effects.length === 0, h.effects);
    }

    {
        const h = activationContext();
        const old = h.context.submitActivationKey();
        h.context.authGeneration++;
        await h.context.submitActivationKey();
        ok('ប៊ូតុង Activate ចាស់នៅកាន់សោរហូតដល់ដោះ promise', h.activations.length === 1 && h.element('activationSubmitBtn').disabled);
        h.activations[0].resolve({ valid: false });
        await old;
        ok('finally ចាស់ត្រូវដោះប៊ូតុង ដើម្បីវគ្គថ្មីអាចបន្ត', !h.element('activationSubmitBtn').disabled);
        h.element('activationKeyInput').value = 'KEY-NEW';
        const fresh = h.context.submitActivationKey();
        ok('ក្រោយដោះសោ វគ្គថ្មី Activate បានពិត', h.activations.length === 2);
        if (h.activations[1]) h.activations[1].resolve({ valid: false });
        await fresh;
    }

    {
        const h = activationContext();
        const old = h.context.runPeriodicLicenseCheck();
        h.context.authGeneration++;
        await h.context.runPeriodicLicenseCheck();
        ok('សោកាលកំណត់ដែលនៅរស់ទប់វគ្គថ្មី មុនចម្លើយឬពិដាន', h.reads.length === 1);
        const timeout = [...h.timers.values()].find((entry) => entry.ms === 20000);
        if (timeout) timeout.fn();
        await old;
        const fresh = h.context.runPeriodicLicenseCheck();
        ok('ពិដានដោះសោកាលកំណត់សម្រាប់វគ្គថ្មី', h.reads.length === 2);
        h.reads[0].resolve({ state: 'active' });
        await tick();
        await h.context.runPeriodicLicenseCheck();
        ok('ចម្លើយចាស់ក្រោយពិដានមិនដោះសោរបស់សំណើថ្មី', h.reads.length === 2);
        if (h.reads[1]) h.reads[1].resolve({ state: 'active' });
        await fresh;
    }

    console.log('\n' + (fail ? 'FAIL ' + fail + '/' + (pass + fail) : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})().catch((error) => {
    console.error(error && error.stack || error);
    process.exit(1);
});
