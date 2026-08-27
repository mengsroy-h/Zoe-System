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
> ៦. **កំណែ App (`APP_VERSION`) ជារបស់ App នីមួយៗ — ⛔ ឡើងតែ App ដែលកែពិត។**
>    មុនកំណែ 2.19.4 ZoeW និង ZoeKeyGen ត្រូវបង្ខំឲ្យមានកំណែដូចគ្នា ➜ ជុំដែលកែតែ
>    App មួយ បង្ខំ App មួយទៀតឲ្យឡើង `CACHE_VERSION` ➜ **អ្នកប្រើទាំងអស់របស់
>    App នោះទាញសំបកទាំងមូលឡើងវិញ** និង Netlify redeploy ដោយឥតប្រយោជន៍។
>    ឥឡូវអ្វីដែលត្រូវស៊ីគ្នាគឺ **ខាងក្នុង App នីមួយៗ**៖ `app.js` ↔
>    `manifest.json` ↔ `index.html`។ `version-bump-scope.js` ចាក់សោវា៖ កូដ
>    ship ប្រែ ➜ **ត្រូវ** ឡើង; គ្មានការកែពិត ➜ **មិនត្រូវ** ឡើង។ វា **មិនមែន**
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
> ១៣. **⛔ ការកត់ត្រាមិនមែនជាការអនុវត្តទេ។** មេរៀនណាដែលមិនមានឧបករណ៍
>    ចាក់សោ **នឹងត្រូវភ្លេចក្នុង session បន្ទាប់** — ភស្តុតាង៖ មេរៀន
>    «checker មិនបានពិនិត្យអ្វីសោះ» ត្រូវបានសរសេរក្នុងឯកសារនេះ **១៣ ដង**
>    ហើយវានៅតែកើតឡើងម្តងទៀត។ ដូច្នេះ៖ **រកឃើញកំហុស ➜ សាងឧបករណ៍ជាមុន ➜
>    បញ្ជាក់ថាវាធ្លាក់លើ tree មុនកែ ➜ ទើបកែកូដ**។ ការសរសេរប្រយោគព្រមាន
>    ជំនួសឧបករណ៍ គឺជាការធានាថាកំហុសនោះនឹងវិលមកវិញ។
>    មើលតារាង **«🔒 ច្បាប់ ➜ ឧបករណ៍»** ខាងក្រោមភ្លាម។
>
> ១២. **⛔ ពេលចប់រាល់ជុំ audit ឬការកែកូដ ត្រូវរត់ `node audit-tools/strip-comments.js`**
>    ដើម្បីសម្អាត comment ចេញពី **កូដ App ដែល ship ទាំងអស់** (`ZoeW/` · `ZoeKeyGen/` ·
>    `ZoeImport/` — ទាំង `.js` និង `.css`)។ ចំណេះដឹងត្រូវរស់នៅក្នុង **`CLAUDE.md`
>    និង `README.md`** មិនមែនក្នុងកូដទេ។ ឧបករណ៍នេះផ្ទៀងផ្ទាត់ថាការសម្អាត
>    **មិនប្តូរកូដ** (JS៖ diff token-for-token; CSS៖ diff declaration stream)
>    ហើយបោះបង់ឯកសារណាដែលមិនប្រាកដ។ `comments.js` អះអាងលទ្ធផលនោះ។
>    **លើកលែង** ៖ `audit-tools/` និង `*/test.js` (មិន ship ហើយ comment របស់ពួកវា
>    ជាការពិពណ៌នាថ្នាក់កំហុសដែលឯកសារនេះយោងដល់) និង `vendor/`, `qrcode.js` (library ខាងក្រៅ)។
>
> ១១. **⛔ កុំប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ភាពរលូននៃការរមូរ ដោយគ្មានការស្នើច្បាស់លាស់។**
>    នេះជា **តំបន់ថ្លៃបំផុតក្នុងគម្រោង** — អានផ្នែក «⛔ តំបន់ហាមចូល» ខាងក្រោមភ្លាម
>    មុននឹងកែ `style.css` ឬ function ណាមួយដែលទាក់ទងនឹងកាយវិការ។
>
> ### ⛔ តំបន់ហាមចូល — PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ
>
> **អ្នកប្រើបានស្នើដោយផ្ទាល់ឲ្យកត់ត្រាចំណុចនេះទុក** (2026-08-25)៖ បី​តំបន់នេះ
> «ពិបាកកែជាងគេ» ហើយត្រូវការច្រើនជុំទំរាំត្រូវ។ ប្រវត្តិ git បញ្ជាក់វា —
> **~១១ ជុំ** និង **ការថយក្រោយ ២ ដង**៖
>
> | កំណែ | អ្វីកើតឡើង |
> |---|---|
> | 2.5.0 `0f6a184` | រមូរលែងគាំង, របា Tab លែងបាំងកាតប្រវត្តិ |
> | 2.8.0 `485d795` | ការរមូរបញ្ជីលែងអាចត្រូវបង្អាក់បាន |
> | 2.8.1 `a1038a5` | **ថយក្រោយទៅ 2.7.0 ទាំងស្រុង** រួចកែ iOS ដោយប្តូរតែរបៀបវាស់ |
> | — `661ad27` | hotfix ៖ ស្ថេរភាព PTR លើ iOS (branch ដាច់ដោយឡែក) |
> | — `0afa229` | hotfix ៖ ការរមូរ iOS + បិទ PTR ពេលប្រវត្តិពេញអេក្រង់ |
> | — `ec9772d` | hotfix ៖ **កែ PTR លើ Safari ឲ្យដំណើរការវិញ** — ការថយក្រោយពី hotfix មុន |
> | 2.8.5 `0af39c5` | ការអូស និងការរមូរឆ្លើយតបលឿនជាងមុន |
> | 2.9.0 `0be5848` | ផ្ទាំងប្រវត្តិរអិលតាមម្រាមដៃ ជំនួសការលោត |
> | 2.11.2 `be3f417` | ផ្លូវ iOS ដាច់ដោយឡែក — កាតធ្លាក់មកបំពេញវិញ |
> | 2.11.3 `f8e0c67` | កែ iOS nested scroll handoff — **ហើយដកចលនា FLIP ចេញដោយសង្ស័យ** |
> | 2.11.4 `27d18ba` | **ប្រគល់ចលនាមកវិញ** ព្រោះ 2.11.3 ធ្វើឲ្យ iPhone លោត (0px ធៀប Android 357px) |
>
> **មេរៀនពី 2.11.3 ➜ 2.11.4 គឺជាមេរៀនសំខាន់បំផុត៖** ជុំនោះបានដកចលនាចេញ
> **ដោយផ្អែកលើការសង្ស័យតាមទ្រឹស្តី** អំពី `scroll-snap` ដោយគ្មានការវាស់ ➜
> អ្នកប្រើរាយការណ៍ថា «មើលទៅដូច App ២ ផ្សេងគ្នា» ➜ ជុំបន្ទាប់ត្រូវប្រគល់វាមកវិញ។
> ដំណោះស្រាយត្រឹមត្រូវគឺ **ផ្អាក snap** មិនមែនដកចលនា។
>
> **ច្បាប់សម្រាប់ session បន្ទាប់៖**
> - តំបន់ទាំងនេះ **ត្រូវបានផ្ទៀងផ្ទាត់លើ iPhone និង Android ពិតរួចហើយ** —
>   **វាមិនមែនជាកូដដែលមិនទាន់សាកទេ**។ កុំ «កែ» វាដោយផ្អែកលើការសង្ស័យ
>   ការអានកូដ ឬទ្រឹស្តីអំពី WebKit។
> - បើ `run-all.sh` **បៃតង** នោះមិនមានអ្វីត្រូវកែក្នុងតំបន់នេះទេ។
>   `gesture-test.js` (107), `panel-motion-test.js` (47), `ios-panel-glide-test.js` (32)
>   និង `phone-search-swipe-test.js` (67) ចាក់សោវាទុករួចហើយ។
> - កែបានតែពេល **អ្នកប្រើរាយការណ៍បញ្ហាពិត** (វីដេអូ ឬការពិពណ៌នាជាក់លាក់) ប៉ុណ្ណោះ។
> - បើចាំបាច់ត្រូវប៉ះមែន ៖ អាន «របៀបស្តារចលនា 2.9.0 វិញ» (តារាងចំណុច ៥)
>   និងផ្នែក iOS handoff ឲ្យចប់សិន, រួច **វាស់** iOS ធៀប Android ដោយផ្ទាល់ —
>   កុំសន្មត់។ ហើយត្រូវសាកលើ **ឧបករណ៍ពិតទាំង ២ ប្រព័ន្ធ** មុន merge។
>
> ✅ **កំណែ 2.11.6 ផ្ទៀងផ្ទាត់លើ iPhone និង Android ពិតរួចហើយ** (2026-08-25) —
> អ្នកប្រើបញ្ជាក់ថា PTR, ចលនាផ្ទាំងប្រវត្តិ និងការរមូរ «រលូនទាំង ២ ប្រព័ន្ធ»
> ជាមួយកូនសោ cache ថ្មីរបស់ `sw.js`, ការស្តារ listener និងផ្លូវបណ្តាញថ្មីរបស់
> `license-verify.js`។
>
> ✅ **កំណែ 2.17.0 មិនប៉ះតំបន់នេះទេ** (2026-08-25) — ការកែទម្រង់របស់វា
> ស្ថិតក្នុង `@media (min-width: 700px)` និង `(min-width: 992px)` តែប៉ុណ្ណោះ
> ដូច្នេះ **ទូរស័ព្ទ `< 700px` នៅដដែលបេះបិទ** ហើយអ្នកប្រើបានបញ្ជាក់រឿងនោះ
> លើឧបករណ៍ពិត។ `gesture-test.js` · `panel-motion-test.js` ·
> `ios-panel-glide-test.js` · `phone-search-swipe-test.js` នៅបៃតងដដែល។
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
> - **`zto-import/google-sheets-api/Code.gs` ជា template** — ការកែក្នុង repo មិនប្តូរ script ដែល deploy រួច។
>   (ធ្លាប់នៅ `ZoeW/google-sheets-api/` — ផ្លាស់ចេញព្រោះវាមិនមែនជាផ្នែករបស់ static site របស់ ZoeW ទេ។)


---

## 🔒 ច្បាប់ ➜ ឧបករណ៍ដែលចាក់សោវា (អានតារាងនេះមុនជឿច្បាប់ណាមួយ)

> **ការកត់ត្រាមិនមែនជាការអនុវត្តទេ។** មេរៀន «checker មិនបានពិនិត្យអ្វីសោះ»
> ត្រូវបានសរសេរក្នុងឯកសារនេះ **១៣ ដង** ឆ្លងកាត់ ៥ កំណែ — ហើយវានៅតែកើតឡើង
> ជុំបន្ទាប់រៀងរាល់ដង។ មានតែ **ឧបករណ៍ដែលធ្វើឲ្យ `run-all.sh` ធ្លាក់** ទេ
> ដែលទប់បាន។ ដូច្នេះរាល់ច្បាប់ខាងក្រោមមានជួរ «ឧបករណ៍»។
>
> **📝 = គ្មានឧបករណ៍ចាក់សោ** ➜ ច្បាប់នោះពឹងលើការប្រុងប្រយ័ត្នរបស់មនុស្ស
> តែម្យ៉ាង ➜ **វាជាកន្លែងដែលកំហុសបន្ទាប់នឹងកើត**។ បើអ្នកប៉ះតំបន់ 📝
> ណាមួយ សូមសាងឧបករណ៍ជាមុនសិន។

| តំបន់ | ច្បាប់ខ្លី | ឧបករណ៍ |
|---|---|---|
| **ឧបករណ៍ខ្លួនវា** | checker ត្រូវ **អាចធ្លាក់បាន** — ថតទទេ ➜ គ្មានមួយណាបៃតង | `checker-coverage.js` |
| **ឧបករណ៍ខ្លួនវា** | checker ត្រូវ **អាចធ្លាក់បាន ក្នុងពេលកំណត់** — ការព្យួរ ≠ ការធ្លាក់ | `hang-guard.js` |
| **ឧបករណ៍ខ្លួនវា** | ⛔ CI មិនត្រូវរត់ checker ដែល `run-all.sh` មិនរត់ | `checker-coverage.js` |
| លុប ទល់នឹង ដក | `isDeducted` ជាវាល **តែមួយ** ដែលកំណត់លុយ | `policy-test` · `revenue-fuzz` |
| ធុងសំរាម · `trashReason` | ស្លាកបង្ហាញ ≠ ការសម្រេចលុយ | `trash-modal-test` · `restore-marker-hygiene-test` |
| **ស្ថិតិយក** ៖ អតិថិជន ↔ កញ្ចប់ | រាប់លើ **មូលដ្ឋានតែមួយ** (barcode បិទ) | `pickup-ledger-test` |
| **Reset ស្ថិតិយក** តាមតម្រង | node ត្រូវ **នៅមាន** ជាមួយ `0` · គោរពតម្រង · មិនប៉ះលុយ | `pickup-reset-test` |
| សម្អាត ២ម៉ោង/៨ថ្ងៃ | ដើរតាម **barcode** មិនមែនកញ្ចប់ | `partial-pickup-cleanup-test` |
| Rules fence · deadlock | witness មិនត្រូវចាក់សោ id | `emu/restore-deadlock-test` |
| នាឡិកា | retention ប្រើ `getServerNow()` មិនមែន `Date.now()` | `clock-hygiene` |
| ការតភ្ជាប់ · ស្តារ | listener ដែលធ្លាក់ត្រូវត្រឡប់មកវិញ; SDK ស្តារបានពិត | `connection-recovery-test` |
| **អ្នកតាមដានវឌ្ឍនភាព** | ⛔ ការសួរមិនត្រូវលេបភស្តុតាង (idempotent) | `connection-recovery-test` |
| **កូនសោដែលសួរ ↔ កូនសោដែលដាក់ចូល** | ⛔ ការការពារដែលងាប់ = គ្មានការការពារ | `listener-pending-key-test` |
| ជណ្តើរភ្ជាប់ឡើងវិញ | វដ្តមិនត្រូវកាត់ handshake | `reconnect-ladder-test` |
| Timeout · retry | រាល់ `fetch` ត្រូវ abort ពិត | `network-timeout-test` |
| សម្ពាធបណ្តាញ | ពិដានចំនួនស្របគ្នា | `network-pressure` · `license-network-pressure` |
| Service worker | cache-first; Cache API បរាជ័យ ≠ App ដាច់ | `sw-cache-failure-test` · `sw-shell-latency` · `sw-install-integrity` · `sw-cache-key` · `sw-revalidate-pressure` · `offline-shell` |
| CSP | គ្មាន `on*=`; ធនធានផ្ទុកយឺតត្រូវឆ្លង CSP | `csp-enforced-test` · `csp-lazy-resource-test` |
| XSS | រាល់តម្លៃចូល HTML ត្រូវ `sanitizeInput()` (**ទាំង ២ ទម្រង់**) | `html-sink-escaping` · `inline-handler-xss-test` |
| ការលេចធ្លាយ secret | redaction ដើរលើ event ទាំងមូល | `secret-hygiene` |
| DOM · state ក្រោយចាកចេញ | គ្មានទិន្នន័យអតិថិជនសល់ | `dom-hygiene` · `state-hygiene` · `setup-link-logout-test` |
| PTR · ចលនាផ្ទាំង · រមូរ | ⛔ កុំប៉ះដោយគ្មានការស្នើ | `gesture-test` · `panel-motion-test` · `ios-panel-glide-test` · `phone-search-swipe-test` |
| ទម្រង់បង្ហាញ | អះអាង **២ ខាង** (មិនលើស **និង** មិនច្របាច់) | `layout-check` · `fluid-type-focus-test` |
| Toast និយាយការពិត | «ភ្ជាប់រួច» ≠ «ទិន្នន័យមកដល់» ≠ «នៅចូលប្រព័ន្ធ» | `toast-truth-test` |
| helper ចែករំលែក ២ App | byte-identical លើកលែងបញ្ជីដែលមានហេតុផល | `shared-fns` |
| `fb.X` ដែល loader មិន export | `undefined` ស្ងាត់លើផលិតកម្ម | `sdk-surface` |
| កំណែ App | `app.js` ↔ `manifest.json` ↔ `index.html` **ក្នុង App នីមួយៗ** | `version-check` |
| **វិសាលភាពនៃការឡើងកំណែ** | ⛔ ឡើងតែ App ដែលកែពិត (កុំបង្ខំអ្នកប្រើទាញឡើងវិញ) | `version-bump-scope` |
| License ↔ crypto | ⛔ «ផ្ទៀងផ្ទាត់មិនបាន» ≠ «ហត្ថលេខាខុស» — កុំលុប record | `license-grace-test` |
| **License ↔ នាឡិកា** | ⛔ នាឡិកាដែលមិន sync **មិនអាចលុប** record បានទេ | `license-grace-test` |
| ការការពារ inspect element | ⛔ ពង្រឹងមិនបានទេ — កុំព្យាយាម | 📝 (រចនាសម្ព័ន្ធ) |
| **អ្នកប្រើសរសេរតួលេខ revenue ដោយផ្ទាល់** | ទទួលយកដោយចេតនា (គ្មាន backend) | 📝 |
| **តំបន់ម៉ោងឧបករណ៍កំណត់ថ្ងៃចំណូល** | ទទួលយកដោយចេតនា | 📝 |
| **`zto-import` · Apps Script** | ការកែក្នុង repo មិនប្តូរ script ដែល deploy រួច | 📝 |

### ⛔ ស្ថិតិ «យក» ៖ អតិថិជន និងកញ្ចប់ ត្រូវរាប់លើ **មូលដ្ឋានតែមួយ** — កំណែ 2.19.4

> 🔴 **កំហុសផលិតកម្មពិត។** បើកកញ្ចប់ដែលយករួច ➜ កញ្ចប់ត្រឡប់ 0 ត្រឹមត្រូវ
> តែ **ចំនួនអតិថិជនជាប់គាំង**។

មុន 2.19.4 លេខទាំង ២ រាប់លើមូលដ្ឋានពីរខុសគ្នា៖

| លេខ | មូលដ្ឋាន | រស់រានឆ្លងកាត់ការ merge? |
|---|---|---|
| កញ្ចប់យក | **barcode** ដែលបិទ | ✅ បាទ |
| អតិថិជនយក | ស្ថានភាព **«item បិទពេញ»** | ❌ ទេ — ការ merge បំផ្លាញវា |

`applyRestoreMergeInto()` (ការស្តារពីធុងសំរាម) merge កញ្ចប់តាមលេខទូរស័ព្ទ ➜
item លែងបិទពេញ **ដោយមិនបញ្ចេញ delta** ➜ `+1` ដើមគ្មាន `-1` ផ្គូផ្គង។

**ច្បាប់ (សម្រេចដោយអ្នកប្រើ)**៖
- **អតិថិជន = លេខទូរស័ព្ទផ្សេងៗគ្នាដែលមាន barcode បិទ >= ១**។ លេខ ១ ស្មើ
  អតិថិជន ១ ទោះមានកញ្ចប់ ១០។
- **កញ្ចប់ = ចំនួន barcode បិទ**។
- ដូច្នេះ `pickedUpPhones[key]` រាប់ **barcode បិទ** ហើយ **delta អតិថិជន
  ត្រូវចម្លងចេញពី delta កញ្ចប់** គ្រប់កន្លែង (`pickupCustomerDelta =
  pickupPackageDelta;` និង `serverCustomerDelta = serverPackageDelta;`)។
- ⛔ **អថេរ**៖ `sum(pickedUpPhones) === packagesPickedUp`។
- ការប្តូរលេខទូរស័ព្ទផ្លាស់ ref តាម `closedBarcodeCount(item)` **មិនមែន ±1**។
- ការ merge ស្កេន **មិនបញ្ចេញ delta** — វាមិនប្តូរ barcode ណាមួយទេ។

⚠️ **មេរៀនអំពីឧបករណ៍**៖ ការប្រៀបធៀបអាគុយម៉ង់តាម **ឈ្មោះ** មិនគ្រប់គ្រាន់ទេ
(`-pickupCustomerDelta` ធៀប `-pickupPackageDelta` ជាឈ្មោះខុស តម្លៃដូច)។
ត្រូវអះអាង **ការផ្តល់តម្លៃ** និង **ឥរិយាបថ** ជំនួស។

Test៖ **`pickup-ledger-test.js`** (13 assertion, ធ្លាក់ ៦ លើ tree មុនកែ)។

### ⛔ Reset ស្ថិតិ «យក» ៖ node ត្រូវ **នៅមាន** ជាមួយ `0` — កំណែ 2.20.0

ប៊ូតុង «♻️ Reset ចំនួនយករួច» ក្នុងម៉ឺនុយ (...) Reset លេខ **អតិថិជនយក** និង
**កញ្ចប់យក** ត្រឹម **តម្រងថ្ងៃដែលកំពុងឈរលើ** (ការពារដោយ PIN, គ្រាប់ចុច
`resetPickup`)។

⛔ **អន្ទាក់ដែលមើលមិនឃើញពីការអានផ្លូវសរសេរ។** `updateDailyScheduleStats()`
អានលេខយករួចពី `dailyPickupData[targetDateKey]` **តែពេល node នោះមាន**៖

```js
if (!isSearchScoped && targetDateKey && dailyPickupData[targetDateKey]) { … }
else { selectedClosedCount = new Set(filteredList.filter(i => i.isClosed)…).size; }
```

ដូច្នេះ Reset ដែល **លុប node ចោល** (`return null` ក្នុង transaction) ➜ ការ
បង្ហាញ **ធ្លាក់ទៅរាប់ពីប្រវត្តិវិញ** ➜ លេខ **លោតត្រឡប់មកវិញភ្លាមៗ** ព្រោះ
barcode នៅតែបិទ។ ត្រូវសរសេរ **`{ packagesPickedUp: 0 }`** — node ដែល *មាន*
តម្លៃ 0។

ច្បាប់៖

