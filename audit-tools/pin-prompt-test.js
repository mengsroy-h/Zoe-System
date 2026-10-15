const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime } = require('./react-view');

const ROOT = process.env.PINPROMPT_APP_DIR || path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

process.on('uncaughtException', (e) => {
    console.log('   FAIL  ' + e.message);
    console.log('\n❌ ធ្លាក់ — កូដដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
});

function matchBrace(src, from, open, close) {
    let depth = 0, i = from, quote = '';
    for (; i < src.length; i++) {
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

function sliceConst(src, name) {
    const start = src.indexOf('const ' + name + ' = {');
    if (start === -1) throw new Error('not found: const ' + name);
    const end = matchBrace(src, src.indexOf('{', start), '{', '}');
    if (end === -1) throw new Error('unbalanced: const ' + name);
    return src.slice(start, end + 1) + ';';
}

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) throw new Error('not found: function ' + name);
    const end = matchBrace(src, src.indexOf('{', src.indexOf(')', start)), '{', '}');
    if (end === -1) throw new Error('unbalanced: function ' + name);
    return src.slice(start, end + 1);
}

function callArgs(src, fnName) {
    const out = [];
    let from = 0;
    for (;;) {
        const at = src.indexOf(fnName + '(', from);
        if (at === -1) break;
        from = at + fnName.length;
        const before = src[at - 1];
        if (before && /[\w$.]/.test(before)) continue;
        const open = at + fnName.length;
        const close = matchBrace(src, open, '(', ')');
        if (close === -1) break;
        const inner = src.slice(open + 1, close);
        const parts = [];
        let depth = 0, quote = '', buf = '';
        for (let i = 0; i < inner.length; i++) {
            const c = inner[i];
            if (quote) {
                buf += c;
                if (c === '\\') { buf += inner[++i] || ''; continue; }
                if (c === quote) quote = '';
                continue;
            }
            if (c === '"' || c === "'" || c === '`') { quote = c; buf += c; continue; }
            if (c === '(' || c === '{' || c === '[') depth++;
            else if (c === ')' || c === '}' || c === ']') depth--;
            if (c === ',' && depth === 0) { parts.push(buf.trim()); buf = ''; continue; }
            buf += c;
        }
        if (buf.trim()) parts.push(buf.trim());
        out.push({ offset: at, args: parts });
        from = close;
    }
    return out;
}

const appJs = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

console.log('\n=== ប្រអប់ PIN៖ សារត្រូវតាមប៊ូតុងដែលហៅ ===');

ok('index.html មាន id="pinModalDesc"', html.indexOf('id="pinModalDesc"') !== -1);
ok('index.html មាន id="pinSetupModalDesc"', html.indexOf('id="pinSetupModalDesc"') !== -1);

const ctx = vm.createContext({ console, document: { getElementById: () => null } });
// ⛔ កំណែ 2.22.5 ៖ កូដ ship ចូលប្រើ storage តាម shim `appLocalStore` /
// `appSessionStore` បូក `safeStoreGet()` ថ្មី។ sandbox ត្រូវផ្តល់ពួកវា
// បើមិនដូច្នេះ function ដែលស្រង់ចូល vm បោះ ReferenceError។
// ⚠️ ការចាក់ប្រើ `typeof … === 'undefined'` ➜ កូដពិតដែលស្រង់ចូលក្រោយ
// **ឈ្នះ** shim នេះជានិច្ច។
vm.runInContext('if (typeof appLocalStore === \'undefined\') globalThis.appLocalStore = (typeof localStorage !== \'undefined\' ? localStorage : null); if (typeof appSessionStore === \'undefined\') globalThis.appSessionStore = (typeof sessionStorage !== \'undefined\' ? sessionStorage : null); if (typeof safeStoreGet !== \'function\') globalThis.safeStoreGet = function (s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }; if (typeof safeStoreSet !== \'function\') globalThis.safeStoreSet = function (s, k, v) { try { return s ? (s.setItem(k, String(v)), true) : false; } catch (e) { return false; } }; if (typeof safeStoreRemove !== \'function\') globalThis.safeStoreRemove = function (s, k) { try { return s ? (s.removeItem(k), true) : false; } catch (e) { return false; } };', ctx);
vm.runInContext(sliceConst(appJs, 'PIN_PROMPT_MESSAGES'), ctx);
const MSG = vm.runInContext('PIN_PROMPT_MESSAGES', ctx);
const keys = Object.keys(MSG);

ok('មានសារយ៉ាងតិច ៦ ប្រភេទ (មួយក្នុងមួយប៊ូតុង)', keys.length >= 6, keys);

const verifyTexts = keys.map((k) => MSG[k].verify);
ok('គ្មានប៊ូតុងណាចែករំលែកសារ «ផ្ទៀងផ្ទាត់» ដូចគ្នា',
    new Set(verifyTexts).size === verifyTexts.length, verifyTexts);
const setupTexts = keys.map((k) => MSG[k].setup);
ok('គ្មានប៊ូតុងណាចែករំលែកសារ «កំណត់ PIN» ដូចគ្នា',
    new Set(setupTexts).size === setupTexts.length, setupTexts);
ok('គ្រប់ធាតុមានទាំង verify និង setup',
    keys.every((k) => typeof MSG[k].verify === 'string' && MSG[k].verify.trim() &&
                      typeof MSG[k].setup === 'string' && MSG[k].setup.trim()));

const jsCalls = callArgs(appJs, 'requestPinBeforeConfig')
    .filter((c) => !/function\s+$/.test(appJs.slice(Math.max(0, c.offset - 12), c.offset)));
const htmlCalls = callArgs(html, 'requestPinBeforeConfig');
const callSites = jsCalls.concat(htmlCalls);

ok('រកឃើញកន្លែងហៅ requestPinBeforeConfig យ៉ាងតិច ៦', callSites.length >= 6, callSites.length);

const usedKeys = new Set();
callSites.forEach((c) => {
    const raw = c.args[1];
    const lit = raw && /^'([^']+)'$/.exec(raw);
    ok('កន្លែងហៅ @' + c.offset + ' បញ្ជូនឈ្មោះសកម្មភាព', !!lit, raw);
    if (lit) {
        ok('ឈ្មោះ "' + lit[1] + '" មានក្នុង PIN_PROMPT_MESSAGES', keys.indexOf(lit[1]) !== -1);
        usedKeys.add(lit[1]);
    }
});

