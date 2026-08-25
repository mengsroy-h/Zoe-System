# Zoe-System — ប្រព័ន្ធគ្រប់គ្រងកញ្ចប់ទំនិញ

Zoe-System ជាសំណុំ PWA ចំនួន **២** សម្រាប់គ្រប់គ្រងកញ្ចប់អតិថិជន៖ បញ្ចូល Barcode, កំណត់ទីតាំង Locker, ទទួលកញ្ចប់, គណនា COD/DOD និងគ្រប់គ្រង Activation Key។ ឯកសារនេះត្រូវបានរៀបចំសម្រាប់ដាក់នៅ **root របស់ repository** ដើម្បីឱ្យតំណភ្ជាប់ខាងក្រោមដំណើរការ។

កំណែ release បច្ចុប្បន្ន៖ **`2.11.6`** — មើល [CHANGELOG.md](CHANGELOG.md) សម្រាប់អ្វីដែលប្រែក្នុងកំណែនីមួយៗ។

## App ទាំង ២

| App | អ្នកប្រើ | មុខងារសំខាន់ | ឯកសារលម្អិត |
|---|---|---|---|
| **ZoeW** | បុគ្គលិកដែលចូលប្រព័ន្ធបាន | បញ្ចូល/កែសម្រួលកញ្ចប់, COD/DOD, កំណត់ទីតាំង Locker, របាយការណ៍ និង Export | [ZoeW/README.md](ZoeW/README.md) |
| **ZoeKeyGen** | អ្នកលក់ (Vendor) ប៉ុណ្ណោះ | បង្កើត, Revoke, Extend Activation Key និង Setup Link/QR | [ZoeKeyGen/README.md](ZoeKeyGen/README.md) |

## ស្ថាបត្យកម្ម និងប្រភពទិន្នន័យ

- App ទាំងអស់ជា **Vanilla JavaScript PWA** គ្មាន framework និងគ្មាន build step។ Deploy ថត App នីមួយៗជា static site ដាច់ដោយឡែក។
- **Business Firebase Project** ប្រើដោយ ZoeW សម្រាប់ទិន្នន័យអាជីវកម្ម — មួយ Project ក្នុងមួយជំនួញ។
- **License Firebase Project** របស់ ZoeKeyGen ត្រូវដាច់ពី Business Project ដើម្បីបំបែក signing key និងសិទ្ធិ License ចេញពីទិន្នន័យអតិថិជន។
- `zoew_scan_history_cod_dod` ជាប្រភពទិន្នន័យសំខាន់តែមួយ។ App អានវាដោយផ្ទាល់ គ្មាន projection ជាន់ទីពីរទេ។
- `license-verify.js` និង `error-reporting.js` ត្រូវដូចគ្នាបេះបិទនៅ App ទាំង ២។ កុំកែតែ App មួយ។

### Firebase paths សំខាន់

| Path | គោលបំណង |
|---|---|
| `zoew_scan_history_cod_dod` | កញ្ចប់សកម្ម, Barcode និងទីតាំង Locker របស់វា |
| `zoew_recently_deleted_cod_dod` | ធុងសំរាមសម្រាប់ស្តារ item/Barcode |
| `zoew_daily_revenue_cod_dod`, `zoew_monthly_revenue_cod_dod` | ស្ថិតិ COD/DOD |
| `zoew_daily_pickup_cod_dod` | ស្ថិតិអតិថិជន និងកញ្ចប់ដែលបានយក |
| `zoew_restore_finalizations`, `zoew_clear_history_finalizations` | witness សម្រាប់ការពារ Restore/Clear All replay និង revenue ស្ទួន |
| `zoew_barcode_registry` | ការពារ Barcode ស្ទួនឆ្លងឧបករណ៍ |
| `zoew_settings/exchange_rate` | អត្រាប្តូរប្រាក់រៀល |

## រចនាសម្ព័ន្ធ UI

ZoeW បែងចែកជា **ទំព័រ ២** បូកនឹង **របា Slide (ម៉ឺនុយ)**៖

