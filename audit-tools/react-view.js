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
// ⛔ តម្លៃដំបូងរបស់វាលឃ្លាំងដែលមិនមែន literal (ឧ. អានពី storage) ក្លាយជា `undefined` ៖ វាលទាំងនោះជា state
//    ដើមដែលទិដ្ឋភាពប្រកាសជា `let` កម្រិតកំពូលរួចហើយ ហើយ checker ផ្គត់ផ្គង់វាក្នុង sandbox ផ្ទាល់ខ្លួន។
'use strict';

// ⛔ helper ដែលកូដមុខងារនាំចូលពីស្រទាប់ React (`src/app/refs.ts` · `src/core/modals.ts` · `src/core/view-state.ts` ·
//    `src/app/flush.ts` · `src/platform/document-io.ts`) — ពួកវាជា «ច្រកចេញ» ដែលជំនួសការប៉ះ DOM ផ្ទាល់របស់
//    `app.js` ដើម (`byId(x).value` · `el.style.display = …` · `document.createElement('canvas')` …)
const REACT_HELPERS = [
    'elementOf', 'field', 'fieldValue', 'setFieldValue', 'fieldChecked', 'setFieldChecked', 'fieldFiles',
    'focusField', 'focusFieldAsIs', 'blurField', 'selectFieldText', 'openFilePicker', 'isFieldFocused',
    'activeElementIsTextField', 'activeElementTag', 'blurActiveElement',
    'elementRect', 'rectOfElement', 'elementSize', 'setScrollTop', 'setElementScrollTop', 'scrollChildIntoView',
    'animateElement', 'videoElement',
    'registerModalMeta', 'unregisterModalMeta', 'modalMeta', 'modalIsMounted', 'modalDisplay', 'setModalDisplay',
    'modalIsOpen', 'openModalIds',
    'domText',
    'commitNow', 'renderNow',
    'documentLoadComplete', 'documentIsHidden', 'onDocumentVisibilityChange', 'resetDocumentScroll', 'scrollWindowToTop',
    'createScratchCanvas', 'loadScratchImage', 'addPreconnectHint', 'injectScript', 'downloadObjectUrl',
    // `src/platform/native.ts` ៖ អាន `window.Capacitor` ➜ ក្នុង sandbox (គ្មាន bridge) ជាផ្លូវ web ដូច App ដើម
    'isNativeApp', 'isNativeAndroid', 'pullToRefreshSupported', 'resolveNativeApiUrl', 'nativeWebOrigin',
    // ការសម្អាតផ្ទៃ (`blankElementById()`) ៖ ជំនួស `el.value = ''` / `el.innerHTML = ''` របស់ App ដើម ➜ សរសេរ
    // ឃ្លាំងដែល JSX គូរ (តារាង · ប្រអប់ · សារ) — `clearSensitiveModalFields()` ឆ្លងកាត់វា
    'blankElementById', 'resetReactOwned', 'blankScanRemoveText',
    'emptySheetImportView', 'sheetPatch', 'sheetMsgClear', 'sheetMapClear', 'patchSheetImportView', 'sheetImportViewNow'
];

// ⛔ ថេរដែល helper ខាងលើអាន (`REF_NAMES` ៖ ឈ្មោះ ref ដែលចង `ref={…}` ពិត · `TEXT_BLANKERS` ៖ អត្ថបទ viewState)
const REACT_CONSTS = ['REF_NAMES', 'TEXT_BLANKERS'];

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

function literalInit(node, src) {
    if (!node) return 'undefined';
    const t = node.type;
    if (t === 'Literal' || t === 'TemplateLiteral' && !node.expressions.length) return src.slice(node.start, node.end);
    if (t === 'UnaryExpression' && node.argument.type === 'Literal') return src.slice(node.start, node.end);
    if (t === 'ArrayExpression' && node.elements.every((e) => e && (e.type === 'Literal'))) return src.slice(node.start, node.end);
    if (t === 'ObjectExpression' && node.properties.every((p) => p.type === 'Property' && p.value.type === 'Literal')) return src.slice(node.start, node.end);
    if (t === 'Identifier' && node.name === 'undefined') return 'undefined';
    return 'undefined';
}

/** `const <ឃ្លាំង> = createStore('<ឃ្លាំង>', {...})` ទាំងអស់ក្នុងទិដ្ឋភាព ➜ អត្ថបទ (តម្លៃ literal តែប៉ុណ្ណោះ) */
function storeDefinitions(src) {
    const acorn = require('acorn');
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
    for (const [store, fields] of Object.entries(stores || {})) {
        const target = allBundleStores(m)[store];
        if (!target) throw new Error('react-view ៖ រកឃ្លាំង ' + store + ' មិនឃើញ');
        for (const [k, v] of Object.entries(fields)) target[k] = v;
    }
    return m.renderToStaticMarkup(m.createElement(Comp));
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
    for (let i = 0; i < (m.STATE_MODULES || []).length; i++) {
        const ns = m['s' + i];
        for (const key of Object.keys(ns)) {
            const local = ns[key];
            if (!(local instanceof Set) && !(local instanceof Map)) continue;
            const remote = vm.runInContext('(function () { try { return ' + key + '; } catch (e) { return undefined; } })()', ctx);
            if (!remote || typeof remote.forEach !== 'function') continue;
            local.clear();
            if (local instanceof Set) remote.forEach((v) => local.add(v));
            else remote.forEach((v, k) => local.set(k, v));
        }
    }
    return renderComponent(root, rel, exportName, stores);
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

/** ធាតុដែលមាន `id` ក្នុង HTML ➜ `{ tag, className, innerHTML, text }` ឬ `null` */
function elementById(html, id) {
    const re = new RegExp('<([a-zA-Z][\\w-]*)\\b[^>]*\\bid="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>');
    const m = re.exec(html);
    if (!m) return null;
    const el = topLevelElements(html.slice(m.index))[0];
    const cls = /\bclass="([^"]*)"/.exec(m[0]);
    return {
        tag: m[1].toLowerCase(),
        className: cls ? decodeEntities(cls[1]) : '',
        innerHTML: el ? el.innerHTML : '',
        text: el ? decodeEntities(el.innerHTML.replace(/<[^>]*>/g, '')) : ''
    };
}

/**
 * «ធាតុ» សម្រាប់ checker ដែលអាន `el.innerText` / `el.classList` ដូច App ដើម ៖ រាល់ការអានគូរ component ពិត
 * ពីស្ថានភាពបច្ចុប្បន្នរបស់ `vm` រួចស្រង់ធាតុតាម `id` (ធាតុបាត់ ➜ អត្ថបទទទេ · class ទទេ)។
 */
function renderedElement(root, ctx, rel, exportName, id) {
    const read = () => elementById(renderFromContext(root, ctx, rel, exportName), id) || { className: '', innerHTML: '', text: '' };
    const classSet = () => new Set(read().className.split(/\s+/).filter(Boolean));
    return {
        get innerText() { return read().text; },
        get textContent() { return read().text; },
        get innerHTML() { return read().innerHTML; },
        get className() { return read().className; },
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

module.exports = {
    REACT_HELPERS, REACT_CONSTS, sliceFunction, sliceConst, storeDefinitions, reactRuntime,
    renderComponent, renderFromContext, renderedContainer, renderedElement, topLevelElements, elementById, jsxHandler
};
