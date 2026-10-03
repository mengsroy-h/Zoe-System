# ផ្ទេរទិន្នន័យហាងចូល Supabase (`tools/supabase-migrate`)

CLI នាំទិន្នន័យរបស់ **ហាងមួយ** ចូលហាងមួយ (tenant) ក្នុង Supabase Project ៖ ពី **Firebase export** (អតិថិជនដែលជ្រើសប្តូរពី Firebase
ទៅ Supabase) ឬពី **archive backup ហាង Supabase** ដែល [`firebase-backup/`](../../firebase-backup/README.md) បង្កើត (ស្តារហាង · ចម្លងហាង)។
Firebase និង Supabase ជាជម្រើសរបស់អតិថិជនទាំងពីរ ➜ ឧបករណ៍នេះប្រើតែសម្រាប់អតិថិជនដែលសម្រេចប្តូរ ហើយវាមិនប៉ះ Firebase ទេ។

> 📖 ឯកសារនេះសរសេរតែ **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព · អាជ្ញាប័ណ្ណ**។ ប្រវត្តិ និងលេខដែលវាស់បាន ស្ថិតក្នុង
> **[docs/HISTORY.md](../../docs/HISTORY.md)**។

## កំណែ

- CLI ដាច់ដោយឡែក ដែលម្ចាស់គម្រោងរត់លើម៉ាស៊ីនខ្លួនឯង ➜ **មិន deploy** ហើយ **មិនប៉ះ `APP_VERSION` ឬ `CACHE_VERSION`** របស់ App ណាមួយ។
- **Node.js 18 ឬថ្មីជាងនេះ** · **គ្មាន dependency ខាងក្រៅ** (ប្រើតែ `fetch` · `zlib` · `crypto` ក្នុង Node) ➜ មិនចាំបាច់ `npm install`។
- រត់ពី checkout របស់ repo នេះ ៖ វាប្រើ [`firebase-backup/supabase.js`](../../firebase-backup/supabase.js) (ទម្រង់ archive · ការហៅ RPC) ·
  [`firebase-backup/crypt.js`](../../firebase-backup/crypt.js) (ឯកសារ `.enc`) និង [`firebase-database.rules.json`](../../firebase-database.rules.json)
  (ការពិនិត្យរូបរាង record)។
- Project Supabase ត្រូវមាន migration ទាំងអស់ក្នុង [`supabase/migrations/`](../../supabase/migrations) (RPC `zoe_admin_tenants` · `zoe_admin_export` ·
  `zoe_admin_write`) ➜ [`supabase/README.md`](../../supabase/README.md) ជំហានទី ២។

## មុខងារ

### Input ដែលទទួល

| Input | មកពីណា |
|---|---|
| `*.json` · `*.json.gz` | Firebase Console ➜ Realtime Database ➜ ⋮ ➜ **Export JSON** · ឬ dump របស់ `firebase-backup/` (Firebase Project របស់ហាងមួយ) |
| `*.json.gz.enc` | artifact របស់ GitHub Actions (`firebase-backup/`) ➜ ស្រាយក្នុង memory ដោយ `ZOE_BACKUP_PASSPHRASE` (plaintext មិនចុះ Disk) |
| archive ហាង Supabase | ឯកសារក្នុង `backups/<target>/<tenant-id>/` · ឬថតនោះផ្ទាល់ (CLI យកឯកសារថ្មីបំផុត) |

### ការពិនិត្យមុនសរសេរ (ជានិច្ច)

`zoe_admin_write` សរសេរដោយ **មិនអនុវត្ត rules** ➜ CLI ពិនិត្យ record នីមួយៗតាម `firebase-database.rules.json` មុន ៖