| ផ្នែក | មាតិកា |
|---|---|
| **ទំព័រ ១ — ទិន្នន័យ** | តារាងគ្រប់គ្រងប្រចាំថ្ងៃ (ស្ថិតិ + ទឹកប្រាក់ + តម្រងថ្ងៃ), ប្រអប់ស្វែងរកលេខ, តារាងប្រវត្តិ |
| **ទំព័រ ២ — បញ្ចូលទិន្នន័យ** | របៀបស្កេន ២ (បញ្ចូលកញ្ចប់ / កំណត់ទីតាំង Locker), កាមេរ៉ា, Barcode scanner, យក Barcode ពីរូបភាព, បញ្ជីកញ្ចប់ដែលបញ្ចូលថ្ងៃនេះ, ផ្ទាំង Locker និងបញ្ជីទីតាំង |
| **របា Slide (☰)** | Config / Reconfig, API ស្វែងរកអតិថិជន, តារាងអតិថិជន, កំណត់ទូ Locker, ចូល/ចាកចេញ |
| **ប៊ូតុង (...) លើតារាងប្រវត្តិ** | Export Data, កែទឹកប្រាក់/កញ្ចប់, អត្រាប្រាក់, លុបទាំងអស់ |

## ច្បាប់អាជីវកម្ម

### «លុប» និង «ដក» មិនដូចគ្នា

| សកម្មភាព | ប៉ះ COD/DOD និងចំនួន? | ពេលស្តារ |
|---|---|---|
| **លុប** កញ្ចប់ទាំងមូល | មិនដកស្ថិតិ | ស្តារទិន្នន័យវិញដោយមិនបូកស្ថិតិបន្ថែម |
| **ដក** Barcode ពីកញ្ចប់ច្រើន Barcode | ដកតម្លៃ និងចំនួនរបស់ Barcode នោះ | បូកត្រឡប់តែម្តង |

Restore និង Clear All ប្រើ claim, token និង atomic multi-location update។ នេះការពារ tab/ឧបករណ៍ពីរមិនឱ្យស្តារ ឬបូក revenue ស្ទួនសម្រាប់ធាតុតែមួយ។ កុំកែ path ធុងសំរាម ឬស្ថិតិដោយដៃ ខណៈប្រតិបត្តិការទាំងនេះកំពុងដំណើរការ។

ការសម្អាតស្វ័យប្រវត្តិ៖ កញ្ចប់បិទលើស **២ ម៉ោង** ➜ «លុប», កញ្ចប់មិនទាន់បិទលើស **៨ ថ្ងៃ** ➜ «ដក», ធុងសំរាមលើស **១០ ថ្ងៃ** ➜ purge។

### លុបទាំងអស់ — តាមតម្រងថ្ងៃ

«លុបទាំងអស់» លុប **តែធាតុដែលកំពុងបង្ហាញតាមតម្រងថ្ងៃបច្ចុប្បន្ន** ប៉ុណ្ណោះ។ ឧ. ពេលឈរលើ «ថ្ងៃនេះ» វាមិនប៉ះទិន្នន័យថ្ងៃផ្សេងទេ។ វាទាមទារ **Security PIN** មុនដំណើរការ ដូច «កែទឹកប្រាក់/កញ្ចប់» ដែរ។

### កំណត់ទីតាំង Locker

នៅទំព័រ ២ ជ្រើសរើសរបៀប «📍 កំណត់ទីតាំង Locker» រួចជ្រើសទូបច្ចុប្បន្ន។ រាល់ Barcode ដែលស្កេនបន្ទាប់ពីនោះ៖

- កញ្ចប់ដែល **មិនទាន់មានទីតាំង** ➜ ចុះទីតាំងភ្លាម **គ្មានប្រអប់សួរបញ្ជាក់**;
- កញ្ចប់ដែល **មានទីតាំងរួច** ➜ សួរបញ្ជាក់ជាមុន («តើអ្នកចង់ផ្លាស់ទីកញ្ចប់នេះទៅ … មែនទេ?») ព្រមទាំងប្រាប់បើទីតាំងគោលដៅមានកញ្ចប់ផ្សេងស្ថិតនៅ;
- កញ្ចប់ដែលស្ថិតនៅទីតាំងដដែលរួច ➜ គ្មានការសរសេរថ្មី។

