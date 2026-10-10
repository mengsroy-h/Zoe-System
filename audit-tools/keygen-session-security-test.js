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
        document: { getElementById },
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
            update: () => { log.updates++; return Promise.resolve(); }
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
        var keyListCache = [{ id: 'key-a', paths: ['ADM'], revoked: false, maxDevices: 1, seatDevices: [{ device: 'device-1', at: 1 }] }, { id: 'key-b', paths: ['ADM'], revoked: false, maxDevices: 1, seatDevices: [] }];
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
    return { ctx, license, log, elements, storage, getElementById };
}

// ⛔ ការចាកចេញពិត ៖ `logoutApp()` បង្កើន `authGeneration` ហើយ `showLoginModalWithPrefill()` ហៅ `invalidateSensitiveSession()` + `isSignedInUiActive = false`
//    (អះអាងលើកូដពិតក្នុង run() ខាងក្រោម) ➜ ការក្លែងការចាកចេញត្រូវធ្វើទាំងបី មិនមែនតែបង្កើនជំនាន់ sensitive (ដែលការបិទប្រអប់ PIN ក៏ធ្វើដែរ)
function simulateLogout(ctx) {
    vm.runInContext('authGeneration++; invalidateSensitiveSession(); isSignedInUiActive = false;', ctx);
}

async function run() {
    {
        const body = (name) => { const m = src.match(new RegExp('\\nfunction ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}')); return m ? m[0] : ''; };
        ok('លក្ខខណ្ឌការក្លែង ៖ logoutApp() ពិតបង្កើន authGeneration', /authGeneration\+\+/.test(body('logoutApp')));
        ok('លក្ខខណ្ឌការក្លែង ៖ showLoginModalWithPrefill() ពិតហៅ invalidateSensitiveSession() + isSignedInUiActive = false',
            /invalidateSensitiveSession\(\)/.test(body('showLoginModalWithPrefill')) && /isSignedInUiActive = false/.test(body('showLoginModalWithPrefill')));
    }
    console.log('-- logout មុន keypair async ចប់ --');
    let h = build();
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
