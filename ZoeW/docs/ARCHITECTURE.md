# ស្ថាបត្យកម្មរបស់ ZoeW React

## ១. ហេតុអ្វីរចនាបែបនេះ

ZoeW ដើមជា **ឯកសារតែមួយ ~១៤,៨០០ បន្ទាត់** (`app.js`) ដែលជា script សកល ៖
រាល់ `function` ជា global ហើយរាល់ `let` ជា state សកល។ វាដំណើរការជាមួយ
**អតិថិជនពិត និងលុយពិត** ហើយត្រូវបានពង្រឹងតាមជុំ audit ជាច្រើន។

ដូច្នេះការសរសេរឡើងវិញមានច្បាប់តែមួយ ៖

> **តក្កវិជ្ជាអាជីវកម្មត្រូវផ្ទេរ ១:១ ។ React ជំនួសត្រឹម *ស្រទាប់គូរ*។**

រាល់ការសម្រេចខាងក្រោមកើតចេញពីច្បាប់នោះ។

---

## ២. ស្រទាប់

```
┌─────────────────────────────────────────────────────────────┐
│  src/app/          React ៖ component · hook · handler        │
│    components/       សំបកដែលកើតពី index.html ដើម             │
│    components/<ផ្នែក>/  ការគូរទាំងអស់ (មើលផ្នែក ១០)            │
│    hooks/            useStore()                              │
│    actions.ts        onAct() ➜ ចុះបញ្ជីសកម្មភាព               │
├─────────────────────────────────────────────────────────────┤
│  src/ui/           កាយវិការ និងចលនា (PTR · ការអូសផ្ទាំង ·     │
│                     ការលាក់របា) បូក *តក្កវិជ្ជា* នៃការគូរ      │
│                     ដែលផ្សាយចូលឃ្លាំង ➜ React គូរ             │
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
│  src/core/         ឃ្លាំង state · នាឡិកា · storage · DOM ·   │
│                     តំបន់ម៉ោង · ចុះបញ្ជីសកម្មភាព               │
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
| `uiState` | ប្រអប់ · តម្រង · ទំព័រ · Locker · ចលនា |
| `securityState` | PIN · ក្រយៅដៃ · សោ App · កូនសោ Lookup |
| `lookupState` | តារាងអតិថិជន · ការត្រៀម ZTO |
| `sheetImportState` | ដំណើរការនាំចូល Excel |
| `ztoState` | សាលក្រម ZTO · ជុំបោស · ការទាញបញ្ជី |

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

1. `index.html` ➜ `boot-flags.js` (ទង់ iOS · font) ➜ `zxing-wasm` ·
   `firebase-loader` · `license-verify` · `error-reporting`
2. `src/main.tsx` ➜ `createRoot(#root).render(<App/>)`
3. `<App>` ➜ `useLayoutEffect` ➜ `runLegacyBootstrapStatements()`
   — statement កម្រិតកំពូលទាំង ៨ របស់ `app.js` ដើម តាមលំដាប់ដដែល
4. `runOnWindowLoad()` ➜ Firebase · License · listener · timer

⛔ **ជំហានទី ៣ ប្រើ `useLayoutEffect` មិនមែន `useEffect`** ៖ កូដ imperative
អាន DOM ភ្លាមៗ ➜ វាត្រូវរត់ក្រោយ DOM ចុះ តែមុនការគូរ ដូច `<script>` នៅចុង
`<body>` ដើមបេះបិទ។

⛔ **`runOnWindowLoad()` ជំនួស `window.addEventListener('load', …)`** ៖ React
អាច mount *ក្រោយ* `load` ➜ អ្នកស្តាប់នឹងមិនបាញ់ជារៀងរហូត ➜ App មិនចាប់ផ្តើម
សោះ ដោយស្ងាត់។

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

⛔ ដំណើរការនេះ **ធ្វើម្តងទៀតបាន** ៖ លុប `src/` ចេញ រួចរត់ `tools/generate.sh`
នោះទទួលលទ្ធផលដដែល។ ការកែដោយដៃក្នុងឯកសារដែលកើតដោយស្វ័យប្រវត្តិ នឹងបាត់។

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

⛔ **ពេលកូដបន្ទាប់ *វាស់* អ្វីដែលទើបផ្សាយ ត្រូវហៅ `renderNow(store)`**
(`flushSync`) ជាមុន — បើមិនដូច្នេះវាវាស់ DOM **មុនការគូរ**។ វាស់បាន ៖
`showGlobalMoreMenu()` វាស់ទទឹងម៉ឺនុយមុនធាតុចុះ ➜ គ្មានការទាញចូលវិញ ➜
ម៉ឺនុយហៀរក្រៅអេក្រង់។ កន្លែងដែលត្រូវការវា ៖ ម៉ឺនុយ (...) និងផ្លូវបោះពុម្ព PDF។

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
| សម្អាតតាមបញ្ជី id (ឧ. ពេលចាកចេញ) | `if (resetReactOwned(id)) return;` ជា **statement ដំបូង** នៃរង្វិលជុំ |
| បន្ថែម slot ថ្មី | ប្រកាស `reset:` ក្នុង `SLOTS` (`tools/html-to-jsx.cjs`) — បើអត់ ការផលិត **ធ្លាក់** |

អ្នកយាម ៖ `npm run slot:check` (ក្នុង `verify`) ស្កេន AST នៃកូដដែលផ្ទេរមក រកការប៉ះ
កូនរបស់ id ដែល **ដេរីវេពី `SLOTS`/`ELEMENT_SLOTS` ពិត** — ទាំងដោយផ្ទាល់
(`const box = byId('phoneSuggestBox')`) និងតាមរង្វិលជុំលើបញ្ជី id។ វាស់រួចថាវាធ្លាក់ ៖
ការដក `resetReactOwned` ចេញ ➜ ៣១ កន្លែង · ការបន្ថែម `box.innerHTML = ''` ➜ ១ កន្លែង។

### ⛔ ប្រភេទរបស់ទិដ្ឋភាពដែល component អាន

`uiState.healthRows` មាន type `HealthRow[]` (មិនមែន `any`) ➜ អ្នកសាងជួរដែលត្រឡប់
**ខ្សែអក្សរ HTML** ត្រូវ TypeScript បដិសេធពេល build។ វាស់បាន ៖ ជួរ 🩺 ទាំង ៩ ធ្លាប់
ត្រឡប់ HTML ➜ ប្រអប់ទទេ ខណៈ parity ស្តាទិច ១០០%។

### ⛔ សកម្មភាពនៃធាតុដែល React គូរ

ធាតុដែលកាន់ `data-act` ត្រូវ **ជ្រើសផ្លូវតែមួយ** ៖

| ផ្លូវ | ប្រើពេលណា |
|---|---|
| `data-act` (គ្មាន `onClick`) | ធាតុដែលរស់ក្នុងម៉ឺនុយ ឬក្នុងការគូរដែលនៅជាខ្សែអក្សរ HTML — `setupActionDelegation()` នៅតែស្តាប់នៅកម្រិត `document` |
| `onAct(...)` (គ្មាន `data-act`) | ធាតុក្នុងសំបកដែល React គូរទាំងស្រុង |

⛔ **ទាំង ២ លើធាតុតែមួយ = សកម្មភាពរត់ពីរដង** (ច្បាប់ ៤ នៃ «CSP និង
`data-act`» — ធ្ងន់បំផុតលើការលុប)។ វាស់បាន ៖ ការដក `data-act` ចេញពី
ប៊ូតុងម៉ឺនុយ (...) ធ្វើឲ្យម៉ឺនុយទាំងមូលស្លាប់ ➜ `parity:live` ចាប់បាន។

### ⛔ អ្វីដែលនៅ imperative ដោយចេតនា

| កន្លែង | ហេតុអ្វី |
|---|---|
| ចលនារបស់ PTR (`style.transform` រាល់ `touchmove`) | React គូរ *ធាតុ* (`PtrIndicator`) ចំណែកកាយវិការកាន់ *ចលនា* ៖ ការគូរឡើងវិញរាល់ស៊ុមនៃម្រាមដៃ ប្តូរឥរិយាបថនៃតំបន់ដែល `CLAUDE.md` ហាមប៉ះ |
| `<link rel=preconnect>` · `<script>` loader | ពួកវារស់ក្នុង `<head>` ដែល React មិនជាម្ចាស់ |
| `<canvas>` ក្រៅអេក្រង់ (ស្កេន · QR · registry) | មិនដែលចូល DOM ➜ វាមិនមែនការគូរ |
| `<a download>` ដែលចុចរួចលុបភ្លាម | ការទាញយកត្រូវកើតក្នុង tick ដដែលនឹងការចុច |
