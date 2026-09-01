# ZTO Cookie Sync សម្រាប់ Windows

ឧបករណ៍នេះកាត់ផ្លូវប្រចាំថ្ងៃពី៖

`F12 ➜ Network ➜ Copy Cookie ➜ Netlify env ➜ Save ➜ Trigger deploy`

មកនៅត្រឹម៖

`double-click sync-zto-cookie.cmd ➜ Login Argus បើចាំបាច់ ➜ បើកកញ្ចប់មួយ`

វាបើក **Microsoft Edge** (ឬ Chrome) ជាមួយ profile ដាច់ដោយឡែកក្នុង
`%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync` ហើយចាប់បន្ទាត់ `Cookie:` ពី
**Order Detail request ពិត** ទៅ `aargus-api.ztoglobal.com`។ ដូច្នេះវា
មិនប្រើ `document.cookie` និងមិនប្រើ `chrome.cookies` API ដែលបានវាស់ថា
ត្រឡប់បញ្ជីទទេលើ Edge របស់អ្នកទេ។

បន្ទាប់មកវាហៅ Netlify API ដោយផ្ទាល់ ដើម្បី៖

1. update តម្លៃ `ZTO_COOKIE` ដែលមានស្រាប់សម្រាប់ `production`;
2. trigger production build ថ្មី។

## តម្រូវការ

- Windows 10/11
- Microsoft Edge ឬ Google Chrome
- Node.js **22.17.0 ឬថ្មីជាងនេះ**
- សិទ្ធិចូល ZoeW site ក្នុង Netlify
- Netlify Personal Access Token មួយ (បញ្ចូលតែម្តង)

## Netlify Environment Variables — ដាក់តែ ២ Key

ចូល `Netlify → ZoeW site → Project configuration → Environment variables`
រួចចុច **Add a variable**។ បង្កើត variable ២ ដាច់ដោយឡែកដូចតារាងនេះ៖

| Key | Value ពេលបង្កើតដំបូង | Contains secret values | Scope | Deploy context |
|---|---|---|---|---|
| `ZTO_PROXY_KEY` | សោចៃដន្យ ៣២ bytes (វិធីបង្កើតនៅខាងក្រោម) | ✅ Yes | **Functions** | **Production** |
| `ZTO_COOKIE` | Cookie ពេញ ឬ `BOS-MAN-SESSION=setup-pending` ជាបណ្តោះអាសន្ន | ✅ Yes | **Functions** | **Production** |

បើមិនចង់ចូល DevTools សូម្បីតែលើកដំបូង សូមដាក់
`BOS-MAN-SESSION=setup-pending` ក្នុង `ZTO_COOKIE` សិន។ តម្លៃនេះ **មិនមែនជា
Cookie ពិត** ទេ ហើយ lookup មិនទាន់ដើររហូតដល់អ្នករត់ `sync-zto-cookie.cmd`។
Helper នឹងជំនួសវាដោយ Cookie ពេញដែលចាប់បាន រួច trigger deploy ដោយខ្លួនឯង។

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

## មុន Setup

