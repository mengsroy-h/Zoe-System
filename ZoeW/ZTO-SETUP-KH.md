# កំណត់ ZTO Lookup សម្រាប់ ZoeW

ZoeW ស្កេន Barcode រួចទាញ **លេខទូរស័ព្ទ · COD · DOD** ពី ZTO តាម Netlify
Function មួយ (`/.netlify/functions/zto-order-detail`)។ Cookie និង Token ស្ថិត
**តែខាង server** ក្នុង Netlify — មិនចូលក្នុងកូដ static ឬ browser របស់អ្នកប្រើទេ។

មានផ្លូវ auth **២** ប៉ុណ្ណោះ (តាំងពីកំណែ 2.25.0)៖

| # | ផ្លូវ | ប្រើពេលណា |
| --- | --- | --- |
| ១ | **API ផ្លូវការ** — `ZTO_AUTHORIZATION` ឬ `ZTO_TOKEN` | ពេល ZTO ផ្តល់ API ឲ្យអ្នក (**ល្អបំផុត**) |
| ២ | **Cookie** — Netlify Blobs (`site:zto-auth/cookie`) ឬ `ZTO_COOKIE` | ពេលនៅមិនទាន់មាន API — Windows helper (ណែនាំ) ឬ DevTools fallback |

> ⚡ **តាំងពី 2026-09-02 ការប្តូរ Cookie លែងត្រូវការ redeploy** — helper
> សរសេរវាចូល **Netlify Blobs** ដែល Function អានពេលមានសំណើ។ `ZTO_COOKIE`
> ក្លាយជា **ផ្លូវបម្រុង** ពេលអានចេញពី Blobs មិនបាន។

---

## ១. Environment Variables ក្នុង Netlify

ចូល `Netlify → ZoeW site → Project configuration → Environment variables`។

### បើប្រើ Windows Cookie helper — ដាក់តែ ២ Key

ចុច **Add a variable** ហើយបង្កើត variable ២ ដាច់ដោយឡែក៖

`setup.cmd` អាចរត់មុន ឬក្រោយការបង្កើត env ទាំងនេះ៖ វាត្រូវការតែ Site ID +
PAT។ `ZTO_PROXY_KEY` គឺសម្រាប់ ZoeW ហៅ Function មិនមែនសម្រាប់ `setup.cmd` ទេ។

| Key | Value | Secret | Scope | Context |
| --- | --- | --- | --- | --- |
| `ZTO_PROXY_KEY` | តម្លៃចៃដន្យ ៣២ bytes — សោរវាង ZoeW និង Function | ✅ | **Functions** | **Production** |
| `ZTO_COOKIE` | **ស្រេចចិត្ត** — ផ្លូវបម្រុងពេល Blobs ដាច់ | ✅ | **Functions** | **Production** |

⛔ **កុំលុប `ZTO_COOKIE` ដែលមានស្រាប់ចេញ** — Function ប្រើវាពេលអានចេញពី
Blobs មិនបាន។ បើវាមិនទាន់មាន ក៏មិនចាំបាច់បង្កើតដែរ ៖ helper សរសេរចូល Blobs
ដោយផ្ទាល់ ហើយ lookup ដើរភ្លាមក្រោយការសរសេរនោះ។

