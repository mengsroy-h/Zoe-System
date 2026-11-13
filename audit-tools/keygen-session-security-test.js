const fs = require('fs');
const path = require('path');
const vm = require('vm');
process.exitCode = 1;

const root = path.resolve(__dirname, '..');
const appRoot = process.env.KEYGEN_APP_DIR ? path.resolve(process.env.KEYGEN_APP_DIR) : root;
const src = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen/app.js'), 'utf8');

function realLicenseAppCodeDecl(source) {
    const m = source.match(/^const LICENSE_APP_CODE = '[A-Z]+';$/m);
    if (!m) throw new Error('not found: const LICENSE_APP_CODE ក្នុង ZoeKeyGen/app.js');
    return m[0];
}

// ⛔ ថេរកៅអីត្រូវស្រង់ចេញពីកូដ ship ពិត មិនមែនចម្លងមកទីនេះ។
function realDecl(name) {
    const m = src.match(new RegExp('^const ' + name + ' = .*;$', 'm'));
    if (!m) throw new Error('not found: const ' + name + ' ក្នុង ZoeKeyGen/app.js');
    return m[0];
}

function slice(names) {
    return names.map((name) => {
        const plainStart = src.indexOf('function ' + name + '(');
        const asyncStart = src.indexOf('async function ' + name + '(');
        const start = asyncStart !== -1 && (plainStart === -1 || asyncStart < plainStart) ? asyncStart : plainStart;
        if (start === -1) throw new Error('not found: ' + name);
        let depth = 0;
        let i = src.indexOf('{', start);
        let started = false;
        for (; i < src.length; i++) {
            if (src[i] === '{') { depth++; started = true; }
            else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
        }
        return src.slice(start, i);
    }).join('\n\n');
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail === undefined ? '' : '  got: ' + JSON.stringify(detail))); fail++; }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
async function drain(count) {
    for (let i = 0; i < (count || 6); i++) await flush();
}

function build(options) {
    const values = Object.assign({}, options || {});
    const elements = {};
    const getElementById = (id) => {
        if (!elements[id]) {
            const classes = {};
            elements[id] = {
                id,
                value: '',
                textContent: '',
                disabled: false,
                checked: false,
                style: {},
                classList: {
                    add: (name) => { classes[name] = true; },
                    remove: (name) => { delete classes[name]; },
                    toggle: (name, force) => { const enabled = force === undefined ? !classes[name] : force; if (enabled) classes[name] = true; else delete classes[name]; return enabled; },
                    contains: (name) => !!classes[name]
                }
            };
        }
        return elements[id];
    };
    const storage = new Map();
    if (values.sessionRecord) storage.set('zoekeygen_signing_key_enc', values.sessionRecord);
    const log = { alerts: [], toasts: [], updates: 0 };
    const user = { uid: 'admin-1', email: 'admin@example.com' };
    // ថ្ងៃផុតកំណត់លើ Server ៖ Extend សរសេរតាម transaction លើ `expiresAt` (CAS) ➜ fake ផ្ញើតម្លៃថ្មីតាម `fb.update` របស់ scenario (ពេលឆ្លើយ · ព្យួរ · បដិសេធ)
    const keyServer = { 'license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt': 1000, 'license_keys/ADM/BBBBBBBBBBBBBBBB/expiresAt': 1000 };
    const license = {
        getTrustedServerNow: () => 1000, getServerTimeGeneration: () => 1, resetServerTime() {},
        generateKeyPair: () => Promise.resolve({ publicKeyJwk: { kty: 'EC', x: 'pub' }, privateKeyJwk: { kty: 'EC', crv: 'P-256', d: 'private' } }),
        signNewKey: () => Promise.resolve({ keyString: 'signed-key', payload: { id: 'SYNTHETICKEY00001', iat: 1, exp: 2592001 } }),
        verifyKeyString: () => Promise.resolve({ valid: true })
    };
    const sandbox = {
        console,
        Promise,
        Error,
        JSON,
        String,
        Number,
        Object,
        Array,
        Uint8Array,
        TextEncoder,
        TextDecoder,
        Math,
        Date, performance: { now: () => Date.now() },
        setTimeout,
        clearTimeout,
        confirm: () => true,
        alert: (message) => log.alerts.push(message),
        document: {
            getElementById,
            documentElement: getElementById('__documentElement'),
            querySelectorAll: (selector) => selector === '.modal.active' ? Object.values(elements).filter((el) => el.classList.contains('active')) : []
        },
        sessionStorage: {
            getItem: (key) => storage.has(key) ? storage.get(key) : null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: (key) => storage.delete(key)
        },
        crypto: {
            subtle: {
                decrypt: () => Promise.resolve(new TextEncoder().encode(JSON.stringify({ kty: 'EC', crv: 'P-256', d: 'stale', x: 'x', y: 'y' })).buffer)
            }
        },
        fb: {
            ref: (db, pathValue) => ({ db, path: pathValue }),
            update: (ref, value) => {
                log.updates++;
                if (ref && value && typeof value === 'object') Object.keys(value).forEach((k) => { keyServer[ref.path + '/' + k] = value[k]; });
                return Promise.resolve();
            },
            runTransaction: (ref, fn) => {
                const leaf = ref.path.split('/').pop();
                const parent = ref.path.slice(0, -(leaf.length + 1));
                const stored = keyServer[ref.path] === undefined ? null : keyServer[ref.path];
                let next = fn(null);
                if (next === null && stored !== null) next = fn(stored);
                if (next === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => stored } });
                if (next === null) return Promise.resolve({ committed: true, snapshot: { val: () => null } });
                return Promise.resolve(sandbox.fb.update({ db: ref.db, path: parent }, { [leaf]: next }))
                    .then(() => { keyServer[ref.path] = next; return { committed: true, snapshot: { val: () => next } }; });
            }
        },
        URL,
        db: { app: { options: { databaseURL: 'https://kg-probe.firebaseio.com' } } },
        auth: { currentUser: user },
        window: { ZoeLicense: license, ZoeErrors: { capture() {} } },
        ZoeErrors: { capture() { log.captures = (log.captures || 0) + 1; } },
        showToast: (message) => log.toasts.push(message),
        openModalHelper: (id) => getElementById(id).classList.add('active'),
        closeModal: (id) => { log.closed = (log.closed || []).concat(id); getElementById(id).classList.remove('active'); },
        updateSigningKeyBadge() {},
        refreshKeyList() { log.refreshed = (log.refreshed || 0) + 1; },
        waitForServerTimeSync: () => Promise.resolve(true),
        getServerNow: () => 1000,
        retryAsync: (fn) => Promise.resolve().then(fn),
        withTimeout: (promise) => promise,
        __license: license,
        __log: log,
        __elements: elements,
        __storage: storage
    };
    const committedRows = new Map();
    let updateFixture = sandbox.fb.update;
    Object.defineProperty(sandbox.fb, 'update', {
        get: () => (ref, updates) => Promise.resolve(updateFixture(ref, updates)).then((result) => {
            if (ref && updates && typeof updates === 'object') {
                let rows = committedRows.get(ref.db);
                if (!rows) { rows = new Map(); committedRows.set(ref.db, rows); }
                for (const [key, value] of Object.entries(updates)) rows.set([ref.path, key].filter(Boolean).join('/'), value);
            }
            return result;
        }),
        set: (fixture) => { updateFixture = fixture; }
    });
    let fetchFixture = async () => { throw new Error('unexpected request'); };
    Object.defineProperty(sandbox, 'fetch', { configurable: true, get: () => { const fixture = fetchFixture; return (url, init) => {
        if (/\/license_keys\/ZOE\/[A-Z0-9]{16,40}\.json$/.test(String(url)) && (!init || !init.method || init.method === 'GET')) {
            const urlValue = new URL(String(url));
            const database = [...committedRows.keys()].find((db) => db.app.options.databaseURL === urlValue.origin);
            const row = database && committedRows.get(database).get(urlValue.pathname.slice(1, -5));
            return Promise.resolve({ ok: true, status: 200, json: async () => row || ({ maxDevices: 1, revoked: false, expiresAt: 1000 }) });
        }
        return fixture(url, init);
    }; }, set: (value) => { fetchFixture = value; } });
    const ctx = vm.createContext(sandbox);
    // ⛔ កំណែ 2.22.5 ៖ កូដ ship ចូលប្រើ storage តាម shim `appLocalStore` /
    // `appSessionStore` (អាន `window.localStorage` ក្នុង `try` តែម្តង ព្រោះ
    // **getter ខ្លួនវាបោះ** ពេល browser បិទ site data)។
    vm.runInContext('var appLocalStore = typeof localStorage !== "undefined" ? localStorage : null;'
        + ' var appSessionStore = typeof sessionStorage !== "undefined" ? sessionStorage : null;', ctx);
    vm.runInContext(realLicenseAppCodeDecl(src), ctx);
    vm.runInContext([realDecl('LICENSE_SEAT_SLOT_NAMES'), realDecl('LICENSE_SEAT_MAX')].join('\n'), ctx);
    // ⛔ ថេរ/function ថ្មីរបស់ផ្លូវ «ព្យួរ ➜ ⏳» ៖ អវត្តមាន (កូដមុនកែ) ➜ stub ដែលធ្វើឲ្យការអះអាងខាងក្រោម **ធ្លាក់ដោយមានឈ្មោះ** មិនមែនគាំង
    const pendingDecl = (src.match(/^const ADMIN_WRITE_PENDING_TEXT = .*;$/m) || [])[0];
    vm.runInContext(pendingDecl || "const ADMIN_WRITE_PENDING_TEXT = '(អវត្តមាន)';", ctx);
    const releasePendingDecl = (src.match(/^const RELEASE_PENDING_TEXT = .*;$/m) || [])[0];
    vm.runInContext(releasePendingDecl || "const RELEASE_PENDING_TEXT = '(អវត្តមាន RELEASE_PENDING_TEXT)';", ctx);
    if (src.indexOf('function armAdminLateWrite(') === -1) vm.runInContext('function armAdminLateWrite() {}', ctx);
    vm.runInContext(`
        var sensitiveSessionGeneration = 0;
        var authGeneration = 7;
        var isSignedInUiActive = true;
        var signingPrivateKeyJwk = ${values.privateKey ? JSON.stringify(values.privateKey) : 'null'};
        var signingKeySessionKey = {};
        var keypairPrivateCopied = false;
        var isGeneratingKey = false;
        var keyListSessionGeneration = 0;
        var lastGeneratedKey = '';
        var extendTargetId = 'AAAAAAAAAAAAAAAA';
        var keyListCache = [{ id: 'AAAAAAAAAAAAAAAA', paths: ['ADM'], perApp: { ADM: { expiresAt: 1000 } }, expiresAt: 1000, revoked: false, maxDevices: 1, seatDevices: [{ device: 'device-1', at: 1 }] }, { id: 'BBBBBBBBBBBBBBBB', paths: ['ADM'], perApp: { ADM: { expiresAt: 1000 } }, expiresAt: 1000, revoked: false, maxDevices: 1, seatDevices: [] }];
        var seatReadFailed = false;
        var serverTimeSynced = true;
        var SIGNING_KEY_SESSION_STORAGE_KEY = 'zoekeygen_signing_key_enc';
    `, ctx);
    // ⛔ normalizer Private Key (សំណើម្ចាស់គម្រោង) ៖ អវត្តមាន (កូដមុនកែ) ➜ loadSigningKey ប្រើ JSON.parse ផ្ទាល់ ➜ ការអះអាងខាងក្រោមធ្លាក់ដោយមានឈ្មោះ
    const keyTextDecl = (src.match(/^const SIGNING_KEY_JWK_FIELDS = .*;$/m) || [])[0];
    const keyErrDecl = (src.match(/^const SIGNING_KEY_TEXT_ERRORS = \{[\s\S]*?\n\};$/m) || [])[0];
    if (keyTextDecl && keyErrDecl) vm.runInContext(keyTextDecl + '\n' + keyErrDecl, ctx);
    vm.runInContext(slice([
        ...['keygenIdleStamp', 'keygenIdleElapsed', 'getTrustedServerNow', 'captureKeygenClock', 'keygenClockIsCurrent'].filter(name => src.includes('function ' + name + '(')),
        'safeStoreSet', 'safeStoreGet', 'safeStoreRemove',
        'safeStoreRemove',
        'invalidateSensitiveSession',
        'clearSecureKeySetup', 'publishSecureGeneratedKey',
        ...(src.indexOf('function lookupSetupScrubUrl(') !== -1 ? ['lookupSetupScrubUrl', 'lookupSetupSecretName'] : []),
        'captureSensitiveSession',
        'isSensitiveSessionCurrent',
        ...(src.indexOf('function adminOperationIsCurrent(') !== -1 ? ['adminOwnerIsCurrent', 'adminOperationIsCurrent'] : []),
        'validateSigningKeyAgainstShippedPublicKey',
        'generateNewKeypair',
        ...(src.indexOf('function normalizeSigningKeyText(') !== -1 ? ['normalizeSigningKeyText'] : []),
        'loadSigningKey',
        'clearSigningKey',
        'seatLimitOf',
        'generateLicenseKey',
        'openExtendModal',
        ...(src.indexOf('function readExpiresAtViaRest(') !== -1 ? ['readDatabaseUrlFromConfig', 'isFirebaseDatabaseHost', 'fetchWithTimeout', 'databaseUrlOf', 'readExpiresAtViaRest'] : []),
        'confirmExtendKey',
        'toggleRevokeKey',
        ...(src.indexOf('function armAdminLateWrite(') !== -1 ? ['armAdminLateWrite'] : []),
        'setKeySeatLimit',
        ...(src.indexOf('function patchLicenseViaRest(') !== -1 ? ['patchLicenseViaRest'] : []),
        ...(src.indexOf('function readKeyReleaseViaRest(') !== -1 ? ['readKeyReleaseViaRest'] : []),
        'releaseKeySeat',
        'copySensitiveText',
        'copyTextarea',
        'copyGeneratedKey',
        'copySetupLink',
        'tryRestoreSigningKeyFromSession'
    ]), ctx);
    if (src.includes('function seatSellerContext()')) vm.runInContext(src.slice(src.indexOf('function seatSellerContext()'), src.indexOf('async function toggleRevokeKey(')), ctx);
    ctx.openSecureKeySetup = async (id) => { log.setupOpened = (log.setupOpened || []).concat(id); };
    return { ctx, license, log, elements, storage, getElementById, keyServer };
}

// ⛔ ការចាកចេញពិត ៖ `logoutApp()` បង្កើន `authGeneration` ហើយ `showLoginModalWithPrefill()` ហៅ `invalidateSensitiveSession()` + `isSignedInUiActive = false`
//    (អះអាងលើកូដពិតក្នុង run() ខាងក្រោម) ➜ ការក្លែងការចាកចេញត្រូវធ្វើទាំងបី មិនមែនតែបង្កើនជំនាន់ sensitive (ដែលការបិទប្រអប់ PIN ក៏ធ្វើដែរ)
function simulateLogout(ctx) {
    vm.runInContext('authGeneration++; invalidateSensitiveSession(); isSignedInUiActive = false;', ctx);
}

