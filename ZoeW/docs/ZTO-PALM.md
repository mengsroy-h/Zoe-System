# Login ZTO Palm — ZoeW

នៅក្នុង ZoeW បើកការកំណត់ **API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ** ដោយ PIN រួចបើក
**Login ZTO Palm**។ បញ្ចូលគណនី និងពាក្យសម្ងាត់ Palm រួចចុច **Login និងបើក Lookup**។
ពេលស្កេន Barcode, ZoeW បំពេញលេខទូរស័ព្ទ និង COD/DOD ទៅផ្ទាំងស្កេនដែលមានស្រាប់។
ការរក្សាទុកភ្លាមៗនៅតែអាស្រ័យលើជម្រើស auto-submit របស់អ្នក។

## Sign ទៅ ZTO

ពេល API ប្រើ Palm Login ប៊ូតុងកញ្ចប់បើកក្នុងប្រវត្តិ និងបញ្ជី Barcode បង្ហាញ **✍️ Sign**។
ប្រើបានទាំង Login លើទូរស័ព្ទ និង Login របស់សាខាលើ Server។ ប្តូរទៅ Cookie ពី Blob វិញ ប៊ូតុង **បិទ** ត្រឡប់មកវិញ។

1. ចុច **Sign**។ ZoeW ពិនិត្យ tracking ពិតរបស់ Barcode នៅ ZTO ជាមុន។
2. **ការស្កេនពេលចែកចាយទំនិញ**៖ ដាក់ Barcode មុខកាមេរ៉ា។ ZoeW ចាប់រូបពី frame ដែលស្កេនបាន ដោយស្វ័យប្រវត្តិ។ ចុច **⬆ ផ្ញើបញ្ជី** រួច **បន្ទាប់**។
3. **ការស្កេនពេលទទួលទំនិញ**៖ វាយឈ្មោះអតិថិជនជាមុន រួចស្កេន Barcode ម្ដងទៀត ដើម្បីចាប់រូបថ្មី។ ចុច **⬆ ផ្ញើបញ្ជី**។
4. ZTO បញ្ជាក់ជោគជ័យ ទើប ZoeW បិទកញ្ចប់ និងកត់ចំនួនយករួច/ចំណូលតាមផ្លូវបិទកញ្ចប់ដែលមានស្រាប់។ ក្រោយកញ្ចប់ទាំងអស់ក្នុងផ្ទាំង Sign រក្សាទុកជោគជ័យ ផ្ទាំងបិទស្វ័យប្រវត្តិ និងបង្ហាញចំនួនកញ្ចប់ជោគជ័យ។

លេខទូរស័ព្ទមួយអាចមានកញ្ចប់ច្រើន៖ ស្កេន/ជ្រើសរូបតាម Barcode នីមួយៗ និងផ្ញើបញ្ជី។ កញ្ចប់នៅបរាជ័យ មិនទាន់បញ្ជាក់ ឬ ZoeW រក្សាទុកមិនទាន់បាន ទុកផ្ទាំងបើកសម្រាប់បន្ត/ពិនិត្យ។

បើ tracking បញ្ជាក់ថាកញ្ចប់បានចែកចាយរួចនៅសាខាដដែល ហើយគ្មានការមកដល់ថ្មី ឬការត្រឡប់ក្រោយវា ZoeW រំលងជំហានទី១ទៅទទួលភ្លាម។
កញ្ចប់ច្រើនមានចែកចាយរួចខ្លះ ➜ ផ្ញើបញ្ជីចែកចាយតែកញ្ចប់ដែលនៅសល់។ Tracking មិនច្បាស់ ឬបណ្ដាញធ្លាក់ ➜ ចុច **ពិនិត្យស្ថានភាព ZTO ម្ដងទៀត**។

ម៉ាស៊ីនស្កេន USB/Bluetooth ដែលបញ្ចប់ដោយ Enter/Tab អាចប្រើក្នុងផ្ទាំងនេះ ពេលកាមេរ៉ាបើកសម្រាប់ចាប់រូប។
បើកាមេរ៉ាមិនបើក សូមអនុញ្ញាត permission ឬប្រើ **📷 ថតរូបកញ្ចប់** / **🖼 ជ្រើសរូបពី Gallery**។ រូបភាពមាន Barcode អាចអានពីរូបបាន; បើអានមិនបាន វាយ Barcode ជាមុន រួចជ្រើសរូបម្ដងទៀត។
រូបជ្រើសដោយដៃអាចជំនួសរូបដែលកាមេរ៉ាចាប់ស្វ័យប្រវត្តិសម្រាប់ Barcode នោះ មុនផ្ញើ។ ពេលរង់ចាំបញ្ជាក់ ឬមិនទាន់ដឹងលទ្ធផល upload មិនអាចជំនួសរូបបាន។