បង្កើត `ZTO_PROXY_KEY` លើ Windows PowerShell៖

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes)
```

⛔ កុំដាក់ `NETLIFY_AUTH_TOKEN`, `NETLIFY_ACCOUNT_ID`, `NETLIFY_SITE_ID` ឬ
`ZTO_COOKIE_UPDATE_KEY` ក្នុង Netlify env។ Site ID និង PAT របស់ helper រស់តែ
លើ Windows។ សម្រាប់ផ្លូវ Cookie ក៏មិនចាំបាច់បង្កើត `ZTO_API_URL` ឬ
`ZTO_REQUEST_*` ដែរ។ បើមាន `ZTO_AUTHORIZATION`/`ZTO_TOKEN` ចាស់ សូមលុបវា
ព្រោះវាមានអាទិភាពលើ Cookie។

### បើប្រើ API ផ្លូវការ — `ZTO_PROXY_KEY` បូក **មួយ** ក្នុងចំណោមនេះ

| Key | ប្រើសម្រាប់ |
| --- | --- |
| `ZTO_AUTHORIZATION` | តម្លៃពេញរបស់ header `Authorization` ពី ZTO (ឧ. `Bearer eyJ...`) |
| `ZTO_TOKEN` + `ZTO_TOKEN_HEADER` | Token ដែល ZTO ដាក់ក្នុង header ផ្សេង (លំនាំដើម `X-Access-Token`) |
| `ZTO_COOKIE` | ផ្លូវ fallback ប៉ុណ្ណោះ; Windows helper គឺជាផ្លូវណែនាំខាងលើ |

លំដាប់អាទិភាព ៖ **`ZTO_AUTHORIZATION` ➜ `ZTO_TOKEN` ➜ `ZTO_COOKIE`**។

សម្គាល់តម្លៃទាំងអស់នេះជា **Contains secret values**, scope **Functions** និង
context **Production**។ កុំដាក់វាក្នុង `netlify.toml`, GitHub, chat ឬ
screenshot។ ក្រោយ Save ត្រូវ **Trigger deploy** ម្តង។

> ℹ️ **Netlify Base directory ត្រូវជា `ZoeW`** ដើម្បីឲ្យវាឃើញ `netlify.toml`
> និង `netlify/functions/`។ Function មាន dependency **តែមួយ**
> (`@netlify/blobs` — វាស់បាន bundle ៣៧.៦ KB, ផ្ទុក ~២.៣ ms) ➜ Function
> ទាំងមូល **៦៧.៧ KB** ➜ cold start នៅតែលឿន។

---

## ២. Windows — ប្តូរ Cookie ដោយមិនប្រើ DevTools (**ណែនាំ**)

ឧបករណ៍ `tools/zto-cookie-sync-windows/` បើក Edge/Chrome profile ដាច់ដោយឡែក
លើកុំព្យូទ័ររបស់អ្នក ហើយចាប់បន្ទាត់ `Cookie:` ពី **Order Detail request ពិត**
ទៅ `aargus-api.ztoglobal.com`។ បន្ទាប់មកវាសរសេរ Cookie ចូល **Netlify Blobs**
(store `site:zto-auth`, key `cookie` — បច្ច័យ `site:` ជាឈ្មោះខាងក្នុងរបស់
`@netlify/blobs`) ➜ ⛔ **គ្មាន deploy ថ្មី**។

វា **មិនប្រើ** `document.cookie`, `chrome.cookies` extension API ឬ Chromium
ក្នុង Netlify Function ទេ។

### Setup ម្តងដំបូង

១. ត្រូវមាន **Windows 10/11 · Edge ឬ Chrome · Node.js 22.17.0+**។
២. បង្កើត **Netlify Personal Access Token** នៅ
   `User settings → Applications → Personal access tokens` ហើយយក ZoeW
   **Site ID** ពី `Project configuration → General → Project details`។
៣. Download/Clone repo រួចបើកថត `tools/zto-cookie-sync-windows/`។
៤. Double-click **`setup.cmd`** ➜ បញ្ចូល Site ID និង PAT ក្នុង prompt លាក់អក្សរ។
៥. ឃើញ `OK: setup is complete` គឺចប់។ ⛔ សារក្នុង cmd ជាភាសាអង់គ្លេស
   ទាំងអស់ (សំណើអ្នកប្រើ 2026-09-02) ព្រោះ `cmd.exe` បង្ហាញខ្មែរបែកបាក់។

### រាល់ពេល Cookie ផុត

១. Double-click **`sync-zto-cookie.cmd`**។
២. បើ ZTO សុំ សូម Login ក្នុង Edge/Chrome ដែលវាបើក។
៣. បើក ឬស្វែងរកកញ្ចប់ណាមួយក្នុង Argus ដើម្បីបង្កើត Order Detail request។
៤. ឧបករណ៍បិទ browser ➜ សរសេរ Cookie ចូល Netlify Blobs ➜ ចប់។
   ⛔ **មិនចាំបាច់ redeploy** — ការស្កេនថ្មីប្រើវាក្នុងរយៈពេលមួយនាទី
   (ការឆ្លើយ 401 ពី ZTO កាត់ការរង់ចាំនោះភ្លាម)។

⚡ **តាំងពី 2026-09-02ខ ៖ ជាញឹកញាប់មិនបាច់ចុចអ្វីសោះ** — ការចាប់ដើរតាម
**host** មិនមែន path ➜ ត្រឹមតែបើក Argus គឺវាចាប់បាន។

**របៀបផ្សេងទៀត** (ត្រូវការ Site URL + `ZTO_PROXY_KEY` ក្នុង `setup.cmd`)៖

| ពាក្យបញ្ជា | ធ្វើអ្វី |
| --- | --- |
| `sync-zto-cookie.cmd --check` | ប្រាប់សុខភាព Cookie **ដោយមិនបើក browser** |
| `sync-zto-cookie.cmd --auto` | បើ Cookie នៅដំណើរការ ➜ **មិនបើក browser សោះ** |
| `schedule-zto-cookie.cmd` | ដំឡើង Windows Task ឲ្យរត់ `--auto` រាល់ពេលចូល Windows |

ក្រោយយក Cookie រួច helper **ផ្ទៀងផ្ទាត់ខ្លួនឯង** តាម `?diag=1` ដោយប្រៀបធៀប
fingerprint ➜ `OK: verified - the Function is using the new cookie (source: blob, …)`។

Cookie **បង្ហាញក្នុង console ដោយចេតនា** (សំណើអ្នកប្រើ 2026-09-02 — ងាយ
ស្រួល paste ចូល `ZTO_COOKIE` ជាផ្លូវបម្រុង) តែវាមិនសរសេរចូល file/config
និងមិនចូល shell history ទេ។ ⛔ **PAT និង `ZTO_PROXY_KEY` មិនបង្ហាញសោះ។**
PAT ត្រូវអ៊ិនគ្រីបដោយ **Windows DPAPI / CurrentUser** ក្នុង
`%LOCALAPPDATA%` — មិនដាក់ក្នុង command line, repo, extension ឬ Netlify
Function។ សេចក្តីណែនាំពេញ និងព្រំដែនសិទ្ធិរបស់ PAT៖
[`tools/zto-cookie-sync-windows/README-KH.md`](../tools/zto-cookie-sync-windows/README-KH.md)។

> ⚠️ បើ ZTO SSO ផុតទាំងស្រុង អ្នកនៅតែត្រូវ Login ម្តងក្នុង browser profile
> ពិសេស។ អ្វីដែលត្រូវដកចេញគឺ F12 · Copy/Paste · Netlify UI និង Trigger deploy
> ដោយដៃ មិនមែនការផ្ទៀងផ្ទាត់អត្តសញ្ញាណរបស់ ZTO ទេ។

---

## ២ខ. ផ្លូវដោយដៃ (fallback)

បើ Windows helper មានបញ្ហា៖

១. បើក `https://argus.ztoglobal.com` ក្នុង browser រួចចូលប្រព័ន្ធ។
២. `F12` ➜ **Network** ➜ បើក/ស្វែងរកកញ្ចប់មួយ។
៣. ជ្រើសសំណើទៅ `aargus-api.ztoglobal.com/scan/get/order/detail` ➜
   **Request Headers** ➜ ចម្លងតម្លៃពេញរបស់ `Cookie:`។
