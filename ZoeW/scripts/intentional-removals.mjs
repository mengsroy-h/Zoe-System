/**
 * អ្វីពី ZoeW ដើមដែល **ដកចេញដោយចេតនា** — បញ្ជីតែមួយ (ច្បាប់ ១២ លើកូដ) ដែល
 * `logic-identity.mjs` និង `parity-static.mjs` អាន។ រាល់ធាតុត្រូវមានហេតុផល ហើយធាតុ
 * ដែលនៅមានក្នុងកូដថ្មី ➜ ធ្លាក់ (បញ្ជីងាប់ = ការលាក់កំហុសបន្ទាប់)។
 */

/** function ដើម */
export const REMOVED = {
    setupActionDelegation: 'React ១០០% ៖ ប៊ូតុងទាំងអស់ហៅសកម្មភាពតាម `onClick`/`onAct()` (ព្រំដែន `ACTION_REGISTRY` ពិនិត្យពេល build) ➜ listener ទី ២ នៅកម្រិត `document` នឹងធ្វើឲ្យសកម្មភាពរត់ **២ ដង** (ច្បាប់ ៤ នៃ «CSP និង `data-act`»)',
    readActionArgs: 'React ១០០% ៖ លំដាប់អាគុយម៉ង់ [ធាតុ? · ព្រឹត្តិការណ៍? · …args] រស់ក្នុង `onAct()` (`src/app/actions.ts`)',
    runElementAction: 'React ១០០% ៖ ច្រកទ្វារឈ្មោះសកម្មភាពរស់ក្នុង `act()` ➜ `lookupAction()` (`ACTION_REGISTRY` · `src/app/actions.ts`)',
    setupSheetImportDropZone: 'React ១០០% ៖ `dragenter`/`dragover`/`dragleave`/`drop` របស់ `#siDrop` ជា prop របស់ JSX (`SheetImportModal` ➜ `sheetDropEnter` · `sheetDropLeave` · `sheetDropFile`) — `preventDefault()` · `si-drop-hot` · លំដាប់ «ដក hot ➜ អានឯកសារ» ដដែល',
    code128SvgElement: 'React ១០០% ៖ `Code128Svg` (JSX) គូររូប Barcode ពី `code128Bars()` ដដែល · ច្បាប់ចម្លងដើមរស់ជា oracle ក្នុង `tests/fixtures/code128-oracle.ts` (តេស្ត parity អានវាវិញ)',
};

/** អត្ថបទដែលអ្នកប្រើអាន (ដកចេញជាមួយសាខាដែលលែងអាចទៅដល់) */
export const REMOVED_STRINGS = {
    '🫆 ស្កេនក្រយៅដៃ ឬមុខ': 'React ១០០% ៖ សាខាបម្រុងរបស់ `setBiometricLabel()` ពេលប៊ូតុង **គ្មាន** `.bio-label` — `BiometricLabel` (JSX) គូរ `.bio-ico` (🫆) និង `.bio-label` ជានិច្ច ➜ សាខានោះលែងអាចទៅដល់ · អ្វីដែលអ្នកប្រើឃើញ (🫆 + «ស្កេនក្រយៅដៃ ឬមុខ») ដដែល (parity:dom)',
};
