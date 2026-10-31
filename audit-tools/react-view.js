// ⛔ ម៉ូឌុលរួម (មិនមែន checker) ៖ ស្រទាប់ React របស់ ZoeW សម្រាប់ checker ដែលស្រង់ function ចូល `vm`។
//
// ZoeW ជា React ➜ `app.js` ដែល checker អាន គឺជា **ទិដ្ឋភាពអត្ថបទ** ដែល `ZoeW/scripts/build-audit.mjs`
// សាងពីប្រភព TypeScript ពិត។ function អាជីវកម្មនៅដដែល តែការចូលប្រើ DOM ឆ្លងកាត់ helper តូចៗ ៖
//
//   - វាលបញ្ចូល ៖ `fieldValue('x')` ជំនួស `byId('x').value` (`src/app/refs.ts`)
//   - ប្រអប់ ៖ `openModalHelper()` ➜ `setModalDisplay()` (`src/core/modals.ts`)
//   - អត្ថបទ/ទង់ដែលអេក្រង់បង្ហាញ ៖ ឃ្លាំង `viewState` · `uiState` (`createStore`)
//
// checker ដែលស្រង់តែ function អាជីវកម្មធ្លាក់ `ReferenceError` លើ helper ទាំងនោះ។ ម៉ូឌុលនេះផ្គត់ផ្គង់
// **កូដពិត** របស់វាពីទិដ្ឋភាពដដែល (⛔ មិនមែនការក្លែង) ៖
//
//   - `sliceFunction(src, name)` ៖ តួ function កម្រិតកំពូល
//   - `reactRuntime(src, { exclude })` ៖ `createStore` · ឃ្លាំងទាំងអស់ (`const <ឃ្លាំង> = createStore(...)`) ·
//     helper DOM/ប្រអប់ (`REACT_HELPERS`) ➜ អត្ថបទមួយសម្រាប់ `vm.runInContext()`
//
// ⛔ ក្នុងទិដ្ឋភាព `elementOf(name)` ជា `document.getElementById(name)` ហើយស្ថានភាពប្រអប់ជា `style.display`
//    របស់ធាតុ (សមមូលដែល React គូរ — មើល `ZoeW/scripts/checker-view.mjs` ចំណុច ៦) ➜ DOM ក្លែងរបស់ checker
//    នៅតែជាអ្វីដែលត្រូវវាស់។
// ⛔ តម្លៃដំបូងរបស់វាលឃ្លាំងដែលមិនមែន literal (ឧ. អានពី storage · object ដែលមានឈ្មោះខាងក្នុង) ក្លាយជា
//    `undefined` (object/array literal ជាជាន់ៗនៅដដែល — `literalInit()`) ៖ វាលទាំងនោះជា state
//    ដើមដែលទិដ្ឋភាពប្រកាសជា `let` កម្រិតកំពូលរួចហើយ ហើយ checker ផ្គត់ផ្គង់វាក្នុង sandbox ផ្ទាល់ខ្លួន។
'use strict';

function appCodeLabel(root, app) {
    if (app === 'ZoeW' && require('fs').existsSync(require('path').join(root, app, 'audit-module-views.json'))) {
        return 'ZoeW/src/** ➜ app.js (ទិដ្ឋភាព build វាស់ក្នុង dist-audit មិនមែនប្រភព)';
    }
    return app + '/app.js (ប្រភព vanilla)';
}

function readAppCode(root, app = 'ZoeW') {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(root, app, 'app.js');
    if (app === 'ZoeW' && (fs.existsSync(path.join(root, app, 'src/main.tsx')) || !fs.existsSync(file))) {
        throw new Error('ZoeW/src/** ជាប្រភព React មិនមែន ZoeW/app.js ទេ។ checker ត្រូវការ app.js ដែល build បង្កើតក្នុង ZoeW/dist-audit/ZoeW។ ' +
            'រត់ `M=$(ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh | tail -1)` រួច `(cd "$M" && node audit-tools/<checker>.js)` ' +
            'ឬកំណត់ *_APP_DIR ទៅ measure-root។ ទីតាំងដែលបានជ្រើស៖ ' + path.resolve(root));
    }
    return fs.readFileSync(file, 'utf8');
}

// VM scan fixtures need the real persistent journal and scope boundary, including
// private module constants. Keep each dependency in its original lexical scope;
// refusing a mismatched view prevents a fixture from testing stale helper code.
function scanEvidenceRuntime(root, src) {
    const fs = require('fs');
    const path = require('path');
    const views = JSON.parse(fs.readFileSync(path.join(root, 'ZoeW', 'audit-module-views.json'), 'utf8'));
    const modules = ['src/core/storage.ts', 'src/core/shop-scope.ts', 'src/services/scan-evidence.ts', 'src/services/scan-pending.ts'];
    const parts = modules.map((name) => {
        const view = views[name];
        if (typeof view !== 'string' || !view.trim() || !src.includes(view)) {
            throw new Error('scanEvidenceRuntime: missing or mismatched actual module ' + name);
        }
        return view;
    });
    const names = ['createScanEvidenceJournal', 'pendingScanScope', 'preparePendingScan', 'pendingScanIsCurrent',
        'notePendingScan', 'releasePendingScan', 'finishPendingScan', 'settlePendingScanRelease', 'settlePendingScanClaim', 'warnPendingScans'];
    return 'const {' + names.join(',') + '} = (() => {\n' + parts.join('\n')
        + '\nreturn {' + names.join(',') + '};\n})();';
}

