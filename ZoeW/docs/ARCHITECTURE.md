# ស្ថាបត្យកម្មរបស់ ZoeW React

## ១. ហេតុអ្វីរចនាបែបនេះ

ZoeW ដើមជា **ឯកសារតែមួយ ~១៤,៨០០ បន្ទាត់** (`app.js`) ដែលជា script សកល ៖
រាល់ `function` ជា global ហើយរាល់ `let` ជា state សកល។ វាដំណើរការជាមួយ
**អតិថិជនពិត និងលុយពិត** ហើយត្រូវបានពង្រឹងតាមជុំ audit ជាច្រើន។

ដូច្នេះការសរសេរឡើងវិញមានច្បាប់តែមួយ ៖

> **តក្កវិជ្ជាអាជីវកម្មត្រូវផ្ទេរ ១:១ ។ React ជំនួសត្រឹម *ស្រទាប់គូរ*។**

ហើយស្រទាប់គូរនោះជា **React ១០០%** ៖ React ជាម្ចាស់ DOM **តែមួយគត់** —
កូដមុខងារសរសេរតែ state ហើយ component គូរពី state (មើលផ្នែក ១១)។

រាល់ការសម្រេចខាងក្រោមកើតចេញពីច្បាប់ទាំងនោះ។

---

## ២. ស្រទាប់

```
┌─────────────────────────────────────────────────────────────┐
│  src/app/          React ៖ ម្ចាស់ DOM តែមួយ                  │
│    components/       សំបកដែលកើតពី index.html ដើម             │
│    components/<ផ្នែក>/  ការគូរទាំងអស់ (មើលផ្នែក ១០)            │
│    behaviors/        កាយវិការ · PTR · ចលនាផ្ទាំង · ការលាក់របា │
│                      · ម៉ាស៊ីនស្កេន hardware (តាម ref)         │
│    hooks/            useStore() · useStoreValue() ·          │
│                      useStoreFields()                        │
│    lifecycle/        boot ជាដំណាក់ · scope · សំបក native ·   │
│                      ប្រវត្តិថយក្រោយ · ស្រទាប់ Back/Escape    │
│    refs.ts           ref តាមឈ្មោះ (focus · តម្លៃ input · វាស់) │
│    flush.ts          commitNow() ➜ DOM ចុះមុនការវាស់          │
│    actions.ts        onAct() ➜ ចុះបញ្ជីសកម្មភាព               │
├─────────────────────────────────────────────────────────────┤
│  src/platform/     web ធៀប Android native (Capacitor) ៖       │
│                     អ្នកសម្រេចតែមួយ · Export/Share/Print ·    │
│                     ជីវមាត្រ Keystore · URL របស់ Function     │
├─────────────────────────────────────────────────────────────┤
│  src/ui/           *តក្កវិជ្ជា* នៃការគូរ (ប្រអប់ · ម៉ឺនុយ ·      │
│                     ទំព័រ · toast · ប្រវត្តិ) ➜ សរសេរ state     │
├─────────────────────────────────────────────────────────────┤
│  src/features/     មុខងារអាជីវកម្ម (ស្កេន · Locker · ZTO ·   │
│                     នាំចូល · Export · របាយការណ៍ · សុវត្ថិភាព)  │
├─────────────────────────────────────────────────────────────┤
│  src/domain/       ច្បាប់លុយសុទ្ធសាធ (ledger · pickup ·       │
│                     collected · cleanup · barcode · registry) │
├─────────────────────────────────────────────────────────────┤
│  src/services/     បណ្តាញ · Firebase · listener · crypto ·    │
│                     កាមេរ៉ា · ម៉ាស៊ីនស្កេន                     │
├─────────────────────────────────────────────────────────────┤
│  src/core/         ឃ្លាំង state (រួម viewState · ប្រអប់) ·    │
│                     នាឡិកា · storage · តំបន់ម៉ោង · សកម្មភាព   │
└─────────────────────────────────────────────────────────────┘
```