ផ្លូវ APK នេះប្រើ `newBusinessCheck` ហើយ `saveScanInfo` ដោយ `scanTypeCode: "04"` សម្រាប់ចែកចាយ និង `"05"` សម្រាប់ទទួល។
ចែកចាយប្រើគណនី Palm ដែល Login ជាអ្នកចែកចាយ។ APK ចាប់ frame កាមេរ៉ាសម្រាប់ស្កេនចែកចាយ ប៉ុន្តែមិនភ្ជាប់ bitmap ក្នុង record ចែកចាយទេ ➜ ZoeW ផ្ញើតែ Barcode ពេលចែកចាយ ហើយរូបនៅលើទូរស័ព្ទជាភស្តុតាងស្កេន។
រូបទទួលផ្ញើតាម `saveBillPic` (`fileName` Base64 JPEG · `picType: 1`)។ មុនទទួល អានកញ្ចប់តាម `queryPreOrderByBillCode` និងកត់ `sign/log/v1/add`; ក្រោយទទួលលុប log តាម `deleteByBillCode` ដូច APK។

បើបាត់ចម្លើយក្រោយផ្ញើ កុំផ្ញើស្ទួន។ ក្នុងជំហានទទួល ចុច **ពិនិត្យ ZTO** ដើម្បីអានស្ថានភាព ហើយសាកការបិទក្នុង ZoeW ដែលនៅរង់ចាំ ដោយមិន Sign ស្ទួន។
សម្រាប់ចែកចាយដែលមិនទាន់បញ្ជាក់ សូមបិទផ្ទាំង រួចបើក Sign ម្ដងទៀតឲ្យវាពិនិត្យ tracking មុនបន្ត។
Login Palm ប្តូរក្រោយចែកចាយ (Login ឡើងវិញ ឬបន្តស្វ័យប្រវត្តិ) ➜ ZoeW ពិនិត្យ ZTO ឡើងវិញភ្លាម ហើយរក្សារូប និងឈ្មោះ ➜ ចុច **⬆ ផ្ញើបញ្ជី** ម្ដងទៀត។
ប៉ះផ្ទៃខាងក្រៅផ្ទាំង Sign មិនបិទផ្ទាំងទេ ➜ ចុច **បិទ** ឬ Back ពេលចង់ចេញ។
ការប្តូរគណនី ហាង ឬ API ខណៈកំពុងផ្ញើ មិនអនុវត្តចម្លើយចាស់ក្នុង ZoeW។

## 🧪 ពិនិត្យ field របស់ Palm

ចុច **🧪 សាកល្បង** ក្នុងការកំណត់ API រួចបញ្ចូល Barcode។ របៀប Palm អាន
`billInfoQuery` និង `queryTrackInfo` (`mailType: 1` · `mailNos: barcode`) ដោយ session ដែលបាន Login។
ចម្លើយដើមពេញលេញនៅក្នុង `billInfoQuery` និង `queryTrackInfo` បង្ហាញក្នុងប្រអប់ JSON ដែលអាចអូសមើល
និងចម្លងបាន។ វាលដើមនៅដដែល ទោះ mapping COD/DOD ដែលកំណត់សម្រាប់ Cookie មិនស្គាល់វាក៏ដោយ។
ប្រើចម្លើយនេះដើម្បីផ្ទៀងផ្ទាត់ឈ្មោះ field និងស្ថានភាពរបស់ Palm។ Palm អាន `cod` និង `dod` ផ្ទាល់;
`ZTO_FIELD_COD` និង `ZTO_FIELD_DOD` សម្រាប់ Cookie មិនជំនួសតម្លៃ Palm ទេ។ ការស្កេនធម្មតាអាន `billInfoQuery` តែមួយ។
ការសាកល្បងអនុវត្តការផ្ទៀងគណនី និងសាខាដូច Lookup។

## ធៀប field Cookie និង Palm

| ទិន្នន័យ | Cookie `/scan/get/order/detail` | Palm `billInfoQuery` |
|---|---|---|
| លេខទូរស័ព្ទ | `data.consigneePhone` ឬ `data.consigneeMobile` | `result.consigneeMobile` |
| COD | `data.agentAmount` | `result.cod` |
| DOD | `data.fcAmount` | `result.dod` |
| សាខាចែក | `data.dispSiteId` | `result.dispSiteId` |
| ស្ថានភាព | `data.billStatus` | មិនមានក្នុងចម្លើយ Lookup; ផ្ទៀង track ឬបញ្ជីចុះហត្ថលេខា |

Cookie ទាញបញ្ជីមកដល់តាម `/scan/page/scan` និង `ZTO_LIST_SCAN_TYPE=03`។ ក្នុង APK Palm,
`ScanType.ARRIVE_SCAN` = `3` និង `SIGN_SCAN` = `5`; ត្រូវផ្ទៀង `queryTrackInfo.result[].tracks[]`
ជាមួយកូដស្កេន សាខា និងម៉ោងពិត មុនប្រើជាភស្តុតាង។ `queryDispatchList` `billStatus=4`
និង `dispEmpDate` ជាការចាត់ចែក មិនអាចជំនួសស្កេនមកដល់បាន។ ផ្ទាំងប្រវត្តិស្កេនក្នុង App Palm
(`ScanQueryDetailPresenter.queryScanRecord`) អានពី `UploadPoolTable` របស់ឧបករណ៍;
វាមិនផ្តល់ endpoint បញ្ជីស្កេនមកដល់ទាំងសាខាសម្រាប់ ZoeW ទេ។

