# Zoe-System — ប្រព័ន្ធគ្រប់គ្រងកញ្ចប់ទំនិញ

**Zoe-System** ជាសំណុំ App ចំនួន **៤** (4 independent PWAs) សម្រាប់គ្រប់គ្រងកញ្ចប់ទំនិញ
(Parcel/Package) របស់អតិថិជន ចាប់ពីការស្កេន Barcode បញ្ចូលកញ្ចប់ថ្មី, កំណត់ទីតាំង Locker,
ការទទួល/បិទបញ្ជី, រហូតដល់ការគណនាប្រាក់ត្រូវទារ (COD/DOD) និងស្ថិតិចំណូល។

## App ទាំង ៤

| App | តួនាទីអនុញ្ញាត | មុខងារសំខាន់ | README |
|---|---|---|---|
| **ZoeAdmin** | `admin` | App គ្រប់គ្រងសំខាន់ — បញ្ចូល/លុប/កែប្រែកញ្ចប់ទាំងអស់, Export PDF/Excel/CSV, ស្ថិតិពេញលេញ | [ZoeAdmin/README.md](ZoeAdmin/README.md) |
| **ZoeW** | `admin`, `worker` | ទទួល/តាមដានកញ្ចប់ — បិទ/បើកបញ្ជី, កែលេខទូរស័ព្ទ, មើលស្ថិតិ (មិនអាចបញ្ចូលកញ្ចប់ថ្មី) | [ZoeW/README.md](ZoeW/README.md) |
| **Zoescan** | `admin`, `worker`, `scanner` | កំណត់ទីតាំង Locker ប៉ុណ្ណោះ (មិនអាចបញ្ចូល/លុបកញ្ចប់) | [Zoescan/README.md](Zoescan/README.md) |
| **ZoeKeyGen** | `admin` (Firebase Project ដាច់ដោយឡែក) | បង្កើត/Revoke/Extend Activation Key + បង្កើត Setup Link/QR សម្រាប់ App ទាំង ៣ខាងលើ | [ZoeKeyGen/README.md](ZoeKeyGen/README.md) |

ឧបករណ៍បន្ថែម (មិនមែន App ដែល Deploy ជូនអតិថិជនទេ)៖

| ថត | អ្វី | README |
|---|---|---|
| `firebase-backup/` | Node.js CLI សម្រាប់ Backup Firebase RTDB របស់អតិថិជននីមួយៗ (gzip + rotation) — Vendor ដំណើរការខ្លួនឯង | [firebase-backup/README.md](firebase-backup/README.md) |

## ស្ថាបត្យកម្ម (Architecture)

- **Vanilla JS, គ្មាន Framework, គ្មាន Build Step** — គ្រាន់តែ Static files (HTML/CSS/JS)
  Deploy ត្រង់ៗ។ App នីមួយៗមាន `netlify.toml` ផ្ទាល់ខ្លួន ហើយ Deploy ជា Netlify Site ដាច់ដោយឡែក។
- **ZoeAdmin, ZoeW, Zoescan** ចែករំលែក Firebase Realtime Database តែមួយ (ទិន្នន័យអាជីវកម្ម —
  Parcel/COD/DOD)។ Rules នៅ [firebase-database.rules.json](firebase-database.rules.json)
  (Root) ត្រូវ Paste ដោយដៃទៅ Firebase Console → Realtime Database → Rules → Publish —
  **មិន Deploy ស្វ័យប្រវត្តិទេ** ព្រោះ Netlify Serve តែ Static files ប៉ុណ្ណោះ។
- **ZoeKeyGen** ប្រើ Firebase Project **ដាច់ដោយឡែកទាំងស្រុង** ពី ៣ App ខាងលើ (មិនប៉ះពាល់
  ទិន្នន័យអាជីវកម្ម ទោះ Project នេះមានបញ្ហាក៏ដោយ) — Rules ផ្ទាល់ខ្លួននៅ
  `ZoeKeyGen/firebase-database.rules.json`។
- **សំខាន់**៖ ទោះ ZoeAdmin និង ZoeW មានមុខងារស្រដៀងគ្នាច្រើន (delete/restore/pickup-stat/
  revenue) `app.js` របស់ App នីមួយៗគឺ **ជា File ដាច់ដោយឡែក ស្ទួនគ្នា** — ការជួសជុល Bug
  ក្នុង App មួយ **មិន Auto-apply** ទៅ App ដទៃទេ ត្រូវពិនិត្យ Mirror ដោយដៃរាល់ពេល។
- `license-verify.js` ត្រូវតែ **Byte-identical** គ្រប់ទាំង ៤ App (Shared Public Key +
  Verification Logic សម្រាប់ផ្ទៀងផ្ទាត់ Activation Key ពី ZoeKeyGen)។
