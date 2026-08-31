# របាយការណ៍ Deep Audit — Zoe System

កាលបរិច្ឆេទ៖ 2026-08-31  
កំណែ ZoeW៖ **2.24.0** (`zoew-v139`)  
វិសាលភាព៖ ZoeW, ZoeKeyGen, Firebase rules, Netlify Function, Service Worker,
ZTO lookup, Firebase backup និង audit-tools ទាំងមូល។

## សេចក្តីសន្និដ្ឋាន

- កែ bug អាជីវកម្ម **off-by-one មួយថ្ងៃ**៖ «ថ្ងៃទី ៨» តាមន័យ
  **លើស ៧×២៤ ម៉ោង**។ កូដមុនរង់ចាំលើស ៨×២៤ ម៉ោង។ ឥឡូវនៅ ៧ថ្ងៃគត់
  មិនទាន់ដក; លើស ៧ថ្ងៃទើបដក។
- បន្ថែមច្បាប់ថ្មី៖ ធាតុ `trashReason: expired` លុបអចិន្ត្រៃយ៍ក្រោយ
  **នៅក្នុងធុងសំរាមលើស ២ថ្ងៃ**; `delete`, `remove`, `pickup` និង legacy
  នៅតែ **៣០ថ្ងៃ**។
- កែ ZTO proxy ឱ្យស្គាល់ Cookie/token ផុតកំណត់ ទាំង JSON error, HTTP
  401/403, redirect ទៅ login និង HTML login page; បែងចែក timeout, rate-limit,
  auth មិនបានកំណត់ និង upstream error។
- ដក dependency tree `firebase-admin` ដែលមាន security advisories ចេញពី
  backup tool។ Backup ឥឡូវប្រើ Node 18 native OAuth/REST, timeout/retry,
  atomic file, permission 0600 និង run lock។ `npm audit` = **0 vulnerability**។
- `audit-tools/run-all.sh` ចប់ដោយ exit code 0៖ **83 full pass · 12 partial pass ·
  23 skipped · 0 fail**។ ចំណុចដែលរំលងមានពន្យល់ក្នុងផ្នែកកម្រិតតេស្តខាងក្រោម។

## ច្បាប់ Barcode និងស្ថិតិដែលបានផ្ទៀងផ្ទាត់

| ផ្លូវ | ពេលចូលធុងសំរាម | ស្លាក | ប៉ះស្ថិតិពេលចេញ? | ពេលស្តារ | Retention |
|---|---:|---|---|---|---:|
| លុបកញ្ចប់ដោយដៃ / លុបទាំងអស់ | ភ្លាម | `delete` | **មិនដក** | **មិនបូក** | 30ថ្ងៃ |
| Barcode ដែលអតិថិជនយករួច | លើស 2ម៉ោងពី `closedAt` | `pickup` | **មិនដក** | **មិនបូក** | 30ថ្ងៃ |
| ដក Barcode ដោយដៃ | ភ្លាម | `remove` | **ដក 1ដង** | បូកត្រឡប់ **1ដង** | 30ថ្ងៃ |
| Barcode មិនទាន់យក ចូលថ្ងៃទី8 | លើស 7×24ម៉ោងពី `createdAt` | `expired` | **ដក 1ដង** | បូកត្រឡប់ **1ដង** | **2ថ្ងៃ** |

ច្រកទ្វារលុយគឺ `barcode.isDeducted`៖

- `delete` និង `pickup` មិនកំណត់វាជា `true` ដូច្នេះ restore មិនបូកស្ទួន។
- `remove` និង `expired` កំណត់វាជា `true` បន្ទាប់ពីដក; restore បូកតែ
  barcode ដែលមានត្រានេះ រួច reset ទៅ `false`។
