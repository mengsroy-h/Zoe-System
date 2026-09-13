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

### របៀបរត់ ២ (ជ្រើសយកមួយ ឬទាំងពីរ)

| របៀប | រត់នៅឯណា | សមនឹង |
|---|---|---|
| **ដោយដៃ / Task Scheduler** | ម៉ាស៊ីនរបស់អ្នក | អ្នកចង់ទុក backup លើ Disk ខ្លួនឯង |
| **GitHub Actions** (`.github/workflows/backup.yml`) | GitHub រៀងរាល់ថ្ងៃ ០២:០០ ម៉ោងកម្ពុជា | អ្នកចង់ឲ្យវារត់ទោះម៉ាស៊ីនបិទ |

ទាំង ២ ប្រើ `backup.js` ដដែល។ របៀប GitHub Actions បន្ថែម **ការអ៊ិនគ្រីប**
(`crypt.js`) ព្រោះ artifact ដេកនៅលើ server របស់អ្នកដទៃ។

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

- `keepCount` — ចំនួន Backup ថ្មីបំផុតដែលរក្សាទុកក្នុងមួយជំនួញ (លំនាំដើម 30) — ចាស់ជាងនេះលុបចោលស្វ័យប្រវត្តិ
  ដើម្បីកុំឲ្យ Disk ពេញ។ បើ Run ជារៀងរាល់ថ្ងៃ 30 មានន័យថារក្សាទុកបាន ១ខែ។ ត្រូវជាចំនួនគត់ចាប់ពី 1 ឡើងទៅ —
  បើដាក់តម្លៃមិនត្រឹមត្រូវ (0, អវិជ្ជមាន, ឬមិនមែនលេខ) Script បញ្ឈប់ភ្លាមដោយបង្ហាញកំហុស ជាជាងលុបទិន្នន័យខុស។
- `name` — ប្រើជាឈ្មោះថតលទ្ធផលផងដែរ ដូច្នេះអនុញ្ញាតតែ អក្សរឡាតាំង/លេខ/`.`/`-`/`_` ប៉ុណ្ណោះ។
- `requestTimeoutMs` — ពិដានពេលក្នុង request នីមួយៗ រហូតអាន JSON body ពេញ (លំនាំដើម 120 វិនាទី)។ HTTP បដិសេធក៏បិទ body ដែលនៅសល់ ដើម្បីឲ្យ process ចេញបាន។
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

### ជំហានទី ៦ — រត់ដោយស្វ័យប្រវត្តិលើ GitHub Actions (ជម្រើសទី ២)

Workflow `.github/workflows/backup.yml` រត់រៀងរាល់ថ្ងៃម៉ោង **០២:០០ ម៉ោងកម្ពុជា**
(cron `0 19 * * *` ជា UTC) ហើយអាចចុច **Run workflow** ដោយដៃបានផងដែរ។

**Secret ២ ត្រូវកំណត់** នៅ GitHub ➜ **Settings ➜ Secrets and variables ➜
Actions ➜ New repository secret** ៖

| ឈ្មោះ | តម្លៃ |
|---|---|
| `ZOE_BACKUP_TARGETS` | JSON array (ទម្រង់ខាងក្រោម) |
| `ZOE_BACKUP_PASSPHRASE` | ពាក្យសម្ងាត់ **យ៉ាងតិច ១៦ តួ** — រក្សាទុកក្រៅ GitHub |

ទម្រង់ `ZOE_BACKUP_TARGETS` — **មួយ Object ក្នុងមួយ Firebase Project** ៖

```json
[
  {
    "name": "biz-a",
    "databaseURL": "https://xxx-default-rtdb.firebaseio.com",
    "serviceAccount": { "client_email": "...", "private_key": "...", "token_uri": "..." }
  },
  {
    "name": "zoekeygen-license",
    "databaseURL": "https://yyy-default-rtdb.firebaseio.com",
    "serviceAccount": { "client_email": "...", "private_key": "...", "token_uri": "..." }
  }
]
```

`serviceAccount` ជាខ្លឹមសារ File JSON ដែលទាញពី Firebase Console (ជំហានទី ២)
ដាក់ចូលទាំងស្រុង — ឬជា String មួយក៏បាន។ `name` អនុញ្ញាតតែអក្សរឡាតាំង/លេខ/`.`/`-`/`_`។

⛔ **ពាក្យសម្ងាត់នេះជាកូនសោតែមួយ** — បើភ្លេច នោះ backup ទាំងអស់លែងបើកបាន។
GitHub មិនអាចប្រាប់វាមកវិញទេ។ សូមរក្សាទុកក្នុងកន្លែងផ្សេង (Password Manager)។

