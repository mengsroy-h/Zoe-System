# របាយការណ៍ parity ៖ ZoeW ➜ ZoeW React

> **សំណួរដែលឯកសារនេះឆ្លើយ** ៖ «តើមុខងារណាមួយបាត់ទេ?»
>
> ចម្លើយមិនមែនជាការអះអាងទេ — វាជា **លេខដែលវាស់បាន** ដោយ script ដែល
> រត់ឡើងវិញបាន។ រាល់តារាងខាងក្រោមផលិតដោយពាក្យបញ្ជាដែលសរសេរជាប់។

---

## ១. កាតាឡុក (ស្តាទិច)

```bash
npm run parity
```

ប្រៀបធៀប **កាតាឡុកពេញលេញ** របស់ `ZoeW/app.js` ដើមនឹងកូដថ្មី។ រាល់បញ្ជី
**ដេរីវេពី AST ពិត** មិនមែនសរសេរដោយដៃ ៖

| អ្វីដែលវាស់ | របៀបដេរីវេ |
|---|---|
| Function កម្រិតកំពូល | `FunctionDeclaration` ក្នុង `ast.body` របស់ `app.js` ធៀបនឹង export របស់ module |
| ថេរ (`const`) | `VariableDeclaration` kind `const` |
| State (`let`) | `VariableDeclaration` kind `let` ធៀបនឹងវាលក្នុងឃ្លាំង |
| ឈ្មោះសកម្មភាព | `ACTION_ALLOWLIST` ធៀបនឹង `ACTION_REGISTRY` |
| `id` ក្នុង `index.html` | regex លើ HTML ដើម ធៀបនឹង component និង `index.html` ថ្មី |
| កូនសោ storage | string literal ដែលចាប់ផ្តើមដោយ `zoew_` · `zoe_` · `zoeadmin_` … |
| អត្ថបទខ្មែរដល់អ្នកប្រើ | រាល់ string literal និង template quasi ដែលមានអក្សរខ្មែរ |
| `style.css` | ប្រៀបធៀប **byte-for-byte** |

⛔ **អត្ថបទខ្មែរ** ជាការវាស់ដ៏មានតម្លៃជាងគេក្នុងចំណោមនេះ ៖ វាចាប់បាន
សារ toast · ស្លាកប៊ូតុង · អត្ថបទប្រអប់ · ចំណងជើងជួរឈរនាំចេញ ដែលបាត់។
វាបានចាប់កំហុសពិត **២** ក្នុងការសាងឡើងនេះ ៖ ការ dedent ដែលកាត់ចូល
ខាងក្នុង template literal (ធ្វើឲ្យ HTML នាំចេញប្រែ) និងលំដាប់ធាតុ root។

---

## ២. DOM និង layout (browser ពិត)

```bash
node scripts/parity-dom.mjs
```

បើក App ទាំង ២ ក្នុង Chromium នៅ **ទំហំអេក្រង់ ៣** រួចប្រៀបធៀប ៖

- **ដើមឈើធាតុទាំងមូល** — tag · attribute · អត្ថបទផ្ទាល់ តាមលំដាប់ឯកសារ
- **ធរណីមាត្រ និងរចនាប័ទ្មគណនា** នៃធាតុគន្លឹះ (`rect` · `display` ·
  `position` · `order` · `overflow-y` · `flex` · `z-index` · `font-size`)

ការធ្វើទម្រង់ឲ្យដូចគ្នា ៖

- `style` inline ឆ្លងកាត់ **CSSOM របស់ browser ខ្លួនឯង** ➜ `#ef4444`
  និង `rgb(239, 68, 68)` ប្រៀបធៀបស្មើគ្នា
- attribute នៃសកម្មភាព (`data-act` …) ត្រូវលើកលែង ព្រោះ App ថ្មីប្រើ
  handler របស់ React — ការគ្របដណ្តប់របស់វាត្រូវវាស់ដាច់ដោយឡែក (ផ្នែក ៤)

---

## ៣. ទិន្នន័យពិត និងអន្តរកម្ម (browser ពិត)

```bash
node scripts/parity-live.mjs
```

នេះជាការវាស់ **សំខាន់ជាងគេ** ៖ ផ្នែក ២ ប្រៀបធៀបសំបកទទេ ចំណែកតេស្តនេះ
បើក App ទាំង ២ ជាមួយ **RTDB ក្លែងក្លាយដដែល** (`scripts/fake-firebase.mjs`
— path · listener · transaction · increment ពិត) រួចប្រៀបធៀប ៖