⛔ **វដ្ត import ត្រូវបានទទួលយក** ៖ `app.js` ដើមមាន function ហៅគ្នាទៅវិញទៅមក
ឆ្លងដែនមុខងារ។ ESM ដោះស្រាយវដ្តនៃ *function declaration* បានត្រឹមត្រូវ
(hoisting) ហើយ bundler រៀបលំដាប់ឲ្យ។ ការបំបែកវដ្តដោយបង្កើតស្រទាប់សិប្បនិម្មិត
នឹងផ្លាស់ទីកូដដោយគ្មានហេតុផលអាជីវកម្ម ➜ ហានិភ័យដោយគ្មានផលចំណេញ។

---

## ៣. ឃ្លាំង state ដែលប្រកាសការប្រែ

អថេរ `let` កម្រិតកំពូលទាំង **១៧៦** របស់ `app.js` ត្រូវចាត់ជា **ឃ្លាំង ៨** ៖

| ឃ្លាំង | អ្វីដែលវាកាន់ |
|---|---|
| `firebaseState` | ការតភ្ជាប់ · listener · auth · នាឡិកា server |
| `dataState` | ប្រវត្តិ · ធុងសំរាម · ledger · អត្រាប្រាក់ |
| `scanState` | កាមេរ៉ា · ម៉ាស៊ីនស្កេន · barcode ដែលរង់ចាំ |
| `uiState` | ប្រអប់ (`modalDisplay`) · តម្រង · ទំព័រ · ផ្ទាំង · របា Slide · ម៉ឺនុយ · Locker · ចលនា |
| `securityState` | PIN · ក្រយៅដៃ · សោ App · កូនសោ Lookup |
| `lookupState` | តារាងអតិថិជន · ការត្រៀម ZTO |
| `sheetImportState` | ដំណើរការនាំចូល Excel |
| `ztoState` | សាលក្រម ZTO · ជុំបោស · ការទាញបញ្ជី |

បូក **`viewState`** (`src/core/view-state.ts`) ៖ អត្ថបទ · ស្លាក · ទង់រវល់ ·
ស្ថានភាពប៊ូតុង ដែល `app.js` ដើមសរសេរចូល DOM ដោយផ្ទាល់ (`textContent` ·
`disabled` · `style.display`) ➜ ឥឡូវជា state ដែល JSX អាន។

ឃ្លាំងនីមួយៗជា **Proxy** ៖ ការសរសេរ `dataState.scanHistory = x` ត្រូវចាប់
ហើយជូនដំណឹងក្នុង microtask តែមួយ។ React ជាវតាម `useSyncExternalStore`។

⛔ **អត្ថប្រយោជន៍សំខាន់** ៖ កូដដែលផ្ទេរមក **មិនបាច់ដឹងអំពី React សោះ**
ហើយ React មិនបាច់ដឹងអំពីកូដដែលផ្ទេរមក។ ស្នាមភ្ជាប់មានតែមួយ។

⚠️ ពេលកែ *ខាងក្នុង* វត្ថុ (ឧ. ប្តូរវាលនៃ item ដោយមិនប្តូរ array) Proxy
មើលមិនឃើញ ➜ ត្រូវហៅ `store.touch()` ។ `renderHistory()` ធ្វើវារួចហើយ។

---

## ៤. ធនធានខាងក្រៅដែល **មិន** bundle

| ឯកសារ | ហេតុអ្វី |
|---|---|
| `public/firebase-loader.js` | ផ្លូវស្តារ «SDK ផ្ទុកមិនបាន» ពឹងលើការពិតដែលថា SDK ជាធនធានខាងក្រៅដែលអាចធ្លាក់ |
| `public/license-verify.js` | ⛔ ត្រូវ **byte-identical** ជាមួយ App ដទៃ — bundle ➜ វាលែងដូច |
| `public/error-reporting.js` | ដូចគ្នា; ហើយវាត្រូវផ្ទុក **មុន** កូដ App ដើម្បីចាប់កំហុស boot |
| `public/vendor/zxing-wasm.js` · `.wasm` | ត្រូវនៅ origin ដដែល ➜ ស្កេនដើរក្រៅបណ្តាញ |
| `public/vendor/xlsx.full.min.js` | ផ្ទុកយឺតតាមតម្រូវការ; CSP ហាម CDN |
| `public/boot-flags.js` | ត្រូវរត់ **មុន stylesheet** (ច្បាប់ iOS standalone) |

