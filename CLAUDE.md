# Zoe-System

> ## ⚡ START HERE — អានផ្នែកនេះមុនគេ (ធ្វើបច្ចុប្បន្នភាព 2026-08-20, ក្រោយជុំ audit ទី ១២)
>
> ឯកសារនេះត្រូវបានសរសេរឲ្យ **session Claude ថ្មីទាំងស្រុង** អាចបន្តការងារបាន ដោយមិនចាំបាច់មាន
> ប្រវត្តិការសន្ទនាមុន។ អានប្លុកនេះ + section **"របៀបធ្វើ audit លើគម្រោងនេះ"** ខាងក្រោមភ្លាម
> ជាការគ្រប់គ្រាន់ដើម្បីចាប់ផ្តើម។
>
> ### ស្ថានភាពកូដ
> **អ្វីៗរហូតដល់ជុំ ១១ ស្ថិតក្នុង `main` រួចរាល់** (PR #37/#38/#39, HEAD `321a5d6`)។
> **ជុំ ១២ ស្ថិតលើ `claude/deep-audit-yi21xn` ហើយ *មិនទាន់* merge ទេ** — វាកែកំហុស ៤ ដែល
> ២ ក្នុងនោះជាការតំរែតំរង់ដែលជុំមុនបង្កើត (Setup Link របស់ ZoeAdmin, និងការកែរូបរាង `barcodes`
> ដែលមិនពេញលេញ)។ **ផ្ទៀងផ្ទាត់ជានិច្ចដោយ `git rev-list --count origin/main..origin/<branch>`
> — កុំចម្លងបន្ទាត់នេះមកដាក់ដោយមិនរត់ពាក្យបញ្ជា។**
> Netlify deploy `main` ស្វ័យប្រវត្តិ ➜ ដល់ production។
>
> **Firebase rules ទាំងពីរ publish រួចរាល់ហើយ** (root និង `ZoeKeyGen/`) ហើយ **ជុំ ១១ មិនប្តូរ
> rules ទេ ➜ គ្មាន publish ថ្មីត្រូវធ្វើ**។ Rules JSON ក្នុង repo នេះ **មិន deploy ស្វ័យប្រវត្តិទេ**
> — Netlify បម្រើតែឯកសារ static; ត្រូវ paste ចូល Firebase Console ➜ Publish ដោយដៃ។
> ដូច្នេះ **រាល់ពេលបន្ថែម path ថ្មីក្នុង Firebase ត្រូវបន្ថែម rule ក្នុង commit ដដែល ហើយប្រាប់
> អ្នកប្រើថាត្រូវ publish ដោយដៃ។**
>
> ### ច្បាប់ដែលមិនអាចរំលងបាន
> ១. **ប្រព័ន្ធនេះកំពុងដំណើរការជាមួយអតិថិជនពិត និងលុយពិត (COD/DOD)។** កុំ merge ចូល `main`
>    ដោយគ្មានការស្នើច្បាស់លាស់ពីអ្នកប្រើ។
> ២. **"លុប" (Delete) ទល់នឹង "ដក" (Remove) ជាគោលការណ៍អាជីវកម្ម មិនមែនកំហុសទេ** — អានផ្នែក
>    "Core business rule" ខាងក្រោមឲ្យចប់ មុននឹងប៉ះកូដណាមួយដែលទាក់ទងចំណូល។
> ៣. **កូដ `app.js` ត្រូវតែគ្មាន comment** (ទម្លាប់គម្រោង, commit `a6aa840`)។ `qrcode.js` ជា
>    library ខាងក្រៅ — លើកលែង។
> ៤. **`license-verify.js` និង `error-reporting.js` ត្រូវតែ byte-identical ទាំង ៤ App។**
>    ប្រើ `cp` + `md5sum` កុំកែម្តងមួយ App។
> ៥. **App នីមួយៗមាន `app.js` ដាច់ដោយឡែក ដែលកូដស្ទួនគ្នា** — ការកែក្នុង App មួយ **មិន**
>    អនុវត្តទៅ App ដទៃដោយស្វ័យប្រវត្តិទេ។ ពិនិត្យជានិច្ចថាតើត្រូវចម្លងទៅបងប្អូនឬអត់។
> ៦. **កុំសរសេរការអះអាងអំពី git/branch/merge ដោយមិនផ្ទៀងផ្ទាត់** — ប្រើ
>    `git rev-list --count origin/main..origin/<branch>`។ រឿងនេះខុស ២ ដងក្នុង ២ ជុំជាប់គ្នា
>    ព្រោះចម្លងបន្ទាត់ចាស់មកដាក់។ **ឯកសារនេះមិនមែនជាភស្តុតាងទេ — git ទើបជាភស្តុតាង។**
>
> ### អ្វីដែលទទួលយកដោយចេតនា — កុំរាយការណ៍ជាកំហុសថ្មី
> - **worker អាចសរសេរតួលេខ revenue/pickup ដោយផ្ទាល់** — គ្មាន rule ណាអាចផ្ទៀងផ្ទាត់ប្រវត្តិ
>   នៃ delta បានទេ ដោយគ្មាន backend ដែលទុកចិត្តបាន (Cloud Functions)។ គម្រោងនេះគ្មាន backend។
> - **គ្មានការផ្ទៀងផ្ទាត់ aggregate** ដោយហេតុផលដដែល។
> - **ZoeKeyGen "Extend" ផ្លាស់តែពិដានខាង server** មិនមែន `exp` ដែល sign រួច — ដូច្នេះ Key
>   ដែលបន្ថែមសុពលភាព **activate លើឧបករណ៍ថ្មីមិនបាន** ក្រោយថ្ងៃ sign ដើម។ ប្រអប់ប្រាប់រួចហើយ។
> - **ការលុប site data reset ការអនុគ្រោះ ៣ ថ្ងៃបាន** — គ្មានផ្លូវការពារខាង client។
> - **ការ re-provision ឧបករណ៍ដែលមាន config រួច តែចាកចេញរួច តាម Setup Link មិនដើរស្វ័យប្រវត្តិ**
>   — អ្នកប្រើសម្រេចទុកដដែល (2026-08-20) ព្រោះការកែប៉ះផ្លូវ login ដែលផុយបំផុត។
> - **Zoescan៖ QR ដែលមិនមែន Setup Link ធ្វើឲ្យ toast ចេញឡើងវិញរាល់ frame** — រំខានតែប៉ុណ្ណោះ។
> - **`google-sheets-api/Code.gs` ជា template** — ការកែក្នុង repo មិនប្តូរ script ដែល deploy រួច។
>
> ### កំហុសដែលទើបកែក្នុងជុំ ១២ (កុំ audit ឡើងវិញដោយងងឹតងងុល)
> ១. **រូបរាង `barcodes` លើផ្លូវអានឆៅទាំង ៦** — ជុំ ១១ កែតែ normalizer នៃ `onValue`; ធុងសំរាម
>    និង `runTransaction` ទាំង ៤ អានពី server ដោយផ្ទាល់។ `normalizeBarcodesOf()` ថ្មី។
> ២. **Setup Link របស់ ZoeAdmin មិនដែលដំណើរការ** — `checkPinAndOpenConfig()` លុប
>    `pinTargetAction` ដែល `applySetupLinkFromUrl()` ទើបកំណត់។
> ៣. **ZoeKeyGen បណ្តេញអ្នកប្រើខ្លួនឯងពេល zoom / window តូច** (`about:blank` គ្មានសារ)។
> ៤. **ZXing មិន load ➜ ZoeAdmin កាមេរ៉ាបើក តែស្កេនមិនចូល** ដោយស្ងាត់។
> ៥. **`addOrUpdateEntry` ជា read-modify-write** ➜ ZoeAdmin ២ ឧបករណ៍ស្កេនព្រមគ្នា ➜ barcode
>    មួយបាត់ ខណៈលុយរាប់ទាំងពីរ។ ឥឡូវជា `runTransaction`។
>
> ### កំហុសដែលកែក្នុងជុំ ១១ (កុំ audit ឡើងវិញដោយងងឹតងងុល)
> ១. **`barcodes` មក ៣ រូបរាងពី Firebase** — `[A,null,B]` ធ្វើឲ្យ throw ក្នុង `onValue` callback
>    ➜ តារាងឈប់ update; `{0:A,2:B}` ធ្វើឲ្យបាត់ barcode ➜ Zoescan កំណត់ locker មិនបាន។
>    កែដោយ `barcodeEntriesOf()` (byte-identical ៣ App)។ **Zoescan រក្សា index ជាលេខដើម**
>    ព្រោះ `assignLockerToEntry` សរសេរទៅ `barcodes/{idx}`។
> ២. **Setup Link ដែលបើកចោល រស់រានក្រោយចាកចេញ** ➜ បំពេញ config អាជីវកម្មផ្សេង។
> ៣. **timer ទាញតារាងអតិថិជន គ្មាន auth guard** (ZoeAdmin)។
> ៤. **`localStorage.setItem` ក្នុង `onValue` callback** អាចសម្លាប់ callback។
> ៥. **`env()` គ្មាន fallback** លើ `.app-navbar` និង `.ptr-indicator`។
> ៦. **ការអូសឡើងលើបំបាត់ប្រអប់ស្វែងរកលេខ** (រាយការណ៍ដោយវីដេអូ)។
> ៧. **`item.count` ទល់នឹង `barcodes.length`** + **`Code.gs` fail-open**។
>
> ### មុខងារដែលបន្ថែមក្រោយជុំ ១១ (PR #38)
> **ចុចប្រអប់ស្វែងរកលេខ ➜ កាត sidebar ទាំងអស់បិទ លើកលែងកាតស្វែងរក** ➜ តារាងប្រវត្តិឡើងពី
> ~០ ជួរ ទៅ ៥ ជួរ។ **កុំច្រឡំវាជា `.collapsed`** — `.collapsed` បិទ sidebar ទាំងមូល រួមទាំង
> ប្រអប់ស្វែងរក ដែលជាកំហុសក្នុងវីដេអូជុំ ១១។ លម្អិតនៅ section ចុងក្រោយនៃឯកសារនេះ។


4 independent PWAs (vanilla JS, no framework, no build step), each deployed as its own
Netlify site, sharing ONE Sentry project distinguished by the `app` tag:

- **ZoeAdmin** (`app: zoeadmin`) — full admin: add/edit/delete parcels, stats, PDF/Excel export
- **ZoeW** (`app: zoew`) — worker: scan, close/open bills, edit phone, view stats. Cannot add new parcels.
- **Zoescan** (`app: zoescan`) — scanner only: assigns barcodes to lockers. Cannot add/delete parcels.
- **ZoeKeyGen** (`app: zoekeygen`) — standalone activation-key generator/admin tool for the
  other 3 apps. Uses a completely separate Firebase project from the other 3 (business data).

ZoeAdmin/ZoeW/Zoescan share a single Firebase Realtime Database (business data) but each
app's `app.js` is a **separate file with independently duplicated logic** — a fix in one
app's function does not automatically apply to the same-named function in another app.
Always check whether a bug/fix applies to just one app or needs mirroring across siblings.

## របៀបធ្វើ audit លើគម្រោងនេះ (runbook — session ថ្មីអានត្រង់នេះ)

### ជំហានទី ០ — រៀបចំ (ម្តងក្នុងមួយ session)
```bash
npm i acorn                      # ឧបករណ៍ ៥ ត្រូវការវា; បើអត់ វារំលង ហើយប្រាប់អ្នក
bash audit-tools/run-all.sh      # រត់ការត្រួតពិនិត្យទាំងអស់ក្នុងពាក្យបញ្ជាតែមួយ
```
`run-all.sh` រត់ **ការត្រួតពិនិត្យ ២៩** (តេស្តឥរិយាបថ + checker រចនាសម្ព័ន្ធ + ទម្លាប់គម្រោង,
សរុប 547 assertion)។ **រត់វាមុនចាប់ផ្តើម និងក្រោយកែរាល់ដង។** បើវាបៃតងទាំងអស់ នោះមានន័យថា
កំហុសដែលរកឃើញក្នុងជុំ ១-១២ មិនបានត្រឡប់មកវិញទេ។
ការត្រួតពិនិត្យ ២ ប្រើ **Chromium ពិត** (`boot-runtime`, `setup-link`) — ត្រូវការ
`npm i playwright-core`; បើគ្មាន វា **SKIP ដោយស្អាត** មិនធ្លាក់ទេ។

### ជំហានទី ១ — កុំចាប់ផ្តើមដោយអានកូដពីដើមដល់ចប់
ជុំ ៦ ដល់ ១១ បង្ហាញច្បាស់៖ **កំហុសថ្មីស្ទើរតែមិនដែលរកឃើញដោយការអានកូដដដែលឡើងវិញទេ។** វារកឃើញដោយ៖
- **ឧបករណ៍ថ្នាក់ថ្មី** — ជុំ ១១ រកបាន ៥ ក្នុង ៧ ដោយឧបករណ៍ដែលទើបសរសេរនៅជុំនោះឯង
- **កូដដែលទើប ship** — ជុំ ៩ និង ១០ រកកំហុសក្នុងកូដដែលសរសេរនៅ session ដដែល។
  **រត់ `git log --oneline <ចំណុចចុងក្រោយក្នុង CLAUDE.md>..HEAD` ជានិច្ច** ដើម្បីរក commit
  ដែលមិនទាន់មានឯកសារ — នោះជាកូដដែលត្រួតពិនិត្យតិចជាងគេ
- **របាយការណ៍ពិតពីអ្នកប្រើ** (Sentry, វីដេអូ) — មានតម្លៃជាងការស្មានច្រើន

### ជំហានទី ២ — ថ្នាក់កំហុសដែលមានឧបករណ៍រួចហើយ (កុំរកដោយភ្នែក)
| ថ្នាក់ | ឧបករណ៍ |
|---|---|
| ZoeAdmin↔ZoeW បែកគ្នា | `extract.js /tmp/fns` — **រត់នេះមុនគេ ហើយម្តងទៀតក្រោយកែ** |
| helper ចែករំលែក ៣-៤ App បែកគ្នា | `shared-fns.js` |
| HTML↔JS មិនត្រូវគ្នា (id, `on*=`, `data-close`) | `wiring.js` |
| ទិន្នន័យអតិថិជនសល់ក្នុង DOM ក្រោយចាកចេញ | `dom-hygiene.js` |
| អថេរ state សល់ក្រោយចាកចេញ | `state-hygiene.js` |
| class គ្មានច្បាប់ CSS | `css-classes.js` |
| comment / trailing whitespace | `comments.js` |
| payload ដែលសរសេរទៅ Firebase ↔ schema ក្នុង rules | `payload-schema.js` |
| កំហុស runtime ពេល boot (App ពិតក្នុង Chromium) | `boot-runtime.js` |
| ផ្លូវ provisioning ពេញលេញ (`?setup=` ➜ PIN ➜ Config) | `setup-link-browser-test.js` |

ឧបករណ៍ខ្លះមាន allowlist (`ACCEPTED` / `EXPECTED_DIVERGENT` / `IGNORE`) ដែល **រាល់ធាតុមានហេតុផល
សរសេរជាប់**។ **កុំបន្ថែមធាតុដោយគ្មានការតាមដានពិត** — ធាតុគ្មានហេតុផលនឹងលាក់កំហុសបន្ទាប់។

### ជំហានទី ៣ — ថ្នាក់ដែល **មិនទាន់** មានឧបករណ៍ (ឆាកសម្រាប់ជុំក្រោយ)
ទាំងនេះជាកន្លែងដែលកំហុសនៅសល់។ ការសាងឧបករណ៍ថ្មីមួយសម្រាប់ថ្នាក់មួយ = ការវិនិយោគល្អជាងគេ៖
- **រូបរាងទិន្នន័យផ្សេងទៀតដែល RTDB អាចត្រឡប់មក** — ជុំ ១១ និង ១២ គ្របតែ `barcodes`
  (ជុំ ១២ គ្របផ្លូវអានទាំង ៦ មិនត្រឹមតែ normalizer)។ វាលផ្សេងទៀតមិនទាន់ពិនិត្យទេ
- **ការប្រណាំងរវាងឧបករណ៍ច្រើន** — ជុំ ១២ កែមួយក្នុង `addOrUpdateEntry` ហើយបន្សល់ទុក
  `concurrent-scan-test.js` ជាលំនាំ៖ Firebase ក្លែងក្លាយដែលមាន retry-on-conflict ពិត
  ➜ **អាចធ្វើតេស្តបានដោយគ្មាន emulator**។ ផ្លូវសរសេរផ្សេងទៀតមិនទាន់គ្របទេ
- **អន្តរកម្ម UI ជម្រៅ ក្នុង browser ពិត** — ជុំ ១២ បើកឆាកនេះ (`boot-runtime.js`,
  `setup-link-browser-test.js`) ហើយវារកឃើញ ៣ ក្នុង ៤។ **នៅមានច្រើនទៀតដែលអាចធ្វើតេស្តបាន៖**
  ការស្កេន, ការបិទកញ្ចប់, ការស្វែងរក — ត្រូវការ Firebase ក្លែងក្លាយ
- **ការប្រើអង្គចងចាំ / ដំណើរការ** ពេល `scanHistory` ធំ
- **CSS ដែលបំបែកលើអេក្រង់តូច** (ជុំ ៩ និង ១១ រកឃើញ ២ — ប្រហែលមានទៀត)

### ជំហានទី ៤ — ច្បាប់សម្រាប់តេស្តគ្រប់ពេល
**តេស្តត្រូវតែដកកូដ *ពិត* ចេញពី `app.js` មករត់ក្នុង `vm` — កុំសរសេរតេស្តលើកូដចម្លង។**
ហើយ **ត្រូវបញ្ជាក់ថាតេស្តមិនទទេ**៖
```bash
git fetch origin main                      # សំខាន់ — origin/main ក្នុង session អាចចាស់
rm -rf /tmp/baseline && mkdir /tmp/baseline
git archive origin/main | tar -x -C /tmp/baseline
bash audit-tools/run-all.sh /tmp/baseline  # ចំណុចដែល *គួរតែធ្លាក់* នឹងបង្ហាញ
```
បើតេស្តថ្មីជោគជ័យលើ tree មុនកែ នោះវាមិនចាប់អ្វីទេ — សរសេរវាឡើងវិញ។
*អន្ទាក់៖ ត្រូវ `git archive origin/main` មិនមែន `HEAD` ទេ បើបាន commit ការកែរួចហើយ។*

### ជំហានទី ៥ — មុន commit
```bash
node --check <ឯកសារ .js ដែលកែ>
bash audit-tools/run-all.sh
node audit-tools/extract.js /tmp/fns   # តើខ្ញុំបានបង្កើតការបែកគ្នាថ្មីទេ?
```
រួច **bump `CACHE_VERSION`** ក្នុង `sw.js` នៃ App ណាដែល `app.js`/`index.html`/`style.css` ប្រែ។
លំនាំ `<app>-vN`; filter សម្អាត cache ត្រូវតែនៅតែស្កេនតែ prefix របស់ខ្លួន។

### Firebase RTDB emulator (សម្រាប់ការកែ rules តែប៉ុណ្ណោះ)
```bash
npm i firebase-tools
npx firebase setup:emulators:database     # ចាំបាច់ — ថត cache ទទេក្រោយ npm i
java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
cp firebase-database.rules.json audit-tools/emu/real.rules.json
bash audit-tools/emu/real.sh
```
**អន្ទាក់ដែលចំណាយពេលច្រើនម្តងហើយម្តងទៀត៖**
- `emulators:start` របស់ CLI **upload rules មិនបាន** តាម proxy — រត់ jar ដោយផ្ទាល់
- ទាំង `.settings/rules.json` និង `auth_variable_override` ត្រូវការ
  `-H "Authorization: Bearer owner"` បើអត់ **rules នៅបើកចំហ ហើយតេស្តជោគជ័យក្លែងក្លាយ**
- សំណើដែលមាន `Bearer owner` **តែគ្មាន** `auth_variable_override` = ម្ចាស់ project ➜ **រំលង rules**។
  សម្រាប់តេស្ត "unauthenticated ត្រូវបានបដិសេធ" **កុំផ្ញើ Authorization header សោះ**
- `pkill -f firebase-database-emulator` ត្រូវនឹង command line របស់ shell ខ្លួនឯង ➜ សម្លាប់ session
- **ត្រូវ assert ថាការសរសេរដែលដឹងថាខុស ពិតជាត្រូវបានបដិសេធ** មុននឹងទុកចិត្តលទ្ធផលណាមួយ


## Project status (verify before assuming this is still current)

**UPDATE 2026-08-19: this project is now LIVE — real customers are actively using it.** The
user confirmed this explicitly while reviewing PR #5 (`claude/deep-audit-final-8lur4w`) and
asked to merge that PR themselves rather than have it merged automatically, specifically
because of the risk of disrupting live customer usage. **The pre-launch "safe to auto-fix
non-trivial revenue/data-integrity bugs directly" exception described below no longer
applies as of this update** — treat this system as carrying real money and real customer
data from now on. Revenue/data-integrity fixes should go back to being proposed for human
review rather than auto-applied (see point 5 under "When triaging a Sentry report" below,
without the pre-launch exception). Do not merge PRs into `main` unless explicitly asked to —
the user wants to control exactly when changes reach production.

(Historical note, no longer operative: as of 2026-08-18 this project was believed not yet
deployed for real users, which was the basis for a looser default of fixing some
revenue/data-integrity bugs directly rather than only proposing them. That exception is
superseded by the update above. This never extended to the core Delete-vs-Remove business
logic itself in any case — that's deliberate policy, not a bug, regardless of launch status.)

## Core business rule: "លុប" (Delete) vs "ដក" (Remove) — READ BEFORE TOUCHING REVENUE CODE

This is a deliberate business rule, not a bug, and gets misdiagnosed as one easily:

- **លុប / Delete** = deleting an entire parcel (all its barcodes). Must **never** affect
  `zoew_daily_revenue_cod_dod` / `zoew_monthly_revenue_cod_dod` stats, in any direction,
  ever — not on delete, not on restore-from-trash, not on repeated delete/restore cycles.
  Idempotent by design.
- **ដក / Remove** = removing a single barcode from a parcel that has multiple barcodes
  (or the automatic 8-day stale-open-item cleanup). This **does** subtract that barcode's
  cod/dod value from revenue stats at the moment of removal, and **must** add it back on
  restore-from-trash, and subtract it again if removed again. Tracked via a per-barcode
  `isDeducted: true/false` flag that must flip correctly at each step.

If revenue numbers behave unexpectedly, first determine which of these two flows is
involved (check for the `isFromDeletion` flag and whether the trash item has 1 barcode vs
the full original set) before proposing a fix.

All timestamps that feed retention/revenue decisions (`createdAt`, `closedAt`, `deletedAt`,
`lockerUpdatedAt`, and the "now" used to compare against them) are computed via
`getServerNow()` in each app (`Date.now() + serverTimeOffsetMs`, where the offset is kept
live from Firebase's `.info/serverTimeOffset`), not raw `Date.now()` — a wrong device clock
must not be able to skew the 2h/8d/10d windows or misdate revenue. Purely local/cosmetic
timers (PIN lockout, ID generation salt, scan-debounce, "recent" UI badges, script-load
retry deadlines) intentionally still use raw `Date.now()` — don't "fix" those too, they
don't need server sync and `getServerNow()` isn't even in scope at the point some of them
run (e.g. before Firebase has initialized).

`license-verify.js` (shared, byte-identical across all 4 apps) has its **own separate**
`getServerNow()`/`serverTimeOffsetMs` — it cannot use each app's SDK-based
`.info/serverTimeOffset` listener because it's REST-only (plain `fetch`, no Firebase SDK
access, by design — it's the shared module ZoeAdmin/ZoeW/Zoescan/ZoeKeyGen all load
identically). Instead it reads the standard HTTP `Date` response header on every request it
already makes (`checkOnline()`), and exposes `syncServerTime()` (a lightweight fetch whose
only purpose is capturing that header) for callers that don't naturally trigger a request
early — ZoeKeyGen calls it at startup so key `issuedAt`/`expiresAt` (the values baked into
the cryptographically signed key payload itself, via `signNewKey()`) aren't wrong from
the admin's own device clock, which can never be corrected after the fact once signed.
ZoeAdmin/ZoeW/Zoescan also call it at startup for a warm cache, though their own
`ensureAppActivated()` → `getStatus()` → `checkOnline()` flow would self-correct it anyway
on first use. If you touch `license-verify.js`, copy the change identically to all 4
apps' copies (`cp` + `md5sum` to confirm byte-identical) — don't hand-edit each one.

**Lesson from auditing this**: grepping only `Date.now()` missed real spots — also check
`new Date()` (no args, same meaning). Missed on the first pass: `getFormattedDate(d = new
Date())`'s default parameter (used implicitly as "today" by callers throughout both apps)
and `addOrUpdateEntry()`'s `const now = new Date()` (ZoeAdmin — sets the scanDate a new
parcel's revenue gets bucketed under). Only caught via a second, wider-search pass after
being asked to re-check. When auditing this class of bug again, also grep the *shared*
`license-verify.js` and `ZoeKeyGen/app.js`, not just the 3 business apps — easy to forget
since ZoeKeyGen doesn't participate in the retention/revenue system, but it still
independently writes clock-dependent timestamps (key issuedAt/expiresAt).

Retention/auto-cleanup windows (do not change without being asked): closed parcels
auto-move to trash after 2 hours; still-open parcels after 8 days; anything in trash is
permanently purged after 10 days.

When auditing for raw device-time usage, grep for **both** `Date.now()` and `new Date()`
(no arguments) — they mean the same "current device time" but a search for only the first
form misses real ones. This bit us once: `getFormattedDate(d = new Date())`'s default
parameter (used implicitly as "today" by callers all over both apps) and
`addOrUpdateEntry()`'s `const now = new Date()` (ZoeAdmin — sets the scanDate a new parcel's
revenue gets bucketed under) were both missed on the first pass and only caught by asking
"check again, in case something wasn't fixed" and re-auditing with the wider search.

## Persistent daily pickup-count stat (implemented 2026-08-18)

The "អតិថិជនយក" (Customers Picked Up) stat card (`index.html` id `todayClosedCount`) used
to be a live count derived from `scanHistory` (`filteredList.filter(isClosed).length`), so
it silently *decreased* as closed items aged past the 2-hour auto-cleanup and moved to
trash. Fixed the same way revenue already solves this structural gap: a Firebase-persisted
per-day node, `zoew_daily_pickup_cod_dod/{date}`, written via
`addPickupToDailyRecord()`/`commitDailyPickupDelta()` (mirrors
`addRevenueToDailyAndMonthlyRecord()`/`commitDailyRevenueDelta()`'s `runTransaction` +
clamp-to-0 pattern; no monthly bucket, only the daily stat card needed this). A second
line, `todayPackagesPickedUpCount`, sits under the customer count in the same stat card in
both `ZoeAdmin/index.html` and `ZoeW/index.html`.

**Two different identities, tracked two different ways** (per user's explicit correction on
2026-08-18 — the first version incorrectly tied both to whole-order completion):
- **Customer** = unique **phone number** for the day, not "1 per closed order." Node shape:
  `pickedUpPhones: { [phoneKey]: refCount }`, where `refCount` is how many *currently-closed*
  orders reference that phone today; the displayed count is `Object.keys(pickedUpPhones)
  .length` (`countPickedUpCustomers()`), never a stored scalar, so multiple orders under the
  same phone closing/reopening independently can never double-count or prematurely zero out
  — the phone only drops out once its last closed order is reopened. Items with no phone
  logged (`phone === "គ្មានលេខ"`) each count as their own separate customer (confirmed with
  user) via a per-item fallback key (`getPickupPhoneKey()`: `'__item_' + id`) rather than
  collapsing onto one shared bucket.
- **Package** = each individual **barcode**, counted the instant *that barcode* transitions
  open→closed, independent of whether the rest of its order is done — not batched with the
  order's other barcodes. So if a customer picks up 1 of their 2 packages, that 1 is counted
  immediately even though the order (and therefore the customer) isn't "done" yet.

Increment/decrement hooks live in `toggleCloseStatus(id)` and
`toggleIndividualBarcodeClose(itemId, barcodeCode)` in **both** `ZoeAdmin/app.js` and
`ZoeW/app.js`. `toggleIndividualBarcodeClose` always applies exactly ±1 package (this
barcode's own transition, unconditional since `desiredClosed` is always the toggle's
opposite) and only a customer ref-delta when the whole order's `isClosed` crosses the
fully-closed boundary. `toggleCloseStatus` (whole-order close/reopen) diffs each barcode's
*previous* state against the new one and only counts barcodes that actually transition —
this matters because it can be invoked on an order where some barcodes were already closed
individually, and double-counting those would be wrong. Both revert the exact applied delta
in the existing revert-on-Firebase-failure catch block. `claimAndCleanupItem()`'s automatic
2h/8d sweep was deliberately left untouched — it never calls the toggle functions, so it
can't move this counter, same as revenue's `'close'` reason already didn't. Explicitly
re-opening a closed item **does** decrement (confirmed with user, symmetric with revenue's
"explicit corrections adjust, automatic cleanup never does" precedent). Deleting (លុប) or
restoring a closed item does not touch this counter either, for the same reason it doesn't
touch revenue — delete/restore never calls the toggle functions.

**Known, intentionally-uncounted edge case (confirmed with user 2026-08-18):** if the *last*
open barcode in a multi-barcode order goes stale and gets auto-abandoned after 8 days
(`claimAndCleanupItem(id, 'abandon')`), the remainder's `isClosed` flips to `true` as a side
effect of that transaction — but since this flip never passes through the toggle functions,
none of the already-closed barcodes in that order retroactively add to the customer count
if they hadn't already (they may well have already counted their own package delta
individually, per the per-barcode rule above — only the *customer* half of this specific
transition is what's skipped). Confirmed intentional: an uncollected barcode in this
scenario gets physically returned to the central branch, so its abandonment isn't a pickup
event and correctly follows "automatic cleanup never touches this stat."

**Known unfixed edge case (not raised by user, noted for awareness):** the customer ref-delta
on reopen re-derives the phone key from the item's *current* `phone` field
(`getPickupPhoneKey(freshItem)`). If a phone number is edited (`saveEditedPhone()`) between
an order being closed and later reopened, the reopen's decrement lands on the *new* phone's
bucket, not the one actually incremented at close time — leaving a stale +1 on the old phone
and an erroneous (harmlessly clamped) decrement on the new one. Narrow, rare sequence; not
fixed since it wasn't asked for and correctly fixing it means snapshotting the phoneKey used
at close time onto the item itself, a bigger change than today's scope.

**Firebase rules gotcha hit while building this:** the root rules doc is default-deny
(`.read: false, .write: false`), and `firebase-database.rules.json` in this repo is **not
deployed automatically** — Netlify only serves the static app files; the rules JSON must be
manually pasted into Firebase Console → Realtime Database → Rules → Publish. Shipping the
`zoew_daily_pickup_cod_dod` client code without a matching rule block caused every
read/write to fail with `permission_denied` in production (confirmed via a live Sentry
breadcrumb) until the rule was added and manually published. When adding any new Firebase
path, add its rule in the same change and flag to the user that it needs manual publishing
— don't assume the schema-code and the rules are deployed together.

## Error patterns that are EXPECTED / already handled — do not "fix" these

- `Role check timed out`, `Activation timed out`, or any `"<X> timed out"` message —
  deliberate `withTimeout()` guards (15-20s) around Firebase reads. Already caught with a
  user-facing toast and a safe fallback (sign-out / retry prompt). Firing under a slow
  connection is expected, not a crash. Each `withTimeout()` constructs its Error
  synchronously at the call site (not inside the timeout callback) specifically so the
  stack trace shows the real caller — don't "simplify" that back, it was a real bug.
- `permission_denied` during `repoRerunTransactionQueue` / on reconnect — a queued offline
  transaction being replayed after the auth session or rules state changed. Already caught
  with a `.catch()` + toast.
- `"Daily/Monthly revenue underflow clamped to 0"` — a deliberate diagnostic capture (not a
  crash) that fires when a transaction would compute a negative value; the safety net
  working as designed. If it fires *repeatedly* for the same date/month, that's a real
  signal of a double-subtraction bug upstream (see Delete vs Remove above) — but the
  capture itself is not the bug.

## Known past bug classes (already fixed — watch for reintroductions or similar patterns)

- **Firebase ref used before init**: `initDatabaseListeners()` in each app must guard every
  `onValue(dbRefX, ...)` call with `if (dbRefX)`. A re-init cycle (Firebase config re-saved)
  tears down and recreates the app/db without nulling the old ref variables, so an unguarded
  call can hit a stale/deleted ref (`TypeError: Cannot read properties of undefined
  (reading '_repo')`).
- **Whole-list diff-and-save racing a live listener**: never resync a Firebase node by
  diffing a full in-memory array against `lastSyncedKeys` and writing the whole object back
  — a live `onValue` listener on that same path can refresh the in-memory array mid-flight
  and silently undo the diff. Use a targeted single-key write (`update(ref, {[id]: value})`
  or `{[id]: null}` to delete) instead.
- **jsPDF cannot shape Khmer script**: it maps codepoints to glyphs via the font's cmap with
  no OpenType shaping, so coeng-stacked subscript consonants and pre-base vowels render
  broken regardless of font. PDF export now uses browser print-to-PDF (render HTML into a
  hidden print-only container, call `window.print()`) instead — the browser's own text
  engine handles Khmer correctly. Don't reintroduce jsPDF for Khmer text.
- **Mobile `onclick=` attributes can silently fail to fire** on some WebView/Chrome builds —
  confirmed via a real-device screen recording (native tap ripple appeared, handler never
  ran). Activation-key submit buttons now also bind via `addEventListener('click', ...)` as
  a backup alongside the inline `onclick=`.
- **Zoescan's CSP `script-src` lacks `'unsafe-inline'`**, unlike the other 3 apps — any bare
  `onclick=` attribute added to Zoescan's HTML is silently dead on some browsers. Always pair
  a new Zoescan `onclick=` with an `addEventListener('click', ...)` backup (already done for
  the activation-modal buttons). Re-check this asymmetry specifically before adding any new
  inline handler to Zoescan — it's a structural difference from the other 3 apps' CSP, not a
  one-off fix, so it will keep being relevant.
- **Firebase multi-step writes aren't atomic — compensate, don't assume**: RTDB's
  `runTransaction` (needed for cross-device conflict safety) and multi-path `update()` can't
  be combined into one atomic operation. Established pattern: apply local/optimistic state
  first, fire the Firebase write, and on failure reverse the exact applied delta in the
  `.catch()` (revenue via `addRevenueToDailyAndMonthlyRecord` with negated values, pickup-stat
  via `addPickupToDailyRecord` with negated deltas). `retryAsync(fn, attempts, delayMs)` (near
  `withTimeout`) adds retry-with-backoff before giving up — used for `claimAndCleanupItem`'s
  trash write (4 attempts, ZoeAdmin+ZoeW) and ZoeKeyGen's `appPaths` corrective tag write (3
  attempts). When a compensable write can leave local-only state behind if retries are
  exhausted (e.g. an optimistically `unshift`-ed trash item with no matching Firebase write),
  the exhausted-retry `.catch` must also undo *that* local mutation, not just reverse the
  revenue/stat delta — missed on `claimAndCleanupItem` in both ZoeAdmin and ZoeW until a
  2026-08-18 follow-up audit caught it (the parcel record briefly existed only in memory,
  then vanished silently on next resync, even though revenue was correctly reversed).
- **Restore-from-trash must be one atomic multi-path write**: `executeRestoreItem`'s
  history-write + trash-delete uses one `fb.update(fb.ref(db), {two top-level paths})` call
  rather than two separate writes/`Promise.all` — avoids double-applying the revenue add-back
  if the first write succeeds and a second, separate write fails on retry.
- **`isClosed` must be recomputed after any `barcodes[]` mutation, not just at
  create/toggle-time**: any code path that adds/removes barcodes from an item's `barcodes[]`
  array (not just the explicit toggle functions) must recompute `item.isClosed =
  barcodes.length > 0 && barcodes.every(b => b.isClosed)` and set/clear `closedAt` to match.
  `executeRestoreItem`'s restore-merge already did this; `removeSingleBarcode` (ZoeAdmin) did
  not, until a 2026-08-18 follow-up audit found it — an item could get stuck permanently
  misclassified as "open" if its last remaining barcode(s) happened to already be
  individually closed, breaking the 2h/8d retention classification and silently skipping
  pickup-stat credit. If you add a new `barcodes[]` mutation path, recompute `isClosed`
  there too — but do NOT pair it with a pickup-stat credit call
  (`addPickupToDailyRecord`), since that crediting is deliberately scoped only to the
  explicit toggle functions (`toggleCloseStatus`/`toggleIndividualBarcodeClose`), matching
  how the restore-merge path already doesn't credit it either.
- **ZoeKeyGen ALL-scope key generation is not all-or-nothing**: `generateLicenseKey()`
  writes the key to 3 separate Firebase paths (one per target app) in parallel; if some
  succeed and some fail, a corrective follow-up write tags the surviving records with
  `appPaths` so the key list can show accurate per-app coverage. That corrective write now
  retries (`retryAsync`, 3 attempts) and captures to Sentry + warns the operator if it still
  fails — it used to be a silent one-shot `.catch(() => {})`. Left unfixed, a failed tag
  write let `renderKeyList()` wrongly assume full 3-app coverage (its
  `scope === 'ALL' ? [3 apps] : [scope]` fallback only trusts a partial-coverage signal when
  `appPaths` was actually recorded) and let `toggleRevokeKey`/`confirmExtendKey` write to
  paths that never had a real key record — Firebase RTDB `update()` on a nonexistent path
  silently creates a sparse node there instead of erroring. `renderKeyList()` now also shows
  a persistent ⚠️ badge (with a tooltip listing which apps are actually covered) whenever
  `appPaths` is present and shorter than 3, so partial coverage stays visible after a reload,
  not just in the one-time generation-time alert.

## Style conventions

