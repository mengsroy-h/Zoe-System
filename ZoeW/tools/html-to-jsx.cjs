'use strict';
/**
 * បម្លែង `index.html` ដើម ➜ React component ។
 *
 * ⛔ គោលដៅ ៖ DOM ដែល React គូរត្រូវ **ដូច `index.html` ដើមបេះបិទ** —
 *    id · class · attribute · អត្ថបទ។ ហេតុផល ៖ `style.css` និងកូដ
 *    imperative ដែលផ្ទេរមក (កាយវិការ · PTR · កាមេរ៉ា · focus) ចង់នឹង
 *    id ពិត ➜ ការប្តូរ markup តែបន្តិច = មុខងារបាត់ដោយស្ងាត់។
 */
const fs = require('fs');
const path = require('path');
const { Window } = require('happy-dom');

const HTML = fs.readFileSync(process.env.INDEX_HTML || path.join(__dirname, '..', '.original', 'ZoeW', 'index.html'), 'utf8');
const OUT = process.env.JSX_OUT || path.join(__dirname, '..', 'src', 'app', 'components');

const win = new Window();
win.document.write(HTML);
const doc = win.document;

/**
 * «slot» ៖ ធាតុដែល React ត្រូវគ្រប់គ្រង *មាតិកា* របស់វា។
 * ⛔ ធាតុខ្លួនឯង (tag · id · class) នៅដដែល ➜ CSS និងកូដ imperative
 *    ដែលរក id នោះ នៅតែដើរ។ មានតែកូនរបស់វាទេដែលប្តូរម្ចាស់។
 */
const SLOTS = {
    historyTableBody: { component: 'HistoryTableBody', from: 'history/HistoryTableBody', reset: "uiState.historyView = null;" },
    entryListTableBody: { component: 'EntryListTableBody', from: 'entry/EntryListTableBody', reset: "uiState.entryListView = null;" },
    lockerListTableBody: { component: 'LockerListTableBody', from: 'entry/LockerListTableBody', reset: "uiState.lockerListView = null;" },
    trashSummaryBox: { component: 'TrashSummaryBox', from: 'trash/TrashSummaryBox', reset: "uiState.trashSummary = null;" },
    deletedTableBody: { component: 'TrashTableBody', from: 'trash/TrashTableBody', reset: "uiState.trashView = null;" },
    monthlyReportBody: { component: 'MonthlyReportBody', from: 'reports/MonthlyReportBody', reset: "uiState.monthlyReportView = null;" },
    dailyStatsContainer: { component: 'DailyStatsCards', from: 'stats/StatsCards', reset: "uiState.dailyStatsView = null;" },
    collectedStatsContainer: { component: 'CollectedStatsCards', from: 'stats/StatsCards', reset: "uiState.collectedStatsView = null;" },
    customerDataTableBody: { component: 'CustomerTableBody', from: 'customer/CustomerTableBody', reset: "lookupState.customerTableView = null;" },
    healthCheckList: { component: 'HealthCheckList', from: 'health/HealthCheckList', reset: "uiState.healthRows = null;" },
    barcodeListContainer: { component: 'BarcodeListContainer', from: 'barcode/BarcodeListContainer', reset: "uiState.viewListView = null;" },
    lockerGrid: { component: 'LockerGrid', from: 'locker/LockerGrid', reset: "uiState.lockerGridView = null;" },
    menuContentContainer: { component: 'MoreMenuContent', from: 'menu/MoreMenuContent', reset: "uiState.moreMenuItems = null;" },
    phoneSuggestBox: { component: 'PhoneSuggestList', from: 'suggest/PhoneSuggestList', reset: "uiState.phoneSuggestItems = []; uiState.phoneSuggestActiveIndex = -1;" },
    recentPhonesList: { component: 'RecentPhonesOptions', from: 'RecentPhonesOptions', reset: "dataState.recentPhonesOptions = [];" },
    ztoSyncBanner: { component: 'ZtoSyncBanner', from: 'zto/ZtoSyncBanner', reset: "ztoState.ztoBannerView = null;" },
    ztoSyncList: { component: 'ZtoSyncList', from: 'zto/ZtoSyncList', reset: "ztoState.ztoSyncListView = null;" },
    ztoListSyncBody: { component: 'ZtoListSyncBody', from: 'zto/ZtoListSyncBody', reset: "ztoState.ztoListPreview = null;" },
    pdfExportPrintArea: { component: 'PdfPrintArea', from: 'PdfPrintArea', reset: "uiState.pdfExportView = null;" },
    toastContainer: { component: 'ToastList', from: 'toast/ToastList', reset: "uiState.toasts = [];" },
    siConfigSummary: { component: 'SiConfigSummary', from: 'sheet/SheetImportParts', reset: "sheetPatch({ summary: null });" },
    siConfigMsg: { component: 'SiConfigMsg', from: 'sheet/SheetImportParts', reset: "sheetMsgClear('siConfigMsg');" },
    siFileMsg: { component: 'SiFileMsg', from: 'sheet/SheetImportParts', reset: "sheetMsgClear('siFileMsg');" },
    siMapMsg: { component: 'SiMapMsg', from: 'sheet/SheetImportParts', reset: "sheetMsgClear('siMapMsg');" },
    siActionMsg: { component: 'SiActionMsg', from: 'sheet/SheetImportParts', reset: "sheetMsgClear('siActionMsg');" },
    siClearMsg: { component: 'SiClearMsg', from: 'sheet/SheetImportParts', reset: "sheetMsgClear('siClearMsg');" },
    siChips: { component: 'SiChips', from: 'sheet/SheetImportParts', reset: "sheetPatch({ chips: [] });" },
    siPreviewBody: { component: 'SiPreviewBody', from: 'sheet/SheetImportParts', reset: "sheetPatch({ previewRows: [] });" }
};

