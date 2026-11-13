const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const ROOT = process.env.LICENSE_INVITATION_UI_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..');
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
function before(first, second) { return !!first && !!second && !!(first.compareDocumentPosition(second) & 4); }
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
        for (const id of ['activationKeyInput', 'activationSubmitBtn', 'seatEnrollmentPrepareBtn']) check(visible(document.getElementById(id)), backendKind + '៖ វិធីដោយដៃមើលឃើញភ្លាម ' + id);
        const invitation = document.getElementById('licenseInvitationCode');
        check(backendKind === 'supabase' ? !invitation : !!invitation?.closest('details') && !visible(invitation), backendKind + '៖ ការអញ្ជើញមិនជំនួសផ្លូវដើម');
        if (invitation) check(before(document.getElementById('activationKeyInput'), invitation), 'អតិថិជន៖ វិធីដោយដៃនៅមុនការអញ្ជើញ');
    }
    for (const patch of [
        { invitationCode: 'A'.repeat(24) + '.' + 'B'.repeat(16) },
        { invitationMessage: 'ការអញ្ជើញមិនទាន់បើកប្រើទេ។ សូមទាក់ទងអ្នកលក់ ឬប្រើជម្រើសដាក់ Key ដោយដៃ។' },
        { invitationBusy: true, invitationVerificationCode: '01234567' }
    ]) {
        const document = customer(patch);
        check(visible(document.getElementById('licenseInvitationCode')), 'អតិថិជន៖ កូដ ឬលទ្ធផលសំណើមិនលាក់ក្នុងផ្នែកបិទ');
        check(visible(document.getElementById('activationKeyInput')), 'អតិថិជន៖ សំណើមិនបិទលាក់ជម្រើសដោយដៃ');
        if (patch.invitationMessage) check([...document.querySelectorAll('[role="status"]')].some(node => node.textContent === patch.invitationMessage && visible(node)), 'អតិថិជន៖ សារមិនទាន់បើកប្រើមើលឃើញ');
        if (patch.invitationBusy) check(document.getElementById('activationSubmitBtn').disabled, 'អតិថិជន៖ មិនអនុញ្ញាតឱ្យ Activate ជាន់ប្រតិបត្តិការ');
    }
    const seller = new Window().document;
    seller.body.innerHTML = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/index.html'), 'utf8');
    for (const id of ['secureKeySetupKey', 'secureKeyEnrollmentInput', 'secureKeyApproveBtn']) check(visible(seller.getElementById(id)), 'អ្នកលក់៖ វិធីដោយដៃមើលឃើញភ្លាម ' + id);
    const invitation = seller.getElementById('licenseInvitationTarget');
    check(!!invitation?.closest('details') && !visible(invitation), 'អ្នកលក់៖ ការអញ្ជើញជាជម្រើសបន្ថែមបិទជាលំនាំដើម');
    check(before(seller.getElementById('secureKeyApproveBtn'), invitation), 'អ្នកលក់៖ វិធីដោយដៃនៅមុនការអញ្ជើញ');
    console.log(`${passed} PASS, ${failed} FAIL`);
    process.exitCode = failed ? 1 : 0;
}
run().catch(error => { console.error(error); process.exitCode = 1; });
