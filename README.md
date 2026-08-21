# Zoe-System — ប្រព័ន្ធគ្រប់គ្រងកញ្ចប់ទំនិញ

Zoe-System ជាសំណុំ PWA ចំនួន ៤ សម្រាប់គ្រប់គ្រងកញ្ចប់អតិថិជន៖ បញ្ចូល Barcode, កំណត់ Locker, ទទួលកញ្ចប់, គណនា COD/DOD និងគ្រប់គ្រង Activation Key។ ឯកសារនេះត្រូវបានរៀបចំសម្រាប់ដាក់នៅ **root របស់ repository** ដើម្បីឱ្យតំណភ្ជាប់ខាងក្រោមដំណើរការ។

កំណែ release បច្ចុប្បន្ន៖ **`1.0.4`**។

## App ទាំង ៤

| App | តួនាទី | មុខងារសំខាន់ | ឯកសារលម្អិត |
|---|---|---|---|
| **ZoeAdmin** | `admin` | បង្កើត/កែសម្រួលកញ្ចប់, COD/DOD, របាយការណ៍, Export និង Scanner Lookup rebuild | [ZoeAdmin/README.md](ZoeAdmin/README.md) |
| **ZoeW** | `admin`, `worker` | ស្វែងរក, ហៅអតិថិជន, បិទ/បើកកញ្ចប់ និងតាមដានប្រចាំថ្ងៃ | [ZoeW/README.md](ZoeW/README.md) |
| **Zoescan** | `admin`, `worker`, `scanner` | ស្កេន Barcode ដែលមានស្រាប់ និងកំណត់ទីតាំង Locker ប៉ុណ្ណោះ | [Zoescan/README.md](Zoescan/README.md) |
| **ZoeKeyGen** | `admin` ក្នុង License Firebase Project ដាច់ដោយឡែក | បង្កើត, Revoke, Extend Activation Key និង Setup Link/QR | [ZoeKeyGen/README.md](ZoeKeyGen/README.md) |

## ស្ថាបត្យកម្ម និងប្រភពទិន្នន័យ

- App ទាំងអស់ជា **Vanilla JavaScript PWA** គ្មាន framework និងគ្មាន build step។ Deploy ថត App នីមួយៗជា static site ដាច់ដោយឡែក។
- **Business Firebase Project** ប្រើរួមដោយ ZoeAdmin, ZoeW និង Zoescan សម្រាប់ទិន្នន័យអាជីវកម្ម។
- **License Firebase Project** របស់ ZoeKeyGen ត្រូវដាច់ពី Business Project ដើម្បីបំបែក signing key និងសិទ្ធិ License ចេញពីទិន្នន័យអតិថិជន។
- `zoew_scan_history_cod_dod` ជាទិន្នន័យសំខាន់។ `zoew_scanner_lookup` ជា projection សង្ខេបសម្រាប់ Zoescan ហើយមិនផ្ទុក COD/DOD ទេ។
- `license-verify.js` និង `error-reporting.js` ត្រូវដូចគ្នាបេះបិទនៅ App ទាំង ៤។ កុំកែតែ App មួយ។

### Firebase paths សំខាន់

| Path | គោលបំណង |
|---|---|
| `zoew_scan_history_cod_dod` | កញ្ចប់សកម្ម និង Barcode របស់វា |
| `zoew_scanner_lookup` | ទិន្នន័យសង្ខេបសម្រាប់ស្វែងរក Barcode និង Locker |
| `zoew_recently_deleted_cod_dod` | ធុងសំរាមសម្រាប់ស្តារ item/Barcode |
| `zoew_daily_revenue_cod_dod`, `zoew_monthly_revenue_cod_dod` | ស្ថិតិ COD/DOD |
| `zoew_daily_pickup_cod_dod` | ស្ថិតិអតិថិជន និងកញ្ចប់ដែលបានយក |
| `zoew_restore_finalizations`, `zoew_clear_history_finalizations` | witness សម្រាប់ការពារ Restore/Clear All replay និង revenue ស្ទួន |
| `user_roles/$uid` | តួនាទី `admin`, `worker`, ឬ `scanner` |

## ច្បាប់អាជីវកម្ម

### «លុប» និង «ដក» មិនដូចគ្នា

| សកម្មភាព | ប៉ះ COD/DOD និងចំនួន? | ពេលស្តារ |
|---|---|---|
| **លុប** កញ្ចប់ទាំងមូល | មិនដកស្ថិតិ | ស្តារទិន្នន័យវិញដោយមិនបូកស្ថិតិបន្ថែម |
| **ដក** Barcode ពីកញ្ចប់ច្រើន Barcode | ដកតម្លៃ និងចំនួនរបស់ Barcode នោះ | បូកត្រឡប់តែម្តង |

Restore និង Clear All ប្រើ claim, token និង atomic multi-location update។ នេះការពារ tab/ឧបករណ៍ពីរមិនឱ្យស្តារ ឬបូក revenue ស្ទួនសម្រាប់ធាតុតែមួយ។ កុំកែ path ធុងសំរាម ឬស្ថិតិដោយដៃ ខណៈប្រតិបត្តិការទាំងនេះកំពុងដំណើរការ។

### Scanner Locker protocol

Zoescan មិនអាចបង្កើត, លុប ឬកែ COD/DOD, Phone, Barcode និង `isClosed` បានទេ។ ការកំណត់ Locker ប្រើលំដាប់៖

1. Reserve Locker លើ Scanner Lookup ដោយ transaction;
2. ផ្ទៀងផ្ទាត់ Barcode index/code, revision, Firebase UID និងអាយុកាល reservation;
3. Commit lookup និង history ក្នុង atomic update តែមួយ។

