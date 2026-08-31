# របាយការណ៍ Deep Audit ជុំទី ២ — Zoe System 2.23.5

កាលបរិច្ឆេទ៖ 2026-08-31
Baseline៖ ZIP Zoe System 2.23.4
វិសាលភាព៖ ZoeW, ZoeKeyGen, ZTO lookup, network/retry, Firebase reconnect,
Service Worker, dependency security, XSS/secret និងច្បាប់ Barcode/ស្ថិតិ/ចំណូល។

## សេចក្តីសន្និដ្ឋាន

Audit ជុំទី ២ រកឃើញ និងកែ race/bug ពិត ៧ ក្រុម៖ HTTP 429/5xx ដែលមិន retry,
ZTO URL មាន slash ខាងចុងដែលត្រូវចាត់ខុសជា list API, សំណើ Lookup ចាស់ដោះសោ
របស់សំណើថ្មី, callback Firebase `.info/*` ចាស់របស់ ZoeKeyGen និង SheetJS
0.18.5 ដែលមានបញ្ហាសុវត្ថិភាព ព្រមទាំង `zto-import` ដែលរក្សាពាក្យសម្ងាត់
plaintext ក្នុង `localStorage` និង top-level function ដែលប្រកាសស្ទួន។ បានកែ
checker ស្កេនដែលធ្លាប់វាស់តែការបង្កើត Promise និងផ្តល់លទ្ធផលល្បឿនភ្លឹបភ្លែត។

ជំនាន់ចុងក្រោយ៖

- ZoeW `2.23.5`, Service Worker cache `zoew-v137`
- ZoeKeyGen `2.19.15`, Service Worker cache `zoekeygen-v85`
- SheetJS `0.20.3` ផ្លូវការ

**Fast Mode មិនបានដកចេញ។ Manual auto-fallback មិនបានដកចេញ។** កូដ
Barcode/ស្ថិតិ/ចំណូលសំខាន់មិនត្រូវបានកែ។

## តារាងប្រៀបធៀបមុន និងក្រោយកែ

| ចំណុច | មុនកែ 2.23.4 | ក្រោយកែ 2.23.5 |
|---|---|---|
| HTTP 429/503 ពី ZTO | `fetch()` resolve ជា Response ហើយ error ត្រូវបោះក្រៅ `retryAsync`; សំណើទី ២ មិនចេញ | បម្លែងតែ 408/425/429/5xx ទៅ rejection ខាងក្នុង retry; 401/403 មិន retry |
| ZTO URL មាន `/` ខាងចុង | អាចត្រូវចាត់ជា API តារាង ហើយបាញ់ `list=1` ខុស | ទទួលស្គាល់ទាំង URL មាន/គ្មាន slash; warm-up ដដែល និងគ្មាន list request |
| Lookup ក្រោយប្តូរ Config | សំណើចាស់ចប់អាច `delete(key)` របស់សំណើថ្មី ➜ សំណើទី ៣ ស្ទួន | Map កាន់ token ម្ចាស់; មានតែសំណើម្ចាស់ token ទេដែលអាចដោះសោ |
| Firebase KeyGen reattach | callback `.info/*` ចាស់អាចលុប pending ថ្មី ឬទុកចិត្ត offset ចាស់ | generation fence រំលង success/error callback ចាស់ទាំងអស់ |
| SheetJS ក្នុង ZoeW | 0.18.5 | 0.20.3 ផ្លូវការ, SHA-256/SHA-384 ចាក់សោ |
| SheetJS ក្នុង zto-import Web | unpkg 0.18.5 | cdn.sheetjs.com 0.20.3 + SRI |
| ពាក្យសម្ងាត់ zto-import Web | រក្សា plaintext ក្នុង `localStorage` និង auto-unlock | រក្សាតែក្នុង memory ខណៈទំព័របើក; លុប legacy key ហើយអាចប្រើ password manager |
| Function declaration ZoeW | `closeGlobalMoreMenu()` មាន ២ declaration; ក្រោយសរសេរជាន់មុនដោយស្ងាត់ | រក្សាតែមួយ implementation; AST checker ទប់ការស្ទួនឡើងវិញ |
| Scan benchmark | មិន `await` ការឌិកូដមួយចំនួន; វាស់តែពេលបង្កើត Promise និងអាចធ្លាក់តាម CPU scheduling | `await` លទ្ធផលពិត, warm-up, samples ៣ ជុំ; រត់ជាប់ ៥ ដងបាន 52/52 |
| Fast Mode | cache record រកឃើញ ១០ នាទី | រក្សាដដែល |
| Manual auto-fallback | ១.៨ វិនាទី | រក្សាដដែល |