ការសរសេរធ្វើឡើងដោយ `runTransaction` ផ្ទាល់លើ `zoew_scan_history_cod_dod` ដោយផ្គូផ្គងតាម `code` (មិនមែនតាម index) ដូច្នេះការស្កេនស្របគ្នាពីឧបករណ៍ច្រើនមិនសរសេរជាន់គ្នាទេ។

## កាយវិការបញ្ជី (លើទូរស័ព្ទ)

បញ្ជីធំទាំង ៣ — **ប្រវត្តិ**, **កញ្ចប់ដែលបានបញ្ចូលថ្ងៃនេះ** និង **បញ្ជីទីតាំង
Locker** — មានឥរិយាបថដូចគ្នាបេះបិទ៖

- អូសឡើងលើបញ្ជី ➜ ផ្ទាំងខាងលើបង្រួម ➜ បញ្ជីហូតឡើងពេញអេក្រង់
- អូសចុះពេលបញ្ជីនៅកំពូល ➜ ផ្ទាំងខាងលើត្រឡប់មកវិញ
- ចុចដងអូស (`⎯`) ពីលើបញ្ជី ➜ បិទ/បើកដោយចេតនាច្បាស់លាស់
- ការបង្រួម/ពង្រីក **មិនបង្អាក់ការរមូរដែលកំពុងដើរទេ** — App រង់ចាំដល់លើកម្រាមដៃ
  ទើបប្តូរ layout និង scroll owner; បើកាយវិការត្រូវបាន cancel វាមិនប្តូរអ្វីឡើយ
- ពេលរបា Tab ខាងក្រោមលាក់ខ្លួនតាមការរមូរ **កាតរីកចុះបំពេញកន្លែងរបា** ➜ គ្មាន
  ចន្លោះទទេនៅបាតអេក្រង់
- លើ iOS PWA ការទាញចុះពីកំពូលធម្មតា ឬការទាញបើកផ្ទាំង **មិនកេះ refresh ទេ**;
  pull-to-refresh ចាប់តែការទាញចុះបញ្ឈរវែងដោយចេតនា ខណៈគ្រប់កន្សោមរមូរនៅកំពូល ហើយបិទទាំងស្រុងពេលប្រវត្តិពេញអេក្រង់។
  ការទាញមធ្យមរអិលត្រឡប់វិញ ហើយការបន្ថែមម្រាមដៃទី២បោះបង់ gesture
- លើ iOS PWA ពេលតារាងពេញអេក្រង់ដល់កំពូល App ទប់ rubber-band របស់ WebKit
  ហើយប្រគល់ gesture ទៅផ្ទាំងដោយផ្ទាល់; ផ្ទាំងខាងលើមិនត្រូវខកខាន ឬភ្លាត់ឡើងវិញទេ។
  ផ្លូវ Android នៅប្រើ native passive scroll និង FLIP ដូចមុន។

លើអេក្រង់ **≥992px** កាយវិការទាំងនេះមិនដំណើរការទេ ព្រោះ layout ២ ជួរឃើញគ្រប់យ៉ាងស្រាប់។

## ការស្កេន Barcode

- ទទួល **តែ `CODE_128`** ប៉ុណ្ណោះ (format ដែលកញ្ចប់អីវ៉ាន់ប្រើ)។ វាមានលេខផ្ទៀងផ្ទាត់ mod-103 ជាកាតព្វកិច្ច ➜ ការអានលេខខុសស្ទើរតែមិនអាចកើតឡើងបាន។
- លេខមួយត្រូវអានឃើញ **ដដែល ២ ស៊ុមជាប់គ្នា** ទើបទទួលយក។
- **ការស្កេនកាមេរ៉ាដើរបានទោះគ្មានបណ្តាញ។**
- Android លឿនជាង iPhone ដោយធម្មជាតិ (Android មានម៉ាស៊ីនអានដើមរបស់ប្រព័ន្ធ ចំណែក iPhone ប្រើ JavaScript)។ គុណភាពឌិកូដលើ iPhone សម្របតាមល្បឿនឧបករណ៍ដោយស្វ័យប្រវត្តិ។
- ការស្កេន QR ពេល Config/Reconfig ជាម៉ាស៊ីនអានដាច់ដោយឡែក។

