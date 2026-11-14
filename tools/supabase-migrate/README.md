# ផ្ទេរទិន្នន័យហាងចូល Supabase (`tools/supabase-migrate`)

CLI នាំទិន្នន័យរបស់ **ហាងមួយ** ចូលហាងមួយ (tenant) ក្នុង Supabase Project ៖ ពី **Firebase export** (អតិថិជនដែលជ្រើសប្តូរពី Firebase
ទៅ Supabase) ឬពី **archive backup ហាង Supabase** ដែល [`tools/firebase-backup/`](../firebase-backup/README.md) បង្កើត (ស្តារហាង · ចម្លងហាង)។
Firebase និង Supabase ជាជម្រើសរបស់អតិថិជនទាំងពីរ ➜ ឧបករណ៍នេះប្រើតែសម្រាប់អតិថិជនដែលសម្រេចប្តូរ ហើយវាមិនប៉ះ Firebase ទេ។

> 📖 ឯកសារនេះសរសេរតែ **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព · អាជ្ញាប័ណ្ណ**។ ប្រវត្តិ និងលេខដែលវាស់បាន ស្ថិតក្នុង
> **[docs/HISTORY.md](../../docs/HISTORY.md)**។

## កំណែ

- CLI ដាច់ដោយឡែក ដែលម្ចាស់គម្រោងរត់លើម៉ាស៊ីនខ្លួនឯង ➜ **មិន deploy** ហើយ **មិនប៉ះ `APP_VERSION` ឬ `CACHE_VERSION`** របស់ App ណាមួយ។
- **Node.js 18 ឬថ្មីជាងនេះ** · **គ្មាន dependency ខាងក្រៅ** (ប្រើតែ `fetch` · `zlib` · `crypto` ក្នុង Node) ➜ មិនចាំបាច់ `npm install`។
- រត់ពី checkout របស់ repo នេះ ៖ វាប្រើ [`tools/firebase-backup/supabase.js`](../firebase-backup/supabase.js) (ទម្រង់ archive · ការហៅ RPC) ·
  [`tools/firebase-backup/crypt.js`](../firebase-backup/crypt.js) (ឯកសារ `.enc`) និង [`firebase-database.rules.json`](../../firebase-database.rules.json)
  (ការពិនិត្យរូបរាង record)។
- Project Supabase ត្រូវមាន migration ទាំងអស់ក្នុង [`supabase/migrations/`](../../supabase/migrations) (RPC `zoe_admin_tenants` · `zoe_admin_export` ·
  `zoe_admin_write`) ➜ [`supabase/README.md`](../../supabase/README.md) ជំហានទី ២។

## មុខងារ

### Input ដែលទទួល

| Input | មកពីណា |
|---|---|
| `*.json` · `*.json.gz` | Firebase Console ➜ Realtime Database ➜ ⋮ ➜ **Export JSON** · ឬ dump របស់ `tools/firebase-backup/` (Firebase Project របស់ហាងមួយ) |
| `*.json.gz.enc` | artifact របស់ GitHub Actions (`tools/firebase-backup/`) ➜ ស្រាយក្នុង memory ដោយ `ZOE_BACKUP_PASSPHRASE` (plaintext មិនចុះ Disk) |
| archive ហាង Supabase | ឯកសារក្នុង `backups/<target>/<tenant-id>/` · ឬថតនោះផ្ទាល់ (CLI យកឯកសារថ្មីបំផុត) |

### ការពិនិត្យមុនសរសេរ (ជានិច្ច)

`zoe_admin_write` សរសេរដោយ **មិនអនុវត្ត rules** ➜ CLI ពិនិត្យ record នីមួយៗតាម `firebase-database.rules.json` មុន ៖

| កម្រិត | ករណី |
|---|---|
| `[ERROR]` | root ដែលមិនមានក្នុង rules (ZoeW មិនដែលអាន ➜ ប្រហែលជាឯកសារខុស ឧ. Project License) · តម្លៃមិនមែន object នៅកន្លែងដែល rules រំពឹង object (ឧ. primitive ក្រោម `$itemId` ➜ ZoeW រំលង record នោះ) · record ដែល rules មិនអនុញ្ញាត · key មាន `. # $ / [ ]` ឬតួបញ្ជា · ជ្រៅលើស ៣២ ថ្នាក់ · record ធំលើស 1 MiB · អក្សរ NUL ឬ Unicode ខូច · លេខលើសព្រំដែន |
| `[WARN]` | វាលដែល rules មិនអនុញ្ញាតក្នុង record ដែលល្អ (ZoeW អានបាន តែរក្សាទុក record នោះវិញទាំងមូលមិនបាន) |

