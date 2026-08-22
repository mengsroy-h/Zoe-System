# Google Sheet API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ (សម្រាប់ ZoeAdmin)

Google Sheet មួយ (៤ column: `Barcode`, `DOD($)`, `COD($)`, `Phone`) ដើរតួជា "database"
សម្រាប់ Apps Script មួយ ដែលបំលែង Sheet នោះទៅជា API — ភ្ជាប់ចូល ZoeAdmin តាមរយៈ Feature
ដែលមានស្រាប់ "🔌 API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ" (ម៉ឺនុយ "⋯" ➜ ⚙️ Config)។ ពេលវាយ/ស្កេន
Barcode ថ្មីក្នុង ZoeAdmin, វានឹងហៅ API នេះស្វ័យប្រវត្តិ ហើយបំពេញលេខទូរស័ព្ទ/COD/DOD ភ្លាមៗ
ប្រសិនបើរកឃើញ Barcode ត្រូវគ្នា។

## 1. រចនាសម្ព័ន្ធ Sheet

បង្កើត Google Sheet ថ្មី, ប្តូរឈ្មោះ Tab ដំបូងទៅជា `Customers`, columns តាមលំដាប់ខាងក្រោម
(**កុំប្តូរលំដាប់ column** — script អានតាមទីតាំង A/B/C/D):

| A (Barcode) | B (DOD($)) | C (COD($)) | D (Phone) |
|---|---|---|---|
| ABC123456 | 0 | 15.5 | 0912345678 |

មធ្យោបាយងាយបំផុត៖ នាំចូល `customer-template.csv` (ក្នុង folder នេះ) ចូល Sheet ថ្មី តាម
**File ➜ Import ➜ Upload ➜ Replace current sheet**។

### ការរៀបចំឱ្យស្អាត (Formatting)

1. **View ➜ Freeze ➜ 1 row** — ឲ្យ header ជាប់ពេល scroll
2. Bold + ដាក់ពណ៌ background លើ row ១ (header)
3. ជ្រើស column A (Barcode) ➜ **Format ➜ Number ➜ Plain text** — ការពារកុំឲ្យ `0` នាំមុខបាត់
   ឬក្លាយជា scientific notation បើ Barcode ជាលេខសុទ្ធ
4. ជ្រើស column D (Phone) ➜ **Format ➜ Number ➜ Plain text** — ការពារ `0` នាំមុខលេខទូរស័ព្ទ
5. ជ្រើស column B, C (DOD/COD) ➜ **Format ➜ Number ➜ Number** (2 decimal)
6. ការពារកុំឲ្យ Barcode ស្ទួន៖ ជ្រើស column A ➜ **Data ➜ Data validation ➜ Custom formula**:
   `=COUNTIF(A:A,A1)=1`
7. (ជម្រើស) **Data ➜ Protect sheets and ranges** ➜ ការពារ row ១ កុំឲ្យកែច្រឡំ

## 2. ដំឡើង Apps Script (បំលែង Sheet ➜ API)

1. បើក Sheet ➜ **Extensions ➜ Apps Script**
2. លុបកូដ default ចេញ ចម្លងកូដទាំងមូលពី `Code.gs` (ក្នុង folder នេះ) ដាក់ជំនួស
3. **Project Settings** (រូប ⚙️ខាងឆ្វេង) ➜ **Script Properties** ➜ Add script property:
   - Property: `API_KEY`
   - Value: លេខសម្ងាត់ណាមួយ ដែលអ្នកបង្កើតដោយខ្លួនឯង (ប្រវែងវែងៗ ចៃដន្យ)
   - ⚠️ **ជំហាននេះ​ចាំបាច់ មិនអាចរំលងបានទេ។** បើ `API_KEY` មិនត្រូវបានកំណត់ `Code.gs`
     នឹងបដិសេធរាល់សំណើ ហើយឆ្លើយថា `API_KEY script property is not set`។ (កូដចាស់ជំនាន់មុន
     **រំលងការត្រួតពិនិត្យទាំងស្រុង** ពេល `API_KEY` ទទេ — មានន័យថាអ្នកណាដែលដឹង URL អាចទាញ
     **បញ្ជីអតិថិជនទាំងមូល** តាម `?list=1`។ បើអ្នកបាន deploy ពីមុន សូម **ចម្លង `Code.gs`
     ជំនាន់ថ្មីទៅជំនួស រួច Deploy ម្តងទៀត** ហើយពិនិត្យថា `API_KEY` មានតម្លៃពិត។)