- **`getFilterTargetDateKey()` ជាមូលដ្ឋានថ្ងៃ *តែមួយ*** — ទាំងការបង្ហាញ
  (`updateDailyScheduleStats`) និងការ Reset (`getPickupResetTargetDates`)
  ត្រូវអានពីវា។ ⛔ កុំគណនាថ្ងៃឡើងវិញក្នុងផ្លូវណាមួយ (គ្មាន `setDate` ស្ទួន)
  — នោះជាថ្នាក់កំហុសដដែលនឹង 2.19.4៖ លេខដែលឃើញ និងថ្ងៃដែល Reset ឃ្លាតគ្នា។
- ⛔ **លុយមិនត្រូវប៉ះ។** `isDeducted` នៅតែជាវាល *តែមួយគត់* ដែលកំណត់លុយ។
  ការ Reset សរសេរតែក្រោម `zoew_daily_pickup_cod_dod/` — គ្មានការសរសេរទៅ
  `zoew_daily_revenue_cod_dod` / `zoew_monthly_revenue_cod_dod` ឡើយ ហើយ
  barcode ដែលបិទ **នៅតែបិទ** (បញ្ជី ប្រវត្តិ និងធុងសំរាមមិនប្រែ)។
- **អថេរ `sum(pickedUpPhones) === packagesPickedUp` ត្រូវនៅតែកាន់** (0 === 0)។
- ការបរាជ័យ **មិនត្រូវអះអាងជោគជ័យ** — ថ្ងៃដែល transaction បរាជ័យ មិនត្រូវ
  សម្អាតក្នុងសតិ; toast ត្រូវជា ❌/⚠️។ `pickupResetInFlight` ត្រូវដោះក្នុង
  `resetClearHistoryOperationState()` ➜ ការចាកចេញកណ្តាលផ្លូវមិនបន្សល់សោជាប់។
- `planPickupLedgerRepair()` **មិនដកការ Reset វិញទេ** — វាជួសជុលតែពេល
  `bucket.total === recordedPackages`; ក្រោយ Reset លេខនោះជា 0 ខណៈ barcode
  បិទនៅមាន ➜ វារំលង។ ការកែ helper នោះត្រូវរក្សាលក្ខណៈនេះ។
- **Firebase rules មិនប្រែទេ** — `packagesPickedUp: 0` ស៊ីនឹង schema ដែលមាន
  ស្រាប់ (`newData.isNumber() && newData.val() >= 0`)។

Test៖ **`pickup-reset-test.js`** (49 assertion, ធ្លាក់ **២៨** លើ tree មុនកែ)។

### ⛔ «មិនអាចផ្ទៀងផ្ទាត់» ≠ «ខុស» — ច្បាប់ដែលអនុវត្តលើ **គ្រប់អ័ក្ស**

`license-verify.js` គោរពច្បាប់នេះលើអ័ក្ស **បណ្តាញ** តាំងពី 2.17.4៖ ការរំលង
ត្រឡប់ `{ ok: null }` មិនមែន `{ ok: false }` ព្រោះ `false` **លុប License
របស់អតិថិជន**។ ប៉ុន្តែអ័ក្ស **crypto** ត្រូវបានទុកចោល៖ `verifySignature()`
រុំ `crypto.subtle` ក្នុង try/catch រួចត្រឡប់ `false` ➜ ការដួលបណ្តោះអាសន្ន
របស់ WebCrypto មើលទៅដូច **ហត្ថលេខាក្លែងក្លាយ** ➜ record ត្រូវលុប។

ច្បាប់៖ រាល់ការពិនិត្យសុពលភាពត្រូវមាន **៣ លទ្ធផល** មិនមែន ២ — `valid` ·
`invalid` · **`unverified`**។ មានតែ `invalid` ទេដែលអាចលុបអ្វីមួយបាន។
`unverified` ➜ រក្សាទុក តែ **កុំផ្តល់សិទ្ធិថ្មី** (`activate()` បដិសេធ)។

**អ័ក្សទី ៣ — នាឡិកា (បិទក្នុងកំណែ 2.20.1)។** អ័ក្សបណ្តាញ និង crypto
ត្រូវបានបិទរួច តែ `getStatus()` នៅតែយក `getServerNow()` មកប្រៀបនឹង
`ceiling` រួច **លុប record របស់អតិថិជន**។ បញ្ហា៖ ពេល `checkOnline()`
ទៅដល់ server មិនបាន នោះ `serverTimeOffsetMs` នៅ `0` ➜ `getServerNow()`
គឺជា **នាឡិកាឧបករណ៍ឆៅ** ដែល **មិនអាចទុកចិត្តបាន**។ ទូរស័ព្ទដែលអស់ថ្ម
រួច boot ឡើងវិញ (ឬអ្នកប្រើប្តូរកាលបរិច្ឆេទដោយដៃ) ក្រឡុកទៅថ្ងៃខុស ➜
**License ដែលនៅមានសុពលភាព ត្រូវលុបជាអចិន្ត្រៃយ៍** ➜ ប្រអប់សុំ Key លោត
មកកណ្តាលការងារ (`LICENSE_RECHECK_INTERVAL_MS` = ១៥ នាទី)។

ដូច្នេះ៖ **ការលុបដែលមិនអាចត្រឡប់វិញបាន ត្រូវទាមទារនាឡិកាដែលទុកចិត្តបាន**
(`serverTimeSynced === true`) **ឬ** សាលក្រមរបស់ server (`online.ok === false`
ដែលដោះស្រាយខាងលើរួច)។ បើអត់ ➜ ត្រឡប់ `offline-grace-exceeded` —
**រក្សា record តែមិនផ្តល់សិទ្ធិ**។ ⛔ ចំណាំលំដាប់៖ `getStatus()` គណនា
`now` **ក្រោយ** `checkOnline()` ដោយចេតនា ព្រោះ header `Date` របស់សំណើនោះ
ជាអ្នក sync នាឡិកា ➜ ពេលមានបណ្តាញ ការសម្រេចប្រើម៉ោង server ពិត។
`activate()` ក៏ sync ជាមុនដែរ (`{ priority: true }`) ➜ Key ត្រឹមត្រូវលែង
ត្រូវបដិសេធថា «ផុតកំណត់» ដោយសារនាឡិកាទូរស័ព្ទ។ Test៖ **`license-grace-test.js`**។

### ⛔ អ្នកតាមដានវឌ្ឍនភាព មិនត្រូវលេបភស្តុតាងរបស់ខ្លួន (កំណែ 2.20.1)

> 🔴 **កំហុសពិត** — ថ្នាក់ដដែលនឹង 2.19.3 (ជណ្តើរកាត់ផ្តាច់ resync) ដែល
> វិលមកតាមទ្វារផ្សេង។

`dbListenerResyncIsProgressing()` ធ្លាប់សរសេរជាន់ `dbListenerPendingSeen`
**ខាងក្នុងការសួរ**៖

```js
if (dbListenerPendingPaths.size >= dbListenerPendingSeen) return false;
dbListenerPendingSeen = dbListenerPendingPaths.size;   // ⟵ លេបភស្តុតាង
return true;
```

➜ ការសួរទី ១ ត្រឡប់ `true`; ការសួរទី ២ **ក្នុង tick ដដែល** ត្រឡប់ `false`។
នោះមិនមែនករណីទ្រឹស្តីទេ — `setupConnectionRecovery()` ចុះឈ្មោះ
`retryFailedDbListenersNow()` លើ **ព្រឹត្តិការណ៍ ២** (`online` និង
`visibilitychange`) ហើយ **ការដោះសោទូរស័ព្ទខណៈ WiFi ទើបត្រឡប់មកវិញ** បាញ់
ទាំង ២ ក្នុងវិនាទីតែមួយ។ ការសួរទី ២ ធ្លាក់ទៅការពិនិត្យ
`DB_LISTENER_RETRY_MIN_GAP_MS` — ដែលក្នុង resync យឺត **ផុតកំណត់ស្រាប់** ➜
`initDatabaseListeners()` attach ឡើងវិញ ➜ បោះបង់ snapshot ដែលកំពុងទាញ។

វាស់បានលើកូដមុនកែ៖ **path ៣ ក្នុងចំណោម ៦ ជាប់រហូត** ខណៈស្លាកសរសេរ
«កំពុងភ្ជាប់ឡើងវិញ...» មិនចេះឈប់។

**ច្បាប់៖ កត់ត្រាការពិត នៅកន្លែងដែលវាកើតឡើង មិនមែននៅកន្លែងដែលវាត្រូវសួរ។**
វឌ្ឍនភាពឥឡូវជា **ត្រាពេលវេលា** (`dbListenerProgressAt`) ដែលសរសេរក្នុង
`noteDbListenerAlive()` ➜ ការសួរក្លាយជា **idempotent** (សួរ ១០ ដងក៏លទ្ធផល
ដដែល)។ `DB_LISTENER_PROGRESS_GRACE_MS` (២០ វិ.) ធ្វើឲ្យវាជាការ **ពន្យារ**
មិនមែនការ **ទប់** — resync ដែលស្លាប់ពិត នៅតែត្រូវ attach ឡើងវិញ។
⛔ `dbListenerProgressAt` ត្រូវ reset ជា `0` ក្នុង `initDatabaseListeners()`
(វឌ្ឍនភាពរបស់ជុំមុន មិនមែនភស្តុតាងអំពីជុំថ្មី) និងក្នុង
`resetDbListenerHealthState()`។

### ⛔ កូនសោដែលសួរ ត្រូវជាកូនសោដែលដាក់ចូល (កំណែ 2.20.1)

> 🔴 **កំហុសពិត** — ការការពារដែលមើលទៅដូចមាន តែជា `false` **ជានិច្ច**។

`initDatabaseListeners()` ដាក់ **កូនសោខ្លី** ៦ ចូល `dbListenerPendingPaths`
(`exchangeRate` · `dailyRevenue` · `monthlyRevenue` · `dailyPickup` ·
`history` · `deleted`) ប៉ុន្តែ `clearStaleRestoreMarkers()` និង
`dropStaleRestoreMarkers()` សួរដោយ **ឈ្មោះ path ពេញ**
(`'zoew_recently_deleted_cod_dod'`) ➜ ការការពារទាំង ២ **មិនដែលការពារអ្វីសោះ**។

ផលពិត៖ ចន្លោះរវាង snapshot «history» មកដល់ និង «deleted» មកដល់ (លើតំណយឺត
ឬធុងសំរាមធំ អាចជាច្រើនវិនាទី) `deletedItems` នៅ `[]`។ ក្នុងចន្លោះនោះ
`runAutomaticCleanupRules()` (រត់ ១២០ms ក្រោយ snapshot history តាម
`debouncedRenderAfterHistorySync` និងរាល់ ៦០ វិ.) រកមិនឃើញធាតុប្រភព ➜
សន្និដ្ឋានថា marker «ងាប់» ➜ **លុប `restoreClaimId`/`restoreClaimToken`
ចេញពីធាតុដែលឧបករណ៍ *ផ្សេង* កំពុងស្តារពិតៗ** ➜ `finalizeClaimedRestore`
ត្រូវ rules បដិសេធ ➜ ធាតុស្ទួននៅទាំង ២ node ➜ «ដក»/«លុប» **ស្លាប់ជារៀងរហូត**
(ថ្នាក់ដដែលនឹង 2.17.3)។

⚠️ `activeRestoreClaims` ការពារតែ claim របស់ **ឧបករណ៍នេះ** — ការការពារ
**ឆ្លងឧបករណ៍** ពឹងលើការមើលឃើញ `deletedItems` ទាំងស្រុង ដែលជាអ្វីដែល
ការការពារដែលងាប់នេះគួររង់ចាំ។

ច្បាប់៖ កូនសោត្រូវរស់នៅជា **ថេរតែមួយ** ដែលចែករំលែក —
`DB_LISTENER_KEYS` និង `DB_LISTENER_KEY_DELETED` — មិនមែនជា literal ដែល
សរសេរម្តងទៀតនៅកន្លែងសួរទេ។ Test៖ **`listener-pending-key-test.js`**
(ស្កេន App ទាំង ៣ រកលំនាំ `<set>.has(<literal>)` ដែលកូនសោមិនដែលត្រូវ
`.add()`, បូកការអះអាងឥរិយាបថក្នុង `vm` **២ ខាង**)។

### ⛔ redaction ត្រូវលាក់តាម **ឈ្មោះកូនសោវត្ថុ** ដែរ មិនមែនតែក្នុងខ្សែអក្សរ

`redactDeep()` ធ្លាប់លាក់តែលំនាំ `name=value` **ខាងក្នុងខ្សែអក្សរ** ➜ តម្លៃ
ដែលអង្គុយក្រោមកូនសោសម្ងាត់ (`{ pin: … }` · `{ apiKey: … }`) រអិលកាត់។
⛔ បញ្ជីឈ្មោះកូនសោត្រូវ **តូចជាង** បញ្ជី URL param៖ `key` · `auth` · `sig`
**មិនត្រូវរួម** ព្រោះវាធ្វើឲ្យ `keyId` ត្រូវលាក់ — ហើយ `barcode` និង
លេខសម្គាល់ធាតុ **ត្រូវការសម្រាប់ debug** (ច្បាប់ «keep case»)។

**ចន្លោះទី ២ (បិទក្នុង 2.20.1)៖ ការលាក់ធ្វើតែពេលតម្លៃជា `string`។**
`typeof value[k] === 'string'` ➜ secret ដែលមិនមែនជាខ្សែអក្សរ **រអិលកាត់
ទាំងស្រុង**៖ `{ pin: 1234 }` (PIN ជា **លេខ** — ទម្រង់ធម្មជាតិបំផុត),
`{ apiKey: [...] }`, `{ credential: {...} }`។ Sentry ចាប់ breadcrumb ដោយ
ស្វ័យប្រវត្តិ (console · fetch) ដូច្នេះតម្លៃទាំងនោះអាចមកពីកូដដែលអ្នកសរសេរ
មិនបានគ្រោងទុក។ ឥឡូវតម្លៃណាក៏ដោយក្រោមឈ្មោះកូនសោសម្ងាត់ត្រូវលាក់
(លើកលែង `null`/`undefined`/`function`)។ ⛔ ការអះអាងនៅតែ **២ ខាង** —
`keyId` · `count` · `closedAt` ជាលេខ **ត្រូវរក្សាទុក**។

### ⛔ សំណួរ ៤ មុនជឿថា checker ថ្មីមួយដំណើរការ

១. វាស្កេន **ឯកសារណា**ខ្លះ? (2.12.1 · 2.16.0 · 2.19.1)
២. វាស្កេន **ទម្រង់វេយ្យាករណ៍ណា**ខ្លះ? (2.19.3 — template literal ធៀបនឹងការតភ្ជាប់ខ្សែអក្សរ)
៣. វាពិនិត្យ **ទិសណា**? (2.17.3 — marker ចូល និងចេញ)
៤. **តើវាអាចធ្លាក់បានទេ?** ➜ `node audit-tools/checker-coverage.js`
៥. **តើវាអាចព្យួរបានទេ?** — រាល់ `await` ត្រូវមានពិដាន; ការព្យួរ **មិនមែន**
   ជាការធ្លាក់ទេ វាជាការបាត់ CI ទាំងមូល ➜ `node audit-tools/hang-guard.js`

📖 **ប្រវត្តិកំហុសពេញលេញ និងលេខដែលវាស់បាន៖ [`docs/BUG-HISTORY.md`](docs/BUG-HISTORY.md)**
— អានវាពេលត្រូវយល់ *ហេតុអ្វី* ច្បាប់មួយមាន។ វាមិនត្រូវការការអានរាល់ session ទេ។

---

## ច្បាប់ខ្លីនៃតំបន់ដែលប្រវត្តិរបស់វាផ្លាស់ទៅ `docs/BUG-HISTORY.md`

| តំបន់ | ច្បាប់ដែលមិនអាចរំលងបាន |
|---|---|
| **ធនធានខាងក្រៅ · SW** | engine ស្កេន និង SheetJS នៅ **ក្នុង repo** — ⛔ កុំបន្ថែម CDN ចូល `script-src`; `sw.js` បោះបង់សំណើឆ្លង origin ➜ ធនធាន CDN មិនដែលចូល cache។ CSP ត្រូវមាន `'wasm-unsafe-eval'`។ `CORE_SHELL` ប្រើ `cache.addAll()` (atomic)។ |
| **ការលាក់ secret ➜ Sentry** | `redactDeep()` ដើរលើ **គ្រប់ខ្សែអក្សរ** ក្នុង event; ការផ្គូផ្គងឈ្មោះ param ធ្វើ **តាមសមាសភាគ** (camelCase · `_ - .`); ⛔ កុំលាក់ `barcode=` និង id។ `error-reporting.js` byte-identical ២ App។ |
| **ធនធានផ្ទុកយឺត ↔ CSP** | ⛔ រាល់ URL ដែលផ្ទុក **តែពេលអ្នកប្រើចុច** ក៏ត្រូវឆ្លងកាត់ `script-src` ដែរ។ `loadScriptOnce()` មិនត្រូវសរសេរ `integrity = undefined`។ សារបរាជ័យត្រូវប្រាប់មូលហេតុពិត។ |
| **Toast · ស្លាកស្ថានភាព** | ថ្នាក់ ៤ តាមសញ្ញាដើមសារ; `renderConnectionStatus()` ជាកន្លែងផ្សាយ **តែមួយ**; ⛔ «ភ្ជាប់រួច» ≠ «ទិន្នន័យមកដល់» ≠ «នៅចូលប្រព័ន្ធ»; ការចុះឈ្មោះ toast រស់នៅ **ក្នុង DOM** មិនមែន module state។ |
| **មាត្រដ្ឋានអក្សរ · focus** | គ្រប់ `font-size` ជា `calc(N * var(--fs-unit))` — ⛔ គ្មាន `px` ថេរ (លើកលែង `#pdfExportPrintArea`); `:focus-visible` ត្រូវសរសេរជាមួយ tag/attribute ហើយដាក់ចុងឯកសារ។ |
| **ទម្រង់អេក្រង់ធំ · ឆ្លាតតាមឧបករណ៍** | ⛔ `style.display` ក្នុង JS សរសេរជាន់ layout របស់ CSS — បង្ហាញ/លាក់តាម **class**; ទទឹងជួរឈរតារាងនៅ **CSS** មិនមែន inline; ថ្នាក់ទូរស័ព្ទ `<700px` **មិនប្តូរដោយគ្មានការស្នើ**។ |
| **ចលនា boot** | ផ្ទាំង `pointer-events: none` ជានិច្ច; សំណាញ់ ៦ វិ. រៀបចំពេល `DOMContentLoaded`; ⛔ គ្មាន `transform` លើ chrome; PTR reload រំលងផ្ទាំង។ |
| **សម្របតាមតំណ** | `linkIsFrugal()` ⛔ ត្រូវ **fail open** (Safari គ្មាន API នេះ); រំលងតែការងារ **ស្រេចចិត្ត**។ |
| **ថ្នាក់កំហុសដែលដោះស្រាយរួច** | ២៥ ថ្នាក់ — សុទ្ធតែមាន checker ក្នុងតារាងខាងលើ។ បញ្ជីពេញលេញនៅក្នុង `docs/BUG-HISTORY.md`។ |

---

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


## `license-verify.js` ជាផ្លូវបណ្តាញ **ទី ៣** — READ BEFORE TOUCHING IT

`license-verify.js` ជា REST-only (គ្មាន Firebase SDK ដោយការរចនា) ហើយវាមាន
**helper បណ្តាញផ្ទាល់ខ្លួន** ដាច់ពី `app.js`។ ដូច្នេះរាល់ច្បាប់បណ្តាញរបស់
គម្រោងនេះត្រូវអនុវត្តលើវា **ដោយឡែក** — ហើយវាធ្លាប់រអិលកាត់ ២ ដងហើយ៖

| កំណែ | អ្វីដែលរអិលកាត់ |
|---|---|
| 2.11.6 | `clearTimeout` ក្នុង `finally` របស់ `fetch` ➜ ការអានតួគ្មានការការពារ |
| 2.17.4 | គ្មានពិដានចំនួនស្របគ្នា និងគ្មាន guard ក្រៅបណ្តាញសោះ |

**មូលហេតុដដែល៖ `network-pressure-test.js` ជំនួស `license-verify.js` ដោយ
stub ទាំងស្រុង (`LICENSE_STUB`)** ➜ ផ្លូវបណ្តាញពិតរបស់វា **មិនដែលត្រូវវាស់សោះ**។
នេះជាមេរៀនដដែលនឹង `network-timeout-test.js` (2.12.1) និង
`fluid-type-focus-test.js` (2.16.0)៖ **ពេលសរសេរ checker ត្រូវសួរថា
«វារត់/ស្កេនឯកសារ*ណា*ខ្លះ»។**

ច្បាប់ដែលមិនអាចរំលងបាន៖

- **រាល់សំណើឆ្លងកាត់ `sharedRequest(key, priority, run)`** — dedup តាមកូនសោ
  (សំណើដដែលចែករំលែក promise តែមួយ) បូកពិដាន `NET_MAX_IN_FLIGHT` (២)។
  ការដោះត្រូវធ្វើតាម `started.then(release, release)` — **ទាំង ២ ផ្លូវ**។
- **`checkOnline()` និង `syncServerTime()` ត្រូវមាន `networkLooksDown()`។**
- ⛔ **ការរំលងត្រូវត្រឡប់ `{ ok: null }` — មិនមែន `{ ok: false }` ទេ។**
  `getStatus()` លុប record មូលដ្ឋាន **តែពេល `ok === false`**; `null` មានន័យថា
  «ផ្ទៀងផ្ទាត់មិនបាន» ➜ ធ្លាក់ទៅការអនុគ្រោះ ៣ ថ្ងៃ។ ការប្តូរវាទៅ `false`
  នឹងធ្វើឲ្យ **License របស់អតិថិជនត្រូវលុបចោលពេលបណ្តាញអន់** — កុំធ្វើ។
- **`activate()` (អ្នកប្រើចុចផ្ទាល់) ត្រូវឆ្លងកាត់ `{ priority: true }`**
  ដែលរំលងទាំងពិដាន និង guard ក្រៅបណ្តាញ។