// ⛔ ចន្លោះដែលវាស់បាន (2.31.10) ៖ សារពិពណ៌នា **អ្វីដែលនឹងកើតក្រោយវាយ PIN**
// ➜ ឈ្មោះសារតែមួយដែលចែករំលែកដោយ **សកម្មភាពគោលដៅ ២ ផ្សេងគ្នា** មានន័យថា
// យ៉ាងហោចណាស់ម្ខាងអានសារខុស។ វាស់បាន ៖ `lookupApi` ធ្លាប់បម្រើគោលដៅ ៣
// (បើកប្រអប់កំណត់ API · ដោះសោការស្កេន · ពិនិត្យស្ថានភាព ZTO) ➜ ការស្កេន
// បង្ហាញ toast «ដោះសោការស្វែងរក» រួចប្រអប់រាយ «ដើម្បី**កំណត់** API» —
// អ្នកប្រើដែលមិនចង់កំណត់អ្វី បោះបង់ចោល ➜ មុខងារស្លាប់ដោយសារកុហក។
const keyTargets = new Map();
callSites.forEach((c) => {
    const lit = /^'([^']+)'$/.exec(c.args[1] || '');
    if (!lit) return;
    const target = String(c.args[0] || '').trim() || 'null';
    const normalized = (target === 'null' || target === 'undefined') ? 'openConfigModal' : target;
    if (!keyTargets.has(lit[1])) keyTargets.set(lit[1], new Set());
    keyTargets.get(lit[1]).add(normalized);
});
const sharedKeys = Array.from(keyTargets.entries())
    .filter(([, targets]) => targets.size > 1)
    .map(([key, targets]) => key + ' ➜ ' + Array.from(targets).join(' | '));
ok('⛔ ឈ្មោះសារនីមួយៗបម្រើ **សកម្មភាពគោលដៅតែមួយ** (សារត្រូវនិយាយការពិត)',
    sharedKeys.length === 0, sharedKeys);
ok('លក្ខខណ្ឌចាំបាច់ ៖ ស្រង់សកម្មភាពគោលដៅចេញពីកន្លែងហៅបានពិត',
    keyTargets.size >= 6 && Array.from(keyTargets.values()).every((t) => t.size >= 1), keyTargets.size);

