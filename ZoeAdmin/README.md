# ZoeAdmin — កម្មវិធីគ្រប់គ្រងកញ្ចប់

ZoeAdmin គឺជា PWA សម្រាប់ **Admin** គ្រប់គ្រងកញ្ចប់ អតិថិជន និងស្ថិតិ COD/DOD ក្នុងប្រព័ន្ធ Zoe។ វាជាកន្លែងបង្កើត និងកែសម្រួលទិន្នន័យអាជីវកម្មសំខាន់ ខណៈ ZoeW ប្រើសម្រាប់ដំណើរការទទួលកញ្ចប់ប្រចាំថ្ងៃ និង Zoescan ប្រើសម្រាប់កំណត់ Locker ប៉ុណ្ណោះ។

កំណែបច្ចុប្បន្ន៖ **1.0.4**។

## តួនាទី និងព្រំដែន

- ចូលបានតែគណនី Firebase ដែលមាន `user_roles/{uid} = "admin"` ប៉ុណ្ណោះ។ ការត្រួតពិនិត្យសិទ្ធិពិតស្ថិតនៅ Firebase Realtime Database Rules មិនមែននៅ UI ទេ។
- បញ្ចូលកញ្ចប់ថ្មី ស្កេន Barcode កែទូរស័ព្ទ/COD/DOD/Barcode បិទ ឬបើកស្ថានភាពកញ្ចប់ និងមើលរបាយការណ៍។
- `zoew_scan_history_cod_dod` ជាទិន្នន័យប្រវត្តិសំខាន់។ `zoew_scanner_lookup` ជា projection តូចសម្រាប់ Zoescan; វាមិនមែនជាប្រភពសម្រាប់ COD/DOD ទេ។
- ពេលកែព័ត៌មានកញ្ចប់ ZoeAdmin ប្រើ transaction ហើយ sync projection ដោយ merge មានលក្ខខណ្ឌ ដើម្បីមិនត្រឡប់ Locker ថ្មីទៅតម្លៃចាស់ពេល Scanner កំពុងធ្វើការ។

## ការងារប្រចាំថ្ងៃ

1. ចូលប្រព័ន្ធ ហើយផ្ទៀងផ្ទាត់ថាគណនីមានតួនាទី Admin។
2. ស្កេន ឬបញ្ចូល Barcode និងលេខទូរស័ព្ទ ដើម្បីបង្កើត/បន្ថែមកញ្ចប់។
3. ពិនិត្យ COD/DOD, Barcode, ស្ថានភាព និងទីតាំង Locker មុនរក្សាទុក។
4. ប្រើស្វែងរកលេខទូរស័ព្ទ ស្ថិតិប្រចាំថ្ងៃ/ខែ និង Export នៅពេលត្រូវការ។
5. ប្រសិនបើ Zoescan មិនឃើញកញ្ចប់ចាស់ សូមប្រើមុខងារ **កំណត់ទិន្នន័យ Scanner Lookup ឡើងវិញ**; វាសង់ projection ឡើងវិញដោយមិនកែ COD/DOD។

## ច្បាប់ «លុប» និង «ដក»

| សកម្មភាព | អ្វីដែលកើតឡើងចំពោះស្ថិតិ | ពេលស្ដារ |
|---|---|---|
| **លុប** កញ្ចប់ទាំងមូល | មិនដក COD/DOD ឬចំនួនចេញ | ស្ដារកញ្ចប់វិញដោយមិនបូកស្ថិតិបន្ថែម |
| **ដក** Barcode ពីកញ្ចប់ច្រើន Barcode | ដកតម្លៃ និងចំនួនរបស់ Barcode នោះ | បូកតម្លៃ/ចំនួនត្រឡប់តែម្តង |

ការស្ដារប្រើ claim និង atomic multi-location update ដើម្បីឱ្យ tab ពីរ មិនអាចបូកស្ថិតិពីរដងសម្រាប់ធាតុតែមួយបាន។ កុំកែ path ធុងសំរាម ឬស្ថិតិដោយដៃក្នុង Firebase Console ខណៈមនុស្សកំពុងស្ដារ។

