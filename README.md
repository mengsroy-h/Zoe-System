# Zoe-System — ប្រព័ន្ធគ្រប់គ្រងកញ្ចប់ទំនិញ

ប្រព័ន្ធ PWA សម្រាប់អាជីវកម្មដឹកជញ្ជូន — **ZoeW** សរសេរលើ React + TypeScript
+ Vite (មាន build step) ចំណែក **ZoeKeyGen** ជា vanilla JavaScript គ្មាន build
step; App ទាំង ២ deploy ជា Netlify site។ ទិន្នន័យអាជីវកម្មរស់លើ **Firebase Project
មួយក្នុងមួយអតិថិជន** ឬលើ **[Supabase Project តែមួយ](supabase/README.md)** ដែលហាងចុះឈ្មោះ
ដោយខ្លួនឯងតាមកូដអញ្ជើញ (ជ្រើសតាម Config នៃឧបករណ៍នីមួយៗ)។

| App | តួនាទី | កំណែ |
|---|---|---|
| **[ZoeW](ZoeW/README.md)** | App អាជីវកម្មចម្បង — ស្កេន បញ្ចូល គ្រប់គ្រងកញ្ចប់ និងនាំចូល Excel ទៅ Sheet (web/PWA និង App Android) | `2.50.16` |
| **[ZoeKeyGen](ZoeKeyGen/README.md)** | ឧបករណ៍អ្នកលក់ — បង្កើត និងគ្រប់គ្រង Activation Key · បង្កើតហាង Supabase និងកូដអញ្ជើញ | `2.24.6` |

> 📖 ឯកសារនេះសរសេរតែ **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព ·
> អាជ្ញាប័ណ្ណ**។ ប្រវត្តិកំហុស និងហេតុផលនៃការសម្រេចនីមួយៗ ស្ថិតក្នុង
> **[docs/HISTORY.md](docs/HISTORY.md)** ដាច់ដោយឡែក។

---

## កំណែ

- **`APP_VERSION`** ជាកំណែផលិតផលតាម semver ដែលជា **របស់ App នីមួយៗ** ហើយត្រូវ
  ស៊ីនឹង `version` ក្នុង `manifest.json` **របស់ App នោះ**។
  ⛔ **លេខបច្ចុប្បន្នរស់នៅតារាងខាងលើតែមួយកន្លែង** — លេខដដែលក្នុង ២ កន្លែង
  ធ្វើឲ្យជុំក្រោយកែមួយ ភ្លេចមួយ។
- ⛔ **ឡើងកំណែតែ App ដែលកែពិត** — ការឡើងកំណែ App ដែលមិនប្រែ បង្ខំឲ្យអ្នកប្រើ
  ទាញសំបកទាំងមូលឡើងវិញដោយឥតប្រយោជន៍។
- **`CACHE_VERSION`** ក្នុង `sw.js` នៃ App នីមួយៗ (`<app>-vN`) ជាកូនសោ cache
  ដែលឡើងរាល់ពេលឯកសារ static ណាមួយប្រែ — វា **មិនមែន** ជាកំណែផលិតផលទេ។
- កំណែបង្ហាញដល់អ្នកប្រើ **២ កន្លែងក្នុង ZoeW** (ប្រអប់ចូល និងខាងក្រោមរបា Slide)
  និង **១ កន្លែងក្នុង ZoeKeyGen**។ លេខកំណែ ZoeW អាចចុចបើក
  **[សៀវភៅណែនាំ HTML](ZoeW/public/guide.html)** បាន។
- ប្រវត្តិការផ្លាស់ប្តូរពេញលេញ ៖ **[docs/HISTORY.md](docs/HISTORY.md)**។

**ពិនិត្យកំណែឲ្យស៊ីគ្នា**

```bash
node audit-tools/version-check.js        # app.js ↔ manifest.json ↔ index.html
node audit-tools/version-bump-scope.js   # ឡើងកំណែតែ App ដែលកែពិត
```

---

## មុខងារ

### ZoeW — App អាជីវកម្ម

