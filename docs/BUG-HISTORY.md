# ប្រវត្តិកំហុស និងការវាស់ — Zoe-System

> **ឯកសារនេះជា *ប្រវត្តិ* មិនមែន *ច្បាប់* ទេ។** ច្បាប់ដែលត្រូវអនុវត្តរស់នៅ
> ក្នុង [`CLAUDE.md`](../CLAUDE.md) ហើយ **ច្បាប់នីមួយៗត្រូវចងទៅឧបករណ៍ដែល
> ចាក់សោវា**។ ត្រង់នេះជាកន្លែងទុក *របៀបដែលកំហុសនីមួយៗត្រូវបានរកឃើញ និង
> លេខដែលវាស់បាន* — មានតម្លៃពេលត្រូវយល់ **ហេតុអ្វី** ច្បាប់មួយមាន តែវាមិន
> ត្រូវការការអានរាល់ session ទេ។
>
> ### ហេតុអ្វីឯកសារនេះមាន
>
> `CLAUDE.md` ធ្លាប់ធំដល់ **២ ៥០៨ បន្ទាត់ / ២៨៧ kB** ដែល **៦៨ ក្នុងចំណោម
> ៧៥ ចំណងជើង** ជារឿងអតីតកាល (⛔/🔴)។ រាល់ជុំ audit **បន្ថែម** ផ្នែកថ្មី
> ដោយមិនដែលបង្រួម ➜ ឯកសារកាន់តែធំ ➜ កាន់តែមិនត្រូវបានអនុវត្ត។
>
> ភស្តុតាងច្បាស់បំផុត៖ មេរៀន **«checker មិនបានពិនិត្យអ្វីសោះ»** ត្រូវបាន
> សរសេរក្នុងឯកសារនោះ **១៣ ដង** ឆ្លងកាត់កំណែ 2.12.1 · 2.16.0 · 2.17.3 ·
> 2.19.1 · 2.19.3។ **ការសរសេរវាលើកទី ១៣ មិនបានទប់ការកើតឡើងលើកទី ១៤ ទេ។**
> ការកត់ត្រាមិនមែនជាការអនុវត្តទេ — មានតែ **ឧបករណ៍ដែលធ្វើឲ្យ build ធ្លាក់**
> ទេដែលអនុវត្តបាន។ នោះជាមូលហេតុនៃ `checker-coverage.js`។

---

## ធនធានខាងក្រៅ និង service worker — READ BEFORE ADDING ANY CDN

**engine ស្កេនស្ថិតក្នុង repo — កុំនាំវាទៅ CDN។** មុននេះ ZXing មកពី unpkg.com
ហើយ `sw.js` បោះបង់រាល់សំណើឆ្លង origin ➜ វា **មិនដែលចូល cache ទេ** ➜ ពេលបណ្តាញ
ខ្សោយ **ការស្កេនកាមេរ៉ាមិនដើរសោះ** ខណៈ App មើលទៅដូចដំណើរការធម្មតា។

**កំណែ 2.10.0 ប្តូរ engine ទៅ ZXing C++ ដែលចងក្រងជា WebAssembly** (`zxing-wasm`
3.1.3)។ ឯកសារមាន **២** ហើយ **ទាំង ២ ត្រូវនៅក្នុង `APP_SHELL`**៖
`ZoeW/vendor/zxing-wasm.js` (glue) និង `ZoeW/vendor/zxing_reader.wasm` (binary)។
បាត់មួយណា ➜ ការស្កេនស្លាប់ពេលបណ្តាញដាច់ ខណៈ App នៅបើកបានធម្មតា។

**ហេតុអ្វី៖** Safari គ្មាន `BarcodeDetector` ➜ iPhone ធ្លាក់ទៅ engine JavaScript។
ការវាស់លើ input ដដែល៖ ផ្លូវ **រកមិនឃើញ** (ស៊ុមភាគច្រើនពេលតម្រង់កាមេរ៉ា)
**១៣.៩ ms ➜ ១.៦–២.២ ms**។ ការឌិកូដលែងជាថ្លៃលេចធ្លោទៀតទេ — `getImageData()`
ទើបជាថ្លៃដែលនៅសល់។

> ⚠️ **CSP ត្រូវមាន `'wasm-unsafe-eval'` ក្នុង `script-src`។** បើគ្មាន browser
> **បដិសេធការចងក្រង WebAssembly** ➜ ការស្កេនស្លាប់ទាំងស្រុងលើផលិតកម្ម ខណៈ
> តេស្តក្នុង repo (ដែលរត់គ្មាន CSP) ជោគជ័យទាំងអស់។ ថ្នាក់កំហុសនេះត្រូវបាន
> ចាប់បានពិតក្នុងជុំ 2.10.0។ `netlify.toml` ក៏ត្រូវបម្រើ `.wasm` ជា
> `application/wasm` ដែរ បើអត់ browser ធ្លាក់ទៅផ្លូវ instantiate យឺត។
> `scan-engine-test.js` ចាក់សោទាំង ២ ចំណុច។

**ដើម្បីឡើងកំណែ**៖ `npm i zxing-wasm@<new>` រួច
`cp node_modules/zxing-wasm/dist/iife/reader/index.js ZoeW/vendor/zxing-wasm.js`
និង `cp node_modules/zxing-wasm/dist/reader/zxing_reader.wasm ZoeW/vendor/`
រួចរត់ `scan-engine-test.js` និង `offline-shell-test.js` ឡើងវិញ។
`offline-shell-test.js` ផ្ទៀងផ្ទាត់ថា binary ត្រូវនឹង sha256 ដែល glue រំពឹងទុក
ដូច្នេះការចម្លងតែឯកសារមួយនឹងធ្លាក់ភ្លាម។

**ឈ្មោះ format ប្តូរ**៖ `SCAN_FORMAT_NAMES = ['Code128']` (មិនមែន `'CODE_128'` ទេ)
ព្រោះ zxing-wasm ប្រើឈ្មោះរបស់ ZXing C++។ ការស្កេន QR ប្រើ
`CONFIG_QR_FORMAT_NAMES = ['QRCode']` ដាច់ដោយឡែកដដែល។

**ការឌិកូដឥឡូវជា `Promise`។** ផ្លូវ live មាន guard `liveDecodeBusy` ដើម្បីកុំឲ្យ
ការឌិកូដជាន់គ្នា; `takeFreshVideoFrame()` និង `confirmLiveScan()` (២ ស៊ុមជាប់គ្នា)
នៅដំណើរការដដែល។ **កុំប្រើ `.then(A).catch(B)`** — ប្រើទម្រង់ ២ អាគុយម៉ង់
(`.then(ok, fail)`) តាមច្បាប់គម្រោង។

**`sw.js` ត្រូវដំឡើងធនធានស្នូលជា *ក្រុម* (កំណែ 2.11.4) — កុំត្រឡប់ទៅ
`cache.add().catch(() => {})` លើគ្រប់ធនធានវិញ។** មុននេះរាល់ធនធានប្រើ
`.catch(() => {})` ➜ ការបរាជ័យត្រូវលេប ➜ បើបណ្តាញដាច់កណ្តាល install នោះ SW
**activate ហើយចាប់យក client** ខណៈ `zxing_reader.wasm` មិនចូល cache ➜
**App បើកបានធម្មតា តែការស្កេនស្លាប់ស្ងាត់ៗពេលក្រៅបណ្តាញ** — ជាថ្នាក់កំហុស
ដដែលដែលការនាំ ZXing ចូល repo ដោះស្រាយ។ ឥឡូវ៖

- `CORE_SHELL` ប្រើ `cache.addAll()` (atomic — ធ្លាក់មួយ ➜ ធ្លាក់ទាំងក្រុម)
  ➜ install បរាជ័យ ➜ SW ចាស់នៅដដែល ➜ browser ព្យាយាមម្តងទៀត។
- `OPTIONAL_SHELL` (icon, manifest) នៅតែអនុគ្រោះដដែល។
- `self.skipWaiting()` ត្រូវហៅ **ក្នុងផ្លូវជោគជ័យ** មិនមែន synchronously ក្រៅ
  `waitUntil` ទេ។
- Navigate fallback ត្រូវជា `cache.match('./index.html').then((f) => f || Response.error())`
  ព្រោះ `caches.match()` អាចត្រឡប់ `undefined` ➜ `respondWith(undefined)` បោះ
  TypeError ➜ ទំព័រទទេជំនួសសំបកដែល cache ទុក។

Test៖ **`sw-install-integrity-test.js`** (បដិសេធធនធានស្នូលដោយចេតនាកណ្តាល install)។

**`sw.js` ត្រូវឆ្លើយតបសំបកដែល cache ទុក **ភ្លាម** — កុំត្រឡប់ទៅការប្រណាំង
៣ វិនាទីវិញ (កំណែ 2.12.1)។** មុននេះរាល់សំណើធ្វើ
`Promise.race([networkFetch, setTimeout(() => cached, 3000)])`។ ព្រោះឯកសារ
ផ្ទុក **តៗគ្នា** (`index.html` ➜ script ➜ wasm) ការពន្យារនោះ **គុណតាមខ្សែសង្វាក់**
➜ វាស់លើ Chromium ពិត (server ពន្យារ ៥ វិ., cache ពេញ)៖ **៩០៤០ ms**។
ក្រោយប្តូរទៅ cache-first + revalidate ខាងក្រោយ៖ **៧០ ms**។

- `SHELL_PATHS` (ពី `CORE_SHELL` + `OPTIONAL_SHELL`) កំណត់ **ទាំង** អ្វីដែល
  ឆ្លើយតបពី cache មុន **និង** អ្វីដែលអនុញ្ញាតឲ្យ `cache.put()`។ មុននេះ
  `cache.put` ទទួលសំណើ same-origin **ណាមួយ** ដែល `ok` ➜ endpoint ទិន្នន័យ
  នៅថ្ងៃក្រោយនឹងធ្លាក់ចូល cache ហើយ **រស់រានក្រោយចាកចេញ** — ថ្នាក់កំហុសដដែល
  នឹងការលេចធ្លាយ Setup Link ក្នុង 2.11.6។
- `revalidateShell()` រត់ក្នុង `event.waitUntil()` ហើយ **រំលងពេល
  `navigator.onLine === false`**។ សម្រាប់ navigate វាទាញ `'./index.html'`
  ត្រង់ៗ ជំនួសការផ្ញើ URL ពេញ (ដែលអាចផ្ទុក `?setup=…`) ទៅ server ម្តងទៀត។
- **កំណែថ្មីនៅតែមកដល់ដដែល** — ផ្ទៀងផ្ទាត់ដោយ probe ពិត៖ bump `CACHE_VERSION`
  ➜ install ទាញឡើងវិញទាំងក្រុម ➜ activate លុប cache ចាស់ ➜ **ការ Refresh
  បន្ទាប់ទទួលកូដថ្មីភ្លាម** (មិនមែនយឺតមួយជុំទេ)។ ដូច្នេះការប្រណាំងក្នុងមួយ
  សំណើគ្មានតម្លៃអ្វីសោះ — វាគ្រាន់តែធ្វើឲ្យការបើកយឺត។

Test៖ **`sw-shell-latency-test.js`** (វាស់ការបើកលើ server ដែលពន្យារ ៥ វិ.)។