- កញ្ចប់លាយ barcode បិទ/មិនបិទ៖ ច្បាប់ 2ម៉ោងយកតែ barcode បិទ;
  ច្បាប់ថ្ងៃទី8 ដកតែ barcode មិនទាន់បិទ។ តម្លៃ COD/DOD/count ត្រូវគណនាឡើងវិញ
  ក្នុង transaction មិនយក state ចាស់ក្នុង memory ទៅសរសេរជាន់។
- Restore barcode `expired` ដែលនៅក្នុងបង្អួច 2ថ្ងៃ reset `createdAt` ទៅម៉ោង
  server ដូច្នេះវាមិនលោតចូលធុងសំរាមវិញភ្លាម។
- បើការសរសេរធុងសំរាមបរាជ័យក្រោយដកស្ថិតិ កូដ compensation បូកស្ថិតិវិញ
  ហើយព្យាយាមស្តារធាតុទៅប្រវត្តិ។

## ព្រំដែន Cleanup

| ព្រំដែន | លទ្ធផលដែលបានចាក់សោដោយតេស្ត |
|---|---|
| 2ម៉ោងគត់ | មិនទាន់ផ្លាស់; **លើស** 2ម៉ោងទើប `pickup` |
| 7×24ម៉ោងគត់ | មិនទាន់ដក; **លើស** 7ថ្ងៃទើបចូលថ្ងៃទី8 និង `expired` |
| `expired` 2ថ្ងៃគត់ក្នុងធុង | មិនទាន់ purge; **លើស** 2ថ្ងៃទើប purge |
| ប្រភេទផ្សេង 30ថ្ងៃគត់ | មិនទាន់ purge; **លើស** 30ថ្ងៃទើប purge |

Cleanup ដែលបំផ្លាញទិន្នន័យមិនរត់តាម `Date.now()` របស់ទូរស័ព្ទទេ។ វាទាមទារ
Firebase `.info/connected` និង server-time offset ដែលបាន handshake។ ពេល offline
ឬនាឡិកាមិនទាន់ទុកចិត្តបាន វាពន្យារ; ពេល reconnect វារត់វិញ។ Active restore
claim ទប់ purge ហើយ stale claim ត្រូវដោះមុន purge/ដោះ barcode registry។

## Network, Firebase និង Service Worker

បានពិនិត្យ/តេស្តផ្លូវខាងក្រោម៖

- online ↔ offline transition និង toast មិនប្រកាសថា sync រួចមុន listener
  សំខាន់ៗមកដល់។
- Firebase SDK load retry ladder, reconnect watchdog, listener generation fence,
  failed-listener retry និង pending-key consistency។ Listener ចាស់មិនអាចសរសេរ
  state ក្រោយ config/session ថ្មី។
- DB operation ដែល Firebase ទុក pending ពេល offline មាន timeout; in-flight lock
  ត្រូវបានដោះ ដើម្បីកុំឱ្យ App ជាប់រហូត។
- history patch ដែលដាច់ពេលចេញទៅ phone app ចូល retry queue; permission-denied
  នៅតែ rollback មិន retry ឥតកំណត់។
- Service Worker cache version បាន bump ទៅ `zoew-v139`; Netlify Functions នៅ
  network-only, abort signal ត្រូវបន្ត, Cache API ខូចមិនធ្វើឱ្យ App មិនអាចបើក,
  និង static shell អាចប្រើ offline។
- Lookup មាន in-flight cap, failure cooldown, timeout + abort, transient retry,
  preconnect/warm-up និង memory cache; request ចាស់មិនអាចបំពេញ modal របស់
  barcode ថ្មី។

## ZTO Lookup និងជម្រើសក្រៅ Cookie

Proxy គាំទ្រ credential តាមលំដាប់អាទិភាព៖

1. `ZTO_AUTHORIZATION` — header ពេញ (ឧ. `Bearer …`)។ ជម្រើសល្អបំផុតបើ
   ZTO ផ្តល់ API token/OAuth ជាផ្លូវការ។
