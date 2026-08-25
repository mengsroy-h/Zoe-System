# ZoeImport — PWA នាំចូល Excel ចូល Google Sheet

PWA ដាច់ដោយឡែក (ដំឡើងលើទូរស័ព្ទបានដូច ZoeW និង ZoeKeyGen) សម្រាប់នាំចូលឯកសារ
Excel ដែល export ចេញពី website ZTO ចូលទៅ Google Sheet `Customers` — ជំនួសការ
copy-paste ដោយដៃ។

> **វាមិនប៉ះ ZoeW ឬ ZoeKeyGen ឡើយ។** វាជា site ដាច់ដោយឡែក ដែលនិយាយតែជាមួយ
> Apps Script ក្នុង [`../zto-import/`](../zto-import/README.md) ប៉ុណ្ណោះ។
> វាមិនចេះនិយាយជាមួយ Firebase ទេ។

## របៀបដែលវាដំណើរការ

```
ទូរស័ព្ទ/PC ──► ZoeImport (PWA, Netlify) ──HTTPS POST──► Apps Script ──► Google Sheet
                     │                                                        │
              អាន Excel ក្នុងឧបករណ៍                                    ZoeW អានតាម
              (SheetJS ក្នុង repo)                                     Lookup API ដដែល
```

ការអានឯកសារ Excel ធ្វើឡើង **ក្នុងឧបករណ៍របស់អ្នក** — មានតែជួរដេក ៤ column
(Barcode/DOD/COD/Phone) ទេដែលផ្ញើទៅបណ្តាញ។

## សុវត្ថិភាព

ការការពារធ្វើតាមលំនាំដដែលនឹង ZoeW៖

| អ្វី | របៀបការពារ |
|---|---|
| **PIN** | PBKDF2-SHA256 **១៥០,០០០ ជុំ** (salt `zoeimport_pin_verify_v1`) ➜ រក្សាទុកតែ hash មិនមែន PIN ទេ |
| **URL និងពាក្យសម្ងាត់ Apps Script** | អ៊ិនគ្រីប **AES-GCM 256** ដោយកូនសោដែល derive ពី PIN (salt `zoeimport_config_secret_v1`) មុនចូល localStorage |
| **វាយ PIN ខុស** | ៥ ដង ➜ ចាក់សោ ១ នាទី (ដូច ZoeW) |
| **ចាក់សោ (🔒)** | លុបកូនសោក្នុងសតិ, URL, ពាក្យសម្ងាត់, preview និងវាល form ចេញពី DOM |
| **URL គោលដៅ** | ទទួលតែ `https://script.google.com/macros/s/…/exec` ➜ ពាក្យសម្ងាត់មិនអាចផ្ញើទៅ host ផ្សេងបានទេ |
| **CSP** | `default-src 'self'`; `connect-src` អនុញ្ញាតតែ Google Apps Script; គ្មាន CDN, គ្មាន `unsafe-inline` លើ script |

**បើភ្លេច PIN** ➜ ស្រាយការតភ្ជាប់មិនបាន ➜ ត្រូវចុច «ភ្លេច PIN» រួចកំណត់
URL និងពាក្យសម្ងាត់ឡើងវិញ។ ទិន្នន័យក្នុង Google Sheet មិនរងផលទេ។

> ⚠️ PIN ការពារ **ការតភ្ជាប់នៅលើឧបករណ៍នេះ** — វាមិនមែនជាការផ្ទៀងផ្ទាត់
> ខាង server ទេ។ ការការពារពិតខាង Apps Script គឺ `IMPORT_PASSWORD`។

## ជំហានរៀបចំ

### ១. រៀបចំ Apps Script ជាមុនសិន

ធ្វើតាម [`../zto-import/README.md`](../zto-import/README.md) ជំហានទី ១–៣។
ចុងបញ្ចប់អ្នកនឹងមាន **Web app URL** (`…/exec`) និង **`IMPORT_PASSWORD`**។