**`revalidateShell()` ត្រូវមាន `AbortController` និងពិដានចំនួនស្របគ្នា
(កំណែ 2.14.0)។** វារត់ក្នុង `event.waitUntil()` សម្រាប់ **រាល់ឯកសារ**នៃសំបក
➜ ការបើកទំព័រតែម្តងបង្កើតសំណើ ៨–១០។ មុនកែវាជា `fetch()` ឆៅ គ្មានពេលកំណត់
➜ លើបណ្តាញ «ភ្ជាប់តែស្លាប់» សំណើទាំងនោះព្យួររហូតដល់ពេញពិដាន same-origin
របស់ browser (៦)។ វាស់លើ Chromium ពិត (server ទទួលការតភ្ជាប់ តែមិនឆ្លើយ)៖
សំណើ same-origin ថ្មី **មិនដែលទៅដល់ server សោះ** (អស់ ១២ វិ.) ➜ ក្រោយកែ
**~៦ ms**។ ឥឡូវ៖ `REVALIDATE_TIMEOUT_MS` ៦ វិ. (abort ពិត),
`REVALIDATE_MAX_IN_FLIGHT` ៤ និង dedup តាមកូនសោក្នុង `revalidateInFlight`។
ការធ្វើឲ្យស្រស់ជាការងារ **ស្រេចចិត្ត** — កំណែថ្មីមកតាមផ្លូវ `CACHE_VERSION`
ដូច្នេះការឲ្យវាធ្វើឲ្យសំណើ **ចាំបាច់** ស្លាប់ គឺជាការដោះដូរដែលខុសទាំងស្រុង។
កែទាំង ៣ App។ Test៖ **`sw-revalidate-pressure-test.js`**។

**រាល់ `fetch()` ទៅ endpoint ខាងក្រៅត្រូវឆ្លងកាត់ `fetchWithTimeout()`។**
`withTimeout(fetch(…))` **មិន abort សំណើទេ** — វាគ្រាន់តែឈប់រង់ចាំ។ ផល ២៖
ជាមួយ `retryAsync` សំណើជាន់គ្នាស៊ី bandwidth; ហើយ timeout គ្របតែ **header**
ដូច្នេះ `res.json()`/`res.text()` អាច **ព្យួររហូត** បើ server ផ្ញើ header រួច
ឈប់ផ្ញើតួ។ `fetchWithTimeout()` ប្រើ `AbortController` ហើយ timer របស់វារស់
រហូតដល់ **អានតួចប់**។ វាត្រឡប់ `{ res, body }` ដូច្នេះអ្នកហៅត្រូវអាន
`out.res.ok` និង `out.body`។

> ⚠️ **`license-verify.js` ធ្លាប់មានកំហុសដដែលនេះរហូតដល់កំណែ 2.11.6** ទោះឯកសារ
> នេះធ្លាប់សរសេរថាវា «ធ្វើរួចហើយ»។ វា `clearTimeout` ក្នុង `finally` របស់
> `fetch` ➜ timer ស្លាប់ភ្លាមពេល **header** មកដល់ ➜ `res.json()` ខាងក្រោយ
> គ្មានអ្វីការពារ។ ព្រោះ `checkOnline()` ដើរតាមកាលវិភាគ (`ensureAppActivated`
> ជារង្វង់) សំណើព្យួរ **កកកុញមួយក្នុងមួយជុំ** រហូតដល់ Refresh។ ឥឡូវទាំង ២
> ឯកសារឆ្លងកាត់ helper ដែល abort ពិត — `license-verify.js` មាន
> `fetchWithBodyTimeout()` របស់វា (វាជា REST-only គ្មាន `app.js` ជុំវិញ)។
> **មេរៀន៖ ការអះអាងក្នុងឯកសារនេះមិនមែនជាភស្តុតាងទេ — កូដទើបជាភស្តុតាង។**

Test៖ **`network-timeout-test.js`** (គ្រប `ZoeW/app.js`, `license-verify.js`
**និង `ZoeKeyGen/app.js`** — App ចុងក្រោយត្រូវបានបន្ថែមក្នុងកំណែ 2.12.1
ព្រោះ `readUserRoleViaRest()` របស់វាប្រើ `fetch()` ឆៅ គ្មាន timeout គ្មាន
`AbortController` ហើយអាន `res.json()` ក្រៅបង្អួចការពារ ដោយរស់រានពីព្រោះ
តេស្តមិនដែលស្កេនឯកសារនោះសោះ)។


## សម្របតាមគុណភាពតំណ — `linkIsFrugal()` — កំណែ 2.17.4

App សម្របតាម **ឧបករណ៍** តាំងពីមុន (`measureDisplayHz()` · `perf-lite` ·
`LIVE_SCAN_WIDTH_STEPS`) ប៉ុន្តែវា **មិនសម្របតាមតំណបណ្តាញទេ**។ ឥឡូវ
`linkIsFrugal()` អាន `navigator.connection` ហើយ **ការងារស្រេចចិត្ត** ឈប់
ដោយខ្លួនឯងលើ **2G · slow-2G · ឬពេលអ្នកប្រើបើក «Data Saver»**៖

| កន្លែង | អ្វីដែលរំលង | ហេតុអ្វីវាស្រេចចិត្ត |
|---|---|---|
| `revalidateShell()` (**sw.js ទាំង ៣**) | ការធ្វើឲ្យសំបកស្រស់ខាងក្រោយ (សំណើ ៨–១០ ក្នុងមួយការបើកទំព័រ) | កំណែថ្មីមកតាមផ្លូវ `CACHE_VERSION` ស្រាប់ |
| `prefetchCustomerDataTableRowsIfConfigured()` (ZoeW) | ការទាញតារាងអតិថិជនទាំងមូល រៀងរាល់ ១៥ នាទី | ទិន្នន័យទាញតាមតម្រូវការបានស្រាប់ |

⛔ **វាត្រូវ fail open។** browser ដែលគ្មាន NetworkInformation API
(**Safari/iOS — គ្មានទាល់តែសោះ**) ត្រូវទទួលឥរិយាបថ **ដដែលនឹងមុនបេះបិទ**។
ការ fail closed នឹងបិទការធ្វើឲ្យស្រស់លើ iPhone ទាំងអស់ — ថ្នាក់កំហុសធ្ងន់
ជាងបញ្ហាដើម។ ក៏ **កុំដក guard `navigator.onLine === false` ចេញ** —
`sw-revalidate-pressure-test.js` អះអាងវា **ខាងក្នុងតួ `revalidateShell()`**។

Test៖ **`adaptive-link-test.js`** (44 assertion, App ទាំង ៣)។

### ⛔ ផ្លូវ cache-miss របស់ `sw.js` ត្រូវនៅ **គ្មានពេលកំណត់** — កំណែ 2.17.5

ជុំ 2.17.5 បានពិចារណាបន្ថែម timeout លើ `fetch(request)` ក្នុងផ្លូវ cache-miss
(ដើម្បីកុំឲ្យទំព័រព្យួរលើបណ្តាញស្លាប់) រួច **បដិសេធវាដោយផ្អែកលើការវាស់**៖

១. `CORE_SHELL` ប្រើ `cache.addAll()` **atomic** ➜ ធនធានស្នូល **មិនអាចបាត់ពី
   cache បានទេ** ក្រោយ install ជោគជ័យ។ មានតែ `OPTIONAL_SHELL` (manifest +
   icon ២) ដែលអាចបាត់ ហើយ **គ្មានមួយណាទប់ការគូរទេ**។
២. `zxing_reader.wasm` = **១ ០៦៨ kB** ➜ **៣១ វិនាទីលើ 2G · ៥៣ វិនាទីលើ
   slow-2G** ដោយស្របច្បាប់។ timeout ១០ វិនាទីនឹង **បោះបង់ធនធានដែលធ្វើឲ្យ
   ការស្កេនដើរក្រៅបណ្តាញ** — ថយក្រោយទៅថ្នាក់កំហុសដដែលដែលកំណែ 2.10.0
   ដោះស្រាយដោយនាំ ZXing ចូល repo។

ការការពារត្រឹមត្រូវគឺ cache-first (មានស្រាប់) បូក `linkIsFrugal()` លើការងារ
**ស្រេចចិត្ត** តែប៉ុណ្ណោះ។ `adaptive-link-test.js` ចាក់សោការសម្រេចនេះ។

### ⛔ ការការពារ «inspect element» ពង្រឹងមិនបានទេ — កុំព្យាយាម

`checkDevTools()` របស់ ZoeKeyGen (វាស់ចម្ងាត់ទំហំបង្អួច ១៦០px) និងការទប់
F12/Ctrl+Shift+I ➜ `about:blank` ជា **ការទប់ស្កាត់តាមទម្លាប់ មិនមែនសុវត្ថិភាព
ទេ**។ វារំលងបានងាយ៖ DevTools ដាក់ដាច់បង្អួច · ម៉ឺនុយ Safari/Firefox ·
remote debugging · `view-source:` · បិទ JS · ឬគ្រាន់តែអាន bundle ក្នុង
Network tab។ **កូដដែលរត់ក្នុង browser របស់អ្នកប្រើ គឺជារបស់អ្នកប្រើ** —
នេះមិនមែនកំហុសទេ ហើយវាកែមិនបានតាមរចនាសម្ព័ន្ធ។

ការការពារពិតគឺអ្វីដែលមានស្រាប់៖ កូនសោ AES ដែល derive ពី PIN (Lookup secret) ·
session-only auth persistence របស់ ZoeKeyGen · Firebase rules · និង
**signing key មិនដែលនៅក្នុង ZoeW សោះ**។ កុំបន្ថែមការទប់ស្កាត់ថ្មីដោយគិតថា
វាបន្ថែមសុវត្ថិភាព — វាបន្ថែមតែកូដ។


## ការលាក់ secret មុនផ្ញើទៅ Sentry ត្រូវ **ដើរលើ event ទាំងមូល** — កំណែ 2.17.4

`redactEvent()` / `redactBreadcrumb()` ធ្លាប់ប៉ះតែវាល **ដែលដាក់ឈ្មោះទុកជាមុន**
(`request.url` · `data.url` · `data.to` · `data.from` · `message` · `extra`
ថ្នាក់ទី ១) ➜ វាលផ្សេងទៀតដែល Sentry SDK បំពេញ **រអិលកាត់ស្ងាត់ៗ**។ វាស់បាន
**៥ ផ្លូវលេចធ្លាយ**៖

| ផ្លូវ | ហេតុអ្វីវាសំខាន់ |
|---|---|
| `crumb.data.arguments` | Sentry 7 រក្សា argument **ឆៅ** របស់ `console.*`; App ហៅ `console.error("Lookup API error:", e)` |
| `request.headers.Referer` | **Setup Link (`?setup=<config អាជីវកម្ម>`) អាចចេញពីឧបករណ៍** |
| `extra` ជាន់ជ្រៅ · array ក្នុង `extra` · `contexts` | អ្វីៗដែលមិនមែនជាខ្សែអក្សរថ្នាក់ទី ១ |

ឥឡូវ `redactDeep()` ដើរលើ **គ្រប់ខ្សែអក្សរ** ជាមួយពិដានជម្រៅ
`REDACT_MAX_DEPTH` (៦) · `REDACT_MAX_NODES` (៥០០០) និង `Set` ការពាររង្វិលជុំ
(event ពិតអាចមាន reference ជុំ ➜ ការដើរដោយគ្មានវានឹងគាំង)។

