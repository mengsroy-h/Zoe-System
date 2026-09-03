# Firebase Backup Tool

Script សម្រាប់ Backup ទិន្នន័យ Firebase Realtime Database របស់ជំនួញនីមួយៗ (ZoeW)
ព្រមទាំង Project License របស់ ZoeKeyGen ទៅជា File JSON (Compress ជា `.gz`) ដាក់ក្នុងម៉ាស៊ីន
ក្នុងស្រុក ជាទៀងទាត់ដោយស្វ័យប្រវត្តិ (តាម Task Scheduler/Cron)។ នេះជា **Script ដាច់ដោយឡែក** ដំណើរការ
ដោយអ្នកគ្រប់គ្រង (Vendor) ខ្លួនឯង — មិនមែនផ្នែកមួយនៃ App ទាំង ២ ទេ។

> 📖 ឯកសារនេះសរសេរតែ **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព ·
> អាជ្ញាប័ណ្ណ**។ ប្រវត្តិកំហុស ស្ថិតក្នុង
> **[docs/HISTORY.md](../docs/HISTORY.md)**។

## កំណែ

CLI ដាច់ដោយឡែក — **មិន deploy ទេ** ហើយវា **មិនប៉ះ `APP_VERSION` ឬ
`CACHE_VERSION`** របស់ App ណាមួយឡើយ។ វាប្រើ Node.js 18+ ជាមួយ native
HTTPS/OAuth REST ➜ **គ្មាន third-party dependency**។

## មុខងារ

### ហេតុអ្វីត្រូវការ

ទិន្នន័យអាជីវកម្ម (Parcel/Revenue/COD/DOD) ទាំងអស់ស្ថិតនៅតែក្នុង Firebase តែមួយកន្លែងក្នុងមួយជំនួញ។
បើ Project មានបញ្ហា (លុបខុសទាំង Database, Account ត្រូវបានលុប, Billing issue) គ្មានវិធីសង្គ្រោះទិន្នន័យ
មកវិញបានទេ លុះត្រាតែមាន Backup ដាច់ដោយឡែក។

---

## របៀបប្រើប្រាស់

### ជំហានទី ១ — តម្រូវការ

ប្រើ **Node.js 18 ឬថ្មីជាងនេះ**។ Script ប្រើតែ API ដែលមានស្រាប់ក្នុង Node
(`fetch`, `AbortController`, `crypto`) និង **គ្មាន third-party runtime dependency** ទេ —
មិនចាំបាច់ `npm install`។

### ជំហានទី ២ — យក Service Account Key (សម្រាប់ជំនួញនីមួយៗ)

សម្រាប់ Firebase Project នីមួយៗដែលចង់ Backup (ជំនួញនីមួយៗ + Project License របស់ ZoeKeyGen)៖

