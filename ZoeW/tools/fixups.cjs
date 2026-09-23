'use strict';
/**
 * ការជួសជុល *type* ក្រោយ codemod។
 *
 * ⛔ ច្បាប់ ៖ រាល់ធាតុត្រូវជា **ការពិពណ៌នា type** មិនមែនការប្តូរឥរិយាបថ
 *    (cast · annotation · `?` · generic)។ បើធាតុណាមួយរកមិនឃើញ script នេះ
 *    **ធ្លាក់** — ការជួសជុលដែលរអិលចេញស្ងាត់ៗ គឺជាកំហុសដែលគ្មានអ្នកវាស់។
 */
const fs = require('fs');
const path = require('path');
const SRC = process.env.OUT_ROOT || path.join(__dirname, '..', 'src');

/** ការជំនួសទូទាំងឯកសារទាំងអស់ (លំនាំ JS ដដែលៗ)។ */
const GLOBAL_FIXUPS = [
    // ⛔ `load` អាចបាញ់រួចមុន React mount ➜ មើល `src/core/lifecycle.ts`
    ["window.addEventListener('load', ", 'runOnWindowLoad('],
    // TS រួមតូច `navigator.onLine` ជា literal ក្រោយការពិនិត្យមុន ➜ ការប្រៀបធៀប
    // ទី ២ ក្លាយជា «គ្មានត្រួតស៊ីគ្នា»។ Cast ស្តារ type ពិតរបស់ DOM វិញ។
    ['navigator.onLine === false', '(navigator.onLine as boolean) === false'],
    ['navigator.onLine !== false', '(navigator.onLine as boolean) !== false']
];

/** ការជួសជុលតាមឯកសារ ៖ [ឯកសារ, រក, ជំនួស] */
const FIXUPS = [
    // ── កំណែ ៖ ZoeW ជំនាន់ React + Vite (ដើម 2.37.3 ➜ 2.38.0) ──
    ['core/version.ts', "export const APP_VERSION = '2.37.3';", "export const APP_VERSION = '2.38.0';"],
    // ── 🩺 ពិនិត្យសុខភាព ៖ ជួរទាំង ៩ ត្រូវជា **model** (React គូរ) ──
    // ⛔ វាស់បាន (`parity-deep`) ៖ `runHealthCheck()` ត្រូវបម្លែងរួច តែអ្នកសាងជួរ
    //    នៅហៅ `healthRowHtml()` ដែលត្រឡប់ **ខ្សែអក្សរ HTML** ➜ ប្រអប់បង្ហាញ **ជួរទទេ ៩**។
    //    `healthRowHtml()` នៅរស់ជា **អ្នកសម្រេច** របស់ `tests/health-row-parity`។
    ['features/health-check.ts', 'return healthRowHtml(', 'return healthRow('],
    ['features/health-check.ts', '? healthRowHtml(', '? healthRow('],
    ['features/health-check.ts', ': healthRowHtml(', ': healthRow('],
    // ── ធាតុដែល React ជាម្ចាស់ មិនត្រូវសម្អាតតាម DOM (`scripts/slot-ownership-check.mjs`) ──
    // ⛔ ការណែនាំលេខ ៖ store ត្រូវបានសម្អាតរួច ➜ `box.textContent = ''` ដក node
    //    របស់ React ពីក្រោមវា ➜ ការគូរបន្ទាប់ `removeChild` ធ្លាក់ ➜ **App ស**
    //    (វាស់បាន `parity-deep` ៖ វាយក្នុងប្រអប់ស្វែងរក រួចសម្អាត)។
    ['features/phone-suggest.ts',
        "    box.classList.remove('show');\n    box.textContent = '';",
        "    box.classList.remove('show');"],
    ['features/sheet-import.ts',
        "    const chips = byId('siChips');\n    if (chips) chips.textContent = '';",
        "    patchSheetImportView({ chips: [] });"],
    // ⛔ ពេលចាកចេញ ៖ ធាតុរបស់ React សម្អាតតាម store (`resetReactOwned`) ➜ ទិន្នន័យ
    //    អតិថិជនចេញពី store ផង មិនមែនត្រឹមពី DOM (បើអត់ វាត្រឡប់មកវិញពេលគូរ)។
    ['features/session.ts',
        "    fieldsToBlank.forEach((id) => {\n        const el = byId(id);",
        "    fieldsToBlank.forEach((id) => {\n        if (resetReactOwned(id)) return;\n        const el = byId(id);"],
    // ── នាំចូល Excel ៖ ឈ្មោះ tab ➜ store (React គូរ `<option>`) ──
    ['features/sheet-import.ts',
        `        const sel = byId('siSheetSel');
        if (sel) {
            sel.textContent = '';
            names.forEach((name) => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
            });
        }`,
        "        patchSheetImportView({ sheetNames: names, sheetValue: names[0] || '' });"],
    // ⛔ tab ដែលជ្រើសអានចេញពី store មិនមែន `sel.value` ៖ React គូរ
    //    `<option>` ➜ ការអាន DOM អាចមកមុនការគូរ ➜ សន្លឹកទទេដោយស្ងាត់។
    ['features/sheet-import.ts',
        "    const sel = byId('siSheetSel');\n    const ws = sheetImportState.sheetImportWorkbook.Sheets[sel ? sel.value : ''];",
        "    const ws = sheetImportState.sheetImportWorkbook.Sheets[sheetImportViewNow().sheetValue];"],
    // ── ការសម្អាតវគ្គ ៖ ផ្ទៃទាំង ៦ រលត់ជាមួយគ្នា ──
    ['features/sheet-import.ts',
        `    ['siConfigSummary', 'siChips', 'siPreviewBody', 'siSheetSel', 'siStatusFoot'].forEach((id) => {
        const el = byId(id);
        if (el) el.textContent = '';
    });
    Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
        const sel = byId(SHEET_IMPORT_FIELD_SELECT_IDS[field]);
        if (sel) sel.textContent = '';
    });`,
        `    const foot = byId('siStatusFoot');
    if (foot) foot.textContent = '';
    uiState.sheetImportView = emptySheetImportView();`],
    // ── PTR ៖ React គូរធាតុ · កាយវិការកែវា (មើល `src/ui/ptr-indicator.ts`) ──
    ['ui/pull-to-refresh.ts',
        "    const indicator = document.createElement('div');\n    indicator.className = 'ptr-indicator';\n    indicator.innerHTML = '<div class=\"ptr-spinner\"></div>';\n    indicator.setAttribute('aria-hidden', 'true');\n    document.body.appendChild(indicator);",
        '    const indicator = ptrIndicatorElement();'],
    // ── អ្នកអានព្រឹត្តិការណ៍ ៖ `EventTarget` គ្មាន `.closest` / `.classList` ──
    ['boot/bootstrap-statements.ts',
        "if (e.target && e.target.closest && e.target.closest('#globalMoreMenu')) return;",
        "const scrolled = e.target as any;\n            if (scrolled && scrolled.closest && scrolled.closest('#globalMoreMenu')) return;"],
    ['boot/bootstrap-statements.ts',
        "if (e.target && e.target.classList && e.target.classList.contains('modal') && e.target.style.display === 'flex') {\n                dismissModal(e.target);",
        "const clicked = e.target as any;\n            if (clicked && clicked.classList && clicked.classList.contains('modal') && clicked.style.display === 'flex') {\n                dismissModal(clicked);"],
    ['boot/bootstrap-statements.ts',
        "Array.from(document.querySelectorAll('.modal')).filter(m => m.style.display === 'flex')",
        "Array.from(document.querySelectorAll('.modal')).filter((m: any) => m.style.display === 'flex')"],
    ['features/daily-stats.ts',
        "if (!uiState.isModalOpen && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A' && !isMobileDevice()) {",
        "const clickTarget = e.target as any;\n        if (!uiState.isModalOpen && clickTarget.tagName !== 'INPUT' && clickTarget.tagName !== 'TEXTAREA' && clickTarget.tagName !== 'SELECT' && clickTarget.tagName !== 'BUTTON' && clickTarget.tagName !== 'A' && !isMobileDevice()) {"],

    // ── វត្ថុដែលសាងទទេ រួចពង្រីកជាថាមវន្ត ──────────────────────────────
    ['core/timezone.ts', 'const parts = {};', 'const parts: any = {};'],
    ['features/config.ts', 'const config = {};', 'const config: any = {};'],
    ['features/lookup-config.ts', '    const cfg = {\n        enabled: enabled,', '    const cfg: any = {\n        enabled: enabled,'],
    ['features/biometric.ts', 'let ext = {};', 'let ext: any = {};'],
    ['features/sheet-import.ts', "const options = { type: 'array' };", "const options: any = { type: 'array' };"],
    ['features/sheet-import.ts', 'const mapping = currentSheetImportMapping();', 'const mapping: any = currentSheetImportMapping();'],
    ['features/scan-action.ts', 'let newItem = {\n            id: generateUniqueId(),', 'let newItem: any = {\n            id: generateUniqueId(),'],
    ['features/entry-ops.ts', 'const patchFields = { isCalled: true };', 'const patchFields: any = { isCalled: true };'],
    ['features/entry-ops.ts', 'const previousFields = { isCalled: item.isCalled };', 'const previousFields: any = { isCalled: item.isCalled };'],
    ['features/entry-ops.ts', 'const patchFields = { phone: newPhone };', 'const patchFields: any = { phone: newPhone };'],
    ['features/entry-ops.ts', 'const previousFields = { phone: prevPhone };', 'const previousFields: any = { phone: prevPhone };'],
    ['services/camera.ts', 'let settings = {};', 'let settings: any = {};'],

    // ── `Error` ដែលផ្ទុកវាលបន្ថែម (លំនាំ JS ធម្មតា) ────────────────────
    ['features/config.ts', "const err = new Error('MISSING');", "const err: any = new Error('MISSING');"],
    ['features/export.ts', 'const err = new Error(message);', 'const err: any = new Error(message);'],
    ['services/network.ts', "const notReadyErr = new Error('Firebase SDK failed to load (network/CDN issue)');",
        "const notReadyErr: any = new Error('Firebase SDK failed to load (network/CDN issue)');"],
    ['services/network.ts', "const error = new Error('HTTP ' + status);", "const error: any = new Error('HTTP ' + status);"],
    ['features/zto-list-sync.ts', "const missing = new Error('ZTO_LIST_NOT_CONFIGURED');", "const missing: any = new Error('ZTO_LIST_NOT_CONFIGURED');"],
    ['features/zto-list-sync.ts', "const err = new Error('ZTO_LIST_NOT_CONFIGURED');", "const err: any = new Error('ZTO_LIST_NOT_CONFIGURED');"],
    ['features/zto-list-sync.ts', "const err = new Error('ZTO_LIST_FAILED');", "const err: any = new Error('ZTO_LIST_FAILED');"],

    // ── WebAuthn PRF ៖ lib.dom មិនស្គាល់ extension ─────────────────────
    ['features/biometric.ts', 'const results = assertion && assertion.getClientExtensionResults();',
        'const results: any = assertion && (assertion as any).getClientExtensionResults();'],
    ['features/biometric.ts', 'const credentialId = bytesToB64(credential.rawId);',
        'const credentialId = bytesToB64((credential as any).rawId);'],
    ['features/biometric.ts', 'ext = credential.getClientExtensionResults() || {};',
        'ext = (credential as any).getClientExtensionResults() || {};'],

    // ── ចម្លើយបណ្តាញជាវត្ថុថាមវន្ត ────────────────────────────────────
    ['services/network.ts', 'export function fetchWithTimeout(url, options, ms, timeoutMsg, readBody?) {',
        'export function fetchWithTimeout(url, options, ms, timeoutMsg, readBody?): Promise<any> {'],
    ['services/network.ts', '    return function (...args) {\n        clearTimeout(timer);\n        timer = setTimeout(() => fn.apply(this, args), ms);',
        '    return function (this: any, ...args: any[]) {\n        clearTimeout(timer);\n        timer = setTimeout(() => fn.apply(this, args), ms);'],

    // ── `resolve()` គ្មានអាគុយម៉ង់ ➜ `Promise<void>` ─────────────────────
    ['features/auth.ts', '.map((d) => new Promise((resolve) => {', '.map((d) => new Promise<void>((resolve) => {'],
    ['features/export.ts', 'const pending = new Promise((resolve, reject) => {', 'const pending = new Promise<void>((resolve, reject) => {'],

    // ── ធាតុ DOM ដែល lib.dom ត្រឡប់ជា `Element` ────────────────────────
    ['services/firebase-sdk.ts', 'const el = modals[i];', 'const el = modals[i] as any;'],
    ['services/network.ts', ".some(l => l.href.replace(/\\/$/, '') === origin);", ".some((l: any) => l.href.replace(/\\/$/, '') === origin);"],
    ['services/network.ts', ".some(l => l.href.replace(/\\/$/, '') === dbOrigin);", ".some((l: any) => l.href.replace(/\\/$/, '') === dbOrigin);"],
    ['ui/modal.ts', "Array.from(document.querySelectorAll('.modal')).some(m => m.style.display === 'flex');",
        "Array.from(document.querySelectorAll('.modal')).some((m: any) => m.style.display === 'flex');"],
    ['features/app-lock.ts', 'const active = document.activeElement;', 'const active = document.activeElement as any;'],


    // ── ការហៅសកម្មភាព ៖ `window[name]` ➜ ចុះបញ្ជីច្បាស់លាស់ ──────────
    ['core/actions.ts',
        "    const fn = window[name];\n    if (typeof fn !== 'function') return;\n    fn.apply(null, readActionArgs(el, event));",
        "    const fn = lookupAction(name);\n    if (!fn) return;\n    fn.apply(null, readActionArgs(el, event));"],
    ['core/actions.ts',
        "    if (!name || ACTION_ALLOWLIST.indexOf(name) === -1) return;",
        "    if (!name || ACTION_ALLOWLIST.indexOf(name) === -1) return;"],
    ['ui/modal-stack.ts',
        "    if (fnName && typeof window[fnName] === 'function') {\n        window[fnName]();\n    } else {",
        "    const closer = fnName ? lookupAction(fnName) : null;\n    if (closer) {\n        closer();\n    } else {"],
    ['ui/history-render.ts', 'Array.from(tbody.children).forEach((tr) => {', 'Array.from(tbody.children).forEach((tr: any) => {'],
    ['ui/history-row.ts', 'let lockerLoc = ', 'let lockerLoc: any = '],

    // ── SVG `setAttribute` ទទួលតែ string ──────────────────────────────
    ['features/zto-status.ts', "rect.setAttribute('x', drawing.bars[i][0]);", "rect.setAttribute('x', String(drawing.bars[i][0]));"],
    ['features/zto-status.ts', "rect.setAttribute('width', drawing.bars[i][1]);", "rect.setAttribute('width', String(drawing.bars[i][1]));"],
    ['features/zto-status.ts', "rect.setAttribute('height', CODE128_HEIGHT);", "rect.setAttribute('height', String(CODE128_HEIGHT));"],

    // ── ផ្សេងៗ ─────────────────────────────────────────────────────────
    ['ui/pull-to-refresh.ts', "if ('scrollRestoration' in history) history.scrollRestoration = mode;",
        "if ('scrollRestoration' in history) history.scrollRestoration = mode as ScrollRestoration;"],
    ['services/crypto.ts', 'openLookupKeyDb().then((db) => {', 'openLookupKeyDb().then((db: any) => {'],
    ['services/crypto.ts', "if (!stored || typeof stored !== 'object' || stored.type !== 'secret') return false;",
        "if (!stored || typeof stored !== 'object' || (stored as any).type !== 'secret') return false;"],
    ['features/scan-action.ts', 'const dateString = getFormattedDate(currentTimeMillis);', 'const dateString = getFormattedDate(currentTimeMillis as any);'],

    // ⛔ `removeSingleBarcode` ត្រូវហៅដោយអាគុយម៉ង់ទី ៣ ដែល **មិនដែលអាន**
    //    ក្នុង app.js ដើម។ យើងសម្គាល់វាឲ្យច្បាស់ជំនួសការលុបកន្លែងហៅ ➜
    //    អត្ថបទកន្លែងហៅនៅដដែល ហើយចេតនាដើមមើលឃើញ។
    ['features/barcode-ops.ts', 'export async function removeSingleBarcode(itemId, barcodeCode) {',
        'export async function removeSingleBarcode(itemId, barcodeCode, _callSiteTag?: string) {']
];