**ការផ្គូផ្គងឈ្មោះ param ត្រូវ «តាមសមាសភាគ» មិនមែន «ពិតប្រាកដ» (កំណែ 2.17.5)។**
វាធ្លាប់ជាការប្រៀបធៀបពិតប្រាកដនៅព្រំដែន `?`/`&`/`#` ➜ **camelCase និង hyphen
រអិលកាត់ទាំងស្រុង**៖ `?sessionToken=` · `?clientSecret=` · `?X-Api-Key=` ·
`?pin=`។ ឥឡូវ `isSecretParamName()` បំបែកឈ្មោះនៅព្រំដែន camelCase និង
`_ - .` រួចប្រៀបធៀបជា **សមាសភាគដាច់ដោយឡែក**។ ⛔ ច្បាប់នេះជាមូលហេតុដែល
`?spinner=` (`s|pin|ner`), `?design=` (`de|sig|n`) និង `?keyboard=`
(`key|board`) **មិនត្រូវលាក់** — កុំប្តូរវាទៅជាការផ្គូផ្គងបែប «មាននៅក្នុង»
ព្រោះនោះនឹងលាក់អ្វីដែលត្រូវការសម្រាប់ debug។ ក៏លាក់ **Apps Script deployment
ID** (`/macros/s/<ID>/`) ដែលជា **capability URL** ដែរ។

⚠️ **កុំដក «keep case» ចេញ** — `barcode=` និងលេខសម្គាល់ធាតុ (`id_123_abc`)
**មិនត្រូវលាក់ទេ**; គេត្រូវការវាដើម្បី debug។ ការដើរជ្រៅមិនប្តូរច្បាប់នោះ
ព្រោះ `redactUrl()` ប្តូរតែអត្ថបទដែលត្រូវនឹង `secretword=value`។

`error-reporting.js` **byte-identical ទាំង ២ App** ដដែល។
Test៖ **`secret-hygiene.js`** (37 assertion)។

**ស្ថានភាពការតភ្ជាប់ត្រូវរួមបញ្ចូល `navigator.onLine`។** `.info/connected`
របស់ Firebase អាចនៅ `true` រហូតដល់ជាងមួយនាទីក្រោយឧបករណ៍បាត់ WiFi (រង់ចាំ
TCP timeout) ➜ អ្នកប្រើឃើញចំណុចបៃតង «ភ្ជាប់ Server រួចរាល់» ខណៈគ្មានបណ្តាញ
ពិត។ `connectionLooksOnline()` ត្រូវរួម `isDatabaseConnected`,
`navigator.onLine !== false` **និង `!dbListenersFailed`** (ZoeW) ហើយ
`renderConnectionStatus()` ជាកន្លែងសរសេរ UI **តែមួយ** — ក្នុង ZoeKeyGen ដែរ។

**listener ដែល Firebase បោះបង់ មិនត្រឡប់មកវិញដោយខ្លួនឯងទេ (កំណែ 2.11.6)។**
`onValue(ref, cb, errCb)` — ពេល `errCb` បាញ់ (ភាគច្រើន `permission_denied`
ខណៈ token កំពុងធ្វើឡើងវិញ ឬក្រោយប្តូរ rules) នោះ **Firebase ដក listener នោះ
ចេញ**។ មុន 2.11.6 App គ្រាន់តែបង្ហាញសារ «សូម Refresh» ១ ដង ➜ តារាង **កក
ជារៀងរហូត** ខណៈចំណុចស្ថានភាពនៅបៃតង ➜ អ្នកប្រើបន្តស្កេនដោយគិតថាទាន់សម័យ។
ច្បាប់ដែលត្រូវរក្សា៖

- `handleDbListenerError()` លើក `dbListenersFailed`, សរសេរ UI ឡើងវិញ, បង្ហាញ
  សារ **តែមួយ** ក្នុងមួយវគ្គដាច់ (`dbListenerOutageNoticeShown`) រួចកេះ
  `scheduleDbListenerRecovery()` (២/៥/១០/២០/៣០ វិ.)។
- `initDatabaseListeners()` ត្រូវហៅ `detachDatabaseListeners()` **គ្មានលក្ខខណ្ឌ**
  មុនភ្ជាប់ — បើមិនដូច្នេះការស្តារបង្កើត **listener ស្ទួន** លើ ref ដែលមិនទាន់ស្លាប់។
- `dbListenerPendingPaths` (Set នៃ path ទាំង ៦) ➜ ទង់រលត់តែពេល **គ្រប់ path**
  ផ្ញើ snapshot មកវិញ (`noteDbListenerAlive`)។ ការរលត់ដោយ path តែមួយធ្វើឲ្យ
  ការបដិសេធតែលើ `zoew_daily_revenue` (rules ខុសគ្នាតាម path) រអិលកាត់។
- `runScheduledCleanup()` ត្រូវ **ឈប់** ខណៈ `dbListenersFailed` — កុំឲ្យការសម្អាត
  ២ម៉ោង/៨ថ្ងៃ សម្រេចលើ snapshot កក។
- ចាកចេញ ឬប្តូរ Config ➜ `resetDbListenerHealthState()`។

**ការភ្ជាប់ឡើងវិញត្រូវ reset backoff របស់ Firebase។** `goOnline()` តែឯង
**មិន reset ការរង់ចាំខាងក្នុងរបស់ SDK ទេ** ➜ ក្រោយបាត់ WiFi យូរ អ្នកប្រើអាច
មើលចំណុចក្រហមរហូតដល់ជាងមួយនាទី ខណៈបណ្តាញដើរធម្មតាហើយ។ វដ្ត
`goOffline()` + `goOnline()` **reset វា**។ ដូច្នេះ `nudgeDatabaseConnection()`៖

- ភ្ជាប់ស្រាប់ ➜ `goOnline()` ធម្មតា (no-op)។
- ដាច់ **ហើយ** `navigator.onLine !== false` ➜ `forceDatabaseReconnect()`
  (វដ្តពេញ) បូក `scheduleReconnectWatchdog()` (៥/១០/២០/៤០/៦០ វិ.)។
- គ្មានបណ្តាញ ➜ **មិនធ្វើអ្វីទេ** (កុំស៊ីថ្ម)។
- `RECONNECT_FORCE_MIN_GAP_MS` (៣ វិ.) ត្រូវ **តូចជាង** ជំហានដំបូងរបស់ watchdog
  បើមិនដូច្នេះ watchdog ត្រូវលេបដោយ rate limit ហើយមិនដែលព្យាយាមឡើងវិញ។
  `lastForcedReconnectAt === 0` ត្រូវរាប់ថា «មិនដែល» — បើមិនដូច្នេះការភ្ជាប់
  លើកដំបូងត្រូវទប់ ៣ វិនាទីដំបូងនៃអាយុ App។

**ZoeKeyGen ទទួលយន្តការភ្ជាប់ឡើងវិញដដែល bytes ដដែល** — `forceDatabaseReconnect`,
`scheduleReconnectWatchdog`, `clearReconnectWatchdog`, `nudgeDatabaseConnection`។
មានតែ `connectionLooksOnline`, `renderConnectionStatus` និង `setupConnectionRecovery`
ដែលបែកគ្នាដោយចេតនា (class/អត្ថបទ UI ផ្ទុយគ្នា; ZoeKeyGen គ្មាន listener ទិន្នន័យ)
ហើយវាមានហេតុផលសរសេរជាប់ក្នុង `EXPECTED_DIVERGENT` របស់ `shared-fns.js`។

**ការស្តារ listener ត្រូវមានពិដានល្បឿន (កំណែ 2.14.0)។**
`retryFailedDbListenersNow()` ត្រូវហៅពី **ព្រឹត្តិការណ៍ខាងក្រៅ ៣ កន្លែង** —
`online`, `visibilitychange` និង `.info/connected` ➜ true។ មុនកែវា
`clearDbListenerRecovery()` (reset ជណ្តើរមកសូន្យ) រួច `attemptDbListenerRecovery()`
**ភ្លាមៗ គ្មានពិដាន** ➜ បណ្តាញរញ្ជួយ ឬការប្តូរ App ចេញចូល បង្កើត **រលកសំណើ**។
វាស់បាន៖

| សេណារីយ៉ូ | មុនកែ | ក្រោយកែ |
|---|---|---|
| ព្រឹត្តិការណ៍ ១០ ដងក្នុង ១ វិ. | ១០ ជុំ (**៦០ `onValue`**) | **១ ជុំ** |
| ព្រឹត្តិការណ៍រៀងរាល់ ២ វិ. អស់ ៦០ វិ. | ៦០ ជុំ (**៣៦០ `onValue`**) | **២១ ជុំ** |
| ជណ្តើរធម្មតា ៦០ វិ. | ៤ ជុំ | **៤ ជុំ** (ដដែល) |

`DB_LISTENER_RETRY_MIN_GAP_MS` (៣ វិ.) បូក `lastDbListenerAttemptAt` ជាអ្នកទប់។
ការព្យាយាម **លើកដំបូង** មិនត្រូវទប់ទេ (`lastDbListenerAttemptAt === 0`) ដូច្នេះ
«បណ្តាញត្រឡប់មក ➜ ស្តារភ្លាម» នៅដដែល ហើយ `resetDbListenerHealthState()`
ត្រូវ reset វា។

**ស្ថានភាពការតភ្ជាប់មាន ៤ ជំហាន (កំណែ 2.14.0)។** មុននេះមានតែ ២ ➜ ការចាប់ដៃ
គ្នាជាមួយ Firebase ដែលមិនទាន់ចប់ (រាល់ការបើក App និងរាល់ការភ្ជាប់ឡើងវិញ)
បង្ហាញជា **«ក្រៅបណ្ដាញ»** ខណៈឧបករណ៍មានបណ្តាញ។ ឥឡូវ៖ «ភ្ជាប់ Server រួចរាល់» ·
**«កំពុងភ្ជាប់...»** (`connectionIsSettlingIn()`, ចំណុច `.connecting` លឿង) ·
«កំពុងភ្ជាប់ឡើងវិញ...» (listener ធ្លាក់) · «ក្រៅបណ្ដាញ»។ ក្រោយ
`CONNECTING_GRACE_ATTEMPTS` (៣ ជុំ watchdog ≈ ៣៥ វិ.) វាទទួលស្គាល់ថា
ក្រៅបណ្ដាញដដែល — **កុំកុហកទាំង ២ ទិស**។ `scheduleReconnectWatchdog()` ហៅ
`renderConnectionStatus()` រាល់ជុំ ដូច្នេះការឆ្លងកាត់នោះកើតដោយខ្លួនឯង។

Test៖ **`connection-recovery-test.js`**។
> ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-25, កំណែ 2.11.6) — ការស្តារ
> listener, វដ្ត `goOffline()`+`goOnline()` និងផ្លូវបណ្តាញថ្មីរបស់
> `license-verify.js` ដំណើរការរលូនទាំង ២ ប្រព័ន្ធ។


## ⛔ ធនធានដែលផ្ទុក **យឺត** ក៏ត្រូវឆ្លងកាត់ CSP ដែរ — កំណែ 2.19.1

> 🔴 **កំហុសផលិតកម្មពិត។** អ្នកប្រើ៖ «export excel អត់ចេញ មិនមែនមកពី internet
> ទេ internet ខ្ញុំដើរលឿនធម្មតា» ព្រមទាំងដាន Sentry ជាភស្តុតាង។ **អ្នកប្រើ
> ត្រូវទាំងស្រុង។**

ZoeW ទាញ SheetJS ពី `https://unpkg.com/xlsx@0.18.5/...` ខណៈ `script-src`
ក្នុង `ZoeW/netlify.toml` **គ្មាន host នោះសោះ** ➜ browser **ទប់មុនចេញដំណើរ**
➜ `script.onerror` ➜ catch ➜ toast «សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត»។

