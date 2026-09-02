# ZTO Cookie Sync សម្រាប់ Windows

> 📖 ឯកសារនេះសរសេរតែ **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព ·
> អាជ្ញាប័ណ្ណ**។ ប្រវត្តិកំហុស ស្ថិតក្នុង
> **[docs/BUG-HISTORY.md](../../docs/BUG-HISTORY.md)**។

## កំណែ

ឧបករណ៍មូលដ្ឋាន — **មិន deploy ទេ** ហើយវា **មិនប៉ះ `APP_VERSION` ឬ
`CACHE_VERSION` របស់ PWA ណាមួយឡើយ**។ វាពឹងលើ `playwright-core` ដែលចាក់សោ
កំណែក្នុង `package.json` របស់ថតនេះ។

## មុខងារ

ឧបករណ៍នេះកាត់ផ្លូវប្រចាំថ្ងៃពី៖

`F12 ➜ Network ➜ Copy Cookie ➜ Netlify env ➜ Save ➜ Trigger deploy`

មកនៅត្រឹម៖

`double-click sync-zto-cookie.cmd ➜ Login Argus បើចាំបាច់ ➜ បើកកញ្ចប់មួយ`

វាបើក **Microsoft Edge** (ឬ Chrome) ជាមួយ profile ដាច់ដោយឡែកក្នុង
`%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync` ហើយចាប់បន្ទាត់ `Cookie:` ពី
**សំណើពិត** ទៅ `aargus-api.ztoglobal.com`។ ដូច្នេះវាមិនប្រើ
`document.cookie` និងមិនប្រើ `chrome.cookies` API ដែលបានវាស់ថាត្រឡប់
បញ្ជីទទេលើ Edge របស់អ្នកទេ។

⚡ **តាំងពី 2026-09-02 វាទទួល path ណាមួយលើ host នោះ** មិនត្រឹម Order Detail
ទេ — Cookie ជារបស់ **domain** មិនមែន path ➜ ជាញឹកញាប់ត្រឹមតែ **បើក Argus
ចប់ គឺវាចាប់បានហើយ ដោយមិនបាច់ចុចបើកកញ្ចប់**។ ការការពារពិតនៅដដែល ៖ សំណើ
ដែលគ្មាន `BOS-MAN-SESSION` ត្រឹមត្រូវ ត្រូវរង់ចាំសំណើបន្ទាប់។

បន្ទាប់មកវាហៅ Netlify API ដោយផ្ទាល់ ដើម្បីសរសេរ Cookie ចូល
**Netlify Blobs** (store `zto-auth`, key `cookie`)៖

1. ស្នើ signed URL ពី `/api/v1/blobs/<site-id>/zto-auth/cookie`;
2. upload Cookie ទៅផ្លូវនោះ។

⛔ **វាលែង trigger deploy ទៀតទេ** — តាំងពី 2026-09-02 ZoeW Function អាន
Cookie ចេញពី Blobs **ពេលមានសំណើ** ដូច្នេះការប្តូរមានប្រសិទ្ធភាព
**ក្នុងរយៈពេលមួយនាទី ដោយគ្មានការ redeploy**។

---

## របៀបប្រើប្រាស់

### តម្រូវការ

- Windows 10/11
- Microsoft Edge ឬ Google Chrome
- Node.js **22.17.0 ឬថ្មីជាងនេះ**
- សិទ្ធិចូល ZoeW site ក្នុង Netlify
- Netlify Personal Access Token មួយ (បញ្ចូលតែម្តង)

### Netlify Environment Variables — ដាក់តែ ២ Key

ចូល `Netlify → ZoeW site → Project configuration → Environment variables`
រួចចុច **Add a variable**។ បង្កើត variable ២ ដាច់ដោយឡែកដូចតារាងនេះ៖

អ្នកអាចរត់ `setup.cmd` **មុន ឬក្រោយ** ផ្នែកនេះក៏បាន៖ `setup.cmd` មិនត្រូវការ
env ទាំងនេះ និងមិនបង្កើតវាទេ; វាផ្ទៀងផ្ទាត់តែ Site ID + PAT។ `ZTO_PROXY_KEY`
ត្រូវការសម្រាប់ ZoeW ហៅ Function មិនមែនសម្រាប់ `setup.cmd` ទេ។