/**
 * «element slot» ៖ ធាតុដែល React ត្រូវគូរ **ទាំងមូល** (មិនត្រឹមមាតិកា)។
 * ⛔ ប្រើសម្រាប់ form control ដែលតម្លៃរបស់វាជា *state* ៖ ការទុកឲ្យ DOM
 *    កាន់តម្លៃ ខណៈ React គូរជម្រើស បង្កើតការប្រណាំងលំដាប់។
 */
const ELEMENT_SLOTS = {
    monthlyReportMonthSel: { component: 'MonthlyReportMonthSelect', from: 'reports/MonthlyReportMonthSelect', reset: "uiState.monthlyReportMonths = []; uiState.monthlyReportMonth = '';" },
    lockerListFilter: { component: 'LockerListFilterSelect', from: 'entry/LockerListFilterSelect', reset: "uiState.lockerFilterOptions = []; uiState.lockerFilterValue = '';" },
    siSheetSel: { component: 'SiSheetSelect', from: 'sheet/SheetImportSelects', reset: "sheetPatch({ sheetNames: [], sheetValue: '' });" },
    siMapBarcode: { component: 'SiMapBarcode', from: 'sheet/SheetImportSelects', reset: "sheetMapClear('siMapBarcode');" },
    siMapDod: { component: 'SiMapDod', from: 'sheet/SheetImportSelects', reset: "sheetMapClear('siMapDod');" },
    siMapCod: { component: 'SiMapCod', from: 'sheet/SheetImportSelects', reset: "sheetMapClear('siMapCod');" },
    siMapPhone: { component: 'SiMapPhone', from: 'sheet/SheetImportSelects', reset: "sheetMapClear('siMapPhone');" }
};

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const ATTR_MAP = {
    class: 'className', for: 'htmlFor', tabindex: 'tabIndex', maxlength: 'maxLength',
    minlength: 'minLength', inputmode: 'inputMode', autocomplete: 'autoComplete',
    autofocus: 'autoFocus', readonly: 'readOnly', colspan: 'colSpan', rowspan: 'rowSpan',
    novalidate: 'noValidate', enterkeyhint: 'enterKeyHint', spellcheck: 'spellCheck',
    crossorigin: 'crossOrigin', srcset: 'srcSet', datetime: 'dateTime',
    contenteditable: 'contentEditable', frameborder: 'frameBorder', allowfullscreen: 'allowFullScreen',
    accesskey: 'accessKey', usemap: 'useMap', cellpadding: 'cellPadding', cellspacing: 'cellSpacing',
    playsinline: 'playsInline', autoplay: 'autoPlay', formaction: 'formAction',
    formnovalidate: 'formNoValidate', marginwidth: 'marginWidth', marginheight: 'marginHeight',
    srclang: 'srcLang', hreflang: 'hrefLang', referrerpolicy: 'referrerPolicy'
};
const NUMERIC_ATTRS = new Set(['min', 'max', 'step', 'size', 'rows', 'cols', 'span', 'start', 'width', 'height',
    'maxlength', 'minlength', 'tabindex', 'colspan', 'rowspan']);