---

## ៥. Service Worker

`src/sw/sw.ts` ជាការផ្ទេរ ១:១ នៃ `sw.js` ដើម ជាមួយការកែ **១** ៖ បញ្ជីសំបក
លែងសរសេរដោយដៃ។ `vite.config.mts` អាន `dist/` ពិតក្រោយ build រួចចាក់វាចូល ៖

- **សំបកស្នូល** (`cache.addAll` — atomic) ៖ `index.html` · `guide.html` ·
  bundle និង CSS ដែលមាន hash · helper · engine ស្កេន
- **សំបកស្រេចចិត្ត** ៖ SheetJS · manifest · រូបតំណាង
- ⛔ `.map` **មិនចូល cache** (វាធំ ហើយមានតែ devtools ទេដែលសុំ)

---

## ៦. ចុះបញ្ជីសកម្មភាព

`app.js` ដើមហៅសកម្មភាពតាម `window[name]` ដោយមាន `ACTION_ALLOWLIST` ជាព្រំដែន។
ក្នុង module គ្មាន global ➜ `src/core/action-registry.ts` **កើតដោយស្វ័យប្រវត្តិ**
ពី `ACTION_ALLOWLIST` ពិត ៖ ឈ្មោះនីមួយៗត្រូវ import ពី module ម្ចាស់របស់វា។

⛔ ព្រំដែនមិនប្រែ — តែឥឡូវ **ឈ្មោះដែលបាត់ ធ្វើឲ្យ build ធ្លាក់** ជំនួស
ការបរាជ័យស្ងាត់ៗលើផលិតកម្ម។

---

## ៧. ដំណើរការចាប់ផ្តើម

1. `index.html` ➜ `boot-flags.js` (ទង់ iOS · ទង់ Android native · font) ➜
   `zxing-wasm` · `firebase-loader` · `license-verify` · `error-reporting`
2. `src/main.tsx` ➜ `createRoot(#root).render(<App/>)`
3. `<App>` ➜ `useLayoutEffect` ➜ microtask ➜ `bootApplication(scope)`
   (`src/app/lifecycle/boot.ts`) ➜ unmount ➜ `scope.dispose()`
4. ដំណាក់ដែលមានឈ្មោះ តាមលំដាប់ដូច `<script>` ដើមបេះបិទ ៖
   `bootShell` (សំបក · សោ App · Service Worker · សំបក native) ➜ `load` ➜
   `startCoreServices` (Sentry · License · Setup Link · Firebase) ➜
   `startPeriodicTasks` ➜ `startScanEngine` ➜ `startInteractions` (កាយវិការ ·
   PTR) ➜ `startGlobalDismissals` ➜ `revealAppAfterBoot`

⛔ **ជំហានទី ៣ ប្រើ `useLayoutEffect` + microtask** ៖ boot ត្រូវរត់ក្រោយ DOM ចុះ
តែមុនការគូរ ដូច `<script>` នៅចុង `<body>` ដើមបេះបិទ — ហើយ **ក្រៅ** lifecycle
របស់ React ព្រោះកូដមុខងារហៅ `commitNow()` (`flushSync`) ដែល React ហាមក្នុង effect។

⛔ **`scope.onLoad()` រត់ភ្លាមពេល `load` បាញ់រួច** ៖ React អាច mount *ក្រោយ*
`load` ➜ អ្នកស្តាប់នឹងមិនបាញ់ជារៀងរហូត ➜ App មិនចាប់ផ្តើមសោះ ដោយស្ងាត់។