ការសម្អាតស្វ័យប្រវត្តិគឺ៖ កញ្ចប់បិទលើស ២ ម៉ោងត្រូវ «លុប», កញ្ចប់មិនទាន់បិទលើស ៨ ថ្ងៃត្រូវ «ដក», និងធុងសំរាមលើស ១០ ថ្ងៃត្រូវ purge។ សូមទុកកម្មវិធី Admin ឬ ZoeW ដែលបានចូលសិទ្ធិដំណើរការជាប្រចាំ ដើម្បីឱ្យការសម្អាត client-side នេះអាចរត់បាន។

## Lookup API និង Google Sheets

ZoeAdmin អាចយកលេខទូរស័ព្ទ/COD/DOD ពី endpoint ខាងក្រៅពេលស្កេន Barcode។ កំណត់នៅម៉ឺនុយ API Lookup ក្រោម Security PIN។

- URL ត្រូវមាន `{barcode}` ឬគាំទ្រផ្លូវដែលកម្មវិធីអាចបញ្ចូល Barcode បាន។
- JSON អាចកំណត់ផ្លូវ `phone`, `cod`, និង `dod` បាន រួមទាំង nested field។
- Header secret ដែលកំណត់ថ្មីត្រូវបាន encrypt ដោយកូនសោពី PIN មុនរក្សាទុកក្នុង browser។
- Google Apps Script ក្នុង `google-sheets-api/` គាំទ្រទាំង lookup មួយ Barcode និង `list=1`។ Cache គឺ best-effort ប៉ុណ្ណោះ; នៅពេល payload ធំពេក វាត្រូវ fallback ទៅការអាន Sheet ជំនួសការធ្វើឱ្យ API បរាជ័យ។

បើប្តូរ host របស់ API ត្រូវកែ `connect-src` ក្នុង CSP របស់ deployment ផងដែរ។

## សុវត្ថិភាព និងភាពត្រឹមត្រូវ

- Setup Link/QR មិនរក្សាទុក Config ដោយស្វ័យប្រវត្តិទេ៖ ត្រូវឆ្លង PIN ពិនិត្យ JSON ហើយចុចរក្សាទុកដោយខ្លួនឯង។
- Logout សម្អាតទិន្នន័យកញ្ចប់ និង form សំខាន់ចេញពីអេក្រង់។
- Scanner អានតែ projection ដែលត្រូវការ ហើយ Rules អនុញ្ញាតឱ្យតួនាទី `scanner` សរសេរតែវាល assignment Locker លើកញ្ចប់ដែលមានស្រាប់។ វាមិនអាចលុប ឬកែ Phone, Barcode, COD, DOD ឬ `isClosed` បានទេ។
- កុំទុក PIN, Firebase Config, API secret ឬ export ទិន្នន័យអតិថិជនលើឧបករណ៍សាធារណៈ។

## Deploy និងការបញ្ចេញកំណែ

App នេះជា static site គ្មាន build step។ Deploy ថត `ZoeAdmin` ទៅ hosting របស់វា ហើយប្តូរ `CACHE_VERSION` រាល់ពេល asset ផ្លាស់ប្តូរ។ Service Worker ទាញកំណែថ្មីនៅផ្ទៃខាងក្រោយ ហើយប្រើវាពេលបើក App លើកក្រោយ។

**ចាំបាច់៖** `firebase-database.rules.json` នៅ root មិន deploy តាម Netlify ឬ static hosting ទេ។ មុន release ដែលពាក់ព័ន្ធនឹង Firebase path/rules សូម backup Rules ចាស់, paste ឯកសារនេះទៅ Business Firebase Project ក្នុង Firebase Console, ពិនិត្យ Rules Simulator ហើយចុច **Publish** ដោយដៃ។ ត្រូវ deploy ZoeAdmin, ZoeW និង Zoescan ដែលឆបគ្នាជាមួយ Rules ថ្មីក្នុងរយៈពេលជិតគ្នា។

## តេស្តមុន release

ពី root របស់ repository រត់៖

```bash
node --check ZoeAdmin/app.js
node audit-tools/version-check.js
bash audit-tools/run-all.sh
```

ត្រូវផ្ទៀងផ្ទាត់ `APP_VERSION` និង `manifest.json` របស់ App ទាំង ៤ ឱ្យដូចគ្នា។

## អាជ្ញាប័ណ្ណ

គម្រោងនេះជាកម្មសិទ្ធិឯកជន — Powered by ZoeW.
