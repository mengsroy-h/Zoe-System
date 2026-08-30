# កំណត់ ZTO Lookup សម្រាប់ ZoeW (វិធីងាយ)

Setup របស់ ZTO Argus នេះត្រូវការ **តែ Cookie មួយ** សម្រាប់ចូល ZTO និង
**Proxy Key មួយ** សម្រាប់ការពារ Function របស់ ZoeW។

## ១. យក Cookie ថ្មីពី ZTO

1. Login ទៅ `https://argus.ztoglobal.com`។
2. ចុច `F12` → `Network`។
3. Filter ពាក្យ `order/detail` ហើយស្កេន/ស្វែងរក barcode មួយ។
4. ចុច request `scan/get/order/detail` → `Headers` → `Request Headers`។
5. ចម្លងតម្លៃ Cookie **ទាំងមូល** ដែលចាប់ផ្តើម៖

```text
BOS-MAN-SESSION=...
```

កុំផ្ញើ Cookie ក្នុង chat, screenshot ឬ commit ទៅ GitHub។ បើ Cookie ធ្លាប់
បង្ហាញសាធារណៈ សូម Logout រួច Login ថ្មីមុនចម្លង។

## ២. ដាក់ Environment Variables ក្នុង Netlify

ចូល `Netlify → ZoeW site → Site configuration → Environment variables` ហើយ
បន្ថែមតែ ២៖

| Key | Value |
|---|---|
| `ZTO_COOKIE` | `BOS-MAN-SESSION=...` ទាំងមូលពី Request Headers |
| `ZTO_PROXY_KEY` | ពាក្យសម្ងាត់ចៃដន្យដែលអ្នកបង្កើត 32–64 តួ |

`ZTO_PROXY_KEY` មិនមែនបានពី ZTO ទេ—អ្នកបង្កើតវាដោយខ្លួនឯង។ ក្រោយ Save
variables ចូល `Deploys` → `Trigger deploy` → `Deploy site`។

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

ធីក `Fast Mode សម្រាប់ ZTO Lookup` ដើម្បីឱ្យ barcode ដែលបានរកឃើញរួចក្នុងរយៈពេល ១០ នាទី
បំពេញភ្លាមនៅពេលស្កេនម្តងទៀត។ Fast Mode រក្សាតែក្នុង memory មិនរក្សាទិន្នន័យ
ZTO ក្នុង Service Worker cache ទេ ហើយមានពិដាន ៣០០ barcode។

Proxy រង់ចាំ ZTO អតិបរមា ១២ វិនាទី ហើយ ZoeW រង់ចាំ proxy ១៦ វិនាទី មុន
retry។ Response ទៅ browser មានតែ `phone`, `cod`, `dod`, `barcode`, `success`;
វាមិនបញ្ជូនឈ្មោះ និងអាសយដ្ឋានអតិថិជនដែល UI មិនប្រើទេ។

ចុច `សាកល្បង` ហើយបញ្ចូល barcode។ Function នឹងផ្ញើទៅ ZTO ជា៖

```json
{"billCode":"លេខ barcode","countryCode":"KH"}
```

## ការគណនា field

- `phone` ← `data.consigneePhone` ឬ `data.consigneeMobile`
- `cod` ← `data.agentAmount`
- `dod` ← `data.arrivalServiceCharge`

បើ DOD របស់អាជីវកម្មអ្នកមិនមែន `arrivalServiceCharge` សូមកែ mapping ក្នុង `netlify/functions/zto-order-detail.js` មុន deploy។

## ពេលវាឈប់ដំណើរការ

Cookie របស់ ZTO អាចផុតកំណត់ពេល session ចប់ ឬអ្នក Logout។ ពេល lookup បង្ហាញ
ថា ZTO បដិសេធ request៖ Login ZTO ថ្មី → យក `BOS-MAN-SESSION=...` ថ្មី →
Replace `ZTO_COOKIE` ក្នុង Netlify → Trigger deploy ម្តងទៀត។

### សម្រាប់អនាគតប៉ុណ្ណោះ

បើ ZTO ផ្តល់ API credential ផ្លូវការ អាចប្រើ `ZTO_AUTHORIZATION` ឬ
`ZTO_TOKEN` ជំនួស Cookie។ Setup បច្ចុប្បន្នរបស់អ្នកមិនត្រូវការវាទេ។