// Preserve private module state when a protocol grows beyond a few standalone
// functions. Fixtures must omit the returned names from their old extraction
// lists. Global accessors expose the same live sets/maps used by these functions,
// so lock and journal assertions cannot accidentally inspect a disconnected copy.
function moduleRuntime(root, src, modulePaths) {
    const fs = require('fs'), path = require('path'), acorn = require('acorn');
    const views = JSON.parse(fs.readFileSync(path.join(root, 'ZoeW', 'audit-module-views.json'), 'utf8'));
    const names = new Set(), functionNames = new Set(), variableNames = new Set();
    const parts = modulePaths.map((entry) => {
        const file = typeof entry === 'string' ? entry : entry?.path;
        const expose = typeof entry === 'string' ? null : entry?.expose;
        if (typeof file !== 'string' || !file || typeof entry !== 'string' &&
            (!Array.isArray(expose) || expose.some(name => typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name))
                || new Set(expose).size !== expose.length)) throw new Error('moduleRuntime: invalid expose descriptor');
        const view = views[file];
        if (typeof view !== 'string' || !view.trim() || !src.includes(view)) throw new Error('moduleRuntime: missing or mismatched actual module ' + file);
        const declarations = [];
        for (const node of acorn.parse(view, { ecmaVersion: 'latest' }).body) {
            if (node.type === 'FunctionDeclaration' && node.id) declarations.push({ name: node.id.name, kind: 'function' });
            if (node.type === 'VariableDeclaration') for (const item of node.declarations) {
                if (item.id.type !== 'Identifier') throw new Error('moduleRuntime: unsupported binding in ' + file);
                declarations.push({ name: item.id.name, kind: node.kind });
            }
        }
        if (expose && expose.some(name => !declarations.some(binding => binding.name === name)))
            throw new Error('moduleRuntime: missing exposed binding in ' + file);
        const descriptors = declarations.filter(({ name }) => !expose || expose.includes(name)).map(({ name, kind }) => {
            if (names.has(name)) throw new Error('moduleRuntime: duplicate module binding ' + name);
            names.add(name); (kind === 'function' ? functionNames : variableNames).add(name);
            return JSON.stringify(name) + ':{configurable:true,enumerable:true,get:()=> ' + name
                + (kind === 'const' ? '' : ',set:(value)=>{' + name + '=value;}') + '}';
        });
        return '(function(){\n' + view + '\nObject.defineProperties(globalThis,{' + descriptors.join(',') + '});\n})();';
    });
    const withoutBindings = (code) => {
        const replacements = [];
        for (const node of acorn.parse(code, { ecmaVersion: 'latest' }).body) {
            if (node.type === 'FunctionDeclaration' && node.id && names.has(node.id.name)) replacements.push([node.start, node.end, '']);
            if (node.type === 'VariableDeclaration') {
                const kept = node.declarations.filter((declaration) => {
                    if (declaration.id.type !== 'Identifier') throw new Error('moduleRuntime: unsupported fixture binding');
                    return !names.has(declaration.id.name);
                });
                if (kept.length !== node.declarations.length) replacements.push([node.start, node.end,
                    kept.length ? node.kind + ' ' + kept.map((declaration) => code.slice(declaration.start, declaration.end)).join(', ') + ';' : '']);
            }
        }
        let result = code;
        for (const [start, end, replacement] of replacements.reverse()) result = result.slice(0, start) + replacement + result.slice(end);
        return result;
    };
    return { code: parts.join('\n'), names, functionNames, variableNames, withoutBindings };
}

function memoryStorage(initial = {}) {
    const entries = new Map(Object.entries(initial).map(([key, value]) => [String(key), String(value)]));
    return {
        get length() { return entries.size; },
        key(index) { return [...entries.keys()][index] ?? null; },
        getItem(key) { return entries.get(String(key)) ?? null; },
        setItem(key, value) { entries.set(String(key), String(value)); },
        removeItem(key) { entries.delete(String(key)); },
        clear() { entries.clear(); }
    };
}