| កម្រិត | ករណី |
|---|---|
| `[ERROR]` | root ដែលមិនមានក្នុង rules (ZoeW មិនដែលអាន ➜ ប្រហែលជាឯកសារខុស ឧ. Project License) · តម្លៃមិនមែន object នៅកន្លែងដែល rules រំពឹង object (ឧ. primitive ក្រោម `$itemId` ➜ ZoeW រំលង record នោះ) · record ដែល rules មិនអនុញ្ញាត · key មាន `. # $ / [ ]` ឬតួបញ្ជា · ជ្រៅលើស ៣២ ថ្នាក់ · record ធំលើស 1 MiB · អក្សរ NUL ឬ Unicode ខូច · លេខលើសព្រំដែន |
| `[WARN]` | វាលដែល rules មិនអនុញ្ញាតក្នុង record ដែលល្អ (ZoeW អានបាន តែរក្សាទុក record នោះវិញទាំងមូលមិនបាន) |

មាន `[ERROR]` ➜ `--apply` **បដិសេធ** (គ្មានការសរសេរ) រហូតដល់កែប្រភព ឬដាក់ `--skip-invalid` (ទុក record ទាំងនោះចោល ហើយរាយវា)។

### ការសរសេរ និងការផ្ទៀងផ្ទាត់

- **dry-run ជាលំនាំដើម** ៖ រាយចំនួន record និងទំហំតាម root · លទ្ធផលពិនិត្យ · ផែនការ (សរសេរ · លុប · ដដែល) ➜ **គ្មានការសរសេរ**។
- `--apply` ៖ សរសេរតាម `zoe_admin_write` ជា **បាច់មានព្រំដែន** (លំនាំដើម ២០០ record · 1 MiB ក្នុងមួយបាច់) · **op id ដេរីវេពីខ្លឹមសារ** ➜
  ចម្លើយបាត់ ➜ សំណើដដែល (op id ដដែល) មិនអនុវត្ត ២ ដង · សរសេរតែ record ដែលខុសពីហាងបច្ចុប្បន្ន ➜ រត់ម្តងទៀត = បន្តពីកន្លែងដាច់។
- **ហាងមានទិន្នន័យផ្សេងរួច** (record ដែលមិនមានក្នុង input ឬតម្លៃខុស) ➜ `REFUSED` លុះត្រាតែដាក់ `--replace`។
- `--replace` ៖ ធ្វើឲ្យហាង **ស្មើ input បេះបិទ** ៖ សរសេរជាន់ record ដែលខុស · លុបតែ record ដែល CLI ឃើញក្នុងហាងហើយមិនមានក្នុង input
  (⛔ មិនប្រើការលុបហាងទាំងមូលរបស់ `zoe_admin_write`)។
- ក្រោយសរសេរ ៖ ទាញហាងមកវិញតាម `zoe_admin_export` ➜ ប្រៀប **ចំនួន និងខ្លឹមសារ record នីមួយៗ តាម root** ➜ `VERIFIED` ឬ `VERIFY FAILED` ·
  ការសរសេរពីឧបករណ៍ផ្សេងចំពេលនាំចូល ➜ `CHANGED BY OTHERS`។

| Exit code | ន័យ |
|---|---|
| `0` | dry-run គ្មាន `[ERROR]` · ឬ `--apply` រួច ហើយ `VERIFIED` |
| `1` | `[ERROR]` · `REFUSED` · `VERIFY FAILED` · `CHANGED BY OTHERS` · បណ្តាញ/Server ធ្លាក់ |
| `2` | ការប្រើខុស (option ខុស · ខ្វះ `--tenant`/`--branch` ពេល `--apply`) |

## របៀបប្រើប្រាស់

### ជំហានទី ១ — ត្រៀម

1. **ហាងគោលដៅ** ៖ បង្កើតក្នុង ZoeKeyGen (កាត «🏪 ហាង Supabase») ➜ ចំណាំ **លេខសាខា** (ជ្រើសហាងដោយ `--branch <លេខសាខា>`)។
2. **Secret key** ៖ Supabase Dashboard ➜ **Project Settings ➜ API Keys ➜ Secret keys** ➜ បង្កើតសោថ្មីសម្រាប់ការងារនេះ (ឧ. `zoe-migrate`) ➜
   លុបវាចោលក្រោយផ្ទេររួច។ ⛔ កុំប្រើ Publishable key (CLI បដិសេធ)។
