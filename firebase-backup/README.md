# Firebase Backup Tool

Script សម្រាប់ Backup ទិន្នន័យ Firebase Realtime Database របស់ជំនួញនីមួយៗ (ZoeAdmin/ZoeW/Zoescan
share គ្នា) ព្រមទាំង Project License របស់ ZoeKeyGen ទៅជា File JSON (Compress ជា `.gz`) ដាក់ក្នុងម៉ាស៊ីន
ក្នុងស្រុក ជាទៀងទាត់ដោយស្វ័យប្រវត្តិ (តាម Task Scheduler/Cron)។ នេះជា **Script ដាច់ដោយឡែក** ដំណើរការ
ដោយអ្នកគ្រប់គ្រង (Vendor) ខ្លួនឯង — មិនមែនផ្នែកមួយនៃ App ទាំង ៤ ទេ។

## ហេតុអ្វីត្រូវការ

ទិន្នន័យអាជីវកម្ម (Parcel/Revenue/COD/DOD) ទាំងអស់ស្ថិតនៅតែក្នុង Firebase តែមួយកន្លែងក្នុងមួយជំនួញ។
បើ Project មានបញ្ហា (លុបខុសទាំង Database, Account ត្រូវបានលុប, Billing issue) គ្មានវិធីសង្គ្រោះទិន្នន័យ
មកវិញបានទេ លុះត្រាតែមាន Backup ដាច់ដោយឡែក។

## ជំហានទី ១ — ដំឡើង

```
cd firebase-backup
npm install
```

## ជំហានទី ២ — យក Service Account Key (សម្រាប់ជំនួញនីមួយៗ)

សម្រាប់ Firebase Project នីមួយៗដែលចង់ Backup (ជំនួញនីមួយៗ + Project License របស់ ZoeKeyGen)៖

