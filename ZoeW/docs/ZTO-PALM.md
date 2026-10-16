# Login ZTO Palm — ZoeW

នៅក្នុង ZoeW បើកការកំណត់ **API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ** ដោយ PIN រួចបើក
**Login ZTO Palm**។ បញ្ចូលគណនី និងពាក្យសម្ងាត់ Palm រួចចុច **Login និងបើក Lookup**។
ពេលស្កេន Barcode, ZoeW បំពេញលេខទូរស័ព្ទ និង COD/DOD ទៅផ្ទាំងស្កេនដែលមានស្រាប់។
ការរក្សាទុកភ្លាមៗនៅតែអាស្រ័យលើជម្រើស auto-submit របស់អ្នក។

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
**តម្លៃ Header / API Key / Secret** រួចចុច Login Palm។ Login ជោគជ័យនឹងរៀបចំ
URL, header និង field mapping ដោយស្វ័យប្រវត្តិ។

សម្រាប់ Android, build ជាមួយ `VITE_NATIVE_WEB_ORIGIN=https://your-site.netlify.app`
ដូចការកំណត់ native ដែលមានស្រាប់។ Browser web និង APK ផ្ញើ password ទៅតែ Function
របស់ ZoeW ផ្ទាល់។

## Session និងទិន្នន័យ

- Password ប្រើតែសម្រាប់សំណើ login មួយ; ZoeW មិនរក្សាទុកវាទេ។
- Server បិទ token ក្នុង session AES-GCM ហើយ App អ៊ិនគ្រីប session ដោយសោ PIN ម្តងទៀត។
- Session មានអាយុអតិបរមា 8 ម៉ោង ស្របនឹង client Palm ដែលបានពិនិត្យ។ ZTO អាចបដិសេធ
  token មុនពេលនោះ; នៅពេល App ប្រាប់ session ផុតកំណត់ សូម Login Palm ម្តងទៀត។
- មិនផ្លាស់ប្តូរ Argus Cookie/Token ដែលមានស្រាប់នៅ server និងមិនចែករំលែក token
  Palm របស់អ្នកជាមួយឧបករណ៍ផ្សេង។
- គាំទ្រគណនីកម្ពុជា `KH` សម្រាប់ flow COD/DOD បច្ចុប្បន្ន។
- ប៊ូតុង **ផ្តាច់ Palm** លុប session ក្នុង App, បិទ Lookup និងសម្អាត cache Lookup។ Server មិនរក្សាបញ្ជី session ទេ ➜ session ដែលបានចេញ
  (បើមាននរណាចម្លងវារួច) ផុតកំណត់ដោយខ្លួនឯងក្នុង 8 ម៉ោង ហើយប្រើបានតែជាមួយ proxy key ដដែល។ ប្តូរ `ZTO_PALM_SESSION_SECRET` ➜ session ទាំងអស់ឈប់ភ្លាម។
- App រក្សាតែសាខា (`siteCode` · `siteName`) មិនរក្សាឈ្មោះគណនី Palm ទេ។
- ប្រសិនបើ ZTO ស្នើ CAPTCHA/verification, App បង្ហាញសារឱ្យផ្ទៀងផ្ទាត់តាម ZTO ផ្លូវការ។

## ព្រំដែននៃការភ្ជាប់

- **Lookup ពេលស្កេន** (`billInfoQuery`) ៖ `consigneeMobile` → `phone`, វាល COD/DOD ដូច Argus → `cod` · `dod`
  (តម្លៃអវិជ្ជមាន ➜ 0 · វាលដែលមិនមែនលេខត្រូវរំលង)។ ទទួលទាំងលេខទូរស័ព្ទធម្មតា និង encrypted phone ដែល Palm ប្រើ។
- **☰ ZTO ➜ បិទតាម ZTO ស្វ័យប្រវត្តិ** និង **ការរង់ចាំ ៨ ថ្ងៃ** ៖ អានបញ្ជី tab «ចុះហត្ថលេខា» (`queryDispatchList` `billStatus` `5`
  តាមថ្ងៃ `signSiteDate`) ជាទំព័រ ១០០ ជួរ ➜ តែជួរដែល `billStatus` = `5` ទេជាភស្តុតាង ➜ បិទកញ្ចប់ដែលបើកក្នុង ZoeW ដូចរបៀប Argus។