// ⛔ helper ដែលកូដមុខងារនាំចូលពីស្រទាប់ React (`src/app/refs.ts` · `src/core/modals.ts` · `src/core/view-state.ts` ·
//    `src/app/flush.ts` · `src/platform/document-io.ts`) — ពួកវាជា «ច្រកចេញ» ដែលជំនួសការប៉ះ DOM ផ្ទាល់របស់
//    `app.js` ដើម (`byId(x).value` · `el.style.display = …` · `document.createElement('canvas')` …)
function wrappedTransactionCallSites(sources) {
    const acorn = require('acorn');
    const sites = [];
    const namesOf = (node, out = []) => {
        if (!node) return out;
        if (node.type === 'Identifier') out.push(node.name);
        else if (node.type === 'RestElement') namesOf(node.argument, out);
        else if (node.type === 'AssignmentPattern') namesOf(node.left, out);
        else if (node.type === 'ArrayPattern') node.elements.forEach((value) => namesOf(value, out));
        else if (node.type === 'ObjectPattern') node.properties.forEach((value) => namesOf(value.type === 'RestElement' ? value.argument : value.value, out));
        return out;
    };
    const children = (node) => Object.values(node).flatMap((value) => Array.isArray(value)
        ? value.filter((item) => item && typeof item.type === 'string')
        : value && typeof value.type === 'string' ? [value] : []);
    const isFunction = (node) => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type);
    const key = (node) => node.computed ? node.property?.type === 'Literal' ? node.property.value : null : node.property?.name;
    const trusted = (node, scope) => node?.type === 'Identifier' ? scope.get(node.name)?.kind === true
        : node?.type === 'MemberExpression' && node.object.type === 'Identifier'
            && scope.get(node.object.name)?.kind === 'state' && key(node) === 'fb';
    const hoistVars = (node, scope) => {
        for (const child of children(node)) {
            if (isFunction(child) || child.type === 'ClassDeclaration' || child.type === 'ClassExpression') continue;
            if (child.type === 'VariableDeclaration' && child.kind === 'var') child.declarations.forEach((entry) => namesOf(entry.id).forEach((name) => scope.set(name, { kind: false })));
            hoistVars(child, scope);
        }
    };
    const visit = (node, scope, module) => {
        if (!node) return;
        if (isFunction(node)) {
            const inner = new Map(scope);
            if (node.id) inner.set(node.id.name, { kind: false });
            node.params.forEach((param) => namesOf(param).forEach((name) => inner.set(name, { kind: false })));
            hoistVars(node.body, inner);
            visit(node.body, inner, module);
            return;
        }
        if (node.type === 'Program' || node.type === 'BlockStatement' || node.type === 'StaticBlock') {
            const inner = new Map(scope);
            if (node.type === 'StaticBlock') hoistVars(node, inner);
            for (const entry of node.body) {
                if (entry.type === 'VariableDeclaration') entry.declarations.forEach((value) => namesOf(value.id).forEach((name) => inner.set(name, { kind: false })));
                if ((entry.type === 'FunctionDeclaration' || entry.type === 'ClassDeclaration') && entry.id) inner.set(entry.id.name, { kind: false });
            }
            node.body.forEach((entry) => visit(entry, inner, module));
            return;
        }
        if (node.type === 'SwitchStatement') {
            visit(node.discriminant, scope, module);
            const inner = new Map(scope);
            for (const entry of node.cases.flatMap(branch => branch.consequent)) {
                if (entry.type === 'VariableDeclaration') entry.declarations.forEach(value => namesOf(value.id).forEach(name => inner.set(name, { kind: false })));
                if ((entry.type === 'ClassDeclaration' || entry.type === 'FunctionDeclaration') && entry.id) inner.set(entry.id.name, { kind: false });
            }
            node.cases.forEach(branch => {
                visit(branch.test, inner, module);
                branch.consequent.forEach(entry => visit(entry, inner, module));
            });
            return;
        }
        if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
            const inner = new Map(scope);
            if (node.id) inner.set(node.id.name, { kind: false });
            visit(node.superClass, inner, module);
            visit(node.body, inner, module);
            return;
        }
        if (node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
            const declaration = node.type === 'ForStatement' ? node.init : node.left;
            const lexical = declaration?.type === 'VariableDeclaration' && declaration.kind !== 'var';
            const inner = lexical ? new Map(scope) : scope;
            if (lexical) declaration.declarations.forEach(entry => namesOf(entry.id).forEach(name => inner.set(name, { kind: false })));
            if (node.type === 'ForStatement') {
                visit(node.init, inner, module);
                visit(node.test, inner, module);
                visit(node.body, inner, module);
                visit(node.update, inner, module);
            } else {
                visit(node.right, inner, module);
                if (declaration.type === 'VariableDeclaration') visit(declaration, inner, module);
                else {
                    namesOf(declaration).forEach(name => { if (inner.has(name)) inner.get(name).kind = false; });
                    visit(declaration, inner, module);
                }
                visit(node.body, inner, module);
            }
            return;
        }
        if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
            visit(node.right, scope, module);
            const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
            namesOf(target).forEach(name => { if (scope.has(name)) scope.get(name).kind = false; });
            visit(target, scope, module);
            return;
        }
        if (node.type === 'CatchClause') {
            const inner = new Map(scope);
            namesOf(node.param).forEach((name) => inner.set(name, { kind: false }));
            visit(node.body, inner, module);
            return;
        }
        if (node.type === 'VariableDeclaration') {
            for (const entry of node.declarations) {
                visit(entry.init, scope, module);
                if (entry.id.type === 'Identifier') scope.set(entry.id.name, { kind: node.kind === 'const' && trusted(entry.init, scope) });
                else namesOf(entry.id).forEach((name) => scope.set(name, { kind: false }));
            }
            return;
        }
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
            && key(node.callee) === 'runTransaction' && trusted(node.callee.object, scope)) {
            sites.push({ module, start: node.start, end: node.end });
        }
        for (const child of children(node)) visit(child, scope, module);
    };
    sources.forEach((source, module) => {
        const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
        const scope = new Map([['fb', { kind: true }], ['firebaseState', { kind: 'state' }]]);
        hoistVars(ast, scope);
        visit(ast, scope, module);
    });
    return sites;
}

const REACT_HELPERS = [
    'elementOf', 'field', 'fieldValue', 'setFieldValue', 'fieldChecked', 'setFieldChecked',
    'focusField', 'focusFieldAsIs', 'openFilePicker', 'isFieldFocused',
    'activeElementIsTextField', 'activeElementIsInModal', 'blurActiveElement',
    'rectOfElement', 'elementSize', 'setScrollTop', 'setElementScrollTop', 'scrollChildIntoView',
    'animateElement', 'videoElement',
    'registerModalMeta', 'unregisterModalMeta', 'modalMeta', 'modalIsMounted', 'modalDisplay', 'setModalDisplay',
    'modalIsOpen', 'openModalIds',
    'domText',
    'commitNow', 'renderNow',
    'documentIsHidden', 'onDocumentVisibilityChange', 'resetDocumentScroll', 'scrollWindowToTop',
    'createScratchCanvas', 'loadScratchImage', 'addPreconnectHint', 'injectScript', 'downloadObjectUrl',
    // `src/platform/native.ts` ៖ អាន `window.Capacitor` ➜ ក្នុង sandbox (គ្មាន bridge) ជាផ្លូវ web ដូច App ដើម
    'isNativeApp', 'isNativeAndroid', 'pullToRefreshSupported', 'resolveNativeApiUrl', 'nativeWebOrigin',
    'nativeFunctionRequest', 'moveQueryToHeader',
    // ការសម្អាតផ្ទៃ (`blankElementById()`) ៖ ជំនួស `el.value = ''` / `el.innerHTML = ''` របស់ App ដើម ➜ សរសេរ
    // ឃ្លាំងដែល JSX គូរ (តារាង · ប្រអប់ · សារ) — `clearSensitiveModalFields()` ឆ្លងកាត់វា
    'blankElementById', 'resetReactOwned', 'blankScanRemoveText',
    'safeStoreGet', 'safeStoreSet', 'safeStoreRemove', 'emptySheetImportView', 'sheetPatch', 'sheetMsgClear', 'sheetMapClear', 'patchSheetImportView', 'sheetImportViewNow'
];

