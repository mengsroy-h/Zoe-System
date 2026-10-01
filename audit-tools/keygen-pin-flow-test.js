const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.KEYGEN_APP_DIR ? path.resolve(process.env.KEYGEN_APP_DIR) : root;
const src = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen/app.js'), 'utf8');

function slice(names) {
    return names.map((name) => {
        const plainStart = src.indexOf('function ' + name + '(');
        const asyncStart = src.indexOf('async function ' + name + '(');
        const start = asyncStart !== -1 && (plainStart === -1 || asyncStart < plainStart) ? asyncStart : plainStart;
        if (start === -1) return '';
        let depth = 0, i = src.indexOf('{', start), started = false;
        for (; i < src.length; i++) {
            if (src[i] === '{') { depth++; started = true; }
            else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
        }
        return src.slice(start, i);
    }).filter(Boolean).join('\n\n');
}

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function build(savedPin, savedSigningKey) {
    const els = {};
    const getEl = (id) => {
        if (!els[id]) {
            const classes = {};
            els[id] = {
                id, value: '', textContent: '',
                classList: {
                    add: (c) => { classes[c] = true; },
                    remove: (c) => { delete classes[c]; },
                    contains: (c) => !!classes[c]
                }
            };
        }
        return els[id];
    };
    const sandbox = {
        console, String, Object, JSON, Boolean,
        document: { getElementById: getEl },
        localStorage: { getItem: (k) => (k === 'zoew_security_pin_hash' ? savedPin : null), setItem() {}, removeItem() {} },
        sessionStorage: { getItem: (k) => (k === 'zoekeygen_signing_key_enc' ? savedSigningKey : null), setItem() {}, removeItem() {} },
        openConfigModal: function openConfigModal() { sandbox.__ran = 'config'; },
        persistSigningKeyForSession: function persistSigningKeyForSession() { sandbox.__ran = 'persistKey'; },
        tryRestoreSigningKeyFromSession: function tryRestoreSigningKeyFromSession() { sandbox.__ran = 'restoreKey'; },
        refreshBiometricUi: function refreshBiometricUi() {},
        isBiometricEnabled: function isBiometricEnabled() { return false; },
        runBiometricUnlock: function runBiometricUnlock() {},
        __ran: null
    };
    const ctx = vm.createContext(sandbox);
    // ⛔ កំណែ 2.22.5 ៖ storage ចូលប្រើតាម shim `appLocalStore` / `appSessionStore`
    // បូក `safeStoreGet()` ថ្មី ➜ sandbox ត្រូវផ្តល់ពួកវា។
    vm.runInContext('if (typeof appLocalStore === \'undefined\') globalThis.appLocalStore = (typeof localStorage !== \'undefined\' ? localStorage : null); if (typeof appSessionStore === \'undefined\') globalThis.appSessionStore = (typeof sessionStorage !== \'undefined\' ? sessionStorage : null); if (typeof safeStoreGet !== \'function\') globalThis.safeStoreGet = function (s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }; if (typeof safeStoreSet !== \'function\') globalThis.safeStoreSet = function (s, k, v) { try { return s ? (s.setItem(k, String(v)), true) : false; } catch (e) { return false; } }; if (typeof safeStoreRemove !== \'function\') globalThis.safeStoreRemove = function (s, k) { try { return s ? (s.removeItem(k), true) : false; } catch (e) { return false; } };', ctx);
    vm.runInContext('var pinTargetAction = null; var sensitiveSessionGeneration = 0; var isSignedInUiActive = false; var auth = { currentUser: null }; var signingPrivateKeyJwk = null; var SIGNING_KEY_SESSION_STORAGE_KEY = "zoekeygen_signing_key_enc";', ctx);
    vm.runInContext(slice(['invalidateSensitiveSession', 'clearPinInputValues', 'openModalHelper', 'closeModal', 'isPinFlowPending', 'requestPinBeforeConfig', 'requestSessionSigningKeyRestoreIfEligible', 'checkPinAndOpenConfig']), ctx);
    return { ctx, els, getEl };
}