⛔ **២ ប្រភេទនៃការចាប់ផ្តើម** (`src/app/lifecycle/scope.ts`) ៖ listener និង
interval ដែលដំណាក់ boot ចាក់ផ្ទាល់ ឆ្លងកាត់ `scope.listen()`/`scope.every()`
(ដកវិញពេល unmount); ការចាប់ផ្តើមដែលចាក់ listener ខាងក្នុងខ្លួន (Firebase ·
កាយវិការ · PTR) ឆ្លងកាត់ `oncePerPage()` ➜ StrictMode/HMR មិនបង្កើតស្ទួន។

---

## ៨. `#root` និង layout

`app.css` សរសេរ `body { display: flex; flex-direction: column; }` ហើយផ្តល់
`order:` ដល់របាខាងលើ និងរបា Tab នៅ `≥992px` ➜ ច្បាប់ទាំងនោះសន្មតថាធាតុ
ជា **កូនផ្ទាល់របស់ body**។

`#root { display: contents; }` (ក្នុង `src/styles/react-root.css`) ដក
ធាតុរុំចេញពីដើមឈើ layout ➜ ខ្សែសង្វាក់ flex · កម្ពស់ · និងម្ចាស់នៃការរមូរ
នៅដដែលបេះបិទ។ ⛔ កុំប្តូរទៅ `display: block`។

---

## ៩. ឧបករណ៍ដែលផលិតកូដ

| ឧបករណ៍ | អ្វីដែលវាធ្វើ |
|---|---|
| `tools/codemod.cjs` | បំបែក `app.js` ➜ module · ប្តូរ `let` ជា `store.field` · សាង import · ចុះបញ្ជីសកម្មភាព |
| `tools/gen-state.cjs` | ផលិត `src/core/state.ts` ពីអថេរ `let` ពិត |
| `tools/fixups.cjs` | ការជួសជុល **type ប៉ុណ្ណោះ** (cast · annotation) — ធ្លាក់បើធាតុណាមួយរកមិនឃើញ |
| `tools/html-to-jsx.cjs` | បម្លែង `index.html` ➜ component · `data-act` ➜ handler |
| `tools/generate.sh` | រត់ទាំង ៤ តាមលំដាប់ រួចពិនិត្យ type |

⛔ ឧបករណ៍ទាំងនេះជា **កំណត់ត្រានៃការផ្ទេរ** ៖ `src/` ជាប្រភពការពិត ហើយត្រូវបាន
កែដោយដៃ (lifecycle · platform · Android · React ១០០%) ➜ ⛔ **កុំរត់ `tools/generate.sh`**
(`npm run generate` ចាក់សោដោយ `ALLOW_REGENERATE=1`) — វានឹងសរសេរជាន់ `src/` ទាំងមូល
ហើយនាំកូដដែលប៉ះ DOM ផ្ទាល់ត្រឡប់មកវិញ។ `html-to-jsx.cjs` នៅជាប្រភពនៃបញ្ជី slot
ដែល `doc:check` · `slot:check` អាន។

---

## ១០. ការគូរ ៖ slot និង element slot

`tools/html-to-jsx.cjs` ចាក់ component របស់ React ចូលសំបកដែលកើតពី
`index.html` តាម **id** ។ មាន ២ រូបរាង ៖

| រូបរាង | React ជាម្ចាស់អ្វី | ហេតុអ្វីប្រើវា |
|---|---|---|
| **slot** | *មាតិកា* នៃធាតុដែលមានស្រាប់ | ធាតុនោះជាផ្នែកនៃសំបក ➜ id · class · style របស់វាត្រូវនៅដដែល |
| **element slot** | *ធាតុទាំងមូល* | form control ដែលតម្លៃរបស់វាជា state ៖ ការទុកឲ្យ DOM កាន់តម្លៃ ខណៈ React គូរជម្រើស បង្កើតការប្រណាំងលំដាប់ |

### បញ្ជីពេញលេញ (28 slot · 7 element slot)

