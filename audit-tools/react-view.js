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
    'isNativeApp', 'isNativeAndroid', 'pullToRefreshSupported', 'resolveNativeApiUrl', 'nativeWebOrigin'
];

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
    for (const name of REACT_HELPERS) {
        if (exclude.has(name)) continue;
        const fn = sliceFunction(src, name);
        if (fn) parts.push(fn);
    }
    return parts.join('\n');
}

module.exports = { REACT_HELPERS, sliceFunction, storeDefinitions, reactRuntime };