## ល្បឿនសម្របតាមឧបករណ៍

App វាស់ចង្វាក់ស៊ុមពិតរបស់ឧបករណ៍ (១០–១២០Hz) រួចសម្របការងាររបស់ខ្លួនតាមវា។ លើឧបករណ៍ដែលធ្លាក់ស៊ុម វាបិទចលនាដែលដើរជារៀងរហូត និងស្រមោលដែលថ្លៃ — **មិនប៉ះមុខងារអាជីវកម្មណាមួយឡើយ**។

## សុវត្ថិភាព

- Firebase Realtime Database Rules ជាអ្នកសម្រេចសិទ្ធិពិត; UI មិនមែនជាការការពារតែមួយទេ។
- Rules មិនបែងចែកតួនាទីទេ៖ **អ្នកប្រើដែលចូលប្រព័ន្ធបាន (`auth != null`) មានសិទ្ធិដូចគ្នា**។ ការការពារពិតគឺ **schema validation** (ប្រភេទវាល, ជួរតម្លៃ, `$other: false`) និង **claim/witness fence** សម្រាប់ Restore/Clear All។
- Setup Link/QR មិនរក្សាទុក Firebase Config ដោយស្វ័យប្រវត្តិទេ៖ អ្នកប្រើត្រូវបញ្ចូល Security PIN, ពិនិត្យ Config ហើយចុចរក្សាទុកដោយខ្លួនឯង។
- ZoeKeyGen ប្រើ browser-session persistence និងទាមទារតួនាទី `admin` ក្នុង License Project ដាច់ដោយឡែករបស់វា។
- Signing Key ដែលចងចាំសម្រាប់ session ត្រូវអ៊ិនគ្រីបដោយ PIN ហើយត្រូវផ្ទៀងផ្ទាត់ជាមួយ public key មុនប្រើវិញ។
- Logout សម្អាតទិន្នន័យរសើបពី UI។ កុំទុក PIN, Private Key, API secret ឬ Export អតិថិជនលើឧបករណ៍ចែករំលែក។

## កំណែ និង Service Worker

`APP_VERSION` ក្នុង `app.js` ទាំង ២ និង `version` ក្នុង `manifest.json` ទាំង ២ ត្រូវដូចគ្នា។ បច្ចុប្បន្នគឺ **`2.11.6`**។ វាបង្ហាញ **២ កន្លែងក្នុង ZoeW** (ប្រអប់ login និងខាងក្រោមរបា Slide) និង **១ កន្លែងក្នុង ZoeKeyGen** (ប្រអប់ login)។ `version-check.js` អះអាងចំនួនកន្លែងនោះឲ្យច្បាស់ — ការបន្ថែមកន្លែងទី ៣ នឹងធ្វើឲ្យវាធ្លាក់។

`CACHE_VERSION` ក្នុង `sw.js` មិនមែន App version ទេ។ វាតាមលំនាំ `<app>-vN` ហើយត្រូវប្ដូររាល់ពេល asset របស់ App នោះផ្លាស់ប្តូរ ដើម្បីឱ្យ Service Worker ទាញឯកសារថ្មី។ បច្ចុប្បន្នគឺ `zoew-v88` និង `zoekeygen-v53`។

### ធនធានក្រៅ និង cache

Service Worker cache **តែឯកសាររបស់ App ខ្លួនឯង** (`APP_SHELL`)។ engine ស្កេន
(ZXing C++ ចងក្រងជា WebAssembly) ស្ថិតក្នុង repo ជា **២ ឯកសារ** —
`ZoeW/vendor/zxing-wasm.js` និង `ZoeW/vendor/zxing_reader.wasm` — ដូច្នេះវាចូល
cache ជាមួយគ្នា ➜ **ការស្កេនកាមេរ៉ាដើរបានទោះគ្មានបណ្តាញ**។

Firebase SDK, ពុម្ពអក្សរ Google និង Sentry ទាញពីបណ្តាញរាល់ពេល។

ពេល release៖