// ⛔ ថេរដែល helper ខាងលើអាន (`REF_NAMES` ៖ ឈ្មោះ ref ដែលចង `ref={…}` ពិត · `TEXT_BLANKERS` ៖ អត្ថបទ viewState)
const REACT_CONSTS = ['appLocalStore', 'appSessionStore', 'REF_NAMES', 'TEXT_BLANKERS', 'NATIVE_QUERY_HEADER', 'NATIVE_QUERY_MAX'];

function sliceConst(src, name) {
    const acorn = require('acorn');
    const m = new RegExp('^( *)const ' + name + ' = ', 'm').exec(src);
    if (!m) return null;
    const at = m.index + m[1].length + ('const ' + name + ' = ').length;
    let node;
    try {
        node = acorn.parseExpressionAt(src, at, { ecmaVersion: 'latest' });
    } catch (e) {
        throw new Error('react-view ៖ ញែក const ' + name + ' មិនបាន ៖ ' + e.message);
    }
    return 'const ' + name + ' = ' + src.slice(at, node.end) + ';';
}

function sliceFunction(src, name) {
    const re = new RegExp('^( *)(async\\s+)?function\\s+' + name.replace(/\$/g, '\\$') + '\\s*\\(', 'm');
    const m = re.exec(src);
    if (!m) return null;
    const open = src.indexOf('{', src.indexOf(')', m.index));
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(m.index + m[1].length, i + 1); }
    }
    return null;
}

// ⛔ literal = តម្លៃដែលមិនយោងឈ្មោះណាមួយ ៖ literal · template គ្មាន `${}` · `-1` · array/object ដែលធាតុ/តម្លៃទាំងអស់
//    ជា literal **ជាជាន់ៗ** (ឧ. `{ state: 'off', stamps: {} }`) ➜ វាលដែលមាន object ខាងក្នុងនៅតែមកដល់ sandbox
//    (មិនមែន `undefined` ដែលធ្វើឲ្យ `<ឃ្លាំង>.<វាល>.state` បោះ TypeError)។ key គណនា (`[x]: 1`) · method · getter ·
//    shorthand (`{ a }`) · spread · រន្ធទទេ (`[, 1]`) · ការហៅ/ឈ្មោះ ➜ មិនមែន literal ➜ `undefined` ដូចមុន។
function isLiteralNode(node) {
    if (!node) return false;
    const t = node.type;
    if (t === 'Literal' || t === 'TemplateLiteral' && !node.expressions.length) return true;
    if (t === 'UnaryExpression' && node.argument.type === 'Literal') return true;
    if (t === 'ArrayExpression') return node.elements.every((e) => e && isLiteralNode(e));
    if (t === 'ObjectExpression') {
        return node.properties.every((p) => p.type === 'Property' && p.kind === 'init' && !p.computed && !p.method &&
            !p.shorthand && isLiteralNode(p.value));
    }
    return false;
}

function literalInit(node, src) {
    return isLiteralNode(node) ? src.slice(node.start, node.end) : 'undefined';
}

const LITERAL_INIT_PROBE = "({ a: 1, b: -2, c: 't', d: [1, 'x'], e: { f: 0, g: { h: [] }, i: [{ j: null }] }, k: {}, l: [], " +
    "m: x, n: [x], o: { p: x }, q: { [x]: 1 }, r: { s() {} }, t: { x }, u: [, 1], v: { ...x }, w: f(), y: `${x}`, z: { aa: { bb: [x] } } })";
const LITERAL_INIT_KEPT = ['a', 'b', 'c', 'd', 'e', 'k', 'l'];

/** ⛔ self-check ៖ literal ជាជាន់ៗនៅដដែល · មិនមែន literal (សូម្បីតែជ្រៅខាងក្នុង) ➜ `undefined` */
function literalInitSelfCheck() {
    const acorn = require('acorn');
    const probe = acorn.parseExpressionAt(LITERAL_INIT_PROBE, 0, { ecmaVersion: 'latest' });
    for (const p of probe.properties) {
        const got = literalInit(p.value, LITERAL_INIT_PROBE);
        const want = LITERAL_INIT_KEPT.includes(p.key.name) ? LITERAL_INIT_PROBE.slice(p.value.start, p.value.end) : 'undefined';
        if (got !== want) throw new Error('react-view ៖ literalInit(' + p.key.name + ') = ' + got + ' (រំពឹង ' + want + ')');
    }
}

