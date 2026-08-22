# audit-tools

ឧបករណ៍ static-check + test សម្រាប់ការធ្វើ audit លើ Zoe-System។ រត់ពី **root** នៃ repo។
មិនមែនជាផ្នែកនៃ App ណាមួយទេ — មិន deploy ទេ។

| File | អ្វី |
|---|---|
| `shared-fns.js` | diff helper ដែលចែករំលែករវាង **ZoeW ↔ ZoeKeyGen** រួចរាយតែអ្វីដែលបែកគ្នាដោយមិនរំពឹងទុក — **រត់នេះមុនគេ** រាល់ជុំ audit — ត្រូវការ `acorn` |
| `policy-test.js` | ដក block ពិតរបស់ `claimAndCleanupItem` + `executeRestoreItem` ចេញពី `app.js` រួចផ្ទៀងផ្ទាត់គោលការណ៍ **លុប/ដក** (26 assertion) — `POLICY_APP_DIR=<dir>` ដើម្បីរត់លើ tree ផ្សេង |
| `auth-recovery-test.js` | ដក `doLogin`/`verifyAdminRoleThenProceed`/`retryPendingRoleCheck` ពិត ចេញពី **ZoeKeyGen** (App តែមួយដែលនៅរក្សាតួនាទី) រួចផ្ទៀងផ្ទាត់ការស្ដារ session ពេលបណ្ដាញយឺត និងផ្លូវ REST ពេល socket ស្លាប់ (43 assertion) — `AUTH_APP_DIR=<dir>` ដើម្បីរត់លើ tree ផ្សេង — គំរូ `onAuthStateChanged` ធ្វើតាម `AuthImpl.notifyAuthListeners` ពិតរបស់ `@firebase/auth@1.13.4` |
| `keylist-consistency-test.js` | ដក `refreshKeyList`/`renderKeyList` ពិតរបស់ ZoeKeyGen រួចផ្ទៀងផ្ទាត់ថា meta ចាស់/ថ្មីត្រូវបាន merge ត្រឹមត្រូវ ហើយ Key ដែលមិនទាន់ Migrate នៅតែបង្ហាញ note (15 assertion) |
| `license-grace-test.js` | ដក `activate`/`getStatus`/`checkOnline` ពិតរបស់ `license-verify.js` រួចផ្ទៀងផ្ទាត់ថាការ paste Key ដដែលឡើងវិញពេលក្រៅបណ្ដាញ **មិន reset ការអនុគ្រោះ ៣ ថ្ងៃ** និងថា Key ដែល Revoke ត្រូវបានបដិសេធតាំងពី Activate (13 assertion) |
| `phone-suggest-test.js` | ដក `collectPhoneSuggestions`/`showPhoneSuggestions`/`searchByPhone`/`updateRecentPhonesList` ពិត រួចផ្ទៀងផ្ទាត់ថាការវាយ **កន្ទុយលេខ ៣-៤ ខ្ទង់** បង្ហាញលេខត្រូវគ្នា និងថាបញ្ជីលេខ **មិនត្រូវកាត់ត្រឹម ៣០** ទៀត (29 assertion) — `PHONE_APP_DIR=<dir>` ដើម្បីរត់លើ tree ផ្សេង |
| `phone-search-swipe-test.js` | ដក `setupSwipeGestures`/`setPhoneSearchPulledUp`/`syncHistoryExpandedLock` ពិតរបស់ ZoeW រួចផ្ទៀងផ្ទាត់ថា **អូសឡើង/ចុះ បង្រួម ឬពង្រីកផ្ទាំងប្រវត្តិ**, ថាដងអូស `#dragHandle` ជាផ្លូវច្បាស់លាស់, ថា **auto pull up** ដំណើរការពេល focus ប្រអប់ស្វែងរក, និងថាការអូសឡើង **មិនលុបអ្វីដែលអ្នកប្រើកំពុងវាយ** (30 assertion) — `SWIPE_APP_DIR=<dir>` |
| `pin-prompt-test.js` | ដក `PIN_PROMPT_MESSAGES`/`applyPinPromptText`/`requestPinBeforeConfig` ពិត រួចផ្ទៀងផ្ទាត់ថា **រាល់ប៊ូតុងដែលការពារដោយ PIN បញ្ជូនឈ្មោះសកម្មភាពរបស់ខ្លួន** ហើយប្រអប់បង្ហាញសារត្រូវនឹងប៊ូតុងនោះ មិនមែន «Config ឬ Reconfig» គ្រប់ពេលទេ (38 assertion) — `PINPROMPT_APP_DIR=<dir>` |
| `biometric-unlock-test.js` | ដក `enrollBiometricRecord`/`biometricUnlockPin`/`runBiometricUnlock`/`completePinUnlock` ពិត រួចរត់ជាមួយ WebAuthn ក្លែងក្លាយ៖ ផ្ទៀងផ្ទាត់ថាការចងប្រើ **platform authenticator + userVerification: required**, ថា **PIN មិនត្រូវរក្សាជាអក្សរធម្មតា**, ថាការដោះសោនៅតែផ្ទៀងផ្ទាត់ PIN នឹង hash មុនទុកចិត្ត, ថាការប្តូរ PIN លុបការចងចាស់, ថាការជាប់សោមិនរំលង, និងថាកំណត់ត្រាខូច/ត្រូវគេកែចាត់ទុកជាបិទ (45 assertion) — `BIOMETRIC_APP_DIR=<dir>` |
| `keygen-pin-flow-test.js` | ដក `checkPinAndOpenConfig`/`requestPinBeforeConfig`/`isPinFlowPending` ពិតរបស់ ZoeKeyGen រួចផ្ទៀងផ្ទាត់ថា PIN flow **មិនរត់ callback ចាស់** (10 assertion) — `KEYGEN_APP_DIR=<dir>` |
| `barcode-shape-test.js` | ដក normalizer ពិតរបស់ `dbRefHistory` រួចផ្ទៀងផ្ទាត់ថា `barcodes` ដែល Firebase ត្រឡប់មកជា **object មានចន្លោះ** ឬជា **array ដែលមាន `null`** មិនធ្វើឲ្យកញ្ចប់បាត់ និងមិន throw ចេញពី callback (14 assertion) — `BARCODE_APP_DIR=<dir>` |
| `setup-link-logout-test.js` | ផ្ទៀងផ្ទាត់ថា Setup Link ដែលបើកចោល **មិនរស់រានក្រោយចាកចេញ** (មិនអាចបំពេញ config អាជីវកម្មផ្សេងចូលប្រអប់ Config ពេលក្រោយ) តែ Setup Link ដែលអ្នកប្រើកំពុងវាយ PIN ពិតៗ **មិនត្រូវបោះចោល** (21 assertion) — `SETUP_APP_DIR=<dir>` |
| `raw-read-shape-test.js` | ដក **ផ្លូវអានឆៅទាំង ៦** (transaction + ធុងសំរាម) ចេញពី `app.js` រួចផ្ទៀងផ្ទាត់ថារូបរាង `barcodes` មិនធម្មតាមិនធ្វើឲ្យកញ្ចប់បាត់ ឬធ្វើឲ្យ throw (38 assertion) — `RAWREAD_APP_DIR=<dir>` |
| `devtools-guard-test.js` | ផ្ទៀងផ្ទាត់ថា `checkDevTools()` របស់ ZoeKeyGen **មិនបណ្តេញអ្នកប្រើពេល zoom ឬបង្រួម window** តែនៅតែចាប់ devtools ពិត (8 assertion) — `DEVGUARD_APP_DIR=<dir>` |
| `concurrent-scan-test.js` | ដក `addOrUpdateEntry` ពិត រួចរត់ជាមួយ Firebase ក្លែងក្លាយដែលមាន **retry-on-conflict ពិត** និង `update()` អសមកាល ➜ ធ្វើតេស្តការប្រណាំងបានដោយគ្មាន emulator។ គ្របការស្កេនព្រមគ្នាពី ២ ឧបករណ៍ និងករណី order បិទរួចលើ server (22 assertion) — `CONCSCAN_APP_DIR=<dir>` |
| `payload-schema.js` | ប្រៀបធៀប property ដែលកូដសរសេរទៅ Firebase នឹង schema ក្នុង rules (រាយតែកន្លែងដែល `$other: false`) — ត្រូវការ `acorn` |
| `boot-runtime.js` | boot **App ទាំង ២ ក្នុង Chromium ពិត** ដោយទប់សំណើក្រៅ រួចចាប់ `pageerror`/`console.error` ព្រមទាំង assert ថា **កំណែបង្ហាញពិតក្នុងប្រអប់ login** (`កំណែប្រព័ន្ធ: <APP_VERSION>`) — `BOOT_APP_DIR=<dir>` |
| `setup-link-browser-test.js` | ដើរផ្លូវ provisioning ពេញលេញក្នុង browser ពិត៖ `?setup=` ➜ PIN gate ➜ ប្រអប់ Config ដែលបំពេញរួច ➜ **គ្មានអ្វីរក្សាទុករហូតដល់មនុស្សចុច Save** (18 assertion) — `SETUPLINK_APP_DIR=<dir>` |
| `ui-flow-test.js` | **ឧបករណ៍ខ្លាំងជាងគេសម្រាប់រកកំហុសថ្មី។** boot ZoeW ក្នុង Chromium ជាមួយ **Firebase ក្លែងក្លាយក្នុងសតិ** (ដាក់ចូលមុន script រត់ តាម `addInitScript`, ហើយ `license-verify.js` ត្រូវជំនួសតាម `page.route`) រួចដើរ UI ពិត៖ បិទ/បើកបញ្ជី, លុប➜ស្តារ ២ ជុំ, ដក➜ស្តារ, កែទឹកប្រាក់, **ការប្រណាំងឧបករណ៍ច្រើន**, **ផ្លូវបរាជ័យ `permission_denied`**, និងចុចគ្រប់ប៊ូតុង (25 assertion) — `UIFLOW_APP_DIR=<dir>`។ ត្រូវការ `playwright-core`; បើគ្មាន **SKIP ដោយស្អាត** |
| `layout-check.js` | ផ្ទុក App ទាំង ២ នៅ **320/360/412/768/1280/1440px** រួចរាយធាតុណាដែលលើសទទឹងអេក្រង់ដោយគ្មាន ancestor ដែល scroll បាន — ព្រមទាំង **បើក modal នីមួយៗដាច់ដោយឡែក** (36 assertion) — `LAYOUT_APP_DIR=<dir>`។ ប៊ូតុងតូចជាង 24px ជា `note` មិនមែន `FAIL` (ជម្រើសរចនា) |
| `field-shape-test.js` | seed record ដែលមានរូបរាងវាល **ក្រៅពី `barcodes`**៖ លេខទូរស័ព្ទ/barcode ជាចំនួន, cod/dod/count ជា string, `isClosed: "false"`, null, legacy `price`, `count` មិនត្រូវនឹង `barcodes.length`, និង HTML ក្នុងលេខទូរស័ព្ទ — រួច assert ថា listener មិន throw, គ្មានអ្វីបាត់ពីតម្រង "ទាំងអស់", គ្មាន NaN/`[object Object]`, និង **គ្មាន XSS** (9 assertion) — `FIELDSHAPE_APP_DIR=<dir>` |
| `slow-write-test.js` | ការសរសេរដែល **ចុះក្រោយពេល `withTimeout` បោះបង់រួច** — ថ្នាក់ដែលការអានកូដមើលមិនឃើញ ព្រោះវាត្រូវការពេលវេលា។ បង្រួមរាល់ timer ≥1s ចុះ ១០០ ដង ដូច្នេះ timeout ១៥ វិនាទី = ១៥០ms។ គ្របការ claim barcode ដែល timeout រួច commit យឺត, ការ save ដែលចុះយឺត, ការស្កេន barcode ដែលឧបករណ៍ផ្សេងបានបន្ថែមរួច (listener យឺត), និង `pendingBarcode` ទទេ (8 assertion) — `SLOWWRITE_APP_DIR=<dir>` |
| `revenue-fuzz-test.js` | **តេស្តតាម invariant មិនមែនតាមឆាក។** រត់លំដាប់ប្រតិបត្តិការ **ចៃដន្យ** (ស្កេន · បិទ/បើក · ដក · លុប · ស្តារ · កែទឹកប្រាក់ · សម្អាត 2h/8d) ជាមួយ PRNG ដែលមាន seed ថេរ ហើយក្រោយ **រាល់** ប្រតិបត្តិការ assert ២៖ `ចំណូល == ផលបូក cod នៃ barcode ពិត` (live + ធុងសំរាមដែល `isDeducted !== true`) និង `packagesPickedUp == ចំនួន barcode ដែល isClosed`។ ថែមទាំង **បញ្ចូលការសរសេររបស់ "ឧបករណ៍ផ្សេង" ដោយស្ងាត់** (លុប/ដក ដោយមិនបាញ់ listener) ដើម្បីធ្វើត្រាប់តាម listener យឺត — `FUZZ_RUNS` · `FUZZ_OPS` · `FUZZ_DEBUG=1` · `FUZZ_APP_DIR=<dir>` |
| `perf-check.js` | ដំណើរការនៅ `PERF_ORDERS` (លំនាំដើម 1200) order៖ cold render, repaint ដែលគ្មានអ្វីប្រែ, `collectPhoneSuggestions`, និងការវាយអក្សរពិត។ **កម្រិតតាមបន្ទុក** (`ORDERS × 0.6`) មិនមែនលេខថេររលុង ដូច្នេះវាចាប់ការថយចុះ ៨ ដងបាន។ *ចំណាំ៖ `renderHistory` មាន cache តាមជួរ (`dataset.sig`) ដូច្នេះការវាស់ត្រូវលុប `sig` ចោលមុន បើមិនដូច្នេះវាវាស់តែផ្លូវ cache* — `PERF_APP_DIR=<dir>` · `PERF_REPORT=1` |
| `compensation-order.js` | រក `p.then(A).catch(B)` ដែល B ជា **ការសង្គ្រោះ** (បញ្ច្រាសចំណូល/ដោះ claim/ស្តារ snapshot)។ JavaScript រត់ B ពេល **A throw** ដែរ ➜ ការសរសេរជោគជ័យ តែការសង្គ្រោះរត់ខុស។ វារំលង A ដែល throw មិនបាន (ឧ. `() => { flag = true; }` ដែលជាលំនាំទង់របស់ជុំ ១៣) — ត្រូវការ `acorn` · `COMP_APP_DIR=<dir>` |
| `setup-link-roundtrip-test.js` | កិច្ចសន្យាឆ្លង App៖ រត់បន្ទាត់ encode ពិតរបស់ `generateSetupLink()` (ZoeKeyGen) និង `decodeSetupPayload()` ពិតរបស់ ZoeW **ក្នុង vm តែមួយ** ➜ round-trip ជាមួយអក្សរខ្មែរ, emoji, `+`/`/` និង URL ពិត (9 assertion) — `SETUPRT_APP_DIR=<dir>` |
| `page-nav-test.js` | boot ZoeW ក្នុង Chromium ជាមួយ Firebase ក្លែងក្លាយ រួចផ្ទៀងផ្ទាត់រចនាសម្ព័ន្ធ UI ថ្មី៖ **ទំព័រ ២ + របា Slide**, ការផ្លាស់ទីប៊ូតុងរវាង (...) និងម៉ឺនុយ, **របៀបកំណត់ទីតាំង Locker** (គ្មានប្រអប់សួរពេលគ្មានទីតាំង / សួរបញ្ជាក់ពេលមានទីតាំងរួច), និង **លុបទាំងអស់តាមតម្រងថ្ងៃ + PIN gate** (32 assertion) — `PAGENAV_APP_DIR=<dir>` |
| `state-hygiene.js` | រកអថេរ state កម្រិត module ដែល **រស់រានក្រោយចាកចេញដោយគ្មានហេតុផលកត់ត្រា** (ថ្នាក់កំហុសដែលកើតឡើងវិញនៅជុំ ៣, ៤, ៥, ៦ និង ៧ — រកឃើញដោយភ្នែករាល់ជុំ) — ត្រូវការ `acorn` |
| `css-media-override.js` | រកច្បាប់ក្នុង `@media` ដែល**ស្លាប់ស្ងាត់ៗ** ព្រោះច្បាប់ដូចគ្នាក្រៅ `@media` មកក្រោយវា — `@media` មិនបន្ថែម specificity ទេ ដូច្នេះ source order ឈ្នះ។ ថ្នាក់នេះធ្លាប់ធ្វើឲ្យតារាងប្រវត្តិលើកុំព្យូទ័រកាត់ត្រឹម 62vh ជំនួសពេញកម្ពស់ជួរ — `CSSMEDIA_APP_DIR=<dir>` |
| `css-classes.js` | រក class ដែល HTML ឬ `app.js` ប្រើ តែ **គ្មានច្បាប់ក្នុង `style.css`** ➜ ធាតុឡើងគ្មានរចនាបថ |
| `wiring.js` | ការតភ្ជាប់ HTML↔JS ទាំងអស់ក្នុងមួយឧបករណ៍៖ `getElementById` ↔ `id=` (រាប់ទាំង id ដែល `app.js` បង្កើតជា string), id ស្ទួន, function ក្នុង inline `on*=` **ទាំងក្នុង HTML និងក្នុង HTML ដែល `app.js` បង្កើត**, គោលដៅ `data-close`, និង `onValue(dbRefX)` ដែលគ្មាន guard — ត្រូវការ `acorn` |
| `dom-hygiene.js` | រកវាល**ណាមួយ**ដែលត្រូវបានសរសេរដោយទិន្នន័យអតិថិជន តែ **មិនត្រូវបានលុបចោលពេលចាកចេញ** (ថ្នាក់កំហុសដែលកើតឡើងវិញនៅជុំ ៣, ៤, ៥ និង ៨) — ត្រូវការ `acorn` |
| `comments.js` | រាប់ comment (ត្រូវតែ 0) + trailing whitespace — ត្រូវការ `acorn` |
| `stale-write.js` | រកការសរសេរ **item ទាំងមូល** ទៅ `zoew_scan_history_cod_dod` / `zoew_recently_deleted_cod_dod` ដែលសង់ចេញពី `scanHistory`/`deletedItems` **ក្នុងសតិ** ➜ លុបការងាររបស់ឧបករណ៍ផ្សេង។ ការសរសេរដែលមានការអាន `fb.get` លើ node ជាក់លាក់ **មុន** ការសរសេរ ត្រូវបានទទួលយក។ ថ្នាក់នេះកើតឡើងក្នុងជុំ ១២, ១៣ និង ១៥ — ត្រូវការ `acorn` · `STALEWRITE_APP_DIR=<dir>` |
| `version-check.js` | កំណែ App៖ `APP_VERSION` ក្នុង `app.js` ទាំង ២ ត្រូវជា semver, ដូចគ្នាទាំង ២, ត្រូវនឹង `version` ក្នុង `manifest.json` នីមួយៗ, ហើយ `renderAppVersionLabels()` ត្រូវ byte-identical និងត្រូវបានហៅ។ ថែមទាំង assert ថាកន្លែងបង្ហាញ (`data-app-version`) មាន **១ ប៉ុណ្ណោះ ហើយនៅក្នុង `loginModal`** (16 assertion) — ត្រូវការ `acorn` · `VERSION_APP_DIR=<dir>` |
| `trimws.js <files>` | លុប trailing whitespace ដោយបញ្ជាក់ថា token stream មិនប្រែ |
| `emu/rules.sh` | តេស្ត `firebase-database.rules.json` ពិត លើ RTDB emulator (21 assertion)៖ គ្មាន auth ➜ បដិសេធ · អ្នកប្រើដែលចូលបាន ➜ សិទ្ធិដូចគ្នា · schema validation · node ដែលលុបចោលរួច ➜ បិទ · claim/witness fence។ **វាឈប់ភ្លាមបើ rules load មិនចូល** ព្រោះ emulator នឹងរក្សា rules ចាស់ ➜ false pass |