- `license-verify.js` **byte-identical ទាំង ២ App** ដដែល — `cp` + `md5sum`។
- ⚠️ `license-grace-test.js` ស្រង់ function តាមឈ្មោះចូល `vm`។ **បន្ថែម helper
  ថ្មី ➜ ត្រូវបន្ថែមឈ្មោះក្នុងបញ្ជីស្រង់នោះ** បើមិនដូច្នេះវាធ្លាក់ដោយ
  `ReferenceError` ដែលមើលទៅដូចកំហុសផលិតផល។

លេខដែលវាស់បាន (Chromium ពិត; server ទទួលការតភ្ជាប់ តែមិនឆ្លើយ)៖

| រង្វាស់ | មុនកែ | ក្រោយកែ |
|---|---|---|
| សំណើ **ចាំបាច់** លើ host ដដែល | ៩ ៦០៤ ms | **៥ ms** |
| សំណើ license ដល់ server (ពី ១០ ការហៅ) | ៧ | **១** |
| ការហៅខណៈ `navigator.onLine === false` | ១០ ០០១ ms | **០ ms** |

Tests៖ **`license-network-pressure-test.js`** និង **`license-grace-test.js`**។


## ⛔ ធនធានឆ្លង origin ក្នុង `<head>` — READ BEFORE TOUCHING index.html

**`sw.js` បោះបង់សំណើឆ្លង origin ដោយចេតនា** (ច្បាប់ចាក់សោតាំងពី 2.6.1) ដូច្នេះ
ធនធានទាំងនោះ **មិនដែលចូល cache**។ បើមួយក្នុងចំណោមវាស្ថិតក្នុង `<head>` ជា
ធនធាន **ទប់ការគូរ** នោះលើបណ្តាញ «ភ្ជាប់តែស្លាប់» សំណើនោះ **ព្យួរ** ➜ អ្នកប្រើ
មើល **អេក្រង់សទទេ** អស់រយៈពេលពេញនៃការព្យួរ ខណៈគ្រប់ឯកសាររបស់ App នៅក្នុង
cache រួចស្រេច។ វាស់លើ Chromium ពិត (host ខាងក្រៅព្យួរ ២០ វិនាទី, កំណែ 2.14.0)៖

| ស្ថានភាព | មុនកែ | ក្រោយកែ |
|---|---|---|
| បណ្តាញធម្មតា | ១៨៦ ms | ១៨៦ ms |
| `js.sentry-cdn.com` ព្យួរ | **២០ ២៥១ ms** | ២៤៩ ms |
| `fonts.googleapis.com` ព្យួរ | **២០ ១៦៨ ms** | ២០០ ms |
| ព្យួរទាំង ២ | **២០ ១៥៨ ms** | ១៩៥ ms |

ច្បាប់ដែលមិនអាចរំលងបាន៖

- **script ឆ្លង origin ត្រូវជា `async` (ឬ `defer`)** — `js.sentry-cdn.com` ជា
  `async`។ `error-reporting.js` មានផ្លូវផ្ទុកយឺតរួចហើយ (`loadSentrySdk()` +
  `lateInitRequest`) ដូច្នេះ Sentry នៅតែដំណើរការ; `sentry-load-race-test.js`
  ចាក់សោវា។
- **stylesheet ឆ្លង origin ត្រូវជា `media="print"`** រួច `boot-flags.js` ប្តូរ
  វាទៅ `all` ពេល `DOMContentLoaded`។ ⛔ **កុំប្រើ `onload="this.media='all'"`**
  — `script-src` គ្មាន `'unsafe-inline'` ➜ browser បដិសេធវាស្ងាត់ៗលើផលិតកម្ម
  (ថ្នាក់កំហុសដដែលនឹង `'wasm-unsafe-eval'` ក្នុង 2.10.0)។ `<noscript>` ជាផ្លូវបម្រុង។
- URL របស់ពុម្ពអក្សរមាន `display=swap` ស្រាប់ ដូច្នេះអក្សរ **swap ដូចមុនដដែល** —
  ការប្តូរនេះមិនបន្ថែម FOUT ថ្មីទេ។ បើពុម្ពអក្សរមកមិនដល់ App ប្រើពុម្ពអក្សរ
  របស់ឧបករណ៍ ហើយ **នៅដំណើរការគ្រប់មុខងារ**។

Test៖ **`boot-animation-test.js`** (វាស់ការគូរខណៈ host ខាងក្រៅព្យួរ)។
> ⚠️ ការកែក្នុងតំបន់នេះ **ត្រូវសាកលើ deploy preview ពិត** — បរិស្ថាន audit
> នៅទីនេះមិនអាចបង្កើតឥរិយាបថ CDN ពិតឡើងវិញបានទេ (មើលផ្នែក CDN ខាងលើ)។


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
| ប៊ូតុង (...) | `globalMoreMenu` | Export, កែទឹកប្រាក់/កញ្ចប់ (PIN), អត្រាប្រាក់, ធុងសំរាម, **Reset ចំនួនយករួច (PIN)**, លុបទាំងអស់ (PIN) |

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

**iOS nested-scroll handoff (កំណែ 2.11.3) — Android មិនត្រូវប៉ះ។** វីដេអូពី
iPhone PWA បញ្ជាក់ថា ពេលតារាងពេញអេក្រង់ដល់កំពូល Safari រក្សា touch នៅ child
scroller ហើយបង្កើតចន្លោះស rubber-band ជំនួសការបើកផ្ទាំង។ `usesIOSPanelHandoff()`
ត្រូវ gate ដោយ `navigator.standalone === true` បូក `CSS.supports('-webkit-touch-callout',
'none')`; Android ត្រូវនៅ passive, ពិដាន `scrollTop <= 0`, CSS `contain` និង FLIP ដដែល។

លើផ្លូវ iOS តែប៉ុណ្ណោះ៖

- `touchmove` របស់តារាងត្រូវជា non-passive ហើយ `preventDefault()` តែពេលផ្ទាំង
  `.collapsed`, ទិសចុះបញ្ឈរច្បាស់, ឆ្លង slop 8px និង `scrollTop <= 1`; CSS
  `overscroll-behavior-y: none` ជាជាន់ការពារ ប៉ុន្តែមិនអាចជំនួស JS cancellation បានទេ។
- ពេល move បានឈានដល់កំពូល ចេតនាត្រូវ latch ពី `touchmove` ឬ `scroll` event រហូតដល់
  final `touchend`; កុំសរសេរជាន់វាដោយការអាន `scrollTop` ថ្មី ព្រោះ WebKit អាចផ្ញើ
  0.5px ឬ stale 2px។ ប៉ុន្តែ final reversal/diagonal, multitouch និង `touchcancel`
  ត្រូវបោះបង់ដដែល។
- ពេលដោះ `history-expanded`, `#appPages.scrollTop` ត្រូវជា 0 មុនប្តូរ class,
  ភ្លាមក្រោយប្តូរ និងក្នុង rAF ពីរស៊ុមបន្ទាប់។ ចាក់សោនេះតែពេល class ប្តូរពី
  expanded ទៅធម្មតា; no-op sync មិនត្រូវ reset scroll។
- **កំណែ 2.11.4 បានប្រគល់ FLIP មកឲ្យ iOS វិញ — កុំដកវាចេញម្តងទៀត។**
  > ✅ **ផ្ទៀងផ្ទាត់លើ iPhone និង Android ពិតរួចហើយ** (2026-08-24)។ អ្នកប្រើបញ្ជាក់ថា
  > ចលនាផ្ទាំង, snap និង PTR ដំណើរការត្រឹមត្រូវទាំង ២ ប្រព័ន្ធ។ ដូច្នេះ **កុំដក
  > ចលនាចេញដោយផ្អែកលើការសង្ស័យអំពី `scroll-snap`** — 2.11.3 បានធ្វើដូចនោះរួចហើយ។
  កំណែ 2.11.3 បានបិទ `panelGlideFrom()` លើ iOS សម្រាប់ `expand` ព្រោះ
  `.page-main` ជា `scroll-snap-align` target ដែរ ហើយ transform 220ms អាចធ្វើឲ្យ
  WebKit snap outer scroller ឡើងវិញ។ តែការដកចលនាចេញ **ធ្វើឲ្យផ្ទាំងលោតភ្លាម
  លើ iPhone** ខណៈ Android រអិល ➜ អ្នកប្រើរាយការណ៍ថា «មើលទៅដូច App ២ ផ្សេងគ្នា»
  (វាស់បាន៖ iOS **0px** ធៀប Android **357px**)។
  ដំណោះស្រាយត្រឹមត្រូវគឺ **ផ្អាក snap** មិនមែនដកចលនា៖ `panelGlideFrom()`
  ដាក់ `panel-gliding` លើ `#appPages` (`scroll-snap-type: none`) មុនធ្វើចលនា
  រួចដកវាចេញពេលចប់។ WebKit លែងមានអ្វី snap ជាន់ ➜ ចលនាដើរពេញលេញ។
  **ការដក class នោះចេញត្រូវធានាដោយផ្លូវ ២** — `anim.finished.then(release, release)`
  បូក `setTimeout(endPanelGlideSnapPause, PANEL_GLIDE_MS + PANEL_GLIDE_SNAP_GRACE_MS)`
  — ព្រោះបើវាជាប់ នោះចំណុច snap «បើក» ធ្លាក់ត្រឹម `scrollTop 71` ➜ **PTR ស្លាប់**។
  `clearSensitiveModalFields()` ក៏ហៅ `endPanelGlideSnapPause()` ដែរ ដូច្នេះការ
  ចាកចេញកណ្តាលចលនាមិនបន្សល់សោនោះទេ។
- ផ្ទាំងទាំង ២ និងតារាងទាំង ៣ ត្រូវឆ្លង `bindPanelSwipe()` ដដែល — កុំ hard-code
  តែ `#tableResponsive`។ Tests៖ `phone-search-swipe-test.js` (67 assertions),
  `gesture-test.js` (107 assertions; បញ្ជូន touch ពិតដោយបើក iOS JS gate ក្នុង Chromium)
  និង **`ios-panel-glide-test.js`** (32 assertions; ប្រៀបធៀបចម្ងាយចលនា
  **iOS ធៀប Android ដោយផ្ទាល់** — បើវាធ្លាក់ នោះ iPhone លែងដូច Android ទៀតហើយ)។

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
| ៤ | `panelGlideFrom()` (FLIP តាម Web Animations) ត្រូវហៅ **គ្មានលក្ខខណ្ឌ** ក្នុង `applyPanelAction()` និង handler `click` របស់ `#dragHandle` — កុំដាក់ការលើកលែង iOS មកវិញ | `app.js` |
| ៥ | `panelGlideFrom()` ត្រូវផ្អាក snap (`#appPages.panel-gliding` ➜ `scroll-snap-type: none`) អំឡុងចលនា ហើយ **ដកចេញវិញតាមផ្លូវ ២** (finish + timer) | `app.js` + `style.css` |

លេខយោង (412×780, seed 120 order)៖ ចម្ងាយរំកិល **361px**; កាតខ្ពស់ **642px ទាំង ២ របៀប**;
តារាងខ្ពស់ **538px ទាំង ២ របៀប**; `.app-pages` រមូរបាន **361px** ដែលស្មើចម្ងាយរំកិល។
មុនកែ កាតខ្ពស់ 588 ធៀប 642 (ខុស **56px**) ➜ នោះជាមូលហេតុនៃការលោត។

**ការផ្ទៀងផ្ទាត់៖** `node audit-tools/panel-motion-test.js` (47 assertions លើ 320/412/768px
បូកផ្លូវ CSS iOS ដែលចាក់ចូល Chromium ដោយដៃ)។
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
- **ផ្លូវ Android និង iOS ដាច់ដោយឡែក (កំណែ 2.11.2)។** យន្តការ `clip-path`
  ខាងក្រោម **មិនដើរលើ Safari** — អ្នកប្រើ iPhone ឃើញកាត «លែងធ្លាក់»។ ដូច្នេះ
  `@supports (-webkit-touch-callout: none)` ផ្តល់ផ្លូវ iOS ដែលកាតមាន **កម្ពស់ពិត
  ហើយរីកចុះមកបំពេញ** កន្លែងរបា (យន្តការដែលផ្ទៀងផ្ទាត់លើ iPhone ក្នុង 2.9.0)។
  **Chromium ត្រឡប់ `false` សម្រាប់ `-webkit-touch-callout`** ➜ Android មិនរងផល
  ហើយ **ច្បាប់ក្នុងប្លុកនោះមិនដែលត្រូវសាកក្នុង Chromium សោះ** — `panel-motion-test.js`
  ស្រង់វាចេញរួចចាក់ចូលដោយដៃដើម្បីសាកវា។ កុំភ្លេចធ្វើដូចនោះពេលកែផ្នែកនេះ។
- **កំណែ 2.11.0៖ កន្លែងរបា Tab កក់ *ខាងក្នុងកន្សោមរមូរ* មិនមែនលើ `.app-pages` ទេ (ផ្លូវ Android)។**
  `.table-responsive` មាន `padding-bottom: var(--tabbar-height)` (ជួរដេកចុងក្រោយ
  នៅតែរមូរឡើងដល់ខាងលើរបាបាន) ហើយ **`.page-main`** មាន
  `clip-path: inset(0 0 calc(var(--tabbar-height) - 8px) 0 round …)`
  (ជួរដេកមិនលិចក្រោមរបា — បញ្ហាកំណែ 2.4.0)។ `body.chrome-hidden` ដកទាំង ២ ចេញ។
  **ត្រូវប្រើ `--tabbar-height` មិនមែន `--chrome-bottom` ទេ** — `--chrome-bottom`
  រួមបញ្ចូល safe-area ដែលនៅ *ក្រោម* viewport ➜ ការកាត់តាមវាឡើងខ្ពស់ជាងគែមរបា
  ដល់ ៥៣px លើ iPhone (កំហុស 2.11.0)។ ការអះអាងត្រូវមាន **២ ខាង** — «មិនលិចក្រោមរបា»
  តែម្យ៉ាងអនុញ្ញាតឲ្យចន្លោះទទេធំប៉ុនណាក៏បាន ដែលជាមូលហេតុដែលកំហុសនោះរអិលកាត់។
  **`clip-path` ជា paint មិនមែន layout** ➜ ប្តូរបានភ្លាមស្របនឹង transform របស់របា។
- ដូច្នេះ **កម្ពស់កាត និងតារាងថេរទាំងស្រុង** ➜ ថ្នាក់កំហុស «ប្តូរកម្ពស់កណ្តាល
  momentum» មិនអាចកើតឡើងបានតាមរចនាសម្ព័ន្ធ។ យន្តការពន្យារ 180ms
  (`scheduleChromeLayoutSettle`) និង `chrome-space-released` **ត្រូវដកចេញរួច** —
  កុំនាំវាត្រឡប់មកវិញ។ មុននេះការពន្យារនោះធ្វើឲ្យរបារអិលចេញភ្លាម តែកាតធ្លាក់មក
  បំពេញ 180ms ក្រោយ ➜ អ្នកប្រើឃើញចន្លោះទទេ និងជួរដេកកាត់ពាក់កណ្តាល។
- Scroll handler ត្រូវ coalesce តាម `requestAnimationFrame` មួយដងក្នុងមួយ frame។
  `gesture-test.js` និង `panel-motion-test.js` ចាក់សោឥរិយាបថនេះ — ការអះអាងវាស់
  **គែមដែលមើលឃើញ** (គែមប្រអប់ ដក clip inset) មិនមែនគែមប្រអប់ទេ
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
`resetPickup`, `clearHistory`, `setupLink`) ហើយ `applyPinPromptText()` សរសេរវាចូល `#pinModalDesc` និង
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


## CSS invariant ដែលចាក់សោ — ⛔ READ BEFORE EDITING style.css

`style.css` **គ្មាន comment** តាមច្បាប់គម្រោង (មើលចំណុច ១២ ខាងលើ) ដូច្នេះ
ហេតុផលរបស់ច្បាប់សំខាន់ៗរស់នៅត្រង់នេះ។ ការកែច្បាប់ទាំងនេះដោយមិនអានមុន
នឹងធ្វើឲ្យថ្នាក់កំហុសដែលដោះស្រាយរួច ត្រឡប់មកវិញ។

### ZoeW

| Selector | ច្បាប់ | ហេតុអ្វី |
|---|---|---|
| `.status-dot::after` | ចលនាលើ `transform`/`opacity` មិនមែន `box-shadow` | `box-shadow` composite មិនបាន ➜ របាខាងលើគូរឡើងវិញរាល់ស៊ុមជារៀងរហូត |
| `.app-navbar` | គ្មាន `backdrop-filter` · គ្មាន `transform` · គ្មាន `transition` | iOS គណនា blur ឡើងវិញរាល់ស៊ុម; របាខាងលើ **មិនលាក់តាមការរមូរទេ** (សំណើអ្នកប្រើ) |
| `.modal` | ផ្ទៃខ្មៅធម្មតា គ្មាន `backdrop-filter` | ប្រអប់លេខទូរស័ព្ទបើករាល់ការស្កេន ➜ blur រាល់ស៊ុមនៃ animation បើក |
| `.scan-line` | ចលនាលើ `transform` មិនមែន `top` | `top` បង្កើត layout រាល់ស៊ុម ចំពេលកាមេរ៉ាកំពុងឌិកូដ |
| `.page-main` | `height` ថេរ + `flex: none` ក្នុង `@media (max-width: 991px)` | កាតត្រូវខ្ពស់ **ដូចគ្នាបេះបិទ** ទាំង ២ របៀប បើមិនដូច្នេះផ្ទាំងលោត (មើលផ្នែកចលនា 2.9.0) |
| `.table-responsive` | `max-height: none; flex: 1` **scope ត្រឹម `.page-main`** | modal ត្រូវរក្សាពិដាន 62vh ដដែល |
| `.app-pages` | `scroll-snap-type: y proximity` + `scroll-padding-top` ស្មើ `padding-top` | បើភ្លេច `scroll-padding-top` ចំណុច snap ធ្លាក់ត្រឹម `scrollTop 71` ➜ **PTR ស្លាប់** |
| `#appPages.panel-gliding` | `scroll-snap-type: none` អំឡុងចលនា FLIP | `.page-main` ជា snap target ➜ WebKit snap ជាន់ចលនា ២២០ms |
| `.table-responsive` | `padding-bottom: var(--tabbar-height)` | កក់កន្លែងរបា Tab **ខាងក្នុងកន្សោមរមូរ** ➜ ប៉ះតែ `scrollHeight` មិនមែន layout |
| `.page-main` | `clip-path` ប្រើ `--tabbar-height` **មិនមែន** `--chrome-bottom` | `--chrome-bottom` រួម safe-area ដែលនៅ *ក្រោម* viewport ➜ កាត់ខ្ពស់ជាងគែមរបា ៥៣px លើ iPhone |
| `@supports (-webkit-touch-callout: none)` | ផ្លូវ iOS ដាច់ដោយឡែក — កាតមានកម្ពស់ពិត រីកចុះមកបំពេញ | `clip-path` មិនដើរលើ Safari; Chromium ត្រឡប់ `false` ➜ Android មិនរងផល |
| `body.perf-lite` | ដកចលនាដែលដើរជារៀងរហូត និងស្រមោលថ្លៃ | ដាក់ដោយ `setupAdaptivePerformance()` ក្រោយវាស់ការធ្លាក់ស៊ុម **២ ដង** |
| `.history-section`/`.panel-section` | flex column ដើម្បីឲ្យ `.table-responsive` `flex: 1` បាន | បើអត់ បញ្ជីមិនពេញអេក្រង់ |
| `.boot-splash` | `pointer-events: none` ជានិច្ច | ផ្ទាំងតុបតែងមិនត្រូវលេបការចុច |
| `.boot-splash-bar > span` | រំកិល **ខាងក្នុងរបា** (`width: 40%`, `translateX(0 → 150%)`) | `translateX(-100%)` លើ span ពេញទទឹង នាំគែមឆ្វេងទៅ `left = -38` នៅ 320px ➜ `layout-check.js` ធ្លាក់ |
| គ្រប់ `font-size` | `calc(N * var(--fs-unit))` — **គ្មាន `px` ថេរ** (លើកលែង `#pdfExportPrintArea`) | បើមួយកន្លែងនៅ `px` នោះវានៅតូចដដែលខណៈអក្សរជុំវិញរីក ➜ អត្ថបទតូចជាងគេដោយគ្មានហេតុផល |
| `:focus-visible` | រង្វង់ `outline` ២px លើប៊ូតុង/តំណ/checkbox/file/range | អ្នកប្រើ **Tab** និងម៉ាស៊ីនស្កេន hardware (ជាឧបករណ៍ក្តារចុច) ត្រូវដឹងថាឈរនៅណា |
| ប្រអប់វាយអត្ថបទ | `outline: none` ត្រូវមាន `:focus` ជំនួស (border + `box-shadow`) | `outline: none` ស្អាតៗ = គ្មានសញ្ញាផ្តោតសោះ — ធ្លាប់កើតលើប្រអប់ PIN |

### ZoeKeyGen

| Selector | ច្បាប់ | ហេតុអ្វី |
|---|---|---|
| `.app-container` | `display: grid` ២ ជួរ នៅ `≥900px` · `max-width: 1180px` | បើអត់ កាតជង់ជាជួរតែមួយ ➜ ចន្លោះទទេ ៦៦០px នៅ 1440px |
| `#appContainer` | បង្ហាញ/លាក់តាម class `hidden` — **មិនមែន** `style.display` | inline `display: flex` ឈ្នះ `display: grid` របស់ media query ➜ grid មិនដែលដើរ |
| `.card-wide` | `grid-column: 1 / -1` | Signing Key (JWK វែង) និងបញ្ជី Key (តារាង) ត្រូវការទទឹងពេញ |

### ZoeImport