| មុខងារ | ខ្លឹមសារ |
|---|---|
| **ស្កេន Barcode ៣ ផ្លូវ** | កាមេរ៉ា (ZXing WebAssembly + `BarcodeDetector`), ម៉ាស៊ីនស្កេន hardware និងរូបភាព។ ទទួលតែ **CODE-128** ដែលមានលេខផ្ទៀងផ្ទាត់ជាកាតព្វកិច្ច |
| **COD / DOD** | ទឹកប្រាក់ពីរប្រភេទក្នុងកញ្ចប់តែមួយ បូកលេខទូរស័ព្ទអតិថិជន និងទីតាំង Locker |
| **ស្ថិតិ** | ចំណូល ចំនួនកញ្ចប់ និងចំនួនអតិថិជនយក ប្រចាំថ្ងៃ និងប្រចាំខែ |
| **💵 ចំណូលប្រចាំថ្ងៃ** | អ័ក្សលុយទី ២ ៖ ទឹកប្រាក់តាម **ថ្ងៃដែលចុច «យក»** មិនមែនថ្ងៃស្កេនចូល (រក្សាទុក ៧ ថ្ងៃចុងក្រោយ) |
| **របាយការណ៍ប្រចាំខែ** | សង្ខេបចំណូល · កញ្ចប់ · អត្រាយក ក្នុងមួយខែ បូកតារាងតាមថ្ងៃ ➜ នាំចេញជា Excel ឬ PDF |
| **តម្រង និងស្វែងរក** | តម្រងតាមថ្ងៃ និងស្វែងរកតាមកន្ទុយលេខទូរស័ព្ទ ៣–៤ ខ្ទង់ |
| **ផ្ទាំងប្រវត្តិ** | ចុចរបាចាប់ ឬអូសឡើង/ចុះ ដើម្បីបង្រួម/ពង្រីកផ្ទាំង; ម៉ឺនុយ (...) បើកដោយចលនាស្រាល និងបិទពេលចាប់ផ្តើមអូសខាងក្រៅ |
| **ធុងសំរាម** | កញ្ចប់ដែលលុប/ដក ស្តារមកវិញបាន |
| **ចាក់សោ App** | PIN ឬក្រយៅដៃ/មុខ ពេលបើក App និងពេលត្រឡប់ចូលវិញ |
| **គណនីហាង (Supabase)** | ចុះឈ្មោះដោយ **កូដអញ្ជើញ** · Login ដោយឈ្មោះគណនី · ភ្លេចពាក្យសម្ងាត់ ➜ កូដពីអ្នកលក់ · គណនីចងនឹងហាង និងលេខសាខា ZTO ដោយ server |
| **🩺 ពិនិត្យសុខភាពប្រព័ន្ធ** | ជួរ **អានសុទ្ធសាធ** ៩ ជួរ ៖ បណ្ដាញ · Firebase · នាឡិកា · License · storage · Service Worker · តារាងអតិថិជន · កំណែ Apps Script · Lookup |
| **នាំចូល Excel ទៅ Sheet** | អាន `.xlsx` · `.xls` · `.csv` ➜ ផ្គូផ្គង Column ➜ សរសេរចូល Google Sheet (ការពារដោយ PIN) |
| **ការសម្អាតស្វ័យប្រវត្តិ** | Barcode ដែលបិទ «យករួច» ➜ ធុងសំរាមក្រោយ ២ ម៉ោង; មិនទាន់បិទ ➜ ចូលថ្ងៃទី ៨; `expired` ➜ លុបអចិន្ត្រៃយ៍ក្រោយ ២ ថ្ងៃ; ប្រភេទផ្សេង ➜ ៣០ ថ្ងៃ |
| **Export** | Excel (`.xlsx`) · CSV សម្រាប់ Google Sheets · PDF (SheetJS ស្ថិតក្នុង repo ➜ ដើរក្រៅបណ្តាញ) |
| **Lookup API** | ទាញលេខទូរស័ព្ទ/COD/DOD ពី Google Sheet ឬ ZTO ដោយស្វ័យប្រវត្តិពេលស្កេន |
| **ដំណើរការក្រៅបណ្តាញ** | សំបក App និង engine ស្កេនស្ថិតក្នុង cache ទាំងស្រុង |
| **សារនិយាយការពិត** | សារជោគជ័យ/ព្រមាន/កំហុសមានពណ៌ខុសគ្នា ហើយសារដែលអាស្រ័យលើការតភ្ជាប់ កែខ្លួនវាឡើងវិញពេលស្ថានភាពប្រែ |