/**
 * import ដែលអង្គជំនួស function ត្រូវការ។
 * ⛔ codemod មិនអាចដឹងឈ្មោះដែលកើតក្រោយវាទេ ➜ យើងពង្រីកបន្ទាត់ import
 *    ដែលមានស្រាប់ (ឬបន្ថែមថ្មី) ជំនួសការចាក់បន្ទាត់ស្ទួន។
 * ទម្រង់ ៖ [ឯកសារ, ម៉ូឌុលប្រភព, [ឈ្មោះ…]]
 */
const IMPORT_EXTEND = [
    ['features/stats-modals.ts', '../core/state', ['uiState']],
    ['features/health-check.ts', '../core/state', ['uiState']],
    ['features/barcode-ops.ts', '../core/timezone', ['formatScanStamp']],
    ['features/locker.ts', '../core/state', ['uiState']],
    ['ui/more-menu.ts', '../core/state', ['dataState', 'uiState']],
    ['features/zto-list-sync.ts', '../core/state', ['ztoState']],
    ['features/stats-modals.ts', './export', ['collectedMoneyText', 'collectedRielText']],
    ['features/stats-modals.ts', '../ui/modal-stack', ['buildCollectedCardItem', 'buildStatCardItem']],
    ['ui/modal-stack.ts', '../features/export', ['collectedMoneyText', 'collectedRielText']],
    ['ui/modal-stack.ts', '../core/state', ['dataState']]
];

/** import ដែលត្រូវបន្ថែម (បង្កើតដោយការជួសជុលខាងលើ)។ */
const SI_PATCH = `function patchSheetImportView(patch) {
    uiState.sheetImportView = Object.assign({}, uiState.sheetImportView || emptySheetImportView(), patch);
}

function sheetImportViewNow(): any {
    return uiState.sheetImportView || emptySheetImportView();
}
`;

const TOAST_PRELUDE = `import { uiState } from '../core/state';

// ── ស្ថានភាព toast ៖ បញ្ជីរស់នៅ «uiState.toasts» · timer រស់នៅទីនេះ ──
// ⛔ timer **មិនមែន** ស្ថានភាពគូរ ➜ វាមិនត្រូវចូល store (ការដាក់វាចូល
//    នឹងធ្វើឲ្យរាល់ setTimeout កេះការគូរឡើងវិញដោយឥតប្រយោជន៍)។
let toastSeq = 0;
const toastTimers = new Map();

/** ទទួលទាំង id និងវត្ថុធាតុ ➜ ត្រឡប់ធាតុ **រស់** ក្នុងបញ្ជី (ឬ null) */
function toastItem(ref): any {
    if (ref === null || ref === undefined) return null;
    const id = typeof ref === 'object' ? (ref as any).id : ref;
    const list = uiState.toasts;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
}

function clearToastTimer(id) {
    const t = toastTimers.get(id);
    if (t) { clearTimeout(t); toastTimers.delete(id); }
}

function removeToastItem(id) {
    clearToastTimer(id);
    const next = uiState.toasts.filter((t) => t.id !== id);
    if (next.length === uiState.toasts.length) return;
    uiState.toasts = next;
}
`;