ដាន Sentry ពីឧបករណ៍ពិត៖ សំណើឯទៀត **200 គ្រប់** (`zxing_reader.wasm` ·
`identitytoolkit` · `license_keys` · Apps Script) ហើយមានតែ៖

```
Excel export failed: Error: Failed to load https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js
    at HTMLScriptElement.<anonymous> (https://zoew.netlify.app/app.js:4821:79)
```

វាស់ក្នុង Chromium ពិតជាមួយ header CSP ពិត ដោយ **បម្រើ unpkg ក្នុងមូលដ្ឋាន**
ដើម្បីឲ្យ **តែ CSP** ជាអ្នកសម្រេច៖

| រង្វាស់ | មុនកែ | ក្រោយកែ |
|---|---|---|
| ការផ្ទុក library | `{ loaded: false, hasXLSX: false }` | `{ loaded: true, hasXLSX: true }` |
| សំណើទៅដល់ CDN | **0** (ទប់មុនចេញដំណើរ) | **0** (លែងត្រូវការ) |
| សរសេរ `.xlsx` | `XLSX is not defined` | ឯកសារចាប់ផ្តើមដោយ `PK` |

**ដំណោះស្រាយ ៖ SheetJS ចូលមកក្នុង repo** (`ZoeW/vendor/xlsx.full.min.js`) —
ច្បាប់ដដែលនឹង ZXing ក្នុង 2.10.0 ហើយ ZoeImport ធ្វើដូចនេះរួចហើយ។ ឯកសារនោះ
**byte-identical** នឹងអ្វីដែល unpkg ធ្លាប់បម្រើ (sha384 ត្រូវនឹង SRI ដើម
បេះបិទ)។ វាចូល `OPTIONAL_SHELL` ➜ Export ដើរក្រៅបណ្ដាញ ដោយមិនធ្វើឲ្យការ
ដំឡើង SW ក្លាយជា atomic លើឯកសារ ៨៨១ kB ថែមទៀត។

⛔ **កុំបន្ថែម `unpkg.com` (ឬ CDN ណាមួយ) ចូល `script-src` ជាដំណោះស្រាយ។**
ដំណោះស្រាយគឺ **ដកការពឹងផ្អែកលើ CDN ចេញ** — `sw.js` បោះបង់រាល់សំណើឆ្លង
origin ដោយចេតនា (ច្បាប់ចាក់សោតាំងពី 2.6.1) ដូច្នេះធនធាន CDN **មិនដែលចូល
cache** ➜ មុខងារនោះនឹងស្លាប់ស្ងាត់ៗពេលបណ្តាញខ្សោយ ទោះ CSP អនុញ្ញាតក៏ដោយ។

**ហេតុអ្វីវារស់រានយូរម្ល៉េះ ៖ គ្មាន checker ណាមួយសួរថា *browser យក library
មកពីណា*។** `csp-enforced-test.js` វាស់តែធនធានដែលផ្ទុក **ពេល boot**; ចំណែក
`export-cells-test.js` ប្រើ module `xlsx` **របស់ npm ក្នុង Node** ➜ វាវាស់
តែ *ខ្លឹមសារ* របស់ឯកសារ មិនមែន *ផ្លូវទទួល* វាទេ។ នេះជាមេរៀនដដែលនឹង
`network-timeout-test.js` (2.12.1) និង `fluid-type-focus-test.js` (2.16.0)។

⛔ **`loadScriptOnce()` មិនត្រូវសរសេរ `script.integrity = undefined`** —
attribute ក្លាយជាខ្សែអក្សរ `"undefined"` ➜ SRI ធ្លាក់។ ដាក់ `integrity`
និង `crossOrigin` **តែពេល lib ប្រកាសវា**។

**សារបរាជ័យត្រូវប្រាប់មូលហេតុពិត** — `exportFailureMessage()` បែងចែក
ការផ្ទុកឯកសារធ្លាក់ខណៈបណ្តាញដើរ (➜ «សូម Refresh ទំព័រម្តង») ចេញពីការក្រៅ
បណ្ដាញពិត ចេញពីកំហុសផ្សេង។ ការចោទបណ្តាញលើ **គ្រប់** កំហុស គឺជាថ្នាក់ដដែល
នឹងជុំ 2.19.0 (toast មិននិយាយការពិត)។

Test៖ **`csp-lazy-resource-test.js`** (25 assertion, App ទាំង ៣; ធ្លាក់ ១០
លើ tree មុនកែ)។


## Toast និងស្លាកស្ថានភាព ត្រូវនិយាយការពិត — កំណែ 2.19.0

> 🔴 **កំហុសផលិតកម្មពិត — មានរូបថតជាភស្តុតាង** (2026-08-26)។ អ្នកប្រើសរសេរថា
> «toast អត់ពិត អត់តាមស្ថានភាពជាក់ស្ដែងសោះ»។ រូបថតបង្ហាញការកុហក **៣ យ៉ាង
> ក្នុងស៊ុមតែមួយ**៖ App បើកក្រៅបណ្ដាញពី session ដែល cache ទុក · តួលេខទាំងអស់
> ជា **0** · ហើយវាប្រកាស «ចូលប្រព័ន្ធជោគជ័យ!» ខណៈស្លាកសរសេរ «ក្រៅបណ្ដាញ»
> ដែលចេញជា **ពណ៌បៃតងនៃការភ្ជាប់**។

### ថ្នាក់ toast ៤ — មិនត្រូវត្រឡប់ទៅពីលតែមួយវិញ

មុន 2.19.0 គ្រប់ toast (**១៥៦ call site** ក្នុង App ទាំង ៣) ចេញជាពីលខ្មៅ
**ដូចគ្នាបេះបិទ** ➜ «⚠️ បរាជ័យក្នុងការ Save Daily Revenue!» មើលទៅដូច
«✅ បាន Export ជោគជ័យ!» គ្រប់យ៉ាង។ ឥឡូវ៖

| ថ្នាក់ | ពណ៌ | សញ្ញាដែលកេះវា |
|---|---|---|
| `success` | បៃតង | `✅` `🎉` `🔓` |
| `warn` | ទឹកក្រូច | `⚠️` `⏱️` |
| `error` | ក្រហម | `❌` `⛔` `🚫` |
| `info` | ខ្មៅ | អ្វីៗផ្សេងទៀត (លំនាំដើម) |

`toastKindOf()` អានសញ្ញា **នៅដើមសារ** ដូច្នេះ call site ដែលមានស្រាប់លែង
ត្រូវកែម្តងមួយៗ។ `showToast(msg, kind)` ក៏ទទួលថ្នាក់ដោយផ្ទាល់ដែរ។
⛔ **កុំសរសេរ `'toast-' + name`** — `css-classes.js` រកឃើញឈ្មោះ class
តាម **literal** ក្នុងកូដ ➜ ការផ្គុំតាម string ក្លាយជា `.toast-` ទទេ ហើយ
checker ធ្លាក់។ ប្រើ `TOAST_CLASSES` ដែលសរសេរឈ្មោះពេញ។

### Toast ដែល «រស់» — realtime តាមរយៈ DOM មិនមែន module state

ការប្រកាសដែលអាស្រ័យលើការតភ្ជាប់ **មិនត្រូវជាអក្សរកកទេ**។ វាចុះឈ្មោះខ្លួន
ក្នុង DOM ដោយ `data-live-toast="<key>"` ហើយ **`renderConnectionStatus()`
ជាកន្លែងផ្សាយតែមួយ** — វាបញ្ចប់ដោយ `refreshLiveToasts()` ➜ រាល់ការប្រែនៃ
ស្ថានភាពសរសេរអត្ថបទ និងពណ៌របស់ toast ឡើងវិញ **ក្នុងធាតុដដែល**។

⛔ **ការចុះឈ្មោះត្រូវនៅក្នុង DOM មិនមែនក្នុងអថេរកម្រិត module ទេ** —
មានហេតុផល ២៖ (១) toast ស្លាប់ជាមួយធាតុរបស់វា ➜ គ្មានអ្វីត្រូវសម្អាតក្នុង
`clearSensitiveModalFields()`; (២) **តេស្តដែលស្រង់ `renderConnectionStatus`
ចូល `vm`** (`connection-recovery-test.js`) គ្មាន `toastContainer` ➜
`refreshLiveToasts()` ត្រឡប់នៅបន្ទាត់ដំបូង **ដោយគ្មាន ReferenceError**។
បើប្តូរទៅជា `let liveToasts = []` នោះតេស្តនោះនឹងធ្លាក់ភ្លាម។

ច្បាប់ដែលមិនអាចរំលងបាន៖

- `liveToastState(key)` ជា **អ្នកសម្រេចតែមួយ** នៃអ្វីដែល toast សរសេរ។ វា
  ត្រឡប់ `{ msg, kind, settled }` ហើយ `settled: true` មានន័យថា «រឿងនេះ
  ចប់ហើយ ➜ ឈប់សរសេរជាន់ ហើយរលាយចេញ»។
- វា **ស្ថិតក្នុង `EXPECTED_DIVERGENT`** របស់ `shared-fns.js` ដោយចេតនា៖
  ZoeW មាន listener ទិន្នន័យ (`dbListenerPendingPaths`, `dbListenersFailed`)
  ដូច្នេះវាបែងចែក «កំពុងទាញទិន្នន័យ» ចេញពី «ភ្ជាប់រួច»; ZoeKeyGen អានតាម
  `fb.get` មួយដងៗ ➜ វាមានតែស្ថានភាព socket។ **មុខងារ toast ឯទៀតទាំងអស់
  ត្រូវ byte-identical ទាំង ២ App** ដដែល។
- ⛔ **«ភ្ជាប់រួច» មិនដូច «ទិន្នន័យមកដល់ហើយ»។** នេះជាចំណុចដែលរូបថតបង្ហាញ
  (តួលេខ 0 ទាំងអស់ ក្រោមសារជោគជ័យ)។ `.info/connected` ក្លាយជា `true`
  **មុន** snapshot ណាមួយមកដល់ ➜ ZoeW ត្រូវអាន `dbListenerPendingPaths.size`
  មុននឹងអះអាងថាជោគជ័យ។ `noteDbListenerAlive()` ហៅ `refreshLiveToasts()`
  ពេល path ចុងក្រោយមកដល់។
- `proceedAfterLogin()` ត្រូវប្រកាស **ក្រោយ** `initDatabaseListeners()` —
  បើប្រកាសមុន នោះ `dbListenerPendingPaths` នៅទទេ ➜ វាឃើញ «ភ្ជាប់រួច
  ទិន្នន័យគ្រប់» ហើយកុហកភ្លាម។ `toast-truth-test.js` អះអាងលំដាប់នេះ។
- **Toast ដែលរស់ តែងតែមានពេលកំណត់** — `showLiveToast()` ហៅ
  `armToastDismiss(toast, TOAST_LIVE_LIMIT_MS)` (២០ វិ.) ភ្លាម។ បើគ្មានវា
  ការក្រៅបណ្ដាញអចិន្ត្រៃយ៍នឹងបន្សល់ toast លើអេក្រង់ជារៀងរហូត។

### ⛔ «ភ្ជាប់រួច» ក៏មិនដូច «គេនៅចូលប្រព័ន្ធ» ដែរ — កំណែ 2.19.2

> 🔴 **កំហុសផលិតកម្មពិត។** អ្នកប្រើ៖ «នៅពេលចប់ session login ៤ ម៉ោង
> លោតផ្ទាំងមកឲ្យ login តែ toast លោតមក ‹ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ›
> ខុសស្ថានភាពហើយ អត់ real សោះ»។ **អ្នកប្រើត្រូវទាំងស្រុង។**

