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

## ៣. អ្វីដែល **នៅសល់** — ចាប់ផ្តើមត្រង់នេះ

### ក. ⛔ ផ្ទៀងផ្ទាត់ថា checker ធ្លាក់លើ `origin/main` (ចាំបាច់ · មិនទាន់ធ្វើ)

ជុំនេះអស់ពេលមុនធ្វើ។ ច្បាប់គម្រោង៖ checker ដែលមិនធ្លាក់លើ tree មុនកែ = មិនចាប់អ្វីទេ។

```bash
git fetch origin main
rm -rf /tmp/baseline && mkdir /tmp/baseline
git archive origin/main | tar -x -C /tmp/baseline
ZTOCOOKIE_APP_DIR=/tmp/baseline node audit-tools/zto-cookie-update-test.js
```
**រំពឹង**៖ exit 1 ដោយ «ជាន់អប្បបរមា៖ រកមិនឃើញ … zto-cookie-update.js»។
បើវាចេញ exit 0 ➜ checker ខូច ➜ កែវាមុនបន្ត។

### ខ. បន្ថែមចូល `audit-tools/run-all.sh`

បន្ថែម `zto-cookie-update-test.js` ចូល **ផ្នែករត់ធម្មតា** (មិនមែនផ្នែក baseline
តែម្យ៉ាង) បើមិនដូច្នេះ `checker-coverage.js` ផ្នែក ២ខ ធ្លាក់។

### គ. ⛔ កែ `audit-tools/version-bump-scope.js` — ចន្លោះពិត

`SHIPPED = /\.(js|css|html|wasm|json)$/` ចាប់ **`ZoeW/netlify/functions/*.js`**
➜ ការកែ Function ខាង server បង្ខំ `CACHE_VERSION` ឲ្យឡើង ➜ **អ្នកប្រើទាំងអស់
ទាញសំបក PWA ទាំងមូលឡើងវិញដោយឥតប្រយោជន៍** — ជាកំហុសដដែលនឹងច្បាប់ទី ៦។

**ការកែដែលស្នើ**៖ បន្ថែម `netlify\/functions\/` ចូល `NOT_SHIPPED` ព្រោះ Function
រត់លើ server ហើយ **មិនដែលនៅក្នុង `CORE_SHELL`/`OPTIONAL_SHELL` របស់ `sw.js`**
➜ វាមិនអាចធ្វើឲ្យសំបកដែល cache ចាស់បានទេ។

⛔ **កុំគ្រាន់តែបន្ធូរ checker។** ត្រូវបិទរន្ធជាមួយ៖ បន្ថែម assertion ថា
បញ្ជីសំបកក្នុង `sw.js` **គ្មានផ្លូវណាក្រោម `netlify/` ឬ `tools/`** ➜ បើថ្ងៃណា
មានឯកសារសំបកចូលទីនោះ វានឹងធ្លាក់។

### ឃ. កំណែ — **កុំឡើង** (គិតរួច)

ជុំនេះ **មិនប៉ះ** `ZoeW/app.js` · `index.html` · `style.css` · `sw.js` ទេ។
ក្រោយកែចំណុច គ ➜ គ្មានឯកសារ ship ណាប្រែ ➜ **`APP_VERSION` និង `CACHE_VERSION`
មិនត្រូវឡើង** (ច្បាប់ទី ៦ · `version-bump-scope` ច្បាប់ ២ និង ៤)។
`ZoeKeyGen` មិនប៉ះសោះ។

### ង. ឯកសារ

- `ZoeW/ZTO-SETUP-KH.md` — បន្ថែមផ្នែកថ្មី «ប្តូរ Cookie ដោយចុច ១ ដង» + env vars ថ្មី
- `tools/zto-cookie-grabber/README-KH.md` — **មិនទាន់សរសេរ** (របៀបដំឡើង extension)
- `CHANGELOG.md` · `CLAUDE.md` · `README.md` · `audit-tools/README.md` (បន្ថែមជួរតារាង checker)

### ច. រត់ `run-all.sh` ពេញ រួច commit + push

```bash
bash audit-tools/run-all.sh
node audit-tools/strip-comments.js
node audit-tools/version-check.js
```

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