⚠️ GitHub **ផ្អាក** workflow តាមកាលកំណត់ ក្រោយ repo ស្ងាត់ ៦០ ថ្ងៃ — បើគ្មាន
commit យូរ សូមចូលទៅ Actions រួចចុច **Enable workflow** ម្តងទៀត។

### អាជីវកម្មច្រើន ➜ Database ច្រើន ៖ តើ backup ចូល GitHub តែមួយកើតទេ?

**កើត** — `ZOE_BACKUP_TARGETS` ជា Array ដូច្នេះ Project ប៉ុន្មានក៏បាន។ ជុំមួយ
ទាញគ្រប់ Project រួចដាក់ **ថតដាច់ដោយឡែកក្នុងមួយអាជីវកម្ម** ក្នុង artifact តែមួយ ៖

```
zoe-backup-<run_id>/
  biz-a/2026-09-04T19-00-00-000Z-a1b2c3.json.gz.enc
  biz-b/2026-09-04T19-00-05-000Z-d4e5f6.json.gz.enc
  zoekeygen-license/2026-09-04T19-00-08-000Z-778899.json.gz.enc
```

អាជីវកម្មមួយធ្លាក់ (សោខូច · Project ត្រូវលុប) **មិនបញ្ឈប់អាជីវកម្មផ្សេងទេ** —
`backup.js` បន្តទៅ Project បន្ទាប់ ហើយ backup **ដែលជោគជ័យនៅតែត្រូវរក្សាទុក
ជា artifact ដដែល**។ បន្ទាប់មក job ទើបក្លាយជា **ក្រហម** ➜ GitHub ផ្ញើ Email
ប្រាប់អ្នក។ សូមមើល log ជំហាន «ទាញទិន្នន័យពី Firebase» ដើម្បីដឹងថាមួយណាធ្លាក់។

តែមានព្រំដែន **ពិត ២** ដែលត្រូវសម្រេចជាមុន ៖

**១. អ្នកត្រូវមានសោ Service Account របស់ Project នោះ។** ZoeW ឲ្យអតិថិជននីមួយៗ
paste Firebase Config **របស់ខ្លួន** ➜ ទិន្នន័យស្ថិតក្នុង Project **របស់អតិថិជន**
មិនមែនរបស់អ្នកទេ។ ដូច្នេះ ៖

- Project ដែល **អ្នកជាម្ចាស់** (អាជីវកម្មរបស់អ្នក + Project License របស់
  ZoeKeyGen) ➜ ដាក់ចូលបានតែម្ដង។
- Project **របស់អតិថិជន** ➜ ត្រូវឲ្យអតិថិជនផ្ដល់សោមកជាមុន។ នេះជាការសម្រេច
  **ទំនុកចិត្ត** មិនមែនបច្ចេកទេស — អ្នកនឹងកាន់ទិន្នន័យអតិថិជនគេ។ បើធ្វើ សូម
  ស្នើសោ **អានតែម្យ៉ាង** (ខាងក្រោម) និងប្រាប់អតិថិជនឲ្យដឹងជាមុន។

**សោអានតែម្យ៉ាង (សូមប្រើជានិច្ចសម្រាប់ backup)** ៖ ក្នុង Google Cloud Console
➜ **IAM & Admin ➜ Service Accounts ➜ Create** ➜ ដាក់ Role តែ
**`Firebase Realtime Database Viewer`** ប៉ុណ្ណោះ (កុំដាក់ Owner/Editor) ➜
**Keys ➜ Add key ➜ JSON**។ សោបែបនេះ **អាន** បាន តែ **សរសេរ ឬលុបមិនបាន** ➜
បើវាលេចធ្លាយ ទិន្នន័យអតិថិជននៅសុវត្ថិភាព។

**២. កូតាទំហំរបស់ GitHub Actions។** Repo ឯកជនលើគម្រោង **Free** មានប្រហែល
**500 MB** សម្រាប់ artifact (សូមពិនិត្យលេខពិតនៅ **Settings ➜ Billing and
plans ➜ Plans and usage** ព្រោះ GitHub ប្តូរកូតាបានតាមពេល)។ រូបមន្ត ៖

```
ទំហំដែលស៊ីកូតា ≈ ទំហំមួយជុំ (គ្រប់អាជីវកម្មរួម) × ចំនួនថ្ងៃរក្សាទុក
```

ជុំនីមួយៗរាយ **ទំហំពិត** ក្នុង Summary របស់ Actions ➜ គុណនឹងចំនួនថ្ងៃ រួច
ធៀបនឹង ៥០០ MB។ ឧទាហរណ៍ ៖ ៥ អាជីវកម្ម × ២ MB = ១០ MB/ជុំ × ៣០ ថ្ងៃ = **៣០០ MB**
(នៅសល់)។ តែ ១៥ អាជីវកម្ម × ៣ MB = ៤៥ MB/ជុំ × ៣០ ថ្ងៃ = **១.៣ GB** (លើសកូតា)។