កំណែ 2.19.0 បានធ្វើឲ្យ toast អានស្ថានភាព **បណ្តាញ** ពិត — តែវា **មិនដែល
សួរថា «តើគេនៅចូលប្រព័ន្ធទេ?»** សោះ។ ដូច្នេះលំដាប់នេះកុហក៖

១. បើក App ក្រោយ ៤ ម៉ោង ➜ Firebase ស្តារ session ដែល cache ទុក ➜
   `onAuthStateChanged(user)` ➜ `proceedAfterLogin()` ➜ `showLiveToast('signin')`។
២. `isFirebaseSessionExpired()` ជា **async** ➜ ការប្រកាសកើតឡើង **មុន** ដឹង
   លទ្ធផល។
៣. socket ឡើង + snapshot មកគ្រប់ ➜ `refreshLiveToasts()` សរសេរជាន់ថា
   «✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ» — **ចំពេលប្រអប់ login លោតមក**។

ច្បាប់ដែលមិនអាចរំលងបាន៖

- ⛔ **`liveToastState('signin')` ត្រូវពិនិត្យអ្នកប្រើពិតជាមុនគេ** —
  ZoeW៖ `sessionExpiryCheck === 'expired' || !auth || !auth.currentUser`;
  ZoeKeyGen៖ `!isSignedInUiActive || !auth || !auth.currentUser`។ វគ្គស្លាប់
  ➜ ត្រឡប់សារព្រមានដែល `settled: true` ➜ វា **លែងអាចត្រូវសរសេរជាន់ជា
  ជោគជ័យវិញបានទៀត**។
- **`sessionExpiryCheck` មាន ៣ តម្លៃ** — `'pending'` (មិនទាន់ដឹង) ·
  `'live'` · `'expired'`។ `proceedAfterLogin()` ដាក់ `'pending'` **មុន**
  ប្រកាស ហើយ `liveToastState()` **មិនអះអាងជោគជ័យខណៈ `'pending'`**។
  វាស្ថិតក្នុង `ACCEPTED` របស់ `state-hygiene.js` ដោយចេតនា៖
  `showLoginModalWithPrefill()` រត់ **ខាងក្នុង** `forceExpireSession()`
  ➜ ការ reset វានៅទីនោះនឹងលុបការពិតដែល toast ត្រូវរាយការណ៍។
- **`forceExpireSession()` ត្រូវសម្គាល់វគ្គថាស្លាប់ synchronously មុន
  `fb.signOut`** រួចហៅ `refreshLiveToasts()` ភ្លាម។ បើរង់ចាំ signOut
  នោះមានចន្លោះដែលព្រឹត្តិការណ៍បណ្តាញអាចសរសេរជាន់ជាជោគជ័យបាន។
- **`reannounceOrShowToast(msg)` ធានាថាសារនោះលេចជាក់ស្តែងតែ ១** — បើ toast
  ដែលមានអត្ថបទដដែលនៅលើអេក្រង់រួច (ជា toast រស់ដែលទើបប្តូរខ្លួន) វា
  **ធ្វើឲ្យវារស់វិញពេញ ៣ វិនាទី** ជំនួសការបន្ថែម toast ថ្មី។ ⛔ កុំប្តូរវា
  ទៅជាការរាប់ចំនួនពី `refreshLiveToasts()` — ការសម្រេចត្រូវធ្វើនៅ **ពេល
  `signOut` ចប់** មិនមែនពេលកេះទេ បើមិនដូច្នេះ `signOut` ដែលយឺតជាង ៣ វិនាទី
  នឹងបន្សល់ប្រអប់ login **ដោយគ្មានការពន្យល់សោះ**។ `refreshLiveToasts()`
  នៅ **byte-identical ទាំង ២ App** ដដែល — កុំប្តូរ signature របស់វា។
- ⛔ **ZoeKeyGen ត្រូវលើក `isSignedInUiActive = true` មុន `showLiveToast('signin')`**
  — បើមិនដូច្នេះ gate ខាងលើនឹងធ្វើឲ្យវាប្រកាស «បានចាកចេញ» ដល់អ្នកទើបចូល។
  នេះជាច្បាប់ដដែលនឹង «ប្រកាសក្រោយ `initDatabaseListeners()`» ខាងលើ៖
  **ស្ថានភាពត្រូវពិតជាមុនសិន ទើបប្រកាស**។
- **`showLoginModalWithPrefill()` ជាកន្លែងតែមួយដែល App ស្នើឲ្យចូលប្រព័ន្ធ**
  ➜ វាហៅ `refreshLiveToasts()` ➜ គ្រប់ផ្លូវ (ផុតកំណត់ · ចាកចេញដោយដៃ ·
  auth listener) ត្រូវបានគ្រប ដោយមិនចាំបាច់ដោះស្រាយម្តងមួយផ្លូវ។
- សារផុតកំណត់ជា **ថេរតែមួយ** (`SESSION_EXPIRED_TOAST`) ចែករំលែករវាង toast
  រស់ និង toast ថ្មី ហើយវាចាប់ផ្តើមដោយ `⏱️` ➜ ថ្នាក់ `warn` (ទឹកក្រូច)។

Test៖ **`toast-truth-test.js`** ផ្នែក ៤ខ (៩២ assertion សរុប; ដក gate ចេញ
តែម្យ៉ាង ➜ **១០ ធ្លាក់** ដោយបង្ហាញអត្ថបទ `✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យ
ទាន់សម័យ` បេះបិទតាមរបាយការណ៍អ្នកប្រើ)។

### ស្លាកស្ថានភាព ត្រូវប្តូរពណ៌ — កំហុស **CSS សុទ្ធ**

`.brand-info span { color: var(--success) }` របស់ ZoeW ចាក់ពណ៌ថេរ ➜ អក្សរ
«ក្រៅបណ្ដាញ» ចេញបៃតង។ វាស់ក្នុង Chromium ពិតលើ tree មុនកែ៖ ស្ថានភាពទាំង ៤
ត្រឡប់ `rgb(16, 185, 129)` **ដូចគ្នាបេះបិទ**។

⚠️ **គ្មានតេស្ត JavaScript ណាមួយអាចមើលឃើញកំហុសនេះទេ** — `renderConnectionStatus()`
សរសេរអត្ថបទត្រឹមត្រូវរួចហើយ។ តេស្តត្រូវ **វាស់ `getComputedStyle().color`
លើ stylesheet ពិត**។ ឥឡូវ `renderConnectionStatus()` ដាក់ class
`is-online` / `is-connecting` / `is-offline` លើ `#firebaseStatusText`
ហើយ CSS ផ្តល់ពណ៌ ៣ ខុសគ្នា។ **កែទាំង ២ App។**

### ZoeImport ៖ សូចនាករតំណ

ZoeImport ធ្លាប់ **គ្មានសូចនាករការតភ្ជាប់សោះ**។ ឥឡូវ `renderLinkStatus()`
គូរ 5 ស្ថានភាព (`LINK_STATES`) ហើយ `navigator.onLine === false`
**សរសេរជាន់** អ្វីៗទាំងអស់ ព្រោះឧបករណ៍ក្រៅបណ្ដាញ = តំណដាច់ជាក់ច្បាស់។
`callApi()` ៖ បដិសេធមុនចេញដំណើរពេលក្រៅបណ្ដាញ · `setLinkState('busy')`
មុនផ្ញើ · `'ok'` លើជោគជ័យ · `'bad'` លើការបរាជ័យ **មុន rethrow**
(បើភ្លេច សូចនាករនៅបៃតងខណៈសំណើធ្លាក់)។ `resetSessionState()` ➜ `'idle'`។

Test៖ **`toast-truth-test.js`** (67 assertion, App ទាំង ៣; ធ្លាក់ ៤៥ លើ
tree មុនកែ)។

**សំណើ navigate ត្រូវប្រើ `./index.html` ជាកូនសោ cache ជានិច្ច (កំណែ 2.11.6)។**
មុននេះ `sw.js` ប្រើ `request` ឆៅជាកូនសោ ➜ ការបើក Setup Link
`/?setup=<base64 config អាជីវកម្ម>` ដាក់ **URL ពេញ** ចូល Cache Storage។
`history.replaceState()` លុបវាចេញពីរបា address តែ **មិនប៉ះ cache** ➜ payload
**រស់រានក្រោយចាកចេញ** (ផ្ទុយនឹងច្បាប់ Setup Link) ហើយអានបានតាម DevTools ➜
Application ➜ Cache Storage ដោយមិនចាំបាច់ដឹង PIN។ ការឆ្លើយតបគឺ `index.html`
ដដែលសម្រាប់គ្រប់ផ្លូវ (Netlify rewrite `/* → /index.html 200`) ដូច្នេះកូនសោ
តែមួយត្រឹមត្រូវ ហើយវាក៏ការពារ cache កុំឲ្យរីកតាមផ្លូវ SPA ដែរ។
`cache.put()` ត្រូវរំលងការឆ្លើយតបដែល `redirected` (វាបោះ TypeError ហើយវាក៏
មិនមែនជាសំបកត្រឹមត្រូវសម្រាប់កូនសោ navigate ដែរ)។
Test៖ **`sw-cache-key-test.js`** (បើក Setup Link ពិត រួចអាន `caches` ដោយផ្ទាល់)។
> ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-25, កំណែ 2.11.6) — ការបើក
> ក្រៅបណ្តាញ, Setup Link និងការស្កេន ដំណើរការរលូនទាំង iPhone និង Android។
> ដូច្នេះកុំត្រឡប់ទៅកូនសោ `request` ឆៅវិញដោយសង្ស័យថាវាបំបែកសំបក។

**ការពិនិត្យកំណែ Service Worker ត្រូវមាន throttle។** `reg.update()` ទាញ `sw.js`
ពី network ជានិច្ច (header `no-cache`)។ មុន 2.11.6 វាត្រូវហៅរាល់
`visibilitychange` **និង** រាល់ `focus` ➜ រាល់ការប្តូរ App លើទូរស័ព្ទបង្កើត
សំណើថ្មី។ ឥឡូវយ៉ាងច្រើន **១ ដងក្នុង ១៥ នាទី**, រំលងទាំងស្រុងពេល
`navigator.onLine === false`, ហើយបន្ថែម trigger `online` ដើម្បីកុំឲ្យកំណែថ្មី
មកដល់យឺតជាងមុន។

**`sw.js` ត្រូវបោះបង់រាល់សំណើឆ្លង origin — កុំប្តូរច្បាប់នេះ។**
```js
if (url.origin !== self.location.origin) return;
```
កំណែ **2.6.0 បានប្តូរវា** ដើម្បី cache Firebase SDK, ពុម្ពអក្សរ និង Sentry
តាមបញ្ជី host ➜ **App ខូចលើផលិតកម្មភ្លាម**៖ អ្នកប្រើឃើញ «ក្រៅបណ្តាញ» និងគ្មាន
ទិន្នន័យ ខណៈបណ្តាញដើរធម្មតា (Firebase SDK និង Sentry ផ្ទុកមិនចូល)។ វាត្រូវថយក្រោយ
ក្នុង **2.6.1**។ `offline-shell-test.js` ចាក់សោច្បាប់នេះទុក។