| ក្រុម | អ្វីដែលប្រៀបធៀប |
|---|---|
| តារាង | ប្រវត្តិ · បញ្ជីស្កេន · បញ្ជី Locker · ធុងសំរាម (HTML ធ្វើទម្រង់រួច) |
| ស្ថិតិ | កញ្ចប់សរុប · ស្កេនតាមថ្ងៃ · អតិថិជនយក · កញ្ចប់យករួច |
| លុយ | COD · DOD · សរុប — ទាំងដុល្លារ និងរៀល |
| **ការសរសេរទៅ server** | `writeLog` ពេញលេញ (op + path) |
| សុខភាព | កំហុស runtime · promise ដែលបដិសេធ · listener ដែលបោះ |

⛔ **`writeLog` ជាការវាស់ដ៏មុតជាងគេ** ៖ វាបញ្ជាក់ថា App ទាំង ២ បាន
សម្រេចចិត្ត **ដូចគ្នាបេះបិទ** អំពី *អ្វីដែលត្រូវសរសេរទៅ Firebase* —
រួមទាំងការសម្អាតស្វ័យប្រវត្តិដែលរត់អំឡុងការផ្ទុក។ លេខលើអេក្រង់អាច
ដូចគ្នាដោយចៃដន្យ; ការសរសេរទៅ server មិនអាចទេ។

បន្ទាប់មកវារត់ **ជំហានអន្តរកម្ម** ដូចគ្នាបេះបិទលើ App ទាំង ២ (តម្រង ·
ប្រអប់បញ្ជី · ទំព័រស្កេន · របៀប Locker និងដក · របា Slide · ម៉ឺនុយ (...) ·
ធុងសំរាម) ហើយប្រៀបធៀបអេក្រង់ទាំងមូលក្រោយជំហាននីមួយៗ។

⛔ **ជាន់អប្បបរមា** ៖ ជំហានដែល *មិនប្តូរអេក្រង់សោះ* ត្រូវរាយជា
«អេក្រង់មិនប្រែ» ➜ ការអះអាង «ដូចគ្នា» លើអេក្រង់ដែលមិនប្រែ ពិតដោយ
ស្វ័យប្រវត្តិ ហើយមិនបានវាស់អ្វីទេ។

⛔ **ជំហានត្រូវជាការចុចរបស់អ្នកប្រើ ប៉ុណ្ណោះ** ។ ជំនាន់មុននៃ script នេះ
ហៅ `window.setEntryScanMode()` ដោយផ្ទាល់ ➜ វាដើរលើ App ចាស់ (script សកល)
តែមិនដើរលើ App ថ្មី (module) ➜ វាវាស់ភាពខុសគ្នារបស់ **ឧបករណ៍** មិនមែន
របស់ **App**។ នោះជាភាពខុសគ្នាក្លែងក្លាយ ហើយវាត្រូវបានកែ។

---

## ៣ខ. ផ្លូវលុយ · ចាកចេញ · ZTO · Google Sheet · PDF (browser ពិត)

```bash
npm run parity:deep
```

សេណារីយ៉ូ ៣ (ស្នូល · ZTO · Google Sheet) ដែលដើរ **ផ្លូវសរសេរលុយទាំងអស់** ៖ ស្កេន ·
បិទ/បើក · បិទ barcode · កែតម្លៃ · សម្គាល់ការខល · កែលេខ · លុប · ស្តារ · លុបជាអចិន្ត្រៃយ៍ ·
ដកតាមស្កេន · Locker · អត្រាប្រាក់ · Reset ចំនួនយក · កែទឹកប្រាក់ · លុបទាំងអស់ · នាំចូល
Excel ទៅ Sheet · ទាញ និងបញ្ចូលបញ្ជី ZTO · ស្កេនដែល ZTO/Sheet បំពេញស្វ័យប្រវត្តិ ·
PDF ២ · ចាកចេញ និងចូលវិញ។ Apps Script និង Netlify Function ZTO ត្រូវក្លែងដូចគ្នា
ទាំង ២ App ➜ **តួសំណើ** (ជួរដេក · លុយ · លេខទូរស័ព្ទ) ត្រូវប្រៀបធៀបផង។

រាល់ជំហាន ៖ អេក្រង់ · ការសរសេរ (តម្លៃពេញ) · DB ទាំងមូល · ប្រអប់ native · សំណើ ·
សារ toast · ផ្ទៃបោះពុម្ព ត្រូវ **ដូចគ្នា** ហើយជំហានត្រូវ **ប្តូរអ្វីមួយ** (ជាន់អប្បបរមា)។
បន្ទាប់ពីចាកចេញ ៖ អត្ថបទអេក្រង់ត្រូវគ្មានលេខទូរស័ព្ទ ឬ Barcode របស់អតិថិជន
លើសពី App ដើម។

