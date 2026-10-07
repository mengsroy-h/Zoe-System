# ការអភិវឌ្ឍ ZoeW (React + Vite)

ZoeW សរសេរលើ **React 19 + TypeScript + Vite** ដោយ **រក្សាមុខងារទាំងស្រុង**
នៃ ZoeW ដើម (vanilla JS)។ ឯកសារនេះសម្រាប់ **អ្នកអភិវឌ្ឍ** — របៀបប្រើ App
ស្ថិតក្នុង [`../README.md`](../README.md)។ ភាពដូចគ្នាមិនមែនជាការអះអាងទេ — វា **ត្រូវបាន
វាស់** ៖ វិធីសាស្ត្រក្នុង [`PARITY.md`](PARITY.md) (លេខដែលវាស់បានរស់នៅ
[`../../docs/HISTORY.md`](../../docs/HISTORY.md) — ប្រវត្តិរស់នៅ `docs/HISTORY*.md` ប៉ុណ្ណោះ)។

| វិមាត្រដែលវាស់ | វិសាលភាពភស្តុតាង |
|---|---|
| Function · ថេរ · state · សកម្មភាព · id · កូនសោ storage · អត្ថបទ · CSS | កាតាឡុក និងភាពខុសគ្នាតាមប្រភេទ; មិនមែន behavioral coverage ១០០% |
| ធាតុ DOM និង layout (ទំហំអេក្រង់ ៣) | ប្រៀបធៀបសេណារីយ៉ូក្នុង script |
| តារាង · ស្ថិតិ · លុយ · **ការសរសេរទៅ server** | fixture និង RTDB ក្លែងក្នុង parity; តេស្ត emulator នៅ `audit-tools/emu/` ដាច់ដោយឡែក |
| ជំហានអន្តរកម្ម ១៨ | ផ្លូវដែល script ចុច; មិនគ្របគ្រប់ race ឬឧបករណ៍ |
| កំហុស runtime | រកកំហុសក្នុងសេណារីយ៉ូដែលរត់; លទ្ធផលតាមជុំស្ថិតក្នុង HISTORY |

### ឯកសារ

| ឯកសារ | មាតិកា |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | ស្រទាប់ · ឃ្លាំង state · SW · ដំណើរការចាប់ផ្តើម |
| [`PARITY.md`](PARITY.md) | របៀបវាស់ parity និងហេតុអ្វីបែបនោះ |
| [`MIGRATION.md`](MIGRATION.md) | ជំហានដាក់ឲ្យប្រើ និងការថយក្រោយវិញ |
| [`TYPESCRIPT.md`](TYPESCRIPT.md) | វិន័យ type និងផ្លូវតឹងបន្តិចម្តងៗ |
| [`EXTENDING.md`](EXTENDING.md) | កន្លែងដាក់កូដថ្មី (state · component · lifecycle · platform) |
| [`ANDROID.md`](ANDROID.md) | App Android (Capacitor) |
| [`../README.md`](../README.md) | របៀបប្រើ App (កំណែ · មុខងារ · របៀបប្រើប្រាស់ · សុវត្ថិភាព · អាជ្ញាប័ណ្ណ) |

---

## ១. កំណែ

| អ្វី | តម្លៃ | ដេរីវេពី |
|---|---|---|
| កំណែ App | `APP_VERSION` | [`src/core/version.ts`](../src/core/version.ts) |
| កំណែ cache របស់ Service Worker | `CACHE_VERSION` | [`src/sw/cache-version.ts`](../src/sw/cache-version.ts) |
| Node ដែលត្រូវការ | `^22.17` · `>=24` | `package.json` (`engines`) |

⛔ `dist/manifest.json` ទទួលកំណែពី `src/core/version.ts` អំឡុង build (`vite.config.mts`) ហើយ `index.html`
គ្មានលេខកំណែជា literal។ `public/manifest.json` នៅផ្ទុក literal ➜ `audit-tools/version-check.js` ចាក់សោឲ្យស៊ី ·
`version-bump-scope.js` ចាក់សោថា កូដ ship ប្រែ ➜ ត្រូវឡើងកំណែ (`CLAUDE.md` ច្បាប់ ៦)។

