'use strict';
const fs = require('fs');
const groups = require(require('path').join(__dirname, '..', 'src', '_generated-state.json'));

function tsType(init, _name) {
    const t = init.trim();
    if (/^\[\]$/.test(t)) return 'any[]';
    if (/^\{\}$/.test(t)) return 'Record<string, any>';
    if (/^new Map\(\)$/.test(t)) return 'Map<any, any>';
    if (/^new Set\(\)$/.test(t)) return 'Set<any>';
    if (/^(true|false)$/.test(t)) return 'boolean';
    if (/^-?\d+(\.\d+)?$/.test(t)) return 'number';
    if (/^'[^']*'$/.test(t) || /^"[^"]*"$/.test(t)) return 'string';
    return 'any';
}

/* វាលបន្ថែម ៖ ស្ពានរវាងកូដ imperative ដែលផ្ទេរមក និង component របស់ React។
 * ⛔ ពួកវា **មិនមែនជា state អាជីវកម្ម** ទេ — គ្រាន់តែជាការ *ផ្សាយ* នូវអ្វី
 *    ដែលមុននេះត្រូវសរសេរចូល `innerHTML` ដោយផ្ទាល់។ */
const EXTRA_STATE = {
    dataState: [
        { name: 'recentPhonesOptions', type: 'string[]', init: '[]',
          note: 'លេខទូរស័ព្ទសម្រាប់ `<datalist>` ➜ `RecentPhonesOptions` គូរ' }
    ],
    lookupState: [
        { name: 'customerTableView', type: 'any | null', init: 'null',
          note: 'តារាងអតិថិជន ➜ `CustomerTableBody` គូរ' }
    ],
    ztoState: [
        { name: 'ztoBannerView', type: 'any | null', init: 'null',
          note: 'របា «ZTO មិនទាន់បិទ» ➜ `ZtoSyncBanner` គូរ' },
        { name: 'ztoSyncListView', type: 'any | null', init: 'null',
          note: 'បញ្ជីក្នុងប្រអប់ ZTO ➜ `ZtoSyncList` គូរ' },
        { name: 'ztoListPreview', type: 'any | null', init: 'null',
          note: 'មើលជាមុននៃការទាញបញ្ជី ZTO ➜ `ZtoListSyncBody` គូរ' }
    ],
    uiState: [
        { name: 'historyView', type: 'any[] | null', init: 'null',
          note: 'បញ្ជីដែល `renderHistory()` ផ្សាយ ➜ `HistoryTableBody` គូរ' },
        { name: 'entryListView', type: 'any[] | null', init: 'null',
          note: 'ជួរដេកដែល `renderEntryList()` ផ្សាយ ➜ `EntryListTableBody` គូរ' },
        { name: 'lockerListView', type: 'any | null', init: 'null',
          note: 'ជួរដេកដែល `renderLockerList()` ផ្សាយ ➜ `LockerListTableBody` គូរ' },
        { name: 'trashSummary', type: 'any | null', init: 'null',
          note: 'តួលេខសរុបធុងសំរាម ➜ `TrashSummaryBox` គូរ' },
        { name: 'trashView', type: 'any | null', init: 'null',
          note: 'ជួរក្រុមធុងសំរាម ➜ `TrashTableBody` គូរ' },
        { name: 'monthlyReportView', type: 'any | null', init: 'null',
          note: 'របាយការណ៍ខែ ➜ `MonthlyReportBody` គូរ' },
        { name: 'dailyStatsView', type: 'any | null', init: 'null',
          note: 'កាតស្ថិតិប្រចាំថ្ងៃ ➜ `DailyStatsCards` គូរ' },
        { name: 'collectedStatsView', type: 'any | null', init: 'null',
          note: 'កាតចំណូលប្រចាំថ្ងៃ ➜ `CollectedStatsCards` គូរ' },
        { name: 'healthRows', type: "import('../app/components/health/model').HealthRow[] | null", init: 'null',
          note: 'ជួរពិនិត្យសុខភាព ➜ `HealthCheckList` គូរ' },
        { name: 'viewListView', type: 'any[] | null', init: 'null',
          note: 'បញ្ជី barcode ក្នុងប្រអប់ ➜ `BarcodeListContainer` គូរ' },
        { name: 'lockerGridView', type: 'any | null', init: 'null',
          note: 'ក្រឡា Locker ➜ `LockerGrid` គូរ' },
        { name: 'moreMenuItems', type: 'any[] | null', init: 'null',
          note: 'មាតិកាម៉ឺនុយ (...) ➜ `MoreMenuContent` គូរ' },
        { name: 'monthlyReportMonths', type: 'string[]', init: '[]',
          note: 'ខែដែលអាចជ្រើស ➜ `MonthlyReportMonthSelect` គូរ' },
        { name: 'lockerFilterOptions', type: 'string[]', init: '[]',
          note: 'ទីតាំងដែលអាចច្រោះ ➜ `LockerListFilterSelect` គូរ' },
        { name: 'lockerFilterValue', type: 'string', init: "''",
          note: 'តម្រងទីតាំងដែលជ្រើស (ជំនួសការអាន `select.value`)' },
        { name: 'pdfExportView', type: 'any | null', init: 'null',
          note: 'តារាងសម្រាប់បោះពុម្ព ➜ `PdfPrintArea` គូរ' },
        { name: 'toasts', type: 'any[]', init: '[]',
          note: 'បញ្ជី toast ➜ `ToastList` គូរ (បញ្ជីជំនួស DOM registry ចាស់)' },
        { name: 'updateBannerOpen', type: 'boolean', init: 'false',
          note: 'របា «មានកំណែថ្មី» ➜ `UpdateBanner` គូរ' },
        { name: 'sheetImportView', type: 'any | null', init: 'null',
          note: 'ស្ថានភាពប្រអប់នាំចូល Excel ➜ `SheetImport*` គូរ' }
    ]
};