មាន `[ERROR]` ➜ `--apply` **បដិសេធ** (គ្មានការសរសេរ) រហូតដល់កែប្រភព ឬដាក់ `--skip-invalid` (ទុក record ទាំងនោះចោល ហើយរាយវា)។
record ដែលទុកចោល (ឬ root ទាំងមូលដែលខូច) នៅតែជា record **ក្នុង input** ៖ ច្បាប់ចម្លងដែលហាងមានរួចនៅដដែល (មិនសរសេរ · មិនលុប សូម្បីតែ `--replace`)
➜ `Kept` រាយវា ហើយ `VERIFIED … equals the input except the left-out records`។
ពេល record ដែលហាងរក្សាជាប្រវត្តិ (`zoew_scan_history_cod_dod`) ឬធុងសំរាម (`zoew_recently_deleted_cod_dod`) កូនសោ `zoew_barcode_registry` របស់ហាងដែល input មិនមាន
ក៏នៅដដែលដែរ (`Registry` រាយចំនួន) ៖ record ទាំងនោះអាចជាម្ចាស់វា ហើយឧបករណ៍មិនអាចបញ្ជាក់ពី input ដែលខូចបានទេ។ កូនសោដែលគ្មានម្ចាស់ធ្វើឲ្យ ZoeW
បដិសេធតែការស្កេន barcode នោះម្តងទៀត ➜ ពិនិត្យដោយភ្នែកក្រោយនាំចូល។ record ដែលរក្សាផ្សេងទៀត (ledger · registry …) មិនជាម្ចាស់កូនសោទេ ➜ `--replace` នៅលុបកូនសោដែល input មិនមាន។
ពេលមាន record ដែលរក្សា `--replace` ក៏បោះពុម្ព `Note` ៖ record ផ្សេង (ledger · ស្ថិតិយករួច · ធុងសំរាម) មកពី input ហើយមិនបានផ្ទៀងជាមួយ record ដែលរក្សា
➜ ពិនិត្យចំណូល និងចំនួនយករួចក្នុង ZoeW ក្រោយនាំចូល។
input ដែល **គ្មាន record ណាឆ្លងការពិនិត្យ** (Firebase ទទេ export ជា `null` · array · root មិនស្គាល់ទាំងអស់ · record ខូចទាំងអស់) ➜ **បដិសេធ** ទោះមាន `--skip-invalid`
(`--skip-invalid` ទុកចោលតែ record ខូច មិនមែន input ទាំងមូល ➜ គ្មានអ្វីត្រូវនាំចូល ហើយ `--replace` នឹងគ្រាន់តែលុប) — ពិនិត្យថាជាឯកសារត្រឹមត្រូវ។

ករណីដាច់ដោយឡែក៖ archive Supabase v2 មាន `manifest.audit_only: true`, document ទទេ និង audit ដែលត្រឹមត្រូវមិនទទេ អាចនាំចូលតែប្រវត្តិបាន។ វារក្សា document របស់គោលដៅដដែល ទោះមាន `--replace`។

### ការសរសេរ និងការផ្ទៀងផ្ទាត់