- JS source in `app.js`/`license-verify.js` is kept **comment-free** by deliberate
  convention (see commit `a6aa840`). If you add explanatory comments while working, strip
  them before finishing — parse with `acorn`, remove exact comment byte ranges, then
  re-tokenize and diff token-for-token against the original to confirm the code itself is
  unchanged before committing.
- `license-verify.js` is byte-identical across all 4 apps by design (embeds the shared
  public key + verification logic). Keep it that way if you touch it in one app.
- Every service worker's `CACHE_VERSION` follows `<app>-vN` and its cache-cleanup filter
  only ever deletes keys starting with its own `<app>-` prefix — never broaden that filter,
  it's what keeps one app's service worker from wiping another app's cache if they ever end
  up sharing an origin.

## When triaging a Sentry report

1. Check the `app` tag first — confirms which of the 4 apps/files to look in.
2. Read breadcrumbs for the real user action sequence, not just the final error.
3. If it touches revenue (`addRevenueToDailyAndMonthlyRecord`, `isDeducted`,
   `commitDailyRevenueDelta`, `commitMonthlyRevenueDelta`), re-read Delete vs Remove above
   before proposing a change.
4. If a near-identical function exists in a sibling app (ZoeAdmin/ZoeW especially), check
   whether that sibling already solved the same problem correctly — copy its pattern rather
   than inventing a new one. There's also an old reference copy of ZoeAdmin/ZoeW the user can
   provide on request, from before recent changes, useful for confirming intended behavior.
5. This system tracks real money (COD/DOD revenue) — prefer a suggested fix for human
   review over auto-applying anything non-trivial (see "Project status" above for the
   current pre-launch exception to this default, and re-verify it still applies).

## Final deep-audit pass (2026-08-19, branch `claude/deep-audit-final-8lur4w`) — handoff notes

Requested as a last audit round before full deployment. Ran 5 parallel research agents (one per
app plus one cross-cutting infra/rules pass), each instructed to check the known bug classes
above and hunt for new ones, then triaged and fixed the findings directly (pre-launch exception
applies; nothing here touches the Delete-vs-Remove policy itself). **If resuming in a new
session: everything below is already committed on this branch — check `git log` on it before
redoing anything.**

### Fixed
- **ZoeAdmin `clearHistory()` ("Delete All") had zero snapshot/revert** — could permanently wipe
  the whole dataset with no trash backup if the trash-save write failed after the history-clear
  write succeeded (highest blast-radius finding of the audit). Now snapshots both arrays and does
  one atomic multi-path `fb.update(fb.ref(db), {...})`, reverting on failure. Same atomic-write
  pattern also applied to `removeSingleBarcode` and `deleteSingleItem` (previously two independent
  `Promise.all`-raced writes that could partially fail while the UI claimed a full revert).
  `removeSingleBarcode` also now re-fetches the item/barcode index fresh after the blocking
  `confirm()` dialog (mirrors `toggleCloseStatus`'s existing pattern). Dead helper functions
  (`deleteSingleHistoryItemFromFirebase`, `saveMultipleDeletedItemsToFirebase`) removed since the
  refactor made them unused.
- **Zoescan `assignLockerToEntry()` read the live global `activeLocker` instead of a value
  snapshotted at call time** — across two `await`s (up to 12s each), a worker switching lockers
  mid-write could get the wrong locker recorded, and the primary write vs. the
  `zoew_scan_history_cod_dod` mirror write could each land a *different* locker value for the same
  barcode. Fixed by capturing `const targetLocker = activeLocker` once up front. Mirror-update
  failure now also retries via a newly-added `retryAsync` (matching the pattern used elsewhere in
  the codebase) instead of failing after one attempt.
- **Zoescan locker occupancy warning added** (per explicit user request during this session) —
  scanning a barcode into a locker that already holds a different *open* barcode now warns
  symmetrically to the existing "barcode already has a different locker" warning, via the same
  `locationWarningModal`/`pendingLocationCode` confirm flow. Closed/picked-up occupants don't
  trigger it (`isEntryBarcodeClosed` check) since they no longer physically occupy the locker.
- **ZoeKeyGen `firebase-database.rules.json`** (its own, separate-project rules file) was missing
  an `appPaths` field in the `$keyId` schema; `$other: false` meant the corrective partial-failure
  tagging write in `generateLicenseKey()` — and the ⚠️ partial-coverage badge in `renderKeyList()`
  that depends on it — was **permanently, deterministically rejected**, not just occasionally
  failing. Added an `appPaths` validation block. **Needs manual publish in Firebase Console** (this
  repo's rules JSON is never auto-deployed — see the "Firebase rules gotcha" note above).
- **ZoeKeyGen stored-XSS → signing-key exfiltration path**: `renderKeyList()` built
  `onclick="toggleRevokeKey('${escapeHtml(row.id)}')"` — HTML-entity escaping does not make a
  string safe inside an `on*=` attribute (the browser HTML-decodes before parsing it as JS), so a
  compromised admin-role account (without the separately-held signing private key) could plant a
  crafted Firebase key-id and run JS in another admin's session, reading `signingPrivateKeyJwk`
  out of memory/sessionStorage. Fixed by switching to `data-key-id`/`data-action` attributes plus a
  single delegated `addEventListener('click', ...)` on `#keyListBody`.
- **`license-verify.js` `getStatus()`** computed `now` *before* `checkOnline()` refreshed the
  server-time offset, so the very first status check after a fresh page load could misjudge
  expiry/offline-grace using the raw (uncorrected) device clock. Moved the `getServerNow()` call to
  after `checkOnline()` resolves. Propagated identically to all 4 apps' copies (`cp` + `md5sum`
  confirmed — all four still hash to `04d2db7b8977a12c3ddd76542ddba684`).
- **ZoeKeyGen `loadSigningKey()`** accepted any structurally-valid EC P-256 private key without
  checking it actually pairs with the public key baked into `license-verify.js` — a stale/wrong
  key would show "Loaded ✓" and every key issued with it would silently fail verification
  everywhere. Now calls `window.ZoeLicense.verifyKeyString()` on the smoke-test-signed key and
  rejects the load if it doesn't verify.
- **ZoeAdmin `netlify.toml` CSP `connect-src`** used a bare `https:` scheme-wildcard (any HTTPS
  host reachable) instead of an explicit allowlist like the other 3 apps. Narrowed to the same
  Firebase/Sentry hosts plus `script.google.com`/`*.googleusercontent.com` (needed for the
  Google Sheets/Apps Script lookup feature).
- **Root `firebase-database.rules.json` worker-role hardening (safe subset only — see below)**:
  `zoew_scan_history_cod_dod/$itemId/barcodes/$idx/{cod,dod}` and
  `zoew_recently_deleted_cod_dod/$itemId/{cod,dod}` (top-level and nested `barcodes/$idx/{cod,dod}`)
  were writable by `worker` at any time with zero protection — a worker could inflate/deflate a
  barcode's cod/dod value before triggering a remove/restore to fabricate revenue deltas. Tightened
  to the same "`admin` OR not-yet-existing OR unchanged" pattern already used elsewhere in this
  same rules file for other admin-locked fields (not a new pattern — just extended to two fields
  that had been missed). Verified safe by tracing every legitimate ZoeW write path for these exact
  fields (none exist — ZoeW only ever *sums* per-barcode cod/dod into aggregates, never writes a
  fresh value into an existing barcode's own cod/dod). **Also needs manual publish in Firebase
  Console.**
- Small: ZoeAdmin/ZoeKeyGen README staleness (missing Excel/CSV export + Customer Data Table
  view; misleading "LICENSE_DB_URL is a placeholder" wording when it's actually already filled
  in — see open question below); unhandled-rejection `.catch(() => {})` added to
  `runAutomaticDeletedCleanup`'s purge call.

### Explicitly NOT fixed (deliberate scope decisions, made together with the user this session)
- **Worker role can still write arbitrary absolute values directly to
  `zoew_daily_revenue_cod_dod` / `zoew_monthly_revenue_cod_dod` / `zoew_daily_pickup_cod_dod`**,
  and can still create brand-new `zoew_scan_history_cod_dod`/`zoew_recently_deleted_cod_dod`
  entries. Investigated a full lockdown ("workers can only update, never create") but it would
  break ZoeW's real, reachable "restore from trash" feature (`executeRestoreItem`'s create-new-entry
  branch is the *common* restore case, not an edge case). Deeper still: revenue/pickup nodes are
  updated via client-computed read-modify-write transactions, so no declarative rule can verify a
  delta's *history* is honest — that fundamentally requires a trusted server (Cloud Functions),
  which this project doesn't have (static Netlify + client-direct Firebase RTDB, no backend). User
  chose "safe subset only" — see fixed items above for what that covered. Revisit if/when a backend
  trust boundary is ever added.
- Firebase RTDB emulator testing was attempted (to verify rules changes empirically rather than by
  hand) but blocked: `firebase-tools` needs `firebase-public.firebaseio.com`, which this session's
  network egress policy rejected with 403. Per that policy's own instructions, did not attempt to
  route around it. **The rules changes above were reasoned through manually and cross-checked
  against every actual write call site in the app code, but were never run against a live
  Firebase project or the Rules Playground — verify there before/after publishing.**
- Minor/low-priority findings noted but not applied (pick up later if useful): ZoeW has a dead
  `saveSingleHistoryItemToFirebase` function (harmless, unused); ZoeKeyGen's `toggleRevokeKey`/
  `confirmExtendKey` trust the client-side path cache without an existence check before writing;
  ZoeKeyGen's signing-key PIN minimum is only 6 characters; Zoescan's "barcode not found" toast can
  theoretically fire in the first instant before the Firebase listener's initial payload arrives.

### Open question for the user
`ZoeKeyGen/license-verify.js`'s `LICENSE_DB_URL` constant (byte-identical across all 4 apps) is
hardcoded to `https://zoew-z1-default-rtdb.firebaseio.com` — but ZoeKeyGen is supposed to use a
**separate** Firebase project (`zoe-license` per the README's setup instructions), not ZoeW's
business database. The hostname strongly resembles "ZoeW," which is suspicious, though if it were
actually wrong, Online Revoke/Extend checks would already be visibly broken for everyone (not a
silent failure) — which argues it's probably fine, just an oddly-named project. **Please confirm
this is genuinely the dedicated `zoe-license` project's URL and not a mixed-up copy of ZoeW's
business DB URL** — README updated to flag this for verification either way.

### Three remaining items closed on request
- **The pickup-stat phone-edit gap** (open since 2026-08-18, listed as "known unfixed edge case" above).
  Editing the phone of an order that is *already closed* now moves its `pickedUpPhones` ref from the old
  key to the new one, so the later reopen's −1 lands on the bucket that was actually incremented. Fixed at
  the moment of the edit rather than by snapshotting the key onto the item, deliberately: the item schema
  in `firebase-database.rules.json` ends with `$other: { ".validate": false }`, so a new field would be
  rejected until the rules were published — a deploy-ordering hazard with two publishes already pending.
  Moving the ref needs no schema change and is equally correct across devices, since the pickup node is
  shared and the move is written immediately. `patchHistoryItemFields` now resolves `true`/`false` instead
  of `undefined` so the caller can undo the move when the write fails; existing callers ignore the value.
- **ZoeW's dead `saveSingleHistoryItemToFirebase`** removed. It is genuinely dead in ZoeW only — ZoeAdmin
  has three live call sites and keeps its copy.
- The `applyCurrentFilter()` conversion described above.

`CACHE_VERSION` bumped (zoeadmin-v33, zoew-v30).

### Not yet done as of this handoff
- Nothing critical is mid-edit. All changes described above are complete, syntax-checked
  (`node --check` on every modified `.js`, JSON-validated on both rules files), and either
  committed or about to be committed in the same push as this note.
- Two rules files changed this session (`firebase-database.rules.json` at repo root, and
  `ZoeKeyGen/firebase-database.rules.json`) both need **manual publishing** in their respective
  Firebase Consoles — this repo's rules JSON is never auto-deployed by Netlify.

## Second deep-audit pass (2026-08-19, branch `claude/deep-audit-cleanup-n4bar6`) — handoff notes

Requested explicitly as a confirmatory **final** round, after PR #6 (`claude/customer-table-timeout-x3sc9v`,
landed on top of the first "final" audit above) showed that round hadn't actually been the last word —
the user asked to re-confirm nothing else was left, plus a repo-wide comment-cleanup check. Ran 5 parallel
research agents again (one per app, plus one cross-cutting infra pass), each re-checking every bug class
listed above for regressions and independently hunting for anything new, with explicit extra scrutiny on
the 5 commits that had landed since the first "final" audit and were never part of a dedicated review
(`d7924f9`..`49137a4`: the customer-table fetch dedup fix, and the two-stage PWA auto-update rewrite that
added then fully removed a forced-reload/write-guard mechanism in favor of "apply on next natural launch").
Agents were research-only (no edits); findings were triaged and safe ones applied directly in this same
session — none of this round touched Delete-vs-Remove, retention-window semantics, or any live revenue math.

**Comment-cleanup check (the second half of this round's request):** re-verified byte-for-byte that every
`app.js`/`license-verify.js` across all 4 apps is still comment-free (grepped `//`/`/*` excluding
string/regex-literal false positives — zero real comments found). Also found and fixed something the prior
round's cleanup missed: **`ZoeKeyGen/app.js` had 7 spots of leftover blank-line cruft** (up to 9 consecutive
blank lines in one place) — dead whitespace left behind where explanatory comments used to sit, from the
`a6aa840`/`bbbff1d` comment-strip passes, never trimmed afterward. Collapsed to single blank lines matching
the rest of the codebase's spacing; confirmed via `git log -p` on each spot that this was leftover cruft,
not intentional spacing, before touching it.

### Fixed (safe, non-revenue, applied directly)
- **ZoeAdmin `customerDataTableFetchPromise` dedup guard had a real gap**: the in-flight-promise guard added
  in `d7924f9` was checked before the promise was assigned, with an `await decryptLookupSecret(...)` in
  between when a header-secret lookup config is used — a second caller landing in that window could still
  start a duplicate fetch, and each duplicate's `finally` nulled the *shared* flag. Fixed by moving the whole
  header-building/decrypt step inside the async IIFE, so the guard assignment is synchronous with no gap.
- **ZoeAdmin auto-focus regression when lookup is enabled but misses**: `triggerScanAction()` only skipped
  the phone-input auto-focus when the lookup API was *disabled* — when it was enabled but a barcode simply
  had no match (cache miss, 404, timeout), the phone field was never focused at all, forcing a manual tap
  every time. Now focuses the phone field once the lookup settles, only if it's still empty and the same
  scan is still pending (guards against stealing focus from an autoSubmit-closed modal or a superseded scan).
- **`withTimeout()`'s timer-leak fix (landed in ZoeAdmin only, in `d7924f9`) mirrored to ZoeW, Zoescan,
  ZoeKeyGen** — each app's independently-duplicated `withTimeout` now also captures and clears its internal
  `setTimeout` once the wrapped promise settles, instead of leaving a dangling timer alive for the rest of
  the timeout window on every call that resolves early.
- **`waitForFirebaseSDK()`'s timeout `Error` now constructed synchronously at the call site in all 4 apps**
  — it was being built inside the `setTimeout` callback in all 4 (ZoeAdmin/ZoeW/ZoeKeyGen shared one shape,
  Zoescan a slightly different one), the exact same stack-trace-losing class of bug `withTimeout()` itself
  was fixed for in commit `4e03a3a` — every "Firebase SDK failed to load" Sentry report was collapsing to
  the same one-line stack with no caller info. This helper was apparently missed when that fix was applied.
- **ZoeW `executeRestoreItem` now preserves `callMark`/`callMarkTime`/`isCalled` on merge-restore**, mirroring
  ZoeAdmin's already-reviewed fix (from the first "final" audit round) that ZoeW's independently-duplicated
  copy of this function never received — confirmed via `git log -S` this logic never existed in ZoeW at any
  point. Without it, a call-mark ("no answer" etc.) silently vanished if the marked order later got merged
  back in from a restore, in ZoeW only.
- **Zoescan `findLockerOccupant()` false-positive-warned on every barcode of a multi-barcode order sharing a
  locker with its own sibling** — it only excluded the scanned barcode's own code, not the item/order it
  belongs to, so scanning the 2nd+ barcode of the same order into the same locker (the exact use case
  `barcodes[]` exists for) triggered the occupancy-warning modal every time. Now also excludes entries
  belonging to the same `itemId`.
- **Zoescan camera didn't auto-resume after backgrounding if a modal was open at the time**: the
  `visibilitychange` handler unconditionally cleared `cameraStoppedByVisibility` on resume, even when a
  modal (e.g. the locker-occupancy warning above) was blocking the immediate resume — once the modal later
  closed, nothing re-armed the camera. Now the flag survives while a modal is open, and `closeModal()`
  resumes the camera once the last modal closes, if it's still pending.
- Small Sentry-observability nits: two Zoescan `ZoeErrors.capture()` calls and one ZoeKeyGen call had empty
  `context: ''` (now `'assignLockerToEntry'`, `'initFirebase bootstrap'`, `'refreshKeyList'`); Zoescan's
  `requestCameraPermission()` catch didn't report unrecognized `getUserMedia` error types at all (only the
  3 known ones got a friendly toast) — now captures those too.
- **ZoeKeyGen**: the freshly-generated private key left in the "Generate New Keypair" modal's textarea
  survived closing the modal via Cancel or backdrop-click (only a subsequent generate/page-reload cleared
  it), contradicting the modal's own "will be lost forever" copy. `closeModal('keypairModal')` now clears
  it; the backdrop-click handler was switched to call `closeModal()` instead of toggling the CSS class
  directly, so both dismiss paths get the same cleanup.
- Doc nits: 3 READMEs (ZoeAdmin/ZoeW/Zoescan) described a forced-reload "update complete" toast that
  commit `96038fa` had already removed — updated to describe the actual apply-on-next-launch behavior.
  Zoescan's recovery toast quoted a ZoeAdmin button label ("Sync Scanner Lookup") that doesn't literally
  exist — corrected to the real label. ZoeKeyGen's README referenced a singular `PUBLIC_KEY_JWK` where the
  actual constant is the array `PUBLIC_KEYS_JWK`.
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v12, zoew-v11, zoescan-v11, zoekeygen-v5) since all 4
  `app.js` got real behavior changes above. **No Firebase rules files were touched this round — nothing
  from this round needs manual publishing.**

### Initially proposed, then explicitly authorized by the user and implemented in the same session
The 6 items below were first written up as proposals (not applied), per this project's live-production
policy of not auto-applying revenue/data-integrity/high-blast-radius changes. The user's response was
"fix all 6, it's fine" — an explicit override for this specific batch — so all 6 were then implemented
directly in this same session. Recording both the original reasoning and what was actually built, since
items 2 and 3 involved real judgment calls worth understanding if something looks off later.

1. **[HIGH, FIXED] `claimAndCleanupItem`'s trash-write could permanently lose a parcel if retries were
   exhausted** (ZoeAdmin + ZoeW, identical gap in both). The Firebase transaction that removes/strips the
   item from `zoew_scan_history_cod_dod` commits *first*; only afterward does it try to save the removed
   data into `zoew_recently_deleted_cod_dod` via `retryAsync` (4 attempts, ~22.5s). If all 4 failed, the
   failure handler already correctly reversed the revenue delta and the optimistic local trash entry, but
   never wrote the removed data back to `zoew_scan_history_cod_dod` — the parcel was gone from both places.
   **Fix**: added `restoreClaimedItemToScanHistory(id, claimedWhole, claimedPartial)` in both apps — on
   exhausted trash-write retries, it runs a *second* `runTransaction` on the original item ref that either
   restores the whole claimed item (merging with whatever's there now, in case of concurrent changes) or
   merges the reclaimed stale-open barcodes back into the current remainder (partial-claim case), stripping
   `isDeducted` off them since they're live again, not in trash. Wrapped in `retryAsync` (3 attempts) too.
   If *that* also fails, there's no further automated recovery — captures to Sentry with full context and
   shows a `showToast` (not a blocking `alert`, since this fires from an unattended background sweep) telling
   staff to check the item manually. Also changed the outer `retryAsync(...).catch()` from fire-and-forget to
   `await`ed, so `cleanupInFlight` now stays held for the whole compensating chain (closes a pre-existing
   window where a second automatic sweep could re-enter the same item mid-recovery).
2. **[MEDIUM-HIGH, FIXED — judgment call] ZoeW reset `createdAt` on restoring a still-open item; ZoeAdmin
   never did.** Reasoned through rather than guessed: both apps already reset `closedAt` on restoring a
   *closed* item, deliberately giving it a fresh window before the 2h auto-cleanup can re-claim it — it would
   be inconsistent for the open-item case not to get the same treatment, and *not* resetting `createdAt` means
   an item restored from the 8-day stale-open ("ដក") trash flow (which by definition already has an
   `createdAt` older than 8 days) would almost immediately get re-flagged as stale and auto-abandoned again on
   the very next cleanup pass — defeating the entire point of a human choosing to restore it. **Fix**: mirrored
   ZoeW's `else { itemToRestore.createdAt = getServerNow(); }` into ZoeAdmin's `executeRestoreItem`, so both
   apps now always give a restored item (open or closed) a fresh retention clock as of restore time. If this
   isn't actually the intended behavior, flag it — it was a reasoned choice, not a certainty.
3. **[MEDIUM, FIXED] ZoeKeyGen's `license_keys` public-read node exposed more than intended** — `note`
   (free-text, README used to suggest employee names/locations) and `createdBy` (issuing admin's email) were
   stored at the same path any of the 3 business apps' end-user devices fetch unauthenticated on every routine
   license check. **Fix**: split the schema. `license_keys/{appCode}/{keyId}` now holds only `{expiresAt,
   revoked}` (all `checkOnline()` ever reads) and stays public-read. A new node, `license_keys_meta/{appCode}
   /{keyId}`, holds `{issuedAt, scope, note, createdBy, appPaths}` and is admin-read/write only. Updated
   `ZoeKeyGen/firebase-database.rules.json` accordingly (**needs manual publish — see below**),
   `generateLicenseKey()` now writes both nodes atomically per target app via one multi-path `fb.update()`
   (so the verification record and its metadata can never split), and `refreshKeyList()` now reads and merges
   both nodes. **Cannot migrate already-existing keys' data from this environment** (no live Firebase access,
   git-only session) — added a one-time "🔒 Migrate PII ចាស់" button in the Key List card
   (`migrateLegacyLicenseKeyMetadata()` in `ZoeKeyGen/app.js`) that the admin runs themselves, once, *after*
   publishing the new rules: it reads every existing `license_keys` record, copies any legacy `note`/
   `createdBy`/`issuedAt`/`scope`/`appPaths` fields into `license_keys_meta`, and nulls them out of the public
   node in one atomic multi-path update. README updated to describe the split and point at the button.
4. **[MEDIUM-HIGH narrow, FIXED — resolved as a side effect of #3] ZoeKeyGen's partial-ALL-coverage badge
   could fail to show in exactly the case it exists for** — `refreshKeyList()`'s old dedup picked whichever
   app-bucket (ADM→ZOW→SCN, fixed order) was iterated first that contained a given key ID, with a
   scope-derived fallback that silently assumed full 3-app coverage whenever `appPaths` was missing. The
   rewrite for #3 (reading `license_keys` per app-bucket to merge with the new meta node) naturally derives
   real coverage from the *true* union of buckets where the key actually, verifiably exists — `paths` is now
   always accurate regardless of whether the `appPaths` corrective tag ever landed. `renderKeyList()`'s badge
   condition was switched from checking `row.appPaths` to checking `row.paths`, so the badge can no longer
   silently fail to show due to a missing tag.
5. **[design decision, FIXED] All 4 apps lost their only "update available" signal when the PWA forced-reload
   mechanism was fully removed in `96038fa`.** **Fix**: added a passive, non-forcing update banner to all 4
   apps (`showUpdateAvailableBanner()`, same shape in each) — a fixed bottom bar with a "Refresh ឥឡូវនេះ"
   button and a dismiss "✕", built via plain DOM APIs with inline styles (no HTML/CSS file changes needed).
   Wired to `navigator.serviceWorker`'s `controllerchange` event, gated on `hadControllerAtLoad` (captured
   once per page load, before the listener attaches) so it only fires for a genuine mid-session update — not
   for the very first `controllerchange` a brand-new install fires when its service worker first takes
   control (there being no "update," just an initial claim, in that case). No auto-reload; the user decides
   when to refresh, same as the "apply on next natural launch" model already in place.
6. **[LOW, FIXED] ZoeKeyGen `generateLicenseKey()`'s 25s timeout didn't cancel the underlying `retryAsync`
   writes** — true cancellation isn't practical (the Firebase JS SDK has no abort support for RTDB writes), so
   the fix instead closes the *silent* half of the problem: the write promise is now captured before racing it
   against the timeout, and if the timeout fires first, a background `.then()` on that same promise is armed
   (via a `generateAlreadyTimedOut` flag) to show a toast and call `refreshKeyList()` if the writes eventually
   land anyway — so an admin who retried after a false "timed out" now finds out if the original attempt also
   succeeded, instead of a silent duplicate key with no explanation.

### Not yet done as of this handoff
All fixes above (both the original 16 and these 6) are committed, `node --check`-clean on every modified
`.js`, JSON-validated on both rules files, and comment-free grep re-verified repo-wide. `CACHE_VERSION` was
bumped a second time in all 4 `sw.js` (zoeadmin-v13, zoew-v12, zoescan-v12, zoekeygen-v6) to cover this
second batch of behavior changes. Nothing is mid-edit.

**RESOLVED 2026-08-19 (confirmed by user):** `ZoeKeyGen/firebase-database.rules.json`'s `license_keys_meta`
node has been manually published in the Firebase Console, and the one-time "🔒 Migrate PII ចាស់" button in
ZoeKeyGen's Key List card has been run successfully — user confirmed both the "✅ បាន Migrate Key ចំនួន X
ដោយជោគជ័យ!" success toast and, directly in the Firebase Console, that migrated `note`/`createdBy`/etc. now
live under `license_keys_meta` rather than the public `license_keys` path. All outstanding items from the
second audit round are now fully closed out. No other rules files changed this round.

## Third deep-audit pass (2026-08-19, branch `claude/deep-audit-final-tkeqbq`) — handoff notes

Requested as another confirmatory round after commit `184157f` ("Harden logout data-clearing across all 4
apps for shared-device use") landed on top of the second audit round without a dedicated review of its own.
Ran 5 parallel research agents again (one per app plus one cross-cutting infra pass), each re-checking every
bug class listed above for regressions and independently hunting for anything new, with explicit extra
scrutiny on `184157f` specifically. Agents were research-only (no edits); findings were triaged and applied
directly in this same session — all of them were completeness gaps in the shared-device logout hardening
itself, none touched Delete-vs-Remove, retention-window semantics, or live revenue math, so none required
the propose-first live-production exception.

### Fixed
- **Zoescan: camera could stay on indefinitely after logout (the most severe finding this round).**
  `forceExpireSession()` (the 4h auto-logout) never called `stopScanner()` — it just signed out — so an
  actively-scanning camera kept running completely unattended after a forced session expiry, decode loop and
  all. Separately, `184157f`'s new bulk modal-close loop in the sign-out branch could re-trigger `closeModal()`'s
  pre-existing "resume camera if the last modal just closed" side effect when a modal happened to be open at
  logout time (e.g. after backgrounding mid-scan with `locationWarningModal` up), turning the camera back on
  right after logging out. Fixed at the source: the sign-out branch of `onAuthStateChanged` now sets
  `cameraStoppedByVisibility = false` and calls `stopScanner()` unconditionally, before the modal bulk-close
  loop runs — covers both the forced-expiry gap and the modal-reopen side effect in one place.
- **ZoeAdmin/ZoeW: modal fields kept sensitive data in the live DOM after logout, only hidden via `display:
  none`.** `openViewListModal`, `openCallMarkModal`, `openEditBarcodePriceModal`, and the edit-phone flow all
  write phone numbers/barcode lists/prices directly into specific elements (`innerText`/`innerHTML`/`value`),
  and `closeModal()` never blanked them — so after logout on a shared device, the previous user's data was
  still readable via DevTools even though nothing was visible on screen. Added `clearSensitiveModalFields()`
  to both apps (called from `showLoginModalWithPrefill()`, so it fires on every sign-out path: explicit
  logout, 4h forced expiry, role-check failure) that blanks every known sensitive field plus the search boxes
  (`searchPhoneInput`, `hwScannerInput`, `customerDataTableSearchInput` in ZoeAdmin) and resets the stale
  `pendingRestoreId`/`pendingPermanentDeleteId`/`activeParentItemId` variables that the generic bulk-close
  loop doesn't reach (those are only nulled by the `data-close`-attributed cancel handlers, not by
  `closeModal()` itself).
- **All 4 apps: the just-typed login password was left sitting in the password input's DOM `value` after a
  login attempt**, retrievable via devtools or a "reveal password" control by whoever uses the device next.
  Now cleared in a `finally` block after every login attempt (success or failure) in ZoeAdmin, ZoeW, Zoescan,
  and ZoeKeyGen alike.
- **ZoeAdmin's customer-table fetch and ZoeKeyGen's key-list fetch could survive logout and silently
  repopulate the "cleared" cache/DOM** — two agents independently flagged the same race shape: `clearCustomer
  DataTableCache()`/`showLoginModalWithPrefill()`'s cache-clear didn't cancel an in-flight fetch, so a slow
  request (up to 15s) that was already running at logout time would resolve afterward and write its result
  back into the in-memory cache and visible table — worse for ZoeAdmin specifically, since it also refreshed
  `customerDataTableFetchedAt`, making the *next* login's fetch think the stale data was still fresh and skip
  re-fetching entirely. Fixed with a session-generation counter in both apps
  (`customerDataTableSessionGeneration` / `keyListSessionGeneration`, incremented on every clear): each fetch
  captures the generation at start and checks it before writing back results, so a stale fetch's response is
  silently discarded instead of clobbering a newer session's state.
- **ZoeKeyGen: duplicate "Signing Key cleared from memory" toast on role-check failure/timeout** (pre-existing,
  not introduced by `184157f`, purely cosmetic) — `verifyAdminRoleThenProceed`'s two failure branches called
  `fb.signOut(auth)` (which itself triggers `onAuthStateChanged(null)` → `showLoginModalWithPrefill()`) and
  then called `showLoginModalWithPrefill()` a second time explicitly right after. Removed the redundant
  explicit calls; the centralized `onAuthStateChanged` handler already covers it, matching the pattern
  ZoeAdmin/ZoeW already use (their equivalent double-call is harmless there since nothing in their version of
  `showLoginModalWithPrefill()` shows a toast, so it was never visibly a bug in those two apps — left as-is).
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v15, zoew-v14, zoescan-v14, zoekeygen-v8). **No Firebase
  rules files were touched this round — nothing from this round needs manual publishing.**

### Explicitly not auto-decided (flagged for the user, not fixed)
- **ZoeKeyGen: an involuntary logout (role-check timeout/failure, session expiry) silently destroys an
  unsaved, not-yet-copied private key with no distinct warning.** `showLoginModalWithPrefill()` force-closes
  every modal including `keypairModal`, whose `closeModal()` special-case wipes the generated-key textarea —
  correct behavior for the deliberate Cancel/backdrop-click case it was built for in the second audit round,
  but it now also fires silently on every *involuntary* auth-null transition, and only the unrelated "Signing
  Key cleared from memory" toast fires, not anything naming the lost key. This is a real security-vs-UX
  trade-off (arguably the right call given how catastrophic a leaked signing key would be) rather than a
  clear-cut bug, so it wasn't decided unilaterally — if a distinct warning or a "copy before this closes"
  confirmation is wanted, that's a product decision for the user to make.

### Not yet done as of this handoff
All fixes above are committed, `node --check`-clean on every modified `.js`, and comment-free grep
re-verified repo-wide. Nothing is mid-edit. No rules-file changes this round, so no manual-publish step is
needed from this round itself.

This round's PR (#9) was merged to `main` at the user's explicit request in this session.

**Second audit round's outstanding items are now fully resolved (confirmed 2026-08-19):** the
`license_keys_meta` rule was published in the Firebase Console, and the user ran "🔒 Migrate PII ចាស់" —
confirmed via the "✅ បាន Migrate Key ចំនួន X ដោយជោគជ័យ!" success toast and by inspecting the raw Firebase
data directly, where migrated `note`/`createdBy`/etc. now correctly live under `license_keys_meta` instead of
the public `license_keys` path. (Along the way, the user initially thought the migration hadn't worked
because the ZoeKeyGen Key List page still displayed note/email normally after clicking — that's expected,
not a bug: `refreshKeyList()` merges `license_keys` + `license_keys_meta` for the admin's own display
regardless of which node the data physically lives in, so the page was never going to visibly change. Worth
remembering if this same confusion comes up again after a future PII-handling change.) Nothing is
outstanding from either the second or third audit round as of this handoff.

## Fourth deep-audit pass (2026-08-19, branch `claude/detailed-audit-d0k07u`) — handoff notes

Requested by the user as one more meticulous, whole-project pass ("audit as thoroughly as possible, in
case anything isn't right — this is the final audit round before going public to 200-300 users") before
public rollout. Branch started exactly at `main` (commit `4a8e04e`), no carry-over from a prior unmerged
branch. Ran 5 parallel research-only agents again (one per app plus one cross-cutting infra/rules pass),
each re-checking every bug class documented above for regressions and independently hunting for anything
new, with explicit extra scrutiny on two ZoeAdmin commits that landed after the third round closed out and
were never reviewed on their own: `8b2293d` (customer-lookup timeout/retry hardening) and `4a8e04e`
(customer-lookup cooldown/TTL hardening, PR #12). Findings were triaged and safe ones applied directly in
this same session; nothing here touches Delete-vs-Remove, retention-window semantics, revenue transaction
math, or any Firebase rules file — so nothing from this round needs a manual rules publish.

### Fixed (safe, non-revenue, applied directly)
- **ZoeAdmin `attemptAutoLookup()`'s failure/success cooldown state had no session-generation guard**
  (`app.js`), unlike the sibling `fetchCustomerDataTableRows()` which already had one from a prior round.
  A per-barcode lookup that was still in flight (up to ~31.5s: 15s timeout + 1.5s backoff + 15s timeout)
  when a logout happened could write `autoLookupLastFailedAt` or fill stale lookup data into the phone
  modal for whichever *new* session was now active. Captured `myGeneration = customerDataTableSessionGeneration`
  at call start and guard both the success (data-fill) and failure (cooldown-write) branches on it, mirroring
  the existing pattern.
- **ZoeAdmin `clearSensitiveModalFields()` was missing `phoneModal`'s and `manualAdjustModal`'s fields** —
  the single most-used modal in the app (every new-parcel scan goes through `phoneModal`) left the last
  customer's phone number and COD/DOD amounts sitting in raw DOM `value` attributes after logout on a shared
  device, inspectable via DevTools, since `closeModal()` only does `display:none` and neither the modal's
  success path (`confirmPhone()`) nor logout ever blanked the inputs. Same threat model the third round's
  logout-hardening work was written to close for every *other* modal — this one was missed. Added
  `modalPhoneInput`, `modalLockerInput`, `modalCodInput`, `modalDodInput` (customer-facing) and
  `manualDateInput`, `manualCodChangeInput`, `manualDodChangeInput`, `manualCountChangeInput`
  (revenue-adjustment entry, lower sensitivity but same gap) to the blank-list.
- **ZoeAdmin/ZoeW: header auth button (`navAuthBtn`) never flipped to the "logout" state when a license was
  activated *after* login**, only when it was already active at login time — `updateAuthButton(true)` was
  called from `verifyWorkerRoleThenProceed`/its ZoeAdmin equivalent but never from `submitActivationKey()`'s
  success path in either app. A worker/admin who logged in with an expired license, then entered a valid
  activation key, ended up fully authenticated (scanning etc. all worked) but the header button still read
  "🔑 ចូល" and re-opened the login form instead of logging out. Added `updateAuthButton(true)` to both apps'
  `submitActivationKey()` success branch. UI-state only, no security impact (the session genuinely was valid).
- **ZoeAdmin PDF/print export footer timestamp used raw `new Date()` instead of `getServerNow()`**
  (`app.js`, the "នាំចេញនៅ" / "Exported at" line) — the only "now" display in the whole file that didn't,
  inconsistent with the other three. Cosmetic only (doesn't feed retention/revenue logic), fixed for
  consistency.
- **Zoescan: a rejected/invalid activation key was left sitting in the textarea**, only the success path
  cleared it. Low sensitivity (activation keys are meant to be shared over Telegram, not a real credential),
  but consistent with the shared-device-hardening theme — now cleared on the invalid-result path too.
- **ZoeKeyGen: a freshly-generated license key stayed visible (plaintext, with a working Copy button) in
  `#genResultBox` after logout**, readable and copyable by the next admin who logs into the same browser
  tab without a page reload — same bug class as the third round's `clearSensitiveModalFields()` work, just
  never extended to ZoeKeyGen's key-generation result box (a plain `&lt;div&gt;`, not a `.modal`, so the
  existing bulk modal-close sweep never touched it). `showLoginModalWithPrefill()` now also resets
  `lastGeneratedKey = ''` and blanks/hides `#genResultKey`/`#genResultBox`.
- **ZoeKeyGen `generateLicenseKey()`'s background timeout-recovery handler (the `writePromise.then(...)`
  that fires when a client-perceived-as-timed-out write actually lands late) had no session-generation
  guard**, unlike `refreshKeyList()` itself. If the original admin logged out and a second admin logged in
  within the ~25s+ window before the late write resolved, the second admin would see a toast naming the
  first admin's key ID/app-scope and an unrequested key-list refresh. Narrow, information-disclosure-only
  (key ID + app labels, not the signed key string), but same fix pattern as everywhere else — added a
  `myGeneration` check before acting.
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v18, zoew-v15, zoescan-v15, zoekeygen-v9) since all 4
  `app.js` got real behavior changes above.

### Initially flagged for the user, then explicitly authorized and implemented in the same session
Two items were first written up as proposals rather than auto-fixed, since one is revenue/pickup-stat-commit
code and the other is physical-locker-assignment correctness — both categories this project's live-production
policy says should go to human review rather than being silently patched. The user's response was "ចំណុច 2
កែចុះ" (fix both), so both were implemented directly in this same session, immediately after the two items
above were first reported.