| Selector | ច្បាប់ | ហេតុអ្វី |
|---|---|---|
| `body` | flex column + `min-height: 100dvh`; `.app-body` ជា `flex: 1` | **កុំគណនា `100dvh - var(--navbar-h)` ដោយដៃ** — លេខនោះខុសរាល់ពេលកម្ពស់របាខាងលើប្រែ (safe-area · ពុម្ពអក្សរធំ · អក្សរ ២ ជួរ) |
| `.gate-card` | `margin: auto` — **មិនមែន** `align-items: center` លើ `.gate` | ការតម្រឹមកណ្តាលក្នុង flex **កាត់ផ្នែកខាងលើចោល ហើយរមូរទៅមិនដល់** ពេលកាតខ្ពស់ជាងកន្លែងទំនេរ (ទូរស័ព្ទផ្តេក ឬក្តារចុចបើក) |
| `.grid` | CSS Grid `auto-fit` `minmax(min(100%, 158px), 1fr)` | ១ ជួរឈរនៅ 320px · ២ នៅ ~412px · ៤ នៅ ≥768px ដោយគ្មានធាតុកំព្រានៅជួរចុងក្រោយ (បញ្ហារបស់ flex-wrap) |
| `.btn-row > *` | `flex: 1 1 auto; min-width: 148px` | ប៊ូតុងលាតបំពេញជួរលើអេក្រង់តូច ➜ គោលដៅចុចធំ; ត្រឡប់ទៅទទឹងតាមអត្ថបទលើអេក្រង់ធំ |
| `table` | `min-width: 440px` + `.tablewrap` រមូរផ្តេក + ស្រមោលគែម | ជួរឈរមិនត្រូវច្របាច់រហូតអានមិនចេញនៅ 320px; ស្រមោលជាសញ្ញាថារមូរបាន |
| `#appMain` @≥900px | grid ២ ជួរឈរ; ជំហាន ១–៣ span ពេញ | ជំហាន ៤ និងកាតសម្អាតជា **សកម្មភាពឯករាជ្យ ២** ➜ ក្បែរគ្នាជំនួសចន្លោះទទេ |
| `@media (max-height: 520px)` | បង្រួមកាតដោះសោ | ទូរស័ព្ទផ្តេក |

`layout-check.js` គ្រប **ZoeW · ZoeKeyGen · ZoeImport** លើ 320/360/412/768/1280/1440px។


## CSP និង `data-act` — ⛔ កុំនាំ `onclick=` ត្រឡប់មកវិញ

**កំណែ 2.13.0 ដក `'unsafe-inline'` ចេញពី `script-src` របស់ ZoeW និង ZoeKeyGen។**
ផលដែលត្រូវដឹង៖ **រាល់ attribute `on*=` និង `<script>` ខាងក្នុង HTML នឹងត្រូវ
browser បដិសេធស្ងាត់ៗលើផលិតកម្ម** ខណៈតេស្តដែលរត់គ្មាន CSP ជោគជ័យទាំងអស់។
នេះជាថ្នាក់កំហុសដដែលនឹង `'wasm-unsafe-eval'` ក្នុងកំណែ 2.10.0។

ការចាប់ព្រឹត្តិការណ៍ធ្វើតាម **delegation** ជំនួសវិញ៖

| អ្វី | របៀបសរសេរ |
|---|---|
| ហៅគ្មានអាគុយម៉ង់ | `data-act="openSideDrawer"` |
| អាគុយម៉ង់ថេរ (អ្នកនិពន្ធសរសេរ) | `data-act="filterDataByDate" data-args='["today"]'` (JSON) |
| អាគុយម៉ង់ពី **ទិន្នន័យ** | `data-act="openViewListModal" data-a1="${sanitizeInput(item.id)}"` |
| ព្រឹត្តិការណ៍ | បន្ថែម `data-evt="1"` ➜ `event` ត្រូវដាក់ **ខាងមុខ** |
| ធាតុខ្លួនឯង | បន្ថែម `data-self="1"` ➜ ធាតុត្រូវដាក់ **ខាងមុខគេបំផុត** |
| ព្រឹត្តិការណ៍ក្រៅ `click` | បន្ថែម `data-on="change"` (ឬ `input`/`submit`) |

លំដាប់អាគុយម៉ង់៖ `(ធាតុ, event, …args)` — `data-self` unshift ក្រោយ `data-evt`
ដូច្នេះធាតុមកមុនគេ។ ឧ. `toggleMoreDropdown(btn, event, id)`។

**ច្បាប់ដែលមិនអាចរំលងបាន៖**

១. **`ACTION_ALLOWLIST` ជាព្រំដែន។** `runElementAction()` បដិសេធឈ្មោះណាដែល
   មិនស្ថិតក្នុងបញ្ជី — កុំប្តូរវាទៅជា `window[name]` ត្រង់ៗ ព្រោះនោះនឹងអនុញ្ញាត
   ឲ្យ `data-act` ណាមួយហៅ global ណាមួយបាន។
២. **បន្ថែមប៊ូតុងថ្មី ➜ ត្រូវបន្ថែមឈ្មោះក្នុង `ACTION_ALLOWLIST` ដែរ។**
   `wiring.js` និង `csp-enforced-test.js` អះអាង **២ ទិស**៖ រាល់ `data-act`
   ត្រូវនៅក្នុងបញ្ជី **និង** រាល់ធាតុក្នុងបញ្ជីត្រូវត្រូវបានប្រើ (សិទ្ធិតូចបំផុត)។
៣. **`event.currentTarget` លែងជាប៊ូតុងទៀតទេ** — វាជា `document` ព្រោះ listener
   ភ្ជាប់នៅទីនោះ។ Function ណាដែលត្រូវការធាតុ ត្រូវទទួលវាតាម `data-self`។
   (`toggleMoreDropdown` និង `toggleHeaderMoreDropdown` ជាឧទាហរណ៍។)
៤. **កុំបន្ថែម listener ទី ២ លើធាតុដែលមាន `data-act` រួច** — មុន 2.13.0 មាន
   `bindClickBackup()` ជាជាន់បម្រុងសម្រាប់ inline handler; ឥឡូវ delegation ជា
   ផ្លូវ **តែមួយ** ➜ ការភ្ជាប់ស្ទួននឹងធ្វើឲ្យសកម្មភាព **រត់ពីរដង**
   (ធ្ងន់បំផុតលើ `executePermanentDelete`)។
៥. **`<script>` ខាងក្នុង `<head>` ត្រូវនៅក្នុង `boot-flags.js`** ដែលផ្ទុកជា
   `<script src>` **មុន stylesheet** (ការរក iOS standalone ត្រូវរត់មុន CSS —
   មើលច្បាប់ `--chrome-bottom`)។ វាត្រូវនៅក្នុង `CORE_SHELL` របស់ `sw.js` ដែរ។
៦. `style-src` **នៅរក្សា `'unsafe-inline'` ដដែល** — មាន `style="…"` ជាង ១៩០
   កន្លែង ហើយ style injection គ្រោះថ្នាក់តិចជាង script ច្រើន។ **កុំដកវាចេញ**
   ដោយគ្មានការស្នើច្បាស់លាស់។

Tests៖ **`csp-enforced-test.js`** (បម្រើ App ជាមួយ **header CSP ពិតដកចេញពី
`netlify.toml`** រួចអះអាងថាគ្មានការរំលោភ **ហើយ UI នៅដើរ**), **`wiring.js`**
និង **`inline-handler-xss-test.js`**។


## ធុងសំរាម និង `trashReason` — កំណែ 2.17.0

> ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-25) — rules ត្រូវបាន publish
> មុន merge ហើយអ្នកប្រើបញ្ជាក់ថាស្លាកទាំង ៤ · តួលេខសរុប ២ ក្រុម · ការ merge
> និងប៊ូតុង 🔄/✖️ **ដំណើរការល្អ**។ ដូច្នេះ **កុំកែតក្កវិជ្ជានេះដោយផ្អែកលើ
> ការសង្ស័យ** — កែបានតែពេលអ្នកប្រើរាយការណ៍បញ្ហាពិត ឬ `trash-modal-test.js` ធ្លាក់។

**ធុងសំរាមមានប្រភេទ ៤ ដែលបែងចែកដោយវាល `trashReason`** (string ក្នុង
`zoew_recently_deleted_cod_dod/$itemId`; **មានក្នុង rules រួចហើយ** — កុំភ្លេច
publish)។ មុន 2.17.0 មានតែ `isFromDeletion` ដែល **មិនអាចបែងចែក**
«ដក» ធៀបនឹង «ផុតកំណត់ ៨ ថ្ងៃ» បានទេ ព្រោះទាំង ២ សរសេរ `isFromDeletion: false`។

| ផ្លូវ | `trashReason` | ស្លាក UI | ស្ថិតិចំណូល |
|---|---|---|---|
| `deleteSingleItem` · `buildClearHistoryTrashItem` | `'delete'` | លុប | **មិនប៉ះ** |
| `claimAndCleanupItem(reason='close')` — **barcode** បិទរួច ២ ម៉ោង (partial ឬ whole) | `'pickup'` | យករួច | **មិនប៉ះ** |
| `claimAndCleanupItem(reason='abandon')` — ហួស ៨ ថ្ងៃ | `'expired'` | ផុតកំណត់ | **ដករួច** |
| `removeSingleBarcode` | `'remove'` | ដក | **ដករួច** |

**`isDeducted` នៅតែជាវាលតែមួយគត់ដែលកំណត់លុយ** — `trashReason` ជា **ស្លាក
បង្ហាញ** ប៉ុណ្ណោះ។ កុំយកវាទៅសម្រេចលើចំណូល។

- `trashReasonOf()` មាន fallback សម្រាប់ធាតុចាស់ដែលគ្មានវាលនេះ៖
  `isFromDeletion === true` ➜ `isClosed ? 'pickup' : 'delete'`; បើអត់ ➜ `'remove'`។
- **`executeRestoreItem()` ត្រូវ `delete itemToRestore.trashReason`** មុនសរសេរ
  ត្រឡប់ចូល `zoew_scan_history_cod_dod` — node នោះមាន
  `$other: { ".validate": false }` ➜ បើភ្លេច **ការស្តារនឹងត្រូវបដិសេធទាំងស្រុង**។
  `payload-schema.js` ចាក់សោចំណុចនេះ។
- **រយៈពេលរក្សាទុក ៣០ ថ្ងៃ** (`TRASH_RETENTION_MS`, កំណែ 2.18.0 — មុននេះ ១៥)។
  ⚠️ លេខនោះបង្ហាញដល់អ្នកប្រើ **២ កន្លែង** — ចំណងជើងប្រអប់ក្នុង `index.html`
  និងសារ «ជួរទៀត» ក្នុង `renderRecentlyDeleted()`។ `trash-modal-test.js`
  អះអាងថាទាំង ៣ ត្រូវគ្នា; ការប្តូរលេខថេរតែម្យ៉ាងធ្វើឲ្យអ្នកប្រើរង់ចាំខុសថ្ងៃ។

**ការ merge ក្នុងតារាង៖** កូនសោក្រុមជា
`[trashReason, phone, scanDate, time].join('~')` — ធាតុដែលដូចគ្នាទាំង ៤
បង្ហាញជាជួរតែមួយ ដែលបូក **តម្លៃសរុប** និង **ចំនួនកញ្ចប់សរុប**។
⛔ **ការ merge ជាការបង្ហាញសុទ្ធសាធ — ប៊ូតុង 🔄/✖️ នៅតែធ្វើការលើ `id`
តែមួយជានិច្ច។** ក្រុមដែលមានធាតុច្រើនបង្ហាញប៊ូតុងពង្រីក «▼ N» ជំនួសវិញ។
កុំប្តូរវាទៅជា bulk restore/purge ដោយគ្មានការស្នើច្បាស់លាស់ — ផ្លូវស្តារមាន
claim token និង fence ក្នុង rules ដែលសរសេរសម្រាប់ធាតុតែមួយ។

**តួលេខសរុបបែកជា ២ ក្រុមតាម `TRASH_REASON_META[reason].deducted`** ៖
`remove`+`expired` (ដករួច) ធៀបនឹង `pickup`+`delete` (មិនប៉ះ)។ ការត្រង
តាមប្រអប់ស្វែងរក (`deletedSearchQuery`) **ត្រងទាំងតារាង និងតួលេខសរុប**។

State ថ្មីកម្រិត module ៖ `deletedSearchQuery` និង `expandedTrashGroups` —
ទាំង ២ ត្រូវ reset ក្នុង `clearSensitiveModalFields()`។
⚠️ `setup-link-logout-test.js` រត់ `clearSensitiveModalFields` ក្នុង `vm`
ដូច្នេះវាត្រូវចាក់ការប្រកាសពិតរបស់អថេរទាំង ២ ចូល sandbox — បើបន្ថែម state
ថ្មីទៀត ត្រូវបន្ថែមឈ្មោះក្នុងបញ្ជីនោះដែរ បើមិនដូច្នេះ function throw ➜
`resetScanConfirm()` មិនរត់ ➜ តេស្តធ្លាក់ដោយសារហេតុផលមិនពាក់ព័ន្ធ។


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
| លុប (`deleteSingleItem`, `clearHistory`, សម្អាត 2h — រួមទាំង partial) | `true` | មិនប៉ះ (នៅ `false`) |
| ដក (`removeSingleBarcode`, សម្អាត 8d) | `false` | `true` |
| ស្តារ (`executeRestoreItem`) | លុបចោល | reset |

**`isDeducted` នៅតែជាវាល *តែមួយគត់* ដែលកំណត់លុយ** — `isFromDeletion` ជាសញ្ញាសម្គាល់បន្ថែម។

**ការសម្អាតស្វ័យប្រវត្តិ (កុំប្តូរដោយគ្មានការស្នើ)៖** **barcode** ដែលបិទ ➜ ធុងសំរាមក្រោយ **២ ម៉ោង**
(តាម `barcode.closedAt` របស់វាផ្ទាល់ តាំងពីកំណែ 2.17.2 — មិនមែនរង់ចាំកញ្ចប់ទាំងមូលទៀតទេ);
កញ្ចប់មិនទាន់បិទ ➜ ក្រោយ **៨ ថ្ងៃ**; អ្វីក្នុងធុងសំរាម ➜ purge ក្រោយ **៣០ ថ្ងៃ** (`TRASH_RETENTION_MS`, កំណែ 2.18.0)។
`claimAndCleanupItem()` **ផ្ទៀងផ្ទាត់បង្អួចម្តងទៀតខាងក្នុង transaction** ធៀបនឹងតម្លៃរបស់ server
ដូច្នេះការកេះដោយស្ថានភាពចាស់ក្នុងសតិ មិនអាច claim ខុសបានទេ។

### 📋 តារាងសេណារីយ៉ូពេញលេញ — លុប · ដក · បិទ/បើក · សម្អាតស្វ័យប្រវត្តិ

> **អ្នកប្រើស្នើឲ្យកត់ត្រាទុក (2026-08-26)** ដើម្បីឲ្យជុំក្រោយកែវិញបានលឿន
> បើមានអ្វីប៉ះ។ **នេះជាប្រភពការពិតតែមួយ** — កូដត្រូវផ្គូផ្គងតារាងនេះ។

| # | សកម្មភាព | Function | ធុងសំរាម `trashReason` | `isFromDeletion` | `isDeducted` | **លុយ** | ត្រា `closedAt` |
|---|---|---|---|---|---|---|---|
| ១ | **បិទ «យក»** barcode ១ | `toggleIndividualBarcodeClose` | — | — | — | **មិនប៉ះ** | បោះលើ barcode នោះ |
| ២ | **បិទ** កញ្ចប់ទាំងមូល | `toggleCloseStatus` | — | — | — | **មិនប៉ះ** | បោះលើ barcode គ្រប់ |
| ៣ | **បើកវិញ** (ទាំង ២ ផ្លូវ) | ដដែល | — | — | — | **មិនប៉ះ** | **លុបត្រាចេញ** |
| ៤ | **ដក** barcode ១ | `removeSingleBarcode` | `remove` | `false` | **`true`** | **ដកចេញ** | រក្សាតាម barcode |
| ៥ | **លុប** កញ្ចប់ | `deleteSingleItem` | `delete` | `true` | មិនប៉ះ | **មិនប៉ះ** | រក្សា |
| ៦ | **លុបទាំងអស់** | `buildClearHistoryTrashItem` | `delete` | `true` | មិនប៉ះ | **មិនប៉ះ** | រក្សា |
| ៧ | **សម្អាត ២ ម៉ោង** (barcode បិទរួច) | `claimAndCleanupItem('close')` | `pickup` | `true` | មិនប៉ះ | **មិនប៉ះ** | ជាអ្នកសម្រេច |
| ៨ | **សម្អាត ៨ ថ្ងៃ** (មិនទាន់យក) | `claimAndCleanupItem('abandon')` | `expired` | `false` | **`true`** | **ដកចេញ** | — |
| ៩ | **ស្តារ** ពីធុងសំរាម | `executeRestoreItem` | លុបចោល | លុបចោល | **reset** | **បូកត្រឡប់** បើធ្លាប់ដក | **reset ជា «ឥឡូវ»** |
| ១០ | **✖️ លុបជាអចិន្ត្រៃយ៍** | `executePermanentDelete` | — | — | — | **មិនប៉ះ** | — |

**ច្បាប់មាស៖ `isDeducted` ជាវាល *តែមួយគត់* ដែលកំណត់លុយ។** `trashReason` ជា
**ស្លាកបង្ហាញ** ប៉ុណ្ណោះ។ ជួរ ៤ និង ៨ ជាជួរ **តែ ២** ដែលប៉ះលុយ។

**ការបែងចែកតាម barcode (ជួរ ៧ និង ៨)** — កញ្ចប់លាយ (A បិទ · B បើក)៖

| ច្បាប់ | អ្វីចេញ | អ្វីនៅ | លុយ |
|---|---|---|---|
| ២ ម៉ោង | **A តែឯង** ជា `pickup` | B និងនាឡិកា ៨ ថ្ងៃរបស់វា | មិនប៉ះ |
| ៨ ថ្ងៃ | **B តែឯង** ជា `expired` | A (បិទ) ➜ រង់ចាំច្បាប់ ២ ម៉ោង | ដកតែ B |

**marker ដែលមិនត្រូវច្រឡំ** (បើច្រឡំ ➜ `permission_denied` ជារៀងរហូត)៖

| Marker | ជាកម្មសិទ្ធិរបស់ | ត្រូវលុបមុនសរសេរទៅ |
|---|---|---|
| `restoreClaimId` · `restoreClaimToken` | `zoew_scan_history_cod_dod` | **ធុងសំរាម** (`stripHistoryOnlyMarkers`) |
| `clearClaim` | `zoew_scan_history_cod_dod` | **ធុងសំរាម** |
| `restoreClaim` | `zoew_recently_deleted_cod_dod` | **ប្រវត្តិ** (`dropStaleRestoreMarkers`) |
| `trashReason` · `deletedAt` · `isFromDeletion` | `zoew_recently_deleted_cod_dod` | **ប្រវត្តិ** (`executeRestoreItem`) |

**របៀបផ្ទៀងផ្ទាត់ក្នុងមួយពាក្យបញ្ជា** — បើជុំក្រោយប៉ះតំបន់នេះ៖

```bash
java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1 &
node audit-tools/emu/crud-rules-flow.js     # payload ពិត ធៀបនឹង rules ពិត (43)
node audit-tools/partial-pickup-cleanup-test.js   # ២ ម៉ោង / ៨ ថ្ងៃ តាម barcode (48)
node audit-tools/restore-marker-hygiene-test.js   # marker ↔ schema (19)
node audit-tools/policy-test.js                   # គោលការណ៍ លុប/ដក (28)
node audit-tools/trash-modal-test.js              # ស្លាក និងតួលេខសរុប (53)
```

**GitHub Action `.github/workflows/audit.yml` រត់ ២ ជំហានដំបូងលើរាល់ PR ស្វ័យប្រវត្តិ។**
សន្ទះការពារ «បៃតងក្លែងក្លាយ» ២៖ `CRUD_FLOW_STRICT=1` (SKIP ➜ ធ្លាក់) និង
`CRUD_FLOW_MIN_ASSERTS=43` (assertion តិចជាងកម្រិត ➜ ធ្លាក់ ទោះគ្មាន `fail`)។
**បើបន្ថែមតេស្តក្នុង `crud-rules-flow.js` ត្រូវតម្លើងលេខនោះក្នុង workflow ដែរ។**

### ⛔ witness ដែលបន្សល់ មិនត្រូវចាក់សោ id — DEADLOCK ៣ ខាង (កំណែ 2.18.0)

> 🔴 **កំហុសផលិតកម្មពិត** — បង្កើតឡើងវិញ និងវាស់បានលើ **RTDB emulator ពិត
> ជាមួយ rules ពិត**។

`clearRestoreFinalization()` និង `clearClearHistoryFinalization()` រត់ក្នុង
`.catch(() => {})` ➜ បណ្តាញដាច់ភ្លាមក្រោយ finalize ➜ record witness នៅជាប់។
មុនកែ rules ទាមទារ **`!data.exists()`** លើការសរសេរ witness ➜ បើធាតុ **id ដដែល**
ត្រូវលុប/ដកម្តងទៀត នោះ៖

| សកម្មភាព | លទ្ធផលវាស់បាន |
|---|---|
| ស្តារ | **401** (`!data.exists()` មិនពិត) |
| លុប witness ចាស់ | **401** (ទាមទារធាតុធុងសំរាមលែងមាន) |
| លុបធាតុធុងសំរាម | **401** (ទាមទារ witness fence) |

**ផ្លូវទាំង ៣ ជាប់** ➜ ធាតុនោះស្តារមិនបាន · លុបមិនបាន · ដោះមិនបាន **ជារៀងរហូត**។

**ដំណោះស្រាយ៖ ដក `!data.exists()` ចេញ។** ⛔ **វាមិនទម្លាយ fence ទេ** —
អ្វីដែលពិតជាទប់ replay គឺ «claim token ត្រូវនៅក្នុងធាតុធុងសំរាម **មុន** update
ហើយធាតុនោះត្រូវលុប **ក្នុង** update ដដែល»។ លើកទី ២ ធាតុធុងសំរាមលែងមាន ➜
`restoreClaim.token` = `null` ≠ token ➜ បដិសេធ។ `!data.exists()` គ្រាន់តែជា
ជាន់ទី ២ ដែល **បង្កើត deadlock ដោយគ្មានបន្ថែមសុវត្ថិភាព**។