3. **Input** ៖ Export JSON ពី Firebase Console · ឬ dump/archive របស់ `firebase-backup/`។

### ជំហានទី ២ — dry-run (មិនសរសេរអ្វីទេ)

Linux/Mac (`read -s` មិនបង្ហាញសោ ហើយមិនកត់ក្នុង history) ៖

```
export ZOE_SUPABASE_URL=https://<ref>.supabase.co
read -rs ZOE_SUPABASE_SECRET_KEY && export ZOE_SUPABASE_SECRET_KEY
node tools/supabase-migrate/migrate.js firebase-export.json
node tools/supabase-migrate/migrate.js firebase-export.json --branch <លេខសាខា>
```

Windows PowerShell ៖

```
$env:ZOE_SUPABASE_URL = 'https://<ref>.supabase.co'
$k = Read-Host 'Secret key' -AsSecureString
$env:ZOE_SUPABASE_SECRET_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($k))
node tools/supabase-migrate/migrate.js firebase-export.json --branch <លេខសាខា>
```

- គ្មាន `--tenant`/`--branch` ➜ CLI រាយហាងទាំងអស់ (id · សាខា · ចំនួន record · ឈ្មោះ)។
- គ្មាន URL/សោ ➜ ពិនិត្យតែឯកសារ (ក្រៅបណ្តាញ)។
- អានលទ្ធផល ៖ `Checks` (`[ERROR]`/`[WARN]`) · `Target` (ហាងពិត) · `Plan` (សរសេរ · លុប/រក្សា · ដដែល)។

### ជំហានទី ៣ — សរសេរ (`--apply`)

1. ⛔ **បិទ ZoeW លើគ្រប់ឧបករណ៍របស់ហាងនោះ** មុនសរសេរ (ការសរសេរពីឧបករណ៍ចំពេលនាំចូល ➜ `CHANGED BY OTHERS`)។
2. រត់ ៖
   ```
   node tools/supabase-migrate/migrate.js firebase-export.json --branch <លេខសាខា> --apply
   ```
3. ត្រូវឃើញ `VERIFIED: tenant … equals the input` និង exit code `0`។ ដាច់កណ្តាលទី ➜ រត់ពាក្យបញ្ជាដដែលម្តងទៀត។
4. បើកហាងក្នុង ZoeW ➜ ពិនិត្យប្រវត្តិ · ចំណូល · ធុងសំរាម។

### ស្តារហាង Supabase ពី backup

```
export ZOE_BACKUP_PASSPHRASE=…        (ឯកសារ .enc ពី GitHub Actions)
node tools/supabase-migrate/migrate.js backups/<target>/<tenant-id>/ --branch <លេខសាខា>
node tools/supabase-migrate/migrate.js backups/<target>/<tenant-id>/ --branch <លេខសាខា> --apply --replace
```

`--replace` ធ្វើឲ្យហាងស្មើ backup បេះបិទ ➜ ទិន្នន័យដែលកើតក្រោយ backup **បាត់** ➜ ពិនិត្យ `Plan` ក្នុង dry-run មុនជានិច្ច។

### Option ផ្សេង