៤. ដាក់ចូល `ZTO_COOKIE` ក្នុង Netlify ➜ Save ➜ **Trigger deploy**
   (ផ្លូវ env នេះនៅតែត្រូវការ deploy — មានតែផ្លូវ Blobs ទេដែលមិនត្រូវការ)។

---

## ២គ. ផ្លូវដែលបានសាកហើយ — កុំនាំត្រឡប់មកវិញ

| ផ្លូវ | លទ្ធផលលើឧបករណ៍/ផលិតកម្មពិត |
|---|---|
| Chromium auto-login ក្នុង Netlify | ❌ ZTO IDaaS មិនបើកឲ្យ IP របស់ Netlify |
| Chrome/Edge extension `chrome.cookies` | ❌ លើ Edge របស់អ្នក `getAll({})` ត្រឡប់ ០ ខណៈ DevTools ឃើញ Cookie ៥ |
| Windows helper ថ្មី | ចាប់ **Request Header ពិតតាម Playwright/CDP** ក្នុង browser ដែលវាបើកផ្ទាល់ — មិនឆ្លង `chrome.cookies` API |

⛔ កុំសាង extension ចាស់ ឬ server-side auto-login ឡើងវិញ។ Windows helper
ត្រូវនៅក្រោម `tools/` កម្រិត root ដើម្បីកុំឲ្យវាចូល bundle/publish របស់ ZoeW។