- **☰ ZTO ➜ ទាញបញ្ជីកញ្ចប់ពី ZTO** បើកសម្រាប់ Palm ៖ `queryDispatchList` ផ្តល់បេក្ខភាពពី tab បញ្ហា · បញ្ជូន · ចុះហត្ថលេខា ហើយ
  `queryTrackInfo` ផ្ទៀងថាមាន `action: "3"` ត្រូវ `siteCode` របស់គណនី និងថ្ងៃជ្រើស មុនបង្ហាញ។ មិនយក `dispEmpDate` ជាថ្ងៃមកដល់ទេ។
  ការទាញមាន ២ ដំណាក់កាល ៖ (១) `candidates=1` អានបេក្ខភាព ១០០ ជួរក្នុងមួយ tab (លេខទូរស័ព្ទ · COD/DOD · ប្រភព `recSite`) ហើយអានតែ tab
  ដែលនៅមានទំព័រ (`tabs` · `tabPages`) · (២) `tracks=A,B,…` (≤ ៣០ Barcode ក្នុងមួយសំណើ) អាន track ស្របគ្នា (៨ ក្នុង Function មួយ) ហើយ
  ឆ្លើយតែម៉ោងមកដល់ក្នុងចន្លោះ · ស្ថានភាពបិទ · ម៉ោងចុះហត្ថលេខា · ប្រភពពី track (គ្មានលេខទូរស័ព្ទ)។ App ផ្ញើ ៤ សំណើក្នុងពេលតែមួយ។
  Function សាក `mailNos` ច្រើនលេខ («A,B,C» ≤ ១០) ក្នុងសំណើតែមួយ ៖ យកតែក្រុម/track ដែល Barcode ត្រូវគ្នាពិត · ZTO មិនគាំទ្រ (ទទេ · បដិសេធ ·
  ឆ្លើយតែលេខមួយ) ➜ ម្តងមួយលេខ ហើយចងចាំ ១០ នាទី។ ប្រអប់បង្ហាញ «⏱ Palm ៖ ផ្ទៀង N កញ្ចប់ ក្នុង X វិនាទី (សំណើ track M)» ៖ M ជិត N/១០
  = ZTO គាំទ្រច្រើនលេខ · M ≈ N = ម្តងមួយលេខ។
  ZTO មិនឆ្លើយ (5xx · អស់ពេល · `status:false`) ➜ Function សាកម្តងទៀតមួយដងក្នុងថវិការបស់វា · App សាកសំណើម្តងទៀតដល់ ៣ ដង
  និងសាក track របស់ Barcode ដែលផ្ទៀងមិនបានម្តងទៀត ២ ជុំ។ track មួយកញ្ចប់ខូច ឬមិនឆ្លើយ មិនធ្វើឲ្យបញ្ជីទាំងមូលបរាជ័យទេ ៖
  Barcode នោះចូល `unverified` ហើយប្រអប់បង្ហាញ «⚠️ ZTO មិនឆ្លើយ track N កញ្ចប់ (Barcode …)» · ទំព័រដែលនៅតែមិនឆ្លើយបង្ហាញ
  «⚠️ ទាញមិនបាន N ទំព័រ» ➜ ចុចទាញម្តងទៀត។ Session Palm ផុតកំណត់ពាក់កណ្តាល ➜ ឈប់ ហើយប្រាប់ឲ្យ Login ZTO Palm ម្តងទៀត។
  track ដែលមាន `mailNo` ផ្សេង (ឧ. លេខជើងដំបូង) ឬម៉ោង/action ខូច មិនត្រូវយកជាភស្តុតាងទេ។ Barcode ត្រូវផ្ទៀងតាម
  `mail.mailNo`, `mailNo` ឬ `tracks[].mailNo`។ `result: []` មិនមែនភស្តុតាងថាមិនទាន់មកដល់ទេ ➜ អានម្តងទៀត ហើយនៅទទេ ➜ `unverified`។
- ស្ថានភាពបិទក្នុងបញ្ជី (ដូចបញ្ជីស្កេន `05` របស់ Cookie) ៖ ស្កេន `5` ត្រូវសាខា នៅក្រោយ ឬស្មើមកដល់ចុងក្រោយ = បិទ (`ztoClosed: true` ·
  ម៉ោងចុះហត្ថលេខាចូល `signedRows`) លើកលែង `mail.isSign: 0` ផ្ទុយ ➜ `null` · មកដល់ហើយ `isSign: 0` គ្មានស្កេន `5` ក្រោយ = មិនទាន់បិទ ·
  ផ្សេងពីនេះ `null` (App ពិនិត្យកញ្ចប់ចាស់តាម `status=1`)។
- ប្រភពកញ្ចប់ VN · CN · ផ្សេងៗត្រូវរក្សាទុកពេលនាំចូល ៖ `recSite`/`customerCodeDesc` បើមាន ឬឈ្មោះកន្លែងទទួលដើមពី
  `action: "1"` ក្នុងប្រវត្តិស្កេន (`msgLoc` · `msgEng` · `siteName`)។ មិនយកសាខាដឹកបន្ត ឬប្រទេសអ្នកទទួលជាប្រភពទេ។
  ប្រភពដែល ZTO មិនផ្តល់ទុកទទេ។ ការបង្ហាញទង់ជាតិប្រើផែនទីឈ្មោះសាខាដូច Cookie។
- ម៉ោងមកដល់អានពី `tracks.time` របស់ស្កេន `3`; ម៉ោងចុះហត្ថលេខាអានពីស្កេន `5` ត្រូវសាខា។
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