const banner = `/* ⚠️ ឯកសារនេះ **កើតដោយស្វ័យប្រវត្តិ** — \`node tools/gen-state.cjs\`
 * ប្រភព ៖ អថេរ \`let\` កម្រិតកំពូលទាំង ១៧៦ របស់ ZoeW \`app.js\` ដើម។
 * ⛔ កុំកែដោយដៃ — កែផែនទីក្នុង \`tools/modules.cjs\` រួចបង្កើតឡើងវិញ។ */
import { createStore, registerStore } from './store';
import { appLocalStore, safeStoreGet } from './storage';
import { ACTIVE_LOCKER_KEY, ENTRY_SCAN_MODE_KEY } from './storage-keys';

void ACTIVE_LOCKER_KEY; void ENTRY_SCAN_MODE_KEY; void appLocalStore; void safeStoreGet;
`;

const parts = [banner];
for (const [store, fields] of Object.entries(groups)) {
    const iface = store[0].toUpperCase() + store.slice(1);
    const extra = EXTRA_STATE[store] || [];
    parts.push(`export interface ${iface} {`);
    for (const f of fields) parts.push(`    ${f.name}: ${tsType(f.init, f.name)};`);
    for (const f of extra) parts.push(`    /** ${f.note} */\n    ${f.name}: ${f.type};`);
    parts.push('}\n');
    parts.push(`export const ${store} = createStore<${iface}>('${store}', {`);
    for (const f of fields) {
        const init = f.init.includes('\n') ? f.init.replace(/\n/g, '\n    ') : f.init;
        parts.push(`    ${f.name}: ${init},`);
    }
    for (const f of extra) parts.push(`    ${f.name}: ${f.init},`);
    parts.push('});');
    parts.push(`registerStore(${store});\n`);
}
fs.writeFileSync(require('path').join(__dirname, '..', 'src', 'core', 'state.ts'), parts.join('\n') + '\n');
console.log('state.ts written:', Object.entries(groups).map(([k, v]) => k + '=' + v.length).join(' '));