**មេរៀនសំខាន់៖ តេស្តជាមួយ CDN ក្លែងក្លាយ ជោគជ័យក្លែងក្លាយ។** បរិស្ថាន audit
នៅទីនេះឆ្លងកាត់ proxy (`gstatic` ឆ្លើយ 403) ដូច្នេះវា **មិនអាចបង្កើតឥរិយាបថ CDN
ពិតឡើងវិញបានទេ** — header, redirect, `Vary`, CORS។ ការកែណាមួយដែលប៉ះការទាញធនធាន
**ឆ្លង origin** មិនត្រូវ ship ដោយផ្អែកលើតេស្តក្នុង repo តែម្យ៉ាងឡើយ។ ការកែបែបនោះ
ត្រូវសាកលើ **deploy preview ពិត និងឧបករណ៍ពិត** ជាមុនសិន។


## ចលនាពេលបើក App (boot) — កំណែ 2.14.0

ផ្ទាំង `#bootSplash` គ្របការលោតរបស់ UI ទទេ រួចរលាយចេញពេល App រៀបចំរួច
(`revealAppAfterBoot()` នៅចុងបញ្ចប់នៃ handler `load`) ហើយ `body.boot-reveal`
ធ្វើឲ្យ chrome លេចមុខជាជំហាន។ ច្បាប់៖

| # | អ្វី | ហេតុអ្វី |
|---|---|---|
| ១ | `pointer-events: none` **ជានិច្ច** | ផ្ទាំងតុបតែងមិនត្រូវលេបការចុច; ក៏ធ្វើឲ្យតេស្ត browser មិនបែក |
| ២ | សំណាញ់សុវត្ថិភាព ៦ វិ. ក្នុង `boot-flags.js` | `app.js` ដួល ➜ អ្នកប្រើមិនត្រូវជាប់ក្រោមអេក្រង់ស |
| ៣ | សំណាញ់នោះត្រូវរៀបចំពេល **`DOMContentLoaded`** | ពេល parse ក្បាល `#bootSplash` **មិនទាន់មាន** — កំហុសនេះកើតឡើងពិតក្នុងជុំ 2.14.0 |
| ៤ | ⛔ **គ្មាន `transform` លើ `.app-navbar`/`.app-pages`/`.page-tabbar`** | `transform` បង្កើត containing block សម្រាប់កូន `position: fixed`; របា Tab ពឹងលើ `translate3d` របស់ `setupChromeAutoHide()` |
| ៥ | `boot-reveal` ត្រូវ **ដកចេញវិញ** ក្រោយចលនាចប់ | កុំបន្សល់ animation/stacking context លើ chrome |
| ៦ | ការរំកិលរបារត្រូវនៅ **ខាងក្នុងរបា** | `translateX(-100%)` លើ span ពេញទទឹង នាំគែមឆ្វេងទៅ `left = -38` នៅ 320px ➜ `layout-check.js` ធ្លាក់ (កំហុសពិតក្នុងជុំ 2.14.0) |
| ៧ | PTR reload ត្រូវ **រំលងផ្ទាំង** (`html.boot-instant`) | PTR ត្រូវនៅតែមានអារម្មណ៍ភ្លាមៗ |
| ៨ | ZoeKeyGen៖ function ត្រូវនៅ **កម្រិត top level** មិនមែនក្នុង IIFE របស់ devtools guard | បើមិនដូច្នេះ `revealAppAfterBoot is not defined` (កំហុសពិតក្នុងជុំ 2.14.0) |

Test៖ **`boot-animation-test.js`** (53 assertions)។


## មាត្រដ្ឋានអក្សរ `--fs-unit` និងសញ្ញាផ្តោត — កំណែ 2.15.0 · 2.16.0

**ទំហំអក្សរទាំងអស់ក្នុង ZoeW និង ZoeKeyGen សរសេរជា `calc(N * var(--fs-unit))`**
ដែល `N` ជាទំហំគិតជា px នៅអេក្រង់តូចបំផុត។ ឯកតានោះជា៖

```css
--fs-unit: clamp(1px, 0.7091px + 0.0909vw, 1.1px);
```

- នៅ **320px** វាស្មើ **1px** ➜ គ្រប់ទំហំអក្សរ **ដូចមុនកែបេះបិទ**។ ដូច្នេះ
  ការឡើងមាត្រដ្ឋាននេះ **មិនអាចធ្វើឲ្យអ្វីតូចជាងមុន** ហើយ `layout-check.js`
  នៅ 320px មិនប្រែសោះ។
- នៅ **412px** (ទូរស័ព្ទ Android ធម្មតា) វា ~**1.084px** ➜ អក្សរធំជាងមុន ~៨%។
- ចាប់ពី **430px** (iPhone ធំបំផុត) វាឈប់ត្រឹម **1.1px**។

**ជំហានទី ២ — desktop (កំណែ 2.16.0)។** ពេល layout បត់ជា **ជួរឈរច្រើន**
នោះជួរនីមួយៗទូលាយ ➜ អក្សរត្រូវឡើងមួយកម្រិតទៀត។ ដូច្នេះ `--fs-unit`
ត្រូវសរសេរជាន់ជា **`1.2px`** ក្នុង media query **ដដែល**ដែលប្តូរ layout៖

| App | breakpoint | កន្លែង |
|---|---|---|
| ZoeW | `≥992px` | `@media (min-width: 992px)` (grid `380px + សល់`) |
| ZoeKeyGen | `≥900px` | `@media (min-width: 900px)` (grid ២ ជួរ) |
| ZoeImport | `≥900px` | `@media (min-width: 900px)` (`#appMain` ២ ជួរ) |

**ជំហានអក្សរ និង breakpoint របស់ layout ត្រូវជាលេខដដែល** — បើពួកវាឃ្លាតគ្នា
នោះមានតំបន់ទទឹងមួយដែល layout ជា ២ ជួរ តែអក្សរនៅទំហំទូរស័ព្ទ (ឬផ្ទុយមកវិញ)។

**កុំសរសេរ `font-size: Npx` ត្រង់ៗវិញ** — ធាតុនោះនឹងនៅតូចដដែលខណៈអ្វីៗជុំវិញ
វារីក។ ការលើកលែងតែមួយគឺច្បាប់ក្នុង `#pdfExportPrintArea` ព្រោះ `vw` នៅទីនោះ
ជាទទឹង **ក្រដាស** មិនមែនទទឹងអេក្រង់ទេ។

> ⚠️ **ច្បាប់នេះមិនត្រឹមតែលើ `style.css` ទេ។** កំណែ 2.15.0 ដាក់មាត្រដ្ឋាន
> ត្រឹម `style.css` ហើយ checker របស់វាក៏ស្កេនតែឯកសារនោះ ➜ **`font-size`
> ថេរ ៤៣ កន្លែង** ក្នុង `index.html` (`style="font-size:10px"`) និងក្នុង
> template string របស់ `app.js` រស់រានស្ងាត់ៗរហូតដល់ 2.16.0។ នេះជាមេរៀន
> ដដែលនឹង `network-timeout-test.js` ក្នុង 2.12.1 — **ពេលសរសេរ checker
> ត្រូវសួរថា «វាស្កេនឯកសារ*ណា*ខ្លះ»**។ ឥឡូវវាស្កេន `style.css` ·
> `index.html` · `app.js` នៃ **App ទាំង ៣**។

**App ទាំង ៣ ប្រើមាត្រដ្ឋានដដែល** តាំងពី 2.16.0 (ZoeImport ក៏ដែរ —
`clamp()` ដាច់ដោយឡែក ៦ កន្លែងរបស់វាត្រូវបានបញ្ចូល)។ តម្លៃនៅ 320px
នៅដដែលបេះបិទគ្រប់កន្លែង។

**សញ្ញាផ្តោត៖ `:focus-visible` មិនមែន `:focus`។** ប៊ូតុង តំណ checkbox file
និង range ទទួល `outline: 2px` **តែពេលផ្តោតតាមក្តារចុច**; ការចុចដោយម្រាមដៃ
ឬម៉ៅស៍មិនបន្សល់រង្វង់ទេ (ដូច្នេះការប្រើប្រាស់ប្រចាំថ្ងៃមើលទៅដដែល)។ ប្រអប់
វាយអត្ថបទប្រើ **border + `box-shadow`** ជំនួសវិញ ព្រោះវាត្រូវបង្ហាញការផ្តោត
**គ្រប់ពេល**។

**ច្បាប់ specificity ដែលងាយភ្លេច៖** `:focus-visible` តែឯងមាន specificity
`(0,1,0)` ➜ ច្បាប់ដូច `.hardware-scanner-box input { outline: none }`
`(0,1,1)` **ឈ្នះវា**។ ដូច្នេះច្បាប់ផ្តោតត្រូវសរសេរជាមួយ tag/attribute
(`button:focus-visible`, `input[type="checkbox"]:focus-visible`) ហើយដាក់នៅ
**ចុងបញ្ចប់នៃឯកសារ**។ ការសរសេរជា `:focus-visible` ទទេ = ច្បាប់ស្លាប់ស្ងាត់ៗ។

ក្នុងកន្សោមរមូរ (`.table-responsive`) `outline-offset` ត្រូវជា `0` ដើម្បីកុំឲ្យ
រង្វង់ត្រូវកាត់ដោយគែម។ លើផ្ទៃខ្មៅ (`.hardware-scanner-box`, `#video-container`,
`.zoom-slider-wrap`) `outline-color` ប្តូរទៅ `#fff`។

Test៖ **`fluid-type-focus-test.js`** (81 assertions, App ទាំង ៣)។


## ទម្រង់បង្ហាញលើអេក្រង់ធំ — កំណែ 2.16.0

**App ទាំង ៣ បត់ជាជួរឈរច្រើនលើអេក្រង់ធំ** ហើយ `layout-check.js` ចាក់សោវា
**២ ខាង** (មើលខាងក្រោម)។

| App | breakpoint | អ្វីកើតឡើង |
|---|---|---|
| ZoeW | `≥992px` | `.app-page.active` ➜ grid `380px + សល់`; របា Tab ផ្លាស់ពីក្រោមទៅក្រោម navbar; `≥1400px` ➜ ជួរឆ្វេង `420px` |
| ZoeKeyGen | `≥900px` | `.app-container` ➜ grid ២ ជួរ, `max-width` `780 ➜ 1180px`; `.card-wide` (Signing Key និងបញ្ជី Key) span ២ ជួរ |
| ZoeImport | `≥900px` | `#appMain` ➜ grid ២ ជួរ; ជំហាន ១–៣ span ២ ជួរ |

**⛔ `style.display` ក្នុង JS សរសេរជាន់ layout របស់ CSS។** មុន 2.16.0
ZoeKeyGen បង្ហាញ App ដោយ `appContainer.style.display = 'flex'` ➜ inline style
នោះ **ឈ្នះ `display: grid`** របស់ media query ➜ **grid មិនដែលដំណើរការសោះ**
ខណៈ CSS មើលទៅត្រឹមត្រូវ ហើយ `layout-check.js` ក៏បៃតង។ ច្បាប់៖ **ការបង្ហាញ/លាក់
ត្រូវធ្វើតាម class** (`hidden` ➜ `display: none !important`) មិនមែនតាម
`style.display` ទេ បើធាតុនោះមាន `display` ខុសគ្នាតាម breakpoint។

**ការអះអាង «គ្មានធាតុលើសអេក្រង់» ជាការអះអាងម្ខាង។** App ដែលនៅជាជួរឈរ
ទទឹងទូរស័ព្ទលើកុំព្យូទ័រ **ជាប់តេស្តនោះទាំងស្រុង** — នោះជាមូលហេតុដែល
ZoeKeyGen រស់នៅ 780px រហូតដល់ 2.16.0។ ដូច្នេះ `layout-check.js` បន្ថែម
**ខាងទីពីរ** នៅ 1280/1440px៖

