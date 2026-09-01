# 🔁 ឯកសារបញ្ជូនបន្ត — ZTO Cookie ចុច ១ ដង

> **សម្រាប់ session Claude ថ្មីទាំងស្រុង។** អាន `CLAUDE.md` ប្លុក «START HERE» មុន
> រួចអានឯកសារនេះ។ Branch៖ `claude/argus-cookie-extraction-xbh3uc`

---

## ១. បញ្ហាដែលកំពុងដោះស្រាយ

អ្នកប្រើសួរ (2026-09-01)៖ *«តើមានវីធីណាដែលអាចយក cookie ពី argus.ztoglobal.com
ស្រួលជាងចូលយកដោយដៃតាម devtool បានទេ ព្រោះខ្ញុំខ្ចិល រាល់ពេលដែរ cookie អស់
សុពលភាព ខ្ញុំត្រូវចូលទៅយក ពី argus.ztoglobal.com មក trigger deploy ក្នុង netlify»*

ជំហានដោយដៃបច្ចុប្បន្ន៖ ចូល Argus ➜ F12 ➜ Network ➜ ចម្លង `Cookie:` ➜ Netlify
env var ➜ Save ➜ Trigger deploy។

**ដំណោះស្រាយដែលជ្រើស (ផ្លូវទី ១)** ៖ Chrome extension ➜ Function ថ្មី
`zto-cookie-update` ➜ Netlify API (`setEnvVarValue` + `createSiteBuild`)។
➜ នៅសល់ត្រឹម **ចុចរូប extension ១ ដង** ខណៈនៅលើ Argus។

### ⛔ ការវាស់ ២ ដែលធ្វើរួច — កុំវាស់ឡើងវិញ

| សំណួរ | ចម្លើយពិត |
|---|---|
| `document.cookie` លើ Argus? | `__zcat_uuid__` · `ZTO_INTL_BOS_MAN_TOKEN=1` · `perf_dv6Tr4n=1` · `sidebarStatus=0` — **គ្មាន credential ពិត** |
| ដូច្នេះ cookie ពិត? | **`HttpOnly`** — អ្នកប្រើយកវាពី **Response Headers ➜ `Set-Cookie`** |

⛔ **ដូច្នេះ bookmarklet ដើរមិនកើតទេ** — JS អានមិនឃើញ។ ត្រូវប្រើ extension
ដែល `chrome.cookies` API អាន HttpOnly បាន។ **កុំត្រឡប់ទៅ bookmarklet វិញ។**

### ⛔ កុំនាំ auto-login មកវិញ

កំណែ 2.24.2 ➜ 2.24.7 ជាជុំ **៦** ដែលបរាជ័យទាំងអស់ (IdP របស់ ZTO មិនបើកឲ្យ IP
របស់ Netlify)។ មើល `docs/BUG-HISTORY.md` និង CLAUDE.md ផ្នែក 2.25.0។

---

## ២. អ្វីដែល **ធ្វើរួច** (commit លើ branch នេះ)

| ឯកសារ | ស្ថានភាព |
|---|---|
| `ZoeW/netlify/functions/zto-cookie-update.js` | ✅ ថ្មី ~២៨០ បន្ទាត់ · syntax បៃតង |
| `ZoeW/netlify/functions/zto-order-detail.js` | ✅ បន្ថែម `noteUpstreamSetCookie()` + `sessionRenewal` ក្នុង `?diag=1` |
| `tools/zto-cookie-grabber/` | ✅ Chrome extension MV3 (manifest · background · options) |
| `audit-tools/zto-cookie-update-test.js` | ✅ **៦២ assertion — បៃតងទាំងអស់** |

### Netlify API ដែលផ្ទៀងផ្ទាត់រួច

ពី `@netlify/open-api@2.57.1` (spec ផ្លូវការ — npm registry អនុញ្ញាត;
`docs.netlify.com` ត្រូវ egress proxy ទប់)៖

```
PATCH https://api.netlify.com/api/v1/accounts/{account_id}/env/{key}?site_id={site_id}
       body: {"context":"all","value":"<cookie>"}      → setEnvVarValue
POST  https://api.netlify.com/api/v1/sites/{site_id}/builds
       body: {"clear_cache":false}                     → createSiteBuild
Auth:  Authorization: Bearer <NETLIFY_AUTH_TOKEN>
```

### ការការពារដែលសរសេររួច

