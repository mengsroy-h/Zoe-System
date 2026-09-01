# 🍪 ZTO Cookie Grabber — ប្តូរ Cookie ដោយចុច ១ ដង

Chrome extension (MV3) ដែលយក **Cookie session របស់ Argus** ចេញពី browser
រួចផ្ញើទៅ Netlify Function `zto-cookie-update` ➜ Function សរសេរវាចូល env var
`ZTO_COOKIE` ហើយ trigger deploy។

➜ ជំហានដោយដៃចាស់ (F12 ➜ Network ➜ ចម្លង `Cookie:` ➜ Netlify ➜ Save ➜ Trigger
deploy) នៅសល់ត្រឹម **ចុចរូប extension ១ ដង**។

---

## ⛔ ហេតុអ្វីត្រូវជា extension មិនមែន bookmarklet

**វាស់រួច** លើ `argus.ztoglobal.com` (2026-09-01)៖

| សំណួរ | ចម្លើយពិត |
|---|---|
| `document.cookie` ផ្តល់អ្វី? | `__zcat_uuid__` · `ZTO_INTL_BOS_MAN_TOKEN=1` · `perf_dv6Tr4n=1` · `sidebarStatus=0` — **គ្មាន credential ពិត** |
| ដូច្នេះ cookie ពិតនៅឯណា? | វាជា **`HttpOnly`** — JS អានមិនឃើញទាល់តែសោះ |

⛔ **កុំសរសេរ bookmarklet ជំនួស** — វាដើរមិនកើតតាមរចនាសម្ព័ន្ធ។ មានតែ
`chrome.cookies` API ទេដែលអាន cookie `HttpOnly` បាន ហើយ API នោះមានតែក្នុង
extension។

---

## ១. ដំឡើង (ម្តងគត់)

1. Chrome ➜ `chrome://extensions`
2. បើក **Developer mode** (កុងតាក់ខាងស្តាំលើ)
3. ចុច **Load unpacked** ➜ រើសថត `tools/zto-cookie-grabber/`
4. ចុច **Details** ➜ **Extension options**
5. បំពេញ ២ វាល៖

| វាល | តម្លៃ |
|---|---|
| Endpoint URL | `https://<site>/.netlify/functions/zto-cookie-update` |
| Update key | តម្លៃដដែលនឹង env var `ZTO_COOKIE_UPDATE_KEY` |

6. ចុច **Save** ➜ Chrome នឹងសុំសិទ្ធិលើ host របស់ Netlify site
   (`optional_host_permissions`) ➜ ត្រូវ **អនុញ្ញាត**។

---

## ២. ប្រើប្រចាំថ្ងៃ

1. បើក `argus.ztoglobal.com` ហើយ **login ឲ្យរួច**
2. ចុចរូប extension
3. មើល badge៖

| Badge | ន័យ |
|---|---|
| `...` ខៀវ | កំពុងផ្ញើ |
| **`OK` បៃតង** | ✅ Cookie ចូលរួច · deploy ចាប់ផ្តើមរួច |
| `!` ទឹកក្រូច | Cookie ចូលរួច តែ **deploy មិនបានចាប់ផ្តើម** (ឧ. `ZTO_COOKIE_TRIGGER_DEPLOY=0`) |
| `X` ក្រហម | ធ្លាក់ — យកកណ្តុរដាក់លើរូប ដើម្បីអានមូលហេតុពិត |

⚠️ **Deploy ត្រូវការពេល ១–២ នាទី** ទំរាំ Cookie ថ្មីមានប្រសិទ្ធភាពលើ site។

---

## ៣. សិទ្ធិ — ហេតុអ្វីមានប៉ុណ្ណេះ

| សិទ្ធិ | ហេតុផល |
|---|---|
| `cookies` | អាន cookie `HttpOnly` ដែល JS ធម្មតាអានមិនបាន |
| `storage` | រក្សា endpoint និង update key លើឧបករណ៍ |
| host `https://*.ztoglobal.com/*` | អាន cookie ត្រឹម ២ host របស់ ZTO ប៉ុណ្ណោះ |
| host របស់ Netlify (**optional**) | សុំតែពេលចុច Save — មិនសុំជាមុន |

⛔ **`NETLIFY_AUTH_TOKEN` មិនដែលនៅក្នុង extension ទេ** — វារស់នៅ **តែក្នុង env
របស់ Function**។ Extension ស្គាល់តែ `ZTO_COOKIE_UPDATE_KEY` ដែលជាកូនសោ
**ដាច់ដោយឡែក** ហើយធ្វើបានតែរឿងមួយ ៖ ប្តូរ cookie។

---

## ៤. សារធ្លាក់ និងអ្វីត្រូវធ្វើ

| សារ / `code` | មូលហេតុ | ដំណោះស្រាយ |
|---|---|---|
| `No Argus cookie found` | មិនទាន់ login ឬ cookie អស់ | បើក Argus ➜ login ➜ ចុចម្តងទៀត |
| `Could not reach ZoeW` | បណ្តាញ ឬ endpoint ខុស | ពិនិត្យ Endpoint URL ក្នុង options |
| `ZTO_COOKIE_KEY_INVALID` (401) | update key មិនត្រូវ | ធ្វើឲ្យ options ស៊ីនឹង env var |
| `ZTO_COOKIE_NOT_CONFIGURED` (503) | env var បាត់លើ Netlify | មើលតារាង env ក្នុង `ZoeW/ZTO-SETUP-KH.md` |
| `ZTO_COOKIE_REJECTED` (400) | cookie មាន `CR/LF/NUL` | ចម្លងម្តងទៀត កុំបញ្ចូលបន្ទាត់ថ្មី |
| `ZTO_COOKIE_ENV_REJECTED` | Netlify បដិសេធការសរសេរ env | ពិនិត្យ `NETLIFY_AUTH_TOKEN` · `ACCOUNT_ID` · `SITE_ID` |
| `ZTO_COOKIE_DEPLOY_*` | env ចូលរួច តែ deploy ធ្លាក់ | Trigger deploy ដោយដៃម្តង |

⛔ **`ZTO_COOKIE_ENV_REJECTED` មានន័យថា cookie ថ្មី *មិន* ចូល** — Function
មិន trigger deploy ក្នុងករណីនោះទេ ហើយវាមិនអះអាង `ok: true` ដែរ។

---

## ៥. តេស្ត

```bash
node audit-tools/zto-cookie-update-test.js     # ៦២ assertion
```

វាចាក់សោ៖ header injection · secret មិនលេចក្នុងចម្លើយ · ការ settle ធានាដោយ
រចនាសម្ព័ន្ធ (timer ពិត + `AbortController`) · env ធ្លាក់ ➜ **មិន** deploy ·
កូនសោ `ZTO_COOKIE_UPDATE_KEY` ដាច់ពី `ZTO_PROXY_KEY`។