---

## ២. មុខងារ

មុខងារទាំងអស់របស់ ZoeW ដើម ៖

- **បញ្ចូល និងកែកញ្ចប់** — ស្កេនដោយកាមេរ៉ា · ម៉ាស៊ីនស្កេនដៃ · រូបភាព · វាយដោយដៃ
- **លុយ COD និង DOD** — ledger ថ្ងៃ និងខែ · ច្បាប់ «លុប» ទល់នឹង «ដក» · អត្រាប្រាក់រៀល
- **ស្ថិតិយក** — តាមសំណុំ barcode (មិនមែន counter) · ចំណូលប្រចាំថ្ងៃ · របាយការណ៍ខែ
- **ទីតាំង Locker** — កំណត់ទូ · ចាត់តាំង · ផ្លាស់ទី
- **ធុងសំរាម និងការស្តារ** — ច្បាប់ ២ ម៉ោង · ៧ ថ្ងៃ · ៣០ ថ្ងៃ · ២ ថ្ងៃ
- **Lookup អតិថិជន** — ZTO · Google Apps Script · តារាងអតិថិជនក្នុងឧបករណ៍
- **ZTO** — ពិនិត្យស្ថានភាព «បិទរួច» · បិទស្វ័យប្រវត្តិ · ទាញបញ្ជីកញ្ចប់
- **នាំចូល Excel ទៅ Sheet** និង **Export** (Excel · PDF · CSV)
- **សុវត្ថិភាព** — PIN · ក្រយៅដៃ/មុខ (WebAuthn) · ចាក់សោពេលបើក App · License
- **ដំណើរការក្រៅបណ្តាញ** — PWA · Service Worker · Pull-to-refresh លើ iOS

### អ្វីដែល *ប្រសើរជាង* ដើម

| ចំណុច | ZoeW ដើម | ZoeW (React) |
|---|---|---|
| រចនាសម្ព័ន្ធកូដ | ឯកសារតែមួយ ~១៤,៨០០ បន្ទាត់ | module ជាង ៧០ ដែលមាន type |
| Type checking | គ្មាន | TypeScript លើកូដទាំងអស់ |
| បញ្ជីសំបករបស់ SW | សរសេរដោយដៃ ➜ ភ្លេចបាន | **ដេរីវេពី build ពិត** |
| ការហៅសកម្មភាព | `window[name]` | ចុះបញ្ជីដែលពិនិត្យពេល build |
| ការគេចអក្សរ HTML | វិន័យ `sanitizeInput()` | React គេចដោយស្វ័យប្រវត្តិ |
| ការធ្វើឲ្យតារាងស្រស់ | diff DOM ដោយដៃ | ការផ្គូផ្គងតាម `key` របស់ React |
| ការគូរ | `innerHTML` និង `createElement` | **React ទាំងស្រុង** (មើល `ARCHITECTURE.md` ផ្នែក ១០) |
| ភាពស្រស់នៃឯកសារ | ពឹងលើការចាំ | `npm run doc:check` ដេរីវេពីកូដ |
| Cache របស់ browser | ឈ្មោះឯកសារថេរ | ឈ្មោះមាន hash ➜ cache មិនចាស់ |

---

## ៣. របៀបប្រើប្រាស់

### ដំឡើង និងអភិវឌ្ឍ

```bash
npm ci
npm run dev              # server អភិវឌ្ឍន៍ (http://localhost:5173)
```

### Build និងពិនិត្យ

```bash
npm run build            # ពិនិត្យ type រួច build ➜ dist/
npm run verify           # type + lint + test + build + parity (រត់មុន deploy)
```