1. **[FIXED] Zoescan: client-side eventual-consistency race in the locker-occupancy warning.**
   `findLockerOccupant()` only consulted the local `barcodeIndex`, rebuilt exclusively from a debounced
   (120ms) Firebase `onValue` snapshot on `zoew_scanner_lookup` — nothing optimistically patched it right
   after a successful `assignLockerToEntry()` write, so scanning a second, different order into the same
   locker within that round-trip window produced no warning. **Fix**: `assignLockerToEntry()` now patches
   the matched `barcodeIndex` entry's `item` object in place (`.locker`/`.lockerUpdatedAt`/`.lockerUpdatedBy`,
   handling both the multi-barcode `barcodes[idx]` shape and the single-barcode/legacy shape) immediately
   after the primary `zoew_scanner_lookup` transaction commits, before the mirror-write step. Because
   `barcodeIndex[code].item` is the exact same object reference `historyData[itemId]` holds (not a copy),
   this closes the race for scans on the *same* device/session — the very next scan sees the just-assigned
   locker without waiting for the listener. This is safe even if a concurrent listener refresh replaced
   `barcodeIndex` mid-`await` (the patch would then land on an orphaned object no longer referenced by the
   live index — a harmless no-op, not a corruption risk). **Does not and cannot fully close the cross-device
   half of the race** — two different physical Zoescan sessions scanning into the same locker at the same
   instant still isn't something any client-side patch can prevent; that would need a server-side lock
   (Cloud Functions), which this project doesn't have. Reduces the practical window from "up to a few
   seconds, every scan" down to "only truly simultaneous scans from two different devices" — a real
   improvement, not a full close.
2. **[FIXED] ZoeAdmin/ZoeW: optimistic local revenue/pickup-stat caches weren't reverted on an outright
   `runTransaction` rejection** (as opposed to succeeding-but-clamped-to-0, which was already handled).
   `commitDailyRevenueDelta`/`commitMonthlyRevenueDelta`/`commitDailyPickupDelta`'s `.catch()` blocks now
   negate the exact delta back onto `dailyRevenueData[scanDateStr]`/`monthlyRevenueData[ymKey]`/
   `dailyPickupData[scanDateStr]` (same clamp-to-0 pattern as the forward path), then `commitDailyRevenueDelta`
   and `commitDailyPickupDelta` also call `applyCurrentFilter()` to refresh the always-visible summary stat
   cards immediately (monthly has no persistent on-screen display — it's read fresh from
   `monthlyRevenueData` whenever its modal is opened, so no explicit re-render call is needed there).
   **Race-safety**: each `commit*Delta` function captures `const recordRef = xData[key]` synchronously at
   its own start (before the `await`-yielding `fb.runTransaction` call), and the revert in `.catch()` only
   applies `if (xData[key] === recordRef)` — object-identity-checked. This matters because `dailyRevenueData`/
   `monthlyRevenueData`/`dailyPickupData` are each wholesale-replaced (not mutated) whenever their Firebase
   `onValue` listener fires; if a listener delivered a fresh authoritative snapshot while our failed
   transaction was still in flight, that snapshot already reflects reality (our delta never committed
   server-side), so blindly re-subtracting on top of it would double-count the failure. The identity check
   makes the revert a no-op in that case instead of a new bug — implemented this way specifically to avoid
   introducing the double-subtraction failure mode this project has repeatedly flagged as the thing to watch
   for around revenue math. Applied identically to both ZoeAdmin and ZoeW (byte-for-byte-mirrored logic, per
   this project's usual pattern for shared-shape functions across the two apps).

### Not yet done as of this handoff
All fixes above (both the original batch and these 2 follow-ups) are committed, `node --check`-clean on
every modified `.js`, and comment-free grep re-verified on every changed line. Nothing is mid-edit. No
Firebase rules files were touched this round, so no manual-publish step is needed. `CACHE_VERSION` was bumped
a second time in ZoeAdmin/ZoeW/Zoescan's `sw.js` (zoeadmin-v19, zoew-v16, zoescan-v16) to cover this follow-up
batch; ZoeKeyGen's `sw.js` was untouched this round (stays at zoekeygen-v9) since neither follow-up item
touches ZoeKeyGen.

This round's PR (#13) was merged to `main` at the user's explicit request in this session.

**RESOLVED 2026-08-19 (confirmed by user):** the long-open question about `license-verify.js`'s
`LICENSE_DB_URL` (`https://zoew-z1-default-rtdb.firebaseio.com`, byte-identical across all 4 apps) possibly
being a mixed-up copy of ZoeW's business DB URL — first flagged in the very first audit round, carried
forward unresolved through all four rounds since — is now closed. The user checked the Firebase Console
directly and confirmed it matches the dedicated `zoe-license`-equivalent project actually used for
license/activation data, not ZoeW's business database. The "zoew-z1" naming was just a misleading label, not
a real mix-up. No code or config change needed; nothing outstanding from this thread remains.

## Setup Link — Firebase Config provisioning helper (added 2026-08-19)

Added at the user's request after clarifying the deployment model: this system is not distributed as
source/self-hosted per client — the vendor (user) personally provisions a separate Firebase project per
client business and personally configures every one of that business's devices with a `zoew_firebase_config`
pointing at it. With 200-300 client businesses, manually pasting Config JSON into every single device was
identified as the biggest operational bottleneck (bigger than any code bug found in four audit rounds).

- **ZoeKeyGen** (vendor-only tool, never given to clients) gained a "🔗 បង្កើត Setup Link" card: paste a
  business's Firebase Config JSON once, pick which of the 3 business apps + its deployed Base URL (remembered
  per-app in `localStorage` for reuse across future links), and it produces a link shaped like
  `https://<app-site>/?setup=<base64-encoded-config>` plus a "Copy Link" button.
- **ZoeAdmin/ZoeW/Zoescan** each gained `applySetupLinkFromUrl()`, called once on boot (before
  `initFirebase()`, mirroring the existing `zoew_firebase_config`/`saveFirebaseConfig()` pattern in each app)
  — decodes the `?setup=` param, shows a native `confirm()` naming the target `projectId` before saving
  anything, writes to the same `zoew_firebase_config` localStorage key the manual Config modal already uses,
  and always strips the query string via `history.replaceState` immediately regardless of whether the user
  confirms or cancels, so the encoded config never lingers in the address bar/browser history.
- Firebase client config (`apiKey`/`databaseURL`/etc.) is not treated as a secret anywhere else in this
  codebase (protection is server-side Rules, not secrecy — same reasoning already applied to the existing
  plain-textarea Config modal), so embedding it in a URL introduces no new class of risk versus the status
  quo; the new card's own copy still tells the vendor to send the link privately (e.g. Telegram) rather than
  posting it publicly, consistent with how activation keys are already handled.
- **QR code generation was requested alongside the link.** Initially not implemented because this session's
  network egress policy rejects `unpkg.com` (confirmed via `$HTTPS_PROXY/__agentproxy/status`, showing a
  `connect_rejected`/403 for that host) — the same class of block noted in the first audit round's Firebase
  emulator-testing attempt — and a hand-written QR encoder was deliberately avoided rather than risk shipping
  a subtly-broken one with no way to test-scan it in this environment. **Resolved in the same session**: the
  user's first paste came from the exact `unpkg.com/qrcode-generator@1.4.4` URL originally suggested in
  chat — confirmed by downloading the real v1.4.4 npm tarball for comparison, which matched byte-for-byte
  except one line (`renderTo2dContext()`'s `fillRect` had `row`/`col` swapped, a genuine bug in that old
  version, fixed upstream by v2.0.4 — corrected here to match the current release). The user then ran
  `npm install qrcode-generator@2.0.4` themselves and uploaded the actual installed
  `node_modules/qrcode-generator/dist/qrcode.js` file directly, which was copied in as the final
  `ZoeKeyGen/qrcode.js` — **verified byte-for-byte identical (`diff`, zero output) against the real
  `qrcode-generator@2.0.4` tarball downloaded from `registry.npmjs.org` for comparison** (Kazuhiko Arase, MIT
  license — `registry.npmjs.org` is in this session's `noProxy` allowlist, so it was reachable directly even
  though `unpkg.com` is not). Loaded via a plain same-origin `<script src="./qrcode.js">` tag — no CDN, no
  CSP change needed. `generateSetupLink()` now also renders the
  link into a scannable QR (via `qrcode(0, 'M').createSvgTag(...)`, inline SVG into
  `#setupLinkQrContainer`, wrapped in try/catch so a failure degrades to link-only rather than breaking
  generation), and `showLoginModalWithPrefill()` clears the QR container on logout alongside the other
  Setup Link fields. Added to the service worker's `APP_SHELL` precache list and `CACHE_VERSION` bumped
  again (zoekeygen-v11). Note: `qrcode.js` is third-party vendored code, kept as-is including its own
  comments — the project's comment-free convention applies only to this codebase's own `app.js`/
  `license-verify.js`, not to vendored libraries.
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v20, zoew-v17, zoescan-v17, zoekeygen-v11).

This round's PR (#15) was merged to `main` at the user's explicit request in this session.

## Firebase Backup Tool (added 2026-08-19)

Added at the user's request as a follow-up to the "what's missing before public launch" discussion — the
biggest unaddressed data-safety gap identified was that Firebase RTDB has no backup at all; losing a
client business's project (account issue, accidental deletion, quota problem) would be unrecoverable.

- New top-level `firebase-backup/` directory, **not part of any of the 4 deployed apps** — a standalone
  Node.js CLI tool the vendor runs themselves (locally or via a scheduled task), using `firebase-admin`
  with a per-business service account key (bypasses RTDB rules entirely, unlike the client SDK — the
  correct approach for a trusted, vendor-only backup script).
- `backup.js` reads `config.json` (gitignored, never committed — contains real business names +
  paths to real service-account key files) listing one entry per business (name, service account path,
  database URL), does a full root (`/`) export per business, gzips it to
  `backups/<business>/<ISO-timestamp>.json.gz`, and prunes older backups beyond `keepCount` (default 30).
  One business failing (bad credentials, missing file, network error) doesn't stop the others — each is
  independently try/caught and reported; the process exits non-zero only if *any* failed, so a scheduled
  task can alert on it.
- `config.example.json` is the committed template; `config.json`, `firebase-backup/secrets/` (where the
  downloaded service-account JSON keys go), and `firebase-backup/backups/` (the output) are all in
  `.gitignore` — service account keys are genuine credentials (unlike the client-side Firebase config used
  elsewhere in this project, which is intentionally not secret), so they must never be committed.
- **Verified working this session**: ran `npm install` (167 packages, no vulnerabilities), confirmed the
  missing-config error path, confirmed per-business failure isolation with a fake config (one missing file
  + one malformed service-account key — both failed independently with clear messages, exit code 1,
  neither crashed the process), and independently verified the gzip write/read round-trip and the
  prune-to-`keepCount` rotation logic with a standalone test (5 fake dated backups → correctly kept only
  the newest 3). **Not verified against a real Firebase project** — no live project/service-account key
  available in this session; the vendor should do one real end-to-end run after setup.
- README (`firebase-backup/README.md`, in Khmer) covers: getting a service-account key from the Firebase
  Console, `config.json` setup, manual run, Windows Task Scheduler + cron scheduling instructions, and a
  documented-but-not-built manual restore procedure (restore is deliberately not a one-command script,
  since it can overwrite live data — the README gives the few lines of code needed, for a human to run
  deliberately when actually needed).
- Root `.gitignore` updated: `node_modules/`, `firebase-backup/config.json`, `firebase-backup/secrets/`,
  `firebase-backup/backups/`, `firebase-backup/backup.log`.
- Does not touch any of the 4 apps, Firebase rules, or CACHE_VERSION — purely additive, isolated tooling.

## Config-modal QR scanner for Setup Link (added 2026-08-19)

Added at the user's request as a companion to the Setup Link feature — instead of the vendor reading the
generated link/QR out loud or the target device relying on an external system camera app to open the
Setup Link URL, ZoeAdmin/ZoeW/Zoescan's own Config modal now has a "📷 ស្កេន QR (Setup Link)" button that
scans the same QR with the device's own camera and auto-fills the Config textarea, so the human still
reviews and clicks the existing "Save" button — no new silent-save path.

**Explicit user constraint, honored by design**: the existing parcel/barcode-scanning feature (ZoeAdmin's
and Zoescan's `liveScanCodeReader`/`codeReader`, restricted to 1D barcode formats) must not be touched or
affected in any way. This is why the new scanner uses a **completely separate `ZXing.BrowserQRCodeReader`
instance** (a QR-only decoder class, structurally incapable of matching barcode formats — not the same
multi-format reader used for barcode scanning, and not achieved by broadening that reader's format hints)
with its own isolated variables (`configQrReader`, `configQrScanActive`), own camera stream (via ZXing's
own `decodeFromVideoDevice`), own video element (`#configQrVideo`), and own modal (`#configQrScanModal`).
Zero lines of the existing barcode-scanning code path were modified in any of the three apps.

- **Shared logic**: `decodeSetupPayload(setupParam)` (extracted as a small helper in all 3 apps, reused by
  both `applySetupLinkFromUrl()` and the new scanner) decodes+validates the same base64 payload the Setup
  Link URL already used — one already-reviewed decode path, not a second parallel implementation.
- **Flow**: `openConfigQrScanner()` opens `#configQrScanModal` on top of the already-open `#configModal`
  (both apps' existing `openModalHelper`/`closeModal` — or Zoescan's `openModal`/`closeModal` — already
  support multiple simultaneously-open `.modal` elements correctly, confirmed by reading their
  implementations rather than assumed) and starts the QR-only reader. On a successful decode,
  `handleConfigQrResult(text)` parses the scanned string as a URL, extracts the `?setup=` param, decodes it
  via the shared helper, stops the scanner, and — unlike the URL-param flow's `confirm()` dialog — simply
  **pretty-prints the config into the existing Config textarea** (`firebaseConfigInput` in ZoeAdmin/ZoeW,
  `configInput` in Zoescan) for the human to review and click the pre-existing Save button themselves. No
  new auto-save path was introduced; this reuses the same trusted, already-existing save/validate code
  every manual paste already goes through.
- **ZoeAdmin, Zoescan**: already had `@zxing/library@0.23.0` loaded (pinned version + SRI hash, for the
  barcode-scanning feature) and the necessary CSP (`unpkg.com` in `script-src`, `worker-src 'self' blob:`)
  and `Permissions-Policy: camera=(self)` — reused as-is, zero infra changes needed for these two apps.
- **ZoeW**: previously had **no camera capability at all** by design (`Permissions-Policy: camera=()`, no
  ZXing, no scan feature of any kind — deliberately, since ZoeW's role never needed a camera). Adding this
  feature there required, for the first time in ZoeW: loading the identical pinned `@zxing/library@0.23.0`
  script tag (same URL + SRI hash as ZoeAdmin, byte-for-byte, not a different version), adding `unpkg.com`
  to `script-src` and `worker-src 'self' blob:` to `netlify.toml`'s CSP, and changing
  `Permissions-Policy` from `camera=()` to `camera=(self)`. **This was confirmed explicitly with the user
  before implementing** (a real security-posture change, not something to silently decide) — they chose to
  add it to all 3 apps for consistency rather than skip ZoeW.
- Verified via `node --check` on all 3 apps' `app.js`, HTML tag-balance check on all 3 `index.html`, and the
  exact `ZXing.BrowserQRCodeReader`/`decodeFromVideoDevice`/`Result.getText()` API surface confirmed against
  the real `@zxing/library@0.23.0` TypeScript definitions (downloaded from `registry.npmjs.org` for
  inspection, matching the same verification-over-assumption approach used for the vendored `qrcode.js`) —
  **not verified against a real camera/device in this session** (no browser/camera available), so the
  vendor should test the actual scan-to-fill flow once after deploying.
- `CACHE_VERSION` bumped in the 3 affected apps' `sw.js` (zoeadmin-v21, zoew-v18, zoescan-v18); ZoeKeyGen
  untouched this round.

## Fifth deep-audit pass (2026-08-19, branch `claude/detailed-audit-pyi4gq`) — handoff notes

Requested by the user ahead of adding 2-3 new features in one batch, specifically worried something had
been missed by that point. Ran 5 parallel research-only agents again (one per app plus one cross-cutting
infra pass), each re-checking every documented bug class for regressions and independently hunting for
anything new, with explicit extra scrutiny on the Setup Link / Config-modal QR scanner / Firebase-backup-tool
work added at the end of the fourth round — all three were built and self-verified (`node --check`, tag-
balance, byte-diffs) in that same session but never actually reviewed by a fresh 5-agent audit pass of their
own, since they were added after that round's dedicated review had already run.

### Fixed (safe, non-revenue, applied directly)
- **Config-modal QR scanner: camera never released except via its own exact Cancel button — regression of
  the "camera stays on after logout" bug class already fixed once for Zoescan's main scanner in round 3.**
  All three agents covering ZoeAdmin/ZoeW/Zoescan independently found the identical gap (the feature was
  copied to all three apps in the same commit with the same omission): `closeConfigQrScanner()` was wired
  only to the modal's "បោះបង់" button, so backdrop-click, the Escape key, and logout/4h-forced-expiry/role-
  check-failure all left the QR camera stream running indefinitely and left `configQrScanActive` stuck
  `true` — permanently breaking the "📷 ស្កេន QR" button until a full page reload. A second, distinct bug
  compounded it: the Escape-key handler in all three apps picks the *first* open `.modal` in DOM order
  (`Array.from(...).find(...)` / `document.querySelector('.modal.open')`), and `configModal` (opened first,
  still open underneath) always precedes `configQrScanModal` in each app's HTML — so Escape was silently
  dismissing the wrong, invisible modal instead of the visible QR scanner. **Fix, mirrored identically across
  ZoeAdmin/ZoeW/Zoescan**: added `data-close="closeConfigQrScanner"` to each app's `#configQrScanModal` (same
  mechanism `restoreWarningModal`/`permanentDeleteWarningModal` already use), which correctly fixes backdrop-
  click since the click target naturally resolves to the topmost stacked modal; changed each app's Escape-key
  handler to pick the *last* open modal instead of the first (topmost/most-recently-opened, matching what a
  user actually sees and expects Escape to close — a small generically-correct fix, not QR-specific); and
  added an explicit `closeConfigQrScanner()` call to ZoeAdmin's/ZoeW's `showLoginModalWithPrefill()` and to
  Zoescan's `onAuthStateChanged` sign-out branch (both before their generic bulk modal-close loops, which
  call plain `closeModal()` and don't consult `data-close`), matching the exact pattern Zoescan's round-3
  camera fix already established for its main scanner.
- **QR scanner could open a second concurrent camera stream on top of the already-running main barcode
  scanner in ZoeAdmin and Zoescan** — untested on real hardware per the round-4 handoff notes, and flagged
  independently by both apps' agents as a real risk to the core scan-to-locker/scan-to-parcel workflow (a
  modal being open only pauses the main scanner's *decode loop*, not its underlying `getUserMedia` stream,
  so it stays live and reachable the whole time Settings/Config is open). Rather than attempt an unverified
  stop-then-auto-resume dance across two independent camera consumers, `openConfigQrScanner()` in both apps
  now simply refuses to open (with a clear toast asking the user to close the barcode scanner first) while
  `isCameraScanning`/`isCameraStarting` is true — guarantees only one `getUserMedia` stream is ever requested
  at a time, closing the risk entirely instead of hoping simultaneous streams behave. (ZoeW has no main
  scanner/camera capability of any other kind, so this guard doesn't apply there.)
- **`clearSensitiveModalFields()` gaps** (the shared-device logout-hardening sweep from rounds 3-4, found
  incomplete in a few more spots): ZoeAdmin's `lookupSecretKey` (the PIN-derived `CryptoKey` that decrypts the
  saved customer-lookup API secret) was never reset on logout — since the whole file is top-level script code
  with no wrapping IIFE, every function stays directly callable from DevTools for the rest of the page's life,
  so a PIN entered once during a shift kept unlocking authenticated lookup-API calls long after logout,
  defeating the PIN gate's own stated purpose. Also added to ZoeAdmin's blank-list: `lookupApiHeaderValueInput`
  (the lookup-API secret's own input field, left with a readable DOM value if the config modal was cancelled
  rather than saved) and `editModalBarcodeText` (the barcode label in the edit-phone modal). ZoeW got the same
  `editModalBarcodeText` fix (present with the identical omission — a gap shared by both apps since the field
  predates the hardening sweep, not a fix that landed in one sibling and not the other).
- **ZoeKeyGen `refreshKeyList()` had no partial-failure fallback**: it read `license_keys` and
  `license_keys_meta` via `Promise.all`, so a rejection on *either* read (a `license_keys_meta` permission
  hiccup right after a rules publish, a revoked `user_roles` entry mid-session, a network blip — this project
  has hit "rules not published yet" as a real recurring incident) blanked the *entire* key list, even though
  the publicly-readable `license_keys` node might have loaded fine. Switched to `Promise.allSettled`: the
  public node's data now renders unconditionally as long as that read itself succeeds, and only degrades
  gracefully (falling back to the existing no-meta-record derivation already used per-row) if the meta read
  specifically fails, which now also gets its own Sentry capture rather than surfacing only as a generic full-
  page failure.
- **ZoeKeyGen `clearSigningKey()` didn't null the derived `signingKeySessionKey` `CryptoKey` handle** — low
  real-world impact (the key is non-extractable, and its only use is decrypting the `sessionStorage` blob the
  same function already deletes), but for a variable that exists specifically to protect the system's highest-
  value secret, an explicit "clear from memory" action leaving a live derived-key handle behind was worth
  closing for defense-in-depth. Now set to `null` alongside `signingPrivateKeyJwk`.
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v22, zoew-v19, zoescan-v19, zoekeygen-v12) since all 4
  `app.js` got real behavior changes above.

### Follow-up: user reviewed the 3 proposed items and said "fix all of them, make it secure, don't let it be
bypassable" — here's what was actually done for each
2 of the 3 were safely fixable and are now fixed; the 3rd was investigated further *while implementing* and
turned out to be unsafe to apply as originally proposed — it was reverted rather than shipped, since a broken
production app is worse than a narrow, already-partially-mitigated gap. Details below.

1. **NOT applied, reverted after investigation — Firebase rules gap on `zoew_scan_history_cod_dod/$itemId`'s
   top-level `cod`/`dod`/`price`.** The proposed fix (extend the same "admin OR not-yet-existing OR unchanged"
   pattern already used for the nested `barcodes/$idx/{cod,dod}` fields) was drafted and JSON-validated, but
   before committing it, traced every ZoeW (`worker`-role) code path that writes to this exact top-level field
   set on an *existing* record — and found three real, currently-shipping ones that legitimately need to:
   `claimAndCleanupItem`'s automatic 8-day stale-open partial-claim branch (`ZoeW/app.js` ~line 1056-1058,
   recomputes `updated.cod/dod/price` from the still-active barcodes and writes it via `runTransaction` on the
   live item), `restoreClaimedItemToScanHistory` (~line 1010-1012, the round-4 trash-write-failure recovery
   transaction that restores reclaimed barcodes back into the live record), and `executeRestoreItem`'s
   merge-into-existing-open-order branch (~line 2366-2368, the common "restore from trash while a matching open
   order already exists" case). All three run under the worker's own authenticated session and all three write
   a *recomputed sum* of `barcodes[].cod/dod` into these top-level fields on a record that already exists —
   exactly the write shape the proposed "admin OR unchanged" rule would reject. Applying the proposed rule as
   drafted would have silently broken the 8-day auto-cleanup, the trash-recovery safety net, and restore-merge
   for every ZoeW user, in exchange for closing a narrower gap (a compromised/malicious worker account crafting
   a raw REST write to fabricate these exact fields). The fundamental problem is that Firebase RTDB's rules
   language has no aggregate/sum function, so a rule can't verify "this new top-level value equals the sum of
   this record's own `barcodes[].cod/dod`" — the same "no declarative rule can verify a delta's history is
   honest — that fundamentally requires a trusted server (Cloud Functions), which this project doesn't have"
   conclusion the first "final" audit round already reached for the sibling problem (worker write access to
   the daily/monthly revenue nodes), and for the same reason. **Change reverted; `firebase-database.rules.json`
   is unchanged from before this round.** This is now a confirmed, deliberately-accepted limitation in the same
   category as that earlier "safe subset only" decision, not an oversight — revisit only if/when a trusted
   backend (Cloud Functions or similar) is ever added to this project.
2. **Fixed — ZoeAdmin `removeSingleBarcode`'s outer-catch snapshot revert.** Removed the wholesale
   `dailyRevenueData = dailySnapshot; monthlyRevenueData = monthlySnapshot;` reassignment (and the now-unused
   snapshot variables) from the failure-catch block. The existing `addRevenueToDailyAndMonthlyRecord(...)` call
   right above it already reverses the applied delta correctly and object-identity-safely via its own
   transaction — the wholesale reassignment was only ever redundant in the simple case and actively harmful
   under the race (discarding a fresher listener-delivered snapshot from a concurrent device). `scanHistory`/
   `deletedItems` snapshot-revert is untouched, since that wasn't part of the flagged finding. **Note for a
   future round**: the same snapshot-then-wholesale-revert shape also exists in the new-parcel-scan save flow
   (`ZoeAdmin/app.js` ~line 3286-3298, inside the phone-modal confirm handler) — not fixed this round since it
   wasn't part of what was audited/proposed, flagging for awareness only.
3. **Fixed — Setup Link's URL-param flow no longer bypasses the Security PIN gate**, in all 3 business apps.
   `applySetupLinkFromUrl()` no longer writes straight to `localStorage`; it now routes through the exact same
   PIN gate every other config change already uses:
   - **ZoeAdmin** already had a general-purpose `pinTargetAction` callback mechanism (`requestPinBeforeConfig
     (targetAction)`, already used elsewhere for the lookup-API config modal) — reused directly:
     `applySetupLinkFromUrl()` now calls `requestPinBeforeConfig(() => { openConfigModal(); <pre-fill textarea
     with the parsed config>; })`.
   - **ZoeW and Zoescan** had no such callback mechanism (`requestPinBeforeConfig()` always just opens
     `openConfigModal()` unconditionally after success), so both gained a small `pendingSetupLinkConfig`
     module-level variable instead: `applySetupLinkFromUrl()` stashes the parsed config there and calls the
     existing `requestPinBeforeConfig()`; `openConfigModal()` now checks it first (pre-filling and consuming
     it) before falling back to its old behavior of loading the saved config from `localStorage`.
   - In every app the old `window.confirm()` naming the `projectId` was dropped entirely — the PIN-gated Config
     modal itself, showing the actual JSON in a reviewable/editable textarea before the existing "រក្សាទុក"
     (Save) button is explicitly clicked, is a strictly stronger confirmation than a generic `confirm()` dialog
     ever was, and it's the exact same review step the already-correct QR-scan-to-textarea flow already uses.
   - **First-run devices are unaffected and not weakened**: `requestPinBeforeConfig()`/`checkPinAndOpenConfig()`
     already open `pinSetupModal` (create-a-new-PIN) when no PIN exists yet, so a brand-new device opening a
     Setup Link still gets the config pre-filled and still must set a PIN before it can ever be saved — strictly
     *more* secure than before (previously the URL flow saved with **zero** PIN involvement even on a fresh
     device), not a regression of the legitimate first-time-setup case the feature exists for.
   - Verified the boot-sequence interaction is safe: `applySetupLinkFromUrl()` still runs before `initFirebase()`
     on page load in all 3 apps; on a config-less first-run device, `initFirebase()`'s own `checkPinAndOpenConfig
     (true)` call (which doesn't touch `pinTargetAction`/`pendingSetupLinkConfig`) can also fire right after,
     redundantly reopening the same already-open `pinSetupModal` — harmless (idempotent) and doesn't clobber the
     Setup Link's pending config or callback.

### Not yet done as of this handoff — lower-priority items noted but not applied
- QR-scan camera-open failures always show the same generic "check camera permission" toast regardless of
  the actual error (ZoeAdmin/Zoescan) — misleading if the real cause is the now-blocked dual-stream conflict;
  `requestCameraPermission()`'s existing per-error-type messaging could be reused.
- No in-app-browser (Facebook/Instagram/Messenger/Line) warning before opening the QR scanner, unlike the
  main barcode scanner's `requestCameraPermission()`, which already warns proactively.
- `firebase-backup/backup.js` doesn't sanitize `business.name`/paths from the vendor-authored, gitignored
  `config.json` before using them as filesystem paths — low risk given the trusted-input design (no
  command-injection surface exists at all in that script), but worth a defensive `../`/absolute-path check.
- ZoeKeyGen's `persistSigningKeyForSession()` can silently no-op with zero user feedback if WebCrypto's
  `deriveKey` fails during first-time PIN setup — fails closed (no insecure storage), just confusing; rare.
- Zoescan's `lockerUpdatedBy` mirror-write could theoretically send `null` instead of a string if
  `currentUserEmail` were ever empty while authenticated, which the rules schema would reject — narrow/
  theoretical, `currentUserEmail` should never be empty for an authenticated session.
- ZoeW/ZoeAdmin's `renderHistory()` age/recall UI badges use raw `Date.now()` — purely cosmetic (24h "new/old"
  badge, 4h "call again" hint), doesn't feed retention or revenue decisions, arguably within the spirit of the
  existing cosmetic-timer exemption though not explicitly named there; flagged for awareness only.

All fixes above are committed, `node --check`-clean on every modified `.js`, and HTML div-tag-balance-checked
on every modified `.html`. Nothing is mid-edit. No Firebase rules files were touched by the fixes actually
applied this round.

## Sixth deep-audit pass (2026-08-19, branch `claude/deep-audit-bug-fixes-7f6izx`) — handoff notes

Requested as another meticulous final round: the user was explicitly not yet satisfied because *every
previous round kept finding new bugs*, and asked for a thorough, gap-free sweep plus a README tidy-up.
Branch started exactly at `main` (commit `aab9b03`, i.e. right after PR #17 merged), no carry-over.

**Method note (differs from rounds 1-5):** this round was run *inline, single-threaded*, not with 5 parallel
research agents — the session's operating rules forbade spawning subagents unless the user asks. Instead of
fan-out, coverage came from purpose-built static checkers written during the session (kept in the scratchpad,
worth rebuilding if useful):
- a **sibling-divergence differ** that extracts every top-level function from `ZoeAdmin/app.js` and
  `ZoeW/app.js` by name and diffs same-named pairs. At round start: 103 shared functions, 78 identical,
  25 different — this is what surfaced the `claimAndCleanupItem` and scanner-lookup findings below, and it is
  by far the highest-yield tool for this codebase's "independently duplicated logic" problem. Re-run it first
  in any future round.
- a **`getElementById` ↔ HTML `id=` cross-checker** (both directions) and an **inline-`on*=` handler ↔
  function-existence checker**, per app — all clean except the dynamically-created `zoeUpdateBanner`.
- a **`data-close` target checker** (every `data-close="fn"` resolves to a real global function).
- a **referenced-Firebase-path ↔ rules-file coverage** check (all paths covered).
- a **token-equivalence-proving whitespace trimmer** (acorn tokenize → strip → re-tokenize → refuse to write
  unless the token stream is byte-identical). Used it to safely strip 26 + 12 trailing-whitespace lines from
  ZoeAdmin/ZoeW `app.js` without risking a change inside a template literal.
- acorn comment scan across all 8 `app.js`/`license-verify.js` files: **0 comments** — convention still holds.

### Fixed (safe, non-revenue, applied directly)
- **Zoescan: the round-5 Setup-Link PIN gate was fully bypassable on a config-less device** (a real regression
  of that round's own fix, in Zoescan only). Boot order is `applySetupLinkFromUrl()` → `initFirebase()`, and
  Zoescan's `initFirebase()` called `openConfigModal()` **directly** when no config was saved (ZoeAdmin/ZoeW
  route the same case through `checkPinAndOpenConfig(true)`). Since `openConfigModal()` is the sole consumer of
  `pendingSetupLinkConfig`, the Setup Link's config got pre-filled into a Config modal that opened with **zero
  PIN involvement** — exactly what round 5 set out to prevent. Both of Zoescan's no-config early returns now
  call `requestPinBeforeConfig()` instead. Side effect worth knowing: a brand-new Zoescan device now sees
  `pinSetupModal` before the Config modal, matching ZoeAdmin/ZoeW's long-standing first-run behavior.
- **All 3 business apps: an abandoned Setup Link stayed armed indefinitely and could silently pre-fill
  *another business's* Firebase config into a later, unrelated Config open.** `pendingSetupLinkConfig`
  (ZoeW/Zoescan) and `pinTargetAction` (ZoeAdmin) were only ever consumed on success — cancelling the PIN
  prompt left them set. With the 200-300-client provisioning model this is a genuine mis-provisioning risk
  (a vendor opening Config to *check* the current config sees a different one pre-filled, and Save is one tap
  away). Added `cancelPinSetupFlow()`/`cancelPinEntryFlow()` in all 3 apps, wired to both the cancel buttons
  and (via `data-close=` on `pinModal`/`pinSetupModal`) the backdrop-click and Escape paths. ZoeAdmin's
  `checkPinAndOpenConfig()` also now resets `pinTargetAction` up front, since its no-PIN branch opens
  `pinSetupModal` directly and would otherwise inherit a stale callback.
- **ZoeAdmin + ZoeW: `claimAndCleanupItem` left `zoew_scanner_lookup` permanently desynced from
  `zoew_scan_history_cod_dod` whenever the trash write failed and the round-2 recovery restored the parcel.**
  Both apps updated the lookup node assuming the claim was final (ZoeAdmin before the trash write, ZoeW after),
  and `restoreClaimedItemToScanHistory()` put the parcel back without ever re-syncing it — so a restored parcel
  was invisible to Zoescan ("barcode not found", no locker assignable) with no error anywhere. Now both apps
  clear/sync immediately after the claim transaction commits (the narrower of the two windows) **and** re-sync
  from `restoreResult.snapshot.val()` when the recovery succeeds. Also renamed ZoeW's `claimedUpdatedRemainder`
  → `updatedRemainder`; **`claimAndCleanupItem` is now byte-identical across the two apps**, verified by the
  divergence differ.
- **ZoeAdmin/ZoeW: `buildScannerLookupPayload`, `syncScannerLookupEntry`, `clearScannerLookupEntry` had drifted
  apart** — ZoeW wrote `barcodes` as an index-keyed object skipping nulls (which for a sparse array can make
  RTDB return an object, and every consumer tests `Array.isArray`), ZoeAdmin wrote a dense array with
  placeholders; ZoeW validated the itemId with a regex and used `set(child)`, ZoeAdmin used
  `update(parent, {[id]: …})` with no id validation. Unified all three on the safer shape (dense array +
  itemId regex guard + `set`). All three are now identical across the apps.
- **ZoeAdmin/ZoeW/Zoescan: the Config QR scanner's camera was never released when the app was backgrounded.**
  Round 3 fixed exactly this bug class for Zoescan's main barcode scanner and round 5 fixed the QR scanner's
  logout/backdrop/Escape paths, but no app's `visibilitychange` handler knew about `configQrScanActive`
  (ZoeW had no camera visibility handler at all — it never had a camera before the QR feature). All three now
  call `closeConfigQrScanner()` when the document goes hidden.
- **ZoeAdmin/ZoeW: Escape dismissed the wrong modal when a stacked dialog sits *earlier* in DOM order.**
  Round 5 changed the Escape handler from "first open modal" to "last open modal in DOM order" to fix the
  `configModal`/`configQrScanModal` pair, but `editBarcodePriceModal` (inline `z-index: 1050`) is declared
  *before* `viewListModal` in ZoeAdmin's HTML while opening visually on top of it — so Escape closed the
  background list instead of the visible edit dialog. Replaced the DOM-order heuristic with a shared
  `topmostModal()` that ranks open modals by computed `z-index` and falls back to DOM order on ties (`>=`),
  which is correct for both pairs. Applied to all 3 apps.
- **ZoeAdmin/ZoeW: `runAutomaticDeletedCleanup()` released barcodes from `zoew_barcode_registry` in parallel
  with the trash-purge write instead of after it** — if the purge failed, the barcode was freed while its
  parcel was still sitting in (and restorable from) the trash, so the same barcode could be scanned in again as
  a duplicate. `executePermanentDelete()` already chained these correctly; the automatic sweep now does too.
- **`license-verify.js` (all 4 copies): `checkOnline()` skipped the server-clock sync on any non-OK HTTP
  response**, because the `!res.ok` early return sat above the `Date`-header capture — so exactly when the
  license DB was erroring (e.g. right after a rules change) `getStatus()` fell back to the raw device clock for
  its expiry/offline-grace decisions. Moved the header capture above the early return. Re-copied to all 4 apps;
  all still hash to one value (`md5sum` verified).
- **`firebase-backup/backup.js` hardening** (round 5 flagged the path handling and never fixed it): backups now
  write to a `.partial` temp file and `rename()` into place, so an interrupted run can't leave a truncated
  `.json.gz` that both looks like a valid backup and consumes a `keepCount` slot (pushing a good one out) —
  the worst failure mode a backup tool can have. `keepCount` is validated as an integer ≥ 1 (a negative value
  previously made the prune loop delete *everything*, including the backup just written). `business.name` is
  validated against `^[A-Za-z0-9._-]+$` before being used as a directory name, and a missing name is a clean
  per-business failure instead of a `path.join` crash. Failure/success lines now label a nameless entry `#N`
  rather than printing `undefined`. `main()` got a top-level `.catch`. **Verified by running it** against a
  stubbed `firebase-admin`: all four validation paths, per-business failure isolation, exit code 1 on any
  failure, rotation keeping exactly `keepCount`, zero `.partial` leftovers, and a gzip write/read round-trip.
- Small: ZoeAdmin/ZoeW now clear the activation-key textarea on the *invalid* path too (Zoescan already did,
  round 4); trailing-whitespace cruft stripped from ZoeAdmin/ZoeW `app.js` (token-equivalence proven).
- `CACHE_VERSION` bumped in all 4 `sw.js` (zoeadmin-v24, zoew-v21, zoescan-v21, zoekeygen-v13) — ZoeKeyGen
  included because its `license-verify.js` copy changed. **No Firebase rules file was modified by any applied
  fix, so nothing from this round needs a manual publish.**

### README work (the second half of the request)
- **Root `README.md` rewritten/extended**: added the `firebase-backup/` tool to the app table, a full
  Firebase-path/reader table for the business DB, a "Provisioning" section documenting the Setup Link + QR flow
  end-to-end (including that both paths are PIN-gated and human-confirmed), and a backup section. Kept the
  existing architecture notes.
- **Fixed a genuinely broken doc reference**: `ZoeAdmin/README.md` pointed twice at `google-sheets-api/README.md`,
  a path that has **never existed in this repo** (confirmed via `git log --all`). Replaced with a new inline
  **"Lookup API"** section documenting the actual contract read out of the code — the `{barcode}` URL
  placeholder, the `?list=1` / `{rows:[…]}` list endpoint, the PIN-derived encryption of the header secret,
  the configurable nested field paths, the 15-minute cache, and the CSP `connect-src` constraint.
- Added Setup Link / QR bullets to all 3 business-app READMEs; documented Zoescan's locker-occupancy warning;
  documented that ZoeW now uses the camera (QR only) — a real security-posture change that was undocumented.
- Documented the backup tool's new `.partial`/rename behavior and `keepCount`/`name` validation.
- Added a link checker: every relative Markdown link in all 6 READMEs now resolves.

### Reported to the user, NOT applied (revenue / pickup-stat / rules — live-production policy)
Written up for human review rather than auto-applied, per "Project status" + point 5 of "When triaging".
1. **[pickup stat] `toggleCloseStatus` applies a ±1 customer delta unconditionally.** `desiredClosed` is
   computed from the pre-`confirm()` object, but `previousState` is re-read from `scanHistory` *after* the
   blocking dialog (the whole reason `freshItem` exists). If another device closed the order during the dialog,
   the package delta correctly computes 0 but the customer refCount still gets +1 — leaving a stale ref that
   keeps the phone in `pickedUpPhones` after all its orders are reopened. `toggleIndividualBarcodeClose` guards
   its *customer* delta on a real boundary crossing but has the same unguarded shape for its *package* delta.
   Proposed fix: derive both deltas from `previousState` vs. desired, not from `desiredClosed` alone.
2. **[revenue] `executeRestoreItem` never adds revenue back for a legacy item with no `barcodes[]` array**,
   even though the 8-day abandon sweep *did* subtract its top-level `cod`/`dod` (`claimAndCleanupItem` handles
   the no-`barcodes[]` case explicitly; the restore path only iterates `itemToRestore.barcodes`). Asymmetric —
   money is subtracted and never returned. Same in both apps.
3. **[revenue] `confirmPhone`'s wholesale `dailyRevenueData`/`monthlyRevenueData` snapshot revert** (the exact
   leftover round 5 flagged for a later round). Unlike `removeSingleBarcode`'s, it is *not* purely redundant:
   on the 15s `withTimeout` path `addOrUpdateEntry`'s own `revertRevenueOnSaveFailure` has not run yet. But
   `addOrUpdateEntry` owns the correct targeted revert and will apply it whenever the write actually settles,
   so the snapshot assignment can go — and should, because it discards a concurrent listener refresh from
   another device. `scanHistory = historySnapshot` in the same catch is load-bearing (nothing else undoes the
   local item) and should stay.
