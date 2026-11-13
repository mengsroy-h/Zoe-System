const { modulePrograms } = require('./audit-module-ast');
const acorn = require('acorn');
const fs = require('fs');
const path = require('path');
// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.DOMHYG_APP_DIR ? path.resolve(process.env.DOMHYG_APP_DIR) : path.resolve(__dirname, '../..');

// ids that hold no customer data, or that a documented path already clears.
// Add here only with a reason — an unexplained entry hides the next real leak.
const ACCEPTED = {
    firebaseConfigInput: 'Firebase client config is deliberately not a secret in this project',
    configInput: 'alternate id kept for the config textarea',
    customerDataTableStatus: 'clearCustomerDataTableCache() blanks it on the sign-out branch',
    customerDataTableBody: 'clearCustomerDataTableCache() blanks it on the sign-out branch',
    exchangeRateInput: 'exchange rate, not customer data',
    activationModalMsg: 'status text only',
    exportFilterLabel: 'filter name only, no rows',
    loginEmailInput: 'remembered email, prefilled on purpose',
    loginError: 'error text only',
    loginBtn: 'button label',
    pinBiometricBtn: 'button label + hidden/shown flag — no customer data',
    biometricToggleState: 'បើក/បិទ/មិនគាំទ្រ label for the device biometric setting — no customer data',
    pinModalMsg: 'status text only',
    pinModalDesc: 'prompt sentence picked from the hard-coded PIN_PROMPT_MESSAGES table — never customer data',
    pinSetupModalDesc: 'prompt sentence picked from the hard-coded PIN_PROMPT_MESSAGES table — never customer data',
    lockerPrefixInput: 'locker naming config, not customer data',
    lockerCountInput: 'locker naming config, not customer data',
    locationWarningTitle: "static heading, no customer data",
    locationWarningText: "blanked by clearSensitiveModalFields()",
    newPrivateKeyOutput: "closeModal('keypairModal') wipes it on every dismiss path",
    newPublicKeyOutput: 'public half of the keypair, not a secret',
    setupLinkUrlInput: 'Base URL of the target site, deliberately remembered in localStorage',
    firebaseStatusText: 'connection status label',
    navAuthBtn: 'auth button label',
    logoutBtn: 'button label',
    kgNextBtn: 'ZoeKeyGen ៖ ស្លាកប៊ូតុង «ជំហានបន្ទាប់» (អត្ថបទថេរ · គ្មានទិន្នន័យអ្នកប្រើ)',
    btnFilterAll: 'filter button label',
    selectedFilterTitle: 'filter name only',
    zoomSlider: 'camera zoom value',
    activeLockerLabel: 'locker name the worker chose, not customer data',
    listLockerFilter: 'locker filter <option> list',
    count: 'row count',
    historyTableBody: 'renderHistory([]) replaces it with the empty-state row on logout',
    listTableBody: 'detachDatabaseListeners() clears historyData, then renderList() repaints empty',
    activationSubmitBtn: 'button label only ("កំពុងពិនិត្យ...") — no customer data',
    appLockBiometricBtn: 'button label + hidden/shown flag on the app-lock screen — no customer data',
    appLockToggleState: 'បើក / ត្រូវកំណត់ PIN label for the app-lock drawer row — no customer data',
    ztoAutoCloseState: 'បើក / បិទ label for the ZTO auto-close drawer row — no customer data',
    ztoListSyncState: 'បើក / បិទ label for the ZTO list-sync drawer row — no customer data'
};

