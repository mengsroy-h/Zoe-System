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
    const keyServer = { 'license_keys/ADM/key-a/expiresAt': 1000, 'license_keys/ADM/key-b/expiresAt': 1000 };
    const license = {
        generateKeyPair: () => Promise.resolve({ publicKeyJwk: { kty: 'EC', x: 'pub' }, privateKeyJwk: { kty: 'EC', crv: 'P-256', d: 'private' } }),
        signNewKey: () => Promise.resolve({ keyString: 'signed-key', payload: { id: 'key-1' } }),
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
        Date,
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
        db: {},
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
        var extendTargetId = 'key-a';
        var keyListCache = [{ id: 'key-a', paths: ['ADM'], perApp: { ADM: { expiresAt: 1000 } }, expiresAt: 1000, revoked: false, maxDevices: 1, seatDevices: [{ device: 'device-1', at: 1 }] }, { id: 'key-b', paths: ['ADM'], perApp: { ADM: { expiresAt: 1000 } }, expiresAt: 1000, revoked: false, maxDevices: 1, seatDevices: [] }];
        var seatReadFailed = false;
        var SIGNING_KEY_SESSION_STORAGE_KEY = 'zoekeygen_signing_key_enc';
    `, ctx);
    // ⛔ normalizer Private Key (សំណើម្ចាស់គម្រោង) ៖ អវត្តមាន (កូដមុនកែ) ➜ loadSigningKey ប្រើ JSON.parse ផ្ទាល់ ➜ ការអះអាងខាងក្រោមធ្លាក់ដោយមានឈ្មោះ
    const keyTextDecl = (src.match(/^const SIGNING_KEY_JWK_FIELDS = .*;$/m) || [])[0];
    const keyErrDecl = (src.match(/^const SIGNING_KEY_TEXT_ERRORS = \{[\s\S]*?\n\};$/m) || [])[0];
    if (keyTextDecl && keyErrDecl) vm.runInContext(keyTextDecl + '\n' + keyErrDecl, ctx);
    vm.runInContext(slice([
        'safeStoreSet', 'safeStoreGet', 'safeStoreRemove',
        'safeStoreRemove',
        'invalidateSensitiveSession',
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
        'releaseKeySeat',
        'copySensitiveText',
        'copyTextarea',
        'copyGeneratedKey',
        'copySetupLink',
        'tryRestoreSigningKeyFromSession'
    ]), ctx);
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
    const start = (kind) => f.ctx[kind](kind === 'deleteNotice' ? 'notice-a' : 'key-a');
    return { ...f, timers, writes, change, start };
}

async function verifyAdminRetryOwnership() {
    console.log('-- Admin retry ពិត ៖ វគ្គដើមជាម្ចាស់ការសរសេរ --');
    const actions = ['setKeySeatLimit', 'releaseKeySeat', 'sendNotice', 'deleteNotice'];
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
                const value = index === 0 ? { ZOE: { 'key-a': { revoked, expiresAt: 1000, maxDevices: 1 } } } : {};
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

async function run() {
    await verifyAdminRetryOwnership();
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
        h.license.signNewKey = () => Promise.resolve({ keyString: 'synthetic-new-key', payload: { id: 'synthetic-new-id' } });
        h.getElementById('privateKeyInput').value = JSON.stringify(reloadKey);
        await h.ctx.loadSigningKey();
        pending.resolve(stage === 'clock' ? true : { keyString: 'synthetic-old-key', payload: { id: 'synthetic-old-id' } });
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
        h.license.signNewKey = () => Promise.resolve({ keyString: 'synthetic-after-pin', payload: { id: 'synthetic-after-pin-id' } });
        await h.ctx.generateLicenseKey();
        ok(stage + ' ៖ Generate បន្ទាប់បង្ហាញ Key បាន', h.ctx.lastGeneratedKey === 'synthetic-after-pin', h.ctx.lastGeneratedKey);
    }

    // ⛔ ការកែ Key (Extend · Revoke · ចំនួនឧបករណ៍ · ដោះឧបករណ៍) ៖ បិទប្រអប់ PIN កណ្តាលការសរសេរ (`closeModal('pinModal')` ពិត) មិនមែនការចាកចេញ ➜
    //    ✅ + Refresh បញ្ជីនៅបង្ហាញ។ ទិសផ្ទុយ ៖ ចាកចេញ ➜ ចូលវិញដោយគណនីដដែល (វគ្គថ្មី · `authGeneration` ថ្មី) ➜ ការសរសេរចាស់ចប់មិនប៉ះ UI វគ្គថ្មី។
    console.log('-- បិទប្រអប់ PIN ខណៈការកែ Key កំពុងសរសេរ --');
    for (const kind of ['extend', 'revoke', 'seat', 'release']) {
        h = build();
        vm.runInContext(slice(['closeModal', 'clearPinInputValues', 'clearKeypairOutputs']) + '\nvar pinTargetAction = null;', h.ctx);
        if (kind === 'extend') { h.ctx.openExtendModal('key-a'); h.getElementById('extendDaysInput').value = '7'; }
        const pending = deferred();
        h.ctx.fb.update = () => { h.log.updates++; return pending.promise; };
        h.ctx.fb.set = () => { h.log.updates++; return pending.promise; };
        h.ctx.prompt = () => '2';
        const task = kind === 'extend' ? h.ctx.confirmExtendKey() : kind === 'revoke' ? h.ctx.toggleRevokeKey('key-a')
            : kind === 'seat' ? h.ctx.setKeySeatLimit('key-a') : h.ctx.releaseKeySeat('key-a');
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
        const task = h.ctx.toggleRevokeKey('key-a');
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
    h.ctx.openExtendModal('key-a');
    h.getElementById('extendDaysInput').value = '7';
    const clockWait = deferred();
    h.ctx.waitForServerTimeSync = () => clockWait.promise;
    const targetWrites = [];
    h.ctx.fb.update = (ref, value) => { targetWrites.push({ path: ref.path, value }); return Promise.resolve(); };
    const extendTask = h.ctx.confirmExtendKey();
    h.ctx.openExtendModal('key-b');
    clockWait.resolve(true);
    await extendTask;
    ok('បើក Key B ខណៈ Key A រង់ចាំម៉ោង៖ សរសេរតែ Key A',
        targetWrites.length === 1 && targetWrites[0].path === 'license_keys/ADM/key-a', targetWrites);
    ok('ថ្ងៃសុពលភាពយកពីការបញ្ជាក់ Key A មិនមែន input ថ្មី',
        targetWrites.length === 1 && targetWrites[0].value.expiresAt === 1000 + 7 * 86400000, targetWrites);
    ok('ការបញ្ចប់ Key A មិនបិទ modal ថ្មីរបស់ Key B', h.getElementById('extendModal').classList.contains('active'));

    h = build();
    h.ctx.openExtendModal('key-a');
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
        h.ctx.openExtendModal('key-a');
        const pendingWrite = deferred();
        h.ctx.fb.update = () => { h.log.updates++; return pendingWrite.promise; };
        const pendingTask = kind === 'extend' ? h.ctx.confirmExtendKey() : h.ctx.toggleRevokeKey('key-a');
        await drain();
        ok(kind + '៖ write ចាប់ផ្តើមមុន logout', h.log.updates === 1, h.log.updates);
        simulateLogout(h.ctx);
        pendingWrite.resolve();
        await pendingTask;
        ok(kind + '៖ write ចាស់បញ្ចប់ក្រោយ logout មិនបង្ហាញ success/refresh/បិទ modal',
            !h.log.toasts.length && !h.log.alerts.length && !h.log.refreshed && !h.log.closed, h.log);
    }

    h = build(); h.ctx.openExtendModal('key-a');
    const dbClock = deferred(); h.ctx.waitForServerTimeSync = () => dbClock.promise;
    const databaseSwitch = h.ctx.confirmExtendKey();
    h.ctx.db = { business: 'other' };
    dbClock.resolve(true); await databaseSwitch;
    ok('ប្តូរ database តែមួយ ខណៈ auth generation នៅដដែល៖ មិនបន្ត write ក្រោយរង់ចាំម៉ោង',
        h.log.updates === 0 && !h.log.toasts.length && !h.log.alerts.length && !h.log.refreshed, h.log);

    for (const kind of ['extend', 'revoke']) {
        for (const failure of ['resolve', 'timeout']) {
            for (const change of ['db-only', 'logout']) {
                h = build(); h.ctx.openExtendModal('key-a');
                const pending = deferred(); const timed = deferred();
                h.ctx.fb.update = () => { h.log.updates++; return pending.promise; };
                if (failure === 'timeout') h.ctx.withTimeout = () => timed.promise;
                const task = kind === 'extend' ? h.ctx.confirmExtendKey() : h.ctx.toggleRevokeKey('key-a');
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
    console.log('-- ការកែ Key ព្យួរ ➜ «⏳ មិនទាន់បញ្ជាក់» · ចុះយឺត ➜ ✅ --');
    const PENDING_RE = /^⏳ /;
    for (const kind of ['extend', 'revoke', 'seat', 'release']) {
        h = build(); h.ctx.openExtendModal('key-a');
        h.ctx.prompt = () => '3';
        const pending = deferred(); const timed = deferred();
        h.ctx.fb.update = () => { h.log.updates++; return pending.promise; };
        h.ctx.fb.set = () => { h.log.updates++; return pending.promise; };
        h.ctx.withTimeout = () => timed.promise;
        const task = kind === 'extend' ? h.ctx.confirmExtendKey() : kind === 'revoke' ? h.ctx.toggleRevokeKey('key-a')
            : kind === 'seat' ? h.ctx.setKeySeatLimit('key-a') : h.ctx.releaseKeySeat('key-a');
        await drain();
        ok(kind + '/ព្យួរ ៖ write ចាប់ផ្តើមពិត', h.log.updates === 1, h.log.updates);
        timed.reject(new Error(kind === 'seat' ? 'Seat limit update timed out' : kind === 'release' ? 'Release timed out' : 'Update timed out'));
        await task; await drain();
        ok(kind + '/ព្យួរ ៖ សារ «⏳ មិនទាន់បញ្ជាក់» (មិនមែន «មិនបាន») · គ្មាន ✅ មុន commit',
            h.log.alerts.length === 1 && PENDING_RE.test(h.log.alerts[0]) && !h.log.toasts.some((t) => t.startsWith('✅')), h.log);
        pending.resolve(); await drain(); await drain();
        ok(kind + '/ព្យួរ ➜ ចុះយឺត ៖ ✅ (ចុះយឺត) + Refresh បញ្ជី',
            h.log.toasts.filter((t) => t.startsWith('✅') && /ចុះយឺត/.test(t)).length === 1 && h.log.refreshed >= 1, h.log);
    }
    for (const kind of ['seat', 'release']) {
        h = build();
        h.ctx.prompt = () => '3';
        h.ctx.fb.update = () => { h.log.updates++; return Promise.reject(new Error('PERMISSION_DENIED')); };
        h.ctx.fb.set = () => { h.log.updates++; return Promise.reject(new Error('PERMISSION_DENIED')); };
        await (kind === 'seat' ? h.ctx.setKeySeatLimit('key-a') : h.ctx.releaseKeySeat('key-a'));
        await drain();
        ok(kind + '/បដិសេធពិត ➜ «មិនបាន» (ទិសផ្ទុយ ៖ មិនមែន ⏳)',
            h.log.alerts.length === 1 && !PENDING_RE.test(h.log.alerts[0]) && /មិនបាន/.test(h.log.alerts[0]), h.log);
    }
    {
        h = build(); h.ctx.openExtendModal('key-a');
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
            h.ctx.openExtendModal('key-a');
            h.getElementById('extendDaysInput').value = String(days);
            await h.ctx.confirmExtendKey();
            await drain();
        };
        h = build();
        h.keyServer['license_keys/ADM/key-a/expiresAt'] = 1000 + 300 * DAY;
        h.ctx.keyListCache[0].perApp.ADM.expiresAt = 1000 + 300 * DAY;
        await extendOn(h, 30);
        ok('F5 ៖ Key នៅសល់ ៣០០ ថ្ងៃ · បន្ថែម ៣០ ➜ ៣៣០ ថ្ងៃ (មិនខ្លីជាងមុន)',
            h.keyServer['license_keys/ADM/key-a/expiresAt'] === 1000 + 330 * DAY && h.log.toasts.some((t) => t.startsWith('✅')),
            { days: (h.keyServer['license_keys/ADM/key-a/expiresAt'] - 1000) / DAY, log: h.log });
        h = build();
        h.keyServer['license_keys/ADM/key-a/expiresAt'] = 500;
        h.ctx.keyListCache[0].perApp.ADM.expiresAt = 500;
        await extendOn(h, 7);
        ok('F5 ៖ Key ផុតកំណត់រួច ➜ គិតពីម៉ោង Server (៧ ថ្ងៃពីថ្ងៃនេះ)', h.keyServer['license_keys/ADM/key-a/expiresAt'] === 1000 + 7 * DAY,
            (h.keyServer['license_keys/ADM/key-a/expiresAt'] - 1000) / DAY);
        h = build();
        await extendOn(h, 365);
        const afterFirst = h.keyServer['license_keys/ADM/key-a/expiresAt'];
        h.log.toasts.length = 0; h.log.updates = 0;
        await extendOn(h, 7);
        ok('F5 ៖ admin ទី ២ មើលឃើញតម្លៃចាស់ (+៣៦៥ ពីឧបករណ៍ផ្សេង) ➜ មិនសរសេរជាន់ · ប្រាប់ «កែពីកន្លែងផ្សេង» · Refresh',
            afterFirst === 1000 + 365 * DAY && h.keyServer['license_keys/ADM/key-a/expiresAt'] === afterFirst && h.log.updates === 0
                && h.log.alerts.some((a) => /ផ្សេង/.test(a)) && h.log.refreshed >= 1 && !h.log.toasts.some((t) => t.startsWith('✅')),
            { days: (h.keyServer['license_keys/ADM/key-a/expiresAt'] - 1000) / DAY, log: h.log });
        h.ctx.keyListCache[0].perApp.ADM.expiresAt = afterFirst;
        h.log.alerts.length = 0;
        await extendOn(h, 7);
        ok('F5 ៖ ក្រោយ Refresh ➜ +៧ បន្ថែមលើ ៣៦៥ (= ៣៧២ ថ្ងៃ)', h.keyServer['license_keys/ADM/key-a/expiresAt'] === 1000 + 372 * DAY,
            (h.keyServer['license_keys/ADM/key-a/expiresAt'] - 1000) / DAY);
        h = build();
        delete h.keyServer['license_keys/ADM/key-a/expiresAt'];
        await extendOn(h, 30);
        ok('F5 ៖ Key បាត់លើ Server ➜ មិនបង្កើតថ្ងៃផុតកំណត់ · ប្រាប់', h.keyServer['license_keys/ADM/key-a/expiresAt'] === undefined
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
            h.keyServer['license_keys/ADM/key-a/expiresAt'] = 1000 + 300 * DAY;
            h.ctx.keyListCache[0].perApp.ADM.expiresAt = 1000 + 300 * DAY;
            restReadback(h, mode);
            lostAck(h, landed);
            await extendOn(h, 30);
            const days = (h.keyServer['license_keys/ADM/key-a/expiresAt'] - 1000) / DAY;
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
            h.keyServer['license_keys/ADM/key-a/expiresAt'] = 1000 + 300 * DAY;
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
        h.ctx.openExtendModal('key-a');
        h.getElementById('extendDaysInput').value = '30';
        const twice = [h.ctx.confirmExtendKey(), h.ctx.confirmExtendKey()];
        await Promise.all(twice);
        await drain();
        ok('K6 ៖ ចុចពីរដង ➜ បន្ថែមម្តង · គ្មានសារ «កែពីឧបករណ៍ផ្សេង» ក្លែង',
            h.keyServer['license_keys/ADM/key-a/expiresAt'] === 1000 + 30 * DAY && !h.log.alerts.some((a) => /ផ្សេង/.test(a))
                && h.log.toasts.filter((t) => t.startsWith('✅')).length === 1, { days: (h.keyServer['license_keys/ADM/key-a/expiresAt'] - 1000) / DAY, log: h.log });
    }

    // ⛔ deep audit ៩ (F2) ៖ «🔓 ដោះឧបករណ៍» លុបកៅអី + `releasedAt` (ម៉ោង server) ក្នុង update តែមួយ ➜ ឧបករណ៍ចាស់ដែលនៅដំណើរការឈប់ប្រើ Key
    //    (license-verify ៖ `activatedAt` ≤ `releasedAt` ➜ seat-released) · Rules License ចាស់បដិសេធ `releasedAt` ➜ ដោះកៅអីតែមួយ + ប្រាប់ឲ្យ Publish
    console.log('-- ⛔ ដោះឧបករណ៍ ៖ releasedAt ជាមួយការលុបកៅអី --');
    {
        h = build();
        const sent = [];
        h.ctx.fb.update = (ref, value) => { h.log.updates++; sent.push({ path: ref.path, value }); return Promise.resolve(); };
        await h.ctx.releaseKeySeat('key-a');
        await drain();
        const atomic = sent.find((w) => w.value && 'license_seats/ADM/key-a' in w.value);
        ok('F2 ៖ ដោះ ➜ update តែមួយ ៖ license_seats null + license_keys/…/releasedAt = ម៉ោង server',
            !!atomic && atomic.value['license_seats/ADM/key-a'] === null
                && JSON.stringify(atomic.value['license_keys/ADM/key-a/releasedAt']) === JSON.stringify({ '.sv': 'timestamp' })
                && h.log.toasts.some((t) => t.startsWith('✅')), { sent, log: h.log });
        h = build();
        const seatsOnly = [];
        h.ctx.fb.update = () => { h.log.updates++; return Promise.reject(Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' })); };
        h.ctx.fb.set = (ref, value) => { seatsOnly.push({ path: ref.path, value }); return Promise.resolve(); };
        await h.ctx.releaseKeySeat('key-a');
        await drain();
        // ⛔ re-audit (K2) ៖ ក្រោយ Rules ចាស់ ➜ កៅអីត្រូវលុបហើយ (គ្មានឧបករណ៍ក្នុងបញ្ជី) តែ Key គ្មាន `releasedAt` ➜ សារ «Publish Rules រួចដោះម្តងទៀត»
        //    ត្រូវដើរ ៖ ការដោះម្តងទៀតចុះត្រា `releasedAt` តែមួយ (មុនកែ ៖ «មិនទាន់ចងនឹងឧបករណ៍ណាទេ» ហើយមិនសរសេរ ➜ ឧបករណ៍ចាស់កក់កៅអីវិញ)
        {
            const hs = build();
            const stamps = [];
            hs.ctx.fb.update = (ref, value) => { hs.log.updates++; stamps.push(value); return Promise.resolve(); };
            await hs.ctx.releaseKeySeat('key-b');
            await drain();
            ok('K2 ៖ គ្មានឧបករណ៍ក្នុងបញ្ជី · Key គ្មាន releasedAt ➜ ចុះត្រា releasedAt (ដោះម្តងទៀតដើរ)',
                stamps.length === 1 && JSON.stringify(stamps[0]['license_keys/ADM/key-b/releasedAt']) === JSON.stringify({ '.sv': 'timestamp' })
                    && hs.log.toasts.some((t) => t.startsWith('✅')), { stamps, log: hs.log });
            const hn = build();
            hn.ctx.keyListCache[1].perApp.ADM.releasedAt = 900;
            hn.ctx.fb.update = () => { hn.log.updates++; return Promise.resolve(); };
            await hn.ctx.releaseKeySeat('key-b');
            await drain();
            ok('K2 ទិសផ្ទុយ ៖ Key មាន releasedAt រួច ហើយគ្មានឧបករណ៍ ➜ «គ្មានអ្វីត្រូវដោះ» · មិនសរសេរ',
                hn.log.updates === 0 && hn.log.alerts.length === 1 && /មិនទាន់ចងនឹងឧបករណ៍/.test(hn.log.alerts[0]), hn.log);
        }
        ok('F2 ៖ Rules ចាស់បដិសេធ releasedAt ➜ ដោះកៅអីតែមួយ · ប្រាប់ឲ្យ Publish Rules (មិនមែន «ដោះមិនបាន»)',
            seatsOnly.length === 1 && seatsOnly[0].path === 'license_seats/ADM/key-a' && seatsOnly[0].value === null
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
        await h.ctx.toggleRevokeKey('key-a');
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
        f.ctx.__pinPrompts = 0;
        vm.runInContext(realDecl('SIGNING_KEY_IDLE_MS') + '\nvar signingKeyLastUseAt = 0;', f.ctx);
        vm.runInContext(slice(['elapsedSince', 'noteSigningKeyActivity', 'expireIdleSigningKey', 'requestSessionSigningKeyRestoreIfEligible']), f.ctx);
        f.ctx.isPinFlowPending = () => f.ctx.__pinPrompts > 0;
        f.ctx.requestPinBeforeConfig = () => { f.ctx.__pinPrompts++; };
        f.storage.set('zoekeygen_signing_key_enc', '{"iv":[1],"data":[2]}');
        vm.runInContext('signingKeyLastUseAt = Date.now();', f.ctx);
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
    ok('Load Signing Key ➜ ចាប់ផ្តើមនាឡិកាទុកចោល (ត្រា > 0)', vm.runInContext('!!signingPrivateKeyJwk && signingKeyLastUseAt > 0', idle.ctx));
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
        f.ctx.__logouts = [];
        f.ctx.__locks = [];
        f.ctx.logoutApp = (auto) => { f.ctx.__logouts.push(auto === true); };
        f.ctx.lockKeygenSession = (silent) => { f.ctx.__locks.push(silent === true); };
        f.ctx.hasUncopiedKeypair = () => false;
        vm.runInContext(realDecl('KEYGEN_IDLE_LOGOUT_MS') + '\nvar keygenLastActivityAt = 0; authButtonIsLoggedIn = ' + (loggedIn ? 'true' : 'false') + '; isGeneratingKey = false;', f.ctx);
        vm.runInContext(slice(['elapsedSince', 'noteKeygenActivity', 'expireIdleKeygenSession', 'khmerMinutes']), f.ctx);
        vm.runInContext('keygenLastActivityAt = Date.now();', f.ctx);
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
    ok('⛔ ខ្សែភ្ជាប់ ៖ pointerdown/keydown ➜ noteKeygenActivity · setInterval ➜ expireIdleKeygenSession · visibilitychange ➜ expireIdleKeygenSession',
        /\['pointerdown', 'keydown'\]\.forEach\(\(evt\) => document\.addEventListener\(evt, noteKeygenActivity, \{ capture: true, passive: true \}\)\)/.test(bootBlock)
        && /setInterval\(expireIdleKeygenSession, \d+\)/.test(bootBlock)
        && /'visibilitychange', \(\) => \{\s*if \(document\.hidden\) return;[\s\S]{0,200}expireIdleKeygenSession\(\);/.test(bootBlock));
    ok('⛔ ការចូល (updateAuthButton(true)) ចាប់ផ្តើមនាឡិកាទុកចោល',
        /function updateAuthButton\(isLoggedIn\) \{[\s\S]*?if \(authButtonIsLoggedIn\) keygenLastActivityAt = Date\.now\(\);/.test(src));
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
    ok('lockKeygenSession ៖ clearSigningKey(true) · sbAdminLogout (ពេលមាន session) · invalidateSensitiveSession · refresh · toast តែពេលមិន silent',
        JSON.stringify(silentCalls) === '["clearSigningKey:true","sbAdminLogout","invalidate","refresh"]' && toastsBefore === 0
        && JSON.stringify(lk.ctx.__calls.slice(4)) === '["clearSigningKey:true","invalidate","refresh"]'
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
        nh.license.signNewKey = (jwk) => { signed = jwk; return Promise.resolve({ keyString: 'k', payload: { id: 'p' } }); };
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