1. ចូល [Firebase Console](https://console.firebase.google.com) → ជ្រើសរើស Project → ⚙️ **Project
   Settings** → **Service accounts**
2. ចុច **Generate new private key** → ទាញយក File JSON
3. ដាក់ File នេះទុកក្នុង folder `firebase-backup/secrets/` (Folder នេះមិនត្រូវបាន Commit ចូល Git ទេ
   ដោយសារ `.gitignore` — សូមកុំផ្លាស់ប្តូរ `.gitignore` ដើម្បីអនុញ្ញាតវា Key ទាំងនេះជា Credential ពិត
   មិនមែន Firebase Config ធម្មតាទេ — បើលេចធ្លាយ អាចអានសរសេរទិន្នន័យទាំងអស់បាន)

## ជំហានទី ៣ — កំណត់រចនាសម្ព័ន្ធ

```
cp config.example.json config.json
```

កែ `config.json` ដាក់ជំនួញនីមួយៗ (មួយ Object ក្នុង Array `businesses` ក្នុងមួយ Project)៖

```json
{
  "backupDir": "./backups",
  "keepCount": 30,
  "businesses": [
    {
      "name": "ឈ្មោះជំនួញ-សម្រាប់កំណត់ត្រា",
      "serviceAccountPath": "./secrets/xxx-service-account.json",
      "databaseURL": "https://xxx-default-rtdb.firebaseio.com"
    }
  ]
}
```

- `keepCount` — ចំនួន Backup ចាស់បំផុតដែលរក្សាទុកក្នុងមួយជំនួញ (លំនាំដើម 30) — ចាស់ជាងនេះលុបចោលស្វ័យប្រវត្តិ
  ដើម្បីកុំឲ្យ Disk ពេញ។ បើ Run ជារៀងរាល់ថ្ងៃ 30 មានន័យថារក្សាទុកបាន ១ខែ។ ត្រូវជាចំនួនគត់ចាប់ពី 1 ឡើងទៅ —
  បើដាក់តម្លៃមិនត្រឹមត្រូវ (0, អវិជ្ជមាន, ឬមិនមែនលេខ) Script បញ្ឈប់ភ្លាមដោយបង្ហាញកំហុស ជាជាងលុបទិន្នន័យខុស។
- `name` — ប្រើជាឈ្មោះថតលទ្ធផលផងដែរ ដូច្នេះអនុញ្ញាតតែ អក្សរឡាតាំង/លេខ/`.`/`-`/`_` ប៉ុណ្ណោះ។

Backup ត្រូវសរសេរចូល File បណ្ដោះអាសន្ន `.partial` សិន រួចទើប Rename — ដូច្នេះបើដាច់ចរន្ត ឬបញ្ឈប់កណ្ដាលទី នឹងគ្មាន File Backup ខូចទុកសល់ (ហើយវាក៏មិនរាប់ចូល `keepCount` ដែលអាចរុញ Backup ល្អចេញនោះដែរ)។

`config.json` ក៏មិនត្រូវបាន Commit ចូល Git ដែរ (មាន Path ទៅ Secret Files) ។

## ជំហានទី ៤ — Run ដោយដៃម្តងសាកល្បង

```
npm run backup
```

នឹងឃើញលទ្ធផលដូចជា៖
```
[OK]   ជំនួញ-A -> ./backups/ជំនួញ-A/2026-08-19T12-00-00-000Z.json.gz (42.3 KB)
[OK]   zoekeygen-license-project -> ./backups/zoekeygen-license-project/2026-08-19T12-00-05-000Z.json.gz (3.1 KB)

All 2 backup(s) completed.
```

បើជំនួញណាមួយបរាជ័យ Script នៅតែបន្តទៅជំនួញបន្ទាប់ (មិនឈប់ទាំងស្រុង) ហើយចប់ដោយ Exit code មិនមែន 0
ដើម្បីឲ្យ Task Scheduler/Cron ដឹងថាមានបញ្ហា។

## ជំហានទី ៥ — កំណត់ឲ្យ Run ស្វ័យប្រវត្តិជាប្រចាំ

### Windows (Task Scheduler)

1. បើក **Task Scheduler** → **Create Basic Task**
2. Trigger: **Daily** (ឧ. ម៉ោង 2 ព្រឹក)
3. Action: **Start a program**
   - Program/script: `node`
   - Arguments: `backup.js`
   - Start in: Path ពេញលេញទៅ folder `firebase-backup` (ឧ. `C:\Users\hunme\Zoe-System\firebase-backup`)

### Linux/Mac (Cron)

```
crontab -e
```
បន្ថែមបន្ទាត់ (Run រៀងរាល់ថ្ងៃ 2 ព្រឹក)៖
```
0 2 * * * cd /path/to/firebase-backup && /usr/bin/node backup.js >> backup.log 2>&1
```

## ការស្តារទិន្នន័យមកវិញ (Restore) — ធ្វើដោយដៃ

Script នេះមិនរួមបញ្ចូល Auto-restore ទេ ដោយចេតនា (Restore គឺជាសកម្មភាពគ្រោះថ្នាក់ — អាចសរសេរជាន់ពីលើ
ទិន្នន័យផ្ទាល់ដែលកំពុងប្រើ) ។ បើត្រូវការស្តារជាក់ស្តែង៖

1. Unzip File Backup ដែលចង់ស្តារ (`gunzip -k backup-file.json.gz` ឬប្រើ 7-Zip លើ Windows)
2. ប្រើ Script តូចមួយ (ជាមួយ Service Account ដដែល)៖

```js
const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./secrets/xxx-service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://xxx-default-rtdb.firebaseio.com'
});
const data = JSON.parse(fs.readFileSync('./backup-file.json', 'utf8'));
admin.database().ref('/').set(data).then(() => {
    console.log('Restored!');
    process.exit(0);
});
```

**សូមប្រុងប្រយ័ត្នខ្លាំង** — `.set('/')` សរសេរជាន់ពីលើទិន្នន័យបច្ចុប្បន្នទាំងអស់។ សូមប្រាកដថាចង់ធ្វើដូច្នេះ
មែន (ឧ. ក្នុងករណីទិន្នន័យខូច/បាត់) មុននឹង Run។