const drawerKeys = htmlCalls.map((c) => (/^'([^']+)'$/.exec(c.args[1] || '') || [])[1]);
ok('ប៊ូតុងក្នុងរបា Slide នីមួយៗប្រើឈ្មោះរបស់ខ្លួន (គ្មានពីរចែករំលែក)',
    drawerKeys.every(Boolean) && new Set(drawerKeys).size === drawerKeys.length, drawerKeys);

ok('គ្រប់ឈ្មោះក្នុង PIN_PROMPT_MESSAGES ត្រូវបានប្រើពិត (គ្មានសារស្លាប់)',
    keys.every((k) => usedKeys.has(k)), keys.filter((k) => !usedKeys.has(k)));

console.log('\n=== applyPinPromptText សរសេរអត្ថបទពិតចូលអេក្រង់ ===');
{
    // ⛔ ZoeW ជា React ៖ អត្ថបទប្រអប់ PIN ជា `viewState.pinPromptVerifyText` / `pinPromptSetupText` ដែល
    //    JSX គូរ (`app-lock-test` អាន `#pinModalDesc` ក្នុង browser ពិត) ➜ `desc` · `setupDesc` ជាកញ្ចក់អានពីឃ្លាំងពិត
    const readView = (k) => vm.runInContext('viewState.' + k, c2);
    const desc = { get textContent() { return readView('pinPromptVerifyText'); },
        set textContent(v) { vm.runInContext('viewState.pinPromptVerifyText = ' + JSON.stringify(v), c2); } };
    const setupDesc = { get textContent() { return readView('pinPromptSetupText'); },
        set textContent(v) { vm.runInContext('viewState.pinPromptSetupText = ' + JSON.stringify(v), c2); } };
    const pinIn = { value: 'x' };
    const stored = {};
    const sandbox = {
        console, queueMicrotask,
        openConfigModal() { stored.opened = 'config'; },
        openModalHelper(id) { stored.modal = id; },
        localStorage: {
            getItem: (k) => (k in stored.ls ? stored.ls[k] : null),
            setItem: (k, v) => { stored.ls[k] = v; }
        },
        document: {
            getElementById: (id) => {
                if (id === 'securityPinInput') return pinIn;
                return null;
            }
        }
    };
    stored.ls = {};
    sandbox.window = sandbox;
    const c2 = vm.createContext(sandbox);
    vm.runInContext(reactRuntime(appJs, { context: sandbox }), c2);
    vm.runInContext('if (typeof appLocalStore === \'undefined\') globalThis.appLocalStore = (typeof localStorage !== \'undefined\' ? localStorage : null); if (typeof appSessionStore === \'undefined\') globalThis.appSessionStore = (typeof sessionStorage !== \'undefined\' ? sessionStorage : null); if (typeof safeStoreGet !== \'function\') globalThis.safeStoreGet = function (s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }; if (typeof safeStoreSet !== \'function\') globalThis.safeStoreSet = function (s, k, v) { try { return s ? (s.setItem(k, String(v)), true) : false; } catch (e) { return false; } }; if (typeof safeStoreRemove !== \'function\') globalThis.safeStoreRemove = function (s, k) { try { return s ? (s.removeItem(k), true) : false; } catch (e) { return false; } };', c2);
    vm.runInContext('let pinTargetAction = null;', c2);
    // ⛔ UI-7 ៖ focus វាល PIN តែលើកុំព្យូទ័រ ➜ sandbox នេះជាទូរស័ព្ទ (ការវាស់ focus ៖ `layout-check` ប្រអប់ PIN ក្នុង browser ពិត)
    vm.runInContext("if (typeof isMobileDevice !== 'function') globalThis.isMobileDevice = function () { return true; }; if (typeof focusField !== 'function') globalThis.focusField = function () {};", c2);
    vm.runInContext(`
        let __biometricEnabled = false;
        function isBiometricEnabled() { return __biometricEnabled; }
        function refreshBiometricUi() { __log_biometricUi = (__log_biometricUi || 0) + 1; }
        function runBiometricUnlock() { __log_biometricTried = (__log_biometricTried || 0) + 1; }
        var __log_biometricUi = 0;
        var __log_biometricTried = 0;
    `, c2);
    vm.runInContext(sliceConst(appJs, 'PIN_PROMPT_MESSAGES'), c2);
    vm.runInContext(sliceFn(appJs, 'applyPinPromptText'), c2);
    vm.runInContext(sliceFn(appJs, 'requestPinBeforeConfig'), c2);

    stored.ls['zoew_security_pin_hash'] = 'pbkdf2:whatever';
    keys.forEach((k) => {
        desc.textContent = '';
        setupDesc.textContent = '';
        sandbox.requestPinBeforeConfig(null, k);
        ok('"' + k + '" ➜ ប្រអប់ផ្ទៀងផ្ទាត់បង្ហាញសាររបស់វា', desc.textContent === MSG[k].verify, desc.textContent);
        ok('"' + k + '" ➜ ប្រអប់កំណត់ PIN បង្ហាញសាររបស់វា', setupDesc.textContent === MSG[k].setup, setupDesc.textContent);
    });

    desc.textContent = '';
    sandbox.requestPinBeforeConfig(null, 'ឈ្មោះមិនស្គាល់');
    ok('ឈ្មោះមិនស្គាល់ ➜ ត្រឡប់ទៅសារ config ជាមូលដ្ឋាន', desc.textContent === MSG.config.verify, desc.textContent);

    desc.textContent = '';
    sandbox.requestPinBeforeConfig(null);
    ok('គ្មានឈ្មោះ ➜ ត្រឡប់ទៅសារ config ជាមូលដ្ឋាន', desc.textContent === MSG.config.verify, desc.textContent);

    stored.ls = {};
    setupDesc.textContent = '';
    stored.modal = '';
    sandbox.requestPinBeforeConfig(null, 'clearHistory');
    ok('គ្មាន PIN ទុកមុន ➜ បើកប្រអប់កំណត់ PIN ជាមួយសាររបស់សកម្មភាពនោះ',
        stored.modal === 'pinSetupModal' && setupDesc.textContent === MSG.clearHistory.setup,
        [stored.modal, setupDesc.textContent]);

    stored.ls['zoew_security_pin_hash'] = 'pbkdf2:whatever';
    vm.runInContext('__biometricEnabled = false; __log_biometricTried = 0;', c2);
    sandbox.requestPinBeforeConfig(null, 'config');
    ok('ជីវមាត្របិទ ➜ មិនសាកស្កេនទេ', vm.runInContext('__log_biometricTried', c2) === 0);
    vm.runInContext('__biometricEnabled = true; __log_biometricTried = 0;', c2);
    sandbox.requestPinBeforeConfig(null, 'config');
    ok('ជីវមាត្របើក ➜ សាកស្កេនភ្លាមពេលបើកប្រអប់ PIN', vm.runInContext('__log_biometricTried', c2) === 1);
    pinIn.value = '1234';
    sandbox.requestPinBeforeConfig(null, 'config');
    ok('បើកប្រអប់ PIN ➜ សម្អាតវាលដែលវាយពីមុន', pinIn.value === '', pinIn.value);
}