| Key | Value ពេលបង្កើតដំបូង | Contains secret values | Scope | Deploy context |
|---|---|---|---|---|
| `ZTO_PROXY_KEY` | សោចៃដន្យ ៣២ bytes (វិធីបង្កើតនៅខាងក្រោម) | ✅ Yes | **Functions** | **Production** |
| `ZTO_COOKIE` | **ស្រេចចិត្ត** — ផ្លូវបម្រុងពេល Blobs ដាច់ | ✅ Yes | **Functions** | **Production** |

តាំងពី 2026-09-02 **`ZTO_COOKIE` លែងចាំបាច់ទៀតទេ** ៖ helper សរសេរ Cookie ចូល
Netlify Blobs ដោយផ្ទាល់។ ទុកវាបានជា **ផ្លូវបម្រុង** — Function ប្រើ env នេះ
តែពេលអានចេញពី Blobs មិនបាន។ បើអ្នកមានតម្លៃចាស់ក្នុងនោះរួច **កុំលុបវាចេញ**។

បង្កើត `ZTO_PROXY_KEY` លើ Windows៖ បើក **PowerShell** រួចរត់បន្ទាត់ទាំងនេះ
ហើយចម្លង output ចូល Netlify៖

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes)
```

តម្លៃ `ZTO_PROXY_KEY` ដដែលនេះត្រូវដាក់ក្នុង ZoeW នៅ
`⚙️ → 🔌 API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ → តម្លៃ Header` ដោយប្រើឈ្មោះ Header
`X-Zoe-Proxy-Key`។ កុំយក `ZTO_COOKIE` ទៅដាក់ក្នុង ZoeW/browser។

សម្រាប់ផ្លូវ Cookie នេះ **មិនចាំបាច់** បង្កើត `ZTO_API_URL`,
`ZTO_API_METHOD` ឬ `ZTO_REQUEST_*` ទេ ព្រោះ Function មានលំនាំដើមរួច។ បើមាន
`ZTO_AUTHORIZATION` ឬ `ZTO_TOKEN` ចាស់ សូមលុបវា ព្រោះវាមានអាទិភាពលើ
`ZTO_COOKIE`។

⛔ **កុំដាក់** `NETLIFY_AUTH_TOKEN`, `NETLIFY_ACCOUNT_ID`, `NETLIFY_SITE_ID`
ឬ `ZTO_COOKIE_UPDATE_KEY` ក្នុង Netlify env។ Site ID និង Personal Access Token
ត្រូវបញ្ចូលតែក្នុង `setup.cmd` ហើយរក្សាទុកតែលើ Windows របស់អ្នក។

### Site ID + PAT សម្រាប់ `setup.cmd`

1. ចូល `Netlify → User settings → Applications → Personal access tokens`
   ហើយបង្កើត token មួយសម្រាប់ឧបករណ៍នេះ។ ជ្រើសថ្ងៃផុតកំណត់ ហើយបើ team ប្រើ
   SSO ត្រូវអនុញ្ញាត token ឲ្យចូល team នោះ។ មើល
   [ការណែនាំផ្លូវការរបស់ Netlify](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/#authentication)។
   ចម្លងវាទុកបណ្តោះអាសន្ន ព្រោះ Netlify មិនបង្ហាញតម្លៃម្តងទៀតទេ។
2. យក ZoeW **Site ID** ពី
   `Project configuration → General → Project details`។

Personal Access Token មានសិទ្ធិតាម account របស់អ្នក។ កុំផ្ញើវាតាម chat,
screenshot ឬដាក់ក្នុង repo។ អ្នកអាច revoke វាពី Netlify គ្រប់ពេល។

### Setup ម្តងដំបូង

1. Double-click **`setup.cmd`**។
2. វាដំឡើងតែ `playwright-core` ដែលបាន pin ក្នុង `package.json`។
3. បញ្ចូល ZoeW Site ID។
4. បញ្ចូល **ZoeW Site URL** (ឧ. `https://zoew.netlify.app`)។
   វាចាំបាច់សម្រាប់របៀប `--check` និង `--auto`។ ចុច Enter ដើម្បីរំលង។