1. ពិនិត្យថា variable ទាំង ២ ខាងលើមានរួច និងបានកំណត់ metadata តាមតារាង។
2. ចូល `Netlify → User settings → Applications → Personal access tokens`
   ហើយបង្កើត token មួយសម្រាប់ឧបករណ៍នេះ។ ជ្រើសថ្ងៃផុតកំណត់ ហើយបើ team ប្រើ
   SSO ត្រូវអនុញ្ញាត token ឲ្យចូល team នោះ។ មើល
   [ការណែនាំផ្លូវការរបស់ Netlify](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/#authentication)។
   ចម្លងវាទុកបណ្តោះអាសន្ន ព្រោះ Netlify មិនបង្ហាញតម្លៃម្តងទៀតទេ។
3. យក ZoeW **Site ID** ពី
   `Project configuration → General → Project details`។

Personal Access Token មានសិទ្ធិតាម account របស់អ្នក។ កុំផ្ញើវាតាម chat,
screenshot ឬដាក់ក្នុង repo។ អ្នកអាច revoke វាពី Netlify គ្រប់ពេល។

## Setup ម្តងដំបូង

1. Double-click **`setup.cmd`**។
2. វាដំឡើងតែ `playwright-core` ដែលបាន pin ក្នុង `package.json`។
3. បញ្ចូល ZoeW Site ID។
4. បញ្ចូល Netlify Personal Access Token ក្នុង prompt ដែលលាក់អក្សរ។
5. ឧបករណ៍ផ្ទៀងផ្ទាត់ token + site តាម Netlify API។ ឃើញ
   `✅ Setup រួចរាល់` គឺចប់។

Site ID រក្សាក្នុង `config.json` ក្រៅ repo។ Token ត្រូវបានអ៊ិនគ្រីបដោយ
**Windows DPAPI / CurrentUser** ក្នុង `netlify-token.dpapi` — Windows user ផ្សេង
ឬកុំព្យូទ័រផ្សេងមិនអាចដោះសោវាបានទេ។ Token មិនដាក់ក្នុង command line,
environment variable, Netlify Function, browser extension ឬ repo ឡើយ។

ទីតាំងទាំងពីរ៖

```text
%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\config.json
%LOCALAPPDATA%\Zoe-System\ZTO-Cookie-Sync\netlify-token.dpapi
```

បើប្តូរ Windows user · Site ID · token ឬ revoke token ចាស់ សូមរត់
`setup.cmd` ឡើងវិញ។

## ប្រើរាល់ពេល Cookie ផុត

1. Double-click **`sync-zto-cookie.cmd`**។
2. Edge/Chrome profile ពិសេសបើក Argus។
3. បើ ZTO សុំ សូម Login ជាធម្មតា។
4. បើក ឬស្វែងរកកញ្ចប់ណាមួយ ដើម្បីឲ្យមាន Order Detail request។
5. ទុកឲ្យឧបករណ៍បិទ browser, update secret និង trigger deploy ដោយខ្លួនឯង។

Cookie មិនត្រូវបានបង្ហាញក្នុង console, មិនសរសេរចូល config/file និងមិនចូល
shell history ទេ។ Netlify API response ដែលអាចពាក់ព័ន្ធនឹង secret ត្រូវបោះចោល
ដោយមិនបង្ហាញ body។ Chrome/Edge profile ពិសេសនៅតែផ្ទុក session ដោយការអ៊ិនគ្រីប
របស់ browser ដូច profile ធម្មតា — កុំចែករំលែកថត
`%LOCALAPPDATA%\Zoe-System`។

## ជ្រើស Chrome ជាមុន Edge

លំនាំដើមសាក Microsoft Edge មុន។ បើចង់សាក Chrome មុន៖

```cmd
set ZTO_SYNC_BROWSER=chrome
sync-zto-cookie.cmd
```

## ពេលមានបញ្ហា

| សារ | ត្រូវធ្វើអ្វី |
|---|---|
| មិនទាន់ Setup/config/token | បើក `setup.cmd` |
| Browser launch failed | បិទបង្អួច ZTO Cookie Sync ចាស់ទាំងអស់ រួចសាកវិញ |
| មិនឃើញ Order Detail request | Login Argus ហើយបើក/ស្វែងរកកញ្ចប់មួយ |
| Netlify បដិសេធ Site ID ឬ Token | រត់ `setup.cmd` ហើយបញ្ចូលថ្មី |
| `ZTO_COOKIE` update ធ្លាក់ | ពិនិត្យថា variable មានរួច និង token មានសិទ្ធិលើ ZoeW site |
| env update ជោគជ័យ តែ deploy ធ្លាក់ | Trigger deploy ក្នុង Netlify ម្តង; មិនចាំបាច់យក Cookie ម្តងទៀត |

## ព្រំដែន

- វាមិនស្មាន ឬបញ្ចូល ZTO password ដោយស្វ័យប្រវត្តិទេ។ បើ SSO ផុត អ្នកត្រូវ
  Login ម្តងក្នុង browser profile ពិសេស។
- វាមិននាំ auto-login ទៅ Netlify/GitHub runner វិញទេ; browser រត់តែលើ
  Windows និងបណ្តាញរបស់អ្នក។
- វាមិនបង្កើត endpoint សរសេរ env ក្នុង ZoeW Function និងមិនដាក់
  `NETLIFY_AUTH_TOKEN` ក្នុង Netlify env ឡើយ។
- វា update តែ **តម្លៃ** production របស់ `ZTO_COOKIE` ដែលបានកំណត់ scope/secret
  ក្នុង Netlify រួច; ការបង្កើត variable និង metadata ដំបូងនៅតែធ្វើក្នុង UI។