| Option | ន័យ |
|---|---|
| `--tenant <uuid>` | ជ្រើសហាងតាម id (ដាក់ជាមួយ `--branch` ➜ ត្រូវជាហាងដដែល) |
| `--url` · `--secret-key` | ជំនួស env (⛔ សោលើបន្ទាត់បញ្ជា កម្មវិធីផ្សេងអាចមើលឃើញ ➜ ប្រើ env) |
| `--skip-invalid` | ទុក record `[ERROR]` ចោល (រាយ) ហើយនាំចូលអ្វីដែលនៅសល់ |
| `--rules <file>` | ឯកសារ rules ផ្សេង |
| `--batch-ops` · `--batch-bytes` | ទំហំបាច់ (ពិដាន ៤០០ record · 2 MiB) |
| `--timeout-ms` · `--retries` · `--retry-delay-ms` | ពិដានក្នុងមួយសំណើ · ចំនួន retry (timeout · 408/425/429/5xx) · ពេលរង់ចាំដំបូង |

| សារ | ធ្វើអ្វី |
|---|---|
| `REFUSED: tenant already has …` | ជ្រើសហាងខុស? ពិនិត្យសាខា · ហាងត្រូវ ➜ `--replace` |
| `VERIFY FAILED` | មានការសរសេរផ្សេង ឬ Server ធ្លាក់ពាក់កណ្តាល ➜ រត់ម្តងទៀត |
| `CHANGED BY OTHERS` | ឧបករណ៍មួយកំពុងបើក ZoeW ➜ បិទ រួចរត់ម្តងទៀត |
| `HTTP 401` | Secret key ខុស ឬត្រូវលុប |
| `HTTP 404 PGRST202` | Project មិនទាន់មាន migration `zoe_admin_export` |
| `timed out` | បណ្តាញយឺត ➜ រត់ម្តងទៀត ឬបង្កើន `--timeout-ms` |

## ប្រព័ន្ធសុវត្ថិភាព

- **Secret key = សិទ្ធិពេញលើគ្រប់ហាង** ៖ អានពី env (ឬ `--secret-key`) តែប៉ុណ្ណោះ · **មិនដែលបោះពុម្ព** · មិនសរសេរចូលឯកសារណាមួយ · ផ្ញើតែក្នុង header
  `apikey` ទៅ URL របស់ Project លើ **HTTPS** (HTTP តែ `127.0.0.1`/`localhost`) · Publishable key ត្រូវបដិសេធមុនបណ្តាញ ➜ ប្រើសោដាច់ដោយឡែក
  ហើយលុបវាក្រោយប្រើ។
- **dry-run ជាលំនាំដើម** · `--apply` ត្រូវតែដាក់ច្បាស់ · ហាងមានទិន្នន័យផ្សេង ➜ បដិសេធ (ការពារការចាក់ទិន្នន័យហាងមួយចូលហាងមួយទៀតដោយច្រឡំ)។
- **គ្មានការលុបហាងទាំងមូល** ៖ `--replace` លុបតែ record ដែលបានឃើញ ហើយផ្ទៀងផ្ទាត់ហាងទាំងមូលក្រោយសរសេរ។
- **op id ដេរីវេពីខ្លឹមសារ** + `zoe_ops` លើ Server ➜ retry ក្រោយចម្លើយបាត់មិនអនុវត្តបាច់ ២ ដង · រាល់សំណើមាន **ពិដានពេល** ហើយ retry មានចំនួនកំណត់ ·
  401/403/4xx មិន retry។
- **rules មិនត្រូវរំលងដោយស្ងាត់** ៖ record ដែល ZoeW អានមិនបាន ត្រូវរាយ មិនមែននាំចូល។
- **ឯកសារ `.enc`** ស្រាយក្នុង memory តែប៉ុណ្ណោះ ➜ plaintext មិនចុះ Disk។
- អ្នកយាម ៖ `audit-tools/supabase-data-tools-test.js` (Postgres ពិត · CLI ពិត · ចម្លើយបាត់ · ព្យួរ · សោខុស · mutation)។

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 **ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)**។ ផ្នែកមួយនៃ Zoe-System សម្រាប់ប្រើក្នុងអាជីវកម្មរបស់ម្ចាស់ប៉ុណ្ណោះ —
មើល [`LICENSE`](../../LICENSE) និង [`NOTICE`](../../NOTICE)។