## ZTO lookup និង network

### HTTP retry ត្រឹមត្រូវ

`fetch()` reject តែពេល transport/network បរាជ័យ; HTTP 429 ឬ 503 នៅតែ
resolve ជា Response។ ក្នុង 2.23.4 កូដពិនិត្យ `res.ok` ក្រោយចេញពី
`retryAsync()` ដូច្នេះ HTTP error បណ្ដោះអាសន្នមិនបាន retry។ កំណែថ្មីធ្វើ៖

- retry លើ 408, 425, 429 និង 500–599
- មិន retry 401/403 ដើម្បីកុំបាញ់ Secret ខុសស្ទួន
- ZTO retry ទី ២ នៅតែចាប់ផ្តើមក្រោយ 350ms
- Generic customer-list API ក៏អនុវត្តច្បាប់ transient HTTP ដូចគ្នា
- timeout 16 វិនាទី និង per-barcode failure cooldown នៅដដែល

Regression test បង្ខំ 503 ➜ 200, 429 ➜ 200 និង 401 ➜ 200។ លទ្ធផលចុងក្រោយ៖
សំណើ transient ចេញ ២ ដងហើយជោគជ័យ; 401 ចេញតែម្តង និងបង្ហាញ Secret error។

### URL និង in-flight race

- Regex ZTO ទទួល optional trailing slash ដូច្នេះ
  `/.netlify/functions/zto-order-detail/?barcode=...` មិនធ្លាក់ទៅផ្លូវ `list=1`។
- `autoLookupInFlight` ប្តូរពី Set ទៅ Map ដែលកាន់ token របស់ការហៅនីមួយៗ។
  ការប្តូរ Config អាច clear state ហើយចាប់ផ្តើមសំណើថ្មីដោយសុវត្ថិភាព; `finally`
  របស់សំណើចាស់មិនប៉ះសោថ្មី។
- ពិដានសំណើស្របគ្នា, cache, cooldown និង status តាម Barcode នៅដដែល។

### Fast Mode និង manual fallback

- Fast Mode នៅតែចងចាំតែ record ដែលរកឃើញពិតរយៈពេល ១០ នាទី មានពិដាន
  ៣០០ Barcode និងលុបពេល config/session cache ប្រែ។
- Manual auto-fallback នៅតែផ្តល់ focus ក្រោយ ១.៨ វិនាទី ខណៈ automatic
  lookup នៅតែបន្ត។ វាមិនសរសេរជាន់អ្វីដែលអ្នកប្រើវាយ, មិនលេចពីក្រោយ PIN,
  មិន focus លើ modal បិទ និងមិនចាប់ Barcode ចាស់។
- Duplicate check ៥ ជាន់របស់ ZoeW នៅដដែល; Active Barcode មិនអាចស្ទួន។

## Firebase reconnect និង duplicate listener

ZoeW មាន generation fence រួចក្នុង 2.23.4 ប៉ុន្តែ ZoeKeyGen មិនទាន់មាន។
ពេល listener ចាស់ callback ក្រោយ `off()`/reattach វាអាច៖

- លុប pending path របស់ generation ថ្មី
- បង្ហាញថាភ្ជាប់ Server រួច ទោះ snapshot ថ្មីមិនទាន់មក
- ទុកចិត្ត `serverTimeOffset` ចាស់ ដែលប៉ះ gate នៃការចេញ Key