ទិន្នន័យ lookup/history ចាស់ ឬមិនស៊ីគ្នា ត្រូវ fail-closed។ ប្រសិនបើ Zoescan មិនឃើញ ឬមិនអាចកំណត់ Locker សម្រាប់កញ្ចប់ចាស់ សូមប្រើ **Scanner Lookup rebuild** ក្នុង ZoeAdmin ជាមុន។

## សុវត្ថិភាព

- Firebase Realtime Database Rules ជាអ្នកសម្រេចសិទ្ធិពិត; UI មិនមែនជាការការពារតែមួយទេ។
- តួនាទី `scanner` សរសេរបានតែ metadata ដែលត្រូវការសម្រាប់ Locker assignment លើ item ដែលមានស្រាប់។
- Setup Link/QR មិនរក្សាទុក Firebase Config ដោយស្វ័យប្រវត្តិទេ៖ អ្នកប្រើត្រូវបញ្ចូល Security PIN, ពិនិត្យ Config ហើយចុចរក្សាទុកដោយខ្លួនឯង។
- ZoeKeyGen ប្រើ browser-session persistence។ Checkbox «ចងចាំអ៊ីមែល» រក្សាទុកតែអ៊ីមែល មិនរក្សា Firebase login session ទេ។
- Signing Key ដែលចងចាំសម្រាប់ session ត្រូវអ៊ិនគ្រីបដោយ PIN ហើយត្រូវផ្ទៀងផ្ទាត់ជាមួយ public key មុនប្រើវិញ។
- Logout សម្អាតទិន្នន័យរសើបពី UI។ កុំទុក PIN, Private Key, API secret ឬ Export អតិថិជនលើឧបករណ៍ចែករំលែក។

## កំណែ និង Service Worker

`APP_VERSION` ក្នុង `app.js` ទាំង ៤ និង `version` ក្នុង `manifest.json` ទាំង ៤ ត្រូវដូចគ្នា។ បច្ចុប្បន្នគឺ `1.0.4`។

`CACHE_VERSION` ក្នុង `sw.js` មិនមែន App version ទេ។ វាត្រូវប្ដូររាល់ពេល asset របស់ App នោះផ្លាស់ប្តូរ ដើម្បីឱ្យ Service Worker ទាញឯកសារថ្មី។

ពេល release៖

1. ប្តូរ App version និង manifest ទាំង ៤ ប្រសិនបើមាន release ថ្មី;
2. ប្តូរ cache version របស់ App ដែល asset ផ្លាស់ប្តូរ;
3. រត់ validation;
4. Deploy static App ដែលពាក់ព័ន្ធក្នុង maintenance window តែមួយ;
5. បើមានការកែ Firebase Rules ត្រូវ Publish Rules ដោយដៃផងដែរ។

## Provisioning អតិថិជនថ្មី

1. បង្កើត Business Firebase Project មួយសម្រាប់អតិថិជនម្នាក់ និងកំណត់ `user_roles/<UID>` តាមតួនាទី។
2. បង្កើត License Firebase Project ដាច់ដោយឡែកសម្រាប់ ZoeKeyGen។
3. ក្នុង ZoeKeyGen បង្កើត Setup Link/QR ដោយប្រើ Firebase Config របស់ Business Project។
4. លើឧបករណ៍គោលដៅ បើក Link ឬស្កេន QR, បញ្ចូល PIN, ពិនិត្យ JSON ហើយរក្សាទុកដោយចេតនា។
5. Publish Rules ត្រឹមត្រូវសម្រាប់ Business Project និង License Project មុនចាប់ផ្តើមប្រើប្រាស់។

## Firebase Rules និង Deploy

Static hosting មិន deploy Firebase Rules ជំនួសអ្នកទេ។ មុន publish៖

1. Backup Rules ចាស់;
2. Paste [firebase-database.rules.json](firebase-database.rules.json) ទៅ **Business Firebase Project**;
3. សាកល្បង role `admin`, `worker` និង `scanner` ក្នុង Rules Simulator;
4. ចុច **Publish**;
5. Paste [ZoeKeyGen/firebase-database.rules.json](ZoeKeyGen/firebase-database.rules.json) ទៅ **License Firebase Project** ហើយ Publish ដោយដៃដូចគ្នា។

ត្រូវ deploy ZoeAdmin, ZoeW និង Zoescan ដែលត្រូវគ្នានឹង Rules ថ្មីជិតគ្នា។ Client ចាស់អាចត្រូវបានបដិសេធដោយ Rules ថ្មីជាចេតនា ដើម្បីការពារទិន្នន័យមិនស៊ីគ្នា។

## តេស្តមុន release

រត់ពី root របស់ repository៖

```bash
node --check ZoeAdmin/app.js
node --check ZoeW/app.js
node --check Zoescan/app.js
node --check ZoeKeyGen/app.js
node audit-tools/version-check.js
bash audit-tools/run-all.sh
```

`audit-tools/run-all.sh` ពិនិត្យ syntax, schema/rules, version consistency, Restore/Clear All, Scanner race, KeyGen security និង browser regression។ មើល [audit-tools/README.md](audit-tools/README.md) សម្រាប់ការពន្យល់លម្អិត និងជម្រើស RTDB emulator។

## ឯកសារបន្ថែម

- [ZoeAdmin README](ZoeAdmin/README.md)
- [ZoeW README](ZoeW/README.md)
- [Zoescan README](Zoescan/README.md)
- [ZoeKeyGen README](ZoeKeyGen/README.md)
- [Audit tools README](audit-tools/README.md)

## អាជ្ញាប័ណ្ណ

គម្រោងនេះជាកម្មសិទ្ធិឯកជន — Powered by ZoeW.
