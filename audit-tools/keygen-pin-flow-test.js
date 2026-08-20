const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.KEYGEN_APP_DIR ? path.resolve(process.env.KEYGEN_APP_DIR) : root;
const src = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen/app.js'), 'utf8');

function slice(names) {
    return names.map((name) => {
        const start = src.indexOf('function ' + name + '(');
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

function build(savedPin) {
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
        openConfigModal: function openConfigModal() { sandbox.__ran = 'config'; },
        persistSigningKeyForSession: function persistSigningKeyForSession() { sandbox.__ran = 'persistKey'; },
        tryRestoreSigningKeyFromSession: function tryRestoreSigningKeyFromSession() { sandbox.__ran = 'restoreKey'; },
        __ran: null
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext('var pinTargetAction = null;', ctx);
    vm.runInContext(slice(['openModalHelper', 'isPinFlowPending', 'requestPinBeforeConfig', 'checkPinAndOpenConfig']), ctx);
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
ok('ដូច្នេះ DOMContentLoaded នឹងរំលងការស្ដារ Signing Key',
    src.indexOf('SIGNING_KEY_SESSION_STORAGE_KEY) && !isPinFlowPending()') !== -1);
ok('គោលដៅនៅតែជា Config', (h.ctx.pinTargetAction && h.ctx.pinTargetAction.name) === 'openConfigModal',
    (h.ctx.pinTargetAction && h.ctx.pinTargetAction.name) || 'null');

h = build('pbkdf2:abc');
ok('គ្មាន PIN flow កំពុងបើក ➜ isPinFlowPending() = false',
    typeof h.ctx.isPinFlowPending === 'function' && h.ctx.isPinFlowPending() === false);

console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + '/' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
