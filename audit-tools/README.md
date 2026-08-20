# audit-tools

ឧបករណ៍ static-check + test សម្រាប់ការធ្វើ audit លើ Zoe-System។ រត់ពី **root** នៃ repo។
មិនមែនជាផ្នែកនៃ App ណាមួយទេ — មិន deploy ទេ។

| File | អ្វី |
|---|---|
| `extract.js <outdir>` | ដក function ទាំងអស់ពី ZoeAdmin/ZoeW `app.js` រួច diff គូឈ្មោះដូចគ្នា — **រត់នេះមុនគេ** រាល់ជុំ audit |
| `shared-fns.js` | diff helper ដែលចែករំលែក **ទាំង ៤ App** (មិនត្រឹមតែ ZoeAdmin↔ZoeW) រួចរាយតែអ្វីដែលបែកគ្នាដោយមិនរំពឹងទុក — ត្រូវការ `acorn` |
| `policy-test.js` | ដក block ពិតរបស់ `claimAndCleanupItem` + `executeRestoreItem` ចេញពី `app.js` ទាំងពីរ រួចផ្ទៀងផ្ទាត់គោលការណ៍ **លុប/ដក** (27 assertion/App) |
| `lookup-closed-test.js` | ដក `buildScannerLookupPayload` (ZoeAdmin) + `findLockerOccupant` (Zoescan) ពិត រួចផ្ទៀងផ្ទាត់ថាការព្រមានទីតាំងជាន់គ្នា **រំលងកញ្ចប់ដែលយកហើយ** (13 assertion) |
| `auth-recovery-test.js` | ដក `loginWithFirebase`/`doLogin`/`verify*RoleThenProceed`/`retryPendingRoleCheck` ពិត ចេញពី **ទាំង ៤ App** រួចផ្ទៀងផ្ទាត់ការស្ដារ session ពេលបណ្ដាញយឺត និងផ្លូវ REST ពេល socket ស្លាប់ (191 assertion) — `AUTH_APP_DIR=<dir>` ដើម្បីរត់លើ tree ផ្សេង — គំរូ `onAuthStateChanged` ធ្វើតាម `AuthImpl.notifyAuthListeners` ពិតរបស់ `@firebase/auth@1.13.4` |
| `keylist-consistency-test.js` | ដក `refreshKeyList`/`renderKeyList` ពិតរបស់ ZoeKeyGen រួចផ្ទៀងផ្ទាត់ថា Key ដែលមានស្ថានភាពខុសគ្នារវាង App **មិនត្រូវបានបង្រួមបាត់** (15 assertion) |
| `license-grace-test.js` | ដក `activate`/`getStatus`/`checkOnline` ពិតរបស់ `license-verify.js` រួចផ្ទៀងផ្ទាត់ថាការ paste Key ដដែលឡើងវិញពេលក្រៅបណ្ដាញ **មិន reset ការអនុគ្រោះ ៣ ថ្ងៃ** និងថា Key ដែល Revoke ត្រូវបានបដិសេធតាំងពី Activate (13 assertion) |
| `phone-suggest-test.js` | ដក `collectPhoneSuggestions`/`showPhoneSuggestions`/`searchByPhone`/`updateRecentPhonesList` ពិតរបស់ ZoeAdmin+ZoeW រួចផ្ទៀងផ្ទាត់ថាការវាយ **កន្ទុយលេខ ៣-៤ ខ្ទង់** បង្ហាញលេខត្រូវគ្នា និងថាបញ្ជីលេខ **មិនត្រូវកាត់ត្រឹម ៣០** ទៀត (48 assertion) — `PHONE_APP_DIR=<dir>` ដើម្បីរត់លើ tree ផ្សេង |
| `zoescan-list-test.js` | ដក `renderList` ពិតរបស់ Zoescan រួចផ្ទៀងផ្ទាត់ថាតម្រងទីតាំង **មិនខុសពីអ្វីដែល dropdown បង្ហាញ** និងថាការស្វែងរកលេខដើរតាមកន្ទុយលេខ (7 assertion) — `ZOESCAN_APP_DIR=<dir>` |
| `keygen-pin-flow-test.js` | ដក `checkPinAndOpenConfig`/`requestPinBeforeConfig`/`isPinFlowPending` ពិតរបស់ ZoeKeyGen រួចផ្ទៀងផ្ទាត់ថា PIN flow **មិនរត់ callback ចាស់** (10 assertion) — `KEYGEN_APP_DIR=<dir>` |
| `barcode-shape-test.js` | ដក normalizer ពិតរបស់ `dbRefHistory` (ZoeAdmin+ZoeW) និង `buildBarcodeIndex` (Zoescan) រួចផ្ទៀងផ្ទាត់ថា `barcodes` ដែល Firebase ត្រឡប់មកជា **object មានចន្លោះ** ឬជា **array ដែលមាន `null`** មិនធ្វើឲ្យកញ្ចប់បាត់ និងមិន throw ចេញពី callback (28 assertion) — `BARCODE_APP_DIR=<dir>` |
| `setup-link-logout-test.js` | ផ្ទៀងផ្ទាត់ថា Setup Link ដែលបើកចោល **មិនរស់រានក្រោយចាកចេញ** (មិនអាចបំពេញ config អាជីវកម្មផ្សេងចូលប្រអប់ Config ពេលក្រោយ) តែ Setup Link ដែលអ្នកប្រើកំពុងវាយ PIN ពិតៗ **មិនត្រូវបោះចោល** (21 assertion) — `SETUP_APP_DIR=<dir>` |
| `phone-search-swipe-test.js` | ដក `setupSwipeGestures`/`positionPhoneSuggestBox` ពិត (ZoeAdmin+ZoeW) រួចផ្ទៀងផ្ទាត់ថាការអូសឡើងលើ **មិនបំបាត់ប្រអប់ស្វែងរកលេខ** ខណៈ **ឥរិយាបថអូសដើម (ឡើង➜ប្រវត្តិឡើង / ចុះ➜ប្រវត្តិចុះ) នៅដដែល** (18 assertion) — `SWIPE_APP_DIR=<dir>` |
| `raw-read-shape-test.js` | ដក **ផ្លូវអានឆៅទាំង ៦** (transaction + ធុងសំរាម) ចេញពី `app.js` រួចផ្ទៀងផ្ទាត់ថារូបរាង `barcodes` មិនធម្មតាមិនធ្វើឲ្យកញ្ចប់បាត់ ឬធ្វើឲ្យ throw (38 assertion) — `RAWREAD_APP_DIR=<dir>` |
| `devtools-guard-test.js` | ផ្ទៀងផ្ទាត់ថា `checkDevTools()` របស់ ZoeKeyGen **មិនបណ្តេញអ្នកប្រើពេល zoom ឬបង្រួម window** តែនៅតែចាប់ devtools ពិត (8 assertion) — `DEVGUARD_APP_DIR=<dir>` |
| `concurrent-scan-test.js` | ដក `addOrUpdateEntry` ពិត រួចរត់ជាមួយ Firebase ក្លែងក្លាយដែលមាន **retry-on-conflict ពិត** និង `update()` អសមកាល ➜ ធ្វើតេស្តការប្រណាំងបានដោយគ្មាន emulator។ គ្របការស្កេនព្រមគ្នាពី ២ ឧបករណ៍ និងករណី order បិទរួចលើ server (22 assertion) — `CONCSCAN_APP_DIR=<dir>` |
| `payload-schema.js` | ប្រៀបធៀប property ដែលកូដសរសេរទៅ Firebase នឹង schema ក្នុង rules (រាយតែកន្លែងដែល `$other: false`) — ត្រូវការ `acorn` |
| `boot-runtime.js` | boot **ទាំង ៤ App ក្នុង Chromium ពិត** ដោយទប់សំណើក្រៅ រួចចាប់ `pageerror`/`console.error` — `BOOT_APP_DIR=<dir>` |
| `setup-link-browser-test.js` | ដើរផ្លូវ provisioning ពេញលេញក្នុង browser ពិត៖ `?setup=` ➜ PIN gate ➜ ប្រអប់ Config ដែលបំពេញរួច ➜ **គ្មានអ្វីរក្សាទុករហូតដល់មនុស្សចុច Save** (18 assertion) — `SETUPLINK_APP_DIR=<dir>` |
| `ui-flow-test.js` | **ឧបករណ៍ខ្លាំងជាងគេសម្រាប់រកកំហុសថ្មី។** boot ZoeAdmin/ZoeW/Zoescan ក្នុង Chromium ជាមួយ **Firebase ក្លែងក្លាយក្នុងសតិ** (ដាក់ចូលមុន script រត់ តាម `addInitScript`, ហើយ `license-verify.js` ត្រូវជំនួសតាម `page.route`) រួចដើរ UI ពិត៖ បិទ/បើកបញ្ជី, លុប➜ស្តារ ២ ជុំ, ដក➜ស្តារ, កែទឹកប្រាក់, **ការប្រណាំងឧបករណ៍ច្រើន**, **ផ្លូវបរាជ័យ `permission_denied`**, និងចុចគ្រប់ប៊ូតុង (41 assertion) — `UIFLOW_APP_DIR=<dir>`។ ត្រូវការ `playwright-core`; បើគ្មាន **SKIP ដោយស្អាត** |
| `layout-check.js` | ផ្ទុក App ទាំង ៤ នៅ **320/360/412/768px** រួចរាយធាតុណាដែលលើសទទឹងអេក្រង់ដោយគ្មាន ancestor ដែល scroll បាន — ព្រមទាំង **បើក modal នីមួយៗដាច់ដោយឡែក** (48 assertion) — `LAYOUT_APP_DIR=<dir>`។ ប៊ូតុងតូចជាង 24px ជា `note` មិនមែន `FAIL` (ជម្រើសរចនា) |
| `field-shape-test.js` | seed record ដែលមានរូបរាងវាល **ក្រៅពី `barcodes`**៖ លេខទូរស័ព្ទ/barcode ជាចំនួន, cod/dod/count ជា string, `isClosed: "false"`, null, legacy `price`, `count` មិនត្រូវនឹង `barcodes.length`, និង HTML ក្នុងលេខទូរស័ព្ទ — រួច assert ថា listener មិន throw, គ្មានអ្វីបាត់ពីតម្រង "ទាំងអស់", គ្មាន NaN/`[object Object]`, និង **គ្មាន XSS** (18 assertion) — `FIELDSHAPE_APP_DIR=<dir>` |
| `setup-link-roundtrip-test.js` | កិច្ចសន្យាឆ្លង App៖ រត់បន្ទាត់ encode ពិតរបស់ `generateSetupLink()` (ZoeKeyGen) និង `decodeSetupPayload()` ពិតរបស់ App ទាំង ៣ **ក្នុង vm តែមួយ** ➜ round-trip ជាមួយអក្សរខ្មែរ, emoji, `+`/`/` និង URL ពិត (23 assertion) — `SETUPRT_APP_DIR=<dir>` |
| `state-hygiene.js` | រកអថេរ state កម្រិត module ដែល **រស់រានក្រោយចាកចេញដោយគ្មានហេតុផលកត់ត្រា** (ថ្នាក់កំហុសដែលកើតឡើងវិញនៅជុំ ៣, ៤, ៥, ៦ និង ៧ — រកឃើញដោយភ្នែករាល់ជុំ) — ត្រូវការ `acorn` |
| `css-classes.js` | រក class ដែល HTML ឬ `app.js` ប្រើ តែ **គ្មានច្បាប់ក្នុង `style.css`** ➜ ធាតុឡើងគ្មានរចនាបថ |
| `wiring.js` | ការតភ្ជាប់ HTML↔JS ទាំងអស់ក្នុងមួយឧបករណ៍៖ `getElementById` ↔ `id=` (រាប់ទាំង id ដែល `app.js` បង្កើតជា string), id ស្ទួន, function ក្នុង inline `on*=` **ទាំងក្នុង HTML និងក្នុង HTML ដែល `app.js` បង្កើត**, គោលដៅ `data-close`, និង `onValue(dbRefX)` ដែលគ្មាន guard — ត្រូវការ `acorn` |
| `dom-hygiene.js` | រកវាល**ណាមួយ**ដែលត្រូវបានសរសេរដោយទិន្នន័យអតិថិជន តែ **មិនត្រូវបានលុបចោលពេលចាកចេញ** (ថ្នាក់កំហុសដែលកើតឡើងវិញនៅជុំ ៣, ៤, ៥ និង ៨) — ត្រូវការ `acorn` |
| `comments.js` | រាប់ comment (ត្រូវតែ 0) + trailing whitespace — ត្រូវការ `acorn` |
| `trimws.js <files>` | លុប trailing whitespace ដោយបញ្ជាក់ថា token stream មិនប្រែ |
| `emu/real.sh` | តេស្ត `firebase-database.rules.json` ពិត លើ RTDB emulator |
| `emu/partial-claim.sh` | តេស្តថា worker សរសេរ `barcodes[]` ដែលបង្រួមរួច (8-day partial claim) បាន |
| `emu/scanner-lookup-closed.sh` | តេស្ត field `isClosed` ថ្មីលើ `zoew_scanner_lookup` |