## ៤. តេស្ត differential នៃការគូរ

```bash
npm test
```

តារាងប្រវត្តិត្រូវសរសេរឡើងវិញជា React component ពិត។ ភាពដូចគ្នាត្រូវវាស់
**មិនមែនសន្មត** ៖

- `buildHistoryRowHtml()` ចាស់ ធៀបនឹង `<HistoryRow>` ថ្មី លើទិន្នន័យ
  **ចៃដន្យ ៣០០ ធាតុ** ដែលគ្រប ៖ គ្មានលេខទូរស័ព្ទ · សញ្ញាខល ៤ ប្រភេទ ·
  បិទ/បើក · មាន/គ្មាន barcode · COD តែម្យ៉ាង · DOD តែម្យ៉ាង · ទាំង ២ ·
  សូន្យ · Locker ច្រើន · អក្សរដែលព្យាយាមចាក់ HTML
- **ការចុចពិតក្នុង DOM** ៖ រាល់ធាតុដែលចុចបាន ត្រូវចុច រួចប្រៀបធៀប
  *សកម្មភាពដែលហៅ និងអាគុយម៉ង់របស់វា* នឹង `data-act` ចាស់

---

## ៥. checker របស់ `audit-tools/`

```bash
npm run audit:build      # ➜ dist-audit/ZoeW
npm run audit:run        # checker នីមួយៗ ចង្អុល *_APP_DIR មក tree នោះ
```

ឬរត់ `run-all.sh` ដូច CI លើ repo ស្រមោលដែល `ZoeW/` ជា `dist-audit/ZoeW` ។

checker ១៨០+ របស់ ZoeW ដើមត្រូវសរសេរសម្រាប់ស្ថាបត្យកម្ម **ឯកសារតែមួយ ·
global · អត្ថបទថេរ**។ `scripts/build-audit.mjs` សាង tree ដែល ៖

- **`index.html` · `assets/` · `sw.js`** = build របស់ Vite ដដែលនឹងផលិតកម្ម បូក
  `VITE_EXPOSE_GLOBALS=1` ➜ checker browser បើក **App React ពិត**។
- **`app.js`** = bundle IIFE ដែលមិន minify នៃ module តក្កវិជ្ជា — **មិនត្រូវ
  `index.html` ផ្ទុក** ទេ ៖ វាមានសម្រាប់តែ checker ដែលស្រង់អត្ថបទ។
- `netlify.toml` · `package.json` · Function · README = **ច្បាប់ចម្លងពី tree ថ្មី**
  (⛔ មិនមែនឯកសាររបស់ ZoeW ដើម — នោះជាការវាស់ឯកសារចាស់)។

### ⛔ អ្វីដែលវាបញ្ជាក់ និងមិនបញ្ជាក់

checker ដែលវាស់ **ឥរិយាបថតាម browser ឬតាម `window`** ដើរ — រួមទាំង checker
លុយ (`revenue-fuzz` · `ledger-clamp-symmetry` · `collected-mirror-*` ·
`stats-truth` · `slow-write` · `field-shape`) និងតំបន់ហាមចូលទាំង ៣
(`gesture` · `panel-motion` · `ios-panel-glide`)។

checker ដែល **ធ្លាក់ដោយរចនាសម្ព័ន្ធ** មាន ៣ ថ្នាក់ ៖

| ថ្នាក់ | ហេតុ | ឧទាហរណ៍ |
|---|---|---|
| ស្រង់អត្ថបទពី `app.js` | bundler សរសេរ `var` ជំនួស `const` · ប្តូរឈ្មោះពេលជាន់គ្នា (`sanitizeInput2`) · state ឥឡូវជា `firebaseState.db` · marker ផ្លាស់ទី · `sw.js` minify | `policy-test` · `html-sink-escaping` · `sw-cache-key` (ផ្នែកស្តាទិច) |
| អាន markup ថេរក្នុង `index.html` | markup ឥឡូវជា JSX ➜ `index.html` មានតែ `#root` | `wiring` · `version-check` · `secret-hygiene` · `action-binding-test` |
| ជំនួស `window.<fn>` ដើម្បីចាប់ ឬ stub | ការហៅខាងក្នុង module ឆ្លងកាត់ **ES binding** មិនមែន `window` ➜ ការជំនួសមិនប៉ះ | `duplicate-scan` (`window.showToast = …`) · `duplicate-money` |