- **ZTO** ៖ បំពេញលេខទូរស័ព្ទ/តម្លៃដោយស្កេន · របាដាស់តឿន «ZTO មិនទាន់បិទ» ·
  បិទតាម ZTO ស្វ័យប្រវត្តិ (កុងតាក់ ២ នេះលេចតែពេលគូស Fast Mode) ·
  និង **ទាញបញ្ជីកញ្ចប់ពី ZTO** ដើម្បីបញ្ចូលកញ្ចប់ដែលភ្លេច (ស្រេចចិត្ត ·
  លំនាំដើមបិទ)។ សាខាមកពី **គណនីដែលចូលប្រព័ន្ធ** ➜ ឧបករណ៍មួយអានបានតែ
  បញ្ជីរបស់សាខាខ្លួនឯង។

### ZoeKeyGen — ឧបករណ៍អ្នកលក់

| មុខងារ | ខ្លឹមសារ |
|---|---|
| **បង្កើត Activation Key** | Sign ដោយ ECDSA P-256 ព្រមទាំងកំណត់សុពលភាព |
| **Revoke / Extend** | ដកសិទ្ធិ ឬបន្ថែមសុពលភាព Key ដែលចេញរួច |
| **Setup Link និង QR** | Provision ឧបករណ៍អតិថិជនថ្មីដោយមិនបាច់វាយ Config ដោយដៃ |
| **តារាង Key** | Note · ថ្ងៃចេញ · ស្ថានភាព |
| **🏪 ហាង Supabase** | ចូលជា Admin ➜ បង្កើតហាង (ឈ្មោះ · លេខសាខា · សុពលភាព) ➜ កូដអញ្ជើញ + Setup Link/QR · ពន្យារ · បិទ/បើក · កូដប្តូរពាក្យសម្ងាត់ |

---

## របៀបប្រើប្រាស់

### ១. Deploy (ម្តងក្នុងមួយ App)

App ទាំង ២ ជា **Netlify site ដាច់ដោយឡែក**។ `netlify.toml` ក្នុងថតនីមួយៗ
កំណត់ build និង publish រួចរាល់ហើយ ៖

| ការកំណត់ | ZoeW | ZoeKeyGen |
|---|---|---|
| Base directory | `ZoeW` | `ZoeKeyGen` |
| Build command | `npm run build` | (ទទេ) |
| Publish directory | `dist` | `.` |

⛔ **Firebase rules មិន deploy ស្វ័យប្រវត្តិទេ** — Netlify បម្រើតែឯកសារ static។
រាល់ពេល `firebase-database.rules.json` ប្រែ ត្រូវ paste ចូល Firebase Console ➜
**Publish** ដោយដៃ។ មាន rules ២ ឯកសារ ៖

- `firebase-database.rules.json` — Firebase Project របស់ **អាជីវកម្ម**
- `ZoeKeyGen/firebase-database.rules.json` — Firebase Project របស់ **License**

⛔ **Supabase ក៏មិន deploy ស្វ័យប្រវត្តិដែរ** — migration · Edge Function ដាក់ដោយ CLI ឬ SQL Editor
([`supabase/README.md`](supabase/README.md))។ `firebase-database.rules.json` ជាប្រភពរបស់ rules ដែល Supabase អនុវត្ត ➜
កែវា ➜ Publish លើ Firebase **និង** paste `supabase/migrations/*_zoe_rules.sql` ដែលបង្កើតឡើងវិញ។

Rules **អាជីវកម្ម** ទៅអតិថិជនទាំងអស់ក្នុងពេលតែមួយ ៖
[`tools/firebase-provision/deploy-rules.cmd`](tools/firebase-provision/README-KH.md) (ដំឡើង ➜ អានត្រឡប់ ➜ វាស់)។

### ២. ដំឡើងឧបករណ៍ថ្មី (ZoeW)