## កំណត់ server មុនប្រើ

Deploy source នេះទៅ Netlify site របស់ ZoeW រួមទាំង `netlify/functions/`។ ដាក់ env
ទាំងនេះក្នុង **Functions / Production** រួច redeploy។ សម្រាប់សាកល្បង PR Preview,
កំណត់ env ដូចគ្នាក្នុង context **Deploy Previews / Functions** រួច redeploy preview៖

| Env | តម្លៃ |
|---|---|
| `ZTO_PROXY_KEY` ឬ `ZTO_PROXY_KEYS` | សោភ្ជាប់ ZoeW ដែលមានស្រាប់; App ប្រើ header `X-Zoe-Proxy-Key` |
| `ZTO_PALM_SESSION_SECRET` | តម្លៃចៃដន្យសម្រាប់អ៊ិនគ្រីប session របស់ Palm, យ៉ាងតិច 32 តួអក្សរ |
| `ZTO_PALM_SIGN_KEY` | សោចុះហត្ថលេខា `x-sign` របស់ protocol ZTO Palm (តម្លៃពី APK ZTO Palm) |
| `ZTO_PALM_PASSWORD_KEY` | សោ AES របស់ protocol ZTO Palm សម្រាប់ password និងលេខទូរស័ព្ទ — ត្រូវមាន 16 UTF-8 bytes |

⛔ សោ protocol ទាំងពីររស់តែក្នុង Netlify env ប៉ុណ្ណោះ — Repo ត្រូវចាត់ទុកជាសាធារណៈ ដូច្នេះកុំដាក់តម្លៃទាំងនេះក្នុងកូដ ឯកសារ ឬ commit។
ខ្វះ env ណាមួយ ➜ Login និង Lookup Palm ឆ្លើយ `ZTO_PALM_NOT_CONFIGURED` ហើយ App · 🩺 បង្ហាញឈ្មោះអ្វីដែលខ្វះ
(`palm:session-secret` · `palm:sign-key` · `palm:password-key`) ដោយមិនផ្ញើអ្វីទៅ ZTO ទេ។

បង្កើត session secret ថ្មីលើកុំព្យូទ័ររបស់អ្នកដោយ៖

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

កុំដាក់ secret នេះក្នុង `VITE_*`, URL, source control ឬ frontend។ ប្តូរ secret នេះ
នឹងធ្វើឱ្យ session Palm ដែលមានស្រាប់ត្រូវ login ម្តងទៀត។ `ZTO_PROXY_KEYS`
(សោតាមហាង) ក៏គាំទ្រដែរ; session នីមួយៗចងជាមួយ proxy key ដែលបាន login។

ផ្លូវ Palm អនុវត្តការកំណត់ដូច `/detail` របស់ Argus៖

- `ZTO_DETAIL_IDENTITY=require` ➜ Login និង Lookup Palm ត្រូវការគណនី ZoeW ដែលកំពុងចូល (`X-Zoe-Id-Token`) មុនពេលផ្ញើទៅ ZTO;
  `optional` ➜ ផ្ទៀងពេលមាន token តែមិនបដិសេធ។
- `ZTO_DETAIL_BRANCH_PATHS` ➜ កញ្ចប់ពីសាខាផ្សេង ឬគ្មានវាលសាខា ➜ `ZTO_OTHER_BRANCH` គ្មានលេខទូរស័ព្ទ ឬ COD/DOD។
- COD/DOD Palm អានពី `cod` និង `dod` ផ្ទាល់ រួមទាំងតម្លៃសូន្យ; `ZTO_FIELD_COD` និង `ZTO_FIELD_DOD` អនុវត្តលើ Cookie។
- `ZTO_UPSTREAM_TIMEOUT_MS` · `ZTO_REQUEST_BUDGET_MS` កំណត់ពេលរង់ចាំ ZTO។
- Config Argus ខុស (`ZTO_CONFIG_INVALID`) បិទផ្លូវ Palm ផងដែរ ព្រោះវាប្រើការកំណត់ទាំងនេះរួមគ្នា។

ប្រសិនបើមិនទាន់មាន proxy key ក្នុងការកំណត់ Lookup, បញ្ចូលវាក្នុងប្រអប់
**តម្លៃ Header / API Key / Secret** រួចចុច Login Palm (ឬ «ប្រើ Login Palm របស់ហាង» ពេលហាង Login រួច)។ ជោគជ័យនឹងរៀបចំ
URL, header និង field mapping ដោយស្វ័យប្រវត្តិ។

សម្រាប់ Android, build ជាមួយ `VITE_NATIVE_WEB_ORIGIN=https://your-site.netlify.app`
ដូចការកំណត់ native ដែលមានស្រាប់។ Browser web និង APK ផ្ញើ password ទៅតែ Function
របស់ ZoeW ផ្ទាល់។

## Session និងទិន្នន័យ (Login ម្តង ➜ ប្រើគ្រប់ទូរស័ព្ទក្នុងហាង)

