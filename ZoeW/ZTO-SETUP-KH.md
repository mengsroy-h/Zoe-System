# កំណត់ ZTO Auto-login សម្រាប់ ZoeW

ZoeW ហៅ ZTO តាម Netlify Function។ Username, Password, Cookie និង Token ស្ថិតតែ
server-side ក្នុង Netlify មិនចូលក្នុងកូដ static ឬ browser របស់អ្នកប្រើទេ។ ពេល
session ផុតកំណត់ Function បើក Chromium ចូល `argus.ztoglobal.com` តាម ZTO IDaaS,
យក session ថ្មី រក្សាទុកដោយ AES-256-GCM ក្នុង Netlify Blobs ហើយសាក lookup ម្តងទៀត។

> ប្រើតែគណនីដែលអ្នកមានសិទ្ធិ និងដែល ZTO/ក្រុមហ៊ុនរបស់អ្នកអនុញ្ញាតឱ្យ automation។
> បើមាន official API token ឬ service account សូមប្រើវាជម្រើសដំបូង ព្រោះវាមាន
> ស្ថេរភាពជាង web login។

## ១. ដាក់ Environment Variables ក្នុង Netlify

ចូល `Netlify → ZoeW site → Project configuration → Environment variables` ហើយដាក់៖

| Key | ត្រូវការ | Value |
| --- | --- | --- |
| `ZTO_PROXY_KEY` | ចាំបាច់ | តម្លៃចៃដន្យ 32–64 តួ សម្រាប់ការពារ Function |
| `ZTO_AUTO_LOGIN` | ចាំបាច់សម្រាប់ auto-login | `true` |
| `ZTO_USERNAME` | ចាំបាច់សម្រាប់ auto-login | Username ដែលអ្នកប្រើចូល Argus |
| `ZTO_PASSWORD` | ចាំបាច់សម្រាប់ auto-login | Password របស់គណនី Argus |
| `ZTO_SESSION_ENCRYPTION_KEY` | ចាំបាច់សម្រាប់ auto-login | សោ base64 32-byte ឬ hex 64 តួ |

បង្កើត encryption key ថ្មីនៅម៉ាស៊ីនរបស់អ្នក៖

```bash
openssl rand -base64 32
```

សម្គាល់ `ZTO_PROXY_KEY`, `ZTO_USERNAME`, `ZTO_PASSWORD` និង
`ZTO_SESSION_ENCRYPTION_KEY` ជា **Contains secret values**; scope ឱ្យ Functions
និង production context ដែលត្រូវប្រើ។ កុំដាក់តម្លៃទាំងនេះក្នុង `netlify.toml`,
GitHub, chat ឬ screenshot។ ក្រោយ Save ត្រូវ **Trigger deploy** ម្តង។

បើ repository របស់អ្នកមានថត `ZoeW/` ដូច ZIP នេះ សូមកំណត់ Netlify
**Base directory = `ZoeW`** ដើម្បីឱ្យវាអាន `package.json`, `package-lock.json`
និង `netlify.toml` របស់ App។ ប្រើ Git/CLI deploy ដែលមាន build Functions;
កុំ drag-and-drop តែ static files ព្រោះ Chromium dependencies ត្រូវ bundle។
`netlify.toml` កំណត់ memory 2GB សម្រាប់ Chromium ដែលអាចបង្កើន function billing។

Netlify Blobs ត្រូវបានបង្កើតដោយ Function ដោយស្វ័យប្រវត្តិ; មិនចាំបាច់បង្កើត
database ឬដាក់ access token បន្ថែមទេ។ បើប្តូរ encryption key session ចាស់នឹង
ត្រូវបានរំលង ហើយ Function នឹង login ថ្មី។

### ជម្រើសបន្ថែម

