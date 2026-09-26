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

`src/sw/sw.ts` ដើរ cache-first ដូច `sw.js` ដើម តែបញ្ជីសំបកលែងសរសេរដោយដៃ ៖ `vite.config.mts` អាន `dist/` ពិតក្រោយ build
រួចចាក់វាចូល ៖

- **សំបកស្នូល** (`cache.addAll` — atomic) ៖ `index.html` · `guide.html` ·
  bundle និង CSS ដែលមាន hash · helper · engine ស្កេន
- **សំបកស្រេចចិត្ត** ៖ SheetJS · manifest · រូបតំណាង
- ⛔ `.map` **មិនចូល cache** (វាធំ ហើយមានតែ devtools ទេដែលសុំ)
- រាល់ការទាញដែលចាក់ចូល cache (install · ធ្វើឲ្យស្រស់ · cache miss) ប្រើ `cache: 'no-cache'` ➜ HTTP cache ចាស់លើឧបករណ៍មិនពុល
  cache របស់ SW
- ⛔ **deploy ថ្មីមកតាម install ជាក្រុមតែមួយផ្លូវ** ៖ ការធ្វើឲ្យស្រស់ខាងក្រោយសរសេរតែពេល `sw.js` លើ server នៅជាកំណែ
  `CACHE_VERSION` ខ្លួនឯង (`shellDeployIsCurrent()`) ➜ SW ចាស់ដែលនៅគ្រប់គ្រង (install ថ្មីធ្លាក់) មិនលាយ `index.html` ថ្មី
  ជាមួយ asset ចាស់ក្នុង cache (ក្រៅបណ្តាញ App ស) — មើល `CLAUDE.md` ជួរ «Service worker»

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

## ៩. ប្រភពការពិត និងឧបករណ៍ផលិតកូដ

`src/**` ជា **ប្រភពការពិតតែមួយ** ហើយកែដោយដៃ។ ឧបករណ៍ codemod ដែលធ្លាប់ផលិតវាពី `app.js` ដើម ត្រូវលុបរួច
(វាសរសេរជាន់ `src/` ទាំងមូល ➜ អន្ទាក់)។ ឯកសារដែលនៅតែ **ផលិត** ៖

| ឯកសារ | ផលិតដោយ | ហេតុអ្វី |
|---|---|---|
| `dist-audit/**` | `scripts/build-audit.mjs` | build វាស់សម្រាប់ `audit-tools/` (មិន commit) |
| `audit-tools/money-core.js` | `npm run money:core` | កូដលុយពិតសម្រាប់ `check-money.cmd` (អ្នកយាមភាពស្រស់) |
| `src/_generated-state.json` | ⛔ **ស្ថិរ** (រូបភាពនៃ state ដើមរបស់ vanilla) | `parity` · build វាស់ ប្រើវាដើម្បីផ្គូ state ដើម |

បញ្ជី slot (ផ្នែក ១០) រស់នៅ `scripts/slot-registry.cjs` ហើយ `slot:check` ផ្ទៀងផ្ទាត់វាទល់នឹង `REACT_OWNED_IDS`
(`src/app/slot-resets.ts`) និង component ដែល export ពិត ➜ វាមិនមែនបញ្ជីរឹងឯករាជ្យទេ។

---

## ១០. ការគូរ ៖ slot និង element slot

component របស់ React ឈរក្នុងសំបក (`AppShell` · markup ដែលធ្លាប់ជា `index.html`) តាម **id** — បញ្ជីរស់នៅ
`scripts/slot-registry.cjs`។ មាន ២ រូបរាង ៖

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
ម៉ឺនុយហៀរក្រៅអេក្រង់។ helper របស់ `refs.ts` ដែលវាស់ (`elementSize()` ·
`setScrollTop()` · `focusField()`) ហៅវាខ្លួនឯង។

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
| បន្ថែម slot ថ្មី | ចុះឈ្មោះក្នុង `scripts/slot-registry.cjs` · បន្ថែមករណីក្នុង `resetReactOwned()` និង `REACT_OWNED_IDS` (`slot:check` ធ្លាក់បើ ២ បញ្ជីឃ្លាតគ្នា) · បន្ថែមជួរក្នុងតារាងខាងលើ (`doc:check`) |

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
⛔ helper ដែលសាង HTML ជាខ្សែអក្សរ **មិនរស់ក្នុង `src/` ទៀតទេ** — JSX គូរពី model (`buildHistoryRowModel()` ·
`buildTrashRowModel()` · `healthRow()` · `ztoListGroupModel()`)។ builder ដើមដែលតេស្ត parity ត្រូវការ រស់ជា
**oracle** ក្នុង `tests/oracles/` (`history-row-html.ts` · `health-row-html.ts`) ➜ `function-surface` មិនរាយវាថាងាប់ ហើយ
ផលិតកម្មមិនដឹកវា។

### ⛔ ច្រកចេញ (escape hatch) — អ្វីតែមួយគត់ដែលមិនមែន JSX

React ជាអ្នកសរសេរ **តែមួយ** នៃអ្វីៗក្នុង `#root` ៖ រចនាសម្ព័ន្ធ · class · style · attribute ·
អត្ថបទ · ព្រឹត្តិការណ៍របស់ធាតុ (`onClick` · `onInput` · `onFocus` · `onDrop` …)។ អ្វីខាងក្រោមជា
ប្រតិបត្តិការដែល **React ខ្លួនឯងគ្មានទម្រង់ប្រកាស (declarative)** ហើយឯកសាររបស់ React ណែនាំ
ឲ្យធ្វើតាម ref — ពួកវារស់នៅ **កន្លែងកំណត់** ហើយ `npm run purity:check` រាប់វាជាមួយ **ហេតុផល
និងពិដានចំនួន** (ការសរសេរថ្មីក្រៅកន្លែងទាំងនេះ ➜ ធ្លាក់)៖