const BOOL_ATTRS = new Set(['checked', 'selected', 'disabled', 'multiple', 'readonly', 'required', 'autofocus', 'hidden', 'novalidate', 'open', 'playsinline', 'muted', 'controls', 'loop', 'autoplay', 'default', 'reversed', 'allowfullscreen']);

function camel(prop) {
    if (prop.startsWith('--')) return prop;
    return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function styleToObject(value) {
    const out = [];
    for (const part of value.split(';')) {
        const idx = part.indexOf(':');
        if (idx === -1) continue;
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (!k || !v) continue;
        const key = camel(k);
        out.push(`${/^[A-Za-z][A-Za-z0-9]*$/.test(key) ? key : JSON.stringify(key)}: ${JSON.stringify(v)}`);
    }
    return `{{ ${out.join(', ')} }}`;
}

/**
 * ⛔ ខ្សែអក្សររបស់ JSX attribute **មិនស្រាយ backslash escape ទេ** ➜ តម្លៃ
 *    ដែលមាន `"` · `\\` · បន្ទាត់ថ្មី · `{` `}` ត្រូវចេញជា *កន្សោម*។
 *    (វាស់បាន ៖ placeholder របស់ `#firebaseConfigInput` មានបន្ទាត់ថ្មីពិត។)
 */
function jsxString(s) {
    return /["\\{}<>\n\r\t]/.test(s) ? `{${JSON.stringify(s)}}` : JSON.stringify(s);
}

/** បំបែក `data-act` ➜ handler របស់ React */
function actionHandler(el) {
    const name = el.getAttribute('data-act');
    if (!name) return null;
    const on = (el.getAttribute('data-on') || 'click').toLowerCase();
    const evtName = { click: 'onClick', change: 'onChange', input: 'onInput', submit: 'onSubmit' }[on] || 'onClick';
    const rawArgs = el.getAttribute('data-args');
    const a1 = el.getAttribute('data-a1');
    const a2 = el.getAttribute('data-a2');
    const wantsEvent = el.hasAttribute('data-evt');
    const wantsSelf = el.hasAttribute('data-self');
    const opts = [];
    if (rawArgs) {
        let parsed;
        try { parsed = JSON.parse(rawArgs); } catch (_e) { parsed = []; }
        if (!Array.isArray(parsed)) parsed = [parsed];
        opts.push(`args: ${JSON.stringify(parsed)}`);
    } else if (a1 !== null || a2 !== null) {
        const list = [];
        if (a1 !== null) list.push(a1);
        if (a2 !== null) list.push(a2);
        opts.push(`args: ${JSON.stringify(list)}`);
    }
    if (wantsEvent) opts.push('evt: true');
    if (wantsSelf) opts.push('self: true');
    const call = opts.length ? `onAct(${jsxString(name)}, { ${opts.join(', ')} })` : `onAct(${jsxString(name)})`;
    return { prop: evtName, value: `{${call}}` };
}

const ACTION_DATA_ATTRS = new Set(['data-act', 'data-args', 'data-a1', 'data-a2', 'data-evt', 'data-self', 'data-on']);

function emitAttrs(node) {
    const el = node;
    const parts = [];
    const handler = actionHandler(el);
    for (const attr of Array.from(el.attributes)) {
        const name = attr.name;
        if (handler && ACTION_DATA_ATTRS.has(name)) continue;
        const value = attr.value;
        if (name === 'style') { parts.push(`style=${styleToObject(value)}`); continue; }
        if (BOOL_ATTRS.has(name)) {
            const prop = ATTR_MAP[name] || name;
            parts.push(value === '' || value === name || value === 'true' ? `${prop}` : `${prop}={${JSON.stringify(value)}}`);
            continue;
        }
        if (name.startsWith('data-') || name.startsWith('aria-')) { parts.push(`${name}=${jsxString(value)}`); continue; }
        const prop = ATTR_MAP[name] || name;
        // `min` · `max` · `step` · `size` របស់ React មាន type ជាលេខ ➜ ចេញជាកន្សោម
        if (NUMERIC_ATTRS.has(name) && /^-?\d+(\.\d+)?$/.test(value)) {
            parts.push(`${prop}={${value}}`);
            continue;
        }
        parts.push(`${prop}=${jsxString(value)}`);
    }
    if (handler) parts.push(`${handler.prop}=${handler.value}`);
    // ⛔ React កំណត់ `muted` ជា *property* ប៉ុណ្ណោះ ➜ attribute បាត់ពី DOM។
    //    លើ iOS ច្បាប់ autoplay អាន **attribute** ➜ វីដេអូកាមេរ៉ាអាចមិនដើរ។
    //    ដូច្នេះយើងដាក់វាមកវិញតាម ref (ការវាស់ ៖ `parity-dom` ចាប់វាបាន)។
    if (node.hasAttribute && node.hasAttribute('muted')) {
        parts.push('ref={(el) => { if (el) { el.muted = true; el.setAttribute(\'muted\', \'\'); } }}');
    }
    return parts;
}

function escapeText(text) {
    return text.replace(/[{}<>]/g, (c) => `{${JSON.stringify(c)}}`);
}

function emitNode(node, indent, out) {
    const pad = '    '.repeat(indent);
    if (node.nodeType === 3) {                            // Text
        const raw = node.data;
        if (!raw.trim()) {
            if (!raw.includes('\n') && raw.includes(' ')) out.push(`${pad}{' '}`);
            return;
        }
        const leading = /^[^\S\n]+/.test(raw) && !/^\s*\n/.test(raw);
        const trailing = /[^\S\n]+$/.test(raw) && !/\n\s*$/.test(raw);
        const body = escapeText(raw.trim());
        out.push(`${pad}${leading ? "{' '}" : ''}${body}${trailing ? "{' '}" : ''}`);
        return;
    }
    if (node.nodeType === 8) {                            // Comment
        const text = String(node.data).trim();
        if (!text) return;
        out.push(`${pad}{/* ${text.replace(/\*\//g, '* /')} */}`);
        return;
    }
    if (node.nodeType !== 1) return;

    const tag = node.tagName.toLowerCase();
    const attrs = emitAttrs(node);
    const elementSlot = ELEMENT_SLOTS[node.getAttribute && node.getAttribute('id')];
    if (elementSlot) {
        out.push(`${pad}<${elementSlot.component} />`);
        usedSlots.add(elementSlot);
        return;
    }
    const slot = SLOTS[node.getAttribute && node.getAttribute('id')];
    if (slot) {
        const attrText2 = attrs.length ? ' ' + attrs.join(' ') : '';
        out.push(`${pad}<${tag}${attrText2}>`);
        out.push(`${pad}    <${slot.component} />`);
        out.push(`${pad}</${tag}>`);
        usedSlots.add(slot);
        return;
    }
    const children = Array.from(node.childNodes);
    const attrText = attrs.length ? ' ' + attrs.join(' ') : '';
    const oneLine = attrs.join(' ').length < 92;

    if (VOID.has(tag) || children.length === 0) {
        if (VOID.has(tag)) {
            if (oneLine) out.push(`${pad}<${tag}${attrText} />`);
            else { out.push(`${pad}<${tag}`); attrs.forEach((a) => out.push(`${pad}    ${a}`)); out.push(`${pad}/>`); }
        } else {
            if (oneLine) out.push(`${pad}<${tag}${attrText}></${tag}>`);
            else { out.push(`${pad}<${tag}`); attrs.forEach((a) => out.push(`${pad}    ${a}`)); out.push(`${pad}></${tag}>`); }
        }
        return;
    }

    const inlineText = children.length === 1 && children[0].nodeType === 3 && children[0].data.trim() && !children[0].data.includes('\n');
    if (inlineText && oneLine) {
        out.push(`${pad}<${tag}${attrText}>${escapeText(children[0].data.trim())}</${tag}>`);
        return;
    }

    if (oneLine) out.push(`${pad}<${tag}${attrText}>`);
    else { out.push(`${pad}<${tag}`); attrs.forEach((a) => out.push(`${pad}    ${a}`)); out.push(`${pad}>`); }
    for (const child of children) emitNode(child, indent + 1, out);
    out.push(`${pad}</${tag}>`);
}

function usesOnAct(node) {
    if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-act')) return true;
    return Array.from(node.childNodes || []).some(usesOnAct);
}

const usedSlots = new Set();
const generatedFiles = [];

function componentFile(name, nodes, note, actionsImport, slotPrefix) {
    usedSlots.clear();
    const out = [];
    const needsAct = nodes.some(usesOnAct);
    const lines = [];
    for (const n of nodes) emitNode(n, 2, lines);
    const header = [];
    if (needsAct) header.push(`import { onAct } from '${actionsImport || '../actions'}';`);
    for (const slot of usedSlots) header.push(`import { ${slot.component} } from '${slotPrefix || './'}${slot.from}';`);
    const body = lines.join('\n');
    out.push(header.join('\n'));
    if (header.length) out.push('');
    if (note) out.push(`/** ${note} */`);
    out.push(`export function ${name}() {`);
    out.push('    return (');
    if (nodes.length > 1) {
        out.push('        <>');
        out.push(body.split('\n').map((l) => '    ' + l).join('\n'));
        out.push('        </>');
    } else {
        out.push(body);
    }
    out.push('    );');
    out.push('}');
    return out.join('\n') + '\n';
}

/* ── ការបែងចែក component ─────────────────────────────────────────────── */
const body = doc.body;
const roots = Array.from(body.childNodes).filter((n) => n.nodeType === 1 && n.tagName.toLowerCase() !== 'script');

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'modals'), { recursive: true });