/** `const <ឃ្លាំង> = createStore('<ឃ្លាំង>', {...})` ទាំងអស់ក្នុងទិដ្ឋភាព ➜ អត្ថបទ (តម្លៃ literal តែប៉ុណ្ណោះ) */
function storeDefinitions(src) {
    const acorn = require('acorn');
    literalInitSelfCheck();
    const out = [];
    const re = /^ *const (\w+) = createStore\('(\w+)', \{/gm;
    let m;
    while ((m = re.exec(src))) {
        const start = src.indexOf('createStore(', m.index);
        let node;
        try {
            node = acorn.parseExpressionAt(src, start, { ecmaVersion: 'latest' });
        } catch (e) {
            throw new Error('react-view ៖ ញែក createStore(' + m[2] + ') មិនបាន ៖ ' + e.message);
        }
        const obj = node.arguments[1];
        const props = obj.properties.filter((p) => p.type === 'Property' && !p.computed && p.key.type === 'Identifier')
            .map((p) => p.key.name + ': ' + literalInit(p.value, src));
        out.push('const ' + m[1] + ' = createStore(' + JSON.stringify(m[2]) + ', {' + props.join(', ') + '});');
    }
    if (out.length < 5) throw new Error('react-view ៖ រកឃ្លាំងបានតែ ' + out.length + ' (ជាន់អប្បបរមា 5)');
    return out.join('\n');
}

/**
 * អត្ថបទ runtime React សម្រាប់ `vm` ៖ `createStore` + ឃ្លាំង + helper។ `exclude` ៖ ឈ្មោះដែល checker ផ្គត់ផ្គង់
 * ដោយខ្លួនឯង (ឧ. checker ដែលក្លែង `commitNow` ដើម្បីរាប់វា)។ ⛔ ត្រូវការ `queueMicrotask` ក្នុង sandbox។
 */
function reactRuntime(src, options) {
    const exclude = new Set((options && options.exclude) || []);
    // ⛔ ឈ្មោះដែល sandbox របស់ checker ផ្គត់ផ្គង់រួច (stub) មិនត្រូវ function ពិតសរសេរជាន់
    if (options && options.context) for (const k of Object.keys(options.context)) exclude.add(k);
    const parts = [];
    const store = sliceFunction(src, 'createStore');
    if (!store) throw new Error('react-view ៖ រក createStore មិនឃើញ');
    parts.push('let immediateCommit = null;\nlet immediateDepth = 0;');
    for (const name of ['commitImmediately', 'setImmediateCommit']) {
        const fn = sliceFunction(src, name);
        if (fn) parts.push(fn);
    }
    parts.push(store);
    parts.push(storeDefinitions(src));
    parts.push('if (typeof window !== "undefined" && typeof localStorage !== "undefined" && typeof window.localStorage === "undefined") window.localStorage = localStorage;');
    parts.push('if (typeof window !== "undefined" && typeof sessionStorage !== "undefined" && typeof window.sessionStorage === "undefined") window.sessionStorage = sessionStorage;');
    const connectionHelpers = ['captureConnectionOperation', 'connectionFlowSnapshot', 'nativeWriteRecoveryState', 'withConnectionOwnership'];
    if (connectionHelpers.some(name => sliceFunction(src, name))) {
        for (const name of ['nativeRecoveryStates', 'connectionLeases', 'stopConnectionLeaseObserver']) {
            if (exclude.has(name)) continue;
            const decl = new RegExp('^\\s*(?:const|let) ' + name + ' = [^;]+;', 'm').exec(src);
            if (decl) parts.push(decl[0].trim());
        }
        for (const name of ['auth', 'db', 'fb', 'authGeneration', 'firebaseSdkUnavailable', 'isInitializingFirebase',
            'sessionExpiryCheck', 'authLoginOperation', 'isDatabaseInitialized', 'isDatabaseConnected', 'dbListenersFailed']) {
            const decl = new RegExp('^\\s*let ' + name + ' = ([^;]+);', 'm').exec(src);
            if (decl) parts.push('if (typeof ' + name + ' === "undefined") globalThis.' + name + ' = ' + decl[1] + ';');
        }
        parts.push('if (typeof dbListenerPendingPaths === "undefined") globalThis.dbListenerPendingPaths = new Set();');
        for (const name of connectionHelpers) {
            if (exclude.has(name)) continue;
            const fn = sliceFunction(src, name);
            if (fn) parts.push(fn);
        }
    }
    const modalIds = /^ *const MODAL_IDS = \[[^\]]*\];/m.exec(src);
    if (modalIds) parts.push(modalIds[0].trim());
    for (const name of REACT_CONSTS) {
        if (exclude.has(name)) continue;
        const c = sliceConst(src, name);
        if (c) parts.push(c);
    }
    for (const name of REACT_HELPERS) {
        if (exclude.has(name)) continue;
        const fn = sliceFunction(src, name);
        if (fn) parts.push(fn);
    }
    return parts.join('\n');
}

// ⛔ JSX ពិត ៖ `ZoeW/react-render.cjs` (build-audit ២គ) ផ្ទុក component ទាំងអស់ បូកឃ្លាំង និង `renderToStaticMarkup()`
const renderBundles = new Map();
function reactRenderBundle(root) {
    const file = require('path').join(root, 'ZoeW', 'react-render.cjs');
    if (!renderBundles.has(file)) {
        if (!require('fs').existsSync(file)) throw new Error('react-view ៖ រក ' + file + ' មិនឃើញ (build-audit ២គ)');
        renderBundles.set(file, require(file));
    }
    return renderBundles.get(file);
}

/** ឃ្លាំងទាំងអស់របស់ bundle (`core/state` · `core/view-state` · …) ➜ `{ ឈ្មោះ export: ឃ្លាំង }` */
function allBundleStores(m) {
    if (m.__allStores) return m.__allStores;
    const out = {};
    const nss = [m.stores].concat((m.STATE_MODULES || []).map((_, i) => m['s' + i]));
    for (const ns of nss) {
        for (const key of Object.keys(ns || {})) {
            const v = ns[key];
            if (v && typeof v === 'object' && typeof v.subscribe === 'function' && typeof v.version === 'function') out[key] = v;
        }
    }
    m.__allStores = out;
    return out;
}

/**
 * គូរ component ពិត (`rel` ៖ `src/app/components/…tsx` · `exportName`) ជា HTML ។ `stores` ៖ `{ uiState: { វាល: តម្លៃ } }`
 * — view model ដែល function ពិតផលិតក្នុង `vm` (អាន `vm.runInContext('uiState.x', ctx)`) ➜ ចាក់ចូលឃ្លាំងរបស់ bundle ។
 */
function renderComponent(root, rel, exportName, stores) {
    const m = reactRenderBundle(root);
    const i = m.FILES.indexOf(rel);
    if (i === -1) throw new Error('react-view ៖ រក component ' + rel + ' មិនឃើញ');
    const Comp = m['c' + i][exportName];
    if (typeof Comp !== 'function') throw new Error('react-view ៖ ' + rel + ' មិន export ' + exportName);
    const restore = [];
    try {
        for (const [store, fields] of Object.entries(stores || {})) {
            const target = allBundleStores(m)[store];
            if (!target) throw new Error('react-view ៖ រកឃ្លាំង ' + store + ' មិនឃើញ');
            for (const [k, v] of Object.entries(fields)) {
                const owned = Object.prototype.hasOwnProperty.call(target, k);
                const previous = target[k];
                restore.push(() => { if (owned) target[k] = previous; else delete target[k]; });
                target[k] = v;
            }
        }
        return m.renderToStaticMarkup(m.createElement(Comp));
    } finally {
        // ⛔ bundle រួមមិនត្រូវរក្សាស្ថានភាពពីសេណារីយ៉ូមុន សូម្បីតែពេលគូរបោះកំហុស។
        for (const reset of restore.reverse()) reset();
    }
}

/**
 * ចម្លង **ស្ថានភាពទាំងមូល** របស់ sandbox `vm` (វាលឃ្លាំង + វាល state ដើមដែលជា `let` កម្រិតកំពូល) ចូលឃ្លាំងរបស់ bundle
 * រួចគូរ component ពិត ➜ HTML ដែល React គូរពីស្ថានភាពដដែលនឹងអ្វីដែល function ពិតទើបសរសេរ។
 */
function renderFromContext(root, ctx, rel, exportName) {
    const vm = require('vm');
    const m = reactRenderBundle(root);
    const stores = {};
    for (const store of Object.keys(allBundleStores(m))) {
        const fields = {};
        const own = vm.runInContext('typeof ' + store + ' === "object" && ' + store + ' ? Object.keys(' + store + ') : []', ctx);
        for (const k of own) {
            const v = vm.runInContext(store + '[' + JSON.stringify(k) + ']', ctx);
            if (typeof v !== 'function') fields[k] = v;
        }
        for (const k of (m.STATE_FIELDS[store] || [])) {
            if (!/^[A-Za-z_$][\w$]*$/.test(k)) continue;
            const has = vm.runInContext('(function () { try { ' + k + '; return true; } catch (e) { return false; } })()', ctx);
            if (has) fields[k] = vm.runInContext(k, ctx);
        }
        stores[store] = fields;
    }
    // ⛔ `Set`/`Map` កម្រិត module (ឧ. `dbListenerPendingPaths`) ដែល helper ក្នុង JSX អាន ➜ ចម្លងមាតិកាពី `vm`
    const restore = [];
    try {
        for (let i = 0; i < (m.STATE_MODULES || []).length; i++) {
            const ns = m['s' + i];
            for (const key of Object.keys(ns)) {
                const local = ns[key];
                if (!(local instanceof Set) && !(local instanceof Map)) continue;
                const remote = vm.runInContext('(function () { try { return ' + key + '; } catch (e) { return undefined; } })()', ctx);
                if (!remote || typeof remote.forEach !== 'function') continue;
                const previous = Array.from(local);
                const next = [];
                remote.forEach((v, k) => next.push(local instanceof Set ? v : [k, v]));
                const replace = (values) => {
                    local.clear();
                    for (const value of values) {
                        if (local instanceof Set) local.add(value);
                        else local.set(value[0], value[1]);
                    }
                };
                restore.push(() => replace(previous));
                replace(next);
            }
        }
        return renderComponent(root, rel, exportName, stores);
    } finally {
        for (const reset of restore.reverse()) reset();
    }
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** បំបែក HTML ជាធាតុកម្រិតកំពូល ➜ `[{ outerHTML, innerHTML }]` (អត្ថបទទទេរវាងធាតុរំលង) */
function topLevelElements(html) {
    const out = [];
    const re = /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g;
    let depth = 0, start = -1, innerStart = -1, m;
    while ((m = re.exec(html))) {
        const closing = m[1] === '/';
        const selfClosing = m[3] === '/' || VOID_TAGS.has(m[2].toLowerCase());
        if (!closing) {
            if (depth === 0) { start = m.index; innerStart = re.lastIndex; }
            if (selfClosing) {
                if (depth === 0) out.push({ outerHTML: html.slice(start, re.lastIndex), innerHTML: '' });
                continue;
            }
            depth++;
        } else {
            depth--;
            if (depth === 0) out.push({ outerHTML: html.slice(start, re.lastIndex), innerHTML: html.slice(innerStart, m.index) });
        }
    }
    return out;
}

/**
 * «ធាតុផ្ទុក» សម្រាប់ checker ដែលអាន `container.innerHTML` / `container.children[i].innerHTML` ដូច App ដើម ៖
 * រាល់ការអានគូរ component ពិតពីស្ថានភាពបច្ចុប្បន្នរបស់ `vm` (getter) ➜ call site របស់ checker មិនប្រែ។
 */
function renderedContainer(root, ctx, rel, exportName) {
    const html = () => renderFromContext(root, ctx, rel, exportName);
    return {
        get innerHTML() { return html(); },
        get children() { return topLevelElements(html()); }
    };
}

function decodeEntities(t) {
    return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
}

/** ធាតុដែលមាន `id` ក្នុង HTML ➜ `{ tag, className, hidden, innerHTML, text }` ឬ `null` */
function elementById(html, id) {
    const re = new RegExp('<([a-zA-Z][\\w-]*)\\b[^>]*\\bid="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>');
    const m = re.exec(html);
    if (!m) return null;
    const el = topLevelElements(html.slice(m.index))[0];
    const cls = /\bclass="([^"]*)"/.exec(m[0]);
    return {
        tag: m[1].toLowerCase(),
        className: cls ? decodeEntities(cls[1]) : '',
        hidden: /\shidden(=""|\s|>|$)/.test(m[0]),
        innerHTML: el ? el.innerHTML : '',
        text: el ? decodeEntities(el.innerHTML.replace(/<[^>]*>/g, '')) : ''
    };
}