1. ប្តូរ App version និង manifest ទាំង ២ ប្រសិនបើមាន release ថ្មី;
2. ប្តូរ cache version របស់ App ដែល asset ផ្លាស់ប្តូរ;
3. រត់ validation;
4. Deploy static App ដែលពាក់ព័ន្ធក្នុង maintenance window តែមួយ;
5. បើមានការកែ Firebase Rules ត្រូវ Publish Rules ដោយដៃផងដែរ។

## Provisioning អតិថិជនថ្មី

1. បង្កើត Business Firebase Project មួយសម្រាប់អតិថិជនម្នាក់ ហើយបង្កើតគណនី Authentication សម្រាប់បុគ្គលិក។
2. បង្កើត License Firebase Project ដាច់ដោយឡែកសម្រាប់ ZoeKeyGen។
3. Publish Rules សម្រាប់ Project ទាំងពីរ។
4. ក្នុង ZoeKeyGen បង្កើត Setup Link/QR ដោយប្រើ Firebase Config របស់ Business Project។
5. លើឧបករណ៍គោលដៅ បើក Link ឬស្កេន QR, បញ្ចូល PIN, ពិនិត្យ JSON ហើយរក្សាទុកដោយចេតនា។
6. បង្កើត Activation Key ក្នុង ZoeKeyGen ហើយផ្ញើឱ្យអតិថិជនតាមផ្លូវឯកជន។

## Firebase Rules និង Deploy

Static hosting មិន deploy Firebase Rules ជំនួសអ្នកទេ។ មុន publish៖

1. Backup Rules ចាស់;
2. Paste [firebase-database.rules.json](firebase-database.rules.json) ទៅ **Business Firebase Project**;
3. សាកល្បងក្នុង Rules Simulator ដោយប្រើគណនីដែលចូលប្រព័ន្ធបាន និងគណនីមិនបានចូល;
4. ចុច **Publish**;
5. Paste [ZoeKeyGen/firebase-database.rules.json](ZoeKeyGen/firebase-database.rules.json) ទៅ **License Firebase Project** ហើយ Publish ដោយដៃដូចគ្នា។

**Rules ត្រូវ Publish មុន ឬព្រមគ្នានឹងការ deploy App** ដើម្បីកុំឱ្យ client ថ្មីត្រូវបានបដិសេធដោយ Rules ចាស់។

## តេស្តមុន release

រត់ពី root របស់ repository៖

```bash
npm i acorn playwright-core xlsx
node --check ZoeW/app.js
node --check ZoeKeyGen/app.js
node audit-tools/version-check.js
bash audit-tools/run-all.sh
```

`audit-tools/run-all.sh` ពិនិត្យ syntax, schema/rules, version consistency, Restore/Clear All, រចនាសម្ព័ន្ធទំព័រ/របា Slide, Locker, KeyGen security, ល្បឿននិងភាពត្រឹមត្រូវនៃការស្កេន, ការដើរពេលបណ្តាញដាច់ និង browser regression។ បច្ចុប្បន្នមាន **៥៧ ការត្រួតពិនិត្យ**។ Dependency ដែលបាត់ធ្វើឲ្យឧបករណ៍ពាក់ព័ន្ធ **SKIP ដោយស្អាត** មិនធ្លាក់ទេ។

ដើម្បីបញ្ជាក់ថាតេស្ត**មិនទទេ** ត្រូវរត់វាធៀបនឹង tree មុនកែ៖

```bash
git fetch origin main
rm -rf /tmp/baseline && mkdir /tmp/baseline
git archive origin/main | tar -x -C /tmp/baseline
bash audit-tools/run-all.sh /tmp/baseline    # ចំណុចដែល *គួរតែធ្លាក់* នឹងបង្ហាញ
```

មើល [audit-tools/README.md](audit-tools/README.md) សម្រាប់ការពន្យល់លម្អិត និងជម្រើស RTDB emulator។

## ឯកសារបន្ថែម

- [ZoeW README](ZoeW/README.md)
- [ZoeKeyGen README](ZoeKeyGen/README.md)
- [Audit tools README](audit-tools/README.md)
- [Firebase backup README](firebase-backup/README.md)

## អាជ្ញាប័ណ្ណ

គម្រោងនេះជាកម្មសិទ្ធិឯកជន — Powered by ZoeW.