- Login ជោគជ័យ ➜ Function ទុក **session Palm របស់សាខា** ក្នុង Netlify Blobs (store `zto-auth` ដដែលនឹង Cookie · key `palm-session/<label>/<សាខា>` ·
  `<label>` = ឈ្មោះសោភ្ជាប់ក្នុង `ZTO_PROXY_KEYS`, សោ `ZTO_PROXY_KEY` = `default` · `<សាខា>` = `siteCode` របស់គណនី Palm) ៖ token ZTO · ឈ្មោះគណនី ·
  ពាក្យសម្ងាត់ក្នុងទម្រង់ដែល ZTO ទទួល · `deviceSn` · សាខា ទាំងអស់ AES-GCM ដោយសោដែលមកពី `ZTO_PALM_SESSION_SECRET` (ស្លាកផ្សេងពី session ទូរស័ព្ទ)
  ហើយចងនឹងសោភ្ជាប់ ➜ Blob ចម្លងទៅសោផ្សេង បើកមិនបាន។ បញ្ជីសាខាដែល Login រួចរបស់សោនីមួយ (`palm-sites/<label>` ៖ លេខសាខាប៉ុណ្ណោះ) ជួយទូរស័ព្ទដែលមិនទាន់ដឹងសាខា។
- **សាខានីមួយៗមានគណនី Palm របស់ខ្លួន** ៖ សាខាច្រើនប្រើសោភ្ជាប់ដដែលក៏បាន ➜ Login សាខា B មិនជាន់សាខា A · Login ម្តងទៀតក្នុងសាខាដដែល ➜ ជំនួស
  session មុនរបស់សាខានោះ (Login ចុងក្រោយឈ្នះ ដូច Sync Cookie)។
- ទូរស័ព្ទផ្ញើសាខារបស់ខ្លួន (`X-Zoe-Palm-Site` = `palmAccount.siteCode` ដែលទូរស័ព្ទចាំពេល Login ឬភ្ជាប់) ➜ Function អាន session សាខានោះ
  (ទុកក្នុង memory ៦០ វិនាទី · Blobs ធ្លាក់/គាំង ➜ memory នៅបម្រើ)។ ទូរស័ព្ទមិនផ្ញើសាខា ហើយសោមានសាខាតែមួយ ➜ ប្រើសាខានោះ · ច្រើនសាខា ➜ 401 `palm:branch-unknown`
  (មិនទាយ)។ `ZTO_DETAIL_IDENTITY=require` ➜ គណនី ZoeW សាខា A ផ្ញើសាខា B ➜ `ZTO_OTHER_BRANCH`។
- ទូរស័ព្ទផ្សេង ៖ ចុច **«ប្រើ Login Palm របស់ហាង»** (`GET ?palm=status`) ➜ Function រកសាខាពីគណនី ZoeW ដែលកំពុងចូល (ID token ·
  ត្រូវការ `FIREBASE_PROJECT_IDS` ឬការកំណត់ Supabase ដូចការទាញបញ្ជី) បើមិនបាន ➜ សាខាតែមួយក្នុងបញ្ជីសាខា ➜ ស្កេន · ទាញបញ្ជី · ពិនិត្យស្ថានភាព
  ដោយមិនបាច់ពាក្យសម្ងាត់ ហើយមិនផ្ញើ session ឡើយ · ឬទទួល Setup Link API ដែល URL មាន `palm=1`។
- Function Login ឡើងវិញដោយខ្លួនឯង ៖ session មានអាយុ ≥ 4 ម៉ោង ➜ Login នៅ background ម្តង (container ច្រើន ➜ តែមួយ ៖ lease ក្នុង Blob ដោយ ETag) ·
  ZTO បដិសេធ token ➜ អាន Blob មុន (container ផ្សេងប្រហែលជា Login រួច) បើនៅ token ដដែល ➜ Login (ម្តង · single-flight) រួចសាកសំណើនោះម្តងទៀតក្នុងថវិកា ·
  ការសរសេរ Blob ប្រើ ETag (`onlyIfMatch`) ➜ Login ឡើងវិញមិនសរសេរជាន់ Login ដោយដៃដែលកើតឡើងក្នុងពេលនោះ · Login ឡើងវិញមិនបានដោយបណ្ដាញ ➜ 503
  (App សាកម្តងទៀត) ហើយមិនសាកម្តងទៀតក្នុង 60 វិ · ZTO បដិសេធគណនី (`ZTO_PALM_LOGIN_REJECTED` · `ZTO_PALM_VERIFICATION_REQUIRED` ·
  `ZTO_PALM_COUNTRY_UNSUPPORTED`) ➜ Blob ទុកសញ្ញា «បដិសេធ» ➜ គ្រប់ container ឈប់ Login ហើយឆ្លើយ 401 `palm:login-rejected` ➜ Login ដោយដៃម្តងទៀត។