`dom-hygiene.js` មាន allowlist `ACCEPTED` នៅខាងលើឯកសារ ដែល **រាល់ធាតុមានហេតុផលសរសេរជាប់** —
វាល​ដែលមិនមែនជាទិន្នន័យអតិថិជន ឬវាលដែលមានផ្លូវលុបចោលឯទៀតរួចហើយ។ ធាតុគ្មានហេតុផលនឹងលាក់
ការលេចធ្លាយពិតបន្ទាប់ ដូច្នេះកុំបន្ថែមដោយគ្មានការពន្យល់។

`state-hygiene.js` និង `css-classes.js` មាន allowlist ដូចគ្នាដែរ (`ACCEPTED` / `IGNORE`) — ធាតុនីមួយៗ
មានហេតុផលសរសេរជាប់។ ដាក់ធាតុចូលទាល់តែបានតាមដានរួចថាវាពិតជាគ្មានគ្រោះថ្នាក់។

**ការត្រួតពិនិត្យ ៨ ត្រូវការ Chromium** (`boot-runtime`, `setup-link-browser-test`, `ui-flow`,
`layout-check`, `field-shape`, `slow-write`, `revenue-fuzz`, `perf-check`) — `npm i playwright-core`, រួច Chromium នៅ
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (ប្តូរបានតាម `*_CHROME`)។ បើគ្មាន វា
**SKIP ដោយស្អាត** — `run-all.sh` នៅតែរត់ចប់។