5. បញ្ចូល Netlify Personal Access Token ក្នុង prompt ដែលលាក់អក្សរ។
6. បញ្ចូល **`ZTO_PROXY_KEY`** (តម្លៃដដែលនឹងក្នុង Netlify)។
   ⛔ **prompt នេះលេចឡើងតែក្រោយបំពេញ Site URL ខាងលើ** — បើរំលង Site URL
   នោះវាមិនសួរសោះ ហើយ `--auto` ប្រើមិនបាន។
7. ឧបករណ៍ផ្ទៀងផ្ទាត់ token + site តាម Netlify API។ ឃើញ
   `✅ Setup រួចរាល់` គឺចប់។

**រត់ `setup.cmd` ឡើងវិញបានគ្រប់ពេល ដោយមិនបាត់អ្វី។** វាបង្ហាញតម្លៃចាស់
ហើយ **ចុច Enter = រក្សាដដែល** ៖

| prompt | ចុច Enter ➜ |
|---|---|
| Site ID | រក្សាតម្លៃចាស់ |
| Site URL | រក្សាតម្លៃចាស់ (វាយ `-` ដើម្បីលុបចេញ) |
| Netlify PAT | **រក្សា token ចាស់** — ⛔ មិនបាច់វាយថ្មី |
| `ZTO_PROXY_KEY` | រក្សាសោចាស់ |

⛔ នេះសំខាន់ព្រោះ **Netlify បង្ហាញ PAT តែម្តងគត់** — ការបំពេញតម្លៃ
ស្រេចចិត្ត ២ ខាងលើ មិនត្រូវបង្ខំឲ្យបង្កើត PAT ថ្មីឡើយ។

Site ID រក្សាក្នុង `config.json` ក្រៅ repo។ Token ត្រូវបានអ៊ិនគ្រីបដោយ
**Windows DPAPI / CurrentUser** ក្នុង `netlify-token.dpapi` — Windows user ផ្សេង
ឬកុំព្យូទ័រផ្សេងមិនអាចដោះសោវាបានទេ។ Token មិនដាក់ក្នុង command line,
environment variable, Netlify Function, browser extension ឬ repo ឡើយ។

ទីតាំងទាំងពីរ៖

```text
%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\config.json
%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\netlify-token.dpapi
%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\proxy-key.dpapi
```

`proxy-key.dpapi` អ៊ិនគ្រីបដោយ **DPAPI ដដែល** នឹង PAT ➜ គ្មានថ្នាក់ហានិភ័យ
ថ្មី។ វាប្រើតែសម្រាប់ការផ្ទៀងផ្ទាត់ និងរបៀប `--check`/`--auto` ប៉ុណ្ណោះ។

បើប្តូរ Windows user · Site ID · token ឬ revoke token ចាស់ សូមរត់
`setup.cmd` ឡើងវិញ។

### ប្រើរាល់ពេល Cookie ផុត

1. Double-click **`sync-zto-cookie.cmd`**។
2. Edge/Chrome profile ពិសេសបើក Argus។
3. បើ ZTO សុំ សូម Login ជាធម្មតា។ បើ session នៅរស់ **គ្មានអ្វីត្រូវចុចទេ**។
4. ទុកឲ្យឧបករណ៍បិទ browser រួចសរសេរ Cookie ចូល Netlify Blobs ដោយខ្លួនឯង។
   ⛔ **មិនចាំបាច់ redeploy ទេ** — ការស្កេនថ្មីប្រើ Cookie នេះក្នុងមួយនាទី។
5. បើអ្នកបានបញ្ចូល **Site URL + `ZTO_PROXY_KEY`** ក្នុង `setup.cmd` នោះវា
   **ផ្ទៀងផ្ទាត់ដោយខ្លួនឯង** ថា Function ឃើញ Cookie ថ្មីពិត ៖
   `✅ ផ្ទៀងផ្ទាត់រួច — Function កំពុងប្រើ Cookie ថ្មី (blob · a1b2c3d4)`