- `ZTO_DETAIL_IDENTITY=require` ➜ គណនី Palm ត្រូវជាសាខាដូចគណនី ZoeW ដែលកំពុងចូល មុន Server ទុក session (`ZTO_OTHER_BRANCH` · `site:palm-other-branch`)។
- ប៊ូតុង **ផ្តាច់ Palm** ផ្តាច់តែទូរស័ព្ទនោះ (មិនហៅ Server) ៖ session របស់សាខានៅក្នុង Blob ➜ ទូរស័ព្ទផ្សេងនៃសាខាប្រើបានដដែល · ចុច «ប្រើ Login Palm របស់ហាង»
  ដើម្បីភ្ជាប់វិញ · Function គ្មានផ្លូវលុប session របស់សាខា ➜ Login ដោយគណនីថ្មីជំនួស session ចាស់ ·
  ប្តូរ `ZTO_PALM_SESSION_SECRET` ឬសោភ្ជាប់ ➜ session ហាងបើកមិនបាន ➜ Login ម្តងទៀត · ប្តូរពាក្យសម្ងាត់ Palm ➜ ZTO បដិសេធការ Login ឡើងវិញ ➜ Login ម្តងទៀត។
- 401 `ZTO_AUTH_EXPIRED` មានមូលហេតុ (`reason`) ➜ App ប្រាប់មូលហេតុនោះ ៖ `palm:no-session` «Login ZTO Palm របស់សាខានេះមិនមាននៅលើ Server» · `palm:login-rejected` ·
  `palm:unreadable` · `palm:branch-unknown` · គ្មានមូលហេតុ ឬ session ផ្ទាល់ទូរស័ព្ទ ➜ «Session ZTO Palm ផុតកំណត់»។
- 🩺 (`?palm=1&diag=1`) ប្រាប់ប្រភព session (`shared` · `device` · `none`) · សាខា · អាយុ ដោយមិនបង្ហាញ token។
- Blobs មិនទទួលការសរសេរពេល Login (`shared: false`) ➜ ទូរស័ព្ទនោះរក្សា session ដែល Server បិទ (AES-GCM · ចងនឹងសោភ្ជាប់ · ៨ ម៉ោង) និង `refreshToken`
  (ផុត 30 ថ្ងៃ) អ៊ិនគ្រីបម្តងទៀតដោយសោ PIN ➜ `POST ?palm=refresh` (ពេល session មានអាយុ ≥ 4 ម៉ោង ឬ ZTO បដិសេធ) ចូលរួម session ហាងបើមាន
  (គ្មាន Login ZTO) ឬបង្កើតវា ➜ ទូរស័ព្ទលុប session ផ្ទាល់ (`palmShared`)។ Function ប្រើ session ហាងមុន session ដែលទូរស័ព្ទផ្ញើ។
- មិនផ្លាស់ប្តូរ Argus Cookie/Token ដែលមានស្រាប់នៅ server (key `cookie` · `cookie-life` មិនប៉ះ)។
- គាំទ្រគណនីកម្ពុជា `KH` សម្រាប់ flow COD/DOD បច្ចុប្បន្ន។
- App រក្សាតែសាខា (`siteCode` · `siteName`) មិនរក្សាឈ្មោះគណនី Palm ទេ។
- ប្រសិនបើ ZTO ស្នើ CAPTCHA/verification, App បង្ហាញសារឱ្យផ្ទៀងផ្ទាត់តាម ZTO ផ្លូវការ។

## ព្រំដែននៃការភ្ជាប់

- **Lookup ពេលស្កេន** (`billInfoQuery`) ៖ `consigneeMobile` → `phone`, វាល COD/DOD ដូច Argus → `cod` · `dod`
  (តម្លៃអវិជ្ជមាន ➜ 0 · វាលដែលមិនមែនលេខត្រូវរំលង)។ ទទួលទាំងលេខទូរស័ព្ទធម្មតា និង encrypted phone ដែល Palm ប្រើ។
- **☰ ZTO ➜ បិទតាម ZTO ស្វ័យប្រវត្តិ** និង **ការរង់ចាំ ៨ ថ្ងៃ** ៖ អានបញ្ជី tab «ចុះហត្ថលេខា» (`queryDispatchList` `billStatus` `5`
  តាមថ្ងៃ `signSiteDate`) ជាទំព័រ ១០០ ជួរ ➜ តែជួរដែល `billStatus` = `5` ទេជាភស្តុតាង ➜ បិទកញ្ចប់ដែលបើកក្នុង ZoeW ដូចរបៀប Argus។