const IMPORT_FIXUPS = [
    ['features/session.ts', "import { resetReactOwned } from '../app/slot-resets';"],
    ['ui/more-menu.ts', "import { renderNow } from '../app/flush';"],
    ['ui/boot-splash.ts', "import { uiState } from '../core/state';"],
    ['features/sheet-import.ts', "import { uiState } from '../core/state';\nimport { emptySheetImportView } from '../app/components/sheet/model';\n" + SI_PATCH],
    ['ui/toast.ts', TOAST_PRELUDE],
    ['ui/pull-to-refresh.ts', "import { ptrIndicatorElement } from './ptr-indicator';"],
    ['core/actions.ts', "import { lookupAction } from './action-registry';"],
    ['boot/bootstrap-statements.ts', "import { runOnWindowLoad } from '../core/lifecycle';"],
    ['ui/history-render.ts', "import { uiState } from '../core/state';"],
    ['features/trash.ts', "import { buildTrashRowModel, buildTrashSummaryModel } from '../app/components/trash/model';"],
    ['features/health-check.ts', "import { healthPendingRow, healthRow } from '../app/components/health/model';"],
    ['features/export.ts', "import { renderNow } from '../app/flush';"],
    ['features/monthly-report.ts', "import { renderNow } from '../app/flush';"],
    ['features/zto-list-sync.ts', "import { ztoListGroupModel } from '../app/components/zto/model';"],
    ['ui/modal-stack.ts', "import { lookupAction } from '../core/action-registry';"]
];

/**
 * ជំនួស function ទាំងមូល (មិនមែនត្រឹមបន្ទាត់)។
 * ប្រើពេលការគូរប្តូរម្ចាស់ពីកូដ imperative ➜ component របស់ React។
 */
const ENTRY_LIST = `export function renderEntryList() {
    const tbody = byId('entryListTableBody');
    const emptyState = byId('entryListEmptyState');
    const countEl = byId('entryListCount');
    if (!tbody) return;

    const searchInput = byId('entryListSearchInput');
    const search = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const searchDigits = normalizePhoneDigits(search);
    const todayStr = getFormattedDate(new Date(getServerNow()));

    let rows = dataState.scanHistory.filter((it) => it && it.scanDate === todayStr);
    if (search) {
        rows = rows.filter((it) => {
            const phone = sanitizePhoneNumber(it.phone || '');
            if (searchDigits && normalizePhoneDigits(phone).indexOf(searchDigits) !== -1) return true;
            const codes = Array.isArray(it.barcodes) && it.barcodes.length
                ? it.barcodes.map((b) => String((b && b.code) || ''))
                : [String(it.barcode || '')];
            return codes.some((c) => c.toLowerCase().includes(search));
        });
    }
    rows = rows.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (countEl) countEl.innerText = String(rows.length);

    if (!rows.length) {
        uiState.entryListView = [];
        uiState.touch();
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    // ➜ \`EntryListTableBody\` (React) គូរជួរដេក
    uiState.entryListView = rows.slice(0, ENTRY_LIST_MAX_ROWS).map((it, i) => {
        const codes = Array.isArray(it.barcodes) && it.barcodes.length
            ? it.barcodes.map((b) => String((b && b.code) || ''))
            : [String(it.barcode || '')];
        const shown = codes.filter(Boolean);
        const total = Math.round(((parseFloat(it.cod) || 0) + (parseFloat(it.dod) || 0)) * 100) / 100;
        return {
            n: i + 1,
            phone: sanitizePhoneNumber(it.phone || ''),
            time: it.time || '',
            codeText: shown.length > 1 ? shown[0] + ' +' + (shown.length - 1) : (shown[0] || '-'),
            total: total.toFixed(2)
        };
    });
    uiState.touch();
}`;

const TRASH_SUMMARY = `export function renderTrashSummary(groups, query) {
    // ➜ \`TrashSummaryBox\` (React) គូរ។ រូបមន្តរស់ក្នុង \`buildTrashSummaryModel()\`
    //   ដែលដេរីវេ ២ ក្រុមពី \`TRASH_REASON_META[r].deducted\` ដដែល។
    uiState.trashSummary = buildTrashSummaryModel(groups, query);
    uiState.touch();
}`;

const TRASH_LIST = `export function renderRecentlyDeleted() {
    const query = String(uiState.deletedSearchQuery || '').trim().toLowerCase();
    const allGroups = buildTrashGroups(dataState.deletedItems);
    const groups = query ? allGroups.filter((group) => trashGroupMatchesQuery(group, query)) : allGroups;
    renderTrashSummary(groups, query);

    const liveKeys = new Set(allGroups.map((group) => group.key));
    Array.from(expandedTrashGroups).forEach((key) => { if (!liveKeys.has(key)) expandedTrashGroups.delete(key); });

    if (groups.length === 0) {
        uiState.trashView = {
            empty: query
                ? 'រកមិនឃើញលេខ ឬ Barcode នេះក្នុងធុងសំរាមទេ'
                : emptyViewMessage([DB_LISTENER_KEY_DELETED], 'គ្មានទិន្នន័យដែលបានលុបទេ'),
            rows: [],
            overflow: 0
        };
        uiState.touch();
        return;
    }

    uiState.trashView = {
        empty: null,
        rows: groups.slice(0, DELETED_LIST_MAX_ROWS).map((group) => buildTrashRowModel(group, expandedTrashGroups)),
        overflow: Math.max(0, groups.length - DELETED_LIST_MAX_ROWS)
    };
    uiState.touch();
}`;

const MONTHLY_REPORT = `export function renderMonthlyReport() {
    const body = byId('monthlyReportBody');
    if (!body) return;
    // ⛔ តម្លៃមកពីឃ្លាំង មិនមែនពី DOM (មើល \`MonthlyReportMonthSelect\`)
    const report = buildMonthlyReport(uiState.monthlyReportMonth);
    if (!report.month || !report.days.length) {
        uiState.monthlyReportView = { empty: emptyViewMessage(STATS_DAILY_VIEW_KEYS, 'គ្មានទិន្នន័យសម្រាប់ខែនេះទេ'), tiles: [], mismatch: null, headers: [], rows: [] };
        uiState.touch();
        return;
    }
    const totals = report.totals;
    const measurable = totals.collectedMeasurable;
    // ⛔ លំដាប់ និងអត្ថបទរបស់កាតត្រូវនៅដដែល — \`monthly-report\` ចាក់សោវា។
    const tiles = [
        { tone: 'money-collected', label: '💵 ចំណូលសរុប (យករួច)', value: collectedMoneyText(totals.collectedTotal, measurable), sub: collectedRielText(totals.collectedTotal, measurable) },
        { tone: 'money-collected', label: 'COD (យករួច)', value: collectedMoneyText(totals.collectedCod, measurable), sub: collectedRielText(totals.collectedCod, measurable) },
        { tone: 'money-collected', label: 'DOD (យករួច)', value: collectedMoneyText(totals.collectedDod, measurable), sub: collectedRielText(totals.collectedDod, measurable) },
        { tone: '', label: 'កញ្ចប់ចូល', value: totals.count.toLocaleString(), sub: 'ថ្ងៃមានប្រតិបត្តិការ ' + totals.activeDays.toLocaleString() },
        { tone: '', label: 'កញ្ចប់យករួច', value: totals.picked.toLocaleString(), sub: totals.pickupRate === null ? 'អត្រាយក —' : 'អត្រាយក ' + totals.pickupRate.toFixed(1) + '%' },
        { tone: '', label: 'អតិថិជនយក', value: totals.customers.toLocaleString(), sub: 'បូកតាមថ្ងៃ' },
        {
            tone: 'money-total',
            label: '📦 តម្លៃកញ្ចប់ទាំងអស់',
            value: '$' + totals.total.toFixed(2),
            sub: monthlyReportRiel(totals.total).toLocaleString() + ' ៛',
            pending: 'មិនទាន់យក ' + collectedMoneyText(totals.pendingTotal, measurable)
        }
    ];
    uiState.monthlyReportView = {
        empty: null,
        tiles: tiles,
        mismatch: (report.mismatch && report.ledger)
            ? { cod: report.ledger.cod.toFixed(2), dod: report.ledger.dod.toFixed(2), count: report.ledger.count.toLocaleString() }
            : null,
        headers: MONTHLY_REPORT_HEADERS,
        rows: report.days.map((d) => ({
            date: d.date,
            count: d.count.toLocaleString(),
            collectedCod: collectedMoneyText(d.collectedCod, measurable),
            collectedDod: collectedMoneyText(d.collectedDod, measurable),
            collectedTotal: collectedMoneyText(d.collectedTotal, measurable),
            pendingTotal: collectedMoneyText(d.pendingTotal, measurable),
            total: d.total.toFixed(2),
            picked: d.picked.toLocaleString(),
            customers: d.customers.toLocaleString()
        }))
    };
    uiState.touch();
}`;

const DAILY_STATS = `export function openDailyStatsModal() {
    const container = byId('dailyStatsContainer');
    if(!container) return;

    let sortedKeys = Object.keys(dataState.dailyRevenueData).sort().reverse();
    const uncollectedMap = uncollectedValueByDate();
    const measurable = collectedValueIsMeasurable();

    if (sortedKeys.length === 0) {
        uiState.dailyStatsView = { empty: emptyViewMessage(STATS_DAILY_VIEW_KEYS, 'គ្មានទិន្នន័យប្រចាំថ្ងៃទេ'), cards: [] };
    } else {
        uiState.dailyStatsView = {
            empty: null,
            // ⛔ \`collectedValueOf()\` ត្រូវហៅ **ក្នុងមួយថ្ងៃ** — កម្រិតបូក
            //   ជាការសម្រេចរបស់កន្លែងហៅ (មើលច្បាប់ «ជាន់ទី ៣ ៖ កម្រិតបូក»)។
            cards: sortedKeys.map((dateStr) => {
                const data = dataState.dailyRevenueData[dateStr] || {};
                return buildStatCardItem('ថ្ងៃទី', dateStr,
                    statsMoney(data.codDollar), statsMoney(data.dodDollar), statsCount(data.totalCount),
                    collectedValueOf(data.codDollar, data.dodDollar, uncollectedMap[dateStr]), measurable);
            })
        };
    }
    uiState.touch();

    openModalHelper('dailyStatsModal');
}`;