function pascal(id) { return id.charAt(0).toUpperCase() + id.slice(1); }

/** ឈ្មោះ component និងទីតាំងឯកសារ សម្រាប់ធាតុ root នីមួយៗ។ */
function planFor(el) {
    const id = el.getAttribute('id') || '';
    const cls = el.className || '';
    if (cls.split(/\s+/).includes('modal')) return { name: pascal(id), dir: 'modals', importFrom: `./modals/${pascal(id)}`, actions: '../../actions' };
    const NAMED = {
        bootSplash: 'BootSplash', appLockScreen: 'AppLockScreen', recentPhonesList: 'RecentPhonesDatalist',
        appPages: 'AppPages', pageTabBar: 'PageTabBar', drawerBackdrop: 'DrawerBackdrop',
        sideDrawer: 'SideDrawer', phoneSuggestBox: 'PhoneSuggestBox', globalMoreMenu: 'GlobalMoreMenu',
        toastContainer: 'ToastContainer', pdfExportPrintArea: 'PdfExportPrintArea'
    };
    if (NAMED[id]) return { name: NAMED[id], dir: '', importFrom: `./${NAMED[id]}`, actions: '../actions' };
    if (el.tagName.toLowerCase() === 'header') return { name: 'AppNavbar', dir: '', importFrom: './AppNavbar', actions: '../actions' };
    throw new Error('គ្មានផែនការសម្រាប់ធាតុ root ៖ <' + el.tagName + ' id="' + id + '" class="' + cls + '">');
}

