// ⛔ ថ្នាក់កំហុស ៖ **ការដោះសោ PIN ដោយក្រយៅដៃ/មុខក្នុង ZoeKeyGen** (សំណើម្ចាស់គម្រោង «ZoeKeyGen ដាក់ biometric ផង»)។
//
// PIN របស់ ZoeKeyGen ការពារ Config និងសោដែលដោះ **Signing Key** (អ្នកណាមាន Signing Key ក្លែង Activation Key បានទាំងអស់)
// ➜ ជីវមាត្រជាការ **ដោះសោ** PIN មិនមែនជំនួស PIN ៖
//   ១. ⛔ មានតែរបៀប **PRF** ៖ សោរុំ PIN ចេញពី authenticator ពេលស្កេនពិត ➜ ឧបករណ៍ដែលគ្មាន PRF ត្រូវ **បដិសេធ**
//      (មិនធ្លាក់ចុះទៅរបៀប device របស់ ZoeW ដែលរក្សាសោក្បែរ PIN ក្នុង localStorage ➜ PIN អានបានដោយគ្មានក្រយៅដៃ)
//   ២. PIN ដែលស្រាយចេញត្រូវផ្ទៀងនឹង hash មុនទុកចិត្ត · មិនត្រូវ ➜ លុបការចង · ការប្តូរ PIN ➜ លុបការចង
//   ៣. ផ្លូវជោគជ័យតែមួយ `completePinUnlock()` (ដូចការវាយ PIN) · lockout គោរព · PIN modal បិទ ឬ logout កណ្តាលការស្កេន ➜ មិនដោះ
//   ៤. ខ្សែភ្ជាប់ ៖ ប៊ូតុងក្នុង PIN modal · កុងតាក់ក្នុង Config · ACTION_ALLOWLIST · ការដំណើរការស្វ័យប្រវត្តិពេល PIN modal បើក
'use strict';
process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.KEYGEN_APP_DIR ? path.resolve(process.env.KEYGEN_APP_DIR) : root;
let src = '';
let html = '';
try { src = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen/app.js'), 'utf8'); } catch (e) { src = ''; }
try { html = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen/index.html'), 'utf8'); } catch (e) { html = ''; }

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function slice(names) {
    const missing = [];
    const out = names.map((name) => {
        const plainStart = src.indexOf('\nfunction ' + name + '(');
        const asyncStart = src.indexOf('\nasync function ' + name + '(');
        const start = asyncStart !== -1 && (plainStart === -1 || asyncStart < plainStart) ? asyncStart + 1 : (plainStart === -1 ? -1 : plainStart + 1);
        if (start <= 0) { missing.push(name); return ''; }
        let depth = 0, i = src.indexOf('{', src.indexOf(')', start)), started = false;
        for (; i < src.length; i++) {
            if (src[i] === '{') { depth++; started = true; }
            else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
        }
        return src.slice(start, i);
    }).join('\n\n');
    return { code: out, missing };
}
function realDecl(name) {
    const m = src.match(new RegExp('^const ' + name + ' = .*;$', 'm'));
    return m ? m[0] : '';
}

ok('ជាន់អប្បបរមា ៖ អាន ZoeKeyGen/app.js · index.html បាន', src.length > 20000 && html.length > 5000, src.length);

const FNS = ['safeStoreGet', 'safeStoreSet', 'safeStoreRemove', 'requestPinBeforeConfig', 'bytesToB64', 'b64ToBytes',
    'readBiometricRecord', 'clearBiometricRecord', 'isBiometricEnabled', 'biometricPlatformAvailable', 'wrapPinWithRawKey',
    'unwrapPinWithRawKey', 'biometricPrfFirst', 'biometricPrfEval', 'biometricPrfBytes', 'enrollBiometricRecord', 'biometricUnlockPin', 'setBiometricBusy',
    'refreshBiometricUi', 'runBiometricUnlock', 'startBiometricEnrollment', 'toggleBiometricUnlock', 'completePinUnlock',
    'isPinFlowPending', 'invalidateSensitiveSession', 'captureSensitiveSession', 'isSensitiveSessionCurrent'];
const sliced = slice(FNS);
ok('រាល់ function ជីវមាត្រមានក្នុង ZoeKeyGen/app.js (' + FNS.length + ')', sliced.missing.length === 0, sliced.missing);

// authenticator តែមួយ (ឧបករណ៍ដដែល) ឆ្លង build ➜ កំណត់ត្រាដែលចងក្នុង build មួយ ស្រាយបានក្នុង build ផ្សេង
const prfSecret = nodeCrypto.randomBytes(32);

function build(opts) {
    const o = Object.assign({ prf: true, platform: true }, opts || {});
    const store = new Map(Object.entries(o.storage || {}));
    const els = {};
    const getEl = (id) => {
        if (!els[id]) {
            const classes = new Set(id === 'pinBiometricBtn' ? ['hidden'] : []);
            els[id] = {
                id, value: '', textContent: '', disabled: false,
                classList: {
                    add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
                    toggle: (c, on) => { if (on === undefined ? !classes.has(c) : on) classes.add(c); else classes.delete(c); }
                }
            };
        }
        return els[id];
    };
    const log = { toasts: [], alerts: [], targets: [], creates: 0, gets: 0, closed: [] };
    // ⛔ authenticator ក្លែងតាមរូបរាងវេទិកាពិត ៖ `android` = Google Password Manager (PRF តែលើ passkey ដែល discoverable ៖
    //    `residentKey: 'discouraged'` ➜ credential ចាស់គ្មាន hmac-secret ➜ `prf.enabled: false`) · `prfAtCreate` = Chrome ដែលវាយតម្លៃ
    //    PRF ក្នុង `create()` ខ្លួនវា (ប្រអប់ស្កេនតែម្តង) · `enabledMissing` = `prf: {}` គ្មានវាល `enabled` (មិនដឹង ➜ សួរ `get()`)
    const prfOf = (req) => {
        const salt = Buffer.from(req.publicKey.extensions && req.publicKey.extensions.prf ? req.publicKey.extensions.prf.eval.first : []);
        return new Uint8Array(nodeCrypto.createHmac('sha256', o.wrongPrf ? nodeCrypto.randomBytes(32) : prfSecret).update(salt).digest()).buffer;
    };
    let credPrf = o.prf;
    const credentials = {
        create: async (req) => {
            log.creates++;
            log.createReq = req;
            if (o.createReject) throw new Error('NotAllowedError');
            const sel = req.publicKey.authenticatorSelection || {};
            credPrf = o.prf && (!o.android || sel.residentKey === 'required' || sel.residentKey === 'preferred' || sel.requireResidentKey === true);
            const ext = !credPrf ? (o.android ? { prf: { enabled: false } } : {})
                : o.prfAtCreate ? { prf: { enabled: true, results: { first: prfOf(req) } } }
                : o.enabledMissing ? { prf: {} } : { prf: { enabled: true } };
            return { rawId: new Uint8Array([7, 7, 7, 7]).buffer, getClientExtensionResults: () => ext };
        },
        get: async (req) => {
            log.gets++;
            if (o.getHook) await o.getHook();
            if (o.getReject) throw new Error('NotAllowedError');
            return { getClientExtensionResults: () => (credPrf ? { prf: { results: { first: prfOf(req) } } } : {}) };
        }
    };
    const sandbox = {
        console, JSON, Object, Array, String, Number, Math, Error, Promise, Uint8Array, TextEncoder, TextDecoder, Date,
        parseInt, isFinite, btoa, atob,
        crypto: globalThis.crypto,
        navigator: { credentials },
        PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: async () => o.platform },
        window: { isSecureContext: true, PublicKeyCredential: {}, location: { hostname: 'keygen.example' } },
        document: { getElementById: getEl },
        confirm: () => true,
        alert: (m) => log.alerts.push(String(m)),
        showToast: (m) => log.toasts.push(String(m)),
        openModalHelper: (id) => getEl(id).classList.add('active'),
        closeModal: (id) => { log.closed.push(id); getEl(id).classList.remove('active'); },
        clearPinInputValues() {},
        openConfigModal: (...a) => log.targets.push(['openConfigModal'].concat(a)),
        deriveSigningKeySessionKey: async (pin) => ({ derivedFrom: pin }),
        hashPin: async (pin) => 'pbkdf2:' + nodeCrypto.createHash('sha256').update('zoekeygen_pin_verify_v1|' + pin).digest('hex'),
        verifyStoredPin: async (pin, saved) => saved === 'pbkdf2:' + nodeCrypto.createHash('sha256').update('zoekeygen_pin_verify_v1|' + pin).digest('hex'),
        auth: { currentUser: { uid: 'admin' } },
        __log: log, __store: store, __el: getEl
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(`var appLocalStore = { getItem: (k) => __store.has(k) ? __store.get(k) : null, setItem: (k, v) => { __store.set(k, String(v)); }, removeItem: (k) => { __store.delete(k); } };
        var sensitiveSessionGeneration = 0; var authGeneration = 1; var isSignedInUiActive = true; var isVerifyingPin = false;
        var pinTargetAction = null; var signingKeySessionKey = null;`, ctx);
    vm.runInContext([realDecl('BIOMETRIC_STORAGE_KEY'), realDecl('BIOMETRIC_PRF_SALT'), 'var biometricUnlockInFlight = false;'].join('\n'), ctx);
    vm.runInContext(sliced.code, ctx);
    return { ctx, log, store, el: getEl };
}
const PIN = '482913';
const HASH = 'pbkdf2:' + nodeCrypto.createHash('sha256').update('zoekeygen_pin_verify_v1|' + PIN).digest('hex');
const KEY = (realDecl('BIOMETRIC_STORAGE_KEY').match(/'([^']+)'/) || [])[1] || '?';
const flush = () => new Promise((r) => setImmediate(r));
const until = async (cond, ms = 8000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 10)); };

