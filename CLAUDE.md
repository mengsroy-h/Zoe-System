# Zoe-System

> ## ⚡ START HERE — អានផ្នែកនេះមុនគេ
>
> ឯកសារនេះត្រូវបានសរសេរឲ្យ **session Claude ថ្មីទាំងស្រុង** អាចបន្តការងារបាន ដោយមិនចាំបាច់មាន
> ប្រវត្តិការសន្ទនាមុន។ អានប្លុកនេះ + section **«របៀបធ្វើ audit លើគម្រោងនេះ»** ខាងក្រោមភ្លាម
> ជាការគ្រប់គ្រាន់ដើម្បីចាប់ផ្តើម។
>
> ### ប្រព័ន្ធនេះជាអ្វី
> **PWA ចំនួន ២** (vanilla JS, គ្មាន framework, គ្មាន build step) — deploy ជា Netlify site ដាច់ដោយឡែក៖
>
> | App | តួនាទី | Sentry tag |
> |---|---|---|
> | **ZoeW** | App អាជីវកម្មតែមួយ — បញ្ចូល/កែកញ្ចប់, COD/DOD, កំណត់ទីតាំង Locker, ស្ថិតិ, Export | `zoew` |
> | **ZoeKeyGen** | ឧបករណ៍អ្នកលក់ — បង្កើត/Revoke/Extend Activation Key និង Setup Link/QR។ ប្រើ **Firebase Project ដាច់ដោយឡែក** | `zoekeygen` |
>
> **គ្មានតួនាទី `admin`/`worker`/`scanner` ក្នុង App អាជីវកម្មទេ** — អ្នកប្រើដែលចូលប្រព័ន្ធបាន
> (`auth != null`) មានសិទ្ធិដូចគ្នា។ ZoeKeyGen **នៅតែ** ប្រើតួនាទី `admin` ក្នុង License Project
> ដាច់ដោយឡែករបស់វា — កុំយកទៅច្រឡំគ្នា។
>
> ### ច្បាប់ដែលមិនអាចរំលងបាន
> ១. **ប្រព័ន្ធនេះកំពុងដំណើរការជាមួយអតិថិជនពិត និងលុយពិត (COD/DOD)។** កុំ merge ចូល `main`
>    ដោយគ្មានការស្នើច្បាស់លាស់ពីអ្នកប្រើ។
> ២. **«លុប» (Delete) ទល់នឹង «ដក» (Remove) ជាគោលការណ៍អាជីវកម្ម មិនមែនកំហុសទេ** — អានផ្នែក
>    «Core business rule» ខាងក្រោមឲ្យចប់ មុននឹងប៉ះកូដណាមួយដែលទាក់ទងចំណូល។
> ៣. **កូដ `app.js` ត្រូវតែគ្មាន comment** (ទម្លាប់គម្រោង)។ `qrcode.js` ជា library ខាងក្រៅ — លើកលែង។
> ៤. **`license-verify.js` និង `error-reporting.js` ត្រូវតែ byte-identical ទាំង ២ App។**
>    ប្រើ `cp` + `md5sum` កុំកែម្តងមួយ App។
> ៥. **កុំសរសេរការអះអាងអំពី git/branch/merge ដោយមិនផ្ទៀងផ្ទាត់** — ប្រើ
>    `git rev-list --count origin/main..origin/<branch>`។ **ឯកសារនេះមិនមែនជាភស្តុតាងទេ — git ទើបជាភស្តុតាង។**
> ៦. **កំណែ App (`APP_VERSION`) ត្រូវដូចគ្នាទាំង ២ និងត្រូវនឹង `manifest.json`។** វា **មិនមែន**
>    ជា `CACHE_VERSION` ទេ — `CACHE_VERSION` ជាកូនសោ Cache (`<app>-vN`) ដែល bump រាល់ការប្តូរ
>    ឯកសារ ចំណែក `APP_VERSION` ជាកំណែផលិតផលតាម semver ដែលបង្ហាញ **តែក្នុងប្រអប់ login**។
>    ក្រោយកែកំណែ រត់ `node audit-tools/version-check.js`។
> ៧. **រាល់ការសរសេរត្រូវជាភាសាខ្មែរ** — ចម្លើយក្នុងការសន្ទនា, សារ commit, ចំណងជើង និងខ្លឹមសារ PR,
>    ឯកសារ README និង CLAUDE.md ព្រមទាំងអត្ថបទដែលបង្ហាញដល់អ្នកប្រើក្នុង App។
>    **កូដ (ឈ្មោះអថេរ/function) នៅជាភាសាអង់គ្លេសដដែល** តាមទម្លាប់គម្រោង។
> ៨. **រាល់ជុំ audit ត្រូវឡើងកំណែ `APP_VERSION`** — ឡើង PATCH សម្រាប់ជុំកែកំហុស។
> ៩. **រាល់ជុំ audit ត្រូវធ្វើបច្ចុប្បន្នភាព `README.md` ដែលពាក់ព័ន្ធក្នុង commit ដដែល** —
>    root, `ZoeW/`, `ZoeKeyGen/` និង `audit-tools/`។ យ៉ាងតិចត្រូវ៖ លេខកំណែ,
>    ឧបករណ៍ audit ថ្មី (បន្ថែមជួរក្នុងតារាង `audit-tools/README.md`), និងឥរិយាបថ
>    ថ្មីដែលអ្នកប្រើ ឬអ្នកថែទាំមើលឃើញ។ **README ដែលចាស់ គឺជាឯកសារខុស** —
>    វាធ្លាប់សរសេរថាកំណែជា `2.0.0`/`1.0.4` ខណៈកូដពិតជា `2.4.0`។
> ១០. **រាល់ការឡើងកំណែត្រូវបន្ថែមផ្នែកថ្មីក្នុង `CHANGELOG.md` ក្នុង commit ដដែល** —
>    សរសេរជាភាសាខ្មែរ ដោយប្រាប់ថា *អ្នកប្រើឃើញអ្វីខុសពីមុន* មិនមែនត្រឹមតែឈ្មោះ
>    function ដែលកែទេ ហើយត្រូវបញ្ជាក់ **«សកម្មភាពដែលត្រូវធ្វើដោយដៃ»** ជានិច្ច
>    (ជាធម្មតា Firebase rules — ឬ «គ្មាន»)។ មើលទម្រង់នៅក្បាល `CHANGELOG.md`។
>
> ### Firebase rules — **មិន deploy ស្វ័យប្រវត្តិទេ**
> Rules JSON ក្នុង repo នេះ **មិន deploy ស្វ័យប្រវត្តិទេ** — Netlify បម្រើតែឯកសារ static;
> ត្រូវ paste ចូល Firebase Console ➜ Publish ដោយដៃ។ ដូច្នេះ **រាល់ពេលបន្ថែម path ថ្មីក្នុង
> Firebase ត្រូវបន្ថែម rule ក្នុង commit ដដែល ហើយប្រាប់អ្នកប្រើថាត្រូវ publish ដោយដៃ។**
> មាន rules ២ ឯកសារ៖ `firebase-database.rules.json` (Business) និង
> `ZoeKeyGen/firebase-database.rules.json` (License)។
>
> ### អ្វីដែលទទួលយកដោយចេតនា — កុំរាយការណ៍ជាកំហុសថ្មី
> - **អ្នកប្រើអាចសរសេរតួលេខ revenue/pickup ដោយផ្ទាល់** — គ្មាន rule ណាអាចផ្ទៀងផ្ទាត់ប្រវត្តិ
>   នៃ delta បានទេ ដោយគ្មាន backend ដែលទុកចិត្តបាន (Cloud Functions)។ គម្រោងនេះគ្មាន backend។
> - **គ្មានការផ្ទៀងផ្ទាត់ aggregate** ដោយហេតុផលដដែល។
> - **ZoeKeyGen «Extend» ផ្លាស់តែពិដានខាង server** មិនមែន `exp` ដែល sign រួច — ដូច្នេះ Key
>   ដែលបន្ថែមសុពលភាព **activate លើឧបករណ៍ថ្មីមិនបាន** ក្រោយថ្ងៃ sign ដើម។ ប្រអប់ប្រាប់រួចហើយ។
> - **ការលុប site data reset ការអនុគ្រោះ ៣ ថ្ងៃបាន** — គ្មានផ្លូវការពារខាង client។
> - **តំបន់ម៉ោងរបស់ឧបករណ៍កំណត់ថាចំណូលធ្លាក់ចូលថ្ងៃណា** (`getFormattedDate()` ប្រើប្រតិទិន
>   តាមតំបន់ម៉ោងឧបករណ៍)។ បង្អួច 2h/8d/10d **មិនរងផលទេ** (គណនាតាម epoch)។
>   ដំណោះស្រាយជាក់ស្តែង៖ បើកមុខងារ «កាលបរិច្ឆេទ និងម៉ោងស្វ័យប្រវត្តិ» លើគ្រប់ឧបករណ៍។
> - **`google-sheets-api/Code.gs` ជា template** — ការកែក្នុង repo មិនប្តូរ script ដែល deploy រួច។

## `--chrome-bottom` និង safe-area — READ BEFORE TOUCHING LAYOUT

`.app-pages` កក់កន្លែងរបា Tab ជា `padding-bottom`។ `--chrome-bottom` ត្រូវរួមបញ្ចូល
កម្ពស់របា និងផ្នែក safe-area ដែលធ្វើឲ្យ iOS standalone body វែងជាង viewport៖

```js
tabbar.offsetHeight + Math.max(0, document.body.getBoundingClientRect().height - window.innerHeight)
```

**កុំវាស់ជា `tabbar.offsetHeight` តែឯង** ព្រោះវាខ្វះ bottom inset លើ iPhone។ ក៏កុំ
ប្រើ `body.getBoundingClientRect().bottom` ឬ transformed tabbar rect ដែរ៖ root scroll
restoration និងការលាក់របាដោយ transform អាចធ្វើឲ្យលេខទាំងនេះរួញ។ `offsetHeight` របស់
tabbar + `height` របស់ body គឺមិនប្រែតាម root scroll/transform។

មានតែ `html.ios-standalone` ប៉ុណ្ណោះដែលពង្រីក body តាម bottom inset និងចាក់សោ root។
**កុំដក iOS rule នេះចេញ** — body ខ្លីជាងអេក្រង់អាចបន្សល់ចន្លោះទទេក្រោមរបា Tab។
ក៏កុំដាក់ generic `@media (display-mode: standalone)` មកវិញ ព្រោះវាអាចបង្កើត root
scroll range លើ Android; Android ទទួល safe area តាម content/tabbar padding រួចហើយ។

**បរិស្ថាន audit នៅទីនេះជា Chromium — `env(safe-area-*)` ត្រឡប់ 0 ជានិច្ច។**
តេស្តត្រូវ **ធ្វើត្រាប់តាម** ដោយធ្វើឲ្យ body វែងជាង viewport
(`min-height: calc(100dvh + 34px)`) រួចហៅ `measureAppChromeSize()` ឡើងវិញ។
ការកែណាដែលប៉ះផ្នែកនេះ **ត្រូវសាកលើ deploy preview និង iPhone ពិតមុន merge**។

## ធនធានខាងក្រៅ និង service worker — READ BEFORE ADDING ANY CDN

