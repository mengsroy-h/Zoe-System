# ប្រវត្តិ Zoe-System — សម័យ ZoeW React (ពី 2.38.0)

> ⛔ **ឯកសារនេះជា *ប្រវត្តិ* មិនមែន *ច្បាប់* ទេ** — ច្បាប់ដែលត្រូវអនុវត្តរស់នៅ [`CLAUDE.md`](../CLAUDE.md) ហើយច្បាប់
> នីមួយៗចងទៅ **ឧបករណ៍ដែលចាក់សោវា**។ ត្រង់នេះទុក *ហេតុអ្វី* ច្បាប់មួយមាន · របៀបដែលកំហុសត្រូវរកឃើញ · **លេខដែលវាស់បាន**។
>
> ⛔ **ប្រវត្តិរស់នៅ ២ ឯកសារក្នុងថត `docs/` នៅ root តែប៉ុណ្ណោះ** (`CLAUDE.md` ច្បាប់ ៩) ៖
>
> | ឯកសារ | គ្របអ្វី |
> |---|---|
> | **`docs/HISTORY.md`** (ឯកសារនេះ) | សម័យ **ZoeW React** ៖ ZoeW `2.38.0` ➜ ឥឡូវ (ពី 2026-09-23) · **ធាតុថ្មីទាំងអស់សរសេរនៅទីនេះ** |
> | **[`docs/HISTORY-ARCHIVE.md`](HISTORY-ARCHIVE.md)** | សម័យ **ZoeW vanilla** ៖ ZoeW ≤ `2.37.3` · ZoeKeyGen ≤ `2.20.2` (ដល់ 2026-09-18) · កំណែមុន `2.20.0` · អត្ថបទដែលដកចេញពី `CLAUDE.md` · **អានបានតែមិនបន្ថែម** |
>
> ⛔ **កុំអានពីដើមដល់ចប់** — វាជាឯកសារយោង។ ផ្លូវធម្មតា ៖ checker ធ្លាក់ ➜ `grep -n "<ឈ្មោះ checker>" docs/HISTORY*.md`
> (គ្របទាំង ២ ឯកសារ) ឬមើល **[🔎 លិបិក្រម](#-លិបិក្រម--ឈ្មោះ-checker--ការពន្យល់រស់នៅឯណា)** នៅចុងឯកសារនេះ។
>
> | ត្រូវការអ្វី | មើលកន្លែងណា |
> |---|---|
> | «សកម្មភាពដែលត្រូវធ្វើដោយដៃ» · អ្នកប្រើឃើញអ្វីខុសពីមុន | **ផ្នែក ១** (ឯកសារនេះ) · កំណែ ≤ 2.37.3 ➜ archive ផ្នែក ១ |
> | ហេតុអ្វី checker មួយមាន · លេខ mutation · ការវាស់ដែល **បដិសេធ** សម្មតិកម្ម | **ផ្នែក ២** (ឯកសារនេះ) · archive ផ្នែក ២ |
> | កំណែមុន 2.20.0 · អត្ថបទដែលដកចេញពី `CLAUDE.md` | archive ផ្នែក ៣ · ៤ · ៥ |
>
> ### ⛔ ច្បាប់សរសេរ (រាល់ជុំ audit)
>
> ១. **រាល់ការឡើងកំណែត្រូវបន្ថែមធាតុថ្មីនៅខាងលើគេនៃ ផ្នែក ១ *របស់ឯកសារនេះ*** ក្នុង commit ដដែល ៖ ជាភាសាខ្មែរ ប្រាប់ថា
>    *អ្នកប្រើឃើញអ្វីខុសពីមុន* ហើយបញ្ជាក់ **«សកម្មភាពដែលត្រូវធ្វើដោយដៃ»** ជានិច្ច (ឬ «គ្មាន»)។
> ២. **កំហុសពិតដែលរកឃើញ ➜ ផ្នែក ២** ៖ របៀបដែលវារកឃើញ · មូលហេតុឫសគល់ · **លេខដែលវាស់បាន** · checker ដែលចាក់សោវា · លទ្ធផល mutation។
> ៣. ⛔ **កុំបន្ថែមធាតុថ្មីក្នុង archive** · ⛔ កុំយកខ្លឹមសារនេះទៅដាក់ក្នុង `README.md` (README សរសេរតែ *របៀបប្រើ*) ឬក្នុងកូដជា comment។
>
> ```text
> ### [X.Y.Z] — YYYY-MM-DD · ចំណងជើងខ្លី
> **<App ណាប្រែ>** (`<cache-key ចាស់>` ➜ `<ថ្មី>`)។ ⛔ **<App មួយទៀត> មិនប្រែ**។
> #### អ្វីដែលខុសពីមុន · អ្នកយាម · សកម្មភាពដែលត្រូវធ្វើដោយដៃ
> ```
>
> ⛔ **`CACHE_VERSION` មិនមែនជា `APP_VERSION` ទេ** — `CACHE_VERSION` (`<app>-vN`) ឡើងរាល់ពេលឯកសារ static ប្រែ ចំណែក
> `APP_VERSION` ជាកំណែផលិតផល (semver)។ **កំណែជារបស់ App នីមួយៗ** — ឡើងតែ App ដែលកែពិត (`version-check` · `version-bump-scope`)។

---

## 📗 ផ្នែក ១ — កំណត់ត្រាតាមកំណែ (សម័យ React · អ្នកប្រើឃើញអ្វីខុសពីមុន)

### [2.42.6] — 2026-09-26 · ZoeW · ZoeKeyGen ៖ **Deep audit ៖ 🔴 transaction `disconnect` ដែល server អនុវត្តរួច** · Sentry លែងទទួលព្យុះកំហុសដដែល · កូដ React គ្មាន comment (branch · មិនទាន់ merge)

#### 🔴 `disconnect` ≠ «មិនបានអនុវត្ត» (កំហុសលុយ · checker ១៨២+ បៃតងលើ tree នោះ)

- **អ្វីដែលអ្នកប្រើអាចជួប** ៖ បណ្តាញដាច់ចំពេលការសម្អាតស្វ័យប្រវត្តិ (២ ម៉ោង/៧ ថ្ងៃ) ឬការកែទឹកប្រាក់ ➜ Firebase SDK បដិសេធ
  transaction ដោយ `disconnect` ខណៈ server **commit រួច** (ack បាត់ក្នុងផ្លូវ) ➜ App ចាត់ទុកថា «មិនបានកើត» ៖ ការសម្អាត **មិនសរសេរ
  ធុងសំរាម** (កញ្ចប់បាត់ពីទាំងប្រវត្តិ ទាំងធុងសំរាម) ហើយ **មិនដកលុយ** · ការកែ ledger ទៅតម្លៃពិត **ដក ២ ដង**។
- **ភស្តុតាង** ៖ SDK Firebase ពិត (កំណែដដែលនឹង CDN `12.19.0`) + RTDB emulator ពិត + proxy TCP ដែលកាត់ការតភ្ជាប់ **ក្រោយ** frame
  `put` របស់ transaction ទៅដល់ server ➜ promise reject `disconnect` ខណៈ server ប្រែរួច។ ⛔ `fb.get()` មិនអាចជាអ្នកសម្រេច ៖ listener
  សកម្ម ➜ វាឆ្លើយពី cache ក្នុងស្រុក។ លើកូដមុនកែ (`tx-outcome-test`) ៖ កញ្ចប់ **មិនចូលធុងសំរាម** · ledger ថ្ងៃ/ខែ **នៅ 100**
  (ត្រូវ 92.25) · ចំនួនកញ្ចប់ **20** (ត្រូវ 18) · `correctRevenueLedgerToActual` ៖ **100 ➜ 90** (ត្រូវ 95) · Sentry money ក្លែង
  «Automatic cleanup transaction failed»។
- **ការកែ** (ចំណុចច្របាច់តែមួយ ⛔ មិនមែនកែកន្លែងហៅ ៤០+) ៖ `src/services/tx-outcome.ts` ➜ `withTransactionOutcomeResolution()` រុំ
  `fb` ម្តងក្នុង `initFirebase()` ➜ រាល់ `fb.runTransaction` ដែលបដិសេធ `disconnect` អាន server តាម **REST + ID token**
  (`cache: 'no-store'` · host ត្រូវស៊ីនឹង `databaseURL` · ពិដានការអាន ៨ វិ. · ការព្យាយាមមានព្រំដែន ៣០ ដង/៦០ វិ.) ហើយប្រៀបនឹងតម្លៃ
  **ដែលបានផ្ញើ** និង **មុនផ្ញើ** (ថតមុន updater កែ `current`) ៖ `applied` ➜ `{ committed: true, txOutcome: 'applied' }` · `not-applied`
  ➜ បដិសេធដដែល (សម្គាល់ `txOutcome` ➜ ការសម្អាតលែងផ្ញើ Sentry money ក្លែង) · `unknown` ➜ បដិសេធ + Sentry `zone: 'money'` ១ ដង/path។
  ការសម្អាតដែល commit យឺត ពិនិត្យ `cleanupClaimAccountedElsewhere()` (ធុងសំរាមលើ server · barcode ក្នុងធុងសំរាមថ្មីៗ) មុនសរសេរ ➜
  ឧបករណ៍ ២ មិនសរសេរធុងសំរាម/ដកលុយស្ទួន។
- **អ្នកយាម** ៖ `tx-outcome-test` (sandbox ពិត · ការសម្អាត ២ ផ្លូវ · ledger · `unknown` · ការអានធ្លាក់មានព្រំដែន · wrapper អាន
  `runTransaction` ពេលហៅ) ➜ **ធ្លាក់ ១៩ លើកូដមុនកែ** (`❌ ធ្លាក់ 19 / ok 20`) · `emu/tx-disconnect-emu-test` (SDK ពិត · emulator ពិត · ករណី applied និង
  not-applied) ➜ **ធ្លាក់ ៣ លើកូដមុនកែ** · `money-guardian-test` mutation ២ ថ្មី (ដកការអាន server · ដកការពិនិត្យម្ចាស់ធុងសំរាម) ➜ ក្រហមពិត។

#### Sentry ៖ ព្យុះកំហុសដដែល

- listener ដែល rules បដិសេធ (`permission_denied`) ត្រូវភ្ជាប់ឡើងវិញតាមជណ្តើរស្តារ ➜ **រាល់ជុំ × រាល់ path** ផ្ញើ event ទៅ Sentry
  (វាស់ ៖ ៦ ជុំ × ៧ path = **៤៩ event** ក្នុងការដាច់តែមួយ ➜ ស៊ីកូតា Sentry · បាំងកំហុសពិត)។ ការកែ ៖ `dbListenerReportedFailures` ➜
  **១ ដង/path/ការដាច់** (លុបពេល path រស់វិញ ➜ ការដាច់ថ្មីរាយការណ៍ម្តងទៀត) ➜ **៧**។ បូក `ZoeErrors.capture()` ក្នុង `error-reporting.js`
  (App ទាំង ២ · byte-identical) ដក event ដដែល (zone · context · message) ក្នុង ១០ នាទី ហើយភ្ជាប់ `suppressedRepeats` ទៅ event បន្ទាប់
  (ពិដាន ២០០ signature · នាឡិកាថយក្រោយ ➜ fail-open)។ អ្នកយាម ៖ `connection-recovery-test` ផ្នែក ៣ខ (មុនកែ ៖ `captures: 49`) ·
  `sentry-load-race-test` ផ្នែក ៦។

#### ZTO parity · សុវត្ថិភាព · ឯកសារ vanilla · comment

- **ZTO ធៀប ZoeW vanilla** ៖ `logic:check` (តួ function ទាំងអស់ដូចដើម លើកលែងការកែដែលមានហេតុផល) + ការប្រៀបថេរ ZTO ទាំងអស់ ➜
  **ស៊ីគ្នា** (គ្មានការកែ)។ **សុវត្ថិភាព** (XSS · secret · CSP · ការលាក់ Sentry) ៖ គ្មានចន្លោះថ្មី — event `unknown` ផ្ទុកតែ `pathname`
  ហើយ ID token ក្នុង `?auth=` របស់ការអាន REST (breadcrumb `fetch`) ត្រូវលាក់ដោយ `SECRET_PARAM_PATTERN` ស្រាប់ (`secret-hygiene` វាស់ករណីនេះ)។
- **ឯកសារសម័យ vanilla** ៖ ដក `ZoeW/scripts/package.sh` + script `npm run package` (ខ្ចប់ zip សម្រាប់ប្រគល់ពីសម័យផ្ទេរ · គ្មានអ្នកប្រើ)។
  ⛔ `.original/` · `parity-*` · `logic-identity` · `old-app.mjs` **នៅដដែលដោយចេតនា** ៖ ពួកវាជាអ្នកយាម parity ដែលរត់ក្នុង `verify`/`parity:all`។
- **comment** (សំណើម្ចាស់គម្រោង) ៖ លុប **៧០១** comment ក្នុង **១១៥** ឯកសារ (`src/**` · Netlify Function · config) និង HTML comment ៥
  ក្នុង `index.html` ទាំង ២ App។ `ts-comments` (ថ្មី) ៖ TypeScript AST ➜ លុប ➜ **esbuild compile មុន/ក្រោយត្រូវដូចគ្នាបេះបិទ** (ខុស ➜
  មិនប៉ះឯកសារ) · `/// <reference …>` រក្សា។ `comments` វាស់ប្រភព React (ដេរីវេពីទីតាំង root វាស់ ➜ baseline ក៏វាស់ដែរ · root វាស់ដែលរក
  ប្រភពមិនឃើញ = FAIL) · `strip-comments` សម្អាត React/HTML។ `repository-contract-test` ៖ TSX ពិត + ករណី ASI (comment មានបន្ទាត់ថ្មីក្រោយ
  `return`) ត្រូវ **បោះបង់** ➜ mutation «រំលងការផ្ទៀងផ្ទាត់ compile» ធ្លាក់។ ESLint `no-empty` ទទួល `allowEmptyCatch` (catch ទទេ = ការលេប
  ដោយចេតនា ដែលពីមុនមាន comment បំពេញ)។ ផ្ទៀងផ្ទាត់ ៖ `npm run verify` (tsc · eslint · slot · purity · vitest · build · parity · smoke ·
  sw · doc · android · native) · `logic:check` · `parity:dom/live/deep` · `rules:check` បៃតងទាំងអស់។
- **អក្សរថៃ** ៖ ម្ចាស់គម្រោងចាប់បានថាការសន្ទនាលាយពាក្យថៃ (U+0E00–U+0E7F · ស្រដៀងខ្មែរ ➜ រអិលកាត់ភ្នែក) ➜ `doc-scope-test`
  ស្កេនគ្រប់ឯកសារអត្ថបទក្នុង repo រួម `ZoeW/src/**` (វាស់ ៖ repo **០** ជួរ · commit **០**)។ probe ៖ អក្សរថៃក្នុង `docs/` ➜ FAIL ·
  ក្នុង `ZoeW/src` ➜ FAIL · root វាស់រកប្រភពមិនឃើញ ➜ FAIL · ថតទទេ ➜ FAIL · ទិសផ្ទុយ ៖ អក្សរខ្មែរមិនត្រូវចាប់។ ⛔ វាចាប់ខ្លួនវាលើក
  ដំបូង ៖ comment របស់ checker ដាក់ពាក្យថៃជាឧទាហរណ៍ ➜ ដកចេញ (probe សាងពី code point)។
- **comment ក្នុង Gradle** (សំណើម្ចាស់គម្រោង · ក្រោយ merge #254) ៖ លុប comment **២៦** ក្នុង `android/build.gradle` · `android/app/build.gradle` ·
  `android/gradle.properties`។ `ts-comments` មាន lexer Groovy (string · slashy regex · ការចែក) និង properties (ជួរបន្ត `\` មិនមែន comment) ➜
  token ក្រៅ comment ត្រូវដូចគ្នាមុន/ក្រោយ។ ⛔ ឯកសារដែល Capacitor សាងឡើងវិញ (header «DO NOT EDIT» ៖ `capacitor.build.gradle` ·
  `capacitor.settings.gradle`) **លើកលែង** ព្រោះ `cap sync` សរសេរវាវិញ។ ភស្តុតាង ៖ APK `clean assembleRelease --rerun-tasks` មុន/ក្រោយ ➜
  **SHA-256 ដដែល** (`8aed3e6c…86fc28` · ធាតុ ៩៤១ + CRC ដូចគ្នា) · `comments` ធ្លាក់លើ tree មុនសម្អាត (៨ · ៣ · ១៥) · fixture ក្នុង `repository-contract-test` ចាប់ mutation ២ (ដក slashy · ដក
  continuation)។ ⛔ កំណែមិនឡើង (Gradle មិនមែនកូដ ship របស់ web ➜ `version-bump-scope`)។
- `firebase@12.19.0` ចូល `devDependencies` របស់ ZoeW (SDK ពិតសម្រាប់ `emu/tx-disconnect-emu-test` · **មិន ship** — App ផ្ទុក SDK ពី CDN ដដែល)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មានការកែ Firebase rules · គ្មាន env ថ្មី** ➜ merge ពេលម្ចាស់គម្រោងស្នើ ➜ Netlify build ខ្លួនឯង (`zoew-v233` · `zoekeygen-v103`)។
- **Sentry** ៖ event ថ្មីដែលអាចលេច ៖ `Transaction outcome unknown after disconnect` (`zone: money`) និង `Cleanup claim committed after
  disconnect but ownership unverified` — ⛔ វាមានន័យថា «ផ្ទៀងផ្ទាត់មិនបាន» ➜ ពិនិត្យ node នោះលើ Firebase Console (លុយមិនត្រូវប៉ះដោយ App)។
  event ដដែលៗឥឡូវមានវាល `suppressedRepeats` (ចំនួនដែលដកចេញក្នុង ១០ នាទី)។
- **សាកលើឧបករណ៍ពិត (ស្រេចចិត្ត)** ៖ បិទ WiFi ចំពេលកែទឹកប្រាក់ ➜ បើកវិញ ➜ លេខលើអេក្រង់ត្រូវស្មើ Firebase Console (មិនដក ២ ដង)។
- ✅ **តេស្តផ្សេងៗ (កំណែ 2.42.6/2.20.4 · ZoeKeyGen · View Source · APK · Sentry) — ម្ចាស់គម្រោងរាយការណ៍ថាដើរទាំងអស់**។ «View Source ៖ គ្មាន
  `<!--`» ៖ comment តែមួយដែលនៅសល់ (`This site is hosted on Netlify …` · `utm_source=ai-legible`) **Netlify បញ្ចូលនៅ Edge** ពេលផ្ញើទំព័រ
  មិនមែនមកពី repo (`index.html` ក្នុង repo និងលទ្ធផល build មាន `<!--` **០**) ➜ ⛔ កុំសរសេរ Edge Function ដើម្បីលុបវា (ហានិភ័យលើ SW · CSP ·
  ល្បឿន ដើម្បីអ្វីដែលគ្មានផលប៉ះពាល់)។ ZoeKeyGen មាន devtools guard ➜ ម្ចាស់គម្រោងចាត់ទុកចំណុចនោះបញ្ជាក់រួចតាម repo។
- ⏳ **តេស្តលុយលើឧបករណ៍ពិត** (បញ្ចូល · កែតម្លៃ · បិទ/បើក «យក» · ដក · ស្តារ · ការដាច់បណ្តាញចំពេលរក្សាទុក) — មិនទាន់បញ្ជាក់ ➜ `CLAUDE.md`
  «📌 ការងារដែលនៅសល់»។
- ⛔ សម្រាប់ developer ៖ `npm ci --prefix ZoeW` ម្តងទៀត (dependency `firebase` ថ្មី)។

### [2.42.5] — 2026-09-25 · ZoeW ៖ **🔴 hotfix ៖ iPhone ស្កេន Barcode មិនបាន ក្រោយ ZXing-WASM 3.1.4** · APK 2.42.4 build ក្នុង session · pin វិញ្ញាបនបត្រ keystore (merge #252)

#### 🔴 iPhone ស្កេនមិនបាន (របាយការណ៍ម្ចាស់គម្រោង ក្រោយ merge 2.42.4)

- **សញ្ញា** (Sentry breadcrumb) ៖ `LinkError: WebAssembly.instantiate(): Import #70 "a" "qa": function import requires a callable`
  ➜ `Aborted(…)`។ Android មិនប៉ះ ព្រោះវាប្រើ `BarcodeDetector` ផ្ទាល់ (មិនមែន ZXing) — iPhone គ្មាន API នោះ ➜ ពឹង ZXing តែម្យ៉ាង។
- **មូលហេតុវាស់បាន** ៖ `.wasm` 3.1.3 មាន import **៧៨** (#70 = `a.qa`) · 3.1.4 មាន **៧០** (គ្មាន #70) ➜ ឧបករណ៍ផ្ទុក
  **JS 3.1.4 + wasm 3.1.3**។ ឯកសារ ២ ក្នុង repo ស៊ីគ្នា (`scan-engine-test` បៃតង) ➜ ការលាយកើតពី **cache** ៖ `netlify.toml`
  ដាក់ `/*.wasm` ➜ `max-age=31536000, immutable` លើឈ្មោះ **គ្មាន hash** (`vendor/zxing_reader.wasm`) ខណៈ `/*.js` ➜ `no-cache`
  ➜ SW ថ្មី `cache.addAll(CORE_SHELL)` (cache mode លំនាំដើម) យក wasm ចាស់ពី HTTP cache ចាក់ចូល cache ថ្មី ហើយ
  `revalidateShell` ទាញពី HTTP cache ដដែល ➜ ពុលវាម្តងទៀតរាល់ពេលប្រើ។
- ⛔ **checker ១៨២ បៃតងទាំងអស់** លើ tree នោះ ៖ គ្មាននរណាវាស់ «ការ deploy ជាន់ HTTP cache ចាស់» ហើយ **`ctx.route()` របស់
  Playwright បិទ HTTP cache** ➜ checker SW ដែលមានស្រាប់ **មិនអាច** ឃើញថ្នាក់នេះទោះចង់ក៏ដោយ (វាស់ ៖ ជុំទី ៤ ថ្មីឆ្លងលើ tree ខូច
  រហូតដល់ដក `route` ចេញ)។
- **ការកែ** ៖ (១) `sw.ts` ៖ `FRESH = 'no-cache'` លើ install (`addAll` · `add`) · `revalidateShell` · ការទាញ shell ពេល cache
  miss ➜ SW **មិនពឹង header** (HTTP cache ចាស់លើឧបករណ៍មិនប្រែតាម header ថ្មីទេ) · (២) `netlify.toml` ៖ `/*.wasm` · `/*.png` ➜
  `no-cache` (ZoeKeyGen `/*.png` ដែរ · `immutable` នៅតែលើ `/assets/*` ដែលមាន hash ពី Vite) · (៣) `CACHE_VERSION` `zoew-v232` ➜
  ឧបករណ៍ដំឡើង SW ថ្មីដែលទាញ wasm ស្រស់ ហើយការទាញ `no-cache` ក៏ **ព្យាបាល** entry ចាស់ក្នុង HTTP cache ដែរ។
- **អ្នកយាម** ៖ `sw-install-integrity-test` ជុំទី ៤ (Chromium ពិត **គ្មាន route** · server បម្រើ wasm ជាមួយ `immutable` + ETag
  ដោយចេតនា ➜ វាស់ SW តែម្នាក់ឯង) ៖ SW ថ្មីត្រូវទាញ B ពី server (មុនកែ ៖ **A · serverHits 0**) · revalidate ត្រូវនាំ C (មុនកែ ៖
  ជាប់ A) ➜ **ធ្លាក់ ២ មុនកែ · ឆ្លងក្រោយកែ**។ `netlify-config-scope-test` ផ្នែក ៥ ៖ cache យូរ តែលើឯកសារដែលឈ្មោះមាន hash
  (ដេរីវេពីឯកសារ ship ពិត · ទិសផ្ទុយ ៖ `/assets/*` ទទួលបាន) ➜ **ធ្លាក់ ៣ លើ `netlify.toml` របស់ `main`**។
- **CI ពេញចាប់ checker មួយដែលបាក់** ៖ `adaptive-link-test` ស្រង់ `revalidateShell()` ចូល `vm` ➜ `FRESH` ថ្មីជាអថេរសេរី ➜
  `ReferenceError` (សញ្ញាល្អ ៖ checker រត់កូដ ship ពិត)។ ការកែ ៖ ថេរខ្សែអក្សរកម្រិតកំពូលដែល `revalidateShell()` យោង ត្រូវ **ស្រង់ពី
  `sw.js` ពិត** (មិនចាក់ក្នុង sandbox) · regex atomic ត្រូវទទួល `addAll(CORE_SHELL.map(…))` ដូច `sw-install-integrity-test`។

#### APK 2.42.4 build ក្នុង session · keystore · pin

- **build** (ក្រោយម្ចាស់គម្រោងបើក `dl.google.com` ក្នុង network របស់ environment — ការកែចូលជាធរមានលើ container ដែលកំពុងរត់
  ក្រោយរង់ចាំប៉ុន្មាននាទី ៖ ស្ទង់រាល់ ៣០ វិ. ៤០៣ ➜ ២០០) ៖ cmdline-tools 23.0 (SHA-1 ផ្ទៀងនឹង repository XML) ➜
  `platforms;android-36` · `build-tools;36.0.0` ➜ `android:sync` ➜ `gradlew assembleRelease` ក្នុង **ច្បាប់ចម្លង** នៃ commit។ វាស់លើ
  APK ពិត ៖ `com.zoesystem.zoew` · `2.42.4` · versionCode `2042004` · minSdk 24 · targetSdk 36 · `allowBackup=false` · គ្មាន bridge
  វាស់ · `apksigner verify` ✅ (v2 · signer ១)។ APK + `.sha256` ផ្ញើជូនម្ចាស់គម្រោងក្នុងការសន្ទនា (session គ្មាន API បង្កើត Release)។
- **keystore ថ្មី** (ម្ចាស់គម្រោងជ្រើស ៖ «បង្កើត keystore ថ្មី») ៖ PKCS12 · RSA 4096 · អាយុ ៣០ ឆ្នាំ · `CN=ZoeW, O=Zoe System, C=KH` ·
  alias `zoew` ➜ sign តាម **ផ្លូវ Gradle ដដែលនឹង workflow** (env `ZOEW_KEYSTORE_*`)។ keystore + ឯកសារ secret ៤ ផ្ញើជូនម្ចាស់គម្រោង
  ⛔ **មិនចូល repo · មិនចូល PR**។
- **pin វិញ្ញាបនបត្រ** `ZoeW/android/release-cert.sha256` (SHA-256 `c2a1b725…aecabd` · មិនសម្ងាត់) ៖ workflow ប្រៀបវិញ្ញាបនបត្រ APK
  (signer ១ តែមួយ) នឹង pin ក្រោយ `apksigner verify` មុន Release ➜ secret ដែលចង្អុលទៅ keystore ផ្សេង = **គ្មាន Release**។ ច្បាប់
  «keystore តែមួយជារៀងរហូត» ធ្លាប់ជា **អត្ថបទ** ➜ ឥឡូវជា **ឧបករណ៍**។ វាស់ ៖ ជំហាន shell ពិត (`bash -e` ដូច Actions) លើ output
  `apksigner` ពិត ➜ keystore ត្រឹមត្រូវ **exit 0** · keystore ផ្សេង **exit 1** · មិន sign **exit 1**; `android:check` ផ្នែក ៨ ថ្មី ២ ➜
  probe **៥/៥** ធ្លាក់។
- **អន្ទាក់ build ដែលអ្នកយាមចាប់បាន** ៖ `node_modules` ជា **symlink** ក្នុងច្បាប់ចម្លង ➜ `cap sync` សរសេរផ្លូវ **absolute** ចូល
  `capacitor.settings.gradle` ➜ `android:check` ផ្នែក ៥ ធ្លាក់ **៧** (ត្រឹមត្រូវ) · Maven Central ឆ្លើយ `429` ➜ រត់ Gradle ម្តងទៀត។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **merge PR ឆាប់តាមដែលអាច** ➜ Netlify build ខ្លួនឯង។ គ្មានការកែ Firebase rules · គ្មាន env ថ្មី។
- ✅ **iPhone ស្កេនបានវិញ** — ម្ចាស់គម្រោងបញ្ជាក់លើ iPhone ពិត ក្រោយ merge #252 (deploy `zoew-v232`)។
- ✅ **APK ZoeW លើ Android ពិត** (sign ដោយ keystore `CN=ZoeW`) ៖ ស្កេន · ចូលប្រព័ន្ធ · PTR · Export ដើរទាំងអស់ — ម្ចាស់គម្រោងបញ្ជាក់។
- ✅ **ZoeKeyGen ៖ ប៊ូតុងចូល/ចាកចេញ ១ ចុច = ១ សកម្មភាព** (`navAuthFlow()`) — ម្ចាស់គម្រោងបញ្ជាក់លើឧបករណ៍ពិត។
- ✅ **ZoeKeyGen ៖ Reconfig កណ្តាលការផ្ទុក SDK — បិទដោយអ្នកយាម ជំនួសការសាកលើឧបករណ៍** (ការសម្រេចរបស់ម្ចាស់គម្រោង ៖
  បណ្តាញពិតមិនដែលយឺតល្មម ហើយការសាកត្រូវ paste Config របស់ Project ផ្សេងចូលឧបករណ៍អ្នកលក់ពិត)។ `connection-recovery-test`
  ផ្នែក ១៥ខ រត់ `initFirebase()` ពិតរបស់ ZoeKeyGen ដោយទប់ SDK កណ្តាលការផ្ទុក ➜ វាស់បាន ៖ ដក
  `if (currentConfig !== savedConfig) initFirebase();` ចេញ ➜ **ធ្លាក់** (`got: ["https://old.example"]` · exit 1) · ទិសផ្ទុយ
  (config មិនប្រែ ➜ init តែ ១ ដង) នៅបៃតង។
- **iPhone ដែលស្កេនមិនបាន** ៖ បើក App ម្តង (SW ថ្មីដំឡើងខាងក្រោយ) ➜ **បិទ App ទាំងស្រុង** (អូសចេញពីបញ្ជី App) ➜ បើកម្តងទៀត ➜
  ស្កេនសាក។ ⛔ កុំ «លុប Website Data» ជាដំណោះស្រាយដំបូង — វាលុប PIN · ការចូល · កៅអី License (Device ID ថ្មី ➜ ត្រូវដោះក្នុង ZoeKeyGen)។
- **App Android** ៖ ដំឡើង `ZoeW-2.42.4.apk` លើ Android ពិត ➜ ស្កេន · ចូលប្រព័ន្ធ · PTR · Export · ⛔ ZoeW Android ចាស់ដែល sign ដោយ
  key ផ្សេង (ឧ. build ពី Android Studio) ➜ លុប App ចាស់ម្តង ➜ ដោះកៅអី License ក្នុង ZoeKeyGen។
- ⛔ **keystore** ៖ រក្សា `zoew-release.jks` + `ZOEW-KEYSTORE-SECRETS.txt` (Password Manager + ច្បាប់ចម្លង ២ កន្លែង) · បាត់ = App
  ដំឡើងជាន់មិនបានទៀត។ **កំណត់ secret ៤** (`ZOEW_KEYSTORE_BASE64` · `ZOEW_KEYSTORE_PASSWORD` · `ZOEW_KEY_ALIAS` · `ZOEW_KEY_PASSWORD`)
  **មុន merge** ➜ merge ប្តូរ `version.ts` លើ `main` ➜ workflow បង្កើត Release `zoew-android-v2.42.5` (ពេល Actions មានកូតា)។

### [2.42.4] — 2026-09-25 · ZoeW · ZoeKeyGen ៖ **ឡើងកំណែ toolchain និងបណ្ណាល័យទៅចុងក្រោយ** · ការថយក្រោយ ២ ដែលការឡើង Vite 8 នាំមក ត្រូវចាប់មុន ship

**សំណើម្ចាស់គម្រោង** ៖ *«update អ្វីៗដែលមានក្នុង ZoeW ទៅ version ចុងក្រោយទាំងអស់ ដូចជា gradle, sdk, ឬផ្សេងៗ»* ·
*«មើល version របស់ firebase SDK, sentry, Xzing, sheet, pdf, excel, និង ផ្សេងៗ … បើ update ទៅជំនាន់ចុងក្រោយបានសូម update ចុះ»*។

**ZoeW ប្រែ** (`zoew-v230` ➜ `zoew-v231`) · **ZoeKeyGen ប្រែ** (`zoekeygen-v101` ➜ `zoekeygen-v102` ៖ Firebase · Sentry fallback)។

#### អ្វីដែលឡើង

| ផ្នែក | មុន ➜ ក្រោយ | ការផ្ទៀងផ្ទាត់ |
|---|---|---|
| Firebase JS SDK (App ទាំង ២) | 12.17.1 ➜ **12.19.0** | ឈ្មោះ export ដែល loader ប្រើ (ZoeW ២២ · ZoeKeyGen ២១) មានក្នុង build CDN ពិត (npm) · `notifyAuthListeners` ក្នុង `@firebase/auth@1.13.6` ដូចដែល `auth-recovery-test` ធ្វើត្រាប់តាម |
| ZXing-WASM (ម៉ាស៊ីនស្កេន) | 3.1.3 ➜ **3.1.4** | ឯកសារ vendor ចាស់ = build ផ្លូវការ byte ទល់ byte · ថ្មី ៖ API ដដែល ៤០ ឈ្មោះ · `ZXING_WASM_SHA256` ស្មើ sha256 នៃ `.wasm` |
| Sentry fallback SDK (App ទាំង ២) | 7.120.3 ➜ **10.75.3** | Sentry ពិត (៣០ ថ្ងៃ) ៖ event ទាំងអស់មកពី SDK **10.71–10.75.3** តាម Loader · fallback 7.x **០ event** ➜ fallback = SDK ដែលផលិតកម្មបញ្ជាក់ថាដើរ។ ⛔ មិនមែន 11.0.0 (ចេញ ២ ថ្ងៃមុន · CDN វាស់មិនបានពីទីនេះ) |
| Vite · plugin-react · Vitest | 7 · 5 · 3 ➜ **8.3 · 6.1 · 5.0** | `npm run verify` · CI ពេញ |
| ESLint · @eslint/js · globals | 9 · 9 · 16 ➜ **10.11 · 10.0 · 17.12** | ច្បាប់ថ្មី ២ (`no-useless-assignment` · `preserve-caught-error`) ➜ ២៩ កន្លែង **អានទាំងអស់ ៖ ០ កំហុសពិត** (តម្លៃចាប់ផ្តើមការពារ · `throw` ក្នុង `catch`) |
| TypeScript | 5.9.3 ➜ **6.0.3** | ⛔ មិនមែន 7.0 ៖ `typescript-eslint` ទាមទារ `<6.1.0` (npm បដិសេធ peer) · `baseUrl` (deprecated ក្នុង TS 6) ត្រូវដក |
| esbuild · @netlify/blobs · floor ផ្សេងៗ | 0.25 ➜ **0.28** · 11.0.2 ➜ **11.1.1** | lockfile សាងថ្មីទាំងស្រុង |
| Android Gradle Plugin · Gradle | 8.13.0 · 8.14.3 ➜ **8.13.2 · 8.14.5** | patch ចុងក្រោយក្នុងខ្សែដែល Capacitor 8 គាំទ្រ |
| `playwright-core` (Windows helper) | 1.62.1 ➜ **1.63.0** | ដូច ZoeW |

**មិនឡើង (វាស់រួច)** ៖ Capacitor 8.5.2 · plugin ទាំងអស់ · React 19.3 · SheetJS 0.20.3 · qrcode-generator 2.0.4 (`ZoeKeyGen/qrcode.js`)
ជា **កំណែចុងក្រោយ stable រួចហើយ** · PDF ប្រើ print របស់ browser (គ្មានបណ្ណាល័យ)។ ⛔ **AGP 9 · Gradle 9 · compileSdk 37** ត្រូវការ
**Capacitor 9** ដែលនៅជា **alpha** (`9.0.0-alpha.7`) — template របស់វាលើក `minSdk` ទៅ **26** (បោះ Android 7.x) ហើយ plugin `@capgo/*`
គ្មានកំណែ 9 ទេ ➜ build Android វាស់មិនបាននៅទីនេះ (គ្មាន Android SDK) ➜ **មិនធ្វើ**។ `npm audit` ៖ ផលិតកម្ម **០**; dev ៣ moderate
(`uuid` ក្នុង `@capacitor/cli` ➜ `xcode` ៖ ឧបករណ៍ iOS · មានតាំងពី `main` · ការកែ = បន្ថយ CLI) ➜ ទុកដដែល។

#### ការថយក្រោយដែលការឡើងនាំមក — ចាប់មុន ship

- 🔴 **Vite 8 (Rolldown) ៖ web ផ្ទុកកូដ native ហើយក្រៅបណ្តាញចាប់ផ្តើមមិនកើត**។ Rolldown បម្លែង `manualChunks` ទៅជា group ដែល
  **ចាប់ dependency របស់ម៉ូឌុលដែលវាចាប់ផង** ➜ helper `__vitePreload` (plugin Capacitor ហៅ `import()`) ធ្លាក់ចូល chunk
  `native-plugins` ➜ `index` import chunk នោះដោយ **static** ហើយ `index.html` preload វា ➜ Service Worker មិន cache chunk នោះ
  ➜ **ក្រៅបណ្តាញ App ចាប់ផ្តើមមិនកើត**។ `android:check` ធ្លាក់ **២** · `native:check` ធ្លាក់ **១** (⛔ `smoke` · `sw:check` បៃតង)។
  ការកែ ៖ `codeSplitting.groups` ជាមួយ `priority` ច្បាស់ (helper ៣ · react ២ · native ១)។
- 🔴 **Lightning CSS (minifier CSS លំនាំដើមរបស់ Vite 8) សរសេរ CSS ឡើងវិញដោយគ្មានអ្នកវាស់**។ CSS ក្នុង build ខុសពី baseline
  **២,៣៩៧ បន្ទាត់** ៖ រៀបលំដាប់ declaration (`-webkit-*` ឡើងលើ) · design token **១៣/៣៥** ត្រូវសរសេរឡើងវិញ (`#0066FF` ➜ `#06f` ·
  `rgba(0,0,0,.05)` ➜ `#0000000d`) — ក្នុង CSS ដែលគ្រប PTR/ចលនាផ្ទាំង (តំបន់ហាមចូល) ខណៈ checker CSS/ប្លង់វាស់ CSS **ប្រភព**
  (`build-audit.mjs`) ➜ **គ្មាននរណាឃើញ**។ ការកែ ៖ `cssMinify: 'esbuild'` ➜ CSS ក្នុង build **ស្មើ baseline byte ទល់ byte**
  (លើកលែង marker `/*$vite$:1*/` នៅចុង)។

#### អ្នកយាមថ្មី

- `npm run smoke` ៖ (ក) JS ក្នុង build ត្រូវ parse បានក្នុង `build.target` (ដេរីវេពី `vite.config.mts`) — probe `target: 'esnext'` ➜
  **៦ ឯកសារធ្លាក់**; (ខ) design token CSS ទៅដល់ build ដូចដែលសរសេរ — probe «ដក `cssMinify`» ➜ **ធ្លាក់** (token ត្រូវសរសេរឡើងវិញ)។
- `npm run android:check` ផ្នែក ៧ ៖ config Android ↔ template របស់ Capacitor ដែលដំឡើង (SDK · AndroidX ស្មើ · AGP · Gradle ·
  google-services ឡើងបានតែ patch) — probe **៥/៥** ធ្លាក់ (AGP 9.4.0 · compileSdk 37 · Gradle 9.8.0 · androidx.core 1.19.0 · AGP 8.12.0)។
- `zto-cookie-sync-test` ៖ literal `'1.62.1'` (កាលបរិច្ឆេទផុតកំណត់) ➜ អះអាង **pin ជាកំណែជាក់លាក់** (probe `^1.63.0` ➜ ធ្លាក់)។

#### ឯកសារ ៖ `CLAUDE.md` បង្រួម · ប្រវត្តិបំបែកជា ២ ឯកសារ (សំណើម្ចាស់គម្រោង)

**សំណើ** ៖ *«ពិនិត្យមើល CLAUDE.md ផងក្រែងមានកន្លែងខុស … សម្អាតប្រសិនបើវាសល់ឯកសារចាស់ៗដែលទាក់ទងជាមួយ ZoeW កាលនៅជា
vanilla … HISTORY.md សម្រួលចោលខ្លះ … បំបែកជា HISTORY ARCHIVE»*។

- **ការវាស់ មុនការកែ** ៖ ឈ្មោះ helper **២៣៩/២៣៩** ដែល `CLAUDE.md` យោងជា `x()` នៅមានក្នុងកូដ ship (App React រក្សាឈ្មោះ
  function) · ការយោងក្នុង backtick **៧៦៣** ➜ បាត់ **១៣** សុទ្ធតែមានហេតុផល។ ការអះអាងអំពី **យន្តការ vanilla** ដែលខុស ៖ **៦**
  ➜ កែ (`initAppLock()` + TDZ ➜ boot · `ZoeW/vendor/` ➜ `ZoeW/public/vendor/` · `style.css` ➜ `src/styles/app.css` (ដូច vanilla
  byte ទល់ byte) · `CORE_SHELL` សរសេរដោយដៃ ➜ ដេរីវេក្នុង `vite.config.mts` · ហេតុផល `style=` «១៩០ កន្លែង» · អន្ទាក់ `let`
  កម្រិត module ➜ ឃ្លាំង state + bridge វាស់)។
- **`CLAUDE.md` ៤៣៤ KB ➜ ~៣៤៨ KB** ៖ ជួរតារាងស្នូលវែងបំផុត **១៦** (ដល់ ១១,០០០ តួក្នុងមួយក្រឡា) សរសេរឡើងវិញជា **ច្បាប់ខ្លី**
  ដោយរក្សាគ្រប់ ⛔ ច្បាប់ · ឈ្មោះ function · កូនសោ; narrative «វាស់បាន (x.y.z)» ផ្លាស់ទៅ `docs/HISTORY-ARCHIVE.md` **ផ្នែក ៥**
  **ដោយមិនកែ** (បូក `git show 2c998d1:CLAUDE.md` សម្រាប់ឯកសារពេញ)។ ច្បាប់ ៩ · ១២ · «📌 ការងារដែលនៅសល់» ក៏បង្រួមដែរ។
- **`docs/HISTORY.md` ២,៥ MB ➜ ~១៤៨ KB** ៖ សម័យ React (ZoeW `2.38.0` ➜ ឥឡូវ) នៅទីនេះ · សម័យ vanilla (ផ្នែក ១–៤ ចាស់) ផ្លាស់ទៅ
  **`docs/HISTORY-ARCHIVE.md`** ដោយ **មិនលុបបន្ទាត់ណាមួយ** (ផ្នែកទាំងអស់បូកស្មើចំនួនបន្ទាត់ដើម ២៣,៥៨៧)។ លិបិក្រម checker
  **ដេរីវេ** ពីការលេចពិតក្នុងឯកសារទាំង ២ (១៧៧ ជួរ)។
- **អ្នកយាម (`doc-scope-test`)** ៖ ច្បាប់ ៩ ថ្មី (ឯកសារ ២ · គ្មានទី ៣) · ប្រវត្តិ *ផ្លាស់ទី* មិនមែនលុប (វាស់លើទាំង ២) ·
  `HISTORY.md` តភ្ជាប់ទៅ archive · **លិបិក្រមគ្រប checker ដែលលេចក្នុងប្រវត្តិ** — probe ៣/៣ ធ្លាក់ (ដកជួរលិបិក្រម · ឯកសារ
  ប្រវត្តិទី ៣ · ដកតំណ)។ `doc-scope-test` ក៏ចាប់កំហុស ២ របស់ការកែខ្លួនឯង (`` `import()` `` មើលទៅដូច helper · តំណពី root
  ដែលបាក់ក្នុង `docs/`)។

#### checker SW ៖ race ពេលអាន bridge វាស់

- CI ពេញជុំទី ១ ៖ **១៨០ PASS · ២ FAIL** (`sw-cache-key` · `sw-shell-latency` ➜ `appJs:false`) ខណៈរត់ដាច់ដោយឡែក **ឆ្លង**។
  មូលហេតុ ៖ App React ដំឡើង bridge វាស់ (`expose-globals`) តាម dynamic import **អសមកាល** ➜ វាអាចមកដល់ **ក្រោយ** `load`
  ហើយ checker អាន `window.initScanEngine` ភ្លាម (ម៉ាស៊ីនរវល់ ➜ ធ្លាក់)។ race ដដែលមាន **៥ កន្លែង** (៣ បៃតងដោយសំណាង)។
  ការកែ ៖ `waitAuditBridge()` តែមួយក្នុង `audit-tools/react-view.js` (ពិដាន ២ វិ. — ខ្លីជាងការពន្យារបណ្តាញ ៥ វិ. ➜ chunk ដែល
  មិននៅក្នុង cache នៅតែធ្លាក់)។

#### APK ពី GitHub Releases (សំណើម្ចាស់គម្រោង ៖ «Build apk ដាក់ក្នុង Github ជា release ឬ package … ងាយស្រួល download»)

- **`.github/workflows/android-release.yml` (ថ្មី)** ៖ build web (`--mode android`) ➜ `cap sync` ➜ `gradlew assembleRelease` ➜
  `apksigner verify` ➜ **GitHub Release** `zoew-android-v<APP_VERSION>` (`ZoeW-<កំណែ>.apk` + `.sha256`) ៖ ពេល `APP_VERSION`
  ប្រែលើ `main` ឬចុច Run workflow · កំណែដែលមាន Release រួច ➜ មិន build ម្តងទៀត។
- ⛔ **keystore តែមួយជារៀងរហូត** ៖ `build.gradle` sign តាម env (`ZOEW_KEYSTORE_FILE` …) តែពេល env មាន (Android Studio ដើរដូចមុន) ·
  គ្មាន secret ➜ **មិន build** (⛔ គ្មានការធ្លាក់ចុះទៅ debug key របស់ runner ដែលប្រែរាល់ការរត់ ➜ APK ដំឡើងជាន់មិនបាន ➜
  បាត់ PIN · កៅអី License) · keystore លុបចេញពី runner ជានិច្ច · `*.jks` · `*.keystore` ហាមក្នុង `.gitignore` (ធ្លាប់ comment ចោល)។
- **អ្នកយាម** ៖ `android:check` ផ្នែក ៨ (ស្នាមភ្ជាប់ឈ្មោះ env workflow ↔ `build.gradle` · គ្មានផ្លូវ debug · លក្ខខណ្ឌ secret លើជំហាន
  gradle · `apksigner verify` មុន Release · គ្មាន keystore ក្នុង tree) — probe **៤/៤** ធ្លាក់។
- ⚠️ **APK មិនទាន់ build ក្នុងជុំនេះ** ៖ GitHub Actions របស់ម្ចាស់គម្រោងនៅអស់កូតា (job បញ្ចប់ក្នុង ២ វិ. គ្មានជំហាន) ហើយ
  environment នៃ session នេះបិទ `dl.google.com` (Android SDK) ➜ វាស់មិនបាន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **Netlify build ខ្លួនឯង** (App ទាំង ២) · គ្មានការកែ Firebase rules · គ្មាន env ថ្មី។
- **សាកលើទូរស័ព្ទពិត (iPhone + Android)** ៖ ស្កេន Barcode (ZXing-WASM ថ្មី) · ចូលប្រព័ន្ធ (Firebase ថ្មី) · Export Excel · បើក App
  ក្រៅបណ្តាញ។ ZoeKeyGen ៖ ចូលប្រព័ន្ធ · បញ្ជី Key។
- **App Android** ៖ Android Studio ទាញ Gradle 8.14.5 និង AGP 8.13.2 ពេល Sync លើកដំបូង ➜ `npm run android:sync` ➜ build APK ➜ សាក។
- **Windows helper (ស្រេចចិត្ត)** ៖ រត់ `setup.cmd` ម្តងទៀតដើម្បីទទួល `playwright-core` 1.63.0 (ការដំឡើងចាស់នៅដើរធម្មតា)។
- **Sentry (ស្រេចចិត្ត · មិនទាន់ណែនាំ)** ៖ Loader កំពុងប្រើ **10.x** (ឡើង patch ដោយស្វ័យប្រវត្តិ)។ ការប្តូរទៅ 11.x ក្នុង Sentry ➜
  Project Settings ➜ Client Keys ➜ Loader Script — ⛔ រង់ចាំ 11.x ចាស់ជាងនេះ។

### [2.42.3] — 2026-09-25 · ZoeW ៖ **អេក្រង់សលែងកើតពីកំហុស render តែមួយ** · CI ពេញរត់ក្នុង session · money checker លើ App React (branch · មិនទាន់ merge)

**សំណើម្ចាស់គម្រោង** ៖ *«Deep Audit project ទាំងមូល … វាស់ឡើងវិញទាំងអស់ … ពិនិត្យមើល sentry, money checker, អោយដើរជាមួយ React …
រត់ CI ពិតជំនួស Github ព្រោះ Github action ខ្ញុំអស់ quota»* · *«មើល tool money checker ផង»*។

**ZoeW ប្រែ** (`zoew-v229` ➜ `zoew-v230`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន (អ្នកប្រើ)

- 🔴 **កំហុស render តែមួយលែងធ្វើឲ្យ App ក្លាយជាអេក្រង់ស**។ React unmount ដើមឈើ **ទាំងមូល** ពេល component មួយបោះកំហុស
  (ឧ. ទិន្នន័យ Firebase ដែលមានរូបរាងមិនរំពឹង) ➜ អេក្រង់ស គ្មានប៊ូតុង គ្មានសារ — ខណៈ App ដើម (vanilla) មិនដែលសដោយកំហុស
  តែមួយទេ (DOM នៅដដែល)។ ឥឡូវ `AppErrorBoundary` បង្ហាញ «⚠️ App ជួបបញ្ហាក្នុងការបង្ហាញ» ជាមួយប៊ូតុង «🔄 ផ្ទុក App ឡើងវិញ»។
- 🔴 **កំហុស render ដែលព្រំដែនចាប់ ត្រូវឡើងដល់ Sentry ដែរ**។ លំនាំដើមរបស់ React 19 ៖ កំហុសដែល error boundary **ចាប់** ទៅត្រឹម
  `console.error` ➜ Sentry **មិនឃើញ** ➜ ព្រំដែនថ្មីនឹងលាក់កំហុសពីអ្នកថែទាំ។ ដូច្នេះ `createRoot(host, { onCaughtError, onUncaughtError })`
  បញ្ជូនទាំង ២ តាម `reportError()` ➜ អ្នកស្តាប់ `error` របស់ `error-reporting.js` (Sentry) ឃើញវាដូចកំហុសដទៃ។ ⛔ **មិនបន្ថែមប៊ូតុង «Break the world» របស់ `@sentry/react` ចូលផលិតកម្ម**
  (អ្នកប្រើណាក៏ចុចបំបែក App បាន) — ការផ្ទៀងផ្ទាត់ត្រូវជាតេស្ត `tests/native/render-crash.test.tsx` (កំហុសក្នុង render ➜ ផ្ទាំងជំនួស +
  `reportError` ទទួលកំហុសដដែល · ទិសផ្ទុយ ៖ គ្មានកំហុស ➜ គ្មានផ្ទាំង គ្មានការរាយការណ៍)។

#### `audit-tools`

- **`run-all.sh` រត់លើ repo React ដោយផ្ទាល់** ៖ វា build `ZoeW/dist-audit` ហើយប្រមូល tree វាស់ (`ZoeW/dist-audit/measure-root`) រួចរត់
  checker ទាំងអស់លើវា ➜ **CI ពេញរត់ក្នុង session** (GitHub Actions អស់កូតា)។
- **`zoew-suite-test.js` (ថ្មី)** ៖ អ្នកយាមផ្ទាល់ខ្លួនរបស់ ZoeW React (tsc · eslint · vitest · purity · native · android · rules · parity ·
  smoke · SW) ចូល `run-all.sh` ➜ មុននេះ tests/scripts/android **គ្មាននរណារត់វាក្នុង CI**។
- **money checker (`money-reality-check.js` · `check-money.cmd`) ដើរលើ repo React** ៖ កូដលុយពិតត្រូវស្រង់ចូល
  `audit-tools/money-core.js` (`npm --prefix ZoeW run money:core`) ជាមួយ **អ្នកយាមភាពស្រស់** (កូដលុយប្រែ ➜ ត្រូវបង្កើតវាឡើងវិញ)។
  function លុយ **១៩/១៩ ដូច ZoeW ដើម token ទល់ token**។ `comments` · `strip-comments` ស្កេន `ZoeW/public` (កូដ JS ដែល ship ដោយផ្ទាល់)។

- 🔴 **`doc-scope-test` មិនដែលស្កេន `ZoeW/docs/*.md` សោះ** ៖ `listAllDocs()` រំលងថតឈ្មោះ `docs` **គ្រប់ជម្រៅ** ខណៈច្បាប់ ៩
  លើកលែងតែ `docs/` **នៅ root** ➜ លទ្ធផល parity ឆៅ និងប្រវត្តិការរកឃើញរស់នៅ `ZoeW/docs/` ដោយគ្មានអ្នកយាម។ វាស់បាន ៖ អ្នកយាមដែល
  កែរួច **ធ្លាក់ ២** លើ tree មុនកែ (កំណត់ត្រាកំណែក្នុង `ZoeW/docs/DEVELOPMENT.md` · ការអះអាងទំហំ `app.js` ដែលលែងមានន័យ)។
- **`npm run smoke` ចាក់សោថា bridge វាស់មិនចូល build ផលិតកម្ម** (២ ជាន់ ៖ export ពិតមិនលេចលើ `window` · គ្មានសញ្ញា
  `__auditOrig`/`__auditRebind` ក្នុង `dist/assets`)។ វាស់បាន ៖ build ដោយ `VITE_EXPOSE_GLOBALS=1` ➜ ធ្លាក់ទាំង ២ ជាន់។
- **បញ្ជី slot ផ្លាស់ទៅ `ZoeW/scripts/slot-registry.cjs`** ហើយ `slot:check` ផ្ទៀងផ្ទាត់វាទល់នឹង `REACT_OWNED_IDS` (ទាំង ២ ទិស) និង
  component ដែល export ពិត (mutation ២/២ ចាប់)។ ឧបករណ៍ codemod (`ZoeW/tools/*` · `npm run generate`) និង `npm run audit:run`
  **ត្រូវលុប** ៖ វាសរសេរជាន់ `src/` ទាំងមូល (អន្ទាក់) · `run-all.sh` ជំនួស `audit:run`។
- **`.github/workflows/audit.yml`** ៖ ដំឡើង dependency របស់ ZoeW · job `firebase-rules` រត់ checker លើ tree វាស់
  (`ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh`) ➜ ពេលកូតា GitHub Actions ត្រឡប់មកវិញ CI មិនធ្លាក់ដោយ «រក `ZoeW/app.js` មិនឃើញ»។
- 🔴 **`zoew-suite` (checker ថ្មី) ចាប់ការថយក្រោយភ្លាមក្នុងការរត់ដំបូង** ៖ ច្បាប់ CSS របស់ផ្ទាំង crash ត្រូវដាក់ក្នុង `app.css` ➜
  `npm run parity` ធ្លាក់ (`app.css` ត្រូវដូច `style.css` ដើម **byte ទល់ byte**) ➜ ផ្លាស់ទៅ `react-root.css`។ មុនជុំនេះ parity
  **គ្មាននរណារត់ក្នុង CI ទេ**។
- 🔴 **checker CSS ស្តាទិចមើលតែពាក់កណ្តាលនៃ CSS/JSX** ៖ `style.css` របស់ tree វាស់ = `app.css` តែឯង (ខ្វះ `react-root.css` ·
  `native.css`) ហើយ `css-classes` ស្កេនតែ markup **ដំបូង** (`index.html`) ➜ class **១១៦** ក្នុង JSX ដែលមិនគូរពេលដំបូង
  (ផ្ទាំង crash · toast · បញ្ជីថាមវន្ត) គ្មានអ្នកវាស់។ ឥឡូវ `style.css` = CSS ដែល ship ពិត (តាមលំដាប់នាំចូលរបស់ `main.tsx`) ·
  `css-classes` ស្កេន `components.js` ដែរ (១៨០ ➜ **២៩៦** class) ➜ probe «ដក `.app-crash-reload`» ធ្លាក់។
- **Deep Audit (ការវាស់ក្រៅសំណុំ)** ៖ fuzz **ក្រៅជួរ seed លំនាំដើម** លើ App React — revenue (seed 100–113 × 50 ops) ·
  collected-value (seed 500+) · mirror (seed 300+) · connection-state (seed 700+ · ៥,៧៦០ ជំហាន) ➜ **បៃតងទាំង ៤**។ mutation
  `trashReason` របស់ «លុបទាំងអស់» ➜ `policy-test` · `trash-modal-test` ចាប់ (មិនមែនចន្លោះ ➜ មិនសាង checker ស្ទួន)។

#### ឯកសារ ៖ ប្រវត្តិរស់នៅកន្លែងតែមួយ

- `docs/HISTORY-ARCHIVE.md` · `docs/ARCHIVE-2026-09-03.md` ➜ **ផ្នែក ៣ · ៤** នៃឯកសារនេះ (តំណដែលបាក់បម្លែងជាអត្ថបទ) ·
  `ZoeW/docs/ADDED-VALUE.md` · `PARITY-RESULTS.md` ➜ **ផ្នែក ២**។ ⛔ លែងមានឯកសារបណ្ណសារដាច់ដោយឡែក (`CLAUDE.md` ច្បាប់ ៩)។
- `CLAUDE.md` ៖ ការអះអាងចាស់ដែលគ្រោះថ្នាក់សម្រាប់ session ក្រោយត្រូវកែ — «checker ភាគច្រើនមិនទាន់វាស់ App React» · «`ZoeW/app.js`
  ជាឯកសារកូដតែមួយ ~១៤,៤០០ បន្ទាត់ · function ជា global» · Runbook (`npm i acorn …` ➜ `npm ci --prefix ZoeW` · `git diff … ZoeW/app.js` ➜
  `ZoeW/src ZoeW/public`) · ច្បាប់ ៣ (comment ក្នុង `src/**`) · «កុំ merge មុនការផ្ទេរ checker» ➜ App React ជាផលិតកម្មរួច
  (`main` = 2.42.1 · ផ្ទៀងផ្ទាត់តាម git)។
- `ZoeW/docs/*` ៖ លេខ cache ចាស់ (`zoew-v227`) · ការអះអាង «manifest គ្មានលេខកំណែ» ខុស · PARITY.md ផ្នែក ៥ (checker «ធ្លាក់ដោយ
  រចនាសម្ព័ន្ធ») · MIGRATION.md លក្ខខណ្ឌទី ២ (សម្រេចរួច) ➜ កែតាមការពិត។ `guide.html` ៖ ដកកំណត់ត្រាប្រវត្តិ · បន្ថែមជំនួយសម្រាប់ផ្ទាំង
  «⚠️ App ជួបបញ្ហាក្នុងការបង្ហាញ»។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** ៖ គ្មានការកែ Firebase rules · គ្មានការប្តូរ env។ Netlify build ខ្លួនឯង។ ⛔ **កុំដាក់ `VITE_EXPOSE_GLOBALS` ក្នុង env របស់
  Netlify** (`npm run smoke` នឹងធ្លាក់ តែ Netlify មិនរត់ smoke)។
- **អ្នកប្រើ `check-money.cmd` លើ Windows** ៖ ត្រូវទាញថត repo ថ្មី (ឯកសារ `audit-tools/money-core.js` ចាំបាច់) — ថតចាស់ដែលគ្មាន
  `ZoeW/app.js` នឹងរាយ «money code not found»។

### [2.42.2] — 2026-09-25 · ZoeW ៖ **`audit-tools` វាស់ App React** · លុបកូដងាប់ ១៩ ដែល checker រកឃើញ (branch · មិនទាន់ merge)

**សំណើម្ចាស់គម្រោង** ៖ *«ចាប់ផ្ដើមទាំងអស់ទៅ អោវាស់បានទាំង 181 ហ្នឹងមកអោយបានពេញលេញដូច ZoeW កាលនៅជា vanillajs»* ·
*«បន្តធ្វើ checker ដែលនៅសល់ទាំងអស់ទៅ»*។

**ZoeW ប្រែ** (`zoew-v228` ➜ `zoew-v229`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន (អ្នកប្រើ)

- **គ្មានអ្វីដែលអ្នកប្រើមើលឃើញខុសពីមុនទេ**។ កូដ ship ដែលប្រែ ៖
  - ជម្រើសខែរបស់របាយការណ៍ខែ · Tab ក្នុងឯកសារ Excel · ជម្រើសផ្គូផ្គងជួរឈរ ហៅសកម្មភាពតាម `act()` (ព្រំដែន
    `ACTION_REGISTRY`) ជំនួសការហៅ function ដោយផ្ទាល់ — ឥរិយាបថដដែល (`act()` ➜ `lookupAction()` ➜ function ដដែល)។
  - function ងាប់ **១៩** ត្រូវលុប ៖ builder HTML **៧** (`buildHistoryRowHtml` · `healthRowHtml` · `trashGroupRowHtml` ·
    `trashActionButtonsHtml` · `trashSummaryCardHtml` · `monthlyReportMismatchNote` · `ztoListGroupHtml`) — JSX គូរពី
    model រួចហើយ · helper ref **៧** (`fieldFiles` · `blurField` · `selectFieldText` · `activeElementTag` · `elementRect` ·
    `refNameOf` · `onRefChange`) · store **២** (`subscribeAll` · `globalVersion`) · `runOnWindowLoad` + `documentLoadComplete`
    (`scope.onLoad()` ជាអ្នកការពារពិត) · `sheetImportViewOf`។ builder ២ ដែលតេស្ត parity ត្រូវការ រស់ជា **oracle** ក្នុង
    `ZoeW/tests/oracles/` (មិនចូលផលិតកម្ម)។

#### `audit-tools` ៖ ទិដ្ឋភាព App React (`ZoeW/scripts/build-audit.mjs` ➜ `ZoeW/dist-audit/ZoeW`)

checker ដើមស្រង់អត្ថបទពី `ZoeW/app.js` · អាន markup ថេរក្នុង `index.html` · ជំនួស `window.<fn>` ➜ លើ App React
ពួកវា **មិនរត់** ឬ **វាស់អ្វីផ្សេង**។ ឥឡូវ build វាស់ផលិត ៖

| ឯកសារ | អ្វី |
|---|---|
| `app.js` | ទិដ្ឋភាពអត្ថបទពីប្រភព TypeScript (លុបតែ type · ផ្ទៀងផ្ទាត់ token ទល់ token) · `<ឃ្លាំង>.<វាល>` ➜ `<វាល>` |
| `index.html` | markup ដំបូងរបស់ React ពិត + `data-act` ពី prop ពិត (`audit-annotate.ts`) |
| `sw.js` | ទិដ្ឋភាពអានបានរបស់ `src/sw/sw.ts` — ផ្ទៀងផ្ទាត់ **byte ទល់ byte** នឹងឯកសារដែល ship |
| `react-render.cjs` | SSR នៃ component ទាំងអស់ ➜ checker `vm` អាន **JSX ពិត** (មិនមែន markup ចម្លងដោយដៃ) |
| `components.js` | ទិដ្ឋភាពអត្ថបទនៃ `.tsx` (ការយោង · `onAct()`) |
| `view-originals.js` | តួ **ដើម** នៃ function ដែលទិដ្ឋភាព override (ការយោងរបស់វាជាការយោងពិត) |

helper រួម ៖ `audit-tools/react-view.js` (`renderFromContext` · `actionUsages` · `swShell` …)។

#### ការរកឃើញ (ការវាស់ មិនមែនការអាន)

- 🔴 **`npx tsc --noEmit -p .` មិនពិនិត្យអ្វីសោះ** — `tsconfig.json` ជា solution file (`"files": []`) ➜ វាចេញ ០
  ដោយស្ងាត់ ខណៈ `audit-compat.ts` នាំចូល export ដែលលុបរួច។ ⛔ ត្រូវប្រើ `npm run typecheck` (`tsc -b`)។
- `function-surface` រាយ **១៩** ៖ ងាប់ពិត **១៧** (+ **២** ងាប់តាមខ្សែ ៖ `trashActionButtonsHtml` · `documentLoadComplete`) · **២**
  ជាសំណល់នៃទិដ្ឋភាព (`allStores` · `modalIsMounted` — override លុបការយោង ➜ `view-originals.js`)។ `buildHistoryRowHtml()` ងាប់ **ជាច្បាប់ចម្លងទី ២ នៃរូបមន្តលុយរបស់ជួរដេក**
  (`activeCod` · `activeDod` · Locker) ➜ `code-duplication` រាយ ២ (ច្បាប់ ១២ លើកូដ ៖ ជុំក្រោយកែមួយ ភ្លេចមួយ)។
- `wiring` · `csp-enforced` ៖ ធាតុ **៣** ក្នុង `ACTION_ALLOWLIST` គ្មាន `act()` ណាហៅ (សិទ្ធិលើស) ➜ ការហៅឆ្លងកាត់ `act()` វិញ។
- `html-sink-escaping` ៖ ក្នុង React គ្មាន HTML តាមការតភ្ជាប់ខ្សែអក្សរទៀតទេ ➜ ជាន់អប្បបរមា «រកឃើញ ≥ ១» មិនអាចពិតបាន ➜
  ជំនួសដោយ **probe** (scanner ដដែលត្រូវរាប់ និងរាយ sink ដែលដាំ) បូក **គ្មាន `dangerouslySetInnerHTML`** ក្នុង JSX។
- `action-binding` ៖ អ្នកស្តាប់ទី ២ ក្នុង React ចងតាម `refWithNative()` / `scope.listen(elementOf(…))` មិនមែន
  `getElementById` ➜ mutation «`refWithNative` ហៅសកម្មភាពដដែលនឹង `onChange={onAct(…)}`» ត្រូវចាប់។
- `csp-enforced` (browser) ៖ ការជំនួស `window.openViewListModal` / `window.loginWithFirebase` **មិនវាស់អ្វីទេ** លើ App React
  (សកម្មភាពហៅតាម `ACTION_REGISTRY`) ➜ វាស់ **ផល** វិញ ៖ ប្រអប់បង្ហាញលេខ/Barcode របស់ `row1` · សារ «វាលទទេ» ពិតរបស់ `loginWithFirebase()`
  (អានចេញពី `app.js`)។ mutation ៤/៤ ចាប់ (`lookupAction` · registry ឃ្លាត · `args` ខុស · `evt` បាត់)។
- `parity-static` ៖ ការប្រៀបធៀបអត្ថបទបង្រួមចន្លោះទទេ (HTML និង JSX បង្ហាញ `\n    ` ជាចន្លោះ ១) — អត្ថបទព្រមានរបាយការណ៍ខែ
  មិនបាត់ទេ វាខុសត្រឹម indent។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0`–`2.42.1` នៅដដែល (checker ដែលនៅសល់ · iPhone + Android ពិត)។
២. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify** · App Android មិនចាំបាច់ build ថ្មី (គ្មានអ្វីអ្នកប្រើឃើញ)។
៣. សាក ៖ 📊 របាយការណ៍ខែ ➜ ប្តូរខែ ➜ តារាងប្តូរ · នាំចូល Excel ➜ ប្តូរ Tab ➜ ជួរឈរបំពេញវិញ · ប្តូរជួរឈរ ➜ មើលជាមុនប្តូរ។

### [2.42.1] — 2026-09-24 · ZoeW ៖ **App Android ៖ រូបតំណាងរបាស្ថានភាព (ម៉ោង · ថ្ម) មើលឃើញវិញ** (branch · មិនទាន់ merge)

**របាយការណ៍អ្នកប្រើ (ទូរស័ព្ទ Android ពិត · រូបថតអេក្រង់)** ៖ *«App android fullscreen ស្អាត ហើយតែ status bar
អត់ប្រែពណ៌ មើល status bar អត់ឃើញ ធម្មតាពេលចូលផ្ទៃ ស status bar ដូទៅពណ៌ខ្មៅ»*។

**ZoeW ប្រែ** (`zoew-v227` ➜ `zoew-v228`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- លើ WebView ពេញអេក្រង់ រូបតំណាងរបាស្ថានភាព **ស លើ navbar ស** ➜ មើលមិនឃើញ។ ឥឡូវ ៖ **ខ្មៅ** លើ navbar ស ·
  **ស** ពេលប្រអប់ (ផ្ទៃងងឹតថ្លាៗ) បើក · **ខ្មៅវិញ** ពេលបិទ។ Web · PWA · iPhone **មិនប៉ះ** (កូដរត់តែលើ native)។

🔴 **មូលហេតុ ៖ ការសន្មតអំពី layout ជំនួសការវាស់** — `statusBarStyleFor()` សម្រេច «inset > 0 ➜ navbar
**ក្រហម** ➜ រូបតំណាងស» ខណៈ navbar ពិតជា `--card-bg` (**`#ffffff`**)។ ⛔ **ហើយតេស្តចាក់សោកំហុសនោះ** ៖
`native-back.test.tsx` អះអាង `statusBarStyleFor(24) === 'dark'` ➜ tsc · vitest · `native-check` (75) **បៃតងទាំងអស់**
ព្រោះ Chromium ឆ្លើយ `env(safe-area-inset-top)` = **0** ជានិច្ច ➜ ផ្លូវពេញអេក្រង់ **មិនដែលត្រូវរត់ក្នុង browser**
(សំណួរ ៨ ៖ «តើ checker ដាក់ប្រព័ន្ធក្នុង *ស្ថានភាព* ណា?»)។

**ការកែ** ៖ `measureStatusBarTone()` វាស់ **ស្រទាប់ពិត** នៅក្រោមរបា (`elementsFromPoint` · ៥ ចំណុចតាមទទឹង ·
ពណ៌ផ្ទៃ + `opacity` រួមធាតុមេ) ➜ `status-bar-tone.ts` (សុទ្ធសាធ) លាយស្រទាប់លើផ្ទៃស ➜ ពន្លឺ WCAG ➜ ជ្រើសពណ៌ដែល
មាន **កម្រិតផ្ទុយខ្ពស់ជាង**។ វាស់ឡើងវិញពេល `resize` · `uiState` · `securityState` ប្រែ (rAF + ម្តងទៀតក្រោយ
**៣២០ ms** ពេលចលនាប្រអប់/របា Slide ចប់)។ inset ០ (WebView ចាស់) ➜ `light` ដដែល។

#### អ្នកយាមថ្មី

- `native-check` សេណារីយ៉ូ **៤ឃ** ៖ safe-area **ពិត** តាម CDP (`Emulation.setSafeAreaInsetsOverride` ➜ `env()` ពិត
  ➜ navbar ទទួល padding ដូចលើទូរស័ព្ទ) ហើយវាស់ **ការហៅ plugin** ក្រោយការប្តូរ state (⛔ មិនមែនហៅ function ដោយផ្ទាល់)។
  វាស់បាន ៖ លើកូដ **មុនកែ** ➜ ធ្លាក់ **២** (`{"style":"DARK","bg":"rgb(255, 255, 255)"}` — របាយការណ៍អ្នកប្រើបេះបិទ);
  mutation «ដក `uiState.subscribe`» ➜ ធ្លាក់ «ប្រអប់បើក ➜ DARK» (`LIGHT`)។ ក្រោយកែ ➜ **82 ok · 0 FAIL**។
- `tests/native/status-bar-tone.test.ts` (៩) ៖ ពណ៌អានចេញពី `app.css` **ពិត** (`--card-bg` · `--body-bg` · `.modal` ·
  `.drawer-backdrop`) មិនមែនសរសេរដោយដៃ · ទិសផ្ទុយ (ផ្ទៃងងឹត ➜ `dark`) · fade (opacity 0 ➜ `light`) · ពណ៌ខូច ➜ រំលង។
  តេស្តចាស់ដែលចាក់សោកំហុស (`statusBarStyleFor(24) === 'dark'`) **ត្រូវដកចេញ**។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0`–`2.42.0` នៅដដែល។
២. **App Android** ៖ build APK ថ្មី (`npm run android:sync` ➜ Android Studio) — គ្មាន plugin ថ្មី។
៣. សាកលើ **Android ពិត** ៖ បើក App ➜ ម៉ោង/ថ្មខាងលើ **ខ្មៅ** មើលឃើញ · ចុច «📅 កញ្ចប់ប្រចាំថ្ងៃ» ➜ **ស** ·
   បិទប្រអប់ ➜ **ខ្មៅវិញ** · បើករបា Slide · ចាក់សោ App (ចាកចេញ ➜ ត្រឡប់មក) ➜ មើលឃើញជានិច្ច។
៤. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify**។

### [2.42.0] — 2026-09-23 · ZoeW ៖ **React ១០០% ពេញលេញ** — ស្រទាប់ React ខ្លួនឯងលែងសរសេរ DOM ក្រៅច្រកចេញ (branch · មិនទាន់ merge)

**សំណើម្ចាស់គម្រោង** ៖ *«2.41.0 ជា React ពេញលេញ 100% នៅ?»* ➜ ចម្លើយស្មោះត្រង់ ៖ **មិនទាន់** —
*«ធ្វើទាំងអស់ អោយស្អាតពេញលេញជា React 100% ទៅ»*។

**ZoeW ប្រែ** (`zoew-v226` ➜ `zoew-v227`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន (អ្នកប្រើ **មិនឃើញ** អ្វីប្រែ — ការរៀបចំខាងក្នុង)

🔴 **អ្នកយាមជំនាន់មុនបៃតងក្លាយ** ៖ `purity:check` រាយ «ការប៉ះ DOM ក្រៅ React ៖ 0» ខណៈ
`src/app/behaviors` (កាយវិការ) សរសេរ `style` · `classList` · `scrollTop` · `setAttribute` លើធាតុរបស់ React
**~៤០ បន្ទាត់** — ព្រោះវាវាស់តែថតមុខងារ (`core` … `platform`) ➜ **លេខ 0 មិនមែនការវាស់ទាំង App**។

| អ្វី | មុន (imperative) | ឥឡូវ (React) |
|---|---|---|
| សញ្ញា PTR (transform · opacity · `ready`/`snapping`/`spinning`) | `indicator.style.*` · `classList` រាល់ `touchmove` | ឃ្លាំង **`ptrState`** (អ្នកជាវតែមួយ) ➜ `PtrIndicator` គូរ · `renderNow()` ក្នុងការ dispatch ដដែល |
| ការតាមដានថា PTR អាចកើត (listener non-passive) | `MutationObserver` លើ class របស់ធាតុ React | `uiState.subscribe` (ប្រភពនៃ class ទាំងនោះ) |
| ទីតាំងប្រអប់ណែនាំលេខ | `box.style.width/left/top` | state `uiState.phoneSuggest*` ➜ `style` ក្នុង JSX |
| ព្រឹត្តិការណ៍ប្រអប់ស្វែងរកលេខ · ប្រអប់ណែនាំ | `addEventListener` (input · focus · blur · keydown · mousedown · click) | `onInput` · `onFocus` · `onBlur` · `onKeyDown` · `onMouseDown` · `onClick` លើជួរ |
| ទម្លាក់ឯកសារ (នាំចូល Excel) | `addEventListener` (drag*) ក្នុង `setupSheetImportDropZone()` | `onDragEnter` · `onDragOver` · `onDragLeave` · `onDrop` |
| Enter របស់ម៉ាស៊ីនស្កេន hardware | `addEventListener('keypress')` | `onKeyPress` |
| ចុចដងអូសផ្ទាំង | `addEventListener('click')` ក្នុង `bindPanelSwipe` | `onClick` ➜ `togglePanelFromHandle()` (តួដដែល) |
| អថេរ CSS `--chrome-*` លើ `<html>` | `document.documentElement.style.setProperty` | state ➜ `DocumentEffects` (`useLayoutEffect`) |
| ធាតុវាស់ safe-area (Android) | `createElement` + `appendChild` + `remove` រាល់ការវាស់ | `SafeAreaProbe` (JSX · តែលើ native) + ref |
| `webkit-playsinline` របស់វីដេអូ | `setAttribute` (`app/media.ts`) | ទង់ស្អិត `viewState.cameraWebkitInline` ➜ JSX (ឯកសារ `media.ts` ដកចេញ) |
| សំណាញ់ ៦ វិ. ក្នុង `boot-flags.js` | ដាក់ class លើ `#bootSplash` របស់ React | **ដកចេញ** ៖ ផ្ទាំងជារបស់ React តែមួយ (bundle ដួល = គ្មានផ្ទាំង) · ផ្លូវបម្រុង ៦ វិ. នៅក្នុង React |
| `scrollTop` · `scrollIntoView` · `animate()` ក្នុងកាយវិការ | សរសេរត្រង់ៗ | ច្រកចេញតែមួយ `src/app/refs.ts` · ការរមូរ document ➜ `platform/document-io.ts` |

⛔ **អ្វីដែលនៅមិនមែន JSX ដោយចេតនា** (React ខ្លួនឯងគ្មានទម្រង់ប្រកាស) — រាប់ដោយអ្នកយាមជាមួយ
**ហេតុផល និងពិដានតឹង** (`ZoeW/docs/ARCHITECTURE.md` ផ្នែក ១០ «ច្រកចេញ») ៖ focus · រមូរ · `animate()` ·
input uncontrolled (`refs.ts`) · `<html>`/`<body>` (`DocumentEffects`) · `srcObject`/`muted` របស់ `<video>` ·
listener `touch*` non-passive (React ចាក់វាជា passive) · listener លើ `document`/`window` · `<head>`/ការទាញយក
(`document-io.ts`) · class លើ `<html>` **មុន** stylesheet (`boot-flags.js`)។

#### អ្នកយាមថ្មី/ពង្រឹង

- **`purity:check`** វាស់ `src/app/**` ផង ៖ ការសរសេរ DOM (class · style · attribute · អត្ថបទ · focus · រមូរ ·
  ចលនា · listener លើធាតុ) **០** ក្រៅច្រកចេញ `APP_ALLOWED` (ពិដានតឹង · ធាតុងាប់ ➜ ធ្លាក់)។ Mutation **៦/៦**
  ចាប់ ៖ `style` លើសញ្ញា PTR · `blur()` ក្នុងកាយវិការ · `focus()` លើសពិដានក្នុង `refs.ts` · `classList` ក្នុង
  JSX handler · `el.animate()` ត្រង់ៗ · `addEventListener` លើធាតុថ្មី។
- **`native-check`** (+៥) ៖ សញ្ញា PTR ផ្លាស់ទីតាមម្រាមដៃ · ចុះ DOM **ក្នុងការ dispatch ដដែល** · `ready` ·
  `touchcancel` ➜ ត្រឡប់ភ្លាម · លែងដៃ ➜ `spinning`។ ⛔ វាស់រួច ៖ touch របស់ CDP រត់ microtask **រវាង
  listener** ➜ ការវាស់ដំបូងមិនបែងចែក (mutation «ដក `renderNow`» **រស់រាន**) ➜ ប្តូរទៅ touch ដែល script
  បញ្ជូន (គ្មាន checkpoint) ➜ mutation ដដែល **ធ្លាក់ ២**។

#### អ្វីដែលវាស់បាន

| ការវាស់ | `2.41.0` | **`2.42.0`** |
|---|---|---|
| `audit-tools/run-all.sh` (emulator · strict) ជោគជ័យ / ធ្លាក់ / រំលង | 61 / 120 / 0 | **61 / 120 / 0** |
| ការអះអាងដែលធ្លាក់ (អត្ថបទមិនស្ទួន) | 781 | **782** |

- ស្ថានភាព checker **មិនប្រែមួយណាសោះ** · ការអះអាងធ្លាក់ **ថ្មី ១ តែប៉ុណ្ណោះ** ៖ `boot-animation` «សំណាញ់សុវត្ថិភាព
  ក្នុង `boot-flags.js`» — ការស្វែងរក **អក្សរ** ក្នុង `boot-flags.js` ដែលដកចេញ **ដោយចេតនា** (ផ្ទាំងបើកជារបស់
  React តែមួយ ➜ bundle ដួល = គ្មានផ្ទាំង · ផ្លូវបម្រុង ៦ វិ. ក្នុង React)។ ⛔ checker នោះវាស់ markup ថេរនៃ
  `index.html` ដើម ដែល App React គ្មាន (`index.html` ផលិតកម្មមានតែ `#root`)។
- តំបន់ហាមចូលនៅ **PASS** ដដែល ៖ `gesture` 107 (រួមការចាក់/ដក listener PTR តាមស្ថានភាពផ្ទាំង ➜ `uiState.subscribe`)
  · `panel-motion` 47 · `ios-panel-glide` 38 · `history-menu` 57 · `layout-thrash` 5។
- ZoeW ខ្លួនឯង ៖ `verify` (purity **15** · vitest 61 · android-check 48) · `native-check` **75** · `logic:check`
  (function ដើមបាត់ **០** · ដកចេញដោយចេតនា ៥) · `parity:all` (DOM/layout 721/721 × ៣ · deep · cleanup-rules 115)
  — **បៃតងទាំងអស់**។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0`–`2.41.0` នៅដដែល។
២. **App Android** ៖ build APK ថ្មី (`npm run android:sync` ➜ Android Studio) — គ្មាន plugin ថ្មី។
៣. សាកលើ **iPhone PWA និង Android ពិត** (តំបន់ដែលកូដប្រែ) ៖ ទាញចុះ (PTR) ➜ សញ្ញាវិលរលូន · ស្វែងរកលេខ
   ➜ ប្រអប់ណែនាំលេចត្រង់ក្រោមប្រអប់ · ព្រួញ/Enter/ចុចជួរណែនាំ · ចុចដងអូសផ្ទាំង · ទម្លាក់ឯកសារ Excel
   (កុំព្យូទ័រ) · ម៉ាស៊ីនស្កេន Bluetooth/USB (Enter) · កាមេរ៉ាលើ iPhone។
៤. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify**។

### [2.41.0] — 2026-09-23 · ZoeW ៖ **PTR តាមស្តង់ដា App** (តំបន់ខាងលើ · ស្រទាប់ · ញ័រ) · កំហុស ៥ ដែល `audit-tools` រកឃើញលើ `2.40.0` (branch · មិនទាន់ merge)

**សំណើម្ចាស់គម្រោង** ៖ *«សម្រួល PTR អោយកេះដើរតែពេលប្រអប់ប្រវត្តិមិនទាន់ហូតឡើងបានហើយ
និងពេលបើក modal ផ្សេងៗកុំអោយកេះ PTR ដោយកំណត់តំបន់កេះតែកំណាត់ខាងលើ និងញ័រផង
ដូចទៅហ្នឹងស្តង់ដា App ផ្សេងៗ»*។

**ZoeW ប្រែ** (`zoew-v225` ➜ `zoew-v226`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលអ្នកប្រើឃើញ

- **PTR (ទាញចុះដើម្បីផ្ទុកឡើងវិញ)** — ⛔ តំបន់ហាមប៉ះ ច្បាប់ ១១ ៖ ប៉ះតាមសំណើច្បាស់ ៖
  - ម្រាមដៃត្រូវ **ចាប់ផ្តើមក្នុង ៤០% ខាងលើ** នៃអេក្រង់ ➜ ការអូសពីពាក់កណ្តាល/បាត មិនផ្ទុក
    ទំព័រដោយចៃដន្យ
  - **ប្រអប់ · ម៉ឺនុយ (...) · របា Slide · សោ App បើក ➜ គ្មាន PTR** — រួមទាំង **ការប៉ះដែល
    បិទម៉ឺនុយ** (វាបិទម៉ឺនុយប៉ុណ្ណោះ មិនផ្ទុកទំព័រ)
  - **ញ័រម្តង** ពេលទាញគ្រប់ («លែងដៃដើម្បីផ្ទុក») — App Android (`@capacitor/haptics`)
    និង Chrome លើ Android · ⛔ **iPhone មិនញ័រ** ៖ Safari មិនផ្តល់ API ញ័រដល់ទំព័រវែបទេ
  - ផ្ទាំងប្រវត្តិហូតឡើង ➜ គ្មាន PTR (ដូចមុន — វាស់ម្តងទៀតដោយ `gesture-test`)
- **ផ្ទាំងបើក App (splash)** ៖ សំណាញ់ ៦ វិនាទីក្នុង `boot-flags.js` ត្រឡប់មកវិញ ➜ បើកូដ App ដួល
  ផ្ទាំងនៅតែរសាត់ (`2.40.0` ផ្លាស់វាចូល React ➜ ដើរតែពេល React នៅរស់)។

#### កំហុសដែល `audit-tools/run-all.sh` (checker ដើម · ឯករាជ្យ) រកឃើញលើ `2.40.0`

⛔ ការប្រៀបធៀប **តាមការអះអាងនីមួយៗ** (មិនត្រឹមស្ថានភាព checker) រវាង `2.39.0` និង
`2.40.0` ៖ ការអះអាងធ្លាក់ថ្មី **៥៧** (និងបាត់ ៨ — ភាគច្រើនប្តូរតែអត្ថបទកំហុស `byId` ➜ `fieldValue`) — ភាគច្រើនលាក់ក្នុង checker ដែលក្រហមស្រាប់ ➜ វិភាគម្តងមួយ ៖

| ថ្នាក់ | មូលហេតុ | ការកែ |
|---|---|---|
| **DOM មិនប្រែក្នុង tick ដដែល** (`duplicate-scan` · `item-money` · `duplicate-money` · `page-nav` · `app-lock` · `history-menu` · `ios-panel-glide`) | App ដើមកែ DOM ផ្ទាល់ ➜ ប្រអប់ · របា Slide · ម៉ឺនុយ · ផ្ទាំង ប្រែ **ភ្លាម**; React ២.៤០ ប្រែក្នុង microtask ➜ កូដ/អ្នកវាស់ដែលអានភ្លាមឃើញស្ថានភាពចាស់ (ឧ. ម៉ឺនុយមិនបិទ ខណៈចលនាបើកកំពុងរត់ · snap មិនត្រឡប់ក្រោយ cleanup) | **វាល `markImmediate`** ក្នុង store (រចនាសម្ព័ន្ធ UI ១៨ វាល) ➜ ចុះ DOM ក្នុង tick ដដែល — ⛔ រចនាសម្ព័ន្ធ មិនមែនការចាក់ `commitNow()` ម្តងមួយកន្លែង · អ្នកយាម ៖ `tests/native/immediate-ui.test.tsx` (mutation «បញ្ជីទទេ» ➜ ៤/៤ ធ្លាក់) |
| **ក្រៅបណ្តាញ build វាស់ដួល** (`sw-shell-latency` · `offline-shell` · `sw-cache-key`) | glob `./platform/**` ក្នុង `expose-globals.ts` នាំ plugin Capacitor ជា static ➜ web ផ្ទុក chunk `native-plugins` ដែល SW មិន cache | ដក glob នោះ (build ផលិតកម្មមិនដែលរងផល ៖ `android:check` «web មិនផ្ទុកកូដ native») |
| **សំណាញ់ splash** (`boot-animation`) | បាត់ពី `boot-flags.js` | ប្រគល់ដូច `2.39.0` បេះបិទ |
| **ឈ្មោះ function ប៉ះគ្នាក្នុង bundle វាស់** (`cleanup-interrupt-atomicity` · `late-commit`) | helper ថ្មី `scrollTopOf()` ក្នុង `refs.ts` ប៉ះឈ្មោះ function ដើម ➜ esbuild ប្តូរឈ្មោះ `parseTimestampFromId2` · `buildHistoryRowHtml2` · `scrollTopOf2` ➜ checker ស្រង់តាមឈ្មោះមិនឃើញ | ដក helper ដែលមិនប្រើ និង import ដែលមិនប្រើ |
| **CLAUDE.md យោង helper ដែលដកចេញ** (`doc-scope-test`) | `code128SvgElement()` | ➜ `Code128Svg` · `code128Bars()` |

⛔ **ការធ្លាក់ថ្មីដែលនៅសល់ ជា «វាស់មិនបាន»** (ពិនិត្យម្តងមួយ ៖ ឥរិយាបថនៅដដែល) ៖ checker
ស្តាទិចរកអក្សរក្នុងតួ function ដែលផ្លាស់ចូល helper (`blurActiveElement()` · `beginPdfPrint()` ·
`injectScript()`) · យន្តការ delegation ដែលដកចេញដោយចេតនា · `ReferenceError` ក្នុង `vm` (helper ថ្មី) ·
`doc-scope` កាត់ ១៦០០ តួលើ bundle (indent ២) ➜ រអិលចូល HTML ជួរដេក។

#### អ្វីដែលវាស់បាន

| ការវាស់ | `main` (ZoeW ដើម) | `2.39.0` | `2.40.0` | **`2.41.0`** |
|---|---|---|---|---|
| `audit-tools/run-all.sh` (emulator · `CRUD_FLOW_STRICT=1` · `VERSIONSCOPE_STRICT=1`) ជោគជ័យ / ធ្លាក់ / រំលង | 180 / 1 / 0 | 61 / 120 / 0 | 59 / 122 / 0 | **61 / 120 / 0** |
| ការអះអាងដែលធ្លាក់ (អត្ថបទមិនស្ទួន) | — | 766 | 815 | **781** |

- ធៀប `2.40.0` ៖ ការអះអាងធ្លាក់ **ដកចេញ ៣៤** (ថ្នាក់ ៥ ក្នុងតារាងខាងលើ) · **ថ្មី ១** ៖ `page-nav` «បោះបង់ ➜
  បិទប្រអប់» — វាស់ម្តងមួយ ៖ checker ចុច `[data-act="cancelLogout"]` ដែលលែងមាន (សកម្មភាពជា `onClick`)
  ➜ ការចុចគ្មានអ្វីកើត ➜ **សំណល់នៃការវាស់** ដូច `2.39.0` បេះបិទ (`2.40.0` រាយ ok ដោយ **ចៃដន្យ** ៖ ប្រអប់
  មិនដែលបើកសោះ ➜ «មិនបើក» ពិតដោយស្វ័យប្រវត្តិ)។
- `main` ធ្លាក់ ១ (`repository-file-coverage`) ៖ `node_modules` ដែលមិនស្ថិតក្នុង git ក្នុង repo ស្រមោល — សំណល់នៃការវាស់។
- ZoeW ខ្លួនឯង ៖ `verify` (purity 11 · vitest 61 · native-check 70 · android-check 48) · `logic:check` (function
  ដើមបាត់ **០**) · `parity:all` (DOM/layout 721/721 × អេក្រង់ ៣ · deep · cleanup-rules 115) — **បៃតងទាំងអស់**។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0`–`2.40.0` នៅដដែល។
២. **App Android** ៖ build APK ថ្មី (`npm run android:sync` ➜ Android Studio) — plugin ថ្មី
   `@capacitor/haptics` (សិទ្ធិ `VIBRATE` មានរួច)។
៣. សាកលើ **iPhone PWA និង Android ពិត** ៖ ទាញចុះពីផ្នែកខាងលើ ➜ ផ្ទុក (Android ញ័រម្តង) ·
   ទាញពីផ្នែកខាងក្រោម ➜ មិនផ្ទុក · ទាញពេលប្រអប់/ម៉ឺនុយបើក ➜ មិនផ្ទុក · ផ្ទាំងប្រវត្តិហូតឡើង ➜
   មិនផ្ទុក។ ⛔ **តំបន់ ៤០% ជាលេខដែលអាចកែបាន** (`PTR_START_ZONE_RATIO`) — ប្រាប់បើចង់ធំ/តូចជាងនេះ។
៤. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify**។

### [2.40.0] — 2026-09-23 · ZoeW ៖ **React ១០០%** — React ជាម្ចាស់ DOM តែមួយ (branch · មិនទាន់ merge)

**សំណើម្ចាស់គម្រោង** ៖ *«ខ្ញុំចង់បាន ZoeW ថ្មីជា React ពេញលេញ 100% មិនមែនលាយ»* ·
*«រៀបចំគម្រោងថ្មី អោយមាន JSX, Component lifecycle និងតម្រង់ state management ផង
ដើម្បីថ្ងៃមុខទៅ ងាយស្រួលអភិវឌ្ឍន៍បន្ថែម ឬត្រូវពង្រីកថែម»*។

**ZoeW ប្រែ** (`zoew-v224` ➜ `zoew-v225`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលអ្នកប្រើឃើញ

- **ដូចមុនបេះបិទ** លើ web/PWA និង Android (parity ទាំង ៥ ជាន់ ខាងក្រោម) — លើកលែង
  **ប្រអប់ធីក «ចងចាំអ៊ីមែល» ក្នុងប្រអប់ចូលប្រព័ន្ធ ដោះធីកបានវិញ** ៖ ក្នុង `2.39.0`
  React ចាក់សោវា (`checked` គ្មាន `onChange`) — វាស់ក្នុង browser ៖ `2.39.0` ចុច ➜ នៅធីក ·
  `2.40.0` ចុច ➜ ដោះធីក។ ⛔ ZoeW ដើមលើ `main` មិនដែលមានកំហុសនេះទេ។

#### ស្ថាបត្យកម្ម (សម្រាប់ការអភិវឌ្ឍបន្ត ៖ `ZoeW/docs/ARCHITECTURE.md` ផ្នែក ១១ · `EXTENDING.md`)

- **កូដមុខងារ** (`src/core` · `domain` · `features` · `services` · `ui` · `platform`) ប៉ះ DOM
  **០** កន្លែង (ពី **៧៧៤**) ៖ ប្រអប់ = `uiState.modalDisplay` (`<Modal>`) · អត្ថបទ/ទង់ =
  `viewState` · class ស្ថានភាព (ផ្ទាំង · របា Slide · ម៉ឺនុយ · សោ App) = `uiState` ·
  focus/តម្លៃ/វាស់/រមូរ = ref តាមឈ្មោះ (`src/app/refs.ts`) · `commitNow()` មុនរាល់ការវាស់។
- **កាយវិការ · PTR · ចលនាផ្ទាំង · ការលាក់របា** ផ្លាស់ទៅ `src/app/behaviors/` (ស្រទាប់ React
  តាម ref) — តក្កវិជ្ជាដដែល (`logic:check` ៖ តំបន់ហាមចូល ២០ function ខុសពីដើម **សុទ្ធតែ**
  ការប្តូរ DOM ➜ state/ref ដែលមានហេតុផលម្តងមួយៗ · លំដាប់ · លក្ខខណ្ឌ · slop · ratio ដដែល)។
- `setupActionDelegation()` ដកចេញ ៖ ការចុចទាំងអស់ឆ្លង `onAct()` តែមួយ ➜ គ្មាន listener
  ទី ២ នៅកម្រិត `document` (ច្បាប់ ៤ នៃ «CSP និង `data-act`»)។
- ការប៉ះ `document` ដែលមិនមែន UI (`<head>` · ទាញយក · canvas ក្រៅអេក្រង់ · វដ្តជីវិតទំព័រ)
  រស់ក្នុង `src/platform/document-io.ts` តែមួយ។
- Category ក្នុងរបា Slide ៖ `hidden` ជា state ដែល `refreshDrawerGroups()` សរសេរ (ដូចដើម ៖
  ពេលបើករបា) — ការដេរីវេរាល់ការគូរ ធ្វើឲ្យ DOM ខុសពីដើម (`parity:dom` ចាប់បាន ៣/៣ អេក្រង់)។
- `domText()` ៖ ការបម្លែងដូច setter `innerText` (`undefined` ➜ «undefined») ពេលតម្លៃមកពី
  ទិន្នន័យ — JSX គូរ `{undefined}` ជាទទេ ➜ `parity:deep` ៤០ ជំហានធ្លាក់មុនកែ។

#### អ្នកយាមថ្មី ៖ `npm run purity:check` (ក្នុង `verify`)

| ការវាស់ | វាស់ថាវាធ្លាក់ |
|---|---|
| កូដមុខងារប៉ះ DOM ០ · ការលើកលែងមានហេតុផល **និងពិដានចំនួន** (ពិដានធូរ ឬធាតុងាប់ ➜ ធ្លាក់) | mutation ៣/៣ (`classList` ក្នុង feature · `createElement` ថ្មីក្នុង `document-io` · `elementOf` ក្នុង ui) |
| **ឈ្មោះ ref គ្រប់ឈ្មោះមាន `ref={…}` ពិតចង** (AST មិនមែនវត្តមានអក្សរ) | ✅ ចាប់កំហុសពិតដែលការផ្ទេរជុំនេះបង្កើត ៖ `<video id="configQrVideo">` គ្មាន ref ➜ ស្កេន QR ពេល Config ធ្លាក់ «configQrVideo missing» (browser ៖ មុនកែ ប្រអប់បិទ គ្មាន stream · ក្រោយកែ stream ភ្ជាប់) — tsc · eslint បៃតងលើវា · ការស្កេនអក្សរជំនាន់ដំបូងក៏ **បៃតងក្លែងក្លាយ** (`refTo('x')` ដែលមិនដែលឈរលើ `ref=`) ➜ ប្តូរទៅ AST · mutation ២/២ |
| គ្មាន input ដែល React ចាក់សោ (`value`/`checked` គ្មាន `onChange`) | ✅ tree `2.39.0` ➜ ធ្លាក់ ២ (`rememberMeCheckbox` · `zoomSlider`) |
| ថតទទេ | ✅ ធ្លាក់ (ជាន់អប្បបរមា) |

`slot:check` ពង្រីកទៅ `src/app/**/*.ts` និង `elementOf()` (កូដមុខងារលែងមាន `byId` ➜ ជាន់អប្បបរមា
ចាស់ «ការចង byId >= 100» ធ្លាក់ «ការស្កេនតូចពេក» — វាស់រួចថាវានៅចាប់ `elementOf('phoneSuggestBox').textContent = ''`)។
`src/audit-compat.ts` (**build វាស់តែប៉ុណ្ណោះ**) បកប្រែការសរសេរ class របស់ checker ដើម
(`.collapsed` · `.chrome-hidden` …) ជា state ដដែល ➜ checker វាស់ App React ពិតដោយមិនកែ checker។

#### អ្វីដែលវាស់បាន

| ការវាស់ | លទ្ធផល |
|---|---|
| `npm run verify` (type · lint · slot · **purity** · test · build · parity · smoke · SW · doc · `android:check` · `native:check`) | ✅ ទាំងអស់ · vitest ៥៧ · `android:check` ៤៧ · `native:check` ៦០ |
| `parity` · `parity:dom` · `parity:live` · `parity:deep` · `rules:check` ធៀប ZoeW ដើម | static ១០០% (function ៧៣៥/៧៣៥ + ដកចេញដោយចេតនា ៤ មានហេតុផល) · ធាតុ ៧២១/៧២១ × ៣ អេក្រង់ · ១៨/១៨ · **៧៩/៧៩** · **១១៥/១១៥** |
| `logic:check` | ដូចដើម ៥២០ · ខុសដោយចេតនា ២១៥ · បាត់ ០ · ដកចេញដោយចេតនា ៤ · តំបន់ហាមចូល ៣៣ function (១៣ ដូចដើម · ២០ ខុសដោយហេតុផលកត់ត្រា) |
| `audit-tools/run-all.sh` (emulator រត់) | កំពុងវាស់លើ `main` · `2.39.0` · `2.40.0` ➜ លទ្ធផលក្នុង commit បន្ទាប់ (`ZoeW/docs/PARITY-RESULTS.md` ផ្នែក ៥) |

⛔ **អ្វីដែលមិនបានវាស់** ៖ iPhone PWA ពិត · Android ពិត · APK compile (ដូច `2.39.0`)។
⛔ **តំបន់ហាមចូល (ច្បាប់ ១១) ត្រូវបានផ្លាស់ទីតាមសំណើច្បាស់** ៖ តក្កវិជ្ជាដដែល តែការសាកលើ
ឧបករណ៍ពិតទាំង ២ ប្រព័ន្ធ (PTR · អូសផ្ទាំង · ការលាក់របា) ជាលក្ខខណ្ឌមុន merge។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0` · `2.39.0` នៅដដែល។
២. សាកលើ **iPhone PWA និង Android ពិត** ៖ PTR · អូសផ្ទាំងប្រវត្តិ/ស្កេន · ការលាក់របា Tab ·
   ប្រអប់ស្វែងរកលេខ (auto pull up) · ម៉ាស៊ីនស្កេន hardware · ស្កេន QR ពេល Config ·
   ប្រអប់ធីក «ចងចាំអ៊ីមែល»។
៣. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify** · Android ៖ build APK ថ្មី
   (`npm run android:sync`) បើចង់បានកំណែនេះលើទូរស័ព្ទ។

### [2.39.0] — 2026-09-23 · ZoeW ៖ **App Android (Capacitor)** · lifecycle ជាដំណាក់ · ការវាស់ច្បាប់លុយ/សម្អាត (branch · មិនទាន់ merge)

**សំណើម្ចាស់គម្រោង** ៖ *«រៀបចំគម្រោងថ្មីហ្នឹង អោយគាំទ្រការ setup Capacitor សម្រាប់តែ
android ផង គាំទ្រ biometric, ptr, និង app logo … អោយ Capacitor ដំណើរការទាំងអស់
បានពេញលេញ»* · *«រៀបចំគម្រោងថ្មី អោយមាន JSX, Component lifecycle និងតម្រង់ state
management»* · *«អោយ APK មានលេខកំណែពិតផង»* · *«ដាក់ប្រវត្តិថយក្រោយ android ផង»* ·
*«សូមផ្ទៀងផ្ទាត់ច្បាប់ លុប/ដក និង auto cleanup ២ម៉ោង ៧ថ្ងៃ ២ថ្ងៃ ៣០ថ្ងៃ ផង»*។

**ZoeW ប្រែ** (`zoew-v223` ➜ `zoew-v224`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលអ្នកប្រើឃើញ

- **App Android** (`ZoeW/android/` · appId `com.zoesystem.zoew`) ៖ logo ក្រហម-គូបស
  (adaptive · themed · legacy · splash — កើតពីរូបមេ `resources/icon.svg`) ·
  **លេខកំណែ APK = `APP_VERSION`** (`versionCode` = X×1000000 + Y×1000 + Z ដេរីវេពេល
  Gradle build) · ជីវមាត្រតាម **Android Keystore** · PTR · **ប៊ូតុង Back ជាមួយ
  ប្រវត្តិថយក្រោយ** (ម៉ឺនុយ/ប្រអប់/របា Slide ➜ អេក្រង់មុនម្តងមួយជំហាន ➜ បង្រួម
  App · ⛔ មិនត្រឡប់ចូលរបៀប «ដក») · Export ➜ ផ្ទាំង Share · PDF ➜ PrintManager ·
  សោ App ពេល pause/resume · បិទ backup (កៅអី License មិនត្រូវក្លែងតាមការស្តារ)។
- **web/PWA ៖ មិនប្រែ** — លើកលែង ៖ ជួរ 🩺 «របៀបក្រៅបណ្ដាញ» លើ App Android និងសៀវភៅ
  ណែនាំមានផ្នែក «App Android»។
- ZTO Function ៖ CORS **តែ** origin `https://localhost` (App Android) — សំណើ web
  (same-origin) ទទួល header ដូចមុនបេះបិទ។

#### ស្ថាបត្យកម្ម (សម្រាប់ការអភិវឌ្ឍបន្ត ៖ `ZoeW/docs/EXTENDING.md`)

- `src/boot/bootstrap-statements.ts` ➜ **`src/app/lifecycle/boot.ts`** ៖ ដំណាក់ដែលមាន
  ឈ្មោះ តាមលំដាប់ដើមបេះបិទ · `LifecycleScope` (`listen`/`every`/`onLoad`/`onDispose`
  ដកវិញពេល unmount) · `oncePerPage()` សម្រាប់ការចាប់ផ្តើមដែលដកវិញមិនបាន ➜
  StrictMode/HMR មិនបង្កើត listener ស្ទួន។
- `src/platform/` ៖ អ្នកសម្រេច web ធៀប native តែមួយ · plugin ផ្ទុកតាម dynamic
  import ក្នុង chunk `native-plugins` ដែល Service Worker រំលង (web មិនផ្ទុកវាសោះ)។
- `useStoreValue(store, select)` ៖ component គូរឡើងវិញតែពេលតម្លៃដែលអានប្រែ។
- សោ App ៖ `noteAppLockAway()` ច្រានការហៅស្ទួន (`pause` + `visibilitychange`) —
  បើអត់ ការហៅទី ២ ស៊ីការលើកលែងការខល ហើយចាក់សោខុស។ web ៖ ឥរិយាបថដដែល។

#### អ្វីដែលវាស់បាន

| ការវាស់ | លទ្ធផល |
|---|---|
| `npm run verify` (type · lint · test · build · parity · smoke · SW · doc · `android:check` · `native:check`) | ✅ ទាំងអស់ · vitest ៥៧ · `android:check` ៤៧ · `native:check` ៦០ |
| `parity:dom` · `parity:live` · `parity:deep` ធៀប ZoeW ដើម | ធាតុ ៧២១/៧២១ · ១៨ ជំហាន · **៧៩ ជំហាន** ដូចគ្នាបេះបិទ |
| `logic:check` | ដូចដើម ៦៦៣ · ខុសដោយចេតនា ៧៦ · បាត់ ០ · តំបន់ហាមចូល ៣០/៣១ (`setupIOSPullToRefresh` ខុសដោយហេតុផលកត់ត្រា) |
| **`rules:check` (ថ្មី)** ៖ លុប/ដក · ២ម៉ោង · ៧ថ្ងៃ · កញ្ចប់លាយ · ២ថ្ងៃ · ៣០ថ្ងៃ (ទិន្នន័យ ±១ នាទី សងខាងព្រំដែន) · ledger ថ្ងៃ/ខែ · registry · ស្តារ | **១១៥/១១៥** លើ **ZoeW ដើម · React web · React Android** · DB ក្រោយរាល់ជំហាន = ZoeW ដើម |
| mutation លើ `rules:check` ៖ ធុងសំរាម expired ប្រើ ៣០ ថ្ងៃ · ៧ ថ្ងៃ មិនសម្គាល់ `isDeducted` | **២/២ ចាប់បាន** |
| mutation លើ `native:check` ៖ ដក `setupNativeShell` · ដកការចាប់មុន slop របស់ PTR | **២/២ ចាប់បាន** (តែការចាប់មុន slop ត្រូវការសេណារីយ៉ូ «latch របស់ Chromium» ៖ touch ក្លែងរបស់ CDP **មិន** ធ្លាក់ដោយគ្មានវា) |
| mutation លើ `android:check` ៖ `versionName` literal · `allowBackup` · import static ពី plugin · `package.json` ≠ `APP_VERSION` | **៤/៤ ចាប់បាន** · ថតទទេ ➜ ៥៤ FAIL |
| Gradle ពិត ៖ មុខងារដេរីវេកំណែ | `2.38.0` ➜ `2038000` · `2.39.10` ➜ `2039010` · លេខខូច ➜ build បដិសេធ |
| `audit-tools/` តំបន់ហាមចូល លើ tree adapter | `gesture` ១០៧ · `panel-motion` ៤៧ · `ios-panel-glide` ៣៨ — ដូចជុំមុន |
| `audit-tools/` លុយ/សម្អាត (`trash-modal` · `partial-pickup-cleanup` · `expired-trash-retention` · `policy` · …) | **ដូច baseline HEAD បេះបិទ** — តែពួកវា **មិនអាចវាស់ React** (គាំងពេលស្រង់ `app.js`) ➜ អ្នកវាស់ពិតគឺ `rules:check` និង `parity:deep` |
| `app-lock-test` | ធ្លាក់ ១៥ = baseline (regex «ហៅ top level» ពង្រីកទទួល `oncePerPage('app-lock', initAppLock)`) |

⛔ **អ្វីដែលមិនបានវាស់** ៖ APK **មិនបាន compile** ក្នុងម៉ាស៊ីននេះ (`dl.google.com`
ត្រូវ proxy ហាម ➜ គ្មាន Android SDK/AGP) · កូដ Java របស់ plugin · WebView ពិត ·
Keystore · ទូរស័ព្ទពិត។ `native:check` វាស់ផ្លូវ JS ដល់ព្រំដែន bridge **តែប៉ុណ្ណោះ**។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0` នៅដដែល (សាកលើ iPhone PWA +
   Android ពិត · ផ្ទេរ checker · `repository-file-coverage` · `ZoeW/docs/MIGRATION.md`
   ដំណាក់ ២)។
២. **Build APK** ៖ `cd ZoeW && npm install && npm run android:sync && npm run
   android:open` ➜ Android Studio ➜ Generate Signed APK។ ⛔ **រក្សា keystore** (បាត់ ➜
   APK ថ្មីដំឡើងជាន់ចាស់មិនបាន) · ⛔ កុំ commit វា។
៣. **ZTO Lookup ក្នុង App Android** ត្រូវការ Function ដែលមាន CORS ថ្មី ➜ ដំណើរការ
   តែក្រោយ deploy កូដនេះទៅ `https://zoew.netlify.app` (តម្លៃក្នុង `ZoeW/.env.android`)។
៤. **Firebase** ៖ បើ API key មានការរឹតបន្តឹង HTTP referrer ➜ បន្ថែម `https://localhost`។
៥. **License** ៖ App Android និង PWA លើទូរស័ព្ទដដែល = **២ កៅអី** ក្នុង Key។
៦. សាកលើទូរស័ព្ទពិតតាមតារាង ១៣ ជួរ ក្នុង `ZoeW/docs/ANDROID.md` ផ្នែក ៥ —
   ⛔ ជាពិសេស **PTR** (តំបន់ហាមចូល ច្បាប់ ១១ — ប៉ះតាមសំណើច្បាស់ ផ្លូវ iOS មិនប្រែ) ·
   ប៊ូតុង Back · ជីវមាត្រ (រួម «ក្រយៅដៃត្រូវប្តូរ») · របាស្ថានភាពលើ WebView ចាស់/ថ្មី។
៧. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify**។

### [2.38.0] — 2026-09-23 · ZoeW ជា **React + TypeScript + Vite** (branch · មិនទាន់ merge)

**សំណើម្ចាស់គម្រោង** ៖ *«ខ្ញុំចង់អោយ app ZoeW មាន framework និង build step
ត្រឹមត្រូវ … កុំអោយបាត់មុខងារ ទោះ ០.១%»* រួច *«បើអាចជំនួស ZoeW បាន សូម commit
push ចូល ZoeW»* និង *«រត់ full suits ហើយ commit push»*។

#### អ្វីដែលប្រែ

- `ZoeW/` ទាំងមូលជំនួសដោយគម្រោង React 19 + TypeScript + Vite ៖ កូដតក្កវិជ្ជា
  ក្នុង `src/core` · `src/domain` · `src/features` · `src/services` · `src/ui`
  **កើតពី `app.js` ដើមដោយ codemod** (ឈ្មោះ function · ថេរ · កូនសោ storage
  ដដែល) ហើយ UI ទាំងមូលជា React component។ `style.css` **ដូចដើម byte-for-byte**។
- Netlify ៖ Build command `npm run build` · Publish `dist` (កំណត់ក្នុង
  `ZoeW/netlify.toml`)។ Function ZTO **ដូចដើម byte-for-byte**។
- `license-verify.js` · `error-reporting.js` នៅ byte-identical ជាមួយ ZoeKeyGen
  (ឥឡូវរស់នៅ `ZoeW/public/`)។

#### អ្វីដែលវាស់បាន (លម្អិត ៖ `ZoeW/docs/PARITY-RESULTS.md`)

| ការវាស់ | លទ្ធផល |
|---|---|
| កាតាឡុក (function · ថេរ · state · `data-act` · id · កូនសោ storage · អត្ថបទ · CSS) | ១០០% ទាំង ៨ អ័ក្ស |
| DOM និង layout ទំហំអេក្រង់ ៣ | ធាតុ ៧២១/៧២១ ដូចគ្នា |
| ជំហាន ៧៩ (ផ្លូវលុយ · ចាកចេញ/ចូលវិញ · ZTO · Google Sheet · PDF) × ៦ ជាន់ | ដូចគ្នាបេះបិទ ធៀបនឹង App ដើមដែលកំពុងរត់ |
| function ធៀបដើមតាម token | ដូចគ្នា ៦៧៥ · ខុសដោយចេតនា ៦៤ · បាត់ ០ · តំបន់ហាមចូល ៣០/៣១ (`setupIOSPullToRefresh` ខុសដោយចេតនា) |
| checker តំបន់ហាមចូលរបស់ `audit-tools/` លើ App React | `gesture` ១០៧ · `panel-motion` ៤៧ · `ios-panel-glide` ៣៨ — បៃតង |
| **`audit-tools/run-all.sh` ទាំងមូល** (tree សម្រួល) | ✅ **៥៨** · ❌ **១២០** · ⏭️ ៣ (គ្មាន emulator) |

⛔ **ការធ្លាក់ ១២០ ភាគច្រើនជា *រចនាសម្ព័ន្ធ*** — checker ស្រង់អត្ថបទពី
`app.js` · អាន markup ថេរក្នុង `index.html` · ជំនួស `window.<fn>` ដែលការហៅ
ខាងក្នុង module មិនឆ្លងកាត់ ➜ **ពួកវាមិនបានវាស់ App នេះ**។ ⛔ ការធ្លាក់ទាំងនោះ
**មិនត្រូវបានពិនិត្យម្តងមួយៗទាំងអស់ទេ** ➜ «រចនាសម្ព័ន្ធ» ជាការចាត់ថ្នាក់តាម
គំរូ មិនមែនការធានា។ ការរត់ដោយផ្ទាល់លើ repo (គ្មាន tree សម្រួល) ៖ checker ZoeW
ស្ទើរទាំងអស់ធ្លាក់ដោយ `ENOENT … ZoeW/app.js`។

#### កំហុសពិតដែល checker ដើមរកឃើញ (parity មើលមិនឃើញ) — កែរួច

| កំហុស | អ្នកចាប់ |
|---|---|
| `"type": "module"` ក្នុង `ZoeW/package.json` ➜ Node ផ្ទុក Function ZTO (`require`) ជា ES module ➜ `require is not defined` | `zto-proxy-test` |
| `package-lock.json` ឃ្លាតពី `package.json` (ឈ្មោះ · កំណែ · `engines` · react ក្នុង `dependencies`) | `repository-contract-test` |
| `ZoeW/README.md` ក្លាយជាឯកសារអ្នកអភិវឌ្ឍ ➜ បាត់ផ្នែក ៥ នៃច្បាប់ ៩ និងខ្លឹមសារ «របៀបប្រើ» | `doc-scope-test` |
| build ship sourcemap ដែលផ្ទុក comment (ច្បាប់ ៣) | ការពិនិត្យដោយដៃ |
| `firebase-loader.js` ក្នុង `public/` មាន comment (ច្បាប់ ៣) | `comments` |

⛔ **មេរៀន** ៖ parity ប្រៀបធៀប **App** ចាស់នឹងថ្មី — តែ Function ខាង server ·
`package.json` · ឯកសារ repo **ស្ថិតក្រៅ App** ➜ harness parity ក្លែង ZTO តាម
`route` ហើយ **មិនដែលផ្ទុក Function ពិតសោះ**។ checker ដើមនៅតែចាំបាច់។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** ។ លក្ខខណ្ឌ ៖ (ក) សាកលើ **iPhone (PWA លើអេក្រង់
   ដើម) និង Android ពិត** — PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ (ច្បាប់ ១១);
   (ខ) checker របស់ `audit-tools/` ត្រូវវាស់ App នេះបានពិត (ផ្ទេរទៅ `src/**` ឬ
   ហៅតាម module) និងចាត់ឯកសារថ្មីក្នុង `audit-tools/repository-file-coverage.json`
   (ឥឡូវ `repository-file-coverage` ធ្លាក់ ៖ ឯកសារថ្មីគ្មានអ្នកយាម)។ លម្អិត ៖
   `ZoeW/docs/MIGRATION.md` ដំណាក់ ២។
២. ការសាកលើ deploy preview មាន **origin ផ្សេង** ➜ ត្រូវ Activate ម្តងទៀត ➜
   ⛔ **ស៊ីកៅអីឧបករណ៍** (`maxDevices`) ➜ ប្រើ Key សាកល្បង ឬសុំ admin ដោះកៅអីក្រោយ
   សាករួច។
៣. ⛔ **`check-money.cmd` (`tools/money-check-windows/`) លែងដើរលើ branch នេះ** —
   `money-reality-check.js` ស្រង់ **កូដលុយពិត** ពី `ZoeW/app.js` ដែលលែងមាន ➜
   ការវាស់លុយលើ dump ផលិតកម្ម ត្រូវរត់ពី `main` រហូតដល់ឧបករណ៍នោះត្រូវផ្ទេរ។
៤. ⛔ **គ្មានការកែ Firebase rules** · **គ្មានការប្តូរ env**។ ZoeKeyGen មិនប្រែ។

## 🐛 ផ្នែក ២ — ប្រវត្តិកំហុស និងលេខដែលវាស់បាន (សម័យ React)

### `disconnect` ដែល server អនុវត្តរួច (2.42.6) ៖ ហេតុអ្វី checker ទាំងអស់មើលមិនឃើញ

- **fake SDK ទាំងអស់ចាត់ «reject» = «មិនបានអនុវត្ត»** ➜ របៀបបរាជ័យទី ៥ («បដិសេធ តែអនុវត្តរួច») មិនដែលត្រូវដាក់ចូល។ ថ្នាក់នេះជា
  «stub ដែលនិយាយមិនពិតអំពី dependency» ដូច «stub ដែលទទួលយកគ្រប់ការសរសេរ» ក្នុង `CLAUDE.md` ការព្រមាន ២។
- **ការស្រាវជ្រាវ SDK** ៖ `repoAbortTransactions`/`cancelSentTransactions_` បដិសេធ transaction ស្ថានភាព `SENT` ដោយ `disconnect` ពេល
  ការតភ្ជាប់ដាច់ — server អាចបានទទួល `put` រួច ➜ លទ្ធផល **មិនដឹង** តាមនិយមន័យ។ ការធ្វើឲ្យកើតឡើងវិញក្នុង emulator ពិតតម្រូវ proxy ដែល
  (១) កាត់ **ក្រោយ** frame `put` (WebSocket frame ត្រូវ unmask ដើម្បីស្គាល់វា) និង (២) សរសេរ host ឡើងវិញ (SDK ទទួល host ខាងក្នុងពី
  handshake ហើយភ្ជាប់ផ្ទាល់ទៅ `9000` រំលង proxy ➜ ជុំដំបូងនៃ `emu/tx-disconnect-emu-test` មិនកំណត់)។
- **Mutation** (`money-guardian-test`) ៖ «wrapper បោះ error ដើមជានិច្ច» ➜ `tx-outcome-test` ក្រហម · «រំលងការពិនិត្យម្ចាស់ធុងសំរាម» ➜
  `tx-outcome-test` ក្រហម (ធុងសំរាមស្ទួន + ដកលុយ ២ ដងលើឧបករណ៍ ២)។

### Sentry storm (2.42.6)

- `connection-recovery-test` ផ្នែក ៣ខ លើកូដមុនកែ ៖ `{"captures":49,"rounds":6,"paths":7}` ➜ ក្រោយកែ ៧ (១/path) · ទិសផ្ទុយ ៖ ការដាច់
  **ថ្មី** ក្រោយស្តាររួច រាយការណ៍ម្តងទៀត។ ⛔ ការដកស្ទួនក្នុង `error-reporting.js` ជាជាន់ទី ២ ទូទៅ (App ទាំង ២) មិនមែនជំនួសជាន់ទី ១ ទេ ៖
  វាមិនស្គាល់ «ការដាច់ថ្មី» ហើយបង្អួច ១០ នាទីរបស់វានឹងលេបការដាច់ថ្មីដែលកើតក្នុងបង្អួចនោះ។


### ការផ្ទេរ ZoeW ទៅ React ៖ ការរកឃើញ · ការពង្រឹង · លេខ parity ដែលវាស់បាន (ធ្លាប់ជា `ZoeW/docs/ADDED-VALUE.md` · `PARITY-RESULTS.md`)

> ⛔ **បណ្ណសារ** ៖ លេខក្នុងនេះជារូបភាពនៃថ្ងៃដែលវាត្រូវវាស់ — ផលិតលេខថ្មីដោយ `npm --prefix ZoeW run parity:all` (វិធីសាស្ត្រ ៖
> [`ZoeW/docs/PARITY.md`](../ZoeW/docs/PARITY.md))។ ច្បាប់ដែលនៅរស់រស់នៅ [`ZoeW/docs/ARCHITECTURE.md`](../ZoeW/docs/ARCHITECTURE.md) និង `CLAUDE.md`។

#### ក. ការរកឃើញ និងការពង្រឹង (`ADDED-VALUE.md`)

> អ្នកប្រើស្នើ ៖ *«បើមានចំនុចខ្វះខាតសូមជួយអភិវឌ្ឍន៍បន្ថែមផង»*។
> ផ្នែកខាងក្រោមរាយអ្វីដែល **បន្ថែមលើ** ការផ្ទេរមុខងារ ១:១ ។

---

#### ១. ចន្លោះពិតដែលរកឃើញ និងបិទ

ការសាងឡើងវិញនេះបានចាប់បញ្ហា **៤** ដែលនឹងក្លាយជាកំហុសពិតលើផលិតកម្ម ៖

| # | បញ្ហា | របៀបដែលវាចាប់បាន | ការដោះស្រាយ |
|---|---|---|---|
| ១ | `body { display: flex }` ជាមួយ `order:` លើរបា ➜ ធាតុរុំរបស់ React នឹង **បំបែក layout desktop** | ការអានច្បាប់ CSS មុនសរសេរ + ការវាស់ layout | `#root { display: contents }` |
| ២ | `window.addEventListener('load', …)` នឹង **មិនបាញ់ជារៀងរហូត** បើ React mount ក្រោយ `load` ➜ App មិនចាប់ផ្តើមសោះ | ការវិភាគលំដាប់ចាប់ផ្តើម | `scope.onLoad()` (`src/app/lifecycle/scope.ts`) — រត់ភ្លាមបើផ្ទុករួច |
| ៣ | React **មិនដាក់ attribute `muted`** លើ `<video>` ➜ ច្បាប់ autoplay លើ iOS អាចបដិសេធកាមេរ៉ា | `parity-dom.mjs` ចាប់បានថា attribute បាត់ | `ref` ដែលដាក់ attribute មកវិញ |
| ៤ | ការ dedent របស់ codemod កាត់ចូល **ខាងក្នុង template literal** ➜ HTML នាំចេញ និងរបាយការណ៍ប្រែ | ការវាស់អត្ថបទខ្មែរ ១០០% | dedent ក្លាយជា edit លើអត្ថបទដើម ដោយចេះជៀស quasi |

⛔ ចំណុចទី ៣ និងទី ៤ **មើលមិនឃើញដោយការអានកូដ** — មានតែការវាស់ទេដែល
ចាប់វាបាន។

---

#### ២. ការពង្រឹងដែលជាប់មកជាមួយស្ថាបត្យកម្មថ្មី

##### បញ្ជីសំបករបស់ Service Worker ឈប់ខូចដោយស្ងាត់

ZoeW ដើមសរសេរ `CORE_SHELL` ដោយដៃ។ ធនធានថ្មីដែលភ្លេចដាក់ចូល ➜ **ការស្កេន
ស្លាប់ស្ងាត់ៗពេលក្រៅបណ្តាញ** ។ ឥឡូវបញ្ជីនោះ **ដេរីវេពី `dist/` ពិត** ➜
ថ្នាក់កំហុសនោះលុបចោលតាមរចនាសម្ព័ន្ធ។

##### ព្រំដែនសកម្មភាពពិនិត្យបានពេល build

`window[name]` ➜ ចុះបញ្ជីដែល import ពីម្ចាស់។ ឈ្មោះដែលបាត់ ➜ **build ធ្លាក់**
ជំនួសប៊ូតុងដែលចុចមិនដើរលើផលិតកម្ម។

##### XSS ឈប់ពឹងលើវិន័យ

`sanitizeInput()` នៅមានដដែលសម្រាប់ផ្លូវដែលនៅជា HTML string។ តែតារាងស្នូល
ទាំង ៣ (ប្រវត្តិ · បញ្ជីស្កេន · បញ្ជី Locker) ឥឡូវជា React ➜ **ការគេច
អក្សរជាលំនាំដើម** ។

##### Cache របស់ browser ឈប់ចាស់

ឈ្មោះឯកសារមាន hash ➜ `Cache-Control: immutable` លើ `/assets/*` ➜ អ្នកប្រើ
ទទួលកូដថ្មីភ្លាម ខណៈធនធានចាស់ cache បានយូរ។

##### ការពិនិត្យ type ឆ្លង module ៧០+

ZoeW ដើមគ្មានការពិនិត្យសោះ។ ការពិនិត្យថ្មីបានចាប់ឃើញ **អាគុយម៉ង់លើស**
ក្នុងការហៅ `removeSingleBarcode(itemId, barcodeCode, 'scan-confirmed')` ដែល
មិនដែលអាន — ឥឡូវវាសម្គាល់ច្បាស់ជាជាងលាក់។

---

#### ៣. ឧបករណ៍វាស់ថ្មី

| ឧបករណ៍ | អ្វីដែលវាចាប់ |
|---|---|
| `scripts/parity-static.mjs` | មុខងារ · ថេរ · state · សកម្មភាព · id · កូនសោ · អត្ថបទ · CSS ដែលបាត់ |
| `scripts/parity-dom.mjs` | DOM និង layout ខុសគ្នា លើទំហំអេក្រង់ ៣ |
| `scripts/parity-live.mjs` | លទ្ធផលខុសគ្នា **ជាមួយទិន្នន័យពិត** រួមទាំង *ការសរសេរទៅ server* |
| `scripts/smoke.mjs` | កំហុស runtime ពេល boot |
| `tests/history-row-parity.test.tsx` | ការគូរជួរដេក និងការចុច ខុសពីដើម |
| `scripts/run-audit-tools.mjs` | រត់ checker របស់ ZoeW ដើមលើ tree ថ្មី |

⛔ ឧបករណ៍ទាំងនេះ **មិនមែនតេស្តដែលអះអាងតាមការរំពឹងទុកដែលសរសេរដោយដៃទេ** ៖
ពួកវាប្រៀបធៀបនឹង **App ចាស់ដែលកំពុងរត់ពិតៗ** ➜ ពួកវាមិនអាចខុសទាំងស្រុង
ក្នុងទិសដៅដដែលបានទេ។

---

#### ៤. អ្វីដែល **មិន** ធ្វើ ដោយចេតនា

| អ្វី | ហេតុអ្វី |
|---|---|
| bundle Firebase SDK ពី npm | វានឹងលុបផ្លូវស្តារ «SDK ផ្ទុកមិនបាន» ទាំងមូល |
| bundle SheetJS / ZXing | CSP ហាម CDN ហើយធនធានក្នុង origin ធ្វើឲ្យស្កេនដើរក្រៅបណ្តាញ |
| បំបែក `style.css` ជាច្រើនឯកសារ | លំដាប់ cascade ជាផ្នែកនៃឥរិយាបថ (មានប្លុក `@media` ២ ដែលពឹងលើគ្នា) |
| ប្តូរ PTR · ចលនាផ្ទាំង · ការរមូរ | តំបន់ដែលត្រូវការជុំកែច្រើន និងការថយក្រោយ ២ ដងទើបត្រូវ |
| ប្តូរច្បាប់លុយណាមួយ | ការផ្ទេរ ១:១ ជាលក្ខខណ្ឌនៃ parity |
| បំលែង renderer ក្នុងប្រអប់ទៅ React | មុខងារមិនប្រែ; ហានិភ័យមិនសមនឹងផល — មើលផ្នែកបន្ទាប់ |

---

#### ៥. ការគូរទាំងអស់ជា React

រាល់ផ្ទៃដែលអ្នកប្រើឃើញ ត្រូវគូរដោយ React ៖ តារាងប្រវត្តិ · បញ្ជីស្កេន ·
បញ្ជី Locker · ធុងសំរាម · របាយការណ៍ខែ · កាតស្ថិតិ ២ · តារាងអតិថិជន ·
ពិនិត្យសុខភាព · បញ្ជីកញ្ចប់ក្នុងប្រអប់ · ក្រឡា Locker · ម៉ឺនុយ (...) ·
ការណែនាំលេខទូរស័ព្ទ · របា ZTO និងប្រអប់របស់វា · មើលជាមុនការទាញបញ្ជី ZTO ·
ផ្ទៃបោះពុម្ព PDF · **toast** · **របា «មានកំណែថ្មី»** · **សញ្ញា PTR** ·
និង **ប្រអប់នាំចូល Excel ទាំងមូល** (សារ ៥ · សេចក្តីសង្ខេប · chip ·
មើលជាមុន · `<select>` ទាំង ៥)។

រូបរាង ២ ៖

| រូបរាង | អត្ថន័យ | ឧទាហរណ៍ |
|---|---|---|
| **slot** | React ជាម្ចាស់ *មាតិកា* នៃធាតុដែលមានស្រាប់ | `historyTableBody` · `siChips` · `toastContainer` |
| **element slot** | React ជាម្ចាស់ *ធាតុទាំងមូល* | `<select>` ទាំង ៧ (តម្លៃជា state ➜ ការទុកឲ្យ DOM កាន់តម្លៃ ខណៈ React គូរជម្រើស បង្កើតការប្រណាំងលំដាប់) |

##### អ្វីដែល *នៅ* imperative ដោយចេតនា (ច្រកចេញ — React គ្មានទម្រង់ប្រកាស)

| កន្លែង | ហេតុអ្វី |
|---|---|
| focus · តម្លៃ input · ការរមូរ · FLIP របស់ផ្ទាំង (`animate()`) | ច្រកចេញតែមួយ `src/app/refs.ts` — ច្រកចេញបន្ទាន់ដែល React ណែនាំ (input ជា uncontrolled) |
| វីដេអូកាមេរ៉ា (`srcObject` · `muted`) | React គ្មាន prop `srcObject` · React មិនសរសេរ attribute `muted` (iOS autoplay) |
| listener `touch*` របស់ការអូសផ្ទាំង | React ចាក់ listener `touch*` ជា passive ➜ `preventDefault()` របស់ iOS មិនដើរ |
| `<html>`/`<body>` (class · អថេរ CSS · overflow · title) | ក្រៅ `#root` ➜ `DocumentEffects` ពី state (`useLayoutEffect`) |

⛔ **សញ្ញា PTR គូរដោយ React** (`ptrState` ➜ `PtrIndicator`) រាល់ `touchmove` ក្នុងការ dispatch ដដែល
(`native-check` វាស់) — លែងជាការសរសេរ `style` ផ្ទាល់ទៀតហើយ។
| `<link rel=preconnect>` · `<script>` loader · `<canvas>` ក្រៅអេក្រង់ · `<a download>` | នៅក្រៅ `#root` ឬមិនដែលចូល DOM ➜ រស់ក្នុង `src/platform/document-io.ts` តែមួយ (ការលើកលែងមានហេតុផល និងពិដានចំនួនក្នុង `purity:check`) |

⛔ ក្រៅពីនេះ **React ជាម្ចាស់ DOM តែមួយ** ៖ កូដមុខងារ (`core` · `domain` · `features` ·
`services` · `ui` · `platform`) ប៉ះ DOM **០** កន្លែង — ប្រអប់ · អត្ថបទ · class ស្ថានភាព ·
ប៊ូតុងរវល់ ជា state ដែល JSX គូរ (`ARCHITECTURE.md` ផ្នែក ១១)។

##### អ្នកយាមដែលបន្ថែមក្នុងជុំនេះ

| អ្នកយាម | អ្វីដែលវាចាប់ | បានវាស់ថាធ្លាក់ |
|---|---|---|
| `FUNCTION_REPLACEMENTS` ស្ទួន | ការជំនួស ២ លើ function តែមួយ ➜ ធាតុចុងក្រោយសរសេរជាន់មុន **ដោយស្ងាត់** | ✅ (វាចាប់កំហុសពិត ៖ `renderLockerList` មាន ២ ជំនាន់ ➜ `<select>` នៅសរសេរ `innerHTML`) |
| «element slot គ្មានព្រឹត្តិការណ៍» | React យកធាតុទាំងមូល តែភ្លេចចង handler ➜ ប៊ូតុងស្លាប់ស្ងាត់ៗ | ✅ |
| `tests/code128-parity` | រូប Barcode ដែល React គូរ ខុសពីកំណែដើមដែលឌិកូដដោយ ZXing រួច ➜ **កញ្ចប់ខុសត្រូវបិទក្នុង ZTO** | ✅ (mutation លើ `viewBox` ➜ ក្រហម ៦/៧) |
| `npm run slot:check` | កូដ imperative ប៉ះកូនរបស់ slot React ➜ **App ស** · ទិន្នន័យអតិថិជនត្រឡប់មកវិញក្រោយចាកចេញ | ✅ (ចាប់កំហុសពិត ៣ ឯកសារ · ៣៣ កន្លែង) |
| `reset:` ចាំបាច់ក្នុង `SLOTS` | slot ថ្មីដែលគ្មានការសម្អាតតាម store | ✅ (ការផលិតធ្លាក់) |
| `npm run parity:deep` | ផ្លូវលុយ · ចាកចេញ · ZTO · Sheet · PDF ខុសពីដើម — **៦ ជាន់** រាល់ជំហាន | ✅ (ចាប់ ៖ App ស · ជួរ 🩺 ទទេ · `style=""`) |
| `tests/health-row-parity` + type `HealthRow[]` | ជួរ 🩺 ត្រឡប់ HTML ជំនួស model | ✅ (TypeScript បដិសេធ) |
| `npm run purity:check` | កូដមុខងារប៉ះ DOM ផ្ទាល់ (React លែងជាម្ចាស់តែមួយ) · component ស្វែងរក DOM តាម id · **ឈ្មោះ ref ដែលគ្មាន `ref={…}` ចង** (➜ `elementOf()` = `null` ជានិច្ច) | ✅ (ចាប់កំហុសពិត ៖ ស្កេន QR ពេល Config ធ្លាក់ «configQrVideo missing» — វាស់ក្នុង browser ៖ មុនកែ គ្មាន stream · ក្រោយកែ stream ភ្ជាប់ · mutation ៥/៥ ចាប់ · ថតទទេ ➜ ធ្លាក់) |

#### ខ. លទ្ធផល parity ឆៅ (`PARITY-RESULTS.md`)

> ⚠️ ឯកសារនេះជា **លទ្ធផលឆៅ** នៃការរត់ឧបករណ៍វាស់។ វិធីសាស្ត្រ និងហេតុផល
> ស្ថិតក្នុង [`PARITY.md`](../ZoeW/docs/PARITY.md) ។ ផលិតវាឡើងវិញដោយ `npm run parity:all`
> និង `npm test` ។

---

#### ១. កាតាឡុក (`npm run parity`)

```
╔══════════════════════════════════════════════════════════════════════╗
║  របាយការណ៍ parity ៖ ZoeW (ដើម) ➜ ZoeW React (React + Vite)            ║
╚══════════════════════════════════════════════════════════════════════╝

✅ Function កម្រិតកំពូល         735/735    100.00%
✅ បញ្ជី «ដកចេញដោយចេតនា» មិនងាប់     4/4      100.00%
✅ ថេរ (const)                  213/213    100.00%
✅ State (let)                  176/176    100.00%
✅ សកម្មភាព (data-act)          118/118    100.00%
✅ id ក្នុង index.html          263/263    100.00%
✅ កូនសោ storage                 46/46     100.00%
✅ អត្ថបទដែលអ្នកប្រើអាន         777/777    100.00%
✅ បញ្ជីអត្ថបទ «ដកចេញដោយចេតនា» មិនងាប់     1/1      100.00%
✅ style.css (byte)               1/1      100.00%

🗑️  function ដើមដែលដកចេញដោយចេតនា ៖ 4 (scripts/intentional-removals.mjs)
      • readActionArgs
      • runElementAction
      • setupActionDelegation
      • code128SvgElement

Module ថ្មី ៖ 186 ឯកសារ
Function ដែល export ៖ 978
វាល state ៖ 176
```

---

#### ២. DOM និង layout (`npm run parity:dom`)

```
╔══════════════════════════════════════════════════════════════════════╗
║  parity នៃ DOM និង layout ៖ ZoeW ដើម ធៀបនឹង ZoeW React              ║
╚══════════════════════════════════════════════════════════════════════╝

✅ ទូរស័ព្ទ  390×844   ធាតុ 721/721  ·  layout 18/18
✅ ថេប្លេត  800×1000   ធាតុ 721/721  ·  layout 18/18
✅ Desktop 1440×900   ធាតុ 721/721  ·  layout 18/18

✅ DOM និង layout ដូចគ្នាគ្រប់ទំហំអេក្រង់
```

---

#### ៣. ទិន្នន័យពិត និងអន្តរកម្ម (`npm run parity:live`)

⛔ App ទាំង ២ ភ្ជាប់នឹង **Firebase ក្លែងក្លាយតែមួយ** ➜ លេខ · លុយ · ការសរសេរ
ទៅ server ត្រូវប្រៀបធៀបលើទិន្នន័យដដែល រួចដើរជំហានអន្តរកម្ម ១៨ ដូចគ្នាបេះបិទ។

```
╔══════════════════════════════════════════════════════════════════════╗
║  parity ជាមួយទិន្នន័យ ៖ ZoeW ដើម ធៀបនឹង ZoeW React                   ║
╚══════════════════════════════════════════════════════════════════════╝

✅ historyRows                  3
✅ historyTable                 ដូចគ្នា (4286 តួ)
✅ entryList                    ដូចគ្នា (0 តួ)
✅ lockerList                   ដូចគ្នា (0 តួ)
✅ trashList                    
✅ count                        3
✅ grandTotalCount              4
✅ todayTotalCount              0
✅ todayClosedCount             1
✅ todayPackagesPickedUpCount   1
✅ summaryCodDollar             $19.50
✅ summaryCodRiel               79,950 ៛
✅ summaryDodDollar             $6.75
✅ summaryDodRiel               27,675 ៛
✅ summaryTotalDollar           $26.25
✅ summaryTotalRiel             107,625 ៛
✅ statusText                   ភ្ជាប់ Server រួចរាល់
✅ writeLog                     txn zoew_scan_history_cod_dod/i2,update zoew_recently_deleted_cod_dod
✅ listenerThrew                null
✅ rejections                   

កំហុស runtime ៖ ដើម 0 · ថ្មី 0

── អន្តរកម្មជាបន្តបន្ទាប់ ──
✅ តម្រង «ទាំងអស់»                ធាតុ 801/801  អេក្រង់ប្រែ
✅ ប្រអប់បញ្ជីកញ្ចប់              ធាតុ 813/813  អេក្រង់ប្រែ
✅ បិទប្រអប់បញ្ជី                 ធាតុ 813/813  អេក្រង់ប្រែ
✅ ទំព័រស្កេន                     ធាតុ 837/837  អេក្រង់ប្រែ
✅ របៀប Locker                    ធាតុ 851/851  អេក្រង់ប្រែ
✅ របៀបដក                         ធាតុ 851/851  អេក្រង់ប្រែ
✅ ត្រឡប់របៀបកញ្ចប់               ធាតុ 851/851  អេក្រង់ប្រែ
✅ ត្រឡប់ទំព័រទិន្នន័យ            ធាតុ 851/851  អេក្រង់ប្រែ
✅ ម៉ឺនុយ (...) ខាងលើ             ធាតុ 858/858  អេក្រង់ប្រែ
✅ ធុងសំរាម                       ធាតុ 908/908  អេក្រង់ប្រែ
✅ បិទធុងសំរាម                    ធាតុ 908/908  អេក្រង់ប្រែ
✅ របាយការណ៍ខែ                    ធាតុ 963/963  អេក្រង់ប្រែ
✅ បិទរបាយការណ៍ខែ                 ធាតុ 963/963  អេក្រង់ប្រែ
✅ បើករបា Slide                   ធាតុ 963/963  អេក្រង់ប្រែ
✅ ពន្លា Category «ការតភ្ជាប់»    ធាតុ 963/963  អេក្រង់ប្រែ
✅ ពន្លា Category «ឧបករណ៍»        ធាតុ 963/963  អេក្រង់ប្រែ
✅ បិទរបា Slide                   ធាតុ 963/963  អេក្រង់ប្រែ
✅ តម្រង «ថ្ងៃនេះ» វិញ            ធាតុ 963/963  អេក្រង់ប្រែ

── តារាងទំព័រស្កេន (មានទិន្នន័យ) ──
✅ បញ្ជីកញ្ចប់ថ្ងៃនេះ         768 តួ
✅ បញ្ជីតាម Locker            312 តួ

កំហុស runtime សរុប ៖ ដើម 0 · ថ្មី 0
ជំហានដែលមិនប្តូរអេក្រង់ ៖ 0/18

✅ គ្រប់វាល 20 · គ្រប់ជំហាន 18 · គ្រប់តារាង ដូចគ្នាបេះបិទ
```

---

#### ៣ខ. ផ្លូវលុយ · ចាកចេញ · ZTO · Google Sheet · PDF (`npm run parity:deep`)

⛔ **ហេតុអ្វីមានជាន់នេះ** ៖ `parity:live` មិនដែល **សរសេរលុយ** ទេ (គ្មានជំហានណា
ស្កេន · បិទ · ដក · ស្តារ) ហើយវាប្រៀបធៀបត្រឹម `op + path` នៃការសរសេរ — App ២
អាចសរសេរ **ចំនួនលុយខុសគ្នា** ទៅ path ដដែល ហើយវានៅតែរាយ ✅។

រាល់ជំហានប្រៀបធៀប **៦ ជាន់** ៖ អេក្រង់ទាំងមូល (រួមតម្លៃ form control) · ការសរសេរ
ទៅ server (**តម្លៃពេញ**) · ស្ថានភាព DB **ទាំងមូល** · ប្រអប់ `confirm`/`alert` ·
តួសំណើទៅ Apps Script/ZTO · សារ toast តាមលំដាប់ — បូក **ផ្ទៃបោះពុម្ព PDF** តាមក្រឡា។
នាឡិកា browser **ឈប់** ហើយរំកិលដោយចំនួនដូចគ្នាទាំង ២ App ➜ ត្រា «ឥឡូវ» ស្មើគ្នា។
ជំហានដែល **មិនប្តូរអ្វីសោះ** រាប់ជាការធ្លាក់ (វាមិនបានវាស់អ្វីទេ)។

```
╔══════════════════════════════════════════════════════════════════════╗
║  parity ជម្រៅ ៖ ផ្លូវលុយ · ចាកចេញ/ចូលវិញ · ប្រអប់ (ZoeW ដើម ➜ Next)  ║
╚══════════════════════════════════════════════════════════════════════╝

── សេណារីយ៉ូ ៖ ស្នូល (ស្កេន · លុយ · ធុងសំរាម · PIN · នាំចូល · ចាកចេញ) ──
✅ ទំព័រស្កេន                         សរសេរ  0
✅ ស្កេន NEW1 ➜ ប្រអប់លេខទូរស័ព្ទ     សរសេរ  0
✅ បំពេញ ➜ យល់ព្រម (សរសេរលុយ)         សរសេរ  4  🔔
✅ ស្កេន AA1 ស្ទួន                    សរសេរ  0  🔔
✅ ត្រឡប់ទំព័រទិន្នន័យ                សរសេរ  0
✅ តម្រង «ទាំងអស់»                    សរសេរ  0
✅ បិទកញ្ចប់ 012345678                សរសេរ  4  🔔  💬
✅ បើកវិញ 012345678                   សរសេរ  4  🔔  💬
✅ បញ្ជី ➜ បិទ barcode ទី ២           សរសេរ  4  🔔  💬
✅ កែតម្លៃ barcode ទី ១               សរសេរ  4  🔔
✅ បិទប្រអប់បញ្ជី                     សរសេរ  0
✅ សម្គាល់ការខល «អត់លើក»              សរសេរ  1  🔔
✅ កែលេខទូរស័ព្ទ 0888888              សរសេរ  1  🔔
✅ លុបកញ្ចប់ 0888889                  សរសេរ  2  🔔  💬
✅ ធុងសំរាម                           សរសេរ  0
✅ ស្តារធាតុទី ១                      សរសេរ  5  🔔
✅ លុបជាអចិន្ត្រៃយ៍ធាតុទី ១           សរសេរ  3
✅ បិទធុងសំរាម                        សរសេរ  0
✅ របៀបដក ➜ ស្កេន CC1                 សរសេរ  0
✅ បញ្ជាក់ការដក (ដកលុយ)               សរសេរ  4  🔔
✅ របៀប Locker ➜ ស្កេន NEW1           សរសេរ  1  🔔
✅ ត្រឡប់របៀបកញ្ចប់ ➜ ទំព័រទិន្នន័យ   សរសេរ  0
✅ អត្រាប្រាក់ 4200                   សរសេរ  1  🔔
✅ ស្ថិតិប្រចាំថ្ងៃ                   សរសេរ  0
✅ បិទស្ថិតិ                          សរសេរ  0
✅ ចំណូលប្រចាំថ្ងៃ                    សរសេរ  0
✅ បិទចំណូល                           សរសេរ  0
✅ ស្វែងរក «015»                      សរសេរ  0
✅ សម្អាតការស្វែងរក                   សរសេរ  0
✅ Reset ចំនួនយករួច ➜ កំណត់ PIN       សរសេរ  1  🔔  💬
✅ របា Slide ➜ ពិនិត្យសុខភាព          សរសេរ  0
✅ បិទពិនិត្យសុខភាព                   សរសេរ  0
✅ នាំចូល Excel ➜ PIN                 សរសេរ  0
✅ រក្សាទុកការតភ្ជាប់ Sheet           សរសេរ  0  🔔  📤
✅ ជ្រើសឯកសារ CSV                     សរសេរ  0  📤
✅ ផ្គូផ្គង Barcode · DOD · Phone     សរសេរ  0
✅ ផ្គូផ្គង COD ➜ ជួរឈរ C             សរសេរ  0
✅ ផ្គូផ្គង COD ➜ មិនប្រើ             សរសេរ  0
✅ ផ្គូផ្គង COD ➜ ជួរឈរ C វិញ         សរសេរ  0
✅ របៀប «ថ្មីតែប៉ុណ្ណោះ»              សរសេរ  0
✅ នាំចូលទៅ Sheet                     សរសេរ  0  🔔  📤
✅ សម្អាតទិន្នន័យក្នុង Sheet          សរសេរ  0  🔔  💬  📤
✅ បិទប្រអប់នាំចូល                    សរសេរ  0
✅ កែទឹកប្រាក់/កញ្ចប់ (PIN)           សរសេរ  2  🔔
✅ តម្រងថ្ងៃផ្ទាល់ខ្លួន 2026-09-21    សរសេរ  0
✅ តម្រង «ទាំងអស់» វិញ                សរសេរ  0
✅ កំណត់ទូ Locker (PIN)               សរសេរ  0  🔔
✅ ប្តូរទូ ➜ ក្រឡាទី ៣                សរសេរ  0  🔔
✅ ត្រឡប់ទំព័រទិន្នន័យ (២)            សរសេរ  0
✅ របាយការណ៍ខែ ➜ ជ្រើសខែ              សរសេរ  0
✅ របាយការណ៍ខែ ➜ PDF                  សរសេរ  0
✅ Export ➜ PDF (ប្រវត្តិ)            សរសេរ  0
✅ ចាកចេញ                             សរសេរ  0  🔔
✅ ទិន្នន័យអតិថិជនក្រោយចាកចេញ         ដើម [] · ថ្មី []
✅ ចូលវិញ                             សរសេរ  0  🔔
✅ ទំព័រស្កេនក្រោយចូលវិញ              សរសេរ  0
✅ បញ្ជី Locker ក្រោយចូលវិញ           សរសេរ  0
✅ ធុងសំរាមក្រោយចូលវិញ                សរសេរ  0
✅ បិទធុងសំរាម (២)                    សរសេរ  0
✅ លុបទាំងអស់ (PIN)                   សរសេរ  9  🔔  💬
✅ ធុងសំរាមក្រោយលុបទាំងអស់            សរសេរ  0

── សេណារីយ៉ូ ៖ ZTO (របា · ប្រអប់ · ទាញបញ្ជី · បញ្ចូល) ──
✅ ទំព័រទិន្នន័យ (មានរបា ZTO)         សរសេរ  0
✅ ចុចរបា ➜ បញ្ជី ZTO មិនទាន់បិទ      សរសេរ  0
✅ ពិនិត្យម្តងទៀត                     សរសេរ  0  🔔
✅ បិទបញ្ជី                           សរសេរ  0
✅ បើកទាញបញ្ជី ZTO ➜ កំណត់ PIN        សរសេរ  0
✅ ជួរថ្ងៃ 2026-09-17 ➜ 2026-09-22    សរសេរ  0
✅ ទាញបញ្ជី (មើលជាមុន)                សរសេរ  0  🔔
✅ បញ្ចូល (សរសេរលុយ)                  សរសេរ 16  🔔  💬
✅ បិទប្រអប់ទាញបញ្ជី                  សរសេរ  0
✅ តារាង «ថ្ងៃនេះ» ក្រោយបញ្ចូល        សរសេរ  0
✅ ទំព័រស្កេន ➜ ស្កេន ZL9 ស្ទួន       សរសេរ  0  🔔
✅ ស្កេន ZL5 ➜ ZTO បំពេញស្វ័យប្រវត្តិ សរសេរ  0
✅ យល់ព្រម (សរសេរលុយពី ZTO)           សរសេរ  4  🔔

── សេណារីយ៉ូ ៖ Google Sheet (តារាងអតិថិជន · Lookup) ──
✅ តារាងអតិថិជន (PIN)                 សរសេរ  0
✅ ស្វែងរកក្នុងតារាង «096»            សរសេរ  0
✅ ស្វែងរក «<b>» (គេចអក្សរ)           សរសេរ  0
✅ បិទតារាង                           សរសេរ  0
✅ ទំព័រស្កេន ➜ ស្កេន NEW7 (Lookup Sheet) សរសេរ  0  🔔
✅ យល់ព្រម (សរសេរលុយពី Sheet)         សរសេរ  4  🔔

កំហុស runtime ៖ ដើម 0 · ថ្មី 0
ជំហានដែលមិនប្តូរអ្វីសោះ ៖ 0/79

✅ ជំហានទាំង 79 ដូចគ្នាបេះបិទ (អេក្រង់ · ការសរសេរ · DB · ប្រអប់ native · Apps Script · toast · ZTO)
```

---

#### ៤. តេស្ត differential នៃការគូរ (`npm test`)

```
 RUN  v3.2.7 /home/user/zoew-next

 ✓ tests/code128-parity.test.tsx (7 tests) 100ms
 ✓ tests/toast-parity.test.tsx (7 tests) 85ms
 ✓ tests/health-row-parity.test.tsx (9 tests) 53ms
 ✓ tests/history-row-parity.test.tsx (2 tests) 2051ms
   ✓ ជួរដេកប្រវត្តិ ៖ React ធៀបនឹង builder ចាស់ > ផលិតរចនាសម្ព័ន្ធដូចគ្នាលើទិន្នន័យចៃដន្យ ៣០០ ធាតុ  1604ms
   ✓ ជួរដេកប្រវត្តិ ៖ React ធៀបនឹង builder ចាស់ > ការចុចពិត ហៅសកម្មភាពដដែលនឹង `data-act` ចាស់  445ms

 Test Files  4 passed (4)
      Tests  25 passed (25)
   Start at  20:46:44
   Duration  4.06s (transform 1.59s, setup 71ms, collect 3.88s, tests 2.29s, environment 1.41s, prepare 435ms)
```

**អ្វីដែលតេស្តទាំងនេះចាក់សោ ៖**

| ឯកសារ | ថ្នាក់កំហុសដែលវាចាប់ | mutation ដែលវាស់ថាក្រហម |
|---|---|---|
| `history-row-parity` | ជួរដេកប្រវត្តិរបស់ React ឃ្លាតពី builder HTML ចាស់ លើទិន្នន័យចៃដន្យ ៣០០ ធាតុ · ការចុចហៅសកម្មភាពខុស | ✅ |
| `code128-parity` | រូប Barcode ដែល React គូរ ខុសពីកំណែដើមដែលឌិកូដដោយ ZXing រួច ➜ **កញ្ចប់ខុសត្រូវបិទក្នុង ZTO** | `viewBox` ចង្អៀត ១០ module ➜ **៦/៧ ក្រហម** |
| `toast-parity` | ការចុះឈ្មោះ toast ផ្លាស់ពី DOM ទៅបញ្ជីក្នុង store ➜ ពិដាន ៤ · អ្នកបោះរំលង toast រស់ · class តាមសញ្ញា · ចលនា `.show` ២ ដំណាក់ · ការប្រកាសឡើងវិញ | ពិដាន ៤ ➜ ៩៩ · អ្នកបោះមិនរំលង · `.show` មិនដាក់ ➜ **ក្រហមទាំង ៣** |
| `health-row-parity` | ជួរ 🩺 របស់ React ខុសពី `healthRowHtml()` ដើម (អ្នកសម្រេច) · ជួរ «កំពុងពិនិត្យ…» (⏳ · គ្មាន detail) · **ទិសផ្ទុយ** ៖ ខ្សែអក្សរ HTML មិនមែនជាជួរ | ✅ + TypeScript (`HealthRow[]`) បដិសេធអ្នកសាងជួរដែលត្រឡប់ខ្សែអក្សរ |

---

#### ៥. កំហុសពិតដែលឧបករណ៍វាស់ចាប់បាន

⛔ **នេះជាហេតុផលដែលឧបករណ៍ទាំងនេះមាន** — ការអានកូដមិនបានឃើញពួកវាទេ ៖

| កំហុស | អ្នកចាប់ | ផលប៉ះពាល់បើ ship |
|---|---|---|
| `#root` បំបែក layout desktop (`body{display:flex}` + `order:`) | `parity:dom` | ទំព័រខូចលើកុំព្យូទ័រ |
| `load` បាញ់រួចមុន React mount | `smoke` | ការចាប់ផ្តើមខ្លះមិនរត់ |
| React ទម្លាក់ attribute `muted` លើ `<video>` | `parity:dom` | កាមេរ៉ាមិនចាប់ផ្តើមលើ iOS |
| dedent កាត់ខាងក្នុង template literal | `verify` (typecheck) | កូដខូច |
| `FUNCTION_REPLACEMENTS` ស្ទួន ➜ `renderLockerList` ជំនាន់ចាស់ឈ្នះ | អ្នកយាមថ្មី | `<select>` នៅសរសេរ `innerHTML` ➜ តម្រងលោតត្រឡប់ |
| ម៉ឺនុយ (...) ត្រូវវាស់ទំហំ **មុន** React គូរធាតុរបស់វា | `parity:live` | ម៉ឺនុយហៀរក្រៅអេក្រង់ (left 245px ធៀប 137px) ➜ ចុចមិនដល់ |
| ប៊ូតុងម៉ឺនុយ (...) បាត់ `data-act` | `parity:live` | **ម៉ឺនុយទាំងមូលស្លាប់** ៖ Export · របាយការណ៍ខែ · កែទឹកប្រាក់ · អត្រាប្រាក់ · ធុងសំរាម · Reset · លុបទាំងអស់ |
| ជម្រើស «— មិនប្រើ —» លេចមុន `fillSheetImportMappingSelects()` | `parity:dom` | ធាតុលើសពេលសម្រាក |
| **`hidePhoneSuggestions()` សម្អាត `phoneSuggestBox` តាម `textContent = ''`** ខណៈ React ជាម្ចាស់កូនរបស់វា | `parity:deep` ➜ `slot:check` | **App ទាំងមូលក្លាយជាអេក្រង់ស** (`removeChild` ធ្លាក់ ➜ React បោះបង់ root) — ក្រោយវាយក្នុងប្រអប់ស្វែងរក រួចសម្អាត ឬចេញពីវា ៖ ការប្រើប្រាស់ **រាល់ថ្ងៃ** |
| **ការចាកចេញសម្អាត ២០+ slot តាម DOM** (`clearSensitiveModalFields()`) | `slot:check` | ទិន្នន័យអតិថិជន **នៅក្នុង store** ➜ ត្រឡប់មកវិញពេលគូរលើកក្រោយ · តារាងនៅទទេក្រោយចូលវិញ |
| **🩺 ពិនិត្យសុខភាព ៖ អ្នកសាងជួរទាំង ៩ នៅត្រឡប់ខ្សែអក្សរ HTML** ខណៈ component រំពឹង model | `parity:deep` ➜ TypeScript | ប្រអប់បង្ហាញ **ជួរទទេ ៩** ខណៈ parity ស្តាទិច ១០០% |
| ស្លាក «ថ្មី» ➜ «យកហើយ» ប្រើ `<span>` ដដែលឡើងវិញ ➜ សល់ `style=""` | `parity:deep` | attribute លើស (មើលមិនឃើញ តែ DOM មិនដូចដើម) |
| **`"type": "module"` ក្នុង `package.json`** ➜ Node ផ្ទុក Function ZTO (`require`) ជា ES module ➜ `require is not defined` (វាស់បានក្នុង Node · ⚠️ មិនបានវាស់លើ Netlify ពិត) | `zto-proxy-test` (checker ដើម) | ហានិភ័យ ៖ **Function ZTO មិនផ្ទុក ➜ ការស្កេន ZTO ធ្លាក់** — parity មើលមិនឃើញ ព្រោះវាក្លែង ZTO តាម `route` មិនបានផ្ទុក Function ពិតសោះ |
| `package-lock.json` ឃ្លាតពី `package.json` (ឈ្មោះ · កំណែ · `engines` · ទីតាំង react) | `repository-contract-test` (checker ដើម) | ការដំឡើងលើ Netlify មិនកំណត់ទុកជាមុន |
| build ship **sourcemap** ដែលផ្ទុក comment ទាំងអស់ | ការពិនិត្យដោយដៃក្រោយ `comments` | ខុសច្បាប់ ៣ (កូដ ship គ្មាន comment) |
| README ក្លាយជាឯកសារអ្នកអភិវឌ្ឍ ➜ បាត់ **ផ្នែក ៥ នៃច្បាប់ ៩** និងខ្លឹមសារ «របៀបប្រើ» ៤៩២ បន្ទាត់ | `doc-scope-test` (checker ដើម) | អ្នកតំឡើងបាត់ឯកសារណែនាំ · ការអះអាងកំណែជាកំណត់ត្រាតាមកំណែ |

##### កំហុសក្នុង **ឧបករណ៍វាស់ខ្លួនឯង** ដែលរកឃើញ (ក្រោមពួកវា ការវាស់ពីមុនខ្សោយជាងការអះអាង)

| កំហុស | ផល |
|---|---|
| ទិន្នន័យគំរូចងនឹងថ្ងៃ `2026-09-22` តែនាឡិកា browser ជាម៉ោងពិត | ក្រោយពាក់កណ្តាលអធ្រាត្រនៅភ្នំពេញ ទិដ្ឋភាព «ថ្ងៃនេះ» **ទទេទាំង ២ App** ➜ ជំហានវាស់អ្វីក៏មិនបាន · ច្បាប់ ២ ម៉ោងរត់ឬមិនរត់ តាមម៉ោងដែលរត់ |
| Firebase ក្លែងក្លាយ **មិនដែលបាញ់** `onAuthStateChanged` ពេលចាកចេញ | ផ្លូវចាកចេញ/ចូលវិញ **មិនដែលត្រូវវាស់** |
| Firebase ក្លែងក្លាយបាញ់ `.info/connected = null` រាល់ការសរសេរ | App ទាំង ២ ជឿថាដាច់បណ្តាញមួយភ្លែតក្រោយរាល់ការសរសេរ |
| `page.route` មើលមិនឃើញសំណើរបស់ Service Worker | ផ្លូវ ZTO ត្រូវ 404 ➜ «ពិនិត្យមិនបាន» ទាំង ២ App |


##### `audit-tools/run-all.sh` លើ App React (tree `dist-audit` ក្នុង repo ស្រមោល)

រត់ជាមួយ RTDB emulator ពិត · `CRUD_FLOW_STRICT=1` · `VERSIONSCOPE_STRICT=1` ៖

| tree | ✅ ជោគជ័យ | ❌ ធ្លាក់ | ⏭️ រំលង |
|---|---|---|---|
| ZoeW ដើម (`main`) | 180 | 1 | 0 |
| App React — build វាស់ចាស់ (អត្ថបទ esbuild · `index.html` ទទេ) | 61 | 120 | 0 |
| App React — ស្រទាប់ build វាស់ ([`MIGRATION.md`](../ZoeW/docs/MIGRATION.md) ដំណាក់ ២) | **108** | **73** | 0 |

- ⛔ **សុពលភាព** ៖ `money-guardian` ចាក់ mutation លុយ **១០/១០** ចូលកូដ React ➜ អ្នកយាម **ចាប់បានទាំងអស់**
  (ការធ្លាក់ ១ របស់វាគឺ `price-edit-abort-test` មិនទាន់បៃតងលើ tree ស្អាត)។ checker លុយដែលបៃតង ៖ `policy-test` ·
  `revenue-fuzz` · `ledger-clamp-symmetry` · `ledger-failed-apply-revert` · `monthly-ledger-agreement` ·
  `pickup-ledger` · `pickup-barcode-identity` · `collected-mirror-*` · `cleanup-interrupt-atomicity` · `money-reality` …
- ស្ថានភាព checker ពីបៃតង ➜ ក្រហម **១** ៖ `state-hygiene` (វាឃើញ `let` កម្រិត module ២ ថ្មីរបស់ឃ្លាំង ·
  ⛔ ហើយវា **មិនឃើញ** state ក្នុងឃ្លាំងទាល់តែសោះ ➜ ត្រូវផ្ទេរ checker)។

- `main` ធ្លាក់ ១ (`repository-file-coverage`) ៖ `node_modules` ក្រៅ git ក្នុង repo ស្រមោល — សំណល់នៃការវាស់។
- ការធ្លាក់លើ App React ភាគច្រើនជា **សំណល់នៃការវាស់** ៖ checker ស្រង់អត្ថបទ/function តាមឈ្មោះពី `app.js`
  ចាស់ចូល `vm` (helper ថ្មី ➜ `ReferenceError`) · ជំនួស `window.<fn>` (ការហៅខាងក្នុង module មិនឆ្លង `window`) ·
  ចុច `[data-act=…]` ដែលលែងមាន (សកម្មភាពជា `onClick`) · ចាប់ listener តាម `addEventListener` ក្នុង `vm`
  (handler ជា prop របស់ JSX)។
- ⛔ **ការប្រៀបធៀបត្រូវធ្វើតាមការអះអាងនីមួយៗ** មិនមែនតាមស្ថានភាព checker ៖ checker ដែលក្រហមស្រាប់
  លាក់ការថយក្រោយថ្មី (វាស់បាន ៖ ការធ្លាក់ថ្មីពិត ៥ ថ្នាក់ លាក់ក្នុង checker ដែលក្រហមរួច)។
- ⛔ **checker ទាំងនោះមិនទាន់ត្រូវបានផ្ទេរ** ➜ ភាពបៃតងនៃឧបករណ៍របស់ ZoeW ខ្លួនឯងមិនមែនការធានាថា
  គ្មានកំហុសពិតលាក់ខ្លួនក្នុងការធ្លាក់ទាំងនោះទេ ([`MIGRATION.md`](../ZoeW/docs/MIGRATION.md) ដំណាក់ ២)។

ការរត់ដោយផ្ទាល់លើ repo (គ្មាន tree សម្រួល) ៖ checker ZoeW ស្ទើរទាំងអស់ធ្លាក់
ដោយ `ENOENT … ZoeW/app.js`។

---

#### ៦. សេចក្តីសន្និដ្ឋាន

| វិមាត្រ | លទ្ធផល |
|---|---|
| មុខងារ · ថេរ · state · សកម្មភាព · id · កូនសោ · អត្ថបទ · CSS | **១០០%** គ្រប់វិមាត្រ |
| ធាតុ DOM និង layout លើទំហំអេក្រង់ ៣ | **ដូចគ្នាបេះបិទ** |
| តារាង · ស្ថិតិ · លុយ · ការសរសេរទៅ server ជាមួយទិន្នន័យពិត | **ដូចគ្នាបេះបិទ** |
| ផ្លូវលុយទាំងអស់ · ចាកចេញ/ចូលវិញ · ZTO · Google Sheet · PDF (**៧៩ ជំហាន · ៦ ជាន់**) | **ដូចគ្នាបេះបិទ** · ជំហានទទេ ០ · កំហុស runtime ០ |
| ជំហានអន្តរកម្ម (តម្រង · ប្រអប់ · ទំព័រ · របៀប · ម៉ឺនុយ · ធុងសំរាម · របាយការណ៍ខែ · របា Slide) | **ដូចគ្នាបេះបិទ** |
| ការគូរជួរដេកប្រវត្តិ លើទិន្នន័យចៃដន្យ ៣០០ ធាតុ | **ដូចគ្នាបេះបិទ** |
| កំហុស runtime | **០** ទាំង App ចាស់ និងថ្មី |

---

## 🔎 លិបិក្រម — ឈ្មោះ checker ➜ ការពន្យល់រស់នៅឯណា

> ⛔ **តារាងនេះដេរីវេពីការលេចពិត** នៃឈ្មោះ checker (`audit-tools/**/*.js`) ក្នុងឯកសារទាំង ២ — មិនមែនសរសេរដោយដៃ។
> ផ្លូវធម្មតា ៖ checker ធ្លាក់ ➜ រកឈ្មោះវាត្រង់នេះ ➜ `grep -n "<ឈ្មោះ>" docs/HISTORY.md docs/HISTORY-ARCHIVE.md`។

| Checker | `HISTORY.md` (សម័យ React) | `HISTORY-ARCHIVE.md` (សម័យ vanilla) |
|---|---|---|
| `action-binding-test` | ផ្នែក ២ | ផ្នែក ១ |
| `adaptive-link-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `animation-cost` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `app-lock-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ |
| `auth-recovery-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ |
| `barcode-shape-test` | ផ្នែក ២ | ផ្នែក ២ |
| `biometric-unlock-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `boot-animation-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `boot-runtime` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `camera-resume-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `checker-coverage` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `cleanup-clock-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `cleanup-interrupt-atomicity-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៥ |
| `clear-history-finalization-fence-test` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `clock-basis-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `clock-hygiene` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `code-duplication-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `collected-mirror-fuzz-test` | ផ្នែក ២ | ផ្នែក ១ |
| `collected-mirror-lifecycle-test` | ផ្នែក ២ | ផ្នែក ១ |
| `collected-value-fuzz-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `comments` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `compensation-order` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `concurrent-scan-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `connection-recovery-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `connection-state-fuzz-test` | ផ្នែក ២ | ផ្នែក ១ |
| `csp-enforced-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `csp-lazy-resource-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `css-classes` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `css-media-override` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `css-var-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `daily-collected-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `db-stall-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `dependency-security-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `doc-scope-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `dom-hygiene` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `duplicate-money-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `duplicate-scan-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `empty-state-truth-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/crud-rules-flow` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `emu/ledger-revert-emu-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `emu/license-seat-rules-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៥ |
| `emu/ns` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/restore-deadlock-test` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `emu/restore-mutation-emu-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៥ |
| `emu/tx-disconnect-emu-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `exit-code-integrity` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `expired-trash-retention-test` | ផ្នែក ២ | ផ្នែក ១ |
| `export-cells-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `field-shape-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `firebase-backup-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `firebase-config-paste-test` | ផ្នែក ២ | ផ្នែក ៣ |
| `fluid-type-focus-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `function-surface-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `gesture-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `google-sheets-cache-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `hang-guard` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `health-check-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `history-menu-dismiss-test` | ផ្នែក ២ | ផ្នែក ២ |
| `history-patch-retry-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `html-sink-escaping` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `inline-handler-xss-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `ios-panel-glide-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `item-money-integrity-test` | ផ្នែក ២ | ផ្នែក ១ |
| `keygen-session-security-test` | ផ្នែក ២ | ផ្នែក ២ |
| `keylist-consistency-test` | ផ្នែក ២ | ផ្នែក ១ |
| `khmer-timezone-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `late-commit-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `layout-check` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `layout-thrash` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `ledger-clamp-symmetry-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `ledger-count-integrity-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `ledger-failed-apply-revert-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `license-app-code-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៥ |
| `license-clock-rollback-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `license-clock-trust-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `license-grace-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `license-network-pressure-test` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `license-record-race-test` | ផ្នែក ២ | ផ្នែក ២ |
| `license-seat-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៥ |
| `listener-leak-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `listener-pending-key-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `locker-claim-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `lookup-burst-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-config-secret-test` | ផ្នែក ២ | ផ្នែក ១ |
| `lookup-failure-identity-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-freshness-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-prefetch-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `loop-termination-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `money-guardian-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `money-reality-check` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `money-reality-test` | ផ្នែក ២ | ផ្នែក ២ |
| `monotonic-gate-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `monthly-ledger-agreement-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `monthly-report-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `netlify-config-scope-test` | ផ្នែក ២ | ផ្នែក ២ |
| `network-pressure-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `network-timeout-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `offline-shell-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `page-nav-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `panel-motion-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `panel-snap-ownership-test` | ផ្នែក ២ | ផ្នែក ២ |
| `partial-pickup-cleanup-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `payload-schema` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `perf-check` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `periodic-network-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `phone-search-swipe-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `phone-suggest-test` | ផ្នែក ២ | ផ្នែក ១ |
| `pickup-barcode-identity-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `pickup-ledger-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pickup-repair-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ |
| `pickup-reset-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pin-prompt-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `policy-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `price-edit-abort-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `raw-read-shape-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `reconnect-ladder-test` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `redact-dump` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `registry-orphan-list` | ផ្នែក ២ | ផ្នែក ១ |
| `registry-orphan-list-test` | ផ្នែក ២ | ផ្នែក ១ |
| `registry-release-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `repository-contract-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ |
| `repository-file-coverage` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `restore-finalization-fence-test` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `restore-marker-hygiene-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `revenue-fuzz-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `revenue-rules-clamp-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ |
| `rules-duplicate-keys` | ផ្នែក ២ | ផ្នែក ៣ |
| `scan-engine-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `scan-remove-mode-test` | ផ្នែក ២ | ផ្នែក ១ |
| `sdk-offline-boot-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sdk-surface` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `secret-hygiene` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `semantic-ui-color-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `sentry-load-race-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `setup-link-browser-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `setup-link-logout-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `setup-link-roundtrip-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `shared-fns` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sheet-import-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `slow-write-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stale-clear-claim-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `stale-write` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stall-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `stall-lock-release-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `state-hygiene` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stats-collected-truth-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៥ |
| `stats-measurable-gate-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `stats-screen-agreement-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `storage-blocked-boot-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `storage-guard` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `strip-comments` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ |
| `sw-abort-propagation-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `sw-cache-failure-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-cache-key-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-install-integrity-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-revalidate-pressure-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-shell-latency-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `toast-action-truth-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `toast-truth-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `trash-modal-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `ts-comments` | ផ្នែក ១ | — |
| `tx-outcome-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ui-flow-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `user-guide-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `version-bump-scope` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `version-check` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `wiring` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `write-stall-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zoew-suite-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `zto-budget-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ |
| `zto-cookie-capture-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `zto-cookie-session-test` | ផ្នែក ២ | ផ្នែក ២ |
| `zto-cookie-store-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-cookie-sync-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-list-sync-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `zto-negative-cache-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-network-boundaries-test` | ផ្នែក ២ | ផ្នែក ២ |
| `zto-proxy-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ |
| `zto-signed-status-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៥ |
| `zto-sync-banner-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
