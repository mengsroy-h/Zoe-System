const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = process.env.BIOMETRIC_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(label, cond, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

process.on('uncaughtException', (e) => {
    console.log('   FAIL  ' + e.message);
    console.log('\n❌ ធ្លាក់ — កូដដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
});

function matchBrace(src, from, open, close) {
    let depth = 0, quote = '';
    for (let i = from; i < src.length; i++) {
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
    if (start === -1) throw new Error('not found: function ' + name + ' — មុខងារនេះបាត់ពី app.js');
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    const end = matchBrace(src, src.indexOf('{', src.indexOf(')', start)), '{', '}');
    return src.slice(start, end + 1);
}

function sliceConstLine(src, name) {
    const m = src.match(new RegExp('^\\s*const ' + name + " = '[^']*';$", 'm'));
    if (!m) throw new Error('not found: const ' + name);
    return m[0].trim();
}

const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');

function makeEnv(opts) {
    const o = opts || {};
    const store = Object.assign({}, o.storage || {});
    const log = { toasts: [], alerts: [], target: [], modalsClosed: [], webauthn: [] };
    const els = {
        pinBiometricBtn: { id: 'pinBiometricBtn', style: {}, disabled: false, textContent: '' },
        biometricToggleState: { id: 'biometricToggleState', textContent: '' },
        biometricToggleBtn: {
            id: 'biometricToggleBtn',
            _cls: new Set(),
            classList: {
                add(c) { els.biometricToggleBtn._cls.add(c); },
                remove(c) { els.biometricToggleBtn._cls.delete(c); },
                contains(c) { return els.biometricToggleBtn._cls.has(c); },
                toggle(c, force) {
                    if (force) els.biometricToggleBtn._cls.add(c);
                    else els.biometricToggleBtn._cls.delete(c);
                    return !!force;
                }
            }
        }
    };

    const sandbox = {
        console,
        crypto: {
            getRandomValues: (arr) => { crypto.randomFillSync(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)); return arr; },
            subtle: require('crypto').webcrypto.subtle
        },
        TextEncoder, TextDecoder,
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        atob: (s) => Buffer.from(s, 'base64').toString('binary'),
        Uint8Array, ArrayBuffer, JSON, Date, parseInt, Math, Promise,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        },
        document: { getElementById: (id) => els[id] || null },
        window: { isSecureContext: o.secure !== false, location: { hostname: 'app.example.com' } },
        showToast: (t) => log.toasts.push(t),
        alert: (t) => log.alerts.push(t),
        confirm: () => o.confirmAnswer !== false,
        closeModal: (id) => log.modalsClosed.push(id),
        openConfigModal: () => log.target.push('openConfigModal'),
        hashPin: async (pin) => 'pbkdf2:' + crypto.createHash('sha256').update('v2' + pin).digest('hex'),
        deriveLookupSecretKey: async (pin) => ({ derivedFrom: pin }),
        verifyStoredPin: async (pin, saved) => saved === 'pbkdf2:' + crypto.createHash('sha256').update('v2' + pin).digest('hex'),
        requestPinBeforeConfig: (fn, key) => { log.target.push('requestPin:' + key); log.pendingTarget = fn; },
        __log: log,
        __els: els,
        __store: store
    };
    sandbox.window.PublicKeyCredential = o.platform === false ? undefined : {
        isUserVerifyingPlatformAuthenticatorAvailable: async () => o.platform !== false
    };
    sandbox.PublicKeyCredential = sandbox.window.PublicKeyCredential;

    const prfKey = crypto.randomBytes(32);
    sandbox.navigator = {
        credentials: {
            create: async (req) => {
                log.webauthn.push({ op: 'create', uv: req.publicKey.authenticatorSelection.userVerification,
                    attachment: req.publicKey.authenticatorSelection.authenticatorAttachment,
                    rpId: req.publicKey.rp.id, prfRequested: !!(req.publicKey.extensions && req.publicKey.extensions.prf) });
                if (o.createFails) throw new Error('NotAllowedError');
                return {
                    rawId: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
                    getClientExtensionResults: () => (o.prf ? { prf: { enabled: true } } : {})
                };
            },
            get: async (req) => {
                log.webauthn.push({ op: 'get', uv: req.publicKey.userVerification, rpId: req.publicKey.rpId,
                    allow: req.publicKey.allowCredentials.map((c) => [...new Uint8Array(c.id)].join(',')),
                    prfRequested: !!(req.publicKey.extensions && req.publicKey.extensions.prf) });
                if (o.getFails) throw new Error('NotAllowedError');
                return {
                    getClientExtensionResults: () => (o.prf ? { prf: { results: { first: prfKey.buffer.slice(prfKey.byteOffset, prfKey.byteOffset + 32) } } } : {})
                };
            }
        }
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext('let lookupSecretKey = null; let pinTargetAction = null; let isVerifyingPin = false;', ctx);
    vm.runInContext('let appLockExcuseAt = 0;', ctx);
    vm.runInContext(sliceConstLine(src, 'BIOMETRIC_STORAGE_KEY'), ctx);
    vm.runInContext(sliceConstLine(src, 'BIOMETRIC_PRF_SALT'), ctx);
    vm.runInContext('let biometricUnlockInFlight = false;', ctx);
    [
        'safeStoreSet', 'safeStoreRemove',
        'bytesToB64', 'b64ToBytes', 'readBiometricRecord', 'writeBiometricRecord', 'clearBiometricRecord',
        'isBiometricEnabled', 'biometricPlatformAvailable', 'wrapPinWithRawKey', 'unwrapPinWithRawKey',
        'biometricPrfBytes', 'enrollBiometricRecord', 'biometricUnlockPin', 'setBiometricLabel', 'setBiometricBusy',
        'refreshBiometricUi', 'runBiometricUnlock', 'startBiometricEnrollment', 'toggleBiometricUnlock',
        'initBiometricUi', 'completePinUnlock',
        'noteAppLockExcuse'
    ].forEach((n) => vm.runInContext(sliceFn(src, n), ctx));
    return { ctx, sandbox, log, els, store, prfKey };
}

const PIN = '135790';
const PIN_HASH = 'pbkdf2:' + crypto.createHash('sha256').update('v2' + PIN).digest('hex');

(async () => {
    console.log('\n=== ចង (enroll) ដោយប្រើ PRF (iOS 18+/Android ថ្មី) ===');
    {
        const e = makeEnv({ prf: true, storage: { zoew_security_pin_hash: PIN_HASH } });
        await e.sandbox.startBiometricEnrollment(PIN);
        const rec = JSON.parse(e.store['zoew_biometric_unlock_v1'] || 'null');
        ok('រក្សាទុកកំណត់ត្រាជីវមាត្រ', !!rec);
        ok('ប្រើរបៀប prf (កូនសោចេញពីឧបករណ៍)', rec && rec.mode === 'prf', rec && rec.mode);
        ok('មិនរក្សា PIN ជាអក្សរធម្មតាទេ', JSON.stringify(rec).indexOf(PIN) === -1);
        ok('មិនរក្សាកូនសោក្នុងឧបករណ៍ក្នុងរបៀប prf', rec && !rec.wrapKey);
        const create = e.log.webauthn.find((w) => w.op === 'create');
        ok('ស្នើ authenticator ក្នុងឧបករណ៍ (platform)', create && create.attachment === 'platform');
        ok('តម្រូវឲ្យផ្ទៀងផ្ទាត់អ្នកប្រើ (ក្រយៅដៃ/មុខ)', create && create.uv === 'required');
        ok('ចង rp ទៅ hostname ពិត', create && create.rpId === 'app.example.com');
        ok('UI ប្តូរទៅ «បើក»', e.els.biometricToggleState.textContent === 'បើក', e.els.biometricToggleState.textContent);
        ok('ប៊ូតុងក្នុងប្រអប់ PIN លេចឡើង', e.els.pinBiometricBtn.style.display === '');
    }

    console.log('\n=== ដោះសោដោយក្រយៅដៃ/មុខ ជំនួសការវាយ PIN ===');
    {
        const e = makeEnv({ prf: true, storage: { zoew_security_pin_hash: PIN_HASH } });
        await e.sandbox.startBiometricEnrollment(PIN);
        e.log.webauthn.length = 0;
        e.store['zoew_pin_fail_count'] = '3';
        const okUnlock = await e.sandbox.runBiometricUnlock();
        ok('ដោះសោបានជោគជ័យ', okUnlock === true);
        ok('បិទប្រអប់ PIN', e.log.modalsClosed.indexOf('pinModal') !== -1);
        ok('រត់សកម្មភាពគោលដៅ', e.log.target.indexOf('openConfigModal') !== -1);
        ok('ដោះកូនសោ Lookup API ចេញពី PIN ពិត',
            JSON.stringify(vm.runInContext('lookupSecretKey', e.ctx)) === JSON.stringify({ derivedFrom: PIN }));
        ok('សម្អាតចំនួនវាយខុស', !('zoew_pin_fail_count' in e.store));
        const get = e.log.webauthn.find((w) => w.op === 'get');
        ok('ការស្កេនតម្រូវឲ្យផ្ទៀងផ្ទាត់អ្នកប្រើ', get && get.uv === 'required');
    }

    console.log('\n=== ឧបករណ៍គ្មាន PRF ➜ ធ្លាក់ចូលរបៀបឧបករណ៍ តែនៅតែដំណើរការ ===');
    {
        const e = makeEnv({ prf: false, storage: { zoew_security_pin_hash: PIN_HASH } });
        await e.sandbox.startBiometricEnrollment(PIN);
        const rec = JSON.parse(e.store['zoew_biometric_unlock_v1'] || 'null');
        ok('ប្រើរបៀប device', rec && rec.mode === 'device', rec && rec.mode);
        ok('នៅតែមិនរក្សា PIN ជាអក្សរធម្មតា', JSON.stringify(rec).indexOf(PIN) === -1);
        ok('ប្រាប់អ្នកប្រើថាឧបករណ៍មិនគាំទ្រពេញលេញ',
            e.log.toasts.some((t) => t.indexOf('មិនគាំទ្រការចាក់សោដោយជីវមាត្រពេញលេញ') !== -1), e.log.toasts);
        ok('ដោះសោបាន', (await e.sandbox.runBiometricUnlock()) === true);
    }

    console.log('\n=== ផ្លូវបរាជ័យ ===');
    {
        const e = makeEnv({ prf: true, storage: { zoew_security_pin_hash: PIN_HASH } });
        await e.sandbox.startBiometricEnrollment(PIN);
        e.store['zoew_security_pin_hash'] = 'pbkdf2:' + crypto.createHash('sha256').update('v2999999').digest('hex');
        const res = await e.sandbox.runBiometricUnlock();
        ok('ប្តូរ PIN ➜ ការចងចាស់មិនដោះសោបានទេ', res === false);
        ok('ហើយលុបការចងចាស់ចោល', !('zoew_biometric_unlock_v1' in e.store));
        ok('ប្រាប់អ្នកប្រើឲ្យបើកឡើងវិញ',
            e.log.toasts.some((t) => t.indexOf('លែងត្រូវនឹង PIN') !== -1), e.log.toasts);
    }
    {
        const e = makeEnv({ prf: true, storage: { zoew_security_pin_hash: PIN_HASH } });
        await e.sandbox.startBiometricEnrollment(PIN);
        e.store['zoew_pin_lockout_until'] = String(Date.now() + 60000);
        e.log.webauthn.length = 0;
        const res = await e.sandbox.runBiometricUnlock();
        ok('កំពុងជាប់សោ ➜ មិនស្កេនទេ', res === false && e.log.webauthn.length === 0);
    }
    {
        const e = makeEnv({ prf: true, getFails: true, storage: { zoew_security_pin_hash: PIN_HASH } });
        e.store['zoew_biometric_unlock_v1'] = JSON.stringify({
            mode: 'device', credentialId: 'AQID', wrapKey: 'AAAA', wrapped: { iv: 'AAAA', data: 'AAAA' }
        });
        const res = await e.sandbox.runBiometricUnlock();
        ok('អ្នកប្រើបោះបង់ការស្កេន ➜ ត្រឡប់ false មិន throw', res === false);
        ok('ការចងនៅដដែល (មិនលុបព្រោះបោះបង់)', 'zoew_biometric_unlock_v1' in e.store);
    }
    {
        const e = makeEnv({ platform: false, storage: { zoew_security_pin_hash: PIN_HASH } });
        await e.sandbox.startBiometricEnrollment(PIN);
        ok('ឧបករណ៍មិនគាំទ្រ ➜ ប្រាប់ ហើយមិនរក្សាទុក',
            !('zoew_biometric_unlock_v1' in e.store) && e.log.alerts.length === 1, e.log.alerts);
    }
    {
        const e = makeEnv({ secure: false, storage: { zoew_security_pin_hash: PIN_HASH } });
        ok('គ្មាន HTTPS ➜ រាយថាមិនអាចប្រើបាន', (await e.sandbox.biometricPlatformAvailable()) === false);
    }
    {
        const e = makeEnv({ prf: true, storage: { zoew_security_pin_hash: PIN_HASH } });
        await e.sandbox.startBiometricEnrollment('');
        ok('គ្មាន PIN ផ្ទៀងផ្ទាត់ ➜ មិនចង', !('zoew_biometric_unlock_v1' in e.store));
    }

    console.log('\n=== កំណត់ត្រាខូច/ត្រូវគេកែ ===');
    {
        const e = makeEnv({ prf: true, storage: { zoew_security_pin_hash: PIN_HASH } });
        ['not json', '{}', JSON.stringify({ mode: 'prf' }),
         JSON.stringify({ mode: 'evil', credentialId: 'AQID', wrapped: { iv: 'a', data: 'b' } }),
         JSON.stringify({ mode: 'device', credentialId: 'AQID', wrapped: { iv: 'a', data: 'b' } })].forEach((bad) => {
            e.store['zoew_biometric_unlock_v1'] = bad;
            ok('កំណត់ត្រាមិនត្រឹមត្រូវ ➜ ចាត់ទុកជាបិទ: ' + bad.slice(0, 34), e.sandbox.isBiometricEnabled() === false);
        });
    }

    console.log('\n=== ការបិទពីម៉ឺនុយការកំណត់ ===');
    {
        const e = makeEnv({ prf: true, storage: { zoew_security_pin_hash: PIN_HASH } });
        await e.sandbox.startBiometricEnrollment(PIN);
        e.sandbox.toggleBiometricUnlock();
        ok('បិទ ➜ លុបការចង', !('zoew_biometric_unlock_v1' in e.store));
        ok('UI ត្រឡប់ទៅ «បិទ»', e.els.biometricToggleState.textContent === 'បិទ');
        ok('ប៊ូតុងក្នុងប្រអប់ PIN លាក់វិញ', e.els.pinBiometricBtn.style.display === 'none');
    }
    {
        const e = makeEnv({ prf: true, storage: { zoew_security_pin_hash: PIN_HASH } });
        e.sandbox.toggleBiometricUnlock();
        ok('បើកពីម៉ឺនុយ ➜ សុំ PIN មុនជានិច្ច', e.log.target.indexOf('requestPin:biometric') !== -1, e.log.target);
        ok('ហើយគោលដៅក្រោយ PIN គឺការចងជីវមាត្រ',
            e.log.pendingTarget === vm.runInContext('startBiometricEnrollment', e.ctx));
    }
    {
        const e = makeEnv({ platform: false, storage: { zoew_security_pin_hash: PIN_HASH } });
        await e.sandbox.initBiometricUi();
        ok('ឧបករណ៍មិនគាំទ្រ ➜ ម៉ឺនុយបង្ហាញ «មិនគាំទ្រ»', e.els.biometricToggleState.textContent === 'មិនគាំទ្រ',
            e.els.biometricToggleState.textContent);
    }

    console.log('\n=== ការតភ្ជាប់ក្នុង index.html និង style.css ===');
    {
        const html = fs.readFileSync(path.join(ROOT, 'ZoeW', 'index.html'), 'utf8');
        const css = fs.readFileSync(path.join(ROOT, 'ZoeW', 'style.css'), 'utf8');
        ok('ម៉ឺនុយការកំណត់មានប៊ូតុងបើក/បិទជីវមាត្រ', html.indexOf('id="biometricToggleBtn"') !== -1);
        ok('ប្រអប់ PIN មានប៊ូតុងស្កេន', html.indexOf('id="pinBiometricBtn"') !== -1);
        ok('ម៉ឺនុយការកំណត់បង្ហាញកំណែ App នៅខាងក្រោម',
            /<div class="drawer-foot">[\s\S]{0,200}data-app-version/.test(html));
        ok('style.css មានច្បាប់ .drawer-foot', /\.drawer-foot\s*\{/.test(css));
        ok('style.css មានច្បាប់ .btn-biometric', /\.btn-biometric\s*\{/.test(css));
        ok('style.css មានច្បាប់ .drawer-toggle-state', /\.drawer-toggle-state\s*\{/.test(css));
    }

    console.log('\n' + (fail === 0 ? '✅ ជោគជ័យ ' + pass : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
    process.exit(fail === 0 ? 0 : 1);
})();