### ២. Deploy ថតនេះជា Netlify site ដាច់ដោយឡែក

Netlify ➜ **Add new site** ➜ ភ្ជាប់ repo នេះ ➜ **Base directory: `ZoeImport`**។
គ្មាន build command ទេ (static site); `netlify.toml` ក្នុងថតនេះកំណត់ header
និង CSP រួចជាស្រេច។

### ៣. បើក និងកំណត់

1. បើក URL របស់ site ➜ **កំណត់ PIN** (យ៉ាងតិច ៤ ខ្ទង់)
2. បំពេញ **Web app URL** និង **ពាក្យសម្ងាត់នាំចូល** ➜ ចុច «សាកល្បង និងរក្សាទុក»
   (វាសាកសំណើពិតមួយមុនរក្សាទុក)
3. **ដំឡើងជា App**៖ iPhone ➜ Share ➜ *Add to Home Screen*;
   Android/Chrome ➜ ម៉ឺនុយ ➜ *Install app*

## ការប្រើប្រចាំថ្ងៃ

1. បើក App ➜ វាយ PIN
2. ទម្លាក់ឯកសារ Excel របស់ ZTO
3. ពិនិត្យ preview ➜ ចុច **នាំចូលទៅ Sheet**

**របៀបលំនាំដើមគឺ «សម្អាតទិន្នន័យចាស់ រួចដាក់ថ្មីជំនួស»** ព្រោះទិន្នន័យបញ្ចូល
រាល់ថ្ងៃ។ វាសួរបញ្ជាក់មុនជានិច្ច។ របៀបផ្សេងទៀត៖

| របៀប | ធ្វើអ្វី |
|---|---|
| សម្អាតរួចដាក់ថ្មីជំនួស | លុបជួរដេកទាំងអស់ រួចដាក់តែអ្វីក្នុងឯកសារ |
| បន្ថែមថ្មី + កែអ្វីដែលប្រែ | Barcode ថ្មី ➜ បន្ថែម; មានស្រាប់ ➜ កែតែពេលតម្លៃប្រែ |
| បន្ថែមតែ Barcode ថ្មី | មិនប៉ះជួរដេកចាស់ណាមួយឡើយ |

មានប៊ូតុង **🗑️ សម្អាតទិន្នន័យក្នុង Sheet** ដាច់ដោយឡែកផងដែរ សម្រាប់ពេលចង់
លុបទិន្នន័យចាស់ចោល ដោយមិនទាន់នាំចូលឯកសារភ្លាម។

## ការដើរពេលក្រៅបណ្តាញ

សំបក App (HTML/CSS/JS និង SheetJS) ត្រូវ cache ទុក ដូច្នេះ **App បើកបានក្រៅបណ្តាញ**
ហើយអានឯកសារ Excel បានដែរ។ តែ **ការនាំចូលពិតត្រូវការបណ្តាញ** ព្រោះវាត្រូវសរសេរ
ចូល Google Sheet។

SheetJS ស្ថិត **ក្នុង repo** (`vendor/xlsx.full.min.js`) មិនមែនមកពី CDN ទេ —
តាមច្បាប់គម្រោងដដែលដែលនាំ ZXing ចូល repo៖ ធនធានចាំបាច់ដែលមកពី origin ខាងក្រៅ
មិនចូល cache របស់ Service Worker ➜ មុខងារស្លាប់ស្ងាត់ៗពេលបណ្តាញខ្សោយ។