| Key | Default | ន័យ |
| --- | --- | --- |
| `ZTO_COOKIE` | ទទេ | Cookie ដោយដៃ/បណ្ដោះអាសន្ន; បើផុតកំណត់ auto-login នឹង refresh |
| `ZTO_SESSION_COOKIE_NAME` | `BOS-MAN-SESSION` | ប្តូរតែបើ ZTO ប្តូរឈ្មោះ session cookie |
| `ZTO_LOGIN_TIMEOUT_MS` | `30000` | ពិដាន login 15,000–35,000 ms |
| `ZTO_LOGIN_FORM_WAIT_MS` | `12000` | ពេលរង់ចាំទម្រង់ login លេច 5,000–20,000 ms |
| `ZTO_LOGIN_BUDGET_MS` | `20000` | ពិដានពេលសរុបនៃ auto-login ក្នុង Function 5,000–60,000 ms |
| `ZTO_LOGIN_PROXY` | ទទេ | Proxy សម្រាប់ **browser ចូល ZTO** ឧ. `http://host:8080` · `socks5://host:1080` |
| `ZTO_LOGIN_PROXY_USERNAME` | ទទេ | ឈ្មោះអ្នកប្រើរបស់ proxy (បើត្រូវការ) |
| `ZTO_LOGIN_PROXY_PASSWORD` | ទទេ | ពាក្យសម្ងាត់របស់ proxy — សម្គាល់ជា **secret** |
| `ZTO_SESSION_MAX_AGE_MINUTES` | `0` | `0` = គោរព cookie expiry/refresh ពេល ZTO បដិសេធ; អាចកំណត់អាយុខ្លីជាងនេះ |

> ⚠️ **Netlify មានពិដានពេលដំណើរការ Function ផ្ទាល់ខ្លួន** (ជាធម្មតា ១០ វិនាទី
> លំនាំដើម ហើយអាចតម្លើងបាន)។ ការតម្លើង `ZTO_LOGIN_FORM_WAIT_MS` ឬ
> `ZTO_LOGIN_BUDGET_MS` **លើសពិដាននោះ** ធ្វើឲ្យ Netlify សម្លាប់ Function មុនវា
> ឆ្លើយ ➜ browser បង្ហាញ **`Failed to fetch`** ដែលមិនប្រាប់អ្វីសោះ។ បើឃើញសារ
> នោះ សូម **បន្ថយ** តម្លៃទាំងនេះវិញ។

### ការចូលតាម Proxy (ឧ. IP កម្ពុជា)

បើ ZTO IdP ប្រព្រឹត្តខុសគ្នាតាម IP អ្នកអាចបញ្ជូន **browser ចូល** តាម proxy៖

```
ZTO_LOGIN_PROXY=http://<host>:<port>
ZTO_LOGIN_PROXY_USERNAME=<បើត្រូវការ>
ZTO_LOGIN_PROXY_PASSWORD=<បើត្រូវការ>
```

⛔ **Netlify មិនអាចផ្តល់ IP កម្ពុជាដោយខ្លួនវាទេ** — អ្នកត្រូវមាន proxy endpoint
ផ្ទាល់ខ្លួន (VPS នៅកម្ពុជា ឬសេវា proxy) រួចដាក់ URL របស់វាទីនេះ។

⚠️ **វាអនុវត្តលើ browser ចូលតែប៉ុណ្ណោះ** — សំណើ `scan/get/order/detail`
ក្រោយចូល នៅតែចេញពី IP របស់ Netlify ដដែល។ បើ ZTO ទប់ **API** តាម IP ដែរ
នោះ proxy នេះមិនគ្រប់គ្រាន់ទេ។

ក្រោយកំណត់ រកបន្ទាត់ `[zto-session]` ក្នុង Function log — វាត្រូវផ្ទុក
`proxy=<host>` ជាភស្តុតាងថា proxy កំពុងប្រើពិត។ ⛔ ពាក្យសម្ងាត់ proxy
**មិនចូល log ទេ**។

## ២. លំដាប់ auth និង fallback

Proxy ប្រើ auth តាមលំដាប់នេះ៖

1. `ZTO_AUTHORIZATION` — official Authorization ពី ZTO។
2. `ZTO_TOKEN` (+ `ZTO_TOKEN_HEADER` បើ ZTO បញ្ជាក់) — official API token។
3. `ZTO_COOKIE` — Cookie ដោយដៃ បើបានកំណត់។
4. Session ដែល auto-login បង្កើត — ពេលមិនមាន auth ខាងលើ។