**អតិថិជនថ្មី** ត្រូវការ Firebase Project ផ្ទាល់ខ្លួន ៖ អ្នកលក់រត់
[`tools/firebase-provision/new-customer.cmd`](tools/firebase-provision/README-KH.md) ➜ Project · Database ·
Rules · ការបិទ sign-up · គណនីបុគ្គលិក បង្កើតដោយពាក្យបញ្ជាតែមួយ ហើយវាបង្ហាញ Firebase Config / Setup Link សម្រាប់ជំហានទី ៣។

1. បើក URL របស់ site ➜ ប្រអប់សុំ **Activation Key** លេចឡើង។
2. Paste Key ដែលចេញពី ZoeKeyGen ➜ ✅ (ត្រូវការអ៊ីនធឺណិត)។
3. បញ្ចូល **Firebase Config** ៖ ⚙️ របា Slide ➜ Config។ ឬលឿនជាង — បើក
   **Setup Link / QR** ដែលចេញពី ZoeKeyGen ➜ Config បំពេញស្វ័យប្រវត្តិ
   (នៅតែសុំ PIN មុនរក្សាទុក)។
4. **ចូលប្រព័ន្ធ** ដោយអ៊ីមែល/ពាក្យសម្ងាត់ Firebase។
5. កំណត់ **Security PIN** ➜ វាការពារ Config · Lookup API · កែទឹកប្រាក់ ·
   Reset ស្ថិតិ · លុបទាំងអស់ · Locker · នាំចូល Excel។
6. (ស្រេចចិត្ត) បើក **ក្រយៅដៃ/មុខ** ក្នុងរបា Slide ➜ ដោះសោ PIN លឿនជាង។
7. (ស្រេចចិត្ត) ដំឡើង PWA ៖ Chrome/Edge ➜ «Install»; iPhone Safari ➜ «Add to Home Screen»។

### ២ខ. ហាងថ្មីលើ Supabase (ចុះឈ្មោះដោយកូដអញ្ជើញ)

1. អ្នកលក់ ៖ ZoeKeyGen ➜ **🏪 ហាង Supabase** ➜ បង្កើតហាង ➜ ផ្ញើ **Setup Link/QR** (មានកូដអញ្ជើញ)។
2. ម្ចាស់ហាង ៖ បើក Link ➜ វាយ PIN ➜ ចុច «✅ ភ្ជាប់» ➜ **📝 ចុះឈ្មោះដោយកូដអញ្ជើញ** ➜ ឈ្មោះគណនី + ពាក្យសម្ងាត់ ➜ ចូលប្រព័ន្ធភ្លាម
   (គ្មាន Activation Key · គ្មានគណនី Firebase)។
3. បុគ្គលិក ៖ សុំកូដអញ្ជើញបុគ្គលិកពីអ្នកលក់ ➜ ចុះឈ្មោះលើឧបករណ៍របស់គេ។

ការដំឡើង Supabase ម្តងគត់ (Project · migration · Edge Function · Admin) ៖ [`supabase/README.md`](supabase/README.md)។

### ៣. ការងារប្រចាំថ្ងៃ (ZoeW)

| ធ្វើអ្វី | នៅឯណា |
|---|---|
| ស្កេនកញ្ចប់ចូល | ទំព័រ **ស្កេន** ➜ កាមេរ៉ា · ម៉ាស៊ីនស្កេន · រូបភាព |
| កំណត់ទីតាំង Locker | ទំព័រ **ស្កេន** ➜ ប្តូររបៀបស្កេនទៅ Locker |
| ដកកញ្ចប់តាម Barcode | ទំព័រ **ស្កេន** ➜ **ស្កេនដកកញ្ចប់** ➜ ពិនិត្យ Barcode/លេខ/Locker/COD/DOD ➜ បញ្ជាក់ដក |
| មើលបញ្ជី និងស្ថិតិ | ទំព័រ **ទិន្នន័យ** — តម្រងថ្ងៃនៅខាងលើ |
| សម្គាល់ «យករួច» | ចុចលើកញ្ចប់ ➜ បិទតាម barcode ឬទាំងកញ្ចប់ |
| ស្វែងរកអតិថិជន | ប្រអប់ស្វែងរកលេខទូរស័ព្ទ (វាយកន្ទុយលេខ ៣–៤ ខ្ទង់) |
| ធុងសំរាម និងស្តារ | ប៊ូតុង (...) ➜ 🗑️ ធុងសំរាម |
| Export | ប៊ូតុង (...) ➜ Export |
| របាយការណ៍ប្រចាំខែ | ប៊ូតុង (...) ➜ 📈 របាយការណ៍អាជីវកម្មប្រចាំខែ |
| នាំចូល Excel ទៅ Sheet | ⚙️ របា Slide ➜ 📥 នាំចូល Excel ទៅ Sheet (សុំ PIN) |
| ទាញទិន្នន័យថ្មី | ទាញចុះ (Pull-to-Refresh) លើទូរស័ព្ទ |