### របៀបផ្សេងទៀត

| ពាក្យបញ្ជា | ធ្វើអ្វី |
|---|---|
| `sync-zto-cookie.cmd` | យក Cookie ថ្មី (ធម្មតា) |
| `sync-zto-cookie.cmd --check` | **មិនបើក browser** — ត្រឹមប្រាប់ថា Cookie នៅដំណើរការឬអត់ (ប្រភព · ចំនួនបន្តអាយុ · ZTO បដិសេធពេលណា) |
| `sync-zto-cookie.cmd --auto` | ពិនិត្យជាមុន ➜ បើ Cookie នៅដំណើរការ **មិនបើក browser សោះ**; បើស្លាប់ ទើបយកថ្មី |
| `schedule-zto-cookie.cmd` | ដំឡើង Windows Task ឲ្យរត់ `--auto` **រាល់ពេលចូល Windows** |
| `schedule-zto-cookie.cmd remove` | លុប Task នោះវិញ |

⛔ **`--check` និង `--auto` ត្រូវការ Site URL + `ZTO_PROXY_KEY`** ក្នុង
`setup.cmd`។ បើគ្មាន `--auto` នឹង **មិនបើក browser ទេ** ហើយប្រាប់មូលហេតុ —
ការបើក browser រាល់ការចូល Windows ដោយមិនដឹងស្ថានភាព គឺជាការរំខាន។

`schedule-zto-cookie.cmd` ពិនិត្យរឿងនោះជាមុន ហើយបើខ្វះ វា **ដាក់ឈ្មោះ
តម្លៃដែលខ្វះ** ៖

```text
❌ របៀប --auto ត្រូវការតម្លៃដែលនៅខ្វះ ៖
   • ZoeW Site URL (ឧ. https://zoew.netlify.app)
   • ZTO_PROXY_KEY (តម្លៃដដែលនឹងក្នុង Netlify)
```

ដំណោះស្រាយ ៖ រត់ `setup.cmd` ម្តងទៀត ចុច Enter កាត់ prompt ដែលមានតម្លៃរួច
រួចបំពេញតែ ២ នោះ។

Cookie មិនត្រូវបានបង្ហាញក្នុង console, មិនសរសេរចូល config/file និងមិនចូល
shell history ទេ។ Netlify API response ដែលអាចពាក់ព័ន្ធនឹង secret ត្រូវបោះចោល
ដោយមិនបង្ហាញ body។ Chrome/Edge profile ពិសេសនៅតែផ្ទុក session ដោយការអ៊ិនគ្រីប
របស់ browser ដូច profile ធម្មតា — កុំចែករំលែកថត
`%LOCALAPPDATA%\Zoe-System`។

### ជ្រើស Chrome ជាមុន Edge

លំនាំដើមសាក Microsoft Edge មុន។ បើចង់សាក Chrome មុន៖

```cmd
set ZTO_SYNC_BROWSER=chrome
sync-zto-cookie.cmd
```

### ពេលមានបញ្ហា

| សារ | ត្រូវធ្វើអ្វី |
|---|---|
| `'orlevel'` / `'utionPolicy' is not recognized` | អ្នកកំពុងប្រើ `.cmd` UTF-8 ចាស់។ ទាញកំណែថ្មីដែលជា ASCII + CRLF រួចជំនួស `setup.cmd` និង `sync-zto-cookie.cmd` ទាំង ២ |
| មិនទាន់ Setup/config/token | បើក `setup.cmd` |
| Browser launch failed | បិទបង្អួច ZTO Cookie Sync ចាស់ទាំងអស់ រួចសាកវិញ |
| មិនឃើញ Order Detail request | Login Argus ហើយបើក/ស្វែងរកកញ្ចប់មួយ |
| Netlify បដិសេធ Site ID ឬ Token | រត់ `setup.cmd` ហើយបញ្ចូលថ្មី |
| Netlify មិនអនុញ្ញាតឲ្យសរសេរ Cookie store | ពិនិត្យថា PAT មានសិទ្ធិលើ ZoeW site; ការស្កេននៅតែប្រើ `ZTO_COOKIE` env ជាបម្រុង |
| ការសរសេរចូល Blobs បរាជ័យ | សាកម្តងទៀត; បើនៅតែធ្លាក់ ដាក់ Cookie ក្នុង `ZTO_COOKIE` env ដោយដៃ រួច Trigger deploy |

