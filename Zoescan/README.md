# Zoescan — កម្មវិធីកំណត់ទីតាំង Locker

Zoescan គឺជា PWA សម្រាប់កំណត់ Locker របស់កញ្ចប់ដែល **មាន Barcode ស្រាប់** ក្នុងប្រព័ន្ធ។ វាមិនបង្កើត Parcel, Barcode, COD ឬ DOD ថ្មីទេ។ ZoeAdmin និង ZoeW គ្រប់គ្រងទិន្នន័យអាជីវកម្ម ខណៈ Zoescan មានតួនាទីតូច និងតឹងរ៉ឹងសម្រាប់ទីតាំងប៉ុណ្ណោះ។

កំណែបច្ចុប្បន្ន៖ **1.0.4**។

## អ្នកណាអាចប្រើបាន

គណនី Firebase ដែលមានតួនាទី `admin`, `worker` ឬ `scanner` អាចចូលកម្មវិធីនេះបានតាមគោលការណ៍ role របស់ Business Firebase Project។ សម្រាប់តួនាទី `scanner` សិទ្ធិ Database ត្រូវបានកាត់បន្ថយដល់ lookup និងការកំណត់ Locker ដែលចាំបាច់ប៉ុណ្ណោះ។

## របៀបប្រើ

1. ចូលប្រព័ន្ធ ហើយជ្រើស Locker មុនស្កេន។
2. ស្កេន Barcode ដោយកាមេរ៉ា, ម៉ាស៊ីនស្កេន USB/Bluetooth, វាយបញ្ចូល ឬជ្រើសរូបភាព។
3. កម្មវិធីរក Barcode ក្នុង `zoew_scanner_lookup`។ ប្រសិនបើរកមិនឃើញ វាមិនបង្កើតកញ្ចប់ថ្មីឡើយ។
4. ប្រសិនបើ Locker នោះមានកញ្ចប់មិនទាន់បិទ ឬ Barcode មាន Locker ចាស់ កម្មវិធីស្នើឱ្យបញ្ជាក់សិន។
5. បន្ទាប់ពីបញ្ជាក់ ការកំណត់ទីតាំងត្រូវបាន commit ទៅ projection និងប្រវត្តិដែលត្រូវគ្នា។ បើប្រតិបត្តិការបរាជ័យ កម្មវិធីមិនគួរបង្ហាញថាជោគជ័យទេ ហើយអាច refresh ទិន្នន័យពី server ម្តងទៀត។

`BarcodeDetector` ត្រូវបានប្រើជាមុន ហើយ ZXing ជា fallback ដើម្បីគាំទ្រឧបករណ៍ច្រើនប្រភេទ។

## ព្រំដែនទិន្នន័យសំខាន់

- Zoescan អានពី `zoew_scanner_lookup` ដែលជាទិន្នន័យសង្ខេបសម្រាប់ការស្វែងរក និងការព្រមាន Locker។ វាមិនអាន COD/DOD ឬប្រវត្តិអាជីវកម្មពេញលេញទេ។
- តួនាទី `scanner` សរសេរបានតែវាល assignment Locker និង metadata របស់វា លើ item ដែលមានស្រាប់។
- Scanner មិនអាចបង្កើត item ថ្មី, លុប item/Barcode, ឬកែ `id`, `phone`, `barcode`, `cod`, `dod`, `isClosed` និងវាលអាជីវកម្មផ្សេងទៀតបានទេ។ ការការពារនេះធ្វើនៅ Firebase Rules មិនមែនត្រឹមតែ UI។
- ការកំណត់ Locker ប្រើ reservation និង atomic fan-out ដើម្បីកុំឱ្យ lookup និង history បែកគ្នាពេលមាន Scanner ពីរគ្រឿងធ្វើការក្បែរៗគ្នា។

## ពេលមានបញ្ហា

- Barcode មិនឃើញ៖ ផ្ទៀងផ្ទាត់ថាវាត្រូវបានបញ្ចូលដោយ ZoeAdmin រួច ហើយឱ្យ Admin ប្រើ **កំណត់ទិន្នន័យ Scanner Lookup ឡើងវិញ**។
- Locker ជាន់គ្នា៖ ពិនិត្យការព្រមាន និងសុំការបញ្ជាក់ពីអ្នកទទួលខុសត្រូវ មុនបង្ខំផ្លាស់ទី។
- បរាជ័យពេលរក្សាទុក៖ កុំស្កេនជាន់គ្នាភ្លាមៗ។ រង់ចាំសារ error/refresh រួចពិនិត្យបញ្ជី Locker ជាមុន។

## Config, Deploy និង Rules

Firebase Config អាចទទួលតាម Setup Link ឬ QR ប៉ុន្តែត្រូវឆ្លង Security PIN, ពិនិត្យ JSON និងរក្សាទុកដោយអ្នកប្រើផ្ទាល់។ Logout សម្អាតទិន្នន័យដែលបង្ហាញក្នុង UI។

Deploy ថត `Zoescan` ជា static site។ Service Worker ទទួល asset ថ្មីនៅផ្ទៃខាងក្រោយ ហើយអនុវត្តពេលបើក App លើកក្រោយ។

**ត្រូវ Publish ដោយដៃ៖** ការកែ `firebase-database.rules.json` នៅ root មិនទៅ Firebase ដោយស្វ័យប្រវត្តិទេ។ Backup Rules ចាស់, paste Rules ថ្មីទៅ Business Firebase Project, សាកល្បងក្នុង Rules Simulator ហើយចុច **Publish** មុនឱ្យគណនី Scanner ប្រើកំណែនេះ។

## តេស្តមុន release

```bash
node --check Zoescan/app.js
node audit-tools/version-check.js
bash audit-tools/run-all.sh
```

## អាជ្ញាប័ណ្ណ

គម្រោងនេះជាកម្មសិទ្ធិឯកជន — Powered by ZoeW.