**ច្បាប់អាជីវកម្មដែលត្រូវដឹង** — «**លុប**» លុបកញ្ចប់ទាំងមូល ហើយ **មិនប៉ះលុយ**;
«**ដក**» ដក barcode តែមួយ ហើយ **ដកលុយចេញភ្លាម** (បូកមកវិញពេលស្តារ)។

### ៤. Lookup API (ស្រេចចិត្ត)

បំពេញលេខទូរស័ព្ទ/COD/DOD ស្វ័យប្រវត្តិពេលស្កេន។ មានប្រភព ២ ៖

- **Google Sheet** តាម Apps Script — មើល [`zto-import/`](zto-import/README.md)
- **ZTO** តាម Netlify Function — មើល [`ZoeW/ZTO-SETUP-KH.md`](ZoeW/ZTO-SETUP-KH.md)

ពេល ZTO បដិសេធ Cookie ៖ រត់
[`tools/zto-cookie-sync-windows/`](tools/zto-cookie-sync-windows/README-KH.md)
លើ Windows ➜ Login ហើយបើក Argus។ បើឧបករណ៍នៅរង់ចាំ ទើបចូល
**Scan Management ➜ Arrival Scan** ➜ ស្កេន Waybill មួយ។
ឧបករណ៍រង់ចាំចម្លើយ API ជោគជ័យ រួចសរសេរ Cookie ចូល **Netlify Blobs**
ដោយ **មិនបាច់ redeploy**។

ការផ្ទៀងផ្ទាត់ថា Function ឃើញ Cookie ដូចគ្នា មិនប្រាប់អាយុសុពលភាពដែលនៅសល់ទេ។
ពិនិត្យស្ថានភាពក្នុង ZoeW ក្រោយ Lookup មួយ៖ **ទទួលយក**, **បដិសេធ** ឬ
**មិនទាន់ផ្ទៀងផ្ទាត់**។ Timeout ប្រាប់ថាសំណើយឺត; សូមសាកម្ដងទៀតពេលបណ្ដាញល្អ។

### ៥. ចេញ Activation Key (ZoeKeyGen)

មើល [`ZoeKeyGen/README.md`](ZoeKeyGen/README.md) — បង្កើត Key · Revoke ·
Extend · Setup Link/QR។

### ៦. ការធានាគុណភាព (សម្រាប់អ្នកថែទាំ)

```bash
npm ci --prefix ZoeW              # ម្តងក្នុងមួយ session (vite · acorn · playwright-core)
npm ci --prefix supabase          # អ្នកយាម Supabase (Postgres ពិត · supabase-js)
bash audit-tools/run-all.sh       # រត់ការត្រួតពិនិត្យទាំងអស់
```

មើល **[audit-tools/README.md](audit-tools/README.md)** សម្រាប់របៀបរត់ checker
មួយៗ ការរត់លើ tree ផ្សេង និងការដំឡើង Firebase emulator។

---

## ប្រព័ន្ធសុវត្ថិភាព

### ស្រទាប់ទី ១ — Activation Key