---

## ប្រព័ន្ធសុវត្ថិភាព

### ព្រំដែន

- វាមិនស្មាន ឬបញ្ចូល ZTO password ដោយស្វ័យប្រវត្តិទេ។ បើ SSO ផុត អ្នកត្រូវ
  Login ម្តងក្នុង browser profile ពិសេស។
- វាមិននាំ auto-login ទៅ Netlify/GitHub runner វិញទេ; browser រត់តែលើ
  Windows និងបណ្តាញរបស់អ្នក។
- វាមិនបង្កើត endpoint សរសេរ Cookie ក្នុង ZoeW Function និងមិនដាក់
  `NETLIFY_AUTH_TOKEN` ក្នុង Netlify env ឡើយ។
- វាសរសេរតែ key **តែមួយ** (`zto-auth/cookie`) ក្នុង Netlify Blobs; វាមិនអាន
  មិនលុប និងមិនប៉ះ key ណាផ្សេងទេ។
- Cookie ដែលសរសេរចូល Blobs អាចត្រូវការរហូតដល់ **៦០ វិនាទី** ទើបឡើងដល់គ្រប់
  សំណើ (edge cache របស់ Netlify)។ ការឆ្លើយ 401 ពី ZTO កាត់ការរង់ចាំនោះភ្លាម។

### សេចក្តីសង្ខេបនៃការការពារ

| អ្វី | របៀបការពារ |
|---|---|
| **Cookie ZTO** | រស់ក្នុងសតិប៉ុណ្ណោះ — **មិនត្រូវបានបង្ហាញ** ក្នុង console, មិនសរសេរចូល file/config និងមិនចូល shell history |
| **Netlify Personal Access Token** | អ៊ិនគ្រីបដោយ **Windows DPAPI / CurrentUser** ក្នុង `%LOCALAPPDATA%` — Windows user ផ្សេង ឬកុំព្យូទ័រផ្សេងដោះសោមិនបាន |
| **`ZTO_PROXY_KEY`** (ស្រេចចិត្ត) | អ៊ិនគ្រីបដោយ **DPAPI ដដែល** ក្នុង `proxy-key.dpapi`; មិនចូល URL · មិនចូល command line · មិនបោះពុម្ព |
| **ការហៅ Netlify API** | HTTPS origin ថេរ · `redirect: 'error'` · timeout ដែល settle ដោយ timer ពិត · response body បោះចោលដោយមិនបង្ហាញ |
| **ការ upload** | signed URL ត្រូវជា **HTTPS** មុនផ្ញើ Cookie ហើយ ⛔ **PAT មិនហូរទៅ host នោះសោះ**; redirect ត្រូវបដិសេធដោយឈ្មោះ |
| **ទម្រង់ Cookie** | ត្រូវមាន `BOS-MAN-SESSION` ពិត · បដិសេធ CR/LF/NUL · ពិដាន ៨ KiB និង ៦៤ គូ ➜ header injection កើតមិនបាន |
| **⛔ អ្វីដែលមិនធ្វើ** | មិនបង្កើត endpoint សរសេរ Cookie ពី internet · មិនដាក់ `NETLIFY_AUTH_TOKEN` ក្នុង Netlify env · មិនប្រើ browser extension |

---

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — ផ្នែកមួយនៃ Zoe-System សម្រាប់ប្រើក្នុងអាជីវកម្មរបស់
ម្ចាស់ប៉ុណ្ណោះ។ ឧបករណ៍នេះមិនត្រូវការ Activation Key ទេ ព្រោះវាមិនមែនជា
App របស់អតិថិជន — វាជាឧបករណ៍ថែទាំដែលរត់លើកុំព្យូទ័ររបស់ម្ចាស់។