const COLLECTED_STATS = `export function openCollectedStatsModal() {
    const container = byId('collectedStatsContainer');
    if (!container) return;

    const days = Object.keys(dataState.dailyCollectedData || {})
        .filter((day) => DAILY_COLLECTED_DAY_PATTERN.test(day))
        .sort().reverse()
        .slice(0, DAILY_COLLECTED_KEEP_DAYS);

    if (!days.length) {
        uiState.collectedStatsView = { empty: emptyViewMessage(STATS_COLLECTED_VIEW_KEYS, 'មិនទាន់មានកញ្ចប់ណាបិទ «យក» ក្នុង ៧ ថ្ងៃចុងក្រោយទេ'), cards: [] };
    } else {
        uiState.collectedStatsView = {
            empty: null,
            cards: days.map((day) => buildCollectedCardItem(day, collectedTotalsOfDay(dataState.dailyCollectedData[day])))
        };
    }
    uiState.touch();

    openModalHelper('collectedStatsModal');
}`;

const CUSTOMER_TABLE = `export function filterCustomerDataTable() {
    const body = byId('customerDataTableBody');
    if (!body) return;
    const rows = lookupState.customerDataTableRows || [];
    const searchInput = byId('customerDataTableSearchInput');
    const q = (searchInput ? searchInput.value.trim().toLowerCase() : '');

    const filtered = q ? rows.filter((r) =>
        String(r.barcode || '').toLowerCase().indexOf(q) !== -1 ||
        String(r.phone || '').toLowerCase().indexOf(q) !== -1 ||
        String(r.cod || '').indexOf(q) !== -1 ||
        String(r.dod || '').indexOf(q) !== -1
    ) : rows;

    if (filtered.length === 0) {
        lookupState.customerTableView = { empty: rows.length === 0 ? 'មិនទាន់មានទិន្នន័យ' : 'រកមិនឃើញ', rows: [], overflow: 0 };
        lookupState.touch();
        return;
    }

    const maxRender = 500;
    lookupState.customerTableView = {
        empty: null,
        rows: filtered.slice(0, maxRender).map((r) => ({
            barcode: String(r.barcode == null ? '' : r.barcode),
            dod: Number(r.dod || 0).toFixed(2),
            cod: Number(r.cod || 0).toFixed(2),
            phone: String(r.phone == null ? '' : r.phone)
        })),
        overflow: Math.max(0, filtered.length - maxRender)
    };
    lookupState.touch();
}`;

const HEALTH_CHECK = `export async function runHealthCheck() {
    const btn = byId('healthRecheckBtn');
    if (btn) btn.disabled = true;
    // ⛔ ជួរ «កំពុងពិនិត្យ…» ដូចដើមបេះបិទ ៖ រូប ⏳ · គ្មាន .health-detail
    uiState.healthRows = [healthPendingRow()];
    uiState.touch();
    const rows = [healthNetworkRow(), healthDatabaseRow(), healthClockRow(), healthStorageRow(), healthServiceWorkerRow(), healthCustomerTableRow(), healthSheetScriptRow()];
    const [licenseRow, lookupRow] = await Promise.all([healthLicenseRow(), healthLookupRow()]);
    rows.splice(3, 0, licenseRow);
    rows.push(lookupRow);
    // ⛔ លទ្ធផលយឺតមិនត្រូវគូរពេលប្រអប់បិទរួច (ច្បាប់ «ម្ចាស់ប្រអប់»)
    const stillOpen = byId('healthCheckModal');
    if (!stillOpen || stillOpen.style.display !== 'flex') return;
    uiState.healthRows = rows;
    uiState.touch();
    if (btn) btn.disabled = false;
}`;

const VIEW_LIST = `export function openViewListModal(id?) {
    uiState.activeParentItemId = id;
    const item = dataState.scanHistory.find(i => i.id === id);
    if (!item) return;

    const listModalPhoneText = byId('listModalPhoneText');
    if(listModalPhoneText) listModalPhoneText.innerText = item.phone;

    ensureBarcodeArrayForItem(item);

    uiState.viewListView = item.barcodes.map((b, idx) => {
        const itemCod = parseFloat(b.cod) || 0;
        const itemDod = parseFloat(b.dod) || 0;
        const isBcClosed = b.isClosed || false;
        const bcMoneyClass = isBcClosed ? 'money-collected' : 'money-pending';
        const bcCodRiel = Math.round(itemCod * dataState.exchangeRateRiel);
        const bcDodRiel = Math.round(itemDod * dataState.exchangeRateRiel);
        const hasCod = itemCod > 0;
        const hasDod = itemDod > 0;
        // ⛔ សាខាទាំង ៣ ដដែល ៖ COD+DOD ➜ ២ បន្ទាត់ បូកសរុប; DOD តែឯង ➜
        //   បន្ទាត់ DOD; ករណីផ្សេង ➜ បន្ទាត់ COD (រួម ០.០០)។
        const money = [];
        let sum = null;
        if (hasCod && hasDod) {
            money.push({ cls: bcMoneyClass, kindDod: false, label: 'COD', dollars: itemCod.toFixed(2), riel: bcCodRiel.toLocaleString() });
            money.push({ cls: bcMoneyClass, kindDod: true, label: 'DOD', dollars: itemDod.toFixed(2), riel: bcDodRiel.toLocaleString() });
            sum = { cls: bcMoneyClass, dollars: (Math.round((itemCod + itemDod) * 100) / 100).toFixed(2), riel: (bcCodRiel + bcDodRiel).toLocaleString() };
        } else if (hasDod) {
            money.push({ cls: bcMoneyClass, kindDod: true, label: 'DOD', dollars: itemDod.toFixed(2), riel: bcDodRiel.toLocaleString() });
        } else {
            money.push({ cls: bcMoneyClass, kindDod: false, label: 'COD', dollars: itemCod.toFixed(2), riel: bcCodRiel.toLocaleString() });
        }
        return {
            itemId: item.id,
            code: b.code,
            index: idx + 1,
            locker: b.locker || 'N/A',
            time: b.time ? formatScanStamp(b.time) : null,
            moneyClass: bcMoneyClass,
            money: money,
            sum: sum,
            closed: isBcClosed
        };
    });
    uiState.touch();

    openModalHelper('viewListModal');
}`;

const LOCKER_GRID = `export function renderLockerGrid() {
    const prefix = getLockerPrefix();
    const count = Math.min(LOCKER_COUNT_MAX, getLockerCount());
    const cells = [];
    for (let i = 1; i <= count; i++) cells.push(prefix + i);
    uiState.lockerGridView = { cells: cells, active: uiState.activeLocker };
    uiState.touch();
}`;

const MORE_MENU = `export function showGlobalMoreMenu(btn, event, items) {
    if (event) event.stopPropagation();
    const rect = btn.getBoundingClientRect();
    const menu = byId('globalMoreMenu');
    const container = byId('menuContentContainer');
    if(!menu || !container) return;
    uiState.moreMenuItems = items;
    uiState.touch();
    // ⛔ \`positionMenuSafely()\` **វាស់** ទទឹង/កម្ពស់របស់ម៉ឺនុយ ដើម្បីកុំ
    //    ឲ្យវាហៀរក្រៅអេក្រង់ ➜ ការវាស់មុនធាតុចុះ ផ្តល់ទំហំ **0** ➜ គ្មាន
    //    ការទាញចូលវិញ ➜ ម៉ឺនុយហៀរ។ វាស់បាន (parity:live) ៖ left 245px
    //    ធៀបនឹង 137px លើអេក្រង់ទូរស័ព្ទ ➜ ធាតុខាងក្នុងចុចមិនដល់។
    renderNow(uiState);
    menu.classList.add('show');
    positionMenuSafely(menu, rect);
}`;

const HEADER_MENU = `export function toggleHeaderMoreDropdown(btn?, event?) {
    showGlobalMoreMenu(btn, event, [
        { label: '📤 Export Data', action: 'moreMenuExport' },
        { label: '📈 របាយការណ៍អាជីវកម្មប្រចាំខែ', action: 'moreMenuMonthlyReport' },
        { label: '✏️ កែទឹកប្រាក់/កញ្ចប់', action: 'moreMenuManualAdjust' },
        { label: '💱 អត្រាប្រាក់ (' + dataState.exchangeRateRiel + '៛)', action: 'moreMenuExchangeRate' },
        { label: '🗑️ ធុងសំរាម', action: 'moreMenuRecentlyDeleted' },
        { label: '♻️ Reset ចំនួនយករួច (' + getCurrentFilterLabel() + ')', action: 'moreMenuResetPickup' },
        { label: '❌ លុបទាំងអស់', action: 'moreMenuClearHistory', cls: 'delete-opt' }
    ]);
}`;

const ROW_MENU = `export function toggleMoreDropdown(btn?, event?, id?) {
    const item = dataState.scanHistory.find(i => i.id === id);
    const items = [];
    // ⛔ «កែតម្លៃកញ្ចប់» លេចតែពេលមាន barcode ពិត (ដូចដើម)
    if (item && item.barcodes && item.barcodes.length > 0) {
        items.push({ label: '💵 កែតម្លៃកញ្ចប់', action: 'moreMenuViewList', args: [id] });
    }
    items.push({ label: '✏️ កែលេខទូរស័ព្ទ', action: 'moreMenuEditPhone', args: [id] });
    items.push({ label: '🗑️ លុប', action: 'moreMenuDelete', args: [id], cls: 'delete-opt' });
    showGlobalMoreMenu(btn, event, items);
}`;