- ខ្លឹមសារត្រូវប្រើទទឹងយ៉ាងតិច **`DESKTOP_MIN_CONTAINER` = 900px**
  (ZoeW ១២៨០/១៤៤០ · ZoeKeyGen ១១៨០ · ZoeImport ៩៣៦)
- ចំនួន **ជួរដេក**របស់កាតត្រូវ **តិចជាង**នៅ 1280/1440px ធៀបនឹង 412px
  (ZoeW ៣➜២ · ZoeKeyGen ៤➜៣ · ZoeImport ៥➜៤)

`DESKTOP` ក្នុងឯកសារនោះកំណត់ selector និងរបៀប **បើកបង្ហាញ** ខ្លឹមសារដែល
ជាប់សោ (ZoeKeyGen៖ `#appContainer`; ZoeImport៖ `#appMain` + `.card` បូក
លាក់ `#pinGate`) — បើភ្លេច នោះវាវាស់អេក្រង់ចូល ហើយ **រាយ ០ កាតដោយស្ងាត់**។


## ទម្រង់ឆ្លាតតាមឧបករណ៍ — កំណែ 2.17.0

> ✅ **ផ្ទៀងផ្ទាត់លើផលិតកម្មពិតរួចហើយ** (2026-08-25) — អ្នកប្រើបញ្ជាក់ថា
> **ទម្រង់ទូរស័ព្ទមិនប្តូរសោះ** ហើយថេប្លេត និងកុំព្យូទ័រ «អានងាយ គ្មានចន្លោះ
> ទទេធំ»។ បី​ថ្នាក់ខាងក្រោមជាលទ្ធផលនៃ **៣ ជុំកែតាមសំណើផ្ទាល់របស់អ្នកប្រើ**
> («មើលទៅដូចអត់សូវទំនង» ➜ «ទទឹងអោយវែងមក» ➜ «ឆ្លាតតាមឧបករណ៍») —
> **កុំត្រឡប់ទៅជំហានថេរវិញ**។

មាន **៣ ថ្នាក់** ហើយ **ថ្នាក់ទូរស័ព្ទមិនត្រូវប្តូរដោយគ្មានការស្នើ** (សំណើ
ផ្ទាល់របស់អ្នកប្រើ 2026-08-25)៖

| ថ្នាក់ | ទទឹង | អ្វីខុសគ្នា |
|---|---|---|
| ទូរស័ព្ទ | `< 700px` | ជង់បញ្ឈរ — **ដូចមុនបេះបិទ** |
| ថេប្លេត/ផ្តេក | `≥ 700px` | `.price-stack` ក្លាយជាជួរផ្តេក; ជួរឈរតារាង 5/26/42/27% |
| កុំព្យូទ័រ | `≥ 992px` | `.customer-info-stack` ក៏ផ្តេកដែរ; ជួរឈរ 4/30/42/24%; grid ២ ជួរ |

- **ទទឹងជួរឈរតារាងប្រវត្តិត្រូវនៅក្នុង CSS មិនមែន `style="width:…"` ក្នុង HTML**
  (`.history-table .col-num/.col-cust/.col-price/.col-act`)។ inline style
  **ឈ្នះគ្រប់ media query** ➜ ការសរសេរវាក្នុង HTML ធ្វើឲ្យថ្នាក់ទាំង ៣
  ខាងលើគ្មានប្រសិទ្ធភាពស្ងាត់ៗ។
- **`--fs-unit` លើកុំព្យូទ័រជាខ្សែកោងរអិល** ៖
  `clamp(1.2px, 0.9553px + 0.0247vw, 1.35px)` (ZoeW @992) និង
  `clamp(1.2px, 0.975px + 0.025vw, 1.35px)` (ZoeKeyGen · ZoeImport @900)។
  **ជាន់ទាបត្រូវស្មើ 1.2px ចំពេល breakpoint** ព្រោះ `fluid-type-focus-test.js`
  អះអាង `×1.2` នៅទទឹងនោះ (`DESKTOP_STEP`, tolerance 0.08px)។ ការប្តូរជម្រាល
  ត្រូវគណនា intercept ឡើងវិញ បើមិនដូច្នេះតេស្តធ្លាក់។
- **ជួរឈរឆ្វេង `clamp(340px, 27vw, 460px)`** ជំនួសជំហាន 380/420px។
- **`≥1700px` ៖ `.app-page.active` មាន `max-width: 1660px` + margin auto។**
- ⛔ **`.modal-content` ប្រកាសនៅ *ក្រោយ* ច្បាប់ modal ជាក់លាក់ក្នុងឯកសារ**
  ➜ ច្បាប់ដូច `.trash-modal-content { max-width: … }` ត្រូវដាក់ **ក្រោយ**
  `.modal-content` បើមិនដូច្នេះវាត្រូវសរសេរជាន់ស្ងាត់ៗ (specificity ស្មើគ្នា
  ➜ អ្នកមកក្រោយឈ្នះ)។ កំហុសនេះកើតឡើងពិតក្នុងជុំ 2.17.0 —
  `css-media-override.js` **មិនចាប់វាទេ** ព្រោះវាប្រៀបតែ `@media` ធៀបនឹង
  ច្បាប់មូលដ្ឋាន មិនមែនមូលដ្ឋានធៀបនឹងមូលដ្ឋានទេ។ វិធីផ្ទៀងផ្ទាត់៖ **វាស់
  ទទឹងពិតក្នុង browser** កុំទុកចិត្តតែការអាន CSS។


## ថ្នាក់កំហុសដែលបានដោះស្រាយរួច — កុំធ្វើឡើងវិញ

ទាំងនេះជាមេរៀនដែលចំណាយពេលច្រើនដើម្បីរកឃើញ។ គ្រប់ថ្នាក់មាន checker ស្វ័យប្រវត្តិឥឡូវនេះ។

- **សរសេរ item ទាំងមូលពីច្បាប់ចម្លងក្នុងសតិ** ➜ លុបការងាររបស់ឧបករណ៍ផ្សេង។ គ្រប់ផ្លូវសរសេរត្រូវ
  ជា `runTransaction` លើ record របស់ server ឬត្រូវអាន `fb.get` លើ node ជាក់លាក់មុនសរសេរ។
  Checker៖ **`stale-write.js`**។
- **`promise.then(A).catch(B)` ដែល B ជាការសង្គ្រោះ** ➜ JavaScript រត់ `B` ពេល **`A` throw**
  ដែរ ➜ ការសរសេរជោគជ័យ តែការសង្គ្រោះរត់ខុស ➜ លុយបាត់។ ប្រើ `.then(A, B)` ២ អាគុយម៉ង់
  ឬទង់។ Checker៖ **`compensation-order.js`**។
- **ការប្តូរ layout ចំពេល touch/momentum scroll របស់ iOS ឬទុក root scroll restoration
  ក្រោយ PTR** ➜ បញ្ជីលោតរំលង/កាតរអិលក្រោម navbar។ ការប្តូរ panel ត្រូវរង់ចាំ
  `touchend`, របា Tab ត្រូវជា `transform` សុទ្ធ ហើយ PTR reload ត្រូវ reset root/page/table។
  Tests៖ **`gesture-test.js`**, **`phone-search-swipe-test.js`**។
- **ការសរសេរ style រួចអានធរណីមាត្រ ក្នុង handler របស់ touch/scroll** ➜ browser ត្រូវ
  ទូទាត់ layout **ស្របគ្នា** ចំពេលម្រាមដៃកំពុងអូស។ ធ្ងន់បំផុតក្នុង `touchmove` ដែល
  **non-passive** ព្រោះ iOS ត្រូវរង់ចាំវាចប់មុនអនុញ្ញាតឲ្យរមូរ។ ការដើរឡើងលើដើមឈើ
  DOM ជាមួយ `getComputedStyle()` ក្នុងផ្លូវនោះត្រូវ **ចងចាំក្នុងមួយកាយវិការ**
  (`scrollerForPull()`), ហើយ handler របស់ `scroll` ត្រូវ coalesce តាម
  `requestAnimationFrame` ព្រមទាំងរំលងការសរសេរពេលតម្លៃមិនប្រែ។
  Checker៖ **`layout-thrash.js`** (ស្តាទិច + វាស់ក្នុង Chromium ពិត)។
- **animation លើ property ដែលមិនអាច composite** — `top`/`height` ➜ layout រាល់ស៊ុម;
  `box-shadow`/`background-color` ដោយ `infinite` ➜ គូរឡើងវិញរាល់ស៊ុមជារៀងរហូត។
  ប្រើ `transform`/`opacity` ឬដាក់ធាតុនោះលើ layer ដោយឡែក។ Checker៖ **`animation-cost.js`**។
- **ការសរសេរដែលចុះ *ក្រោយ* `withTimeout` បោះបង់រួច** ➜ បើ catch ដោះ claim ឬបញ្ច្រាសលុយភ្លាម
  នោះខុស។ ត្រូវចាប់ promise ទុក ហើយដាក់ handler លើវាពេល timeout។ Test៖ **`slow-write-test.js`**
  (បង្រួម timer ≥1s ចុះ ១០០ ដង)។
- **រូបរាង `barcodes` ៣ យ៉ាងពី RTDB** — `[A,B]` · `[A,null,B]` · `{0:A,2:B}`។ គ្រប់ផ្លូវអានឆៅ
  ត្រូវហៅ `normalizeBarcodesOf()` / `barcodeEntriesOf()`។ Tests៖ **`barcode-shape-test.js`**,
  **`raw-read-shape-test.js`**។
- **ទិន្នន័យអតិថិជនសល់ក្នុង DOM ក្រោយចាកចេញ** — វាលណាដែលសរសេរដោយទិន្នន័យអតិថិជនត្រូវលុប
  ក្នុង `clearSensitiveModalFields()`។ Checker៖ **`dom-hygiene.js`**។
- **អថេរ state កម្រិត module ដែលរស់រានក្រោយចាកចេញ**។ Checker៖ **`state-hygiene.js`**។
- **`env()` គ្មាន fallback** ➜ browser ដែលមិនស្គាល់វាបោះចោលការប្រកាសទាំងមូល។ ត្រូវដាក់
  តម្លៃមូលដ្ឋាននាំមុខជានិច្ច។
- **`localStorage.setItem` ខាងក្នុង callback របស់ `onValue`** ➜ `QuotaExceededError`
  សម្លាប់ callback ➜ តារាងឈប់ update។ ត្រូវ try/catch។
- **លុយចំណុចអណ្តែត** — គ្រប់ការបូកលុយឆ្លងកាត់ `Math.round(x * 100) / 100`។ ថ្នាក់នេះ
  ដោះស្រាយរួចហើយ — កុំរាយការណ៍ជាកំហុសថ្មី។
- **ការអានលេខខុសឆ្លង format** — បញ្ជី format ធំធ្វើឲ្យស្លាកមួយអានចេញជាលេខផ្សេង
  ដោយ «ជោគជ័យ»។ ដោះស្រាយដោយ `SCAN_FORMAT_NAMES = ['CODE_128']` បូក `confirmLiveScan()`។
  Test៖ **`scan-engine-test.js`**។
- **ប្រអប់ native (`confirm`/`alert`) ផ្អាក `<video>` លើ iOS ហើយមិនបន្តវិញ** ➜ កាមេរ៉ាកក។
  គ្រប់ផ្លូវដែលបើកប្រអប់ native ខណៈកាមេរ៉ាកំពុងស្កេន ត្រូវហៅ `resumeScanVideo()` ក្រោយវា
  (បូក listener `pause` ជាជាន់ទី ២)។ Test៖ **`camera-resume-test.js`**។
