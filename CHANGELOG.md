# កំណត់ត្រាការផ្លាស់ប្តូរ (Changelog)

កំណត់ត្រានៃរាល់កំណែ **`APP_VERSION`** របស់ប្រព័ន្ធ Zoe។ **កំណែជារបស់ App
នីមួយៗ** (តាំងពី 2.19.4) — ឡើងតែ App ដែលកែពិត ហើយ `app.js` ត្រូវស៊ីនឹង
`manifest.json` **ក្នុង App ដដែល** (ពិនិត្យដោយ `node audit-tools/version-check.js`
និង `node audit-tools/version-bump-scope.js`)។

> **ច្បាប់សរសេរ៖** រាល់ជុំ audit ត្រូវឡើងកំណែ ហើយត្រូវបន្ថែមផ្នែកថ្មីនៅខាងលើគេ
> ក្នុងឯកសារនេះ **ក្នុង commit ដដែល**។ សរសេរជាភាសាខ្មែរ ដោយប្រាប់ថា
> *អ្នកប្រើឃើញអ្វីខុសពីមុន* មិនមែនត្រឹមតែឈ្មោះ function ដែលកែទេ។
>
> ចំណាំ៖ **`CACHE_VERSION` មិនមែនជា `APP_VERSION` ទេ** — `CACHE_VERSION`
> (`<app>-vN` ក្នុង `sw.js`) bump រាល់ពេលឯកសារ static ណាមួយប្រែ ចំណែក
> `APP_VERSION` ជាកំណែផលិតផលតាម semver ដែលបង្ហាញក្នុងប្រអប់ login និងរបា Slide។

ទម្រង់ផ្នែកនីមួយៗ៖

```
## [X.Y.Z] — YYYY-MM-DD
### កែកំហុស · បន្ថែម · ផ្លាស់ប្តូរ · សុវត្ថិភាព · ល្បឿន · ឧបករណ៍ audit
- ...
### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- (ឧ. Firebase rules ត្រូវ paste ចូល Console ➜ Publish) ឬ «គ្មាន»
```

---

## [ZoeW 2.24.1] — 2026-08-31 · ZTO Argus Auto-login

ជុំនេះកែតែ **ZoeW** (`zoew-v139` ➜ `zoew-v140`)។ ZoeKeyGen និង Firebase
Rules មិនបានប្តូរ។

### បន្ថែម · ផ្លាស់ប្តូរ

- Netlify Function អាចបើក headless Chromium ចូល `argus.ztoglobal.com` តាម
  ZTO IDaaS ដោយ `ZTO_USERNAME`/`ZTO_PASSWORD`, ទាញ `BOS-MAN-SESSION` និង
  lookup លេខទូរស័ព្ទ/COD/DOD ដោយមិនចាំបាច់ copy Cookie រាល់ពេលផុតកំណត់។
- Session ត្រូវ encrypt ដោយ AES-256-GCM ជាមួយ `ZTO_SESSION_ENCRYPTION_KEY`
  មុនរក្សាទុកក្នុង Netlify Blobs strong-consistency។ Login lock ទប់ Function
  ច្រើនកុំឱ្យ login ស្ទួន ហើយ session ត្រូវភ្ជាប់នឹង credential ដើម្បីកុំឱ្យ
  password/username ថ្មីប្រើ session របស់គណនីចាស់។
- ពេល Cookie/auto session ត្រូវ ZTO បដិសេធ Proxy refresh តែម្តង និង retry
  order detail តែម្តង។ `ZTO_AUTHORIZATION`/`ZTO_TOKEN` នៅតែឈ្នះ និងមិនត្រូវ
  downgrade ទៅ password login ដោយស្ងាត់; `ZTO_COOKIE` នៅតែជា manual fallback។
- ZoeW រង់ចាំ ZTO auto-login ក្នុងមួយ request ដល់ ៥៨វិនាទី ប៉ុន្តែ manual
  auto-fallback ១.៨វិនាទី និង Fast Mode ១០នាទីនៅដដែលពេញលេញ។

### សុវត្ថិភាព · កែកំហុស · ឧបករណ៍ audit

- Auto-login អនុញ្ញាតតែ HTTPS host Argus/API/IDaaS ដែលបានចាក់សោ។ CAPTCHA,
  MFA, security verification, password ខុស ឬ login flow មិនស្គាល់ត្រូវឈប់
  ដោយសុវត្ថិភាព; គ្មានការដោះ/bypass challenge និងគ្មាន login loop។
- Response ទៅ browser មានតែ safe error code; Username, Password, Cookie,
  encryption key និង internal error មិនត្រូវបានបញ្ជូន ឬកត់ក្នុង UI។
- ចាក់សោកំណែ `@netlify/blobs` 11.0.2, `@sparticuz/chromium` 149.0.0 និង
  `puppeteer-core` 25.1.0 ក្នុង `package-lock.json`; Function ប្រើ esbuild និង
  memory 2GB សម្រាប់ Chromium។
- បន្ថែម `zto-session-test.js` សម្រាប់ encryption/tamper, cookie scope,
  session reuse, concurrent-login lock, credential rotation និង CAPTCHA backoff;
  ពង្រីក `zto-proxy-test.js` សម្រាប់ auto session, expired-cookie refresh ម្តង,
  official-token precedence និង safe challenge response។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ក្នុង Netlify ដាក់ `ZTO_AUTO_LOGIN=true`, `ZTO_USERNAME`, `ZTO_PASSWORD`,
  `ZTO_SESSION_ENCRYPTION_KEY` និង `ZTO_PROXY_KEY` ជា Secret/Functions variables
  រួច Trigger deploy។ បង្កើត key ដោយ `openssl rand -base64 32`។
- អាចលុប `ZTO_COOKIE` ក្រោយ auto-login ដំណើរការ។ បើ ZTO ទាមទារ CAPTCHA/MFA
  សូមប្រើ Cookie ដោយដៃ ឬស្នើ official API token/service account; App មិន bypass ទេ។

---

## [ZoeW 2.24.0] — 2026-08-31 · expired ២ថ្ងៃ · ZTO auth status · Deep Audit

ជុំនេះកែតែ **ZoeW** (`zoew-v138` ➜ `zoew-v139`)។ ZoeKeyGen និង Firebase
Rules មិនបានប្តូរ។

### បន្ថែម · កែកំហុស

- កញ្ចប់ដែលចូលធុងសំរាមដោយច្បាប់ផុតកំណត់ ៨ថ្ងៃ (`trashReason: expired`)
  ឥឡូវលុបអចិន្ត្រៃយ៍ក្រោយនៅក្នុងធុងសំរាមលើស ២ថ្ងៃ។ `delete`, `remove` និង
  `pickup` នៅតែរក្សា ៣០ថ្ងៃដដែល។ ទិន្នន័យ legacy ដែលគ្មាន `trashReason`
  មិនត្រូវសន្មត់ថា expired ទេ ដើម្បីជៀសវាងលុបខុស។
- កែ off-by-one នៃគោលការណ៍ «លើស ៧ថ្ងៃ ➜ ដកនៅថ្ងៃទី ៨»៖ កូដចាស់រង់ចាំ
  លើស ៨×២៤ ម៉ោង (យឺតមួយថ្ងៃ)។ ឥឡូវនៅ ៧×២៤ ម៉ោងគត់មិនទាន់ដក តែពេល
  លើស ៧ថ្ងៃទើបដកតែ barcode ដែលមិនទាន់យក។
- ច្បាប់ purge ថ្មីនៅតែទាមទារនាឡិកា Firebase ដែលបាន sync និងការភ្ជាប់ពិត;
  restore claim ដែលនៅរស់អាចទប់ purge ហើយ claim ងាប់ត្រូវដោះមុនលុប។
- ZTO proxy បែងចែក session/token ផុតកំណត់, rate limit, timeout និងការខ្វះ auth
  config ជា status/code ដាច់ពីគ្នា។ App បង្ហាញសារ ZTO session ផុតកំណត់ច្បាស់
  ហើយ 401/403 មិនត្រូវ retry ដូច 5xx ទៀត។
- ZTO login redirect និង HTML login page (ករណី Cookie ផុតកំណត់ដែលមិនឆ្លើយ JSON)
  ត្រូវបានចាប់ជា `ZTO_AUTH_EXPIRED` ដែរ មិនបង្ហាញជា network error មិនច្បាស់ទៀត។
- `ZTO_AUTHORIZATION` ឬ `ZTO_TOKEN` ឈ្នះ `ZTO_COOKIE` ដោយច្បាស់ ដូច្នេះអាច
  ប្តូរទៅ credential ផ្លូវការបានដោយមិនឱ្យ Cookie ចាស់រំខាន request។

### សុវត្ថិភាព · ឧបករណ៍ audit

- Proxy មិនបញ្ជូន upstream error វែង/តួ control ទៅ browser, បន្ថែម response
  hardening headers និងបដិសេធដំណើរការបើគ្មាន ZTO auth server-side។
- បន្ថែម `expired-trash-retention-test.js` ដែលរត់កូដពិត និងចាក់សោព្រំដែន ២ថ្ងៃ,
  retention ៣០ថ្ងៃ, restore race និង barcode registry release។ Test ZTO ត្រូវបាន
  ពង្រីកសម្រាប់ auth មិនបានកំណត់, session expired, 429 និង official token precedence។
- ដក `firebase-admin` និង dependency tree ដែលមាន security advisory ចេញពីឧបករណ៍
  backup។ វាប្រើ native OAuth/REST, `Authorization: Bearer`, timeout + retry,
  file permission 0600 និង run lock; `npm audit` ឥឡូវ 0 vulnerability។
- បន្ថែម `firebase-backup-test.js` ចាក់សោ OAuth signature/scope, SSRF URL guard,
  retry policy, atomic gzip, retention, file permission និង concurrent-run race។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Deploy static files និង Netlify Function របស់ ZoeW។ មិនត្រូវ Publish Firebase
  Rules ទេ។ បើ ZTO ផ្តល់ token ផ្លូវការ សូមប្រើ `ZTO_AUTHORIZATION` ឬ
  `ZTO_TOKEN`; បើមិនទាន់មាន សូមរក្សា `ZTO_COOKIE` ដដែល។
- ម៉ាស៊ីនដែលរត់ `firebase-backup` ត្រូវប្រើ Node.js 18 ឬថ្មីជាងនេះ; `npm install`
  លែងចាំបាច់។

---

## [ZoeW 2.23.6] — 2026-08-31 · បំពេញស្ថានភាព ZTO និងធ្វើឱ្យ Audit ត្រូវនឹងកូដពិត

ជុំកែបន្ទាន់នេះកែតែ **ZoeW** (`zoew-v137` ➜ `zoew-v138`)។ ZoeKeyGen,
Firebase Rules, Environment Variables, Fast Mode, manual auto-fallback និងច្បាប់
Barcode/ស្ថិតិមិនបានប្តូរ។

### កែកំហុស

- បន្ថែមតំបន់ `lookupStatus` ដែល commit 2.23.5 ភ្លេចដាក់ក្នុងប្រអប់លេខទូរស័ព្ទ។
  ស្ថានភាព ZTO/API «កំពុងស្វែងរក · cache · រកឃើញ · ព្រមាន · offline · error»
  ឥឡូវបង្ហាញពិតជាមួយពណ៌ដាច់ពីគ្នា និង `aria-live="polite"` សម្រាប់ screen reader។
- កែ test sandbox ៣ ដែលមិនបានផ្ទុក helper ថ្មី `clearLookupStatus()` និងមិនបាន
  ផ្តល់ dependency របស់ `saveLookupApiConfig()`។ កំហុស `ReferenceError` ទាំងនេះ
  ជាកំហុស checker មិនមែនការខូច camera, logout ឬការរក្សាទុក Secret ក្នុង App ពិត។
- ឱ្យ `dom-hygiene` ស្គាល់ផ្លូវសម្អាត `lookupStatus` ពិត និងកត់ហេតុផលអនុញ្ញាត
  នាឡិកា local របស់ ZTO warm-up ក្នុង `clock-hygiene`។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Deploy static files របស់ ZoeW។ មិនត្រូវ Publish Firebase Rules ឬប្តូរ
  Environment Variables ទេ។

---

## [ZoeW 2.23.5 · ZoeKeyGen 2.19.15] — 2026-08-31 · Retry ZTO ពិត · race fence · SheetJS security

ជុំ Deep Audit ទី ២ កែ **ZoeW** (`zoew-v136` ➜ `zoew-v137`) និង
**ZoeKeyGen** (`zoekeygen-v84` ➜ `zoekeygen-v85`)។ ច្បាប់ Barcode/ស្ថិតិ,
Firebase Rules, Fast Mode និង manual auto-fallback មិនត្រូវបានដក ឬប្តូរ។

### ZTO lookup និង network

- HTTP 408/425/429 និង 5xx ឥឡូវបង្កឱ្យ retry ពិតក្នុង `retryAsync()`។ មុនកែ
  `fetch()` resolve ជាធម្មតាសម្រាប់ HTTP error ដូច្នេះ 429/503 ត្រូវបានបោះ
  **ក្រៅ** retry wrapper ហើយសំណើទី ២ មិនដែលចេញ។ 401/403 នៅតែមិន retry។
- URL `/.netlify/functions/zto-order-detail/` ដែលមាន slash ខាងចុង ត្រូវបាន
  សម្គាល់ជា ZTO ត្រឹមត្រូវ; វាមិនអាចធ្លាក់ទៅផ្លូវ API តារាង និងបាញ់ `list=1`។
- `autoLookupInFlight` ប្រើ token តាម generation។ សំណើចាស់ដែលចប់ក្រោយប្តូរ
  Config មិនអាចដោះសោរបស់សំណើថ្មី ហើយបើកឱ្យសំណើទី ៣ ស្ទួនបានទៀត។
- Fast Mode ១០ នាទី និង manual auto-fallback ១.៨ វិនាទីនៅដដែលពេញលេញ។

### Firebase reconnect

- ZoeKeyGen បន្ថែម generation fence ដូច ZoeW លើ callback
  `.info/connected` និង `.info/serverTimeOffset`។ callback ចាស់ក្រោយ detach/
  reattach មិនអាចលុប pending state ថ្មី, បង្ហាញ connected ក្លែងក្លាយ ឬទុកចិត្ត
  server-time offset ចាស់បានទេ។ `off()` នៅតែរត់មុន attach ការពារ listener ស្ទួន។

### សុវត្ថិភាព dependency និង checker

- ZoeW vendor SheetJS `0.18.5` ត្រូវបានជំនួសដោយ release ផ្លូវការ `0.20.3`
  ដែលបានផ្ទៀងផ្ទាត់ SHA-256/SHA-384។ Import/export, Barcode និងលេខទូរស័ព្ទដែល
  មាន 0 នាំមុខត្រូវបានសាកល្បងលើឯកសារ `.xlsx` ពិត។
- ទំព័រ Web បម្រុង `zto-import/Index.html` ក៏ប្តូរពី unpkg 0.18.5 ទៅ
  `cdn.sheetjs.com` 0.20.3 ជាមួយ SRI ដែរ។
- ទំព័រ Web បម្រុងលែងរក្សា `IMPORT_PASSWORD` plaintext ក្នុង `localStorage`
  ឬ auto-unlock ពី secret នោះ។ ពេល boot វាលុប key ចាស់
  `zto_import_password`; secret ថ្មីរស់តែក្នុង memory ខណៈទំព័របើក ហើយ browser
  password manager នៅតែអាចបំពេញវាល `current-password` ដោយសុវត្ថិភាព។
- បន្ថែម `dependency-security-test.js` ១១ assertions និងបញ្ចូលក្នុង
  `run-all.sh`។ កែ `scan-engine-test.js` ឱ្យ `await` ការឌិកូដពិត មិនមែនវាស់តែ
  ការបង្កើត Promise; warm-up និងយក sample ល្អបំផុតពី ៣ ជុំដើម្បីដក scheduler
  pause ខណៈការអះអាង CODE-128/WASM/ITF នៅតឹងដដែល។
- ពង្រីក sandbox របស់ `lookup-freshness-test.js` ឱ្យរត់ helper HTTP retry និង
  retry scheduler ពិតដែល `fetchCustomerDataTableRows()` ពឹងផ្អែក; ឥឡូវឆ្លង
  ១៣១/១៣១ ជំនួសការធ្លាក់ដោយ `ReferenceError` របស់ checker ខ្លួនឯង។
- បន្ថែម `function-surface-test.js` ដើម្បី inventory function/callback ទាំង
  App និង helper/server ដែល ship។ វារកឃើញ `closeGlobalMoreMenu()` ប្រកាសស្ទួន
  ២ ដងក្នុង ZoeW; ដក declaration ចាស់ដែលត្រូវ declaration ក្រោយសរសេរជាន់។
  កូដទាំងពីរធ្វើដូចគ្នា ដូច្នេះ behavior មិនប្រែ តែបិទហានិភ័យ drift ស្ងាត់ៗ។

### ច្បាប់អាជីវកម្ម

- Function សំខាន់ ១៣ ដែលគ្រប Delete/Remove/Restore/cleanup/revenue ត្រូវបាន
  ប្រៀបធៀបនឹង baseline 2.23.4; body ដូចគ្នា ១៣/១៣។ Firebase Rules ទាំងពីរ
  មិនមាន diff។ ច្បាប់ ២ ម៉ោង/៨ ថ្ងៃ/៣០ ថ្ងៃ និង `isDeducted` នៅដដែល។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Deploy static files របស់ ZoeW និង ZoeKeyGen។
- បើប្រើទំព័រ Web បម្រុងរបស់ zto-import៖ copy `Index.html` ទៅ Apps Script
  ហើយ Deploy ជាកំណែថ្មី។ **មិនត្រូវ Publish Firebase Rules**។

---

## [ZoeW 2.23.4 · ZoeKeyGen 2.19.14] — 2026-08-30 · ZTO លឿន · ស្ថានភាព Lookup · `.info/*` attach race

ជុំនេះកែ **ZoeW** (`zoew-v135` ➜ `zoew-v136`) និង race ក្នុង helper Firebase
ដែលមាននៅ **App ទាំង ២** (`zoekeygen-v83` ➜ `zoekeygen-v84`)។ តក្កវិជ្ជា
Barcode/ស្ថិតិ និង Firebase Rules មិនបានប្តូរ។

### ល្បឿន និងស្ថានភាព ZTO

- ZoeW លែងបម្លែង ZTO URL ទៅ `?list=1` ដែល Netlify Function មិនគាំទ្រ។ Request
  បញ្ជីដែលតែងតែ HTTP 400 មិនប្រជែង bandwidth/connection ជាមួយការស្កេនទៀត។
- App warm-up `/.netlify/functions/zto-order-detail` ជាមុនដោយ `OPTIONS` ម្តងក្នុង
  ១០ នាទី។ វាមិនផ្ញើ Barcode, Cookie ឬ Proxy Key ហើយមិនរត់ពេល Offline,
  Data Saver/2G, មិនទាន់ចូលប្រព័ន្ធ ឬ Lookup ត្រូវបានបិទ។
- ពេល request ទី ១ បរាជ័យបណ្តោះអាសន្ន ZTO retry ទី ២ ចាប់ផ្តើមក្រោយ
  **៣៥០ms** ជំនួស **១.៥ វិនាទី**។ ជោគជ័យលើកទី ១ មិនមាន delay បន្ថែម។
- Cooldown ក្រោយបរាជ័យក្លាយជាតាម Barcode មួយៗ។ Barcode មួយដែលខូចមិនរាំង
  Barcode បន្ទាប់ ៣០ វិនាទីទៀត។ Map មានពិដាន ១០០ ដើម្បីកុំឲ្យ memory រីក។
- Fast Mode លែង cache `{found:false}` ជាលទ្ធផលអវិជ្ជមាន ១០ នាទី។ Barcode ដែល
  ទើបមាននៅ ZTO អាចរកឃើញលើការស្កេនបន្ទាប់។
- ប្រអប់លេខទូរស័ព្ទបង្ហាញស្ថានភាព «កំពុងស្វែងរក · cache · រកឃើញ · offline ·
  រកមិនឃើញ · error» ដោយ `textContent` និង `aria-live`; response ចាស់របស់ Barcode
  មុនមិនអាចសរសេរជាន់ស្ថានភាព Barcode ថ្មី។
- **Manual auto-fallback រក្សាទុកពេញលេញ**៖ បើ ZTO យឺតជាង ១.៨ វិនាទី វាល
  លេខទូរស័ព្ទទទួល focus ខណៈ request នៅតែបន្ត។ វាមិនលេចពីក្រោយ PIN,
  មិនរំខានពេលបានវាយរួច, មិនចាប់ Barcode ចាស់ និង focus តែម្តង។

### Firebase reconnect race

- ពេល attach `.info/connected` និង `.info/serverTimeOffset` ឡើងវិញ App ទាំង ២
  កត់ listener ទាំងពីរជា pending មុន callback មកដល់។ callback របស់មួយមិនអាច
  លុប recovery state មុន listener មួយទៀតបញ្ជាក់ថារស់បានទៀត។

### ច្បាប់អាជីវកម្ម និងសុវត្ថិភាព

- មិនប្តូរច្បាប់៖ Delete កញ្ចប់មិនដកចំណូល; Remove Barcode/ផុត ៨ ថ្ងៃដកចំណូល;
  Restore បូកតែបើ `isDeducted=true`; cleanup «យករួច» ២ ម៉ោងមិនប៉ះចំណូល;
  ធុងសំរាម purge ៣០ ថ្ងៃ។ Emulator ផ្ទៀងផ្ទាត់ replay fence និង rules ពិត។
- ស្ថានភាព Lookup សរសេរដោយ `textContent`; warm-up មិនផ្ញើ secret; Service Worker
  នៅតែ network-only សម្រាប់ Netlify Functions និងមិន cache ទិន្នន័យ ZTO។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Deploy static files របស់ ZoeW និង ZoeKeyGen។ **មិនត្រូវ Publish Firebase Rules**
  ព្រោះ rules មិនបានប្តូរ ហើយមិនត្រូវប្តូរ Environment Variables ដែលមានស្រាប់។

---

## [ZoeW 2.23.3 · ZoeKeyGen 2.19.13] — 2026-08-30 · Deep Audit បណ្តាញ · Race · Secret · Service Worker

ជុំនេះកែ **ZoeW** (`zoew-v134` ➜ `zoew-v135`) និង helper បណ្តាញដែលចែករំលែក
ជាមួយ **ZoeKeyGen** (`zoekeygen-v82` ➜ `zoekeygen-v83`)។ មិនប៉ះតក្កវិជ្ជាលុយ
ការលុប/ស្តារ PTR កាយវិការ ឬរូបរាង UI ទេ។

### កែកំហុស និង Race

- ការស្កេន ZTO លើកដំបូងខណៈ Secret នៅជាប់សោ ឥឡូវ Promise រង់ចាំការវាយ PIN
  និង ZTO response ពិត។ Keyboard មិនលោតមុន Lookup ចប់ ហើយការស្កេនដើមបន្ត
  ដោយស្វ័យប្រវត្តិ ក្រោយដោះសោ។ ការបិទប្រអប់ PIN ដោះ Promise ដោយស្អាត។
- Firebase data listener និង `.info/*` listener មាន generation fence។ callback
  ដែលត្រូវ queue មុន Logout, Reconfig ឬ Reconnect មិនអាចសរសេរជាន់ snapshot
  ថ្មី ឬបង្ហាញ Online/Offline ក្លែងក្លាយបានទៀត។
- ការពិនិត្យ Session និង License តាម `setInterval` មាន in-flight guard។ timer
  ពីរដែលជាន់គ្នាបាញ់ Server តែមួយសំណើ ហើយការអាន Firebase token មានពិដាន
  ១៥ វិនាទី។

### បណ្តាញ និង Service Worker

- `fetchWithTimeout()` និង Service Worker របស់ App ទាំង ២ បញ្ជូន caller abort
  ទៅសំណើពិត។ ពេល App timeout ឬអ្នកប្រើបោះបង់ request វាមិនបន្សល់សំណើ zombie
  ក្នុង Service Worker ដែលទៅជាន់នឹង retry ថ្មីទៀត។
- ZTO proxy កំណត់ពិដាន upstream ១២ វិនាទី ខណៈ client រង់ចាំ ១៦ វិនាទី ដើម្បី
  ឲ្យ proxy មានពេលបិទសំណើ និងឆ្លើយ error មុន client retry។
- ZTO ដែលឆ្លើយ HTTP 200 ប៉ុន្តែ `success:false` ឥឡូវក្លាយជា HTTP 502 ត្រឹមត្រូវ;
  ZoeW មិន cache ជួរទទេថាជាជោគជ័យទៀត។

### សុវត្ថិភាព

- ក្រោយដោះសោ PIN Secret Lookup ចាស់ដែលធ្លាប់នៅ plaintext ត្រូវបម្លែងទៅ
  AES-GCM និងលុប plaintext ចេញពី storage ដោយស្វ័យប្រវត្តិ។
- ZTO proxy បញ្ជូនតែ `phone`, `cod`, `dod`, `barcode`, `success`; ឈ្មោះអតិថិជន
  និងគោលដៅដែល UI មិនប្រើត្រូវបានដកចេញ។ Extra header មិនអាចសរសេរជាន់
  `Host`, `Cookie`, `Authorization`, `Origin`, `Referer` ឬ hop-by-hop header។
- Static secret scan ១០២ assertion និង HTML sink/XSS escaping ៩ assertion ឆ្លងកាត់។

### ឧបករណ៍ audit

- បន្ថែម `sw-abort-propagation-test.js` និង `periodic-network-guard-test.js`;
  ពង្រីក `lookup-prefetch-test.js`, `lookup-config-secret-test.js`,
  `connection-recovery-test.js` និង `zto-proxy-test.js` សម្រាប់ regression ថ្មី។
- `checker-coverage.js` លែងរាប់ checker ដែលរាយ `SKIP` ថាជា «បៃតងលើថតទទេ»។
  Meta-audit ឥឡូវបញ្ជាក់ថា checker ទាំង ១០៥ មិនអាច pass លើ tree ទទេ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Deploy Netlify កំណែថ្មី។ មិនត្រូវប្តូរ Firebase rules ឬ Environment Variables
  ដែលមានស្រាប់ទេ។ បើ ZTO Cookie ផុតកំណត់ ត្រូវ Login ZTO ម្តងទៀត ប្តូរ
  `ZTO_COOKIE` ហើយ Trigger deploy ដូចធម្មតា។

---

## [ZoeW 2.23.2 · ZoeKeyGen 2.19.12] — 2026-08-29 · listener `.info/*` ដែលងាប់តែឯង · រូបរាងប្រអប់

ជុំនេះកែ **ZoeW** (`zoew-v128` ➜ `zoew-v129`) និង **ZoeKeyGen**
(`zoekeygen-v81` ➜ `zoekeygen-v82` — វាចែករំលែក helper ស្តារ `.info/*` ដដែល)។
វា **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត ·
ស្ថិតិយក · លុយ) និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ** ដែរ។

### កែកំហុស ៖ listener `.info/*` ដែលងាប់តែឯង

ច្បាប់ 2.20.8 — «**listener ដែលងាប់តែឯង មិនត្រូវប្រកាសជាសះស្បើយដោយបងប្អូន**»
— ត្រូវបានអនុវត្តលើ listener **ទិន្នន័យ ៦** ប៉ុណ្ណោះ។ listener **`.info/*` ២**
នៅតែបញ្ជូន `handleInfoListenerError` **ទទេ** (គ្មានកូនសោ path) ➜ ការតាមដាន
ក្លាយជា **ការការពារដែលងាប់** — ជាការរំលោភផ្ទាល់លើច្បាប់ដែលឯកសារនេះចែងរួច។

លំដាប់ដែលវាស់បាន៖ `.info/serverTimeOffset` ងាប់តែឯង ➜ ការស្តារតាំងម៉ោង ២ វិ.;
តែ `.info/connected` បាញ់ក្នុងចន្លោះនោះ (តំណញ័រ) ➜ `clearInfoListenerRecovery()`
**លុបកាលវិភាគចោល** ➜ listener ដែលងាប់ **មិនដែល attach ឡើងវិញពេញវគ្គ** ➜
`serverTimeOffsetMs` **កក** ➜ `getServerNow()` រំកិលតាមនាឡិកាឧបករណ៍ស្ងាត់ៗ។

កំហុសទី ២ ៖ ការងាប់របស់ offset **តែម្នាក់ឯង** ធ្លាប់សរសេរ
`isDatabaseConnected = false` ➜ ស្លាកបង្ហាញ **«ក្រៅបណ្ដាញ» ខុស** ខណៈការភ្ជាប់
ដើរធម្មតា ហើយ watchdog វដ្ត `goOffline()`+`goOnline()` លើការតភ្ជាប់ដែលដំណើរការ។

ការកែ ៖ `infoListenerFailedPaths` កត់ថា path **ណា** ដែលងាប់;
`noteInfoListenerAlive(<key>)` រលត់ទង់ **តែពេលគ្មាន path ណានៅងាប់**; ហើយ
មានតែការងាប់របស់ `.info/connected` ទេដែលអាចប្រកាសថាដាច់បណ្តាញ។
⛔ **ZoeKeyGen ត្រូវកែដូចគ្នា** (`shared-fns.js` ទាមទារការអនុវត្តតែមួយ) —
ហើយនៅទីនោះវាធ្ងន់ជាង ព្រោះ `serverTimeSynced` ជាច្រកទ្វារនៃការចេញ Key។

### កែរូបរាង (របាយការណ៍អ្នកប្រើ ២ — មានរូបភាព)

**១. ប្រអប់ «🔌 API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ» ៖ checkbox ឃ្លាតគ្នាឆ្ងាយពេក។**
🔴 **ការថយក្រោយពីកំណែ 2.22.2** ៖ ជុំនោះបន្ថែម `min-height: 46px` លើ
`.modal-content input` ដើម្បីធ្វើឲ្យគោលដៅប៉ះធំល្មម — តែច្បាប់នោះក៏ធ្លាក់លើ
**`input[type="checkbox"]`** ដែរ។ `.remember-container input[type="checkbox"]`
ប្រកាស `height: 16px` **តែមិនប្រកាស `min-height`** ➜ `min-height` ឈ្នះ។
វាស់បានលើ Chromium ពិត ៖ checkbox **១៦ × ៤៦px** (លាតបញ្ឈរ) ➜ ជួរនីមួយៗខ្ពស់
៤៦px ➜ មើលទៅដូចឃ្លាតគ្នា។ ⛔ **វាប៉ះ checkbox គ្រប់ប្រអប់** មិនមែនតែប្រអប់នេះទេ។
ក្រោយកែ ៖ **១៦ × ១៦px**។ បូកនឹងការដក `<br><br>` ដែលបន្ថែមចន្លោះទទេ ~៣០px
ខាងលើ checkbox ទី ១ (កម្ពស់កថាខណ្ឌ ៩០px ➜ **៧២px**)។

**២. ប្រអប់ «🗑️ ធុងសំរាម» ៖ ប្រអប់ស្វែងរកមើលទៅដូច «ប្រអប់ក្នុងប្រអប់»។**
ច្បាប់ `.trash-search-box input` ឈរនៅ **បន្ទាត់ ៩៣០** ខណៈ
`.modal-content input` នៅ **បន្ទាត់ ៩៧៥** — **specificity ដូចគ្នា តែលំដាប់ចាញ់**
➜ ច្បាប់ទាំងអស់របស់វា (`border: none` · `text-align: left` · `padding`)
**ស្លាប់ស្ងាត់ៗ** ➜ input រក្សា `background: #f8fafc` + `border-radius: 8px` +
`border: 1px` ➜ ប្រអប់ប្រផេះមូលអង្គុយ **ក្នុង** ស្រោមសដែលមានគែម។ វាស់បាន ៖
input មាន `border: 1px solid` និង `border-radius: 8px` ហើយអត្ថបទ **តម្រឹមកណ្តាល**
(មិនមែនឆ្វេង)។ ក្រោយកែ ៖ ច្បាប់ផ្លាស់ទៅ **ក្រោយ** `.modal-content input`;
input ថ្លា គ្មានគែម គ្មានជ្រុងមូល តម្រឹមឆ្វេង; ហើយ **ស្រោម** ជាអ្នកកាន់គែម
រង្វង់ផ្តោត (`:focus-within`) និងគោលដៅប៉ះ ៤៦px។

### ឧបករណ៍ audit

- `connection-recovery-test.js` ៖ ១៤៦ ➜ **១៦០ assertion** (ធ្លាក់ **១១** លើ
  `origin/main`; mutation ៤ ➜ ចាប់បាន ៣ ហើយ ១ ជា equivalent mutant)។
- `layout-check.js` ៖ ៥៦ ➜ **៦៤ assertion** — វាស់ **ធរណីមាត្រពិត** នៃ
  checkbox និងប្រអប់ស្វែងរកធុងសំរាមក្នុង Chromium (ធ្លាក់ **៦** លើ `origin/main`)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules មិនប្រែសោះ ហើយ CSP ក៏មិនប្រែដែរ — គ្រាន់តែ deploy។

---

## [ZoeW 2.23.1] — 2026-08-29 · តំណ «ភ្ជាប់តែស្លាប់» លែងធ្វើឲ្យមុខងារងាប់ស្ងាត់ៗ

ជុំនេះកែ **ZoeW** តែមួយ (`zoew-v127` ➜ `zoew-v128`)។
វា **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម ·
ការសម្អាត · ស្ថិតិយក · លុយ) និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ ·
ការរមូរ · ទម្រង់បង្ហាញ** ដែរ។

### មូលហេតុពិត ១ ៖ ការហៅ Firebase ដែលព្យួរ (វាស់បាន មិនមែនអានកូដ)

Firebase RTDB **មិនបដិសេធការសរសេរពេលបណ្តាញអន់ទេ** — វាចាក់ជួរក្នុងឧបករណ៍
ហើយ promise ដោះ **តែពេល server ឆ្លើយតបប៉ុណ្ណោះ**។ ដូច្នេះលើតំណ
**«ភ្ជាប់តែស្លាប់»** (WiFi សាធារណៈដែលត្រូវ login មុន · តំបន់សេវាអន់ ·
proxy ដែលទទួលការតភ្ជាប់រួចស្ងាត់) ការហៅ Firebase **ព្យួរអស់កល្ប** —
វាមិនបោះកំហុសទេ ដូច្នេះកូដដែលរង់ចាំវា **រង់ចាំជារៀងរហូត**។

ផលដែលវាស់បាន៖ សោ «កំពុងដំណើរការ» ជាប់ជារៀងរហូត ➜ **ប៊ូតុងងាប់ស្ងាត់ៗ
រហូតដល់បិទបើក App** ដោយ **គ្មានសារកំហុសសោះ**៖

| មុខងារ | អ្វីកើតឡើងមុនកែ |
|---|---|
| ♻️ **Reset ចំនួនយករួច** | សោជាប់ ➜ ចុចម្តងទៀត **គ្មានប្រតិកម្មសោះ** |
| ❌ **លុបទាំងអស់** | សោជាប់ដដែល |
| 🔄 **ស្តារពីធុងសំរាម** | ប្រអប់បិទ រួច **គ្មានអ្វីកើតឡើងសោះ** |
| ✔️ **សម្គាល់ការខល** | ការសម្គាល់ **បាត់ស្ងាត់ៗ** — ជួរព្យាយាមវិញ (កំណែ 2.20.2) ក៏ងាប់ដែរ ព្រោះការព្យួរមិនបោះកំហុស ➜ គ្មានអ្វីចូលជួរ |
| ការជួសជុលស្ថិតិយកស្វ័យប្រវត្តិ | ឈប់ដំណើរការពេញវគ្គ |

### កែកំហុស

- **រាល់ការហៅ Firebase ឥឡូវមានពិដាន ១៥ វិនាទី** (`dbOp()`) ➜ ការព្យួរ
  ក្លាយជា **កំហុសធម្មតា** ➜ ផ្លូវដោះកំហុសដែលមានស្រាប់ (ដោះសោ · ត្រឡប់
  ស្ថានភាពដើមវិញ · បង្ហាញសារ) ដំណើរការដូចធម្មតា។
- **សារប្រាប់ការពិត** ៖ «⚠️ បណ្តាញឆ្លើយមិនចេញ — … សូមពិនិត្យអ៊ីនធឺណិត
  ហើយសាកល្បងម្តងទៀត។» ⛔ មិនមែនសារជោគជ័យ ហើយក៏មិនមែនភាពស្ងាត់ដែរ។
- **ការងារជាក្រុមបោះបង់ភ្លាមពេលតំណស្លាប់** — Reset «ទាំងអស់» លើ ៣០ ថ្ងៃ
  មុននេះនឹងសោជាប់ ៣០ × ១៥ វិនាទី (**៧,៥ នាទី**); ឥឡូវវាឈប់ក្រោយការព្យួរ
  **ដំបូង** ហើយប្រាប់ថាធ្វើបានប៉ុន្មាន។
- ⛔ **ផ្លូវស្កេន-រក្សាទុកមិនប្រែសោះ** — វាមានពិដាន និងការរាយការណ៍យឺត
  («រក្សាទុកបានជោគជ័យ» ដែលមកយឺត) ផ្ទាល់ខ្លួនរួចហើយ។ ការដាក់ពិដានជាន់
  នឹងធ្វើឲ្យ barcode ដែល claim ជោគជ័យយឺត **មិនដែលត្រូវដោះចេញ** ➜
  barcode នោះស្កេនចូលមិនបានទៀត។ ការលើកលែងនេះកត់ត្រាជាប់ក្នុងឧបករណ៍។

### សុវត្ថិភាព

- **CSV formula injection** ៖ «ទីតាំង Locker» ជាអត្ថបទសេរីរបស់អ្នកប្រើ។
  ឈ្មោះទូដែលចាប់ផ្តើមដោយ `=` `+` `-` `@` ធ្លាប់ក្លាយជា **រូបមន្តរស់**
  ពេលបើកឯកសារ CSV ក្នុង Excel ឬ Google Sheets (ឧ. `=HYPERLINK(…)`)។
  ឥឡូវតម្លៃបែបនោះត្រូវណេយ្យកម្មមុន Export។ ⛔ លេខទូរស័ព្ទ និង Barcode
  **នៅតែចេញជា TEXT ដដែល** (0 នាំមុខមិនបាត់)។

### ឧបករណ៍ audit

- ថ្មី ៖ **`db-stall-guard-test.js`** (**២៧ assertion**) — ដាក់ Firebase ក្នុង
  របៀប **ព្យួរ** ពិត រួចអះអាងថាសោដោះ និងសារនិយាយការពិត។ ធ្លាក់ **៩** លើ
  `origin/main`; mutation ៦ ➜ ចាប់បានទាំង ៦។
  ⛔ **រួមទាំងការវាស់លុយដោយផ្ទាល់** ៖ រត់ `claimAndCleanupItem('abandon')`
  **ពិត** (ផ្លូវ *តែមួយ* ក្នុងការសម្អាតស្វ័យប្រវត្តិដែលប៉ះលុយ) ➜ តំណព្យួរ
  ត្រូវ **មិនកាត់លុយសោះ · គ្មានការសរសេរទៅធុងសំរាម · សោដោះវិញ**; បណ្តាញ
  ធម្មតាត្រូវកាត់ **១ ដងគត់** ដដែល។
- `export-cells-test.js` ៖ បន្ថែម ៦ assertion សម្រាប់ CSV formula injection
  (ធ្លាក់ ២ លើ `origin/main`)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules មិនប្រែសោះ ហើយ CSP ក៏មិនប្រែដែរ — គ្រាន់តែ deploy។

---

## [ZoeW 2.23.0] — 2026-08-29 · នាំចូលរួច ➜ ទិន្នន័យអតិថិជនមកភ្លាម

> 🔴 **របាយការណ៍អ្នកប្រើ** ៖ *«សម្រួលការបញ្ចូលទិន្នន័យចូល sheet លឿនគួរសម
> តែនៅពេលបញ្ចូលជោគជ័យ ហើយ វាយូទាញចូលណាស់ អាចធ្វើអោយការទាញទិន្នន័យអតិថិជន
> ចូលលឿនដូច realtime បានអត់»*។

ជុំនេះកែ **ZoeW** តែមួយ (`zoew-v126` ➜ `zoew-v127`) បូក **template របស់
Apps Script ស្វែងរកអតិថិជន**។ **ZoeKeyGen មិនប្រែសោះ** (`2.19.11`)។
វា **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត ·
ស្ថិតិយក · លុយ) និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ ·
ទម្រង់បង្ហាញ** ដែរ។

### មូលហេតុពិត (វាស់បាន មិនមែនអានកូដ)

កំហុសមាន **២** ដែលបូកគ្នាធ្វើឲ្យបង្អួច «ងងឹត» យ៉ាងតិច ៥ នាទីក្រោយនាំចូល៖

| # | អ្វីកើតឡើងមុនកែ |
|---|---|
| ១ | `runSheetImport()` ហៅ `clearCustomerDataTableCache()` ➜ តារាងអតិថិជនក្នុងសតិ **ត្រូវលុបចោល** ហើយ **គ្មានអ្វីបំពេញវាវិញទេ** ➜ រាល់ការស្កេនក្រោយនាំចូល ធ្លាក់ទៅសំណើ `?code=` មួយកញ្ចប់មួយសំណើ |
| ២ | Apps Script ស្វែងរកអតិថិជន cache ជួរដេកក្រោមកូនសោ **ថេរ** (`customer_rows`) អស់ **៣០០ វិនាទី** ➜ សូម្បី `?code=` ក៏ត្រឡប់ «រកមិនឃើញ» សម្រាប់ barcode ដែលទើបនាំចូល **រហូតដល់ ៥ នាទី** |

⛔ **ការនាំចូលធ្វើដោយ script ផ្សេង** (`zto-import/Code.gs`) ➜ CacheService
របស់វាដាច់ដោយឡែក ➜ **គ្មានអ្នកណាលុប cache នោះសោះ**។ លទ្ធផលដែលអ្នកប្រើឃើញ ៖
«✅ នាំចូលរួចរាល់» រួច **វាយលេខទូរស័ព្ទដោយដៃទាំងអស់**។

### ល្បឿន (ការវាស់ក្នុង sandbox នៃកូដពិត)

| សេណារីយ៉ូ | មុនកែ | ក្រោយកែ |
|---|---|---|
| ស្កេន barcode ដែលទើបនាំចូល | សំណើបណ្តាញ ១ ក្នុងមួយកញ្ចប់ ហើយ **រកមិនឃើញ** រហូតដល់ ៥ នាទី | **០ សំណើ · ០ ms** (ឆ្លើយពីសតិ) |
| ស្កេន barcode ដដែលម្តងទៀត | សំណើថ្មីរាល់ដង | **០ សំណើ** |
| ចុច 🔄 ក្នុងតារាងអតិថិជន | អាចទទួលទិន្នន័យចាស់ដល់ ៥ នាទី | ទិន្នន័យ **ពិតពី Sheet** ភ្លាម |
| ការទាញជាមុនដែលត្រូវរំលងព្រោះរវល់ | រង់ចាំវដ្តបន្ទាប់ — **៥ នាទី** | ព្យាយាមវិញក្នុង **១,២ វិនាទី** ក្រោយពេលទំនេរ |

### ល្បឿន · បន្ថែម
- **តារាងអតិថិជនត្រូវបំពេញភ្លាមពីឯកសារដែលទើបនាំចូល** — ជួរដេកទាំងនោះ
  អង្គុយក្នុងសតិរបស់ App រួចស្រេច (វាជាឯកសារ Excel ដែលអ្នកប្រើទើបរើស) ➜
  `seedCustomerTableFromImport()` បំពេញវាចូលតារាងតាមច្បាប់ **ដូច server
  បេះបិទ** ៖ `replace` ➜ ជំនួសទាំងស្រុង · `upsert` ➜ តម្លៃថ្មីឈ្នះ ·
  `newOnly` ➜ តម្លៃចាស់នៅដដែល · ស្ទួនក្នុងឯកសារ ➜ ជួរដេកចុងក្រោយឈ្នះ។
- **`fresh=1` ជាកូនសោបើក cache** — ការទាញ **បង្ខំ** (ក្រោយនាំចូល · ក្រោយ
  សម្អាត · ប៊ូតុង 🔄) ស្នើ Apps Script ឲ្យ **អានសន្លឹកពិត** ជំនួស cache
  រួច **សរសេរ cache ជាន់វិញ** ➜ ឧបករណ៍ដទៃទាំងអស់ក៏ទទួលទិន្នន័យថ្មីភ្លាមដែរ។
  ⛔ ការទាញ **ធម្មតា** នៅតែប្រើ cache ដដែល — បើមិនដូច្នេះការស្កេនយឺតជាងមុន។
- **កូនសោ cache របស់ Apps Script ផ្ទុកចំនួនជួរដេក** (`customer_rows_v2_<N>`)
  ➜ ការនាំចូលដែលប្តូរចំនួនជួរដេក លុប cache **ដោយស្វ័យប្រវត្តិ គ្មានថ្លៃបន្ថែម**។
- **ការស្កេនដែលរកមិនឃើញក្នុងតារាង ➜ តាំងម៉ោងទាញតារាងទាំងមូល** ➜ កញ្ចប់
  ទី ១ ប៉ុណ្ណោះដែលឆ្លងបណ្តាញ; កញ្ចប់បន្តបន្ទាប់ឆ្លើយពីសតិ។ ⛔ វា **ពន្យារ
  ខណៈអ្នកប្រើកំពុងស្កេន** (ប្រអប់បើក ឬការស្វែងរកកំពុងដំណើរការ) ដើម្បីកុំឲ្យ
  វាជាន់ការស្កេន ហើយ **បោះបង់ក្រោយ ៩០ វិនាទី** ដើម្បីកុំឲ្យវាភ្ញាក់ជារៀងរហូត។
- **លទ្ធផលស្វែងរកតាមបណ្តាញចូលតារាងក្នុងសតិវិញ** ➜ ការស្កេន barcode ដដែល
  លើកក្រោយឆ្លើយភ្លាមដោយគ្មានសំណើ។
- **ការទាញជាមុនដែលត្រូវរំលងព្រោះរវល់ លែងរង់ចាំ ៥ នាទី** — មុននេះ ការបើក
  App ខណៈមានប្រអប់បើក (ករណីធម្មតាបំផុតក្រោយចូលប្រព័ន្ធ) ធ្វើឲ្យតារាង
  **នៅទទេរហូតដល់វដ្តបន្ទាប់** ➜ ការស្កេនដំបូងៗនៃវគ្គ ឆ្លងបណ្តាញទាំងអស់។

### ឧបករណ៍ audit
- **`lookup-freshness-test.js` ថ្មី (១០០ assertion; ធ្លាក់ ៣៨ លើ `origin/main`)**
  — រត់ `runSheetImport()` · `attemptAutoLookup()` · `fetchCustomerDataTableRows()`
  **ពិត** ក្នុង `vm` ជាមួយនាឡិកាក្លែងក្លាយ បូករត់ `Code.gs` **ពិត** ខាង server។
  អះអាង **២ ខាង** គ្រប់កន្លែង ៖ ការបំពេញត្រូវ **កើត** ក្រោយនាំចូល និងត្រូវ
  **មិនកើត** ក្រោយសម្អាត; `fresh=1` ត្រូវ **មាន** ពេលបង្ខំ និង **គ្មាន** ពេល
  ធម្មតា; ការទាញឡើងវិញត្រូវ **ពន្យារពេលរវល់** និង **បាញ់ពេលទំនេរ**។
- `lookup-prefetch-test.js` ៖ បន្ថែម helper ថ្មីចូលបញ្ជីស្រង់ `vm`
  (៥៤ ➜ ៧៦ assertion)។ `google-sheets-cache-test.js` ៖ អះអាងកូនសោ cache ថ្មី។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **Firebase rules មិនប្រែសោះ** — មិនចាំបាច់ publish អ្វីទេ។
- ⛔ **ត្រូវ redeploy Apps Script ស្វែងរកអតិថិជន** ៖ copy
  `zto-import/google-sheets-api/Code.gs` ចូល script.google.com ➜ Deploy ជា
  **កំណែថ្មី** លើ deployment **ដដែល** (URL មិនប្រែ)។ បើមិន redeploy ៖ App
  នៅតែលឿនក្រោយនាំចូល (ការបំពេញពីឯកសារជាខាង client) តែ **ការទាញឡើងវិញនៅតែ
  អាចទទួលទិន្នន័យចាស់ដល់ ៥ នាទី** ព្រោះ script ចាស់មិនស្គាល់ `fresh=1`។
  ⛔ **`zto-import/Code.gs` (ខាងនាំចូល) មិនប្រែទេ** — កុំ redeploy វា។

## [ឧបករណ៍] — 2026-08-29 · ជុំ deep audit ៖ listener ដែលកកកុញ · ការបដិសេធ promise

⛔ **កូដ App មិនប្រែសោះ** — `APP_VERSION` និង `CACHE_VERSION` **នៅដដែល**
(`ZoeW 2.22.5` · `zoew-v126` · `ZoeKeyGen 2.19.11` · `zoekeygen-v81`)។
ជុំនេះកែ **ឧបករណ៍ audit តែប៉ុណ្ណោះ** ➜ អ្នកប្រើមិនឃើញអ្វីខុសពីមុនទេ
ហើយ **មិនចាំបាច់ deploy** ក៏បាន។ `version-bump-scope.js` ចាក់សោវា ៖
គ្មានការកែកូដ ship ➜ **មិនត្រូវ** ឡើងកំណែ។

### អ្វីដែលជុំនេះឆ្លើយ
អ្នកប្រើសួររឿង **«duplicate listener»** ជា ៣ ជុំជាប់ៗគ្នា។ ការឆ្លើយពីមុន
ធ្វើដោយ **អានកូដ** ដែលមិនអាចឆ្លើយបានទេ ៖ `bindPanelSwipe()` ត្រូវហៅ **២ ដង**
ដោយចេតនា ហើយ `renderLockerGrid()` សាងប៊ូតុងថ្មីរាល់ដង ➜ ការស្កេនស្តាទិច
ផ្តល់ **false positive**។ ជុំនេះ **វាស់វាពិត**។

### ឧបករណ៍ audit
- **`listener-leak-test.js` ថ្មី (17 assertion)** — patch `EventTarget.prototype`
  មុនកូដ App រត់ រួចរាប់ listener **ពិត** និងចំនួន **DOM node** ក្រោយវដ្ត
  ពិត ៥ ៖ login/logout ×3 · `initDatabaseListeners()`+`attachInfoListeners()` ×5 ·
  `initFirebase()` ×3 · ប្តូរទំព័រ+modal ×6 · online/offline/visibilitychange ×8។
  **លទ្ធផល ៖ គ្មានការលេច listener ឬ node ទេ។** Mutation ៥ ➜ ចាប់បានទាំង ៥។
- **`checker-coverage.js` ផ្នែក ៨ ថ្មី (13 ➜ 16 assertion)** — ⛔⛔ ចន្លោះដែល
  គ្រប checker ទាំង ១០៨ ៖ `pageerror` របស់ Playwright ចាប់តែ **ការបោះ
  synchronous** ➜ **ការបដិសេធ promise ដែលគ្មានអ្នកចាប់ មើលមិនឃើញទាំងស្រុង**
  ក្នុងកូដដែលស្ទើរតែទាំងអស់ជា `async`។ ឥឡូវ checker **១៦** ដំឡើងអ្នកបម្លែង
  តាម `addInitScript` ហើយផ្នែក ៨ អះអាងថាគ្មានមួយណាភ្លេច និងថាការដំឡើង
  ឈរ **មុន `.goto()`**។ **លទ្ធផល ៖ ០ unhandled rejection** ឆ្លងកាត់ការអះអាង
  ជាង ៥០០។
- `run-all.sh` រត់ `listener-leak-test.js` ទាំងក្នុងផ្នែកធម្មតា និង baseline។

### មេរៀនដែលកត់ត្រាក្នុង `CLAUDE.md`
- **ការវាស់ដែលរាយការណ៍ខុស ថ្លៃដូចការវាស់ដែលបៃតងក្លែងក្លាយ** — harness
  ជំនាន់ដំបូងរាយ «ការធ្លាក់» ២ ដែលទាំង ២ ជាសំណល់នៃការវាស់ (listener លើ
  node ដែល **ផ្តាច់ចេញ** និងរូបភាពដែលថត **មុនការភ្ជាប់ដំបូង**)។ នោះជាផ្លូវ
  ដដែលនឹងមេរៀន 2.11.3 ➜ 2.11.4។
- **សំណួរទី ១០ និងទី ១១** បន្ថែមចូលបញ្ជីមុនជឿថា checker ថ្មីដំណើរការ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** Firebase rules មិនប្រែ · CSP មិនប្រែ · មិនចាំបាច់ deploy។

---

## [2.22.5] — 2026-08-28 · ជុំ deep audit ៖ storage ដែលត្រូវបិទ · កាមេរ៉ាដែលអវត្តមាន

**ZoeW** (`2.22.4` ➜ `2.22.5`, `zoew-v125` ➜ `zoew-v126`)។
**ZoeKeyGen** (`2.19.10` ➜ `2.19.11`, `zoekeygen-v80` ➜ `zoekeygen-v81`) —
វាមានផ្លូវ storage ដដែល។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត ·
ស្ថិតិយក · `isDeducted`) និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ ·
ទម្រង់បង្ហាញ**។

### កែកំហុស — App ដាច់ទាំងស្រុងពេល browser បិទ site data

**រន្ធធ្ងន់បំផុតនៃជុំនេះ។** ពេលអ្នកប្រើ (ឬ policy) បិទ site data ទាំងស្រុង —
Chrome «Block all cookies» · Firefox strict · policy សហគ្រាស — នោះការប៉ះ
`window.localStorage` **ខ្លួនវា** បោះ `SecurityError`។ ហើយ `app.js` អានវា
**កម្រិត top-level** ៖

```js
let exchangeRateRiel = parseFloat(localStorage.getItem('zoew_exchange_rate')) || 4100;
```

កូដ top-level ដែលបោះ **បញ្ឈប់ការវាយតម្លៃឯកសារទាំងមូល** ➜ អ្វីៗខាងក្រោមវា
មិនរត់សោះ ៖ `initAppLock()` · `window.addEventListener('load')` ដែលហៅ
`initFirebase()` · `revealAppAfterBoot()`។

**វាស់បានក្នុង Chromium ពិត** ៖

| | មុនកែ | ក្រោយកែ |
|---|---|---|
| ផ្ទាំង boot | **ជាប់រហូត** | ✅ បាត់ធម្មតា |
| កំហុស runtime | **១** | ✅ **០** |
| ខ្លឹមសារលើអេក្រង់ (ZoeW) | ~១០០ តួ (navbar តែម្យ៉ាង) | ✅ **៦២៨ តួ** |
| ខ្លឹមសារ (ZoeKeyGen) | ៥៥ តួ | ✅ **១៥៣ តួ** |

⚠️ **អន្ទាក់នៃការវិនិច្ឆ័យ** ៖ **function declaration ត្រូវ hoist** ➜
`typeof sanitizeInput === 'function'` ត្រឡប់ `true` ទោះឯកសារធ្លាក់ត្រង់
បន្ទាត់ដំបូង ➜ ការសួរ «តើ function មានទេ?» **បង្ហាញថាធម្មតា** ខណៈ App ស្លាប់។

**ការកែ** ៖ shim `appLocalStore` / `appSessionStore` ដែលអាន
`window.localStorage` **ក្នុង `try` តែម្តង** នៅដើមឯកសារ បូក `safeStoreGet()`
ថ្មី ហើយ helper ទាំង ៣ ឥឡូវ **ទ្រាំនឹង `null` store**។ ការហៅ storage
**ទាំង ១០៥ កន្លែង** (ZoeW 75 · ZoeKeyGen 30) ឆ្លងកាត់ helper។

⛔ **ហេតុអ្វី `safeStoreSet(localStorage, …)` ដែលមានស្រាប់មិនគ្រប់គ្រាន់** ៖
argument វាយតម្លៃ **មុន** ចូល function ➜ បើ getter ជាអ្នកបោះ នោះការហៅ
បោះ **នៅកន្លែងហៅ** មិនមែនក្នុង `try` របស់ helper ទេ។ វាស់បានពិត។

### កែកំហុស — កាមេរ៉ាលែងបើកបានពេញវគ្គដោយស្ងាត់

`requestCameraPermission()` ដាក់ `isCameraStarting = true` **មុន** ហៅ
`navigator.mediaDevices.getUserMedia(...)`។ ពេល `mediaDevices` ជា
`undefined` (បរិបទមិន secure · WKWebView ក្នុង app ខ្លះ) នោះ **`TypeError`
បោះ *synchronously*** — មុន promise ត្រូវបង្កើតផង ➜
`.catch(err => { isCameraStarting = false; … })` **មិនចាប់វាទេ** ➜ ទង់ជាប់
`true` ជារៀងរហូត ➜ ការចុចប៊ូតុងកាមេរ៉ាលើកក្រោយត្រូវច្រានចេញ **ដោយស្ងាត់**។

ឥឡូវមានការពិនិត្យវត្តមានជាមុន ហើយសារប្រាប់មូលហេតុពិត ៖ «កម្មវិធីរុករកនេះ
មិនអនុញ្ញាតឲ្យប្រើកាមេរ៉ាទេ — សូមបើកតាម HTTPS ឬប្រើម៉ាស៊ីនស្កេន/វាយបញ្ចូល
ដោយដៃ»។ ⛔ **ទិសផ្ទុយត្រូវរក្សា** ៖ ការបដិសេធសិទ្ធិ (promise reject)
នៅដើរតាមផ្លូវចាស់ដដែល។

### ឧបករណ៍ audit — ជួសជុលឲ្យសុក្រឹត្យ

**`storage-guard.js` មានចន្លោះ ៤ ដែលបិទក្នុងជុំនេះ** ៖

| ចន្លោះ | អ្វីដែលរអិលកាត់ |
|---|---|
| គ្រប **តែការសរសេរ** | `getItem` ក៏បោះដែរ — ហើយធ្ងន់ជាង (top-level ➜ App ដាច់) |
| ស្កេន **តែ `app.js`** | `boot-flags.js` (script **ដំបូងគេក្នុង `<head>`**) · `license-verify.js` · `error-reporting.js` · `sw.js` មិនដែលពិនិត្យ |
| ចាប់ **តែ Identifier** | `window.localStorage.x()` ជា MemberExpression ➜ **មើលមិនឃើញ** |
| ចាប់ **តែការហៅ method** | ⛔ **ការប៉ះ `window.localStorage` ខ្លួនវាក៏បោះដែរ** (វាជា getter) ➜ `const s = window.localStorage;` ក្រៅ try រអិលកាត់ |
| **parse error ➜ រំលងស្ងាត់** | ឯកសារ ship ដែល parse មិនបាន (កូដខូចពិត) ➜ checker រាយ ✅ |

បូក **ជាន់អប្បបរមាទី ២** ៖ ចំនួន **ឯកសារ** ដែលស្កេន (>= ៦)។ ជាន់ដែលរាប់តែ
«ចំនួនការហៅ» មិនគ្រប់គ្រាន់ទេ — វាស់បាន ៖ ការជំនួសឈ្មោះ ៧៥ កន្លែងធ្វើឲ្យ
checker រាយ `0` ខណៈការហៅផ្ទាល់ **៣០ នៅដដែល**។

**`storage-blocked-boot-test.js` ថ្មី** (១៨ assertion) — checker **ឥរិយាបថ**
ដែលបិទ storage ពិតក្នុង Chromium រួចវាស់ថា App boot បានទេ។ វាគ្រប **របៀប
បរាជ័យ ២** ៖ getter បោះ (browser ទំនើប) និង method បោះ (Private Mode ចាស់)
បូក **ទិសផ្ទុយ** (storage ធម្មតា)។ **ធ្លាក់ ៩ លើ `origin/main`**។

**`camera-resume-test.js`** — បន្ថែម ៤ assertion សម្រាប់ `mediaDevices`
អវត្តមាន (មិនបោះ · ទង់ត្រូវដោះ · អ្នកប្រើឃើញមូលហេតុ · ទិសផ្ទុយ)។

**sandbox របស់ checker ១១ ត្រូវធ្វើបច្ចុប្បន្នភាព** — ការប្តូរផ្លូវចូលប្រើ
storage ធ្វើឲ្យពួកវាធ្លាក់ភ្លាមដោយ `ReferenceError`។ ⛔ **នោះជាសញ្ញាល្អ** ៖
វាបញ្ជាក់ថា checker ទាំងនោះ **ពិតជារត់កូដ ship ពិត** មិនមែនច្បាប់ចម្លងទេ។
ការចាក់ shim ប្រើ `typeof … === 'undefined'` ➜ **កូដពិតដែលស្រង់ចូលក្រោយ
ឈ្នះជានិច្ច** (shim មិនលាក់កំហុសពិត)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែសោះ ហើយ CSP ក៏មិនប្រែដែរ។

---

## [2.22.4] — 2026-08-28 · ជុំ deep audit ៖ ការរង់ចាំគ្មានពិដាន · មាត្រដ្ឋានថេប្លេត

**ZoeW** (`2.22.3` ➜ `2.22.4`, `zoew-v124` ➜ `zoew-v125`)។
**ZoeKeyGen** (`2.19.9` ➜ `2.19.10`, `zoekeygen-v79` ➜ `zoekeygen-v80`) —
វាចែករំលែក `sw.js` និង `showUpdateAvailableBanner()` ដែលមានកំហុសដដែល។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត ·
ស្ថិតិយក · `isDeducted`) និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ**។
ការវាស់បញ្ជាក់ ៖ `gesture-test` (107) · `panel-motion-test` (47) ·
`ios-panel-glide-test` (32) · `phone-search-swipe-test` (67) **បៃតងដដែល**។

### កែកំហុស — App លែងជាប់អស់កល្បលើបណ្តាញ «ភ្ជាប់តែស្លាប់»

បណ្តាញដែល **ភ្ជាប់តែស្លាប់** (WiFi សាធារណៈមុន login · តំបន់សេវាអន់ ·
proxy ដែលទទួល TCP រួចស្ងាត់) **មិនបោះកំហុសទេ — វាព្យួរ**។ រន្ធ ២ ដែល
វាបង្កត្រូវបានបិទ ៖

- **Service worker** ៖ សំណើសម្រាប់ធនធានដែល cache **មិន**មាន ធ្លាប់ហៅ
  `fetch()` ដោយ **គ្មានពិដាន** ➜ `event.respondWith()` មិនដែល settle ➜
  browser រង់ចាំធនធាននោះ **អស់កល្ប** ដោយគ្មានកំហុស គ្មាន timeout។
  ឥឡូវរាល់សំណើឆ្លងកាត់ `timedFetch()` ដែលមានពិដាន **២០ វិនាទី** ជាមួយ
  `AbortController` ពិត។
  ⛔ **ទិសផ្ទុយត្រូវរក្សា** ៖ សំបកដែល cache ទុករួច នៅតែឆ្លើយ **ភ្លាមៗ**
  ទោះបណ្តាញព្យួរក៏ដោយ (cache-first មិនប្រែសោះ)។
  ⚠️ ពិដាននេះគ្របតែ **ដំណាក់កាល header** — ការទាញតួឯកសារយឺតលើ 2G
  មិនត្រូវកាត់ទេ ព្រោះ `fetch()` resolve តាំងពី header មកដល់។
- **«Export ➜ 📗 Excel» និង «នាំចូល Excel ➜ រើសឯកសារ»** ៖ `loadScriptOnce()`
  គ្មានពិដាន។ `<script>` ដែល browser មិនដែលឆ្លើយ បាញ់ **ទាំង `onload`
  ទាំង `onerror` មិនកើត** ➜ ប៊ូតុងជាប់ «កំពុងរៀបចំ...» ជារៀងរហូត។
  ហើយព្រោះលទ្ធផលត្រូវ **memoize** ការសាកម្តងទៀត **ក្នុងវគ្គដដែល** ក៏ជាប់ដែរ
  ➜ អ្នកប្រើដោះមិនរួចលុះត្រាតែបិទបើក App។
  ឥឡូវមានពិដាន **២៥ វិនាទី** ដែលបដិសេធដោយហេតុផលពិត ហើយ **លុបការចងចាំ**
  ➜ ចុចម្តងទៀត ➜ ព្យាយាមថ្មីពិត។ សារថ្មី ៖ «ផ្ទុកឯកសារ Excel យូរពេក
  (បណ្តាញឆ្លើយមិនចេញ) — សូមសាកម្តងទៀត» ⛔ វា **មិនចោទអ៊ីនធឺណិតខុស** ទេ។

### កែកំហុស — របា «មានកំណែថ្មី» លែងគូរពីលើសោ និងប្រអប់

របានោះសាងដោយ JS ជាមួយ **`z-index: 99999`** ដែល **ខ្ពស់ជាងអេក្រង់ចាក់សោ
(2000) និងគ្រប់ប្រអប់ (1000)** ហើយវាគ្មានច្បាប់លាក់ក្រោម `body.app-locked`
សោះ។ ផល ៖ ខណៈ App **ជាប់សោ** របានោះនៅតែមើលឃើញ ហើយប៊ូតុង «Refresh ឥឡូវនេះ»
**ចុចបាន**; ខណៈប្រអប់ PIN បើក វាបាំងគែមខាងក្រោមនៃប្រអប់។

ឥឡូវវាជា class `.app-update-banner` ក្នុង `style.css` ជាមួយ **`z-index: 990`**
(ខ្ពស់ជាងរបា Tab · ទាបជាងប្រអប់) ហើយត្រូវ **លាក់ពិត** ក្រោម `body.app-locked`។
ប៊ូតុងក៏ខ្ពស់ **៣៦px** (គោលដៅប៉ះម្រាមដៃ) និងគោរព safe-area ខាងក្រោមដែរ។

### ផ្លាស់ប្តូរ — មាត្រដ្ឋានអក្សរលើថេប្លេត (ZoeW)

**វាស់បានលើ Chromium ពិត ៖ ទំហំអក្សរ *ជាប់គាំង* ចន្លោះ 430px ដល់ 991px។**
`--fs-unit` ដល់ពិដាន `1.1px` នៅ **430px** ហើយជំហានបន្ទាប់ប្រកាសតែក្នុង
`@media (min-width: 992px)` ➜ តំបន់កណ្តាល **គ្មានច្បាប់ណាកែវាសោះ** ៖

| ទទឹង | មុនកែ | ក្រោយកែ |
|---|---|---|
| 320px | 13.0px | **13.0px** (ដដែល) |
| 412px | 14.1px | **14.1px** (ដដែល) |
| 430px | 14.3px | **14.3px** (ដដែល) |
| 768px (iPad) | **14.3px** | **15.6px** |
| 880px | **14.3px** | **15.6px** |
| 991px | **14.3px** | **15.6px** |
| 992px | 15.6px | **15.6px** (ដដែល — លែងលោត) |
| 1440px | 17.0px | **17.0px** (ដដែល) |

- ថេប្លេត 768px ធ្លាប់គូរអក្សរទំហំដូចទូរស័ព្ទ 430px **បេះបិទ** ទោះអេក្រង់
  ធំជាង ៧៨% រួចនៅ 992px វា **លោត ៩%** ភ្លាមៗ។ ឥឡូវការឆ្លងកាត់ព្រំដែន
  **រលូនទាំងស្រុង**។
- ⛔ **ទូរស័ព្ទ `< 700px` និង laptop `>= 992px` មិនប្រែសោះ** — តារាងខាងលើ
  ជាការវាស់ពិត មិនមែនការសន្មត។
- **ZoeKeyGen មិនប្រែទេ** — វាជាឧបករណ៍អ្នកលក់ដែលប្រើលើទូរស័ព្ទ/កុំព្យូទ័រ។

### ល្បឿន — ការស្កេនដំបូងក្នុងវគ្គលឿនជាងមុន

- **`preconnectToLookupHost()`** ៖ `index.html` ធ្វើ `preconnect` រួចសម្រាប់
  gstatic · fonts · identitytoolkit · securetoken — តែ **មិនធ្វើសម្រាប់ host
  នៃ Lookup API** ដែលជា host ដែលហៅ **រាល់ការស្កេន**។ ការស្កេនដំបូងក្នុងវគ្គ
  ធ្លាប់បង់ថ្លៃ **DNS + TCP + TLS** ទាំងស្រុង។
  ⛔ វាធ្វើ **តាមលក្ខខណ្ឌ** ៖ អ្នកប្រើដែលមិនកំណត់ Lookup API **មិនបង់ថ្លៃ
  handshake ឥតប្រយោជន៍** ទេ ហើយវាមិនបញ្ចេញ deployment ID ចេញក្រៅឡើយ
  (បន្ថែមតែ **origin**)។

### សុវត្ថិភាព

- **ការស្វែងរកអតិថិជនស្វ័យប្រវត្តិ ⛔ លែងបាញ់សំណើខណៈក្រៅបណ្តាញ។**
  គ្រប់ផ្លូវបណ្តាញផ្សេងទៀតមានច្រកទ្វារ `navigator.onLine === false` រួច
  (`customerTablePrefetchAllowed()` · `callSheetImportApi()` ·
  `networkLooksDown()`) — តែ `attemptAutoLookup()` គ្មានទេ ➜ **រាល់ការស្កេន
  ក្រៅបណ្តាញ** បាញ់សំណើដែលដឹងស្រាប់ថាធ្លាក់ រួច **រាយការណ៍ទៅ Sentry**។
  សំឡេងរំខាននោះបាំងកំហុសពិត។ ⛔ **ទិសផ្ទុយត្រូវរក្សា** ៖ ការបំពេញពី
  cache ក្នុងសតិ **នៅតែដំណើរការភ្លាមខណៈក្រៅបណ្តាញ**។
- **វាល PIN របស់អេក្រង់ចាក់សោប្តូរទៅ `autocomplete="off"`** (ធ្លាប់ជា
  `current-password`) ➜ ស៊ីនឹងវាល PIN ដទៃទាំង ២។ ហេតុផល ២ ៖
  (ក) password manager ស្នើរក្សា PIN ➜ PIN ចេញពី vault ដែល sync ឆ្លងឧបករណ៍
  ខណៈ PIN នោះជាកូនសោដែល derive `lookupSecretKey` និង
  `zoew_sheet_import_config` (AES ពិត); (ខ) browser autofill **ពាក្យសម្ងាត់
  គណនី** ចូលវាល PIN ➜ ខុស ៥ ដង ➜ **ជាប់សោ ១ នាទី** ដោយអ្នកប្រើមិនបាន
  ធ្វើអ្វីខុសសោះ។
  ⚠️ **អ្នកប្រើដែលធ្លាប់ទុក PIN ក្នុង Keychain ត្រូវវាយវាដោយដៃវិញ។**

### ឧបករណ៍ audit

- **`stall-guard-test.js` ថ្មី** (១៩ assertion) — ចាក់សោថ្នាក់ «ការរង់ចាំ
  គ្មានពិដាន»។ វារត់ `sw.js` **ពិត** ក្នុង `vm` ក្រោម `fetch` ដែល **ព្យួរ**
  (មិនឆ្លើយ មិនបដិសេធ) និង `loadScriptOnce()` **ពិត** ក្រោម `<script>`
  ដែលមិនដែលឆ្លើយ។ **ធ្លាក់ ១០ លើ `origin/main`** ខណៈ `run-all.sh` បៃតង
  ទាំង ១០៤។ mutation ៤ ➜ ចាប់បានទាំង ៤។
  ⚠️ **មូលហេតុដែលវារអិលកាត់ ៖ សំណួរទី ៨** — checker SW ទាំង ៦ ដាក់ `fetch`
  ដែល **ឆ្លើយ ឬបដិសេធ**; **គ្មានមួយណាដាក់ `fetch` ដែល *ព្យួរ* សោះ**។
- **`fluid-type-focus-test.js` ៖ ការអះអាងដែល *ចាក់សោកំហុស* ត្រូវសរសេរឡើងវិញ។**
  វាធ្លាប់អះអាងថាទំហំអក្សរនៅ **768/880px ត្រូវស្មើ 430px** — នោះមិនមែនការ
  ការពារទេ វាជា **ការចាក់សោតំបន់ស្លាប់ទុក** (មេរៀន 2.20.6)។ ឥឡូវការវាស់
  «ឈប់រីក» ធ្វើក្នុង **តំបន់ទូរស័ព្ទសុទ្ធ** (430/560/699px) ហើយមានការវាស់
  **ជំហានថេប្លេត** ដាច់ដោយឡែក បូកការវាស់ថាមាត្រដ្ឋាន **ឡើងតាមលំដាប់**
  ទូរស័ព្ទ ➜ ថេប្លេត ➜ desktop។
- **`layout-check.js` ៖ បន្ថែមទំហំ 834×1112 (iPad Pro) និង 932×430
  (ទូរស័ព្ទបង្វិលទទឹង)** — តំបន់ ៤៣០–៩៩១px ធ្លាប់មានការវាស់តែនៅ 768px។
  ទំហំបង្វិលទទឹងសំខាន់បំផុត ព្រោះកម្ពស់ត្រឹម 430px ជាកន្លែងដែលការលើស
  បញ្ឈរលេចមុនគេ។ ឥឡូវ **56/56**។
- **`revenue-fuzz-test.js` ៖ លំនាំដើមឡើងពី ៦×២៦ ទៅ ១២×៤៥។**
  CLAUDE.md កត់ត្រារួចថា mutation `claimedPartial` ធ្លាក់ក្នុង **១២ លំដាប់
  × ៤៥** — តែលំនាំដើមនៅត្រឹម ៦×២៦ ➜ **ការរត់ធម្មតាមិនដែលឈានដល់ជម្រៅ
  ដែលឯកសារខ្លួនវាចែងថាចាំបាច់**។ វាស់បាន ៖ ៤១ វិ. ➜ ១២១ វិ.
  (ក្រោមពិដាន ៣០០ វិ. របស់ `run-all.sh`)។
- **`lookup-prefetch-test.js` ៖ `scenario()` ធ្លាប់ *លេប* promise។**
  scenario ដែលត្រឡប់ promise មិនដែលត្រូវរង់ចាំ ➜ ការអះអាង async ខាងក្នុង
  **មិនដែលរត់** ហើយឯកសារចេញ exit 0 ➜ បៃតងក្លែងក្លាយ (ថ្នាក់ដដែលនឹង
  មេរៀន `sheet-import-test.js`)។ ឥឡូវវារង់ចាំពិត។ ៦៣ assertion។
- **`app-lock-test.js`** ៖ បន្ថែមការវាស់ **hit-test ពិត** (`elementFromPoint`)
  ថាគ្មានស្រទាប់ណាគូរពីលើអេក្រង់ចាក់សោ បូកការវាស់លំដាប់ជង់ធៀបនឹងប្រអប់
  និងការអះអាង `autocomplete` លើវាល PIN ទាំង ៣។ ១០៧ assertion។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែសោះ ហើយ CSP ក៏មិនប្រែដែរ។ គ្រាន់តែ deploy។

---

## [2.22.3] — 2026-08-28 · សម្រួលការបង្ហាញជួរប្រវត្តិ និងប្រអប់បញ្ជីអីវ៉ាន់

**ZoeW** (`2.22.2` ➜ `2.22.3`, `zoew-v123` ➜ `zoew-v124`)។
**ZoeKeyGen មិនប្រែទេ** (`2.19.9`, `zoekeygen-v79`)។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត ·
ស្ថិតិយក · លុយ) និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ**។
វាប៉ះតែ **អ្វីដែលភ្នែកឃើញ** ក្នុងជួរតារាងប្រវត្តិ និងប្រអប់ «📦 បញ្ជី»។

### ផ្លាស់ប្តូរ — ជួរតារាងប្រវត្តិ

**សំណើអ្នកប្រើ (រូបថតអេក្រង់)**៖ *«ចង់ផ្លាស់ទី លេខទូរស័ព្ទ មកនៅពីក្រោម
អក្សរសម្គាល់ "ខល" "ថ្មី/ចាស់" វិញ ... ដាក់ ម៉ោងនៅក្រោយ ឆ្នាំ-ខែ-ថ្ងៃ វិញ
ដោយមិនបាច់ដាក់ emoji ទេ ... ទុកតែ emoji របស់ "📦បញ្ជី"បានហើយ»*។

- **ស្លាក «ខល» និង «ថ្មី/ចាស់/យកហើយ» ឡើងទៅបន្ទាត់ខាងលើ** ហើយ
  **លេខទូរស័ព្ទចុះមកនៅក្រោមវា** ➜ លេខលែងត្រូវស្លាកច្របាច់នៅចុងបន្ទាត់។
- **ពេលវេលាស្កេនប្តូរជា `2026-08-28 18:26:13`** (ថ្ងៃមុន ម៉ោងក្រោយ) ជំនួស
  `🕒 18:26:13 (2026-08-28)` ➜ លែងបត់ជា ២ បន្ទាត់កណ្តាលវង់ក្រចក។
- **ដក emoji 📱 និង 🕒 ចេញ** — នៅសល់តែ **📦 បញ្ជី** ។
- ⛔ **ទិន្នន័យចាស់មិនរងផលទេ** — ទម្រង់ដែលរក្សាទុកក្នុង Firebase **នៅដដែល**
  (`HH:MM:SS (YYYY-MM-DD)`); `formatScanStamp()` ជាការតម្រៀប **ពេលបង្ហាញ**
  ប៉ុណ្ណោះ ហើយបើទម្រង់មិនត្រូវ វាបង្ហាញអត្ថបទដើមវិញ។

### បន្ថែម — ការបូកសរុប COD + DOD

**សំណើអ្នកប្រើ**៖ *«ប្រសិនបើករណីមានទាំង COD DOD ចឹងដាក់បូកសរុបលុយផង»* និង
*«បើអីវ៉ាន់ គ្មាន DOD ទេបង្ហាញតែ COD បើអីវ៉ាន់ណា មានតែ DOD បង្ហាញតែ DOD
បើអីវ៉ាន់មានទាំងពីរបង្ហាញទាំង២ និង សរុបជា ៛ ផង»*។

- **ជួរតារាងប្រវត្តិ** ៖ ពេលមានទាំង COD និង DOD ➜ បន្ថែមបន្ទាត់
  **«សរុប: $2.00 (8,200 ៛)»** ក្រោមខ្សែបន្ទាត់ដាច់ៗ។
- **ប្រអប់ «📦 បញ្ជី»** ៖ ឥឡូវដើរតាមច្បាប់ដដែលនឹងជួរតារាង —
  COD តែឯង ➜ បង្ហាញតែ COD; DOD តែឯង ➜ បង្ហាញតែ DOD; មានទាំង ២ ➜ បង្ហាញ
  ទាំង ២ បូកបន្ទាត់ **សរុប**។ មុននេះវាបង្ហាញ `DOD: $0.00` ជានិច្ច។
- **គ្រប់តួលេខក្នុងប្រអប់មានតម្លៃជា ៛ ភ្ជាប់** ដូចជួរតារាង។
- ⛔ **ជា​ការបង្ហាញសុទ្ធ** — គ្មានការសរសេរទៅ Firebase, គ្មានការប៉ះ
  `isDeducted`, គ្មានការប៉ះស្ថិតិចំណូល។ តម្លៃ ៛ សរុបគណនាជា
  `codRiel + dodRiel` ដើម្បីឲ្យលេខដែលឃើញបូកគ្នាត្រូវពិត។

### កែកំហុស — ចន្លោះក្នុងប្រអប់បញ្ជី

**របាយការណ៍អ្នកប្រើ (រូបថតអេក្រង់)**៖ ស្លាក barcode និងស្លាក «ទីតាំង»
**ប៉ះជាប់គ្នា** ពេលបត់ទៅបន្ទាត់ទី ២។

- បន្ទាត់ក្បាលរបស់ធាតុនីមួយៗក្លាយជា **flex ដែលមាន `gap: 4px 6px`** ➜ ពេលបត់
  មានចន្លោះ **ទាំងផ្តេក និងបញ្ឈរ**។ មុននេះវាជា `inline-block` ដែលពេលបត់
  គ្មានចន្លោះបញ្ឈរសោះ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន** — Firebase rules មិនប្រែ (វាល `time` នៅជា string ដដែល) ហើយ
  CSP ក៏មិនប្រែដែរ។ គ្រាន់តែ deploy។

## [2.22.2] — 2026-08-28 · សម្រួលរូបរាងប្រអប់ (modal) ទាំងអស់

**ZoeW** (`2.22.1` ➜ `2.22.2`, `zoew-v122` ➜ `zoew-v123`)។
**ZoeKeyGen មិនប្រែទេ** (`2.19.9`, `zoekeygen-v79`)។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ ·
ការរមូរ**។ វាប៉ះតែ **រូបរាងរបស់ប្រអប់** (`style.css`) បូកការរុំស្លាកប៊ូតុង
ជីវមាត្រក្នុង `<span>` ដើម្បីតម្រឹមរូប+អក្សរ។

### ផ្លាស់ប្តូរ — រូបរាងប្រអប់

**របាយការណ៍អ្នកប្រើ**៖ *«ប្រអប់ពណ៌ក្រហម ... មើលទៅប៉ះជាប់ជាមួយប៊ូតុងហើយ
សម្រួលគ្រប់ modal ទៅ ព្រោះ modal ដាក់ pin code ហ្នឹងមានច្រើនណាស់ក្នុង app»*។

- ⛔ **ប៊ូតុង «ស្កេនក្រយៅដៃ ឬមុខ» លែងប៉ះជាប់ជួរប៊ូតុងខាងក្រោម** — គម្លាត
  **១៦px** ខាងក្រោម (មុននេះ `0`)។
- **រូប 🫆 និងអក្សរឈរចំកណ្តាលជាក្រុមតែមួយ** ៖ ស្លាកត្រូវរុំក្នុង
  `<span class="bio-ico">` និង `<span class="bio-label">` ➜ គម្លាតរវាងរូប
  និងអក្សរជា **៨px ពិត** (មុននេះជាតួអក្សរដកឃ្លាធម្មតា ➜ `gap` គ្មានប្រសិទ្ធភាព)។
- **ប៊ូតុងជីវមាត្រក្លាយជាប៊ូតុងបន្ទាប់បន្សំ** (ផ្ទៃស គែមក្រហម) ➜ លែងមើលទៅ
  ដូច **ប្រអប់សារកំហុស** ពណ៌ផ្កាឈូក។ លំដាប់ច្បាស់ ៖ «ដោះសោ» ក្រហមពេញ ➜
  ស្កេនជីវមាត្រ (គែម) ➜ សារកំហុស (ផ្កាឈូកស្រាល)។
- **គ្រប់ modal ក្នុង App** ៖ កាតមូលជាង (`--radius-xl`) · ស្រមោលទន់ជាង ·
  padding ធំជាង (`20/18px`) · ចំណងជើងធំជាងបន្តិច និងដិតជាង · អត្ថបទពិពណ៌នា
  `line-height: 1.65` (អក្សរខ្មែរអានងាយជាង) · ចន្លោះមុនប្រអប់វាយ **១៤px**។
- **ប្រអប់វាយ និងប៊ូតុងទាំងអស់ក្នុង modal ខ្ពស់ ៤៦px** (គោលដៅប៉ះសម្រាប់
  ម្រាមដៃ) ជំនួស ~៣៤px · ចន្លោះជួរប៊ូតុង **៨px** · ប៊ូតុងចម្បងមានស្រមោលពណ៌
  ស្រាល ➜ លំដាប់ច្បាស់។
- **ប្រអប់វាយមានផ្ទៃប្រផេះស្រាល រួចប្រែជាសក្នុងពេលផ្តោត** (បូករង្វង់ខៀវ
  ដដែល) — effect ស្រាលដែលបង្ហាញកន្លែងកំពុងវាយ។
- អេក្រង់ចាក់សោប្រើទំហំដដែល (ប្រអប់វាយ និងប៊ូតុង ៤៦px)។

⛔ **គ្មានចលនាថ្មីដែលដើរជារៀងរហូតទេ** — ការលេចរបស់ប្រអប់នៅជា `modalPopIn`
(`transform`/`opacity`, ០.២៦ វិ.) ហើយ `prefers-reduced-motion` បិទវាដដែល។
`animation-cost.js` នៅបៃតង។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែ ហើយ CSP ក៏មិនប្រែដែរ។

---

## [2.22.1] — 2026-08-28 · ចាក់សោពេល **ត្រឡប់ចូល App វិញ** មិនត្រឹមពេលបើកថ្មី

**ZoeW** (`2.22.0` ➜ `2.22.1`, `zoew-v121` ➜ `zoew-v122`)។
**ZoeKeyGen មិនប្រែទេ** (`2.19.9`, `zoekeygen-v79`)។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាតស្វ័យប្រវត្តិ ·
ស្ថិតិយក) និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ**។

### កែកំហុស — សោដែលចាក់តែពេល «បើក App ថ្មី»

**របាយការណ៍អ្នកប្រើ**៖ *«ចេញពី app តែអត់ទាន់ clear task app ចូល app វិញ
អត់លោតអោយវាយ pin ទៀតសោះ»*។ ត្រូវហើយ — កំណែ 2.22.0 ចាក់សោតែពេល **ផ្ទុក
ទំព័រក្នុងវគ្គថ្មី**។ ការប្តូរទៅ App ផ្សេងដោយមិន «clear task» **មិនបំផ្លាញ
វគ្គទេ** ➜ ទង់ដោះសោក្នុង `sessionStorage` នៅដដែល ➜ សោមិនដែលចាក់វិញ។

ឥឡូវការចាក់សោដើរតាម **ការចាកចេញ/ត្រឡប់មក** ដែរ៖

- **ពេលចាកចេញពី App ➜ អេក្រង់សោគ្របភ្លាម** (មិនរង់ចាំដល់ត្រឡប់មក) ➜ រូបភាព
  របស់ App ក្នុង **task switcher** របស់ទូរស័ព្ទ **លែងបង្ហាញលេខអតិថិជន**។
- **ពេលត្រឡប់ចូល App វិញ ➜ ត្រូវវាយ PIN ឬស្កេនក្រយៅដៃ/មុខ។** បើបានបើកការ
  ស្កេនទុក វាលេចឡើង **ដោយស្វ័យប្រវត្តិ** ដូចពេលបើក App។
- ⛔ **session ៤ ម៉ោង នៅដដែលបេះបិទ** — គ្មាន `signOut()` · គ្មានការលុប
  `zoew_login_time` ឬ `remembered_email`។ ដោះសោ ➜ ចូលដល់ App ភ្លាម។

### ⛔ អ្វីដែល **មិន** ចាក់សោ — ការចាកចេញដោយចេតនាពីក្នុង App

កំណែ 2.22.0 សរសេរថាការចាក់សោតាម `visibilitychange` នឹងធ្វើឲ្យ **រាល់ការខល
ទាមទារ PIN** ព្រោះប៊ូតុង «📞 ខល» ជា `<a href="tel:…">` ដែល **ចាកចេញពី App**។
ការសង្កេតនោះនៅតែពិត — ដូច្នេះជុំនេះមិនចាក់សោការចាកចេញទាំងនោះទេ៖

| សកម្មភាព | ត្រឡប់មក ➜ |
|---|---|
| **📞 ខល** (`tel:`) | **មិនសុំ PIN** |
| **យក Barcode ពីរូបភាព** · **រើសឯកសារ Excel** | **មិនសុំ PIN** |
| **ស្កេនក្រយៅដៃ/មុខ** (ប្រអប់ system) | **មិនសុំ PIN** |
| **សុំសិទ្ធិកាមេរ៉ា** · **Export PDF (Print)** | **មិនសុំ PIN** |
| ប្តូរទៅ App ផ្សេង · ចាក់សោអេក្រង់ · ចុច Home | **សុំ PIN** |

⛔ **ការលើកលែងប្រើតែ *ជុំនោះមួយ*** — ខលចប់ ➜ ត្រឡប់មក ➜ មិនសុំ PIN; តែបើ
ចាកចេញ **ម្តងទៀត** (ដោយគ្មានការខល) ➜ សុំ PIN ដដែល។ បង្អួចលើកលែងវាស់តាម
`elapsedSince()` ➜ នាឡិកាដែលថយក្រោយ ➜ `Infinity` ➜ **ចាក់សោ** (ទិសសុវត្ថិភាព)។

⛔ **PTR (ទាញចុះដើម្បី Refresh) នៅតែមិនសុំ PIN** — ការផ្ទុកទំព័រឡើងវិញបាញ់
ព្រឹត្តិការណ៍ «ចាកចេញ» ដែរ ដូច្នេះ **ការគ្របពេលចាកចេញមិនប៉ះទង់វគ្គ**; ការលុប
ទង់កើតឡើងតែពេល **ត្រឡប់មកវិញពិត**។ ⛔ ចំណែក Refresh **ខណៈចាក់សោ** ➜ នៅតែ
ចាក់សោ (មិនមែនផ្លូវរំលង)។

### ផ្លាស់ប្តូរ — រូបរាងប្រអប់

- ប្តូររូប **👆 ➜ 🫆** លើប៊ូតុង «ស្កេនក្រយៅដៃ ឬមុខ» ទាំងអេក្រង់ចាក់សោ និង
  ប្រអប់ Security PIN។ ⚠️ 🫆 ជា emoji ថ្មី (Unicode 16) — ឧបករណ៍ចាស់
  (មុន iOS 18.4 / Android 15) អាចបង្ហាញជាប្រអប់ទទេ។ បើឃើញដូច្នោះ សូមប្រាប់
  ខ្ញុំ ដើម្បីត្រឡប់ទៅ 👆 វិញ។
- **អក្សរក្នុងប៊ូតុងនោះឈរចំកណ្តាលជាក្រុមតែមួយ** (រូប + អក្សរ) និង **សារលើ
  អេក្រង់ចាក់សោឈរចំកណ្តាល** ជំនួសការតម្រឹមឆ្វេង។
- **ប្រអប់ដែលបើកនៅ ក៏ត្រូវលាក់ក្រោមសោដែរ** — ការចាក់សោអាចកើតឡើង
  **កណ្តាលការងារ** ឥឡូវនេះ ➜ ប្រអប់ដែលកំពុងបើកមិនត្រូវអានឃើញពីក្រោយសោ។

### ឧបករណ៍ audit

- **`app-lock-test.js`** ៖ ៥៤ ➜ **៩៩ assertion**។ បន្ថែមផ្នែក ១៣–១៩ ៖
  ចាកចេញ/ត្រឡប់មក ➜ ចាក់សោ · Refresh ខណៈចាក់សោ ➜ នៅចាក់សោ · PTR ក្រោយការគ្រប
  ➜ មិនចាក់សោ · ខល ➜ មិនចាក់សោ **និងទិសផ្ទុយ** (ការចាកចេញលើកក្រោយចាក់សោ) ·
  រើសឯកសារ ➜ មិនចាក់សោ · គ្មាន PIN ➜ មិនចាក់សោសោះ · ប្រអប់ដែលបើកនៅត្រូវលាក់។
  ធ្លាក់ **២៧** លើ `origin/main`; mutation ២ ➜ ចាប់បានទាំង ២។
- `history-patch-retry-test.js` និង `biometric-unlock-test.js` ចាក់ **កូដពិត**
  របស់ `noteAppLockExcuse()` ចូល sandbox (មិនមែន stub ទទេ)។
- `clock-hygiene.js` ៖ បន្ថែម `noteAppLockExcuse` ក្នុងបញ្ជីអនុញ្ញាត ព្រោះវា
  ដាក់ត្រាពេល **local សុទ្ធសាធ** ហើយអ្នកអានវាឆ្លងកាត់ `elapsedSince()`។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែ ហើយ CSP ក៏មិនប្រែដែរ។
- ⚠️ **ឧបករណ៍ដែលមាន Security PIN រួច នឹងត្រូវវាយ PIN រាល់ពេលត្រឡប់ចូល App**
  ក្រោយចាកចេញទៅ App ផ្សេង។ បើវាញឹកញាប់ពេក សូមប្រាប់ខ្ញុំ — អាចបន្ថែម
  «រយៈពេលអនុគ្រោះ» (ឧ. ចាកចេញក្រោម ១ នាទី ➜ មិនសុំ PIN) បាន។

---

## [2.22.0] — 2026-08-28 · ចាក់សោ App ពេលបើក (PIN ឬក្រយៅដៃ/មុខ)

**ZoeW** (`2.21.0` ➜ `2.22.0`, `zoew-v120` ➜ `zoew-v121`)។
**ZoeKeyGen មិនប្រែទេ** (`2.19.9`, `zoekeygen-v79`)។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាតស្វ័យប្រវត្តិ ·
ស្ថិតិយក) និង **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ**។
ការប៉ះ PTR មានតែ **ការបន្ថែមច្រកទ្វារមួយបន្ទាត់** (`appIsLocked`) ដែលជា
`false` ក្នុងគ្រប់ស្ថានភាពដែលមានពីមុន ➜ ឥរិយាបថពេលដោះសោរួច **ដដែលបេះបិទ**។

### បន្ថែម — 🔒 ចាក់សោ App ពេលបើក

**សំណើអ្នកប្រើ**៖ *«ដាក់ Pin code ឬស្កេនម្រាមដៃ/មុខ រាល់ពេលបើក app ZoeW
តែរក្សាការចងចាំ session login ៤ ម៉ោងដដែល»*។

ពេលបើក App ឡើងវិញ (វគ្គថ្មី) អេក្រង់ចាក់សោលេចឡើងពេញអេក្រង់៖ វាយ **Security
PIN** ដដែលដែលការពារ Config · Locker · កែទឹកប្រាក់ · នាំចូល Excel — ឬចុច
**«👆 ស្កេនក្រយៅដៃ ឬមុខ»** បើបានបើកវាទុក។

- ⛔ **session ៤ ម៉ោង នៅដដែលបេះបិទ** — ការចាក់សោជា **ស្រទាប់ចូលប្រើលើឧបករណ៍**
  មិនមែន authentication ទេ។ វា **មិនប៉ះ** `zoew_login_time` ·
  `remembered_email` ហើយ **មិនហៅ `signOut()`** សោះ។ ដោះសោរួច ➜ ចូលដល់ App
  ភ្លាមដោយមិនបាច់វាយពាក្យសម្ងាត់។
- **សោចាក់តែពេលមាន Security PIN** លើឧបករណ៍នោះ។ បើមិនទាន់មាន PIN ➜ App
  ដំណើរការដូចមុនបេះបិទ ហើយរបា Slide បង្ហាញ **«🔒 ចាក់សោពេលបើក App —
  ត្រូវកំណត់ PIN»** ដែលចុចម្តងដើម្បីកំណត់។
- ⛔ **ការផ្ទុកទំព័រឡើងវិញ *ក្នុងវគ្គដដែល* មិនសុំ PIN ម្តងទៀត** — ទង់ដោះសោ
  រស់នៅក្នុង `sessionStorage` (`zoew_app_unlocked`)។ នេះជាចំណុចសំខាន់ ៖
  **PTR (ទាញចុះដើម្បី Refresh)** និង `reloadForFirebaseSdk()` ធ្វើ
  `location.reload()` ពិត — បើសោចាក់រាល់ការផ្ទុក នោះ **រាល់ការទាញចុះ**
  ត្រូវវាយ PIN។ ការបិទ App រួចបើកវិញ (វគ្គថ្មី) ➜ ចាក់សោដដែល។
- ⛔ **ការចេញទៅខល (`📞 ខល`) មិនចាក់សោទេ** — ការត្រឡប់មក App វិញពីផ្ទៃខាងក្រោយ
  មិនមែនជាការផ្ទុកទំព័រឡើងវិញទេ ➜ គ្មាន PIN ត្រូវវាយ។ (ការចាក់សោតាម
  `visibilitychange` នឹងធ្វើឲ្យរាល់ការខលទាមទារ PIN — ដូច្នេះវាមិនត្រូវធ្វើ។)
- **ខណៈចាក់សោ ៖ ទិន្នន័យលាក់ពិត** — `.app-navbar` · `.app-pages` ·
  `.page-tabbar` · របា Slide ទទួល `visibility: hidden` ហើយផ្ទៃសោជា
  **ផ្ទៃស្រអាប់ស្តើងមិនថ្លា** ➜ គ្មានលេខអតិថិជនអានឃើញពីក្រោយសោ។
  ម៉ាស៊ីនស្កេន hardware ក៏ **មិនដណ្តើម focus** ពីប្រអប់ PIN ដែរ ហើយ PTR ត្រូវទប់។
- **ការជាប់សោដដែល** — ខុស ៥ ដង ➜ រង់ចាំ ១ នាទី ហើយ **សូម្បី PIN ត្រឹមត្រូវ
  ក៏ត្រូវបដិសេធ** ក្នុងអំឡុងនោះ។ វាប្រើ counter ដដែល (`zoew_pin_fail_count` ·
  `zoew_pin_lockout_until`) នឹងប្រអប់ PIN ដទៃ។
- **ផ្លូវចេញ «ភ្លេច PIN?»** — លុប PIN និងការចងជីវមាត្រ រួច **ចាកចេញពីប្រព័ន្ធ**។
  ⛔ វា **មិនធ្វើឲ្យសោខ្សោយទេ** ៖ ក្រោយនោះត្រូវចូលដោយ **អ៊ីមែល និងពាក្យសម្ងាត់**
  ដែលជាកូនសោពិត។ ⚠️ ការតភ្ជាប់ដែលអ៊ិនគ្រីបដោយ PIN ចាស់ (Lookup API ·
  នាំចូល Excel) ត្រូវកំណត់ថ្មី។
- **ចាកចេញ ➜ លុបទង់ដោះសោ** ➜ ការចូលបន្ទាប់ត្រូវឆ្លងសោម្តងទៀត។

### ឧបករណ៍ audit

- **ថ្មី៖ `app-lock-test.js`** (៥៤ assertion) — រត់ **ZoeW ពិតក្នុង Chromium**៖
  គ្មាន PIN ➜ មិនចាក់សោ · មាន PIN ➜ ចាក់សោហើយទិន្នន័យលាក់ពិត · session ៤ ម៉ោង
  មិនរងផល · PIN ខុស ➜ រាប់ចំនួន · ៥ ដងខុស ➜ PIN ត្រឹមត្រូវក៏ត្រូវបដិសេធ ·
  Refresh ក្នុងវគ្គដដែល ➜ មិនចាក់សោ · វគ្គថ្មី ➜ ចាក់សោ · ចាកចេញ ➜ លុបទង់ ·
  ប៊ូតុងជីវមាត្រលាក់/លេច · ការស្កេនស្វ័យប្រវត្តិដែលបរាជ័យត្រូវស្ងាត់ · ទម្រង់នៅ 320px។
  ធ្លាក់ **៣០** លើ tree មុនកែ។
- `sdk-offline-boot-test.js` ចាក់ទង់ «ដោះសោរួច» ព្រោះវាវាស់ការបើក
  **ក្រៅបណ្តាញ** មិនមែនការចាក់សោ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែ ហើយ CSP ក៏មិនប្រែដែរ។
- ⚠️ **ឧបករណ៍ដែលមាន Security PIN រួច នឹងឃើញអេក្រង់ចាក់សោភ្លាមក្រោយ deploy។**
  បើភ្លេច PIN ➜ ចុច «ភ្លេច PIN?» ➜ ចូលដោយអ៊ីមែល និងពាក្យសម្ងាត់វិញ។

---

## [2.21.0] — 2026-08-28 · បញ្ចូល ZoeImport ចូល ZoeW ៖ «នាំចូល Excel ទៅ Sheet» ក្នុងម៉ឺនុយការកំណត់

**ZoeW** (`2.20.8` ➜ `2.21.0`, `zoew-v119` ➜ `zoew-v120`)។
**ZoeKeyGen មិនប្រែទេ** (`2.19.9`, `zoekeygen-v79`) — គ្មានឯកសាររបស់វាប្រែសោះ។
**App `ZoeImport` ត្រូវលុបចេញពី repo ក្នុងជុំដដែល** (មើលផ្នែក «ដកចេញ» ខាងក្រោម)។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាតស្វ័យប្រវត្តិ ·
ស្ថិតិយក · ការបែងចែកតាម barcode) ហើយ **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ ·
ការរមូរ · ទម្រង់បង្ហាញរបស់ទូរស័ព្ទ** ដែរ។ វា **បន្ថែម** ប្រអប់ថ្មីមួយ
ព្រមទាំងធាតុថ្មីមួយក្នុងរបា Slide — គ្មានអ្វីចាស់ត្រូវប្តូរឡើយ។

### បន្ថែម — 📥 «នាំចូល Excel ទៅ Sheet» ក្នុងម៉ឺនុយ ⚙️ ការកំណត់

**សំណើអ្នកប្រើ**៖ *«ខ្ចិលប្រើ app ២ ចង់អោយវាមានតែ ១»*។ មុននេះការនាំចូល
Excel ចូល Google Sheet ត្រូវបើក **App ដាច់ដោយឡែក (ZoeImport)** ដែលមាន PIN
ផ្ទាល់ខ្លួន និងការតភ្ជាប់ផ្ទាល់ខ្លួន។ ឥឡូវខ្សែសង្វាក់ដដែលរស់នៅ **ក្នុង ZoeW
ផ្ទាល់**៖

> របា Slide ⚙️ ➜ **«📥 នាំចូល Excel ទៅ Sheet»** ➜ វាយ **Security PIN** ➜ ប្រអប់នាំចូល

ជំហានខាងក្នុងប្រអប់ **ដូច ZoeImport បេះបិទ**៖

| ជំហាន | អ្វីធ្វើ |
|---|---|
| **១ ការតភ្ជាប់** | Web app URL របស់ Apps Script + ពាក្យសម្ងាត់នាំចូល (`IMPORT_PASSWORD`) ➜ «សាកល្បង និងរក្សាទុក» |
| **២ ជ្រើសឯកសារ** | ចុច ឬទម្លាក់ឯកសារ `.xlsx` · `.xls` · `.csv` |
| **៣ ការផ្គូផ្គង Column** | Tab · ជួរដេក header · A Barcode · B DOD · C COD · D Phone (ស្វ័យប្រវត្តិពី server) បូកតារាងមើលជាមុន និងចំណាំចំនួនជួរ/ស្ទួន/រំលង |
| **៤ នាំចូល** | របៀប «សម្អាតរួចដាក់ថ្មីជំនួស» · «បន្ថែម + កែ» · «បន្ថែមតែថ្មី» |
| **🗑️ សម្អាត** | លុបគ្រប់ជួរដេកក្នុង Sheet ដោយទុកតែ header |

- **ការតភ្ជាប់ត្រូវអ៊ិនគ្រីប** — URL និងពាក្យសម្ងាត់រក្សាទុកជា AES-GCM ក្រោម
  កូនសោដែល derive ពី **Security PIN របស់ ZoeW** (salt ថ្មី
  `zoew_sheet_import_secret_v1`, កូនសោផ្ទុក `zoew_sheet_import_config`)។
  ⛔ គ្មានអ្វីនៅជាអក្សរធម្មតាក្នុង localStorage ឡើយ។
- **ការនាំចូលបញ្ចប់ ➜ cache តារាងអតិថិជនត្រូវសម្អាត** ដូច្នេះការស្កេនបន្ទាប់
  ទាញតម្លៃថ្មីមកភ្លាម មិនបាច់រង់ចាំ ៥ នាទី។
- ការនាំចូលបន្ថែម **ការទាញយកឡើងវិញលើកំហុស** ៖ server បដិសេធ ឬក្រៅបណ្ដាញ ➜
  សារបរាជ័យពិត (⛔ **មិនមែន ✅**) ហើយប៊ូតុងត្រឡប់ជាធម្មតាវិញ។

### សុវត្ថិភាព

- **ផ្លូវតែមួយ** ទៅប្រអប់នេះគឺ `requestPinBeforeConfig(openSheetImportModal, 'sheetImport')`។
  `openSheetImportModal` **មិនស្ថិតក្នុង `ACTION_ALLOWLIST`** ➜ គ្មាន `data-act`
  ណាបើកវាដោយរំលង PIN បានទេ។
- **PIN ខុស ➜ ស្រាយមិនបាន តែ *មិនលុប* record** — ថ្នាក់មេរៀន 2.17.4
  («មិនអាចផ្ទៀងផ្ទាត់» ≠ «ខុស»)។ អ្នកប្រើវាយ PIN ត្រឹមត្រូវវិញ ➜ ការតភ្ជាប់
  ត្រឡប់មកភ្លាម។
- **ចាកចេញ ➜ គ្មានអ្វីសល់** — `clearSensitiveModalFields()` ហៅ
  `clearSheetImportSession()` ដែលលុបកូនសោ AES · URL · ពាក្យសម្ងាត់ ·
  workbook · តារាងមើលជាមុន · គោលដៅ Sheet ចេញទាំងអស់។
- **សំណើត្រូវជា *simple request* ជានិច្ច** (`Content-Type: text/plain;charset=utf-8`,
  គ្មាន header ផ្ទាល់ខ្លួន) ➜ គ្មាន preflight `OPTIONS` ដែល Apps Script
  មិនឆ្លើយ។ ⛔ នេះជាថ្នាក់កំហុសដែល `CLAUDE.md` ព្រមានទុក — ឥឡូវវាត្រូវបាន
  **វាស់លើ header ពិតដែល browser ពិតផ្ញើ**។
- រាល់សំណើឆ្លងកាត់ `fetchWithTimeout()` (ពិដាន ៣០ វិ. ជាមួយ `AbortController`
  ពិត) ហើយ `navigator.onLine === false` ➜ **មិនបាញ់សំណើសោះ**។

### ឧបករណ៍ audit

- **ថ្មី៖ `sheet-import-test.js`** (៧៣ assertion) — រត់ **ZoeW ពិតក្នុង
  Chromium** ៖ ចុចធាតុរបា Slide ➜ PIN ➜ រក្សាទុកការតភ្ជាប់ ➜ អាន `.xlsx` ពិត
  ➜ ផ្គូផ្គង ➜ នាំចូល ➜ ករណីបរាជ័យ ➜ ចាកចេញ។ វា **ធ្លាក់ ៣៤ លើ `origin/main`**។
  ការអះអាងសំខាន់ៗមាន **២ ខាង** ៖ «ដំណើរការ» **និង** «បដិសេធពេលត្រូវបដិសេធ»។
- ភ្ជាប់ចូល `run-all.sh` ទាំងផ្នែករត់ធម្មតា និងផ្នែក baseline
  (`SHEETIMPORT_APP_DIR`)។

### ដកចេញ — App `ZoeImport`

តាមសំណើអ្នកប្រើ (*«ហើយលុប ZoeImport ចេញពី repo»*) ថត `ZoeImport/` ត្រូវបាន
លុបចេញទាំងស្រុង ព្រោះមុខងាររបស់វាផ្លាស់ចូល ZoeW រួចហើយ។

- ⛔ **ថត `zto-import/` នៅដដែល** — វាជាខាង **server** (Apps Script) ដែល ZoeW
  ហៅ។ URL និងពាក្យសម្ងាត់នាំចូល **ដដែល** នៅតែប្រើបាន គ្មានអ្វីត្រូវ redeploy ទេ។
- ឧបករណ៍ audit ដែលធ្លាប់ស្កេន App ទាំង ៣ ឥឡូវស្កេន **ទាំង ២** ហើយផ្នែក
  ZoeImport ក្នុង `network-timeout-test.js` · `toast-truth-test.js` ·
  `layout-check.js` · `fluid-type-focus-test.js` · `clock-hygiene.js`
  ត្រូវដកចេញ។ `run-all.sh` លែងរត់ `ZoeImport/test.js`។
- ⛔ **ជាន់អប្បបរមារបស់ `monotonic-gate-test.js` ធ្លាក់ពី ៣ ➜ ២** —
  `elapsedSince()` ជា helper ចែករំលែករវាង ZoeW និង ZoeKeyGen ប៉ុណ្ណោះ។
  កុំបន្ថយវាទាបជាង ២។
- ℹ️ `docs/BUG-HISTORY.md` **រក្សាធាតុ ZoeImport ទុកដដែល** — វាជាកំណត់ត្រា
  ប្រវត្តិសាស្ត្រ ហើយការកែវាធ្វើឲ្យបាត់មេរៀន។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ⚠️ **បិទ ឬលុប Netlify site របស់ `ZoeImport`** — ថតរបស់វាលែងមានក្នុង repo
  ➜ ការ deploy លើកក្រោយនឹងបរាជ័យ។ ⛔ **កុំបិទ Apps Script (`zto-import`)**។
- ⚠️ **លើកដំបូងត្រូវវាយ URL និងពាក្យសម្ងាត់នាំចូលម្តង** ក្នុង ZoeW —
  ការតភ្ជាប់ដែលរក្សាទុកក្នុង ZoeImport មិនផ្ទេរមកទេ ព្រោះវាអ៊ិនគ្រីប
  ដោយ PIN ផ្សេង (PIN របស់ ZoeImport ≠ Security PIN របស់ ZoeW) ហើយ storage
  របស់វារស់នៅលើ origin ផ្សេង។
- **Firebase rules មិនប្រែ ហើយ CSP ក៏មិនប្រែដែរ**
  (`connect-src` មាន `https://script.google.com` រួចស្រាប់សម្រាប់ Lookup API)។

---

## [2.20.8] — 2026-08-28 · ជុំ deep audit ៖ listener ដែលងាប់តែឯង · ការលាក់ secret ដែលរអិលកាត់ · ឧបករណ៍ audit ដែលបំផ្លាញខ្លួនឯង

**ZoeW** (`2.20.7` ➜ `2.20.8`, `zoew-v118` ➜ `zoew-v119`) និង
**ZoeKeyGen** (`2.19.8` ➜ `2.19.9`, `zoekeygen-v78` ➜ `zoekeygen-v79`)។
**ZoeImport មិនប្រែទេ** (`1.3.3`, `zoeimport-v12`) — គ្មានឯកសាររបស់វាប្រែសោះ។
ZoeKeyGen ឡើងព្រោះ `error-reporting.js` ជាឯកសារ **byte-identical** រវាង App ទាំង ២។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត · ស្ថិតិយក ·
ការបែងចែកតាម barcode) ហើយ **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ ·
ទម្រង់បង្ហាញ** ដែរ។

### កែកំហុស ១ — 🔴 listener ដែលងាប់ **តែឯង** ត្រូវប្រកាសថាជាសះស្បើយដោយ **បងប្អូន** របស់វា

ZoeW ភ្ជាប់ listener **៦** ទៅ Firebase (`exchangeRate` · `dailyRevenue` ·
`monthlyRevenue` · `dailyPickup` · `history` · `deleted`)។ ពេល listener **ណាមួយ**
ត្រូវ server បោះបង់ (`permission_denied` លើ node តែមួយ · rules ប្តូរ ·
ការ cancel ដោយ server) នោះ `dbListenersFailed` ត្រូវលើក ហើយជណ្តើរស្តារត្រូវ
តាំងម៉ោង។ ប៉ុន្តែច្រកទ្វារដែលសម្រេចថា «ជាសះស្បើយហើយ» សួរតែថា
**«តើមាន path ណាមួយមិនទាន់មកដល់ទេ?»** — ហើយក្រោយ App ដំណើរការមួយសន្ទុះ
path ទាំង ៦ **មកដល់គ្រប់រួចហើយ** ➜ បញ្ជីនោះ **ទទេ**។

ដូច្នេះ snapshot បន្ទាប់ពី path **ណាមួយផ្សេង** (ប្រវត្តិប្តូររាល់ការស្កេន) ៖

| អ្វីកើតឡើង | លទ្ធផលមុនកែ |
|---|---|
| ទង់បរាជ័យ | **លុបចោល** ទោះ listener នៅងាប់ |
| កាលវិភាគស្តារ | **លុបចោល** ➜ listener នោះ **មិនដែល attach ឡើងវិញ ពេញវគ្គ** |
| ចំណុចស្ថានភាព | **បៃតង** ខណៈទិន្នន័យកក |
| Toast | «✅ ទិន្នន័យភ្ជាប់មកវិញហើយ» — **ការកុហក** |

⛔ **ហើយបើ path ដែលងាប់ជា `deleted` នោះវាធ្ងន់ជាងច្រើន** ៖ ច្រកទ្វារការពារ
marker របស់កំណែ 2.20.1 (`clearStaleRestoreMarkers()` និង
`dropStaleRestoreMarkers()`) សួរតែថា កូនសោ `deleted` **នៅ pending ទេ** — ហើយ
កូនសោនោះត្រូវលុបចេញតាំងពី snapshot ដំបូង ➜ ច្រកទ្វារ **បើកចំហលើ
`deletedItems` ដែលកក** ➜ marker របស់ឧបករណ៍ **ផ្សេង** ដែលកំពុងស្តារត្រូវលុប ➜
`permission_denied` ➜ **«ដក»/«លុប» ស្លាប់ជារៀងរហូត** (ថ្នាក់ដដែលនឹង 2.17.3)។

**ការកែ ៖ តាមដានថា path *ណា* ដែលងាប់** (`dbListenerFailedPaths`) ៖
`handleDbListenerError(err, pathKey)` កត់កូនសោ; `noteDbListenerAlive(pathKey)`
លុបវាចេញ; ទង់រលត់តែពេល **គ្មាន path ណា pending ហើយក៏គ្មាន path ណាងាប់**។
ច្រកទ្វារ marker ឥឡូវឆ្លងកាត់ **មូលដ្ឋានតែមួយ** `dbListenerViewIsStale(key)`
ដែលរាប់ទាំង «មិនទាន់មកដល់» និង «ងាប់»។

⛔ **ទិសផ្ទុយត្រូវរក្សា** ៖ ការជាសះស្បើយ **ពិត** នៅតែលុបទង់ដដែល (path ដែល
ងាប់ដឹងខ្លួនវិញ ➜ កូនសោត្រូវលុប) — ការការពារថ្មីមិនត្រូវ **ជាប់** ជារៀងរហូតទេ។

### កែកំហុស ២ — 🔴 ការលាក់ secret **រអិលកាត់ស្ងាត់ៗ** លើវត្ថុដែលសរសេរជាន់មិនបាន

`redactDeep()` (ក្នុង `error-reporting.js` — ផ្លូវដែល Sentry ហៅមុនផ្ញើ) លាក់
secret ដោយ **កែនៅនឹងកន្លែង** (`value[k] = '[redacted]'`)។ ឯកសារនោះជា
`'use strict'` ➜ ការសរសេរទៅលើ property ដែល **frozen** · `writable: false` ·
ឬមាន **getter តែម្យ៉ាង** **បោះ TypeError** ➜ `try/catch` ដែលរុំវា
**លេបកំហុសនោះ** ➜ **តម្លៃដើមរស់រានចូល payload របស់ Sentry**។

វាស់បានលើកូដមុនកែ (បញ្ជូន payload ពិតឆ្លងកាត់ `redactEvent()` ពិត) ៖

| Payload | មុនកែ | ក្រោយកែ |
|---|---|---|
| `Object.freeze({ pin: '1234' })` | **`1234` លេច** | `[redacted]` |
| `Object.freeze({ url: '…?token=SECRET123' })` | **`SECRET123` លេច** | `token=[redacted]` |
| `password` ដែល `writable: false` | **`p@ss` លេច** | `[redacted]` |
| property ដែលមាន getter តែម្យ៉ាង | **លេច** | `[redacted]` |

⛔ **វាធ្ងន់ជាងការបាត់កូនសោមួយ** ៖ ពេលវត្ថុមួយ frozen នោះ **រាល់ខ្សែអក្សរ
ខាងក្នុងវា** ក៏សរសេរជាន់មិនបានដែរ ➜ URL ដែលមាន `token=` · header `Bearer` ·
JWT · deployment ID របស់ Apps Script **ឆ្លងកាត់ដោយមិនត្រូវលាក់សោះ** ➜
ស្រទាប់ការពារទាំងមូល **រំលងដោយស្ងាត់** សម្រាប់ subtree នោះ។

**ការកែ** ៖ ពេលការកែនៅនឹងកន្លែងធ្វើមិនបាន `redactDeep()` **ចម្លងវត្ថុនោះ
ម្តង** រួចលាក់ចូលច្បាប់ចម្លង ហើយត្រឡប់វាទៅអ្នកហៅ (`beforeSend` /
`beforeBreadcrumb` ឥឡូវប្រើ **តម្លៃដែលត្រឡប់មកវិញ**)។ ការសរសេរត្រូវ
**ផ្ទៀងផ្ទាត់ថាជាប់ពិត** — setter ដែលមិនធ្វើអ្វី **មិនបោះកំហុសទេ** ➜
`try/catch` តែម្យ៉ាងចាប់មិនបាន។
⛔ **ទិសផ្ទុយត្រូវរក្សា** ៖ វត្ថុធម្មតានៅតែត្រូវកែ **នៅនឹងកន្លែងដដែល**
(គ្មានការចម្លងឥតប្រយោជន៍) ហើយ `barcode` · `keyId` · `count` **នៅតែមើលឃើញ**
សម្រាប់ការ debug (ច្បាប់ «keep case»)។

### ឧបករណ៍ audit ១ — ⛔⛔ `exit-code-integrity.js` អាចទុក checker **ពុល** ក្នុង repo

ឧបករណ៍នោះពុលការអះអាងរបស់ checker នីមួយៗ ដើម្បីវាស់ថាការធ្លាក់ឡើងដល់
exit code។ ជំនាន់មុនរបស់វាពុល **ឯកសារដើម** រួចពឹងលើ `finally` ·
`process.on('exit')` និង handler របស់ signal ដើម្បីស្តារ។ **ការការពារនោះ
ដំណើរការមិនបានទេ** ៖ រង្វិលជុំពុលហៅ `execFileSync` ដែល **ទប់ event loop**
➜ handler របស់ SIGTERM ជា callback JS ដែល **រត់មិនបាន** ➜ `timeout -k 10 300`
របស់ `run-all.sh` បញ្ចប់ដោយ **SIGKILL** ដែល **គ្មាន handler ណាចាប់បានសោះ**។

**វាស់បានពិត** (សម្លាប់វានៅវិនាទីទី ២.៥ រួចប្រៀបធៀប hash នៃឯកសារ ១០០) ៖

| ជំនាន់ | ឯកសារដែលនៅពុលក្នុង working tree |
|---|---|
| មុនកែ (ពុលនៅនឹងកន្លែង) | **១ — `checker-coverage.js`** (meta-checker ខ្លួនឯង!) |
| ក្រោយកែ (ឯកសារស្រមោល) | **០** |

ផលមុនកែ ៖ `git commit -a` បន្ទាប់ **ship checker ដែល `cond = false` ជាប់ជាប់**
➜ **ឧបករណ៍ audit ខ្លួនវាបាក់ដោយស្ងាត់** — ថ្នាក់អាក្រក់ជាងបៃតងក្លែងក្លាយ។
ការពុលឥឡូវធ្វើលើ **ឯកសារស្រមោលក្បែរឯកសារដើម** (`.tmp-poison-*` ក្នុងថតដដែល
➜ `__dirname` · `require` ទាក់ទង · `__filename` នៅដំណើរការដូចដើម) ហើយ
**ឯកសារដើមមិនដែលត្រូវបើកសរសេរសោះ**។

### ឧបករណ៍ audit ២ — ⛔ checker ២ នៅ bind port ថេរ លើ `0.0.0.0`

`CLAUDE.md` ចែងតាំងពីយូរថា checker ត្រូវ `listen(0, '127.0.0.1')` — **តែគ្មាន
ឧបករណ៍ចាក់សោវា**។ កំណែ 2.20.7 កែ checker ៥ ដោយដៃ ហើយ **២ ទៀតរអិលកាត់**
(`csp-lazy-resource-test` 8620 · `toast-truth-test` 8560)។ នោះជាភស្តុតាងផ្ទាល់
នៃច្បាប់ទី ១៣ ៖ **អ្វីដែលគ្មានឧបករណ៍ចាក់សោ នឹងវិលមកវិញ**។ ឥឡូវទាំង ២ ត្រូវកែ
ហើយ `checker-coverage.js` ចាក់សោច្បាប់នេះ។

### ឧបករណ៍ audit ៣ — assertion ថ្មី

| ឧបករណ៍ | អ្វីថ្មី | ធ្លាក់លើ `origin/main` |
|---|---|---|
| `connection-recovery-test.js` | listener ដែលងាប់តែឯង (ស្ថានភាព «ដំណើរការរួចមួយសន្ទុះ») + ច្រកទ្វារ marker + ការបញ្ជូនកូនសោ path | **១១** |
| `secret-hygiene.js` | វត្ថុ frozen · `writable: false` · getter តែម្យ៉ាង · setter ដែលមិនធ្វើអ្វី | **៥** |
| `checker-coverage.js` | ផ្នែក ៥ ៖ SIGKILL មិនត្រូវប៉ះឯកសារ checker (វាស់ឥរិយាបថពិត) · ផ្នែក ៦ ៖ ច្បាប់ port · ផ្នែក ៧ ៖ សំណល់នៃការពុល | — (ឧបករណ៍ថ្មី) |
| `listener-pending-key-test.js` | listener `deleted` **ងាប់** ➜ ច្រកទ្វារ marker ត្រូវបិទ; ការសួរដែលរស់ក្រោយ helper ចែករំលែក ក៏ត្រូវរាប់ដែរ | **១** |

⚠️ **ភស្តុតាងផ្ទាល់នៃថ្នាក់ «ឧបករណ៍បំផ្លាញខ្លួនឯង»** ៖ ខណៈកំពុងសាកជំនាន់ចាស់
ក្នុងជុំនេះ `checker-coverage.js` **ខ្លួនឯង** ត្រូវទុកឲ្យមាន `fail++` ចាក់
បន្ថែម **១៤ ដង** ក្នុង working tree ➜ វារាយការណ៍ «❌ ធ្លាក់ 14» ខណៈការអះអាង
**ទាំងអស់បោះ `ok`**។ នោះជា **ការធ្លាក់ដែលគ្មានឈ្មោះ** — អាក្រក់ជាងបៃតង
ក្លែងក្លាយ ព្រោះវាបញ្ឆោតទាំង ២ ទិស។ ផ្នែក ៧ ថ្មីធ្វើឲ្យសំណល់បែបនោះលេចជា
ការធ្លាក់ **ដែលមានឈ្មោះ**។

⚠️ **មេរៀនអំពីឧបករណ៍នៃជុំនេះ** ៖ `connection-recovery-test.js` មាន assertion
**១២៧** ហើយ **បៃតងទាំងអស់** លើកូដដែលមានកំហុសនេះ។ មូលហេតុ ៖ សេណារីយ៉ូ
ទាំងអស់បាញ់ `errCb` **ភ្លាមក្រោយ `initDatabaseListeners()`** ➜ path ទាំង ៦
នៅ pending ➜ ល័ក្ខខ័ណ្ឌដែលមានកំហុស **ត្រូវការពារដោយចៃដន្យ**។
➜ **សំណួរទី ៨ សម្រាប់ checker ថ្មីគ្រប់ពេល ៖ «វាដាក់ប្រព័ន្ធក្នុង *ស្ថានភាព*
ណា មុនអះអាង?»** ការអះអាងត្រឹមត្រូវក្នុងស្ថានភាពដែលកំហុសមិនអាចកើត
គឺជាបៃតងក្លែងក្លាយ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** Firebase rules **មិនប្រែសោះ** ហើយ CSP ក៏មិនប្រែដែរ — គ្រាន់តែ deploy។

---

## [2.20.7] — 2026-08-28 · ជុំ deep audit ZoeW ៖ នាឡិកាថយក្រោយ លែងធ្វើឲ្យ App ជាប់ · ការសម្អាតលែងបំផ្លាញ

**ZoeW** (`2.20.6` ➜ `2.20.7`, `zoew-v117` ➜ `zoew-v118`),
**ZoeKeyGen** (`2.19.7` ➜ `2.19.8`, `zoekeygen-v77` ➜ `zoekeygen-v78`) និង
**ZoeImport** (`1.3.2` ➜ `1.3.3`, `zoeimport-v11` ➜ `zoeimport-v12`)។
App ទាំង ៣ ប្រែ ព្រោះ helper ពិដានល្បឿន `elapsedSince()` ជា helper **ចែករំលែក**
ហើយ `error-reporting.js` ជាឯកសារ **byte-identical** រវាង ZoeW និង ZoeKeyGen។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ស្ថិតិយក · ការបែងចែក
តាម barcode) ហើយ **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ** ដែរ។

### កែកំហុស ១ — ⛔ នាឡិកាទូរស័ព្ទថយក្រោយ ធ្វើឲ្យ **ការស្តារបណ្តាញជាប់សោជាអចិន្ត្រៃយ៍**

រាល់ពិដានល្បឿនរបស់ App សរសេរជាទម្រង់ `Date.now() - lastXAt < GAP`។ ពេលនាឡិកា
ឧបករណ៍ **ថយក្រោយ** (អ្នកប្រើប្តូរថ្ងៃ · ទូរស័ព្ទអស់ថ្មរួច boot ដោយ RTC ខុស ·
NTP កែធំ) នោះ `now - last` ក្លាយជា **អវិជ្ជមាន** ➜ តូចជាង GAP **ជានិច្ច** ➜
ច្រកទ្វារនោះបិទ **រហូតដល់បិទបើក App ឡើងវិញ**។ វាស់បានលើកូដមុនកែ ៖

| ច្រកទ្វារ | អ្វីអ្នកប្រើឃើញ |
|---|---|
| `forceDatabaseReconnect()` | App **លែងព្យាយាមភ្ជាប់ Server ឡើងវិញ** — ចំណុចស្ថានភាពនៅប្រផេះរហូត |
| `attemptDbListenerRecovery()` | តារាងជាប់ «កំពុងភ្ជាប់ឡើងវិញ...» មិនចេះឈប់ |
| `dbListenerResyncIsProgressing()` | «កំពុងរីកចម្រើន» **ជានិច្ច** ➜ ជណ្តើរស្តារមិនដែល attach ឡើងវិញ |
| `attemptAutoLookup()` | cooldown មិនចេះផុត ➜ **ការបំពេញលេខទូរស័ព្ទស្វ័យប្រវត្តិងាប់** |
| `fetchCustomerDataTableRows()` | តារាងអតិថិជនចាស់ត្រូវចាត់ទុកជា «ថ្មី» រហូត |
| `throttledSwUpdate()` | លែងពិនិត្យកំណែថ្មី |

ហើយទម្រង់ `setTimeout(fn, GAP - since)` ក្លាយជា **`setTimeout(fn, ៣១,៥៣៦,០០៣,០០០ms)`**
(វាស់បានពិត) ➜ browser coerce ទៅ int32 ➜ **បាញ់ភ្លាមៗជារង្វិលជុំក្តៅ ស៊ីថ្ម**។

**ការកែ ៖ `elapsedSince(mark)`** ជាមូលដ្ឋាន **តែមួយ** នៃរាល់ការវាស់រយៈពេល
កន្លងផុត — វា **fail-open** (`Infinity`) ពេលនាឡិកាថយក្រោយ ➜ ការស្តារបន្តដំណើរការ
ភ្លាម។ ⛔ **ទិសផ្ទុយត្រូវរក្សា** ៖ ក្នុងនាឡិកាធម្មតា ពិដានទាំងអស់ **នៅតែទប់ដដែល**
(តេស្តអះអាង ២ ខាង)។ ការប្រៀបធៀប **ថ្ងៃឈប់** (PIN lockout `Date.now() < until`)
មិនស្ថិតក្នុងច្បាប់នេះទេ — ការថយក្រោយធ្វើឲ្យ lockout **យូរជាង** ដែលជាទិសសុវត្ថិភាព។

កែក្នុង **App ទាំង ៣** ៖ ZoeW ១៩ កន្លែង · ZoeKeyGen ៥ · ZoeImport ២។

### កែកំហុស ២ — ⛔ ការសម្អាតដែលបំផ្លាញ រត់ដោយនាឡិកាខុស ក្រោយបណ្តាញដាច់

កំណែ 2.20.5 បានដាក់ច្រកទ្វារ `cleanupClockIsTrustworthy()` រួច — ប៉ុន្តែទង់
`serverClockTrusted` ត្រូវសរសេរ **តែម្តង** ហើយ **មិនដែលត្រឡប់ជា `false` វិញ**។
ដូច្នេះលំដាប់ពិត ៖

> បើក App ➜ ភ្ជាប់ Server (ទង់ក្លាយជា `true`) ➜ **បិទ WiFi** ➜ អ្នកប្រើប្តូរ
> ថ្ងៃទូរស័ព្ទ ➜ `getServerNow()` រំកិលតាមនាឡិកាឧបករណ៍ម្តងទៀត ខណៈច្រកទ្វារ **នៅបើក**

វាស់បានលើកូដមុនកែ (ថ្ងៃលោត ១ ឆ្នាំ ក្រោយបណ្តាញដាច់)៖ **កញ្ចប់ ២ ត្រូវផ្លាស់ចូល
ធុងសំរាម** (មួយជា `abandon` ➜ **ដកលុយ**) និង **ធុងសំរាមទាំងមូលត្រូវ purge
ជាអចិន្ត្រៃយ៍**។ នេះជាថ្នាក់ដដែលនឹងមេរៀន 2.20.6 អំពី License ៖ *«ទង់នៅ `true`
បន្តក្រោយចាកចេញពីបណ្តាញ ហើយ offset ក្លាយជាចាស់»*។

**ការកែ ៖ `cleanupClockIsTrustworthy()` ត្រូវការការភ្ជាប់ **រស់** ដែរ**
(`serverClockTrusted && isDatabaseConnected`)។ នេះជាការ **ពន្យារ** មិនមែនការ
**លុប** ការងារទេ — ពេលភ្ជាប់មកវិញ ការសម្អាតដដែលរត់ដោយម៉ោង server ពិត
(តេស្តអះអាង ២ ខាង)។ ផលរួម ៖ **គ្មានការសរសេរបំផ្លាញណាចូលជួរខណៈក្រៅបណ្តាញទៀតទេ**។

### សុវត្ថិភាព — ការលាក់ secret ៖ អ្នកបំបែក `:` · `Bearer` · JWT

`redactDeep()` លាក់តាមឈ្មោះកូនសោវត្ថុបានល្អរួចហើយ ប៉ុន្តែផ្លូវ **ខ្សែអក្សរ**
ស្គាល់តែអ្នកបំបែក **`=`**។ វាស់បានពិតលើ `redactUrl()` មុនកែ ៖

| ទម្រង់ | មុនកែ |
|---|---|
| `pin: 4321` (console breadcrumb) | **មិនលាក់** |
| `{"apiKey":"AIza…"}` (JSON ក្នុងខ្សែអក្សរ) | **មិនលាក់** |
| `X-Api-Key: sk_live_…` (header dump) | **មិនលាក់** |
| `Authorization: Bearer eyJ…` | **មិនលាក់** |
| JWT ឆៅ (`eyJ….eyJ….sig`) | **មិនលាក់** |

Sentry ចាប់ breadcrumb របស់ console **ដោយស្វ័យប្រវត្តិ** ដូច្នេះអត្ថបទដែល
អ្នកមិនបានគ្រោងទុកឆ្លងកាត់ redaction។ ឥឡូវទម្រង់ទាំង ៥ ត្រូវលាក់។
⛔ **ទិសផ្ទុយត្រូវរក្សា** ៖ `barcode:` · `id:` · `count:` · `locker:` · ម៉ោង
`14:30:05` · ត្រា ISO · host ក្នុង URL · សារ `TypeError: Failed to fetch`
**នៅតែមើលឃើញ** សម្រាប់ debug (ច្បាប់ «keep case»)។

### ឧបករណ៍ audit

- **ថ្មី ៖ `monotonic-gate-test.js`** (១៦ assertion) — ចាក់សោច្បាប់ «រយៈពេល
  កន្លងផុតត្រូវឆ្លងកាត់ `elapsedSince()`»។ ២ ជាន់ ៖ **ស្តាទិច** (AST + dataflow
  ១ ជាន់ ក្នុងវិសាលភាព function — ដូច្នេះ parameter ឈ្មោះ `now` មិនត្រូវច្រឡំ)
  និង **ឥរិយាបថ** (រត់ច្រកទ្វារពិតក្រោមនាឡិកាក្លែងដែលថយក្រោយ)។
  ធ្លាក់ **៨** លើ `origin/main`។
- **`cleanup-clock-guard-test.js`** ៖ បន្ថែមសេណារីយ៉ូ «ភ្ជាប់ ➜ ដាច់ ➜ នាឡិកាលោត»
  បូកទិសផ្ទុយ «ភ្ជាប់មកវិញ ➜ ការសម្អាតរត់វិញ»។ ធ្លាក់ **៣** លើ `origin/main`។
- **`secret-hygiene.js`** ៖ បន្ថែម ១៤ assertion (៨ «ត្រូវលាក់» + ៦ «មិនត្រូវ
  លាក់លើស»)។ ធ្លាក់ **៨** លើ `origin/main`។
- **⛔ ជួសជុលការរំលោភច្បាប់ port របស់គម្រោងខ្លួនឯង** — checker **៥**
  (`setup-link-browser-test` · `layout-check` · `boot-runtime` · `field-shape-test` ·
  `fluid-type-focus-test`) bind **port ថេរ** (8810/8660/8410/8790/8760…) ខណៈ
  `CLAUDE.md` ចែងឲ្យប្រើ `listen(0)`។ ការរត់ ២ instance ស្របគ្នា ➜ `EADDRINUSE`
  ➜ **ការធ្លាក់ក្លែងក្លាយដែលមើលទៅដូចកំហុសកូដ** (ជួបពិតក្នុងជុំនេះខណៈធ្វើ
  mutation testing ស្របគ្នា)។ ឥឡូវទាំង ៥ ប្រើ `listen(0, '127.0.0.1')` ➜ ក៏ឈប់
  បើកចំហលើ `0.0.0.0` ដែរ។
- **sandbox** ៖ `partial-pickup-cleanup` · `restore-marker-hygiene` ·
  `emu/crud-rules-flow` ប្រកាស `isDatabaseConnected`; `connection-recovery` ·
  `reconnect-ladder` · `scan-engine` ចាក់ `elapsedSince()` **ពិត**;
  `ui-flow` ៖ `.info/*` ឥឡូវឆ្លើយដដែលរាល់ការបាញ់ឡើងវិញ (មុននេះ `fireAll()`
  ធ្វើឲ្យ `.info/connected` ក្លាយជា `null` ក្រោយការសរសេរដំបូង)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែសោះ (ទាំង `firebase-database.rules.json`
  និង `ZoeKeyGen/firebase-database.rules.json`) ហើយ CSP ក៏មិនប្រែដែរ។
  គ្រាន់តែ deploy។

---

## [2.20.6] — 2026-08-27 · Key រឹងមាំ ៖ ការប្តូរម៉ោង លែង reset ការ Activate បាន

**ZoeW** (`2.20.5` ➜ `2.20.6`, `zoew-v116` ➜ `zoew-v117`) និង
**ZoeKeyGen** (`2.19.6` ➜ `2.19.7`, `zoekeygen-v76` ➜ `zoekeygen-v77`) —
ZoeKeyGen ឡើងព្រោះ `license-verify.js` ជាឯកសារចែករំលែក **byte-identical**។
**ZoeImport មិនប្រែទេ**។

ជុំនេះមកពីសំណើអ្នកប្រើដោយផ្ទាល់៖ *«អោយ key រឹងមាំ មិនអាច reset activate
បានវិញដោយកែម៉ោង»*។ **គាត់ត្រូវ** — រន្ធពិត **២** ត្រូវបានវាស់លើកូដពិត។

⛔ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត · ស្ថិតិយក)
ហើយ **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ** ដែរ។

### សុវត្ថិភាព — រន្ធនាឡិកា ២ ដែលវាស់បានលើកូដពិត

| រន្ធ | អ្វីដែលធ្វើបានមុនកែ |
|---|---|
| **ការអនុគ្រោះ ៣ ថ្ងៃ reset បានគ្មានដែនកំណត់** | ក្រៅបណ្តាញ ➜ ហួសអនុគ្រោះ ➜ **បង្វិលនាឡិកាថយក្រោយ ១ ថ្ងៃ** ➜ ត្រឡប់ជា `active` វិញ ➜ ធ្វើម្តងទៀតបានរហូត |
| **Key ដែលផុតកំណត់ពិត រស់ឡើងវិញ** | លុប site data ➜ បិទបណ្តាញ ➜ បង្វិលនាឡិកាថយក្រោយមុនថ្ងៃផុតកំណត់ ➜ paste Key ចាស់ ➜ **activate ជោគជ័យ ហើយប្រើបានពេញលេញ** |

**ការកែ ៣**៖

1. **`activate()` ត្រូវការសាលក្រម server ពិត** (`checkOnline().ok === true`)។
   មុននេះ `online.ok === null` («ផ្ទៀងផ្ទាត់មិនបាន») **រអិលកាត់** ➜ ច្បាប់
   «`unverified` ➜ រក្សាទុក តែកុំផ្តល់សិទ្ធិថ្មី» ដែលឯកសារចែងតាំងពី 2.17.4
   **មិនដែលត្រូវអនុវត្តលើផ្លូវនេះសោះ**។ ការ Activate ឥឡូវត្រូវការអ៊ីនធឺណិត។
2. **ម៉ោងមិនអាចថយក្រោយបានទេ** — record ចងចាំ `seenMax` (ម៉ោងខ្ពស់បំផុត
   ដែលធ្លាប់ឃើញ) ហើយការសម្រេចទាំងអស់ប្រើ `monotonicNow()`។ ការបង្វិល
   នាឡិកាថយក្រោយ **មិនរំកិលអ្វីទាំងអស់** — រួមទាំងក្រោយបិទបើក App ឡើងវិញ។
3. **ការលុប record ត្រូវការសាលក្រម `checkOnline()` ពិត** — លែងលុបដោយផ្អែកលើ
   `serverTimeSynced` ទៀតទេ។ ⛔ ទង់នោះនៅ `true` **បន្តក្រោយចាកចេញពី
   បណ្តាញ** ហើយ offset ក្លាយជាចាស់ ➜ `getServerNow()` រំកិលតាមនាឡិកាឧបករណ៍
   ម្តងទៀត ➜ ការប្តូរថ្ងៃទូរស័ព្ទ **លុប Key របស់អតិថិជន**។ ការមិនផ្តល់សិទ្ធិ
   (`offline-grace-exceeded`) បិទការចូលប្រើរួចហើយ ➜ ការលុបមិនបន្ថែម
   សុវត្ថិភាពទេ។ សាលក្រម server ពិត (`expired-server`) **នៅតែលុបដដែល**។

⛔ **ការការពារអ្នកប្រើស្មោះត្រង់** ៖ ពេលនាឡិកាលោត **ទៅមុខ** (ទូរស័ព្ទអស់ថ្ម
រួច boot) សាលក្រម server **ព្យាបាល** `seenMax` ត្រឡប់ទៅម៉ោងពិតវិញ ➜ គ្មាន
ការចាក់សោសល់ ទោះក្រោយបិទបើក App ឡើងវិញ។

### បន្ថែម — ថ្ងៃផុតកំណត់ជាកម្មសិទ្ធិរបស់ database

`activate()` យកពិដានពី **`expiresAt` លើ server** ជំនួស `exp` ដែល sign រួច។
ដូច្នេះ Key ដែល **«បន្ថែមសុពលភាព» (Extend)** ឥឡូវ **activate លើឧបករណ៍ថ្មីបាន**
ក្រោយថ្ងៃ sign ដើម — កំណត់ត្រាចាស់ក្នុង `CLAUDE.md` ថាវាធ្វើមិនបាន **លែងពិត**។
ហត្ថលេខានៅតែជាការផ្ទៀងផ្ទាត់ភាពពិត (`id` · scope) **មិនប្រែ** ហើយ Key ដែល
Revoke · មិនមានក្នុង DB · ឬហត្ថលេខាខុស **នៅតែត្រូវបដិសេធដដែល**។

### ផ្លាស់ប្តូរ — សារបរាជ័យនិយាយការពិត

`licenseFailureMessage()` បន្ថែមករណី `network` · `not-configured` ·
`clock-unverified` ➜ «ភ្ជាប់ Server មិនបានទេ! សូមបើកអ៊ីនធឺណិត» និង
`verify-unavailable` ➜ «ផ្ទៀងផ្ទាត់ Key មិនបានទេ»។ មុននេះទាំងអស់នេះធ្លាក់ទៅ
សារលំនាំដើម **«Key មិនត្រឹមត្រូវទេ!»** ដែលចោទ Key របស់អតិថិជនដោយខុស។

### ឧបករណ៍ audit

- **`license-clock-rollback-test.js`** (ថ្មី, ៣៣ assertion) — រត់
  `license-verify.js` **ពិតទាំងឯកសារ** ក្នុង `vm` ដោយ `Date` ក្លែង ➜
  នាឡិកាឧបករណ៍ និងម៉ោង server ជាអ័ក្ស **២ ដាច់ដោយឡែក**។ វារួមករណី
  **បិទបើក App ឡើងវិញ** (module ថ្មី ជាមួយ storage ដដែល) ដែលជាការវាស់
  ពិតបំផុត។ **ធ្លាក់ ១៦ លើ `origin/main`**; mutation ៦ ➜ ចាប់បានទាំង ៦។
- **`license-grace-test.js`** និង **`license-clock-trust-test.js`** ៖ ការអះអាង
  ដែលចាក់សោកិច្ចសន្យា **ចាស់** ត្រូវសរសេរឡើងវិញដោយចេតនា (ការ Activate
  ក្រៅបណ្តាញ ➜ បដិសេធ; ការលុបដោយនាឡិកាឧបករណ៍ ➜ លែងកើតឡើង)។ ការអះអាង
  នៅតែ **២ ខាង** ៖ «មិនផ្តល់សិទ្ធិ» **និង** «មិនលុប»។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

**គ្មាន។** Firebase rules **មិនប្រែសោះ** (ទាំង Business និង License) ហើយ
CSP ក៏មិនប្រែដែរ។

---

## [2.20.5] — 2026-08-27 · ការសម្អាតលែងបំផ្លាញដោយនាឡិកាខុស · ប្រតិទិនកម្ពុជា

**ZoeW** (`2.20.4` ➜ `2.20.5`, `zoew-v115` ➜ `zoew-v116`)។
**ZoeKeyGen និង ZoeImport មិនប្រែទេ**។

ជុំនេះមកពីសំណួរ ២ របស់អ្នកប្រើដោយផ្ទាល់៖
*«ប្តូរកាលបរិច្ឆេទហើយចុះ auto cleanup និងធុងសំរាម ខ្លាចបាត់ទិន្នន័យអស់»* និង
*«រាល់ពេលវេលាទាំងអស់ត្រូវ sync តាម server timezone khmer»*។ **ទាំង ២ ត្រូវ។**

⛔ **មិនប៉ះគោលការណ៍ «លុប» ទល់នឹង «ដក» សោះ** — ជួរ ៤ និង ៨ ដែលប៉ះលុយ
មិនប្រែទេ។ **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ** ដែរ។

### កែកំហុស — គ្រោះថ្នាក់បាត់ទិន្នន័យ

- **⛔ ការសម្អាតស្វ័យប្រវត្តិ និងការ purge ធុងសំរាម រត់ដោយនាឡិកាឧបករណ៍ដែល
  មិនដែលត្រូវបានផ្ទៀងផ្ទាត់។** `getServerNow()` គឺ `Date.now() +
  serverTimeOffsetMs` ហើយ offset សរសេរ **តែពី** `.info/serverTimeOffset` ➜
  ក្រៅបណ្តាញវាជា `0` ➜ **នាឡិកាឧបករណ៍ឆៅ**។ ប៉ុន្តែច្រកទ្វារនៃការសម្អាត
  **មិនពិនិត្យការតភ្ជាប់ ឬនាឡិកាសោះ** ហើយវាបាញ់រាល់ ៦០ វិ. · ពេលប្តូរមក
  foreground · និង ១២០ms ក្រោយ snapshot ប្រវត្តិ។ ផលវាស់បានលើកូដមុនកែ
  (ថ្ងៃឧបករណ៍លោត ១ ឆ្នាំ ខណៈក្រៅបណ្តាញ)៖ កញ្ចប់ **មិនទាន់យកទាំងអស់** ចូល
  ធុងសំរាមជា «ផុតកំណត់» ➜ **ដកលុយចេញពីស្ថិតិ**; barcode ដែលបិទ «យក»
  ទាំងអស់ចូលធុងសំរាម; និងធាតុក្នុងធុងសំរាម **ទាំងអស់ត្រូវលុបជាអចិន្ត្រៃយ៍**។
  ⛔ ការក្រៅបណ្តាញធ្វើឲ្យវា **អាក្រក់ជាង** — ការសរសេរចូលជួរ រួចហូរទៅ server
  ពេលភ្ជាប់មកវិញ ហើយការ purge ជា `fb.update()` ធម្មតា **គ្មានការផ្ទៀងផ្ទាត់
  នាឡិកាឡើងវិញសោះ**។ ឥឡូវការសម្អាតទាំង ២ ត្រូវ **ពន្យារ** រហូតដល់នាឡិកា
  មកពី server ពិត — ការពន្យារ **មិនបាត់ការងារទេ** (ពេលភ្ជាប់មកវិញវារត់ដដែល)។

### ផ្លាស់ប្តូរ — ប្រតិទិនអាជីវកម្ម

- **⛔ ថ្ងៃចំណូល · តម្រងថ្ងៃ · ម៉ោងដែលបោះត្រា គណនាតាម `Asia/Phnom_Penh`
  គ្រប់ឧបករណ៍។** Firebase ផ្តល់ **epoch** ត្រឹមត្រូវរួចហើយ (`.info/serverTimeOffset`)
  តែវាជា **លេខមួយប៉ុណ្ណោះ** — វា **មិនផ្ទុកព័ត៌មានតំបន់ម៉ោងទេ**។ ការបម្លែង
  epoch ➜ ប្រតិទិនធ្វើដោយ `getFullYear()`/`getDate()`/`toLocaleTimeString()`
  ដែលអានតំបន់ម៉ោង **ឧបករណ៍** ➜ epoch ត្រូវ តែ **ថ្ងៃខុស**។
  វាស់បាន ៖ 17:00 UTC គឺ 00:00 **ថ្ងៃបន្ទាប់** នៅភ្នំពេញ ➜ ក្នុងបង្អួច
  **៧ ម៉ោងរៀងរាល់យប់** ឧបករណ៍ដែលកំណត់ជា UTC ចុះចំណូលចូល **ថ្ងៃមុន**។
  ⛔ **ឧបករណ៍ដែលកំណត់ជាម៉ោងកម្ពុជារួច មិនឃើញអ្វីប្រែសោះ** ហើយ
  **ទិន្នន័យចាស់មិនត្រូវគណនាឡើងវិញទេ** — ការកែប៉ះតែការសរសេរថ្មី។
- ម៉ោងក្នុងបញ្ជី និង Export ឥឡូវជាទម្រង់ `HH:MM:SS` ដូចគ្នាគ្រប់ឧបករណ៍
  (មុននេះអាស្រ័យលើ locale ឧបករណ៍ ឧ. `02:30:05 PM`)។

### ឧបករណ៍ audit

- **`cleanup-clock-guard-test.js` (ថ្មី — ១២ assertion)។** រត់
  `runAutomaticCleanupRules()` និង `runAutomaticDeletedCleanup()` **ពិត**
  ក្នុង `vm` ដោយ helper ដែលបំផ្លាញជា **អ្នកកត់ត្រា** ➜ វាស់ថា *តើការសម្រេច
  បំផ្លាញត្រូវបានធ្វើឬអត់*។ អះអាង **២ ខាង** ៖ នាឡិកាមិនទុកចិត្ត ➜ គ្មានការ
  បំផ្លាញ **និង** នាឡិកា sync ➜ ការសម្អាតត្រូវរត់ដដែល។ ធ្លាក់ **៥** លើ tree មុនកែ។
- **`khmer-timezone-test.js` (ថ្មី — ២១ assertion)។** **រត់ខ្លួនវាឡើងវិញក្នុង
  child process ក្រោមតំបន់ម៉ោង ៤** (`UTC` · `Asia/Phnom_Penh` ·
  `America/New_York` · `Pacific/Kiritimati`) ➜ ការអះអាង «មិនអាស្រ័យលើឧបករណ៍»
  ត្រូវបាន **វាស់ពិត** មិនមែនសន្មតទេ។ ធ្លាក់ **១៦** លើ tree មុនកែ។
- **sandbox ៣ ត្រូវជួសជុល** (`pickup-reset-test` · `partial-pickup-cleanup-test` ·
  `restore-marker-hygiene-test`) ព្រោះការបន្ថែម function ចូល `app.js` ធ្វើឲ្យ
  ពួកវាធ្លាក់ដោយ `ReferenceError`។ ⛔ **checker មិនត្រូវបានធ្វើឲ្យខ្សោយទេ** —
  ផ្ទៀងផ្ទាត់ដោយ mutation ៤ (ដកច្រកទ្វារនាឡិកា ២ កន្លែង · ធ្វើឲ្យទង់
  មិនដែលបើក · ត្រឡប់ `getFormattedDate()` ទៅតំបន់ម៉ោងឧបករណ៍) ➜ **ចាប់បានទាំង ៤**។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules **មិនប្រែសោះ** ហើយ CSP ក៏មិនប្រែដែរ — គ្រាន់តែ deploy។

## [2.20.4] — 2026-08-27 · ជុំ deep audit ZoeW — នាឡិកា License · ការលេច secret · ការ Reconfig ដែលបាត់

**ZoeW** (`2.20.3` ➜ `2.20.4`, `zoew-v114` ➜ `zoew-v115`)។
**ZoeKeyGen** (`2.19.5` ➜ `2.19.6`, `zoekeygen-v75` ➜ `zoekeygen-v76`) — ឡើង
ព្រោះវាមាន **ស្នាមភ្ជាប់នាឡិកាដដែល** និងព្រោះ `error-reporting.js` ជាឯកសារ
**ចែករំលែក byte-identical** ទាំង ២ App។
**ZoeImport មិនប្រែទេ** (`1.3.2` ដដែល)។

ជុំនេះចាប់ផ្តើមពីសំណើរបស់អ្នកប្រើ៖ *deep audit លើ ZoeW បូកនឹងការស្វែងរក
ឧបករណ៍ audit ដែលបៃតងក្លែងក្លាយ*។ វិធីវាស់គឺ **mutation testing** — ចាក់កំហុស
ពិតចូលកូដ រួចមើលថា checker ណាចាប់បាន។ Mutation **១៦** ត្រូវបានសាក ហើយ
**២ រស់រានលើ checker ទាំង ១០០** — ទាំង ២ ចង្អុលទៅស្នាមភ្ជាប់តែមួយ៖
**`app.js` ↔ `license-verify.js`** ដែលគ្មានឧបករណ៍ណាមើលសោះ។

ជុំនេះ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត ·
ស្ថិតិយក) ហើយ **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ** ដែរ។

### កែកំហុស

- **⛔ ZoeW ៖ License របស់អតិថិជនអាចត្រូវលុបជាអចិន្ត្រៃយ៍ ដោយសារនាឡិកា
  ទូរស័ព្ទខុស។** កំណែ 2.20.1 បានចែងថាការលុប record ត្រូវការនាឡិកាដែល
  ទុកចិត្តបាន (`serverTimeSynced === true`) — ប៉ុន្តែទង់នោះត្រូវបានបើកពី
  **ខាងក្រៅ**។ `attachInfoListeners()` ហៅ `ZoeLicense.setServerTimeOffset()`
  **គ្រប់ពេលដែល `.info/serverTimeOffset` បាញ់ — ទោះតម្លៃមិនមែនជាលេខក៏ដោយ**។
  RTDB បាញ់ node នោះ **ភ្លាមៗពេល attach** ដោយតម្លៃមូលដ្ឋានមុន handshake
  (`null` ឬ `0`) ➜ ម៉ូឌុល License ជឿថា **នាឡិកាឧបករណ៍ឆៅ** ជាម៉ោង server។
  ផលពិត៖ ទូរស័ព្ទដែលអស់ថ្មរួច boot ទៅថ្ងៃខុស (ឬអ្នកប្រើកែថ្ងៃដោយដៃ)
  ខណៈក្រៅបណ្ដាញ ➜ **Key ដែលនៅមានសុពលភាព ត្រូវលុបចោល** ➜ ប្រអប់សុំ
  Activation Key លោតមកកណ្តាលការងារ។ នេះជាថ្នាក់ដដែលដែល 2.20.1 មកបិទ
  ដែលវិលមកតាមទ្វារផ្សេង។ ឥឡូវនាឡិកាត្រូវទុកចិត្តតែតម្លៃដែល **មកពី server ពិត**។
- **⛔ ZoeKeyGen ៖ ការការពារ «មិនអាចផ្ទៀងផ្ទាត់ម៉ោង Server ➜ មិនចេញ Key»
  ជាការការពារដែលងាប់។** ស្នាមភ្ជាប់ដដែលបើក `serverTimeSynced` និងដោះ
  `serverTimeSyncWaiters` **មុន handshake** ➜ `waitForServerTimeSync()`
  ត្រឡប់ `true` ភ្លាមដោយ offset `0` ➜ អ្នកលក់ដែលនាឡិកាកុំព្យូទ័រខុស
  **sign Key ដោយ `iat`/`exp` ខុស** និងសរសេរ `expiresAt` ខុស ខណៈប្រអប់
  រាយការណ៍ជោគជ័យ។ ការការពារនោះដំណើរការវិញហើយ។
- **⛔ ZoeW ៖ ការ Reconfig ដែលធ្វើកណ្តាលការផ្ទុក SDK **បាត់ស្ងាត់ៗ**។**
  `initFirebase()` អាន config **មុន** `await waitForFirebaseSDK()` (ពិដាន
  ១៥ វិនាទី) ហើយច្រានការហៅដដែលៗចេញ។ ដូច្នេះការ Reconfig ក្នុងបង្អួចនោះ៖
  config ថ្មីត្រូវរក្សាទុក ➜ `initFirebase()` ត្រឡប់ភ្លាមដោយមិនធ្វើអ្វី ➜
  ជុំដែលកំពុងដំណើរការបញ្ចប់ដោយ config **ចាស់** ➜ អ្នកប្រើឃើញ
  «✅ ភ្ជាប់ Server រួចរាល់!» ខណៈ App នៅភ្ជាប់ទៅ Project ចាស់ រហូតដល់
  Refresh ដោយដៃ។ ឥឡូវ config ដែលប្រែកណ្តាលផ្លូវត្រូវយកមកប្រើដោយស្វ័យប្រវត្តិ។

### សុវត្ថិភាព

- **⛔ ការលាក់ secret មុនផ្ញើទៅ Sentry ៖ ពិដានចំនួន node ជាទ្វារលេច។**
  កំណែ 2.20.3 បានបិទ **ពិដានជម្រៅ** (`return '[truncated]'` ជំនួស
  `return value`) តែ **រង្វិលជុំខាងក្នុងនៅ `break`** ➜ ពេល
  `REDACT_MAX_NODES` (៥០០០) អស់ កូនសោដែលនៅសល់ **រក្សាតម្លៃឆៅ**។
  វាស់បានលើកូដមុនកែ ៖ `password: "hunter2"` និង `?token=SEKRIT`
  **ហោះទៅ Sentry ដោយមិនត្រូវពិនិត្យសោះ**។ ឥឡូវការឈានដល់ពិដាន **កាត់**
  ដូចអ័ក្សជម្រៅ ហើយ **ការពិនិត្យឈ្មោះកូនសោសម្ងាត់រត់មុនពិដាន** —
  secret ត្រូវលាក់ទោះថវិកាអស់ក៏ដោយ។ ច្បាប់ «keep case» នៅដដែល៖
  `barcode` · `id` · `count` នៅមើលឃើញសម្រាប់ debug។

### ឧបករណ៍ audit

- **`license-clock-trust-test.js` (ថ្មី — ២១ assertion)។** វាស់ស្នាមភ្ជាប់
  **`app.js` ↔ `license-verify.js`** ដែលមុននេះ **គ្មានឧបករណ៍ណាមើលសោះ**៖
  រាល់តេស្ត browser ជំនួស `setServerTimeOffset` ដោយ **stub ទទេ** ចំណែក
  `license-grace-test.js` ចាក់ `serverTimeSynced` **ដោយផ្ទាល់** ចូល sandbox។
  ឯកសារថ្មីរត់ `attachInfoListeners()` **ពិត** បូក `license-verify.js`
  **ទាំងឯកសារ** ក្នុង `vm` (មានតែ primitive របស់ WebCrypto ទេដែលជា stub)
  ហើយអះអាង **២ ខាង**៖ តម្លៃមុន handshake មិនត្រូវទុកចិត្ត **និង** offset
  ពិតត្រូវឆ្លងទៅដល់។ ធ្លាក់ **១០** លើ tree មុនកែ (21 assertion)។
- **`secret-hygiene.js` ៖ +៤ assertion** សម្រាប់ពិដានចំនួន node ។
  ⛔ ពិដាន **អានចេញពីកូដពិត** (`REDACT_MAX_NODES`) មិនមែនសរសេរជាលេខថេរ —
  លេខថេរដែលតូចជាងពិដាន ជាការអះអាងដែលមិនអះអាងអ្វីសោះ (មេរៀន 2.20.3 ចំណុច ៦)។
  ធ្លាក់ **២** លើ tree មុនកែ។
- **`connection-recovery-test.js` ៖ +៣ assertion** — រត់ `initFirebase()`
  **ពិត** ក្នុង `vm` ខណៈ SDK មកយឺត រួចប្តូរ config កណ្តាលផ្លូវ។
  ធ្លាក់ **១** លើ tree មុនកែ។
- Mutation ដែលរស់រានពីមុន (ឥឡូវត្រូវចាប់បាន)៖ ការដកការចិញ្ចឹមនាឡិកា
  License ចេញទាំងស្រុង · `setServerTimeOffset()` ដែលទទួលយកអ្វីក៏បាន ·
  ការបន្ថយ `REDACT_MAX_NODES` · ការបាត់ config កណ្តាល init។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules **មិនប្រែសោះ** ហើយ CSP ក៏មិនប្រែដែរ — គ្រាន់តែ deploy។

## [2.20.3] — 2026-08-27 · ជុំ deep audit — ឧបករណ៍ដែលបៃតងក្លែងក្លាយ · ស្ថានភាពតំណ ZoeImport

**ZoeW** (`2.20.2` ➜ `2.20.3`, `zoew-v113` ➜ `zoew-v114`)។
**ZoeKeyGen** (`2.19.4` ➜ `2.19.5`, `zoekeygen-v74` ➜ `zoekeygen-v75`) — ឡើង
ព្រោះ `error-reporting.js` ជាឯកសារ **ចែករំលែក byte-identical** ទាំង ២ App។
**ZoeImport** (`1.3.1` ➜ `1.3.2`, `zoeimport-v10` ➜ `zoeimport-v11`)។

ជុំនេះចាប់ផ្តើមពីសំណួររបស់អ្នកប្រើ៖ *«ក្រែង audit tool បៃតងក្លែងក្លាយ»*។
ចម្លើយគឺ **បាទ — មាន ១**។ ការវាស់ធ្វើដោយ **mutation testing**៖ ចាក់កំហុស
ពិតចូលកូដ រួចមើលថាតើ checker ណាចាប់បាន។ ជុំនេះ **មិនប៉ះតក្កវិជ្ជា
អាជីវកម្មសោះ** (លុប/ដក · ធុងសំរាម · ការសម្អាត · ស្ថិតិយក) ហើយ
**មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ** ដែរ។

### កែកំហុស

- **⛔ ZoeImport ៖ ស្ថានភាពតំណបង្ហាញខុស ក្រោយត្រឡប់មក App វិញ។**
  សូចនាករ («ក្រៅបណ្ដាញ» / «ភ្ជាប់ Sheet រួចរាល់») គូរឡើងវិញតែពេល
  ព្រឹត្តិការណ៍ `online`/`offline` បាញ់ប៉ុណ្ណោះ។ ប៉ុន្តែលើទូរស័ព្ទ បណ្តាញ
  ដែលត្រឡប់មកវិញ **ជាញឹកញាប់មិនបាញ់ `online`** សោះ ➜ អ្នកប្រើដែលប្តូរ App
  ចេញរួចចូលវិញ ឃើញ «ក្រៅបណ្ដាញ» **ខុស** រហូតដល់ Refresh ដោយដៃ។
  ZoeW និង ZoeKeyGen បិទចន្លោះនេះតាំងពី 2.19.3 — ZoeImport ត្រូវបានទុកចោល។
- **ZoeImport ៖ អ្នកប្រើជាប់នៅកំណែចាស់។** វាចុះឈ្មោះ service worker រួច
  **មិនពិនិត្យបច្ចុប្បន្នភាពសោះ** ➜ PWA ដែលដំឡើងរួច អាចមិនទទួលកំណែថ្មី។
  ឥឡូវវាពិនិត្យពេលត្រឡប់មក foreground · ពេល focus · ពេល `online` និងរាល់
  ៣០ នាទី — ទាំងអស់មានពិដាន ១៥ នាទី ហើយ **មិនបាញ់ខណៈក្រៅបណ្ដាញ**
  (ដូច ZoeW និង ZoeKeyGen បេះបិទ)។
- **⛔ ZoeW ៖ ជួររង់ចាំនៃការសម្គាល់ការខល អាចស្លាប់ស្ងាត់ៗពេញវគ្គ។**
  បើ `patchHistoryItemFields()` បោះកំហុស **ដោយ synchronous** (ឧ. `fb.ref()`
  លើ Firebase app ដែលត្រូវ `deleteApp()` រួច — ផ្លូវស្តារ SDK ធ្វើដូចនោះពិត)
  នោះកំហុសនោះឡើងផុតពី `flushPendingHistoryPatches()` ➜ សោ
  `historyPatchFlushInFlight` ជាប់ `true` **រហូត** ➜ **រាល់ការសម្គាល់ការខល
  ក្រោយៗទៀតលែងសម្កាល់ទៅ server បានទៀត** ហើយធាតុដែលកំពុងរង់ចាំ
  **បាត់ទាំងស្រុង** — ជាកំហុសដដែលដែលកំណែ 2.20.2 សរសេរដើម្បីកែ។
  វាស់បានលើកូដមុនកែ៖ ការ flush លើកក្រោយ **ត្រូវទប់ជារៀងរហូត**។

### សុវត្ថិភាព

- **⛔ Secret អាចលេចទៅ Sentry តាមផ្លូវ ៣ (ទាំង ២ App)។** វាស់បានដោយបញ្ជូន
  payload ពិតឆ្លងកាត់ `redactDeep()` ពិត៖
  - **អ្នកបំបែកក្រៅពី `?&#` និងចន្លោះ។** លំនាំ `name=value` ដែលឈរក្រោយ
    `,` · `;` · `{` · `|` **មិនត្រូវលាក់សោះ** ➜ breadcrumb របស់ console
    (ដែល Sentry ចាប់ **ដោយស្វ័យប្រវត្តិ**) ដូចជា `config loaded,pin=4321`
    ចេញទៅដោយបើកចំហ។
  - **គូដែលមិនសម្ងាត់លេបគូដែលសម្ងាត់។** ក្នុង `a=1;secret=XYZ` តម្លៃរបស់
    `a=` ត្រួតលើ `;` ➜ ការផ្គូផ្គងទាំងមូលមានឈ្មោះ `a` ➜ វាមិនសម្ងាត់ ➜
    **រក្សាទាំងមូល** ➜ `secret=XYZ` **មិនដែលត្រូវពិនិត្យសោះ**។
  - **ការឈានដល់ពិដានជម្រៅ ប្រគល់ subtree ឆៅ។** `REDACT_MAX_DEPTH` ធ្លាប់
    ជា **៦** ហើយពេលដល់ពិដាន វា `return value` — មិនមែនកាត់ចោលទេ ➜ អ្វីៗ
    ខាងក្រោមជាន់ទី ៦ **មិនដែលត្រូវស្កេន**។ event ពិតរបស់ Sentry ជ្រៅជាង
    ៦ ជាធម្មតា (`exception.values[].stacktrace.frames[].vars.…`)។
  ឥឡូវ៖ អ្នកបំបែកបានទូលាយជាង · តម្លៃឈប់ត្រឹមអ្នកបំបែក (គូនីមួយៗត្រូវ
  ពិនិត្យដោយឡែក) · ពិដានជម្រៅ **៦ ➜ ១២** ហើយអ្វីដែលហួសពិដាន **ត្រូវកាត់**
  ជា `[truncated]` មិនមែនប្រគល់ឆៅ។ ⛔ ច្បាប់ «keep case» នៅដដែល —
  `barcode` · `keyId` · `id` · `count` **នៅតែមើលឃើញសម្រាប់ debug**។

### ឧបករណ៍ audit

- **🔴 `network-timeout-test.js` បៃតងក្លែងក្លាយ — កែរួច។** វាមាន
  `process.exit(0)` **ដាក់ថេរ** នៅចុងផ្នែក browser ➜ ការអះអាង **១៣**
  អំពី timeout និងការ abort **មិនអាចធ្លាក់បានទេ**។ បញ្ជាក់ដោយ mutation៖
  ការដក `controller.abort()` ចេញពី `fetchWithTimeout()` ធ្វើឲ្យវាបោះ
  «❌ ធ្លាក់ 2» **តែចេញ exit 0** ➜ `run-all.sh` រាយវាថា **PASS**។
  ក្រោយកែ mutation ដដែលធ្លាក់ត្រឹមត្រូវ។
- **ឧបករណ៍ថ្មី `exit-code-integrity.js`** — បិទថ្នាក់នេះ **តាមរចនាសម្ព័ន្ធ**
  ដើម្បីកុំឲ្យវាវិលមកវិញ។ វាធ្វើ ២ យ៉ាង៖ (១) ស្កេន AST រក
  `process.exit(0)` ដែលឈរ **ក្រោយការអះអាង** ដោយគ្មានច្រកទ្វារ; (២)
  **ពុលការអះអាងទាំងអស់** របស់ checker នីមួយៗ រួចទាមទារ exit != 0 —
  ជាការវាស់ **ឥរិយាបថ** មិនមែន grep។ រកឃើញ checker តាម `run-all.sh`
  ដោយផ្ទាល់ ដូច្នេះវាមិនអាចឃ្លាតបាន។
  ⚠️ **ជុំដំបូងរបស់ឧបករណ៍នេះខ្លួនឯងរាយការណ៍ខុស** ៖ វារាប់ `exit 0` **ខណៈ
  SKIP** ជាបៃតងក្លែងក្លាយ ➜ CI ក្រហម ព្រោះ CI គ្មាន RTDB emulator ➜
  `emu/*` ពីរ SKIP។ checker ដែល SKIP **មិនបានអះអាងអ្វីសោះ** ហើយ
  `run-all.sh` រាយវាជា `SKIPPED`/`PARTIAL` **មិនមែន `PASS`** ទេ។ ច្បាប់
  ត្រឹមត្រូវ៖ **`exit 0` ខណៈ *អះអាងសាលក្រម* ទើបជាបៃតងក្លែងក្លាយ**។
  ការលើកលែងនោះឥឡូវ **រាយឲ្យឃើញ** បូកជាន់អប្បបរមានៃសាលក្រមពិត (>= ២០);
  ហើយការថយក្រោយ **មិនពុល `const`** (`x++` លើ `const` បោះ TypeError ➜
  **ការគាំងមើលទៅដូចការធ្លាក់ត្រឹមត្រូវ**)។
- **បិទចន្លោះ ៣ ដែល mutation បង្ហាញថា checker ទាំង ៩៩ រំលង**៖
  - ការដក `retryFailedDbListenersNow()` ចេញពី `visibilitychange` របស់ ZoeW
    (សញ្ញាស្តារសំខាន់បំផុតលើទូរស័ព្ទ) ➜ **បៃតងទាំងអស់**។
  - ការដក `dbListenerProgressAt = 0` ចេញពី `initDatabaseListeners()`
    (ច្បាប់ដែលចែងក្នុង `CLAUDE.md` រួចហើយ) ➜ **បៃតងទាំងអស់**។
  - ការដកពិដាន `HISTORY_PATCH_QUEUE_MAX` ➜ **បៃតងទាំងអស់** (ថេរនោះត្រូវ
    ស្រង់ចូល sandbox តែគ្មានការអះអាងឥរិយាបថ)។
- ⚠️ **មេរៀនក្នុងជុំនេះខ្លួនឯង**៖ តេស្តពិដានជួរជំនាន់ដំបូងប្រើលេខ **ថេរ**
  ៤០ ខណៈពិដានពិតជា ៥០ ➜ វា **បៃតងលើ tree ដែលដកពិដានចេញ**។ ការអះអាង
  អំពីពិដាន ត្រូវគណនា **ធៀបនឹងពិដានពិត** មិនមែនលេខថេរ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules **មិនប្រែសោះ** ហើយ CSP ក៏មិនប្រែដែរ — គ្រាន់តែ deploy។

## [2.20.2] — 2026-08-27 · ការសម្គាល់ការខលមិនបាត់ · ការស្កេនលឿនវិញក្រោយតារាងធ្លាក់

**ZoeW** (`2.20.1` ➜ `2.20.2`, `zoew-v112` ➜ `zoew-v113`)។
**ZoeKeyGen និង ZoeImport មិនប្រែសោះ** — ជុំនេះប៉ះតែ ZoeW។

ជុំនេះមកពី **របាយការណ៍ Sentry ពិត** របស់អ្នកប្រើ (2026-08-27)។ វា
**មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** — គោលការណ៍ «លុប» ទល់នឹង «ដក», ធុងសំរាម,
ការសម្អាតស្វ័យប្រវត្តិ និងស្ថិតិយក **មិនប្រែសោះ** ហើយវាក៏ **មិនប៉ះ PTR ·
ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ** ដែរ។

### កែកំហុស

- **⛔ ការសម្គាល់ការខលបាត់ ពេលចេញទៅខល។** ប៊ូតុង «📞 ខល» ជាតំណ `tel:`
  **បូក** ការសរសេរទៅ Firebase ក្នុងពេលតែមួយ។ ការចុចវាបើកកម្មវិធីទូរស័ព្ទ
  ➜ iOS ផ្អាក App ➜ ការតភ្ជាប់ដាច់ ➜ ការសរសេរដែលកំពុងផ្ញើ **ត្រូវបោះបង់**
  ➜ ស្លាក «✔️ ខល» លោតត្រឡប់ទៅ «📞 ខល» ហើយអ្នកប្រើត្រូវចុចម្តងទៀត —
  **ដែលខលលេខនោះម្តងទៀត**។ ឥឡូវការសរសេរនោះចូល **ជួររង់ចាំ** ហើយ
  **រត់ឡើងវិញដោយស្វ័យប្រវត្តិ** ពេលការតភ្ជាប់ត្រឡប់មកវិញ។
  គ្របទាំង **ខល អត់លើក · ខល អត់ចូល · ខុសលេខ · សម្អាតសម្គាល់** និងនាឡិកា
  រំលឹក ៤ ម៉ោង។
  ⛔ **កំហុសដែលមិនមែនការដាច់បណ្តាញ (ឧ. `permission_denied`) នៅតែត្រឡប់
  ស្ថានភាពដើមវិញដដែល** — មានតែការដាច់បណ្តាញទេដែលចូលជួរ ហើយជួរនោះមានពិដាន។
  ⛔ ផ្លូវ **កែលេខទូរស័ព្ទ** មិនប៉ះទេ ព្រោះវាមានការទូទាត់ស្ថិតិយក។

### ល្បឿន

- **ការស្កេនលឿនវិញក្នុង ~១ នាទី ជំនួស ១៥ នាទី។** ការទាញ **តារាងអតិថិជន
  ជាមុន** ធ្វើឲ្យការស្កេនបំពេញលេខទូរស័ព្ទ **ភ្លាមៗពីសតិ** ដោយមិនប៉ះបណ្តាញ។
  ពេលការទាញនោះធ្លាក់ (Google Apps Script យឺត) មុននេះ App រង់ចាំដល់ជុំក្រោយ
  — **រហូតដល់ ១៥ នាទី** — ហើយក្នុងចន្លោះនោះ **រាល់ការស្កេនត្រូវឆ្លងបណ្តាញ**។
  វាស់ពី log ពិត៖ **១២ កញ្ចប់ / ៧២ វិនាទី ≈ ៦.៦ វិនាទី/កញ្ចប់** នៃការរង់ចាំ។
  ឥឡូវវាព្យាយាមវិញតាមជណ្តើរ **~៦៥ វិ. ➜ ២ ន. ➜ ៥ ន. ➜ ១៥ ន.**
- **⛔ ការព្យាយាមវិញនោះមិនបាញ់ចំពេលអ្នកប្រើកំពុងស្កេន។** ការទាញតារាង
  និងការស្វែងរកតាម barcode ទៅ **deployment Apps Script ដដែល** ➜ បើវាជាន់គ្នា
  នោះការស្កេន **យឺតជាងមុន**។ ច្រកទ្វារថ្មីទប់វាពេលប្រអប់លេខទូរស័ព្ទបើក
  ឬពេលមានការស្វែងរកកំពុងដំណើរការ។ ច្រកទ្វារចាស់ (ក្រៅបណ្តាញ · Data Saver ·
  2G · មិនទាន់ចូលប្រព័ន្ធ) **នៅដដែល**។
- **ទិន្នន័យស្រស់ជាងមុន ១ ដង។** cache តារាងអតិថិជនក្នុងសតិបន្ថយពី **១៥ នាទី
  ➜ ៥ នាទី** ឲ្យស៊ីនឹង cache ៥ នាទីរបស់ Apps Script ➜ ការកែតម្លៃ COD/DOD
  ក្នុង Sheet មកដល់លឿនជាងមុន។ ការធ្វើឲ្យស្រស់នោះ **ថោកខាង server** ព្រោះ
  cache របស់ Apps Script ស្រូបវា។ (កញ្ចប់ថ្មីមិនរងផលពីមុនដែរ — barcode
  ដែលមិនមានក្នុងតារាង ធ្លាក់ទៅការស្វែងរកតាមបណ្តាញស្រាប់។)
- **ប្រអប់វាយលេខទូរស័ព្ទបើកក្នុង ០.៦ វិនាទី ជំនួស ៣១.៥ វិនាទី។** សម្រាប់
  barcode ដែល **មិនមានក្នុងតារាង** មុននេះ keyboard លេចតែក្រោយការស្វែងរក
  ចប់ — ដែលពេល timeout មានន័យថា **៣១.៥ វិនាទី**។ ឥឡូវបើការស្វែងរកមិនចប់
  ក្នុង ០.៦ វិនាទី ប្រអប់បើកឲ្យវាយដោយដៃភ្លាម។
  ⛔ ការបំពេញស្វ័យប្រវត្តិ និងការរក្សាទុកស្វ័យប្រវត្តិ **នៅដំណើរការដដែល** —
  ហើយអ្វីដែលអ្នកប្រើវាយរួច **មិនត្រូវសរសេរជាន់ឡើយ**។

### ឧបករណ៍ audit

- **`history-patch-retry-test.js`** (៥០ assertion; ធ្លាក់ **២២** លើ tree
  មុនកែ) — ចាក់សោការសម្គាល់ការខលទាំង ៣ ប្រភេទ, ការសម្អាតសម្គាល់, នាឡិកា
  ៤ ម៉ោង, ការចូលជួរពេលដាច់បណ្តាញ, ការទៅដល់ server ពេលភ្ជាប់មកវិញ **និង
  ទិសផ្ទុយ** (`permission_denied` ត្រូវ revert; ផ្លូវកែលេខមិនប្រែ)។
- **`lookup-prefetch-test.js`** (៤៨ assertion; ធ្លាក់ **២៤** លើ tree មុនកែ)
  — ចាក់សោច្រកទ្វារ **២ ខាង** (ទប់ពេលរវល់ · អនុញ្ញាតពេលទំនេរ), ជណ្តើរ
  ព្យាយាមវិញ, TTL cache និងឥរិយាបថ focus ទាំង ៤ ករណី។
- `network-pressure-test.js` ៖ ការអះអាង «ការទាញជាមុនរំលងពេលក្រៅបណ្តាញ»
  ដើរតាមការបញ្ជូនបន្តទៅ helper រួចហើយ — ថ្នាក់ «checker ស្កេនអ្វី» ដដែល
  នឹង 2.19.3។ ការអះអាង **ឥរិយាបថ** ពិតនៅក្នុង `lookup-prefetch-test.js`។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules **មិនប្រែសោះ** ហើយ CSP ក៏មិនប្រែដែរ — គ្រាន់តែ deploy។

---

## [2.20.1] — 2026-08-27 · ជុំ deep audit ៖ ការស្តារបណ្តាញ · License · ការការពារដែលងាប់

**ZoeW** (`2.20.0` ➜ `2.20.1`, `zoew-v111` ➜ `zoew-v112`) ·
**ZoeKeyGen** (`2.19.3` ➜ `2.19.4`, `zoekeygen-v73` ➜ `zoekeygen-v74`) ·
**ZoeImport** (`1.3.0` ➜ `1.3.1`, `zoeimport-v9` ➜ `zoeimport-v10`)។

ជុំនេះ **មិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** — គោលការណ៍ «លុប» ទល់នឹង «ដក»,
ធុងសំរាម, ការសម្អាតស្វ័យប្រវត្តិ និងស្ថិតិយក **មិនប្រែសោះ**។ វាក៏
**មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ · ទម្រង់បង្ហាញ** ដែរ។

### កែកំហុស — កំហុសពិត ៣ ដែលរកឃើញក្នុងជុំនេះ

- **⛔ តារាងកកជារៀងរហូតពេលដោះសោទូរស័ព្ទ។** ពេលទិន្នន័យដាច់ ហើយ App
  កំពុងទាញវាមកវិញ (ដំណើរការយឺតលើ 2G ឬប្រវត្តិធំ) — ការ **ដោះសោទូរស័ព្ទ
  ខណៈ WiFi ទើបត្រឡប់មកវិញ** បាញ់ព្រឹត្តិការណ៍ `online` និង
  `visibilitychange` **ក្នុងវិនាទីតែមួយ**។ អ្នកតាមដានវឌ្ឍនភាពសរសេរជាន់
  ភស្តុតាងរបស់ខ្លួន ➜ ការសួរលើកទី ២ ឃើញ «គ្មានវឌ្ឍនភាព» ➜ វា
  **ចាប់ផ្តើមទាញសាជាថ្មី** ➜ បោះបង់អ្វីដែលទាញបានហើយ។ **វាស់បាន៖ ៣ path
  ក្នុងចំណោម ៦ ជាប់រហូត ហើយស្លាកសរសេរ «កំពុងភ្ជាប់ឡើងវិញ...» មិនចេះឈប់។**
  ឥឡូវវឌ្ឍនភាពត្រូវកត់ត្រាជា **ត្រាពេលវេលា នៅកន្លែងដែលវាកើតឡើងពិត** ➜
  ការសួរប៉ុន្មានដងក៏ដោយ លទ្ធផលដដែល ➜ តារាងទាន់សម័យវិញបាន។
- **⛔ License ត្រូវលុបចោលដោយសារនាឡិកាទូរស័ព្ទខុស។** ទូរស័ព្ទដែលអស់ថ្ម
  រួច boot ឡើងវិញ (ឬអ្នកប្រើប្តូរកាលបរិច្ឆេទដោយដៃ) ជាញឹកញាប់ក្រឡុកទៅ
  ថ្ងៃខុសទាំងស្រុង។ ខណៈក្រៅបណ្តាញ App **មិនអាចផ្ទៀងផ្ទាត់ម៉ោង server បាន**
  តែវានៅតែយកនាឡិកាឧបករណ៍មកសម្រេច ➜ **លុប Activation Key របស់អតិថិជនចោល
  ជាអចិន្ត្រៃយ៍** ➜ ប្រអប់សុំ Key លោតមកកណ្តាលការងារ (ការត្រួតពិនិត្យ
  រៀងរាល់ ១៥ នាទី)។ ឥឡូវការលុបទាមទារនាឡិកា **ដែលទុកចិត្តបាន** ឬសាលក្រម
  របស់ server; បើផ្ទៀងផ្ទាត់មិនបាន ➜ **រក្សា Key ទុក** ហើយសុំឲ្យភ្ជាប់
  អ៊ីនធឺណិតជំនួសវិញ។ ការ Activate ក៏ **sync ម៉ោង server ជាមុន** ដែរ ➜
  Key ត្រឹមត្រូវលែងត្រូវបដិសេធថា «ផុតកំណត់» ដោយសារនាឡិកាទូរស័ព្ទ។
- **⛔ ការស្តារពីធុងសំរាមឆ្លងឧបករណ៍អាចខូច។** ការការពារមួយដែលគួររង់ចាំ
  ទិន្នន័យធុងសំរាមមកដល់សិន ត្រូវបានសរសេរដោយ **កូនសោខុស** ➜ វា
  **មិនដែលការពារអ្វីសោះ**។ ផល៖ ក្នុងវិនាទីដំបូងៗក្រោយបើក App (មុនធុងសំរាម
  មកដល់) App អាចលុបសញ្ញាសម្គាល់នៃការស្តារដែល **ឧបករណ៍ផ្សេងកំពុងធ្វើ** ➜
  ធាតុស្ទួននៅទាំង ២ កន្លែង ហើយ «ដក»/«លុប» លើវា **ស្លាប់ជារៀងរហូត**
  (ថ្នាក់កំហុសដដែលនឹងកំណែ 2.17.3)។

### ល្បឿន និងស្ថេរភាព

- **Service worker ៖ ការធ្វើឲ្យសំបកស្រស់លែងស្លាប់ស្ងាត់ៗ។** ពេលសំណើ
  ផ្ទៃខាងក្រោយមួយមិនចេះបញ្ចប់ កន្លែងរបស់វាមិនត្រូវបានដោះ ➜ ក្រោយ ៤ ដង
  ការធ្វើឲ្យសំបកស្រស់ **ឈប់ទាំងស្រុង** ➜ អ្នកប្រើជាប់នឹងកំណែចាស់ដោយ
  គ្មានសញ្ញា។ ឥឡូវកន្លែងត្រូវដោះតាម **ផ្លូវ ២** (សំណើចប់ ឬពេលកំណត់)។
  កែទាំង **៣ App**។

### សុវត្ថិភាព

- **ការលាក់ secret មុនផ្ញើទៅ Sentry ៖ បិទចន្លោះតម្លៃមិនមែនអក្សរ។**
  មុននេះការលាក់ធ្វើតែពេលតម្លៃជា **ខ្សែអក្សរ** ➜ `{ pin: 1234 }` (PIN ជា
  **លេខ** — ទម្រង់ធម្មជាតិបំផុត), `{ apiKey: [...] }` និង
  `{ credential: {...} }` **រអិលកាត់ទាំងស្រុង**។ ឥឡូវតម្លៃណាក៏ដោយក្រោម
  ឈ្មោះកូនសោសម្ងាត់ត្រូវលាក់។ ⛔ `keyId` · `barcode` · លេខសម្គាល់ធាតុ
  **នៅតែរក្សាទុក** សម្រាប់ការ debug ដដែល។

### ផ្លាស់ប្តូរ (អ្នកប្រើមើលឃើញ)

- **សារស្ថានភាពលែងបាត់ពេលស្កេនច្រើន។** ប្រអប់ toast កាន់បានត្រឹម ៤ សារ;
  មុននេះវាច្រានសារចាស់ជាងគេចេញ — ហើយសារ **ស្ថានភាពការតភ្ជាប់** ជាសារ
  ចាស់ជាងគេជានិច្ច ➜ ការស្កេនត្រឹម ៤ ដងលុបវាចោល ➜ អ្នកប្រើលែងឃើញការ
  ប្តូរទៅ «✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ» ឬ «⚠️ ការទាញទិន្នន័យ
  ដាច់» ទៀត។ ឥឡូវសារធម្មតាត្រូវច្រានចេញមុន ហើយសារស្ថានភាព **រស់រានរហូត
  ដល់វាមានចម្លើយពិត**។

### ឧបករណ៍ audit

- **ថ្មី ៖ `listener-pending-key-test.js`** — ថ្នាក់ «**កូនសោដែលសួរ មិនដែល
  ត្រូវបានដាក់ចូល**» ៖ ការការពារដែលមើលទៅដូចមាន តែជា `false` ជានិច្ច។
  វាពិនិត្យ ២ ទិស (ស្តាទិចលើ App ទាំង ៣ បូកឥរិយាបថពិតក្នុង `vm`)។
  **ធ្លាក់ ៤ លើ tree មុនកែ។**
- **`connection-recovery-test.js`** — បន្ថែម ៥ ការអះអាងអំពី **ការសួរច្រើន
  ដងក្នុង tick ដដែល** (ការដោះសោទូរស័ព្ទ)។ **ធ្លាក់ ៣ លើ tree មុនកែ។**
- **`license-grace-test.js`** — បន្ថែមអ័ក្ស **នាឡិកា** ៖ «ផ្ទៀងផ្ទាត់មិនបាន»
  ≠ «ផុតកំណត់»។ អះអាង ២ ខាង។ **ធ្លាក់ ១ លើ tree មុនកែ។**
- **`sw-revalidate-pressure-test.js`** — ការដោះកន្លែងត្រូវធានាដោយ **ផ្លូវ ២**
  និងត្រូវ idempotent។ **ធ្លាក់ ៦ លើ tree មុនកែ (៣ App × ២)។**
- **`secret-hygiene.js`** — secret ដែលមិនមែនជាខ្សែអក្សរ។ **ធ្លាក់ ៤ លើ tree មុនកែ។**
- **`toast-truth-test.js`** — សារស្ថានភាពត្រូវរស់រានពីសារធម្មតា។
  **ធ្លាក់ ៤ លើ tree មុនកែ។**
- **`version-bump-scope.js`** — បិទចន្លោះក្នុងឧបករណ៍ខ្លួនវា ៖ ការកែ
  **តក្កវិជ្ជា** ក្នុង `sw.js` ធ្លាប់ត្រូវអានថា «គ្មានការកែពិត» ➜ វា
  **ហាមឡើង `CACHE_VERSION`** ➜ អ្នកប្រើនឹងជាប់នឹង service worker ចាស់
  ជារៀងរហូត។ ឥឡូវ `sw.js` ត្រូវរាប់ លុះត្រាតែការប្រែលើសពីបន្ទាត់
  `CACHE_VERSION` (ដំណោះស្រាយដដែលនឹង `app.js`/`APP_VERSION`)។
- **`clock-hygiene.js`** — បន្ថែម ២ ឈ្មោះក្នុងបញ្ជីអនុញ្ញាត **ជាមួយហេតុផល**។
- **⛔ `checker-coverage.js` ផ្នែក ២ខ ថ្មី ៖ CI មិនត្រូវរត់ checker ដែល
  `run-all.sh` មិនរត់។** ចន្លោះនេះលេចឡើងក្នុងជុំនេះដោយផ្ទាល់៖
  `emu/crud-rules-flow.js` រត់តែក្នុង CI ➜ ការបន្ថែមថេរថ្មីក្នុង `app.js`
  ធ្វើឲ្យ sandbox របស់វាបោះ `ReferenceError` ➜ **`run-all.sh` បៃតងទាំង ៩៥
  នៅមូលដ្ឋាន រួច CI ក្រហមក្រោយ push**។ ឥឡូវ `run-all.sh` រត់ emu tests
  ដែរ (គ្មាន emulator ➜ SKIP ស្អាត; CI ដាក់ `CRUD_FLOW_STRICT=1` ដែល
  ធ្វើឲ្យ SKIP នោះក្លាយជាការធ្លាក់)។ សរុប **៩៧ checker**។
- **⛔ SKIP មិនត្រូវរំលងអ្វីៗទាំងអស់ ៖ ការសាង sandbox ជាការងារ *local*។**
  ការបន្ថែម emu tests ចូល `run-all.sh` **មិនគ្រប់គ្រាន់ទេ** — គ្មាន
  emulator ➜ ពួកវា SKIP **ទាំងស្រុង** ➜ ការខូចនៃ sandbox នៅតែមើលមិនឃើញ
  នៅមូលដ្ឋាន។ តែ `ReferenceError` នោះកើតឡើងពេល **រត់កូដក្នុង `vm`** ដែល
  **មិនត្រូវការ emulator សោះ**; emulator ត្រូវការតែសម្រាប់ **rules**។
  ឥឡូវ `crud-rules-flow.js` សាង sandbox ហើយហៅ function ពិត ៥
  («smoke check») **មុន** ច្រកទ្វារ emulator ➜ ការខូចជា **ការធ្លាក់ ទោះ
  គ្មាន emulator**។ វាស់បាន ២ ខាង៖ sandbox ល្អ ➜ `ok` រួច SKIP (exit 0);
  sandbox ខូច ➜ `FAIL` (exit 1)។ *(`restore-deadlock-test.js` មិនប្រើ `vm`
  សោះ ➜ SKIP របស់វាត្រឹមត្រូវ។)*
- **⛔ `version-bump-scope.js` **មិនដែលរត់ក្នុង CI សោះ** តាំងពីវាត្រូវបាន
  សរសេរ។** `actions/checkout@v4` ទាញតែ **១ commit** ដោយលំនាំដើម ➜ គ្មាន
  `origin/main` ➜ SKIP រាល់ការរត់ ➜ ការការពារ «កូដ ship ប្រែ ➜ ត្រូវឡើង
  កំណែ» និង «ការឡើងកំណែទទេ» **មិនដែលអនុវត្តលើ PR ណាមួយ**។ ការកែ ២ ជាន់៖
  `fetch-depth: 0` បូក `git fetch origin main` ក្នុង `audit.yml` ហើយ
  `VERSIONSCOPE_STRICT=1` ធ្វើឲ្យការបាត់ base ក្លាយជា **ការធ្លាក់**
  មិនមែនការស្ងាត់ (ថ្នាក់ដដែលនឹង `CRUD_FLOW_STRICT`)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** **Firebase rules មិនប្រែសោះ** (ទាំង Business និង License) ហើយ
  **CSP ក៏មិនប្រែដែរ** — គ្រាន់តែ deploy។

---

## [2.20.0] — 2026-08-27 · ប៊ូតុង Reset ចំនួន «យករួច» តាមតម្រងថ្ងៃ

**ZoeW តែមួយ** (`2.19.5` ➜ `2.20.0`, `zoew-v110` ➜ `zoew-v111`)។
**ZoeKeyGen និង ZoeImport មិនប្រែសោះ** — អ្នកប្រើរបស់ App ទាំងនោះមិនត្រូវ
ទាញសំបកឡើងវិញទេ។

### បន្ថែម

- **ប៊ូតុងថ្មីក្នុងម៉ឺនុយ (...) ៖ «♻️ Reset ចំនួនយករួច (<តម្រង>)»** នៅ
  **ខាងលើ** ប៊ូតុង «❌ លុបទាំងអស់»។ វា **ការពារដោយ PIN** ដូចប៊ូតុងលុប
  ទាំងអស់ដែរ ហើយប្រអប់ PIN បង្ហាញសាររបស់វាផ្ទាល់
  («សូមវាយលេខកូដសុវត្ថិភាពដើម្បី Reset ចំនួនអតិថិជន និងកញ្ចប់យករួច»)។
- **វាធ្វើការតាមតម្រងថ្ងៃដែលអ្នកកំពុងឈរលើ។** ឈរលើ «ម្សិលមិញ» ➜ ចុច ➜
  លេខ **អតិថិជនយក** និង **កញ្ចប់យក** របស់ **ម្សិលមិញតែប៉ុណ្ណោះ** ត្រឡប់ជា
  0; ថ្ងៃនេះ និងម្សិលម្ងៃ **មិនប៉ះពាល់ទេ**។ ស្លាកលើប៊ូតុងសរសេរឈ្មោះតម្រង
  ដែលឈរលើជាប់ជានិច្ច ➜ អ្នកប្រើដឹងមុនចុចថាវានឹង Reset អ្វី។
  «ថ្ងៃផ្សេង» ➜ តែថ្ងៃដែលជ្រើស។ «ទាំងអស់» ➜ គ្រប់ថ្ងៃ (ប្រអប់បញ្ជាក់
  ប្រាប់ចំនួនថ្ងៃ)។
- **ប្រអប់បញ្ជាក់មុនធ្វើ** បង្ហាញលេខបច្ចុប្បន្នទាំង ២ និងរឿងដែល
  **មិន** ប្តូរ។ បើលេខជា 0 រួចហើយ វាប្រាប់ត្រង់ៗ ដោយមិនសរសេរអ្វីទៅ Firebase។

### ⛔ អ្វីដែល Reset នេះ **មិន** ប៉ះ

- **ទឹកប្រាក់ COD/DOD និងស្ថិតិចំណូល មិនប្តូរសោះ។** `isDeducted` នៅតែជាវាល
  *តែមួយគត់* ដែលកំណត់លុយ ហើយផ្លូវ Reset នេះមិនប៉ះវាទេ។ វាកែតែ **ledger
  ស្ថិតិយក** (`zoew_daily_pickup_cod_dod`) ប៉ុណ្ណោះ។
- **បញ្ជីកញ្ចប់ ប្រវត្តិ និងធុងសំរាម មិនប្តូរសោះ។** barcode ដែលបិទ «យក»
  នៅតែបិទដដែល — ការ Reset គ្រាន់តែធ្វើឲ្យ **ការរាប់ចាប់ផ្តើមឡើងវិញពី 0**
  សម្រាប់ថ្ងៃនោះ។ ការបិទ/បើក barcode បន្ទាប់ពីនោះ បូក/ដកពី 0 ធម្មតា។

### ផ្លាស់ប្តូរ (ខាងក្នុង)

- **`getFilterTargetDateKey()` ថ្មី ជាមូលដ្ឋានថ្ងៃ *តែមួយ*។** មុននេះ
  `updateDailyScheduleStats()` គណនាថ្ងៃរបស់តម្រងដោយខ្លួនឯង។ ឥឡូវទាំង
  **ការបង្ហាញ** និង **ការ Reset** អានពី helper ដដែល ➜ លេខដែលអ្នកឃើញ និង
  ថ្ងៃដែលត្រូវ Reset **មិនអាចឃ្លាតគ្នាបានតាមរចនាសម្ព័ន្ធ** (មេរៀនដដែល
  នឹង 2.19.4)។
- **ការ Reset សរសេរ `{ packagesPickedUp: 0 }` — មិនមែនលុប node ចោលទេ។**
  `updateDailyScheduleStats()` ធ្លាក់ទៅ **រាប់ពីប្រវត្តិវិញ** ពេល node នោះ
  អវត្តមាន ➜ ការលុប node នឹងធ្វើឲ្យលេខ **លោតត្រឡប់មកវិញភ្លាមៗ** ព្រោះ
  barcode នៅតែបិទ។ `pickup-reset-test.js` ចាក់សោចំណុចនេះ។
- `pickupResetInFlight` ត្រូវដោះក្នុង `resetClearHistoryOperationState()`
  ➜ ការចាកចេញកណ្តាលការ Reset មិនបន្សល់សោជាប់។

### ឧបករណ៍ audit

- **`pickup-reset-test.js` ថ្មី (49 assertion)** — រត់ `resetPickupStats()`
  **ពិត** ក្នុង `vm`។ លើ tree មុនកែ ធ្លាក់ **២៨**។ Mutation ដែលវាស់បាន៖
  សរសេរ `null` ជំនួស `{ packagesPickedUp: 0 }` ➜ ធ្លាក់ ៤; មិនគោរពតម្រង
  (reset គ្រប់ថ្ងៃ) ➜ ធ្លាក់ ៥; toast កុហកថាជោគជ័យពេលបរាជ័យ ➜ ធ្លាក់ ៣។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** `firebase-database.rules.json` **មិនប្រែសោះ** — ការសរសេរ
  `packagesPickedUp: 0` ស្ថិតក្នុង schema ដែលមានស្រាប់
  (`newData.isNumber() && newData.val() >= 0`)។ គ្រាន់តែ deploy។

---

## [ឧបករណ៍] — 2026-08-27 · checker ដែលព្យួរ ➜ CI ដួលទាំងមូល

**មិនប្តូរកូដ App ទេ** — `APP_VERSION` និង `CACHE_VERSION` នៅដដែលទាំង ៣ App។
អ្នកប្រើមិនឃើញអ្វីខុសពីមុនទេ; អ្វីដែលប្រែគឺ **CI ឈប់ដួលដោយស្ងាត់**។

> 🔴 **កំហុសពិត វាស់បាន ២ ដងលើ GitHub Actions។**
>
> | run | បន្ទាត់ចុងក្រោយក្នុង log | បន្ទាប់ |
> |---|---|---|
> | `main` `a465af9` (2026-08-26) | `offline-shell … PASS (19)` @ `13:53:14` | cancel @ `14:18:04` |
> | PR #96 (2026-08-27) | `offline-shell … PASS (19)` @ `01:56:07` | cancel @ `02:19:24` |
>
> **ទាំង ២ ដងឈប់ត្រង់កន្លែងតែមួយ** — `sw-install-integrity-test.js` ដែលជាធម្មតា
> ចំណាយ **១.៥ វិនាទី** តែជុំនោះព្យួរ **២៣–២៤ នាទី** រហូតដល់ `timeout-minutes: 30`
> សម្លាប់ job។ អ្នកអានឃើញត្រឹម «The operation was canceled» — **គ្មានឈ្មោះ
> checker ដែលខូចសោះ**។

### កែកំហុស

- **មូលហេតុឫសគល់ (បង្កើតឡើងវិញបានសម្រេច)។** ជុំទី ១ របស់តេស្តនោះមានសំណាញ់
  `setTimeout(res, 8000)` ➜ វាចាកចេញខណៈ SW នៅ `'installing'` (មិនទាន់
  `activated` ក៏មិនទាន់ `redundant`) ➜ ជុំទី ២ ហៅ
  `await navigator.serviceWorker.ready` ដែល **គ្មានពិដាន**។ `page.evaluate()`
  របស់ Playwright ក៏ **គ្មាន timeout** ដែរ ➜ ការរង់ចាំមិនចេះចប់។ លើ runner
  ដែលរវល់ `cache.addAll(CORE_SHELL)` ចំណាយលើស ៨ វិនាទី ➜ លក្ខខណ្ឌនោះកើត។
  វាបៃតង **~៩១%** នៃពេល ➜ ជា **ការប្រណាំង** ដែលបរិស្ថានលឿនមិនដែលបង្ហាញ។
- **ពិដានលើ `serviceWorker.ready` — ៥ ឯកសារ** ៖ `offline-shell-test.js` ·
  `sw-cache-key-test.js` · `sw-install-integrity-test.js` ·
  `sw-shell-latency-test.js` · `sw-revalidate-pressure-test.js`។ រង្វិលជុំ
  ខាងក្រោមមានពិដានស្រាប់ ➜ ការផុតកំណត់ក្លាយជា **ការធ្លាក់ដែលអានបាន**។
- **ពិដានលើ `server.close(cb)` — ៤ ឯកសារ** ៖ Node ហៅ callback តែពេល
  **គ្រប់ការតភ្ជាប់បិទអស់** ហើយ Chromium រក្សា socket keep-alive ➜ ការរង់ចាំ
  នោះអាចមិនចេះចប់ដែរ។ បន្ថែម `closeAllConnections()` ក្នុង
  `inline-handler-xss-test.js` · `offline-shell-test.js` ·
  `sw-cache-key-test.js` · `sw-install-integrity-test.js`។

### ផ្លាស់ប្តូរ

- **`run-all.sh` រុំរាល់ checker ក្នុង `timeout`** (`CHECKER_TIMEOUT`, លំនាំដើម
  ៣០០ វិនាទី) ហើយរាយការណ៍ការផុតកំណត់ជា
  «`*** FAIL *** (ព្យួរ — លើសពិដាន Ns)`» **ដែលមានឈ្មោះ checker**។
  ⛔ នេះជាការកែសំខាន់បំផុត៖ ការស្តារកម្រិតឯកសារនីមួយៗមិនគ្រប់គ្រាន់ទេ —
  checker **៣១** បើក browser ហើយរាល់ `await` គ្មានពិដានជាកន្លែងដែលថ្នាក់នេះ
  នឹងវិលមកវិញ។ ឥឡូវការព្យួរថ្មីណាមួយចំណាយត្រឹម ៥ នាទី រួចប្រាប់ឈ្មោះ។

### ឧបករណ៍ audit

- **`hang-guard.js` (ថ្មី, 7 assertion)** — ចាក់សោថ្នាក់នេះ។ វាអះអាង៖ ជាន់
  អប្បបរមា (checker browser >= ២៥) · `run-all.sh` រុំរាល់ checker ក្នុង
  `timeout` · ការផុតកំណត់បែកចេញពី FAIL ធម្មតា · គ្មាន `serviceWorker.ready`
  ឥតពិដាន · រាល់ `await server.close()` មាន `closeAllConnections()`។
  ការអះអាងទី ៥ និង ៦ ជា **ការវាស់ឥរិយាបថ** មិនមែន grep៖ វាស្រង់ `run()` ចេញពី
  `run-all.sh` **ពិត** រួចរត់វាលើ script ដែលព្យួរដោយចេតនា ហើយអះអាងថាលទ្ធផល
  ជា FAIL ក្នុងពិដាន ➜ **បញ្ឆោតដោយ comment ឬឈ្មោះមិនបានទេ**។
  លើ tree មុនកែ ធ្លាក់ **៦ ក្នុងចំណោម ៧** ដោយរាយឈ្មោះឯកសារខូចទាំង ៩។
  លើថតទទេក៏ធ្លាក់ដែរ (ច្បាប់ `checker-coverage.js`)។
- ឧបករណ៍ថ្មីនេះ **ចាប់បានកន្លែងទី ៥ ដែលការកែដោយដៃខកខាន**
  (`sw-revalidate-pressure-test.js`) ក្នុងការរត់លើកដំបូងរបស់វា។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules មិនប្រែទេ ហើយ CSP ក៏មិនប្រែដែរ។
## [2.19.5] — 2026-08-27 · ជួសជុលលេខថ្ងៃចាស់ដោយសុវត្ថិភាព

> ℹ️ **ជុំនេះប៉ះតែ ZoeW** — ZoeKeyGen នៅ `2.19.3` · ZoeImport នៅ `1.3.0`។

កំណែ 2.19.4 ប្តូរមូលដ្ឋានរាប់ «អតិថិជនយក» ➜ លេខ **ថ្ងៃថ្មី** ត្រឹមត្រូវ
តែលេខ **ថ្ងៃចាស់** ដែលសរសេររួច នៅមានអតិថិជនខ្មោច។ អ្នកប្រើសុំឲ្យកែ។

### បន្ថែម

- **`planPickupLedgerRepair()` និង `repairPickupLedgerOnce()`** — គណនា
  បញ្ជីអតិថិជនប្រចាំថ្ងៃឡើងវិញពី **ប្រវត្តិ + ធុងសំរាម**។

⛔ **ហានិភ័យធំបំផុតដែលការរចនានេះការពារ៖ ការលុបលេខថ្ងៃចាស់។**
`zoew_daily_pickup_cod_dod` **មិនដែលកាត់បន្ថយទេ** — វាកាន់ថ្ងៃពីដើមរហូត —
ខណៈទិន្នន័យប្រភពរស់តែ ≤ ៨ ថ្ងៃ (ប្រវត្តិ) បូក ≤ ៣០ ថ្ងៃ (ធុងសំរាម)។
ការគណនាឡើងវិញឆៅនឹងផ្តល់ **0** សម្រាប់ថ្ងៃចាស់ ➜ **បាត់ទិន្នន័យអាជីវកម្មពិត**។

**ច្រកសុវត្ថិភាព** ៖ `packagesPickedUp` ត្រូវបានរាប់តាម **barcode** ជានិច្ច
(សូម្បីមុន 2.19.4) ➜ វា **មិនដែលខូច** ➜ ប្រើវាជាការពិតដើម្បីផ្ទៀងផ្ទាត់៖

| លក្ខខណ្ឌ | សកម្មភាព |
|---|---|
| barcode បិទដែលរាប់ឡើងវិញ **ត្រូវនឹង** `packagesPickedUp` | ទិន្នន័យគ្រប់ ➜ ជួសជុល |
| មិនត្រូវ (purge ខ្លះ ឬអស់) | ⛔ **រំលង — មិនប៉ះ មិនសូន្យ** |

- ⛔ វា **សរសេរតែ `pickedUpPhones`** ក្នុង `zoew_daily_pickup_cod_dod`។
  វាស់បាន៖ ការហៅទាក់ទងលុយ **០** · `packagesPickedUp` **អានតែប៉ុណ្ណោះ** ·
  មិនប៉ះ `daily_revenue` · `monthly_revenue` · ប្រវត្តិ · ធុងសំរាម។
- Idempotent ៖ រត់ម្តងទៀត ➜ គ្មានការសរសេរ។ ប្រើ `runTransaction` ក្នុងមួយថ្ងៃ
  ដើម្បីសុវត្ថិភាពពេលឧបករណ៍ច្រើនដំណើរការស្របគ្នា។

### ឧបករណ៍ audit

- **`pickup-repair-test.js` ថ្មី** (14 assertion) — ការអះអាងសំខាន់បំផុតគឺ
  **«ថ្ងៃចាស់ (ទិន្នន័យ purge រួច) ➜ រំលង មិនលុប»**។ បូកនឹង៖ ថ្ងៃ purge ខ្លះ
  ➜ រំលង · ធុងសំរាមរាប់ចូល · `packagesPickedUp` មិនត្រូវប៉ះ · idempotent ·
  អថេរ `sum(ref) === packagesPickedUp` · អតិថិជនរាប់តាមលេខទូរស័ព្ទ។

### ការផ្ទៀងផ្ទាត់ច្បាប់សម្អាត (សំណើអ្នកប្រើ)

រត់ **ពេលវេលាបន្តគ្នាតែមួយ** លើកូដពិត (មុននេះគ្មានតេស្តណារត់ច្បាប់ទាំង ៣
លើ timeline តែមួយទេ)៖ `+1h59m` មិនទុំ · `+2h01m` A(បិទ) ទុំ · B(បើក)
**មិនដែលទុំតាមច្បាប់ ២ ម៉ោង** · `+8d01h` ច្បាប់ ៨ ថ្ងៃបាញ់ · ត្រាចាស់គ្មាន
`closedAt` បោះត្រាពី item រួចចេញ ~២ ម៉ោងក្រោយ (មិនភ្លាមៗ) · purge ៣០ ថ្ងៃ
បៃតង។ **ច្បាប់ទាំង ៣ ដំណើរការត្រឹមត្រូវ។**

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែសោះ (`pickedUpPhones/$phoneKey` មាន
  `.validate` ស្រាប់រួចហើយ)។

---

## [2.19.4] — 2026-08-27 · ចំនួន «អតិថិជនយក» ជាប់គាំងពេលបើកកញ្ចប់វិញ

> ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-27) — អ្នកប្រើសាកសេណារីយ៉ូ
> ដែលគាត់រាយការណ៍ដោយផ្ទាល់ ហើយបញ្ជាក់ថា **«ដំណើរការត្រឹមត្រូវហើយ»**។

> 🔴 **កំហុសផលិតកម្មពិត។** អ្នកប្រើសាកដោយជំហានច្បាស់លាស់៖ «បញ្ចូល ២ កញ្ចប់
> លេខទូរស័ព្ទដូចគ្នា … ពេលបើកកញ្ចប់ទី ១ វិញ ចំនួនកញ្ចប់ 0 ត្រឹមត្រូវ តែ
> **ចំនួនអតិថិជននៅតែ 1**»។ អ្នកប្រើក៏បញ្ជាក់ថា **វាមិនរាប់អតិថិជនស្ទួនទេ** —
> កំហុសមានតែត្រង់ការ **មិនដក** វិញ។ អ្នកប្រើត្រូវទាំងស្រុង។

### កែកំហុស

- 🔴 **ចំនួន «អតិថិជនយក» មិនត្រឡប់ចុះវិញ ពេលបើកកញ្ចប់ដែលយករួច។**
  លេខទាំង ២ រាប់លើ **មូលដ្ឋានពីរខុសគ្នា**៖
  · **កញ្ចប់** រាប់តាម **barcode** — ស្ថានភាពបិទរបស់ barcode រស់រានឆ្លងកាត់
    ការលុប ➜ ស្តារ ➜ merge ដូច្នេះ `+1` និង `-1` ផ្គូផ្គងគ្នាជានិច្ច។
  · **អតិថិជន** រាប់តាមស្ថានភាព **«កញ្ចប់បិទពេញ»** របស់ item ។
  ការស្តារពីធុងសំរាមហៅ `applyRestoreMergeInto()` ដែល merge កញ្ចប់ចូលគ្នា
  តាមលេខទូរស័ព្ទ ➜ item លែងបិទពេញ **ដោយមិនបញ្ចេញ delta សោះ** ➜ `+1` ដើម
  គ្មាន `-1` ផ្គូផ្គង ➜ លេខជាប់គាំង។ បង្កើតឡើងវិញបានលើកូដពិត៖ ជំហានទី ៥
  ផ្តល់ `អតិថិជន=1 កញ្ចប់=0` ដូចរបាយការណ៍បេះបិទ។

  **ដំណោះស្រាយ (គោលការណ៍សម្រេចដោយអ្នកប្រើ)**៖
  · **អតិថិជន = លេខទូរស័ព្ទផ្សេងៗគ្នាដែលមាន barcode បិទ >= ១** — លេខ ១
    ស្មើអតិថិជន ១ ទោះលេខនោះមានកញ្ចប់ ១០ ក៏ដោយ។
  · **កញ្ចប់ = ចំនួន barcode ដែលបិទ** (ដដែល — វាដំណើរការត្រឹមត្រូវស្រាប់)។
  ឥឡូវ `pickedUpPhones[key]` រាប់ **barcode បិទ** របស់លេខនោះ ហើយ
  `countPickedUpCustomers()` (រាប់កូនសោ) ផ្តល់ចំនួនអតិថិជនត្រឹមត្រូវ។
  delta អតិថិជន **ចម្លងចេញពី** delta កញ្ចប់គ្រប់កន្លែង ➜ ការឃ្លាតគ្នាក្លាយជា
  **មិនអាចកើតឡើងបានតាមរចនាសម្ព័ន្ធ**។ helper ថ្មី `closedBarcodeCount()`។
- **ការប្តូរលេខទូរស័ព្ទ** ផ្លាស់ ref តាម **ចំនួន barcode បិទ** មិនមែន ±1 ទៀតទេ
  (មុននេះកញ្ចប់ដែលមាន barcode បិទ ៣ ផ្លាស់ត្រឹម ១ ➜ សល់ ២ លើលេខចាស់)។
- **ការ merge ស្កេន** លែងបញ្ចេញ `(-1, 0)` — វាបើក item ដោយ **មិនប្តូរ
  barcode ណាមួយ** ដូច្នេះតាមការរាប់តាម barcode ledger មិនត្រូវប្រែសោះ។
  មុននេះវាដកអតិថិជនដោយមិនដកកញ្ចប់ ➜ ការឃ្លាតគ្នាទិសផ្ទុយ។

### ផ្លាស់ប្តូរ — កំណែជារបស់ App នីមួយៗ

> 🔴 **អ្នកប្រើសួរត្រង់ៗ៖** «ជុំខ្លះ app ខ្លះមិនបានកែអីផង ត្រូវឡើងកំណែដែរ
> វាអត់សូវសមហេតុផល … ហើយរាល់ការគ្រាន់តែឡើងកំណែ ធ្វើឲ្យ netlify redeploy»។
> **គាត់ត្រូវ។** ភស្តុតាងពីជុំនេះមុនកែ៖ `ZoeKeyGen/app.js` ប្រែ **តែបន្ទាត់
> `APP_VERSION` មួយគត់** — គ្មានការកែពិតសោះ។

- **`APP_VERSION` លែងត្រូវបង្ខំឲ្យដូចគ្នារវាង ZoeW និង ZoeKeyGen ទៀតទេ។**
  អ្វីដែលត្រូវស៊ីគ្នាគឺ **ខាងក្នុង App នីមួយៗ**៖ `app.js` ↔ `manifest.json`
  ↔ `index.html`។ (ZoeImport មានកំណែឯករាជ្យស្រាប់តាំងពីដើម។)
  ជុំនេះ៖ ZoeW **2.19.4** · ZoeKeyGen **នៅ 2.19.3** (មិនប្រែ) ·
  ZoeImport **នៅ 1.3.0**។
  ➜ អ្នកប្រើ ZoeKeyGen **មិនត្រូវទាញសំបកទាំងមូលឡើងវិញ** ដោយឥតប្រយោជន៍
  ហើយ Netlify មិន redeploy site ដែលគ្មានការប្រែ។
- **`version-bump-scope.js` ថ្មី** (3 assertion) — ចាក់សោវិសាលភាព៖ ធៀបនឹង
  `origin/main` ➜ កូដដែល ship ប្រែ **ត្រូវ** ឡើង `CACHE_VERSION` និង
  `APP_VERSION`; គ្មានការកែពិត (ការប្រែតែបន្ទាត់ `APP_VERSION`) **មិនត្រូវ**
  ឡើង។ **Mutation**៖ ឡើងកំណែ ZoeKeyGen ដោយគ្មានការកែ ➜ ធ្លាក់ភ្លាមដោយសារ
  «ការឡើងកំណែទទេបង្ខំអ្នកប្រើទាញសំបកទាំងមូលឡើងវិញ»។

### ឧបករណ៍ audit

- **`pickup-ledger-test.js` ថ្មី** (13 assertion) — ស្រង់ `getPickupPhoneKey` ·
  `countPickedUpCustomers` · `addPickupToDailyRecord` · `closedBarcodeCount`
  **ចេញពី `app.js` ពិត** រួចលេងសេណារីយ៉ូរបស់អ្នកប្រើឡើងវិញ។ អះអាង **អថេរ**
  `sum(pickedUpPhones) === packagesPickedUp` បូកនឹងច្បាប់រចនាសម្ព័ន្ធ៖ delta
  អតិថិជនត្រូវ **ចម្លងចេញពី** delta កញ្ចប់ · គ្មានការគណនាតាមមូលដ្ឋានចាស់
  «item បិទពេញ» នៅសល់។ លើ tree មុនកែ **ធ្លាក់ ៦**។
  ⚠️ ជំហានសំខាន់៖ ការប្រៀបធៀបអាគុយម៉ង់តាម **ឈ្មោះ** មិនគ្រប់គ្រាន់ទេ
  (`-pickupCustomerDelta` ធៀប `-pickupPackageDelta` ជាឈ្មោះខុស តម្លៃដូច) —
  ត្រូវអះអាង **ការផ្តល់តម្លៃ** និង **ឥរិយាបថ** ជំនួស។
- **`concurrent-scan-test.js` និង `ui-flow-test.js`** ៖ ការអះអាង ៣ ធ្លាប់
  **ចាក់សោការឃ្លាតគ្នាទុកជាឥរិយាបថត្រឹមត្រូវ** (ឧ. «ដកអតិថិជន ១ ចេញ តែមិន
  ប៉ះចំនួនកញ្ចប់»)។ ពួកវាឥឡូវអះអាង **អថេរ** `sum(refs) === packages` ជំនួស
  លេខថេរ ➜ រឹងមាំជាងមុន។ seed របស់ `ui-flow` ក៏ត្រូវកែ ព្រោះវាបង្កើត
  ទិន្នន័យដែលរំលោភអថេរតាំងពីមុនកូដ App រត់ផង។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែសោះ។
- ℹ️ លេខ `zoew_daily_pickup_cod_dod` ដែលមានស្រាប់ **មិនត្រូវគណនាឡើងវិញទេ** —
  ថ្ងៃចាស់រក្សាតម្លៃដើម។ ថ្ងៃថ្មីរាប់តាមមូលដ្ឋានថ្មី។

---

## [2.19.3] — 2026-08-26 · ស្តារពីការដាច់បណ្តាញឲ្យ **ដើរបានពិត**

### ⛔⛔ មូលហេតុឫសគល់៖ ឧបករណ៍ audit ខ្លួនវាបៃតងក្លែងក្លាយ

> 🔴 **អ្នកប្រើសួរត្រង់ៗ៖** «ហេតុអ្វី audit លើកណាក៏ជួបកំហុសមិនចេះចប់?»
> ចម្លើយ៖ មិនមែនកូដ App អាក្រក់ទេ — **ឧបករណ៍មិនអាចធ្លាក់បាន**។

វាស់លើ checker ទាំង **៨១**៖

| ថ្នាក់បៃតងក្លែងក្លាយ | ចំនួន |
|---|---|
| ជោគជ័យលើ **ថតទទេ** (ការអះអាងអវត្តមានគ្មានជាន់អប្បបរមា) | **៦** បូក `scan-engine-test` (SKIP) |
| គ្មាន `*_APP_DIR` ➜ ចង្អុលទៅ tree ផ្សេងមិនបាន | **១៧** |
| មាន override តែមិនត្រូវបានហៅក្នុងផ្នែក baseline | **១៥** |
| បញ្ឈប់ខ្លួនពេលរក function មិនឃើញ ➜ បិទបាំងការអះអាង ១០០ | **១** |

**៣២/៨១ (៤០%)** មិនអាចត្រូវបានផ្ទៀងផ្ទាត់ថា «មិនទទេ» បានទេ — ទោះបី
`CLAUDE.md` ចែងតាំងពីយូរថារាល់តេស្តថ្មីត្រូវរត់លើ `git archive origin/main`។

- **`checker-coverage.js` ថ្មី (meta-checker)** — វា **រត់ checker នីមួយៗពិត**
  ដោយចង្អុល `*_APP_DIR` ទៅថតទទេ រួចអះអាងថា **គ្មានមួយណាចេញ exit 0**។ ការវាស់
  ឥរិយាបថ មិនមែន grep។ Mutation ៖ ដកជាន់អប្បបរមាចេញពី `storage-guard.js`
  ➜ ធ្លាក់ភ្លាម។
- **ជាន់អប្បបរមា** បន្ថែមក្នុង `stale-write` · `storage-guard` · `animation-cost`
  · `css-media-override` · `compensation-order` · `comments`។
- **`scan-engine-test`** ៖ ការបាត់ `zxing_reader.wasm` ជា **ការធ្លាក់** មិនមែន SKIP។
- **`*_APP_DIR` បន្ថែម ១៧** និង **ការហៅក្នុងផ្នែក baseline បន្ថែម ៣១**។
- **`connection-recovery-test`** លែងបញ្ឈប់ខ្លួន ➜ tree មុនកែឥឡូវបង្ហាញ
  **២៤ ការធ្លាក់ដែលមានន័យ** ជំនួស «0 ok, 1 FAIL» ដែលបិទបាំងអ្វីៗទាំងអស់។

### កែកំហុសបន្ថែម (ជុំសួរ «មានអ្វីមិនទាន់កែទៀតទេ?»)

- 🔴 **ការបរាជ័យ `crypto.subtle` បណ្តោះអាសន្ន លុប License របស់អតិថិជន។**
  `verifySignature()` រុំ WebCrypto ក្នុង try/catch រួចត្រឡប់ `false` ➜
  `getStatus()` បែងចែក «ហត្ថលេខាខុស» ចេញពី «ផ្ទៀងផ្ទាត់មិនបាន» មិនបាន ➜ វា
  `clearLocalRecord()`។ ថ្នាក់ដដែលនឹងច្បាប់ `{ ok: null }` របស់បណ្តាញ
  (ដែល `CLAUDE.md` ហាមដាច់ខាត) តែនៅលើអ័ក្ស **crypto** ដែលគ្មានអ្នកការពារ។
  បង្កើតឡើងវិញបានក្នុង `vm`៖ record បាត់។ ឥឡូវ `verifySignatureAndScope()`
  ត្រឡប់ `{ unverified: true }` ➜ `getStatus()` **មិនលុប**; ហត្ថលេខាខុសពិត
  **នៅតែលុបដដែល**; `activate()` **បដិសេធ** អ្វីដែលផ្ទៀងផ្ទាត់មិនបាន។
- 🔴 **`redactDeep()` មិនលាក់តម្លៃដែលអង្គុយក្រោមកូនសោសម្ងាត់។** វាលាក់តែ
  លំនាំ `name=value` **ខាងក្នុងខ្សែអក្សរ** ➜ `{ pin: '1234' }` ·
  `{ apiKey: 'sk-live-…' }` · `{ clientSecret: … }` ធ្លាក់ចូល Sentry ដោយ
  មិនលាក់។ ឥឡូវលាក់តាមឈ្មោះកូនសោដែរ ដោយប្រើបញ្ជី **តូចជាង** ដើម្បីកុំឲ្យ
  `keyId` · `barcode` · `itemId` ត្រូវលាក់ (ច្បាប់ «keep case»)។
- **ZoeImport ៖ `confirmResolver` លេចធ្លាយ។** ការចាក់សោ App ខណៈប្រអប់បញ្ជាក់
  បើកនៅ ➜ promise **មិនដែលដោះ** ➜ `isBusy` ជាប់ `true` ជារៀងរហូត ➜ ប៊ូតុង
  នាំចូលស្លាប់រហូតដល់ Refresh។ `resetSessionState()` ឥឡូវដោះវា និង reset
  `isBusy` + `toastTimer`។

### ចន្លោះ checker ដែលបិទបន្ថែម

- **`secret-hygiene` · `storage-guard` · `dom-hygiene` · `state-hygiene`
  មិនស្កេន ZoeImport សោះ** — ខណៈវាកាន់ **ពាក្យសម្ងាត់នាំចូល** និង **កូនសោ
  AES** ក្នុង state កម្រិត module។ ថ្នាក់ «checker ស្កេនឯកសារណាខ្លះ» ដដែល។
  ក្រោយពង្រីក ➜ `state-hygiene` **រកឃើញ `confirmResolver` ភ្លាម**។
- `license-grace-test` ៖ ១៣ ➜ ១៦ assertion (អះអាង **៣ ខាង**)។
- `secret-hygiene` ៖ ៥១ ➜ ៦៦ assertion (អះអាង **២ ខាង** — លាក់ត្រូវ **និង**
  រក្សា `keyId`/`barcode`/`itemId` ទុក)។

### កែកំហុសបន្ថែម

- 🔴 **listener `.info/connected` និង `.info/serverTimeOffset` គ្មានផ្លូវស្តារ។**
  កំណែ 2.11.6 បានឲ្យ listener ទិន្នន័យទាំង ៦ នូវជណ្តើរស្តារ — តែ ២ នេះ
  ត្រូវបានទុកចោល៖ callback កំហុសរបស់ `.info/connected` គ្រាន់តែសរសេរ UI
  ដោយ **មិនភ្ជាប់ខ្លួនវាឡើងវិញ** ចំណែក `.info/serverTimeOffset` **គ្មាន
  callback កំហុសសោះ**។ ព្រោះ Firebase ដក listener ចេញពេល errCb បាញ់៖
  `isDatabaseConnected` កក `false` ជារៀងរហូត ➜ ស្លាកកុហក · watchdog វដ្ត
  `goOffline()`+`goOnline()` រាល់ ៦០ វិ. អស់ថ្ម · `serverTimeOffsetMs` កក ➜
  `getServerNow()` ឃ្លាត ➜ ការសម្រេច retention ដើរលើនាឡិកាខុស។ ឥឡូវ
  `attachInfoListeners()` ជាផ្លូវភ្ជាប់តែមួយ ព្រមជាមួយ
  `handleInfoListenerError()` និងជណ្តើរ 2/5/10/20/30 វិ.។ **កែទាំង ២ App។**

### ឯកសារ

- **`CLAUDE.md` ត្រូវបានបំបែក** ៖ **២ ៥០៨ បន្ទាត់ / ២៨៧ kB** ដែល **៦៨/៧៥
  ចំណងជើង** ជារឿងអតីតកាល ➜ ឥឡូវ **១ ៨២១ បន្ទាត់ (ច្បាប់)** បូក
  **`docs/BUG-HISTORY.md` ៨១២ បន្ទាត់ (ប្រវត្តិ)**។
- **តារាង «🔒 ច្បាប់ ➜ ឧបករណ៍ដែលចាក់សោវា» ថ្មី** — រាល់ច្បាប់ចងទៅឧបករណ៍
  ហើយច្បាប់ដែល **គ្មានឧបករណ៍** ត្រូវសម្គាល់ **📝** ដោយបើកចំហ។
- **ច្បាប់ថ្មីទី ១៣** ៖ «ការកត់ត្រាមិនមែនជាការអនុវត្តទេ» — ភស្តុតាង៖ មេរៀន
  ដដែលត្រូវបានសរសេរ **១៣ ដង** ក្នុង ៥ កំណែ ហើយវានៅតែកើតឡើងម្តងទៀត។


> ជុំ deep audit។ `run-all.sh` **បៃតងទាំង ៨៧** មុនចាប់ផ្តើម — ដូច្នេះកំហុស
> ទាំង ៤ ខាងក្រោមរស់រានបានព្រោះ **គ្មាន checker ណាមួយសួរសំណួរត្រឹមត្រូវ**
> មិនមែនព្រោះមានតេស្តធ្លាក់ដែលគេមើលរំលងទេ។

### កែកំហុស

- 🔴 **ជណ្តើរស្តារ Firebase SDK មិនអាចស្តារបានទាល់តែសោះ។** ពេលការនាំចូល
  module ពី `gstatic.com` ធ្លាក់ (បណ្តាញអន់ពេលបើក App) នោះ App ចូលជណ្តើរ
  5/10/20/30/60 វិនាទី ដែលហៅ `initFirebase()` ➜ `waitForFirebaseSDK()` ➜
  រង់ចាំព្រឹត្តិការណ៍ `firebasesdkready` ដដែល។ **វាស់ក្នុង Chromium ពិត៖
  ព្រឹត្តិការណ៍នោះមិនអាចមកដល់បានទៀតទេ** — ពេល static import ធ្លាក់ម្តង
  **module map របស់ browser cache ការបរាជ័យនោះពេញអាយុទំព័រ**៖ ការ import
  URL ដដែលឡើងវិញធ្លាក់ភ្លាមដោយមិនចេញបណ្តាញសោះ ហើយសូម្បីតែការបន្ថែម query
  ទៅ URL កម្រិតលើក៏មិនជួយដែរ (dependency ខាងក្នុងនៅជា URL ដដែល)។ ដូច្នេះ
  អ្នកប្រើឃើញ **«ក្រៅបណ្ដាញ» ជារៀងរហូត ខណៈបណ្តាញដើរធម្មតា** ហើយរាល់ជុំ
  ជណ្តើរគ្រាន់តែចំណាយ timer ១៥ វិនាទីទទេ។ ឥឡូវការស្តារជា **ការផ្ទុកទំព័រ
  ឡើងវិញ** (ផ្លូវតែមួយដែលដើរបានពិត) ដោយមានពិដាន ៣ ដងក្នុងមួយវគ្គ · គម្លាត
  អប្បបរមា ២០ វិនាទី · រំលងពេលក្រៅបណ្តាញ · និង **រំលងពេលមានប្រអប់បើក**
  (កុំលុបអ្វីដែលអ្នកប្រើកំពុងវាយ)។ បន្ថែមពីនេះ `armLateFirebaseSdkListener()`
  ទទួល SDK ដែលមកដល់យឺតជាង ១៥ វិនាទី ➜ ដំណើរការភ្លាមដោយ **មិនបាច់ផ្ទុក
  ទំព័រឡើងវិញសោះ**។
- 🔴 **ZoeKeyGen មិនដាស់ការផ្ទុក SDK ពេលត្រឡប់មក foreground។** ZoeW ហៅ
  `retryFirebaseSdkNow()` ពីទាំង `online` និង `visibilitychange` ចំណែក
  ZoeKeyGen ហៅតែពី `online`។ លើទូរស័ព្ទ បណ្តាញដែលត្រឡប់មកវិញ **ជាញឹកញាប់
  មិនបាញ់ `online` ទេ** (`navigator.onLine` នៅ `true` ពេញការដាច់) ➜ ការ
  ប្តូរ App ចេញចូល ដែលជាកាយវិការធម្មតារបស់អ្នកប្រើ **មិនធ្វើអ្វីសោះ**។
- 🔴 **Service worker បង្វែរការបរាជ័យរបស់ Cache Storage ទៅជាការដាច់ App
  ទាំងស្រុង** (App ទាំង ៣)។ `event.respondWith(caches.open(...))` គ្មានផ្លូវ
  សម្រាប់ការបដិសេធ ➜ ពេល `caches.open()` ឬ `cache.match()` បោះ (Safari
  ជម្រះ storage · `QuotaExceededError` ពេលឧបករណ៍ជិតពេញ · អ្នកប្រើចុច
  «Clear site data» ខណៈ App បើក) នោះ browser រាប់វាជា **NetworkError** ➜
  **រាល់សំណើធ្លាក់** ➜ អេក្រង់សទទេ ខណៈបណ្តាញដើរធម្មតា ហើយអ្នកប្រើដោះមិនរួច
  លុះត្រាតែដក service worker ចេញដោយដៃ។ ឥឡូវការបរាជ័យនោះធ្លាក់ទៅ
  `fetch()` ធម្មតា ➜ App នៅដំណើរការដរាបណាបណ្តាញដើរ។
- **timer ជណ្តើរដែលនៅសល់ អាចរុះរើ SDK ដែលកំពុងដំណើរការឡើងវិញ។** បើ SDK
  មកដល់យឺត (ឧ. វិនាទីទី ១៩) នោះការភ្ជាប់ជោគជ័យ តែ timer ជណ្តើរនៅតែបាញ់នៅ
  វិនាទីទី ២០ ➜ `initFirebase()` រត់ម្តងទៀត ➜ `deleteApp()` និងភ្ជាប់
  listener ឡើងវិញ **ខណៈ App កំពុងដំណើរការធម្មតា**។
- 🔴 **ជណ្តើរស្តារ listener កាត់ផ្តាច់ការទាញទិន្នន័យដែលកំពុងដំណើរការ។**
  `attemptDbListenerRecovery()` ហៅ `initDatabaseListeners()` ដែល detach រួច
  attach ទាំង ៦ path ឡើងវិញ — ការនោះបោះបង់ snapshot ដែលកំពុងទាញចុះមក។ លើ
  តំណយឺត (2G ឬប្រវត្តិធំ) ការទាញអាចយូរជាងជំហានជណ្តើរ (ពិដាន ៣០ វិនាទី) ➜
  រៀងរាល់ ៣០ វិនាទីវាចាប់ផ្តើមសាជាថ្មី ➜ **តារាងកកជារៀងរហូត** ខណៈស្លាក
  សរសេរ «កំពុងភ្ជាប់ឡើងវិញ...»។ វាស់បានលើកូដមុនកែ៖ path ៥ ក្នុងចំណោម ៦
  នៅជាប់ជារៀងរហូត។ ឥឡូវខណៈចំនួន path ដែលនៅសល់ **កំពុងតូចទៅៗ** ជណ្តើរ
  រង់ចាំ; បើវាឈប់តូច (ជាប់មែន) ជុំបន្ទាប់ attach ឡើងវិញដូចមុន។

### ឧបករណ៍ audit

- **`sw-cache-failure-test.js` ថ្មី** (21 assertion, App ទាំង ៣) — រត់
  `sw.js` **ពិត** ក្នុង `vm` ជាមួយ Cache API ដែលបរាជ័យតាមរបៀបផ្សេងៗ រួច
  អះអាងថា `respondWith` **resolve ជា Response ពិត** មិនមែនបដិសេធ។
  លើ tree មុនកែ **ធ្លាក់ ១៨ ក្នុងចំណោម ២១**។
- **`connection-recovery-test.js`** ៨៥ ➜ ១០៤ assertion។ ផ្នែកថ្មីអះអាង
  **២ ខាង**៖ ការស្តារ SDK ត្រូវជាការផ្ទុកទំព័រឡើងវិញ **ហើយ** ត្រូវមានពិដាន
  និងមិនលុបអ្វីដែលអ្នកប្រើកំពុងវាយ; resync យឺតត្រូវ **ចប់បាន** **ហើយ**
  ការជាប់ពិតត្រូវនៅតែ attach ឡើងវិញ។ លើ tree មុនកែ **ធ្លាក់ ១១**។
- **`html-sink-escaping.js`** ស្កេន **ទម្រង់ HTML ទាំង ២** ឥឡូវនេះ។ មុននេះ
  វាស្កេនតែ `TemplateLiteral` ➜ HTML ដែលសាងដោយ **ការតភ្ជាប់ខ្សែអក្សរ**
  (`'<tr><td>' + ... `) ជា **ចន្លោះស្ងាត់**។ Mutation ពិត (ដក
  `sanitizeInput()` ចេញពីជួរដេកតារាងអតិថិជន) មុននេះ **រអិលកាត់**;
  ឥឡូវធ្លាក់។ (កូដបច្ចុប្បន្នមិនមានការលេចធ្លាយទេ — នេះជាការបិទចន្លោះ។)

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែសោះ ហើយ CSP ក៏មិនប្រែដែរ។

---

## [2.19.2] — 2026-08-26 · វគ្គ ៤ ម៉ោងផុតកំណត់ ➜ toast ត្រូវនិយាយការពិត

> 🔴 **កំហុសផលិតកម្មពិត។** អ្នកប្រើរាយការណ៍ថា **«នៅពេលចប់ session login
> ៤ ម៉ោង លោតផ្ទាំងមកឲ្យ login តែ toast លោតមក ‹ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យ
> ទាន់សម័យ› ខុសស្ថានភាពហើយ អត់ real សោះ»។ **អ្នកប្រើត្រូវទាំងស្រុង។**

### កែកំហុស

- 🔴 **ប្រអប់ login លោតមក ខណៈ toast ប្រកាសថាចូលប្រព័ន្ធជោគជ័យ។**
  ពេលបើក App ក្រោយពិដាន ៤ ម៉ោង Firebase ស្តារ session ដែល cache ទុកមកវិញ
  ➜ `proceedAfterLogin()` **ប្រកាសភ្លាម** (`showLiveToast('signin')`) ខណៈការ
  ពិនិត្យពិដាន ៤ ម៉ោង **នៅមិនទាន់ចប់** ➜ ពេលវាចប់ App ចាកចេញ ហើយបើកប្រអប់
  login។ ប៉ុន្តែ toast នោះជា **toast «រស់»** (កំណែ 2.19.0) ដែលសរសេរខ្លួនវា
  ឡើងវិញរាល់ការគូរស្ថានភាពការតភ្ជាប់ — ហើយ `liveToastState()` អានតែស្ថានភាព
  **បណ្តាញ** ៖ វា **មិនដែលសួរថា «តើគេនៅចូលប្រព័ន្ធទេ?»** សោះ។ ដូច្នេះ
  socket ឡើង + snapshot មកគ្រប់ ➜ វាសរសេរជាន់ថា «✅ ចូលប្រព័ន្ធជោគជ័យ —
  ទិន្នន័យទាន់សម័យ» **ចំពេលអ្នកប្រើត្រូវបានស្នើឲ្យវាយពាក្យសម្ងាត់ម្ដងទៀត**។

  វាស់បានក្នុង Chromium ពិត លើកូដពិត (វគ្គផុតកំណត់ · socket ភ្ជាប់ ·
  snapshot គ្រប់)៖

  | រង្វាស់ | មុនកែ | ក្រោយកែ |
  |---|---|---|
  | អត្ថបទ toast | `✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ` | `⏱️ ផុតកំណត់ ៤ ម៉ោងហើយ! សូមវាយពាក្យសម្ងាត់…` |
  | ពណ៌ | បៃតង `rgb(16, 185, 129)` | ទឹកក្រូច `rgb(180, 83, 9)` |
  | នៅ «រស់» (អាចត្រូវសរសេរជាន់ម្ដងទៀត) | បាទ | ទេ |

  ឥឡូវ **អ្នកប្រើឃើញ**៖ ពេលវគ្គផុតកំណត់ សារដដែលនោះ **ប្តូរខ្លួនវា** ទៅជា
  សារផុតកំណត់ពណ៌ទឹកក្រូច ជំនួសការលោត toast ថ្មីស្ទួន ហើយវាលែងអាចវិលមក
  ប្រកាសជោគជ័យវិញបានទៀតទេ។ `reannounceOrShowToast()` ធានាថាសារនោះលេច
  **តែ ១** ហើយ **រស់ពេញ ៣ វិនាទី** ទោះការចាកចេញយឺតយ៉ាងណា។

- **សារផុតកំណត់ចេញជាពណ៌ព្រមានពិត។** «ផុតកំណត់ ៤ ម៉ោងហើយ!…» គ្មានសញ្ញា
  នាំមុខ ➜ វាធ្លាក់ចូលថ្នាក់ `info` (ខ្មៅ) ➜ មើលទៅដូចសារធម្មតា។ ឥឡូវវា
  ចាប់ផ្តើមដោយ `⏱️` ➜ ថ្នាក់ `warn` (ទឹកក្រូច) តាមតារាងថ្នាក់ toast របស់
  កំណែ 2.19.0។

- **ការចាកចេញធម្មតាក៏ត្រូវបានបិទចន្លោះដដែល (ZoeW និង ZoeKeyGen)។**
  ថ្នាក់កំហុសដដែលកើតបានពេលអ្នកប្រើចុច «ចាកចេញ» ក្នុង ២០ វិនាទីដំបូងក្រោយ
  ចូលប្រព័ន្ធ (អាយុរបស់ toast រស់)។ ឥឡូវ `liveToastState()` ទាំង ២ App
  ពិនិត្យ **អ្នកប្រើពិត** (`auth.currentUser` បូក `isSignedInUiActive` ក្នុង
  ZoeKeyGen) មុននឹងអះអាងអ្វីទាំងអស់ ➜ toast ប្តូរទៅ «⚠️ បានចាកចេញពីប្រព័ន្ធ
  — សូមចូលប្រព័ន្ធម្ដងទៀត»។

- **ZoeKeyGen ប្រកាសមុនលើកទង់ចូលប្រព័ន្ធ។** `verifyAdminRoleThenProceed()`
  ហៅ `showLiveToast('signin')` **មុន** `isSignedInUiActive = true` ➜ ក្រោយ
  បន្ថែម gate ខាងលើ វានឹងប្រកាស «បានចាកចេញ» ដល់អ្នកទើបចូល។ លំដាប់ត្រូវបាន
  បញ្ច្រាស ហើយ `toast-truth-test.js` ចាក់សោវា — ជាច្បាប់ដដែលនឹង «ប្រកាស
  ក្រោយ `initDatabaseListeners()`» របស់ ZoeW។

### ឧបករណ៍ audit

- **`toast-truth-test.js` ៖ ៦៧ ➜ ៩២ assertion។** ផ្នែក **៤ខ** ថ្មីអះអាង
  **២ ខាង** ៖ toast ត្រូវ **បដិសេធ** ការប្រកាសពេលវគ្គស្លាប់ **ហើយនៅតែ
  ប្រកាសដដែលពេលវគ្គរស់** — បើមានតែខាងទីមួយ នោះ «កុំប្រកាសសោះ» ក៏ជាប់តេស្ត
  ដែរ។ វាក៏អះអាងលំដាប់ ៖ `proceedAfterLogin()` ដាក់ទង់ «មិនទាន់ដឹង» មុន
  ប្រកាស · `forceExpireSession()` សម្គាល់វគ្គថាស្លាប់ **មុន** `fb.signOut`
  (async) · `showLoginModalWithPrefill()` អានសេចក្តីពិតឡើងវិញ។
  ការវាស់ mutation ៖ ដក gate ចេញតែម្យ៉ាង ➜ **១០ assertion ធ្លាក់** ហើយ
  អត្ថបទដែលវាចាប់បានគឺ `✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ` បេះបិទ
  តាមរបាយការណ៍របស់អ្នកប្រើ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែសោះ។ គ្រាន់តែ deploy។

---

## [2.19.1] — 2026-08-26 · Export Excel ដើរវិញ — SheetJS ចូលមកក្នុង repo

> 🔴 **កំហុសផលិតកម្មពិត។** អ្នកប្រើរាយការណ៍ថា **«export excel អត់ចេញ មិនមែន
> មកពី internet ទេ internet ខ្ញុំដើរលឿនធម្មតា»** ព្រមទាំងផ្ញើដាន Sentry ពិត
> មកជាមួយ។ **អ្នកប្រើត្រូវទាំងស្រុង** — បណ្តាញគ្មានពាក់ព័ន្ធអ្វីសោះ។

### កែកំហុស

- 🔴 **Export Excel ស្លាប់ទាំងស្រុងលើផលិតកម្ម — `script-src` ទប់ SheetJS។**
  ZoeW ទាញ SheetJS ពី `https://unpkg.com/xlsx@0.18.5/...` ខណៈ header CSP ក្នុង
  `ZoeW/netlify.toml` អនុញ្ញាតតែ `'self' 'wasm-unsafe-eval' www.gstatic.com
  js.sentry-cdn.com browser.sentry-cdn.com *.firebaseio.com
  *.firebasedatabase.app` ➜ **គ្មាន `unpkg.com` សោះ** ➜ browser **ទប់មុនចេញ
  ដំណើរ**។

  ដាន Sentry ពីឧបករណ៍ពិតបញ្ជាក់វា — សំណើឯទៀត **200 គ្រប់** (`zxing_reader.wasm`
  · `identitytoolkit` · `license_keys` · Apps Script) ហើយមានតែបន្ទាត់នេះ៖

  ```
  Excel export failed: Error: Failed to load https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js
      at HTMLScriptElement.<anonymous> (https://zoew.netlify.app/app.js:4821:79)
  ```

  បង្កើតឡើងវិញក្នុង Chromium ពិតជាមួយ header CSP ពិត ដោយ **បម្រើ unpkg ក្នុង
  មូលដ្ឋាន** ដើម្បីឲ្យ **តែ CSP** ជាអ្នកសម្រេច៖

  | រង្វាស់ | មុនកែ | ក្រោយកែ |
  |---|---|---|
  | ការផ្ទុក library | `{ loaded: false, hasXLSX: false }` | `{ loaded: true, hasXLSX: true }` |
  | សំណើទៅដល់ CDN | **0** (ទប់មុនចេញដំណើរ) | **0** (លែងត្រូវការ) |
  | ការរំលោភ CSP | `Refused to load the script …` | គ្មាន |
  | សរសេរ `.xlsx` ពិត | `XLSX is not defined` | ឯកសារចាប់ផ្តើមដោយ `PK` |

  **ដំណោះស្រាយ៖ SheetJS ចូលមកក្នុង repo** (`ZoeW/vendor/xlsx.full.min.js`) —
  ច្បាប់ដដែលនឹង ZXing ក្នុងកំណែ 2.10.0 និងដដែលនឹង ZoeImport ដែលធ្វើរួចហើយ។
  ឯកសារនោះជាឯកសារ **byte-identical** នឹងអ្វីដែល unpkg ធ្លាប់បម្រើ —
  ផ្ទៀងផ្ទាត់ដោយ sha384 ត្រូវនឹង SRI ដើមរបស់ ZoeW បេះបិទ។ វាក៏ចូល
  `OPTIONAL_SHELL` របស់ `sw.js` ដែរ ➜ **Export ដើរពេលក្រៅបណ្ដាញ** ដោយមិន
  ធ្វើឲ្យការដំឡើង SW ក្លាយជា atomic លើឯកសារ ៨៨១ kB ថែមទៀត។

- **សារបរាជ័យចោទបណ្តាញខុស។** «❌ Export Excel បរាជ័យ! សូមពិនិត្យការតភ្ជាប់
  អ៊ីនធឺណិត» ចេញលើ **គ្រប់** កំហុស រួមទាំងកំហុសដែលបណ្តាញគ្មានពាក់ព័ន្ធ។
  ឥឡូវ `exportFailureMessage()` បែងចែក៖ ការផ្ទុកឯកសារធ្លាក់ខណៈ **បណ្តាញដើរ**
  ➜ «ផ្ទុកឯកសារ Excel មិនបានទេ — សូម Refresh ទំព័រម្តង»; ក្រៅបណ្ដាញពិត ➜
  ទើបនិយាយពីបណ្តាញ; កំហុសផ្សេង ➜ បង្ហាញមូលហេតុពិត។ (បន្តស្មារតីជុំ 2.19.0។)

- **`loadScriptOnce()` សរសេរ `script.integrity = undefined`** ពេល lib គ្មាន
  hash ➜ attribute ក្លាយជាខ្សែអក្សរ `"undefined"` ➜ SRI ធ្លាក់។ ឥឡូវវាដាក់
  `integrity` និង `crossOrigin` **តែពេល lib ប្រកាសវា**។

### ឧបករណ៍ audit

- **`csp-lazy-resource-test.js` ថ្មី (២៥ assertion, App ទាំង ៣)។**
  ថ្នាក់កំហុសនេះរស់រានយូរព្រោះ **គ្មាន checker ណាមួយសួរថា browser យក library
  មកពីណា**៖ `csp-enforced-test.js` វាស់តែធនធានដែលផ្ទុក **ពេល boot** ចំណែក
  `export-cells-test.js` ប្រើ module `xlsx` **របស់ npm ក្នុង Node**។ មេរៀន
  ដដែលនឹង `network-timeout-test.js` (2.12.1) និង `fluid-type-focus-test.js`
  (2.16.0)។ ឥឡូវវាគ្រប **ធនធានដែលផ្ទុកយឺត** — អ្វីដែលលេចឡើងតែពេលអ្នកប្រើចុច៖
  រាល់ URL ដែលបញ្ចប់ដោយ `.js` ក្នុងកូដត្រូវឆ្លងកាត់ `script-src` ពិត ·
  SheetJS ក្នុង repo ត្រូវនឹង sha384 · វានៅក្នុងសំបក SW · សារបរាជ័យមិនចោទ
  បណ្តាញខុស · ហើយ **ផ្លូវផ្ទុកពិតត្រូវរត់ក្នុង Chromium ក្រោម header CSP ពិត
  រួចសរសេរ `.xlsx` ចេញមកមែន**។ លើ tree មុនកែ វាធ្លាក់ **១០ assertion**
  ដោយបង្ហាញសារដដែលនឹងដាន Sentry របស់អ្នកប្រើបេះបិទ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules មិនប្រែសោះ។ CSP **មិនត្រូវបន្ថែម `unpkg.com` ទេ**
  — ដំណោះស្រាយគឺដកការពឹងផ្អែកលើ CDN ចេញ មិនមែនបើកទ្វារឲ្យវា។

---

## [2.19.0] — 2026-08-26 · Toast និងស្លាកស្ថានភាព ត្រូវនិយាយការពិត realtime

សំណើអ្នកប្រើ (មានរូបថតជាភស្តុតាង)៖ **«toast អត់ពិត អត់តាមស្ថានភាពជាក់ស្ដែងសោះ
ធ្វើអោយ app ទាំងអស់លោតមក realtime»**។

រូបថតនោះបង្ហាញការកុហក **៣ យ៉ាងក្នុងស៊ុមតែមួយ**៖ App បើកឡើងក្រៅបណ្ដាញពី session
ដែល cache ទុក · តួលេខទាំងអស់ជា **0** · ហើយវាប្រកាស **«ចូលប្រព័ន្ធជោគជ័យ!»**
ខណៈស្លាកក្នុងរបាខាងលើសរសេរ **«ក្រៅបណ្ដាញ»** ដែលចេញជា **ពណ៌បៃតងនៃការភ្ជាប់**។

**ជុំនេះមិនប៉ះតក្កវិជ្ជាអាជីវកម្មសោះ** — គោលការណ៍ «លុប» ទល់នឹង «ដក» មិនប្រែ
(តារាងសេណារីយ៉ូ ១០ ជួរនៅដដែលបេះបិទ; `isDeducted` នៅតែជាវាល *តែមួយគត់* ដែល
កំណត់លុយ) ហើយក៏ **មិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ** ដែរ។

### កែកំហុស

- 🔴 **ស្លាកស្ថានភាពក្នុងរបាខាងលើរបស់ ZoeW ចេញជាពណ៌បៃតងគ្រប់ស្ថានភាព។**
  `.brand-info span { color: var(--success) }` ចាក់ពណ៌ថេរ ➜ អក្សរ «ក្រៅបណ្ដាញ»,
  «កំពុងភ្ជាប់...» និង «កំពុងភ្ជាប់ឡើងវិញ...» សុទ្ធតែចេញ **បៃតងដូចការភ្ជាប់
  ជោគជ័យ**។ វាស់ក្នុង Chromium ពិតលើ tree មុនកែ៖ ស្ថានភាពទាំង ៤ ត្រឡប់
  `rgb(16, 185, 129)` **ដូចគ្នាបេះបិទ**។ នេះជាកំហុស **CSS សុទ្ធ** ដែលគ្មាន
  តេស្ត JavaScript ណាមួយអាចមើលឃើញ។ ឥឡូវ៖ បៃតង = ភ្ជាប់រួច · ទឹកក្រូច =
  កំពុងភ្ជាប់ · ប្រផេះ = ក្រៅបណ្ដាញ។ ZoeKeyGen ទទួលការកែដដែល។

- 🔴 **«ចូលប្រព័ន្ធជោគជ័យ!» ជាការអះអាងដែលកូដមិនអាចដឹង។**
  `onAuthStateChanged` បាញ់ចេញពី session ដែល Firebase រក្សាទុកក្នុងឧបករណ៍
  **ដោយគ្មានបណ្តាញសោះ** ហើយ License មានការអនុគ្រោះ ៣ ថ្ងៃក្រៅបណ្ដាញ ➜ ផ្លូវ
  នោះឡើងដល់ការប្រកាស «ជោគជ័យ» ខណៈគ្មាន socket និងគ្មានទិន្នន័យ។ ឥឡូវការ
  ប្រកាសអានស្ថានភាពពិត ហើយ **កែខ្លួនវាឡើងវិញ** ពេលស្ថានភាពប្រែ (មើល «បន្ថែម»)។

- 🔴 **ZoeKeyGen ៖ ការអានតួនាទីតាម REST អាចជោគជ័យខណៈ socket នៅដាច់** ➜ វា
  ប្រកាស «ចូលប្រព័ន្ធជោគជ័យ!» ខណៈស្លាកសរសេរ «ក្រៅបណ្ដាញ» — ជាការកុហកដដែល
  នឹង ZoeW។ ការប្រកាសឥឡូវរង់ចាំ socket ពិត។

- **«ភ្ជាប់ Config រួចរាល់!» ចេញភ្លាមក្រោយរក្សាទុក** មុនដែល `initFirebase()`
  ទាន់ភ្ជាប់អ្វីទាល់តែសោះ។ ឥឡូវវាប្រាប់ «កំពុងតភ្ជាប់...» រួចប្តូរទៅ
  «✅ ភ្ជាប់ Server រួចរាល់!» **តែពេលភ្ជាប់បានពិត**។

- **ការចាកចេញដែល Firebase ច្រានចោល ក៏សរសេរ «បានចាកចេញពីប្រព័ន្ធ!» ដដែល។**
  ឥឡូវផ្លូវនោះប្រាប់ត្រង់ថា session មូលដ្ឋានត្រូវលុប តែ Server មិនបានដឹង។

### បន្ថែម

- **Toast មាន ៤ ថ្នាក់ដែលមើលឃើញខុសគ្នា** ៖ ជោគជ័យ (បៃតង) · ព័ត៌មាន (ខ្មៅ) ·
  ព្រមាន (ទឹកក្រូច) · កំហុស (ក្រហម)។ មុននេះ toast ទាំង ១៥៦ ក្នុង App ទាំង ៣
  ចេញជា **ពីលដូចគ្នាបេះបិទ** ➜ សារ «⚠️ បរាជ័យក្នុងការ Save Daily Revenue!»
  មើលទៅដូច «✅ បាន Export ជោគជ័យ!» គ្រប់យ៉ាង។ ថ្នាក់អានចេញពី **សញ្ញាដែលសារ
  មានស្រាប់** (`✅` `⚠️` `❌` `⛔`) ដូច្នេះការកែនេះគ្របគ្រប់ call site ដោយ
  មិនចាំបាច់ប្តូរអត្ថបទណាមួយឡើយ។

- **Toast ដែល «រស់» — realtime។** ការប្រកាសដែលអាស្រ័យលើការតភ្ជាប់ លែងជាអក្សរ
  កកអស់ ៣ វិនាទីទៀតទេ។ វាចុះឈ្មោះខ្លួនក្នុង DOM (`data-live-toast`) ហើយ
  **`renderConnectionStatus()` ជាកន្លែងផ្សាយតែមួយ** ➜ រាល់ការប្រែនៃស្ថានភាព
  សរសេរអត្ថបទ និងពណ៌របស់វាឡើងវិញ **ក្នុងធាតុដដែល**៖

  | ស្ថានភាពពិត | អ្វីដែល toast សរសេរ |
  |---|---|
  | ក្រៅបណ្ដាញ | ⚠️ ចូលប្រព័ន្ធរួច តែឧបករណ៍ក្រៅបណ្ដាញ — លេខដែលអ្នកឃើញមិនទាន់សម័យ |
  | កំពុងចាប់ដៃជាមួយ Server | 🔄 កំពុងតភ្ជាប់ទៅ Server... |
  | ភ្ជាប់រួច តែ snapshot មិនទាន់មក | 🔄 ចូលប្រព័ន្ធរួច — កំពុងទាញទិន្នន័យ... |
  | listener ធ្លាក់ | ⚠️ ចូលប្រព័ន្ធរួច តែការទាញទិន្នន័យដាច់ — កំពុងព្យាយាមឡើងវិញ |
  | ភ្ជាប់រួច ហើយទិន្នន័យមកគ្រប់ | ✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ |

  ⛔ **«ភ្ជាប់រួច» មិនដូច «ទិន្នន័យមកដល់ហើយ»** — នេះជាចំណុចដែលរូបថតបង្ហាញ
  (តួលេខ 0 ទាំងអស់ ក្រោមសារជោគជ័យ)។ ZoeW អាន `dbListenerPendingPaths`
  ដូច្នេះវាបែងចែក ២ រឿងនោះពិតៗ។ Toast ដែលរស់ **តែងតែមានពេលកំណត់**
  (`TOAST_LIVE_LIMIT_MS` = ២០ វិ.) ➜ វាមិនអាចជាប់លើអេក្រង់ជារៀងរហូតទេ។

- **ZoeImport ៖ សូចនាករតំណក្នុងរបាខាងលើ** (មុននេះ **គ្មានសោះ**) ដែលប្តូរ
  realtime តាមអ្វីដែលកើតឡើងពិត៖ «មិនទាន់ភ្ជាប់» · «កំពុងទាក់ទង Sheet...» ·
  «ភ្ជាប់ Sheet រួចរាល់» · «ភ្ជាប់ Sheet មិនបាន» · «ក្រៅបណ្ដាញ»។ ការបាត់
  បណ្តាញផ្លាស់វាភ្លាម **ដោយមិនបាច់ Refresh** (វាស់ក្នុង Chromium ពិតដោយ
  `setOffline(true)`)។ ហើយពេលឧបករណ៍ក្រៅបណ្ដាញ `callApi()` **បដិសេធមុនចេញ
  ដំណើរ** ជាមួយសារច្បាស់លាស់ ជំនួសការទុកឲ្យសំណើអស់ពេល ៣០ វិនាទី។

### ឧបករណ៍ audit

- **`toast-truth-test.js` ថ្មី (៦៧ assertion, App ទាំង ៣)** — អះអាង **២ ខាង**
  ជានិច្ច ព្រោះការអះអាងម្ខាងបៃតងក្លែងក្លាយបាន៖ «toast ជោគជ័យជាពណ៌បៃតង» នៅ
  បៃតង បើ toast **ទាំងអស់** បៃតង; «ការប្រកាសស្មោះពេលក្រៅបណ្ដាញ» នៅបៃតង បើវា
  ស្មោះ ហើយ **មិនដែលកែខ្លួនវាឡើងវិញ**។ វារត់ **កូដពិតដែលស្រង់ចេញ** ធៀបនឹង
  **stylesheet ពិត** ក្នុង Chromium (អថេរ `let` កម្រិត module មិនស្ថិតលើ
  `window` ➜ ស្ថានភាពត្រូវចាក់ព័ទ្ធជុំវិញកូដពិត មិនមែនកេះតាម global ទេ)។
  ការរត់លើ `origin/main` មុនកែ៖ **៤៥ assertion ធ្លាក់** រួមទាំងការវាស់ពណ៌
  ស្លាកជាក់ស្តែង `rgb(16, 185, 129)` ដដែលទាំង ៤ ស្ថានភាព។

- `ZoeImport/test.js` (៥៥) និង `zto-import/test.js` (៥០) នៅបៃតងដដែល។
  `connection-recovery-test.js` និង `auth-recovery-test.js` ត្រូវបានធ្វើ
  បច្ចុប្បន្នភាពឲ្យស្រង់ helper ថ្មីចូល `vm` (ច្បាប់គម្រោង៖ បន្ថែម helper ➜
  បន្ថែមឈ្មោះក្នុងបញ្ជីស្រង់)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules **មិនប្រែសោះ** — `firebase-database.rules.json`
  និង `ZoeKeyGen/firebase-database.rules.json` ដដែលបេះបិទ។ គ្រាន់តែ deploy។

---

## [2.18.0] — 2026-08-26 · ធុងសំរាមរក្សាទុក ៣០ ថ្ងៃ · ដោះ deadlock ៣ ខាង

សំណើអ្នកប្រើ៖ **រយៈពេលរក្សាទុកធុងសំរាមឡើងពី ១៥ ➜ ៣០ ថ្ងៃ**។ ការស៊ើបអង្កេត
ជុំវិញផ្លូវនោះរកឃើញ **កំហុសផលិតកម្ម ៤** ដែលទាំងអស់មានភស្តុតាងវាស់បានលើ
**RTDB emulator ពិត ជាមួយ rules ពិត** — មិនមែនការសង្ស័យតាមការអានកូដទេ។

**គោលការណ៍ «លុប» ទល់នឹង «ដក» មិនប្រែសោះ។** តារាងសេណារីយ៉ូ ១០ ជួរនៅដដែល
បេះបិទ; ជួរ ៤ («ដក») និង ៨ («សម្អាត ៨ ថ្ងៃ») ជាជួរតែ ២ ដែលប៉ះលុយ ហើយជុំនេះ
**មិនប៉ះទាំង ២ ទេ**។ ការប្តូរស្ថិតនៅជួរ ១០ («លុបជាអចិន្ត្រៃយ៍ / purge») ដែល
**មិនប៉ះលុយ** ទាំងមុន និងក្រោយកែ។ `isDeducted` នៅតែជាវាល *តែមួយគត់*
ដែលកំណត់លុយ។

### ផ្លាស់ប្តូរ

- **ធុងសំរាមរក្សាទុក ៣០ ថ្ងៃ** ជំនួស ១៥ ថ្ងៃ (`TRASH_RETENTION_MS`) ➜ មានពេល
  ស្តារធាតុដែលលុបខុសយូរជាងមុនមួយដង។ អត្ថបទក្នុងប្រអប់ធុងសំរាម និងសារ
  «ជួរទៀត» ប្តូរតាមដែរ។
  វាស់ដំណើរការនៅ ២០០០ ធាតុ៖ render ធុងសំរាម **៩ ms** · ស្វែងរក **១២ ms** ·
  ការ render តារាងប្រវត្តិ **មិនប្រែសោះ** (១៧៤–១៨៧ ms ដូច tree មុនកែ) ➜
  ការទ្វេដងនេះ**មិនធ្វើឲ្យ App យឺតទេ**។

### កែកំហុស

- 🔴 **DEADLOCK ៣ ខាង ➜ ធាតុស្តារមិនបាន · លុបមិនបាន · ដោះមិនបាន ជារៀងរហូត។**
  `clearRestoreFinalization()` រត់ក្នុង `.catch(() => {})` ➜ បណ្តាញដាច់ភ្លាម
  ក្រោយស្តារ ➜ `zoew_restore_finalizations/<id>` នៅជាប់។ បើធាតុ **id ដដែល**
  ត្រូវលុប/ដកម្តងទៀត នោះវាស់បានលើ emulator ពិត៖ ការស្តារ **401** · ការលុប
  finalization ចាស់ **401** (ទាមទារធាតុធុងសំរាមលែងមាន) · ការលុបធាតុធុងសំរាម
  **401** (ទាមទារ finalization fence)។ ដូចគ្នាបេះបិទសម្រាប់ «លុបទាំងអស់»។
  ដោះដោយ **ដក `!data.exists()` ចេញពី rules ទាំង ២** — ការការពារ replay នៅ
  **រក្សាពេញលេញ** ព្រោះអ្វីដែលពិតជាទប់ replay គឺ «claim token ត្រូវនៅក្នុង
  ធាតុធុងសំរាម *មុន* update ហើយធាតុនោះត្រូវលុប *ក្នុង* update ដដែល»។
  វាស់លុយពិតជាមួយ `increment()` ពិត៖ ស្តារ `$0 → $5` (បូក ១ ដង) · replay
  **401 លុយមិនប្តូរ** · finalization ក្លែងក្លាយដោយគ្មាន claim **401**។
- 🔴 **ធាតុធុងសំរាមដែល `restoreClaim` ងាប់ មិនដែល purge ស្វ័យប្រវត្តិសោះ។**
  `runAutomaticDeletedCleanup()` រំលងធាតុណាដែលមាន `restoreClaim` **ដោយមិន
  ពិនិត្យថាវានៅរស់ឬអត់**។ ការរំលងនោះ *ចាំបាច់* (rules បដិសេធការលុបខណៈ claim
  ជាប់ — វាស់បាន 401) តែ **គ្មានអ្នកដោះ claim ងាប់ក្នុងផ្លូវស្វ័យប្រវត្តិ** —
  `releaseStaleRestoreClaimForPurge()` ហៅតែពេលអ្នកប្រើចុច ✖️ ដោយដៃ។ ផល៖
  ធាតុជាប់ក្នុង Firebase ជារៀងរហូត ហើយ **barcode របស់វាកក់ក្នុង
  `zoew_barcode_registry` ជារៀងរហូត** ➜ barcode ដដែលស្កេនចូលមិនបានទៀត។
- 🔴 **ការ purge ជាក្រុមជា atomic ➜ ធាតុ ១ ដែលមានបញ្ហា ធ្វើឲ្យធាតុស្អាតជាប់ដែរ។**
  វាស់បាន៖ ក្រុមមាន `id_a` (ស្អាត) + `id_b` (claim ជាប់) ➜ **ទាំង ២ មិនចេញសោះ**។
  ឥឡូវ claim ងាប់ត្រូវដោះជាមុន ហើយបើក្រុមធ្លាក់ ➜ ថយទៅលុបមួយៗ។ ផ្លូវផ្ទៃ
  ខាងក្រោយក៏ស្ងាត់ដែរ — toast លេចតែពេលបរាជ័យ **ទាំងស្រុង** មិនមែន N ដងទេ។
- 🔴 **ជណ្តើរផ្ទុក Firebase SDK គ្មានពិដានល្បឿន។** `retryFirebaseSdkNow()`
  ត្រូវហៅពី `online` និង `visibilitychange`; វា `clearFirebaseSdkRetry()` ដែល
  **reset ជណ្តើរ 5/10/20/30/60 វិ. មកសូន្យ** រួច `initFirebase()` ភ្លាមៗ។
  វាស់បាន៖ `online` បាញ់ ១០ ដងក្នុង ១ វិនាទី ➜ **១០ ការហៅ** ➜ ក្រោយកែ **១**។
  នៅតំបន់សេវាអន់ ការប្តូរ App ចេញចូលធ្វើឲ្យជណ្តើរ**មិនដែលឡើងផុត ៥ វិនាទី**
  ➜ ស៊ីថ្មនិងបណ្តាញជារៀងរហូត។ ថ្នាក់កំហុស **ដដែលនឹងកំណែ 2.14.0** តែរអិលកាត់
  ព្រោះការកែនោះប៉ះតែ listener មិនប៉ះ SDK loader។ កែ**ទាំង ២ App**។
  ការប្តូរ App រាល់ ១០ វិនាទីនៅតែឆ្លើយតបគ្រប់ដង ហើយការព្យាយាម**លើកដំបូង
  មិនត្រូវទប់** — «បណ្តាញត្រឡប់មក ➜ ព្យាយាមភ្លាម» នៅដដែល។

### ឧបករណ៍ audit

- **`emu/restore-deadlock-test.js`** (ថ្មី, ១២) — រត់ **rules ពិតលើ RTDB
  emulator ពិត**។ អះអាង ២ ខាង៖ finalization ចាស់មិនចាក់សោ id **និង** fence
  ប្រឆាំង replay នៅដដែល (replay · token ខុស · មិនលុបធុងសំរាម · បន្សល់ marker
  ➜ បដិសេធទាំងអស់)។ ធ្លាក់ ២ លើ `origin/main`។
- **`restore-marker-hygiene-test.js`** ១៩ ➜ **២៦** — សេណារីយ៉ូ ៥ ថ្មីរត់
  `runAutomaticDeletedCleanup()` **ពិត** ក្នុង `vm` ដែល `fb.update()` អនុវត្ត
  rules ដូច server (បដិសេធការលុបខណៈ claim ជាប់)។ ធ្លាក់ ២ លើ `origin/main`។
- **`connection-recovery-test.js`** ៧៦ ➜ **៨៥** — ពិដានល្បឿននៃ SDK loader,
  **ស្កេនទាំង ២ App** តាមមេរៀន «checker ស្កេនឯកសារណាខ្លះ»។ ធ្លាក់ ៣ លើ
  `origin/main`។
- **`restore-finalization-fence-test.js`** ១១ ➜ **១៦** និង
  **`clear-history-finalization-fence-test.js`** ១៨ ➜ **២២** — គំរូ rules ក្នុង
  ឯកសារទាំង ២ ត្រូវតម្រូវឲ្យត្រូវនឹង rules ថ្មី ហើយបន្ថែមការអះអាង**ឥរិយាបថ**
  ជំនួសការពិនិត្យអត្ថបទ។
- **`trash-modal-test.js`** ៥៣ ➜ **៥៦** — លេខថ្ងៃក្នុងកូដ **និងក្នុងអត្ថបទ UI**
  ត្រូវត្រូវគ្នា (បើឃ្លាតគ្នា អ្នកប្រើរង់ចាំខុសថ្ងៃ)។
- **`perf-check.js`** ៨ ➜ **១១** — seed ធុងសំរាមធ្លាប់ជា `{}` ➜ `buildTrashGroups()`
  · `trashItemTotals()` និង `renderRecentlyDeleted()` **មិនដែលត្រូវវាស់សោះ**។
  ចន្លោះដដែលនឹងមេរៀន «checker ស្កេនឯកសារណាខ្លះ» តែនៅលើទិន្នន័យ seed។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

⛔ **`firebase-database.rules.json` ត្រូវ paste ចូល Firebase Console ➜ Publish
មុន deploy។** បើមិនដូច្នេះ **deadlock ៣ ខាងនៅដដែល** — ធាតុដែលការស្តាររបស់វា
ធ្លាប់ដាច់ពាក់កណ្តាល នឹងស្តារមិនបាន និងលុបមិនបានជារៀងរហូត។ ការប្តូរមានតែ
២ បន្ទាត់ (`zoew_restore_finalizations` និង `zoew_clear_history_finalizations`)។
`ZoeKeyGen/firebase-database.rules.json` **មិនប្រែទេ**។

---

## [2.17.5] — 2026-08-26 · បិទចន្លោះដែលនៅសល់ពីជុំ 2.17.4

ជុំតាមដាន៖ បិទ**គ្រប់ចំណុច**ដែលជុំមុនរកឃើញ តែទុកចោល។ គ្មានការកែតក្កវិជ្ជា
អាជីវកម្មទេ ហើយ **ទម្រង់ · PTR · ចលនាផ្ទាំង · ការរមូរ មិនប៉ះសោះ**។

### សុវត្ថិភាព

- **ការលាក់ឈ្មោះ param ធ្លាប់ជាការប្រៀបធៀបពិតប្រាកដ ➜ ទម្រង់ camelCase និង
  hyphen រអិលកាត់ទាំងស្រុង។** វាស់បាន៖ `?sessionToken=` · `?clientSecret=` ·
  `?X-Api-Key=` · `?pin=` **មិនត្រូវលាក់សោះ**។ ឥឡូវ `isSecretParamName()`
  បំបែកឈ្មោះនៅព្រំដែន camelCase និង `_ - .` រួចប្រៀបធៀបជា **សមាសភាគដាច់
  ដោយឡែក**។ បន្ថែម `pin` និង `passcode` ក្នុងបញ្ជីពាក្យ។
- **Apps Script deployment ID ត្រូវលាក់ហើយ។** `https://script.google.com/macros/s/<ID>/exec`
  ជា **capability URL** — អ្នកណាមានវា ហៅ API បាន។ ឥឡូវ `/macros/s/[redacted]/`។
- ⛔ **គ្មានការលាក់លើសទេ** — `?spinner=` (`s|pin|ner`) · `?design=` (`de|sig|n`) ·
  `?keyboard=` (`key|board`) · `?barcode=` · `?phone=` · `?locker=` **នៅដដែល**
  ព្រោះគេត្រូវការវាដើម្បី debug។ មាន assertion ចាក់សោទាំង ២ ទិស។

### កែកំហុស

- **`.info/connected` គ្មាន error callback ➜ ស្ថានភាពអាចកក «បៃតង» ជារៀងរហូត។**
  បើ Firebase បោះបង់ listener នោះ `isDatabaseConnected` **កកនៅតម្លៃចុងក្រោយ**
  ➜ អ្នកប្រើឃើញ «ភ្ជាប់ Server រួចរាល់» ខណៈគ្មានការតភ្ជាប់។ ឥឡូវទាំង ២ App
  មាន error callback ដែលកំណត់ `isDatabaseConnected = false`, សរសេរ UI ឡើងវិញ
  និងកេះ watchdog។ *(ឱកាសកើតឡើងទាប — `.info/*` ជា path ក្នុងស្រុកដែលមិនឆ្លង
  កាត់ rules — ដូច្នេះវាជា guard អប្បបរមា **មិនមែនយន្តការស្តារ**; ការសាង
  យន្តការស្តារសម្រាប់ callback ដែលមិនដែលបាញ់ គឺជាកូដងាប់។)*

### ការសម្រេចដែលកត់ទុក — **កុំ «កែ» វានៅជុំក្រោយ**

- ⛔ **ផ្លូវ cache-miss របស់ `sw.js` ត្រូវនៅគ្មានពេលកំណត់។** ជុំនេះបានពិចារណា
  បន្ថែម timeout រួច **បដិសេធដោយផ្អែកលើការវាស់**៖ `CORE_SHELL` ប្រើ
  `addAll()` **atomic** ➜ ធនធានស្នូលមិនអាចបាត់ពី cache បានទេ; ហើយ
  `zxing_reader.wasm` = **១ ០៦៨ kB** ➜ **៣១ វិនាទីលើ 2G · ៥៣ វិនាទីលើ slow-2G**
  ដោយស្របច្បាប់។ timeout នឹង **សម្លាប់ការទាញធនធានដែលធ្វើឲ្យការស្កេនដើរ
  ក្រៅបណ្តាញ** — ថយក្រោយទៅថ្នាក់កំហុសដដែលដែល 2.10.0 ដោះស្រាយ។
- ⛔ **ការការពារ «inspect element» របស់ ZoeKeyGen ពង្រឹងមិនបានទេ។**
  `checkDevTools()` និងការទប់ F12 ជាការទប់ស្កាត់តាមទម្លាប់ — រំលងបានងាយ
  (DevTools ដាច់បង្អួច · `view-source:` · បិទ JS · Network tab)។ កូដដែលរត់
  ក្នុង browser របស់អ្នកប្រើ គឺជារបស់អ្នកប្រើ។ ការការពារពិតគឺអ្វីដែលមាន
  ស្រាប់៖ AES ដែល derive ពី PIN · session-only persistence · Firebase rules ·
  និង **signing key មិនដែលនៅក្នុង ZoeW សោះ**។

### ឧបករណ៍ audit

- **`ZoeImport/test.js` (៥៥) និង `zto-import/test.js` (៥០) ចូល `run-all.sh` ហើយ។**
  ពួកវាធ្លាប់នៅក្រៅ ដោយហេតុផលថា «មិនមែនជាផ្នែករបស់ App» — **ហេតុផលនោះលែង
  ស៊ីគ្នាហើយ** ព្រោះ ZoeImport ជា PWA ដែល ship ពិត ហើយ checker ១២ គ្របវារួច។
  ការទុកក្រៅមានន័យថា assertion ១០៥ រត់តែពេលមាននរណាម្នាក់ចាំវាយដោយដៃ។
  CI រត់ `run-all.sh` ➜ **គ្របស្វ័យប្រវត្តិឥឡូវនេះ**។
- `secret-hygiene.js` ៖ 37 ➜ **51 assertion** (ទម្រង់ camelCase/hyphen ·
  Apps Script ID · និង **ការមិនលាក់លើស ៦**)។ ធ្លាក់ ១៥ លើ tree មុនកែ។
- `adaptive-link-test.js` ៖ 37 ➜ **44 assertion** — ចាក់សោច្បាប់ «គ្មាន timeout
  លើផ្លូវ cache-miss» ជាមួយហេតុផលដែលវាស់បាន។
- **រត់ RTDB emulator ពិត** (ជុំមុនមិនបានរត់)៖ `crud-rules-flow.js` **៤៣** ·
  `emu/rules.sh` **២១** · `restore-marker-hygiene-test.js` **១៩** — បៃតងទាំងអស់។
- `run-all.sh` ➜ **៨៥ ពេញលេញ** (ពី ៨៣), ធ្លាក់ 0។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules **មិនប្រែទេ** (ផ្ទៀងផ្ទាត់លើ emulator ពិតរួច)។

---

## [2.17.4] — 2026-08-26 · ស្ថេរភាពបណ្តាញ · ការលាក់ secret ជ្រៅ · សម្របតាមតំណ

ជុំ deep audit ដែលផ្តោតលើ **បណ្តាញ និងសុវត្ថិភាព**។ កំហុសទាំង ៣ ខាងក្រោម
**បង្ហាញភស្តុតាងដោយការវាស់ក្នុង Chromium ពិត មុនកែ** ហើយមានឧបករណ៍ចាក់សោ
ឥឡូវនេះ។ តក្កវិជ្ជាអាជីវកម្ម (លុប/ដក · ធុងសំរាម · ការសម្អាត) **មិនប៉ះសោះ**
ហើយ **ទម្រង់ · PTR · ចលនាផ្ទាំង · ការរមូរ ក៏មិនប៉ះដែរ**។

### ល្បឿន និងស្ថេរភាពបណ្តាញ

- **សំណើ License លែងធ្វើឲ្យសំណើផ្សេងជាប់គាំងទៀតទេ។** `license-verify.js`
  គ្មានពិដានចំនួនសំណើស្របគ្នា និងគ្មាន guard ក្រៅបណ្តាញសោះ ខណៈ
  `window.addEventListener('online', …)` ហៅ `ZoeLicense.syncServerTime()`
  **គ្មានពិដានល្បឿន** (ការហៅ ៣ ផ្សេងទៀតក្នុង handler ដដែលទទួលពិដានក្នុង
  2.14.0 រួចហើយ)។ WiFi ដែលភ្លឹបភ្លែត ➜ `online` បាញ់ច្រើនដង ➜ សំណើ license
  ព្យួរស្របគ្នារហូតពេញកូតា connection របស់ browser។
  វាស់លើ Chromium ពិត (server ទទួលការតភ្ជាប់ តែមិនឆ្លើយ)៖

  | រង្វាស់ | មុនកែ | ក្រោយកែ |
  |---|---|---|
  | សំណើ **ចាំបាច់** លើ host ដដែល | **៩ ៦០៤ ms** | **៥ ms** |
  | សំណើ license ដល់ server (ពី ១០ ការហៅ) | **៧** | **១** |
  | ការហៅខណៈ `navigator.onLine === false` | **១០ ០០១ ms** | **០ ms** |

  ⛔ ការរំលងត្រឡប់ `{ ok: null }` (មិនផ្ទៀងផ្ទាត់បាន) — **មិនមែន `{ ok: false }`**
  ដែលនឹងលុប License ចោល។ ការអនុគ្រោះ ៣ ថ្ងៃនៅដដែលបេះបិទ
  (`license-grace-test.js` ១៣ assertion បញ្ជាក់)។ `activate()` ដែលអ្នកប្រើ
  ចុចផ្ទាល់ ឆ្លងកាត់ `{ priority: true }` ➜ **មិនត្រូវទប់ដោយពិដានឡើយ**។

- **សម្របតាមគុណភាពតំណ (ថ្មី)។** មុននេះ App សម្របតាម **ឧបករណ៍** រួចហើយ
  (ចង្វាក់ស៊ុម · `perf-lite` · ទទឹងស៊ុមស្កេន) តែ **មិនសម្របតាមតំណបណ្តាញទេ**។
  ឥឡូវ `linkIsFrugal()` អាន `navigator.connection` ហើយ **ការងារស្រេចចិត្ត**
  ឈប់ដោយខ្លួនឯងលើ **2G/slow-2G ឬពេលអ្នកប្រើបើក «Data Saver»**៖
  ការធ្វើឲ្យសំបកស្រស់ខាងក្រោយ (`revalidateShell()` — សំណើ ៨–១០ ក្នុងមួយការបើក
  ទំព័រ) និងការទាញតារាងអតិថិជនជាមុន។ **កំណែថ្មីនៅតែមកតាមផ្លូវ `CACHE_VERSION`
  ដដែល** ហើយទិន្នន័យអតិថិជននៅតែទាញតាមតម្រូវការដដែល — ដូច្នេះគ្មានមុខងារណាបាត់ទេ។
  ⛔ វា **fail open**៖ browser ដែលគ្មាន NetworkInformation API (**Safari/iOS —
  គ្មានទាល់តែសោះ**) ទទួលឥរិយាបថ **ដដែលនឹងមុនបេះបិទ**។

### សុវត្ថិភាព

- **បិទផ្លូវលេចធ្លាយ secret ទៅ Sentry ចំនួន ៥។** `redactEvent()` /
  `redactBreadcrumb()` ធ្លាប់ប៉ះតែវាល **ដែលដាក់ឈ្មោះទុកជាមុន**
  (`request.url` · `data.url` · `message` · `extra` ថ្នាក់ទី ១) ➜ វាលផ្សេងទៀត
  ដែល Sentry SDK បំពេញ **រអិលកាត់ស្ងាត់ៗ**។ វាស់បាន៖
  ១. **`crumb.data.arguments`** — Sentry 7 រក្សា argument **ឆៅ** របស់
  `console.error(...)`; App ហៅ `console.error("Lookup API error:", e)`។
  ២. **`request.headers.Referer`** — **Setup Link (`?setup=<config អាជីវកម្ម>`)
  អាចចេញពីឧបករណ៍**។ ៣–៥. `extra` ជាន់ជ្រៅ · array ក្នុង `extra` · `contexts`។
  ឥឡូវការលាក់ដើរលើ **គ្រប់ខ្សែអក្សរ** ជាមួយពិដានជម្រៅ ៦ · node ៥០០០ · និង
  ការការពាររង្វិលជុំ។ បន្ថែម៖ លាក់ **userinfo ក្នុង URL**
  (`https://user:pass@host`) និងឈ្មោះ param ថ្មី (`authorization` · `bearer` ·
  `jwt` · `credential` · `refresh_token` · `session_token` · `passphrase`)។
  ⚠️ `barcode=` និងលេខសម្គាល់ធាតុ **នៅតែមិនត្រូវលាក់** (ត្រូវការសម្រាប់ debug)។

### ឧបករណ៍ audit

- **`license-network-pressure-test.js` (ថ្មី, 14 assertion, browser ពិត)** —
  `network-pressure-test.js` **ជំនួស `license-verify.js` ដោយ stub ទាំងស្រុង**
  ➜ ផ្លូវបណ្តាញពិតរបស់ license **មិនដែលត្រូវវាស់សោះ**។ នេះជាមេរៀនដដែលនឹង
  `network-timeout-test.js` (2.12.1) និង `fluid-type-focus-test.js` (2.16.0)៖
  **ពេលសរសេរ checker ត្រូវសួរថា «វារត់/ស្កេនឯកសារ*ណា*ខ្លះ»។**
- **`adaptive-link-test.js` (ថ្មី, 37 assertion)** — ស្រង់ `revalidateShell()`
  និង `linkIsFrugal()` **ពិត** ចេញពី `sw.js` ដែល ship រួច (App ទាំង ៣) មករត់
  ជាមួយ `navigator` ក្លែងក្លាយ ៦ ប្រភេទតំណ។ ចាក់សោទាំង **ការរំលងលើ 2G/Data
  Saver** និង **ការ fail open លើ Safari**។
- **`secret-hygiene.js` ៖ 24 ➜ 37 assertion។** វាធ្លាប់សាកតែ `redactUrl()`
  ដែលជា function លើ **ខ្សែអក្សរតែមួយ** — **មិនដែលសាកការដើរលើ event ទេ**។
  ឥឡូវវាចាប់ `beforeSend`/`beforeBreadcrumb` **ពិត** តាម `Sentry.onLoad` រួច
  បញ្ជូន event ទម្រង់ Sentry 7 ពិតចូល។ ធ្លាក់ ៧ លើ tree មុនកែ។
- `license-grace-test.js` ៖ បន្ថែម `networkLooksDown`/`sharedRequest` ក្នុង
  បញ្ជីស្រង់ ➜ វានៅតែរត់កូដពិត។
- `run-all.sh` ➜ **៨៣ ពេញលេញ** (ពី ៨១), ធ្លាក់ 0។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules **មិនប្រែទេ** — មិនបាច់ publish អ្វីទេ។

---

## [ឧបករណ៍] — 2026-08-26 · នាឡិកា និងជម្រៅ fuzz

**មិនប្តូរកូដ App ទេ** — `APP_VERSION` នៅ `2.17.3` ដដែល ហើយ `CACHE_VERSION`
មិនប្រែ។ អ្នកប្រើមិនឃើញអ្វីខុសពីមុនទេ; អ្វីដែលប្រែគឺ **អ្វីដែលចាប់បាន
មុនពេលវាទៅដល់អ្នកប្រើ**។

### ឧបករណ៍ audit

- **`clock-hygiene.js` (ថ្មី, 26 assertion)** — ច្បាប់ «នាឡិកា server មិនមែន
  នាឡិកាឧបករណ៍» ធ្លាប់រស់នៅតែក្នុង `CLAUDE.md` ➜ **គ្មានអ្វីទប់ជុំក្រោយ** ពី
  សរសេរ `Date.now()` ក្នុងផ្លូវ retention។ បើវាកើតឡើង នោះទូរស័ព្ទដែលបិទ
  «កាលបរិច្ឆេទស្វ័យប្រវត្តិ» នឹងផ្លាស់កញ្ចប់ចូលធុងសំរាម ឬ **ដកលុយខុសពេល** ហើយ
  **Firebase rules ចាប់មិនបានទេ** ព្រោះ payload នៅត្រឹមត្រូវតាម schema។
  វាស្កេនតាម **AST** ដូច្នេះវាចាប់ **ទាំង `Date.now()` និង `new Date()`**
  (មេរៀនដែលកត់ទុករួចក្នុង `CLAUDE.md`) ហើយវាគ្រប **App ទាំង ៣ បូក
  `license-verify.js`** — មិនមែនតែ ZoeW ទេ។
  ផ្ទៀងផ្ទាត់ដោយ mutation ៤៖ `barcodeCloseIsRipe()` មិនអើពើ `now` ដែលបញ្ជូនមក ·
  `trashItem.deletedAt = Date.now()` · function ថ្មីប្រើ `new Date()` ·
  ធាតុ allowlist ដែលងាប់ — **ធ្លាក់ទាំង ៤**។
- **`revenue-fuzz-test.js` — op ថ្មី `sweepPickup`។** ការសម្អាតក្នុង fuzz ធ្លាប់
  ចាស់តែត្រាកម្រិត **កញ្ចប់** ➜ ផ្លូវ «កញ្ចប់លាយ» របស់កំណែ 2.17.2 (barcode មួយ
  បិទ · មួយបើក) **មិនដែលត្រូវរត់សោះ** ទោះវាជាកូដដែលថ្មីបំផុត និងជាកន្លែងដែល
  កំហុសផលិតកម្ម ២ ជុំចុងក្រោយកើតឡើង។ វាស់បាន៖ mutation ដែលប្តូរ
  `claimedPartial` ពី `ripeClosed` ➜ `keptBarcodes` **រស់រាន ២០ លំដាប់ × ៥៥
  ប្រតិបត្តិការ** លើឧបករណ៍ចាស់ ហើយ **ធ្លាក់ក្នុង ១២ លំដាប់ × ៤៥** លើឧបករណ៍ថ្មី។
- **រត់ជម្រៅលើកូដពិត៖ ៣៤ លំដាប់ × ៦០ ប្រតិបត្តិការ (seed 100–133) — គ្មាន
  invariant ណាបែក។** ដូច្នេះជុំនេះ **មិនរកឃើញកំហុសផលិតកម្មថ្មីទេ** — វាបិទ
  ចន្លោះនៃការគ្រប។
- `run-all.sh` ➜ **៨១ ពេញលេញ** (ពី ៨០), ធ្លាក់ 0។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។** Firebase rules មិនប្រែទេ។

## [ឧបករណ៍] — 2026-08-26 · CI ស្វ័យប្រវត្តិ

**មិនប្តូរកូដ App ទេ** — `APP_VERSION` នៅ `2.17.3` ដដែល។

### ឧបករណ៍ audit

- **`.github/workflows/audit.yml`** — រត់លើ **រាល់ PR** និងរាល់ push ចូល `main`៖
  - `firebase-rules` — បើក RTDB emulator ពិត រួចរត់ `emu/crud-rules-flow.js`
    (payload ពិត ធៀបនឹង `firebase-database.rules.json` ពិត) បូក `payload-schema.js` ·
    `rules-duplicate-keys.js` · `restore-marker-hygiene-test.js`
  - `audit-suite` — `run-all.sh` ពេញ រួមតេស្ត browser (Chromium)
- **`CRUD_FLOW_MIN_ASSERTS=43`** — សន្ទះការពារ «បៃតងក្លែងក្លាយ» ទី ២៖ បើចំនួន
  assertion ធ្លាក់ក្រោមកម្រិត នោះ CI ក្រហម **ទោះគ្មាន `fail`** ក៏ដោយ។ វាចាប់ករណី
  ដែលតេស្តត្រូវកាត់ចេញ ឬរត់មិនពេញដោយអចេតនា។
- **`CRUD_FLOW_STRICT=1`** — ធ្វើឲ្យការ **SKIP ក្លាយជាការធ្លាក់**។ បើ emulator មិនឡើង
  នោះ CI ត្រូវក្រហម — **កុំឲ្យបៃតងក្លែងក្លាយ** ដែលជាថ្នាក់កំហុសដដែលដែលធ្វើឲ្យ
  កំហុស 2.17.2/2.17.3 ship បាន។
- `emu/crud-rules-flow.js` បន្ថែមករណី **ការស្តារកំពុងដំណើរការ** (39 ➜ 43 assertion)
  ដែលបំបែកការការពារ ២ ជាន់ចេញពីគ្នា — មុននេះ `dropStaleRestoreMarkers()` លាក់
  ការធ្លាក់របស់ `stripHistoryOnlyMarkers()`។
- `CLAUDE.md` បន្ថែម **តារាងសេណារីយ៉ូពេញលេញ** (លុប · ដក · បិទ/បើក · សម្អាត ·
  ស្តារ · purge) ជាប្រភពការពិតតែមួយ តាមសំណើអ្នកប្រើ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន។**

## [2.17.3] — 2026-08-26

**កែកំហុសផលិតកម្មបន្ទាន់** — ក្រោយ 2.17.2 ការ **ស្តារ** ពីធុងសំរាមបរាជ័យដោយ
`PERMISSION_DENIED` ហើយធាតុនោះ **ស្ទួន** (នៅទាំងក្នុងប្រវត្តិ និងធុងសំរាម)
រួច «ដក» · «លុប» · «លុបជាអចិន្ត្រៃយ៍» លើធាតុនោះ **ស្លាប់ជារៀងរហូត**។
រកឃើញដោយការបង្កើតឡើងវិញលើ **RTDB emulator ពិត**។

### កែកំហុស

- **🔴 ការសម្អាតស្វ័យប្រវត្តិលួចដណ្តើមធាតុដែលកំពុងស្តារ។** កំណែ 2.17.2 ធ្វើឲ្យ
  ច្បាប់ ២ ម៉ោងបាញ់លើ **គ្រប់កញ្ចប់ចាស់** ដែលត្រូវការត្រា `closedAt` ➜ ឱកាស
  ជាន់គ្នាជាមួយការស្តារកើនឡើងខ្លាំង។ `runAutomaticCleanupRules()` និង
  `claimAndCleanupItem()` ធ្លាប់ការពារតែ `clearClaim` **មិនការពារ marker ស្តារ**
  (`restoreClaimId`/`restoreClaimToken`) ➜ ការសម្អាតអាចប្តូរ ឬលុបធាតុពាក់កណ្តាល
  ផ្លូវ ➜ ជំហានចុងក្រោយនៃការស្តារត្រូវ rules បដិសេធ។
  **អ្នកប្រើឃើញអ្វី៖** ស្តារ ➜ ធាតុចេញមកក្នុងប្រវត្តិ **តែមិនបាត់ពីធុងសំរាម**
  (ស្ទួនទាំង Barcode) ហើយស្ថិតិប្រចាំថ្ងៃប្រែខុស។ ឥឡូវការសម្អាត **រំលង**
  ធាតុដែលកំពុងស្តារទាំងស្រុង។

- **🔴 marker របស់ `scan_history` ធ្លាក់ចូលធុងសំរាម ➜ ធាតុនោះជាប់គាំងជារៀងរហូត។**
  `zoew_recently_deleted_cod_dod` មាន `$other: { ".validate": false }` ហើយ
  **មិនទទួល** `restoreClaimId` · `restoreClaimToken` · `clearClaim`។ ក្រោយការស្តារ
  បរាជ័យ marker ទាំងនោះនៅជាប់នឹងធាតុ ➜ រាល់ការ «ដក» ឬ «លុប» លើវាក្រោយមក
  ត្រូវបដិសេធទាំងមូល (toast «បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!»)។
  `buildClearHistoryTrashItem()` លុបវារួចហើយ តែ **ផ្លូវ ៣ ផ្សេងទៀតមិនលុប**។
  ឥឡូវទាំង ៤ ឆ្លងកាត់ `stripHistoryOnlyMarkers()` តែមួយ។

- **🔴 «លុបជាអចិន្ត្រៃយ៍» ✖️ មិនអាចលុបធាតុដែលការស្តាររបស់វាបរាជ័យ។**
  rules ហាមលុបធាតុដែលនៅមាន `restoreClaim` ➜ toast «លុបជាអចិន្ត្រៃយ៍មិនបានជោគជ័យ!»។
  ឥឡូវ `releaseStaleRestoreClaimForPurge()` ដោះ claim ដែល **ហួស lease ២ នាទី**
  ជាមុន (claim ដែលនៅរស់ — ឧបករណ៍ផ្សេងកំពុងស្តារ — នៅតែការពារដដែល)។

- **ការជួសជុលដោយខ្លួនឯង៖** `clearStaleRestoreMarkers()` បោស marker ដែលងាប់
  ចេញពីធាតុក្នុងប្រវត្តិដោយស្វ័យប្រវត្តិ ➜ **ធាតុដែលជាប់គាំងស្រាប់នឹងប្រើការវិញ
  ដោយខ្លួនឯង** ក្នុងរយៈពេលខ្លីក្រោយបើក App កំណែនេះ។

### ឧបករណ៍ audit

- **`restore-marker-hygiene-test.js`** (19 assertion) — ដកកូដពិតមករត់៖ ការសម្អាត
  មិនប៉ះធាតុដែលកំពុងស្តារ · marker ងាប់ត្រូវបោស · ផ្លូវសរសេរធុងសំរាមទាំង ៤
  លុប marker · purge ដោះ claim ងាប់ តែមិនដោះ claim រស់។
- **`emu/crud-rules-flow.js`** (39 assertion, ត្រូវការ RTDB emulator) — បើកកូដពិត
  ក្នុង `vm` ចាប់រាល់ការសរសេរ រួចចាក់វាទៅ emulator ដែលកំពុងអនុវត្ត rules ពិត។
  វាជាឧបករណ៍ដែល **រកឃើញកំហុសទី ៤** ៖ «ដក» លើកញ្ចប់ជាប់គាំង នៅតែត្រូវបដិសេធ
  ព្រោះការលុប marker ធ្វើតែលើ *ធាតុធុងសំរាម* មិនមែន *ធាតុដែលនៅសល់ក្នុងប្រវត្តិ*។
  ឥឡូវ `dropStaleRestoreMarkers()` ដើរក្នុងផ្លូវសរសេរប្រវត្តិទាំង ៤
  (ដក · បិទ barcode · បិទកញ្ចប់ · ស្កេនបញ្ចូល)។
- **`payload-schema.js` បន្ថែម *ទិសផ្ទុយ*** — មុននេះវាពិនិត្យតែថាផ្លូវស្តារ
  មិនបញ្ជូនវាលធុងសំរាមទៅ `scan_history`; **ទិសផ្ទុយបាត់** ➜ កំហុសនេះរអិលកាត់។
  ឥឡូវវាអះអាងថារាល់ផ្លូវសរសេរធុងសំរាមលុប marker របស់ `scan_history` ជាមុន។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules **មិនប្រែ** ក្នុងកំណែនេះ (rules ដែល publish រួច
  សម្រាប់ 2.17.2 ត្រឹមត្រូវហើយ)។ គ្រាន់តែ deploy និង Refresh App។

## [2.17.2] — 2026-08-26

**កែតាមរបាយការណ៍ពិតពីអ្នកប្រើ** — កញ្ចប់ដែលអតិថិជនយករួច តែជាប់ក្នុងបញ្ជីរាប់ថ្ងៃ។

### ផ្លាស់ប្តូរ

- **🔴 Barcode ដែលបិទ «យករួច» ចូលធុងសំរាមក្រោយ ២ ម៉ោង ដោយខ្លួនវាផ្ទាល់។**
  មុននេះច្បាប់ ២ ម៉ោងដើរនៅ **កម្រិតកញ្ចប់ទាំងមូល** — វាទាមទារឲ្យ barcode
  **គ្រប់មួយ** ក្នុងលេខទូរស័ព្ទនោះបិទជាមុនសិន។ ដូច្នេះលេខទូរស័ព្ទដែលមាន
  អីវ៉ាន់ ២ កញ្ចប់ ហើយអតិថិជនយកតែ ១ ➜ **កញ្ចប់ដែលយករួចជាប់ក្នុងបញ្ជីរហូតដល់
  ថ្ងៃទី ៨** (អ្នកប្រើរាយការណ៍ដោយភស្តុតាងរូបថត 2026-08-26)។
  **អ្នកប្រើឃើញអ្វី៖** ឥឡូវ barcode ដែលបិទ «យករួច» រលាយចេញពីបញ្ជីក្នុងរយៈពេល
  ២ ម៉ោងបន្ទាប់ ដោយមិនចាំបាច់រង់ចាំកញ្ចប់ដទៃទៀត; barcode ដែលមិនទាន់យក
  **នៅដដែល** ជាមួយនាឡិកា ៨ ថ្ងៃរបស់វាដែលមិនត្រូវ reset។
- **លុយមិនត្រូវប៉ះ។** barcode ដែលចេញតាមផ្លូវនេះទទួល `trashReason: 'pickup'`
  (ស្លាក «យករួច» ក្នុងធុងសំរាម) និង `isFromDeletion: true` — **គ្មានការដក
  ចំណូល** តាមគោលការណ៍ «លុប ទល់នឹង ដក»។ មានតែផ្លូវ ៨ ថ្ងៃ (`expired`)
  និង «ដក» ដោយដៃ (`remove`) ប៉ុណ្ណោះដែលដកលុយ។ ការស្តារពីធុងសំរាម
  ចាប់ផ្តើមនាឡិកា ២ ម៉ោងឡើងវិញ ដូច្នេះកញ្ចប់ដែលស្តារមិនត្រូវលោតចូល
  ធុងសំរាមវិញភ្លាមទេ។
- **ទិន្នន័យចាស់មិនបាត់ភ្លាម។** barcode ដែលបិទរួចមុនកំណែនេះ គ្មានត្រា
  `closedAt` ➜ ជុំសម្អាតដំបូងគ្រាន់តែ **បោះត្រា** ពេលបច្ចុប្បន្នឲ្យវា រួច
  វាចេញ ២ ម៉ោងក្រោយ។ គ្មានកញ្ចប់ណាបាត់ដោយភ្លាមៗទេ។

### បន្ថែម

- វាល `closedAt` ថ្មីក្នុង barcode នីមួយៗ (`barcodes/$idx/closedAt`) —
  កត់ត្រាថា barcode នោះត្រូវបានបិទ **ពេលណា**។ មុននេះមានតែម៉ោងបិទរបស់
  កញ្ចប់ទាំងមូល ដូច្នេះគ្មានផ្លូវដឹងអាយុនៃការបិទរបស់ barcode មួយៗឡើយ។

### ឧបករណ៍ audit

- **`partial-pickup-cleanup-test.js`** (48 assertion) — រត់ពេលវេលាពេញលេញ
  លើកូដពិត (`runAutomaticCleanupRules` · `claimAndCleanupItem`) ជាមួយ RTDB
  ក្លែងក្លាយ។ ចាក់សោ៖ barcode ដែលយករួច **មិនត្រូវដកលុយ** ពេលបងប្អូនរបស់វា
  ផុតកំណត់ ៨ ថ្ងៃ · barcode ដែលបិទចេញក្នុង ២ ម៉ោងដោយឯករាជ្យ · ត្រា
  `closedAt` សម្រាប់ទិន្នន័យចាស់ · ជុំសម្អាតទំនេរ **មិនសរសេរ** ចូល Firebase ·
  សេណារីយ៉ូគ្រប់គ្រង ៤។
- **`policy-test.js`** បន្ថែម ២ assertion — ការស្តារត្រូវ reset ត្រា
  `closedAt` របស់ barcode បើមិនដូច្នេះកញ្ចប់ដែលស្តារ **លោតចូលធុងសំរាមវិញភ្លាម**។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ⛔ **Firebase rules ត្រូវ publish មុនគេ។** `firebase-database.rules.json`
  បន្ថែម `closedAt` ក្នុង `barcodes/$idx` នៃ **ទាំង** `zoew_scan_history_cod_dod`
  និង `zoew_recently_deleted_cod_dod`។ ព្រោះ node ទាំងនោះមាន
  `$other: { ".validate": false }` នោះបើមិន publish ជាមុន **រាល់ការបិទ
  barcode នឹងត្រូវបដិសេធ (`permission_denied`)** ➜ ការបិទ «យករួច» លែងដំណើរការ។
  Copy ➜ Firebase Console (Project អាជីវកម្ម) ➜ Realtime Database ➜ Rules ➜ Publish។

## [2.17.1] — 2026-08-25

**ជុំ deep audit** — កែកំហុសផលិតកម្ម ៣ ដែលរស់នៅស្ងាត់ៗ ខណៈ audit ៧៥/៧៥ បៃតង។
មេរៀនរួម៖ **តេស្តជាមួយវត្ថុក្លែងក្លាយ ជោគជ័យក្លែងក្លាយ** — ការការពារតែមួយគត់
គឺប្រៀបធៀបនឹង **ផ្ទៃពិត** (SDK ដែល import ពិត, browser ពិត)។

### កែកំហុស

- **🔴 វដ្តភ្ជាប់ឡើងវិញ `goOffline()`+`goOnline()` មិនដែលរត់សោះលើផលិតកម្ម។**
  `firebase-loader.js` នាំចូល `goOnline` **តែភ្លេច `goOffline`** ➜ guard
  `typeof fb.goOffline === 'function'` មិនពិតជានិច្ច ➜ យន្តការ reset backoff
  ដែលឯកសារពិពណ៌នាយ៉ាងវែង និងដែល `connection-recovery-test.js` ចាក់សោដោយ
  ៧៦ assertion **ស្លាប់ស្ងាត់ៗ**។ តេស្តជោគជ័យព្រោះ fake SDK ផ្តល់ `goOffline` ឲ្យ។
  **អ្នកប្រើឃើញអ្វី៖** ក្រោយបាត់ WiFi យូរ ចំណុចក្រហម «ក្រៅបណ្ដាញ» អាចនៅ
  ជាងមួយនាទី ខណៈបណ្តាញត្រឡប់មកវិញហើយ។ ឥឡូវភ្ជាប់មកវិញលឿនដូចការរចនា។
  កែទាំង **ZoeW និង ZoeKeyGen**។

- **🔴 ការបើក App ក្រៅបណ្តាញ បង្ហាញប្រអប់ PIN សុំកំណត់ Config ឡើងវិញ។**
  SDK មកពី `gstatic.com` (origin ខាងក្រៅ) ➜ `sw.js` មិន cache វាដោយចេតនា ➜
  ការបើកក្រៅបណ្តាញធ្វើឲ្យ `waitForFirebaseSDK()` អស់ពេល ១៥ វិ. រួច reject ➜
  `catch` ចាត់ទុក **រាល់កំហុស** ជា «Config ខូច» ➜ បើកប្រអប់ PIN។
  **គ្រោះថ្នាក់៖** អ្នកប្រើអាចនឹងលុប ឬប្តូរ Config អាជីវកម្មរបស់ខ្លួនចោល
  ដោយគិតថា App ខូច។ ឥឡូវកំហុសនោះមាន `code = 'SDK_UNAVAILABLE'` ➜ App
  បង្ហាញ **«ក្រៅបណ្ដាញ»** បូក toast ហើយ **ព្យាយាមផ្ទុក SDK ឡើងវិញដោយ
  ស្វ័យប្រវត្តិ** (៥/១០/២០/៣០/៦០ វិ. បូកភ្លាមៗពេលបណ្តាញត្រឡប់មក ឬពេល
  ត្រឡប់ចូល App)។ កែទាំង ២ App។

- **🔴 កូនសោ merge របស់ធុងសំរាមអាចប៉ះទង្គិចគ្នា ➜ តួលេខលុយខុស។**
  កូនសោជា `[reason, phone, scanDate, time].join('~')` ➜ អតិថិជន ២ នាក់
  អាចធ្លាក់ចូលក្រុមតែមួយបើវាលណាមួយមាន `~` (rules ផ្ទៀងផ្ទាត់តែ `isString()`)។
  ឥឡូវ **length-prefix** ➜ ការប៉ះទង្គិចមិនអាចកើតឡើងតាមរចនាសម្ព័ន្ធ។

### ផ្លាស់ប្តូរ

- **ការស្វែងរកក្នុងធុងសំរាមលែងលុបស្ថានភាពពង្រីក** របស់ក្រុមដែលមិនត្រូវនឹង
  ការស្វែងរក (ការកាត់កូនសោធៀបនឹង **គ្រប់ក្រុម** មិនមែនក្រុមដែលត្រងរួច)។

### ឧបករណ៍ audit — ៣ ថ្មី

- **`sdk-surface.js`** — ប្រៀបធៀប `fb.X` ក្នុង `app.js` នឹងអ្វីដែល
  `firebase-loader.js` **នាំចូល និង export ពិត**។ វាជាឧបករណ៍ដែលចាប់
  `goOffline` ដែលបាត់។ អះអាង **២ ខាង**៖ គ្មាន `fb.X` ណាដែលបាត់ **និង**
  គ្មាន export ណាដែលមិនបាននាំចូល (ReferenceError ពេលផ្ទុក)។
- **`sdk-offline-boot-test.js`** — បើក App ក្នុង Chromium ពិត ដោយ **បិទ
  gstatic** (ដូចការបើកក្រៅបណ្តាញ) រួចអះអាងថា **ប្រអប់ PIN/Config មិនបើក**
  ហើយស្ថានភាពសរសេរ «ក្រៅបណ្ដាញ»។ លើ tree មុនកែ វាឃើញ `pinModalOpen: true`។
- **`html-sink-escaping.js`** — ស្កេន **គ្រប់ template literal ដែលមានស្លាក
  HTML** (មិនមែនត្រឹម sink ទេ — កូដនេះសាង HTML ក្នុងអថេរកណ្តាល) ហើយអះអាង
  ថារាល់ `${...}` ឆ្លងកាត់ `sanitizeInput()`/`escapeHtml()` ឬជាលេខ។
  បូកនឹងការអះអាងថា `sanitizeInput()` escape តួអក្សរគ្រប់ ៥ **តាមលំដាប់ត្រឹមត្រូវ**។

### បន្ថែម

- `network-timeout-test.js` ឥឡូវ **ស្កេន `ZoeImport/app.js` ផងដែរ** —
  ចន្លោះដដែលនឹងកំហុស ZoeKeyGen ក្នុង 2.12.1។ កូដពិតត្រឹមត្រូវ តែគ្មាន
  អ្វីចាក់សោវាទេរហូតដល់ឥឡូវ។
- `trash-modal-test.js` ៥០ ➜ **៥៣ assertion** (ការប៉ះទង្គិចកូនសោ + វិសាលភាព
  នៃការកាត់កូនសោ)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** — Firebase rules មិនប្រែក្នុងជុំនេះទេ។

---

## [2.17.0] — 2026-08-25 · ZoeImport [1.2.1]

**ជុំនេះជាការរៀបចំ UI តាមសំណើអ្នកប្រើ** — ធុងសំរាមក្លាយជាឧបករណ៍ពិនិត្យលុយ
ពេញលេញ ហើយទម្រង់បង្ហាញឆ្លាតតាមទំហំអេក្រង់ (ទូរស័ព្ទ · ថេប្លេត · កុំព្យូទ័រ)។

### ផ្លាស់ប្តូរ — អ្វីដែលអ្នកប្រើឃើញខុសពីមុន

- **ប៊ូតុង «🗑️ ធុងសំរាម» ផ្លាស់ចេញពីជួរប៊ូតុងខាងលើ ចូលក្នុងម៉ឺនុយ (...)** —
  វាឥឡូវនៅខាងក្រោម «💱 អត្រាប្រាក់» ក្នុងម៉ឺនុយដដែល។ ជួរខាងលើសល់តែ
  «📅 កញ្ចប់ប្រចាំថ្ងៃ» និង «📊 ស្ថិតិចំណូល» ➜ លែងកកកុញ។
- **ប៊ូតុង (...) ឥឡូវជាប់នៅជ្រុងស្តាំខាងលើនៃប្រអប់ប្រវត្តិ** —
  វាមិនរំកិលតាមប៊ូតុងផ្សេងទៀតទេ ដូច្នេះរកវាឃើញនៅកន្លែងដដែលជានិច្ច។
- **ប៊ូតុង ⋮ ក្នុងជួរដេកអតិថិជន ផ្លាស់ឡើងទៅជ្រុងស្តាំខាងលើនៃជួរនោះ** —
  ហើយប៊ូតុង «📞 ខល» និង «✅ បិទ» រំកិលមកជិតគ្នា (ចន្លោះ ៨px ➜ ៤px) ➜
  ជួរដេកមើលទៅស្រឡះជាងមុន។

### បន្ថែម — ធុងសំរាម

- **ប្រអប់ធុងសំរាមធំជាងមុន** ៖ ទូរស័ព្ទពេញទទឹងអេក្រង់ · កុំព្យូទ័រដល់
  ១១០០px ➜ អានងាយជាងច្រើន។
- **មានប្រអប់ស្វែងរក** ៖ វាយលេខទូរស័ព្ទ ឬ Barcode ➜ តារាង **និងតួលេខសរុប**
  ត្រងតាមភ្លាម។
- **ធាតុដែលមានលេខទូរស័ព្ទ · ថ្ងៃ · ម៉ោងស្កេន ដូចគ្នា ត្រូវ merge ជាជួរតែមួយ**
  ដែលបង្ហាញ **តម្លៃសរុប** និង **ចំនួនកញ្ចប់សរុប**។ ចុច «▼ N» ➜ បើកមើលធាតុ
  នីមួយៗ ដើម្បីស្តារ ឬលុបជាក់លាក់ (ប៊ូតុង 🔄 និង ✖️ នៅដដែល)។
- **តួលេខសរុបបែកជា ២ ក្រុមដាច់ពីគ្នា** ៖
  - **➖ ដក + ផុតកំណត់** — កញ្ចប់ដែល **ដកចេញពីស្ថិតិចំណូលរួចហើយ**
  - **✅ យករួច + លុប** — កញ្ចប់ដែល **មិនប៉ះស្ថិតិចំណូល**
  បូកនឹងបន្ទាត់ «សរុបទាំងអស់» ខាងក្រោម។
- **ស្លាកប្រភេទថ្មីលើជួរនីមួយៗ** ៖ `ដក` · `ផុតកំណត់` (កញ្ចប់ដែលហួស ៨ ថ្ងៃ) ·
  `យករួច` (បិទរួច ២ ម៉ោង) · `លុប`។ មុននេះមានតែ «លុបទាំងមូល / ដកកញ្ចប់»។
- **ធុងសំរាមរក្សាទុក ១៥ ថ្ងៃ** ជំនួស ១០ ថ្ងៃ ➜ មានពេលរកឃើញកំហុសយូរជាងមុន។

### ផ្លាស់ប្តូរ — ទម្រង់បង្ហាញឆ្លាតតាមឧបករណ៍

- **ទូរស័ព្ទ (<700px) មិនប្តូរអ្វីទាំងអស់** ក្រៅពីទីតាំង ⋮ និងធុងសំរាមខាងលើ។
- **ថេប្លេត និងទូរស័ព្ទផ្តេក (≥700px)** ៖ ទីតាំង · តម្លៃ · ចំនួនកញ្ចប់
  រៀបផ្តេកជាមួយគ្នា ➜ ជួរដេកទាបជាង ឃើញកញ្ចប់ច្រើនជាងក្នុងអេក្រង់តែមួយ។
- **កុំព្យូទ័រ (≥992px)** ៖ ព័ត៌មានអតិថិជនក៏រៀបផ្តេកដែរ ហើយទទឹងជួរឈរ
  សម្រួលឡើងវិញ ➜ **លែងមានចន្លោះទទេធំកណ្តាលជួរដេក**។
- **ទំហំអក្សរលើកុំព្យូទ័រឡើងជាខ្សែកោងរអិល** (១.២px នៅ 992px ➜ ១.៣៥px នៅ
  ១៦០០px) ជំនួសជំហានថេរតែមួយ ➜ អេក្រង់ធំអានកាន់តែងាយ។
- **ជួរឈរឆ្វេងរអិលតាមទទឹងអេក្រង់** (`clamp(340px, 27vw, 460px)`) ជំនួស
  ជំហាន 380px/420px។
- **អេក្រង់ធំជាង ១៧០០px ៖ ខ្លឹមសារឈប់លាតត្រឹម ១៦៦០px ហើយតម្រឹមកណ្តាល** ➜
  លែងអូសភ្នែកឆ្លងកាត់អេក្រង់ទាំងមូល។

### ឧបករណ៍ audit

- **ថ្មី ៖ `trash-modal-test.js`** (៥០ assertion) — ស្រង់តក្កវិជ្ជាធុងសំរាម
  **ពី `app.js` ពិត** រួចអះអាងថា៖ ផ្លូវសរសេរទាំង ៥ ដាក់ស្លាកត្រឹមត្រូវ ·
  ការស្តារលុប `trashReason` មុនសរសេរទៅ `scan_history` · rules ទទួលវាលនោះ ·
  ការ merge **មិនលាយប្រភេទ និងមិនធ្វើឲ្យធាតុណាបាត់** · តួលេខសរុប ២ ក្រុម
  ត្រូវនឹងអ្វីដែលកូដចំណូលពិតធ្វើ។ (ធ្លាក់ ១៨ លើ tree មុនកែ ➜ វាមិនទទេ។)
- `policy-test.js` និង `setup-link-logout-test.js` ធ្វើបច្ចុប្បន្នភាព marker
  និង state ដែលវាចាក់ចូល `vm` ដើម្បីឲ្យវាបន្តស្រង់ **កូដពិត** ចេញពី `app.js`។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ✅ **ធ្វើរួចហើយ** — `firebase-database.rules.json` ត្រូវបាន paste ចូល
  Firebase Console ➜ Publish **មុន** merge។ វាបន្ថែមវាល `trashReason` ក្នុង
  `zoew_recently_deleted_cod_dod/$itemId`; បើមិន publish ទេ
  `$other: { ".validate": false }` នឹងបដិសេធរាល់ការសរសេរទៅធុងសំរាម។

### ស្ថានភាព

> ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-25) — merge ចូល `main`
> ជា `f33062d`។ អ្នកប្រើបញ្ជាក់ថា **«ដំណើរការល្អ»**៖ ស្លាកធុងសំរាមទាំង ៤ ·
> តួលេខសរុប ២ ក្រុម · ការ merge · ការស្តារ និងលុប · **ទម្រង់ទូរស័ព្ទ
> មិនប្តូរសោះ** · ថេប្លេត និងកុំព្យូទ័រអានងាយ។

---

## [2.16.0] — 2026-08-25 · ZoeImport [1.2.0]

**ជុំនេះប៉ះ App ទាំង ៣។** ZoeImport ឡើងទៅ `1.2.0` ក្នុង commit ដដែល ព្រោះវា
ចូលរួមក្នុងមាត្រដ្ឋានអក្សរតែមួយជាមួយ ZoeW និង ZoeKeyGen។

### បន្ថែម — ZoeKeyGen មានទម្រង់បង្ហាញឆ្លាតតាមទំហំអេក្រង់
- មុននេះ ZoeKeyGen មាន breakpoint **តែមួយ** (`max-width: 480px` សម្រាប់
  `.form-grid`) ហើយ `.app-container` ចាក់ត្រឹម **780px** ➜ លើកុំព្យូទ័រ 1440px
  មាន **ចន្លោះទទេ ៦៦០px** ខណៈកាតទាំង ៤ ជង់លើគ្នាជាជួរតែមួយ។
- ឥឡូវចាប់ពី **900px** ឡើងទៅវាជា grid ២ ជួរ៖ «Signing Key» ពេញទទឹង ·
  **«បង្កើត Key ថ្មី» និង «បង្កើត Setup Link» ក្បែរគ្នា** · «បញ្ជី Key»
  ពេញទទឹង។ `max-width` ឡើងទៅ **1180px**។
- វាស់បាន៖ កម្ពស់ត្រូវរមូរ **1257 ➜ 1064px** និងតារាងបញ្ជី Key
  **718 ➜ 1098px** នៅ 1440px។ លើទូរស័ព្ទ **គ្មានអ្វីប្តូរសោះ**។

### កែកំហុស — `style.display` ក្នុង JS សរសេរជាន់ layout របស់ CSS
- `showApp()` ធ្លាប់សរសេរ `appContainer.style.display = 'flex'` ➜ inline style
  នោះ **ឈ្នះ `display: grid`** របស់ media query ➜ **grid មិនដែលដំណើរការសោះ**
  ខណៈ CSS មើលទៅត្រឹមត្រូវទាំងស្រុង។ ឥឡូវប្រើ class `hidden` ជំនួស
  (`display: none !important`) ដូច្នេះ CSS ជាម្ចាស់ layout តែម្នាក់។

### ផ្លាស់ប្តូរ — មាត្រដ្ឋានអក្សរតែមួយគ្រប់ App និងជំហាន desktop
- **`--fs-unit` ឥឡូវមាន ៣ តំបន់**៖ `1px` នៅ 320px · រីកដល់ `1.1px` នៅ 430px ·
  និង **ជំហាន `1.2px` ពេល layout បត់ជាជួរឈរច្រើន** (ZoeW ≥992px ·
  ZoeKeyGen និង ZoeImport ≥900px)។ អក្សរឥឡូវ **ដើរស្របនឹងទម្រង់បង្ហាញ** —
  អេក្រង់ធំដែលមានជួរឈរទូលាយ ទទួលអក្សរធំមួយកម្រិតទៀត។
- **ZoeImport ចូលរួមមាត្រដ្ឋានដដែល** — `clamp()` ដាច់ដោយឡែក ៦ កន្លែងរបស់វា
  ប្តូរទៅ `--fs-unit` (តម្លៃនៅ 320px ដដែលបេះបិទ)។
- **`:focus-visible` របស់ ZoeImport សរសេរជាទម្រង់ដដែលនឹង ២ App ទៀត** —
  តាម tag/attribute ជំនួសការរាយ class ម្តងមួយៗ ➜ ប៊ូតុងថ្មីទទួលរង្វង់ផ្តោត
  ដោយស្វ័យប្រវត្តិ ដោយមិនចាំបាច់ចាំបន្ថែមឈ្មោះ class។

### កែកំហុស — `font-size` ថេរ **៤៣ កន្លែង** ដែលរអិលចេញពីមាត្រដ្ឋាន
- កំណែ 2.15.0 ដាក់មាត្រដ្ឋានតែក្នុង `style.css` ➜ `style="font-size:10px"`
  ក្នុង **`index.html`** និងក្នុង template string របស់ **`app.js`** នៅតែថេរ
  ➜ ស្លាកទាំងនោះនៅតូចដដែលខណៈអក្សរជុំវិញរីក។ ឃើញច្បាស់លើ **តារាងស្ថិតិ
  COD/DOD**, ស្លាកម៉ោងក្នុងបញ្ជី Barcode និង label របស់ប្រអប់ Lookup API។
- បម្លែងអស់ហើយ៖ ZoeW `index.html` ២០ · ZoeW `app.js` ១៧ ·
  ZoeKeyGen `index.html` ៣ · ZoeKeyGen `app.js` ៣។

### ឧបករណ៍ audit
- **`fluid-type-focus-test.js` ៥៣ ➜ ៨១ assertions** — គ្រប **App ទាំង ៣**,
  ស្កេន **`style.css` · `index.html` · `app.js`** (មិនមែនតែ `style.css` ទៀតទេ)
  និងអះអាងជំហាន desktop ×1.2 នៅ breakpoint របស់ App នីមួយៗ។
  លើ tree មុនកែ វា **ធ្លាក់ ៣០ assertions**។
- **`layout-check.js` ៥៤ ➜ ៦៦ assertions** — បន្ថែមការអះអាង **ខាងទីពីរ**
  លើអេក្រង់ធំ៖ ខ្លឹមសារត្រូវប្រើទទឹងយ៉ាងតិច **900px** និងកាតត្រូវ **បត់ជា
  ជួរឈរច្រើន** ជាងលើទូរស័ព្ទ។ មុននេះ «គ្មានធាតុលើសអេក្រង់» តែម្យ៉ាង
  អនុញ្ញាតឲ្យ App នៅជាជួរឈរទទឹងទូរស័ព្ទលើកុំព្យូទ័រ **ដោយជាប់តេស្ត**។
  លើ tree មុនកែ វា **ធ្លាក់ ៤ assertions**។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន** — Firebase rules មិនប្រែទេ។ Netlify deploy ថត ZoeImport ដោយស្វ័យប្រវត្តិ។

---

## [2.15.0] — 2026-08-25

### បន្ថែម — អក្សររីកតាមទំហំអេក្រង់ (fluid type)
- មុននេះទំហំអក្សរទាំងអស់ជាលេខ `px` ថេរ ➜ ស្លាកអក្សរ ៩–១១px ដដែលនោះ
  លេចលើ iPhone 320px និងលើទូរស័ព្ទ 430px **ដូចគ្នាបេះបិទ** ទោះអេក្រង់ធំជាង
  ៣៥%។ ឥឡូវទំហំអក្សរគ្រប់កន្លែងគិតតាមឯកតាតែមួយ `--fs-unit` ដែលជា
  `clamp()` ➜ **អក្សររីករហូតដល់ ១០% តាមទទឹងអេក្រង់**។
- **នៅ 320px គ្មានអ្វីប្តូរសោះ** — អក្សរនៅទំហំដដែលនឹងកំណែមុនបេះបិទ ដូច្នេះ
  ទូរស័ព្ទតូចមិនរងផលអ្វីទេ។ នៅ 412px (ទូរស័ព្ទ Android ធម្មតា) អក្សរធំជាង
  មុន ~៨% ហើយចាប់ពី 430px ឡើងទៅវាឈប់រីក។
- ឥទ្ធិពលធំបំផុតលើ **តារាងប្រវត្តិ · ស្លាក Barcode · លេខស្ថិតិ** ដែលជា
  អក្សរតូចជាងគេ និងជាកន្លែងដែលអក្សរខ្មែរអានពិបាកជាងគេ។
- ZoeImport មានមាត្រដ្ឋានរបស់ខ្លួនតាំងពី `1.1.0` — ជុំនេះមិនប៉ះវាទេ។

### កែកំហុស — សញ្ញាផ្តោត (focus) សម្រាប់អ្នកប្រើក្តារចុច
- មុននេះ **ប៊ូតុងគ្មានសញ្ញាផ្តោតសោះ** ហើយប្រអប់វាយអត្ថបទក្នុង Modal
  (រួមទាំង **ប្រអប់ PIN**), ប្រអប់កាលបរិច្ឆេទ និង **ប្រអប់ម៉ាស៊ីនស្កេន
  hardware** មាន `outline: none` ដោយគ្មានអ្វីជំនួស ➜ អ្នកដែលដើរតាម
  ប៊ូតុងដោយ **Tab** មិនដឹងថាខ្លួនឈរនៅណា។ រឿងនេះប៉ះពាល់ពិត ព្រោះ
  **ម៉ាស៊ីនស្កេន barcode ជាឧបករណ៍ក្តារចុច**។
- ឥឡូវធាតុដែលផ្តោត **តាមក្តារចុច** ទទួលរង្វង់ `outline` ២px
  (`:focus-visible`) ហើយប្រអប់វាយអត្ថបទទទួលរង្វង់ពណ៌ជុំវិញស៊ុម។
- **ការចុចដោយម្រាមដៃ ឬម៉ៅស៍មិនបន្សល់រង្វង់ទេ** — នោះជាមូលហេតុដែលប្រើ
  `:focus-visible` ជំនួស `:focus` ➜ ការប្រើប្រាស់ប្រចាំថ្ងៃមើលទៅដដែល។

### ឧបករណ៍ audit
- ថ្មី៖ **`fluid-type-focus-test.js`** (53 assertions) — វាស់ក្នុង Chromium ពិត
  លើ ZoeW និង ZoeKeyGen៖ ជាន់ទាបនៅ 320px មិនតូចជាងមុន · អក្សររីក ៥–១០%
  នៅ 412px · ឈប់រីកចាប់ពី 430px · គ្មាន `font-size` ថេរជា px សល់វិញ ·
  គ្រប់ធាតុដែល Tab ទៅដល់មានសញ្ញាមើលឃើញ · ការចុចដោយម៉ៅស៍មិនបន្សល់រង្វង់។
  លើ tree មុនកែ វា **ធ្លាក់ ២៤ assertions**។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន** — ជុំនេះប៉ះតែ `style.css` របស់ App ទាំង ២ ប៉ុណ្ណោះ។
  Firebase rules មិនប្រែទេ។

---

## ZoeImport [1.1.0] — 2026-08-25

**ជុំនេះប៉ះតែ `ZoeImport` ប៉ុណ្ណោះ** — `APP_VERSION` របស់ ZoeW/ZoeKeyGen
នៅ `2.14.0` ដដែល។ ZoeImport មានកំណែដាច់ដោយឡែកព្រោះវាមិនប៉ះ Firebase
និងមិនពាក់ព័ន្ធនឹងវដ្តចេញផ្សាយរបស់ App ទាំង ២ នោះទេ។

### បន្ថែម — Credit tag និងកំណែនៅរបាខាងលើ
- របាខាងលើឥឡូវបង្ហាញ **«Powered By ZoeW»** ជាស្លាកមូល ហើយ **កំណែជាអក្សរតូច
  នៅក្រោមវា**។ កំណែលែងលាក់នៅក្នុងកាតដោះសោទៀតទេ — វាឃើញគ្រប់អេក្រង់។

### បន្ថែម — ចលនាពេលបើក App
- ដូច ZoeW និង ZoeKeyGen៖ ផ្ទាំងគ្របការលោតរបស់ UI ទទេ រួចរលាយចេញ ហើយ
  ខ្លឹមសារលេចមុខជាជំហាន។ វា `pointer-events: none` ជានិច្ច,
  `boot-flags.js` ថ្មីមានសំណាញ់សុវត្ថិភាព ៦ វិនាទី (បើ `app.js` ដួល),
  គ្មាន `transform` លើ chrome និងគោរព `prefers-reduced-motion`។
- App នេះ **គ្មានធនធានឆ្លង origin ក្នុង `<head>` សោះ** ➜ វាមិនអាចជាប់
  អេក្រង់សដោយសារ CDN ខាងក្រៅមិនឆ្លើយបានទេ។

### ផ្លាស់ប្តូរ — ទម្រង់បង្ហាញឆ្លាតតាមទំហំអេក្រង់

| អ្វី | មុន | ក្រោយ |
|---|---|---|
| កម្ពស់ទំព័រ | គណនា `100dvh - var(--navbar-h) - 60px` ដោយដៃ | `body` ជា flex column ➜ **លែងខុសពេលកម្ពស់របាខាងលើប្រែ** (safe-area · ពុម្ពអក្សរធំ · អក្សរ ២ ជួរ) |
| កាតដោះសោលើទូរស័ព្ទផ្តេក | តម្រឹមកណ្តាល ➜ **ផ្នែកខាងលើត្រូវកាត់ ហើយរមូរទៅមិនដល់** | `margin: auto` ➜ រមូរដល់គ្រប់ពេល |
| ការផ្គូផ្គង Column | flex-wrap ➜ ធាតុកំព្រានៅជួរចុងក្រោយ | CSS Grid `auto-fit` ➜ **១ ជួរឈរនៅ 320px · ២ នៅ 412px · ៤ នៅ ≥768px** |
| ប៊ូតុងលើអេក្រង់តូច | ទទឹងតាមអត្ថបទ | លាតបំពេញជួរ (គោលដៅចុចយ៉ាងតិច 44px) |
| តារាង preview | ជួរឈរច្របាច់រហូតអានមិនចេញ | `min-width` + រមូរផ្តេកខាងក្នុងស៊ុម + **ស្រមោលគែមបង្ហាញថារមូរបាន**; ក្បាលលេខតម្រឹមស្តាំដូចតម្លៃ |
| អេក្រង់ ≥900px | ជួរឈរតែមួយ ➜ ចន្លោះទទេពាក់កណ្តាលអេក្រង់ | ជំហាន ៤ និងកាតសម្អាត **ក្បែរគ្នា** |
| ទំហំអក្សរ | ថេរ 15px | `clamp(14.5px … 16px)` តាមទទឹងអេក្រង់ |
| ការរុករកតាមក្តារចុច | គ្មានវង់ focus លើប៊ូតុង | `:focus-visible` លើគ្រប់គោលដៅចុច |

ផ្ទៀងផ្ទាត់ដោយ `layout-check.js` លើ **320 · 360 · 412 · 768 · 1280 · 1440px** —
គ្មាន scroll ផ្តេក គ្មានធាតុលើសអេក្រង់ និង modal សមនឹងអេក្រង់គ្រប់ទំហំ។

### ឧបករណ៍ audit
- **`layout-check.js` ឥឡូវគ្រប ZoeImport ផងដែរ** (៣៦ ➜ **៥៤ assertions**)។
  វាក៏ **ដក class `hidden` ចេញមុនវាស់ modal** — បើមិនដូច្នេះ modal របស់
  ZoeImport (`display: none !important`) រអិលកាត់ការត្រួតពិនិត្យស្ងាត់ៗ។
- **`boot-animation-test.js` គ្រប App ទាំង ៣** (៥៣ ➜ **៧១ assertions**)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **Firebase rules៖ គ្មាន** — ZoeImport មិនប៉ះ Firebase ទាល់តែសោះ។
- Netlify នឹង deploy ថត `ZoeImport` ដោយស្វ័យប្រវត្តិ។

---

## ទម្លាប់គម្រោងថ្មី — សម្អាត comment ពេលចប់ការងារ (2026-08-25)

តាមសំណើអ្នកប្រើ៖ **រាល់ជុំ audit ឬការកែកូដ ពេលចប់ការងារត្រូវសម្អាត
comment ចេញពីកូដ App ដែល ship ទាំងអស់** (`ZoeW/` · `ZoeKeyGen/` ·
`ZoeImport/` — ទាំង `.js` និង `.css`)។ ចំណេះដឹងរស់នៅក្នុង **`CLAUDE.md`
និង `README.md`** មិនមែនក្នុងកូដទេ។

- ឧបករណ៍ថ្មី **`audit-tools/strip-comments.js`** ធ្វើវា **ដោយសុវត្ថិភាព**៖
  JS ឆ្លងការ diff **token-for-token** ក្រោយលុប comment; CSS ឆ្លងការ diff
  **declaration stream**។ ខុសមួយ token ➜ **បោះបង់ឯកសារនោះ** មិនសរសេរអ្វីទេ។
- **`comments.js` ឥឡូវអះអាងលទ្ធផលនោះ** លើកូដ App ដែល ship ទាំងអស់ (មុននេះ
  វាពិនិត្យតែ `app.js` និង `license-verify.js`)។
- ជុំនេះលុប comment **១៤៨** ចេញពី ៦ ឯកសារ (`sw.js` ×៣ · `style.css` ×៣)។
  ចំណេះដឹងទាំងអស់ត្រូវផ្លាស់ចូល `CLAUDE.md` ជាមុនសិន — មានផ្នែកថ្មី
  **«CSS invariant ដែលចាក់សោ»** ដែលរាយច្បាប់របស់ `style.css` ទាំង ZoeW
  និង ZoeImport ជាតារាង។
- **លើកលែង**៖ `audit-tools/` និង `*/test.js` (មិន ship ហើយ comment របស់ពួកវា
  ជាការពិពណ៌នាថ្នាក់កំហុសដែល `CLAUDE.md` យោងដល់ដោយផ្ទាល់) និង `vendor/`,
  `qrcode.js` (library ខាងក្រៅ)។

## README សរសេរឡើងវិញ (2026-08-25)

តាមសំណើអ្នកប្រើ៖

- **root · `ZoeW/` · `ZoeKeyGen/`** ➜ រៀបរាប់តែ **មុខងារ · កំណែ ·
  ប្រព័ន្ធសុវត្ថិភាព** ដោយ **មិនរៀបរាប់របៀបប្រើ**។
- **`ZoeImport/`** ➜ រៀបរាប់ **របៀបប្រើពេញលេញក្បោះក្បាយ** (ជំហានរៀបចំ,
  អេក្រង់នីមួយៗ, វាលនីមួយៗ, របៀបនាំចូល ៣, តារាងដោះស្រាយបញ្ហា) **និង
  ប្រព័ន្ធសុវត្ថិភាព** ពេញលេញ។

---

## [2.14.0] — 2026-08-25

**ការបើក App រលូន និងលែងជាប់អេក្រង់ស។** ជុំនេះបន្ថែម **ចលនាពេលបើក App**
តាមសំណើអ្នកប្រើ ហើយអំឡុងការសាងវា បានរកឃើញ **កំហុសធំបំផុតក្នុងជុំនេះ**៖
ធនធានឆ្លង origin ក្នុង `<head>` ទប់ការគូរ App ទាំងស្រុង។
គ្មានការប្ដូរឥរិយាបថអាជីវកម្ម (លុប/ដក/ចំណូល) ណាមួយឡើយ។ Firebase rules មិនប្រែទេ។

### ល្បឿន — App លែងឈរនៅអេក្រង់ស ពេល CDN ខាងក្រៅមិនឆ្លើយ

`sw.js` បោះបង់សំណើឆ្លង origin ដោយចេតនា (ច្បាប់ដែលចាក់សោតាំងពីកំណែ 2.6.1)
ដូច្នេះធនធានទាំងនោះ **មិនដែលចូល cache**។ ប៉ុន្តែ ២ ក្នុងចំណោមវាស្ថិតក្នុង
`<head>` **ជាធនធានទប់ការគូរ**៖

- `<script src="https://js.sentry-cdn.com/…">` — ទប់ **parser** ➜ `<body>`
  មិនទាន់សាងឡើងសោះ។
- `<link rel="stylesheet" href="https://fonts.googleapis.com/…">` — ទប់ **ការគូរ**។

លើបណ្ដាញ «ភ្ជាប់តែស្លាប់» (WiFi នៅតភ្ជាប់ តែគ្មានផ្លូវចេញ — ករណីដែលឯកសារ
គម្រោងកត់ត្រារួច) សំណើទាំងនោះមិនធ្លាក់ភ្លាមទេ **វាព្យួរ** ➜ អ្នកប្រើមើល
**អេក្រង់សទទេ** អស់រយៈពេលពេញនៃការព្យួរ ខណៈគ្រប់ឯកសាររបស់ App
នៅក្នុង cache រួចស្រេច។ វាស់លើ Chromium ពិត (host ខាងក្រៅព្យួរ ២០ វិនាទី)៖

| ស្ថានភាព | មុន | ក្រោយ |
|---|---|---|
| បណ្ដាញធម្មតា | ១៨៦ ms | ១៨៦ ms |
| `js.sentry-cdn.com` ព្យួរ | **២០ ២៥១ ms** | **២៤៩ ms** |
| `fonts.googleapis.com` ព្យួរ | **២០ ១៦៨ ms** | **២០០ ms** |
| ព្យួរទាំង ២ | **២០ ១៥៨ ms** | **១៩៥ ms** |

ដំណោះស្រាយ៖ `async` លើ script របស់ Sentry (វាមានផ្លូវផ្ទុកយឺតរួចហើយក្នុង
`error-reporting.js`) និង `media="print"` លើ stylesheet របស់ពុម្ពអក្សរ ដែល
`boot-flags.js` ប្តូរទៅ `all` វិញពេល DOM រួចរាល់។ វិធីនេះជា **CSP-safe**
(គ្មាន `onload=`) ហើយព្រោះ URL មាន `display=swap` ស្រាប់ អក្សរ swap ដូចមុនដដែល។
បើពុម្ពអក្សរមកមិនដល់ App ប្រើពុម្ពអក្សររបស់ឧបករណ៍ ហើយ **នៅដំណើរការគ្រប់មុខងារ**។

### បន្ថែម — ចលនាពេលបើក App (សំណើអ្នកប្រើ)

- ផ្ទាំងបើក App ថ្មីគ្របការលោតរបស់ UI ទទេ រួច **រលាយចេញ** ពេល App រៀបចំរួច។
  ខាងក្រោមវា របាខាងលើ ➜ ខ្លឹមសារ ➜ របា Tab លេចមុខជាជំហាន។
- ផ្ទាំងនេះ **មិនលេបការចុចទេ** (`pointer-events: none` ជានិច្ច) ➜ បើអ្នកប្រើ
  ចុចត្រង់កន្លែងប៊ូតុងពិត ការចុចនោះទៅដល់ប៊ូតុងពិត។
- **បើ `app.js` ដួល ផ្ទាំងនៅតែត្រូវដកចេញ** — `boot-flags.js` មានសំណាញ់
  សុវត្ថិភាព ៦ វិនាទី ដូច្នេះកំហុសណាមួយមិនអាចទុកអ្នកប្រើនៅក្រោមអេក្រង់សបានទេ។
- **ការទាញចុះដើម្បី Refresh (PTR) រំលងផ្ទាំង** — PTR ត្រូវនៅតែមានអារម្មណ៍ភ្លាមៗ។
- គោរព `prefers-reduced-motion`។ ចលនាទាំងអស់ជា `transform`/`opacity` ➜
  គ្មាន layout រាល់ស៊ុម ហើយ **គ្មាន `transform` លើ chrome របស់ App** ដូច្នេះ
  វាមិនប៉ះ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ (តំបន់ហាមចូល) ឡើយ។

### កែកំហុស — ការស្តារទិន្នន័យលែងបង្កើតរលកសំណើពេលបណ្ដាញរញ្ជួយ

`retryFailedDbListenersNow()` ត្រូវហៅពី **ព្រឹត្តិការណ៍ខាងក្រៅ ៣ កន្លែង** —
បណ្ដាញត្រឡប់មក, ត្រឡប់ចូល App វិញ, និង Firebase ភ្ជាប់មកវិញ។ មុននេះរាល់
ព្រឹត្តិការណ៍ **ភ្ជាប់ listener ទាំង ៦ ឡើងវិញភ្លាមៗ គ្មានពិដាន** ហើយវាក៏
reset ជណ្តើររង់ចាំមកសូន្យផង។ ពេលបណ្ដាញរញ្ជួយ ឬអ្នកប្រើប្តូរ App ចេញចូល
នោះក្លាយជា **រលកសំណើ** ដែលនីមួយៗទាញ node ពេញពី Server។ វាស់បាន៖

| សេណារីយ៉ូ | មុន | ក្រោយ |
|---|---|---|
| ព្រឹត្តិការណ៍ ១០ ដងក្នុង ១ វិនាទី | ១០ ជុំ (**៦០ សំណើ**) | **១ ជុំ** |
| ព្រឹត្តិការណ៍រៀងរាល់ ២ វិ. អស់ ៦០ វិ. | ៦០ ជុំ (**៣៦០ សំណើ**) | **២១ ជុំ** |
| ជណ្តើររង់ចាំធម្មតា ៦០ វិ. | ៤ ជុំ | **៤ ជុំ** (ដដែល) |

ការស្តារភ្លាមពេលបណ្ដាញត្រឡប់មក **នៅដដែល** — ពិដានទប់តែរលកប៉ុណ្ណោះ។

### កែកំហុស — Service Worker លែងស៊ីកូតាការតភ្ជាប់អស់

`revalidateShell()` (ការធ្វើឲ្យសំបកស្រស់ខាងក្រោយ) កេះ ១ សំណើក្នុង ១ ឯកសារ
នៃសំបក — ប្រហែល ៨–១០ ក្នុងការបើកទំព័រតែម្តង — ហើយវាជា `fetch()` ឆៅ
**គ្មានពេលកំណត់ គ្មានពិដាន**។ លើបណ្ដាញ «ភ្ជាប់តែស្លាប់» សំណើទាំងនោះព្យួរ
រហូតដល់ពេញពិដាន same-origin របស់ browser (៦) ➜ **គ្មានសំណើណាចេញបានទៀតទេ**
រួមទាំងអ្វីដែលចាំបាច់។ វាស់លើ Chromium ពិត (server ទទួលការតភ្ជាប់ តែមិនឆ្លើយ)៖

| អ្វី | មុន | ក្រោយ |
|---|---|---|
| សំណើថ្មីទៅដល់ server | **០ ដង** | ១ ដង |
| ពេលវេលារបស់សំណើថ្មី | **មិនដែលមកដល់** (អស់ ១២ វិ.) | **~៦ ms** |

ឥឡូវការធ្វើឲ្យស្រស់ប្រើ `AbortController` (៦ វិនាទី), មិនធ្វើស្ទួនលើកូនសោ
ដដែល និងកំណត់យ៉ាងច្រើន ៤ សំណើក្នុងពេលតែមួយ ➜ **ទុកកន្លែងទំនេរក្នុងកូតា
ជានិច្ច**។ កែទាំង ZoeW · ZoeKeyGen · ZoeImport។

### ផ្លាស់ប្តូរ — ចំណុចស្ថានភាពលែងប្រាប់ថា «ក្រៅបណ្ដាញ» ខណៈកំពុងភ្ជាប់

មុននេះស្ថានភាពមានតែ ២៖ ភ្ជាប់រួច ឬ «ក្រៅបណ្ដាញ»។ ព្រោះ Firebase រាយការណ៍
«មិនទាន់ភ្ជាប់» ភ្លាមៗពេលបើក App ហើយការចាប់ដៃគ្នាត្រូវការពេលខ្លះជាច្រើនវិនាទី
លើ 2G/3G នោះ **រាល់ការបើក App** និង **រាល់ការភ្ជាប់ឡើងវិញ** បង្ហាញចំណុចក្រហម
«ក្រៅបណ្ដាញ» ខណៈឧបករណ៍មានបណ្ដាញ ហើយ App កំពុងភ្ជាប់ធម្មតា។

ឥឡូវមាន **៤ ជំហាន**៖ «ភ្ជាប់ Server រួចរាល់» · **«កំពុងភ្ជាប់...»** (ចំណុច
លឿងកំពុងលោត) · «កំពុងភ្ជាប់ឡើងវិញ...» (listener ធ្លាក់) · «ក្រៅបណ្ដាញ»។
បើព្យាយាមអស់ប្រហែល ៣៥ វិនាទីនៅតែមិនបាន វាទទួលស្គាល់ថា «ក្រៅបណ្ដាញ» ដដែល
— ដូច្នេះវាមិនកុហកទាំង ២ ទិសទេ។ កែទាំង ZoeW និង ZoeKeyGen។

### សុវត្ថិភាព — ការត្រួតពិនិត្យ (គ្មានរន្ធថ្មី)

ការស្កេនពេញ App ទាំង ២ រកមិនឃើញផ្លូវ XSS ថ្មី ឬការលេចធ្លាយ secret ថ្មីទេ៖
គ្មាន `on*=` សល់, គ្មាន `eval`/`new Function`/`document.write`/`outerHTML`,
គ្មាន attribute គ្មានសញ្ញាសម្រង់, គ្មាន `href`/`src`/`style` ដែលបំពេញពី
ទិន្នន័យឆៅ (`href="tel:…"` មាន scheme ជាប់ជាអក្សរ) ហើយរាល់ការបញ្ចូលចូល
`innerHTML` ឆ្លង `sanitizeInput()` ឬជាលេខ។ កូនសោ AES របស់ Lookup API
នៅតែត្រូវលុបចេញពីសតិពេលចាកចេញដដែល។

### ឧបករណ៍ audit

- **ថ្មី `sw-revalidate-pressure-test.js`** — បម្រើ App លើ server ដែល
  **ទទួលការតភ្ជាប់ តែមិនឆ្លើយសោះ** រួចវាស់ថាតើសំណើ same-origin ថ្មីនៅតែ
  ទៅដល់ server បានឬទេ។ ថ្នាក់កំហុសនេះគ្មានឧបករណ៍ណាមើលពីមុនទេ។
- **ថ្មី `boot-animation-test.js`** — ចាក់សោលក្ខខណ្ឌរបស់ផ្ទាំង boot
  (រលាយចេញពិត · មិនលេបការចុច · សំណាញ់សុវត្ថិភាព · គ្មាន `transform` លើ
  chrome របស់ App) **និងវាស់ការគូរ App ខណៈ host ខាងក្រៅព្យួរ**។
- `connection-recovery-test.js` បន្ថែម ១៥ ការអះអាង (ពិដានរលកសំណើ និង
  ស្ថានភាព «កំពុងភ្ជាប់»)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **Firebase rules៖ គ្មាន** — rules មិនប្រែទេ។
- ⚠️ **ត្រូវសាកលើ deploy preview ពិត និងឧបករណ៍ពិតមុន merge។** ជុំនេះប៉ះ
  **ផ្លូវផ្ទុកធនធានឆ្លង origin** (Sentry និងពុម្ពអក្សរ) ហើយឯកសារគម្រោង
  កត់ត្រារួចថា បរិស្ថាន audit នៅទីនេះ **មិនអាចបង្កើតឥរិយាបថ CDN ពិត
  ឡើងវិញបានទេ**។ សូមពិនិត្យ៖ អក្សរខ្មែរបង្ហាញត្រឹមត្រូវ, ចលនា boot រលូន
  ទាំង iPhone និង Android, និង Sentry នៅតែទទួល event។

---

## [2.13.0] — 2026-08-25

**ការតឹងរឹងសុវត្ថិភាព និងការភ្ជាប់ Server លឿនជាងមុនលើបណ្ដាញយឺត។**
គ្មានការប្ដូរឥរិយាបថអាជីវកម្ម (លុប/ដក/ចំណូល) ណាមួយឡើយ។ Firebase rules មិនប្រែទេ។

### សុវត្ថិភាព — Browser លែងអនុញ្ញាតឲ្យកូដដែលចាក់ចូល HTML រត់បានទៀតទេ
- **ដក `'unsafe-inline'` ចេញពី `script-src`** របស់ ZoeW និង ZoeKeyGen។ មុននេះ
  បើអ្នកវាយប្រហារអាចដាក់អក្សរចូល HTML បាន នោះ browser **អនុញ្ញាតឲ្យវារត់**
  ហើយអ្វីដែលឃាត់វាគឺកូដ escape របស់យើងតែម្យ៉ាង។ ឥឡូវ **browser ខ្លួនឯង
  បដិសេធវា** — ក្លាយជាជាន់ការពារទី ២ ដែលឯករាជ្យទាំងស្រុង។
- ដើម្បីធ្វើដូចនោះបាន **attribute `onclick="…"` ទាំង ១០៩ កន្លែង** (ZoeW ៨៦,
  ZoeKeyGen ២៣) និង **១៩ កន្លែងក្នុងជួរដេកដែលបង្កើតដោយកូដ** ត្រូវប្តូរទៅ
  `data-act` + ការចាប់ព្រឹត្តិការណ៍កណ្តាល។ ការហៅត្រូវឆ្លងកាត់ **បញ្ជីដែល
  អនុញ្ញាត** ដូច្នេះ attribute ក្នុង HTML មិនអាចហៅ function ណាមួយតាមចិត្តបានទេ។
- **ថ្នាក់កំហុស «escape ២ ជាន់» លែងអាចកើតឡើងបានតាមរចនាសម្ព័ន្ធ។** មុននេះ
  លេខកញ្ចប់/លេខសម្គាល់ពី Server ធ្លាក់ចូល `onclick="fn('…')"` ដែល browser
  ឌិកូដ HTML **មុន** ប្រគល់ទៅ JavaScript ➜ `&#39;` អាចក្លាយជាសញ្ញាសម្រង់ពិត។
  ឥឡូវតម្លៃទាំងនោះជា attribute ធម្មតា ➜ **គ្មាន JavaScript ក្នុងផ្លូវនោះទៀតទេ**។
- `<script>` ខាងក្នុង `<head>` ផ្លាស់ទៅ `boot-flags.js` (ចូល cache ជាមួយសំបក)។
- **`style-src` នៅដដែល** ដោយចេតនា — មាន `style="…"` ជាង ១៩០ កន្លែង ហើយ
  គ្រោះថ្នាក់តិចជាង script ច្រើន។

### ល្បឿន — ភ្ជាប់ Server លឿនជាងមុនលើបណ្ដាញ 2G
- **ការព្យាយាមភ្ជាប់ឡើងវិញ លែងកាត់ផ្តាច់ការភ្ជាប់ដែលកំពុងដំណើរការ។** មុននេះ
  ៥ វិនាទីក្រោយបើក App ប្រព័ន្ធ **ផ្តាច់ ហើយចាប់ផ្តើមភ្ជាប់ឡើងវិញ** ដើម្បី
  ជម្រុញ Firebase។ លើបណ្ដាញលឿនវាមិនប៉ះអ្វីទេ តែលើបណ្ដាញយឺត **ការភ្ជាប់ដែល
  ជិតរួច ត្រូវសម្លាប់ចោល** ហើយត្រូវចាប់ផ្តើមសាជាថ្មី។ វាស់បាន៖

  | ការភ្ជាប់ត្រូវការ | មុន | ក្រោយ |
  |---|---|---|
  | ០,៥–៤ វិនាទី | ដដែល | ដដែល |
  | ៨ វិនាទី | ១៣,០ វិ. | **៨,០ វិ.** |
  | ១៥ វិនាទី | ៣០,០ វិ. | **១៥,០ វិ.** |
  | ២៥ វិនាទី | ៦០,០ វិ. | **២៥,០ វិ.** |

- ការជម្រុញនោះ **នៅតែធ្វើដដែល** ពេលវាមានប្រយោជន៍ពិត — គឺពេល WiFi ទើប
  ត្រឡប់មកវិញ ឬពេលធ្លាប់ភ្ជាប់រួចហើយដាច់។ វាស់បានថា **គ្មានសេណារីយ៉ូណា
  យឺតជាងមុនឡើយ**។
- អ្នកប្រើឃើញអ្វី៖ នៅកន្លែងសេរីសញ្ញាខ្សោយ ចំណុចស្ថានភាពប្តូរជា **«ភ្ជាប់
  Server រួចរាល់» លឿនជាងមុន** ជំនួសការភ្លឹបភ្លែតជាច្រើនវិនាទី។

### កែកំហុស
- `event.currentTarget` ក្នុង `toggleMoreDropdown()` និង `toggleHeaderMoreDropdown()`
  ត្រូវប្តូរទៅទទួលធាតុជាអាគុយម៉ង់ — បើមិនដូច្នេះម៉ឺនុយ (⋯) នឹងលោតខុសទីតាំង
  ក្រោមយន្តការចាប់ព្រឹត្តិការណ៍ថ្មី។
- ដក `bindClickBackup()` ចេញ — វាជាជាន់បម្រុងសម្រាប់ `onclick` ដែលលែងមាន
  ហើយបើទុកវា ប៊ូតុង ១០ (រួមទាំង **លុបជាអចិន្ត្រៃយ៍**) នឹងរត់ **ពីរដង**។

### ឧបករណ៍ audit — ២ ថ្មី (ការត្រួតពិនិត្យ ៦៩ ➜ ៧១)
- **`csp-enforced-test.js`** (៣៨) — បម្រើ App ជាមួយ **header CSP ពិតដកចេញពី
  `netlify.toml`** រួចអះអាងថាគ្មានការរំលោភ **ហើយប៊ូតុងនៅដើរ**។ តេស្តផ្សេង
  ទាំងអស់រត់ **គ្មាន CSP** ➜ នេះជាចន្លោះដែលធ្លាប់លាក់កំហុស `'wasm-unsafe-eval'`។
- **`reconnect-ladder-test.js`** (២១) — រត់កូដពិតធៀបនឹងគំរូនៃការតភ្ជាប់របស់
  Firebase រួចប្រៀបធៀប **កូដដែល ship រួច ធៀបនឹងឥរិយាបថចាស់ដោយផ្ទាល់**។
- `wiring.js` និង `inline-handler-xss-test.js` សរសេរឡើងវិញសម្រាប់ `data-act`;
  `connection-recovery-test.js` ៤៥ ➜ **៦១** assertions។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** Firebase rules មិនប្រែទេ។ (`netlify.toml` deploy ស្វ័យប្រវត្តិ
  ជាមួយ site — គ្មានអ្វីត្រូវ paste ដោយដៃទេ។)

---

## [2.12.1] — 2026-08-25

**App បើកភ្លាមទោះបណ្ដាញខ្សោយ ហើយការស្កេនលែងជាប់ពេល WiFi ស្លាប់។** ជុំនេះជា
ជុំកែកំហុសបណ្ដាញសុទ្ធសាធ — គ្មានមុខងារថ្មី និងគ្មានការប្ដូរឥរិយាបថអាជីវកម្ម
(លុប/ដក/ចំណូល) ណាមួយឡើយ។

### ល្បឿន — App បើកភ្លាម មិនរង់ចាំបណ្ដាញទៀតទេ
- មុននេះ រាល់ឯកសារ (`index.html`, `app.js`, `style.css`, …) **ប្រណាំងនឹង
  បណ្ដាញ ៣ វិនាទី** មុនទើបយកច្បាប់ចម្លងក្នុងឧបករណ៍មកប្រើ។ ព្រោះឯកសារទាំងនោះ
  ផ្ទុកបន្តបន្ទាប់គ្នា ការរង់ចាំនោះ **គុណតៗគ្នា**។ វាស់លើ browser ពិត
  (បណ្ដាញយឺត ៥ វិនាទី ហើយ**គ្រប់ឯកសារនៅក្នុងឧបករណ៍រួចស្រេច**)៖
  **៩,០ វិនាទី ➜ ០,០៧ វិនាទី** ដើម្បីបើក App។
- អ្នកប្រើឃើញអ្វី៖ ចុចរូប App ➜ **ឡើងភ្លាម** ទោះនៅកន្លែងសេរីសញ្ញាខ្សោយ
  ជំនួសអេក្រង់សរនឹងជាច្រើនវិនាទី។ កំណែថ្មីរបស់ App នៅតែមកដល់ដដែល
  (តាមផ្លូវ `CACHE_VERSION` — ផ្ទៀងផ្ទាត់ថាការ Refresh បន្ទាប់ទទួលកូដថ្មីភ្លាម)។
- ការធ្វើឲ្យស្រស់ធ្វើ **ខាងក្រោយ** ហើយ **រំលងទាំងស្រុងពេលក្រៅបណ្ដាញ** —
  លែងដាស់វិទ្យុ និងលែងស៊ីថ្មដោយឥតបានការ។

### កែកំហុស — សំណើកកកុញពេលបណ្ដាញ «ភ្ជាប់តែស្លាប់»
- **ការស្វែងរកអតិថិជនស្វ័យប្រវត្តិលែងកកកុញទៀតទេ។** WiFi ដែលភ្ជាប់បាន
  តែគ្មានអ៊ីនធឺណិត ធ្វើឲ្យសំណើ **ព្យួរ** មិនធ្លាក់ភ្លាម។ មុននេះការស្កេន
  នីមួយៗបើកសំណើថ្មីមួយ (ព្យួររហូតដល់ ៣១,៥ វិនាទី) ដោយគ្មានពិដាន ➜ ស្កេន
  ១៥ កញ្ចប់ ➜ សំណើព្យួរជាន់គ្នារហូតដល់ **ពេញកូតា connection របស់ browser**
  ➜ បន្ទាប់មក **គ្មានសំណើណាចេញបានទៀតទេ** (រួមទាំងការស្កេន និងការស្វែងរក
  បន្ទាប់)។ ឥឡូវយ៉ាងច្រើន **២ សំណើក្នុងពេលតែមួយ** ហើយ barcode ដដែល
  មិនបញ្ជូនស្ទួន។ វាស់លើ browser ពិត៖ ស្កេន ១៥ កញ្ចប់ ➜ **៥ សំណើ ➜ ១**។
- **ការទាញតារាងអតិថិជនជាមុន រំលងពេលក្រៅបណ្ដាញ** ជំនួសការព្យាយាមរាល់ ១៥ នាទី។

### កែកំហុស — ZoeKeyGen ៖ សំណើពិនិត្យសិទ្ធិ admin ដែល**បោះបង់មិនកើត**
- `readUserRoleViaRest()` ប្រើ `fetch()` **ឆៅ គ្មានពេលកំណត់ គ្មាន
  AbortController** ហើយអានតួចម្លើយ (`res.json()`) **ក្រៅបង្អួចការពារ**។
  Timer ៤៥ វិនាទីដែលមានស្រាប់ បញ្ឈប់តែការរង់ចាំ — **សំណើនៅរស់**។ ព្រោះ
  ការពិនិត្យនេះត្រូវព្យាយាមឡើងវិញរាល់ពេលត្រឡប់មក App និងរាល់ពេលភ្ជាប់
  Server បាន នោះសំណើព្យួរ **កកកុញមួយក្នុងមួយជុំរហូតដល់ Refresh** ព្រមទាំង
  យក ID token ជាប់ក្នុង URL ទៅជាមួយ។ ឥឡូវវាឆ្លងកាត់ `fetchWithTimeout()`
  ដដែលនឹង ZoeW (bytes ដដែល) ដែល **បោះបង់សំណើពិត** និងការពារការអានតួផង។
- នេះជាថ្នាក់កំហុសដដែលនឹង `license-verify.js` ក្នុងកំណែ 2.11.6។ វារស់រាន
  ព្រោះ `network-timeout-test.js` ស្កេនតែឯកសាររបស់ **ZoeW** ប៉ុណ្ណោះ។

### កែកំហុស — ប្រអប់ Config
- **ZoeW ៖ ចុច «រក្សាទុក និងភ្ជាប់» ➜ ធ្វើការភ្លាម។** មុននេះវារង់ចាំការ
  ភ្ជាប់ Sentry ឲ្យរួច (**រហូតដល់ ១០ វិនាទី** លើបណ្ដាញយឺត) **មុន** ទើប
  អានអ្វីដែលអ្នកវាយក្នុងប្រអប់ ➜ ប៊ូតុងមើលទៅដូចមិនដំណើរការ ហើយអក្សរដែល
  វាយអំឡុងនោះអាចត្រូវយកទៅរក្សាទុកជំនួសអ្វីដែលអ្នកឃើញពេលចុច។ ការព្រមាន
  អំពី Sentry នៅតែបង្ហាញដដែល តែឥឡូវមកក្រោយ។
  *(នេះជាចំណុច «ការងារដែលនៅសល់» ទាំង ២ ដែលកត់ត្រាទុកក្នុងជុំ 2.12.0។)*
- **ZoeKeyGen ៖ សារកំហុសត្រូវនឹងបញ្ហាពិត។** ពេលទំហំផ្ទុករបស់ browser ពេញ
  វាធ្លាប់និយាយថា «ការកំណត់រចនាសម្ព័ន្ធមិនត្រឹមត្រូវទេ!» (ខុសទាំងស្រុង)
  ហើយបោះបង់ដោយស្ងាត់។ ឥឡូវវាប្រាប់ត្រង់ថាទំហំផ្ទុកពេញ។

### សុវត្ថិភាព
- **មានតែឯកសាររបស់សំបក App ទេដែលអាចចូល Cache Storage បាន។** មុននេះ
  សំណើ same-origin **ណាមួយ** ដែលឆ្លើយតបជោគជ័យ ត្រូវរក្សាទុកក្នុង cache ➜
  endpoint ទិន្នន័យនៅថ្ងៃក្រោយនឹងធ្លាក់ចូល ហើយ **រស់រានក្រោយចាកចេញ**
  អានបានតាម DevTools — ជាថ្នាក់កំហុសដដែលនឹងការលេចធ្លាយ Setup Link ក្នុង
  កំណែ 2.11.6។ ឥឡូវព្រំដែនកំណត់ដោយបញ្ជីឯកសារសំបកច្បាស់លាស់។
- ការការពារ XSS លើប៊ូតុងក្នុងតារាង **ត្រូវបានផ្ទៀងផ្ទាត់ថាត្រឹមត្រូវរួចហើយ**
  (មិនមែនកំហុសថ្មីទេ) ហើយឥឡូវមានតេស្តចាក់សោវា — មើលផ្នែកឧបករណ៍ audit។

### ឧបករណ៍ audit — ៣ ថ្មី (ការត្រួតពិនិត្យ ៦៦ ➜ ៦៩)
- **`sw-shell-latency-test.js`** (២៦) — វាស់ការបើក App លើបណ្ដាញយឺត ៥ វិនាទី
  ខណៈ cache ពេញ ហើយអះអាងថាតិចជាង ២ វិនាទី; ព្រមទាំងអះអាងថា endpoint
  ទិន្នន័យ same-origin **មិនធ្លាក់ចូល Cache Storage**។
- **`network-pressure-test.js`** (១១) — បើក endpoint ដែល **ព្យួររហូត** រួច
  រាប់សំណើពិតដែលដល់ម៉ាស៊ីនបម្រើ ដើម្បីបញ្ជាក់ថាការស្វែងរកមិនកកកុញ។
- **`inline-handler-xss-test.js`** (១៨) — ចាក់ខ្សែអក្សរសត្រូវ ១០ បែប
  (`'`, `\`, `"`, `&#39;`, `<img onerror>`, `\u2028`, …) ចូលវាល `id`/`code`
  ដែល Firebase rules អនុញ្ញាតឲ្យជាខ្សែអក្សរអ្វីក៏បាន រួចអះអាង **២ ខាង**៖
  គ្មានកូដណារត់ **និង** ការចុចប៊ូតុងនៅតែបញ្ជូនខ្សែអក្សរដើមបេះបិទ។
- **`network-timeout-test.js`** ពង្រីកទៅ **ZoeKeyGen** — នេះជាចន្លោះដែល
  លាក់កំហុស `readUserRoleViaRest()` ខាងលើ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** Firebase rules មិនប្រែទេ។

---

## [2.12.0] — 2026-08-25

**បិទភ្ជាប់អ្វីដែល Firebase Console copy ឲ្យ ទាំងស្រុងបានតែម្តង។** មុននេះ
ការរៀបចំជំនួញថ្មីទាមទារឲ្យអ្នកលក់កែ snippet របស់ Firebase ដោយដៃទៅជា JSON
សុទ្ធជាមុនសិន — លុប `import`, លុប comment, លុប `const firebaseConfig =`,
លុប `;` រួចដាក់ quote លើ key គ្រប់មួយ។ ភ្លេចមួយណា ➜ «Firebase Config JSON
មិនត្រឹមត្រូវទេ!» ដោយមិនប្រាប់ថាខុសត្រង់ណា។

### បន្ថែម — ស្គាល់ទម្រង់ដែល Firebase Console ផ្តល់ឲ្យ
- ឥឡូវ **បិទភ្ជាប់ទាំងស្រុងបានតែម្តង** ទាំងក្នុង **ZoeKeyGen ➜ Setup Link**,
  **ZoeKeyGen ➜ Config** និង **ZoeW ➜ Config** — រួមទាំង `import … from …`,
  comment `//` និង `/* */`, `const firebaseConfig = { … };` និងបន្ទាត់
  `initializeApp(firebaseConfig)` ខាងក្រោម។
- ក៏ទទួល JSON ធម្មតា, key គ្មាន quote, single quote និង comma ចុងក្រោយដែរ។
- ក្រោយអាន វាសរសេរ **JSON ស្អាតត្រឡប់ចូលប្រអប់វិញ** ដូច្នេះអ្នកឃើញច្បាស់ថា
  អ្វីនឹងត្រូវរក្សាទុក ឬ encode ចូល Setup Link។
- **រក្សាតែវាលរបស់ Firebase** (`apiKey`, `authDomain`, `databaseURL`,
  `projectId`, `storageBucket`, `messagingSenderId`, `appId`,
  `measurementId`) — វាលផ្សេងត្រូវទម្លាក់ ហើយ **រាយប្រាប់ជា toast** មិនលេប
  ស្ងាត់ៗទេ។ នេះការពារកុំឲ្យសំរាមចូល Setup Link។

### កែកំហុស — សារកំហុសដែលប្រាប់ថាខុសត្រង់ណា
- ជំនួស «Firebase Config JSON មិនត្រឹមត្រូវទេ!» តែមួយ ដោយសារ ៥ បែបផ្សេងគ្នា។
- សំខាន់បំផុត៖ ពេល **`databaseURL` បាត់** វាឥឡូវប្រាប់ថា *Firebase មិនដាក់វា
  ក្នុង snippet ទេ បើមិនទាន់បង្កើត Realtime Database* — នេះជាមូលហេតុពិត
  ស្ទើរតែគ្រប់ករណី ហើយមុននេះគ្មានអ្វីបង្ហាញផ្លូវទាល់តែសោះ។

### សុវត្ថិភាព
- ការលុប comment ធ្វើដោយ **scanner ដែលដឹងពី string** មិនមែន regex ទេ។ ការលុប
  `//` ដោយ regex នឹង **កាត់ `databaseURL: "https://…"` ខូច** ➜ Config មើលទៅ
  ត្រឹមត្រូវ តែ App ភ្ជាប់ Database ខុស។ ការរាប់វង់ក្រចកក៏ដឹងពី string ដែរ
  ដូច្នេះ `}` ក្នុងតម្លៃមិនបំបែកការអានទេ។
- ការសរសេរចូល localStorage ក្នុង ZoeW ឆ្លងកាត់ `safeStoreSet()` ➜ ពេលអង្គចងចាំ
  ពេញ អ្នកប្រើឃើញសារ ជំនួសការបរាជ័យស្ងាត់ៗ។

### ឧបករណ៍ audit
- `firebase-config-paste-test.js` ថ្មី — ស្រង់ `normalizeFirebaseConfig()`
  និងអ្នកជំនួយ **ពិត** ចេញពី `app.js` **ទាំង ២ App** មករត់ក្នុង `vm`។
  **២៤ assertions** រួមទាំង `//` ក្នុង URL, `}` ក្នុង string, សារកំហុស
  `databaseURL` និងការអះអាងថា App ទាំង ២ ឲ្យលទ្ធផលដូចគ្នា។
  ផ្ទៀងផ្ទាត់ដោយ mutation ៨ ករណី — **ចាប់បាន ៨/៨**។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មានការប្តូរ Firebase rules ទេ។**
- Config ដែលរក្សាទុករួចលើឧបករណ៍ **មិនរងផលទេ** — ការប្តូរនេះប៉ះតែផ្លូវអានពេល
  បញ្ចូលថ្មីប៉ុណ្ណោះ។

---

## ឧបករណ៍ដាច់ដោយឡែក — `ZoeImport` + `zto-import` (2026-08-25)

> **គ្មានការឡើងកំណែ `APP_VERSION` ទេ** — ជុំនេះ **មិនប៉ះ `ZoeW/` ឬ `ZoeKeyGen/`
> សូម្បី byte តែមួយ**។ វាបន្ថែមតែថតថ្មី `zto-import/` ដែលដើរជាគម្រោង Google
> Apps Script ដាច់ដោយឡែក។ `CACHE_VERSION` ក៏មិនប្តូរដែរ ព្រោះគ្មាន asset static
> ណាមួយរបស់ App ប្រែឡើយ។

### បន្ថែម — នាំចូល Excel របស់ ZTO ចូល Sheet ដោយស្វ័យប្រវត្តិ
- មុននេះ ការបញ្ចូលទិន្នន័យអតិថិជនចូល Google Sheet `Customers` (ដែលដើរតួជា
  Lookup API របស់ ZoeW) ធ្វើឡើងដោយ **copy-paste ដោយដៃ** ពី file Excel ដែល
  export ចេញពី website ZTO។
- ឥឡូវមានផ្លូវ ២៖
  - **ទំព័រ Web** — បើក URL ➜ ទម្លាក់ file ➜ ឃើញ preview ➜ ចុច «នាំចូល»។
    ដើរគ្រប់ឧបករណ៍រួមទាំងទូរស័ព្ទ។
  - **Folder ស្វ័យប្រវត្តិ** — ទម្លាក់ file ចូល folder `ZTO-Inbox` ក្នុង Drive
    រួចហើយ; រៀងរាល់ ៥ នាទីវាបញ្ចូលទៅ Sheet ដោយខ្លួនឯង ហើយផ្លាស់ file ទៅ
    `ZTO-Done` (ឬ `ZTO-Failed` បើមានបញ្ហា)។
- វា **រក Column ដោយស្វ័យប្រវត្តិ** តាមឈ្មោះ header (អង់គ្លេស/ចិន/ខ្មែរ) ហើយ
  **ចងចាំការជ្រើសរបស់អ្នក** តាមទម្រង់ header — លើកក្រោយ file បែបដដែលមិនចាំបាច់
  កំណត់អ្វីទៀតទេ។
- **ផ្ទៀងផ្ទាត់លើឯកសារ export ពិតពី ZTO រួចហើយ** (2026-08-25)៖ header ខ្មែរទាំង ៤
  (`ស្កេនលេខបុងបញ្ញើ`, `ទឹកប្រាក់ដែលទូទាត់នៅពេលទំនិញដល់គោលដៅ`,
  `ប្រាក់ប្រមូលជំនួស`, `លេខទូរស័ព្ទអ្នកទទួលទំនិញ`) ត្រូវរកឃើញត្រឹមត្រូវ
  **ដោយមិនចាំបាច់ជ្រើសដោយដៃសោះ**។ ការនាំចូលឯកសារដដែលលើកទី ២ ➜ បន្ថែម ០ · កែ ០
  · ជួរដេកចាស់ត្រូវប៉ះ ០ (idempotent ពិត)។
- ZTO ដាក់ឈ្មោះឯកសារជា `.xls` តែខ្លឹមសារពិតជា `.xlsx` — អានបានធម្មតាទាំង ២ ផ្លូវ។
- ឯកសារ ZTO អាចមាន **Barcode ស្ទួនក្នុងខ្លួនវាផ្ទាល់** (ឃើញ ១ ក្នុងឯកសារសាកល្បង
  ៧៤ ជួរដេក)។ ការ paste ដោយដៃនាំវាចូល Sheet ទាំង ២ ជួរ; ឧបករណ៍នេះបញ្ចូលតែមួយ។
- របៀបនាំចូល ៣៖ «បន្ថែមថ្មី + កែអ្វីដែលប្រែ» (លំនាំដើម), «បន្ថែមតែ Barcode ថ្មី»
  និង «លុបទាំងអស់ រួចដាក់ថ្មីជំនួស»។
- ជួរដេកគ្មាន Barcode ត្រូវរំលង; Barcode ស្ទួនក្នុង file ដដែលយកជួរចុងក្រោយ;
  ការប្រៀបធៀប Barcode មិនប្រកាន់តួអក្សរធំតូច។
- **ជួរដេកដែលមិនពាក់ព័ន្ធមិនត្រូវប៉ះឡើយ** — ការសរសេរធ្វើតែលើជួរដេកដែលពិតជាប្រែ។

### បន្ថែម — `ZoeImport` ជា PWA ដំឡើងបាន
- ថតថ្មី `ZoeImport/` ជា **PWA ដាច់ដោយឡែក** (Netlify site ផ្ទាល់ខ្លួន) ដែល
  **ដំឡើងលើទូរស័ព្ទបានដូច ZoeW និង ZoeKeyGen** — manifest, Service Worker,
  icon និងការដើរក្រៅបណ្តាញ។
- SheetJS ស្ថិត **ក្នុង repo** (`ZoeImport/vendor/xlsx.full.min.js`) មិនមែន
  មកពី CDN ទេ — តាមច្បាប់ដដែលដែលនាំ ZXing ចូល repo។ សំបក App និងការអាន
  Excel ដើរបានក្រៅបណ្តាញ; មានតែការសរសេរចូល Sheet ទេដែលត្រូវការបណ្តាញ។
- **ប៊ូតុង «🗑️ សម្អាតទិន្នន័យក្នុង Sheet»** ថ្មី សម្រាប់លុបជួរដេកទាំងអស់
  ដោយទុកតែជួរ header — ព្រោះទិន្នន័យបញ្ចូលរាល់ថ្ងៃ។ វាសួរបញ្ជាក់មុនជានិច្ច
  ហើយត្រូវការ token បញ្ជាក់ខាង server ទើបដំណើរការ។
- **របៀបលំនាំដើមប្តូរទៅ «សម្អាតទិន្នន័យចាស់ រួចដាក់ថ្មីជំនួស»** តាមលំហូរ
  ការងារប្រចាំថ្ងៃ។

### ផ្លាស់ប្តូរ — ផ្លាស់ទី `google-sheets-api/`
- `ZoeW/google-sheets-api/` ➜ **`zto-import/google-sheets-api/`**។ វា **មិនមែន
  ជាផ្នែករបស់ static site របស់ ZoeW ទេ** — Netlify បម្រើថត `ZoeW` ទាំងមូល
  ដូច្នេះ `Code.gs`, `README.md` និង `customer-template.csv` ត្រូវបានបង្ហោះជា
  សាធារណៈលើ site របស់ ZoeW ដោយឥតប្រយោជន៍។ (គ្មានលេខសម្ងាត់ក្នុងនោះទេ —
  `API_KEY` ស្ថិតក្នុង Script Properties។)
- ឥឡូវគម្រោង Apps Script ទាំង ២ ដែលបម្រើ Sheet ដដែលនៅជាមួយគ្នា៖ ថត
  `zto-import/` **សរសេរចូល** Sheet ចំណែក `zto-import/google-sheets-api/`
  **អានចេញពី** វា។ **ខ្លឹមសារ `Code.gs` មិនប្រែសូម្បី byte តែមួយ** — ជាការ
  ផ្លាស់ទីសុទ្ធសាធ ដូច្នេះ **មិនចាំបាច់ Deploy Apps Script នោះឡើងវិញទេ**។
- `audit-tools/google-sheets-cache-test.js` ដើរតាមផ្លូវថ្មី។

### សុវត្ថិភាព
- **PIN តាមលំនាំដដែលនឹង ZoeW**៖ PBKDF2-SHA256 ១៥០,០០០ ជុំ (salt
  `zoeimport_pin_verify_v1`) ➜ រក្សាទុកតែ hash។ វាយខុស ៥ ដង ➜ ចាក់សោ ១ នាទី។
- **URL និងពាក្យសម្ងាត់របស់ Apps Script ត្រូវអ៊ិនគ្រីប AES-GCM 256** ដោយកូនសោ
  ដែល derive ពី PIN (salt `zoeimport_config_secret_v1`) មុនចូល localStorage —
  **គ្មានអ្វីស្ថិតជាអក្សរធម្មតាឡើយ**។ ប៊ូតុង 🔒 លុបកូនសោក្នុងសតិ និង secret
  ចេញពី DOM។
- ទទួលតែ URL ទម្រង់ `https://script.google.com/macros/s/…/exec` ➜ ពាក្យសម្ងាត់
  មិនអាចផ្ញើទៅ host ផ្សេងបានទេ។ CSP ជា `default-src 'self'` គ្មាន CDN។
- ឧបករណ៍ **fail closed**៖ បើ `IMPORT_PASSWORD` មិនបានកំណត់ក្នុង Script
  Properties វាបដិសេធរាល់សំណើ — ដូចលំនាំរបស់ `API_KEY` ក្នុង Lookup API ដែរ។
- ការនាំចូល ២ មិនអាចជាន់គ្នាបានទេ (`LockService`)។

### ឧបករណ៍ audit
- `zto-import/test.js` — ដកកូដពិតចេញពី `Code.gs` មករត់ក្នុង `vm` (មិនមែនកូដ
  ចម្លងទេ)។ **៥០ assertions** រួមទាំងការចាក់សោ header ខ្មែរពិតរបស់ ZTO។
  ផ្ទៀងផ្ទាត់ដោយ mutation — ការបង្ខូចកូដដែលមានន័យត្រូវចាប់បានទាំងអស់។
- `ZoeImport/test.js` — បើក **Chromium ពិត** ហើយដើរលំហូរទាំងមូល៖ PIN, lockout,
  ការបដិសេធ URL ក្រៅ `script.google.com`, ការអ៊ិនគ្រីប config, ការអាន Excel
  ដែលមាន header ខ្មែរពិត, ការសួរបញ្ជាក់មុន replace, ការនាំចូល, ការសម្អាត
  និងការលុប secret ចេញពី DOM ពេលចាក់សោ។ **៥៥ assertions**;
  mutation ១០ ករណី — **ចាប់បាន ១០/១០**។
- ឧបករណ៍ទាំង ២ **មិនស្ថិតក្នុង `run-all.sh`** ទេ ព្រោះវាមិនមែនជាផ្នែករបស់
  ZoeW/ZoeKeyGen។ រត់ដោយផ្ទាល់៖ `node zto-import/test.js` និង
  `node ZoeImport/test.js`។
  រត់៖ `node zto-import/test.js`។ វាមិនស្ថិតក្នុង `run-all.sh` ទេ ព្រោះវាមិនមែន
  ជាផ្នែករបស់ App។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មានការប្តូរ Firebase rules ទេ។**
- ដើម្បីប្រើឧបករណ៍ថ្មីនេះ ត្រូវ (១) រៀបចំគម្រោង Apps Script ម្តង — មើល
  [`zto-import/README.md`](zto-import/README.md) និង (២) Deploy ថត `ZoeImport`
  ជា **Netlify site ដាច់ដោយឡែក** (Base directory: `ZoeImport`) — មើល
  [`ZoeImport/README.md`](ZoeImport/README.md)។
- ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-25) — អ្នកប្រើរាយការណ៍ថា
  ការនាំចូលដើរលើ deploy ពិត។ ផ្លូវ cross-origin POST ជាមួយ
  `Content-Type: text/plain` លែងជាកូដដែលមិនទាន់សាកទេ។ **កុំប្តូរ header នោះ
  ឬបន្ថែម header ផ្ទាល់ខ្លួន** — វាកេះ preflight `OPTIONS` ដែល Apps Script
  មិនឆ្លើយ ➜ ការនាំចូលស្លាប់លើផលិតកម្ម ខណៈតេស្តក្នុង repo ជោគជ័យ។
- ចំណាំ៖ ក្រោយនាំចូល ZoeW អាចយឺតរហូតដល់ **៥ នាទី** ទើបឃើញទិន្នន័យថ្មី ព្រោះ
  Lookup API មាន `CACHE_TTL_SECONDS = 300` — នេះជាឥរិយាបថដែលមានស្រាប់ មិនមែន
  កំហុសថ្មីទេ។

---

## [2.11.6] — 2026-08-24

**បិទចន្លោះ ៥ ដែលធ្វើឲ្យ App បង្ហាញស្ថានភាពខុស ឬស៊ីបណ្តាញឥតប្រយោជន៍ ព្រមទាំង
ការលេចធ្លាយ Setup Link ១។** ជុំនេះកើតចេញពីសំណើអ្នកប្រើឲ្យធ្វើ Deep Audit លើ
*bug/race*, *ស្ថេរភាពបណ្តាញ* និង *សុវត្ថិភាព*។

### កែកំហុស — តារាងកកស្ងាត់ៗ ខណៈចំណុចស្ថានភាពនៅបៃតង
- ពេល Firebase **បោះបង់ listener** (ឧ. `permission_denied` ខណៈ token កំពុង
  ធ្វើឡើងវិញ ឬក្រោយប្តូរ rules) វា **មិនត្រឡប់មកវិញដោយខ្លួនឯងទេ**។ មុននេះ
  App គ្រាន់តែបង្ហាញសារ «សូម Refresh ទំព័រ» ១ ដង រួច **អង្គុយលើទិន្នន័យកក
  ជារៀងរហូត** ខណៈចំណុចស្ថានភាពនៅតែសរសេរ «ភ្ជាប់ Server រួចរាល់»។ អ្នកប្រើ
  បន្តស្កេន ដោយគិតថាតារាងទាន់សម័យ។
- ឥឡូវ៖ ចំណុចស្ថានភាពប្តូរជា **«កំពុងភ្ជាប់ឡើងវិញ...»** ភ្លាម; App
  **ព្យាយាមភ្ជាប់ listener ឡើងវិញដោយស្វ័យប្រវត្តិ** (២ វិ. ➜ ៥ ➜ ១០ ➜ ២០ ➜
  ៣០ វិ.) និង **ភ្លាមៗ** ពេលបណ្តាញត្រឡប់មក ឬពេលបើក App មកវិញ; ហើយពេលទិន្នន័យ
  មកគ្រប់វិញ វាប្រាប់ថា «✅ ទិន្នន័យភ្ជាប់មកវិញហើយ»។
- **ការសម្អាតស្វ័យប្រវត្តិ ២ម៉ោង/៨ថ្ងៃ/១០ថ្ងៃ ឈប់រត់** អំឡុងពេលនោះ ដើម្បី
  កុំឲ្យវាសម្រេចលើ snapshot ដែលកក។
- listener ដែលធ្លាក់ច្រើនក្នុងពេលតែមួយ ➜ **សារតែ ១** មិនមែន ៦ ដូចមុនទេ។

### កែកំហុស — ការភ្ជាប់ឡើងវិញយឺតដល់ជាងមួយនាទី
- ក្រោយបាត់ WiFi យូរ Firebase រង់ចាំតាម backoff ផ្ទាល់ខ្លួន ➜ ពេលបណ្តាញ
  ត្រឡប់មក ការហៅ `goOnline()` ធម្មតា **មិន reset ការរង់ចាំនោះទេ** ➜ អ្នកប្រើ
  អាចអង្គុយមើលចំណុចក្រហមរហូតដល់ជាងមួយនាទី ខណៈបណ្តាញដើរធម្មតាហើយ។
- ឥឡូវពេលដាច់ ហើយឧបករណ៍មានបណ្តាញ App ធ្វើវដ្ត `goOffline()`+`goOnline()`
  ដែល **reset backoff** ភ្លាម បូក watchdog ដែលព្យាយាមម្តងទៀតតាម ៥/១០/២០/៤០/៦០
  វិនាទី រហូតដល់ភ្ជាប់បាន។ វាមិនធ្វើទេពេលគ្មានបណ្តាញ (កុំឲ្យស៊ីថ្ម)។
- **ZoeKeyGen ទទួលយន្តការដដែល** — មុននេះវាគ្មានការស្តារការតភ្ជាប់សោះ ហើយ
  ចំណុចស្ថានភាពរបស់វាមិនរាប់បញ្ចូល `navigator.onLine` ➜ វាបង្ហាញ «ភ្ជាប់បណ្ដាញ»
  ខណៈគ្មានបណ្តាញពិត។

### កែកំហុស — ការផ្ទៀងផ្ទាត់ Activation Key អាចព្យួររហូត
- `license-verify.js` លុប timer បោះបង់ភ្លាមពេល **header** មកដល់ ➜ ការអានតួ
  (`res.json()`) នៅសល់ **គ្មានអ្វីការពារ**។ Server ដែលផ្ញើ header រួចឈប់
  (captive portal, បណ្តាញ mobile ដែលដាច់ពាក់កណ្តាល) ធ្វើឲ្យសំណើនោះព្យួររហូត។
  ព្រោះការពិនិត្យ Key ដើរតាមកាលវិភាគ សំណើព្យួរ **កកកុញមួយក្នុងមួយជុំ**
  រហូតដល់ Refresh។
- ឥឡូវ timer រស់រហូតដល់ **អានតួចប់** ហើយ abort សំណើពិត។

### សុវត្ថិភាព — Setup Link លែងជាប់ក្នុងឧបករណ៍
- Service Worker ធ្លាប់ប្រើ **URL ពេញ** ជាកូនសោ cache ➜ ការបើក Setup Link
  (`/?setup=<config អាជីវកម្ម>`) ដាក់ URL នោះចូល **Cache Storage**។
  `history.replaceState()` លុបវាចេញពីរបា address តែ **មិនប៉ះ cache** ➜
  payload នៅរស់ក្រោយចាកចេញ ហើយអានបានតាម DevTools ➜ Application ➜
  Cache Storage ដោយមិនចាំបាច់ដឹង PIN។ នេះផ្ទុយនឹងច្បាប់ «Setup Link មិនត្រូវ
  រស់រានក្រោយចាកចេញ»។
- ឥឡូវសំណើ navigate ប្រើកូនសោ `./index.html` **ជានិច្ច** ➜ គ្មាន query string
  ចូល cache ទៀតទេ។ ការដំណើរការក្រៅបណ្តាញនៅដដែល (មានតេស្តបញ្ជាក់)។

### ល្បឿន — ស៊ីទិន្នន័យចល័តតិចជាងមុន
- App ធ្លាប់ពិនិត្យកំណែ Service Worker **រាល់ពេលប្តូរ App** (`visibilitychange`
  **និង** `focus` ➜ ២ សំណើក្នុងមួយដង)។ ឥឡូវយ៉ាងច្រើន ១ ដងក្នុង ១៥ នាទី
  ហើយ **មិនព្យាយាមទាល់តែសោះពេលគ្មានបណ្តាញ**។ ការពិនិត្យក៏កើតឡើងពេលបណ្តាញ
  ត្រឡប់មកវិញដែរ ➜ កំណែថ្មីមកដល់មិនយឺតជាងមុនទេ។

### ឧបករណ៍ audit
- **`connection-recovery-test.js`** (ថ្មី, ៤៥ assertions) — listener ដែលត្រូវ
  បោះបង់, ការស្តារតាម backoff, សារតែមួយ, ការសម្អាតដែលត្រូវឈប់, វដ្ត
  reset backoff, watchdog និងការសម្អាតស្ថានភាពពេលចាកចេញ។
- **`sw-cache-key-test.js`** (ថ្មី, ១៤ assertions) — ចុះឈ្មោះ SW ពិតក្នុង
  Chromium, បើក Setup Link ពិត រួច **អាន Cache Storage ដោយផ្ទាល់** ដើម្បី
  បញ្ជាក់ថាគ្មាន payload ជាប់; ហើយបញ្ជាក់ថាក្រៅបណ្តាញនៅដំណើរការ។
- **`network-timeout-test.js`** ពង្រីកគ្របដណ្តប់ `license-verify.js` ផងដែរ
  (ស្តាទិច + ម៉ាស៊ីនបម្រើពិតដែលផ្ញើ header រួចឈប់)។
- `license-grace-test.js` ធ្វើបច្ចុប្បន្នភាពឲ្យស្រង់ helper បណ្តាញថ្មីផង។
- `shared-fns.js` — បន្ថែម ៣ function ក្នុងបញ្ជីបែកគ្នាដោយចេតនា ព្រមទាំង
  ហេតុផលសរសេរជាប់ (យន្តការភ្ជាប់ឡើងវិញនៅតែរួមគ្នាបេះបិទ)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន** — Firebase rules មិនប្រែទេ។

---

## [2.11.5] — 2026-08-24

**បិទ race ៦ ក្នុងផ្លូវរាយការណ៍កំហុស និងផ្លូវរក្សាទុក ព្រមទាំងចន្លោះ
ស្ថានភាពការតភ្ជាប់មួយ។** ជុំនេះកើតចេញពីសំណើអ្នកប្រើឲ្យពិនិត្យ *គ្រប់ចំណុច
នៃ race* និង *ចន្លោះ network connection*។

### កែកំហុស — ការរក្សាទុកដែលធ្លាក់ លុបការងារឧបករណ៍ផ្សេងចេញពីអេក្រង់
- ពេលការរក្សាទុកកញ្ចប់បរាជ័យ ការសង្គ្រោះ **ស្តារបញ្ជីប្រវត្តិទាំងមូល**
  ពីច្បាប់ចម្លងដែលថតទុក **មុន** ការរង់ចាំ។ បើឧបករណ៍ផ្សេងបញ្ចូលកញ្ចប់ក្នុង
  អំឡុងនោះ (រឿងធម្មតានៅថ្ងៃមមាញឹក) នោះកញ្ចប់របស់គេ **បាត់ពីអេក្រង់**។
  វាត្រឡប់មកវិញតែពេលមានការផ្លាស់ប្តូរបន្ទាប់ពី server ➜ អាចជាច្រើននាទី។
  ឥឡូវការសង្គ្រោះដក **តែ barcode ដែលធ្លាក់** ចេញពីបញ្ជីបច្ចុប្បន្ន។
- ថ្នាក់កំហុសដដែលនៅក្នុងការលុបជាអចិន្ត្រៃយ៍ (ធុងសំរាម) — កែដូចគ្នា។
- **គ្មានផលប៉ះពាល់លើលុយទេ** — ចំណូលដើរតាមផ្លូវ transaction ដាច់ដោយឡែក
  ដែលមិនប្រែ។ អ្វីដែលខុសគឺ *អ្វីដែលអ្នកប្រើឃើញ* ប៉ុណ្ណោះ។

### កែកំហុស — ការរាយការណ៍កំហុសស្ងាត់ជាងការពិត
- **បណ្តាញយឺត ➜ កំហុសបាត់ស្ងាត់ៗ។** បើ Sentry មកដល់យឺតជាងបង្អួចរង់ចាំ
  នោះវាត្រូវបោះបង់ ប៉ុន្តែ script នៅបន្តផ្ទុក ➜ វត្ថុ Sentry មាន តែមិនដែល
  ចាប់ផ្តើម ➜ រាល់កំហុសក្រោយមក **ធ្លាក់ចោលដោយស្ងាត់** ខណៈមើលទៅដូចដំណើរការ។
  ឥឡូវការចាប់ផ្តើមបញ្ចប់ពេល script មកដល់យឺត។
- **កំហុសពេលបើក App បាត់អស់។** មុន Sentry មកដល់ គ្មានអ្វីទទួលកំហុសទេ ➜
  កំហុសដែលមានតម្លៃបំផុត (ពេល boot) មិនដែលឃើញ។ ឥឡូវវាត្រូវទុកជួរ (កំណត់
  ២០) រួចផ្ញើពេលរួចរាល់។
- **លុប DSN មិនបញ្ឈប់ការផ្ញើ។** ការលុប DSN ចេញពី Config ធ្លាប់ចាកចេញមុន
  ខណៈ client ចាស់នៅផ្ញើបន្តរហូតដល់ Refresh។ ឥឡូវវាផ្តាច់ client ពិត។
- **ការចាប់ផ្តើម ២ ដងស្របគ្នា** (ពេល boot និងពេលរក្សាទុក Config) អាចធ្វើឲ្យ
  DSN ចាស់សរសេរជាន់ DSN ថ្មី។ ឥឡូវការហៅចុងក្រោយឈ្នះជានិច្ច។

### កែកំហុស — ស្ថានភាពការតភ្ជាប់
- ក្រោយប្តូរ Firebase Config ចំណុចស្ថានភាព **ជាប់បៃតងខុស** រហូតដល់ការ
  តភ្ជាប់ថ្មីរាយការណ៍ — ព្រោះស្ថានភាពចាស់មិនត្រូវសម្អាត។ ឥឡូវវាប្តូរទៅ
  «ក្រៅបណ្ដាញ» ភ្លាមរហូតដល់ការតភ្ជាប់ថ្មីបញ្ជាក់ពិត។

### ឧបករណ៍ audit
- **ថ្មី៖ `sentry-load-race-test.js`** — ចាក់ SDK ក្លែងក្លាយជំនួស CDN ដែល
  អាចពន្យារបាន រួចអះអាងថា event **ទៅដល់ពិត** មិនត្រឹមតែហៅ function ចេញ។
  ៩ ការអះអាង។
- **`slow-write-test.js` រឹងមាំជាងមុន** — harness ធ្លាប់បាញ់ listener
  **ទាំងអស់** ពេលសរសេរ path ណាមួយ ➜ បញ្ជីក្នុងសតិស្តារខ្លួនភ្លាម ➜
  **តេស្តជោគជ័យក្លែងក្លាយ** លើថ្នាក់កំហុសខាងលើ។ ឥឡូវវាបាញ់តាម path ដូច
  Firebase ពិត ហើយបន្ថែម scenario ដែលឧបករណ៍ផ្សេងសរសេរកណ្តាលការរក្សាទុក
  ដែលធ្លាក់ (11 ការអះអាង)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន** — Firebase rules មិនប្រែក្នុងកំណែនេះទេ។

---

## [2.11.4] — 2026-08-24

**ធ្វើឲ្យចលនាផ្ទាំងប្រវត្តិលើ iPhone ដូច Android បេះបិទ ព្រមទាំងបិទចន្លោះ
network ៤ កន្លែងដែលអាចធ្វើឲ្យ App ជាប់ ឬបង្ហាញស្ថានភាពខុស។**

### កែកំហុស — ចលនាផ្ទាំងប្រវត្តិលើ iOS (រាយការណ៍ដោយអ្នកប្រើ)
- **ផ្ទាំងប្រវត្តិលោតភ្លាមពេលធ្លាក់ចុះវិញលើ iPhone** ខណៈលើ Android វារអិល
  យ៉ាងរលូន ➜ អ្នកប្រើឃើញ «ដូច App ២ ផ្សេងគ្នា»។ កំណែ 2.11.3 បានបិទចលនា
  FLIP លើ iOS សម្រាប់ទិស «ចុះ» ដោយខ្លាចថា WebKit នឹង snap outer scroller
  ជាន់ចលនា (ព្រោះ `.page-main` ជា `scroll-snap-align` target ផងដែរ)។
- ឥឡូវចលនាត្រូវបានប្រគល់មកវិញ៖ `panelGlideFrom()` **ផ្អាក `scroll-snap`
  បណ្តោះអាសន្ន** (class `panel-gliding`) តែក្នុងអំឡុង ២២០ms នៃចលនា រួច
  ស្តារវិញភ្លាមពេលចប់។ WebKit លែងមានអ្វី snap ជាន់ ➜ ចលនាដើរពេញលេញ
  ដោយមិនចាំបាច់លះបង់វា។
- **រង្វាស់ពិត (412×780)៖** ការហូតចុះលើ iOS ពី **០px (លោត)** ➜ **៣៥៧px
  រអិល** — ស្មើនឹង Android បេះបិទ។ ទាំងការចុចដងអូស និងការអូសដោយម្រាមដៃ។
- ការស្តារ `scroll-snap` វិញត្រូវធានាដោយ **ផ្លូវ ២** (ចលនាចប់ + timer
  សុវត្ថិភាព) ព្រោះបើ snap មិនត្រឡប់មក ចំណុច snap «បើក» ធ្លាក់ត្រឹម
  `scrollTop 71` ➜ **pull-to-refresh លែងកេះបានទាំងស្រុង**។ ការចាកចេញក៏
  សម្អាតស្ថានភាពនេះដែរ។

### កែកំហុស — ស្ថេរភាពបណ្តាញ
- **សំណើទៅ Lookup API មិនត្រូវបានបោះបង់ពេលអស់ពេល។** `withTimeout(fetch(…))`
  គ្រាន់តែឈប់រង់ចាំ ខណៈ `fetch` នៅដំណើរការបន្ត។ ជាមួយការព្យាយាមឡើងវិញ
  ស្វ័យប្រវត្តិ សំណើជាន់គ្នា ➜ លើបណ្តាញយឺត ការស្វែងរកអតិថិជនកាន់តែយឺត។
  ឥឡូវប្រើ `AbortController` ➜ សំណើចាស់ត្រូវផ្តាច់ពិតមុនព្យាយាមម្តងទៀត។
- **ការអានតួចម្លើយគ្មានពេលកំណត់។** បើ server ផ្ញើ header រួចឈប់ផ្ញើតួ
  (បណ្តាញដាច់ពាក់កណ្តាល) នោះប្រអប់ **ព្យួររហូត** ដោយគ្មានសារកំហុស។
  ឥឡូវពេលកំណត់គ្របទាំងការតភ្ជាប់ និងការអានតួ។
- **Service worker អាចដំឡើងដោយសំបកមិនពេញ។** បើបណ្តាញដាច់កណ្តាលការដំឡើង
  ឯកសារខ្លះមិនចូល cache ខណៈ App ដំណើរការធម្មតា ➜ **ការស្កេនកាមេរ៉ាស្លាប់
  ស្ងាត់ៗពេលក្រៅបណ្តាញ** (engine WASM បាត់)។ ឥឡូវធនធានស្នូលដំឡើងជាក្រុម៖
  បាត់មួយ ➜ ការដំឡើងធ្លាក់ទាំងស្រុង ➜ កំណែចាស់នៅដំណើរការ ហើយ browser
  ព្យាយាមម្តងទៀត។ ធនធានតុបតែង (icon, manifest) នៅតែអនុគ្រោះដដែល។
- **ស្ថានភាព «ភ្ជាប់ Server រួចរាល់» បង្ហាញខុសពេលបាត់ WiFi។** Firebase
  ត្រូវការពេលរហូតដល់ជាងមួយនាទីដើម្បីដឹងថា socket ស្លាប់ ➜ ចំណុចបៃតងនៅ
  បង្ហាញខណៈគ្មានបណ្តាញពិត។ ឥឡូវស្ថានភាពរួមបញ្ចូលសញ្ញាបណ្តាញរបស់ឧបករណ៍ផង។
- **គ្មានការភ្ជាប់ឡើងវិញពេលត្រឡប់មកប្រើ App វិញ។** ក្រោយ iOS ផ្អាក App យូរ
  socket អាចស្លាប់ស្ងាត់ៗ។ ឥឡូវការត្រឡប់មក foreground និងការត្រឡប់មក
  online ដាស់ការតភ្ជាប់ឡើងវិញភ្លាម។

### កែកំហុស — សារដែលធ្វើឲ្យអ្នកប្រើច្រឡំ
- ពេលការរក្សាទុកកញ្ចប់អស់ពេល App ប្រាប់ថា «រក្សាទុកបរាជ័យ! សូមស្កេន
  ម្ដងទៀត» ខណៈការសរសេរនៅដំណើរការ ហើយអាចជោគជ័យបន្ទាប់មក។ ឥឡូវវាប្រាប់
  «⏳ កំពុងរក្សាទុក… សូមកុំស្កេនម្ដងទៀត» ដូចផ្លូវកំណត់ទីតាំង Locker ស្រាប់
  ហើយសារ «បរាជ័យ» លេចតែពេលការសរសេរធ្លាក់ពិត។
- ពេលការភ្ជាប់ទិន្នន័យបរាជ័យស្ងាត់ៗ App ធ្លាប់គិតថាភ្ជាប់រួច ➜ តារាងទទេ
  ជារៀងរហូតដោយគ្មានសារ។ ឥឡូវវាបង្ហាញសារឲ្យ Refresh ទំព័រ។

### ឧបករណ៍ audit ថ្មី
- `ios-panel-glide-test.js` — ប្រៀបធៀបចលនា **iOS ធៀប Android ដោយផ្ទាល់**
  ក្នុង Chromium ដោយបើក iOS gate ទាំង JS និង CSS រួចវាស់ចម្ងាយរំកិលគ្រប់
  ស៊ុម។ ចាក់សោផងដែរថា `scroll-snap` ត្រូវផ្អាក **អំឡុង** ចលនា និងត្រឡប់
  មកវិញក្រោយចប់ (បើអត់ ➜ PTR ស្លាប់)។ ៣២ ការអះអាង។
- `sw-install-integrity-test.js` — ធ្វើឲ្យធនធានស្នូលបាត់ដោយចេតនាកណ្តាល
  ការដំឡើង រួចអះអាងថា service worker **បដិសេធការដំឡើង** ជំនួសការចាប់យក
  ទំព័រដោយសំបកខូច។ ១៦ ការអះអាង។
- `network-timeout-test.js` — ស្រង់ `fetchWithTimeout()` ពិតចេញពី `app.js`
  មករត់ក្នុង browser ធៀបនឹង server ដែលមិនឆ្លើយ និង server ដែលផ្ញើ header
  រួចឈប់ រួចអះអាងថាសំណើ **ត្រូវផ្តាច់ពិត** (server ឃើញ connection ដាច់)។
  ១៤ ការអះអាង។

### ការផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត
- ✅ ចលនាផ្ទាំង, `scroll-snap` និង PTR ដំណើរការត្រឹមត្រូវលើ iPhone និង
  Android ពិត — អ្នកប្រើបញ្ជាក់ (2026-08-24)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន** — Firebase rules មិនប្រែក្នុងកំណែនេះទេ។

---

## [2.11.3] — 2026-08-24

**កែ scroll handoff របស់បញ្ជីប្រវត្តិលើ iOS ដោយមិនប៉ះផ្លូវ Android។**

### កែកំហុស (រាយការណ៍ដោយអ្នកប្រើ ជាមួយវីដេអូ)
- ពេលប្រវត្តិពេញអេក្រង់ ហើយទាញចុះនៅកំពូលតារាង លើ iOS កាយវិការត្រូវជាប់ក្នុង
  តារាងខាងក្នុង៖ Safari rubber-band បង្កើតចន្លោះសធំ តែផ្ទាំងខាងលើមិនត្រឡប់មកវិញ។
- ពេលផ្ទាំងត្រឡប់មកបានម្តងម្កាល វាអាចភ្លាត់ឡើងវិញភ្លាម។ មូលហេតុគឺ
  `touchend` អាន `scrollTop` ថ្មីដែល WebKit អាចផ្ញើជា fractional/stale value ហើយ
  FLIP 220ms ធ្វើចលនាលើ `.page-main` ដែលជាគោលដៅ `scroll-snap` ផងដែរ។

### ដំណោះស្រាយ — iOS PWA តែប៉ុណ្ណោះ
- `usesIOSPanelHandoff()` បើកផ្លូវថ្មីតែពេល `navigator.standalone === true` និង
  WebKit គាំទ្រ `-webkit-touch-callout`; Android មិនឆ្លងកាត់ផ្លូវនេះទេ។
- លើ iOS, `touchmove` របស់តារាងត្រៀមជា non-passive ហើយទប់ native rubber-band
  ក្រោយឆ្លង movement slop 8px ពេលទាញចុះបញ្ឈរនៅ `scrollTop <= 1`។ ចេតនា
  «បានដល់កំពូល» ត្រូវចងចាំពី `touchmove` ឬ `scroll` event រហូតដល់ final
  `touchend` ដូច្នេះការឆ្លងពី 18px ទៅ 0 ឬតម្លៃ 0.5px/stale 2px មិនធ្វើឲ្យ
  បាត់ action ទៀត ហើយ finger jitter តូចមិនទប់ tap លើជួរតារាង។
- ពេលដោះ `history-expanded`, `#appPages.scrollTop` ត្រូវចាក់សោ 0 មុន/ក្រោយប្តូរ
  class និងពីរស៊ុមបន្ទាប់។ FLIP ត្រូវរំលងតែសម្រាប់ iOS expand ដើម្បីកុំឲ្យ
  transformed snap target ទាញកាតឡើងវិញ។ CSS `overscroll-behavior-y: none`
  ជាជាន់ការពារបន្ថែមក្នុងប្លុក iOS។ ការចាក់សោនេះដំណើរការតែ transition
  `history-expanded` ➜ ធម្មតា ដូច្នេះ no-op sync មិន reset outer scroll ទេ។
- Android រក្សា passive listener, ពិដាន `scrollTop <= 0`, FLIP និង CSS `contain`
  ដូចមុនទាំងអស់។

### ឧបករណ៍ audit
- `phone-search-swipe-test.js` កើនពី 46 ទៅ **63 assertions**៖ គ្រប iOS fractional/stale
  `scrollTop`, move ដែលទើបឆ្លងដល់កំពូល, jitter មិនទប់ tap, no-op sync មិន reset,
  non-passive cancellation, event bubbling តែម្តង, double-rAF pin, final reversal,
  `touchcancel`, គ្មាន FLIP លើ iOS expand និងបញ្ជាក់ថា Android នៅ passive/មិន
  `preventDefault` ដដែល។
- `gesture-test.js` (**107 assertions**) បើក iOS handoff gate ក្នុង Chromium ដោយចេតនា
  ហើយបញ្ជូន synthetic touch event ដើម្បីបញ្ជាក់ listener/`defaultPrevented` និង
  propagation ខណៈ diagonal/multitouch/final reversal នៅតែបោះបង់។ Native Safari
  rubber-band ត្រូវបានទុកឲ្យការសាកលើ iPhone PWA ពិតខាងក្រោមផ្ទៀងផ្ទាត់។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- គ្មាន Firebase rules ត្រូវ publish ទេ។
- សាកលើ iPhone PWA ពិត៖ ប្រវត្តិពេញអេក្រង់ ➜ រមូរតារាងទៅកំពូល ➜ ទាញចុះ
  ជាប់ៗគ្នា; ផ្ទាំងខាងលើត្រូវត្រឡប់មករាល់ដង ដោយគ្មានចន្លោះស និងមិនភ្លាត់ឡើងវិញ។

---

## [2.11.2] — 2026-08-24

**iOS ត្រឡប់ទៅយន្តការដែលផ្ទៀងផ្ទាត់រួច — Android រក្សាយន្តការថ្មី។**

### កែកំហុស (រាយការណ៍ដោយអ្នកប្រើ)
- លើ **iPhone** កាតបញ្ជី **«លែងធ្លាក់»** ពេលរមូរចុះឲ្យរបា Tab លាក់ខ្លួន។
  មូលហេតុ៖ កំណែ 2.11.0–2.11.1 ប្តូរទៅយន្តការ **កម្ពស់ថេរ + `clip-path`**
  ដែលដំណើរការល្អលើ Chromium តែ **មិនដើរលើ Safari**។
- លើ **Android យន្តការថ្មីដំណើរការល្អ** (អ្នកប្រើបញ្ជាក់) ➜ រក្សាទុកដដែល។

### ដំណោះស្រាយ — ផ្លូវ ២ ដាច់ដោយឡែក
- **Android/Chromium** ៖ កម្ពស់កាតថេរ បូក `clip-path` (ដូចកំណែ 2.11.1)។
- **iOS WebKit** ៖ កាតមានកម្ពស់ពិត ហើយ **រីកចុះមកបំពេញ** កន្លែងរបា —
  ជាយន្តការដែលបានផ្ទៀងផ្ទាត់លើ iPhone ពិតក្នុងកំណែ 2.9.0។
  អ្វីដែលរក្សាទុកពីការកែថ្មី៖ ការប្រគល់កន្លែងកេះដោយ `body.chrome-hidden`
  **ភ្លាមៗ** មិនមែនរង់ចាំ 180ms ➜ កាតធ្លាក់ស្របគ្នានឹងរបា ដូចសំណើដើម។
- ការបែងចែកប្រើ `@supports (-webkit-touch-callout: none)` ដែលជាការសាក
  iOS WebKit ពិត — ផ្ទៀងផ្ទាត់ដោយ `CSS.supports()` ថា Chromium ត្រឡប់ `false`
  ➜ Android មិនរងផលឡើយ។ (`html.ios-standalone` តែម្យ៉ាងមិនគ្រប់ ព្រោះវាមិន
  គ្របដណ្តប់ Safari ធម្មតា។)

### ឧបករណ៍ audit
- **មេរៀន៖ Chromium មិនអាចផ្គូផ្គង `@supports (-webkit-touch-callout: none)` បានទេ**
  ➜ ច្បាប់ក្នុងនោះ **មិនដែលត្រូវសាកសោះ** បើមិនចាក់វាដោយដៃ។ `panel-motion-test.js`
  (47 assertions) ឥឡូវស្រង់ប្លុកនោះចេញពី `style.css` រួចចាក់ចូល ដើម្បីសាកផ្លូវ iOS
  ពិតៗ៖ គ្មាន `clip-path`, គែមកាតឈរខាងលើរបា, និងកាត **រីកចុះពិត** ពេលរបាលាក់។
  ផ្ទៀងផ្ទាត់ថាធ្លាក់លើកំណែមុន។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- គ្មាន Firebase rules ត្រូវ publish ទេ។
- សាកលើ iPhone៖ រមូរចុះ ➜ កាតត្រូវ **ធ្លាក់មកបំពេញ** កន្លែងរបា Tab ភ្លាមៗ។

---

## [2.11.1] — 2026-08-24

**កែកំហុសដែលកំណែ 2.11.0 បង្កើត៖ ចន្លោះទទេក្រាស់ខាងលើរបា Tab។**

### កែកំហុស (រាយការណ៍ដោយអ្នកប្រើ ជាមួយរូបថត)
- កំណែ 2.11.0 កាត់រូបភាពបញ្ជីតាម `--chrome-bottom` គិតពីគែម **តារាង**។ តែ
  `--chrome-bottom` រួមបញ្ចូល safe-area ដែលនៅ **ក្រោម** viewport ហើយគែមតារាង
  ក៏មិនស្ថិតនៅបាតអេក្រង់ដែរ ➜ ការកាត់ឡើងខ្ពស់ជាងគែមរបាឆ្ងាយ។ ការវាស់៖
  ចន្លោះទទេ **19px លើ Android** និង **53px លើ iPhone** (safe-area 34px)។
  អ្នកប្រើនិយាយត្រូវថា «ដូចមិនមែន tab bar បាំងទេ»។
- ឥឡូវការកាត់ធ្វើលើ **កាត** ដោយវាស់តាម `--tabbar-height` ថ្មី (កម្ពស់របាពិត
  មិនរួម safe-area) ➜ ចុះ **ចំគែមរបា ០px** ទាំង Android និង iPhone។
- ជ្រុងមូលខាងក្រោមរបស់កាតត្រូវរក្សាទុកតាម `round` ក្នុង `inset()`។

### ឧបករណ៍ audit
- **មូលហេតុដែលកំហុសនេះរអិលកាត់**៖ ការអះអាងចាស់មានតែម្ខាង —
  «គែមមើលឃើញ ≤ គែមរបា» ➜ ចន្លោះទទេធំប៉ុនណាក៏ជាប់ដែរ។ ឥឡូវអះអាង **២ ខាង**
  (`|គែមមើលឃើញ − គែមរបា| ≤ 4px`) ក្នុងទាំង `gesture-test.js` និង
  `panel-motion-test.js` (42 assertions)។ ផ្ទៀងផ្ទាត់ថាធ្លាក់លើកំណែមុន។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- គ្មាន Firebase rules ត្រូវ publish ទេ។
- សាកលើ iPhone៖ បញ្ជីត្រូវឈប់ **ជាប់គែមរបា Tab** ដោយគ្មានចន្លោះទទេ។

---

## [2.11.0] — 2026-08-24

**កាតបញ្ជីបំពេញកន្លែងរបា Tab ស្របគ្នានឹងរបា — លែងមានចន្លោះទទេប្រផេះ។**

### កែកំហុស (រាយការណ៍ដោយអ្នកប្រើ ជាមួយវីដេអូ)
- របា Tab រអិលចេញ **ភ្លាម** (transform) តែកាតបញ្ជីធ្លាក់មកបំពេញកន្លែងនោះ
  **១៨០ms ក្រោយមក** (រង់ចាំរមូរស្ងប់)។ អ្នកប្រើឃើញ៖ ចន្លោះទទេប្រផេះមួយភ្លែត
  ហើយ**ជួរដេកចុងក្រោយត្រូវកាត់ពាក់កណ្តាល**។ ការវិភាគស៊ុមវីដេអូបញ្ជាក់វា។
- មូលហេតុ៖ កន្លែងរបាកក់ជា `padding-bottom` លើ `.app-pages` ➜ ការប្រគល់វាមកវិញ
  ជាការប្តូរ **layout** ដែលធ្វើឲ្យតារាងប្តូរកម្ពស់ ➜ ត្រូវពន្យារ បើមិនដូច្នេះ
  បញ្ជីលោតកណ្តាល momentum (កំហុសកំណែ 2.2.1)។

### ដំណោះស្រាយ — កម្ពស់ថេរ បូកការកាត់រូបភាព
- កម្ពស់កាត និងតារាងឥឡូវ **ថេរទាំងស្រុង** — មិនប្តូរពេលរបាលាក់/បង្ហាញទេ។
- កន្លែងរបាកក់ **ខាងក្នុងកន្សោមរមូរ** (`padding-bottom`) ➜ ជួរដេកចុងក្រោយ
  នៅតែរមូរឡើងដល់ខាងលើរបាបាន។
- ជួរដេកមិនលិចក្រោមរបា ព្រោះរូបភាពត្រូវកាត់ដោយ **`clip-path`** ដែលជា
  **paint** មិនមែន layout ➜ ប្តូរបានភ្លាមដោយសុវត្ថិភាពកណ្តាល momentum។
- ផលរួម៖ ថ្នាក់កំហុស «បញ្ជីលោតរំលងពេលប្តូរកម្ពស់កណ្តាល momentum» ក្លាយជា
  **មិនអាចកើតឡើងបានតាមរចនាសម្ព័ន្ធ** ➜ យន្តការពន្យារ ១៨០ms
  (`scheduleChromeLayoutSettle`) និង class `chrome-space-released` ត្រូវដកចេញ។

### ឧបករណ៍ audit
- `panel-motion-test.js` (39 assertions) បន្ថែមការអះអាងថាកន្លែងរបាត្រូវប្រគល់
  មកវិញ **ក្នុង ២ ស៊ុម** មិនមែនពន្យារ។ ផ្ទៀងផ្ទាត់ថាវាធ្លាក់លើកំណែមុន
  (`delta=0px` ➜ ឥឡូវ ≥20px)។
- `gesture-test.js` ការអះអាងតាមគែម **ប្រអប់** ប្តូរទៅតាមគែម **ដែលមើលឃើញ**
  (ប្រអប់ ដក clip inset) ព្រោះ invariant ប្តូររូបរាង មិនមែនបាត់។ បន្ថែម
  ការអះអាងខ្លាំងជាងមុន៖ កម្ពស់កន្សោមរមូរមិនប្តូរ **គ្រប់ដំណាក់កាល**។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- គ្មាន Firebase rules ត្រូវ publish ទេ។
- ⚠️ **ត្រូវសាកលើ iPhone ពិត** — រមូរបញ្ជីចុះឲ្យរបា Tab លាក់ខ្លួន រួចពិនិត្យថា
  កាតបំពេញកន្លែងនោះ **ភ្លាមៗ** ដោយគ្មានចន្លោះទទេ និងគ្មានជួរដេកកាត់ពាក់កណ្តាល។

---

## [2.10.0] — 2026-08-24

**ការស្កេនលើ iPhone លឿនជាងមុនច្រើន — ប្តូរ engine ទៅ WebAssembly។**

### មូលហេតុ
អ្នកប្រើរាយការណ៍ថា Android លឿនឆ្ងាយជាង iPhone ហើយ **iPhone 17 Pro Max ក៏នៅតែយឺត**។
មូលហេតុមិននៅ CPU ទេ៖ Android ប្រើ `BarcodeDetector` ដើមរបស់ប្រព័ន្ធ (ពន្លឿនដោយ
hardware) ចំណែក **Safari គ្មាន API នោះ** ➜ iPhone ធ្លាក់ទៅ ZXing ជា JavaScript សុទ្ធ។
App native ដូច ZTO Palm ប្រើ `AVCaptureMetadataOutput`/`Vision` ដែល web app
មិនអាចប្រើបាន — គ្មាន library JavaScript ណាប្រកួតបានទេ។

### ល្បឿន (វាស់លើ input ដដែល)
- ផ្លូវ **រកមិនឃើញ** — ជាស៊ុមភាគច្រើនពេលអ្នកប្រើកំពុងតម្រង់កាមេរ៉ា ដូច្នេះវាជា
  ថ្លៃដែលកំណត់អារម្មណ៍ថា «យឺត» ៖ **១៣.៩ ms ➜ ១.៦–២.២ ms ក្នុងមួយស៊ុម**។
- ផ្លូវ **រកឃើញ** ៖ ៤.៧ ms ➜ ១.៣–១.៦ ms។
- ការឌិកូដលែងជាថ្លៃលេចធ្លោទៀតទេ — `getImageData()` ទើបជាថ្លៃដែលនៅសល់។

### ផ្លាស់ប្តូរ
- engine ថ្មី៖ **ZXing C++ ចងក្រងជា WebAssembly** (`zxing-wasm` 3.1.3) ស្ថិតក្នុង
  repo ដូចមុន — `vendor/zxing-wasm.js` + `vendor/zxing_reader.wasm`។
- ផ្លូវស្កេន **ទាំងអស់** ប្តូរ៖ កាមេរ៉ា live, រូបភាព, និង QR ពេល Config/Reconfig។
  ZXing-JS ចាស់ត្រូវបានដកចេញទាំងស្រុង (លែងផ្ទុក engine ២)។
- `BarcodeDetector` ដើមរបស់ **Android នៅដដែល** — វាជា hardware ➜ លឿនជាង WASM។
- ជួរអានមិនថយក្រោយទេ៖ ទទឹងអតិបរមាអានបាន 12/12 ករណី ធៀបនឹង 3/12 នៅ 640px។

### សុវត្ថិភាព
- **ការការពារការអានលេខខុសនៅដដែល**៖ បញ្ជី format មានតែ `Code128`។ តេស្តគូរស្លាក
  ITF ពិត រួចបញ្ជាក់ថា reader ១១ format អានវាចេញ (តេស្តមិនទទេ) ខណៈ reader
  របស់ App បដិសេធទាំង live និងរូបភាព។
- ជាន់បញ្ជាក់ **២ ស៊ុមជាប់គ្នា** (`confirmLiveScan`) និង `takeFreshVideoFrame()`
  នៅដំណើរការដដែល ទោះការឌិកូដក្លាយជា async ក៏ដោយ (មាន guard មិនឲ្យជាន់គ្នា)។

### កែកំហុសដែលចាប់បានអំឡុងការងារនេះ
- **CSP បិទ WebAssembly** ➜ ការស្កេននឹងស្លាប់ **ទាំងស្រុងលើផលិតកម្ម** ខណៈតេស្ត
  ក្នុង repo ជោគជ័យទាំងអស់។ បានបន្ថែម `'wasm-unsafe-eval'` ក្នុង `script-src`
  និង header `application/wasm` ក្នុង `netlify.toml`។ ចាក់សោដោយតេស្តហើយ។

### ឧបករណ៍ audit
- `scan-engine-test.js` សរសេរឡើងវិញសម្រាប់ engine ថ្មី (52 assertions) បូក
  ការត្រួតពិនិត្យ CSP និង MIME ដែលចាប់កំហុសខាងលើ។ ពិដានល្បឿនប្តូរទៅរង្វាស់
  ដែលបែងចែក engine បានច្បាស់ (ផ្លូវបរាជ័យនៅ 800px) ជំនួសរង្វាស់ដែលភ្លឹបភ្លែត។
- `offline-shell-test.js` ផ្ទៀងផ្ទាត់ថា **ទាំង ២ ឯកសារ** ចូល cache និងថា binary
  ត្រូវនឹង sha256 ដែល glue រំពឹងទុក (ការចម្លងតែឯកសារមួយ ➜ ធ្លាក់ភ្លាម)។
- តេស្តលែងត្រូវការ `@zxing/library` ជា npm dependency ទៀតទេ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- គ្មាន Firebase rules ត្រូវ publish ទេ។
- ⚠️ **ត្រូវសាកលើ iPhone ពិត** — ជាពិសេស៖ ការស្កេនដំណើរការ, ល្បឿនឆ្លើយតប,
  ជួរអាន (barcode តូច/ឆ្ងាយ), ការស្កេន QR ពេល Config, និងការស្កេនពេលបណ្តាញដាច់។
- ការទាញលើកដំបូងធ្ងន់ជាងមុន ~៣៥២KB (gzip) ព្រោះ binary WASM — ក្រោយពីនោះ
  service worker cache វា។

---

## [2.9.0] — 2026-08-24

**ការបង្រួម/ពង្រីកផ្ទាំងប្រវត្តិលែងលោត — វារអិលតាមម្រាមដៃឥឡូវនេះ។**

### ផ្លាស់ប្តូរ — ចលនាតាមម្រាមដៃ
- មុននេះ ការទាញផ្ទាំងប្រវត្តិឡើង/ចុះ **លោតភ្លាមក្នុងស៊ុមតែមួយ**។ ឥឡូវ៖
  - **ម្រាមដៃលើផ្ទាំងស្ថិតិ/ស្វែងរក** ➜ រអិល **១:១ តាមម្រាមដៃពិត** ជាការរមូរ
    native របស់ទំព័រ ➜ មាន momentum ពេញលេញ។
  - **ម្រាមដៃលើតារាងបញ្ជី** ➜ បញ្ជីរមូរតាមធម្មតា រួច**រអិលចូលទីតាំង ២២០ms**
    ពេលលែងដៃ ជំនួសការលោត។
- បន្ថែម **snap**៖ លែងដៃមុនពាក់កណ្តាល ➜ រអិលចុះវិញ; ហួសពាក់កណ្តាល ➜ ឡើងពេញ។
  លែងឈប់ពាក់កណ្តាលផ្លូវដោយផ្ទាំងលេចមួយចំហៀងទៀតទេ។

### ផ្លាស់ប្តូររូបរាង
- **តារាងប្រវត្តិ៖ ប៊ូតុងក្នុងជួរដេកសរសេរថា «📦 បញ្ជី (N)» ដូចគ្នាទាំងអស់ឥឡូវនេះ។**
  មុននេះកញ្ចប់ដែលមាន barcode តែ ១ បង្ហាញប៊ូតុងពណ៌លឿង «💵 កែ/ដកកញ្ចប់» ដែល
  ស្ទួននឹងធាតុក្នុងម៉ឺនុយ (...) រួចហើយ ➜ ទើសភ្នែក។ **គ្មានមុខងារបាត់ទេ** —
  ការកែ/ដកកញ្ចប់នៅតែមានក្នុងម៉ឺនុយ (...) ហើយប៊ូតុងក្នុងជួរដេកនៅតែបើក
  ប្រអប់ដដែល (`openViewListModal`)។
- ក្នុងរបៀបធម្មតា តារាងខ្ពស់ **538px** (មុននេះ 482px) ➜ ឃើញជួរច្រើនជាងមុន។
  មូលហេតុ៖ កាតបញ្ជីត្រូវខ្ពស់ **ដូចគ្នាបេះបិទ** ទាំង ២ របៀប ដើម្បីឲ្យចលនាចុះចំ
  កន្លែងបេះបិទ (មុននេះខុសគ្នា 56px ➜ នោះជាមូលហេតុនៃការលោត)។

### ល្បឿន និងស្ថេរភាព
- ដោយសារកម្ពស់កាតស្មើគ្នា **កម្ពស់កន្សោមរមូរលែងប្តូរ** រវាង ២ របៀប ➜ ថ្នាក់កំហុស
  «ប្តូរកម្ពស់កន្សោមរមូរកណ្តាល momentum» (ដែលធ្លាប់ធ្វើឲ្យបញ្ជីលោតរំលង) ក្លាយជា
  **មិនអាចកើតឡើងបានតាមរចនាសម្ព័ន្ធ** មិនមែនត្រឹមការជៀសវាងទេ។
- ចលនាជា `transform` សុទ្ធតាម Web Animations ➜ ដើរលើ compositor។ គោរព
  `prefers-reduced-motion` និងបិទទាំងស្រុងលើអេក្រង់ ≥992px។

### ឧបករណ៍ audit
- ឧបករណ៍ថ្មី **`panel-motion-test.js`** (33 assertions លើ 320/412/768px) ចាក់សោ
  លក្ខខណ្ឌទាំងអស់នៃចលនាថ្មី៖ កម្ពស់ស្មើគ្នា, snap ↔ PTR, គ្មាន transform សេសសល់,
  និងប៊ូតុងជួរដេក។ បានផ្ទៀងផ្ទាត់ថាវាធ្លាក់លើ tree មុនកែ (delta 46/56px)។
- `gesture-test.js`៖ ការអះអាង «តារាងខ្ពស់ជាងមុន» លែងត្រូវ ➜ ជំនួសដោយ invariant
  ខ្លាំងជាង «កម្ពស់តារាងមិនប្រែរវាង ២ របៀប»។
- `phone-search-swipe-test.js`៖ stub ធាតុទទួល `getBoundingClientRect()` ដូច DOM ពិត។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- គ្មាន Firebase rules ត្រូវ publish ទេ។
- ✅ **បានសាកលើ iPhone PWA ពិតរួចហើយ** (2026-08-24) — ការទាញផ្ទាំង, snap,
  pull-to-refresh និងការលាក់របា Tab ដំណើរការត្រឹមត្រូវ។ ដូច្នេះផ្នែកនេះ
  **មិនមែនជាកូដដែលមិនទាន់សាកទេ** — កុំ «កែ» វាដោយផ្អែកលើការសង្ស័យ។
  មើល «របៀបស្តារចលនា 2.9.0 វិញ» ក្នុង `CLAUDE.md` មុនប៉ះ។

---

## [2.8.5] — 2026-08-24

**ការអូស និងការរមូរឆ្លើយតបលឿនជាងមុន — គ្មានមុខងារណាប្តូរឡើយ។**

### ល្បឿន — ការទាញដើម្បីផ្ទុកឡើងវិញ (iOS PWA)
- ពេលម្រាមដៃទាញចុះ ប្រព័ន្ធធ្លាប់ដើរឡើងលើដើមឈើ DOM ដើម្បីរកកន្សោមរមូរ
  **ឡើងវិញរាល់ចលនាម្រាមដៃ** ➜ ការគណនា style ឡើងវិញ ៨២ ដង និងការអានទំហំ
  ៨២០ ដងក្នុងមួយចលនា ១០០។ ឥឡូវលទ្ធផលត្រូវចងចាំក្នុងមួយកាយវិការ ➜ នៅសល់
  **១ និង ១០**។ ការងារនេះកើតក្នុង listener ដែល iOS ត្រូវរង់ចាំមុនអនុញ្ញាតឲ្យ
  រមូរ ដូច្នេះការទាញចុះលើ iPhone គួរតែជាប់ម្រាមដៃជាងមុន។

### ល្បឿន — ប្រអប់ស្នើលេខទូរស័ព្ទ
- ប្រអប់ស្នើលេខធ្លាប់គណនាទីតាំងខ្លួនវាឡើងវិញ **រាល់ព្រឹត្តិការណ៍រមូរ** (៦២ ដង
  ក្នុងការរមូរ ៦០ ដង) ដោយសរសេរ style រួចអានកម្ពស់ភ្លាម ➜ បង្ខំ layout ឡើងវិញ
  ចំពេលបញ្ជីកំពុងរអិល។ ឥឡូវវាត្រូវ coalesce តាម `requestAnimationFrame`
  ➜ នៅសល់ **១ ដង** (នេះជាការកែដែលវាស់បាន)។
- តម្លៃ `width`/`left`/`top` ត្រូវបង្គត់ត្រឹម ០.០០១px មុនសរសេរ ដើម្បីឲ្យវា
  ត្រូវនឹងអ្វីដែល browser រក្សាទុកពិត ➜ ការប្រៀបធៀប «រំលងបើមិនប្រែ» ដំណើរការ
  ពិតជំនួសឲ្យការប្រៀបធៀបដែលមិនដែលត្រូវគ្នា។ (Chromium រួចទៅហើយមិនធ្វើអ្វី
  ចំពោះការសរសេរតម្លៃដដែល ដូច្នេះនេះជាការសម្អាតកូដ មិនមែនជាការឡើងល្បឿនធំទេ។)
  ០.០០១px ជាភាពជាក់លាក់ដដែលនឹង browser ➜ **គ្មានការប្តូររូបរាងឡើយ**។
- ឥរិយាបថមិនប្រែទេ៖ ប្រអប់នៅតែតាមប្រអប់បញ្ចូល, នៅតែត្រឡប់ទៅលើពេលកន្លែង
  ខាងក្រោមមិនគ្រប់ និងនៅតែបិទពេលប្រអប់បញ្ចូលរអិលផុតអេក្រង់។

### ឧបករណ៍ audit
- ឧបករណ៍ថ្មី **`layout-thrash.js`** សម្រាប់ថ្នាក់កំហុស «បង្ខំ layout ក្នុងផ្លូវក្តៅ»។
  ដំណាក់កាលទី ១ ជាការវិភាគស្តាទិច (acorn) ដែលដើរតាមការហៅ function ជម្រៅ ៣
  ដោយ **មិន** ចូលក្នុង callback ដែលពន្យារពេល និង **មិន** ផ្គូផ្គងមែក `if`
  ដែលមិនអាចរត់ជាមួយគ្នា។ ដំណាក់កាលទី ២ វាស់ក្នុង Chromium ពិត ហើយចាក់សោលេខ
  ខាងលើ ដូច្នេះការថយក្រោយនឹងធ្លាក់ ទោះការវិភាគស្តាទិចទទួលយកក៏ដោយ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- គ្មាន Firebase rules ត្រូវ publish ទេ។
- សូមសាកល្បង pull-to-refresh និងការរមូរបញ្ជីលើ **iPhone PWA ពិត** មុន merge —
  បរិស្ថាន audit ជា Chromium ដែលមិនអាចបង្កើតឥរិយាបថ touch របស់ iOS ឡើងវិញបានទេ។

---

## [2.8.4] — 2026-08-24

### កែកំហុស — PTR មិនចេញលើ Safari ពិត
- Safari ត្រូវឃើញ non-passive listener មុន gesture ចាប់ផ្តើម; ការដំឡើងក្រោយ
  `touchstart` ក្នុង 2.8.3 ធ្វើឲ្យ PTR មិនអាចកាន់ gesture បានលើ iPhone ពិត។
- ឥឡូវ listener ត្រៀមជាមុនតែពេលផ្ទាំងធម្មតា ហើយដកចេញទាំងស្រុងពេលប្រវត្តិ
  ពេញអេក្រង់/search-focus ដូច្នេះ PTR ដំណើរការវិញដោយមិនប៉ះ full-screen scroll។

### ឧបករណ៍ audit
- `gesture-test.js` 107 assertions៖ ចាក់សោថា listener មានមុន touchstart នៅ state ធម្មតា
  និងមានចំនួនសូន្យពេលប្រវត្តិពេញអេក្រង់។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- សាកល្បង PTR និង full-screen momentum scroll លើ iPhone PWA ពិត។

---

## [2.8.3] — 2026-08-24

**ការរមូរប្រវត្តិលើ iOS រលូនឡើង ហើយ pull-to-refresh បិទទាំងស្រុងពេលបញ្ជីពេញអេក្រង់។**

### ល្បឿន និងកែកំហុស
- ដក document-level non-passive `touchmove` អចិន្ត្រៃយ៍ចេញ; PTR ដំឡើងវាតែពេល
  touch ចាប់ផ្តើមពី state ដែលអនុញ្ញាត ហើយដកចេញភ្លាមក្រោយ gesture ចប់។
- ពេលប្រវត្តិ/បញ្ជីសកម្មពេញអេក្រង់ ឬផ្ទាំងស្វែងរកហូតឡើង PTR មិនបង្ហាញ indicator,
  មិនរារាំង native scroll និងមិន reload ទោះទាញវែងប៉ុនណា; ការទាញចុះបើកផ្ទាំងវិញ។
- Scroll handler ត្រូវបាន coalesce តាម `requestAnimationFrame`; ការប្តូរ padding ដើម្បី
  ប្រគល់/កក់កន្លែង Tab bar ពន្យាររហូត momentum ស្ងប់ 180ms ដើម្បីកុំឲ្យតារាងលោត។

### ឧបករណ៍ audit
- `gesture-test.js` មាន 106 assertions រួមទាំង long pull ពេល full-screen, lifecycle
  non-passive listener និងការធានាថា scroll container មិនប្តូរកម្ពស់កណ្តាល momentum។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- សាកល្បង momentum scroll និងទាញចុះពីកំពូលលើ iPhone PWA ពិតម្តង មុន deploy production។

---

## [2.8.2] — 2026-08-24

**Pull-to-refresh លើ iPhone មានស្ថេរភាព ហើយកាតប្រវត្តិមិនរអិលឡើងក្រោម navbar
ក្រោយ refresh ទៀតទេ។**

### កែកំហុស — តារាងប្រវត្តិលោតឡើងក្រោយ pull-to-refresh លើ iOS
រូបថតមុន/ក្រោយ refresh បង្ហាញថាកាតទាំងមូលរអិលឡើងប្រហែល safe-area ខាងក្រោម
របស់ iPhone ហើយតារាងខាងក្នុងនៅសល់ scroll offset មួយជាន់ទៀត។ មូលហេតុមាន ២ ជាន់៖

- `html/body` នៅតែអាចក្លាយជា root scroller ព្រោះ standalone body វែងជាង viewport
  តាម `env(safe-area-inset-bottom)`
- `location.reload()` ទុកឲ្យ WebKit ស្តារ offset របស់ root, `#appPages` និងតារាង
  ដោយស្វ័យប្រវត្តិក្រោយ layout ចាប់ផ្តើមរួច

ឥឡូវ iOS standalone ត្រូវបានរកឃើញតាំងពី `<head>` ហើយដាក់ `html.ios-standalone`;
`html/body` ត្រូវបានចាក់សោ `overflow-y:hidden` ហើយ `#appPages` ជា outer scroll owner
តែមួយ ដោយមិនដាក់សោនេះលើ Android/browser ធម្មតា។ មុន refresh App កត់ marker,
ប្តូរ `history.scrollRestoration` ទៅ `manual` និងលុប offset ទាំងអស់។ ក្រោយ reload វា
លុបម្តងទៀតតាម `requestAnimationFrame` និង timer ដើម្បីទប់ WebKit restoration ដែលមកយឺត។
marker ត្រូវបានរក្សារហូតដល់ settle ចប់ ហើយ tap ដែលមិនបានរមូរមិនលុប timer ទាំងនេះ។
ក្រោយ settle App ស្ដារ `history.scrollRestoration` ទៅតម្លៃដើម និងសម្អាត marker;
`ResizeObserver` ក៏វាស់ navbar/tabbar ឡើងវិញ បើ safe area ឬ font ធ្វើឲ្យកម្ពស់ប្រែយឺត;
ការវាស់ប្រើ tabbar `offsetHeight` + body height ដូច្នេះ transform ពេលរបាលាក់ ឬ root offset
ពេល WebKit restore មិនធ្វើឲ្យ safe-area រួញ។ `--page-extension` ក៏រក្សា bottom inset
ពេលរបាលាក់ ដើម្បីកុំឲ្យគែមកាត/តារាងធ្លាក់ក្រោម viewport។

### ផ្លាស់ប្តូរ — pull-to-refresh មិនដណ្ដើមការរមូរធម្មតា
- បន្ថែម axis slop, ទិសបញ្ឈរច្បាស់ និង touch arbiter រួមជាមួយកាយវិការបើកផ្ទាំង៖
  0–30px មិនធ្វើអ្វី, 31–55px បើកផ្ទាំងដែលបង្រួម, 56–212px PTR កាន់ gesture តែ
  រអិលត្រឡប់វិញ ហើយត្រូវទាញដោយចេតនាប្រហែល ≥213px ទើប refresh។ Indicator នៅលាក់
  រហូតដល់ 56px ហើយលេចឡើងបន្តិចម្តងៗ មិនពេញតាំងពីទាញខ្លី
- PTR ដំណើរការតែពេល root, ទំព័រ និងតារាងសកម្មសុទ្ធតែនៅកំពូល; ការទាញផ្ដេក,
  ទាញឡើង, modal/drawer, វាលបញ្ចូល និង control ក្រៅតារាង មិនត្រូវបានដណ្ដើម។ Tap/drag
  ខ្លីលើ button/link ក្នុងជួរតារាងនៅតែធម្មតា តែ deliberate long pull មាន behavior ដូចផ្ទៃជួរ។ វាទទួល
  `scrollTop` អវិជ្ជមានពី Safari rubber-band ហើយតាម `Touch.identifier`; បន្ថែមម្រាមដៃទី២
  បោះបង់ទាំងការបើកផ្ទាំង និង refresh
- Final `touchend` គណនាចម្ងាយពី `changedTouches` ឡើងវិញ ដូច្នេះការបញ្ច្រាសលឿនមិន
  refresh/បើកផ្ទាំងតាម state ចាស់ ហើយក្រោយ vertical lock វាប្រើ hysteresis ដូច touchmove
  ដើម្បីឲ្យ ready indicator និង refresh decision ស្របគ្នា។ Phase `refreshing` block touch/click ថ្មីទាំងអស់មុន
  navigation និង watchdog 5s ដោះស្ថានភាព បើ reload មិនបានចាប់ផ្តើម; `beforeunload`
  បិទ watchdog ដោយរក្សា markers ពេល navigation បានចាប់ផ្តើម ទោះ response យឺតក៏ដោយ
- Panel swipe ឥឡូវទាមទារទិសបញ្ឈរច្បាស់ដូច PTR ដូច្នេះការអូសទ្រេត/ផ្ដេកមិនបើក
  ឬបង្រួមផ្ទាំងដោយចៃដន្យ

### កែកំហុស — កុំប្តូរ scroll owner កណ្តាល touch
មុននេះ `.collapsed` ប្តូរចំពេលម្រាមដៃនៅលើអេក្រង់ ហើយ `history-expanded` ប្តូរពេល
លើកម្រាមដៃ។ ស្ថានភាពពាក់កណ្តាលនោះធ្វើឲ្យ iOS ប្តូរ layout/scroll owner កណ្តាល
កាយវិការ។ ឥឡូវ `touchmove` គ្រាន់តែ queue ចេតនា; `touchend` ទើបអនុវត្ត class និងសោ
ជាមួយគ្នា។ `touchcancel` បោះបង់ទាំងមូល ហើយពេលចូលរបៀបពេញអេក្រង់
`#appPages.scrollTop` ចាស់ត្រូវបានលុប។

### ឧបករណ៍ audit
- **`gesture-test.js` — 101 assertions**៖ គ្រប short/medium/long pull, negative bounce,
  diagonal និង multitouch មុន/ក្រោយពិដាន, final reversal/crossing, modal/drawer/control exclusion,
  table-row action ownership, panel-vs-PTR ownership, iOS-only standalone scroll policy,
  root offset/tabbar ដែលលាក់ជាមួយ inset 34px, late navbar resize និង reload response យឺត >5s
  ដែលចាក់ offset 34px/45px ក្រោយ early tap រួចអះអាងថា root/page/table ត្រឡប់ 0 កាតនៅ
  ក្រោម navbar ជួរដំបូងនៅក្រោម sticky header marker ត្រូវសម្អាត និងគ្មាន page error។
  តេស្ត regression ថ្មីធ្លាក់លើ 2.8.1 ដោយ indicator លេចលឿន និង reload ខុសកន្លែង។
- **`phone-search-swipe-test.js` — 46 assertions**៖ ចាក់ `#appPages.scrollTop = 34`,
  ផ្ទៀងផ្ទាត់ touchend-only layout, final coordinate និង touchcancel discard។ Baseline 2.8.1
  ខ្វះ identifier arbiter ថ្មី ដូច្នេះតេស្តបដិសេធភ្លាម។
- កែ `policy-test.js`/`version-check.js` ឲ្យទទួល CRLF, `boot-runtime.js` ឲ្យរក repo path
  បានលើ Windows និង `run-all.sh` ឲ្យរាយ `SKIPPED`/`PARTIAL PASS` ដាច់ពី `PASS`។
- `gesture-test.js` បិទ Service Worker ដើម្បីកុំឲ្យ cache រំលង license mock ពេល reload;
  `offline-shell-test.js` នៅតែគ្រប Service Worker ពិតដោយឡែក។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** មិនចាំបាច់ប៉ះ Firebase Console ឬប្តូរទិន្នន័យទេ។

---

## [2.8.1] — 2026-08-23

**ត្រឡប់ទៅឥរិយាបថ 2.7.0 វិញ រួចកែ iOS ដោយប្តូរតែ *របៀបវាស់* ប៉ុណ្ណោះ។**

### ថយក្រោយ — កំណែ 2.7.1 និង 2.8.0 ទាំងស្រុង
កំណែទាំង ២ ធ្វើឲ្យ App **អាក្រក់ជាងមុន** លើឧបករណ៍ពិត៖

- **2.8.0** ដក **កាយវិការ «អូសលើបញ្ជី ➜ ប្រអប់ហូតឡើង»** ចេញ — មុខងារដែល
  អ្នកប្រើពឹងផ្អែក។ **វាត្រឡប់មកវិញហើយ។**
- **2.7.1** ដក `env(safe-area-inset-bottom)` ចេញពីកម្ពស់ `body` ➜ body ខ្លីជាង
  អេក្រង់ ➜ **ចន្លោះទទេធំក្រោមរបា Tab**។ ច្បាប់នោះ**ត្រឡប់មកវិញ** — វាមាន
  តួនាទីពិតគឺធ្វើឲ្យ body គ្របអេក្រង់ក្នុងរបៀប standalone។

ផ្ទៀងផ្ទាត់ថា `ZoeW/app.js`, `style.css`, `index.html` និង `sw.js`
**ដូច 2.7.0 បេះបិទ** មុនអនុវត្តការកែខាងក្រោម។

### កែកំហុស — របា Tab បាំងគែមកាតលើ iPhone (កែ *ការវាស់* មិនកែ layout)
`.app-pages` កក់កន្លែងរបា Tab ជា `padding-bottom` គិតពី **បាត `body`** ខណៈ
`--chrome-bottom` ត្រូវវាស់ជា `tabbar.offsetHeight` (កម្ពស់របា)។

- លើ **Android** បាត body = បាត viewport ➜ លេខ ២ នេះ**ស្មើគ្នា** ➜ គ្មានបញ្ហា
- លើ **iOS standalone** body វែងជាង viewport តាម inset (ដោយចេតនា ដើម្បីគ្រប
  អេក្រង់) ➜ ការកក់ **ខ្វះតាមចំនួន inset** ➜ របាបាំងគែមកាត

ឥឡូវ `measureAppChromeSize()` វាស់ជា **ចម្ងាយពីបាត body ដល់កំពូលរបា**៖

```js
document.body.getBoundingClientRect().bottom - tabbar.getBoundingClientRect().top
```

វា**សម្រួលខ្លួនឯង**៖ inset ប៉ុន្មានក៏បាន វារាប់បញ្ចូលដោយស្វ័យប្រវត្តិ ដោយ
**មិនចាំបាច់ដឹងតម្លៃ inset** និង **មិនប៉ះ CSS សោះ**។

ការវាស់ក្នុង Chromium (ធ្វើត្រាប់តាម body វែងជាង viewport ៣៤px)៖

| | `--chrome-bottom` | កម្ពស់របា | គែមកាត |
|---|---|---|---|
| inset 0 (**Android**) | 58 | 58 | ឈរខាងលើរបា ✅ |
| inset ៣៤px (**iPhone**) | **92** | 58 | ឈរខាងលើរបា ✅ |

**Android មិនប្រែសោះ** (58 = 58) — ការកែប៉ះតែករណីដែល body វែងជាង viewport។

### ឧបករណ៍ audit
- **`gesture-test.js`** — បន្ថែមផ្នែក «`--chrome-bottom` វាស់តាមបាត body»៖
  វាស់ក្នុងករណី inset 0 រួច **ធ្វើត្រាប់តាម iPhone** ដោយធ្វើឲ្យ body វែងជាង
  viewport ៣៤px ហើយអះអាងថា `--chrome-bottom` បូក inset ដោយស្វ័យប្រវត្តិ
  និងថាគែមកាតឈរខាងលើរបា **ទាំង ២ ករណី**។ **ធ្លាក់ ២ លើ 2.7.0។**

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។**

---

## [2.7.0] — 2026-08-23

**បញ្ជីទាំង ៣ ហូតឡើងចុះដូចគ្នា ហើយកន្លែងរបា Tab ត្រូវប្រគល់មកកាតវិញ។**

### ផ្លាស់ប្តូរ — គ្មានចន្លោះទទេនៅបាតអេក្រង់ទៀតទេ
ពេលរបា Tab លាក់ខ្លួនតាមការរមូរ កន្លែងដែលកក់ទុកសម្រាប់វា **ត្រូវប្រគល់មកកាត
វិញ** ➜ កាតរីកចុះបំពេញកន្លែងនោះ។ មុននេះកន្លែងនោះនៅទទេ ➜ អ្នកប្រើឃើញចន្លោះ
ប្រហែល ៧០px នៅបាតអេក្រង់។ ឥឡូវដូចកំណែ 2.2.0 វិញ។

- **ការប្តូរនេះលោតភ្លាម គ្មាន `transition` ទេ** — នេះជាចំណុចសំខាន់។ កំណែ 2.2.1
  ធ្វើ **ចលនា** លើ padding នោះ ➜ កម្ពស់កន្សោមរមូរប្តូររាល់ស៊ុមអស់ ០.២៦ វិនាទី
  ចំពេល momentum scroll របស់ iOS កំពុងដើរ ➜ បញ្ជីលោតរំលង។ ការប្តូរភ្លាមមួយដង
  មិនស្ថិតក្នុងថ្នាក់កំហុសនោះទេ ហើយ `setupChromeAutoHide()` មិនលាក់របាពេលនៅ
  ជិតបាតបញ្ជី ដូច្នេះការរីកមិនកើតឡើងក្នុងទីតាំងដែល scrollTop ត្រូវ clamp។

### បន្ថែម — ទំព័រ «បញ្ចូលទិន្នន័យ» ហូតឡើងចុះដូចប្រវត្តិដែរ
តាមសំណើអ្នកប្រើ៖ បញ្ជី **«កញ្ចប់ដែលបានបញ្ចូលថ្ងៃនេះ»** និង **«បញ្ជីទីតាំង
Locker»** ឥឡូវមានឥរិយាបថដូចផ្ទាំងប្រវត្តិបេះបិទ៖

- អូសឡើងលើបញ្ជី ➜ ផ្ទាំងកាមេរ៉ា/ស្កេនបង្រួម ➜ បញ្ជីហូតឡើងពេញអេក្រង់
- អូសចុះពេលបញ្ជីនៅកំពូល ➜ ផ្ទាំងកាមេរ៉ាត្រឡប់មកវិញ
- មានដងអូស (`⎯`) នៅពីលើបញ្ជី — ចុចដើម្បីបិទ/បើកដោយចេតនាច្បាស់លាស់
- ការប្តូររវាងរបៀប «បញ្ចូលកញ្ចប់» និង «កំណត់ទីតាំង Locker» ដើរដដែល —
  កាយវិការតាមបញ្ជីណាដែលកំពុងបង្ហាញ

### កែកំហុស — ការអូសលែងបង្អាក់ការរមូរបញ្ជី
មុននេះការបង្រួមផ្ទាំងខាងលើ **ចាក់សោកន្សោមរមូរភ្លាមចំពេលម្រាមដៃនៅលើអេក្រង់**
➜ កម្ពស់កន្សោមរមូរប្តូរកណ្តាលកាយវិការ ➜ ការរមូរដែលកំពុងដើរត្រូវកាត់ផ្តាច់
(អ្នកប្រើរាយការណ៍ថា «បង្អាក់ការ scroll list»)។ ឥឡូវផ្ទាំងបង្រួម **ភ្លាម**
(អ្នកប្រើឃើញផលភ្លាម) តែ **សោអនុវត្តពេលលើកម្រាមដៃ** ➜ ការរមូរបន្តរលូន។
`touchcancel` ក៏អនុវត្តសោដែរ ដូច្នេះសោមិនជាប់គាំង។

### ឧបករណ៍ audit
- **`phone-search-swipe-test.js`** — បន្ថែមផ្នែក «ទំព័រ ២ ហូតឡើងចុះដូចប្រវត្តិ»
  និង «សោមិនអនុវត្តចំពេលម្រាមដៃនៅលើអេក្រង់»។ **ធ្លាក់លើ tree មុនកែ**
  (`entryScrollerInView` មិនទាន់មាន)។
- **`gesture-test.js`** — ជំនួសការអះអាង «កម្ពស់មិនប្តូរ» ដោយ «កាតរីកចុះបំពេញ
  កន្លែងរបា» បូក **ការអះអាងថាគ្មាន `transition` លើ padding** (ឫសគល់ពិតនៃ
  ថ្នាក់កំហុស 2.2.1)។ **ធ្លាក់ ២ លើ tree មុនកែ។**

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** មិនចាំបាច់ប៉ះ Firebase Console ទេ។

---

## [2.6.1] — 2026-08-23

**កែបន្ទាន់៖ ថយក្រោយការ cache ធនធានឆ្លង origin ដែលធ្វើឲ្យ App ខូចលើផលិតកម្ម។**

### កែកំហុស (សំខាន់បំផុត)
ក្រោយឡើងកំណែ 2.6.0 អ្នកប្រើរាយការណ៍ថា App បង្ហាញ **«ក្រៅបណ្តាញ» និងគ្មាន
ទិន្នន័យសោះ ខណៈអ៊ីនធឺណិតដើរលឿនធម្មតា**។ មូលហេតុ៖ កំណែ 2.6.0 បានធ្វើឲ្យ
service worker **ស្កាត់សំណើឆ្លង origin** (Firebase SDK ពី gstatic, ពុម្ពអក្សរ
Google, Sentry) ដើម្បី cache ពួកវា។ ការស្កាត់នោះធ្វើឲ្យ Firebase SDK និង Sentry
ផ្ទុកមិនចូល ➜ App តភ្ជាប់ទៅ Database មិនបាន។

- **ថយក្រោយទាំងស្រុង** — `sw.js` ទាំង ២ App ត្រឡប់ទៅ
  `if (url.origin !== self.location.origin) return;` ដូចមុនកំណែ 2.6.0។
  `CDN_HOSTS` និង `CDN_PRECACHE` ត្រូវដកចេញ។
- **អ្វីដែល *រក្សាទុក* ពី 2.6.0**៖ ZXing នៅតែស្ថិតក្នុង repo
  (`ZoeW/vendor/zxing.min.js`) និងក្នុង `APP_SHELL` — វាជាធនធាន **origin ដដែល**
  ដូច្នេះវាមិនពាក់ព័ន្ធនឹងបញ្ហាខាងលើទេ ហើយ **ការស្កេនកាមេរ៉ានៅតែដើរបានពេល
  បណ្តាញដាច់**។ តេស្តបញ្ជាក់រឿងនេះនៅតែជាប់។

### មេរៀន
**ការធ្វើតេស្តជាមួយ CDN ក្លែងក្លាយ ជោគជ័យក្លែងក្លាយ។** បរិស្ថាន CI ឆ្លងកាត់
proxy ដូច្នេះវាមិនអាចបង្កើតឥរិយាបថ CDN ពិត (header, redirect, `Vary`) ឡើងវិញបានទេ។
ការកែណាមួយដែលប៉ះការទាញធនធានឆ្លង origin **មិនត្រូវ ship ដោយផ្អែកលើតេស្តក្លែងក្លាយ
តែម្យ៉ាងឡើយ** — `offline-shell-test.js` ចាក់សោច្បាប់នេះទុកជាអក្សរហើយ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន** ចំពោះ Firebase។
- បន្ទាប់ពី deploy អ្នកប្រើត្រូវ **បិទបើក App ឡើងវិញ ១–២ ដង** ដើម្បីឲ្យ service
  worker ថ្មី (`zoew-v74`) ជំនួសកំណែចាស់។

---

## [2.6.0] — 2026-08-23

**App ដើរបានពេញលេញពេលបណ្តាញដាច់ — រួមទាំងម៉ាស៊ីនស្កេនកាមេរ៉ា។**

### កែកំហុស — ស្កេនមិនកើតពេលបណ្តាញខ្សោយ ឬ CDN ដាច់ (សំខាន់)
`sw.js` ធ្លាប់បោះបង់ **រាល់សំណើឆ្លង origin** ដូច្នេះធនធានទាំងនេះ **មិនដែលចូល
cache ទេ**៖ ម៉ាស៊ីនស្កេន ZXing (unpkg.com), Firebase SDK (gstatic), ពុម្ពអក្សរ
Google និង Sentry។ ផលវិបាកពិតលើដៃអ្នកប្រើ៖ ពេលបណ្តាញខ្សោយ ឬ CDN ដាច់ —
**App បើកបាន តែចុច «បើកកាមេរ៉ា» រួចស្កេនមិនចេញសោះ** ព្រោះ ZXing មិនមក
(អ្នកប្រើឃើញត្រឹម «⚠️ មិនអាចផ្ទុកម៉ាស៊ីនស្កេន Barcode បានទេ»)។

- **ZXing 0.23.0 ចូលមកក្នុង repo ហើយ** (`ZoeW/vendor/zxing.min.js`) ➜ វាជា
  ធនធាន origin ដដែល ដូច្នេះវាចូល `APP_SHELL` ដូចឯកសារ App ដទៃ។ ឯកសារនេះ
  **byte-identical** នឹងអ្វីដែលផលិតកម្មធ្លាប់ទាញពី CDN — ផ្ទៀងផ្ទាត់ដោយ
  sha384 ដដែលនឹង SRI ចាស់ ➜ **គ្មានការប្តូរឥរិយាបថសោះ**។
- **Firebase SDK, ពុម្ពអក្សរ និង Sentry ឥឡូវ cache ដែរ** តាមបញ្ជី host
  ជាក់លាក់។ App ដែលដំឡើងរួច បើកបាន និងស្កេនបាន **ទោះគ្មានបណ្តាញទាល់តែសោះ**។
- **វាមិនមែន «cache គ្រប់យ៉ាង» ទេ។** ចរាចរណ៍ទិន្នន័យផ្ទាល់ — RTDB
  (`*.firebaseio.com`), token auth (`identitytoolkit`, `securetoken`) និង
  Google Apps Script — **នៅតែឆ្លងកាត់បណ្តាញជានិច្ច**។ ការ cache ពួកវានឹង
  បម្រើទិន្នន័យចាស់ ➜ គ្រោះថ្នាក់ដល់អាជីវកម្មផ្ទាល់។

### សុវត្ថិភាព
- **CSP តឹងជាងមុន** — `https://unpkg.com` ត្រូវដកចេញពី `script-src` ព្រោះលែង
  ប្រើទៀតហើយ។ App លែងអនុញ្ញាតឲ្យ script ណាមួយមកពី host នោះបានទៀតទេ។

### ល្បឿន
- ការបើក App លើកដំបូង **លែងត្រូវរង់ចាំ round-trip ទៅ unpkg.com** ដើម្បីបាន
  ម៉ាស៊ីនស្កេន — វាមកជាមួយសំបក App តែម្តង។

### ឧបករណ៍ audit
- **ថ្មី `audit-tools/offline-shell-test.js`** — ចុះឈ្មោះ service worker ពិត
  ក្នុង Chromium, រង់ចាំវា cache សំបក, រួច **បិទម៉ាស៊ីនបម្រើទាំងស្រុង** ហើយ
  ផ្ទុកទំព័រឡើងវិញ។ បន្ថែមពីលើនោះ វាអះអាងថា៖ URL របស់ Firebase SDK ក្នុង
  `firebase-loader.js` ត្រូវនឹង `CDN_PRECACHE` (ការពារការឃ្លាតកំណែស្ងាត់ៗ),
  បញ្ជី host **មិនមាន** host ទិន្នន័យផ្ទាល់ណាមួយ, និង sha384 របស់ ZXing
  ក្នុង repo។ **ធ្លាក់ ១១ លើ tree មុនកែ** — រួមទាំង «ពេលបណ្តាញដាច់ ➜ ZXing
  នៅមក» ដែលជាកំហុសពិត។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** មិនចាំបាច់ប៉ះ Firebase Console ទេ។ (Netlify នឹងយក `netlify.toml`
  ថ្មីទៅអនុវត្តដោយស្វ័យប្រវត្តិពេល deploy — រួមទាំង CSP ដែលតឹងជាងមុន។)

---

## [2.5.0] — 2026-08-23

**ជុំល្បឿន៖ ការស្កេន Barcode លើ iPhone អានបានឆ្ងាយជាងមុន ៣ ដង, ការរមូរលែងទាក់,
របា Tab លែងបាំងកាតប្រវត្តិ និងការសម្របល្បឿនតាមឧបករណ៍ដោយស្វ័យប្រវត្តិ។**

### កែកំហុស — ចុច Tab «បញ្ចូលទិន្នន័យ» រួច **រមូរមិនកើត** (សំខាន់)
ពេលអ្នកប្រើទាញផ្ទាំងប្រវត្តិឡើងពេញអេក្រង់ រួចចុចប្តូរទៅ Tab «បញ្ចូលទិន្នន័យ»
ទំព័រនោះ **គាំងទាំងស្រុង រមូរមិនកើតទាល់តែសោះ**; តែពេលចុចត្រឡប់មក Tab
«ទិន្នន័យ» វិញ ការរមូរដើរធម្មតា។ ឫសគល់៖ របៀបប្រវត្តិពេញអេក្រង់ចាក់សោការរមូរ
របស់ប្រអប់ទំព័រ (`overflow-y: hidden`) ព្រោះការរមូរផ្ទេរទៅតារាងខាងក្នុងវិញ —
ប៉ុន្តែសោនោះ **មិនត្រូវបានដោះពេលប្តូរទំព័រទេ** ដូច្នេះវាជាប់ទៅលើទំព័រ
«បញ្ចូលទិន្នន័យ» ដែលគ្មានតារាងខាងក្នុងសម្រាប់ទទួលការរមូរ។ ឥឡូវសោនោះជាប់
**តែទំព័រទិន្នន័យប៉ុណ្ណោះ** ហើយត្រូវដោះ/ដាក់ឡើងវិញរាល់ពេលប្តូរទំព័រ។

### ផ្លាស់ប្តូរ — របា Tab លែងបាំងកាតប្រវត្តិទៀតទេ
តាមសំណើអ្នកប្រើ (ដូចកំណែ 2.2.0)៖ ក្នុងរបៀបប្រវត្តិពេញអេក្រង់ **គែមក្រោមកាត
ប្រវត្តិឈរនៅខាងលើរបា Tab** — ជួរដេកលែងលិចចូលពីក្រោមរបានោះទៀតទេ។ កំណែ 2.4.0
ទុកឲ្យកាតលាតដល់បាតអេក្រង់ រួចកក់កន្លែងឲ្យរបា Tab ដោយចន្លោះទទេ *ខាងក្នុង*
តារាង ➜ មើលទៅដូចរបាបាំងពីលើកាត។ ឥឡូវកន្លែងកក់នោះជា **padding ថេររបស់ប្រអប់
ទំព័រ** វិញ។ វា **នៅតែមិនប្តូរ layout ពេលរបាលាក់/បង្ហាញខ្លួន** ដូច្នេះបញ្ជី
មិនលោតរំលងលើ iOS ដដែល (ថ្នាក់កំហុសដែលកំណែ 2.4.0 កែ នៅតែជាប់សោ)។

### ល្បឿន — ការស្កេន Barcode លើ iPhone
Android ប្រើ `BarcodeDetector` ដើមរបស់ប្រព័ន្ធ ដែលឌិកូដលើរូបភាព **គុណភាព
ពេញ (~1920px)** ចំណែក iPhone (Safari គ្មាន API នោះ) ប្រើ ZXing ដែលឌិកូដលើ
canvas ដែលបង្រួមមកត្រឹម **640px** — នោះហើយជាឫសគល់ដែល «iPhone អានយូរ និងអាន
មិនសូវចេញ»។ ជុំនេះកែទាំងល្បឿន និងជួរអាន៖

- **ជួរអានឆ្ងាយជាងមុន ៣ ដង។** ទទឹងឌិកូដឡើងពី 640px ទៅដល់ **1280px** ចំណែក
  កម្ពស់កាត់ត្រឹម **240px** (barcode ជាបន្ទាត់បញ្ឈរ ➜ គុណភាពផ្តេកទេដែលសំខាន់)។
  ការវាស់ក្នុងតេស្តពិត៖ លើសំណុំ barcode តូច/ឆ្ងាយ ១២ ករណី — 640px អានបាន
  **៤/១២** ចំណែកឥឡូវ **១២/១២**។
- **ថ្លៃឌិកូដក្នុងមួយស៊ុមថយចុះ ទោះទំហំរូបធំជាងមុន ២ ដង។** មុននេះ ZXing
  បម្លែង **គ្រប់ pixel** ទៅ grayscale មុននឹងអាន ទាំងដែលវាអានពិតតែប្រហែល
  ១៥ ជួរដេកប៉ុណ្ណោះ។ ឥឡូវបម្លែង **តែជួរដេកដែលវាស្នើ** ➜ ៤.២៧ ➜ **២.៥១
  មិល្លីវិនាទី/ស៊ុម** លើស៊ុម 1280px។
- **ការស្កេនញឹកជាងមុន** — ចន្លោះអប្បបរមារវាងស៊ុម ៦០ ➜ **៤០ មិល្លីវិនាទី**
  ហើយប្រើ `requestVideoFrameCallback` (iOS 15.4+) ដើម្បីឌិកូដ **ត្រូវនឹងស៊ុម
  វីដេអូពិត** ជំនួសការស្មាន។
- **សុវត្ថិភាព៖ ស៊ុមវីដេអូដដែលលែងត្រូវឌិកូដពីរដងទៀតទេ។** ជាន់ការពារ «ត្រូវអាន
  ឃើញលេខដដែល ២ ស៊ុមជាប់គ្នា» នឹងខ្សោយភ្លាម បើស៊ុមតែមួយត្រូវរាប់ជាពីរ។
  ឥឡូវការឌិកូដរំលងស៊ុមដែលឌិកូដរួច ➜ ជាន់ការពារនោះរឹងមាំដូចការរចនា។

### ល្បឿន — ការរមូរ និងការសម្របតាមឧបករណ៍
- **ការរមូរបញ្ជីប្រវត្តិលែងទាក់ ពេលផ្ទាំងខាងលើហូតឡើង។** ផ្ទាំងខាងលើមាន
  `transition` លើ `max-height` និង `opacity` រយៈពេល ០.៣ វិនាទី — ប៉ុន្តែ
  `max-height` **មិនអាចធ្វើចលនាបានទេ** (វាលោតទៅ 0 ភ្លាម) ដូច្នេះអ្វីដែល
  នៅសល់គឺ opacity ដែលដេញលើប្រអប់កម្ពស់ 0 ដែលមើលមិនឃើញផង៖ **ការគូរឡើងវិញ
  ០.៣ វិនាទីដោយឥតប្រយោជន៍ ចំពេលអ្នកប្រើកំពុងរមូរ**។ ដកចេញទាំងស្រុង។
- ផ្ទាំងដែលបង្រួមឥឡូវទទួល `visibility: hidden` ➜ លែងអាច tab ចូលបាន និងលែង
  ត្រូវ browser គូរ ឬ hit-test វាទៀត។
- **ចង្វាក់ស៊ុមសម្របតាមឧបករណ៍ ១០–១២០ fps។** ទំព័រវែប **មិនអាចដំឡើងល្បឿន refresh
  របស់អេក្រង់បានទេ** (វាជារបស់ OS/browser) — តែឥឡូវ App **វាស់ចង្វាក់ពិត** របស់
  ឧបករណ៍ (median នៃ ២៤ ស៊ុម, clamp ១០–១២០Hz) រួចយកវាធ្វើមូលដ្ឋាននៃការសម្រេច
  ទាំងអស់។ មុននេះពិដាន «ស៊ុមវែង» ជាលេខថេរ ២៦ មិល្លីវិនាទី ដែលសន្មតថាគ្រប់ឧបករណ៍
  ដើរ ៦០Hz — ខុសទាំង ២ ទិស៖ លើអេក្រង់ ១២០Hz វាធូរពេក ចំណែកលើឧបករណ៍ដែល browser
  ចាក់ត្រឹម ៣០Hz វាតឹងពេក។ ចន្លោះល្បឿនស្កេនក៏សរសេរជា fps ដែរ (**១០–១២០ fps**
  ➜ ៨–១០០ មិល្លីវិនាទី) ជំនួសលេខថេរ ៦០–២២០។
- **ទម្រង់ស្រាលស្វ័យប្រវត្តិ។** App វាស់ចង្វាក់ស៊ុមពិតរបស់ឧបករណ៍ **២ ដង**
  (វិនាទីទី ១.៥ និងទី ១០)។ បើវាធ្លាក់ស៊ុមពិតទាំង ២ ដង ➜ បិទចលនាដែលដើរជា
  រៀងរហូត (បន្ទាត់ស្កេន, ចំណុចស្ថានភាព) និងស្រមោលដែលថ្លៃ។ ការវាស់ ២ ដងជៀស
  ការវិនិច្ឆ័យខុសពីភាពរវល់ពេល boot។
- **ការស្កេនក៏សម្របខ្លួនដែរ**៖ បើឌិកូដមួយស៊ុមលើសពី ២២ មិល្លីវិនាទី ➜ ទម្លាក់
  ទទឹងឌិកូដមួយជំហាន (1280 ➜ 1024 ➜ 800 ➜ 640); បើវាធ្លាក់ក្រោម ៩ មិល្លីវិនាទី
  ➜ ឡើងវិញ។ ដូច្នេះទូរស័ព្ទចាស់នៅតែរលូន ចំណែកទូរស័ព្ទថ្មីបានជួរអានពេញ។

### ឧបករណ៍ audit
- **`scan-engine-test.js`** — បន្ថែមការវាស់ **ជួរអាន** ពិត (គូរ barcode នៅ
  1920px រួច downscale ដូចផ្លូវពិត), ការប្រៀបធៀបថ្លៃ luminance តាមជួរដេក ធៀប
  grayscale ពេញស៊ុម, ការសាកល្បងការសម្របតាមថ្លៃ, និងថវិកា pixel ក្នុងមួយស៊ុម។
- **`page-nav-test.js`** — បន្ថែមការសាកល្បងថាសោ `history-expanded` ត្រូវដោះ
  ពេលប្តូរទំព័រ ហើយទំព័រ «បញ្ចូលទិន្នន័យ» រមូរបានពិតប្រាកដ។
  **ធ្លាក់ ៣ លើ tree មុនកែ។**
- **`gesture-test.js`** — ជំនួសការអះអាង «ចន្លោះកក់ខាងក្នុងតារាង» ដោយការអះអាង
  ថា **គែមក្រោមតារាង និងគែមក្រោមកាតឈរខាងលើរបា Tab**។ **ធ្លាក់ ២ លើ tree មុនកែ។**

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** មិនចាំបាច់ប៉ះ Firebase Console ទេ។

---

## [2.4.0] — 2026-08-23

**ជុំកែបញ្ហា iOS៖ ការអានលេខ Barcode ខុស, បញ្ជីប្រវត្តិលោតរំលង, របាលាក់មិនរលូន,
និងកាមេរ៉ាកកក្រោយចុច ✖។**

### កែកំហុស — ការស្កេនអានលេខខុស (សំខាន់បំផុត)
មុននេះម៉ាស៊ីនស្កេនបើកទទួល **format ដល់ទៅ ១១** (CODE_128, CODE_39, CODE_93,
CODABAR, EAN, UPC, ITF, RSS…)។ ក្នុងចំណោមនោះ **ITF, CODABAR និង CODE_39
គ្មានលេខផ្ទៀងផ្ទាត់ជាកាតព្វកិច្ចទេ** — ដូច្នេះស្លាកមួយអាចត្រូវអាន **ចេញជាលេខ
ផ្សេងទាំងស្រុង** ដោយ «ជោគជ័យ» ដោយគ្មានសញ្ញាព្រមានអ្វីសោះ។ នេះជាឫសគល់នៃ
បញ្ហា «ជូនកាល recognize លេខ barcode ខុស»។

- ឥឡូវនេះទទួល **តែ CODE_128 មួយប៉ុណ្ណោះ** (format ដែលកញ្ចប់អីវ៉ាន់ប្រើ) ទាំង
  ផ្លូវ ZXing (iPhone) និងផ្លូវ BarcodeDetector (Android)។ CODE_128 មានលេខ
  ផ្ទៀងផ្ទាត់ mod-103 **ជាកាតព្វកិច្ច** ➜ ការអានខុសស្ទើរតែមិនអាចកើតឡើងបាន។
- បន្ថែម **ជាន់ការពារទី ២**៖ លេខមួយត្រូវអានឃើញ **ដដែល ២ ស៊ុមជាប់គ្នា** ទើប
  ទទួលយក។ ការអានខុសម្តងឯង (ដែលមិនដែលកើតឡើងដដែលពីរដង) ឆ្លងមិនរួច។
  អ្នកប្រើមិនកត់សម្គាល់ការពន្យារនេះទេ (ប្រហែល ១ ភាគ ១០ វិនាទី)។
- **ការស្កេន QR ពេល Config/Reconfig មិនរងផលទេ** — វាប្រើម៉ាស៊ីនអានដាច់ដោយឡែក
  (`BrowserQRCodeReader`) ដែលមិនពាក់ព័ន្ធនឹងបញ្ជី format ខាងលើសោះ។
  មានតេស្តអះអាងចំណុចនេះឥឡូវនេះ។
- ជាផលរួម ការស្កេនក៏ **លឿនជាងមុនប្រហែល ៣ ដង** លើស៊ុមដែលមិនទាន់មាន barcode
  (ស្ថានភាពភាគច្រើនពេលកំពុងតម្រង់កាមេរ៉ា) — ២១.៦ ➜ ៧.០ មិល្លីវិនាទី/ស៊ុម។

### កែកំហុស — បញ្ជីប្រវត្តិលោតរំលងលើ iPhone
ពេលរបា Tab ខាងក្រោមលាក់ខ្លួន កូដចាស់ **បង្រួម padding របស់ទំព័រដោយ
animation** ➜ កម្ពស់ប្រអប់រមូរប្តូរ **ចំពេលការរមូរតាមកម្លាំង (momentum) របស់
iOS កំពុងដើរ** ➜ បញ្ជីលោតរំលងភ្លាមៗ។ ឥឡូវនេះកន្លែងរបស់របា Tab ត្រូវកក់ទុក
**ខាងក្នុងប្រអប់រមូរ** ជំនួសវិញ ➜ ការលាក់/បង្ហាញរបា **មិនប្តូរ layout សោះ**។
ព្រមទាំងដក `scroll-behavior: smooth` ចេញពីតារាង និង body — WebKit យកវាទៅ
អនុវត្តលើការរមូរតាមកម្លាំងផងដែរ ដែលធ្វើឲ្យអារម្មណ៍រមូរមិនត្រូវដៃ។

### ផ្លាស់ប្តូរ — របាខាងលើលែងលាក់ខ្លួនទៀត
តាមសំណើអ្នកប្រើ៖ **របា navigation ខាងលើនៅឲ្យឃើញជានិច្ច** ពេលរមូរ។ មានតែ
**របា Tab ខាងក្រោម** ប៉ុណ្ណោះដែលរអិលចេញ។ ដូច្នេះឈ្មោះជំនួញ និងស្ថានភាព
តភ្ជាប់មិនបាត់ពីអេក្រង់ទៀតទេ។

### កែកំហុស — របា Tab លាក់មិនរលូនដូច Android
- ដក **`backdrop-filter: blur(10px)`** ចេញពី navbar។ លើ iOS ការគូរធាតុដែល
  មាន backdrop blur តម្រូវឲ្យគណនា blur ឡើងវិញ **រាល់ស៊ុម** ➜ ញាប់ញ័រ។
  ផ្ទៃខាងក្រោយពីមុនស្រអាប់ត្រឹម ២% ប៉ុណ្ណោះ ដូច្នេះរូបរាងស្ទើរតែមិនប្តូរទេ។
- របា Tab ប្តូរទៅ `translate3d` ➜ ការរំកិលដើរលើ GPU ទាំងស្រុង។
- **ដំឡើងពិដានប្រឆាំងការភ្លឹបភ្លែត**៖ ការរមូរតាមកម្លាំងរបស់ iOS បញ្ចេញចលនា
  បញ្ច្រាសទិសបន្តិចបន្តួច ដែលពីមុនធ្វើឲ្យរបាលេចឡើងចុះម្តងហើយម្តងទៀត។ ឥឡូវ
  ត្រូវរមូរឡើងវិញយ៉ាងតិច ៤៨px ទើបរបាត្រឡប់មក (ពីមុន ១៦px)។

### កែកំហុស — កាមេរ៉ាកកលើ iPhone ក្រោយចុច ✖
ចុច ✖ លើប្រអប់វាយលេខទូរស័ព្ទ ➜ ប្រអប់បញ្ជាក់ native លេចឡើង។ **WebKit ផ្អាក
វីដេអូទាំងអស់ពេលបង្ហាញប្រអប់ native ហើយមិនបន្តវិញដោយស្វ័យប្រវត្តិទេ** ➜
កាមេរ៉ាកកតែម្តង។ (ប៊ូតុង «រំលង» និង «យល់ព្រម» មិនប្រើប្រអប់ native ដូច្នេះ
មិនកកទេ — ត្រូវនឹងអ្វីដែលអ្នកប្រើឃើញ។) ឥឡូវនេះកាមេរ៉ាបន្តដំណើរការវិញ
ស្វ័យប្រវត្តិ ទាំងពេលបញ្ជាក់ ទាំងពេលបោះបង់ ព្រមទាំងក្រោយបិទប្រអប់ណាមួយ។
បន្ថែមទាំងអ្នកឃ្លាំមើលព្រឹត្តិការណ៍ `pause` ជាការការពារជាន់ទី ២។

### ល្បឿន — animation ទូទាំង App
រកឃើញ និងកែ animation ដែលបង្ខំឲ្យ browser ធ្វើការរាល់ស៊ុមដោយមិនចាំបាច់៖

- **បន្ទាត់ស្កេនក្នុងស៊ុមកាមេរ៉ា** ធ្វើចលនាលើ `top` ➜ គណនា layout របស់ទំព័រ
  ឡើងវិញ **រាល់ស៊ុម ចំពេលកំពុងឌិកូដ barcode**។ ប្តូរទៅ `transform` ➜ ដើរលើ
  GPU ទាំងស្រុង។ នេះជាការកែដែលមានឥទ្ធិពលបំផុតលើភាពរលូននៃការស្កេន។
- **ចំណុចស្ថានភាពតភ្ជាប់ (ចំណុចបៃតងលោត)** ធ្វើចលនាលើ `box-shadow` ដោយ
  `infinite` ➜ របាខាងលើត្រូវគូរឡើងវិញរាល់ស៊ុម **ជារៀងរហូត** ទោះគ្មានអ្វី
  កើតឡើងក្តី។ ប្តូរទៅ `transform` + `opacity`។
- **ប៊ូតុង «ខល» ដែលលោតពណ៌** ឥឡូវនៅលើ layer ដោយឡែក ➜ ការគូរឡើងវិញរបស់វា
  លែងធ្វើឲ្យតារាងប្រវត្តិទាំងមូលត្រូវគូរឡើងវិញពេលរមូរ។
- **ដក `transition: all` ចេញទាំង ៥ កន្លែង** (ZoeW ៤ · ZoeKeyGen ១) ➜ សរសេរ
  បញ្ជី property ច្បាស់លាស់វិញ។ `all` បង្ខំ browser ពិនិត្យគ្រប់ property
  ដែលអាចធ្វើចលនាបាន រាល់ការប្តូរស្ថានភាព។
- **ដក backdrop blur ចេញពីប្រអប់ (modal) លើទូរស័ព្ទ** — ប្រអប់លេខទូរស័ព្ទបើក
  រាល់ការស្កេន ហើយ iOS គណនា blur ឡើងវិញរាល់ស៊ុមនៃ animation បើក។
  លើកុំព្យូទ័រ (≥992px) blur នៅដដែល។

ផ្នែក JavaScript ត្រូវបានវាស់រួច ហើយ **មិនមែនជាចំណុចរាំងស្ទះទេ** — នៅ ១២០០
កញ្ចប់៖ គូរតារាងឡើងវិញ ៥ មិល្លីវិនាទី, វាយអក្សរ ១ តួ ១ មិល្លីវិនាទី។

### ឧបករណ៍ audit
- **`animation-cost.js` (ថ្មី)** — ថ្នាក់កំហុស «animation ដែលបង្កើត layout ឬ
  paint រាល់ស៊ុម»។ វារកឃើញ **៨ ករណី** លើកូដមុនកែ។
- **`camera-resume-test.js` (ថ្មី)** — ថ្នាក់កំហុស «កាមេរ៉ាកកក្រោយប្រអប់ native»។
- **`scan-engine-test.js`** — សរសេរឡើងវិញ។ ឥឡូវវាគូរស្លាក **ITF ពិត** មួយ រួច
  បង្ហាញថា reader ១១ format អានវាចេញជា `17251234` ចំណែក reader បច្ចុប្បន្ន
  **បដិសេធ** — ភស្តុតាងផ្ទាល់នៃថ្នាក់កំហុស «អានលេខខុស»។
- **`gesture-test.js`** — បន្ថែម ១០ ការអះអាង៖ ការលាក់របាមិនត្រូវប្តូរ layout,
  ជួរចុងក្រោយត្រូវរមូរផុតពីរបា Tab បាន, និងការប្រឆាំងភ្លឹបភ្លែត។
- **`setup-link-logout-test.js`** — អះអាងថា barcode ដែលទុកសម្រាប់ផ្ទៀងផ្ទាត់
  ការស្កេន មិនរស់រានក្រោយចាកចេញ។
- `run-all.sh` ឡើងដល់ **៥៦ ការត្រួតពិនិត្យ**។ ការអះអាងថ្មីទាំងអស់ត្រូវបាន
  បញ្ជាក់ថា **ធ្លាក់លើកូដមុនកែ** និងធ្លាក់លើ mutation ដែលដកការកែចេញ។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន** — មិនមាន Firebase path ថ្មី និងមិនមានការប្តូរ rules ទេ។

## [2.3.1] — 2026-08-23

**ការទប់ស្កាត់ Barcode ស្ទួន — ផ្ទៀងផ្ទាត់ និងចាក់សោដោយតេស្ត។**

### ការផ្ទៀងផ្ទាត់ (គ្មានការប្តូរឥរិយាបថទេ)
មុខងារទប់ស្កាត់កញ្ចប់ស្ទួន **នៅគ្រប់គ្រាន់ និងដំណើរការត្រឹមត្រូវ** — ការកែល្បឿន
ស្កេនក្នុងកំណែ 2.3.0 មិនបានប៉ះវាទេ។ ជាន់ការពារទាំង ៥៖

១. **ស៊ុមកាមេរ៉ាដដែល** — កូដដដែលក្នុង ២.៥ វិនាទី ត្រូវរំលង ដូច្នេះការស្កេនរហ័ស
   មិនបង្កើតសារព្រមានច្រើនដងទេ (សំខាន់ជាងមុន ព្រោះឥឡូវស្កេនរហូតដល់ ១៦ ដង/វិនាទី)
២. **ពេលស្កេន** — ពិនិត្យទាំងប្រវត្តិ **និងធុងសំរាម**
៣. **ពេលចុចរក្សាទុក** — ពិនិត្យម្តងទៀត (ព្រោះឧបករណ៍ផ្សេងអាចបញ្ចូលក្នុងចន្លោះនោះ)
៤. **ការកក់លើ server** — transaction ដែលការពារឆ្លងឧបករណ៍ (ជាន់ពិតតែមួយគត់ពេល
   ឧបករណ៍ ២ ស្កេនកូដដដែលព្រមគ្នា)
៥. **ពេលបញ្ចូលចូលកញ្ចប់ដែលមានស្រាប់** — បើកូដមានរួច លុយត្រូវបញ្ច្រាសមកវិញ

**ធុងសំរាម៖** កូដក្នុងធុងសំរាមត្រូវបានបដិសេធទាំង ២ ជាន់ — ទាំងការពិនិត្យក្នុង
ឧបករណ៍ និងការកក់លើ server ដែល **មិនត្រូវបានដោះទេ** ពេលកញ្ចប់ចូលធុងសំរាម។
ការកក់ត្រូវដោះតែពេល **លុបជាអចិន្ត្រៃយ៍** ឬពេលធុងសំរាមសម្អាតស្វ័យប្រវត្តិ (១០ ថ្ងៃ)
— ដូច្នេះកូដមិនជាប់សោរហូតទេ។

អក្សរតូច/ធំ និងចន្លោះ ត្រូវចាត់ទុកជាកូដដដែល (`  zto900111  ` = `ZTO900111`)។

### ឧបករណ៍ audit
- **ថ្មី `audit-tools/duplicate-scan-test.js`** — រត់ផ្លូវស្កេន **ពិត** ក្នុង
  Chromium (ស្កេន ➜ រក្សាទុក ➜ ស្កេនម្តងទៀត) ហើយពិនិត្យទិន្នន័យលើ server ពិត។
  គ្របលើ៖ ស្កេនស្ទួន · អក្សរតូច/ធំ · កូដក្នុងធុងសំរាម (ទាំងបែប «ដក» និង «លុប») ·
  ការកក់នៅដដែលពេលចូលធុងសំរាម · ការដោះកក់ពេលលុបជាអចិន្ត្រៃយ៍ · ការប្រណាំង
  ឧបករណ៍ ២ · debounce។ **បញ្ជាក់ដោយ mutation ៥ ជាន់ដាច់ដោយឡែក។**

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** មិនចាំបាច់ប៉ះ Firebase Console ទេ។

---

## [2.3.0] — 2026-08-23

**ការស្កេនលើ iPhone លឿនជាងមុនច្រើន។**

### ហេតុអ្វី iPhone យឺតជាង Android
`BarcodeDetector` ដែល Android ប្រើ គឺជា API របស់ Chromium ហើយវាឌិកូដដោយកូដដើម
របស់ប្រព័ន្ធ។ **Safari មិនមាន API នេះទេ** (Chrome លើ iPhone ក៏ប្រើ WebKit ដែរ
ដូច្នេះក៏គ្មានដែរ) — ដូច្នេះលើ iPhone មានតែ **ZXing ដែលជា JavaScript សុទ្ធ**
ដែលដំណើរការ។ នោះជាឫសគល់ពិតនៃគម្លាតល្បឿន។ *(សាខាកូដដែលព្យាយាមរត់ម៉ាស៊ីនទាំង ២
ព្រមគ្នាលើ iOS គឺជាកូដស្លាប់ — វាមិនដែលរត់ទេ។ បានដកចេញ។)*

### អ្វីដែលធ្វើឲ្យវាលឿន
ការវាស់លើផ្លូវឌិកូដពិត បង្ហាញថា **បញ្ជីប្រភេទ Barcode ទើបជាតម្លៃពិត** មិនមែន
ទំហំរូបភាពទេ។ លើស៊ុមដែល **គ្មាន** Barcode (ភាគច្រើននៃស៊ុមពេលកំពុងតម្រង់កាមេរ៉ា)៖

| ចំនួនប្រភេទដែលសាកល្បង | ពេលវេលាក្នុងមួយស៊ុម |
|---|---|
| ១១ ប្រភេទ (មុន) | ~២០ ms |
| ១ ប្រភេទ | ~៤ ms |

ដូច្នេះការស្កេនឥឡូវមាន **២ ជាន់**៖
- **ជាន់លឿន** រត់រាល់ស៊ុម ដោយសាកតែប្រភេទដែលអាជីវកម្មប្រើពិត (ចាប់ផ្តើមពី CODE_128)
- **ការបោសពេញ** រត់រាល់ស៊ុមទី ៤ ដោយសាកគ្រប់ ១១ ប្រភេទ ដូច្នេះ **គ្មានប្រភេទណាបាត់ទេ**
- **ជាន់លឿនប្ដូរខ្លួនស្វ័យប្រវត្តិ** ទៅតាមប្រភេទដែលរកឃើញពិត — បើអាជីវកម្មប្រើ
  CODE_39 ឬប្រភេទផ្សេង វាប្ដូរតាមដោយខ្លួនឯង ដោយមិនចាំបាច់កំណត់អ្វីទេ

បន្ថែមទៀត៖
- ស៊ុមដែលបោសពេញ ឥឡូវ**បម្លែងរូបភាពតែម្តង** ជំនួសពីរដង
- ចន្លោះពេលរវាងការស្កេន ឥឡូវ**សម្របតាមល្បឿនឧបករណ៍** (៦០–២២០ms) ជំនួស ១៣០ms ថេរ
  ➜ លើឧបករណ៍លឿន វាស្កេនញឹកជាងមុនជិត ២ ដង
- ទំហំរូបភាពដែលឌិកូដ ៨០០px ➜ ៦៤០px
- **ផ្លូវ Android ក៏លឿនជាងមុនដែរ**៖ ចន្លោះពេលថេរ ២៥០ms (៤ ដង/វិនាទី) ក្លាយជា
  សម្របតាមល្បឿនដូចគ្នា ➜ រហូតដល់ ~១៦ ដង/វិនាទី

លទ្ធផលរួម (វាស់លើផ្លូវពិត)៖ ពេលវេលាមធ្យមក្នុងមួយស៊ុម **~១៧.៦ms ➜ ~៩.៥ms**
ហើយសម្រាប់ប្រភេទដែលអាជីវកម្មប្រើពិត **~២០ms ➜ ~៤ms**។

### ឧបករណ៍ audit
- **ថ្មី `audit-tools/scan-engine-test.js`** — វាស់ផ្លូវឌិកូដ **ពិត** ចេញពី
  `app.js` ក្នុង Chromium ពិត លើ CODE_128 ដែលបង្កើតក្នុងតេស្ត (ZXing ពិតជាអ្នក
  បញ្ជាក់ថាវាត្រឹមត្រូវ)។ វាស់ទាំងផ្លូវជោគជ័យ និងផ្លូវបរាជ័យ ព្រមទាំងបញ្ជាក់ថា
  ជាន់លឿនប្ដូរតាមប្រភេទដែលរកឃើញពិត។ **ធ្លាក់លើ tree មុនកែ។**

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** មិនចាំបាច់ប៉ះ Firebase Console ទេ។

---

## [2.2.1] — 2026-08-23

**ផ្ទាំងប្រវត្តិពេញអេក្រង់ពិតប្រាកដ, ការទាញ Refresh ជ្រៅជាងមុន និងធុងសំរាមលែងគាំង។**

### កែកំហុស
- **ផ្ទាំងប្រវត្តិឥឡូវពេញអេក្រង់ពិត ពេលទាញឡើង។** កូដចាស់កំណត់កម្ពស់តារាងជា
  ភាគរយថេររបស់អេក្រង់ (`62vh` / `78vh`) ដែល **មិនដឹង**កម្ពស់ navbar, ក្បាលកាត,
  របាច្រោះ, របា Tab និង safe-area ឡើយ — ដូច្នេះវាមិនដែលត្រូវទេ។ លទ្ធផលពិត៖
  លើអេក្រង់ខ្លះនៅសល់ចន្លោះទទេ លើអេក្រង់ខ្លះទៀតកាតលើសចេញក្រៅ ➜ ទំព័រខាងក្រៅ
  រមូរជំនួសតារាង។ ឥឡូវប្រើខ្សែសង្វាក់ flex ដែល **បំពេញកន្លែងដែលនៅសល់ពិត** ➜
  គ្មានចន្លោះទទេ **លើគ្រប់ទំហំអេក្រង់** (វាស់នៅ 640/780/900/1024px)។
- **កន្លែងដែលរបា Tab កក់ទុក ត្រូវប្រគល់មកតារាងវិញ** ពេលរបានោះលាក់ខ្លួន។
- **ធុងសំរាមលែងគាំងពេលបើក។** វាធ្លាប់សាងជួរដេកមួយៗដោយ `innerHTML` ដាច់ដោយឡែក
  **ដោយគ្មានពិដាន** — ធុងសំរាមអាចផ្ទុករហូតដល់ ១០ ថ្ងៃ។ ឥឡូវសាងជាខ្សែអក្សរតែមួយ
  ហើយកំណត់ ២០០ ជួរដេក (ដូចបញ្ជីកញ្ចប់ថ្ងៃនេះ និងបញ្ជីទីតាំង)។

### ផ្លាស់ប្តូរ
- **ការទាញ Refresh ជ្រៅជាងមុន (iOS PWA)** តាមការស្នើ៖ ចម្ងាយម្រាមដៃដែលត្រូវទាញ
  ដើម្បីកេះ **១២០px ➜ ១៥៦px** ហើយចម្ងាយអតិបរមារបស់រង្វង់ **៩២px ➜ ១៣០px**។
  កម្លាំងទប់ (rubber-band) ក៏ទន់ជាងមុនដែរ ដូច្នេះវាមានអារម្មណ៍វែងជាង។

### ឧបករណ៍ audit
- **`gesture-test.js`** — បន្ថែមផ្នែក «ផ្ទាំងប្រវត្តិពេញអេក្រង់»៖ វាស់ចន្លោះទទេ
  ខាងលើ/ខាងក្រោមកាតជា pixel ពិត, បញ្ជាក់ថាទំព័រខាងក្រៅលែងរមូរ, និងវាស់ឡើងវិញ
  លើកម្ពស់អេក្រង់ ៤ ទំហំ។ **ធ្លាក់ ៤ លើ tree មុនកែ** (រួមទាំង `gapBottom: -80px`
  ដែលបង្ហាញថាកាតលើសចេញក្រៅតំបន់មាតិកា)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** មិនចាំបាច់ប៉ះ Firebase Console ទេ។

---

## [2.2.0] — 2026-08-22

**កាយវិការទូរស័ព្ទតាមលំនាំ Facebook៖ pull-to-refresh ដែលលែងកេះខុស និងរបាដែល
លាក់ខ្លួនពេលរមូរ។**

### កែកំហុស
- **ទាញ Refresh លែងកេះខុសពេលកំពុងរមូរ (iOS PWA)។** កូដចាស់រារាំងការរមូរដើម
  (`preventDefault`) **តាំងពី pixel ដំបូង** ដោយគ្មានការសម្រេចថាកាយវិការនោះជាការ
  រមូរ ឬការទាញ — ដូច្នេះការអូសខ្លីៗពីកំពូល ឬសូម្បីតែការអូសផ្ដេក ក៏ក្លាយជា
  pull-to-refresh ភ្លាម។ ការវាស់លើកូដចាស់៖ ការអូសចុះ ១៤px រារាំងការរមូរ ៤ ដង
  ហើយការអូសផ្ដេក ៣ ដង។ ឥឡូវ **០ ទាំងពីរ**។
  ឥឡូវវាដំណើរការដូច Facebook៖
  - ត្រូវអូសចុះយ៉ាងតិច **១៨px** ហើយត្រូវជាទិសបញ្ឈរច្បាស់លាស់ (មិនមែនផ្ដេក) មុននឹងចាប់យក
  - **រំកិលតាមម្រាមដៃដោយមានកម្លាំងទប់ (rubber-band)** មិនមែន ១:១ ទេ
  - ត្រូវទាញ **ជាង ១២០px** ទើប refresh ពិត; តិចជាងនោះវារអិលត្រឡប់វិញយ៉ាងរលូន
  - រង្វង់បង្វិលតាមចម្ងាយទាញ ហើយប្តូរពណ៌ពេលដល់កម្រិត
  - **មិនកេះទេ** ពេលតារាងប្រវត្តិត្រូវបានរមូរចុះរួច, ពេលប្រអប់បើក, ឬពេលម៉ឺនុយបើក

### បន្ថែម
- **របា navigation ខាងលើ និងរបា Tab ខាងក្រោមលាក់ខ្លួនពេលរមូរចុះ ហើយត្រឡប់មក
  វិញពេលរមូរឡើង** — ដូច Facebook។ ចលនាប្រើ `transform` សុទ្ធ (compositor)
  ដូច្នេះវារលូនទោះលើទូរស័ព្ទចាស់។ របាត្រឡប់មកវិញជានិច្ចនៅកំពូលបញ្ជី, ពេលបើក
  ម៉ឺនុយ ឬប្រអប់, ពេលប្តូរទំព័រ និងពេលចុចប្រអប់ស្វែងរកលេខ។
  **លើកុំព្យូទ័រ (≥992px) មុខងារនេះមិនដំណើរការទេ** ព្រោះ layout ២ ជួរឃើញគ្រប់យ៉ាងស្រាប់។

### ផ្លាស់ប្តូរ
- អក្សរក្នុងប៊ូតុង **«📁 យក Barcode ពីរូបភាព»** ឥឡូវនៅចំកណ្តាលប្រអប់។

### កែកំហុសផ្សេង
- **ប្រអប់ស្ថិតិប្រចាំថ្ងៃ/ខែ** លែងអាចគាំង បើ record ណាមួយទទេ។

### ឧបករណ៍ audit
- **ថ្មី `audit-tools/gesture-test.js`** — បញ្ជូន touch event ពិតក្នុង Chromium៖
  ការអូសខ្លី/ផ្ដេក/ឡើងលើ មិនត្រូវកេះ refresh; ការទាញវែងត្រូវកេះ; របាលាក់/បង្ហាញ
  តាមទិសរមូរ។ **ធ្លាក់ ៦ លើ tree មុនកែ។**
- **ថ្មី `audit-tools/export-cells-test.js`** — សរសេរឯកសារ `.xlsx` ពិត រួច
  **អាន XML ខាងក្នុង** ដើម្បីបញ្ជាក់ថាលេខទូរស័ព្ទ និង Barcode ចេញជា TEXT
  (0 នាំមុខមិនបាត់, លេខវែងមិនក្លាយជា `1.23457E+11`) រួមទាំងករណីដែល RTDB ផ្ញើ
  តម្លៃមកជា **number** ពិត។ បញ្ជាក់ដោយ mutation ៣ ជាន់។
- សរុប៖ `bash audit-tools/run-all.sh` ➜ **៥២ ការត្រួតពិនិត្យ ជោគជ័យទាំងអស់**។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** មិនចាំបាច់ប៉ះ Firebase Console ទេ។

---

## [2.1.1] — 2026-08-22

**ជុំ Deep Audit៖ ថ្នាក់កំហុស storage, ការលេចធ្លាយ secret និងល្បឿនផ្ទាំងលាក់។**
កំណែនេះ **មិនប្តូររបៀបប្រើប្រាស់ទេ** — វាកែចំណុចដែលបែកតែក្នុងស្ថានភាពពិសេស
(ទំហំផ្ទុកពេញ, Safari Private Mode) ព្រមទាំងធ្វើឲ្យ App រលូនជាងមុនពេលស្កេនច្រើនតគ្នា។

### កែកំហុស
- **កញ្ចប់ដែលស្កេនអាចបាត់ស្ងាត់ៗ។** ការរក្សាទុកទីតាំង Locker ចុងក្រោយចូល
  localStorage កើតឡើង **មុន** ផ្លូវ Save។ ពេលទំហំផ្ទុកពេញ ឬលើ Safari Private Mode
  វាបញ្ឈប់ដំណើរការទាំងស្រុង ➜ កញ្ចប់មិនត្រូវបានរក្សាទុក **ហើយគ្មានសារព្រមានទេ**។
- **«ការចូលប្រព័ន្ធមិនជោគជ័យ» ទោះការចូលបានជោគជ័យមែន** — ការចងចាំអ៊ីមែលបរាជ័យ
  ធ្វើឲ្យសារកំហុសលោតឡើងខុស។
- **ការដោះសោដោយ PIN អាចបរាជ័យពាក់កណ្តាលផ្លូវ** ដោយហេតុផលដដែល។
- ផ្លូវ **កំណត់ទូ Locker**, **ជ្រើសទីតាំង**, **ប្តូររបៀបស្កេន**, **អត្រាប្រាក់**
  និង **Config API ស្វែងរកអតិថិជន** — ទាំងអស់ការពារដូចគ្នា។ Config API ឥឡូវ
  **ប្រាប់អ្នកប្រើ ហើយមិនបិទប្រអប់** បើរក្សាទុកមិនបាន (ពីមុនបិទស្ងាត់ៗដោយបាត់ទិន្នន័យ)។
- **លំដាប់បញ្ជីទីតាំង Locker អាចខូច** ពេលកញ្ចប់គ្មានពេលវេលាកំណត់ទីតាំង។
- **ការកែទឹកប្រាក់តាមកញ្ចប់អាចគាំង** ពេលមិនទាន់ភ្ជាប់ Firebase។ ឥឡូវត្រឡប់
  ទឹកប្រាក់មកវិញ ហើយប្រាប់អ្នកប្រើ។
- **តារាងអតិថិជនអាចទាញទិន្នន័យខុស** បើ URL របស់ API មិនប្រើឈ្មោះ param `code`។
- **ប្រអប់កាមេរ៉ាបង្ហាញអត្ថបទចាស់** ពេលបិទដោយប្តូរទំព័រ ឬចេញពី App បណ្តោះអាសន្ន។

### សុវត្ថិភាព
- **PIN និងពាក្យសម្ងាត់លែងនៅសល់ក្នុងអេក្រង់ក្រោយចាកចេញ។** PIN មិនត្រឹមតែជាសោទ្វារទេ —
  វាជាកូនសោដែលឌិគ្រីប Secret របស់ Lookup API ដូច្នេះ PIN ដែលនៅសល់ = Secret ដែលនៅសល់។
  អនុវត្តទាំង ZoeW និង ZoeKeyGen។
- **ការរាយការណ៍កំហុសលែងផ្ញើ Firebase Config ចេញក្រៅ។** Sentry ដែលចាប់ផ្តើមពី
  script ក្នុង `index.html` ធ្លាប់ផ្ញើ URL ឆៅ រួមទាំង Setup Link ដែលផ្ទុក Config ទាំងមូល។
- **ពង្រីកបញ្ជីតម្លៃដែលត្រូវលាក់** មុនផ្ញើរបាយការណ៍កំហុស (`setup`, `secret`,
  `token`, `api_key`, `password`, `signature` ។ល។) ព្រមទាំងគ្របលើតួសាររបស់កំហុស
  មិនត្រឹមតែ URL។ **លេខ Barcode និងលេខសម្គាល់កញ្ចប់នៅដដែល** ព្រោះត្រូវការសម្រាប់តាមដានបញ្ហា។
- **Firebase rules — ពិនិត្យលើ emulator ពិត រកមិនឃើញកំហុសទេ** (21/21 បូកការសាកល្បង
  បន្ថែម៖ អានទិន្នន័យទាំងអស់ចេញពី root, លុបចំណូល/ប្រវត្តិទាំងមូលក្នុងសំណើតែមួយ)។
  **គ្មានការកែ rules ក្នុងកំណែនេះទេ។**

### ល្បឿន
- **App លែងសាងផ្ទាំងទំព័រ «បញ្ចូលទិន្នន័យ» ឡើងវិញ ខណៈអ្នកប្រើនៅទំព័រ «ទិន្នន័យ»។**
  វាស់នៅ ១២០០ កញ្ចប់៖ ~២២ms ➜ ~៥ms ក្នុងមួយការធ្វើបច្ចុប្បន្នភាព។ នេះជាការកែ
  ដែលមានឥទ្ធិពលបំផុតលើភាពរលូនពេលស្កេនច្រើនតគ្នា។
- **បញ្ជីទីតាំង Locker** ឥឡូវមានពិដាន ២០០ ជួរដេក (ដូចបញ្ជីកញ្ចប់ថ្ងៃនេះ)
  ហើយគណនាទីតាំងម្តងក្នុងមួយកញ្ចប់ជំនួសឲ្យ ៤ ដង (~១២ms ➜ ~៤ms)។
- **បញ្ជីលេខទូរស័ព្ទដែលស្នើ** លែងសាងឡើងវិញបើលេខមិនប្រែ។

### ឧបករណ៍ audit
- **ថ្មី `audit-tools/storage-guard.js`** — រាល់ការសរសេរទៅ localStorage/sessionStorage
  ត្រូវមានការការពារ។ ធ្លាក់ ២០ លើ tree មុនកែ។
- **ថ្មី `audit-tools/secret-hygiene.js`** — រាល់វាល credential ត្រូវសម្អាតនៅផ្លូវ
  ចាកចេញ; ការលាក់ secret មុនផ្ញើទៅ Sentry (រត់កូដពិត)។ ធ្លាក់ ៦ លើ tree មុនកែ។
- **`perf-check.js`** — បន្ថែម assertion ថាការ sync ខណៈនៅទំព័រ ១ មិនសាងផ្ទាំង
  ទំព័រ ២ ឡើងវិញ។ ធ្លាក់លើ tree មុនកែ។
- សរុប៖ `bash audit-tools/run-all.sh` ➜ **៥០ ការត្រួតពិនិត្យ ជោគជ័យទាំងអស់**។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- **គ្មាន។** មិនចាំបាច់ប៉ះ Firebase Console ទេ។

---

## [2.1.0] — 2026-08-22

### បន្ថែម
- **ចូលដោយក្រយៅដៃ ឬមុខ (WebAuthn)** — ជាការ *ដោះសោ* PIN មិនមែនជំនួស PIN ទេ។
  បើក/បិទក្នុងរបា Slide; ការបើកតម្រូវឲ្យវាយ PIN ពិតជាមុនជានិច្ច។
- **កំណែ App បង្ហាញក្នុងរបា Slide** បន្ថែមលើប្រអប់ login។

### ផ្លាស់ប្តូរ
- **ZoeKeyGen លែងមានប្រអប់ជ្រើសរើស App** — ប្រព័ន្ធមាន App តែមួយ (ZoeW)។

### សកម្មភាពដែលត្រូវធ្វើដោយដៃ
- គ្មាន។

---

## [2.0.2] — 2026-08-22

### កែកំហុស
- **តារាងប្រវត្តិលើកុំព្យូទ័រ** ឥឡូវពេញកម្ពស់ជួរ។

### ឧបករណ៍ audit
- បន្ថែម checker ថ្នាក់ថ្មី។

---

## [2.0.1] — 2026-08-22

### កែកំហុស
- **ស្តារកាយវិការអូសផ្ទាំងប្រវត្តិ** និង **auto pull up** នៃប្រអប់ស្វែងរកលេខ
  ដែលបាត់ក្រោយការបញ្ចូល App។
- **ប្រអប់ PIN បង្ហាញសារតាមប៊ូតុងដែលហៅ** ជំនួសសារ «Config ឬ Reconfig» លើគ្រប់ប៊ូតុង។

---

## [2.0.0] — 2026-08-22

### ផ្លាស់ប្តូរធំ
- **បញ្ចូល App ទាំង ៣ ជា ZoeW តែមួយ** ហើយ **លុបតួនាទី `admin`/`worker`/`scanner` ចេញ**
  ពី App អាជីវកម្ម។ អ្នកប្រើដែលចូលប្រព័ន្ធបានមានសិទ្ធិដូចគ្នា។
  *(ZoeKeyGen នៅតែប្រើតួនាទី `admin` ក្នុង License Project ដាច់ដោយឡែករបស់វា។)*
- **រចនាសម្ព័ន្ធ ២ ទំព័រ** — ទំព័រ «ទិន្នន័យ» និងទំព័រ «បញ្ចូលទិន្នន័យ» បូករបា Tab។
- **របា Slide (ម៉ឺនុយ)** ផ្ទុក Config, API ស្វែងរកអតិថិជន, តារាងអតិថិជន,
  កំណត់ទូ Locker និងប៊ូតុងចូល/ចាកចេញ។
- **Layout ២ ជួរពេញអេក្រង់សម្រាប់កុំព្យូទ័រ** (≥992px)។
- បន្ថែម **បញ្ជីកញ្ចប់ថ្ងៃនេះ**។

---

## [1.0.4] និងមុននេះ — 2026-08-21 ដល់ 2026-08-22

កំណែមុនការបញ្ចូល App (`ZoeAdmin` / `ZoeW` / `ZoeScan` ដាច់ដោយឡែក)។
ចំណុចសំខាន់ៗ៖

- **1.0.4** — អនុវត្តការកែពីជុំ audit ១៦។
- **1.0.2** — **កែលេខទូរស័ព្ទ៖ បំពេញលេខ 0 នាំមុខពេលរក្សាទុក** និងគាំទ្រលេខ
  ទូរស័ព្ទពីរខ្សែបំបែកដោយ `/`។
- **1.0.1** — កែកំហុសជុំ ១៥៖ ស្ថិតិអតិថិជន, ការស្តារពីធុងសំរាម និងទីតាំង។

ចំពោះប្រវត្តិលម្អិតមុនកំណែ 2.0.0 សូមមើល `git log`។
