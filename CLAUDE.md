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
> ៩. **រាល់ការឡើងកំណែត្រូវបន្ថែមផ្នែកថ្មីក្នុង `CHANGELOG.md` ក្នុង commit ដដែល** —
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

**Layout៖ ទំព័រនីមួយៗមាន `.page-side` និង `.page-main`។** លើទូរស័ព្ទវាជា flex column ដាក់ជង់គ្នា;
លើអេក្រង់ **≥992px** វាក្លាយជា grid ២ ជួរ (`380px` + សល់) ពេញកម្ពស់អេក្រង់ ហើយរបា Tab
ផ្លាស់ពីក្រោមទៅជាបន្ទាត់នៅក្រោម navbar តាម `order`។ `layout-check.js` ត្រួតពិនិត្យទាំង
320/360/412/768px និង **1280/1440px**។

**របា Slide បិទត្រូវមាន `visibility: hidden`** — បើមិនដូច្នេះ `layout-check.js` រាយវាថាលើសអេក្រង់
(វា `translateX(-100%)`) ហើយវាក៏អាច tab ចូលបានទៀតផង។

**កាយវិការអូស លើទូរស័ព្ទ (<992px) — `setupSwipeGestures()`។** ទំព័រទិន្នន័យមាន
`#dataSideSection` (`.page-side`) និង `#dataMainSection` (`.page-main`) បូកដងអូស `#dragHandle`៖

- អូស/scroll **ឡើង** លើ `#dataMainSection` ➜ `#dataSideSection` ទទួល `.collapsed` ➜ ប្រវត្តិហូតឡើងពេញអេក្រង់
- អូស **ចុះ** ពេលតារាងនៅកំពូល ➜ ដក `.collapsed` ➜ ផ្ទាំងខាងលើត្រឡប់មកវិញ
- ចុច `#dragHandle` ➜ toggle ដោយចេតនាច្បាស់លាស់ (ដំណើរការទោះកំពុងស្វែងរក)
- **ការអូសឡើង មិនត្រូវបិទផ្ទាំង ពេលអ្នកប្រើកំពុងស្វែងរកលេខទូរស័ព្ទទេ** (`phoneSearchIsActive()`)
  — បើមិនដូច្នេះ អ្វីដែលគេកំពុងវាយបាត់ពីអេក្រង់

**Auto pull up — `setPhoneSearchPulledUp()`។** ចុច (focus) ប្រអប់ស្វែងរកលេខទូរស័ព្ទ ➜
`#dataSideSection` ទទួល `.search-focus` ដែលបង្រួមកាតខាងលើទាំងអស់ ទុកតែប្រអប់ស្វែងរក
ហូតឡើងក្រោម navbar (CSS៖ `.page-side.search-focus > *:not(:last-child)`)។
**ដូច្នេះកាតស្វែងរកត្រូវតែនៅជា child ចុងក្រោយរបស់ `.page-side`** — បើបន្ថែមកាតក្រោយវា មុខងារនេះខូច។
blur ដោយប្រអប់ទទេ ឬចាកចេញ ឬប្តូរទំព័រ ➜ ដោះវិញ។ លើ **≥992px វាមិនធ្វើអ្វីទេ**
ព្រោះ layout ២ ជួរឃើញគ្រប់យ៉ាងស្រាប់។ Test៖ **`phone-search-swipe-test.js`**។

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
npm i acorn playwright-core xlsx @zxing/library@0.23.0
                                 # acorn៖ checker ស្តាទិច; playwright-core៖ តេស្ត browser
                                 # xlsx៖ ត្រួតពិនិត្យ XML ដែល Export emit ចេញ
                                 # @zxing/library៖ វាស់ល្បឿនម៉ាស៊ីនស្កេន (កំណែដូច index.html)
                                 # បើគ្មាន ពួកវា SKIP ដោយស្អាត មិនធ្លាក់ទេ
bash audit-tools/run-all.sh      # រត់ការត្រួតពិនិត្យទាំងអស់ក្នុងពាក្យបញ្ជាតែមួយ
```
**រត់វាមុនចាប់ផ្តើម និងក្រោយកែរាល់ដង។** បើវាបៃតងទាំងអស់ នោះមានន័យថាកំហុសដែលបានដោះស្រាយរួច
មិនបានត្រឡប់មកវិញទេ។ ការត្រួតពិនិត្យ ៨ ប្រើ **Chromium ពិត** — ត្រូវការ `playwright-core`។

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
| ល្បឿនម៉ាស៊ីនស្កេន Barcode (ផ្លូវ ZXing ដែល iPhone ប្រើ) | `scan-engine-test.js` |

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