**អន្ទាក់ ៣ ក្នុង harness ដែលមាន Firebase ក្លែងក្លាយ** (បើសាង harness ថ្មី ឬកែ `ui-flow-test.js`)៖
1. `snapshot.val()` ត្រូវត្រឡប់ **ច្បាប់ចម្លងជ្រៅ** — បើត្រឡប់ reference ទៅ store នោះ
   `dailyPickupData` ក្លាយជា alias នៃ Firebase ហើយការកែក្នុងសតិ **និង** transaction បូកទាំងពីរ។
2. អថេរ `let` កម្រិត module **មិនស្ថិតលើ `window`** — មានតែ `function` declaration ទេ។
   អានវាដោយឈ្មោះទទេក្នុង `page.evaluate` (`typeof x !== 'undefined' ? x : {}`)។
3. seed ត្រូវប្រាកដនិយម៖ ចំណូលថ្ងៃ **≥** ផលបូក item បើមិនដូច្នេះ clamp-to-0 បាញ់ ហើយ
   ការ revert មើលទៅដូចមិនស៊ីមេទ្រី ខណៈវាត្រឹមត្រូវ។ វាលពិតគឺ `codDollar`/`dodDollar`/
   `totalCount` និង `packagesPickedUp`។

`shared-fns.js` មាន allowlist `EXPECTED_DIVERGENT` នៅខាងលើឯកសារ — helper ដែលបែកគ្នាដោយចេតនា
(label ជាក់លាក់តាម App, PBKDF2 salt, `initFirebase` ។ល។)។ បើបន្ថែម helper ចែករំលែកថ្មីមួយ
ដែលត្រូវតែដូចគ្នា **កុំដាក់វាចូល allowlist** — ចម្លងឲ្យដូចគ្នាបេះបិទវិញ។