**engine ស្កេនស្ថិតក្នុង repo — កុំនាំវាទៅ CDN។** មុននេះ ZXing មកពី unpkg.com
ហើយ `sw.js` បោះបង់រាល់សំណើឆ្លង origin ➜ វា **មិនដែលចូល cache ទេ** ➜ ពេលបណ្តាញ
ខ្សោយ **ការស្កេនកាមេរ៉ាមិនដើរសោះ** ខណៈ App មើលទៅដូចដំណើរការធម្មតា។

**កំណែ 2.10.0 ប្តូរ engine ទៅ ZXing C++ ដែលចងក្រងជា WebAssembly** (`zxing-wasm`
3.1.3)។ ឯកសារមាន **២** ហើយ **ទាំង ២ ត្រូវនៅក្នុង `APP_SHELL`**៖
`ZoeW/vendor/zxing-wasm.js` (glue) និង `ZoeW/vendor/zxing_reader.wasm` (binary)។
បាត់មួយណា ➜ ការស្កេនស្លាប់ពេលបណ្តាញដាច់ ខណៈ App នៅបើកបានធម្មតា។

**ហេតុអ្វី៖** Safari គ្មាន `BarcodeDetector` ➜ iPhone ធ្លាក់ទៅ engine JavaScript។
ការវាស់លើ input ដដែល៖ ផ្លូវ **រកមិនឃើញ** (ស៊ុមភាគច្រើនពេលតម្រង់កាមេរ៉ា)
**១៣.៩ ms ➜ ១.៦–២.២ ms**។ ការឌិកូដលែងជាថ្លៃលេចធ្លោទៀតទេ — `getImageData()`
ទើបជាថ្លៃដែលនៅសល់។

> ⚠️ **CSP ត្រូវមាន `'wasm-unsafe-eval'` ក្នុង `script-src`។** បើគ្មាន browser
> **បដិសេធការចងក្រង WebAssembly** ➜ ការស្កេនស្លាប់ទាំងស្រុងលើផលិតកម្ម ខណៈ
> តេស្តក្នុង repo (ដែលរត់គ្មាន CSP) ជោគជ័យទាំងអស់។ ថ្នាក់កំហុសនេះត្រូវបាន
> ចាប់បានពិតក្នុងជុំ 2.10.0។ `netlify.toml` ក៏ត្រូវបម្រើ `.wasm` ជា
> `application/wasm` ដែរ បើអត់ browser ធ្លាក់ទៅផ្លូវ instantiate យឺត។
> `scan-engine-test.js` ចាក់សោទាំង ២ ចំណុច។

**ដើម្បីឡើងកំណែ**៖ `npm i zxing-wasm@<new>` រួច
`cp node_modules/zxing-wasm/dist/iife/reader/index.js ZoeW/vendor/zxing-wasm.js`
និង `cp node_modules/zxing-wasm/dist/reader/zxing_reader.wasm ZoeW/vendor/`
រួចរត់ `scan-engine-test.js` និង `offline-shell-test.js` ឡើងវិញ។
`offline-shell-test.js` ផ្ទៀងផ្ទាត់ថា binary ត្រូវនឹង sha256 ដែល glue រំពឹងទុក
ដូច្នេះការចម្លងតែឯកសារមួយនឹងធ្លាក់ភ្លាម។

**ឈ្មោះ format ប្តូរ**៖ `SCAN_FORMAT_NAMES = ['Code128']` (មិនមែន `'CODE_128'` ទេ)
ព្រោះ zxing-wasm ប្រើឈ្មោះរបស់ ZXing C++។ ការស្កេន QR ប្រើ
`CONFIG_QR_FORMAT_NAMES = ['QRCode']` ដាច់ដោយឡែកដដែល។

**ការឌិកូដឥឡូវជា `Promise`។** ផ្លូវ live មាន guard `liveDecodeBusy` ដើម្បីកុំឲ្យ
ការឌិកូដជាន់គ្នា; `takeFreshVideoFrame()` និង `confirmLiveScan()` (២ ស៊ុមជាប់គ្នា)
នៅដំណើរការដដែល។ **កុំប្រើ `.then(A).catch(B)`** — ប្រើទម្រង់ ២ អាគុយម៉ង់
(`.then(ok, fail)`) តាមច្បាប់គម្រោង។

**`sw.js` ត្រូវបោះបង់រាល់សំណើឆ្លង origin — កុំប្តូរច្បាប់នេះ។**
```js
if (url.origin !== self.location.origin) return;
```
កំណែ **2.6.0 បានប្តូរវា** ដើម្បី cache Firebase SDK, ពុម្ពអក្សរ និង Sentry
តាមបញ្ជី host ➜ **App ខូចលើផលិតកម្មភ្លាម**៖ អ្នកប្រើឃើញ «ក្រៅបណ្តាញ» និងគ្មាន
ទិន្នន័យ ខណៈបណ្តាញដើរធម្មតា (Firebase SDK និង Sentry ផ្ទុកមិនចូល)។ វាត្រូវថយក្រោយ
ក្នុង **2.6.1**។ `offline-shell-test.js` ចាក់សោច្បាប់នេះទុក។

**មេរៀនសំខាន់៖ តេស្តជាមួយ CDN ក្លែងក្លាយ ជោគជ័យក្លែងក្លាយ។** បរិស្ថាន audit
នៅទីនេះឆ្លងកាត់ proxy (`gstatic` ឆ្លើយ 403) ដូច្នេះវា **មិនអាចបង្កើតឥរិយាបថ CDN
ពិតឡើងវិញបានទេ** — header, redirect, `Vary`, CORS។ ការកែណាមួយដែលប៉ះការទាញធនធាន
**ឆ្លង origin** មិនត្រូវ ship ដោយផ្អែកលើតេស្តក្នុង repo តែម្យ៉ាងឡើយ។ ការកែបែបនោះ
ត្រូវសាកលើ **deploy preview ពិត និងឧបករណ៍ពិត** ជាមុនសិន។

## ស្ថាបត្យកម្ម

- `ZoeW/app.js` ជាឯកសារកូដតែមួយ (~6300 បន្ទាត់) សរសេរជា top-level script ដែល indent ៤ ចន្លោះ
  **តែមិន wrap ក្នុង IIFE ទេ** — គ្រប់ function ជា global។ អថេរ `let`/`const` កម្រិត module
  **មិនស្ថិតលើ `window`** (មានតែ `function` declaration ទេ) — សំខាន់ពេលសរសេរតេស្ត browser។
- `zoew_scan_history_cod_dod` ជាប្រភពទិន្នន័យសំខាន់ **តែមួយ**។ App អានវាដោយផ្ទាល់តាម
  `onValue(dbRefHistory)` ➜ `scanHistory` (array នៃ item ដែលមាន `.id`)។
  **គ្មាន projection ជាន់ទីពីរទេ** — ដូច្នេះលែងមានថ្នាក់កំហុស «lookup និងប្រវត្តិបែកគ្នា»។
- រាល់ការកែកញ្ចប់ធ្វើឡើងដោយ `runTransaction` លើ record របស់ **server** មិនមែនលើច្បាប់ចម្លង
  ក្នុងសតិទេ — មើល section «ថ្នាក់កំហុសដែលបានដោះស្រាយរួច» ខាងក្រោម។

### រចនាសម្ព័ន្ធ UI (ZoeW)

| ផ្នែក | id សំខាន់ | មាតិកា |
|---|---|---|
| ទំព័រ ១ — ទិន្នន័យ | `pageData` | គ្រប់គ្រងប្រចាំថ្ងៃ, ស្វែងរកលេខ, តារាងប្រវត្តិ |
| ទំព័រ ២ — បញ្ចូលទិន្នន័យ | `pageEntry` | របៀបស្កេន ២, កាមេរ៉ា, hardware scanner, រូបភាព, `parcelPanel` (បញ្ជីថ្ងៃនេះ), `lockerPanel` |
| របា Tab ខាងក្រោម | `pageTabBar` | ប្តូរទំព័រ (`switchAppPage`) |
| របា Slide (ម៉ឺនុយ) | `sideDrawer` | Config/Reconfig, API ស្វែងរកអតិថិជន, តារាងអតិថិជន, កំណត់ទូ Locker, ចូល/ចាកចេញ (`navAuthBtn`) |
| ប៊ូតុង (...) | `globalMoreMenu` | Export, កែទឹកប្រាក់/កញ្ចប់ (PIN), អត្រាប្រាក់, លុបទាំងអស់ (PIN) |

**`entryScanMode`** (`'parcel'` ឬ `'locker'`) កំណត់ថា `triggerScanAction()` នាំ barcode ទៅណា។
វាជាចំណុចបំបែកតែមួយ — គ្រប់ប្រភពស្កេន (កាមេរ៉ា, hardware, រូបភាព) ឆ្លងកាត់ `triggerScanAction()`។

**`history-expanded` តាមទំព័រដែលកំពុងសកម្ម។** `syncHistoryExpandedLock()` ដាក់ class
នោះលើ `#appPages` តែពេល `.page-side` **របស់ទំព័រសកម្ម** មាន `.collapsed` —
`activePanelSections()` ជាអ្នករកឲ្យ (អានពី DOM មិនមែនពី `currentAppPage` ទេ ដើម្បី
កុំឲ្យវាឃ្លាតពីអ្វីដែលបង្ហាញពិត) ហើយ `switchAppPage()` ត្រូវហៅវារាល់ដង។
បើសោនោះជាប់ឆ្លងទំព័រ នោះទំព័រម្ខាង **រមូរមិនកើតទាល់តែសោះ**។ ហេតុផល៖ class នោះកំណត់ `overflow-y: hidden`
លើ `#appPages` (ព្រោះការរមូរផ្ទេរទៅតារាងខាងក្នុងវិញ) — បើវាជាប់ទៅទំព័រ «បញ្ចូលទិន្នន័យ»
ដែលគ្មានតារាងខាងក្នុងទទួល នោះទំព័រនោះ **រមូរមិនកើតទាល់តែសោះ**។ Test៖ `page-nav-test.js`។

**Layout៖ ទំព័រនីមួយៗមាន `.page-side` និង `.page-main`។** លើទូរស័ព្ទវាជា flex column ដាក់ជង់គ្នា;
លើអេក្រង់ **≥992px** វាក្លាយជា grid ២ ជួរ (`380px` + សល់) ពេញកម្ពស់អេក្រង់ ហើយរបា Tab
ផ្លាស់ពីក្រោមទៅជាបន្ទាត់នៅក្រោម navbar តាម `order`។ `layout-check.js` ត្រួតពិនិត្យទាំង
320/360/412/768px និង **1280/1440px**។

**របា Slide បិទត្រូវមាន `visibility: hidden`** — បើមិនដូច្នេះ `layout-check.js` រាយវាថាលើសអេក្រង់
(វា `translateX(-100%)`) ហើយវាក៏អាច tab ចូលបានទៀតផង។

**កាយវិការអូស លើទូរស័ព្ទ (<992px) — `setupSwipeGestures()` ➜ `bindPanelSwipe()` ×២។**
**ទំព័រទាំង ២ មានឥរិយាបថដូចគ្នា** — កុំកែតែទំព័រមួយ៖

| ទំព័រ | `.page-side` | `.page-main` | ដងអូស | កន្សោមរមូរ |
|---|---|---|---|---|
| ទិន្នន័យ | `#dataSideSection` | `#dataMainSection` | `#dragHandle` | `#tableResponsive` |
| បញ្ចូលទិន្នន័យ | `#entrySideSection` | `#entryMainSection` | `#entryDragHandle` | `#entryTableResponsive` ឬ `#lockerTableResponsive` |