1. ចូល [Firebase Console](https://console.firebase.google.com) → ជ្រើសរើស Project → ⚙️ **Project
   Settings** → **Service accounts**
2. ចុច **Generate new private key** → ទាញយក File JSON
3. ដាក់ File នេះទុកក្នុង folder `firebase-backup/secrets/` (Folder នេះមិនត្រូវបាន Commit ចូល Git ទេ
   ដោយសារ `.gitignore` — សូមកុំផ្លាស់ប្តូរ `.gitignore` ដើម្បីអនុញ្ញាតវា Key ទាំងនេះជា Credential ពិត
   មិនមែន Firebase Config ធម្មតាទេ — បើលេចធ្លាយ អាចអានសរសេរទិន្នន័យទាំងអស់បាន)

### ជំហានទី ៣ — កំណត់រចនាសម្ព័ន្ធ

```
cp config.example.json config.json
```

កែ `config.json` ដាក់ជំនួញនីមួយៗ (មួយ Object ក្នុង Array `businesses` ក្នុងមួយ Project)៖

```json
{
  "backupDir": "./backups",
  "keepCount": 30,
  "requestTimeoutMs": 120000,
  "retryCount": 2,
  "retryDelayMs": 1000,
  "lockStaleMs": 43200000,
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
- `requestTimeoutMs` — ពិដានពេលក្នុង request នីមួយៗ (លំនាំដើម 120 វិនាទី)។
- `retryCount` និង `retryDelayMs` — retry សម្រាប់ timeout, 408/429/5xx ដោយ exponential backoff;
  កំហុស 401/403 មិន retry ទេ។
- `lockStaleMs` — ទប់ backup ពីររត់ជាន់គ្នា; lock ដែលសល់ពី process ដួលអាចសង្គ្រោះក្រោយ 12 ម៉ោង។

Backup ត្រូវសរសេរចូល File បណ្ដោះអាសន្ន `.partial` សិន រួចទើប Rename — ដូច្នេះបើដាច់ចរន្ត ឬបញ្ឈប់កណ្ដាលទី នឹងគ្មាន File Backup ខូចទុកសល់ (ហើយវាក៏មិនរាប់ចូល `keepCount` ដែលអាចរុញ Backup ល្អចេញនោះដែរ)។
OAuth access token មានអាយុខ្លីត្រូវបានបង្កើតពី service-account key ក្នុង memory ហើយបញ្ជូនទៅ
Firebase តាម `Authorization: Bearer` — token/private key មិនត្រូវដាក់ក្នុង URL ឬ output log ទេ។

`config.json` ក៏មិនត្រូវបាន Commit ចូល Git ដែរ (មាន Path ទៅ Secret Files) ។

### ជំហានទី ៤ — Run ដោយដៃម្តងសាកល្បង

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

### ជំហានទី ៥ — កំណត់ឲ្យ Run ស្វ័យប្រវត្តិជាប្រចាំ

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

### ការស្តារទិន្នន័យមកវិញ (Restore) — ធ្វើដោយដៃ

Script នេះមិនរួមបញ្ចូល Auto-restore ទេ ដោយចេតនា (Restore គឺជាសកម្មភាពគ្រោះថ្នាក់ — អាចសរសេរជាន់ពីលើ
ទិន្នន័យផ្ទាល់ដែលកំពុងប្រើ) ។ បើត្រូវការស្តារជាក់ស្តែង៖

1. Unzip File Backup ដែលចង់ស្តារ (`gunzip -k backup-file.json.gz` ឬប្រើ 7-Zip លើ Windows)
2. ចូល Firebase Console → Realtime Database → ⋮ → **Import JSON** ហើយជ្រើស file ដែលបានបើក។

**សូមប្រុងប្រយ័ត្នខ្លាំង** — Import នៅ root អាចសរសេរជាន់/លុបទិន្នន័យបច្ចុប្បន្ន។ សាកល្បងលើ
Firebase project បណ្ដោះអាសន្នសិន ហើយបិទការសរសេររបស់ App មុន restore production។

---

## ប្រព័ន្ធសុវត្ថិភាព

- **Service-account key ជា credential ពិត** — `config.json` · `secrets/` និង
  `backups/` ស្ថិតក្នុង `.gitignore`។ ⛔ កុំ commit វា។
- **ការសរសេរជា atomic** — សរសេរទៅ `.partial` រួច `rename()` ចូលកន្លែង ➜
  ការរត់ដែលដាច់ពាក់កណ្តាល **មិនបន្សល់ `.json.gz` កាត់ខ្លី** ដែលមើលទៅដូច
  backup ល្អទេ។
- **Timeout និង retry** សម្រាប់បណ្តាញដែលដាច់បណ្តោះអាសន្ន។
- **Lock** ការពារ process ពីររត់ជាន់គ្នា។
- **គ្មាន third-party dependency** ➜ ផ្ទៃវាយប្រហារតូចបំផុត។

---

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — ផ្នែកមួយនៃ Zoe-System សម្រាប់ប្រើក្នុងអាជីវកម្មរបស់
ម្ចាស់ប៉ុណ្ណោះ។ ឧបករណ៍នេះមិនត្រូវការ Activation Key ទេ ព្រោះវាមិនមែនជា
App របស់អតិថិជន។