function adminRetryFixture() {
    const f = build();
    const timers = [];
    const writes = [];
    let authListener = null;
    f.ctx.console = { error() {} };
    f.ctx.setTimeout = (fn, ms) => { if (ms < 8000) timers.push(fn); return 1; };
    f.ctx.clearTimeout = () => {};
    f.ctx.prompt = () => '3';
    f.ctx.crypto.getRandomValues = (bytes) => bytes.fill(7);
    f.ctx.refreshNoticeList = () => { f.log.noticeRefreshes = (f.log.noticeRefreshes || 0) + 1; };
    f.ctx.kickNoticePush = () => { f.log.pushes = (f.log.pushes || 0) + 1; };
    f.ctx.hasUncopiedKeypair = () => false;
    f.ctx.updateAuthButton = () => {};
    f.ctx.showLoginModalWithPrefill = () => {
        f.ctx.invalidateSensitiveSession();
        f.ctx.isSignedInUiActive = false;
        f.ctx.noticeSendOwner = null;
        f.ctx.isSendingNotice = false;
    };
    f.ctx.verifyAdminRoleThenProceed = () => { f.ctx.isSignedInUiActive = true; };
    f.ctx.fb.onAuthStateChanged = (auth, fn) => { authListener = fn; return () => {}; };
    f.ctx.fb.signOut = async (auth) => { auth.currentUser = null; authListener(null); };
    f.ctx.fb.get = async () => ({ exists: () => false, val: () => null });
    const write = (ref, value) => {
        const pending = deferred();
        writes.push({ ref, value, user: f.ctx.auth.currentUser.uid, generation: f.ctx.authGeneration, ...pending });
        return pending.promise;
    };
    f.ctx.fb.update = write;
    f.ctx.fb.set = write;
    vm.runInContext([
        'NOTICE_TITLE_MAX', 'NOTICE_BODY_MAX', 'NOTICE_KEEP_MAX', 'NOTICE_KIND_LABELS', 'NOTICE_ID_ALPHABET', 'NOTICE_SEND_LABEL'
    ].map(realDecl).join('\n'), f.ctx);
    vm.runInContext(`
        var authUnsubscribe = null;
        var authRecoveryTimeout = null;
        var pendingRoleRecheck = false;
        var noticeListCache = [{ id: 'notice-a', title: 'ដំណឹងសាកល្បង' }];
        var isSendingNotice = false;
        var noticeSendOwner = null;
    `, f.ctx);
    vm.runInContext(slice([
        'retryAsync', 'setupAuthListener', 'logoutApp', 'noticeBucketPath', 'cleanNoticeText',
        'buildNoticePayload', 'newNoticeId', 'noticeIdsToTrim', 'setNoticeSendBusy', 'sendNotice', 'deleteNotice'
    ]), f.ctx);
    f.ctx.setupAuthListener();
    f.getElementById('noticeKindInput').value = 'notice';
    f.getElementById('noticeTitleInput').value = 'ដំណឹងសាកល្បង';
    f.getElementById('noticeBodyInput').value = 'ខ្លឹមសារសាកល្បង';
    const change = (kind) => {
        if (kind === 'database') f.ctx.db = { replacement: true };
        else if (kind === 'pin') f.ctx.invalidateSensitiveSession();
        else if (kind !== 'none') {
            const uid = kind === 'same-user' ? f.ctx.auth.currentUser.uid : 'admin-2';
            f.ctx.logoutApp(true);
            f.ctx.auth.currentUser = { uid };
            authListener(f.ctx.auth.currentUser);
        }
    };
    const start = (kind) => f.ctx[kind](kind === 'deleteNotice' ? 'notice-a' : 'AAAAAAAAAAAAAAAA');
    return { ...f, timers, writes, change, start };
}

async function verifyAdminRetryOwnership() {
    console.log('-- Admin retry ពិត ៖ វគ្គដើមជាម្ចាស់ការសរសេរ --');
    // ⛔ A505 ៖ «🔓 ដោះឧបករណ៍» មិននៅក្នុងបញ្ជីនេះទៀតទេ ៖ វាផ្ញើតាម REST PATCH តែម្តង ⛔ គ្មាន retry (ការផ្ញើម្តងទៀតក្រោយចម្លើយបាត់ = កំហុសដែលត្រូវការពារ)
    //    ម្ចាស់វគ្គរបស់វា វាស់ក្នុង verifyReleaseOverRest() ៖ R12 (ចាកចេញ · Login ម្តងទៀតដោយ admin ដដែល · admin ផ្សេង · Reconfig ទៅ Database ផ្សេង
    //    ទាំងពេលរង់ចាំ ID token និងចម្លើយ PATCH) · R13 (បិទប្រអប់ PIN = មិនមែនការប្តូរវគ្គ ➜ ✅ នៅបង្ហាញ) · R1 (គ្មានការប្តូរ)
    const actions = ['setKeySeatLimit', 'sendNotice', 'deleteNotice'];
    for (const action of actions) {
        for (const change of ['none', 'pin', 'other-user', 'same-user', 'database']) {
            const f = adminRetryFixture();
            const task = f.start(action);
            await drain();
            ok(action + '/' + change + '៖ លក្ខខណ្ឌចាំបាច់ — ការសរសេរដើមចាប់ផ្តើម', f.writes.length === 1);
            const initial = f.writes[0];
            if (!initial) throw new Error('ការសរសេរដើមមិនដំណើរការ');
            initial.reject(new Error('write failed (network)'));
            await drain();
            ok(action + '/' + change + '៖ retryAsync ពិតរង់ចាំក្រោយបរាជ័យ', f.timers.length === 1);
            f.change(change);
            const repeat = f.timers.shift();
            if (!repeat) throw new Error('retry មិនដំណើរការ');
            repeat();
            await drain();
            for (const pending of f.writes.slice(1)) pending.resolve();
            await task;
            await drain();
            const current = change === 'none' || change === 'pin';
            ok(action + '/' + change + '៖ retry សរសេរតែពេលវគ្គដើមនៅសុពលភាព',
                f.writes.length === (current ? 2 : 1)
                && f.writes.every((entry) => entry.ref.db === initial.ref.db && entry.user === initial.user
                    && entry.ref.path === initial.ref.path && JSON.stringify(entry.value) === JSON.stringify(initial.value)),
                f.writes.map((entry) => ({ user: entry.user, originalDb: entry.ref.db === initial.ref.db })));
            ok(action + '/' + change + '៖ ចម្លើយជោគជ័យប៉ះ UI តែវគ្គដើម · គ្មាន retry ទៀត',
                f.log.toasts.length === (current ? 1 : 0) && !f.log.alerts.length && f.timers.length === 0
                && (current || (!f.log.refreshed && !f.log.noticeRefreshes && !f.log.pushes)), f.log);
            ok(action + '/' + change + '៖ បញ្ចប់ការផ្ញើមិនទុក lock ជាប់', !f.ctx.isSendingNotice && !f.ctx.noticeSendOwner);
        }
        for (const change of ['none', 'other-user']) {
            const f = adminRetryFixture();
            const ceiling = deferred();
            let label = '';
            f.ctx.withTimeout = (promise, ms, message) => {
                if (message === 'Notice read timed out') return promise;
                label = message;
                return Promise.race([promise, ceiling.promise]);
            };
            const task = f.start(action);
            await drain();
            ok(action + '/ពិដាន/' + change + '៖ លក្ខខណ្ឌចាំបាច់ — write រង់ចាំ ហើយចូល backoff', f.writes.length === 1);
            f.writes[0].reject(new Error('write failed (network)'));
            await drain();
            ceiling.reject(new Error(label));
            await task;
            await drain();
            ok(action + '/ពិដាន/' + change + '៖ សារពិដានចេញ មុន retry ចាប់ផ្តើម',
                f.log.alerts.length === 1 && !f.log.toasts.length && f.timers.length === 1);
            f.change(change);
            const repeat = f.timers.shift();
            if (!repeat) throw new Error('retry ក្រោយពិដានមិនដំណើរការ');
            repeat();
            await drain();
            for (const pending of f.writes.slice(1)) pending.resolve();
            await drain();
            const current = change === 'none';
            ok(action + '/ពិដាន/' + change + '៖ retry យឺតគោរពវគ្គដើម', f.writes.length === (current ? 2 : 1));
            ok(action + '/ពិដាន/' + change + '៖ ចម្លើយយឺតមិនបង្ហាញក្នុងវគ្គផ្សេង',
                f.log.toasts.length === (current && action !== 'deleteNotice' ? 1 : 0)
                && f.log.alerts.length === 1 && !f.timers.length
                && (current || (!f.log.refreshed && !f.log.noticeRefreshes && !f.log.pushes)), f.log);
        }
        {
            const f = adminRetryFixture();
            if (action === 'setKeySeatLimit') f.ctx.prompt = () => { f.change('other-user'); return '3'; };
            else f.ctx.confirm = () => { f.change('other-user'); return true; };
            const task = f.start(action);
            await drain();
            for (const pending of f.writes) pending.resolve();
            await task;
            ok(action + '៖ ប្តូរវគ្គពេលបញ្ជាក់ មិនចាប់ផ្តើមសរសេរ', !f.writes.length && !f.timers.length);
        }
        for (const change of ['same-user', 'database']) {
            for (const outcome of ['resolve', 'reject']) {
                const f = adminRetryFixture();
                const task = f.start(action);
                await drain();
                ok(action + '/' + change + '/' + outcome + '៖ លក្ខខណ្ឌចាំបាច់ — write កំពុងរង់ចាំ', f.writes.length === 1);
                f.change(change);
                if (outcome === 'resolve') f.writes[0].resolve();
                else f.writes[0].reject(Object.assign(new Error('permission_denied'), { noRetry: true }));
                await task;
                ok(action + '/' + change + '/' + outcome + '៖ ចម្លើយចាស់មិនប៉ះ UI វគ្គថ្មី',
                    !f.log.toasts.length && !f.log.alerts.length && !f.log.refreshed && !f.log.noticeRefreshes
                    && !f.log.pushes && !f.log.captures && f.getElementById('noticeTitleInput').value === 'ដំណឹងសាកល្បង', f.log);
            }
        }
    }
}

function listRefreshFixture(kind) {
    const reads = [];
    const elements = {};
    const rendered = [];
    const el = (id) => elements[id] || (elements[id] = { innerHTML: '' });
    const ctx = vm.createContext({
        console: { error() {} }, Promise, Object, Array, String, Number, isFinite,
        window: {}, document: { getElementById: el },
        withTimeout: (promise) => promise,
        fb: {
            ref: (database, path) => ({ database, path }),
            get: (ref) => { const pending = deferred(); reads.push({ path: ref.path, ...pending }); return pending.promise; }
        },
        sbAdminList: (session, path) => { const pending = deferred(); reads.push({ path, ...pending }); return pending.promise; },
        sbAdminIsCurrent: (session) => session === ctx.sbAdminSession,
        sbAdminReset: () => { throw new Error('ការអានចាស់មិនត្រូវបិទ session ថ្មី'); },
        renderKeyList: () => { el('keyListBody').innerHTML = JSON.stringify(ctx.keyListCache); rendered.push('key'); },
        renderSbTenantList: () => { el('sbTenantListBody').innerHTML = JSON.stringify(ctx.sbTenantCache); rendered.push('shop'); }
    });
    vm.runInContext(`
        var db = {};
        var keyListSessionGeneration = 1;
        var keyListRefreshOwner = null;
        var sbAdminRefreshOwner = null;
        var keyListCache = [];
        var seatReadFailed = false;
        var sbAdminSession = {};
        var sbTenantCache = [];
        var sbMemberCache = [];
        var sbDeviceCache = [];
        var sbTenantReadFailed = false;
        var sbMemberReadFailed = false;
        var sbDeviceReadFailed = false;
    `, ctx);
    vm.runInContext(realLicenseAppCodeDecl(src) + '\n' + realDecl('LICENSE_SEAT_SLOT_NAMES') + '\n' + realDecl('LICENSE_SEAT_MAX'), ctx);
    vm.runInContext(slice(['seatLimitOf', 'seatMetaText', 'seatMetaOf', 'seatDevicesOf', 'refreshKeyList', 'sbAdminRows', 'sbAdminRefresh']), ctx);
    const start = () => {
        const promise = kind === 'key' ? ctx.refreshKeyList() : ctx.sbAdminRefresh();
        const requests = reads.splice(0);
        return { promise, requests };
    };
    const answer = (request, revoked, failure) => {
        request.requests.forEach((pending, index) => {
            if (failure && index === 0) { pending.reject(new Error('offline')); return; }
            if (kind === 'key') {
                const value = index === 0 ? { ZOE: { 'AAAAAAAAAAAAAAAA': { revoked, expiresAt: 1000, maxDevices: 1 } } } : {};
                pending.resolve({ exists: () => true, val: () => value });
            } else {
                const body = index === 0 ? [{ id: 'shop-a', name: 'ហាង', revoked }] : [];
                pending.resolve({ ok: true, status: 200, body });
            }
        });
    };
    return { ctx, el, rendered, start, answer, rows: () => kind === 'key' ? ctx.keyListCache : ctx.sbTenantCache,
        body: () => el(kind === 'key' ? 'keyListBody' : 'sbTenantListBody').innerHTML };
}