const NOTES = {
    BootSplash: 'ផ្ទាំងបើក — `boot-flags.js` លាក់វាតាម id ដដែល',
    AppLockScreen: 'អេក្រង់ចាក់សោលើឧបករណ៍',
    RecentPhonesDatalist: '⛔ ត្រូវឈរនៅទីតាំងដដែលនឹង `index.html` ដើម',
    AppNavbar: 'របាខាងលើ — ⛔ មិនលាក់តាមទិសរមូរ',
    PageTabBar: 'របា Tab ខាងក្រោម',
    SideDrawer: 'របា Slide (ម៉ឺនុយ)',
    DrawerBackdrop: 'ផ្ទាំងខ្មៅពីក្រោយរបា Slide',
    PhoneSuggestBox: 'ប្រអប់ណែនាំលេខទូរស័ព្ទ (បំពេញដោយ `renderPhoneSuggestions`)',
    GlobalMoreMenu: 'ម៉ឺនុយ (...) សកល',
    ToastContainer: 'ម្ចាស់ផ្ទះរបស់ toast',
    PdfExportPrintArea: 'តំបន់បោះពុម្ពសម្រាប់ Export PDF'
};

const order = [];
for (const el of roots) {
    const plan = planFor(el);
    if (plan.name === 'AppPages') {
        const pageData = el.querySelector('#pageData');
        const pageEntry = el.querySelector('#pageEntry');
        fs.writeFileSync(path.join(OUT, 'PageData.tsx'), componentFile('PageData', [pageData], 'ទំព័រ ១ — ទិន្នន័យ', '../actions'));
        fs.writeFileSync(path.join(OUT, 'PageEntry.tsx'), componentFile('PageEntry', [pageEntry], 'ទំព័រ ២ — ស្កេន', '../actions'));
        generatedFiles.push(path.join(OUT, 'PageData.tsx'), path.join(OUT, 'PageEntry.tsx'));
        const attrs = emitAttrs(el).join(' ');
        fs.writeFileSync(path.join(OUT, 'AppPages.tsx'),
`import { PageData } from './PageData';
import { PageEntry } from './PageEntry';

/** កន្សោមរមូរខាងក្រៅតែមួយ (\`#appPages\`) — ⛔ PTR និង scroll-snap ពឹងលើវា។ */
export function AppPages() {
    return (
        <div ${attrs}>
            <PageData />
            <PageEntry />
        </div>
    );
}
`);
    } else {
        const file = path.join(OUT, plan.dir, plan.name + '.tsx');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        // ⛔ ផ្លូវ import របស់ slot ត្រូវ **ទាក់ទងនឹងថតរបស់ component**
        //    (`modals/` ជ្រៅមួយថ្នាក់) បើមិនដូច្នេះ build ធ្លាក់។
        fs.writeFileSync(file, componentFile(plan.name, [el], NOTES[plan.name] || null, plan.actions, plan.dir ? '../' : './'));
        generatedFiles.push(file);
    }
    order.push(plan);
}