ទំព័រ ២ មានកន្សោមរមូរ **២** — `entryScrollerInView()` ជ្រើសយកតាមផ្ទាំងដែលកំពុង
បង្ហាញ (`#lockerPanel.hidden` ជាអ្នកបែងចែក)។ កាតបញ្ជីទាំងនោះត្រូវមាន class
**`.panel-section`** (ដូច `.history-section`) បើមិនដូច្នេះ `.table-responsive`
ខាងក្នុង **flex មិនកើត** ➜ បញ្ជីមិនពេញអេក្រង់។

**ការប្តូរ `.collapsed`/`.search-focus` និងសោ `history-expanded` សុទ្ធតែអនុវត្តពេល
`touchend` មិនមែនចំពេលអូសទេ។** iOS រក្សា scroll owner រហូតដល់ម្រាមដៃលើក;
បើ class ណាមួយប្តូរកណ្តាលកាយវិការ នោះ scroll owner និងកម្ពស់កន្សោមរមូរប្តូរភ្លាម ➜
**ការរមូរត្រូវកាត់ផ្តាច់ និង offset អាចជាប់ក្រោម navbar**។ ដូច្នេះ `touchmove` គ្រាន់តែ
queue ចេតនា ហើយ `touchend` ទើបអនុវត្តទាំង layout និងសោ។ `touchcancel` ត្រូវបោះបង់
ចេតនាទាំងមូល។ ពេលចូល `history-expanded`, `syncHistoryExpandedLock()` ត្រូវលុប
`#appPages.scrollTop` ចាស់មុន/ក្រោយប្តូរ class និងម្តងទៀតក្នុង `requestAnimationFrame`។

ចំណុចរួមទាំង ២ ទំព័រ៖

- អូស/scroll **ឡើង** លើ `#dataMainSection` ➜ `#dataSideSection` ទទួល `.collapsed` ➜ ប្រវត្តិហូតឡើងពេញអេក្រង់
- អូស **ចុះ** ពេលតារាងនៅកំពូល ➜ ដក `.collapsed` ➜ ផ្ទាំងខាងលើត្រឡប់មកវិញ
- ចុច `#dragHandle` ➜ toggle ដោយចេតនាច្បាស់លាស់ (ដំណើរការទោះកំពុងស្វែងរក)
- **កុំដាក់ `transition` លើ `.collapsed`/`.search-focus` វិញ** (កំណែ 2.9.0 បន្ថែម
  ចលនាតាមផ្លូវ **ផ្សេង** — មើលផ្នែក «ចលនាតាមម្រាមដៃ» ខាងក្រោម)។
  `max-height` **មិនអាចធ្វើចលនាបានទេ** ពេលតម្លៃដើមជា `none` (វាលោតទៅ 0 ភ្លាម) ដូច្នេះ
  `transition` ដែលធ្លាប់មាន សល់តែ `opacity` ដែលដេញលើប្រអប់កម្ពស់ 0 ដែលមើលមិនឃើញផង
  ➜ ការគូរឡើងវិញ ០.៣ វិនាទីដោយឥតប្រយោជន៍ ចំពេលអ្នកប្រើកំពុងរមូរ (អ្នកប្រើរាយការណ៍
  «scroll ទាក់អំឡុងពេលប្រអប់ប្រវត្តិហូតឡើង»)។ ផ្ទាំងដែលបង្រួមក៏ត្រូវមាន
  `visibility: hidden` ដែរ ➜ លែង tab ចូលបាន និងលែងត្រូវ hit-test
- **ការអូសឡើង មិនត្រូវបិទផ្ទាំង ពេលអ្នកប្រើកំពុងស្វែងរកលេខទូរស័ព្ទទេ** (`phoneSearchIsActive()`)
  — បើមិនដូច្នេះ អ្វីដែលគេកំពុងវាយបាត់ពីអេក្រង់

**ចលនាតាមម្រាមដៃ (កំណែ 2.9.0) — READ BEFORE TOUCHING PANEL LAYOUT។**
> ✅ **ផ្ទៀងផ្ទាត់លើ iPhone PWA ពិតរួចហើយ** (2026-08-24, កំណែ 2.9.0)។ អ្នកប្រើបញ្ជាក់ថា
> ការទាញផ្ទាំង, snap, PTR និងការលាក់របា Tab ដំណើរការត្រឹមត្រូវលើឧបករណ៍ពិត។
> ដូច្នេះ **កុំ «កែ» ផ្នែកនេះដោយផ្អែកលើការសង្ស័យ** — វាមិនមែនជាកូដដែលមិនទាន់សាកទេ។
> បើចាំបាច់ត្រូវប៉ះ សូមអាន «របៀបស្តារវិញ» ខាងក្រោមផ្នែកនេះ។

លក្ខខណ្ឌស្នូល៖ **កាតបញ្ជី (`.page-main`) ត្រូវខ្ពស់ដូចគ្នាបេះបិទទាំងរបៀបធម្មតា
និងរបៀបពេញអេក្រង់** — `height: calc(100dvh - --chrome-top - --chrome-bottom - 16px)`
បូក `flex: none` ក្នុង `@media (max-width: 991px)`។ ផលពីរ៖

១. ការរំកិលផ្ទាំង **ចុះចំកន្លែងបេះបិទ** ➜ ការប្តូរ class មិនលោត។ មុន 2.9.0 កាតខ្ពស់
   588px ធម្មតា ទល់នឹង 642px ពេញអេក្រង់ ➜ ខុស 56px ➜ **នោះជាមូលហេតុនៃការលោត**។
២. **កម្ពស់ `.table-responsive` លែងប្តូរ** រវាង ២ របៀប ➜ ថ្នាក់កំហុស «ប្តូរកម្ពស់
   កន្សោមរមូរកណ្តាល momentum» ក្លាយជា **មិនអាចកើតឡើងបានតាមរចនាសម្ព័ន្ធ**។

**ត្រូវប្រើ `height` មិនមែន `min-height`** — `min-height` មិនកំណត់ពិដានទេ ➜ ខ្សែសង្វាក់
flex ខាងក្នុងធ្វើឲ្យកាតរីកតាមមាតិកាតារាងទាំងមូល (វាស់បាន 10,387px)។ ក្នុងរបៀប
`history-expanded`, `flex: 1` (flex-basis 0) សរសេរជាន់ `height` ដោយចេតនា ➜ ការទទួល
កន្លែងរបា Tab មកវិញ (`chrome-space-released`) នៅដំណើរការដដែល។

ចលនាមាន ២ ផ្លូវ **ដោយចេតនា** ព្រោះម្រាមដៃលើតារាងជាកម្មសិទ្ធិរបស់តារាង៖

| ម្រាមដៃនៅឯណា | ចលនា |
|---|---|
| ផ្ទាំងស្ថិតិ/ស្វែងរក | ការរមូរ native របស់ `.app-pages` = ១:១ ពិត + momentum |
| តារាងបញ្ជី | តារាងរមូរធម្មតា រួច `panelGlideFrom()` រអិល 220ms ពេល `touchend` |

`panelGlideFrom()` ជា **FLIP**៖ អានទីតាំង, ប្តូរ class, អានម្តងទៀត, រួចធ្វើចលនា
`transform` តាម Web Animations។ វា **មិនមែន** CSS `transition` ទេ — `transition` លើ
`max-height` នៅតែមិនដំណើរការ (មើលថ្នាក់កំហុសខាងក្រោម)។ វាគោរព
`prefers-reduced-motion` និងបិទលើ ≥992px។

**`scroll-padding-top` ត្រូវស្មើនឹង `padding-top` របស់ `.app-pages` ជានិច្ច។**
`scroll-snap-type: y proximity` ធ្វើឲ្យការរមូរឈប់ត្រឹម 0 ឬចម្ងាយពេញ (លែងឈប់
ពាក់កណ្តាល)។ បើភ្លេច `scroll-padding-top` នោះចំណុច snap «បើក» ធ្លាក់ត្រឹម
`scrollTop 71` ជំនួស `0` ➜ **PTR លែងកេះបានទាំងស្រុង** ព្រោះវាទាមទារ `scrollTop <= 1`។

**របៀបស្តារចលនា 2.9.0 វិញ បើជុំ audit ណាមួយកែប៉ះវា។** ចលនានេះអាស្រ័យលើ
ចំណុច ៤ ដែលត្រូវមានគ្រប់ — បាត់មួយណាក៏ការលោតត្រឡប់មកវិញដែរ៖

| # | អ្វី | នៅឯណា |
|---|---|---|
| ១ | `.page-main` មាន `height: calc(100dvh - --chrome-top - --chrome-bottom - 16px)` + `flex: none` | `style.css`, ក្នុង `@media (max-width: 991px)` |
| ២ | ខ្សែសង្វាក់ flex ខាងក្នុង៖ `.history-section`/`.panel-section`/`#parcelPanel`/`#lockerPanel` ជា `flex: 1; min-height: 0` និង `.table-responsive` ជា `max-height: none; flex: 1; min-height: 0` (scope ត្រឹម `.page-main` ➜ modal រក្សា 62vh) | ដដែល |
| ៣ | `.app-pages` មាន `scroll-snap-type: y proximity` **បូក** `scroll-padding-top` ស្មើ `padding-top`; កូន ២ មាន `scroll-snap-align: start` | ដដែល |
| ៤ | `panelGlideFrom()` (FLIP តាម Web Animations) ត្រូវហៅក្នុង `applyPanelAction()` និង handler `click` របស់ `#dragHandle` | `app.js` |

លេខយោង (412×780, seed 120 order)៖ ចម្ងាយរំកិល **361px**; កាតខ្ពស់ **642px ទាំង ២ របៀប**;
តារាងខ្ពស់ **538px ទាំង ២ របៀប**; `.app-pages` រមូរបាន **361px** ដែលស្មើចម្ងាយរំកិល។
មុនកែ កាតខ្ពស់ 588 ធៀប 642 (ខុស **56px**) ➜ នោះជាមូលហេតុនៃការលោត។

**ការផ្ទៀងផ្ទាត់៖** `node audit-tools/panel-motion-test.js` (33 assertions លើ 320/412/768px)។
បើវាធ្លាក់ដោយ `cardHeightDelta`/`tableHeightDelta` នោះចំណុច ១ ឬ ២ បាត់; បើធ្លាក់ដោយ
`snapRestNearTop` នោះចំណុច ៣ បាត់ (**ហើយ PTR ក៏ស្លាប់ដែរ**); បើធ្លាក់ដោយ
`residualTransform` នោះចំណុច ៤ មានបញ្ហា។

**Auto pull up — `setPhoneSearchPulledUp()`។** ចុច (focus) ប្រអប់ស្វែងរកលេខទូរស័ព្ទ ➜
`#dataSideSection` ទទួល `.search-focus` ដែលបង្រួមកាតខាងលើទាំងអស់ ទុកតែប្រអប់ស្វែងរក
ហូតឡើងក្រោម navbar (CSS៖ `.page-side.search-focus > *:not(:last-child)`)។
**ដូច្នេះកាតស្វែងរកត្រូវតែនៅជា child ចុងក្រោយរបស់ `.page-side`** — បើបន្ថែមកាតក្រោយវា មុខងារនេះខូច។
blur ដោយប្រអប់ទទេ ឬចាកចេញ ឬប្តូរទំព័រ ➜ ដោះវិញ។ លើ **≥992px វាមិនធ្វើអ្វីទេ**
ព្រោះ layout ២ ជួរឃើញគ្រប់យ៉ាងស្រាប់។ Test៖ **`phone-search-swipe-test.js`**។

