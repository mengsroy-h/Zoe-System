# កំណត់ ZTO Lookup សម្រាប់ ZoeW

ZoeW ហៅ ZTO តាម Netlify Function ដើម្បីកុំឱ្យ Cookie/Token របស់ ZTO ចូលក្នុង
កូដ static ឬ browser។ ត្រូវមាន `ZTO_PROXY_KEY` មួយ និងជ្រើស **auth របស់ ZTO
តែមួយប្រភេទ** ខាងក្រោម។

## ១. ជ្រើសរើស auth របស់ ZTO

លំដាប់ណែនាំ៖

1. `ZTO_AUTHORIZATION` — ប្រើបើ ZTO ផ្តល់តម្លៃ Authorization ផ្លូវការ។
2. `ZTO_TOKEN` — ប្រើបើ ZTO ផ្តល់ API token និងឈ្មោះ header ផ្លូវការ។
3. `ZTO_COOKIE` — fallback បច្ចុប្បន្ន បើគណនីមានតែ Argus web login។

Proxy ប្រើតែមួយតាមលំដាប់ខាងលើ ដូច្នេះ Cookie ចាស់មិនរំខាន official token ទេ។

### វិធីយក Cookie បើមិនទាន់មាន official token

1. Login ទៅ `https://argus.ztoglobal.com`។
2. ចុច `F12` → `Network`។
3. Filter ពាក្យ `order/detail` ហើយស្កេន/ស្វែងរក barcode មួយ។
4. ចុច request `scan/get/order/detail` → `Headers` → `Request Headers`។
5. ចម្លង Cookie **ទាំងមូល** ដែលចាប់ផ្តើមដូចជា៖

```text
BOS-MAN-SESSION=...
```

កុំផ្ញើ Cookie/Token/Authorization ក្នុង chat, screenshot ឬ commit ទៅ GitHub។
បើវាធ្លាប់លេចធ្លាយ សូម revoke ឬ Logout រួច Login ថ្មីភ្លាម។

## ២. ដាក់ Environment Variables ក្នុង Netlify

ចូល `Netlify → ZoeW site → Site configuration → Environment variables`។ ដាក់
`ZTO_PROXY_KEY` ជានិច្ច និងដាក់ auth របស់ ZTO តែមួយប្រភេទ៖

| Key | ពេលណាប្រើ | Value |
| --- | --- | --- |
| `ZTO_PROXY_KEY` | ត្រូវមានជានិច្ច | តម្លៃចៃដន្យ 32–64 តួ |
| `ZTO_AUTHORIZATION` | ជម្រើសទី ១ | ឧ. `Bearer ...` តាមឯកសារ ZTO |
| `ZTO_TOKEN` | ជម្រើសទី ២ | API token ផ្លូវការ |
| `ZTO_TOKEN_HEADER` | ជាមួយ `ZTO_TOKEN` បើ ZTO បញ្ជាក់ | ឧ. `X-Access-Token` |
| `ZTO_COOKIE` | ជម្រើសទី ៣ | Cookie ពេញពី Argus request |

សម្គាល់តម្លៃ auth និង `ZTO_PROXY_KEY` ជា **Contains secret values**, កំណត់ scope
សម្រាប់ **Functions** និង production context តែប៉ុណ្ណោះ។ កុំដាក់ secret ក្នុង
`netlify.toml`។ ក្រោយ Save សូម deploy ZoeW/Function ឡើងវិញ។

## ៣. បំពេញក្នុង ZoeW

ចូល `API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ` ហើយដាក់៖

| វាល | តម្លៃ |
| --- | --- |
| URL API | `/.netlify/functions/zto-order-detail?barcode={barcode}` |
| ឈ្មោះ Header | `X-Zoe-Proxy-Key` |
| តម្លៃ Header | តម្លៃដូច `ZTO_PROXY_KEY` |
| Field លេខទូរស័ព្ទ | `phone` |
| Field COD | `cod` |
| Field DOD | `dod` |

ធីក `Fast Mode សម្រាប់ ZTO Lookup` ដើម្បីឱ្យ barcode ដែលរកឃើញរួចក្នុង ១០នាទី
បំពេញភ្លាម។ Fast Mode រក្សាតែក្នុង memory, មិនរក្សាទិន្នន័យ ZTO ក្នុង Service
Worker cache និងមានពិដាន ៣០០ barcode។ Manual fallback បើកក្រោយ ១.៨វិនាទី
ដដែល ខណៈ request ZTO នៅតែបន្ត។

Proxy រង់ចាំ ZTO អតិបរមា ១២វិនាទី ហើយ ZoeW រង់ចាំ proxy ១៦វិនាទីក្នុងមួយ
attempt។ 401/403 មិន retry ទេ; 408/425/429/5xx ទើប retry។ Response ជោគជ័យទៅ
browser មានតែ `phone`, `cod`, `dod`, `barcode`, `success`; ឈ្មោះ និងអាសយដ្ឋាន
អតិថិជនដែល UI មិនប្រើ មិនត្រូវបញ្ជូនចេញ។

Function ផ្ញើទៅ ZTO ជា៖

```json
{"billCode":"លេខ barcode","countryCode":"KH"}
```

## ការគណនា field

- `phone` ← `data.consigneePhone` ឬ `data.consigneeMobile`
- `cod` ← `data.agentAmount`
- `dod` ← `data.arrivalServiceCharge`

បើ DOD របស់អាជីវកម្មអ្នកមិនមែន `arrivalServiceCharge` សូមកែ mapping ក្នុង
`netlify/functions/zto-order-detail.js` មុន deploy។

## ពេលវាឈប់ដំណើរការ

- `ZTO session ផុតកំណត់` — Cookie/Token ត្រូវបាន ZTO បដិសេធ។ បើប្រើ Cookie៖
  Login Argus ថ្មី → replace `ZTO_COOKIE` → deploy Function ឡើងវិញ។
- `Netlify មិនទាន់មាន Cookie/Token` — មិនមាន auth variable ដែល proxy អាចប្រើ។
- `ZTO ឆ្លើយតបយឺតពេក` — upstream timeout; កុំប្តូរ Cookie មុនសាកល្បងម្ដងទៀត។
- `Lookup កំពុងរវល់` — មាន request ដល់ពិដាន; manual fallback នៅតែប្រើបាន។

## ហេតុអ្វីមិនឱ្យ Netlify login Argus ជំនួសដោយស្វ័យប្រវត្តិ?

Login page របស់ `argus.ztoglobal.com` និង ZoeW នៅ domain ខុសគ្នា។ Browser មិន
អនុញ្ញាតឱ្យ ZoeW/Netlify page អាន ឬផ្ទេរ session cookie របស់ Argus ដោយផ្ទាល់ទេ។
ការធ្វើ server-side password automation ត្រូវរក្សាទុក password/MFA និងពឹងលើ
login endpoint ដែលមិនបានឯកសារផ្លូវការ; វាងាយខូចពេល captcha, MFA ឬ flow ប្រែ
ហើយបង្កើនហានិភ័យបាត់គណនី។ ដូច្នេះកូដនេះមិនធ្វើ password-bot ទេ។

ដំណោះស្រាយដែលមានស្ថេរភាពគឺស្នើ ZTO ឱ្យផ្តល់ API credential/service account
ផ្លូវការ រួចប្រើ `ZTO_AUTHORIZATION` ឬ `ZTO_TOKEN`។ រហូតដល់ ZTO ផ្តល់វា
`ZTO_COOKIE` នៅតែជាវិធី fallback ដែលត្រូវ refresh ពេល session ចប់។