## Firebase RTDB emulator

```
npm i firebase-tools                 # ដំឡើង CLI
npx firebase setup:emulators:database   # ទាញយក jar (ក្រោយ npm i ថត cache នៅទទេ)
java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
cp firebase-database.rules.json audit-tools/emu/real.rules.json
bash audit-tools/emu/rules.sh
```

`real.rules.json` ជាឯកសារបង្កើតឡើងវិញរាល់ដង (gitignored) — ចម្លងពី `firebase-database.rules.json` ជានិច្ច
មុននឹងរត់ ដើម្បីកុំឲ្យតេស្តលើ rules ចាស់។

**អន្ទាក់ ៤ ដែលខាតពេលច្រើន៖**
1. `firebase emulators:start` **upload rules មិនចេញ** កាត់ proxy — រត់ jar ផ្ទាល់។
2. `.settings/rules.json` និង `auth_variable_override` **ទាំងពីរត្រូវការ** `-H "Authorization: Bearer owner"` —
   បើគ្មាន rules មិន load ទេ ហើយ **តេស្តទាំងអស់ជោគជ័យក្លែងក្លាយ**។
3. កុំប្រើ `pkill -f firebase-database-emulator` — វាផ្គូផ្គងនឹង shell របស់ខ្លួនឯង (ហើយ `pgrep -f`
   ក៏ដូចគ្នា, ដូច្នេះវាមើលទៅដូចជា emulator នៅរស់ជានិច្ច)។ បិទតាម PID វិញ រួចផ្ទៀងផ្ទាត់ដោយ
   `curl` ទៅ port 9000។
4. request ដែលមាន `-H "Authorization: Bearer owner"` **ដោយគ្មាន** `auth_variable_override` ត្រូវបានចាត់ទុក
   ជា project owner ហើយ **រំលង rules ទាំងស្រុង** — តេស្ត "unauthenticated ត្រូវ DENIED" ដែលសរសេរបែបនោះ
   ជាការជោគជ័យក្លែងក្លាយ។ សម្រាប់ករណីនោះ កុំផ្ញើ Authorization header សោះ។

**តែងតែពិនិត្យថា write ដែលគួរ DENIED ពិតជា DENIED** មុននឹងជឿលទ្ធផល។
