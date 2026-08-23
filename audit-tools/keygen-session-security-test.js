const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.KEYGEN_APP_DIR ? path.resolve(process.env.KEYGEN_APP_DIR) : root;
const src = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen/app.js'), 'utf8');

function realLicenseAppCodeDecl(source) {
    const m = source.match(/^const LICENSE_APP_CODE = '[A-Z]+';$/m);
    if (!m) throw new Error('not found: const LICENSE_APP_CODE ក្នុង ZoeKeyGen/app.js');
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
        showToast: (message) => log.toasts.push(message),
        openModalHelper: (id) => getElementById(id).classList.add('active'),
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
    vm.runInContext(realLicenseAppCodeDecl(src), ctx);
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
        var SIGNING_KEY_SESSION_STORAGE_KEY = 'zoekeygen_signing_key_enc';
    `, ctx);
    vm.runInContext(slice([
        'safeStoreSet',
        'safeStoreRemove',
        'invalidateSensitiveSession',
        'captureSensitiveSession',
        'isSensitiveSessionCurrent',
        'validateSigningKeyAgainstShippedPublicKey',
        'generateNewKeypair',
        'loadSigningKey',
        'generateLicenseKey',
        'tryRestoreSigningKeyFromSession'
    ]), ctx);
    return { ctx, license, log, elements, storage, getElementById };
}

async function run() {
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
    h.ctx.invalidateSensitiveSession();
    writeWait.resolve();
    await generateTask;
    ok('Generated key មិនត្រូវបង្ហាញក្រោយ logout', h.getElementById('genResultKey').textContent === '');
    ok('Generated key មិនត្រូវនៅក្នុង memory ក្រោយ logout', h.ctx.lastGeneratedKey === '');

    console.log('-- Signing Key ចាស់ក្នុង session --');
    h = build({ sessionRecord: JSON.stringify({ iv: [1], data: [2] }) });
    h.license.verifyKeyString = () => Promise.resolve({ valid: false });
    await h.ctx.tryRestoreSigningKeyFromSession();
    ok('Private Key ចាស់មិនត្រូវ Load', h.ctx.signingPrivateKeyJwk === null);
    ok('session ciphertext មិនត្រឹមត្រូវត្រូវលុប', !h.storage.has('zoekeygen_signing_key_enc'));

    console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + '/' + (pass + fail));
    process.exit(fail === 0 ? 0 : 1);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