/* សំបកដែលរៀបធាតុតាម **លំដាប់ដើមបេះបិទ** ៖ `style.css` ប្រើ z-index និង
 * selector បងប្អូន ➜ លំដាប់ក្នុងឯកសារជាផ្នែកនៃឥរិយាបថ មិនមែនរចនាប័ទ្ម។ */
const imports = order.map((p) => `import { ${p.name} } from '${p.importFrom}';`).join('\n');
fs.writeFileSync(path.join(OUT, 'AppShell.tsx'),
`${imports}

/**
 * ធាតុ root ទាំង ${order.length} តាម **លំដាប់ដដែលនឹង \`index.html\` ដើម**។
 * ⚠️ កើតដោយស្វ័យប្រវត្តិ (\`tools/html-to-jsx.cjs\`) — កុំរៀបឡើងវិញដោយដៃ។
 */
export function AppShell() {
    return (
        <>
${order.map((p) => `            <${p.name} />`).join('\n')}
        </>
    );
}
`);

/* ── ការសម្អាតធាតុដែល React ជាម្ចាស់ ────────────────────────────────
 * ⛔ កូដដែលផ្ទេរមក (ឧ. `clearSensitiveModalFields()` ពេលចាកចេញ) ធ្លាប់
 *    សម្អាតធាតុតាម `el.textContent = ''` ។ លើ slot របស់ React វាបំផ្លាញ
 *    ២ យ៉ាង ៖ (១) node របស់ React ត្រូវដកពីក្រោមវា ➜ ការគូរបន្ទាប់
 *    `removeChild` ធ្លាក់ ➜ **App ស**; (២) ទិន្នន័យអតិថិជននៅក្នុង store
 *    ➜ ការគូរបន្ទាប់ **នាំវាត្រឡប់មកវិញ** ក្រោយចាកចេញ។
 *    ដូច្នេះ slot នីមួយៗ **ត្រូវ** ប្រកាស `reset` (ការសម្អាតតាម store) ហើយ
 *    ឯកសារនេះផលិត `resetReactOwned(id)` ពីវា ➜ slot ថ្មីដែលភ្លេចប្រកាស
 *    ធ្វើឲ្យការផលិត **ធ្លាក់** មិនមែនបំផ្លាញស្ងាត់ៗ។ */
{
    const all = Object.entries(SLOTS).concat(Object.entries(ELEMENT_SLOTS));
    const missing = all.filter(([, v]) => !v.reset).map(([k]) => k);
    if (missing.length) {
        console.error('⛔ slot គ្មាន `reset` ៖ ' + missing.join(' · '));
        process.exit(1);
    }
    const cases = all.map(([id, v]) => `        case '${id}': ${v.reset} return true;`).join('\n');
    const out = `import { dataState, lookupState, uiState, ztoState } from '../core/state';
import { emptySheetImportView } from './components/sheet/model';

/**
 * ⛔ ឯកសារនេះ **ផលិតដោយ \`tools/html-to-jsx.cjs\`** — កុំកែដោយដៃ។
 *
 * ធាតុដែល React ជាម្ចាស់ ត្រូវសម្អាតតាម **store** មិនមែនតាម DOM ៖
 * \`el.textContent = ''\` ដកកូនរបស់ React ពីក្រោមវា ➜ ការគូរបន្ទាប់ធ្លាក់
 * (\`removeChild\`) ➜ App ស ហើយទិន្នន័យអតិថិជនដែលនៅក្នុង store ត្រឡប់មកវិញ។
 */
export const REACT_OWNED_IDS: readonly string[] = ${JSON.stringify(all.map(([id]) => id))};

function sheetPatch(patch: any) {
    uiState.sheetImportView = Object.assign({}, uiState.sheetImportView || emptySheetImportView(), patch);
}

function sheetMsgClear(id: string) {
    const msgs = Object.assign({}, (uiState.sheetImportView || emptySheetImportView()).msgs);
    msgs[id] = null;
    sheetPatch({ msgs: msgs });
}

function sheetMapClear(id: string) {
    const mapping = Object.assign({}, (uiState.sheetImportView || emptySheetImportView()).mapping);
    delete mapping[id];
    sheetPatch({ mapping: mapping });
}

/** សម្អាតធាតុតាម store បើ React ជាម្ចាស់វា ➜ \`true\`; បើមិនមែន ➜ \`false\` (អ្នកហៅសម្អាត DOM ខ្លួនឯង) */
export function resetReactOwned(id: string): boolean {
    switch (id) {
${cases}
    }
    return false;
}
`;
    fs.writeFileSync(path.join(OUT, '..', 'slot-resets.ts'), out);
    console.log('slot-resets.ts ៖', all.length, 'slot');
}