**Pull-to-refresh លើ iOS PWA — `setupIOSPullToRefresh()`។** វាជាកាយវិការដាច់ពី
`setupSwipeGestures()` ហើយត្រូវរក្សាច្បាប់ទាំងនេះ៖

- `<head>` រក iOS standalone តាំងពីមុន stylesheet (`navigator.standalone === true`)
  ហើយដាក់ `html.ios-standalone`។ ក្នុង iOS standalone,
  `html/body` ត្រូវ `overflow-y:hidden` + `overscroll-behavior-y:none`; `#appPages`
  (`min-height:0`, `overflow-y:auto`, `overscroll-behavior-y:contain`) ជា outer scroll owner តែមួយ។
  កុំប្រើ generic `(display-mode: standalone)` ដើម្បីពង្រីក root; Android/browser ធម្មតា
  ទទួល safe area តាម content/tabbar padding ហើយមិនត្រូវមាន root scroll range ឬ PTR នេះទេ។
  **កុំដក safe-area ចេញពី `min-height`** — វាត្រូវបានរក្សាដោយចេតនា; ត្រូវបិទ root
  scrolling មិនមែនបង្រួម body។
- PTR ចាប់បានតែពេល root/window/body/`#appPages` និងកន្សោមរមូរសកម្មសុទ្ធតែនៅ
  កំពូល (ទទួលគ្រប់តម្លៃ finite `scrollTop <= 1` រួមទាំង negative Safari rubber-band),
  មាន touch មួយ និងទិសចុះបញ្ឈរច្បាស់។ Modal/drawer/input/editable/navbar/tabbar និង
  button/link ក្រៅតារាងមិនមែនគោលដៅ PTR។ Tap/drag ខ្លីលើ action ក្នុងជួរតារាងនៅតែ
  មិនត្រូវដណ្ដើម ប៉ុន្តែ deliberate long vertical pull អាចចូល PTR ដូចផ្ទៃទទេរបស់ជួរ។
- ពេល active panel មាន `.collapsed`/`.search-focus` ឬ `#appPages.history-expanded`, PTR
  ត្រូវបិទទាំងស្រុង៖ គ្មាន indicator, `preventDefault`, reload ឬ document-level
  non-passive `touchmove`។ ការទាញចុះជាកម្មសិទ្ធិរបស់ panel ដើម្បីបើកផ្ទាំងវិញ។
  Safari កំណត់ cancelability មុន `touchstart` ចប់ ដូច្នេះ non-passive listener របស់ PTR
  ត្រូវត្រៀមជាមុននៅ state ធម្មតា ហើយដកចេញតាម `MutationObserver` ពេល panel ចូល
  `.collapsed`/`.search-focus`/`history-expanded`; កុំដំឡើងវាក្រោយ touchstart។
- `iosTouchArbiter` ត្រូវប្រើ `Touch.identifier` និងចែក ownership៖ 0–30px គ្មាន action;
  លើ full-screen/search state ការទាញចុះបញ្ឈរជា panel action គ្រប់ចម្ងាយ; លើ state ធម្មតា
  ប្រហែល 56–212px PTR spring back ហើយចាប់ពី ~213px ទើប refresh។ បន្ថែម
  ម្រាមដៃទី២ត្រូវ cancel ទាំងពីរ។ Panel class/scroll owner ប្តូរតែ final `touchend`, មិនមែន
  កណ្តាល touch; ត្រូវគណនាចម្ងាយឡើងវិញពី matching `changedTouches` នៅ final release
  ដើម្បីកុំ commit state ចាស់ពេលម្រាមដៃបញ្ច្រាសលឿន។ Panel swipe ក៏ត្រូវទាមទារ
  vertical-axis ratio 1.6 ដូច PTR ដើម្បីមិនប្តូរផ្ទាំងលើ diagonal/horizontal swipe;
  បន្ទាប់ពី PTR បាន lock អ័ក្សបញ្ឈរ final release ត្រូវប្រើ hysteresis ដូច touchmove
  (`|dx| <= dy × 0.85`) ដើម្បីឲ្យ ready indicator និង refresh decision ស្របគ្នា;
  `touchcancel` បោះបង់ទាំងមូល។
- មុន reload ត្រូវដាក់ marker `zoew_ptr_reload_pending`, កំណត់
  `history.scrollRestoration='manual'` និងលុប root/page/table offset។ `<head>` ត្រូវ
  ឃើញ marker ហើយបិទ auto restoration មុន parse; ក្រោយ boot ត្រូវ settle offset ម្តងហើយ
  ម្តងទៀតតាម rAF/timer ដើម្បីឈ្នះ restoration យឺតរបស់ iOS។ រក្សា marker រហូតដល់
  settle ចប់; tap គ្មានចលនាមិនត្រូវ cancel timers (cancel តែ user scroll ឆ្លង axis slop)។
  ពេល settle/cancel ចប់ ត្រូវស្ដារ `history.scrollRestoration` ទៅតម្លៃមុន PTR និងសម្អាត
  marker ទាំងពីរ។ ចន្លោះ 300ms មុន navigation phase `refreshing` ត្រូវ block panel/click
  ទាំងអស់មិនថា touch ID ថ្មីណា ហើយ watchdog 5s ត្រូវដោះ spinner/marker បើ reload មិនកើត។
  ពេល `beforeunload` បញ្ជាក់ថា navigation ចាប់ផ្តើម ត្រូវ cancel watchdog **ដោយមិនលុប
  markers** ព្រោះ response យឺត >5s នៅតែត្រូវការវានៅទំព័រថ្មី។ **កុំជំនួសផ្លូវនេះដោយ
  `location.reload()` ទទេ** — នោះធ្វើឲ្យកាតប្រវត្តិរអិលឡើងក្រោម navbar។
- Indicator ត្រូវឡើង opacity តាមចម្ងាយជិតពិដាន refresh មិនមែនលេចពេញតាំងពីការទាញ
  ធម្មតា។ `ResizeObserver` លើ navbar/tabbar ត្រូវវាស់ `--chrome-top`/`--chrome-bottom`
  ឡើងវិញ ពេល safe area ឬ font ធ្វើឲ្យកម្ពស់មកយឺត។ វាស់ tabbar ដោយ `offsetHeight`
  និង body `getBoundingClientRect().height` មិនមែន transformed/scroll-dependent bottom ដើម្បី
  កុំឲ្យរបាលាក់ ឬ root offset បន្ថយ `--chrome-bottom`។ ត្រូវរក្សា extension នេះក្នុង
  `--page-extension`; settled hidden expanded padding ត្រូវជា `--page-extension + 8px` ដើម្បី
  កុំឲ្យគែមកាត/តារាងធ្លាក់ក្រោម locked viewport។

Tests៖ **`gesture-test.js`** (touch/reload/layout ពិត) និង
**`phone-search-swipe-test.js`** (state machine/scroll lock)។

**ការលាក់របាតាមទិសរមូរ — `setupChromeAutoHide()` — លាក់តែ *របា Tab ខាងក្រោម* ប៉ុណ្ណោះ។**
**របា navbar ខាងលើមិនលាក់ទេ** (សំណើអ្នកប្រើ) — កុំបន្ថែមច្បាប់ `body.chrome-hidden .app-navbar`
មកវិញ។ អំឡុង momentum ការលាក់/បង្ហាញរបា **មិនត្រូវប្តូរកម្ពស់ ឬ padding របស់កន្សោមរមូរណាមួយឡើយ**។
ការប្តូរ layout ចំពេល momentum scroll របស់ WebKit កំពុងដើរ ធ្វើឲ្យបញ្ជីលោតរំលង
(អ្នកប្រើរាយការណ៍ថា «រំលង list លឿនជ្រុល»)។ ដូច្នេះ៖

- របា Tab ជា `position: fixed` ហើយរំកិលដោយ **`translate3d` តែប៉ុណ្ណោះ**
- កន្លែងរបស់របា Tab ក្នុងរបៀបពេញអេក្រង់ ត្រូវកក់ជា `padding-bottom` លើ
  `.app-pages.history-expanded` (= `var(--chrome-bottom)` ដែល `measureAppChromeSize()`
  វាស់ពិត) ➜ **គែមក្រោមកាតឈរខាងលើរបា Tab**។ `body.chrome-hidden` ប្តូរតែ
  transform របស់ Tab bar; ក្រោយ scroll ស្ងប់ 180ms ទើប `body.chrome-space-released`
  ទម្លាក់ padding មក `--page-extension + 8px` ដើម្បីឲ្យកាតរីកបំពេញកន្លែងរបា។ ពេល
  បង្ហាញវិញ ក៏ពន្យារការកក់កន្លែងរហូត scroll ស្ងប់ដូចគ្នា។ **កុំដាក់ transition លើ
  padding និងកុំប្តូរ class នេះកណ្តាល momentum**។ Scroll handler ត្រូវ coalesce តាម
  `requestAnimationFrame` មួយដងក្នុងមួយ frame។ `gesture-test.js` ចាក់សោឥរិយាបថនេះ។
  កំណែ 2.4.0 ធ្លាប់កក់វាដោយ `.table-responsive::after` *ខាងក្នុង* កន្សោមរមូរ —
  layout ស្ថិរដូចគ្នា តែជួរដេកលិចចូលពីក្រោមរបា ➜ **កុំនាំវិធីនោះត្រឡប់មកវិញ**
- **គ្មាន `backdrop-filter` លើ `.app-navbar`** — iOS គណនា blur ឡើងវិញរាល់ស៊ុមពេលរបារំកិល
- **គ្មាន `scroll-behavior: smooth`** លើ `body` ឬ `.table-responsive` — WebKit យកវាទៅ
  អនុវត្តលើការរមូរតាមកម្លាំងផងដែរ
- ពិដាន `SHOW_AFTER` (៤៨px) ខ្ពស់ជាង `HIDE_AFTER` (៣៦px) ដោយចេតនា — momentum របស់ iOS
  បញ្ចេញចលនាបញ្ច្រាសទិសបន្តិចបន្តួច ហើយពិដានទាបធ្វើឲ្យរបាភ្លឹបភ្លែត

Test៖ **`gesture-test.js`**។

**ចង្វាក់ស៊ុមសម្របតាមឧបករណ៍ ១០–១២០ fps — `measureDisplayHz()`។**
**ទំព័រវែបមិនអាចដំឡើងល្បឿន refresh របស់អេក្រង់បានទេ** (វាជារបស់ OS/browser —
Safari លើ iPhone ជាធម្មតាចាក់ rAF ត្រឹម ៦០Hz ទោះអេក្រង់ ProMotion ១២០Hz ក៏ដោយ)។
អ្វីដែល App ធ្វើបានគឺ **វាស់ចង្វាក់ពិត** រួចយកវាធ្វើមូលដ្ឋាននៃការសម្រេចទាំងអស់៖

