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
| `ZTO_PROXY_KEY` | សោភ្ជាប់ ZoeW ដែលមានស្រាប់; App ប្រើ header `X-Zoe-Proxy-Key` |
| `ZTO_PALM_SESSION_SECRET` | តម្លៃចៃដន្យសម្រាប់អ៊ិនគ្រីប session របស់ Palm, យ៉ាងតិច 32 តួអក្សរ |

បង្កើត session secret ថ្មីលើកុំព្យូទ័ររបស់អ្នកដោយ៖

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

កុំដាក់ secret នេះក្នុង `VITE_*`, URL, source control ឬ frontend។ ប្តូរ secret នេះ
នឹងធ្វើឱ្យ session Palm ដែលមានស្រាប់ត្រូវ login ម្តងទៀត។ `ZTO_PROXY_KEYS_JSON`
ដែលមានស្រាប់ក៏គាំទ្រដែរ; session នីមួយៗចងជាមួយ proxy key ដែលបាន login។

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
- ប៊ូតុង **ផ្តាច់ Palm** លុប session ក្នុង App, បិទ Lookup និងសម្អាត cache Lookup។
- ប្រសិនបើ ZTO ស្នើ CAPTCHA/verification, App បង្ហាញសារឱ្យផ្ទៀងផ្ទាត់តាម ZTO ផ្លូវការ។

## ព្រំដែននៃការភ្ជាប់

ការភ្ជាប់នេះសម្រាប់ lookup មួយ Barcode: `consigneeMobile` → `phone`, `cod`/`agentAmount`
→ `cod`, `dod`/`fcAmount` → `dod`។ ទទួលទាំងលេខទូរស័ព្ទធម្មតា និង encrypted phone
ដែល Palm ប្រើ។ មិនកែទិន្នន័យ ឬផ្ញើ sign scan ទៅ ZTO ទេ។ មុខងារ Argus list/auto-close
ត្រូវបានលាក់ក្នុងរបៀប Palm ព្រោះ endpoint Lookup នេះមិនផ្តល់ភស្តុតាងចុះហត្ថលេខា។

ទម្រង់ request របស់ Palm មកពី: `PDAService`, `PDARequestImpl`,
`HttpSignKey`, `AES`, `PDAEncodeUtils`, និង `LoginEventManage`។ Production host:
`https://aargus-api.ztoglobal.net`; login `/zto/system/v1/doLogin`; lookup
`/zto/basic/v1/billInfoQuery`។ Server មាន protocol constants ពី APK នេះ; optional
`ZTO_PALM_SIGN_KEY` និង `ZTO_PALM_PASSWORD_KEY` សម្រាប់ការប្តូរដោយអ្នកគ្រប់គ្រងនៅពេល
ZTO ផ្លាស់ប្តូរ protocol (password key ត្រូវមាន 16 UTF-8 bytes)។

តេស្តប្រើ synthetic accounts និង mocked upstream ប៉ុណ្ណោះ។ ត្រូវ deploy ហើយសាក
គណនី Palm និងកញ្ចប់ពិតដែលអ្នកមានសិទ្ធិមុនប្រើក្នុងការងារ។