- **`transition` លើ `max-height` ដែលតម្លៃដើមជា `none`** ➜ វា **មិនធ្វើចលនាទេ** (លោតទៅ 0
  ភ្លាម) ដូច្នេះអ្វីដែលនៅសល់ជាការគូរឡើងវិញឥតប្រយោជន៍ ចំពេលអ្នកប្រើកំពុងរមូរ។ ការវាស់ពិត៖
  `clientHeight` ធ្លាក់ដល់ 0 ក្នុងស៊ុមតែមួយ ខណៈ `opacity` នៅដេញ ០.៣ វិនាទីទៀត។
  បើត្រូវការការបង្រួមមានចលនាពិត ត្រូវប្រើ `transform`/`opacity` លើប្រអប់ដែលមានកម្ពស់ថេរ។
- **class ដែលកំណត់ `overflow` លើកន្សោមរមូររួម ត្រូវជាប់តែទំព័រដែលត្រូវការវា** ➜ បើវាជាប់
  ឆ្លងទំព័រ ទំព័រផ្សេងរមូរមិនកើត។ Test៖ **`page-nav-test.js`** (`history-expanded`)។
- **ធនធានចាំបាច់ដែលមកពី origin ខាងក្រៅ ហើយ service worker មិន cache** ➜ App បើកបាន
  តែមុខងារនោះស្លាប់ស្ងាត់ៗពេលបណ្តាញខ្សោយ។ រកឃើញលើ ZXing (ការស្កេន)។
  Test៖ **`offline-shell-test.js`** (បិទម៉ាស៊ីនបម្រើពិត រួចផ្ទុកឡើងវិញ)។
- **rollback ដែលស្តារ *array ទាំងមូល* ពី snapshot ដែលថតមុន `await`** ➜ វាលុប
  ការងាររបស់ឧបករណ៍ផ្សេងចេញពីអេក្រង់។ នេះជាថ្នាក់ដដែលនឹង «សរសេរ item ទាំងមូល
  ពីច្បាប់ចម្លងក្នុងសតិ» តែលើ **projection ក្នុងសតិ** ដូច្នេះ `stale-write.js`
  (ដែលពិនិត្យការសរសេរទៅ Firebase) មិនចាប់។ ការសង្គ្រោះត្រូវធ្វើ **គោលដៅជាក់លាក់**
  លើ array **បច្ចុប្បន្ន** (`dropOptimisticBarcode()`, ការដាក់ item ត្រឡប់ចូល
  `deletedItems`) មិនមែន `x = xSnapshot` ទេ។ Test៖ **`slow-write-test.js`** (scenario D)។
  ⚠️ **អន្ទាក់ harness**៖ fake SDK ដែលបាញ់ `fireAll()` លើគ្រប់ការសរសេរ ធ្វើឲ្យ
  projection ស្តារខ្លួនភ្លាម ➜ **តេស្តជោគជ័យក្លែងក្លាយ**។ ត្រូវបាញ់ **តាម path**។
- **Sentry ដែលមកយឺត ឬ DSN ដែលប្តូរ** ➜ `window.Sentry` មាន តែ `init()` មិនដែលហៅ
  ➜ `capture()` មើលទៅដំណើរការ តែ event ធ្លាក់ចោល។ ត្រូវប្រើទង់ «ចាប់ផ្តើមរួច»
  មិនមែនវត្តមានរបស់ `captureException` ទេ; ត្រូវទុកជួរ event មុន boot; ត្រូវផ្តាច់
  client ពេលលុប DSN; និងត្រូវមាន generation guard លើ `init()` ស្របគ្នា។
  Test៖ **`sentry-load-race-test.js`**។
- **listener ដែល Firebase បោះបង់ ហើយគ្មានអ្នកភ្ជាប់វាឡើងវិញ** ➜ តារាងកក
  ជារៀងរហូត ខណៈចំណុចស្ថានភាពនៅសរសេរ «ភ្ជាប់ Server រួចរាល់» ➜ អ្នកប្រើបន្ត
  ធ្វើការលើទិន្នន័យចាស់។ ការសរសេរលុយនៅតែត្រឹមត្រូវ (វាដើរតាម `runTransaction`
  លើ record របស់ server) — អ្វីដែលខុសគឺ **អ្វីដែលអ្នកប្រើឃើញ**។
  Test៖ **`connection-recovery-test.js`**។
- **URL ដែលមានទិន្នន័យរសើប ត្រូវយកជាកូនសោ cache** ➜ វារស់រានក្រោយចាកចេញ
  ហើយអានបានតាម DevTools។ រកឃើញលើ Setup Link (`?setup=`)។
  Test៖ **`sw-cache-key-test.js`**។
- **សំបកដែល cache ទុករួច នៅតែប្រណាំងនឹងបណ្តាញមុនបង្ហាញ** ➜ លើបណ្តាញខ្សោយ
  ការពន្យារ **គុណតាមខ្សែសង្វាក់ផ្ទុក** ➜ App ដែលមានឯកសារគ្រប់ទាំងអស់ក្នុង
  cache នៅតែត្រូវការ ៩ វិនាទីដើម្បីបើក។ សំបកជា **កម្មសិទ្ធិរបស់
  `CACHE_VERSION`** មិនមែនរបស់ការប្រណាំងក្នុងមួយសំណើទេ។
  Test៖ **`sw-shell-latency-test.js`**។
- **សំណើដែលព្យួរ ហើយគ្មានពិដានចំនួនស្របគ្នា** ➜ WiFi «ភ្ជាប់តែស្លាប់» ធ្វើឲ្យ
  `fetch()` ព្យួរ មិនធ្លាក់ភ្លាម ➜ ការស្កេននីមួយៗបើកសំណើថ្មី ➜ **ពេញកូតា
  connection របស់ browser** ➜ **គ្មានសំណើណាចេញបានទៀតទេ** រួមទាំងអ្វីដែល
  មិនពាក់ព័ន្ធ។ ការ cooldown ដែលកំណត់ត្រា **តែក្រោយបរាជ័យ** មិនទប់អ្វីទាំងអស់
  អំឡុងការព្យួរនោះ — ត្រូវការ **ការតាមដានសំណើដែលកំពុងដំណើរការ** បូកពិដាន។
  Test៖ **`network-pressure-test.js`**។
- **`fetch()` ឆៅក្នុង App ដែលតេស្តមិនស្កេន** ➜ `network-timeout-test.js`
  ធ្លាប់ស្កេនតែឯកសាររបស់ **ZoeW** ➜ `readUserRoleViaRest()` របស់ ZoeKeyGen
  រស់ជាមួយ `fetch()` គ្មាន timeout គ្មាន `AbortController` ហើយអាន
  `res.json()` ក្រៅបង្អួចការពារ រហូតដល់កំណែ 2.12.1។ **មេរៀន៖ ពេលសរសេរ
  checker ត្រូវសួរថា «វាស្កេនឯកសារ*ណា*ខ្លះ» — ថ្នាក់កំហុសដដែលរស់នៅ App ផ្សេង។**
- **ខ្សែអក្សរពី Firebase ធ្លាក់ចូល attribute របស់ handler** ➜ មុនកំណែ 2.13.0
  តម្លៃទាំងនោះចូល `onclick="fn('…')"` ដែលមាន **escape ២ ជាន់ជាន់គ្នា**៖
  browser ឌិកូដ HTML entity **មុន** ប្រគល់ទៅ JS parser ➜ `&#39;` ដែលមិន
  escape ក្លាយជា `'` ពិត ហើយបំបែកខ្សែអក្សរ។ Rules ផ្ទៀងផ្ទាត់តែ `isString()`
  លើ `id`/`code`/`phone`/`locker` ដូច្នេះ **គ្មានការការពារខាង server ទេ**។
  **កំណែ 2.13.0 លុបបំបាត់ថ្នាក់នេះតាមរចនាសម្ព័ន្ធ** — គ្មាន `on*=` ទៀតទេ
  (មើលផ្នែក «CSP និង `data-act`» ខាងលើ) ➜ តម្លៃចូល `data-a1`/`data-a2` ជា
  attribute ធម្មតា ➜ **គ្មាន JS parser ក្នុងផ្លូវនោះទៀតទេ** ➜ `sanitizeInput()`
  គ្រប់គ្រាន់។ `escapeForInlineJsAttr()` ត្រូវបានលុបចោល។
  Tests៖ **`inline-handler-xss-test.js`** (ការចាក់សោមាន **២ ខាង** — គ្មានកូដរត់
  **និង** ការចុចប៊ូតុងបញ្ជូនខ្សែអក្សរដើមបេះបិទ) និង **`csp-enforced-test.js`**។
- **`app.js` ហៅ `fb.X` ដែល `firebase-loader.js` មិន export** ➜ វា `undefined`
  លើផលិតកម្ម ហើយ guard បែប `typeof fb.X === 'function'` **លាក់វាទាំងស្រុង** —
  កូដមិន throw ទេ វាគ្រាន់តែ **ឈប់ធ្វើការស្ងាត់ៗ**។ រកឃើញលើ `goOffline`៖
  វដ្ត reset backoff ដែលមាន ៧៦ assertion ចាក់សោ **មិនដែលរត់សោះ** ព្រោះ
  fake SDK ក្នុងតេស្តផ្តល់ `goOffline` ឲ្យ ចំណែក loader ពិតមិនផ្តល់។
  **មេរៀន៖ ការប្រៀបធៀបនឹងវត្ថុក្លែងក្លាយ មិនអាចជំនួសការប្រៀបធៀបនឹងផ្ទៃពិតបានទេ។**
  Test៖ **`sdk-surface.js`**។
- **កំហុសបណ្តាញត្រូវច្រឡំជាកំហុស Config** ➜ ការបើកក្រៅបណ្តាញបង្ហាញប្រអប់ PIN
  សុំកំណត់ Config ឡើងវិញ ➜ អ្នកប្រើអាចលុប Config អាជីវកម្មរបស់ខ្លួនចោល។
  គ្រប់ `catch` ដែលបញ្ចប់ដោយ «សុំទិន្នន័យពីអ្នកប្រើឡើងវិញ» ត្រូវ **បែងចែក
  ថ្នាក់កំហុសជាមុនសិន**។ Test៖ **`sdk-offline-boot-test.js`**។
- **កូនសោសមាសធាតុដែលភ្ជាប់ដោយសញ្ញាបំបែក** (`a.join('~')`) ➜ ការប៉ះទង្គិច
  ពេលវាលណាមួយមានសញ្ញានោះ។ ក្នុងធុងសំរាមវាបាន merge អតិថិជន ២ នាក់ជាក្រុម
  តែមួយ ➜ **តួលេខលុយដែលបង្ហាញខុស**។ ត្រូវ **length-prefix** ជានិច្ច។
  Test៖ **`trash-modal-test.js`**។
- **ការឌិកូដស៊ុមវីដេអូដដែលពីរដង** ➜ ជាន់ការពារ «២ ស៊ុមជាប់គ្នា» ក្លាយជា ១ ស៊ុម។
  `takeFreshVideoFrame()` ការពារ **ហើយ fail open** បើ `currentTime` មិនរត់ (browser ខ្លះ
  ទុកវាថេរលើ MediaStream) — ការ fail closed នឹងបិទការស្កេនទាំងស្រុង។
  Test៖ **`scan-engine-test.js`**។

