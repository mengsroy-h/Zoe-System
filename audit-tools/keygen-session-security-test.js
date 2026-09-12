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
        var keyListCache = [{ id: 'key-a', paths: ['ADM'], revoked: false }, { id: 'key-b', paths: ['ADM'], revoked: false }];
        var SIGNING_KEY_SESSION_STORAGE_KEY = 'zoekeygen_signing_key_enc';
    `, ctx);
    vm.runInContext(slice([
        'safeStoreSet', 'safeStoreGet', 'safeStoreRemove',
        'safeStoreRemove',
        'invalidateSensitiveSession',
        'captureSensitiveSession',
        'isSensitiveSessionCurrent',
        'validateSigningKeyAgainstShippedPublicKey',
        'generateNewKeypair',
        'loadSigningKey',
        'generateLicenseKey',
        'openExtendModal',
        'confirmExtendKey',
        'toggleRevokeKey',
        'copySensitiveText',
        'copyTextarea',
        'copyGeneratedKey',
        'copySetupLink',
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
        h.ctx.invalidateSensitiveSession();
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
                else h.ctx.invalidateSensitiveSession();
                if (failure === 'timeout') timed.reject(new Error('Update timed out'));
                else pending.resolve();
                await task; pending.resolve();
                ok(kind + '/' + failure + '/' + change + '៖ completion ចាស់មិនប៉ះ UI ថ្មី',
                    !h.log.toasts.length && !h.log.alerts.length && !h.log.refreshed && !h.log.closed && !h.log.captures, h.log);
            }
        }
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

    console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + '/' + (pass + fail));
    process.exit(fail === 0 ? 0 : 1);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
