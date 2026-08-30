# កំណត់ ZTO Lookup សម្រាប់ ZoeW

## ១. Deploy ZoeW ទៅ Netlify

Deploy ថត `ZoeW` ដូចធម្មតា។ `netlify.toml` បានកំណត់ថត Function រួចហើយ។

## ២. បង្កើត Proxy Key

បង្កើតអក្សរចៃដន្យវែងយ៉ាងតិច 32 តួ ហើយបន្ថែមក្នុង Netlify:

`Site configuration → Environment variables`

| Variable | តម្លៃ |
| --- | --- |
| `ZTO_PROXY_KEY` | អក្សរចៃដន្យវែង 32 តួឡើងទៅ |

## ៣. កំណត់ ZTO authentication នៅ server

ប្រើ API credential ផ្លូវការរបស់ ZTO ប្រសិនបើមាន។ បន្ថែម variable ដែលត្រូវនឹង credential:

| Variable | ប្រើនៅពេល |
| --- | --- |
| `ZTO_AUTHORIZATION` | ZTO ប្រើ header `Authorization` |
| `ZTO_TOKEN` | ZTO ប្រើ token header ផ្សេង |
| `ZTO_TOKEN_HEADER` | ឈ្មោះ header សម្រាប់ `ZTO_TOKEN` (លំនាំដើម `X-Access-Token`) |
| `ZTO_COOKIE` | ប្រើបណ្ដោះអាសន្នតែពេល ZTO មាន browser session ប៉ុណ្ណោះ |
| `ZTO_REQUEST_HEADERS_JSON` | headers បន្ថែមជាទម្រង់ JSON object |

ឧទាហរណ៍ headers បន្ថែម៖

```json
{"X-Company-Code":"...","X-Language":"km-KH"}
```

កុំដាក់ ZTO credential ក្នុង `app.js`, ក្នុង GitHub ឬក្នុងប្រអប់ config របស់ ZoeW។ Browser cookie អាចផុតកំណត់ ហើយត្រូវជំនួសនៅ Netlify ពេល ZTO បញ្ចប់ session។

## ៤. កំណត់ក្នុង ZoeW

ចូល `API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ` ហើយដាក់៖

| វាល | តម្លៃ |
| --- | --- |
| URL API | `/.netlify/functions/zto-order-detail?barcode={barcode}` |
| ឈ្មោះ Header | `X-Zoe-Proxy-Key` |
| តម្លៃ Header | តម្លៃដូច `ZTO_PROXY_KEY` |
| Field លេខទូរស័ព្ទ | `phone` |
| Field COD | `cod` |
| Field DOD | `dod` |

ចុច `សាកល្បង` ហើយបញ្ចូល barcode។ Function នឹងផ្ញើទៅ ZTO ជា៖

```json
{"billCode":"លេខ barcode","countryCode":"KH"}
```

## ការគណនា field

- `phone` ← `data.consigneePhone` ឬ `data.consigneeMobile`
- `cod` ← `data.agentAmount`
- `dod` ← `data.arrivalServiceCharge`

បើ DOD របស់អាជីវកម្មអ្នកមិនមែន `arrivalServiceCharge` សូមកែ mapping ក្នុង `netlify/functions/zto-order-detail.js` មុន deploy។