4. **Deploy ➜ New deployment ➜** ចុច ⚙️ ជ្រើស type **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. ចុច **Deploy**, អនុញ្ញាត (Authorize) គណនី Google, រួចចម្លង **Web app URL**
   (URL បញ្ចប់ដោយ `/exec`)

## 3. ភ្ជាប់ចូល ZoeAdmin

បើក ZoeAdmin ➜ ម៉ឺនុយ **"⋯"** ➜ **⚙️ "API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ"** ហើយបំពេញ (labels
ដូចគ្នាបេះបិទនឹង Modal ក្នុង App):

| Field ក្នុង Modal | តម្លៃត្រូវដាក់ |
|---|---|
| ✅ បើកការទាញយកទិន្នន័យស្វ័យប្រវត្តិពេលស្កេន | ធីក |
| ✅ រក្សាទុកភ្លាមៗពេលរកឃើញលេខទូរស័ព្ទ (មិនចាំចុច "យល់ព្រម") | ជម្រើស — ធីកបើចង់ឲ្យ ZoeAdmin រក្សាទុកកញ្ចប់ភ្លាមៗដោយស្វ័យប្រវត្តិ ភ្លាមពេល Sheet នេះឆ្លើយត្រឡប់លេខទូរស័ព្ទត្រូវគ្នា (មិនចាំបាច់ចុច "យល់ព្រម" ដោយដៃ); ទុកមិនធីក ប្រសិនបើចង់ត្រួតពិនិត្យទិន្នន័យមុននឹងរក្សាទុកជានិច្ច |
| URL API | `https://script.google.com/macros/s/XXXXXXXXXX/exec?code={barcode}&key=YOUR_API_KEY` |
| ឈ្មោះ Header | ទុកទទេ (មិនប្រើ — មើលចំណាំសុវត្ថិភាពខាងក្រោម) |
| តម្លៃ Header / API Key / Secret | ទុកទទេ (មិនប្រើ) |
| ឈ្មោះ Field លេខទូរស័ព្ទ | `phone` |
| ឈ្មោះ Field COD | `cod` |
| ឈ្មោះ Field DOD | `dod` |

ជំនួស `XXXXXXXXXX` ដោយ Web app URL ជាក់ស្តែងពី Deploy (step 2.5), និង `YOUR_API_KEY`
ដោយតម្លៃពិតដែលដាក់ក្នុង Script Properties (step 2.3)។ ចុច **"🧪 សាកល្បង"** ជាមួយ Barcode
ណាមួយពី Sheet ជាមុនសិន ដើម្បីប្រាកដថាបានលទ្ធផល JSON ត្រឹមត្រូវ (`{"found":true,"phone":...,
"cod":...,"dod":...}`) មុននឹងចុច **"រក្សាទុក"**។

⚠️ បើធីក **"រក្សាទុកភ្លាមៗ..."**៖ លេខ Locker នៅតែយកតម្លៃពី field ដដែល (ចម្លងពី Locker
ចុងក្រោយបំផុតដែលធ្លាប់វាយ ឬ "N/A" បើទទេ — Sheet មិនផ្តល់ Locker ទេ) ហើយកញ្ចប់នឹងរក្សាទុកភ្លាមៗ
ដោយគ្មានឱកាសពិនិត្យទិន្នន័យឡើយ ប្រសិនបើ Sheet មានទិន្នន័យខុស (ឧ. COD/DOD ខុស) វានឹងចូល
ប្រព័ន្ធភ្លាមៗ — ត្រូវប្រាកដថាទិន្នន័យក្នុង Sheet ត្រឹមត្រូវជានិច្ចមុននឹងបើកជម្រើសនេះ។

