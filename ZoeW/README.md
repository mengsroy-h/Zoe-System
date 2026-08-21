# ZoeW — កម្មវិធីទទួល និងតាមដានកញ្ចប់

ZoeW គឺជា PWA សម្រាប់ការងារនៅកន្លែងទទួលកញ្ចប់។ វាប្រើទិន្នន័យដូចគ្នានឹង ZoeAdmin ប៉ុន្តែមិនមានមុខងារបង្កើតកញ្ចប់ថ្មីទេ។ ZoeW ផ្តោតលើការស្វែងរកអតិថិជន ការហៅទូរស័ព្ទ បិទ/បើកស្ថានភាព និងការតាមដានស្ថិតិប្រចាំថ្ងៃ។

កំណែបច្ចុប្បន្ន៖ **1.0.4**។

## សិទ្ធិ និងអ្វីដែល ZoeW មិនធ្វើ

- ចូលបានតែគណនី `admin` ឬ `worker` ក្នុង `user_roles/{uid}`។ គណនី `scanner` មិនអាចចូល ZoeW បានទេ។
- ZoeW មិនបង្កើត Parcel ឬ Barcode ថ្មីទេ។ ការបញ្ចូលទិន្នន័យថ្មីជាការងាររបស់ ZoeAdmin។
- អ្នកប្រើអាចស្វែងរកកញ្ចប់ដែលមានស្រាប់ កែព័ត៌មានដែលសិទ្ធិអនុញ្ញាត ហៅអតិថិជន និងកំណត់ថាបានយករួច។
- សិទ្ធិពិតត្រូវបានកំណត់នៅ Firebase Realtime Database Rules; ការមិនឃើញប៊ូតុងមិនមែនជាការអនុញ្ញាតសុវត្ថិភាពទេ។

## លំហូរការងារណែនាំ

1. ចូលប្រព័ន្ធ និងស្វែងរកតាមលេខទូរស័ព្ទ ឬ Barcode ដែលមានស្រាប់។
2. ពិនិត្យចំនួនកញ្ចប់, COD/DOD, ស្ថានភាព និង Locker។
3. ហៅអតិថិជន ឬកត់ស្ថានភាព «បានហៅ» ប្រសិនបើចាំបាច់។
4. ពេលអតិថិជនយករួច បិទកញ្ចប់/Barcode ត្រឹមត្រូវ។ ការបិទអាប់ដេតស្ថិតិអ្នកមកយក និង projection សម្រាប់ Scanner។
5. ប្រើ Recently Deleted តែពេលចាំបាច់ ហើយពិនិត្យថាវាជា «លុប» ឬ «ដក» មុនស្ដារ។

## ស្ថិតិ និងធុងសំរាម

- **លុប** កញ្ចប់ទាំងមូលមិនប៉ះ COD/DOD ឬចំនួនក្នុងស្ថិតិ។
- **ដក** Barcode ពីកញ្ចប់ដែលមាន Barcode ច្រើន ដកតម្លៃ និងចំនួនរបស់ Barcode នោះ; ការស្ដារបូកវាត្រឡប់តែម្តង។
- Restore ត្រូវបានការពារដោយ claim និង atomic write ដូច្នេះការចុចពីរគ្រឿងមិនអាចបង្កើត revenue ស្ទួន។
- កញ្ចប់បិទលើស ២ ម៉ោងត្រូវលុប, កញ្ចប់មិនទាន់បិទលើស ៨ ថ្ងៃត្រូវដក និងទិន្នន័យក្នុងធុងសំរាមលើស ១០ ថ្ងៃត្រូវ purge។

កុំធ្វើការកែទិន្នន័យ ឬស្ថិតិដូចគ្នាពី ZoeAdmin និង ZoeW នៅពេលតែមួយ ប្រសិនបើមិនចាំបាច់។ ប្រតិបត្តិការសំខាន់ប្រើ transaction ប៉ុន្តែការបញ្ជាក់ជាមួយក្រុមការងារនៅតែជួយកាត់បន្ថយការប៉ះទង្គិច។

## ទំនាក់ទំនងជាមួយ Zoescan

`zoew_scan_history_cod_dod` ជាទិន្នន័យសំខាន់; `zoew_scanner_lookup` ជាទិន្នន័យសង្ខេបសម្រាប់ Zoescan។ ពេល ZoeW កែព័ត៌មានកញ្ចប់ វា sync projection ដោយ transaction/merge ដែលរក្សា Locker ថ្មីបំផុតជាមុន។ ដូច្នេះការកែលេខទូរស័ព្ទពី ZoeW មិនគួរលុបការកំណត់ Locker ដែល Scanner ទើបធ្វើទេ។

បើ Scanner មិនឃើញកញ្ចប់ចាស់ សូមឱ្យ Admin ប្រើមុខងារ rebuild Scanner Lookup ក្នុង ZoeAdmin។

## Config និងសុវត្ថិភាព

- Setup Link ឬ QR សម្រាប់ Firebase Config ត្រូវឆ្លង Security PIN, ពិនិត្យ JSON និងរក្សាទុកដោយចេតនា។
- កាមេរ៉ាក្នុង ZoeW ប្រើសម្រាប់ស្កេន QR Setup Link ប៉ុណ្ណោះ មិនមែនសម្រាប់បញ្ចូល Barcode ថ្មីទេ។
- Logout សម្អាតទិន្នន័យអតិថិជនពី UI។ មិនគួរទុក browser ចូលរួចលើឧបករណ៍ចែករំលែក។
- COD/DOD និងព័ត៌មានអតិថិជនជាទិន្នន័យរសើប៖ Export និង Screenshot ត្រូវគ្រប់គ្រងតាមគោលការណ៍ក្រុមហ៊ុន។

## Deploy និង Firebase Rules

Deploy ថត `ZoeW` ជា static site ហើយប្តូរ Service Worker cache ពេលមាន asset ថ្មី។ `APP_VERSION` និង `manifest.json` របស់ App ទាំង ៤ ត្រូវដូចគ្នា។

`firebase-database.rules.json` នៅ root ត្រូវ paste និង **Publish ដោយដៃ** ក្នុង Business Firebase Project។ Static hosting មិនធ្វើ deploy Rules ជំនួសអ្នកទេ។ មុន Publish សូម backup Rules ចាស់ ហើយសាកល្បង role `admin`, `worker` និង `scanner` ក្នុង Rules Simulator។

## តេស្តមុន release

```bash
node --check ZoeW/app.js
node audit-tools/version-check.js
bash audit-tools/run-all.sh
```

## អាជ្ញាប័ណ្ណ

គម្រោងនេះជាកម្មសិទ្ធិឯកជន — Powered by ZoeW.