- `measureDisplayHz()` យក **median** នៃចន្លោះ rAF ២៤ ស៊ុម (median ធន់នឹង ស៊ុមខូច
  ១–២ ដែល mean មិនធន់) រួច clamp ចូល `[10, 120]`
- `longFrameThresholdMs()` = `ថវិកាមួយស៊ុម × 1.6` (យ៉ាងតិច ១២ms) — **កុំយកលេខថេរ
  មកវិញ**។ ២៦ms ថេរខុសទាំង ២ ទិស៖ លើ ១២០Hz វាធូរពេក (ស៊ុមវែងពិតគឺ >៨.៣ms)
  ចំណែកលើឧបករណ៍ដែល browser ចាក់ត្រឹម ៣០Hz វាតឹងពេករហូតរាយអ្វីៗទាំងអស់ជាយឺត
- ចន្លោះល្បឿនស្កេនក៏សរសេរជា fps ដែរ — `LIVE_SCAN_MIN_FPS = 10`,
  `LIVE_SCAN_MAX_FPS = 120` ➜ ចន្លោះ ៨–១០០ms។ ពិដាន ៨ms មិនបង្អាក់ឧបករណ៍លឿន
  (ការស្កេនពិតត្រូវកំណត់ដោយល្បឿនស៊ុមកាមេរ៉ា តាម `requestVideoFrameCallback`)
  ចំណែក ១០០ms ជាការធានាថាឧបករណ៍យឺតនៅតែស្កេន ដោយថ្លៃត្រូវទប់ដោយជំហានទទឹង
- Test៖ **`gesture-test.js`** (ចង្វាក់ + clamp) និង **`scan-engine-test.js`** (ចន្លោះ fps)

**ទម្រង់ស្រាលស្វ័យប្រវត្តិ — `setupAdaptivePerformance()`។** វាស់ចង្វាក់ (ខាងលើ) រួច
វាស់ការធ្លាក់ស៊ុម (`sampleFramePace()`) **២ ដង** — វិនាទីទី ១.៥ និងទី ១០ — ហើយដាក់
`body.perf-lite` តែពេលធ្លាក់ស៊ុម **ទាំង ២ ដង**។ ការវាស់ ២ ដងជាចំណុចសំខាន់៖ ការវាស់
តែម្តងនឹងច្រឡំភាពរវល់ពេល boot ជាឧបករណ៍យឺត។ `perf-lite` បិទចលនាដែលដើរជារៀងរហូត
និងស្រមោលដែលថ្លៃ — **វាមិនប៉ះមុខងារអាជីវកម្មណាមួយឡើយ**។

**ចូលដោយក្រយៅដៃ ឬមុខ (WebAuthn) — ជាការ *ដោះសោ* PIN មិនមែនជំនួស PIN។**
PIN មិនត្រឹមតែជា gate ទេ — `deriveLookupSecretKey(pin)` យកវាទៅបង្កើតកូនសោ AES
ដែលឌិគ្រីប Secret របស់ Lookup API។ ដូច្នេះជីវមាត្រ **មិនអាចជំនួស PIN ជាប្រភពសម្ងាត់បានទេ**;
វា​ត្រឹមតែរុំ PIN ទុក ហើយស្កេនដើម្បីស្រាយវាវិញ៖

- បើក/បិទក្នុងរបា Slide (`#biometricToggleBtn`) — ការបើក **តម្រូវឲ្យវាយ PIN ពិតជាមុនជានិច្ច**
  (`requestPinBeforeConfig(startBiometricEnrollment, 'biometric')`)
- របៀប **`prf`** (WebAuthn PRF extension — iOS 18+/Chrome ថ្មី)៖ កូនសោរុំចេញពីឧបករណ៍
  មិនរក្សាទុកកន្លែងណាទេ។ របៀប **`device`** (fallback)៖ កូនសោរុំរក្សាក្នុង localStorage
  ➜ **ជាភាពងាយស្រួល មិនមែនការបន្ថែមសុវត្ថិភាពទេ** — ប្រអប់ប្រាប់អ្នកប្រើរួច
- PIN ដែលស្រាយចេញ **ត្រូវផ្ទៀងផ្ទាត់នឹង `zoew_security_pin_hash` មុនទុកចិត្ត**;
  មិនត្រូវគ្នា ➜ លុបការចងចោល។ ការជាប់សោ (lockout) នៅតែអនុវត្ត
- ប្តូរ PIN (`saveNewSecurityPin`) ➜ លុបការចងចាស់ ព្រោះ PIN ដែលរុំទុកលែងត្រូវ
- `completePinUnlock()` ជា **ផ្លូវជោគជ័យតែមួយ** សម្រាប់ទាំង PIN និងជីវមាត្រ ហើយវាបញ្ជូន
  PIN ពិតចូល `pinTargetAction(pin)` — ការចងជីវមាត្រត្រូវការវា។ Test៖ **`biometric-unlock-test.js`**។

**កំណែ App បង្ហាញ ២ កន្លែងក្នុង ZoeW**៖ ប្រអប់ login និងខាងក្រោមរបា Slide (`.drawer-foot`)។
`version-check.js` អះអាងកន្លែងទាំងនោះឲ្យច្បាស់ — ការបន្ថែមកន្លែងទី ៣ នឹងធ្លាក់។

**ប្រអប់ PIN បង្ហាញសារតាមប៊ូតុងដែលហៅ។** `requestPinBeforeConfig(targetAction, promptKey)` —
`promptKey` ជាកូនសោក្នុង `PIN_PROMPT_MESSAGES` (`config`, `lookupApi`, `locker`, `manualAdjust`,
`clearHistory`, `setupLink`) ហើយ `applyPinPromptText()` សរសេរវាចូល `#pinModalDesc` និង
`#pinSetupModalDesc`។ **រាល់ការបន្ថែមប៊ូតុងដែលការពារដោយ PIN ត្រូវបន្ថែមធាតុថ្មីក្នុងតារាងនោះ
ហើយបញ្ជូនកូនសោរបស់វា** — បើមិនដូច្នេះ អ្នកប្រើឃើញសារ «Config ឬ Reconfig» លើគ្រប់ប៊ូតុង។
Test៖ **`pin-prompt-test.js`**។

### ម៉ាស៊ីនស្កេន Barcode

**បញ្ជី format មានតែ `CODE_128` — កុំបន្ថែមវិញ។** `SCAN_FORMAT_NAMES` (ZXing) និង
`NATIVE_SCAN_FORMAT_NAMES` (`BarcodeDetector` លើ Android) មានធាតុមួយគត់។ ITF, CODABAR
និង CODE_39 **គ្មានលេខផ្ទៀងផ្ទាត់ជាកាតព្វកិច្ចទេ** ➜ ស្លាកមួយអាចត្រូវអានចេញជា
**លេខផ្សេងទាំងស្រុង** ដោយ «ជោគជ័យ»។ `scan-engine-test.js` គូរស្លាក ITF ពិតមួយ រួច
អះអាងថា reader បច្ចុប្បន្នបដិសេធវា ចំណែក reader ១១ format ទទួលយក។

**`confirmLiveScan()` ជាជាន់ការពារទី ២** — លេខត្រូវអានឃើញដដែល `SCAN_CONFIRM_REPEATS`
(២) ស៊ុមជាប់គ្នា ក្នុងបង្អួច `SCAN_CONFIRM_WINDOW_MS` ទើបទទួលយក។ ផ្លូវ live **ទាំង ២**
(ZXing និង `BarcodeDetector`) ត្រូវឆ្លងកាត់វា។ ផ្លូវរូបភាព និង hardware scanner
**មិនឆ្លងកាត់ទេ** ដោយចេតនា — ពួកវាមានតែស៊ុមតែមួយ។

**ទំហំស៊ុមឌិកូដ ជាព្រំដែននៃ *ជួរអាន* លើ iPhone។** Android ប្រើ `BarcodeDetector`
ដើមរបស់ប្រព័ន្ធ ដែលឌិកូដលើ `ImageBitmap` **គុណភាពពេញ** ចំណែក Safari គ្មាន API នោះ
➜ iPhone ឌិកូដលើ canvas ដែលបង្រួមរួច។ ទទឹង canvas នោះកំណត់ថា barcode តូចប៉ុនណា
ដែលនៅតែអានចេញបាន (CODE_128 ១៣ តួ ≈ ២១១ module ➜ ត្រូវការ ~១.៦px/module)។
ដូច្នេះ៖

- `LIVE_SCAN_WIDTH_STEPS = [640, 800, 1024, 1280]` — ចាប់ផ្តើមពី **ជំហានខ្ពស់បំផុត**
  រួច `noteLiveScanCost()` ទម្លាក់ចុះបើឌិកូដលើស `LIVE_SCAN_SLOW_MS` ហើយឡើងវិញបើក្រោម
  `LIVE_SCAN_FAST_MS`។ **កុំចាក់ទទឹងឲ្យថេរ** — នោះជាការដកមុខងារសម្របតាមឧបករណ៍ចេញ
- **កម្ពស់កាត់ត្រឹម `LIVE_SCAN_MAX_BAND_PX` (២៤០px) ដោយចេតនា** — barcode ជាបន្ទាត់
  បញ្ឈរ ➜ គុណភាព **ផ្តេក** ទេដែលសំខាន់; ការបង្ហាប់បញ្ឈរមិនប៉ះការអានទេ (មានតេស្ត
  អះអាង) តែវាកាត់ថ្លៃ `drawImage`/`getImageData` ចុះច្រើន
- **ផ្លូវ live ប្រើ `makeRowLuminanceSource()` មិនមែន `HTMLCanvasElementLuminanceSource` ទេ។**
  ZXing អានពិតតែប្រហែល ១៥ ជួរដេកជុំវិញកណ្តាល (`OneDReader.doDecode`) តែ source
  ស្តង់ដារបម្លែង **គ្រប់ pixel** ជា grayscale មុនគេ។ source ថ្មីបម្លែងតែជួរដេកដែល
  binarizer ស្នើ ➜ ៤.២៧ ➜ ២.៥១ ms/ស៊ុម លើស៊ុម 1280px។ **ផ្លូវរូបភាព (`codeReader`,
  `tryHarder`) នៅប្រើ source ស្តង់ដារដដែល** ព្រោះវាត្រូវការ `rotateCounterClockwise()`
- **`takeFreshVideoFrame()` ជាផ្នែកនៃជាន់ការពារ មិនមែនល្បឿនទេ។** បើស៊ុមវីដេអូតែមួយ
  ត្រូវឌិកូដពីរដង នោះ `confirmLiveScan()` (ដែលទាមទារ ២ ស៊ុមជាប់គ្នា) ក្លាយជា
  ១ ស៊ុមភ្លាម។ ផ្លូវ live **ទាំង ២** ត្រូវឆ្លងកាត់វា។ `scheduleScanFrame()` ប្រើ
  `requestVideoFrameCallback` បើមាន (iOS 15.4+) បើអត់ ថយទៅ `requestAnimationFrame`

**ការស្កេន QR ពេល Config/Reconfig ជាម៉ាស៊ីនអានដាច់ដោយឡែក** — `configQrReader` ជា
`ZXing.BrowserQRCodeReader` ដែល **មិនពាក់ព័ន្ធនឹង `SCAN_FORMAT_NAMES` សោះ**។ ការកែ
បញ្ជី format 1D មិនអាចប៉ះពាល់ការស្កេន QR បានទេ។