⛔ **ការធ្លាក់ទាំងនោះ មិនមែនភស្តុតាងថាគ្មានកំហុសទេ** — វាមានន័យថា
**checker នោះមិនបានវាស់ App នេះ**។ ការវាស់ឥរិយាបថជំនួសរស់នៅផ្នែក ២ · ៣ · ៤
ខាងលើ ហើយវាប្រៀបធៀបនឹង **App ចាស់ដែលកំពុងរត់ពិតៗ**។ ការផ្ទេរ checker ទាំងនោះ
មកស្ថាបត្យកម្ម module ជាការងារដែលនៅសល់ (មើល [`MIGRATION.md`](MIGRATION.md))។

⛔ **checker ដើមរកឃើញកំហុសពិតដែល parity មើលមិនឃើញ** ៖ `"type": "module"`
ក្នុង `package.json` ធ្វើឲ្យ Node ផ្ទុក Function ZTO (`require`) ជា ES module ·
`package-lock.json` ឃ្លាតពី `package.json` · sourcemap ship កូដដែលមាន
comment · README ខុសច្បាប់ ៩ ➜ កែរួចទាំងអស់។ ⛔ មេរៀន ៖ parity ប្រៀបធៀប
**App** ចាស់នឹងថ្មី តែ Function ខាង server និងឯកសារ repo **ស្ថិតក្រៅ** App ➜
checker ដើមនៅតែចាំបាច់។

---

## ៦. អ្វីដែល *ប្រែដោយចេតនា*

| អ្វី | ដើម | ថ្មី | ហេតុអ្វី |
|---|---|---|---|
| ការហៅសកម្មភាព | `data-act` + delegation លើ `document` | **ផ្លូវ ២ ដែលមិនជាន់គ្នា** ៖ ធាតុក្នុងសំបក ➜ handler របស់ React · ធាតុក្នុងម៉ឺនុយ និងការគូរដែលជាខ្សែអក្សរ ➜ `data-act` + delegation ដដែល | ព្រំដែន allowlist នៅដដែល តែពិនិត្យពេល build។ ⛔ ទាំង ២ លើធាតុតែមួយ = រត់ពីរដង |
| ការចុះឈ្មោះ toast | ធាតុក្នុង DOM | បញ្ជីក្នុងឃ្លាំង (`uiState.toasts`) | កន្លែងហៅគ្មានណាមួយអានតម្លៃត្រឡប់ ➜ អត្តសញ្ញាណផ្លាស់ពីធាតុទៅកូនសោបាន; ច្បាប់ទាំង ៥ (ពិដាន ៤ · អ្នកបោះរំលង toast រស់ · class តាមសញ្ញា · `.show` ២ ដំណាក់ · ការប្រកាសឡើងវិញ) មានតេស្តចាក់សោ |
| `<select>` ៧ | តម្លៃរស់ក្នុង DOM | តម្លៃរស់ក្នុងឃ្លាំង (controlled) | React គូរ `<option>` ➜ ការអាន `sel.value` អាចមកមុនការគូរ ➜ ការប្រណាំងលំដាប់ |
| សញ្ញា PTR | `createElement` ពេល setup | React គូរ (`PtrIndicator`) · កាយវិការកែ `style.transform` ដដែល | ចលនាតាមម្រាមដៃមិនត្រូវឆ្លងកាត់ការគូរឡើងវិញរបស់ React |
| ការគូរជួរដេកប្រវត្តិ | ខ្សែអក្សរ HTML + diff ដោយដៃ | React component + `key` | React គេច escape ដោយស្វ័យប្រវត្តិ |
| បញ្ជីសំបករបស់ SW | សរសេរដោយដៃ | ដេរីវេពី `dist/` ពិត | ធនធានថ្មីដែលភ្លេច ➜ ស្កេនស្លាប់ក្រៅបណ្តាញ |
| ឈ្មោះឯកសារ bundle | ថេរ | មាន hash | cache របស់ browser មិនចាស់ |
| `firebase-loader.js` | `<script type="module">` | script ធម្មតា + `import()` | Vite ព្យាយាម bundle module script ➜ build ធ្លាក់ |
| `#root` | គ្មាន | `display: contents` | React ត្រូវការ host; `display:contents` រក្សា layout |

⛔ **គ្មានការប្រែណាមួយក្នុងតារាងនេះ ប៉ះច្បាប់អាជីវកម្មទេ** ៖ ledger ·
`isDeducted` · ច្បាប់ ២ម៉ោង/៧ថ្ងៃ/៣០ថ្ងៃ/២ថ្ងៃ · ស្ថិតិយកតាមសំណុំ barcode ·
កញ្ចក់ចំណូលប្រចាំថ្ងៃ · License · ZTO — ទាំងអស់ជាការផ្ទេរ ១:១។