console.log('-- checkPinAndOpenConfig មិនត្រូវទទួលមរតក callback ចាស់ --');
let h = build(null);
h.ctx.requestPinBeforeConfig(h.ctx.persistSigningKeyForSession, 'ចងចាំ Signing Key');
const targetName = () => (h.ctx.pinTargetAction && h.ctx.pinTargetAction.name) || 'null';
ok('ដំបូង៖ គោលដៅ = ចងចាំ Signing Key', targetName() === 'persistSigningKeyForSession', targetName());
h.ctx.checkPinAndOpenConfig();
ok('គ្មាន PIN ➜ បើក pinSetupModal', h.getEl('pinSetupModal').classList.contains('active'));
ok('គោលដៅត្រូវប្តូរទៅ Config (មិនមែន Signing Key)', targetName() === 'openConfigModal', targetName());
(h.ctx.pinTargetAction || h.ctx.openConfigModal)();
ok('ក្រោយកំណត់ PIN ➜ បើកប្រអប់ Config ពិត (មិនមែនរត់ callback ចាស់)', h.ctx.__ran === 'config', h.ctx.__ran);

console.log('-- ការស្ដារ Signing Key មិនត្រូវជាន់លើ PIN flow ដែលកំពុងដំណើរការ --');
h = build('pbkdf2:abc');
h.ctx.checkPinAndOpenConfig();
ok('បើក pinModal រួច', h.getEl('pinModal').classList.contains('active'));
ok('មាន isPinFlowPending()', typeof h.ctx.isPinFlowPending === 'function');
ok('isPinFlowPending() = true', typeof h.ctx.isPinFlowPending === 'function' && h.ctx.isPinFlowPending() === true);
ok('DOMContentLoaded ផ្ទេរការស្ដារ Signing Key ទៅ helper ដែលពិនិត្យ Admin session',
    src.indexOf('requestSessionSigningKeyRestoreIfEligible();') !== -1 &&
    src.indexOf("if (sessionStorage.getItem(SIGNING_KEY_SESSION_STORAGE_KEY) && !isPinFlowPending())") === -1);
ok('គោលដៅនៅតែជា Config', (h.ctx.pinTargetAction && h.ctx.pinTargetAction.name) === 'openConfigModal',
    (h.ctx.pinTargetAction && h.ctx.pinTargetAction.name) || 'null');

console.log('-- ការបោះបង់/Backdrop ត្រូវសម្អាត PIN និងគោលដៅ --');
h = build('pbkdf2:abc');
h.getEl('securityPinInput').value = '123456';
h.getEl('newSecurityPinInput').value = '654321';
h.ctx.pinTargetAction = h.ctx.persistSigningKeyForSession;
h.ctx.closeModal('pinModal');
ok('បោះបង់ PIN ➜ លុប PIN ចាស់', h.getEl('securityPinInput').value === '');
ok('បោះបង់ PIN ➜ លុប PIN ថ្មី', h.getEl('newSecurityPinInput').value === '');
ok('បោះបង់ PIN ➜ លុប callback ចាស់', h.ctx.pinTargetAction === null);
ok('បោះបង់ PIN ➜ បញ្ឈប់ PIN async ដែលកំពុងរង់ចាំ', h.ctx.sensitiveSessionGeneration === 1);

console.log('-- ការស្ដារ Signing Key ត្រូវរង់ចាំ Admin session --');
h = build('pbkdf2:abc', '{"iv":[1],"data":[2]}');
h.ctx.requestSessionSigningKeyRestoreIfEligible();
ok('មិនទាន់ចូល ➜ មិនសួរ PIN ស្ដារ Key', !h.getEl('pinModal').classList.contains('active'));
h.ctx.auth.currentUser = { uid: 'admin' };
h.ctx.isSignedInUiActive = true;
h.ctx.requestSessionSigningKeyRestoreIfEligible();
ok('Admin session រួច ➜ សួរ PIN ស្ដារ Key', h.getEl('pinModal').classList.contains('active'));
ok('restore flow ត្រូវ validate ជាមួយ Public Key ដែលបាន deploy', src.indexOf('await validateSigningKeyAgainstShippedPublicKey(restoredKeyJwk);') !== -1);
ok('checkbox ចងចាំអ៊ីមែល មិនត្រូវប្តូរ Firebase ទៅ local persistence', !/browserLocalPersistence/.test(slice(['doLogin'])));

h = build('pbkdf2:abc');
ok('គ្មាន PIN flow កំពុងបើក ➜ isPinFlowPending() = false',
    typeof h.ctx.isPinFlowPending === 'function' && h.ctx.isPinFlowPending() === false);

console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + '/' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
