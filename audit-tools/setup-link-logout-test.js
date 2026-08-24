const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.SETUP_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, label, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

function fakeDom(pinOpen) {
    const els = {};
    const mk = (id) => (els[id] = els[id] || { id, style: { display: 'none' }, value: '', textContent: '',
        innerText: '', innerHTML: '', classList: { add() {}, remove() {}, contains: () => false },
        setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, getAttribute: () => null });
    ['pinModal', 'pinSetupModal', 'loginModal', 'configModal', 'firebaseConfigInput', 'configInput',
     'loginEmailInput', 'rememberMeCheckbox', 'securityPinInput', 'sentryDsnInput'].forEach(mk);
    // `#appPages` ត្រូវតាមដាន class ពិត ➜ អាចអះអាងថាការចាកចេញដោះការផ្អាក
    // `scroll-snap` នៃចលនាផ្ទាំង។ បើវាជាប់ ➜ PTR ស្លាប់នៅ session បន្ទាប់។
    mk('appPages');
    const pageClasses = new Set(['panel-gliding']);
    els.appPages.classList = {
        add: (c) => pageClasses.add(c),
        remove: (c) => pageClasses.delete(c),
        contains: (c) => pageClasses.has(c)
    };
    els.appPages._classes = pageClasses;
    if (pinOpen) els.pinModal.style.display = 'flex';
    return {
        getElementById: (id) => els[id] || null,
        querySelectorAll: () => [els.pinModal, els.pinSetupModal, els.configModal],
        body: { style: {}, classList: { add() {}, remove() {}, contains: () => false } },
        addEventListener() {},
        _els: els
    };
}

for (const app of ['ZoeW']) {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const stateVar = 'pinTargetAction';

    for (const pinOpen of [false, true]) {
        console.log(`\n=== ${app} — logout while a Setup Link is armed (PIN modal ${pinOpen ? 'OPEN' : 'closed'}) ===`);
        const ctx = {
            console,
            document: fakeDom(pinOpen),
            localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
            hidePhoneSuggestions() {}, restoreAfterPdfExport() {}, closeConfigQrScanner() {},
            setPhoneSearchPulledUp() {},
            scheduleChromeLayoutSettle() {},
            closeModal() {}, openModalHelper() {}, openConfigModal() {}
        };
        ctx[stateVar] = { projectId: 'business-B' };
        ctx.pendingRestoreId = null; ctx.pendingPermanentDeleteId = null;
        ctx.activeParentItemId = null; ctx.lookupSecretKey = 'secret';
        vm.createContext(ctx);
        vm.runInContext((src.match(/^ *let chromeHidden = .*$/m) || ['let chromeHidden = false;'])[0], ctx);
        vm.runInContext(sliceFn(src, 'showAppChrome'), ctx);
        ['scanConfirmCode', 'scanConfirmCount', 'scanConfirmAt'].forEach((n) => {
            const decl = (src.match(new RegExp('^ *let ' + n + ' = .*$', 'm')) || [])[0];
            if (decl) vm.runInContext(decl, ctx);
        });
        const resetScanFn = sliceFn(src, 'resetScanConfirm');
        if (resetScanFn) vm.runInContext(resetScanFn, ctx);
        // ស្ថានភាពចលនាផ្ទាំង — ចាក់ **កូដពិត** មិនមែន stub ទទេ ដើម្បីឲ្យ
        // តេស្តពិតជាបញ្ជាក់ថាការចាកចេញដោះការផ្អាក snap។
        ['panelGlideTokens', 'panelGlideRelease'].forEach((n) => {
            const decl = (src.match(new RegExp('^ *let ' + n + ' = .*$', 'm')) || [])[0];
            if (decl) vm.runInContext(decl, ctx);
        });
        ctx.clearTimeout = () => {};
        const glidePauseFn = sliceFn(src, 'endPanelGlideSnapPause');
        if (glidePauseFn) vm.runInContext(glidePauseFn, ctx);
        vm.runInContext('panelGlideTokens = 2; panelGlideRelease = 99;', ctx);
        vm.runInContext('scanConfirmCode = "ZTO9999000111"; scanConfirmCount = 1; scanConfirmAt = 123;', ctx);
        const helper = sliceFn(src, 'isPinFlowPending');
        if (helper) vm.runInContext(helper, ctx);
        const clearFn = sliceFn(src, 'clearSensitiveModalFields');
        if (clearFn) vm.runInContext(clearFn, ctx);
        vm.runInContext(sliceFn(src, 'showLoginModalWithPrefill'), ctx);

        let threw = null;
        const pagesEl = ctx.document.getElementById('appPages');
        try { ctx.showLoginModalWithPrefill(); } catch (e) { threw = e; }
        ok(!!glidePauseFn, 'endPanelGlideSnapPause មានក្នុង app.js');
        ok(pagesEl && !pagesEl._classes.has('panel-gliding'),
            'ចាកចេញ ➜ ដោះការផ្អាក scroll-snap នៃចលនាផ្ទាំង (PTR នៅរស់)',
            pagesEl ? [...pagesEl._classes] : null);
        // អថេរ `let` ក្នុង vm មិនក្លាយជា property នៃ context ➜ ត្រូវអានតាម expression
        const glideState = vm.runInContext('({ tokens: panelGlideTokens, release: panelGlideRelease })', ctx);
        ok(glideState.tokens === 0 && glideState.release === null,
            'ចាកចេញ ➜ ស្ថានភាពចលនាផ្ទាំងត្រូវសម្អាតអស់', glideState);
        ok(!threw, 'logout runs without throwing', threw && threw.message);
        ok(vm.runInContext('scanConfirmCode', ctx) === '' && vm.runInContext('scanConfirmCount', ctx) === 0,
            'the barcode held for scan confirmation does not survive logout',
            vm.runInContext('scanConfirmCode', ctx));

        if (!pinOpen) {
            ok(ctx[stateVar] === null,
                `abandoned Setup Link is discarded, so it cannot pre-fill another business's config later (${stateVar})`,
                ctx[stateVar]);
        } else {
            ok(ctx[stateVar] !== null,
                `a Setup Link the operator is actively entering a PIN for is NOT thrown away (${stateVar})`,
                ctx[stateVar]);
        }
    }
}

console.log('\n=== isPinFlowPending behaves correctly in all four apps ===');
for (const app of ['ZoeW', 'ZoeKeyGen']) {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const fn = sliceFn(src, 'isPinFlowPending');
    ok(!!fn, `${app} defines isPinFlowPending`);
    if (!fn) continue;
    const usesActive = app === 'ZoeKeyGen';
    const mkEl = (open) => ({
        style: { display: open && !usesActive ? 'flex' : 'none' },
        classList: { contains: (c) => usesActive && open && c === 'active' }
    });
    for (const open of [false, true]) {
        const ctx = { console, document: { getElementById: (id) => (id === 'pinModal' ? mkEl(open) : mkEl(false)) } };
        vm.createContext(ctx);
        vm.runInContext(fn, ctx);
        ok(ctx.isPinFlowPending() === open, `${app}: reports ${open ? 'pending' : 'not pending'} correctly`, ctx.isPinFlowPending());
    }
}

console.log('\n' + (fail ? '❌ ' : '✅ ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