⛔ **ការវាស់ parity ត្រូវការ ZoeW ដើម** (vanilla JS) ៖ វាប្រៀបធៀបនឹង App ចាស់ដែល
កំពុងរត់ពិតៗ មិនមែននឹងការរំពឹងទុកដែលសរសេរដោយដៃ។ ទាញវាពី git ម្តង ៖

```bash
npm run original:fetch   # ➜ .original/ZoeW (មិន commit)
npm run verify
```

ឬប្រាប់ផ្លូវផ្ទាល់ ៖ `OLD_APP_DIR=/path/to/ZoeW npm run verify`។ ⛔ ការចង្អុលទៅ App
React ខ្លួនវាត្រូវ **បដិសេធ** (ការប្រៀបធៀបជាមួយខ្លួនឯងបៃតងដោយគ្មានអ្វីត្រូវវាស់)។
បើគ្មាន ZoeW ដើម ៖ `npm run typecheck && npm run lint && npm test && npm run build`
ដំណើរការដោយឯករាជ្យទាំងស្រុង។

| ពាក្យបញ្ជា | អ្វីដែលវាធ្វើ |
|---|---|
| `npm run typecheck` | ពិនិត្យ TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Vitest (រួមទាំងតេស្ត parity នៃការគូរ) |
| `npm run parity` | ប្រៀបធៀបកាតាឡុក App ថ្មីនឹង ZoeW ដើម |
| `npm run parity:dom` | ប្រៀបធៀប DOM និង layout ពិតក្នុង browser |
| `npm run parity:live` | ប្រៀបធៀប **ជាមួយទិន្នន័យពិត** (RTDB ក្លែងក្លាយ) រួមទាំងការសរសេរទៅ server |
| `npm run parity:deep` | ប្រៀបធៀប **ផ្លូវលុយក្នុងសេណារីយ៉ូតេស្ត** · ចាកចេញ/ចូលវិញ · ZTO · Google Sheet · PDF — ៦ ជាន់រាល់ជំហាន (អេក្រង់ · ការសរសេរពេញ · DB ទាំងមូល · ប្រអប់ native · សំណើទៅ Apps Script/ZTO · សារ toast) |
| `npm run parity:all` | រត់ការវាស់ parity ទាំង ៤ បូក `rules:check` |
| `npm run build:parity` | build ផលិតកម្មចូល `dist-parity/` ឯកជន ៖ `run-all.sh` រត់ `parity:dom` · `parity:live` · `parity:deep` លើវា (ការងារ `zoew-parity`) ដោយមិនប្រណាំង `dist/` ជាមួយ `zoew-suite` (`ZOEW_PARITY_DIST`) |