`dom-hygiene.js` មាន allowlist `ACCEPTED` នៅខាងលើឯកសារ ដែល **រាល់ធាតុមានហេតុផលសរសេរជាប់** —
វាល​ដែលមិនមែនជាទិន្នន័យអតិថិជន ឬវាលដែលមានផ្លូវលុបចោលឯទៀតរួចហើយ។ ធាតុគ្មានហេតុផលនឹងលាក់
ការលេចធ្លាយពិតបន្ទាប់ ដូច្នេះកុំបន្ថែមដោយគ្មានការពន្យល់។

`state-hygiene.js` និង `css-classes.js` មាន allowlist ដូចគ្នាដែរ (`ACCEPTED` / `IGNORE`) — ធាតុនីមួយៗ
មានហេតុផលសរសេរជាប់។ ដាក់ធាតុចូលទាល់តែបានតាមដានរួចថាវាពិតជាគ្មានគ្រោះថ្នាក់។

**ការត្រួតពិនិត្យ ៥ ត្រូវការ Chromium** (`boot-runtime`, `setup-link-browser-test`, `ui-flow`,
`layout-check`, `field-shape`) — `npm i playwright-core`, រួច Chromium នៅ
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
bash audit-tools/emu/real.sh
bash audit-tools/emu/partial-claim.sh
bash audit-tools/emu/scanner-lookup-closed.sh
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