## Core business rule: «លុប» (Delete) ទល់នឹង «ដក» (Remove) — READ BEFORE TOUCHING REVENUE CODE

នេះជាគោលការណ៍អាជីវកម្មដោយចេតនា មិនមែនកំហុសទេ ហើយងាយត្រូវវិនិច្ឆ័យខុស៖

- **លុប / Delete** = លុបកញ្ចប់ទាំងមូល (barcode ទាំងអស់របស់វា)។ **មិនត្រូវប៉ះ**
  `zoew_daily_revenue_cod_dod` / `zoew_monthly_revenue_cod_dod` ទេ ក្នុងទិសណាក៏ដោយ —
  មិនប៉ះពេលលុប, មិនប៉ះពេលស្តារ, មិនប៉ះពេលលុប/ស្តារច្រើនជុំ។ Idempotent ដោយការរចនា។
- **ដក / Remove** = ដក barcode តែមួយចេញពីកញ្ចប់ដែលមាន barcode ច្រើន (ឬការសម្អាតស្វ័យប្រវត្តិ
  ៨ ថ្ងៃ)។ វា **ដក** តម្លៃ cod/dod របស់ barcode នោះចេញពីស្ថិតិភ្លាមៗ, **ត្រូវបូកមកវិញ**
  ពេលស្តារពីធុងសំរាម, ហើយដកម្តងទៀតបើដកម្តងទៀត។ តាមដានតាមទង់ `isDeducted: true/false`។

បើតួលេខចំណូលមិនធម្មតា **ត្រូវកំណត់ជាមុនថាវាជាផ្លូវណាក្នុងចំណោម ២ នេះ** (ពិនិត្យទង់
`isFromDeletion` និងថាតើ item ក្នុងធុងសំរាមមាន barcode ១ ឬពេញសំណុំដើម) មុននឹងស្នើការកែ។

**ទង់ក្នុង barcode នីមួយៗ៖**

| ផ្លូវ | `isFromDeletion` | `isDeducted` |
|---|---|---|
| លុប (`deleteSingleItem`, `clearHistory`, សម្អាត 2h) | `true` | មិនប៉ះ (នៅ `false`) |
| ដក (`removeSingleBarcode`, សម្អាត 8d) | `false` | `true` |
| ស្តារ (`executeRestoreItem`) | លុបចោល | reset |

**`isDeducted` នៅតែជាវាល *តែមួយគត់* ដែលកំណត់លុយ** — `isFromDeletion` ជាសញ្ញាសម្គាល់បន្ថែម។

**ការសម្អាតស្វ័យប្រវត្តិ (កុំប្តូរដោយគ្មានការស្នើ)៖** កញ្ចប់បិទ ➜ ធុងសំរាមក្រោយ **២ ម៉ោង**;
កញ្ចប់មិនទាន់បិទ ➜ ក្រោយ **៨ ថ្ងៃ**; អ្វីក្នុងធុងសំរាម ➜ purge ក្រោយ **១០ ថ្ងៃ**។
`claimAndCleanupItem()` **ផ្ទៀងផ្ទាត់បង្អួចម្តងទៀតខាងក្នុង transaction** ធៀបនឹងតម្លៃរបស់ server
ដូច្នេះការកេះដោយស្ថានភាពចាស់ក្នុងសតិ មិនអាច claim ខុសបានទេ។

### នាឡិកា

Timestamp ទាំងអស់ដែលចូលរួមក្នុងការសម្រេច retention/revenue (`createdAt`, `closedAt`,
`deletedAt`, `lockerUpdatedAt`, និង «ឥឡូវ» ដែលប្រៀបនឹងវា) គណនាតាម `getServerNow()`
(`Date.now() + serverTimeOffsetMs` ដែល offset រក្សាឲ្យស្រស់ពី `.info/serverTimeOffset`)
មិនមែន `Date.now()` ឆៅទេ។ Timer ដែលជា cosmetic/local សុទ្ធសាធ (PIN lockout, salt បង្កើត id,
scan debounce, deadline load script, TTL cache lookup) **នៅតែប្រើ `Date.now()` ឆៅដោយចេតនា**
— កុំ «កែ» ពួកវា។

**មេរៀន៖ ការស្វែងរកតែ `Date.now()` ខកខានចំណុចពិត — ត្រូវរក `new Date()` (គ្មាន argument) ផងដែរ។**

`license-verify.js` មាន `getServerNow()`/`serverTimeOffsetMs` **ដាច់ដោយឡែករបស់វា** ព្រោះវាជា
REST-only (`fetch` សុទ្ធ គ្មាន Firebase SDK ដោយការរចនា)។ វាអាន header HTTP `Date` លើរាល់សំណើ
ដែលវាធ្វើរួច (`checkOnline()`) ហើយ export `syncServerTime()` សម្រាប់អ្នកហៅដែលមិនកេះសំណើទាន់ពេល។

## ថ្នាក់កំហុសដែលបានដោះស្រាយរួច — កុំធ្វើឡើងវិញ

ទាំងនេះជាមេរៀនដែលចំណាយពេលច្រើនដើម្បីរកឃើញ។ គ្រប់ថ្នាក់មាន checker ស្វ័យប្រវត្តិឥឡូវនេះ។

- **សរសេរ item ទាំងមូលពីច្បាប់ចម្លងក្នុងសតិ** ➜ លុបការងាររបស់ឧបករណ៍ផ្សេង។ គ្រប់ផ្លូវសរសេរត្រូវ
  ជា `runTransaction` លើ record របស់ server ឬត្រូវអាន `fb.get` លើ node ជាក់លាក់មុនសរសេរ។
  Checker៖ **`stale-write.js`**។
- **`promise.then(A).catch(B)` ដែល B ជាការសង្គ្រោះ** ➜ JavaScript រត់ `B` ពេល **`A` throw**
  ដែរ ➜ ការសរសេរជោគជ័យ តែការសង្គ្រោះរត់ខុស ➜ លុយបាត់។ ប្រើ `.then(A, B)` ២ អាគុយម៉ង់
  ឬទង់។ Checker៖ **`compensation-order.js`**។
- **ការប្តូរ layout ចំពេល touch/momentum scroll របស់ iOS ឬទុក root scroll restoration
  ក្រោយ PTR** ➜ បញ្ជីលោតរំលង/កាតរអិលក្រោម navbar។ ការប្តូរ panel ត្រូវរង់ចាំ
  `touchend`, របា Tab ត្រូវជា `transform` សុទ្ធ ហើយ PTR reload ត្រូវ reset root/page/table។
  Tests៖ **`gesture-test.js`**, **`phone-search-swipe-test.js`**។
- **ការសរសេរ style រួចអានធរណីមាត្រ ក្នុង handler របស់ touch/scroll** ➜ browser ត្រូវ
  ទូទាត់ layout **ស្របគ្នា** ចំពេលម្រាមដៃកំពុងអូស។ ធ្ងន់បំផុតក្នុង `touchmove` ដែល
  **non-passive** ព្រោះ iOS ត្រូវរង់ចាំវាចប់មុនអនុញ្ញាតឲ្យរមូរ។ ការដើរឡើងលើដើមឈើ
  DOM ជាមួយ `getComputedStyle()` ក្នុងផ្លូវនោះត្រូវ **ចងចាំក្នុងមួយកាយវិការ**
  (`scrollerForPull()`), ហើយ handler របស់ `scroll` ត្រូវ coalesce តាម
  `requestAnimationFrame` ព្រមទាំងរំលងការសរសេរពេលតម្លៃមិនប្រែ។
  Checker៖ **`layout-thrash.js`** (ស្តាទិច + វាស់ក្នុង Chromium ពិត)។
- **animation លើ property ដែលមិនអាច composite** — `top`/`height` ➜ layout រាល់ស៊ុម;
  `box-shadow`/`background-color` ដោយ `infinite` ➜ គូរឡើងវិញរាល់ស៊ុមជារៀងរហូត។
  ប្រើ `transform`/`opacity` ឬដាក់ធាតុនោះលើ layer ដោយឡែក។ Checker៖ **`animation-cost.js`**។
- **ការសរសេរដែលចុះ *ក្រោយ* `withTimeout` បោះបង់រួច** ➜ បើ catch ដោះ claim ឬបញ្ច្រាសលុយភ្លាម
  នោះខុស។ ត្រូវចាប់ promise ទុក ហើយដាក់ handler លើវាពេល timeout។ Test៖ **`slow-write-test.js`**
  (បង្រួម timer ≥1s ចុះ ១០០ ដង)។
- **រូបរាង `barcodes` ៣ យ៉ាងពី RTDB** — `[A,B]` · `[A,null,B]` · `{0:A,2:B}`។ គ្រប់ផ្លូវអានឆៅ
  ត្រូវហៅ `normalizeBarcodesOf()` / `barcodeEntriesOf()`។ Tests៖ **`barcode-shape-test.js`**,
  **`raw-read-shape-test.js`**។
- **ទិន្នន័យអតិថិជនសល់ក្នុង DOM ក្រោយចាកចេញ** — វាលណាដែលសរសេរដោយទិន្នន័យអតិថិជនត្រូវលុប
  ក្នុង `clearSensitiveModalFields()`។ Checker៖ **`dom-hygiene.js`**។
- **អថេរ state កម្រិត module ដែលរស់រានក្រោយចាកចេញ**។ Checker៖ **`state-hygiene.js`**។
- **`env()` គ្មាន fallback** ➜ browser ដែលមិនស្គាល់វាបោះចោលការប្រកាសទាំងមូល។ ត្រូវដាក់
  តម្លៃមូលដ្ឋាននាំមុខជានិច្ច។
- **`localStorage.setItem` ខាងក្នុង callback របស់ `onValue`** ➜ `QuotaExceededError`
  សម្លាប់ callback ➜ តារាងឈប់ update។ ត្រូវ try/catch។
- **លុយចំណុចអណ្តែត** — គ្រប់ការបូកលុយឆ្លងកាត់ `Math.round(x * 100) / 100`។ ថ្នាក់នេះ
  ដោះស្រាយរួចហើយ — កុំរាយការណ៍ជាកំហុសថ្មី។
- **ការអានលេខខុសឆ្លង format** — បញ្ជី format ធំធ្វើឲ្យស្លាកមួយអានចេញជាលេខផ្សេង
  ដោយ «ជោគជ័យ»។ ដោះស្រាយដោយ `SCAN_FORMAT_NAMES = ['CODE_128']` បូក `confirmLiveScan()`។
  Test៖ **`scan-engine-test.js`**។
- **ប្រអប់ native (`confirm`/`alert`) ផ្អាក `<video>` លើ iOS ហើយមិនបន្តវិញ** ➜ កាមេរ៉ាកក។
  គ្រប់ផ្លូវដែលបើកប្រអប់ native ខណៈកាមេរ៉ាកំពុងស្កេន ត្រូវហៅ `resumeScanVideo()` ក្រោយវា
  (បូក listener `pause` ជាជាន់ទី ២)។ Test៖ **`camera-resume-test.js`**។