⛔ **ការខុសគ្នាពី ZoeW ដើមដោយចេតនា** (ផ្ទាំង 🔔 · logo SVG · navbar ទាបជាង ១៤px លើទូរស័ព្ទ · token `op`
ក្នុង ledger) រស់ក្នុង **បញ្ជីតែមួយ** `INTENTIONAL_UI` (`scripts/snapshot.mjs`) ដែល parity ទាំង ៣ ប្រើរួម — ⛔ បន្ថែមធាតុ **តែ** ពេល
ផ្ទៃពិតជាប្តូរដោយចេតនា ហើយសរសេរកំណែជាប់ · កុំប្រើវាដើម្បីបិទការខុសគ្នាដែលមិនយល់។
| `npm run rules:check` | វាស់ច្បាប់ **លុប/ដក** និងការសម្អាត **២ ម៉ោង · ៧ ថ្ងៃ · ២ ថ្ងៃ · ៣០ ថ្ងៃ** ដោយទិន្នន័យសងខាងព្រំដែន (±១ នាទី) លើ ZoeW ដើម · React web · React Android រួចប្រៀបធៀប DB |
| `npm run slot:check` | ផ្ទៀងផ្ទាត់ថាកូដ imperative **មិនប៉ះកូន** របស់ធាតុដែល React ជាម្ចាស់ (បើប៉ះ ➜ App ស) |
| `npm run purity:check` | **React ១០០%** ៖ កូដមុខងារ (`core` · `domain` · `features` · `services` · `ui` · `platform`) ប៉ះ DOM **០** កន្លែង · ស្រទាប់ React (`src/app/**`) សរសេរ DOM **០** ក្រៅច្រកចេញ (`refs.ts` · `DocumentEffects` · ពិដានតឹង) · component មិនស្វែងរក DOM តាម id · ឈ្មោះ ref គ្រប់ឈ្មោះមាន `ref={…}` ពិតចង (មើល [`ARCHITECTURE.md`](ARCHITECTURE.md) ផ្នែក ១១) |
| `npm run smoke` | បើក App ដែល build រួច ហើយរកកំហុស runtime · ⛔ build ផលិតកម្មគ្មាន bridge វាស់ (`expose-globals` · `__auditRebind`) · syntax ក្នុង build ស្ថិតក្នុង `build.target` · design token CSS (`--x: value`) ទៅដល់ build ដូចដែលសរសេរ (minifier CSS មិនសរសេរតម្លៃឡើងវិញ) |
| `npm run money:core` | ស្រង់កូដលុយពិតចូល `audit-tools/money-core.js` សម្រាប់ `check-money.cmd` (អ្នកយាមភាពស្រស់ធ្លាក់ពេលកូដលុយប្រែ) |
| `npm run sw:check` | ផ្ទៀងផ្ទាត់ថា Service Worker cache សំបកពេញលេញ |
| `npm run original:fetch` | ទាញ ZoeW ដើម (vanilla JS) ពី git ចូល `.original/ZoeW` — អ្នកសម្រេចនៃការវាស់ parity |
| `npm run logic:check` | ដេរីវេ function ពីប្រភព រួចប្រៀបធៀបជាមួយដើម **តាម token** · តំបន់ហាមចូលត្រូវដូចដើម |
| `npm run doc:check` | ផ្ទៀងផ្ទាត់ថាការអះអាងក្នុងឯកសារស៊ីនឹងកូដ (បញ្ជី slot · កំណែ · ពាក្យបញ្ជា) |
| `npm run audit:build` | build វាស់ (`dist-audit/ZoeW`) សម្រាប់ `audit-tools/` — ⛔ `bash audit-tools/run-all.sh` (ពី root) build វាដោយខ្លួនឯង ហើយរត់ checker ទាំងអស់ |
| `npm run build:only` | build ដោយរំលងការពិនិត្យ type (ប្រើក្នុង `verify` ដែលពិនិត្យរួច) |
| `npm run notice:check` | build ជាមួយ sourcemap ចូលថតបណ្តោះអាសន្ន ➜ រាល់កញ្ចប់ npm ដែលចូល `dist/assets` និងឯកសារ vendor (`xlsx` · `zxing-wasm`) ត្រូវមាន `ឈ្មោះ@កំណែ` ដែល ship ពិតក្នុង `NOTICE` (root) |
| `npm run preview` | បម្រើ `dist/` ក្នុងស្រុកដើម្បីសាកមើល |
| `npm run test:watch` | Vitest ក្នុងរបៀបតាមដាន |
| `npm run build:android` | build សម្រាប់ App Android (`--mode android` ➜ អាន `.env.android`) |
| `npm run android:sync` | build Android រួចចម្លងចូល `android/` (`cap sync android`) |
| `npm run android:open` | បើក `android/` ក្នុង Android Studio |
| `npm run android:icons` | បង្កើត logo និង splash របស់ Android ពី `resources/icon.svg` |
| `npm run android:check` | ចាក់សោលេខកំណែ APK · appId · សិទ្ធិ · logo · plugin · web មិនផ្ទុកកូដ native · config Gradle/AGP/SDK ស្ថិតក្នុងខ្សែ template របស់ Capacitor ដែលដំឡើង · workflow release APK ↔ keystore |
| `npm run native:check` | សាក App ជាមួយ bridge Capacitor ក្លែងក្នុង Chromium (Back · ប្រវត្តិ · pause/resume · Export/Share/Print · ជីវមាត្រ · PTR) និងតារាងប្រវត្តិវែង (APK បង្ហាញជួរជុំវិញទីតាំងរមូរ · PWA បន្ថែមជួរ · ជួរកម្ពស់ខុសគ្នា · modal · sync · ប្តូរតម្រង) |