/**
 * «ធាតុ» សម្រាប់ checker ដែលអាន `el.innerText` / `el.classList` ដូច App ដើម ៖ រាល់ការអានគូរ component ពិត
 * ពីស្ថានភាពបច្ចុប្បន្នរបស់ `vm` រួចស្រង់ធាតុតាម `id` (ធាតុបាត់ ➜ អត្ថបទទទេ · class ទទេ)។
 */
function renderedElement(root, ctx, rel, exportName, id) {
    const read = () => elementById(renderFromContext(root, ctx, rel, exportName), id) || { className: '', hidden: true, innerHTML: '', text: '' };
    const classSet = () => new Set(read().className.split(/\s+/).filter(Boolean));
    return {
        get innerText() { return read().text; },
        get textContent() { return read().text; },
        get innerHTML() { return read().innerHTML; },
        get className() { return read().className; },
        get hidden() { return read().hidden; },
        get classes() { const out = {}; classSet().forEach((c) => { out[c] = true; }); return out; },
        classList: { contains: (c) => classSet().has(c) }
    };
}

/**
 * handler ដែល JSX ពិតចងលើធាតុ `id` (`prop` ៖ `onClick` · `onFocus` …) ដេរីវេពីអត្ថបទ `react-render.cjs` ៖
 *   `onFocus: phoneSearchFocused`            ➜ `{ name: 'phoneSearchFocused', args: null }` (ហៅជាមួយ event)
 *   `onClick: () => togglePanelFromHandle("data")` ➜ `{ name: 'togglePanelFromHandle', args: ['data'] }`
 *   `onClick: onAct("x", ["a"])`             ➜ `{ name: 'x', args: ['a'], act: true }`
 *   រូបរាងផ្សេង (arrow មានតួ) ➜ `{ name: null, raw: '<អត្ថបទតួ>' }` ➜ checker វាស់តួដោយខ្លួនឯង
 * ⛔ រកមិនឃើញ ➜ `null` (checker ត្រូវធ្លាក់ មិនមែនសន្មត)
 */
