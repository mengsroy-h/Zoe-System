# audit-tools

ឧបករណ៍ static-check + test សម្រាប់ការធ្វើ audit លើ Zoe-System។ រត់ពី **root** នៃ repo។
មិនមែនជាផ្នែកនៃ App ណាមួយទេ — មិន deploy ទេ។

| File | អ្វី |
|---|---|
| `extract.js <outdir>` | ដក function ទាំងអស់ពី ZoeAdmin/ZoeW `app.js` រួច diff គូឈ្មោះដូចគ្នា — **រត់នេះមុនគេ** រាល់ជុំ audit |
| `shared-fns.js` | diff helper ដែលចែករំលែក **ទាំង ៤ App** (មិនត្រឹមតែ ZoeAdmin↔ZoeW) រួចរាយតែអ្វីដែលបែកគ្នាដោយមិនរំពឹងទុក — ត្រូវការ `acorn` |
| `policy-test.js` | ដក block ពិតរបស់ `claimAndCleanupItem` + `executeRestoreItem` ចេញពី `app.js` ទាំងពីរ រួចផ្ទៀងផ្ទាត់គោលការណ៍ **លុប/ដក** (27 assertion/App) |
| `lookup-closed-test.js` | ដក `buildScannerLookupPayload` (ZoeAdmin) + `findLockerOccupant` (Zoescan) ពិត រួចផ្ទៀងផ្ទាត់ថាការព្រមានទីតាំងជាន់គ្នា **រំលងកញ្ចប់ដែលយកហើយ** (13 assertion) |
| `auth-recovery-test.js` | ដក `loginWithFirebase`/`doLogin`/`verify*RoleThenProceed`/`retryPendingRoleCheck` ពិត ចេញពី **ទាំង ៤ App** រួចផ្ទៀងផ្ទាត់ការស្ដារ session ពេលបណ្ដាញយឺត និងផ្លូវ REST ពេល socket ស្លាប់ (142 assertion) — គំរូ `onAuthStateChanged` ធ្វើតាម `AuthImpl.notifyAuthListeners` ពិតរបស់ `@firebase/auth@1.13.4` |
| `keylist-consistency-test.js` | ដក `refreshKeyList`/`renderKeyList` ពិតរបស់ ZoeKeyGen រួចផ្ទៀងផ្ទាត់ថា Key ដែលមានស្ថានភាពខុសគ្នារវាង App **មិនត្រូវបានបង្រួមបាត់** (15 assertion) |
| `license-grace-test.js` | ដក `activate`/`getStatus`/`checkOnline` ពិតរបស់ `license-verify.js` រួចផ្ទៀងផ្ទាត់ថាការ paste Key ដដែលឡើងវិញពេលក្រៅបណ្ដាញ **មិន reset ការអនុគ្រោះ ៣ ថ្ងៃ** និងថា Key ដែល Revoke ត្រូវបានបដិសេធតាំងពី Activate (13 assertion) |
| `phone-suggest-test.js` | ដក `collectPhoneSuggestions`/`showPhoneSuggestions`/`searchByPhone`/`updateRecentPhonesList` ពិតរបស់ ZoeAdmin+ZoeW រួចផ្ទៀងផ្ទាត់ថាការវាយ **កន្ទុយលេខ ៣-៤ ខ្ទង់** បង្ហាញលេខត្រូវគ្នា និងថាបញ្ជីលេខ **មិនត្រូវកាត់ត្រឹម ៣០** ទៀត (48 assertion) — `PHONE_APP_DIR=<dir>` ដើម្បីរត់លើ tree ផ្សេង |
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