---

## ៣. បំពេញក្នុង ZoeW

របា Slide ⚙️ ➜ **🔌 API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ**៖

| វាល | តម្លៃ |
| --- | --- |
| URL API | `/.netlify/functions/zto-order-detail?barcode={barcode}` |
| ឈ្មោះ Header | `X-Zoe-Proxy-Key` |
| តម្លៃ Header | តម្លៃដូច `ZTO_PROXY_KEY` ក្នុង Netlify |
| Field លេខទូរស័ព្ទ | `phone` |
| Field COD | `cod` |
| Field DOD | `dod` |

ធីក **`Fast Mode សម្រាប់ ZTO Lookup`** ដើម្បីឲ្យ barcode ដែលរកឃើញរួចក្នុង
១០ នាទី បំពេញ **ភ្លាមៗ ០ ms**។ វារក្សាតែក្នុងសតិ និងមានពិដាន ៣០០ barcode។

Manual fallback **១.៨ វិនាទី** នៅដដែល៖ ខណៈ lookup កំពុងដំណើរការ វាលលេខ
ទូរស័ព្ទទទួល focus ឲ្យវាយដោយដៃបាន។ សំណើមិនត្រូវបោះបង់ទេ ហើយលទ្ធផលនឹងបំពេញ
ពេលមកដល់ **ប្រសិនបើវាលនៅទទេ**។

---

## ៤. ពេល ZTO ផ្តល់ **API ផ្លូវការ**

Function ត្រូវបានសរសេរឲ្យ **សម្របទៅនឹងទម្រង់ API ណាក៏បាន** ដោយ
**មិនចាំបាច់កែកូដ** — គ្រប់យ៉ាងកំណត់តាម Environment Variables។

| Key | Default | ន័យ |
| --- | --- | --- |
| `ZTO_API_URL` | `https://aargus-api.ztoglobal.com/scan/get/order/detail` | Endpoint ពិត (ត្រូវជា **https**) |
| `ZTO_API_METHOD` | `POST` | `POST` ឬ `GET` |
| `ZTO_REQUEST_BODY_JSON` | `{"billCode":"{barcode}","countryCode":"KH"}` | តួសំណើ (POST) — `{barcode}` ត្រូវជំនួសដោយលេខពិត |
| `ZTO_REQUEST_QUERY_PARAM` | `billCode` | ឈ្មោះ query param (GET) |
| `ZTO_REQUEST_HEADERS_JSON` | ទទេ | Header បន្ថែម ឧ. `{"X-App-Key":"...","X-Sign":"..."}` |
| `ZTO_FIELD_PHONE` | បញ្ជីលំនាំដើម | ផ្លូវ field លេខទូរស័ព្ទ បំបែកដោយ `,` (ឧ. `data.receiverMobile`) |
| `ZTO_FIELD_COD` | បញ្ជីលំនាំដើម | ផ្លូវ field COD |
| `ZTO_FIELD_DOD` | បញ្ជីលំនាំដើម | ផ្លូវ field DOD |
| `ZTO_FIELD_BARCODE` | បញ្ជីលំនាំដើម | ផ្លូវ field លេខបាកូដ |
| `ZTO_SEND_BROWSER_HEADERS` | ស្វ័យប្រវត្តិ | `false` = កុំផ្ញើ `Origin`/`Referer` របស់ Argus |