// ⛔ A505 (សេចក្តីសម្រេចម្ចាស់គម្រោង) ៖ «🔓 ដោះឧបករណ៍» ផ្ញើ update root តែមួយ (លុបកៅអី + `releasedAt` ម៉ោង server) តាម REST PATCH ជាមួយ ID token
//    របស់ admin ទៅ Database របស់ប្រតិបត្តិការ ⛔ មិនមែនតាម SDK (`fb.update` · `fb.set`) ៖ RTDB SDK ផ្ញើការសរសេរដែលបាត់ចម្លើយម្តងទៀតពេលភ្ជាប់វិញ
//    (មានតែ transaction ដែលត្រូវបោះបង់) ➜ ការដោះចុះម្តងទៀត លុបកៅអីដែលឧបករណ៍ថ្មីទើបកក់ ហើយចុះត្រា `releasedAt` ថ្មីជាង ➜ ឧបករណ៍ថ្មីទទួល seat-released។
//    ចម្លើយបាត់ក្រោយផ្ញើ ➜ អានពី Database ដដែល (មិនមែន Config ផ្ទាល់) ៖ កៅអីអវត្តមាន + `releasedAt` ≥ ម៉ោងផ្ញើ ➜ ✅ · ផ្សេងពីនេះ ឬអានមិនបាន ➜ ⏳ + Refresh ·
//    ⛔ មិនផ្ញើម្តងទៀតឡើយ។ Server ក្លែងខាងក្រោមអនុវត្ត PATCH ពិត (null = លុប · `{'.sv':'timestamp'}` = ម៉ោង server) ហើយអាចបាត់ចម្លើយក្រោយអនុវត្ត។
const RELEASE_DB_HOST = 'kg-release.firebaseio.com';
const RELEASE_STAMP_AT = 6000;
function releaseRestFixture(options) {
    const o = Object.assign({ seats: { d1: { device: 'device-1', at: 1 } }, releasedAt: null, sentAt: 5000, synced: true, patch: ['ok'] }, options || {});
    const h = build();
    h.ctx.console = { error() {}, log() {}, warn() {} };
    h.ctx.URL = URL;
    h.ctx.db = { app: { options: { databaseURL: 'https://' + RELEASE_DB_HOST + '/' } } };
    h.ctx.appLocalStore = { getItem: (k) => (k === 'zoew_firebase_config' ? JSON.stringify({ databaseURL: 'https://kg-live-config.firebaseio.com' }) : null) };
    h.ctx.getServerNow = () => o.sentAt;
    h.license.getTrustedServerNow = () => o.synced ? o.sentAt : null;
    vm.runInContext('var serverTimeSynced = ' + (o.synced ? 'true' : 'false') + ';', h.ctx);
    const tokens = [];
    h.ctx.auth.currentUser.getIdToken = () => { tokens.push(h.ctx.auth.currentUser.uid); return o.token ? o.token.promise : Promise.resolve('admin-id-token'); };
    const store = { seats: { 'AAAAAAAAAAAAAAAA': o.seats, 'BBBBBBBBBBBBBBBB': null }, releasedAt: { 'AAAAAAAAAAAAAAAA': o.releasedAt, 'BBBBBBBBBBBBBBBB': null } };
    const server = {
        get seats() { return store.seats['AAAAAAAAAAAAAAAA']; }, set seats(value) { store.seats['AAAAAAAAAAAAAAAA'] = value; },
        get releasedAt() { return store.releasedAt['AAAAAAAAAAAAAAAA']; }, set releasedAt(value) { store.releasedAt['AAAAAAAAAAAAAAAA'] = value; },
        store
    };
    const sdk = [];
    h.ctx.fb.update = (ref, value) => { sdk.push(['update', ref && ref.path, value]); return Promise.resolve(); };
    h.ctx.fb.set = (ref, value) => { sdk.push(['set', ref && ref.path, value]); return Promise.resolve(); };
    const requests = [];
    const respond = (status, text) => ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(text), json: () => Promise.resolve(JSON.parse(text)) });
    const modes = o.patch.slice();
    const lost = () => Promise.reject(new TypeError('Failed to fetch'));
    h.ctx.fetch = (url, init) => {
        const method = (init && init.method) || 'GET';
        const u = new URL(String(url));
        requests.push({ method, host: u.host, path: u.pathname, auth: u.searchParams.get('auth'), body: init && typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
        if (method === 'PATCH') {
            const mode = modes.length > 1 ? modes.shift() : modes[0];
            const body = JSON.parse(init.body);
            const stamps = Object.keys(body).some((k) => /\/releasedAt$/.test(k));
            if (mode === 'pending') return o.pending.promise;
            if (mode === 'deny' || (mode === 'refuse-stamp' && stamps)) return Promise.resolve(respond(401, '{\n  "error" : "Permission denied"\n}\n'));
            if (mode === 'expired') return Promise.resolve(respond(401, '{\n  "error" : "Auth token is expired"\n}\n'));
            if (mode === 'down') return lost();
            Object.keys(body).forEach((k) => {
                const seat = k.match(/^license_seats\/ADM\/([^/]+)$/);
                const stamp = k.match(/^license_keys\/ADM\/([^/]+)\/releasedAt$/);
                if (seat && body[k] === null) store.seats[seat[1]] = null;
                if (stamp && body[k] && body[k]['.sv'] === 'timestamp') store.releasedAt[stamp[1]] = RELEASE_STAMP_AT;
            });
            if (mode === 'lost' || mode === 'refuse-stamp-lost') return lost();
            if (mode === 'lost-claim') {
                server.seats = { d1: { device: 'device-new', at: RELEASE_STAMP_AT + 1, releaseEpoch: server.releasedAt } };
                return lost();
            }
            if (mode === 'gateway') return Promise.resolve(respond(503, 'Service Unavailable'));
            return Promise.resolve(respond(200, init.body));
        }
        if (o.readDown) return lost();
        const seatRead = u.pathname.match(/^\/license_seats\/ADM\/([^/]+)\.json$/);
        const stampRead = u.pathname.match(/^\/license_keys\/ADM\/([^/]+)\/releasedAt\.json$/);
        if (seatRead) return Promise.resolve(respond(200, JSON.stringify(store.seats[seatRead[1]] === undefined ? null : store.seats[seatRead[1]])));
        if (stampRead) return Promise.resolve(respond(200, JSON.stringify(store.releasedAt[stampRead[1]] === undefined ? null : store.releasedAt[stampRead[1]])));
        return Promise.resolve(respond(200, 'null'));
    };
    return Object.assign(h, { server, sdk, requests, tokens });
}

async function verifyReleaseOverRest() {
    console.log('-- ⛔ A505 ៖ ដោះឧបករណ៍តាម REST PATCH ៖ ចម្លើយបាត់មិនផ្ញើម្តងទៀត · អានពី Database របស់ប្រតិបត្តិការ --');
    const patches = (f) => f.requests.filter((r) => r.method === 'PATCH');
    const reads = (f) => f.requests.filter((r) => r.method === 'GET');
    const stampedBody = JSON.stringify({ 'license_seats/ADM/AAAAAAAAAAAAAAAA': null, 'license_keys/ADM/AAAAAAAAAAAAAAAA/releasedAt': { '.sv': 'timestamp' } });
    const seatsOnlyBody = JSON.stringify({ 'license_seats/ADM/AAAAAAAAAAAAAAAA': null });
    const pendingText = (f) => vm.runInContext('RELEASE_PENDING_TEXT', f.ctx);
    const released = (f) => f.log.toasts.some((t) => t.startsWith('✅')) && f.log.alerts.length === 0 && f.log.refreshed >= 1;
    const pending = (f) => f.log.alerts.length === 1 && f.log.alerts[0] === pendingText(f) && !f.log.toasts.some((t) => t.startsWith('✅')) && f.log.refreshed >= 1;
    const unstamped = (f) => f.log.alerts.length === 1 && /Publish/.test(f.log.alerts[0]) && /releasedAt/.test(f.log.alerts[0])
        && !f.log.toasts.some((t) => t.startsWith('✅')) && f.log.refreshed >= 1;
    const restOnly = (f) => f.sdk.length === 0 && f.requests.every((r) => r.host === RELEASE_DB_HOST);
    const runRelease = async (options, keyId) => {
        const f = releaseRestFixture(options);
        if (options && options.prepare) options.prepare(f);
        await f.ctx.releaseKeySeat(keyId || 'AAAAAAAAAAAAAAAA');
        await drain();
        return f;
    };
    const detail = (f) => ({ requests: f.requests, sdk: f.sdk, server: f.server, log: f.log });

    let f = await runRelease();
    const sent = patches(f)[0] || {};
    ok('R1 ៖ ដោះ ➜ PATCH root តែមួយតាម REST (ID token admin · Database របស់ប្រតិបត្តិការ មិនមែន Config ផ្ទាល់) · ⛔ គ្មានការសរសេរតាម SDK',
        patches(f).length === 1 && sent.path === '/.json' && sent.auth === 'admin-id-token' && JSON.stringify(sent.body) === stampedBody && restOnly(f), detail(f));
    ok('R1 ៖ ចុះទាន់ពេល ➜ កៅអីទំនេរ · releasedAt ម៉ោង server · ✅ + Refresh',
        f.server.seats === null && f.server.releasedAt === RELEASE_STAMP_AT && released(f), detail(f));

    f = await runRelease({ patch: ['lost'] });
    ok('R2 ៖ ចម្លើយបាត់ក្រោយចុះ ➜ អានត្រលប់ពី Database ដដែល (កៅអីអវត្តមាន · releasedAt ≥ ម៉ោងផ្ញើ) ➜ ✅ · ផ្ញើតែម្តង',
        patches(f).length === 1 && reads(f).length >= 2 && restOnly(f) && released(f), detail(f));

    f = await runRelease({ patch: ['lost-claim'] });
    ok('⛔ R3 ៖ ចម្លើយបាត់ · ឧបករណ៍ថ្មីកក់កៅអីក្នុងចន្លោះ ➜ ⏳ មិនទាន់បញ្ជាក់ + Refresh · ⛔ មិនផ្ញើម្តងទៀត (កៅអីថ្មីនៅ · releasedAt មិនប្តូរ)',
        patches(f).length === 1 && restOnly(f) && !!f.server.seats && f.server.seats.d1.device === 'device-new'
            && f.server.releasedAt === RELEASE_STAMP_AT && pending(f), detail(f));

    f = await runRelease({ patch: ['down'] });
    ok('R4 ៖ ការផ្ញើមិនដល់ Server (កៅអីនៅ) ➜ ⏳ + Refresh · មិនផ្ញើម្តងទៀត', patches(f).length === 1 && restOnly(f) && pending(f), detail(f));

    f = await runRelease({ patch: ['lost'], readDown: true });
    ok('R5 ៖ ចម្លើយបាត់ · អានត្រលប់មិនបាន ➜ ⏳ + Refresh (មិនទាយ ✅)', patches(f).length === 1 && restOnly(f) && pending(f), detail(f));

    f = await runRelease({ patch: ['down'], seats: null, releasedAt: 4000 });
    ok('R6 ៖ កៅអីទំនេរ តែ releasedAt ចាស់ជាងម៉ោងផ្ញើ (ការដោះមុន · ការផ្ញើនេះមិនដល់) ➜ ⏳ មិនមែន ✅',
        patches(f).length === 1 && pending(f), detail(f));

    f = await runRelease({ patch: ['lost'], synced: false });
    ok('R7 ៖ ម៉ោង Server មិនទាន់ផ្ទៀងផ្ទាត់ ➜ ប្រៀប releasedAt នឹងម៉ោងផ្ញើមិនបាន ➜ ⏳', patches(f).length === 1 && pending(f), detail(f));

    f = await runRelease({ patch: ['gateway'] });
    ok('R8 ៖ Server ឆ្លើយ 5xx (អាចចុះរួច) ➜ អានត្រលប់ ➜ ✅ · ផ្ញើតែម្តង', patches(f).length === 1 && reads(f).length >= 2 && released(f), detail(f));

    f = await runRelease({ patch: ['refuse-stamp', 'ok'] });
    ok('R9 ៖ Rules ចាស់បដិសេធ releasedAt ➜ PATCH ទី ២ លុបតែកៅអី · ប្រាប់ឲ្យ Publish Rules (មិនមែន ✅ ដោះពេញ)',
        patches(f).length === 2 && JSON.stringify(patches(f)[0].body) === stampedBody && JSON.stringify(patches(f)[1].body) === seatsOnlyBody
            && f.server.seats === null && restOnly(f) && unstamped(f), detail(f));

    f = await runRelease({ patch: ['refuse-stamp', 'refuse-stamp-lost'] });
    ok('R9 ៖ Rules ចាស់ · ចម្លើយ PATCH លុបកៅអីបាត់ ➜ អានត្រលប់ (កៅអីអវត្តមាន) ➜ ប្រាប់ឲ្យ Publish Rules · មិនផ្ញើម្តងទៀត',
        patches(f).length === 2 && restOnly(f) && unstamped(f), detail(f));

    f = await runRelease({ patch: ['refuse-stamp', 'lost-claim'] });
    ok('R9 ៖ Rules ចាស់ · ចម្លើយបាត់ · ឧបករណ៍ថ្មីកក់ក្នុងចន្លោះ ➜ ⏳ (មិនមែន «ដោះរួច»)', patches(f).length === 2 && pending(f), detail(f));

    f = await runRelease({ patch: ['deny'] });
    ok('R10 ៖ Rules បដិសេធទាំង ២ ➜ «មិនបាន» + ប្រាប់ឲ្យ Publish Rules · គ្មាន ⏳ · គ្មាន ✅',
        patches(f).length === 2 && f.log.alerts.length === 1 && /មិនបាន/.test(f.log.alerts[0]) && /Publish/.test(f.log.alerts[0]) && f.log.alerts[0] !== pendingText(f)
            && !f.log.toasts.some((t) => t.startsWith('✅')), detail(f));

    f = await runRelease({ patch: ['expired'] });
    ok('R11 ៖ 401 មិនមែនការបដិសេធរបស់ Rules (token ផុត) ➜ «មិនបាន» · ⛔ មិនដោះតែកៅអី',
        patches(f).length === 1 && f.log.alerts.length === 1 && /មិនបាន/.test(f.log.alerts[0]) && f.server.seats !== null, detail(f));
    ok('R11 ៖ សារ 401 ប្រាប់មូលហេតុពិត (HTTP 401) ⛔ មិនប្រាប់ឲ្យ Publish Rules',
        f.log.alerts.length === 1 && /HTTP 401/.test(f.log.alerts[0]) && !/Publish/.test(f.log.alerts[0]), detail(f));

    f = await runRelease({ token: { promise: Promise.reject(new Error('token refresh offline')) } });
    ok('R11 ៖ ID token មិនបាន (offline) ➜ មិនផ្ញើ PATCH · «មិនទាន់ផ្ញើ» ⛔ មិនប្រាប់ឲ្យ Publish Rules · គ្មាន ⏳ · គ្មាន ✅',
        patches(f).length === 0 && f.log.alerts.length === 1 && /មិនទាន់ផ្ញើ/.test(f.log.alerts[0]) && !/Publish/.test(f.log.alerts[0])
            && f.log.alerts[0] !== pendingText(f) && !f.log.toasts.some((t) => t.startsWith('✅')) && f.server.seats !== null, detail(f));

    // ⛔ R12 ៖ ម្ចាស់ការដោះ = admin ដដែល (`uid`) + `authGeneration` ដដែល (`adminOperationIsCurrent()`) + Database របស់ប្រតិបត្តិការ (`operationDb`)
    //    ➜ ការប្តូរវគ្គនីមួយៗ វាស់ទាំងពេលរង់ចាំ ID token (មិនផ្ញើ PATCH) និងពេលរង់ចាំចម្លើយ PATCH (ចម្លើយមិនប៉ះ UI · មិន Refresh)៖
    //    ចាកចេញ · Login ម្តងទៀតដោយ admin ដដែល (`uid` ដូចគ្នា តែ `authGeneration` ថ្មី) · admin ផ្សេង · Reconfig ទៅ Database ផ្សេង។
    //    ⛔ ការក្លែង (mutant) ដែលដក `db === operationDb` ឬប្រើ `adminOwnerIsCurrent()` ជំនួស `adminOperationIsCurrent()` ត្រូវធ្លាក់នៅទីនេះ។
    const OTHER_DB_HOST = 'kg-other.firebaseio.com';
    const sessionChanges = {
        logout: { label: 'ចាកចេញ', apply: (fx) => simulateLogout(fx.ctx) },
        'same-user': {
            label: 'Login ម្តងទៀតដោយ admin ដដែល',
            apply: (fx) => {
                simulateLogout(fx.ctx);
                fx.ctx.auth.currentUser = { uid: fx.ctx.auth.currentUser.uid, email: 'admin@example.com', getIdToken: () => Promise.resolve('relogin-id-token') };
                vm.runInContext('authGeneration++; isSignedInUiActive = true;', fx.ctx);
            }
        },
        'other-user': {
            label: 'Login ដោយ admin ផ្សេង',
            apply: (fx) => {
                simulateLogout(fx.ctx);
                fx.ctx.auth.currentUser = { uid: 'admin-2', email: 'admin2@example.com', getIdToken: () => Promise.resolve('other-id-token') };
                vm.runInContext('authGeneration++; isSignedInUiActive = true;', fx.ctx);
            }
        },
        database: {
            label: 'Reconfig ទៅ Database ផ្សេង',
            apply: (fx) => { fx.ctx.db = { app: { options: { databaseURL: 'https://' + OTHER_DB_HOST + '/' } } }; }
        }
    };
    for (const [kind, change] of Object.entries(sessionChanges)) {
        for (const stage of ['token', 'patch']) {
            const gate = deferred();
            f = releaseRestFixture(stage === 'token' ? { token: gate } : { patch: ['pending'], pending: gate });
            const task = f.ctx.releaseKeySeat('AAAAAAAAAAAAAAAA');
            await drain();
            const before = f.requests.length;
            const generationBefore = vm.runInContext('authGeneration', f.ctx);
            change.apply(f);
            const precondition = kind === 'database'
                ? f.ctx.db.app.options.databaseURL.indexOf(OTHER_DB_HOST) !== -1 && vm.runInContext('authGeneration', f.ctx) === generationBefore
                : vm.runInContext('authGeneration', f.ctx) > generationBefore
                    && (kind === 'logout' ? !vm.runInContext('isSignedInUiActive', f.ctx)
                        : vm.runInContext('isSignedInUiActive', f.ctx) && f.ctx.auth.currentUser.uid === (kind === 'same-user' ? 'admin-1' : 'admin-2'));
            ok('R12/' + kind + '/' + stage + ' ៖ លក្ខខណ្ឌចាំបាច់ — ' + change.label + ' កើតពេលរង់ចាំ ' + (stage === 'token' ? 'ID token' : 'ចម្លើយ PATCH')
                + ' (PATCH ' + (stage === 'token' ? '០' : '១') + ' មុនប្តូរ)', precondition && before === (stage === 'token' ? 0 : 1) && f.tokens.length === 1, detail(f));
            gate.resolve(stage === 'token' ? 'admin-id-token' : { ok: true, status: 200, text: () => Promise.resolve('{}') });
            await task;
            await drain();
            ok('R12/' + kind + '/' + stage + ' ៖ ' + change.label + ' ពេលរង់ចាំ '
                + (stage === 'token' ? 'ID token ➜ មិនផ្ញើ PATCH' : 'ចម្លើយ PATCH ➜ ចម្លើយមិនប៉ះ UI វគ្គថ្មី · មិន Refresh')
                + ' · គ្មានសំណើទៅ Database ផ្សេង · គ្មាន SDK',
                patches(f).length === (stage === 'token' ? 0 : 1) && f.requests.length === before && f.tokens.length === 1
                    && restOnly(f) && !f.log.toasts.length && !f.log.alerts.length && !f.log.refreshed, detail(f));
        }
    }

    {
        const gate = deferred();
        f = releaseRestFixture({ patch: ['pending'], pending: gate });
        vm.runInContext(slice(['closeModal', 'clearPinInputValues', 'clearKeypairOutputs']) + '\nvar pinTargetAction = null;', f.ctx);
        const task = f.ctx.releaseKeySeat('AAAAAAAAAAAAAAAA');
        await drain();
        f.getElementById('pinModal').classList.add('active');
        f.ctx.closeModal('pinModal');
        gate.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
        await task;
        await drain();
        ok('R13 ៖ បិទប្រអប់ PIN កណ្តាល PATCH (មិនមែនការចាកចេញ) ➜ ✅ នៅបង្ហាញ + Refresh', patches(f).length === 1 && released(f), detail(f));
    }

    {
        const gate = deferred();
        f = releaseRestFixture({ patch: ['pending'], pending: gate });
        let confirms = 0;
        f.ctx.confirm = () => { confirms++; return true; };
        const task = f.ctx.releaseKeySeat('AAAAAAAAAAAAAAAA');
        await drain();
        const second = f.ctx.releaseKeySeat('AAAAAAAAAAAAAAAA');
        await drain();
        const whileBusy = { patches: patches(f).length, confirms, toasts: f.log.toasts.slice() };
        gate.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
        await task; await second;
        await drain();
        ok('⛔ R14 ៖ ចុចដោះម្តងទៀតពេល PATCH មិនទាន់ឆ្លើយ ➜ មិនសួរ · មិនផ្ញើ PATCH ទី ២ · ⏳ ប្រាប់ឲ្យរង់ចាំ',
            whileBusy.patches === 1 && whileBusy.confirms === 1 && whileBusy.toasts.some((t) => t.startsWith('⏳')), { whileBusy, ...detail(f) });
        ok('R14 ៖ ក្រោយ PATCH ទី ១ ចប់ ➜ ✅ តែម្តង ហើយការដោះលើកក្រោយផ្ញើបាន', patches(f).length === 1 && released(f), detail(f));
        await f.ctx.releaseKeySeat('AAAAAAAAAAAAAAAA');
        await drain();
        ok('R14 ៖ busy ត្រូវដោះក្រោយចប់ (ការដោះបន្ទាប់សួរ និងផ្ញើ PATCH)', confirms === 2 && patches(f).length === 2, { confirms, ...detail(f) });
    }
}

async function run() {
    await verifyAdminRetryOwnership();
    await verifyReleaseOverRest();
    console.log('-- Refresh បញ្ជី Admin ស្របគ្នា ៖ ចម្លើយថ្មីជាម្ចាស់ UI --');
    for (const kind of ['key', 'shop']) {
        for (const staleFails of [false, true]) {
            const list = listRefreshFixture(kind);
            const old = list.start();
            const fresh = list.start();
            ok(kind + '៖ លក្ខខណ្ឌចាំបាច់ — មានសំណើអាន ៣ ក្នុង refresh នីមួយៗ', old.requests.length === 3 && fresh.requests.length === 3);
            list.answer(fresh, true, false);
            await fresh.promise;
            const before = list.body();
            ok(kind + '៖ ចម្លើយថ្មីបង្ហាញ revoked = true មុនចម្លើយចាស់', list.rows().length === 1 && list.rows()[0].revoked === true);
            list.answer(old, false, staleFails);
            await old.promise;
            ok(kind + '/' + (staleFails ? 'ចាស់បរាជ័យ' : 'ចាស់ជោគជ័យ') + '៖ ចម្លើយចាស់មិនជាន់ cache/DOM ដែល refresh ថ្មីបង្ហាញ',
                list.rows().length === 1 && list.rows()[0].revoked === true && list.body() === before,
                { rows: list.rows(), body: list.body() });
        }
        const list = listRefreshFixture(kind);
        const old = list.start();
        const fresh = list.start();
        list.answer(fresh, true, true);
        await fresh.promise;
        const before = list.body();
        list.answer(old, false, false);
        await old.promise;
        ok(kind + '៖ ទិសផ្ទុយ — refresh ថ្មីអានមិនបាន មិនទទួលទិន្នន័យចាស់ជាថ្មីវិញ', list.rows().length === 0 && list.body() === before,
            { rows: list.rows(), body: list.body() });
    }
    {
        const body = (name) => { const m = src.match(new RegExp('\\nfunction ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}')); return m ? m[0] : ''; };
        ok('លក្ខខណ្ឌការក្លែង ៖ logoutApp() ពិតបង្កើន authGeneration', /authGeneration\+\+/.test(body('logoutApp')));
        ok('លក្ខខណ្ឌការក្លែង ៖ showLoginModalWithPrefill() ពិតហៅ invalidateSensitiveSession() + isSignedInUiActive = false',
            /invalidateSensitiveSession\(\)/.test(body('showLoginModalWithPrefill')) && /isSignedInUiActive = false/.test(body('showLoginModalWithPrefill')));
    }
    console.log('-- ចាក់សោ/ចាកចេញ ➜ key Apps Script មិននៅក្នុងវាល URL API ស្វែងរក --');
    let h = build();
    h.getElementById('setupLookupUrlInput').value = 'https://script.google.com/macros/s/X/exec?code={barcode}&key=SHEETKEY99&auth_token=TOK1&mode=1';
    h.ctx.invalidateSensitiveSession();
    ok('invalidateSensitiveSession() (ចាក់សោ · ចាកចេញ) ដក key/token ចេញពីវាល URL API · ទុក query ធម្មតា',
        h.getElementById('setupLookupUrlInput').value === 'https://script.google.com/macros/s/X/exec?code={barcode}&mode=1', h.getElementById('setupLookupUrlInput').value);
    console.log('-- logout មុន keypair async ចប់ --');
    h = build();
    const keypairWait = deferred();
    h.license.generateKeyPair = () => keypairWait.promise;
    const keypairTask = h.ctx.generateNewKeypair();
    h.ctx.invalidateSensitiveSession();
    keypairWait.resolve({ publicKeyJwk: { kty: 'EC', x: 'public' }, privateKeyJwk: { kty: 'EC', crv: 'P-256', d: 'private' } });
    await keypairTask;
    ok('Private Key មិនត្រូវត្រឡប់ទៅ DOM ក្រោយ logout', h.getElementById('newPrivateKeyOutput').value === '');
    ok('modal Private Key មិនបើកវិញក្រោយ logout', !h.getElementById('keypairModal').classList.contains('active'));

    console.log('-- logout មុន Load Signing Key async ចប់ --');
    h = build();
    h.getElementById('privateKeyInput').value = JSON.stringify({ kty: 'EC', crv: 'P-256', d: 'private', x: 'x', y: 'y' });
    const signWait = deferred();
    h.license.signNewKey = () => signWait.promise;
    const loadTask = h.ctx.loadSigningKey();
    h.ctx.invalidateSensitiveSession();
    signWait.resolve({ keyString: 'signed-key' });
    await loadTask;
    ok('Signing Key មិនត្រូវ Load ចូល memory ក្រោយ logout', h.ctx.signingPrivateKeyJwk === null);

    console.log('-- logout ក្រោយ database write កំពុងរង់ចាំ --');
    h = build({ privateKey: { kty: 'EC', crv: 'P-256', d: 'private', x: 'x', y: 'y' } });
    h.getElementById('genAppSelect').value = 'ADM';
    h.getElementById('genDaysInput').value = '30';
    h.getElementById('genNoteInput').value = 'device';
    const writeWait = deferred();
    h.ctx.fb.update = () => { h.log.updates++; return writeWait.promise; };
    const generateTask = h.ctx.generateLicenseKey();
    await drain();
    ok('write ចាប់ផ្ដើមមុន simulate logout', h.log.updates === 1, h.log.updates);
    simulateLogout(h.ctx);
    writeWait.resolve();
    await generateTask;
    ok('Generated key មិនត្រូវបង្ហាញក្រោយ logout', h.getElementById('genResultKey').textContent === '');
    ok('Generated key មិនត្រូវនៅក្នុង memory ក្រោយ logout', h.ctx.lastGeneratedKey === '');

    // ⛔ Generate ៖ ការសរសេរលើកទី ១ បរាជ័យ ហើយ Database ត្រូវបានប្តូរ (Reconfig ទៅ License Project ផ្សេង) មុន retry ➜ retry មិនត្រូវសរសេរ Key ចូល
    //    Database ថ្មីទេ (ដូច Revoke · ចំនួនឧបករណ៍ · ដោះឧបករណ៍ · Extend ដែលចាប់ `operationDb` រួចហើយ)។ ប្រើ `retryAsync()` ពិតពីកូដ ship
    //    (រង់ចាំខ្លី) ព្រោះ stub ខាងលើមិន retry ទេ។
    console.log('-- ប្តូរ Database កណ្តាល retry របស់ Generate --');
    for (const switchDb of [true, false]) {
        h = build({ privateKey: { kty: 'EC', crv: 'P-256', d: 'private', x: 'x', y: 'y' } });
        vm.runInContext(slice(['retryAsync']), h.ctx);
        h.ctx.setTimeout = (fn) => setTimeout(fn, 0);
        h.getElementById('genDaysInput').value = '30';
        const dbA = h.ctx.db;
        const dbB = { name: 'other-license-project' };
        const writes = [];
        h.ctx.fb.update = (ref) => {
            writes.push(ref.db);
            if (writes.length === 1) {
                if (switchDb) h.ctx.db = dbB;
                return Promise.reject(new Error('network'));
            }
            return Promise.resolve();
        };
        await h.ctx.generateLicenseKey();
        await drain(20);
        const label = switchDb ? 'ប្តូរ Database' : 'ទិសផ្ទុយ ៖ Database ដដែល';
        ok(label + ' ៖ លក្ខខណ្ឌចាំបាច់ ៖ ការសរសេរលើកទី ១ ទៅ Database ដើម', writes[0] === dbA, writes.length);
        if (switchDb) {
            ok(label + ' ៖ ⛔ retry មិនសរសេរ Key ចូល Database ថ្មី', writes.every((d) => d !== dbB), writes.map((d) => (d === dbB ? 'B' : 'A')));
            ok(label + ' ៖ Key មិនបង្ហាញ', h.ctx.lastGeneratedKey === '', h.ctx.lastGeneratedKey);
        } else {
            ok(label + ' ៖ retry សរសេរទៅ Database ដើម ហើយបង្ហាញ Key', writes.length === 2 && writes[1] === dbA && h.ctx.lastGeneratedKey === 'signed-key',
                { writes: writes.length, key: h.ctx.lastGeneratedKey });
        }
    }

    console.log('-- Load Signing Key ឡើងវិញខណៈ Generate កំពុងរង់ចាំ --');
    const reloadKey = { kty: 'EC', crv: 'P-256', d: 'synthetic-private', x: 'x', y: 'y' };
    for (const stage of ['clock', 'sign', 'write']) {
        h = build({ privateKey: reloadKey });
        h.getElementById('genDaysInput').value = '30';
        const pending = deferred();
        if (stage === 'clock') h.ctx.waitForServerTimeSync = () => pending.promise;
        if (stage === 'sign') h.license.signNewKey = () => pending.promise;
        if (stage === 'write') h.ctx.fb.update = () => pending.promise;
        const oldGenerate = h.ctx.generateLicenseKey();
        await drain();
        h.license.signNewKey = () => Promise.resolve({ keyString: 'synthetic-new-key', payload: { id: 'SYNTHETICKEY00003', iat: 1, exp: 2592001 } });
        h.getElementById('privateKeyInput').value = JSON.stringify(reloadKey);
        await h.ctx.loadSigningKey();
        pending.resolve(stage === 'clock' ? true : { keyString: 'synthetic-old-key', payload: { id: 'SYNTHETICKEY00004', iat: 1, exp: 2592001 } });
        await oldGenerate;
        ok(stage + '៖ Load Key ឡើងវិញមិនទុកសោ Generate ជាប់',
            h.ctx.isGeneratingKey === false && !h.getElementById('genGenerateBtn').disabled);
        ok(stage + '៖ លទ្ធផលសំណើចាស់មិនជាន់ Key ដែល Load ថ្មី', h.ctx.lastGeneratedKey === '');
        h.ctx.fb.update = () => { h.log.updates++; return Promise.resolve(); };
        h.ctx.waitForServerTimeSync = () => Promise.resolve(true);
        const beforeRetry = h.log.updates;
        await h.ctx.generateLicenseKey();
        ok(stage + '៖ Generate បន្ទាប់សរសេរ និងបង្ហាញ Key បាន',
            h.log.updates === beforeRetry + 1 && h.ctx.lastGeneratedKey === 'synthetic-new-key');
    }

    h = build({ privateKey: reloadKey });
    h.getElementById('genDaysInput').value = '30';
    const oldClock = deferred();
    const newClock = deferred();
    h.ctx.waitForServerTimeSync = () => oldClock.promise;
    const clearedGenerate = h.ctx.generateLicenseKey();
    h.ctx.clearSigningKey(true);
    h.getElementById('privateKeyInput').value = JSON.stringify(reloadKey);
    await h.ctx.loadSigningKey();
    h.ctx.waitForServerTimeSync = () => newClock.promise;
    const newerGenerate = h.ctx.generateLicenseKey();
    oldClock.resolve(true);
    await clearedGenerate;
    ok('សំណើដែល Clear រួចមិនដោះសោ Generate របស់សំណើថ្មី',
        h.ctx.isGeneratingKey === true && h.getElementById('genGenerateBtn').disabled);
    newClock.resolve(true);
    await newerGenerate;
    ok('សំណើថ្មីបញ្ចប់ដោយដោះសោ Generate ផ្ទាល់ខ្លួន', h.ctx.isGeneratingKey === false);

    // ⛔ បិទប្រអប់ PIN (`closeModal('pinModal')` ពិត ➜ invalidateSensitiveSession) ខណៈ Generate កំពុងរង់ចាំ ៖ សំណើនោះបញ្ចប់ដោយមិនបង្ហាញ Key
    //    ប៉ុន្តែ **ត្រូវដោះសោ Generate វិញ** ➜ ប៊ូតុងមិនស្លាប់ ហើយ `expireIdleSigningKey()` (ដែលបដិសេធពេល `isGeneratingKey`) ដក Signing Key បានវិញ។
    //    កូដមុនកែ ៖ `finally` ពិនិត្យ session ➜ `isGeneratingKey` ជាប់ `true` រហូតដល់ចាកចេញ។
    console.log('-- បិទប្រអប់ PIN ខណៈ Generate កំពុងរង់ចាំ --');
    for (const stage of ['clock', 'write']) {
        h = build({ privateKey: reloadKey });
        vm.runInContext(slice(['closeModal', 'clearPinInputValues', 'clearKeypairOutputs']) + '\nvar pinTargetAction = null;', h.ctx);
        h.getElementById('genDaysInput').value = '30';
        const pending = deferred();
        if (stage === 'clock') h.ctx.waitForServerTimeSync = () => pending.promise;
        else h.ctx.fb.update = () => pending.promise;
        const pinClosedGenerate = h.ctx.generateLicenseKey();
        await drain();
        ok(stage + ' ៖ Generate ចាក់សោមុនបិទប្រអប់ PIN', h.ctx.isGeneratingKey === true);
        h.getElementById('pinModal').classList.add('active');
        h.ctx.closeModal('pinModal');
        pending.resolve(true);
        await pinClosedGenerate;
        await drain();
        ok(stage + ' ៖ ⛔ បិទប្រអប់ PIN កណ្តាល Generate ➜ សោ Generate ដោះវិញ (ប៊ូតុងប្រើបាន · Signing Key ផុតពេលទំនេរបាន)',
            h.ctx.isGeneratingKey === false && !h.getElementById('genGenerateBtn').disabled,
            { isGeneratingKey: h.ctx.isGeneratingKey, disabled: h.getElementById('genGenerateBtn').disabled });
        ok(stage + ' ៖ ⛔ បិទប្រអប់ PIN មិនមែនការចាកចេញ ➜ Key ដែលបានបង្កើត (ចុះ DB) នៅបង្ហាញ (មិនមែន Key ខ្មោចក្នុងបញ្ជី)',
            h.ctx.lastGeneratedKey === 'signed-key' && h.getElementById('genResultKey').textContent === 'signed-key',
            { lastGeneratedKey: h.ctx.lastGeneratedKey, shown: h.getElementById('genResultKey').textContent });
        h.ctx.fb.update = () => { h.log.updates++; return Promise.resolve(); };
        h.ctx.waitForServerTimeSync = () => Promise.resolve(true);
        h.license.signNewKey = () => Promise.resolve({ keyString: 'synthetic-after-pin', payload: { id: 'SYNTHETICKEY00005', iat: 1, exp: 2592001 } });
        await h.ctx.generateLicenseKey();
        ok(stage + ' ៖ Generate បន្ទាប់បង្ហាញ Key បាន', h.ctx.lastGeneratedKey === 'synthetic-after-pin', h.ctx.lastGeneratedKey);
    }

    // ⛔ ការកែ Key (Extend · Revoke · ចំនួនឧបករណ៍ · ដោះឧបករណ៍) ៖ បិទប្រអប់ PIN កណ្តាលការសរសេរ (`closeModal('pinModal')` ពិត) មិនមែនការចាកចេញ ➜
    //    ✅ + Refresh បញ្ជីនៅបង្ហាញ។ ទិសផ្ទុយ ៖ ចាកចេញ ➜ ចូលវិញដោយគណនីដដែល (វគ្គថ្មី · `authGeneration` ថ្មី) ➜ ការសរសេរចាស់ចប់មិនប៉ះ UI វគ្គថ្មី។
    //    ដោះឧបករណ៍ (REST PATCH) ៖ verifyReleaseOverRest() R13។
    console.log('-- បិទប្រអប់ PIN ខណៈការកែ Key កំពុងសរសេរ --');
    for (const kind of ['extend', 'revoke', 'seat']) {
        h = build();
        vm.runInContext(slice(['closeModal', 'clearPinInputValues', 'clearKeypairOutputs']) + '\nvar pinTargetAction = null;', h.ctx);
        if (kind === 'extend') { h.ctx.openExtendModal('AAAAAAAAAAAAAAAA'); h.getElementById('extendDaysInput').value = '7'; }
        const pending = deferred();
        h.ctx.fb.update = () => { h.log.updates++; return pending.promise; };
        h.ctx.fb.set = () => { h.log.updates++; return pending.promise; };
        h.ctx.prompt = () => '2';
        const task = kind === 'extend' ? h.ctx.confirmExtendKey() : kind === 'revoke' ? h.ctx.toggleRevokeKey('AAAAAAAAAAAAAAAA')
            : kind === 'seat' ? h.ctx.setKeySeatLimit('AAAAAAAAAAAAAAAA') : h.ctx.releaseKeySeat('AAAAAAAAAAAAAAAA');
        await drain();
        ok(kind + ' ៖ លក្ខខណ្ឌចាំបាច់ ៖ ការសរសេរចាប់ផ្តើមមុនបិទប្រអប់ PIN', h.log.updates >= 1, h.log.updates);
        h.getElementById('pinModal').classList.add('active');
        h.ctx.closeModal('pinModal');
        pending.resolve();
        await task;
        await drain();
        ok(kind + ' ៖ ⛔ បិទប្រអប់ PIN កណ្តាលការសរសេរ ➜ ✅ នៅបង្ហាញ + Refresh បញ្ជី',
            h.log.toasts.some((t) => t.startsWith('✅')) && h.log.refreshed >= 1, { toasts: h.log.toasts, refreshed: h.log.refreshed, alerts: h.log.alerts });
    }
    {
        h = build();
        const pend = deferred();
        h.ctx.fb.update = () => { h.log.updates++; return pend.promise; };
        const task = h.ctx.toggleRevokeKey('AAAAAAAAAAAAAAAA');
        await drain();
        vm.runInContext('invalidateSensitiveSession(); isSignedInUiActive = false; authGeneration++; isSignedInUiActive = true;', h.ctx);
        pend.resolve();
        await task;
        await drain();
        ok('ទិសផ្ទុយ ៖ ចាកចេញ ➜ ចូលវិញ (គណនីដដែល) ➜ ការសរសេរចាស់ចប់មិនបង្ហាញ ✅/Refresh លើវគ្គថ្មី',
            !h.log.toasts.length && !h.log.refreshed, h.log);
    }

    console.log('-- Signing Key ចាស់ក្នុង session --');
    h = build({ sessionRecord: JSON.stringify({ iv: [1], data: [2] }) });
    h.license.verifyKeyString = () => Promise.resolve({ valid: false });
    await h.ctx.tryRestoreSigningKeyFromSession();
    ok('Private Key ចាស់មិនត្រូវ Load', h.ctx.signingPrivateKeyJwk === null);
    ok('session ciphertext មិនត្រឹមត្រូវត្រូវលុប', !h.storage.has('zoekeygen_signing_key_enc'));

    console.log('-- បន្ថែមសុពលភាព៖ target និង session ត្រូវនៅត្រឹមត្រូវក្រោយ await --');
    h = build();
    h.ctx.openExtendModal('AAAAAAAAAAAAAAAA');
    h.getElementById('extendDaysInput').value = '7';
    const clockWait = deferred();
    h.ctx.waitForServerTimeSync = () => clockWait.promise;
    const targetWrites = [];
    h.ctx.fb.update = (ref, value) => { targetWrites.push({ path: ref.path, value }); return Promise.resolve(); };
    const extendTask = h.ctx.confirmExtendKey();
    h.ctx.openExtendModal('BBBBBBBBBBBBBBBB');
    clockWait.resolve(true);
    await extendTask;
    ok('បើក Key B ខណៈ Key A រង់ចាំម៉ោង៖ សរសេរតែ Key A',
        targetWrites.length === 1 && targetWrites[0].path === 'license_keys/ADM/AAAAAAAAAAAAAAAA', targetWrites);
    ok('ថ្ងៃសុពលភាពយកពីការបញ្ជាក់ Key A មិនមែន input ថ្មី',
        targetWrites.length === 1 && targetWrites[0].value.expiresAt === 1000 + 7 * 86400000, targetWrites);
    ok('ការបញ្ចប់ Key A មិនបិទ modal ថ្មីរបស់ Key B', h.getElementById('extendModal').classList.contains('active'));

    h = build();
    h.ctx.openExtendModal('AAAAAAAAAAAAAAAA');
    const logoutClock = deferred();
    h.ctx.waitForServerTimeSync = () => logoutClock.promise;
    const logoutBeforeWrite = h.ctx.confirmExtendKey();
    h.ctx.invalidateSensitiveSession();
    h.ctx.auth.currentUser = { uid: 'other-admin' };
    h.ctx.db = { business: 'other' };
    logoutClock.resolve(true);
    await logoutBeforeWrite;
    ok('logout ឬប្តូរគណនីពេលរង់ចាំម៉ោង៖ មិនសរសេរទៅ database ថ្មី', h.log.updates === 0, h.log.updates);
    ok('សំណើរបស់ session ចាស់មិនបង្ហាញសារ ឬ refresh បញ្ជីថ្មី', !h.log.toasts.length && !h.log.alerts.length && !h.log.refreshed, h.log);

    for (const kind of ['extend', 'revoke']) {
        h = build();
        h.ctx.openExtendModal('AAAAAAAAAAAAAAAA');
        const pendingWrite = deferred();
        h.ctx.fb.update = () => { h.log.updates++; return pendingWrite.promise; };
        const pendingTask = kind === 'extend' ? h.ctx.confirmExtendKey() : h.ctx.toggleRevokeKey('AAAAAAAAAAAAAAAA');
        await drain();
        ok(kind + '៖ write ចាប់ផ្តើមមុន logout', h.log.updates === 1, h.log.updates);
        simulateLogout(h.ctx);
        pendingWrite.resolve();
        await pendingTask;
        ok(kind + '៖ write ចាស់បញ្ចប់ក្រោយ logout មិនបង្ហាញ success/refresh/បិទ modal',
            !h.log.toasts.length && !h.log.alerts.length && !h.log.refreshed && !h.log.closed, h.log);
    }

    h = build(); h.ctx.openExtendModal('AAAAAAAAAAAAAAAA');
    const dbClock = deferred(); h.ctx.waitForServerTimeSync = () => dbClock.promise;
    const databaseSwitch = h.ctx.confirmExtendKey();
    h.ctx.db = { business: 'other' };
    dbClock.resolve(true); await databaseSwitch;
    ok('ប្តូរ database តែមួយ ខណៈ auth generation នៅដដែល៖ មិនបន្ត write ក្រោយរង់ចាំម៉ោង',
        h.log.updates === 0 && !h.log.toasts.length && !h.log.alerts.length && !h.log.refreshed, h.log);

    for (const kind of ['extend', 'revoke']) {
        for (const failure of ['resolve', 'timeout']) {
            for (const change of ['db-only', 'logout']) {
                h = build(); h.ctx.openExtendModal('AAAAAAAAAAAAAAAA');
                const pending = deferred(); const timed = deferred();
                h.ctx.fb.update = () => { h.log.updates++; return pending.promise; };
                if (failure === 'timeout') h.ctx.withTimeout = () => timed.promise;
                const task = kind === 'extend' ? h.ctx.confirmExtendKey() : h.ctx.toggleRevokeKey('AAAAAAAAAAAAAAAA');
                await drain();
                ok(kind + '/' + failure + '/' + change + '៖ write ត្រូវចាប់ផ្តើមពិត', h.log.updates === 1);
                if (change === 'db-only') h.ctx.db = { business: 'other' };
                else simulateLogout(h.ctx);
                if (failure === 'timeout') timed.reject(new Error('Update timed out'));
                else pending.resolve();
                await task; pending.resolve();
                ok(kind + '/' + failure + '/' + change + '៖ completion ចាស់មិនប៉ះ UI ថ្មី',
                    !h.log.toasts.length && !h.log.alerts.length && !h.log.refreshed && !h.log.closed && !h.log.captures, h.log);
            }
        }
    }

    // ⛔ ការកែ Key ដែល **ព្យួរ** (អស់ពេល ១៥ វិ.) ខណៈ session នៅដដែល ៖ RTDB ចាក់ការសរសេរក្នុងជួរ ➜ វាអាចចុះពេលបណ្តាញមកវិញ ➜
    //    សារត្រូវជា «⏳ មិនទាន់បញ្ជាក់» (⛔ មិនមែន «មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ» ដែលធ្វើឲ្យ admin ធ្វើម្តងទៀត) ហើយការចុះយឺត ➜ ✅ (ចុះយឺត) + Refresh។
    //    ទិសផ្ទុយ ៖ ការបដិសេធពិត ➜ «មិនបាន» ដដែល · session ប្តូរ ➜ ស្ងាត់ (ផ្នែកខាងលើ)។
    //    ដោះឧបករណ៍ (REST PATCH · គ្មានការផ្ញើម្តងទៀត · ចម្លើយបាត់ ➜ អានត្រលប់) ៖ verifyReleaseOverRest() R2–R10។
    console.log('-- ការកែ Key ព្យួរ ➜ «⏳ មិនទាន់បញ្ជាក់» · ចុះយឺត ➜ ✅ --');
    const PENDING_RE = /^⏳ /;
    for (const kind of ['extend', 'revoke', 'seat']) {
        h = build(); h.ctx.openExtendModal('AAAAAAAAAAAAAAAA');
        h.ctx.prompt = () => '3';
        const pending = deferred(); const timed = deferred();
        h.ctx.fb.update = () => { h.log.updates++; return pending.promise; };
        h.ctx.fb.set = () => { h.log.updates++; return pending.promise; };
        h.ctx.withTimeout = () => timed.promise;
        const task = kind === 'extend' ? h.ctx.confirmExtendKey() : kind === 'revoke' ? h.ctx.toggleRevokeKey('AAAAAAAAAAAAAAAA') : h.ctx.setKeySeatLimit('AAAAAAAAAAAAAAAA');
        await drain();
        ok(kind + '/ព្យួរ ៖ write ចាប់ផ្តើមពិត', h.log.updates === 1, h.log.updates);
        timed.reject(new Error(kind === 'seat' ? 'Seat limit update timed out' : 'Update timed out'));
        await task; await drain();
        ok(kind + '/ព្យួរ ៖ សារ «⏳ មិនទាន់បញ្ជាក់» (មិនមែន «មិនបាន») · គ្មាន ✅ មុន commit',
            h.log.alerts.length === 1 && PENDING_RE.test(h.log.alerts[0]) && !h.log.toasts.some((t) => t.startsWith('✅')), h.log);
        pending.resolve(); await drain(); await drain();
        ok(kind + '/ព្យួរ ➜ ចុះយឺត ៖ ✅ (ចុះយឺត) + Refresh បញ្ជី',
            h.log.toasts.filter((t) => t.startsWith('✅') && /ចុះយឺត/.test(t)).length === 1 && h.log.refreshed >= 1, h.log);
    }
    {
        h = build();
        h.ctx.prompt = () => '3';
        h.ctx.fb.update = () => { h.log.updates++; return Promise.reject(new Error('PERMISSION_DENIED')); };
        await h.ctx.setKeySeatLimit('AAAAAAAAAAAAAAAA');
        await drain();
        ok('seat/បដិសេធពិត ➜ «មិនបាន» (ទិសផ្ទុយ ៖ មិនមែន ⏳ · ដោះឧបករណ៍ ៖ R10)',
            h.log.alerts.length === 1 && !PENDING_RE.test(h.log.alerts[0]) && /មិនបាន/.test(h.log.alerts[0]), h.log);
    }
    {
        h = build(); h.ctx.openExtendModal('AAAAAAAAAAAAAAAA');
        const pending = deferred(); const timed = deferred();
        h.ctx.fb.update = () => { h.log.updates++; return pending.promise; };
        h.ctx.withTimeout = () => timed.promise;
        const task = h.ctx.confirmExtendKey();
        await drain();
        timed.reject(new Error('Update timed out'));
        await task; await drain();
        simulateLogout(h.ctx);
        pending.resolve(); await drain(); await drain();
        ok('ព្យួរ ➜ ចាកចេញ ➜ ចុះយឺត ៖ គ្មាន ✅ លើ session ថ្មី', !h.log.toasts.some((t) => t.startsWith('✅')), h.log);
    }
    // ⛔ A504 ៖ «🔓 ដោះឧបករណ៍» ខណៈ Rules License ចាស់បដិសេធ `releasedAt` ➜ PATCH លុបតែកៅអី (ទាន់ពេល · ចម្លើយបាត់) ➜ សារ Publish Rules
    //    ⛔ មិនមែន «✅ បានដោះឧបករណ៍» ដែលប្រាប់ថាដោះពេញ ៖ verifyReleaseOverRest() R9។

    // ⛔ A504 ៖ Generate ព្យួរលើសពិដាន ➜ «⏳ មិនទាន់បញ្ជាក់» · ការសរសេរចុះយឺត ➜ Key string ត្រូវបង្ហាញក្នុងប្រអប់លទ្ធផល (ចម្លងប្រគល់អតិថិជនបាន)
    //    ⛔ មិនមែនត្រឹម toast ប្រាប់ id (Key សកម្មក្នុងបញ្ជី តែគ្មាននរណាយក Key string បាន) · ទិសផ្ទុយ ៖ Generate ថ្មីចាប់ផ្តើមក្រោយពិដាន ➜
    //    Key ចាស់ដែលចុះយឺតមិនជាន់ Key ថ្មីក្នុងប្រអប់ (អ្នកលក់មិនចម្លង Key ខុសថ្ងៃ/ឧបករណ៍)
    console.log('-- Generate ព្យួរ ➜ ចុះយឺត ➜ Key string បង្ហាញ --');
    for (const newer of ['none', 'written', 'clock-aborted', 'sign-aborted']) {
        h = build({ privateKey: reloadKey });
        h.ctx.console = { error() {}, log() {}, warn() {} };
        h.getElementById('genDaysInput').value = '30';
        h.getElementById('genResultBox').classList.add('hidden');
        const lateWrite = deferred(); const timed = deferred();
        h.ctx.fb.update = () => { h.log.updates++; return lateWrite.promise; };
        h.ctx.withTimeout = (promise, ms, message) => (message === 'Generate key timed out' ? timed.promise : promise);
        const task = h.ctx.generateLicenseKey();
        await drain();
        const label = 'Generate ព្យួរ/' + ({ none: 'គ្មាន Generate ថ្មី', written: 'Generate ថ្មីក្រោយពិដាន', 'clock-aborted': 'Generate ថ្មីឈប់មុនសរសេរ (ម៉ោង Server)', 'sign-aborted': 'Generate ថ្មីឈប់មុនសរសេរ (ចុះហត្ថលេខាមិនបាន)' })[newer];
        ok(label + ' ៖ លក្ខខណ្ឌចាំបាច់ — ការសរសេរចាប់ផ្តើម', h.log.updates === 1, h.log.updates);
        timed.reject(new Error('Generate key timed out'));
        await task; await drain();
        ok(label + ' ៖ «⏳ មិនទាន់បញ្ជាក់» · Key មិនទាន់បង្ហាញ · សោ Generate ដោះ',
            h.log.alerts.length === 1 && /^⏳ /.test(h.log.alerts[0]) && h.ctx.lastGeneratedKey === '' && h.ctx.isGeneratingKey === false, h.log.alerts);
        if (newer === 'written') {
            h.ctx.fb.update = () => { h.log.updates++; return Promise.resolve(); };
            h.ctx.withTimeout = (promise) => promise;
            h.license.signNewKey = () => Promise.resolve({ keyString: 'synthetic-newer-key', payload: { id: 'SYNTHETICKEY00002', iat: 1, exp: 2592001 } });
            await h.ctx.generateLicenseKey();
            ok(label + ' ៖ លក្ខខណ្ឌចាំបាច់ — Generate ថ្មីបង្ហាញ Key ថ្មី', h.ctx.lastGeneratedKey === 'synthetic-newer-key', h.ctx.lastGeneratedKey);
        } else if (newer !== 'none') {
            // ⛔ A505 (review) ៖ Generate ថ្មីដែលឈប់ **មុនចាប់ផ្តើមសរសេរ** (ម៉ោង Server មិនបាន · ចុះហត្ថលេខាមិនបាន) មិនបានបង្កើត Key ណាទេ ➜ មិនត្រូវ
            //    រាប់ជា «Generate ថ្មី» ដែលលាក់ Key ចាស់ចុះយឺត (មុនកែ ៖ ជំនាន់កើនពេលចាប់ផ្តើម ➜ Key ចាស់សកម្មក្នុងបញ្ជី តែគ្មាននរណាយក Key string បាន)
            const before = h.log.updates;
            if (newer === 'clock-aborted') h.ctx.waitForServerTimeSync = () => Promise.resolve(false);
            else h.license.signNewKey = () => Promise.reject(new Error('synthetic sign failure'));
            await h.ctx.generateLicenseKey();
            ok(label + ' ៖ លក្ខខណ្ឌចាំបាច់ — Generate ថ្មីឈប់មុនសរសេរ', h.log.updates === before && h.log.alerts.length === 2
                && h.ctx.isGeneratingKey === false && h.ctx.lastGeneratedKey === '', { updates: h.log.updates, alerts: h.log.alerts });
        }
        lateWrite.resolve(); await drain(); await drain();
        const lateToast = h.log.toasts.find((t) => /⏱️/.test(t)) || '';
        if (newer !== 'written') {
            ok('⛔ ' + label + ' ➜ ចុះយឺត ៖ Key string បង្ហាញក្នុងប្រអប់លទ្ធផល (ចម្លងបាន) · toast ប្រាប់ id · Refresh បញ្ជី',
                h.ctx.lastGeneratedKey === 'signed-key' && h.getElementById('genResultKey').textContent === 'signed-key'
                    && !h.getElementById('genResultBox').classList.contains('hidden') && /SYNTHETICKEY00001/.test(lateToast) && h.log.refreshed >= 1,
                { key: h.ctx.lastGeneratedKey, shown: h.getElementById('genResultKey').textContent, toasts: h.log.toasts, refreshed: h.log.refreshed });
        } else {
            ok(label + ' ➜ ចុះយឺត ៖ Key ចាស់មិនជាន់ Key ថ្មីក្នុងប្រអប់ · toast ប្រាប់ id ចាស់នៅ',
                h.ctx.lastGeneratedKey === 'synthetic-newer-key' && h.getElementById('genResultKey').textContent === 'synthetic-newer-key' && /SYNTHETICKEY00001/.test(lateToast),
                { key: h.ctx.lastGeneratedKey, shown: h.getElementById('genResultKey').textContent, toasts: h.log.toasts });
        }
    }

    {
        const h = build();
        h.getElementById('setupLookupSecretInput').value = 'private-header-probe';
        h.getElementById('setupLookupCodeOutput').textContent = '012345';
        h.getElementById('setupLinkResultText').textContent = 'https://zoew.example/#setup=sealed';
        h.getElementById('setupLinkQrContainer').innerHTML = '<svg></svg>';
        h.ctx.lastGeneratedSetupLink = 'https://zoew.example/#setup=sealed';
        h.ctx.invalidateSensitiveSession();
        ok('សម័យរសើបបញ្ចប់ ➜ លុប Header និងកូដ Setup Lookup ពីអេក្រង់',
            h.getElementById('setupLookupSecretInput').value === '' && h.getElementById('setupLookupCodeOutput').textContent === '');
        // ⛔ re-audit ៖ Link ដែលចាក់សោដោយកូដនេះប្រើលែងបានពេលកូដបាត់ ➜ Link · QR បាត់ជាមួយ (មុនកែ ៖ Link នៅលើអេក្រង់ គ្មានកូដ ➜ អ្នកលក់ផ្ញើ Link ដែលបើកមិនបាន)
        ok('re-audit ៖ កូដបាត់ ➜ Link · QR របស់វាបាត់ជាមួយ',
            h.getElementById('setupLinkResultText').textContent === '' && h.getElementById('setupLinkQrContainer').innerHTML === ''
                && h.ctx.lastGeneratedSetupLink === '');
        const hp = build();
        hp.getElementById('setupLinkResultText').textContent = 'https://zoew.example/#setup=plain';
        hp.ctx.lastGeneratedSetupLink = 'https://zoew.example/#setup=plain';
        hp.ctx.invalidateSensitiveSession();
        ok('re-audit ទិសផ្ទុយ ៖ Link Config ធម្មតា (គ្មានកូដ) នៅលើអេក្រង់', hp.getElementById('setupLinkResultText').textContent !== ''
            && hp.ctx.lastGeneratedSetupLink !== '');
    }

    // ⛔ deep audit ៩ (F5) ៖ «⏳ បន្ថែម» សរសេរ `now + days` ពីមុន ➜ Key នៅសល់ ៣០០ ថ្ងៃ «បន្ថែម» ៣០ ក្លាយជា ៣០ ថ្ងៃ · admin ២ (+៣៦៥ ហើយ +៧)
    //    ➜ ៧ ថ្ងៃ (៣៦៥ បាត់ស្ងាត់) ➜ ឧបករណ៍ទាំងអស់លែងប្រើបាននៅថ្ងៃទី ៣០/៧។ ច្បាប់ ៖ ថ្មី = max(ថ្ងៃផុតកំណត់លើ Server, ម៉ោង Server) + ថ្ងៃ ក្នុង
    //    transaction ដែលបោះបង់ពេលតម្លៃលើ Server ≠ តម្លៃដែល admin មើលឃើញ (កែពីកន្លែងផ្សេង ➜ Refresh + ប្រាប់) · Key បាត់ ➜ មិនបង្កើត។
    console.log('-- ⛔ Extend បន្ថែមលើថ្ងៃផុតកំណត់ (មិនសរសេរជាន់) --');
    {
        const DAY = 86400000;
        const extendOn = async (h, days) => {
            h.ctx.openExtendModal('AAAAAAAAAAAAAAAA');
            h.getElementById('extendDaysInput').value = String(days);
            await h.ctx.confirmExtendKey();
            await drain();
        };
        h = build();
        h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] = 1000 + 300 * DAY;
        h.ctx.keyListCache[0].perApp.ADM.expiresAt = 1000 + 300 * DAY;
        await extendOn(h, 30);
        ok('F5 ៖ Key នៅសល់ ៣០០ ថ្ងៃ · បន្ថែម ៣០ ➜ ៣៣០ ថ្ងៃ (មិនខ្លីជាងមុន)',
            h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] === 1000 + 330 * DAY && h.log.toasts.some((t) => t.startsWith('✅')),
            { days: (h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] - 1000) / DAY, log: h.log });
        h = build();
        h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] = 500;
        h.ctx.keyListCache[0].perApp.ADM.expiresAt = 500;
        await extendOn(h, 7);
        ok('F5 ៖ Key ផុតកំណត់រួច ➜ គិតពីម៉ោង Server (៧ ថ្ងៃពីថ្ងៃនេះ)', h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] === 1000 + 7 * DAY,
            (h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] - 1000) / DAY);
        h = build();
        await extendOn(h, 365);
        const afterFirst = h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'];
        h.log.toasts.length = 0; h.log.updates = 0;
        await extendOn(h, 7);
        ok('F5 ៖ admin ទី ២ មើលឃើញតម្លៃចាស់ (+៣៦៥ ពីឧបករណ៍ផ្សេង) ➜ មិនសរសេរជាន់ · ប្រាប់ «កែពីកន្លែងផ្សេង» · Refresh',
            afterFirst === 1000 + 365 * DAY && h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] === afterFirst && h.log.updates === 0
                && h.log.alerts.some((a) => /ផ្សេង/.test(a)) && h.log.refreshed >= 1 && !h.log.toasts.some((t) => t.startsWith('✅')),
            { days: (h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] - 1000) / DAY, log: h.log });
        h.ctx.keyListCache[0].perApp.ADM.expiresAt = afterFirst;
        h.log.alerts.length = 0;
        await extendOn(h, 7);
        ok('F5 ៖ ក្រោយ Refresh ➜ +៧ បន្ថែមលើ ៣៦៥ (= ៣៧២ ថ្ងៃ)', h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] === 1000 + 372 * DAY,
            (h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] - 1000) / DAY);
        h = build();
        delete h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'];
        await extendOn(h, 30);
        ok('F5 ៖ Key បាត់លើ Server ➜ មិនបង្កើតថ្ងៃផុតកំណត់ · ប្រាប់', h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] === undefined
            && h.log.updates === 0 && h.log.alerts.length === 1 && !h.log.toasts.some((t) => t.startsWith('✅')), h.log);

        // ⛔ re-audit (K1) ៖ SDK បោះបង់ transaction ដែលបានផ្ញើ ដោយ `disconnect` ទោះ Server អនុវត្តរួច ➜ «មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!» ហើយការចុចម្តងទៀត
        //    បន្ថែមថ្ងៃ ២ ដង។ ចម្លើយបាត់ ➜ អាន `expiresAt` ពី Server (REST) ៖ តម្លៃដែល updater នឹងសរសេរ (មានតែមួយ) = ចុះរួច · តម្លៃដែលបានឃើញ = មិនចុះ · ផ្សេង/អានមិនបាន ➜ ⏳
        const restReadback = (hh, mode) => {
            hh.ctx.URL = URL;
            hh.ctx.db = { app: { options: { databaseURL: 'https://kg-probe.firebaseio.com' } } };
            hh.ctx.appLocalStore = { getItem: (k) => (k === 'zoew_firebase_config' ? JSON.stringify({ databaseURL: 'https://kg-probe.firebaseio.com' }) : null) };
            hh.ctx.fetch = (url) => {
                if (mode === 'down') return Promise.reject(new TypeError('Failed to fetch'));
                const path = decodeURIComponent(String(url).replace(/^https:\/\/[^/]+\//, '').replace(/\.json.*$/, ''));
                const value = hh.keyServer[path] === undefined ? null : hh.keyServer[path];
                return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(value) });
            };
        };
        const lostAck = (hh, landed) => {
            const real = hh.ctx.fb.runTransaction;
            hh.ctx.fb.runTransaction = (ref, fn) => (landed ? real(ref, fn) : Promise.resolve())
                .then(() => Promise.reject(new Error('disconnect')));
        };
        for (const [label, landed, mode, expect] of [['ចុះរួច', true, 'up', 'applied'], ['មិនទាន់ចុះ', false, 'up', 'failed'], ['អានមិនបាន', true, 'down', 'pending']]) {
            h = build();
            h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] = 1000 + 300 * DAY;
            h.ctx.keyListCache[0].perApp.ADM.expiresAt = 1000 + 300 * DAY;
            restReadback(h, mode);
            lostAck(h, landed);
            await extendOn(h, 30);
            const days = (h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] - 1000) / DAY;
            const shown = expect === 'applied' ? h.log.toasts.some((t) => t.startsWith('✅')) && h.log.alerts.length === 0
                : expect === 'failed' ? h.log.alerts.some((a) => /មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ/.test(a)) && !h.log.toasts.some((t) => t.startsWith('✅'))
                    : h.log.alerts.some((a) => a === vm.runInContext('ADMIN_WRITE_PENDING_TEXT', h.ctx)) && !h.log.toasts.some((t) => t.startsWith('✅'));
            ok('K1 ៖ ចម្លើយ Extend បាត់ (' + label + ') ➜ ' + (expect === 'applied' ? '✅ (មិនប្រាប់ថាបរាជ័យ)' : expect === 'failed' ? 'ប្រាប់ថាមិនបាន' : '⏳ មិនទាន់បញ្ជាក់'),
                shown && days === (landed ? 330 : 300), { days, log: h.log });
        }

        // ⛔ re-audit A444 (S3) ៖ ការអានត្រលប់ក្រោយចម្លើយបាត់ទៅ Database របស់ប្រតិបត្តិការ (`operationDb`) ⛔ មិនមែន Config ដែលផ្ទាំងផ្សេងទើបរក្សាទុក
        //    (Config ថ្មីឆ្លើយ null ➜ ⏳ ក្លែងលើការសរសេរដែលចុះរួច)
        {
            h = build();
            h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] = 1000 + 300 * DAY;
            h.ctx.keyListCache[0].perApp.ADM.expiresAt = 1000 + 300 * DAY;
            restReadback(h, 'up');
            const fetched = [];
            const served = h.ctx.fetch;
            h.ctx.fetch = (url) => {
                fetched.push(new URL(String(url)).host);
                return /^https:\/\/kg-probe\./.test(String(url)) ? served(url) : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null) });
            };
            h.ctx.db = { app: { options: { databaseURL: 'https://kg-probe.firebaseio.com/' } } };
            h.ctx.appLocalStore = { getItem: (k) => (k === 'zoew_firebase_config' ? JSON.stringify({ databaseURL: 'https://kg-other.firebaseio.com' }) : null) };
            lostAck(h, true);
            await extendOn(h, 30);
            ok('S3 ៖ ចម្លើយបាត់ · ផ្ទាំងផ្សេងរក្សាទុក Config ផ្សេង ➜ អានត្រលប់ពី Database របស់ប្រតិបត្តិការ ➜ ✅',
                fetched.length === 1 && fetched[0] === 'kg-probe.firebaseio.com' && h.log.toasts.some((t) => t.startsWith('✅')) && h.log.alerts.length === 0,
                { fetched, log: h.log });
        }

        // ⛔ re-audit (K6) ៖ ចុច «រក្សាទុក» ២ ដងលឿន ➜ transaction ទី ២ ឃើញតម្លៃថ្មី ➜ សារ «កែពីឧបករណ៍ផ្សេង» ក្លែង ➜ ការចុចទី ២ ត្រូវមិនធ្វើអ្វី
        h = build();
        h.ctx.openExtendModal('AAAAAAAAAAAAAAAA');
        h.getElementById('extendDaysInput').value = '30';
        const twice = [h.ctx.confirmExtendKey(), h.ctx.confirmExtendKey()];
        await Promise.all(twice);
        await drain();
        ok('K6 ៖ ចុចពីរដង ➜ បន្ថែមម្តង · គ្មានសារ «កែពីឧបករណ៍ផ្សេង» ក្លែង',
            h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] === 1000 + 30 * DAY && !h.log.alerts.some((a) => /ផ្សេង/.test(a))
                && h.log.toasts.filter((t) => t.startsWith('✅')).length === 1, { days: (h.keyServer['license_keys/ADM/AAAAAAAAAAAAAAAA/expiresAt'] - 1000) / DAY, log: h.log });
    }

    // ⛔ deep audit ៩ (F2) ៖ «🔓 ដោះឧបករណ៍» លុបកៅអី + `releasedAt` (ម៉ោង server) ក្នុង update តែមួយ ➜ ឧបករណ៍ចាស់ដែលនៅដំណើរការឈប់ប្រើ Key
    //    (license-verify ៖ `activatedAt` ≤ `releasedAt` ➜ seat-released) · Rules License ចាស់បដិសេធ `releasedAt` ➜ ដោះកៅអីតែមួយ + ប្រាប់ឲ្យ Publish
    //    (update តែមួយផ្ញើតាម REST PATCH ៖ verifyReleaseOverRest() R1 · R9)
    console.log('-- ⛔ ដោះឧបករណ៍ ៖ releasedAt ជាមួយការលុបកៅអី --');
    {
        const restPatches = (f) => f.requests.filter((r) => r.method === 'PATCH').map((r) => r.body);
        h = releaseRestFixture();
        await h.ctx.releaseKeySeat('AAAAAAAAAAAAAAAA');
        await drain();
        const atomic = restPatches(h).find((body) => body && 'license_seats/ADM/AAAAAAAAAAAAAAAA' in body);
        ok('F2 ៖ ដោះ ➜ update តែមួយ ៖ license_seats null + license_keys/…/releasedAt = ម៉ោង server',
            restPatches(h).length === 1 && !!atomic && atomic['license_seats/ADM/AAAAAAAAAAAAAAAA'] === null
                && JSON.stringify(atomic['license_keys/ADM/AAAAAAAAAAAAAAAA/releasedAt']) === JSON.stringify({ '.sv': 'timestamp' })
                && h.log.toasts.some((t) => t.startsWith('✅')), { patches: restPatches(h), log: h.log });
        h = releaseRestFixture({ patch: ['refuse-stamp', 'ok'] });
        await h.ctx.releaseKeySeat('AAAAAAAAAAAAAAAA');
        await drain();
        const seatsOnly = restPatches(h).slice(1);
        // ⛔ re-audit (K2) ៖ ក្រោយ Rules ចាស់ ➜ កៅអីត្រូវលុបហើយ (គ្មានឧបករណ៍ក្នុងបញ្ជី) តែ Key គ្មាន `releasedAt` ➜ សារ «Publish Rules រួចដោះម្តងទៀត»
        //    ត្រូវដើរ ៖ ការដោះម្តងទៀតចុះត្រា `releasedAt` តែមួយ (មុនកែ ៖ «មិនទាន់ចងនឹងឧបករណ៍ណាទេ» ហើយមិនសរសេរ ➜ ឧបករណ៍ចាស់កក់កៅអីវិញ)
        {
            const hs = releaseRestFixture();
            await hs.ctx.releaseKeySeat('BBBBBBBBBBBBBBBB');
            await drain();
            const stamps = restPatches(hs);
            ok('K2 ៖ គ្មានឧបករណ៍ក្នុងបញ្ជី · Key គ្មាន releasedAt ➜ ចុះត្រា releasedAt (ដោះម្តងទៀតដើរ)',
                stamps.length === 1 && JSON.stringify(stamps[0]['license_keys/ADM/BBBBBBBBBBBBBBBB/releasedAt']) === JSON.stringify({ '.sv': 'timestamp' })
                    && hs.server.store.releasedAt['BBBBBBBBBBBBBBBB'] === RELEASE_STAMP_AT && hs.log.toasts.some((t) => t.startsWith('✅')), { stamps, log: hs.log });
            const hn = releaseRestFixture();
            hn.ctx.keyListCache[1].perApp.ADM.releasedAt = 900;
            await hn.ctx.releaseKeySeat('BBBBBBBBBBBBBBBB');
            await drain();
            ok('K2 ទិសផ្ទុយ ៖ Key មាន releasedAt រួច ហើយគ្មានឧបករណ៍ ➜ «គ្មានអ្វីត្រូវដោះ» · មិនសរសេរ',
                hn.requests.length === 0 && hn.sdk.length === 0 && hn.log.alerts.length === 1 && /មិនទាន់ចងនឹងឧបករណ៍/.test(hn.log.alerts[0]), hn.log);
        }
        ok('F2 ៖ Rules ចាស់បដិសេធ releasedAt ➜ ដោះកៅអីតែមួយ · ប្រាប់ឲ្យ Publish Rules (មិនមែន «ដោះមិនបាន»)',
            seatsOnly.length === 1 && JSON.stringify(seatsOnly[0]) === JSON.stringify({ 'license_seats/ADM/AAAAAAAAAAAAAAAA': null })
                && h.log.alerts.length === 1 && /Publish/.test(h.log.alerts[0]) && !/មិនបាន/.test(h.log.alerts[0]), { seatsOnly, log: h.log });
    }

    // ⛔ deep audit ៩ (P1) ៖ Reconfig ទៅ License Project ផ្សេង (`initFirebase()` ពិត ៖ ផ្តាច់ app ចាស់) ខណៈបញ្ជី Key របស់ Project ចាស់នៅលើអេក្រង់ ➜
    //    ការចុច Revoke/Extend លើជួរចាស់មុន Refresh មិនត្រូវសរសេរ stub ចូល Project ថ្មីទេ (cache បញ្ជីត្រូវជម្រះពេល teardown)
    console.log('-- ⛔ Reconfig ៖ ជួរ Key ចាស់មិនសរសេរចូល Project ថ្មី --');
    {
        h = build();
        const writes = [];
        const app = { name: 'old' };
        Object.assign(h.ctx, {
            firebaseConfig: null, isInitializingFirebase: false, firebaseSdkUnavailable: false, sdkUnavailableNoticeShown: false,
            authUnsubscribe: null, authRecoveryTimeout: null, serverTimeSynced: true, serverTimeOffsetMs: 0, isDatabaseConnected: true,
            hasEverConnectedToDatabase: true, networkJustReturned: false, isDatabaseInitialized: true, firebaseApp: null,
            dbRefConnected: null, dbRefServerTimeOffset: null, noticeListCache: [{ id: 'notice-old' }],
            appLocalStore: { getItem: () => '{"apiKey":"k","databaseURL":"https://project-b.firebaseio.com"}' },
            checkPinAndOpenConfig() {}, resetFirebaseSdkRetryHealth() {}, detachInfoListeners() {}, attachInfoListeners() {}, setupAuthListener() {},
            enforceSessionOnlyAuthPersistence: async () => {}, armLateFirebaseSdkListener() {}, renderConnectionStatus() {}, scheduleFirebaseSdkRetry() {},
            firebaseSdkNeedsRefresh: () => false, FIREBASE_SDK_REFRESH_TEXT: ''
        });
        let apps = [app];
        h.ctx.waitForFirebaseSDK = async () => Object.assign(h.ctx.fb, {
            getApps: () => apps, deleteApp: async () => { apps = []; }, initializeApp: () => { apps = [{ name: 'new' }]; return apps[0]; },
            getAuth: () => h.ctx.auth, getDatabase: () => ({ project: 'B' }), goOnline() {}, ref: (db, p) => ({ db, path: p }),
            update: (ref, value) => { writes.push({ db: ref.db, path: ref.path, value }); return Promise.resolve(); }
        });
        vm.runInContext(slice(['initFirebase']), h.ctx);
        const reconfigured = await h.ctx.initFirebase();
        ok('P1 ៖ លក្ខខណ្ឌចាំបាច់ ៖ initFirebase ពិតបាន teardown + ភ្ជាប់ Project ថ្មី', reconfigured === true && h.ctx.db && h.ctx.db.project === 'B', { reconfigured, db: h.ctx.db });
        await h.ctx.toggleRevokeKey('AAAAAAAAAAAAAAAA');
        await drain();
        ok('P1 ៖ ⛔ ចុច Revoke លើជួរ Key របស់ Project ចាស់ ក្រោយ Reconfig ➜ មិនសរសេរចូល Project ថ្មី',
            writes.length === 0 && !h.log.toasts.some((t) => t.startsWith('✅')), { writes, log: h.log });
        ok('P1 ៖ cache បញ្ជី Key និងដំណឹងត្រូវជម្រះ', vm.runInContext('keyListCache.length === 0 && noticeListCache.length === 0', h.ctx));
    }

    console.log('-- Clipboard៖ API មិនមាន ឬបដិសេធ មិនត្រូវចម្លងស្ងាត់ ឬអះអាងក្លែងក្លាយ --');
    function clipboardFixture(mode) {
        const f = build();
        const state = { native: [], fallback: [], temporary: [], removed: [] };
        const el = f.getElementById('newPrivateKeyOutput'); el.value = 'synthetic-private-key';
        el.select = () => { state.selected = el.value; };
        el.removeAttribute = () => {}; el.setAttribute = () => {};
        f.ctx.lastGeneratedKey = 'synthetic-generated-key';
        f.ctx.lastGeneratedSetupLink = 'https://synthetic.example/?setup=synthetic-config';
        f.ctx.navigator = {};
        if (mode !== 'unavailable' && mode !== 'failed-fallback') {
            f.ctx.navigator.clipboard = { writeText(value) {
                state.native.push(value);
                if (mode === 'throws') throw new Error('synthetic-denied');
                return mode === 'rejected' || mode === 'rejected-fallback' ? Promise.reject(new Error('synthetic-denied')) : Promise.resolve();
            } };
        }
        f.ctx.document.body = { appendChild(node) { state.temporary.push(node); } };
        f.ctx.document.createElement = () => {
            const node = { value: '', style: {}, setAttribute() {},
                select() { state.selected = node.value; },
                remove() { state.removed.push(node.value); state.temporary.splice(state.temporary.indexOf(node), 1); }
            };
            return node;
        };
        f.ctx.document.execCommand = () => {
            state.fallback.push(state.selected);
            return mode !== 'failed-fallback' && mode !== 'rejected-fallback';
        };
        return Object.assign(f, { state });
    }
    for (const kind of ['private', 'generated', 'setup']) {
        for (const mode of ['native', 'unavailable', 'rejected', 'throws', 'failed-fallback', 'rejected-fallback']) {
            const f = clipboardFixture(mode);
            let threw = false;
            try {
                if (kind === 'private') await f.ctx.copyTextarea('newPrivateKeyOutput');
                else if (kind === 'generated') await f.ctx.copyGeneratedKey();
                else await f.ctx.copySetupLink();
            } catch (_) { threw = true; }
            await drain();
            const expected = kind === 'private' ? 'synthetic-private-key' : kind === 'generated'
                ? 'synthetic-generated-key' : 'https://synthetic.example/?setup=synthetic-config';
            const copied = mode === 'native' ? f.state.native : f.state.fallback;
            if (mode === 'failed-fallback' || mode === 'rejected-fallback') {
                ok(kind + '៖ copy បរាជ័យមិនអះអាង success និងប្រាប់ឲ្យចម្លងដោយដៃ',
                    !threw && !f.ctx.keypairPrivateCopied && !f.log.toasts.some((t) => t.startsWith('✅'))
                    && f.log.toasts.some((t) => t.startsWith('⚠️')), f.log);
            } else {
                ok(kind + ' ' + mode + '៖ ចម្លងតម្លៃពិត រួចទើបបញ្ជាក់ success',
                    !threw && copied.length === 1 && copied[0] === expected
                    && f.log.toasts.filter((t) => t.startsWith('✅')).length === 1
                    && (kind !== 'private' || f.ctx.keypairPrivateCopied), { copied, log: f.log });
            }
            ok(kind + ' ' + mode + '៖ មិនទុក secret ក្នុង textarea បណ្តោះអាសន្ន',
                f.state.temporary.length === 0 && f.state.removed.every((value) => value === ''));
        }
    }
    for (const change of ['logout', 'new-value']) {
        for (const result of ['resolve', 'reject']) {
            const f = clipboardFixture('native'); const pendingCopy = deferred();
            f.ctx.navigator.clipboard.writeText = () => pendingCopy.promise;
            const copying = f.ctx.copyTextarea('newPrivateKeyOutput');
            if (change === 'logout') f.ctx.invalidateSensitiveSession();
            else f.getElementById('newPrivateKeyOutput').value = 'synthetic-new-private-key';
            if (result === 'resolve') pendingCopy.resolve(); else pendingCopy.reject(new Error('synthetic-denied'));
            await copying; await drain();
            ok('Clipboard យឺត ' + change + '/' + result + '៖ មិនចម្លង fallback ឬទទួលស្គាល់ key ថ្មីជំនួស',
                !f.state.fallback.length && !f.ctx.keypairPrivateCopied && !f.log.toasts.length, f.log);
        }
    }

    // ⛔ Signing Private Key (អ្នកណាមានវាក្លែង Activation Key បានទាំងអស់) មិនត្រូវនៅក្នុងសតិជារៀងរហូតពេល ZoeKeyGen បើកទុកចោល ៖
    //    មិនប្រើ ≥ SIGNING_KEY_IDLE_MS ➜ ដកចេញពីសតិ (សោ AES របស់ Session ផង ➜ ការស្តារត្រូវការ PIN) · ច្បាប់ចម្លងអ៊ិនគ្រីបក្នុង Session នៅ ·
    //    សកម្មភាព (ចុច/វាយ) ពន្យារពេល · កំពុង Generate ➜ មិនដក · នាឡិកាថយក្រោយ ➜ ដក (fail-closed)
    console.log('-- Signing Key ទុកចោល ➜ ដកចេញពីសតិ --');
    function idleFixture() {
        const f = build({ privateKey: { kty: 'EC', crv: 'P-256', d: 'idle-private', x: 'x', y: 'y' } });
        f.clock = { now: 1700000000000 };
        f.ctx.Date = class extends Date { static now() { return f.clock.now; } };
        f.ctx.performance = { now: () => f.clock.now };
        f.ctx.__pinPrompts = 0;
        vm.runInContext(realDecl('SIGNING_KEY_IDLE_MS') + '\nvar signingKeyLastUseAt = 0;', f.ctx);
        vm.runInContext(slice(['elapsedSince', 'noteSigningKeyActivity', 'expireIdleSigningKey', 'requestSessionSigningKeyRestoreIfEligible']), f.ctx);
        f.ctx.isPinFlowPending = () => f.ctx.__pinPrompts > 0;
        f.ctx.requestPinBeforeConfig = () => { f.ctx.__pinPrompts++; };
        f.storage.set('zoekeygen_signing_key_enc', '{"iv":[1],"data":[2]}');
        vm.runInContext('signingKeyLastUseAt = keygenIdleStamp();', f.ctx);
        return f;
    }
    const idleMs = vm.runInNewContext(realDecl('SIGNING_KEY_IDLE_MS').replace(/^const /, 'var ') + '; SIGNING_KEY_IDLE_MS');
    ok('SIGNING_KEY_IDLE_MS ជាលេខ ៥–៣០ នាទី', idleMs >= 5 * 60000 && idleMs <= 30 * 60000, idleMs);
    let idle = idleFixture();
    idle.clock.now += idleMs - 1000;
    ok('មិនទាន់ដល់ពិដាន ➜ Key នៅ', idle.ctx.expireIdleSigningKey() === false && vm.runInContext('!!signingPrivateKeyJwk', idle.ctx));
    idle.ctx.noteSigningKeyActivity();
    idle.clock.now += idleMs - 1000;
    ok('សកម្មភាពពន្យារពិដាន ➜ Key នៅ', idle.ctx.expireIdleSigningKey() === false && vm.runInContext('!!signingPrivateKeyJwk', idle.ctx));
    idle.clock.now += 2000;
    const genBefore = vm.runInContext('sensitiveSessionGeneration', idle.ctx);
    ok('⛔ ដល់ពិដាន ➜ Key ចេញពីសតិ · សោ Session ចេញ · ប្រតិបត្តិការដែលកំពុងហោះអស់សុពលភាព',
        idle.ctx.expireIdleSigningKey() === true && vm.runInContext('signingPrivateKeyJwk === null && signingKeySessionKey === null', idle.ctx)
        && vm.runInContext('sensitiveSessionGeneration', idle.ctx) > genBefore);
    ok('ច្បាប់ចម្លងអ៊ិនគ្រីបក្នុង Session នៅ ➜ សុំ PIN ដើម្បីស្តារ · សារប្រាប់អ្នកប្រើ',
        idle.storage.has('zoekeygen_signing_key_enc') && idle.ctx.__pinPrompts === 1 && idle.log.toasts.some((t) => /ដកចេញពីសតិ/.test(t)), idle.log.toasts);
    ok('សារប្រាប់ផ្លូវពិត ៖ ប្រអប់ PIN បើក ➜ «វាយ PIN ដើម្បីស្ដារ» (មិនមែន «Load»)',
        idle.log.toasts.some((t) => /វាយ PIN ដើម្បីស្ដារ/.test(t)) && !idle.log.toasts.some((t) => /Load/.test(t)), idle.log.toasts);
    idle = idleFixture();
    idle.storage.delete('zoekeygen_signing_key_enc');
    idle.clock.now += idleMs + 1000;
    idle.ctx.expireIdleSigningKey();
    ok('គ្មានច្បាប់ចម្លងក្នុង Session ➜ មិនសុំ PIN · សារ «Load ម្តងទៀត»',
        idle.ctx.__pinPrompts === 0 && idle.log.toasts.some((t) => /Load ម្តងទៀត/.test(t)), idle.log.toasts);
    idle = idleFixture();
    vm.runInContext('isGeneratingKey = true;', idle.ctx);
    idle.clock.now += idleMs * 3;
    ok('កំពុង Generate Key ➜ មិនដក', idle.ctx.expireIdleSigningKey() === false && vm.runInContext('!!signingPrivateKeyJwk', idle.ctx));
    idle = idleFixture();
    idle.clock.now -= 60000;
    ok('⛔ នាឡិកាថយក្រោយ ➜ ដក (fail-closed)', idle.ctx.expireIdleSigningKey() === true && vm.runInContext('signingPrivateKeyJwk === null', idle.ctx));
    // ⛔ A504 ៖ ចុច/វាយដំបូងក្រោយទុកចោលលើសពិដាន (ភ្ញាក់ពីការដេក ៖ ផ្ទាំងនៅមើលឃើញ គ្មាន visibilitychange · វដ្ត ៣០ វិ. មិនទាន់ដល់)
    //    ➜ listener pointerdown/keydown ត្រូវដក Key **មុន** មិនត្រូវចុះត្រាសកម្មភាពថ្មីលើ Key ដែលផុតពិដានរួច (ដូច sbAdminActivity)
    idle = idleFixture();
    idle.clock.now += idleMs + 1000;
    const wakeGeneration = vm.runInContext('sensitiveSessionGeneration', idle.ctx);
    idle.ctx.noteSigningKeyActivity();
    ok('⛔ ចុច/វាយដំបូងក្រោយទុកចោលលើសពិដាន ➜ ដក Key មុន (មិនពន្យារពិដាន) · ប្រតិបត្តិការចាស់អស់សុពលភាព · ការពិនិត្យវដ្តក្រោយគ្មានអ្វីត្រូវដក',
        vm.runInContext('signingPrivateKeyJwk === null && signingKeySessionKey === null && signingKeyLastUseAt === 0', idle.ctx)
        && vm.runInContext('sensitiveSessionGeneration', idle.ctx) > wakeGeneration && idle.ctx.expireIdleSigningKey() === false
        && idle.log.toasts.some((t) => /ដកចេញពីសតិ/.test(t)),
        { loaded: vm.runInContext('!!signingPrivateKeyJwk', idle.ctx), lastUse: vm.runInContext('signingKeyLastUseAt', idle.ctx), toasts: idle.log.toasts });
    idle = idleFixture();
    idle.clock.now += idleMs - 1000;
    idle.ctx.noteSigningKeyActivity();
    ok('ទិសផ្ទុយ ៖ ចុច/វាយមុនដល់ពិដាន ➜ Key នៅ · ត្រាសកម្មភាព = ឥឡូវ',
        vm.runInContext('!!signingPrivateKeyJwk && signingKeyLastUseAt.wall === Date.now()', idle.ctx) && !idle.log.toasts.length, idle.log.toasts);
    idle = build();
    vm.runInContext(realDecl('SIGNING_KEY_IDLE_MS') + '\nvar signingKeyLastUseAt = 5;', idle.ctx);
    vm.runInContext(slice(['clearSigningKey']), idle.ctx);
    idle.ctx.clearSigningKey(true);
    ok('ចាកចេញ/សម្អាត ➜ ត្រាសកម្មភាពត្រឡប់ ០', vm.runInContext('signingKeyLastUseAt', idle.ctx) === 0);
    idle = build();
    vm.runInContext('var signingKeyLastUseAt = 0;', idle.ctx);
    idle.getElementById('privateKeyInput').value = JSON.stringify({ kty: 'EC', crv: 'P-256', d: 'fresh', x: 'x', y: 'y' });
    await idle.ctx.loadSigningKey();
    await drain();
    ok('Load Signing Key ➜ ចាប់ផ្តើមនាឡិកាទុកចោល (ត្រា > 0)', vm.runInContext('!!signingPrivateKeyJwk && signingKeyLastUseAt.wall > 0', idle.ctx));
    const bootBlock = src.slice(src.indexOf("document.addEventListener('DOMContentLoaded'"));
    ok('⛔ ខ្សែភ្ជាប់ ៖ DOMContentLoaded ចង pointerdown/keydown ➜ noteSigningKeyActivity · setInterval ➜ expireIdleSigningKey · visibilitychange (មើលឃើញ) ➜ expireIdleSigningKey',
        /addEventListener\('pointerdown', noteSigningKeyActivity/.test(bootBlock) && /addEventListener\('keydown', noteSigningKeyActivity/.test(bootBlock)
        && /setInterval\(expireIdleSigningKey, \d+\)/.test(bootBlock)
        && /'visibilitychange', \(\) => \{\s*if \(document\.hidden\) return;\s*expireIdleSigningKey\(\);/.test(bootBlock));

    // ⛔ សំណើម្ចាស់គម្រោង (ពង្រឹងសុវត្ថិភាព) ៖ សម័យ Admin (Revoke · Extend · កៅអី · ដំណឹង) មិនត្រូវនៅបើកជារៀងរហូតលើឧបករណ៍ដែលទុកចោល
    //    ➜ មិនប្រើ ≥ KEYGEN_IDLE_LOGOUT_MS ➜ ចាក់សោវគ្គ (Signing Key · Supabase Admin ចេញពីសតិ) រួចចាកចេញ (`logoutApp(true)` គ្មាន confirm)
    //    · សកម្មភាពពន្យារ · មិនទាន់ចូល/កំពុង Generate/Keypair មិនទាន់ចម្លង ➜ មិនចាកចេញ · នាឡិកាថយក្រោយ ➜ ចាកចេញ (fail-closed)
    console.log('-- ចាកចេញស្វ័យប្រវត្តិក្រោយមិនប្រើ (សម័យ Admin) --');
    function idleLogoutFixture(loggedIn) {
        const f = build();
        f.clock = { now: 1700000000000 };
        f.ctx.Date = class extends Date { static now() { return f.clock.now; } };
        f.ctx.performance = { now: () => f.clock.now };
        f.ctx.__logouts = [];
        f.ctx.__locks = [];
        f.ctx.logoutApp = (auto) => { f.ctx.__logouts.push(auto === true); };
        f.ctx.lockKeygenSession = (silent) => { f.ctx.__locks.push(silent === true); };
        f.ctx.hasUncopiedKeypair = () => false;
        vm.runInContext(realDecl('KEYGEN_IDLE_LOGOUT_MS') + '\nvar keygenLastActivityAt = 0; authButtonIsLoggedIn = ' + (loggedIn ? 'true' : 'false') + '; isGeneratingKey = false;', f.ctx);
        vm.runInContext(slice(['elapsedSince', 'noteKeygenActivity', 'expireIdleKeygenSession', 'khmerMinutes']), f.ctx);
        vm.runInContext('keygenLastActivityAt = keygenIdleStamp();', f.ctx);
        return f;
    }
    const logoutMs = vm.runInNewContext(realDecl('KEYGEN_IDLE_LOGOUT_MS').replace(/^const /, 'var ') + '; KEYGEN_IDLE_LOGOUT_MS');
    ok('KEYGEN_IDLE_LOGOUT_MS ជាលេខ ១០–៦០ នាទី ហើយ ≥ SIGNING_KEY_IDLE_MS', logoutMs >= 10 * 60000 && logoutMs <= 60 * 60000 && logoutMs >= idleMs, logoutMs);
    let il = idleLogoutFixture(false);
    il.clock.now += logoutMs * 3;
    ok('មិនទាន់ចូល ➜ មិនចាកចេញ', il.ctx.expireIdleKeygenSession() === false && il.ctx.__logouts.length === 0);
    il = idleLogoutFixture(true);
    il.clock.now += logoutMs - 1000;
    ok('ចូលរួច · មិនទាន់ដល់ពិដាន ➜ នៅ', il.ctx.expireIdleKeygenSession() === false && il.ctx.__logouts.length === 0);
    il.ctx.noteKeygenActivity();
    il.clock.now += logoutMs - 1000;
    ok('សកម្មភាពពន្យារពិដាន ➜ នៅ', il.ctx.expireIdleKeygenSession() === false && il.ctx.__logouts.length === 0);
    il.clock.now += 2000;
    ok('⛔ ដល់ពិដាន ➜ ចាក់សោវគ្គ (silent) រួចចាកចេញ (auto · គ្មាន confirm) · ត្រាសកម្មភាព ០ · សារប្រាប់',
        il.ctx.expireIdleKeygenSession() === true && JSON.stringify(il.ctx.__locks) === '[true]' && JSON.stringify(il.ctx.__logouts) === '[true]'
        && vm.runInContext('keygenLastActivityAt', il.ctx) === 0 && il.log.toasts.some((t) => /ស្វ័យប្រវត្តិ/.test(t)), { locks: il.ctx.__locks, logouts: il.ctx.__logouts, toasts: il.log.toasts });
    il = idleLogoutFixture(true);
    vm.runInContext('isGeneratingKey = true;', il.ctx);
    il.clock.now += logoutMs * 3;
    ok('កំពុង Generate Key ➜ មិនចាកចេញ', il.ctx.expireIdleKeygenSession() === false && il.ctx.__logouts.length === 0);
    il = idleLogoutFixture(true);
    il.ctx.hasUncopiedKeypair = () => true;
    il.clock.now += logoutMs * 3;
    ok('Keypair ថ្មីមិនទាន់ចម្លង ➜ មិនចាកចេញ (Private Key មិនបាត់ស្ងាត់)', il.ctx.expireIdleKeygenSession() === false && il.ctx.__logouts.length === 0);
    il = idleLogoutFixture(true);
    il.clock.now -= 60000;
    ok('⛔ នាឡិកាថយក្រោយ ➜ ចាកចេញ (fail-closed)', il.ctx.expireIdleKeygenSession() === true && il.ctx.__logouts.length === 1);
    // ⛔ A504 ៖ ចុច/វាយដំបូងក្រោយទុកចោលលើស KEYGEN_IDLE_LOGOUT_MS (មុនវដ្ត ៣០ វិ. · គ្មាន visibilitychange) ➜ ចាកចេញមុន មិនពន្យារវគ្គ Admin
    il = idleLogoutFixture(true);
    il.clock.now += logoutMs + 1000;
    il.ctx.noteKeygenActivity();
    ok('⛔ ចុច/វាយដំបូងក្រោយទុកចោលលើសពិដាន ➜ ចាក់សោវគ្គ + ចាកចេញ (auto) មុន · មិនចុះត្រាសកម្មភាពថ្មី',
        JSON.stringify(il.ctx.__locks) === '[true]' && JSON.stringify(il.ctx.__logouts) === '[true]' && vm.runInContext('keygenLastActivityAt', il.ctx) === 0
        && il.log.toasts.some((t) => /ស្វ័យប្រវត្តិ/.test(t)), { locks: il.ctx.__locks, logouts: il.ctx.__logouts, last: vm.runInContext('keygenLastActivityAt', il.ctx) });
    il = idleLogoutFixture(true);
    il.clock.now += logoutMs - 1000;
    il.ctx.noteKeygenActivity();
    ok('ទិសផ្ទុយ ៖ ចុច/វាយមុនដល់ពិដាន ➜ នៅចូល · ត្រាសកម្មភាព = ឥឡូវ',
        il.ctx.__logouts.length === 0 && vm.runInContext('keygenLastActivityAt.wall === Date.now()', il.ctx), { logouts: il.ctx.__logouts });
    ok('⛔ ខ្សែភ្ជាប់ ៖ pointerdown/keydown ➜ noteKeygenActivity · setInterval ➜ expireIdleKeygenSession · visibilitychange ➜ expireIdleKeygenSession',
        /\['pointerdown', 'keydown'\]\.forEach\(\(evt\) => document\.addEventListener\(evt, noteKeygenActivity, \{ capture: true, passive: true \}\)\)/.test(bootBlock)
        && /setInterval\(expireIdleKeygenSession, \d+\)/.test(bootBlock)
        && /'visibilitychange', \(\) => \{\s*if \(document\.hidden\) return;[\s\S]{0,200}expireIdleKeygenSession\(\);/.test(bootBlock));
    ok('⛔ ការចូល (updateAuthButton(true)) ចាប់ផ្តើមនាឡិកាទុកចោល',
        /function updateAuthButton\(isLoggedIn\) \{[\s\S]*?if \(authButtonIsLoggedIn\) keygenLastActivityAt = keygenIdleStamp\(\);/.test(src));
    // logoutApp(auto) ៖ auto ➜ មិនសួរ confirm ទោះ Keypair មិនទាន់ចម្លង · ដោយដៃ ➜ សួរ
    const lo = build();
    lo.ctx.__confirms = 0; lo.ctx.__signOuts = 0;
    lo.ctx.confirm = () => { lo.ctx.__confirms++; return false; };
    lo.ctx.hasUncopiedKeypair = () => true;
    lo.ctx.updateAuthButton = () => {};
    lo.ctx.showLoginModalWithPrefill = () => {};
    lo.ctx.fb = { signOut: () => { lo.ctx.__signOuts++; return Promise.resolve(); } };
    vm.runInContext('var pendingRoleRecheck = false;', lo.ctx);
    vm.runInContext(slice(['logoutApp']), lo.ctx);
    lo.ctx.logoutApp();
    const manual = { confirms: lo.ctx.__confirms, signOuts: lo.ctx.__signOuts };
    lo.ctx.logoutApp(true);
    ok('logoutApp() ដោយដៃ ➜ confirm (Keypair មិនទាន់ចម្លង) · បដិសេធ ➜ មិនចាកចេញ · logoutApp(true) ➜ ចាកចេញដោយគ្មាន confirm',
        manual.confirms === 1 && manual.signOuts === 0 && lo.ctx.__confirms === 1 && lo.ctx.__signOuts === 1, { manual, confirms: lo.ctx.__confirms, signOuts: lo.ctx.__signOuts });
    // lockKeygenSession ៖ ដក Signing Key · Supabase Admin · ជំនាន់ session រសើប · toast លុះត្រាតែ silent
    const lk = build();
    lk.ctx.__calls = [];
    lk.ctx.clearSigningKey = (silent) => { lk.ctx.__calls.push('clearSigningKey:' + silent); };
    lk.ctx.sbAdminLogout = () => { lk.ctx.__calls.push('sbAdminLogout'); };
    lk.ctx.invalidateSensitiveSession = () => { lk.ctx.__calls.push('invalidate'); };
    lk.ctx.refreshKgStatus = () => { lk.ctx.__calls.push('refresh'); };
    vm.runInContext('var sbAdminSession = { token: "t" };', lk.ctx);
    vm.runInContext(slice(['lockKeygenSession']), lk.ctx);
    lk.ctx.lockKeygenSession(true);
    const silentCalls = lk.ctx.__calls.slice();
    const toastsBefore = lk.log.toasts.length;
    vm.runInContext('sbAdminSession = null;', lk.ctx);
    lk.ctx.lockKeygenSession(false);
    ok('lockKeygenSession ៖ clearSigningKey(true) · sbAdminLogout រួមទាំង pending login · invalidateSensitiveSession · refresh · toast តែពេលមិន silent',
        JSON.stringify(silentCalls) === '["clearSigningKey:true","sbAdminLogout","invalidate","refresh"]' && toastsBefore === 0
        && JSON.stringify(lk.ctx.__calls.slice(4)) === '["clearSigningKey:true","sbAdminLogout","invalidate","refresh"]'
        && lk.log.toasts.length === 1 && /ចាក់សោ/.test(lk.log.toasts[0]), { silentCalls, calls: lk.ctx.__calls, toasts: lk.log.toasts });

    // ⛔ សំណើម្ចាស់គម្រោង ៖ Private Key ដែល ZoeKeyGen បង្កើត (`JSON.stringify(exportKey)` ៖ មាន `key_ops` · `ext`) ហើយចម្លងតាម chat/Notes/Password Manager
    //    ត្រូវ Load បាន ៖ « » “ ” · តួមើលមិនឃើញ · អត្ថបទជុំវិញ · បន្ទាត់បាក់កណ្តាលតម្លៃ · CRLF · ' ➜ JWK ស្អាតតែ kty·crv·d·x·y ទៅ signNewKey ·
    //    Public Key ➜ សារ «នេះជា Public Key» · អត្ថបទមិនមែន JSON ➜ សារ JSON · Keypair ថ្មីដែល Public Key មិនទាន់ deploy ➜ សារប្រាប់ឲ្យ Deploy · ⛔ គ្មាន Sentry សម្រាប់កំហុសអ្នកប្រើ។
    console.log('-- Private Key ៖ normalizer ការចម្លង --');
    const genKey = { key_ops: ['sign'], ext: true, kty: 'EC', x: 'Xpub-Abc_123', y: 'Ypub-Def_456', crv: 'P-256', d: 'Dpriv-Ghi_789' };
    const clean = { kty: 'EC', crv: 'P-256', d: 'Dpriv-Ghi_789', x: 'Xpub-Abc_123', y: 'Ypub-Def_456' };
    const genText = JSON.stringify(genKey);
    const variants = {
        'output ពិតរបស់ Generate (key_ops · ext)': genText,
        '“ ” smart quotes (Notes/iOS)': genText.replace(/"/g, (m, i) => (i % 2 ? '\u201C' : '\u201D')),
        'តួមើលមិនឃើញ (ZWSP · BOM · NBSP)': '\u200B' + genText.replace(':', ':\u00A0') + '\uFEFF',
        'អត្ថបទជុំវិញ (chat)': 'Private Key ៖ ' + genText + ' (កុំចែក)',
        'បន្ទាត់បាក់កណ្តាលតម្លៃ': genText.replace('Dpriv-Ghi', 'Dpriv-\n Ghi'),
        'JSON ស្អាតមានបន្ទាត់ CRLF': JSON.stringify(genKey, null, 2).replace(/\n/g, '\r\n'),
        "សញ្ញា ' ជំនួស \"": genText.replace(/"/g, "'")
    };
    for (const [label, text] of Object.entries(variants)) {
        const nh = build();
        let signed = null;
        nh.license.signNewKey = (jwk) => { signed = jwk; return Promise.resolve({ keyString: 'k', payload: { id: 'p', iat: 1, exp: 2592001 } }); };
        nh.getElementById('privateKeyInput').value = text;
        await nh.ctx.loadSigningKey();
        const loaded = vm.runInContext('JSON.stringify(signingPrivateKeyJwk)', nh.ctx);
        ok('⛔ ' + label + ' ➜ Load បាន · JWK ស្អាត (kty·crv·d·x·y) ទៅ signNewKey', loaded === JSON.stringify(clean) && JSON.stringify(signed) === JSON.stringify(clean)
            && !nh.log.alerts.length, { loaded, signed, alerts: nh.log.alerts });
    }
    const badCases = [
        ['Public Key (គ្មាន d)', JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' }), /Public Key/],
        ['អត្ថបទមិនមែន JSON', 'hello key', /JSON JWK/],
        ['JSON ខុសរាង (RSA)', JSON.stringify({ kty: 'RSA', crv: 'P-256', d: '1', x: 'a', y: 'b' }), /ECDSA P-256/]
    ];
    for (const [label, text, re] of badCases) {
        const bh = build();
        bh.getElementById('privateKeyInput').value = text;
        await bh.ctx.loadSigningKey();
        ok('ទិសផ្ទុយ ៖ ' + label + ' ➜ មិន Load · សារត្រូវ · គ្មាន Sentry', vm.runInContext('signingPrivateKeyJwk === null', bh.ctx)
            && bh.log.alerts.length === 1 && re.test(bh.log.alerts[0]) && !bh.log.captures, { alerts: bh.log.alerts, captures: bh.log.captures });
    }
    const mh = build();
    mh.license.verifyKeyString = () => Promise.resolve({ valid: false, reason: 'signature' });
    mh.getElementById('privateKeyInput').value = genText;
    await mh.ctx.loadSigningKey();
    ok('⛔ Keypair ថ្មី (Public Key មិនទាន់ deploy) ➜ មិន Load · សារប្រាប់ដាក់ Public Key ក្នុង license-verify.js ហើយ Deploy',
        vm.runInContext('signingPrivateKeyJwk === null', mh.ctx) && mh.log.alerts.length === 1 && /Deploy/.test(mh.log.alerts[0]) && /license-verify\.js/.test(mh.log.alerts[0]),
        mh.log.alerts);

    console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + '/' + (pass + fail));
    process.exit(fail === 0 ? 0 : 1);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