- **☰ ZTO ➜ ទាញបញ្ជីកញ្ចប់ពី ZTO** បើកសម្រាប់ Palm ៖ `queryDispatchList` ផ្តល់បេក្ខភាពពី tab បញ្ហា · បញ្ជូន · ចុះហត្ថលេខា (tab បញ្ជូនអាន ២ ដង ៖ គ្មានថ្ងៃ ·
  និងតាម `dispEmpDateFrom`/`dispEmpDateTo` លើចន្លោះដែលជ្រើស ដូច App Palm — ZTO ឆ្លើយបញ្ជីគ្មានថ្ងៃ ខ្វះកញ្ចប់ដែលចាត់ថ្ងៃនោះ) ហើយ
  `queryTrackInfo` ផ្ទៀងថាមាន `action: "3"` ត្រូវ `siteCode` របស់គណនី និងថ្ងៃជ្រើស មុនបង្ហាញ។ មិនយក `dispEmpDate` ជាថ្ងៃមកដល់ទេ។
  ការទាញមាន ២ ដំណាក់កាល ៖ (១) `candidates=1` អានបេក្ខភាព ១០០ ជួរក្នុងមួយ tab (លេខទូរស័ព្ទ · COD/DOD · ប្រភព `recSite`) ហើយអានតែ tab
  ដែលនៅមានទំព័រ (`tabs` · `tabPages`) · (២) `tracks=A,B,…` (≤ ៣០ Barcode ក្នុងមួយសំណើ) អាន track ស្របគ្នា (៨ ក្នុង Function មួយ) ហើយ
  ឆ្លើយតែម៉ោងមកដល់ក្នុងចន្លោះ · ស្ថានភាពបិទ · ម៉ោងចុះហត្ថលេខា · ប្រភពពី track (គ្មានលេខទូរស័ព្ទ)។ App ផ្ញើ ៨ សំណើក្នុងពេលតែមួយ ៖
  App ចាំចំនួនទំព័រនៃ tab នីមួយៗពីការទាញមុន (`zoew_zto_palm_pages_v1` ៖ ចំនួនទំព័រប៉ុណ្ណោះ · ចងនឹងហាង + សាខា Palm) ហើយស្នើទំព័រ ២.. ស្របគ្នាជាមួយទំព័រ ១ ·
  ទំព័រដែល ZTO ប្រាប់ថាមានថ្មី ឬ tab ដែលការចាំខ្វះ ➜ អានបន្ថែមភ្លាម · ការចាំលើស ➜ ទំព័រទទេពីរបី (មិនមែន «ទាញមិនបាន»)។ ក្រុម track ៣០ ចាប់ផ្តើមភ្លាមពេលមាន
  បេក្ខភាពគ្រប់ ៣០ (មិនរង់ចាំបញ្ជីគ្រប់ទំព័រ) · ពេលបញ្ជីដឹងគ្រប់ ➜ បេក្ខភាពដែលនៅសល់ចែកស្មើគ្នាតាមស្លតទំនេរ ≤ ៣០ (ឧ. ៧០ ➜ ៨ × ៩) · ក្រុមធំជាង ៣០
  ធ្វើឲ្យការទាញយឺត (ម្ចាស់គម្រោងវាស់ក្រុម ~៥៧ ៖ «មានអារម្មណ៍ថាយឺតជាងមុន»)។ `queryTrackInfo` អានម្តងមួយ Barcode
  (ZTO ឆ្លើយទទេចំពោះ `mailNos` ច្រើនលេខ)។ ឈ្មោះសាខា ៖ Login Palm ច្រើនតែឆ្លើយ `siteName` ទទេ ➜ `tracks=` ឆ្លើយ `siteName` ពីស្កេនចុងក្រោយនៃសាខាខ្លួន
  (មិនមែនសាខាដឹកបន្ត) ➜ «🏢 សាខា ៖ ឈ្មោះ · លេខ» ដូច Cookie ហើយ App ចាំក្នុងការកំណត់ Palm (តែពេលទទេ · លេខសាខាដដែល)។ ប្រអប់បង្ហាញខ្លី ៖ «ZTO N ជួរ · ថ្ងៃ · 🔒 ZTO បិទរួច · ✍️ ចុះហត្ថលេខា (មកដល់មុន …) · ⏱ X វិ · 👁️ មើលជាមុន» ·
  ពេលសរុប ≈ (កញ្ចប់ × ពេល ZTO ឆ្លើយ ÷ ៦៤) + ពេលធ្វើដំណើរ App ↔ Function ↔ ZTO (តំបន់ Function ៖ 🩺 ជួរ ZTO «Function នៅ …» · ប្តូរបានក្នុង Netlify តែគម្រោងបង់ប្រាក់) + ពេលទំព័រទី ១។
  ZTO មិនឆ្លើយ (5xx · អស់ពេល · `status:false`) ➜ Function សាកម្តងទៀតមួយដងក្នុងថវិការបស់វា · App សាកសំណើម្តងទៀតដល់ ៣ ដង
  និងសាក track របស់ Barcode ដែលផ្ទៀងមិនបានម្តងទៀត ២ ជុំ។ track មួយកញ្ចប់ខូច ឬមិនឆ្លើយ មិនធ្វើឲ្យបញ្ជីទាំងមូលបរាជ័យទេ ៖
  Barcode នោះចូល `unverified` ហើយប្រអប់បង្ហាញ «⚠️ ZTO មិនឆ្លើយ track N កញ្ចប់ (Barcode …)» · ទំព័រដែលនៅតែមិនឆ្លើយបង្ហាញ
  «⚠️ ទាញមិនបាន N ទំព័រ» ➜ ចុចទាញម្តងទៀត។ Session Palm ផុតកំណត់ពាក់កណ្តាល ➜ ឈប់ · មាន `refreshToken` ➜ Login ឡើងវិញភ្លាមក្រោយការទាញចប់ ហើយប្រាប់ឲ្យទាញម្តងទៀត ·
  គ្មាន ➜ ប្រាប់ឲ្យ Login ZTO Palm ម្តងទៀត។
  ហាង Firebase និងហាង Supabase ទាញ បដិសេធ និងប្រជែងដូចគ្នា ៖ Server បដិសេធគណនី ZoeW (`ZTO_DETAIL_IDENTITY=require` · គណនីគ្មានសាខា · ហាងផុតកំណត់ ឬបិទ ·
  ផ្ទៀងផ្ទាត់មិនបាន) ➜ ប្រអប់ប្រាប់មូលហេតុដូចរបៀប Cookie · គណនី ZoeW សាខាផ្សេងពីគណនី Palm ➜ «សូម Login ZTO Palm របស់សាខានេះ»។
  track ដែលមាន `mailNo` ផ្សេង (ឧ. លេខជើងដំបូង) ឬម៉ោង/action ខូច មិនត្រូវយកជាភស្តុតាងទេ។ Barcode ត្រូវផ្ទៀងតាម
  `mail.mailNo`, `mailNo` ឬ `tracks[].mailNo`។ `result: []` មិនមែនភស្តុតាងថាមិនទាន់មកដល់ទេ ➜ អានម្តងទៀត ហើយនៅទទេ ➜ `unverified`។
