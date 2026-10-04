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
    buildHistoryRowHtml: 'React ១០០% ៖ `HistoryRow` (JSX) គូរជួរពី `buildHistoryRowModel()` · ច្បាប់ចម្លងដើមរស់ជា oracle ក្នុង `tests/oracles/history-row-html.ts` (`history-row-parity.test.tsx` វាស់លើទិន្នន័យចៃដន្យ)',
    healthRowHtml: 'React ១០០% ៖ `HealthCheckList` (JSX) គូរជួរពី `healthRow()` · ច្បាប់ចម្លងដើមរស់ជា oracle ក្នុង `tests/oracles/health-row-html.ts` (`health-row-parity.test.tsx`)',
    trashGroupRowHtml: 'React ១០០% ៖ `TrashTableBody` (JSX) គូរជួរពី `buildTrashRowModel()` (រូបមន្តដដែល) — builder HTML លែងមានអ្នកហៅ (`function-surface`)',
    trashActionButtonsHtml: 'React ១០០% ៖ ប៊ូតុង 🔄/✖️ ជា JSX ក្នុងជួរធុងសំរាម (`onAct(\'promptRestoreDeletedItem\')` · `onAct(\'promptPermanentDelete\')`) — helper នេះមានអ្នកហៅតែ `trashGroupRowHtml()`',
    trashSummaryCardHtml: 'React ១០០% ៖ `TrashSummaryBox` (JSX) គូរកាតពី `buildTrashSummaryModel()` (២ ក្រុមដេរីវេពី `TRASH_REASON_META[r].deducted`) — builder HTML លែងមានអ្នកហៅ',
    monthlyReportMismatchNote: 'React ១០០% ៖ `MonthlyReportBody` (JSX) គូរសារព្រមានដដែលពី `view.mismatch` (`renderMonthlyReport()`) — builder HTML លែងមានអ្នកហៅ',
    ztoListGroupHtml: 'React ១០០% ៖ `ZtoListSyncBody` (JSX) គូរក្រុមពី `ztoListGroupModel()` (meta ដដែល រួម `ztoListSkipText(row.skip)`) — builder HTML លែងមានអ្នកហៅ',
};

/** អត្ថបទដែលអ្នកប្រើអាន (ដកចេញជាមួយសាខាដែលលែងអាចទៅដល់) */
export const REMOVED_STRINGS = {
    'សូមកំណត់រចនាសម្ព័ន្ធ FirebaseConfig ជាមុនសិន!': 'ZoeW 2.46.0 ៖ backend Firebase ឬ Supabase តាម Config ➜ `loginWithFirebase()` ពេលមិនទាន់ភ្ជាប់ ប្រាប់ផ្លូវ Setup Link (QR) មុន ហើយបើកប្រអប់ «⚙️ ភ្ជាប់ប្រព័ន្ធ» ដដែល (Setup Link + Config Firebase) · សំណើម្ចាស់គម្រោង',
    '⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិប្រើប្រាស់បានទេ! សូមសាកល្បងចូលម្តងទៀត។': 'ZoeW 2.48.0 ៖ License យឺតក្រោយចូលប្រព័ន្ធ (លើស ២០ វិ.) ➜ `proceedAfterLogin()` សាកម្តងទៀតដោយស្វ័យប្រវត្តិ (`ACTIVATION_RETRY_STEPS_MS`) ជំនួស toast «សូមសាកល្បងចូលម្តងទៀត» ហើយឈប់ (ការស្តារវគ្គក្រោយ reload គ្មានប្រអប់ចូល ➜ App ទទេ) · សារថ្មី `ACTIVATION_RETRY_TOAST` / `ACTIVATION_GIVE_UP_TOAST`',
    '⚠️ បានលុប PIN ក្នុងឧបករណ៍ ប៉ុន្តែមិនអាចបញ្ជាក់ថាបានចាកចេញពី Firebase ទេ — សូមពិនិត្យបណ្ដាញ ហើយ Refresh': 'ZoeW 2.49.4 (Deep audit ជុំ ២ G4) ៖ ការចាកចេញក្នុងឧបករណ៍លែងពឹងបណ្តាញ (ហាង Supabase ៖ ការលុបចោលនៅ Server ជា best-effort ក្រោម `SB_SIGN_OUT_CEILING_MS` · Firebase ៖ `signOut()` ក្នុងឧបករណ៍) ➜ ការបរាជ័យដែលនៅសល់ = storage ក្នុងឧបករណ៍លុបមិនចេញ ➜ «សូមពិនិត្យបណ្ដាញ» ក្លាយជាការណែនាំខុស · សារថ្មីក្នុង `forgetAppLockPin()` ៖ «…មិនអាចបញ្ជាក់ថាបានចាកចេញពីឧបករណ៍នេះទេ — សូម Refresh ហើយសាកចាកចេញម្តងទៀត»',
    '⚠️ មិនអាចបញ្ជាក់ថាបានចាកចេញពី Firebase ទេ — បានសម្អាតការចងចាំក្នុង App ប៉ុណ្ណោះ។ សូមពិនិត្យបណ្ដាញ ហើយសាកម្តងទៀត។': 'ZoeW 2.49.4 (Deep audit ជុំ ២ G4) ៖ ហេតុផលដដែល (ការចាកចេញក្នុងឧបករណ៍លែងពឹងបណ្តាញ) · សារថ្មីក្នុង `logoutApp()` ៖ «⚠️ មិនអាចបញ្ជាក់ថាបានចាកចេញពីឧបករណ៍នេះទេ — បានសម្អាតការចងចាំក្នុង App ប៉ុណ្ណោះ។ សូម Refresh ហើយសាកចាកចេញម្តងទៀត។» (`tests/supabase-signout-offline.test.ts`)',
    '🫆 ស្កេនក្រយៅដៃ ឬមុខ': 'React ១០០% ៖ សាខាបម្រុងរបស់ `setBiometricLabel()` ពេលប៊ូតុង **គ្មាន** `.bio-label` — `BiometricLabel` (JSX) គូរ `.bio-ico` (🫆) និង `.bio-label` ជានិច្ច ➜ សាខានោះលែងអាចទៅដល់ · អ្វីដែលអ្នកប្រើឃើញ (🫆 + «ស្កេនក្រយៅដៃ ឬមុខ») ដដែល (parity:dom)',
};