វាស់លុយពិតជាមួយ `increment()` ពិត៖ ស្តារ `$0 → $5` (បូក ១ ដង) · replay **401
លុយមិនប្តូរ** · witness ក្លែងក្លាយដោយគ្មាន claim **401**។

⛔ **ការអះអាង «ការស្តារដំណើរការ» តែម្យ៉ាងមិនគ្រប់គ្រាន់ទេ** — វានឹងបៃតងទោះបើ
fence ត្រូវទម្លាយ ➜ លុយបូកស្ទួន។ តេស្តត្រូវអះអាង **២ ខាង**។

⚠️ `restore-finalization-fence-test.js` និង `clear-history-finalization-fence-test.js`
វាស់ **គំរូ** នៃ rules ដែលសរសេរដោយដៃ — **មិនមែន rules ពិតទេ** ➜ ពួកវាមិនអាច
ចាប់ការឃ្លាតរវាងគំរូនិង rules បានទេ។ អ្នកចាប់ពិតគឺ **`emu/restore-deadlock-test.js`**
ដែលរត់ rules ពិតលើ emulator ពិត។

Test៖ **`emu/restore-deadlock-test.js`** (12 assertion)។
⚠️ **rules ត្រូវ publish ដោយដៃ** — បើមិនដូច្នេះ deadlock នៅដដែល។

### ⛔ ការ purge ធុងសំរាមស្វ័យប្រវត្តិ ត្រូវដោះ claim ងាប់ (កំណែ 2.18.0)

`runAutomaticDeletedCleanup()` ធ្លាប់សរសេរ `if (!item || item.restoreClaim) return;`
— រំលងធាតុណាដែលមាន `restoreClaim` **ដោយមិនពិនិត្យថាវានៅរស់ឬអត់**។

ការរំលងនោះ **ចាំបាច់** (rules បដិសេធការលុបខណៈ claim ជាប់ — វាស់បាន 401) តែ
**គ្មានអ្នកដោះ claim ងាប់ក្នុងផ្លូវស្វ័យប្រវត្តិ**៖ `releaseStaleRestoreClaimForPurge()`
ហៅតែពី `executePermanentDelete()` គឺពេលអ្នកប្រើចុច ✖️ **ដោយដៃ**។ ផល៖ ធាតុជាប់
ក្នុង Firebase ជារៀងរហូត ហើយ **barcode របស់វាកក់ក្នុង `zoew_barcode_registry`
ជារៀងរហូត** ➜ barcode ដដែលស្កេនចូលមិនបានទៀត។

ច្បាប់៖

- `isActiveRestoreClaim()` ជា gate — claim **នៅរស់** ឬ id នៅក្នុង
  `activeRestoreClaims` ➜ **កុំប៉ះ** (ឧបករណ៍ផ្សេងកំពុងស្តារ)។
- claim **ងាប់** ➜ `releaseStaleRestoreClaimForPurge()` **មុន** purge។
  បើការដោះនោះបរាជ័យ ➜ រំលងធាតុនោះ **តែជុំនេះ** កុំឲ្យវាធ្វើឲ្យក្រុមធ្លាក់។
- ⛔ **ការ purge ជាក្រុមជា atomic** — វាស់បាន៖ ក្រុមមាន `id_a` (ស្អាត) +
  `id_b` (claim ជាប់) ➜ **ទាំង ២ មិនចេញសោះ**។ ដូច្នេះបើក្រុមធ្លាក់ ត្រូវ
  **ថយទៅលុបមួយៗ** បើមិនដូច្នេះធាតុ ១ ដែលមានបញ្ហាចាក់សោធាតុស្អាតទាំងអស់។
- ផ្លូវផ្ទៃខាងក្រោយត្រូវ **ស្ងាត់** — `purgeDeletedItemsQuietly()` មិន toast;
  toast លេចតែពេលបរាជ័យ **ទាំងស្រុង** មិនមែន N ដងទេ។

Test៖ **`restore-marker-hygiene-test.js`** សេណារីយ៉ូ ៥ (26 assertion សរុប) —
វារត់ `runAutomaticDeletedCleanup()` **ពិត** ក្នុង `vm` ដែល `fb.update()`
អនុវត្ត rules ដូច server។

### ⛔ ជណ្តើរផ្ទុក SDK ក៏ត្រូវមានពិដានល្បឿនដែរ (កំណែ 2.18.0)

ថ្នាក់កំហុស **ដដែលបេះបិទនឹងកំណែ 2.14.0** (`retryFailedDbListenersNow()`) តែ
រអិលកាត់ព្រោះការកែនោះប៉ះតែ **listener** មិនប៉ះ **SDK loader**។

`retryFirebaseSdkNow()` ត្រូវហៅពី `online` និង `visibilitychange`; វា
`clearFirebaseSdkRetry()` ដែល **reset ជណ្តើរ 5/10/20/30/60 វិ. មកសូន្យ** រួច
`initFirebase()` ភ្លាមៗ គ្មានពិដាន។ វាស់បាន៖

| សេណារីយ៉ូ | មុនកែ | ក្រោយកែ |
|---|---|---|
| `online` បាញ់ ១០ ដងក្នុង ១ វិ. | **១០ ការហៅ** | **១** |
| ការប្តូរ App រាល់ ១០ វិ. | ៦ | **៦** (ដដែល — ១០ វិ. > ពិដាន ៣ វិ.) |
| ការព្យាយាមលើកដំបូង | ១ | **១** (មិនត្រូវទប់) |

ច្បាប់៖ `FIREBASE_SDK_RETRY_MIN_GAP_MS` (៣ វិ.) ត្រូវ **តូចជាង** ជំហានដំបូង
នៃជណ្តើរ (៥ វិ.) បើមិនដូច្នេះជណ្តើរត្រូវលេបដោយពិដាន។ ⛔ **`clearFirebaseSdkRetry()`
មិនត្រូវ reset `lastFirebaseSdkAttemptAt` ទេ** — បើ reset នោះពិដានស្លាប់
ព្រោះ `retryFirebaseSdkNow()` ហៅវាមុនរាល់ការព្យាយាម។ ការ reset ពិដានធ្វើតែពេល
ភ្ជាប់ជោគជ័យ តាម `resetFirebaseSdkRetryHealth()`។ **កែទាំង ២ App។**

Test៖ **`connection-recovery-test.js`** (103 assertion — ស្កេនទាំង ២ App)។

### ⛔ ការស្តារ SDK ត្រូវជា **ការផ្ទុកទំព័រឡើងវិញ** — កំណែ 2.19.3

> 🔴 **ជណ្តើរ 2.18.0 ជាការស្តារដែលមិនអាចស្តារបាន។** វាមានពិដានល្បឿនត្រឹមត្រូវ
> ហើយ `connection-recovery-test.js` ចាក់សោពិដាននោះទុក — ប៉ុន្តែ **គ្មាន
> assertion ណាមួយសួរថា «តើការព្យាយាមនោះអាចជោគជ័យបានទេ?»** សោះ។

`firebase-loader.js` ជា `<script type="module">` ដែល `import` ពី
`www.gstatic.com`។ **វាស់ក្នុង Chromium ពិត** (module server ក្នុងមូលដ្ឋាន
ដែលធ្លាក់មួយដងរួចជាសះស្បើយ)៖

| សកម្មភាព | លទ្ធផល |
|---|---|
| import ដំបូង ខណៈ dependency ធ្លាក់ | ធ្លាក់ (រំពឹងទុក) |
| **import URL ដដែលឡើងវិញ** ក្រោយបណ្តាញមកវិញ | **នៅតែធ្លាក់** |
| import ជាមួយ query លើ URL **កម្រិតលើ** | **នៅតែធ្លាក់** |
| `<script type="module">` ថ្មី + query | **នៅតែធ្លាក់** |
| graph ថ្មីទាំងស្រុង (query ឆ្លងទៅ dependency) | ជោគជ័យ |
| **ការផ្ទុកទំព័រឡើងវិញ** | ជោគជ័យ |

មូលហេតុ៖ **module map របស់ browser cache ការបរាជ័យតាម URL ពេញអាយុទំព័រ**។
ការបន្ថែម query លើ entry point មិនជួយទេ ព្រោះ `firebase-auth.js` របស់ gstatic
`import` `firebase-app.js` តាម URL **ដដែល** ដែល cache ថាធ្លាក់រួច។

ដូច្នេះ `recoverFirebaseSdk()` ៖

- បើ `window.firebaseSDK` **មានហើយ** (SDK មកដល់យឺតជាង timeout ១៥ វិ.) ➜
  `initFirebase()` ធម្មតា — **កុំផ្ទុកទំព័រឡើងវិញ**។
- បើអត់ ➜ `reloadForFirebaseSdk()`។ វាមានពិដាន **៤ យ៉ាង** ដែលមិនអាចដកចេញបាន៖
  `firebaseSdkUnavailable` · `navigator.onLine !== false` ·
  **`anyModalIsOpen()` ➜ មិនផ្ទុកឡើងវិញ** (កុំលុប PIN ឬ Config ដែលអ្នកប្រើ
  កំពុងវាយ) · ពិដាន `FIREBASE_SDK_RELOAD_MAX` (៣) ក្នុងមួយវគ្គតាម
  `sessionStorage` បូក `FIREBASE_SDK_RELOAD_MIN_GAP_MS` (២០ វិ.)។
- ក្រោយអស់ពិដាន ➜ ធ្លាក់ទៅជណ្តើរចាស់ដដែល (មិនស្តារបាន តែក៏មិនបង្ក
  រង្វិលជុំផ្ទុកមិនចេះចប់លើបណ្តាញដែលទប់ gstatic ជាប់)។
- `armLateFirebaseSdkListener()` ៖ listener `firebasesdkready` តែ **១ដង**
  ដែលរស់ក្រៅ `waitForFirebaseSDK()` ➜ SDK ដែលមកដល់យឺត ចាប់បានភ្លាមដោយមិន
  បាច់រង់ចាំជណ្តើរ។
- ការភ្ជាប់ជោគជ័យ ➜ `resetFirebaseSdkRetryHealth()` សងពិដានផ្ទុកឡើងវិញមកវិញ។
- ⛔ **`recoverFirebaseSdk()` ត្រូវចាកចេញភ្លាមពេល `!firebaseSdkUnavailable`។**
  ការប្រណាំង៖ SDK មកដល់នៅវិនាទីទី ១៩ ➜ listener យឺតហៅ `initFirebase()` ➜
  ជោគជ័យ។ តែ timer ជណ្តើរនៅតែបាញ់នៅវិនាទីទី ២០ ➜ បើគ្មាន guard នេះ វានឹង
  ហៅ `initFirebase()` ម្តងទៀត ➜ `deleteApp()` + ភ្ជាប់ listener ឡើងវិញ
  **ខណៈ App កំពុងដំណើរការធម្មតា**។ (`retryFirebaseSdkNow()` មាន guard នេះ
  រួចហើយ; ផ្លូវ timer មិនមានទេ។)

⛔ **`retryFirebaseSdkNow()` ត្រូវហៅពី `online` **និង** `visibilitychange`
ទាំង ២ App។** ZoeKeyGen ខ្វះផ្លូវ `visibilitychange` រហូតដល់ 2.19.3 ហើយ
`shared-fns.js` **មើលមិនឃើញ** ព្រោះ handler ទាំងនោះមិនមែនជា
FunctionDeclaration ដែលមានឈ្មោះដូចគ្នាទេ — ZoeW ដាក់វាក្នុង
`setupConnectionRecovery()` (ដែលនៅក្នុង `EXPECTED_DIVERGENT`) ចំណែក ZoeKeyGen
ដាក់វាត្រង់ៗក្នុង `DOMContentLoaded`។ **មេរៀន៖ ត្រូវអះអាង *ព្រឹត្តិការណ៍*
ដោយផ្ទាល់ មិនមែនអះអាងតែ *function* ទេ។** លើទូរស័ព្ទ បណ្តាញដែលត្រឡប់មកវិញ
ជាញឹកញាប់ **មិនបាញ់ `online`** សោះ (`navigator.onLine` នៅ `true` ពេញការដាច់)
➜ ការប្តូរ App ចេញចូលជាសញ្ញាស្តារដ៏សំខាន់បំផុត។

### ⛔ ជណ្តើរស្តារ listener មិនត្រូវកាត់ផ្តាច់ resync ដែលកំពុងដើរ — កំណែ 2.19.3

`attemptDbListenerRecovery()` ហៅ `initDatabaseListeners()` ដែល **detach រួច
attach ទាំង ៦ path ឡើងវិញ** ➜ វាបោះបង់ snapshot ដែលកំពុងទាញចុះមក។ លើតំណយឺត
(2G ឬប្រវត្តិធំ) ការទាញអាចយូរជាងជំហានជណ្តើរ (ពិដាន ៣០ វិ.) ➜ រៀងរាល់ ៣០
វិនាទីវាចាប់ផ្តើមសាជាថ្មី ➜ **`dbListenerPendingPaths` មិនដែលអស់** ➜ តារាងកក
ជារៀងរហូត ខណៈស្លាកសរសេរ «កំពុងភ្ជាប់ឡើងវិញ...»។ វាស់បានលើកូដមុនកែ៖ path
**៥ ក្នុងចំណោម ៦** នៅជាប់ជារៀងរហូត។

`dbListenerResyncIsProgressing()` ជាអ្នកសម្រេច៖ ខណៈ `dbListenerPendingPaths.size`
**កំពុងតូចទៅៗ** ធៀបនឹង `dbListenerPendingSeen` នោះជណ្តើររង់ចាំ (មិន attach
ឡើងវិញ)។ បើវាឈប់តូច (ជាប់មែន) ជុំបន្ទាប់ attach ឡើងវិញដូចមុន ➜ **ការកែនេះ
ជាការពន្យារ មិនមែនការលុបការស្តារទេ**។ `dbListenerPendingSeen` ត្រូវដាក់ក្នុង
`initDatabaseListeners()` និង reset ក្នុង `resetDbListenerHealthState()`។

⛔ ពិដានល្បឿន 2.14.0 (`DB_LISTENER_RETRY_MIN_GAP_MS`) ទប់តែព្រឹត្តិការណ៍
**ខាងក្រៅ** (`online` · `visibilitychange` · `.info/connected`) — វា **មិនទប់
ជណ្តើរខ្លួនឯងទេ**។ នេះជាមូលហេតុដែលថ្នាក់នេះរស់រានក្រោយការកែនោះ។

### ⛔ Service worker មិនត្រូវធ្វើឲ្យ Cache Storage ក្លាយជាចំណុចដាច់តែមួយ — កំណែ 2.19.3

`event.respondWith(caches.open(...).then(...))` **គ្មានផ្លូវសម្រាប់ការបដិសេធ**។
`caches.open()` និង `cache.match()` អាចបោះបាន៖ Safari/iOS បោះ `SecurityError`/
`UnknownError` ពេល ITP ជម្រះ storage ឬពេលឧបករណ៍ជិតពេញ; Chrome បោះ
`QuotaExceededError`; គ្រប់ browser បោះពេលអ្នកប្រើចុច «Clear site data» ខណៈ
App នៅបើក។ ពេលនោះ promise របស់ `respondWith` បដិសេធ ➜ browser រាប់វាជា
**NetworkError** ➜ **រាល់សំណើធ្លាក់** ➜ អេក្រង់សទទេ ខណៈបណ្តាញដើរធម្មតា ហើយ
អ្នកប្រើ **ដោះមិនរួច** លុះត្រាតែដក service worker ចេញដោយដៃ។

ច្បាប់ (**`sw.js` ទាំង ៣**)៖ `networkOnly(request)` ជាផ្លូវធ្លាក់ចុះចុងក្រោយ
ហើយវាត្រូវភ្ជាប់ **៣ កន្លែង** — `cache.match()` (អាគុយម៉ង់ទី ២ របស់ `.then`),
`caches.open()` (`.catch` ខាងក្រៅ) និងការធ្លាក់ចុះទៅ `./index.html` ក្នុងផ្លូវ
navigate។ វាត្រូវ **resolve** ជា `Response.error()` ពេលបណ្តាញក៏ដាច់ដែរ —
មិនត្រូវបដិសេធឡើយ។

⚠️ **ថ្នាក់នេះរស់រានព្រោះ checker SW ទាំង ៥** (`offline-shell-test.js` ·
`sw-install-integrity-test.js` · `sw-shell-latency-test.js` ·
`sw-cache-key-test.js` · `sw-revalidate-pressure-test.js`) **សុទ្ធតែរត់លើ
Cache API ដែលដំណើរការធម្មតា** — គ្មានមួយណាសួរថា «បើ cache ខ្លួនវាបរាជ័យ
តើមានអ្វីកើតឡើង?»។ Test៖ **`sw-cache-failure-test.js`** (21 assertion,
ធ្លាក់ ១៨ លើ tree មុនកែ)។

### ⛔⛔ មូលហេតុឫសគល់៖ **checker ខ្លួនវាបៃតងក្លែងក្លាយ** — `checker-coverage.js`

> 🔴 **អ្នកប្រើសួរត្រង់ៗ (2026-08-26)៖** «ចឹងហើយបាន audit លើកណាក៏ជួបកំហុស
> មិនចេះចប់»។ គាត់ត្រូវ។ បញ្ហាមិនមែននៅកូដ App ទេ — វានៅត្រង់ថា **ឧបករណ៍
> ខ្លួនវាមិនអាចធ្លាក់បាន** ដូច្នេះកំហុសរអិលកាត់ជុំមួយទៅជុំមួយ។

វាស់បានក្នុងជុំនេះលើ checker ទាំង ៨១៖

| ថ្នាក់បៃតងក្លែងក្លាយ | ចំនួន |
|---|---|
| ជោគជ័យលើ **ថតទទេ** (ការអះអាងអវត្តមានគ្មានជាន់អប្បបរមា) | **៦** បូក `scan-engine-test` ដែលចេញជា SKIP |
| គ្មាន `*_APP_DIR` ➜ ចង្អុលទៅ tree ផ្សេងមិនបាន | **១៧** |
| មាន `*_APP_DIR` តែមិនត្រូវបានហៅក្នុងផ្នែក baseline របស់ `run-all.sh` | **១៥** |
| បញ្ឈប់ខ្លួនពេលរកឈ្មោះ function មិនឃើញ ➜ បិទបាំងការអះអាងឥរិយាបថ | **១** |

សរុប **៣២/៨១ (៤០%)** មិនអាចត្រូវបានផ្ទៀងផ្ទាត់ថា «មិនទទេ» បានទេ — ទោះបី
`CLAUDE.md` ចែងតាំងពីយូរមកហើយថារាល់តេស្តថ្មីត្រូវរត់លើ `git archive origin/main`។
**ច្បាប់នោះមិនអាចអនុវត្តបានលើ ៤០% នៃឧបករណ៍។**

#### ១. ការអះអាង **អវត្តមាន** ត្រូវមាន **ជាន់អប្បបរមា**

«គ្មានលំនាំអាក្រក់ទេ» ពិតដោយស្វ័យប្រវត្តិលើ input ទទេ។ ដូច្នេះការប្តូរឈ្មោះ
ឯកសារ · ការផ្លាស់កូដទៅឯកសារថ្មី · ការ refactor ដែលដក function ចេញ · ឬ
override ថតដែលខុស ➜ checker បៃតង **ខណៈវាមិនបានពិនិត្យអ្វីសោះ**។

រាល់ checker បែបនោះត្រូវអះអាងជាមុនសិនថា **វាពិតជាបានឃើញកូដ**៖

| checker | ជាន់អប្បបរមា |
|---|---|
| `stale-write.js` | កន្លែងសរសេរ >= ២ |
| `storage-guard.js` | ការសរសេរទៅ storage >= ២០ |
| `animation-cost.js` | stylesheet >= ២ · ច្បាប់ CSS >= ២០០ |
| `css-media-override.js` | stylesheet >= ២ · ច្បាប់ក្នុង `@media` >= ២០ |
| `compensation-order.js` | ឯកសារ >= ២ · ខ្សែសង្វាក់ `.then(` >= ៣០ |
| `comments.js` | ឯកសារ App ដែល ship >= ៦ |

⛔ **`scan-engine-test.js` ៖ ការបាត់ `zxing_reader.wasm` ជា *ការធ្លាក់* មិនមែន
SKIP ទេ។** ឯកសារនោះនៅក្នុង `CORE_SHELL` — បើវាបាត់ ការស្កេនស្លាប់លើផលិតកម្ម។
SKIP (exit 0) ត្រង់នោះជាការបៃតងក្លែងក្លាយ។ **SKIP ត្រូវរក្សាទុកសម្រាប់
dependency របស់បរិស្ថានតែប៉ុណ្ណោះ** (`playwright-core`, Chromium) មិនមែន
សម្រាប់ឯកសាររបស់ repo ខ្លួនឯងទេ។

#### ២. រាល់ checker ត្រូវអាចចង្អុលទៅ tree ផ្សេងបាន — **និងត្រូវបានហៅពិត**

រាល់ checker ត្រូវមាន `*_APP_DIR` ហើយ **រាល់ override ត្រូវត្រូវបានហៅក្នុង
ផ្នែក baseline របស់ `run-all.sh`**។ override ដែលមានតែឈ្មោះ គឺគ្មានតម្លៃទេ។

#### ៣. ⛔ កុំបញ្ឈប់ checker ពេលរកឈ្មោះ function មិនឃើញ — ត្រូវ **stub** ជំនួស

`process.exit(1)` ដោយ «រកមុខងារមិនឃើញ» **បិទបាំងការអះអាងឥរិយាបថទាំងអស់
ខាងក្រោមវា**។ ជុំ 2.19.3 ជួបវាដោយផ្ទាល់៖ ការបន្ថែម `dbListenerResyncIsProgressing`
ចូល `REQUIRED_FNS` ធ្វើឲ្យ tree មុនកែបង្ហាញ **`0 ok, 1 FAIL`** ជំនួសឲ្យ
**១១ ការធ្លាក់ដែលប្រាប់ថា *អ្វី* ខូច**។ ជំនួសវិញ៖ រាយវាជាការធ្លាក់ រួច
stub វា ដើម្បីឲ្យការអះអាងឥរិយាបថនៅតែរត់។

