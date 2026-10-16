# Login ZTO Palm — ZoeW

នៅក្នុង ZoeW បើកការកំណត់ **API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ** ដោយ PIN រួចបើក
**Login ZTO Palm**។ បញ្ចូលគណនី និងពាក្យសម្ងាត់ Palm រួចចុច **Login និងបើក Lookup**។
ពេលស្កេន Barcode, ZoeW បំពេញលេខទូរស័ព្ទ និង COD/DOD ទៅផ្ទាំងស្កេនដែលមានស្រាប់។
ការរក្សាទុកភ្លាមៗនៅតែអាស្រ័យលើជម្រើស auto-submit របស់អ្នក។

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
- COD/DOD អានតាមវាលដូច Argus (`ZTO_FIELD_COD` · `ZTO_FIELD_DOD` ឬលំនាំដើម `agentAmount` · `fcAmount` មុន)។
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

ការភ្ជាប់នេះសម្រាប់ lookup មួយ Barcode: `consigneeMobile` → `phone`, វាល COD/DOD ដូច Argus → `cod` · `dod`
(តម្លៃអវិជ្ជមាន ➜ 0 · វាលដែលមិនមែនលេខត្រូវរំលង)។ ទទួលទាំងលេខទូរស័ព្ទធម្មតា និង encrypted phone
ដែល Palm ប្រើ។ មិនកែទិន្នន័យ ឬផ្ញើ sign scan ទៅ ZTO ទេ។ មុខងារ Argus list/auto-close
ត្រូវបានលាក់ក្នុងរបៀប Palm ព្រោះ endpoint Lookup នេះមិនផ្តល់ភស្តុតាងចុះហត្ថលេខា។

⚠️ ផលប៉ះពាល់ខាងលុយ៖ ឧបករណ៍ក្នុងរបៀប Palm មិនបិទកញ្ចប់តាម ZTO ហើយមិនអានបញ្ជី «ចុះហត្ថលេខា» ទេ។ បើគ្មានឧបករណ៍ Argus
(auto-close) ណាមួយក្នុងហាង កញ្ចប់ដែលអតិថិជនយកនៅ ZTO តែមិនបានបិទក្នុង ZoeW ផុតកំណត់តាមច្បាប់សម្អាតស្វ័យប្រវត្តិ ហើយត្រូវដកពីចំណូល ➜
បិទកញ្ចប់ក្នុង ZoeW ពេលអតិថិជនយក ឬទុកឧបករណ៍ Argus មួយសម្រាប់ auto-close។ ZTO ឆ្លើយកូដដែល Function មិនស្គាល់ ➜ App បង្ហាញកូដនោះ
(`palm:<code>`) ដើម្បីងាយស្រួលដោះស្រាយ។

កាតាឡុក endpoint ទាំងអស់របស់ App Palm (field request/response · អាន/សរសេរ · កូដស្ថានភាព) ៖ [ZTO-PALM-API.md](ZTO-PALM-API.md)។

ទម្រង់ request របស់ Palm មកពី: `PDAService`, `PDARequestImpl`,
`HttpSignKey`, `AES`, `PDAEncodeUtils`, និង `LoginEventManage`។ Production host:
`https://aargus-api.ztoglobal.net`; login `/zto/system/v1/doLogin`; lookup
`/zto/basic/v1/billInfoQuery`។ តម្លៃសោ protocol (`HttpSignKey` · `AES`) ដាក់តែក្នុង env
`ZTO_PALM_SIGN_KEY` និង `ZTO_PALM_PASSWORD_KEY` — ZTO ប្តូរ protocol ➜ ប្តូរ env ហើយ redeploy។

តេស្តប្រើ synthetic accounts និង mocked upstream ប៉ុណ្ណោះ។ ត្រូវ deploy ហើយសាក
គណនី Palm និងកញ្ចប់ពិតដែលអ្នកមានសិទ្ធិមុនប្រើក្នុងការងារ។