### អ្វីដែល Function ធ្វើដោយខ្លួនឯង

- **ស្គាល់ទម្រង់ចម្លើយច្រើនបែប** ៖ វារកទិន្នន័យក្នុង `data` · `result` ·
  `data.data` · `result.data` · `body` · `rows` · ឬ **root ផ្ទាល់** ហើយបើ
  មួយក្នុងចំណោមនោះជា **array** វាយកធាតុទី ១។
- **ស្គាល់សញ្ញាជោគជ័យច្រើនបែប** ៖ `success:true` · `result:true` ·
  `status:true` · `code` ជា `0` / `000000` / `200` / `success` / `ok` ·
  ឬ **គ្មាន `code` សោះ**។
- **ស្គាល់ឈ្មោះ field ច្រើនបែប** (មុនអ្នកកំណត់អ្វីទាល់តែសោះ)៖

  | | ឈ្មោះដែលសាកតាមលំដាប់ |
  | --- | --- |
  | ទូរស័ព្ទ | `consigneePhone` · `consigneeMobile` · `consigneeTel` · `receiverPhone` · `receiverMobile` · `recipientPhone` · `recipientMobile` · `phone` · `mobile` |
  | COD | `agentAmount` · `codAmount` · `collectionAmount` · `codFee` · `cod` |
  | DOD | `arrivalServiceCharge` · `dodAmount` · `arrivalCharge` · `serviceCharge` · `dod` |
  | Barcode | `billCode` · `waybillNo` · `waybillCode` · `mailNo` · `barcode` |

  ឈ្មោះដែល **អ្នកកំណត់** តាម `ZTO_FIELD_*` ត្រូវសាក **មុន** បញ្ជីលំនាំដើម
  ➜ ការកំណត់ខុសក៏មិនធ្វើឲ្យ lookup ស្លាប់ដែរ។
- ⛔ **ពេលប្រើ Token/Authorization វា *មិន* ផ្ញើ `Origin`, `Referer` និង
  `User-Language` របស់ Argus ទេ** — header ក្លែងបែបនោះអាចធ្វើឲ្យ WAF ឬ CORS
  របស់ API ផ្លូវការបដិសេធសំណើ។ ការផ្ញើវាកើតតែពេលប្រើ **Cookie** ប៉ុណ្ណោះ
  (ឬពេលអ្នកបង្ខំដោយ `ZTO_SEND_BROWSER_HEADERS=true`)។

### ផ្ទៀងផ្ទាត់ថាវាដំណើរការ ១០០% — `?diag=1`

បើក URL នេះក្នុង browser (ត្រូវការ header `X-Zoe-Proxy-Key`, ឬប្រើ `curl`)៖

```bash
curl -H "X-Zoe-Proxy-Key: <ZTO_PROXY_KEY>" \
  "https://<site>.netlify.app/.netlify/functions/zto-order-detail?diag=1"
```

វាឆ្លើយ **ការកំណត់ពិតដែល Function កំពុងប្រើ** ដោយ **គ្មានតម្លៃសម្ងាត់សោះ**៖