// ⛔ ធាតុដែលក្លាយជា «element slot» ៖ React គូរវា **ទាំងមូល** ➜ handler
//    រស់នៅក្នុង component នោះ មិនមែនក្នុងឯកសារដែលបង្កើតពី index.html ។
//    ការរាប់វាចូល នឹងធ្វើឲ្យអ្នកយាមធ្លាក់ដោយគ្មានកំហុសពិត ➜ តែការ
//    ដកវាចេញត្រូវ **ដេរីវេពី `ELEMENT_SLOTS` ពិត** មិនមែនលេខថេរ។
const slottedActs = Array.from(doc.querySelectorAll('[data-act]'))
    .filter((el) => ELEMENT_SLOTS[el.getAttribute('id')]);
for (const el of slottedActs) {
    const id = el.getAttribute('id');
    const file = path.join(OUT, ELEMENT_SLOTS[id].from + '.tsx');
    if (!fs.existsSync(file)) {
        console.error('⛔ element slot «' + id + '» គ្មានឯកសារ ៖ ' + file);
        process.exit(1);
    }
    // ⛔ ទិសផ្ទុយ ៖ component នោះត្រូវពិតជាកាន់ព្រឹត្តិការណ៍ជំនួស
    //    (បើអត់ ➜ ប៊ូតុងស្លាប់ស្ងាត់ៗ ខណៈអ្នកយាមបៃតង)។
    const body = fs.readFileSync(file, 'utf8');
    if (!/onChange=|onClick=|onInput=|onAct\(/.test(body)) {
        console.error('⛔ element slot «' + id + '» មិនកាន់ព្រឹត្តិការណ៍ណាសោះ ៖ ' + file);
        process.exit(1);
    }
}
const actEls = doc.querySelectorAll('[data-act]').length - slottedActs.length;
// ⛔ រាប់តែឯកសារ *ដែលបង្កើតពី index.html* — component ដែលសរសេរដោយដៃ
//    (ឧ. `history/HistoryRow.tsx`) មាន `onAct()` ផ្ទាល់ខ្លួន។
let handlerCount = 0;
for (const full of generatedFiles) {
    handlerCount += (fs.readFileSync(full, 'utf8').match(/onAct\(/g) || []).length;
}
console.log('root components:', order.length);
console.log('data-act ក្នុង index.html:', actEls, '➜ handler របស់ React:', handlerCount);
if (actEls !== handlerCount) {
    console.error('⛔ ចំនួនមិនស្មើគ្នា — សកម្មភាពខ្លះបាត់!');
    process.exit(1);
}