- ស្ថានភាពបិទក្នុងបញ្ជី (ដូចបញ្ជីស្កេន `05` របស់ Cookie) ៖ ស្កេន `5` ត្រូវសាខា នៅក្រោយ ឬស្មើមកដល់ចុងក្រោយ = បិទ (`ztoClosed: true` ·
  ម៉ោងចុះហត្ថលេខាចូល `signedRows`) លើកលែង `mail.isSign: 0` ផ្ទុយ ➜ `null` · មកដល់ហើយ `isSign: 0` គ្មានស្កេន `5` ក្រោយ = មិនទាន់បិទ ·
  ផ្សេងពីនេះ `null` (App ពិនិត្យកញ្ចប់ចាស់តាម `status=1`)។
- ប្រភពកញ្ចប់ VN · CN · ផ្សេងៗត្រូវរក្សាទុកពេលនាំចូល ៖ `recSite`/`customerCodeDesc` បើមាន ឬឈ្មោះកន្លែងទទួលដើមពី
  `action: "1"` ក្នុងប្រវត្តិស្កេន (`msgLoc` · `msgEng` · `siteName`)។ មិនយកសាខាដឹកបន្ត ឬប្រទេសអ្នកទទួលជាប្រភពទេ។
  ប្រភពដែល ZTO មិនផ្តល់ទុកទទេ។ ការបង្ហាញទង់ជាតិប្រើផែនទីឈ្មោះសាខាដូច Cookie។
- ម៉ោងមកដល់អានពី `tracks.time` របស់ស្កេន `3`; ម៉ោងចុះហត្ថលេខាអានពីស្កេន `5` ត្រូវសាខា។
- កញ្ចប់ត្រឡប់ទៅវិញ ៖ ស្កេន `-710` (`退货中` «ត្រឡប់ស្កេន») ត្រូវសាខា ក្រោយការមកដល់ចុងក្រោយ ➜ `tracks=` ឆ្លើយ `returnedAt` ➜
  ក្រុម «↩️ មានក្នុងបញ្ជី តែស្កេនត្រឡប់រួច» មិនបញ្ចូល (ដូច Cookie ស្កេន `-710`) · `-710` នៃសាខាផ្សេង ឬមុនការមកដល់ថ្មី មិនរាប់ ·
  ការពិនិត្យកញ្ចប់មួយ (`status=1`) ឆ្លើយ `ztoReturnedAt` ផងដែរ (គ្មានពេល ZTO ចុះហត្ថលេខា) ➜ កញ្ចប់បើកក្នុង ZoeW ចូលធុងសំរាម «ត្រឡប់» (ដកលុយ និងចំនួនកញ្ចប់ ដូចច្បាប់ថ្ងៃទី ៨)។
  កញ្ចប់ដែលយករួចប្រើម៉ោងនេះក្នុងការនាំចូល និងការរង់ចាំ ៨ ថ្ងៃ ដូច Cookie។
- របារ «ZTO មិនទាន់បិទ» និងការពិនិត្យកញ្ចប់ប្រើ `queryTrackInfo` (`status=1`) ៖ `mail.isSign: 0` ជាមួយស្កេនមកដល់ត្រូវសាខា
  = មិនទាន់ចុះហត្ថលេខា; `isSign: 1` ជាមួយស្កេនចុះហត្ថលេខាត្រូវសាខាក្រោយមកដល់ចុងក្រោយ = ចុះហត្ថលេខា។ ចម្លើយមិនច្បាស់ទុក `null`។
- គណនី ZoeW ដែលផ្ទៀងរួច (`ZTO_DETAIL_IDENTITY`) ត្រូវជាសាខាដូចគណនី Palm ➜ សាខាផ្សេង ➜ `site:palm-other-branch` (បញ្ជីបិទ)។
- ⛔ ZoeW មិនកែទិន្នន័យ ឬផ្ញើ sign scan ទៅ ZTO ទេ (endpoint សរសេររបស់ Palm មិនដែលហៅ)។ ZTO ឆ្លើយកូដដែល Function មិនស្គាល់ ➜ App បង្ហាញ
  (`palm:<code>`) ដើម្បីងាយស្រួលដោះស្រាយ។