4. **[revenue, latent] `executeRestoreItem`'s merge branch buckets the add-back under `targetItem.scanDate`
   in ZoeAdmin but `itemToRestore.scanDate` in ZoeW.** The subtraction always used the trash item's scanDate,
   so ZoeW's is the symmetric one. Currently unreachable-in-practice (the merge match requires equal scanDates
   unless ids collide, which they shouldn't), but it is a latent cross-day revenue misallocation and the last
   remaining real divergence between the two `executeRestoreItem`s.
5. **[rules, ZoeKeyGen] `license_keys` is world-readable at the parent node**, so an unauthenticated
   `GET /license_keys.json` dumps every key id + `expiresAt` + `revoked` for every client. `checkOnline()` only
   ever reads `/license_keys/{appCode}/{keyId}.json`, so moving `.read: true` down to `$keyId` and granting
   admin `.read` at the parent (for `refreshKeyList()`) keeps both working while removing enumeration.
   Note `syncServerTime()` is unaffected — it deliberately ignores the response status and only reads the
   `Date` header. Needs a manual Console publish.
6. **[data integrity] Zoescan's mirror write addresses barcodes by array index.** `assignLockerToEntry()` takes
   `matchedBarcodeIdx` from the *lookup* node and writes
   `zoew_scan_history_cod_dod/{id}/barcodes/{idx}/locker`. If the two nodes desync (which finding 3 above could
   cause), the write lands on the wrong barcode — or, if the index is past the end, creates a sparse array so
   `barcodes` reads back as an **object**, and every `Array.isArray` consumer in ZoeAdmin/ZoeW silently drops
   the parcel's barcodes from the UI, revenue sums and `isClosed` recomputation. Robust fix is to match by
   `code` inside a transaction instead of by index; it touches the hot scan path, so it was not done unasked.
7. **[operational] ZoeKeyGen "Extend" updates only the server `expiresAt`, not the signed payload's `exp`.**
   Already-activated devices keep working (`getStatus` uses the server ceiling), but `activate()` →
   `verifyKeyString()` rejects on the *signed* expiry — so an extended key **cannot be re-activated on a reset
   or replacement device** once the original signed date passes. Design question (extend vs. reissue), flagged
   rather than changed.

### Confirmed clean this round (checked, no change needed — don't re-audit blind)
- `escapeForInlineJsAttr()` in ZoeAdmin/ZoeW is genuinely correct for the `onclick="fn('…')"` context
  (escapes `&` first, so `&#39;`-style entity smuggling can't reconstitute a quote after HTML decoding, and
  backslash before quote). It is **not** the ZoeKeyGen bug class that used plain HTML escaping in an `on*=`
  attribute — that one is still fixed.
- All `onValue(dbRefX, …)` calls in all 3 apps are `if (dbRefX)`-guarded (ZoeAdmin's history/deleted guards are
  just oddly indented, which makes them look unguarded in a quick grep).
- Raw `Date.now()`/`new Date()` audit re-run over all 4 `app.js` + `license-verify.js`: every remaining raw use
  is one of the intentionally-exempt cosmetic/local ones (PIN lockout, id salt, scan debounce, script-load
  deadline, lookup cache TTL/cooldowns, `renderHistory` badges).
- Every Firebase path the apps touch has a matching rules block; all `getElementById` IDs exist; all inline
  handlers and `data-close` targets resolve; Zoescan still has exactly 2 inline `onclick=` and both keep their
  `addEventListener` backups (its CSP still lacks `'unsafe-inline'`); no inline `<script>` blocks in Zoescan.
- `submitManualAdjustment()`'s `submitBtn.disabled = true` with no re-enable **is not a bug** —
  `openManualAdjustModal()` re-enables it on every open. (Looked like a real one at first; verified.)
- Service worker cache-cleanup filters are still each scoped to their own `<app>-` prefix.

### Not yet done as of this handoff
All applied fixes are committed, `node --check`-clean, JSON-validated, comment-free-verified, HTML
tag-balance- and wiring-checked, and the backup tool was executed end-to-end against a stub. Nothing is
mid-edit. No rules file changed, so no manual publish is needed for anything applied this round — items 5
above would need one *if* the user asks for it.

### Follow-up in the same session — per-barcode លុប/ដក marker + all 7 flagged items applied

The user restated the Delete-vs-Remove policy in their own words (confirming it is policy, not a bug),
added the missing business rationale, and then authorised fixing all 7 flagged items "so long as លុប/ដក
behaviour does not change". Two clarifications worth keeping:
- **"បិទ" = "យកហើយ"** — closed means the customer collected the parcel. Count and value stay in the
  daily/monthly stats permanently; the 2-hour auto-cleanup must never move them.
- **The 8-day window exists because an uncollected parcel is physically returned to the central branch.**
  That is why ដក subtracts *both* the money and the package count, and why restoring adds both back.
Windows stay 2h / 8d / 10d exactly as before.

**Per-barcode marker (the new part).** `isFromDeletion` already existed on each barcode, in both Firebase
schemas and in the rules, but was **dead**: only ever written `false` at creation, never set on any លុប
path, and never read. So a barcode inside a deleted (លុប) order read as `false`, i.e. indistinguishable
from a removed (ដក) one. It is now written on every path:
- លុប — `deleteSingleItem`, `clearHistory`, `claimAndCleanupItem` reason `'close'` → each barcode gets
  `isFromDeletion: true`, `isDeducted` untouched (stays `false`; no money moves).
- ដក — `claimAndCleanupItem` partial + whole-abandon, `removeSingleBarcode` → each barcode gets
  `isFromDeletion: false` alongside `isDeducted: true`.
- Restore — `executeRestoreItem` now clears `isFromDeletion` on every restored barcode (it is live again),
  next to the existing `isDeducted` reset.
- The `dbRefHistory` normalizer defaults a missing `isFromDeletion` to `false`, so pre-existing records
  backfill on their next full write.
`isDeducted` remains the *only* field that drives money — the marker is additive and nothing depends on it
for correctness, which matters because trash records already in production do not carry it.
**No Firebase rules change was needed** — `isFromDeletion` is already in both schemas, and every write is
to a brand-new trash record (`!data.exists()`), so the worker-role validate passes.

**Verified by executing the real code**: `scratchpad/policy-test.js` slices the actual
`claimAndCleanupItem` trash-construction block and `executeRestoreItem` revenue block out of both
`app.js` files, runs them in a `vm` context with stubbed helpers, and asserts 27 invariants per app —
លុប→restore→លុប→restore leaves the stats byte-identical; ដក→restore→ដក→restore subtracts and adds back
exactly; partial claims only move the claimed barcodes; legacy items behave symmetrically both ways.
Worth rebuilding in a future round; it is the only executable proof of the policy in the repo.

**The 7 flagged items — all now applied, none changing លុប/ដក semantics:**
1. `toggleCloseStatus`/`toggleIndividualBarcodeClose` now derive the pickup deltas from `previousState`
   (re-read after the blocking `confirm()`) instead of from `desiredClosed` alone, via
   `alreadyInDesiredState`. Closes the stale-dialog race that left a phantom customer refCount.
2. Legacy items with no `barcodes[]` now get their ដក value added back on restore, keyed off the
   item-level marker captured as `restoredWasRemoved` *before* `isFromDeletion` is deleted. Conservative:
   only an explicit `isFromDeletion === false` triggers the add-back, so an ancient record missing the
   field behaves exactly as it does today.
3. `confirmPhone`'s wholesale `dailyRevenueData`/`monthlyRevenueData` snapshot revert removed;
   `addOrUpdateEntry`'s `revertRevenueOnSaveFailure` owns that revert and is object-identity-safe.
   `scanHistory = historySnapshot` stays — nothing else undoes the local item.
4. Resolved as a side effect of hoisting: `executeRestoreItem`'s revenue block is now one shared block
   ahead of the merge/create branches, always keyed on `itemToRestore.scanDate`. **`executeRestoreItem`
   and `claimAndCleanupItem` are now byte-identical across ZoeAdmin and ZoeW** (verified by the differ;
   ZoeW's `restoredResultItem` renamed to ZoeAdmin's `resultingLiveItem`).
5. `ZoeKeyGen/firebase-database.rules.json`: `.read: true` moved down from `license_keys` to
   `license_keys/$appCode/$keyId`, with admin `.read` added at the parent for `refreshKeyList()`.
   `checkOnline()` reads one exact key path so it is unaffected; `syncServerTime()` ignores the response
   status entirely and only reads the `Date` header, so it is unaffected too.
   **This one needs a manual publish in the ZoeKeyGen Firebase Console.**
6. Zoescan's mirror write now also sends `barcodes/{idx}/code`. Because that field is scanner-locked to
   its existing value, Firebase itself rejects the write if the index no longer points at that barcode.
   A full fix (match by code inside a transaction) is **not possible**: a transaction requires read access
   to `zoew_scan_history_cod_dod`, which the scanner role deliberately does not have. Residual gap: an
   index past the end of the array still passes (`!data.exists()`) and creates a sparse entry. A rules
   guard (`barcodes/$idx` must have children `code`/`cod`/`dod`) would close it, but was **not** applied —
   it would permanently reject writes to any production barcode that happens to be missing `cod`/`dod`,
   which cannot be verified from here.
7. ZoeKeyGen's Extend modal now states plainly that extending moves the server ceiling only, and that
   after the key's original signed expiry it can no longer be activated on a new or reset device.
   Behaviour deliberately unchanged (re-signing would produce a different key string).

`CACHE_VERSION` bumped again for all 4 (zoeadmin-v26, zoew-v23, zoescan-v22, zoekeygen-v14).
`ZoeAdmin/README.md`'s Delete-vs-Remove section now documents the per-barcode marker table.

### Newly found this round, reported but NOT applied (needs a rules decision)
**ZoeW's automatic 8-day *partial* claim is rejected by the rules whenever the stale-open barcode is not
last in `barcodes[]`.** `claimAndCleanupItem` writes the compacted remainder, which shifts array indices;
the per-barcode `cod`/`dod`/`isDeducted`/`time`/`createdAt`/`isFromDeletion` validates are all
`admin || !data.exists() || unchanged`, so a shifted index makes an admin-locked field change value under
a `worker` session and the whole transaction is refused. ZoeAdmin (admin role) is unaffected, and the
sweep succeeds whenever an admin opens ZoeAdmin, which is presumably why this has never been noticed.
No declarative rule can express "this is a permutation of the same barcodes", so the options are: relax
those per-barcode locks for `worker`, or accept that partial 8-day cleanup is admin-only. Flagged for the
user rather than decided here.

### #6 fully closed — verified on a live Firebase RTDB emulator
The round-1/round-5 blocker ("emulator unreachable, rules reasoned through by hand") **no longer applies**:
`npm i firebase-tools` works, and the emulator jar runs directly with
`java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1`.
Two gotchas cost several attempts — the CLI's `emulators:start` cannot upload rules through this session's
proxy (use the jar directly), and **both** `.settings/rules.json` and any `auth_variable_override` request
need `-H "Authorization: Bearer owner"`, otherwise rules silently stay wide open and every test bogusly
passes. Always assert that a known-bad write is actually DENIED before trusting a rules test run.

Empirically settled: **a `.validate` on `barcodes/$idx` IS evaluated for a child-only write** (e.g.
`PATCH .../barcodes/9/locker`). So the guard now added to `zoew_scan_history_cod_dod/$itemId/barcodes/$idx`
— `root.child('user_roles').child(auth.uid).val() !== 'scanner' || data.exists()`, i.e. *a scanner may
modify an existing barcode but never create one* — blocks the out-of-range write that would otherwise
create a sparse array and make the whole parcel's `barcodes` read back as an object. Chosen over a
`hasChildren(['code','cod','dod'])` guard specifically because it does not depend on which fields legacy
production barcodes happen to carry. **Needs a manual publish** (root rules file).
Verified 7/7 against the real rules file: valid mirror write allowed, out-of-range denied, wrong-code
denied, legacy item-level locker allowed, admin adding a barcode allowed, worker closing a barcode allowed,
worker restoring a new item allowed.

The same run also **empirically confirmed the partial-claim finding**: a worker rewriting a compacted
`barcodes` remainder (index 0 becomes what used to be index 1) is DENIED. Still unfixed — it needs a
decision on relaxing the per-barcode admin locks for `worker`.

### #6 fully closed — verified on a live Firebase RTDB emulator
The round-1/round-5 blocker ("emulator unreachable, rules reasoned through by hand") **no longer applies**:
`npm i firebase-tools` works, and the emulator jar runs directly with
`java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1`.
Three gotchas cost several attempts and are worth remembering: the CLI's `emulators:start` cannot upload
rules through this session's proxy (run the jar directly); **both** `.settings/rules.json` and any
`auth_variable_override` request need `-H "Authorization: Bearer owner"`, otherwise rules silently stay
wide open and every test bogusly passes; and a stray `pkill -f firebase-database-emulator` matches the
tool's own shell command line and kills the session. Always assert a known-bad write is actually DENIED
before trusting a rules run — that check is what caught both false-pass rounds here.

Empirically settled: **a `.validate` on `barcodes/$idx` IS evaluated for a child-only write** (e.g.
`PATCH .../barcodes/9/locker`). So the guard now added to `zoew_scan_history_cod_dod/$itemId/barcodes/$idx`
— `root.child('user_roles').child(auth.uid).val() !== 'scanner' || data.exists()`, i.e. *a scanner may
modify an existing barcode but never create one* — blocks the out-of-range write that would otherwise
create a sparse array and make the whole parcel's `barcodes` read back as an object, silently dropping it
from every `Array.isArray` consumer. Chosen over a `hasChildren(['code','cod','dod'])` guard specifically
because it does not depend on which fields legacy production barcodes happen to carry.
**Needs a manual publish** (root rules file). Verified 7/7 against the real rules file: valid mirror write
allowed, out-of-range denied, wrong-code denied, legacy item-level locker allowed, admin adding a barcode
allowed, worker closing a barcode allowed, worker restoring a new item allowed.

The same run also **empirically confirmed the partial-claim finding**: a worker rewriting a compacted
`barcodes` remainder (index 0 becomes what used to be index 1) is DENIED by the existing per-barcode admin
locks. Still unfixed — it needs a decision on relaxing those locks for `worker`.
The harness lives at `scratchpad/emu/{real.sh,real.rules.json}`; rebuild it in any future rules round.

## Export: phone/barcode must be TEXT, not numbers (fixed 2026-08-19, branch `claude/export-excel-sheets-issues-afkyyq`)

The user reported the Excel export mangling phone numbers and the Google Sheet export mangling barcodes
(`0977173546` losing its leading zero, `77130525210213` shown as `7.71305E+13`). PDF was confirmed fine by
the user and was deliberately not touched. Export code lives **only in ZoeAdmin** — ZoeW/Zoescan/ZoeKeyGen
have none, so there was nothing to mirror.

**Root cause of the `.xlsx` half, worth remembering:** `XLSX.utils.aoa_to_sheet()` *did* type these cells
correctly as `t: 's'`, so the bug was invisible in the in-memory sheet. But `XLSX.writeFile()` **without
`bookSST: true`** emits string cells as OOXML `t="str"` — which means *"cached string result of a formula"*,
not *"text"*. Excel tolerates it; Google Sheets falls back to reading `<v>` as a number, which is exactly why
only the numeric-looking columns broke while Khmer text and `N/A` survived. Verified by unzipping the
generated file and reading `xl/worksheets/sheet1.xml`. **Do not diagnose this class of bug from the
in-memory cell object — inspect the emitted XML.**

Fix (all in `ZoeAdmin/app.js`):
- `buildExportRows()` coerces `phone`/`barcode` with `String(...)`, defensively, in case an old record ever
  stored either as a number.
- `forceExportTextCells(ws, rowCount)` + `EXPORT_TEXT_COLUMN_INDEXES = [1, 2]` set `t: 's'` and `z: '@'`
  (text number format, `numFmtId="49"`) on the phone/barcode data cells. If a column is ever added or
  reordered in `EXPORT_HEADERS`, update those indexes to match.
- `XLSX.writeFile(..., { bookSST: true })` writes real shared strings (`t="s"`), removing `t="str"` entirely.
  SheetJS also emits `<ignoredErrors numberStoredAsText="1">` on its own, so Excel shows no green
  "number stored as text" triangles.
- CSV path: `sheetsText()` wraps phone/barcode in the `="…"` formula form, the standard way to survive Google
  Sheets' import conversion (and Excel opening the `.csv` directly). It nests correctly inside the existing
  `csvEscape`, which doubles the inner quotes. Empty values stay empty rather than becoming an empty formula.
  Caveat: if the user unticks "Convert text to numbers, dates, and formulas" during Sheets import, the cell
  shows the literal formula text — that setting is on by default.

COD/DOD/total deliberately stay **numeric** in the xlsx so SUM still works; only columns 1 and 2 are forced
to text. Verified by a scratchpad harness (`xlsxtest/verify.js`) that slices the real `EXPORT_HEADERS`,
`forceExportTextCells`, and `csvEscape`/`sheetsText` blocks out of `ZoeAdmin/app.js` with `vm`, writes a real
`.xlsx`, reads it back, and asserts leading zeros, 15-digit barcodes, empty phones, and numeric COD all
round-trip. (Harness gotcha: a top-level `const` inside `vm.runInContext` is *not* exposed on the context
object — function declarations are. Re-export it explicitly or the test silently reads shifted rows.)

`CACHE_VERSION` bumped (zoeadmin-v34). No Firebase rules change, so nothing new needs a manual publish.

## Follow-up session (2026-08-19, branch `claude/deep-audit-bug-fixes-90pmhb`) — handoff notes