- **dry-run ជាលំនាំដើម** ៖ រាយចំនួន record និងទំហំតាម root · លទ្ធផលពិនិត្យ · ផែនការ (សរសេរ · លុប · ដដែល) ➜ **គ្មានការសរសេរ**។
- `--apply` ៖ សរសេរតាម `zoe_admin_write` ជា **បាច់មានព្រំដែន** (លំនាំដើម ២០០ record · 1 MiB ក្នុងមួយបាច់) · **op id ដាច់តាមបំណងរត់ CLI នីមួយៗ និងបាច់** ➜
  ចម្លើយបាត់ ➜ retry សំណើដដែលប្រើ op id ដដែល មិនអនុវត្ត ២ ដង។ រត់ CLI ថ្មី ➜ អានស្ថានភាពបច្ចុប្បន្ន ហើយបង្កើត ID ថ្មីសម្រាប់បាច់ដែលនៅត្រូវសរសេរ · សរសេរតែ record ដែលខុសពីហាងបច្ចុប្បន្ន។ ការរត់ឡើងវិញត្រូវផ្ទៀង `Target`, `Plan` និងលទ្ធផលចុងក្រោយ; `replayed` មិនបញ្ជាក់ថាទិន្នន័យបច្ចុប្បន្នស្មើ input ទេ។
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
3. **Input** ៖ Export JSON ពី Firebase Console · ឬ dump/archive របស់ `tools/firebase-backup/`។

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
3. ត្រូវឃើញ `VERIFIED: tenant … equals the input` និង exit code `0`។ ដាច់កណ្តាលទី ➜ ពិនិត្យ dry-run ម្តងទៀតមុនបន្ត។ បើឃើញ `replayed` ជាមួយ `VERIFY FAILED` ត្រូវឈប់ពិនិត្យ មិនចាត់ការរត់ដដែលថាជាការស្តារជោគជ័យទេ។
4. បើកហាងក្នុង ZoeW ➜ ពិនិត្យប្រវត្តិ · ចំណូល · ធុងសំរាម។

### ស្តារហាង Supabase ពី backup

Archive v2 រក្សា `zoe_docs` និងប្រវត្តិ `zoe_business_audit`។ CLI ពិនិត្យ audit schema, count, digest និង source scope មុនសរសេរ; `--skip-invalid` មិនអាចរំលង audit ខូច/មិនគាំទ្របានទេ។ Archive v1 ដែលគ្មាន audit នៅអានបាន ហើយមិនប្រឌិតប្រវត្តិចាស់; ការសរសេរនាំចូលថ្មីអាចបង្កើត audit ថ្មីពិតក្នុង DB តាម trigger។

ការផ្ទេរទៅ tenant ថ្មីប្ដូរតែម្ចាស់ផ្ទុក `tenant_id` របស់ historical event។ Event ID, actor, operation, ពេល UTC ដើមដល់ microsecond និង `origin_tenant_id` នៅដដែល; មិនយកអ្នករត់ CLI ឬពេលនាំចូលទៅជំនួសត្រាដើមទេ។ `(target tenant, event ID)` និង payload ដូចគ្នា អាច retry បាន; ID ដដែលតែខ្លឹមសារខុស ➜ បដិសេធ មិន overwrite ប្រវត្តិ។ Audit របស់គោលដៅដែលមិនមានក្នុង input នៅតែរក្សា ទោះ `--replace`។

Audit នាំចូលជាបាច់តាម `zoe_admin_audit_restore` មុន document writes ហើយក្រោយសរសេរ CLI បង្ហាញ `AUDIT VERIFIED` បន្ថែមលើ document `VERIFIED`។ Archive ទាំងមូលមិនមែន transaction តែមួយទេ៖ failure កណ្ដាលទីអាចទុកបាច់ដែល commit រួច; exit មិនស្មើ 0 ហើយត្រូវរត់ input ដដែលឡើងវិញ ដើម្បី reconcile ដោយ event ID ដដែល។ Audit RPC ខ្វះ ឬខ្លឹមសារប្រវត្តិប៉ះទង្គិច មិនអនុញ្ញាតឱ្យចាត់ជា restore ជោគជ័យទេ។

ពិដានសរុប audit ក្នុង CLI៖ **២០,០០០ event និង 32 MiB compact JSON ក្នុង tenant មួយ** សម្រាប់ archive/target export។ គណនាមុនសន្សំក្នុង memory និងមុន serialize/hash; merged historical audit ដែលលើសក៏បដិសេធមុននាំចូល។ មិនកាត់/លុប audit ដើម្បីឱ្យឆ្លងទេ។ អត្រាប្រតិបត្តិការខ្ពស់អាចដល់ពិដាននេះលឿន; មិនទាន់មានភស្តុតាងសមត្ថភាពទំហំធំពីការកំណត់ពិដាននេះទេ។ ប្រវត្តិធំជាងនេះត្រូវការ database backup ដោយម្ចាស់ប្រព័ន្ធ ឬការងារ export/restore តាមទំព័រដែលមានការគ្រប់គ្រងដាច់ដោយឡែក; CLI full archive នេះមិនមានការចែកផ្នែកស្វ័យប្រវត្តិទេ។ ការរក្សា audit និងសកម្មភាពអាជីវកម្មក្នុង DB មិនត្រូវបានកំណត់ដោយពិដាន backup នេះទេ។