| id ក្នុង `index.html` | Component | រូបរាង |
|---|---|---|
| `historyTableBody` | `HistoryTableBody` | slot |
| `entryListTableBody` | `EntryListTableBody` | slot |
| `lockerListTableBody` | `LockerListTableBody` | slot |
| `trashSummaryBox` | `TrashSummaryBox` | slot |
| `deletedTableBody` | `TrashTableBody` | slot |
| `monthlyReportBody` | `MonthlyReportBody` | slot |
| `dailyStatsContainer` | `DailyStatsCards` | slot |
| `collectedStatsContainer` | `CollectedStatsCards` | slot |
| `customerDataTableBody` | `CustomerTableBody` | slot |
| `healthCheckList` | `HealthCheckList` | slot |
| `barcodeListContainer` | `BarcodeListContainer` | slot |
| `lockerGrid` | `LockerGrid` | slot |
| `menuContentContainer` | `MoreMenuContent` | slot |
| `phoneSuggestBox` | `PhoneSuggestList` | slot |
| `recentPhonesList` | `RecentPhonesOptions` | slot |
| `ztoSyncBanner` | `ZtoSyncBanner` | slot |
| `ztoSyncList` | `ZtoSyncList` | slot |
| `ztoListSyncBody` | `ZtoListSyncBody` | slot |
| `pdfExportPrintArea` | `PdfPrintArea` | slot |
| `toastContainer` | `ToastList` | slot |
| `siConfigSummary` | `SiConfigSummary` | slot |
| `siConfigMsg` | `SiConfigMsg` | slot |
| `siFileMsg` | `SiFileMsg` | slot |
| `siMapMsg` | `SiMapMsg` | slot |
| `siActionMsg` | `SiActionMsg` | slot |
| `siClearMsg` | `SiClearMsg` | slot |
| `siChips` | `SiChips` | slot |
| `siPreviewBody` | `SiPreviewBody` | slot |
| `monthlyReportMonthSel` | `MonthlyReportMonthSelect` | element slot |
| `lockerListFilter` | `LockerListFilterSelect` | element slot |
| `siSheetSel` | `SiSheetSelect` | element slot |
| `siMapBarcode` | `SiMapBarcode` | element slot |
| `siMapDod` | `SiMapDod` | element slot |
| `siMapCod` | `SiMapCod` | element slot |
| `siMapPhone` | `SiMapPhone` | element slot |

### លំនាំតែមួយ

```
renderX()  ➜  គណនា model សុទ្ធ  ➜  uiState.xView = model  ➜  touch()
                                          ↓
                            <XComponent> អាន uiState.xView
```

⛔ `renderX()` នៅរក្សា **ឈ្មោះ និងកន្លែងហៅដដែល** ➜ កូដដែលផ្ទេរមកមិនដឹងថា
React មានវត្តមានសោះ។

⛔ **ពេលកូដបន្ទាប់ *វាស់* អ្វីដែលទើបផ្សាយ ត្រូវហៅ `commitNow()`**
(`flushSync` លើរាល់ឃ្លាំង) ជាមុន — បើមិនដូច្នេះវាវាស់ DOM **មុនការគូរ**។ វាស់បាន ៖
`showGlobalMoreMenu()` វាស់ទទឹងម៉ឺនុយមុនធាតុចុះ ➜ គ្មានការទាញចូលវិញ ➜
ម៉ឺនុយហៀរក្រៅអេក្រង់។ helper របស់ `refs.ts` ដែលវាស់ (`elementRect()` ·
`elementSize()` · `setScrollTop()` · `focusField()`) ហៅវាខ្លួនឯង។

### ⛔ កូដ imperative មិនត្រូវប៉ះ **កូន** របស់ធាតុដែល React ជាម្ចាស់

`el.textContent = ''` · `innerHTML` · `appendChild` · `removeChild` លើ slot ដកកូនរបស់
React ចេញពីក្រោមវា ➜ ការគូរបន្ទាប់ហៅ `removeChild` លើ node ដែលលែងនៅ ➜
`NotFoundError` ➜ **React បោះបង់ root ទាំងមូល ➜ App ក្លាយជាអេក្រង់ស**។ ហើយទិន្នន័យ
នៅក្នុង store ➜ ការគូរលើកក្រោយនាំវាត្រឡប់មកវិញ (ទិន្នន័យអតិថិជនក្រោយចាកចេញ)។