#### ៣ខ. ⛔ checker ដែលរស់ **តែក្នុង CI** — កំណែ 2.20.1

> 🔴 កើតឡើងពិត។ `run-all.sh` **បៃតងទាំង ៩៥** នៅមូលដ្ឋាន ➜ push ➜ CI ក្រហម
> ដោយ `33 ok, 10 fail`។

`.github/workflows/audit.yml` រត់ checker **៥** ដែល ២ (`emu/crud-rules-flow.js`
និង `emu/restore-deadlock-test.js`) **មិននៅក្នុង `run-all.sh` សោះ** ព្រោះ
ពួកវាត្រូវការ RTDB emulator។ ផល៖ ការប្តូរ `app.js` ដែលធ្វើឲ្យ sandbox
របស់ពួកវាខូច **មើលមិនឃើញនៅមូលដ្ឋាន** — វាលេចតែក្រោយ push។

ថ្នាក់ជាក់ស្តែងក្នុងជុំនេះ៖ ការបន្ថែម `DB_LISTENER_KEY_DELETED` ចូល
`app.js` ធ្វើឲ្យ **ឯកសារតេស្ត ៣ ខូច** តែ `run-all.sh` ចាប់បានតែ **១**៖

| ឯកសារ | ហេតុអ្វី |
|---|---|
| `restore-marker-hygiene-test.js` | ធ្លាក់ភ្លាម ✅ |
| `concurrent-scan-test.js` · `raw-read-shape-test.js` | **បៃតង** — សេណារីយ៉ូមិនកេះផ្លូវនោះ (`itemHasRestoreMarkers()` ត្រឡប់ false ➜ return មុន) |
| `emu/crud-rules-flow.js` | **មិនរត់សោះ** នៅមូលដ្ឋាន ➜ ក្រហមតែក្នុង CI |

**មេរៀន៖ «តើ checker នេះរត់ក្នុងស្ថានភាពណា» មិនគ្រប់គ្រាន់ទេ — ត្រូវសួរថា
«តើអ្វីខូច ខណៈគ្មាន checker ណាមួយប៉ះវាសោះ»។** ការគ្របតាម **សេណារីយ៉ូ**
មិនអាចជំនួសការគ្របតាម **រចនាសម្ព័ន្ធ** បានទេ។

ការកែ ២ ជាន់៖
- `run-all.sh` រត់ emu tests ដែរ។ គ្មាន emulator ➜ **SKIP ស្អាត**; CI ដាក់
  `CRUD_FLOW_STRICT=1` ដែលធ្វើឲ្យ SKIP នោះក្លាយជាការធ្លាក់ ➜ CI មិនបៃតង
  ក្លែងក្លាយទេ។
- `checker-coverage.js` ផ្នែក **២ខ** អះអាងថារាល់ `node audit-tools/…`
  ក្នុង `audit.yml` ត្រូវត្រូវបានហៅក្នុង **ផ្នែករត់ធម្មតា** របស់
  `run-all.sh` (មិនមែនផ្នែក baseline — ផ្នែកនោះរត់តែពេលមាន argument
  ដូច្នេះការលេចត្រឹមទីនោះមិនធានាអ្វីទេ)។ វាអានទាំង ២ ទម្រង់ —
  រង្វិលជុំ `for t in …` និងបន្ទាត់ `run "…" node audit-tools/x.js`។

⚠️ **ខ្ញុំបានសាកសង់ checker ស្តាទិចដែលអះអាងថា sandbox `vm` នីមួយៗប្រកាស
រាល់ថេរដែល function ដែលវាស្រង់យោង — រួច *ដកវាចេញ*។** វាឲ្យ false
positive **៨/៨** លើតេស្តដែលបៃតងពិត ព្រោះវាសន្មតខុសថារាល់ `sliceFn(…)`
ត្រូវចាក់ចូល `vm` (ជាការពិត វាច្រើនតែជាការស្រង់ **អត្ថបទ** សម្រាប់
ការអះអាងស្តាទិច ដូច `indexOf('TWO_HOURS_MS')`)។ ការបន្ថែម allowlist
សម្រាប់ ៨ ធាតុនោះនឹងធ្វើឲ្យវាក្លាយជា **ការការពារដែលងាប់** — ថ្នាក់ដដែល
នឹងអ្វីដែលជុំនេះទើបកែ។ **កុំសាងវាឡើងវិញដោយគ្មានការវិភាគ dataflow ពិត។**

#### ៤. ការវាស់ដ៏សំខាន់បំផុត៖ **ថតទទេ ➜ គ្មាន checker ណាមួយអាចជោគជ័យបានទេ**

`checker-coverage.js` **រត់ checker នីមួយៗពិត** ដោយចង្អុល `*_APP_DIR` ទៅថត
ទទេ។ checker ណាដែលនៅតែចេញ exit 0 គឺ **មិនអាចធ្លាក់បានទេ** ➜ ធ្លាក់។ នេះជា
ការវាស់ **ឥរិយាបថ** មិនមែន grep — វាមិនអាចត្រូវបញ្ឆោតដោយ comment ឬឈ្មោះទេ។

> ⚠️ **ច្បាប់សម្រាប់ checker ថ្មីគ្រប់ពេលចាប់ពីពេលនេះ** — មុននឹងជឿថា
> checker ថ្មីមួយដំណើរការ ត្រូវសួរសំណួរ **៤**៖
> ១. វាស្កេន **ឯកសារណា**ខ្លះ? (មេរៀន 2.12.1 · 2.16.0 · 2.19.1)
> ២. វាស្កេន **ទម្រង់វេយ្យាករណ៍ណា**ខ្លះ? (មេរៀន 2.19.3 — template literal ធៀបនឹងការតភ្ជាប់ខ្សែអក្សរ)
> ៣. វាពិនិត្យ **ទិសណា**? (មេរៀន 2.17.3 — marker ចូល និងចេញ)
> ៤. **តើវាអាចធ្លាក់បានទេ?** ➜ `node audit-tools/checker-coverage.js`
> ៥. **តើវាអាចព្យួរបានទេ?** (មេរៀន 2026-08-27 — `serviceWorker.ready` ឥតពិដាន ➜ CI cancel ២ ដង) ➜ `node audit-tools/hang-guard.js`

Test៖ **`checker-coverage.js`** (៤ ការអះអាង គ្រប checker ទាំង ៨១)។
Mutation ៖ ដកជាន់អប្បបរមាចេញពី `storage-guard.js` ➜ វាធ្លាក់ភ្លាម។

### ⛔ `html-sink-escaping.js` ត្រូវស្កេន HTML **ទាំង ២ ទម្រង់** — កំណែ 2.19.3

ឯកសារនោះស្កេនតែ `TemplateLiteral` រហូតដល់ 2.19.3 ➜ HTML ដែលសាងដោយ **ការ
តភ្ជាប់ខ្សែអក្សរ** (`'<tr><td>' + … + '</td>'`, ដូចក្នុង
`filterCustomerDataTable()`) ជា **ចន្លោះស្ងាត់**។ Mutation ពិត (ដក
`sanitizeInput()` ចេញពីជួរដេកតារាងអតិថិជន) **រអិលកាត់** មុនកែ ហើយធ្លាក់ក្រោយកែ។
កូដបច្ចុប្បន្នគ្មានការលេចធ្លាយទេ — នេះជាការបិទចន្លោះ។

**មេរៀន៖ សំណួរមិនមែនត្រឹម «checker ស្កេនឯកសារ*ណា*» ទេ — ក៏ត្រូវសួរថា
«វាស្កេន *ទម្រង់វេយ្យាករណ៍ណា*» ដែរ។**

### ⛔ marker របស់ `scan_history` មិនត្រូវធ្លាក់ចូលធុងសំរាម (កំណែ 2.17.3)

> 🔴 **កំហុសផលិតកម្មពិត** — ក្រោយ 2.17.2 ការស្តារបរាជ័យដោយ `PERMISSION_DENIED`
> ធាតុ **ស្ទួន** (នៅទាំង ២ កន្លែង) រួច «ដក»/«លុប» លើវា **ស្លាប់ជារៀងរហូត**។
> បង្កើតឡើងវិញបានលើ **RTDB emulator ពិត**។

`zoew_recently_deleted_cod_dod/$itemId` មាន `$other: { ".validate": false }` ហើយ
schema របស់វា **មិនមាន** `restoreClaimId` · `restoreClaimToken` · `clearClaim`
(ពួកវាជាកម្មសិទ្ធិរបស់ `zoew_scan_history_cod_dod` តែម្យ៉ាង)។ ដូច្នេះ៖

- **រាល់ផ្លូវសរសេរធុងសំរាមត្រូវឆ្លងកាត់ `stripHistoryOnlyMarkers()`** —
  `deleteSingleItem` · `removeSingleBarcode` · `claimAndCleanupItem` ·
  `buildClearHistoryTrashItem`។ បើភ្លេចមួយណា នោះធាតុដែលមាន marker សល់
  **មិនអាចផ្លាស់ចូលធុងសំរាមបានទៀតទេ រហូត** ➜ toast «បរាជ័យក្នុងការ Save
  ធុងសំរាមទៅ Firebase!» ដដែលៗ។
- **ការសម្អាតស្វ័យប្រវត្តិត្រូវរំលងធាតុដែលកំពុងស្តារ។**
  `runAutomaticCleanupRules()` និង `claimAndCleanupItem()` ធ្លាប់ការពារតែ
  `clearClaim`។ តាំងពី 2.17.2 ច្បាប់ ២ ម៉ោងបាញ់លើ **គ្រប់កញ្ចប់ចាស់**
  (ដើម្បីបោះត្រា `closedAt`) ➜ ឱកាសជាន់នឹងការស្តារកើនខ្លាំង ➜ ការសម្អាត
  ប្តូរ/លុបធាតុពាក់កណ្តាលផ្លូវ ➜ `finalizeClaimedRestore` ត្រូវ rules បដិសេធ
  ព្រោះ marker បាត់។ ឥឡូវ `itemHasRestoreMarkers()` ជា gate។
- **claim ដែលងាប់ត្រូវដោះ ដើម្បីកុំឲ្យទិន្នន័យជាប់គាំង។**
  `clearStaleRestoreMarkers()` បោស marker ចេញពីធាតុប្រវត្តិ ហើយ
  `releaseStaleRestoreClaimForPurge()` ដោះ `restoreClaim` ចេញពីធាតុធុងសំរាម
  មុន «លុបជាអចិន្ត្រៃយ៍» — **តែពេលហួស `RESTORE_CLAIM_LEASE_MS` (២ នាទី)**
  ប៉ុណ្ណោះ; claim ដែលនៅរស់មានន័យថាឧបករណ៍ផ្សេងកំពុងស្តារ ➜ កុំប៉ះ។

**មេរៀន៖ `payload-schema.js` ធ្លាប់ពិនិត្យតែ *ទិសមួយ*** — ថាផ្លូវស្តារមិន
បញ្ជូនវាលធុងសំរាមទៅ `scan_history`។ ទិសផ្ទុយ (វាល `scan_history` ធ្លាក់ចូល
ធុងសំរាម) **គ្មានអ្នកពិនិត្យ** ➜ កំហុសនេះ ship បាន។ ឥឡូវវាពិនិត្យ **ទាំង ២ ទិស**។
នេះជាថ្នាក់មេរៀនដដែលនឹង `network-timeout-test.js` (2.12.1) និង
`fluid-type-focus-test.js` (2.16.0)៖ **ពេលសរសេរ checker ត្រូវសួរថា វាពិនិត្យ
*ទិសណា* និង *ឯកសារណា*ខ្លះ។**

Test៖ **`restore-marker-hygiene-test.js`** (19 assertion)។

### កញ្ចប់ដែលយករួច «ខ្លះ» — ការបែងចែកតាម barcode (កំណែ 2.17.2)

> 🔴 **កែតាមរបាយការណ៍ពិតពីអ្នកប្រើ (2026-08-26, មានរូបថតជាភស្តុតាង)។**
> លេខ `0974158508` មាន barcode ២ — មួយបិទ «យករួច» តាំងពីម្សិលមិញ តែវា
> **នៅក្នុងបញ្ជីដដែល** ព្រោះបងប្អូនរបស់វានៅបើក។

មុន 2.17.2 ច្បាប់ ២ ម៉ោងដើរនៅ **កម្រិតកញ្ចប់ទាំងមូល** (`item.isClosed` =
គ្រប់ barcode បិទ)។ ផលៈ លេខទូរស័ព្ទដែលមានអីវ៉ាន់ ២ ហើយអតិថិជនយកតែ ១ ➜
កញ្ចប់ដែលយករួច **ជាប់ក្នុងបញ្ជីរហូតដល់ថ្ងៃទី ៨**។ ឥឡូវច្បាប់ ២ ម៉ោង
**ដើរតាម barcode នីមួយៗ**៖

| ច្បាប់ | អ្វីត្រូវបានវាស់ | ផលលើកញ្ចប់លាយ (A បិទ · B បើក) |
|---|---|---|
| ២ ម៉ោង (`reason='close'`) | **`barcode.closedAt` របស់ barcode នីមួយៗ** | A ចេញតែឯងជា `pickup` (**មិនប៉ះលុយ**); B និងនាឡិកា ៨ ថ្ងៃរបស់វា **នៅដដែល** |
| ៨ ថ្ងៃ (`reason='abandon'`) | `item.createdAt` រួចបែងចែកតាម `barcode.isClosed` | B ចេញជា `expired` (**ដកលុយ**); A ដែលបិទរួច **មិនត្រូវដកលុយ** |

**វាល `closedAt` ក្នុង barcode នីមួយៗ** (`barcodes/$idx/closedAt`) ជាមូលដ្ឋាន
នៃទាំងអស់នេះ។ ច្បាប់៖

- ការបិទ/បើកគ្រប់កន្លែងឆ្លងកាត់ **`applyBarcodeCloseState(barcode, closed, at)`**
  — កុំសរសេរ `b.isClosed = x` ត្រង់ៗវិញ បើមិនដូច្នេះត្រានឹងឃ្លាតពីស្ថានភាព។
  ផ្លូវទាំង ៤ ត្រូវប្រើវា៖ local + server នៃ `toggleIndividualBarcodeClose`
  និង local + server នៃ `togglePackageStatus`; ផ្លូវ revert ត្រូវស្តារត្រាដែរ
  (`previousState.barcodeClosedAt` និង `previousState.barcodeCloseStamps`)។
- **`barcodeCloseIsRipe(b, now)`** ជាអ្នកសម្រេចតែមួយ — `isClosed` **និង**
  `closedAt` ជាលេខ **និង** ហួស `TWO_HOURS_MS`។
- **`normalizeBarcodeCloseStamps(item, now)`** គ្រប TIN ទិន្នន័យចាស់៖ barcode
  ដែលបិទរួច តែគ្មាន `closedAt` ត្រូវ **បោះត្រា** (ពី `item.closedAt` បើមាន
  បើអត់ពី «ឥឡូវ») ➜ វាចេញ ២ ម៉ោងក្រោយ។ **កុំប្តូរវាទៅជា «លុបភ្លាម»** —
  ការធ្វើដូចនោះនឹងផ្លាស់កញ្ចប់ចាស់ទាំងអស់ចូលធុងសំរាមក្នុងវិនាទីតែមួយ។
- ការសម្អាតដែលរកឃើញថា **គ្មានអ្វីត្រូវធ្វើ ហើយក៏គ្មានត្រាថ្មី** ត្រូវ
  `return undefined` (បោះបង់ transaction) មិនមែន `return currentItem` ទេ —
  បើមិនដូច្នេះរាល់ជុំ ៦០ វិនាទីសរសេរជាន់រាល់កញ្ចប់ដោយឥតប្រយោជន៍។
- **`executeRestoreItem()` ត្រូវ reset `closedAt` របស់ barcode ដែលបិទ**
  ទៅ `getServerNow()` — បើភ្លេច ការស្តារពីធុងសំរាមនឹង **លោតចូលធុងសំរាមវិញ
  ក្នុងជុំសម្អាតបន្ទាប់** ព្រោះត្រាចាស់ហួស ២ ម៉ោងស្រាប់។ (ផ្លូវកម្រិត item
  ធ្វើដូចនេះរួចហើយតាំងពីមុន។)

⛔ **លុយនៅតែជាកម្មសិទ្ធិរបស់ `isDeducted` តែម្យ៉ាង។** ផ្លូវ ២ ម៉ោង —
ទាំង partial និង whole — **មិនហៅ `addRevenueToDailyAndMonthlyRecord()` ទេ**។
បើ `partialIsPickup` ត្រូវបានធ្វើឲ្យខុស នោះលុយរបស់អតិថិជនដែល **យកអីវ៉ាន់
រួចហើយ** នឹងត្រូវដកចេញពីស្ថិតិ។

**Firebase rules៖** `barcodes/$idx` មាន `$other: { ".validate": false }`
ទាំង `zoew_scan_history_cod_dod` និង `zoew_recently_deleted_cod_dod` ➜
`closedAt` ត្រូវមានក្នុង **ទាំង ២** បើមិនដូច្នេះ **រាល់ការបិទ barcode
ត្រូវបដិសេធ (`permission_denied`)**។ បន្ថែមក្នុងកំណែ 2.17.2 —
⚠️ **ត្រូវ publish ដោយដៃមុន deploy** (មើល `CHANGELOG.md`)។

Test៖ **`partial-pickup-cleanup-test.js`** (48 assertion — រត់ពេលវេលាពេញលេញ
លើកូដពិត)។ លេខ mutation ដែលវាស់បាន៖ ដក trigger ចេញ ➜ **១៥** ធ្លាក់;
ធ្វើឲ្យផ្លូវ pickup ដកលុយ ➜ **៨**; ធ្វើឲ្យថ្ងៃទី ៨ ដក barcode ដែលយករួចដែរ
➜ **៥**; ធ្វើឲ្យជុំទំនេរសរសេរជាន់ ➜ **១**។ ការ reset ត្រាពេលស្តារ
ចាក់សោដោយ **`policy-test.js`**។

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

**ច្បាប់នេះមាន checker តាំងពីជុំឧបករណ៍ 2026-08-26 — `clock-hygiene.js`។** មុននោះវាជា
ច្បាប់ដែលរស់នៅតែក្នុងឯកសារនេះ ➜ គ្មានអ្វីទប់ជុំក្រោយពីសរសេរ `Date.now()` ក្នុងផ្លូវ
retention ឡើយ។ វាស្កេនតាម **AST** មិនមែន regex ដូច្នេះវាចាប់ **ទាំង ២ ទម្រង់** តាមមេរៀន
ខាងលើ ហើយវាស្កេន **App ទាំង ៣ បូក `license-verify.js`**។ វាអះអាង ៤ ទិស៖

| ទិស | អ្វីដែលចាប់បាន |
|---|---|
| នាឡិកាឆៅត្រូវនៅតែក្នុង function ដែលមានហេតុផលសរសេរជាប់ | `Date.now()` ក្នុង function ថ្មី ឬក្នុង `barcodeCloseIsRipe()` |
| គ្មានវាល `*At` សរសេរពីនាឡិកាឧបករណ៍ | `trashItem.deletedAt = Date.now()` |
| គ្មានការប្រៀបធៀបបង្អួច retention នឹងវា | `(Date.now() - barcode.closedAt) > TWO_HOURS_MS` |
| **បញ្ជីអនុញ្ញាតគ្មានធាតុងាប់** | ធាតុដែលលែងប្រើ ➜ វានឹងលាក់កំហុសបន្ទាប់ |

បូកនឹងការអះអាងផ្ទាល់ថា `runAutomaticCleanupRules()` · `claimAndCleanupItem()` ·
`barcodeCloseIsRipe()` · `normalizeBarcodeCloseStamps()` **មិនប៉ះនាឡិកាឧបករណ៍សោះ**។
**ការបន្ថែម timer local ថ្មីត្រូវបន្ថែមឈ្មោះ function ក្នុង `LOCAL_CLOCK_OK` ជាមួយហេតុផល**
— កុំបន្ថែមធាតុទទេ។


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

### 📌 ការងារដែលនៅសល់ — ចាប់ផ្តើមជុំក្រោយត្រង់នេះ

**១០ ចំណុច — ត្រូវការការផ្ទៀងផ្ទាត់ពីអ្នកប្រើ មិនមែនកូដទេ។**

#### ០ជ. កំណែ 2.20.1 — ការស្តារបណ្តាញ · License · ការការពារដែលងាប់

**Firebase rules មិនប្រែសោះ** ហើយ **CSP ក៏មិនប្រែដែរ** — គ្រាន់តែ deploy។
ជុំនេះ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត ·
ស្ថិតិយក) ហើយ **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ**
ដែរ។ វាកែ **ទាំង ៣ App** (`zoew-v112` · `zoekeygen-v74` · `zoeimport-v10`)។
សូមផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត៖

1. **បិទ WiFi ទុកឲ្យតារាងដាច់ (រង់ចាំសារ «ដាចការទាញយកទិន្នន័យ…») រួច
   *ចាក់សោអេក្រង់ ➜ បើក WiFi ➜ ដោះសោ*** ➜ តារាងត្រូវ **ទាន់សម័យវិញបាន**
   ហើយសារត្រូវប្តូរជា «✅ ទិន្នន័យភ្ជាប់មកវិញហើយ»។ ⛔ វា **មិនត្រូវជាប់**
   «កំពុងភ្ជាប់ឡើងវិញ...» រហូតទេ។ (នេះជាកំហុសសំខាន់បំផុតនៃជុំនេះ។)
2. **ស្កេនកញ្ចប់ ៤–៥ ដងជាប់ៗគ្នាភ្លាមក្រោយចូលប្រព័ន្ធ** ➜ សារស្ថានភាព
   «ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ» ត្រូវ **នៅតែលេចឡើង** ក្រោយ
   ទិន្នន័យមកគ្រប់ — មិនត្រូវបាត់ដោយសារសារស្កេនច្រានវាចេញទេ។