(async () => {
    console.log('-- ១. ចង (PRF ពិត) · ⛔ គ្មាន PRF ➜ បដិសេធ --');
    let h = build({ storage: { zoew_security_pin_hash: HASH } });
    await h.ctx.startBiometricEnrollment(PIN);
    const rec = (() => { try { return JSON.parse(h.store.get(KEY)); } catch (e) { return null; } })();
    ok('PRF ➜ កំណត់ត្រា mode prf · គ្មាន wrapKey · PIN មិនលេចជាអក្សរ', !!rec && rec.mode === 'prf' && !('wrapKey' in rec)
        && h.store.get(KEY).indexOf(PIN) === -1 && h.ctx.isBiometricEnabled() === true, rec);
    ok('ប៊ូតុងក្នុង PIN modal លេច · ស្ថានភាព «បើក»', !h.el('pinBiometricBtn').classList.contains('hidden') && h.el('biometricToggleState').textContent === 'បើក');
    let h2 = build({ prf: false, storage: { zoew_security_pin_hash: HASH } });
    await h2.ctx.startBiometricEnrollment(PIN);
    ok('⛔ គ្មាន PRF ➜ មិនរក្សាអ្វីសោះ (មិនធ្លាក់ចុះទៅរបៀប device) · ប្រាប់មូលហេតុ', !h2.store.has(KEY) && h2.log.alerts.some((a) => /PRF/.test(a)), h2.log.alerts);
    h2 = build({ platform: false, storage: { zoew_security_pin_hash: HASH } });
    await h2.ctx.startBiometricEnrollment(PIN);
    ok('ឧបករណ៍គ្មាន authenticator ➜ មិនហៅ WebAuthn', h2.log.creates === 0 && !h2.store.has(KEY));
    h2 = build({ storage: { zoew_security_pin_hash: HASH } });
    vm.runInContext('auth = { currentUser: null };', h2.ctx);
    await h2.ctx.startBiometricEnrollment(PIN);
    ok('មិនទាន់ចូលប្រព័ន្ធ ➜ មិនចង', h2.log.creates === 0 && !h2.store.has(KEY));

    // ⛔ Android (Google Password Manager) ៖ PRF មានតែលើ passkey ដែល discoverable ➜ `residentKey: 'discouraged'` = «មិនគាំទ្រ»
    //    ក្លែងក្លាយលើទូរស័ព្ទដែលគាំទ្រពិត (អ្នកប្រើរាយការណ៍ ៖ ZoeW ដើរ · ZoeKeyGen «មិនគាំទ្រ» លើទូរស័ព្ទដដែល)
    h2 = build({ android: true, storage: { zoew_security_pin_hash: HASH } });
    await h2.ctx.startBiometricEnrollment(PIN);
    const sel = (h2.log.createReq && h2.log.createReq.publicKey.authenticatorSelection) || {};
    ok('Android (PRF តែ passkey discoverable) ➜ ចងបាន · ស្នើ residentKey required', h2.store.has(KEY) && !h2.log.alerts.length
        && sel.residentKey === 'required' && sel.requireResidentKey === true, { alerts: h2.log.alerts, sel });
    const androidRec = h2.store.get(KEY);
    let a2 = build({ android: true, storage: { zoew_security_pin_hash: HASH, [KEY]: androidRec } });
    a2.el('pinModal').classList.add('active');
    ok('Android ៖ កំណត់ត្រាដែលចង ➜ ស្រាយ PIN ចេញវិញបាន', (await a2.ctx.biometricUnlockPin()) === PIN);
    h2 = build({ prfAtCreate: true, storage: { zoew_security_pin_hash: HASH } });
    await h2.ctx.startBiometricEnrollment(PIN);
    ok('PRF ក្នុង create() ➜ ប្រើវាផ្ទាល់ · ប្រអប់ស្កេនតែម្តង (គ្មាន get)', h2.store.has(KEY) && h2.log.creates === 1 && h2.log.gets === 0, h2.log);
    a2 = build({ storage: { zoew_security_pin_hash: HASH, [KEY]: h2.store.get(KEY) } });
    ok('PRF ពី create() ស្មើ PRF ពី get() ➜ ស្រាយ PIN ចេញ', (await a2.ctx.biometricUnlockPin()) === PIN);
    h2 = build({ enabledMissing: true, storage: { zoew_security_pin_hash: HASH } });
    await h2.ctx.startBiometricEnrollment(PIN);
    ok('`prf: {}` (គ្មាន enabled) ➜ សួរ get() ➜ ចងបាន', h2.store.has(KEY) && h2.log.gets === 1 && !h2.log.alerts.length, h2.log.alerts);
    h2 = build({ getReject: true, storage: { zoew_security_pin_hash: HASH } });
    await h2.ctx.startBiometricEnrollment(PIN);
    ok('⛔ បោះបង់ការស្កេនទី ២ ≠ «មិនគាំទ្រ PRF» ➜ មិនរក្សា · toast បោះបង់ · គ្មាន alert PRF', !h2.store.has(KEY)
        && !h2.log.alerts.some((a) => /PRF/.test(a)) && h2.log.toasts.some((t) => /បោះបង់/.test(t)), { alerts: h2.log.alerts, toasts: h2.log.toasts });

    console.log('-- ២. ដោះសោ ➜ ផ្លូវជោគជ័យដូចការវាយ PIN --');
    const enrolled = h.store.get(KEY);
    let u = build({ storage: { zoew_security_pin_hash: HASH, [KEY]: enrolled, zoew_pin_fail_count: '3' } });
    u.ctx.requestPinBeforeConfig(u.ctx.openConfigModal, 'x');
    await flush(); await flush(); await flush();
    await until(() => u.log.targets.length > 0);
    ok('PIN modal បើក ➜ ស្កេនស្វ័យប្រវត្តិ ➜ targetAction ទទួល PIN · modal បិទ · fail count លុប',
        u.log.gets >= 1 && u.log.targets.length === 1 && u.log.targets[0][1] === PIN && u.log.closed.includes('pinModal') && !u.store.has('zoew_pin_fail_count'), u.log);
    ok('សោ Session របស់ Signing Key ដេរីវេពី PIN ដដែល', vm.runInContext('signingKeySessionKey && signingKeySessionKey.derivedFrom', u.ctx) === PIN);

    // ⚠️ ការដោះសោត្រឹមត្រូវ ➜ ការចងដោយ PRF ពិត ៖ authenticator ផ្សេង (PRF ខុស) ស្រាយមិនចេញ
    u = build({ wrongPrf: true, storage: { zoew_security_pin_hash: HASH, [KEY]: enrolled } });
    u.el('pinModal').classList.add('active');
    ok('PRF ខុស ➜ ស្រាយមិនចេញ ➜ មិនដោះ', (await u.ctx.runBiometricUnlock()) === false && !u.log.targets.length);

    u = build({ storage: { zoew_security_pin_hash: 'pbkdf2:other', [KEY]: enrolled } });
    u.el('pinModal').classList.add('active');
    ok('⛔ PIN ត្រូវប្តូរ (hash មិនត្រូវ) ➜ មិនដោះ · លុបការចង · ប្រាប់អ្នកប្រើ',
        (await u.ctx.runBiometricUnlock()) === false && !u.store.has(KEY) && u.log.toasts.some((t) => /លែងត្រូវ/.test(t)), u.log.toasts);

    u = build({ storage: { zoew_security_pin_hash: HASH, [KEY]: enrolled, zoew_pin_lockout_until: String(Date.now() + 60000) } });
    u.el('pinModal').classList.add('active');
    ok('lockout ➜ មិនហៅ WebAuthn', (await u.ctx.runBiometricUnlock()) === false && u.log.gets === 0);

    let closeDuring;
    u = build({ storage: { zoew_security_pin_hash: HASH, [KEY]: enrolled }, getHook: () => closeDuring() });
    u.el('pinModal').classList.add('active');
    closeDuring = () => u.el('pinModal').classList.remove('active');
    ok('⛔ PIN modal បិទកណ្តាលការស្កេន ➜ មិនដោះ', (await u.ctx.runBiometricUnlock()) === false && !u.log.targets.length);
    u = build({ storage: { zoew_security_pin_hash: HASH, [KEY]: enrolled }, getHook: () => closeDuring() });
    u.el('pinModal').classList.add('active');
    closeDuring = () => u.ctx.invalidateSensitiveSession();
    ok('⛔ ចាកចេញកណ្តាលការស្កេន ➜ មិនដោះ', (await u.ctx.runBiometricUnlock()) === false && !u.log.targets.length);

    u = build({ storage: { zoew_security_pin_hash: HASH } });
    u.ctx.requestPinBeforeConfig(u.ctx.openConfigModal, 'x');
    await flush();
    ok('ទិសផ្ទុយ ៖ មិនទាន់បើក ➜ PIN modal មិនហៅ WebAuthn · ប៊ូតុងលាក់', u.log.gets === 0 && u.el('pinBiometricBtn').classList.contains('hidden'));

    console.log('-- ៣. ការប្តូរ PIN · កុងតាក់ · ខ្សែភ្ជាប់ --');
    const saveFn = (src.match(/async function saveNewSecurityPin\(\)[\s\S]*?\n\}/) || [''])[0];
    ok('⛔ កំណត់ PIN ថ្មី ➜ លុបការចង (PIN ចាស់ដែលរុំមិនត្រូវទុក)', /setItem\('zoew_security_pin_hash'[^\n]*\n\s*clearBiometricRecord\(\);/.test(saveFn));
    u = build({ storage: { zoew_security_pin_hash: HASH, [KEY]: enrolled } });
    u.ctx.toggleBiometricUnlock();
    ok('កុងតាក់ពេលបើក ➜ បិទ (លុបកំណត់ត្រា)', !u.store.has(KEY) && u.el('biometricToggleState').textContent === 'បិទ');
    u = build({ storage: { zoew_security_pin_hash: HASH } });
    u.ctx.toggleBiometricUnlock();
    ok('កុងតាក់ពេលបិទ ➜ សុំ PIN (គោលដៅ = startBiometricEnrollment)', u.el('pinModal').classList.contains('active')
        && vm.runInContext('pinTargetAction === startBiometricEnrollment', u.ctx));
    const allow = (/const ACTION_ALLOWLIST = \[([\s\S]*?)\];/.exec(src) || [])[1] || '';
    ok('ACTION_ALLOWLIST មាន runBiometricUnlock · toggleBiometricUnlock', /"runBiometricUnlock"/.test(allow) && /"toggleBiometricUnlock"/.test(allow));
    const pinModal = (/<div id="pinModal"[\s\S]*?\n<\/div>/.exec(html) || [''])[0];
    const configModal = (/<div id="configModal"[\s\S]*?\n<\/div>/.exec(html) || [''])[0];
    ok('PIN modal មានប៊ូតុង 🫆 (លាក់ជាលំនាំដើម) ➜ runBiometricUnlock', /id="pinBiometricBtn"[^>]*data-act="runBiometricUnlock"/.test(pinModal) && /class="btn-biometric hidden"/.test(pinModal));
    ok('Config មានកុងតាក់ ➜ toggleBiometricUnlock + ស្ថានភាព', /data-act="toggleBiometricUnlock"/.test(configModal) && /id="biometricToggleState"/.test(configModal));

    console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + '/' + (pass + fail));
    process.exitCode = fail === 0 ? 0 : 1;
})().catch((e) => {
    console.log('  FAIL   keygen-biometric-test គាំង ➜ ' + (e && e.stack ? e.stack : e));
    process.exitCode = 1;
});