2. `ZTO_TOKEN` + `ZTO_TOKEN_HEADER` — សម្រាប់ token/header ផ្លូវការរបស់ ZTO។
3. `ZTO_COOKIE` — fallback បច្ចុប្បន្ន ដែលអស់សុពលភាពតាម session។

`ZTO_PROXY_KEY` នៅតែជាច្រកការពាររវាង ZoeW និង Netlify Function។ Credential
ទាំងនេះត្រូវដាក់ក្នុង Netlify environment variables ហើយសម្គាល់ជា secret;
កុំដាក់ក្នុង repository ឬ JavaScript ខាង browser។ Netlify បញ្ជាក់ថា Functions
អាចអាន secret environment variables ខាង server និង Secrets Controller អាចធ្វើ
ឱ្យវា write-only/កំណត់ scope៖

- https://docs.netlify.com/build/functions/environment-variables/
- https://docs.netlify.com/build/environment-variables/secrets-controller/

### តើ Netlify អាច login `argus.ztoglobal.com` ជំនួស Cookie បានទេ?

**មិនគួរប្រើជាផ្លូវ production។** ZoeW/Netlify domain មិនអាចអាន Cookie
HttpOnly/secure របស់ `argus.ztoglobal.com` ពី browser របស់ភ្នាក់ងារបានទេ ព្រោះ
same-origin boundary។ អាចសរសេរ headless-browser bot ខាង server ឱ្យវាយ username/
password ប៉ុន្តែវា៖

- ត្រូវរក្សាពាក្យសម្ងាត់ ZTO និងអាចជាប់ CAPTCHA/MFA/device verification;
- ពឹងលើ DOM/login flow មិនបានចងក្រងជាសាធារណៈ ហើយអាចខូចពេល ZTO កែ UI;
- អាចផ្ទុយនឹងគោលការណ៍ប្រើប្រាស់ ZTO និងនៅតែបង្កើត session ដែលផុតកំណត់។

ដំណោះស្រាយរឹងមាំគឺស្នើ ZTO សម្រាប់ **official API token, OAuth client,
service account ឬ partner API**។ កូដកំណែនេះត្រៀមទទួល Authorization/token រួច។
បើ ZTO មិនផ្តល់វិធីនោះ ត្រូវរក្សា Cookie rotation ជា fallback។

## Security Audit

- Secret scan 102 assertions pass; មិនរកឃើញ service-account key, `.env`,
  private key ឬ credential ពិតក្នុង archive។ `config.json`, `secrets/`, backup
  output និង logs ស្ថិតក្នុង `.gitignore`។
- XSS sinks ប្រើ `sanitizeInput()` ឬ `textContent`; inline-handler/XSS guards,
  HTML sink escaping និង CSP structure pass។ CSP បិទ object/embed, base hijack,
  cross-origin frame និងកំណត់ connect origins។
- Netlify proxy ផ្ទៀងផ្ទាត់ proxy key ដោយ timing-safe compare, validate barcode,
  មិន forward header គ្រោះថ្នាក់, មិនបញ្ចេញ upstream payload និងមាន
  `no-store`, `nosniff`, `DENY`, `no-referrer`។
- Firebase backup កំណត់ OAuth token endpoint ទៅ Google HTTPS host និង Database
  URL ទៅ Firebase RTDB root ដើម្បីទប់ credential exfiltration/SSRF។ Private key
  ចុះហត្ថលេខា JWT ក្នុង memory; access token បញ្ជូនតាម Authorization header
  មិននៅក្នុង URL/log។ Firebase ពន្យល់ OAuth service-account REST flow ផ្លូវការ៖
  https://firebase.google.com/docs/database/rest/auth
- Runtime dependency audit របស់ backup tool៖ **0 info · 0 low · 0 moderate ·
  0 high · 0 critical**។

### ហានិភ័យស្ថាបត្យកម្មដែលមិនគួរកែស្ងាត់ៗ