### Deploy ទៅ Netlify

1. **Base directory** ៖ **`ZoeW`** — ⛔ **ប្រកាន់អក្សរតូចធំ** (Linux)
2. **Build command** ៖ `npm run build`
3. **Publish directory** ៖ `dist`
4. **Functions directory** ៖ `netlify/functions`

`netlify.toml` ក្នុងថតនេះផ្ទុក header · CSP · redirect រួចរាល់ហើយ។
⛔ **កុំដាក់ `netlify.toml` នៅ root របស់ repo** — Netlify អានវាសម្រាប់ site
ទាំងអស់ ➜ វាបង្វែរ build របស់ App ផ្សេង។

### `src/` ជាប្រភពការពិត

កូដក្នុង `src/**` ជា **ប្រភពការពិតតែមួយ** ហើយកែដោយដៃ (ឈ្មោះ function និងកូនសោ storage ដដែលនឹង
ZoeW vanilla ➜ `logic:check` · `parity` ប្រៀបធៀបបាន)។ ឧបករណ៍ codemod ដែលធ្លាប់ផលិតវាពី `app.js` ដើម
ត្រូវលុបរួច (វាសរសេរជាន់ `src/` ទាំងមូល — អន្ទាក់)។ បញ្ជី slot ដែល `doc:check` · `slot:check` អាន
រស់នៅ `scripts/slot-registry.cjs` (ផ្ទៀងផ្ទាត់ទល់នឹង `REACT_OWNED_IDS` និង component ពិត)។

### App Android (Capacitor)

មើល [`ANDROID.md`](ANDROID.md) ៖ build APK · លេខកំណែ · logo · ការកំណត់ ·
ការសាកលើទូរស័ព្ទពិត។ របៀបបន្ថែមមុខងារ (state · lifecycle · platform) ៖
[`EXTENDING.md`](EXTENDING.md)។

---

## ៤. ប្រព័ន្ធសុវត្ថិភាព

- **CSP គ្មាន `'unsafe-inline'` ក្នុង `script-src`** — build មិនបញ្ចេញ
  inline script សោះ (`modulePreload.polyfill` បិទ) ហើយ handler ទាំងអស់
  ជា handler របស់ React មិនមែន attribute `on*=` ។
- **សកម្មភាពមានព្រំដែន** — មានតែឈ្មោះក្នុងចុះបញ្ជីទេដែលហៅបាន; ចុះបញ្ជី
  កើតពី `ACTION_ALLOWLIST` ពិត ហើយបាត់ឈ្មោះណាមួយ ➜ build ធ្លាក់។
- **ការគេចអក្សរ** — React គេចអត្ថបទទាំងអស់ដោយស្វ័យប្រវត្តិ។
- **secret** — `redactDeep()` លាក់វាមុនផ្ញើទៅ Sentry; PIN ដេរីវេជាកូនសោ AES
  ហើយកូនសោរស់ក្នុង IndexedDB ដោយ `extractable: false` ។
- **License** — ផ្ទៀងផ្ទាត់ដោយ ECDSA បូកពិដានឧបករណ៍ក្នុងមួយ Key ខាង server ។
- **ធនធានទាំងអស់ដើរពី origin ដដែល** — engine ស្កេន និង SheetJS ក្នុង repo
  (គ្មាន CDN) ➜ ការស្កេនដើរពេលក្រៅបណ្តាញ។

---

## ៥. អាជ្ញាប័ណ្ណ

កម្មសិទ្ធិឯកជន។ រក្សាសិទ្ធិគ្រប់យ៉ាង។