const PHONE_SUGGEST = `export function renderPhoneSuggestions(matches) {
    // ➜ \`PhoneSuggestList\` (React) គូរ។ ស្ថានភាពសកម្មនៅជា index ក្នុងឃ្លាំង
    //   ➜ \`setPhoneSuggestActive()\` នៅដើរដដែល។
    uiState.phoneSuggestItems = matches;
    uiState.phoneSuggestActiveIndex = -1;
    uiState.touch();
}`;

const RECENT_PHONES = `export function updateRecentPhonesList() {
    const entries = collectPhoneSuggestions('', RECENT_PHONES_MAX);
    const signature = entries.map(entry => entry.phone).join('\\u0001');
    if (dataState.recentPhonesSignature !== null && signature === dataState.recentPhonesSignature) return;
    dataState.recentPhonesSignature = signature;
    dataState.recentPhonesOptions = entries.map((entry) => entry.phone);
    dataState.touch();
}`;

const ZTO_BANNER = `export function renderZtoSyncBanner(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    const banner = byId('ztoSyncBanner');
    if (!banner) return;
    const pending = ztoStatusPendingCodes(dataToScan, trashToScan);
    const codes = pending.length && ztoStatusFeatureConfig() ? pending : [];
    const waiting = codes.length ? ztoStatusUnmeasuredCount(dataToScan, trashToScan) : 0;
    const stale = anyDbListenerViewIsStale(ZTO_SYNC_VIEW_KEYS);
    // ⛔ ភាពមិនពេញ (\`waiting\` · \`stale\`) ត្រូវចូល signature ➜ បើមិនដូច្នេះ
    //   cache បង្កកអត្ថបទចាស់ពេល listener ងាប់ *ក្រោយ*។
    const signature = codes.length + '|' + waiting + '|' + (stale ? '1' : '0') + '|'
        + codes.slice(0, ZTO_STATUS_BANNER_CODES).join(',');
    if (signature === ztoState.ztoStatusBannerSig) return;
    ztoState.ztoStatusBannerSig = signature;
    if (!codes.length) {
        banner.classList.add('hidden');
        ztoState.ztoBannerView = null;
        ztoState.touch();
        return;
    }
    const more = codes.length > ZTO_STATUS_BANNER_CODES
        ? ' · និង ' + (codes.length - ZTO_STATUS_BANNER_CODES) + ' ទៀត' : '';
    const waitingNote = waiting ? ' · កំពុងពិនិត្យបន្ត ' + waiting + ' ទៀត' : '';
    const staleNote = stale ? ' · ' + VIEW_NOT_MEASURABLE_TEXT : '';
    ztoState.ztoBannerView = {
        headline: codes.length + ' កញ្ចប់បិទក្នុង ZoeW តែ ZTO មិនទាន់បិទ',
        detail: codes.slice(0, ZTO_STATUS_BANNER_CODES).join(' · ') + more + waitingNote
            + staleNote + ' — ចុចដើម្បីពិនិត្យម្តងទៀត'
    };
    ztoState.touch();
    banner.classList.remove('hidden');
}`;

const ZTO_MODAL_LIST = `export function renderZtoSyncModalList(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    const noteEl = byId('ztoSyncModalNote');
    const entries = ztoStatusFeatureConfig()
        ? ztoStatusPendingList(dataToScan, trashToScan) : [];
    const waiting = ztoStatusUnmeasuredCount(dataToScan, trashToScan);
    const stale = anyDbListenerViewIsStale(ZTO_SYNC_VIEW_KEYS);
    const signature = waiting + '|' + (stale ? '1' : '0') + '|'
        + entries.map((entry) => entry.code + '~' + entry.phone + '~' + entry.locker).join(',');
    if (signature === ztoState.ztoStatusModalSig) return;
    ztoState.ztoStatusModalSig = signature;
    if (noteEl) {
        const waitingNote = waiting ? ' កំពុងពិនិត្យបន្ត ' + waiting + ' ទៀត។' : '';
        noteEl.innerText = entries.length
            ? 'ស្កេនលេខខាងក្រោមចូល ZTO Palm ដើម្បីបិទ។' + waitingNote
                + (stale ? ' ' + VIEW_NOT_MEASURABLE_NOTICE : '')
            : emptyViewMessage(ZTO_SYNC_VIEW_KEYS, 'កញ្ចប់ដែលពិនិត្យរួច ត្រូវគ្នានឹង ZTO ទាំងអស់។') + waitingNote;
    }
    ztoState.ztoSyncListView = entries.length
        ? { empty: null, entries: entries }
        : { empty: emptyViewMessage(ZTO_SYNC_VIEW_KEYS, '✅ គ្មានកញ្ចប់ណាដែល ZTO មិនទាន់បិទទេ'), entries: [] };
    ztoState.touch();
}`;

const ZTO_LIST_PREVIEW = `export function renderZtoListSyncPreview() {
    const result = ztoState.ztoListSyncResult;
    if (!result) {
        ztoState.ztoListPreview = { empty: 'ជ្រើសជួរកាលបរិច្ឆេទ រួចចុច «📥 ទាញបញ្ជី» ដើម្បីមើលកញ្ចប់ពី ZTO។', groups: [] };
        ztoState.touch();
        return;
    }
    const groups = classifyZtoListRows(result.rows, dataState.scanHistory, dataState.deletedItems);
    const stale = anyDbListenerViewIsStale(ZTO_SYNC_VIEW_KEYS);
    const freshTitle = stale ? '🆕 ថ្មី ➜ ' + VIEW_NOT_MEASURABLE_TEXT : '🆕 ថ្មី (មិនទាន់មានក្នុង ZoeW)';
    const existingTitle = stale ? '✅ មានក្នុង ZoeW រួច ➜ ' + VIEW_NOT_MEASURABLE_TEXT : '✅ មានក្នុង ZoeW រួច';
    ztoState.ztoListPreview = {
        empty: null,
        groups: [
            ztoListGroupModel(freshTitle, groups.fresh, 'zto-list-fresh'),
            ztoListGroupModel(existingTitle, groups.existing, 'zto-list-existing'),
            ztoListGroupModel('♻️ ស្ទួនក្នុងបញ្ជី ZTO', groups.duplicate, 'zto-list-dup'),
            ztoListGroupModel('⏭️ រំលង (មិនបញ្ចូល)', groups.skipped, 'zto-list-skip')
        ]
    };
    ztoState.touch();
    const truncated = result.truncated
        ? ' · ⚠️ បញ្ជីវែងជាង ' + ZTO_LIST_CLIENT_MAX_PAGES + ' ទំព័រ ➜ សូមបំបែកជួរកាលបរិច្ឆេទ'
        : '';
    setZtoListSyncNote('ZTO រាយ ' + result.total + ' ជួរដេក · ទាញបាន ' + result.rows.length
        + ' · ' + result.from + ' ➜ ' + result.to + truncated
        + (stale ? ' · ' + VIEW_NOT_MEASURABLE_NOTICE : '')
        + ' — ⛔ ជុំនេះជាការមើលជាមុន ៖ គ្មានអ្វីត្រូវបញ្ចូលទេ។');
}`;

/* ── កន្លែងសម្អាត ៖ container ដែល React កាន់ ត្រូវសម្អាតតាម *ឃ្លាំង*
 *    មិនមែនតាម `innerHTML` (បើមិនដូច្នេះ React គូរវាមកវិញ)។ ──────────── */
const CLEAR_FIXUPS = [
    ['features/session.ts',
        "    const ztoSyncBannerEl = byId('ztoSyncBanner');\n    if (ztoSyncBannerEl) {\n        ztoSyncBannerEl.innerHTML = '';\n        ztoSyncBannerEl.classList.add('hidden');\n    }\n    const ztoSyncListEl = byId('ztoSyncList');\n    if (ztoSyncListEl) ztoSyncListEl.innerHTML = '';",
        "    const ztoSyncBannerEl = byId('ztoSyncBanner');\n    if (ztoSyncBannerEl) ztoSyncBannerEl.classList.add('hidden');\n    ztoState.ztoBannerView = null;\n    ztoState.ztoSyncListView = null;"],
    ['features/session.ts',
        "    const ztoListBodyEl = byId('ztoListSyncBody');\n    if (ztoListBodyEl) ztoListBodyEl.innerHTML = '';",
        "    ztoState.ztoListPreview = null;"],
    ['features/customer-table.ts',
        "    const body = byId('customerDataTableBody');\n    if (body) body.innerHTML = '';",
        "    lookupState.customerTableView = null;"],
    ['features/session.ts',
        "    const lockerListFilter = byId('lockerListFilter');\n    if (lockerListFilter) lockerListFilter.innerHTML = '<option value=\"\">ទីតាំងទាំងអស់</option>';\n    const monthlyReportMonthSel = byId('monthlyReportMonthSel');\n    if (monthlyReportMonthSel) monthlyReportMonthSel.innerHTML = '';",
        "    uiState.lockerFilterOptions = [];\n    uiState.lockerFilterValue = '';\n    uiState.monthlyReportMonths = [];"]
];