## ចំណាំសុវត្ថិភាព

- Apps Script Web App (`doGet`) មិនអាចអាន HTTP Header ផ្ទាល់បានទេ (Google restriction) —
  ដូច្នេះ field "ឈ្មោះ Header / តម្លៃ Header" ក្នុង Modal ត្រូវទុកទទេ ហើយដាក់លេខសម្ងាត់ជា
  `key=...` ផ្ទាល់ក្នុង URL តាមខាងលើវិញ
- លេខសម្ងាត់ក្នុង URL នេះនឹងរក្សាទុកជា Text ធម្មតា (មិន Encrypt ដូច Header field) នៅក្នុង
  localStorage ឧបករណ៍ — កុំប្រើលេខសម្ងាត់ដដែលពីកន្លែងផ្សេង
- **Who has access: Anyone** មានន័យថា នរណាម្នាក់ដែលដឹង URL នេះអាចហៅបានដោយផ្ទាល់ (URL
  ដើរតួដូច token) — កុំចែក URL នេះជាសាធារណៈ, `key=` ជាការការពារបន្ថែមមួយស្រទាប់ប៉ុណ្ណោះ
- `Code.gs` **fail closed**៖ គ្មាន `API_KEY` ➜ បដិសេធទាំងអស់។ ដូច្នេះការភ្លេចជំហាន 2.3
  ក្លាយជាកំហុសដែលមើលឃើញភ្លាម មិនមែនជារន្ធស្ងាត់ដែលបើកបញ្ជីអតិថិជនជាសាធារណៈទេ
- Sheet មិនមែនជា production database ដែលមាន access rules ដូច Firebase Rules ទេ — វាផ្ទុកតែ
  ទិន្នន័យ Lookup (Barcode/COD/DOD/Phone) មិនមែនកំណត់ត្រាអាជីវកម្មពិតទេ, ហើយវាមិនអាចសរសេរ
  ចូល Firebase បានឡើយ។ ប្រសិនបើចង់សុវត្ថិភាពខ្ពស់ជាងនេះ គួរផ្លាស់ទៅប្រើ Backend ផ្ទាល់ខ្លួន
  (ឧ. Cloud Function) ជំនួស Apps Script

## ដែនកំណត់ (Limitations)

- Apps Script quota ប្រហែល ២០-៣០ requests/វិនាទី/អ្នកប្រើ — គ្រប់គ្រាន់សម្រាប់ការស្កេនធម្មតា
- Script cache ទិន្នន័យ Sheet ទុក **៥នាទី** (`CACHE_TTL_SECONDS` នៅដើម `Code.gs`, តម្លៃ `300`) —
  កាត់បន្ថយចំនួនដងអាន Sheet ដើម្បីលឿនជាងមុន ជាពិសេសពេល Barcode ដដែលត្រូវបានស្កេនម្តងទៀត
  (retry/test) ក្នុងរយៈពេលនោះ។ ភាព Trade-off៖ បើទើបតែកែទិន្នន័យក្នុង Sheet (បន្ថែម/ប្តូរ
  COD/DOD/Phone), ការផ្លាស់ប្តូរអាចយឺតដល់ ៥នាទីទើបលទ្ធផល API ឆ្លុះបញ្ចាំង — ចង់ឲ្យលទ្ធផល
  ថ្មីលឿនជាងនេះ អាចបន្ថយ `CACHE_TTL_SECONDS` ចុះ (ឧ. `60`), ចង់ឲ្យលឿនជាងទៀត (Barcode ថ្មីៗ)
  អាចបង្កើនឡើង (ឧ. `1800`) ដោយមិនប៉ះពាល់អ្វី លើកលែងតែភាព "ថ្មី" នៃទិន្នន័យ។ ចំណាំ៖ Cache នេះ
  ជួយតែពេល Barcode ត្រូវបានស្កេនច្រើនដងក្នុងបង្អួច Cache ដដែល — Barcode ថ្មីនីមួយៗនៅតែត្រូវហៅ
  Apps Script ថ្មីជានិច្ច (Apps Script Web App មាន execution overhead ផ្ទាល់ខ្លួន ~០.៥-២វិនាទី
  ក្នុងមួយ Request ដែលជាដែនកំណត់ពី Google ខ្លួនឯង មិនអាចកែបានតាមរយៈ Code)