3. **License ៖ ប្តូរកាលបរិច្ឆេទទូរស័ព្ទទៅមុខ ១ ឆ្នាំ ខណៈបិទ WiFi** រួចបើក
   App ➜ ⛔ វា **មិនត្រូវលុប Key** ហើយមិនត្រូវសុំ Activation Key ថ្មីទេ;
   វាត្រូវប្រាប់ថាត្រូវភ្ជាប់អ៊ីនធឺណិត។ រួច **កែកាលបរិច្ឆេទត្រឡប់វិញ +
   បើក WiFi** ➜ App ត្រូវត្រឡប់ជាធម្មតាភ្លាម។
   ⚠️ **សូមកុំភ្លេចកែនាឡិកាត្រឡប់វិញ** — តំបន់ម៉ោងឧបករណ៍នៅតែកំណត់ថា
   ចំណូលធ្លាក់ចូលថ្ងៃណា (ចំណុចដែលទទួលយកដោយចេតនា)។
4. **Activate Key ថ្មីខណៈនាឡិកាទូរស័ព្ទខុស** ➜ ត្រូវទទួលយកបាន (មុននេះ
   វាបដិសេធថា «Key នេះបានផុតកំណត់ហើយ!»)។
5. **កំណែថ្មីត្រូវមកដល់ដដែល** — បើក App ទុកចោលមួយសន្ទុះ រួច Refresh ➜
   ត្រូវឃើញ `2.20.1` (ZoeW) និង `2.19.4` (ZoeKeyGen) ក្នុងប្រអប់ login។
6. **ZoeImport** ៖ ការនាំចូលនៅដំណើរការដដែល (កំណែ `1.3.1`)។

#### ០ឆ. កំណែ 2.20.0 — ប៊ូតុង Reset ចំនួន «យករួច» តាមតម្រងថ្ងៃ

**Firebase rules មិនប្រែសោះ** — គ្រាន់តែ deploy។ ជុំនេះប៉ះតែ **ZoeW**
(ZoeKeyGen និង ZoeImport មិនប្រែ) ហើយ **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ ·
ការរមូរ · ទម្រង់បង្ហាញ** ក៏ **មិនប៉ះគោលការណ៍ «លុប» ទល់នឹង «ដក»** ដែរ។
សូមផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត៖

1. **ឈរលើតម្រង «ម្សិលមិញ»** ➜ ចុច (...) ➜ ត្រូវឃើញប៊ូតុង
   **«♻️ Reset ចំនួនយករួច (ម្សិលមិញ)»** នៅ **ខាងលើ** «❌ លុបទាំងអស់»។
   ស្លាកត្រូវប្តូរតាមតម្រង (ថ្ងៃនេះ · ម្សិលមិញ · ម្សិលម្ងៃ · ថ្ងៃផ្សេង · ទាំងអស់)។
2. **ចុចវា ➜ ត្រូវសុំ PIN** ជាមុនជានិច្ច ហើយសារក្នុងប្រអប់ត្រូវសរសេរអំពី
   **ការ Reset** មិនមែន «Config ឬ Reconfig» ទេ។
3. **ក្រោយវាយ PIN ➜ ប្រអប់បញ្ជាក់** បង្ហាញលេខបច្ចុប្បន្នទាំង ២ ➜ យល់ព្រម ➜
   **អតិថិជនយក និងកញ្ចប់យក របស់ «ម្សិលមិញ» ក្លាយជា 0**។
4. ⛔ **ប្តូរទៅ «ថ្ងៃនេះ» ➜ លេខត្រូវនៅដដែល** (មិនប៉ះពាល់)។
5. ⛔ **ទឹកប្រាក់ COD/DOD ស្ថិតិចំណូល និងបញ្ជីកញ្ចប់ មិនត្រូវប្តូរសោះ** —
   barcode ដែលបិទ «យក» នៅតែបិទ ហើយធុងសំរាមមិនប្រែ។
6. **Refresh ទំព័រ ➜ លេខនៅតែ 0** (មិនលោតត្រឡប់មកវិញ)។ បន្ទាប់មក **បិទ «យក»
   barcode ថ្មីមួយ** ➜ លេខឡើងពី 0 ធម្មតា។
7. **បិទ WiFi រួចចុច Reset** ➜ ត្រូវឃើញសារបរាជ័យ **មិនមែនសារជោគជ័យទេ**
   ហើយលេខមិនត្រូវក្លាយជា 0 ក្លែងក្លាយ។

#### ✅ កំណែ 2.19.4 — ស្ថិតិ «យក» ៖ អតិថិជន ↔ កញ្ចប់ — **ចប់រួច**

> ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-27, កំណែ 2.19.4) —
> អ្នកប្រើសាកសេណារីយ៉ូដែលគាត់រាយការណ៍ដោយផ្ទាល់ (២ កញ្ចប់លេខទូរស័ព្ទដូចគ្នា
> ➜ បិទ «យក» កញ្ចប់ ១ ➜ លុប ➜ ស្តារ merge ➜ **បើកវិញ**) ហើយបញ្ជាក់ថា
> **«ដំណើរការត្រឹមត្រូវហើយ»**។

⛔ **ដូច្នេះកុំកែតក្កវិជ្ជានេះដោយផ្អែកលើការសង្ស័យ** — វាមិនមែនជាកូដដែល
មិនទាន់សាកទេ។ កែបានតែពេលអ្នកប្រើរាយការណ៍បញ្ហាពិត ឬ `pickup-ledger-test.js`
ធ្លាក់។ អានផ្នែក «⛔ ស្ថិតិ «យក» ៖ អតិថិជន និងកញ្ចប់ ត្រូវរាប់លើ **មូលដ្ឋាន
តែមួយ**» ខាងលើឲ្យចប់សិន មុននឹងប៉ះ។

⛔ **កំណែជារបស់ App នីមួយៗក៏ផ្ទៀងផ្ទាត់រួចដែរ** — ជុំនោះ redeploy តែ
`zoew` (check ៥) ធៀបនឹងជុំមុន ៣ site (check ១១)។ កុំនាំការបង្ខំកំណែឲ្យ
ដូចគ្នាត្រឡប់មកវិញ; `version-bump-scope.js` ចាក់សោវា។

#### ០ច. កំណែ 2.19.3 — ស្តារពីការដាច់បណ្តាញឲ្យដើរបានពិត

**Firebase rules មិនប្រែសោះ** ហើយ **CSP ក៏មិនប្រែដែរ** — គ្រាន់តែ deploy។
ជុំនេះ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត)
និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ** ដែរ។
សូមផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត៖

1. **បើក App ខណៈបណ្តាញអន់ខ្លាំង** (ឬបិទ WiFi មួយភ្លែតពេលកំពុងបើក) រហូតឃើញ
   សារ «⚠️ ភ្ជាប់ Server មិនបានទេ…» ➜ រួចបើកបណ្តាញឲ្យដើរធម្មតាវិញ។
   **App ត្រូវភ្ជាប់បានដោយខ្លួនឯង** (អាចមានការផ្ទុកទំព័រឡើងវិញ ១ ដង) —
   មុននេះវាជាប់ «ក្រៅបណ្ដាញ» រហូតដល់អ្នកប្រើ Refresh ដោយដៃ។
2. **ការផ្ទុកឡើងវិញនោះមិនត្រូវក្លាយជារង្វិលជុំ** — បើបណ្តាញទប់ `gstatic.com`
   ជាប់ (ឧ. WiFi សាធារណៈដែលត្រូវ login) នោះវាត្រូវឈប់ក្រោយ **យ៉ាងច្រើន ៣ ដង**
   រួចបង្ហាញស្ថានភាព «ក្រៅបណ្ដាញ» ស្ងាត់ៗ។
3. ⛔ **ខណៈប្រអប់ PIN ឬ Config បើកនៅ វាមិនត្រូវផ្ទុកទំព័រឡើងវិញឡើយ** —
   អ្វីដែលអ្នកកំពុងវាយមិនត្រូវបាត់។
4. **ZoeKeyGen**៖ ធ្វើដូចចំណុច ១ ដដែល តែជំនួសការបើកបណ្តាញដោយ **ការប្តូរ App
   ចេញរួចចូលវិញ** ➜ វាត្រូវភ្ជាប់ភ្លាម (មុននេះមិនធ្វើអ្វីសោះ)។
5. **តារាងប្រវត្តិលើបណ្តាញយឺត** ៖ ក្រោយសារ «ដាចការទាញយកទិន្នន័យ…» លេចឡើង
   តារាងត្រូវ **ទាន់សម័យវិញបាន** — មិនត្រូវជាប់ «កំពុងភ្ជាប់ឡើងវិញ...» រហូតទេ។
6. **ការបើក App ធម្មតា ការស្កេន និងការ Export** នៅដដែលបេះបិទ។

#### ០ង. កំណែ 2.19.2 — វគ្គ ៤ ម៉ោងផុតកំណត់ ➜ toast និយាយការពិត

**Firebase rules មិនប្រែសោះ។** ជុំនេះប៉ះតែផ្លូវប្រកាស (toast) និងផ្លូវ
ចាកចេញ — **មិនប៉ះតក្កវិជ្ជាអាជីវកម្ម · PTR · ចលនាផ្ទាំង · ការរមូរសោះ**។
សូមផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត៖

1. **ទុក App ចោលឲ្យហួស ៤ ម៉ោង រួចបើកវិញ** ➜ ប្រអប់ login លោតមក ហើយសារ
   ដែលឃើញត្រូវជា **ទឹកក្រូច** «⏱️ ផុតកំណត់ ៤ ម៉ោងហើយ! សូមវាយពាក្យសម្ងាត់…»
   — **មិនត្រូវឃើញ «✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ» ទៀតទេ**។
2. **ចូលប្រព័ន្ធធម្មតា** (វគ្គថ្មី) ➜ សារ «✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យ
   ទាន់សម័យ» **នៅតែចេញដដែល** ក្រោយទិន្នន័យមកគ្រប់។ (បើវាលែងចេញ នោះជា
   សញ្ញាថា gate តឹងពេក។)
3. **ចុច «ចាកចេញ» ភ្លាមក្រោយចូល** (ក្នុង ២០ វិនាទី) ➜ សារត្រូវប្តូរជា
   «⚠️ បានចាកចេញពីប្រព័ន្ធ — សូមចូលប្រព័ន្ធម្ដងទៀត» មិនមែនវិលមកជោគជ័យវិញទេ។
4. **ZoeKeyGen** ៖ ការចូលប្រព័ន្ធនៅតែប្រកាសជោគជ័យធម្មតា ហើយការចាកចេញ
   ក្នុងវិនាទីដំបូងៗ មិនបន្សល់សារជោគជ័យទេ។

#### ០ឃ. កំណែ 2.19.1 — Export Excel ដើរវិញ

**Firebase rules មិនប្រែសោះ។** ជុំនេះប៉ះតែផ្លូវ Export របស់ ZoeW។
សូមផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត៖

1. **Export ➜ 📗 Excel (.xlsx)** ➜ ឯកសារត្រូវទាញយកបានពិត ហើយបើកក្នុង Excel
   ឬ Google Sheets បាន។ **លេខទូរស័ព្ទ និង Barcode ត្រូវជា TEXT** (មិនបាត់លេខ 0
   នាំមុខ)។
2. **បិទ WiFi រួច Export ម្តងទៀត** ➜ នៅតែដើរដដែល (SheetJS ស្ថិតក្នុង cache)។
3. បើមានកំហុសកើតឡើង សារត្រូវ **ប្រាប់មូលហេតុពិត** មិនមែនចោទអ៊ីនធឺណិតទេ។

#### ០គ. កំណែ 2.19.0 — Toast និងស្លាកស្ថានភាពនិយាយការពិត realtime

**Firebase rules មិនប្រែសោះ** — គ្រាន់តែ deploy។ ជុំនេះ **មិនប៉ះតក្កវិជ្ជា
អាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត) ហើយ **មិនប៉ះ PTR · ចលនាផ្ទាំង
ប្រវត្តិ · ការរមូរ** ដែរ។ សូមផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត៖

1. **បិទ WiFi រួចបើក App** ➜ ត្រូវឃើញសារ **ទឹកក្រូច** «ចូលប្រព័ន្ធរួច តែឧបករណ៍
   ក្រៅបណ្ដាញ — លេខដែលអ្នកឃើញមិនទាន់សម័យ» **មិនមែន «ចូលប្រព័ន្ធជោគជ័យ!» ទេ**
   ហើយស្លាកក្នុងរបាខាងលើត្រូវជា **ប្រផេះ** មិនមែនបៃតង។
2. **បើក WiFi វិញខណៈសារនោះនៅលើអេក្រង់** ➜ សារ **ដដែលនោះ** ត្រូវប្តូរខ្លួនវា
   ទៅ «កំពុងទាញទិន្នន័យ...» រួច «✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ»
   (បៃតង) — **មិនមែនលោត toast ថ្មីច្រើនទេ**។
3. **សារបរាជ័យ** (ឧ. Export ខណៈគ្មានបណ្តាញ) ត្រូវចេញ **ក្រហម** ហើយសារព្រមាន
   ចេញ **ទឹកក្រូច** — លែងមើលទៅដូចសារជោគជ័យ។
4. **ZoeImport** ៖ របាខាងលើត្រូវបង្ហាញស្ថានភាពតំណ ហើយពេលបិទបណ្តាញវាត្រូវ
   ប្តូរជា «ក្រៅបណ្ដាញ» **ភ្លាមដោយមិនបាច់ Refresh**។
5. **ZoeKeyGen** ៖ ការចូលប្រព័ន្ធត្រូវប្រកាសជោគជ័យ **តែពេលចំណុចស្ថានភាព
   បៃតង** ប៉ុណ្ណោះ។

#### ០ខ. កំណែ 2.18.0 — ធុងសំរាម ៣០ ថ្ងៃ · deadlock ៣ ខាង · ពិដាន SDK

⛔ **ត្រូវ publish `firebase-database.rules.json` ដោយដៃមុន deploy** — ការប្តូរ
មានតែ ២ បន្ទាត់ (ដក `!data.exists()` ចេញពី witness ទាំង ២)។ បើមិន publish
នោះ **deadlock ៣ ខាងនៅដដែល**។ `ZoeKeyGen/firebase-database.rules.json`
**មិនប្រែទេ**។

ជុំនេះ **មិនប៉ះទម្រង់ · PTR · ចលនាផ្ទាំង · ការរមូរសោះ** ហើយ **គោលការណ៍
«លុប» ទល់នឹង «ដក» មិនប្រែសោះ** (ជួរ ៤ និង ៨ ដែលប៉ះលុយ មិនត្រូវប៉ះទេ)។
សូមផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត៖

1. **ធុងសំរាមសរសេរ «លុបអចិន្ត្រៃយ៍បន្ទាប់ពី ៣០ ថ្ងៃ»** ហើយធាតុចាស់នៅតែ
   មើលឃើញយូរជាងមុនមួយដង។
2. **ស្តារ 🔄 · ដក · លុប · ✖️ លុបជាអចិន្ត្រៃយ៍** ដំណើរការធម្មតា ហើយ
   **ស្ថិតិចំណូលមិនប្រែខុស** — ជាពិសេសការស្តារធាតុដែលធ្លាប់ «ដក»
   (លុយត្រូវបូកត្រឡប់ **១ ដងគត់**)។
3. **ធាតុដែលការស្តាររបស់វាធ្លាប់បរាជ័យ** (បើមាន) ➜ ឥឡូវស្តារ ឬលុបបាន។
4. **បិទ WiFi រួចបើកវិញច្រើនដងជាប់ៗគ្នា ខណៈបណ្តាញអន់** ➜ App ត្រូវភ្ជាប់
   មកវិញ **លឿនដូចមុន ឬលឿនជាង** — មិនត្រូវយឺតជាងមុនទេ។ (ពិដាន SDK ថ្មី
   ទប់តែការព្យាយាមដែលជាន់គ្នាក្នុង ៣ វិនាទី; ការព្យាយាមលើកដំបូងមិនត្រូវទប់។)


#### ០ក. កំណែ 2.17.4 + 2.17.5 — ស្ថេរភាពបណ្តាញ · ការលាក់ secret · សម្របតាមតំណ

> ℹ️ **កំណែ 2.17.5 ជាជុំតាមដាន** — វាបិទចន្លោះដែល 2.17.4 រកឃើញតែទុកចោល
> (ការលាក់ឈ្មោះ param បែប camelCase/hyphen · Apps Script deployment ID ·
> error callback របស់ `.info/connected` · `ZoeImport`/`zto-import` ចូល
> `run-all.sh`)។ បញ្ជីផ្ទៀងផ្ទាត់ខាងក្រោម **គ្របទាំង ២ កំណែ**។

**Firebase rules មិនប្រែទេ** — គ្រាន់តែ deploy។ ជុំនេះ **មិនប៉ះតក្កវិជ្ជា
អាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត) ហើយ **មិនប៉ះទម្រង់ · PTR ·
ចលនាផ្ទាំង · ការរមូរ** ដែរ។ សូមផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត៖

1. **បិទ WiFi រួចបើកវិញច្រើនដងជាប់ៗគ្នា** (ធ្វើត្រាប់តាមតំបន់សេវាអន់)
   ➜ App ត្រូវភ្ជាប់មកវិញ **លឿនដូចមុន ឬលឿនជាង** — មិនត្រូវយឺតជាងមុនទេ។
2. **License នៅ active ដដែល** ក្រោយបណ្តាញអន់/ដាច់ — **មិនត្រូវលោតប្រអប់
   សុំ Activation Key ទេ**។ (នេះជាចំណុចសំខាន់បំផុតនៃជុំនេះ។)
3. **ការស្កេន និងការទាញលេខទូរស័ព្ទស្វ័យប្រវត្តិ** នៅដំណើរការដដែល។
4. បើទូរស័ព្ទបើក **«Data Saver»** ៖ App នៅដំណើរការគ្រប់មុខងារដដែល
   (តារាងអតិថិជនទាញពេលបើកមើល ជំនួសការទាញជាមុន)។ កំណែថ្មីនៅតែមកដល់ដដែល។

> ℹ️ ចំណុច ២ ត្រូវបានចាក់សោដោយ `license-grace-test.js` (១៣) និង
> `license-network-pressure-test.js` (១៤) — ការរំលងត្រឡប់ `{ ok: null }`
> ដែល **មិនលុប** record មូលដ្ឋាន។ ប៉ុន្តែសូមផ្ទៀងផ្ទាត់លើផលិតកម្មពិតដដែល។


> ℹ️ **ជុំឧបករណ៍ 2026-08-26 (នាឡិកា + ជម្រៅ fuzz) មិនត្រូវការការផ្ទៀងផ្ទាត់ទេ**
> — វាមិនប៉ះកូដ App សោះ (`APP_VERSION` និង `CACHE_VERSION` ដដែល)។ វាបន្ថែម
> `clock-hygiene.js` និង op `sweepPickup` ក្នុង `revenue-fuzz-test.js`។
> ការរត់ជម្រៅលើកូដពិត (៣៤ លំដាប់ × ៦០ ប្រតិបត្តិការ) **មិនរកឃើញកំហុសថ្មីទេ**។

#### ០. កំណែ 2.17.3 — ជួសជុលការស្តារ និង marker ដែលជាប់គាំង

**Firebase rules មិនប្រែទេ** — គ្រាន់តែ deploy។ សូមផ្ទៀងផ្ទាត់៖

1. **ស្តារពីធុងសំរាម** ➜ ធាតុចេញមកប្រវត្តិ **ហើយបាត់ពីធុងសំរាម** (លែងស្ទួន)។
2. **«ដក» និង «លុប»** លើធាតុដែលធ្លាប់ជាប់គាំង ➜ ដំណើរការវិញ។
3. **✖️ លុបជាអចិន្ត្រៃយ៍** លើធាតុដែលការស្តាររបស់វាធ្លាប់បរាជ័យ ➜ លុបបាន។
4. **ស្ថិតិចំណូល និងចំនួនកញ្ចប់** ត្រឡប់ជាត្រឹមត្រូវក្រោយ Refresh។

#### ១. កំណែ 2.17.2 — barcode «យករួច» ចេញក្នុង ២ ម៉ោង ដោយឯករាជ្យ

⛔ **ត្រូវ publish Firebase rules មុន deploy** (`closedAt` ក្នុង
`barcodes/$idx` នៃ node ទាំង ២) — បើមិនដូច្នេះ **ការបិទ «យករួច»
ត្រូវបដិសេធទាំងស្រុង**។ រួចសូមផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត៖

1. **លេខទូរស័ព្ទដែលមាន barcode ២ ➜ បិទ «យក» តែ ១** ➜ ក្រោយ ២ ម៉ោង
   barcode នោះ **ចេញពីបញ្ជី** ហើយចូលធុងសំរាមជាស្លាក **«យករួច»**
   ចំណែក barcode មួយទៀត **នៅដដែល**។
2. **ស្ថិតិចំណូលមិនប្រែសោះ** ពេលនោះ (មិនមែនការ «ដក» ទេ)។
3. **កញ្ចប់ចាស់ដែលបិទរួចមុនកំណែនេះ** (ដូចលេខ `0974158508`) ➜ ចេញក្នុង
   ~២ ម៉ោងក្រោយបើក App កំណែថ្មី មិនមែនភ្លាមៗទេ។
4. **ស្តារពីធុងសំរាម** ➜ កញ្ចប់ត្រឡប់មកបញ្ជីវិញ ហើយ **មិនលោតចូល
   ធុងសំរាមភ្លាម** (នាឡិកា ២ ម៉ោងចាប់ផ្តើមឡើងវិញ)។

#### ២. កំណែ 2.17.1 — ជុំ deep audit (កំហុសផលិតកម្ម ៣)

កំហុសទាំង ៣ **បង្ហាញភស្តុតាងក្នុង browser ពិត** មុនកែ ហើយមានឧបករណ៍ចាក់សោ
ឥឡូវនេះ។ ប៉ុន្តែ ២ ក្នុងចំណោមនោះទាក់ទងនឹង **បណ្តាញពិត** ដែលបរិស្ថាន audit
មិនអាចបង្កើតឡើងវិញបានពេញលេញ (មើលមេរៀន CDN)។ ដូច្នេះសូមផ្ទៀងផ្ទាត់៖