const LOCKER_LIST_V2 = `export function renderLockerList() {
    const tbody = byId('lockerListTableBody');
    const emptyState = byId('lockerListEmptyState');
    if (!tbody) return;

    const searchInput = byId('lockerListSearchInput');
    const search = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const allLockers = new Set();
    let assigned = [];
    dataState.scanHistory.forEach((it) => {
        if (!it) return;
        const lockers = getItemLockerSummary(it);
        if (!lockers.length) return;
        lockers.forEach((l) => allLockers.add(l));
        assigned.push({ item: it, lockers: lockers, ts: getItemLatestLockerTs(it) });
    });

    // ➜ \`LockerListFilterSelect\` (React) គូរជម្រើស។ ⛔ តម្លៃដែលជ្រើស
    //   រស់ក្នុងឃ្លាំង ➜ ការអាន \`select.value\` (ដែលអាចមកមុនការគូរ) បាត់ទៅ។
    const options = Array.from(allLockers).map(String).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    uiState.lockerFilterOptions = options;
    // ⛔ ទីតាំងដែលលែងមាន ➜ តម្រងត្រូវរលត់ (ដូច browser ធ្វើពេល option បាត់)
    if (uiState.lockerFilterValue && options.indexOf(uiState.lockerFilterValue) === -1) uiState.lockerFilterValue = '';
    const lockerFilter = uiState.lockerFilterValue;

    const searchDigits = normalizePhoneDigits(search);
    if (search) {
        assigned = assigned.filter((row) => {
            const phone = sanitizePhoneNumber(row.item.phone || '');
            if (!searchDigits) return phone.toLowerCase().includes(search);
            return normalizePhoneDigits(phone).indexOf(searchDigits) !== -1;
        });
    }
    if (lockerFilter) assigned = assigned.filter((row) => row.lockers.indexOf(lockerFilter) !== -1);

    assigned.sort((a, b) => b.ts - a.ts);

    if (!assigned.length) {
        uiState.lockerListView = { rows: [], overflow: 0 };
        uiState.touch();
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    uiState.lockerListView = {
        rows: assigned.slice(0, LOCKER_LIST_MAX_ROWS).map((row, i) => ({
            n: i + 1,
            phone: sanitizePhoneNumber(row.item.phone || ''),
            lockerText: row.lockers.length > 1
                ? row.lockers.join(', ') + ' (' + row.lockers.length + ' កន្លែង)'
                : (row.lockers[0] || '')
        })),
        overflow: Math.max(0, assigned.length - LOCKER_LIST_MAX_ROWS)
    };
    uiState.touch();
}`;

const MONTHLY_MODAL = `export function openMonthlyReportModal() {
    const months = monthlyReportAvailableMonths();
    const currentMonth = getZoneDateKey(getServerNow(), 0).substring(0, 7);
    if (months.indexOf(currentMonth) === -1) months.unshift(currentMonth);
    if (months.indexOf(uiState.monthlyReportMonth) === -1) uiState.monthlyReportMonth = months[0] || currentMonth;
    // ➜ \`MonthlyReportMonthSelect\` (React) គូរជម្រើស និងកាន់តម្លៃ
    uiState.monthlyReportMonths = months;
    uiState.touch();
    openModalHelper('monthlyReportModal');
    renderMonthlyReport();
}`;

const PDF_RESTORE = `export function restoreAfterPdfExport() {
    if (uiState.pdfExportOriginalTitle !== null) {
        document.title = uiState.pdfExportOriginalTitle;
        uiState.pdfExportOriginalTitle = null;
    }
    uiState.pdfExportView = null;
    uiState.touch();
}`;

const PDF_HISTORY = `export function exportDataAsPDF() {
    const rows = buildExportRows();
    if (!rows.length) { showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, "⚠️ គ្មានទិន្នន័យសម្រាប់ Export ទេ!")); return; }
    closeModal('exportDataModal');

    const printArea = byId('pdfExportPrintArea');
    if (!printArea) { showToast("❌ Export PDF បរាជ័យ!"); return; }

    const totalCod = Math.round(rows.reduce((sum, r) => sum + r.cod, 0) * 100) / 100;
    const totalDod = Math.round(rows.reduce((sum, r) => sum + r.dod, 0) * 100) / 100;
    const totalAll = Math.round((totalCod + totalDod) * 100) / 100;

    uiState.pdfExportView = {
        title: 'ZoeW — របាយការណ៍ប្រវត្តិកញ្ចប់ (' + getCurrentFilterLabel() + ')',
        headers: EXPORT_HEADERS,
        rows: rows.map((r) => [String(r.no), r.phone, r.barcode, r.locker,
            r.cod.toFixed(2), r.dod.toFixed(2), r.total.toFixed(2), r.status, r.scanDate, r.time]),
        totalRow: {
            cells: ['សរុប (' + rows.length + ' កញ្ចប់)', totalCod.toFixed(2), totalDod.toFixed(2), totalAll.toFixed(2), ''],
            spans: [4, undefined, undefined, undefined, 3]
        },
        footer: 'នាំចេញនៅ ' + (getZoneDateKey(getServerNow(), 0) + ' ' + getFormattedClockTime(getServerNow()))
    };
    // ⛔ \`window.print()\` អានDOM ភ្លាមៗ ➜ ការគូរត្រូវចប់ **មុន** វា
    renderNow(uiState);

    if (uiState.pdfExportOriginalTitle === null) uiState.pdfExportOriginalTitle = document.title;
    document.title = getExportFilenameBase();
    window.addEventListener('afterprint', restoreAfterPdfExport);
    noteAppLockExcuse();
    window.print();
}`;

const PDF_MONTHLY = `export function exportMonthlyReportAsPDF() {
    const report = buildMonthlyReport(uiState.monthlyReportMonth);
    if (!report.days.length) { showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, "⚠️ គ្មានទិន្នន័យសម្រាប់ខែនេះទេ!")); return; }
    closeModal('monthlyReportModal');
    const printArea = byId('pdfExportPrintArea');
    if (!printArea) { showToast("❌ Export PDF បរាជ័យ!"); return; }
    const totals = report.totals;
    const measurable = totals.collectedMeasurable;
    uiState.pdfExportView = {
        title: 'ZoeW — របាយការណ៍អាជីវកម្មប្រចាំខែ ' + report.month,
        headers: MONTHLY_REPORT_HEADERS,
        rows: report.days.map((d) => [d.date, d.count.toLocaleString(),
            collectedMoneyText(d.collectedCod, measurable), collectedMoneyText(d.collectedDod, measurable),
            collectedMoneyText(d.collectedTotal, measurable), collectedMoneyText(d.pendingTotal, measurable),
            d.total.toFixed(2), d.picked.toLocaleString(), d.customers.toLocaleString()]),
        totalRow: {
            cells: ['សរុប', totals.count.toLocaleString(),
                collectedMoneyText(totals.collectedCod, measurable), collectedMoneyText(totals.collectedDod, measurable),
                collectedMoneyText(totals.collectedTotal, measurable), collectedMoneyText(totals.pendingTotal, measurable),
                totals.total.toFixed(2), totals.picked.toLocaleString(), totals.customers.toLocaleString()]
        },
        footer: \`ចំណូលសរុប (យករួច) \${collectedMoneyText(totals.collectedTotal, measurable)}
                / \${collectedRielText(totals.collectedTotal, measurable)} (អត្រា \${dataState.exchangeRateRiel.toLocaleString()} ៛)
                · តម្លៃកញ្ចប់ទាំងអស់ $\${totals.total.toFixed(2)}
                · ថ្ងៃមានប្រតិបត្តិការ \${totals.activeDays.toLocaleString()}
                · នាំចេញនៅ \${getZoneDateKey(getServerNow(), 0) + ' ' + getFormattedClockTime(getServerNow())}\`
    };
    renderNow(uiState);
    if (uiState.pdfExportOriginalTitle === null) uiState.pdfExportOriginalTitle = document.title;
    document.title = monthlyReportFilenameBase();
    window.addEventListener('afterprint', restoreAfterPdfExport);
    noteAppLockExcuse();
    window.print();
}`;

const STAT_CARD = `export function buildStatCardItem(label, key, cod, dod, count, collectedValue, measurable) {
    // ⛔ ឥឡូវវាត្រឡប់ **model** — React គូរ (\`DailyStatsCards\`)។ រូបមន្ត
    //   នៅដដែល ៖ \`collectedValue\` ត្រូវគណនារួចដោយកន្លែងហៅ (កម្រិតបូក
    //   ជាការសម្រេចរបស់កន្លែងហៅ) ហើយ \`pending\` clamp ត្រឹម ០។
    const totalD = Math.round((cod + dod) * 100) / 100;
    const collected = (collectedValue && typeof collectedValue === 'object')
        ? collectedValue : { cod: 0, dod: 0, total: 0 };
    const pending = Math.round(Math.max(0, totalD - collected.total) * 100) / 100;
    return {
        label: label,
        key: key,
        count: count,
        codText: collectedMoneyText(collected.cod, measurable),
        dodText: collectedMoneyText(collected.dod, measurable),
        collectedText: collectedMoneyText(collected.total, measurable),
        collectedRielText: collectedRielText(collected.total, measurable),
        totalText: totalD.toFixed(2),
        pendingText: collectedMoneyText(pending, measurable)
    };
}`;

const COLLECTED_CARD = `export function buildCollectedCardItem(day, totals) {
    const sums = (totals && typeof totals === 'object')
        ? totals : { cod: 0, dod: 0, total: 0, count: 0 };
    return {
        day: day,
        count: sums.count,
        cod: sums.cod.toFixed(2),
        dod: sums.dod.toFixed(2),
        total: sums.total.toFixed(2),
        riel: Math.round(sums.total * dataState.exchangeRateRiel).toLocaleString()
    };
}`;