រាល់ការដំឡើង ZoeW ត្រូវការ Key ដែល **sign ដោយ ECDSA P-256**។ សោសាធារណៈ embed
ក្នុង `license-verify.js` ដូច្នេះ Key ក្លែងក្លាយបង្កើតមិនកើត។ ការផ្ទៀងផ្ទាត់
ធ្វើទាំង **ក្នុងឧបករណ៍** (signature + ថ្ងៃផុតកំណត់) និង **ខាង server**
(`revoked` និងពិដានសុពលភាព)។ គ្មានបណ្តាញ ➜ អនុគ្រោះ **៣ ថ្ងៃ**។
ការ **Activate** ត្រូវការអ៊ីនធឺណិត ហើយម៉ោងមិនអាចថយក្រោយបាន ➜ ការកែនាឡិកា
ទូរស័ព្ទមិន reset ការអនុគ្រោះ និងមិនធ្វើឲ្យ Key ដែលផុតកំណត់រស់ឡើងវិញទេ។

### ស្រទាប់ទី ២ — ការចូលប្រព័ន្ធ និង PIN

- ការចូលធ្វើតាម **Firebase Authentication**។ Session ផុតកំណត់ក្រោយ **៤ ម៉ោង**។
- **Security PIN** ការពារសកម្មភាពរសើប (Config · Lookup API · កែទឹកប្រាក់ ·
  Reset ស្ថិតិយក · លុបទាំងអស់ · Locker · Setup Link · នាំចូល Excel)។
  រក្សាទុកតែ hash **PBKDF2-SHA256 ១៥០,០០០ ជុំ** មិនមែន PIN ទេ។ វាយខុស ៥ ដង ➜
  ចាក់សោ ១ នាទី។
- **ក្រយៅដៃ ឬមុខ (WebAuthn)** ជាការ **ដោះសោ PIN** មិនមែនជំនួស PIN ទេ —
  ព្រោះ PIN ជាប្រភពនៃកូនសោ AES។ របៀប `prf` មិនរក្សាកូនសោលើឧបករណ៍សោះ។

### ស្រទាប់ទី ២ខ — ចាក់សោ App ពេលបើក និងពេលត្រឡប់មកវិញ

បើក App ក្នុងវគ្គថ្មី **ឬត្រឡប់ចូលវិញក្រោយចេញទៅ App ផ្សេង** ➜ អេក្រង់ចាក់សោ
គ្របពេញ ➜ វាយ PIN ឬស្កេនក្រយៅដៃ/មុខ។ ការគ្របកើតឡើង **ពេលចាកចេញ** ➜ រូបភាព
ក្នុង **task switcher** របស់ទូរស័ព្ទ មិនបង្ហាញលេខអតិថិជន។ ខណៈចាក់សោ របាខាងលើ ·
ទំព័រ · របា Tab · **ប្រអប់ដែលបើកនៅ** ត្រូវលាក់ពិត។

⛔ វា **មិនប៉ះ session ៤ ម៉ោង** ទេ ហើយការផ្ទុកទំព័រឡើងវិញ *ក្នុងវគ្គដដែល*
(PTR · ការស្តារ SDK) ព្រមទាំង **ការចាកចេញដោយចេតនាពីក្នុង App**
(📞 ខល · រើសឯកសារ · ស្កេនជីវមាត្រ · កាមេរ៉ា · Print) មិនសុំ PIN ម្តងទៀត។
មានផ្លូវចេញ «ភ្លេច PIN?» ដែលលុប PIN + ការចងជីវមាត្រ រួចចាកចេញពីប្រព័ន្ធ។

### ស្រទាប់ទី ៣ — ការអ៊ិនគ្រីបទិន្នន័យរសើប

Secret របស់ Lookup API និងការតភ្ជាប់នាំចូល Excel ត្រូវអ៊ិនគ្រីបដោយ
**AES-GCM 256** ជាមួយកូនសោដែល derive ពី PIN មុនចូល `localStorage`។
កូនសោនោះរស់តែក្នុងសតិ ហើយត្រូវលុបចោលពេលចាកចេញ។

### ស្រទាប់ទី ៤ — Firebase Rules

- Root **default-deny**; គ្រប់ node តម្រូវ `auth != null`។
- **Schema validation** — ប្រភេទវាល ជួរតម្លៃ និង `$other: false` ដែលបដិសេធ
  វាលចម្លែក។ នេះជាការការពារតែមួយប្រឆាំងទិន្នន័យខូច។
- **Claim/witness fence** លើការស្តារ និងការលុបទាំងអស់ ➜ ការ replay និង
  ការគិតលុយស្ទួនកើតមិនបាន។