> ✅ **ដំណើរការលើផលិតកម្មពិតរួចហើយ** (2026-08-25) — អ្នកប្រើបានរៀបចំ Apps Script
> និង ZoeImport រួច រាយការណ៍ថាការនាំចូលដើរ។ ដូច្នេះផ្លូវ **cross-origin POST
> ជាមួយ `Content-Type: text/plain` មិនមែនជាកូដដែលមិនទាន់សាកទេ**។
>
> **ច្បាប់ដែលត្រូវរក្សា៖** កុំប្តូរ `Content-Type` ចេញពី `text/plain` ហើយ
> **កុំបន្ថែម header ផ្ទាល់ខ្លួន** (`Authorization`, `X-…`) លើសំណើនោះ។ ទាំង ២
> ធ្វើឲ្យវាលែងជា *simple request* ➜ browser បញ្ជូន preflight `OPTIONS` ➜
> Apps Script មិនឆ្លើយ `OPTIONS` ➜ **ការនាំចូលស្លាប់ទាំងស្រុងលើផលិតកម្ម ខណៈ
> តេស្តក្នុង repo (ដែលប្រើ fetch stub) ជោគជ័យទាំងអស់** — ជាថ្នាក់កំហុសដដែល
> នឹង CSP `'wasm-unsafe-eval'` ក្នុងកំណែ 2.10.0។
>
> មិនទាន់មានរបាយការណ៍ដាច់ដោយឡែកសម្រាប់៖ Drive folder watcher (`Watch.gs`)
> និងការដំឡើងជា App លើទូរស័ព្ទ។ បើវាមានបញ្ហា ទំព័រ Web ដែល Apps Script
> បម្រើខ្លួនឯង (`zto-import/Index.html`) ជាផ្លូវបម្រុងដែលគ្មាន CORS ទាល់តែសោះ។

## ការធ្វើតេស្ត

```bash
npm i playwright-core xlsx
node ZoeImport/test.js
```

តេស្តនេះបើក **Chromium ពិត** ហើយដើរលំហូរទាំងមូល៖ ការកំណត់ PIN, ការបដិសេធ
PIN ខ្លី/មិនត្រូវគ្នា, ការចាក់សោក្រោយវាយខុស ៥ ដង, ការបដិសេធ URL ក្រៅ
`script.google.com`, ការអ៊ិនគ្រីប config, ការអាន Excel ដែលមាន **header ខ្មែរពិត
របស់ ZTO**, ការរាប់ជួរដេករំលង/ស្ទួន, ការសួរបញ្ជាក់មុន replace, ការនាំចូល,
ការសម្អាត និងការលុប secret ចេញពី DOM ពេលចាក់សោ។

បច្ចុប្បន្ន **៥៥ assertions**។ ផ្ទៀងផ្ទាត់ដោយ **mutation ១០ ករណី — ចាប់បាន ១០/១០**
(ដាក់ secret ជាអក្សរធម្មតា, ដក lockout, ទទួល URL ណាក៏បាន, ទទួល PIN ខុស,
រំលងការសួរបញ្ជាក់ ។ល។)។

## ការឡើងកំណែ

`APP_VERSION` ក្នុង `app.js` ត្រូវស៊ីនឹង `version` ក្នុង `manifest.json`។
រាល់ពេលឯកសារ static ណាមួយប្រែ ត្រូវ bump `CACHE_VERSION` ក្នុង `sw.js`
(`zoeimport-vN`)។ កំណែរបស់ App នេះ **ដាច់ដោយឡែកពី `APP_VERSION` របស់
ZoeW/ZoeKeyGen** — `audit-tools/version-check.js` ពិនិត្យតែ App ទាំង ២ នោះ។

**`sw.js` ឆ្លើយតបសំបកដែល cache ទុករួច ភ្លាម** (`zoeimport-v2`) ជំនួសការប្រណាំង
នឹងបណ្តាញ ៣ វិនាទីក្នុងមួយសំណើ ➜ App បើកភ្លាមទោះបណ្តាញខ្សោយ ហើយការធ្វើឲ្យ
ស្រស់ធ្វើខាងក្រោយ (រំលងពេលក្រៅបណ្តាញ)។ `SHELL_PATHS` កំណត់ថា **មានតែឯកសារ
របស់សំបកទេ** ដែលអាចចូល Cache Storage បាន។ ចាក់សោដោយ
`audit-tools/sw-shell-latency-test.js` (ផ្នែកស្តាទិចគ្រប់ទាំង ៣ App)។