// ── toast ៖ React គូរបញ្ជី · ម៉ូឌុលនេះកាន់ *ស្ថានភាព* មិនមែន *ធាតុ* ──
//
// ⛔ ច្បាប់ដើម «ការចុះឈ្មោះ toast រស់នៅ **ក្នុង DOM**» កើតពីហេតុផលពិត ៖
//    កន្លែងហៅកាន់ **ធាតុ** រួចហុចវាត្រឡប់ចូល helper វិញ។ ការវាស់បង្ហាញថា
//    **គ្មានកន្លែងហៅណាក្រៅ `toast.ts` អានតម្លៃត្រឡប់សោះ** ➜ អត្តសញ្ញាណ
//    អាចផ្លាស់ពី *ធាតុ DOM* ទៅ *កូនសោក្នុងបញ្ជី* ដោយមិនបាត់ការធានា ៖
//    `dropOldestToast()` នៅតែរំលង toast ដែលរស់ · `armToastDismiss()` នៅតែ
//    លុប timer ចាស់ · ពិដាន ៤ នៅដដែល។
const TOAST_PAINT = `export function paintToast(el, msg, kind) {
    const item = toastItem(el);
    if (!item) return;
    item.kind = TOAST_CLASSES[kind] ? kind : toastKindOf(msg);
    item.msg = msg;
    uiState.touch();
}`;

const TOAST_ARM = `export function armToastDismiss(el, delay) {
    const item = toastItem(el);
    if (!item) return;
    clearToastTimer(item.id);
    toastTimers.set(item.id, setTimeout(() => {
        toastTimers.delete(item.id);
        const live = toastItem(item.id);
        if (!live) return;
        live.show = false;
        uiState.touch();
        // ⛔ ៣០០ ms ដដែលនឹងដើម ៖ វាជារយៈពេលនៃ transition ក្នុង \`style.css\`
        //    ➜ ការដកធាតុមុននោះ លុបចលនាបាត់។
        setTimeout(() => removeToastItem(item.id), 300);
    }, delay));
}`;

const TOAST_DROP = `export function dropOldestToast(_container?) {
    const list = uiState.toasts;
    let victim = null;
    for (let i = 0; i < list.length; i++) {
        if (list[i].live !== null) continue;
        victim = list[i];
        break;
    }
    if (!victim) victim = list[0];
    if (!victim) return;
    clearToastTimer(victim.id);
    removeToastItem(victim.id);
}`;

const TOAST_SHOW = `export function showToast(msg, kind?) {
    while (uiState.toasts.length >= 4) dropOldestToast();
    const id = ++toastSeq;
    uiState.toasts = uiState.toasts.concat([{
        id: id,
        msg: msg,
        kind: TOAST_CLASSES[kind] ? kind : toastKindOf(msg),
        show: false,
        live: null
    }]);
    // ⛔ ស៊ុមបន្ទាប់ទើបដាក់ \`.show\` — ដូច \`appendChild\` រួច \`rAF\`
    //    របស់ដើម ៖ ធាតុត្រូវចុះក្នុង DOM **មុន** class ចលនាចូល បើមិនដូច្នេះ
    //    browser មិនដំណើរការ transition ទេ។
    requestAnimationFrame(() => {
        const item = toastItem(id);
        if (!item) return;
        item.show = true;
        uiState.touch();
    });
    armToastDismiss(id, TOAST_LIFETIME_MS);
    return id;
}`;

const TOAST_SETTLE = `export function settleLiveToast(el) {
    const item = toastItem(el);
    if (!item) return;
    item.live = null;
    uiState.touch();
    armToastDismiss(item.id, TOAST_LIFETIME_MS);
}`;

const TOAST_REANNOUNCE = `export function reannounceOrShowToast(msg) {
    const list = uiState.toasts;
    for (let i = 0; i < list.length; i++) {
        if (list[i].msg !== msg) continue;
        list[i].show = true;
        uiState.touch();
        armToastDismiss(list[i].id, TOAST_LIFETIME_MS);
        return list[i].id;
    }
    return showToast(msg);
}`;

const TOAST_LIVE = `export function showLiveToast(key) {
    const state = liveToastState(key);
    if (!state) return null;
    const id = showToast(state.msg, state.kind);
    if (id === null || state.settled) return id;
    const item = toastItem(id);
    if (item) { item.live = key; uiState.touch(); }
    armToastDismiss(id, TOAST_LIVE_LIMIT_MS);
    return id;
}`;

const TOAST_REFRESH = `export function refreshLiveToasts() {
    const live = uiState.toasts.filter((t) => t.live !== null);
    for (let i = 0; i < live.length; i++) {
        const el = live[i];
        const state = liveToastState(el.live);
        if (!state) { settleLiveToast(el.id); continue; }
        paintToast(el.id, state.msg, state.kind);
        if (state.settled) settleLiveToast(el.id);
    }
}`;


// ── នាំចូល Excel ៖ ផ្ទៃទាំង ៦ ផ្សាយចូល «uiState.sheetImportView» ──
// ⛔ ផ្ទៃទាំងនោះ (សារ · សង្ខេប · tab · ការផ្គូផ្គង · chip · មើលជាមុន)
//    ដេរីវេពីទិន្នន័យតែមួយ ➜ វត្ថុ state តែមួយ។ ការបំបែកជា ៦ បង្កើត
//    លំដាប់គូរ ៦ ដែលអាចឃ្លាតគ្នា។
const SI_MSG = `export function setSheetImportMsg(hostId, text, kind?) {
    const msgs = Object.assign({}, sheetImportViewNow().msgs);
    msgs[hostId] = text ? { text: text, kind: kind || 'warn' } : null;
    patchSheetImportView({ msgs: msgs });
}`;

const SI_SUMMARY = `export function showSheetImportConfigSummary() {
    showSheetImportPart('siConfigForm', false);
    showSheetImportPart('siConfigSummary', true);
    showSheetImportPart('siConfigEditRow', true);
    showSheetImportPart('siFileCard', true);
    showSheetImportPart('siClearCard', true);
    patchSheetImportView({ summary: { url: maskSheetImportUrl(sheetImportState.sheetImportUrl) } });
}`;

const SI_FILL = `export function fillSheetImportMappingSelects() {
    const options = sheetImportState.sheetImportHeaders.map((header, idx) => ({
        value: String(idx),
        label: sheetImportColumnLetter(idx) + ' · ' + (header || '(ទទេ)')
    }));
    const mapping = Object.assign({}, sheetImportViewNow().mapping);
    Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
        const id = SHEET_IMPORT_FIELD_SELECT_IDS[field];
        // ⛔ តម្លៃដែលជ្រើសរួចត្រូវរក្សា — ដើមធ្វើតាម \\\`previous\\\` ដដែល។
        const prev = mapping[id] ? mapping[id].value : '-1';
        mapping[id] = { options: options, value: prev, filled: true };
    });
    patchSheetImportView({ mapping: mapping });
}`;

const SI_APPLY = `export function applySheetImportMapping(mapping) {
    const next = Object.assign({}, sheetImportViewNow().mapping);
    Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
        const id = SHEET_IMPORT_FIELD_SELECT_IDS[field];
        const value = mapping && typeof mapping[field] === 'number' ? mapping[field] : -1;
        next[id] = Object.assign({}, next[id] || { options: [], filled: false }, { value: String(value) });
    });
    patchSheetImportView({ mapping: next });
}`;

const SI_CURRENT = `export function currentSheetImportMapping() {
    const view = sheetImportViewNow();
    const mapping = {};
    Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
        const cfg = view.mapping[SHEET_IMPORT_FIELD_SELECT_IDS[field]];
        const parsed = parseInt(cfg ? cfg.value : '-1', 10);
        mapping[field] = isNaN(parsed) ? -1 : parsed;
    });
    return mapping;
}`;

const SI_CHIP = `export function addSheetImportChip(host, text, kind) {
    host.push({ text: text, kind: kind });
}`;

const SI_PREVIEW = `export function renderSheetImportPreview() {
    const importBtn = byId('siImportBtn');
    const rows = sheetImportMappedRows();
    const usable = rows.filter((r) => r[0] !== '');
    const seen = Object.create(null);
    let duplicates = 0;
    usable.forEach((r) => {
        const key = r[0].toUpperCase();
        if (seen[key]) duplicates++;
        seen[key] = true;
    });
    const chips = [];
    addSheetImportChip(chips, 'ជួរដេកក្នុងឯកសារ ' + rows.length, '');
    addSheetImportChip(chips, 'មាន Barcode ' + usable.length, usable.length ? 'ok' : 'bad');
    if (rows.length - usable.length > 0) addSheetImportChip(chips, 'រំលង ' + (rows.length - usable.length), 'warn');
    if (duplicates) addSheetImportChip(chips, 'ស្ទួនក្នុងឯកសារ ' + duplicates, 'warn');
    patchSheetImportView({
        chips: chips,
        previewRows: usable.slice(0, SHEET_IMPORT_PREVIEW_ROWS).map((r) => [r[0], r[1].toFixed(2), r[2].toFixed(2), r[3]])
    });
    showSheetImportPart('siPreviewWrap', usable.length > 0);
    if (importBtn) importBtn.disabled = usable.length === 0;
}`;

const UPDATE_BANNER = `export function showUpdateAvailableBanner() {
    // ⛔ ច្រកទ្វារ idempotent ដើមគឺវត្តមាននៃធាតុ \`#zoeUpdateBanner\` ➜ ទង់
    //    នេះជំនួសវា **ទិសទាំង ២** ៖ ហៅ ២ ដង ➜ របា ១; ចុច ✕ ➜ ការហៅ
    //    បន្ទាប់បង្ហាញវិញ។
    if (uiState.updateBannerOpen) return;
    uiState.updateBannerOpen = true;
}`;