- **Header injection** — cookie ដែលមាន `CR/LF/NUL` ត្រូវបដិសេធ (`cookie:control-char`)
- **secret-hygiene** — ឆ្លើយតែ **ឈ្មោះ** cookie; តម្លៃ និង token មិនលេច (តេស្តអះអាង)
- **stall-guard** — `timedFetch()` ប្រណាំង timer ពិត + `AbortController` ➜ settle ធានាដោយរចនាសម្ព័ន្ធ
- **toast-truth** — env សរសេរបរាជ័យ ➜ **មិន** trigger deploy និងមិនអះអាង `ok:true`
- **កូនសោដាច់ដោយឡែក** — `ZTO_COOKIE_UPDATE_KEY` ≠ `ZTO_PROXY_KEY` (កូនសោក្រោយរស់ក្នុង client app ➜ សិទ្ធិសរសេរត្រូវខ្លាំងជាង)
- **extension សិទ្ធិតូចបំផុត** — `cookies`+`storage` · host ត្រឹម `ztoglobal.com` · សិទ្ធិលើ Netlify site សុំពេល save
- extension ដាក់នៅ **`tools/` កម្រិត root** ដោយចេតនា ព្រោះ `ZoeW/netlify.toml` មាន `publish = "."` ➜ អ្វីក្រោម `ZoeW/` ត្រូវ publish ឡើង site

---

## ៣. ផ្នែក ៣ — ✅ **ចប់រួច** (2026-09-01)

គ្រប់ចំណុច ក–ច ខាងក្រោមធ្វើរួច។ **គ្រប់ជួរជាការវាស់ មិនមែនការអាន។**

### ក. ✅ checker ធ្លាក់លើ `origin/main` — វាស់រួច

| tree | exit | អ្វីដែលឃើញ |
|---|---|---|
| `origin/main` | **1** | `ជាន់អប្បបរមា៖ រកមិនឃើញ … zto-cookie-update.js` |
| ថតទទេ | **1** | ដដែល |
| tree បច្ចុប្បន្ន | **0** | `✅ 62 ok` |

### ខ. ✅ បន្ថែមចូល `run-all.sh` — **ផ្នែក ២** (រត់ធម្មតា និង baseline)

`checker-coverage.js` ផ្នែក ២ខ បៃតង; checker សរុបឡើងទៅ **111**។

### គ. ✅ `version-bump-scope.js` — ចន្លោះពិតត្រូវបិទ

**វាស់បាន** ៖ មុនកែ ➜ ❌ **ធ្លាក់ ២** (`ZoeW/netlify/functions/*.js` ត្រូវរាប់ជា
កូដ ship ➜ ទាមទារ `CACHE_VERSION` **និង** `APP_VERSION` ឡើង); ក្រោយកែ ➜
✅ «គ្មាន App ណាប្រែធៀបនឹង origin/main»។

ការកែ ២ ផ្នែក **ដោយចេតនា** ៖
1. `netlify\/functions\/` ចូល `NOT_SHIPPED` — Function រត់លើ server ហើយ
   `sw.js` បញ្ជូន `/.netlify/functions/` ទៅ **`networkOnly()`** ➜ វាមិនដែល
   ចូល cache ➜ មិនអាចធ្វើឲ្យសំបកចាស់បានឡើយ។
2. ⛔ **ការចាក់សោការលើកលែងនោះ** — assertion ថាបញ្ជីសំបករបស់ `sw.js`
   **គ្មានផ្លូវក្រោម `netlify/` ឬ `tools/`** បូកជាន់អប្បបរមា ២ (បញ្ជីសំបក ២ ·
   ធាតុ >= ៨)។ ការបន្ធូរ checker ដោយគ្មានការចាក់សោ = បៃតងក្លែងក្លាយសម្រាប់
   ជុំក្រោយ។

**Mutation ៤ ➜ ចាប់បានទាំង ៤** ៖ ផ្លូវសំបកក្រោម `netlify/` · `OPTIONAL_SHELL`
ប្តូរឈ្មោះ · បញ្ជីសំបកត្រូវកាត់ · **ទិសផ្ទុយ** (កែ `app.js` ពិត ➜ នៅតែទាមទារ
ការឡើងកំណែ ២ ដដែល)។

### ឃ. ✅ កំណែ — **មិនឡើង** (ត្រឹមត្រូវ)

ឯកសារ ship (`app.js` · `index.html` · `style.css` · `sw.js` · `manifest.json`)
**មិនប្រែសោះ** ➜ `APP_VERSION` នៅ `2.25.1` · `CACHE_VERSION` នៅ `zoew-v148`។
ZoeKeyGen មិនប៉ះ។

### ង. ✅ ឯកសារ

`tools/zto-cookie-grabber/README-KH.md` (ថ្មី) · `ZoeW/ZTO-SETUP-KH.md`
(ផ្នែក ២ខ + env vars) · `CHANGELOG.md` · `CLAUDE.md` (តារាងច្បាប់ ➜ ឧបករណ៍ +
ផ្នែកចំណេះដឹង) · `README.md` · `audit-tools/README.md`។