- **១ Sentry Project រួម** សម្រាប់ App ទាំង ៤ ញែកគ្នាដោយ Tag `app`
  (`zoeadmin`/`zoew`/`zoescan`/`zoekeygen`)។

## ទិន្នន័យក្នុង Firebase (Business DB)

| Path | អ្នកអាន | ខ្លឹមសារ |
|---|---|---|
| `zoew_scan_history_cod_dod` | `admin`, `worker` | កញ្ចប់សកម្មទាំងអស់ (រួម COD/DOD, barcodes[]) |
| `zoew_recently_deleted_cod_dod` | `admin`, `worker` | ធុងសំរាម (លុប ១០ថ្ងៃ ស្វ័យប្រវត្តិ) |
| `zoew_scanner_lookup` | គ្រប់តួនាទី | ទិន្នន័យកាត់តម្រឹមសម្រាប់ Zoescan (Phone + Barcode + Locker តែប៉ុណ្ណោះ) |
| `zoew_daily_revenue_cod_dod` | `admin`, `worker` | ស្ថិតិចំណូលប្រចាំថ្ងៃ (Persistent) |
| `zoew_monthly_revenue_cod_dod` | `admin`, `worker` | ស្ថិតិចំណូលប្រចាំខែ (រក្សា ៣ខែចុងក្រោយ) |
| `zoew_daily_pickup_cod_dod` | `admin`, `worker` | ស្ថិតិអតិថិជន/កញ្ចប់ដែលបានយក ប្រចាំថ្ងៃ (Persistent) |
| `zoew_barcode_registry` | `admin`, `worker` | ការពារ Barcode ស្ទួន (ដោះលែងតែពេលលុបអចិន្ត្រៃយ៍) |
| `zoew_settings/exchange_rate` | `admin`, `worker` | អត្រាប្តូរប្រាក់ (សរសេរបានតែ `admin`) |
| `user_roles/$uid` | ម្ចាស់គណនី + `admin` | តួនាទី `admin`/`worker`/`scanner` |

## ដំឡើងសម្រាប់អតិថិជនថ្មី (Provisioning)

Vendor បង្កើត Firebase Project ដាច់ដោយឡែក **១ សម្រាប់អតិថិជន ១** ។ ដើម្បីកុំឲ្យត្រូវវាយ Config
JSON ដោយដៃលើគ្រប់ Device សូមប្រើ **Setup Link**៖

1. ក្នុង **ZoeKeyGen** → កាត "🔗 បង្កើត Setup Link" — បិទភ្ជាប់ Firebase Config JSON របស់
   អាជីវកម្មនោះ, ជ្រើស App គោលដៅ + Base URL — ទទួលបាន Link `https://<app-site>/?setup=<base64>`
   ព្រមទាំង **QR Code**។
2. នៅលើ Device គោលដៅ ជ្រើសយកមធ្យោបាយណាមួយ៖
   - បើក Link នោះផ្ទាល់ (ផ្ញើតាម Telegram ជាដើម — **កុំបង្ហោះជាសាធារណៈ**), ឬ
   - បើក App → ⚙️ Config → **"📷 ស្កេន QR (Setup Link)"** រួចស្កេន QR ពីអេក្រង់ ZoeKeyGen។
3. ទាំងពីរផ្លូវ **ត្រូវឆ្លងកាត់ Security PIN ជាមុនសិន** ហើយបំពេញ Config ចូល Textarea ឲ្យមនុស្ស
   ពិនិត្យ រួចចុច "រក្សាទុក" ដោយខ្លួនឯង — គ្មានផ្លូវណារក្សាទុកស្វ័យប្រវត្តិដោយស្ងាត់ៗទេ។
   លើ Device ថ្មីដែលមិនទាន់មាន PIN ប្រព័ន្ធនឹងបង្ខំឲ្យកំណត់ PIN ជាមុនសិន។
4. បន្ទាប់មក Paste Rules (`firebase-database.rules.json`) ចូល Firebase Console ហើយ Publish។

## ការពារទិន្នន័យ (Backup)

Firebase RTDB គ្មាន Backup ស្វ័យប្រវត្តិទេ។ សូមរៀបចំ `firebase-backup/` ឲ្យដំណើរការតាមកាលកំណត់
(Windows Task Scheduler ឬ cron) សម្រាប់អតិថិជនទាំងអស់ — មើល
[firebase-backup/README.md](firebase-backup/README.md)។

## អាជ្ញាប័ណ្ណ (License)

គម្រោងនេះជាកម្មសិទ្ធិឯកជន (Private/Proprietary) — Powered By ZoeW
