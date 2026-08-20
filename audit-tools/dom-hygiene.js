const acorn = require('acorn');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// ids that hold no customer data, or that a documented path already clears.
// Add here only with a reason — an unexplained entry hides the next real leak.
const ACCEPTED = {
    firebaseConfigInput: 'Firebase client config is deliberately not a secret in this project',
    configInput: 'same, Zoescan name for it',
    sentryDsnInput: 'Sentry DSN is a write-only ingest key, shipped in the client anyway',
    customerDataTableStatus: 'clearCustomerDataTableCache() blanks it on the sign-out branch',
    customerDataTableBody: 'clearCustomerDataTableCache() blanks it on the sign-out branch',
    exchangeRateInput: 'exchange rate, not customer data',
    activationModalMsg: 'status text only',
    toast: 'transient status text',
    exportFilterLabel: 'filter name only, no rows',
    loginEmailInput: 'remembered email, prefilled on purpose',
    loginError: 'error text only',
    loginBtn: 'button label',
    pinModalMsg: 'status text only',
    lockerPrefixInput: 'locker naming config, not customer data',
    lockerCountInput: 'locker naming config, not customer data',
    locationWarningTitle: "Zoescan blanks it in onAuthStateChanged's sign-out branch",
    locationWarningText: "Zoescan blanks it in onAuthStateChanged's sign-out branch",
    newPrivateKeyOutput: "closeModal('keypairModal') wipes it on every dismiss path",
    newPublicKeyOutput: 'public half of the keypair, not a secret'
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
for (const app of ['ZoeAdmin', 'ZoeW', 'Zoescan', 'ZoeKeyGen']) {
    const src = fs.readFileSync(root + '/' + app + '/app.js', 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });

    // ids that get written with data at runtime
    const written = new Map();
    // map: variable name -> id, from `const x = document.getElementById('id')`
    const varToId = new Map();
    walk(ast, (n) => {
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init &&
            n.init.type === 'CallExpression' && n.init.callee.type === 'MemberExpression' &&
            n.init.callee.property.name === 'getElementById' &&
            n.init.arguments[0] && n.init.arguments[0].type === 'Literal') {
            varToId.set(n.id.name, n.init.arguments[0].value);
        }
    });
    walk(ast, (n) => {
        if (n.type !== 'AssignmentExpression' || n.left.type !== 'MemberExpression') return;
        const prop = n.left.property && n.left.property.name;
        if (!['value', 'innerText', 'textContent', 'innerHTML'].includes(prop)) return;
        // skip constant assignments (literals) — those aren't leaked data
        if (n.right.type === 'Literal') return;
        const obj = n.left.object;
        let id = null;
        if (obj.type === 'Identifier') id = varToId.get(obj.name) || null;
        else if (obj.type === 'CallExpression' && obj.callee.type === 'MemberExpression' &&
                 obj.callee.property.name === 'getElementById' && obj.arguments[0] &&
                 obj.arguments[0].type === 'Literal') id = obj.arguments[0].value;
        if (!id) return;
        const line = src.slice(0, n.start).split('\n').length;
        if (!written.has(id)) written.set(id, line);
    });

    // what clearSensitiveModalFields / showLoginModalWithPrefill actually blanks
    const cleared = new Set();
    const clearFns = ['clearSensitiveModalFields', 'showLoginModalWithPrefill'];
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

    // ids the app itself declares as sensitive-ish: anything in a .modal or a result box
    const html = fs.readFileSync(root + '/' + app + '/index.html', 'utf8');
    const inModal = new Set();
    for (const m of html.matchAll(/<div[^>]*class="[^"]*\bmodal\b[^"]*"[^>]*>/g)) {
        const start = m.index;
        const chunk = html.slice(start, start + 6000);
        for (const idm of chunk.matchAll(/\bid="([^"]+)"/g)) inModal.add(idm[1]);
    }

    const gaps = [...written.entries()]
        .filter(([id]) => inModal.has(id) && !cleared.has(id) && !ACCEPTED[id])
        .sort((a, b) => a[1] - b[1]);
    totalGaps += gaps.length;
    console.log('--- ' + app + ' --- modal ids written with data but never blanked on logout: ' + gaps.length);
    gaps.forEach(([id, line]) => console.log('    ⚠ ' + id + '   (first written at app.js:' + line + ')'));
}
console.log(totalGaps === 0
    ? '\n✅ គ្មានវាលដែលនៅសល់ទិន្នន័យក្នុង DOM ក្រោយចាកចេញទេ'
    : '\n❌ ' + totalGaps + ' វាល');
process.exit(totalGaps === 0 ? 0 : 1);