វាស់បាន ៖ `hidePhoneSuggestions()` ធ្វើ `box.textContent = ''` ➜ វាយក្នុងប្រអប់ស្វែងរក
រួចសម្អាត ➜ App ស។ ការចាកចេញសម្អាត slot ២០+ តាម DOM។

ច្បាប់ ៖

| ត្រូវការ | ធ្វើ |
|---|---|
| សម្អាតមាតិកា slot | កែ **store** (`uiState.xView = null`) — React សម្អាតខ្លួនឯង |
| សម្អាតតាមបញ្ជី id (ឧ. ពេលចាកចេញ) | `blankElementById(id)` (`src/app/slot-resets.ts`) ៖ slot ➜ store · input ➜ ref · អត្ថបទ ➜ `viewState` — id មិនស្គាល់ ➜ `false` ➜ `npm test` ធ្លាក់ |
| បន្ថែម slot ថ្មី | ប្រកាស `reset:` ក្នុង `SLOTS` (`tools/html-to-jsx.cjs`) ហើយបន្ថែមករណីក្នុង `resetReactOwned()` |

អ្នកយាម ៖ `npm run slot:check` (ក្នុង `verify`) ស្កេន AST នៃ `.ts` ទាំងអស់ក្នុង `src/`
(រួម `src/app/` ដែល behavior កាន់ធាតុតាម ref) រកការប៉ះកូនរបស់ id ដែល **ដេរីវេពី
`SLOTS`/`ELEMENT_SLOTS` ពិត** — ទាំងដោយផ្ទាល់ (`const box = elementOf('phoneSuggestBox')`
➜ `phoneSuggestBox` ជាទាំង slot និង ref) និងតាមរង្វិលជុំលើបញ្ជី id។ វាស់រួចថាវាធ្លាក់ ៖
ការបន្ថែម `box.textContent = ''` លើ `elementOf('phoneSuggestBox')` ➜ ១ កន្លែង · ថតទទេ ➜
«ការស្កេនតូចពេក»។ ក្នុងកូដមុខងារ `purity:check` ហាមការប៉ះ DOM ទាំងស្រុងរួចហើយ។

### ⛔ ប្រភេទរបស់ទិដ្ឋភាពដែល component អាន

`uiState.healthRows` មាន type `HealthRow[]` (មិនមែន `any`) ➜ អ្នកសាងជួរដែលត្រឡប់
**ខ្សែអក្សរ HTML** ត្រូវ TypeScript បដិសេធពេល build។ វាស់បាន ៖ ជួរ 🩺 ទាំង ៩ ធ្លាប់
ត្រឡប់ HTML ➜ ប្រអប់ទទេ ខណៈ parity ស្តាទិច ១០០%។

### ⛔ សកម្មភាពនៃធាតុដែល React គូរ

រាល់ការចុចឆ្លងកាត់ **`onAct(...)`** (`onClick` របស់ React) ➜ `act()` ➜
`lookupAction()` (`ACTION_REGISTRY` ពិនិត្យពេល build)។ ⛔ **គ្មាន listener នៅកម្រិត
`document` ទៀតទេ** ៖ ការគូរទាំងអស់ជា JSX (គ្មាន HTML ជាខ្សែអក្សរណាចូល DOM) ➜
listener ទី ២ នឹងធ្វើឲ្យសកម្មភាពរត់ **ពីរដង** (ច្បាប់ ៤ នៃ «CSP និង `data-act`» —
ធ្ងន់បំផុតលើការលុប)។

