# audit-tools

ឧបករណ៍ static-check + test សម្រាប់ការធ្វើ audit លើ Zoe-System។ រត់ពី **root** នៃ repo។
មិនមែនជាផ្នែកនៃ App ណាមួយទេ — មិន deploy ទេ។

| File | អ្វី |
|---|---|
| `extract.js <outdir>` | ដក function ទាំងអស់ពី ZoeAdmin/ZoeW `app.js` រួច diff គូឈ្មោះដូចគ្នា — **រត់នេះមុនគេ** រាល់ជុំ audit |
| `shared-fns.js` | diff helper ដែលចែករំលែក **ទាំង ៤ App** (មិនត្រឹមតែ ZoeAdmin↔ZoeW) រួចរាយតែអ្វីដែលបែកគ្នាដោយមិនរំពឹងទុក — ត្រូវការ `acorn` |
| `policy-test.js` | ដក block ពិតរបស់ `claimAndCleanupItem` + `executeRestoreItem` ចេញពី `app.js` ទាំងពីរ រួចផ្ទៀងផ្ទាត់គោលការណ៍ **លុប/ដក** (27 assertion/App) |
| `lookup-closed-test.js` | ដក `buildScannerLookupPayload` (ZoeAdmin) + `findLockerOccupant` (Zoescan) ពិត រួចផ្ទៀងផ្ទាត់ថាការព្រមានទីតាំងជាន់គ្នា **រំលងកញ្ចប់ដែលយកហើយ** (13 assertion) |
| `idcheck.js` | `getElementById(...)` ទាំងអស់ត្រូវមាន `id=` ក្នុង HTML |
| `fncheck.js` | function ក្នុង inline `on*=` ទាំងអស់ត្រូវមានក្នុង `app.js` |
| `comments.js` | រាប់ comment (ត្រូវតែ 0) + trailing whitespace — ត្រូវការ `acorn` |
| `trimws.js <files>` | លុប trailing whitespace ដោយបញ្ជាក់ថា token stream មិនប្រែ |
| `emu/real.sh` | តេស្ត `firebase-database.rules.json` ពិត លើ RTDB emulator |
| `emu/partial-claim.sh` | តេស្តថា worker សរសេរ `barcodes[]` ដែលបង្រួមរួច (8-day partial claim) បាន |
| `emu/scanner-lookup-closed.sh` | តេស្ត field `isClosed` ថ្មីលើ `zoew_scanner_lookup` |

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