- ⛔ Rules ក្នុង repo **មិន deploy ស្វ័យប្រវត្តិទេ** — paste ចូល Console ➜ Publish ឬ `tools/firebase-provision/deploy-rules.cmd`។
- **ហាង Supabase** ៖ rules ដដែលអនុវត្តក្នុង Postgres លើរាល់ការសរសេរ បូក Row Level Security តាមហាង ➜ ហាងមិនឃើញទិន្នន័យគ្នា ·
  ហាងផុតកំណត់/បិទ ➜ ចូលមិនបានភ្លាម (លម្អិត ៖ [`supabase/README.md`](supabase/README.md))។
- **ការចុះឈ្មោះសាធារណៈបិទ** លើ Project អាជីវកម្ម (Rules អនុញ្ញាតគ្រប់គណនីដែល Login) — `tools/firebase-provision/` បិទវា
  ហើយ **វាស់** វាដោយការសាកចុះឈ្មោះពិត។

### ស្រទាប់ទី ៥ — ការការពារខាង Browser

| ការការពារ | ស្ថានភាព |
|---|---|
| `script-src` គ្មាន `'unsafe-inline'` | ✅ ZoeW · ZoeKeyGen |
| គ្មាន `onclick=` ក្នុង HTML (ប្រើ `data-act` + បញ្ជីអនុញ្ញាត) | ✅ ទាំង ២ |
| គ្មាន `eval` · `new Function` · `document.write` · `outerHTML` | ✅ ទាំង ២ |
| រាល់ការបញ្ចូលចូល `innerHTML` ឆ្លង `sanitizeInput()` ឬជាលេខ | ✅ ទាំង ២ |
| `frame-ancestors 'none'` · `object-src 'none'` · `base-uri 'self'` | ✅ ទាំង ២ |
| HSTS · `X-Content-Type-Options` · `Referrer-Policy` | ✅ ទាំង ២ |
| Service Worker បោះបង់សំណើឆ្លង origin | ✅ ទាំង ២ |
| URL រសើប (Setup Link) មិនអាចជាប់ក្នុង Cache Storage | ✅ ZoeW |
| ការលាក់ secret មុនផ្ញើទៅ Sentry | ✅ ទាំង ២ |
| ការរកឃើញ DevTools ➜ បណ្តេញចេញ | ✅ ZoeKeyGen ប៉ុណ្ណោះ (វាកាន់កូនសោ signing) |

### ស្រទាប់ទី ៦ — Secret ខាង server

Cookie និង Token របស់ ZTO រស់នៅ **ខាង Netlify** ប៉ុណ្ណោះ (Netlify Blobs ឬ
env var) — មិនចូលកូដ static ឬ browser របស់អ្នកប្រើទេ។ Netlify Personal Access
Token របស់ Windows helper អ៊ិនគ្រីបដោយ **Windows DPAPI** លើម៉ាស៊ីនអ្នកប្រើ ➜
⛔ គ្មាន PAT ក្នុង Netlify env និងគ្មាន endpoint សរសេរ Cookie ពី internet។

### អ្វីដែលទទួលយកដោយចេតនា

ប្រព័ន្ធនេះ **គ្មាន backend ដែលទុកចិត្តបាន** (គ្មាន Cloud Functions) ដូច្នេះ ៖

- អ្នកប្រើដែលចូលបាន **អាចសរសេរតួលេខចំណូលដោយផ្ទាល់** — គ្មាន rule ណាអាច
  ផ្ទៀងផ្ទាត់ប្រវត្តិនៃ delta បានទេ។
- **គ្មានការផ្ទៀងផ្ទាត់ aggregate** ដោយហេតុផលដដែល។
- Firebase Config ក្នុង `localStorage` **មិនមែនជាសម្ងាត់ទេ** តាមការរចនា —
  អ្វីដែលការពារទិន្នន័យគឺ Rules មិនមែន Config។

---

## ឯកសារបន្ថែម