ជុំមួយចំណាយប្រហែល **១–៣ នាទី** នៃកូតា Actions minutes (Free = ២,០០០
នាទី/ខែ) ➜ រត់រាល់ថ្ងៃស៊ីតិចតួចប៉ុណ្ណោះ។

ដើម្បីកែ ៖ **Settings ➜ Secrets and variables ➜ Actions ➜ Variables** បង្កើត
`ZOE_BACKUP_RETENTION_DAYS` (លំនាំដើម `30`, តម្លៃត្រឹមត្រូវ **1–90**)។ ដាក់
`7` ឬ `14` ពេលអាជីវកម្មច្រើន ហើយទាញ artifact ដែលចង់ទុកយូរមកដាក់ Disk ខ្លួនឯង។

### ការស្តារទិន្នន័យមកវិញ (Restore) — ធ្វើដោយដៃ

Script នេះមិនរួមបញ្ចូល Auto-restore ទេ ដោយចេតនា (Restore គឺជាសកម្មភាពគ្រោះថ្នាក់ — អាចសរសេរជាន់ពីលើ
ទិន្នន័យផ្ទាល់ដែលកំពុងប្រើ) ។ បើត្រូវការស្តារជាក់ស្តែង៖

0. **បើទាញពី GitHub artifact** (ឈ្មោះ File បញ្ចប់ដោយ `.enc`) ត្រូវស្រាយសោជាមុន៖
   ```
   ZOE_BACKUP_PASSPHRASE=... node crypt.js open backup-file.json.gz.enc backup-file.json.gz
   ```
   (លើ Windows PowerShell ៖ `$env:ZOE_BACKUP_PASSPHRASE='...'` រួចទើបរត់បន្ទាត់ខាងលើ)
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
- **Artifact អ៊ិនគ្រីបជានិច្ច** — `crypt.js` ប្រើ AES-256-GCM ជាមួយកូនសោដេរីវេ
  តាម scrypt។ ការកែ ១ byte ឬពាក្យសម្ងាត់ខុស ➜ **ស្រាយមិនបាន** (មិនមែនចេញ
  ទិន្នន័យខូចទេ)។ ការអ៊ិនគ្រីប **ផ្ទៀងផ្ទាត់ដោយស្រាយត្រឡប់វិញ** មុនសរសេរ ➜
  backup ដែលបើកមិនរួច មិនអាចកើតឡើងស្ងាត់ៗបានទេ។
- **plaintext ត្រូវលុបមុន upload** ហើយ workflow មានជំហានផ្ទៀងផ្ទាត់ដាច់ដោយឡែក
  ដែល **ធ្លាក់** បើនៅសល់ `.json.gz` ណាមួយ។
- **សោ Service Account មិនដែលចុះលើ checkout** — `ci-config.js` បដិសេធផ្លូវ
  ណាមួយក្នុង repo ហើយ workflow លុបសោចោល **ទោះជុំនោះធ្លាក់ក៏ដោយ** (`if: always()`)។
- **សិទ្ធិ Token របស់ workflow ត្រឹម `contents: read`**។
- **សូមប្រើសោអានតែម្យ៉ាង** (`Firebase Realtime Database Viewer`) សម្រាប់ backup —
  សោដែលសរសេរបាន គឺជាហានិភ័យដែលមិនចាំបាច់។

---

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 **ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)**។

ផ្នែកមួយនៃ Zoe-System សម្រាប់ប្រើក្នុងអាជីវកម្មរបស់ម្ចាស់ប៉ុណ្ណោះ។ ឧបករណ៍នេះ
មិនត្រូវការ Activation Key ទេ ព្រោះវាមិនមែនជា App របស់អតិថិជន។

⛔ **អត្ថបទអាជ្ញាប័ណ្ណពេញលេញជាឯកសារគ្រប់គ្រង** — សេចក្តីសង្ខេបខាងលើមិន
ជំនួសវាទេ ៖

| ឯកសារ | ខ្លឹមសារ |
|---|---|
| **[`LICENSE`](../LICENSE)** | កម្មសិទ្ធិលើ source code · ការហាមឃាត់ · ការចូលរួមរបស់អ្នកអភិវឌ្ឍ · ច្បាប់គ្រប់គ្រង |
| **[`NOTICE`](../NOTICE)** | attribution របស់កូដភាគីទីបីដែល ship (Apache-2.0 · MIT) |