Firebase export ដែលមាន `zoew_business_audit_v1` ឬ `zoew_business_audit_failures_v1` ត្រូវបដិសេធ ទោះមាន `--skip-invalid` ព្រោះ provenance របស់ Firebase មិនទាន់មានការបម្លែងដែលគាំទ្រទៅ audit Supabase។ រក្សាឯកសារដើម; កុំលុប namespace ដើម្បីរំលងការពិនិត្យ។

⛔ Archive មិនរក្សា `zoe_ops` ឬស្តារ operation receipt ទាំងនោះទេ។ `VERIFIED`/`AUDIT VERIFIED` គ្របតែ document និង historical audit ក្នុងវិសាលភាពនេះ មិនមែន DB និងភស្តុតាង recovery ទាំងមូល។ រក្សា journal **pending/unknown** និងផ្ទៀង authoritative outcome ដាច់ដោយឡែក; កុំចាត់ receipt ដែលបាត់ជា NOT_APPLIED ឬ replay លុយស្វ័យប្រវត្តិ។ ផែនការ rollout/Reset និងព្រំដែន recovery នៅ [Supabase README](../../supabase/README.md)។

```
export ZOE_BACKUP_PASSPHRASE=…        (ឯកសារ .enc ពី GitHub Actions)
node tools/supabase-migrate/migrate.js backups/<target>/<tenant-id>/ --branch <លេខសាខា> --replace
node tools/supabase-migrate/migrate.js backups/<target>/<tenant-id>/ --branch <លេខសាខា> --apply --replace
```

ផ្ទៀង dry-run ដោយ `--replace` និងហាងគោលដៅដដែល មុនបន្ថែម `--apply`; dry-run ដែលគ្មាន `--replace` មិនរាយផែនការលុបដូចគ្នាទេ។

`--replace` ធ្វើឲ្យ record ក្នុងវិសាលភាព `zoe_docs` ស្មើ backup តាមលក្ខខណ្ឌនាំចូលខាងលើ ➜ ទិន្នន័យដែលកើតក្រោយ backup **បាត់** ➜ ពិនិត្យ `Plan` ក្នុង dry-run មុនជានិច្ច។

### Option ផ្សេង

| Option | ន័យ |
|---|---|
| `--tenant <uuid>` | ជ្រើសហាងតាម id (ដាក់ជាមួយ `--branch` ➜ ត្រូវជាហាងដដែល) |
| `--url` · `--secret-key` | ជំនួស env (⛔ សោលើបន្ទាត់បញ្ជា កម្មវិធីផ្សេងអាចមើលឃើញ ➜ ប្រើ env) |
| `--skip-invalid` | ទុក record `[ERROR]` ចោល (រាយ) ហើយនាំចូលអ្វីដែលនៅសល់ · ច្បាប់ចម្លងរបស់ហាងនៃ record ទាំងនោះនៅដដែល (`Kept`) និងកូនសោ registry របស់ហាងពេល record នោះជាប្រវត្តិ ឬធុងសំរាម (`Registry`) · input ដែលគ្មាន record ល្អសោះ នៅតែបដិសេធ |
| `--rules <file>` | ឯកសារ rules ផ្សេង |
| `--batch-ops` · `--batch-bytes` | ទំហំបាច់ (ពិដាន ៤០០ record · 2 MiB) |
| `--timeout-ms` · `--retries` · `--retry-delay-ms` | ពិដានក្នុងមួយសំណើ · ចំនួន retry (timeout · 408/425/429/5xx) · ពេលរង់ចាំដំបូង |