function jsxHandler(root, id, prop) {
    const acorn = require('acorn');
    const text = require('fs').readFileSync(require('path').join(root, 'ZoeW', 'react-render.cjs'), 'utf8');
    const at = text.indexOf('id: ' + JSON.stringify(id) + ',');
    if (at === -1) return null;
    let depth = 0, open = -1;
    for (let i = at; i >= 0; i--) {
        const c = text[i];
        if (c === '}') depth++;
        else if (c === '{') { if (depth === 0) { open = i; break; } depth--; }
    }
    if (open === -1) return null;
    let node;
    try { node = acorn.parseExpressionAt(text, open, { ecmaVersion: 'latest' }); } catch (e) { return null; }
    const property = (node.properties || []).find((p) => p.type === 'Property' && p.key && (p.key.name === prop || p.key.value === prop));
    if (!property) return null;
    const value = property.value;
    const raw = text.slice(value.start, value.end);
    const literal = (n) => (n.type === 'Literal' ? n.value
        : n.type === 'ArrayExpression' ? n.elements.map(literal) : undefined);
    if (value.type === 'Identifier') return { name: value.name, args: null, raw };
    const call = value.type === 'ArrowFunctionExpression' && value.body.type === 'CallExpression' ? value.body
        : (value.type === 'CallExpression' ? value : null);
    if (!call || call.callee.type !== 'Identifier') return { name: null, args: null, raw };
    const args = call.arguments.map(literal);
    if (args.some((v) => v === undefined)) return { name: null, args: null, raw };
    if (value.type === 'CallExpression' && call.callee.name === 'onAct') return { name: args[0], args: args[1] || [], act: true, raw };
    if (value.type === 'CallExpression') return { name: null, args: null, raw };
    return { name: call.callee.name, args, raw };
}

/**
 * សំបករបស់ Service Worker (`CORE_SHELL` · `OPTIONAL_SHELL`) ដែល `ZoeW/sw.js` **ពិត** ប្រកាស ➜ App React ដាក់ឈ្មោះ
 * asset តាម hash (`./assets/index-<hash>.js`) ➜ checker ដែលធ្លាប់ចាក់ `./app.js` · `./style.css` ត្រូវដេរីវេពីទីនេះ។
 */
function swShell(root, app) {
    const acorn = require('acorn');
    const src = require('fs').readFileSync(require('path').join(root, app || 'ZoeW', 'sw.js'), 'utf8');
    const out = {};
    for (const st of acorn.parse(src, { ecmaVersion: 'latest' }).body) {
        if (st.type !== 'VariableDeclaration') continue;
        for (const d of st.declarations) {
            if (d.id.type === 'Identifier' && (d.id.name === 'CORE_SHELL' || d.id.name === 'OPTIONAL_SHELL')
                && d.init && d.init.type === 'ArrayExpression') {
                out[d.id.name] = d.init.elements.map((e) => e.value);
            }
        }
    }
    if (!out.CORE_SHELL) throw new Error('react-view ៖ រក CORE_SHELL ក្នុង sw.js មិនឃើញ');
    const core = out.CORE_SHELL;
    return {
        core, optional: out.OPTIONAL_SHELL || [],
        // asset JS/CSS ចម្បងរបស់ App (ជំនួស `./app.js` · `./style.css` របស់ App ដើម)
        appJs: core.find((u) => u === './app.js') || core.find((u) => /^\.\/assets\/index-[^/]+\.js$/.test(u))
            || core.find((u) => /^\.\/assets\/.*\.js$/.test(u)),
        appCss: core.find((u) => u === './style.css') || core.find((u) => /^\.\/assets\/.*\.css$/.test(u))
    };
}

