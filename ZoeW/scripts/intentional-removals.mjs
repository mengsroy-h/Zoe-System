/**
 * អ្វីពី ZoeW ដើមដែល **ដកចេញដោយចេតនា** — បញ្ជីតែមួយ (ច្បាប់ ១២ លើកូដ) ដែល
 * `logic-identity.mjs` និង `parity-static.mjs` អាន។ រាល់ធាតុត្រូវមានហេតុផល ហើយធាតុ
 * ដែលនៅមានក្នុងកូដថ្មី ➜ ធ្លាក់ (បញ្ជីងាប់ = ការលាក់កំហុសបន្ទាប់)។
 */

/** function ដើម */
export const REMOVED = {
    measureDisplayHz: 'សំណើម្ចាស់គម្រោង («adaptive refresh rate 10-120hz … វៃឆ្លាតស្គាល់ device ណាដែល refresh rate ខ្ពស់») ៖ Hz វាស់ក្នុងបង្អួចតែមួយជាមួយស៊ុមកក (`sampleFramePace()` · median ៩០ ស៊ុម) ➜ អេក្រង់ LTPO ដែលចុះ ១២០ ➜ ៦០ ចន្លោះបង្អួចពីរមិនរាប់ស៊ុមធម្មតាជា «កក» · Hz ខ្ពស់បំផុតរៀនពីការរមូរ (`sampleScrollHz()`) · អ្នកយាម `tests/adaptive-refresh.test.ts` (មុនកែ ក្រហម ៥/៨) · gesture-test',
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
    '✅ Setup Link បានបំពេញ Config និងបើកការរាយការណ៍កំហុស! សូមពិនិត្យ ហើយចុច': 'ZoeW 2.49.6 ៖ ប្រអប់ ⚙️ ភ្ជាប់ប្រព័ន្ធ (សំណើម្ចាស់គម្រោង) ៖ Setup Link ពី URL បង្ហាញកាត Server + ប៊ូតុង «✅ ភ្ជាប់» (`configPendingLink`) ➜ សារថ្មី `announceSetupApplied()` ៖ «ℹ️ Setup Link ត្រឹមត្រូវ (រួមការរាយការណ៍កំហុស) — ពិនិត្យ Server ខាងក្រោម ហើយចុច «✅ ភ្ជាប់»» (ប៊ូតុង «រក្សាទុក និងភ្ជាប់» នៅតែសម្រាប់ Config ដោយដៃ)',
    '✅ Setup Link បានបំពេញ Config ដោយស្វ័យប្រវត្តិ! សូមពិនិត្យ ហើយចុច': 'ZoeW 2.49.6 ៖ ហេតុផលដដែល ➜ «ℹ️ Setup Link ត្រឹមត្រូវ — ពិនិត្យ Server ខាងក្រោម ហើយចុច «✅ ភ្ជាប់»» · បិទភ្ជាប់ Link ក្នុងប្រអប់ ➜ រក្សាទុក និងភ្ជាប់ភ្លាម (`connectSetupPayload()`) ៖ «✅ Setup Link ត្រឹមត្រូវ ➜ បានរក្សាទុក Config ៖ <host>» (`tests/config-modal.test.tsx`)',
    '✅ បានស្កេន QR ជោគជ័យ! សូមពិនិត្យ ហើយចុច': 'ZoeW 2.49.6 ៖ ស្កេន QR (កាមេរ៉ា/រូបភាព) ➜ រក្សាទុក និងភ្ជាប់ភ្លាម (`connectSetupPayload()`) ➜ លែងមានជំហាន «ពិនិត្យ ហើយចុច» · សារថ្មី «✅ QR ត្រឹមត្រូវ ➜ បានរក្សាទុក Config ៖ <host>» / «✅ QR ពីរូបភាព ត្រឹមត្រូវ ➜ …» (`tests/config-modal.test.tsx`)',
    'កញ្ចប់ចាស់ដែល ZTO បិទបញ្ជីរួច ➜ បញ្ចូលជា «យករួច» ➜ ចូលធុងសំរាមក្នុង ២ ម៉ោង (លុយមិនត្រូវដក)។': 'ZoeW 2.50.0 (សំណើម្ចាស់គម្រោង ៖ «បើប៉ះកញ្ចប់ដែលបិទរួច សូមបូកវាចូលស្ថិតិដូចបិទដោយដៃ») ៖ ជួរដេក **គ្រប់អាយុ** ដែល ZTO បិទរួច (`/detail` · វាលជួរដេក · បញ្ជី «ចុះហត្ថលេខា») កើតមកជា «យករួច» ➜ ពាក្យ «ចាស់» ក្នុងប្រអប់បញ្ជាក់លែងត្រូវ ➜ សារថ្មីក្នុង `importZtoListRows()` ៖ «🔒 N កញ្ចប់ដែល ZTO បិទបញ្ជីរួច ➜ បញ្ចូលជា «យករួច» (ចូលស្ថិតិយក ដូចបិទដោយដៃ) ➜ ចូលធុងសំរាមក្នុង ២ ម៉ោង (លុយមិនត្រូវដក)។» (`zto-list-sync-test` ផ្នែក ១៦ · `tests/zto-signed-sync.test.tsx`)',
    '📦 បញ្ជី (': 'ZoeW 2.50.1 (សំណើម្ចាស់គម្រោង ៖ «ដកប៊ូតុង បញ្ជី ចេញ ដោយជំនួសការបើកមើលបញ្ជីតាមការចុចលើ កញ្ចប់សរុប») ៖ ជួរប្រវត្តិ «កញ្ចប់សរុប: N» ជា `<button>` ហៅ `openViewListModal(id)` ដដែល (`history-row-parity.test.tsx` ការចុចពិត · `layout-check` ចុចពិត ➜ ប្រអប់បញ្ជី) · បន្ទាត់ដែលទំនេរដាក់ប្រភពកញ្ចប់ · ការប្រៀប DOM ប្រកាសក្នុង `INTENTIONAL_UI` (`skip` · `asLegacy`)',
    '❌ មិនអាចចងក្រយៅដៃ ឬមុខបានទេ!': 'ZoeW 2.50.24 (SECURITY-1 · ការសម្រេចម្ចាស់គម្រោង ៖ PRF-only) ៖ ការចងបរាជ័យពេលគ្មាន WebAuthn PRF ➜ សារប្រាប់មូលហេតុ និងផ្លូវចេញ ៖ «❌ មិនអាចចងក្រយៅដៃ ឬមុខបានទេ — ឧបករណ៍ ឬកម្មវិធីរុករកនេះមិនគាំទ្រការការពារ PIN ដោយជីវមាត្រ (WebAuthn PRF) ➜ សូមប្រើ PIN ជំនួស។» (`tests/biometric-no-device-mode.test.tsx` · `biometric-unlock-test`)',
    '✅ បើករួច! លើកក្រោយស្កេនក្រយៅដៃ ឬមុខ ជំនួសការវាយ PIN។ (ឧបករណ៍នេះមិនគាំទ្រការចាក់សោដោយជីវមាត្រពេញលេញទេ — PIN ត្រូវរក្សាទុកក្នុងឧបករណ៍)': 'ZoeW 2.50.24 (SECURITY-1 · PRF-only) ៖ របៀប `device` (សោ AES ឆៅក្បែរ PIN ដែលរុំក្នុង localStorage) ត្រូវដក ➜ សាខាជោគជ័យដែលប្រាប់ថា «PIN ត្រូវរក្សាទុកក្នុងឧបករណ៍» លែងមាន · ការចងទាំងអស់ជា PRF ឬ native ➜ «✅ បើករួច! លើកក្រោយស្កេនក្រយៅដៃ ឬមុខ ជំនួសការវាយ PIN។» (`tests/biometric-no-device-mode.test.tsx`)',
    '🫆 ស្កេនក្រយៅដៃ ឬមុខ': 'React ១០០% ៖ សាខាបម្រុងរបស់ `setBiometricLabel()` ពេលប៊ូតុង **គ្មាន** `.bio-label` — `BiometricLabel` (JSX) គូរ `.bio-ico` (🫆) និង `.bio-label` ជានិច្ច ➜ សាខានោះលែងអាចទៅដល់ · អ្វីដែលអ្នកប្រើឃើញ (🫆 + «ស្កេនក្រយៅដៃ ឬមុខ») ដដែល (parity:dom)',
};