បើ `ZTO_COOKIE` ឬ auto session ត្រូវ ZTO បដិសេធ ហើយ `ZTO_AUTO_LOGIN=true`,
Function login ថ្មី **តែម្តង** រួចសាក order lookup **តែម្តង**។ វាមិនធ្វើ login
loop ទេ។ Official Authorization/Token ដែលត្រូវបដិសេធមិនត្រូវបានជំនួសដោយ
password login ដោយស្ងាត់ទេ។

អ្នកអាចលុប `ZTO_COOKIE` ទាំងស្រុងក្រោយកំណត់ auto-login រួច។ កុំលុប
`ZTO_PROXY_KEY` ព្រោះវាជាសោរវាង ZoeW និង Function។

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
បំពេញភ្លាម។ Fast Mode រក្សាតែក្នុង memory និងមានពិដាន ៣០០ barcode។

Manual fallback ១.៨វិនាទីនៅដដែល៖ ពេល login/lookup កំពុងបន្ត វាលលេខទូរស័ព្ទ
ទទួល focus ឱ្យវាយដោយដៃបាន។ Request មិនត្រូវបានបោះបង់ ហើយលទ្ធផលនឹងបំពេញ
ពេលមកដល់ ប្រសិនបើវាលនៅទទេ។ Lookup ដំបូងដែលមិនទាន់មាន session អាចចំណាយ
ពេលរហូតដល់ប្រហែល 30–45វិនាទី; lookup បន្ទាប់ប្រើ session ដែល encrypt ទុក ហើយលឿនជាង។

## ៤. អ្វីដែល Function រក្សា និងបញ្ជូន

- Netlify Secret Environment Variables រក្សា Username/Password/encryption key។
- Netlify Blobs រក្សាតែ session envelope ដែល encrypt ដោយ AES-256-GCM។
- Login lock ទប់ invocation ច្រើនកុំឱ្យបើក Chromium/login ស្ទួនក្នុងពេលតែមួយ។
- Failure backoff ទប់ password ខុស, CAPTCHA ឬ MFA កុំឱ្យបាញ់ login ជារង្វិលជុំ។
- Browser ទទួលតែ `phone`, `cod`, `dod`, `barcode`, `success`; មិនទទួល Cookie,
  Username, Password, ឈ្មោះ ឬអាសយដ្ឋានអតិថិជនទេ។

Function ផ្ញើទៅ ZTO ជា៖

```json
{"billCode":"លេខ barcode","countryCode":"KH"}
```

Field mapping៖

- `phone` ← `data.consigneePhone` ឬ `data.consigneeMobile`
- `cod` ← `data.agentAmount`
- `dod` ← `data.arrivalServiceCharge`

## ៥. CAPTCHA, MFA និងកំហុស

Auto-login **មិនដោះ ឬ bypass CAPTCHA/MFA/security verification** ទេ៖

- `ZTO ទាមទារ CAPTCHA/MFA` — ចូល Argus ដោយដៃ ហើយបើចាំបាច់ដាក់
  `ZTO_COOKIE` ជា fallback; ឬស្នើ ZTO ឱ្យផ្តល់ API token/service account។
- `ZTO បដិសេធ Username/Password` — កែ Netlify Secrets; កុំ retry ច្រើនដង។
- `Auto-login មិនទាន់កំណត់ពេញលេញ` — ពិនិត្យ variables ចាំបាច់ទាំង ៥ និង
  encryption key។
- `Auto-login មិនអាចបង្កើត session` — មើល Netlify Function logs; secret value
  មិនត្រូវបានដាក់ក្នុង response ទេ។
- `ZTO session នៅតែមិនត្រឹមត្រូវ` — login បាន cookie ថ្មី ប៉ុន្តែ ZTO នៅតែ
  បដិសេធ; ពិនិត្យឈ្មោះ cookie/សិទ្ធិគណនី ឬប្រើ official token។

## ៦. អាន `reason` ក្នុងសារកំហុស (តាំងពីកំណែ 2.24.2)