| សារ | ធ្វើអ្វី |
|---|---|
| `REFUSED: tenant already has …` | ជ្រើសហាងខុស? ពិនិត្យសាខា · ហាងត្រូវ ➜ `--replace` |
| `VERIFY FAILED` | ហាងមិនស្មើ input។ ពិនិត្យ record ខុស និង concurrent writes ហើយរត់ dry-run ម្តងទៀត។ Retry សំណើ HTTP ដដែលរក្សា op id ដើម្បីមិនសរសេរស្ទួន; រត់ CLI ថ្មីអានស្ថានភាពបច្ចុប្បន្ន និងប្រើ ID ថ្មីសម្រាប់បាច់ដែលនៅត្រូវសរសេរ។ ត្រូវឃើញ `VERIFIED` និង exit code `0` មុនចាត់ថាស្តាររួច |
| `CHANGED BY OTHERS` | ឧបករណ៍មួយកំពុងបើក ZoeW ➜ បិទ រួចរត់ម្តងទៀត |
| `HTTP 401` | Secret key ខុស ឬត្រូវលុប |
| `HTTP 404 PGRST202` | Project មិនទាន់មាន migration សម្រាប់ document/audit RPC ដែល CLI ត្រូវការ |
| `aggregate … budget exceeded` | រក្សា backup/DB ដដែល; ប្រវត្តិលើសពិដាន full archive និងត្រូវការទម្រង់ចែកផ្នែក មិនត្រូវកាត់ប្រវត្តិចោល |
| `timed out` | បណ្តាញយឺត ➜ រត់ម្តងទៀត ឬបង្កើន `--timeout-ms` |

## ប្រព័ន្ធសុវត្ថិភាព

- **Secret key = សិទ្ធិពេញលើគ្រប់ហាង** ៖ អានពី env (ឬ `--secret-key`) តែប៉ុណ្ណោះ · **មិនដែលបោះពុម្ព** · មិនសរសេរចូលឯកសារណាមួយ · ផ្ញើតែក្នុង header
  `apikey` ទៅ URL របស់ Project លើ **HTTPS** (HTTP តែ `127.0.0.1`/`localhost`) · Publishable key ត្រូវបដិសេធមុនបណ្តាញ ➜ ប្រើសោដាច់ដោយឡែក
  ហើយលុបវាក្រោយប្រើ។
- **dry-run ជាលំនាំដើម** · `--apply` ត្រូវតែដាក់ច្បាស់ · ហាងមានទិន្នន័យផ្សេង ➜ បដិសេធ (ការពារការចាក់ទិន្នន័យហាងមួយចូលហាងមួយទៀតដោយច្រឡំ)។
- **គ្មានការលុបហាងទាំងមូល** ៖ `--replace` លុបតែ record ដែលបានឃើញ ហើយផ្ទៀងផ្ទាត់ហាងទាំងមូលក្រោយសរសេរ។
- **op id រួមបំណងរត់ CLI ថ្មី · tenant · លេខបាច់ · ខ្លឹមសារ** + `zoe_ops` លើ Server ➜ retry សំណើដដែលក្រោយចម្លើយបាត់រក្សា arguments ដដែល និងមិនអនុវត្តបាច់ ២ ដង · រាល់សំណើមាន **ពិដានពេល** ហើយ retry មានចំនួនកំណត់ ·
  401/403/4xx មិន retry។
- **rules មិនត្រូវរំលងដោយស្ងាត់** ៖ record ដែល ZoeW អានមិនបាន ត្រូវរាយ មិនមែននាំចូល។
- **ឯកសារ `.enc`** ស្រាយក្នុង memory តែប៉ុណ្ណោះ ➜ plaintext មិនចុះ Disk។
- អ្នកយាម ៖ `tools/audit-tools/supabase-data-tools-test.js` (Postgres ពិត · CLI ពិត · ចម្លើយបាត់ · ព្យួរ · សោខុស · mutation)។
- Audit archive ៖ `tools/audit-tools/supabase-audit-archive-test.js` (PostgreSQL 17 ពិត · v2/legacy · audit-only · ទិន្នន័យប៉ះទង្គិច · ពិដានសរុប · mutation)។ លំនាំដើមត្រូវរត់គ្រប់ phase; `--unit` ជា `PARTIAL PASS` សម្រាប់ diagnostic ហើយ strict mode បដិសេធ។

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 **ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)**។ ផ្នែកមួយនៃ Zoe-System សម្រាប់ប្រើក្នុងអាជីវកម្មរបស់ម្ចាស់ប៉ុណ្ណោះ —
មើល [`LICENSE`](../../LICENSE) និង [`NOTICE`](../../NOTICE)។