- **`transition` លើ `max-height` ដែលតម្លៃដើមជា `none`** ➜ វា **មិនធ្វើចលនាទេ** (លោតទៅ 0
  ភ្លាម) ដូច្នេះអ្វីដែលនៅសល់ជាការគូរឡើងវិញឥតប្រយោជន៍ ចំពេលអ្នកប្រើកំពុងរមូរ។ ការវាស់ពិត៖
  `clientHeight` ធ្លាក់ដល់ 0 ក្នុងស៊ុមតែមួយ ខណៈ `opacity` នៅដេញ ០.៣ វិនាទីទៀត។
  បើត្រូវការការបង្រួមមានចលនាពិត ត្រូវប្រើ `transform`/`opacity` លើប្រអប់ដែលមានកម្ពស់ថេរ។
- **class ដែលកំណត់ `overflow` លើកន្សោមរមូររួម ត្រូវជាប់តែទំព័រដែលត្រូវការវា** ➜ បើវាជាប់
  ឆ្លងទំព័រ ទំព័រផ្សេងរមូរមិនកើត។ Test៖ **`page-nav-test.js`** (`history-expanded`)។
- **ធនធានចាំបាច់ដែលមកពី origin ខាងក្រៅ ហើយ service worker មិន cache** ➜ App បើកបាន
  តែមុខងារនោះស្លាប់ស្ងាត់ៗពេលបណ្តាញខ្សោយ។ រកឃើញលើ ZXing (ការស្កេន)។
  Test៖ **`offline-shell-test.js`** (បិទម៉ាស៊ីនបម្រើពិត រួចផ្ទុកឡើងវិញ)។
- **ការឌិកូដស៊ុមវីដេអូដដែលពីរដង** ➜ ជាន់ការពារ «២ ស៊ុមជាប់គ្នា» ក្លាយជា ១ ស៊ុម។
  `takeFreshVideoFrame()` ការពារ **ហើយ fail open** បើ `currentTime` មិនរត់ (browser ខ្លះ
  ទុកវាថេរលើ MediaStream) — ការ fail closed នឹងបិទការស្កេនទាំងស្រុង។
  Test៖ **`scan-engine-test.js`**។

## Error patterns ដែលរំពឹងទុក — កុំ «កែ» ពួកវា

- `"<X> timed out"` — `withTimeout()` guard ដោយចេតនា (15-20s) ជុំវិញការអាន Firebase។
  មាន toast និង fallback រួចហើយ។ Error ត្រូវសាងឡើង **synchronously នៅកន្លែងហៅ** ដោយចេតនា
  ដើម្បីឲ្យ stack trace បង្ហាញអ្នកហៅពិត — កុំ «សម្រួល» វាត្រឡប់វិញ។
- `permission_denied` ពេល `repoRerunTransactionQueue` / ពេលភ្ជាប់ឡើងវិញ — transaction ក្រៅបណ្តាញ
  ដែល replay ក្រោយស្ថានភាព auth/rules ប្រែ។ មាន `.catch()` + toast រួចហើយ។
- `"Daily/Monthly revenue underflow clamped to 0"` — សំណាញ់សុវត្ថិភាពដោយចេតនា។ បើវាបាញ់
  **ញឹកញាប់សម្រាប់ថ្ងៃ/ខែដដែល** នោះជាសញ្ញានៃការដកស្ទួនខាងលើ — តែ capture ខ្លួនវាមិនមែនកំហុសទេ។
- **«⚠️ ទិន្នន័យនេះលែងមានក្នុងប្រព័ន្ធ! ស្ថិតិត្រូវបានកែតម្រូវវិញ។»** — សំណាញ់សុវត្ថិភាពពេល
  transaction រកឃើញថា item លែងមានលើ server (ការសម្អាត 2h/8d ទើបផ្លាស់វា ឬឧបករណ៍ផ្សេងលុបវា)។
  **មិនមែនកំហុសទេ។** បើវាលោតញឹកញាប់ ➜ ពិនិត្យនាឡិកាឧបករណ៍។

## Style conventions

- JS ក្នុង `app.js`/`license-verify.js` **គ្មាន comment** ដោយទម្លាប់។ បើបន្ថែម comment ពេលធ្វើការ
  ត្រូវដកចេញមុនបញ្ចប់ — parse ដោយ `acorn`, លុប byte range របស់ comment, រួច re-tokenize
  ហើយ diff token-for-token ធៀបនឹងដើម ដើម្បីបញ្ជាក់ថាកូដមិនប្រែ (`audit-tools/trimws.js`)។
- `license-verify.js` byte-identical ទាំង ២ App ដោយការរចនា (embed public key + verification logic)។
- `CACHE_VERSION` របស់ service worker នីមួយៗតាមលំនាំ `<app>-vN` ហើយ filter សម្អាត cache
  ស្កេនតែ prefix របស់ខ្លួន — **កុំពង្រីក filter នោះ**។
- **jsPDF មិនអាច shape អក្សរខ្មែរបានទេ** — PDF export ប្រើ browser print-to-PDF ជំនួស។
  កុំនាំ jsPDF ត្រឡប់មកវិញសម្រាប់អក្សរខ្មែរ។
- **Export៖ លេខទូរស័ព្ទ និង barcode ត្រូវជា TEXT មិនមែនលេខ** — `XLSX.writeFile(..., { bookSST: true })`
  បូក `forceExportTextCells()` (`EXPORT_TEXT_COLUMN_INDEXES = [1, 2]`)។ បើបន្ថែម/ប្តូរលំដាប់ column
  ក្នុង `EXPORT_HEADERS` ត្រូវធ្វើបច្ចុប្បន្នភាព index ទាំងនោះ។ **កុំវិនិច្ឆ័យថ្នាក់កំហុសនេះ
  ពី cell object ក្នុងសតិ — ត្រូវពិនិត្យ XML ដែល emit ចេញ។**

## របៀបធ្វើ audit លើគម្រោងនេះ (runbook — session ថ្មីអានត្រង់នេះ)

### ជំហានទី ០ — រៀបចំ (ម្តងក្នុងមួយ session)
```bash
npm i acorn playwright-core xlsx
                                 # acorn៖ checker ស្តាទិច; playwright-core៖ តេស្ត browser
                                 # xlsx៖ ត្រួតពិនិត្យ XML ដែល Export emit ចេញ
                                                                  # បើគ្មាន ពួកវា SKIP ដោយស្អាត មិនធ្លាក់ទេ
bash audit-tools/run-all.sh      # រត់ការត្រួតពិនិត្យទាំងអស់ក្នុងពាក្យបញ្ជាតែមួយ
```
**រត់វាមុនចាប់ផ្តើម និងក្រោយកែរាល់ដង។** បើវាបៃតងទាំងអស់ នោះមានន័យថាកំហុសដែលបានដោះស្រាយរួច
មិនបានត្រឡប់មកវិញទេ។ ការត្រួតពិនិត្យ ១៣ ប្រើ **Chromium ពិត** — ត្រូវការ `playwright-core`។

### ជំហានទី ១ — កុំចាប់ផ្តើមដោយអានកូដពីដើមដល់ចប់
បទពិសោធន៍បង្ហាញច្បាស់៖ **កំហុសថ្មីស្ទើរតែមិនដែលរកឃើញដោយការអានកូដដដែលឡើងវិញទេ។** វារកឃើញដោយ៖
- **ឧបករណ៍ថ្នាក់ថ្មី** — សាង checker សម្រាប់ថ្នាក់កំហុសមួយ គឺជាការវិនិយោគល្អជាងគេ
- **កូដដែលទើប ship** — រត់ `git log --oneline <ចំណុចចុងក្រោយក្នុង CLAUDE.md>..HEAD` ជានិច្ច
  ដើម្បីរក commit ដែលមិនទាន់មានឯកសារ — នោះជាកូដដែលត្រួតពិនិត្យតិចជាងគេ
- **របាយការណ៍ពិតពីអ្នកប្រើ** (Sentry, វីដេអូ) — មានតម្លៃជាងការស្មានច្រើន

### ជំហានទី ២ — ថ្នាក់កំហុសដែលមានឧបករណ៍រួចហើយ (កុំរកដោយភ្នែក)
| ថ្នាក់ | ឧបករណ៍ |
|---|---|
| helper ចែករំលែក ZoeW↔ZoeKeyGen បែកគ្នា | `shared-fns.js` — **រត់នេះមុនគេ** |
| HTML↔JS មិនត្រូវគ្នា (id, `on*=`, `data-close`) | `wiring.js` |
| ទិន្នន័យអតិថិជនសល់ក្នុង DOM ក្រោយចាកចេញ | `dom-hygiene.js` |
| អថេរ state សល់ក្រោយចាកចេញ | `state-hygiene.js` |
| class គ្មានច្បាប់ CSS | `css-classes.js` |
| ច្បាប់ក្នុង `@media` ដែលស្លាប់ដោយច្បាប់មូលដ្ឋានក្រោយវា | `css-media-override.js` |
| animation ដែលបង្កើត layout/paint រាល់ស៊ុម និង `transition: all` | `animation-cost.js` |
| ការបង្ខំ layout ឡើងវិញក្នុង handler របស់ touch/scroll/rAF | `layout-thrash.js` |
| លក្ខខណ្ឌនៃចលនាផ្ទាំង ១:១ (កម្ពស់ស្មើគ្នា, snap ↔ PTR) | `panel-motion-test.js` |
| comment / trailing whitespace | `comments.js` |
| payload ដែលសរសេរទៅ Firebase ↔ schema ក្នុង rules | `payload-schema.js` |
| សរសេរ item ទាំងមូលពីសតិ | `stale-write.js` |
| `.then(A).catch(B)` ដែល B ជាការសង្គ្រោះ | `compensation-order.js` |
| កំហុស runtime ពេល boot (App ពិតក្នុង Chromium) | `boot-runtime.js` |
| អន្តរកម្ម UI ជម្រៅ + ការប្រណាំងឧបករណ៍ច្រើន + ផ្លូវបរាជ័យ | `ui-flow-test.js` |
| រចនាសម្ព័ន្ធទំព័រ/របា Slide/Locker/លុបទាំងអស់ | `page-nav-test.js` |
| CSS បំបែក / លើសទទឹង លើអេក្រង់តូច និងក្នុង modal | `layout-check.js` |
| រូបរាងវាលឆៅក្រៅពី `barcodes` (លេខជាចំនួន, null, XSS) | `field-shape-test.js` |
| invariant ចំណូល/ស្ថិតិ លើលំដាប់ចៃដន្យ | `revenue-fuzz-test.js` |
| ការសរសេរដែលចុះយឺតក្រោយ timeout | `slow-write-test.js` |
| ដំណើរការនៅទិន្នន័យធំ | `perf-check.js` |
| Setup Link៖ ZoeKeyGen encode ↔ App decode | `setup-link-roundtrip-test.js`, `setup-link-browser-test.js` |
| កាយវិការអូស + auto pull up នៃប្រអប់ស្វែងរក | `phone-search-swipe-test.js` |
| សារប្រអប់ PIN ត្រូវតាមប៊ូតុងដែលហៅ | `pin-prompt-test.js` |
| ការដោះសោដោយក្រយៅដៃ/មុខ (WebAuthn) | `biometric-unlock-test.js` |
| ការសរសេរទៅ localStorage/sessionStorage គ្មានការការពារ | `storage-guard.js` |
| credential សល់ក្នុង DOM + ការលាក់ secret មុនផ្ញើទៅ Sentry | `secret-hygiene.js` |
| pull-to-refresh និងការលាក់ navbar/tabbar តាមទិសរមូរ | `gesture-test.js` |
| លេខទូរស័ព្ទ/Barcode ត្រូវជា TEXT ក្នុង XML របស់ Excel | `export-cells-test.js` |
| ល្បឿន, **ជួរអាន** និងភាពត្រឹមត្រូវនៃម៉ាស៊ីនស្កេន Barcode (រួមទាំងការអានលេខខុសឆ្លង format) | `scan-engine-test.js` |
| ការពឹងផ្អែកលើ CDN ដែលមិន cache ➜ ស្កេនមិនកើតពេលបណ្តាញដាច់ | `offline-shell-test.js` |
| ការទប់ស្កាត់ Barcode ស្ទួន (ជាន់ការពារទាំង ៥) | `duplicate-scan-test.js` |
| កាមេរ៉ាកកក្រោយប្រអប់ native (`confirm`/`alert`) | `camera-resume-test.js` |