```json
{
  "ok": true, "code": "ZTO_DIAG",
  "auth": "cookie",
  "cookie": {
    "source": "blob",
    "fingerprint": "a1b2c3d4",
    "ageMs": 12345,
    "storeReason": null,
    "renewals": 0
  },
  "endpoint": { "host": "...", "path": "...", "method": "POST" },
  "requestHeaders": ["Accept", "Cookie", "..."],
  "browserHeaders": true,
  "fields": { "phone": [...], "cod": [...], "dod": [...], "barcode": [...] },
  "timing": { "upstreamTimeoutMs": 8000, "budgetMs": 14000, "retries": 1, "cacheTtlMs": 60000 },
  "cacheEntries": 0
}
```

⛔ `auth` ត្រូវជា **`authorization`** ឬ **`token`** ពេលប្រើ API ផ្លូវការ។
បើវាឡើង `none` នោះមានន័យថា Function រកមិនឃើញ Cookie ឬ Token សោះ។
`requestHeaders` ជា **ឈ្មោះ header ប៉ុណ្ណោះ** — តម្លៃមិនដែលចេញទេ។

**ប្លុក `cookie` ជាឧបករណ៍ផ្ទៀងផ្ទាត់ផ្លូវ Blobs**៖

| វាល | អត្ថន័យ |
| --- | --- |
| `source` | `blob` = អានពី Netlify Blobs (helper ដើរត្រឹមត្រូវ) · `env` = ធ្លាក់ចុះទៅ `ZTO_COOKIE` · `none` = គ្មានសោះ |
| `fingerprint` | ៨ តួនៃ SHA-256 របស់ Cookie — ⛔ **មិនមែនតម្លៃ Cookie** ទេ; ប្រើដើម្បីមើលថាតម្លៃប្រែឬអត់ |
| `ageMs` | រយៈពេលដែលតម្លៃនេះនៅក្នុង cache សតិ (ពិដាន ៦០ វិនាទី) |
| `storeReason` | មូលហេតុពេលអានចេញពី Blobs មិនបាន (`no-context` · `getstore` · `read:timeout` · `invalid` · `empty` …) |
| `renewals` | ចំនួនដងដែល Cookie ត្រូវបានបន្តអាយុដោយស្វ័យប្រវត្តិពី `Set-Cookie` របស់ Argus |
| `authRejectedAgeMs` | ZTO ទើបបដិសេធ Cookie នេះនៅប៉ុន្មាន ms មុន (`null` = មិនដែលបដិសេធ ឬការស្កេនក្រោយនោះជោគជ័យ) — ជាមូលដ្ឋានរបស់របៀប `--auto` |

⛔ **ក្រោយរត់ `sync-zto-cookie.cmd` ថ្មី ៖ `source` ត្រូវជា `blob`។** បើវានៅ
`env` សូមមើល `storeReason` ➜ វាប្រាប់ថាធ្លាក់ត្រង់ណា។

---

## ៥. ល្បឿន និងស្ថេរភាព

| Key | Default | ន័យ |
| --- | --- | --- |
| `ZTO_UPSTREAM_TIMEOUT_MS` | `6000` | ពិដានពេលក្នុងមួយសំណើទៅ ZTO (2,000–20,000) |
| `ZTO_REQUEST_BUDGET_MS` | `9000` | ថវិកាពេលសរុបរបស់ Function (4,000–24,000)។ ⛔ **កុំតម្លើងលើស ១០,០០០ ដោយគ្មានហេតុផល** — Netlify សម្លាប់ synchronous function នៅ **១០ វិនាទី** ➜ អ្នកប្រើឃើញ `Failed to fetch` ជំនួស JSON ដែលមានឈ្មោះ |
| `ZTO_UPSTREAM_RETRIES` | `1` | ចំនួនព្យាយាមឡើងវិញពេលបណ្តាញដាច់/5xx (0–3) |
| `ZTO_CACHE_TTL_MS` | `60000` | Cache លទ្ធផលខាង server (0 = បិទ; អតិបរមា ១០ នាទី) |
| `ZTO_NOT_FOUND_CACHE_TTL_MS` | `15000` | Cache សាលក្រម «រកមិនឃើញ» (0 = បិទ)។ ខ្លីជាងខាងលើដោយចេតនា ➜ កញ្ចប់ដែល ZTO ទើបបញ្ចូល ត្រូវរកឃើញវិញឆាប់។ វាមិនអាចលើស `ZTO_CACHE_TTL_MS` ទេ |