រាល់សារ 503/502 របស់ auto-login ភ្ជាប់មកជាមួយវាល **`reason`** ដែលប្រាប់ថា
**ជាប់ត្រង់ណា** — មិនមែនត្រឹមកូដទូទៅទេ។ ការធ្លាក់ដដែលក៏ត្រូវសរសេរចូល
**Netlify Function log** ជាមួយបុព្វបទ `[zto-session] `។

### `ZTO_SESSION_STORE_UNAVAILABLE` — Netlify Blobs

| `reason` | មានន័យ | ត្រូវធ្វើអ្វី |
| --- | --- | --- |
| `getstore:MissingBlobsEnvironmentError` | Function រកព័ត៌មានតភ្ជាប់ Blobs មិនឃើញ | ត្រូវ deploy កំណែ 2.24.2 ឡើងទៅ (វាហៅ `connectLambda(event)`); បើនៅតែឃើញ សូមពិនិត្យថា Netlify **Base directory = `ZoeW`** និង deploy តាម Git/CLI មិនមែន drag-and-drop |
| `import:ERR_MODULE_NOT_FOUND` | `@netlify/blobs` មិនត្រូវបាន bundle ចូល Function | ពិនិត្យ `package.json` + `package-lock.json` និង build log |
| `read:…` · `write:…` · `lock:…` | Blobs ឆ្លើយជាកំហុស | មើល Function log; ជាធម្មតាបណ្ដោះអាសន្ន |

⛔ **ចាប់ពី 2.24.2 ការដាច់ Blobs លែងធ្វើឲ្យ lookup ស្លាប់ទាំងស្រុងទេ** —
Function ធ្លាក់ចុះទៅ session **ក្នុងសតិ** របស់ container នោះ។ វានៅតែដើរ
តែ login ញឹកញាប់ជាង ➜ សូមកែ Blobs ឲ្យដើរវិញដដែល។

### `ZTO_LOGIN_UNAVAILABLE` — ផ្លូវ login / IDaaS OAuth2

| `reason` | មានន័យ | ត្រូវធ្វើអ្វី |
| --- | --- | --- |
| `host:<hostname>` | IDaaS redirect ទៅ host ដែល **មិនស្ថិតក្នុងបញ្ជីអនុញ្ញាត** | ពិនិត្យថា host នោះជារបស់ ZTO ពិត រួចបន្ថែមវាចូល `ALLOWED_LOGIN_HOSTS` ក្នុង `netlify/lib/zto-session.js` |
| `scheme:http` | Redirect ចេញពី HTTPS | ⛔ កុំបន្ថូរ — ជាសញ្ញាមិនល្អ |
| `form:username-N` · `form:password-N` · `form:button-N` | ZTO ប្តូរទម្រង់ login (រកឃើញ `N` ធាតុជំនួស ១) | ត្រូវកែ selector ក្នុង `findUsernameInput()` / `findPasswordInput()` / `findLoginButton()` |
| `login:<ErrorName>` | កំហុសផ្សេងក្នុង Chromium | មើល Function log |

> **អំពី OAuth2 របស់ ZTO** ៖ បញ្ជីអនុញ្ញាតពិនិត្យតែ **hostname** —
> path និង query ដែលវែង និងប្រែរាល់ដង (រួមទាំង `=km`) **មិនមានបញ្ហាទេ**។
> ការបើក `iam-web.zto.com` ដោយផ្ទាល់មិនចូល ជារឿង **ធម្មតា** ៖ IdP ត្រូវការ
> OAuth2 parameter ដែល `argus.ztoglobal.com` ជាអ្នកផ្តល់។ ដូច្នេះ Function
> ចាប់ផ្តើមពី `argus.ztoglobal.com` ជានិច្ច រួចដើរតាម redirect។

Login UI របស់ ZTO អាចប្រែដោយ ZTO ដោយគ្មានការជូនដំណឹង។ កូដនេះផ្ទៀងផ្ទាត់
តែ HTTPS host ដែលបានកំណត់ និងឈប់ដោយសុវត្ថិភាពបើ form/redirect មិនដូចការរំពឹង។