⛔ `data-act` · `data-a1` លើប៊ូតុងម៉ឺនុយ (...) នៅជា attribute **ពណ៌នា** សុទ្ធ
(DOM ដូចដើម ➜ ឧបករណ៍វាស់ `wiring` · `csp-enforced` អានវា) តែគ្មានអ្វីស្តាប់វាទេ។
⛔ helper ដែលសាង HTML ជាខ្សែអក្សរ (`buildHistoryRowHtml()` · `trashGroupRowHtml()`)
**មិនចូល DOM** — វារស់ជា oracle សម្រាប់តេស្ត parity និង checker ស្តាទិច។

### ⛔ អ្វីដែលនៅ imperative ដោយចេតនា (ច្រកចេញបន្ទាន់ដែល React ណែនាំ)

| កន្លែង | ហេតុអ្វី |
|---|---|
| ចលនារបស់ PTR (`style.transform` · class ចលនា រាល់ `touchmove`) · FLIP របស់ផ្ទាំង (`animate()`) | React គូរ *ធាតុ* (`PtrIndicator` · ផ្ទាំង) ចំណែកកាយវិការកាន់ *ចលនា* តាម ref ៖ ការគូរឡើងវិញរាល់ស៊ុមនៃម្រាមដៃ ប្តូរឥរិយាបថនៃតំបន់ដែល `CLAUDE.md` ហាមប៉ះ |
| focus · តម្លៃ input · ការវាស់ · ការរមូរ | `src/app/refs.ts` (ref តាមឈ្មោះ) — input ជា **uncontrolled** ដោយចេតនា (មើលផ្នែក ១១) |
| `<video>` របស់កាមេរ៉ា/QR (`srcObject` · `play()`) | media playback តាម ref (`videoElement()`) |
| `<link rel=preconnect>` · `<script>` loader | ពួកវារស់ក្នុង `<head>` ដែល React មិនជាម្ចាស់ (`src/platform/document-io.ts`) |
| `<canvas>`/`Image` ក្រៅអេក្រង់ (ស្កេន · QR) | មិនដែលចូល DOM ➜ វាមិនមែនការគូរ (`document-io.ts`) |
| `<a download>` ដែលចុចរួចលុបភ្លាម | ការទាញយកត្រូវកើតក្នុង tick ដដែលនឹងការចុច (`document-io.ts`) |
| `<body>` · `document.title` | នៅក្រៅ `#root` ➜ `DocumentEffects` ធ្វើឲ្យវាស៊ីនឹង state ក្នុង `useLayoutEffect` |
| សំណាញ់ ៦ វិនាទីក្នុង `public/boot-flags.js` (រសាត់ `#bootSplash`) | ត្រូវដើរ **ឯករាជ្យពី bundle** ៖ bundle ដួល ➜ React គ្មានជីវិតដើម្បីលាក់ផ្ទាំង (`boot-animation-test`)។ ជាន់ទី ២ ក្នុង React (`armBootSplashFallback()`) ធ្វើឲ្យ state ដឹង |

---

## ១១. React ១០០% ៖ ម្ចាស់ DOM តែមួយ

### ច្បាប់

| ស្រទាប់ | អាចធ្វើ | ⛔ មិនអាចធ្វើ |
|---|---|---|
| `src/core` · `domain` · `features` · `services` · `ui` · `platform` | សរសេរ **state** (`uiState` · `viewState` · …) · ហៅ helper របស់ `refs.ts` (focus · តម្លៃ · វាស់) | `document.*` · `getElementById` · `classList` · `style` · `textContent` · `innerHTML` · `setAttribute` · `.focus()` ត្រង់ៗ |
| `src/app/components` | គូរពី state តាម JSX · ចង ref (`ref={refTo('name')}`) | ស្វែងរក DOM តាម id/selector |
| `src/app/behaviors` · `lifecycle` | listener native (touch non-passive) · ចលនាតាម ref | សរសេរ class ដែលមានម្ចាស់ជា state (ត្រូវសរសេរ state) |

### លំនាំ