អ្វីដែលធ្វើឲ្យវាលឿនតាំងពី 2.25.0៖

- **គ្មាន Chromium** ហើយ dependency មានតែ **`@netlify/blobs`** (សម្រាប់
  Cookie store) ➜ bundle តូច (~៦៨ KB) ➜ cold start លឿន។
- **Cache ខាង server ៦០ វិនាទី** ➜ ស្កេន barcode ដដែលម្តងទៀត (ឬឧបករណ៍ ២
  គ្រឿងស្កេនកញ្ចប់ដដែល) ឆ្លើយ **ដោយមិនប៉ះ ZTO សោះ**។
- **Single-flight** ➜ សំណើស្របគ្នាលើ barcode ដដែល **ចែក upstream call តែមួយ**។
- **ព្យាយាមឡើងវិញដោយស្វ័យប្រវត្តិ** លើការដាច់បណ្តាញ និង HTTP 5xx —
  ក្នុងថវិកាពេលដែលធានាថា Function **ឆ្លើយជា JSON ជានិច្ច** មុន Netlify
  សម្លាប់វា ➜ **លែងឃើញ `Failed to fetch`**។
- **ពិដានខាង client ៖ ១៣ វិនាទី** (ស្កេន) និង **១១ វិនាទី** (ប៊ូតុងសាកល្បង) —
  បន្ថយតាមថវិកា server ៩ វិនាទី ក្នុងកំណែ 2.25.8។ ⛔ វាត្រូវនៅ **>= ថវិកា
  server + ៣ វិនាទី** ជានិច្ច (`zto-proxy-test` ចាក់សោ) ➜ ការកែថវិកា server
  ត្រូវកែពិដាន client តាមដែរ។
- **Barcode ដែល ZTO មិនស្គាល់ ឆ្លើយ HTTP 200 `found:false`** មិនមែនកំហុសទេ
  ➜ វា **មិនកេះ cooldown ៣០ វិនាទី** ➜ ស្កេនកញ្ចប់បន្ទាប់បានភ្លាម។
- **ការបន្តអាយុ Cookie មិនទប់ការឆ្លើយតបទៀតទេ (តាំងពី 2.25.7)។** ពេល ZTO
  ផ្ញើ `Set-Cookie` ថ្មី Function សរសេរវាចូល Blobs ក្នុងពិដាន **៩០០ ms**
  (ជំនួស ៣ វិនាទី) ហើយ **រំលងទាំងស្រុងពេលថវិកាជិតអស់** — ការសរសេរបន្ទាប់
  ធ្វើវាជំនួស។ វាស់បាន ៖ ការស្កេនដែលការងារពិតត្រឹម ៥០ ms ធ្លាក់ពី
  **៣,០៥៨ ms ➜ ៩៥៨ ms**។
- **ថវិកាពេលគ្របដណ្តប់ handler ទាំងមូល (តាំងពី 2.25.7)** — ការអាន និងសរសេរ
  Cookie store រាប់ចូលថវិកាដែរ ➜ Function ឆ្លើយ **ក្នុង** `ZTO_REQUEST_BUDGET_MS`
  ជានិច្ច។ វាស់បាន ៖ **១៦,៨១២ ms ➜ ១៣,៨០១ ms** (ការវាស់នោះធ្វើពេលថវិកានៅ ១៤ វិ.;
  លំនាំដើមឥឡូវជា **៩ វិ.** តាមកំណែ 2.25.8)។
  ការអាន Cookie ក៏ **កក់កន្លែងឲ្យការហៅ ZTO យ៉ាងតិច ១ ដង** ➜ store ដែលយឺត
  លែងធ្វើឲ្យការស្កេនធ្លាក់ជា `ZTO_TIMEOUT`។