កំណែ 2.19.15 បន្ថែម `infoListenerGeneration`, `detachInfoListeners()` និង guard
ក្នុង success/error callback ទាំង ៤។ `off()` មុន attach, failed-path Set,
backoff, watchdog និង online/visibility recovery នៅដដែល។ Test ចុងក្រោយ៖
171/171 assertions។

## សុវត្ថិភាព dependency, secret និង XSS

### SheetJS

- ZoeW vendor 0.18.5 ត្រូវបានជំនួសដោយ 0.20.3 ផ្លូវការ។
- SHA-256 ចុងក្រោយ៖
  `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`។
- `dependency-security-test.js` ផ្ទៀងផ្ទាត់ version/hash និង round-trip `.xlsx`
  ដែលរក្សា Barcode `001234567890` និង Phone `0970000000` ជាអត្ថបទ។
- zto-import Web fallback ប្រើ URL ផ្លូវការ 0.20.3 និង SRI SHA-384; គ្មាន
  unpkg/0.18.5។

### Secret/XSS

- ZTO warm-up ប្រើ OPTIONS ហើយមិនផ្ញើ Barcode, Cookie ឬ Proxy Key។
- Lookup Secret និង import config នៅតែ AES-GCM ក្រោមកូនសោដែល derive ពី PIN។
- ទំព័រ Web បម្រុង `zto-import` លែងសរសេរ `IMPORT_PASSWORD` plaintext ចូល
  `localStorage`; វាលុប key ចាស់ `zto_import_password` ពេល boot ហើយរក្សា secret
  តែក្នុង memory រហូតដល់បិទ/refresh ទំព័រ។ `autocomplete="current-password"`
  នៅដដែល ដើម្បីឱ្យ password manager របស់ browser អាចបំពេញដោយសុវត្ថិភាព។
- Lookup status ប្រើ `textContent` និង class allowlist; response មិនអាចបញ្ចូល
  HTML/CSS class ផ្ទាល់។
- CSP, inline-handler XSS, DOM sink, secret hygiene និង credential scan បាន
  ឆ្លងកាត់ក្នុង full suite។
- `license-verify.js` និង `error-reporting.js` នៅ byte-identical ទាំង ២ App។

## ច្បាប់ Barcode, ស្ថិតិ និង cleanup

| សកម្មភាព | ច្បាប់ក្រុមហ៊ុន | ស្ថានភាពចុងក្រោយ |
|---|---|---|
| លុបកញ្ចប់ទាំងមូល | មិនដកចំណូល/ស្ថិតិ | រក្សាដដែល |
| ស្តារកញ្ចប់ដែលលុប | មិនបូកចំណូល/ស្ថិតិ និងមិនបូកស្ទួន | រក្សាដដែល |
| ដក Barcode មួយ | ដកចំណូល/ស្ថិតិភ្លាម | រក្សាដដែល |
| ស្តារ Barcode ដែលដក | បូកមកវិញតែម្តង បើ `isDeducted=true` | រក្សាដដែល |
| Cleanup ២ ម៉ោង | Barcode បិទ «យករួច» ទៅ pickup; មិនប៉ះចំណូល | រក្សាដដែល |
| Cleanup ៨ ថ្ងៃ | Barcode មិនទាន់យកទៅ expired; ដកចំណូល/ស្ថិតិ | រក្សាដដែល |
| Cleanup ៣០ ថ្ងៃ | លុបធាតុ trash ចាស់ជាអចិន្ត្រៃយ៍ | រក្សាដដែល |

Function body សំខាន់ ១៣ ត្រូវប្រៀបធៀប byte-for-byte នឹង baseline 2.23.4៖
`deleteSingleItem`, `removeSingleBarcode`, `restoreClaimedItemToScanHistory`,
`claimAndCleanupItem`, `runAutomaticCleanupRules`,
`runAutomaticDeletedCleanup`, `addRevenueToDailyAndMonthlyRecord`,
`commitDailyPickupDelta`, `toggleIndividualBarcodeClose`, `toggleCloseStatus`,
`executePermanentDelete`, `barcodeCloseIsRipe` និង
`normalizeBarcodeCloseStamps`។ Firebase Rules ទាំង ២ មិនមាន diff។