1. **បិទ WiFi ➜ បើក App ថ្មី** ➜ ត្រូវឃើញ **«ក្រៅបណ្ដាញ»** និង toast
   «កំពុងព្យាយាមម្តងទៀត» — **មិនត្រូវឃើញប្រអប់ PIN សុំកំណត់ Config ឡើងវិញទេ**។
   រួចបើក WiFi ➜ App ត្រូវភ្ជាប់ដោយខ្លួនឯងក្នុងរយៈពេលខ្លី (មិនបាច់ Refresh)។
2. **បាត់ WiFi យូរ (>១ នាទី) រួចបើកវិញ** ➜ ចំណុចស្ថានភាពត្រូវត្រឡប់ជា
   បៃតងលឿនជាងមុន (វដ្ត `goOffline()`+`goOnline()` ឥឡូវរត់បានពិត)។
3. **ធុងសំរាម** — តួលេខសរុប ២ ក្រុមនៅត្រឹមត្រូវដដែល ហើយការស្វែងរក
   មិនបិទក្រុមដែលពង្រីករួច។

#### ✅ កំណែ 2.17.0 — ធុងសំរាម និងទម្រង់ឆ្លាតតាមឧបករណ៍ — **ចប់រួច**

> ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-25, កំណែ 2.17.0) —
> Firebase rules (`trashReason`) ត្រូវបាន publish មុន merge; PR #83
> បញ្ចូល `main` ជា `f33062d`។ អ្នកប្រើបញ្ជាក់ថា **«ដំណើរការល្អ»**៖
> ស្លាកធុងសំរាមទាំង ៤ ត្រឹមត្រូវ · តួលេខសរុប ២ ក្រុមត្រូវ · ការ merge
> មិនលាក់ធាតុ · ការស្តារ 🔄 និងលុប ✖️ ដើរធម្មតា · **ទម្រង់ទូរស័ព្ទ
> មិនប្តូរសោះ** · ថេប្លេត និងកុំព្យូទ័រអានងាយ គ្មានចន្លោះទទេធំ។

**ដូច្នេះកុំ «កែ» តំបន់ទាំងនេះដោយផ្អែកលើការសង្ស័យ** — វាមិនមែនជាកូដ
ដែលមិនទាន់សាកទេ។ អានផ្នែក «ធុងសំរាម និង `trashReason`» និង
«ទម្រង់ឆ្លាតតាមឧបករណ៍» ខាងលើឲ្យចប់សិន មុននឹងប៉ះ។

#### ក. កំណែ 2.15.0 · 2.16.0 — មាត្រដ្ឋានអក្សរ · សញ្ញាផ្តោត · ទម្រង់អេក្រង់ធំ

`fluid-type-focus-test.js` វាស់ក្នុង Chromium ថាទំហំអក្សរ **ត្រូវតាមខ្សែកោង**
និងថារង្វង់ផ្តោត **លេចមែន** ប៉ុន្តែវាមិនអាចវិនិច្ឆ័យថា *មើលទៅសមរម្យឬអត់* ទេ។
ដូច្នេះសូមអ្នកប្រើមើលលើឧបករណ៍ពិត៖

1. **អក្សរក្នុងតារាងប្រវត្តិ និងស្លាក Barcode អានងាយជាងមុន** លើទូរស័ព្ទធំ
   ហើយ **គ្មានអ្វីលើសគែម ឬកាត់ពាក់កណ្តាល** (ជួរ Action, ស្លាកទូ Locker)។
2. **លើទូរស័ព្ទតូច (320–360px) គ្មានអ្វីប្តូរសោះ** — បើមានអ្វីមើលទៅខុសពីមុន
   នោះជាសញ្ញាថាមានច្បាប់ណាមួយរអិលចេញពីមាត្រដ្ឋាន។
3. **ការចុចប៊ូតុងដោយម្រាមដៃមិនបន្សល់រង្វង់ខៀវ** (រង្វង់គួរលេចតែពេលប្រើ
   ក្តារចុច ឬម៉ាស៊ីនស្កេន hardware)។
4. **ZoeKeyGen លើកុំព្យូទ័រ** (កំណែ 2.16.0)៖ «បង្កើត Key ថ្មី» និង
   «បង្កើត Setup Link» ត្រូវនៅ **ក្បែរគ្នា** ហើយបញ្ជី Key ពេញទទឹង។
   លើទូរស័ព្ទត្រូវនៅដដែល។
5. **អក្សរនៅ ≥992px (ZoeW) និង ≥900px (ZoeKeyGen · ZoeImport) ធំជាងទូរស័ព្ទ
   មួយកម្រិត** ហើយមើលទៅសមរម្យ មិនធំហួសហេតុ។

#### ខ. កំណែ 2.14.0 — ធនធានឆ្លង origin (នៅរង់ចាំដដែល)

កំណែ **2.14.0** ប្តូរ **ផ្លូវផ្ទុកធនធានឆ្លង origin** (Sentry ➜ `async`;
ពុម្ពអក្សរ ➜ `media="print"` + ប្តូរទៅ `all` ក្នុង `boot-flags.js`)។ ឯកសារនេះ
កត់ត្រារួចថា បរិស្ថាន audit នៅទីនេះ **មិនអាចបង្កើតឥរិយាបថ CDN ពិតឡើងវិញបានទេ**។
ដូច្នេះមុន merge ត្រូវសាកលើ **deploy preview ពិត + ឧបករណ៍ពិតទាំង ២ ប្រព័ន្ធ**៖

1. **អក្សរខ្មែរបង្ហាញត្រឹមត្រូវ** (Kantumruy Pro មកដល់ ហើយមិនមាន FOUT យូរខុសធម្មតា)។
2. **ចលនា boot រលូន** លើ iPhone និង Android ហើយ **PTR នៅតែភ្លាមៗ**។
3. **Sentry នៅតែទទួល event** (បង្កកំហុសសាកល្បងមួយ រួចពិនិត្យក្នុង Sentry)។

បើ ៣ ចំណុចនេះបៃតង នោះជុំនេះចប់ ហើយត្រូវកត់ត្រា «✅ ផ្ទៀងផ្ទាត់លើផលិតកម្មពិត»
នៅទីនេះដូចជុំមុនៗ។

### ✅ ladder ភ្ជាប់ឡើងវិញ — **វាស់រួច ហើយកែរួច** (កំណែ 2.13.0)

ជុំមុនកត់ត្រាការសង្កេតនេះទុកដោយ **មិនកែ** ព្រោះគ្មានការវាស់។ ជុំនេះបានវាស់វា។

**បញ្ហា៖** `goOffline()` មិនត្រឹមតែ reset backoff ខាងក្នុងរបស់ SDK ទេ — វា
**កាត់ផ្តាច់ការតភ្ជាប់ដែលកំពុងដំណើរការ** ដែរ។ ពេល boot នោះ `.info/connected`
បាញ់ `false` ភ្លាម ➜ watchdog ➜ បើ handshake ដំបូងយឺតជាង ៥ វិនាទី នោះវដ្តនោះ
**សម្លាប់ handshake ដែលជិតរួច** ហើយចាប់ផ្តើមឡើងវិញ។ មុនការភ្ជាប់ជោគជ័យលើក
ដំបូង backoff របស់ SDK នៅតូច ➜ **គ្មានអ្វីត្រូវ reset** ➜ ជាការចំណាយសុទ្ធសាធ។

**លេខដែលវាស់បាន** (`audit-tools/reconnect-ladder-test.js` — កូដពិតធៀបនឹងគំរូ
នៃ connection របស់ RTDB)៖

| សេណារីយ៉ូ | ladder ចាស់ | ក្រោយកែ |
|---|---|---|
| handshake ០,៥–៤ វិ. | ដដែល | **ដដែល** (គ្មានការប្រែ) |
| handshake ៨ វិ. (2G) | ១៣,០ វិ. | **៨,០ វិ.** |
| handshake ១៥ វិ. | ៣០,០ វិ. | **១៥,០ វិ.** |
| handshake ២៥ វិ. | ៦០,០ វិ. | **២៥,០ វិ.** |
| boot ក្រៅបណ្តាញ ➜ WiFi មកវិញ | ដដែល | **ដដែល** |
| ធ្លាប់ភ្ជាប់ ➜ ដាច់ ➜ ត្រឡប់មក | ដដែល | **ដដែល** |

**ដំណោះស្រាយ៖ `canCycleDatabaseConnection()`។** វដ្តត្រូវអនុញ្ញាតតែពេលមាន
ហេតុផលជឿថា SDK កំពុង **អង្គុយក្នុងបង្អួច backoff** ប៉ុណ្ណោះ៖

- `hasEverConnectedToDatabase` — ធ្លាប់ភ្ជាប់រួច ➜ backoff អាចរីកធំ ➜ វដ្តមានតម្លៃ
- `networkJustReturned` — ព្រឹត្តិការណ៍ `online` ទើបបាញ់ ➜ ដដែល (ទង់ **ប្រើតែម្តង**)
- បើគ្មានទាំង ២ (មិនដែលភ្ជាប់ + បណ្តាញឡើងជាប់) ➜ `goOnline()` ធម្មតាតែប៉ុណ្ណោះ

**កុំដកលក្ខខណ្ឌនេះចេញ។** បើដក នោះ `reconnect-ladder-test.js` ធ្លាក់ភ្លាម
(វាប្រៀបធៀប **កូដដែល ship រួច ធៀបនឹង ladder ចាស់ ដោយផ្ទាល់** ដូច្នេះវាមិន
អាចទទេបានទេ)។ `RECONNECT_WATCHDOG_STEPS_MS` **មិនប្រែទេ** — ការវាស់បង្ហាញ
ថាបញ្ហាមិនមែននៅចន្លោះពេលទេ គឺនៅ **អ្វីដែលវដ្តនោះកាត់ផ្តាច់**។

> ⚠️ តេស្តនោះប្រើ **គំរូ** នៃ SDK មិនមែន SDK ពិតទេ។ អ្វីដែលវាបញ្ជាក់គឺ
> តក្កវិជ្ជា — មិនមែនល្បឿនបណ្តាញពិត។ ការកែបន្ថែមក្នុងតំបន់នេះនៅតែត្រូវ
> សាកលើឧបករណ៍ពិតមុន merge ដដែល។

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
| CSS បំបែក / លើសទទឹង លើអេក្រង់តូច · **និង App ដែលនៅជាជួរឈរទូរស័ព្ទលើកុំព្យូទ័រ** | `layout-check.js` |
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
| SW activate ដោយ APP_SHELL មិនពេញ ➜ ស្កេនស្លាប់ស្ងាត់ៗពេលក្រៅបណ្តាញ | `sw-install-integrity-test.js` |
| timeout ដែលមិន abort សំណើ ➜ សំណើជាន់គ្នា និងការអានតួព្យួររហូត | `network-timeout-test.js` |
| ចលនាផ្ទាំងប្រវត្តិលើ iOS ឃ្លាតពី Android | `ios-panel-glide-test.js` |
| Sentry មកយឺត/DSN ប្តូរ ➜ កំហុសធ្លាក់ចោលស្ងាត់ៗ | `sentry-load-race-test.js` |
| listener ដែលត្រូវបោះបង់ ➜ តារាងកក ខណៈស្ថានភាពនៅបៃតង + ការ reset backoff | `connection-recovery-test.js` |
| URL រសើប (Setup Link) ជាប់ក្នុង Cache Storage ក្រោយចាកចេញ | `sw-cache-key-test.js` |
| ការទប់ស្កាត់ Barcode ស្ទួន (ជាន់ការពារទាំង ៥) | `duplicate-scan-test.js` |
| សំបកដែល cache ទុករួច នៅតែរង់ចាំបណ្តាញ ➜ បើក App យឺតលើបណ្តាញខ្សោយ | `sw-shell-latency-test.js` |
| សំណើកកកុញពេលបណ្តាញ «ភ្ជាប់តែស្លាប់» ➜ ពេញកូតា connection | `network-pressure-test.js` |
| ខ្សែអក្សរពី Firebase ធ្លាក់ចូល attribute របស់ handler | `inline-handler-xss-test.js` |
| CSP បិទមុខងារលើផលិតកម្ម ខណៈតេស្តគ្មាន CSP ជោគជ័យ | `csp-enforced-test.js` |
| វដ្តភ្ជាប់ឡើងវិញកាត់ផ្តាច់ handshake ដែលកំពុងដំណើរការ | `reconnect-ladder-test.js` |
| កាមេរ៉ាកកក្រោយប្រអប់ native (`confirm`/`alert`) | `camera-resume-test.js` |
| ការចាត់ថ្នាក់/merge/សរុបលុយ របស់ធុងសំរាម និង `trashReason` ↔ rules | `trash-modal-test.js` |
| marker ស្តារធ្លាក់ចូលធុងសំរាម ➜ «ដក»/«លុប» ស្លាប់ជារៀងរហូត · ការសម្អាតលួចដណ្តើមធាតុដែលកំពុងស្តារ | `restore-marker-hygiene-test.js` |
| witness ដែលបន្សល់ ➜ **ស្តារមិនបាន · លុបមិនបាន ជារៀងរហូត** (rules ពិតលើ emulator ពិត) | `emu/restore-deadlock-test.js` |
| barcode ដែលយករួច មិនចេញក្នុង ២ ម៉ោង ឬត្រូវដកលុយខុសពេលបងប្អូនផុតកំណត់ | `partial-pickup-cleanup-test.js` |
| ប៊ូតុង Reset ស្ថិតិយក ៖ លុប node ចោល ➜ លេខលោតត្រឡប់មកវិញ · មិនគោរពតម្រង · ប៉ះលុយ | `pickup-reset-test.js` |
| `fb.X` ដែល `firebase-loader.js` មិន export ➜ `undefined` លើផលិតកម្ម | `sdk-surface.js` |
| ការបើកក្រៅបណ្តាញបង្ហាញប្រអប់ PIN/Config ជំនួសស្ថានភាព «ក្រៅបណ្ដាញ» | `sdk-offline-boot-test.js` |
| នាឡិកាឧបករណ៍ឆៅក្នុងផ្លូវ retention/revenue (`Date.now()` **និង** `new Date()`) | `clock-hygiene.js` |
| សំណើ License កកកុញ ➜ សំណើចាំបាច់ជាប់គាំង (ផ្លូវបណ្តាញទី ៣) | `license-network-pressure-test.js` |
| ការងារបណ្តាញស្រេចចិត្តមិនសម្របតាម 2G/Data Saver | `adaptive-link-test.js` |
| `${...}` ក្នុង template HTML ដែលមិនឆ្លងកាត់ `sanitizeInput()` | `html-sink-escaping.js` |
| ការធ្វើឲ្យសំបកស្រស់ខាងក្រោយស៊ីកូតាការតភ្ជាប់អស់ ➜ សំណើចាំបាច់ចេញមិនបាន | `sw-revalidate-pressure-test.js` |
| ចលនា boot + **ធនធានឆ្លង origin ក្នុង `<head>` ដែលទប់ការគូរ** | `boot-animation-test.js` |
| មាត្រដ្ឋានអក្សរបែកគ្នា + សញ្ញាផ្តោតតាមក្តារចុចដែលបាត់ | `fluid-type-focus-test.js` |
| toast អះអាងជោគជ័យខណៈក្រៅបណ្ដាញ **ឬក្រោយវគ្គចូលប្រព័ន្ធស្លាប់** · ថ្នាក់ toast គ្មានពណ៌ខុសគ្នា · ស្លាកស្ថានភាពពណ៌ថេរ | `toast-truth-test.js` |
| ធនធានផ្ទុក**យឺត** ដែល CSP ទប់ (Export Excel ស្លាប់លើផលិតកម្ម) | `csp-lazy-resource-test.js` |
| Cache Storage បរាជ័យ ➜ **រាល់សំណើធ្លាក់** ➜ អេក្រង់សទទេ ខណៈបណ្តាញដើរធម្មតា | `sw-cache-failure-test.js` |
| **checker ខ្លួនវាបៃតងក្លែងក្លាយ** — ជោគជ័យលើថតទទេ · ចង្អុលទៅ tree ផ្សេងមិនបាន · បិទបាំងការអះអាង | `checker-coverage.js` (**រត់នេះមុនគេ**) |
| **checker ខ្លួនវាព្យួរ** ➜ GitHub cancel job នៅនាទីទី ៣០ ដោយគ្មានឈ្មោះ checker សោះ | `hang-guard.js` (**រត់នេះមុនគេដែរ**) |

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
- **Fuzz ដែលកេះការសម្អាតត្រូវចាស់ត្រា *តាម barcode* មិនមែនតាមកញ្ចប់។** រហូតដល់
  ជុំឧបករណ៍ 2026-08-26 ការសម្អាតក្នុង `revenue-fuzz-test.js` ប៉ះតែ
  `zoew_scan_history_cod_dod/$id/closedAt` (កម្រិត **កញ្ចប់**) ➜ ផ្លូវ «កញ្ចប់លាយ»
  របស់កំណែ 2.17.2 (A បិទ · B បើក ➜ `claimedPartial`) **មិនដែលត្រូវរត់សោះ**។
  វាស់បាន៖ mutation ដែលប្តូរ `claimedPartial` ពី `ripeClosed` ➜ `keptBarcodes`
  (ការជាន់អថេរ — ថ្នាក់កំហុសពិត) **រស់រានពេញ ២០ លំដាប់ × ៥៥ ប្រតិបត្តិការ**។
  ក្រោយបន្ថែម op **`sweepPickup`** (ចាស់ត្រា `barcodes/$idx/closedAt` ដោយផ្ទាល់)
  mutation ដដែលធ្លាក់ក្នុង **១២ លំដាប់ × ៤៥**។ **មេរៀន៖ ការគ្របតេស្តត្រូវតាមដាន
  កម្រិតដែលកូដសម្រេច** — 2.17.2 បានបញ្ចុះការសម្រេចពីកម្រិតកញ្ចប់ទៅកម្រិត barcode
  ប៉ុន្តែ fuzz នៅជាប់កម្រិតចាស់។

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


## ZoeImport និង zto-import — នាំចូល Excel ចូល Sheet

ខ្សែសង្វាក់ជំនួសការ copy-paste ដោយដៃ៖
**`ZoeImport` (PWA) ➜ `zto-import` (Apps Script) ➜ Sheet ➜ Lookup API ➜ ZoeW**។
ទាំង ២ **មិនប៉ះ ZoeW/ZoeKeyGen និងមិនប៉ះ Firebase ឡើយ**។

- `ZoeImport/` ជា PWA ដាច់ដោយឡែក (Netlify site ផ្ទាល់ខ្លួន, `CACHE_VERSION`
  ជា `zoeimport-vN`)។ កំណែរបស់វា **ដាច់ពី `APP_VERSION`** —
  `version-check.js` ពិនិត្យតែ ZoeW និង ZoeKeyGen។
- `zto-import/` ជា Apps Script **standalone** (សរសេរចូល Sheet) ចំណែក
  `zto-import/google-sheets-api/` ជា Apps Script **bound** (អានចេញ)។
  ពួកវាជាគម្រោង ២ ដាច់ដោយឡែក ហើយ Deploy ដោយឡែក — កុំយកទៅច្រឡំគ្នា។
- **Salt ត្រូវរក្សាដដែល**៖ `zoeimport_pin_verify_v1` (PIN hash) និង
  `zoeimport_config_secret_v1` (កូនសោ AES សម្រាប់ URL + ពាក្យសម្ងាត់)។
  ការប្តូរវាធ្វើឲ្យ PIN និងការតភ្ជាប់ដែលរក្សាទុករួចលើឧបករណ៍ទាំងអស់ខូច។
- SheetJS ស្ថិត **ក្នុង repo** (`ZoeImport/vendor/xlsx.full.min.js`) មិនមែនមកពី
  CDN ទេ — ច្បាប់ដដែលនឹង ZXing។ វាត្រូវនៅក្នុង `CORE_SHELL` របស់ `sw.js`។

> ⚠️ **សំណើទៅ Apps Script ត្រូវជា *simple request* ជានិច្ច។**
> `callApi()` ប្រើ `Content-Type: text/plain` ដោយចេតនា ហើយ **គ្មាន header
> ផ្ទាល់ខ្លួន**។ ការបន្ថែម `Authorization`, `X-…` ឬការប្តូរទៅ
> `application/json` ធ្វើឲ្យ browser បញ្ជូន preflight `OPTIONS` ➜ **Apps Script
> មិនឆ្លើយ `OPTIONS`** ➜ ការនាំចូលស្លាប់ទាំងស្រុងលើផលិតកម្ម ខណៈ
> `ZoeImport/test.js` (ដែល stub `fetch`) **ជោគជ័យទាំងអស់**។ ថ្នាក់កំហុសដដែល
> នឹង CSP `'wasm-unsafe-eval'` ក្នុងកំណែ 2.10.0។

> ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-25) — អ្នកប្រើរាយការណ៍ថា
> ការនាំចូលដើរលើ deploy ពិត។ ដូច្នេះ **កុំ «កែ» ផ្លូវបណ្តាញនេះដោយផ្អែកលើ
> ការសង្ស័យអំពី CORS** — វាមិនមែនជាកូដដែលមិនទាន់សាកទេ។
> មិនទាន់មានរបាយការណ៍ដាច់ដោយឡែកសម្រាប់ Drive folder watcher (`Watch.gs`)
> និងការដំឡើងជា App លើទូរស័ព្ទ។

តេស្ត៖ **`node zto-import/test.js`** (៥០) និង **`node ZoeImport/test.js`** (៥៥)។
ពួកវា **មិនស្ថិតក្នុង `run-all.sh`** ទេ ព្រោះមិនមែនជាផ្នែករបស់ App —
រត់ដោយផ្ទាល់។ ការកែកូដ Apps Script ក្នុង repo **មិនប្តូរ script ដែល deploy រួច**
— ត្រូវ copy-paste ចូល script.google.com ដោយដៃ រួច Deploy ជាកំណែថ្មី។


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