កាតាឡុក endpoint ទាំងអស់របស់ App Palm (field request/response · អាន/សរសេរ · កូដស្ថានភាព) ៖ [ZTO-PALM-API.md](ZTO-PALM-API.md)។

ទម្រង់ request របស់ Palm មកពី: `PDAService`, `PDARequestImpl`,
`HttpSignKey`, `AES`, `PDAEncodeUtils`, និង `LoginEventManage`។ Production host:
`https://aargus-api.ztoglobal.net`; login `/zto/system/v1/doLogin`; lookup
`/zto/basic/v1/billInfoQuery`។ តម្លៃសោ protocol (`HttpSignKey` · `AES`) ដាក់តែក្នុង env
`ZTO_PALM_SIGN_KEY` និង `ZTO_PALM_PASSWORD_KEY` — ZTO ប្តូរ protocol ➜ ប្តូរ env ហើយ redeploy។

តេស្តប្រើ synthetic accounts និង mocked upstream ប៉ុណ្ណោះ។ ត្រូវ deploy ហើយសាក
គណនី Palm និងកញ្ចប់ពិតដែលអ្នកមានសិទ្ធិមុនប្រើក្នុងការងារ។

## កូដកំហុសទាញបញ្ជី Palm

កំហុសបញ្ជីភ្ជាប់ `reason` ដើម្បីបង្ហាញកន្លែងខូច ដោយមិនបង្ហាញ response ឯកជនដើម៖

| Reason | ត្រូវផ្ទៀង |
|---|---|
| `palm:list-1-result/pages` (ឬ `list-4`, `list-5`) | envelope `result` និង pagination របស់ tab នោះ (HTTP 502) |
| `palm:list-5-items-null-p1` (ឬប្រភេទ/ទំព័រផ្សេង) | បញ្ជី `list` ខូច; reason បង្ហាញ type និងលេខទំព័រ (`large` = លើសពិដានជួរ) |
| `palm:list-4-unavailable` · `palm:list-4-timeout` (ឬ `list-1`, `list-5`) | `queryDispatchList` មិនឆ្លើយក្រោយសាកម្តងទៀត (HTTP 502 · 504) |

កូដក្នុង `unverifiedReasons` (Barcode នៅក្នុង `unverified` · បញ្ជីនៅតែមក)៖

| Reason | ត្រូវផ្ទៀង |
|---|---|
| `palm:unavailable` · `palm:timeout` · `palm:rate` · `palm:<statusCode>` | `queryTrackInfo` មិនឆ្លើយ ឬ ZTO បដិសេធក្រោយសាកម្តងទៀត |
| `palm:track-empty` | `result: []` ទាំងពីរដង |
| `palm:track-result/identity` | result មិនមែនបញ្ជី ឬគ្មានក្រុម track របស់ Barcode នោះ |
| `palm:track-time/action` | track របស់ Barcode នោះមានតែម៉ោង ឬ action ខូច |
| `palm:budget` | ថវិកា Function អស់មុនអាន Barcode នោះ (App សាកម្តងទៀតជុំក្រោយ) |

សាក Barcode ក្នុង 🧪 ដើម្បីផ្ទៀងចម្លើយដើម។ កូដទាំងនេះជាកូដ ZoeW សម្រាប់រោគវិនិច្ឆ័យ មិនមែន `statusCode` របស់ ZTO ទេ (លើកលែង `palm:<statusCode>`)។

## បញ្ជាក់កញ្ចប់មានបញ្ហាពេល Sign

ពេលបើក Sign ZoeW ពិនិត្យ tracking ហើយបង្ហាញស្កេនបញ្ហាថ្មីបំផុតរបស់សាខា ក្នុងវដ្តមកដល់បច្ចុប្បន្ន។ ស្កេនបញ្ហាមិនអនុម័តការទទួលដោយខ្លួនឯងទេ។
ពេលផ្ញើបញ្ជីទទួល ហើយ ZTO ស្នើឲ្យបញ្ជាក់កញ្ចប់មានបញ្ហា ZoeW បង្ហាញ Barcode និងសារព្រមានរបស់ ZTO នៅលើកញ្ចប់នោះ។
ពិនិត្យថាបញ្ហាបានដោះស្រាយរួច សឹមចុច **«បញ្ជាក់ និងបន្ត»**។ **«បោះបង់»** រក្សាកញ្ចប់បើក ហើយមិនផ្ញើការទទួល។
ការបញ្ជាក់ធ្វើម្តងមួយ Barcode; កញ្ចប់បន្ទាប់ដែលមានសារព្រមាន ត្រូវបញ្ជាក់ដោយឡែក។
បើ ZTO ហាមបន្ត ZoeW បង្ហាញមូលហេតុពិត ហើយមិនមានប៊ូតុងបញ្ជាក់ឆ្លងទេ។
