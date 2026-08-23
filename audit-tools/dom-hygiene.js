const acorn = require('acorn');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// ids that hold no customer data, or that a documented path already clears.
// Add here only with a reason — an unexplained entry hides the next real leak.
const ACCEPTED = {
    firebaseConfigInput: 'Firebase client config is deliberately not a secret in this project',
    configInput: 'alternate id kept for the config textarea',
    sentryDsnInput: 'Sentry DSN is a write-only ingest key, shipped in the client anyway',
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
    btnFilterAll: 'filter button label',
    selectedFilterTitle: 'filter name only',
    zoomSlider: 'camera zoom value',
    activeLockerLabel: 'locker name the worker chose, not customer data',
    listLockerFilter: 'locker filter <option> list',
    count: 'row count',
    historyTableBody: 'renderHistory([]) replaces it with the empty-state row on logout',
    listTableBody: 'detachDatabaseListeners() clears historyData, then renderList() repaints empty',
    activationSubmitBtn: 'button label only ("កំពុងពិនិត្យ...") — no customer data'
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
for (const app of ['ZoeW', 'ZoeKeyGen']) {
    const src = fs.readFileSync(root + '/' + app + '/app.js', 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });

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
    (function build(node, parent) {
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
    })(ast, null);

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
    const clearFns = ['clearSensitiveModalFields', 'showLoginModalWithPrefill', 'clearGeneratedKeyResult'];
    for (const fn of clearFns) {
        const i = src.indexOf('function ' + fn + '(');
        if (i === -1) continue;
        let d = 0, j = src.indexOf('{', i), started = false, end = j;
        for (; j < src.length; j++) {
            if (src[j] === '{') { d++; started = true; }
            else if (src[j] === '}') { d--; if (started && d === 0) { end = j; break; } }
        }
        const body = src.slice(i, end);
        for (const m of body.matchAll(/'([A-Za-z][\w-]*)'/g)) cleared.add(m[1]);
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