ឧបករណ៍ខ្លះមាន allowlist (`ACCEPTED` / `EXPECTED_DIVERGENT` / `IGNORE`) ដែល **រាល់ធាតុមានហេតុផល
សរសេរជាប់**។ **កុំបន្ថែមធាតុដោយគ្មានការតាមដានពិត** — ធាតុគ្មានហេតុផលនឹងលាក់កំហុសបន្ទាប់។

### ជំហានទី ៣ — ច្បាប់សម្រាប់តេស្តគ្រប់ពេល
**តេស្តត្រូវតែដកកូដ *ពិត* ចេញពី `app.js` មករត់ក្នុង `vm` ឬក្នុង browser ពិត — កុំសរសេរតេស្ត
លើកូដចម្លង។** ហើយ **ត្រូវបញ្ជាក់ថាតេស្តមិនទទេ**៖
```bash
git fetch origin main                      # សំខាន់ — origin/main ក្នុង session អាចចាស់
rm -rf /tmp/baseline && mkdir /tmp/baseline
git archive origin/main | tar -x -C /tmp/baseline
bash audit-tools/run-all.sh /tmp/baseline  # ចំណុចដែល *គួរតែធ្លាក់* នឹងបង្ហាញ
```
បើតេស្តថ្មីជោគជ័យលើ tree មុនកែ នោះវាមិនចាប់អ្វីទេ — សរសេរវាឡើងវិញ។
*អន្ទាក់៖ ត្រូវ `git archive origin/main` មិនមែន `HEAD` ទេ បើបាន commit ការកែរួចហើយ។*

**Mutation ត្រូវតែពិត។** ការធ្វើ mutation ខ្សោយ (ឧ. កែតែ `&` ចោល `<` ពេលតេស្ត XSS)
ធ្វើឲ្យតេស្តជោគជ័យក្លែងក្លាយ។

### ជំហានទី ៤ — មុន commit
```bash
node --check <ឯកសារ .js ដែលកែ>
bash audit-tools/run-all.sh
```
រួច **bump `CACHE_VERSION`** ក្នុង `sw.js` នៃ App ណាដែល `app.js`/`index.html`/`style.css` ប្រែ។

### អន្ទាក់ក្នុង harness (ចំណាយពេលច្រើនម្តងហើយម្តងទៀត)
- **`snapshot.val()` ត្រូវត្រឡប់ច្បាប់ចម្លងជ្រៅ។** ការត្រឡប់ reference ធ្វើឲ្យទិន្នន័យក្នុងសតិ
  ក្លាយជា alias នៃ store ➜ ការកែត្រូវរាប់ពីរដង ➜ តេស្តរាយការណ៍កំហុសក្លែងក្លាយ។
- **អថេរ `let` កម្រិត module មិនស្ថិតលើ `window`។** ត្រូវអានតាមឈ្មោះទទេ
  (`typeof x !== 'undefined' ? x : {}`) ឬហៅតាម function។
- **Fake SDK ត្រូវគាំទ្រ `increment()`** — `commitRevenueFanout` ប្រើវា។ បើគ្មាន វា throw
  ហើយ invariant បែក (ធ្លាប់រាយការណ៍ខុសថាជាកំហុសផលិតផលម្តងហើយ)។
- **ការធ្វើតេស្តការប្រណាំងត្រូវដាក់ការសរសេររបស់ឧបករណ៍ផ្សេង *ក្នុងចន្លោះ* នៃការអាន និងការសរសេរ**
  មិនមែនក្រោយវាទេ បើមិនដូច្នេះតេស្តជោគជ័យក្លែងក្លាយ។
- **ប្រើ port ចៃដន្យ** (`listen(0)`) — ការរត់ ២ instance ស្របគ្នាធ្លាក់ដោយ `EADDRINUSE`
  ដែលមើលទៅដូចកំហុសកូដ។
- **`renderHistory` មាន cache តាមជួរ** (`tr.dataset.sig`) — ការវាស់ដំណើរការត្រូវលុប `sig`
  ចោលមុន បើមិនដូច្នេះវាវាស់តែផ្លូវ cache។

### Firebase RTDB emulator (សម្រាប់ការកែ rules តែប៉ុណ្ណោះ)
```bash
npm i firebase-tools
npx firebase setup:emulators:database     # ចាំបាច់ — ថត cache ទទេក្រោយ npm i
java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
cp firebase-database.rules.json audit-tools/emu/real.rules.json
bash audit-tools/emu/rules.sh
```
**អន្ទាក់ដែលចំណាយពេលច្រើនម្តងហើយម្តងទៀត៖**
- `emulators:start` របស់ CLI **upload rules មិនបាន** តាម proxy — រត់ jar ដោយផ្ទាល់
- ទាំង `.settings/rules.json` និង `auth_variable_override` ត្រូវការ
  `-H "Authorization: Bearer owner"` បើអត់ **rules នៅបើកចំហ ហើយតេស្តជោគជ័យក្លែងក្លាយ**
- សំណើដែលមាន `Bearer owner` **តែគ្មាន** `auth_variable_override` = ម្ចាស់ project ➜ **រំលង rules**។
  សម្រាប់តេស្ត «unauthenticated ត្រូវបានបដិសេធ» **កុំផ្ញើ Authorization header សោះ**
- `pkill -f firebase-database-emulator` ត្រូវនឹង command line របស់ shell ខ្លួនឯង ➜ សម្លាប់ session
- **ត្រូវ assert ថាការសរសេរដែលដឹងថាខុស ពិតជាត្រូវបានបដិសេធ** មុននឹងទុកចិត្តលទ្ធផលណាមួយ

## Firebase rules — រូបរាងបច្ចុប្បន្ន

`firebase-database.rules.json` (Business) ៖ root default-deny; គ្រប់ node ប្រើ `auth != null`
ជាការអនុញ្ញាតតែមួយ។ អ្វីដែលនៅសល់ជាការការពារពិត៖

- **schema validation** — ប្រភេទវាល, ជួរតម្លៃ, និង `$other: { ".validate": false }`
  ដែលបដិសេធវាលចម្លែក។ **កុំដកវាចេញ** — វាជាការការពារតែមួយប្រឆាំងទិន្នន័យខូច។
- **claim/witness fence** លើ `zoew_restore_finalizations` និង `zoew_clear_history_finalizations`
  ដែលការពារ Restore/Clear All replay និង revenue ស្ទួន។ **កុំដកវាចេញ។**

**ZoeKeyGen គ្មានប្រអប់ជ្រើសរើស App ទៀតទេ** — ប្រព័ន្ធមាន App តែមួយ (ZoeW) ដូច្នេះ
`generateLicenseKey()` និង `generateSetupLink()` ប្រើ `LICENSE_APP_CODE = 'ADM'` ដោយផ្ទាល់។
Base URL របស់ Setup Link ផ្ទុកឡើងវិញតាម `restoreSetupLinkBaseUrl()` ពេល boot
(កូនសោ localStorage `zoekeygen_setup_url_ADM` នៅដដែល)។

`ZoeKeyGen/firebase-database.rules.json` (License) នៅរក្សា `user_roles` និងតួនាទី `admin`
ដោយចេតនា — វាជា Project ដាច់ដោយឡែក ហើយ ZoeKeyGen ជាឧបករណ៍អ្នកលក់។

**`license_keys/$appCode/$keyId` អានបានជាសាធារណៈ (តែ `expiresAt` និង `revoked`)** ព្រោះ
`checkOnline()` ជា REST គ្មាន auth។ Metadata រសើប (`note`, `createdBy`, `issuedAt`, `scope`)
ស្ថិតក្នុង `license_keys_meta` ដែលអាន/សរសេរបានតែ admin។

## Lookup API និង Google Sheets

ZoeW អាចយកលេខទូរស័ព្ទ/COD/DOD ពី endpoint ខាងក្រៅពេលស្កេន។ Secret របស់ header ត្រូវ encrypt
ដោយកូនសោដែល derive ពី PIN។ **Salt PBKDF2 (`zoeadmin_pin_verify_v2`,
`zoeadmin_lookup_api_secret_v1`) ត្រូវរក្សាដដែល** — ការប្តូរវាធ្វើឲ្យ PIN និង secret
ដែលរក្សាទុករួចលើឧបករណ៍ទាំងអស់ខូច។ ដូចគ្នាដែរ **`LICENSE_APP_CODE = 'ADM'`** ត្រូវរក្សាដដែល —
ការប្តូរវាធ្វើឲ្យ Activation Key ដែលចេញរួចទាំងអស់ខូច។

`Code.gs` **fail closed**៖ បើ ScriptProperty `API_KEY` មិនបានកំណត់ វាបដិសេធសំណើ។

## Setup Link — ការ provision ឧបករណ៍

ZoeKeyGen បង្កើត `https://<app-site>/?setup=<base64-config>` បូក QR។ នៅខាង App
`applySetupLinkFromUrl()` decode វា រួច **ឆ្លងកាត់ PIN gate ដដែលនឹងការកែ Config ដោយដៃ**
មុនបំពេញចូល textarea — **គ្មានផ្លូវរក្សាទុកស្វ័យប្រវត្តិទេ**។ Query string ត្រូវលុបចេញភ្លាម
តាម `history.replaceState` ទោះអ្នកប្រើយល់ព្រមឬអត់។

Setup Link ដែលបើកចោល **មិនត្រូវរស់រានក្រោយចាកចេញ** (វានឹងបំពេញ config អាជីវកម្មផ្សេងចូល
ការបើក Config លើកក្រោយ) — តែ Setup Link ដែលអ្នកប្រើ **កំពុងវាយ PIN ពិតៗ** មិនត្រូវបោះចោល។
`isPinFlowPending()` ជាអ្នកបែងចែក។ Test៖ `setup-link-logout-test.js`។

## Firebase Backup Tool

`firebase-backup/` ជា Node.js CLI ដាច់ដោយឡែក (មិនមែនផ្នែកនៃ App) ដែលអ្នកលក់រត់ខ្លួនឯង
ដោយប្រើ `firebase-admin` និង service-account key ក្នុងមួយជំនួញ។ `config.json`, `secrets/`
និង `backups/` ស្ថិតក្នុង `.gitignore` — **service-account key ជា credential ពិត កុំ commit វា**។

Backup សរសេរទៅ `.partial` រួច `rename()` ចូលកន្លែង ដូច្នេះការរត់ដែលដាច់ពាក់កណ្តាល
មិនបន្សល់ `.json.gz` កាត់ខ្លីដែលមើលទៅដូច backup ល្អទេ។