| ឯកសារ | ខ្លឹមសារ |
|---|---|
| [docs/HISTORY.md](docs/HISTORY.md) | **ប្រវត្តិកំណែ (ផ្នែក ១) និងប្រវត្តិកំហុស + ហេតុផលនៃច្បាប់នីមួយៗ (ផ្នែក ២)** — សម័យ ZoeW React |
| [docs/HISTORY-ARCHIVE.md](docs/HISTORY-ARCHIVE.md) | **បណ្ណសារប្រវត្តិសម័យ ZoeW vanilla** (អានបាន តែមិនបន្ថែម) |
| [CLAUDE.md](CLAUDE.md) | ច្បាប់ស្ថាបត្យកម្មសម្រាប់អ្នកថែទាំ |
| [audit-tools/](audit-tools/README.md) | របៀបរត់ checker និងតេស្ត |
| [ZoeW/ZTO-SETUP-KH.md](ZoeW/ZTO-SETUP-KH.md) | របៀបកំណត់ ZTO Lookup |
| [zto-import/](zto-import/README.md) | Apps Script ដែលទទួលការនាំចូល និងបម្រើ Lookup API |
| [tools/zto-cookie-sync-windows/](tools/zto-cookie-sync-windows/README-KH.md) | Windows helper សម្រាប់ប្តូរ Cookie ZTO |
| [tools/money-check-windows/](tools/money-check-windows/README-KH.md) | Windows ៖ រត់ការវាស់លុយ ៩ លើ dump ពិតរបស់អ្នក |
| [tools/firebase-provision/](tools/firebase-provision/README-KH.md) | Windows ៖ បង្កើតអតិថិជនថ្មីលើ Firebase ដោយពាក្យបញ្ជាតែមួយ · ដំឡើង Rules ទៅអតិថិជនទាំងអស់ |
| [firebase-backup/](firebase-backup/README.md) | CLI បម្រុងទុកទិន្នន័យ Firebase និងហាងនីមួយៗក្នុង Supabase |
| [tools/supabase-migrate/](tools/supabase-migrate/README.md) | CLI ផ្ទេរទិន្នន័យហាងពី Firebase ចូល Supabase · ស្តារហាង Supabase ពី backup |

---

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 **ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)**។

**Source code** ជាកម្មសិទ្ធិផ្តាច់មុខរបស់ម្ចាស់ ៖ គ្មានការអនុញ្ញាតឲ្យចម្លង
ចែកចាយ លក់បន្ត កែប្រែ build ឬ deploy ទេ។ repository សាធារណៈលើ GitHub ៖ មើល និង
fork លើ GitHub បានតាមលក្ខខណ្ឌ GitHub តែប៉ុណ្ណោះ — fork នៅតែស្ថិតក្រោម `LICENSE`។

**អាជ្ញាប័ណ្ណប្រើប្រាស់របស់អតិថិជន** ជារឿងដាច់ដោយឡែក ហើយគ្រប់គ្រងដោយ
**Activation Key** ៖ Key នីមួយៗ sign ដោយ ECDSA P-256 មានថ្ងៃផុតកំណត់ ហើយអាច
ត្រូវ **Revoke** ឬ **Extend** ពី ZoeKeyGen គ្រប់ពេល។ ការដក Key ចេញធ្វើឲ្យ App
ឈប់ដំណើរការក្នុងរយៈពេលយ៉ាងយូរ ១៥ នាទី (ឬពេលបិទបើក App)។ ⛔ ការកាន់ Activation
Key **មិនផ្តល់សិទ្ធិណាមួយលើ source code** ឡើយ។

⛔ **អត្ថបទអាជ្ញាប័ណ្ណពេញលេញជាឯកសារគ្រប់គ្រង** — សេចក្តីសង្ខេបខាងលើមិន
ជំនួសវាទេ ៖

| ឯកសារ | ខ្លឹមសារ |
|---|---|
| **[`LICENSE`](LICENSE)** | កម្មសិទ្ធិលើ source code · ការហាមឃាត់ · ការចូលរួមរបស់អ្នកអភិវឌ្ឍ · ច្បាប់គ្រប់គ្រង |
| **[`NOTICE`](NOTICE)** | attribution របស់កូដភាគីទីបី (Apache-2.0 · MIT · MPL-2.0 · PostgreSQL) · ពាណិជ្ជសញ្ញា |
