const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const ROOT = process.env.LICENSE_INVITATION_UI_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..');
const appRequire = createRequire(path.join(__dirname, '../../ZoeW/package.json'));
const ts = appRequire('typescript');
const React = appRequire('react');
const { renderToStaticMarkup } = appRequire('react-dom/server');
process.exitCode = 1;
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
    const css = ['app.css', 'react-root.css'].map(file => fs.readFileSync(path.join(ROOT, 'ZoeW/src/styles', file), 'utf8')).join('\n');
    for (const busy of ['', 'invitationBusy', 'activationBusy', 'seatEnrollmentBusy']) {
        const document = customer({ invitationCode: 'A'.repeat(24) + '.' + 'B'.repeat(16), ...(busy ? { [busy]: true } : {}) });
        const style = document.createElement('style'); style.textContent = css; document.head.append(style);
        const getStyle = node => document.defaultView.getComputedStyle(node);
        const primary = document.getElementById('activationSubmitBtn');
        const standard = getStyle(primary), standardGroup = getStyle(primary.parentElement);
        const buttons = [...document.querySelectorAll('details button'), document.getElementById('activationLogoutBtn')];
        check(buttons.length === 3, 'ការអញ្ជើញ/បោះបង់/ចាកចេញមានប៊ូតុងទាំងបី');
        for (const button of buttons) {
            const actual = getStyle(button), group = getStyle(button.parentElement);
            check(group.display === 'flex' && group.flexDirection === 'column' && group.gap === standardGroup.gap && group.marginTop === standardGroup.marginTop,
                busy + ' ' + button.textContent + '៖ ជួរឈរពេញទទឹង និងចន្លោះតាមប៊ូតុងស្តង់ដារ');
            check(parseFloat(actual.minHeight) >= 46 && ['padding', 'fontSize', 'borderRadius', 'fontWeight', 'lineHeight', 'flex'].every(property => actual[property] === standard[property]),
                busy + ' ' + button.textContent + '៖ ទំហំប៊ូតុងតាមស្តង់ដារ');
        }
        check(buttons[0].classList.contains('btn-confirm') && buttons.slice(1).every(button => button.classList.contains('btn-cancel')),
            busy + '៖ ស្នើសុំជាប៊ូតុងចម្បង បោះបង់និងចាកចេញជាប៊ូតុងបន្ទាប់');
        check(buttons[0].disabled === !!busy && (!busy || (getStyle(buttons[0]).opacity === '1' && getStyle(buttons[0]).boxShadow === 'none')) && buttons.slice(1).every(button => !button.disabled),
            busy + '៖ ពេលកំពុងធ្វើការ បិទស្នើសុំតែរក្សាបោះបង់និងចាកចេញ');
    }
    const document = customer({ invitationCode: 'A'.repeat(24) + '.' + 'B'.repeat(16) });
    const style = document.createElement('style'); style.textContent = css; document.head.append(style);
    const getStyle = node => document.defaultView.getComputedStyle(node);
    const details = document.querySelector('#activationModal details'), summary = details.querySelector('summary');
    const title = summary.querySelector('strong'), hint = summary.querySelector('.activation-options-hint');
    check(parseFloat(getStyle(details).marginTop) >= 16 && parseFloat(getStyle(summary).minHeight) >= 56 && parseFloat(getStyle(summary).paddingTop) >= 12,
        'ជម្រើសបន្ថែមមានចន្លោះពីប៊ូតុងខាងលើ និងទំហំចុចងាយ');
    check(title?.textContent === 'ជម្រើសបន្ថែម' && hint?.textContent === 'មានលេខកូដអញ្ជើញពីអ្នកលក់' && getStyle(title?.parentElement || summary).display === 'grid',
        'ចំណងជើង និងពាក្យពន្យល់នៅជួរដាច់ដោយឡែក');
    const content = details.querySelector('.activation-options-body');
    check(!!content && getStyle(content).display === 'grid' && parseFloat(getStyle(content).gap) >= 12 && parseFloat(getStyle(content).paddingTop) >= 12,
        'ខ្លឹមសារជម្រើសមានចន្លោះរវាងស្លាក វាលបញ្ចូល និងប៊ូតុង');
    const luminance = color => {
        const hex = color.replace('#', '');
        const channels = color.startsWith('#') ? (hex.length === 3 ? [...hex].map(c => c + c).join('') : hex).match(/../g).map(c => parseInt(c, 16)) : color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
        if (!channels || channels.length !== 3) return NaN;
        return channels.map(channel => { const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
            .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    };
    check([summary, hint].every(node => {
        if (!node) return false;
        const a = luminance(getStyle(node).color), b = luminance(getStyle(summary).backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5;
    }), 'ចំណងជើង និងពាក្យពន្យល់មានកម្រិតពណ៌ខុសគ្នាយ៉ាងហោចណាស់ 4.5:1');
    const buttons = [...document.querySelectorAll('#activationModal button')];
    const colors = buttons.map(button => {
        const actual = getStyle(button), a = luminance(actual.color), b = luminance(actual.backgroundColor);
        return { contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), combination: actual.color + actual.backgroundColor };
    });
    check(buttons.length === 6 && colors.every(color => color.contrast >= 4.5), 'អក្សរប៊ូតុងមានកម្រិតពណ៌ខុសគ្នាយ៉ាងហោចណាស់ 4.5:1');
    check(new Set(colors.map(color => color.combination)).size === 4, 'ពណ៌បែងចែកបញ្ជាក់ ចុះឈ្មោះ ជួសជុល និងបោះបង់');
    check(getStyle(document.getElementById('activationSubmitBtn')).backgroundColor === getStyle(document.documentElement).getPropertyValue('--action-success').trim() && getStyle(document.getElementById('seatEnrollmentPrepareBtn')).backgroundColor === getStyle(document.documentElement).getPropertyValue('--action-primary').trim(),
        'បញ្ជាក់ប្រើពណ៌ជោគជ័យ ហើយចុះឈ្មោះប្រើពណ៌ចម្បង');
    for (const state of [{ activationBusy: true }, { invitationBusy: true }, { seatEnrollmentBusy: true, seatEnrollmentOnly: true }]) {
        const busyDocument = customer(state);
        const busyStyle = busyDocument.createElement('style'); busyStyle.textContent = css; busyDocument.head.append(busyStyle);
        const disabled = [...busyDocument.querySelectorAll('button:disabled')];
        const computed = disabled.map(button => busyDocument.defaultView.getComputedStyle(button));
        check(disabled.length === 4 && computed.every(actual => actual.opacity === '1' && actual.boxShadow === 'none' && actual.backgroundColor === busyDocument.defaultView.getComputedStyle(busyDocument.documentElement).getPropertyValue('--body-bg').trim()),
            'ស្ថានភាពមិនអាចចុចប្រើពណ៌ស្ងប់ រក្សាអក្សរច្បាស់ និងលុបស្រមោល');
    }
    console.log(`${passed} PASS, ${failed} FAIL`);
    process.exitCode = failed ? 1 : 0;
}
run().catch(error => { console.error(error); process.exitCode = 1; });
