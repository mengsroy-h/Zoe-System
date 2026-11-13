process.exitCode = 1;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const ROOT = process.env.LICENSE_KEY_UI_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..');
const appRequire = createRequire(path.join(__dirname, '../../ZoeW/package.json'));
const ts = appRequire('typescript');
const React = appRequire('react');
const { renderToStaticMarkup } = appRequire('react-dom/server');
let passed = 0, failed = 0;
function check(condition, name) {
    if (condition) { passed++; console.log('ok ' + name); }
    else { failed++; console.error('FAIL ' + name); }
}
function visible(element) {
    if (!element) return false;
    for (let node = element; node; node = node.parentElement) {
        if (node.hidden || (node.tagName === 'DETAILS' && !node.open)) return false;
    }
    return true;
}

async function run() {
    const { Window } = await import(appRequire.resolve('happy-dom'));
    const source = fs.readFileSync(path.join(ROOT, 'ZoeW/src/app/components/modals/ActivationModal.tsx'), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    function customer(patch = {}) {
        const state = { backendKind: 'firebase', invitationCode: '', invitationBusy: false, invitationMessage: '', invitationVerificationCode: '', activationMessage: '', activationBusy: false, seatEnrollmentBusy: false, seatEnrollmentOnly: false, seatEnrollmentJson: '', seatEnrollmentFingerprint: '', seatEnrollmentMessage: '', ...patch };
        const exports = {};
        const imports = {
            './Modal': { Modal: ({ id, children }) => React.createElement('div', { id }, children) },
            '../../../core/view-state': { viewState: state },
            '../../actions': { onAct: () => () => {} },
            '../../hooks/useStore': { useStoreFields: () => state },
            '../../refs': { refTo: () => undefined },
            '../shell/SellerTelegramLink': { SellerTelegramLink: () => React.createElement('span', null, 'Telegram') }
        };
        vm.runInNewContext(output, { exports, require: id => imports[id] || appRequire(id) });
        const document = new Window().document;
        document.body.innerHTML = renderToStaticMarkup(React.createElement(exports.ActivationModal));
        return document;
    }
    for (const backendKind of ['firebase', 'supabase']) {
        const document = customer({ backendKind });
        for (const id of ['activationKeyInput', 'activationSubmitBtn', 'activationLogoutBtn']) check(visible(document.getElementById(id)), backendKind + '៖ ផ្លូវដាក់ Key មើលឃើញ ' + id);
        check(!document.getElementById('licenseInvitationCode'), backendKind + '៖ គ្មានផ្នែកការអញ្ជើញ');
        check(!document.getElementById('seatEnrollmentPrepareBtn') && !document.getElementById('seatIdentityRepairBtn'), backendKind + '៖ គ្មានការចុះឈ្មោះឧបករណ៍');
        check(document.querySelectorAll('button').length === 2, backendKind + '៖ មានតែ Activate និងចាកចេញ');
    }
    const seller = new Window().document;
    seller.body.innerHTML = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/index.html'), 'utf8');
    check(!!seller.getElementById('genGenerateBtn') && !!seller.getElementById('genResultKey'), 'អ្នកលក់៖ មានប៊ូតុងបង្កើត និងប្រអប់ Key');
    check(!seller.getElementById('secureKeySetupModal') && !seller.getElementById('licenseInvitationTarget'), 'អ្នកលក់៖ គ្មានផ្ទាំងចុះឈ្មោះ ឬការអញ្ជើញ');
    const keygen = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/app.js'), 'utf8');
    const parsed = ts.createSourceFile('app.js', keygen, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const generated = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'generateLicenseKey');
    if (!generated) throw new Error('Missing generateLicenseKey');
    const elements = {}, writes = [], effects = [];
    const element = id => elements[id] ||= { value: id === 'genDaysInput' ? '30' : id === 'genDevicesInput' ? '2' : '', disabled: false, textContent: '', classList: { remove() {}, add() {} } };
    const payload = { a: 'ZOE', id: 'SYNTHETICKEY123456789', iat: 1800000000, exp: 1802592000 };
    const context = {
        Promise, console, isNaN, parseFloat, Number, Math, Object, Error,
        isGeneratingKey: false, generateKeyOwner: null, lastGeneratedKey: '', signingPrivateKeyJwk: {}, db: {},
        LICENSE_APP_CODE: 'ZOE', keyListSessionGeneration: 1,
        captureSensitiveSession: () => ({ user: { uid: 'seller' } }), adminOperationIsCurrent: () => true,
        captureKeygenClock: () => ({ now: payload.iat * 1000 }), keygenClockIsCurrent: () => true,
        waitForServerTimeSync: async () => true, seatLimitOf: Number, withTimeout: async value => value, retryAsync: async run => run(),
        document: { getElementById: element }, alert: text => effects.push(text), showToast: text => effects.push(text), refreshKeyList() {},
        publishSecureGeneratedKey: async () => { effects.push('secure-setup'); return true; },
        window: { ZoeLicense: { signNewKey: async () => ({ keyString: 'ZOEKEY-synthetic', payload }) } },
        fb: { ref: () => ({}), update: async (_ref, value) => { writes.push(value); } }
    };
    vm.createContext(context);
    vm.runInContext(generated.getText(parsed), context);
    await context.generateLicenseKey();
    check(writes.length === 1, 'អ្នកលក់៖ បង្កើត Key ម្តងតាមផ្លូវដើម');
    const record = writes[0]?.['license_keys/ZOE/' + payload.id];
    const metadata = writes[0]?.['license_keys_meta/ZOE/' + payload.id];
    check(record?.expiresAt === payload.exp * 1000 && record?.maxDevices === 2 && record?.revoked === false && !('seatProtocol' in record), 'អ្នកលក់៖ Key ថ្មីប្រើសុពលភាព និងចំនួនឧបករណ៍ដើម');
    check(metadata?.scope === 'ZOE' && metadata?.createdBy === 'seller' && !('secureIssued' in metadata), 'អ្នកលក់៖ metadata មិនត្រូវការចុះឈ្មោះ');
    check(context.lastGeneratedKey === 'ZOEKEY-synthetic' && element('genResultKey').textContent === 'ZOEKEY-synthetic', 'អ្នកលក់៖ Key បង្ហាញសម្រាប់ចម្លងទៅ Activate');
    check(!effects.includes('secure-setup'), 'អ្នកលក់៖ មិនបើកដំណើរការចុះឈ្មោះ');
    console.log(`${passed} PASS, ${failed} FAIL`);
    process.exitCode = failed ? 1 : 0;
}
run().catch(error => { console.error(error); process.exitCode = 1; });