const FUNCTION_REPLACEMENTS = [
    ['ui/boot-splash.ts', 'showUpdateAvailableBanner', UPDATE_BANNER],
    ['features/sheet-import.ts', 'setSheetImportMsg', SI_MSG],
    ['features/sheet-import.ts', 'showSheetImportConfigSummary', SI_SUMMARY],
    ['features/sheet-import.ts', 'fillSheetImportMappingSelects', SI_FILL],
    ['features/sheet-import.ts', 'applySheetImportMapping', SI_APPLY],
    ['features/sheet-import.ts', 'currentSheetImportMapping', SI_CURRENT],
    ['features/sheet-import.ts', 'addSheetImportChip', SI_CHIP],
    ['features/sheet-import.ts', 'renderSheetImportPreview', SI_PREVIEW],
    ['ui/toast.ts', 'paintToast', TOAST_PAINT],
    ['ui/toast.ts', 'armToastDismiss', TOAST_ARM],
    ['ui/toast.ts', 'dropOldestToast', TOAST_DROP],
    ['ui/toast.ts', 'showToast', TOAST_SHOW],
    ['ui/toast.ts', 'settleLiveToast', TOAST_SETTLE],
    ['ui/toast.ts', 'reannounceOrShowToast', TOAST_REANNOUNCE],
    ['ui/toast.ts', 'showLiveToast', TOAST_LIVE],
    ['ui/toast.ts', 'refreshLiveToasts', TOAST_REFRESH],
    ['ui/modal-stack.ts', 'buildStatCardItem', STAT_CARD],
    ['ui/modal-stack.ts', 'buildCollectedCardItem', COLLECTED_CARD],
    ['features/export.ts', 'restoreAfterPdfExport', PDF_RESTORE],
    ['features/export.ts', 'exportDataAsPDF', PDF_HISTORY],
    ['features/monthly-report.ts', 'exportMonthlyReportAsPDF', PDF_MONTHLY],
    ['ui/entry-list.ts', 'renderLockerList', LOCKER_LIST_V2],
    ['features/monthly-report.ts', 'openMonthlyReportModal', MONTHLY_MODAL],
    ['features/customer-table.ts', 'filterCustomerDataTable', CUSTOMER_TABLE],
    ['features/health-check.ts', 'runHealthCheck', HEALTH_CHECK],
    ['features/barcode-ops.ts', 'openViewListModal', VIEW_LIST],
    ['features/locker.ts', 'renderLockerGrid', LOCKER_GRID],
    ['ui/more-menu.ts', 'showGlobalMoreMenu', MORE_MENU],
    ['ui/more-menu.ts', 'toggleHeaderMoreDropdown', HEADER_MENU],
    ['ui/more-menu.ts', 'toggleMoreDropdown', ROW_MENU],
    ['features/phone-suggest.ts', 'renderPhoneSuggestions', PHONE_SUGGEST],
    ['services/db-listeners.ts', 'updateRecentPhonesList', RECENT_PHONES],
    ['features/zto-status.ts', 'renderZtoSyncBanner', ZTO_BANNER],
    ['features/zto-status.ts', 'renderZtoSyncModalList', ZTO_MODAL_LIST],
    ['features/zto-list-sync.ts', 'renderZtoListSyncPreview', ZTO_LIST_PREVIEW],
    ['features/stats-modals.ts', 'openDailyStatsModal', DAILY_STATS],
    ['features/stats-modals.ts', 'openCollectedStatsModal', COLLECTED_STATS],
    ['features/monthly-report.ts', 'renderMonthlyReport', MONTHLY_REPORT],
    ['features/trash.ts', 'renderTrashSummary', TRASH_SUMMARY],
    ['features/trash.ts', 'renderRecentlyDeleted', TRASH_LIST],
    ['ui/entry-list.ts', 'renderEntryList', ENTRY_LIST],
    ['ui/history-render.ts', 'renderHistory', `export function renderHistory(dataToRender = dataState.scanHistory) {
    const tbody = byId('historyTableBody');
    const countSpan = byId('count');
    if (!tbody || !countSpan) return;
    countSpan.innerText = dataToRender.length;

    // ➜ \`HistoryTableBody\` (React) ជាអ្នកគូរជួរដេកឥឡូវនេះ។
    //   \`touch()\` ចាំបាច់ព្រោះកន្លែងហៅជាច្រើនកែ *វត្ថុខាងក្នុង* ដោយ
    //   មិនប្តូរ reference នៃ array ➜ Proxy មើលមិនឃើញ។
    uiState.historyView = dataToRender;
    uiState.touch();

    // ⛔ ផ្លូវចេញមុនត្រូវរក្សា **ដូចដើមបេះបិទ** ៖ បញ្ជីទទេ ➜ ជុំបោស ZTO
    //   មិនរត់ (បើរត់ វានឹងបាញ់សំណើលើអេក្រង់ទទេ)។
    if (dataToRender.length === 0) return;

    renderZtoSyncViews();
    scheduleZtoStatusSweep();
}`]
];

let applied = 0;
// ⛔ អ្នកយាម ៖ `FUNCTION_REPLACEMENTS` ២ ដែលចង្អុលទៅ **function តែមួយ**
//    មិនធ្លាក់ទេ — ធាតុចុងក្រោយសរសេរជាន់មុន **ដោយស្ងាត់** ➜ ការកែថ្មី
//    បាត់ទាំងស្រុង ខណៈកុងសូលរាយ «applied: N / N»។ វាកើតឡើងពិត ៖
//    `renderLockerList` មាន `LOCKER_LIST` និង `LOCKER_LIST_V2` ➜ ជំនាន់ចាស់
//    ឈ្នះ ➜ `<select>` នៅសរសេរ `innerHTML` ដដែល។
{
    const pairs = new Map();
    for (const [file, name] of FUNCTION_REPLACEMENTS) {
        const key = file + '::' + name;
        if (pairs.has(key)) {
            console.error('❌ FUNCTION_REPLACEMENTS ស្ទួន ៖ ' + key + ' — ធាតុក្រោយនឹងសរសេរជាន់ធាតុមុន');
            process.exit(1);
        }
        pairs.set(key, true);
    }
}

const missing = [];
const seen = new Map();
function read(full) { return seen.has(full) ? seen.get(full) : fs.readFileSync(full, 'utf8'); }

function walkFiles(dir, out = []) {
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walkFiles(full, out);
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

const GLOBAL_FIXUP_EXCLUDE = new Set([path.join(SRC, 'core/lifecycle.ts')]);
for (const full of walkFiles(SRC)) {
    if (GLOBAL_FIXUP_EXCLUDE.has(full)) continue;
    let text = read(full);
    let changed = false;
    for (const [find, replace] of GLOBAL_FIXUPS) {
        if (text.includes(find)) { text = text.split(find).join(replace); changed = true; }
    }
    if (changed) seen.set(full, text);
}

for (const [file, find, replace] of FIXUPS) {
    const full = path.join(SRC, file);
    let text = read(full);
    if (!text.includes(find)) {
        if (text.includes(replace)) { applied++; continue; }   // អនុវត្តរួចហើយ (idempotent)
        missing.push(file + ' :: ' + find.split('\n')[0].slice(0, 72));
        continue;
    }
    seen.set(full, text.split(find).join(replace));
    applied++;
}

/** រកព្រំដែនរបស់ function ដែល export តាមការផ្គូផ្គងវង់ក្រចក។ */
function replaceFunction(text, name, replacement) {
    // function អាចជា `export function` ឬ `export async function`
    let at = text.indexOf('export function ' + name + '(');
    if (at === -1) at = text.indexOf('export async function ' + name + '(');
    if (at === -1) return null;
    let i = text.indexOf('{', at);
    if (i === -1) return null;
    let depth = 0;
    let inStr = null;
    let inTemplate = 0;
    for (; i < text.length; i++) {
        const c = text[i];
        const prev = text[i - 1];
        if (inStr) { if (c === inStr && prev !== '\\') inStr = null; continue; }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '`') { inTemplate = inTemplate ? 0 : 1; continue; }
        if (inTemplate) continue;
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return text.slice(0, at) + replacement + text.slice(i);
}

for (const [file, name, replacement] of FUNCTION_REPLACEMENTS) {
    const full = path.join(SRC, file);
    const text = read(full);
    if (text.includes(replacement)) { applied++; continue; }
    const next = replaceFunction(text, name, replacement);
    if (!next) { missing.push(file + ' :: function ' + name); continue; }
    seen.set(full, next);
    applied++;
}

for (const [file, find, replace] of CLEAR_FIXUPS) {
    const full = path.join(SRC, file);
    const text = read(full);
    if (text.includes(replace)) { applied++; continue; }
    if (!text.includes(find)) { missing.push(file + ' :: ការសម្អាត — ' + find.split('\n')[0].slice(0, 60)); continue; }
    seen.set(full, text.split(find).join(replace));
    applied++;
}

for (const [file, from, names] of IMPORT_EXTEND) {
    const full = path.join(SRC, file);
    let text = read(full);
    const re = new RegExp(`^import \\{([^}]*)\\} from '${from.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}';$`, 'm');
    const m = text.match(re);
    if (m) {
        const have = m[1].split(',').map((x) => x.trim()).filter(Boolean);
        const merged = [...new Set([...have, ...names])].sort();
        if (merged.length === have.length) continue;          // មានគ្រប់ហើយ
        text = text.replace(re, `import { ${merged.join(', ')} } from '${from}';`);
    } else {
        text = `import { ${[...names].sort().join(', ')} } from '${from}';\n` + text;
    }
    seen.set(full, text);
}

for (const [file, line] of IMPORT_FIXUPS) {
    const full = path.join(SRC, file);
    let text = read(full);
    if (text.includes(line)) continue;
    seen.set(full, line + '\n' + text);
}

for (const [full, text] of seen) fs.writeFileSync(full, text);
console.log('fixups applied:', applied, '/', FIXUPS.length + FUNCTION_REPLACEMENTS.length + CLEAR_FIXUPS.length, '(+', GLOBAL_FIXUPS.length, 'global)');
if (missing.length) {
    console.error('⛔ រកមិនឃើញ ' + missing.length + ' ធាតុ ៖');
    missing.forEach((m) => console.error('   - ' + m));
    process.exit(1);
}