console.log('\n=== ⛔ សកម្មភាពដែលរត់ក្រោយ PIN មិនអាចហៅដោយផ្ទាល់ពីប៊ូតុង (រំលង PIN) ===');
// ⛔ សំណើម្ចាស់គម្រោង ៖ «តេស្តប្រព័ន្ធសុវត្ថិភាព ក្រែងអាច bypass ឬរំលង modal pin code»។ ប៊ូតុងក្នុង App ហៅសកម្មភាពតាមឈ្មោះ ៖
//    `onAct("x")`/`act("x")` ➜ `ACTION_REGISTRY` · `data-act` ➜ `ACTION_ALLOWLIST` ➜ ឈ្មោះណាដែលនៅក្នុងបញ្ជីទាំងនោះ ប៊ូតុងណាក៏ហៅបាន។
//    គោលដៅដែល `requestPinBeforeConfig(target, …)` រត់ក្រោយ PIN ត្រឹមត្រូវ (និង `openConfigModal` ៖ គោលដៅលំនាំដើមពេល target = null)
//    ត្រូវ **មិននៅក្នុងបញ្ជីទាំងពីរ** — លើកលែងតែវាពិនិត្យខ្លួនឯង (ហៅ `requestPinBeforeConfig(ខ្លួនឯង, …)` ពេលសោនៅជាប់ ៖ ZTO) ។
//    ដេរីវេពីកូដពិតទាំងសងខាង ៖ គោលដៅពីកន្លែងហៅពិត · បញ្ជីពីកូដ ship ។
{
    const regAt = appJs.indexOf('const ACTION_REGISTRY = Object.freeze({');
    const regNames = [];
    if (regAt !== -1) {
        const open = appJs.indexOf('{', regAt);
        const close = matchBrace(appJs, open, '{', '}');
        appJs.slice(open + 1, close).split(',').forEach((part) => {
            const m = /^\s*([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(part);
            if (m) regNames.push(m[1]);
        });
    }
    const allowAt = appJs.indexOf('const ACTION_ALLOWLIST = [');
    const allowNames = [];
    if (allowAt !== -1) {
        const open = appJs.indexOf('[', allowAt);
        const close = matchBrace(appJs, open, '[', ']');
        const re = /["']([A-Za-z_$][\w$]*)["']/g;
        let m;
        const body = appJs.slice(open + 1, close);
        while ((m = re.exec(body))) allowNames.push(m[1]);
    }
    const reachable = new Set(regNames.concat(allowNames));
    ok('ជាន់អប្បបរមា ៖ ឈ្មោះសកម្មភាពដែលប៊ូតុងហៅបាន (ACTION_REGISTRY ∪ ACTION_ALLOWLIST) ≥ ១០០', reachable.size >= 100, reachable.size);
    const targets = new Set(['openConfigModal']);
    callSites.forEach((c) => {
        const t = String(c.args[0] || '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(t) && t !== 'null' && t !== 'undefined' && t !== 'targetAction') targets.add(t);
    });
    ok('ជាន់អប្បបរមា ៖ គោលដៅក្រោយ PIN ដែលមានឈ្មោះ ≥ ១០', targets.size >= 10, Array.from(targets));
    const exposed = [];
    const selfGated = [];
    targets.forEach((t) => {
        if (!reachable.has(t)) return;
        let body = '';
        try { body = sliceFn(appJs, t); } catch (e) { body = ''; }
        if (new RegExp('requestPinBeforeConfig\\(\\s*' + t.replace(/\$/g, '\\$') + '\\s*,').test(body)) selfGated.push(t);
        else exposed.push(t);
    });
    ok('⛔ គ្មានគោលដៅក្រោយ PIN ណាដែលប៊ូតុងហៅដោយផ្ទាល់បាន ដោយមិនពិនិត្យ PIN ខ្លួនឯង', exposed.length === 0, { exposed, selfGated });
    const pinFns = ['verifySecurityPin', 'saveNewSecurityPin', 'cancelPinEntryFlow', 'cancelPinSetupFlow'];
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ប៊ូតុងរបស់ប្រអប់ PIN ខ្លួនឯងនៅក្នុងបញ្ជី (ការស្រង់បញ្ជីពិត)', pinFns.every((n) => reachable.has(n)), pinFns.filter((n) => !reachable.has(n)));
    const saveBody = (() => { try { return sliceFn(appJs, 'saveNewSecurityPin'); } catch (e) { return ''; } })();
    const setupOpeners = callArgs(appJs, 'openModalHelper').filter((c) => c.args[0] === "'pinSetupModal'");
    const guarded = setupOpeners.every((c) => {
        const fnStart = appJs.lastIndexOf('function ', c.offset);
        const fnBody = appJs.slice(fnStart, c.offset);
        return /zoew_security_pin_hash/.test(fnBody) && /if \(!savedPin\)/.test(fnBody);
    });
    ok('⛔ ប្រអប់កំណត់ PIN ថ្មីបើកតែពេលគ្មាន PIN ទុក (មិនអាចសរសេរជាន់ PIN ចាស់ដោយមិនស្គាល់វា)', setupOpeners.length >= 2 && guarded, setupOpeners.length);
    ok('លក្ខខណ្ឌចាំបាច់ ៖ saveNewSecurityPin រត់គោលដៅក្រោយកំណត់ PIN (ផ្លូវតែមួយដែលត្រូវការប្រអប់កំណត់)', /pinTargetAction/.test(saveBody));
}

console.log('\n' + (fail === 0 ? '✅ ជោគជ័យ ' + pass : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
process.exit(fail === 0 ? 0 : 1);