/*
 * សកម្មភាពដែល App React ហៅតាមឈ្មោះ (ព្រំដែន `ACTION_REGISTRY`) — ជំនួស `data-act="x"` ក្នុង HTML ដើម ៖
 *   ១. `onAct("x")` / `act("x")` ក្នុង JSX (`components.js`)
 *   ២. view-model `{ label, action: 'x' }` ក្នុង `app.js` ដែល JSX គូរជា `data-act={it.action}` (ម៉ឺនុយ (...))
 * ⛔ ការហៅ function ដោយផ្ទាល់ (`renderX()`) មិនរាប់ — វាមិនឆ្លងកាត់ព្រំដែន ➜ ធាតុក្នុងបញ្ជីដែលគ្មាន `act()`
 *    ណាហៅ = សិទ្ធិលើស។ គ្មាន `components.js` (App ដើម) ➜ `null`។ ការស្កេនទទេ ➜ បោះ (មិនមែនសំណុំទទេស្ងាត់)។
 */
function auditModuleSourceRanges(appDir, js) {
    const fs = require('fs'), path = require('path');
    const file = path.join(appDir, 'audit-module-views.json');
    if (!fs.existsSync(file)) return [{ source: js, start: 0, end: js.length }];
    const views = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!views || typeof views !== 'object' || Array.isArray(views) || !Object.keys(views).length) {
        throw new Error('react-view: invalid module inventory');
    }
    const sources = [];
    let cursor = 0;
    for (const [name, view] of Object.entries(views)) {
        if (typeof view !== 'string') throw new Error('react-view: invalid module ' + name);
        if (!view.length) continue;
        const at = js.indexOf(view, cursor);
        if (at < 0) throw new Error('react-view: missing or mismatched module ' + name);
        if (at > cursor) sources.push({ source: js.slice(cursor, at), start: cursor, end: at });
        sources.push({ source: view, start: at, end: at + view.length });
        cursor = at + view.length;
    }
    if (cursor < js.length) sources.push({ source: js.slice(cursor), start: cursor, end: js.length });
    return sources;
}

function auditModuleSources(appDir, js) {
    return auditModuleSourceRanges(appDir, js).map(part => part.source);
}

function actionUsages(appDir, js) {
    const fs = require('fs');
    const path = require('path');
    const acorn = require('acorn');
    const compPath = path.join(appDir, 'components.js');
    if (!fs.existsSync(compPath)) return null;
    const comp = fs.readFileSync(compPath, 'utf8');
    const used = new Set();
    for (const m of comp.matchAll(/\b(?:onAct|act)\(\s*["']([A-Za-z_$][\w$]*)["']/g)) used.add(m[1]);
    if (!used.size) throw new Error('react-view ៖ រក onAct()/act() ក្នុង components.js មិនឃើញ');
    let menuItems = 0;
    if (/"data-act":\s*[A-Za-z_$][\w$]*\.action\b/.test(comp)) {
        const walk = (n, fn) => {
            if (!n || typeof n.type !== 'string') return;
            fn(n);
            for (const k in n) {
                if (k === 'type' || k === 'start' || k === 'end') continue;
                const v = n[k];
                if (Array.isArray(v)) v.forEach((c) => walk(c, fn));
                else if (v && typeof v.type === 'string') walk(v, fn);
            }
        };
        for (const source of auditModuleSources(appDir, js)) walk(acorn.parse(source, { ecmaVersion: 2022, sourceType: 'script' }), (n) => {
            if (n.type !== 'ObjectExpression') return;
            const prop = (k) => n.properties.find((p) => p.type === 'Property' && !p.computed &&
                ((p.key.type === 'Identifier' && p.key.name === k) || (p.key.type === 'Literal' && p.key.value === k)));
            const label = prop('label');
            const action = prop('action');
            if (!label || !action || action.value.type !== 'Literal' || typeof action.value.value !== 'string') return;
            used.add(action.value.value);
            menuItems++;
        });
        if (!menuItems) throw new Error('react-view ៖ JSX គូរ data-act={x.action} តែរក view-model { label, action } មិនឃើញ');
    }
    return used;
}

/**
 * ⛔ App React ដំឡើង bridge វាស់ (`expose-globals`) តាម `import()` **អសមកាល** ➜ វាអាចមកដល់ **ក្រោយ** ព្រឹត្តិការណ៍ `load`
 *    ➜ ការអាន `window.<fn>` ភ្លាមក្រោយ `goto(…, 'load')` ជាការប្រណាំង (ធ្លាក់ពេលម៉ាស៊ីនរវល់ មិនមែនពេល App ខូច)។
 *    ពិដានខ្លី (២ វិ.) ដោយចេតនា ៖ chunk ដែលមកពី cache មកដល់ក្នុងរាប់ ms ចំណែក chunk ដែល **មិននៅក្នុង cache**
 *    ត្រូវរង់ចាំបណ្តាញ (checker SW ពន្យារ ៥ វិ.) ➜ ការធ្លាក់ពិតនៅតែធ្លាក់។
 */
const AUDIT_BRIDGE_WAIT_MS = 2000;
async function waitAuditBridge(page, name = 'initScanEngine', budgetMs = AUDIT_BRIDGE_WAIT_MS) {
    return page.evaluate(async ([fn, budget]) => {
        const t0 = Date.now();
        while (typeof window[fn] !== 'function' && Date.now() - t0 < budget) await new Promise((r) => setTimeout(r, 25));
        return typeof window[fn] === 'function';
    }, [name, budgetMs]).catch(() => false);
}

module.exports = {
    appCodeLabel, readAppCode, scanEvidenceRuntime, moduleRuntime, memoryStorage, wrappedTransactionCallSites, swShell, auditModuleSourceRanges, auditModuleSources, actionUsages, waitAuditBridge, AUDIT_BRIDGE_WAIT_MS,
    REACT_HELPERS, REACT_CONSTS, sliceFunction, sliceConst, storeDefinitions, reactRuntime,
    renderComponent, renderFromContext, renderedContainer, renderedElement, topLevelElements, elementById, jsxHandler
};