- **401 ដោយ Cookie ចាស់ក្នុង cache ត្រូវជួសជុលដោយខ្លួនឯង (តាំងពី 2.25.7)។**
  ក្រោយអ្នករត់ `sync-zto-cookie.cmd` instance ដែលនៅកាន់ Cookie ចាស់ក្នុង
  cache ៦០ វិនាទី **អាន Blobs ឡើងវិញ ១ ដង** ហើយសាកម្តងទៀត **តែពេល Cookie
  ប្រែពិត** ➜ ការស្កេនជោគជ័យតែម្តង ជំនួសការឃើញ «🔒 Cookie ZTO ផុតកំណត់»
  រួចរង់ចាំ cooldown ៣០ វិនាទី។ ⛔ បើ Cookie មិនប្រែ ៖ 401 ភ្លាម គ្មានការ
  ហៅ ZTO ស្ទួន។

---

## ៦. សារកំហុស និងអ្វីត្រូវធ្វើ

| `code` | អ្វីអ្នកឃើញក្នុង ZoeW | ត្រូវធ្វើអ្វី |
| --- | --- | --- |
| `ZTO_AUTH_EXPIRED` | 🔒 Cookie ZTO ផុតកំណត់ | រត់ `sync-zto-cookie.cmd` (ផ្នែក ២) ឬពិនិត្យ Token |
| `ZTO_AUTH_NOT_CONFIGURED` | 🔒 Netlify មិនទាន់មាន Cookie ឬ Token | រត់ `sync-zto-cookie.cmd` ឬដាក់ `ZTO_COOKIE`/`ZTO_AUTHORIZATION` |
| `ZTO_CONFIG_INVALID` | ⚙️ Config ZTO មិនត្រឹមត្រូវ | មើលវាល `reason` (ឧ. `api-url:not-https`, `body:invalid-json`) |
| `ZTO_PROXY_NOT_CONFIGURED` | ⚙️ Config ZTO មិនត្រឹមត្រូវ | ភ្លេចដាក់ `ZTO_PROXY_KEY` |
| `ZTO_NOT_FOUND` | ⚠️ ZTO មិនឃើញទិន្នន័យ | Barcode នោះមិនមានក្នុង ZTO ពិត — វាយដោយដៃ |
| `ZTO_RATE_LIMITED` | 🚦 ZTO កំណត់ល្បឿន | រង់ចាំបន្តិច; បន្ថយល្បឿនស្កេន |
| `ZTO_TIMEOUT` · `ZTO_UPSTREAM_UNAVAILABLE` | ⏱️ ZTO ឆ្លើយតបយឺតពេក | បណ្តាញ ឬ ZTO យឺត — ស្កេនម្តងទៀត |
| `ZTO_UPSTREAM_REJECTED` | ⚠️ មិនអាចភ្ជាប់ ZTO បាន | សារពិតរបស់ ZTO នៅក្នុងវាល `error` |
| `ZTO_INVALID_RESPONSE` | ⚠️ មិនអាចភ្ជាប់ ZTO បាន | ZTO ឆ្លើយមិនមែន JSON — ជាធម្មតា Cookie ផុត |

---

## ៧. អ្វីដែល Function បញ្ជូនទៅ browser

**តែប៉ុណ្ណេះ**៖

```json
{ "success": true, "found": true, "barcode": "...", "phone": "...", "cod": 0, "dod": 0, "cached": false }
```

⛔ Cookie, Token, ឈ្មោះអតិថិជន និងអាសយដ្ឋាន **មិនដែលចេញទៅ browser ទេ**។
វាល `reason` របស់សារកំហុសត្រូវច្រោះទាំង ២ ខាង (server និង client) មុនចូល DOM។