### ច. ✅ រកឃើញបន្ថែម ៖ `process.exit(0)` ដែលគ្មានច្រកទ្វារ

`exit-code-integrity.js` ចាប់បាន `zto-cookie-update-test.js:386` —
`process.exit(0)` ឈរក្រោយការអះអាង។ វា **មិនមែនបៃតងក្លែងក្លាយរស់** ទេ (ផ្លូវ
`if (fail) … exit(1)` ការពារវា) តែវាជា **ទម្រង់ផុយ** ៖ ការអះអាងណាដែលបន្ថែម
**ក្រោម** ច្រកទ្វារនោះ នឹងត្រូវរំលងស្ងាត់ៗ។ កែទៅជា `process.exit(fail ? 1 : 0)`
តាមទម្លាប់គម្រោង (៦៧ checker ប្រើទម្រង់នេះ)។

---

## ៤. Env vars ថ្មីដែលអ្នកប្រើត្រូវដាក់ក្នុង Netlify

| Env var | តម្លៃ |
|---|---|
| `ZTO_COOKIE_UPDATE_KEY` | អក្សរសម្ងាត់វែងចៃដន្យ (ដាក់ក្នុង extension options ដែរ) |
| `NETLIFY_AUTH_TOKEN` | Personal Access Token (User settings ➜ Applications) |
| `NETLIFY_ACCOUNT_ID` | account slug/ID |
| `NETLIFY_SITE_ID` | Site ID របស់ ZoeW |

ស្រេចចិត្ត៖ `ZTO_COOKIE_TARGET_KEY` (លំនាំដើម `ZTO_COOKIE`) ·
`ZTO_COOKIE_TRIGGER_DEPLOY=0` (សរសេរ env តែមិន deploy) ·
`ZTO_COOKIE_API_TIMEOUT_MS` · `ZTO_COOKIE_BUDGET_MS`

⚠️ **`NETLIFY_AUTH_TOKEN` ជា credential ខ្លាំង** (សិទ្ធិពេញលើគណនី)។ វារស់នៅ
**តែក្នុង env របស់ Function** — ⛔ កុំដាក់វាក្នុង extension ឬ client ណាមួយ។

### របៀបដំឡើង extension
Chrome ➜ `chrome://extensions` ➜ Developer mode ➜ **Load unpacked** ➜ រើសថត
`tools/zto-cookie-grabber/` ➜ ចុច Details ➜ Extension options ➜ បំពេញ
Endpoint URL និង update key ➜ Save។
ប្រើ៖ បើក Argus (login រួច) ➜ ចុចរូប extension ➜ badge `OK` បៃតង។

---

## ៥. ជុំបន្ទាប់ទៀត (ផ្លូវទី ២ និង ៣) — ក្រោយជុំនេះចប់

**ផ្លូវទី ៣ — ធ្វើឲ្យ cookie លែងផុតកំណត់។** អ្នកប្រើបញ្ជាក់ថា Argus ផ្ញើ
`Set-Cookie` មកវិញ។ បើវាធ្វើ **រាល់ការឆ្លើយតប** នោះ Function អាចចាប់តម្លៃថ្មី
រួចសរសេរជាន់ស្វ័យប្រវត្តិ ➜ **អ្នកប្រើលែងចាំបាច់ចូល Argus សោះ**។

**របៀបវាស់ (ធ្វើមុនសរសេរកូដ)** ៖ ក្រោយ deploy ជុំនេះ ស្កេនកញ្ចប់ ១ រួចរត់៖
```bash
curl -H "X-Zoe-Proxy-Key: <key>" "https://<site>/.netlify/functions/zto-order-detail?diag=1"
```
មើលវាល **`sessionRenewal`**៖ `setCookie: true` + `names` មាន session cookie
➜ ផ្លូវទី ៣ ដើរបាន។ `setCookie: false` ➜ **កុំសរសេរវា** (ការសន្មតខុសជាឫសគល់
នៃជុំបរាជ័យទាំង ៦ របស់ 2.24.x)។

**ផ្លូវទី ២ — លុប deploy ចោល** (ត្រូវការជាមុនសម្រាប់ផ្លូវទី ៣)៖ ផ្លាស់ cookie
ពី env var ទៅកន្លែងផ្ទុកដែលអាន runtime។ ⛔ **កុំប្រើ Netlify Blobs** (ធ្លាប់
ធ្លាក់ពិត — `ZTO_SESSION_STORE_UNAVAILABLE`)។ បើប្រើ Firebase RTDB សូមតាម
គំរូ OAuth REST របស់ `firebase-backup/` (គ្មាន dependency) ហើយ **rules ថ្មី
ត្រូវ publish ដោយដៃ**។