| កន្លែង | អ្វី | ហេតុអ្វីមិនមែន JSX |
|---|---|---|
| `src/app/refs.ts` | focus · blur · ជ្រើសអត្ថបទ · បើកផ្ទាំងជ្រើសឯកសារ · `scrollTop` · `scrollIntoView` · `animate()` (FLIP) · តម្លៃ input | React គ្មាន prop សម្រាប់វា — input ជា **uncontrolled** ដោយចេតនា (ផ្នែក ១១) |
| `DocumentEffects` | class/overflow លើ `<body>` · អថេរ CSS លើ `<html>` (`--chrome-*`) · `document.title` | ក្រៅ `#root` ➜ `useLayoutEffect` ពី state (លំនាំរបស់ React សម្រាប់ធាតុក្រៅ root) |
| `<video>` (`srcObject` · `muted` · `play()`) | stream កាមេរ៉ា/QR តាម `videoElement()` · attribute `muted` ក្នុង ref callback | React គ្មាន prop `srcObject` · React មិនសរសេរ attribute `muted` (បញ្ហា React #10389 · iOS autoplay) |
| `app/behaviors/panel-motion.ts` | listener `touch*` native លើផ្ទាំង/តារាង | React ចាក់ listener `touch*` ជា **passive** នៅ root ➜ `preventDefault()` របស់ iOS handoff មិនដើរ |
| listener លើ `document` · `window` · `visualViewport` | កាយវិការ PTR · ម៉ាស៊ីនស្កេន hardware · ការរមូរ/ប្តូរទំហំ | ព្រឹត្តិការណ៍ទូទាំងទំព័រ (មិនមែនធាតុរបស់ React) |
| `src/platform/document-io.ts` | `<link rel=preconnect>` · `<script>` loader · `<a download>` បណ្តោះអាសន្ន · `<canvas>`/`Image` ក្រៅអេក្រង់ · ការរមូរ document | ក្រៅ `#root` ឬមិនដែលភ្ជាប់ document |
| `public/boot-flags.js` | class `ios-standalone` · `native-android` · `boot-instant` លើ `<html>` · ប្តូរ `media` របស់ font | ត្រូវរត់ **មុន** stylesheet និងមុន React ផ្ទុក (បើអត់ ផ្ទាំងលោតពេលបើក) — ⛔ វា **មិនប៉ះ** ធាតុរបស់ React |

⛔ **សញ្ញា PTR** (`PtrIndicator`) គូរពី **`ptrState`** (transform · opacity · class ចលនា) ៖ ឃ្លាំង
ដាច់ដោយឡែកដែលមានអ្នកជាវ **តែមួយ** ហើយកាយវិការហៅ `renderNow(ptrState)` ➜ React គូរ **ក្នុង
ស៊ុមដដែល** នៃ `touchmove` (ការគូរ div មួយ ~០.១ms) ដោយមិនប៉ះ component ផ្សេង។
⛔ **ផ្ទាំងបើក** (`BootSplash`) ជារបស់ React តែមួយ ៖ bundle ដួល ➜ ផ្ទាំងមិនកើតសោះ (មិនមែនជាប់) ·
boot ជាប់ក្រោយ mount ➜ ផ្លូវបម្រុង ៦ វិនាទី (`armBootSplashFallback()`)។

---

## ១១. React ១០០% ៖ ម្ចាស់ DOM តែមួយ

### ច្បាប់

| ស្រទាប់ | អាចធ្វើ | ⛔ មិនអាចធ្វើ |
|---|---|---|
| `src/core` · `domain` · `features` · `services` · `ui` · `platform` | សរសេរ **state** (`uiState` · `viewState` · …) · ហៅ helper របស់ `refs.ts` (focus · តម្លៃ · វាស់) | `document.*` · `getElementById` · `classList` · `style` · `textContent` · `innerHTML` · `setAttribute` · `.focus()` ត្រង់ៗ |
| `src/app/components` | គូរពី state តាម JSX · ចង ref (`ref={refTo('name')}`) · ព្រឹត្តិការណ៍ជា prop (`onClick` · `onInput` · `onKeyDown` · `onDrop` …) | ស្វែងរក DOM តាម id/selector · សរសេរ DOM ក្នុង ref callback/effect (លើកលែងច្រកចេញ ៖ ផ្នែក ១០ «ច្រកចេញ») |
| `src/app/behaviors` · `lifecycle` | listener លើ `document`/`window` · listener `touch*` native (non-passive) · ច្រកចេញតាម `refs.ts` | សរសេរ class/style/attribute/អត្ថបទ (ត្រូវសរសេរ **state**) · listener លើធាតុដែល JSX ធ្វើបាន |

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
  ការវាស់ផ្ទៃវីដេអូ/media — រាល់ធាតុមាន **ហេតុផល និងពិដានចំនួន**; ពិដានធូរ ឬធាតុងាប់ ➜ ធ្លាក់)
- **ស្រទាប់ React ខ្លួនឯង** (`src/app/**`) ៖ ការសរសេរ DOM (class · style · attribute · អត្ថបទ ·
  focus · រមូរ · ចលនា · listener លើធាតុ) **០** ក្រៅច្រកចេញក្នុងតារាងខាងលើ (ពិដានតឹង ➜
  ការសរសេរថ្មីក្នុងឯកសារដែលមានការលើកលែងរួច ក៏ធ្លាក់ដែរ)
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