- បើ Sheet មានទិន្នន័យច្រើនណាស់ (រាប់ម៉ឺន row), ការស្វែងរកបែប scan ត្រង់ៗនេះអាចយឺត —
  អាចកែជា index-based lookup នាពេលក្រោយប្រសិនបើត្រូវការ
- ចង់បានល្បឿនលឿនជាងនេះទៀត (Barcode ថ្មីៗគ្រប់ដង, មិនត្រឹមតែពេលស្កេនម្តងទៀត) ត្រូវការប្តូរ
  ស្ថាបត្យកម្ម (ឧ. ZoeAdmin ទាញយកទិន្នន័យ Sheet ទាំងអស់ម្តងទុកជាមុន ស្វែងរកក្នុងម៉ាស៊ីនផ្ទាល់)
  ដែលទាមទារកែ `ZoeAdmin/app.js` និងបើក Sheet ជា "Anyone with link can view" ផងដែរ — មិនទាន់
  ធ្វើនៅឡើយ ព្រោះជម្រើសនេះបង្ហាញទិន្នន័យអតិថិជនទាំងអស់វិញម្តង មិនមែនម្តងមួយជួរដូច Apps Script
  បច្ចុប្បន្នទេ

## 4. តារាងទិន្នន័យអតិថិជន (Customer Data Table) — ស្វែងរកលឿននៅក្នុង ZoeAdmin

`doGet` ក៏ទទួល `list=1` ជំនួស `code=...` (URL: `...?list=1&key=YOUR_API_KEY`) ដែលឆ្លើយត្រឡប់
ជួរដេកទាំងអស់ក្នុង Sheet ជា `{"rows":[{"barcode":...,"dod":...,"cod":...,"phone":...}, ...]}`
ជំនួសមួយជួរដេកតែម្តង។ ZoeAdmin ប្រើ Endpoint នេះសម្រាប់ Feature **"📊 តារាងអតិថិជន"** (ម៉ឺនុយ
"⋯") — ទាញយកជួរដេកទាំងអស់ម្តងម្កាល (គោរព Cache ៥នាទីដដែល), រួចស្វែងរក/ត្រង Barcode/COD/DOD/Phone
ដោយផ្ទាល់ក្នុងឧបករណ៍ (មិនហៅ API ម្តងទៀតរាល់ពេលវាយអក្សរនោះទេ — លឿនជាង Google Sheet/AppSheet/
Retool ព្រោះមិនចាំបាច់រង់ចាំ Network ក្នុងការស្វែងរកម្តងៗ)។ Config URL ដដែលនឹងប្រើទាំង Lookup
ម្តងមួយ (ពេលស្កេន) និង List ទាំងអស់ (តារាងនេះ) — ZoeAdmin ស្រង់ `list=1` ចេញពី URL Config
ដែលមានស្រាប់ដោយស្វ័យប្រវត្តិ មិនចាំបាច់កំណត់ URL ដាច់ដោយឡែកទេ។ តារាងនេះជា **Read-only** — មិន
អាចកែ/បន្ថែម/លុប ជួរដេកតាមរយៈ ZoeAdmin បានទេ (កែផ្ទាល់ក្នុង Google Sheet វិញ)។