```ts
// ប្រអប់ ៖ state មិនមែន style.display
openModalHelper('phoneModal');            // ➜ uiState.modalDisplay.phoneModal = 'flex'
// អត្ថបទ/ទង់ ៖ state មិនមែន textContent/disabled
viewState.lookupStatus = { text: '⏳ …', tone: 'busy' };
// ផ្ទាំង ៖ state មិនមែន classList
setPanelCollapsed('data', true);          // ➜ uiState.dataPanelCollapsed
// focus · តម្លៃ ៖ ref
focusField('modalPhoneInput');            // commitNow() មុន ➜ ប្រអប់ដែលទើបបើកចុះ DOM រួច
const pin = fieldValue('securityPinInput');
```

- **ប្រអប់** ៖ `<Modal id close noDismiss>` (`components/modals/Modal.tsx`) គូរ
  `display` ពី `uiState.modalDisplay[id]` ហើយចុះឈ្មោះ meta (`data-close` ·
  `data-nodismiss`) ➜ `layers.ts` រកប្រអប់លើគេតាម z-index ដែលគណនាពិត។
- **input ជា uncontrolled** ៖ DOM ជាប្រភពការពិតនៃអ្វីដែលអ្នកប្រើវាយ (ម៉ាស៊ីនស្កេន
  hardware វាយលឿនបំផុត) ➜ `defaultValue`/`defaultChecked` មិនមែន `value`/`checked`
  ដែលគ្មាន `onChange`។ ⛔ `onChange` របស់ React ស្តាប់ `input` (រាល់ការវាយ) — ពេល
  ត្រូវការ `change` native ពិត ប្រើ `refWithNative(name, 'change', handler)`។
- **`commitNow()`** មុនរាល់ការវាស់/focus/រមូរ ដែលពឹងលើ state ទើបសរសេរ — App ដើម
  កែ DOM ផ្ទាល់ ➜ វាតែងតែ «ចុះភ្លាម»; នេះរក្សាលក្ខណៈនោះ។

### អ្នកយាម

`npm run purity:check` (`scripts/react-purity-check.mjs` · AST របស់ TypeScript) ៖

- កូដមុខងារប៉ះ DOM **០** កន្លែង (ការលើកលែងមានតែ `platform/document-io.ts` និង
  ការវាស់ផ្ទៃវីដេអូ — រាល់ធាតុមាន **ហេតុផល និងពិដានចំនួន**; ពិដានធូរ ឬធាតុងាប់ ➜ ធ្លាក់)
- `elementOf()` · `modalElement()` ក្នុងកូដមុខងារ រាប់ជាការប៉ះ DOM
- component មិនស្វែងរក DOM តាម id/selector
- **ឈ្មោះ ref គ្រប់ឈ្មោះត្រូវមាន `ref={…}` ពិតចង** (វាស់តាម AST មិនមែនវត្តមានអក្សរ) —
  ឈ្មោះគ្មានអ្នកចង = `elementOf()` ត្រឡប់ `null` ជានិច្ច ➜ មុខងារងាប់ស្ងាត់ៗ
- **គ្មាន input ដែល React ចាក់សោ** ៖ `value`/`checked` ដោយគ្មាន `onChange`/`readOnly` ➜
  React ស្តារតម្លៃក្រោយរាល់ការចុច ➜ អ្នកប្រើប្តូរវាមិនបាន (វាស់ក្នុង browser ៖ ប្រអប់ធីក
  «ចងចាំអ៊ីមែល» ដោះធីកមិនបាន)

⛔ **checker ដើមរបស់ `audit-tools/`** ខ្លះ «ដាក់ App ក្នុងស្ថានភាព» ដោយសរសេរ class
លើ DOM ផ្ទាល់ (ឧ. `.collapsed`)។ ក្នុង build វាស់តែប៉ុណ្ណោះ `src/audit-compat.ts`
បកប្រែការសរសេរនោះជា state ដដែល (ការបញ្ចូល) ខណៈ `contains()` អាន DOM ដែល React
គូរពិត (លទ្ធផល) ➜ checker វាស់ App React ពិត ដោយមិនកែ checker មួយបន្ទាត់។