Operational Firebase rules អនុញ្ញាត read/write ដល់ `auth != null` លើ data nodes។
វាសុវត្ថិភាពតែបើ **មួយ Firebase project ក្នុងមួយអាជីវកម្ម** និង Admin គ្រប់គ្រង
account issuance យ៉ាងតឹង។ បើមានអាជីវកម្មច្រើនក្នុង project តែមួយ ឬអ្នកណាក៏អាច
បង្កើត Firebase Auth account បាន នោះ authenticated user ម្នាក់អាចឃើញ/កែ data
រួម។ ការកែត្រឹមត្រូវត្រូវការជម្រើស deployment មួយ៖ UID allowlist, custom claims/
tenant path ឬ trusted backend។ Rules មិនត្រូវបានប្តូរក្នុងជុំនេះ ដើម្បីកុំ lock
អ្នកប្រើ production ដោយគ្មានបញ្ជី UID/role ដែលបានបញ្ជាក់។

## ភស្តុតាងតេស្ត

- Function inventory៖ ZoeW **519 top-level + 32 named nested + 1,149
  function/callback nodes + 99 routes**; ZoeKeyGen **114 + 5 + 265 + 20 routes**;
  helper/server **286 nodes ក្នុង 14 files**។ គ្មាន function declaration ស្ទួន
  ឬ UI action ដែលចង្អុលទៅ function អវត្តមាន។
- Business rules៖ `policy-test`, `partial-pickup-cleanup-test` (50),
  `expired-trash-retention-test` (11), `trash-modal-test` (58), restore/clear
  races និង revenue fuzz pass។
- Network៖ connection recovery (171), reconnect ladder (21), lookup prefetch
  (141), lookup freshness (131), stall/timeout/SW/listener suites pass។
- Security៖ secret hygiene (102), HTML sinks (9), dependency security (11),
  Firebase backup (28), schema/rules/static CSP suites pass។
- Meta-audit៖ checker coverage **16/16**; checker ទាំង 109 អាចចង្អុលទៅ tree
  ផ្សេង និងធ្លាក់លើ tree ទទេ ដូច្នេះ “បៃតង” មិនមែន checker ទទេ។
- Test ថ្មីទាំងពីរធ្លាក់លើ baseline មុនកែ៖ baseline គ្មាន retention 2ថ្ងៃ និង
  នៅតែពឹង `firebase-admin` ចាស់។

### កម្រិតនៃបរិស្ថានតេស្តនេះ

ម៉ាស៊ីន audit មិនមាន Chromium binary និង Firebase RTDB emulator កំពុងរត់។ ដូច្នេះ
23 browser/emulator checks រំលង និង 12 checks រត់ផ្នែក static/VM តែប៉ុណ្ណោះ។
CI ដែលមាន Chromium + emulator ត្រូវរត់ម្តងទៀតមុន production deploy; ក្នុង CI
`CRUD_FLOW_STRICT=1` ធ្វើឱ្យ emulator skip ក្លាយជា fail។ កុំបកស្រាយ exit 0 នៃ
ម៉ាស៊ីននេះថាបានធ្វើ real-device iPhone/Android និង live Firebase test រួច។

## សកម្មភាព Deploy

1. Deploy `ZoeW` static files និង Netlify Function ថ្មី។
2. នៅ Netlify កំណត់ `ZTO_PROXY_KEY` និង auth មួយក្នុងចំណោម
   `ZTO_AUTHORIZATION` / `ZTO_TOKEN` / `ZTO_COOKIE` ជា secret; redeploy ក្រោយកែ env។
3. មិនត្រូវ Publish Firebase rules សម្រាប់ជុំនេះទេ — rules មិនបានប្តូរ។
4. ម៉ាស៊ីន `firebase-backup` ត្រូវ Node.js 18+; `npm install` លែងចាំបាច់។
5. មុន production សាក staging៖ barcode បិទ >2h, barcode open នៅ 7ថ្ងៃគត់,
   open >7ថ្ងៃ, restore ម្តង និង expiry-trash >2ថ្ងៃ ដោយប្រើ Firebase server time។