## Service Worker និងឧបករណ៍គ្រប់ប្រភេទ

- Service Worker នៅ intercept តែ GET; Netlify Function/ZTO response នៅ
  network-only និងមិនចូល Cache Storage។
- CORE_SHELL មាន engine ស្កេន និង SheetJS 0.20.3; install បរាជ័យបើ asset ស្នូល
  ខ្វះ ដូច្នេះមិន activate សំបកពាក់កណ្ដាល។
- Offline shell, install integrity, cache key, stale revalidation, abort,
  request timeout, network pressure និង listener leak ត្រូវបានគ្របដោយ browser test។
- Scan engine នៅតែ CODE-128 + WebAssembly, បដិសេធ ITF និងបញ្ជាក់ ២ ស៊ុម។
  ការសម្របទំហំ/ល្បឿនតាមឧបករណ៍នៅដដែល។

## Function-surface audit

- ZoeW៖ 518 top-level + 32 named nested; សរុប 1,147 function/callback nodes;
  dynamic routes 99។
- ZoeKeyGen៖ 114 top-level + 5 named nested; សរុប 265 function/callback nodes;
  dynamic routes 20។
- Helper/Service Worker/Netlify/Apps Script ដែល ship 14 ឯកសារ parse តាម AST
  បានទាំងអស់ (283 function/callback nodes)។
- គ្មាន top-level declaration ស្ទួន, គ្មាន named function គ្មាន reference និង
  គ្មាន `data-act`/`data-close`/allowlist ដែលចង្អុលទៅ function បាត់។
- Static surface មិនស្មើការធានា semantics 100% ទេ; behavior/integration/browser
  suite ជាអ្នកបញ្ជាក់លំហូរពិត។ Safari ពិត, hardware camera/biometric, live ZTO
  និង Firebase emulator ពិតនៅតែជាចំណុចដែលត្រូវផ្ទៀងផ្ទាត់ក្នុងបរិស្ថាន deploy។

## លទ្ធផលតេស្តសំខាន់

- ZTO lookup/prefetch/retry/fallback៖ 141/141
- Lookup freshness/import cache៖ 131/131
- Firebase connection recovery៖ 171/171
- Dependency security និង plaintext-secret regression៖ 11/11
- Function surface៖ 18/18 (baseline ធ្លាក់លើ duplicate declaration)
- Scan engine៖ 52/52 និងរត់ស្ថេរភាព ៥ ជុំជាប់គ្នា
- Sheet import browser៖ 73/73
- Excel export cells៖ 32/32
- zto-import server chain៖ 50/50
- Offline shell៖ 19/19
- Service Worker install integrity៖ 16/16
- CSP lazy resource៖ 20/20
- Version consistency/scope និង shared functions៖ ឆ្លងកាត់

Full `run-all.sh` ចុងក្រោយ៖ **114 checker ពេញលេញ, 1 partial, 1 skip និង
0 failure**។ Partial/skip ទាំង ២ ជា RTDB emulator ព្រោះមិនមាន service នៅ
`127.0.0.1:9000`; វាមិនត្រូវបានរាប់ជាបៃតងពេញលេញទេ។

RTDB emulator strict បានឆ្លងកាត់លើ baseline 2.23.4 (CRUD/rules 44/44 និង
restore/deadlock 12/12)។ ជុំនេះមិនកែ business functions ឬ Firebase Rules;
parity 13/13 និង rules diff ទទេជាភស្តុតាងថាលំហូរដែលបានសាកនោះនៅដដែល។

## ការដាក់ប្រើ

1. Deploy static files របស់ ZoeW និង ZoeKeyGen ជាមួយគ្នា។
2. បើប្រើ zto-import Web fallback៖ copy `zto-import/Index.html` ថ្មីទៅ
   Apps Script ហើយ Deploy ជាកំណែថ្មី។
3. មិនត្រូវ Publish Firebase Rules ព្រោះ rules មិនបានប្តូរ។
4. មិនត្រូវបន្ថែម Secret/environment variable ថ្មី។