function walk(n, cb) {
    if (!n || typeof n.type !== 'string') return;
    cb(n);
    for (const k of Object.keys(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach((c) => walk(c, cb));
        else if (v && typeof v.type === 'string') walk(v, cb);
    }
}

let totalGaps = 0;
// ⚠️ App `ZoeImport` ត្រូវលុបចេញពី repo ក្នុងកំណែ 2.21.0 — មុខងារនាំចូល
// របស់វាផ្លាស់ចូល **ZoeW ផ្ទាល់**។ ដូច្នេះ **ពាក្យសម្ងាត់នាំចូល**
// (`sheetImportPassword`) និង **កូនសោ AES** (`sheetImportKey`) ព្រមទាំងវាល
// `siApiPasswordInput` ក្នុង DOM ឥឡូវរស់នៅក្នុង `ZoeW/app.js` ➜ ការស្កេន
// ZoeW គ្របពួកវារួចហើយ។ ⛔ កុំបន្ថយវិសាលភាពនៃឯកសារដែលស្កេន — នោះជាថ្នាក់
// «checker ស្កេនឯកសារណាខ្លះ» ដដែលនឹង 2.12.1 · 2.16.0 · 2.19.1។
for (const app of ['ZoeW', 'ZoeKeyGen']) {
    const src = fs.readFileSync(root + '/' + app + '/app.js', 'utf8');
    const programs = modulePrograms(src, path.join(root, app, 'app.js'), { ecmaVersion: 2022, sourceType: 'script' });

    // ids that get written with data at runtime
    const written = new Map();

    // Resolve `const x = document.getElementById('id')` with real lexical scoping.
    // A single global name->id map silently keeps only the LAST binding, and this codebase
    // reuses generic names heavily (`tbody`, `container`, `el`, `btn`, `input`) — that blind
    // spot hid a real leak (`deletedTableBody`) for twelve audit rounds. Keep the scoping.
    const FN_TYPES = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'];

    // walk a subtree WITHOUT descending into nested functions
    function walkOwn(root, cb) {
        (function rec(n, isRoot) {
            if (!n || typeof n.type !== 'string') return;
            if (!isRoot && FN_TYPES.includes(n.type)) return;
            cb(n);
            for (const k of Object.keys(n)) {
                const v = n[k];
                if (Array.isArray(v)) v.forEach((c) => rec(c, false));
                else if (v && typeof v.type === 'string') rec(v, false);
            }
        })(root, true);
    }

    function directChildFunctions(root) {
        const out = [];
        (function rec(n, isRoot) {
            if (!n || typeof n.type !== 'string') return;
            if (!isRoot && FN_TYPES.includes(n.type)) { out.push(n); return; }
            for (const k of Object.keys(n)) {
                const v = n[k];
                if (Array.isArray(v)) v.forEach((c) => rec(c, false));
                else if (v && typeof v.type === 'string') rec(v, false);
            }
        })(root, true);
        return out;
    }

    const scopes = [];
    programs.forEach(ast => (function build(node, parent) {
        const scope = { node: node, parent: parent, bind: new Map() };
        scopes.push(scope);
        walkOwn(node, (n) => {
            if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init &&
                n.init.type === 'CallExpression' && n.init.callee.type === 'MemberExpression' &&
                n.init.callee.property.name === 'getElementById' &&
                n.init.arguments[0] && n.init.arguments[0].type === 'Literal') {
                if (!scope.bind.has(n.id.name)) scope.bind.set(n.id.name, new Set());
                scope.bind.get(n.id.name).add(n.init.arguments[0].value);
            }
        });
        directChildFunctions(node).forEach((c) => build(c, scope));
    })(ast, null));

    for (const scope of scopes) {
        walkOwn(scope.node, (n) => {
            if (n.type !== 'AssignmentExpression' || n.left.type !== 'MemberExpression') return;
            const prop = n.left.property && n.left.property.name;
            if (!['value', 'innerText', 'textContent', 'innerHTML'].includes(prop)) return;
            // skip constant assignments (literals) — those aren't leaked data
            if (n.right.type === 'Literal') return;
            const obj = n.left.object;
            const ids = [];
            if (obj.type === 'Identifier') {
                let s = scope;
                while (s) {
                    if (s.bind.has(obj.name)) { ids.push(...s.bind.get(obj.name)); break; }
                    s = s.parent;
                }
            } else if (obj.type === 'CallExpression' && obj.callee.type === 'MemberExpression' &&
                     obj.callee.property.name === 'getElementById' && obj.arguments[0] &&
                     obj.arguments[0].type === 'Literal') {
                ids.push(obj.arguments[0].value);
            }
            if (!ids.length) return;
            const line = src.slice(0, n.start).split('\n').length;
            for (const id of ids) {
                if (!written.has(id) || written.get(id) > line) written.set(id, line);
            }
        });
    }

    // what clearSensitiveModalFields / showLoginModalWithPrefill actually blanks
    const cleared = new Set();
    const clearFns = ['clearSensitiveModalFields', 'clearLookupStatus', 'showLoginModalWithPrefill', 'clearGeneratedKeyResult'];
    // ⛔ helper សម្អាតរបស់មុខងារមួយ (ឧ. `sbAdminReset()` ក្នុង ZoeKeyGen) រាប់ **តែពេល** ផ្លូវចាកចេញ (`showLoginModalWithPrefill`) ហៅវាពិត
    const REACHABLE_CLEAR_FNS = ['sbAdminReset'];
    const bodyOf = (fn) => {
        const i = src.indexOf('function ' + fn + '(');
        if (i === -1) return '';
        let d = 0, j = src.indexOf('{', i), started = false, end = j;
        for (; j < src.length; j++) {
            if (src[j] === '{') { d++; started = true; }
            else if (src[j] === '}') { d--; if (started && d === 0) { end = j; break; } }
        }
        return src.slice(i, end);
    };
    const logoutBody = bodyOf('showLoginModalWithPrefill');
    for (const fn of REACHABLE_CLEAR_FNS) {
        if (new RegExp('\\b' + fn + '\\(').test(logoutBody)) clearFns.push(fn);
    }
    for (const fn of clearFns) {
        const body = bodyOf(fn);
        for (const m of body.matchAll(/'([A-Za-z][\w-]*)'/g)) cleared.add(m[1]);
    }

    if (app === 'ZoeKeyGen') {
        const functions = new Map(programs.flatMap(program => program.body)
            .filter(node => node.type === 'FunctionDeclaration').map(node => [node.id.name, node]));
        const callsDirectly = (caller, callee) => {
            for (const statement of functions.get(caller)?.body.body || []) {
                if (['ReturnStatement', 'ThrowStatement'].includes(statement.type)) break;
                const call = statement.type === 'ExpressionStatement' && statement.expression;
                if (call?.type === 'CallExpression' && call.callee.type === 'Identifier' && call.callee.name === callee) return true;
            }
            return false;
        };
        if (callsDirectly('showLoginModalWithPrefill', 'invalidateSensitiveSession') &&
            callsDirectly('invalidateSensitiveSession', 'clearSecureKeySetup')) {
            for (const statement of functions.get('clearSecureKeySetup')?.body.body || []) {
                if (['ReturnStatement', 'ThrowStatement'].includes(statement.type)) break;
                const call = statement.type === 'ExpressionStatement' && statement.expression;
                if (call?.type !== 'CallExpression' || call.callee.type !== 'MemberExpression' ||
                    call.callee.computed || call.callee.property.name !== 'forEach' || call.callee.object.type !== 'ArrayExpression') continue;
                const callback = call.arguments[0];
                if (!callback || !['ArrowFunctionExpression', 'FunctionExpression'].includes(callback.type) ||
                    callback.params[0]?.type !== 'Identifier' || callback.body.type !== 'BlockStatement' || callback.body.body.length !== 2) continue;
                const [declaration, guard] = callback.body.body;
                const binding = declaration?.type === 'VariableDeclaration' && declaration.declarations.length === 1 && declaration.declarations[0];
                const select = binding?.init;
                if (binding?.id?.type !== 'Identifier' || select?.type !== 'CallExpression' ||
                    select.callee.type !== 'MemberExpression' || select.callee.object.name !== 'document' ||
                    select.callee.computed || select.callee.property.name !== 'getElementById' ||
                    select.arguments[0]?.type !== 'Identifier' || select.arguments[0].name !== callback.params[0].name ||
                    guard?.type !== 'IfStatement' || guard.test.type !== 'Identifier' || guard.test.name !== binding.id.name ||
                    guard.alternate || guard.consequent.type !== 'ExpressionStatement') continue;
                const blank = guard.consequent.expression;
                if (blank.type !== 'AssignmentExpression' || blank.operator !== '=' || blank.left.type !== 'MemberExpression' ||
                    blank.left.object.type !== 'Identifier' || blank.left.object.name !== binding.id.name || blank.left.computed ||
                    !['value', 'innerText', 'textContent', 'innerHTML'].includes(blank.left.property.name) ||
                    blank.right.type !== 'Literal' || blank.right.value !== '') continue;
                for (const id of call.callee.object.elements) {
                    if (id?.type === 'Literal' && typeof id.value === 'string') cleared.add(id.value);
                }
            }
        }
    }

    const gaps = [...written.entries()]
        .filter(([id]) => !cleared.has(id) && !ACCEPTED[id])
        .sort((a, b) => a[1] - b[1]);
    totalGaps += gaps.length;
    console.log('--- ' + app + ' --- ids written with data but never blanked on logout: ' + gaps.length);
    gaps.forEach(([id, line]) => console.log('    ⚠ ' + id + '   (first written at app.js:' + line + ')'));
}
console.log(totalGaps === 0
    ? '\n✅ គ្មានវាលដែលនៅសល់ទិន្នន័យក្នុង DOM ក្រោយចាកចេញទេ'
    : '\n❌ ' + totalGaps + ' វាល');
process.exit(totalGaps === 0 ? 0 : 1);