Not a new audit round. The user asked to read the START HERE block, then to "fix whatever is still not
done". Branch fast-forwarded from `claude/deep-audit-bug-fixes-7f6izx` (so it contains all of round 6),
plus the two commits below. Round 6's own findings were spot-checked in the code rather than trusted from
these notes — all 7 of the items it says it applied are genuinely applied (`alreadyInDesiredState`,
`restoredWasRemoved`, the removed `confirmPhone` snapshot revert, `executeRestoreItem`/
`claimAndCleanupItem`/`restoreClaimedItemToScanHistory`/`toggleCloseStatus` byte-identical across
ZoeAdmin/ZoeW per `audit-tools/extract.js`, the `license_keys/$appCode/$keyId` `.read` move, the
`barcodes/{idx}/code` mirror field, and the Extend modal's signed-expiry warning).

### The four low-priority items round 5 listed and never applied — all now applied
- **QR Setup Link scanner showed one generic "check camera permission" toast for every failure** in all
  3 business apps. Round 5 flagged this as misleading specifically because it also fires when the real
  cause is the dual-stream refusal it added in the same round. Added `describeCameraError(err)` (denied /
  no camera / in use by another app / overconstrained / non-HTTPS / unknown), identical in ZoeAdmin, ZoeW
  and Zoescan. Zoescan's main-scanner catch now also reports *unrecognised* `getUserMedia` error names to
  Sentry instead of silently showing a generic string for them.
- **No in-app-browser warning before opening the QR scanner**, unlike Zoescan's main barcode scanner which
  already warned proactively. Added `isInAppBrowser()` (same UA test, now shared) and a warning toast in
  all 3 apps' `openConfigQrScanner()`. Zoescan's main scanner now calls the same helper instead of its own
  inline copy of the regex.
- **ZoeKeyGen `persistSigningKeyForSession()` could no-op with zero feedback.** Root cause is one level up
  from where round 5 pointed: `deriveSigningKeySessionKey()` swallows its own exception and **returns
  null**, so `saveNewSecurityPin()`/`verifySecurityPin()` proceed normally, show "PIN saved", and then call
  `persistSigningKeyForSession()`, whose `!signingKeySessionKey` guard returns silently. The user ticked
  "remember this key", got a success toast, and nothing was remembered. Both that guard and the
  `encrypt`/`sessionStorage` catch now clear the `rememberSigningKeyCheckbox` and say so; the catch also
  captures to Sentry. Deliberately still fails closed — nothing is ever stored unencrypted.
- **Zoescan wrote `lockerUpdatedBy` as `null`** when `currentUserEmail` was empty, in the lookup
  transaction, the local entry, and the scan-history mirror. A null in a multi-path update *deletes* the
  child (`.validate` is skipped for deletes, so this was never a rules rejection — the round-5 note's
  guess about that was wrong), silently dropping who last set the locker. Now the field is simply omitted
  when there is no email, matching what `buildScannerLookupPayload()` in ZoeAdmin/ZoeW already did.

`CACHE_VERSION` bumped for all 4 (zoeadmin-v27, zoew-v24, zoescan-v23, zoekeygen-v15).

### The one open decision — resolved: worker may now rewrite a compacted `barcodes[]`
Round 6 left this for the user: ZoeW's automatic 8-day *partial* claim is rejected whenever compacting
`barcodes[]` shifts indices, because the per-barcode `cod`/`dod`/`isDeducted`/`isFromDeletion`/`time`/
`createdAt` validates read `admin || !data.exists() || unchanged`. Presented as three options (accept
admin-only and stop the retry noise / relax the locks for `worker` / delete-then-recreate the node in two
writes, which works under the current rules because `.validate` is skipped on a delete and `!data.exists()`
holds on the recreate). **The user chose relaxing the locks**, and made the argument that settled it:
*ZoeW has no UI that sets a barcode's `cod`/`dod` at all.* Verified — every `cod`/`dod` write in
`ZoeW/app.js` is a recomputed sum, a normalizer reading the existing value, or the legacy-shape migration
that builds `barcodes[]` from the item's own existing values; `openEditBarcodePriceModal`/
`saveEditedBarcodePrice`/`removeSingleBarcode` are ZoeAdmin-only.

Also found while weighing it, and worth remembering because it changes how much these per-barcode locks
were ever worth: **`zoew_daily_revenue_cod_dod` and `zoew_monthly_revenue_cod_dod` accept arbitrary
worker-written absolute values** (`.validate` is only `isNumber() && >= 0`) — the "explicitly NOT fixed"
item from the very first audit round. A malicious worker could already rewrite the day's revenue total
directly, so the per-barcode lock was never the boundary it looked like; it protects the source records
(the evidence trail), not the totals. The **trash node's** money locks (`zoew_recently_deleted_cod_dod`)
were deliberately left admin-only — that is where the restore add-back value is read from.

So the six fields now use `!== 'scanner'` instead of `=== 'admin'`, matching how `code`/`isClosed` in the
same block already treat a worker. **No app code changed** — `claimAndCleanupItem` was always correct;
only the rules refused it. `restoreClaimedItemToScanHistory` and `executeRestoreItem`'s merge branch both
*append* to `barcodes[]`, so existing indices keep their values and neither was ever affected.

**Verified on a live RTDB emulator against the real rules file**, not reasoned through by hand — new
suite `audit-tools/emu/partial-claim.sh`, 9/9:
- allowed: the compacted-remainder write (index 0 going from AAA to BBB), and creating the matching trash record
- still denied: scanner changing a barcode's `cod`, scanner changing an existing `code`, scanner creating
  a barcode out of range, worker rewriting an *existing* trash barcode's `cod`, worker rewriting the trash
  item-level `cod`, and an unauthenticated write
- asserted explicitly as the accepted cost: a worker *can* now edit a live barcode's `cod` directly
Re-ran the existing `real.sh` suite too (8/8). Confirmed the **previous** rules denied the same compacted
write, so the relaxation is provably what fixes it.

Two emulator gotchas beyond the three round 6 documented: `~/.cache/firebase/emulators/` is empty after a
plain `npm i firebase-tools` — run `firebase setup:emulators:database` to fetch the jar. And a request
carrying `-H "Authorization: Bearer owner"` *without* an `auth_variable_override` is treated as the project
owner and **bypasses rules entirely**, so an "unauthenticated write is denied" test written that way is a
false pass; send no Authorization header at all for that case.

**`firebase-database.rules.json` (root) needs a manual publish** in each business's Firebase Console —
same as it already did for round 6's scanner guard, which is still unpublished. No app-code change came
with this one, so no `CACHE_VERSION` bump for it.

### Round 3's open product decision — resolved: keep the wipe, stop it being silent
Round 3 flagged, and deliberately did not decide, that an involuntary logout silently destroys a
freshly-generated, not-yet-copied signing keypair. The user asked for a recommendation and then approved
it on the condition that it not weaken security. **The wipe itself is unchanged and still
unconditional** — `closeModal('keypairModal')` blanks `newPrivateKeyOutput` on every path, including the
bulk modal-close inside `showLoginModalWithPrefill()`, so no auth-null transition can leave a private
signing key in the DOM. Nothing was added that can cancel that.

What changed is only that the loss is now visible and, on deliberate paths, preventable:
- `keypairPrivateCopied` is set by `copyTextarea('newPrivateKeyOutput')` (both the clipboard-API and the
  `execCommand` fallback path, so a fallback copy counts too) and reset by `generateNewKeypair()` and by
  `showLoginModalWithPrefill()`. `hasUncopiedKeypair()` additionally requires the modal to be `active`
  and the textarea to be non-empty, so it can never fire on a fresh page load.
- The modal's "បិទ" button now calls a new `dismissKeypairModal()` that confirms first when the key is
  uncopied. The confirm is deliberately **not** inside `closeModal()`: a blocking prompt on the
  forced-logout path would be wrong, and letting it be cancelled would weaken the wipe.
  **CORRECTION (round 7):** this note originally claimed the "បិទ" button was the *only* deliberate
  dismiss path and that "ZoeKeyGen has no backdrop-click or Escape handling at all". The Escape half is
  right; the backdrop half was **wrong** — `DOMContentLoaded` attaches a `mousedown` handler to every
  `.modal` (the round 2 note was accurate). It called `closeModal(modal.id)` directly, so a backdrop
  click wiped an uncopied private signing key with no confirmation, which is exactly what
  `dismissKeypairModal()` exists to prevent. Fixed in round 7 by giving `keypairModal` a
  `data-close="dismissKeypairModal"` and making that handler honour it, matching the 3 business apps.
  Lesson: verify a "this app has no X" claim against the code before writing it into a handoff note —
  it survived two rounds unchallenged.
- `logoutApp()` confirms before signing out when a key is uncopied. Aborting a user-initiated logout is
  the user's own choice, so this changes no security boundary.
- Any involuntary path (role-check failure/timeout, auth session lost) still wipes with no prompt, but
  now raises a distinct `alert()` naming what was lost and why, fired after the login modal is shown. The
  pre-existing "បានសម្អាត Signing Key ចេញពីសតិ" toast is about the *loaded* key, which is why the loss
  used to read as unexplained.
- `kickUserOut()` (the devtools guard) is untouched and uncoverable by design — it replaces the document
  with `about:blank`, which destroys the key correctly and leaves nowhere to show a message.

Worth knowing if this comes up again: losing the key is costly but not unrecoverable. The generated pair
is not deployed yet, so regenerating costs nothing — unless the **public** half was already pasted into
all 4 apps' `license-verify.js` and shipped, in which case the re-deploy has to be redone. Previously
issued keys keep verifying either way, since `PUBLIC_KEYS_JWK` is an array.

`CACHE_VERSION` bumped to zoekeygen-v16.

### Call-mark feature work (asked for after the audit items were closed)
The user asked to check the phone call-marking and the "call again after 4 hours" prompt in ZoeAdmin and
ZoeW. `handleCallAction`, `openCallMarkModal`, `setCallMark` and `renderHistory` are byte-identical across
the two apps, and the recall logic itself was already written correctly — but two things made it unreliable:

- **Nothing ever woke it up.** `needsRecall` is computed only inside `renderHistory`, and `renderHistory`
  only runs on a data change or a filter/search change. There is no timer, and neither app's
  `visibilitychange` handler re-renders. On a busy day the live listener fires often enough that the
  highlight looked like it worked; on a quiet stretch, or with the app left open, it could be hours late.
  Added `sweepRecallHighlights()` (60s interval + on return to the foreground): it builds a signature of
  the ids whose 4 hours are up and re-renders only when that set changes, so an unchanged list costs one
  cheap loop a minute and no DOM work. It re-renders via `refreshCurrentHistoryView()`, which re-runs
  `searchByPhone()` when a phone search is active — a bare `applyCurrentFilter()` on a timer would have
  silently wiped the worker's search results every minute.
- **Mixed clocks.** `callMarkTime` is written with `getServerNow()` but `renderHistory` compared it against
  `Date.now()`, so a device clock off by N hours moved the reminder by N hours. Both now use
  `getServerNow()`, which was already in scope there. (This is the `renderHistory` raw-`Date.now()` use
  that round 5 listed as cosmetic — it stops being cosmetic once the 4-hour prompt is relied on.)

The blinking green/red recall style is **deliberately unchanged** — the user was asked and chose to keep it.

Also added, per the user: a row marked `wrong-number` shows an **edit-phone button in place of** the call
button (explicitly not in addition to it — the row must keep the same three controls so it does not
overflow a phone screen). `saveEditedPhone()` clears the `wrong-number` mark and resets `isCalled` when the
number actually changed, so the row returns to a fresh green call button; the mark, the time and `isCalled`
travel in the same `patchHistoryItemFields` call as the phone, so a failed write reverts all of it
together. Saving an unchanged number keeps the mark, since nothing was corrected. New `.fix-phone-btn`
style reuses the purple the `row-num-wrong-number` label already uses.

**Then decided by the user and applied:** `handleCallAction()` now also restarts the 4-hour clock
(`callMarkTime = getServerNow()`) when the item carries a `no-answer`/`no-connect` mark. The user's rule,
in their words: after calling again the button goes back to the normal colour, **the mark itself is not
deleted** so the row stays easy to recognise, and 4 hours later it blinks again. `callMark` is deliberately
untouched, so the row-number label keeps reading "ខល អត់លើក"/"ខល អត់ចូល" — only the timer moves. Both
fields travel in one `patchHistoryItemFields` call, so a failed write reverts them together. The re-render
is deferred with `setTimeout(..., 0)` on purpose: `handleCallAction` is the `onclick` of an
`<a href="tel:">`, and replacing the row's `innerHTML` synchronously inside that handler would tear out the
anchor before the browser follows the link. Marking again still restarts the clock too — `setCallMark`
rewrites `callMarkTime` unconditionally, including when the same mark is re-selected.

**Then also asked for:** closing a parcel now clears the call mark outright. The user's reasoning is that
a collected parcel means the customer was reached, so the mark is stale the moment it is closed. Applied in
both explicit toggle paths — `toggleCloseStatus` (whole order) and `toggleIndividualBarcodeClose` (a single
barcode, which the user asked for explicitly: any collected barcode clears that phone's mark) — in the
local optimistic update, in the `runTransaction` body, and restored in the failure revert, all four guarded
by `if (desiredClosed)` so reopening never clears anything. Reopening does not bring the mark back; it is
gone for good, which is what "សម្អាតដោយស្វ័យប្រវត្តិ" asks for. This also removes the "closed row keeps
blinking" case noted earlier, since there is no longer a mark to blink on. `claimAndCleanupItem`'s
automatic 2h/8d sweep is deliberately untouched, matching how pickup-stat crediting is scoped to the
explicit toggles only — those items are moving to trash anyway.

`CACHE_VERSION` bumped (zoeadmin-v32, zoew-v29).

### Two mechanisms from that work, refined on request
- **The bare `setTimeout(refreshCurrentHistoryView, 0)` in `handleCallAction` became
  `scheduleHistoryViewRefresh()`.** The deferral itself is load-bearing and stays — `handleCallAction` is
  the `onclick` of an `<a href="tel:">`, so re-rendering synchronously would tear the anchor out before the
  browser opens the dialer. What changed is that a named function documents that in a codebase that bans
  comments, and it now coalesces: a second call in the same tick is dropped, so a burst renders once.
- **`patchHistoryItemFields`'s failure revert re-rendered with `applyCurrentFilter()`**, which silently
  discarded an active phone search — at the worst possible moment, since the worker had just hit a save
  error and would lose the row they were looking at. It now uses `refreshCurrentHistoryView()`, which
  re-runs `searchByPhone()` when a search is active. `setCallMark` got the same change.

`saveEditedPhone` deliberately goes the other way, on the user's call: after a successful edit it **clears
the search box and calls `applyCurrentFilter()`**, so the view returns to the full day list. Keeping the
search would have hidden the row the worker just edited, since the new number no longer matches the old
query. The box is cleared rather than left populated so the state stays coherent — otherwise the next
background refresh (the 60s recall sweep, a Firebase update) would flip the table back to search results.
Its *failure* path still goes through the revert above and keeps the search, which is right: the write
failed, the old number is back, and it still matches the query. `saveEditedPhone` is now byte-identical
across the two apps (one leftover brace-style difference was aligned while editing it).

**Then finished, on the user's instruction** (they also confirmed they are currently the only person using
the system, so the propose-first caution does not apply for now): all the remaining `applyCurrentFilter()`
call sites were classified and 28 of them converted (19 ZoeAdmin, 9 ZoeW). The rule applied was **a repaint
caused by data changing preserves the current view; a repaint the user asked for by changing view does
not.** 12 sites keep `applyCurrentFilter()` on purpose: `filterDataByDate`, `filterDataByCustomDate`,
`searchByPhone`'s empty-query branch, `refreshCurrentHistoryView`'s own else branch, `setupAuthListener`
(fresh session) and `saveEditedPhone` (clears the box deliberately, see above).

The biggest one by far was **`debouncedRenderAfterHistorySync`** — the Firebase history listener's repaint,
which fires on every change from any device. A worker with a phone search open had it wiped every time
anyone anywhere scanned a parcel.

### Not yet done as of this handoff
Nothing is mid-edit. Every commit is `node --check`-clean on every modified `.js`, JSON-validated on the
rules file, comment-free-verified on every changed line, tag-balance- and wiring-checked on the one
modified `.html`, and the rules change is emulator-verified. The only outstanding work is the two manual
Console publishes listed in START HERE.

## Seventh deep-audit pass (2026-08-19, branch `claude/deep-audit-bug-fixes-lubg8l`) — handoff notes

Requested as another final round: the user was still not satisfied because *every previous round kept
finding new bugs*, and asked for a thorough, gap-free sweep plus a README tidy-up. Branch started exactly
at `main` (commit `cec65e9`, i.e. right after PR #19 merged). Run inline and single-threaded again (no subagents), reading all
four `app.js` end to end plus every rules file, HTML, `netlify.toml`, `sw.js`, `license-verify.js`,
`error-reporting.js`, `firebase-backup/backup.js` and the Apps Script template.

### The method change that mattered most this round
Round 6's differ only compares **ZoeAdmin ↔ ZoeW**, so a helper that is meant to be a single
implementation can drift in **Zoescan or ZoeKeyGen** and nobody sees it. New tool
**`audit-tools/shared-fns.js`** diffs every function shared by three or more apps and reports only those
not on a documented `EXPECTED_DIVERGENT` allowlist. Run against the pre-round code it flags exactly two,
both real (see below). **Run it alongside `extract.js` at the start of every future round.**

### Fixed
- **[HIGHEST IMPACT] Zoescan's locker-occupancy warning has never actually skipped a collected parcel.**
  `findLockerOccupant()` calls `isEntryBarcodeClosed()` to exempt an occupant the customer already picked
  up — the behaviour the user explicitly asked for when the feature was built in round 1, and which
  `Zoescan/README.md` has always claimed. That check **could never be true**: it reads `isClosed` off
  `zoew_scanner_lookup`, and neither `buildScannerLookupPayload()` ever wrote the field nor did the rules
  schema permit it (`$other: { ".validate": false }` at both the item and barcode level). So for the
  ~2 hours between a pickup and the 2h sweep clearing the lookup entry, **re-using that locker popped a
  blocking "this locker already has a package" modal every time** — the everyday case in a busy shop, and
  the kind of false alarm that trains staff to click through the real warnings too. Fixed in three parts:
  the rules now allow `isClosed` on `zoew_scanner_lookup/$itemId` and `.../barcodes/$idx` (scanner-locked
  to its existing value, same shape as the sibling fields); `buildScannerLookupPayload()` carries the
  item-level and per-barcode closed state; and `toggleCloseStatus()`/`toggleIndividualBarcodeClose()` sync
  the lookup entry **from the committed transaction snapshot** so the state actually propagates on pickup
  and reopen. `syncScannerLookupEntry()` retries once with the field stripped, so **deploy order does not
  matter** — shipping the code before the rules are published degrades to today's behaviour instead of
  rejecting the whole write (proven on the emulator against the old rules file).
- **[revenue] ZoeAdmin `saveEditedBarcodePrice()` had no failure compensation at all** — the one
  revenue-moving path in the codebase that never got the treatment. It applied
  `addRevenueToDailyAndMonthlyRecord(...)` optimistically and then called
  `saveSingleHistoryItemToFirebase(item)` bare: no `.catch`, no revert, and (since that helper rethrows)
  an unhandled rejection on top. A failed write left the daily *and* monthly totals moved while the
  barcode's own `cod`/`dod` never persisted — a permanent, silent divergence between the revenue nodes and
  the records they are supposed to sum. Now reverses the exact delta, restores the barcode from its
  captured old values, recomputes the item aggregate from `barcodes[]` (rather than a stale snapshot, so a
  concurrent listener refresh can't be clobbered), re-renders and re-opens the barcode list if it is still
  on screen. ZoeAdmin-only — ZoeW has no barcode-price editing.
- **[ZoeKeyGen, security] A backdrop click on the keypair modal destroyed an uncopied private signing key
  with no confirmation.** `DOMContentLoaded` attaches a `mousedown` handler to every `.modal` that called
  `closeModal(modal.id)` directly, bypassing `dismissKeypairModal()`'s guard entirely — so the *deliberate*
  dismiss path the round-6 follow-up built a confirm for could still be reached silently. The handler now
  honours `data-close`, and `keypairModal` carries `data-close="dismissKeypairModal"`. (See the CORRECTION
  note in the round-6 follow-up section — the claim that ZoeKeyGen has no backdrop handler was wrong.)
- **[Zoescan] `waitForFirebaseSDK()` was the odd one out of four** (found by the new differ): it never
  removed its `firebasesdkready` listener on timeout, and — unlike the other three — did not re-check
  `window.firebaseSDK` before rejecting, so an SDK that arrived a moment after the 15s deadline left
  Zoescan stuck on its boot-error screen where the others recover. Aligned to the shared shape. Round 2's
  note says this helper was fixed "in all 4"; only the Error-construction half was.
- **[Zoescan] A PIN lockout left a Setup Link armed with no way to cancel it.**
  `requestPinBeforeConfig()`'s lockout branch returns **without opening any modal**, so neither
  `cancelPinSetupFlow()` nor `cancelPinEntryFlow()` (round 6's fix for exactly this hazard) can ever fire —
  `pendingSetupLinkConfig` stayed set indefinitely and the next Config open silently pre-filled a different
  business's Firebase config. Both it and `pinTargetAction` are now cleared on that path.
- **[Zoescan] `saveNewSecurityPin()`/`verifySecurityPin()` had no guard around WebCrypto**, unlike the
  other three apps — a `crypto.subtle` failure did nothing at all, with no message. Both now report and
  capture.
- **[ZoeKeyGen] `logoutApp()`'s `signOut().then()` had no `.catch()`** — an offline logout left the UI
  signed in and raised an unhandled rejection. Now runs the same cleanup on both paths, like the 3
  business apps.
- **`patchHistoryItemFields()` resolves `false` instead of rejecting** on its unsafe-id guard (both apps),
  matching its write-failure path, so the three bare call sites (`handleCallAction`, `setCallMark` ×2)
  can't produce an unhandled rejection.
- Small: leftover blank line in ZoeKeyGen's `withTimeout` (old comment-strip cruft).
- `CACHE_VERSION` bumped once in all four (zoeadmin-v35, zoew-v31, zoescan-v24, zoekeygen-v17). Only one
  bump this round on purpose — nothing from this branch has been deployed, so a second bump would be noise.

### New tests (rebuild these in future rounds — they are executable proof, not prose)
- `audit-tools/shared-fns.js` — 4-way helper differ, described above. Exits 1 on unexpected drift.
- `audit-tools/lookup-closed-test.js` — slices the real `buildScannerLookupPayload` (ZoeAdmin) and
  `buildBarcodeIndex`/`isEntryBarcodeClosed`/`findLockerOccupant` (Zoescan) into a `vm` and asserts 13
  invariants: the payload carries the closed state, Zoescan reads it back for both the `barcodes[]` and
  legacy shapes, a collected parcel's locker is not reported occupied, an uncollected one still is, a
  sibling barcode of the same order is still exempt, and the stripped fallback degrades rather than
  breaking the index. **6 of the 13 fail against the pre-round code** — checked, so it is not vacuous.
- `audit-tools/emu/scanner-lookup-closed.sh` — 10/10 against the real rules on a live RTDB emulator, and
  it asserts the known-bad writes (scanner flipping `isClosed`, a string instead of a boolean, an unknown
  field, an unauthenticated write) are actually DENIED before any pass is trusted. Also confirmed the
  **previously published** rules reject the `isClosed` write and accept the stripped fallback — which is
  what makes the deploy order safe. Re-ran `real.sh` (8/8) and `partial-claim.sh` (9/9): no regressions.

### Confirmed clean this round (checked, no change needed — don't re-audit blind)
- Every field the apps write to `zoew_scan_history_cod_dod` and `zoew_recently_deleted_cod_dod` is in the
  rules schema, in both directions; `executeRestoreItem` correctly deletes `deletedAt`/`isFromDeletion`
  before writing back to scan history (they are not in that schema).
- No duplicate HTML `id=` in any of the four apps. Every function referenced from inline `on*=` in HTML
  **and** from `app.js`-generated HTML strings, plus every `data-close` target, resolves to a genuine
  top-level (global) function — verified by parsing rather than grepping.
- `loginModal` and `activationModal` carry `data-nodismiss` in all three business apps.
- The Apps Script template's `key=` query-parameter auth vs. the app's HTTP-header secret is **not** a
  mismatch — `google-sheets-api/README.md` documents the Google restriction and says to leave the header
  fields empty. `buildCustomerListApiUrl()` rewrites both URL orderings correctly.
- Service-worker cache-cleanup filters are still each scoped to their own `<app>-` prefix, and no prefix
  is a prefix of another.
- `license-verify.js` still byte-identical across all four (`md5sum` = one value); 0 comments and 0
  trailing whitespace across all 8 `app.js`/`license-verify.js` files (acorn, not regex).
- `firebase-backup/backup.js` re-read: the round-6 `.partial`+rename, `keepCount` and `name` validation
  are all correct, and the prune sort is chronological because the ISO timestamp sorts lexically.

### Known-but-not-fixed (deliberate, carried forward)
- Existing `zoew_scanner_lookup` entries in production gain `isClosed` only when their parcel is next
  touched (closed, reopened, restored, phone-edited, or via ZoeAdmin's "🔄 កំណត់ទិន្នន័យ Scanner Lookup
  ឡើងវិញ"). Already-closed entries age out within 2 hours anyway, so no migration was written.
- `executeRestoreItem`'s merge branch pushes restored barcodes without deduplicating by `code`
  (`restoreClaimedItemToScanHistory` does). Only reachable if a trash item's id collides with a live
  scan-history id, which the id generator makes implausible. Left alone rather than widening a
  revenue-adjacent function for a case that cannot currently occur.
- Everything the earlier rounds listed as deliberately accepted still stands: worker-writable
  revenue/pickup totals, no aggregate verification without a trusted backend, and ZoeKeyGen "Extend"
  moving only the server ceiling.

### Not yet done as of this handoff
Nothing is mid-edit. Every commit is `node --check`-clean on every modified `.js`, JSON-validated on the
rules file, comment-free- and whitespace-verified with acorn, div-tag-balance- and wiring-checked on the
modified HTML, and the rules change is emulator-verified against both the new and the previously published
rules. The only outstanding work is the two manual Console publishes listed in START HERE.

**Merged to `main` at the user's explicit request in this session** — PR #20, merge commit `acd5a9f`,
`mergeable_state: clean` with every Netlify check green beforehand. A follow-up doc-only PR #21
(`6d67c83`) corrected the START HERE block afterwards.

**CORRECTION 2026-08-19 — a claim this round got wrong.** The START HERE block written earlier in this
same session warned that `claude/deep-audit-bug-fixes-90pmhb` was "still unmerged". **That was false.**
It was inherited verbatim from the previous round's START HERE (true when written) and copied forward
without being checked; PR #18 (`8dab82b`) had merged that branch in the meantime. Verified properly with
`git rev-list --count origin/main..origin/<branch>`, which is 0 for **every** `claude/*` branch. The one
branch that still shows a commit of its own, `claude/zoeadmin-debug-logs-uvqb4l`, holds work that is
already on `main` under a different commit (`4a8e04e`, same title, landed via PR #12) — nothing there is
unique. This is the second time in two rounds that an unverified "state of the world" line in a handoff
note propagated as fact. **Check branch/merge claims with git before writing them down, every time** —
the note is not evidence.

**RESOLVED 2026-08-19 (confirmed by the user): both rules files have been published.** Root
`firebase-database.rules.json` and `ZoeKeyGen/firebase-database.rules.json` are live in their respective
Consoles, so the scanner `$idx` guard, the worker partial-claim relaxation, the `license_keys` read move
and the new `zoew_scanner_lookup` `isClosed` field are all in effect. **Nothing from rounds 6 or 7 is
outstanding any more.** This could not be verified from the session itself — the network policy rejects
`*.firebaseio.com` and every business node needs auth — so it rests on the user's confirmation; the
practical check is to scan a parcel into a just-emptied locker in Zoescan and see no warning.

## ZoeAdmin: បិទ App រួចបើកវិញ ➜ "ក្រៅបណ្ដាញ" ➜ login មិនចូល (fixed 2026-08-20, branch `claude/zoeadmin-login-offline-6ktcqp`)

អ្នកប្រើស្កេនអីវ៉ាន់ ១-២ រួចបិទ App ហើយបើកវិញ។ ទទួលបានដុំ "ក្រៅបណ្ដាញ" ➜ ប្រអប់ login ➜ វាយ
ពាក្យសម្ងាត់ ➜ **គ្មានអ្វីកើតឡើងសោះ** ➜ ប្រហែល ១០ វិនាទីក្រោយមក toast
"⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិចូលប្រព័ន្ធបានទេ!" ហើយត្រូវបានបណ្ដេញចេញ។ Sentry បង្ហាញ
`Error: Role check timed out`។ **នេះជាកំហុសកូដ ២ យ៉ាងជាន់គ្នា មិនមែនគ្រាន់តែបណ្ដាញយឺតទេ។**

### មូលហេតុទី ១ — `onAuthStateChanged` **មិនបាញ់ទេ** ពេលចូលដោយគណនីដដែល
នេះជាចំណុចសំខាន់បំផុត ហើយងាយនឹងភ្លេច។ `AuthImpl.notifyAuthListeners()` ក្នុង
`@firebase/auth@1.13.4` (ជាកំណែក្នុង `firebase@12.17.1` ដែល `firebase-loader.js` load ពី gstatic)
មាន dedup តាម uid៖

```js
notifyAuthListeners() {
    if (!this._isInitialized) return;
    this.idTokenSubscription.next(this.currentUser);
    const currentUid = this.currentUser?.uid ?? null;
    if (this.lastNotifiedUid !== currentUid) {      // ⬅ dedup
        this.lastNotifiedUid = currentUid;
        this.authStateSubscription.next(this.currentUser);
    }
}
```

ហើយ `_initializeWithPersistence()` កំណត់ `lastNotifiedUid` ភ្លាមៗក្រោយស្ដារ session ចាស់ —
**មុន** listener ណាមួយចុះឈ្មោះផង។ ដូច្នេះ បើអ្នកប្រើនៅ sign-in ជាមួយ uid X ស្រាប់ ហើយ
`signInWithEmailAndPassword` ជាមួយ X ម្ដងទៀត ➜ **គ្មាន callback ទេ**។ (`onIdTokenChanged` បាញ់
ចុះ តែ `firebase-loader.js` មិន export វាសោះ។)

កូដទាំង ៤ App ដាក់ការងារ "ចូលបានហើយ" **ទាំងស្រុង** ក្នុង `onAuthStateChanged` — `loginWithFirebase`
ត្រឹមតែរក្សា `remembered_email` ប៉ុណ្ណោះ។ ដូច្នេះការចុច "ចូលប្រព័ន្ធ" ជោគជ័យ (Firebase ឆ្លើយ 200)
ប៉ុន្តែ **App មិនដឹងអ្វីទាំងអស់**៖ ប្រអប់មិនបិទ គ្មាន toast គ្មាន listener។ = "login fail"។

### មូលហេតុទី ២ — role check ដែលអស់ពេល **បណ្ដេញអ្នកប្រើចេញ** ដោយគ្មានឱកាសសង្គ្រោះ
RTDB `get()` **គ្មាន timeout ខាងក្នុងទេ** — `PersistentConnection.get()` ដាក់ចូល
`outstandingGets_` រួចរង់ចាំរហូតដល់ភ្ជាប់បាន (បញ្ជាក់ក្នុង `@firebase/database@1.1.4`)។
ពេលបើក App ថ្មីលើបណ្ដាញ 4G យឺត WebSocket ទៅ RTDB មិនទាន់ភ្ជាប់ ➜ `fb.get('user_roles/<uid>')`
ព្យួរ ➜ `withTimeout(..., 15000)` បោះកំហុស ➜ កូដចាស់ធ្វើ `signOut()` + លុប session។
ដុំ "ក្រៅបណ្ដាញ" ជា `.info/connected` ដដែល — សញ្ញាតែមួយបញ្ជាក់ថា socket មិនទាន់ឡើង។

Timeline ពិតពី Sentry (ផ្ទៀងផ្ទាត់ហើយ)៖ session ស្ដារនៅ 03:26:47.767 ➜ role check ចាប់ផ្ដើម ➜
អ្នកប្រើចុច login ដោយខ្លួនឯងនៅ 03:26:52.684 (ជោគជ័យ តែស្ងាត់) ➜ 03:27:02.826 គឺ **15.06 វិនាទី
ក្រោយការស្ដារ session** — ដូច្នេះ role check ដែលអស់ពេលនោះជា **របស់ការ boot ដើម** មិនមែនរបស់
ការ login ដោយដៃទេ។ វាបានបណ្ដេញអ្នកប្រើដែលទើបតែចូលបានជោគជ័យ។

### អ្វីដែលបានកែ (ទាំង ៤ App)
- **`loginWithFirebase`/`doLogin` លែងពឹងលើ `onAuthStateChanged` ទៀត**៖ ចាប់ `generationAtLogin =
  authGeneration` មុន sign-in ហើយបើក្រោយ sign-in ជោគជ័យ generation **មិនប្រែ** (= callback មិន
  បាញ់) នោះវាហៅ `verify*RoleThenProceed(cred.user, ++authGeneration)` ដោយខ្លួនឯង។ ពេល uid
  **ប្រែ** មែន callback បាញ់មុន promise resolve ដូច្នេះ generation ប្រែ ➜ រំលង ➜ **គ្មានការ
  ត្រួតពិនិត្យស្ទួន**។
- **`retryPendingRoleCheck()` ថ្មី + ទង់ `pendingRoleRecheck`**៖ ពេល role check អស់ពេល
  (`e.message === 'Role check timed out'` ប៉ុណ្ណោះ) វា **លែង `signOut()` ទៀត** — រក្សា session
  ទុក បង្ហាញប្រអប់ login និង toast ថានឹងព្យាយាមម្ដងទៀត។ បន្ទាប់មក handler `.info/connected`
  ដែលមានស្រាប់ (និង `visibilitychange` ក្នុង ៣ App ដែលមាន) ហៅ `retryPendingRoleCheck()`
  ➜ **App ស្ដារឡើងវិញដោយស្វ័យប្រវត្តិ ដោយអ្នកប្រើមិនបាច់វាយពាក្យសម្ងាត់សោះ**។
- **កំហុសពិត នៅតែ fail closed ដដែល**៖ `permission_denied` ឬ role ខុស ➜ `signOut()` ដដែល។
  ការសម្រេចមិន `signOut()` ប៉ះតែផ្លូវ timeout ប៉ុណ្ណោះ ហើយវាមិនបន្ធូរសុវត្ថិភាពទេ — ព្រំដែនពិត
  គឺ RTDB rules មិនមែនការ `signOut()` ទេ ហើយកូដនៅតែមិនបើក listener រហូតដល់ role ត្រូវបានបញ្ជាក់។
- **ZoeKeyGen ទទួល `authGeneration` ជាលើកដំបូង** (៣ App ទៀតមានស្រាប់) — មុននេះ role check ចាស់
  ដែលអស់ពេល គ្មានអ្វីលុបចោលវាបានទេ។ វាក៏ទទួល handler `visibilitychange` ជាលើកដំបូងដែរ
  (មុននេះមានតែ handler របស់ service-worker update ក្នុង IIFE ខាងលើ) ដូច្នេះទាំង ៤ App ស្ដារ
  ដូចគ្នាទាំង ២ ផ្លូវ៖ `.info/connected` និងការត្រឡប់មកមុខវិញ។

### តេស្ត — `audit-tools/auth-recovery-test.js` (ថ្មី) — គ្របទាំង ៤ App
ដក `withTimeout`, `retryPendingRoleCheck`, `verify*RoleThenProceed`, `setupAuthListener` និង
`loginWithFirebase`/`doLogin` **ពិត** ចេញពី `app.js` **ទាំង ៤** ដាក់ក្នុង `vm` ជាមួយ fake
Firebase ដែល `onAuthStateChanged` ចម្លង dedup `lastNotifiedUid` ពិត និង fake clock សម្រាប់រំកិល
15 វិនាទី។ **70/70 ជោគជ័យ**។

Zoescan ដាក់ callback `onAuthStateChanged` របស់វា **ខាងក្នុង `initFirebase`** ដូច្នេះដកតាមឈ្មោះ
មិនបាន — harness ចុះឈ្មោះ callback ជំនួសមួយ ហើយ **assert លើ source ពិត** ថារូបរាងនៅដដែល
(`authGeneration++` ➜ `verifyRoleThenProceed(user, myAuthGeneration)` និងការសម្អាតទង់ពេល
sign-out)។ បើ Zoescan ប្តូរ listener នោះថ្ងៃណា តេស្តនឹងបរាជ័យ មិនស្ងាត់ទេ។

**មិនមែនតេស្តទទេទេ — បានផ្ទៀងផ្ទាត់៖** រត់វាលើ tree **មុនកែ** (`git archive origin/main` គឺ
`8c56254` ចូលថតដាច់ដោយឡែក) ➜ **ធ្លាក់ ៤១/៧០** លើគ្រប់ App រួមទាំង "App ចាប់ផ្ដើមការត្រួតពិនិត្យ
role ថ្មីដោយខ្លួនឯង" និង "ការត្រួតពិនិត្យចាស់ដែលអស់ពេល មិនបណ្ដេញអ្នកប្រើចេញ" — ពោលគឺវាបង្កើត
ឡើងវិញនូវបញ្ហាដែលអ្នកប្រើរាយការណ៍បេះបិទ។ ចំណុច fail-closed ទាំង ៨ (`permission_denied`, role ខុស)
**ជោគជ័យទាំងមុន និងក្រោយ** — ភស្តុតាងថាមិនបានបន្ធូរផ្លូវសុវត្ថិភាព។
*អន្ទាក់៖ ត្រូវ `git archive origin/main` មិនមែន `HEAD` ទេ បើបាន commit ការកែរួចហើយ — បើមិនដូច្នេះ
baseline ផ្ទុកការកែស្រាប់ ហើយចំនួនបរាជ័យតិចជាងការពិត។*

### ការបែកគ្នាថ្មីរវាង ZoeAdmin↔ZoeW (ត្រឹមត្រូវ មិនមែន drift)
`extract.js` ចាប់បាន `loginWithFirebase` និង `retryPendingRoleCheck` ថាបែកគ្នា។ ពិនិត្យហើយ —
**បន្ទាត់តែមួយគត់** គឺឈ្មោះ function ជាក់លាក់តាម App (`verifyAdminRoleThenProceed` ទល់នឹង
`verifyWorkerRoleThenProceed`) ដូច `setupAuthListener` ដែលមានក្នុងបញ្ជីបែកគ្នាស្រាប់។
`retryPendingRoleCheck` ត្រូវបានបន្ថែមចូល `EXPECTED_DIVERGENT` ក្នុង `shared-fns.js`។

### ចំណុចដែលឃើញតាមផ្លូវ តែមិនបានកែ (មិនស្ថិតក្នុងវិសាលភាព)
- `autoLoginAttempted` (ZoeAdmin, ZoeW) ត្រូវបានសរសេរ `false` ២ កន្លែង **តែគ្មានកន្លែងណាអាន** —
  អថេរស្លាប់។
- `zoew_login_time` ក្នុង `localStorage` ត្រូវបាន `removeItem` ប៉ុណ្ណោះ — គ្មានកន្លែងណា `setItem`
  ឬអានទេ។ `clearRememberedSession()` ជាក់ស្តែងធ្វើតែការលុប `remembered_email` ប៉ុណ្ណោះ។
- ផ្លូវ `ensureAppActivated()` អស់ពេល នៅតែគ្មានការព្យាយាមឡើងវិញស្វ័យប្រវត្តិ (វាជា REST ទៅ
  license DB មិនទាក់ទង `.info/connected`)។ ឥឡូវយ៉ាងហោចណាស់ការ login ដោយដៃដំណើរការវិញបាន។

`CACHE_VERSION` bump ទាំង ៤ (zoeadmin-v36, zoew-v32, zoescan-v25, zoekeygen-v18)។

### មូលហេតុទី ៣ (រកឃើញក្រោយ deploy 2026-08-20) — role check ប្រណាំងនឹងការភ្ជាប់ RTDB
ការកែខាងលើដើរពិត (បញ្ជាក់ដោយ stack `app.js:1364` និង toast ថ្មី) តែ role check នៅតែ timeout។
មូលហេតុ៖ `PersistentConnection.establishConnection_()` **await `authTokenProvider_.getToken()`
មុននឹងបើក socket** (មានសរសេរច្បាស់ក្នុង `@firebase/database@1.1.4`) ដូច្នេះ RTDB មិនអាចភ្ជាប់
មុន Firebase Auth ឆ្លើយ។ លើឧបករណ៍អ្នកប្រើ `accounts:lookup` ចំណាយ **១៤.៨៧ វិនាទី** ខណៈ
`withTimeout(..., 15000)` រត់ស្របគ្នា ➜ role check **ចាញ់ជាប្រព័ន្ធ មិនមែនចៃដន្យ**។ លើសពីនេះ
`WebSocketConnection.healthyTimeout = 30000` ➜ បើ socket ជាប់គាំង វារង់ ៣០ វិនាទីមុនប្ដូរទៅ
long-polling — ធំជាង timer ១៥ វិនាទីទ្វេដង។

**ដំណោះស្រាយ (ទាំង ៤ App)**៖ `awaitDatabaseConnection(ms)` ថ្មី (byte-identical ទាំង ៤ —
ប្រើ `window.firebaseSDK` ដើម្បីកុំបែកគ្នា) រង់ចាំ `.info/connected` រហូតដល់
`ROLE_CHECK_CONNECT_WAIT_MS = 45000` **មុននឹងអាន `user_roles`**។ បើភ្ជាប់រួចហើយ វាបន្តភ្លាម
(គ្មានការពន្យារ)។ បើមិនទាន់ វាបង្ហាញ toast "កំពុងភ្ជាប់ Server..." រួចរង់ចាំ។ សំណាញ់សុវត្ថិភាព
ចាស់នៅដដែល៖ បើភ្ជាប់មិនបានសោះ ➜ អាន ➜ timeout ➜ មិន signOut ➜ ដាក់ទង់ព្យាយាមឡើងវិញ។
`isDatabaseConnected` ត្រូវបានកត់ក្នុង handler `.info/connected` ដែលមានស្រាប់។

តេស្តឡើងជា **98/98** (ថែម scenario ៥ និង ៦ ក្នុង `auth-recovery-test.js`)។ ផ្ទៀងផ្ទាត់មិនទទេ៖
ធ្លាក់ ២០ ចំណុចលើ `origin/main` (ដែលមានការកែ login រួច តែគ្មានការរង់ចាំភ្ជាប់)។
`CACHE_VERSION` bump ម្តងទៀត (zoeadmin-v37, zoew-v33, zoescan-v26, zoekeygen-v19)។

### មូលហេតុទី ៤ (រកឃើញ 2026-08-20, branch `claude/busy-franklin-5g26ja`) — socket ស្លាប់ តែ HTTPS ដើរ

**មុនគេ៖ បញ្ជាក់ថា PWA update ចូលរួចហើយ។** អ្នកប្រើសង្ស័យថាកូដចាស់នៅ cache។ មិនមែនទេ។
Stack trace ក្នុង Sentry គឺ `withTimeout (app.js:213)` ← `verifyAdminRoleThenProceed (app.js:1222)`
ហើយ `git show origin/main:ZoeAdmin/app.js | sed -n '213p;1222p'` ចេញបន្ទាត់ទាំងពីរនោះបេះបិទ។
លើសពីនេះ គម្លាតពី `accounts:lookup` (04:48:33.758) ដល់កំហុស (04:49:33.770) គឺ **៦០.០១ វិនាទី**
= `ROLE_CHECK_CONNECT_WAIT_MS` ៤៥ + `withTimeout` ១៥ — ចំនួនដែលមានតែក្នុងកូដក្រោយ PR #25។
ហើយ toast ក្នុងរូបថតគឺអត្ថបទថ្មី "កំពុងភ្ជាប់ Server..."។ **វិធីពិនិត្យនេះគួរប្រើរាល់ពេល**
មុននឹងសន្មតថាជាបញ្ហា cache៖ ផ្គូផ្គងលេខបន្ទាត់ក្នុង stack ទៅនឹង `origin/main` ដោយ `git show`។

**មូលហេតុ។** នៅជុំមុន គេសន្មតថា RTDB មិនភ្ជាប់ព្រោះ auth token យឺត (`establishConnection_` await
`getToken()`)។ ជុំនេះ `accounts:lookup` ចំណាយត្រឹម ២.៣៧ វិនាទី តែ `.info/connected` នៅតែ false
លើស ៤៥ វិនាទី — ដូច្នេះការពន្យល់នោះមិនគ្រប់គ្រាន់ទេ។ អ្វីដែល breadcrumb បង្ហាញច្បាស់៖

| សំណើ | លទ្ធផល |
|---|---|
| `POST identitytoolkit.googleapis.com/v1/accounts:lookup` | 200 |
| `GET script.google.com/macros/.../exec?list=1` | 200 |
| `GET zoew-z1-default-rtdb.firebaseio.com/.json?shallow=true` | **401 ក្នុង ៧៩៣ms** |
| RTDB realtime channel | **គ្មានការភ្ជាប់សោះ** |

401 នោះមិនមែនជាកំហុសទេ — `syncServerTime()` ក្នុង `license-verify.js` មិនអាន body ទេ គ្រាន់តែអាន
header `Date` (root ត្រូវបានបិទតាំងពីជុំ ៦ ដែលផ្លាស់ `.read` ចុះទៅ `license_keys/$appCode/$keyId`)។
តម្លៃពិតរបស់វាគឺ៖ **វាបង្ហាញថា HTTPS ទៅ `*.firebaseio.com` ដើរល្អនៅលើឧបករណ៍នោះ** — មានតែ
channel realtime ទេដែលមិនដើរ។ (បណ្ដាញ 4G+ / VPN / proxy ដែលទប់ WebSocket គឺជាការពន្យល់សមហេតុផល។)

**កំហុសកូដពិតទី ១ — គ្មានផ្លូវបម្រុងសម្រាប់អាន role។** ទាំង SDK `get()` និង `.info/connected`
ពឹងលើ socket តែមួយ។ បើ socket មិនឡើង គ្មានអ្វីអាចអាន `user_roles` បានទេ ទោះ HTTPS ដើរក៏ដោយ។

**កំហុសកូដពិតទី ២ — CSP ទប់ផ្លូវបម្រុងរបស់ Firebase ខ្លួនឯង។** `BrowserPollConnection` (long-polling
ដែល SDK ប្ដូរទៅប្រើពេល WebSocket បរាជ័យ) ផ្ទុកទិន្នន័យតាម `<script src="https://<ns>.firebaseio.com/.lp?…">`
ខាងក្នុង iframe `about:blank` ដែលទទួលមរតក CSP របស់ទំព័រមេ។ `script-src` ទាំង ៤ App **មិនមាន**
`*.firebaseio.com` ទេ ➜ script ត្រូវបានទប់ ➜ **ពេល WebSocket ត្រូវបានទប់ RTDB គ្មាន transport ណាដើរសោះ**។
`connect-src` មាន `wss://*.firebaseio.com` ស្រាប់ហើយ ដូច្នេះគេងាយស្មានថាគ្រប់គ្រាន់ — មិនគ្រប់ទេ
ព្រោះ long-polling ជា `script-src` មិនមែន `connect-src`។

### អ្វីដែលបានកែ (ទាំង ៤ App)
- **`awaitDatabaseConnection()` ត្រូវបានជំនួសដោយ `readUserRole(user)`** (byte-identical ទាំង ៤ —
  ប្រើ `window.firebaseSDK` ដូច helper ចាស់)។ ឥរិយាបថ៖
  - **ភ្ជាប់រួចហើយ ➜ ដូចមុនបេះបិទ**៖ SDK `get()` + `withTimeout(15000)`។ គ្មានសំណើ REST បន្ថែម
    លើផ្លូវធម្មតាទេ (មានតេស្តបញ្ជាក់) — ដូច្នេះកូដថ្មីដើរតែក្នុងករណីដែលខូចរួចហើយ។
  - **មិនទាន់ភ្ជាប់ ➜ បើក ២ ផ្លូវស្របគ្នា**៖ SDK `get()` និង
    `GET {databaseURL}/user_roles/{uid}.json?auth={idToken}`។ អ្នកណាឆ្លើយមុន យកអ្នកនោះ។
    បើផ្លូវណាមួយបរាជ័យ ផ្លូវម្ខាងទៀត **នៅតែបន្តរង់ចាំ** រហូតដល់ `ROLE_CHECK_CONNECT_WAIT_MS` (៤៥ វិនាទី)។
    បើបរាជ័យទាំងពីរ ➜ បោះកំហុសរបស់ **SDK** មុន (វាផ្ទុក `permission_denied`) ទើប REST ទើប timeout។
- **`readUserRoleViaRest()`** ប្រើ `?auth=` (GET សាមញ្ញ គ្មាន preflight — សំខាន់ ព្រោះទាំងមូលនេះមាន
  ដើម្បីដើរពេលអ្វីៗដទៃខូច)។ `readDatabaseUrlFromConfig()` អាន `zoew_firebase_config` ពី
  `localStorage` ដោយផ្ទាល់ ជំនួសអថេរ `firebaseConfig` — ព្រោះ **Zoescan គ្មានអថេរនោះទេ**
  ហើយ helper ត្រូវតែដូចគ្នាទាំង ៤។
- **សុវត្ថិភាពមិនប្រែ**៖ REST ឆ្លងកាត់ rules ដដែល (`user_roles/$uid` អានបានតែដោយម្ចាស់ ឬ admin)
  ហើយកូដនៅតែបដិសេធ role ខុស និងនៅតែ `signOut()` លើ `permission_denied`។ មានតេស្តទាំង ២ ចំណុច។
- **`lastRoleRestOutcome`** (`'ok'` / `'http 401'` / `'blocked: …'` / `'unavailable'` / `'not needed'`)
  ត្រូវបានផ្ញើទៅ Sentry ជាមួយ `connected` ក្នុង `ZoeErrors.capture(...)`។ ជុំក្រោយនឹងលែងស្មានទៀត៖
  របាយការណ៍នឹងប្រាប់ត្រង់ៗថា REST ដើរឬអត់ ខណៈ socket ស្លាប់។
- **`error-reporting.js` (byte-identical ទាំង ៤) ទទួល `beforeBreadcrumb`** ដែលលុប
  `auth=` / `access_token=` / `id_token=` / `key=` ចេញពី URL ក្នុង breadcrumb មុនផ្ញើទៅ Sentry។
  Sentry មាន scrubbing ខាង server ស្រាប់ តែ ID token ជាព័ត៌មានសម្ងាត់ដែល **យើងទើបតែដាក់ចូល URL**
  ដូច្នេះមិនគួរពឹងលើ default របស់អ្នកដទៃទេ។
- **CSP `script-src` ថែម `https://*.firebaseio.com https://*.firebasedatabase.app`** ក្នុង
  `netlify.toml` ទាំង ៤ ➜ long-polling របស់ Firebase ដើរវិញបាន។ នេះមិនត្រឹមតែជួយ login ទេ —
  វាជួយ **ទិន្នន័យទាំងមូល** ព្រោះ `onValue` listener ក៏ពឹងលើ transport ដដែល។
  (ហានិភ័យតូច៖ script ដែលអនុញ្ញាតគឺ JSONP នៃ DB របស់ខ្លួនឯង។ Zoescan នៅតែគ្មាន `'unsafe-inline'` ដដែល។)

### តេស្ត — `audit-tools/auth-recovery-test.js` ឡើងជា **142/142**
Scenario ថ្មី ៥ ➜ ៩៖ គ្មាន `databaseURL` ➜ រង់ចាំ socket ដដែល · socket ឡើងវិញ ➜ ចូលបាន ·
socket ស្លាប់ + REST ដើរ ➜ **ចូលបានតាម REST** (ផ្ទៀងផ្ទាត់ URL ពិត រួមទាំង token) ·
REST 401 ➜ **មិនបណ្ដេញចេញ** នៅតែរង់ចាំ socket · role ខុសមកពី REST ➜ `signOut()` ដដែល ·
ហើយ scenario ១ ថែម "មិនស្នើ REST ទេ ពេលភ្ជាប់រួចហើយ"។ Harness ទទួល fake `fetch` និង
`localStorage` ដែលកំណត់បាន។

**មិនមែនតេស្តទទេទេ — បានផ្ទៀងផ្ទាត់៖** ចម្លង tree ទាំងមូល រួចប្ដូរ `readUserRoleViaRest(user)`
ជា `Promise.reject(...)` (= ឥរិយាបថចាស់ គ្មានផ្លូវ REST) ➜ **ធ្លាក់ ៤៤/១៤២** ហើយចំណុច fail-closed
ទាំងអស់ (`permission_denied` ➜ signOut, role ខុស ➜ signOut) **ជោគជ័យទាំងមុន និងក្រោយ**។
*អន្ទាក់ថ្មី៖ `origin/main` ក្នុង session នេះជា ref ចាស់ខ្លាំង (នៅមាន `Zscan/`)។ ត្រូវ
`git fetch origin main` សិន មុននឹងយក baseline ណាមួយ — បើមិនដូច្នេះ `git archive origin/main`
ចេញ tree ខុសទាំងស្រុង។*

`CACHE_VERSION` bump ទាំង ៤ (zoeadmin-v38, zoew-v34, zoescan-v27, zoekeygen-v20)។
**គ្មានការប្ដូរ Firebase rules ទេ ➜ គ្មាន publish ថ្មី។**

**Merge ចូល `main` តាមការស្នើរបស់អ្នកប្រើក្នុង session នេះ** — PR #26, merge commit `7139952`។
Netlify deploy preview ទាំង ៤ (`zoeadmin`, `zoew`, `zoescan`, `zoekeygen`) បៃតងមុន merge ហើយ
`git rev-list --count origin/main..origin/claude/busy-franklin-5g26ja` = 0 ក្រោយ merge។

### នៅសល់ បើ socket នៅតែមិនឡើងក្រោយ deploy នេះ
ការកែនេះធានាថា **login ចូលបាន** និងផ្ដល់ transport បម្រុងឲ្យ RTDB។ បើ Sentry ជុំក្រោយបង្ហាញ
`restRoleRead: "ok"` ជាមួយ `connected: false` ញឹកញាប់ នោះមានន័យថា socket ពិតជាត្រូវបានទប់នៅលើ
បណ្ដាញនោះ ហើយជំហានបន្ទាប់គឺពិនិត្យ VPN / data-saver / proxy របស់ឧបករណ៍ ឬសាកល្បង WiFi ផ្សេង។

## Eighth deep-audit pass (2026-08-20, branch `claude/busy-franklin-5g26ja`) — handoff notes

ស្នើដោយអ្នកប្រើភ្លាមក្រោយ PR #26/#27 merge ("ធ្វើ audit ជុំមួយទៀត មើលមានអ្វីខុសទៀតអត់")។
Branch ចេញពី `main` (`c39d611`) ដោយផ្ទាល់។ រត់ inline single-threaded ដូចជុំ ៦ និង ៧ (គ្មាន subagent)។

### វិធីសាស្ត្រ — ធ្វើឲ្យថ្នាក់កំហុសដែលកើតឡើងវិញ ក្លាយជាឧបករណ៍
ជុំ ៣, ៤ និង ៥ រកឃើញ **ថ្នាក់កំហុសដដែល ៣ ដងជាប់គ្នា**៖ វាលក្នុង modal ដែលផ្ទុកទិន្នន័យអតិថិជន
ហើយ `closeModal()` គ្រាន់តែ `display:none` ដូច្នេះទិន្នន័យនៅសល់ក្នុង DOM បន្ទាប់ពីចាកចេញ។ រាល់ជុំ
បន្ថែមវាលបាត់ ២-៣ ដោយដៃ រួចជុំក្រោយរកឃើញទៀត។ ជុំនេះសរសេរ **`audit-tools/dom-hygiene.js`**
ជំនួស៖ វា parse `app.js` ដោយ acorn រកគ្រប់ id ដែលទទួលការសរសេរ *មិនមែន literal* ទៅ
`.value`/`.innerText`/`.textContent`/`.innerHTML`, ច្រោះយកតែ id ដែលនៅក្នុង `.modal` ក្នុង HTML,
រួចប្រៀបនឹងអ្វីដែល `clearSensitiveModalFields()`/`showLoginModalWithPrefill()` លុបពិត។
វារកឃើញ ៣ ចំណុចដែលការអានដោយភ្នែក ៥ ជុំមុនមិនឃើញ។ **រត់វារាល់ជុំ។**

ក៏បានបញ្ចូល **`audit-tools/wiring.js`** (acorn) ដែល **ជំនួស `idcheck.js` និង `fncheck.js`**
(លុបចោលហើយ)។ ២ ឧបករណ៍ចាស់ជា regex ហើយ `fncheck.js` មើលតែ inline `on*=` ក្នុង **HTML** ប៉ុណ្ណោះ —
ចំណែក App ទាំងនេះបង្កើត handler ភាគច្រើនចេញពី **string ក្នុង `app.js`** ដូច្នេះវាខ្វាក់ចំពោះភាគច្រើន។
`wiring.js` គ្រប​ទាំង ២ ប្រភព បូកនឹង id ស្ទួន, គោលដៅ `data-close` និង `onValue(dbRefX)` គ្មាន guard។

### កែហើយ — ទាំង ៣ ជាថ្នាក់កំហុសដដែល (ទិន្នន័យសល់ក្នុង DOM ក្រោយចាកចេញ)
- **[ធំជាងគេ] ZoeAdmin `pdfExportPrintArea` ផ្ទុករបាយការណ៍ Export ពេញលេញ ហើយគ្មានកន្លែងណាលុបវា
  ទាល់តែសោះ។** `exportDataAsPDF()` សរសេរតារាងទាំងមូល — **លេខទូរស័ព្ទ, barcode, ទីតាំង locker,
  COD/DOD និងសរុប របស់អតិថិជនគ្រប់រូបក្នុងតម្រងនោះ** — ចូល `innerHTML` របស់ `<div class="print-only">`
  មួយ រួច `window.print()`។ `print-only` លាក់វាពីអេក្រង់ តែវានៅក្នុង DOM។ គ្មាន `afterprint`
  cleanup គ្មានការលុបពេលចាកចេញ ➜ របាយការណ៍ទាំងមូលនៅអានបានតាម DevTools រហូតដល់ reload ទំព័រ
  **រួមទាំងបន្ទាប់ពីអ្នកប្រើផ្សេងចូលប្រព័ន្ធលើឧបករណ៍រួម**។ នេះជា payload ធំជាងវាលណាមួយដែលជុំ ៣-៥
  បានបិទ (ជួរទាំងអស់ ជំនួសឲ្យជួរតែមួយ)។ កែ ២ កន្លែង៖ `afterprint` លុបភ្លាមក្រោយបោះពុម្ព
  (បិទចន្លោះក្នុង session ដែរ) និងបន្ថែម `pdfExportPrintArea` ចូល `clearSensitiveModalFields()`
  ជាសំណាញ់ (browser ទូរស័ព្ទខ្លះមិនបាញ់ `afterprint` ទេ)។
- **ZoeAdmin `modalBarcodeText`** — barcode នៃកញ្ចប់ចុងក្រោយដែលស្កេន នៅក្នុង `phoneModal`។ ជុំ ៤
  បន្ថែម `modalPhoneInput`/`modalLockerInput`/`modalCodInput`/`modalDodInput` នៃ modal **ដដែល**
  ចូលបញ្ជីលុប តែភ្លេចវាលនេះ — គំរូ "ភ្លេចបងប្អូនក្នុង modal ដដែល" បេះបិទ។
- **Zoescan `locationWarningText`/`locationWarningTitle`** — សារព្រមានទីតាំងជាន់គ្នាផ្ទុក barcode
  **និងលេខទូរស័ព្ទអតិថិជន** (`occPhoneRaw`)។ Zoescan គ្មាន `clearSensitiveModalFields()` ទេ ដូច្នេះ
  លុបក្នុងសាខា sign-out នៃ `onAuthStateChanged` ជាមួយ `listSearchInput` ដែលមានស្រាប់។

`CACHE_VERSION` bump តែ ២ (zoeadmin-v39, zoescan-v28) — ZoeW និង ZoeKeyGen មិនប្រែ។
**គ្មានការប្ដូរ Firebase rules ➜ គ្មាន publish ថ្មី។**

### ពិនិត្យហើយស្អាត — កុំ audit ឡើងវិញដោយងងឹតងងុល
- **`getIdToken()` ក្នុង URL មិនចូល cache ទេ**៖ `sw.js` ទាំង ៤ មាន
  `if (url.origin !== self.location.origin) return;` នៅដើម handler `fetch` ដូច្នេះសំណើ REST
  ឆ្លងដែនមិនឆ្លងកាត់ Cache Storage សោះ។ (ពិនិត្យដោយចេតនា ព្រោះ PR #26 ទើបដាក់ token ចូល URL។)
  បូកនឹង `beforeBreadcrumb` ដែល PR #26 បន្ថែម ដែលលុប `auth=` មុនផ្ញើទៅ Sentry។
- **`fetchCustomerDataTableRows`'s `customerDataTableFetchPromise` មិនអាចជាប់គាំងទេ** — មើលទៅដូច
  អាចជាប់ (`finally` លុបវាតែពេល generation ដូច) តែ `clearCustomerDataTableCache()` ជាកន្លែងតែមួយគត់
  ដែលបង្កើន generation ហើយវា **លុប promise នៅបន្ទាត់ដដែល**។ guard នៅក្នុង `finally` ចាំបាច់ ដើម្បី
  កុំឲ្យ fetch ចាស់លុប promise របស់ fetch ថ្មី។ ត្រឹមត្រូវដូចដែលសរសេរ។
- **ការហៅ promise ដោយគ្មាន `await`/`.catch` ចំនួន ៧០ កន្លែង** (`audit-tools` មិនរក្សាឧបករណ៍នេះទេ
  ព្រោះវាមានសំឡេងរំខានច្រើន) — ពិនិត្យរួច **គ្មានមួយណាជាកំហុសទេ**៖ `syncScannerLookupEntry`,
  `clearScannerLookupEntry`, `releaseBarcodesInRegistry` មាន `.catch` ខាងក្នុង;
  `claimAndCleanupItem`, `confirmPhone`, `assignLockerToEntry`, `refreshKeyList`, `toggleRevokeKey`,
  `loginWithFirebase`, `requestCameraPermission` មាន try/catch គ្របទាំងស្រុង;
  `patchHistoryItemFields` resolve `true/false` មិន reject។
- **នាឡិកា**៖ រត់ការស្វែងរក `Date.now()` + `new Date()` ឡើងវិញលើ `app.js` ទាំង ៤ និង
  `license-verify.js`។ អ្វីដែលនៅសល់ជា exemption ដែលមានឯកសាររួច (PIN lockout, id salt,
  scan debounce ×2, script-load deadline, lookup cache TTL/cooldown)។ `renderHistory` ប្រើ
  `getServerNow()` ទាំង ZoeAdmin និង ZoeW ហើយ `addOrUpdateEntry` ប្រើ `new Date(getServerNow())`។
- **`EXPORT_TEXT_COLUMN_INDEXES = [1, 2]` នៅត្រូវនឹង `EXPORT_HEADERS`** (index 1 = លេខទូរស័ព្ទ,
  2 = Barcode)។ ឯកសារ export ព្រមានថាត្រូវធ្វើសមកាលកម្មដោយដៃ — ពិនិត្យហើយ ត្រូវ។
- **ZoeKeyGen `user_roles/$uid` អានបានដោយម្ចាស់ខ្លួនឯង** (`auth.uid === $uid`) ដូច rules អាជីវកម្ម
  ដូច្នេះផ្លូវ REST នៃ PR #26 ដើរនៅ ZoeKeyGen ដែរ។
- Zoescan នៅមាន inline `onclick=` ត្រឹម ២ ហើយ **ទាំងពីរមាន `addEventListener` backup**
  (`activationSubmitBtn`, `activationLogoutBtn`) — CSP របស់វានៅតែគ្មាន `'unsafe-inline'`។
- Firebase path ↔ rules៖ គ្រប់ path ដែល App ប៉ះមាន block ក្នុង rules ហើយ **គ្មាន block ណាមិនប្រើ**
  ទាំង DB អាជីវកម្ម និង DB ZoeKeyGen។ Link Markdown ១០ ក្នុង README ទាំង ៦ ដំណើរការគ្រប់។
- `license-verify.js` និង `error-reporting.js` នៅ byte-identical ទាំង ៤ (`md5sum`);
  0 comment និង 0 trailing whitespace លើ `app.js`/`license-verify.js` ទាំង ៨ (acorn)។
- `extract.js` 91 identical / 23 different (ដូចមុនកែបេះបិទ), `shared-fns.js` UNEXPECTED: 0,
  `auth-recovery-test.js` 142/142, `policy-test.js` និង `lookup-closed-test.js` ជោគជ័យទាំងអស់។

### Merge
**Merge ចូល `main` តាមការស្នើរបស់អ្នកប្រើក្នុង session នេះ** — PR #28, merge commit `3fa1a78`
(branch ចេញពី `c39d611` ដោយផ្ទាល់)។ `mergeable_state: clean` ហើយ Netlify status ទាំងអស់បៃតងមុន
merge (ZoeW/ZoeKeyGen ត្រូវបាន Netlify រំលង ព្រោះគ្មានឯកសាររបស់ site ទាំងនោះប្រែ — វារាយការណ៍ជា
success)។ ក្រោយ merge `git rev-list --count origin/main..origin/claude/busy-franklin-5g26ja` = 0។

### មិនបានធ្វើជុំនេះ
- **មិនបានរត់ emulator** — គ្មាន rules ណាប្រែ ហើយការកែទាំង ៣ ជា DOM សុទ្ធ។ ផ្លូវ REST នៃ PR #26
  មិនទាន់បានផ្ទៀងផ្ទាត់លើ emulator ដែរ តែវាអាន path ដដែល (`user_roles/{uid}`) ក្រោម rules ដដែល
  ជាមួយ `auth` ដដែលនឹង SDK ដូច្នេះបើ SDK អាចអាន REST ក៏អានបានដែរ។ បើចង់ភស្តុតាង សូមបន្ថែម
  suite ថ្មីមួយក្នុង `audit-tools/emu/`។
- ចំណុចដែលជុំមុនទទួលយកដោយចេតនានៅដដែល៖ worker សរសេរតួលេខ revenue/pickup បាន, គ្មានការផ្ទៀងផ្ទាត់
  aggregate ដោយគ្មាន backend ដែលទុកចិត្តបាន, និង ZoeKeyGen "Extend" ផ្លាស់តែពិដានខាង server។

## ជុំ ៨ (បន្ត) — ZoeW និង ZoeKeyGen ដោយឡែក (2026-08-20)

អ្នកប្រើសួរ "ចុះ ZoeKeyGen, ZoeW" ព្រោះជុំ ៨ កែតែ ZoeAdmin និង Zoescan។ ត្រូវហើយ — ២ App នោះ
ឆ្លងកាត់តែឧបករណ៍មេកានិក មិនទាន់មានការអានលម្អិតទេ។ ជុំបន្តនេះធ្វើវា។

### ZoeW — ស្អាត (គ្មានអ្វីត្រូវកែ)
`extract.js` រាយ function ២៣ ដែលបែកគ្នាពី ZoeAdmin។ **បាន diff ទាំង ២៣** — សុទ្ធតែជាភាពខុសគ្នា
ស្របច្បាប់៖ salt PBKDF2 តាម App (`zoeadmin_` ទល់ `zoew_`), ស្លាក Sentry, ឈ្មោះ App ក្នុងសារ,
មុខងារ ZoeAdmin-only (`pendingBarcode`, `safeFocusScanner`, `clearCustomerDataTableCache`,
`lookupSecretKey`, យន្តការ `pinTargetAction` ដែល ZoeW ជំនួសដោយ `pendingSetupLinkConfig`)។
**ZoeW គ្មានកូដរបស់ខ្លួនឯងទេ ក្រៅពី `verifyWorkerRoleThenProceed`** — អ្វីៗសល់ចែករំលែកជាមួយ
ZoeAdmin ហើយដូចគ្នាបេះបិទ។ ដូច្នេះការកែក្នុង ZoeAdmin គ្របដណ្ដប់ ZoeW ស្រាប់។

### ZoeKeyGen — រកឃើញកំហុសពិត ១ (និងកែតូចៗ ៤)
**[សំខាន់] `refreshKeyList()` បង្រួម record របស់ App ទាំង ៣ ចូលគ្នា ដោយ "អ្នកចុងក្រោយឈ្នះ"។**
```js
Object.assign(byId[id].record, bucket[id]);   // ADM ➜ ZOW ➜ SCN
```
សម្រាប់ Key scope ALL វាអាន `license_keys/{ADM,ZOW,SCN}/{id}` ហើយសរសេរជាន់គ្នា ដូច្នេះ
**តម្លៃរបស់ SCN ឈ្នះជានិច្ច**។ ធម្មតាមិនអីទេ ព្រោះ bucket ទាំង ៣ ដូចគ្នា — **លើកលែងតែក្រោយ
"ជោគជ័យមិនពេញលេញ"** ដែលជាករណីដែល `toggleRevokeKey`/`confirmExtendKey` មានប្រអប់ព្រមានសម្រាប់វា។
ពេលនោះ bucket **ខុសគ្នាពិត** ហើយបញ្ជីបង្ហាញតែមួយ ដោយស្ងាត់៖
- Revoke បរាជ័យត្រង់ ADM តែជោគជ័យ ZOW/SCN ➜ បញ្ជីបង្ហាញ **Revoked** ➜ អ្នកគ្រប់គ្រងជឿថាចប់
  តែ **អ្នកប្រើ ZoeAdmin នៅតែចូលបាន**។
- បន្ថែមសុពលភាពបរាជ័យត្រង់ ADM ➜ បញ្ជីបង្ហាញថ្ងៃថ្មី ➜ គ្មានផ្លូវដឹងថា ZoeAdmin មិនបានបន្ថែម
  ➜ ក្រុមហ៊ុនអតិថិជនឈប់ដំណើរការនៅថ្ងៃចាស់ដោយគ្មានការព្រមាន។

**កែ**៖ រក្សា `perApp` តាម App ជំនួសការបង្រួម រួច
- `revoked` = ពិតតែពេល **គ្រប់** bucket revoked (ដូច្នេះប៊ូតុង Revoke នៅតែបញ្ចប់ការងារបាន
  ជំនួសឲ្យការត្រឡប់ក្រោយ) · `expiresAt` = **តូចជាងគេ** (ថ្ងៃដែល App ណាមួយឈប់ដំណើរការមុនគេ)
- ផ្លាក **⚠️ មិនត្រូវគ្នា** ថ្មីក្នុងតារាង ជាមួយ tooltip រាយតម្លៃតាម App
កែតែផ្នែក **បង្ហាញ** ប៉ុណ្ណោះ — គ្មានផ្លូវសរសេរណាប្រែទេ (`confirmExtendKey` គណនាពី `days` រួចហើយ)។

កែតូចៗ៖ `confirmExtendKey` លែងទុកប្រអប់បើកចោលលើផ្លូវកំហុស (ឥឡូវបិទ + `refreshKeyList()`) ·
`loadSigningKey` លែងបង្រួមកំហុសទាំងអស់ជាសារតែមួយ — ឥឡូវរាយការណ៍ទៅ Sentry ហើយប្រាប់ដាច់ដោយឡែក
ពេល Private Key **មិនផ្គូផ្គង** នឹង Public Key ក្នុង `license-verify.js` (ជាករណីច្រឡំដ៏គ្រោះថ្នាក់
ដែលជុំ ៥ បន្ថែមការត្រួតពិនិត្យសម្រាប់វា) · លុប blank line សល់ពី comment-strip ក្នុង
`tryRestoreSigningKeyFromSession`។

### តេស្តថ្មី — `audit-tools/keylist-consistency-test.js` (15/15)
ដក `refreshKeyList`/`renderKeyList`/`escapeHtml` **ពិត** ចេញពី `ZoeKeyGen/app.js` ដាក់ក្នុង `vm`
ជាមួយ `fb.get` ក្លែងក្លាយ។ **មិនមែនតេស្តទទេទេ**៖ រត់លើ `origin/main` (មុនកែ) តាមរយៈ
`KEYLIST_APP_JS=... node ...` ➜ **ធ្លាក់ ៩/១៥** រួមទាំង "Revoke មិនពេញលេញ ➜ មិនរាប់ថា Revoked"
(ចេញ `true` = កំហុស) និង "ថ្ងៃផុតកំណត់មកមុនគេ" (ចេញ `2000` ជំនួស `1000`)។

### `dom-hygiene.js` ត្រូវបានធ្វើឲ្យរឹងមាំ
ជុំ ៨ ច្រោះតែ id **ក្នុង `.modal`** ដោយស្កេន ៦០០០ តួអក្សរបន្ទាប់ពី modal នីមួយៗ។ ត្រឡប់មកមើល
ឡើងវិញ៖ `pdfExportPrintArea` **មិននៅក្នុង modal ទេ** — វាត្រូវបានចាប់បានដោយ **សំណាង** ព្រោះ
window នោះលើសទៅដល់វា។ បើវានៅឆ្ងាយជាងនេះ ឧបករណ៍នឹងខកខាន។ ឥឡូវលុបការច្រោះ `.modal` ចោល
ហើយពឹងលើ allowlist `ACCEPTED` វិញ (ដែលរាល់ធាតុមានហេតុផលសរសេរជាប់) — បានពិនិត្យ ២១ ធាតុថ្មី
ទាំងអស់៖ សុទ្ធតែជា UI chrome ឬត្រូវបានលុបដោយផ្លូវឯទៀត (ឧ. `historyTableBody` ដែល
`renderHistory([])` ជំនួសដោយជួរទទេ, `listTableBody` ដែល `detachDatabaseListeners()`+`renderList()`
សម្អាត, និង `setupLinkUrlInput` ដែលជា Base URL សាធារណៈ រក្សាទុកក្នុង localStorage ដោយចេតនា)។

`CACHE_VERSION` bump តែ ZoeKeyGen (zoekeygen-v21)។ **គ្មានការប្ដូរ rules ➜ គ្មាន publish ថ្មី។**

## Toast: លោតលឿនពេក · ចេញស្ទួន · និងសារត្រូវបានលុបចោល (fixed 2026-08-20)

អ្នកប្រើរាយការណ៍ ២ រឿង រួចស្នើមួយទៀត។ ទាំង ៣ ជាបញ្ហាពិត។

### ១. "បណ្ដាញយឺត! កំពុងភ្ជាប់ Server..." លោតរាល់ពេលបើក App
`verify*RoleThenProceed` មាន `if (!isDatabaseConnected) showToast(...)` **នៅដើមមុខងារ**។
`isDatabaseConnected` ចាប់ផ្ដើមជា `false` ហើយក្លាយជា `true` លុះត្រា `.info/connected` បាញ់ —
ដែលមិនអាចទាន់នៅ tick ដំបូងបានឡើយ។ ដូច្នេះសារនេះលោត **១០០% នៃការបើក App** ទោះបណ្ដាញលឿនក៏ដោយ។
អ្នកប្រើនិយាយត្រូវ៖ វាគួរលោតតែពេលយឺតពិត។

**កែ**៖ ផ្លាស់សារចូល `readUserRole()` រួចដាក់ `setTimeout` `SLOW_NETWORK_NOTICE_MS = 4000`។
`finish()` លុប timer នោះចោល ដូច្នេះបើអានបានមុន ៤ វិនាទី (ទាំង socket ទាំង REST) **គ្មានសារសោះ**។

### ២. "ចូលប្រព័ន្ធជោគជ័យ!" ចេញពីរដង
`verify*RoleThenProceed` ប្រកាសចូលប្រព័ន្ធ **រាល់ដងដែលវារត់ចប់ដោយជោគជ័យ** មិនមែនតែពេលឆ្លងកាត់
ពី "មិនទាន់ចូល" ទៅ "ចូលរួច" ទេ។ វារត់ច្រើនដងបានពិត៖ ការត្រួតពិនិត្យពេល boot, ការចូលដោយដៃ
(`loginWithFirebase` ហៅដោយខ្លួនឯងតាំងពី PR #24), និង `retryPendingRoleCheck()` ពី
`.info/connected` និង `visibilitychange`។ ZoeAdmin/ZoeW/Zoescan ប្រើ element `#toast` តែមួយ
ដូច្នេះវាមើលទៅដូចសារពីរលោតបន្តគ្នា; **ZoeKeyGen ត្រួតសារ ដូច្នេះវាឃើញច្បាស់ជាងគេ**
(ក្នុងរូបថតមានពីរជាន់គ្នា) ហើយ ZoeKeyGen **គ្មានការការពារសោះ**។

**កែ**៖ ZoeAdmin/ZoeW ប្រកាសតែពេល `isDatabaseInitialized` នៅ `false` (ទង់ដែលមានស្រាប់ ហើយ
ត្រូវ reset ពេលចាកចេញ)។ ZoeKeyGen គ្មានទង់បែបនោះ ➜ បន្ថែម `isSignedInUiActive` ដែល
`showLoginModalWithPrefill()` reset។ `refreshKeyList()` នៅតែរត់រាល់ដងដោយចេតនា — ការទាញបញ្ជី
ថ្មីមិនបង្កគ្រោះថ្នាក់ទេ។

### ៣. (ស្នើបន្ថែម) "ធ្វើឲ្យ toast ទាំងអស់ដើរ realtime"
ZoeAdmin/ZoeW/Zoescan ប្រើ `#toast` **តែមួយ** ហើយ `showToast()` សរសេរជាន់លើអត្ថបទចាស់ ព្រមទាំង
`clearTimeout(showToast._t)` — ដូច្នេះសារពីរដែលមកជិតគ្នា **សារទី ១ បាត់ទាំងស្រុង** មុនអ្នកប្រើ
អានទាន់។ ZoeKeyGen មានលំនាំត្រឹមត្រូវរួចហើយ (container + append)។

**កែ**៖ `showToast()` ឥឡូវ **byte-identical ទាំង ៤ App** — បង្កើត `<div class="toast">` ថ្មីរាល់ដង
បញ្ចូលទៅ `#toastContainer` ហើយលុបខ្លួនឯងក្រោយ ៣ វិនាទី ដូច្នេះសារជាន់គ្នាបានដោយគ្មានសារណាបាត់។
បន្ថែម **ដែនកំណត់ ៤ សារ** (លុបចាស់ជាងគេចេញ) ដែល ZoeKeyGen ក៏មិនធ្លាប់មាន — ការពារអេក្រង់ពេញ
ពេលមានសារច្រើនជាប់គ្នា។ HTML ប្ដូរ `<div id="toast">` ➜ `<div class="toast-container"
id="toastContainer">` និង CSS ប្ដូរពី `visibility` + `@keyframes fadein/fadeout` ទៅ flex column
+ transition (រក្សារូបរាងដើមរបស់ App នីមួយៗ)។ Keyframes ដែលលែងប្រើត្រូវលុបចោល។
**`showToast` ត្រូវបានដកចេញពី `EXPECTED_DIVERGENT` ក្នុង `shared-fns.js`** — ឥឡូវវាត្រូវតែដូចគ្នា
(identical ឡើងពី 16 ➜ 17)។

### តេស្ត — `auth-recovery-test.js` ឡើងជា **175/175**
Scenario ថ្មី ១០-១២៖ បើក App ធម្មតា ➜ **គ្មានសារ "បណ្ដាញយឺត" សោះ** (ទាំងភ្លាមៗ ទាំងក្រោយចូលរួច) ·
យឺតពិត ➜ នៅ ៣ វិនាទីនៅស្ងាត់ តែនៅ ៥ វិនាទីត្រូវប្រាប់ · ការត្រួតពិនិត្យ role ជាថ្មីលើ session
ដដែល ➜ **មិនប្រកាសចូលប្រព័ន្ធម្ដងទៀត**។ Scenario ៥ ចាស់ត្រូវបានកែ (វា assert ថាសារលោតភ្លាមៗ
ដែលជាឥរិយាបថដែលកំពុងកែ)។

`CACHE_VERSION` bump ទាំង ៤ (zoeadmin-v40, zoew-v35, zoescan-v29, zoekeygen-v22)។
**គ្មានការប្ដូរ rules ➜ គ្មាន publish ថ្មី។**

**Merge ចូល `main` តាមការស្នើរបស់អ្នកប្រើ** — PR #30, merge commit `382e797` (រួមទាំង
section "ជុំ ៨ (បន្ត) — ZoeW និង ZoeKeyGen" ខាងលើដែរ)។ Netlify preview ទាំង ៤ បៃតងមុន merge
ហើយ `git rev-list --count origin/main..origin/claude/busy-franklin-5g26ja` = 0 ក្រោយ merge។

## ជុំ ៩ (2026-08-20, branch `claude/busy-franklin-5g26ja`) — audit ការកែរបស់ខ្លួនឯង

Branch ចេញពី `main` (`74f7378`) ដោយផ្ទាល់។ វិធីសាស្ត្រជុំនេះ៖ **ពិនិត្យកូដដែលទើបតែ ship ខ្លាំងជាងគេ**
(PR #26/#28/#30) ព្រោះវាថ្មីជាងគេ និងមានការត្រួតពិនិត្យតិចជាងគេ។ វាបានផល។

### កែហើយ
- **[regression ដែលខ្ញុំបង្កើតក្នុង session នេះ] `refreshKeyList()` បំបាត់ note របស់ Key ចាស់។**
  ការសរសេរឡើងវិញក្នុង PR #30 ជំនួស `Object.assign(..., entry.record, meta)` ដោយយកតែ `meta` —
  តែ **Key ដែលមិនទាន់ Migrate ផ្ទុក `note`/`issuedAt`/`scope`/`createdBy` នៅក្នុង node សាធារណៈ
  `license_keys` ខ្លួនឯង** (នោះជាមូលហេតុដែលប៊ូតុង "🔒 Migrate PII ចាស់" មាន)។ ដូច្នេះក្រោយ PR #30
  Key ចាស់នឹងបង្ហាញ note ទទេ និងបាត់ `issuedAt` (ខូចការតម្រៀប) — ពោលគឺអ្នកគ្រប់គ្រងលែងដឹងថា Key ណា
  ជារបស់ហាងណា **មុនពេល Migrate**។ ឥឡូវ `legacyMeta` ត្រូវបានប្រមូលពី node សាធារណៈ រួចដាក់ក្រោម
  `meta` (meta ឈ្នះ ដូចឥរិយាបថដើម)។ តេស្តឡើងជា **19/19** ហើយ **ធ្លាក់ ៣ លើ `origin/main`**។
- **Zoescan គ្មាន toast "ចូលប្រព័ន្ធជោគជ័យ" សោះ** (អ្នកប្រើរាយការណ៍)។ វាមិនធ្លាប់មានទេ — មិនមែន
  ការកែជុំមុនធ្វើឲ្យបាត់ទេ។ បន្ថែម ដោយ gate លើ `listenersAttached` (ទង់ដែលមានស្រាប់ ហើយ
  `detachDatabaseListeners()` reset) ដូច្នេះការត្រួតពិនិត្យ role ជាថ្មីមិនប្រកាសម្ដងទៀត។
- **CSS `env()` គ្មាន fallback។** `bottom: calc(24px + env(safe-area-inset-bottom))` — បើ browser
  មិនស្គាល់ `env()` ការប្រកាសទាំងមូលត្រូវបានបោះចោល ➜ `bottom: auto` ➜ **ដុំ toast ទៅលើកំពូលទំព័រ**។
  បន្ថែម `bottom: 24px;` នាំមុខទាំង ៤ (រួមទាំង ZoeKeyGen ដែលមានលំនាំនេះតាំងពីយូរ)។

### ឧបករណ៍តេស្តត្រូវបានធ្វើឲ្យតឹងរឹង
Stub `initDatabaseListeners()` ក្នុង harness **មិនធ្វើតាមការពិត** — Zoescan ពិតប្រាកដមាន
`if (listenersAttached) return; listenersAttached = true;` ខាងក្នុង តែ stub គ្រាន់តែរាប់។ ដូច្នេះ
stub មិនអាចចាប់ការបើក listener ស្ទួនបានទេ ហើយវាធ្វើឲ្យខ្ញុំយល់ច្រឡំមួយភ្លែតថាការ gate របស់
Zoescan ខូច។ ឥឡូវ stub ធ្វើតាមការការពារពិត។ Scenario ១២ ក៏តម្រូវឲ្យ **ទាំង ៤ App** ប្រកាស
ចូលប្រព័ន្ធ **ត្រឹមតែម្ដង** (មុននេះវាទទួលយក ០ សម្រាប់ Zoescan)។ **179/179**។

### រន្ធអនុគ្រោះ ៣ ថ្ងៃ — **កែហើយ** តាមការសម្រេចរបស់អ្នកប្រើ ("កែចុះ")
**ការ paste Key ដដែលឡើងវិញពេលនៅក្រៅបណ្ដាញ អាច reset ការអនុគ្រោះ ៣ ថ្ងៃ បានឥតកំណត់។**
ដានពេញលេញ៖ `getStatus()` ➜ `offline-grace-exceeded` ក្រោយ ៣ ថ្ងៃគ្មានការផ្ទៀងផ្ទាត់ online ➜
`ensureAppActivated()` បើកប្រអប់ Activation ➜ អ្នកប្រើ paste Key ដដែល ➜ `submitActivationKey()`
➜ `ZoeLicense.activate()` ដែល **ពិនិត្យតែ signature និង exp ដែលបាន sign ប៉ុណ្ណោះ គ្មានបណ្ដាញសោះ**
➜ វាសរសេរ `lastOnlineCheck: getServerNow()` ➜ ការអនុគ្រោះចាប់ផ្ដើមរាប់ថ្មី។
ដូច្នេះ "៣ ថ្ងៃ" ជាការរំលឹក មិនមែនជាដែនកំណត់ទេ។ ការ Revoke នៅតែដើរភ្លាមៗ **ពេលមានបណ្ដាញ**
(`getStatus` ហៅ `checkOnline` រាល់ដង ហើយលុប record ពេល `ok === false`) — ចន្លោះនេះមានតែពេល
ក្រៅបណ្ដាញសុទ្ធសាធ។
**ការកែដែលបានអនុវត្ត** — ការកែដ៏ឆោតល្ងង់ (កុំសរសេរ `lastOnlineCheck` លុះត្រាមានបណ្ដាញ) នឹង
**ចាក់សោហាងដែលដំឡើងថ្មីនៅកន្លែងគ្មានអ៊ីនធឺណិត** ដូច្នេះមិនបានធ្វើបែបនោះទេ។ ជំនួសវិញ `activate()`៖
1. ហៅ `checkOnline()` ពិតប្រាកដ។ `ok === false` (revoked / not-found / expired-server) ➜
   **បដិសេធតាំងពី Activate** ជាមួយមូលហេតុនោះ (មុននេះ Key ដែល Revoke អាច Activate បាន)។
   វា **មិនលុប** record ដែលកំពុងដំណើរការទេ — ការ paste Key ខូចមិនត្រូវបំផ្លាញ Activation ល្អ។
2. `ok === true` ➜ រំកិល `lastOnlineCheck` និងយក `expiresAt` ពី Server (ដូច `getStatus`)។
3. `ok === null` (គ្មានបណ្ដាញ) ➜ **បើជា Key *ដដែល* រក្សា `lastOnlineCheck` ចាស់** ដូច្នេះការ paste
   ឡើងវិញមិនបានអ្វីទេ។ Key **ថ្មីពិត** ឬការ Activate លើកដំបូង នៅតែចាប់ផ្ដើមរាប់ថ្មី — ដូច្នេះ
   ការដំឡើងក្រៅបណ្ដាញនៅតែដើរដដែល។
គ្មានវាលថ្មីក្នុង schema ➜ គ្មាន migration។ `license-verify.js` នៅ byte-identical ទាំង ៤ (`md5sum`)។

តេស្តថ្មី **`audit-tools/license-grace-test.js` (13/13)** ដក `activate`/`getStatus`/`checkOnline`
ពិតចេញមកដាក់ក្នុង `vm` ជាមួយ `fetch` និង `localStorage` ក្លែងក្លាយ។ **មិនមែនតេស្តទទេទេ**៖
រត់លើ `license-verify.js` ចាស់ ➜ **ធ្លាក់ ៤** រួមទាំង `getStatus` ចេញ `"active"` ក្រោយ paste
ឡើងវិញ (ជារន្ធពិត) និង Key ដែល Revoke ត្រូវបានទទួលយក។

**នៅសល់ដោយចេតនា**៖ ការលុប site data នៅតែ reset បាន — គ្មានផ្លូវការពារខាង client ដោយគ្មាន
backend ដែលទុកចិត្តបាន (ដូចដែលបានកត់ត្រាតាំងពីជុំដំបូង)។ ការកែនេះលើកកម្ពស់ពី "ចុចប៊ូតុងម្ដងទៀត"
ទៅ "លុប site data" ហើយធ្វើឲ្យផ្លូវធម្មតាមានភាពស្មោះត្រង់។

### ពិនិត្យហើយស្អាត
- `license-verify.js` អានពេញ (326 បន្ទាត់)៖ `checkOnline` អាន **node តាម App** (`license_keys/{app}/{id}`)
  ដូច្នេះការ Revoke មិនពេញលេញត្រូវបានអនុវត្តត្រឹមត្រូវក្នុងគ្រប់ App — បញ្ហាដែលកែក្នុង PR #30 ជា
  **បញ្ហាបង្ហាញសុទ្ធ** ដូចដែលបានសរសេរ។ `onlineExp = undefined` ធ្លាក់ត្រឡប់ទៅ `exp` ដែល sign រួច។
  `keyId` ក្នុង URL មិន encode ទេ តែវាឆ្លងកាត់ការផ្ទៀងផ្ទាត់ signature ជាមុន ដូច្នេះត្រូវការ private key។
- Toast ថ្មី៖ គ្មានសារណាមួយមាន `\n` ដូច្នេះ `innerText` ➜ `textContent` **មិនប្តូរឥរិយាបថទេ**។
  `pointer-events: none` ជា inherited ដូច្នេះ `.toast` មិនស្ទាក់ការចុច។ ដែនកំណត់ ៤ លុប node ដែល
  detach រួច — `remove()` លើ node detached ជា no-op។
- `showLockerPicker(true)` រំលងពេលមាន locker រួច ➜ ការត្រួតពិនិត្យ role ជាថ្មីមិនបញ្ជូនកម្មករ
  ត្រឡប់ទៅអេក្រង់ជ្រើស locker វិញទេ។

`CACHE_VERSION` bump ទាំង ៤ ពីរដង (បញ្ចប់នៅ zoeadmin-v42, zoew-v37, zoescan-v31, zoekeygen-v24)។
**គ្មានការប្ដូរ rules ➜ គ្មាន publish ថ្មី។**

**Merge ចូល `main` តាមការស្នើរបស់អ្នកប្រើ** — PR #32, merge commit `c46d43a`។ Netlify preview
ទាំង ៤ បៃតងមុន merge ហើយ `git rev-list --count origin/main..origin/<branch>` = 0 ក្រោយ merge។

## ស្វែងរកលេខទូរស័ព្ទ៖ ដុំស្នើលេខផ្ទាល់ខ្លួន ជំនួស `<datalist>` (fixed 2026-08-20, branch `claude/phone-number-audit-8-9-tsyi3c`)

អ្នកប្រើរាយការណ៍ថាក្រោយជុំ audit ៨/៩ កន្លែងស្វែងរកលេខទូរស័ព្ទ **ទាល់តែវាយលេខពេញ** ទើបឃើញដុំ
ស្នើលេខ ខណៈពីមុនវាយត្រឹមកន្ទុយលេខ ៣-៤ ខ្ទង់ក៏លោតមកហើយ។ ក្រោយមកគាត់រាយការណ៍ថា **"ដើរវិញហើយ"**
ដោយមិនបានប្តូរអ្វីសោះ — ពោលគឺវាឡើងចុះ មិនទៀងទាត់។

### អ្វីដែល **មិនមែន** ជាមូលហេតុ
ការកែជុំ ៨ និង ៩ មិនប៉ះកូដស្វែងរកទាល់តែសោះ។ ផ្ទៀងផ្ទាត់ដោយ git៖ `git log -S` លើ
`updateRecentPhonesList` ចេញតែ commit ចាស់ពីមុនឆ្ងាយ (`cb8abbe`, `6c5b24d`) ហើយ
`list="recentPhonesList"` ក្នុង `index.html` ក៏ដូចគ្នា។ `searchByPhone()` ខ្លួនវាប្រើ
`.includes()` ជានិច្ច ដូច្នេះ **តារាង** តែងតែច្រោះតាមកន្ទុយលេខបានធម្មតា — អ្វីដែលបាត់គឺ **ដុំស្នើលេខ**។

### មូលហេតុពិត ២ ជាន់គ្នា
១. **ការផ្គូផ្គងជា `<datalist>` របស់ browser មិនមែនកូដយើង។** វាលស្វែងរកពឹងលើ
   `list="recentPhonesList"` សុទ្ធសាធ ដូច្នេះថាតើ "421" ត្រូវនឹង "0968490421" ឬអត់
   គឺ **browser សម្រេច**។ Chrome ជំនាន់ក្រោយៗបញ្ចូល datalist ទៅក្នុងប្រព័ន្ធ Autofill ដែល
   ច្រោះតាម **ដើមលេខ** ➜ វាយកន្ទុយលេខ គ្មានអ្វីលោតមក ➜ វាយពេញទើបឃើញ។ វាពន្យល់បានទាំង
   រោគសញ្ញា និងការប្រែប្រួលតាមឧបករណ៍/ជំនាន់។
២. **កំហុសពិតក្នុងកូដ៖ បញ្ជីត្រូវកាត់ត្រឹម ៣០។** `updateRecentPhonesList()` ធ្វើ
   `Array.from(phonesSet).slice(0, 30)` លើលំដាប់ `scanHistory` (ចាស់មុន) មិនមែនតាមភាពថ្មីទេ។
   ថ្ងៃដែលមានលេខផ្សេងគ្នាលើស ៣០ ➜ លេខរបស់អតិថិជនដែលទើបស្កេនចូល **មិនស្ថិតក្នុង datalist សោះ**
   ➜ គ្មាន suggestion ទោះវាយបែបណា។ ក្រោយ ២ ម៉ោង កញ្ចប់បិទរួចធ្លាក់ចូលធុងសំរាម បញ្ជីខ្លីវិញ
   ➜ ដើរវិញ។ នេះជាមូលហេតុនៃភាព **មិនទៀងទាត់** ដែលអ្នកប្រើសង្កេតឃើញ។
   ផ្ទៀងផ្ទាត់ដោយតេស្តលើ `origin/main`៖ ចេញ ៣០ ធាតុ ហើយធាតុទី ១ គឺលេខ **ចាស់ជាងគេ**។

**ការសង្កេតរបស់អ្នកប្រើដែលបញ្ជាក់មូលហេតុនេះច្បាស់៖** *"លេខខ្លះទាល់តែវាយលេខពេញបានឃើញលោតមក
លេខខ្លះទៀតវាយតែកន្ទុយលេខ ៣-៤ លោតមកហើយ។"* — បើវាជាបញ្ហា browser សុទ្ធ លេខទាំងអស់គួរតែដូចគ្នា។
ភាពខុសគ្នា **តាមលេខម្តងមួយៗ** មានន័យថាលេខខ្លះ **មិនស្ថិតក្នុង `<datalist>` សោះ** (ធ្លាក់ក្រៅ
ការកាត់ត្រឹម ៣០)។ លេខទាំងនោះលោតមកពេលវាយពេញ គឺមកពី **កំណត់ត្រា autofill របស់ browser ខ្លួនឯង**
(អ្វីដែលធ្លាប់វាយក្នុងវាលនោះ) ដែលផ្គូផ្គងតាមដើមលេខ — មិនមែនមកពី datalist របស់យើងទេ។

### អ្វីដែលបានកែ (ZoeAdmin និង ZoeW — byte-identical ទាំងពីរ)
- **ដុំស្នើលេខផ្ទាល់ខ្លួន** `#phoneSuggestBox` (`position: fixed`, ដាក់នៅកម្រិត `<body>` ជាមួយ
  `#globalMoreMenu` ដើម្បីគេចពី `overflow` របស់ `.sidebar-section` និង stacking context)។
  `list="recentPhonesList"` ត្រូវបានដកចេញពី `#searchPhoneInput` ហើយដាក់ `autocomplete="off"`
  ជំនួស ដូច្នេះ **គ្មានដុំ browser ជាន់លើដុំយើងទេ**។ វាល ២ ទៀត (`modalPhoneInput`,
  `editPhoneInput`) នៅប្រើ datalist ដដែល — មិនប៉ះ។
- **ការផ្គូផ្គងតាមតួលេខសុទ្ធ** (`normalizePhoneDigits`) ដូច្នេះ `012-345 678` ត្រូវនឹង `345678`។
  លំដាប់៖ **កន្ទុយត្រូវគ្នា ➜ ដើមត្រូវគ្នា ➜ កណ្តាល** រួចតម្រៀបតាមភាពថ្មី (`createdAt`)។
  បង្ហាញយ៉ាងច្រើន ៨ ជួរ ជាមួយចំនួនកញ្ចប់សរុបរបស់លេខនោះ។
- **`updateRecentPhonesList()` លែងកាត់ត្រឹម ៣០** — ឥឡូវហៅ `collectPhoneSuggestions('',
  RECENT_PHONES_MAX)` (**៣០០** តាមភាពថ្មី តាមការស្នើរបស់អ្នកប្រើ) ដូច្នេះវាល ២ ទៀតទទួលផលដែរ។
  **ការផ្គូផ្គងខ្លួនវាគ្មានដែនកំណត់សោះ** — `collectPhoneSuggestions(query)` ដើរលើ `scanHistory`
  ទាំងមូល; `PHONE_SUGGEST_MAX` (១២) កំណត់តែ **ចំនួនជួរដែលបង្ហាញក្នុងដុំ** (ដុំ scroll បាន)។
- **`searchByPhone()` ច្រោះតាមតួលេខសុទ្ធដែរ** (បើ query គ្មានតួលេខសោះ ➜ ត្រឡប់ទៅ `.includes()`
  ដើម ដើម្បីកុំឲ្យផ្គូផ្គងអ្វីៗទាំងអស់)។
- **អនាម័យ DOM** (ថ្នាក់កំហុសជុំ ៣/៤/៥/៨)៖ ដុំស្នើលេខផ្ទុកលេខទូរស័ព្ទអតិថិជន ដូច្នេះ
  `clearSensitiveModalFields()` ហៅ `hidePhoneSuggestions()` (លុប node ចេញពិត មិនត្រឹមតែលាក់)
  ហើយ `phoneSuggestBox` ក៏ចូលបញ្ជីលុបដែរ។ `dom-hygiene.js` បៃតង។
- ក្តារចុច៖ ព្រួញឡើង/ចុះ ជ្រើស, Enter យក, Escape បិទ, ចុចក្រៅបិទ។ `mousedown` ត្រូវ
  `preventDefault()` ដើម្បីកុំឲ្យ blur បិទដុំមុនការចុចធ្លាក់។

### តេស្ត — `audit-tools/phone-suggest-test.js` (48/48)
ដក `collectPhoneSuggestions`/`showPhoneSuggestions`/`hidePhoneSuggestions`/`searchByPhone`/
`updateRecentPhonesList` **ពិត** ចេញពី **ទាំង ២ App** ដាក់ក្នុង `vm` ជាមួយ DOM ក្លែងក្លាយ។
**មិនមែនតេស្តទទេទេ**៖ `PHONE_APP_DIR=<baseline> node audit-tools/phone-suggest-test.js` លើ
`origin/main` ➜ **ធ្លាក់ ៨/១៤** (មុខងារថ្មីមិនទាន់មាន) រួមទាំង "លេខលើសពី ៣០ មិនត្រូវកាត់ចោល" (ចេញ ៣០) និង
"លេខថ្មីជាងគេនៅដើមបញ្ជី" (ចេញលេខចាស់ជាងគេ) — ពោលគឺវាបង្ហាញកំហុសពិតដែលពន្យល់ភាពមិនទៀងទាត់។

`CACHE_VERSION` bump (zoeadmin-v43, zoew-v38)។ **គ្មានការប្ដូរ rules ➜ គ្មាន publish ថ្មី។**
Zoescan/ZoeKeyGen មិនប៉ះ (គ្មានវាលស្វែងរកលេខទូរស័ព្ទ)។

## ជុំ ១០ — deep audit ទាំង ៤ App (2026-08-20, branch `claude/phone-number-audit-8-9-tsyi3c`)

ស្នើដោយអ្នកប្រើភ្លាមក្រោយការកែ "ស្វែងរកលេខទូរស័ព្ទ"៖ *"ធ្វើ deep audit លម្អិតឡើងវិញគ្រប់ផ្នែក
ទាំងអស់ ទាំង ៤ App"*។ រត់ inline single-threaded (គ្មាន subagent) ដូចជុំ ៦-៩។ **អាន Zoescan
(1726 បន្ទាត់) និង ZoeKeyGen (1344 បន្ទាត់) ពេញទាំងស្រុង** — ២ App នេះទទួលការអានតិចជាងគេពីមុន។
ZoeAdmin/ZoeW គ្របដោយ `extract.js` (101 identical / 23 different, ដូចមុន) បូកនឹងការអាន diff
របស់ការកែថ្មីៗ។

### វិធីសាស្ត្រ — កូដថ្មីជាងគេ ត្រូវពិនិត្យខ្លាំងជាងគេ
មេរៀនជុំ ៩ ដដែល ហើយវាបានផលម្តងទៀត៖ **កំហុស ៣ ក្នុង ៩ គឺនៅក្នុងដុំស្នើលេខដែលទើបសរសេរក្នុង
session ដដែលនេះ** — ត្រូវរកឃើញដោយអាន diff របស់ខ្លួនឯងម្តងទៀតដោយសង្ស័យ មិនមែនដោយឧបករណ៍ទេ។

### កែហើយ
- **[ZoeAdmin/ZoeW — កូដថ្មីរបស់ខ្លួនឯង] ដុំស្នើលេខអណ្តែតលើ modal។** `.phone-suggest` មាន
  `z-index: 1045` តែ `.modal` មាន `1000` — ដូច្នេះពេលស្កេន barcode ខណៈវាលស្វែងរកកំពុង focus
  (`phoneModal` លោតឡើង) ដុំស្នើលេខអណ្តែតលើប្រអប់ ហើយ**ចុចបាន**ទៀតផង។ ឥឡូវ `openModalHelper()`
  ហៅ `hidePhoneSuggestions()` — កន្លែងតែមួយគ្របគ្រប់ modal ទាំងអស់។
- **[ZoeAdmin/ZoeW] blur ➜ focus ក្នុង ១៥០ms បិទដុំដោយខុស។** `blur` ដាក់ `setTimeout(hide, 150)`
  ដែលគ្មានអ្នកលុបចោល ដូច្នេះការចុចវាលឡើងវិញភ្លាមៗ បើកដុំរួចវាត្រូវបិទវិញក្នុង ១៥០ms។ ឥឡូវ
  `phoneSuggestHideTimer` ត្រូវបាន clear ក្នុង `showPhoneSuggestions()` និង `hidePhoneSuggestions()`។
- **[ZoeAdmin/ZoeW] `scroll` listener ប្តូរទៅ `{ passive: true }`** (វាដើរលើគ្រប់ការ scroll)។
- **[ZoeKeyGen] `checkPinAndOpenConfig()` មិន reset `pinTargetAction` — ការកែជុំ ៦ មិនដែលទៅដល់
  App ទី ៤។** សាខាគ្មាន PIN បើក `pinSetupModal` ដោយផ្ទាល់ ដូច្នេះ `saveNewSecurityPin()` ហៅ
  `(pinTargetAction || openConfigModal)()` ➜ **រត់ callback ចាស់** (ឧ. `persistSigningKeyForSession`)
  ជំនួសការបើកប្រអប់ Config។ លទ្ធផល៖ លើឧបករណ៍ដែល config ខូច/បាត់ អ្នកគ្រប់គ្រងកំណត់ PIN រួច
  **ប្រអប់ Config មិនបើកសោះ** — គ្មានផ្លូវជួសជុលតាម UI។
- **[ZoeKeyGen] ការស្ដារ Signing Key ជាន់លើ PIN flow របស់ Config។** ក្នុង `DOMContentLoaded`,
  `initFirebase()` ហៅ `checkPinAndOpenConfig()` **ដោយ synchronous** (មុន `await` ដំបូង) ពេលគ្មាន
  config; បន្ទាត់បន្ទាប់មកទៀត `requestPinBeforeConfig(tryRestoreSigningKeyFromSession, ...)`
  សរសេរជាន់ `pinTargetAction` ភ្លាម ➜ លទ្ធផលដូចខាងលើ។ ឥឡូវមាន `isPinFlowPending()` ជាឆ្នាំង៖
  បើ `pinModal`/`pinSetupModal` បើករួច ការស្ដារ Signing Key ត្រូវរំលង។
- **[Zoescan] `renderList()` អានតម្រងទីតាំង *មុន* សាង `<select>` ឡើងវិញ។** ពេលកញ្ចប់ចុងក្រោយក្នុង
  ទូដែលកំពុងត្រង ត្រូវអតិថិជនយកចេញ ➜ ជម្រើសនោះបាត់ពី dropdown ➜ `filterSelect.value` ក្លាយជា `''`
  តែអថេរ `lockerFilter` នៅផ្ទុកតម្លៃចាស់ ➜ **តារាងទទេ ខណៈ dropdown សរសេរថា "ទីតាំងទាំងអស់"**។
  ឥឡូវ `lockerFilter` ត្រូវអានក្រោយការសាងឡើងវិញ។
- **[Zoescan] ការស្វែងរកលេខក្នុងបញ្ជី ប្រៀបតាមតួលេខសុទ្ធ** ដូច ZoeAdmin/ZoeW ➜ `012-345 678`
  រកឃើញដោយវាយ `345678`។ `normalizePhoneDigits` ឥឡូវចែករំលែក ៣ App (byte-identical)។
- **[ទាំង ៤ App — សុវត្ថិភាព] `readUserRoleViaRest()` ផ្ញើ Firebase ID token ទៅ host ណាក៏បាន**
  ដែលស្ថិតក្នុង `databaseURL` នៃ `zoew_firebase_config`។ CSP `connect-src` អនុញ្ញាត
  `*.googleapis.com`, `script.google.com`, `*.googleusercontent.com` ដែរ ដូច្នេះ config ដែលត្រូវពុល
  (តាម Setup Link ក្លែងក្លាយ) អាច **លួច ID token** — សញ្ញាសម្គាល់ដែលមានសិទ្ធិលើ project ទាំងមូល។
  ឥឡូវ `isFirebaseDatabaseHost()` តម្រូវឲ្យជា `https://` + `*.firebaseio.com` ឬ
  `*.firebasedatabase.app`; បើមិនមែន ផ្លូវ REST ត្រូវរំលង (SDK នៅដើរដដែល) ហើយ Sentry ទទួល
  `restRoleRead: "blocked: non-firebase databaseURL"`។ **នេះជាកន្លែងតែមួយគត់ក្នុងកូដដែលដាក់ token
  ចូល URL** (បន្ថែមក្នុង PR #26)។
- **[ZoeKeyGen — deploy] `ZoeKeyGen/firebase-database.rules.json` ត្រូវបានបម្រើជាសាធារណៈ**
  ព្រោះ `publish = "."` ➜ អ្នកណាក៏ទាញយកផែនទី schema ពេញលេញនៃ DB License បាន (រួមទាំងកន្លែងណា
  អានបានដោយគ្មាន auth)។ បន្ថែម `[[redirects]]` 404 (`force = true`, ដាក់ **មុន** catch-all
  `/* ➜ /index.html 200` ព្រោះ Netlify ដំណើរការតាមលំដាប់ ហើយឯកសារពិតឈ្នះ redirect ដែលគ្មាន `force`)។

### តេស្តថ្មី (ភស្តុតាងរត់បាន មិនមែនអត្ថបទ)
- **`audit-tools/zoescan-list-test.js` (7/7)** — ដក `renderList` ពិត ដាក់ក្នុង `vm` ជាមួយ `<select>`
  ក្លែងក្លាយដែល **ធ្វើតាមឥរិយាបថពិត**៖ ការកំណត់ `.value` ទៅតម្លៃដែលគ្មាន `<option>` ក្លាយជា `''`។
  លើ tree មុនកែ ➜ ធ្លាក់ ២ (តារាងទទេខុស + ការស្វែងរកលេខមានសញ្ញា)។
- **`audit-tools/keygen-pin-flow-test.js` (10/10)** — លើ tree មុនកែ ➜ **ធ្លាក់ ៦** រួមទាំង
  "ក្រោយកំណត់ PIN ➜ បើកប្រអប់ Config ពិត" ដែលចេញ `"persistKey"`។
- **`auth-recovery-test.js` ឡើងជា 191** (scenario ៤ខ ថ្មី)។ លើ tree មុនកែ ➜ ធ្លាក់ ៨ ហើយ log
  បង្ហាញ URL ពិត `https://evil.googleusercontent.com/user_roles/…?auth=id-token-…` — ភស្តុតាងផ្ទាល់
  ថា token ធ្លាយមែន។ Harness ទទួល `AUTH_APP_DIR` ដើម្បីរត់លើ tree ផ្សេង។
- `phone-suggest-test.js` ឡើងជា **55** (បើក modal ➜ ដុំបិទ; blur➜focus ក្នុង ១៥០ms ➜ ដុំនៅបើក)។
  លើ tree មុនកែ ➜ ធ្លាក់ ៣។

### ពិនិត្យហើយស្អាត — កុំ audit ឡើងវិញដោយងងឹតងងុល
- **`activate()` ក្នុង `license-verify.js` reset `onlineExp` ទៅ `exp` ដែល sign រួច ពេលក្រៅបណ្ដាញ**
  ដែលមើលទៅដូចជាបំបាត់ការបន្ថែមសុពលភាពពី server។ **តាមដានហើយ — ទៅដល់មិនបានទេ**៖
  `verifyKeyString()` បដិសេធ Key ដែលហួស `exp` ដែល sign រួច ដូច្នេះការ activate ឡើងវិញកើតបានតែ
  មុនថ្ងៃនោះ ដែលពិដានទាំងពីរនៅតែជាអនាគត។ **មិនបានកែ** (កុំប៉ះឯកសារនេះដោយគ្មានហេតុផលពិត)។
- **export របស់ `firebaseSDK` ↔ ការប្រើពិត ទាំង ៤ App**៖ គ្មានអ្វីខ្វះ។ Zoescan ប្រើ
  `firebase-init.js` ផ្ទាល់ខ្លួន (តូចជាង គ្មាន `deleteApp`/`set`) — មិនអីទេ ព្រោះវាមិនប្រើវា
  ហើយ `saveFirebaseConfig()` របស់វា **reload ទំព័រពេញ** ដូច្នេះការ re-init មិនត្រូវការ `deleteApp`។
- `APP_SHELL` ក្នុង `sw.js` ទាំង ៤ គ្របឯកសារពិតទាំងអស់លើ disk។
- Firebase path ↔ rules៖ ត្រូវគ្នាទាំង ២ ទិស (គ្មាន path ក្រៅ rules, គ្មាន block មិនប្រើ)។
- `JSON.parse` គ្រប់កន្លែងទាំង ៤ App នៅក្នុង try/catch។
- Link Markdown ទាំងអស់ក្នុង README ដំណើរការ។ `license-verify.js` និង `error-reporting.js`
  នៅ byte-identical ទាំង ៤ (`md5sum` = ១ តម្លៃ)។ comment = 0, trailing whitespace = 0។

### ទទួលយកដោយចេតនា (មិនកែ)
- `README.md` របស់ App នីមួយៗក៏ត្រូវបានបម្រើជាសាធារណៈដែរ (`publish = "."`) — ជាឯកសារ គ្មានអាថ៌កំបាំង។
- Zoescan៖ QR ដែលមិនមែន Setup Link ធ្វើឲ្យ toast ចេញឡើងវិញរាល់ frame ដែល decode បាន (រំខានតែប៉ុណ្ណោះ)។
- អ្វីៗដែលជុំមុនទទួលយករួច នៅដដែល៖ worker សរសេរតួលេខ revenue/pickup បាន, គ្មានការផ្ទៀងផ្ទាត់
  aggregate ដោយគ្មាន backend, ZoeKeyGen "Extend" ផ្លាស់តែពិដាន server។

`CACHE_VERSION`៖ zoeadmin-v43, zoew-v38 (bump ក្នុង commit ដំបូងនៃ branch នេះ), zoescan-v32,
zoekeygen-v25។ **គ្មានការប្ដូរ Firebase rules ➜ គ្មាន publish ថ្មី។**

**Merge ចូល `main` តាមការស្នើរបស់អ្នកប្រើក្នុង session នេះ** — PR #34, merge commit `dcde742`
(branch ចេញពី `2f7da14` ដោយផ្ទាល់)។ `mergeable_state: clean` ហើយ Netlify preview ទាំង ៤
(`zoeadmin`, `zoew`, `zoescan`, `zoekeygen`) បៃតងមុន merge។ ក្រោយ merge
`git rev-list --count origin/main..origin/claude/phone-number-audit-8-9-tsyi3c` = 0។
Netlify deploy `main` ស្វ័យប្រវត្តិ ➜ **កូដទៅដល់ production ហើយ**។

## ជុំ ១១ — deep audit (2026-08-20, branch `claude/deep-audit-jcog87`)

ស្នើដោយអ្នកប្រើ ព្រមទាំងសំណួរត្រង់ៗ៖ *"រាល់ការ audit មុនមុនអ្នកមិនបានមើលគ្រប់ជ្រុងជ្រោយទេឬ?"*
ចម្លើយស្មោះត្រង់នៅចុង section នេះ។ Branch ចេញពី `main` (`db02393`) ដោយផ្ទាល់។ រត់ inline
single-threaded ដូចជុំ ៦-១០។

**អ្នកប្រើផ្តល់បរិបទសំខាន់ ២ ក្នុង session៖** PR #35/#36 ត្រូវបានធ្វើឡើងដោយ **Claude AI លើទូរស័ព្ទ**
(ដូច្នេះជាកូដដែលទទួលការត្រួតពិនិត្យតិចជាងគេ — ពិនិត្យវាមុនគេ) និងថា Zoescan មានផ្លូវស្តារតាមប៊ូតុង
"🔄 កំណត់ទិន្នន័យ Scanner Lookup ឡើងវិញ" របស់ ZoeAdmin (ត្រូវ — តែមើលកំហុសទី ១ ខាងក្រោម)។

### ស្ថានភាពពេលចាប់ផ្តើម — ឧបករណ៍ចាស់ទាំងអស់ស្អាត
`extract.js` 101 identical / 23 different · `shared-fns.js` UNEXPECTED 0 · `wiring.js` ស្អាត ·
`dom-hygiene.js` ស្អាត · តេស្ត ៣០៨ assertion ជោគជ័យទាំងអស់។ ដូច្នេះកំហុសថ្មីនឹង **មិនមកពី
ឧបករណ៍ចាស់ទេ** — ត្រូវសាងឧបករណ៍ថ្មីសម្រាប់ថ្នាក់កំហុសដែលមិនដែលពិនិត្យ។

### កំហុសទី ១ (ធ្ងន់ធ្ងរបំផុត) — Firebase ត្រឡប់ `barcodes` មក ៣ រូបរាង តែកូដស្គាល់តែ ១
RTDB ត្រឡប់ array ដដែលមកក្នុងរូបរាងខុសគ្នា អាស្រ័យលើថាតើ key ជាប់គ្នាឬអត់៖
| រូបរាង | កូដមុនកែធ្វើអ្វី |
|---|---|
| `[A, B]` (ជាប់គ្នា) | ត្រឹមត្រូវ |
| `[A, null, B]` (ចន្លោះតិច) | **throw** `Cannot read properties of null (reading 'cod')` |
| `{0:A, 2:B}` (ចន្លោះច្រើន) | `Array.isArray` = false ➜ **បោះបង់ barcode ទាំងអស់ស្ងាត់ៗ** |

- **រូបរាង `null`** — normalizer ធ្វើ `b.cod = parseFloat(b.cod) || 0` ដោយគ្មាន guard។ វា throw
  **ចេញពីខាងក្នុង callback របស់ `onValue`** ដូច្នេះ `debouncedRenderAfterHistorySync()` **មិនដែលរត់**
  ➜ តារាងកញ្ចប់ឈប់ update ទាំងស្រុង។ ចំណាំ៖ `buildScannerLookupPayload` **មាន** guard null ស្រាប់
  (`if (!b) return ...`) — ភស្តុតាងថាវាជាការភ្លេចមួយកន្លែង មិនមែនជាការសម្រេចទេ។
- **រូបរាង object** — `Array.isArray` guard ទាំង ៦៩ កន្លែងក្នុង ៣ App ធ្លាក់ទៅរូបរាង legacy
  barcode តែមួយ ➜ ផលបូកលុយខុស, `isClosed` ខុស, ហើយក្នុង **Zoescan barcode នោះរកមិនឃើញ ➜
  កំណត់ទីតាំង locker មិនបាន ➜ រកកញ្ចប់អតិថិជនមិនឃើញ**។
  **ប៊ូតុង "🔄 កំណត់ទិន្នន័យ Scanner Lookup ឡើងវិញ" ស្តារករណីនេះមិនបានទេ** ព្រោះ
  `buildScannerLookupPayload` ប្រើ `Array.isArray` ដដែល ➜ វាសរសេរ lookup entry **គ្មាន `barcodes`
  សោះ**។ ក្រោយការកែនេះ ប៊ូតុងនោះទើបស្តារបានពិត។

**កែ**៖ `barcodeEntriesOf(value)` ថ្មី — **byte-identical ទាំង ៣ App អាជីវកម្ម** — ត្រឡប់
`{barcode, index}` តាមលំដាប់ key ជាលេខ ដោយច្រោះ null ចេញ។
- **ZoeAdmin/ZoeW**៖ normalizer សាង array ក្រាស់ឡើងវិញ (២ App នេះរក barcode តាម `code` មិនមែនតាម
  index ហើយវាសរសេរ item ទាំងមូល ដូច្នេះការបង្រួមសុវត្ថិភាព — ហើយការសរសេរបន្ទាប់ **ជួសជុល record
  ក្នុង Firebase** ដោយស្វ័យប្រវត្តិ)។ បន្ថែម `if (!b || typeof b !== 'object') return;` ដែរ។
- **Zoescan**៖ index **រក្សា key ជាលេខដើម** ព្រោះ `assignLockerToEntry()` សរសេរទៅ
  `zoew_scan_history_cod_dod/{id}/barcodes/{idx}/...` — index ដែលបង្រួមរួចនឹងចុះខុសកន្លែង។
  **នេះជាចំណុចដែលងាយធ្វើខុសបំផុតក្នុងការកែនេះ** — មានតេស្ត assert ដោយឡែក។

### កំហុសទី ២ — Setup Link ដែលបើកចោល រស់រានក្រោយចាកចេញ (ZoeW, Zoescan)
ជុំ ៦ បិទផ្លូវ cancel (`cancelPinSetupFlow`/`cancelPinEntryFlow`) **តែភ្លេចផ្លូវ logout**។
`showLoginModalWithPrefill()` និងសាខា sign-out របស់ Zoescan បិទ `pinModal` ដោយ `closeModal()`
ដោយផ្ទាល់ — មិនឆ្លងកាត់ `data-close` ទេ — ដូច្នេះ `pendingSetupLinkConfig` នៅដដែល។ ក្រោយមក
ពេលអ្នកណាម្នាក់បើកប្រអប់ Config ធម្មតា វា **បំពេញ config របស់អាជីវកម្មផ្សេងចូល** ហើយប៊ូតុង
"រក្សាទុក" នៅចម្ងាយមួយចុច។ នេះជាហានិភ័យ mis-provisioning ពិត សម្រាប់គំរូអតិថិជន ២០០-៣០០។
ZoeAdmin រួចខ្លួនដោយសារ `checkPinAndOpenConfig()` reset `pinTargetAction` ជាមុន (ជុំ ៦)។

**កែ**៖ សម្អាតពេលចាកចេញទាំង ៤ App — **តែមាន guard `isPinFlowPending()`** ដូច្នេះ Setup Link ដែល
អ្នកប្រើ **កំពុងវាយ PIN ពិតៗ** មិនត្រូវបោះចោលទេ។ `isPinFlowPending()` ត្រូវបានចម្លងពី ZoeKeyGen
(ជុំ ១០) ទៅ ៣ App ទៀត។ វានៅក្នុង `EXPECTED_DIVERGENT` ព្រោះ ZoeKeyGen ប្រើ `classList('active')`
ចំណែក ៣ App ទៀតប្រើ `style.display === 'flex'` — ដូច `openModalHelper`/`closeModal` ស្រាប់។
**ផ្ទៀងផ្ទាត់ថាការកែនេះមិនបំផ្លាញការដំឡើងលើកដំបូង**៖ លើឧបករណ៍គ្មាន config, `initFirebase()`
return **មុន** បង្កើត auth listener ទាំង ៣ App ដូច្នេះ `showLoginModalWithPrefill()` មិនរត់ពេល boot។

### កំហុសទី ៣ — ZoeAdmin ទាញតារាងអតិថិជនរាល់ ១៥ នាទី ដោយគ្មាន auth check
`setInterval(prefetchCustomerDataTableRowsIfConfigured, CUSTOMER_TABLE_CACHE_MS)` គឺជា timer **តែមួយ
ក្នុង ៤** ដែលគ្មាន guard `auth.currentUser` (ឯទៀតទាំងអស់មាន)។ ផល ២៖
១. `clearCustomerDataTableCache()` ពេលចាកចេញ ត្រូវបាន **លុបចោលវិញរៀងរាល់ ១៥ នាទី ជារៀងរហូត** —
   ការងារអនាម័យទិន្នន័យលើឧបករណ៍រួមរបស់ជុំ ៣/៤/៥/៨ ត្រូវបានបំបាត់ដោយស្ងាត់។ ការការពារ
   `customerDataTableSessionGeneration` មិនជួយទេ ព្រោះ **គ្មានការចាកចេញកើតឡើងកំឡុង fetch នោះ**។
២. ឧបករណ៍ដែលទុកចោលនៅអេក្រង់ login នៅតែហៅ Apps Script `?list=1` រាល់ ១៥ នាទី — ខ្ជះខ្ជាយ quota។
**កែ**៖ guard នៅក្នុង `prefetchCustomerDataTableRowsIfConfigured()` ផ្ទាល់ ហើយហៅវាម្តងក្រោយ
ការផ្ទៀងផ្ទាត់ role ជោគជ័យ ដូច្នេះ cache នៅតែក្តៅទាន់ពេលមុនស្កេនដំបូង។

### កំហុសទី ៤ — `localStorage.setItem` ខាងក្នុង listener (ថ្នាក់ដដែលនឹងទី ១)
`onValue` របស់អត្រាប្តូរប្រាក់ធ្វើ `setItem` ដោយគ្មាន try — លើឧបករណ៍ដែលផ្ទុកពេញ
`QuotaExceededError` នឹងសម្លាប់ callback មុន `debouncedRenderAfterHistorySync()`។ ដាក់ try/catch។
(នេះជា `setItem` **តែមួយគត់** ក្នុង callback របស់ `onValue` ទាំង ៤ App — ពិនិត្យដោយ script។)

### កំហុសទី ៥ — `env()` គ្មាន fallback (ថ្នាក់ដដែលនឹងជុំ ៩ តែជុំ ៩ កែតែ toast)
បើ browser មិនស្គាល់ `env()` នោះ **ការប្រកាសទាំងមូលត្រូវបោះចោល**៖
- `.app-navbar { padding: calc(8px + env(safe-area-inset-top)) ... }` ➜ navbar **គ្មាន padding សោះ**
- `.ptr-indicator { top: calc(env(...) + 10px) }` លើធាតុ `position: fixed` ➜ `top: auto`
បន្ថែម fallback នាំមុខ។ ពិនិត្យ `env()` ទាំង ១៦ កន្លែង៖ ២ ដែលនៅសល់មិនត្រូវការទេ ព្រោះមាន
ការប្រកាសសុវត្ថិភាពនាំមុខរួចហើយ (`padding: 8px` និង `min-height: 100dvh` មូលដ្ឋាន)។

### ឧបករណ៍ថ្មី ៤ — ប្តូរ **ថ្នាក់** កំហុសទៅជាការត្រួតពិនិត្យស្វ័យប្រវត្តិ
នេះជាចម្លើយពិតចំពោះសំណួររបស់អ្នកប្រើ — កុំរកកំហុសដដែលដោយភ្នែករាល់ជុំ៖
- **`state-hygiene.js`** — អថេរ state កម្រិត module ដែលរស់រានក្រោយចាកចេញដោយគ្មានហេតុផលកត់ត្រា។
  **ថ្នាក់នេះត្រូវបានរកឃើញដោយភ្នែកនៅជុំ ៣, ៤, ៥, ៦ និង ៧** (lookupSecretKey, pendingRestoreId,
  signingKeySessionKey, pendingSetupLinkConfig ។ល។)។ វារកឃើញកំហុសទី ២ ភ្លាមៗ។
- **`css-classes.js`** — class ដែល JS/HTML ប្រើ តែគ្មានច្បាប់ CSS។
- **`barcode-shape-test.js`** (28) និង **`setup-link-logout-test.js`** (21)។

### ភស្តុតាងថាតេស្តមិនទទេ
- `barcode-shape-test.js` ➜ **ធ្លាក់ ១៦/២៨** លើ `origin/main` រួមទាំង throw ពិត
  `Cannot read properties of null (reading 'cod')` និង Zoescan ចេញ `["AAA"]` (បាត់ `BBB`)។
- `setup-link-logout-test.js` ➜ **ធ្លាក់ ៦/១៥** លើ `origin/main` ដោយបង្ហាញ
  `{"projectId":"business-B"}` នៅរស់រានក្រោយចាកចេញ។
*អន្ទាក់៖ ត្រូវ `git archive origin/main` ចូលថតដាច់ដោយឡែក រួចប្រើ `<TOOL>_APP_DIR=` — កុំយក `HEAD`។*

### ពិនិត្យហើយស្អាត — កុំ audit ឡើងវិញដោយងងឹតងងុល
- **PR #35/#36 (ធ្វើលើទូរស័ព្ទ) គ្មានកំហុសទេ** — តាមដាន guard ទាំងអស់៖ `phoneModalDismissPromptOpen`
  ត្រឹមត្រូវ (`confirm()` ទប់ thread ដូច្នេះ `setTimeout(...,0)` មិនអាចរត់មុន handler ទី ២);
  `pdfExportOriginalTitle === null` ត្រឹមត្រូវ (ការពារ title ត្រូវរក្សាទុកជាឈ្មោះឯកសារ ពេល
  `afterprint` មិនបាញ់); `data-nodismiss` ថេរលើ `phoneModal` ត្រឹមត្រូវ; ការដក `{once:true}`
  មិនធ្វើឲ្យ listener កកកុញទេ ព្រោះ `addEventListener` dedupe function reference ដដែល។
- **NaN ក្នុងលុយ**៖ ពិនិត្យ `parseFloat`/`parseInt`/`Number()` គ្រប់កន្លែងទាំង ៤ App — មាន guard
  គ្រប់ (`|| 0`, `isNaN(...)`, `val && !isNaN(val)`)។ គ្មានផ្លូវ NaN ចូលស្ថិតិទេ។
- `forEach(async` / `.map(async` គ្មាន `Promise.all` — **គ្មានសោះ** ទាំង ៤ App។
- `.find()`/`.findIndex()` គ្រប់កន្លែងមាន guard `-1`/`!item`។
- Service worker ទាំង ៤ ដូចគ្នាបេះបិទ លើកលែងតែ `CACHE_VERSION`, prefix នៃការសម្អាត និង APP_SHELL;
  `url.origin !== self.location.origin` នៅដើម handler `fetch` ➜ **REST ដែលមាន token មិនចូល cache**។
- `manifest.json` ទាំង ៤ ត្រឹមត្រូវ (`id`/`start_url`/`scope` ដូចគ្នា, icon `any maskable`)។
- `netlify.toml`៖ CSP ទាំង ៤ ត្រឹមត្រូវតាមតម្រូវការរបស់ App នីមួយៗ (Zoescan នៅតែគ្មាន
  `'unsafe-inline'`; ZoeW គ្មាន `script.google.com` ព្រោះវាគ្មាន lookup)។
- `EXPORT_TEXT_COLUMN_INDEXES = [1, 2]` នៅត្រូវនឹង `EXPORT_HEADERS` (1=ទូរស័ព្ទ, 2=Barcode)។
- `readUserRoleViaRest()` មិនដែលដាក់ URL (ដែលមាន token) ចូលសារកំហុស ឬ Sentry extra ទេ —
  `lastRoleRestOutcome` ផ្ទុកតែ status/សារដែលសម្អាតរួច។ `isFirebaseDatabaseHost()` តឹងត្រឹមត្រូវ។
- `license-verify.js` និង `error-reporting.js` នៅ byte-identical ទាំង ៤; comment = 0;
  trailing whitespace = 0; rules JSON ទាំងពីរ valid។

### កំហុសទី ៦ និង ៧ — កែក្រោយមក តាមការអនុញ្ញាតរបស់អ្នកប្រើ ("កែទាំងអស់ចុះ ... អោយសុីសង្វាក់គ្នា")
ទាំងពីរនេះដំបូងត្រូវបានរាយការណ៍ជាការស្នើ (ព្រោះមួយប៉ះស្ថិតិ មួយទៀតប៉ះ deploy) រួចអ្នកប្រើអនុញ្ញាត។

**ទី ៦ — `item.count` ទល់នឹង `barcodes.length`។** ZoeAdmin បង្ហាញ `item.count` ចំណែក ZoeW
បង្ហាញ `barcodes.length` ➜ ២ App អាចបង្ហាញលេខកញ្ចប់ **ខុសគ្នាសម្រាប់ការបញ្ជាទិញតែមួយ**។
កែ ២ កន្លែង៖ (១) normalizer កំណត់ `item.count = item.barcodes.length` **តែពេល `barcodes` ជា
array ពិត និងមិនទទេ** — ដូច្នេះ item legacy (គ្មាន `barcodes[]`) និង array ទទេ **រក្សា `count`
ដដែល ហើយគណនាស្ថិតិមិនប្រែ**; (២) ZoeAdmin ប្រើ expression `totalPackageCount` ដដែលនឹង ZoeW។
ហេតុផលថាវាសុវត្ថិភាព៖ **គ្រប់ផ្លូវសរសេរទាំងអស់** (`addOrUpdateEntry`, `removeSingleBarcode`,
`claimAndCleanupItem` ×2, `executeRestoreItem`) គណនា `count` ចេញពី `barcodes.length` រួចហើយ —
ដូច្នេះ record ណាដែលខុសគ្នា គឺខូចរួចជាស្រេច ហើយការ normalize ធ្វើឲ្យស្ថិតិ **ត្រូវ** វិញ។
ចំណាំ៖ ការកែ barcodes ខាងលើ (ទី ១) អាច**បង្កើត**ភាពខុសគ្នានេះ ព្រោះការច្រោះ `null` ចេញ
ធ្វើឲ្យ `barcodes.length` តូចជាង `count` ចាស់ — ដូច្នេះ ២ ការកែនេះទៅជាមួយគ្នា។

**ទី ៧ — `google-sheets-api/Code.gs` fail-open។** `if (secret && key !== secret)` មានន័យថា
បើ ScriptProperty `API_KEY` **មិនបានកំណត់** នោះការត្រួតពិនិត្យត្រូវបាន **រំលងទាំងស្រុង** ➜
អ្នកណាដែលដឹង URL អាចទាញ **បញ្ជីអតិថិជនទាំងមូល** តាម `?list=1` (Web App ជា "Anyone")។
README តម្រូវឲ្យកំណត់ `API_KEY` នៅ step 2.3 រួចហើយ ដូច្នេះនេះជារន្ធសម្រាប់អ្នកដែលភ្លេចជំហាននោះ។
ឥឡូវ **fail closed**៖ គ្មាន `API_KEY` ➜ ឆ្លើយ `API_KEY script property is not set`។
**មិនប៉ះការដំឡើងដែលមានស្រាប់ទេ** ព្រោះ `Code.gs` ជា *template* — អ្នកលក់ copy វាចូល Apps
Script ខ្លួនឯង ដូច្នេះការកែ repo មិនប្តូរ script ដែល deploy រួច។ README ព្រមានឲ្យ copy ជំនាន់
ថ្មីទៅជំនួស ហើយ deploy ម្តងទៀត។

### ការបែកគ្នាដែលខ្ញុំបង្កើតឡើងខ្លួនឯង រួចកែវិញ
`extract.js` ចាប់បាន `showLoginModalWithPrefill` ក្លាយជាបែកគ្នា (២៣ ➜ ២៤) ព្រោះខ្ញុំដាក់ការ
reset ក្នុង **កន្លែងខុសគ្នា**៖ ZoeAdmin ក្នុង `clearSensitiveModalFields()` តែ ZoeW ក្នុង
`showLoginModalWithPrefill()`។ ផ្លាស់ ZoeW ចូល `clearSensitiveModalFields()` ដែរ ➜ ត្រឡប់មក
**២៣ divergent ដូចដើម** ហើយ identical ឡើងពី ១០១ ➜ **១០៣**។ **រត់ `extract.js` ក្រោយកែរាល់ដង។**

### រកឃើញ តែ **មិនបានកែ** ដោយចេតនា
- **ការ re-provision ឧបករណ៍ដែលមាន config រួច តែចាកចេញរួច តាម Setup Link មិនដើរស្វ័យប្រវត្តិទេ**
  (ឥរិយាបថចាស់ មិនមែនការតំរែតំរង់ថ្មីទេ)៖ `applySetupLinkFromUrl()` បើក `pinModal` រួច auth
  listener បាញ់ `null` ហើយ `showLoginModalWithPrefill()` បិទវាជំនួសដោយ `loginModal`។ ការកែ guard
  `isPinFlowPending()` ខាងលើរក្សា Setup Link ទុកក្នុងករណីនោះ ដូច្នេះ **ការបើក Config បន្ទាប់
  នឹងបំពេញវាឲ្យ** — គ្រាន់តែគ្មានផ្លូវបើកខ្លួនឯងក្រោយ login ទេ។
  **✅ សម្រេចដោយអ្នកប្រើ (2026-08-20)៖ ទុកដដែល។** ត្រូវបានស្នើឲ្យបន្ថែមការបើកស្វ័យប្រវត្តិក្រោយ
  login ហើយអ្នកប្រើឆ្លើយថា *"មិនអីទេទុកចឹងហើយសុវត្តិភាព"*។ ហេតុផល៖ ការធ្វើវាតម្រូវឲ្យប៉ះ
  `verify*RoleThenProceed` ដែលជាផ្លូវ login — កន្លែងផុយបំផុតក្នុងគម្រោងនេះ (មូលហេតុ ៤ ជាប់គ្នា
  ក្នុង PR #24/#25/#26)។ **ជុំក្រោយកុំលើកវាឡើងជាកំហុសទៀត** — វាជាការសម្រេចដោយចេតនា។
- អ្វីៗដែលជុំមុនទទួលយកដោយចេតនា នៅដដែលទាំងអស់។

### ចម្លើយចំពោះសំណួររបស់អ្នកប្រើ — "ជុំមុនមិនបានមើលគ្រប់ជ្រុងជ្រោយទេឬ?"
ស្មោះត្រង់៖ **ជុំមុនៗពិតជាមិនបានគ្របគ្រប់ជ្រុងទេ តែមិនមែនព្រោះមើលរំលងកន្លែងដដែលទេ។** កំហុស ៥
ក្នុងជុំនេះ គ្មានមួយណាស្ថិតក្នុងកូដដែលជុំមុនអានហើយវិនិច្ឆ័យខុសនោះទេ — វាស្ថិតក្នុង **ឆាកដែល
មិនធ្លាប់មានឧបករណ៍ណាពិនិត្យ**៖ រូបរាងទិន្នន័យដែល Firebase ត្រឡប់មក (ទី ១), អថេរ state ពេលចាកចេញ
(ទី ២), timer ដែលគ្មាន auth guard (ទី ៣), និង CSS (ទី ៥)។ ជុំនីមួយៗបានបន្ថែមឧបករណ៍ ហើយឧបករណ៍
ទាំងនោះឥឡូវ **ស្អាតទាំងអស់** — នោះជាមូលហេតុដែលកំហុសដដែលមិនត្រឡប់មកវិញ។ របៀបធ្វើឲ្យវាចប់គឺ
បន្តប្តូរ *ថ្នាក់* កំហុសនីមួយៗទៅជាការត្រួតពិនិត្យស្វ័យប្រវត្តិ ដូចជុំនេះធ្វើ ៤ — មិនមែនអានកូដ
ដដែលឡើងវិញឲ្យខ្លាំងជាងមុនទេ។

`CACHE_VERSION` bump ទាំង ៤ (zoeadmin-v45, zoew-v39, zoescan-v33, zoekeygen-v26)។
**គ្មានការប្តូរ Firebase rules ➜ គ្មាន publish ថ្មី។**
Suite សរុប (រាប់ដោយ script មិនមែនដោយដៃ)៖ **438 assertion** + ឧបករណ៍មេកានិក ៦ — បៃតងទាំងអស់។
`CACHE_VERSION` ចុងក្រោយ៖ zoeadmin-v47, zoew-v41, zoescan-v33, zoekeygen-v26។

## ស្វែងរកលេខទូរស័ព្ទ៖ ការអូសឡើងលើបំបាត់ប្រអប់ស្វែងរក (fixed 2026-08-20, ជុំ ១១)

អ្នកប្រើផ្ញើវីដេអូ៖ កំពុងស្វែងរកលេខទូរស័ព្ទ ហើយពេលអូសឡើងលើ ដុំស្នើលេខ **បាត់ទាំងស្រុង**
ព្រោះប្រអប់ប្រវត្តិឡើងគ្របលើ keyboard។ លក្ខខណ្ឌច្បាស់លាស់របស់អ្នកប្រើ៖ **កុំប៉ះឥរិយាបថ
"អូសឡើង ➜ ប្រអប់ប្រវត្តិទាញឡើង / អូសចុះ ➜ ប្រអប់ប្រវត្តិចុះវិញ"**។

### មូលហេតុ
`#searchPhoneInput` ស្ថិតនៅ **ក្នុង `.sidebar-section`**។ `setupSwipeGestures()` ដាក់
`sidebar.classList.add('collapsed')` ពេលអូសឡើង ដែល CSS កំណត់ `max-height: 0; opacity: 0;
overflow: hidden` — ដូច្នេះវាបិទ **ប្រអប់ស្វែងរកដែលអ្នកប្រើកំពុងវាយ** ជាមួយផង។ បន្ទាប់មក
`positionPhoneSuggestBox()` អាន rect ដែលមានទំហំ 0 ➜ លាក់ដុំស្នើលេខ ➜ វាមិនត្រឡប់មកវិញទេ
ព្រោះមានតែ `input`/`focus` ប៉ុណ្ណោះដែលបង្ហាញវាឡើងវិញ។

### អ្វីដែលបានកែ (ZoeAdmin និង ZoeW — នៅតែ byte-identical)
- `phoneSearchIsActive()` ថ្មីក្នុង `setupSwipeGestures()`៖ ពិត នៅពេលដុំស្នើលេខកំពុងបើក
  **ឬ** `searchPhoneInput` កំពុង focus ហើយមានអក្សរក្នុងវា។
- ការអូសឡើងលើ **រំលងការបិទ sidebar** តែពេលនោះប៉ុណ្ណោះ។ តារាងប្រវត្តិនៅតែ scroll បានធម្មតា
  ដូច្នេះអ្នកប្រើនៅតែមើលលទ្ធផលបាន ដោយប្រអប់ស្វែងរកមិនបាត់។
- ប៊ូតុងអូស (`dragHandle`) នៅតែបិទបានជានិច្ច (ជាចេតនាច្បាស់លាស់របស់អ្នកប្រើ) ហើយវា
  `hidePhoneSuggestions()` ជាមុន ដូច្នេះគ្មានដុំអណ្តែតសល់។
- `positionPhoneSuggestBox()` លាក់ដុំបើ rect ជា 0×0 (ការពារពេល sidebar បិទតាមផ្លូវផ្សេង)។

### ភស្តុតាង — `audit-tools/phone-search-swipe-test.js` (18 assertion)
ដក `setupSwipeGestures` ពិតចូល `vm` ជាមួយ DOM ក្លែងក្លាយដែលចាប់ handler ពិត។ លើ `origin/main`
➜ **ធ្លាក់ ១០/១៨** — **តែ assertion ២ ដែលអ្នកប្រើសុំកុំឲ្យប៉ះ ("អូសឡើង ➜ ប្រវត្តិឡើង" និង
"អូសចុះ ➜ ប្រវត្តិចុះ") ជោគជ័យទាំងមុន និងក្រោយ** — ភស្តុតាងផ្ទាល់ថាឥរិយាបថដើមមិនប្រែ។

`CACHE_VERSION` bump (zoeadmin-v46, zoew-v40)។ **គ្មានការប្តូរ rules ➜ គ្មាន publish ថ្មី។**
Zoescan/ZoeKeyGen មិនប៉ះ (គ្មាន sidebar ស្វែងរកលេខបែបនេះ)។


## ចុចប្រអប់ស្វែងរក ➜ តារាងប្រវត្តិទាញឡើងលើ (added 2026-08-20, PR #38)

ស្នើដោយអ្នកប្រើភ្លាមក្រោយជុំ ១១៖ លើទូរស័ព្ទ sidebar (កាតកាមេរ៉ា, Barcode scanner, ស្ថិតិ) ស៊ី
កន្លែងស្ទើរតែទាំងអេក្រង់ ដូច្នេះពេលចុចប្រអប់ស្វែងរក keyboard គ្របអ្វីដែលនៅសល់ ហើយតារាងប្រវត្តិ
ត្រូវរុញធ្លាក់ក្រោមបាត — ស្ទើរតែមើលមិនឃើញជួរណាទេ។

### ការសម្រេចសំខាន់ — **កុំប្រើ `.collapsed`**
`.collapsed` បិទ **sidebar ទាំងមូល** ដែលរួមទាំង `#searchPhoneInput` ខ្លួនវាផង — នោះជាកំហុស
ដែលអ្នកប្រើរាយការណ៍ដោយវីដេអូក្នុងជុំ ១១។ ដូច្នេះ mode ថ្មីនេះបិទ **កូនទាំងអស់លើកលែងកូនចុងក្រោយ**៖
```css
.sidebar-section.search-focus > *:not(:last-child) { max-height: 0; opacity: 0; ... }
.sidebar-section.search-focus { gap: 0; }
```
វាដើរបានព្រោះ **កាតស្វែងរកជាកូនចុងក្រោយនៃ `.sidebar-section` ទាំង ZoeAdmin និង ZoeW**
(ZoeAdmin មានកូន ៤, ZoeW មានកូន ២)។ **បើថ្ងៃណាមួយបន្ថែមកាតថ្មីនៅក្រោមកាតស្វែងរក ច្បាប់នេះនឹងខូច**
— ត្រូវប្តូរទៅ selector ជាក់លាក់ជំនួស `:not(:last-child)`។

ប្រើ `max-height`/`opacity` មិនមែន `display: none` **ដោយចេតនា**៖ `display: none` លើកាតកាមេរ៉ា
អាចបញ្ឈប់ការបញ្ជូន frame ➜ ខូចការស្កេន barcode។ ការកាត់ត្រឹមកម្ពស់ 0 ទុក video ឲ្យនៅ render ដដែល។

### JS
`setPhoneSearchPulledUp(on)` — **byte-identical ទាំង ZoeAdmin និង ZoeW**៖
- `focus` លើ `#searchPhoneInput` ➜ បើក · `blur` ហើយវាល **ទទេ** ➜ បិទ (បើមានលេខ វានៅបើក
  ដើម្បីឲ្យអ្នកប្រើមើលលទ្ធផល)
- វា **លុប `.collapsed` ចេញ** ពេលបើក ដូច្នេះប្រអប់ស្វែងរកមិនអាចទៅលាក់ខាងក្រោយ mode ថ្មីបានទេ
- **no-op លើ `innerWidth >= 992`** (desktop — sidebar ជា column ពិត)
- ហៅ `positionPhoneSuggestBox()` ៣ ដង (0ms, 180ms, 340ms) ព្រោះ CSS transition ចំណាយ ~280ms
  ហើយដុំស្នើលេខជា `position: fixed` ដែលត្រូវតាមទីតាំងថ្មីរបស់ input
- ត្រូវបាន reset ក្នុង `clearSensitiveModalFields()` (ចាកចេញ)

**ផ្លូវត្រឡប់ ៣** (ដើម្បីកុំឲ្យអ្នកប្រើជាប់គាំង)៖ blur ពេលវាលទទេ · អូសចុះលើតារាងប្រវត្តិ ·
ចុច `dragHandle`។

### ទំនាក់ទំនងនឹងការកែជុំ ១១
`phoneSearchIsActive()` (ជុំ ១១) នៅដដែល — វាទប់ការអូសឡើងកុំឲ្យបិទ sidebar ពេលកំពុងស្វែងរក។
ឥឡូវការអូសឡើងគ្មានអ្វីត្រូវធ្វើទេ (ទាញឡើងរួចហើយ) ហើយ **ការអូសចុះ** បានសាខាថ្មីមួយដែល
ហៅ `setPhoneSearchPulledUp(false)`។

### តេស្ត — `audit-tools/phone-search-swipe-test.js` ឡើងជា **30 assertion**
លើ `main` មុនកែ ➜ **ធ្លាក់ ៦** (18/24)។ **assertion ២ ដែលអ្នកប្រើសុំកុំឲ្យប៉ះ ("អូសឡើង ➜
ប្រវត្តិឡើង" និង "អូសចុះ ➜ ប្រវត្តិចុះ") ជោគជ័យទាំងមុន និងក្រោយ។**

**បានផ្ទៀងផ្ទាត់ដោយរូបភាពពិត** (Playwright + Chromium ក្នុង container, viewport 412×780)៖
តារាងប្រវត្តិឡើងពី ~០ ជួរ ទៅ **៥ ជួរ**។ Script នៅ scratchpad — សាងឡើងវិញបានដោយ
`npm i playwright-core` រួចប្រើ `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
បម្រើថត App តាម HTTP server តូចមួយ, រួច `page.evaluate` លាក់ modal និងហៅ `renderHistory()`
ដោយទិន្នន័យក្លែងក្លាយ។ **font ខ្មែរមិនមានក្នុង container ➜ អក្សរបែក តែ layout ត្រឹមត្រូវ។**

### អន្ទាក់ដែលជួប (harness មិនមែនកូដ App)
ការបន្ថែម `setPhoneSearchPulledUp()` ធ្វើឲ្យតេស្ត ៣ គាំង ព្រោះ harness របស់វាដក function ពិត
មករត់ក្នុង `vm` ហើយមិនមាន stub សម្រាប់វា — `phone-suggest-test`, `setup-link-logout-test` និង
`phone-search-swipe-test` (លើ tree មុនកែ)។ **រាល់ពេលបន្ថែមការហៅ function ថ្មីចូលផ្លូវដែលមាន
តេស្តរួច ត្រូវពិនិត្យ harness ទាំងអស់ដែលដក function នោះមករត់។**

`CACHE_VERSION` bump (zoeadmin-v48, zoew-v42)។ **គ្មានការប្តូរ rules ➜ គ្មាន publish ថ្មី។**
Zoescan/ZoeKeyGen មិនប៉ះ។ Suite សរុប៖ **450 assertion** — បៃតងទាំងអស់។

## ជុំ ១២ — deep audit (2026-08-20, branch `claude/deep-audit-yi21xn`)

ស្នើដោយអ្នកប្រើ ជាមួយសំណួរដដែលនឹងជុំ ១១៖ *"រាល់ការ audit មុនមុនអ្នកមិនបានមើលគ្រប់ជ្រុងជ្រោយទេឬ?"*
ចម្លើយនៅចុង section។ Branch ចេញពី `main` (`321a5d6`) ដោយផ្ទាល់។ រត់ inline single-threaded។
អ្នកប្រើអនុញ្ញាតច្បាស់លាស់៖ *"អោយតែកំហុសកែទាំងអស់"* ➜ ការកែដែលប៉ះលុយក៏បានអនុវត្តដែរ។

### ស្ថានភាពពេលចាប់ផ្តើម
ការត្រួតពិនិត្យទាំង ២៣ បៃតង (450 assertion)។ `git log 7b905dd..origin/main` = commit ឯកសារតែមួយ
➜ **គ្មានកូដដែលមិនទាន់មានឯកសារ** ➜ កំហុសថ្មីត្រូវតែមកពីឆាកដែលគ្មានឧបករណ៍ណាធ្លាប់ប៉ះ។

### កំហុសទី ១ (ធ្ងន់បំផុត) — ការកែរូបរាង `barcodes` ជុំ ១១ គ្របតែ **ផ្លូវអានតែមួយ**
ជុំ ១១ បានបង្កើតការពិតដ៏សំខាន់៖ RTDB ត្រឡប់ array ដដែលមក ៣ រូបរាង (`[A,B]` · `[A,null,B]` ·
`{0:A,2:B}`) ហើយបានកែ normalizer នៃ `onValue` របស់ប្រវត្តិ។ **តែផ្លូវអានទិន្នន័យឆៅមាន ៦ មិនមែន ១។**
`runTransaction` អាន **ពី server ដោយផ្ទាល់** មិនឆ្លងកាត់ normalizer ណាមួយទេ ហើយធុងសំរាមគ្មាន
normalizer សោះ។ លទ្ធផលតាមផ្លូវនីមួយៗ៖

| ផ្លូវ | រូបរាង object | រូបរាង null |
|---|---|---|
| `dbRefDeleted` (ធុងសំរាម) | `executeRestoreItem` ធ្លាក់ទៅសាខា legacy ➜ **ស្តារដោយគ្មាន barcode សោះ** ហើយបន្ថែមលុយកម្រិត item ខុស | throw កណ្តាល loop **ក្រោយ** លុយត្រូវបានបន្ថែមខ្លះ |
| `toggleIndividualBarcodeClose` | **សរសេរជាន់ `barcodes` ទាំងមូលដោយ barcode តែមួយ** ➜ barcode ឯទៀតបាត់ជារៀងរហូតក្នុង Firebase | throw ➜ បិទកញ្ចប់មិនបាន |
| `toggleCloseStatus` | barcode មិនត្រូវបានបិទ តែ item ប្តូរជា closed ➜ មិនស៊ីគ្នា | throw |
| `claimAndCleanupItem` | ចាត់ទុកជា legacy ➜ ដកលុយកម្រិត item ជំនួសតាម barcode | throw ➜ ការសម្អាត 2h/8d ជាប់គាំងជារៀងរហូត |
| `restoreClaimedItemToScanHistory` | `.map` លើ object ➜ throw ➜ **កញ្ចប់បាត់** (នេះជាផ្លូវសង្គ្រោះចុងក្រោយ) | throw |
| `executeRestoreItem` resync | សរសេរ `fb.get()` ឆៅចូល `scanHistory`/`deletedItems` ដោយរំលង normalizer ទាំងអស់ | ដូចគ្នា |

**ចំណុចដែលធ្វើឲ្យវាគ្រោះថ្នាក់ជាងធម្មតា៖** ការកែជុំ ១១ ធ្វើឲ្យ **UI មើលទៅត្រឹមត្រូវ** (normalizer
កែច្បាប់ចម្លងក្នុងសតិ) ខណៈ transaction សរសេរទិន្នន័យខូចចូល Firebase។ អ្នកប្រើនឹងមិនឃើញអ្វីខុសទេ
រហូតដល់លុយបាត់។

**កែ**៖ `normalizeBarcodesOf(item)` ថ្មី ក្បែរ `barcodeEntriesOf` (byte-identical ZoeAdmin/ZoeW)
ត្រូវបានហៅនៅគ្រប់ផ្លូវអានឆៅទាំង ៦។ **Zoescan រក្សា index ជាលេខដើម** ព្រោះ mirror write ចង្អុលទៅ
`barcodes/{idx}` ដោយផ្ទាល់ — ការបង្រួម index នឹងចុះខុសកន្លែង។ Rules អនុញ្ញាតការសរសេរដែលបានរៀបចំ
ឡើងវិញរួចហើយ (ការបន្ធូរ `!== 'scanner'` ជុំ ៦ ដែលបានផ្ទៀងផ្ទាត់លើ emulator) ➜ គ្មាន rules ថ្មី។

### កំហុសទី ២ — Setup Link របស់ ZoeAdmin **មិនដែលដំណើរការសោះ**
មុខងារដែលសាងឡើងសម្រាប់អតិថិជន ២០០-៣០០ ត្រូវបានបំបែកដោយការកែជុំ ៦។ លំដាប់ boot៖
`applySetupLinkFromUrl()` ➜ `requestPinBeforeConfig(callback)` កំណត់ `pinTargetAction` ➜ រួច
`initFirebase()` ហៅ `checkPinAndOpenConfig(true)` ដែលជុំ ៦ បានបន្ថែម `pinTargetAction = null`
នៅបន្ទាត់ដំបូង ➜ **callback ត្រូវបានលុបមួយបន្ទាត់ក្រោយមក**។ អ្នកលក់ផ្ញើ link ➜ ហាងកំណត់ PIN ➜
**ប្រអប់ Config បើកទទេ** ➜ ត្រូវ paste ដោយដៃ ដែលជាបញ្ហាដែល Setup Link កើតឡើងដើម្បីដោះស្រាយ។
ZoeW/Zoescan មិនរងផលទេ (ពួកវាប្រើ `pendingSetupLinkConfig` ដែល `checkPinAndOpenConfig` មិនប៉ះ)។
**កែ**៖ `checkPinAndOpenConfig()` return មុន ពេល `isPinFlowPending()` — guard ដដែលដែលជុំ ១១
បន្ថែមទៅ ZoeKeyGen សម្រាប់កំហុសដូចគ្នាបញ្ច្រាស។

### កំហុសទី ៣ — ZoeKeyGen បណ្តេញអ្នកគ្រប់គ្រងខ្លួនឯងចេញ
`checkDevTools()` បាញ់ពេល `outerWidth - innerWidth > 160`។ នោះមិនមែនសញ្ញាណរបស់ devtools ទេ —
**zoom ចូល** បង្រួម `innerWidth` ខណៈ `outerWidth` នៅដដែល, ហើយ window តូច ឬ side panel ក៏ដូចគ្នា។
ពីរ tick ក្រោយ (~២ វិនាទី) ទំព័រក្លាយជា `about:blank` **គ្មានសារសោះ** ➜ អ្នកប្រើគិតថា App ខូច។
**វាស់ពិត មិនមែនវែកញែក**៖ បើក ZoeKeyGen ក្នុង Chromium នៅ viewport 320px ➜
`outerWidth=500 innerWidth=320` គម្លាត 180 ➜ navigate ទៅ `about:blank` ដោយគ្មាន devtools។
**កែ**៖ វាស់គម្លាតទល់នឹង baseline ដែលចាប់ពេល load ហើយបាញ់តែពេល **អក្ស័យតែមួយ** កើន —
devtools ចត​នឹងគែមតែមួយ ចំណែក zoom និងការប្តូរទំហំ window ផ្លាស់ទាំងពីរ។ ការបណ្តេញ, ការរំលង
ទូរស័ព្ទ, keyboard shortcut និង hit-count នៅដដែលទាំងអស់។

### កំហុសទី ៤ — CDN យឺត ➜ ZoeAdmin ស្កេនមិនចូល ដោយគ្មានសញ្ញា
App ទាំង ៣ ទាញ `@zxing/library` ពី unpkg តាម `<script defer>` **តែមានតែ Zoescan** ដែលដោះស្រាយ
ការមិន load។ ZoeAdmin សាង `codeReader`/`liveScanCodeReader` តែម្តងក្នុង `DOMContentLoaded` ➜
CDN យឺត/ត្រូវទប់ ➜ ទាំងពីរនៅ null **ជារៀងរហូត**។ រោគសញ្ញាអាក្រក់៖ **កាមេរ៉ាបើក វីដេអូដើរ តែ
គ្មាន barcode ចូល** ព្រោះ `catch (e) {}` ទទេក្នុង decode loop លេប `ReferenceError` រាល់ frame។
**កែ**៖ ចម្លង `waitForZXingThenInitScanEngine` របស់ Zoescan (poll 300ms, deadline ១៥ វិនាទី,
រួច toast ប្រាប់ឲ្យ refresh ឬប្រើម៉ាស៊ីនស្កេនដៃ) ហើយ loop រំលងពេល reader ជា null។

### វិធីសាស្ត្រថ្មី — **រត់ App ពិតក្នុង Chromium**
កំហុសទី ២, ៣ និង ៤ **មិនអាចរកឃើញដោយឧបករណ៍ static ណាមួយទេ** — ទាំងបីត្រូវការការរត់ពិត។
នេះជាឆាកដែលគ្មានជុំណាធ្លាប់ប៉ះ ហើយវាបានផលភ្លាមៗ។ ឧបករណ៍ថ្មី ២៖
- **`boot-runtime.js`** — boot ទាំង ៤ App ក្នុង Chromium ដោយទប់សំណើក្រៅ រួចចាប់ `pageerror`
  និង `console.error`។ វារកឃើញកំហុសទី ៤។
- **`setup-link-browser-test.js`** — ដើរផ្លូវ provisioning ពិត៖ `?setup=` ➜ PIN gate ➜
  ប្រអប់ Config ដែលបំពេញរួច ➜ ហើយ assert ថា **គ្មានអ្វីត្រូវរក្សាទុករហូតដល់មនុស្សចុច Save**។
  វារកឃើញកំហុសទី ២។ 18/18 ទីនេះ, ZoeAdmin ធ្លាក់លើ `main`។
ទាំងពីរ **SKIP ដោយស្អាត** ពេលគ្មាន playwright-core ឬ Chromium ➜ `run-all.sh` នៅតែរត់បាន។

### ឧបករណ៍ថ្មីទី ៣ — `payload-schema.js` (ប្តូរការផ្ទៀងផ្ទាត់ដោយដៃ ➜ ស្វ័យប្រវត្តិ)
Runbook រាយ "payload ↔ schema ក្នុង rules" ជាថ្នាក់ដែលផ្ទៀងផ្ទាត់ដោយដៃ ហើយវាធ្លាប់បង្ក
production outage (`zoew_daily_pickup_cod_dod` ➜ `permission_denied`)។ ឥឡូវ acorn ប្រមូល
គ្រប់ property ដែលកូដកំណត់លើអថេររាងជា item/trash/barcode រួចប្រៀបនឹង rules — រាយការណ៍តែកន្លែង
ដែល `$other: false` (ជាកន្លែងតែមួយដែល field ចម្លែកត្រូវបានបដិសេធពិត)។ អថេររាងជា item ធ្វើដំណើរ
**ទាំងពីរទិស** ដូច្នេះវាត្រូវបានពិនិត្យទល់នឹងសហភាព; ហានិភ័យតាមទិសត្រូវបានគ្របដាច់ដោយឡែក —
`scan_history` គ្មាន `deletedAt`/`isFromDeletion` ដូច្នេះផ្លូវស្តារទាំង ២ ត្រូវលុបវាមុនសរសេរត្រឡប់។
**Mutation-tested មិនមែនសន្មតថាបៃតង**៖ បន្ថែម barcode field ក្រៅ schema, និងលុប
`delete itemToRestore.isFromDeletion` — ចាប់បានទាំងពីរ។

### ភស្តុតាងថាតេស្តមិនទទេ
| តេស្ត | ទីនេះ | លើ `origin/main` |
|---|---|---|
| `raw-read-shape-test` | 38/38 | **ធ្លាក់ ២២** (រួម `["AAA"]` — barcode ត្រូវលុបចោលពិត) |
| `devtools-guard-test` | 8/8 | **ធ្លាក់ ៣** (ការការពារពិតទាំង ២ ជោគជ័យទាំងមុន និងក្រោយ) |
| `setup-link-browser-test` | 18/18 | **ធ្លាក់ ១** (ZoeAdmin មិនបំពេញ Config) |
| `boot-runtime` | PASS | **FAIL** (`ZXing is not defined`) |

### ពិនិត្យហើយស្អាត — កុំ audit ឡើងវិញដោយងងឹតងងុល
- **CSS `env()` ទាំង ១៧ ស្អាត** — line 54-55 ផ្តល់ `min-height: 100vh/100dvh` មូលដ្ឋានដល់ media
  query នៅ 69-70, ហើយ `padding: 8px` នាំមុខ `padding-bottom: calc(...)`។ ជុំ ១១ ត្រូវ។
- **Layout @320px ស្អាតទាំង ៤ App** — គ្មានការលើសទទឹង គ្មាន scroll ផ្តេក (វាស់ក្នុង Chromium
  ដោយបើក modal ម្តងមួយៗ)។
- **Zoescan `openModal` កំណត់ទាំង `.open` និង `style.display`** ➜ `isPinFlowPending()` (ដែល
  ពិនិត្យ `display`) ដំណើរការត្រឹមត្រូវ។ តេស្តដំបូងរបស់ខ្ញុំរាយការណ៍ថាខុស — **តេស្តខុស មិនមែនកូដ**;
  ផ្ទៀងផ្ទាត់មុនកែ។
- ការការពារ barcode ស្ទួនប្រើ `runTransaction` ➜ សុវត្ថិភាពឆ្លងឧបករណ៍។
- Export ទាំង ៤ App៖ `firebase-loader`/`firebase-init` export គ្រប់អ្វីដែល `app.js` ប្រើ។
- ផ្លូវ PIN ➜ Config លើឧបករណ៍ថ្មី ដំណើរការទាំង ៣ App (វាស់ក្នុង browser ពិត)។
- `data-nodismiss` លើ `loginModal`/`activationModal` (និង `phoneModal` ក្នុង ZoeAdmin) ទប់ Escape ពិត។

### កំហុសទី ៥ — ការស្កេនកញ្ចប់ថ្មីជា read-modify-write មិនមែន transaction
ដំបូងត្រូវបានរាយការណ៍ជាចំណុចដែលមិនបានកែ (ព្រោះវាប៉ះផ្លូវក្តៅបំផុត) រួចអ្នកប្រើឆ្លើយថា
*"កែបង្ហើយទៅ"* ➜ បានកែ។ `addOrUpdateEntry` merge branch អាន `item.barcodes` ក្នុងសតិ push
barcode ថ្មី រួចសរសេរ item **ទាំងមូល** តាម `update()`។ ZoeAdmin ២ ឧបករណ៍ស្កេនចូលលេខទូរស័ព្ទ
ដដែលក្នុងវិនាទីដដែល ➜ ទាំងពីរសាង item ចេញពីការអានចាស់ ➜ **ការសរសេរចុងក្រោយឈ្នះ ➜ barcode
មួយបាត់**។ ខណៈនោះ revenue ប្រើ transaction ដាច់ដោយឡែក ➜ **ស្កេនទាំងពីរត្រូវបានរាប់** ➜
តួលេខប្រចាំថ្ងៃលើសពី barcode ដែលវាគួរបូក។

**កែ**៖ merge រត់ក្នុង `runTransaction` ➜ ការសរសេរប្រណាំងបណ្តាលឲ្យ re-run មិនមែនការសរសេរជាន់។
**closure `mergeScannedBarcodeInto()` តែមួយ ត្រូវបានអនុវត្តទាំងលើ item ក្នុងសតិ (UI optimistic)
និងខាងក្នុង transaction** ➜ តក្កវិជ្ជា merge មានតែមួយ មិនមែនពីរដែលអាចបែកគ្នា (ជាកំហុសដែល
គម្រោងនេះជួបម្តងហើយម្តងទៀត)។ បន្ថែម៖ merge ជា idempotent (រំលង barcode ដែលមានស្រាប់ —
សំខាន់ព្រោះ RTDB អាចរត់ update function ច្រើនដង) · `normalizeBarcodesOf()` រត់លើតម្លៃ server
ជាមុន · `syncScannerLookupEntry` ទទួល committed snapshot ជំនួស item ក្នុងសតិ ·
ពេលបរាជ័យ ការកែក្នុងសតិត្រូវបានស្តារ ជាមួយ revenue delta (មុននេះ item រក្សា barcode លើស
ក្នុងសតិរហូតដល់ listener បាញ់)។
**ZoeAdmin តែប៉ុណ្ណោះ** — ZoeW មិនអាចបង្កើតកញ្ចប់ ហើយគ្មានច្បាប់ចម្លងនៃ function នេះទេ។
គ្មានការប្តូរ rules (admin អាចសរសេរ field ទាំងនេះរួចហើយ)។

**`concurrent-scan-test.js` ថ្មី** ដក `addOrUpdateEntry` ពិតមករត់ជាមួយ Firebase ក្លែងក្លាយ ដែល
`runTransaction` មាន **retry-on-conflict ពិត** និង `update()` **អសមកាល** (ជា network round trip)។
15/15 ទីនេះ · **ធ្លាក់ ៣ លើ `origin/main`** ដោយបង្ហាញ `["AAA","BBB"]` — barcode របស់ឧបករណ៍
ផ្សេងបាត់ពិត។ *អន្ទាក់ដែលជួប៖ ការក្លែងធ្វើដំបូងធ្វើឲ្យ `update()` **សមកាល** ➜ ការសរសេររបស់
ឧបករណ៍ផ្សេងចុះ **ក្រោយ** ➜ តេស្តជោគជ័យលើ baseline ក្លែងក្លាយ។ ការធ្វើតេស្តការប្រណាំងត្រូវតែ
ដាក់ការសរសេររបស់ឧបករណ៍ផ្សេង **ក្នុងចន្លោះ** នៃការអាន និងការសរសេរ។*

### ចម្លើយចំពោះសំណួររបស់អ្នកប្រើ (ដដែលនឹងជុំ ១១ តែឥឡូវមានទិន្នន័យបន្ថែម)
កំហុសទាំង ៥ ជុំនេះ **គ្មានមួយណាស្ថិតក្នុងកូដដែលជុំមុនអានហើយវិនិច្ឆ័យខុសទេ**៖
- ទី ១ ជាការ **កែមិនពេញលេញ** របស់ជុំ ១១ — ជុំនោះកែផ្លូវអាន ១ ក្នុងចំណោម ៦
- ទី ២ ជា **ការតំរែតំរង់ដែលជុំ ៦ បង្កើត** ដោយការកែមួយផ្សេង ហើយគ្មានតេស្តណាគ្របផ្លូវពេញលេញ
- ទី ៣ និង ៤ ស្ថិតក្នុង **ឆាកដែលគ្មានឧបករណ៍ណាធ្លាប់ប៉ះ** — ការរត់ App ពិត
- ទី ៥ ស្ថិតក្នុងថ្នាក់ដែល runbook ចាត់ទុកថា **មិនអាចធ្វើតេស្តបាន** — ការក្លែងធ្វើ Firebase
  ជាមួយ retry-on-conflict បង្ហាញថាវាធ្វើតេស្តបាន ដោយគ្មាន emulator
លំនាំច្បាស់៖ **ជុំនីមួយៗរកឃើញអ្វីដែលឧបករណ៍ថ្មីរបស់ជុំនោះមើលឃើញ។** ការអានកូដឡើងវិញឲ្យខ្លាំងជាងមុន
មិនបានផលទេ។ ឧបករណ៍ចាស់ទាំង ២៣ បៃតងតាំងពីដើមជុំនេះ — នោះជាភស្តុតាងថាកំហុសចាស់មិនត្រឡប់មកវិញ។
មេរៀនបន្ថែមជុំនេះ៖ **ការកែមួយអាចមិនពេញលេញ ទោះវាត្រឹមត្រូវ** (ទី ១) ហើយ **ការកែមួយអាចបំបែក
មុខងារផ្សេង** (ទី ២) — ដូច្នេះតេស្តត្រូវគ្របផ្លូវ *ពេញលេញ* មិនមែនត្រឹមមុខងារដែលទើបកែទេ។

`CACHE_VERSION` bump ទាំង ៤ (zoeadmin-v52, zoew-v43, zoescan-v34, zoekeygen-v27)។
**គ្មានការប្តូរ Firebase rules ➜ គ្មាន publish ថ្មី។**
Suite សរុប៖ **547 assertion** — បៃតងទាំងអស់ (**29 ការត្រួតពិនិត្យ**)។
