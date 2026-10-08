# ប្រវត្តិ Zoe-System — សម័យ ZoeW React (ពី 2.43.0)

> ⛔ **ឯកសារនេះជា *ប្រវត្តិ* មិនមែន *ច្បាប់* ទេ** — ច្បាប់ដែលត្រូវអនុវត្តរស់នៅ [`CLAUDE.md`](../CLAUDE.md) ហើយច្បាប់
> នីមួយៗចងទៅ **ឧបករណ៍ដែលចាក់សោវា**។ ត្រង់នេះទុក *ហេតុអ្វី* ច្បាប់មួយមាន · របៀបដែលកំហុសត្រូវរកឃើញ · **លេខដែលវាស់បាន**។
>
> ⛔ **ប្រវត្តិរស់នៅ ២ ឯកសារក្នុងថត `docs/` នៅ root តែប៉ុណ្ណោះ** (`CLAUDE.md` ច្បាប់ ៩) ៖
>
> | ឯកសារ | គ្របអ្វី |
> |---|---|
> | **`docs/HISTORY.md`** (ឯកសារនេះ) | សម័យ **ZoeW React** ៖ ZoeW `2.43.0` ➜ ឥឡូវ (ពី 2026-09-29) · **ធាតុថ្មីទាំងអស់សរសេរនៅទីនេះ** |
> | **[`docs/HISTORY-ARCHIVE.md`](HISTORY-ARCHIVE.md)** | សម័យ **ZoeW vanilla** ៖ ZoeW ≤ `2.37.3` · ZoeKeyGen ≤ `2.20.2` (ដល់ 2026-09-18) · កំណែមុន `2.20.0` · អត្ថបទដែលដកចេញពី `CLAUDE.md` · **ផ្នែក ៦ ៖ សម័យផ្ទេរទៅ React** (ZoeW `2.38.0` ➜ `2.42.11` · parity ឆៅ) · **អានបានតែមិនបន្ថែមធាតុថ្មី** |
>
> ⛔ **កុំអានពីដើមដល់ចប់** — វាជាឯកសារយោង។ ផ្លូវធម្មតា ៖ checker ធ្លាក់ ➜ `grep -n "<ឈ្មោះ checker>" docs/HISTORY*.md`
> (គ្របទាំង ២ ឯកសារ) ឬមើល **[🔎 លិបិក្រម](#-លិបិក្រម--ឈ្មោះ-checker--ការពន្យល់រស់នៅឯណា)** នៅចុងឯកសារនេះ។
>
> | ត្រូវការអ្វី | មើលកន្លែងណា |
> |---|---|
> | «សកម្មភាពដែលត្រូវធ្វើដោយដៃ» · អ្នកប្រើឃើញអ្វីខុសពីមុន | **ផ្នែក ១** (ឯកសារនេះ) · កំណែ ≤ 2.37.3 ➜ archive ផ្នែក ១ · `2.38.0` ➜ `2.42.11` ➜ archive ផ្នែក ៦ |
> | ហេតុអ្វី checker មួយមាន · លេខ mutation · ការវាស់ដែល **បដិសេធ** សម្មតិកម្ម | **ផ្នែក ២** (ឯកសារនេះ) · archive ផ្នែក ២ |
> | កំណែមុន 2.20.0 · អត្ថបទដែលដកចេញពី `CLAUDE.md` | archive ផ្នែក ៣ · ៤ · ៥ |
>
> ### ⛔ ច្បាប់សរសេរ (រាល់ជុំ audit)
>
> ១. **រាល់ការឡើងកំណែត្រូវបន្ថែមធាតុថ្មីនៅខាងលើគេនៃ ផ្នែក ១ *របស់ឯកសារនេះ*** ក្នុង commit ដដែល ៖ ជាភាសាខ្មែរ ប្រាប់ថា
>    *អ្នកប្រើឃើញអ្វីខុសពីមុន* ហើយបញ្ជាក់ **«សកម្មភាពដែលត្រូវធ្វើដោយដៃ»** ជានិច្ច (ឬ «គ្មាន»)។
> ២. **កំហុសពិតដែលរកឃើញ ➜ ផ្នែក ២** ៖ របៀបដែលវារកឃើញ · មូលហេតុឫសគល់ · **លេខដែលវាស់បាន** · checker ដែលចាក់សោវា · លទ្ធផល mutation។
> ៣. ⛔ **កុំបន្ថែមធាតុថ្មីក្នុង archive** · ⛔ កុំយកខ្លឹមសារនេះទៅដាក់ក្នុង `README.md` (README សរសេរតែ *របៀបប្រើ*) ឬក្នុងកូដជា comment។
>
> ```text
> ### [X.Y.Z] — YYYY-MM-DD · ចំណងជើងខ្លី
> **<App ណាប្រែ>** (`<cache-key ចាស់>` ➜ `<ថ្មី>`)។ ⛔ **<App មួយទៀត> មិនប្រែ**។
> #### អ្វីដែលខុសពីមុន · អ្នកយាម · សកម្មភាពដែលត្រូវធ្វើដោយដៃ
> ```
>
> ⛔ **`CACHE_VERSION` មិនមែនជា `APP_VERSION` ទេ** — `CACHE_VERSION` (`<app>-vN`) ឡើងរាល់ពេលឯកសារ static ប្រែ ចំណែក
> `APP_VERSION` ជាកំណែផលិតផល (semver)។ **កំណែជារបស់ App នីមួយៗ** — ឡើងតែ App ដែលកែពិត (`version-check` · `version-bump-scope`)។

---

## 📌 ការងារដែលនៅសល់ — ការផ្ទៀងផ្ទាត់ដោយអ្នកប្រើ

### 🤝 Handoff សម្រាប់ session បន្ទាប់

⛔ **ផ្ទៀងផ្ទាត់ git មុនជឿអត្ថបទនេះ** (`git log --oneline -3 origin/main` · `git rev-list --count origin/main..origin/<branch>`)។ ⛔ កុំ merge ដោយគ្មានសំណើម្ចាស់គម្រោង។

ការងាររបស់ Claude ក្នុង handoff មុនធ្វើរួចទាំងអស់ (register · backup ហាង · CLI ផ្ទេរ · ពិដាន Admin · index FK · cache IndexedDB · dependency/Node 24 ·
ការរកឃើញ audit SQL ៣ ➜ ផ្នែក ១ [2.49.0] · ផ្នែក ២)។ នៅសល់តែ ៖

1. **ម្ចាស់គម្រោង** ៖ PR #288 · #290 · #291 · #292 · #293 · #294 · #295 merge រួច (`main` = **ZoeW 2.50.4 · ZoeKeyGen 2.24.6**) · branch `ccr-85f562ee-106o6w` = **ZoeW 2.50.13** (keyboard រំកិលពីលើទំព័រ (APK Android 11+) · ផ្ទៃក្រោម WebView ពេល keyboard ឡើង = ពណ៌ App · របា Tab លាក់ពេល keyboard APK · ម៉ឺនុយ (…) ពេលរមូរ · modal ៣ មិនបិទពេលប៉ះផ្ទៃងងឹត · របា Tab ស្ងៀមពេលឈប់រមូរ · Android App និង PWA បង្ហាញជួរប្រវត្តិតាមទីតាំងរមូរ · ដក telemetry សាក · ស្គាល់អេក្រង់ Hz ខ្ពស់ · PR #296 Draft · មិនទាន់ merge · APK សាក ៖ Run workflow លើ branch ➜ Pre-release) · **Deep audit ២** (workflow អ្នករក ១១ ➜ verify ៣ lens · ម្ចាស់គម្រោងអនុញ្ញាត) ➜ PR #297 branch `claude/wonderful-ride-ixmi63` = **ZoeW 2.50.14** (លុយ ៖ RACES-1/MONEY-2 · MONEY-1 · MONEY-3 · រួមបញ្ចូល branch PR #296 ទាំងមូល ➜ merge PR #297 = merge ទាំងពីរ · [2.50.14] · ផ្នែក ២ «Deep audit ២») · របាយការណ៍ deep audit ៖ findings ៥៣ · បញ្ជាក់ ៤៩ · បដិសេធ ៤ · ប្រវត្តិ ៖ PR #292 =
   **ZoeW 2.50.1** (ជុំ ZTO ស្អាត · មិនទាន់ merge) ➜ ធ្វើតាម [2.50.1] «សកម្មភាពដែលត្រូវធ្វើដោយដៃ» (បញ្ជី ⏳ ខាងក្រោម) ·
   ✅ [2.50.0] ➜ [2.49.0] ម្ចាស់គម្រោងធ្វើ និងសាករួច (2026-10-06) · នៅសល់ secret backup ហាង + សាកស្តារ (⏳ Backup ខាងក្រោម)។ live = **Project ថ្មី**
   (Project ចាស់លុបរួច · វាស់ 2026-10-03) ៖ migration ១០ = repo ១០ (ម្ចាស់គម្រោង `db push` · version កត់គ្រប់) · Edge Functions `register` + `reset-password` **v6** ·
   Deploy ពី GitHub **មិនទាន់បញ្ជាក់** លើ Project ថ្មី (ផ្នែក ២ «GitHub integration មិនអនុវត្ត migration លើ Project ថ្មី»)។
2. 🔎 **Deep audit ទូទាំង Project** (prompt ម្ចាស់គម្រោង ៖ ៧ ជុំ · មួយជុំក្នុងមួយ session (PR តែមួយ · commit ម្តងមួយចំណុច) · Supabase live អានតែប៉ុណ្ណោះ · ជុំនីមួយៗចាប់ផ្តើមពី `main` ·
   ⛔ គ្មាន workflow/agent · វាស់ឡើងវិញលើ `main` មុនកែ · វាស់មិនឃើញ ➜ កត់ «វាស់ ៖ គ្មាន»)៖
   **ជុំ ១ លុយ · ជុំ ២ បណ្តាញ ចប់ និង merge រួច** ([2.49.2] · [2.49.3] · [2.49.4] · ផ្នែក ២ «Deep audit ជុំ ១ ៖ លុយ» · «Deep audit ជុំ ២ ៖ …») ·
   ✅ ម្ចាស់គម្រោងធ្វើរួច (2026-10-04) ៖ G2 ➜ Supabase Dashboard «Refresh token reuse interval» ១០ ➜ ៦០ វិ.។
   **ជុំ ៣ Config ➜ Login ➜ Signup** (ម្ចាស់គម្រោង ៖ «ធ្វើឲ្យរួចមួយជុំ» ➜ PR #288 តែមួយ) ៖ (១) ✅ **➜ [2.49.5]** ទាក់ទងបង្កើតគណនីតាម Telegram ·
   (២) ✅ **➜ [2.49.5]** Setup Link ហាងចុះឈ្មោះរួច ➜ ប្រអប់ចូល ទោះ Function មិនឆ្លើយ (R3-G1 · ថ្នេរ App ↔ `handleRegister()` ពិត) ·
   (៣) ✅ វាស់ ៖ គ្មាន — ការចងចាំគណនីចងនឹង scope · ពាក្យសម្ងាត់ចងនឹង scope + ឈ្មោះតាម AES-GCM AAD (`remember-password.test.tsx` · `login-routing.test.tsx`) ·
   (៤) ✅ Server ៖ គណនីគ្មានហាង ➜ forbidden (អ្នកយាមបន្ថែម) · `register` + `check` មាន mutation រួច · sign-up live វាស់មិនបាន ➜ សកម្មភាពដោយដៃ [2.49.5] ·
   ➕ របាយការណ៍ម្ចាស់គម្រោង ៖ APK Push ជាប់ «សូមចូលប្រព័ន្ធម្តងទៀត» ក្រោយ ៤ ម៉ោង ✅ **➜ [2.49.5]** ·
   (៥) ✅ វាស់ ៖ គ្មាន — ផលរួម G4 · G5 · G6 ជាមួយ Reconfig (mutation ៣/៣) · ➕ សំណើ ៖ ពណ៌ + logo Firebase/Supabase ✅ **➜ [2.49.5]** · ➕ 🔔 ចំណុចបាត់ស្ងាត់ ✅ ➜ **ជុំ ៣ ចប់** (ផ្នែក ២ «Deep audit ជុំ ៣»)។
   **ជុំ ZTO ស្អាត** ✅ **➜ [2.50.1]** (ម្ចាស់គម្រោងអនុញ្ញាត ៖ «កែចុះ · ឲ្យ ZTO ស្អាត ហើយចាក់សោ») ៖ PR #292 (branch `claude/happy-clarke-nph09g` · ពី
   `main` `b2868e1` · **មិនទាន់ merge**) ៖ E1–E8 · F1 · M1 · M2 (ច្បាប់រង់ចាំទូទាំងហាង) · M3 · R1 · Q1–Q4 · T3–T6 · ប្រភពកញ្ចប់ · ZTO ចាក់សោឡើងវិញ
   (`LOCK` ៩ ឯកសារ) · run-all STRICT + emulator ២០៣/២០៣ · vitest ៧៨៤/៧៨៤ ➜ សកម្មភាពដោយដៃ [2.50.1] (Publish rules · Deploy · APK · ជួរ phone `0`)។
   ✅ **ជុំ ៤ សុវត្ថិភាព · ជុំ ៦ ដំណើរការ និង Layout** ➜ PR #294 **merge រួច** ([2.50.3] · ផ្នែក ២ «Deep audit ជុំ ៤» · «Deep audit ជុំ ៦»)។
   ✅ **ជុំ ៥ Toast · ជុំ ៧ ឯកសារ · សំណើ Locker (អនុម័ត រួចដកវិញ ៖ ចុះភ្លាម)** (ម្ចាស់គម្រោង ៖ «ធ្វើការងារនៅសល់ទាំងអស់») ➜ PR #295 (branch `claude/wonderful-ride-ixmi63` · ZoeW 2.50.4 · **មិនទាន់ merge**) ៖
   [2.50.4] · ផ្នែក ២ «Deep audit ជុំ ៥» · «Deep audit ជុំ ៧» ➜ **ជុំទាំង ៧ ចប់**។ នៅសល់ (ស្នើ · សួរមុនធ្វើ) ៖ S3 វាស់ sign-up Firebase លើ Project សាកល្បង ·
   ដកឧបករណ៍ parity ធៀប ZoeW vanilla (D7) · ToS ៖ ម្ចាស់គម្រោងបំពេញ `[ ]` · សំណើជុំ ៣ ខាងក្រោម។ ⛔ **គ្មាន workflow · គ្មាន agent** ដោយគ្មានការអនុញ្ញាតម្ចាស់គម្រោងក្នុង session (ទោះមានការរំលឹក
   ultracode ៖ ជុំនេះ workflow ពិនិត្យប្រឆាំង ១ រត់ដោយគ្មានការអនុញ្ញាតមុន ➜ ពិត ១៦ · លុយ ៣ · ម្ចាស់គម្រោងអនុញ្ញាតឲ្យបន្តរហូតចប់) · ⚠️ មុន CI ក្នុង session ៖
   `git fetch --unshallow origin` · ច្បាប់ចម្លង repo សម្រាប់វាស់ស្របគ្នា ត្រូវនៅក្រៅ `/tmp/claude-0` (Postgres ពិតរត់ជាអ្នកប្រើមិនមែន root)។
   **ស្នើ (សួរមុនកែ)** ៖ Firebase Reconfig ពេលមានការសរសេរមិនទាន់ផ្ញើ ➜ ព្រមាន (ប្រធានបទជុំ ៣) · សារ «ស្ថិតិប្រាក់មិនទាន់ Sync» ប្រុងប្រយ័ត្នលើស (ជុំ ៥) ·
   ZoeKeyGen គ្មានការវាស់ភាពរស់ «ងាប់ស្ងាត់» ដូច ZoeW (ប្រតិបត្តិការមានពិដាន ១៥ វិ. រួច តែចំណុចស្ថានភាពអាចបៃតងក្លែងក្លាយ ➜ ជុំ ២ ឬ ៤)។
   ជុំ ៤–៧ ៖ សុវត្ថិភាព · Toast · ដំណើរការ/Layout · ឯកសារ។ ច្បាប់រស់ក្នុង `CLAUDE.md` · ប្រវត្តិរស់ក្នុង `docs/HISTORY*.md`។
3. ⏳ **ម្ចាស់គម្រោង ៖ មុនប្តូរ repo ជា Public** (LICENSE · NOTICE រួចក្នុង PR #288 · ផ្នែក ២ «LICENSE · NOTICE មុនដាក់ repo ជាសាធារណៈ») ៖ merge PR #288 មុន
   (LICENSE ថ្មី) · GitHub Settings ➜ Code security ➜ បើក **Secret scanning** + **Push protection** · អ៊ីមែល commit ចាស់នឹងលេច (កំណត់ «Keep my email addresses
   private» សម្រាប់ commit ថ្មី) · `CLAUDE.md`/`docs/` ពិពណ៌នាការការពារលម្អិត (ការការពារពិតនៅ Server ➜ មិនមែនរន្ធ តែជាព័ត៌មានដល់អ្នកវាយប្រហារ) ·
   ✅ sign-up បិទក្នុង Supabase + Firebase (ម្ចាស់គម្រោង 2026-10-06) · ⛔ LICENSE ជាការការពារផ្លូវច្បាប់តែប៉ុណ្ណោះ (អ្នកណាក៏ clone បាន) ·
   ការអនុវត្តផ្លូវច្បាប់ ➜ ពិគ្រោះមេធាវី។
4. ⏸️ **Supabase deep audit ជុំ ២** (ម្ចាស់គម្រោង ៖ «ទុកធ្វើពេលក្រោយ») ៖ ចប់ផ្នែក SQL គណនី · ៨ ផ្នែកទៀតនៅសល់ (ផ្នែក ២ «Supabase deep audit ជុំ ២»)។
5. សាកលើ iPhone/Android ពិត ៖ នៅសល់តែ [2.50.1] (បញ្ជី ⏳ ខាងក្រោម) · ✅ ធាតុ 2.45.x ➜ 2.50.0 ទាំងអស់ ម្ចាស់គម្រោងសាករួច (2026-10-06 ៖ Supabase លើឧបករណ៍ពិត ·
   ⚙️ ភ្ជាប់ប្រព័ន្ធ · Push · បណ្តាញ «ងាប់ស្ងាត់» · Airplane · ខ្សែរមូរ · ប៊ូតុងខល · `tools/firebase-provision` · Sentry `zone:money` · rules 2.45.4)។ **រក្សា Firebase និង Supabase ជាជម្រើសរបស់អតិថិជន**។

⛔ **សន្សំកូតា**៖ រត់តែ checker ពាក់ព័ន្ធ (RUNALL_ONLY) ហើយទុក CI វាស់ពេញ; ឆ្លើយជាខ្មែរ។

> ⛔ **ទុកតែអ្វីដែល *អ្នកប្រើមិនទាន់បញ្ជាក់* ឬ *ការសម្រេចដែលនៅរស់*។** អ្នកប្រើបញ្ជាក់ថាដំណើរការលើឧបករណ៍ពិត ➜
> លុបធាតុចេញពីទីនេះ (កំណត់ត្រាអចិន្ត្រៃយ៍រស់ក្នុង `docs/HISTORY*.md`)។

- ⏳ **ZoeW 2.50.28–2.50.30 — ជុំ ១៣–១៤ (SUPABASE-1 · SUPABASE-6 · SCALE-2 · branch `claude/optimistic-darwin-6cqgfh` · មិនទាន់ merge)** ៖ Deploy ZoeW + APK ➜ ហាង Supabase ៖ ចាកចេញក្នុងផ្ទាំងមួយ ➜ ផ្ទាំងផ្សេងចេញដែរ ([2.50.28] សកម្មភាព ២) · ហាងមានកញ្ចប់ចាស់ច្រើន ៖ បើក App ➜ មិនកក ([2.50.30] សកម្មភាព ២)។
- ⏳ **ZoeW 2.50.26–2.50.27 · ZoeKeyGen 2.24.8 — ជុំ ១២ (NETWORK-1 · SENTRY-2 · branch `claude/optimistic-darwin-6cqgfh` · មិនទាន់ merge)** ៖ Deploy ZoeW + ZoeKeyGen + APK ➜ គ្មានការសាកពិសេស ([2.50.26] · [2.50.27] សកម្មភាព ២)។
- ⏳ **ZoeW 2.50.23–2.50.25 · ZoeKeyGen 2.24.7 — ជុំ ៩–១១ (SECURITY-2 · SENTRY-3 · SECURITY-1 · ZTO-4 · PR #299 merge រួច)** ៖ Deploy ZoeW + ZoeKeyGen + APK ➜ Sentry ៖ event ថ្មីមាន release ([2.50.23] សកម្មភាព ២) · ក្រយៅដៃ/មុខលើ iPhone PWA · Android Chrome ([2.50.24] សកម្មភាព ២) · បញ្ជី ZTO ([2.50.25] សកម្មភាព ២)។
- ⏳ **ZoeW 2.50.22 — MONEY-4 (PR #298 merge រួច)** ៖ ✅ ម្ចាស់គម្រោង Publish Firebase rules (`ops/$op` ក្នុង ledger ថ្ងៃ/ខែ) រួច · ✅ migration Supabase `20261008023215_zoe_rules.sql` ចូល live (វាស់ ៖ បញ្ជី migration ១២ · `private.zoe_rules()` មាន `ops` ក្នុងថ្ងៃ និងខែ · 2026-10-08) ➜ ⏳ Deploy ZoeW + APK ➜ សាកតាម [2.50.22] សកម្មភាព ៤–៥។
- 🗳️ **ការសម្រេចរបស់ម្ចាស់គម្រោង (Deep audit ២ · 2026-10-08)** ៖ SECURITY-1 ➜ **PRF-only** (web ទុកតែ WebAuthn PRF · APK native · record `device` ចាស់ត្រូវបដិសេធ ➜ ចុះឈ្មោះស្នាមម្រាមដៃម្តងទៀត) ·
  ZTO-4 ➜ **បញ្ចូលគ្នា** (ជួរ born-closed បញ្ចូលចូលជួរដែលបិទទាំងអស់របស់អតិថិជនដដែល ថ្ងៃដដែល) · NATIVE-6 ➜ **ទុកពេលក្រោយ** (តំបន់ហាម · រង់ចាំរបាយការណ៍ពិតពីទូរស័ព្ទ) ·
  D7 ➜ **អនុញ្ញាត · PR ដាច់** (ផែនការដកឧបករណ៍ parity ធៀប ZoeW vanilla) ➜ PR #300 merge រួច (គ្មាន bump · ផ្នែក ២ «D7»)។
- ⏳ **ZoeW 2.50.13 — PR #296 Draft** ៖ APK ៖ ប៉ះប្រអប់ស្វែងរកលេខ ➜ keyboard រំកិលឡើងពីលើបញ្ជី · **គ្មានចន្លោះទទេ** ចន្លោះបាតកាត និង keyboard (វីដេអូ/រូប 2.50.12) · ✅ ម្ចាស់គម្រោងបញ្ជាក់ APK 2.50.11 ៖ របាលែងលោត (2026-10-08) · បំបែកអេក្រង់ ➜ keyboard បើក/បិទ ➜ របាលេចវិញ · បិទ keyboard ➜ របាលេចវិញ · PWA (ក្រោយ merge) ៖ រមូរបញ្ជីខ្លាំងៗ ហើយចុច (…) ក្បាលប្រអប់ប្រវត្តិភ្លាម ➜ ម៉ឺនុយបើក · Config · API ស្វែងរក · នាំចូល Excel ៖ ប៉ះផ្ទៃងងឹត ➜ មិនបិទ · Back/ប៊ូតុងបិទ ➜ បិទ · ✅ ម្ចាស់គម្រោងបញ្ជាក់ APK 2.50.10 «ល្អ smooth» · (…) លើ APK «អត់អីផង» (2026-10-08) · ✅ ម្ចាស់គម្រោងបញ្ជាក់ APK 2.50.7 «ដើរស្រួលហើយ» (2026-10-07) ➜ ដក telemetry សាករួច។ នៅសល់ ៖ APK 2.50.8 · **PWA Android (Chrome)** «ទាំងអស់» ➜ រមូរដល់ចុង ➜ បើក/បិទធុងសំរាម · បញ្ជី ZTO · ☰ · 🔔 · រមូរឡើងវិញ · ប្តូរតម្រង/ស្វែងរក ➜ តារាងនៅកំពូល · **iPhone PWA** ៖ ប្តូរតម្រងពេលរមូរជ្រៅ ➜ ត្រឡប់កំពូល (PTR · ចលនាផ្ទាំងដូចដើម) ➜ ទូរស័ព្ទ ៩០/១២០Hz ៖ រមូរបន្តិច ➜ បិទ/បើក App ➜ ចលនា (ស្រមោលកាត · បន្ទាត់ស្កេន) នៅដដែល ➜ ចាំ merge ([2.50.8] · [2.50.9] សកម្មភាពដោយដៃ)។ កុំដក Sentry រាយការណ៍កំហុសធម្មតា។
- ⏳ **ZoeW 2.50.4 — PR #295 (merge ចូល `main` រួច)** ៖ Deploy ZoeW + APK ➜ សាកតាម [2.50.4] សកម្មភាព ២ (⚠️ នៅក្រោម ✅ ×៤ · សោ App · ⏳ ➜ ✅ ចំណូលប្រចាំថ្ងៃ · Locker ៖ ស្កេនដាក់ទីតាំងចុះភ្លាម គ្មានប្រអប់) · ZTO ៖ បញ្ចូលបញ្ជី ≥ ២០ ជួរ ➜ «⏳ កំពុងបញ្ចូល N/M» លឿន · កញ្ចប់អតិថិជនដដែលបញ្ចូលគ្នា · ចំណូលថ្ងៃ = COD សរុប · ទាញយឺត ➜ `?diag=1` `upstreamTiming` ផ្ញើមក។
- ⏳ **ZoeW 2.50.3 — PR #294 (merge ចូល `main` រួច)** ៖ Deploy ZoeW + APK ➜ «📥 បញ្ជី ZTO» ៖ កញ្ចប់ដែល ZTO ចុះហត្ថលេខាក្នុងចន្លោះ តែមកដល់មុនថ្ងៃចាប់ផ្តើម នៅក្នុងក្រុម «🆕 ថ្មី» ជាមួយ «📥 មកដល់ ៖ មុនថ្ងៃ …» · «✍️ ZTO ចុះហត្ថលេខា (បិទ) ៖ …» ➜ «➕ បញ្ចូល» ➜ ចូលជា «យករួច» លើថ្ងៃចុះហត្ថលេខា ([2.50.3] សកម្មភាព ២)។
- ⏳ **ZoeW 2.50.2 — PR #293 (merge ចូល `main` រួច)** — ✅ ម្ចាស់គម្រោង (2026-10-06) ៖ លុប env អត្ថបទ · Deploy ➜ បញ្ជី ZTO ទាញបាន ៩៦/៩៦ · សារ ⚠️ «66 ជួរ» បាត់ · 🔒 «មានក្នុង ZoeW តែ ZTO បិទរួច 6» ➜ នៅសល់ ៖ APK · សាកតារាងប្រវត្តិលើទូរស័ព្ទ ([2.50.2] សកម្មភាព ២)។
- ⏳ **ZoeW 2.50.1 — PR #292 (merge ចូល `main` រួច · ជុំ ZTO ស្អាត)** — ✅ ម្ចាស់គម្រោង (2026-10-06) ៖ Publish Firebase rules (`origins` · `zoew_settings/zto_signed_sweep`) ·
  Deploy ZoeW · build APK ថ្មី ➜ ⏳ នៅសល់ ៖ migration Supabase `20261006192639_zoe_rules.sql` ចូល live ពេល merge (GitHub integration ➜ ផ្ទៀង version ក្រោយ merge) ·
  សាកលើទូរស័ព្ទពិត តាម [2.50.1] «សកម្មភាពដែលត្រូវធ្វើដោយដៃ» ៣–៧ ៖
  (១) កញ្ចប់ ៨ ថ្ងៃដែល ZTO Palm ចុះហត្ថលេខា ➜ បិទ/បើក App ➜ «យករួច» មិនមែន «ផុតកំណត់» · កញ្ចប់ ៨ ថ្ងៃមិនទាន់យក ➜ «ផុតកំណត់» ក្នុង ≤ ៣០ នាទី ·
  (២) ហាងមានទូរស័ព្ទ ២ (B មិនបើក ZTO) ➜ B មិនដកលុយមុន A អានបញ្ជី · (៣) ចុះហត្ថលេខាលើ ZTO Palm ពេលកំពុងស្កេន ➜ ZoeW បិទក្នុង ~២០–៦០ វិ. ·
  ១ សប្តាហ៍ក្រោយ ៖ Netlify ➜ Usage ➜ Functions · (៤) ប្រអប់បញ្ជី ZTO ៖ «🔒 ថ្មីដែល ZTO បិទរួច» · `?diag=1` ➜ `list.signedEnabled: true` ·
  (៥) ប្រភព 🇨🇳/🇻🇳 ក្នុងប្រវត្តិ · «កញ្ចប់សរុប» បើកបញ្ជី · ទូរស័ព្ទតូច ៖ ប៊ូតុងខល/បិទ មិនជាន់ · (៦) ស្កេន ៖ barcode ក្រៅទម្រង់ ➜ «⚠️ Barcode នេះមិនមែនទម្រង់ ZTO» ·
  កញ្ចប់គ្មានលេខ ➜ ជួរ «គ្មានលេខ» មួយក្នុងមួយកញ្ចប់ · (៧) ពិនិត្យជួរប្រវត្តិចាស់ phone `0`/`000` ដែល «ចំនួន» > ១ ➜ កែដោយដៃ។
- ✅ **សេចក្តីសម្រេច៖ ZoeW គាំទ្រ backend ទាំង២តាមជម្រើសអតិថិជន — Firebase និង Supabase**។ ការសាង Supabase មិនមែនជាការបិទ Firebase ទេ។
  ត្រូវរក្សាផ្លូវ Config/Login, SDK, rules, provisioning, backup និងឯកសារដែលអតិថិជន Firebase ត្រូវការ។ CLI ផ្ទេរទិន្នន័យជាជម្រើសសម្រាប់អ្នកចង់ប្តូរ backend។
  ការសម្អាតអាចលុបតែកូដដែលបញ្ជាក់ថាមិនប្រើដោយ backend ទាំង២ និងមុខងាររួម។
- ⏳ **`tools/supabase-migrate/` (ជម្រើស · តែពេលអតិថិជន Firebase ចង់ប្តូរ)** ៖ dry-run (លំនាំដើម) លើហាងសាកល្បងមុនផ្ទេរទិន្នន័យពិត។
- ⏳ **Backup ស្វ័យប្រវត្តិ — ម្ចាស់គម្រោងមិនទាន់ដាក់ (ពន្យារដោយចេតនា)** (⛔ កុំដាស់តឿនរាល់ជុំ) ៖ `backup.yml` មិន backup អ្វីទេ រហូតដល់
  secret `ZOE_BACKUP_TARGETS` · `ZOE_BACKUP_PASSPHRASE` ត្រូវកំណត់ ([`firebase-backup/README.md`](../firebase-backup/README.md)
  ជំហានទី ៦) ➜ Run workflow ម្តង ➜ **ទាញ artifact មកសាកស្តារ** (backup ដែលមិនទាន់សាកស្តារ មិនទាន់ជា backup) ·
  backup ឈប់ស្ងាត់ ➜ ពិនិត្យ **Actions** មុន (GitHub ផ្អាក schedule ក្រោយ repo ស្ងាត់ ៦០ ថ្ងៃ)។
  ⛔ វាស់បាន (2026-10-06) ៖ run #28–#30 «success» តែជំហាន «ពិនិត្យ secret» ➜ ទាញ/អ៊ិនគ្រីប/artifact **រំលង** (artifact ០) · #31 ធ្លាក់គ្មាន runner ➜
  **«success» មិនមែន backup ទេ · គ្មាន backup ណាមួយត្រូវបានបង្កើតឡើយ**។
- ✅ **Sentry event ពី barcode តេស្ត (`ZTO_UPSTREAM_REJECTED`) — អ្នកប្រើសម្រេចថាមិនកែ** (កញ្ចប់តេស្តដែលគ្មានក្នុង ZTO)។
  ⛔ កុំធ្វើឲ្យវាស្ងាត់ទាំងអស់ (បាំងការដាច់ ZTO ពិត) — មើលជួរ `ZTO_UPSTREAM_REJECTED` ក្នុងតារាងស្នូល · `lookupReason: ""`
  ក្នុង breadcrumb **មិនមែនកំហុស** (client អាន `reason` តែលើផ្លូវ `ZTO_CONFIG_INVALID`)។
- ✅ **`ZTO_UPSTREAM_TIMEOUT_MS = 7000` ក្នុង Netlify env ជាការកំណត់ដោយចេតនា** (កូដលំនាំដើម `6000` · ZTO ឆ្លើយ ២,១–៥,៣ វិ.
  លើផលិតកម្ម · បង្អួចអាន Cookie លើ container ត្រជាក់) ➜ តម្លៃមិនមែន `6000` ក្នុង `?diag=1` មិនមែនកំហុស។ ⛔ កុំបង្កើន
  `ZTO_REQUEST_BUDGET_MS` ដល់ `10000` ដោយមិនវាស់ផ្លូវ client ឡើងវិញ (ថវិកា App មិនមែនពិដាន platform)។
- ✅ **Firebase rules របស់ Business និង License Project ត្រូវ Publish រួច** (`pickedUpBarcodes` · កូដ App `ZOE` ·
  `maxDevices` · slot កៅអី · Key ថ្មីចេញរួច · វាល `op` និង ring `ops` ក្នុង ledger ថ្ងៃ/ខែ · `license_announcements`)។ ✅ Push (VAPID · FCM · `google-services.json`)
  កំណត់រួច។ ⛔ ការសរសេរស្ថិតិយកត្រូវបដិសេធ ➜ ពិនិត្យ rules មុនកូដ (`$other` បដិសេធវាល
  ដែលមិនស្គាល់) · Activate ធ្លាក់ `seat-unavailable`/«Key នេះមិនមែនសម្រាប់ ZoeW» ➜ ពិនិត្យថាជា Key ចាស់ (`a: 'ADM'`) មុន។

## 📗 ផ្នែក ១ — កំណត់ត្រាតាមកំណែ (សម័យ React · អ្នកប្រើឃើញអ្វីខុសពីមុន)

### [2.50.30] — 2026-10-08 · ZoeW ៖ **ការសម្អាតស្វ័យប្រវត្តិច្រើនរយកញ្ចប់ក្នុងពេលតែមួយ លែងធ្វើឲ្យអេក្រង់កក** (Deep audit ២ · ជុំ ១៤ · SCALE-2)

**ZoeW `2.50.30`** (`zoew-v292` ➜ `zoew-v293`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ថេរ ២ ម៉ោង · ៧ ថ្ងៃ · retention មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- 🧹 **SCALE-2** ៖ `runAutomaticCleanupRules()` ចាប់ផ្តើម `claimAndCleanupItem()` សម្រាប់កញ្ចប់ ripe ទាំងអស់ក្នុង loop synchronous តែមួយ (រហូតដល់ពិដាន journal ២០០) ➜ ហាងដែលបើក App
  ក្រោយឈប់យូរ (កញ្ចប់ ៣០០ ផុតកំណត់ក្នុងពេលតែមួយ) អេក្រង់កករាប់វិនាទី។ ឥឡូវច្រកចូលរបស់ App (`runScheduledCleanup()` រាល់ ៦០ វិ. · `debouncedRenderAfterHistorySync` ក្រោយ snapshot ប្រវត្តិ)
  ចាប់ផ្តើម ≤ `CLEANUP_SWEEP_BATCH` (៨) ក្នុងមួយជុំ ហើយបន្តក្រោយ `CLEANUP_SWEEP_YIELD_MS` (៥០ms) រហូតដើរគ្រប់កញ្ចប់ម្តង (`cleanupSweepVisited`) ➜ គ្រប់កញ្ចប់នៅតែត្រូវសម្អាត · លុយដកដូចដើម ·
  រាប់តែការសម្អាតដែលចាប់ផ្តើមពិត (កញ្ចប់កំពុងសម្អាត · កំពុងរង់ចាំ ZTO · journal ពេញ មិនស៊ីកូតា) ➜ កញ្ចប់ជាប់ ឬបរាជ័យភ្លាមនៅខាងមុខ មិនធ្វើឲ្យកញ្ចប់ខាងក្រោយស្រេកឃ្លាន · ការហៅដោយគ្មាន limit ដើរពេញដូចដើម។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. សាក (បើមានហាងដែលមានកញ្ចប់ចាស់ច្រើន) ៖ បើក App ក្រោយឈប់យូរ ➜ អេក្រង់មិនកក · ធុងសំរាម «ផុតកំណត់» កើនបន្តិចម្តងៗ ហើយចប់ក្នុងរយៈពេលខ្លី · ចំណូលដកត្រូវនឹងតម្លៃកញ្ចប់។

#### អ្នកយាម

- `ZoeW/tests/cleanup-sweep-batch.test.ts` (ថ្មី · ៦ · `cleanup.ts` ពិត + SDK ក្លែង) ៖ batch ≤ ១០ · `runScheduledCleanup()` ៣០០ ripe ➜ ជុំដំបូង ≤ batch ➜ ទាំង ៣០០ ចូលធុងសំរាម · ledger ថ្ងៃ/ខែ −៣០០ ·
  ២០ ជាប់ (transaction ព្យួរ) ➜ ២៨០ ផ្សេងសម្អាត · ២០ បរាជ័យភ្លាម ➜ ២៨០ សម្អាត · ការបន្តឈប់ · ជុំក្រោយព្យាយាមម្តងទៀត · `debouncedRenderAfterHistorySync` ≤ batch · ទិសផ្ទុយ ៖ គ្មាន limit ➜ ៥០ ក្នុងការហៅតែមួយ
  (មុនកែ FAIL ២ ៖ ជុំដំបូងចាប់ផ្តើម ២០០ · ការរង់ចាំអស់ពេល) · mutation ៦ ➜ FAIL ទាំង ៦។

### [2.50.29] — 2026-10-08 · ZoeW ៖ **ហាង Supabase ៖ `update()` ច្រើនជាង ៥០០ ផ្លូវមានកិច្ចសន្យាច្បាស់ ៖ បំបែកបានតែ payload idempotent · `increment()` ត្រូវបដិសេធមុនសរសេរ** (Deep audit ២ · ជុំ ១៣ · SUPABASE-6)

**ZoeW `2.50.29`** (`zoew-v291` ➜ `zoew-v292`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី (⛔ ពិដាន ៥០០ op របស់ `zoe_write` មិនប្រែ)។

#### អ្វីដែលខុសពីមុន

- 🧮 **SUPABASE-6** ៖ `update()` ពហុផ្លូវរបស់ RTDB ជា atomic · `zoe_write` ទទួល ≤ `SB_OPS_PER_WRITE` (៥០០) op ➜ adapter បំបែក update ធំជាការសរសេរច្រើនដែល atomic ដាច់ៗពីគ្នា ➜ ការអនុវត្តពាក់កណ្តាល
  ដែលគ្មានអ្វីទប់ ៖ `increment()` + ការព្យាយាមម្តងទៀត = បូកពីរដង។ ឥឡូវ ៖ update > ៥០០ ផ្លូវដែលមាន `increment()` ➜ បោះមុនសរសេរ (គ្មាន `zoe_write`) · ≤ ៥០០ នៅ atomic ដូចដើម · អ្នកហៅ `fb.update(` ទាំង ៩
  ចាត់ថ្នាក់ BOUNDED (ផ្លូវថេរតូច ៖ ការលុប/ស្តារជាមួយរបង · increment មានតែក្នុង `finalizeClaimedRestore`) ឬ IDEMPOTENT (`null`/តម្លៃដាច់ខាត ៖ ដោះ registry · purge · mirror ចំណូល)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. គ្មានការសាកពិសេស (គ្មានអ្នកហៅបច្ចុប្បន្នណាផ្ញើ increment លើស ៥០០ ផ្លូវ)។

#### អ្នកយាម

- `ZoeW/tests/supabase-update-contract.test.ts` (ថ្មី · ៦ · adapter ពិត + backend ក្លែង) ៖ ៥០០ ➜ ការសរសេរ ១ · ៥០១ ➜ ២ · ១២០១ idempotent ➜ ៥០០/៥០០/២០១ · > ៥០០ + increment ➜ បដិសេធ គ្មាន `zoe_write`
  (មុនកែ FAIL ១ ៖ «resolved») · បញ្ជីអ្នកហៅ `fb.update(` និង `fb.increment(` ដេរីវេពី `src/` ទាំងពីរទិស · ពិដាន ៥០០ = migration · mutation gate ➜ FAIL ១។

### [2.50.28] — 2026-10-08 · ZoeW ៖ **ហាង Supabase ៖ ចាកចេញ ឬចូលគណនីផ្សេងក្នុងផ្ទាំងមួយ ➜ ផ្ទាំងផ្សេងបញ្ចប់សម័យ ហើយមិនប្រើ token គណនីផ្សេង** (Deep audit ២ · ជុំ ១៣ · SUPABASE-1)

**ZoeW `2.50.28`** (`zoew-v290` ➜ `zoew-v291`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 🔐 **SUPABASE-1** ៖ `signOut()` របស់ adapter លុប `zoew-sb-auth*` ដោយខ្លួនឯង (⛔ មិនហៅ `client.auth.signOut()`) ➜ supabase-js មិនផ្សាយ SIGNED_OUT ទៅផ្ទាំងផ្សេង ➜ PC ប្រើរួម ៖ ផ្ទាំង B
  នៅបង្ហាញទិន្នន័យហាង ហើយ `rpc()` ផ្ញើសំណើអនាមិក · ផ្ទាំង A ចូលគណនីផ្សេង ➜ ផ្ទាំង B អាន session ថ្មីពី localStorage ដែលចែករួម ➜ ផ្ញើ **token របស់គណនីផ្សេង** ខណៈអេក្រង់នៅគណនីចាស់។
  ឥឡូវ ៖ session ចងនឹងផ្ទាំងដែលបង្កើតវា (`bindTo()`) ➜ `storage` event លើ `zoew-sb-auth` (លុប ឬគណនីផ្សេង) · `getSession()` ក្នុង `rpc()`/`accessToken()` ដែលបាត់ ឬជាគណនីផ្សេង ➜ ផ្ទាំងបញ្ចប់សម័យ
  (`onForeignSession` ➜ `resetForSignOut()` + សារ «សម័យចូលប្រព័ន្ធលើឧបករណ៍នេះបានបញ្ចប់») ហើយមិនផ្ញើអ្វីទាំងអស់រហូតដល់ចូលម្តងទៀត · ការ refresh token គណនីដដែលក្នុងផ្ទាំងផ្សេង ➜ មិនប៉ះ · ⛔ មិនពឹង BroadcastChannel។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. សាក (ហាង Supabase · កុំព្យូទ័រ) ៖ បើក ZoeW ២ ផ្ទាំង ➜ ចាកចេញក្នុងផ្ទាំងទី ១ ➜ ផ្ទាំងទី ២ បង្ហាញសារ «សម័យចូល…បានបញ្ចប់» + ប្រអប់ចូល · ចូលគណនីផ្សេងក្នុងផ្ទាំងទី ១ ➜ ផ្ទាំងទី ២ ចេញពីគណនីមុន។

#### អ្នកយាម

- `ZoeW/tests/supabase-cross-tab-signout.test.ts` (ថ្មី · ៥ · transport + sdk ពិត ២ ផ្ទាំង · localStorage ចែករួម · storage event ទៅតែផ្ទាំងផ្សេងដូច browser) ៖ មុនកែ FAIL ៤/៥ (ផ្ទាំង B នៅក្នុងគណនី · ផ្ញើ RPC អនាមិក ·
  ផ្ញើ token u2) ➜ ៥/៥ · ទិសផ្ទុយ (refresh គណនីដដែល · key ផ្សេង) ឆ្លងទាំងពីរ tree · mutation ៖ storage listener ➜ FAIL ២ · ការពិនិត្យក្នុង `rpc()` ➜ ៤ · `accessToken()` ➜ ១។

### [2.50.27] — 2026-10-08 · ZoeW ៖ **ម៉ាស៊ីនស្កេន Barcode (WASM) ផ្ទុកមិនបានម្តង មិនធ្វើឲ្យការស្កេនស្លាប់រហូតដល់ Refresh** (Deep audit ២ · ជុំ ១២ · SENTRY-2)

**ZoeW `2.50.27`** (`zoew-v289` ➜ `zoew-v290`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 📷 **SENTRY-2** ៖ `initScanEngine()` ហៅ `ZXingWASM.prepareZXingModule()` ម្តង ដោយគ្មាន `.catch` ➜ WASM ទាញមិនបាន (Emscripten ទាញ ២ ដង ៖ streaming + ArrayBuffer) ឬ compile មិនបាន (memory) ➜ zxing-wasm
  ចងចាំ promise ដែល reject (`WeakMap`) ➜ រាល់ `readBarcodes()` បន្ទាប់ reject «Aborted(both async and sync fetching of the wasm failed)» ➜ `decodeBarcodeFromCanvasManual()` ត្រឡប់ `''` ➜ កាមេរ៉ា · រូបភាព · QR Config
  «រកមិនឃើញ» រហូតដល់ Refresh · unhandled rejection + pageerror ទៅ Sentry រាល់បើក App។
  ឥឡូវ ៖ `noteScanEngineLoadFailed()` ៖ `purgeZXingModule()` · decode ឈប់ខណៈធ្លាក់ (`scanEngineDown` ៖ ⛔ `readBarcodes()` ក្រោយ purge ប្រើ `locateFile` លំនាំដើម = CDN) · prepare ឡើងវិញពី `./vendor/`
  តាម `SCAN_ENGINE_RETRY_STEPS_MS` (៣ · ១០ · ៣០ · ៦០ វិ. · ជំហានចុងក្រោយបន្ត) · Sentry ម្តងក្នុងមួយទំព័រ · toast ម្តងពេលធ្លាក់ `SCAN_ENGINE_FAIL_TOAST_AFTER` (៣) ដង។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. គ្មានការសាកពិសេស (ករណីនេះកើតតែពេល WASM ទាញ/compile មិនបាន)។ Sentry ៖ «Scan engine initialization error» គួរកម្រ ហើយមួយក្នុងមួយទំព័រ។

#### អ្នកយាម

- `ZoeW/tests/scan-engine-recovery.test.ts` (ថ្មី · ៤ · ZXing ក្លែង) ៖ មុនកែ FAIL ៣/៤ ➜ ៤/៤ · ទិសផ្ទុយ (ផ្ទុកបានលើកដំបូង) ឆ្លងទាំងពីរ tree · mutation ៖ gate decode ➜ FAIL ១ · purge ➜ ២ · retry ➜ ៣ · toast ➜ ១ · Sentry-once ➜ ២។
- `scan-engine-test` (Chromium ពិត · zxing-wasm ពិត) ៖ WASM 404 ២ ដង ➜ `scanEngineDown` ➜ prepare ឡើងវិញពី `./vendor/` ➜ `readBarcodes()` ដើរ · គ្មានសំណើ CDN · គ្មាន unhandled rejection ➜ មុនកែ FAIL ២ ➜ ៥៤/៥៤។

### [2.50.26] — 2026-10-08 · ZoeW + ZoeKeyGen ៖ **ភ្ជាប់ Server មិនបាន ក្រោយការផ្ទុកទំព័រឡើងវិញស្វ័យប្រវត្តិអស់ពិដាន ➜ App ប្រាប់ «សូម Refresh ទំព័រ» ហើយឈប់ព្យាយាមឥតប្រយោជន៍** (Deep audit ២ · ជុំ ១២ · NETWORK-1)

**ZoeW `2.50.26`** (`zoew-v288` ➜ `zoew-v289`) · **ZoeKeyGen `2.24.8`** (`zoekeygen-v118` ➜ `zoekeygen-v119`) · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 🔄 **NETWORK-1** ៖ SDK Firebase ទាញមិនបាន ➜ App ផ្ទុកទំព័រឡើងវិញដោយខ្លួនឯង ≤ `FIREBASE_SDK_RELOAD_MAX` (៣) ដងក្នុងវគ្គ។ ក្រោយពិដានអស់ ជណ្តើរ ៥/១០/២០/៣០/៦០ វិ. · `online` · `visibilitychange`
  នៅហៅ `initFirebase()` រៀងរហូត ខណៈ toast ថា «កំពុងព្យាយាមម្តងទៀត...» — តែការព្យាយាមក្នុងទំព័រដដែលមិនអាចជោគជ័យ (browser ចងចាំ module ដែលទាញមិនបាន · `started` របស់ loader ZoeW)។
  ឥឡូវ ៖ `firebaseSdkNeedsRefresh()` (ពិដានអស់ · SDK មិនមាន) ➜ ជណ្តើរ · `online` · `visibilitychange` ឈប់ · ស្ថានភាពជាប់ «សូម Refresh ទំព័រ» · toast «⚠️ ភ្ជាប់ Server មិនបានទេ — សូមពិនិត្យបណ្តាញ រួច Refresh ទំព័រ» ·
  SDK ដែលមកដល់យឺតនៅតែភ្ជាប់តាម `armLateFirebaseSdkListener()` · ⛔ មិនផ្ទុកឡើងវិញលើសពិដាន (ទោះ host របស់ SDK ត្រឡប់មកវិញ)។ App ទាំងពីរដូចគ្នា (`shared-fns`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** + **ZoeKeyGen** ➜ build APK ឡើងវិញ។
2. គ្មានការសាកពិសេស (ករណីនេះកើតតែពេលបណ្តាញទប់ `gstatic.com` យូរ)។ បើចង់សាក ៖ DevTools ➜ Network ➜ Block `www.gstatic.com` ➜ Refresh ៤ ដង ➜ ស្ថានភាព «សូម Refresh ទំព័រ» · ដក Block ➜ Refresh ➜ «ភ្ជាប់ Server រួចរាល់»។

#### អ្នកយាម

- `connection-recovery-test` ១០ខ៥ (App ទាំងពីរ) ៖ ពិដានអស់ ➜ ជណ្តើរ ១០ នាទី (បណ្តាញ down ➜ up) ➜ `initFirebase` ០ · reload ០ · timer ០ · SDK មកយឺត ➜ ភ្ជាប់ · ពិដាននៅសល់ ១ ➜ reload ១ · ១០ខ៣ ៖ assertion ចាស់
  «ក្រោយអស់ពិដាន ត្រឡប់ទៅជណ្តើរ» (ចាក់សោកំហុស) ➜ «ជណ្តើរឈប់» · ១០ខ៥ខ ៖ ស្ថានភាព ZoeKeyGen · toast ZoeKeyGen ក្នុង `initFirebase` ពិត ➜ មុនកែ FAIL ៨ ➜ ២៣០/២៣០ · mutation ដក gate ក្នុង
  `scheduleFirebaseSdkRetry` ➜ FAIL ៤ · ក្នុង `retryFirebaseSdkNow` ➜ FAIL ៥ · ដកអត្ថបទ toast ZoeKeyGen ➜ FAIL ១។
- `sdk-offline-boot-test` (Chromium ពិត · ZoeW) ៖ ពិដានអស់ ➜ ស្ថានភាព + toast «Refresh» · ពិដាននៅសល់ ➜ «កំពុងព្យាយាមម្តងទៀត» ➜ មុនកែ FAIL ២ ➜ ១៩/១៩។

### [2.50.25] — 2026-10-08 · ZoeW ៖ **កញ្ចប់ «យករួច» ពីបញ្ជី ZTO របស់អតិថិជនដដែល ថ្ងៃដដែល នៅក្នុងជួរតែមួយ** (Deep audit ២ · ជុំ ១១ · ZTO-4 · ការសម្រេចម្ចាស់គម្រោង ៖ បញ្ចូលគ្នា)

**ZoeW `2.50.25`** (`zoew-v287` ➜ `zoew-v288`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ឯកសារ `LOCK` (តំបន់ ZTO) មិនប្រែ (ការកែនៅ `src/features/scan-action.ts`)។

#### អ្វីដែលខុសពីមុន

- 📦 **ZTO-4** ៖ `addOrUpdateEntry()` រំលងការរកជួរពេល `closedAtMs > 0` (`!bornClosed`) ➜ ការនាំចូលបញ្ជី ZTO បង្កើតមួយជួរក្នុងមួយកញ្ចប់ «យករួច» សូម្បីអតិថិជនដដែល ថ្ងៃដដែល (ផ្ទុយច្បាប់ «មួយជួរ = អតិថិជនម្នាក់ក្នុងមួយថ្ងៃ»)។
  ឥឡូវ ៖ ជួរ born-closed បញ្ចូលចូលជួរដែលបិទទាំងអស់របស់អតិថិជនដដែល ថ្ងៃដដែល (barcode នីមួយៗរក្សា `closedAt` ខ្លួន ➜ ច្បាប់ ២ ម៉ោងដើរតាម barcode ដដែល) · `isClosed` ជួរដេរីវេពី barcode ទាំងអស់
  (server បើកជួរវិញ ➜ មិនបិទក្លែង) · `closedAt` ជួរ = ថ្មីបំផុត · ជួរបើកនៅបញ្ចូលចូលជួរបើកដូចដើម · «គ្មានលេខ» មិនបញ្ចូល។ ចំណូល/ចំនួនមិនប្រែ (ledger ១ ក្នុងមួយកញ្ចប់ដដែល)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. សាក ៖ «📥 ទាញបញ្ជីកញ្ចប់ពី ZTO» ដែលមានកញ្ចប់ «យករួច» ច្រើនរបស់អតិថិជនដដែលក្នុងថ្ងៃដដែល ➜ «➕ បញ្ចូល» ➜ ប្រវត្តិមានជួរតែមួយ (ចំនួន = កញ្ចប់) · ក្រោយ ២ ម៉ោង ➜ ចូលធុងសំរាម «យករួច» · ចំណូលថ្ងៃកើនតែម្តងក្នុងមួយកញ្ចប់។

#### អ្នកយាម

- `ZoeW/tests/zto-born-closed-merge.test.ts` (ថ្មី · ៤ · store ក្លែង + `addOrUpdateEntry` ពិត) ៖ មុនកែ FAIL ២/៤ (២ ជួរ · server បើកវិញ ➜ ជួរថ្មី) ➜ ៤/៤ · ទិសផ្ទុយ (ជួរបើក · អតិថិជនផ្សេង · «គ្មានលេខ» · ថ្ងៃផ្សេង) ឆ្លងទាំងពីរ tree ·
  តេស្ត ZTO ផ្សេង (`zto-signed-sync` · `zto-import-lanes` · `zto-signed-only-purge` · `merge-into-deleted-item` · `lookup-late-answer-busy`) ៦២/៦២។

### [2.50.24] — 2026-10-08 · ZoeW ៖ **ចូលដោយក្រយៅដៃ ឬមុខ (web) ការពារ PIN ដោយ WebAuthn PRF តែប៉ុណ្ណោះ** (Deep audit ២ · ជុំ ១០ · SECURITY-1 · ការសម្រេចម្ចាស់គម្រោង ៖ PRF-only)

**ZoeW `2.50.24`** (`zoew-v286` ➜ `zoew-v287`) · ⛔ ZoeKeyGen មិនប្រែ (PRF-only រួចហើយ) · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 🔐 **SECURITY-1 ៖ របៀប `device` ទុកសោក្បែរ PIN ដែលរុំ** ៖ ឧបករណ៍គ្មាន PRF ធ្លាក់ចូលរបៀប `device` ដែលទុក `wrapKey` (សោ AES ឆៅ) ក្បែរ `wrapped` ក្នុង localStorage ➜ អ្នកដែលចម្លង storage បាន
  (កុំព្យូទ័ររួម · extension · backup) ឌិគ្រីប PIN បានដោយគ្មានស្នាមម្រាមដៃ — `navigator.credentials.get()` ជាទ្វារ UI តែប៉ុណ្ណោះ។ ឥឡូវ ៖ web ចងតែពេល PRF ផ្តល់សោពីឧបករណ៍ · គ្មាន PRF ➜ មិនចង
  («… មិនគាំទ្រការការពារ PIN ដោយជីវមាត្រ (WebAuthn PRF) ➜ សូមប្រើ PIN ជំនួស») · record `device` ចាស់ ➜ `initBiometricUi()` លុបចេញពី storage ហើយប្រាប់ម្តង (វាយ PIN រួចបើកម្តងទៀត) ·
  `readBiometricRecord()` មិនទទួល `device` · `biometricUnlockPin()` មិនមានផ្លូវ `wrapKey` ទៀត។ APK (native) មិនប្រែ។
- ⚠️ ឧបករណ៍ web ដែលគ្មាន PRF (Safari មុន iOS 18 · កម្មវិធីរុករកចាស់) ➜ ប្រើ PIN។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. សាក ៖ iPhone PWA (iOS 18+) · Android Chrome ➜ ☰ ➜ «ចូលដោយក្រយៅដៃ ឬមុខ» ➜ វាយ PIN ➜ ស្កេន ➜ «✅ បើករួច!» ➜ ចាក់សោ App ➜ ដោះដោយក្រយៅដៃ/មុខ ·
   ឧបករណ៍ដែលធ្លាប់បើកក្នុងរបៀប device ➜ បើក App ➜ សារ «⚠️ ការចូលដោយក្រយៅដៃ ឬមុខត្រូវបិទ …» ម្តង ➜ បើកម្តងទៀត (ឬប្រើ PIN បើឧបករណ៍មិនគាំទ្រ)។

#### អ្នកយាម

- `ZoeW/tests/biometric-no-device-mode.test.tsx` (ថ្មី · ៤) ៖ មុនកែ FAIL ៣/៤ (record `device` + `wrapKey` ក្នុង storage · record ចាស់នៅបើក · `wrapKey` ពិតដោះ PIN) ➜ ៤/៤ · ទិសផ្ទុយ PRF ឆ្លងទាំងពីរ tree។
- `biometric-unlock-test` ៖ ផ្នែក «គ្មាន PRF» ចាក់សោឥរិយាបថថ្មី (គ្មាន record · គ្មាន `wrapKey` · សារ PRF/PIN) · record `device` ដែលមាន `wrapKey` ➜ បិទ · ៥៣/៥៣។

### [2.50.23] — 2026-10-08 · ZoeW + ZoeKeyGen ៖ **Sentry ៖ secret របស់ Push និងស្នាមម្រាមដៃមិនចេញ · event មានកំណែ App និងព័ត៌មានកំហុស** (Deep audit ២ · ជុំ ៩ · SECURITY-2 · SENTRY-3)

**ZoeW `2.50.23`** (`zoew-v285` ➜ `zoew-v286`) · **ZoeKeyGen `2.24.7`** (`zoekeygen-v117` ➜ `zoekeygen-v118`) · `error-reporting.js` ដូចគ្នា byte-for-byte ទាំងពីរ App · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 🔐 **SECURITY-2 ៖ secret ក្នុងវត្ថុរអិលទៅ Sentry** ៖ `SECRET_KEY_PATTERN` (កូនសោវត្ថុ) ខ្វះ `auth` · `wrap_key` · `wrapped` · `p256dh` ➜ subscription Web Push (`keys.p256dh` · `keys.auth`) និង record biometric
  (`wrapKey` ក្បែរ `wrapped` ៖ PIN ទទួលបានវិញ) ចេញទៅ Sentry ពេលភ្ជាប់ជាវត្ថុ (breadcrumb `console` · extra)។ ឥឡូវ ៖ ពាក្យទាំង ៤ ក្នុងបញ្ជីកូនសោ · `p256dh` · `wrapped` ក្នុងបញ្ជីខ្សែអក្សរ (`auth` មានរួច)។
  ⚠️ ពាក្យ `auth` ជា token ➜ កូនសោដូច `authGeneration` · `authDomain` ក៏ត្រូវលាក់ (គ្មាន `ZoeErrors.capture` ណាផ្ញើវា) · `author` · `mode` · `keyId` នៅមើលឃើញ។
- 🏷️ **SENTRY-3 ៖ event គ្មាន release · វាលរបស់ Error បាត់** ៖ `ZoeErrors.init('zoew')` / `init('zoekeygen')` គ្មាន release ➜ Sentry មិនបែងចែកកំណែ។ ឥឡូវ `zoew@<APP_VERSION>` · `zoekeygen@<APP_VERSION>`
  (ការហៅទាំង ៤)។ វាល primitive របស់ Error ក្នុង allowlist (`lookupCode` · `lookupReason` · `listReason` · `txOutcome` · `txServerUnread` · `txProven` · `code` · `status` · `httpStatus` · `noRetry` · `notConfigured` · `unsent` · `stage` ·
  ខ្សែអក្សរ ≤ ២០០) ទៅ `extra.errorFields` (ឆ្លង redaction ដដែល) · វាលផ្សេង និងវត្ថុមិនផ្ញើ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** និង **ZoeKeyGen** ➜ build APK ឡើងវិញ។ គ្មាន rules · env · migration ថ្មី។
2. Sentry ៖ event ក្រោយ Deploy មាន release `zoew@2.50.23` / `zoekeygen@2.24.7` · event «Transaction outcome unknown» មាន `errorFields.txOutcome` · (ជម្រើស) Sentry ➜ Settings ➜ Releases ៖ issue ចាស់ «Resolve in next release»។

#### អ្នកយាម

- `secret-hygiene` ចន្លោះ ១ឃ (ថ្មី · ឈ្មោះដេរីវេពីកូដពិត ៖ `keys: { … }` របស់ push · `rec.*` ចូល `unwrapPinWithRawKey()`) ៖ មុនកែ FAIL ១៣ ➜ ២៤២/២៤២។
- `sentry-load-race-test` (ការហៅ `ZoeErrors.init(` ដេរីវេពីកូដ ship ទាំងពីរ App + វាយតម្លៃ argument ក្នុង vm · `errorFields` លើ `error-reporting.js` ពិតក្នុង browser) ៖ មុនកែ FAIL ៧ ➜ ៣៥/៣៥។

### [2.50.22] — 2026-10-08 · ZoeW ៖ **ចំណូលថ្ងៃ/ខែមិនរាប់ពីរដង ពេលបណ្តាញដាច់ចំពេលរក្សាទុក ខណៈឧបករណ៍ផ្សេងសរសេរចំណូលដដែល** (Deep audit ២ · MONEY-4 · PR ដាច់ · សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.22`** (`zoew-v284` ➜ `zoew-v285`) · ⛔ ZoeKeyGen មិនប្រែ · **Firebase rules ប្រែ** (`ops/$op` ក្នុង `zoew_daily_revenue_cod_dod/$date` និង `zoew_monthly_revenue_cod_dod/$month`) ·
**migration Supabase ថ្មី** `supabase/migrations/20261008023215_zoe_rules.sql` (`generate-rules-sql.mjs`)។

#### អ្វីដែលខុសពីមុន

- 🗣️ **សំណើ** ៖ ម្ចាស់គម្រោងសម្រេច MONEY-4 «កែពិត · PR ដាច់» (⛔ មិនមែន «`ok:false` គ្មានការអនុវត្តឡើងវិញ»)។
- 💵 **MONEY-4 ៖ `unknown` ដែល server អានបាន ➜ ledger ពីរដង** ៖ transaction ledger (ថ្ងៃ · ខែ) ចុះលើ server ➜ ការតភ្ជាប់ដាច់មុនចម្លើយ (`disconnect`) ➜ wrapper អាន REST ➜ ឧបករណ៍ផ្សេងសរសេរ record ដដែល
  ចន្លោះ commit និងការអាន ➜ server ≠ តម្លៃដែលផ្ញើ ≠ តម្លៃមុន ➜ `unknown` ដែលអានបាន ➜ `ledgerRejectionVerdict()` = `null` ➜ reconcile ចាត់ទុក «មិនបានអនុវត្ត» ➜ អនុវត្ត delta ម្តងទៀត ➜ **ពីរដង** ហើយ `ok: true` (✅ ខុស)។
  ទ្វារដដែល ៖ ការស្តារ (`increment` លើ `codDollar` · `op` នៅដដែល) ចន្លោះ commit និងការអាន។ ឥឡូវ ៖ ការសរសេរ ledger នីមួយៗផ្ទុក ring `ops` (token របស់អ្នកសរសេរ `LEDGER_OP_RING_MAX` នាក់ចុងក្រោយ ➜ លំដាប់) ➜
  wrapper សួរ `ledgerOpWitness()` ៖ token យើងក្នុង ring ឬ `op` ➜ `applied` (snapshot = តម្លៃដែលយើងផ្ញើ) · token ដែល ring មុនមាន (ឬ `op` របស់ record ចាស់គ្មាន ring) នៅតែមាន តែយើងគ្មាន ➜ `not-applied` (ផ្ញើម្តងទៀត) ·
  record មិនទាន់មាន + លំដាប់ 1 របស់គេ ➜ `not-applied` · ផ្សេងពីនោះ (ring ពេញ · ឧបករណ៍កំណែចាស់លុប ring · record ចាស់គ្មាន token) ➜ `unknown` ➜ reconcile **មិនអះអាង ✅** (សារ «ស្ថិតិប្រាក់មិនទាន់ Sync» + Sentry money)។
- 🔐 rules មិនទាន់ Publish ➜ ការសរសេរ ring ត្រូវបដិសេធ ➜ App ផ្ញើម្តងទៀតដោយ `op` តែប៉ុណ្ណោះ (rules ចាស់ជាងនោះ ➜ គ្មាន `op`) ➜ ចំណូលនៅតែចូល (មួយជុំបន្ថែម) តែការការពារ MONEY-4 មិនទាន់ដំណើរការ។
- ⚠️ ព្រំដែន ៖ record ចាស់គ្មាន token · ឧបករណ៍កំណែចាស់ក្នុងហាងតែមួយ · ឧបករណ៍ផ្សេងសរសេរលើស ring ខណៈរង់ចាំការអាន ➜ សម្រេចមិនបាន ➜ App ប្រាប់ការពិត (មិន ✅) · ហាង Supabase ៖ `op_id` សម្រេចរួចហើយ (ring ចូលដូចគ្នា តែមិនប្រើ) ·
  ring បន្ថែមប្រហែល ២៥០ byte ក្នុង record ថ្ងៃ/ខែនីមួយៗ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. ⛔ **Publish Firebase rules** (`firebase-database.rules.json`) ទៅ **គ្រប់អតិថិជន Firebase មុន Deploy** ៖ Firebase Console ➜ Realtime Database ➜ Rules ➜ បិទភ្ជាប់ ➜ Publish ឬ `tools/firebase-provision/deploy-rules.cmd`។
2. merge ➜ migration Supabase `20261008023215_zoe_rules.sql` ចូល live តាម GitHub integration (ឬបិទភ្ជាប់ក្នុង SQL Editor) ➜ ផ្ទៀង version ក្រោយ merge។
3. Deploy **ZoeW** ➜ build APK ឡើងវិញ។ គ្មាន env ថ្មី។
4. សាក ៖ ស្កេន ១ កញ្ចប់ ➜ Firebase Console ➜ `zoew_daily_revenue_cod_dod/<ថ្ងៃ>` និង `zoew_monthly_revenue_cod_dod/<ខែ>` មាន `ops` (token ១) · ចំណូល/ចំនួនកើនតែម្តង · ស្កេន ១៥ កញ្ចប់ ➜ `ops` មិនលើស ១២។
5. Sentry ៖ «Transaction outcome unknown after disconnect» (zone money) នៅមានពេលសម្រេចមិនបាន ➜ ពិនិត្យជាមួយ «… ledger reconciliation did not commit» នៃ `barcode`/`itemId` ដដែល។

#### អ្នកយាម

- `audit-tools/tx-outcome-test.js` ផ្នែក ៤ខ២ (ថ្មី · ១៨ · ឧបករណ៍ទី ២ រត់កូដ App ពិតក្នុង sandbox ទី ២ · server ចែករំលែក) ៖ មុនកែ FAIL ១២/១៨ (ថ្ងៃ ៨៨ ជំនួស ៩៣ · ខែ ៨៨ · ការស្តារ ៩៣ ជំនួស ៩៨ ·
  ថ្ងៃថ្មី ១២ ជំនួស ៧ · `ok: true` ពេលសម្រេចមិនបាន) ➜ ១៨/១៨ · ផ្នែកទាំងមូល ១១០/១១០។
- `revenue-fuzz-test` ៖ ការចាក់ `ledgerBlip` (applied/lost + ឧបករណ៍ផ្សេងស្កេន + `disconnect` · wrapper ពិតអាន server តាម fetch ក្លែង) ➜ មុនកែ invariant បែក (ចំណូល ១០៦,៤៦ ជំនួស ៧៧,៦៣) ➜ ក្រោយ PASS ៣/៣។
- `ZoeW/tests/ledger-op-ring.test.ts` (ថ្មី · ៧) · `ledger-not-applied-retry.test.ts` (ការថយ ៣ ជាន់ ៖ ring ➜ `op` ➜ គ្មាន) · `money-guardian` mutation ថ្មី ២។

### [2.50.21] — 2026-10-08 · ZoeW ៖ **ទាញបញ្ជី ZTO មិនបញ្ចូលកញ្ចប់ដែល ZoeW យករួចម្តងទៀត ក្រោយធុងសំរាមត្រូវលុប (COD មិនរាប់ពីរដង)** (Deep audit ២ · ជុំ ៨ · ZTO-2 · តំបន់ចាក់សោ · សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.21`** (`zoew-v283` ➜ `zoew-v284`) · ⛔ ZoeKeyGen · **Firebase rules · migration Supabase មិនប្រែ** · `src/features/zto-list-sync.ts` ប្រែ ➜ sha256 ថ្មីក្នុង `LOCK`។

#### អ្វីដែលខុសពីមុន

- 🗣️ **សំណើ (តំបន់ចាក់សោ)** ៖ ម្ចាស់គម្រោង «បន្តធ្វើ SENTRY-1 · ZTO-1 · ZTO-2»។ ហេតុផល ៖ ការនាំចូលបញ្ជី ZTO បញ្ចូលកញ្ចប់ដែល ZoeW បានរាប់ចំណូលរួចម្តងទៀត ➜ ledger ថ្ងៃ/ខែលើស COD។
- 📦 **ZTO-2 ៖ ជួរ `signedOnly` ក្រោយធុងសំរាម «យករួច» ត្រូវលុប** ៖ `classifyZtoListRows()` ស្គាល់ «មានក្នុង ZoeW» តែពីប្រវត្តិ និងធុងសំរាម · ជួរ `signedOnly` (ការចុះហត្ថលេខាក្នុងចន្លោះ ·
  ការមកដល់មុនចន្លោះ) មានតែការពិនិត្យអាយុលើ **ម៉ោងចុះហត្ថលេខា** (> ៣០ ថ្ងៃ ➜ `too-old-purged`) ➜ បើ ZTO Palm ចុះហត្ថលេខាយឺតជាងការបិទដោយដៃ > ២ ម៉ោង មានចន្លោះ (បិទ + ២ ម៉ោង + ៣០ ថ្ងៃ ·
  ចុះហត្ថលេខា + ៣០ ថ្ងៃ] ដែលធុងសំរាមលុបរួច key registry ដោះរួច ➜ «ទាញបញ្ជីកញ្ចប់ពី ZTO» បញ្ចូលវាជាកញ្ចប់ថ្មី ➜ ledger ថ្ងៃ D ១០ ➜ ២០ សម្រាប់កញ្ចប់តែមួយ។
  ឥឡូវ ៖ ស្ថិតិយក `zoew_daily_pickup_cod_dod/<ថ្ងៃ>/pickedUpBarcodes/<key>` (listen ទាំងមូល · មិនលុបតាមអាយុ) ជាសញ្ញាដែលមានស្រាប់ថា ZoeW បានយកកញ្ចប់នោះ ➜ ជួរ `signedOnly` ដែល key មានក្នុងថ្ងៃណាមួយ
  ខណៈគ្មានក្នុងប្រវត្តិ/ធុងសំរាម ➜ `too-old-purged` (preview និង import ដូចគ្នា)។ ⛔ មិនប្រើ registry ជា tombstone · គ្មាន path/rules ថ្មី (ផែនការ tombstone ក្នុងរបាយការណ៍មិនចាំបាច់)។
  ⚠️ ព្រំដែន ៖ ថ្ងៃដែលត្រូវ «Reset ចំនួនយករួច» (`{ packagesPickedUp: 0 }`) បាត់ key ➜ ឥរិយាបថដូចមុនសម្រាប់ថ្ងៃនោះ · ទិន្នន័យចាស់ដែលមានតែ placeholder `_lg_*` ដូចគ្នា។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។ **គ្មាន** Firebase rules · env · migration ថ្មី។
2. គ្មានការសាកពិសេស (ត្រូវការកញ្ចប់អាយុ ៣០ ថ្ងៃ)។ ការទាញបញ្ជីប្រចាំខែ ៖ កញ្ចប់ចាស់ដែលយករួចបង្ហាញក្នុង «រំលង» មិនមែន «បញ្ចូល»។

#### អ្នកយាម

- `ZoeW/tests/zto-signed-only-purge.test.ts` (ថ្មី · ៣ · lifecycle ពិត ៖ `claimBarcodeInRegistry` · `addOrUpdateEntry` · `applyBarcodeCloseChange` · `runAutomaticCleanupRules` · `runAutomaticDeletedCleanup` ·
  `classifyZtoListRows` · `importZtoListRows`) ៖ ស្កេន ➜ បិទ ➜ ២ ម៉ោង ➜ លុប ៣០ ថ្ងៃ ➜ ទាញ ➜ `too-old-purged` · បញ្ចូល ០ · ledger ១០ · ទិសផ្ទុយ ៖ ២៩ ថ្ងៃ ➜ existing · កញ្ចប់ដែល ZoeW មិនដែលកត់ ➜ បញ្ចូល។
  មុនកែ FAIL ១/៣ (ledger ២០) · mutation ៖ ដក `dailyPickupData` ពីអ្នកហៅ ➜ FAIL ១។ តេស្ត ZTO ផ្សេង ២៤៤ ឆ្លង · `zto-lock` ១២/១២។

### [2.50.20] — 2026-10-08 · ZoeW ៖ **ការសម្អាត ៧ ថ្ងៃលើឧបករណ៍ Data Saver · 2G · secret ចាក់សោ មិនដកកញ្ចប់ដែល ZTO ចុះហត្ថលេខារួច** (Deep audit ២ · ជុំ ៧ · ZTO-1 · តំបន់ចាក់សោ · សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.20`** (`zoew-v282` ➜ `zoew-v283`) · ⛔ ZoeKeyGen · Firebase rules · migration Supabase មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- 🗣️ **សំណើ (តំបន់ចាក់សោ)** ៖ ម្ចាស់គម្រោង «បន្តធ្វើ SENTRY-1 · ZTO-1 · ZTO-2» ➜ `src/features/zto-status.ts` ប្រែ ➜ sha256 ថ្មីក្នុង `LOCK` (`ZoeW/tests/zto-lock.test.ts`)។
  ហេតុផល ៖ ការអានបញ្ជីចុះហត្ថលេខាត្រូវរំលងដោយហេតុមិនមែនបណ្តោះអាសន្ន ➜ ការរង់ចាំ ៧ ថ្ងៃអស់ពេលដោយគ្មានការអានមួយ ➜ កញ្ចប់ដែល ZTO ចុះហត្ថលេខារួចត្រូវដកលុយជា «ផុតកំណត់»។
- 📶 **ZTO-1 ៖ Data Saver · 2G** ៖ `ztoSignedNetworkAllowed()` បដិសេធការអានពេល `linkIsFrugal()` ➜ ០ fetch · ការរង់ចាំបញ្ចប់នាទីទី ៣១ ➜ `claimAndCleanupItem('abandon')` ➜ ធុងសំរាម `expired` ·
  ដកលុយ · marker ហាងមិនដែលសរសេរ។ ឥឡូវ ការអានឆ្លងកាត់ frugal **តែខណៈការរង់ចាំ abandon សកម្ម** (`ztoAbandonHoldIsActive()` · កញ្ចប់ ៧ ថ្ងៃកំពុងរង់ចាំ) ➜ ទំព័រ JSON តូចមួយ ➜ បិទជា «យករួច»។
  គ្មានកញ្ចប់រង់ចាំ ➜ Data Saver គោរពដដែល (០ fetch)។ `/detail` មិនប្រែ។
- 🔒 **ZTO-1 ៖ secret ចាក់សោ** (`headerValueEnc` ដោយគ្មាន `lookupSecretKey` ក្រោយ reload រហូតវាយ PIN) ៖ `runZtoStatusSweep()` ត្រឡប់ ០ មុនអាន ➜ ការរង់ចាំ ៣០ នាទីអស់ ➜ abandon។ ឥឡូវ
  `ztoAbandonCleanupIsHeld()` កាន់ដោយមិនរាប់ម៉ោងការរង់ចាំ ខណៈឧបករណ៍អានមិនបាន ➜ PIN ➜ ការអានចាប់ផ្តើម · ការរង់ចាំ ៣០ នាទីចាប់ផ្តើមពីពេលនោះ (មិនជាប់ ៖ ZTO មិនចុះហត្ថលេខា ➜ abandon ដូចធម្មតា)។
  ការពន្យារ abandon មិនប៉ះលុយ (កញ្ចប់បើកមិនរាប់ក្នុង «ចំណូល (យករួច)») · ឧបករណ៍ផ្សេងដែលអានបាន សម្អាតតាមច្បាប់របស់វា។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។ គ្មាន rules · env · migration ថ្មី។
2. សាក (ឧបករណ៍ ZTO · Fast Mode · បិទតាម ZTO ស្វ័យប្រវត្តិ) ៖ បើក Data Saver ➜ កញ្ចប់ ៨ ថ្ងៃដែល ZTO ចុះហត្ថលេខា ➜ ត្រូវបិទជា «យករួច» (មិនមែន «ផុតកំណត់») ក្នុង ៣០ នាទី។

#### អ្នកយាម

- `ZoeW/tests/zto-abandon-blocked-sweep.test.tsx` (ថ្មី · ៥ · `zto-status.ts` · `domain/cleanup.ts` · `network.ts` ពិត · gate abandon ពិត) ៖ Data Saver និង 2G ➜ អាន · បិទ · មិន abandon ក្នុង ៤៥ នាទី ·
  ទិសផ្ទុយ ៖ គ្មានកញ្ចប់ ៧ ថ្ងៃ ➜ ០ fetch · secret ចាក់សោ ➜ មិន abandon ក្នុង ៤៥ នាទី ➜ PIN ➜ បិទ · ទិសផ្ទុយ (មិនជាប់) ៖ PIN + ZTO មិនចុះហត្ថលេខា ➜ abandon។ មុនកែ FAIL ៣/៥
  (abandon នាទីទី ៣១ · ០ fetch)។ តេស្ត ZTO ផ្សេង ២៥២ ឆ្លង · `zto-lock` ១២/១២ ជាមួយ sha256 ថ្មី។

### [2.50.19] — 2026-10-08 · ZoeW ៖ **សម្គាល់ការខល · កែលេខទូរស័ព្ទ ពេលបណ្តាញយឺត ៖ រង់ចាំចម្លើយពិត មិនត្រឡប់ដើមខណៈ transaction នៅរស់** (Deep audit ២ · ជុំ ៦ · SENTRY-1 · សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.19`** (`zoew-v281` ➜ `zoew-v282`) · ⛔ ZoeKeyGen · Firebase rules · migration Supabase · តំបន់ ZTO ចាក់សោ មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- 🗣️ **សំណើ** ៖ ម្ចាស់គម្រោង «បន្តធ្វើ SENTRY-1 · ZTO-1 · ZTO-2» (SENTRY-1 ធ្លាប់ «គួរសួរ» ព្រោះប្តូរការសម្រេចចាស់ ៖ ព្យួរ ➜ revert)។
- ⏳ **SENTRY-1 ៖ patch ជាប់គាំង ➜ «ត្រឡប់ដើមវិញ» ខណៈ transaction នៅរស់** (Sentry `JAVASCRIPT-REACT-7`) ៖ `patchHistoryItemFields()` ពេល `dbOp` ហួស ១៥ វិ. ដោយគ្មាន `disconnect`
  ត្រឡប់ field ក្នុង App · toast «បរាជ័យ» · Sentry ➜ transaction ដដែល commit ក្រោយមក ➜ server មានតម្លៃថ្មី ខណៈ App បង្ហាញចាស់ · កែលេខ ➜ `revertPickupRefMove()` ធ្វើឲ្យម្ចាស់ស្ថិតិយកខុសរហូត session ក្រោយ។
  ឥឡូវ ៖ `'pending'` + ⏳ (មិន revert · មិនចូលជួរ) ➜ `armLateCommit` ៖ commit ➜ ✅ · បរាជ័យ ឬកញ្ចប់បាត់ ➜ ត្រឡប់តែ field ដែលគ្មានការជ្រើសថ្មីជាងនេះ + toast/Sentry · ប្តូរ session ➜ មិនប៉ះ។
  `setCallMark()` · `flushPendingHistoryPatches()` មិនប្រកាស ✅ លើ `pending` · `saveEditedPhone()` ផ្ទេរការសម្រេចទៅ `onLateSettled` (reconcile ស្ថិតិយក + ✅ ឬ ត្រឡប់ម្ចាស់ស្ថិតិយក)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។ គ្មាន rules · env · migration ថ្មី។
2. សាក ៖ បើក DevTools ➜ Network «Slow 3G» (ឬទូរស័ព្ទសញ្ញាខ្សោយ) ➜ សម្គាល់ការខល ➜ ⏳ ➜ ស្លាកមិនលោតត្រឡប់ ➜ ពេលបណ្តាញមកវិញ ✅ តែម្តង។ Sentry `JAVASCRIPT-REACT-7` លែងមាន event ថ្មី ➜ Resolve។

#### អ្នកយាម

- `ZoeW/tests/history-patch-late-commit.test.ts` (ថ្មី · ៨ · `patchHistoryItemFields` · `setCallMark` · `saveEditedPhone` ពិត) ៖ ព្យួរ ➜ `pending` · ⏳ · គ្មាន Sentry ➜ commit យឺត ➜ ✅ ១ · បរាជ័យយឺត ➜ revert + Sentry ·
  កញ្ចប់បាត់ ➜ revert · ការជ្រើសថ្មីនៅរស់ · ប្តូរ session ➜ មិនប៉ះ · ការខល ✅ តែក្រោយ commit · កែលេខ ៖ ម្ចាស់ស្ថិតិយកនៅលេខថ្មីខណៈ pending ➜ ✅ / បរាជ័យ ➜ លេខចាស់។ មុនកែ FAIL ៦/៨។
- `history-patch-retry-test` «ការព្យួរសុទ្ធ» ៖ ច្បាប់ចាស់ (revert) ➜ ច្បាប់ថ្មី (`pending` · មិន revert · មិនចូលជួរ · ⏳ គ្មាន ✅/បរាជ័យ) · `db-stall-guard` · `history-patch-retry-test` ផ្ទុក `armLateCommit` ពិត ·
  `toast-action-truth-test` ទទួល success ក្នុង settle ដែល `.then` ហៅ។

### [2.50.18] — 2026-10-08 · ZoeW ៖ **ការសម្អាត ឬការលុបដែលចម្លើយមកយឺត មិនសរសេរចូលហាងថ្មីក្រោយប្តូរ Config** (Deep audit ២ · ជុំ ៥ · RACES-2)

**ZoeW `2.50.18`** (`zoew-v280` ➜ `zoew-v281`) · ⛔ ZoeKeyGen · Firebase rules · migration Supabase · តំបន់ ZTO ចាក់សោ មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- 🔒 **RACES-2 ៖ ការងារក្រោយ commit គ្មាន generation gate** ៖ `claimAndCleanupItem()` និង `deleteSingleItem()` អាន `firebaseState.db` · `dbRefDeleted` · ledger refs **ពេលហៅ** ក្រោយ await នីមួយៗ ➜
  បណ្តាញដាច់ចំពេល commit ➜ `runTransactionResolved()` អាន REST (≤ ៨ វិ.) ឬការសរសេរធុងសំរាមព្យួរ ➜ អ្នកប្រើ Reconfig ទៅហាង B (មាន session) ➜ ចម្លើយ `applied` ឬការសរសេរដែលមកយឺត ➜
  ធុងសំរាម និងការដកចំណូល **ចូលហាង B** (ទិន្នន័យលេចឆ្លងហាង · ledger B ១០០ ➜ ៩០)។ ឥឡូវ ៖ (១) `txResolveOutcome()` ពិនិត្យ session ម្តងទៀតក្រោយការអាន REST ➜ ប្តូរ ➜ `unknown` មិនបានអាន
  (មិនដែល `applied`) · (២) ការសម្អាតចាប់ `db` + `authGeneration` ពេលចាប់ផ្តើម ហើយឈប់មុនការសរសេរបន្ទាប់នីមួយៗ (ក្រោយ claim · ក្រោយធុងសំរាម · ក្រោយ ledger) ជាមួយ Sentry `zone: 'money'` ·
  (៣) ការលុបឈប់មុនសរសេរធុងសំរាម ឬស្តារចូលប្រវត្តិ (Sentry `zone: 'data'`)។ ការស្តារ (`executeRestoreItem()`) ត្រូវបានការពាររួចដោយរបង claim/witness ក្នុង rules (ការសរសេរក្នុង database ផ្សេងត្រូវបដិសេធ) ➜ មិនប្រែ។
  ⚠️ ព្រំដែនដែលនៅសល់ ៖ កញ្ចប់ដែល claim រួចក្នុងហាង A ហើយឈប់ដោយសារការប្តូរ ➜ journal របស់ហាង A ត្រូវលុបពេល resume ក្នុងហាង B (`cleanupJournalScopeMismatch()` ដូចដើម) ➜ Sentry money ជាសញ្ញាឲ្យពិនិត្យដោយដៃ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។ គ្មាន rules · env · migration ថ្មី។
2. គ្មានការសាកពិសេស (ករណីត្រូវការបណ្តាញដាច់ចំពេល commit + Reconfig ក្នុងពេលតែមួយ)។ បើ Sentry បង្ហាញ «Cleanup stopped after a database switch» ➜ ពិនិត្យកញ្ចប់ `itemId` ក្នុងហាងចាស់។

#### អ្នកយាម

- `ZoeW/tests/late-commit-stale-session.test.ts` (ថ្មី · ៥ · `runTransactionResolved` · `claimAndCleanupItem` · `deleteSingleItem` ពិត · ហាង A/B ក្នុង store ក្លែងតែមួយ) ៖ (១) ប្តូរពេលអាន REST ➜ មិន `applied` ·
  (២) claim commit ក្រោយប្តូរ ➜ ធុងសំរាម/ledger B មិនប៉ះ + Sentry money · (៣) ប្តូរពេលសរសេរធុងសំរាមព្យួរ ➜ ledger B មិនប៉ះ · (៤) ការលុប ➜ ធុងសំរាម B មិនប៉ះ · (៥) ទិសផ្ទុយ ៖ គ្មានការប្តូរ ➜ ហាង A ធម្មតា។
  មុនកែ FAIL ៤/៥ · mutation ៖ ដកការពិនិត្យនីមួយៗក្នុង ៤ ➜ FAIL ១ ម្តងមួយ។

### [2.50.17] — 2026-10-08 · ZoeW ៖ **ZTO បិទម្តងទៀតលើទិដ្ឋភាពចាស់ មិនប្តូរម៉ោងបិទ · ប្តូរ backend ផ្តាច់ listener ចាស់តាម SDK ចាស់** (Deep audit ២ · ជុំ ៤ · ZTO-3 · NETWORK-2)

**ZoeW `2.50.17`** (`zoew-v279` ➜ `zoew-v280`) · ⛔ ZoeKeyGen · Firebase rules · migration Supabase មិនប្រែ · តំបន់ ZTO ចាក់សោ មិនប៉ះ (ការកែនៅ `barcode-ops.ts` ក្រៅ `LOCK`)។

#### អ្វីដែលខុសពីមុន

- ✅ **ZTO-3 ៖ បិទម្តងទៀតលើទិដ្ឋភាពចាស់ ➜ `closedAt` ថ្មី** ៖ `applyBarcodeCloseChange()` ក្នុង transaction server ហៅ `applyBarcodeCloseState(b, true, now)` ទោះ barcode បិទរួចនៅ server ➜ ឧបករណ៍ដែល
  listener ប្រវត្តិចាស់ (ឃើញបើក) ហើយ sign-list sweep ឬការបញ្ចូលបញ្ជី ZTO បិទវាម្តងទៀត ➜ `closedAt` (barcode និងកញ្ចប់) ផ្លាស់ពី ២៣:៣០ ទៅ ០០:៣០ ថ្ងៃបន្ទាប់ ➜ ការសម្អាត ២ ម៉ោងពន្យារ ·
  «ចំណូលតាមថ្ងៃយក» ផ្លាស់ទៅថ្ងៃថ្មី (លុយ ledger មិនប៉ះ)។ ឥឡូវ ៖ barcode នៅ server មានស្ថានភាពដែលចង់បានរួច ➜ រក្សា `closedAt` ដើម · កញ្ចប់ដែលបិទទាំងមូលរួចរក្សា `closedAt` ដើម ·
  barcode ដែលបើកពិតនៅ server ➜ stamp ពេលនេះដូចដើម។
- 🔌 **NETWORK-2 ៖ ប្តូរ backend ➜ `off()` តាម SDK ថ្មី** ៖ `initFirebase()` កំណត់ `firebaseState.fb = nextFb` មុន teardown ➜ `detachDatabaseListeners()` · `detachInfoListeners()` ហៅ `off()` របស់ SDK ថ្មី
  លើ ref របស់ SDK ចាស់ (Firebase ↔ Supabase) ➜ listener ចាស់មិនត្រូវផ្តាច់ (រស់រហូត `deleteApp()`)។ ឥឡូវ `firebaseState.fb` យក SDK ថ្មីតែក្រោយ teardown + `deleteApp()` ➜ SDK ចាស់ផ្តាច់ ref របស់វា ·
  ចន្លោះ teardown SDK ចាស់នៅគូនឹង database ចាស់។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។ គ្មាន rules · env · migration ថ្មី។
2. គ្មានការសាកពិសេស ៖ ឧបករណ៍ ២ ៖ A បិទកញ្ចប់ដោយដៃ ➜ B (ZTO បិទស្វ័យប្រវត្តិ) មិនប្តូរម៉ោងបិទ (🔎 មើលម៉ោងក្នុងបញ្ជី barcode)។

#### អ្នកយាម

- `ZoeW/tests/close-restamp-idempotent.test.ts` (ថ្មី · ៥ · `runZtoStatusSweep` · `applyBarcodeCloseChange` ពិត) ៖ sweep លើទិដ្ឋភាពចាស់ ➜ `closedAt` = T0 · គ្មានថ្ងៃថ្មីក្នុង collected · បិទផ្ទាល់ ➜ T0 ·
  កញ្ចប់លាយ (A បិទ T0 · B បើក) · ទិសផ្ទុយ ៖ បើក ➜ stamp ពេលនេះ · បើកវិញ ➜ លុប stamp។ មុនកែ FAIL ៣/៥ · mutation ៖ stamp barcode ជានិច្ច ➜ FAIL ៣ · stamp កញ្ចប់ជានិច្ច ➜ FAIL ២។
- `ZoeW/tests/backend-switch-detach.test.ts` (ថ្មី · ៣ · `initFirebase` ពិត) ៖ Firebase ➜ Supabase និង Supabase ➜ Firebase ៖ ref ចាស់ ៩ ផ្តាច់ដោយ SDK ចាស់ · SDK ថ្មីមិនទទួល ref ចាស់ ·
  ទិសផ្ទុយ ៖ Firebase ➜ Firebase ។ មុនកែ FAIL ២/៣។

### [2.50.16] — 2026-10-08 · ZoeW ៖ **ហាង Supabase ៖ claim barcode ក្រោយចម្លើយបាត់ · ចម្លើយ zoe_write ខូច · ចាកចេញពាក់កណ្តាលការទាញ · ប្តូរហាងក្នុងសម័យ** (Deep audit ២ · ជុំ ៣ · SUPABASE-2 · 5 · 4 · 3)

**ZoeW `2.50.16`** (`zoew-v278` ➜ `zoew-v279`) · ⛔ ZoeKeyGen · Firebase rules · migration Supabase · តំបន់ ZTO ចាក់សោ មិនប្រែ · ផ្លូវ Firebase មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- 🧾 **SUPABASE-2 ៖ claim barcode ក្រោយចម្លើយបាត់ ➜ key កំព្រា** ៖ `claimBarcodeInRegistry()` ត្រឡប់ `unknown` លើ `txOutcome: 'applied'` (registry សរសេរ `true` ថេរ ➜ លើ Firebase ការអាន REST
  មិនអាចបញ្ជាក់ថាជារបស់យើង)។ លើ Supabase adapter ផ្ញើ `op_id` ដដែលរហូតបានចម្លើយច្បាស់ ➜ `ok` = CAS **របស់យើង** អនុវត្តតែម្តង (replay ឬអនុវត្តលើកនេះ) — តែលទ្ធផលនៅតែ `unknown` ➜
  ស្កេនត្រូវបដិសេធ ហើយ key `true` នៅ server គ្មានម្ចាស់ ➜ barcode នោះ «ស្ទួន» រហូត (ការដោះ key កំព្រាជាការងារដោយដៃ)។ ឥឡូវ adapter ភ្ជាប់ `txProven: true` លើ commit ក្រោយចម្លើយបាត់ ➜
  registry ៖ `applied` + `txProven` ➜ `claimed` · `applied` គ្មានភស្តុតាង (Firebase) ➜ `unknown` ដដែល។
- 📡 **SUPABASE-5 ៖ `zoe_write` ឆ្លើយ 2xx តែ body ទទេ · កាត់ · ឬអានមិនចប់** ៖ transport ត្រឡប់ `null` (body ទទេ) ឬ `bad_response` (JSON កាត់) ឬ `TypeError` (stream ដាច់) ➜ adapter
  ចាត់ជាការបដិសេធចុងក្រោយ (`res.replayed` លើ `null` ➜ TypeError · «bad transaction response») ខណៈ server commit រួច ➜ ការសរសេរ «បរាជ័យ» (rollback · toast · ledger verdict `null`)។
  ឥឡូវ ៖ body អានមិនបាន = `SbNetworkError` (transport · គ្រប់ការហៅ) · `zoe_write` 2xx ទទេ/មិនមែន JSON = `SbNetworkError` (adapter `rpc()`) ➜ `op_id` ដដែលផ្ញើម្តងទៀត ➜ server dedupe ➜ អនុវត្តតែម្តង។
  ការហៅផ្សេង (`zoe_pull` · គណនី) រក្សា `bad_response` · ការបដិសេធ PostgREST ពិត (4xx · 500) នៅតែចុងក្រោយ។
- 🚪 **SUPABASE-4 ៖ ចាកចេញពាក់កណ្តាលការទាញច្រើនទំព័រ** ៖ `resetForSignOut()` មិនបានលុប `pullStage` ➜ ចូលវិញជាមួយ docs cache ត្រឹមត្រូវ (cursor = head) ➜ ការទាញ delta ដំបូងសរសេរចូល stage ចាស់ ➜
  swap ➜ ទិដ្ឋភាព = ទំព័រដែលបានអានមុនចាកចេញ (២/៩ កញ្ចប់) · ពណ៌បៃតង · cache រក្សាទុក ២។ ឥឡូវ `resetForSignOut()` លុប stage។
- 🏪 **SUPABASE-3 ៖ គណនីប្តូរហាងក្នុងសម័យ** ៖ adapter ពិនិត្យ `tenant` តែទំព័រដំបូងក្រោយ cache ➜ ពេល `tenant_members` ត្រូវប្តូរទៅហាងផ្សេង (ដោយដៃ) ការទាញបន្ទាប់ជា delta លើ cursor ចាស់ ➜
  ទិដ្ឋភាពលាយហាង A + B · cache ហាង B មានទិន្នន័យហាង A។ ឥឡូវ ការទាញដែលឆ្លើយ `tenant` ផ្សេងពី session ➜ លុបទិដ្ឋភាព · stage · cursor ហើយទាញពី ០ (ព្រំដែន `SB_PULL_MAX_RESTARTS`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។ គ្មាន rules · env · migration ថ្មី (មុខងារ SQL មិនប្រែ)។
2. ហាង Supabase ៖ ស្កេន barcode ហើយបិទទិន្នន័យទូរស័ព្ទមួយភ្លែតចំពេល ⏳ ➜ បើកវិញ ➜ barcode ត្រូវរក្សាទុក (មិនមែន «ស្ទួន» ឬ «មិនអាចផ្ទៀងផ្ទាត់»)។
3. ហាង Supabase ៖ ចាកចេញ ➜ ចូលវិញ ➜ ចំនួនកញ្ចប់ស្មើឧបករណ៍ផ្សេង។

#### អ្នកយាម

- `ZoeW/tests/registry-claim-proven.test.ts` (ថ្មី · ៤ · adapter ពិត + wrapper `withTransactionOutcomeResolution` ពិត + `claimBarcodeInRegistry` ពិត) ៖ ចម្លើយបាត់ក្រោយ commit ➜ `claimed` · ទិសផ្ទុយ ៖
  សំណើបាត់ + ឧបករណ៍ផ្សេង claim ➜ មិន `claimed` · ធម្មតា/`taken` · `applied` គ្មានភស្តុតាង ➜ `unknown`។ មុនកែ FAIL ១/៤ · mutation ៖ adapter គ្មាន `txProven` ➜ FAIL ១ · registry ទទួល `applied` ទាំងអស់ ➜ FAIL ១។
  `emu/supabase-adapter-parity` (Postgres ពិត) ៖ transaction ចម្លើយបាត់ ➜ `txProven === true`។
- `ZoeW/tests/supabase-write-bad-body.test.ts` (ថ្មី · ៩ · transport ពិត + adapter ពិត) ៖ body ទទេ · JSON កាត់ · stream ដាច់ ក្រោយ commit ➜ `set` resolve · transaction `applied` · server សរសេរ ១ ·
  transport stream ➜ `SbNetworkError` · ទិសផ្ទុយ ៖ JSON កាត់លើការហៅផ្សេង = `bad_response` · PostgREST 400 ➜ ចុងក្រោយ ១ ដង។ មុនកែ FAIL ៧/៩ · mutation (៣ ផ្នែក) ➜ FAIL ២ · ២ · ៣។
- `ZoeW/tests/supabase-signout-stage.test.ts` (ថ្មី · ២) ៖ ចាកចេញពាក់កណ្តាលទំព័រ ២ ➜ ចូលវិញ ➜ ៩/៩ · cache ៩ · ទិសផ្ទុយ ៖ គ្មានចាកចេញ ➜ បន្ត stage ➜ ៩។ មុនកែ FAIL ១ (២/៩)។
- `ZoeW/tests/supabase-tenant-switch.test.ts` (ថ្មី · ២) ៖ ហាង A ➜ B ➜ ទិដ្ឋភាព B តែប៉ុណ្ណោះ (៨) · cache B មានតែ B · ទិសផ្ទុយ ៖ ហាងដដែល ➜ delta (`p_since` = cursor)។ មុនកែ FAIL ១ (A + B)។

### [2.50.15] — 2026-10-08 · ZoeW ៖ **ការសម្អាតស្វ័យប្រវត្តិច្រើនជាង ២០០ កញ្ចប់ក្នុងពេលតែមួយ មិនបាត់កញ្ចប់ពេល App ត្រូវបិទពាក់កណ្តាល** (Deep audit ២ · ជុំ ២ · SCALE-1)

**ZoeW `2.50.15`** (`zoew-v277` ➜ `zoew-v278`) · ⛔ ZoeKeyGen · Firebase rules · migration Supabase · តំបន់ ZTO ចាក់សោ មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- 🧹 **SCALE-1 ៖ journal សម្អាតទម្លាក់ entry ដែលមិនទាន់ចប់** ៖ `writeCleanupJournal()` កាត់បញ្ជីត្រឹម `CLEANUP_JOURNAL_MAX` (២០០) ដោយ `slice(-200)` ➜ ពេលកញ្ចប់ដល់ពេលសម្អាតលើស ២០០
  ក្នុងជុំតែមួយ (បើក App ក្រោយឈប់យូរ · បណ្តាញយឺត) entry ចាស់បំផុតត្រូវទម្លាក់ ខណៈការសម្អាតរបស់វាកំពុងរត់ (ប្រវត្តិ claim រួច · ធុងសំរាមមិនទាន់ commit) ➜ App ត្រូវបិទ
  (WebView ត្រូវសម្លាប់) ចន្លោះនោះ ➜ កញ្ចប់បាត់ពីប្រវត្តិ ដោយគ្មានធុងសំរាម · គ្មាន journal ដើម្បីបញ្ចប់ · កញ្ចប់ផុតកំណត់មិនត្រូវដកចំណូល។ ឥឡូវ ៖ `claimAndCleanupItem()`
  ចាប់ផ្តើមតែពេល `cleanupInFlight` + entry ក្នុង journal < `CLEANUP_JOURNAL_MAX` (កញ្ចប់ដែលនៅសល់រង់ចាំជុំបន្ទាប់ ៦០ វិ.) ហើយ `writeCleanupJournal()` មិនដែលទម្លាក់ entry
  (tab ផ្សេងអាចបន្ថែម entry របស់វា)។ journal ដែលពេញដោយ entry មិនទាន់ចប់ ➜ ការសម្អាតថ្មីរង់ចាំ រហូត `resumeInterruptedCleanups()` បញ្ចប់វា (ទិសសុវត្ថិភាព ៖ លុយមិនប៉ះ)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។ គ្មាន rules · env · migration ថ្មី។
2. គ្មានការសាកពិសេស ៖ ករណីនេះត្រូវការកញ្ចប់ដល់ពេលសម្អាតលើស ២០០ ក្នុងពេលតែមួយ។ សាកធម្មតា ៖ កញ្ចប់ផុតកំណត់/យករួចចូលធុងសំរាមដូចដើម · 💵 ដកតែម្តង។

#### អ្នកយាម

- `ZoeW/tests/cleanup-journal-cap.test.ts` (ថ្មី · ៥ · module ពិត `runAutomaticCleanupRules` · `claimAndCleanupItem` · `resumeInterruptedCleanups` + Firebase ក្លែងដែលការសរសេរធុងសំរាមព្យួរ) ៖
  (១) ២៦០ កញ្ចប់ ➜ គ្រប់កញ្ចប់ដែល claim ពីប្រវត្តិមាន entry ក្នុង journal · (២) សម្លាប់ ➜ បើកវិញ ➜ resume + ជុំបន្ទាប់ ➜ ២៦០ ក្នុងធុងសំរាម · ledger ដក ២៦០ ម្តង · (៣) ទិសផ្ទុយ ៖ ក្រោមពិដាន
  ជុំមួយសម្អាតគ្រប់កញ្ចប់ · (៤) សរសេរ journal លើសពិដានមិនទម្លាក់ · (៥) journal ពេញ ➜ មិន claim រហូតវាទទេ។ កូដមុនកែ ៖ FAIL ៤/៥ (បាត់ ៦០ · ធុងសំរាម ២០០/២៦០)។
  mutation ៖ ដក gate ➜ FAIL ២ (១ · ៥) · ដាក់ `slice` វិញ ➜ FAIL ១ (៤)។

### [2.50.14] — 2026-10-08 · ZoeW ៖ **កញ្ចប់ដែលឧបករណ៍ផ្សេងដក ឬលុបរួច មិនត្រឡប់ចូលប្រវត្តិវិញ ពេលស្កេន ឬបញ្ចូលបញ្ជី ZTO របស់អតិថិជនដដែល (ដកលុយពីរដង)** (Deep audit ២ · ជុំ ១)

**ZoeW `2.50.14`** (`zoew-v276` ➜ `zoew-v277`) · រួមបញ្ចូល branch `ccr-85f562ee-106o6w` (PR #296 · [2.50.5] ➜ [2.50.13] ខាងក្រោម) តាមសំណើម្ចាស់គម្រោង «ចាំ PR296 ចប់ ➜ ពិនិត្យ ➜ ទាញចូល branch ➜ កែអ្វីដែល agent រកឃើញ ដើម្បីកុំឲ្យ conflict»។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase · តំបន់ ZTO ចាក់សោ **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- 🗣️ **សំណើ** ៖ deep audit ទូទាំង project (workflow ៖ អ្នករក ១១ ➜ ផ្ទៀងផ្ទាត់ ៣ lens · ម្ចាស់គម្រោងអនុញ្ញាតក្នុង session — agent អាន/វាស់ · Claude កែ/commit) ·
  ម្ចាស់គម្រោង ៖ «ចាប់ផ្តើមកែឥឡូវ · workflow រត់បន្ត» ➜ PR ថ្មីពី `main` · កែ findings កម្រិត high ដែលអ្នករកវាស់ដោយរត់កូដពិត មុន verify ចប់ (Claude ផ្ទៀងផ្ទាត់ខ្លួនឯងមុនកែ ៖
  រកអ្នកយាមដែលមានស្រាប់ · តេស្តក្រហមលើកូដមុនកែ) · កូដកែក្នុង worktree ដាច់ដោយឡែក ដើម្បីឲ្យ workflow នៅតែអាន repo ដើម។
- 🧾 **RACES-1 = MONEY-2 ៖ merge ចូលកញ្ចប់ដែល server លែងមាន** ៖ `mergeBarcodeIntoHistoryItem()` ពេល transaction ឃើញ `null` សរសេរ `fallbackItem` = កញ្ចប់ local
  ទាំងមូល (barcode ចាស់ + ថ្មី)។ `null` មិនមែនតែ cache ត្រជាក់ទេ ៖ SDK រត់ updater ឡើងវិញដោយតម្លៃ server ពេល hash មិនត្រូវ — ឧបករណ៍ B ដក barcode ចុងក្រោយ
  (ធុងសំរាម `isDeducted: true` · ledger ដករួច) ឬលុបកញ្ចប់ ខណៈ A នៅឃើញវា (listener មិនទាន់មកដល់ · zombie socket) ➜ A ស្កេនកញ្ចប់ថ្មីរបស់អតិថិជនដដែល ➜ server បានកញ្ចប់ចាស់
  ត្រឡប់ (barcode ចាស់បើក · `isDeducted: false`) + ថ្មី ➜ barcode ចាស់នៅទាំងប្រវត្តិ និងធុងសំរាម ➜ «ចំណូល (យករួច)» រាប់វាពីរ · ដក/ផុតកំណត់ ៧ ថ្ងៃម្តងទៀត ➜ **ដកលុយពីរដង** ·
  ស្តារច្បាប់ចម្លងណាមួយ ➜ បូកវិញពីរ។ ទ្វារដដែលតាមខ្សែបញ្ចូលបញ្ជី ZTO (`importZtoListRows()` ➜ `addOrUpdateEntry()`)។ ឥឡូវ `freshHistoryItemFrom()` ៖ server `null` ➜
  សរសេរ**កញ្ចប់ថ្មី** (`id` · `phone` + barcode ដែលទើប merge · `createdAt` = របស់ barcode នោះ — រូបរាងដូចផ្លូវកញ្ចប់ថ្មី) មិនដែលសរសេរកញ្ចប់ local ចាស់ · cache ត្រជាក់ (server មាន
  កញ្ចប់) ➜ សំណើដំបូងជាកញ្ចប់ថ្មីដដែល ហើយ SDK រត់ឡើងវិញដោយតម្លៃ server ➜ merge ធម្មតា · Supabase adapter (`base = res.value ?? null`) ជាទ្វារដដែល។
  ទិដ្ឋភាព local ជាសះស្បើយដោយ SDK ខ្លួនឯង (hash មិនត្រូវ ➜ cache ទទួលតម្លៃ server ➜ listener · commit ➜ listener)។
- 🧹 **MONEY-1 ៖ ការសម្អាតស្វ័យប្រវត្តិដែលបាត់ចម្លើយ (Supabase ៖ កញ្ចប់បាត់)** ៖ `claimAndCleanupItem()` ពេល transaction claim ដោះស្រាយជា `applied` (ចម្លើយបាត់ · server
  មានតម្លៃដែលផ្ញើ = `null`) សម្រេចម្ចាស់ដោយអាន REST ធុងសំរាម (`cleanupClaimAccountedElsewhere()` ➜ `txRestUrl()`)។ លើ Supabase `ref.toString()` = `supabase:…` ➜ URL ទទេ ➜
  `'unknown'` **ជានិច្ច** ➜ `finishCleanup` ត្រឡប់មុន journal · ធុងសំរាម · ledger ➜ កញ្ចប់បាត់ពីប្រវត្តិ (claim ចុះរួច) ដោយគ្មានធុងសំរាម · គ្មានដកលុយ · គ្មាន journal · មានតែ Sentry
  «ownership unverified»។ លើ Firebase ដូចគ្នាពេលការអាន REST តែមួយដង (៨ វិ. · គ្មាន retry) ធ្លាក់។ ឥឡូវ ៖ claim ទាំងមូល + `applied` ➜ journal សិន ➜ ធុងសំរាមសរសេរដោយ
  transaction «បង្កើតបើគ្មាន» (`claimCleanupTrashSlot()`) ៖ commit = យើងជាម្ចាស់ ➜ ledger ដូចផ្លូវធម្មតា · abort (ឧបករណ៍ផ្សេងសរសេររួច) ➜ លុប journal · ដកច្បាប់ចម្លង local ·
  មិនប៉ះលុយ — ទ្វារដដែលលើ Firebase (REST) និង Supabase (CAS `op_id`) · claim ផ្នែក (`claimedPartial`) រក្សា heuristic ធុងសំរាមថ្មីៗដដែល · ផ្លូវធម្មតា (ចម្លើយមកដល់) មិនប្រែ។
  ការពិនិត្យរបស់ workflow (lens measure · refute · impact) ៖ journal ត្រូវកុំសរសេរជា `moved` មុនដឹងម្ចាស់ ➜ App ងាប់ចន្លោះ journal និង slot ➜ resume ដកលុយ claim
  ដែលជារបស់ឧបករណ៍ផ្សេង (Firebase) ➜ ឥឡូវ journal stage `slot` ➜ resume `resolveCleanupSlot()` ៖ ធុងសំរាមមាន `deletedAt` របស់យើង ➜ របស់យើង · `deletedAt` ផ្សេង ➜ ឧបករណ៍ផ្សេង (មិនដក) ·
  គ្មាន ➜ កញ្ចប់ត្រឡប់ក្នុងប្រវត្តិ (id ឬ barcode ស្តារ · ទិដ្ឋភាពស្រស់) ➜ ឧបករណ៍ផ្សេង · បើមិនដូច្នេះ claim slot ➜ ដកម្តង។
- 💵 **MONEY-3 ៖ ទង់ធុងសំរាមដើរតាមលុយ** (ម្ចាស់គម្រោង ៖ «កែពេញ») ៖ ការសម្អាត ៧ ថ្ងៃ សរសេរធុងសំរាម `expired` ដោយ `isDeducted: true` **មុន** ការដក ledger ➜ App ងាប់ (ឬ ledger
  បដិសេធ) ចន្លោះនោះ ហើយឧបករណ៍ផ្សេងស្តារ ➜ `executeRestoreItem()` បូកលុយដែលមិនដែលដក (+COD ស្ងាត់) · resume ឃើញធុងសំរាមបាត់នៅ stage `ledger` ➜ លុប journal ស្ងាត់ ·
  stage `moved` ➜ សរសេរធុងសំរាមឡើងវិញ + ដក ទោះកញ្ចប់ត្រូវបានស្តាររួច (ច្បាប់ចម្លងស្ទួន)។ ឥឡូវ ៖ ធុងសំរាម `expired` សរសេរ `isDeducted: false` ➜ ledger ដកចុះពិត
  (`cleanupLedgerDeducted()`) ➜ journal stage `flip` ➜ `markCleanupTrashDeducted()` (transaction ៖ បើ `restoreClaim` រស់ ➜ រង់ចាំ) ➜ `true`។ ស្តារមុន flip ➜ មិនបូក (ត្រឹម ៖ មិនដែលដក) ·
  stage `flip` + ធុងសំរាមបាត់ ➜ barcode ត្រឡប់ក្នុងប្រវត្តិ (ទិដ្ឋភាពស្រស់តែប៉ុណ្ណោះ) = ស្តារដោយមិនបូក ➜ បូកការដកវិញ · មិនត្រឡប់ (purge) ➜ រក្សាការដក · stage `moved` + ធុងសំរាមបាត់ +
  barcode ត្រឡប់ ➜ មិនសរសេរ · មិនដក (journal ពីកំណែមុនដែលមាន `isDeducted: true` ➜ ដកតែប៉ុណ្ណោះ) · stage `ledger` + ធុងសំរាមបាត់ ➜ ⚠️ «មិនអាចផ្ទៀងផ្ទាត់» (មិនស្ងាត់)។
  `resumeInterruptedCleanups()` រត់រៀងរាល់ ៦០ វិ. ➜ stage `flip` ដោះស្រាយក្រោយ lease ស្តារ។ ចន្លោះតូចពេល flip (ស្តារក្នុងមួយភ្លែត) ➜ «ចំណូល (យករួច)» ខុស ≤ ១ វដ្ត។
  ⚠️ ទ្វារស្រដៀង (មិនកែក្នុងជុំនេះ · កត់) ៖ «ដក» ដោយដៃ (`removeSingleBarcode()`) ផ្ញើការដកមុនសរសេរធុងសំរាម តែគ្មាន journal ➜ App ងាប់ខណៈ ledger មិនទាន់ចុះ ➜ ដូចគ្នា (បង្អួចតូចជាង)។
- 🧾 `resumeCleanupJournalEntry()` កាន់ stage ក្នុងអថេរ local (`payload-schema` ចាត់ `entry` ជាកញ្ចប់ ➜ `entry.stage` មើលទៅដូចវាលធុងសំរាមដែល rules បដិសេធ) — ឥរិយាបថដដែល។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។ គ្មាន rules · env · migration ថ្មី។
2. សាក (ឧបករណ៍ ២ ហាងដដែល) ៖ B ដក barcode តែមួយរបស់កញ្ចប់អតិថិជន P (ថ្ងៃនេះ) ➜ ភ្លាមនោះ A (ដែលនៅឃើញកញ្ចប់នោះ · ឬបិទទិន្នន័យទូរស័ព្ទ A មួយភ្លែតមុនដក) ស្កេនកញ្ចប់ថ្មី C របស់ P ➜
   ប្រវត្តិ A និង B ៖ P មានតែ C · ធុងសំរាម ៖ barcode ដែលដក (ដករួច ១ ច្បាប់) · 💵 ចំណូលប្រចាំថ្ងៃ = (ចំណូលមុនដក) − barcode ចាស់ + C។
3. ហាង Supabase ៖ កញ្ចប់ដែលផុត ៧ ថ្ងៃ (ឬបិទ > ២ ម៉ោង) ➜ បិទទិន្នន័យទូរស័ព្ទមួយភ្លែតចំពេលវដ្ត ៦០ វិ. ➜ បើកវិញ ➜ កញ្ចប់ត្រូវនៅក្នុងធុងសំរាម (ផុតកំណត់/យករួច) · 💵 ចំណូលដកតែម្តង ·
   មិនបាត់ពីទាំង ២ កន្លែង។
4. ការសម្អាត ៧ ថ្ងៃ ៖ កញ្ចប់ផុតកំណត់ ➜ ធុងសំរាម «ផុតកំណត់» · 💵 ដកតែម្តង · ស្តារពីឧបករណ៍ផ្សេង ➜ បូកវិញតែម្តង (ដូចដើម)។

#### អ្នកយាម

- `ZoeW/tests/merge-into-deleted-item.test.ts` (ថ្មី · ៦ · module ពិត `addOrUpdateEntry` · `mergeBarcodeIntoHistoryItem` · `removeSingleBarcode` · `importZtoListRows` +
  Firebase ក្លែងដែលរត់ updater លើតម្លៃ server និងរត់ឡើងវិញពេល hash មិនត្រូវ) ៖ (១) server គ្មាន ➜ សរសេរតែ barcode ថ្មី · `createdAt` · គ្មាន locker ចាស់ · ledger ·
  ចំណូល(យករួច) · (២) ដកម្តងទៀត ➜ ធុងសំរាមដករួច ១ ច្បាប់ · ledger ត្រឹម · (៣) ទ្វារខ្សែបញ្ចូលបញ្ជី ZTO · (៤) ទិសផ្ទុយ server មាន ➜ merge ដូចដើម (locker · `createdAt` ចាស់នៅ) ·
  (៥) cache ត្រជាក់ ➜ សំណើ `null` = barcode ថ្មីតែមួយ · រត់ឡើងវិញ merge · (៦) cache ត្រជាក់ + server មាន barcode រួច ➜ ស្ទួន · ledger ត្រឡប់ ៖ tree មុនកែ **FAIL ៤/៦** ➜ ៦/៦ ·
  mutation ៖ shell ចម្លងកញ្ចប់ទាំងមូល ➜ FAIL ៤ · មិនធ្វើបច្ចុប្បន្នភាព `createdAt` ➜ FAIL ១ · ត្រឡប់ `return fallbackItem` ➜ FAIL ៤។
- `revenue-fuzz-test` ៖ `other:remove` ដក barcode ចុងក្រោយបាន (កញ្ចប់បាត់ពី server ខណៈទិដ្ឋភាព local នៅមាន — ដូច `removeSingleBarcode()` ពិត) ➜ fuzz ២/២ លើ tree ទាំងពីរ (op នេះមិនឈានដល់ merge ចូលកញ្ចប់បាត់ក្នុង ១២ លំដាប់ — អ្នកយាមពិតជា vitest · op ជាក់លាក់ «ស្កេនចូលកញ្ចប់ដែលឧបករណ៍ផ្សេងដកអស់» ស្នើជុំក្រោយ)។
- `ZoeW/tests/cleanup-applied-ownership.test.ts` (ថ្មី · ៦ · `claimAndCleanupItem` ពិត + Firebase ក្លែង (hook ឲ្យ claim ឆ្លើយ `{ committed, txOutcome: 'applied' }`) · ref រូបរាង Supabase/Firebase) ៖
  (១) Supabase abandon ➜ ធុងសំរាម `expired` · ledger ១០០ ➜ ៩០ · journal ០ · គ្មាន «ownership unverified» · គ្មាន fetch · (២) close ➜ `pickup` · លុយដដែល · (៣) ទិសផ្ទុយ ៖ ឧបករណ៍ផ្សេងមានធុងសំរាមរួច ➜ មិនសរសេរជាន់ · មិនដក ·
  គ្មានច្បាប់ចម្លង local ស្ទួន · (៤) Firebase REST ដាច់ ➜ ធុងសំរាម + ledger ដដែល · (៥) transaction ធុងសំរាម reject ១ ដង ➜ retry ➜ ម្តង · (៦) parity ចម្លើយធម្មតា ➜ `update` ដូចដើម ៖ tree មុនកែ **FAIL ៥/៦** ➜ ៦/៦ ·
  stage `slot` (ថ្មី ៥ ៖ App ងាប់មុន slot ➜ journal `slot` · resume ៖ ធុងសំរាមឧបករណ៍ផ្សេង ➜ មិនដក · slot របស់យើង ➜ ដកម្តង · គ្មាន ➜ claim + ដក · កញ្ចប់ត្រឡប់ក្នុងប្រវត្តិ/ទិដ្ឋភាពចាស់ ➜ មិនសរសេរ) ៖ មុនកែ FAIL ៤/១១ ➜ ១១/១១ ·
  mutation stage ៤ ក្រហមគ្រប់ (journal `moved` · ធុងសំរាមណាក៏ជារបស់យើង · គ្មានការពិនិត្យ id ប្រវត្តិ · គ្មានទ្វារទិដ្ឋភាព) ·
  mutation ៖ រំលង `applied` (ដូច money-guardian) ➜ FAIL ២ · slot ជាម្ចាស់ជានិច្ច ➜ FAIL ១ · មិនគោរព elsewhere ➜ FAIL ១ · `tx-outcome-test` ៩២ · `cleanup-interrupt-atomicity` ៦១ · `concurrent-scan` ២៣ · `money-reality-test` ៥៤ បៃតង។
- `ZoeW/tests/cleanup-deduct-order.test.ts` (ថ្មី · ១០ · `claimAndCleanupItem` · `executeRestoreItem` · `resumeCleanupJournalEntry` ពិត · Firebase ក្លែងមាន hook ព្យួរ/បដិសេធ ledger និងបញ្ចូល
  `restoreClaim` មុន flip) ៖ (១) ledger ព្យួរ ➜ ធុងសំរាម `false` ➜ ស្តារ ➜ ១០០ · resume `unverified` · (២) ទិសផ្ទុយ ផ្លូវធម្មតា ➜ `true` · ៩០ · ស្តារ ➜ ១០០ · (៣) ledger បដិសេធ ➜ ស្តារ ➜ ១០០ ·
  (៤) flip ជួប claim ➜ stage `flip` ➜ ស្តារមិនបូក ➜ resume បូកវិញ ➜ ១០០ · (៥) claim ដោះ ➜ flip · (៦) purge ➜ រក្សាការដក · ទិដ្ឋភាពចាស់ ➜ រង់ចាំ · (៧) `moved` + ស្តាររួច ➜ មិនសរសេរ · (៨) ទិសផ្ទុយ ➜
  សរសេរ + ដក + flip · (៩) journal កំណែមុន ➜ ដកតែប៉ុណ្ណោះ · (១០) partial ៖ tree មុនកែ **FAIL ៨/១០** ➜ ១០/១០ · mutation ៥ ៖ ទង់មុនលុយ ➜ FAIL ៣ · គ្មានការបូកវិញ ➜ ១ · គ្មានទ្វារទិដ្ឋភាព ➜ ១ ·
  `moved` មិនស្គាល់ការស្តារ ➜ ២ · flip មិនអើពើ claim ➜ ៣ · `cleanup-applied-ownership.test.ts` រាប់តែ transaction claim slot (`prior === null`) + អះអាង `true` ចុងក្រោយ · checker ១២ ស្រង់ helper ថ្មី ៦ + `CLEANUP_STAGE_FLIP` (sandbox ស្រង់តាមឈ្មោះ ➜ ខ្វះ = ReferenceError) · `cleanup-interrupt-atomicity-test` ៖ fake `runTransaction` គំរូផ្លូវធុងសំរាម (មុន ៖ `cur = null` ➜ flip មើលឃើញ «បាត់») + ថេរ `DB_LISTENER_KEY_*` ➜ ៦១/៦១ (ចំណុចរំខានថ្មី ៖ ក្រោយ flip) · `emu/crud-rules-flow` ១២២ (STRICT) · `emu/restore-mutation` ១៨២ · `late-commit` ៦៧ · `partial-pickup-cleanup` ៥២ · `stall-lock-release` ៣០ · `db-stall-guard` ៣១ · `ledger-count-integrity` ១២ · `ledger-failed-apply-revert` ៥០ · `restore-marker-hygiene` ២៧ · `tx-outcome` ៩២ · `zto-sync-banner` ១៩៨ · `trash-modal` ៨៦ · `clock-hygiene` ២២ · `payload-schema` ✓ · `policy-test` ៖ tail ការសម្អាតអនុវត្តបន្ទាត់ flip ដែលស្រង់ពីកូដពិតក្រោយការដក (CI ក្នុង session ចាប់ ៖ `isDeducted` `[false,false]` · ស្តារមិនបូក)។
- `concurrent-scan-test` ៖ ស្រង់ helper ថ្មី ២ · `tx-outcome-test` ស្រង់ `claimCleanupTrashSlot` · `repository-file-coverage.json` mapping ៣ · `money-core.js` បង្កើតឡើងវិញ។

### [2.50.13] — 2026-10-08 · ZoeW ៖ keyboard រំកិលពីលើទំព័រ (APK Android 11+)

**ZoeW `2.50.13`** (`zoew-v275` ➜ `zoew-v276`)។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase · Function · តំបន់ ZTO ចាក់សោ · `app.css` **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- វីដេអូ + រូប (APK 2.50.12 · Xiaomi) ៖ ពណ៌ចន្លោះលែងស ប៉ុន្តែ **ចន្លោះទទេនៅតែមាន** ចន្លោះបាតកាតនិង keyboard ~០,៣ វិ. (ស៊ុម ៧២ ➜ ១០៣ ៖ WebView រួញទៅកម្ពស់ចុងក្រោយក្នុង ១ ស៊ុម · keyboard រំកិលពីជួរ ២១១ ទៅ ១៥២ (/២៤០) ក្នុង ~២៥ ស៊ុម)។ មូលហេតុ ៖ `SystemBars` (Capacitor) ដាក់ padding បាតរបស់ decor = កម្ពស់ IME **ចុងក្រោយ** ពេល listener insets ទទួល (ដើមចលនា)។
- ឥឡូវ (Android 11+) ៖ `MainActivity.KeyboardOpenHold` (`WindowInsetsAnimation.Callback` platform លើ decor) ៖ `onPrepare` នៃចលនា IME ដែលកំពុងបើក ➜ កំណត់កម្ពស់ WebView = កម្ពស់បច្ចុប្បន្ន (px) · ដក `clipChildren` របស់ parent និង `clipToPadding` របស់ decor ➜ padding មិនរួញ WebView ➜ keyboard រំកិលពីលើទំព័រ (ដូច iPhone) · `onEnd` (ឬ `KEYBOARD_HOLD_MAX_MS` ១ វិ.) ➜ `MATCH_PARENT` + clip ដើម ➜ WebView រួញម្តងនៅចុងចលនា (ផ្នែកដែលបាត់នៅក្រោម keyboard រួចហើយ) ➜ JS `noteKeyboardViewport()` លាក់របាដូចមុន។ បិទ keyboard ៖ padding = 0 ដើមចលនា ➜ WebView ពង្រីកភ្លាម keyboard រំកិលចុះពីលើទំព័រ (មិនប្តូរ)។ ⛔ មិនប្រើ `ViewCompat.setWindowInsetsAnimationCallback` (Android < 11 compat ជំនួស `OnApplyWindowInsetsListener` របស់ Capacitor លើ decor ➜ safe area/IME ខូច) ➜ Android 7–10 ៖ មិនប្រែ (ចន្លោះពណ៌ផ្ទៃ App)។
- compile ពិនិត្យ `MainActivity.java` ជាមួយ `android.jar` API 35 ពិត (stub តែ `BridgeActivity`/`Bridge`/annotation) ➜ គ្មាន error · ⚠️ ឥរិយាបថពិតវាស់បានតែលើទូរស័ព្ទ (គ្មាន emulator Android ក្នុងម៉ាស៊ីននេះ)។

#### អ្នកយាម

`android:check` (+៤ ៖ onCreate ចុះឈ្មោះ · តែ Android 11+ / platform API · `onPrepare` តែ IME កំពុងបើក + កម្ពស់ពិត + ដក clip + timeout · `onEnd`/timeout ត្រឡប់ `MATCH_PARENT` + clip ដើម) — ៩៩ ok។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. APK ៖ Run workflow លើ `ccr-85f562ee-106o6w` ➜ Pre-release `zoew-android-v2.50.13-test.<commit>` ➜ ប៉ះប្រអប់ស្វែងរកលេខ ➜ keyboard រំកិលឡើងគ្របបញ្ជី · **គ្មានចន្លោះទទេ** ចន្លោះកាតនិង keyboard · បិទ keyboard ➜ បញ្ជីពេញវិញ · Config/PIN ៖ វាលវាយអក្សរនៅមើលឃើញពេល keyboard ឡើង · បង្វិលអេក្រង់ពេល keyboard បើក ➜ App មិនខូច។
2. ដូច [2.50.11] (PWA ក្រោយ merge)។ គ្មាន Firebase rules · គ្មាន env ថ្មី។

### [2.50.12] — 2026-10-08 · ZoeW ៖ ផ្ទៃក្រោម WebView ពេល keyboard ឡើង · ការរកឃើញពីការពិនិត្យ [2.50.11]

**ZoeW `2.50.12`** (`zoew-v274` ➜ `zoew-v275`)។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase · Function · តំបន់ ZTO ចាក់សោ · `app.css` **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- **«ទុក space ស មួយភ្លែត» (វីដេអូម្ចាស់គម្រោង · APK 2.50.11)** ៖ របាលែងលោតហើយ តែពេល keyboard ចាប់ផ្តើមបើក ផ្ទៃខាងក្រោម WebView ពណ៌ `#fafafa` ឯកសណ្ឋាន ~៦ ស៊ុម (~៦០ms) រហូត keyboard (`#eff2f9`) រំកិលមកគ្រប។ វាស់ពណ៌ ៖ មិនមែន keyboard មិនមែន App — ជា **ផ្ទៃ window** ៖ `SystemBars` របស់ Capacitor ដាក់ padding បាតរបស់ decor view = កម្ពស់ IME ពេញភ្លាមពេលចលនាចាប់ផ្តើម ➜ ផ្ទៃ padding បង្ហាញ `windowBackground` របស់ theme `DayNight` (ភ្លឺ `#fafafa` · ងងឹត ខ្មៅ ដូចវីដេអូលើកទី ១)។ ឥឡូវ theme `AppTheme.NoActionBar` (theme របស់ `BridgeActivity`) ៖ `android:windowBackground` = `@color/splash_background` (`#f8fafc` = `--body-bg`) ➜ ផ្ទៃនោះមានពណ៌ផ្ទៃ App · `android:check` ផ្ទៀងតម្លៃពី `app.css`។ ការធ្វើឲ្យ WebView ប្តូរទំហំតាមចលនា keyboard (native `WindowInsetsAnimation`) ត្រូវជំនួស listener របស់ Capacitor ➜ មិនធ្វើ (ហានិភ័យខ្ពស់ គ្មានឧបករណ៍វាស់)។
- **ពិនិត្យ adversarial [2.50.11] (agent ៣)** ៖ (១) keyboard ៖ កម្ពស់គោលកើនតែឡើង + `keyboardOpen ||` ➜ បំបែកអេក្រង់ ➜ keyboard បើក/បិទ ➜ របា **ជាប់លាក់** (គ្មានផ្លូវទៅទំព័រស្កេន) · Back បិទ keyboard (focus នៅ) ➜ បំបែកអេក្រង់ ➜ ច្រឡំថា keyboard ➜ ឥឡូវ គោល = កម្ពស់ចុងក្រោយមុន keyboard (resize ផ្សេង re-base) · តម្រូវ `focusin`/`pointerdown` លើវាលវាយអក្សរក្នុង `KEYBOARD_INTENT_MS` (១,៥ វិ.) · បិទពេលត្រឡប់ជិតគោល ឬកើន ≥ inset ពីកម្ពស់ទាបបំផុត។ (២) ម៉ឺនុយ (…) ៖ pointerdown **ក្នុងម៉ឺនុយ** រាប់ជា input ថ្មី ➜ momentum បិទម៉ឺនុយកណ្តាលការចុច ➜ ធាតុមិនដំណើរការ (Chromium ៖ click ធ្លាក់លើជួរខាងក្រោម) ➜ ឥឡូវ input ក្នុងម៉ឺនុយ/លើប៊ូតុងមិនរាប់។ (៣) trackpad ៖ `wheel` inertia រាប់ជា input ថ្មី ➜ ឥឡូវរាប់តែ stream ដែលចាប់ផ្តើមក្រោយគម្លាត `MORE_MENU_WHEEL_GAP_MS` (១៥០ms)។ (៤) `state-hygiene` ៖ `keyboardOpen` មានហេតុផល (ស្ថានភាពឧបករណ៍)។ modal ៣ ៖ គ្មានការរកឃើញ។

#### អ្នកយាម

`tests/keyboard-tabbar.test.tsx` (+៣ ៖ បំបែកអេក្រង់ · ចូលបំបែកពេល keyboard បើក · Back រក្សា focus) · `tests/more-menu-scroll.test.ts` (+២ ៖ ចុចក្នុងម៉ឺនុយ · wheel inertia) · `history-menu-dismiss-test` ៖ ចុចធាតុ 💱 ខណៈ momentum នៅបន្ត ➜ ប្រអប់អត្រាប្រាក់បើក — លើ `layers.ts` [2.50.11] **ក្រហម** (៦៣/៦៤) · ក្រោយកែ ៦៤/៦៤ · `android:check` ៖ `windowBackground` = `--body-bg`។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. APK ៖ Run workflow លើ `ccr-85f562ee-106o6w` ➜ Pre-release `zoew-android-v2.50.12-test.<commit>` ➜ ប៉ះប្រអប់ស្វែងរកលេខ ➜ ផ្ទៃខាងក្រោមមុន keyboard ឡើងមកដល់ពណ៌ដូចផ្ទៃ App · ទូរស័ព្ទរបៀបងងឹត (Dark) ដូចគ្នា។
2. ដូច [2.50.11] (PWA ក្រោយ merge)។ គ្មាន Firebase rules · គ្មាន env ថ្មី។

### [2.50.11] — 2026-10-08 · ZoeW ៖ របា Tab ពេល keyboard (APK) · ម៉ឺនុយ (…) ពេលរមូរ · modal ៣ មិនបិទពេលប៉ះផ្ទៃងងឹត

**ZoeW `2.50.11`** (`zoew-v273` ➜ `zoew-v274`)។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase · Function · តំបន់ ZTO ចាក់សោ · `app.css` **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- **របា Tab ពេល keyboard (APK · វីដេអូ Xiaomi 14 Ultra)** ៖ វិភាគស៊ុមម្តងៗ (~៩០fps) ៖ ពេល keyboard ចាប់ផ្តើមបើក WebView រួញទៅកម្ពស់ចុងក្រោយក្នុង **១ ស៊ុម** (ផ្ទៃខ្មៅខាងក្រោម) ➜ របា (`position: fixed`) លោតឡើងភ្លាម (ប៊ូតុង «ទិន្នន័យ» ពីជួរ ~២២២០ ទៅ ~១៣៧០ px) ខណៈ keyboard ទើបរំកិលឡើងពីក្រោមក្នុង ~៦ ស៊ុម · ពេលបិទ WebView ពង្រីកវិញមុន ហើយ keyboard រលាយពីលើ។ មូលហេតុ ៖ Android/Capacitor ប្តូរទំហំ WebView តាម inset ចុងក្រោយរបស់ IME (មិនមែនតាមចលនា) — មិនមែនកំហុសរបស់ Xiaomi ទេ ហើយ web ធ្វើតាមចលនា keyboard មិនបាន។ ឥឡូវ ៖ `resize` ដែលកម្ពស់ថយ ≥ `KEYBOARD_MIN_INSET_PX` (១២០) ពេលវាលវាយអក្សរមាន focus ➜ `uiState.keyboardOpen` ➜ body `keyboard-open` + `chrome-hidden` **ក្នុង handler ដដែល** (មុនស៊ុមថ្មីត្រូវគូរ) ➜ របាលាក់ (គ្មាន transition) · resize ត្រឡប់ ➜ របារអិលឡើងវិញ · ស្ថានភាពលាក់តាមការរមូរមិនប៉ះ · PWA/iOS មិនប្រែ (keyboard គ្របពីលើ)។ `audit-compat` ៖ class `chrome-hidden` = `chromeHidden || keyboardOpen` (មុននេះ audit build បកប្រែ class ដែល keyboard ដាក់ទៅជា `chromeHidden = true` ➜ វាស់ឃើញរបានៅលាក់ក្រោយ keyboard បិទ — តែ audit build)។
- **ម៉ឺនុយ (…) ពេលរមូរ (PWA `main`)** ៖ listener `scroll` (capture) បិទម៉ឺនុយលើ `scroll` **ណាមួយ** ➜ momentum ដែលបន្តពីការអូសមុនចុច (…) បិទម៉ឺនុយភ្លាមក្រោយវាបើក។ ឥឡូវ `moreMenuScrollDismisses()` ៖ បិទតែពេលការរមូររំកិលប៊ូតុង (ធាតុដែលរមូរផ្ទុកប៊ូតុង · ប៊ូតុងបាត់ពី DOM) ឬមាន input (pointerdown · wheel · keydown) ក្រោយបើក · `closeGlobalMoreMenu()` លែងចងប៊ូតុង។ APK 2.50.10 ម្ចាស់គម្រោងសាក «អត់អីផង» ➜ ការសាកល្បង «ចុចជំនួសពេល browser បំបាត់ click» ត្រូវដកចេញ (មិនចាំបាច់)។
- **Modal ៣ (សំណើម្ចាស់គម្រោង ៖ «កុំអោយប៉ះកន្លែងទំនេរទៅវាបិទ»)** ៖ ⚙️ ភ្ជាប់ប្រព័ន្ធ · 🔌 API ស្វែងរកអតិថិជន · 📥 នាំចូល Excel ទៅ Sheet មិនបិទពេលប៉ះផ្ទៃងងឹត (`BACKDROP_KEEP_MODALS` ក្នុង `core/modals.ts` · `modalBackdropTarget()`) · ប៊ូតុងបិទ · Back (APK) · Escape នៅបិទ · modal ផ្សេងនៅបិទពេលប៉ះផ្ទៃងងឹតដដែល · DOM មិនប្រែ (parity)។

#### អ្នកយាម

`tests/keyboard-tabbar.test.tsx` (៥ ៖ class ក្នុង resize ដដែល · blur មុន resize · រួញតិច · គ្មាន focus · បង្វិល · ស្ថានភាពរមូរនៅដដែល · web) — មុនកែ **ក្រហម ៤/៥** · `history-window-check.mjs` ៖ ក្លែង keyboard ក្នុង browser ពិត (APK ៖ class + `visibility: hidden` + `transition: none` ក្នុង `resize` ដដែល · PWA Android/iPhone ៖ មិនប្រែ) · `tests/modal-backdrop-keep.test.tsx` (៥) — មុនកែ **ក្រហម ៣/៥** · `history-menu-dismiss-test` ៖ momentum ក្រោយបើក (header នៅបើក · ជួរ ⋮ បិទ · input ថ្មីបិទ) — មុនកែ **ក្រហម ១** (៦២/៦៣) · `tests/more-menu-scroll.test.ts` (៣ ៖ រួមប៊ូតុងបាត់ពី DOM · លែងចងក្រោយបិទ)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. APK ៖ Run workflow លើ `ccr-85f562ee-106o6w` ➜ Pre-release `zoew-android-v2.50.11-test.<commit>` ➜ ប៉ះប្រអប់ «ស្វែងរកលេខទូរស័ព្ទ» ➜ keyboard បើក ➜ របា Tab មិនលោតឡើងលើ keyboard · បិទ keyboard ➜ របាលេចវិញ · ប្រអប់ Config/API/Excel ៖ ប៉ះផ្ទៃងងឹតមិនបិទ · Back បិទ។
2. PWA ចេញពេល Deploy ZoeW (ក្រោយ merge) ➜ រមូរបញ្ជីខ្លាំងៗ ហើយចុច (…) ក្បាលប្រអប់ប្រវត្តិភ្លាម ➜ ម៉ឺនុយបើក។ គ្មាន Firebase rules · គ្មាន env ថ្មី។

### [2.50.10] — 2026-10-07 · ZoeW ៖ របា Tab ស្ងៀមពេលឈប់រមូរ (វីដេអូ APK «ញ៉ាក់» · «របា tap glitch»)

**ZoeW `2.50.10`** (`zoew-v272` ➜ `zoew-v273`)។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase · Function · តំបន់ ZTO ចាក់សោ · CSS **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- វីដេអូ ២ (Xiaomi · APK) វិភាគស៊ុមម្តងៗ (~៩០fps) ៖ ក្រោយលើកម្រាមដៃ បញ្ជីរំកិល **០px** តែរបា Tab លោតរវាងលេច/លាក់រៀងរាល់ ១–២ ស៊ុមរាប់វិនាទី (ទីតាំង 2216 ↔ 2396px) · បាតកាតលោតតាម (clip/padding) · scroll thumb លេច ➜ App ទទួល `scroll` ដោយគ្មានការរមូររបស់អ្នកប្រើ ហើយ `processScroll()` យល់ថាជាការរមូរ ➜ រង្វង់។ ប្រភព `scroll` ដោយកម្មវិធី ៖ ការកែទីតាំងរបស់បញ្ជីបង្ហាញតាមទីតាំងរមូរ (`applyScrollAdjustment` · `_retryClampedAdjustment` ពេល scroll range ប្តូរ) · padding បញ្ជីប្តូរ 62 ↔ 0px តាមរបា (`app.css` · ផ្លូវ Android) · clamp។ Chromium ក្លែងមិនបង្កើតរង្វង់ឡើងវិញ (WebView ពិតតែប៉ុណ្ណោះ)។
- ឥឡូវ របាប្តូរតែពេលអ្នកប្រើរមូរ ៖ រាប់ scroll តែពេលប៉ះ/អូស ឬក្រោយ touch/wheel/key/pointer ≤ `CHROME_SCROLL_INTENT_MS` (១,២ វិ. · momentum) · ក្រោយ input ចុងក្រោយ ប្តូរបាន **១ ដង** · មិនរាប់ `CHROME_FLIP_SETTLE_MS` (២៥០ms) ក្រោយរបាប្តូរ · រមូរដល់កំពូលនៅបង្ហាញរបា ➜ រង្វង់ណាមួយ (ប្រភពណាក៏ដោយ) ឈប់។
- `measureDisplayHz()` ដកចេញ (គ្មានអ្នកហៅក្រោយ [2.50.9] · `function-surface-test` ក្រហម) ➜ `sampleFramePace()` វាស់ Hz · `gesture-test` · `intentional-removals.mjs` · ថេរ `DISPLAY_HZ_SAMPLES` (២៤ ដូច ZoeW ដើម · `npm run parity`) ឥឡូវជាចំនួនស៊ុមរបស់ `sampleScrollHz()` (ជំនួស `SCROLL_HZ_SAMPLES` ២០)។

#### អ្នកយាម

`ZoeW/tests/chrome-autohide-intent.test.tsx` (៦) ៖ អូសចុះ/ឡើងនៅលាក់/លេច · scroll ដោយកម្មវិធីគ្មាន input ➜ មិនលាក់ · ក្លែងរង្វង់ឧបករណ៍ (ប្លង់ឆ្លើយតបការប្តូររបាដោយ scroll បញ្ច្រាស) ➜ ≤ ១ · momentum ១ ដង · ម្រាមដៃសង្កត់ស្ងៀម · ដល់កំពូល ➜ លេច — មុនកែ **ក្រហម ៤/៦**។ `gesture-test` ៖ helper រមូរដោយ `wheel` (input ពិត) និងរង់ចាំ settle ពិត (subscribe `uiState`) · ការអះអាងថ្មី «scroll ដោយកម្មវិធី ➜ មិនលាក់» — មុនកែ **ក្រហម ២** · ក្រោយកែ ១៣០/១៣០។ `modal-chrome-state.test.tsx` រមូរជាអ្នកប្រើ (`touchmove` + settle)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. APK ៖ Run workflow លើ `ccr-85f562ee-106o6w` ➜ Pre-release `zoew-android-v2.50.10-test.<commit>` ➜ «ទាំងអស់» ➜ បង្រួមផ្ទាំង ➜ រមូរឡើង/ចុះ រួចលើកម្រាមដៃ ➜ របា Tab និងបាតកាតស្ងៀម · រមូរចុះ ➜ លាក់ · រមូរឡើង ➜ លេច។
2. PWA ចេញពេល Deploy ZoeW (ក្រោយ merge)។ គ្មាន Firebase rules · គ្មាន env ថ្មី។

### [2.50.9] — 2026-10-07 · ZoeW ៖ ចង្វាក់ស៊ុមសម្រប ១០–១២០Hz ស្គាល់អេក្រង់ Hz ខ្ពស់ · អេក្រង់ LTPO មិនត្រូវចាត់ទុកថាយឺត (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.9`** (`zoew-v271` ➜ `zoew-v272`)។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase · Function · តំបន់ ZTO ចាក់សោ **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- ម្ចាស់គម្រោង ៖ «ពិនិត្យមើល adaptive refresh rate 10-120hz មើលដំណើរការទេ និងអោយវា វៃឆ្លាតស្គាល់ device ណាដែល refresh rate ខ្ពស់»។ ពិនិត្យដោយ rAF ក្លែងលើ `setupAdaptivePerformance()` ពិត ៖ អេក្រង់ ១២០ ថេរ · ៦០ ថេរ ✅ · **LTPO ៖ វាស់ Hz ពេល ១២០ (ក្រោយប៉ះ) ហើយវាស់ស៊ុមកកក្នុងបង្អួចបន្ទាប់ពេលអេក្រង់ចុះ ៦០ ➜ ស៊ុម ៦០Hz ធម្មតារាប់ជា «កក» ➜ `perf-lite` ខុស** (ដកស្រមោលកាត · បន្ទាត់ស្កេន) · **ឧបករណ៍យឺតពិត (៤៥% ស៊ុម ៥០ms) ➜ «អេក្រង់ 20Hz» ➜ មិនដែល `perf-lite`**។
- ឥឡូវ ៖ ជុំនីមួយៗវាស់ Hz និងស៊ុមកកក្នុងបង្អួចតែមួយ (`sampleFramePace()` ៖ ថវិកា = median របស់បង្អួចនោះ) · `sampleScrollHz()` វាស់ Hz ពេលអ្នកប្រើរមូរពិត (≤ ១ ដងក្នុង ៥ វិ. · ២០ ស៊ុម) ហើយរក្សា **អតិបរមា** ក្នុង `uiState.displayHzPeak` + `zoew_display_hz_peak_v1` (ស្គាល់តាំងពីបើក App លើកក្រោយ) · ឧបករណ៍ដែលរមូរបាន ≥ `HIGH_REFRESH_HZ` (៩០) ➜ មិន `perf-lite` ហើយ `perf-lite` ដែលដាក់រួចត្រូវដក។
- APK ៖ `MainActivity` នៅស្នើ mode Hz ខ្ពស់បំផុតដដែល (Android ស្គាល់អេក្រង់ ១២០Hz ពីខាង native) · ទំព័រវែបមិនអាចដំឡើង Hz អេក្រង់បាន ➜ App **វាស់** ហើយសម្របតាមវា។

#### អ្នកយាម

`ZoeW/tests/adaptive-refresh.test.ts` (៨) ៖ ១២០/៦០ ថេរ · LTPO ១២០ ➜ ៦០ ➜ មិន `perf-lite` · ឧបករណ៍យឺត ២ ជុំ ➜ `perf-lite` + Hz ៦០ · រវល់តែពេល boot ➜ មិន · រមូរ ➜ peak ១២០ ចងចាំ · ម្តងក្នុង ៥ វិ. · មិនធ្លាក់ · peak ចងចាំ ≥ ៩០ ➜ មិន `perf-lite` + ដកវា · តម្លៃខូច/storage បោះ · rAF បោះ។ លើ `perf.ts` មុនកែ ➜ **ក្រហម ៥/៨**។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. APK ៖ Run workflow លើ `ccr-85f562ee-106o6w` ➜ Pre-release `zoew-android-v2.50.9-test.<commit>` ➜ ដំឡើង។ ទូរស័ព្ទ ៩០/១២០Hz (Xiaomi) ៖ រមូរតារាងបន្តិច ➜ បិទ/បើក App ➜ ស្រមោលកាត និងបន្ទាត់ស្កេនមានចលនាដដែល (មិនចូលទម្រង់ស្រាល)។
2. PWA ចេញពេល Deploy ZoeW (ក្រោយ merge)។ គ្មាន Firebase rules · គ្មាន env ថ្មី។

### [2.50.8] — 2026-10-07 · ZoeW ៖ តារាងប្រវត្តិរលូនលើ Android ទាំង App និង PWA · ប្តូរតម្រងត្រឡប់កំពូល · ដក telemetry សាក (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.8`** (`zoew-v270` ➜ `zoew-v271`)។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase · Function · តំបន់ ZTO ចាក់សោ **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- ម្ចាស់គម្រោង ៖ APK 2.50.7 «ដើរស្រួលហើយ» ➜ «ដក telemetry sentry ចេញផង» ➜ ដក `src/ui/overlay-telemetry.ts` · ការហៅក្នុង `boot.ts` · `VITE_PERF_TELEMETRY` ក្នុង workflow APK · តេស្ត និងការអះអាងពាក់ព័ន្ធ ➜ APK សាក build web ដូច Release ផ្លូវការ។ ការរាយការណ៍កំហុស Sentry ធម្មតានៅដដែល។
- ម្ចាស់គម្រោង ៖ «optimize អោយ រត់បាន smooth គ្រប់ device ទាំងអស់អោយឆ្លាតវៃ» ➜ `historyRowsWindowed()` (អ្នកសម្រេចតែមួយ · `isAndroidDevice()` ៖ App Android ឬ `userAgentData.platform`/UA Android) ➜ **Android ទាំង App និង PWA/Chrome** បង្ហាញតែជួរជុំវិញទីតាំងរមូរ (ម៉ាស៊ីន Chromium ដូច APK ដែលម្ចាស់គម្រោងសាកថារលូន)។ iPhone និងកុំព្យូទ័របន្ថែមជួរដូចដើម ៖ iPhone មិនទាន់មានរបាយការណ៍អាក់ ហើយការរមូរ iOS ត្រូវសាកលើឧបករណ៍ពិត (តំបន់ហាមចូល) · កុំព្យូទ័រត្រូវការ Ctrl+F រកក្នុងតារាងទាំងមូល។
- ប្តូរតម្រង ឬស្វែងរក ➜ តារាងត្រឡប់ទៅកំពូលលើគ្រប់ឧបករណ៍។ ពីមុនលើ PWA ទីតាំងរមូរនៅជ្រៅ ➜ ទំព័រ ៥០ ជួរខ្លី ➜ សញ្ញាផ្ទុកបន្តលេចភ្លាម ➜ ផ្ទុកបន្ត ១៥០–២០០ ជួរ ហើយអ្នកប្រើនៅកណ្តាលបញ្ជី (ផ្ទុយពី README «ត្រឡប់ទៅ ៥០ ជួរដំបូង»)។
- `getItemKey` ៖ deps ច្បាស់ (`keySource`) ➜ lint គ្មាន warning exhaustive-deps (warning «incompatible-library» របស់ `useVirtualizer` ជាព័ត៌មាន · build មិនប្រើ React Compiler)។

#### អ្នកយាម

`history-window-check.mjs` (ក្នុង `npm run native:check`) ៖ ៣ ផ្លូវ (APK · PWA Android · PWA iPhone តាម UA ➜ `userAgentData.platform` ពិតរបស់ Chromium) · លោតទៅ ៣០/៦០/៩០% ➜ ជួរគ្របពេញផ្ទៃមើលឃើញ · ប្តូរតម្រងពេលរមូរជ្រៅ ➜ ៥០ ជួរនៅកំពូល · រមូរដល់ចុងដូចអ្នកប្រើ (រង់ចាំ React គូរទំព័រចុងក្រោយ)។ build មុនកែ `84665b2` ➜ ក្រហម ៣ ចំ (PWA Android DOM ៦០០ ជួរ · ប្តូរតម្រង Android/iPhone ផ្ទុក ២០០/១៥០ ជួរ ហើយមិននៅកំពូល) · tree ថ្មី ➜ ០។ `repository-contract-test` ៖ APK សាក និង Release build web ដូចគ្នា (គ្មាន flag តាម test)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. APK ៖ Run workflow លើ `ccr-85f562ee-106o6w` ➜ Pre-release `zoew-android-v2.50.8-test.<commit>` ➜ ដំឡើង ➜ សាកដូច [2.50.6] សកម្មភាព ២ (គួររលូនដូច 2.50.7)។
2. PWA ចេញពេល Deploy ZoeW (ក្រោយ merge) ➜ **Android (Chrome)** ៖ «ទាំងអស់» ➜ រមូរដល់ចុង ➜ បើក/បិទធុងសំរាម · បញ្ជី ZTO · ☰ · 🔔 ➜ រមូរឡើងវិញ · ប្តូរតម្រង/ស្វែងរក ➜ តារាងនៅកំពូល · **iPhone** ៖ ប្តូរតម្រងពេលរមូរជ្រៅ ➜ ត្រឡប់កំពូល · PTR និងចលនាផ្ទាំងដូចដើម។
3. Sentry issue `JAVASCRIPT-REACT-9` («Perf overlay …») លែងមាន event ថ្មី ➜ Resolve បាន។

### [2.50.7] — 2026-10-07 · ZoeW ៖ កែ class ជួរចន្លោះប្រវត្តិដែលធ្វើឲ្យ audit CI ធ្លាក់

**ZoeW `2.50.7`** (`zoew-v269` ➜ `zoew-v270`)។

#### អ្វីដែលខុសពីមុន

- ដក `history-virtual-spacer` ពីជួរចន្លោះរបស់តារាង។ Class នេះគ្មាន CSS rule និងគ្មានអ្នកប្រើ; កម្ពស់ ចន្លោះខាងក្នុង និង border សម្រេចដោយ React inline style រួចហើយ។ `css-classes` អាចផ្ទៀងផ្ទាត់តារាងដែលបង្ហាញជួរតាមទីតាំងរមូរបាន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Build APK ពី `ccr-85f562ee-106o6w` កំណែនេះ ហើយសាកតាម [2.50.6] សកម្មភាពដោយដៃ។ PR រក្សាជា draft រហូតសាកទូរស័ព្ទពិត និងដក telemetry សាករួច។
2. បើ Gradle ទាញ dependency បាន `403 Forbidden` ដូច run `37623632463` ➜ ពិនិត្យការចូល Maven Central ពី runner។ កំហុសនេះកើតមុន compile Android និងជាបញ្ហាដាច់ដោយឡែកពី class ខាងលើ។

### [2.50.6] — 2026-10-07 · ZoeW ៖ តារាងប្រវត្តិ APK បង្ហាញជួរតាមទីតាំងរមូរ (សំណើម្ចាស់គម្រោង · រង់ចាំសាកទូរស័ព្ទពិត)

**ZoeW `2.50.6`** (`zoew-v268` ➜ `zoew-v269`)។

#### អ្វីដែលខុសពីមុន

- តម្រង «ទាំងអស់» នៅផ្ទុក ៥០ជួរម្តងៗ និងរាប់ទិន្នន័យទាំងអស់។ លើ APK ជួរដែល React បង្កើតមានតែជុំវិញទីតាំងរមូរ និងជួរបម្រុង ដោយវាស់កម្ពស់ពិត។ ជួរដែលបានផ្ទុកនៅអាចរមូរឡើង/ចុះមើលបានគ្រប់ជួរ។ PWA Android/iOS នៅបន្ថែមជួរតាមរបៀបដើម។
- រក្សាលេខជួរ ប៊ូតុងរបស់កញ្ចប់ និង React memo តាម ID; sync តម្រងដដែលរក្សាចំនួនដែលផ្ទុករួច; តម្រងថ្មីលើ APK ត្រឡប់ទៅកំពូល។ `@tanstack/react-virtual` វាស់កម្ពស់ ហើយ React គូរជួរ/ចន្លោះ; ការកំណត់ទីតាំងរមូរចេញតាម `app/refs.ts`។
- កែ manifest គ្របដណ្តប់ឯកសារ `overlay-telemetry.ts` ដែលខ្វះលើ PR head ហើយបញ្ចូល guard ថ្មី និង attribution npm ក្នុង `NOTICE`។

#### អ្នកយាម

`history-window-check.mjs` រត់ក្នុង `npm run native:check` (Chromium · bridge ក្លែង): ៦០០ជួរ · កម្ពស់ខុសគ្នា · រមូរជិតចុងផ្ទុកទាំងអស់ · ចុចកញ្ចប់ចាស់បំផុត · ធុងសំរាម/ZTO · sync នៅចុងបញ្ជី · កែទិន្នន័យក្នុងជួរដដែល · តម្រងថ្មី · PWA។ លើកូដមុនកែ ការកំណត់ DOM APK ធ្លាក់ (៦០០ជួរ); កំណែថ្មីត្រូវឆ្លង។ លេខពេលវេលាវាស់ក្នុងផ្នែក ២ ជាការវាស់ Chromium មិនមែន WebView ពិត។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Android APK ➜ Run workflow លើ `ccr-85f562ee-106o6w` ➜ ដំឡើង Pre-release ដែល version/commit ត្រូវនឹងកំណែនេះ។
2. Xiaomi ១២០Hz៖ «ទាំងអស់» ➜ រមូរដល់ចុង ➜ បើក/បិទធុងសំរាម · បញ្ជី ZTO · ☰ · 🔔 ច្រើនដង · រមូរឡើង/ចុះ · សាកជួរដែលមានកម្ពស់ខុសគ្នា និងប៊ូតុងកញ្ចប់ចាស់ · sync · ប្តូរតម្រង/ស្វែងរក។ សាក PWA Android/iOS ផង។
3. ម្ចាស់គម្រោងបញ្ជាក់ថារលូន និង Sentry ពី APK ថ្មីត្រូវបានពិនិត្យ ➜ ដក telemetry សាកថ្មី (`overlay-telemetry.ts` និងការចងរបស់វា · flag ក្នុង workflow · tests/docs ពាក់ព័ន្ធ) រួចតេស្តឡើងវិញមុន merge។ ការរាយការណ៍កំហុស Sentry ធម្មតាត្រូវរក្សា។

### [2.50.5] — 2026-10-07 · ZoeW ៖ **បើកធុងសំរាម · បញ្ជី ZTO · ប្រអប់ផ្សេងៗ និងម៉ឺនុយ ☰ / 🔔 រលូន ទោះរមូរដល់ចុងតារាង «ទាំងអស់» (កញ្ចប់ច្រើន)** (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.5`** (`zoew-v267` ➜ `zoew-v268`)។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase · Function · តំបន់ ZTO ចាក់សោ **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- 🗣️ **សំណើ** ៖ «APK ពេលឈរលើតម្រងថ្ងៃ «ទាំងអស់» … បើអត់ scroll បើក modal ធុងសំរាម smooth តែពេល scroll ដល់អស់ កញ្ចប់ច្រើន
  ពេលចុចបើក modal ធុងសំរាមនៅតែរៀងអាក់អាក់ និង modal បញ្ជី ZTO» · «តែបើលែង auto hide មែន មិនបាច់ធ្វើទេ» · «កែម៉ឺនុយ ☰ ដែរ»។
- 🔎 **មូលហេតុ (វាស់ ៖ Chromium · ៦០០ ជួរ · CPU ថយ ៤ ដង)** ៖ រមូរចុះ ➜ របា Tab លាក់ · ចុចបើក modal ➜ `openModalHelper()` ហៅ
  `showAppChrome()` ➜ ផ្លូវ Android ប្តូរ `clip-path` របស់កាតប្រវត្តិ និង `padding-bottom` របស់បញ្ជី ➜ គូរជួរទាំងអស់ឡើងវិញ
  ក្នុងស៊ុមដែល modal លេច ៖ ធុងសំរាម PrePaint+Paint **២១៦ms** (ធៀប ~៤០ms ពេលរបាបង្ហាញស្រាប់) · ស៊ុមបើក **៣៣១ms** ·
  បញ្ជី ZTO ស៊ុមបើក **១៩៥ms**។ ថ្លៃកើនតាមចំនួនជួរ (៥០ ជួរ ➜ តិច) ➜ «មិនរមូរ ➜ រលូន · រមូរដល់ចុង ➜ អាក់»។
- ✅ **ការកែ** ៖ modal គ្របរបា Tab (z-index ១០០០ > ៩០០) ➜ ការបើក modal **មិនប្តូររបា** · ការរមូរក្នុង modal មិនបញ្ជារបា
  (`setupChromeAutoHide()` រំលងធាតុក្នុង `.modal`)។ របានៅលាក់ពីក្រោយ modal ហើយនៅដដែលក្រោយបិទ ➜ រមូរឡើងបន្តិច ឬដល់កំពូល ➜ លេចវិញ។
  ⛔ **ការលាក់របាតាមទិសរមូរនៅដដែលទាំងស្រុង** (ចុះ ➜ លាក់ · ឡើង ➜ លេច · ពិដាន ៣៦/៤៨px · ប្តូរទំព័រ/បើកម៉ឺនុយ ➜ លេច)។
  ផ្លូវចេញនៅរស់ ៖ បញ្ជីត្រឡប់ដល់កំពូល (ទិន្នន័យរួញ) ខណៈ modal បើក ➜ របាលេច។
- ☰ **ម៉ឺនុយ និងផ្ទាំង 🔔 (សំណើបន្ថែម)** ៖ backdrop របស់វាគ្របរបាដែរ (z-index ១២០០) ➜ `openSideDrawer()` មិនបង្ហាញរបា · ការរមូរក្នុង
  `.side-drawer` (☰ · 🔔) មិនបញ្ជារបា (មុនកែ ការរមូរណាមួយខណៈម៉ឺនុយបើក ➜ បង្ហាញរបា)។ ការប្តូរទំព័រ (Tab) នៅបង្ហាញរបាដូចដើម។
- 📏 **ក្រោយកែ** (ការវាស់ដដែល · median ៧ ដង) ៖ ធុងសំរាម ស៊ុមបើក **៣៣១ ➜ ១៩៨ms** (PrePaint ១១៦ ➜ ១៦ · Paint ១០០ ➜ ៥៨) · បញ្ជី ZTO
  **១៩៥ ➜ ៤១ms** · ការបើកពេលរបាលាក់ = ការបើកពេលរបាបង្ហាញ (ធុងសំរាម ២១៥ ធៀប ២៤៣ · ZTO ៥១ ធៀប ៥១)។ ថ្លៃដែលនៅសល់ (~១២០ms layout ក្រោម CPU ÷៤)
  ជាតារាងធុងសំរាមខ្លួនឯង (២០ ជួរ) — មិនអាស្រ័យប្រវត្តិ ហើយស្មើពេលមិនរមូរដែលម្ចាស់គម្រោងថា «smooth»។
- 🔁 **ជុំ ២ (របាយការណ៍ម្ចាស់គម្រោង ៖ វីដេអូ APK 2.50.5 «នៅអាក់ដដែល» · «តែ APK · PWA រលូន» · «តម្រង ទាំងអស់ មិនទាន់រមូរ ➜ រលូន · រមូរចុះអស់ ➜ អាក់»)** ៖
  ការវិភាគវីដេអូស៊ុមម្តងៗ (~៩០fps) ៖ ចលនាប្រអប់/ម៉ឺនុយដើរ ៣–៧ ស៊ុម ➜ កក ៣៣–៦៦ms ➜ លោតទៅចុង · បន្ទាត់ «ស៊ុមកក» ១៤ ដង · យូរបំផុត ១០២ms។
  មូលហេតុដែលមានតែក្នុង APK ៖ ពេលស្រទាប់ក្រោមរបាស្ថានភាពប្រែ (ប្រអប់ · ម៉ឺនុយ ☰/🔔 បើក-បិទ) `setupNativeShell()` វាស់ពណ៌ក្រោមរបាស្ថានភាព
  (`measureStatusBarTone()` ៖ `elementsFromPoint` ×៥ + `getComputedStyle`) **ក្នុង rAF** ➜ layout របស់ប្រអប់ដែលទើបបើកមិនទាន់គណនា ➜ បង្ខំ
  layout ពេញទំព័រកណ្តាលចលនា (ថ្លៃកើនតាមជួរ)។ ឥឡូវវាស់ **ក្រោយ** ស៊ុមគូររួច (rAF ➜ task · layout ស្អាត ➜ ~០.៥ms) · ការវាស់ ៣២០ms ដដែល ·
  ពណ៌រូបតំណាងរបាស្ថានភាពដូចដើម។
- 🔍 **ឧបករណ៍វាស់បណ្តោះអាសន្ន (ដកចេញវិញ)** ៖ APK សាក `fd46b45` មានបន្ទាត់ 🔍 ក្នុងជើងម៉ឺនុយ ☰ (ចន្លោះស៊ុម · long-animation-frame
  JS/rAF/layout) ➜ ម្ចាស់គម្រោង ៖ «មិនរលូនទេ · ដក rAF ចេញ រញ៉េរញ៉ៃណាស់» ➜ ដកចេញទាំងស្រុង (កូដ · តេស្ត)។ ការវាស់ពណ៌របាស្ថានភាពក្រោយស៊ុមនៅដដែល
  (ថ្លៃដែលវាស់បាន មានតែ APK) តែ **មិនទាន់ធ្វើឲ្យរលូនលើទូរស័ព្ទម្ចាស់គម្រោង** ➜ មូលហេតុនៅសល់មិនទាន់ដឹង (Chromium មិនបង្កើតឡើងវិញ)។
- 🧹 **ជើងម៉ឺនុយ ☰ ស្អាត (សំណើម្ចាស់គម្រោង ៖ «ដកការបង្ហាញ ស៊ុមកក ចាស់ និង framerate ចេញផង»)** ៖ ដកបន្ទាត់
  «ស៊ុម App NNfps · ពេលរមូរ NNfps · WebView» និង «ស៊ុមកក 5 នាទីចុងក្រោយ» ចេញទាំងស្រុង ៖ កូដ (`measureDisplayRateForDrawer` ·
  `noteScrollFrameRate` · `startJankMonitor` · `refreshJankText` · `viewState.displayRateText`/`jankText`) · តេស្ត (`tests/native/display-rate` ·
  `tests/native/jank-meter`) · smoke (ការវាស់បន្ទាត់ទាំង ២) · `INTENTIONAL_UI` (`#displayRateLine` · `#jankLine`) · allowlist (`clock-hygiene` ·
  `state-hygiene`) · ឯកសារ (`ANDROID.md` · `PARITY.md` · `DEVELOPMENT.md` · `guide.html`)។ ជើងម៉ឺនុយនៅតែលេខកំណែ និងរក្សាសិទ្ធិ។
  ⛔ `measureDisplayHz()` · perf-lite (`setupAdaptivePerformance()`) មិនប៉ះ។
- 📡 **ការវាស់ស៊ុមលើទូរស័ព្ទ ➜ Sentry (សំណើម្ចាស់គម្រោង ៖ «ផ្ញើទៅ Sentry ទៅ»)** ៖ `src/ui/overlay-telemetry.ts` ៖ រាល់ការបើក/បិទប្រអប់ ·
  ម៉ឺនុយ ☰/🔔 · (...) ➜ ចន្លោះ rAF យូរបំផុតក្នុង ៧០០ms + long-animation-frame (JS · rAF · layout/គូរ · script ធំបំផុត) + ស្ថានភាពតារាង (ជួរ ·
  តម្រង · របា Tab · ផ្ទាំងហូត) ➜ `ZoeErrors.capture('Perf overlay <open|close> <ស្រទាប់>', { zone: 'perf' })` ⛔ មិនបង្ហាញលើអេក្រង់ · គ្មានទិន្នន័យ
  អតិថិជន · តែ App Android · **តែ APK សាក** (`VITE_PERF_TELEMETRY=1` ពី workflow ពេល `test=true`) ➜ Release ពី `main` = `0` (មុខងារបិទក្នុង bundle)។
- ⚖️ **ជម្រើសដែលមិនធ្វើ** ៖ ការស្នើពី session មុន (A padding ថេរ · B «បបូរមាត់» ជាប់របា · C ធុងសំរាម ១០ ជួរ) **រក្សាការលាក់របា**
  ដែរ តែប្តូររូបរាងកាតក្នុងតំបន់ដែលផ្ទៀងលើឧបករណ៍ពិត (B ត្រូវផ្គូផ្គងគែម pixel) ➜ ការកែនេះតូចជាង ហើយមិនប៉ះ CSS។

#### អ្នកយាម

- `ZoeW/tests/modal-chrome-state.test.tsx` (ថ្មី · ១០ ករណី) ៖ បើក modal/ម៉ឺនុយ ➜ របានៅលាក់ · រមូរក្នុង modal/ម៉ឺនុយ/🔔 ➜ គ្មានការប្តូរ · បិទ ➜ ដដែល
  រួចរមូរឡើង ➜ លេច · ផ្លូវចេញ (កំពូល) · ទិសផ្ទុយ (បើក ➜ មិនលាក់) · ប្តូរទំព័រនៅបង្ហាញ។ tree មុនកែ ➜ **ក្រហម** · mutation ៖ ដកការរំលង `.modal` ➜ ក្រហម ២ ·
  `openSideDrawer()` ហៅ `showAppChrome()` វិញ ➜ ក្រហម ១ · ដកការរំលង `.side-drawer` ➜ ក្រហម ២។
- `gesture-test` (Chromium ពិត) ៖ បើកធុងសំរាម/ម៉ឺនុយពេលរបាលាក់ ➜ របានៅលាក់ · `clip-path`/`padding` បញ្ជីមិនប្រែ · រមូរក្នុង modal/ម៉ឺនុយ · បិទ ·
  រមូរឡើង ➜ លេច។ ⛔ ការអះអាងចាស់ «បើកម៉ឺនុយ ➜ បង្ហាញរបាវិញ» ប្តូរទៅ «របានៅលាក់» តាមសំណើ «កែម៉ឺនុយ ☰ ដែរ»។
- `perf-check` (+៤) ៖ ១២០០ ជួរ · CPU ÷៤ · trace ពិត ៖ PrePaint+Paint ពេលបើកធុងសំរាម និងម៉ឺនុយ ☰ ដោយរបាលាក់ ≤ ១.៨× ពេលរបាបង្ហាញ
  (សមាមាត្រ ➜ មិនអាស្រ័យល្បឿនម៉ាស៊ីន)។ វាស់ ៖ ផ្នែក ២ «modal ↔ របា Tab»។
- `scripts/logic-identity.mjs` ៖ ហេតុផល `setupChromeAutoHide` · `openSideDrawer` (តំបន់ការលាក់របា) បន្ថែមការកែនេះ។
- `ZoeW/tests/overlay-telemetry.test.ts` (ថ្មី · ៧) ៖ ហត្ថលេខា · ការចែក long-animation-frame · បង្អួច rAF (ឈប់ក្រោយ ៧០០ms) · ព្រឹត្តិការណ៍ Sentry
  (`zone: perf` + ស្ថានភាពតារាង) · ⛔ web/PWA និង APK ផ្លូវការ (គ្មាន `VITE_PERF_TELEMETRY=1`) មិនដំឡើង · `repository-contract-test` ៖ step
  «Build web» ឲ្យ `VITE_PERF_TELEMETRY` = 1 តែពេល `test=true` (វាយតម្លៃកន្សោមពិត)។
- `npm run native:check` ៤ឃ ៖ បើក/បិទប្រអប់ និងម៉ឺនុយ ☰ (ចុចពិត · bridge ក្លែង · safe-area ២៤px) ➜ `elementsFromPoint` ទាំងអស់រត់ក្រៅ rAF
  (កូដមុនកែ ➜ **ក្រហម** ៖ ២០/៤០ ក្នុង rAF) · ពណ៌ DARK/LIGHT ដដែល។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **APK សាកមុន merge** (សំណើម្ចាស់គម្រោង) ៖ GitHub ➜ **Actions ➜ Android APK ➜ Run workflow** ➜ «Use workflow from» = branch
   `ccr-85f562ee-106o6w` ➜ **Releases** ➜ Pre-release `zoew-android-v2.50.5-test.<commit>` ➜ ដំឡើងជាន់ App (keystore ដដែល)។ ក្រោយ merge ៖
   Deploy **ZoeW** · Release ផ្លូវការពី `main` ចេញស្វ័យប្រវត្តិ។ គ្មាន rules · env · migration ថ្មី។
2. សាកលើ APK ពិត (⛔ មុន merge — តំបន់ «Bar hiding») ៖ តម្រង «ទាំងអស់» ➜ រមូរដល់ចុង (ជួរកើនរហូតអស់ · របា Tab លាក់) ➜ (ក) (...) ➜ ធុងសំរាម ➜
   លេចរលូនដូចពេលនៅកំពូល · (ខ) «📥 បញ្ជី ZTO» ➜ លេចរលូន · (គ) ម៉ឺនុយ ☰ និង 🔔 ➜ រអិលចូលរលូន · (ឃ) បិទប្រអប់/ម៉ឺនុយ ➜ របានៅលាក់ ·
   រមូរឡើងបន្តិច ➜ របាលេច · (ង) រមូរចុះ/ឡើងធម្មតា ➜ របាលាក់/លេចដូចដើម · ប្តូរ Tab ➜ របាលេច។
3. ការវាស់ ➜ Sentry ៖ ក្នុង APK សាក ធ្វើដូចប្រើធម្មតា (មុនរមូរ និងក្រោយរមូរដល់ចុង ៖ បើក/បិទធុងសំរាម · «📥 បញ្ជី ZTO» · ម៉ឺនុយ ☰ ម្តងៗ ២–៣ ដង) ➜ Claude អាន Sentry (`Perf overlay …` · `zone:perf`)។ ⛔ មុន merge ៖ ដក `overlay-telemetry` ចេញ ឬទុក (Release ពី `main` បិទជានិច្ច)។

### [2.50.4] — 2026-10-07 · ZoeW ៖ **សារជូនដំណឹង (toast) និយាយការពិត ៖ សារព្រមានមិនត្រូវរុញចេញដោយសារជោគជ័យ · សារពេល App ជាប់សោរង់ចាំដោះសោ · ចំណូលប្រចាំថ្ងៃដែលរង់ចាំបណ្តាញប្រាប់ ⏳ រួច ✅ · គ្មានសារ «សូមប្រាប់ Admin» ក្លែងក្រោយចាកចេញ · ZTO ៖ បញ្ចូលបញ្ជីស្របគ្នា ៤ ខ្សែ (លឿន ~៣–៤ ដង) · `?diag=1` ប្រាប់ពេល ZTO ឆ្លើយ** (Deep audit ជុំ ៥ · សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.4`** (`zoew-v266` ➜ `zoew-v267`)។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase **មិនប្រែ**។ តំបន់ ZTO ចាក់សោ ៖ `src/features/zto-list-sync.ts` · `netlify/functions/zto-order-detail.js` ប្រែតាមសំណើម្ចាស់គម្រោង («ធ្វើទាំងពីរ») ➜ `LOCK` ថ្មី ២ ឯកសារ។

#### អ្វីដែលខុសពីមុន

- 🗣️ **សំណើ** ៖ «ធ្វើការងារនៅសល់ទាំងអស់» (ជុំ ៥ Toast · ជុំ ៧ ឯកសារ · សំណើ Locker ពីជុំ ៦ — ដកវិញក្នុងជុំដដែល)។
- 🍞 **T1 ពិដាន ៤ toast** ៖ មុនកែ toast ទី ៥ រុញ toast ចាស់បំផុតចេញ ទោះវាជា «⚠️ … ស្ថិតិប្រាក់មិនទាន់ Sync … សូមប្រាប់ Admin» ហើយ ៤ ថ្មីជា «✅ រក្សាទុកបានជោគជ័យ»
  (ស្កេនជាប់ៗគ្នា · ការបិទតាម ZTO) ➜ សារព្រមានបាត់ស្ងាត់។ ឥឡូវ `dropOldestToast()` បោះតាមថ្នាក់ ៖ ✅ ➜ ℹ️/⏳ ➜ ⚠️ ➜ ❌ (ចាស់បំផុតក្នុងថ្នាក់ · toast រស់ចុងក្រោយ)។
- 🔒 **T2 toast ពេល App ជាប់សោ** ៖ `body.app-locked` លាក់ `.toast-container` ➜ toast ដែលលេចពេលជាប់សោ (ការរក្សាទុកយឺតចប់ · ⚠️ លុយ · toast បណ្តាញ) ផុតអាយុ ៣ វិ.
  ដោយគ្មាននរណាឃើញ។ ឥឡូវ `armToastDismiss()` ទុក timer ពេលជាប់សោ ហើយ `hideAppLockScreen()` ➜ `releaseHeldToasts()` ចាប់ផ្តើមអាយុ (toast រស់អានស្ថានភាពពិតឡើងវិញមុន)។
- ⏳ **T3 ចំណូលប្រចាំថ្ងៃព្យួរ** ៖ `reconcileCollectedHistory()` ពេលការសរសេរ mirror ព្យួរ (`dbOp` ១៥ វិ.) បង្ហាញ «⚠️ … មិនទាន់ Sync ពេញលេញ» ទោះ `armLateWrite` ផ្ទៀងផ្ទាត់ឡើងវិញ
  ពេលការសរសេរចុះ ➜ Sync ស្ងាត់ក្រោយ ⚠️ (សារចាស់ · គ្មាន ✅)។ ឥឡូវ ៖ «⏳ ស្ថានភាពបានរក្សាទុក — ចំណូលប្រចាំថ្ងៃនឹង Sync ដោយស្វ័យប្រវត្តិ…» (លទ្ធផល `'pending'`) ➜ ការសរសេរចុះ ➜
  «✅ បណ្តាញត្រឡប់មកវិញ — ចំណូលប្រចាំថ្ងៃបាន Sync រួចរាល់!» · បរាជ័យ ➜ ⚠️ · ការបិទ/កែតម្លៃបង្ហាញ ✅ របស់ខ្លួនតែពេល mirror ចុះពិត (`=== true`) — មិនអះអាងជោគជ័យមុន។
- 🧾 **T4 សារក្រោយចាកចេញ** ៖ `correctRevenueLedgerToActual()` ដែលចប់ក្រោយការប្តូរវគ្គ/គម្រោង ត្រឡប់ `{ ok: false }` ➜ ផ្លូវដក barcode · កែស្ថិតិដោយដៃ · ការសម្អាតស្វ័យប្រវត្តិ
  បង្ហាញ «⚠️ … មិនទាន់ Sync … សូមប្រាប់ Admin» ដល់វគ្គថ្មី + Sentry `zone: 'money'` (ការជូនដំណឹងលុយក្លែង ៖ ការផ្ទៀងផ្ទាត់មិនបានវាស់អ្វី · callback ចាស់មិនសរសេរក្រោយការប្តូរ)។
  ឥឡូវលទ្ធផលមាន `stale: true` ➜ អ្នកហៅស្ងាត់។
- 🗄️ **Locker (សំណើជុំ ៦ ➜ អនុម័ត ➜ ម្ចាស់គម្រោងដកវិញក្នុងជុំដដែល)** ៖ ប្រអប់សួរមុនដាក់កញ្ចប់គ្មានទីតាំងចូលទីតាំងដែលមានកញ្ចប់អតិថិជនផ្សេង ត្រូវបានសាងរួច
  រួចដកចេញតាមសំណើ «មិនបាច់ចាំមានសារប្រមាន យល់ព្រម ពេលស្កេនដាក់ទីតាំង នាំតែយឺតការងារ — ចាំពេលកញ្ចប់មានទីតាំងស្រាប់ ស្កេនដូរទីតាំង ទើបប្រមាន» ➜ កូដ Locker
  = `main` (ស្កេនដាក់ទីតាំង ➜ ចុះភ្លាម · កញ្ចប់មានទីតាំងស្រាប់ ➜ ប្រអប់ផ្លាស់ទី ដូចដើម) ហើយការសម្រេចនេះមានអ្នកយាម (`locker-scan-direct.test.tsx`) ·
  `CLAUDE.md` ជួរ «Locker assignment ↔ claim»។
- ⚡ **ZTO បញ្ចូលបញ្ជីស្របគ្នា ៤ ខ្សែ** (របាយការណ៍ម្ចាស់គម្រោង «ការទាញកញ្ចប់ពី ZTO យឺត ពេលចុច បញ្ចូលក៏យឺត» ➜ «ធ្វើទាំងពីរ») ៖ វាស់ (harness Firebase ក្លែង ·
  latency ១០ ms/op) ៖ ជួរដេកមួយ = ៦ op · ~៤.១ ដំណើរទៅមកតាមលំដាប់ ➜ ១០០ ជួរ = ៤០៩ ដំណើរ (≈ ២ នាទីលើ Firebase ពិត)។ ឥឡូវ `importZtoListRows()`
  ចែកជួរជាខ្សែតាម «អតិថិជន + ថ្ងៃស្កេន» ហើយរត់ `ZTO_LIST_IMPORT_CONCURRENCY` (៤) ខ្សែស្របគ្នា — ខ្សែមួយរត់ជួររបស់វាតាមលំដាប់ ➜
  `addOrUpdateEntry()` បញ្ចូលគ្នាជាកញ្ចប់តែមួយដូចដើម ➜ ២៤ ជួរ ៖ ៩៧៩ ➜ ៣២៩ ms · ១០០ ជួរ ៖ ៤០៨៧ ➜ ១០៨៥ ms (op ដដែល · កញ្ចប់ដដែល · ledger ដដែល)។
  ការព្យួរដំបូង/ក្រៅបណ្តាញ ➜ គ្មានជួរថ្មីចាប់ផ្តើម · ខ្សែដែលកំពុងរត់បញ្ចប់ជួររបស់វា (⏳/⚠️ ≤ ៤) · «មិនទាន់បញ្ចូល N» = ជួរដែលមិនបានចាប់ផ្តើម ·
  បញ្ជីនៅដដែល។ សារ «⏳ កំពុងបញ្ចូល N/M» រាប់ជួរដែលចប់។ ពិដាន `ZTO_LIST_IMPORT_MAX` (១០០ ក្នុងមួយចុច) ដដែល។
- 🩺 **`?diag=1` ប្រាប់ពេល ZTO ឆ្លើយ** (`upstreamTiming`) ៖ «ទាញយឺត» វាស់មិនបាន — diag មានតែពិដាន (`timing`) គ្មានពេលពិត។ ឥឡូវ Function កត់ក្នុង
  `requestOnce()` (ចំណុចតែមួយ) តាមប្រភេទ `detail` · `list` · `signed` ៖ `count` · `lastMs` · `avgMs` · `maxMs` · `timeouts` · `ageMs` (តែលេខ · តាម container)។
  ទាញយឺត ➜ បើក `?diag=1` ភ្លាម ➜ `list.lastMs`/`signed.lastMs` ធំ = ZTO ឆ្លើយយឺត (មិនមែន App) · `timeouts` > 0 = លើសពិដាន។
- ⚠️ **ទទួលយក (វាស់ ៖ ប្រុងប្រយ័ត្ន មិនមែនខុស)** ៖ «⚠️ … ស្ថិតិប្រាក់មិនទាន់ Sync» ក្រោយ rules clamp (ការដកដែលឧបករណ៍ផ្សេងបានដករួច · s6b) នៅដដែល — ledger ពិតមិនស្មើតម្លៃដែលស្នើ
  ➜ Sentry លុយត្រឹមត្រូវ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** (Netlify ➜ Function `zto-order-detail` ទៅជាមួយ) ➜ build APK ឡើងវិញ។ គ្មាន rules · env · migration ថ្មី។
2. សាក ៖ (ក) ស្កេនជាប់ៗគ្នា ៤–៥ កញ្ចប់ក្រោយសារ ⚠️ ណាមួយ ➜ ⚠️ នៅរហូតអស់អាយុ · (ខ) បើកការចាក់សោ ➜ ដក barcode ក្រៅបណ្តាញ ➜ ចាកចេញពី App ➜ ត្រឡប់ ➜ ដោះសោ ➜ សារ ⏳/✅/⚠️
   លេចក្រោយដោះសោ · (គ) បិទកញ្ចប់ពេលបណ្តាញដាច់ ➜ «⏳ ស្ថានភាពបានរក្សាទុក — ចំណូលប្រចាំថ្ងៃនឹង Sync ដោយស្វ័យប្រវត្តិ» ➜ បណ្តាញមកវិញ ➜ «✅ … បាន Sync រួចរាល់» ·
   (ឃ) របៀប Locker ៖ ស្កេនកញ្ចប់ថ្មីចូលទីតាំងដែលមានកញ្ចប់អតិថិជនផ្សេង ➜ ចុះភ្លាម គ្មានប្រអប់ · កញ្ចប់មានទីតាំងស្រាប់ស្កេនចូលទីតាំងផ្សេង ➜ ប្រអប់ផ្លាស់ទី ដូចដើម។
3. ZTO ៖ ទាញបញ្ជី (≥ ២០ ជួរ) ➜ «បញ្ចូល» ➜ «⏳ កំពុងបញ្ចូល N/M» រត់លឿន (១០០ ជួរ ≈ ២០–៣០ វិ. ជំនួស ~២ នាទី) · កញ្ចប់អតិថិជនដដែល ថ្ងៃដដែល
   នៅបញ្ចូលគ្នាជាកញ្ចប់តែមួយ · 💵 ចំណូលប្រចាំថ្ងៃ = COD សរុបនៃកញ្ចប់ដែលបញ្ចូល។ បើទាញនៅយឺត ៖ បើក `?diag=1` ភ្លាមក្រោយទាញ ហើយផ្ញើ
   `upstreamTiming` (`list` · `signed` ៖ `lastMs` · `timeouts`) មកខ្ញុំ។

#### អ្នកយាម

- `ZoeW/tests/toast-visibility.test.tsx` (ថ្មី · ៦) ៖ លំដាប់បោះ · toast រស់រំលង · toast ពេលជាប់សោរង់ចាំដោះសោ · toast បណ្តាញរស់ពេលជាប់សោអានស្ថានភាពពិតពេលដោះសោ ៖
  tree មុនកែ **FAIL ៤** ➜ ៦/៦ · mutation ដក `releaseHeldToasts()` ➜ FAIL ២។
- `ZoeW/tests/collected-sync-pending.test.ts` (ថ្មី · ៥) ៖ ព្យួរ ➜ ⏳ · `'pending'` · ការសរសេរយឺត ➜ ✅ · បរាជ័យយឺត ➜ ⚠️ · ទិសផ្ទុយ reject/រកមិនឃើញ ➜ ⚠️ ដូចដើម ៖ មុនកែ **FAIL ១** ➜ ៥/៥ ·
  mutation ដក ✅ យឺត ➜ FAIL ១ · mutation ដក `onFailed` ➜ រស់ ➜ កូដស្ទួនដក (`commitCollectedMarks()` ប្រាប់ ⚠️ រួច)។
- `ZoeW/tests/ledger-stale-session.test.tsx` (ថ្មី · ៣) ៖ `stale: true` · កែស្ថិតិដោយដៃក្រោយចាកចេញ ➜ គ្មាន ⚠️/Sentry · ទិសផ្ទុយ ✅/⚠️ ៖ មុនកែ **FAIL ២** ➜ ៣/៣។
  `ZoeW/tests/remove-stale-session.test.ts` (ថ្មី · ៣) ៖ ដក barcode ពិត (transaction · ធុងសំរាម · ledger ក្លែង) ➜ ចាកចេញមុន ledger ឆ្លើយ ➜ ស្ងាត់ · វគ្គដដែល ➜ ✅ ·
  ការសម្អាតពិនិត្យ `stale` ៖ mutation ដកការពិនិត្យក្នុងផ្លូវដក ➜ FAIL ១ · ក្នុងការសម្អាត ➜ FAIL ១។
- `ZoeW/tests/locker-scan-direct.test.tsx` (ថ្មី · ៤) ៖ កញ្ចប់គ្មានទីតាំង ➜ ទីតាំងមានកញ្ចប់អ្នកផ្សេង ➜ ចុះភ្លាម (គ្មានប្រអប់ · toast ✅) · ទិសផ្ទុយ ៣ ·
  ផ្លាស់ទី ➜ ប្រអប់ (យល់ព្រម/បោះបង់) · ទីតាំងដដែល ➜ «រួចហើយ» ៖ លើកូដប្រអប់ «ទីតាំងមានកញ្ចប់អ្នកផ្សេង» **FAIL ១** ➜ កូដ `main` ៤/៤។
- `daily-collected-test` ផ្នែក ២៣ · ៣៣ (hang) ៖ អះអាង «⏳ … ដោយស្វ័យប្រវត្តិ» (មិនមែន ⚠️ · គ្មាន ✅) ហើយ ✅ ក្រោយដោះយឺត (ពីមុនចាក់សោសារ ⚠️ ចាស់ ➜ ១៦៧/១៦៧) ·
  `repository-file-coverage.json` ៖ mapping តេស្ត ៦ · vitest ៨២៣/៨២៣។
- `ZoeW/tests/zto-import-lanes.test.ts` (ថ្មី · ៧ · Firebase ក្លែងមាន latency · រាប់ claim ក្នុងពេលតែមួយ) ៖ (១) អតិថិជនផ្សេងគ្នា ➜ claim ២–៤ ក្នុងពេលតែមួយ · wall < ជួរ × latency × 1.2 ·
  (២) អតិថិជនដដែល ថ្ងៃដដែល ➜ ១ ក្នុងពេលតែមួយ · កញ្ចប់តែមួយ · barcode តាមលំដាប់ · `count` · ledger `codDollar`/`totalCount` · registry · (៣) ការសរសេរព្យួរ ➜ ⏳ ២–៤ ·
  បូកគ្រប់ · បញ្ជីនៅ · (៤) ក្រៅបណ្តាញ · (៥–៧) អតិថិជនរាប់រយ (ផ្នែក ២ Z4) ៖ tree មុនកែ **FAIL ៦/៧** ➜ ៧/៧។
  `zto-list-sync-test` ៖ សេណារីយ៉ូព្យួរ/ក្រៅបណ្តាញប្រើបញ្ជី ៦ ជួរ (> ខ្សែ) ➜ claim/រក្សាទុក = ៤ ក្នុងពេលតែមួយ (មុនកែ ១) · អតិថិជនដដែល ➜ ១ ·
  «មិនទាន់បញ្ចូល» = ជួរដែលមិនបានចាប់ផ្តើម · `?diag=1` `upstreamTiming` `list`/`signed` ដាច់ពីគ្នា · `zto-proxy-test` ៖ `/detail` កត់ពេលពិត (fetch យឺត ៤០ ms ➜ ≥ ៣៥) ·
  timeout រាប់ក្នុងការព្យួរ · តែលេខ · `zto-lock.test.ts` ៖ `LOCK` ថ្មី ២ ឯកសារ (សំណើម្ចាស់គម្រោង «ធ្វើទាំងពីរ»)។
  `ZoeW/scripts/parity-deep.mjs` ៖ ជំហាន «បញ្ចូល (សរសេរលុយ)» ប្រៀបការសរសេរដោយមិនគិតលំដាប់ (`UNORDERED_WRITE_STEPS`) — ខ្សែ ៤ ប្តូរលំដាប់ការសរសេរ
  តែសំណុំ និង DB ចុងក្រោយដូច App ដើម (CI shard 3 ធ្លាក់លើ commit ដំបូង ➜ កែ) · ម្ចាស់គម្រោង ៖ ឧបករណ៍ parity ធៀប ZoeW vanilla ត្រូវដកទាំងស្រុងក្នុង PR បន្ទាប់។

### [2.50.3] — 2026-10-06 · ZoeW ៖ **បញ្ជី ZTO ៖ កញ្ចប់ដែល ZTO ចុះហត្ថលេខាក្នុងចន្លោះ តែមកដល់មុនចន្លោះ ចូលជា «យករួច» លើថ្ងៃចុះហត្ថលេខា · ជួរនីមួយៗបង្ហាញថ្ងៃមកដល់ និងថ្ងៃបិទ** (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.3`** (`zoew-v265` ➜ `zoew-v266`)។ ⛔ ZoeKeyGen · Firebase rules · migration Supabase **មិនប្រែ**។ 🔒 តំបន់ ZTO ចាក់សោ ៖ `zto-order-detail.js` (`projectSignedRow()` ·
`keepLatestSignedRow()` · `listResponseBody()` · `mergeSignedCompanion()`) · `zto-list-sync.ts` (`ztoListRowOf()` · `ztoListSignedRowIndex()` · `classifyZtoListRows()` ·
`fetchZtoListAllPages()` · `renderZtoListSyncPreview()` · `ztoListSignedNote()` · `importZtoListRows()`) · `zto/model.ts` កែតាមសំណើម្ចាស់គម្រោង ➜ sha256 ថ្មីក្នុង `LOCK`។

#### អ្វីដែលខុសពីមុន

- 🗣️ **សំណើ** ៖ «ប៊ូតុងទាញបញ្ជី … បញ្ចូលតែកញ្ចប់ 03 ហើយកញ្ចប់ 05 ក៏ទាញបាន តែត្រូវចូលជាកញ្ចប់បិទរួច» · ថ្ងៃ ៖ «ថ្ងៃ ZTO ស្កេនចុះហត្ថលេខា» ·
  «អោយប្រាប់ថាកញ្ចប់មកដល់ថ្ងៃណា និងបិទថ្ងៃណា»។
- ✍️ **ZTO-E12** ៖ មុនកែ Function ផ្ញើតែលេខ barcode នៃជួរ 05 (`signed`) ➜ ជួរ 05 គ្រាន់តែជាភស្តុតាងបិទសម្រាប់ជួរមកដល់ ➜ កញ្ចប់ដែលមកដល់មុនចន្លោះ
  (ឬ ZoeW មិនដែលស្កេន) តែចុះហត្ថលេខាក្នុងចន្លោះ **មិនដែលចូល ZoeW** ➜ ស្ថិតិប្រាក់ និងស្ថិតិយកខ្វះ។ ឥឡូវ ៖ Function project ជួរ 05 ដែលជាភស្តុតាងជា `signedRows`
  (ទម្រង់ជួរមកដល់ ៖ barcode · phone · COD · DOD · `at` = ម៉ោងស្កេនចុះហត្ថលេខា · ប្រភព · ស្ទួន ➜ ម៉ោងចុងក្រោយ · ⛔ គ្មានឈ្មោះ/អាសយដ្ឋាន · ជួរផ្ទុយ/កូដផ្សេងមិនចូល) ➜
  App ៖ barcode ក្នុង `signedRows` ដែលមិននៅក្នុងបញ្ជីមកដល់ ហើយថ្ងៃចុះហត្ថលេខាក្នុង [ពីថ្ងៃ · ដល់ថ្ងៃ] ➜ ក្រុម «🆕 ថ្មី» ជា «យករួច» (`signedOnly`) ➜ «➕ បញ្ចូល» តាមទ្វារដដែល
  (`claimBarcodeInRegistry()` ➜ `addOrUpdateEntry(…, ម៉ោងចុះហត្ថលេខា, closedAt)` ➜ ស្ថិតិយកតាម `applyBarcodeCloseChange()`) · មានក្នុង ZoeW រួច ➜ «✅ មានរួច» (នៅបើក ➜ បិទ) ·
  គ្មានលេខទូរស័ព្ទ ➜ រំលង · ចាស់ជាងអាយុធុងសំរាម «យករួច» (៣០ ថ្ងៃ) ➜ `too-old-purged` (registry អាចដោះលែងរួច ➜ ហានិភ័យលុយបូកស្ទួន) · ចុះហត្ថលេខាក្រៅចន្លោះ ➜ មិនរាប់ ·
  បញ្ជីមកដល់ទទេ តែមានជួរ 05 ក៏បញ្ចូលបាន។
- 📥 **ថ្ងៃមកដល់ និងថ្ងៃបិទ** ៖ ជួរនីមួយៗក្នុងប្រអប់ ៖ «📥 មកដល់ ៖ <ម៉ោងស្កេនមកដល់>» (ឬ «មុនថ្ងៃ <ពីថ្ងៃ> (ក្រៅចន្លោះ)») · «✍️ ZTO ចុះហត្ថលេខា (បិទ) ៖ <ម៉ោង>» ·
  ⛔ `closedAt` របស់កញ្ចប់ដែលបញ្ចូល នៅតែជាពេលបញ្ចូល (ផ្លូវ «យករួច» ដដែល · លុយ/ស្ថិតិមិនប្តូរ)។
- ⚠️ **ទទួលយក** ៖ ការប្រៀបធៀបអាយុធុងសំរាមវាស់ពីម៉ោងចុះហត្ថលេខា (ដូចជួរមកដល់វាស់ពីម៉ោងមកដល់) ➜ កញ្ចប់ដែល «លុប» ដោយដៃក្នុង ZoeW ហើយ purge រួច (> ៣០ ថ្ងៃ)
  តែ ZTO ចុះហត្ថលេខាក្រោយការលុប < ៣០ ថ្ងៃ ➜ អាចបញ្ចូលម្តងទៀត (ករណីកម្រ · ដូចជួរមកដល់)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** (Netlify · Function ZTO ប្រែ) ➜ build APK ឡើងវិញ។ គ្មាន rules · env ថ្មី។
2. «📥 បញ្ជី ZTO» ៖ ជ្រើសចន្លោះ ➜ «📥 ទាញបញ្ជី» ➜ ក្រុម «🆕 ថ្មី» មានកញ្ចប់ «✍️ ZTO ចុះហត្ថលេខាក្នុងចន្លោះ តែមកដល់មុនថ្ងៃ …» ➜ «➕ បញ្ចូល» ➜ ពួកវាចូលជា «យករួច»
   លើថ្ងៃចុះហត្ថលេខា (ចូលធុងសំរាម «យករួច» ក្នុង ២ ម៉ោង · លុយមិនដក) · ជួរនីមួយៗបង្ហាញ «📥 មកដល់» និង «✍️ ZTO ចុះហត្ថលេខា (បិទ)»។

#### អ្នកយាម

- `zto-list-sync-test` ៖ ផ្នែក ២២ +៥ (Function ៖ `signedRows` ជួរភស្តុតាងតែប៉ុណ្ណោះ · ស្ទួន ➜ ម៉ោងចុងក្រោយ · ទម្រង់ ៦ វាល · phone `0` ➜ '' · គ្មានឈ្មោះ/អាសយដ្ឋាន ·
  ការអភិរក្សចំនួន · `withSigned` បញ្ចូលគ្នា · ទិសផ្ទុយ `off`) · ផ្នែក ១០ +៤ (audit build ៖ ជួរ 05 គ្មានមកដល់ ➜ ថ្មី «យករួច» លើម៉ោងចុះហត្ថលេខា · ជួរមកដល់ + `signedAt` ·
  existing · `too-old-purged` · ក្រៅចន្លោះ · ទិសផ្ទុយ គ្មាន `signedRows`) ៖ tree មុនកែ **FAIL ៨** ➜ **៥៨៥/៥៨៥**។
- `ZoeW/tests/zto-signed-only-import.test.tsx` (ថ្មី · ៦) ៖ ការប្រមូល `signedRows` · ការចាត់ក្រុម · ការបញ្ចូល (ម៉ោងចុះហត្ថលេខា + បិទ + ស្ថិតិយក) · បញ្ជីមកដល់ទទេ ·
  បន្ទាត់ «📥 មកដល់» / «✍️ ZTO ចុះហត្ថលេខា (បិទ)» ៖ មុនកែ **FAIL ៥** ➜ ៦/៦ · `tests/zto-list-origin.test.tsx` ៖ មូលហេតុរំលងនៅបន្ទាត់ដាច់ (ក្រៅពីបន្ទាត់ថ្ងៃមកដល់)។

### [2.50.2] — 2026-10-06 · ZoeW ៖ **តារាងប្រវត្តិ ៖ ជួរឈរ «Locker/តម្លៃ/ចំនួន» នៅចំកណ្តាលតារាង · ប៊ូតុង ខល/បិទ ទំហំតែមួយគ្រប់អេក្រង់ (padding 10px) · លុយច្រើនខ្ទង់មិនត្រូវប៊ូតុងបាំង · ZTO ៖ «ចុះហត្ថលេខា» ដែល ZTO ដាក់តួអក្សរមើលមិនឃើញ (U+200B) រាប់ជាភស្តុតាង · បញ្ជីស្គាល់ប្រភេទស្កេនគ្រប់ភាសា Argus (ខ្មែរ · ចិន · អង់គ្លេស) · សារ ⚠️ «ចុះហត្ថលេខា» បង្ហាញអត្ថបទដែល Function ទទួលពី ZTO** (សំណើម្ចាស់គម្រោង ៖ រូបថតទូរស័ព្ទ · screenshot ៩ ទំហំ ✅ «ok ស្អាត»)

- 🗣️ **សំណើ** ៖ «កែអក្សរ តម្លៃ/ទីតាំង ➜ Locker/តម្លៃ/ចំនួន ហើយវាស់ជួរវាឲ្យនៅចំកណ្តាលគ្រប់ទំហំអេក្រង់ · ប៊ូតុង ខល និង បិទ ដាក់ឲ្យប៉ុនលើកមុន តូចពេក» ➜ ក្រោយ screenshot
  padding 12px ៖ «ធំពេកទេដឹង» · «ជួរឈរ Locker/តម្លៃ/ចំនួន អត់ចំកណ្តាល» (= ជួរឈរខ្លួនឯងនៅកណ្តាលតារាង មិនមែនតែខ្លឹមសារក្នុងក្រឡា) · «ពិនិត្យក្រែងពេលមានលុយលេខច្រើន ប៊ូតុងបាំង»។
- 📏 **វាស់មុនកែ** (Chromium + ពុម្ពអក្សរ Kantumruy Pro ពិត ៖ ទាញពី Google Fonts ចូល scratch ព្រោះ `layout-check` ទប់ធនធានខាងក្រៅ ហើយគូរខ្មែរដោយ Unifont ដែលធំជាង) ៖
  [2.50.1] បង្រួម padding ប៊ូតុង `clamp(4px, (100vw − 300px) / 15, 12px)` ➜ 412px (ទូរស័ព្ទម្ចាស់គម្រោង) ៖ **7.5px** (52–56px) · 320–375 ៖ 4–5px · កណ្តាលជួរឈរតម្លៃនៅ
  ~៤៧% នៃតារាង (ខុសពីកណ្តាល **8–43px** តាមទទឹង) · ខ្លឹមសារក្រឡាជាប់ឆ្វេង (គម្លាត 10–22px)។
- ✅ **ឥឡូវ** (`react-root.css` · `app.css` ដូចដើមបេះបិទ) ៖ ទទឹងខាងអតិថិជន (លេខរៀង + អតិថិជន) = ទទឹងសកម្មភាព ➜ កណ្តាលជួរឈរ = កណ្តាលតារាង ៖ < 360 ➜ 6 · 30.5 · **27** · 36.5 ·
  360–699 ➜ 6 · 31.5 · **25** · 37.5 · 700–991 ➜ 5 · 24 · **42** · 29 · ≥ 992 ➜ 4 · 27 · **38** · 31 (%) · ចំណងជើង និងខ្លឹមសារក្រឡា `text-align: center` + `.price-stack` ចំកណ្តាល ·
  ប៊ូតុង padding **10px** គ្រប់ទទឹង (ដកការបង្រួមតាមអេក្រង់ · កម្ពស់ 38px · ការប្រៀប ៧.៥ / ១០ / ១២px ផ្ញើម្ចាស់គម្រោង) · ក្រឡាសកម្មភាព padding 2px · បត់ជួរជាការការពារចុងក្រោយ
  («បិទ» ចុះក្រោម «ខល» ទំហំដដែល)។ វាស់ក្រោយកែ (Kantumruy Pro) ៖ ≥ 360 ៖ ខល/បិទ នៅបន្ទាត់តែមួយ · «✏️ កែលេខ» ចាប់ពី ~390 · 320/340 ៖ បត់ ២ បន្ទាត់ · $1234.56 ·
  COD $987.65 + DOD $245.50 (រៀល ៧ ខ្ទង់) ៖ នៅក្នុងក្រឡា មិនជាន់ប៊ូតុងគ្រប់ទទឹង ៩ (320–1280)។
- ⚠️ **ទទួលយក** ៖ < 360px ៖ ប៊ូតុងបត់ ២ បន្ទាត់ (ជួរខ្ពស់ជាងមុន) ជំនួសការបង្រួម · ចំណងជើងបត់ «Locker/តម្លៃ/» + «ចំនួន» លើ ≤ 375 · ស្លាកក្នុងក្រឡា «ទីតាំង: …» មិនប្តូរ
  (សំណើប្តូរតែចំណងជើង) · `layout-check` (Unifont) ៖ ខល/បិទ បន្ទាត់តែមួយចាប់ពី 390 · «✏️ កែលេខ» ចាប់ពី 430។

- 🔎 **ZTO-E9 ៖ សារ ⚠️ «ចុះហត្ថលេខា» អត្ថបទផ្ទុយ បង្ហាញអត្ថបទដែល Function ទទួលពិតៗ** (របាយការណ៍ម្ចាស់គម្រោង ៖ ប្រអប់បញ្ជី «ZTO ផ្ញើជួរ «ចុះហត្ថលេខា» 66 ជួរ …
  សូមប្រាប់អ្នកគ្រប់គ្រងប្រព័ន្ធឲ្យពិនិត្យ ZTO_LIST_SIGNED_SCAN_DESC» · លុប env + Deploy ➜ «នៅដដែល») ៖ **វាស់** (payload ពិតរបស់ម្ចាស់គម្រោងពី browser) ៖ ស្កេន 05 ជ្រើស
  «ចុះហត្ថលេខា» ថ្ងៃ 10-06 = ១៨/១៨ ជួរ · ការស្វែងរកគ្មានតម្រង ១៤/១៤ ជួរ 05 ៖ `scanTypeDesc` ដូចលំនាំដើម **គ្រប់កូដតួអក្សរ** (U+1785 17BB 17C7 …) · បញ្ជីប្រភេទ Argus មាន
  «ចុះហត្ថលេខា» តែមួយ ➜ ~១៨/ថ្ងៃ × ៤ ថ្ងៃ ≈ 66 = **គ្រប់** ជួរចុះហត្ថលេខាដែល Function ឃើញ ខុសពីអ្វីដែល browser ឃើញ ➜ មូលហេតុនៅភាពខុសគ្នារវាងសំណើ Function និង
  browser (ទំនងជាភាសា/header) តែវាស់ពីទីនេះមិនបាន (session ហៅ ZTO មិនបាន) ហើយមុនកែ Function លាក់អត្ថបទ («គ្មានអត្ថបទពី ZTO») ➜ សារប្រាប់ឲ្យ «ពិនិត្យ» តែអ្នកគ្រប់គ្រង
  គ្មានអ្វីត្រូវមើល។ ឥឡូវ ៖ ចម្លើយផ្ទុកអត្ថបទ **ជួរផ្ទុយតែប៉ុណ្ណោះ** (`signedMismatchTexts` · `signedListMismatchTexts` ≤ ៥ ផ្សេងគ្នា · ≤ ៦៤ តួ · តួអក្សរមើលមិនឃើញនៅដដែល)
  + `signedDescExpected` · `?diag=1` `list.signedMismatch.texts` (៥ ចុងក្រោយ) + `expected` ➜ ប្រអប់បញ្ជី និង 🩺 ៖ «Function ទទួលពី ZTO «…» (U+…) ≠ Server រំពឹង «…» (U+…)»។
  ⛔ មិនដែលមាន barcode ឬអត្ថបទជួរផ្សេង (04 · មកដល់) · ភស្តុតាងវិជ្ជមាន / `otherScans` / ការអភិរក្សចំនួន មិនប្តូរ។ 🔒 តំបន់ ZTO ចាក់សោ ៖ `zto-order-detail.js` ·
  `zto-list-sync.ts` កែតាមរបាយការណ៍ម្ចាស់គម្រោង ➜ sha256 ថ្មីក្នុង `LOCK` (`ZoeW/tests/zto-lock.test.ts`)។
- 🌐 **ZTO-E10 ៖ ZTO បកប្រែ `scanTypeDesc` តាមភាសាគណនី Argus** ៖ ម្ចាស់គម្រោងប្តូរភាសា Argus ហើយផ្ញើ payload ពិត ៖ 05 = ខ្មែរ «ចុះហត្ថលេខា» ·
  ចិន «签收» · អង់គ្លេស «Signed» (ជួរ 05 ទាំង ១៨/១៨ ក្នុងភាសានីមួយៗ) · 03 = «អីវ៉ាន់មកដល់» · «到件» · «arrived» · -710 = «退货扫描» · «Return scan» · កូដ **មិនប្រែ**។
  គណនីជាភាសាចិន/អង់គ្លេស ➜ ជួរ 05 ទាំងអស់ «ផ្ទុយ» ➜ បិទតាម ZTO ឈប់ · ការសម្អាត ៧ ថ្ងៃរង់ចាំ (យូរបំផុត ៣០ នាទី រួចដកលុយ «ផុតកំណត់») · ហើយ **បញ្ជីមកដល់**
  ក៏រំលងជួរ 03 ទាំងអស់ («到件» ≠ «អីវ៉ាន់មកដល់») ➜ បញ្ជីទទេ (ការពារ ៖ មូលហេតុពិតនៃ «66 ជួរ» គឺ E11 ខាងក្រោម)។
  ឥឡូវ ៖ ជាន់អត្ថបទនីមួយៗជាបញ្ជី (`readListDescs()` · បំបែកដោយ `|` · ដកឃ្លា · ស្ទួន · ≤ ៨) ៖ លំនាំដើម `អីវ៉ាន់មកដល់|到件|arrived` · `ចុះហត្ថលេខា|签收|Signed` ·
  `off` = បិទជាន់អត្ថបទ (Netlify មិនទទួលតម្លៃទទេ · មុន ៖ «ទទេ» ដែលដាក់មិនបាន) · `signedDescExpected` / diag `expected` ជាបញ្ជី (App ទទួល string ពី Function ចាស់ដែរ)។
  ⛔ ច្បាប់ភស្តុតាងវិជ្ជមាន ២ ជាន់ · `otherScans` · ការអភិរក្សចំនួន មិនប្តូរ · ជួរកូដផ្សេង (`-710` · `04`) រំលងតាមកូដ មិនថាភាសាណា។ 🔒 `zto-order-detail.js` · `zto-list-sync.ts` ➜ `LOCK`។
- 👻 **ZTO-E11 ៖ មូលហេតុពិតនៃ «66 ជួរ» ៖ ZTO ដាក់ ZERO WIDTH SPACE ក្នុង «ចុះហត្ថលេខា»** ៖ **វាស់** — សារ E9 លើ Deploy Preview របស់ម្ចាស់គម្រោង ៖ «Function ទទួលពី ZTO
  «ចុះហត្ថលេខា» (U+1785 17BB 17C7 **200B** 17A0 178F 17D2 1790 179B 17C1 1781 17B6) ≠ Server រំពឹង «ចុះហត្ថលេខា» (U+1785 17BB 17C7 17A0 …)» ➜ ZTO បំបែកពាក្យ «ចុះ» · «ហត្ថលេខា»
  ដោយ U+200B (មើលមិនឃើញ · copy ពី browser មិនឃើញ · វាយក្នុង env មិនបាន) ➜ ភាសាគណនីខ្មែរក៏ជួរ 05 ទាំងអស់ «ផ្ទុយ» ហើយការលុប/ដាក់ env «ចុះហត្ថលេខា» មិនជួយ
  («នៅដដែល»)។ ឥឡូវ ៖ ការប្រៀបធៀបអត្ថបទប្រភេទស្កេន (មកដល់ និងចុះហត្ថលេខា) រំលងតួអក្សរទម្រង់មើលមិនឃើញ (Unicode `Cf` ៖ U+200B · 200C · 200D · 2060 · FEFF · 00AD …)
  **ទាំងសងខាង** (`scanDescKey()` ៖ ជួរដេក និង env) · អក្សរមើលឃើញខុស (អក្សរបាត់ · ដកឃ្លាធម្មតា) នៅផ្ទុយ · អត្ថបទដែលមានតែតួអក្សរមើលមិនឃើញ = គ្មានអត្ថបទ (ច្បាប់ «គ្មានវាល ➜ មិនរំលង»)
  · សារ ⚠️ / `?diag=1` នៅបង្ហាញអត្ថបទដើម (មាន U+200B) ដើម្បីវិនិច្ឆ័យ។ 🔒 `zto-order-detail.js` ➜ `LOCK`។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** (Netlify) ➜ build APK ឡើងវិញ។ គ្មាន rules · env ថ្មី។ ⚠️ Netlify ➜ Environment variables ៖ បើបានដាក់ `ZTO_LIST_SCAN_DESC` ឬ `ZTO_LIST_SIGNED_SCAN_DESC`
   (ឧ. `ចុះហត្ថលេខា`) ➜ **លុបវាចោល** (env ជំនួសលំនាំដើម ៣ ភាសាទាំងមូល ➜ ប្តូរភាសា Argus ទៅចិន/អង់គ្លេស ➜ នៅផ្ទុយ · ទុក env ខ្មែរក៏ដំណើរការចំពោះ U+200B ដែរ) រួច Deploy។
2. សាកលើទូរស័ព្ទ ៖ តារាងប្រវត្តិ ➜ ជួរឈរ «Locker/តម្លៃ/ចំនួន» នៅកណ្តាលអេក្រង់ · ប៊ូតុង «ខល» «បិទ» មិនជាន់លុយ (សាកជួរលុយធំ) · ផ្តេកទូរស័ព្ទ/ថេប្លេត/កុំព្យូទ័រក៏ដូចគ្នា។
3. ZTO ៖ ក្រោយ Deploy បើក «📥 បញ្ជី ZTO» ➜ សារ ⚠️ «ចុះហត្ថលេខា … 66 ជួរ» **បាត់** · កញ្ចប់ «ចុះហត្ថលេខា» មានស្លាក 🔒 · ភាសា Argus ណាក៏បាន (ខ្មែរ · ចិន · អង់គ្លេស)។
   បើសារ ⚠️ នៅ ➜ វាបង្ហាញ «Function ទទួលពី ZTO «…» (U+…)» (ភាសាថ្មីដែលលំនាំដើមមិនទាន់មាន) ➜ ផ្ញើបន្ទាត់នោះមក Claude។

#### អ្នកយាម

- `layout-check` (ជួរប្រវត្តិមានទិន្នន័យ · ១៧ ទទឹង 320–1280 × ៦ និង ១២០ ជួរ · ជួរ B ៖ $1234.56 · ជួរ F ៖ COD $987.65 + DOD $245.50 · ជួរ A ៖ COD+DOD+សរុប) +៦ ការអះអាង ៖
  ចំណងជើង = «Locker/តម្លៃ/ចំនួន» · **កណ្តាលជួរឈរ = កណ្តាលតារាង (≤ 1px)** · ចំណងជើង ស្លាក Locker បន្ទាត់តម្លៃនីមួយៗ «កញ្ចប់សរុប» ចំកណ្តាលក្រឡា (≤ 2px) · ប៊ូតុង padding 10px +
  កម្ពស់ ≥ 38px គ្រប់ទទឹង · លុយច្រើនខ្ទង់នៅក្នុងក្រឡា · ចំនួនលុយនៅបន្ទាត់តែមួយ · ប៊ូតុងនៅក្នុងក្រឡាខ្លួន **គ្រប់ទទឹង** (មុន ៖ តែ < 700)។ `main` (មុនកែ) ៖ **FAIL ៥** (ចំណងជើង ·
  ខុសកណ្តាល 8–43px · គម្លាតក្នុងក្រឡា 10–48px · padding 4px នៅ 320 · ប៊ូតុងហៀរនៅ 992) ➜ ក្រោយកែ **១២១/១២១** · mutation (តម្លៃ 6% + សកម្មភាព 45%) ➜ FAIL ៣ (កណ្តាល · លុយហៀរ ·
  «កញ្ចប់សរុប» ត្រូវបាំង) · mutation ខ្សោយ (តម្លៃ 17% ៖ table-layout បែងចែកសល់តាមសមាមាត្រ ➜ នៅកណ្តាល · លុយនៅសម) ➜ PASS (ត្រឹមត្រូវ)។ «បន្ទាត់តែមួយ» ប្តូរ ៖ ខល/បិទ ចាប់ពី 390 ·
  «✏️ កែលេខ» ចាប់ពី 430 (មុន ៖ គ្រប់ទទឹង ដោយការបង្រួម padding) — ការបត់ជាការសម្រេច «ប៊ូតុងទំហំតែមួយ»។
- `parity-dom` អនុវត្ត `INTENTIONAL_UI.texts` ដូច `parity-live`/`parity-deep` ➜ ចំណងជើងថ្មីប្រកាសក្នុងបញ្ជីតែមួយ (ទម្រង់ផ្សេងនៅប្រៀបពេញ)។
- E9 ៖ `zto-list-sync-test` ផ្នែក ២២ +៨ (អត្ថបទជួរផ្ទុយក្នុងចម្លើយ `signed=1` · `withSigned=1` ដាច់ពីគ្នា · `?diag=1` `texts`/`expected` · គ្មាន barcode / «Delivery» ·
  ៧ ប្រភេទ ➜ ចម្លើយ ៥ ដំបូង · diag ៥ ចុងក្រោយ · U+200B នៅដដែល · ៦៤ តួ · ទិសផ្ទុយ ៖ គ្មានជួរផ្ទុយ ➜ គ្មានវាល) ៖ Function មុនកែ **FAIL ៧** ➜ **៥៦៦/៥៦៦** ·
  `tests/zto-signed-mismatch.test.tsx` +២ (បន្ទាត់ ⚠️ ប្រអប់បញ្ជី · 🩺 ៖ «…» + U+… · តម្លៃខូចមិនបោះ) ៖ មុនកែ **FAIL ២** ➜ ១៣/១៣ · ZTO vitest ១០ ឯកសារ ១៧១/១៧១ ·
  `zto-sync-banner-test` ១៩៨ · `health-check-test` ១៦១។
- E11 ៖ `zto-list-sync-test` ផ្នែក ២២ +៣ (អត្ថបទពិត «ចុះ\u200Bហត្ថលេខា» ពីសារ E9 ៖ មានកូដ / គ្មានកូដ ➜ ភស្តុតាង · Cf ផ្សេង ៥ ប្រភេទ · អក្សរបាត់ និងដកឃ្លាធម្មតា ➜ ផ្ទុយ ·
  env «ចុះហត្ថលេខា» (ការកំណត់ពិតលើ Netlify) = env មាន U+200B · «អីវ៉ាន់\u200Bមកដល់» ➜ ជួរដេក) ៖ Function មុនកែ **FAIL ៣** (env «ចុះហត្ថលេខា» ➜ `signed: []` ដូចម្ចាស់គម្រោងឃើញ) ➜
  **៥៧៦/៥៧៦** · ឧទាហរណ៍ «តួអក្សរមើលមិនឃើញនៅដដែល» ក្នុង E9 ប្តូរទៅ «Deliv\u200Bery» (អត្ថបទផ្ទុយពិត)។
- E10 ៖ `zto-list-sync-test` ផ្នែក ២២ (អត្ថបទពិតពី payload ម្ចាស់គម្រោង ៖ លំនាំដើម «签收» · «ចុះហត្ថលេខា» · «Signed» ជាភស្តុតាង · គ្មានកូដ + «签收» ជាភស្តុតាង · «Delivered» ផ្ទុយ ·
  `04` / `-710` «退货扫描» មិនមែន · env `|` (ដកឃ្លា · ទទេ · ស្ទួន) · `off` ➜ កូដតែម្យ៉ាង · «មកដល់» ៣ ភាសា ➜ ជួរដេក ៤ · `03` + «Delivery» ផ្ទុយ · diag `expected` ជាបញ្ជី ·
  តារាង env ក្នុង `ZTO-SETUP-KH.md` = លំនាំដើមក្នុងកូដ) ៖ Function មុនកែ **FAIL ៩** ➜ **៥៧៣/៥៧៣** · `tests/zto-signed-mismatch.test.tsx` (អត្ថបទរំពឹងជាបញ្ជី · string ពី Function ចាស់ ·
  តម្លៃខូច ➜ បញ្ជីទទេ) · `zto-sync-banner-test` ១៩៨។

### [2.50.1] — 2026-10-06 · ZoeW ៖ **ZTO ស្អាត ៖ ការសម្អាត ៧ ថ្ងៃរង់ចាំបញ្ជី «ចុះហត្ថលេខា» (កញ្ចប់ដែលអតិថិជនយករួចលែងត្រូវដកលុយ) · ការបញ្ចូលបញ្ជីសម្រេចដូចការបិទស្វ័យប្រវត្តិ · បញ្ជីចុះហត្ថលេខាវែងអានតាមថ្ងៃ · បិទតាម ZTO លឿនតាមសកម្មភាព (ទោះកំពុងស្កេន) · ប្រភពកញ្ចប់ក្នុងប្រអប់បញ្ជី ZTO · ជួរ «ចុះហត្ថលេខា» អត្ថបទផ្ទុយលែងបាត់ស្ងាត់ · ភស្តុតាងចុះហត្ថលេខាលែងធ្លាក់ក្រោយ Cookie ផុត · របា «ZTO មិនទាន់បិទ» លែងចាស់ · ប្រភពកញ្ចប់ក្នុងប្រវត្តិ (🇨🇳 ចិន · 🇻🇳 វៀតណាម) · ចុច «កញ្ចប់សរុប» បើកបញ្ជី · ប៊ូតុងខល/បិទ និងលេខរៀងលែងជាន់** (ជុំ ZTO ស្អាត · សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.1`** (`zoew-v263` ➜ `zoew-v264`)។ ⛔ ZoeKeyGen · Edge Function **មិនប្រែ** · Firebase rules (Business) + migration Supabase `20261006192639_zoe_rules.sql`
**ប្រែ** (វាល `origins` ក្នុងកញ្ចប់ · សញ្ញាហាង `zoew_settings/zto_signed_sweep` ➜ សកម្មភាពដៃ ១)។ ⛔ តំបន់ ZTO ចាក់សោ ៖ ម្ចាស់គម្រោងអនុញ្ញាតឲ្យកែក្នុងជុំនេះ
(«កែចុះ · ឲ្យ ZTO ស្អាត ហើយចាក់សោ») ➜ `LOCK` ក្នុង `ZoeW/tests/zto-lock.test.ts` ធ្វើបច្ចុប្បន្នភាពរាល់ commit។ ប៉ះ `src/features/zto-status.ts`
(`ztoAbandonCleanupIsHeld()` · `ztoOldestOpenStamp()` · `ztoSignedSweepRange()` · `closeZtoSignedBarcodes()`) · `src/features/zto-list-sync.ts` (`ztoListReasonIsDefinitive()` · `ztoPickupVerdictOf()` · `ztoListSignedVerdict()`) ·
`src/domain/cleanup.ts` (`runAutomaticCleanupRules()`) · `src/core/state.ts` · ល្បឿន ៖ `zto-status.ts` (`ztoSignedSweepCadenceMs()` · `noteZtoUserActivity()` ·
`ztoSignedNetworkAllowed()` · `ztoSignedLivePollWanted()` · `runZtoStatusSweep()`) · `src/app/lifecycle/boot.ts` · Function `listPlan()` · ប្រភព ៖ Function `projectListRow()` ·
`classifyZtoListRows()` · `src/app/components/zto/model.ts` · E4 ៖ Function `listRowSignedVerdict()` · `src/features/health-check.ts` (`ztoSignedMismatchText()`) ·
ប្រភពក្នុងប្រវត្តិ ៖ `src/features/barcode-origin.ts` (ថ្មី ៖ `originLabel()` · `itemOriginSummary()` · `saveBarcodeOrigins()`) · `importZtoListRows()` ·
`src/app/components/history/HistoryRow.tsx` · `rowModel.ts` · `barcode/BarcodeListContainer.tsx` · `zto/ZtoListSyncBody.tsx` · `features/barcode-ops.ts` · `styles/react-root.css` ·
`firebase-database.rules.json`។

#### អ្វីដែលខុសពីមុន

- 💰 **ZTO-E1 ៖ ការសម្អាត ៧ ថ្ងៃរង់ចាំបញ្ជី «ចុះហត្ថលេខា»** ៖ ពេល «បិទតាម ZTO ស្វ័យប្រវត្តិ» បើក ហើយ Lookup ជា ZTO ➜ កញ្ចប់បើកអាយុលើស ៧×២៤ ម៉ោង **មិនចូលធុងសំរាម
  (`expired` · ដកលុយ)** រហូតដល់ App អានបញ្ជី «ចុះហត្ថលេខា» របស់ ZTO បានពេញលេញ (ថ្មីៗ ≤ ១០ នាទី) ➜ កញ្ចប់ក្នុងបញ្ជី ➜ បិទ «យករួច» (លុយមិនដក · ចូលធុងសំរាម ២ ម៉ោងក្រោយ) ·
  កញ្ចប់ក្រៅបញ្ជី ➜ ផុតកំណត់ដូចមុន។ មុនកែ ៖ បើក App ក្រោយបិទច្រើនថ្ងៃ ➜ ការសម្អាតរត់ភ្លាមពេលប្រវត្តិមកដល់ (មុនជុំបិទតាម ZTO ~១.៥ វិ.) ➜ កញ្ចប់ដែលអតិថិជនយករួចត្រូវ **ដកលុយ**។
  ZTO មិនឆ្លើយ/ព្យួរ/PIN ចាក់សោ ➜ រង់ចាំយូរបំផុត **៣០ នាទី** ក្នុងមួយវគ្គ រួចដើរធម្មតា · Server បិទបញ្ជីចុះហត្ថលេខា ឬគណនីគ្មានសាខា ➜ មិនរង់ចាំ ·
  ការអានដំបូងក្រោយបាត់យូរ គ្របថ្ងៃបង្កើតកញ្ចប់បើកចាស់បំផុត (≤ ៣០ ថ្ងៃ · មុន ៖ ៧ ថ្ងៃ ➜ កញ្ចប់ដែលចុះហត្ថលេខាមុនថ្ងៃទី ៧ មិនដែលឃើញ) ហើយជួរនោះនៅដដែលរហូតជុំពេញលេញ
  (ជុំដែលនៅសល់កញ្ចប់ត្រូវបិទ ➜ ជុំបន្ទាប់អានជួរដដែល · មុនកែ ៖ ជួររួមតូចទៅ ១ ថ្ងៃភ្លាម ➜ កញ្ចប់ទី ១១ ឡើងទៅមិនឃើញ ➜ ដកលុយ)។
  ⛔ ការសម្អាត ២ ម៉ោង (`pickup`) មិនរង់ចាំ · ⛔ ថេរ `ABANDON_AGE_MS` · `>` · ២ ថ្ងៃ · ៣០ ថ្ងៃ មិនប្រែ · កុងតាក់បិទ ➜ ដូចមុនទាំងស្រុង។
- 🔒 **ZTO-E2 ៖ ការបញ្ចូលបញ្ជី ZTO សម្រេចដូចការបិទស្វ័យប្រវត្តិ** ៖ barcode ដែលមានក្នុងបញ្ជី «ចុះហត្ថលេខា» (05) = យករួច **ទោះជួរដេក ZTO ឬ `/detail` ថា «មិនទាន់បិទ»**
  (លំដាប់ ៖ ភស្តុតាងចុះហត្ថលេខា ➜ `/detail` ➜ ជួរដេក · `ztoPickupVerdictOf()`)។ មុនកែ ៖ ជួរដេក `false` ឈ្នះភស្តុតាង ➜ «➕ បញ្ចូល» បញ្ចូលជា «មិនទាន់យក» (ក្មេង) ·
  រំលង «ចាស់ ហើយ ZTO មិនទាន់បិទ» (ចាស់) · មិនបិទកញ្ចប់បើកក្នុង ZoeW ➜ ជុំបិទតាម ZTO បិទវា ~២ នាទីក្រោយ (ទ្វារពីរសម្រេចផ្ទុយគ្នា)។ ឥឡូវ ៖ ក្មេង ➜ កើតមកជា
  «យករួច» · ចាស់ ៨–៣០ ថ្ងៃ ➜ «យករួច» (COD លើថ្ងៃមកដល់ ZTO · មិនដក) · មានក្នុង ZoeW ហើយបើក ➜ «បញ្ចូល» បិទ (គោរពកុងតាក់)។ ⛔ ហួសអាយុធុងសំរាម ➜ នៅរំលង
  (ពិនិត្យស្ទួនមិនបាន) · គ្មានភស្តុតាង ➜ ដូចមុន។
- 📚 **ZTO-E3 ៖ បញ្ជី «ចុះហត្ថលេខា» វែងលើសពិដានទំព័រ (៣ × ១០០)** ៖ មុនកែ ៖ ជុំបិទតាម ZTO អានតែទំព័រ ១–៣ ហើយស្ងាត់ ➜ កញ្ចប់ដែលនៅក្រៅទំព័រ ៣ មិនដែលបិទតាមបញ្ជី
  (ZTO តម្រៀបពីចាស់ទៅថ្មី ➜ អ្វីដែលបាត់ = **ការចុះហត្ថលេខាថ្មីៗ**)។ ឥឡូវ ៖ បញ្ជីវែង ➜ អានម្តងទៀតតាមថ្ងៃ (៣ ថ្ងៃព្រមគ្នា · Function `signed=1` គោរពជួរដែលសុំ) ·
  ថ្ងៃមួយនៅតែលើសពិដាន ➜ toast «⚠️ បញ្ជី «ចុះហត្ថលេខា» ZTO វែងពេក …» ម្តងក្នុងមួយវគ្គ · ចន្លោះទ្វេ · ការសម្អាត ៧ ថ្ងៃរង់ចាំតាមពិដាន (E1)។ ការហៅធម្មតានៅ ១ សំណើ។
- ⚠️ **ZTO-E4 ៖ ជួរ «ចុះហត្ថលេខា» ដែលអត្ថបទប្រភេទស្កេនផ្ទុយ លែងបាត់ស្ងាត់** ៖ ជួរកូដ `05` តែ `scanTypeDesc` ខុសពី `ZTO_LIST_SIGNED_SCAN_DESC` (ឧ. ZTO ប្តូរភាសា)
  នៅតែមិនមែនភស្តុតាង (ច្បាប់ជាន់ ២ ដដែល) តែឥឡូវ ៖ ប្រអប់បញ្ជីប្រាប់ «⚠️ ZTO ផ្ញើជួរ «ចុះហត្ថលេខា» N ជួរ …» · 🩺 ជួរ ZTO ✅ ➜ ⚠️ (Cookie បដិសេធនៅ ❌) · `?diag=1` ➜
  `list.signedMismatch` (`observed` · `count` · `ageMs` · គ្មានអត្ថបទ ZTO) · 💰 ការអានដែលមានជួរផ្ទុយ **មិនពេញលេញ** ➜ ការសម្អាត ៧ ថ្ងៃនៅរង់ចាំ (E1 · ពិដាន ៣០ នាទី)។
  មុនកែ ៖ ZTO ប្តូរអត្ថបទ ➜ ជួរចុះហត្ថលេខាទាំងអស់បាត់ស្ងាត់ ➜ បិទតាម ZTO ឈប់ ហើយការសម្អាត ៧ ថ្ងៃដកលុយកញ្ចប់ដែលយករួច ដោយគ្មានសញ្ញាណាមួយ។
- 🔑 **ZTO-E5 ៖ ភស្តុតាង «ចុះហត្ថលេខា» លែងធ្លាក់ក្រោយ Cookie ផុត** (Function) ៖ Cookie ក្នុងសតិ Function ផុត ហើយ Sync Cookie ថ្មីរួច ➜ ZTO បដិសេធទាំងបញ្ជីមកដល់ និងបញ្ជី
  «ចុះហត្ថលេខា» ដែលភ្ជាប់ ➜ Function អាន Cookie ថ្មី ហើយសាកតែ «មកដល់» ➜ មុនកែ ៖ ប្រអប់ «⚠️ ទាញបញ្ជីចុះហត្ថលេខា ZTO មិនបាន» ➜ កញ្ចប់ដែលយករួចចូលជា «មិនទាន់យក»។
  ឥឡូវ ៖ សំណើ «ចុះហត្ថលេខា» ដែលត្រូវបដិសេធដោយ 401 ដដែល រត់ម្តងទៀត ១ ដងដោយ Cookie ថ្មី (ក្នុងថវិកា ១០ វិ. ដដែល)។
- 🟨 **ZTO-E6 ៖ របា «ZTO មិនទាន់បិទ» លែងចាស់** ៖ កញ្ចប់ដែលបិទក្នុង ZoeW មុនស្កេនចុះហត្ថលេខាលើ ZTO Palm (សាលក្រម `/detail` = «មិនទាន់») ➜ មុនកែ ៖ នៅលើរបា
  **៤០ នាទី** ក្រោយ ZTO ចុះហត្ថលេខា (វាស់ · `/detail` មិនសួរវាម្តងទៀតរហូតម៉ោងពិនិត្យឡើងវិញ) ➜ ឥឡូវ ៖ ការអានបញ្ជី «ចុះហត្ថលេខា» ដដែលរកវាឃើញ ➜ ចេញពីរបាក្នុង ~២០ វិ.
  (កំពុងប្រើ) ដោយគ្មាន `/detail` ថែម · ជុំដែលគ្មានកញ្ចប់បើក មិនរាប់ជា «ពេញលេញ» សម្រាប់ការសម្អាត ៧ ថ្ងៃ (E1)។
- 🔁 **ការផ្ទៀងផ្ទាត់ ZTO ឡើងវិញ (សំណើម្ចាស់គម្រោង)** ៖ (k1) 🩺 «ZTO ផ្ញើ N កញ្ចប់ …» រាប់ barcode ផ្សេងៗគ្នា (មុន ៖ បូករាល់ការអាន ➜ លេខកើនរហូត ២ កញ្ចប់ ➜ «១០») ·
  (k2) «មកដល់» សាកឡើងវិញធ្លាក់ (429/5xx) ➜ Function ឆ្លើយភ្លាម (មុន ៖ រង់ចាំសំណើ «ចុះហត្ថលេខា» ថ្មីដែលលទ្ធផលត្រូវបោះចោល) · (k4) ពេលមានតែរបា
  «ZTO មិនទាន់បិទ» (គ្មានកញ្ចប់បើក) ការអានបញ្ជីគ្របតែម្សិលមិញ ➜ ថ្ងៃនេះ (មុន ៖ ៧ ថ្ងៃ · រហូត ៣ ទំព័រ រៀងរាល់ ២០ វិ.) · (k5) របាប្តូរ «បិទ» ដែរ ពេលជុំត្រូវកាត់ ឬការអានមិនគ្រប់។
- ⚡ **ល្បឿន «បិទតាម ZTO» (របាយការណ៍ម្ចាស់គម្រោង ៖ «យឺត អត់ស្ថេរភាព» · ជម្រើស «ឆ្លាតវៃ»)** ៖ ពេលមានកញ្ចប់បើក ZoeW អានបញ្ជី «ចុះហត្ថលេខា» រៀងរាល់ **២០ វិ.** ពេលកំពុងប្រើ
  (ប៉ះអេក្រង់ · គ្រាប់ចុច/scanner ក្នុង ៥ នាទីចុងក្រោយ) · **១ នាទី** ពេលបើកទុកចោល · **២ នាទី** ពេល App នៅខាងក្រោយ (កូតា Netlify ៖ ឧបករណ៍កំពុងប្រើ ~១៨០ ការហៅ/ម៉ោង ·
  ទុកចោល ~៦០ · ខាងក្រោយ ~៣០)។ ការអាននេះ **ដើរទោះប្រអប់ស្កេនបើក** (មុនកែ ៖ ជុំទាំងមូលរំលងពេលប្រអប់បើក ហើយគ្មានម៉ោងសាកឡើងវិញ ➜ ស្កេនជាប់ = **មិនដែលបិទ**) ·
  ក្រៅបណ្តាញ · Data Saver · Lookup កំពុងរត់ ➜ រង់ចាំ ហើយសាកវិញ · ការសួរម្តងមួយកញ្ចប់ (`/detail`) នៅមិនដើរពេលប្រអប់បើកដដែល · ZTO ធ្លាក់ ➜ ចន្លោះទ្វេពិដាន **១០ នាទី**
  (មុន ៣០ នាទី) · Function ៖ cache `signed=1` ≤ **១៥ វិ.** (មុន ៦០ វិ. ➜ ជុំ ២០ វិ. ទទួលចម្លើយចាស់)។ វាស់ (timer ក្លែង · ចុះហត្ថលេខា ➜ ZoeW បិទ) ៖

  | ស្ថានភាព | មុនកែ | ឥឡូវ |
  |---|---|---|
  | កំពុងប្រើ | ៩២ វិ. | **១៣ វិ.** |
  | កំពុងស្កេន (ប្រអប់បើក ២៥ វិ. ក្នុង ៣០ វិ.) | **មិនដែល** (៤៥ នាទី) | ១៣–៣២ វិ. |
  | បើកទុកចោល | ៩២ វិ. | ៣២ វិ. |
  | App នៅខាងក្រោយ | ៩២ វិ. | ៩២ វិ. |
  | ZTO ធ្លាក់ ៣៥ នាទី រួចវិញ | ១៤៤២ វិ. | ៤៨២ វិ. |
- 📍 **ប្រភពកញ្ចប់** (សំណើម្ចាស់គម្រោង ៖ «ដឹងថាកញ្ចប់មកពីចិន វៀតណាម» · «ដាក់ប្រភពកញ្ចប់ក្នុងប្រវត្តិផង … មិនរញ៉េរញ៉ៃ» · ផែនទី ៖ «ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ = ចិន ·
  Shopee SHPE = វៀតណាម») ៖ Function ផ្ញើ `from` (`recSite` ➜ `customerCodeDesc`) ក្នុងជួរដេកបញ្ជី · ZTO **គ្មានវាលប្រទេស** (`countryCode: null` គ្រប់ payload ពិត) ➜
  ZoeW ប្តូរតែ ២ កន្លែងដែលម្ចាស់គម្រោងកំណត់ (`ORIGIN_COUNTRIES`) ➜ 🇨🇳 ចិន · 🇻🇳 វៀតណាម · កន្លែងផ្សេង ➜ «📍 ឈ្មោះ» (មិនទាយ)។ ប្រអប់បញ្ជី ZTO ៖ ជួរដេកនីមួយៗ
  (barcode · លេខ/លុយ/ម៉ោង · ប្រភព · សម្គាល់ ជាបន្ទាត់ដាច់ៗ)។ «➕ បញ្ចូល» ➜ រក្សាទុក `origins/<barcodeRegistryKey>` ក្នុងកញ្ចប់ (កញ្ចប់ថ្មី និងកញ្ចប់ដែលមានរួច ➜
  toast «📍 បំពេញប្រភព N កញ្ចប់» ពេលគ្មានកញ្ចប់ថ្មី) តាម `runTransaction` មួយក្នុងមួយកញ្ចប់ (កញ្ចប់បាត់ · កំពុងស្តារ · `clearClaim` ➜ មិនសរសេរ · មិនបង្កើត «ខ្មោច») ·
  ការសរសេរដាច់ពីការរក្សាទុកកញ្ចប់ ➜ rules ចាស់បដិសេធ ➜ ការបញ្ចូលនៅជោគជ័យ ហើយ App ឈប់សាកលើ database នោះ (`ztoOriginRefusedDb`)។
  តារាងប្រវត្តិ ៖ ប្រភពជាស្លាកមួយក្រោមលេខទូរស័ព្ទ (ទង់ + ឈ្មោះ · វែង ➜ «…» · «+N» = ប្រភពច្រើន) · ចុច **«កញ្ចប់សរុប»** ➜ ប្រអប់បញ្ជី barcode (ប្រភពនីមួយៗ) ·
  ប៊ូតុង «📦 បញ្ជី» ដកចេញ (សំណើម្ចាស់គម្រោង ៖ «ដកប៊ូតុងបញ្ជីចេញ ដោយជំនួសការបើកមើលបញ្ជីតាមការចុចលើកញ្ចប់សរុប») ➜ ជួរដែលគ្មានប្រភពទាបជាងមុន ១ បន្ទាត់។
- 💰 **ការរង់ចាំការសម្អាត ៧ ថ្ងៃ (E1) ការពារពិតប្រាកដ** (ការផ្ទៀងផ្ទាត់ឡើងវិញ · មានតាំងពីមុន ឬ E1 មិនទាន់គ្រប់) ៖ (M1) ការបិទតាមបញ្ជី «ចុះហត្ថលេខា» ដែលបរាជ័យម្តង
  (បណ្តាញ · Server បដិសេធ) ➜ មុនកែ ៖ ជុំរាប់ថា «ពេញលេញ» ហើយការសម្អាតដកលុយកញ្ចប់នោះ ១ នាទីក្រោយ (មិនដែលសាកបិទម្តងទៀត ១ ម៉ោង) ➜ ឥឡូវ ៖ ជុំមិនពេញលេញ · សាកបិទម្តងទៀតក្រោយ
  ២ នាទី · (M3) ការអានបញ្ជី **មុន** កញ្ចប់គ្រប់ ៧×២៤ ម៉ោង លែងដោះលែងការសម្អាត (មុនកែ ៖ ត្រឡប់ពី background ក្នុង ១០ នាទី ឬវដ្ត ១ នាទី ➜ កញ្ចប់ដែលចុះហត្ថលេខាក្រោយការអាន
  ត្រូវដកលុយ) ➜ ត្រូវការការអានក្រោយពេលទុំ · (R1) ហេតុផលអត្តសញ្ញាណបណ្តោះអាសន្ន (token ផុត · Supabase មិនឆ្លើយ) ➜ សាកឡើងវិញតាមចន្លោះទ្វេ (មុនកែ ៖ រង់ចាំ ៣០ នាទី
  ស្មើពិដាន ➜ ការរង់ចាំអស់មុនការអានម្តងទៀត ➜ ដកលុយ) · (M2) **ការរង់ចាំជាច្បាប់ទូទាំងហាង** ៖ មុនកែ ៖ ការកំណត់ ZTO នៅលើឧបករណ៍នីមួយៗ ➜ ទូរស័ព្ទផ្សេងក្នុងហាង
  ដែលមិនបើក ZTO ដកលុយកញ្ចប់ដែលអតិថិជនយករួចភ្លាម ➜ ឥឡូវ ៖ ឧបករណ៍ ZTO ទុកសញ្ញាក្នុង database ហើយទូរស័ព្ទផ្សេងរង់ចាំដូចគ្នា (យូរបំផុត ៣០ នាទីក្នុងមួយលើក)។
- 📶 **«បិទតាម ZTO» សន្សំការហៅ ហើយលឿនតាមឯកសារ** (ការផ្ទៀងផ្ទាត់ឡើងវិញ) ៖ ជួរ «ចុះហត្ថលេខា» ផ្ទុយមួយលែងធ្វើឲ្យអានជួរ ៨ ថ្ងៃរៀងរាល់ ២០ វិ. · បញ្ជីវែងលែងអាន
  ទំព័រ ១–៣ ទាំងមូលម្តងទៀតរាល់ការអាន · ហាងមានកញ្ចប់លើស ៣០០ លែងសួរ ZTO ម្តងមួយកញ្ចប់វិលជុំគ្មានទីបញ្ចប់ · ចាប់ផ្តើមប្រើក្រោយទុកចោល ➜ អានក្នុង ~២០ វិ.
  (មិនរង់ចាំ ១ នាទី) · ការអានបញ្ជីលែងជាប់ការរង់ចាំ ១០ នាទីរបស់ការសួរម្តងមួយកញ្ចប់ (កំពុងស្កេន · App នៅខាងក្រោយ)។
- 🔎 **ZTO-E7 ៖ ចម្លើយ Lookup ដែលមកដល់ពេលប្រអប់លេខទូរស័ព្ទកំពុងរក្សាទុក** (k6 · k7) ៖ ក្រោយចុច «យល់ព្រម» ឬ «រំលង» ចម្លើយ ZTO ដែលមកដល់ពេលកំពុងរក្សាទុក **មិនសរសេរចូល form · មិនបង្ហាញ ✅ · មិនរក្សាទុកម្ដងទៀត** ទេ ➜ App ទុកវាដាច់ដោយឡែកសម្រាប់ barcode នោះ។ ប្រអប់នៅបើកក្រោយការព្យាយាម (ពិនិត្យស្ទួនមិនបាន · រក្សាទុកមិនបាន) ➜ ចម្លើយដែលទុកបំពេញ field ដែលនៅទទេ ដូច្នេះចុចម្ដងទៀតរក្សាទុកតម្លៃរបស់ ZTO · រក្សាទុករួច ហើយ COD/DOD របស់ ZTO (មិនមែនសូន្យ) ខុសពីតម្លៃដែលបានរក្សាទុក ➜ toast «⚠️ ZTO បង្ហាញ COD X · DOD Y — កញ្ចប់ (…) បានរក្សាទុកតាមតម្លៃដែលបានបញ្ចូល … កែទឹកប្រាក់បានតាម «កែតម្លៃកញ្ចប់»» ម្ដង (⛔ App មិនប្ដូរលុយដែលបានរក្សាទុកដោយខ្លួនឯង)។ មុនកែ ៖ (k6) បើក «រក្សាទុកស្វ័យប្រវត្តិ» + ចុច «រំលង» ➜ ចម្លើយមកយឺតហៅការរក្សាទុកលើកទី ២ ➜ claim ទី ២ = «ត្រូវបានបញ្ចូលរួចហើយ … សូមស្កេនម្ដងទៀត» + ប្រអប់បិទមុនពេល រួចមាន «✅ រក្សាទុកបានជោគជ័យ!» (toast ផ្ទុយគ្នា) · (k7) គ្មានរក្សាទុកស្វ័យប្រវត្តិ ➜ COD/DOD របស់ ZTO លេចក្នុង form + «✅ បានទាញយកទិន្នន័យអតិថិជនស្វ័យប្រវត្តិ!» ខណៈការរក្សាទុកប្រើតម្លៃមុនចុច (ច្រើនតែ 0/0)។ ចម្លើយមកមុនចុច ➜ ដូចមុន (បំពេញ form · រក្សាទុកស្វ័យប្រវត្តិម្ដងជាមួយតម្លៃ ZTO)។ ចម្លើយដែលទុកត្រូវសម្អាតពេលបិទប្រអប់ · ស្កេនថ្មី · ចាកចេញ · ចាប់ផ្ដើមការរក្សាទុកនីមួយៗ។ អ្នកយាម ៖ `ZoeW/tests/lookup-late-answer-busy.test.ts` · `setup-link-logout-test`។ សកម្មភាពដែលត្រូវធ្វើដោយដៃ ៖ គ្មាន (ការផ្ទៀងផ្ទាត់លើទូរស័ព្ទ ៖ ស្កេនកញ្ចប់ ZTO ចុច «រំលង» ភ្លាមមុន ZTO ឆ្លើយ ➜ គ្មានសារ «ត្រូវបានបញ្ចូលរួចហើយ» · មានសារ ⚠️ COD/DOD ZTO ម្ដង)។
- **ស្កេន Lookup ៖ ការនាំចូល Sheet ដែលបញ្ចប់ពីក្រោយ មិនបោះចោល Lookup ដែលកំពុងរត់ទៀតទេ** — ពីមុន ការបិទផ្ទាំង «នាំចូល Excel ទៅ Sheet» មិនបញ្ឈប់ការនាំចូលទេ ហើយលទ្ធផលមកដល់ពេលកំពុងស្កេន។ `seedCustomerTableFromImport()` ដំឡើងលេខជំនាន់វគ្គ ដូច្នេះ `attemptAutoLookup()` បោះចោលចម្លើយដែលត្រឹមត្រូវ ហើយស្ថានភាពជាប់ «🔎 កំពុងស្វែងរក…» រហូត (លេខទូរស័ព្ទ/COD មិនបំពេញ)។ ឥឡូវ ការនាំចូលដំឡើងតែជំនាន់នៃការទាញតារាង (`customerDataTableFetchGeneration`)។ ការចាកចេញ ការប្ដូរ Config និងការប្ដូរ backend (`clearCustomerDataTableCache()`) ដំឡើងជំនាន់ទាំងពីរ ហើយនៅតែបោះចោលចម្លើយចាស់ ប៉ុន្តែប្រាប់ «⚠️ API/ZTO ត្រូវបានកំណត់ឡើងវិញ — សូមស្កេនម្ដងទៀត» ជំនួសការជាប់ loading (លុះត្រាតែគ្មាន Lookup ថ្មីសម្រាប់ barcode ដដែលកំពុងរត់)។ **សកម្មភាពដោយដៃ៖** គ្មាន (មិនប៉ះ rules · Netlify · Apps Script)។ សូមសាកលើឧបករណ៍ពិត៖ ចាប់ផ្ដើមនាំចូល Sheet → បិទផ្ទាំង → ស្កេន barcode ភ្លាម → ពេលការនាំចូលបញ្ចប់ Lookup ត្រូវតែបំពេញលេខទូរស័ព្ទ/COD។
- 🔎 **ZTO-E7 k9 ៖ Barcode ក្រៅទម្រង់ ZTO ឈប់នៅ App** ៖ Lookup ZTO ពិនិត្យទម្រង់ barcode (ច្បាប់តែមួយជាមួយ `BARCODE_RE` របស់ Function ៖ អក្សរ/លេខ/`_`/`-` ៦–៦៤ តួ) ក្រោយ cache ហើយមុនច្រក PIN/ក្រៅបណ្ដាញ/cooldown ➜ ក្រៅទម្រង់ ➜ «⚠️ Barcode នេះមិនមែនទម្រង់ ZTO — សូមបញ្ចូលព័ត៌មានដោយដៃ» · គ្មានការហៅ Function · គ្មាន cooldown · គ្មាន Sentry។ មុនកែ ៖ Function បដិសេធ 400 `ZTO_BARCODE_INVALID` ➜ App បង្ហាញ «⚠️ មិនអាចភ្ជាប់ ZTO បាន — សូមស្កេនម្ដងទៀត» + cooldown ៦ វិ. + Sentry «HTTP 400» · APK ហៅ Function **២ ដង** (ផ្លូវ header រួច URL ចាស់)។ Function នៅតែឆ្លើយ `ZTO_BARCODE_INVALID` ➜ សារដដែល · សាលក្រមស្ថាពរ (៣០ វិ.) · គ្មាន Sentry។ APK ៖ 400 ពី Function ចាស់ដែលមិនស្គាល់ `X-Zoe-Query` (barcode ត្រឹមត្រូវ) នៅតែសាក URL ចាស់ ហើយចងចាំដូចមុន។ ⛔ Apps Script · API ផ្ទាល់ខ្លួន មិនពិនិត្យទម្រង់ ZTO។ សកម្មភាពដោយដៃ ៖ គ្មាន (Function · rules · migration មិនប្រែ)។
- **ZTO ស្កេន ៖ លេខទូរស័ព្ទដាក់កន្លែងលែងបញ្ចូលកញ្ចប់អ្នកដទៃចូលគ្នា (E7 k10 · សំណើម្ចាស់គម្រោងជុំ ZTO)** — ពេល ZTO ឆ្លើយលេខទូរស័ព្ទដាក់កន្លែង (`0` · `000` · `0-0` …) Function ទម្លាក់វាដូចផ្លូវទាញបញ្ជី (`phoneIsPlaceholder()` តែមួយ) ➜ App បំពេញតែ COD/DOD មិនរក្សាទុកស្វ័យប្រវត្តិ · អ្នកប្រើវាយលេខ ឬចុច «រំលង» (រក្សាទុក «គ្មានលេខ» ដែលមិនដែលបញ្ចូលគ្នា)។ លេខដាក់កន្លែងគ្មាន COD/DOD ➜ «រកមិនឃើញ»។ ឯកសារសោ ZTO ៖ `zto-order-detail.js` (sha256 ថ្មីក្នុង `LOCK`)។
  **សកម្មភាពដៃ** ៖ ១. Deploy គេហទំព័រ Netlify `zoew` (Function ប្តូរ ➜ ត្រូវ deploy ទើបមានប្រសិទ្ធភាព)។ ២. ពិនិត្យប្រវត្តិថ្ងៃថ្មីៗ ៖ ជួរដែលមាន phone `0` (ឬ `000`) ហើយ «ចំនួន» > ១ អាចជាកញ្ចប់របស់អតិថិជនច្រើននាក់ដែលបានបញ្ចូលគ្នាពីមុន ➜ កែលេខ/បំបែកដោយដៃ (ទិន្នន័យចាស់មិនត្រូវកែស្វ័យប្រវត្តិ)។ ៣. លើទូរស័ព្ទ ៖ ស្កេនកញ្ចប់ ZTO ដែលគ្មានលេខអ្នកទទួល ➜ ប្រអប់នៅបើក មាន COD តែ phone ទទេ ➜ «រំលង» ➜ ជួរ «គ្មានលេខ» ថ្មីមួយក្នុងមួយកញ្ចប់។
- 🔒 **តំបន់ ZTO ចាក់សោពង្រីក** ៖ `src/features/auto-lookup.ts` · `src/features/lookup-api.ts` (ផ្លូវស្កេន Lookup ZTO ដែល E7 កែ) ចូល `LOCK` ក្នុង `ZoeW/tests/zto-lock.test.ts`។
- 🧱 **ជួរប្រវត្តិលែងជាន់គ្នា** (របាយការណ៍ម្ចាស់គម្រោងពីរូបថត ៖ «ប៊ូតុង ខល នៅពីលើ កញ្ចប់សរុប») ៖ មុនកែ ៖ ប៊ូតុង «ខល/បិទ» (`white-space: nowrap` · padding 12px)
  ធំជាងក្រឡារបស់វា ➜ ហៀរទៅឆ្វេង ហើយជាន់ «កញ្ចប់សរុប» **22×21px នៅ 320 · 10×20 នៅ 360 · 5×20 នៅ 375** · ស្លាកលេខរៀងពណ៌ (`min-width: 20px` ក្នុងជួរឈរ 6%) ជាន់លេខទូរស័ព្ទ
  ១–៤px (លេខ ៣ ខ្ទង់ ៖ គ្រប់ទទឹង 320–1100 លើកលែង 768)។ ឥឡូវ (`react-root.css`) ៖ ទូរស័ព្ទ (< 700) ៖ padding ប៊ូតុង 4px ➜ 12px តាមទទឹងអេក្រង់ (កម្ពស់ 38px · អក្សរដដែល ·
  ≥ 480px ដូចដើម) + បត់ជួរជាការការពារចុងក្រោយ (តែជួរ «✏️ កែលេខ» នៅ ≤ 340px) · ក្រឡាលេខរៀង ៖ មិនបំបែកលេខ · padding 2px · ស្លាកគ្មាន `min-width` · ទូរស័ព្ទ អក្សរ 9.5 ឯកតា ·
  ≥ 992 ៖ ជួរឈរលេខរៀង 5% (អតិថិជន 29%)។ desktop ៩៩២–១០៦០ ៖ ប៊ូតុងហៀរចេញពីក្រឡាខ្លួនចូលកន្លែងទំនេរ (មានតាំងពីមុន) — វាស់ ៖ **គ្មានការជាន់** ➜ មិនប្តូរ។

#### អ្នកយាម

- `ZoeW/tests/zto-abandon-signed-gate.test.tsx` (២២) ៖ tree មុនកែ (`main` `b2868e1`) **ធ្លាក់ ១៩** (assertion ១៤ · function មិនមាន ៥) · ឆ្លង ៣ (ទិសផ្ទុយ)
  — វាស់ឡើងវិញ (ការផ្ទៀងផ្ទាត់ឡើងវិញ T6 ៖ លេខ «ធ្លាក់ ១២ · ទិសផ្ទុយ ៤» ពីមុនវាស់ឡើងវិញមិនបាន)។ mutation ២២/២២ ត្រូវសម្លាប់ (ផ្នែក ២)។
- E2 ៖ `ZoeW/tests/zto-signed-sync.test.tsx` (២៧ · តេស្ត «false ឈ្នះភស្តុតាង» ត្រឡប់ + ៥ ថ្មី) ៖ tree មុនកែ (`76a0fec`) **ធ្លាក់ ៦** · `zto-list-sync-test` ៤៤៣ ok
  (មុនកែ **៧ FAIL** ៖ ៥ E2 + ២ ជាន់អប្បបរមា) · mutation ៦/៦ ត្រូវសម្លាប់ (ផ្នែក ២)។
- E8 ៖ `zto-list-sync-test` ផ្នែក ២២ ៖ payload ពិត ៣ (តម្លៃផ្ទាល់ខ្លួនប្តូរជាក្លែង) ឆ្លង Function ពិត ➜ ២៤ ok (ជួរដេកមកដល់តែមួយ · COD/DOD · `ztoClosed: null` ·
  ភស្តុតាង 05 · ការរាប់គ្រប់ · ឈ្មោះសាខា · លេខទូរស័ព្ទ ៣ ទម្រង់ · `signed=1`)។
- E3 ៖ `ZoeW/tests/zto-signed-truncation.test.tsx` (៦) ៖ tree មុនកែ (`22f3d23`) **ធ្លាក់ ៥** (ទិសផ្ទុយ «១ សំណើ» បៃតង) · `zto-list-sync-test` ៤៤៤ ok (មុនកែ **១ FAIL** ៖
  `signed=1` ពង្រីកដល់ថ្ងៃនេះ) · mutation ១០/១០ ត្រូវសម្លាប់។
- sandbox `partial-pickup-cleanup-test` · `cleanup-clock-guard-test` ៖ stub `ztoAbandonCleanupIsHeld()` = `false` (គ្មាន ZTO = ឥរិយាបថពិត) · `clock-hygiene` ៖ ហេតុផល
  `Date.now()` សម្រាប់ពិដានរង់ចាំ។
- ល្បឿន ៖ `ZoeW/tests/zto-signed-cadence.test.tsx` (១៤) ៖ tree មុនកែ (`8283545`) **ធ្លាក់ ១៣** (ទិសផ្ទុយ «ក្រៅបណ្តាញ · Data Saver» បៃតងទាំងពីរ) · `zto-list-sync-test` +៤
  (cache `signed=1` ផុត ១៦ វិ. · នៅ ៥ វិ. · បញ្ជីធម្មតានៅ ១៦ វិ. · `?diag=1` `signedCacheTtlMs`) · `zto-sync-banner-test` +៤ (App ពិត ៖ `pointerdown` · `keydown` ➜ ល្បឿនសកម្ម ·
  ការរមូរមិនរាប់ · សកម្មភាពចាស់ ➜ ល្បឿនធម្មតា) · `clock-hygiene` ៖ ហេតុផល `noteZtoUserActivity()` · mutation ២៦/២៦ ត្រូវសម្លាប់ (ផ្នែក ២)។
- E4 (អនុវត្តដោយ workflow agent · ពិនិត្យ និងបញ្ចូលក្នុង session) ៖ `ZoeW/tests/zto-signed-mismatch.test.tsx` (១១ · tree មុនកែធ្លាក់ ១០) · `zto-list-sync-test` ផ្នែក ២២
  (មុនកែ ១១ FAIL) · `health-check-test` · mutation ៣៦/៣៧ (១ សមមូល) · ការបញ្ចូល ៖ ផ្លូវអានតាមថ្ងៃ (E3) ផ្ទុក `signedMismatch` (មិនរាប់ស្ទួន) · `zto-abandon-signed-gate` +១
  (ជួរផ្ទុយ ➜ មិនពេញលេញ · ទិសផ្ទុយ ➜ ពេញលេញ) · mutation ៣/៣ ត្រូវសម្លាប់។
- E5 (workflow agent · ពិនិត្យ និងបញ្ចូលក្នុង session) ៖ `zto-list-sync-test` ផ្នែក ២៣ (handler ពិត · store មាន Cookie ថ្មី · upstream ទទួលតែ Cookie ថ្មី) ៖ tree មុនកែ
  **៨ FAIL** · mutation ១២/១២ + ៣/៣ លើ tree បញ្ចូល (មិនសាក · មិនយកលទ្ធផលសាក · សាកលើការធ្លាក់ផ្សេង) ត្រូវសម្លាប់។
- E6 (workflow agent · ពិនិត្យ និងបញ្ចូលក្នុង session) ៖ `ZoeW/tests/zto-stale-bar.test.tsx` (១៦ · tree មុនកែធ្លាក់ ១១) · ការបញ្ចូល ៖ តេស្ត «ប្រអប់បើក ➜ មិនអាន» ប្តូរទៅ
  ច្បាប់ល្បឿន (ប្រអប់បើក ➜ អាន · `/detail` មិនហៅ) + «ក្រៅបណ្តាញ ➜ មិនអាន» · timer ខ្លួនឯងរត់សម្រាប់សាលក្រម `false` ដែរ (`zto-signed-cadence` +១ ៖ របារលត់ ≤ ២៥ វិ.) ·
  mutation ៥/៥ ត្រូវសម្លាប់ (timer មិនអើពើរបា · មិនប្តូរ · មិនបញ្ជូន · ជុំគ្មានកញ្ចប់បើក = ពេញលេញ · `/detail` មិនរំលង)។
- ការផ្ទៀងឡើងវិញ ៖ `zto-list-sync-test` +៣ (k1 ៖ អាន ៤ ដងទៀត ➜ ៣ មិនមែន ១១ · barcode ថ្មី ➜ ៤ · k2 ៖ 429 ក្នុង ១៤ ms មិនមែន ១៥០០ ms) · `zto-stale-bar` +៤
  (k4 ជួរ ២ ថ្ងៃ · ទិសផ្ទុយ ៧ ថ្ងៃពេលមានកញ្ចប់បើក · truncated ➜ ចន្លោះទ្វេ · k5 ជុំកាត់ · អានមិនគ្រប់) · mutation ១០/១០ ត្រូវសម្លាប់។
- ប្រភព ៖ `ZoeW/tests/zto-list-origin.test.tsx` (៤) ៖ tree មុនកែ (`a7521bb`) **ធ្លាក់ ៤** · `zto-list-sync-test` +៦ (payload ពិត ៣ ➜ `recSite` · `recSite` ទទេ ➜ `customerCodeDesc` ·
  គ្មាន ➜ ទទេ · តួអក្សរបញ្ជា/ចន្លោះ/៦៤ តួ · ជួរដេក ៨ វាល ២ កន្លែង) · តារាង «📋 វាល» ក្នុង `ZTO-SETUP-KH.md` ដេរីវេ `LIST_ORIGIN_PATHS` · mutation ៩/៩ ត្រូវសម្លាប់។
- ប្រភពក្នុងប្រវត្តិ ៖ `ZoeW/tests/barcode-origin.test.tsx` (ស្លាក · សង្ខេប · ការគូរ · transaction · zombie · rules ចាស់ · session ប្តូរ · ព្យួរ) · `ZoeW/tests/zto-list-origin-import.test.tsx`
  (៤ ៖ ការបញ្ចូល ➜ transaction ១ ក្នុងមួយកញ្ចប់ · បំពេញកញ្ចប់មានរួច · rules ចាស់ ➜ ✅ បញ្ចូល · ទិសផ្ទុយ) · `history-row-parity` ៖ ការប្តូរដោយចេតនាប្រកាសក្នុង
  `INTENTIONAL_UI` (`skip` ស្រោមប៊ូតុងចាស់ · `asLegacy` «កញ្ចប់សរុប» = `<span class="count-badge">`) · ការចុចពិតហៅ `openViewListModal(id)` ដដែល · `emu/app-writes-rules` ៖
  rules ពិត ៖ ការសរសេរ ៤១៨ · បដិសេធ ០ · មាន `origins` ២០ · ចម្លងទៅធុងសំរាម ៦ + probe rules ចាស់ ➜ បដិសេធ · `revenue-fuzz` op `origin` (លុយ/ចំនួនដដែលក្រោយរាល់ op) ·
  `emu/supabase-rules-parity` · `emu/crud-rules-flow` ឆ្លង។
- ជួរប្រវត្តិ (`layout-check` ផ្នែកថ្មី · browser ពិត · ទទឹង ១៧ (320–1280) × ទិន្នន័យ ៦ ជួរ និង ១២០ ជួរ) ៖ `elementFromPoint` គែម/កណ្តាល «កញ្ចប់សរុប» និងប៊ូតុងនីមួយៗ ·
  ប៊ូតុងមិនជាន់ក្រឡាតម្លៃ · ទូរស័ព្ទ ៖ ប៊ូតុងនៅក្នុងក្រឡាខ្លួន · លេខរៀង (៣ ខ្ទង់) មិនជាន់ · ប្រភពនៅក្នុងក្រឡា · មិនជាន់ · មិនប្តូរទទឹងជួរឈរ · បន្ថែមកម្ពស់ ≤ ១ បន្ទាត់ ·
  ចុចពិត (Playwright) ➜ ប្រអប់បញ្ជី ៖ tree មុនកែ (`46377da`) **ធ្លាក់ ៧** · ក្រោយកែ ១១៤/១១៤ (font ជំនួស) · ផ្ទៀងដោយដៃជាមួយ Kantumruy Pro ពិត ៖ គ្មានការជាន់ ១៨ ទទឹង ·
  ⚠️ កំហុសក្នុងអ្នកយាមខ្លួនឯងដែលរកឃើញដោយការរត់លើ tree មុនកែ ៖ `rowsOf()` ត្រងមុនបន្ថែម `w` ➜ «ទូរស័ព្ទ ៖ ប៊ូតុងនៅក្នុងក្រឡា» បៃតងដោយមិនវាស់ ➜ កែ។
  mutation CSS/JSX (build ឡើងវិញ + `layout-check` ពិត) ៖ ៩ ត្រូវសម្លាប់ (ក្រឡាលេខរៀង · ស្លាកលេខរៀង · អក្សរលេខរៀងទូរស័ព្ទ · បត់ជួរប៊ូតុង · padding ប៊ូតុង ·
  «…» ប្រភព · `.origin-line` · onClick «កញ្ចប់សរុប») · ៣ រស់ ➜ ច្បាប់មិនចាំបាច់ ➜ **ដកចេញ** (ពិដានទទឹងស្លាក · ជួរឈរលេខរៀង 5% លើ desktop · `min-width: 0` លើស្លាក ព្រោះ
  `overflow: hidden` ធ្វើរួច)។ `ZtoListSyncBody` ៖ ជួរប្រអប់បញ្ជីជា flex ជួរឈរដូចដើម (barcode · លេខ/លុយ/ម៉ោង · ប្រភព · សម្គាល់) · `INTENTIONAL_UI.skip` ប្រៀបតែ barcode +
  ចំនួនជួរ (ខ្លឹមសារចាក់សោដោយ `zto-list-sync-test` · `tests/zto-list-origin.test.tsx`) · `parity:dom` · `parity:live` (`READ(ui)` ពិនិត្យ `INTENTIONAL_UI` ដែរ) ·
  `parity:deep` · `parity` (`REMOVED_STRINGS` ៖ «📦 បញ្ជី (») ឆ្លង។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. ⛔ **Publish Firebase rules ថ្មី (`firebase-database.rules.json` · វាល `origins` · សញ្ញាហាង `zoew_settings/zto_signed_sweep`) ទៅគ្រប់ Project អតិថិជន** (Console ➜ Realtime Database ➜ Rules ➜ Publish ឬ
   `tools/firebase-provision/deploy-rules.cmd`) · ហាង Supabase ៖ migration `20261006192639_zoe_rules.sql` អនុវត្តដោយ GitHub integration **ពេល merge ចូល `main`**
   (ការសម្រេចរបស់ម្ចាស់គម្រោង)។ មុន Publish ៖ ការបញ្ចូលបញ្ជី ZTO ដើរធម្មតា តែប្រភពមិនរក្សាទុក · ទូរស័ព្ទដែលមិនបើក ZTO មិនរង់ចាំ (ដូចមុន · គ្មាន toast ដាច់)។ ⛔ **កុំត្រឡប់ទៅ rules ចាស់** ក្រោយកញ្ចប់មាន `origins` ហើយ
   (ការសរសេរលើកញ្ចប់នោះ — បិទ · កែតម្លៃ · ដក — នឹងត្រូវបដិសេធ)។
2. Deploy **ZoeW** (Netlify) ➜ build APK ឡើងវិញ។ គ្មាន env ថ្មី។
3. សាក (ហាងដែលបើក «បិទតាម ZTO ស្វ័យប្រវត្តិ») ៖ កញ្ចប់អាយុ ៨ ថ្ងៃ ដែល ZTO Palm ចុះហត្ថលេខារួច ➜ បិទ App ➜ បើកវិញ ➜ វាត្រូវបិទ «យករួច» (ស្ថិតិយកឡើង) មិនមែនចូល
   «🗑️ ផុតកំណត់» ទេ · កញ្ចប់ ៨ ថ្ងៃដែលមិនទាន់យក ➜ ចូល «ផុតកំណត់» ក្នុងប៉ុន្មាននាទី (ZTO មិនឆ្លើយ ➜ ≤ ៣០ នាទី)។
   ហាងមានទូរស័ព្ទ ២ ៖ ទូរស័ព្ទ A បើក ZTO + «បិទតាម ZTO ស្វ័យប្រវត្តិ» · ទូរស័ព្ទ B មិនបើក ZTO ➜ Firebase Console ➜ `zoew_settings/zto_signed_sweep` មាន `activeAt`/`completeAt`
   ➜ កញ្ចប់ដែលហួស ៧ ថ្ងៃ ហើយ ZTO ចុះហត្ថលេខា មិនត្រូវ B ដកលុយ មុន A អានបញ្ជី។
4. ✅ **ផ្ទៀងលើ Argus (E8 · ម្ចាស់គម្រោងចម្លង payload ពិត ៣ ៖ ក្នុងស្រុក · ចិន · Shopee វៀតណាម)** ៖ កញ្ចប់យករួចមានជួរដេក `scanTypeCode: "05"` +
   `scanTypeDesc: "ចុះហត្ថលេខា"` (= លំនាំដើម ➜ គ្មាន env ត្រូវប្តូរ) · ជួរដេកបញ្ជី **គ្មាន** `billStatus` · DOD = `fcAmount` · លំដាប់តាម `id` ឡើង។ ⏳ នៅសល់ ៖ សាកលើ App ពិត ៖
   ទាញបញ្ជីដែលមានកញ្ចប់ចុះហត្ថលេខារួច ➜ ប្រអប់ត្រូវរាប់វាក្នុង «🔒 ថ្មីដែល ZTO បិទរួច» · ZTO Palm ចុះហត្ថលេខា ➜ ZoeW បិទក្នុង ~២០ វិ. (កំពុងប្រើ) · `?diag=1` ➜ `list.signedEnabled: true`។
5. សាកល្បឿន ៖ បើកប្រអប់ស្កេនហើយស្កេនបន្តបន្ទាប់ ➜ ចុះហត្ថលេខាកញ្ចប់មួយលើ ZTO Palm ➜ ZoeW បិទវាក្នុង ~២០–៦០ វិ. (មុន ៖ មិនបិទរហូតឈប់ស្កេន) · ទុកទូរស័ព្ទចោល
   ➜ ~១ នាទី។ ក្រោយ ១ សប្តាហ៍ ៖ Netlify ➜ **Usage** ➜ មើល Functions/credits (ឧបករណ៍ច្រើន ➜ ប្រើច្រើនជាង)។
6. សាកប្រភព (ក្រោយ Publish rules) ៖ ទាញបញ្ជី ZTO ➜ «➕ បញ្ចូល» ➜ ជួរប្រវត្តិបង្ហាញ 🇨🇳 ចិន / 🇻🇳 វៀតណាម ក្រោមលេខទូរស័ព្ទ · ចុច «កញ្ចប់សរុប» ➜ បញ្ជី barcode
   (ប្រភពនីមួយៗ) · ទូរស័ព្ទតូច (iPhone SE · Android 360) ៖ ប៊ូតុងខល/បិទ មិនជាន់ «កញ្ចប់សរុប» · លេខរៀង ១០០+ មិនជាន់លេខទូរស័ព្ទ។
7. ពិនិត្យប្រវត្តិថ្ងៃថ្មីៗ (E7 k10) ៖ ជួរដែលមាន phone `0` (ឬ `000`) ហើយ «ចំនួន» > ១ អាចជាកញ្ចប់អតិថិជនច្រើននាក់ដែលបានបញ្ចូលគ្នាពីមុន ➜ កែលេខ/បំបែកដោយដៃ
   (ទិន្នន័យចាស់មិនកែស្វ័យប្រវត្តិ)។ លើទូរស័ព្ទ ៖ ស្កេនកញ្ចប់ ZTO គ្មានលេខអ្នកទទួល ➜ ប្រអប់នៅបើក មាន COD តែ phone ទទេ ➜ «រំលង» ➜ ជួរ «គ្មានលេខ» មួយក្នុងមួយកញ្ចប់ ·
   ស្កេនហើយចុច «រំលង» មុន ZTO ឆ្លើយ ➜ គ្មានសារ «ត្រូវបានបញ្ចូលរួចហើយ» · barcode ខ្លី/ក្រៅទម្រង់ ➜ «⚠️ Barcode នេះមិនមែនទម្រង់ ZTO» ·
   បិទផ្ទាំងនាំចូល Sheet ហើយស្កេនភ្លាម ➜ Lookup នៅបំពេញលេខ/COD។

### [2.50.0] — 2026-10-06 · ZoeW ៖ **ZTO ៖ ទាញបញ្ជីលឿន · ទាញតែកញ្ចប់មកដល់ · កញ្ចប់ដែល ZTO បិទរួចចូលស្ថិតិ «យករួច» ដូចបិទដោយដៃ · បិទតាម ZTO Palm ស្វ័យប្រវត្តិ · ឈ្មោះសាខាក្នុងប្រអប់បញ្ជី** (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.0`** (`zoew-v262` ➜ `zoew-v263`)។ ⛔ ZoeKeyGen · Firebase rules · migration · Edge Function **មិនប្រែ**។ ប៉ះ
`netlify/functions/zto-order-detail.js` (`readListSignedConfig()` · `listPlan()` · `listSignedRange()` · `listRowIsSigned()` · `listSiteNameOf()` ·
`mergeSignedCompanion()`) · `src/features/zto-list-sync.ts` (`fetchZtoListAllPages()` · `fetchZtoSignedCodes()` · `ztoListSignedEvidence` ·
`ztoListCloseTargets()` · `ztoListSignedNote()` · `ztoListSiteText()`) · `src/features/zto-status.ts` (`closeZtoSignedBarcodes()` · `ztoSignedSweepIsDue()` ·
`ztoSignedSweepRange()`) · `ZtoListSyncModal.tsx` · `zto/model.ts` · `state.ts` · `view-state.ts` · `react-root.css` · `public/guide.html` · `ZTO-SETUP-KH.md`។

#### អ្វីដែលខុសពីមុន

- ⚡ **ទាញបញ្ជីលឿន** ៖ ទំព័រ ១ ➜ ទំព័រ 2..N ចេញ **ព្រមគ្នា** (មុន ៖ មួយៗ ➜ ពេលសរុប = ផលបូក) · ការសួរ `/detail` សម្រាប់ជួរដេកចាស់ ៤ ព្រមគ្នា
  (`ZTO_LIST_PROBE_CONCURRENCY`)។ ការស្កេន Lookup (០.៦–១.០ វិ.) មិនប្រែ។
- 📦 **ទាញតែកញ្ចប់មកដល់** ៖ ជួរដេកដែលប្រភេទស្កេនខុសដោយវាស់បាន (`04` ចែកចាយ · `05` ចុះហត្ថលេខា …) លែងចេញជាជួរ «⏭️ រំលង» — Function ដកវាចេញពី
  `rows` ហើយរាប់ក្នុង `otherScans` ➜ ប្រអប់ប្រាប់ «⏭️ ស្កេនប្រភេទផ្សេង N ជួរ មិនរាប់»។ env `ZTO_LIST_SCAN_TYPE=03` ដែលម្ចាស់គម្រោងដាក់ = លំនាំដើម។
- 🔒 **កញ្ចប់ដែល ZTO បិទរួច ➜ ចូលស្ថិតិ «យករួច» ដូចបិទដោយដៃ ១០០%** ៖ ទំព័របញ្ជីសុំ `withSigned=1` ➜ Function សួរស្កេន `05` «ចុះហត្ថលេខា»
  (ZTO Palm) របស់សាខាដដែល **ស្របគ្នា** ក្នុងការហៅតែមួយ (ពី `from` ដល់ថ្ងៃនេះ) ➜ barcode ក្នុង `signed` = ZTO បិទរួច ➜ ជួរដេកថ្មី **គ្រប់អាយុ** កើតមកជា
  «យករួច» (មុន ៖ តែជួរដេកចាស់ជាង ៨ ថ្ងៃ ➜ ជួរដេកក្មេងចូលជា «មិនទាន់យក») ➜ ស្ថិតិយក + mirror ចំណូលប្រចាំថ្ងៃតាម `applyBarcodeCloseChange()` (ទ្វារដដែលនឹងការចុច
  បិទដោយដៃ) · កញ្ចប់ **មានក្នុង ZoeW ហើយនៅបើក** តែ ZTO ចុះហត្ថលេខា ➜ «➕ បញ្ចូល» បិទវាតាម `autoCloseBarcodeFromZto()` (គោរពកុងតាក់ «បិទតាម ZTO
  ស្វ័យប្រវត្តិ»)។ ⛔ ភស្តុតាងត្រូវវិជ្ជមាន (កូដ `05` ហើយអត្ថបទមិនផ្ទុយ) · គ្មានភស្តុតាង ➜ នៅបើក។
- 📲 **បិទតាម ZTO ស្វ័យប្រវត្តិ (ZTO Palm)** ៖ ជុំពិនិត្យអានបញ្ជី «ចុះហត្ថលេខា» (`signed=1`) ប្រហែលរៀងរាល់ ២ នាទី ➜ កញ្ចប់បើកដែលមានក្នុងបញ្ជី បិទភ្លាម
  (កញ្ចប់ដែល ZoeW បិទតាម ZTO ហើយអ្នកប្រើបើកវិញដោយដៃ ➜ មិនបិទម្តងទៀតក្នុង ១ ម៉ោង លើកលែងចុច «ពិនិត្យម្តងទៀត»)
  (≤ ១០ ក្នុងមួយជុំ) ជំនួសការរង់ចាំការសួរម្តងមួយកញ្ចប់ (ចន្លោះពិនិត្យកញ្ចប់បើកម្តងៗ ១ ម៉ោង)។ server មិនទាន់កំណត់មុខងារបញ្ជី ➜ សម្រាក ៣០ នាទី ហើយ
  ការសួរម្តងមួយកញ្ចប់នៅដើរដដែល។
- 🏢 **ឈ្មោះសាខា** (`scanSite` ឧ. «Mer SorChrey») + លេខសាខា បង្ហាញក្រោមចំណងជើងប្រអប់ «📥 បញ្ជីកញ្ចប់ពី ZTO» ក្រោយការទាញ · ការចាកចេញសម្អាតវា។

#### អ្នកយាម

- `zto-list-sync-test` ផ្នែក ២១ (Function ពិត) + ផ្នែក ៤/១៤/១៦ (កែតាមកិច្ចសន្យាថ្មី) + sandbox `importZtoListRows()` ពិត ៖ **៤២៣ ok** · tree មុនកែ
  **ធ្លាក់ ៣៨ ដោយមានឈ្មោះ**។ `ZoeW/tests/zto-signed-sync.test.tsx` (១២) ៖ tree មុនកែ **ធ្លាក់ ១០** (២ ដែលនៅបៃតងជាទិសផ្ទុយ «កុងតាក់បិទ ➜ មិនបិទ»)។
- ការបិទដែល **ព្យួរ** (`applyBarcodeCloseChange()` ➜ `undefined` = commit យឺតបានចាក់ · `autoCloseBarcodeFromZto()` បញ្ជូនវាបន្ត) ➜ ការបញ្ចូល និងជុំបិទតាម
  ZTO **ឈប់ភ្លាម** (ថ្នាក់ដដែលនឹង ZTO-G4 ៖ បន្ត ➜ កញ្ចប់នីមួយៗរង់ចាំពិដាន ១៥ វិ.) — រកឃើញក្នុង review ប្រឆាំងក្រោយ commit ដំបូង · mutation ដក `break` ➜ ធ្លាក់។
- ការផ្ទៀងផ្ទាត់ឡើងវិញ ៖ race Cookie របស់សំណើ «ចុះហត្ថលេខា» · ភស្តុតាងលេចឆ្លងវគ្គក្រោយចាកចេញ · កញ្ចប់ដែលអ្នកប្រើបើកវិញ ➜ ជួសជុល (ផ្នែក ២)។
- ជុំទី ២ ៖ ការបិទដែលបរាជ័យជានិច្ចលែងទប់ជួរ · ⛔ **តំបន់ ZTO ចាក់សោ** (`ZoeW/tests/zto-lock.test.ts` · `CLAUDE.md` «Locked zone — ZTO») ➜ កែតែពេលម្ចាស់គម្រោងស្នើផ្ទាល់។
- `parity-deep` (ZTO ១៣/១៣) ៖ សំណើ `withSigned=1`/`signed=1` ដកចេញពីស្រទាប់ «សំណើ ZTO» ដោយមានហេតុផល (Function ក្លែងមិនឆ្លើយ `signed` ➜ អេក្រង់ ·
  ការសរសេរ · DB នៅប្រៀបពេញ) · probe ៖ ដកការដកចេញ ➜ ធ្លាក់ ២ ជំហាន (ស្រទាប់ ZTO តែប៉ុណ្ណោះ) · ជួរដេក ZL9 ក្នុង fixture ➜ `ztoClosed: null` (ផ្លូវរួម)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** (Netlify) ➜ build APK ឡើងវិញ។ ⛔ **គ្មាន env ថ្មីដែលចាំបាច់** ៖ `ZTO_LIST_SCAN_TYPE=03` = លំនាំដើម · `ZTO_LIST_SIGNED_SCAN_TYPE`
   (លំនាំដើម `05`) · `ZTO_LIST_SIGNED_SCAN_DESC` (លំនាំដើម `ចុះហត្ថលេខា`) ជាជម្រើស — បើបញ្ជី «ចុះហត្ថលេខា» ផ្តល់លទ្ធផលខុស ➜ ដាក់
   `ZTO_LIST_SIGNED_SCAN_TYPE=off` ➜ Trigger deploy (ត្រឡប់ទៅការសួរម្តងមួយកញ្ចប់)។
2. ✅ **ម្ចាស់គម្រោងបញ្ជាក់ (2026-10-06)** ៖ ន័យ «ZTO ចុះហត្ថលេខា = ZoeW បិទបញ្ជី (យករួច)» ត្រឹមត្រូវ។ ⏳ នៅសល់ ៖ ផ្ទៀងលើទិន្នន័យពិតថាកូដ
   ស្កេននោះជា **`05`** ពិត ៖ Argus ➜ Scan Management ➜ ជ្រើសប្រភេទ **05 ចុះហត្ថលេខា** ➜ ពិនិត្យថា barcode ដែល ZoeW ដាក់ 🔒 ត្រូវនឹងបញ្ជីនោះ ·
   `?diag=1` ➜ `list.signedEnabled: true`។ ZTO Palm ៖ ចុះហត្ថលេខាកញ្ចប់មួយ ➜ ក្នុង ~២ នាទី ZoeW បិទវា (App បើក · កុងតាក់បើក)។
3. ពិនិត្យប្រអប់បញ្ជីបង្ហាញ «🏢 សាខា ៖ Mer SorChrey · <លេខសាខា>»។

### [2.49.6] — 2026-10-06 · ZoeW + ZoeKeyGen ៖ **ប្រអប់ ⚙️ ភ្ជាប់ប្រព័ន្ធ ៖ ស្កេន QR/បិទភ្ជាប់ Setup Link ➜ ភ្ជាប់ភ្លាម · Config ដោយដៃនៅក្រោយ switch · checkbox/radio គ្មានស្រមោលការ៉េ · APK workflow ៖ CRLF លើ Windows** (សំណើ/របាយការណ៍ម្ចាស់គម្រោង · រូបថត)

**ZoeW `2.49.6`** (`zoew-v261` ➜ `zoew-v262`) · **ZoeKeyGen `2.24.6`** (`zoekeygen-v116` ➜ `zoekeygen-v117` ៖ `style.css` តែប៉ុណ្ណោះ)។ ⛔ Firebase rules ·
migration · Edge Function **មិនប្រែ**។ ប៉ះ `ConfigModal.tsx` · `src/features/config.ts` (`toggleConfigManual` · `setupLinkSummary` · `connectSetupPayload` ·
`saveFirebaseConfig()` ត្រឡប់ `true`/`false`) · `config-qr.ts` · `view-state.ts` (`configManual` · `configPendingLink`) · `action-registry.ts` · `react-root.css` ·
`ZoeKeyGen/style.css` · `.gitattributes` (ថ្មី) · `ZoeW/scripts/android-check.mjs`។

#### អ្វីដែលខុសពីមុន

- 📷 **ស្កេន QR (កាមេរ៉ា ឬរូបភាព) និងបិទភ្ជាប់ Setup Link ក្នុងប្រអប់ ➜ រក្សាទុក ហើយភ្ជាប់ភ្លាម** (`connectSetupPayload()` ➜ `saveFirebaseConfig()`) ៖
  អ្នកប្រើបានស្កេន/បិទភ្ជាប់ដោយខ្លួនឯង ➜ សកម្មភាពនោះជាការយល់ព្រម។ Link មិនត្រឹមត្រូវ (ឧ. Secret key · URL មិនអនុញ្ញាត) ➜ មិនរក្សាទុក
  ហើយបើកផ្នែក «បំពេញ Config ដោយដៃ» ឲ្យឃើញតម្លៃ។
- 🔗 **Setup Link ពី URL (`?setup=`)** នៅតែឆ្លងច្រក PIN ហើយ **មិនរក្សាទុកដោយស្វ័យប្រវត្តិ** ៖ ប្រអប់បង្ហាញកាត «Setup Link ៖ Firebase/Supabase · host ·
  កូដអញ្ជើញ» + ប៊ូតុង «✅ ភ្ជាប់» (ចុចម្តង)។ មូលហេតុ ៖ តំណក្នុងសារអាចមកពីអ្នកដទៃ (phishing ➜ ភ្ជាប់ទៅ Server អ្នកវាយប្រហារ) ➜ អ្នកប្រើត្រូវឃើញ
  Server មុនភ្ជាប់។
- ✍️ **វាល Config ដោយដៃលាក់ក្រោយ switch «បំពេញ Config ដោយដៃ»** (`role="switch"` · បិទតាមលំនាំដើមរាល់ពេលបើកប្រអប់) ៖ បិទ ➜ ឃើញតែស្កេន QR ·
  QR ពីរូបភាព · បិទភ្ជាប់ Link។ បើក ➜ ជម្រើស Server ជា segmented control (Firebase លឿង · Supabase បៃតង) · វាល Config · Sentry DSN ·
  ប៊ូតុង «រក្សាទុក និងភ្ជាប់» (ភ្ជាប់តែពេលចុច)។
- 🔘 **checkbox/radio ចុចហើយគ្មានស្រមោលការ៉េ** (រូបថតម្ចាស់គម្រោង) ៖ មូលហេតុ ៖ `.modal-content input:focus` (ZoeW) និង `input:focus` (ZoeKeyGen)
  ដាក់ `box-shadow` 3px របស់វាលអក្សរលើ checkbox/radio ផងដែរ ➜ ចុចដោយម្រាមដៃនៅសល់ការ៉េពណ៌ (web និង APK ដូចគ្នា ព្រោះ CSS តែមួយ)។
  ឥឡូវ checkbox/radio `:focus` គ្មាន `box-shadow` · ក្តារចុច (`:focus-visible`) នៅមានរង្វង់ outline 2px។ ZoeW ៖ `app.css` ស្មើ vanilla (parity) ➜
  ការកែនៅ `react-root.css`។
- 🤖 **APK workflow ធ្លាក់ពេលប្តូរទៅ runner `windows-latest` របស់ GitHub** ៖ មិនមែនដោយ repo ជាសាធារណៈទេ — Git for Windows `core.autocrlf=true`
  ប្តូរ LF ➜ CRLF ពេល checkout ➜ `android-check` ប្រៀបអត្ថបទ xml/svg ជាមួយ LF ➜ FAIL។ ឥឡូវ `.gitattributes` (`* text=auto eol=lf` · `.cmd`/`.bat` `-text`)
  + `android-check.mjs` អានដោយប្តូរ CRLF ➜ LF (tree CRLF ៖ មុនកែ 93 ok/1 FAIL · ក្រោយកែ 94 ok)។ runner self-hosted Windows ទទួលការកែដូចគ្នា។

#### អ្នកយាម

- `ZoeW/tests/config-modal.test.tsx` ៖ លំនាំដើម (switch បិទ · វាលលាក់) · ស្កេនកាមេរ៉ា/រូបភាព/បិទភ្ជាប់ ➜ រក្សាទុកភ្លាម · Secret key ➜ មិនរក្សាទុក + បើកដោយដៃ ·
  URL ➜ កាត + មិនរក្សាទុកមុនចុច «✅ ភ្ជាប់» · CSS គ្មានស្រមោលការ៉េ។
- `fluid-type-focus-test` ផ្នែក ងខ (browser ពិត · App ទាំងពីរ) ៖ ចុច checkbox/radio ពិតគ្រប់ធាតុ (ដេរីវេពី DOM) ➜ `box-shadow` = `none`។ មុនកែ FAIL ៖ ZoeW
  `lookupApi*Checkbox` ×3 · `rememberMeCheckbox` · `rememberPasswordCheckbox` (`rgb(224, 242, 254) 0 0 0 3px`) · ZoeKeyGen `rememberMeCheckbox`។
- `repository-contract-test` ៖ clone ពិតដោយ `core.autocrlf=true` ➜ xml/svg នៅ LF · `.cmd`/`.bat` នៅ CRLF · ឯកសារ CRLF ពិតក្នុង repo ទាំងអស់មាន `-text`។
- អ្នកយាមដែលមានស្រាប់ចាប់ ៥ ចំណុចលើ commit ដំបូង (CI ៤ shard ក្រហម) ៖ `wiring` · `csp-enforced` (`toggleConfigManual` ត្រូវនៅក្នុង
  `ACTION_ALLOWLIST` · `src/core/runtime.ts`) · `css-classes` (`.cfg-lead` · `.cfg-hint` គ្មានច្បាប់ CSS) · `toast-action-truth` (toast 🔗 គ្មានសញ្ញាន័យ ➜ ℹ️) ·
  `zoew-suite` ➜ `npm run parity` (អត្ថបទដើម ៣ ➜ `REMOVED_STRINGS` មានហេតុផល)។ toast ក្រោយស្កេន/បិទភ្ជាប់និយាយតែអ្វីដែលបានរក្សាទុក
  («✅ QR ត្រឹមត្រូវ ➜ បានរក្សាទុក Config ៖ host») ហើយ live toast `config` រាយការណ៍ការភ្ជាប់។
- Review ប្រឆាំង (៥ វិមាត្រ · អ្នកផ្ទៀងបដិសេធ) ➜ ៦ ចំណុចពិត ៖ (១) 🔐 កាតកាត់ host ត្រឹម ៨០ តួ ➜ Link phishing លាក់ domain ចុង
  (`x.supabase.co.<padding>.attacker.net`) ➜ ឥឡូវ host ពេញ + ⚠️ ពេលមិននៅលើ `*.supabase.co` · `*.firebaseio.com` · `*.firebasedatabase.app` ·
  (២) «✅ ភ្ជាប់» រក្សាទុកវាលក្នុង form (មិនមែន Link របស់កាត) ➜ `connectPendingSetupLink()` ភ្ជាប់ payload របស់កាត · Link ផ្សេងចូល ➜ កាតបាត់ ·
  (៣) DSN Sentry ពី Link URL អនុវត្តភ្លាមក្រោយ PIN (បោះបង់ក៏នៅ) ➜ ឥឡូវតែពេលចុច «✅ ភ្ជាប់» (`saveFirebaseConfig()` អានវាល) · កាតបង្ហាញ 🐞 ·
  `setup-link-browser-test` វាស់ «ក្រោយ PIN ➜ គ្មាន DSN · ក្រោយចុច ➜ DSN + Config» · (៤) រង្វង់ផ្តោតក្តារចុចពឹង `:has()` តែមួយ ➜ ផ្លូវបម្រុង
  `@supports not selector(:has(*))` · (៥) តេស្តរូបភាព QR លំដាប់បញ្ច្រាស (mutation ដក `seq === configQrImageSeq` ➜ ធ្លាក់) · (៦) guide «គណនីហាង»
  និង README ៣ ប្រាប់ «✅ ភ្ជាប់» ជំនួស «រក្សាទុក»។ ការចាកចេញសម្អាតកាត + switch (`clearSensitiveModalFields()`)។
- ចំណុច ៥ ដែលអ្នកផ្ទៀងបដិសេធ (មិនប៉ះអ្នកប្រើ) ក៏កែតាមសំណើម្ចាស់គម្រោង ៖ guide «វាយ Security PIN — មិនទាន់មាន ➜ App ឲ្យបង្កើត PIN
  ថ្មីមុន» · id gradient SVG ឯកលក្ខណៈ (`useId` ក្នុង `BackendMark.tsx` · តេស្ត «គ្មាន id ស្ទួន · រាល់ `url(#…)` យោង gradient ពិត») · ងខ មានជាន់លើ
  ចំនួន **វាស់ពិត** (ចុចហើយ input ទទួល focus) + ត្រូវវាស់ switch និង radio Server ទាំង ២ + វាស់ outline លើស្លាក/កុងតាក់ពេល input លាក់
  (mutation `:has(input:focus-visible)` ➜ `:has(input:focus)` ➜ ធ្លាក់) · browser test ចុចកាត «✅ ភ្ជាប់» (`setup-link-browser-test`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy ZoeW និង ZoeKeyGen (Netlify) ➜ build APK ឡើងវិញ (workflow APK លើ `windows-latest` ឬ self-hosted)។
2. ផ្ទៀងផ្ទាត់លើទូរស័ព្ទពិត (iPhone + Android/APK) ៖ ចុច 🔘 Firebase/Supabase និងប្រអប់ធីក «ចងចាំ…» ➜ គ្មានការ៉េ · ស្កេន QR ➜ ភ្ជាប់ភ្លាម ·
   បើក Setup Link ពីសារ ➜ កាត + ចុច «✅ ភ្ជាប់»។

### [2.49.5] — 2026-10-06 · ZoeW ៖ **ប្រអប់ ⚙️ ភ្ជាប់ប្រព័ន្ធ ៖ ទាក់ទងបង្កើតគណនីតាម Telegram (@mengsroyhun) · ពណ៌ + logo Firebase/Supabase · Setup Link ហាងចុះឈ្មោះរួច ➜ ប្រអប់ចូល ទោះ Server ពិនិត្យកូដមិនបាន · APK ៖ Push មិនជាប់ «សូមចូលប្រព័ន្ធម្តងទៀត» ក្រោយផុត ៤ ម៉ោង** (Deep audit ជុំ ៣ · សំណើ/របាយការណ៍ម្ចាស់គម្រោង)

**ZoeW `2.49.5`** (`zoew-v260` ➜ `zoew-v261`)។ ⛔ ZoeKeyGen · Firebase rules · migration · Edge Function **មិនប្រែ**។ ប៉ះ `ConfigModal.tsx` · `ActivationModal.tsx`
(ប្រើតំណរួម ៖ DOM ដដែលបេះបិទ) · `shell/SellerTelegramLink.tsx` · `shell/BackendMark.tsx` (ថ្មី) · `react-root.css` (`#configModal .cfg-contact` · ពណ៌តាម backend) · `guide.html` · `src/features/account.ts`
(`checkInviteWithServer` · `routePendingInvite`) · `src/features/push.ts` (`onNativeToken` · `resumePushAfterSignIn` · `watchPushIdentity`) · `src/app/lifecycle/boot.ts`។

#### អ្វីដែលខុសពីមុន

- 💬 **ប្រអប់ «⚙️ ភ្ជាប់ប្រព័ន្ធ» មានបន្ទាត់ «មិនទាន់មានគណនី? ទាក់ទង @mengsroyhun តាម Telegram ដើម្បីបង្កើតគណនី»** ក្រោមសេចក្តីណែនាំ Setup Link — បង្ហាញទាំង
  Firebase និង Supabase · បើកក្នុងផ្ទាំងថ្មី (`noopener`) · App lock ចាត់ទុកការចុចនេះជាការចាកចេញដោយចេតនា (`APP_LOCK_EXCUSE_SELECTOR` ដូចតំណក្នុងប្រអប់ Activation)។
  មុននេះតំណទាក់ទងក្នុង App មានតែក្នុងប្រអប់ Activation (Firebase ក្រោយចូលប្រព័ន្ធ) ➜ អ្នកដែលមិនទាន់មានគណនី/Setup Link ជាពិសេសហាង Supabase (គ្មាន Activation Key)
  គ្មានផ្លូវទាក់ទងក្នុង App ទាល់តែសោះ (មានតែក្នុងសៀវភៅណែនាំ)។
- តំណ Telegram មានប្រភពតែមួយ (`SellerTelegramLink` · `SELLER_TELEGRAM_HANDLE`) ➜ ប្រអប់ Activation និង Config មិនអាចខុសគ្នា។ សៀវភៅណែនាំ (Setup Link/QR) និង
  `ZoeW/README.md` ប្រាប់ផ្លូវនេះ។
- parity ៖ បន្ទាត់ថ្មីជា `p` គ្មាន style ដោយផ្ទាល់ក្រោម `.modal-content` ➜ ច្បាប់ `INTENTIONAL_UI.skip` ដដែលរំលងវា (គ្មានការពង្រីកបញ្ជី)។
- 🎨 **ប្រអប់ ⚙️ ភ្ជាប់ប្រព័ន្ធ ៖ ពណ៌ និង logo តាម backend** (សំណើម្ចាស់គម្រោង) ៖ ជម្រើស Firebase មាន logo អណ្តាតភ្លើង · Supabase មាន logo រន្ទះ (SVG ក្នុងកូដ ·
  `aria-hidden` · គ្មានធនធានខាងក្រៅ ➜ CSP មិនប្រែ) · ការជ្រើស Firebase ➜ ពណ៌លឿង/ទឹកក្រូច · Supabase ➜ ពណ៌បៃតង លើជម្រើស · ខ្សែលើប្រអប់ · ប៊ូតុង «រក្សាទុក និងភ្ជាប់»
  (ផ្ទៃពណ៌ម៉ាក + អក្សរងងឹត) · ខ្សែឆ្វេងនៃវាល Config។ ពណ៌ប៊ូតុង/ប្រអប់សម្រេចដោយ CSS `:has()` ➜ DOM ដែល parity ប្រៀប (class · style) មិនប្រែ · Chromium ពិត (build ផលិតកម្ម ·
  390 និង 1280 px) ៖ ជ្រើស Supabase ➜ ប៊ូតុង `rgb(62, 207, 142)`។
- 🔐 **Setup Link របស់ហាងដែលចុះឈ្មោះរួច ➜ ប្រអប់ចូលប្រព័ន្ធ ទោះ Server ពិនិត្យកូដអញ្ជើញមិនបាន** (ចំណុច ២ · R3-G1) ៖ ឧបករណ៍ថ្មី ឬ storage លុប (គ្មានការចងចាំ
  កូដ/គណនី) + Function `register` មិនឆ្លើយ (បណ្តាញ · ព្យួរ ២០ វិ. · DB `502 db-unavailable` · gateway 504) ➜ មុនកែ App បើក **ប្រអប់ចុះឈ្មោះ** (ករណីព្យួរ ៖ ប្រអប់ចូល
  ២០ វិ. រួចប្តូរជាចុះឈ្មោះពីក្រោមអ្នកប្រើ) ខណៈការចុះឈ្មោះក៏ធ្វើមិនបានដោយ Function ដដែល។ ឥឡូវ ៖ បើកប្រអប់ចុះឈ្មោះតែពេល Server ឆ្លើយ `invite-usable` ឬ Function ចាស់
  (មិនស្គាល់ `check` ➜ `username-invalid` ➜ ការចុះឈ្មោះនៅធ្វើបាន ដូចដើម) · ក្រៅពីនោះ ➜ ប្រអប់ចូល + «មានកូដអញ្ជើញក្នុង Setup Link — បើហាងមិនទាន់មានគណនី សូមចុច
  📝 ចុះឈ្មោះ» (កូដនៅចាំសម្រាប់ប៊ូតុងនោះ)។
- 📲 **APK ៖ Push មិនជាប់ «⚠️ សូមចូលប្រព័ន្ធម្តងទៀត រួចបើកការជូនដំណឹង» ក្រោយផុត ៤ ម៉ោង** (របាយការណ៍ម្ចាស់គម្រោង ៖ រូបថត APK 2.49.4 ៖ ផ្ទាំង 🔔 ទិន្នន័យស្រស់
  (ចូលរួច) តែផ្នែក Push និយាយ «សូមចូលប្រព័ន្ធម្តងទៀត» + ប៊ូតុង «បើក» ខណៈការជូនដំណឹងបើករួច) ៖ FCM ផ្ញើ token (`registration`) ពេលណាក៏បាន (ក្រោយ `register()` របស់ resync ·
  token ថ្មី) ➜ token មកដល់ក្រោយការផុតសម័យ ៤ ម៉ោង (`forceExpireSession()` ➜ `signOut`) ➜ `onNativeToken()` គ្មានអត្តសញ្ញាណ ➜ កំណត់ `no-account` **ដោយគ្មានលក្ខខណ្ឌ**
  ➜ ចូលប្រព័ន្ធវិញ គ្មានអ្វីផ្ទៀងស្ថានភាពឡើងវិញ (មានតែ boot · ត្រឡប់ពី background)។ ឥឡូវ ៖ token ពេលគ្មានអត្តសញ្ញាណ ហើយអ្នកប្រើមិនបានចុច «បើក» ➜ ទុក token រង់ចាំ
  (ស្ថានភាពមិនប្រែ · ការចុះឈ្មោះលើ Server នៅដដែល) · ការចូលប្រព័ន្ធ (`authButtonIsLoggedIn` false ➜ true · `watchPushIdentity()`) ➜ `refreshPushStatus()` + ចុះឈ្មោះ
  token ដែលរង់ចាំដោយគណនីដែលទើបចូល។ អ្នកប្រើចុច «បើក» ហើយសម័យបាត់មុន token មក ➜ `no-account` ដូចដើម។
- 🔒 **Server ៖ គណនីគ្មានហាង** (ចំណុច ៤ក · ឧ. បង្កើតតាម GoTrue sign-up ផ្ទាល់ បើ Dashboard «Allow new users to sign up» បើកដោយច្រឡំ) ➜ វាស់លើ Postgres ពិត ៖
  `zoe_write` · `zoe_read` · `zoe_pull` ➜ `forbidden` · `SELECT zoe_docs`/`zoe_tenant_state` ➜ ០ ➜ **គ្មានផ្លូវរំលង** (មិនកែកូដ)។ ចន្លោះអ្នកយាម ៖ guard tenant null របស់
  `zoe_read` គ្មាននរណាវាស់ (ដកវាចេញ ➜ បញ្ជីទទេដែល App អានថា «គ្មានទិន្នន័យ») ➜ ឥឡូវចាប់។
- 🔔 សារកំណែ 2.49.5 ជំនួស 2.49.4 ៖ ចំណុចថ្មី ៤ + ចំណុចមុន ៨ = **១២**។ វាស់បាន ៖ `sanitizeFeed()` យកតែ ១២ ចំណុចដំបូង (`points.slice(0, 12)`) ខណៈ `announcements.json`
  លើ `main` មាន ២០ ➜ ចំណុច ៨ ចុងក្រោយ **មិនដែលបង្ហាញ** (បាត់ស្ងាត់ · គ្មានអ្នកយាមរាប់ចំណុច) ➜ ឯកសារឥឡូវ ≤ ១២ + អ្នកយាមថ្មី។

#### អ្នកយាម

- `ZoeW/tests/config-modal.test.tsx` ផ្នែកថ្មី (៥ តេស្ត ៖ Firebase · Supabase ឃើញតំណមួយ មិននៅក្រោម `.hidden` · `target="_blank"` + `noopener` + ត្រូវ
  `APP_LOCK_EXCUSE_SELECTOR` · `outerHTML` ស្មើតំណក្នុងប្រអប់ Activation · `INTENTIONAL_UI.skip` រំលងបន្ទាត់ ទិសផ្ទុយ ៖ textarea និងប៊ូតុងរក្សាទុកនៅប្រៀបធៀប) ៖
  tree មុនកែ (`main` 425ac3a) **ធ្លាក់ ៥/៥** ➜ **១៧/១៧**។ Mutation ៦ ➜ ក្រហម ៦ (ដក `target` · ដក `noopener` · ដាក់ក្នុង `.cfg-supabase` ➜ លាក់ពេល Firebase ·
  `p` មាន style ➜ parity ឃើញ · anchor ផ្ទាល់មិនប្រើប្រភពតែមួយ · អត្ថបទគ្មាន «បង្កើតគណនី»)។
- `ZoeW/tests/reconfig-invite-seam.test.tsx` (ថ្មី · ថ្នេរ App ↔ `handleRegister()` **ពិត** របស់ Edge Function + hash កូដពិត លើ DB ក្នុង memory) ៖ ចុះឈ្មោះ ➜ ចូល ·
  ឧបករណ៍ដដែល ➜ ចូល (មិនសួរ server) · storage លុប ➜ server `invite-invalid` ➜ ចូល (មិនបង្កើតគណនី) · Function មិនឆ្លើយ ៤ របៀប · ហាងថ្មី ➜ ចុះឈ្មោះ · Function ចាស់ ➜ ចុះឈ្មោះ ·
  ចុះឈ្មោះម្តងទៀតដោយឈ្មោះ/ពាក្យសម្ងាត់ដដែល ➜ `registered` ➜ ចូល (គណនីតែ ១) · Firebase ⇄ Supabase ៖ tree មុនកែ **ធ្លាក់ ៤/១០** (Function មិនឆ្លើយ ➜ `register`) ➜ **១០/១០**។
  Mutation ៣ ➜ ក្រហម ៣ (`unknown` ➜ ចុះឈ្មោះលើឧបករណ៍ថ្មី · `no-check` ➜ ចូលជានិច្ច · `username-invalid` ➜ `unknown`)។
- `ZoeW/tests/push-client.test.tsx` (បន្ថែម ៣) ៖ tree មុនកែ **ធ្លាក់ ២** (`expected 'no-account' to be 'on'`) ➜ **៤០/៤០**។ Mutation ៥ ➜ ក្រហម ៥ (token គ្មានអត្តសញ្ញាណ ➜
  `no-account` ជានិច្ច · កំពុងបើក ➜ មិនប្រាប់ · ចូលវិញមិន refresh · មិនផ្ញើ token រង់ចាំ · watch មិនហៅ)។
- `ZoeW/tests/config-modal.test.tsx` (បន្ថែម ២) ៖ logo SVG ក្នុងជម្រើសនីមួយៗ (`aria-hidden` · គ្មាន URL) · `is-on` ប្តូរតាមការជ្រើស · ច្បាប់ពណ៌ម៉ាកក្នុង CSS ➜ **១៩/១៩**។
- `ZoeW/tests/notifications.test.tsx` (បន្ថែម ១ ៖ ចំណុចនីមួយៗក្នុងឯកសារឆ្លងការត្រង) ៖ `announcements.json` របស់ `main` ➜ **ធ្លាក់** (`expected 12 to be 20`) ➜ **២១/២១**។
- `supabase-datastore-test` (បន្ថែម ៥ ការអះអាង + mutation ៣) ៖ គណនីគ្មានហាង ➜ `forbidden`/០ · Revoke ➜ `zoe_read forbidden` · mutation ៖ ដក guard `zoe_read` ➜ ក្រហម ·
  ដក guard `zoe_write` + `zoe_apply` ➜ ក្រហម · ដកតែ wrapper `zoe_write` ➜ បៃតង (probe ទិសផ្ទុយ ៖ `zoe_apply` នៅបដិសេធ) ➜ **១៣៤ ok**។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Merge ➜ Netlify deploy `zoew` · build APK ថ្មី (workflow `Android APK` លើ `main`)។ គ្មាន rules · migration · Edge Function។
- ⏳ សាកលើឧបករណ៍ពិត ៖ ⚙️ ភ្ជាប់ប្រព័ន្ធ ➜ ចុច **@mengsroyhun** ➜ iPhone PWA · APK · desktop បើក Telegram (ឬ `t.me` ក្នុង browser) ➜ ត្រឡប់មក App ➜ ប្រអប់នៅដដែល
  (App lock មិនចាក់សោភ្លាម)។
- ⏳ ⚙️ ភ្ជាប់ប្រព័ន្ធ ៖ ជ្រើស Firebase/Supabase ➜ logo + ពណ៌ប្តូរតាម (iPhone PWA · APK · desktop)។
- ⏳ APK ហាង Supabase (Push បើករួច) ៖ ទុក App លើស ៤ ម៉ោង ➜ បើក ➜ ចូលប្រព័ន្ធវិញ ➜ 🔔 ផ្នែក «ជូនដំណឹងលើទូរស័ព្ទ» ត្រូវបង្ហាញ «បើករួច» (មិនមែន «សូមចូលប្រព័ន្ធម្តងទៀត»)។
- ⏳ ឧបករណ៍ថ្មីបើក Setup Link របស់ហាងដែលចុះឈ្មោះរួច ពេលអ៊ីនធឺណិតខ្សោយ ➜ ប្រអប់ចូលប្រព័ន្ធ (មិនមែនចុះឈ្មោះ)។
- ⚠️ **ផ្ទៀងដោយដៃ (session វាស់មិនបាន ៖ network policy បិទ `supabase.co` · គ្មានសិទ្ធិ Google)** ៖ Supabase Dashboard ➜ Authentication ➜ Sign In / Providers ➜
  **Allow new users to sign up = បិទ** (បើបើក ៖ គ្មានទិន្នន័យលេចធ្លាយ (វាស់រួច) តែអ្នកណាក៏អាចចាប់យកឈ្មោះគណនីមុនម្ចាស់ហាង) · Firebase Console របស់អតិថិជន **នីមួយៗ** ➜
  Authentication ➜ Settings ➜ User actions ➜ **Enable create (sign-up) = បិទ** (Firebase rules = `auth != null` ➜ បើបើក អ្នកមាន `apiKey` អានទិន្នន័យហាងបាន ·
  `tools/firebase-provision` វាស់វាតែពេលបង្កើត/`--adopt`)។ Security Advisor (អាន ៖ 2026-10-06) ៖ `zoe_ops` RLS គ្មាន policy (INFO · ដោយចេតនា ៖ client គ្មានសិទ្ធិ) ·
  Leaked Password Protection (Pro) ➜ គ្មានរឿងថ្មី។

### [2.49.4] — 2026-10-04 · ZoeW · ZoeKeyGen `2.24.5` ៖ **ហាង Supabase ៖ បើក App ពេលក្រៅបណ្តាញ + token ផុត ➜ នៅក្នុងប្រព័ន្ធ · ចាកចេញពេលបណ្តាញដាច់ ➜ ចេញពីឧបករណ៍ភ្លាម (អ្នកបន្ទាប់មិនចូលជាគណនីមុន) · Server បញ្ចប់សម័យចូល ➜ ប្រាប់មូលហេតុ · SW ៖ ឯកសារបន្ថែមព្យួរមិនរារាំងការដំឡើង** (Deep audit ជុំ ២ ៖ ចំណុចដែលនៅសល់)

**ZoeW `2.49.4`** (`zoew-v259` ➜ `zoew-v260`) · **ZoeKeyGen `2.24.5`** (`zoekeygen-v115` ➜ `zoekeygen-v116` ៖ `sw.js` តែប៉ុណ្ណោះ)។ ⛔ Firebase rules · migration · Edge Function **មិនប្រែ**។ ប៉ះ adapter Supabase
(`src/services/supabase-sdk.ts` · `supabase-transport.ts`) និង env របស់វា (`src/services/firebase-init.ts` ៖ `onSessionEnded`) · សារចាកចេញបរាជ័យ (`src/features/auth.ts` ·
`app-lock.ts` ៖ និយាយពី «ឧបករណ៍នេះ» ព្រោះការបរាជ័យតែមួយគត់ដែលនៅសល់ = storage លុបមិនចេញ) · `src/features/zto-list-sync.ts` · `auto-lookup.ts` ·
Function `netlify/functions/zto-order-detail.js` · `src/sw/sw.ts` + `ZoeKeyGen/sw.js` (install)។

#### អ្វីដែលខុសពីមុន

- **បើក App ពេលក្រៅបណ្តាញ + token ផុត** (ទូរស័ព្ទទុកលើស ១ ម៉ោង) ៖ supabase-js សាក refresh ឡើងវិញ ~២៥-៣០ វិ. មុន `getSession()` ឆ្លើយ ➜ មុនកែ adapter មិនឆ្លើយ
  `onAuthStateChanged` ក្នុង ៨ វិ. ➜ App **reload ខ្លួនឯង** (`attemptAuthStorageRecovery` ៖ លុបតែ IndexedDB Firebase · គ្មានប្រយោជន៍លើ Supabase) ➜ ៨ វិ. ទៀត ➜ **ប្រអប់ចូល** ➜
  បណ្តាញត្រឡប់ ហើយ refresh ជោគជ័យ (`TOKEN_REFRESHED`) តែ adapter មិនអើពើព្រោះ `currentUser` ទទេ ➜ **ជាប់ប្រអប់ចូល** (ក្រៅបណ្តាញ ការវាយពាក្យសម្ងាត់ក៏បរាជ័យ)។
- ឥឡូវ ៖ ការស្តារមានពិដាន `SB_RESTORE_CEILING_MS` (៣ វិ.) ៖ refresh យឺត ឬបរាជ័យបណ្តោះអាសន្ន (session នៅក្នុង storage) ➜ ស្តារគណនីពី session ក្នុង storage (ដូច
  Firebase ស្តារអ្នកប្រើពី persistence ពេលក្រៅបណ្តាញ) ➜ App ដំណើរការក្រៅបណ្តាញ (RPC = `auth-unavailable` ➜ សាកឡើងវិញ) ➜ បណ្តាញត្រឡប់ ➜ token ថ្មី។ បណ្តាញល្អ ➜
  ឆ្លើយដោយ session ថ្មីពី Server ដូចមុន · refresh token មិនត្រឹមត្រូវ ➜ មិនស្តារ។ ការកំណត់ ៤ ម៉ោងនៅដដែល (វដ្ត ៦០ វិ. អាន `authTime` ពី token ចាស់ ៖ វាស់)។
- **ការពិនិត្យស្ថានភាពហាង (`my_account`) ដែលរំលងពេលក្រៅបណ្តាញ** ➜ រត់ម្តងទៀតពេល `TOKEN_REFRESHED` ឬការទាញជោគជ័យបន្ទាប់ (`_accountUnverified`) ➜ ហាងបិទ/ផុតកំណត់ខណៈ
  ក្រៅបណ្តាញ ➜ សារហាង + ចាកចេញ (ការពារពិតនៅ RLS ដដែល)។ ការពិនិត្យស្របគ្នាសួរ Server ម្តង (សារតែម្តង)។
- **supabase-js ចាកចេញដោយខ្លួនឯង** (refresh token ត្រូវ Server បដិសេធ ៖ reuse · session ត្រូវលុប · ចាកចេញពីផ្ទាំងផ្សេង) ➜ មុនកែ ប្រអប់ចូលលេចដោយគ្មានមូលហេតុ ➜ ឥឡូវ
  «⚠️ សម័យចូលប្រព័ន្ធលើឧបករណ៍នេះបានបញ្ចប់ (…) — សូមចូលប្រព័ន្ធម្តងទៀត» (`SB_SESSION_ENDED_TEXT`) · ការចាកចេញរបស់ adapter ខ្លួនឯង (ប៊ូតុង · ៤ ម៉ោង · ហាងបិទ) គ្មានសារនេះ។
- **ចាកចេញពេល Supabase មិនឆ្លើយ** (G4 · 🔒 ទូរស័ព្ទរួម) ៖ supabase-js `signOut()` អាន session ជាមុន ➜ token ផុត ➜ refresh បរាជ័យបណ្តោះអាសន្ន ➜ ត្រឡប់ error **មុនលុប
  session** ➜ មុនកែ ៖ ប៊ូតុងចាកចេញជាប់ **13.4 វិ.** ➜ «⚠️ មិនអាចបញ្ជាក់ថាបានចាកចេញពី Supabase…» (សារបណ្តាញ ខណៈបញ្ហាពិតគឺ session នៅក្នុងឧបករណ៍) ➜ session **នៅក្នុង storage** ➜ អ្នកបើក App បន្ទាប់
  **ចូលជាគណនីមុន**។ ឥឡូវ ៖ ការចាកចេញក្នុងឧបករណ៍មិនពឹងបណ្តាញ (ដូច Firebase) ៖ ការលុបចោលនៅ Server (`/auth/v1/logout?scope=local` ដោយ token បច្ចុប្បន្ន · refresh មុនបើផុត)
  ជា best-effort ក្រោមពិដាន `SB_SIGN_OUT_CEILING_MS` (៣ វិ.) ➜ លុប `zoew-sb-auth*` ក្នុង storage ដោយខ្លួនឯង ➜ refresh ដែលកំពុងរត់មកដល់ក្រោយ ត្រូវ commit guard របស់
  supabase-js បោះចោល (storage ប្រែ) ➜ មិនស្តារ session ឡើងវិញ។ បដិសេធតែពេល storage លុបមិនចេញ (សារ «មិនអាចបញ្ជាក់ថាបានចាកចេញពីឧបករណ៍នេះ»)។
- **សំណើដែលមិនទាន់ផ្ញើ ≠ ចម្លើយបាត់** (G3 · លុយ/សារ) ៖ token មិនទាន់បាន (`auth-unavailable` · ពិដានជំហាន token · refresh ក្រោយ 401) ➜ `rpc()` បោះ **មុន POST** ➜
  មុនកែ adapter ចាត់ជា «ចម្លើយបាត់» ➜ App បិទ/Reconfig ➜ `unknown` + `txServerUnread` + **Sentry `zone: money` ក្លែង** · ledger reconcile មិនរាយ ✅ · ឧបករណ៍ផ្សេងសរសេរ
  ចន្លោះនោះ ➜ conflict ➜ `not-applied` (ការសរសេរដែលមិនដែលចេញ ក្លាយជាការបដិសេធ)។ ឥឡូវ ៖ `SbNetworkError.unsent` ➜ សាកឡើងវិញដោយមិនដាក់ «ចម្លើយបាត់» ➜ បិទ ➜ `disconnect`
  ធម្មតា · conflict ➜ CAS សាកលើតម្លៃថ្មី។ សំណើដែលអាចបានផ្ញើ (timeout ក្រោយ POST · បណ្តាញ · gateway 5xx) នៅជា «ចម្លើយបាត់» ដដែល។
- **channel realtime ងាប់ ➜ ទាញរៀងរាល់ ៣០ វិ. ជារៀងរហូត** (SBD-6) ៖ `CLOSED` (ឧ. token ផុត ➜ Server បិទ channel) ឬ `subscribe()` បរាជ័យ ➜ មុនកែ `startRealtime()` មិនដែល
  បង្កើតម្តងទៀត (`unsubscribeRealtime` នៅ) ➜ ការផ្លាស់ប្តូរពីឧបករណ៍ផ្សេងមកដល់យឺតរហូតដល់ ៣០ វិ. និងទាញ ១០ ដងច្រើនជាង realtime។ ឥឡូវ ៖ channel មិនរស់ ➜ បង្កើតម្តងទៀតតាម
  `SB_REALTIME_RETRY_STEPS_MS` (៥ · ១៥ · ៣០ · ៦០ វិ. · timer តែមួយ · ត្រឡប់ទៅដើមពេល `SUBSCRIBED` · channel ដែល realtime-js ភ្ជាប់វិញខ្លួនឯងមិនត្រូវរុះ · status ពី channel
  ចាស់ត្រូវមិនអើពើ)។
- **ទាញបញ្ជីពី ZTO ៖ បណ្តាញមិនឆ្លើយកណ្តាលការបញ្ចូល** (ZTO-G4 · App ជាប់ + ZTO-G5 ផ្នែកនាំចូល) ៖ claim/ការរក្សាទុកព្យួរលើសពិដាន ១៥ វិ. ➜ មុនកែ loop បន្តជួរបន្ទាប់ ➜
  ជួរនីមួយៗរង់ចាំ ១៥ វិ. ម្តងទៀត ➜ `ZTO_LIST_IMPORT_MAX` (១០០) ជួរ = **សោ «⏳ កំពុងដំណើរការ» ជាប់ ~២៥ នាទី** · ចប់ ➜ «⚠️ បរាជ័យ 100» ហើយ **បញ្ជីត្រូវសម្អាត** · បណ្តាញដាច់
  (`navigator.onLine`) ➜ ឈប់ស្ងាត់ «✅ បញ្ចូល N» (មិនប្រាប់ជួរដែលនៅសល់)។ ឥឡូវ ៖ ការព្យួរដំបូង ឬក្រៅបណ្តាញ ➜ ឈប់ភ្លាម ➜ «⏸️ មិនទាន់បញ្ចូល N (បណ្តាញមិនឆ្លើយ ➜ ឈប់)» ➜
  បញ្ជីនៅ ➜ ចុច «បញ្ចូល» ម្តងទៀត (កញ្ចប់ដែលបញ្ចូលរួចមិនស្ទួន ៖ `classifyZtoListRows()` + registry)។ claim ដែល **បដិសេធ** (មិនមែនព្យួរ) នៅបន្តជួរបន្ទាប់។
- **ការទាញពេញច្រើនទំព័រដាច់កណ្តាល ➜ ទិដ្ឋភាពខ្លីជាទិន្នន័យស្រស់** (SBD-5 · ហាង Supabase) ៖ cursor ចាស់ជាង purge (tombstone ចាស់ជាង ២ ថ្ងៃ) ➜ server reset ➜ ទំព័រទី ១
  សម្អាតទិដ្ឋភាព ➜ ទំព័របន្តធ្លាក់ (បណ្តាញ) ➜ មុនកែ ទិដ្ឋភាពនៅជាទំព័រទី ១ តែ `ready` ➜ listener/ផ្ទាំងដែលបើកក្រោយឃើញ **២ ក្នុងចំណោម ៩ កញ្ចប់** ជាទិន្នន័យស្រស់ (ស្ថិតិ ·
  Export · «គ្មានទិន្នន័យ»)។ ឥឡូវ ៖ ទំព័រ reset ចូល stage ដាច់ដោយឡែក ➜ ប្តូរតែពេលទំព័រចុងក្រោយ ➜ ចន្លោះនោះនៅជាទិដ្ឋភាពពេញចាស់ (ស្របគ្នា) · ការសរសេររបស់ឧបករណ៍នេះដែល
  commit ក្រោយ snapshot មិនបាត់ពេលប្តូរ · cache `zoe_docs` មិនរក្សាទុកពេល stage (cursor កណ្តាល + ទិដ្ឋភាពចាស់ = doc ខ្មោចពេលបើក App លើកក្រោយ)។
- **Lookup ស្កេន ៖ HTTP 200 តែ body ខូច** (ZTO-G3 · proxy/ប្រព័ន្ធ Wi-Fi កាត់ចម្លើយ · ទំព័រ HTML) ➜ មុនកែ `r.json().catch(() => null)` ➜ «⚠️ ZTO មិនឃើញទិន្នន័យសម្រាប់ Barcode
  នេះ» (អះអាងខុស) · មិនព្យាយាមឡើងវិញ · គ្មាន cooldown។ ឥឡូវ ៖ `LOOKUP_BAD_BODY` = ការបរាជ័យបណ្តោះអាសន្ន ➜ ព្យាយាមឡើងវិញម្តង ➜ «⚠️ ZTO ឆ្លើយមកខូច (មិនពេញលេញ) — សូមស្កេនម្ដងទៀត» ·
  cooldown បណ្តោះអាសន្ន។ (ZTO-G5 ផ្នែកនាំចូល ➜ ZTO-G4 ខាងលើ · sweep ស្ថានភាព ZTO ចាត់ body ខូចជា «បរាជ័យ» ត្រឹមត្រូវរួច ៖ វាស់ ៖ គ្មាន)
- **ទាញបញ្ជីពី ZTO ៖ ការផ្ទៀងអត្តសញ្ញាណបរាជ័យបណ្តោះអាសន្ន ≠ «គ្មានសាខា»** (ZTO-G2) ៖ Function ទាញ certs Google មិនបាន (`idtoken:certs`) · token ផុត/នាឡិកា
  (`idtoken:expired` · `future`) · `kid-unknown` · App យក ID token មិនបានក្នុង ៨ វិ. (`idtoken:missing`) ➜ មុនកែ «🏢 គណនីនេះគ្មានលេខសាខា ZTO — សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ»។
  ឥឡូវ ៖ «⚠️ ផ្ទៀងផ្ទាត់គណនីជាមួយ Server មិនបាន (reason) — សូមសាកម្ដងទៀត» · Server កំណត់ខុស (`idtoken:aud` · `iss` · `project-unset` ៖ `ZTO_LIST_SERVER_CONFIG_REASONS`) ➜
  «មុខងារបញ្ជីមិនទាន់កំណត់នៅ Netlify (reason)» · `site:*` ➜ «គ្មានលេខសាខា» ដដែល។
- **Function ZTO ៖ សំណើដែលចូលរួម run របស់អ្នកផ្សេង លើសថវិកា** (ZTO-G6) ៖ B ចាប់ផ្តើមមុន តែអាន Cookie store យឺត ➜ ចូលរួម run របស់ A (ចាប់ផ្តើមក្រោយ) ➜ រង់ចាំរហូត run
  ចប់តាមថវិការបស់ A ➜ មុនកែ B ឆ្លើយក្រោយ **7004 ms** (ថវិកា 6000)។ ឥឡូវ ៖ `joinWithinBudget()` ➜ ការរង់ចាំមានពិដានតាមថវិការបស់អ្នកចូលរួម ➜ `ZTO_TIMEOUT` (JSON) ទាន់ពេល។
- **នាឡិកាទូរស័ព្ទលឿន ~១ ម៉ោង** (G6 · ហាង Supabase) ៖ GoTrue ឲ្យ `expires_at` តាមម៉ោង Server ➜ supabase-js ប្រៀបជាមួយម៉ោងទូរស័ព្ទ ➜ token មើលទៅ «ផុត» រាល់ពេល ➜
  refresh ស្ទើររាល់ RPC (វាស់ ៖ ៥ RPC ➜ refresh ≥ ៤) ➜ GoTrue កំណត់ល្បឿន (429) ➜ supabase-js ចាត់ 429 ជាចុងក្រោយ ➜ **ចាកចេញ**។ ឥឡូវ ៖ 429 លើ refresh = បណ្តោះអាសន្ន
  (`sbSoftenRefreshRateLimit()` ➜ session នៅ ➜ RPC សាកឡើងវិញ) · App ព្រមានម្តង «⚠️ ម៉ោងលើឧបករណ៍នេះលឿនជាងម៉ោង Server ប្រហែល N នាទី — សូមបើក «កំណត់ម៉ោងស្វ័យប្រវត្តិ»…»
  (គម្លាត > `SB_CLOCK_SKEW_WARN_MS` ៥ នាទី · វាស់ពី `now` របស់ server)។ ការចូលប្រព័ន្ធដែលទទួល 429 នៅជាសារ «ព្យាយាមញឹកពេក»។ ⏳ ការកែគម្លាតម៉ោងក្នុង supabase-js
  ខ្លួនឯង (refresh ញឹក) មិនធ្វើ ៖ ត្រូវកែ `expires_at` ក្នុង storage (ហានិភ័យកែពីរដង) ➜ ការព្រមានឲ្យអ្នកប្រើកែម៉ោងជាដំណោះស្រាយ។
- **ដំឡើង SW ពេលបណ្តាញ «ភ្ជាប់តែស្លាប់»** (App ទាំង ២) ៖ ឯកសារ `OPTIONAL_SHELL` (រូបតំណាង · `manifest.json` · SheetJS) មួយដែល server មិនឆ្លើយ ➜ មុនកែ
  `.catch(() => {})` មិនជួយ (ព្យួរ ≠ បរាជ័យ) ➜ SW **ជាប់ `installing`** (វាស់ ៖ ៤៥ វិ. ហើយនៅតែ installing · បណ្តាញធម្មតា activate ក្នុង 176 ms) ➜ គ្មាន offline ·
  កំណែថ្មីមិនដល់ ទោះ CORE ចូល cache រួច។ ឥឡូវ ៖ ឯកសារ OPTIONAL នីមួយៗមានពិដាន `OPTIONAL_INSTALL_TIMEOUT_MS` (២០ វិ. · abort + resolve ដោយរចនាសម្ព័ន្ធ) ➜ SW activate ·
  ឯកសារដែលខ្វះចូល cache ពេលប្រើលើកដំបូងតាមផ្លូវ fetch ធម្មតា។ CORE នៅជាក្រុម atomic ដដែល (CORE ព្យួរ ➜ មិន activate)។
- 🔔 សារកំណែ 2.49.4 ជំនួស 2.49.3 (រួមចំណុច 2.49.3)។

#### អ្នកយាម

- `sw-install-integrity-test` ជុំទី ៦ (ថ្មី · browser ពិត · App ទាំង ២ · ធនធានដេរីវេពី `OPTIONAL_SHELL`/`CORE_SHELL` ពិត · ៤ សេណារីយ៉ូស្របគ្នា) ៖ tree មុនកែ **ធ្លាក់ ៤**
  (App ទាំង ២ ជាប់ installing · គ្មានពិដានក្នុងកូដ) ➜ **៣៧ ok** · ទិសផ្ទុយ ៖ CORE ព្យួរ ➜ មិន activate · ពិដានដេរីវេ ≤ ៦០ វិ.។
- `license-grace-test` (បន្ថែម ១១ · គ្មានការកែកូដ License ៖ កូដត្រឹមត្រូវ តែគ្មានអ្នកយាម) ៖ mutation «GET `license_keys` 5xx ➜ `ok:false`» និង «PUT seat បាត់ដោយបណ្តាញ ➜
  `seat-taken`» **រស់** គ្រប់ checker License ទាំង ៦ ➜ ឥឡូវ ក្រហម ៣ និង ២ (Server 500/503/429 ➜ មិនលុប · Activate «network» · PUT មិន commit ➜ មិនលុប · commit រួចតែបាត់ចម្លើយ ➜
  Activate ម្តងទៀតជោគជ័យ)។

- `ZoeW/tests/supabase-realtime-ws.test.ts` (ថ្មី · realtime-js ពិត + transport + adapter ទល់នឹង server Phoenix ក្លែងលើ `ws` ពិត) ៖ ៥ សេណារីយ៉ូ ➜ adapter `main` **ធ្លាក់ ២/៥**
  (server បិទ channel · បដិសេធ join ➜ មិន subscribe វិញ = SBD-6 ជាមួយ websocket ពិត) ➜ **៥/៥**។
- `ZoeW/tests/supabase-clock-skew.test.ts` (ថ្មី · supabase-js ពិត · adapter ពិត · SDK) ៖ tree មុនកែ **ធ្លាក់ ២/៥** (429 ➜ session ត្រូវលុប · គ្មានការព្រមាន) ➜ **៧/៧**
  (ទិសផ្ទុយ ៖ 400 នៅចាកចេញ · ចូលប្រព័ន្ធ 429 នៅ 429 · គម្លាតតិចជាងព្រំ ➜ គ្មានការព្រមាន)។ Mutation ៥ ➜ ក្រហម ៥។

- `ZoeW/tests/zto-list-identity.test.ts` (ថ្មី · `runZtoListSyncPreview()` ពិត) ៖ tree មុនកែ **ធ្លាក់ ៨/១២** ➜ **១២/១២** · Mutation (config Server ជាបណ្តោះអាសន្ន) ➜ ក្រហម ៣។
  `zto-budget-test` ផ្នែក ៩ (ថ្មី · ២ សំណើស្របគ្នា · store អានតាមលំដាប់ 2000/0 ms) ៖ Function មុនកែ **ធ្លាក់** (B 7004 ms > 6900) ➜ **៦៣ ok**។

- `lookup-failure-identity-test` ផ្នែក ២ខ (ថ្មី) ៖ fetch ក្លែងមុនមិនដែលហៅ body reader ➜ body ខូច **មិនអាចវាស់បាន** ➜ ជំហាន `badBody` ហៅ reader ពិតដោយ `json()` បដិសេធ ➜ tree មុនកែ
  **ធ្លាក់ ៣** ➜ **៥៣ ok**។ Mutation ៣ (គ្មាន retry · គ្មានសារ · គ្មានការចាប់) ➜ ក្រហម ៣។

- `ZoeW/tests/supabase-pull-paging.test.ts` (បន្ថែម ៣ · adapter ពិត) ៖ tree មុនកែ **ធ្លាក់ ១/៣** (listener ថ្មីឃើញ ២ ជំនួស ៩) ➜ **១៩/១៩**។ តេស្ត ២ ទៀតការពារហានិភ័យថ្មីរបស់
  stage (ការសរសេរ commit ក្រោយទំព័រចុងក្រោយ · cache កណ្តាល stage) ➜ ឆ្លងលើ tree មុនកែ ហើយចាប់ mutation។ Mutation ៦ ➜ ក្រហម ៤ · រស់ ២ (`pullStage = null` ពេលចាកចេញ ·
  ពេលហាងខុស ៖ cursor 0 តែងតែ reset ➜ stage ថ្មី) ➜ ដកចេញ។

- `zto-list-sync-test` ផ្នែក ៩ ៖ ការអះអាង ៣ ដែល **ចាក់សោកំហុសនេះ** (claim/ការរក្សាទុកព្យួរ ➜ `=== 2` ការព្យាយាម · ការដោះ ២) ➜ ១ · បន្ថែម ៖ ឈប់ក្រោយការព្យួរដំបូង · សារ
  «មិនទាន់បញ្ចូល» · បញ្ជីនៅ · សោដោះ · បណ្តាញដាច់កណ្តាល · claim បដិសេធ ➜ បន្ត · ចប់គ្រប់ជួរ ➜ សម្អាតបញ្ជី។ tree មុនកែ **ធ្លាក់ ៨** ➜ **៣៨៤ ok**។ Mutation ៦ ➜ ក្រហម ៦។

- `ZoeW/tests/supabase-unsent-tx.test.ts` (ថ្មី · adapter ពិត + transport ពិត + supabase-js ពិត) ៖ tree មុនកែ **ធ្លាក់ ៥/៩** (`unknown` ក្លែង · មិន commit ក្រោយ conflict ·
  transport មិនដាក់ `unsent` · subscribe តែម្តងទោះ `CLOSED`/`CHANNEL_ERROR`) ➜ **១៧/១៧**។ Mutation ១៣ ➜ ក្រហម ១៣ (ក្រោយបន្ថែមតេស្ត ៨ ដែល mutation ដំបូងរកឃើញថាខ្វះ ៖ ពិដាន
  ជំហាន token · 401 ➜ refresh បរាជ័យ · reset ជំហាន · channel ភ្ជាប់វិញខ្លួនឯង · CLOSED យឺតពី channel ចាស់ · timer ក្រោយ goOffline · `subscribe()` បោះ · CLOSED ២ ដង)។

- `ZoeW/tests/supabase-signout-offline.test.ts` (ថ្មី · supabase-js ពិត · fake timers) ៖ `main` មុនកែ **ធ្លាក់ ៤/៧** (13.4 វិ. · `Failed to fetch` · session នៅ storage · អ្នកបន្ទាប់ =
  `u1`) ➜ **៩/៩** (ទិសផ្ទុយ ៖ បណ្តាញល្អ ➜ Server លុបចោលដោយ token នោះ/token ថ្មី · storage លុបមិនចេញ ➜ បដិសេធ)។ Mutation ៦ ➜ ក្រហម ៥ · រស់ ១ (លុប account key ក្នុង
  transport ៖ adapter `setUser(null)` លុបរួច ➜ ដកចេញ)។
- `ZoeW/tests/supabase-offline-restore.test.ts` (ថ្មី · supabase-js ពិត + transport ពិត + adapter ពិត · fake timers · ផ្នែកថ្នេរ ៖ transport ក្លែង) ៖ កូដ `main` មុនកែ
  **ធ្លាក់ ៦/៩** (គ្មានចម្លើយក្នុង 7.5 វិ. · បណ្តាញត្រឡប់ ១២០ វិ. ➜ `currentUser` នៅ `null` · GoTrue 503 ➜ គ្មានចម្លើយ · គ្មានសារមូលហេតុ ២) ➜ **១៤/១៤** (រួម ៖ ក្រៅបណ្តាញ
  ៤០ វិ. ➜ `getIdTokenResult()` ឲ្យ `authTime` ពី token ចាស់ក្នុងពិដាន ១៥ វិ. ➜ ច្បាប់ ៤ ម៉ោងនៅរស់)។ Mutation ១០ ➜ ក្រហម ៩ ·
  រស់ ១ (ការពិនិត្យ `refresh_token` ក្នុង session ពី storage ៖ supabase-js លុប session មិនត្រឹមត្រូវដោយខ្លួនឯងរួច ➜ ដកចេញ មិនទុកកូដគ្មានអ្នកវាស់)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Merge ➜ Netlify deploy `zoew` **និង `zoekeygen`** (`sw.js`) · build APK ថ្មី (workflow `Android APK` លើ `main`)។ គ្មាន rules · migration · Edge Function។
- ⏳ សាកលើឧបករណ៍ពិត (ហាង Supabase) ៖ ចូល ➜ បិទ App ទុក ១-២ ម៉ោង (តិចជាង ៤ ម៉ោង) ➜ បិទ Wi-Fi/Data ➜ បើក App ➜ ត្រូវនៅក្នុងប្រព័ន្ធ (មិន reload · គ្មានប្រអប់ចូល · ស្ថានភាព
  «ក្រៅបណ្ដាញ») ➜ បើកបណ្តាញ ➜ ទិន្នន័យទាញខ្លួនឯង (មិនវាយពាក្យសម្ងាត់)។
- ⏳ ចាកចេញ ៖ បិទបណ្តាញ ➜ ចុចចាកចេញ ➜ ត្រូវចេញក្នុង ~៣ វិ. («✅ បានចាកចេញ») ➜ បិទ/បើក App (មានបណ្តាញ) ➜ ត្រូវឃើញប្រអប់ចូល (មិនចូលគណនីមុនខ្លួនឯង)។

### [2.49.3] — 2026-10-04 · ZoeW ៖ **ហាង Supabase ៖ ចូលប្រព័ន្ធវិញក្រោយផុតកំណត់ ៤ ម៉ោង ឃើញទិន្នន័យគ្រប់ · ទិន្នន័យ/ការសរសេររបស់គណនីមួយមិនឆ្លងទៅគណនីផ្សេង · gateway 5xx មិនរាប់ចំណូល ២ ដង** (រាយការណ៍ដោយម្ចាស់គម្រោង + Deep audit ជុំ ២)

**ZoeW `2.49.3`** (`zoew-v258` ➜ `zoew-v259`) · ZoeKeyGen មិនប្រែ។ ⛔ Firebase rules · migration · Edge Function **មិនប្រែ**។ ប៉ះតែ adapter Supabase
(`src/services/supabase-rtdb.ts` · `supabase-transport.ts`) និង `src/domain/ledger.ts` (`runLedgerTransaction()` ប៉ះ backend ទាំង ២)។

#### អ្វីដែលខុសពីមុន

- **រាយការណ៍** ៖ ក្រោយផុត ៤ ម៉ោង ចូលវិញដោយពាក្យសម្ងាត់ដែលចងចាំ ➜ ឧបករណ៍មួយ «គ្មានទិន្នន័យសោះ» · ឧបករណ៍មួយទៀត «តែ ២-៣ កញ្ចប់» · ចាកចេញ ➜ វាយពាក្យសម្ងាត់ចូល ➜
  ត្រឹមត្រូវ។ **មិនមែនមកពីការចងចាំពាក្យសម្ងាត់ទេ** ៖ បើក App ក្រោយ ៤ ម៉ោង ➜ token ផុត ➜ refresh ➜ adapter យកទិន្នន័យពី cache ហើយទាញ delta (`p_since > 0`) ➜
  ការផុតកំណត់ ៤ ម៉ោងចាកចេញ **កណ្តាលការទាញ** ➜ ចម្លើយ delta ចាស់មកដល់ក្រោយការសម្អាត ➜ ដាក់ cursor = head លើទិន្នន័យទទេ ➜ ចូលវិញទាញតែអ្វីដែលប្រែក្រោយ head ➜
  «គ្មាន» (cache ថ្មី) ឬ «តែកញ្ចប់ដែលប្រែថ្មីៗ» (cache ចាស់) ខណៈស្ថានភាព «ភ្ជាប់ Server រួចរាល់» បៃតង។ ចាកចេញដោយដៃកើតពេលស្ងៀម ➜ គ្មានចម្លើយចាស់ ➜ ត្រឹមត្រូវ។
- ឥឡូវ ៖ សម័យចូលប្រព័ន្ធមួយជា epoch (`sessionEpoch`) ៖ ចម្លើយទាញ ឬលទ្ធផលសរសេរដែលមកក្រោយ `resetForSignOut()` ត្រូវបោះចោល ➜ ចូលវិញទាញពីដើម (`p_since = 0`)។
- **ផលបន្ទាប់ដែលវាស់ឃើញក្នុងថ្នាក់ដដែល** (ឧបករណ៍ដែលប្រើគណនីច្រើន) ៖ (ក) ចម្លើយចាស់របស់ហាង A លេចក្នុងហាង B ដែលចូលបន្ទាប់ · (ខ) ការសរសេរ/transaction ដែលរង់ចាំពេល
  ក្រៅបណ្តាញក្នុងហាង A ត្រូវផ្ញើក្រោម token ហាង B ➜ សរសេរចូលហាង B។ ឥឡូវ ការសរសេរ/transaction ជាប់គណនីដែលបង្កើតវា (`authScope`) ៖ គណនីដដែលចូលវិញ ➜ ផ្ញើ
  (ការងារពេលក្រៅបណ្តាញមិនបាត់) · គណនីផ្សេង ➜ បដិសេធ មិនផ្ញើ មិនបង្ហាញ។
- **token ផុត + ចូលប្រព័ន្ធ (GoTrue) មិនឆ្លើយបណ្តោះអាសន្ន** (Deep audit ជុំ ២ G1 · ទូរស័ព្ទដេកលើស ១ ម៉ោង ហើយភ្ញាក់ពេលអ៊ីនធឺណិតខ្សោយ > ~២៥ វិ.) ៖ supabase-js ឈប់សាក
  ហើយឲ្យ `session: null` ៦០ វិ. ខណៈ session នៅក្នុងទូរស័ព្ទ ➜ មុនកែ `rpc()` ផ្ញើ **ដោយគ្មាន token** (~២៦ សំណើ) ➜ 401 ➜ «គ្មានសិទ្ធិ» ចុងក្រោយ ៖ ការបិទកញ្ចប់ពេល
  ក្រៅបណ្តាញ **ត្រូវបោះចោល** («⚠️ បរាជ័យក្នុងការ Save ស្ថានភាព…») · listener ៧ ធ្លាក់ (ចំណូល «—») · transaction ដែលចម្លើយបាត់ ➜ `unknown` (Sentry money)។ ឥឡូវ ៖
  session នៅ ➜ `SbNetworkError('auth-unavailable')` (បណ្តោះអាសន្ន ➜ សាកឡើងវិញ) · session ត្រូវ supabase-js លុប (refresh token មិនត្រឹមត្រូវ) ➜ ឥរិយាបថដើម។
- **ការកាត់ ledger ដែល backend ដឹងច្បាស់ថា «មិនបានអនុវត្ត» បាត់** (ឧបករណ៍ ៣ ក្នុងហាងតែមួយ · Supabase) ៖ «ដក» barcode ➜ ការផុតកំណត់ ៤ ម៉ោងចាកចេញចំពេល transaction
  ledger ថ្ងៃ ឬប្រវត្តិកំពុងរត់ ➜ ចូលវិញ ➜ replay `op_id` ប៉ះ conflict ព្រោះឧបករណ៍ផ្សេងស្កេនបន្ត ➜ `not-applied` ➜ `runLedgerTransaction()` បោះបង់ ➜ **ខែត្រូវកាត់ ថ្ងៃមិនកាត់**
  (ledger ថ្ងៃ `38.5/0.75/29` ធៀបកញ្ចប់ `35/0.5/28` · `money-reality-check` «ខែឃ្លាតពីផលបូកថ្ងៃ») · ករណីប្រវត្តិ **គ្មានសារព្រមាន**។ មានតាំងពី 2.49.2 (snapshot មុនកែ ៖
  ធ្លាក់ ២/៣ ដូចគ្នា)។ ឥឡូវ ៖ `not-applied` ច្បាស់ ➜ ផ្ញើម្តងទៀត (≤ ៣ · ប៉ារ៉ាម៉ែត្រ `notAppliedRetries` · `op` ដដែល) · `unknown` មិនផ្ញើម្តងទៀត (ប្រហែលចូលរួច)។
  Firebase ៖ wrapper ឲ្យ `not-applied` តែពេល server ស្មើតម្លៃមុន ➜ ករណីឧបករណ៍ផ្សេងសរសេរ path ដដែលនៅតែ `unknown` (ចន្លោះចាស់ ផ្នែក ២ ជុំ ១)។
- 🔔 សារកំណែ 2.49.3 ជំនួស 2.49.2 (រួមចំណុច 2.49.2 ព្រោះ 2.49.2 មិនទាន់ដល់អ្នកប្រើ)។
- **gateway 5xx ក្រោយ commit ➜ ចំណូលរាប់ ២ ដង** (Deep audit ជុំ ២ SBD-3 · លុយ) ៖ API gateway របស់ Supabase (Kong/Envoy/Cloudflare) ឆ្លើយ 502/503/504/52x ពេលបាត់ចម្លើយ
  PostgREST (instance restart · upstream timeout) ខណៈ Postgres **commit រួច** ➜ មុនកែ `rpc()` បោះ `SbRpcError` ➜ adapter ចាត់ជាការបដិសេធចុងក្រោយ (គ្មាន `txOutcome`) ➜
  `ledgerRejectionVerdict()` = null ➜ reconcile សរសេរ delta ម្តងទៀត ➜ **ថ្ងៃ $20 · ខែ $10 សម្រាប់កញ្ចប់ $10** (វាស់ដោយ finder លើកូដ ledger ពិត) · ការសរសេរធម្មតា (បិទកញ្ចប់ ·
  ស្កេន) ត្រូវបោះចោលភ្លាម · `.info/connected` នៅ `true` រហូត ៥ នាទី ខណៈការសរសេរគ្រប់ធ្លាក់ (SBD-4)។ ឥឡូវ ៖ `sbStatusIsGateway()` ➜ `SbNetworkError` ➜ op_id ដដែល
  ផ្ញើម្តងទៀត (server dedupe) ➜ `applied` តែម្តង · ស្ថានភាពក្លាយ «មិនទាន់ភ្ជាប់»។ កំហុស PostgREST ពិត (4xx · 500 JSON) នៅតែចុងក្រោយ។ ចូលប្រព័ន្ធពេល `my_account` ទទួល 5xx ➜
  «ភ្ជាប់ Server មិនបានទេ» (មិនមែន «ចូលប្រព័ន្ធមិនបានទេ (503)»)។
- **ទាញបញ្ជីពី ZTO ៖ ជួរដែល ZTO បិទរួច មិនចូលស្ថិតិយក** (Deep audit ជុំ ២ ZTO-G1) ៖ ការរក្សាទុក commit យឺតលើសពិដាន ១៥ វិ. ➜ callback ពេលក្រោយគ្រាន់តែ refresh ទិដ្ឋភាព ·
  ការរក្សាទុកឆ្លើយ `false` (កញ្ចប់ចុះរួច · ការផ្ទៀងចំណូលមិនទាន់បញ្ជាក់) ➜ រាប់ជា «⚠️ បរាជ័យ» ➜ ករណីទាំងពីរ `markZtoListRowPickedUp()` មិនរត់ ➜ កញ្ចប់បិទក្នុងប្រវត្តិ តែ
  `pickedUpBarcodes` និង mirror ចំណូលប្រចាំថ្ងៃ (`zoew_daily_collected_cod_dod`) គ្មាន ➜ ស្ថិតិ «យករួច» និងចំណូលប្រចាំថ្ងៃតាមថ្ងៃយកទាបជាងការពិត (ledger ចំណូលមិនប៉ះ)។ ឥឡូវ ៖
  commit យឺត ➜ សរសេរស្ថិតិយកពេល commit មកដល់ · `false` ➜ រាប់ជា «បញ្ចូល» ហើយសរសេរស្ថិតិយក។

#### អ្នកយាម

- `ZoeW/tests/supabase-signout-race.test.ts` (ថ្មី · adapter ពិត) ៖ adapter មុនកែ **ធ្លាក់ ៣/៤** (cursor ១២ ជំនួស ០ · តែ ២ កញ្ចប់ · `secretA` របស់ហាង A លេចក្នុងហាង B)
  ➜ ការកែ epoch ៖ **៤/៤** · ផ្នែកការសរសេរ/transaction ៖ មុនកែ **ធ្លាក់ ២/៣** (ការសរសេរ និង CAS ផ្ញើទៅហាង B) ➜ **៧/៧** (ទិសផ្ទុយ ៖ គណនីដដែលចូលវិញ ➜ ការសរសេរដល់ server ម្តង)។
- **Firebase (backend បងប្អូន) ៖ វាស់លំហូរដដែល គ្មានកំហុស** ៖ SDK Firebase ពិត + RTDB emulator ពិត + rules ពិត · token ផុត ➜ refresh (`auth_time` ៦.៥/៧ ម៉ោងមុន) ➜
  ផុតកំណត់ ➜ ចូលវិញដោយពាក្យសម្ងាត់ដែលចងចាំ ➜ **៣៣/៣៣ ៣ ដងក្នុង ៣** (រួមកញ្ចប់ ៣ ដែលឧបករណ៍ផ្សេងបន្ថែមពេលដេក) ➜ ចាក់សោជា `emu/app-network-e2e-test` ផ្នែក **ឈ**
  (៣០/៣០ · mutation លុប `isDatabaseInitialized = false` ពេល auth ទទេ ➜ **ធ្លាក់** `history 0` ខណៈស្ថានភាពបៃតង)។
- ឧបករណ៍ ៣ ក្នុងហាងតែមួយ (harness workflow ៖ App ពិត ៣ context · supabase-js ពិត · Postgres ពិត) ៖ ស្កេនព្រមគ្នា · បិទ/បើកព្រមគ្នា · ដកជួរដដែល · កែតម្លៃ vs បិទ ·
  កែតម្លៃ vs ដក ➜ **ឧបករណ៍ទាំង ៣ ឃើញដូច server** (convergence ≤ ~០.៦ វិ.) · គ្មាន barcode ស្ទួន · `money-reality-check` ✅។ s6b (ផុតកំណត់ចំពេលដក) ៖ build មុនកែ **ធ្លាក់
  ២/៣** ➜ build កែ **៣/៣** + `money-reality-check` ✅។ `ZoeW/tests/ledger-not-applied-retry.test.ts` (ថ្មី) ៖ មុនកែ **ធ្លាក់ ២/៤** ➜ **៤/៤**។ ⛔ មេរៀន ៖ ថេរថ្មីនៅខាងក្រៅអនុគមន៍ ➜ checker ១២ ដែលដកតែអនុគមន៍តាមឈ្មោះធ្លាក់ (CI PR #284) ➜ ប៉ារ៉ាម៉ែត្រលំនាំដើម។ ⏳ សារ «⚠️ … ស្ថិតិប្រាក់មិនទាន់
  Sync ពេញលេញទេ» នៅលេចក្នុង s6b ទោះលុយត្រូវចុងក្រោយ (ប្រុងប្រយ័ត្នលើស មិនមែនលុយខុស)។
- `ZoeW/tests/supabase-auth-unavailable.test.ts` (ថ្មី · supabase-js ពិត · fake timers) ៖ transport មុនកែ **ធ្លាក់ ២/៤** (`SbRpcError: JWT required` ពីសំណើគ្មាន token)
  ➜ **៤/៤** (ទិសផ្ទុយ ៖ refresh token មិនត្រឹមត្រូវ ➜ 401 ពិត · មិនទាន់ចូល ➜ សំណើធម្មតា)។ សេណារីយ៉ូ node របស់ finder (GoTrue ក្លែងមាន reuse interval) លើកូដកែ ៖
  n2 ការសរសេររក្សាទុក (server `2`) · listener ធ្លាក់ ០ · សំណើគ្មាន token ០ · n2tx `applied` · n9 (GoTrue 503) listener ធ្លាក់ ០។ ⏳ ចំណុចនៅសល់ ៖ ការសរសេររង់ចាំ
  រហូត cooldown ៦០ វិ. របស់ supabase-js ចប់ (មិនបាត់ · ស្ថានភាពមិនបៃតង)។
- `supabase-app-network-e2e-test` ផ្នែក **ជ** (App ពិត · supabase-js ពិត · Postgres ពិត) ៖ ចូលដោយចងចាំពាក្យសម្ងាត់ ➜ បើក App ក្រោយ ៦.៥ ម៉ោង (token ផុត ➜ refresh ·
  `setAuthAge`) ➜ ផុតកំណត់ ➜ ចូលវិញ ➜ build មុនកែ **ធ្លាក់ ២** (`history 1` ក្នុងចំណោម ៧ · ការទាញដំបូង `p_since = 6`) ➜ ក្រោយកែ ៖ ៧/៧ + `p_since = 0`។ ⛔ មេរៀន ៖ race
  នេះជាពេលវេលារបស់ App ពិត ➜ ការពន្យារ `my_account` ឬការសាកច្រើនដងមិនគ្រប់គ្រងវាទេ ➜ init script ពន្យារការពិនិត្យ ៤ ម៉ោងរហូត `zoe_pull` ចេញ (ផ្នែក ២ «run-all ៖ … ពឹងពេល»)។

- `ZoeW/tests/supabase-gateway-5xx.test.ts` (ថ្មី · transport ពិត + supabase-js ពិត + adapter ពិត · fetch ក្លែងមាន op_id dedupe) ៖ កូដមុនកែ **ធ្លាក់ ៨/១០** (502/503/504/520/524 ➜
  `SbRpcError` · transaction ledger commit ➜ 504 ➜ `HTTP 504` បដិសេធ · ការសរសេរ commit ➜ 502 ➜ បដិសេធ · 503 មុន commit ➜ បោះចោល) ➜ **១០/១០** (ទិសផ្ទុយ ៖ 400/403/500 JSON
  នៅ `SbRpcError` · 400 JSON ➜ បដិសេធភ្លាម មិនផ្ញើម្តងទៀត)។
- `zto-list-sync-test` ផ្នែក ១៦ (បន្ថែម) ៖ ជួរ «យករួច» commit យឺត · ឆ្លើយ `false` · ទិសផ្ទុយ commit យឺតបដិសេធ ➜ កូដមុនកែ **ធ្លាក់ ៣** (`applyBarcodeCloseChange()` ០ ដង ·
  សារ «✅ បញ្ចូល 0 កញ្ចប់ · ⚠️ បរាជ័យ 1») ➜ ក្រោយកែ ឆ្លង។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Merge ➜ Netlify deploy `zoew` · build APK ថ្មី (workflow `Android APK` លើ `main`)។ គ្មាន rules · migration · Edge Function។
- ⏳ សាកលើឧបករណ៍ពិត (ហាង Supabase) ៖ ចូលដោយធីក «ចងចាំពាក្យសម្ងាត់» ➜ ទុក App ៥-៧ ម៉ោង (ឬយប់ទាំងមូល) ➜ បើកវិញ ➜ សារ «⏱️ ផុតកំណត់ ៤ ម៉ោង» ➜ ចុច «ចូលប្រព័ន្ធ» ➜
  ចំនួនកញ្ចប់ត្រូវដូចឧបករណ៍ផ្សេង (ឬដូចពេលចាកចេញ ➜ ចូលវិញ)។

### [2.49.2] — 2026-10-03 · ZoeW · ZoeKeyGen `2.24.4` ៖ **បណ្តាញដាច់ចំពេលរក្សាទុក ➜ App រង់ចាំលទ្ធផលពិត (មិនទាយ) · Sentry Loader ថ្មី** (Deep audit ជុំ ១ ៖ លុយ)

**ZoeW `2.49.2`** (`zoew-v257` ➜ `zoew-v258`) · **ZoeKeyGen `2.24.4`** (`zoekeygen-v114` ➜ `zoekeygen-v115` ៖ Sentry Loader តែប៉ុណ្ណោះ)។ ⛔ Firebase rules ·
migration · Edge Function **មិនប្រែ**។ backend ទាំង ២ (Firebase · Supabase)។

#### អ្វីដែលខុសពីមុន

- **transaction ដែលបណ្តាញដាច់ចំពេល server ឆ្លើយ** (ចម្លើយបាត់) ៖ App រង់ចាំលទ្ធផលពិតរហូតបណ្តាញត្រឡប់ — Firebase អាន server តាម REST (ចន្លោះ ២ ➜ ៣០ វិ. ·
  ក្រៅបណ្តាញ ➜ ត្រឡប់ ២ វិ.) · Supabase ផ្ញើ `op_id` ដដែល (`zoe_ops` ២ ថ្ងៃ) — **មិនបោះបង់ក្រោយ ៦០ វិ. ទៀតទេ**។ មុនកែ ៖ App ទាយ «មិនបានអនុវត្ត» ➜
  (ក) «ដក» barcode ៖ «⚠️ ដកមិនបានជោគជ័យ» ខណៈ server បានដក ➜ **កញ្ចប់បាត់** ពីប្រវត្តិ និងធុងសំរាម · ledger មិនដក · (ខ) ការផ្ទៀងចំណូល ដកម្តងទៀត ➜ ថ្ងៃ
  100 ➜ **90** + `ok: true`។ ឥឡូវ ៖ សារ «⏳ … នឹងបញ្ចប់ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ» ជាការពិត ៖ ដល់ server ➜ ចូលធុងសំរាម + ដកម្តង · មិនដល់ ➜ នៅប្រវត្តិ
  + «ដកមិនបានជោគជ័យ»។ transaction ថ្មីលើ path ដដែល (ឧ. ស្កេនបន្តពេលបណ្តាញដាច់) រង់ចាំលទ្ធផលមុន (Firebase · ដោះក្រោយការអានបរាជ័យ ៣ ដងពេលលើបណ្តាញ)។
- **outcome ដែលនៅតែមិនដឹង** (server បដិសេធការអាន · ប្តូរ auth/database · adapter បិទ ៖ `txServerUnread`) ➜ ការផ្ទៀងចំណូលមិនរាយ ✅ ➜ «⚠️ … ស្ថិតិប្រាក់មិនទាន់
  Sync ពេញលេញទេ! សូមប្រាប់ Admin» + Sentry `zone: 'money'` (ចំនួនប្រាក់ដែលសរសេរដូចមុន)។
- **Sentry** ៖ Loader ថ្មី `js.sentry-cdn.com/08e04427…` (Project `javascript-react` · SDK v11) ក្នុង App ទាំង ២ (`async` ដដែល) — Project ចាស់ត្រូវលុប ➜ គ្មាន
  event ចាប់តាំងពីនោះ (event `zone: money` ចុងក្រោយ 2026-09-25)។
- 🔔 សារកំណែ 2.49.2 ជំនួស 2.49.1។

#### អ្នកយាម

- `tx-outcome-test` ៖ tree មុនកែឫស **FAIL ២២** ➜ **៩២/៩២** (ផ្នែក ២ រង់ចាំ ➜ applied · បដិសេធ HTTP មានព្រំដែន · ប្តូរ auth ឈប់ · ៤គ សាលក្រមពិត · ៤ឃ reconcile ត្រូវម្តង
  ទិស applied/lost × ថ្ងៃ/ខែ · ៦ «ដក» មិនបាត់ · ៧ ទ្វារតាម path + ដោះពេលជាប់ + ចន្លោះ ២ វិ. ពេលក្រៅបណ្តាញ)។ `ZoeW/tests/supabase-tx-outcome.test.ts` (ថ្មី) ៖ adapter ចាស់
  **ធ្លាក់ ២/៥** ➜ **៥/៥** · `ZoeW/tests/tx-outcome-timeout.test.ts` **៦/៦** · `emu/supabase-adapter-parity` **៩០** · `history-patch-retry-test` **១២៨** · `emu/tx-disconnect` **២៥**។
- Mutation ៖ ledger ៦ ➜ ក្រហម ៦ · ការកែឫស ៨ ➜ ក្រហម ៨ (ផ្នែក ២)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Merge ➜ Netlify deploy `zoew` **និង** `zoekeygen` · build APK ថ្មី (workflow `Android APK` លើ `main`)។ គ្មាន rules · migration · Edge Function។
- **Sentry** ៖ ក្រោយ deploy បើក App ➜ Sentry Project `javascript-react` ➜ Issues ត្រូវឃើញ event (ឧ. ពី 🩺 ឬកំហុសណាមួយ) · **បង្កើត Alert rule ឡើងវិញ** លើ tag
  `zone:money` (rule ចាស់នៅក្នុង Project ដែលលុប)។
- ⛔ សាកលើឧបករណ៍ពិត ៖ ការដាច់ **ចំពេល** server ឆ្លើយ ពិបាកបង្កើតដោយដៃ ➜ ក្នុងការប្រើធម្មតា «អ្នកនឹងមិនឃើញអ្វីទេ»។ ការសាកដែលធ្វើបាន ៖ បើកពេលហោះ (Airplane) ភ្លាមក្រោយ
  ចុច «ដក» ➜ សារ «⏳ … នឹងបញ្ចប់…» ➜ បិទពេលហោះ ➜ កញ្ចប់ចូលធុងសំរាម (ឬនៅប្រវត្តិ ប្រសិនបើសំណើមិនទាន់ចេញ) — **មិនបាត់ពីទាំង ២ កន្លែង**។

### [2.49.1] — 2026-10-03 · ZoeW ៖ **ខ្សែរមូរបាត់ភ្លាមពេលប្រអប់ប្រវត្តិធ្លាក់ចុះ**

**ZoeW `2.49.1`** (`zoew-v256` ➜ `zoew-v257`) — ឈរលើ [2.49.0] (merge រួច ៖ PR #282)។ ⛔ Firebase rules · Supabase · ZoeKeyGen **មិនប្រែ**។
រាយការណ៍ពីម្ចាស់គម្រោង (វីដេអូ APK) ៖ «Scrollbar សល់នៅក្រៅ បន្ទាប់ពីប្រអប់ប្រវត្តិធ្លាក់ចុះ»។

#### អ្វីដែលខុសពីមុន

- **ខ្សែរមូរ (APK · iPhone PWA)** ៖ ផ្ទាំងរមូរផ្លាស់ទីដោយគ្មានការរមូរ (ប្រអប់ប្រវត្តិធ្លាក់ចុះ/ឡើងវិញ) ➜ ខ្សែបាត់ភ្លាម (គ្មាន fade · class `cut`) មិននៅទីតាំងចាស់ក្រៅប្រអប់
  (វីដេអូ ៖ ខ្សែនៅលើប្រអប់ស្ថិតិ ~០.៧ វិ.) ៖ ពេលខ្សែកំពុងលេច វាពិនិត្យទីតាំងផ្ទាំងរៀងរាល់ frame (`scrollerMoved()` · ឈប់ពេលលាក់) ➜ រមូរម្តងទៀត ➜ លេចត្រង់ទីតាំងថ្មី។
  ⛔ PTR · ចលនាផ្ទាំង · ភាពរលូនពេលរមូរ មិនប៉ះ (ខ្សែនៅជា overlay `pointer-events: none` ដដែល)។
- 🔔 សារកំណែ 2.49.1 ជំនួស 2.49.0 (ចំណុចដដែល · ខ្សែបាត់ពេលប្រអប់ផ្លាស់ទី)។

#### អ្នកយាម

- `ZoeW/tests/scroll-thumb.test.tsx` ៖ ផ្ទាំងផ្លាស់ទីគ្មានការរមូរ ៖ មុនកែ **FAIL** (ខ្សែនៅ `shown`) ➜ **១០/១០** · ផ្ទាំងនៅនឹងកន្លែង ➜ ខ្សែនៅលេចរហូតដល់ស្ងៀម ·
  mutation ៤ (គ្មានអ្នកពិនិត្យ · មិនដែលឃើញការផ្លាស់ទី · ឃើញជានិច្ច ➜ លាក់មុនពេល · fade ជំនួស `cut`) ➜ ក្រហម ៤។
- CI (audit-tools · តេស្តតែប៉ុណ្ណោះ ៖ ផ្នែក ២) ៖ `supabase-docs-cache` រកប្រភពក្នុង repo · `remember-password` · `login-routing` លែងផុយក្រោមបន្ទុក (`async-settle`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Merge ➜ Netlify deploy `zoew` · build APK ថ្មី (workflow `Android APK` លើ `main`)។ គ្មាន rules · migration · Edge Function ត្រូវ deploy
  (migration ១០ · Edge v10 នៅ live រួច ៖ [2.49.0])។
- APK + iPhone PWA ៖ រមូរតារាងប្រវត្តិ រួចទាញប្រអប់ប្រវត្តិចុះភ្លាម ➜ ខ្សែស្តើងបាត់ភ្លាម មិនសល់លើប្រអប់ស្ថិតិ · រមូរម្តងទៀត ➜ លេចត្រង់គែមតារាង ·
  ⛔ PTR · ចលនាផ្ទាំង · ភាពរលូនពេលរមូរ នៅដដែល។

### [2.49.0] — 2026-10-03 · ZoeW · ZoeKeyGen `2.24.3` ៖ **ចងចាំពាក្យសម្ងាត់ (checkbox) · ខ្សែរមូរលើ APK/iPhone · ហាង Supabase ៖ ការចុះឈ្មោះដែលដាច់កណ្តាលទីបន្តបាន · ZoeKeyGen ៖ modal តាមទំហំអេក្រង់ · គ្មាន emoji មុខឈ្មោះគណនី · 🔔 កញ្ចប់ដែលដករួច · ហាង Supabase ទាញតែទិន្នន័យថ្មី (cache)**

**ZoeW `2.49.0`** (`zoew-v255` ➜ `zoew-v256`) — ឈរលើ [2.48.2] (PR #281 មិនទាន់ merge ➜ branch នេះរួម 2.48.2 ទាំងមូល) ·
**ZoeKeyGen `2.24.3`** (`zoekeygen-v113` ➜ `zoekeygen-v114`)។ ⛔ Firebase rules **មិនប្រែ** · Supabase ៖ migration ថ្មី **៤** + Edge Function `register` ប្រែ។
សំណើម្ចាស់គម្រោង ៖ «Checkbox ចងចាំ Password login … ដកធីកបានដោយខ្លួនឯង» · «ដាក់ scrollbar សម្រាប់ APK និង PWA iOS … ដាក់តូចកុំបាំងអីផ្សេង» ·
«ពិនិត្យ modal ទាំងអស់អោយឆ្លាស់ទំហំតាមប្រភេទអេក្រង់ (ZoeKeyGen និង ZoeW)» · «ដក emoji ពីមុខ username ក្នុង ZoeKeyGen» · «ក្នុងជូនដំណឹងបន្ថែមប្រាប់ពីកញ្ចប់ដែលដករួចផង» · Handoff ជំហាន ២ (register) · ៤ (cache IndexedDB)។

#### អ្វីដែលខុសពីមុន

- **ប្រអប់ចូល ៖ «ចងចាំពាក្យសម្ងាត់លើឧបករណ៍នេះ»** (លំនាំដើមធីក · backend ទាំង ២)។ ចូលជោគជ័យ + «ចងចាំគណនី» ធីក ➜ ពាក្យសម្ងាត់រក្សាជា
  **អក្សរកូដ AES-GCM** ដោយ key **មិនអាចនាំចេញ** ក្នុង IndexedDB (`zoew_lookup_key_v1` · ធាតុ `rememberedLoginPassword`) ចងនឹង backend + Project +
  ឈ្មោះគណនី (additional data) ➜ អក្សរធម្មតាមិនចូល storage ណាមួយ។ ផុត ៤ ម៉ោង ➜ ប្រអប់ចូលបំពេញពាក្យសម្ងាត់ ⛔ **មិនចូលដោយខ្លួនឯង** (ច្បាប់ ៤ ម៉ោងនៅដដែល)។
  ដកធីក ➜ លុបភ្លាម + ចងចាំជម្រើស (`zoew_remember_password_v1` = `'0'`) · ចាកចេញ · ប្តូរពាក្យសម្ងាត់ដោយកូដ · ដក «ចងចាំគណនី» ➜ លុប។
  ការបំពេញមិនសរសេរជាន់អ្វីដែលអ្នកប្រើវាយ · គ្មាន IndexedDB ➜ ចូលបានធម្មតា (មិនចងចាំ)។
- **Edge Function `register`** ៖ `createUser` ឆ្លើយបាត់ (Auth បង្កើតរួច តែគ្មានសមាជិកភាព) ឬ App ផុតពិដានខណៈ Server បញ្ចប់ ➜ ចុះឈ្មោះម្តងទៀតដោយ
  **ឈ្មោះ + ពាក្យសម្ងាត់ដដែល** ➜ Server បញ្ជាក់ពាក្យសម្ងាត់ជាមួយ Auth (client ថ្មីរាល់ការហៅ · ផ្តាច់ session ផ្ទៀងផ្ទាត់ `scope=local`) រួចហៅ
  `finish_registration` (idempotent) លើ user id នោះ ➜ `200 registered`។ ពាក្យសម្ងាត់ផ្សេង ➜ `409 username-taken` (ដូចមុន) · Auth មិនឆ្លើយ ➜ `502 auth-unavailable` ·
  ⛔ ផ្លូវបន្តមិនលុបគណនីដែលសំណើនោះមិនបានបង្កើត។
- **ខ្សែរមូរ (APK · iPhone PWA តែប៉ុណ្ណោះ)** ៖ iOS WebKit មិនគូរ `::-webkit-scrollbar` ➜ App គូរខ្សែ ៣px ពណ៌ប្រផេះខ្លួនឯង (`ScrollThumb` · ធាតុ `position: fixed`
  `pointer-events: none`) ៖ លេចពេលរមូរបញ្ឈរ · បាត់ក្រោយស្ងៀម ៩០០ms · មិនជាន់ navbar/របា Tab (លើកលែងក្នុង modal/drawer) · listener scroll តែមួយ (passive · capture ·
  rAF)។ ⛔ មិនប្តូរ layout · មិនប៉ះ PTR/ចលនាផ្ទាំង · web/PWA Android/desktop គ្មាន listener គ្មានធាតុ (`drawsOwnScrollThumb()`)។
- **ZoeKeyGen ៖ modal តាមទំហំអេក្រង់** ៖ ទទឹងជា «ឯកតាអក្សរ» (`calc(var(--modal-w) * var(--fs-unit))`) ជំនួស px ថេរ ➜ ទូរស័ព្ទស្ទើរដូចដើម · tablet/desktop
  រីកតាមអក្សរ (ប្រអប់ PIN 300 ➜ 405px លើ 1920px)។ ZoeW ៖ វាស់រួច មិនប្តូរ (រីកតាមអេក្រង់ស្រាប់)។
- **ហាង Supabase ៖ ចុះឈ្មោះម្តងទៀតក្រោយ App អស់ពេលរង់ចាំ** ៖ កូដអញ្ជើញប្រើបាន ១ ដង + បណ្តាញយឺត (App ឈប់រង់ចាំ ២០ វិ. ខណៈ Edge Function ចុះឈ្មោះរួច) ➜
  ចុះឈ្មោះម្តងទៀតដោយកូដ · ឈ្មោះ · ពាក្យសម្ងាត់ដដែល ➜ `200 registered` ហាង/role ដដែល (មុននេះ «កូដអញ្ជើញមិនត្រឹមត្រូវ…» ទោះគណនីដើររួច)។ កូដមិនស៊ីម្តងទៀត ·
  ពាក្យសម្ងាត់ខុស/គណនីផ្សេង ➜ `invite-invalid` ដូចមុន · App អស់ពេលរង់ចាំ ➜ សារ «មិនដឹងថាការចុះឈ្មោះបានសម្រេចឬអត់ — សាកចូលប្រព័ន្ធ…» (មិនមែន «ភ្ជាប់មិនបាន»)
  · ប្តូរពាក្យសម្ងាត់អស់ពេល ➜ «មិនទាន់ដឹងលទ្ធផល…»។ គណនីមានរួច + កូដហាង/role ផ្សេង ➜ «ឈ្មោះគណនីនេះមានគេប្រើរួច» (មិនឆ្លើយ «ចុះឈ្មោះរួច» ជាមួយហាងចាស់ទៀត)។
- **ហាង Supabase ៖ retry ដំណាលគ្នាលែងលុបគណនី** ៖ `finish_registration` ចាក់សោកូដមុនពិនិត្យសមាជិកភាព ➜ ការហៅទី ២ (retry ក្រោយពិដាន ៨ វិ. ឬសំណើបោះបង់)
  ចូលជាជួរ ហើយបានហាង/role ដដែល (មុននេះ `invite-invalid` ➜ Edge rollback លុបគណនីដែលទើបចុះឈ្មោះ)។
- **ZoeKeyGen ៖ session Admin Supabase ផុតក្រោយមិនប្រើ ១៥ នាទី** (ដូច Signing Key) ៖ គ្មានការចុច/វាយ ១៥ នាទី ➜ `sbAdminReset()` (ផ្ទាំង · បញ្ជី · កូដ · Link លុប) +
  revoke session (`/auth/v1/logout` មានពិដាន) + toast «ចាកចេញពី Supabase Admin ក្រោយមិនប្រើ ១៥ នាទី — សូមចូលម្តងទៀត»។ ពិនិត្យរៀងរាល់ ៣០ វិ. · ពេលត្រឡប់មក App ·
  និងនៅ**មុន**សកម្មភាពដំបូងក្រោយស្ងៀម (ភ្ញាក់ពីការដេក ➜ ផុតមុន មិនពន្យារ session ចាស់)។ ពេលកំពុងហៅ Supabase មិនកាត់។
- **ZoeKeyGen ៖ «ពន្យារ» ហាង Supabase តាម CAS** ៖ RPC ថ្មី `admin_extend_tenant(ថ្ងៃ, ថ្ងៃផុតដែលឃើញ)` ៖ `greatest(ថ្ងៃផុត, ឥឡូវ) + ថ្ងៃ` (នាឡិកា DB) តែពេលថ្ងៃផុតក្នុង DB
  ស្មើអ្វីដែល ZoeKeyGen ឃើញ ➜ ឧបករណ៍ ២ ដែលបញ្ជីចាស់ ➜ សារ «ហាងនេះត្រូវបានកែពីឧបករណ៍ផ្សេង…» + Refresh បញ្ជីខ្លួនឯង (មុននេះ ៖ សរសេរថ្ងៃផុតដាច់ខាតពីបញ្ជីចាស់
  ➜ ពន្យារ +365 ពីកុំព្យូទ័រ រួច +7 ពីទូរស័ព្ទ ➜ បាត់ ៣៦៥ ថ្ងៃដោយស្ងាត់)។ **ចេញកូដប្តូរពាក្យសម្ងាត់ដំណាលគ្នា ➜ កូដនៅប្រើបានតែ ១** (ចាក់សោជួរសមាជិក)។
- **ផ្ទាំង 🔔 ៖ «📤 កញ្ចប់ដែលដករួច»** (ក្រោម «📦 កញ្ចប់ជិតផុតកំណត់») ៖ កញ្ចប់ក្នុងធុងសំរាមដែលប្រព័ន្ធដកចេញព្រោះផុតកំណត់ (`trashReasonOf()` = `expired` ·
  ដកលុយរួច) ➜ ទូរស័ព្ទ · ចំនួនកញ្ចប់ · ទូ Locker · «ដកមុន N ម៉ោង» · ស្លាក «ថ្មី» · ថ្មីបំផុតខាងលើ ➜ ហាងដឹងថាត្រូវយកកញ្ចប់ណាចេញពីទូ។ badge 🔔 រាប់កញ្ចប់ដកដែលមិនទាន់មើល
  (បិទផ្ទាំង ➜ បានមើល · `zoew_notify_removed_seen_v1`)។ ⛔ ដក/យករួច/លុប ដោយដៃ មិនបង្ហាញ · ធាតុកំពុងស្តារ (`restoreClaim`) មិនបង្ហាញ · ទិដ្ឋភាពធុងសំរាមមិនស្រស់ ➜
  «វាស់មិនបាន» (គ្មាន badge) · listener ធុងសំរាមធ្វើបច្ចុប្បន្នភាពភ្លាម · ចាកចេញ ➜ សម្អាត។
- **ហាង Supabase ៖ បើក App ម្តងទៀត (ឬទាញចុះ Refresh) ទាញតែទិន្នន័យដែលប្រែ** ៖ ក្រោយ sync App រក្សាទុកទិន្នន័យហាងក្នុង IndexedDB (`zoew_sb_docs_v1` ·
  កំណត់ត្រាតែមួយ ចងនឹង URL Project + គណនី) ➜ ការបើកលើកក្រោយទាញតែពី cursor (មុននេះ ទាញទាំងអស់រាល់ការផ្ទុកទំព័រ ≈ ៧៣៦ kB សម្រាប់ហាងតូច ➜ ស៊ី egress Free 5 GB/ខែ)។
  ⛔ cache សម្រាប់ egress **តែប៉ុណ្ណោះ** ៖ listener បាញ់តែក្រោយ Server ឆ្លើយ (ក្រៅបណ្តាញ ➜ មិនបង្ហាញទិន្នន័យចាស់ជាការពិត) · Server ប្រាប់ហាង (`tenant`) ក្នុងចម្លើយ
  ➜ cache ហាងផ្សេង (សមាជិកផ្លាស់ហាង) ឬ Server ចាស់ ➜ បោះចោល ទាញពេញ · cache ចាស់ជាង ៧ ថ្ងៃ ➜ Server reset · ចាកចេញ ➜ លុប database ទាំងមូល (ទោះ Config ប្តូរទៅ Firebase)
  · storage រាំង/ព្យួរ ➜ ទាញពេញធម្មតា (ពិដាន ៣ វិ.)។ រក្សាទុក ១.៥ វិ. ក្រោយ sync ដំបូង រួចយ៉ាងយូរ ១ ដង/៣០ វិ.។
- **ហាង Supabase ៖ ការទាញពេញលើហាងធំលែងវិលចាប់ផ្តើមម្តងទៀត** ៖ ហាងមាន doc លើស ២០០០ ហើយ tombstone ចាស់ជាង ៧ ថ្ងៃត្រូវ purge ➜ `zoe_pull` ទំព័រទី ២ ឃើញ cursor
  ចាស់ជាង `purged_seq` ➜ reset ➜ ទទួលទំព័រទី ១ ម្តងទៀត ... រហូតដល់ ១០០០ ទំព័រ (egress រាប់ GB · ទិន្នន័យកន្លះ)។ ឥឡូវទំព័រ reset ប្រាប់ `head` ➜ ទំព័របន្តផ្ញើ `p_full_head`
  ➜ Server បន្តដោយសុវត្ថិភាព (tombstone ក្រោយការទាញចាប់ផ្តើមនៅមក) · App ចាស់ (2 argument) ដើរដូចមុន · Server ចាស់ (គ្មាន `head`) ➜ App មិនផ្ញើ argument ថ្មី ហើយឈប់ក្រោយ
  reset ៣ ដង (មិនខាត egress)។ ការទាញដែលដាច់កណ្តាលទី ➜ បន្តពី cursor (មិនចាប់ផ្តើមពីទំព័រ ១)។
- **ហាង Supabase ៖ ចូលប្រព័ន្ធខណៈ App កំពុងពិនិត្យបណ្តាញ ➜ ទិន្នន័យមកភ្លាម** ៖ មុននេះ ការចូលដែលធ្លាក់ចំពេល ping (ឧ. បណ្តាញយឺត) បាត់សំណើទាញ ➜ តារាងទទេរហូតដល់
  realtime ឬព្រឹត្តិការណ៍ផ្សេងមកជួយ។ **ក្រៅបណ្តាញយូរ (cursor ចាស់ជាង purge) ➜ reset ច្រើនទំព័រ** មិនទុក doc ដែលលុបរួច (doc ខ្មោច) ទៀតទេ។
- **ZoeKeyGen ៖ បញ្ជីហាង** ៖ ម្ចាស់ហាងបង្ហាញជាអក្សរដិត (tooltip «ម្ចាស់ហាង») ជំនួស «👑» នៅមុខឈ្មោះគណនី។
- **Service Worker ៖ chunk `supabase-backend` (~២៤១ KB) ចេញពី `CORE_SHELL`** (សេចក្តីសម្រេចម្ចាស់គម្រោង) ➜ ក្រុម install ដាច់ (`__BACKEND_SHELL__`) ៖
  ហាង Firebase **មិនទាញ** · ហាង Supabase ៖ ប្រើលើកដំបូង ➜ chunk ចូល cache + សញ្ញាប្រើ (`./__zoew-backend-used`) ➜ កំណែក្រោយ install វាក្នុងក្រុមតែមួយ
  (ក្រៅបណ្តាញភ្លាមក្រោយ update នៅដើរ · សញ្ញាផ្ទេរបន្តទោះទំព័របើកជាប់ ២ កំណែ) · cache មុនកែ (គ្មាន `./__zoew-shell-scheme`) ដែលមាន chunk ➜ រក្សាវា
  **១ ដងចុងក្រោយ** (ការផ្លាស់មិនធ្វើឲ្យហាង Supabase បាត់ក្រៅបណ្តាញ) ➜ ហាង Firebase ឈប់ទាញចាប់ពី update បន្ទាប់។

#### អ្នកយាម

- `ZoeW/tests/remember-password.test.tsx` (LoginModal ពិត · IndexedDB ក្លែង · WebCrypto ពិត) ១៣ ករណី · tree មុនកែ ➜ ធ្លាក់ (module មិនមាន) ·
  mutation ១១ លើកូដពិត ➜ ក្រហម ១១ (ដកធីកមិនលុប · key នាំចេញបាន · អក្សរធម្មតាក្នុង record · បំពេញជាន់ការវាយ · បកដោយគ្មាន binding · race · ចាកចេញ/ប្តូរពាក្យសម្ងាត់មិនលុប …)។
- `supabase-functions-test` ៖ ក្រុម `register-resume` (ពិភពក្លែងមានស្ថានភាព) + adapter ទល់ GoTrue ក្លែងដោយ supabase-js ពិត · tree មុនកែ ➜ **FAIL ១១** ➜ **២០២/២០២** ·
  mutation ថ្មី ១០ ➜ ក្រហមទាំង ១០។
- `supabase-functions-test` (register កូដប្រើរួច) ៖ មុនកែ **FAIL ២៦** ➜ **២៣៣** · mutation TS ថ្មី ១៣ · `supabase-rls-test` ៖ register កូដប្រើរួច មុនកែ **FAIL ៣២** ·
  ពន្យារ CAS + កូដ reset ដំណាលគ្នា មុនកែ **FAIL ១៨** (កូដ reset **២** នៅប្រើបាន) · ការប្រណាំងអ្នកដដែល មុនកែ **FAIL ២** ➜ **៤២១/៤២១** · mutation SQL ថ្មី ២២ ·
  FK ទាំងអស់មាន index (ស្កេន `pg_constraint` ↔ `pg_index` · probe ទិសផ្ទុយ · ជាន់ ៨) ៖ មុនកែ **FAIL** (FK ៣) ➜ **៤២៧/៤២៧** ·
  ពិដានស្ងៀម Admin ៖ មុនកែ **FAIL ៨** ➜ **១០០/១០០** · mutation ៣ (គ្មានការផុតមុនសកម្មភាព · គ្មាន revoke · គ្មានត្រាពេលចូល) ចាប់ទាំងអស់ ·
  `keygen-supabase-admin-test` ៖ ពន្យារពីបញ្ជីចាស់តាម ZoeKeyGen ពិត មុនកែ **FAIL ៤** (ថ្ងៃផុត 2027-10-08 ➜ 2026-10-15) ➜ **៩១/៩១** · fake PostgREST បញ្ជូន `timestamptz`
  ជា microsecond ដូច PostgREST ពិត · vitest `supabase-account` មុនកែ FAIL ៣ ➜ ១៦/១៦។
- `ZoeW/tests/notifications.test.tsx` ៖ ក្រុម «📤 កញ្ចប់ដែលដករួច» (ការត្រងតាមមូលហេតុ · រំលងការស្តារ · តម្រៀប · មិនស្រស់ ➜ វាស់មិនបាន · `initDatabaseListeners()` ពិត ➜
  ធ្វើបច្ចុប្បន្នភាពភ្លាម · UI + badge + បានមើល · ចាកចេញ) ៖ មុនកែ **FAIL ៥** ➜ **២០/២០** · mutation ៩ ➜ ក្រហម ៩។ sandbox listener ៣ (`connection-recovery` ·
  `registry-release` · `raw-read-shape`) ស្គាល់ `refreshNotifyRemovedView`។
- `ZoeW/tests/scroll-thumb.test.tsx` (៨) ៖ ធរណីមាត្រ · មិនជាន់ chrome · web មិនដំឡើង · លាក់ពេលស្ងៀម · រមូរផ្តេកមិនលេច · modal ពេញកម្ពស់ · CSS `pointer-events: none` ·
  mutation ៨ ➜ ក្រហម ៦ · ២ ដែលរួចគឺលក្ខខណ្ឌស្ទួន ➜ លុបចេញពីកូដ។
- `layout-check` ៖ ទិសទី ២ របស់ modal (ទទឹងជាឯកតាអក្សរលើ tablet/desktop ≥ ៩៧% នៃទូរស័ព្ទ ឬពេញអេក្រង់) · ZoeKeyGen មុនកែ **FAIL** (`pinModal @768px 273u < 281u` …) ➜ **101/101**។
- `sw-backend-chunk-test` (ថ្មី · Chromium ពិត + `sw.js` ពិត) ៖ មុនកែ **FAIL ៣** (ហាង Firebase ទាញ chunk) ➜ **២០/២០** · mutation ៧ ➜ ក្រហម ៧
  (install ជានិច្ច/មិនដែល · គ្មានសញ្ញាគ្រោង · គ្មានសញ្ញាប្រើ · គ្មានការផ្ទេរសញ្ញា · មិនមែនផ្លូវសំបក · មិនអើពើសញ្ញាគ្រោង)។
- `keygen-supabase-admin-test` ៖ ម្ចាស់ `sb-owner` · គ្មាន emoji មុខឈ្មោះ។ `setup-link-logout-test` ៖ ចាក់កូដពិតនៃការបំពេញពាក្យសម្ងាត់ ➜ ចាកចេញមិនបន្សល់ (mutation ➜ ក្រហម)។
- `zoe_pull` · cache (លម្អិត ៖ ផ្នែក ២ «ការទាញពេញវិលចាប់ផ្តើមម្តងទៀត») ៖ `supabase-datastore-test` មុនកែ **FAIL ៥** ➜ **១២៦** (mutation SQL ថ្មី ៥ + ចាស់ ៣ ផ្លាស់ទៅ body ថ្មី) ·
  vitest `supabase-pull-paging` **១៦** (មុនកែ ៖ ការចូលចំពេល ping ➜ **០** សំណើទាញ · doc ខ្មោច `i8`) · mutation ១៣ លើ `supabase-rtdb.ts` ➜ ក្រហម ១៣ ·
  `emu/supabase-adapter-parity` ផ្នែក ៥–៦ (client ពិត + SQL ពិត ៖ ទំព័រ ២ ក្រោយ purge · cache + delta · សមាជិកផ្លាស់ហាង ➜ គ្មានទិន្នន័យហាងចាស់) **៨៧** ·
  `supabase-docs-cache-test` (ថ្មី · IndexedDB ពិតក្នុង Chromium) **១៨** · `setup-link-logout-test` ៖ ចាកចេញលុប database cache។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ✅ ធ្វើរួច ៖ migration `20261002154730_zoe_reset_claim.sql` លើ live (កត់ version) ➜ Edge Function **`register`** និង `reset-password` **v9**។
- ✅ **migration ថ្មី ៥** ម្ចាស់គម្រោង paste ក្នុង SQL Editor ៖ `20261003091742_zoe_register_spent_invite.sql` (`tenant_members.invite_code_hash` · `spent_invite_member` ·
  `finish_registration` ចាក់សោកូដ) · `20261003120000_zoe_admin_export.sql` · `20261003160000_zoe_admin_races.sql` (`admin_extend_tenant` · `admin_issue_reset_code`
  ចាក់សោជួរសមាជិក) · `20261003170000_zoe_fk_indexes.sql` · `20261003180000_zoe_pull_full_head.sql` (`zoe_pull` + `p_full_head` · ចម្លើយមាន `head` + `tenant`)។
  វាស់ live (អានតែប៉ុណ្ណោះ) ៖ function · index ៣ · column មានគ្រប់ · `zoe_pull` ៣ argument តែមួយ (App 2.48.1 ផលិតកម្មដើរដោយ default)។
  ✅ **version កត់រួច** (Claude តាមសំណើម្ចាស់គម្រោង ៖ `schema_migrations` ៥ ➜ ១០ = repo ១០ · ស្មើ `migration repair --status applied`) ➜ merge មិនអនុវត្តម្តងទៀត។
- ✅ Edge Function `register` + `reset-password` **v10** (កូដ branch នេះ ៖ ផ្លូវ «កូដប្រើរួច» ក្នុង `account-core.ts` · `admin-deps.ts` ដែលប្រើ `spent_invite_member`) ·
  `verify_jwt` បិទដដែល · ឯកសារដែល Supabase ផ្ញើត្រឡប់មកវិញស្មើ repo · សំណើ/ចម្លើយដូច v9 ➜ App 2.48.1 ផលិតកម្មដើរដដែល · ត្រឡប់វិញ = deploy ពី `73db73a` (v9)។
  ⛔ container របស់ Claude ចូល `*.supabase.co` តាម HTTP មិនបាន ➜ សាកចុះឈ្មោះ/កំណត់ពាក្យសម្ងាត់ពិតដោយម្ចាស់គម្រោង (ZoeKeyGen ➜ កូដអញ្ជើញថ្មី ➜ ZoeW ចុះឈ្មោះ)។
- បន្ទាប់មក ៖ Netlify ZoeW + ZoeKeyGen + APK ថ្មី។ គ្មាន Firebase rules · គ្មាន env ថ្មី។
- iPhone PWA + APK ៖ រមូរតារាងប្រវត្តិ · បញ្ជីក្នុង modal ➜ ខ្សែស្តើងលេច/បាត់ · ⛔ ពិនិត្យថា PTR · ចលនាផ្ទាំង · ភាពរលូនពេលរមូរ នៅដដែល (តំបន់ហាម ៖ វាស់លើឧបករណ៍ពិត ២ ប្រភេទមុន merge)។
- ហាង Supabase (ក្រោយ migration `20261003180000`) ៖ បើក App ➜ បិទ ➜ បើកម្តងទៀត ➜ ទិន្នន័យដដែល (Supabase Dashboard ➜ Reports ➜ egress ធ្លាក់) · ចាកចេញ ➜
  DevTools ➜ Application ➜ IndexedDB គ្មាន `zoew_sb_docs_v1` · ក្រៅបណ្តាញ ➜ បើក App ➜ គ្មានទិន្នន័យចាស់លេចមុនភ្ជាប់។
- ZoeKeyGen ៖ បើក modal (PIN · Config · Key ថ្មី · Extend) លើទូរស័ព្ទ · tablet · កុំព្យូទ័រ · បញ្ជីហាង ៖ ម្ចាស់ជាអក្សរដិត · ពន្យារហាងពីឧបករណ៍ ២ (បញ្ជីចាស់) ➜ សារ + Refresh។
- ហាង Supabase ៖ កូដ max_uses=1 + បណ្តាញយឺត (ចុចចុះឈ្មោះ រួចបិទអ៊ីនធឺណិតបន្តិច) ➜ សារ «មិនដឹង…» ➜ ចុះឈ្មោះម្តងទៀតដោយព័ត៌មានដដែល ➜ ចូលប្រព័ន្ធ · ZoeKeyGen used_count នៅ 1។
- សាកលើឧបករណ៍ពិត ៖ ចូល (ធីក) ➜ បិទ App ➜ រង់ចាំផុត ៤ ម៉ោង (ឬចាកចេញ ➜ ត្រូវតែទទេ) ➜ ពាក្យសម្ងាត់បំពេញ · ដកធីក ➜ វាលទទេ · iPhone PWA · APK · Firebase និង Supabase។

### [2.48.2] — 2026-10-03 · ZoeW ៖ កូដប្តូរពាក្យសម្ងាត់ Supabase ទទួលសំណើតែមួយ

**ZoeW `2.48.2`** (`zoew-v254` ➜ `zoew-v255`)។ **ZoeKeyGen មិនប្រែ** · Firebase rules មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- សំណើ reset ២ ដំណាលគ្នាដោយកូដដូចគ្នា៖ មុនទាំង២អាចប្តូរពាក្យសម្ងាត់; ឥឡូវ SQL កក់ដោយ claim_id មុន Auth write ➜ អ្នកឈ្នះតែមួយ។
- ការឆ្លើយកក់បាត់ ➜ retry ដោយ claim_id ដដែល។ Auth បដិសេធពាក្យសម្ងាត់ខ្សោយច្បាស់ ➜ ដោះការកក់; Auth មិនដឹងលទ្ធផល ➜ ទុកការកក់ ដើម្បីកុំឱ្យ write យឺតប៉ះគ្នា។
- App ប្រាប់សាកចូលដោយពាក្យសម្ងាត់ថ្មីជាមុន ហើយសុំកូដថ្មីពីអ្នកលក់បើចូលមិនបាន។ មិនប្រកាសថាប្តូរ «មិនបាន» លើលទ្ធផលមិនដឹង។

#### អ្នកយាម

- supabase-functions-test៖ សំណើដំណាលគ្នា · retry កក់ដោយ id ដដែល · weak release · unknown មិន release · mutation។
- supabase-rls-test៖ Postgres ពិត · service_role ប៉ុណ្ណោះ · កូដខុស/ផុត/ប្រើរួច · អ្នកឈ្នះម្នាក់ក្នុងការតភ្ជាប់២ · claim/settle idempotent · mutation។
- ZoeW/tests/supabase-account.test.tsx៖ សារ unknown ក្នុង Modal ពិត; មុនកែធ្លាក់ ១/១៣ ➜ ក្រោយកែ ១៣/១៣។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ✅ ធ្វើរួច ៖ migration `20261002154730_zoe_reset_claim.sql` (SQL Editor + កត់ version) **មុន** reset-password v9 (រួម [2.49.0])។
  នៅសល់ក្រោយអនុម័ត merge ៖ Netlify deploy ZoeW និង APK ថ្មី។
- សាក reset លើឧបករណ៍ពិត។ កុំចាត់ចន្លោះពេល deploy ដែល Functions ចាស់នៅទទួលសំណើថាការពាររួច។

### [2.48.1] — 2026-10-02 · ZoeW ៖ **ហាង Supabase ៖ ការបន្តសម័យចូលប្រព័ន្ធដែលព្យួរមានពិដាន · 🔔 សារកំណែតែមួយ**

**ZoeW `2.48.1`** (`zoew-v253` ➜ `zoew-v254`)។ ⛔ **ZoeKeyGen មិនប្រែ** · Firebase rules · Supabase migration **មិនប្រែ**។ សំណើម្ចាស់គម្រោង ៖
«Audit បណ្តាញ» · «announcement កុំរក្សាទុកច្រើនពេក ប្រាប់តែមួយចុងក្រោយ»។

#### អ្វីដែលខុសពីមុន

- **ហាង Supabase លើបណ្តាញ «ភ្ជាប់តែមិនឆ្លើយ»** ៖ fetch ទាំងអស់របស់ supabase-js (បន្តសម័យ · ចូល · ចាកចេញ) ឆ្លងកាត់ `sbFetchWithCeiling()`
  (`SB_FETCH_TIMEOUT_MS` ១៥ វិ. · abort ពិត · គ្របទាំង body) ហើយជំហានយក token ក្នុង `rpc()` មានពិដានដូច POST របស់វា (`sbWithin()`) ➜ ការបន្តសម័យដែលព្យួរ
  លែងរាំង RPC ទាំងអស់ជារៀងរហូត ៖ RPC ធ្លាក់ជា `SbNetworkError` (adapter សាកម្តងទៀតតាមជណ្តើររបស់វា) · បណ្តាញល្អវិញ ➜ ការបន្តសម័យបន្ទាប់ជោគជ័យខ្លួនឯង។
- **ប្រអប់ចូលប្រព័ន្ធ (Supabase)** លើបណ្តាញព្យួរ ➜ «ភ្ជាប់ Server មិនបានទេ» ក្នុងពិដាន fetch ជំនួសការរង់ចាំគ្មានទីបញ្ចប់។
- **ប្តូរ Config Firebase ⇄ Supabase ក្នុងវគ្គដដែល** ៖ `initFirebase()` ផ្តាច់ listener auth របស់ backend ចាស់ (និង timer សង្គ្រោះ auth) **មុន** `deleteApp()`
  ➜ callback `onAuthStateChanged` របស់ Firebase ដែលមកក្រោយ មិនរត់លើ backend ថ្មី (មិនបើកប្រអប់ចូល · មិនសម្អាតទិន្នន័យ · មិនចាប់ផ្តើម login លើ Supabase)។
- **🔔 កំណែ App** ៖ `announcements.json` ទុកតែធាតុ `update` ចុងក្រោយមួយ (= `APP_VERSION`)។
- **ហាង Supabase មិនទាញ SDK Firebase ពិតប្រាកដ** ៖ ដក `<link rel="modulepreload">` ៣ របស់ SDK Firebase ចេញពី `index.html` (វាទាញ module ទាំង ៣
  សម្រាប់អ្នកប្រើទាំងអស់ ទោះ `firebase-loader.js` រំលងសម្រាប់ Config Supabase) ➜ Config Firebase នៅទាញតាម `import()` របស់ loader ដដែល។

#### អ្នកយាម

- `ZoeW/tests/supabase-transport-hang.test.ts` (supabase-js ពិត · fetch ក្លែងដែលព្យួរ និងគោរព `signal`) ៖ មុនកែ **១/៤** (តែទិសផ្ទុយជាប់ · ៣ នៅ pending
  ក្រោយ ៣ វិ.) ➜ ក្រោយកែ **៤/៤**។
- `ZoeW/tests/notifications.test.tsx` «ទុកតែធាតុ update ចុងក្រោយមួយ»។
- `npm run smoke` (build ផលិតកម្ម · Chromium) ៖ Config Supabase ➜ ០ សំណើ `gstatic.com/firebasejs` · ទិសផ្ទុយ Config Firebase ➜ ៣ ៖ មុនកែ
  `{"sdkOnSupabase":3,"sdkOnFirebase":3}` ធ្លាក់ ➜ ក្រោយកែជាប់។
- `ZoeW/tests/registry-session-race.test.ts` «ប្ដូរ Firebase ➜ Supabase ៖ callback auth ចាស់» ៖ មុនកែធ្លាក់ (callback ចាស់ត្រូវបញ្ជូន) ➜ ក្រោយកែជាប់ ·
  ទិសផ្ទុយ ៖ listener របស់ backend ថ្មីនៅដំណើរការ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Merge ➜ Netlify deploy `zoew` · build APK ថ្មី (workflow `Android APK` លើ `main`)។ គ្មាន rules · migration · Edge Function ត្រូវ deploy។

### [2.48.0] — 2026-10-01 · ZoeW · ZoeKeyGen `2.24.2` ៖ **Config ➜ ចូលប្រព័ន្ធ ➜ ចុះឈ្មោះ ឆ្លាតវៃ · 🩺 សុពលភាព Activation Key + អាយុ Cookie ZTO ក្នុង Blob ពិត · toast រស់បញ្ចប់ដោយការពិត · License យឺតមិនជាប់ · ZoeKeyGen ការកែ Key ព្យួរ ➜ «⏳ មិនទាន់បញ្ជាក់»**

**ZoeW `2.48.0`** (`zoew-v252` ➜ `zoew-v253`) · **ZoeKeyGen `2.24.2`** (`zoekeygen-v112` ➜ `zoekeygen-v113`)។ សំណើម្ចាស់គម្រោង (Deep Audit) ៖ «Reconfig លើកក្រោយ ហាងដែលចុះឈ្មោះរួច
ត្រូវលោត modal login មិនមែន signup · ការចងចាំ login កុំច្រឡំ Firebase/Supabase» · «ក្នុង check health firebase activate key ដាក់ឲ្យមើលដឹងសុពលភាព» ·
«បង្ហាញអាយុ cookie zto ពី blob ពិត» · «update version blob ទៅជំនាន់ចុងក្រោយ» · «toast realtime · កុំនិយាយមិនពិត» · «8 warnings ក្នុង supabase» (Security Advisor) ·
«ភ្ជាប់ GitHub ជាមួយ Supabase រួច ➜ deploy .sql auto បានទេ» · «ដាក់ឲ្យហើយ ក្រែងថ្ងៃក្រោយប្រើ Pro»។ ⛔ Firebase rules **មិនប្រែ** · Supabase ៖ migration ថ្មី
`20261002000100_zoe_definer_private.sql` (Supabase មិនទាន់មានអតិថិជន ៖ ម្ចាស់គម្រោងតែម្នាក់កំពុងសាក)។

#### អ្វីដែលខុសពីមុន

- 🔐 **Setup Link ដែលកូដអញ្ជើញប្រើរួច ➜ ប្រអប់ចូលប្រព័ន្ធ (មិនមែនចុះឈ្មោះ)** — Reconfig ដោយ Link/QR ដដែល ឬទូរស័ព្ទទី ២ របស់ហាង ៖ មុនបើកប្រអប់ចុះឈ្មោះ
  ជានិច្ច ➜ អ្នកប្រើវាយឈ្មោះ/ពាក្យសម្ងាត់ ➜ «កូដអញ្ជើញមិនត្រឹមត្រូវ ប្រើរួច ឬផុតកំណត់»។ ឥឡូវ `routePendingInvite()` ៖ (១) hash កូដដែលឧបករណ៍នេះចុះឈ្មោះរួច
  (ឬ server បដិសេធ) ក្នុង `zoew_used_invites_v1` ➜ ចូលប្រព័ន្ធភ្លាម (ដើរក្រៅបណ្តាញ · កូដដើមមិនចូល storage) · (២) Edge Function `register` + `check: true`
  ➜ `invite-usable` (ចុះឈ្មោះ) / `invite-invalid` (ចូលប្រព័ន្ធ + សារ) ⛔ មិនបង្កើតគណនី មិនស៊ីកូដ · (៣) Function ចាស់ ឬមិនដឹង ➜ ចុះឈ្មោះ (ដូចដើម) លុះត្រា
  ឧបករណ៍ធ្លាប់ចូល Project នោះ (នៅប្រអប់ចូល + សារណែនាំ)។ ⛔ មិនប្តូរទម្រង់ពីក្រោមអ្នកប្រើ (វាយពាក្យសម្ងាត់រួច · ចូលរួច · Config ប្តូរ) · កូដរបស់ Project
  ផ្សេង ➜ បោះចោល · ចូលប្រព័ន្ធជោគជ័យ ➜ បោះកូដចោល។
- 🧠 **«ចងចាំគណនី» ចងនឹង backend + Project** — មុន `remembered_email` តែមួយ ➜ ប្តូរ Config Firebase ➜ Supabase បំពេញ **អ៊ីមែល Firebase** ក្នុងវាល
  «ឈ្មោះគណនី» (ចូលមិនបាន)។ ឥឡូវ `login-memory.ts` (`remembered_email` + `remembered_email_scope` = `fb:<databaseURL>` / `sb:<supabaseUrl>`) ·
  ធាតុចាស់គ្មាន scope ➜ សម្រេចតាមទម្រង់ (អ៊ីមែល ➜ Firebase · ឈ្មោះគណនី ➜ Supabase) · Project ផ្សេង ➜ វាលទទេ។
- 🔒 **session Supabase ចងនឹង URL Project** — key storage `zoew-sb-auth` ថេរ ➜ Project ផ្សេងស្តារ session របស់ Project ចាស់ (`my_account()` ធ្លាក់
  ស្ងាត់ៗ ➜ «ចូលរួច» តែគ្មានអ្វីដើរ)។ ឥឡូវ `zoew-sb-auth-owner` ➜ Project ផ្សេងលុប session + ព័ត៌មានហាងចាស់មុនផ្ទុក · ធាតុចាស់គ្មានម្ចាស់ ➜ រក្សា (មិនបង្ខំចូលម្តងទៀត)។
- 🩺 **ជួរ «អាជ្ញាប័ណ្ណ» (Firebase) បង្ហាញសុពលភាព Key** ៖ «Key សកម្ម · ផុត YYYY-MM-DD (នៅសល់ N ថ្ងៃ)» · ≤ ៧ ថ្ងៃ ➜ ⚠️ ជិតផុតកំណត់ · ផុត/Revoke/
  មិនមាន ➜ ❌ (សារពី `licenseFailureMessage()`) · ផ្ទៀងមិនបាន ➜ ⚠️ «មិនមែនមានន័យថា Key ខុស» · ⛔ Key មិនឡើងដល់ DOM។
- 🩺 **ជួរ Lookup ZTO ៖ អាយុពិតរបស់ Cookie ក្នុង Blob** — មុនរាយ «អាយុ N នាទី» ពី `ageMs` = អាយុ **cache ក្នុង container** (ទើបអាន ➜ លេខតូច
  ជានិច្ច) ➜ អ្នកប្រើអានថា Cookie ទើប Sync ✗។ ឥឡូវ ៖ ឧបករណ៍ Sync (Windows/Android) ដាក់ metadata `{ syncedAt }` ក្នុង Blob (ទម្រង់ `@netlify/blobs` ៖
  header API + upload ដូចគ្នា) · Function អានតាម `getWithMetadata()` · ការបន្តអាយុរក្សា `syncedAt` ហើយបោះ `renewedAt` · `?diag=1` ៖ `blobSyncAgeMs` ·
  `blobRenewAgeMs` ➜ 🩺 «Sync ចូល Blob 3 ម៉ោងមុន · បន្តអាយុចុងក្រោយ 25 នាទីមុន · Server អានចុងក្រោយ 2 នាទីមុន» · Blob ចាស់គ្មានត្រា ➜ «មិនទាន់ស្គាល់»។
- 📦 **`@netlify/blobs` 11.1.1 ➜ 11.1.3** (ជំនាន់ចុងក្រោយ) — diff ក្នុង `dist` ៖ ប្តូរតែសារកំហុសពេលសរសេរ (`edgeAccess`) ➜ API ដែល Function ប្រើមិនប្រែ។
- 📶 **toast រស់បញ្ចប់ដោយការពិត** — មុន toast «🔄 កំពុងតភ្ជាប់…» បាត់ស្ងាត់ពេលផុត ២០ វិ. ➜ អ្នកប្រើមិនដឹងថាចប់ឬនៅ។ ឥឡូវ «⚠️ … — យូរជាងធម្មតា App នៅ
  ព្យាយាមបន្ត» (Config ៖ + «សូមពិនិត្យ Config ឬអ៊ីនធឺណិត») ហើយជោគជ័យយឺត ➜ ✅ ម្តង (`expireLiveToast()`)។ សារ ⚠️ ក្រៅបណ្ដាញ ➜ បាត់ដូចដើម។
- ⚡ **ហាង Supabase មិនទាញ SDK Firebase** — `firebase-loader.js` ទាញ SDK តែពេល Config មិនមែន Supabase (អាន storage មិនបាន ➜ ទាញដូចដើម · fail-open) ·
  `waitForFirebaseSDK()` ហៅ `window.loadFirebaseSDK()` ពេលត្រូវការ (ប្តូរ Config ទៅ Firebase ក្នុងវគ្គដដែល ➜ ទាញភ្លាម មិនរង់ចាំ ១៥ វិ.)។ អ្នកយាម ៖
  `ZoeW/tests/firebase-loader-gate.test.ts` (ធ្លាក់ ៣/៦ លើកូដមុនកែ)។
- 🔑 **ZoeKeyGen ៖ Revoke · ពន្យារ · ចំនួនឧបករណ៍ · ដោះឧបករណ៍ ដែលព្យួរ (អស់ពេល ១៥ វិ.) ➜ «⏳ មិនទាន់បញ្ជាក់»** — RTDB ចាក់ការសរសេរក្នុងជួរ ហើយវាចុះ
  ពេលបណ្តាញមកវិញ ➜ មុន alert «មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ! / …មិនបានទេ! សូមប្រាកដថា Firebase Rules …» (កុហក ៖ ការកែនៅតែចុះ) ➜ admin ធ្វើម្តងទៀត ឬរករឿង
  Rules ខុសផ្លូវ។ ឥឡូវ «⏳ ការកែមិនទាន់បញ្ជាក់ទេ … សូមចុច 🔄 Refresh មើលបញ្ជី Key មុនធ្វើម្តងទៀត» ហើយចុះយឺត ➜ «✅ … (ចុះយឺត)» + Refresh (`armAdminLateWrite()` ·
  ⛔ session ប្តូរ ➜ ស្ងាត់ · ការបដិសេធពិត ➜ «មិនបាន» ដដែល) · ការបង្កើត Key អស់ពេល ➜ «⏳ មិនទាន់បញ្ជាក់ … កុំបង្កើត Key ត្រួតគ្នា» (មុន «សាកល្បងម្តងទៀត»)។
  អ្នកយាម ៖ `keygen-session-security-test` (កូដមុនកែ ➜ ធ្លាក់ ៨ ដោយមានឈ្មោះ)។
- 🛡️ **Supabase Security Advisor ៖ «Signed-In Users Can Execute SECURITY DEFINER Function» ×៧ ➜ ០** — `my_account` · `admin_create_tenant` ·
  `admin_update_tenant` · `admin_issue_invite` · `admin_revoke_invite` · `admin_issue_reset_code` · `zoe_write` ជា `security definer` ក្នុង `public` (schema ដែល
  PostgREST បើក)។ ពួកវាពិនិត្យ admin/ហាងខាងក្នុងត្រឹមត្រូវ (មិនមែនរន្ធ) តែ Supabase ណែនាំ «definer មិននៅក្នុង schema ដែល API បើក»។ migration ថ្មីផ្លាស់ function
  ទាំង ៧ ទៅ `private` (`alter … set schema` ៖ សិទ្ធិ · តួ · `search_path` ដដែល) រួចសាង `public.*` ជា `security invoker` ដែលហៅវា (ឈ្មោះ · argument · default ·
  លទ្ធផល · កូដកំហុសដដែល ➜ ZoeW · ZoeKeyGen · Netlify មិនប្រែ) · រត់ម្តងទៀតបាន (ផ្លាស់តែពេល `public.*` នៅជា definer) · `notify pgrst`។ ការព្រមានទី ៨
  «Leaked Password Protection Disabled» ជាមុខងារ **Pro** (Supabase docs ៖ «available on the Pro Plan and above») ➜ នៅលើ Free។
- 🔑 **សារ `password-weak` និយាយត្រូវពេលបើក Leaked password protection (Pro)** — Supabase Auth (admin `createUser`/`updateUser` ហៅ
  `checkPasswordStrength` ➜ reason `pwned`) បដិសេធពាក្យសម្ងាត់លេចធ្លាយជា `weak_password` ➜ មុនសារ «សូមលាយអក្សរ និងលេខ» (ពាក្យសម្ងាត់ដែលលាយរួចក៏ត្រូវ
  បដិសេធ) ➜ ឥឡូវ «ពាក្យសម្ងាត់នេះខ្សោយពេក ឬធ្លាប់លេចធ្លាយលើអ៊ីនធឺណិត — សូមជ្រើសពាក្យសម្ងាត់ផ្សេង (លាយអក្សរ និងលេខ)»។
- 🚀 **Deploy ពី GitHub (Supabase integration) ដើរដោយសុវត្ថិភាព** — integration អនុវត្តតែ migration ដែល version មិនទាន់មានក្នុង
  `supabase_migrations.schema_migrations` ➜ ការកែឯកសារដែលអនុវត្តរួច **មិនទៅដល់ Database (ស្ងាត់)**។ មុន `generate-rules-sql.mjs` សរសេរជាន់
  `20261001000100_zoe_rules.sql` ដដែល ➜ ការកែ rules ថ្ងៃក្រោយនឹងរំលងស្ងាត់ (rules = ស្រទាប់សិទ្ធិ)។ ឥឡូវ generator បង្កើត `<ម៉ោង UTC>_zoe_rules.sql` ថ្មី
  (មិនប្រែ ➜ «unchanged») · អ្នកយាមអាន rules ចុងក្រោយ · migration ក្នុង `origin/main` កែ/លុបមិនបាន · version ថ្មីក្រោយគេ · គ្មាន version ស្ទួន។
- 📶 **ការជាសះស្បើយតែមួយ ➜ ✅ តែមួយ** — listener ដែលងាប់ (ឧ. `permission_denied`) រស់វិញខណៈ toast បណ្តាញរស់កំពុងបង្ហាញ ➜ toast រស់ប្តូរជា
  «✅ ភ្ជាប់ Server វិញ — ទិន្នន័យទាន់សម័យ» **ហើយ** `noteDbListenerAlive()` បន្ថែម «✅ ទិន្នន័យភ្ជាប់មកវិញហើយ» ក្នុងពេលដដែល (✅ ២ និយាយរឿងដដែល · វាស់បាន
  ក្នុង vitest ៖ `expected 2 to be 1`)។ ឥឡូវ `liveSuccessCount()` រាប់រាល់ពេល toast រស់ប្រកាសជោគជ័យ ➜ សារទី ២ លេចតែពេលគ្មាន toast រស់ប្រកាសវា
  (ទិសផ្ទុយ ៖ គ្មាន toast រស់ ➜ «ទិន្នន័យភ្ជាប់មកវិញហើយ» លេចដដែល)។
- 🔁 **License យឺតក្រោយចូលប្រព័ន្ធ មិនធ្វើឲ្យ App ជាប់** — `checkOnline()` (Key + កៅអី · សំណើនីមួយៗរហូតដល់ ១០ វិ.) អាចលើសពិដាន ២០ វិ. លើបណ្តាញយឺត ➜
  មុនចេញ toast «សូមសាកល្បងចូលម្តងទៀត» ហើយឈប់ ៖ ការស្តារវគ្គក្រោយ reload គ្មានប្រអប់ចូល · គ្មាន listener ➜ App ទទេ។ ឥឡូវសាកម្តងទៀតតាម
  `ACTIVATION_RETRY_STEPS_MS` (៥ · ១៥ · ៣០ · ៦០ វិ.) · toast តែម្តង · ការប្តូរវគ្គបោះបង់ · ជណ្តើរអស់ ➜ «សូមពិនិត្យអ៊ីនធឺណិត រួចបិទបើក App»។

#### អ្នកយាម

`ZoeW/tests/login-routing.test.tsx` (mutation ៦/៦ ចាប់) · `ZoeW/tests/toast-live-expiry.test.tsx` (mutation ២/២) ·
`ZoeW/tests/activation-retry.test.ts` (mutation ១/១) · `ZoeW/tests/recovery-toast-dedup.test.tsx` (កូដមុនកែ ➜ ធ្លាក់ ១ · ទិសផ្ទុយ ២) · `health-check-test` (សុពលភាព Key · អាយុ Blob · ទិសផ្ទុយ) · `zto-cookie-store-test` (mutation ២/២) ·
`zto-cookie-sync-test` (រួម decoder **ពិត** របស់ `@netlify/blobs`) · `supabase-functions-test` (mutation ថ្មី ២ ចាប់) · `supabase-rls-test` (ច្បាប់ linter
0028/0029 **ពិត** របស់ Supabase លើ Postgres ពិត ៖ tree មុនកែ ➜ ធ្លាក់ដោយរាយ function ៧ ដូចរបាយការណ៍ Security Advisor បេះបិទ · mutation ថ្មី ៤ ចាប់) ·
`supabase-datastore-test` (migration append-only ៖ ការកែ rules តាមលំនាំចាស់ ➜ «កែ 20261001000100_zoe_rules.sql» · probe ទិសផ្ទុយ ៥)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **Netlify (ZoeW · ZoeKeyGen)** ៖ Deploy ទាំង ២ site (merge ➜ auto) — Function ZTO អាន metadata ថ្មី · `@netlify/blobs` 11.1.3។
2. **Supabase** (GitHub integration ៖ Working directory `.` · Deploy to production បើក · branch `main` — កំណត់រួច) ៖
   (ក) ✅ **ធ្វើរួច** (តាម Supabase connector ក្នុង session · ម្ចាស់គម្រោងអនុញ្ញាត) ៖ history ទទេ (paste ក្នុង SQL Editor) ➜ ផ្ទៀងលើ server ថា migration ៣ អនុវត្ត
   រួចពិត (តារាង ៨ · function ទាំងអស់ · md5 `private.zoe_rules()` = `ea074882…` ស្មើ repo លើ Postgres ក្នុងម៉ាស៊ីន) ➜ កត់ `20260930120000` · `20261001000100` ·
   `20261001000200` ក្នុង `supabase_migrations.schema_migrations` (ស្មើ `migration repair --status applied`) · (ខ) merge ចូល `main` ➜ integration អនុវត្ត `20261002000100_zoe_definer_private.sql` + deploy `register` ·
   `reset-password` (ឬដោយដៃ ៖ paste migration នោះក្នុង SQL Editor + `npx supabase@latest functions deploy register --no-verify-jwt`) — មុននោះ ZoeW ដើរដូចដើម
   (ឧបករណ៍ថ្មី ➜ ប្រអប់ចុះឈ្មោះ) · (គ) Security Advisor ➜ Refresh ➜ សល់តែ «Leaked Password Protection Disabled» (Pro) · ⛔ កុំបន្ថែម `private` ចូល Exposed
   schemas · ពេល Upgrade ទៅ Pro ៖ `supabase/README.md` «ពេល Upgrade ទៅ Pro»។
3. **ឧបករណ៍ Sync Cookie ZTO** (Windows `sync-zto-cookie.cmd` · Android/Termux) ៖ ទាញ `tools/zto-cookie-sync-windows/` ថ្មី រួច Sync ម្តង ➜ 🩺 ចាប់ផ្តើម
   បង្ហាញ «Sync ចូល Blob … មុន» (Blob ចាស់ ➜ «មិនទាន់ស្គាល់»)។
4. **App Android** ៖ build APK ថ្មី (workflow `Android APK`) ដើម្បីទទួលការប្រែទាំងនេះ។
5. ⏳ **សាកលើឧបករណ៍ពិត** ៖ Reconfig ហាង Supabase ដោយ Setup Link ដដែល ➜ ប្រអប់ចូលប្រព័ន្ធ · ទូរស័ព្ទទី ២ ស្កេន QR ដដែល ➜ ចូលប្រព័ន្ធ · កូដអញ្ជើញថ្មី ➜
   ចុះឈ្មោះ · ប្តូរ Config Firebase ⇄ Supabase ➜ ឈ្មោះ/អ៊ីមែលមិនច្រឡំ · 🩺 ជួរ License និង ZTO · Firebase rules **មិនត្រូវ Publish**។

### [2.47.1] — 2026-10-01 · ZoeW · ZoeKeyGen `2.24.1` ៖ **Push សម្រាប់ហាង Supabase (គ្មាន Activation Key) · ប្រអប់ចូលប្រព័ន្ធលែងលេចមួយភ្លែតពេលរក្សាទុក Config · ZoeKeyGen ៖ ក្រយៅដៃ/មុខលើ Android · QR ចំកណ្តាល + 💾 រក្សាទុក QR · លេខ «1–3650»**

**ZoeW `2.47.1`** (`zoew-v251` ➜ `zoew-v252`) · **ZoeKeyGen `2.24.1`** (`zoekeygen-v111` ➜ `zoekeygen-v112`)។ ម្ចាស់គម្រោងរាយការណ៍ (រូបថត) ៖
«ZoeW ការជូនដំណឹងទាមទារ Activate key ទាំងដែលប្រើ supabase ហើយ» · «ពេលចុច save config ឃើញលេច modal login email password មួយភ្លែតហើយបាត់វិញ» ·
«ZoeKeyGen biometric មិនគាំទ្រលើទូរស័ព្ទ» (ZoeW ដើរលើទូរស័ព្ទដដែល) · «ZoeKeyGen QR code អត់ចំកណ្តាល ហើយសូមបន្ថែមឲ្យ save QR code បានផង» ·
«(១–3650)»។ ⛔ Firebase rules **មិនប្រែ** · Supabase migration **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- 🐛 **ZoeW ៖ ហាង Supabase បើក Push មិនបាន** — អត្តសញ្ញាណ Push ជា Activation Key តែមួយ ➜ ហាង Supabase (គ្មាន Key ដោយការរចនា) ទទួល
  «⚠️ ឧបករណ៍នេះមិនទាន់ Activate» ជានិច្ច · គ្មានប៊ូតុងសាកម្តងទៀត ➜ ឥឡូវ App ផ្ញើ **session token** របស់គណនីហាង ➜ Function `push` ផ្ទៀងតាម
  `my_account()` លើ Project ក្នុង env (`SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` ដដែលនឹង «ទាញបញ្ជីពី ZTO») ➜ ការចុះឈ្មោះ · កាលវិភាគផុតកំណត់ ·
  ការរំលឹកម៉ោង ៨ **តាមហាង** (ទូរស័ព្ទទាំងអស់ក្នុងហាងដដែលចែក index/កាលវិភាគ) · ហាងផុត/បិទ ➜ «⛔ ហាងនេះផុតកំណត់ ឬត្រូវបានបិទ» · session ខុស ➜
  «សូមចូលប្រព័ន្ធម្តងទៀត» (ប៊ូតុងនៅសាកបាន) · ⛔ `requestPermission()` នៅមុន `await` ណាមួយ (token យកក្រោយ) · ហាង Firebase មិនប្រែ (Activation Key)។
- 🐛 **ZoeW ៖ ប្រអប់ចូលប្រព័ន្ធលេចមួយភ្លែតពេលរក្សាទុក Config** — Config ចាស់មិនទាន់ចូល ➜ ប្រអប់ចូលប្រព័ន្ធ (អ៊ីមែល/User ID) បើកនៅក្រោម ⚙️ ➜ រក្សាទុក ➜
  ប្រអប់នោះនៅមើលឃើញ **ពេញរយៈ** ដែល Supabase ស្តារ session (token ផុត ➜ refresh តាមបណ្តាញ) រួចទើបបាត់ ➜ ឥឡូវ `saveFirebaseConfig()` បិទប្រអប់ចូលប្រព័ន្ធ
  របស់ប្រព័ន្ធចាស់ ➜ auth របស់ប្រព័ន្ធថ្មីជាអ្នកសម្រេច (គ្មាន session ➜ បើកវិញ)។ វាស់ក្នុង Chromium ពិត (Firebase SDK ពិត ➜ Supabase · refresh ពន្យារ ១,៥ វិ.) ៖
  មុនកែ ប្រអប់លេច **១,៥ វិ.** · ក្រោយកែ បិទភ្លាមពេលរក្សាទុក។
- 🐛 **ZoeKeyGen ៖ ក្រយៅដៃ/មុខ «មិនគាំទ្រ» លើ Android** — credential ត្រូវបង្កើតជា `residentKey: 'discouraged'` ➜ Android (Google Password Manager)
  ផ្តល់ PRF តែលើ **passkey** (discoverable) ➜ `prf.enabled: false` ➜ «មិនគាំទ្រ» ក្លែងក្លាយ ➜ ឥឡូវ `residentKey: 'required'` · PRF ដែល `create()`
  ផ្តល់ផ្ទាល់ ➜ ប្រើភ្លាម (ស្កេនតែម្តង) · `prf: {}` គ្មាន `enabled` ➜ សួរ `get()` · ⛔ បោះបង់ការស្កេនទី ២ លែងរាយ «មិនគាំទ្រ PRF» (toast «បោះបង់») ·
  សារមិនគាំទ្រណែនាំ «លើ Android ៖ រក្សា passkey ក្នុង Google Password Manager»។ ⛔ PRF-only ដដែល (គ្មានរបៀបរក្សា PIN ធម្មតា)។
- 🐛 **ZoeKeyGen ៖ QR មិនចំកណ្តាល** — Setup Link ពិត (Config + DSN ~៧០០ តួ ➜ QR ~៩៥ module) គូរជា SVG ទទឹងថេរ **៣៨៨px** ➜ ធំជាងកាតលើទូរស័ព្ទ ➜
  `text-align: center` ដាក់កណ្តាលមិនបាន ➜ ហៀរស្តាំ (វាស់ ៖ ៤១២px ➜ ហួសគែម **៣៨px** · ៣២០px ➜ **១៣០px**) ➜ ឥឡូវ SVG ពង្រីក/បង្រួមតាមកាត (ពិដាន
  ២៨០px · ការ៉េ · ចំកណ្តាល) · ផ្លូវតែមួយ `renderQrInto()` (Setup Link + កូដអញ្ជើញ)។
- **ZoeKeyGen ៖ 💾 រក្សាទុក QR (រូបភាព)** ក្រោម QR Setup Link និង QR កូដអញ្ជើញ ➜ ទាញយក PNG (៨px ក្នុងមួយ module · quiet zone ៤ module) ➜ ផ្ញើតាម chat ·
  បោះពុម្ព · អតិថិជនស្កេនពីរូបភាពក្នុង «🖼️ QR ពីរូបភាព» របស់ ZoeW។
- **ZoeKeyGen ៖ លេខ** — «ពន្យារហាង … (១–3650)» · «សុពលភាព … ១–3650» ➜ «1–3650» (ក្បាលជួរខ្មែរ · ចុងជួរជាថេរ JS ឡាតាំង)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **Deploy site ទាំង ២** (Netlify ៖ `zoew` · `zoekeygen`)។ ⛔ Netlify env របស់ site ZoeW ត្រូវមាន `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` (កំណត់រួចសម្រាប់
   ZTO ➜ Push ប្រើវាដដែល · គ្មាន ➜ ហាង Supabase ឃើញ «Server មិនទាន់កំណត់ការជូនដំណឹង»)។
2. សាកលើឧបករណ៍ពិត ៖ ហាង Supabase ➜ 🔔 ➜ «🔔 បើកការជូនដំណឹង» ➜ ✅ · ទូរស័ព្ទទី ២ ក្នុងហាងដដែល ➜ បើក ➜ ការរំលឹកម៉ោង ៨ មកទាំង ២ ·
   ZoeKeyGen លើ Android Chrome ➜ ⚙️ ➜ ក្រយៅដៃ/មុខ ➜ ជ្រើស Google Password Manager ពេលបង្កើត passkey ➜ បើកជោគជ័យ ➜ ប្រអប់ PIN ស្កេនក្រយៅដៃ ·
   Tab 🔗 Link ➜ QR ចំកណ្តាល · 💾 ➜ PNG ស្កេនបានពី ZoeW «🖼️ QR ពីរូបភាព»។
3. ⛔ Firebase rules · Supabase migration **មិនប្រែ** ➜ គ្មាន Publish/paste។

### [2.47.0] — 2026-10-01 · ZoeW · ZoeKeyGen `2.24.0` ៖ **toast និយាយឈ្មោះ backend ពិត · ប្រអប់ Config ជ្រើស Firebase/Supabase · បិទភ្ជាប់ Setup Link · QR ពីរូបភាព · icon គ្មានគែមស · ZoeKeyGen ៖ Tab លើទូរស័ព្ទ · ក្រយៅដៃ/មុខ · Signing Key ផុតពីសតិក្រោយ ១៥ នាទី**

**ZoeW `2.47.0`** (`zoew-v250` ➜ `zoew-v251`) · **ZoeKeyGen `2.24.0`** (`zoekeygen-v110` ➜ `zoekeygen-v111`)។ សំណើម្ចាស់គម្រោង ៖ «toast នៅនិយាយ
Firebase ពេល App ប្រើ Supabase» · «ក្នុង Config ឲ្យមានកន្លែងជ្រើស Firebase និង Supabase» · «កន្លែងបិទភ្ជាប់ Setup Link និងយក QR ពីរូបភាព» · «ZoeKeyGen
លើទូរស័ព្ទឲ្យមាន Tab ដូច ZoeW» · «ពង្រឹងសុវត្ថិភាព ការពារ secret លេចធ្លាយ» · «icon ដំឡើងពី Chrome មក desktop សល់គែមស និងមិនច្បាស់» · «logo ZoeKeyGen
សល់គែមសខ្លួនឯង» · «ZoeKeyGen ដាក់ biometric»។ ⛔ Firebase rules **មិនប្រែ** ➜ គ្មាន Publish · Supabase migration **មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- **ZoeW ៖ toast** — ហាង Supabase ឃើញ «Supabase» ជំនួស «Firebase» ក្នុងសារស្ថានភាព/កំហុស (`toastBackendText()` ក្នុង `showToast` ·
  `reannounceOrShowToast` · `paintToast`) ⛔ មិនប្តូរពាក្យ «Firebase Config» · «Firebase Console» (ឈ្មោះអ្វីដែលអ្នកប្រើត្រូវបើកពិត) · ហាង Firebase មិនប្រែ។
- **ZoeW ៖ ប្រអប់ «⚙️ ភ្ជាប់ប្រព័ន្ធ»** — បន្ថែមលើ 📷 ស្កេន QR ៖ **🖼️ QR ពីរូបភាព** (រូបថតអេក្រង់ ➜ ZXing ក្នុង App ដដែល) · វាល **បិទភ្ជាប់ Setup Link** +
  «ប្រើ Link» · ជម្រើស **Firebase / Supabase** ៖ Firebase ➜ បិទភ្ជាប់ Config ដូចមុន · Supabase ➜ វាល **Project URL** · **Publishable key** · Domain (ស្រេចចិត្ត)។
  ការរក្សាទុកឆ្លងច្រកដដែល (PIN · `normalizeFirebaseConfig` · Secret key ➜ បដិសេធ)។ សៀវភៅក្នុង App ៖ ផ្នែក «បញ្ចូល Config ដោយដៃ»។
- 🐛 **ស្កេន QR ដោយកាមេរ៉ា បាត់កូដអញ្ជើញ/DSN** — ផ្លូវកាមេរ៉ាចាក់ JSON ទាំងមូល (រួម `invite` · `dsn`) ចូល textarea ➜ `normalizeFirebaseConfig` បោះវាលដែលមិនមែន
  Config ចោល ➜ កូដអញ្ជើញមិនបំពេញប្រអប់ចុះឈ្មោះ · Sentry DSN មិនរក្សា ខណៈ Setup Link តាម URL ធ្វើបានត្រូវ ➜ ផ្លូវទាំង ៤ (URL · កាមេរ៉ា · រូបភាព · បិទភ្ជាប់)
  ឥឡូវឆ្លង `applySetupPayload()` តែមួយ។
- **icon PWA (App ទាំង ២)** — PNG ZoeKeyGen ដើមមាន **ជ្រុងសពិត** (ភីកសែល (0,0) = ស មិនថ្លា) ➜ Chrome/Windows បង្ហាញគែមស · `"purpose": "any maskable"`
  រួម ➜ Chrome ពង្រីក/កាត់រូបមានគែម ➜ ព្រិល ➜ icon `any` (ជ្រុងថ្លា) ដាច់ពី `maskable` (ពេញផ្ទៃ · 192/512/1024) · `apple-touch-icon` = maskable (iOS
  បិទជ្រុងខ្លួនឯង) · logo ZoeKeyGen ក្នុង App = icon `any` · រូប ZoeKeyGen គូរឡើងវិញពី SVG (`ZoeW/resources/keygen-icon.svg` · `ZoeW/scripts/pwa-icons.mjs`)។
- **ZoeKeyGen ៖ Tab ខាងក្រោមលើទូរស័ព្ទ** (`< 900px`) ៖ 🔑 បង្កើត · 🔗 Link · 📢 ដំណឹង · 🏪 ហាង · 📋 បញ្ជី ➜ បង្ហាញតែកាតរបស់ Tab នោះ (ចងចាំក្នុង
  `zoekeygen_tab_v1`) · `≥ 900px` ដូចមុន (grid ២ ជួរ · គ្មាន Tab)។
- **ZoeKeyGen ៖ ដោះសោដោយក្រយៅដៃ/មុខ** ៖ ⚙️ ➜ «បើក» ➜ វាយ PIN ពិត ➜ ឧបករណ៍ចុះឈ្មោះ ➜ ក្រោយមកប្រអប់ PIN សួរក្រយៅដៃ/មុខភ្លាម។ PIN រុំដោយ AES-GCM
  ពីកូនសោ **WebAuthn PRF** (⛔ ឧបករណ៍គ្មាន PRF ➜ «មិនគាំទ្រ» មិនមានរបៀបរក្សា PIN ធម្មតា) · PIN ដែលស្រាយត្រូវស្មើ hash មុនទុកចិត្ត (មិនស្មើ ➜ លុបការចង) ·
  ប្តូរ PIN ➜ លុបការចង · ពិដាន/lockout PIN ដដែល · ផ្លូវជោគជ័យតែមួយ `completePinUnlock()`។
- **ZoeKeyGen ៖ Signing Key ផុតពីសតិ** ក្រោយមិនប៉ះ ១៥ នាទី (pointer/key) ➜ toast «🔒 …» ប្រាប់ផ្លូវពិត (មាន Key ចងចាំក្នុង Session ➜ ប្រអប់ PIN «វាយ PIN ដើម្បីស្ដារវិញ» · គ្មាន ➜ «សូម Load ម្តងទៀត») · ពិនិត្យរាល់ ៣០ វិ. និងពេលត្រឡប់មក App
  (Signing Key ជា secret ធំជាងគេរបស់អ្នកលក់ ➜ ឧបករណ៍ដែលទុកចោលបើក មិនកាន់វាជារៀងរហូត)។
- **ZoeW ៖ toast បណ្តាញ «រស់»** (សំណើ ៖ «toast realtime») — App ដែលចូលប្រព័ន្ធ ធ្លាក់ពី «ភ្ជាប់» ទៅ «ក្រៅបណ្ដាញ» (browser offline ឬផុត grace
  ភ្ជាប់ឡើងវិញ) ➜ toast **តែមួយ** ដែលប្តូរខ្លួនឯង ៖ «⚠️ ឧបករណ៍ក្រៅបណ្ដាញ…» ➜ «🔄 កំពុងភ្ជាប់ Server ឡើងវិញ…» ➜ «🔄 …កំពុងទាញទិន្នន័យ…» ➜
  «✅ ភ្ជាប់ Server វិញ — ទិន្នន័យទាន់សម័យ» (✅ តែពេល listener ទាំងអស់ស្រស់ · listener ងាប់ ➜ មិន ✅) · toast ផុតពេល (២០ វិ.) ខណៈនៅក្រៅបណ្ដាញ ➜
  ពេលភ្ជាប់វិញ សារ ✅ លេចម្តងទៀត · ការភ្លាត់ខ្លី (grace) · មិនទាន់ចូល · មិនដែលភ្ជាប់តាំងពីបើក · toast ចូលប្រព័ន្ធ/Config រស់រួច ➜ **គ្មាន** toast ស្ទួន។
- 🐛 **Setup Link មាន `%` ខូច** (បិទភ្ជាប់/QR) ➜ `decodeURIComponent` បោះ `URIError` ចេញពី handler ➜ **គ្មានសារអ្វីសោះ** ➜ ឥឡូវ «❌ Setup Link មិនត្រឹមត្រូវទេ!»។
- 🐛 **QR ពីរូបភាព ២ ជាន់គ្នា** ៖ រូបចាស់ដែលឌិកូដចប់ក្រោយ សរសេរជាន់ Config របស់រូបថ្មី · បិទប្រអប់កណ្តាលការឌិកូដ ➜ សារនៅលេច ➜ ឥឡូវតែការឌិកូដ
  ចុងក្រោយ ហើយតែពេលប្រអប់នៅបើក (`configQrImageSeq`)។
- 🐛 **ZoeKeyGen ទូរស័ព្ទ ៖ toast លិចក្រោមរបា Tab** — ច្បាប់ `@media` ឈរ **មុន** ច្បាប់មូលដ្ឋាន `.toast-container` ➜ ស្លាប់ស្ងាត់ៗ (រកឃើញដោយ
  `css-media-override` ក្នុង CI ពេញ — ការរត់ checker តែមួយផ្នែកមិនបានរត់វា) ➜ ផ្លាស់ក្រោយច្បាប់មូលដ្ឋាន។
- **អត្ថបទក្នុង App** (សំណើម្ចាស់គម្រោង ៖ «ក្នុង App ទាំងអស់កុំ mention អ្វីដែលលែងមាន អ្វីដែលធ្លាប់ដក») — កំណត់ចំណាំកំណែក្នុង 🔔
  (2.43.0–2.47.0) សរសេរឡើងវិញជាបច្ចុប្បន្នកាល (ដក «លែង…ទៀតហើយ» · «(មុននេះ…)» · «ដូចមុន» · «ជាងមុន» · «logo ថ្មី») · សៀវភៅ ៖ «ប៊ូតុងដកដោយដៃ…លែងមាន
  ទៀតហើយ» ➜ «ការដក Barcode ធ្វើតាមរបៀប «ស្កេនដកកញ្ចប់» នេះ»។
- 🐛 **ប្រអប់ជាន់គ្នា (App ទាំង ២)** — រាយការណ៍ដោយម្ចាស់គម្រោង ៖ «ZoeKeyGen ចុចបើក Biometric ប្រអប់បញ្ជាក់ PIN លោតពីក្រោយប្រអប់ Config» ➜ ពិនិត្យ
  **គ្រប់ប្រអប់** ៖ `.modal` ទាំងអស់ `z-index: 1000` ស្មើគ្នា ➜ **លំដាប់ក្នុង DOM** ឈ្នះ មិនមែនលំដាប់បើក ➜ ប្រអប់ដែលបើកក្រោយ តែឈរមុនក្នុង DOM (ឧ. PIN ពី
  Config) លោតពីក្រោយ។ វាស់បាន ៖ ZoeKeyGen ខុស **១៥/៣០** គូ · ZoeW ខុស **៤៦៥/៩៣០** គូ (ឧ. `configModal ➜ pinModal` · `pinSetupModal ➜ pinModal`)។ ការកែ ៖
  ប្រអប់ដែល **បើកក្រោយគេនៅលើគេ** ជានិច្ច (រួមទាំងការបើកប្រអប់ដែលបើករួច ➜ លើកវាឡើង) ៖ ZoeKeyGen `openModalHelper()` រៀប z-index ឡើងវិញ
  (`1001…` តាមលំដាប់ · មានព្រំដែន) · `closeModal()` ដកវាចេញ · ZoeW `uiState.modalStack` (`noteModalStack()` ក្នុង `setModalDisplay()`) ➜ `Modal.tsx` ដាក់
  z-index **តែពេលប្រអប់ ≥ ២ បើក** (ប្រអប់តែមួយរក្សា z-index ដើម ➜ parity ជាមួយ App ដើមនៅដដែល) · ពិដាន `1000 + ចំនួនប្រអប់` (ក្រោម ម៉ឺនុយ (...) `1040`)។
- **សុវត្ថិភាព (App ទាំង ២)** ៖ Sentry លាក់ `invite` · `reset_code` (កូដអញ្ជើញ/ប្តូរពាក្យសម្ងាត់ក្នុង URL ឬ breadcrumb) · វាល Setup Link ក្នុងបញ្ជីសម្អាតពេល
  ចាកចេញ · header `Cross-Origin-Opener-Policy: same-origin` (ទំព័រផ្សេងដែលបើក App ក្នុងបង្អួចថ្មី ចាប់ `window.opener` មិនបាន)។

#### អ្នកយាម

- ថ្មី ៖ `ZoeW/tests/toast-backend.test.tsx` (៤) · `ZoeW/tests/config-modal.test.tsx` (៨ ៖ ជ្រើស backend · Supabase JSON · Link បិទភ្ជាប់ ➜ invite + DSN · Link ខូច ·
  QR កាមេរ៉ា ➜ invite មិនបាត់) · `ZoeW/tests/pwa-icons.test.ts` (ឌិកូដ PNG ពិត ៖ ជ្រុងថ្លា · គ្មានគែមស · maskable/apple មិនថ្លា · ទំហំ ↔ manifest ➜ icon
  ចាស់ **ធ្លាក់**) · `keygen-biometric-test` (២១ ៖ function ពិតក្នុង `vm` · WebAuthn ក្លែងដែលមាន PRF ពិត · AES ពិត ➜ mutation ៤/៤ ចាប់ ៖ របៀបគ្មាន PRF ·
  រំលង hash · ប្តូរ PIN រក្សាការចង · ដកច្រកទ្វារប្រអប់)។ mutation លើ toast/Config ៖ ដក `toastBackendText` · ប្តូរ «Config» ផង · ដក `applySetupPayload`
  ពីផ្លូវកាមេរ៉ា ➜ ចាប់ទាំងអស់។
- ថ្មី (ជុំ deep audit) ៖ `ZoeW/tests/network-toast.test.tsx` (៩ ៖ លំដាប់ពេញ · listener ងាប់ · grace · ដាច់យឺតៗ · មិនដែលភ្ជាប់ · toast ស្ទួន · មិនទាន់ចូល ·
  ផុតពេល ➜ ✅ ម្តងទៀត · វគ្គថ្មី ➜ tree មុនកែ ធ្លាក់ ៤ · mutation «✅ ខណៈ listener ងាប់» ចាប់) · `config-modal.test.tsx` +២ (`%` ខូច · រូប ២ ជាន់គ្នា ➜ មុនកែ ធ្លាក់ ២) ·
  `layout-check` ៖ toast ឈរខាងលើរបា Tab ZoeKeyGen (វាស់ធរណីមាត្រពិត · CSS ចាស់ ➜ ធ្លាក់ ៥ ទំហំ) · `toast-truth-test` ៖ toast បណ្តាញរស់ក្នុង browser ពិត ·
  `keygen-session-security-test` ៖ សារផុតពីសតិប្រាប់ផ្លូវពិត (PIN ឬ Load ➜ កូដចាស់ធ្លាក់)។
- ជួសជុលអ្នកយាម ៖ `network-pressure-test` ដេរីវេ helper ដែលអានវាល Config (`configInputText()`) ជំនួសការចាក់អក្សរ (probe ៖ ដកការអាន ➜ ធ្លាក់) ·
  `clock-hygiene` បញ្ជីអនុញ្ញាតត្រាសកម្មភាព Signing Key (local · fail-closed) · `run-all.sh` baseline + `keygen-biometric-test` (checker-coverage)។
- ថ្មី ៖ `doc-scope-test` «អត្ថបទក្នុង App មិននិយាយពីអ្វីដែលលែងមាន/ធ្លាប់ដក» (សៀវភៅ · HTML ទាំង ២ App · JSX · កំណត់ចំណាំកំណែ · សារក្នុងកូដ ៖ ជាន់តូចជាង
  ព្រោះ «កញ្ចប់នេះលែងមានក្នុងប្រព័ន្ធ» ជាស្ថានភាពទិន្នន័យពិត · probe ៖ អត្ថបទចាស់ ➜ ចាប់ **១៧** · «កន្លែង»/«លែងដៃ» មិនចាប់) · `perf-check` ZoeKeyGen
  ស្ងៀម ០ ស៊ុម (អេក្រង់ចូល + ផ្ទាំងការងារ · probe ១២០ DrawFrame) — វាស់មុនកែ ៖ ការសង្ស័យ «`.ptr-spinner` infinite គូរស៊ុម» **មិនពិត** ➜ មិនកែ ·
  `run-all.sh` **សោ root វាស់** (`zoe-runall-measure.lock` · fd ឆ្លង `exec`) ៖ ការរត់ទី ២ ឬ `ZOE_MEASURE_ONLY=1` ខណៈ run-all កំពុងរត់ ➜ exit 2
  ជំនួសការលុប `ZoeW/dist-audit` ពីក្រោម checker ដែលកំពុងរត់ (`runall-runner-test` ៨ ៖ សោកាន់ ➜ បដិសេធ · ទំនេរ ➜ ឆ្លង) · `state-hygiene` ទទួល
  `configQrImageSeq` (លេខជំនាន់ គ្មានទិន្នន័យ)។
- CI ពេញក្នុង session (emulator · `*_STRICT` ទាំង ៥) ៖ ជុំទី ១ ធ្លាក់ **៥** (`css-media-override` ➜ toast ZoeKeyGen លិចក្រោមរបា Tab · `clock-hygiene` ·
  `repository-file-coverage` · `checker-coverage` · `network-pressure`) — ការរត់ `RUNALL_ONLY` មុននោះ **មិនបានរត់** checker ទាំងនោះ ➜ ជុំទី ២ ធ្លាក់ ១
  (`state-hygiene`) ➜ ជួសជុលទាំងអស់។
- Mutation sweep លើការការពារបណ្តាញ/toast ៖ ដក `retryFailedDbListenersNow` ពី `online` ➜ `connection-recovery` · timeout មិន abort ➜ `network-timeout` +
  `network-pressure` · ដកច្រកទ្វារជំនាន់ listener `exchangeRate` ➜ `connection-recovery` · toast ចូលប្រព័ន្ធ ✅ ខណៈកំពុងទាញ ➜ `toast-truth` ➜ **៥/៥ ចាប់**។
- ថ្មី ៖ `layout-check` «ប្រអប់ដែលបើកក្រោយនៅខាងលើជានិច្ច» (App ទាំង ២ @412 ៖ គ្រប់គូ A ➜ B តាម `openModalHelper()` ពិត + `elementFromPoint()` ·
  បើក A ម្តងទៀត ➜ A ឡើងលើ · បិទទាំងអស់ ➜ z-index ត្រឡប់ទៅតម្លៃដើម) ➜ tree មុនកែ ធ្លាក់ (ZoeKeyGen ១៥ · ZoeW ៤៦៥) · mutation ៥ ៖ ដក z-index ZoeW · ការបើក
  ម្តងទៀតមិនលើក · ដក z ZoeKeyGen · បិទមិន reset z ➜ **ចាប់ ៤** · «បិទមិនដកពី `modalStack`» **រស់រាន** ព្រោះសមមូល (stack ច្រោះតាម `modalDisplay` រួច ➜
  គ្មានអ្វីដែលអ្នកប្រើឃើញប្រែ) ➜ ⛔ មិនសរសេរការអះអាងដែលចាក់សោវា។
- CI GitHub ជាផ្នែក (run 480) ធ្លាក់ ៣ ៖ (១) `RUNALL_SHARD`/`RUNALL_ONLY` ជ្រាបចូល checker កូន ➜ fixture របស់ `hang-guard` ត្រូវបែងចែកចោល ➜ ម៉ាស៊ីនរត់
  `export -n` វា + `runall-runner-test` ៧ខ (មុនកែធ្លាក់ · ក្រោយកែ ៥៦/៥៦ · hang-guard ផ្នែក 1/4–4/4 បៃតង) · (២) `money-guardian` លើសពិដាន ៣០០ វិ. លើ runner
  CPU ២ ➜ បំបែក `--part=k/n` (mutation i ➜ ផ្នែក (i mod n)+1 · ផ្នែកនីមួយៗអះអាងថា run-all រត់ផ្នែកទាំង n) · (៣) `emu/supabase-adapter-parity` ៖ SDK ពិត
  បញ្ជូនតម្លៃដំបូងយឺត ➜ រង់ចាំ listener ទាំងអស់បាញ់ម្តង (ពិដាន ១៥ វិ.) មុនជំហានទី ១ · `keygen-pin-flow-test` stub `querySelectorAll` + `MODAL_BASE_Z` ដេរីវេ។
  ⚠️ `money-guardian --part` និង CI ពេញ មិនទាន់រត់ក្នុង session (usage) ➜ ពិនិត្យលើ CI បន្ទាប់។
- ពង្រីក ៖ `keygen-session-security-test` (៩៥ ៖ Signing Key ផុតក្រោយ ១៥ នាទីតាមនាឡិកាក្លែង · សកម្មភាពពន្យារ · ខ្សែភ្ជាប់ពិត) · `secret-hygiene` (២២១ ៖ វាល
  credential ដេរីវេរួម `Invite`/`resetCode`/`setupLink` · mutation ដក `invite` ➜ ចាប់) · `netlify-config-scope-test` ផ្នែក ៦ (header សុវត្ថិភាព `/*` ៖ XFO ·
  frame-ancestors · nosniff · HSTS · Referrer · COOP · Permissions-Policy កាមេរ៉ាដេរីវេពី `getUserMedia` ➜ mutation ៣/៣)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** និង **ZoeKeyGen** លើ Netlify (header COOP ថ្មីមកជាមួយ `netlify.toml` ក្នុង deploy ដដែល)។
2. **icon ថ្មី** ៖ PWA ដែលដំឡើងរួចប្តូរ icon ពេល Chrome ពិនិត្យ manifest ឡើងវិញ (អាចចំណាយពេលរាប់ថ្ងៃ) ➜ ចង់ឃើញភ្លាម ៖ លុប App ពី desktop ➜ ដំឡើងម្តងទៀត ·
   iPhone ៖ លុបពីអេក្រង់ដើម ➜ «Add to Home Screen» ម្តងទៀត។
3. សាកលើឧបករណ៍ពិត ៖ ZoeW (ហាង Supabase) ➜ toast និយាយ «Supabase» · ⚙️ ភ្ជាប់ប្រព័ន្ធ ➜ 🖼️ QR ពីរូបថតអេក្រង់ Setup Link · បិទភ្ជាប់ Link · ជ្រើស Supabase
   វាយ URL/Key ដោយដៃ · ZoeKeyGen លើទូរស័ព្ទ ➜ Tab ទាំង ៥ · ⚙️ ➜ បើកក្រយៅដៃ/មុខ (iPhone · Android · កុំព្យូទ័រ Windows Hello) ➜ ដោះសោដោយវា · ទុក Signing Key
   ១៥ នាទី ➜ toast ផុត។
4. **APK ៖** workflow `Android APK` រត់ពេល `version.ts` ប្រែលើ `main` ➜ Release 2.47.0 (កូតា Actions · secret ៤ ត្រូវមាន)។
5. ⛔ គ្មានការកែ Firebase rules · Supabase migration · env។

### [2.46.0] — 2026-10-01 · ZoeW · ZoeKeyGen `2.23.0` ៖ **ហាងចុះឈ្មោះដោយកូដអញ្ជើញលើ Supabase Project តែមួយ** (merge រួចក្នុង PR #276 · ✅ ម្ចាស់គម្រោង ៖ «Supabase ដំណើរការហើយ»)

**ZoeW `2.46.0`** (`zoew-v249` ➜ `zoew-v250`) · **ZoeKeyGen `2.23.0`** (`zoekeygen-v109` ➜ `zoekeygen-v110`)។ សំណើម្ចាស់គម្រោង ៖ ឈប់បង្កើត Firebase
Project · Rules · គណនី Login ដោយដៃក្នុងមួយអតិថិជន ➜ **Supabase Project តែមួយ** (Free · Upgrade ទៅ Pro លើ Project ដដែល) · ហាងបំបែកដោយ
`tenant_id` + RLS · **កូដអញ្ជើញ** (ជម្រើសរបស់ម្ចាស់គម្រោង ៖ មិនមែន SMS OTP ព្រោះវាគិតប្រាក់) ចងលេខសាខា ZTO · ការតភ្ជាប់ dynamic (Config/Setup Link)។
⛔ Firebase rules **មិនប្រែ** ➜ គ្មាន Publish · អតិថិជន Firebase ចាស់ដើរដដែល។

#### អ្វីដែលខុសពីមុន

- **ZoeW** ៖ Config/Setup Link ទទួល `{supabaseUrl, supabaseKey, loginDomain?, invite?}` (⛔ Secret key ➜ បដិសេធ) ➜ `initFirebase()` ផ្ទុក adapter
  `fb` លើ Supabase (chunk `supabase-backend`) ➜ កូដលុយ/listener ដដែលដើរលើ backend ទាំង ២ · ប្រអប់ចូល ៖ **ឈ្មោះគណនី** · **📝 ចុះឈ្មោះដោយកូដអញ្ជើញ**
  (កូដពី Setup Link បំពេញរួច) · **🔑 ភ្លេចពាក្យសម្ងាត់?** (កូដពីអ្នកលក់) · គ្មាន Activation Key (ស្ថានភាពហាងពី server ជំនួស · ហាងផុត/បិទ ➜
  ចាកចេញ) · 🩺 ជួរ «ហាង (Supabase)» (ឈ្មោះ · សាខា · ថ្ងៃផុត) · «ទាញបញ្ជីពី ZTO» យកសាខាពីហាង · សៀវភៅក្នុង App ផ្នែក ៣ខ។
- **ប្រអប់ Config** (សំណើម្ចាស់គម្រោង ក្រោយឃើញវានៅនិយាយតែ Firebase លើ deploy preview) ៖ «⚙️ ភ្ជាប់ប្រព័ន្ធ» ➜ ស្កេន QR / Setup Link ពីអ្នកលក់
  **មុន** · បិទភ្ជាប់ Config Firebase **ក្រោម** (អតិថិជនចាស់ Reconfig បានដដែល) · សារពេលមិនទាន់ភ្ជាប់ ៖ «សូមភ្ជាប់ប្រព័ន្ធជាមុនសិន ៖ ស្កេន QR ឬបើក Setup Link
  ពីអ្នកលក់!» · parity ៖ `INTENTIONAL_UI` រំលងតែអត្ថបទណែនាំ (`h3` + `p` គ្មាន style) ➜ textarea · ប៊ូតុង · Sentry នៅប្រៀបធៀបដដែល។
- **ZoeKeyGen** ៖ កាត **🏪 ហាង Supabase** ៖ ចូលជា Admin (`platform_admins`) · បង្កើតហាង + កូដអញ្ជើញម្ចាស់ហាង + Setup Link/QR · កូដអញ្ជើញបុគ្គលិក ·
  ពន្យារ · បិទ/បើកវិញ · កូដប្តូរពាក្យសម្ងាត់ · CSP `connect-src` + `https://*.supabase.co`។
- ការរកឃើញដោយអ្នកយាមថ្មី (មុន commit) ៖ ZoeKeyGen ទទួល URL ដែលមានពាក្យសម្ងាត់ (`https://:pw@…`) ខណៈ ZoeW បដិសេធ ➜ Link ដែល ZoeW មិនទទួល ·
  ក្រោយចាកចេញ ស្លាកកូដអញ្ជើញនៅផ្ទុក **ឈ្មោះហាង** ក្នុង DOM · ប៊ូតុង «ចូល Supabase ជា Admin» នៅបង្ហាញក្រោយចូលរួច ➜ កែទាំង ៣។

#### អ្នកយាម

- ថ្មី ៖ `keygen-supabase-admin-test` (Postgres ពិត + migration ពិត · function `sb*` ពិតក្នុង `vm` · DOM ដេរីវេពី `index.html` · helper Config ពិតរបស់ ZoeW
  ពី build វាស់) ➜ **៨៨** · mutation **២៣/២៣** ក្រហម · tree មុនកែ ➜ ធ្លាក់ **២** (URL ពាក្យសម្ងាត់ · ស្លាកឈ្មោះហាង)។
- build វាស់ (`build-audit.mjs`) ៖ បដិសេធការប្រកាសយោងខ្លួនឯងក្នុងទិដ្ឋភាព `app.js` · ទិដ្ឋភាពចាប់ផ្តើមដោយ `\n`។
- ពង្រីក ៖ `supabase-datastore-test` (ភាពស្រស់ `*_zoe_rules.sql` ↔ rules · tenant lock វាស់ដោយ lock ពិត) · `health-check-test` (ជួរហាង ៖ សកម្ម/ផុត/បិទ/
  មិនដឹង) · `firebase-config-paste-test` (Config Supabase) · `sdk-surface` (ផ្ទៃ adapter ⊇ `fb.X`) · `tx-outcome-test` (ដេរីវេអថេរដែលរុំ)។
- CI (`audit.yml`) ៖ `npm ci --prefix supabase` · `SUPABASE_STRICT=1` · job `firebase-rules` រត់ `emu/supabase-rules-parity` · `emu/supabase-adapter-parity`។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. បង្កើត **Supabase Project** (Free · Region **Singapore**) ➜ Authentication ៖ Allow new users to sign up = **បិទ** · Confirm email = **បើក** · Secure email/
   password change = **បើក** · Anonymous = បិទ (លម្អិត ៖ [`supabase/README.md`](../supabase/README.md) ជំហាន ១)។
2. **Database** ៖ `npx supabase@latest db push` (ឬ SQL Editor ➜ paste តាមលំដាប់ ៖ `20260930120000_zoe_tenancy.sql` · `20261001000100_zoe_rules.sql` ·
   `20261001000200_zoe_datastore.sql`)។
3. **Admin** ៖ Authentication ➜ Users ➜ Add user (ឧ. `boss@admin.zoew.invalid` · Auto Confirm) ➜ SQL ៖
   `insert into public.platform_admins (user_id) select id from auth.users where email = 'boss@admin.zoew.invalid';`
4. **Edge Function** ៖ `supabase secrets set ZOE_SECRET_KEY=<sb_secret_…> ZOE_LOGIN_DOMAIN=users.zoew.invalid ZOE_ALLOWED_ORIGINS=https://<site-zoew>.netlify.app,https://localhost`
   ➜ `supabase functions deploy register --no-verify-jwt` · `supabase functions deploy reset-password --no-verify-jwt` (⛔ Secret key តែក្នុង secrets)។
5. **Netlify (site ZoeW)** env ៖ `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` (សម្រាប់ «ទាញបញ្ជីពី ZTO» តាមសាខាហាង) ➜ Deploy **ZoeW** និង **ZoeKeyGen** (CSP)
   · build **APK ថ្មី** (2.46.0)។
6. **ហាងដំបូង** ៖ ZoeKeyGen ➜ 🔗 Base URL របស់ ZoeW ➜ 🏪 ហាង Supabase ➜ ចូលជា Admin ➜ បង្កើតហាង ➜ ផ្ញើ Setup Link ➜ សាកចុះឈ្មោះ · ចូល · ស្កេន ·
   ក្រៅបណ្តាញ ➜ ភ្ជាប់វិញ · ឧបករណ៍ ២ ក្នុងហាងដដែល · ភ្លេចពាក្យសម្ងាត់ · បិទហាង ➜ ចាកចេញ (iPhone + Android ពិត)។
7. Firebase rules **មិនប្រែ** · ⛔ កែ `firebase-database.rules.json` នៅថ្ងៃក្រោយ ➜ Publish លើ Firebase **និង** paste `*_zoe_rules.sql` ដែលបង្កើតឡើងវិញ។
8. ⚠️ ហាង Supabase **មិនទាន់ទទួល Push** (ចងនឹង Activation Key) · Free tier គ្មាន backup ស្វ័យប្រវត្តិ — មើល `CLAUDE.md` «ការងារដែលនៅសល់»។

### [2.45.8] — 2026-09-30 · ZoeW ៖ **APK ៖ logo ពេលបើកព្រិល/ការ៉េ · tablet ផ្តេក ៖ សញ្ញា Pull to refresh បាំងរបា Tab** (រាយការណ៍ដោយម្ចាស់គម្រោង ៖ រូបថត + វីដេអូ tablet 11.5")

**ZoeW `2.45.8`** (`zoew-v248` ➜ `zoew-v249`)។ ⛔ ZoeKeyGen មិនប្រែ · rules មិនប្រែ ➜ គ្មាន Publish · server មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- **📱 logo ពេលបើក APK** ៖ 2.45.7 ដាក់ `@mipmap/ic_launcher` (adaptive icon · ស្រទាប់ PNG) ជា icon splash ➜ Android គូរវាទំហំ 288dp ➜ PNG ពង្រីក ➜ **ព្រិល** ហើយ
  ROM លើ tablet 11.5" **មិនបិទជ្រុង** ➜ **ការ៉េពេញ**។ ឥឡូវ icon splash ជា **vector** `drawable/splash_icon.xml` ដេរីវេពី `resources/icon.svg` (ប្រអប់ជ្រុងមូល
  150dp ក្នុងរង្វង់សុវត្ថិភាព 192dp) ➜ ច្បាស់គ្រប់ density · រូបដដែលទាំង ROM បិទជ្រុងជារង្វង់ និងមិនបិទ។
- **↓ Pull to refresh លើ tablet/កុំព្យូទ័រអេក្រង់ផ្តេក (≥992px)** ៖ របា Tab ផ្លាស់ទៅនៅក្រោម navbar ខណៈសញ្ញា PTR (`position: fixed` · តម្លៃកំណត់សម្រាប់ navbar
  ទូរស័ព្ទ) ធ្លាក់ **ជាន់របា Tab** (វាស់បាន ៖ −48.8px នៅ 1280×800)។ ឥឡូវ ≥992px ៖ `top` = `--chrome-top` + `--tabbar-height` − 41px (`react-root.css`) ➜ ពេល «ready»
  វាឈរក្រោមរបា Tab **10.2px** ស្មើទូរស័ព្ទ។ ⛔ ទូរស័ព្ទ · tablet បញ្ឈរ (<992px) មិនប្រែ។

#### អ្នកយាម

- `npm run android:check` ៖ icon splash = `@drawable/splash_icon` · ជា `<vector>` 288dp · **ស្មើលទ្ធផលរបស់ `android-splash-vector.mjs` លើ `icon.svg`** (logo ប្តូរ ➜
  ធ្លាក់រហូតដល់ `npm run android:icons`) · ប្រអប់ក្នុងរង្វង់ 192dp ➜ commit មុនធ្លាក់ **៣** ➜ **៩៣/៩៣**។
- `gesture-test` ផ្នែកថ្មី ៖ ទាញពិតរហូតដល់ «ready» លើ 412×780 · 1280×800 · 1194×834 · 800×1280 ➜ គម្លាតពីគែមក្រោមរបាខាងលើ ≥ 0 និងស្មើទូរស័ព្ទ ±2px ➜ មុនកែ
  tablet ផ្តេក **−48.8 / −47.8** (FAIL) ➜ **១១៨/១១៨**។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Deploy **ZoeW** (CSS PTR ក្នុងសំបក PWA) · **build APK ថ្មី** (icon splash)។ គ្មាន env ថ្មី · rules មិនប្រែ។
- សាកលើ tablet 11.5" ៖ បើក App ➜ logo ជ្រុងមូលច្បាស់ (មិនមែនការ៉េព្រិល) · អេក្រង់ផ្តេក ➜ ទាញចុះ ➜ រង្វង់ PTR លេចក្រោមរបា «ទិន្នន័យ · ស្កេន» មិនបាំងវា
  · អេក្រង់បញ្ឈរ និងទូរស័ព្ទ ៖ PTR ដូចមុនបេះបិទ។
- ✅ **ម្ចាស់គម្រោងបញ្ជាក់លើ tablet 11.5" ពិត** (APK 2.45.8) ៖ «ស្អាតអស់ហើយ» — logo ពេលបើក និង PTR អេក្រង់ផ្តេក។

### [2.45.7] — 2026-09-30 · ZoeW ៖ **Deep audit ៖ «ភ្ជាប់ Server រួចរាល់» ត្រូវវាស់ពិត — ការតភ្ជាប់ «ងាប់ស្ងាត់» (WiFi គ្មានអ៊ីនធឺណិត · NAT ផុត · ភ្ញាក់ពី background) លែងជាប់បៃតងក្លែងក្លាយ ហើយភ្ជាប់វិញដោយខ្លួនឯង**

**ZoeW `2.45.7`** (`zoew-v247` ➜ `zoew-v248`)។ ⛔ **ZoeKeyGen មិនប្រែ** · rules មិនប្រែ ➜ គ្មាន Publish · server (`netlify/`) មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- **🔴 ការតភ្ជាប់ «ងាប់ស្ងាត់»** ៖ ពេល WiFi នៅភ្ជាប់តែ router បាត់អ៊ីនធឺណិតខាងលើ · NAT ផុតកំណត់ · ទូរស័ព្ទភ្ញាក់ពី background ដោយ socket ពាក់កណ្តាលបើក
  ➜ App រាយ **«ភ្ជាប់ Server រួចរាល់» (បៃតង) ជាប់** ខណៈការស្កេនព្យួរ ១៥ វិ. ម្តងៗ ហើយទិន្នន័យពីឧបករណ៍ផ្សេងមិនមកដល់ — ហើយពេលអ៊ីនធឺណិតមកវិញ App
  **មិនភ្ជាប់វិញ** (វាស់បាន ៖ ២ នាទី+ · ធាតុថ្មី ៣ លើ server មិនមកដល់ · SDK Firebase ពិត + emulator ពិត)។ មូលហេតុក្នុង SDK ៖ វាបិទការតភ្ជាប់តែលើព្រឹត្តិការណ៍
  `offline` របស់ browser ហើយ keepalive រាល់ ៤៥ វិ. **មិនរង់ចាំចម្លើយ** ➜ `.info/connected` នៅ `true`។ ការកែ ៖ App **សួរ Server ពិត** (round trip តូចមួយ
  លើ path ដែលគ្មាន listener) ពេល ៖ ការសរសេរ/ការស្កេនព្យួរ · ភ្ញាក់ពី background (≥ ៣០ វិ.) · រាល់ ៦០ វិ. ពេល App បើកមើល ➜ Server មិនឆ្លើយក្នុង
  **១០ វិ.** ➜ ស្ថានភាពប្តូរទៅ «កំពុងភ្ជាប់…» ហើយ App ផ្តាច់ socket ចាស់ (ផលដូចព្រឹត្តិការណ៍ `offline`) ➜ អ៊ីនធឺណិតមកវិញ ➜ ភ្ជាប់វិញក្នុង **~០.២ វិ.**
  ដោយមិនបាច់ Refresh។ ការតភ្ជាប់ **យឺតតែរស់** (៣ វិ./ជុំ) **មិន** ត្រូវផ្តាច់ · ការទាញទិន្នន័យដំបូង (listener នៅ pending) មិនត្រូវវាស់។
- **🩺 ពិនិត្យសុខភាព** ៖ ជួរ Firebase សួរ Server ពិតដូចគ្នា ➜ **❌ «ភ្ជាប់តែ Server មិនឆ្លើយ»** ជំនួស ✅ ក្លែងក្លាយ។
- សៀវភៅក្នុង App (ផ្នែក ១៥) · `ZoeW/README.md` ៖ អត្ថន័យ «ភ្ជាប់ Server រួចរាល់» ដែលវាស់ពិត។
- **📱 Splash ពេលបើក APK លើ tablet ធំ** (រាយការណ៍ដោយម្ចាស់គម្រោង ៖ រូបថត tablet 11.5") ៖ អេក្រង់ចាប់ផ្តើមបង្ហាញរបា **«ZoeW»** ខាងលើ ហើយ logo
  ក្រហម **ពង្រីក/ច្របាច់** ក្នុងរបានោះ។ មូលហេតុ ៖ launch theme (`AppTheme.NoActionBarLaunch` — ដូច template Capacitor បេះបិទ) ដាក់
  `android:background="@drawable/splash"` ដែល Android យកជា background លំនាំដើមរបស់ **គ្រប់ View** (មិនមែនតែ window) ហើយគ្មាន
  `postSplashScreenTheme` ច្បាស់ (លំនាំដើម `?android:attr/theme`)។ ការកែ ៖ ដក `android:background` · ផ្ទៃ `@color/splash_background`
  (`#f8fafc` ស្មើ `SplashScreen.backgroundColor`) + adaptive icon នៅកណ្តាល (ទំហំ dp ថេរ) · គ្មាន title/ActionBar · `postSplashScreenTheme` =
  `AppTheme.NoActionBar` (theme ដែល `BridgeActivity` ប្រើ)។ ⚠️ រូបរាងថ្មី ៖ logo ក្រហមរាង **រង្វង់** (Android បិទជ្រុង icon ដូច App ផ្សេងទៀត) លើផ្ទៃស។

#### អ្នកយាម

- **`emu/app-network-e2e-test` (ថ្មី)** ៖ App ពិត (build វាស់ក្នុង Chromium) + **SDK Firebase ពិត** (កំណែដដែលនឹង CDN · បម្រើក្នុងស្រុក) + RTDB emulator ពិត +
  rules ពិត + proxy TCP ដែលអាចធ្វើឲ្យ socket «ងាប់ស្ងាត់» ➜ tree មុនកែ **FAIL ៩** ➜ **២៧/២៧** · mutation ៥ លើការកែ ➜ ក្រហមទាំង ៥ (ផ្នែក ២)។
- `health-check-test` ៖ ជួរ Firebase ពេល round trip ផុតពិដាន ➜ ❌ · ឆ្លើយ ➜ ✅ · ដាច់/ទិន្នន័យមិនទាន់មក ➜ មិនចំណាយការវាស់ · `runHealthCheck()` ប្រើការវាស់ពិត។
- `npm run android:check` ផ្នែក ៤ខ (splash ពេលបើក) ៖ tree មុនកែ **FAIL ៦** ➜ **៩០/៩០** · ឈ្មោះ theme របស់ `BridgeActivity` ដេរីវេពីប្រភព Capacitor ដែលដំឡើង · ពណ៌ផ្ទៃដេរីវេពី `capacitor.config.ts`។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Deploy **ZoeW** (សំបក PWA ថ្មី) · **build APK ថ្មី** (ការកែនៅក្នុង bundle)។ គ្មាន env ថ្មី · rules មិនប្រែ។
- សាកលើឧបករណ៍ពិត ៖ ដក cable អ៊ីនធឺណិតពី router (WiFi នៅ តែគ្មានអ៊ីនធឺណិត) ➜ ក្នុង ~១ នាទី ចំណុចស្ថានភាពប្តូរពីបៃតង (ឬភ្លាមៗក្រោយស្កេនដែលព្យួរ ~២៥ វិ.)
  ➜ ដោត cable វិញ ➜ បៃតងវិញខ្លួនឯង ហើយទិន្នន័យពីឧបករណ៍ផ្សេងមកដល់ · ដាក់ App ចោលក្នុង background ពេល WiFi ប្តូរ ➜ ត្រឡប់មក ➜ មិនជាប់បៃតងក្លែងក្លាយ។
- APK លើ tablet (ជាពិសេស 11.5") និងទូរស័ព្ទ ៖ បើក App ➜ អេក្រង់ចាប់ផ្តើមគ្មានរបា «ZoeW» · logo ក្រហមនៅកណ្តាលមួយគត់ ច្បាស់ មិនខូចរាង (ទាំងបញ្ឈរ និងផ្តេក)។

### [2.45.6] — 2026-09-30 · ZoeW ៖ **Push លើ App Android ដើរពិតប្រាកដ ៖ ចុច «បើក» លែងជាប់ «⏳ កំពុងភ្ជាប់…» ជារៀងរហូត** (✅ ម្ចាស់គម្រោងបញ្ជាក់លើឧបករណ៍ពិត ៖ «ដើរហើយ» · APK 2.45.6 sign ក្នុង session Claude ព្រោះកូតា Actions អស់ · server `?op=config` ➜ `web:true · fcm:true`)

**ZoeW `2.45.6`** (`zoew-v246` ➜ `zoew-v247`)។ ⛔ **ZoeKeyGen មិនប្រែ** · rules មិនប្រែ ➜ គ្មាន Publish · server (`netlify/`) មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- **🔴 App Android ៖ Push មិនដែលដើរតាំងពី 2.45.0** ៖ ចុច «🔔 បើកការជូនដំណឹង» ➜ «⏳ កំពុងភ្ជាប់…» ជាប់ជារៀងរហូត · **គ្មានប្រអប់សុំសិទ្ធិ** (វាស់បានលើ
  ទូរស័ព្ទពិតរបស់ម្ចាស់គម្រោង ជាមួយ APK 2.45.5 ដែល sign + FCM ដំបូងគេ)។ មូលហេតុ ៖ `loadNativePush()` resolve promise ទៅ plugin របស់ Capacitor **ផ្ទាល់** —
  plugin ជា Proxy ដែលឆ្លើយ property ណាក៏ដោយ រួម `then` ➜ promise ហៅ `plugin.then(resolve, reject)` ➜ Capacitor បដិសេធ «`then()` is not implemented on
  android» ដោយមិនហៅ callback ណាមួយ ➜ promise **មិនដែល settle** ➜ watchdog (ដែល arm ក្រោយ `register()`) មិនដែលដល់។ ផ្លូវ APK ទាំងអស់ (បើក · បិទ · 🧹
  សម្អាតការជូនដំណឹងលើរបា · resync · listener ពេល boot) ព្យួរដូចគ្នា។ ការកែ ៖ ផ្ទុក plugin ក្នុងសំបក `{ PN }` (មិនមែន thenable)។
- ជំហានមុន `register()` ដែល **មិនសួរអ្នកប្រើ** (ផ្ទុក plugin · `checkPermissions` · `createChannel` · listener) និង `unregister()` ពេលបិទ ឥឡូវមានពិដាន
  `PUSH_TIMEOUT_MS` (ច្បាប់ «`busy` ជាសោ ➜ គ្រប់ការរង់ចាំមានពិដាន») ➜ ព្យួរ ➜ «បើកមិនបាន» ហើយចុចម្តងទៀតបាន។ ប្រអប់សុំសិទ្ធិ (អ្នកប្រើកំពុងសម្រេច)
  គ្មានពិដានដោយចេតនា ដូច `Notification.requestPermission()` លើ web។
- web/PWA ៖ ផ្លូវ Push មិនប្រែ (មិនប្រើ plugin Capacitor)។

#### អ្នកយាម

- `ZoeW/tests/push-client.test.tsx` ៖ mock plugin ជា **Proxy ដូច Capacitor ពិត** (property ណាក៏ដោយ រួម `then` ➜ method) ជំនួស object ធម្មតា + តេស្ត
  «Capacitor ពិតជា thenable» (`registerPlugin` ពី `@capacitor/core` ដែលដំឡើង) ចងការស្មោះនោះ · សេណារីយ៉ូថ្មី ២ (plugin thenable ➜ បើក/បិទ/សម្អាត settle ·
  ជំហានមុន `register()` ព្យួរ ៣ ករណី ➜ `error` ក្នុងពិដាន ➜ ចុចម្តងទៀត ➜ `on`)។ កូដមុនកែ **FAIL ១២** (តេស្ត APK ទាំងអស់) ➜ **៣២/៣២** · mutation «ដកពិដាន
  `checkPermissions`» ➜ FAIL ១។
- ការបង្កើតឡើងវិញដោយ `@capacitor/core` 8.5.2 ពិតក្នុង Node (bridge Android ក្លែង) ៖ `.then((m) => m.PushNotifications)` ➜ **ព្យួរ** · `.then((m) => ({ PN: … }))` ➜ settle។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **build APK ថ្មី** (2.45.6 · keystore ដដែល · `google-services.json`) ➜ ដំឡើងជាន់ ➜ 🔔 ➜ «🔔 បើកការជូនដំណឹង» ➜ Allow ➜ «✅ បើករួច» ➜ ផ្ញើដំណឹងពី
  ZoeKeyGen ➜ ទូរស័ព្ទលោតក្នុង ~៥ នាទី។
- Deploy ZoeW (សារ «កំណែ App» · សំបក PWA)។ គ្មាន env ថ្មី · rules មិនប្រែ។

### [2.45.5] — 2026-09-30 · ZoeW · ZoeKeyGen `2.22.1` ៖ **Deep audit ៖ ភ្ជាប់ Server វិញដោយខ្លួនឯង ក្រោយបណ្តាញ «ភ្ជាប់តែស្លាប់» · App Android ដឹងពេលអ៊ីនធឺណិតដាច់/មកវិញ · បិទ Push លើ APK ឈប់ទទួលពិត · parity ធៀប ZoeW ដើមរស់ឡើងវិញ**

**ZoeW `2.45.5`** (`zoew-v245` ➜ `zoew-v246`) · **ZoeKeyGen `2.22.1`** (`zoekeygen-v108` ➜ `zoekeygen-v109`)។ ⛔ rules មិនប្រែ ➜ គ្មាន Publish។

#### អ្វីដែលខុសពីមុន

- **🔴 SDK Firebase លែងជាប់ «ក្រៅបណ្ដាញ» ក្រោយបណ្តាញ «ភ្ជាប់តែស្លាប់»** (App ទាំង ២) ៖ SDK ផ្ទុកពី `www.gstatic.com` ➜ ការផ្ទុកធ្លាក់ម្តង
  module map របស់ browser ចងចាំការបរាជ័យពេញអាយុទំព័រ ➜ ផ្លូវស្តារតែមួយគឺ **ផ្ទុកទំព័រឡើងវិញ** (ពិដាន ៣/វគ្គ)។ តែ `navigator.onLine` **កុហក** លើ
  WiFi គ្មានអ៊ីនធឺណិត · ទិន្នន័យទូរស័ព្ទអស់លុយ · App Android (ខាងក្រោម) ➜ ជណ្តើរចំណាយការផ្ទុក ៣ ដងក្នុង ~១ នាទី **ខណៈបណ្តាញស្លាប់** (រាល់ដងធ្លាក់ដដែល ·
  អ្នកប្រើឃើញ App ផ្ទុកខ្លួនឯង ៣ ដង) ➜ ពេលអ៊ីនធឺណិតមកវិញ SDK **មិនដែលស្តារ** ➜ «ក្រៅបណ្ដាញ» រហូតដល់អ្នកប្រើ Refresh ដោយដៃ។ ការកែ ៖ មុនចំណាយការផ្ទុក
  App **វាស់ការឈានដល់ host របស់ SDK** (`HEAD https://www.gstatic.com/generate_204` · no-cors · ៨ វិ.) ៖ ឈានមិនដល់ ➜ មិនផ្ទុក (ពិដាននៅដដែល) តែជណ្តើរ
  បន្តវាស់ · ឈានដល់ ➜ ផ្ទុក · ការវាស់មួយហោះម្តង · ប្រអប់ទើបបើកខណៈវាស់ ➜ មិនផ្ទុក (PIN · Config មិនបាត់)។ CSP `connect-src` ទាំង ២ site អនុញ្ញាត
  `https://www.gstatic.com` (បើអត់ fetch ត្រូវ CSP ទប់ដូចបណ្តាញដាច់ ➜ **មិនដែលផ្ទុកឡើងវិញ** — វាស់ក្នុង Chromium ៖ CSP ចាស់ ➜ violation `connect-src`)។
- **🔴 App Android ៖ ស្ថានភាពបណ្តាញពិត** ៖ WebView ផ្តល់ `navigator.onLine` និង `online`/`offline` **តែពេល** App មានសិទ្ធិ `ACCESS_NETWORK_STATE`
  (ផ្ទៀងក្នុងប្រភព Chromium `WebViewChromiumAwInit` កំណែ 120 · 130 ៖ `NetworkChangeNotifier` ចាប់ផ្តើមតែក្រោមលក្ខខណ្ឌនេះ)។ APK មិនដែលស្នើវា ➜
  `onLine = true` ជានិច្ច · `online`/`offline` មិនដែលបាញ់ ➜ អ៊ីនធឺណិតមកវិញ ➜ រង់ចាំជណ្តើរ (ដល់ ៦០ វិ.) · ដាច់ ➜ «កំពុងភ្ជាប់…» ~៣៥ វិ. មុន «ក្រៅបណ្ដាញ» ·
  🩺 «អ៊ីនធឺណិត ✅ ភ្ជាប់» ខណៈគ្មានបណ្តាញ · ការងារស្រេចចិត្ត (ZTO · ដំណឹង) សាកបណ្តាញពេលក្រៅបណ្តាញ។ ការកែ ៖ ស្នើសិទ្ធិនោះ (សិទ្ធិធម្មតា · **គ្មានប្រអប់សុំ**)។
- **App Android ៖ បិទការជូនដំណឹង ➜ ឈប់ទទួលពិត** ៖ ការបិទហៅតែ `unregister()` (`deleteToken()` ដែល **ធ្លាក់ស្ងាត់ពេលក្រៅបណ្តាញ**) ដោយមិនប្រាប់ server ➜
  server នៅផ្ញើ ➜ ដំណឹងនៅលោត ខណៈប៊ូតុងរាយ «បិទ»។ ការកែ ៖ ផ្ញើ `unsubscribe` token (រក្សាក្នុង `zoew_push_v1`) មុន `unregister()`។
- **App Android ៖ token ដែលអ្នកប្រើមិនបានស្នើ មិនបើក Push ដោយស្ងាត់** ៖ callback `registration` ទទួល token **ណាក៏ដោយ** ➜ (១) token ពី FCM auto-init
  ពេល boot (អ្នកប្រើមិនដែលបើក) ចុះឈ្មោះ server ហើយប៊ូតុងរាយ «✅ បើករួច» · (២) token យឺត (resync) ដែលមកដល់ **ក្រោយ** អ្នកប្រើបិទ បើកវាវិញ។ ការកែ ៖
  ទទួល token តែពេលអ្នកប្រើចង់បើក (`nativeWanted` · `nativeEnabling` · `saved.on`) · ការចុះឈ្មោះដែលចប់ក្រោយការបិទ ➜ លុបវាចេញវិញ · token យឺតក្រោយ
  watchdog (អ្នកប្រើចុចបើក) នៅតែបញ្ចប់ជា «បើក» ដូចមុន។
- **Push cron ៖ រំលឹកកញ្ចប់ជិតផុតកំណត់លែងបាត់ស្ងាត់** (server · មិនប៉ះសំបក App) ៖ scheduled function របស់ Netlify មានពិដាន **៣០ វិ.** តែ cron រត់
  ដំណាក់ ២ ជាប់គ្នា (ដំណឹងពីអ្នកលក់ ➜ រំលឹក) ដែលនីមួយៗមានពិដាន ២០ វិ. ផ្ទាល់ខ្លួន (+ ការផ្ញើចុងក្រោយរហូតដល់ ៦ វិ.) ➜ ការផ្ញើយឺតធ្វើឲ្យ function ត្រូវ
  សម្លាប់ **ក្រោយ** ledger at-most-once ចាក់សោរួច ➜ រំលឹកថ្ងៃនោះបាត់ · ការអាន Blobs យឺតក៏ធ្វើឲ្យរំលឹកត្រូវចាក់សោ ហើយការផ្ញើត្រូវកាត់ភ្លាម (ដូចគ្នា)។
  ការកែ ៖ ដំណាក់ ២ ចែកពិដានតែមួយ (`runPushCron()`) · ពិនិត្យពិដានម្តងទៀត **មុន** ចាក់សោ ➜ ការរត់បន្ទាប់ក្នុងម៉ោង ៨ ផ្ញើ។

#### អ្នកយាម

- `connection-recovery-test` ១០ខ៥ (App ទាំង ២ · sandbox ៖ ការឈានដល់ host = up/down/hang) ៖ tree មុនកែ **FAIL ១៦** (ផ្ទុកឡើងវិញ ៣ ដងខណៈបណ្តាញស្លាប់ ·
  មកវិញ ➜ ០) ➜ **២១៩/២១៩**។ ⛔ sandbox ចាស់ ៖ `document.querySelectorAll()` ឆ្លើយ `[]` ជានិច្ច ➜ ច្រកទ្វារ «ប្រអប់បើក» របស់ **ZoeKeyGen** មិនដែលត្រូវវាស់ (តែ
  ZoeW) ➜ ឥឡូវ `__openModal` លេចតាមផ្លូវ `.modal` ដែរ។
- `netlify-config-scope-test` ឃ (ដេរីវេ ៖ `FIREBASE_SDK_PROBE_URL` ➜ `connect-src` ត្រូវមាន origin) ៖ ZoeKeyGen ធ្លាក់មុនកែ CSP ➜ ✅។
- `npm run android:check` ៖ `ACCESS_NETWORK_STATE` (ដេរីវេ ៖ ឯកសារ `src/**` ដែលពឹង `onLine`/`online`/`offline` ១៨) ៖ tree មុនកែ **FAIL ១** ➜ **៨១/៨១**។
- `ZoeW/tests/push-client.test.tsx` ៣ សេណារីយ៉ូ (បិទ ➜ `unsubscribe` · token យឺតក្រោយបិទ · auto-init ពេល boot) ៖ កូដមុនកែ **FAIL ៣** ➜ **២៩/២៩**។
- `ZoeW/tests/push-server.test.ts` ២ សេណារីយ៉ូ (នាឡិកាក្លែង ៖ ការផ្ញើ ៧ វិ./ការហៅ · ការអាន `sched/` ២១ វិ.) ៖ ការរត់ cron ទាំងមូល **៥៦ វិ.** លើអត្ថន័យចាស់
  (> ៣០) ➜ **២៨ វិ.** · រំលឹកដែលចាក់សោហើយមិនផ្ញើ ➜ ការរត់បន្ទាប់ផ្ញើ ៖ កូដមុនកែ **FAIL ២** ➜ **២៥/២៥**។
- **parity ធៀប ZoeW ដើម រស់ឡើងវិញ + ចូល CI** (ការងារ `zoew-parity`) — លម្អិតក្នុងផ្នែក ២។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Deploy **ZoeW** និង **ZoeKeyGen** (CSP ថ្មីមកជាមួយ `netlify.toml` ក្នុង deploy ដដែល) · **build APK ថ្មី** (សិទ្ធិ `ACCESS_NETWORK_STATE` ចូលតែតាម APK ថ្មី)។
  គ្មាន env ថ្មី · rules មិនប្រែ។
- សាកលើឧបករណ៍ពិត ៖ APK បើក Airplane mode ➜ «ក្រៅបណ្ដាញ» ក្នុងប៉ុន្មានវិនាទី · បិទវិញ ➜ «ភ្ជាប់ Server រួចរាល់» ភ្លាម · 🩺 «អ៊ីនធឺណិត» ត្រឹមត្រូវ ·
  បិទ Push លើ APK ខណៈអ៊ីនធឺណិតអន់ ➜ ដំណឹងពីអ្នកលក់លើកក្រោយមិនលោត · web ៖ បើក App ខណៈ WiFi គ្មានអ៊ីនធឺណិត ➜ App **មិនផ្ទុកខ្លួនឯងម្តងហើយម្តងទៀត** ·
  អ៊ីនធឺណិតមកវិញ ➜ ភ្ជាប់វិញដោយមិន Refresh។

### [2.45.4] — 2026-09-29 · ZoeW ៖ **Deep audit ៖ ប្រវត្តិ/ធុងសំរាមលែងងាប់ដោយ record ខូចតែមួយ · rules ទាមទារ object · ចំណុច «ភ្ជាប់ Server» និងប៊ូតុង «ខលម្តងទៀត» ឈប់គូរស៊ុមពេលស្ងៀម · Push «⏳ កំពុងភ្ជាប់…» លែងជាប់ជារៀងរហូត**

**ZoeW `2.45.4` (`zoew-v244` ➜ `zoew-v245`)**។ ⛔ **ZoeKeyGen មិនប្រែ** (`2.22.0` · មានតែ `ZoeKeyGen/firebase-database.rules.json` ដែលមិនមែនកូដ ship)។
⛔ **rules ទាំង ២ ឯកសារប្រែ ➜ ត្រូវ Publish ដោយដៃ**។

#### អ្វីដែលខុសពីមុន

- **🔴 record មិនមែន object តែមួយ ➜ ប្រវត្តិ/ធុងសំរាមងាប់លើគ្រប់ឧបករណ៍** ៖ rules គ្មាន `.validate` នៅ `$itemId` ➜ តម្លៃ
  ខ្សែអក្សរ/លេខ/bool តែមួយក្រោម `zoew_scan_history_cod_dod` ឬ `zoew_recently_deleted_cod_dod` (ការសរសេរដោយដៃក្នុង Console ·
  Import ខុស) ធ្វើឲ្យ callback បោះ `TypeError` (`v.id = key` លើ primitive ក្នុង strict mode · `item.id` លើធាតុ `null`) ➜ callback
  `onValue` ធ្លាក់ ➜ listener ជាប់ «pending» ➜ តារាង និងធុងសំរាមរាយ «វាស់មិនបាន» **ជារៀងរហូត** លើគ្រប់ឧបករណ៍ដែលចែក Project។
  ការកែ ៖ រំលងធាតុដែលមិនមែន object (array ក៏រំលង) + Sentry `zone: 'data'` (ស្លាក `history`/`deleted` · ចំនួនដែលរំលង) ➜ record
  ល្អទាំងអស់បង្ហាញដូចមុន។
- **rules ទាមទារ object លើរាល់ node ដែលរំពឹង object** (ការពង្រឹង A ពីខាង server · សំណើម្ចាស់គម្រោង) ៖ node ដែលមាន schema កូន
  ពិនិត្យតែ **កូន** ➜ primitive គ្មានកូន ➜ ការពិនិត្យមិនរត់ ➜ server ទទួល។ ស្កេន rules ពិត ៖ ចន្លោះ **១៩** (Business ១៥ ៖ record ប្រវត្តិ/ធុងសំរាម ·
  `barcodes` · ledger ថ្ងៃ/ខែ · ស្ថិតិយក · កញ្ចក់ចំណូល · License ៤ ៖ Key · seat · meta · `appPaths`) ➜ `.validate: "newData.hasChildren()"` គ្រប់ node
  (បន្ថែមតែ ១៩ បន្ទាត់ · គ្មានបន្ទាត់លុប)។ ⚠️ ការសរសេរក្នុង Firebase Console ដោយម្ចាស់ Project **រំលង rules** ➜ ការរំលង record ខូចក្នុង App (A) នៅតែចាំបាច់។
- **ចំណុចស្ថានភាព «ភ្ជាប់ Server» ភ្លឹប ៣ ជុំ រួចឈប់** ៖ `pulseDot 2s infinite` ធ្វើឲ្យ compositor គូរស៊ុមជាប់ៗ ខណៈ App ស្ងៀម
  (វាស់បាន ៖ DrawFrame **១៤៦ / ៣ វិ.**) ➜ អេក្រង់ LTPO (10–120Hz) ចុះ Hz ទាបមិនបាន · ស៊ីថ្ម។ ក្រោយកែ ៖ **០ ស៊ុម**។
  «កំពុងភ្ជាប់…» (ពណ៌លឿង) **នៅភ្លឹបជាប់** ដូចមុន (សញ្ញាសកម្មភាពពិត)។
- **ប៊ូតុង «ខលម្តងទៀត» (📞 ក្រហម) ភ្លឹប ៥.៥ ជុំ រួចនៅក្រហមជាប់** ៖ `callRecallBlink 1s infinite` ប្តូរ `background-color` ➜ animation
  **លើ main thread** (មិនមែន compositor) ➜ រាល់ជួរដេកដែល «មិនលើក» ៣ ម៉ោងឡើង ធ្វើឲ្យ main thread គូររាល់ស៊ុមជារៀងរហូត ខណៈ App ស្ងៀម
  (វាស់បាន ៖ BeginMainThreadFrame **១៨១ / ៣ វិ.** ➜ ក្រោយកែ **១**)។ ក្រោយ ៥.៥ ជុំ ប៊ូតុងឈប់លើពណ៌ **`--action-danger`** (ក្រហម) ➜ សញ្ញានៅដដែល ·
  អ្នកប្រើដែលបើក «Reduce Motion» ក៏ឃើញក្រហមដែរ (មុននេះ ៖ ពណ៌បៃតងធម្មតា ➜ **គ្មានសញ្ញាសោះ**)។ CSS ក្នុង `react-root.css` (`app.css` parity មិនប្រែ)។
- **🩺 ពិនិត្យសុខភាពប្រព័ន្ធ ៖ ជុំចាស់លែងជាន់ជុំថ្មី** ៖ បិទ ➜ បើកប្រអប់វិញ ខណៈជុំមុននៅរង់ចាំ License/Lookup (រហូតដល់ ~១១ វិ.) ➜ ជុំ ២ រត់ស្របគ្នា ➜
  ជុំចាស់ចប់មុន ➜ ជាន់ «⏳» ដោយលទ្ធផលដែលវាស់ **មុន** ការបើកវិញ (ឧ. «❌ ក្រៅបណ្ដាញ» ខណៈអ្នកប្រើទើបបើក WiFi) និងដោះប៊ូតុង «ពិនិត្យម្តងទៀត» ខណៈជុំថ្មីនៅរត់។
  ការកែ ៖ ត្រាជុំ `uiState.healthRunSeq` ➜ មានតែជុំចុងក្រោយទេដែលសរសេរលទ្ធផល និងដោះប៊ូតុង។
- **Push «⏳ កំពុងភ្ជាប់…» លែងជាប់ជារៀងរហូត** (ថ្នាក់ «ការព្យួរ ≠ ការធ្លាក់») ៖ `busy` ជាសោ (`togglePush()` បដិសេធការចុច)
  តែការរង់ចាំខាងក្រោយវាគ្មានពិដាន ៖ web ៖ `getSubscription` · `subscribe` · `unsubscribe` · `serviceWorker.ready` (resync) ·
  APK ៖ `register()` រង់ចាំព្រឹត្តិការណ៍ `registration` ដែលអាចមិនដែលមក (FCM គ្មានបណ្តាញ/គ្មាន Google services) ➜ ប៊ូតុងកកជារៀងរហូត
  រហូតដល់បិទ App។ ការកែ ៖ web ឆ្លង `withTimeout(…, PUSH_TIMEOUT_MS)` · APK ៖ watchdog `PUSH_NATIVE_REGISTER_TIMEOUT_MS` (២០ វិ.)
  ➜ `error` (ចុចម្តងទៀតបាន) · token មកយឺត ➜ នៅតែបញ្ចប់ជា `on` · token មកហើយ server ឆ្លើយយឺត ➜ watchdog មិនកាត់។

#### អ្នកយាម

- `field-shape-test` context ទី ២ (record primitive ក្នុងប្រវត្តិ + ធុងសំរាម លើ App ពិតក្នុង Chromium) ៖ tree មុនកែ **FAIL ៥** ➜ **១៦/១៦** ·
  ថតទទេ exit 1។
- `perf-check` «ស៊ុមពេលស្ងៀម» (trace ពិត DrawFrame · App online ស្ងៀម ៣ វិ. ≤ ៣ ស៊ុម) + probe ទិសផ្ទុយ (animation `infinite` ចាក់ចូល ➜ ≥ ៣០)
  + «កំពុងភ្ជាប់» នៅភ្លឹប ៖ tree មុនកែ FAIL ➜ **០ ស៊ុម** (១៧/១៧)។
  🔴 **ចំណុចងងឹតរបស់ការវាស់នេះខ្លួនឯង (រកឃើញក្នុងជុំដដែល)** ៖ DrawFrame រាប់តែស៊ុម **compositor** ➜ Chromium headless **មិនចេញ DrawFrame**
  សម្រាប់ animation ពណ៌លើ main thread ➜ ប៊ូតុង «ខលម្តងទៀត» ភ្លឹបជារៀងរហូត **ខណៈការវាស់រាយ ០ ស៊ុម** (seed ក៏គ្មានជួរដេក «មិនលើក» ដែរ)។ ការពង្រីក ៖
  រាប់ **ទាំង DrawFrame និង BeginMainThreadFrame** · seed ដាក់ជួរដេក «មិនលើក» ៥ ម៉ោង ២ (ប៊ូតុង recall ≥ ១ ជាលក្ខខណ្ឌចាំបាច់) · probe ទិសផ្ទុយ **២**
  (compositor ➜ DrawFrame ≥ ៣០ · main thread `background-color` ➜ BeginMainThreadFrame ≥ ៣០) · ពណ៌ចុងក្រោយ = `--action-danger` ពិត (ដេរីវេពី CSS) ·
  ប៊ូតុងខលធម្មតាមិនក្រហម ៖ tree មុនកែ **FAIL ២** (main **១៨១** · ពណ៌ពាក់កណ្តាល animation) ➜ **២១/២១**។
- `health-check-test` (ជុំ ២ ស្របគ្នា · License របស់ជុំចាស់ដោះមុន) ៖ tree មុនកែ **FAIL ២** (ជួរ «⏳» ត្រូវជាន់ដោយ ៩ ជួរចាស់ · ប៊ូតុងដោះមុនពេល) ➜
  **១១៨/១១៨** · ទិសផ្ទុយ ៖ ជុំថ្មីនៅបង្ហាញ ៩ ជួរ (License ✅ របស់ជុំថ្មី) ហើយដោះប៊ូតុង។
- `ZoeW/tests/push-client.test.tsx` សេណារីយ៉ូ ៦ ៖ tree មុនកែ **FAIL ៤** (subscribe ព្យួរ · getSubscription ព្យួរ · unsubscribe ព្យួរ ·
  token មិនមក) ➜ **២៦/២៦** · ទិសផ្ទុយ ២ (token ទាន់ពេល · server ឆ្លើយយឺត) · mutation «ដក `nativeWatchdogSeq++` ពី `onNativeToken`» ➜ ចាប់។

- 🔴 **ការថយក្រោយដែល `run-all` ចាប់ក្រោយការកែ A** ៖ `rawSnapshotToItemList()` ជាកូដលុយ ➜ `money-core.js` ចាស់ (`money-reality` ធ្លាក់ ១) ➜
  បង្កើតឡើងវិញ (`npm --prefix ZoeW run money:core`) បង្ហាញថា CLI អានសុទ្ធសាធលើ dump ពិត (`money-reality-check.js` · `registry-orphan-list.js`)
  រត់កូដនោះក្នុង sandbox Node **គ្មាន `window`** ➜ dump ដែលមាន record មិនមែន object (ករណីដែល A កែ) នឹងគាំង `ReferenceError` ជំនួសការវាស់។
  អ្នកយាមមុន ៖ `money-reality-test` (dump មាន record ខូច ➜ វាស់ដូច dump ស្អាត ទាំងផ្លូវ `money-core.js` និង `app.js`) **ធ្លាក់ ២** ·
  `registry-orphan-list-test` ៣គ (មិនគាំង · ម្ចាស់ក្បែរ record ខូចនៅតែជាម្ចាស់) **ធ្លាក់ ២** ➜ ការកែ ៖ sandbox ទាំង ២ មាន `window: {}` ➜ **៥៤/៥៤** · **៤១/៤១**។
- rules ទាមទារ object ៖ helper `audit-tools/rules-shape.js` ដេរីវេ node ដែលរំពឹង object ពី rules ពិត (មាន schema កូន · អាចសរសេរបាន) ➜
  `rules-duplicate-keys` (ស្តាទិច) ៖ rules របស់ `main` **FAIL** (Business ១៥/១៩ · License ៤/៦) ➜ ១៩/១៩ · ៦/៦ · `emu/crud-rules-flow` ០ខ (ការវាស់ពីរជំហាន ៖ control
  ដក guard របស់ node ➜ primitive ទទួល · rules ពិត ➜ បដិសេធ · ទិសផ្ទុយ record/PATCH/វាល/លុប ទទួល) ៖ `main` **ធ្លាក់ ១៥** ➜ **១១៦/១១៦** (រួម replay ផ្លូវសរសេរពិតរបស់ App) ·
  `emu/license-seat-rules-test` ១៣ (admin) ៖ `main` **ធ្លាក់ ៤** ➜ **៨២/៨២**។ ⛔ ជំនាន់ដំបូងរបស់ control ដកតែ `.validate` ➜ node finalizations ២ «មិនទៅដល់»
  ព្រោះ `.write` របស់វាទាមទារ `token` រួចហើយ ➜ control ត្រូវជំនួស `.write` **ផ្ទាល់ខ្លួន** ដោយ `auth != null` ផង (ឪពុកនៅដដែល)។
- **🔴 ចន្លោះ ៖ checker ១៨៦ គ្មានមួយណាឃើញការសរសេរពិតរបស់ App ត្រូវ rules ពិតបដិសេធ** ៖ fake SDK របស់ `revenue-fuzz` · `ui-flow` · … ទទួលយក
  គ្រប់ការសរសេរ ➜ «server បដិសេធ» ជារបៀបបរាជ័យដែលមិនដែលសាក (ការព្រមាន ២ ក្នុង `CLAUDE.md`)។ ការកែ rules ជុំនេះ (`hasChildren()` ១៩ node) ទើបតែ
  បង្កើនហានិភ័យនោះ ➜ អ្នកយាមថ្មី **`emu/app-writes-rules-test`** ៖ `revenue-fuzz` (`FUZZ_CAPTURE`) កត់ការសរសេរ **ពិត** របស់ App (set · update ·
  transaction · `increment()`) ➜ replay លើ RTDB emulator ជាមួយ rules ពិត ជា **អ្នកប្រើ** (`auth_variable_override`) · ការប្តូររបស់ harness
  (ឧបករណ៍ផ្សេង) ជា **owner** ➜ ត្រូវមាន **០ ការបដិសេធ** · ជាន់អប្បបរមា ៖ ការសរសេរអ្នកប្រើ ≥ ១៥០ · គ្រប root **៩** (ប្រវត្តិ · ធុងសំរាម · root ·
  ledger ថ្ងៃ/ខែ · ស្ថិតិយក · កញ្ចក់ចំណូល · registry · finalizations) · probe ភាពរស់ (ledger អវិជ្ជមាន ➜ បដិសេធ) · probe ភាពរសើប (`$itemId`
  `.validate: false` ➜ ការបដិសេធ ≥ ការសរសេរប្រវត្តិមិនមែន null)។ លទ្ធផល ៖ **៤០២** ការសរសេរ · បដិសេធ **០** · root **៩/៩** · probe **៨០ ≥ ៦៣** · ៦៦ វិ. ·
  mutation rules ដែលធ្វើឲ្យ node កញ្ចក់ចំណូលបដិសេធរូបរាងដែល App សរសេរពិត ➜ **FAIL ១** · គ្មាន emulator ➜ SKIP (STRICT ➜ FAIL)។
- **ការផ្ទៀងផ្ទាត់ rules ថ្មីហ្មត់ចត់ (សំណើម្ចាស់គម្រោង)** ៖ (១) **differential** ៖ ការសរសេរពិតរបស់ App **៩៥៥** (fuzz ១២ ជុំ · harness ១៤៨) replay លើ rules
  របស់ `main` និង rules ថ្មី ➜ បដិសេធ **០ / ០** · (២) **probe ភាពរសើប** ៖ rules តឹងក្លែង (`hasChildren(['__never'])` គ្រប node ដែលរំពឹង object) ➜
  **៧៩៤** ការបដិសេធ · តឹងតែ node មួយ ➜ **៧៧** ➜ replay ពិតជាឆ្លងកាត់ node ទាំងនោះ មិនមែនទទួលស្ងាត់ៗ · (៣) **ស្តាទិច** ៖ រាប់រាល់កន្លែងសរសេររបស់
  ZoeW (`src/**`) និង ZoeKeyGen ➜ គ្មានកន្លែងណាសរសេរ primitive ទៅ node ដែលឥឡូវទាមទារ object (ការលុប = `null` ➜ `.validate` មិនរត់) ·
  (៤) `emu/crud-rules-flow` ០ខ · `emu/license-seat-rules-test` ១៣ (ខាងលើ)។
- **🔴 ចន្លោះ ៖ ខ្សែភ្ជាប់ SW ↔ ទំព័រ ក្នុង `registerServiceWorker()` គ្មាននរណារត់** (mutation ជុំ ២ ៖ N28 · N29 · N30 **រស់រានលើ checker ទាំងអស់**) ៖
  SW ផ្ញើសារ (`push-client.test.tsx`) និងអ្នកដោះសារ (`handleServiceWorkerMessage()`) មានតេស្តរៀងខ្លួន តែ listener ដែលភ្ជាប់ពួកវាក្នុង `boot.ts` មិនមាន ➜
  ការដក `'message'` · `controllerchange` · `visibilitychange` ចេញ = ចុចការជូនដំណឹងពេល App បើក ➜ ផ្ទាំង 🔔 មិនបើក · push ➜ បញ្ជីមិនស្រស់ · deploy ថ្មី ➜
  ផ្ទាំង «មានកំណែថ្មី» មិនលេច · ត្រឡប់មក App ➜ មិនពិនិត្យកំណែថ្មី។ អ្នកយាមថ្មី **`sw-client-wiring-test`** (App · SW · Chromium ពិត ៖ សារផ្ញើពីបរិបទ SW ·
  ប្រភេទសារដេរីវេពី `sw.js` · នាឡិកាទំព័ររំកិលឆ្លងពិដាន ១៥ នាទី · deploy ថ្មីតាម `sw.js` ដែល server ប្តូរ) ៖ **១៦/១៦** លើ tree បច្ចុប្បន្ន · mutation **៧/៧** ចាប់
  (N28 ផ្ទាំង 🔔 + ការទាញដំណឹង · N29 · N29b ផ្ទាំងលេចលើការដំឡើងដំបូង · N30 · `focus` · `online` · ដកពិដាន) · ថតទទេ ➜ exit 1។ ⛔ កូដ ship មិនប្រែ។
- mutation testing ផ្នែកបណ្តាញ (M01–M15 · checker ៣៦) ៖ ចន្លោះ ២ ត្រូវបិទ — `reconnect-ladder-test` (`offline` ➜ `online` ➜ ជំហានដំបូង) ·
  `lookup-failure-identity-test` (cooldown តាមកូដដែល Function ពិតជាផ្ញើ) — លម្អិតក្នុងផ្នែក ២។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ⛔ **Publish rules ទាំង ២** ៖ `firebase-database.rules.json` ➜ **Business Project** · `ZoeKeyGen/firebase-database.rules.json` ➜ **License Project**
  (Firebase Console ➜ Realtime Database ➜ Rules ➜ paste ➜ Publish)។ លំដាប់ Deploy/Publish មិនសំខាន់ ៖ App ចាស់/ថ្មីមិនសរសេរ primitive ទេ។
  ក្រោយ Publish ៖ សាកកំណត់ Locker · បិទ/បើក · ដក · ស្តារ លើ ZoeW និងបង្កើត/Extend Key លើ ZoeKeyGen ម្តង។
- គ្មាន env ថ្មី។ Deploy ZoeW · build APK ថ្មី។ ZoeKeyGen មិនត្រូវ Deploy (កូដមិនប្រែ)។
- សាកលើឧបករណ៍ពិត ៖ ចុចបើក/បិទ Push ពេលគ្មានអ៊ីនធឺណិត ➜ ក្នុង ~១២–២០ វិ. ស្ថានភាពត្រូវប្តូរជា «⚠️ បើកការជូនដំណឹងមិនបាន…» (មិនជាប់ «⏳»)
  · App ស្ងៀមលើទូរស័ព្ទ ១២០Hz ➜ ចំណុចបៃតងភ្លឹប ៣ ដង រួចឈប់។
- ប៊ូតុង «ខលម្តងទៀត» ៖ ជួរដេកដែលសម្គាល់ «មិនលើក» ជាង ៣ ម៉ោង ➜ ប៊ូតុង 📞 ភ្លឹបប្រហែល ៥ ដង រួច **នៅក្រហមជាប់** (មិនមែនត្រឡប់ទៅបៃតង)។
  បើម្ចាស់គម្រោងចង់បានការភ្លឹបជាប់វិញ ➜ ជាការសម្រេច (ថ្លៃ ៖ main thread គូរ ~៦០ ស៊ុម/វិ. រាល់ពេលមានជួរដេកនោះ)។

### [2.45.3] — 2026-09-29 · ZoeW ៖ **ស៊ុមក្រោមប្រអប់ប្រវត្តិលើ Android ដូច iPhone** (merge រួច · PR #270 · ✅ ម្ចាស់គម្រោងបញ្ជាក់លើឧបករណ៍ពិត ៖ «ស្អាតអស់ហើយ»)

**ZoeW `2.45.3` (`zoew-v243` ➜ `zoew-v244`)**។ ⛔ **ZoeKeyGen មិនប្រែ** (`2.22.0`)។

**របាយការណ៍ម្ចាស់គម្រោង** (រូបថត Android ធៀប iPhone PWA) ៖ *«PWA iOS រក្សាកម្លាត ស៊ុមប្រអប់ប្រវត្តិបានស្អាត តែ Android ដូចហ៊ា»* — លើ Android
ជួរដេករត់ចូលក្រោមរបា Tab ដោយគ្មានគែមក្រោម ជ្រុងមូល ឬកម្លាត។

- **មូលហេតុ** ៖ ផ្លូវ Android (2.11.x) រក្សាកម្ពស់កន្សោមរមូរ **ថេរ** (កាតលាតដល់បាតអេក្រង់) ហើយ `.page-main` កាត់ `clip-path` **ចំគែមកំពូលរបា**
  (`inset(0 0 calc(var(--tabbar-height) - 8px) …)`) ➜ គែមក្រោមតារាង · កម្លាតកាត · គែមកាត · ជ្រុងមូល ស្ថិតក្រោមរបាជានិច្ច ចំណែកផ្លូវ iOS
  មានកាតកម្ពស់ពិតឈប់ខាងលើរបា ៨px។ ⛔ អ្នកយាមចាស់ (`gesture-test` · `panel-motion-test`) **ចាក់សោកំហុសនេះ** ៖ «គែមដែលមើលឃើញ ចុះចំគែមរបា (±4px)»
  ហើយគណនាគែមនោះពី `clip-path` របស់ `.page-main` តែមួយ។
- **ការកែ** (`react-root.css` · ⛔ `app.css` មិនប៉ះ ➜ parity) ៖ ក្នុង `@supports (not (-webkit-touch-callout: none)) and selector(:has(*))` +
  `max-width: 991px` ➜ `clip-path` លើ **`.app-card`** ត្រឹម `--tabbar-height` (កាតឈប់ ៨px ខាងលើរបា) · `::before` គូរគែមក្រោមតារាង (ជ្រុង
  `--radius-md` + ស្រមោល `0 10px 0 10px var(--card-bg)` គ្របជួរដេកដែលលាក់) · `::after` គូរគែមក្រោមកាត (`--radius-lg`) ហើយ **ចាប់ការចុច**
  ➜ ការចុចត្រង់ស៊ុមមិនទៅប៊ូតុង «ខល»/«បិទ» ដែលលាក់ · `chrome-hidden` ➜ ដក clip + `visibility: hidden` (paint តែប៉ុណ្ណោះ ➜ កម្ពស់កន្សោមរមូរ
  **មិនប្រែ** ដូចមុន)។ កាតដែលមាន **`.empty-state`** ជាកូនចុងក្រោយ (ទំព័រស្កេនទទេ ➜ សារ «មិនទាន់មាន…» ធ្លាប់ **លិចក្រោមរបាទាំងស្រុង**) ៖
  `margin-bottom: var(--tabbar-height)` លើសារ · តារាងទទេ `padding-bottom: 0` · គ្មាន `::before`។ Safari មិនផ្គូផ្គងប្លុកនេះ ➜ **iPhone មិនប្រែ**។
  browser ដែលគ្មាន `:has()` ➜ រំលងប្លុកទាំងមូល ➜ ដូចមុន។
- **វាស់បាន** (Chromium · 412×780 · ផ្លូវ Android ធៀបប្លុក iOS ដែលចាក់ចូល · `panel-motion-test` ផ្នែក ៩) ៖ គែមដែលមើលឃើញ **719 ➜ 711** (iOS 711) ·
  ចន្លោះទល់របា **0 ➜ 8px** · pixel ខុសពី iOS ក្នុងតំបន់ ១១០px ក្រោមកាត ៖ ប្រវត្តិ **១,២៤៣ ➜ ០** · ទំព័រស្កេនទទេ **៣,៣៨១ ➜ ០** · កាតទទេពេលផ្ទាំងខាងលើបើក
  ខ្ពស់ជាង iOS **៦១px** (371 ធៀប 310 ➜ 310)។ ⛔ ភាពខុសគ្នាដែលនៅសល់ ៖ ស្រមោល `--shadow-sm` ក្បែរកាត (clip ចាស់កាត់វាចោលរួចមកហើយ) និង
  anti-aliasing ១–២ pixel ត្រង់ជ្រុងតារាង។

#### អ្នកយាម

- `panel-motion-test` ៖ ផ្នែក ៥ខ អះអាង gap **6–10px** (២ ខាង) ជំនួស ±4 · គែមដែលមើលឃើញវាស់ **គ្រប់ឪពុក** ដល់ `.page-main` · ការចុច (ស៊ុម ➜ កាត ·
  ជួរដេកខាងលើ ➜ តារាង · ចន្លោះ ➜ មិនមែនកាត) · **ផ្នែក ៩ ថ្មី** ៖ ថតតំបន់ ១១០px ក្រោមកាតលើផ្លូវ Android រួចប្លុក iOS + **ដកប្លុក Android-only**
  (`dropAndroidOnlyCss` — បើអត់ «ឯកសារយោង iOS» ក៏មានស៊ុមក្លែងដែរ) ហើយប្រៀប pixel (ពិដាន ២០ · ≤ ១២ pixel) លើ ៥ សេណារីយ៉ូ (ប្រវត្តិរមូរ ·
  ទំព័រស្កេន · ទំព័រស្កេនទទេ · ទាំង ២ ពេលផ្ទាំងខាងលើបើក) × ៣ viewport។ `PANELMOTION_SHOT_DIR` រក្សារូបថតសម្រាប់ដេញ។
- mutation **៩/៩** ចាប់ (ប្លុកបិទ ២៣ FAIL · ដកស្រមោលស ៩ · ដកគែមកាត ១៥ · clip ចំរបា ២១ · ស៊ុមមិនចាប់ការចុច ៣ · ដក margin សារទទេ ៦ ·
  ទុក padding តារាងទទេ ៥ · ទុក `::before` លើកាតទទេ ៦ · គែមតារាងឃ្លាត ២px ៩)។ ⛔ ជំនាន់ដំបូងប្រើពិដាន **៤៨** ➜ «ដកគែមកាត» និង «`::before` លើកាតទទេ»
  **រស់រាន** (គែម `#e2e8f0` ខុសពីពណ៌សត្រឹម ២៩) · គ្មានសេណារីយ៉ូ `-open` ➜ «ទុក padding តារាងទទេ» រស់រាន (កាតកម្ពស់តាមមាតិកា)។
- `gesture-test` ៖ ការអះអាងដដែលប្តូរទៅ 6–10px + គែមដែលមើលឃើញវាស់គ្រប់ឪពុក (ប្លុកបិទ ➜ FAIL ១) · `ios-panel-glide-test` ៖ ការក្លែង iOS ដកប្លុក Android-only។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- គ្មាន Firebase rules · គ្មាន env ថ្មី។ Deploy ZoeW · build APK ថ្មី។
- លើ Android (APK + Chrome) ៖ មើលគែមក្រោមប្រអប់ប្រវត្តិ ធៀប iPhone · រមូរចុះ ➜ របាលាក់ ➜ ប្រអប់រីកចុះ · រមូរតារាងនៅរលូន · ទំព័រស្កេនទទេ ➜ សារលេចពេញ។

### [2.45.2] — 2026-09-29 · ZoeW ៖ **ល្បឿនស៊ុមក្នុងរបា Slide ៖ «ស៊ុម App NNfps · ពេលរមូរ NNfps»** (merge រួច · PR #269)

**ZoeW `2.45.2` (`zoew-v242` ➜ `zoew-v243`)**។ ⛔ **ZoeKeyGen មិនប្រែ** (`2.22.0`)។

**របាយការណ៍ម្ចាស់គម្រោង** (រូបថតអេក្រង់ PWA · Chrome 154) ៖ របា Slide រាយ **«អេក្រង់ 60Hz»** តែ *«ខ្ញុំបើក show Refresh ពី developer mode 10-120hz
មិនថេ 60hz ដូច PWA និយាយ»*។ ⛔ **ស្លាក 2.42.11 ខុស** ៖ លេខនោះជា **ល្បឿនស៊ុម rAF ដែល browser ឲ្យ App ពេលវាស់** មិនមែនល្បឿនអេក្រង់ទេ ហើយ
វាវាស់តែ **ពេលបើករបា Slide** (ម្រាមដៃលើករួច) ➜ អេក្រង់ LTPO (10–120Hz) ពេលស្ងៀម ➜ ៦០ ខណៈពេលរមូរវាឡើង ១២០។ ⛔ ដូច្នេះការប្រៀប APK ធៀប PWA
ដោយលេខនោះ **គ្មានន័យ** លើទូរស័ព្ទប្រភេទនេះ។

#### អ្វីដែលខុសពីមុន

- ស្លាកប្តូរពី «អេក្រង់ NNHz» ទៅ **«ស៊ុម App NNfps»** (ពាក្យត្រូវនឹងអ្វីដែលវាស់)។
- **«ពេលរមូរ NNfps»** ៖ អ្នកស្តាប់ `scroll` (capture · passive លើ `window` ➜ គ្រប់កន្សោមរមូរ) វាស់ ២០ ស៊ុម rAF ពេលអ្នកប្រើរមូរពិត · ម្តងក្នុង ៥ វិ.
  (`SCROLL_RATE_GAP_MS` តាម `elapsedSince()`) · រក្សា **អតិបរមា** (`scrollFrameRate.peak`) ➜ ស៊ុមយឺតពេលក្រោយមិនបន្ទាបវា · អានតែ timestamp (មិនវាស់ layout)
  · rAF បោះ/អវត្តមាន ➜ មិនជាប់ «កំពុងវាស់»។ លេខលេចពេលបើករបា Slide បន្ទាប់ពីរមូរម្តង។

#### អ្នកយាម

- `ZoeW/tests/native/display-rate.test.tsx` (១០) ៖ ស្លាក · peak ពី rAF ក្លែង 120 ➜ «ពេលរមូរ 120fps» · ការហៅជាប់ៗ = ការវាស់តែមួយ · ៥ វិ. · peak មិនធ្លាក់ ·
  rAF បោះ/អវត្តមាន — mutation **៥/៦** (ករណីទី ៦ ៖ ការពិនិត្យ `typeof requestAnimationFrame` ស្ទួននឹង `try/catch` ➜ **ដកចេញ**)។
- `npm run smoke` ៖ ព្រឹត្តិការណ៍ `scroll` ពិតក្នុង build ផលិតកម្ម ➜ បន្ទាត់ត្រូវមាន «ពេលរមូរ» — ការដកអ្នកស្តាប់ចេញពី boot ➜ smoke **ធ្លាក់**។
- ⛔ **CI រកឃើញតេស្តធ្លាក់ដោយចៃដន្យក្នុង `ZoeW/tests/push-server.test.ts`** (មកពី 2.45.0) ៖ `vapidEnv()` យក `ecdh.getPrivateKey()` ឆៅ ➜ ៣១ byte ពេល byte ដំបូងជា ០
  ➜ `readPushConfig()` (ទាមទារ ៣២ ត្រឹមត្រូវ) បិទ VAPID ➜ `TypeError`។ វាស់បាន ៖ **១៥/៥០០០** (ឆៅ) ធៀប **០/៥០០០** (បំពេញ ០ ដូច `scripts/gen-vapid.mjs`)។
  កូដ server និង `gen-vapid.mjs` ត្រឹមត្រូវ ➜ កែតែ helper របស់តេស្ត។

#### ការវាស់ដែលបដិសេធសម្មតិកម្ម ៖ «ធុងសំរាមអាក់ក្រោយរមូរតារាងដល់ចុង»

ម្ចាស់គម្រោងរាយការណ៍ (APK · 2.45.1) ៖ *«ពេលឈរលើ ទាំងអស់ ពេលមិនទាន់ scroll smooth តែបន្ទាប់ពី scroll ដល់ចប់ សាកបើក modal ធុងសំរាមអាក់ដដែល
តែអត់សូវដូចមុន»*។ សម្មតិកម្ម ៖ ជួរទាំងអស់ដែលទាញចូលក្រោយរមូរ ធ្វើឲ្យការបើកប្រអប់ថ្លៃ (ឧ. `document.body.style.overflow = 'hidden'` បង្ខំ layout ទំព័រទាំងមូល)។
វាស់ (Chromium · CPU ×4 · WebView ក្លែង · history ៥០០ ជួរក្នុង ៦ ថ្ងៃ · ធុងសំរាម ១៦០ · trace ពេលចុច «ធុងសំរាម») ៖

| ករណី | ជួរក្នុង DOM | node | Layout | UpdateLayoutTree | HitTest |
|---|---|---|---|---|---|
| មិនរមូរ | ៥០ | ២៥២០ | ១៧៧–១៨០ ms | ៧៤–៨៨ ms | ៧–៩ ms |
| រមូរដល់ចុង | ៥០០ | ១៥១១៧ | ១៥៧–១៦១ ms | ៦៧–៧១ ms | ១៩–២៨ ms |
| រមូរដល់ចុង + `overflow` ដាក់ជាមុន | ៥០០ | ១៥១១៧ | ១៧៨ ms | ៧០ ms | ៣៣ ms |

➜ **បដិសេធ** ៖ ការបើកធុងសំរាមចំណាយ **ស្ទើរដូចគ្នា** ទោះ DOM ធំ ៦ ដង (មានតែ HitTest កើន ~២០ ms) · ការប្តូរ `overflow` មិនពាក់ព័ន្ធ។ ការចំណាយស្ថិតលើ **ខ្លឹមសារប្រអប់ខ្លួនឯង**
(Layout ~៧២៣ object សម្រាប់ ២០ ក្រុម) · CPU profile ៖ JavaScript របស់ `moreMenuRecentlyDeleted` ត្រឹម ~៤១ ms (×4) — ពេលភាគច្រើនជាការគូររបស់ browser។
ពិសោធន៍ដែល **មិនយក** ៖ ទំព័រដំបូង ១០ ក្រុម (ជួយតែករណីមិនរមូរ ១៨០ ➜ ១២០ ms · sentinel ទាញបន្ថែមភ្លាមៗ) · `table-layout: fixed` (១៣៣ ធៀប ១៣៦–១៧៨ ms · ញ័រ ·
ប្តូរទទឹងជួរឈរ)។ ⛔ ការថយ GPU/raster លើ WebView ពិតវាស់មិនបាននៅទីនេះ ➜ ជំហានបន្ទាប់ត្រូវការលេខ «ស៊ុមកក · យូរបំផុត» ពីទូរស័ព្ទ (ករណីមិនរមូរ ធៀបរមូរដល់ចុង)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- គ្មាន Firebase rules · គ្មាន env ថ្មី។ Deploy ZoeW · build APK ថ្មី។
- លើទូរស័ព្ទ Android ដដែល ៖ **រមូរតារាងប្រវត្តិ ២–៣ វិ.** រួចបើករបា Slide ➜ ប្រៀប **«ពេលរមូរ NNfps»** រវាង APK និង PWA (Chrome)។
  ⛔ «ស៊ុម App» (ពេលស្ងៀម) ៦០ លើអេក្រង់ LTPO **មិនមែនបញ្ហា**។
- ✅ **ម្ចាស់គម្រោងបញ្ជាក់លើឧបករណ៍ពិត (2026-09-29)** ៖ «ពេលរមូរ NNfps» APK ធៀប Chrome ត្រឹមត្រូវ (លេខមិនបានរាយ) ➜ ⛔ កុំកែភាពរលូន APK ដោយគ្មានរបាយការណ៍ថ្មី។

### [2.45.1] — 2026-09-29 · ZoeW ៖ **តារាងប្រវត្តិគូរ ៥០ ជួរ រួចទាញបន្ថែមពេលរមូរ** · **«ស៊ុមកក» ក្នុងរបា Slide** (merge រួច · PR #266)

**ZoeW `2.45.1` (`zoew-v241` ➜ `zoew-v242`)**។ ⛔ **ZoeKeyGen មិនប្រែ** (`2.22.0`)។

**សំណើម្ចាស់គម្រោង** ៖ *«apk នៅតែ អាក់ពេលឈរ លើ ទាំងអស់ ឥលូវអោយបង្ហាញ ៥០ជួរ ហើយពេលរមូរជិតដល់ចុងក្រោយចាំ បន្ថែមចូលទៀត»*។

#### អ្វីដែលខុសពីមុន

- **តារាងប្រវត្តិ** គូរតែ **៥០ ជួរថ្មីបំផុត** (`HISTORY_PAGE_ROWS`) ហើយជួរ «⬇️ បង្ហាញ … ជួរទៀត (នៅសល់ N)» ជា sentinel ៖
  IntersectionObserver លើកន្សោមរមូរ `.table-responsive` ជាមួយ `rootMargin` ខាងក្រោម **600px** ➜ ទាញ ៥០ ទៀត **មុន** ដល់ចុង ·
  ប៊ូតុងដដែលជាផ្លូវបម្រុង (គ្មាន IntersectionObserver)។ ⛔ ការគូរជាទំព័រ **មិនប្តូរទិន្នន័យ** ៖ ចំនួនសរុបលើក្បាលតារាងរាប់ធាតុ
  **ទាំងអស់** · តួលេខ/ស្ថិតិគណនាលើ `scanHistory` ពេញ (មិនមែន DOM)។
- ⛔ **កូនសោ view** (`renderHistory(data, viewKey)` ➜ `uiState.historyViewKey`) ៖ `applyCurrentFilter()` ផ្ញើ `filter|<mode>|<ថ្ងៃ custom>` ·
  `searchByPhone()` ផ្ញើ `search|<លេខ>` ➜ **ប្តូរ filter/ស្វែងរក ➜ ត្រឡប់ទៅ ៥០** តែ **sync ពី Firebase (filter ដដែល) មិនរុញអ្នកប្រើ
  ត្រឡប់ទៅ ៥០** ពេលគេរមូរចុះរួច។ `showMoreHistoryRows()` ឈប់កើនពិដានពេលគូរអស់ហើយ · `historyRenderCap()` = ៥០ លើតម្លៃខូច។
- **ជើងរបា Slide** ៖ បន្ទាត់ **«ស៊ុមកក 5 នាទីចុងក្រោយ ៖ N ដង · យូរបំផុត X ms»** ក្រោមលេខ Hz ៖ `PerformanceObserver`
  (`long-animation-frame` · ថយទៅ `longtask` · `buffered`) ចាប់ផ្តើមពេល boot · buffer ពិដាន ៣០០ · គណនាពេលបើករបា (មិនប៉ះផ្លូវក្តៅ)។
  ⛔ iPhone (Safari គ្មាន type ទាំង ២) ➜ **គ្មានបន្ទាត់** (មិនរាយ «0 ដង» ក្លែង) · observer បោះ ➜ fail-open។ ⛔ វាជាឧបករណ៍ **វាស់**
  សម្រាប់ប្រៀប APK និង PWA លើទូរស័ព្ទដដែល — មិនប្តូរឥរិយាបថ App។

#### លេខដែលវាស់បាន (`perf-check` · Chromium · ១២០០ ធាតុ · filter «ទាំងអស់»)

| | មុន (`d1d70da`) | ក្រោយ |
|---|---|---|
| ជួរក្នុង DOM | ១២០០ | **៥១** (៥០ + sentinel) |
| គូរតារាងទាំងស្រុង (cold) | ១៥៨ ms | **១១ ms** |
| boot ដល់ជួរដំបូង | ៨៥២ ms | ៦២៦ ms |

⛔ លេខទាំងនេះលើម៉ាស៊ីន server (គ្មាន CPU throttle) ➜ ទូរស័ព្ទយឺតជាងច្រើនដង ហើយការហូត/រមូររបស់ WebView ក៏ថយតាមទំហំ DOM ដែរ
(ជុំ 2.43.0 វាស់ PrePaint/HitTest ដែលកើនតាមចំនួនជួរ)។ ⚠️ ការសាកលើ APK ពិតនៅតែជាអ្នកសម្រេច ៖ បន្ទាត់ «ស៊ុមកក» ឥឡូវផ្តល់លេខនោះ។

#### អ្នកយាម

- `ZoeW/tests/history-paging.test.tsx` (៨ · `HistoryTableBody` ពិត + `applyCurrentFilter()` ពិត) ៖ ៥០ ជួរថ្មីបំផុត · ប៊ូតុង · sentinel ·
  root/rootMargin · ≤ ៥០ គ្មាន sentinel · ចំនួនសរុប · sync មិនរុញត្រឡប់ · ប្តូរ filter/ស្វែងរក ➜ ៥០ · ពិដានមិនកើនឥតឈប់ — mutation **៩/៩**។
- `audit-tools/perf-check.js` (២ ការអះអាងថ្មី · **Chromium ពិត**) ៖ filter «ទាំងអស់» ➜ ទំព័រដំបូង (ទំហំដេរីវេពី `app.js`) · រមូរកន្សោមពិតដល់ចុង ➜
  IntersectionObserver ពិតទាញជួរបន្ថែម។
- `ZoeW/tests/native/jank-meter.test.tsx` (១៣) — mutation **៨/៨** (ករណីទី ៩ «reset ក្នុង catch» ជា equivalent mutant ➜ កូដនោះត្រូវដកចេញ) ·
  `npm run smoke` ៖ ស៊ុមកក ≥ 150ms ដោយចេតនា ➜ `#jankLine` ពី **build ផលិតកម្ម** — ការដក `startJankMonitor()` ចេញពី boot ➜ smoke ធ្លាក់។
- `ZoeW/tests/list-render-scope.test.tsx` ៖ `N` ដេរីវេពី `HISTORY_PAGE_ROWS` (ក្រោមទំព័រ) ➜ វាស់វិសាលភាពការគូរដដែល។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- គ្មាន Firebase rules · គ្មាន env ថ្មី។ Deploy ZoeW · **build APK ថ្មី**។
- លើទូរស័ព្ទ Android ដដែល ៖ ឈរលើ filter «ទាំងអស់» រមូរ និងហូតផ្ទាំងប្រវត្តិ ១–២ នាទី រួចបើករបា Slide ➜ ប្រៀបបន្ទាត់ **«ស៊ុមកក»** រវាង **APK**
  និង **PWA (Chrome)**។ លេខជិតគ្នា ➜ បញ្ហានៅក្នុង WebView/អេក្រង់ · APK ច្រើនជាងច្រើន ➜ ផ្ញើលេខមក (ជំហានបន្ទាប់វាស់តាម `chrome://inspect`)។
- ✅ **ម្ចាស់គម្រោងបញ្ជាក់លើឧបករណ៍ពិត (2026-09-29)** ៖ តារាង ៥០ ជួរ និង «ស៊ុមកក» APK ធៀប Chrome ត្រឹមត្រូវ (លេខមិនបានរាយ)។

### [2.45.0] — 2026-09-29 · ZoeW ៖ **ការជូនដំណឹងលើទូរស័ព្ទ (Push) ទោះ App បិទ** · ZoeKeyGen `2.22.0` ៖ **ដាស់ push ភ្លាមក្រោយផ្ញើដំណឹង** (merge រួច · PR #267 ➜ PR #266)

**ZoeW `2.45.0` (`zoew-v241`)** · **ZoeKeyGen `2.22.0` (`zoekeygen-v108`)**។

**សំណើម្ចាស់គម្រោង** ៖ *«អោយការជូនដំណឹងរបស់ ZoeW មាន permission លោត notification លើ device ផង»* · *«អោយរលូន ដូច app chat
ឬ app ទូទៅដែរ»* · ជម្រើស ៖ **Push ពិត ទោះ App បិទ** · ព្រឹត្តិការណ៍ ៖ **ដំណឹងពីអ្នកលក់ + កញ្ចប់ជិតផុតកំណត់** · APK ៖ **FCM**។
សំណួរ «service key ធ្វើម៉េចពេលមាន Firebase អតិថិជនច្រើន?» ➜ ចម្លើយជារចនាសម្ព័ន្ធ ៖ FCM ប្រើតែ **License Project** (Project រួម)
ហើយអត្តសញ្ញាណឧបករណ៍ = **Activation Key** ➜ Firebase របស់អតិថិជនមិនពាក់ព័ន្ធ · អតិថិជនថ្មីគ្មានការកំណត់បន្ថែម។

#### ផ្លូវ

- **server** (`ZoeW/netlify/lib/push-core.mjs` · Function `push` + `push-cron` រាល់ ៥ នាទី · Netlify Blobs `zoew-push`) ៖ Web Push
  (aes128gcm RFC 8291 + VAPID ES256) · FCM HTTP v1 (OAuth តាម service account · single-flight) · ចុះឈ្មោះ/កាលវិភាគទាមទារ Activation Key ពិត
  (ហត្ថលេខា + Revoke/ផុតកំណត់ក្នុង License Project) · ពិដាន ១០ ឧបករណ៍/Key · endpoint តែ host សេវា push (SSRF) · 404/410/UNREGISTERED ➜ លុប ·
  ដំណឹងពីអ្នកលក់ ៖ អាន `license_announcements` (សាធារណៈ) ➜ ledger ETag (at-most-once · លើកដំបូង baseline · > ២៤ ម៉ោង មិនផ្ញើ) ·
  កញ្ចប់ជិតផុតកំណត់ ៖ ម្តង/ថ្ងៃ ម៉ោង ៨ Asia/Phnom_Penh តាមកាលវិភាគចុងក្រោយរបស់ Key (≤ ៤៨ ម៉ោង)។
- **ZoeKeyGen** ក្រោយផ្ញើដំណឹងជោគជ័យ (ឬពេល commit យឺត) ➜ `POST …/push?op=kick` (no-cors · ពិដាន ៨ វិ.) ➜ លោតភ្លាម · `push-cron` ជាផ្លូវបម្រុង។
- **ZoeW** ៖ ផ្ទាំង 🔔 ➜ «📲 ជូនដំណឹងលើទូរស័ព្ទ» ➜ បើក/បិទ · SW `push` (បង្ហាញរាល់ដង · badge · ប្រាប់ App ដែលបើក) · `notificationclick` ➜ focus/បើក
  `?notify=1` ➜ ផ្ទាំង 🔔 · APK ៖ `@capacitor/push-notifications` (channel `zoew_notify` · importance ខ្ពស់) · App ផ្ញើកាលវិភាគ **តែម៉ោង** (រាល់ ≤ ១០ នាទី ពេលប្រែ ·
  ៦ ម៉ោង ពេលមិនប្រែ)។ ⛔ `nearExpiryView()` និងកាលវិភាគ ប្រើការត្រងតែមួយ (`eachOpenParcel`) ហើយពេលផុតកំណត់ស្វែងរកតាម `barcodeAbandonIsRipe()`។
- **🧹 សម្អាត** (សំណើម្ចាស់គម្រោង ៖ *«អោយមានកន្លែង clear ផង»*) ៖ លាក់សេចក្តីប្រកាស/ដំណឹងទាំង ២ ប្រភព (`zoew_notify_dismissed_v1` · ពិដាន ២០០) ·
  បិទការជូនដំណឹងលើរបាទូរស័ព្ទ (web ៖ `getNotifications()` ➜ `close()` · APK ៖ `removeAllDeliveredNotifications()`) · badge ០ · ដំណឹងថ្មីនៅលេច ·
  ⛔ បញ្ជីកញ្ចប់ជិតផុតកំណត់ និង «📱 កំណែ App» មិនត្រូវសម្អាត (ទិន្នន័យពិត · លាក់វា = ភ្លេចកញ្ចប់ដែលនឹងដកលុយ)។ តេស្ត ២ (mutation **៤/៤**)។

#### អ្នកយាម

- `ZoeW/tests/push-server.test.ts` (២៣) ៖ RFC 8291 test vector **ស៊ីបេះបិទ** · VAPID ផ្ទៀងដោយ public key · **សារដែលផ្ញើពិតឌិគ្រីបវិញបាន** ដោយកូនសោឧបករណ៍ ·
  Key ក្លែង/Revoke/ផុតកំណត់/Extend/DB ដាច់ (503) · SSRF · ពិដានឧបករណ៍ · baseline · cron+kick ស្របគ្នា ➜ ម្តង · 410 · FCM (ហត្ថលេខា OAuth ពិត · channel)
  · ម៉ោង ៨ · កាលវិភាគចាស់ · HTTP (CORS · public key តែប៉ុណ្ណោះ · គ្មាន Key ក្នុងចម្លើយ)។ ⛔ **វារកឃើញកំហុសពិតមុន commit** ៖ ការផ្ញើ FCM ស្របគ្នាសុំ
  OAuth token ច្រើនដង ➜ single-flight។
- `ZoeW/tests/push-client.test.tsx` (១៨) ៖ `requestPermission` មុន `await` · ស្ថានភាពនិយាយការពិត · FCM (channel · token · ចុច ➜ ផ្ទាំង) · APK គ្មាន FCM ➜ មិនផ្ទុក plugin ·
  កាលវិភាគ (± ១ នាទី · គ្មានលេខទូរស័ព្ទ/barcode · ទិដ្ឋភាពមិនស្រស់ ➜ មិនផ្ញើ) · `?notify=1` · សារ SW · UI · SW ពិត (`push` · `notificationclick` · URL ក្រៅ origin ត្រូវបដិសេធ)។
  ⛔ ការអះអាងជំនាន់ដំបូងមួយ **flaky** (ប្រៀបការស្វែងរកគោលពីរលើ `now` ២ ផ្សេងគ្នា) ➜ ប្តូរទៅ invariant ± ១ នាទី · រត់ ៥ ដងជាប់។
- `npm run android:check` (+៧) ៖ `POST_NOTIFICATIONS` · channel manifest = `FCM_CHANNEL_ID` · រូបតំណាងតូច · `google-services.json` មិនចូល repo ·
  workflow សរសេរវា **មុន** build web + ផ្ទៀង package · `__FCM_CONFIGURED__` ដេរីវេពីវត្តមានឯកសារ · plugin sync។
- `keygen-notice-test` (+១០) ៖ ដាស់តែក្រោយ commit (មិនពេលបដិសេធ/ព្យួរ · ពេល commit យឺត ➜ ដាស់) · ព្យួរ/ធ្លាក់មិនបោះ · origin = `ZoeW/.env.android` · CSP អនុញ្ញាត។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ⛔ **Netlify env របស់ ZoeW** ៖ `node ZoeW/scripts/gen-vapid.mjs` ➜ `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` (សម្ងាត់) · `VAPID_SUBJECT` ស្រេចចិត្ត ·
  `FCM_SERVICE_ACCOUNT` = JSON (ឬ base64) ពី Firebase Console របស់ **License Project** ➜ Service accounts ➜ Generate new private key (សម្ងាត់)។
  គ្មាន env ➜ ផ្ទាំងប្រាប់ «Server មិនទាន់កំណត់» (អ្វីផ្សេងដើរធម្មតា)។
- ⛔ **APK** ៖ License Project ➜ Add app ➜ Android `com.zoesystem.zoew` ➜ `google-services.json` ➜ GitHub secret `ZOEW_GOOGLE_SERVICES_JSON` ➜ build APK ថ្មី។
- Deploy ZoeW (Function `push` · `push-cron` · Blobs រត់ដោយខ្លួនឯង) និង ZoeKeyGen (CSP `connect-src` ថ្មី)។ គ្មាន Firebase rules ថ្មី។
- iPhone ៖ ត្រូវដំឡើង PWA លើ Home Screen (iOS 16.4+)។
- ✅ **ធ្វើរួច** ៖ ម្ចាស់គម្រោងបញ្ជាក់ (2026-09-29) ថា env Push · `google-services.json` កំណត់រួច ហើយដំណើរការត្រឹមត្រូវ។

### [2.44.0] — 2026-09-29 · ZoeKeyGen `2.21.0` ៖ **ផ្ញើដំណឹងទៅ ZoeW** · ZoeW ៖ **ដំណឹងពីអ្នកលក់ក្នុងផ្ទាំង 🔔** (merge រួច · PR #267 ➜ PR #266)

**ZoeW `2.44.0` (`zoew-v240`)** · **ZoeKeyGen `2.21.0` (`zoekeygen-v107`)**។ ឈរលើ 2.43.0 (ផ្ទាំង 🔔) ➜ merge ចូល PR #266 ហើយទៅដល់ `main` ជាមួយគ្នា។

**សំណើម្ចាស់គម្រោង** ៖ *«ជួយថែមមុខងារមួយ អោយ App ZoeKeyGen មានកន្លែងអាចផ្ញើរសារជាដំណឹងទៅ ZoeW បានផង»* · អ្នកទទួល ៖ **អតិថិជនទាំងអស់**
(ការសម្រេចរបស់ម្ចាស់គម្រោង — មិនទាន់ផ្ញើតាម Key)។

#### ផ្លូវសារ ៖ ZoeKeyGen ➜ License Project ➜ ZoeW

- ZoeKeyGen មានកាត **🔔 ផ្ញើដំណឹងទៅ ZoeW** ៖ ប្រភេទ (📢 សេចក្តីប្រកាស · 🛠️ ការថែទាំប្រព័ន្ធ) · ចំណងជើង (≤ 120) · ខ្លឹមសារ (≤ 600 · ចុះបន្ទាត់បាន)
  · បញ្ជីដំណឹងដែលបានផ្ញើ + 🗑️ លុប។ វាសរសេរចូល `license_announcements/ZOE/<id>` ក្នុង **License Project** (Project ដដែលនឹង Key) ជាការសរសេរ
  multi-path តែមួយ ដែលលុបដំណឹងចាស់ជាងគេផង ➜ រក្សា **២០ ចុងក្រោយ**។ id = `n` + ម៉ោង ១៣ ខ្ទង់ + ៦ តួចៃដន្យ ➜ តម្រៀបតាមអក្សរ = តាមពេល។
- ZoeW អានវាតាម **REST គ្មាន auth** (ដូច `license_keys`) ៖ `license-verify.js` បើក `announcementsUrl()` (URL License តែមួយ ➜ `orderBy="$key"` +
  `limitToLast=20`) · ទាញ **ស្របគ្នា** ជាមួយ `announcements.json` ក្នុងច្រកទ្វារដដែល (បើក App · ត្រឡប់មក · រាល់ ៥ នាទី · បើកផ្ទាំង 🔔) · cache ដាច់ពីគ្នា
  (`zoew_notify_seller_v1`) · បញ្ជីរួមតម្រៀបតាមថ្ងៃ · badge/«បានអាន» រាប់ទាំង ២ ប្រភព។ ⛔ ដំណឹងទៅដល់ App **ដោយមិនចាំបាច់ deploy**។
- ⛔ **ដំណឹងពីអ្នកលក់មិនអាចក្លែងកំណែ App** ៖ rules ទទួលតែ `notice`/`maintenance` · ZoeW បោះ `update`/`version` ចោល (ទាំងពី server ទាំងពី cache)
  · «📱 កំណែ App» អានតែ `announcements.json` (ដំណឹងមួយមិនធ្វើឲ្យវារាយ «✅ កំណែចុងក្រោយ» ពេលឯកសារនោះទាញមិនបាន)។
- ⛔ **«ទាញមិនបាន» ≠ «គ្មាន»** ៖ 401 (rules មិនទាន់ Publish) · បណ្តាញ · JSON ខូច ➜ រក្សាដំណឹងចាស់ · `null` ពី server (អ្នកលក់លុបទាំងអស់) ➜ ដំណឹងបាត់ពិត ·
  ប្រភពមួយធ្លាក់មិនបំផ្លាញមួយទៀត · គ្មាន `ZoeLicense` ➜ ទាញតែ `announcements.json`។
- ZoeKeyGen ៖ ✅ លេចតែក្រោយ server commit · ⛔ **ព្យួរ** ➜ «⏳ មិនទាន់បញ្ជាក់ — ពិនិត្យបញ្ជីមុនផ្ញើម្តងទៀត» (RTDB ចាក់ជួរការសរសេរក្រៅបណ្តាញ ➜ វាអាច
  commit យឺត ➜ សារ «មិនបាន» នឹងនាំឲ្យផ្ញើស្ទួន) + ✅ ពេល commit យឺត · **បដិសេធ** ➜ «ផ្ញើមិនបាន» · logout កណ្តាលទី ➜ ស្ងាត់ · វាលមិនសម្អាតពេលមិនជោគជ័យ ·
  ចុចស្ទួនខណៈកំពុងផ្ញើ ➜ គ្មានការសរសេរទី ២ · បញ្ជី escape HTML · «អានមិនបាន» = ⚠️ មិនមែន «មិនទាន់មាន» · logout សម្អាតបញ្ជី និងវាល។

#### អ្នកយាម

- `emu/license-seat-rules-test.js` ផ្នែក ១២ (**rules ពិតលើ emulator ពិត**) ៖ payload/id ពី `buildNoticePayload()`/`newNoticeId()` **ពិត** របស់ ZoeKeyGen ·
  URL អានពី `announcementsUrl()` **ពិត** · admin សរសេរ/លុប · គ្មាន auth ឬមិនមែន admin ➜ បដិសេធ · `limitToLast` ➜ ថ្មីជាងគេ · ប្រភេទ `update` · ប្រវែងលើស ·
  វាលបន្ថែម · id ក្រៅទម្រង់ ➜ បដិសេធ **សូម្បី admin** · ទិសផ្ទុយ ៖ ព្រំដែនពិតត្រូវទទួល — ធ្លាក់លើ tree មុនកែ · mutation rules (ដក kind whitelist) ចាប់បាន។
- `keygen-notice-test.js` (ថ្មី · ៦៥) ៖ ស្នាមភ្ជាប់ `app.js` ↔ `index.html` (option · maxlength) ↔ rules (ប្រភេទ · ប្រវែង · regex id លើ ២០០ គំរូ) · `sendNotice()`/`deleteNotice()`
  ពិតក្នុងរបៀបបរាជ័យ ៤ — mutation **៦/៦** ចាប់បាន (toast មុន commit · គ្មានច្រកទ្វារ session · មិន escape · maxlength ឃ្លាត · ការកាត់ off-by-one ·
  logout មិនសម្អាត)។ ⛔ **វារកឃើញកំហុសពិតមុន commit** ៖ ពេល server **បដិសេធ** ការផ្ញើ សាររាយ «⏳ មិនទាន់បញ្ជាក់» (ផ្លូវព្យួរ) ជំនួស «ផ្ញើមិនបាន»
  ➜ ការបែងចែក «បដិសេធ» ពី «ព្យួរ» តាមទង់ `writeFailed`។
- `ZoeW/tests/seller-notices.test.tsx` (១៣) ៖ ប្រភេទ/ពិដានចំនួន/ពិដានចំណងជើង ដេរីវេពី ZoeKeyGen ពិត · payload ពិតគ្រប់ប្រភេទឆ្លង (គ្មានបាត់ស្ងាត់) ·
  URL ពី `license-verify.js` ពិត · សាលក្រម ៣ (`null` · ខូច · ល្អ) · Asia/Phnom_Penh · ការទាញ (ស្របគ្នា · ធ្លាក់រក្សាចាស់ · `null` លុបពិត · ប្រភពមួយធ្លាក់)
  · cache ក្លែងកំណែត្រូវបោះចោល · UI ពិត (badge · «បានអាន» · «📱 កំណែ App» មិនរាយ ✅) — mutation **៥/៥** ចាប់បាន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ⛔ **Publish rules របស់ License Project** ៖ paste `ZoeKeyGen/firebase-database.rules.json` ចូល Firebase Console របស់ **License Project** ➜ Publish
  (node ថ្មី `license_announcements`)។ មុន Publish ៖ ZoeKeyGen រាយ «⚠️ អានបញ្ជីដំណឹងមិនបាន» ហើយការផ្ញើធ្លាក់ · ZoeW មិនឃើញដំណឹង (អ្វីផ្សេងដើរដូចមុន)។
- Deploy ZoeKeyGen និង ZoeW (Netlify ពី `main`) · ⛔ APK ៖ កូដអានដំណឹងនៅក្នុង bundle ➜ **build APK ថ្មី** (ក្រោយនោះ ដំណឹងថ្មីៗទៅដល់ដោយមិន build ទៀត)។
- ⚠️ ដំណឹង **អ្នកណាក៏អានបាន** (ដូច `announcements.json`) — កុំដាក់ព័ត៌មានសម្ងាត់ លេខទូរស័ព្ទអតិថិជន ឬ Key។
- ✅ **ធ្វើរួច** ៖ ម្ចាស់គម្រោងបញ្ជាក់ (2026-09-29) ថា rules របស់ License Project Publish រួច ហើយដំណឹងដំណើរការត្រឹមត្រូវ។

### [2.43.0] — 2026-09-29 · ZoeW ៖ **ផ្ទាំងជូនដំណឹង 🔔 (ខាងស្តាំ)** · **logo ដូច App icon** · ZoeKeyGen `2.20.7` ៖ **logo ដូច App icon** (merge រួច · PR #266)

**ZoeW `2.43.0` (`zoew-v239`)** · **ZoeKeyGen `2.20.7` (`zoekeygen-v106`)**។ ផ្ទុក 2.42.11 នៅខាងក្រោម (merge ជាមួយគ្នាក្នុង PR #266)។

**សំណើម្ចាស់គម្រោង** ៖ *«សូមកែសម្រួល logo ក្នុង App ទាំង២ គ្រប់ទីកន្លែង … អោយដូច App icon។ និងបន្ថែមមុខងារ ជូនដំណឹង ជា Side Menu
ខាងស្ដាំ … រាយការណ៍ចំនួនកញ្ចប់អីវ៉ាន់ដែលជិតផុតកំណត់ និងពត៌មានឡើងកំណែapp ឬ announcement maintenance … សារ maintenance ទៅ App ភ្លាម។
និងផ្លាស់ទី ស្លាក "Powered By ZoeW" ចូលក្នុង side menu របស់ផ្ទាំងជូនដំណឹង🔔»*

#### logo = App icon

- ZoeW ៖ navbar · boot splash · សៀវភៅណែនាំ (`guide.html`) គូរ SVG ដូច `resources/icon.svg` (ប្រភពដដែលដែល `android-icons.mjs` សាង launcher
  icon) ជំនួសអក្សរ «Zoe»/«Z» · id gradient ដាច់ពីគ្នាក្នុងមួយកន្លែង (navbar + splash នៅក្នុងទំព័រតែមួយ)។
- ZoeKeyGen ៖ navbar · boot splash ប្រើ `icon-192.png` (រូបក្នុង `manifest.json`) ជំនួសអក្សរ «Key»។ ⛔ **តេស្តរកឃើញពិត** ៖ រូបនោះនៅក្នុង
  `OPTIONAL_SHELL` ➜ ឥឡូវជាផ្នែកនៃ UI ➜ ផ្លាស់ចូល `CORE_SHELL` (ក្រៅបណ្តាញ logo មិនបាត់)។

#### ផ្ទាំងជូនដំណឹង 🔔

- ប៊ូតុង 🔔 នៅជ្រុងស្តាំ navbar (ជំនួស «Powered By ZoeW» ដែលផ្លាស់ទៅជើងផ្ទាំង) · badge = កញ្ចប់ជិតផុតកំណត់ + សារមិនទាន់អាន + កំណែថ្មីដែលទាញរួច ·
  ផ្ទាំងបើកពីខាងស្តាំ ចែកផ្ទៃខាងក្រោយ · Back · Escape · ច្រកទ្វារ PTR ជាមួយរបា Slide (`isSideDrawerOpen()` រាប់ទាំង ២ · បើកមួយបិទមួយ)។
- **កញ្ចប់ជិតផុតកំណត់** ៖ barcode បើកដែលនឹងចូលធុងសំរាម (ច្បាប់ ៧ ថ្ងៃ ➜ **ដកលុយ**) ក្នុង ២៤ ម៉ោងខាងមុខ ⛔ សួរ **`barcodeAbandonIsRipe()` ដដែល**
  នឹងការសម្អាត (គ្មានរូបមន្តព្រំដែនទី ២) · រំលងជួរដេកបិទ/កំពុង Clear/កំពុងស្តារ · ទិដ្ឋភាពប្រវត្តិមិនស្រស់ ឬ Database មិនទាន់ភ្ជាប់ ➜ «វាស់មិនបាន»
  (មិនមែន «គ្មាន») · ចាកចេញ ➜ បញ្ជី (មានលេខទូរស័ព្ទ) លុបចេញពី DOM។ ⛔ អានសុទ្ធសាធ ៖ មិនប៉ះលុយ · ការសម្អាត · Firebase។
- **កំណែ App / សារថែទាំ** ៖ `ZoeW/public/announcements.json` deploy ជាមួយ App ➜ App ទាញវា **network-only** (`cache: 'no-store'` · SW មិនចាក់ចូល
  cache) ពេលបើក · ត្រឡប់មកវិញ · រាល់ ៥ នាទី · ពេលបើកផ្ទាំង ➜ merge ដល់ `main` ➜ Netlify deploy ➜ សារទៅដល់ App ក្នុងនាទី។ APK ទាញពី
  `VITE_NATIVE_WEB_ORIGIN` (header CORS ក្នុង `netlify.toml`)។ សារចាស់ cache ក្នុង `zoew_notify_feed_v1` (ក្រៅបណ្តាញ) · បានអាន ➜
  `zoew_notify_seen_v1`។ ការត្រងបដិសេធរូបរាងខុស (JSX គូរជាអត្ថបទ ➜ គ្មាន HTML)។
- ⛔ **រាល់ PR ដែលឡើងកំណែ ZoeW ត្រូវបន្ថែមធាតុ `announcements.json` សម្រាប់កំណែនោះ** (ធាតុ `update` ថ្មីបំផុត = `APP_VERSION`) — តេស្តធ្លាក់
  បើភ្លេច។ ⛔ សារ `maintenance` សុទ្ធ **មិនឡើងកំណែ App** ៖ `version-bump-scope` មិនរាប់ `announcements.json` ជាកូដ ship (វាមិនចូលសំបក SW —
  ការអះអាងថ្មីចាក់សោការពិតនោះ)។

#### ល្បឿន APK · ធុងសំរាម · បញ្ជី ZTO (របាយការណ៍ ៖ «APK នៅតែអាក់ … បើក modal បញ្ជី ZTO និងធុងសំរាម អាក់អាក់» · «PWA រលូនល្អ ទាំង iOS និង Android»)

- APK ៖ លេខក្នុងរបា Slide រាយ **120Hz · WebView 153** ➜ ល្បឿនអេក្រង់លែងជាមូលហេតុ។ ម្ចាស់គម្រោងសម្រេច ៖ **រក្សា Capacitor** (មិនមែន TWA/Kotlin)។
- ⛔ **រកឃើញកូដដែលរត់តែក្នុង APK** ៖ `measureStatusBarTone()` (`elementsFromPoint` ×៥ + `getComputedStyle` ➜ បង្ខំ layout + hit-test
  ទំព័រទាំងមូល) ត្រូវកេះ **រាល់ការប្រែ `uiState`** (ហូតប្រអប់ · លាក់របា · toast)។ harness ចាស់វាស់វាមិនឃើញ ព្រោះ safe-area = 0 ➜ ការវាស់រំលង
  ទាំងស្រុង ➜ ក្លែង safe-area 32px ៖ **៦០ ហៅ · 191–253 ms ក្នុងការហូត ៤ ដង** (CPU ×4 · ៥០០ ជួរ) ➜ ការកែ ៖ វាស់តែពេល **ស្រទាប់ក្រោមរបា** ប្រែ
  (`statusBarLayerSignature()` ៖ ប្រអប់ · របា Slide · 🔔 · ម៉ឺនុយ · សោ App · boot splash) ➜ **០** ពេលហូត · ទាំងវគ្គ 283–349 ➜ 7–9 ms។
- ធុងសំរាម ៖ ការបើកគូរ ២០០ ក្រុមក្នុងមួយដង ➜ Layout ~៦៥០ ms (dirty 6481) ➜ **គូរ ២០ ក្រុមដំបូង** + ទាញបន្ថែមពេលរមូរជិតចុង (IntersectionObserver)
  ឬចុច «បង្ហាញ … ក្រុមទៀត» · តួលេខសរុប/ស្វែងរកលើធាតុទាំងអស់ · ពិដាន ២០០ ដដែល ➜ ស៊ុមកកពេលបើក **800–933 ➜ 267–300 ms**។
- បញ្ជី ZTO មិនទាន់បិទ ៖ លែង subscribe `ztoState` ទាំងមូល (ការបោសស្ថានភាពគូរ Code128 ទាំងអស់ឡើងវិញ) · memo ជួរ · ២០ ដំបូង + ទាញបន្ថែម (រាល់
  barcode ទៅដល់តាមការរមូរ ➜ ស្កេនចូល ZTO Palm បានគ្រប់)។
- ⚠️ ការហូត/រមូរ **មិនប្រែគួរឱ្យកត់សម្គាល់ក្នុង Chromium** ហើយ WebView ពិតវាស់មិនបាននៅទីនេះ ➜ មិនទាន់អះអាងថា APK រលូនដូច PWA។

#### អ្នកយាម

- `ZoeW/tests/list-paging.test.tsx` (៦) ៖ ២០ ដំបូង · ចុច/sentinel · សរុបលើធាតុទាំងអស់ · ស្វែងរក/បើកម្តងទៀត reset · ពិដាន ២០០ · ZTO គ្រប់ barcode —
  mutation **៥/៥** ចាប់បាន (រួម «ស្វែងរកមិន reset» ដែលការអះអាងជំនាន់ដំបូងខកខាន)។
- `npm run native:check` ៤ឃ ៖ ហូតប្រអប់ ២ ដង ➜ `elementsFromPoint` = 0 · ទិសផ្ទុយ ៖ ប្រអប់បើក ➜ វាស់ពិត — ធ្លាក់លើកូដចាស់ (35 ហៅ)។
- `ZoeW/tests/app-icon-logo.test.tsx` (៥) ៖ ដេរីវេពី `resources/icon.svg` និង `manifest.json` ពិត · ធ្លាក់ **៤/៤** លើ tree មុនកែ · mutation
  (ផ្លាស់ path មួយ) ចាប់បាន។
- `ZoeW/tests/notifications.test.tsx` (១៤) ៖ ព្រំដែន ៧ ថ្ងៃ ± ១ ms · ជួរដេកដែលត្រូវរំលង · «វាស់មិនបាន» · ធាតុទី ១ = `APP_VERSION` · ការទាញ
  (ជោគជ័យ · ក្រៅបណ្តាញ · JSON ខូច · បណ្តាញធ្លាក់) · UI ពិត (badge · ផ្ទាំង ២ មិនជាន់ · ចាកចេញ) — mutation **៨/៨** ចាប់បាន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- គ្មាន Firebase rules · គ្មាន env ថ្មី។ `netlify.toml` (header `/announcements.json`) ចូលជាធរមានតាម deploy ធម្មតា។
- ⛔ APK ៖ build APK ថ្មីដើម្បីឃើញ logo/ផ្ទាំង 🔔 (សារថែទាំទាញពី web ➜ មិនចាំបាច់ build ឡើងវិញរាល់សារ)។
- ផ្ញើសារថែទាំបន្ទាន់ ៖ បន្ថែមធាតុ `"kind": "maintenance"` ខាងលើគេក្នុង `ZoeW/public/announcements.json` ➜ merge ➜ Netlify deploy ➜
  App ឃើញក្នុងពេលបើក/ត្រឡប់មក ឬ ≤ ៥ នាទី (គ្មានការឡើងកំណែ)។
- ✅ **ម្ចាស់គម្រោងបញ្ជាក់លើឧបករណ៍ពិត (2026-09-29)** ៖ logo និងផ្ទាំង 🔔 (badge · កញ្ចប់ជិតផុតកំណត់ · សារប្រកាស) លើ iPhone PWA · Android PWA · APK ត្រឹមត្រូវ។

## 🐛 ផ្នែក ២ — ប្រវត្តិកំហុស និងលេខដែលវាស់បាន (សម័យ React)

### 2026-10-08 — Deep audit ២ ៖ ជុំ ១៤ (SCALE-2..7) ➜ [2.50.30]–

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A26 | **SCALE-2** ការសម្អាតច្រើនរយកញ្ចប់រារាំង main thread | Claude ៖ `cleanup.ts` ពិត + SDK ក្លែង ៖ ៣០០ ripe ➜ `runScheduledCleanup()` ចាប់ផ្តើម ២០០ (ពិដាន journal) ក្នុងការហៅ synchronous តែមួយ · FAIL ២/៤ | batch ៨ + yield ៥០ms + ជុំដើរគ្រប់ (`cleanupSweepVisited`) |

- ការរចនាដំបូង (cursor តាមលិបិក្រមរង្វិល) ➜ កញ្ចប់ ២០ ដែលបរាជ័យភ្លាមនៅសល់ ➜ ការហៅនីមួយៗចាប់ផ្តើម ៨ ក្នុងចំណោម ២០ ម្តងទៀត ➜ ជុំមិនដែលចប់ (timer បន្តរហូត · FAIL ១) ហើយលិបិក្រមរំកិលពេលបញ្ជីរួញ ➜
  ប្តូរទៅ Set នៃ id ដែលបានមើលក្នុងជុំ ៖ ជុំចប់ពេលគ្រប់ id ត្រូវមើល · ជុំក្រោយ (កេះថ្មី) ព្យាយាមកញ្ចប់បរាជ័យម្តងទៀត។
- ការហៅដោយគ្មាន limit (checker ចាស់ ១០+) មិនប៉ះ state ថ្មី (`cleanupSweepVisited` អានតែពេលមាន limit) ➜ sandbox មិនត្រូវប្តូរ (លើកលែង `connection-recovery-test` ៖ ថេរ `CLEANUP_SWEEP_BATCH`)។
- ⛔ ការស៊ើបអង្កេតមិនប៉ះ probe liveness (`probeDatabaseLiveness()`) ទេ។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ១៣ (SUPABASE-1 · SUPABASE-6) ➜ [2.50.28]–[2.50.29]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A24 | **SUPABASE-1** ចាកចេញ/ចូលគណនីផ្សេងមិនទៅដល់ផ្ទាំងផ្សេង | Claude ៖ transport + sdk ពិត ២ ផ្ទាំង ៖ ផ្ទាំង A ចាកចេញ ➜ ផ្ទាំង B នៅ u1 ហើយ `rpc()` ផ្ញើគ្មាន Authorization · ផ្ទាំង A ចូល u2 ➜ ផ្ទាំង B ផ្ញើ `Bearer u2…` · FAIL ៤/៥ | session ចងនឹងផ្ទាំង · storage event + ការពិនិត្យក្នុង `rpc()`/`accessToken()` |
| A25 | **SUPABASE-6** `update()` > ៥០០ ផ្លូវមិន atomic | Claude ៖ adapter ពិត ៖ update ៥០១ ផ្លូវ + increment ➜ បំបែក ២ ការសរសេរ (ផ្នែកទី ១ អាចចូល ខណៈផ្នែកទី ២ ធ្លាក់) · FAIL ១/៦ · អ្នកហៅបច្ចុប្បន្ន ៩ ៖ increment មានតែក្នុង `finalizeClaimedRestore` (BOUNDED) | បដិសេធ increment លើសពិដាន · ចាត់ថ្នាក់អ្នកហៅ |

- ផ្ទាំងដែលបញ្ចប់សម័យដោយសារផ្ទាំងផ្សេង មិនហៅ `signOut()` (App គ្រាន់តែសម្អាតទិន្នន័យ + ប្រអប់ចូល) ➜ session របស់ផ្ទាំងផ្សេងនៅដដែល · ស្ថានភាព «បញ្ចប់» (`boundEnded`) រក្សារហូតដល់ចូល/ស្តារ/ចាកចេញក្នុងផ្ទាំងនោះ
  (មុនដំបូង ៖ `boundUid = null` ➜ `rpc()` យឺតពីសម័យចាស់ផ្ញើអនាមិក · FAIL ២)។ ការពិនិត្យក្រោយ refresh និងការបោះមុនក្នុង `rpc()` ស្ទួន ➜ ដកចេញ។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ១២ (NETWORK-1 · SENTRY-2) ➜ [2.50.26]–[2.50.27]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A22 | **NETWORK-1** ពិដានផ្ទុក SDK ឡើងវិញអស់ ➜ ការស្តារឥតប្រយោជន៍ · toast «កំពុងព្យាយាម» | Claude ៖ ជណ្តើរ + `online`/`visibility` ពិតក្នុង vm ៖ ក្រោយពិដានអស់ `initFirebase` ៩ ➜ ២៩ ក្នុង ១០ នាទី · Chromium ពិត ៖ ពិដានអស់ ➜ toast «កំពុងព្យាយាមម្តងទៀត» · `connection-recovery-test` FAIL ៨ · `sdk-offline-boot-test` FAIL ២ | `firebaseSdkNeedsRefresh()` ➜ ឈប់ + «សូម Refresh ទំព័រ» (App ទាំងពីរ) |
| A23 | **SENTRY-2** WASM ផ្ទុកមិនបានម្តង ➜ ស្កេនស្លាប់រហូត | Claude ៖ zxing-wasm ពិតក្នុង Chromium ៖ WASM 404 (streaming + ArrayBuffer) ➜ `readBarcodes()` reject «Aborted(both async and sync fetching of the wasm failed)» ជានិច្ច + unhandled rejection · vitest ZXing ក្លែង FAIL ៣/៤ · `scan-engine-test` FAIL ២ | purge + gate + prepare ឡើងវិញពី `./vendor/` · Sentry ១ · toast ១ |

- `connection-recovery-test` ១០ខ៣ មាន assertion ដែលចាក់សោកំហុសនេះ («ក្រោយអស់ពិដាន ការស្តារត្រឡប់ទៅជណ្តើរចាស់») ➜ ជំនួសដោយ «ជណ្តើរឈប់» · `b3` (ពិដាន ៣ វិ.) សងពិដានផ្ទុកឡើងវិញរាល់ជុំ ដើម្បីវាស់តែពិដាន ៣ វិ.។
- sandbox ដែលស្រង់ `renderConnectionStatus` · `retryFirebaseSdkNow` ត្រូវការ `firebaseSdkNeedsRefresh` ៖ `connection-recovery-test` (`REQUIRED_FNS` · `extras`) · `monotonic-gate-test` (stub `false`)។
- gate ក្នុង `recoverFirebaseSdk` ស្ទួន (mutation រស់ ៖ `scheduleFirebaseSdkRetry` · `retryFirebaseSdkNow` ទប់មុន) ➜ ដកចេញ។
- SENTRY-2 ៖ WASM 404 **ម្តង** មិនបំបែក library (Emscripten ទាញម្តងទៀតជា ArrayBuffer) ➜ ការវាស់ពិតត្រូវ 404 ២ ដង · sandbox `scan-engine-test` ត្រូវការ `prepareScanEngineModule` · `noteScanEngineLoadFailed` · `scanState` (វាលថ្មីមិនមែន state ដើម)។
- 🗳️ សំណើម្ចាស់គម្រោង ៖ `announcements.json` (ធាតុ `update`) សរសេរ **តែអ្វីដែលថ្មីក្នុងជុំនេះ** · អត្ថបទជុំចាស់លុបចោល (មិនបញ្ចូលចំណុចចាស់ទៀត) ➜ ច្បាប់ក្នុង `CLAUDE.md` ជួរ «🔔 panel»។

### 2026-10-08 — Deep audit ២ ៖ D7 (ដកឧបករណ៍ parity ធៀប ZoeW vanilla · ការសម្រេចម្ចាស់គម្រោង ៖ អនុញ្ញាត · PR ដាច់ · គ្មាន bump)

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A20 | **D7** ឧបករណ៍ parity ទាញ ZoeW vanilla ពីប្រវត្តិ git (`fetch-original.sh`) ហើយប្រៀប ៖ កាតាឡុក (`parity-static` ៖ function · ថេរ · state · `data-act` · id · កូនសោ storage · អត្ថបទ · `style.css` byte) · DOM/layout (`parity-dom`) · ទិន្នន័យ RTDB ក្លែង (`parity-live`) · សេណារីយ៉ូលុយ (`parity-deep`) · token នៃ function + តំបន់ហាម (`logic-identity`) · oracle ការគូរ (`history-row-parity` · `health-row-parity`) · ការខុសគ្នាដោយចេតនា (`INTENTIONAL_UI`) ➜ clone shallow ធ្វើឲ្យ `zoew-suite` · `zoew-parity` ធ្លាក់ · ការកែដោយចេតនានីមួយៗត្រូវបន្ថែមបញ្ជីលើកលែង (`REMOVED_STRINGS` · `ZONE_ALLOWED`) | Claude ៖ មុនដក `parity` បៃតង (`style.css` byte ១/១) · `logic:check` បៃតង (តំបន់ហាមដូចដើម លើកលែងការកែដែលមានហេតុផល) | ដក ១៤ ឯកសារ · script npm ៨ · ការងារ `zoew-parity` ➜ ការការពារជំនួស ៖ `ZoeW/tests/forbidden-zone-lock.test.ts` (sha256 LF នៃឯកសារតំបន់ហាម ៧ + `src/styles/app.css` ➜ ជំនួស ZONE របស់ `logic-identity` និង `style.css` byte) · `rules:check` ៖ ច្បាប់ដាច់ខាតលើ build web + Android · parity Android = web (ជំនួស oracle vanilla) · ការគូរ ៖ `list-render-scope` · `history-paging` · `layout-check` · `app-lock-test` (`#pinModalDesc` ក្នុង browser ពិត) · ផ្លូវលុយ ៖ `revenue-fuzz-test` · `emu/app-writes-rules-test` · `money-guardian-test` · `collected-mirror-*` |
| A21 | **`version-bump-scope`** រាប់ការកែ `scripts` ក្នុង `ZoeW/package.json` ជាកូដ ship | Claude ៖ D7 តែម្នាក់ឯង (base `9a2847a`) ➜ FAIL ២ («`package.json` ប្រែ ➜ ត្រូវឡើង `CACHE_VERSION` · `APP_VERSION`») ខណៈ script ដែលដកជាឧបករណ៍វាស់ មិនចូល bundle ➜ ការឡើងកំណែទទេ | ប្រៀប `package.json` តាមខ្លឹមសារ ៖ ដក `version` · រក្សាតែ script ក្នុងការបិទនៃច្រកផ្សាយ (`command` ក្នុង `ZoeW/netlify.toml` · `npm run … --prefix ZoeW` ក្នុង workflow · lifecycle ដំឡើង · `pre`/`post`) · រកច្រកមិនឃើញ ➜ script ទាំងអស់រាប់ ➜ ១៦/១៦ · កែ script `build` ➜ FAIL ២ វិញ · probe ទិសផ្ទុយ ៦ ក្នុង checker |

- `forbidden-zone-lock` ៖ ១១/១១ · កែ `PTR_START_ZONE_RATIO` ១ តួ ➜ FAIL ២ · បន្ថែមបន្ទាត់ ១ ក្នុង `app.css` ➜ FAIL ១ · CRLF មិនបំបែកសោ។ `rules:check` ក្រោយកែ ៖ ៧៥ ok · ០ FAIL (web + Android)។
- ផលបន្ថែម ៖ `zoew-suite` លែងត្រូវការប្រវត្តិ git (clone shallow រត់បាន) · `version-bump-scope` នៅត្រូវការ `origin/main` (`audit.yml` រក្សា `fetch-depth: 0`)។
- ព្រំដែន ៖ គ្មានអ្វីប្រៀបនឹង ZoeW vanilla ទៀតទេ ➜ កាតាឡុក «function/អត្ថបទ/កូនសោ storage/id ដើមនៅមានគ្រប់» លែងមាន · កូនសោ storage ដែលឯកសារលើកឡើងនៅត្រូវមានក្នុងកូដ ship (`doc-scope-test`)។
- សកម្មភាពដោយដៃ ៖ គ្មាន (គ្មាន rules · env · migration · deploy)។ ថត `ZoeW/.original` · `ZoeW/dist-parity` ចាស់លើម៉ាស៊ីនអ្នកអភិវឌ្ឍ លុបចោលបាន។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ១០–១១ (SECURITY-1 · ZTO-4 · ការសម្រេចម្ចាស់គម្រោង) ➜ [2.50.24]–[2.50.25]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A18 | **SECURITY-1** biometric `device` ទុក `wrapKey` ក្បែរ `wrapped` | Claude ៖ `enrollBiometricRecord()` ពិតលើ WebAuthn គ្មាន PRF ➜ `{ mode: 'device', wrapKey, wrapped }` ក្នុង localStorage · `wrapKey` + `wrapped` ពិតក្នុង storage ➜ `biometricUnlockPin()` ឲ្យ PIN · FAIL ៣/៤ | PRF-only · លុប record ចាស់ពេលបើក App |
| A19 | **ZTO-4** ជួរ born-closed មិនបញ្ចូលគ្នា (`!bornClosed`) | Claude ៖ `addOrUpdateEntry()` ពិត ២ ដង (អតិថិជនដដែល ថ្ងៃដដែល · `closedAtMs > 0`) ➜ ២ ជួរ · FAIL ២/៤ | បញ្ចូលចូលជួរបិទ · `isClosed` ដេរីវេពី barcode |

- run-all STRICT ក្នុង session លើ `72081c8` ៖ ១៩៩/២០៣ ➜ checker ៤ នៅជាប់ឥរិយាបថចាស់ (មិនមែនកំហុស App) ៖ `concurrent-scan-test` sandbox ខ្វះ `applyBarcodeCloseState` (ZTO-4 ប្រើវាក្នុង merge) ·
  `secret-hygiene` ចន្លោះ ១ឃ ដេរីវេ `wrapKey` ពីកូដ device ដែល SECURITY-1 ដក ➜ ជាន់ ៣ (p256dh · auth · wrapped) · វត្ថុ record ចាស់នៅវាស់ `wrapKey` · `app-lock-test` ផ្នែក ១១ ដាក់ record `device` ជា «ចងរួច» ➜ record `prf` ·
  `zoew-suite` `npm run parity` ៖ អត្ថបទ ២ ដែល SECURITY-1 ដក ➜ `REMOVED_STRINGS` (`intentional-removals.mjs`) ➜ ទាំង ៤ ឆ្លង (២៣/២៣ · ២៣៨ · ១៦២ · parity ៧៦៦/៧៦៦)។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ៩ (SECURITY-2 · SENTRY-3) ➜ [2.50.23]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A16 | **SECURITY-2** `SECRET_KEY_PATTERN` ខ្វះ `auth` · `wrap_key` · `wrapped` · `p256dh` | Claude ៖ `redactEvent()` ពិត លើ `{ sub: { keys: { p256dh, auth } } }` · `{ rec: { wrapKey, wrapped: { iv, data } } }` ➜ តម្លៃទាំងអស់ចេញ · ខ្សែអក្សរ `p256dh=` · `wrapped=` ចេញ ➜ FAIL ១៣ | ពាក្យ ៤ ក្នុងបញ្ជីកូនសោ · ២ ក្នុងបញ្ជីខ្សែអក្សរ |
| A17 | **SENTRY-3** `ZoeErrors.init()` គ្មាន release · វាល Error (`txOutcome` …) មិនទៅ Sentry | Claude ៖ ការហៅ ៤ (ZoeW ២ · ZoeKeyGen ២) គ្មាន argument ទី ២ · SDK ក្លែង ៖ `extra` គ្មានវាល Error ➜ FAIL ៧ | release `<app>@<APP_VERSION>` · `extra.errorFields` (allowlist) |

- run-all STRICT លើ `7b7dedd` (tree ដែល merge ជា PR #298) ៖ **២០៣/២០៣** (លើកទី ១ ៖ ២០០/២០៣ ➜ `emu/restore-mutation` sandbox ខ្វះ `LEDGER_OP_RING_MAX` · `zoew-suite`/`zoew-parity` ៖ clone shallow ➜ `original:fetch` ធ្លាក់ ➜ `git fetch --unshallow`)។

### 2026-10-08 — Deep audit ២ ៖ MONEY-4 (ring `ops` ក្នុង ledger · PR ដាច់) ➜ [2.50.22]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A15 | **MONEY-4** `unknown` ដែលអានបាន (ឧបករណ៍ផ្សេងសរសេរចន្លោះ commit និងការអាន REST) ➜ `ledgerRejectionVerdict()` `null` ➜ reconcile អនុវត្ត delta ម្តងទៀត · `ok: true` | Claude ៖ ឧបករណ៍ ២ រត់កូដ App ពិត (sandbox ២ · server ចែករំលែក) ➜ ថ្ងៃ ១០០ −៥ (យើង) −២ (គេ) ➜ **៨៨** · ខែ ៨៨ · ការស្តារ +៣ ➜ ៩៣ (ត្រូវ ៩៨) · ថ្ងៃថ្មី ១២ (ត្រូវ ៧) · គ្រប់ករណី `ok: true` · fuzz `ledgerBlip` ៖ ១០៦,៤៦ ជំនួស ៧៧,៦៣ | ring `ops/$op` = លំដាប់ ➜ `ledgerOpWitness()` · `unknown` ទាំងអស់ ➜ មិន ok |

- **ហេតុអ្វី ring សម្រេចបានត្រឹម** ៖ token `op_` + ១២ តួ base36 មានតែម្នាក់ ➜ token យើងនៅក្នុង ring ឬ `op` ➜ ការសរសេររបស់យើងបានចុះ (transaction ជា CAS ៖ មានតែការផ្ញើចុងក្រោយដែលអាចចុះ ➜ snapshot = តម្លៃដែលផ្ញើ)។
  «មិនបានចុះ» ត្រូវការភស្តុតាងនៃខ្សែមិនដាច់ ៖ ring ទុក token ដែលមានលំដាប់ធំបំផុត (លំដាប់ = ធំបំផុត + 1) ➜ ការរុញចេញដកលំដាប់តូចមុនជានិច្ច ➜ token ពី ring មុន (លំដាប់ < របស់យើង) នៅតែមាន ⇒ បើយើងបានចុះ token
  យើងក៏ត្រូវនៅដែរ ➜ អវត្តមាន = មិនបានចុះ។ ការសរសេរគ្មាន ring (App ចាស់ · ការថយ `op`) លុប ring ទាំងមូល ➜ token មុនបាត់ទាំងអស់ ➜ សម្រេចមិនបាន (មិនខុស)។ record ចាស់គ្មាន ring តែមាន `op` ➜ `op` ក្លាយជាធាតុ
  លំដាប់ 2 (យើង 3) ➜ ការសម្រេចដូចគ្នា។ record មិនទាន់មាន ➜ លំដាប់ 1 (record ដែលមានហើយចាប់ពី 2) ➜ ធាតុលំដាប់ 1 ជារបស់អ្នកបង្កើត record ➜ មិនមែនយើង ⇒ យើងមិនបានចុះ (ledger ថ្ងៃមិនដែលលុប · ខែលុបតែខែចាស់ជាង ៣ ខែចុងក្រោយ)។
  ការស្តារ (`increment` លើវាលលុយ) មិនប៉ះ `op`/`ops` ➜ ការសម្រេចនៅត្រឹម។
- **ជម្រើសដែលមិនយក** ៖ «`ok:false` គ្មានការអនុវត្តឡើងវិញ» (ម្ចាស់គម្រោងបដិសេធ) · ការអាន REST មុន commit (មិនបិទចន្លោះ) · tombstone ក្រៅ record (ការសរសេរទី ២ · មិន atomic)។ ring ១២ ៖ ការអានកើតភ្លាមពេលបណ្តាញត្រឡប់ ·
  ឧបករណ៍ផ្សេងសរសេរលើស ១២ ដងលើថ្ងៃដដែលខណៈរង់ចាំ ➜ សម្រេចមិនបាន (មិនខុស) · ទំហំ ~២៥០ byte ក្នុងមួយ record (listener ថ្ងៃទាញ root ទាំងមូល)។
- **mutation** (tx-outcome-test លើ app.js ពិត) ៖ ដកការពិនិត្យ token យើង ➜ FAIL ៨ · wrapper មិនសួរ witness ➜ FAIL ១១ · ring រុញលំដាប់ថ្មីចេញ ➜ FAIL ២ · `return serverAfter` (គ្មាន `op`/ring) ➜ FAIL ១៣ · ដកភស្តុតាង token មុន ➜ FAIL ២ ·
  ដកច្បាប់លំដាប់ 1 ➜ FAIL ១ · មិនដាក់ `op` ចាស់ក្នុង ring ➜ FAIL ២។ `money-guardian` បន្ថែម ២ (ពិនិត្យ token យើង · wrapper witness) · គោលដៅ `op` ថ្ងៃប្តូរទៅ `ledgerTagged(serverAfter, op, ring)`។
- **checker ដែលប្តូរ** (ឥរិយាបថដូចដើម) ៖ sandbox ដែលស្រង់ `runLedgerTransaction` តាមឈ្មោះ (១១ ៖ `cleanup-interrupt-atomicity` · `late-commit` · `ledger-count-integrity` · `ledger-failed-apply-revert` · `monthly-ledger-agreement` ·
  `price-edit-abort` · `revenue-rules-clamp` · `daily-collected` · `emu/ledger-revert-emu` · `emu/tx-disconnect-emu` · `emu/restore-mutation` (បញ្ជីថេរ · run-all ក្នុង session ៖ FAIL ១៦ ➜ ១៨២/១៨២)) ➜ បន្ថែម `ledgerOpRingOf` · `ledgerOpRing` · `ledgerOpWitness` · `ledgerTagged` · `LEDGER_OP_RING_MAX` ·
  `revenue-rules-clamp` ៖ validator ក្លែងអាន rules map (`ops/$op` ៖ ព្រំដែនលេខ + ប្រវែងកូនសោពី rules ពិត) · `ledger-failed-apply-revert` ៖ ការប្រៀបលុយរំលង `ops` ដូច `op` ·
  `tx-outcome-test` `foreign-equal-disconnect` ៖ ឧបករណ៍ផ្សេងប្តូរ token យើងទាំងក្នុង `op` និងកូនសោ ring (មុន ៖ តែ `op`) · ៤គ ទិសផ្ទុយ ៖ record មាន `op` (record ចាស់គ្មាន token ➜ ផ្នែក ៤ខ២ ៖ មិន ok)។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ៦–៨ (SENTRY-1 · ZTO-1 · ZTO-2 · សំណើម្ចាស់គម្រោង) ➜ [2.50.19]–[2.50.21]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A12 | **SENTRY-1** patch ជាប់គាំង ➜ revert ខណៈ transaction នៅរស់ | អ្នករក ៖ stall ➜ `false` + «បរាជ័យ» + Sentry ➜ commit យឺត ➜ server `called` · App គ្មាន · កែលេខ ➜ ម្ចាស់ស្ថិតិយកខុស · Claude ៖ FAIL ៦/៨ | `pending` + `armLateCommit` · revert តែ field ដែលគ្មានការជ្រើសថ្មី |
| A13 | **ZTO-1** ការអានបញ្ជីចុះហត្ថលេខារំលង (Data Saver · 2G · secret ចាក់សោ) | អ្នករក ៖ ០ fetch · abandon នាទី ៣១ · marker ០ · Claude ៖ FAIL ៣/៥ | អានពេល hold សកម្ម · secret ចាក់សោ ➜ hold មិនរាប់ម៉ោង |
| A14 | **ZTO-2** `signedOnly` ក្រោយធុងសំរាមលុប ➜ COD ពីរដង | អ្នករក ៖ lifecycle ពិត ➜ ledger ១០ ➜ ២០ · Claude ៖ FAIL ១/៣ | `pickedUpBarcodes` ជាសញ្ញា (គ្មាន rules ថ្មី) |

- ZTO-2 ៖ របាយការណ៍ស្នើ tombstone `zoew_purged_barcodes` + rules + SQL + Publish ➜ ការវាស់បង្ហាញថាស្ថិតិយក (`pickedUpBarcodes`) រក្សា key រួចហើយ (listen ទាំងមូល · គ្មានការលុបតាមអាយុ) ➜ ដំណោះស្រាយតូចជាង គ្មានសកម្មភាពដោយដៃ។
- CI (GitHub shard ១/៤ · ២/៤ · ៤/៤ លើ `49d6c44` និង checker ក្នុង session) ៖ sandbox ដែលស្រង់ `claimAndCleanupItem` តាមឈ្មោះខ្វះ `readCleanupJournal` (`stall-lock-release` · `restore-marker-hygiene`) ➜
  gate SCALE-1 ជាការហៅ journal ➜ fail-open ដូចការហៅ journal ផ្សេង (`try`) · sandbox ខ្វះ field ពិតរបស់ App ៖ `authGeneration` (`db-stall-guard` · `restore-marker-hygiene` · RACES-2) · `dailyPickupData`
  (`zto-list-sync-test` · ZTO-2) ➜ បន្ថែម · `code-duplication-test` ៖ ធាតុ `ACCEPTED` `allClosedLocal` ងាប់ក្រោយ ZTO-3 (ប្លុក server លែងស្ទួន) ➜ ដក · `money-guardian` ៖ គោលដៅ mutation registry ក្រោយ `txProven` ·
  `notifications.test.tsx` ៖ កំណត់ចំណាំ 🔔 ≤ ១២ ចំណុច · typecheck តេស្ត RACES-2។ មេរៀន ៖ ពេលប្តូរ function ដែល checker ស្រង់តាមឈ្មោះ ➜ រត់ checker ទាំងនោះលើ measure root មុន push។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ៥ (RACES-2 · late commit ក្រោយប្តូរហាង) ➜ [2.50.18]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A11 | **RACES-2** ការងារក្រោយ commit ក្នុងការសម្អាត/លុបអាន refs បច្ចុប្បន្ន · resolver មិនពិនិត្យ session ក្រោយការអាន | អ្នករក ៖ wrapper ពិត ➜ ledger B ១០០ ➜ ៩០ · A មិនប្តូរ · Claude ៖ vitest ហាង A/B ➜ FAIL ៤/៥ (resolver `applied` · ធុងសំរាម B · ledger B ៩០ · ធុងសំរាម B ពីការលុប) | gate session ក្នុង resolver · ការសម្អាត (៣ ចំណុច) · ការលុប (៣ ចំណុច) |

- ការស្តារមិនប្រែ ៖ ជំហាននីមួយៗត្រូវការ claim token/witness ដែលមានតែក្នុង database ដើម ➜ rules បដិសេធក្នុង database ផ្សេង។
- ជម្រើសដែលមិនយក ៖ រក្សា journal របស់ហាងចាស់រហូតត្រឡប់មកវិញ ➜ ប៉ះពិដាន SCALE-1 · ការលុប scope ដែលមិនត្រូវ · checker sandbox ១២ ➜ ធំពេកសម្រាប់ករណីកម្រ (Sentry money ជាសញ្ញាជំនួស)។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ៤ (ZTO-3 · NETWORK-2) ➜ [2.50.17]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A9 | **ZTO-3** `applyBarcodeCloseChange()` stamp `closedAt` ទោះ server បិទរួច | អ្នករក ៖ `runZtoStatusSweep` លើទិដ្ឋភាពចាស់ ➜ `closedAt` T0 (២៣:៣០) ➜ ០០:៣០ ថ្ងៃបន្ទាប់ · Claude ៖ ដដែល + ផ្លូវផ្ទាល់ + កញ្ចប់លាយ | រក្សា stamp ពេលស្ថានភាពដដែល (ក្រៅ `LOCK`) |
| A10 | **NETWORK-2** `firebaseState.fb = nextFb` មុន teardown | Claude ៖ fake SDK រាប់ `off()` ➜ SDK ចាស់ ០ · SDK ថ្មីទទួល ref ចាស់ ៩ (ទិសទាំងពីរ) | កំណត់ SDK ថ្មីក្រោយ teardown |

- RACES-2 (late commit ក្រោយប្តូរហាង) ➜ ជុំក្រោយ (ប៉ះលុយ · ត្រូវការការរចនាដាច់)។ SENTRY-1 រង់ចាំការសម្រេចម្ចាស់គម្រោង។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ៣ (Supabase adapter ៖ SUPABASE-2 · 5 · 4 · 3) ➜ [2.50.16]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A5 | **SUPABASE-2** `claimBarcodeInRegistry()` `applied` ➜ `unknown` លើ Supabase ទោះ `op_id` បញ្ជាក់ | អ្នករក ៖ adapter ពិត ទម្លាក់ចម្លើយដំបូង ➜ `unknown` · key `true` គ្មានម្ចាស់ · Claude ៖ vitest adapter + wrapper + registry ពិត ➜ `unknown` | `txProven` ពី adapter ➜ `claimed` · Firebase ដដែល |
| A6 | **SUPABASE-5** 2xx body ទទេ/កាត់/stream ➜ ការបដិសេធចុងក្រោយ | អ្នករក ៖ `applyWriteResult(null)` ➜ TypeError · Claude ៖ transport ពិត ៣ រូបរាង × set/transaction ➜ ៦ FAIL + transport ១ | body អានមិនបាន = `SbNetworkError` · `zoe_write` 2xx ទទេ/មិនមែន JSON = `SbNetworkError` |
| A7 | **SUPABASE-4** `resetForSignOut()` មិនលុប `pullStage` | អ្នករក ៖ ចូលវិញជាមួយ cache ➜ ២/៩ · ready · cache ២ · Claude ៖ ដដែល | លុប stage ពេលចាកចេញ |
| A8 | **SUPABASE-3** `tenant` ពិនិត្យតែក្រោយ cache | អ្នករក ៖ A ➜ B ➜ ទិដ្ឋភាព A១–៥ + B៦–៨ · cache B មាន A · Claude ៖ ដដែល | `tenant` ផ្សេង ➜ ទាញពី ០ |

- ឫសរួម ៖ adapter ធ្លាប់ចាត់ «ចម្លើយមិនច្បាស់» ជា «ចម្លើយច្បាស់» (A5 ៖ ភស្តុតាងមានតែមិនបញ្ជូន · A6 ៖ ចម្លើយខូច = ការបដិសេធ) ហើយស្ថានភាព session មិនចងនឹងអ្វីដែលវាជា (A7 stage · A8 tenant)។
- SUPABASE-1 (ចាកចេញមិនដល់ tab ផ្សេង) · SUPABASE-6 (`update()` > ៥០០ ផ្លូវ) នៅជុំក្រោយ។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ២ (SCALE-1 · journal សម្អាតទម្លាក់ entry ដែលកំពុងរស់) ➜ [2.50.15]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A4 | **SCALE-1** `writeCleanupJournal()` `slice(-CLEANUP_JOURNAL_MAX)` ទម្លាក់ entry ចាស់បំផុត ខណៈការសម្អាតរបស់វានៅរត់ | អ្នករក ៖ ២០១ ➜ បាត់ ១ · ២៦០ ➜ បាត់ ៦០ · ៣០០ ➜ បាត់ ១០០ · Claude ៖ vitest module ពិត ២៦០ កញ្ចប់ + ធុងសំរាមព្យួរ ➜ claim ២៦០ · journal ២០០ · សម្លាប់ ➜ resume ➜ ធុងសំរាម ២០០ · ledger ដក ២០០ (ត្រូវ ២៦០) | gate `cleanupInFlight` + journal < ពិដាន មុន claim · journal មិនទម្លាក់ entry ➜ `ZoeW/tests/cleanup-journal-cap.test.ts` |

- ឫស ៖ ពិដាន ២០០ ជាព្រំដែនទំហំ storage តែបានអនុវត្តលើ **ទិន្នន័យដែលកំពុងប្រើ** ➜ ការការពារ quota ក្លាយជាការបាត់កញ្ចប់។ ព្រំដែនត្រូវនៅមុន claim (ការងារមិនទាន់ចាប់ផ្តើម
  អាចរង់ចាំ) មិនមែនលើ journal (ការងារដែលចាប់ផ្តើមរួចត្រូវតែបញ្ចប់)។
- churn O(N²) របស់ journal (អ្នករក ៖ ៨៣ MB ពេល ៣០០) ឥឡូវមានព្រំដែនដោយ gate ដដែល · ការរារាំង main thread ពេលសម្អាតច្រើន (SCALE-2) នៅជុំក្រោយ។

### 2026-10-07 — Deep audit ២ (workflow ៖ អ្នករក ១១ ➜ ផ្ទៀងផ្ទាត់ ៣ lens · ម្ចាស់គម្រោងអនុញ្ញាត) ៖ ជុំ ១ ➜ [2.50.14]

> Workflow រត់លើ repo ដើម (អាន · វាស់ក្នុងច្បាប់ចម្លង) · ការកែធ្វើក្នុង worktree ដាច់ដោយឡែក · findings ដែលអ្នករកវាស់ដោយរត់កូដពិត (`measured`) ហើយកម្រិត high
> ត្រូវកែមុន verify ចប់ តាមសំណើម្ចាស់គម្រោង («ចាប់ផ្តើមកែឥឡូវ · workflow រត់បន្ត») ក្រោយ Claude ផ្ទៀងផ្ទាត់ខ្លួនឯង។ findings ផ្សេងរង់ចាំ verify (lens refute · measure · impact)។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A1 | **RACES-1 = MONEY-2** merge ចូលកញ្ចប់ដែល server លែងមាន (`history-write.ts` `return fallbackItem` ពេល `null`) | អ្នករក ៖ vitest លើ module ពិត (`addOrUpdateEntry` ➜ transaction ឃើញ `null` ➜ server `itemI` = [A, C] · A `isDeducted: false` ខណៈធុងសំរាម A `isDeducted: true` · ចំណូល(យករួច) ៣៥ ជំនួស ២៥ · ដក A ម្តងទៀត ➜ ledger ២៥ ➜ ១៥ · ធុងសំរាមដករួច ២ ច្បាប់) · ទ្វារដដែលតាម `importZtoListRows()` · Claude ផ្ទៀងផ្ទាត់ ៖ Firebase SDK រត់ updater ឡើងវិញដោយតម្លៃ server ពេល hash មិនត្រូវ (`null` ពេលឧបករណ៍ផ្សេងលុប/ដកចុងក្រោយ) · Supabase adapter `base = res.value ?? null` · គ្មានអ្នកយាម (`concurrent-scan-test` merge ចូលកញ្ចប់ដែល server មានតែប៉ុណ្ណោះ · `grep fallbackItem` ក្នុង audit-tools/tests ៖ ០) | **ពិត · លុយ** ➜ `freshHistoryItemFrom()` (កញ្ចប់ថ្មី ៖ `id` · `phone` + barcode ដែល merge · `createdAt` = របស់ barcode) · មិនអាច abort លើ `null` (cache ត្រជាក់ ➜ abort មុនទាក់ទង server ➜ រក្សាទុកមិនបានរហូត listener មកដល់) ➜ សរសេរកញ្ចប់ថ្មីដដែលលើផ្លូវទាំងពីរ · `merge-into-deleted-item.test.ts` មុនកែ FAIL ៤/៦ ➜ ៦/៦ · mutation ៣ ➜ FAIL ៤ · ១ · ៤ · fuzz ៖ `other:remove` ដក barcode ចុងក្រោយបាន (២/២ tree ទាំងពីរ · មិនចាប់ទ្វារនេះ ➜ op ជាក់លាក់ជុំក្រោយ) |
| A2 | **MONEY-1** cleanup ទាំងមូល + `applied` ➜ `cleanupClaimAccountedElsewhere()` អាន REST (`cleanup.ts`) | អ្នករក ៖ vitest module ពិត · ref `supabase:…` ➜ `txRestUrl` = "" ➜ `'unknown'` ➜ abandon/close ៖ ប្រវត្តិ null · ធុងសំរាម null · ledger ១០០ ដដែល · journal ០ · Sentry «ownership unverified» · Claude ផ្ទៀងផ្ទាត់ ៖ adapter `if (lost) committed.txOutcome = 'applied'` (`supabase-rtdb.ts`) ➜ រាល់ចម្លើយបាត់ក្នុង cleanup លើហាង Supabase = កញ្ចប់បាត់ · Firebase ៖ REST តែមួយដងធ្លាក់ ➜ ដូចគ្នា · មូលហេតុដែលការពិនិត្យមាន ៖ តម្លៃផ្ញើ `null` មិនបញ្ជាក់ថាយើងជាអ្នកលុប (ឧបករណ៍ផ្សេងអាចសម្អាតមុន ➜ ដកលុយ ២ ដង · HISTORY-ARCHIVE «Transactions: disconnect») | **ពិត · លុយ** ➜ ម្ចាស់សម្រេចដោយ transaction «បង្កើតបើគ្មាន» លើ `zoew_recently_deleted_cod_dod/<id>` (`claimCleanupTrashSlot()` · backend ទាំងពីរ · abort = ឧបករណ៍ផ្សេង) · journal stage `slot` មុនបណ្តាញ (lens ៣ ៖ ⛔ `moved` មុនដឹងម្ចាស់ ➜ resume ដកលុយ claim ឧបករណ៍ផ្សេង) ➜ `resolveCleanupSlot()` · `cleanup-applied-ownership.test.ts` មុនកែ FAIL ៥/៦ ➜ ៦/៦ · mutation ៣ ➜ FAIL ២ · ១ · ១ · ដែនកំណត់ដែលនៅ ៖ ឧបករណ៍ ២ claim ដដែលក្នុងបង្អួចតូច (ទាំងពីរ `applied` · អ្នកចាញ់ slot មិនដក ✓ · តែ journal អ្នកចាញ់ក្រោយ App ងាប់ឃើញធុងសំរាមមាន ➜ ledger stage) = ថ្នាក់ចាស់មិនពង្រីក |
| A3 | **MONEY-3** ធុងសំរាម `isDeducted: true` មុន ledger (`cleanup.ts` `finishCleanup`) | អ្នករក ៖ vitest ពិត · ledger ព្យួរ ➜ ធុងសំរាម `true` · journal `ledger` · ស្តារពីឧបករណ៍ B ➜ ១១០ · resume ➜ `''` · journal ០ · គ្មាន Sentry · Claude ផ្ទៀងផ្ទាត់ ៖ stage `moved` + ធុងសំរាមបាត់ ➜ កូដសរសេរធុងសំរាមឡើងវិញ + ដក (មិនមែនលុបស្ងាត់ដូចអ្នករកសរសេរ) ➜ បើកញ្ចប់ស្តាររួច ➜ ច្បាប់ចម្លងស្ទួន · rules ធុងសំរាម `isDeducted` boolean គ្មានលក្ខខណ្ឌឆ្លងវាល ➜ មិនត្រូវប្តូរ rules · `uncollectedValueByDate()` រាប់ធុងសំរាម `!isDeducted && !isClosed` ➜ ក្នុងបង្អួច ledger មិនទាន់ដក + ធុងសំរាម `false` = «ចំណូល (យករួច)» ត្រឹម (មុនកែ ៖ ប៉ោងក្នុងបង្អួច) | **ពិត · លុយ** ➜ ទង់ដើរតាមលុយ (`false` ➜ ledger ➜ `flip` ➜ `true`) · resume ស្គាល់ការស្តារ (barcode ត្រឡប់ក្នុងប្រវត្តិ · ទិដ្ឋភាពស្រស់) · ម្ចាស់គម្រោងជ្រើស «កែពេញ» · `cleanup-deduct-order.test.ts` មុនកែ FAIL ៨/១០ ➜ ១០/១០ · mutation ៥ ក្រហមគ្រប់ · checker ១២ ស្រង់ helper ថ្មី (មើល [2.50.5] អ្នកយាម) · ការពិនិត្យ «ត្រឡប់ក្នុងប្រវត្តិ» ទាមទារ `restoredAt` ≥ `deletedAt` − ២ ម៉ោង (ច្បាប់ចម្លង local ចាស់នៃកញ្ចប់ដែលទើបសម្អាតមិនមែនការស្តារ ៖ sandbox atomicity បង្ហាញ · `restoredAt` មុនការសម្អាតចាស់ ≥ ៧ ថ្ងៃ) · stage `flip` ៖ ធុងសំរាម local នៅមាន ➜ ទិដ្ឋភាពយឺត ➜ រង់ចាំ |

### 2026-10-07 — ចង្វាក់ស៊ុមសម្រប ↔ LTPO ៖ perf-lite ខុសលើអេក្រង់ ១២០Hz · ខកខានលើឧបករណ៍យឺត ➜ [2.50.9]

- rAF ក្លែង (vitest · `setupAdaptivePerformance()` ពិត) លើ `perf.ts` មុនកែ ៖ ១២០ ថេរ ➜ Hz ១២០ · មិន lite ✅ · ៦០ ថេរ ➜ ៦០ · មិន lite ✅ · **LTPO** (២៥ ស៊ុមដំបូងនៃជុំ ១២០ រួច ៦០) ➜ Hz ១២០ ➜ ពិដាន ១៣ms ➜ ស៊ុម ១៦,៧ms ទាំងអស់ «កក» ➜ **lite = true** ❌ · **យឺតពិត** (៩/២០ ស៊ុម ៥០ms) ➜ median ២៤ ស៊ុម = ៥០ms ➜ «20Hz» ➜ ពិដាន ៨០ms ➜ **lite = false** ❌។ មូលហេតុរួម ៖ Hz វាស់ក្នុងបង្អួចដាច់ពីបង្អួចស៊ុមកក (២៤ ស៊ុម ➜ ៩០ ស៊ុម) ➜ អេក្រង់ប្តូរ Hz នៅចន្លោះ ឬបង្អួចតូចដែលស៊ុមកកលើសពាក់កណ្តាល។
- ការកែ ៖ បង្អួចតែមួយ ៩០ ស៊ុម (median ធន់នឹងស៊ុមកក < ៥០%) · Hz ខ្ពស់បំផុតរៀនពីការរមូរពិត (ការប៉ះធ្វើឲ្យ LTPO ឡើង Hz អតិបរមា) ហើយចងចាំ ➜ ឧបករណ៍ ≥ ៩០Hz មិន lite។ ក្រោយកែ ៨/៨ · មុនកែ ក្រហម ៥/៨។ ⛔ មិនទាន់វាស់លើទូរស័ព្ទ LTPO ពិត។

### 2026-10-07 — accessibility × ទំហំ DOM ៖ ហេតុអ្វី «តែ APK អាក់» · PWA Android · iPhone ➜ [2.50.8]

- Sentry `JAVASCRIPT-REACT-9` ២៦ event (APK `2.50.5-test.2adf39f` · Xiaomi `24030PN60G` · WebView 153 · ១២០Hz · ៨៦/៨៦ ជួរ) ៖ long frame ៥៨–១៣៦ms ដែល script ធំបំផុតតែ ១០–២៣ms · ផ្នែកគូរ ~០–១ms · gap ៤១–៥០ms ខ្លះគ្មាន long frame សោះ ➜ ភាគច្រើនជាការងារ browser ក្រៅ JS។ `_h` = `dispatchDiscreteEvent` ក្នុង chunk React (build `index-j3viNUV7.js` ឡើងវិញបេះបិទ ៖ `--mode android` + `google-services.json` ➜ `__FCM_CONFIGURED__`)។ ១១ ជួរ (ថ្ងៃនេះ) ➜ gap ១៧–២៥ms។
- Chromium headless · CPU ÷៤ · `--force-renderer-accessibility` ៖ ៩០ ជួរ (DOM ពេញ) បើកធុងសំរាម gap ១៦៧–៣១៧ms ➜ **៦១៧–១០០០ms** · `RunAccessibilitySteps` ៦០០–១០០០ms (`SerializeLifecycleStage` ភាគច្រើន)។ ៦០០ ជួរ ៖ DOM ពេញ (PWA) gap រហូត **៨៣៧៩ms** · accessibility ១៤៤៧–៣៩១៣ms ក្នុង sample ធំ ➜ ជួរតាមទីតាំងរមូរ gap ១៥៩–៤២៤ms · accessibility ៥៣–២១១ms។ accessibility បិទ ៖ DOM ពេញ ៣៩–២២៥ms ធៀប ៣២–១៤៤ms។ ➜ ថ្លៃ accessibility កើនតាមចំនួន node ទាំងទំព័រ ហើយ WebView សាងមែកធាង accessibility ពេលមានសេវាជំនួយបើក ខណៈ Chrome ត្រងវា — សម្មតិកម្មដែលពន្យល់ «តែ APK» (មិនទាន់វាស់លើទូរស័ព្ទ)។ ថ្លៃនៅសល់ពេលបង្ហាញតាមទីតាំងរមូរ ៖ accessibility លើទំព័រ ~១៦០០ node (១២០–១៦០ms ក្រោម CPU ÷៤) មិនមែនតារាង។
- ស្ថេរភាពរមូរ (APK · ៦០០ ជួរ) ៖ រមូរចុះ ៣០០ × ៤០px ➜ លោត ០ · ជួរខាងលើ viewport ធំ/តូចពេល sync ➜ ជួរដែលមើលឃើញរំកិល ០px · លោតដល់ចុងរួចរមូរឡើង ៣០០ ជំហាន ➜ លោត ២ ដង ≤ ៤px (ជួរដែលការលោតរំលងមិនទាន់វាស់ · estimate ១៦០ ធៀបពិត ~១២៧px)។
- PWA iPhone/កុំព្យូទ័រមិនប្រែ ៖ build `2adf39f` ធៀប tree ក្រោយ `84665b2` (web · ៦០០ ជួរ · UA Android · iPhone (+ `navigator.standalone`/`-webkit-touch-callout` ក្លែង ➜ `html.ios-standalone`) · Desktop ១២៨០) ៖ HTML `#historyTableBody` · `scrollTop` · `scrollHeight` ដូចគ្នាបេះបិទ ៥/៧ ជំហាន។ ជំហានប្តូរតម្រងខុសគ្នា ក៏កើតពេលប្រៀប build ចាស់នឹងខ្លួនឯង (A/A) ➜ noise ពេលវេលារបស់ការផ្ទុកបន្ត (IntersectionObserver) — ការផ្ទុកបន្តនោះ [2.50.8] កែ (ត្រឡប់កំពូល)។

### 2026-10-07 — CI ក្រោយ commit `daa120f` ៖ class ជួរចន្លោះគ្មាន CSS និង Maven Central 403 ➜ [2.50.7]

- Audit run `37623340619`៖ ២០២ checker ឆ្លង · `css-classes` ធ្លាក់តែមួយដោយ `.history-virtual-spacer`។ Class នេះបន្ថែមក្នុងការកែបង្ហាញជួរតាមទីតាំងរមូរ ប៉ុន្តែគ្មាន rule ក្នុង CSS ដែល ship។ ដក class ដែលមិនប្រើ; រក្សា inline style របស់ជួរចន្លោះ។
- ក្នុងម៉ាស៊ីនក្រោយកែ៖ `css-classes` ០ undefined · `history-window-check` ២៨ឆ្លង · typecheck · lint · doc-check · audit build ឆ្លង។ CI ពេញលើ commit ក្រោយកែ និង APK ពិតនៅរង់ចាំ។
- APK run `37623632463`៖ `npm ci` · `android:check` · `android:sync` ឆ្លង; Gradle config root project ធ្លាក់ពេលទាញ dependency ជាច្រើនពី `https://repo.maven.apache.org/maven2/` បាន `403 Forbidden`។ Log គ្មាន response body ដើម្បីបញ្ជាក់មូលហេតុនៃការបដិសេធ។ Commit `daa120f` មិនបានកែ workflow ឬ Gradle repository; ការកែ class មិនបញ្ជាក់ថា APK អាច build បានទេ។ មិនទាន់មាន APK ថ្មីពី run នេះ។

### 2026-10-07 — Sentry APK និង DOM ប្រវត្តិវែង ➜ [2.50.6]

- Sentry org `zoew` · project `javascript-react` · issue `JAVASCRIPT-REACT-9` (`7778537404`) អានតែប៉ុណ្ណោះ។ JS `index-j3viNUV7.js` ត្រូវនឹង APK `2.50.5-test.2adf39f` ពិត។ Xiaomi `24030PN60G` · Android 16 · WebView 153 · display ១២០Hz · filter `all` · ៨៦/៨៦ជួរ។ ការបើក ៧ sample៖ ZTO gap ៥៨ms (២) · ធុងសំរាម ៤២–៦៧ms (៥); sample ធុងសំរាម `6550270d` មាន task ១៣៤ms ក្នុង long frames ២។
- Stack របស់ issue នៅ `reportOverlaySample()` គឺកន្លែងរាយការណ៍។ `topScript: _h` គ្មាន source URL ហើយឈ្មោះ minify ស្ទួននៅ chunk React និង App; មិនអាចសន្និដ្ឋានថា function ណាជាមូលហេតុ។ Probe កត់ rows/chrome នៅចុងរយៈពេល sample ដូច្នេះការចុចជិតគ្នាអាចច្របូកច្របល់ស្ថានភាព។ មិនមាន sample ៥០ជួរមុនរមូរសម្រាប់ធៀបពី Sentry ក្នុងជុំនេះ។
- វាស់ Chromium 153 headless · ៤១៤×៨៩៦ · CPU ថយ ៨ ដង · bridge Capacitor ក្លែង · ១២០០កញ្ចប់ · median ៨ដងក្នុងមួយ modal (កូដចុងក្រោយ · telemetry បិទពេលវាស់)៖ full DOM → ជួរតាមទីតាំងរមូរ (១៦ជួរ)៖ ធុងសំរាម gap **៨៣.៣ → ៣៣.៤ms**, Layout **៥២ → ២១.៥ms**; ZTO gap **៩១.៧ → ២៥.១ms**, Layout **៤១ → ៦ms**។ លទ្ធផល ៨៦កញ្ចប់មានភាពប្រែប្រួល; មិនអះអាងថាលែងអាក់លើទូរស័ព្ទពីការវាស់នេះ។
- CSS `contain`/ស្រទាប់ compositor/body lock/រក្សា modal layout មិនផ្តល់លទ្ធផលថេរ; modal ជាប់ layout ធ្វើឲ្យ PrePaint កាន់តែថ្លៃ។ ដកការសាកទាំងនេះវិញ; កំណែ ship កែចំនួនជួរ DOM លើ native។
- Guard វាស់ការរមូរពិតដោយ IntersectionObserver (មិនកំណត់ cap ផ្ទាល់)៖ មុនកែ DOM APK ៦០០ជួរ ➜ bounded-DOM check ធ្លាក់; ក្រោយកែ រមូរមើលបានគ្រប់ ៦០០ជួរ និង modal មិនប្តូរទីតាំង។ `repository-file-coverage` CI head ចាស់ធ្លាក់ដោយខ្វះ `overlay-telemetry.ts` ➜ បញ្ចូលធាតុនោះ និង guard ថ្មី។

### 2026-10-07 — modal ↔ របា Tab ៖ បើកធុងសំរាម/បញ្ជី ZTO/ម៉ឺនុយ ☰ អាក់ពេលរមូរដល់ចុង (សំណើម្ចាស់គម្រោង ➜ [2.50.5])

Chromium · audit build · ៤១២×៧៨០ · តម្រង «ទាំងអស់» រមូរដល់ចុង · CPU ថយ ៤ ដង · trace ពិត (`UpdateLayoutTree` · `Layout` · `PrePaint` · `Paint`) · median ៧ ដង។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| B1 | បើកធុងសំរាម ៦០០ ជួរ ៖ របាលាក់ ធៀបរបាបង្ហាញ | PrePaint ១១៦ ធៀប ១២–១៨ · Paint ១០០ ធៀប ២០ · ស៊ុម ៣៣១ms | **មូលហេតុ** ៖ `openModalHelper()` ➜ `showAppChrome()` ➜ `chrome-hidden` ប្តូរ clip-path + padding បញ្ជី |
| B2 | ការបង្ហាញរបាតែម្យ៉ាង (គ្មាន modal) | PrePaint ៣២–៨៣ · Paint ៦២–៦៥ (៦០០ ជួរ) | ថ្លៃរបស់ការប្តូរ class ផ្ទាល់ |
| B3 | ៥០ ជួរ (មិនរមូរ) | PrePaint ២៣–៤០ | ថ្លៃកើនតាមជួរ ➜ «មិនរមូរ ➜ រលូន» |
| B4 | ក្រោយកែ ៦០០ ជួរ | ធុងសំរាម ស៊ុម ១៩៨ms (PrePaint ១៦ · Paint ៥៨) · ZTO ៤១ms (មុន ១៩៥) | របាលាក់ = របាបង្ហាញ (២១៥/២៤៣ · ៥១/៥១) |
| B5 | ថ្លៃដែលនៅសល់ | `Layout` ១ ដង ២២២ms · dirty ៧៨៨ / ២៦០៨៦ object | តារាងធុងសំរាម (២០ ជួរ) ខ្លួនឯង · មិនអាស្រ័យប្រវត្តិ · ស្មើករណី «smooth» ➜ មិនកែ |
| B7 | ម៉ឺនុយ ☰ ១២០០ ជួរ (សំណើបន្ថែម «កែម៉ឺនុយ ☰ ដែរ») | PrePaint+Paint របាលាក់ ២៧៣ ធៀបរបាបង្ហាញ ១១ms ➜ ក្រោយកែ ១០ ធៀប ១០ms | មូលហេតុដដែល (`openSideDrawer()` ➜ `showAppChrome()`) |
| B8 | វីដេអូ APK 2.50.5 (ម្ចាស់គម្រោង · ការប្រៀបស៊ុមម្តងៗ) | បើក ZTO ៖ ចលនា ៤ ស៊ុម ➜ កក ៣ ស៊ុម (~៣៣ms) ➜ លោត · បើកធុងសំរាម ៖ កក ~៤៥ms · បិទម៉ឺនុយ ៖ កក ~៦៦ms · ពណ៌រូបតំណាងរបាស្ថានភាពប្តូរនៅ +៣២០ms | ការកកនៅសល់ក្រោយ [2.50.5] ជុំ ១ · មានតែ APK |
| B9 | Chromium + bridge Capacitor ក្លែង (APK) ធៀប web · ៩២ ជួរ · CPU ÷៦ · long-animation-frame | APK ៖ rAF ២៣–៨៦ms (បង្ខំ layout ២៤–៥៥) រាល់ការបើក/បិទស្រទាប់ · web ៖ rAF ០–៣ | **មូលហេតុ** ៖ `measureStatusBarTone()` ក្នុង rAF ➜ ក្រោយកែ (ក្រោយស៊ុម) rAF ≤ ៣ms · បិទធុងសំរាម ស៊ុមកក ៦២ms ➜ គ្មាន |
| B10 | សម្មតិកម្មដែលបដិសេធ (Chromium) | `body.style.overflow` ➜ គូរស្រទាប់ root ៣៧៧k px² ដូចគ្នាមុន/ក្រោយរមូរ · `elementsFromPoint` ពេល layout ស្អាត ០.២–០.៥ms · ខ្សែ scrollbar បិទ ៩០០ms ក្រោយរមូរ · PTR/ប្រវត្តិ Back ជា JS ថោក | មិនពន្យល់ «តែ APK · ក្រោយរមូរ» ➜ មិនកែ |
| B6 | perf-check ៖ ដាក់ `chromeHidden` ដោយផ្ទាល់ពេលនៅចុងបាតបញ្ជី | padding ៦២ ➜ ០ ➜ `scrollTop` រួញ ➜ scroll event (−៦២ < −`SHOW_AFTER`) ➜ របាលេចវិញ | artifact របស់ការវាស់ (ផ្លូវពិត ៖ `BOTTOM_ZONE` ➜ ការរួញ ≤ ៣៨px) ➜ checker រមូរឡើង ៣០០px មុន + លក្ខខណ្ឌចាំបាច់ «របាលាក់ពិតមុនបើក» |

**APK សាកពី branch** (សំណើម្ចាស់គម្រោង ៖ «apk build test លើ PR … មិនទាន់ចង់ merge») ៖ workflow `Android APK` ពីមុន build តែ `main`
(`repository-contract-test` ចាក់សោ «APK នៅ main តែប៉ុណ្ណោះ») ➜ ឥឡូវ «Run workflow» លើ branch ផ្សេង ➜ **Pre-release**
`zoew-android-v<កំណែ>-test.<commit ៧ តួ>` (keystore · `apksigner verify` · pin ដដែល) · push នៅតែ `main` · Release ផ្លូវការមិនប្រែ។ អ្នកយាម ៖
`repository-contract-test` រត់ script ពិតនៃ step «កំណែ» និង «បង្កើត GitHub Release» ក្នុង bash (`gh` · `cygpath` ក្លែង) ៖ branch ➜ `--prerelease`
+ ស្លាក test · `main` ➜ Release ដូចដើម · ឈ្មោះ branch ដូច `$(…)` មិនរត់ (env) · workflow ចាស់ ➜ **ក្រហម ៥**។

អ្នកយាម ៖ `ZoeW/tests/modal-chrome-state.test.tsx` (មុនកែ ក្រហម · mutation ៣ ប្រភេទចាប់) · `gesture-test` (modal មុនកែ ក្រហម ៤ · ម៉ឺនុយមុនកែ ក្រហម ៣) · `perf-check` (ធុងសំរាមមុនកែ ២៥៨/៣៨ms · ម៉ឺនុយមុនកែ ២៧៣/១១ms ➜ ក្រហម)។

### 2026-10-07 — ZTO ៖ ទាញ/បញ្ចូលបញ្ជីយឺត (របាយការណ៍ម្ចាស់គម្រោង «ការទាញកញ្ចប់ពី ZTO យឺត ពេលចុច បញ្ចូលក៏យឺត · ស្កេន auto lookup លឿន 0.6–1.0 វិ.» ➜ [2.50.4])

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| Z1 | `?diag=1` របស់ម្ចាស់គម្រោង | Cookie blob · បញ្ជីបើក (`pageSize` 100 · `maxPages` 3) · `timing` 7000/9000 · cache 60000/15000 · គ្មានការបដិសេធ | ការកំណត់ត្រឹម ➜ «យឺត» មិនមែន config · diag គ្មាន **ពេល ZTO ឆ្លើយ** ➜ ទាញយឺតវាស់មិនបាន ➜ Function កត់ `upstreamTiming` ក្នុង `requestOnce()` (ចំណុចតែមួយ ៖ `detail` · `list` · `signed`) |
| Z2 | រចនាសម្ព័ន្ធការទាញ | ទំព័រ ១ `withSigned` (Function ហៅ ZTO ២ ស្របគ្នា) ➜ ទំព័រ ២..៣ ស្របគ្នា ➜ `/detail` តែជួរ ≥ ៧ ថ្ងៃ (≤ `ZTO_LIST_SIGNED_PROBE_MAX` · `ZTO_LIST_PROBE_CONCURRENCY` ក្នុងពេលតែមួយ) | ផ្លូវសំខាន់ = ២ ដំណើរ Function (+ ១ បើមាន probe) ➜ យឺត = ZTO ឆ្លើយទំព័រ ១០០ ជួរយឺត ➜ វាស់ដោយ Z1 · auto lookup លឿន ព្រោះ `/detail` = ១ កញ្ចប់ |
| Z3 | រចនាសម្ព័ន្ធការបញ្ចូល (harness ៖ Firebase ក្លែង · latency ១០ ms/op · ជួរដេកមួយ = ៦ op) | ២៤ ជួរ ៖ ផ្លូវសំខាន់ ៩៨ ➜ wall ៩៧៩ ms · ១០០ ជួរ ៖ ៤០៩ ➜ ៤០៨៧ ms (តាមលំដាប់ ~៤.១ ដំណើរ/ជួរ) | ១០០ ជួរ × ~៤ ដំណើរ × ២៥០–៣០០ ms (Firebase ពិត) ≈ ២ នាទី ➜ **ខ្សែ ៤** តាម «អតិថិជន + ថ្ងៃ» (`addOrUpdateEntry()` បញ្ចូលគ្នាតាម `phone` + `scanDate` លើទិដ្ឋភាព local ➜ អតិថិជនដដែលមិនអាចរត់ស្របគ្នា) ➜ ២៤ ជួរ ៖ ៣៣ ដំណើរ · ៣២៩ ms (៣.០ ដង) · ១០០ ជួរ ៖ ១០៩ · ១០៨៥ ms (៣.៨ ដង) · op ដដែល (១៤៥ · ៥៩៩) · កញ្ចប់ដដែល (១៧ · ៦៨) |
| Z4 | អតិថិជនរាប់រយ (សំណើម្ចាស់គម្រោង «បើថ្ងៃក្រោយមានអតិថិជនរាប់រយនាក់ តេស្តផង») | `zto-import-lanes.test.ts` ៥–៧ ៖ ១០០ ជួរ/១០០ អតិថិជន · ៣០០ ជួរ ➜ ពិដាន `ZTO_LIST_IMPORT_MAX` ១០០ ក្នុងមួយចុច (បញ្ជីសម្អាត ➜ ទាញម្តងទៀត) · អតិថិជនមួយ ២០ កញ្ចប់ + ២០ អតិថិជន × ៤ លាយគ្នា · ហាង ៥០០ កញ្ចប់ក្នុងប្រវត្តិរួច | ledger ត្រឹមគ្រប់ករណី (`codDollar` = Σ COD · `totalCount` = ជួរ) · កញ្ចប់តែមួយក្នុងអតិថិជន+ថ្ងៃ · barcode តាមលំដាប់ · registry គ្រប់ · wall < ជួរ × latency × 1.5 ➜ ១០០ ជួរ ≈ ២០–៣០ វិ. លើ Firebase ពិត · ៣០០ ជួរ = ៣ ចុច (ស្នើ ៖ លើកពិដាន បើម្ចាស់គម្រោងចង់) · ការរាប់ខុសដំបូង (១៨៣០/៥០៥០ · ៦០/១០០) = ទិន្នន័យតេស្ត (ម៉ោង `09:60` ➜ ថ្ងៃបន្ទាប់) មិនមែនកូដ |
| Z5 | ថ្នេរ ledger ស្របគ្នា | ៤ transaction លើ `zoew_daily_revenue_cod_dod/<ថ្ងៃ>` ក្នុងពេលតែមួយ (អតិថិជនផ្សេងគ្នា · ថ្ងៃដដែល) | RTDB ៖ transaction ផ្លូវដដែលចាក់ជួរក្នុង SDK · CAS លើ server ➜ ត្រឹម · Supabase ៖ CAS `op_id` ➜ conflict = retry ធម្មតា (ដំណើរបន្ថែម · មិនខុសលុយ) · ការផ្ទៀងផ្ទាត់ `correctRevenueLedgerToActual()` ធ្វើការលើ delta (មិនមែន «ledger = Σ local») ➜ ខ្សែផ្សេងមិនជាន់គ្នា |
| Z6 | ហាងរាប់រយ (អត្ថន័យទី ២ នៃសំណើ) | Firebase ៖ ១ project/ហាង · Supabase ៖ RLS + `zoe_write` ចាក់សោតាម tenant · Function `zto-order-detail` ចែករួម (quota Netlify · Cookie តែមួយ · cache/single-flight តាម container) | ហាងមិនរារាំងគ្នា · ដែនកំណត់ពិត = quota Function (ការអានបញ្ជីចុះហត្ថលេខាតាម cadence × ហាង) ➜ វាស់ពេលមានហាង > ១០ (មិនទាន់វាស់) |

### 2026-10-07 — Deep audit ជុំ ៧ ៖ ឯកសារ (សំណើម្ចាស់គម្រោង «ធ្វើការងារនៅសល់ទាំងអស់»)

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| D1 | ឈ្មោះក្នុង `.md` ធៀបកូដ | token ក្នុង backtick ទាំងអស់ (២៣ ឯកសារ · លើកលែង HISTORY) ➜ រកក្នុងឯកសារដែល git តាមដាន (ក្រៅ `.md`) | បាត់ ៥៣ ៖ ទាំងអស់ជាឈ្មោះខាងក្រៅ (Cookie ZTO · env Netlify ដែលលុបដោយចេតនា · វាល payload ZTO · flag tsconfig ដែល `strict` បើក · ថតដែល build បង្កើត · ឧទាហរណ៍) ➜ វាស់ ៖ គ្មានឈ្មោះកូដចាស់ |
| D2 | លេខថេរក្នុង `CLAUDE.md` ធៀបកូដ | `` `CONST` (N ms/s) `` ២២ ➜ `const CONST = …` ក្នុង src | ១៧ ស្មើ · ៥ ជា env Function/សរសេរកាត់ (`ZTO_UPSTREAM_TIMEOUT_MS` 6000 · `ZTO_REQUEST_BUDGET_MS` 9000 · `MIN_GAP` = `FIREBASE_SDK_RELOAD_MIN_GAP_MS` 20000 ✓) ➜ ខុស ០ |
| D3 | តំណ relative ក្នុង `.md` | តំណ markdown ទាំងអស់ (អត្ថបទ + ផ្លូវក្នុងវង់ក្រចក) ➜ ឯកសារមាន? | ខូច ០ |
| D4 | បន្ទាត់ស្ទួនឆ្លងឯកសារ | បន្ទាត់ ≥ ៦០ តួដូចគ្នា | ១៨ ៖ ក្បាល/ជើង README តាមច្បាប់ ៩ · ឧទាហរណ៍ JSON/ពាក្យបញ្ជាដោយចេតនា ➜ វាស់ ៖ គ្មានការចម្លងច្បាប់ |
| D5 | `CLAUDE.md` ៖ ជួរ «ZTO not-closed bar» វែង (ក្រឡាតែមួយ ~៤០ បន្ទាត់) | ម្ចាស់គម្រោងស្នើបំបែក | **កែ** ៖ ជួរតារាងខ្លី + ផ្នែក «ZTO status · auto-close · sign-list sweep» (ឃ្លាដើមទាំងអស់ · token ក្នុង backtick ដូចគ្នា ១០០% · script ផ្ទៀង) + ជួរផែនទី |
| D6 | «All 7 ZoeW `setInterval` timers» | `scope.every(` ក្នុង `boot.ts` | ៧ ✓ |
| D7 | ឧបករណ៍ parity ធៀប ZoeW vanilla (`zoew-parity` · `INTENTIONAL_UI` · `PARITY.md` · `MIGRATION.md`) | ម្ចាស់គម្រោង ៖ «ចង់បំភ្លេចកំណែ vanilla» | **ស្នើ** ៖ ដកក្នុងជុំដាច់ដោយឡែកក្រោយការអនុញ្ញាត (checker ជាច្រើនពឹង `audit-compat.ts`/ទិដ្ឋភាព `app.js` — ត្រូវវាស់មុនដក) |

### 2026-10-07 — Deep audit ជុំ ៥ ៖ Toast (សំណើម្ចាស់គម្រោង «ធ្វើការងារនៅសល់ទាំងអស់» ➜ [2.50.4])

Inventory ៖ `showToast` ✅ ៣១ · ⏳ ២២ · 🔄 ១ call-site ក្នុង `ZoeW/src` (grep) · អ្នកយាមដែលមាន ៖ `toast-truth-test` (៩០) · `toast-action-truth-test` (៦៧) · vitest ៥ ឯកសារ។
អានផ្លូវនីមួយៗពិត ៖

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| T1 | «មិនបាត់ស្ងាត់» ៖ ពិដាន ៤ | `showToast('⚠️ …')` + ✅ ×4 ក្នុង ៣ វិ. (`ToastList` ពិត) | ⚠️ បោះចេញមុនអាយុ (មុនកែ FAIL) ➜ **កែ** លំដាប់បោះ ✅ ➜ ℹ️ ➜ ⚠️ ➜ ❌ · ZoeKeyGen ៖ វាស់ ៖ គ្មានប្រភព toast ជាបន្តបន្ទាប់ ➜ មិនប្រែ |
| T2 | «មិនបាត់ស្ងាត់» ៖ App ជាប់សោ | `showAppLockScreen(true)` ➜ `showToast` ➜ ៣.៣ វិ. · toast រស់ ➜ ៣០ វិ. | toast បាត់ដោយគ្មាននរណាឃើញ (`body.app-locked` លាក់ container) · toast រស់ក្លាយជា «⚠️ យូរជាងធម្មតា» ស្ងាត់ ➜ **កែ** រង់ចាំដោះសោ |
| T3 | «⏳ ➜ ✅/❌ តាមការពិត» ៖ mirror ចំណូលប្រចាំថ្ងៃ | `fb.update` ព្យួរ ➜ ១៥ វិ. ➜ ចុះ | «⚠️ មិនទាន់ Sync» រួច Sync ស្ងាត់ (សារចាស់) ➜ **កែ** ⏳ ➜ ✅/⚠️ · ការបិទ/កែតម្លៃមិនអះអាង ✅ មុន mirror ចុះ (`daily-collected-test` ផ្នែក ៣៣ hang ចាប់ ✅ ក្លែង ➜ កែកូដ) |
| T4 | «និយាយការពិត» ៖ សារក្រោយការប្តូរវគ្គ | `authGeneration++` មុន ledger ឆ្លើយ (កែដោយដៃ · ដក barcode ពិត) | «⚠️ … សូមប្រាប់ Admin» + Sentry លុយ ដល់វគ្គថ្មី (មុនកែ FAIL ២ ឯកសារ) ➜ **កែ** `stale` |
| T5 | ✅ មុន commit · ⏳ គ្មានចុងបញ្ចប់ | អាន ✅ ៣១ · ⏳ ២២ ៖ ✅ នីមួយៗក្រោយ `await` លទ្ធផល server/storage ឬ `armLateCommit` · ⏳ នីមួយៗមាន ✅/⚠️ យឺត លើកលែង ⏳ «កំពុងដំណើរការរួចហើយ» ៣ (ZTO · សារជាប់រវល់ មិនមែនការរង់ចាំ) | វាស់ ៖ គ្មាន |
| T6 | toast រស់ (`network` · `signin` · `config`) | អ្នកយាមដែលមាន (`network-toast` · `toast-live-expiry` · `recovery-toast-dedup` · `toast-truth` ៩០) | វាស់ ៖ គ្មាន |
| T7 | «⚠️ … ស្ថិតិប្រាក់មិនទាន់ Sync» ក្រោយ clamp (s6b) | អាន `correctRevenueLedgerToActual()` ៖ `dailyTotal ≠ desired` ក្រោយ rules clamp ➜ `ok: false` | ប្រុងប្រយ័ត្នតាមការរចនា (ledger ពិតមិនស្មើការស្នើ ➜ Sentry លុយត្រឹមត្រូវ) ➜ **មិនប្រែ** |

- ⛔ មេរៀន ៖ helper module-level ថ្មី (ឧ. helper ចំណាំអ្នកកាន់ Locker ដែលដកវិញក្រោយមក) ➜ sandbox ដែលស្រង់ `assignLockerToEntry` ធ្លាក់ `ReferenceError` ➜ បន្ថែមក្នុងបញ្ជី (`locker-claim-guard-test`) ·
  checker ដែលចាក់សោសារចាស់ (⚠️ ពេលព្យួរ) ត្រូវកែតាមការពិតថ្មី មិនមែនកូដតាម checker · `git checkout <file>` ក្នុង mutation ដកការកែដែលមិនទាន់ commit (ប្រើ `cp` ពីច្បាប់ចម្លង)។

### 2026-10-06 — Deep audit ជុំ ៦ ៖ ដំណើរការ និង Layout (សំណើម្ចាស់គម្រោង «ធ្វើ ៤ និង ៦»)

វាស់ដោយ Chromium + ពុម្ពអក្សរ Kantumruy Pro ពិត (route fulfill ពី scratch) លើ audit build របស់ HEAD ៖

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| L2 | desktop 992–1060px ៖ ប៊ូតុងសកម្មភាពជួរប្រវត្តិហៀរ | ទទឹង 992 · 1000 · 1024 · 1040 · 1060 · 1100 · 1280 × ជួរ ៣ (COD $987.65 + DOD $245.50 · ខល/បិទ/កែលេខ) ៖ គែមប៊ូតុង ធៀបគែមក្រឡា | ✅ ហៀរ **០px** គ្រប់ទទឹង · ប៊ូតុងបន្ទាត់ ១ ➜ ដោះស្រាយរួចដោយ [2.50.2] (`layout-check` ចាក់សោ «ប៊ូតុងនៅក្នុងក្រឡាខ្លួនគ្រប់ទទឹង») |
| L1 | ប្រអប់ «📥 បញ្ជី ZTO» ជាមួយបន្ទាត់ថ្ងៃថ្មី ([2.50.3]) | 320 · 360 · 412 · 768 · 1280 ៖ `scrollWidth` · ធាតុក្នុងជួរលើសគែមប្រអប់ | ✅ ហៀរ ០ · រមូរផ្តេក ០ · ⚠️ សារ «…មុនថ្ងៃ 2026-10-04 1 ➜» អានពិបាក (លេខជាប់ថ្ងៃ) ➜ **កែ** «… ៖ 1 កញ្ចប់ ➜» (តេស្ត ៖ `zto-signed-only-import`) |
| L3 | មុខងារគ្មានតេស្ត | រាយ function export ក្នុង `src/` ដែលគ្មានឈ្មោះក្នុង `tests/` · `audit-tools/` (៣០៣ · ភាគច្រើនជា helper ដែលតេស្តតាមអ្នកហៅ) ➜ សាក `findLockerOccupant` (ការព្រមាន «ទីតាំងមានកញ្ចប់អ្នកផ្សេង» ក្នុងប្រអប់ផ្លាស់ទីតាំង) | ✅ ដំណើរការត្រឹមត្រូវ ៖ barcode បិទមិនកាន់ទីតាំង · រំលង barcode ខ្លួនឯង និងកញ្ចប់ដដែល · កញ្ចប់ចាស់ (`item.barcode`) · ធាតុខូច ➜ `ZoeW/tests/locker-occupant.test.ts` (ថ្មី) · mutation ២/២ ចាប់ (ដកការរំលង barcode បិទ ➜ FAIL ២ · ដកការរំលងកញ្ចប់ដដែល ➜ FAIL ១ ក្រោយបន្ថែមករណី barcode ផ្សេងរបស់កញ្ចប់ដដែល) |

- ⛔ PTR · ចលនាផ្ទាំង · ការរមូរ ៖ មិនប៉ះ (តំបន់ហាម)។ ⚠️ ទទួលយក ៖ ការផ្លាស់ Locker ទៅទីតាំងដែលមានកញ្ចប់អតិថិជនផ្សេង **ដោយកញ្ចប់គ្មានទីតាំងពីមុន** មិនព្រមាន (ព្រមានតែពេលផ្លាស់ពីទីតាំងចាស់) —
  ឥរិយាបថដូច ZoeW ដើម ➜ **ស្នើ** (សួរម្ចាស់គម្រោងមុនកែ)។

### 2026-10-06 — Deep audit ជុំ ៤ ៖ សុវត្ថិភាព (សំណើម្ចាស់គម្រោង «ធ្វើ ៤ និង ៦»)

CI ក្នុង session មុនចាប់ផ្តើម (STRICT · emulator · Node 24 · HEAD `a2dff43`) ៖ **ជោគជ័យ ២០២ · ធ្លាក់ ១ · មួយផ្នែក ០ · រំលង ០** ➜ FAIL តែមួយ =
`repository-file-coverage` ៖ តេស្ត `zto-signed-only-import.test.tsx` ថ្មីរបស់ [2.50.3] គ្មាន mapping (កំហុសរបស់ Claude ក្នុង round 2.50.3 · CI GitHub ផ្នែក 3/4 ក្រហមដូចគ្នា) ➜ ដាក់ mapping។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| S4-a | NOTICE ↔ bundle ពិត | build ជាមួយ sourcemap (`vite build --sourcemap` ចូល scratch) ➜ រាយកញ្ចប់ npm ពី `sources` ➜ ធៀប NOTICE | ⚠️ **ខ្វះ ២** ៖ `iceberg-js@0.8.1` (MIT · chunk `supabase-backend` · storage-js ប្រើ) · `@capacitor/synapse@1.0.4` (LICENSE.md ៖ MIT «Copyright (c) 2025 Ionic» · chunk `native-plugins`) ➜ MIT តម្រូវឲ្យភ្ជាប់សេចក្តីជូនដំណឹង ➜ **កែ** · `tslib@2.8.1` (0BSD ៖ គ្មានលក្ខខណ្ឌ) ក៏រាយដែរ |
| S4-b | កំណែក្នុង NOTICE | អានកំណែពីឯកសារ vendor ពិត (`make_xlsx_lib` ៖ `0.20.3` · zxing-wasm ៖ ថេរកំណែជាប់ commit hash) | ⚠️ NOTICE «zxing-wasm 3.1.3» ≠ ឯកសារ ship **3.1.4** (ឡើងកំណែក្នុង 2.42.4 តែ NOTICE មិនកែ) ➜ **កែ** |
| S1 | Secret ក្នុង repo | `git ls-files` + regex (Google API key · JWT · private key · `sb_secret_` · GitHub/Slack/Stripe/Netlify token) · host Project ពិត | វាស់ ៖ គ្មាន — រកឃើញតែ RSA key សាកល្បងក្នុង `audit-tools/idtoken-fixture.js` (fixture ចុះហត្ថលេខា ID token ក្លែង) · host ទាំងអស់ជា fixture ក្លែង |
| S5 | XSS ក្នុង ZoeW React | រក sink (`dangerouslySetInnerHTML` · `innerHTML` · `insertAdjacentHTML` · `document.write` · `javascript:`) ក្នុង `src/` | វាស់ ៖ គ្មាន sink · `href` មានតែ `tel:${phone}` (scheme ថេរ) និង Telegram ថេរ · វាលថ្មី `signedRows`/`from` ឆ្លងតែអត្ថបទ JSX |
| S2 | សញ្ញាហាង `zto_signed_sweep` | អាន rules ពិត (`activeAt`/`completeAt` លេខ · ≤ `now + 600000` · `$other` បដិសេធ) + អ្នកយាមដែលមាន (`zto-shop-sweep-marker` · `emu/app-writes-rules`) | វាស់ ៖ ផលអតិបរមារបស់បុគ្គលិកក្នុងហាងដែលសរសេរខុស = ការរង់ចាំ ≤ ៣០ នាទី/វគ្គ · ការលុបសញ្ញា = ដូចគ្មានឧបករណ៍ ZTO (ឧបករណ៍ ZTO សរសេរឡើងវិញ) ➜ ទទួលយក (អ្នកសរសេរបានតែ `auth != null` ក្នុង Project ហាង) |
| S3 | Firebase sign-up បិទ | រកផ្លូវវាស់ពីឧបករណ៍ដោយមិនបង្កើតគណនី | មិនបានវាស់ ៖ session គ្មាន Project សាកល្បង · `accounts:signUp` លើ Project ពិតអាចបង្កើតគណនី ➜ **ស្នើ** ៖ សាកលើ Project សាកល្បងមួយ (លំដាប់កំហុស `ADMIN_ONLY_OPERATION` ធៀប `INVALID_EMAIL`) មុនដាក់ក្នុង 🩺 · `tools/firebase-provision` វាស់ពេលបង្កើត Project រួចហើយ |

- 🛡️ **អ្នកយាមថ្មី `npm run notice:check`** (`ZoeW/scripts/notice-check.mjs` · ក្នុង `zoew-suite` និង `verify`) ៖ build ចូលថតបណ្តោះអាសន្នជាមួយ sourcemap ➜ រាល់កញ្ចប់ npm
  ដែលចូល `dist/assets` និងឯកសារ vendor ត្រូវមាន `` `ឈ្មោះ@កំណែ` `` ដែលដំឡើង/ship ពិតក្នុង NOTICE (ជាន់អប្បបរមា ៖ sourcemap ≥ ១ · កញ្ចប់ ≥ ១០ · កំណែ vendor រកឃើញ) ·
  `NOTICE_FILE` ៖ NOTICE មុនកែ ➜ **FAIL** (២៥ ខ្វះ) · NOTICE ដែលមានគ្រប់តែ ២ ខាងលើ + zxing 3.1.3 ➜ **FAIL** ចំ ៣ ចំណុចនោះ · NOTICE ថ្មី ➜ PASS (២៣)។
  hash integrity របស់ NOTICE ក្នុង `repository-file-coverage.json` ធ្វើបច្ចុប្បន្នភាព (កែដោយចេតនា)។

### 2026-10-06 — ជុំ ZTO ស្អាត ៖ ការផ្ទៀងផ្ទាត់ឡើងវិញ (សំណើម្ចាស់គម្រោង «ផ្ទៀងផ្ទាត់ ZTO ឡើងវិញសិន» ➜ [2.50.1])

- ប្រភព ៖ ការពិនិត្យប្រឆាំងរបស់ workflow (E4 · E5 · E6 ម្នាក់ៗ ១ អ្នកពិនិត្យ · E7 ៥ ការរកឃើញ ផ្ទៀងដោយអ្នកផ្ទៀងឯករាជ្យ ៥ · គ្មានមួយត្រូវបដិសេធ) + workflow ផ្ទៀង ៦ ផ្លូវលើ `8d78c2c`។
- **k1** (E4) ៖ `signedMismatchSignal.count += …` ➜ ជុំ ២០ វិ. អានជួរដដែល ➜ 🩺 «ZTO ផ្ញើ ១០ ជួរ» សម្រាប់ ២ ជួរ (វាស់ ៖ ៥ ការអាន) ➜ Set barcode ផ្សេងៗ (ពិដាន ១០០០)។
- **k2** (E5) ៖ «មកដល់» សាកឡើងវិញ 429 ➜ ឆ្លើយក្រោយ ១៥០៩ ms (វាស់ ៖ រង់ចាំ «ចុះហត្ថលេខា» ថ្មី) ➜ ឆ្លើយភ្លាម (១៤ ms)។ ⚠️ ទទួលយក ៖ សំណើ «ចុះហត្ថលេខា» ថ្មីនៅតែចេញ
  ស្របគ្នា (ការរក្សាល្បឿនផ្លូវជោគជ័យ) ➜ ពេល Cookie ថ្មីក៏ត្រូវបដិសេធ ZTO ទទួល ០៥ ១ សំណើថែម · **k3** ៖ សំណើ «ចុះហត្ថលេខា» ចាស់ដែលនៅរង់ចាំ (យឺត/ព្យួរ) មិនរត់ម្តងទៀត
  — ការសាកការរត់ពេលនៅរង់ចាំ ធ្វើឲ្យ 503 ក្លាយជាការបង្ខំ ZTO (តេស្ត «មិនមែន Cookie ➜ មិនរត់ម្តងទៀត» ធ្លាក់) ➜ ទទួលយក (ជុំបន្ទាប់ ២០ វិ. អានធម្មតា · មិនមែនការថយក្រោយ)។
- 💰 **M1 · M3 · R1** (មានតាំងពីមុន ឬ E1 មិនទាន់គ្រប់ · ផ្ទៀងឯករាជ្យ) ៖ (M1) `closeZtoSignedBarcodes()` ៖ `done === false` (not-applied · permission · `unknown` · `committed:false`)
  នៅតែ `setZtoPickupVerdict(true)` + `finished` ➜ `ztoSignedCompleteAt` ➜ ការសម្អាតបន្ទាប់ដកលុយ ហើយ verdict `true` ទប់ការសាកបិទ ១ ម៉ោង (probe ឯករាជ្យ ៖ ១៥ នាទី ៖ អាន ១៦ ·
  បិទ ០ · abandon ១៦) ➜ បរាជ័យ + នៅបើក ➜ `ztoSignedCloseFailedAt` · `finished = false` · សាកវិញក្រោយ `ZTO_SIGNED_CLOSE_RETRY_MS` (២ នាទី · `/detail` រំលងក្នុងជុំដដែល)។
  (M3) ច្រកទ្វារទុកចិត្តការអានពេញលេញណាមួយ ≤ ១០ នាទី ទោះធ្វើ **មុន** កញ្ចប់ទុំ ➜ ភ្ញាក់ពី background ៨ នាទី (ចុះហត្ថលេខានាទីទី ៣) ➜ `ABANDON` មុន `CLOSE` · វដ្ត ១ នាទីក៏ដូចគ្នា
  ➜ `ztoAbandonCleanupIsHeld(ripeAt)` · `ztoSignedCompleteServerAt` (`getServerNow()` មុនការអាន) ≥ `itemAbandonRipeAt()` (barcode ទុំចុងក្រោយ · `barcodeAbandonBasis()` មួយដែល
  `barcodeAbandonIsRipe()` ប្រើ ➜ រូបមន្តតែមួយ) · ការអានពេញលេញចាប់ផ្តើមការរង់ចាំថ្មី (`ztoAbandonHoldSince = 0`) ➜ ការរង់ចាំវែង (ZTO ធ្លាក់ ២៩ នាទី) ទើបចប់ មិនដោះលែងកញ្ចប់
  ដែលទុំបន្ទាប់។ (R1) `notConfigured` ទាំងអស់ ➜ `ZTO_SIGNED_SWEEP_IDLE_MS` (៣០ នាទី = `ZTO_ABANDON_HOLD_MAX_MS`) ➜ `idtoken:expired` · `idtoken:supabase-unreachable` ·
  `idtoken:missing` ៖ abandon ១៨០៥ វិ. មុនការអានទី ២ ១៨០៧ វិ. (កំណត់ · មិនមែន ៩៧%) ➜ IDLE តែ `ztoListReasonIsDefinitive()` · ផ្សេង ➜ `ztoSignedSweepBackoffMs()`។
  អ្នកយាម ៖ `zto-abandon-signed-gate.test.tsx` +៧ (M1 ×២ · M3 ×៣ · ទិសផ្ទុយ M3 · R1 + អចលនៈ `ZTO_SIGNED_SWEEP_FAIL_MAX_MS` < `ZTO_ABANDON_HOLD_MAX_MS`) ៖ tree មុនកែ (`fb8c3c0`)
  **ធ្លាក់ ៤** (M1 ×២ · M3 · R1 · R1 ធ្លាក់តែពេលវដ្តរំកិល 0.5 វិ. ពីព្រំដែនពិដាន ដូចការវាស់ ៖ ស្មើគ្នាបេះបិទ ➜ «≤» រក្សាការរង់ចាំ) · តេស្ត ២ ទៀតបន្ថែមក្រោយ mutation ·
  mutation ១០/១០ ត្រូវសម្លាប់ (បរាជ័យរាប់ពេញលេញ · ការទប់សាកវិញរាប់ពេញលេញ · គ្មានការទប់សាកវិញ · `covers` ជានិច្ច · គ្មាន reset · R1 IDLE · cleanup គ្មាន `ripeAt` ·
  `ripeAt` ដំបូងបំផុត · មិនអើពើ `restoredAt` · មិនកត់ `readServerAt`) · ១ ស្មើ (លុប `ztoSignedCloseFailedAt` ពេលជោគជ័យ) ➜ ដកចេញ។ sandbox ៩ checker ៖ បន្ថែម
  `barcodeAbandonBasis` · `itemAbandonRipeAt`។
- 💰 **M2** (មានតាំងពីមុន · ផ្ទៀងឯករាជ្យ ៖ ឧបករណ៍ ៥ ការកំណត់ លើទិន្នន័យរួមដដែល ➜ A (ZTO) មិនដក · B/C/D/E ដកភ្លាម) ៖ `ztoAbandonCleanupIsHeld()` សម្រេចតាម
  localStorage (`zoew_lookup_api_config` · `zoew_zto_autoclose_v1`) ខណៈ `claimAndCleanupItem('abandon')` ដកពី ledger រួមរបស់ហាង ➜ សញ្ញាហាង
  `zoew_settings/zto_signed_sweep` `{ activeAt, completeAt }` (ម៉ោង Server) ក្នុង `src/services/zto-shop-sweep.ts` ថ្មី (ម៉ូឌុលស្ថានភាព ZTO មិនប៉ះ Firebase ·
  `zto-sync-banner-test` ឃើញ `dbRef` ពេលដាក់ក្នុង `zto-status.ts` ➜ ផ្លាស់ · ឯកសារថ្មីចូល `LOCK`) ៖ `markZtoShopSweep()` ក្រោយការអានដែលវាស់បាន (≤ ១ ដងក្នុង `ZTO_SHOP_SWEEP_MARK_GAP_MS`
  ៥ នាទី · `completeAt` = `readServerAt` នៃការអានពេញលេញ) · listener ដាច់ពីទិន្នន័យ (មិនចូល `DB_LISTENER_KEYS` ➜ rules មិនទាន់ Publish មិនធ្វើឲ្យ «⚠️ ដាច់» ·
  generation gate · `resetZtoShopSweep()` ពេល detach) · ឧបករណ៍គ្មាន ZTO រង់ចាំពេល `activeAt` ក្នុង `ZTO_SHOP_SWEEP_ACTIVE_MS` (១ ម៉ោង ក្រោយការពិនិត្យប្រឆាំង) ហើយ `completeAt` < ពេលទុំ ·
  listener រង់ចាំ/បរាជ័យ ➜ រង់ចាំ · `permission_denied` · គ្មានសញ្ញា · សញ្ញាចាស់ ➜ មិនរង់ចាំ · ពិដានវគ្គដដែល (`ZTO_ABANDON_HOLD_MAX_MS`) · `completeAt` ឡើង ➜ វគ្គថ្មី។
  ជម្រើសដែលមិនយក ៖ ការរង់ចាំគ្មានពិដានវគ្គ (ការពារពេល A បិទច្រើនថ្ងៃ តែប្តូរពេលផុតកំណត់ដែលអ្នកប្រើឃើញ ≤ ១ ថ្ងៃ = ច្បាប់អាជីវកម្ម)។ rules ៖ `.validate`
  ទាមទារ `activeAt` · លេខ ≥ 0 · `$other` false · migration Supabase តែមួយក្នុងជុំនេះ (`20261006192639_zoe_rules.sql` ជំនួស `…154711` ដែលមិនទាន់ merge)។
  អ្នកយាម ៖ `tests/zto-shop-sweep-marker.test.tsx` (១២ · tree មុនកែ **ធ្លាក់ ៧** · ទិសផ្ទុយ ៣ បៃតង) · `revenue-fuzz` op `shopSweep` · `emu/app-writes-rules` (ការសរសេរ ≥ ១ ·
  probe rules គ្មាន node ➜ បដិសេធ) · mutation ១៧/១៧ ត្រូវសម្លាប់ (listener មិន ok · pending មិនរង់ចាំ · មិនអើពើ ៧ ថ្ងៃ · មិនអើពើ `completeAt` · denied រង់ចាំ · គ្មាន throttle ·
  `completeAt` ពេលសរសេរ · `completeAt` ពេលមិនពេញលេញ · គ្មាន gate · គ្មាន reset · គ្មានវគ្គថ្មី (តេស្តកែពីរបីដង ៖ ការប្តូរឧបករណ៍ក្នុង realm តែមួយ reset វគ្គ ➜ ក្លែងស្ថានភាព B ពិត) ·
  គ្មានការសរសេរ · គ្មានពិដាន · មិនអើពើកំហុស listener · សរសេរមុនការអាន · វគ្គថ្មីមិនកត់ `advancedAt` · មិន `fb.off` ពេល detach ➜ តេស្តបន្ថែម) ·
  sandbox `connection-recovery-test` · `registry-release-test` ៖ stub `resetZtoShopSweep` · `attachZtoShopSweepListener`។
- 📶 **Q1–Q4 · T3–T6 · G0–G6** (ការផ្ទៀងផ្ទាត់ឡើងវិញ ៖ quota · សារខុស · អ្នកយាមខ្វះ) ៖ (Q1) `signedMismatch` ➜ មិន «ពេញលេញ» ➜ `ztoSignedSweepOkAt` មិនកត់ ➜ ជួរ
  ៨ ថ្ងៃរៀងរាល់ ២០ វិ. ➜ `rangeComplete` (ពេញលេញលើកលែងជួរផ្ទុយ) បង្រួមជួរ · `complete` (គ្មានជួរផ្ទុយ) តែប៉ុណ្ណោះដោះលែងការរង់ចាំលុយ។ (Q2) បញ្ជីវែង ➜ ទំព័រ ១–៣ ទាំងមូល
  រួចតាមថ្ងៃ រាល់ការអាន ➜ `ztoSignedSplitAt` ៖ ក្នុង `ZTO_SIGNED_SPLIT_MEMO_MS` (៣០ នាទី) ទៅតាមថ្ងៃភ្លាម · ផុត ➜ សាកទាំងមូលវិញ · ផ្លូវចងចាំឃើញ Server បិទបញ្ជី
  (`measured: false` គ្រប់ថ្ងៃ) ➜ `measured: false`។ (Q3) worker តាមថ្ងៃពិនិត្យ `captureZtoSession()` មុនថ្ងៃនីមួយៗ (មុនកែ ៖ ចាកចេញ/ប្តូរគណនី ➜ ថ្ងៃដែលនៅសល់
  ផ្ញើដោយ token គណនីថ្មី)។ (Q4) verdict ដែលត្រូវបណ្តេញ (`ZTO_STATUS_MAX`) ត្រូវសួរម្តងទៀតរាល់ជុំ ➜ `ztoPickupVerdictSeenAt` (ក្នុង memory · កាត់តាមបេក្ខជនបច្ចុប្បន្ន ·
  កញ្ចប់បើករក្សាការពិនិត្យរៀងរាល់ម៉ោង)។ (T3) `noteZtoUserActivity()` ទុកចោល ➜ ប្រើ ៖ ផ្លាស់ timer ដែលរង់ចាំទៅល្បឿនសកម្មពីការអានចុងក្រោយ។ (T4) ការអានបញ្ជីលែងជាប់
  ចន្លោះទ្វេ `/detail` ៖ ការទប់បណ្តោះអាសន្ន ➜ តាំងម៉ោងតាមល្បឿនអាន · `scheduleZtoStatusSweep()` រត់ពេលការអានដល់ពេល។ (T5) ZTO-SETUP-KH ៖ ជួរចាស់បាន 🔒 ពី `/detail`
  ផងដែរ។ (T6) លេខអ្នកយាម E1 វាស់ឡើងវិញ។ (G0–G6) អ្នកយាមសម្រាប់ mutation ដែលរស់ ៖ ថ្ងៃ `partial` · `/detail` តែពេល `detailDue` · ជួរដំបូងរំលងកញ្ចប់បិទ ·
  ពិដានស្របគ្នាជាលេខ ៣ · ភស្តុតាងពីការអានទាំងមូល · E6 sentinel `flippedAt > 0`។ អ្នកយាម ៖ `zto-signed-cadence.test.tsx` +៩ (+ E6 sentinel) · `zto-signed-truncation.test.tsx` +៦ ៖
  កូដមុនកែ **ធ្លាក់ ៧** (Q1 · Q2 · Q3 · Q4 · T3 · T4 ×២) · mutation ១៩/១៩ ត្រូវសម្លាប់ (Q4c កញ្ចប់បើក · T3b មិនគិតការអានចុងក្រោយ ➜ តេស្ត ២ បន្ថែម)។
- 🔎 **ZTO-E7 (k6 · k7) — ចម្លើយ Lookup មកដល់ពេល `phoneModalBusy`**
  **របៀបរកឃើញ** ៖ ការផ្ទៀងផ្ទាត់ជុំ ZTO ស្អាត (probe ឯករាជ្យ ២ ៖ `zz-verify-e7` · `vprobe-late-fill`)។ **មូលហេតុឫសគល់** ៖ `applyLookupFillToModal()` ឆែកតែ `pendingBarcode` + `isModalOpen` ប៉ុន្តែប្រអប់នៅបើក និង `pendingBarcode` នៅដដែលពេល `confirmPhone()` កំពុងរង់ចាំ claim/save ➜ ចម្លើយយឺត (ក) សរសេរ COD/DOD ចូល form ដែលការរក្សាទុកបានអានរួចហើយ + toast ✅ (k7) (ខ) បើក `autoSubmit` ➜ ហៅ `confirmPhone(false)` លើកទី ២ ➜ claim ទី ២ ឃើញ `'taken'` ➜ `rejectScanAndRefocus()` បិទប្រអប់ ហើយបង្ហាញ «ត្រូវបានបញ្ចូលរួចហើយ» ខណៈការរក្សាទុកទី ១ នៅដំណើរការ រួចមាន ✅ (k6)។ ⛔ ប៊ូតុង disabled មិនការពារទេ ព្រោះ autoSubmit ហៅ `confirmPhone()` ផ្ទាល់។
  **ការជួសជុល** ៖ `applyLookupFillToModal()` ពេល `phoneModalBusy` ➜ ទុកចម្លើយក្នុង `lookupAnswersHeldWhileSaving` (key = barcode អក្សរធំ) ហើយមិនសរសេរ/មិន toast/មិនហៅ `confirmPhone()` · `fillEmptyLookupFields()` ជាកន្លែងបំពេញតែមួយ (ទម្រង់ថ្មី និងក្រោយបរាជ័យ) · `confirmPhone()` ៖ ត្រឡប់ភ្លាមពេល busy (ច្រកតែមួយ) · សម្អាត Map ពេលចាប់ផ្ដើម busy · `takeHeldLookupAnswer()` **មុន** `closeModal()` (ព្រោះ `clearLookupStatus()` សម្អាត Map) · រក្សាទុករួច (`true` · `false` = រក្សាទុកតែស្ថិតិប្រាក់មិនទាន់ sync · យឺត `true`/`false`) ➜ `warnHeldLookupMoney()` ព្រមានម្ដង ពេល COD/DOD របស់ ZTO > 0 ហើយខុសពីតម្លៃដែលបានរក្សាទុក (field ដែល ZTO មិនផ្ញើមិនរាប់ថាខុស · `null` = barcode មានក្នុងកញ្ចប់រួច ➜ គ្មានព្រមាន · save យឺតបរាជ័យ ➜ គ្មានព្រមាន) · `finally` (ពេល `current()`) ➜ ប្រអប់នៅបើក ➜ បំពេញ field ទទេពីចម្លើយរបស់ `pendingBarcode` (គ្មាន autoSubmit · គ្មាន toast)។ ⛔ មិនប្ដូរលុយដែលបានរក្សាទុកដោយខ្លួនឯង។
  **លេខដែលវាស់បាន** ៖ `lookup-late-answer-busy.test.ts` លើ 46377da ធ្លាក់ **9/15** (k6 ៖ claims `['ZTK62','ZTK62']` · k7 ៖ `modalCodInput = '7.5'` ពេល busy ខណៈ save `0/0`) ➜ ក្រោយកែ 15/15។ Mutation ៖ 18 KILLED (M1–M6 · M8–M16 · M18–M20) · M7 (សម្អាតក្នុង `finally`) និង M17 (ឆែក `isModalOpen` មុនបំពេញ) SURVIVED ➜ កូដដែលលែងត្រូវការត្រូវបានដកចេញ · M6 · M11 · M12 · M14 · M15 SURVIVED នៅជុំទី ១ ➜ បន្ថែមតេស្ត (session ចាស់ · យឺត+ledger មិនទាន់ sync · merge ស្ទួន `null` · ZTO 0/0 ទល់នឹងលុយដែលវាយ · គ្មាន dod) ➜ KILLED។ `setup-link-logout-test` ៖ `clearLookupStatus()` មិនសម្អាត Map ➜ FAIL 2 (70/72)។ Sandbox `camera-resume-test` · `lookup-prefetch-test` · `setup-link-logout-test` ធ្លាក់ «lookupAnswersHeldWhileSaving is not defined» ក្រោយកែ (សញ្ញាល្អ ៖ checker រត់កូដពិត) ➜ ប្រកាស Map ពិតពី app.js។
- 🔎 **lookup-import-race (`ZoeW/tests/lookup-import-race.test.ts`) — E7 k8**
  - **រកឃើញ៖** `seedCustomerTableFromImport()` ប្រើលេខរាប់ `customerDataTableSessionGeneration` រួមជាមួយ `attemptAutoLookup()` (ច្រកវគ្គ) និង `captureZtoSession()`។ ការនាំចូលដែលបញ្ចប់ពីក្រោយ (`closeSheetImportModal()` មិនបញ្ឈប់ `runSheetImport()`) ធ្វើឲ្យ Lookup ដែលកំពុងរត់ត្រឡប់ចេញនៅច្រកឆែក ដោយមិនហៅ `setLookupStatus()` ➜ «🔎 កំពុងស្វែងរក…» ជាប់រហូត។ ផ្លូវ `runSheetImportClear()` → `clearCustomerDataTableCache()` ក៏ទុក loading ជាប់ដូចគ្នាដែរ។
  - **អ្នកយាមមុនជួសជុល (46377da)៖** ធ្លាក់ ៣ · ជាប់ ៦ (ពី ៩) — នាំចូលកណ្ដាលផ្លូវ ➜ loading ជំនួស success · clear កណ្ដាលផ្លូវ (success/catch) ➜ loading ជាប់។
  - **ជួសជុល៖** បន្ថែមលេខរាប់ `customerDataTableFetchGeneration` (ចាប់/ឆែកដោយ `fetchCustomerDataTableRows()`)។ `seedCustomerTableFromImport()` ដំឡើងតែលេខនេះ ហើយ `clearCustomerDataTableCache()` ដំឡើងទាំងពីរ។ `settleStaleLookup()` ក្នុង `attemptAutoLookup()` ផ្ដល់ status warn ពេលចម្លើយហួសវគ្គ លុះត្រាតែគ្មាន Lookup ថ្មីសម្រាប់ key ដដែល។
  - **Mutation៖** ១៣/១៣ KILLED។ M4 (ច្រកជោគជ័យធៀប session gen) និង M4d (លុបច្រក catch របស់ fetch) រស់រានដំបូង ➜ បានបន្ថែមការអះអាង «ការទាញថ្មីពិតជាសរសេរ» និងតេស្ត «បញ្ច្រាស ២ខ»។
  - **ផលប៉ះពាល់៖** `captureZtoSession()` (`zto-status.ts`, ក្នុងតំបន់ចាក់សោ មិនបានប្ដូរ) លែងចាត់ការនាំចូល Sheet ជាការប្ដូរវគ្គទៀតហើយ។ ការចាកចេញ/Config/backend នៅតែបោះចោលចម្លើយ ZTO ចាស់ (`zto-session-race.test.ts` ជាប់)។
- 🔎 **ZTO-E7 k9 ៖ barcode ក្រៅទម្រង់ ZTO ➜ សារខុស · Sentry · APK ហៅ ២ ដង (`lookup-failure-identity-test` ផ្នែក ៦ · `ZoeW/tests/zto-barcode-shape.test.ts`)**
  - 🔴 វាស់លើ 46377da ៖ `zto-order-detail.js` បដិសេធ barcode ក្រៅ `BARCODE_RE` ដោយ 400 `{ code: 'ZTO_BARCODE_INVALID' }` (មិនហៅ ZTO) តែ `attemptAutoLookup()` គ្មានសាខាសម្រាប់កូដនេះ ➜ សារទូទៅ «មិនអាចភ្ជាប់ ZTO បាន» · `lookupFailureIsDefinitive()` ថា បណ្តោះអាសន្ន (cooldown ៦ វិ. ➜ ស្កេនម្តងទៀតក៏ហៅម្តងទៀត) · `ZoeErrors.capture('HTTP 400')` រាល់ការស្កេន។ APK ៖ `fetchWithTimeout()` ចាត់ទុក 400 **ណាមួយ** ជា «Function ចាស់» ➜ សាក URL ចាស់ ➜ ២ សំណើ/ការស្កេន។ checker ឥរិយាបថ ៖ 63 ok · 12 fail · vitest ៖ 16/28 fail។
  - ⚠️ ការរចនា ៖ Function ចាស់ (មុន 2.42.9) ដែលមិនអាន `X-Zoe-Query` ក៏ឆ្លើយ `ZTO_BARCODE_INVALID` ដែរ (វាមិនឃើញ barcode) ➜ **កូដក្នុង body តែឯង បែងចែក Function ចាស់/ថ្មីមិនបាន**។ ច្បាប់ ៖ មិនសាក URL ចាស់ តែពេល barcode **ក្នុង query ខ្លួនឯង** ក្រៅទម្រង់ (`ztoRequestBarcodeIsRefused()`) — URL ចាស់ក៏នឹងបដិសេធដូចគ្នា។ barcode ត្រឹមត្រូវ + 400 ➜ Function មិនបានអាន header ➜ ផ្លូវបម្រុង + ចងចាំដូចមុន។ `list=1` · `diag=1` មិនមែនការបដិសេធ barcode ➜ ផ្លូវបម្រុងដដែល។
  - mutation ៖ ១៨ នៅលើ vitest + ៧ នៅលើ checker ➜ ចាប់បានទាំងអស់ (គ្មានរស់រាន)។ sandbox `lookup-prefetch` · `lookup-burst` · `health-check` ស្រង់ helper/ថេរថ្មីពីកូដពិត · barcode សាកល្បង `BC1` ➜ `BC100001` (`BC1` មិនមែនទម្រង់ ZTO ➜ ច្រកថ្មីនឹងបញ្ឈប់មុនផ្លូវបណ្ដាញដែល checker ទាំងនោះវាស់) · `parity-deep` `ZL5` ➜ `ZL500005` ដោយហេតុផលដដែល។
- 🔎 **E7 k10 ៖ ផ្លូវស្កេន `/detail` ទុកលេខដាក់កន្លែងដែលផ្លូវបញ្ជីទម្លាក់ ➜ `addOrUpdateEntry()` បញ្ចូលកញ្ចប់អ្នកដទៃក្រោម phone `0`**
  - **ការវាស់** ៖ `projectListRow()` (ផ្លូវ `?list=1`) ទម្លាក់ phone ដែលខ្ទង់ទាំងអស់ជា `0` ឬគ្មានខ្ទង់ (`listPhoneIsPlaceholder()`) តែ `extractOrder()` (ផ្លូវស្កេន `/detail`) បញ្ជូន phone ដដែល ➜ App បំពេញ `0` ក្នុងប្រអប់ ➜ `autoSubmit` ➜ `confirmPhone()` ➜ `addOrUpdateEntry()` បញ្ចូលគ្នាតាម phone + scanDate (មានតែ «គ្មានលេខ» ដែលរួច) ➜ កញ្ចប់ ២ របស់អតិថិជនផ្សេងគ្នា (COD $1.50 + $2.25) ក្លាយជាជួរតែមួយ phone `0` count ២។ សេណារីយ៉ូ Function ៖ phone `0` គ្មាន COD/DOD ➜ `found:true` (App រក្សាទុក `0` ស្វ័យប្រវត្តិ) ខណៈផ្លូវបញ្ជីចាត់ទុកជា «មិនមែនអតិថិជន»។
  - **កែ (ផ្នែក server តែប៉ុណ្ណោះ)** ៖ helper តែមួយ `phoneIsPlaceholder()` សម្រាប់ផ្លូវទាំង ២ · `extractOrder()` ៖ `shown = phoneIsPlaceholder(phone) ? '' : phone` · `!shown` ហើយគ្មាន COD/DOD ➜ `null` («រកមិនឃើញ» `found:false` គ្មាន `error`) · ផ្ទុយពីនោះ `phone: shown`។ App មិនប្តូរ ៖ `found:true` + phone ទទេ ➜ បំពេញ COD/DOD · `autoSubmit` មិនដើរ (`phoneWasAutoFilled` false)។
  - **អ្នកយាម** ៖ `zto-list-sync-test` ផ្នែក ៥ក — តម្លៃដូចគ្នា (`'0'` · `'000'` · `''` · `'0-0'` · `' 0 '` · `'00 000 000'` · `'+855-0'` · `'081684403'` · `'855963897345'`) ឆ្លង handler ពិតតាម `?list=1` និង `/detail` ➜ phone ស្មើគ្នា (ជាន់អប្បបរមា ៖ វាស់ពិតគ្រប់តម្លៃ) · placeholder + COD ➜ `found:true` phone ទទេ · placeholder គ្មាន COD/DOD ➜ `found:false` · ទិសផ្ទុយ ៖ លេខពិតគ្មាន COD/DOD ➜ ឆ្លងកាត់។ `ZoeW/tests/zto-placeholder-phone.test.tsx` — handler ពិតនៅពីក្រោយ `fetch` របស់ App + `triggerScanAction`/`attemptAutoLookup`/`confirmPhone`/`addOrUpdateEntry` ពិត · Firebase SDK ក្លែងក្នុងអង្គចងចាំ ➜ ២ ជួរ «គ្មានលេខ» · ទិសផ្ទុយ ៖ លេខពិតដូចគ្នា ២ ដង ➜ ១ ជួរ count ២។
  - **លើ tree មុនកែ (46377da)** ៖ `zto-list-sync-test` 540 ok · 15 FAIL · vitest 4 ធ្លាក់ / 1 ឆ្លង («expected 1 to be 2»)។ ក្រោយកែ ៖ 555 ok · 0 FAIL · 5/5។
  - **Mutation** ៖ M1 `shown = phone` · M2 ច្រកមិនឃើញអាន `phone` ដើម · M3 ត្រឡប់ `phone` ដើម · M4 helper `/^0$/` · M5 ផ្លូវបញ្ជីឈប់ប្រើ helper · M6 ដកច្រកមិនឃើញ ➜ ៦/៦ KILLED។
  - **ព្រំដែនដែលទទួលយក** ៖ phone គ្មានខ្ទង់សោះ (ឧ. អក្សរ) ក៏ជា placeholder ដែរ (ច្បាប់ដដែលនឹងផ្លូវបញ្ជី)។ ជួរ `0` ដែលបានបញ្ចូលគ្នារួចមុនកែ មិនត្រូវកែស្វ័យប្រវត្តិ។ ផ្លូវ Lookup មិនមែន ZTO (Apps Script/API ផ្ទាល់ខ្លួន) មិនប្តូរ។
- 🔎 **E7 បញ្ចូលលើ M2 + Task 17** ៖ cherry-pick `e7-k67` · `e7-k8` · `e7-k9` · `e7-k10` (conflict តែ `repository-file-coverage.json` · `LOCK`) · តេស្ត k67 (`lookup-late-answer-busy.test.ts`) ធ្លាក់ ២ លើ k9 ៖ barcode `ZTK61` (៥ តួ) ក្រៅ `ZTO_BARCODE_RE` (៦–៦៤) ➜ ច្រកទម្រង់បញ្ឈប់ Lookup មុនចម្លើយ ➜ barcode តេស្ត `ZTK6100001` … (bisect ៖ k67 ឆ្លងលើ `46377da` · `241a7dd` · `fb8c3c0` · `fc15774` · `abb3f1b` · k67+k8 ➜ ធ្លាក់តែក្រោយ k9)។
- 🔎 **ការពិនិត្យប្រឆាំង M2 + Task 17** (workflow ៤ ផ្លូវ ៖ លុយ · quota · backend · អ្នកយាម ៖ វាស់ដោយ probe លើ snapshot ធៀប tree មុន) ៖ (លុយ) Q1 បង្រួមជួរពេលមានជួរផ្ទុយ ➜
  ជុំបង្រួមមិនឃើញជួរផ្ទុយ ៣ ថ្ងៃមុន ➜ «ពេញលេញ» ➜ ដកលុយកញ្ចប់ ១០ នាទីក្រោយទុំ ➜ `ztoSignedMismatchFrom` (ចងចាំដើមជួរផ្ទុយ · ពេញលេញតែពេលការអានស្អាតគ្របវា ·
  ជួរវែងអានម្តងទៀត ≤ ១ ក្នុង `ZTO_SIGNED_FRESH_MS`) · M2 ៖ `ztoSignedOff` ➜ មិនរង់ចាំ · `ZTO_SHOP_SWEEP_ACTIVE_MS` ៧ ថ្ងៃ ➜ ១ ម៉ោង (វាស់ ៖ App បើកខ្លីៗ ➜ រង់ចាំ ១៦៧ ម៉ោង) ·
  ការភ្ជាប់ listener ឡើងវិញមិនចាប់វគ្គថ្មី។ (quota) memo តាមថ្ងៃអនុវត្តលើជួរបង្រួមផង (+៣១–៨៩% សំណើ ៣០ នាទី) ➜ `ztoSignedSplitFrom` · ផ្លូវ memo លេបកំហុស
  (ZTO ធ្លាក់ ➜ ៣១ សំណើ/ជុំ · `enabled:false` ឃើញក្រោយ ១៩៨២ វិ.) ➜ ឈប់ក្រោយរលកដំបូង ហើយបោះកំហុស · «កំពុងពិនិត្យបន្ត N» រាប់ verdict ដែលមិនសួរទៀត ➜ មិនរាប់ ·
  T3 បោះ timer បន្ត `/detail` ➜ តែពេលការអានបញ្ជីរស់។ អ្នកយាម ៖ +១១ តេស្ត (មុនកែធ្លាក់ ១១)។
  (backend) listener សញ្ញាហាងដែលត្រូវ `permission_denied` (ទូរស័ព្ទបើកកំណែថ្មីមុន Publish rules) ស្លាប់រហូតដល់ reload (SDK ពិតដក listener) ➜ `retryZtoShopSweepListener()`
  ពីជុំ ៦០ វិ. និង `visibilitychange` (≤ ១ ដង / ៥ នាទី · មិនរង់ចាំរហូត snapshot មកដល់) · ត្រាពេលអនាគតមួយ (offset ម៉ោង Server ចាស់) កកសញ្ញាទាំងហាង (ឧបករណ៍ ZTO
  លែងសរសេរ · B លែងរង់ចាំ) ➜ ត្រា > server now + ៥ នាទី អានជា ០ · rules `<= now + 600000` (migration `20261006192639_zoe_rules.sql` ជំនួស `…181025` ដែលមិនទាន់ merge) ·
  `emu/app-writes-rules` probe ត្រា +៣០ ថ្ងៃ ➜ បដិសេធ។ អ្នកយាម +៣ (មុនកែធ្លាក់ ៣)។ Supabase ៖ RLS មិនមែន read rules ➜ listener ឃើញ null រួចឯកសារពិត (មិនរងផលប៉ះពាល់)។
  (អ្នកយាម) mutant ៣៤ លើកូដ M2/T17 ➜ ១០ រស់ ➜ តេស្ត +៨ (គ្មានការប្តូរកូដផលិតកម្ម) ៖ ជុំជួរផ្ទុយមិនរុញ completeAt ហាង · ត្រា `ztoSignedCompleteServerAt` ពេលចាប់ផ្តើមការអានយឺត ·
  `pruneZtoPickupVerdictSeen` រក្សាកញ្ចប់បើក · memo តាមថ្ងៃមិនឆ្លងវគ្គ · ចាកចេញសម្អាត `ztoPickupVerdictSeenAt` · throttle ពេល update ត្រូវបដិសេធ · `advancedAt` តែពេល completeAt ឡើង ·
  `measured: false` មិនសរសេរសញ្ញា ➜ mutant ទាំង ១១ (រួម Q4 banner) ត្រូវសម្លាប់។
- 💰 **F1** (ជុំនេះបង្កើត · ផ្ទៀងឯករាជ្យ ២ ផ្លូវ) ៖ E3 ប្តូរ Function `signed=1` ពី `listSignedRange(range)` (ពង្រីកដល់ថ្ងៃនេះ) ទៅ `range` ផ្ទាល់ ដើម្បីការអានតាមថ្ងៃ ➜ តែប្រអប់បញ្ជី
  ក៏ប្រើ `signed=1` សម្រាប់ទំព័រ «ចុះហត្ថលេខា» បន្ថែម (`last+1..signedPages`) ខណៈ `signedPages` មកពី companion ដែលពង្រីកដល់ថ្ងៃនេះ ➜ ពេល «ដល់ថ្ងៃ» < ថ្ងៃនេះ ទំព័រ ២–៣
  អានបញ្ជីផ្សេង (`from..to`) ➜ វាស់ ៖ ភស្តុតាង ២៣០/២៩១ · X (ចុះហត្ថលេខាក្រោយ `to` · ទំព័រ ៣) មិនឃើញ ➜ ចូលជា «មិនទាន់យក» · `signedState: 'ok'` (គ្មានការព្រមាន) ·
  client 2.50.0 ក៏ខូចដែរ។ កែ ៖ `signed=1` ពង្រីកវិញ (ដូច `b2868e1`) · `exact=1` (`signedExact`) សម្រាប់ `fetchZtoSignedPages()` តែប៉ុណ្ណោះ (ការអានរបស់ជុំបិទតាម ZTO និងតាមថ្ងៃ) ·
  ជួរពិតនៅក្នុង cache key ដដែល។ អ្នកយាម ៖ `ZoeW/tests/zto-signed-past-range.test.tsx` (Function ពិត + client ពិត + ZTO ក្លែងដែលគោរពជួរ ៖ «ដល់ថ្ងៃ» < ថ្ងៃនេះ ·
  បញ្ជី 05 វែងជាងមកដល់) ៖ tree មុនកែ (`241a7dd`) **ធ្លាក់ ១** (ទិសផ្ទុយ E3 ៖ ការអានតាមថ្ងៃអានតែថ្ងៃនោះ បៃតងទាំងពីរ) · `zto-list-sync-test` +៣ (`exact=1` គោរពជួរ ·
  `signed=1` ពង្រីក · `fetchZtoSignedPages` ប្រើ `signedExact` គ្រប់ទំព័រ) · mutation ៥/៥ ត្រូវសម្លាប់ (Function មិនអើពើ `exact` · មិនដែលពង្រីក · client ជុំមិន exact ·
  ប្រអប់ exact · URL ដក `exact`)។
- **k4** (E6 × ល្បឿន) ៖ ជុំដែលមានតែសាលក្រម `false` អាន ៧ ថ្ងៃ (៨ ថ្ងៃ · រហូត ៣ ទំព័រ) រៀងរាល់ ២០ វិ. (timer ខ្លួនឯងសម្រាប់របា) ➜ សាលក្រម `false` មានអាយុ ≤ ~១៤ ម៉ោង
  ➜ ម្សិលមិញ ➜ ថ្ងៃនេះ (`ztoSignedSweepRange(…, pendingOnly)`)។ **k5** ៖ mutation ២ (ប្តូរតែពេលជុំចប់ · តែការអានពេញលេញ) រស់លើតេស្ត ៦៤ ➜ តេស្ត ២ ថ្មី។

### 2026-10-06 — ជុំ ZTO ស្អាត ៖ ZTO-E4 · ZTO-E5 · ZTO-E6 (workflow agent ➜ [2.50.1])

- **E4** ៖ ជួរ `05` ដែល `scanTypeDesc` ផ្ទុយ ➜ មុនកែ `listRowIsSigned()` = `false` ស្ងាត់ (មិនរាប់ · មិនប្រាប់)។ agent បំបែកសាលក្រមជា `signed` · `mismatch` · `''`
  (សាលក្រម «ចុះហត្ថលេខា» ដដែលលើ ៧៥៦ ករណី) ហើយលេចក្នុងប្រអប់ · 🩺 · `?diag=1`។ **ការរកឃើញពេលបញ្ចូល** (session) ៖ (១) agent ធ្វើលើ base `22f3d23` (មុន E3) ➜
  ផ្លូវអានតាមថ្ងៃ (E3) បាត់ `signedMismatch` ➜ បន្ថែម (យក max ជាមួយការអានទាំងមូល ➜ មិនរាប់ស្ទួន) · (២) 💰 ការអានដែលមានជួរផ្ទុយនៅ «ពេញលេញ» សម្រាប់ E1 ➜
  ZTO ប្តូរអត្ថបទ = ការសម្អាត ៧ ថ្ងៃដកលុយកញ្ចប់ដែលយករួច (ភស្តុតាងមិនច្បាស់ ≠ «មិនទាន់យក») ➜ មិនពេញលេញ (ពិដាន ៣០ នាទី E1 នៅការពារការជាប់រហូត)។
  mutation ៣/៣ ត្រូវសម្លាប់ (E1 មិនអើពើ · ផ្លូវថ្ងៃបាត់ · រាប់ស្ទួន)។ ⚠️ fixture ដែលរាយ `signedMismatch` លំនាំដើមលើការអានទាំងមូល ធ្វើឲ្យតេស្ត E3 «ពេញលេញ» ធ្លាក់ ➜ តែពេលសុំ។
- **E6** ៖ verdict `false` ជាប់រហូត `ZTO_OPEN_RECHECK_MS` (វាស់ ៤០ នាទី)។ ការបញ្ចូល ៖ តេស្ត agent «ប្រអប់បើក ➜ មិនអានបញ្ជី» ផ្ទុយនឹងការកែល្បឿន (ប្រអប់មិនឃាត់ការអាន
  បញ្ជី) ➜ ប្តូរតាមច្បាប់ថ្មី · timer ខ្លួនឯង (ល្បឿន) ពង្រីកទៅសាលក្រម `false` (បើមិនពង្រីក ➜ របារលត់តែនៅជុំ ៦០ វិ.)។
- **E5** ៖ `retryAfterAuthRejected()` សាកតែ plan «មកដល់» ➜ companion នៅជាប់ 401 ➜ `signedOk:false`។ ការបញ្ចូល ៖ ផ្នែក ២២ ប៉ះគ្នា (E8 + E5) ➜ E5 ជាផ្នែក ២៣។

### 2026-10-06 — ជុំ ZTO ស្អាត ៖ ប្រភពកញ្ចប់ (សំណើម្ចាស់គម្រោង ➜ [2.50.1])

- **វាស់លើ payload ពិត ៥** (ក្នុងស្រុក · ចិន · Shopee ×២ · កញ្ចប់ត្រឡប់) ៖ `countryCode` = `null` គ្រប់ជួរដេក · គ្មានវាលណាសរសេរ «វៀតណាម» ឬ «ចិន» ជាប្រទេស ·
  សញ្ញាដែលមាន ៖ `recSite` (ចិន «ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ» · Shopee «Shopee SHPE» · ក្នុងស្រុក ឈ្មោះសាខាដែលផ្ញើ) · `customerCodeDesc` (`ztda` · `Shopee SHPE` · `null`) ·
  `customerCode` (`888880001` · `KH803480001` · `20000`) · barcode `7713…` (ចិន និង Shopee ដូចគ្នា) / `116…` (ក្នុងស្រុក)។ ➜ បង្ហាញ `recSite` ដូច ZTO សរសេរ (អានយល់ផ្ទាល់)
  ជំនួសការផ្គូផ្គងកូដ ➜ ប្រទេស (គំរូ ១ ក្នុងមួយប្រភព ➜ ការផ្គូផ្គងនឹងជាការទាយ)។
- ⛔ មិនរក្សាទុកក្នុងកញ្ចប់ ៖ វាលថ្មីលើ record ប្រវត្តិ = `$other` rules បដិសេធ ➜ ត្រូវការ rules Firebase + migration Supabase (ការសម្រេចរបស់ម្ចាស់គម្រោង) ·
  ការបង្ហាញពេលស្កេនម្តងមួយកញ្ចប់ (`/detail` ៖ `scan/get/order/detail`) ត្រូវការ payload `/detail` ពិតមុន (វាលរបស់វាមិនទាន់វាស់)។

### 2026-10-06 — ជុំ ZTO ស្អាត ៖ «បិទតាម ZTO យឺត អត់ស្ថេរភាព» (របាយការណ៍ម្ចាស់គម្រោង ➜ [2.50.1])

- **វាស់** (vitest · timer ក្លែង · ជុំ ៦០ វិ. ពិត · `fetch` ក្លែងដែលចុះហត្ថលេខាក្រោយ ៣០ វិ.) ៖ ទំនេរ ៩២ វិ. · **ប្រអប់បើក ២៥ វិ. ក្នុង ៣០ វិ. ➜ មិនដែលបិទក្នុង ៤៥ នាទី** ·
  ការធ្លាក់ម្តង ៣៣២ វិ. · ZTO ធ្លាក់ ៣៥ នាទី ➜ ១៤៤២ វិ.។ **មូលហេតុ** ៖ (១) `runZtoStatusSweep()` ចេញភ្លាមពេល `ztoStatusNetworkAllowed()` = `false` (ប្រអប់បើក) ហើយ
  `ztoStatusBlockIsTransient()` ចាត់ប្រអប់ជា «ស្ទះយូរ» ➜ គ្មានម៉ោងសាកឡើងវិញ ➜ ជុំ ៦០ វិ. ធ្លាក់ចំពេលប្រអប់បើកជានិច្ច ➜ ការអានបញ្ជី «ចុះហត្ថលេខា» (១ សំណើ) ជាប់ជាមួយច្រកទ្វារ `/detail`
  · (២) ចន្លោះទ្វេពិដាន ៣០ នាទី · (៣) Function ទុក `signed=1` ៦០ វិ.។ **កែ** ៖ ច្រកទ្វារដាច់ (`ztoSignedNetworkAllowed()` គ្មានប្រអប់) · ល្បឿនតាមសកម្មភាព (ម្ចាស់គម្រោងជ្រើស
  «ឆ្លាតវៃ» ក្រោយដឹងថា credits Netlify អស់ ➜ **site ទាំងអស់ផ្អាក**) · timer ខ្លួនឯង · ពិដាន ១០ នាទី · cache ១៥ វិ.។
- **ការរកឃើញក្នុងការកែ** ៖ (ក) ការកត់ `ztoStatusLastSweepAt` រាល់ជុំ (ទោះតែការអានចុះហត្ថលេខា) ➜ `/detail` ដែលកំពុងចន្លោះទ្វេ (≥ ៦០ វិ.) **ស្រេកឃ្លានជារៀងរហូត** (ជុំ ២០ វិ.
  កត់ថ្មីមុនផុតចន្លោះ) ➜ កត់តែពេល `/detail` ដើរពិត · (ខ) ការកត់ពេល `/detail` ត្រូវប្រអប់ឃាត់ ➜ បិទប្រអប់ ➜ `/detail` រង់ចាំ **២៧៧ វិ.** (ជំនួស ១១ វិ.) ➜ `detailDue`
  រួម `detailAllowed`។ mutation (ខ) រស់លើតេស្តដំបូង ➜ វាស់ផលពិតមុនសម្រេច ៖ ចន្លោះ ២០ វិ. ➜ គ្មានផល · ចន្លោះទ្វេ ១០ នាទី ➜ ២៧៧ វិ. ➜ តេស្តថ្មី។
- mutation ២៦/២៦ ត្រូវសម្លាប់ ៖ ប្រអប់ឃាត់ការអាន · ច្រកទ្វារ `/detail` · ល្បឿនសកម្ម/ទំនេរ/បង្អួច ៥ នាទី/លាក់ · timer ខ្លួនឯង (ដក · គ្មានកញ្ចប់បើក · កុងតាក់ · លាក់ · ចន្លោះទ្វេ) ·
  ល្បឿនជាន់ចន្លោះទ្វេ · ពិដាន ៣០ នាទី · Lookup · ក្រៅបណ្តាញ · Data Saver · (ក) · (ខ) · ប្រអប់ក្នុង `ztoStatusBlockIsTransient()` · កុងតាក់ក្នុង `signedDue` ·
  wiring `pointerdown`/`keydown` · ការរមូររាប់ · cache ១៥ វិ. (ដក · ០ · បញ្ជីធម្មតាក៏ ១៥ វិ. · diag)។
- ⚠️ store field ថ្មី (`ztoUserActiveAt`) **មិនលេចលើ `window`** ក្នុង audit build (`_generated-state.json` មានតែ field ដើម) ➜ checker browser វាស់តាម function ដែលលេច
  (`ztoSignedSweepCadenceMs()`)។

### 2026-10-06 — ជុំ ZTO ស្អាត ៖ ZTO-E1 — ការសម្អាត ៧ ថ្ងៃដកលុយកញ្ចប់ដែល ZTO ចុះហត្ថលេខារួច (➜ [2.50.1])

- **វាស់ (មិនមែនទ្រឹស្តី)** ៖ លំដាប់ពិតពេលបើក App ៖ snapshot ប្រវត្តិ ➜ `debouncedRenderAfterHistorySync` (១២០ ms) ➜ `runAutomaticCleanupRules()` ➜
  `claimAndCleanupItem(id, 'abandon')` **មុន** `renderHistory()` ➜ `scheduleZtoStatusSweep()` (១.៥ វិ.) ➜ `closeZtoSignedBarcodes()`។ vitest លើ `b2868e1` ៖ កញ្ចប់
  អាយុ ៨ ថ្ងៃដែលមានក្នុងបញ្ជី `signed=1` ចាប់ផ្តើម transaction `abandon` នៅ snapshot ដំបូង (`expected true to be false`)។ ចន្លោះបន្ថែមដែលវាស់ឃើញក្នុងពេលរចនា ៖
  (ក) ជុំមួយបិទ ≤ `ZTO_STATUS_SWEEP_BATCH` ➜ ច្រកទ្វារ «ការអានជោគជ័យម្តង» នឹងដកលុយកញ្ចប់ទី ១១–១២ (មុនកែ ៖ `['ZTE2000010','ZTE2000011']` ត្រូវដក) ➜ «ពេញលេញ» =
  គ្មាន `more` · គ្មានការបិទព្យួរ · គ្មានបណ្តាញដាច់ · មិន `partial` · មិន `truncated` · (ខ) ជួរ ៧ ថ្ងៃ ➜ App បិទ ១២ ថ្ងៃ ➜ ស្កេនចុះហត្ថលេខាថ្ងៃទី ២ នៅក្រៅជួរ
  (មុនកែ ៖ `from` = `2026-09-29` ជំនួស `2026-09-24`) ➜ គ្របដល់ថ្ងៃបង្កើតកញ្ចប់បើកចាស់បំផុត (Server កាត់ ៣១ ថ្ងៃ ➜ `ZTO_SIGNED_SWEEP_MAX_DAYS = 30`) ·
  (គ) APK ដេកក្នុង background ច្រើនថ្ងៃ (JS ផ្អាក) ➜ ត្រា «ការអានពេញលេញ» ចាស់ ➜ `ZTO_SIGNED_FRESH_MS` · វគ្គរង់ចាំដែលហួសពិដានរួចមុនដេក មិនត្រូវដោះលែងភ្លាមពេលភ្ញាក់
  ➜ ចន្លោះការពិនិត្យ > `ZTO_ABANDON_RESUME_GAP_MS` = វគ្គថ្មី · (ឃ) ការបរាជ័យផ្ទៀងគណនីបណ្តោះអាសន្ន (`idtoken:supabase-unreachable` …) ≠ «Server មិនកំណត់» ➜
  `ztoListReasonIsDefinitive()` (តែ `site:*` · ការកំណត់ Server · `signed:off` ដោះលែងភ្លាម)។
- **mutation (២២/២២ ត្រូវសម្លាប់)** ៖ ដកច្រកទ្វារពី cleanup · `more`/ការបិទព្យួរ/បណ្តាញដាច់ មិនកាត់ «ពេញលេញ» · មិនពិនិត្យ `partial`/`truncated` · គ្មានការភ្ញាក់ ·
  គ្មាន/ជានិច្ច «ស្រស់» · គ្មានពិដាន · `signed:off`/មិនកំណត់ពិតមិនដោះលែង · គ្រប់ «មិនកំណត់» ដោះលែង · ជួរមិនពង្រីក/មិនកាត់ · ការចាកចេញមិនកំណត់ឡើងវិញ (៣ វាល) ·
  មិនពិនិត្យកុងតាក់/Config · ការអានដែលវាស់បានមិនលុប «បិទ»។ **mutation ២ រស់ ➜ ដកកូដស្ទួន** ៖ `ztoAbandonHoldSince = 0` ពេលអានពេញលេញ (ការភ្ញាក់គ្របរួច ព្រោះ
  `ZTO_SIGNED_FRESH_MS` > `ZTO_ABANDON_RESUME_GAP_MS` ហើយផ្លូវ «ស្រស់» មិនត្រា) · ការកំណត់ `ztoAbandonCheckedAt` ឡើងវិញពេលចាកចេញ (`HoldSince = 0` គ្របរួច)។
- **ការផ្ទៀងឡើងវិញ (សំណើម្ចាស់គម្រោង ៖ «ផ្ទៀងផ្ទាត់ E1 E2 ឡើងវិញ»)** ៖ រកឃើញ **១ ចំណុចពិត (លុយ)** ៖ `closeZtoSignedBarcodes()` កត់ `ztoSignedSweepOkAt` **មុន** រង្វិលបិទ ➜
  ជុំដែលបិទបាន ១០ ហើយនៅសល់ (`more`) ➜ ជុំបន្ទាប់ `ztoSignedSweepRange()` រួមតូចពី ១០ ថ្ងៃ ទៅ ១ ថ្ងៃ ➜ កញ្ចប់ដែលចុះហត្ថលេខា ៩ ថ្ងៃមុនបាត់ពីបញ្ជី ➜ ជុំ «ពេញលេញ» ➜
  ច្រកទ្វារបើក ➜ **ដកលុយ ២ កញ្ចប់** (វាស់ដោយ server ក្លែងដែលគោរពជួរថ្ងៃ ៖ ជួរ `2026-09-26..2026-10-06` ➜ `2026-10-05..2026-10-06` · `['ZTE2R00010','ZTE2R00011']`)។
  អ្នកយាមចាស់មិនឃើញ ព្រោះ server ក្លែងឆ្លើយបញ្ជីដដែលគ្រប់ជួរ។ ការកែ ៖ `ztoSignedSweepOkAt` កត់តែពេលជុំពេញលេញ (ដូច `ztoSignedCompleteAt`) ➜ ជុំ `more`/ការបិទព្យួរ/
  បណ្តាញដាច់/`truncated` រក្សាជួរធំ។ mutation ៣/៣ ត្រូវសម្លាប់ (ត្រាមុនរង្វិល · មិនដែលត្រា · ចន្លោះទ្វេពេល partial)។ ⚠️ ផលចំណាយ ៖ ជុំ `truncated` លែងរួមតូចទៅ ១ ថ្ងៃ
  (ការអានធំដដែល) ➜ ពិដានទំព័រនៅជារបស់ E3។ E2 ផ្ទៀងឡើងវិញ ៖ វាស់ ៖ គ្មាន (អ្នកប្រើ `ztoListSignedVerdict()` ទាំងអស់ · ការជ្រើស probe · គោលដៅបិទ · ចំណាំ ·
  ការបញ្ចូលកញ្ចប់ចាស់ ៨–៣០ ថ្ងៃ = COD ម្តង + ស្ថិតិយក (ដូចសាលក្រម `true` ពីមុន))។
- ⛔ ច្រកទ្វារតែមួយគត់ ៖ `runAutomaticCleanupRules()` សួរ `ztoAbandonCleanupIsHeld()` តែពេលកញ្ចប់ទុំ `abandon` (short-circuit) ➜ កញ្ចប់ចម្រុះ (A បិទ ២ ម៉ោង · B បើក ៨ ថ្ងៃ)
  នៅតែចូលផ្លូវ `close` សម្រាប់ A ពេលរង់ចាំ · `resumeInterruptedCleanups()` (journal) មិនរង់ចាំ (ការសម្អាតដែល claim រួច)។
- **ZTO-E2 (ទ្វារពីរសម្រេចផ្ទុយគ្នា · ➜ [2.50.1])** ៖ `ztoListSignedVerdict()` (ទ្វារបញ្ចូល) ៖ `/detail` ➜ ជួរដេក ➜ ភស្តុតាង · `runZtoStatusSweep()` (ទ្វារស្វ័យប្រវត្តិ) ៖
  ភស្តុតាង (`closeZtoSignedBarcodes()` រត់មុន) ➜ `/detail` (false មិនទប់)។ vitest លើ `b2868e1` ៖ ជួរដេកក្មេង `false` + ស្កេន 05 ➜ `addOrUpdateEntry(…, closedAtMs = 0)` ·
  `applyBarcodeCloseChange` ០ ដង ➜ `runZtoStatusSweep(false)` ភ្លាមៗបន្ទាប់ ➜ បិទ ១ ដង · កញ្ចប់បើកក្នុង ZoeW ➜ «ℹ️ គ្មានកញ្ចប់ថ្មីត្រូវបញ្ចូលទេ» · ចាស់ + false + ភស្តុតាង ➜
  `too-old-open`។ ឯកសារអ្នកប្រើ (`ZTO-SETUP-KH.md` · `guide.html`) សន្យា «ចុះហត្ថលេខា = បិទ» រួចហើយ ➜ កូដផ្ទុយឯកសារ។ ការកែ ៖ អ្នកសម្រេចតែមួយ `ztoPickupVerdictOf()`
  (ភស្តុតាង ➜ `/detail` ➜ ជួរដេក · `/detail` នៅឈ្នះជួរដេក) · អ្នកប្រើ (`classifyZtoListRows` · `ztoListRowNeedsSignedProbe` · `ztoListCloseTargets` · ចំណាំ) មិនប្រែ ·
  `zto-status.ts` មិនប្រែ (រចនាសម្ព័ន្ធលំដាប់ដដែល)។ mutation ៦/៦ ៖ លំដាប់ចាស់ · `/detail` មុនភស្តុតាង · ជួរដេកមុន `/detail` · មិនអានភស្តុតាង/`/detail`/ជួរដេក។
  sandbox `zto-list-sync-test` ៖ ឈ្មោះថ្មីក្នុង `NEEDED` + `IMPORT_NAMES` (បើភ្លេច ➜ ReferenceError ១០ FAIL) · ⛔ harness ៖ `vi.mock` `scan-action`/registry **ដោយគ្មាន**
  `importOriginal` (រង្វង់ import ➜ ម៉ូឌុលពិត ➜ claim `unknown`)។ ⛔ មិនទាន់វាស់ ៖ ជួរដេក 03 ពិតមាន `billStatus` ទេ (សកម្មភាពដោយដៃ [2.50.1] ទី ៣)។
- **ZTO-E3 (ពិដានបញ្ជីចុះហត្ថលេខា · ➜ [2.50.1])** ៖ `fetchZtoSignedCodes()` ត្រឡប់ `truncated` តែគ្មានអ្នកប្រើ ➜ ជុំបិទតាម ZTO អានទំព័រ ១–៣ ហើយបិទតែអ្វីដែលឃើញ ·
  ការវាស់ ៖ server ក្លែង ៩ ទំព័រ ➜ កញ្ចប់ថ្ងៃ d−5 មិនដែលរកឃើញ (មុនកែ ៖ `['ZTE3000001','ZTE3000002']` គ្មាន `ZTE3000005`)។ **លំដាប់ ZTO វាស់លើទិន្នន័យពិត** (payload ៣ របស់ម្ចាស់គម្រោង ៖
  ក្នុងស្រុក · ចិន · Shopee វៀតណាម) ៖ តាម `id` ឡើង (≈ ពេលបង្កើត ៖ `03` ➜ `04` ➜ `05` ➜ ស្កេនបញ្ហា `30` ដែល `scanTime` មុន `05` តែមក **ក្រោយ**) ➜ ទំព័រដែលបាត់ = ថ្មីៗ។
  ការរចនា ៖ តាមថ្ងៃតែពេលលើសពិដាន (ហៅធម្មតានៅ ១) · Function `signed=1` លែងពង្រីក `to` ដល់ថ្ងៃនេះ (ការអះអាង «App ផ្ញើ `to` = ថ្ងៃនេះជានិច្ច» **ខុស** ៖ ប្រអប់បញ្ជីផ្ញើ `to` ដែលអ្នកប្រើជ្រើស ➜ F1 ៖ `signed=1` ពង្រីកវិញ · ការអានតាមថ្ងៃប្រើ `exact=1`) · companion
  `withSigned=1` នៅពង្រីក · ថ្ងៃមួយ > ៣០០ ➜ `truncated` (មិនពេញលេញ ➜ E1 រង់ចាំតាមពិដាន · ចន្លោះទ្វេ · toast ម្តង)។ mutation ១០/១០ (គ្មានការបំបែក · ព្រមគ្នាគ្មានពិដាន ·
  ថ្ងៃធ្លាក់មិន partial · truncated បាត់ · ចន្លោះមិនទ្វេ · toast ៖ មិនកំណត់ឡើងវិញ/រាល់ជុំ/គ្មាន · ថ្ងៃគ្មានពិដាន · ថ្ងៃចុងមិនរាប់)។ ⛔ ប្រអប់បញ្ជី (`withSigned=1`) នៅប្រាប់
  «ទាញបានមិនគ្រប់» ពេលលើសពិដាន (មិនបំបែក · ការបិទស្វ័យប្រវត្តិបំពេញ)។
- **ZTO-E8 (ទិន្នន័យពិត)** ៖ ម្ចាស់គម្រោងចម្លង payload Argus ៣ (កញ្ចប់យករួច ៖ ក្នុងស្រុក `agentAmount 185` · ចិន `fcAmount 2.5` · Shopee វៀតណាម `agentAmount 3.16`
  មានស្កេនបញ្ហា `30`)។ វាស់ ៖ ជួរដេក `05` «ចុះហត្ថលេខា» មាន `signMan` · ជួរដេកទាំងអស់ **គ្មាន** `billStatus` (ចម្លើយសំណួរ E2 ៖ សាលក្រមជួរដេក = `null` ជានិច្ច ➜ ក្នុងទិន្នន័យពិត
  E2 មុនកែមិនផ្ទុះពីជួរដេកទេ តែពី `/detail` probe ក៏មិនផ្ទុះដែរ ព្រោះជួរដេកមានភស្តុតាងមិនត្រូវ probe ➜ E2 = ភាពស៊ីសង្វាក់) · Shopee ៖ មកដល់ 10-04 · ចុះហត្ថលេខា 10-05 ➜
  companion ត្រូវពង្រីកដល់ថ្ងៃនេះ (ត្រូវ) · លំដាប់តាម `id` មិនមែន `scanTime`។ ចាក់សោជា fixture (`zto-list-sync-test` ផ្នែក ២២) ៖ ឈ្មោះ · លេខទូរស័ព្ទ · អាសយដ្ឋាន · barcode ·
  ឈ្មោះបុគ្គលិក ប្តូរជាក្លែង (repo នឹងជាសាធារណៈ) តែទម្រង់ដូចពិត។
  សំណួរម្ចាស់គម្រោង «វាលដែលត្រូវការក្នុង ZoeW បានកត់ក្នុង ZTO-SETUP-KH.md អស់នៅ?» ➜ វាស់ ៖ ខ្វះ `scanBillCode` · `scanTime` (និងជម្រើសបម្រុង) ➜ តារាង «📋 វាលដែល ZoeW
  អានពីជួរដេកបញ្ជី ZTO» + អ្នកយាមដេរីវេពីកូដ (`zto-list-sync-test` ៖ រាល់ឈ្មោះក្នុង `BARCODE_PATHS` · `PHONE_PATHS` · `LIST_TIME_PATHS` · `LIST_SCAN_*` · `LIST_SITE_NAME_PATHS` ·
  COD/DOD ទីមួយ ត្រូវមានក្នុងតារាង · probe ដក `scanDate` ➜ ធ្លាក់)។
- **ZTO-E8ខ (ទិន្នន័យពិត ៖ កញ្ចប់ត្រឡប់)** ៖ ម្ចាស់គម្រោងចម្លង payload កញ្ចប់ដែលត្រឡប់ទៅសាខាកណ្តាលវិញ លើស ៧ ថ្ងៃ ៖ `scanTypeCode: "-710"` · `scanTypeDesc: "ត្រឡប់ការស្កេន"` ·
  `isRefund: 1` (`isRefundDesc: "ត្រូវហើយ"`) · Shopee · គ្មាន `05`។ វាស់ ៖ ✅ Function មិនចាត់វាជាភស្តុតាង «ចុះហត្ថលេខា» (ជាន់កូដ និងជាន់អត្ថបទ ម្នាក់ៗបដិសេធវាដោយខ្លួនឯង) ·
  មិនមែនជួរដេក «មកដល់» (`otherScans`) ➜ ZoeW មិនបិទ «យករួច» ➜ ការសម្អាត ៧ ថ្ងៃ (`expired` · ដកលុយ) ក្រោយការរង់ចាំ E1 = ច្បាប់អាជីវកម្ម (កញ្ចប់មិនយកត្រឡប់ទៅសាខាកណ្តាល)។
  ⛔ គ្មានការកែកូដ។ ចាក់សោជា fixture (`zto-list-sync-test` ផ្នែក ២២ «E8ខ» ៖ ជួរ -710 តែមួយដូចម្ចាស់ចម្លង · មកដល់ 03 + ត្រឡប់ -710 · ជាន់កូដតែម្យ៉ាង ➜ ៧ ok) ·
  mutation ២/២ ត្រូវសម្លាប់ (កូដណាក៏ដោយក្រៅពី «មកដល់» = ចុះហត្ថលេខា · កូដអវិជ្ជមានរំលងជាន់កូដ — រស់ដំបូងព្រោះជាន់អត្ថបទការពារ ➜ បន្ថែមករណីជាន់កូដតែម្យ៉ាង)។
- ⚠️ បរិស្ថាន session ៖ ចម្លង repo សម្រាប់ CI មូលដ្ឋានក្នុង `/tmp/claude-0/…` (mode 700) ➜ Postgres ពិត (`initdb` រត់ជាអ្នកប្រើមិនមែន root) ផ្ទុក `libicuuc.so.60` មិនបាន ➜
  ត្រូវដាក់ច្បាប់ចម្លងក្រៅថតនោះ · clone រាក់ (`--is-shallow-repository = true`) ➜ `zoew-suite`/`zoew-parity` ធ្លាក់ «រកប្រវត្តិ ZoeW/app.js មិនឃើញ» ➜ `git fetch --unshallow` មុន CI។

### 2026-10-06 — ZTO ៖ កញ្ចប់ក្មេងដែល ZTO បិទរួចចូលជា «មិនទាន់យក» · ទំព័របញ្ជីមួយៗ · ZTO Palm រង់ចាំរហូត ១ ម៉ោង (➜ [2.50.0])

- **ចន្លោះ (វាស់លើកូដ មិនមែនទ្រឹស្តី)** ៖ `classifyZtoListRows()` ដាក់ `closedAtZto` **តែលើជួរដេកចាស់** (`ageState === 'old'`) ➜ ជួរដេកក្មេងដែល ZTO បិទរួច
  (សាលក្រម `true`) ចូលជា «មិនទាន់យក» ➜ ស្ថិតិយកមិនចុះ ទាល់តែ «បិទតាម ZTO ស្វ័យប្រវត្តិ» ឈានដល់វា (១០/ជុំ · ពិនិត្យកញ្ចប់បើកម្តងៗ ១ ម៉ោង) ឬបិទដោយដៃ ·
  កុងតាក់បិទ ➜ **មិនដែលចុះ** (៨ ថ្ងៃក្រោយ ➜ `expired` ➜ **ដកលុយ** ទោះអតិថិជនយករួច)។ អ្នកយាមចាស់ **ចាក់សោចន្លោះនេះ** ជាទិសផ្ទុយ («ជួរដេកក្មេងមិនត្រូវសម្គាល់
  `closedAtZto`») ➜ ការអះអាងនោះប្តូរតាមសំណើម្ចាស់គម្រោង (ទិសផ្ទុយថ្មី ៖ `false`/`null` ➜ មិនបិទ)។
- **ល្បឿន** ៖ `runZtoListSyncPreview()` ទាញទំព័រ ១ ➜ ២ ➜ ៣ **មួយៗ** · `resolveZtoListSignedVerdicts()` សួរ `/detail` មួយៗ (≤ ២០ × ~០.៨ វិ.)។
- **ភស្តុតាង** ៖ barcode តែមួយលេចជា `03`/`04`/`05` (វាស់លើ payload ពិតពីមុន) ➜ ស្កេន `05` «ចុះហត្ថលេខា» ជាកំណត់ត្រា ZTO Palm ផ្ទាល់ ➜ ១ សំណើ
  ជំនួស N ការសួរ `/detail`។ ⛔ **វាស់ពិតមិនបាន** ៖ session ហៅ ZTO មិនបាន ➜ ការពិតដែលទទួល ៖ ម្ចាស់គម្រោងបញ្ជាក់ `scanTypeCode: "03"` · `scanTypeDesc: «អីវ៉ាន់មកដល់»` ·
  `scanSite: «Mer SorChrey»` ក្នុងជួរដេកពិត · ✅ ន័យ «ចុះហត្ថលេខា = បិទបញ្ជី» បញ្ជាក់ដោយម្ចាស់គម្រោង ➜ កូដ `05` ជាលំនាំដើមដែលប្តូរបាន (`ZTO_LIST_SIGNED_SCAN_TYPE` · `off`) ហើយភស្តុតាងទាមទារជាន់ ២ មិនផ្ទុយ
  (កូដ `05` + អត្ថបទ «មកដល់» ➜ មិនបិទ)។ សកម្មភាពដោយដៃ [2.50.0] ទី ២ ផ្ទៀងលើ Argus។
- **ការរចនាដែលរក្សាការហៅ ZTO** ៖ ភស្តុតាងរត់ **ស្របគ្នាក្នុងការហៅ Function តែមួយ** (companion) មិនមែនសំណើ client ទី ២ ➜ App ចាស់ (គ្មាន `withSigned`)
  នៅ ១ ការហៅ upstream · companion ធ្លាក់ ➜ `signedOk:false` ហើយ **មិន cache** (វាស់ ៖ ការហៅទី ២ `cached:false`)។
- លេខ ៖ `zto-list-sync-test` ៣៨៤ ➜ **៤២៣ ok** (មុនកែ ៣៨ FAIL មានឈ្មោះ) · vitest ថ្មី ១២ (មុនកែ ១០ FAIL) · `parity-deep` ZTO ១៣/១៣។
- **ការផ្ទៀងផ្ទាត់ឡើងវិញ (សំណើម្ចាស់គម្រោង ៖ «ក្រែងមាន race · ចន្លោះ ឬស្ទួន»)** ➜ រកឃើញ ៣ ចំណុចពិត ហើយវាស់ជាមុនសិន (តេស្តធ្លាក់លើ commit `ebd05cf`) ៖
  (១) **race Cookie** ៖ សំណើ «ចុះហត្ថលេខា» (companion) ប្រើ `session` ដដែល តែ handler `await` វា **ក្រោយ** `flushCookieRenewal()` ➜ BOS-MAN-SESSION
  ដែល ZTO បង្វិលក្នុងចម្លើយរបស់វាចុះលើ `session.renewal` ហើយ **មិនដែលសរសេរ** (store ៖ `[]`) · probe ទិសផ្ទុយ ៖ ការបង្វិលក្នុងចម្លើយ «មកដល់» សរសេរបាន ➜
  ឥឡូវ `await` companion មុន flush · (២) **ការលេចធ្លាយឆ្លងវគ្គ** ៖ `fetchZtoListAllPages()` សរសេរភស្តុតាងចូល `ztoListSignedEvidence` **មុន** អ្នកហៅពិនិត្យ
  `session.current()` ➜ ចម្លើយយឺតរបស់វគ្គដែលចាកចេញ ដាក់ «បិទរួច» លើជួរដេករបស់ការទាញថ្មី (`has(...) === true`) ➜ ឥឡូវវាត្រឡប់ `signed` ហើយអ្នកហៅកត់ក្រោយការពិនិត្យ ·
  (៣) **ចន្លោះធៀបច្បាប់ចាស់** ៖ ជុំ «ចុះហត្ថលេខា» បិទកញ្ចប់ដែលអ្នកប្រើទើបបើកវិញ រៀងរាល់ ២ នាទី ខណៈការសួរម្តងមួយកញ្ចប់រង់ចាំ `ZTO_OPEN_RECHECK_MS` ➜ ឥឡូវ
  `ztoSignedCloseIsHeld()` (សាលក្រម `true` ថ្មី ➜ រង់ចាំ · ចុច «ពិនិត្យម្តងទៀត» ➜ បិទ) · ⛔ ទិសផ្ទុយ ៖ សាលក្រម `false` ថ្មី + ស្កេនចុះហត្ថលេខាថ្មី ➜ **បិទ** (អតិថិជនទើបយក)។
  វាស់ ៖ vitest ១៦ (មុនកែ ២ FAIL) · `zto-list-sync-test` ៤២៩ ok (មុនកែ ១ FAIL)។ ⛔ **មិនកែ (ត្រូវការការសម្រេចអាជីវកម្ម)** ៖ កញ្ចប់ដែលចូលធុងសំរាមជា `expired`
  (ដកលុយរួច) តែមានក្នុងបញ្ជី «ចុះហត្ថលេខា» ➜ ក្រុម «មានរួច» ➜ មិនប៉ះ (ការស្តារ = ប្តូរលុយ)។
- **ការផ្ទៀងផ្ទាត់ជុំទី ២ + សោ (សំណើម្ចាស់គម្រោង ៖ «ZTO សំខាន់ · បើវាលែងមានបញ្ហា ចាក់សោវា»)** ៖ រកឃើញ **១ ចំណុចពិត** ៖ **ជួរអត់ឃ្លាន / ការសាកឡើងវិញរៀងរាល់ ២០ វិ.** —
  ពេល barcode ក្នុងបញ្ជី «ចុះហត្ថលេខា» លើស ១០ ហើយ ១០ ដំបូងបិទមិនបានជានិច្ច (`applyBarcodeCloseChange()` ➜ `false`) ជុំនីមួយៗសាក ១០ ដដែល ហើយមិនដែលដល់
  ដែលនៅសល់ (មុនកែ ៖ ជុំទី ២ សាក `Array(10)` ដដែល)។ មូលហេតុ ២ ជាន់ ៖ ការបរាជ័យមិនកត់សាលក្រម · រង្វិល `/detail` ក្នុងជុំដដែលសួរ barcode នោះម្តងទៀត ហើយ
  **សរសេរជាន់** `true` ដោយ `null` ➜ ការរង់ចាំបាត់។ ឥឡូវ ៖ រាល់ការព្យាយាមដែលមានចម្លើយច្បាស់ (បិទបាន ឬបរាជ័យ) កត់ `true` ហើយរង្វិល `/detail` រំលងវា។
  អ្នកយាមបន្ថែម (ចន្លោះគ្របដណ្តប់) ៖ ពិដាន ១០/ជុំ + ជុំបន្ទាប់ · ជួរថ្ងៃ (៧ ថ្ងៃ ➜ ១ ថ្ងៃ) · ចន្លោះទ្វេពេលបណ្តាញធ្លាក់។ vitest ២០ (មុនកែ ១ FAIL)។
  **សោ** ៖ `ZoeW/tests/zto-lock.test.ts` ចាក់សោ sha256 នៃឯកសារ ZTO ៦ (Function · `zto-list-sync.ts` · `zto-status.ts` · `zto/model.ts` · `ZtoListSyncBody.tsx` ·
  `ZtoListSyncModal.tsx`) + `CLAUDE.md` «Locked zone — ZTO» (កែតែពេលម្ចាស់គម្រោងស្នើផ្ទាល់) · mutation ថេរមួយ ➜ ធ្លាក់។
- **ការផ្ទៀងផ្ទាត់ជុំទី ៣ (សំណើម្ចាស់គម្រោង ៖ «ផ្ទៀងផ្ទាត់ឡើងវិញ ស៊ីជម្រៅ»)** ៖ រកឃើញ **៣ ចំណុចពិត** វាស់ដោយអ្នកយាមដែលធ្លាក់មុនកែ (checker ៤ · vitest ២) ៖
  (១) **ថង់ Cookie (Function)** ៖ ចម្លើយទី ២ ដែលមានតែ Cookie បន្ទាប់បន្សំ (`sidebarStatus`) បូកពី `session.cookie` ចាស់ ➜ **លុប BOS-MAN-SESSION** ដែល ZTO ទើបបង្វិល
  ក្នុងចម្លើយទី ១ (មុនកែ ៖ store = session ចាស់) ➜ ឥឡូវ `noteCookieRenewal()` បូកពី `session.renewal || session.cookie` (តាមលំដាប់មកដល់ ដូច browser)។
  (២) **ការបញ្ចូលបញ្ជី** ៖ claim/save ព្យួរលើជួរដេកថ្មី **ចុងក្រោយ** (`notTried = 0`) មិនឈប់រង្វិលបិទកញ្ចប់ដែលមានស្រាប់ ➜ ឥឡូវ `stalled` ឈប់វា («មិនទាន់បិទ N» · បញ្ជីនៅ)។
  (៣) **ជុំបិទតាម ZTO** ៖ ទំព័របញ្ជីចុះហត្ថលេខាទី ២ ធ្លាក់ ➜ `Promise.all` បោះចោលភស្តុតាងទំព័រ ១ ទាំងអស់ (ទំព័រធ្លាក់ជានិច្ច ➜ មិនបិទអ្វីសោះ) ➜ ឥឡូវប្រើទំព័រដែលបាន
  (`partial` ➜ មិនកត់ «វាស់គ្រប់» · ចន្លោះទ្វេ) · ចន្លោះទ្វេក្រោយជុំ «នៅសល់» (`wait = 1`) ក្លាយជា **2 ms** (វាស់) ➜ `ztoSignedSweepBackoffMs()` ចាប់ពី `ZTO_SIGNED_SWEEP_GAP_MS`។
  សោ `LOCK` ធ្វើបច្ចុប្បន្នភាពតាមសំណើនេះ។ ⛔ នៅបើក (ការសម្រេចអាជីវកម្ម) ៖ កញ្ចប់ `expired` ក្នុងធុងសំរាមដែលមានក្នុងបញ្ជីចុះហត្ថលេខា (ឧ. App បិទច្រើនថ្ងៃ ➜ ការសម្អាត ៧ ថ្ងៃរត់មុនជុំបិទ)។
- ⛔ អន្ទាក់ harness ៖ `vi.mock(..., importOriginal)` លើ `barcode-ops` ➜ ការនាំចូលរង្វង់ (`zto-status` ↔ `barcode-ops`) ផ្ទុកម៉ូឌុលពិតមុន mock ➜ mock មិនដល់
  `autoCloseBarcodeFromZto()` ➜ factory ដោយគ្មាន `importOriginal` · `restoreMocks: true` កំណត់ `vi.fn(impl)` ឡើងវិញ ➜ ប្រើ function ធម្មតា។

### 2026-10-06 — APK workflow លើ `windows-latest` ៖ CRLF មិនមែន repo ជាសាធារណៈ (➜ [2.49.6])

- ម្ចាស់គម្រោងគិតថា APK workflow ធ្លាក់ព្រោះដាក់ repo ជាសាធារណៈ។ វាស់ ៖ checkout ដោយ `core.autocrlf=true` (លំនាំដើម Git for Windows) ➜
  `android-check` 93 ok/1 FAIL (អត្ថបទ xml/svg មាន `\r\n`)។ គ្មាន `.gitattributes` ពីមុន ➜ tree លើ Windows ខុសពី Linux CI ➜ CI ក្នុង session
  មិនអាចឃើញ។ ការកែពីរជាន់ ៖ `.gitattributes` (`eol=lf`) + អ្នកអានក្នុង `android-check.mjs` ធ្វើឲ្យ CRLF ➜ LF (ការពារ checkout ចាស់ដែលមាន CRLF រួច)។
- អ្នកយាម ៖ `repository-contract-test` clone ពិតដោយ `core.autocrlf=true`។

### 2026-10-06 — LICENSE · NOTICE មុនដាក់ repo ជាសាធារណៈ (សំណើម្ចាស់គម្រោង · ឯកសារតែប៉ុណ្ណោះ · គ្មានការឡើងកំណែ)

- **LICENSE** (ម្ចាស់គម្រោងយល់ព្រម) ៖ ឃ្លាលើកលែង GitHub Terms of Service (មើល/fork លើ GitHub បាន · គ្មានសិទ្ធិប្រើ ដំណើរការ កែ ចម្លងក្រៅ GitHub ឬចែកចាយ ·
  fork នៅក្រោម LICENSE · ការដាក់ជាសាធារណៈមិនបោះបង់សិទ្ធិ) · ការហាមថ្មី ឆ/g «build · ដំណើរការ · deploy · host ពី source» · ជ/h «ជៀសវាង/បិទ Activation Key ·
  យន្តការការពារ»។ ឈ្មោះ «MENGSROY HEN» ម្ចាស់គម្រោងបញ្ជាក់ថាត្រឹមត្រូវ។
- **NOTICE មិនពេញលេញ (វាស់ពី bundle ពិត)** ៖ LICENSE ផ្នែក ៦ ប្រកាសថា NOTICE ជា «បញ្ជីពេញលេញ» តែ build ផលិតកម្ម ship ៖ supabase-js 2.117.2 + `@supabase/phoenix`
  (chunk `supabase-backend` ៖ `GoTrueClient` · `RealtimeClient` · `phx_join`) · Capacitor 8.x (bundle + APK) · `@capgo/capacitor-native-biometric` ·
  `@capgo/capacitor-printer` (**MPL-2.0** ៖ chunk `native-plugins` + APK) ➜ គ្មានក្នុង NOTICE។ repo ក៏មាន SQL ពី Supabase (`audit-tools/supabase-shim/`) និង Gradle Wrapper
  (Apache-2.0) ដែលនឹងចែកចាយពេលសាធារណៈ។ ឥឡូវ NOTICE រាយ ៨ ធាតុ ship + ២ ក្នុង repo + ពាណិជ្ជសញ្ញា (logo Firebase/Supabase ពី Simple Icons CC0) ·
  `LICENSES/MPL-2.0.txt` (អត្ថបទពេញពី npm) · កំណែចាស់ក្នុង NOTICE (`@netlify/blobs` 11.0.2 ➜ 11.1.3 · `playwright-core` 1.62.1 ➜ 1.63.0) កែ។ Firebase SDK ផ្ទុកពី CDN (មិន ship)។
- **ស្កេន git history ទាំងមូល (១០៨៣ commit · គ្រប់ branch)** មុនសាធារណៈ ៖ គ្មាន private key/service account/`sb_secret_`/token GitHub·Netlify/JWK ឯកជន ·
  PEM មួយ = key សាកល្បងក្នុង `audit-tools/idtoken-fixture.js` (មិនមានអ្វីទុកចិត្តវា) · `BOS-MAN-SESSION=` ទាំង ៥៥ ជាតម្លៃក្លែង · URL Project ពិតតែមួយ = License Project
  (`zoew-z1`) ដែល ship ក្នុង `license-verify.js` រួចហើយ។ ⚠️ អ៊ីមែលអ្នក commit (២) នឹងលេចជាសាធារណៈ · `CLAUDE.md`/`docs/` ពិពណ៌នាការការពារលម្អិត។

### 2026-10-06 — Deep audit ជុំ ៣ ៖ Config ➜ Login ➜ Signup (ការកែ ➜ ផ្នែក ១ [2.49.5])

- **R3-G1 (ចំណុច ២)** ៖ ថ្នេរ App ↔ Edge Function មិនដែលវាស់ជាមួយកូដ Function ពិត (តេស្តមុនប្រើកូដឆ្លើយដែលតេស្តសរសេរ) ➜ តេស្តថ្មីភ្ជាប់ `routePendingInvite()` ·
  `submitRegisterForm()` ពិតទៅ `handleRegister()` ពិត (transpile ពី `supabase/functions/_shared/` ក្នុង vitest ព្រោះ tsconfig ZoeW (`strictNullChecks: false`)
  ពិនិត្យប្រភេទកូដ Function មិនបាន) ➜ `main` **ធ្លាក់ ៤/១០** ៖ Function មិនឆ្លើយ ៤ របៀប + ឧបករណ៍គ្មានការចងចាំ ➜ ប្រអប់ចុះឈ្មោះ សម្រាប់ហាងដែលមានគណនីរួច។
  ឫសគល់ ៖ verdict `unknown` លាយ «Function ចាស់មិនស្គាល់ `check`» (ចុះឈ្មោះបាន) ជាមួយ «Function មិនឆ្លើយ» (ចុះឈ្មោះមិនបាន) ➜ បំបែកជា `no-check` · `unknown`។
- **Push APK ជាប់ `no-account` (របាយការណ៍ម្ចាស់គម្រោង · រូបថត)** ៖ ការវិភាគរូប ៖ «📤 កញ្ចប់ដែលដករួច» ជាសាលក្រមវាស់បាន (ទិដ្ឋភាព deleted ស្រស់) ➜ ចូលប្រព័ន្ធរួច ➜ ផ្នែក Push
  ខុស។ ផ្លូវតែមួយដែលកំណត់ `no-account` ដោយអ្នកប្រើមិនបានចុច ៖ `onNativeToken()` (`registration` របស់ FCM មកពេលណាក៏បាន) · ការផ្ទៀងស្ថានភាពមានតែពេល boot/ត្រឡប់ពី
  background ➜ តេស្ត `main` **ធ្លាក់ ២** ➜ ការកែ ៖ token ពេលគ្មានអត្តសញ្ញាណ = រង់ចាំ · ការចូល = ផ្ទៀង + ចុះឈ្មោះ។ Mutation ៥/៥។
- **announcements ចំណុចបាត់ស្ងាត់** ៖ `sanitizeFeed()` កាត់ `points` ត្រឹម ១២ · ឯកសារ `main` មាន ២០ ➜ ៨ មិនដែលបង្ហាញ (តេស្ត «គ្មានធាតុបាត់ស្ងាត់» រាប់តែ item)។
- **ចំណុច ៤ ៖ Server** — គណនីគ្មានហាង (GoTrue sign-up ផ្ទាល់) ➜ `forbidden`/០ គ្រប់ផ្លូវ (វាស់ ៖ គ្មានរន្ធ) · guard tenant null របស់ `zoe_read` គ្មានអ្នកវាស់ (mutation រស់ ➜ ឥឡូវចាប់) ·
  guard `zoe_write` ជាន់ ២ (wrapper + `zoe_apply` ➜ ដកតែមួយ = probe ទិសផ្ទុយបៃតង) · `register` + `check` ៖ mutation ៥ មានរួច។ live ៖ `supabase.co` ត្រូវ network policy
  បិទ (403) ➜ «Allow new users to sign up» វាស់មិនបាន · Security Advisor ៖ គ្មានរឿងថ្មី។
- **ចំណុច ៣ (វាស់ ៖ គ្មាន)** ៖ ការចងចាំគណនីចងនឹង `fb:<databaseURL>`/`sb:<supabaseUrl>` · ពាក្យសម្ងាត់ចងនឹង scope + ឈ្មោះតាម AAD របស់ AES-GCM (scope ផ្សេង ➜ បកកូដមិនចេញ) ·
  តេស្តមាន (`remember-password.test.tsx` · `login-routing.test.tsx`)។
- **ចំណុច ៥ (វាស់ ៖ គ្មាន)** ៖ Reconfig ទៅ Project Supabase ផ្សេង + session ចាស់ក្នុង storage (G5) ➜ `claimSessionStorageFor()` លុប session + ព័ត៌មានហាង · mutation ៣/៣ ចាប់
  (`login-routing` · `supabase-offline-restore` · `supabase-signout-offline`)។

### 2026-10-05 — Audit ពិត ៤ runner៖ workers ខាងក្នុង និង log របស់អ្នកយាមដែលធ្លាក់

- **ភស្តុតាងពិត**៖ Audit `37321763097` លើ `f854152` ចាប់ផ្ដើម shard ទាំង៤ព្រមគ្នាលើ Zoe-WSL-Audit-1 ដល់ 4 ហើយចប់ក្នុង ១០នាទី៤៨វិនាទី។ Chromium/RTDB cache ប្រើ ០–១វិនាទី។ Shards 1/4 និង 4/4 ឆ្លងពេញ; 2/4 ធ្លាក់ `money-guardian` ព្រោះ `tx-outcome` កូនធ្លាក់៤លក្ខខណ្ឌលើ clean tree ហើយ mutation ពីរមិនអាចផ្ទៀងបាន។ Log ចាស់លាក់ឈ្មោះ៤លក្ខខណ្ឌនោះ។ Shard 3/4 ឆ្លង `tx-outcome` ទាំង៩២ ប៉ុន្តែ parity DOM desktop វាស់ `.app-card` កម្ពស់ 307 ទល់ 295px; live/deep ឆ្លង។ នេះមិនមែន all-pass ទេ។ GitHub-hosted reference `37271570634` ចប់ក្នុង ៩នាទី៦វិនាទី។
- **ការកែ**៖ self-hosted កំណត់ `MONEYGUARD_JOBS=2` និងផ្ញើ Vitest `--maxWorkers=2` តាម zoew-suite ដើម្បីសមនឹង Compose CPU quota ២។ GitHub mode រក្សា auto; shards ទាំង៤, lanes ២, browser ១, STRICT ទាំង៥ និង CHECKER_TIMEOUT នៅដដែល។ Money guardian បង្ហាញ failed assertions របស់ clean child; workflow កត់ cgroup CPU/RAM ដើម្បីវាស់ quota, throttling និង OOM។ Parity DOM រង់ចាំ boot/fonts និង geometry ស្ថិតស្ថេរ មុនប្រៀបធៀបដដែល; បើនៅខុស បង្ហាញ rect/font នៃធាតុកូន។ មិនបន្ថែម tolerance ឬរំលង card ទេ។
- **អ្នកយាម**៖ worker contract រត់ wrapper ពិតទល់ npm CLI capture៖ មុនកែឆ្លង១/ធ្លាក់៣ ➜ ក្រោយកែឆ្លង៤/ធ្លាក់០។ Vitest CLI ពិតលើតេស្ត tx-outcome-timeout និង ledger-not-applied-retry ជាមួយ workers ២ ឆ្លង១០តេស្ត។ Repository file coverage ឆ្លង១០; YAML និង Bash steps ឆ្លង។ Direct repository-contract លើ root ឆ្លង៧៣/ធ្លាក់១ ព្រោះ SheetJS vendor មាននៅ measure tree ប៉ុណ្ណោះ។ Full STRICT ក្នុង session ឈប់នៅ Chromium executable បាត់។ Probe checker/clean guardian ក្រោម CPU pressure មិនបានបង្កើត child failure៤ឡើងវិញទេ; មិនទាន់បញ្ជាក់ថាបញ្ហាទាំងពីរបណ្តាលពី timing ឬថាការកែនេះឆ្លង browser ពិតឡើយ។ ត្រូវផ្ទៀង Audit ថ្មីទាំង៤លើ PC មុនអះអាង all-pass។
- **សកម្មភាពដោយដៃ**៖ source/workflow changes ទាំងនេះមិនត្រូវ rebuild image ឬ register ឡើងវិញ។ ទុក runners ទាំង៤ Online និងមើល Audit ដែលចាប់ផ្ដើមពី commit ថ្មី។ បើ child ឬ parity នៅធ្លាក់ សូមអាន failed assertions និងបរិបទ layout ថ្មី; កុំបិទ money guards ដើម្បីឱ្យបៃតង។ គ្មានការកែ App code, APP_VERSION ឬ Firebase rules។

### 2026-10-05 — Self-hosted shard 3/4៖ `tx-outcome` វាស់មុនការអានដល់ចំនួនចាំបាច់

- **ភស្តុតាងពិត**៖ Audit `37316299995` attempt 2 លើ `7eeb533`៖ shards 1/4, 2/4 និង 4/4 ឆ្លង; 3/4 ធ្លាក់តែ `tx-outcome`។ ករណី ledger ខែ applied-disconnect វាស់ `status: null, rest: 27` ក្រោយ 500ms ខណៈ assertion ទាមទារ `rest > 30`។ ក្រោយបណ្តាញត្រឡប់ ថ្ងៃ/ខែ 95 និង count 19 ត្រឹមត្រូវ; មិនដកស្ទួន ហើយគ្មាន Sentry outcome unknown។ App code មិនប្រែពី main `90aa66c`។
- **បញ្ជាក់មូលហេតុ**៖ រត់ករណី ledger ទាំង៤ពី checker ពិត ដោយទាញ function ពី `ZoeW/dist-audit/ZoeW/app.js` ដែល build-audit បង្កើត។ App SHA-256 `2bbd4b8f9d83ba6e30264307b724a3d8ae51747e3e57eaa57724748f628632ef` ដដែល៖ timer ធម្មតា ១២ឆ្លង/០ធ្លាក់; ពន្យារ timer ខ្លីទៅ 18ms បាន ៨ឆ្លង/៤ធ្លាក់ (`rest` 19–28) តែលទ្ធផលលុយនៅត្រឹមត្រូវទាំង៤។ នេះបញ្ជាក់ថា fixed wait អាចធ្វើឱ្យតេស្តធ្លាក់ដោយមិនកែ App; មិនបានវាស់ CPU pressure ពិតរបស់ Windows នៅពេលធ្លាក់ទេ។
- **ការកែ**៖ checker រង់ចាំ state ពិត៖ អានលើស៣០ដង ឬលទ្ធផលចប់ ដោយមានពិដាន ៥វិនាទី; ការងើបវិញរង់ចាំលទ្ធផលចប់។ រក្សា `rest > 30`, pending, ledger និង Sentry assertions ដដែល។ Timer អប្បបរមា 20ms ក្នុងករណីនេះចាក់សោការមិនពឹងលើ 500ms ទោះ host លឿន។ មិនកែ App, APP_VERSION, shards ទាំង៤, STRICT flags ឬ CHECKER_TIMEOUT។
- **អ្នកយាម**៖ checker ចាស់ជាមួយ timer floor 20ms ធ្លាក់៥/ឆ្លង៨៧; ក្រោយកែឆ្លង៩២លក្ខខណ្ឌលើ generated code view។ Checker ថ្មីក៏ឆ្លងទាំង៩២ពេលពន្យារ timer ខ្លីទៅ18ms។ Mutation នៅស្រមោល generated App៖ បង្ខំ resolver បោះបង់ក្រោយ៣០ការអាន ធ្លាក់២២/ឆ្លង៧០ រួមការដកស្ទួនទៅ90 និងបាត់ barcode; test មិនលាក់ regression ពិត។ Full STRICT run-all ក្នុង session ឈប់នៅ Chromium executable បាត់; មិនអះអាងថា generated tree ទាំងមូល ឬ Windows/WSL ពេញឆ្លង។ PR នៅ Draft សម្រាប់ការផ្ទៀង Audit ពិតលើ runners ម្ចាស់។
- **សកម្មភាពដោយដៃ**៖ ការកែ checker មិនត្រូវ rebuild image/register runner ឡើងវិញ។ សាក run លើ commit ថ្មី; rerun លើ run ចាស់នៅប្រើ checker ចាស់។ មើល assertions ពិតបើមានការធ្លាក់ផ្សេង។

### 2026-10-05 — Audit ៤ runner៖ Chromium/RTDB cache រួម និង conditional download

- **ភស្តុតាង**៖ Audit `37300701337` attempt ២លើ `120f14e` ផ្ទៀង Node/Java ឆ្លងក្នុង ០–១វិនាទី។ Chromium install ចំណាយ ២៥:០១, ៣០:៥៨, ៣១:១៩ និង ៤៦:២១នាទី; log ទាញ Chrome 186.8 MiB + FFmpeg 2.3 MiB + Headless Shell 114.3 MiB ដាច់ៗ runner ទាំង៤។ RTDB download លើ runner ២ចំណាយ ២៣:២៩នាទី; run-all ផ្នែក ២ចាប់ផ្ដើមក្រោយ setup ជាង ៥៤នាទី ហើយ run ត្រូវ cancelled ជិតពិដាន ៦០នាទី។ Source firebase-tools pin `15.32.1` បញ្ជាក់ `setup:emulators:database` ហៅ download ដោយគ្មាន cache-exists guard; ការអះអាងថាយឺតតែលើកដំបូងមិនត្រូវសម្រាប់ command នេះ។ មិនបានវាស់ bandwidth ឬបញ្ជាក់មូលហេតុ cancellation ពី API ទេ។
- **ការកែ**៖ Docker image/Compose ផ្ដល់ `audit-binaries` volume រួមនៅ `/opt/zoe-cache`; home/workspace និង emulator network/port នៅដាច់ពីគ្នា។ Helper ចម្លង browser ដែលមាន INSTALLATION_COMPLETE និងយក JAR ចាស់ជាបេក្ខជន។ flock សៀរឡើងតែ install/download; run-all ទាំង៤នៅស្របគ្នា។ Playwright រក្សា browser revisions ដើម្បីមិនលុបឯកសារដែល run ផ្សេងត្រូវការ។ RTDB ផ្ទៀង filename/size និង SHA-256 (ឬ MD5 តាម metadata) ពិតក្នុង firebase-tools ដែល npm ci ដំឡើង ហើយហៅ setup តែពេល cache ខុស/បាត់។ JAR ដែលបើកយកតាម metadata ដដែល មិនមែន glob យកកំណែចាស់។ Firebase CLI versions ប្រើថតដាច់ដើម្បីការពារ cleanup លុប JAR របស់ run ផ្សេង។ GitHub mode មិនទាមទារ Docker cache ហើយ npm install របស់ audit ប្រើ prefer-offline ផង។ មិនឡើង APP_VERSION និងមិនកាត់ shards/STRICT flags។
- **អ្នកយាម**៖ repository-contract-test រត់ helper ពិតទល់ download fixtures និង runner ៤ស្របគ្នា៖ lock, reuse browser/JAR ក្នុង home ឬពី runner ផ្សេង, checksum ខុសទោះទំហំដូចគ្នា, repair ម្ដង, warm cache គ្មាន download, install fail, image ចាស់គ្មាន config និង GitHub home fallback។ មុនកែ ១៨ឆ្លង/២ធ្លាក់; ក្រោយកែ runner/runtime/cache/registration focused ៣០ឆ្លង/០ធ្លាក់។ Full STRICT run-all ត្រូវបានសាក ប៉ុន្តែ build វាស់ឈប់ដោយគ្មាន `/opt/pw-browsers/chromium` ក្នុង session; Docker mount ownership និងពេលវេលាពិតនៅត្រូវផ្ទៀងលើ PC។
- **សកម្មភាពដោយដៃ**៖ Update branch, rebuild image ដោយរក្សា Docker layers, recreate containers ដោយរក្សា home volumes, ផ្ទៀង volume ឈ្មោះដូចគ្នា ៤ដង និង cache writable តាម [ជំហានទី ១៧](SELF-HOSTED-RUNNERS.md)។ Run ថ្មីដែលចាប់មុន update image នឹងឈប់មុន download ហើយបង្ហាញវិធី update។ សាក commit ថ្មីនៃ PR បន្ទាប់ពី runners Online; ក្រោយ merge សាក Run workflow ថ្មីលើ main។ មិនធានាថា PC ដែលចែក CPU/RAM/network ដល់ runners ទាំង៤ចប់ក្រោម ១៥នាទីទេ; វាស់ setup និង run-all ដាច់គ្នាក្រោយ cache រួច។

### 2026-10-05 — npm cache សម្រាប់ GitHub-hosted និង prefer-offline សម្រាប់ Audit/APK

- **សំណើ**៖ ម្ចាស់ចង់ឱ្យ GitHub workflow និង self-hosted runners លឿនជាងមុន ហើយសួរផលប៉ះពាល់របស់ការកែ runtime។
- **ការកែ**៖ GitHub-hosted Audit setup-node ប្រើ explicit npm cache ជាមួយ lockfiles ពិតរបស់ ZoeW, supabase និង firebase-provision។ Self-hosted Audit នៅប្រើ Node/Java ក្នុង image និង local home cache។ npm ci ក្នុង Audit/APK បន្ថែម prefer-offline/no-audit/no-fund; lockfile validation និងតេស្តពេញនៅដដែល។ APK មិន upload npm cache និង signing secrets មិនចូល cache។ គ្មានការបង្កើន workers ឬកាត់ STRICT flags។
- **អ្នកយាម**៖ repository-contract-test ដេរីវេ lockfiles ពី npm ci prefixes ក្នុង workflow ហើយប្រៀបនឹង cache-dependency-path; ផ្ទៀង prefer-offline នៅ Audit/APK។ មុនកែ ១៣ឆ្លង/២ធ្លាក់; ក្រោយកែ ១៥ឆ្លង/០ធ្លាក់។ android:check ៨៩ឆ្លង, runall-runner-test ៥៦ឆ្លង និង repository-file-coverage ១០ឆ្លង; YAML/Bash syntax, comments និង whitespace ឆ្លង។ Full STRICT run-all ឈប់នៅ build វាស់ព្រោះគ្មាន Chromium។ ការផ្ទៀង native image/ពេលវេលា CI ត្រូវវាស់ក្រោយ rebuild និង run ពិត។
- **សកម្មភាពដោយដៃ**៖ Update source/rebuild image/recreate ដោយរក្សា volumes មុន rerun Audit របស់ PR។ ក្រោយ merge បង្កើត run ថ្មីលើ main។ GitHub npm cache ដំបូងត្រូវ download និង save ជោគជ័យ; cache storage quota នៅដាច់ពី compute quota។

### 2026-10-05 — Wi-Fi យឺត៖ Linux runners ប្រើ Node/Java ក្នុង image

- **ភស្តុតាង**៖ Audit `37295216643` លើ self-hosted shard ១ប្រើ Node setup ៩៥វិនាទី និង Java setup ៤១១វិនាទី មុន TLS connection fail; run-all មិនទាន់ចាប់ផ្ដើម។ GitHub run `37271570634` setup Node ០–៣វិនាទី និង Java ប្រហែល ០វិនាទី។ Java archive ក្នុង log មាន 207,473,347 bytes; runners ទាំង ៤អាចទាញប្រហែល 830 MB ដាច់ៗគ្នា។ ម្ចាស់បញ្ជាក់ថា Wi-Fi យឺត; មិនបានវាស់ bandwidth ពិតទេ។
- **ការកែ**៖ Linux image ដំឡើង Ubuntu OpenJDK 21 JDK headless ពេល build ម្ដង និងប្រើ Node 24 ដែលមានរួច។ Java ដំឡើងជា RUN layer បន្ថែម ដើម្បីរក្សា layer ដំឡើង runner/browser dependencies ចាស់ ដែល Docker build cache អាចប្រើវិញ។ self-hosted Audit ផ្ទៀង Node/Java/javac និងផ្ដល់ JAVA_HOME ដល់ steps បន្ទាប់; setup-node/setup-java រត់តែ GitHub mode។ Chromium/npm/emulator cache និង runner home volumes ដាច់ៗនៅដដែល; shards ទាំង ៤ និង STRICT flags មិនប្រែ។ Windows APK ការផ្គត់ផ្គង់ runtime មិនប្រែ។
- **អ្នកយាម**៖ repository-contract-test ផ្ទៀង mode conditions/image packages ហើយរត់ Bash preflight ពិតជាមួយ CLI fixtures៖ Node/Java ត្រឹមត្រូវផ្ដល់ JAVA_HOME; Node 22, Java 17 ឬ Java បាត់ ត្រូវបដិសេធ។ មុនកែ ៧ឆ្លង/២ធ្លាក់; ក្រោយកែ ១៣ឆ្លង/០ធ្លាក់។ runall-runner-test ៥៦ឆ្លង, android:check ៨៩ឆ្លង និង repository-file-coverage ១០ឆ្លង; YAML/Bash/Docker RUN syntax, comments និង whitespace ឆ្លង។ Full STRICT run-all សាកហើយឈប់នៅ build វាស់ព្រោះគ្មាន Chromium; បរិស្ថាននេះគ្មាន Docker CLI។ Native Docker build/WSL និង Audit ពេញនៅត្រូវផ្ទៀងលើ PC របស់ម្ចាស់; មិនអះអាងពេល run ថេរទេ។
- **សកម្មភាពដោយដៃ**៖ Update source, rebuild image ម្ដង, recreate containers ដោយរក្សា named volumes; មិនត្រូវ register ម្ដងទៀត។ Merge workflow ថ្មីមុនតេស្ត main ហើយបង្កើត Run workflow ថ្មី។ Download ដំបូង/កំណែថ្មីអាចយឺត; download ជោគជ័យ និង cache នៅដដែលទើប run បន្ទាប់អាចលឿន។

### 2026-10-05 — Windows APK៖ WSL bash បើក script ផ្លូវ Windows មិនបាន

- **ភស្តុតាង**៖ Android APK run `37294008780` លើ main `90aa66c` និង runner `Zoe-Windows-APK` ធ្លាក់នៅ step ពិនិត្យ GitHub CLI។ Log ជ្រើស `C:\Users\hunme\AppData\Local\Microsoft\WindowsApps\bash.EXE`; `/bin/bash` រាយ script `C:actions-runner-apk...sh` រកមិនឃើញ។ មិនទាន់ឈានដល់ពិនិត្យ Release ឬ build APK; cleanup ក៏ធ្លាក់ដោយ shell ដូចគ្នា។
- **ការកែ**៖ បន្ថែម step PowerShell មុន run step ផ្សេង ដើម្បីរក Git for Windows, ផ្ទៀង `bin/bash.exe` ហើយដាក់ folder នោះនៅដើម PATH តាម GITHUB_PATH។ Git Bash ប្រើសម្រាប់ Windows Gradle/apksigner និង cleanup; Linux audit មិនប្រែ។ ឯកសារដំឡើងបន្ថែម where.exe bash, កែ PATH/restart service និងបង្កើត run ថ្មីលើ main។ គ្មានការឡើងកំណែ App។
- **អ្នកយាម**៖ repository-contract-test ផ្ទៀង first run step ប្រើ PowerShell, គោលដៅ Git Bash និង GITHUB_PATH UTF-8។ មុនកែ ៦ឆ្លង/១ធ្លាក់; ក្រោយកែ ៧ឆ្លង/០ធ្លាក់។ android:check ៨៩ឆ្លង, runall-runner-test ៥៦ឆ្លង និង repository-file-coverage ១០ឆ្លង; YAML/Bash syntax និង comments ឆ្លង។ Full STRICT run-all បានសាក ប៉ុន្តែ build វាស់ឈប់ព្រោះបរិស្ថាននេះគ្មាន `/opt/pw-browsers/chromium`។ Native Windows APK build និង Audit ពេញលើ main ត្រូវផ្ទៀងដោយ run ថ្មី; គ្មានការអះអាងថា build APK ឬ run-all ពេញរួច។
- **សកម្មភាពដោយដៃ**៖ Merge ការកែ workflow ហើយ Actions → Android APK → Run workflow → main។ Release កំណែដដែលមានរួចនឹងរំលង build តាមចេតនា។ ចង់តេស្ត run-all លើ main ទោះធ្លាប់ pass រួច៖ Actions → Audit → Run workflow → main; មិនត្រូវឡើង APP_VERSION សម្រាប់ Audit។

### 2026-10-05 — ណែនាំដំឡើង runner សម្រាប់អ្នកចាប់ផ្ដើម

- **ការវាស់ពីការដំឡើង**៖ PowerShell បង្ហាញ Command not found សម្រាប់ sudo apt-get; Ubuntu gh auth login បង្ហាញ browser launcher/xdg-open រកមិនឃើញ។ ម្ចាស់ស្នើឱ្យ .md មានជំហានលម្អិត និងលទ្ធផលដែលត្រូវឃើញមុនបន្ត។
- **ការកែឯកសារ**៖ SELF-HOSTED-RUNNERS.md បែងជា ១៩ជំហាន, បញ្ជាក់ terminal, WSL/Docker, login តាម browser Windows, source ក្នុង Linux home, token តាមប្រភេទ, script ម្ដងសម្រាប់ Linux ៤ និង Windows service មួយ។ បន្ថែមការផ្ទៀង Repository variable និងតារាងដោះស្រាយកំហុស។ គ្មាន workflow ឬកូដ App ប្រែ។
- **ការផ្ទៀង**៖ Code fences ៣៨ពេញលេញ, Bash syntax ក្នុងឯកសារឆ្លង, local links ៥មានគោលដៅពិត, repository-file-coverage ឆ្លង និង git diff --check ឆ្លង។ ការដំឡើងលើ PC ពិតនៅត្រូវធ្វើតាមជំហាន និងផ្ទៀង Online/job results។

### 2026-10-05 — GitHub mode៖ Draft PR មិនមែនមូលហេតុ skip

- **វាស់មុនកែ**៖ Audit PR run `37266035700` នៅ commit `0db7de8` skipped; repo Public និង job មាន Private guard លើ mode ទាំងពីរ។ Draft flag មិនត្រូវបានប្រើក្នុង job condition។ អ្នកយាមរត់ condition ពិតមុនកែបាន ៧ឆ្លង និង ២ធ្លាក់។
- **ការកែ**៖ GitHub mode ឆ្លង visibility guard ទាំង Public/Private; self-hosted នៅទាមទារ Private ដដែល។ Fork audit និង main-only APK guards នៅដដែល។ Repository variable ត្រូវជា `ZOE_RUNNER_MODE=github` ក្នុង tab Variables; Secret/`.env`/Environment variable មិនត្រូវបានអានដោយ selector។
- **អ្នកយាម**៖ បន្ថែមករណីក្នុង `repository-contract-test` ឱ្យ evaluate job expression ពិតសម្រាប់ Public/Private, GitHub/self-hosted, missing/invalid variable, Draft/fork និង APK non-main; ក្រោយកែ ៩ឆ្លង។ ការសាក audit ពេញ/Windows APK នៅត្រូវរត់លើ runner ពិត។

### 2026-10-05 — CI ផ្ទាល់ខ្លួន៖ Linux audit ៤ ក្នុង WSL និង Windows APK ១

- **វាស់មុនកែ**៖ audit run `37243765075` មាន runner `Zoe1`–`Zoe4` ធ្លាក់នៅ Chromium; log របស់ job `111557489608` បង្ហាញ `sudo: A terminal is required to authenticate`។
- **ការកែ**៖ audit ប្រើ Linux pool ដាច់ក្នុង Docker, browser dependencies ដំឡើងក្នុង image, emulator/home ដាច់ពីគ្នា, shard ៤ ដដែល និង parallel ៤តាមសំណើម្ចាស់; `ZOE_RUNNER_MODE` ជ្រើស self-hosted ឬ GitHub-hosted សម្រាប់ audit/APK ទាំងពីរ។ WSL cap 12GB ជាចំណុចចាប់ផ្ដើមសម្រាប់សាក RAM 16GB។ APK ប្រើ Windows pool, Node មុន meta, SDK setup, Windows Gradle/apksigner និងផ្លូវ keystore តាម cygpath។ Signing certificate pin និង STRICT ទាំង ៥នៅដដែល។ Repo Public/fork PR មិនចាប់ PC runner; GitHub mode អាចរត់ Public/Private និង Draft PR ក្នុង repo ដដែល។ មិនមានការកែ App ឬឡើង APP_VERSION។
- **អ្នកយាម**៖ `repository-contract-test` ផ្ទៀង workflow/isolation និងរត់ register script ទល់ Docker fixture (token តាម stdin, runner ៤ និងកំហុសដំបូងបញ្ឈប់); `runall-runner-test`, `repository-file-coverage`, `doc-scope-test` និង `npm run android:check` ផ្ទៀងថ្នេរដែលពាក់ព័ន្ធ។ អ្នកយាម runner ដែលបានបន្ថែម៖ workflow មុនកែធ្លាក់ ហើយក្រោយកែឆ្លង ៨ ករណី; ការប្ដូរ mode ជ្រើស runner ត្រឹមត្រូវសម្រាប់ github/self-hosted/variable ទទេ និង sudo រត់តែ GitHub step (workflow មុន mode ធ្លាក់ ៣ ករណី); `runall-runner-test` ឆ្លង ៥៦ និង `android:check` ឆ្លង ៨៩។ Docker/WSL/Windows និង build APK ពិតមិនបានរត់ក្នុង session; run-all ត្រូវបានរារាំងព្រោះ Chromium download មិនបាន ZIP ពេញ។
- **សកម្មភាពដោយដៃ**៖ [ដំឡើង runner](SELF-HOSTED-RUNNERS.md), ដាក់ repo Private, Linux runner ៤ + Windows runner ១ Online, សាក Audit main ហើយសាក Android Release ដោយ keystore ដើម។ `backup.yml` នៅប្រើ GitHub-hosted ដូចមុន; quota/storage និងការបើក PC ពេល cron ត្រូវរៀបចំបន្ថែម។

### 2026-10-04 — run-all ៖ `emu/supabase-adapter-parity` · `supabase-app-network-e2e` ផ្នែក ជ ពឹងពេល (audit-tools តែប៉ុណ្ណោះ)

- `emu/supabase-adapter-parity` ធ្លាក់ ១ ក្នុង run-all STRICT ក្នុង session (CI PR #284 បៃតង) ➜ បង្កើតឡើងវិញ ៖ ៦ instance + CPU busy ៦ ដុំ ➜ **ធ្លាក់ ៤/៦** · commit មុន
  (មុនការកែថ្ងៃនេះ) **ធ្លាក់ ៥/៦** ➜ មិនមែនមកពីការកែ។ ឫស ៣ (សំណួរ ៨ ៖ សេណារីយ៉ូមិនចូលស្ថានភាព) ៖ (ក) `sleep(400/500)` ក្នុង `drop-response` ➜ ប្តូរ mode មុនសំណើដល់
  server ➜ មិនមែន «ចម្លើយបាត់ក្រោយ commit» · (ខ) transaction ក្រោយ transaction ដែល **replay** ៖ ចម្លើយ replay (`zoe_ops`) គ្មានតម្លៃ doc ➜ adapter ទាញតម្លៃពិត
  (`requestSync()`) ➜ ក្រោមបន្ទុក transaction បន្ទាប់ចាប់ផ្តើមលើ base ហួសសម័យ ➜ conflict ក្នុង `drop-response` ➜ `not-applied` (ពិត ៖ op មិនបានអនុវត្ត · ledger ផ្ញើម្តងទៀត ≤ ៣
  · ការបរាជ័យពីរជាន់ មិនមែនកំហុស adapter) · (គ) «សមាជិកផ្លាស់ហាង» ៖ ការទាញយឺតរបស់ client មុន (បិទរួច) មកដល់ក្រោយ `pullLog.length = 0` ➜ លំដាប់ខុស។
  កែ ៖ រង់ចាំ commit ពិតលើ Postgres + `txDisconnectResolving` · ទិដ្ឋភាពស្រស់ (`tx = 5`) · វាស់ការទាញរបស់ C3 តាម cursor ពិតក្នុង cache ➜ **៦/៦ ក្រោមបន្ទុកដដែល**។
  Mutation (op_id ថ្មីពេលផ្ញើម្តងទៀត) ➜ **ធ្លាក់ ២**។
- `supabase-app-network-e2e` ផ្នែក ជ ៖ ក្រោយការកែ G1 token របស់ runSync រង់ចាំ lock auth របស់ supabase-js រហូតការចាកចេញ ➜ ការទាញចេញ **ក្រោយ** logout (ការវាស់ ៖
  `refresh · my_account · logout · zoe_pull`) ➜ ការសាក ៤ ដងក៏មិនចូលស្ថានភាព (៤/៤ ដងគ្មាន race) ➜ init script (តែការផ្ទុកនោះ) ពន្យារ `fb.getIdTokenResult()` រហូត
  `zoe_pull` ចេញពីទំព័រ ➜ build កែ **២៣/២៣ ៧ ដងជាប់គ្នា** · build មុនកែ (2.49.2) **ធ្លាក់ ២** (history មិនគ្រប់ · `p_since ≠ 0`)។

### 2026-10-03 — CI ៖ `firebase-backup-test` ធ្លាក់លើ runner រវល់ (audit-tools · តេស្តតែប៉ុណ្ណោះ)

- CI PR #284 ផ្នែក ៣/៤ ៖ «ផ្លូវ body ព្យួរត្រូវបានឈានដល់ពិត» `{"bodyStarted":0,"requests":0}` — ពិដាន 100 ms ផុតមុនសំណើដល់ server។ ឫស ៖ `fetch` ដំបូងក្នុង
  process ផ្ទុក undici ខ្ជិល (វាស់ ~185 ms ទំនេរ) ➜ សេណារីយ៉ូមិនចូលស្ថានភាព «headers មក · body ព្យួរ» ដែលវាវាស់ (សំណួរ ៨)។ ផលិតផលត្រឹមត្រូវ (ពិដានគ្របការតភ្ជាប់)។
- បង្កើតឡើងវិញ ៖ CPU busy ៨ ដុំលើ ៤ core ➜ **ធ្លាក់ ៥/៦**។ កែ ៖ កំដៅ `fetch` លើផ្លូវ `/warm` (មិនរាប់) + ពិដាន 1000 ms · watchdog ៣ ដង ➜ **ឆ្លង ៦/៦** ក្រោម
  បន្ទុកដដែល។ Mutation លើច្បាប់វាស់ (`clearTimeout` ពេល headers មក) ➜ **ធ្លាក់ ៤** (អ្នកយាមនៅចាប់កំហុសពិត)។

### 2026-10-03 — ឯកសារ ៖ លុប `docs/AUDIT-PROMPT.md` (សំណើម្ចាស់គម្រោង ៖ «លុបចុះ»)

- ហេតុផល ៖ ម្ចាស់គម្រោងផ្តល់ prompt audit ផ្ទាល់រាល់ជុំ · «តារាងជុំមុន» ១២ ផ្ទាំងជាប្រវត្តិ ដែលមេរៀននីមួយៗយោង `docs/HISTORY.md` រួច ·
  ជំហាន ០–៤ ស្ទួន `CLAUDE.md` (Warnings · Checker discipline · Runbook)។ បច្ចេកទេសដែល `CLAUDE.md` មិនទាន់មាន (ប្រៀបធៀបបងប្អូនលើរបៀបបរាជ័យ · `grep`
  អ្នកហៅធនធានចែករំលែកទាំងអស់ · ផ្ទៃកើតក្រោយច្បាប់ · ជួរតម្រៀបដដែល ➜ អត់ឃ្លាន · ពិដានតេស្តតឹងជាងទ្វារបម្រុង) ផ្លាស់ទៅ Warnings ៣ ជាបន្ទាត់ខ្លី។
  ខ្លឹមសារពេញនៅក្នុង git history (`git show 1ffb6f0:docs/AUDIT-PROMPT.md`)។
- `doc-scope-test` ផ្នែក ៤ (ភាពស្រស់ក្បាលតារាងរបស់ឯកសារនោះ) ដកចេញ · `repository-file-coverage.json` ដកធាតុ + policy `guard-36` · `CLAUDE.md` ៣ កន្លែង ·
  `audit-tools/README.md`។ គ្មានការឡើងកំណែ (ឯកសារ + audit-tools តែប៉ុណ្ណោះ)។

### 2026-10-04 — Deep audit ជុំ ២ ៖ ចំណុច ១០ — SW + License ក្រោមបណ្តាញខូច (SW ➜ ផ្នែក ១ [2.49.4] · License ៖ អ្នកយាមតែប៉ុណ្ណោះ)

- **SW (browser ពិត · server ក្លែងដែលទទួល socket តែមិនឆ្លើយ)** ៖ revalidate · fetch · ការពិនិត្យ deploy មានពិដានរួច (`sw-revalidation-timeout` · `sw-abort-propagation`)។
  ចន្លោះ = **install** ៖ `cache.addAll(CORE)` និង `cache.add(OPTIONAL)` គ្មានពិដាន។ វាស់លើ build `zoew-v260` មុនកែ ៖ `icon-192.png` ព្យួរ ➜ SW **នៅ `installing` ក្រោយ ៤៥ វិ.**
  (គ្មាន `statechange`) · បណ្តាញធម្មតា ➜ activated ក្នុង 176 ms។ ZoeKeyGen ដូចគ្នា (`manifest.json`)។ ការកែ ៖ OPTIONAL នីមួយៗ `addOptionalShell()` (abort + resolve ក្នុង
  `OPTIONAL_INSTALL_TIMEOUT_MS` ២០ វិ.) ➜ activate ក្នុង ~២០ វិ.។ ⛔ **CORE មិនដាក់ពិដានទាំងមូល** ៖ សំបក ~២.៣ MB (+ OPTIONAL ~១.២ MB) លើបណ្តាញយឺតអាចលើស
  ពិដានណាមួយ ➜ install មិនដែលចប់ ➜ អាក្រក់ជាងបច្ចុប្បន្ន · CORE ព្យួរទុកឲ្យ browser សម្លាប់ event ខ្លួនឯង (Chromium ~៥ នាទី) ហើយ `reg.update()` សាកម្តងទៀត។ ⏳ ជុំ ៣ ៖
  ពិដាន «គ្មានវឌ្ឍនភាព» (idle) លើ CORE តាម stream ត្រូវការវាស់លើ WebKit ពិតមុន។ សង្កេតក្រៅវិសាលភាព ៖ ZoeKeyGen install មិនប្រើ `cache: 'no-cache'` (ZoeW ប្រើ) ➜ ជុំ ៣។
- **License (`license-verify.js` ពិតក្នុង vm)** ៖ ព្យួរ ➜ `ok:null` ក្នុង `NET_TIMEOUT_MS` · body ព្យួរ ➜ abort · `fetch`/`AbortController` អវត្តមាន ➜ `ok:null` (គ្មានការបោះ) ·
  PUT seat commit រួចតែចម្លើយបាត់ ➜ Activate លើកទី ១ «network» · លើកទី ២ អាន seat វិញ ➜ `mine` · `getStatus` ព្យួរ ➜ record នៅ ➜ **កូដត្រឹមត្រូវ (វាស់ ៖ គ្មានកំហុស)**។
  Mutation ៤ លើ checker License ទាំង ៦ (`license-grace` · `license-seat` · `license-network-pressure` · `network-timeout` · `license-record-race` · `license-clock-trust` ·
  baseline បៃតងទាំង ៦) ៖ catch ➜ `ok:false` ក្រហម ២ · គ្មានពិដាន ➜ `network-timeout` ព្យួរ (ក្រហម) · **GET 5xx ➜ `ok:false` រស់** · **PUT seat បាត់ ➜ `seat-taken` រស់**
  (ផល ៖ Firebase 503 ម្តង ឬបណ្តាញដាច់កណ្តាលការកក់ seat របស់ record ចាស់ ➜ `checkLocalStatus` **លុប License ពិត**) ➜ `license-grace-test` +១១ ➜ ក្រហម ៣ · ២។
- **CI** ៖ កូតា GitHub Actions អស់ ➜ CI ចម្លង `audit.yml` ក្នុង session (Node 24 · emulator ពិត · `RUNALL_SHARD=k/4` · ទង់ STRICT ទាំង ៥) ➜ `0e2e766` ៖ ២០២/២០៣ ·
  ការធ្លាក់តែមួយ = `npm run parity` (សារចាកចេញ G4 មិនចុះ `REMOVED_STRINGS`) ➜ `1193fff` ៖ shard 2 បៃតង។ ម្ចាស់គម្រោងប្តូរ `runs-on: self-hosted` (`f2e5d50`) ៖ runner
  ជា Windows ➜ `audit.yml` (bash · `sudo` · `/opt/pw-browsers/.../chrome-linux` · `playwright install --with-deps`) រត់មិនបាន · runner ត្រូវបិទកណ្តាលការទាញ Java។

### 2026-10-04 — Deep audit ជុំ ២ ៖ realtime websocket ពិត (ឧបករណ៍វាស់ថ្មី · ការកែ = SBD-6)

- **ចន្លោះ** ៖ fake Supabase របស់ audit-tools បិទ upgrade ➜ realtime មិនដែលត្រូវវាស់ពីចុងដល់ចុង។ **ឧបករណ៍ថ្មី** ៖ server Phoenix ក្លែង (`ws` · vsn 2.0.0 ៖ `phx_join` · `phx_reply` ·
  heartbeat · `broadcast` · `phx_close` + `system` «Token has expired» · `access_token`) + REST `zoe_pull` + GoTrue refresh លើ HTTP ពិត ➜ realtime-js ពិត (តាម supabase-js) + transport + adapter។
- **លទ្ធផលលើ adapter `main`** ៖ (ក) broadcast `seq` ➜ ការទាញ ✅ · (ខ) server ផ្តាច់ socket ➜ realtime-js ភ្ជាប់វិញ ➜ join ម្តងទៀត ➜ broadcast មក · គ្មាន join បន្ថែមក្នុង ១២ វិ. ✅ ·
  (គ) server បិទ channel (token ផុត) ➜ **មិន subscribe វិញ** ❌ · (ឃ) server បដិសេធ join ➜ **join តែ ១ ក្នុង ២០ វិ.** ❌ ➜ ទាំង ២ = SBD-6 (កែរួច ៖ ៥/៥ · join ក្នុង ២០ វិ. ≤ ១២) ·
  (ង) token refresh ពេល channel រស់ ➜ supabase-js `realtime.setAuth()` ➜ `access_token` ទៅ channel · មិន join ម្តងទៀត ✅។
- **វាស់ ៖ គ្មានកំហុសថ្មី** ក្រៅពី SBD-6។ តេស្តប្រើពេលពិត (~៦០ វិ. ក្នុង vitest ពេញ ៤១ វិ. ព្រោះឯកសាររត់ស្របគ្នា · ពិដាន `zoew-suite` ២៤០ វិ.)។

### 2026-10-04 — Deep audit ជុំ ២ ៖ G6 — នាឡិកាទូរស័ព្ទលឿន ➜ refresh ញឹក · 429 ➜ ចាកចេញ (ការកែ ➜ ផ្នែក ១ [2.49.4])

- **វាស់លើ tree មុនកែ** (supabase-js ពិត · `vi.setSystemTime` លឿន ៦៥ នាទី · GoTrue ក្លែងឲ្យ `expires_at` តាមម៉ោង server · PostgREST ក្លែងទាមទារ token) ៖ ៥ RPC ➜ refresh **≥ ៤** ·
  GoTrue 429 ➜ `AuthApiError` (auth-js `NETWORK_ERROR_CODES` = 500–530 តែប៉ុណ្ណោះ) ➜ access token «ផុត» តាមម៉ោងទូរស័ព្ទ ➜ `_removeSession` ➜ storage **ទទេ** (ចាកចេញ)។
- **ការកែ** ៖ transport `global.fetch` ➜ `sbSoftenRefreshRateLimit(input, res)` ៖ 429 លើ `/auth/v1/token?grant_type=refresh_token` ➜ 503 (retryable សម្រាប់ auth-js ➜ session នៅ ·
  backoff ក្នុង ៣០ វិ. ➜ cooldown ៦០ វិ.) · adapter `noteServerTime()` ➜ `onClockSkew(offset)` ម្តង ➜ SDK ➜ `sbClockSkewText()` ➜ env ➜ toast។ ⛔ មិនប៉ះ `attachInfoListeners()`
  (ស្ថិតក្នុង `shared-fns` ទាំង ២ App)។
- **លទ្ធផល** ៖ **៧/៧** · vitest ពេញ ៥៥ ឯកសារ / ៤៩១ · Mutation ៥ ៖ គ្មានការប្តូរ 429 · ប្តូរទាំងការចូល · ព្រមានរាល់ការទាញ · គ្មានព្រំ · SDK មិនភ្ជាប់ ➜ ក្រហម ៥។ G7 (fake server
  គ្មាន reuse interval) ៖ មិនត្រូវការ (G2 ✅ reuse interval ៦០ វិ. ម្ចាស់គម្រោងកំណត់រួច)។

### 2026-10-04 — Deep audit ជុំ ២ ៖ ZTO-G2 + ZTO-G6 — អត្តសញ្ញាណបរាជ័យបណ្តោះអាសន្ន · ថវិកា single-flight (ការកែ ➜ ផ្នែក ១ [2.49.4])

- **ZTO-G2 វាស់លើ tree មុនកែ** (vitest · `runZtoListSyncPreview()` ពិត · fetch ក្លែងឆ្លើយ `enabled:false` + reason) ៖ `idtoken:certs` · `expired` · `future` · `kid-unknown` ·
  `aud` · `iss` · `project-unset` និង token ព្យួរ ៨ វិ. ➜ **«គ្មានលេខសាខា» ទាំង ៨**។ មូលហេតុ ៖ `reason.indexOf('site:') === 0 || reason.indexOf('idtoken:') === 0` ➜ សាខាតែមួយ។
  `idtoken:supabase-unreachable` មានសាខាផ្ទាល់រួច (ឆ្លង)។ certs Google ៖ TTL ១ ម៉ោង · ការទាញបរាជ័យ ➜ ប្រើ certs ចាស់ (fail-open) · `kid-unknown` ក្នុង TTL ➜ មិនទាញម្តងទៀត ៖ Google
  ផ្សព្វផ្សាយ key ថ្មីមុនប្រើ (Cache-Control ច្រើនម៉ោង) ➜ **វាស់មិនបាន** ➜ មិនកែ Function · App ចាត់ជាបណ្តោះអាសន្ន។
- **ZTO-G6 វាស់** (`zto-budget-test` ផ្នែក ៩ ៖ Function ពិត · upstream ព្យួរ · ថវិកា 6000 · upstream 5500) ៖ B ចាប់ផ្តើម t=0 អាន store 2000 ms · A ចាប់ផ្តើម t=1500 អាន 0 ms ➜
  A ម្ចាស់ run ➜ B ចូលរួមនៅ t=2000 ➜ B **7004 ms** · A 5503 ms · upstream ១ ដង។ ការកែ ៖ `runSharedLookup()` ➜ `joinWithinBudget(existing, config, startedAt)` (ការប្រណាំងជាមួយ
  `budgetLeftMs() - 200` ➜ `budgetTimeoutOutcome()` ដែល `fetchOrder()` ប្រើដែរ ➜ គ្មាន JSON 504 ពីរកន្លែង)។ ⛔ ការវិភាគតាមកូដដំបូង («អ្នកចូលរួមតែងមកក្រោយ ➜ មិនអាចលើស») **ខុស** ៖
  អ្នកចូលរួមអាន *ចាប់ផ្តើម* មុនម្ចាស់ run (ជំហាន Cookie យឺត)។
- **លទ្ធផល** ៖ ZTO-G2 **១២/១២** · ZTO-G6 **៦៣ ok** · `zto-proxy` · `zto-negative-cache` · `zto-cookie-store` · `zto-cookie-session` · `zto-list-sync` · `netlify-config-scope` ✅។

### 2026-10-04 — Deep audit ជុំ ២ ៖ ZTO-G3 + ZTO-G5 — body ខូច ≠ «គ្មានទិន្នន័យ» (ការកែ ➜ ផ្នែក ១ [2.49.4])

- **វាស់លើ tree មុនកែ** (`attemptAutoLookup()` ពិតក្នុង vm) ៖ HTTP 200 + `json()` បដិសេធ ➜ `data = null` ➜ `found = false` ➜ «⚠️ ZTO មិនឃើញទិន្នន័យសម្រាប់ Barcode នេះ» · ការហៅ ១ ·
  `autoLookupFailureAt` ទទេ។ ⛔ មេរៀន ៖ fetch ក្លែងរបស់ checker ត្រឡប់ body ផ្ទាល់ ហើយ **មិនអើពើ reader** (អាគុយម៉ង់ទី ៥) ➜ ផ្លូវ parse body គ្មានអ្នកវាស់។
- **ការកែ** ៖ reader ត្រឡប់ sentinel `unreadable` (ក្នុង `attemptAutoLookup()`) ➜ ក្រោយ `retryTransientLookupResponse` ៖ `res.ok` + sentinel ➜ `lookupResponseError(status,
  { code: 'LOOKUP_BAD_BODY' }, true)` ➜ `retryAsync` ព្យាយាមម្តងទៀត ➜ សារផ្ទាល់ខ្លួន។ `zto-status.ts` (`checkZtoStatusForBarcode`) ៖ body ខូច ➜ `null` ➜ `continue` (មិនកត់សាលក្រម ·
  fail streak) ➜ ត្រឹមត្រូវរួច (វាស់ ៖ គ្មាន)។ ZTO-G5 (សារនាំចូល + បញ្ជីត្រូវសម្អាត) ➜ កែរួចជាមួយ ZTO-G4។
- **លទ្ធផល** ៖ មុនកែ **ធ្លាក់ ៣** ➜ **៥៣ ok** · `lookup-prefetch` · `lookup-burst` · `zto-proxy` · `network-pressure` · `html-sink-escaping` ✅ · Mutation ៣ ➜ ក្រហម ៣។

### 2026-10-04 — Deep audit ជុំ ២ ៖ SBD-5 — ការទាញពេញច្រើនទំព័រដាច់កណ្តាល ➜ ទិដ្ឋភាពខ្លី (ការកែ ➜ ផ្នែក ១ [2.49.4])

- **វាស់លើ tree មុនកែ** (adapter ពិត · fake server មាន purge) ៖ ៩ កញ្ចប់ ready ➜ លុប ១ + purge + កែ ៨ ➜ cursor < purged ➜ reset (ទំព័រ ២) ➜ ទំព័រទី ២ `SbNetworkError` ➜
  listener ថ្មី **២ keys**។ មូលហេតុ ៖ `applyPull()` reset `server.clear()` លើទំព័រទី ១ ខណៈ `ready` នៅ `true` ➜ `notify()`/`fireListener()` ណាមួយ (listener ថ្មី · ការសរសេរ) បង្ហាញវា។
- **ការកែ** ៖ `pullStage` (reset ➜ Map ថ្មី · `pullStageAbove` = `max(seq, head)`) · ទំព័របន្តចូល stage · `!res.more` ➜ បញ្ចូល entry ក្នុង `server` ដែល `s > pullStageAbove`
  (ការសរសេររបស់យើង) ➜ ប្តូរ · `putDocIn(target, …)` ជំនួស `putDoc` ផ្ទាល់ (reset ទំព័រតែមួយ ក៏ឆ្លងផ្លូវដដែល ➜ គ្មានរូបមន្តពីរ) · `saveDocsCacheNow()` ឈប់ពេល stage ៖ ទិដ្ឋភាពចាស់ +
  cursor កណ្តាល ➜ ឧបករណ៍ដែលផ្ទុកពី cache ទាញ delta ពី cursor នោះ ➜ doc ដែលលុប/កែចន្លោះ cursor ចាស់ និង cursor កណ្តាល **មិនមកវិញ** (វាស់ ៖ mutation ➜ doc ខ្មោច)។
- **លទ្ធផល** ៖ **១៩/១៩** · vitest ពេញ ៥៣ ឯកសារ / ៤៧២ · Mutation ៦ ៖ គ្មាន stage · cache កណ្តាល stage · គ្មាន keep-newer · មិនប្តូរ ➜ ក្រហម ៤ · `pullStage = null` ២ កន្លែង ➜ រស់ ➜ ដក។

### 2026-10-04 — Deep audit ជុំ ២ ៖ ZTO-G4 — ការនាំចូលបញ្ជី ZTO មិនឈប់ក្រោយការព្យួរដំបូង (ការកែ ➜ ផ្នែក ១ [2.49.4])

- **វាស់លើ tree មុនកែ** (`zto-list-sync-test` sandbox ៖ `importZtoListRows()` ពិត) ៖ claim ព្យួរ ➜ claim ទាំង ២ ជួរ (= ១០០ ជួរ × ពិដាន ១៥ វិ. ≈ ២៥ នាទី លើ App ពិត) ·
  ការរក្សាទុកព្យួរ ➜ ការរក្សាទុក ២ · toast «✅ បញ្ចូល 0 កញ្ចប់ · ⚠️ បរាជ័យ 2» · `ztoListSyncResult = null` · បណ្តាញដាច់កណ្តាល ➜ «✅ បញ្ចូល 1 កញ្ចប់» តែប៉ុណ្ណោះ។
- ⛔ **មេរៀន** ៖ ផ្នែក ៩ មានការអះអាង `claimDeferreds.length === 2` / `saveDeferreds.length === 2` ជា «ជាន់អប្បបរមា» ➜ **ចាក់សោកំហុស** (loop បន្តក្រោយការព្យួរ)
  ផ្ទុយនឹងច្បាប់ «Batch work aborts after the first hang»។ ជាន់អប្បបរមាត្រូវវាស់ថា *ផ្លូវត្រូវបានឈានដល់* (`>= 1`) មិនមែនចំនួនដែលឥរិយាបថខុសផលិត។
- **ការកែ** ៖ `notTried` ៖ claim timeout (`'Barcode claim timed out'` តែប៉ុណ្ណោះ ➜ `'stalled'`) · save timeout · `navigator.onLine === false` ➜ `break` · `notTried` ➜ មិនសម្អាត
  `ztoListSyncResult` · សារ «⏸️ មិនទាន់បញ្ចូល N» + កំណត់ចំណាំ «ចុច «បញ្ចូល» ម្តងទៀត»។
- **លទ្ធផល** ៖ មុនកែ **ធ្លាក់ ៨** ➜ **៣៨៤ ok** · Mutation ៦ ៖ claim ព្យួរបន្ត · save ព្យួរបន្ត · សម្អាតបញ្ជី · គ្មានសារ · offline មិនរាប់ · claim បដិសេធ = ព្យួរ ➜ ក្រហម ៦។

### 2026-10-04 — Deep audit ជុំ ២ ៖ G3 + SBD-6 — សំណើមិនទាន់ផ្ញើ ≠ ចម្លើយបាត់ · realtime `CLOSED` មិន subscribe វិញ (ការកែ ➜ ផ្នែក ១ [2.49.4])

- **វាស់លើ tree មុនកែ** (adapter ពិត · transport ពិត + supabase-js ពិត) ៖ (ក) token ផុត + GoTrue 503 ➜ `rpc()` បោះ `SbNetworkError('auth-unavailable')` **គ្មាន POST** តែ
  adapter ដាក់ `lost` ➜ `close` ➜ `txOutcome: 'unknown'` + `onTxOutcomeUnknown` (Sentry លុយ) · (ខ) ចន្លោះនោះឧបករណ៍ផ្សេងសរសេរ ➜ token មកវិញ ➜ conflict ➜ `not-applied`
  (មិន commit) · (គ) `CLOSED` ក្រោយ `SUBSCRIBED` ➜ `subscribe` **១ ដងក្នុង ១២០ វិ.** · `CHANNEL_ERROR` ជាប់ ➜ **១ ដងក្នុង ៣០០ វិ.**។
- **ការកែ** ៖ transport ដាក់ `unsent` លើ `SbNetworkError` ដែលបោះមុន POST (`unsentWithin()` លើជំហាន token និង refresh ក្រោយ 401 · `auth-unavailable`) · adapter ៖
  `if (!lost && !e.unsent)` · ផ្លូវ `close` ក្រោយ delay ➜ `lost ? giveUp() : disconnect` (មុនកែ `giveUp()` លើ `lost = null` ➜ `TypeError`)។ realtime ៖ `scheduleRealtimeRetry()`
  + `realtimeGeneration` (status ពី channel ដែលរុះរួចត្រូវមិនអើពើ ៖ realtime-js `removeChannel()` ផ្ញើ `CLOSED` យឺត ➜ បើគ្មាន gate ➜ វដ្តរុះ/បង្កើតឥតឈប់ · វាស់)។
- **លទ្ធផល** ៖ **១៧/១៧** · vitest ពេញ ៥៣ ឯកសារ / ៤៦៩ · Mutation ១៣ ➜ ក្រហម ១៣។ ⛔ មេរៀន ៖ mutation ដំបូង ១៣ ➜ រស់ ៦ (ផ្នែកដែលតេស្តដំបូងមិនបានចូល) ➜ តេស្តថ្មី ៨។
  gate លើ event broadcast របស់ channel ចាស់ ➜ គ្មានផល (requestSync បន្ថែម) ➜ មិនដាក់។

### 2026-10-04 — Deep audit ជុំ ២ ៖ G4 — ចាកចេញពេល Supabase មិនឆ្លើយ ➜ session នៅក្នុង storage (ការកែ ➜ ផ្នែក ១ [2.49.4])

- **វាស់លើ `main`** (supabase-js ពិត · fake timers) ៖ ចូលពេលមានបណ្តាញ ➜ បណ្តាញងាប់ ២ ម៉ោង (token ផុត) ➜ `signOut()` ➜ **បដិសេធ `Failed to fetch` ក្រោយ 13.4 វិ.** ·
  session **នៅ** ក្នុង storage ➜ SDK ថ្មីលើ storage ដដែល (មានបណ្តាញ) ➜ `onAuthStateChanged(u1)`។ មូលហេតុ ៖ auth-js `_signOut` ➜ `_useSession` ➜ `__loadSession` ➜ refresh
  បរាជ័យ (retryable) ➜ `return { error: sessionError }` **មុន** `_removeSession` · token នៅមាន ➜ `admin.signOut` network error ➜ លុប session តែត្រឡប់ error ➜ adapter បោះ ➜
  សារ «មិនអាចបញ្ជាក់ថាបានចាកចេញពី Firebase» (`toastBackendText()` ប្តូរជា «Supabase» លើហាង Supabase)។
- **ការកែ** ៖ transport `signOut()` = (ក) best-effort revoke ក្រោមពិដាន ៣ វិ. (`accessToken()` ➜ `POST /auth/v1/logout?scope=local`) (ខ) លុប `SB_AUTH_KEY_SUFFIXES` ក្នុង storage
  ដោយខ្លួនឯង (គ) storage នៅមាន session ➜ បដិសេធ។ ⛔ មិនហៅ `client.auth.signOut()` ៖ វារង់ចាំ lock ដែល refresh កំពុងកាន់ (~៣០ វិ.) ហើយ `signInWithPassword` មិនយក lock ➜
  ការចាកចេញដែលចូលជួរយឺតអាចរត់ **ក្រោយ** ការចូលថ្មី ➜ revoke ហើយចាកចេញគណនីថ្មី។ ⛔ មិន `stopAutoRefresh()` ៖ transport ដដែលប្រើសម្រាប់ការចូលបន្ទាប់ ហើយ ticker អាន
  storage ទទេ ➜ គ្មានអ្វីត្រូវ refresh។ refresh ដែលកំពុងរត់ ➜ commit guard (`storedAtStart` ≠ `storedAfter`) បោះចោល (វាស់ ៖ បណ្តាញត្រឡប់ ១២០ វិ. ➜ storage ទទេ · ចូលគណនីថ្មីបាន)។
- **លទ្ធផល** ៖ មុនកែ **ធ្លាក់ ៤/៧** ➜ **៩/៩** · vitest ពេញ ៥២ ឯកសារ / ៤៥២ · Mutation ៦ ៖ គ្មានការលុបក្នុងឧបករណ៍ (ធ្លាក់ ៨) · គ្មានពិដាន (១) · គ្មាន revoke (២) · គ្មានការពិនិត្យ
  storage (១) · គ្មានការការពារ `ownSignOut` (៣ ៖ refresh 400 កំឡុងចាកចេញ ➜ សារ «សម័យបញ្ចប់» ខុស) · លុប account key ក្នុង transport **រស់** ➜ ដកចេញ។
- **សម្មតិកម្មដែលកូដបដិសេធ** ៖ «សារជាច្រើននិយាយ Firebase លើហាង Supabase» ➜ មិនពិត ៖ `showToast()` ឆ្លង `toastBackendText()` ដែលប្តូរពាក្យជា «Supabase» រួចហើយ។
- **សារបរាជ័យ** (`logoutApp()` · `forgetAppLockPin()`) ៖ ការចាកចេញលែងពឹងបណ្តាញ ➜ «សូមពិនិត្យបណ្ដាញ» ក្លាយជាការណែនាំខុស ➜ «…មិនអាចបញ្ជាក់ថាបានចាកចេញពីឧបករណ៍នេះទេ — សូម
  Refresh ហើយសាកចាកចេញម្តងទៀត»។ ⚠️ ការប្តូរនេះត្រូវចុះក្នុង `REMOVED_STRINGS` (`ZoeW/scripts/intentional-removals.mjs`) ៖ `npm run parity` (ក្នុង `zoew-suite`) ធ្លាក់ 773/775
  លើ CI ក្នុង session (shard 2/4) ព្រោះការផ្ទៀងក្នុងជុំនោះរត់តែ vitest + checker ពាក់ព័ន្ធ មិនបានរត់ `zoew-suite` ពេញ ➜ បន្ថែម ២ ធាតុមានហេតុផល ➜ 773/773។

### 2026-10-04 — Deep audit ជុំ ២ ៖ G5 — បើក App ពេលក្រៅបណ្តាញ + token ផុត ➜ ប្រអប់ចូលជាប់ (ការកែ ➜ ផ្នែក ១ [2.49.4])

- **វាស់លើ `main` (49adb4d) មុនកែ** ៖ supabase-js ពិត (`@supabase/auth-js` 2.117.2) + storage ក្នុងសតិ + fetch ក្លែង (ក្រៅបណ្តាញ = `TypeError` · GoTrue 503 · 400) · fake timers ៖
  `restoreSession()` = `getSession()` រង់ចាំ `_initialize` ➜ `_callRefreshToken` សាកឡើងវិញ (backoff 200 ms × 2ⁿ ក្នុង `AUTO_REFRESH_TICK_DURATION_MS` ៣០ វិ.) ➜ **គ្មាន
  `onAuthStateChanged` ក្នុង 7.5 វិ.** ➜ App ពិត ៖ `attemptAuthStorageRecovery` reload ➜ ប្រអប់ចូល · `getSession()` ឆ្លើយ `null` + `AuthRetryableFetchError` (session **នៅ** ក្នុង storage) ·
  បណ្តាញត្រឡប់ ➜ ticker ស្វ័យប្រវត្តិ refresh ជោគជ័យ ➜ `TOKEN_REFRESHED` ➜ handler ត្រូវការ `auth.currentUser` ➜ **`currentUser` នៅ `null` ក្រោយ ១២០ វិ.**។
- **ការកែ** ៖ (ក) `restoreSession(ceilingMs)` ៖ ការប្រណាំងជាមួយពិដាន ៣ វិ. · session ពី Server ➜ ប្រើ · គ្មាន session + គ្មាន error ➜ `null` · error ឬពិដាន ➜ session ក្នុង storage
  (supabase-js ទុកវាតែពេលបរាជ័យបណ្តោះអាសន្ន · លុបពេល 400) (ខ) `SIGNED_OUT` មកកំឡុងការស្តារ ➜ មិនស្តារ session ចាស់ (`lostWhileRestoring` ៖ ចន្លោះ microtask រវាងការអាន
  storage និង `setUser`) (គ) `SIGNED_OUT` ដែល adapter មិនបានហៅ (`ownSignOut()` រាប់) ➜ `env.onSessionEnded` (ឃ) `_accountUnverified` ➜ ពិនិត្យហាងម្តងទៀតលើ
  `TOKEN_REFRESHED` និង `onSynced` · `_verifyAccount()` រួមការហៅស្របគ្នា។ ⛔ មិនអើពើ `TOKEN_REFRESHED` ពេល `currentUser` ទទេដដែល ៖ ការចាកចេញដែលបរាជ័យ (G4) ទុក session ក្នុង
  supabase-js ➜ ការទទួលយកវានឹងបើកចូលគណនីដែលអ្នកប្រើទើបចាកចេញ។
- **លទ្ធផល** ៖ មុនកែ **ធ្លាក់ ៦/៩** ➜ **១៤/១៤** (បន្ថែម ៥ ៖ error លឿន ➜ storage · race `SIGNED_OUT` · `onSynced` ពិនិត្យម្តងទៀត · ការពិនិត្យស្របគ្នា · ច្បាប់ ៤ ម៉ោងពេលក្រៅបណ្តាញ ៖
  `authTime` ពី token ចាស់ ក្រោយ ៤០ វិ.) · vitest ពេញ ៥១ ឯកសារ / ៤៤៣ · run-all subset (STRICT · emulator រស់) ៖ `emu/supabase-adapter-parity` ៩២ · `supabase-app-network-e2e` ២៣ ·
  `supabase-docs-cache` · `sdk-surface` · `toast-truth` · ឯកសារ/កំណែ ✅ ·
  `tsc` · eslint · purity ✅។ Mutation ១០ ៖ គ្មាន fallback storage (ធ្លាក់ ៥) · error ➜ `null` (១) · គ្មានការពិនិត្យលើ `TOKEN_REFRESHED` (២) · គ្មានការការពារ `ownSignOut` (២) ·
  គ្មានសារ (២) · គ្មានការរួមការពិនិត្យ (១) · មិនដាក់ `_accountUnverified` (៣) · គ្មាន `lostWhileRestoring` (១) · លក្ខខណ្ឌ `onSynced` ចាស់ (១) · ការពិនិត្យ `refresh_token` **រស់** ➜ ដកចេញ។
- **ផលលើ G4** ៖ storage ដែល `signOut()` បរាជ័យទុកចោល ស្តារពេលក្រៅបណ្តាញដែរ ➜ G4 កែក្នុង PR ដដែល (ធាតុខាងលើ)។

### 2026-10-03 — Deep audit ជុំ ២ ៖ បណ្តាញ — ហាង Supabase ពេលបណ្តាញខូចលើ App ពិត · Firebase លើលំហូរដដែល (ការកែ ➜ ផ្នែក ១ [2.49.3])

- **ចន្លោះដែលវាស់ឃើញ** ៖ `emu/app-network-e2e-test` វាស់ App ពិតលើ **Firebase** តែប៉ុណ្ណោះ · Supabase វាស់តែកម្រិត adapter ក្នុង node ➜ ថ្នេរ adapter ↔ App
  (`.info/connected` · ការវាស់ភាពរស់ · `forceDatabaseReconnect()` ➜ `goOffline/goOnline` · ចំណុចស្ថានភាព) គ្មាននរណារត់ពីចុងដល់ចុង។
- **អ្នកយាមថ្មី** `supabase-app-network-e2e-test` ៖ App ZoeW ពិត (build វាស់) + chunk `supabase-backend` ពិត + supabase-js ពិត + fake GoTrue/PostgREST លើ Postgres ពិត
  (migration ពិត) ក្នុង Chromium ៖ ចូលប្រព័ន្ធ · offline ➜ online · server ធ្លាក់ · server **ព្យួរ** · ភ្ញាក់ពី background លើ server ព្យួរ · realtime ងាប់ ➜ ការទាញតាមវដ្ត។
  លទ្ធផល ៖ **១៧/១៧ PASS · គ្មានកំហុស App** (93.5 វិ.) ៖ offline ➜ «ក្រៅបណ្ដាញ» 3 ms · online ➜ ទិន្នន័យ 208 ms · server ធ្លាក់ ➜ ឈប់បៃតង 204 ms · ព្យួរ ➜ ឈប់បៃតង
  ~10.2 វិ. (ការវាស់ភាពរស់ ១០ វិ. មិនមែនពិដាន RPC ២០ វិ.) · ការទាញតាមវដ្ត ~29 វិ.។
- **Mutation ៥ ➜ ក្រហម ៣** ៖ `goOffline()` មិនដាក់ disconnected · ការទាញតាមវដ្តមិនរត់ · ការវាស់ភាពរស់ timeout ➜ «រស់»។ **រស់ ២ (ទ្វារស្ទួន មិនមែនចន្លោះ)** ៖
  `onBrowserOnline()` មិន `requestSync()` (App `online` ➜ `nudgeDatabaseConnection()` + retry timer ភ្ជាប់វិញដែរ) · `onBrowserOffline()` ទទេ (ចំណុចស្ថានភាពអាន
  `navigator.onLine` ផ្ទាល់)។
- **Sentry** ៖ org `zoew` មាន project តែមួយ (`javascript-react`) · **០ issue ក្នុង ៩០ ថ្ងៃ** — Loader ថ្មីនៅតែលើ branch (PR #284 មិនទាន់ merge) ➜ production មិនទាន់ផ្ញើ។
- **នៅសល់ក្នុងជុំ ២ (មិនទាន់វាស់)** ៖ (ក) session Supabase ផុតពេលទូរស័ព្ទដេក (`expireTokens()` + offline + background ➜ App ត្រូវ refresh ដោយខ្លួនឯង មិនបង្ខំចូលម្តងទៀត) —
  សេណារីយ៉ូព្រាងរួច មិនទាន់ដាក់ · (ខ) ចម្លើយ refresh token បាត់ (GoTrue rotation ➜ ចាកចេញ?) — fake server មិនទាន់គាំទ្រ drop លើ `/auth/v1/token` · (គ) realtime
  websocket ពិត (fake បិទ upgrade) · (ឃ) ZTO · SW ក្រោមបណ្តាញខូច មានអ្នកយាមច្រើនរួច ➜ មិនទាន់ស្វែងរកចន្លោះថ្មី។
- **2026-10-04 · Firebase (SDK ពិត + RTDB emulator ពិត + rules ពិត · App ពិតក្នុង Chromium)** ៖
  - **ប្តូរ Config ពីហាង A ទៅហាង B ក្នុងឧបករណ៍តែមួយ** ៖ ហាង B ឃើញតែ ៣ កញ្ចប់របស់ខ្លួន (620 ms) · កូដហាង A ក្នុងទិដ្ឋភាព B **០** · server ហាង B គ្មានការសរសេររបស់ A ➜
    **គ្មានការលេចឆ្លងហាង** (Firebase មួយ Project មួយហាង ➜ `deleteApp()` ផ្តាច់គ្រប់ listener/queue)។
  - **រកឃើញតូច (មិនមែនលុយ · មិនទាន់កែ · ស្នើ)** ៖ បិទកញ្ចប់ពេលក្រៅបណ្តាញក្នុងហាង A ➜ Reconfig ទៅហាង B មុនបណ្តាញត្រឡប់ ➜ SDK បោះចោលការសរសេរដែលរង់ចាំពេល `deleteApp()`
    ➜ ត្រឡប់មកហាង A ៖ កញ្ចប់នៅ «មិនទាន់បិទ» · promise របស់ការសរសេរមិនដែលបញ្ចប់ ➜ គ្មានសារប្រាប់។ Reconfig ត្រូវការ PIN ហើយកម្រធ្វើពេលក្រៅបណ្តាញ ➜ ស្នើ ៖ Reconfig
    ពេលមានការសរសេរមិនទាន់ផ្ញើ ➜ ព្រមាន (មិនទាន់ធ្វើ · រង់ចាំការសម្រេចម្ចាស់គម្រោង)។
  - **G1 លើ Firebase** (token ផុត + securetoken 503 ~៤១ វិ. · ៤១ សំណើ) ៖ ការបិទកញ្ចប់ពេលក្រៅបណ្តាញ **រក្សាទុកលើ server** (1476 ms ក្រោយ auth មកវិញ) · history ៥ ·
    ស្ថានភាពត្រឡប់បៃតង · គ្មាន `permission_denied` ➜ Firebase SDK មិនផ្ញើសំណើគ្មាន token ដូច adapter Supabase មុនកែ។
  - កំហុស `Cannot read properties of undefined (reading 'update')` ក្នុងការវាស់ ៖ ប្រភព `registerServiceWorker()` (`reg.update()`) ក្រោម `serviceWorkers: 'block'` របស់
    Playwright ដែលជំនួស `register()` ដោយ `async () => {}` (resolve `undefined`) ➜ **វត្ថុបុរាណនៃការវាស់** ៖ `register()` ពិតតាម spec resolve ជា
    `ServiceWorkerRegistration` ឬ reject ➜ មិនកែ។

### 2026-10-03 — Deep audit ជុំ ១ ៖ លុយ — outcome `unknown` ➜ ការផ្ទៀងចំណូលដក ២ ដងដោយស្ងាត់ · «ដក» ធ្វើឲ្យកញ្ចប់បាត់ (ZoeW 2.49.2)

- **Baseline** (session · emulator រស់) ៖ `run-all.sh` STRICT ៖ **202 ពេញលេញ · ធ្លាក់ 0 · មួយផ្នែក 0 · រំលង 0** (808 វិ.)។ Sentry ៩០ ថ្ងៃ ៖ event `zone: money` **១**
  (`disconnect` 2026-09-25) · «outcome unknown» **០** ➜ ថ្នាក់ខាងក្រោមជា **អន្ទាក់រង់ចាំ** មិនមែនកំហុសសកម្ម។
- **កំហុស ១ (វាស់ · កែផ្នែកការពិត)** ៖ wrapper Firebase (`txResolveOutcome`) និង adapter Supabase (CAS) **បោះបង់** ការដោះស្រាយក្រោយ ៦០ វិ. ➜ `txOutcome: 'unknown'`។
  `ledgerServerVerdict()` ចាត់ការបដិសេធទាំងអស់ជា «មិនបានអនុវត្ត» ➜ `correctRevenueLedgerToActual()` ដក delta ម្តងទៀត ហើយ `alignMonthlyLedgerToDaily()` ដាក់ខែតាមថ្ងៃ 0
  ➜ ពេល server បានដករួច ៖ **ថ្ងៃ 100 ➜ 90 · ខែ 95 · `ok: true`** (`tx-outcome-test` harness · `applied-disconnect` + `restDown`)។ ⛔ ការទាយទិសផ្ទុយ («កុំប៉ះលុយ»)
  **ត្រូវបដិសេធដោយការវាស់** ៖ មុន/ក្រោយ ១៥០ ករណី (ថ្ងៃ×ខែ × ok/applied/lost/foreign/denied × REST រស់/ងាប់ × delta ៣) ➜ ល្អជាង ១៥ · **អាក្រក់ជាង ៣៦** (សំណើមិនដល់
  server ➜ ការដកបាត់)។ ដូច្នេះការកែ 2.49.2 ប៉ះតែ **សាលក្រម** ៖ `ledgerRejectionVerdict()` (`txOutcome === 'unknown'` + `txServerUnread`) ➜ `ok: false` ·
  លុយ **១៥០/១៥០ ដូចមុន** · `ok` ពិត➜មិនពិត ៦៣ (សុទ្ធតែ unknown) · មិនពិត➜ពិត ០ · «`ok` តែលុយខុស» **២៧ ➜ ០**។ `unknown` ដែល server **អានបាន** (ឧបករណ៍ផ្សេង
  សរសេរ ៖ ផ្នែក ៤ខ) មិនមែន `txServerUnread` ➜ ឥរិយាបថដើម។ Mutation ៦ ➜ ក្រហម ៦ ៖ verdict `null` · មិនអើពើ `txServerUnread` · ដកឃ្លា `ok` · align មិនបញ្ជូនទង់ ·
  wrapper មិនដាក់ទង់ (`tx-outcome-test`) · adapter មិនដាក់ទង់ (`emu/supabase-adapter-parity`)។ បន្ទាត់ «ការកែរបស់ reconcile ខ្លួនឯង unknown ➜ មិន ok» ជា mutant ស្មើ
  (`unknownOutcome` គ្របរួច) ➜ ដកចេញ មិនទុកកូដដែលគ្មានអ្នកវាស់។
- **កំហុស ២ (វាស់ · កែរួច)** ៖ `removeSingleBarcode()` ពេល transaction ប្រវត្តិ `applied-disconnect` + អាន server មិនបាន ➜ late `onFailed` ➜ «⚠️ ដកកញ្ចប់
  មិនបានជោគជ័យ!…» ខណៈ server បានដក ➜ **barcode មិននៅប្រវត្តិ · មិននៅធុងសំរាម · ledger មិនដក (100)** · registry នៅ `true` ➜ ស្កេនវិញមិនបាន។ ការសម្អាត
  (`claimAndCleanupItem`) មិនរងព្រោះមាន journal (`resumeInterruptedCleanups()`) ➜ «ដក» ដោយអ្នកប្រើជាផ្ទៃបងប្អូនដែលគ្មាន។
- **ការកែឫសគល់ (ម្ចាស់គម្រោងយល់ព្រម)** ៖ លទ្ធផល *មិនទាន់ដឹង* ≠ *មិនអាចដឹង* ➜ wrapper Firebase (`txResolveOutcome`) អាន REST រហូតអានបាន (ចន្លោះ ២ ➜ ៣០ វិ. ·
  ក្រៅបណ្តាញ ➜ ត្រឡប់ ២ វិ. · ឈប់ពេលប្តូរ auth/database · បដិសេធ HTTP 4xx មានព្រំដែន `TX_OUTCOME_MAX_REFUSALS`) · adapter Supabase ផ្ញើ `op_id` ដដែលរហូតបាន
  ចម្លើយច្បាស់ (ឈប់តែ `close` · កំហុសមិនមែនបណ្តាញក្រោយចម្លើយបាត់ ➜ `unknown` មិនមែន permission ធម្មតា)។ **ទ្វារតាម path** (`txResolvingPaths`) ៖ transaction ថ្មី
  លើ path ដែលកំពុងដោះស្រាយ រង់ចាំ ➜ ការសរសេររបស់ App ខ្លួនឯង (ស្កេនបន្តពេលបណ្តាញដាច់) មិនប្តូរតម្លៃ server មុនការអាន (បើមិនដូច្នេះ T1 ក្លាយជា `unknown` វិញ) ·
  ដោះក្រោយការអានបរាជ័យ `TX_OUTCOME_GATE_RELEASE_FAILS` (៣) ដងពេលលើបណ្តាញ (SDK ដើរ តែ REST មិនដើរ ➜ មិនជាប់ជារៀងរហូត)។ UI មិនព្យួរ ៖ អ្នកហៅមាន `dbOp` +
  `armLateCommit` រួច ហើយសារ «⏳ … នឹងបញ្ចប់ពេលបណ្តាញត្រឡប់មកវិញ» ក្លាយជាការពិត។ អ្នកយាមចាស់ ៣ ដែលចាក់សោ «បោះបង់ក្រោយ ៦០ វិ.» ត្រូវប្តូរជាអត្ថន័យថ្មី ៖
  `tx-outcome-test` ផ្នែក ២ · `ZoeW/tests/tx-outcome-timeout.test.ts` · `emu/supabase-adapter-parity` · harness `history-patch-retry-test` ៖ «ភ្ជាប់មកវិញ» = browser + SDK +
  REST ត្រឡប់មកជាមួយគ្នា (មុននេះ fetch ធ្លាក់ជារៀងរហូត ➜ ទ្វាររារាំងការ flush)។ លេខ ៖ `tx-outcome-test` tree មុនកែឫស **FAIL ២២ ➜ ៩២/៩២** · vitest adapter ថ្មី
  **ធ្លាក់ ២/៥ ➜ ៥/៥**។ Mutation ៨ ➜ ក្រហម ៨ ៖ បោះបង់ក្រោយ ៣០ ដងវិញ · គ្មានទ្វារ · ទ្វារមិនដោះពេលជាប់ (មុនកែអ្នកយាម ៖ **រស់** ព្រោះ T2 ចាប់ផ្តើមមុន T1 បដិសេធ) · បដិសេធ
  គ្មានព្រំដែន · មិនអើពើការប្តូរ auth · adapter បោះបង់ក្រោយ ៣ ដង · គ្មានការ reset ចន្លោះពេលក្រៅបណ្តាញ (មុនកែអ្នកយាម ៖ **រស់** ព្រោះ harness បង្រួម timer ➜ កត់ចន្លោះ
  ដែលស្នើ) · កំហុស 403 ក្រោយចម្លើយបាត់ (vitest)។
- **ចន្លោះដែលនៅសល់ (ចេតនា)** ៖ Firebase ៖ **ឧបករណ៍ផ្សេង** សរសេរ path ដដែលខណៈបណ្តាញយើងដាច់ ➜ server អានបានតែជាតម្លៃគេ ➜ `unknown` (reconcile ធម្មតា ៖ ផ្នែក ៤ខ) —
  ដោះស្រាយពិតត្រូវការប្រវត្តិ `op` ក្នុង node ledger (ប្តូរ rules) · ការសរសេរ `update()` (មិនមែន transaction) មិនឆ្លងទ្វារ · ទំព័របិទខណៈរង់ចាំ ➜ លទ្ធផលបាត់ (ដូច SDK)។
  Supabase ៖ `op_id` ចាស់ជាង ២ ថ្ងៃ (`zoe_ops` លុប) ➜ replay អនុវត្តម្តងទៀត (CAS ➜ conflict ➜ not-applied ព្រោះតម្លៃប្រែ)។
- **សម្មតិកម្មដែលការវាស់/កូដបដិសេធ** ៖ (ក) Supabase `inc` បូកជា `numeric` ➜ CAS conflict ជានិច្ច ➜ **មិនពិត** (`zoe_apply` បូកជា `float8` ដូច JS) · (ខ) `update()` >៥០០ op
  បំបែកជាការសរសេរមិន atomic ➜ ផ្លូវតែមួយដែលលើស គឺ purge ធុងសំរាម (លុបតែប៉ុណ្ណោះ · idempotent · fallback ម្តងមួយ) ➜ គ្មានផលលុយ។

### 2026-10-03 — Supabase ៖ GitHub integration មិនអនុវត្ត migration លើ Project ថ្មី (ឯកសារតែប៉ុណ្ណោះ)

- **រាយការណ៍** (ម្ចាស់គម្រោង) ៖ Project ចាស់ `xrobehzmmwjfxwkjysgg` លុបរួច · Project ថ្មី `igqmfpmhrkvclzjafdov` ភ្ជាប់ GitHub (Working directory `.` · Deploy to
  production បើក · `main`) តែ migration មិនចូល ➜ ម្ចាស់គម្រោងបញ្ចូលដោយខ្លួនឯង។
- **វាស់** ៖ Project ថ្មីបង្កើត 07:39 UTC · push ចូល `main` ចុងក្រោយ 09:23 UTC (merge PR #283 · មិនប៉ះ `supabase/`) · សញ្ញា «Supabase Preview» លើ PR #282
  (05:05 UTC) និង PR #283 (09:10 UTC) នៅចង្អុល Project ចាស់ · logs Postgres ៖ `supabase_migrations.schema_migrations` **មិនទាន់មាន** រហូតដល់ 10:48 UTC ពេល CLI
  (`cli_login_postgres`) បង្កើតវា ➜ integration **មិនដែល** deploy លើ Project ថ្មី។ មូលហេតុ ៖ deploy រត់តែពេលមាន push/merge ចូល `main` ក្រោយការភ្ជាប់ ·
  ការភ្ជាប់មិនអនុវត្ត migration ដែលមានស្រាប់ · គ្មាន push ចូល `main` តាំងពីភ្ជាប់ Project ថ្មី។
- **live ក្រោយការបញ្ចូលដោយដៃ** ៖ `schema_migrations` ១០ = repo ១០ · statement ទាំង ១៣៥ ស្មើឯកសារ `origin/main` (md5 តាម version ក្រោយបំបែកដូច CLI ៖ MATCH ១០/១០) ·
  Edge Functions `register` + `reset-password` v6 (`verify_jwt` បិទ ដូច `config.toml`) ➜ គ្មាន `migration repair` ត្រូវធ្វើ។ ភស្តុតាងថា integration ដើរ ៖ merge
  បន្ទាប់ដែលមាន migration ថ្មី ➜ សញ្ញា ✓ លើ commit merge + version ថ្មីក្នុង `schema_migrations`។
- ឯកសារ ៖ `supabase/README.md` ជំហានទី ២ ប្រាប់ថាការភ្ជាប់មិន deploy ភ្លាម និងរបៀបមើល Project ដែល repo ភ្ជាប់។

### 2026-10-03 — CI ៖ `supabase-docs-cache` រកប្រភពក្នុង root វាស់ · `remember-password` ផុយក្រោមបន្ទុក (audit-tools · តេស្តតែប៉ុណ្ណោះ)

- **CI ផ្នែក ៣/៤ FAIL** ៖ `supabase-docs-cache-test` រក `ZoeW/src/services` ក្នុង root វាស់ (មានតែ text view) ➜ «ប្រភព TS មាន» FAIL ក្នុង 0.0 វិ.។ ការរត់ផ្ទាល់លើ repo
  ជាប់ ➜ អ្នកនិពន្ធមិនបានវាស់តាម run-all។ កែ ៖ `run-all.sh` នាំចេញ `DOCSCACHE_APP_DIR=$REPO` ដូច checker កម្រិត repo ផ្សេង (`ZOEWSUITE_APP_DIR`) ·
  ថតទទេ (`checker-coverage`) នៅធ្លាក់។
- **`remember-password.test.tsx` ធ្លាក់ ១ ក្នុង run-all ពេញក្នុងម៉ាស៊ីន** (agent ៩ រត់ស្របគ្នា) តែជាប់ ៣/៣ ម្នាក់ឯង និង ៤ ស្រប ៖ `settle()` រង់ចាំ ៦ ជុំ `setTimeout` ថេរ ខណៈ
  ការបំពេញពាក្យសម្ងាត់ពឹង WebCrypto ពិត។ វាស់ ៖ crypto យឺត ៤០ms ដោយចេតនា ➜ `settle()` ចាស់ **FAIL ៦/១៣** ➜ ថ្មី (រាប់ការងារ async ពិត ៖ IndexedDB ក្លែង + `crypto.subtle`
  តាម Proxy · រង់ចាំរហូតស្ងប់ · អះអាង `asyncPending === 0`) **១៣/១៣**។ `login-routing.test.tsx` ធ្លាក់ដូចគ្នាក្នុង run-all ក្រោយមក (`routePendingInvite()` រង់ចាំ
  `crypto.subtle.digest`) ➜ helper រួម `ZoeW/tests/async-settle.ts` (`trackCryptoSubtle` · `beginAsync` · `settleAsync`) · crypto យឺត ៖ ចាស់ **FAIL ៦/១៦** ➜ ថ្មី **១៦/១៦**។ `sw-backend-chunk` FAIL ១ ក្នុងការរត់នោះដែរ ➜ វាស់ឡើងវិញម្នាក់ឯង (ផ្នែក ១ [2.49.0] អ្នកយាម)។

### 2026-10-03 — Supabase ៖ ការទាញពេញវិលចាប់ផ្តើមម្តងទៀត · ការទាញបាត់ពេលចូល · doc ខ្មោច · cache IndexedDB (ZoeW 2.49.0 · Handoff ៤)

- **ការទាញពេញវិល** ៖ `zoe_pull` ចាត់ `0 < since < purged_seq` ជា cursor ចាស់ ➜ reset ➜ ទំព័រទី ២ នៃការទាញពេញ (since = ព្រំទំព័រទី ១) ត្រូវ reset ម្តងទៀតពេល
  `purged_seq` លើសព្រំនោះ ➜ ទទួលទំព័រទី ១ រហូតដល់ ១០០០ ទំព័រ ➜ `ready` លើទិន្នន័យកន្លះ។ លក្ខខណ្ឌ ៖ doc រស់ > `SB_PULL_PAGE` (២០០០) **និង** housekeeping purge
  (tombstone ចាស់ជាង ៧ ថ្ងៃ)។ live (អានតែចំនួន) ៖ doc រស់ ៦០៦ · tombstone ១៩៦ · `purged_seq` ០ ➜ មិនទាន់កើត។ ការកែ ៖ `p_full_head` (head ពីទំព័រ reset) ➜ ការបន្តមានសុពលភាព
  បើ `purged ≤ full_head ≤ head` (tombstone ក្រោយ full_head មិនទាន់ purge ទេ ព្រោះ purge យកតែចាស់ជាង ៧ ថ្ងៃ) · ទំព័របន្តបញ្ជូន tombstone `> full_head` ·
  ចម្លើយមាន `head` + `tenant` · `drop function` + `create` ក្នុង migration តែមួយ (PostgREST មិនច្រឡំ overload)។
- **ការទាញបាត់ពេលចូល** (រកឃើញពេលសរសេរ vitest) ៖ `runSync()` ផ្លូវមិនទាន់ចូល `break` ក្រោយ `ping` ➜ `requestSync()` ពី `setAuthed(true)` កំឡុង ping បាត់ ➜ **០** សំណើ
  `zoe_pull` (រង់ចាំ realtime `SUBSCRIBED` ឬ `visibilitychange`)។ កែ ៖ `continue` ក្រោយ ping ជោគជ័យ (បរាជ័យ ➜ `break` + retry ដូចមុន)។
- **doc ខ្មោចក្រោយ reset ច្រើនទំព័រ** ៖ `applyPull()` ទុកធាតុ `s > res.seq` ពេល reset ➜ ទំព័រទី ១ មាន `res.seq` = ព្រំទំព័រ ➜ doc ក្នុងសតិដែលលុបមុនការទាញ (tombstone ≤ head
  ឬ purge រួច) នៅជាប់។ កែ ៖ ទុកតែ `s > max(res.seq, res.head)` (ការសរសេរក្រោយ snapshot)។
- **cache** ៖ `supabase-docs-cache.ts` (IndexedDB · `openIdbStore()` រួមជាមួយ `crypto.ts` ➜ `core/idb-store.ts` · `code-duplication-test` ចាប់ការស្ទួន ៣១៥ តួ)
  · seed មុនការទាញ · ផ្ទៀង `tenant` មុនអនុវត្ត delta · reset លើ cache ➜ សម្អាតទាំងអស់ (cursor លើស head ពេល DB ស្តារ) · `cacheGeneration` ➜ ការរក្សាទុកដែលចប់ក្រោយចាកចេញ ➜ លុបម្តងទៀត
  · `forgetSupabaseDocsCache()` ក្នុង `clearSensitiveModalFields()`។ ការវាស់ ៖ IndexedDB ពិត ៧០០ doc រក្សាទុក+ផ្ទុក ១០ ms · open ព្យួរ ➜ null ៣ ០០២ ms ·
  adapter-parity ៖ ទាញពេញ ≥ ១២ ជួរ ➜ បើកម្តងទៀតតែ ≤ ២ ជួរ · សមាជិកផ្លាស់ហាង ➜ ចម្លើយ tenant ថ្មី ➜ ទាញពី 0។

### 2026-10-03 — CI ៖ `exit-code-integrity` លើសពិដាន 300s លើ runner CPU ២ (audit-tools តែប៉ុណ្ណោះ)

PR #282 ផ្នែក 1/4 ៖ `exit-code-integrity (meta)` «ព្យួរ — លើសពិដាន 300s»។ បង្កើតឡើងវិញ ៖ `EXITCODE_CONCURRENCY=2` (ដូច CI) ➜ ពុល ១១៥ checker ក្នុង **២៥៧ វិ.**
លើម៉ាស៊ីន ៤ CPU (CI យឺតជាង ➜ លើស) · CPU ពិតតែ ៧៩ វិ. ➜ កូនរង់ចាំ timer · lane ២ = ១ សម្រាប់ `emu/*` + ស្របគ្នាតែ ១។ `taskset -c 0,1` + lane ៤ ➜ **៩១ វិ.**
ហើយពេលកូនយឺតជាងគេដដែល (write-stall-guard ៣៨.៧ វិ. · cleanup-interrupt ២៣.៩ វិ.) ➜ អប្បបរមា lane ៤ ⛔ មិនបង្កើន `CHECKER_TIMEOUT`។

### 2026-10-03 — backup ហាង Supabase · CLI ផ្ទេរ Firebase ➜ Supabase (Handoff ៣ក · ៤ខ)

- **ទម្រង់តែមួយ** ៖ ហាងនីមួយៗ = មែកធាង RTDB `{root: {key: value}}` (ដូច export Firebase របស់ហាងមួយ) + manifest (tenant · seq · ពេល export) · គ្មាន secret/hash/គណនី។
- **Server** ៖ migration `20261003120000_zoe_admin_export.sql` ៖ `zoe_admin_tenants` · `zoe_admin_export` (service_role តែប៉ុណ្ណោះ · anon/authenticated ➜ permission denied ·
  keyset `(seq, root, key)` · ≤ ២០០០ ជួរ · ≤ 4 MiB · tombstone ដែល seq លើសពេលចាប់ផ្តើម ➜ ការ export ត្រឹមត្រូវទោះហាងកំពុងសរសេរ · purge ចំពេល ➜ បរាជ័យ ឲ្យរត់ម្តងទៀត)។
- **backup** ៖ `ZOE_BACKUP_TARGETS` ទទួល `{"type":"supabase","name":…,"url":"https://<ref>.supabase.co","secretKey":"sb_secret_…"}` ➜ ឯកសារមួយក្នុងមួយហាង ➜ `crypt.js seal`
  ដូច Firebase (plaintext មិនដល់ artifact) · secret key ក្រៅ checkout ហើយលុបជានិច្ច · គោលដៅមួយធ្លាក់មិនបញ្ឈប់គោលដៅផ្សេង តែ job ចប់ក្រហម។
- **CLI** `tools/supabase-migrate/` ៖ dry-run លំនាំដើម (ចំនួន/ទំហំតាម root · រូបរាងតាម rules) · `--apply` · ហាងមានទិន្នន័យផ្សេង ➜ បដិសេធ លើកលែង `--replace` ·
  `zoe_admin_write` ជាបាច់មានព្រំដែន · op id = hash ខ្លឹមសារ (ចម្លើយបាត់ ➜ op id ដដែល ➜ មិនអនុវត្ត ២ ដង) · ផ្ទៀង export ក្រោយសរសេរ (ស្មើគ្រប់ root) · ការសរសេរពីឧបករណ៍ផ្សេង
  ចំពេលនាំចូល ➜ exit ≠ 0។ ស្តារ backup = CLI លើឯកសារ `.enc` ដែលបើករួច។
- **វាស់** ៖ `supabase-data-tools-test` (ឧបករណ៍ពិតជា child process · Postgres ពិត · fake PostgREST · ខ្សែ CI ពេញ ៖ ci-config ➜ backup ➜ seal ➜ ស្កេន plaintext ➜ នាំចូលហាងទី ២ ➜
  backup ម្តងទៀត ➜ ដូចគ្នាបេះបិទ · mutation SQL/JS) ៖ **១០០/១០០** · supabase-rls ៤៥០ · firebase-backup ៩៦។ សាងដោយ agent ក្នុង worktree · agent ឈប់ដោយ session limit មុនរាយការណ៍ ➜
  Claude បញ្ចូលលើ branch បច្ចុប្បន្ន (ដោះ `supabase/README.md`) · រត់ checker ឡើងវិញ · អានកូដ `supabase.js` · `migrate.js` · `ci-config.js` · `backup.yml` ដោយផ្ទាល់។
- **សកម្មភាពដោយដៃ** ៖ migration `20261003120000` (ជាមួយ migration ថ្មីផ្សេងទៀត) ➜ secret `ZOE_BACKUP_TARGETS` បន្ថែមគោលដៅ Supabase (secret key ពី Supabase Dashboard ➜ API Keys) ➜
  Run workflow **Backup** ម្តង ➜ ទាញ artifact ➜ `crypt.js open` ➜ `node tools/supabase-migrate/migrate.js <ឯកសារ>` (dry-run) ដើម្បីសាកស្តារ។

### 2026-10-03 — ឡើងកំណែ dependency · CI (សំណើម្ចាស់គម្រោង ៖ «update version អ្វីៗទាំងអស់ទៅជំនាន់ចុងក្រោយ»)

- **npm (ក្នុង range ដដែល)** ៖ ZoeW ៖ `@capacitor/app` 8.1.2 · `@capacitor/filesystem` 8.1.4 · `@capacitor/push-notifications` 8.1.3 · `@capacitor/share` 8.0.3 ·
  `@capgo/capacitor-native-biometric` 8.7.0 · `@types/node` 26.6.4 · `eslint` 10.12.0 · `globals` 17.13.0 · `typescript-eslint` 8.71.0 · `vite` 8.3.2 · `vitest` 5.0.3 ·
  supabase ៖ `pg` 8.23.1 · `tools/firebase-provision` ៖ `firebase-tools` 15.32.1 (pin ពិតប្រាកដ)។ ទាន់ចុងក្រោយស្រាប់ ៖ Firebase SDK 12.19.0 (npm + gstatic ក្នុង App ទាំង ២) ·
  supabase-js 2.117.2 (App + Edge) · React 19.3.0 · Capacitor core/android/cli 8.5.2 · zxing-wasm 3.1.4 · SheetJS 0.20.3 · playwright-core 1.63.0។ `npm audit` ៖ 0។
- **មិនឡើង (ហេតុផលវាស់បាន)** ៖ TypeScript 7.0.2 — `typescript-eslint` 8.71.0 ទាមទារ `typescript < 6.1.0` ➜ នៅ 6.0.3 · Postgres តេស្ត 18 — live ជា 17.11
  (`supabase/config.toml` `major_version = 17`) ➜ នៅ 17 · Gradle/AGP/SDK — នៅលើបន្ទាត់ template Capacitor 8.5.2 (`android:check`) · Java APK 21 (Gradle 8.14 មិនរត់លើ Java 25) ·
  Netlify ៖ proxy បិទ docs.netlify.com ➜ ម្ចាស់គម្រោងផ្ញើរូបថត docs ៖ «New sites now default to Node.js 24 for both builds and Netlify Functions» ➜
  `ZoeW/netlify.toml` `NODE_VERSION` 22 ➜ **24** ក្រោយវាស់ function ទាំងអស់លើ Node 24 (zto-proxy ១៥១ · zto-budget ៥៩ · zto-cookie-store ៩១ · zto-cookie-session ·
  zto-list-sync ៣៧០ · zto-signed-status ៥៧ · zto-negative-cache ៣៥ · zto-cookie-sync ១៨១ · zto-network-boundaries ១១ · netlify-config-scope ៤៧ · push-server ក្នុង zoew-suite)។
- **CI** ៖ `actions/checkout` v7 · `setup-node` v7 · `setup-java` v6 · `cache` v6 · `upload-artifact` v7 (input ដែលប្រើទាំងអស់មានក្នុង `action.yml` ថ្មី · runtime node24) ·
  Node 22 ➜ **24 LTS** · Java emulator 17 ➜ 21 (ដូចម៉ាស៊ីនវាស់) · `backup.yml` ៖ `package-manager-cache: false` (job ប៉ះ secret)។
- **វាស់** ៖ ក្រោយឡើង ៖ zoew-suite (tsc · lint · vitest · native · android) · zoew-parity · supabase-rls ៤២៧ · supabase-functions ២៣៣ · supabase-datastore ១១៣ ·
  keygen-supabase-admin ១០០ · firebase-provision ៩៣ (`firebase-tools` ពិត) · sw-* · csp ៖ ជាប់ទាំងអស់។ **Node 24.21.0** (binary ពី npm) ៖ zoew-suite · parity · money-guardian ·
  exit-code-integrity · hang-guard · Supabase · firebase-provision ៖ ជាប់ទាំងអស់។ agent ឡើងកំណែដំបូងឈប់ដោយ session limit ➜ Claude ធ្វើផ្ទាល់។

### 2026-10-03 — Supabase ៖ register កូដប្រើរួច · ការប្រណាំង admin ៣ (ZoeW 2.49.0 · ZoeKeyGen 2.24.3)

- **register កូដប្រើរួច (Handoff ជំហាន ២ នៅសល់)** ៖ `invite_is_usable()` = false ➜ 403 មុនការផ្ទៀងអ្វីទាំងអស់ ហើយ DB មិនកត់ថាកូដណាចុះឈ្មោះសមាជិកណា ➜ ការសាកម្តងទៀត
  ពិតប្រាកដបង្ហាញខ្លួនមិនបាន។ ការកែ ៖ `tenant_members.invite_code_hash` · `spent_invite_member()` (service_role · អានតែប៉ុណ្ណោះ · កូដប្រើអស់/ផុតក្រោយប្រើ · មិន revoke ·
  ហាងសកម្ម · hash + ហាង + role ស្មើ) · Edge សួរ DB មុន ➜ sign-in តែពេល DB ឃើញ username នោះ (កូដមិនធ្លាប់មាន ➜ គ្មាន sign-in ➜ គ្មាន oracle ថ្មី)។ មុនកែក៏វាស់ឃើញ
  `finish_registration` ឆ្លើយ «registered» ហាង A ចំពោះកូដ owner ប្រើបានរបស់ហាង B ➜ ឥឡូវ `username-taken`។ ប្រៀប `handleRegister` ចាស់/ថ្មី ៩០៧២ ករណី ៖ ខុសតែផ្លូវ
  កូដប្រើមិនបាន (៥០៤) និងផ្លូវបន្ត (៦)។ សមាជិកមុន migration (`invite_code_hash` NULL) គ្មានផ្លូវនេះ (ចូលធម្មតា)។ សាងដោយ agent ក្នុង worktree · អ្នកពិនិត្យ agent ឈប់ដោយ
  session limit ➜ Claude ពិនិត្យ diff ផ្ទាល់ ហើយរកឃើញថាការរកឃើញ audit ទី ១ នៅមិនទាន់កែ ➜ កែបន្ថែម (ខាងក្រោម)។
- **ការរកឃើញ audit SQL គណនីទាំង ៣ ត្រូវកែ (guard មុន · Postgres 17 ពិត · ២ ការតភ្ជាប់)** ៖ (១) retry ដំណាលគ្នា ➜ `invite-invalid` ➜ rollback លុបគណនី ៖ `perform … for update`
  លើកូដមុនពិនិត្យសមាជិកភាព (READ COMMITTED ➜ statement បន្ទាប់ឃើញសមាជិកភាពដែល commit) · (២) ZoeKeyGen ពន្យារពីបញ្ជីចាស់ ➜ CAS លើ `expires_at` (ZoeKeyGen បញ្ជូន string
  ពី PostgREST ត្រឡប់ទៅវិញដោយមិនឆ្លង `Date` ➜ microsecond មិនបាត់) · (៣) `admin_issue_reset_code` ចាក់សោជួរសមាជិក។ អន្ទាក់ ៖ fake PostgREST បំប្លែង `timestamptz` ជា `Date`
  (millisecond) ➜ CAS បរាជ័យក្នុងតេស្តតែមិនមែនលើផលិតកម្ម ➜ fake ទទួល `pgTypes` ហើយបញ្ជូនទម្រង់ PostgREST ពិត។ mutation ចាស់ ២ របស់ `admin_issue_reset_code` ចង្អុល body ចាស់
  (ត្រូវជំនួសដោយ `create or replace`) ➜ រំលង ➜ ផ្លាស់ anchor ទៅ body ថ្មី។ `sqlFunctionBody()` ក្នុង `keygen-supabase-admin-test` អានរាល់និយមន័យ (public · private · replace)។

### 2026-10-03 — Supabase deep audit ជុំ ២ ៖ ⏸️ ផ្អាកតាមសំណើម្ចាស់គម្រោង (ធ្វើតែផ្នែក SQL គណនី)

ម្ចាស់គម្រោងថា ជុំមុន «លឿនពេក» ➜ ជុំនេះមាន finder ឯករាជ្យ ៩ ផ្នែក (Postgres ពិត · probe · live អានតែប៉ុណ្ណោះ) និង agent ផ្ទៀង ២ នាក់ក្នុងមួយការរកឃើញ (សាកបង្កើតឡើងវិញ · បដិសេធ)។
ម៉ាស៊ីនមាន CPU ៤ ➜ workflow នីមួយៗរត់បានតែ ២ agent ➜ យឺត ➜ ម្ចាស់គម្រោងស្នើ **ទុក audit Supabase ធ្វើពេលក្រោយ ហើយបន្តការងារកូដ**។
- **ចប់ ៖ ផ្នែក SQL គណនី** (tenancy · definer_private · reset_claim · Edge `register`/`reset-password` · ZoeKeyGen admin · `my_account` ក្នុង Netlify) ៖ RLS/grant គ្រប់តារាង ·
  definer ទាំងអស់ `search_path=''` + REVOKE · admin មកពី `platform_admins` តាម `auth.uid()` (មិនមែន JWT claim) · គ្មានផ្លូវ member ➜ owner · `my_account` មិនឆ្លងហាង ·
  សមាជិកហាង A + invite ហាង B ➜ នៅហាង A (invite B មិនប្រើ · វាស់) · ហាងបិទ ➜ `zoe_write` forbidden (វាស់) ៖ **ត្រឹមត្រូវ**។ រកឃើញ ៣ (វាស់ដោយ finder លើ Postgres 17 ពិត ·
  **មិនទាន់ផ្ទៀងដោយ agent ឯករាជ្យ**) ៖
  1. (low) **ចុះឈ្មោះ ៖ rollback លុបគណនីដែលសំណើដំណាលគ្នាទើបចុះឈ្មោះរួច** ៖ `finish_registration` ពិនិត្យសមាជិកភាពមុនចាក់សោ invite ➜ (ក) retry ខាងក្នុងក្រោយពិដាន ៨ វិ. ខណៈ
     ការហៅទី ១ នៅរត់ · (ខ) App ផុត ២០ វិ. ➜ ចុះឈ្មោះម្តងទៀត ➜ សំណើទី ២ «registered» រួចសំណើទី ១ ទទួល `invite-invalid` ➜ `deleteUser` ➜ គណនីបាត់ · invite ប្រើអស់។
     probe ៖ `{authUser:0, member:0, used_count:1}` · ការកែ (`for update` លើ invite មុនពិនិត្យសមាជិកភាព) ➜ `{1, 1, 1}`។
  2. (low) **ZoeKeyGen ពន្យារហាង ៖ សរសេរ `expires_at` ដាច់ខាតពីជួរ cache** ➜ ឧបករណ៍ ២ ពន្យារ +365 និង +7 (ជួរចាស់) ➜ សល់ +7 (បាត់ ៣៦៥ ថ្ងៃដោយស្ងាត់)។
  3. (info) **`admin_issue_reset_code` ដំណាលគ្នា ➜ កូដ reset ២ នៅប្រើបានសម្រាប់សមាជិកម្នាក់** (មិនចាក់សោជួរសមាជិក)។
- **មិនទាន់ធ្វើ** ៖ datastore/rules · adapter ↔ SDK · transport/realtime · ការចូលក្នុង App · Edge/Netlify identity · ZoeKeyGen panel · live ↔ repo · លុយលើ Supabase ➜ Handoff។
  Script workflow (finder ៩ + ផ្ទៀង ២ មុខ) ទុកក្នុង session នេះ ➜ ជុំក្រោយប្រើ prompt ដដែល (ផ្នែកនីមួយៗ · ច្បាប់ «អានតែប៉ុណ្ណោះលើ live»)។

### 2026-10-03 — Supabase audit (Handoff ជំហាន ៣) ៖ live · SQL · adapter · Edge · ZoeKeyGen · ops

វាស់លើ live (read-only · Project `ZoeW` · Postgres 17.11) និងកូដ ៖
- **deploy/ops ៖ migration `20261002154730` អនុវត្តតាម SQL Editor តែ version មិនកត់** (live ៤ ធៀប repo ៥) ➜ merge នឹងធ្វើឲ្យ GitHub integration អនុវត្តម្តងទៀត
  ➜ `add column claim_id` ធ្លាក់។ Claude កត់ version តាមសំណើម្ចាស់គម្រោង ➜ ៥/៥។ ⛔ ការបិទភ្ជាប់ SQL ត្រូវតាមដោយ repair ជានិច្ច (ច្បាប់មានក្នុង `CLAUDE.md` ·
  អ្នកយាមស្តាទិច `supabase-datastore-test` មើលមិនឃើញ live)។
- **deploy/ops ៖ ទិន្នន័យហាង Supabase គ្មាន backup** — `firebase-backup/` · `backup.yml` គ្របតែ Firebase RTDB ➜ សំណើ (ត្រូវការ secret DB/secret key ពីម្ចាស់គម្រោង)។
- **SQL/realtime** ៖ policy broadcast `zoe_tenant_broadcast_read` មាន · broadcast ឯកជន ១១៩ ក្នុង ២៤ ម៉ោង (ហាង ១ · `seq` ២៤៣៣ · `zoe_docs` ៧៣៦ kB ·
  `zoe_ops` ២៦៦៣ ជួរ/២ ថ្ងៃ)។ Advisors ៖ WARN Leaked Password Protection (Pro) · INFO `zoe_ops` គ្មាន policy (ចេតនា) · INFO FK `created_by` គ្មាន index (២ តារាងតូច)។
- **adapter ៖ ការសរសេរធម្មតា (`set`/`inc`) សាកម្តងទៀតគ្មានពិដានពេលដោយ `op_id` ដដែល · `zoe_ops` លុបក្រោយ ២ ថ្ងៃ** ➜ ឧបករណ៍ក្រៅបណ្តាញ >២ ថ្ងៃ
  (ទំព័រនៅរស់) ក្រោយចម្លើយបាត់អនុវត្តម្តងទៀត ៖ `set` = អ្នកសរសេរចុងក្រោយឈ្នះ (ដូចជួរ offline របស់ SDK Firebase) · `inc` លុយមានតែក្នុង
  `finalizeClaimedRestore()` ដែល rules ទាមទារធាតុធុងសំរាម + លុបវាក្នុងការសរសេរដដែល ➜ replay ត្រូវបដិសេធ · transaction (CAS) មានពិដាន ៦០ វិ. ➜ `unknown`។
  ➜ មិនមែនកំហុសលុយ · មិនកែ (ការអានកូដ + អ្នកយាម rules មានស្រាប់ `emu/restore-mutation-emu-test` · `emu/supabase-rules-parity`)។
- **Edge ៖** register/reset (2.48.2 · 2.49.0) · CORS តាម origin · secret មិនលេច — អ្នកយាម `supabase-functions-test`។
- **ZoeKeyGen/Netlify ៖** CSP `connect-src` ទាំង ២ App អនុញ្ញាត `https://*.supabase.co` (+ `wss` លើ ZoeW) · session Admin Supabase នៅក្នុងសតិតែប៉ុណ្ណោះ
  (មិនរក្សាក្នុង storage) · ផុតតាម JWT (~១ ម៉ោង) · ចាកចេញ revoke ➜ ខ្សោយជាង Signing Key (ស្ងៀម ១៥ នាទី) បន្តិច ➜ សំណើ។
- **Egress ៖** adapter ទាញ `zoe_docs` ទាំងអស់រាល់ការផ្ទុកទំព័រ (៧៣៦ kB មុន gzip សម្រាប់ហាង ១) ➜ Handoff ជំហាន ៤ (IndexedDB)។

### 2026-10-03 — chunk `supabase-backend` ចេញពីហាង Firebase (ZoeW 2.49.0 · សេចក្តីសម្រេចម្ចាស់គម្រោង)

គ្មានអ្នកយាមណាវាស់ថា «ឧបករណ៍ណាទាញ chunk Supabase» ➜ សាង `sw-backend-chunk-test` មុន ៖ tree មុនកែ **FAIL ៣** (ហាង Firebase ទាញ chunk ពេល install
និងរាល់ update) · ទិស Supabase (ក្រៅបណ្តាញ) ជាប់រួច។ SW មិនអាន `localStorage` (Config) ➜ ការសម្រេចពីប្រវត្តិ cache ខ្លួនឯង ៖ fetch handler កត់សញ្ញាប្រើ ·
install អាន cache ចាស់មុន `activate` លុបវា។ អន្ទាក់ ៖ សញ្ញាដែលកត់តែពេល fetch មិនគ្រប់ ➜ ទំព័របើកជាប់ពី A ➜ B ➜ C (chunk ផ្ទុកក្នុងសតិក្រោម A) ➜ C ខ្វះ chunk ➜
បើកក្រៅបណ្តាញធ្លាក់ ➜ install ផ្ទេរសញ្ញាដែលមានពិត (មិនមែនពីការសន្និដ្ឋាន cache មុនកែ បើមិនដូច្នេះហាង Firebase ទាញជារៀងរហូត)។ តេស្តដំបូងរបស់ខ្ញុំ
រំលង mutation «គ្មានការផ្ទេរ» ព្រោះការផ្ទុកក្រោម B សរសេរសញ្ញាឡើងវិញ ➜ តម្រៀបតេស្តឲ្យ update ២ ដងជាប់គ្នា ➜ mutation ៧/៧។ `build-audit.mjs` ស្គាល់បញ្ជីទី ៣។

### 2026-10-03 — modal ZoeKeyGen ចង្អៀតលើ desktop · ខ្សែរមូរ iOS (ZoeW 2.49.0 · ZoeKeyGen 2.24.3)

`layout-check` វាស់តែ «modal មិនលើសអេក្រង់» ➜ ជាប់ទោះ modal ZoeKeyGen ទទឹង px ថេរ ខណៈ `--fs-unit` ឡើង 1.0 ➜ 1.35 ៖ ប្រអប់ PIN **២៨៨ ឯកតាអក្សរ** លើ 320px ➜
**២២២** លើ 1920px (modal ទាំង ៦ ចង្អៀតទៅៗពេលអេក្រង់ធំ)។ ZoeW (`clamp(…vw…)`) ៖ ១៥៥ សំណាក tablet/desktop ≥ ទូរស័ព្ទទាំងអស់។ ការកែ ៖ ទទឹង = `--modal-w × --fs-unit`
➜ ឯកតាអក្សរថេរគ្រប់អេក្រង់ (PIN ៣០០u)។ អ្នកយាមថ្មីក្នុង `layout-check` ៖ tree មុនកែ FAIL ១ (ZoeKeyGen) ➜ ១០១/១០១។
ខ្សែរមូរ ៖ iOS WebKit មិនគាំទ្រការកំណត់រចនា scrollbar ➜ indicator គូរដោយ App (state ➜ React) · purity:check ៖ ការសរសេរ DOM ក្រៅច្រក ០។
Android WebView ៖ ជ្រើស indicator ដដែល (មិនប្រើ `::-webkit-scrollbar` ដែលស៊ីទទឹង layout ៣px ជាប់ជានិច្ច) ➜ រូបរាងដូច PWA Android (លេចពេលរមូរ)។

### 2026-10-03 — Supabase register ៖ createUser ឆ្លើយបាត់ ➜ user កំព្រា · retry ➜ username-taken (ZoeW 2.49.0)

មូលហេតុ ៖ `createUser` លើសពិដាន ៨ វិ. តែ GoTrue បង្កើត user រួច ➜ `502 auth-unavailable` · retry ➜ `email_exists` ➜ `409 username-taken` ជារៀងរហូត
(user មាន · គ្មាន `tenant_members` · កូដអញ្ជើញមិនស៊ី)។ ករណីដដែល ៖ App ផុតពិដាន ២០ វិ. ខណៈ Server បញ្ចប់ (កូដប្រើច្រើនដង) ➜ retry ➜ `username-taken`។
ការកែ ៖ `exists` ➜ `passwordUserId()` (GoTrue password grant លើ client ថ្មី មិនមែន admin client រួម ➜ session អ្នកប្រើមិនចូល RPC service) ➜
`finish_registration` (ពិនិត្យ email ↔ username · idempotent) លើ user id ដែល Auth បញ្ជាក់។ មិនបន្ថែម oracle ថ្មី ៖ GoTrue `/token` បើកសាធារណៈរួចដោយ publishable key
ហើយផ្លូវនេះត្រូវការកូដអញ្ជើញដែលប្រើបានរាល់ការសាក។ ⛔ មិនលុបគណនីលើផ្លូវបន្ត (សំណើនោះមិនបានបង្កើតវា)។
លេខ ៖ tree មុនកែ **FAIL ១១** ➜ **២០២/២០២** (supabase-js ពិត · tsc strict) · mutation `account-core` ៥ + `admin-deps` ៥ ➜ ក្រហមទាំងអស់។
តេស្ត logout ព្យួរដំបូងចំណាយ ៣០០ វិ. ក្រោម mutation «logout គ្មានពិដាន» (socket timeout របស់ Node) ➜ ដាក់ពិដាន ៣ វិ. ក្នុងតេស្ត ➜ ក្រុមទាំងមូល ~១១ វិ.។
ចន្លោះនៅសល់ ៖ កូដអញ្ជើញប្រើ ១ ដង + App ផុតពិដានខណៈ Server បញ្ចប់ ➜ retry ➜ `403 invite-invalid` (គណនីដើរ · សារ App ណែនាំសុំកូដថ្មី) — មិនកែក្នុងជុំនេះ។

### 2026-10-03 — បញ្ជាក់ជម្រើស backend ទាំង២

ម្ចាស់គម្រោងបញ្ជាក់ថា ZoeW ត្រូវឱ្យអតិថិជនជ្រើស Firebase ឬ Supabase តាមចិត្ត។ ដកផែនការបិទ Firebase ចាស់ចេញពី Handoff;
រក្សាការគាំទ្រ backend ទាំង២ ហើយ CLI ផ្ទេរទិន្នន័យគឺជាជម្រើស។ កែតែឯកសារ និងច្បាប់; គ្មានកូដ App ឬកំណែប្រែ។

### 2026-10-03 — Supabase reset៖ កូដតែមួយសរសេរពាក្យសម្ងាត់២ដង

មូលហេតុ៖ reset_code_user អានមុន Auth update; consume_reset_code ស៊ីក្រោយ ហើយ idempotent។ Probe លើ account-core ពិតឱ្យសំណើ២ឆ្លងការអានមុនពេល write ➜
Auth updates ២ និងចម្លើយ password-reset ២។ អ្នកយាមថ្មីក្រហមលើកូដមុនកែ; ការកែគឺ claim ក្នុង UPDATE ដែលចាក់សោជួរ មុនទៅ Auth។
លទ្ធផល local៖ Postgres 17.10 ពិត (portable Windows) · supabase-rls ៣៤៣ · supabase-datastore ១១៣ · supabase-functions ១៦៨ · keygen-supabase-admin ៨៨ ជាប់ គ្មាន SKIP។
ZoeW account UI ១៣/១៣ និង typecheck ជាប់។ ការធ្លាក់ mutation ដំបូងពី CRLF ក្នុង checkout ➜ normalize បន្ទាត់ដូច Git blob ហើយជាប់; migration ចាស់មិនមាន diff។
សិទ្ធិ RPC ថ្មីតែ service_role; គ្មាន lease ដោះការកក់ពេល Auth មិនដឹងលទ្ធផល។ Migration ចាស់មិនកែ។

ចន្លោះបន្ទាប់៖ probe createUser យឺត ៣០ms ខណៈ ceiling ៥ms ➜ 502 មុន Auth user កើត; retry ➜ 409 username-taken; finishRegistration ០ និង deleteUser ០។
មិនកែជាមួយ reset ទេ; ទុកក្នុង Handoff ដើម្បីសង់ recovery ដែលមិនលុបគណនីលើលទ្ធផលមិនដឹង។


### សាកសេណារីយ៉ូ «ឧបករណ៍ពិត» ក្នុង Chromium ៖ SDK Firebase នៅទាញសម្រាប់ហាង Supabase (2026-10-02 · ZoeW 2.48.1)

- **ហេតុ** ៖ ម្ចាស់គម្រោងស្នើឲ្យធ្វើ handoff «សាកលើឧបករណ៍ពិត» ជំនួស ➜ ម៉ាស៊ីននេះគ្មាន iPhone/Android ➜ សាកក្នុង Chromium ពិត (ម៉ាស៊ីនដូច WebView Android)
  លើ audit build ពិត · SDK Firebase 12.19.0 ពិត (បម្រើពី `node_modules` ជំនួស gstatic) · Server Supabase ក្លែង (route)។ script មិនចូល repo (ការវាស់មួយដង)។
- **កំហុសពិត** ៖ Config Supabase ➜ **៣ សំណើ** `gstatic.com/firebasejs/12.19.0/*` ពេលបើក App ៖ `index.html` មាន `<link rel="modulepreload">` ៣ ដែល browser
  ទាញដោយឥតលក្ខខណ្ឌ ➜ ការបិទក្នុង `firebase-loader.js` (PR #279) មិនមានឥទ្ធិពល ហើយ `firebase-loader-gate.test.ts` (vitest លើ loader តែម្នាក់ឯង) មើលមិនឃើញ HTML ➜
  សារ 2.48.0 «មិនទាញ SDK Firebase ដែលមិនប្រើ» មិនពិតលើផលិតកម្ម។ ការកែ ៖ ដក link ទាំង ៣ · អ្នកយាម ៖ `npm run smoke` (មុនកែ ៣/៣ ➜ ក្រោយកែ ០/៣)។
- **លទ្ធផលក្រោយកែ** (៥ សេណារីយ៉ូ · គ្មាន `pageerror`) ៖ (១) បើក App ជាហាង Supabase ➜ ០ សំណើ SDK · ប្រអប់ចូល «ឈ្មោះគណនី» · (២) 🔔 «កំណែបច្ចុប្បន្ន ៖ 2.48.1 ✅» +
  ធាតុ update តែ ១ · (៣) ប្តូរ Supabase ➜ Firebase ក្នុងវគ្គដដែល ➜ SDK ទាញតាមតម្រូវការ (៣ module) · ប្រអប់ចូល «អ៊ីមែល» ក្នុង ~១,៥ វិ. · (៤) ប្តូរ Firebase ➜ Supabase
  ភ្លាមក្រោយ Auth ចាប់ផ្តើម ➜ ប្រអប់ចូល Supabase · `authGeneration` មិនប្រែក្រោយការប្តូរ ៣ វិ. (គ្មាន callback ចាស់) · (៥) ចូលប្រព័ន្ធលើបណ្តាញព្យួរ (endpoint token មិនឆ្លើយ)
  ➜ «ភ្ជាប់ Server មិនបានទេ» ក្នុង **១៥,៣ វិ.** · ប៊ូតុងប្រើបានវិញ។
- **នៅតែជាការងារម្ចាស់គម្រោង** ៖ iPhone (WebKit) · Android ពិត · Supabase ពិត (ចុះឈ្មោះ · ស្កេន · ឧបករណ៍ ២) · router ដក cable លើស ១ ម៉ោង។

### Firebase ⇄ Supabase ៖ callback auth ចាស់ប្រណាំងនឹង backend ថ្មី · realtime WebSocket ព្យួរ (2026-10-02 · ZoeW 2.48.1)

- **realtime ព្យួរ (handoff · គ្មានចន្លោះ)** ៖ supabase-js/realtime-js 2.117.2 ពិត តាម `transport.subscribe()` ពិត + WebSocket ក្លែងដែលឈប់ឆ្លើយនៅ ១០ វិ.
  (មិនបិទ) ➜ `CHANNEL_ERROR` នៅ **៥០,១ វិ.** (heartbeat ២៥ វិ. × ២ ➜ `close(1000,'heartbeat timeout')`) ➜ adapter poll រៀងរាល់ ៣០ វិ. ➜ socket ថ្មីឆ្លើយ ➜ `SUBSCRIBED`
  + pull តាមទាន់ភ្លាម ➜ ភាពចាស់អតិបរមា ~៧០ វិ. · គ្មានការព្យួរ ➜ មិនសាងអ្នកយាម (វាស់ហើយ គ្មានចន្លោះ)។
- **ការប្រណាំង (សំណើម្ចាស់គម្រោង ៖ «កុំឲ្យ Firebase និង Supabase ប្រណាំងគ្នា»)** ៖ `initFirebase()` ដាក់ `firebaseState.fb = nextFb` ហើយ `await deleteApp()`
  backend ចាស់ ខណៈ listener auth ចាស់ផ្តាច់តែក្នុង `setupAuthListener()` ចុងក្រោយ។ **វាស់** (firebase 12.19.0 ពិត · node) ៖ `deleteApp()` មុន Auth បញ្ចប់ការចាប់ផ្តើម ➜
  callback `onAuthStateChanged` **រត់ក្រោយ** `deleteApp()` · ផ្តាច់មុន `deleteApp()` ➜ មិនរត់ ➜ ក្នុង ZoeW callback Firebase ចាស់អាចរត់ `proceedAfterLogin` ឬផ្លូវចាកចេញ
  លើ `fb` Supabase។ Supabase `_close()` សម្អាត listener ដោយមិនហៅ (ទិសផ្ទុយមានសុវត្ថិភាព)។ ការកែ ៖ teardown ផ្តាច់ `authUnsubscribe` + `authRecoveryTimeout`
  ដោយ synchronous មុន `await deleteApp()`។ ពិនិត្យបន្ថែម ៖ `window.firebaseSDK` ប្រើតែក្នុង loader (`network.ts` · `firebase-sdk.ts`) ➜ គ្មានផ្លូវទិន្នន័យរំលង `firebaseState.fb`។
- **អ្នកយាម** ៖ `ZoeW/tests/registry-session-race.test.ts` (`initFirebase()` ពិត · SDK ក្លែងតាមការវាស់ ៖ បញ្ជូន callback ក្រោយ `deleteApp()` តែពេលមិនទាន់ផ្តាច់)
  ៖ មុនកែ `expected true to be false` ➜ ក្រោយកែ ៦/៦ · រួម `config-modal` · `login-routing` · `supabase-account` ៤៦/៤៦ · `connection-recovery-test`
  (sandbox រត់ `initFirebase()` ពិត ៖ ប្រកាស `authUnsubscribe`/`authRecoveryTimeout` · ការអះអាងថ្មី «listener auth ចាស់ផ្តាច់មុន deleteApp») ៖
  លើកូដមុនកែ ២១៩ ok · ១ FAIL (តែការអះអាងថ្មី) ➜ ក្រោយកែ ២២០/២២០។

### Audit បណ្តាញ ៖ token Supabase ព្យួរ ➜ RPC ព្យួរគ្មានទីបញ្ចប់ (2026-10-02 · ZoeW 2.48.1)

- **វិធី** ៖ រាប់ `fetch(` ទាំងអស់ក្នុងកូដ ship និង server (`ZoeW/src` · `public/*.js` · `ZoeKeyGen` · `netlify/functions` · `netlify/lib` · `supabase/functions`)
  ហើយសួរ «ពិដាននីមួយៗគ្របអ្វី?»។ ZoeW `fetchWithTimeout` (រួម fallback ផ្លូវចាស់ ៖ signal ដដែល) · SW `timedFetch` · `license-verify.js` ·
  Function ZTO (`settleWithin` លើ `my_account` · certs Firebase · cache គណនីមានពិដាន ៥០០) ➜ មានពិដានទាំងអស់។
- **ចន្លោះ** ៖ `createClient(…, { global: { fetch } })` ប្រគល់ fetch **គ្មានពិដាន** ទៅ supabase-js ហើយ `rpc()` រង់ចាំ `client.auth.getSession()` (ដែលបន្តសម័យ
  ពេល token ផុត) **មុន** POST ដែលមានពិដាន ➜ ពិដាន `timeoutMs` មិនគ្របជំហាន token។ auth-js ចែក refresh តែមួយដែលកំពុងរត់ ➜ refresh ដែលព្យួរម្តង
  រាំងរាល់ការស្នើ token បន្ទាប់ ➜ poll/សរសេររបស់ adapter នៅស្ងៀម រហូតដល់ socket របស់ browser ងាប់ខ្លួនឯង។ `withTimeout` របស់ App (១៥ វិ.) បញ្ចប់តែការរង់ចាំ
  របស់អ្នកហៅ មិនមែនការព្យួរខាងក្នុងទេ។
- **ការវាស់** (bundle `supabase-transport.ts` ពិត + `@supabase/supabase-js` 2.117.2 · node) ៖ session ផុត + endpoint `/auth/v1/token` ព្យួរ ➜
  `rpc('zoe_pull', {}, 1000)` នៅ **pending ក្រោយ ២០ ០១១ ms** (ឃើញតែសំណើ refresh) · ទិសផ្ទុយ (refresh ឆ្លើយ) ➜ ជោគជ័យក្នុង **៥ ms**។
- **ការកែ** ៖ `sbFetchWithCeiling()` (ភ្ជាប់ signal ដើម · abort ពេលផុតពិដាន · អាន body ក្នុងពិដាន) ជា `global.fetch` · `sbWithin()` លើ `getSession()` និង
  `refreshSession()` ក្នុង `rpc()` ➜ ផុតពិដាន = `SbNetworkError('timeout')` (មិនផ្ញើ RPC ដោយគ្មាន token)។ auth-js បន្ត retry refresh ក្នុងបង្អួច ៣០ វិ. របស់វា
  ➜ refresh ដែលព្យួរមិនរស់ហួសបង្អួចនោះទៀតទេ។
- **អ្នកយាម** ៖ `ZoeW/tests/supabase-transport-hang.test.ts` (មុនកែ ១/៤ ➜ ក្រោយកែ ៤/៤) · `supabase-account.test.tsx` ១២/១២ នៅជាប់។
  ⛔ មិនបានរត់ `emu/supabase-adapter-parity` (Postgres ពិត) តាមសំណើសន្សំកូតា ➜ CI (`SUPABASE_STRICT=1`) វាស់។
- **មិនទាន់វាស់** ៖ WebSocket realtime ដែលព្យួរ (adapter មាន poll ជំនួស `SB_POLL_FALLBACK_MS`)។
- **ការផ្ទៀងផ្ទាត់ឡើងវិញ (សំណើម្ចាស់គម្រោង)** ៖ `run-all.sh` ពេញ (`VERSIONSCOPE_STRICT=1` · គ្មាន emulator · គ្មាន `npm ci --prefix supabase`/`tools/firebase-provision`)
  ➜ ធ្លាក់ ២ ៖ (១) `doc-scope-test` ៖ `README.md` · `ZoeW/README.md` · ក្បាលតារាង `docs/AUDIT-PROMPT.md` នៅអះអាង 2.48.0 ក្រោយការឡើងកំណែ ➜ កែ ·
  (២) `zoew-suite` ➜ `purity:check` ៖ `source.addEventListener` លើ `AbortSignal` ក្នុង `sbFetchWithCeiling` ➜ ធាតុលើកលែងដែលមានហេតុផល (ដូច `services/network.ts`)។
  រត់ឡើងវិញ ➜ ២/២ PASS។ មួយផ្នែក ៩ · រំលង ៦ = `emu/*` · checker Postgres/firebase-tools ដែលមិនបានដំឡើងដោយចេតនា ➜ CI វាស់។ ការផ្លាស់ HISTORY ផ្ទៀងដោយ script ៖
  block ទាំង ២ ស្មើ byte ទល់ byte ក្នុង archive · ខ្លឹមសារ archive ចាស់នៅដដែល · គ្មានបន្ទាត់បាត់។

### សម្អាត HISTORY · announcements តែមួយ · audit `.md` (2026-10-02 · ឯកសារ · អ្នកយាម · ទិន្នន័យ feed តែប៉ុណ្ណោះ)

- **សម្អាត `docs/HISTORY.md`** (handoff · ច្បាប់ ១២) ៖ ផ្នែក ១ `[2.42.11]` ➜ `[2.38.0]` (១ ០២២ បន្ទាត់) និងលទ្ធផល parity ឆៅ «ការផ្ទេរ ZoeW
  ទៅ React» (៤៧៥ បន្ទាត់) ផ្លាស់ **ដោយមិនកែ** ទៅ `docs/HISTORY-ARCHIVE.md` ផ្នែក ៦ (ផ្ទៀងដោយ script ៖ `HEAD` ដក ២ block = ឯកសារថ្មី byte ទល់ byte) ·
  `HISTORY.md` ៣ ១៧៩ ➜ ~១ ៧០០ បន្ទាត់ · ក្បាលឯកសារទាំង ២ · `CLAUDE.md` ច្បាប់ ៩ · `docs/AUDIT-PROMPT.md` និយាយត្រូវតាមនោះ · ការសម្រេច
  «មិនផ្ទេរទៅ Supabase» ដែលត្រូវប្តូរដោយ 2.46.0 ទទួលបន្ទាត់ ⛔។
- **លិបិក្រម checker ហួសសម័យ** ៖ script ដេរីវេពីការលេចពិត (regex ដូច `doc-scope-test`) លើ tree មុនកែ ➜ **៥៩ / ១៩៨** ជួរមិនស្មើការពិត
  (ឧ. `action-binding-test` ចុះ «ផ្នែក ១» ក្នុង `HISTORY.md` ខណៈគ្មានក្នុងខ្លឹមសារសោះ) ➜ `doc-scope-test` វាស់តែ «មានជួរ» មិនវាស់ «ផ្នែកត្រូវ» ➜ តារាងបង្កើតឡើងវិញ
  ពីការលេចពិតក្រោយការផ្លាស់ (១៩៧ ជួរ)។
- **`announcements.json`** (សំណើម្ចាស់គម្រោង ៖ «កុំរក្សាទុកច្រើនពេក ប្រាប់តែមួយចុងក្រោយ») ៖ ១៦ ➜ ១ ធាតុ (`2.48.0`)។ អ្នកយាមមុន ៖
  `ZoeW/tests/notifications.test.tsx` «ទុកតែធាតុ update ចុងក្រោយមួយ» ធ្លាក់លើ feed ១៦ ធាតុ ➜ ជាប់ក្រោយកាត់ (២៨/២៨ រួម `seller-notices`) ·
  `doc-scope-test` ជាន់ `noteItems >= 5` ➜ `>= 1` (ជាន់នៅតែបញ្ជាក់ថា feed ត្រូវអាន) · `CLAUDE.md` ជួរ 🔔 ៖ ធាតុ `update` តែមួយ = `APP_VERSION`
  (ការឡើងកំណែជំនួសវា)។ `version-bump-scope` មិនរាប់ feed ជាកូដ ship ➜ គ្មានការឡើងកំណែ · ទៅដល់ App ពេល deploy ZoeW លើកក្រោយ។
- **audit `.md` ធៀបកូដ** ៖ ផ្លូវឯកសារក្នុង backtick នៃ `*.md` ទាំងអស់ (លើកលែងប្រវត្តិ) ធៀប `git ls-files` ➜ ១២ មិនឃើញ ទាំងអស់ដោយចេតនា
  (`ZoeW/app.js` = ទិដ្ឋភាពអត្ថបទនៃ audit build · `audit-tools/emu/real.rules.json` ចម្លងពេលរត់ · `.settings/rules.json` = endpoint emulator · `item.cod/.dod/.price`
  មិនមែនផ្លូវ)។ **secret** ៖ `git grep` private key · `sb_secret_` · JWT `service_role` · Google API key · GitHub/Slack token ➜ ឃើញតែ
  `audit-tools/idtoken-fixture.js` (key តេស្ត)។
- **ការវាស់** ៖ `RUNALL_ONLY=doc-scope-test,version-bump-scope,repository-file-coverage,version-check,sw-client-wiring-test` (`VERSIONSCOPE_STRICT=1`)
  ➜ ៥/៥ PASS · vitest `notifications` + `seller-notices` ២៨/២៨។ មិនបានរត់ `run-all.sh` ពេញ · checker Supabase (សន្សំកូតា) ➜ ទុក CI។
- **សកម្មភាពដោយដៃ** ៖ គ្មាន (feed ថ្មីទៅដល់អ្នកប្រើពេល Netlify deploy `main` ក្រោយ merge)។

### Handoff ក្រោយ merge PR #279 ៖ ផ្ទៀងស្ថានភាព និងវាស់ chunk `supabase-backend` (2026-10-02 · ឯកសារតែប៉ុណ្ណោះ)

- **git** ៖ `origin/main` = `e07b2ef` (merge PR #279) · branch `claude/handoff-remaining-work-ekyw6e` ចាប់ផ្តើមពីវា (`rev-list` ០/០)។
- **CI** ៖ [Audit run 36996655322](https://github.com/mengsroy-h/Zoe-System/actions/runs/36996655322) លើ `e07b2ef` ➜ `success` ·
  [Android APK run 36996655215](https://github.com/mengsroy-h/Zoe-System/actions/runs/36996655215) ➜ `success` · Release `zoew-android-v2.48.0` និង
  `zoew-android-v2.47.1` មានរួច ➜ ធាតុ ⏳ «Release APK ស្វ័យប្រវត្តិ» (secret ៤ · កូតា runner) ដកចេញពីបញ្ជីរង់ចាំ។
- **Supabase** (Project `xrobehzmmwjfxwkjysgg` · អានតាម MCP តែប៉ុណ្ណោះ គ្មានការសរសេរ) ៖ `list_migrations` ➜ ៤ version ស្មើ `supabase/migrations/` ·
  Edge Function `register` · `reset-password` ACTIVE (version 7) · Security Advisor ៖ WARN ១ `auth_leaked_password_protection` (Pro) ·
  INFO ១ `rls_enabled_no_policy` លើ `public.zoe_ops` — ដោយចេតនា ៖ `20261001000200_zoe_datastore.sql` `revoke all` ពី `anon` · `authenticated` ·
  `service_role` ➜ client មិនចូលដោយផ្ទាល់ទាល់តែសោះ (policy មិនចាំបាច់)។
- **chunk `supabase-backend`** ៖ `vite build` លើ `e07b2ef` ➜ `assets/supabase-backend-*.js` ២៤១ ០៧៨ byte (gzip -9 ៖ ៦៣ ៩២២) · `index-*.js` ៥២៣ ៦៥១
  (gzip ១៣៩ ៩៥០) · ឈ្មោះ chunk នៅក្នុងបញ្ជីទីមួយរបស់ `sw.js` (`CORE_SHELL` ៖ regex `^./assets/.*\.(js|css)$` ក្នុង `vite.config.mts`) ➜ អ្នកប្រើ
  Firebase ក៏ទាញវាម្តងក្នុងមួយ `CACHE_VERSION`។ ការផ្លាស់ទៅ `OPTIONAL_SHELL` មិនសន្សំអ្វីទេ (វាក៏ install សម្រាប់អ្នកប្រើទាំងអស់) · ការដកចេញទាំងស្រុង
  ធ្វើឲ្យហាង Supabase បើកក្រៅបណ្តាញមិនបាន ➜ ទុកដដែល · ការសម្រេចផ្សេងជារបស់ម្ចាស់គម្រោង។
- **មិនបានរត់** ៖ `run-all.sh` · checker Supabase (ម្ចាស់គម្រោងស្នើសន្សំកូតា) ➜ ជុំ audit Supabase ច្រើនជុំនៅ ⏸️ ក្នុង handoff។
- **សកម្មភាពដោយដៃ** ៖ គ្មាន។

### CI របស់ PR #279 ៖ ភាពខុសគ្នា loader ដែលមានចេតនា (2026-10-02 · audit-tools និងឯកសារតែប៉ុណ្ណោះ)

- **ភស្តុតាង** ៖ [Audit run 36992474164](https://github.com/mengsroy-h/Zoe-System/actions/runs/36992474164) លើ HEAD `9f0524f`
  (merge tree `494ab0a`) ៖ shard ១ · ២ · ៤ ជាប់; shard ៣ មាន ៥០ ជាប់ · ១ ធ្លាក់ · partial ០ · skip ០។ ការធ្លាក់តែមួយគឺ
  `shared-fns` ៖ `waitForFirebaseSDK` របស់ ZoeW ចាប់ផ្តើម `window.loadFirebaseSDK()` ពេលប្តូរ Config Supabase ➜ Firebase
  ចំណែក ZoeKeyGen ទាញ SDK ពេលបើកជានិច្ច សម្រាប់ License Project។
- **ការកែ** ៖ កត់ helper នេះក្នុង `EXPECTED_DIVERGENT` ជាមួយមូលហេតុ និងតំណទៅ `firebase-loader-gate.test.ts`។ គ្មានកូដផលិតកម្មប្រែ
  និងគ្មានការឡើងកំណែ App។ `docs/HISTORY.md` ក៏ដកការពិពណ៌នាដែលហួសសម័យថា loader នៅទាញ Firebase សម្រាប់ Config Supabase។
- **ការវាស់ក្នុង session** ៖ `shared-fns` ពិតអាន `network.ts` តាម `checker-view.mjs` ពិត និង `ZoeKeyGen/app.js` ពិត
  (តែ module បណ្តាញ · helper រួម ៤) ៖ checker មុនកែធ្លាក់តែ `waitForFirebaseSDK`; ក្រោយកែជាប់; mutation លើ `withTimeout`
  ដែលមិននៅក្នុងបញ្ជីលើកលែង ➜ checker នៅតែធ្លាក់ (ទិសផ្ទុយ)។ `node --check` ជាប់។
- **ដែនកំណត់** ៖ GitHub CLI ក្នុងម៉ាស៊ីនអានការកំណត់ចូលប្រើមិនបាន ទោះបានស្នើសិទ្ធិអានរួច ➜ ទាញឯកសារតាម GitHub connector;
  មិនបានសាង audit tree ពេញ ឬរត់ `run-all.sh` ក្នុងម៉ាស៊ីននេះទេ។ ទុក CI ៤ shard វាស់ពេញតាមសំណើសន្សំកូតា។
  ជុំ audit Supabase ថ្មី (Postgres ពិត · finder ៦) និងការងារបន្ទាប់ក្នុង handoff **មិនទាន់បានរត់**។
- **សកម្មភាពដោយដៃ** ៖ គ្មានសម្រាប់ការកែ checker នេះ។


### Deep Audit 2.48.0 ៖ កំហុសដែល suite បៃតង (១៩៧ + ២) មិនឃើញ (2026-10-01)

baseline ក្នុង session (emulator រស់ · ទង់ STRICT ទាំង ៥) លើ tree `main` ៖ **១៩៧ ពេញលេញ · ធ្លាក់ ២ · មួយផ្នែក ០ · រំលង ០** — ការធ្លាក់ ២
(`version-bump-scope` · `repository-file-coverage`) វាស់ **repo ផ្ទាល់** ហើយមកពីការកែរបស់ជុំនេះកណ្តាលការរត់ (កូដ ship ប្រែគ្មានការឡើងកំណែ · ឯកសារថ្មី
មិនទាន់ចុះក្នុង coverage) មិនមែនកំហុសលើ `main` ទេ។ ⛔ មេរៀន ៖ កុំកែ repo ខណៈ `run-all.sh` រត់ ពេលចង់បាន baseline ស្អាត (checker ខ្លះវាស់ repo មិនមែន root វាស់)។

កំហុសពិតដែលរកឃើញដោយការអានកូដ + probe (គ្មាន checker ណាក្រហម) ៖

1. **🩺 រាយអាយុ cache ជា «អាយុ» Cookie** — `ageMs` កំណត់ពេល container **អាន** Blob (`cookieState.at = Date.now()` ក្នុង `adoptStoredCookie()`) ➜ លេខតូចជានិច្ច
   (TTL ៦០ វិ.) ខណៈ Cookie អាច Sync ពីច្រើនថ្ងៃមុន ➜ សារនិយាយមិនពិត។ `@netlify/blobs` មិនបញ្ចេញ `last-modified` ➜ ការកែ ៖ metadata `syncedAt`/`renewedAt`
   (សរសេរដោយអ្នកសរសេរទាំង ២ របស់ Blob)។ ⛔ ស្នាមភ្ជាប់ឧបករណ៍ Sync ↔ Function វាស់ដោយ **decoder ពិត** របស់ SDK (`getStore({ fetch })` ➜ `getWithMetadata()`)
   មិនមែនការសន្មតទម្រង់ `b64;`។
2. **ហាងចុះឈ្មោះរួច ➜ ប្រអប់ចុះឈ្មោះ** — `pendingInvite` មកពី Setup Link រាល់ការ apply ➜ `showLoginModalWithPrefill()` បើកចុះឈ្មោះ **ឥតលក្ខខណ្ឌ** ខណៈ
   ZoeKeyGen ចេញកូដ `p_max_uses: 1` ➜ Reconfig/ឧបករណ៍ទី ២ = ការចុះឈ្មោះដែលប្រាកដថាធ្លាក់។
3. **ការចងចាំគណនីឆ្លង backend** · **session Supabase ឆ្លង Project** (មើលផ្នែក ១)។
4. **App ទទេក្រោយ License យឺត** — `proceedAfterLogin()` ៖ `withTimeout(ensureAppActivated(), 20000)` ធ្លាក់ ➜ toast ហើយ `return` ➜ វគ្គស្តារក្រោយ reload គ្មានផ្លូវ
   ចេញក្រៅពី reload (`runPeriodicLicenseCheck()` រត់តែពេល `isDatabaseInitialized`)។ ករណីអាក្រក់បំផុតនៃ `checkOnline()` ៖ Key ១០ វិ. + កៅអី ១០ វិ. × ការអាន/កក់
   ➜ លើស ២០ វិ.។
5. **toast រស់បាត់ស្ងាត់** ខណៈ «🔄 …» (មើលផ្នែក ១)។
6. **ឯកសារខុសពីកូដ** ៖ `tools/money-check-windows/README-KH.md` និយាយថាវាអាន `ZoeW/app.js` (លែងមានក្នុង repo React ➜ វាអាន `audit-tools/money-core.js`) ·
   `CLAUDE.md` រាយ PR #278 ថា «មិនទាន់ merge» ខណៈ git បង្ហាញ merge រួច (`75fedaf`)។ probe ៖ ស្កេន path ក្នុង `*.md` ទាំង ២៤ ធៀបឯកសារ tracked ➜ សល់តែការយោង
   ដោយចេតនា (`ZoeW/app.js` ទិដ្ឋភាពវាស់ · `.settings/rules.json` API emulator)។

7. **checker ធ្លាក់ក្លែងក្លាយពេលការរត់ឆ្លងម៉ោង ០០:០០** — `ledger-clamp-symmetry-test` ៖ ««ដក» ដែលធុងសំរាមធ្លាក់ ➜ ចំណូលថ្ងៃ `null`» ក្នុង CI ពេញ ខណៈ
   រត់ម្នាក់ឯង **១៣/១៣** ×២។ មូលហេតុ ៖ `today()` គណនាកូនសោថ្ងៃ **រាល់ការហៅ** ➜ seed ចុះថ្ងៃ X តែ `rev()` អានថ្ងៃ X+1 (ម៉ាស៊ីន UTC ០០:០២)។ ⛔ ការកែ ៖ កកកូនសោ
   **ម្តង** ក្នុងមួយការរត់ (`TODAY_KEY`) · checker ផ្សេងគ្មានទម្រង់ `function today()` នេះទេ (`grep`)។

8. **Supabase Security Advisor ៧ ការព្រមាន ➜ អ្នកយាមគ្មានច្បាប់នោះ** — `supabase-rls-test` វាស់ «រាល់ SECURITY DEFINER មាន `search_path`» និង EXECUTE តាម
   function តែមិនវាស់ច្បាប់ linter 0028/0029 (definer + anon/authenticated + schema ក្នុង `pgrst.db_schemas`) ➜ ចម្លង SQL ពិតពី `supabase/splinter`
   (`0029_authenticated_security_definer_function_executable.sql` ៖ predicate · បញ្ជី schema លើកលែង) ➜ tree មុនកែ ៖ FAIL រាយ function ៧ **ដូចរបាយការណ៍ម្ចាស់
   គម្រោងបេះបិទ** (ភស្តុតាងថាវាវាស់ច្បាប់ពិត មិនមែនការស្មាន)។
9. **អន្ទាក់ harness ៖ `String.replace(from, to)` បកប្រែ `$$` ក្នុង `to` ជា `$`** — mutation ដែល replacement ផ្ទុក `as $$` (តួ function SQL) ក្លាយជា SQL ខូច ➜
   «SQL អនុវត្តមិនបាន (មិនរាប់)» ➜ mutation មើលទៅដូចមិនអាចវាស់បាន។ ⛔ ការកែជារចនាសម្ព័ន្ធ ៖ `replace(from, () => to)` ក្នុង `supabase-rls-test` ·
   `supabase-datastore-test` · `supabase-functions-test` (mutation ចាស់គ្មាន `$` ពិសេស ➜ ឥរិយាបថមិនប្រែ)។
10. **Deploy ពី GitHub (ឯកសារ Supabase ពី repo `supabase/supabase` ព្រោះ supabase.com ត្រូវ proxy ទប់)** ៖ «You can deploy directly from GitHub on any plan» ·
   Working directory = ថតដែល *ផ្ទុក* `supabase/` (`.`) · «New migrations are applied · Edge Functions declared in `config.toml` are deployed … All other
   configurations, including API, Auth, and seed files, are ignored» · migration នីមួយៗក្នុង transaction · Branching (preview) ទាមទារ Pro។ ⛔ ផលវិបាក ៖
   migration ដែលអនុវត្តរួចកែមិនបាន ➜ generator rules ត្រូវបង្កើតឯកសារថ្មី (ផ្នែក ១) · migration ដែល paste ក្នុង SQL Editor ត្រូវ `migration repair` មុន។
   ⛔ មិនដាក់ `ZOE_LOGIN_DOMAIN`/`ZOE_ALLOWED_ORIGINS` ក្នុង `[edge_runtime.secrets]` របស់ `config.toml` ៖ ឯកសារមិនបញ្ជាក់ថាការ deploy ផលិតកម្មរំលងវា ➜
   អាចសរសេរជាន់ origin ផលិតកម្ម។
11. **`CLAUDE.md` ជាភាសាអង់គ្លេស និងបង្រួម (សំណើម្ចាស់គម្រោង ៖ «អ្នកជាអ្នកអាន មិនមែនខ្ញុំ» · សន្សំកូតា)** — ពី ២៣៦៥ បន្ទាត់ខ្មែរ ➜ ~១៨០០ បន្ទាត់អង់គ្លេស ៖
   ច្បាប់ · តារាងស្នូល · ច្បាប់អាជីវកម្ម · Runbook នៅគ្រប់ ➜ narrative «វាស់បាន (x.y.z)» ដកចេញ (រស់ក្នុងឯកសារប្រវត្តិ) · តារាង «ថ្នាក់កំហុសដែលមានឧបករណ៍» ➜
   យោង `audit-tools/README.md` ផ្នែក ៦ + តារាងតូច «ច្បាប់ដែល checker ជាក់លាក់ផ្ទុក»។ ⛔ ច្បាប់ ៧ ៖ `CLAUDE.md` តែមួយជាអង់គ្លេស · ការសន្ទនា · commit · PR ·
   ឯកសារដទៃ · អត្ថបទក្នុង App នៅជាខ្មែរ។ ⛔ ស្លាក UI (របា Slide · ម៉ឺនុយ (...)) នៅជាខ្មែរដដែល ព្រោះ `doc-scope-test` ផ្នែក ៦ ប្រៀបវានឹង `index.html` ពិត។
   `doc-scope-test` ៖ regex ដែលអានប្រយោគខ្មែរក្នុង `CLAUDE.md` (ច្បាប់ ៩ · ច្បាប់ប្រវត្តិ · `setInterval` · ជួរ 🩺 · អេក្រង់ស្ថិតិ · ចំនួន 📝 · កថាខណ្ឌ emulator) ➜ អានប្រយោគអង់គ្លេស។
   ⛔ អត្ថបទខ្មែរពេញលេញមុនបង្រួម ៖ `git show a432174:CLAUDE.md`។
   ⛔ ជុំបន្ទាប់ (សំណើម្ចាស់គម្រោង) ៖ `CLAUDE.md` ផ្ទុក **តែច្បាប់ និងការហាមឃាត់** (~១១៥០ បន្ទាត់) — រឿងរ៉ាវ «វាស់បានក្នុងកំណែ x.y.z» · លេខកំណែ ·
   កាលបរិច្ឆេទ ទៅ `docs/HISTORY.md` · ប្រវត្តិដែលលែងប្រើ ➜ `docs/HISTORY-ARCHIVE.md` ឬលុបចោល (ច្បាប់ ១២) · បញ្ជី «ការងារដែលនៅសល់» ផ្លាស់មកក្បាលឯកសារនេះ។
   អ្នកយាម ៖ `doc-scope-test` ធ្លាក់ពេល `CLAUDE.md` មានលេខកំណែ ឬកាលបរិច្ឆេទក្រៅតារាងក្បាល (mutation «2.11.3 · 2026-08-25» ➜ FAIL · probe ទិសផ្ទុយ ៖ IP `127.0.0.1` មិនចាប់)។

⛔ **វាស់ តែមិនរកឃើញ** ៖ sink HTML ក្នុង ZoeW (`dangerouslySetInnerHTML` · `innerHTML` ០ ក្នុង `src/**`) · ZoeKeyGen `innerHTML` ២២ កន្លែង (តម្លៃពីទិន្នន័យទាំងអស់ឆ្លង
`escapeHtml`) · header សុវត្ថិភាព Netlify ទាំង ២ App (CSP · `frame-ancestors 'none'` · HSTS · nosniff) · adapter Supabase (`waitForLink` · ការសរសេរព្យួរ ➜ `dbOp`
+ `armLateCommit` ខាងក្រៅ)។

### PR #278 ៖ `rules:check` ក្រហម ៖ ម៉ឺនុយ (...) ត្រូវ scroll-snap បិទ **ក្រោយ** harness បើក (2026-10-01 · `ZoeW/scripts/` តែប៉ុណ្ណោះ ➜ គ្មានការឡើងកំណែ)

run 36914010050 ផ្នែក 2/4 ៖ `cleanup-rules-check` ធ្លាក់ ៤ (Android ៖ «ស្តារ MR1 (0107)» `page.click: Timeout 5000ms` ➜ ការអះអាងលុយ/parity ខាងក្រោយ
ធ្លាក់តាម ព្រោះការស្តារមិនបានរត់ — លុយ `96 / 9.5 / 19` = ស្ថានភាព «ក្រោយដក» ត្រឹមត្រូវ)។ ក្នុង session ៖ ស្គ្រីបមុនកែធ្លាក់ **~១ ក្នុង ៤** ពេលរត់ ៣ ច្បាប់ស្របគ្នា
ហើយធ្លាក់លើ App **ណាក៏បាន** រួម **ZoeW ដើម** ដែលគ្មាននរណាកែ ➜ harness មិនមែន App។ ការវាស់ (call log ពេញ + ការកត់ `scroll` តាមដំណាក់កាល) ៖ ការចុចដែលជាប់គឺ
`[data-act="moreMenuRecentlyDeleted"]` «element is not visible» · មុនបើក `#appPages` នៅ `0` ហើយប៊ូតុងនៅក្នុងអេក្រង់ (Playwright មិនរមូរ) · **ក្នុងពេល**
ម៉ឺនុយ `display:block` browser snap `#appPages` 0 ➜ **369** (ចំណុច snap របស់ `.page-main`) ➜ App បិទម៉ឺនុយលើ `scroll` (ឥរិយាបថដោយចេតនា · App ទាំង ២)។
ថ្នាក់ដដែលនឹង `parity-deep` (ផ្នែកខាងក្រោម) តែ `cleanup-rules-check` **គ្មាន** `scrollQuiet()` ➜ ⛔ ការកែជា helper **រួម** `ZoeW/scripts/menu-scroll.mjs`
(`SCROLL_PROBE` · `scrollQuiet()` · `openMenuItem()`) ដែល harness ទាំង ២ នាំចូល (ច្បាប់តែមួយកន្លែង) ៖ រង់ចាំការរមូរស្ងប់មុនបើក · បើកម្តងទៀត **តែពេល**
វាស់ឃើញ `scroll` ក្រោយការបើក (ពិដាន ៣) · ម៉ឺនុយមិនបើក/បិទ **ដោយគ្មាន** scroll ➜ ធ្លាក់។ វាស់ ៖ ក្រោយកែ **៣០/៣០** (៣ ស្របគ្នា × ១០ ជុំ · មុនកែ ~២៤%) ·
probe ទិសផ្ទុយ ៖ ប៊ូតុងដែលមិនបើកម៉ឺនុយ ➜ «ម៉ឺនុយ (...) មិនបើកដោយគ្មានការរមូរ» (ធ្លាក់) · `scrollBy(120)` ក្រោយបើក ➜ snap 369 · ម៉ឺនុយ `none` ➜ បើកម្តងទៀត ×2 ➜ បៃតង ·
`parity:deep` ៧៩/៧៩។ ⛔ កុំ «កែ» វាក្នុង App (បិទ snap ឬការបិទម៉ឺនុយលើ scroll) — តំបន់ហាមចូល (`CLAUDE.md` ច្បាប់ ១១)។ ⚠️ `native-check` · `parity-live`
ចុច `.header-more-btn` ដោយផ្ទាល់ (មិនទាន់ឆ្លង helper) — មិនទាន់ធ្លាក់ទេ តែបើធ្លាក់ «not visible» លើធាតុម៉ឺនុយ ➜ ថ្នាក់នេះ។

### `zoew-parity` ក្រហមលើ main ម្តងទៀត ៖ «13:00:01» ធៀប «13:00:00» មកពី **បង្អួចផ្ទុក** (2026-10-01 · `ZoeW/scripts/parity-deep.mjs`)

run 36877553261 (merge PR #277) ៖ ផ្នែក 3/4 ធ្លាក់ `parity:deep` **៦ ជំហាន** ដោយភាពខុសគ្នាតែមួយ ៖ «ទាញយកចុងក្រោយ 13:00:01» (ដើម) ធៀប «13:00:00» (ថ្មី) ខណៈ
ការកែមុន (គ្រប់ការរំកិលឆ្លង `advance()`) ចាក់សោតែម៉ោងក្រោយ `pauseAt`។ មូលហេតុទី ២ ៖ `session()` ទុកនាឡិកា **ហូរតាមម៉ោងពិត** ពី `HARNESS_CLOCK_START`
ដល់ `pauseAt(+10 វិ.)` (ការផ្ទុកទំព័រត្រូវការ timer ពិត) ➜ ការទាញតារាងអតិថិជនពេលផ្ទុកបោះត្រា `Date.now()` តាម **ល្បឿនម៉ាស៊ីន** (App នីមួយៗ)។ ⛔ ការកែ ៖
ម៉ោងដែលធ្លាក់ក្នុងបង្អួចផ្ទុក (ដេរីវេពី `HARNESS_CLOCK_START` ពិត · `BOOT_WINDOW_MS` ដដែលនឹង `pauseAt`) ប្រៀបជា `<ម៉ោងផ្ទុក>` ក្នុងអេក្រង់ · ម៉ោងក្រៅបង្អួច
នៅប្រៀបពេញ។ វាស់ ៖ probe `DEEP_NET_DELAY_MS=1200 DEEP_NET_DELAY_ONLY=old` ➜ ស្គ្រីបមុនកែធ្លាក់ **៦ ជំហានដូច CI បេះបិទ** · ក្រោយកែ **៧៩/៧៩**។

CI ពេញក្នុង session លើ `f2e4148` ៖ ១៩៤ ពេញលេញ · **ធ្លាក់ ៥** ➜ ជួសជុល ៖ (១) `shared-fns` ៖ `biometricPrfBytes` របស់ ZoeKeyGen ឥឡូវរុំ
`biometricPrfEval()` ➜ ចូលក្រុម `EXPECTED_DIVERGENT` ក្រយៅដៃ/មុខ ជាមួយហេតុផល · (២) `loop-termination` ៖ រង្វិលជុំគូរ PNG របស់ QR ត្រូវការពិដាន ➜
`QR_MAX_MODULES` (១៧៧ = QR version 40) · (៣) `keygen-supabase-admin` ៖ helper QR ថ្មីត្រូវស្រង់ចូល sandbox (QR កូដអញ្ជើញទទេ ➜ «QR = Link ពេញ» ធ្លាក់ ៖
អ្នកយាមចាប់ការរៀបចំឡើងវិញត្រឹមត្រូវ) · (៤) `emu/supabase-rules-parity` ៖ **កំហុស harness** ៖ ការសរសេរក្លែង (probe mutation) ដែល rules ទាំង ២ បដិសេធ
ត្រូវអនុវត្តជា owner ដូចការសរសេរពិតរបស់ App ➜ mutation `op` លើ root នៃ PATCH ច្រើនផ្លូវ ➜ `zoe_admin_write` បដិសេធផ្លូវ root ➜ checker គាំង
(«owner write on Postgres failed») ខណៈ rules ទាំង ២ និយាយដូចគ្នា ➜ probe លែងត្រូវចម្លងជា owner · (៥) `sw-client-wiring` «`focus` ក្រោយពិដាន» ធ្លាក់ក្នុង
CI ពេញ (lane browser ៤) · ឆ្លងពេលរត់ម្នាក់ឯង និង ៤ ច្បាប់ស្របគ្នា + busy loop (ទាំងកូដមុន/ក្រោយ ➜ **មិនទាន់បង្កើតឡើងវិញបាន**) ➜ យន្តការសង្ស័យ ៖ job
`update()` មុនដែលនៅដំណើរការ ត្រូវរួម (spec) ➜ គ្មានការទាញ `sw.js` ថ្មី ➜ test រង់ចាំ job មុនចប់ (`settleUpdates()`) មុនថតចំនួន · ពិដានវិជ្ជមាន ៨ វិ.
(ទិសផ្ទុយនៅ ៣ វិ.)។ ⛔ បើវាធ្លាក់ម្តងទៀត ៖ យន្តការនេះមិនមែនមូលហេតុ ➜ ត្រូវវាស់បន្ថែម។

អ្នកយាមថ្មីក្នុងជុំ 2.47.1 (ធ្លាក់លើ tree មុនកែ) ៖ `keygen-biometric-test` +៦ (Android passkey · PRF ពី `create()` · `prf: {}` · បោះបង់ ≠ មិនគាំទ្រ) ·
`layout-check` +១១ (QR ៨ ទំហំ ៖ ៤១២px ➜ ហួស ៣៨px · 💾 PNG ធៀបគ្រប់ module · ទិសផ្ទុយ) · `doc-scope-test` +៣ (ជួរលេខលាយ ៖ ២ កន្លែង) ·
`ZoeW/tests/config-modal.test.tsx` +២ · `push-server.test.ts` +៦ · `push-client.test.tsx` +៥។

### CI លើ main ក្រហម · Release APK ធ្លាក់ · CI GitHub យឺត ២៣ នាទី (2026-10-01 · `audit-tools/` · `ZoeW/scripts/` · workflow តែប៉ុណ្ណោះ ➜ គ្មានការឡើងកំណែ)

ម្ចាស់គម្រោងរាយការណ៍ ៖ «CI លើ main និង Android APK ធ្លាក់ តែ CI ពេល PR ឆ្លងទាំងអស់» · «បង្កើនល្បឿន CI ក្នុង GitHub ឲ្យលឿនដូចរត់ក្នុង session»។

- **`zoew-parity` (parity:deep) ក្រហមលើ main** (run 36823040166) ខណៈ PR #276 ឆ្លង ៖ ការវាស់ដដែលធ្លាក់/ឆ្លងតាមបន្ទុក CPU (ការកត់ចុងក្រោយ
  របស់ PR #276 ៖ «ក្រោមបន្ទុក CPU ធ្ងន់ zoew-parity នៅធ្លាក់ ៣ ជំហាន — មិនទាន់វិភាគ»)។ បង្កើតឡើងវិញក្នុង session ៖ busy loop ៦ លើ CPU ៤ ➜
  ធ្លាក់ ៣ ជំហានដូច CI បេះបិទ («ធុងសំរាមក្រោយចូលវិញ» ៖ ធាតុម៉ឺនុយ «មើលមិនឃើញ» ខាង ZoeW ដើម)។ មូលហេតុ **២** ក្នុង harness (មិនមែន App) ៖
  (១) App ទាំង ២ បិទម៉ឺនុយ (...) លើ **រាល់** `scroll` (capture លើ `window`) ➜ ការប្តូរទំព័របញ្ចេញ scroll-snap ដែលតាំងលំនឹងតាម **ម៉ោងពិត** ➜
  ពេល CI រវល់ វាបាញ់ក្រោយការបើកម៉ឺនុយ ➜ ការកែ ៖ `scrollQuiet()` រង់ចាំ `window.__scrollEvents` មិនប្រែ ៣ ដងជាប់ **មុន** ចុចប៊ូតុងបើកម៉ឺនុយ
  (⛔ មិនមែនការចុចម្តងទៀត — វានឹងលាក់ម៉ឺនុយដែលមិនបើកពិត) · (២) `pinIfAsked()` · `drawerItem()` · ជំហាន PIN រំកិលនាឡិកាដោយ `clock.runFor()`
  ផ្ទាល់ (មិនរង់ចាំបណ្តាញស្ងប់) ➜ ចម្លើយ Apps Script ចុះលើម៉ោងក្លែងខុសគ្នា ➜ «ទាញយកចុងក្រោយ 13:00:01» ធៀប «13:00:00» (សេណារីយ៉ូ Sheet លើ
  main) ➜ ការកែ ៖ គ្រប់ការរំកិលឆ្លង `advance()`។ វាស់ ៖ បន្ទុកដដែល ➜ **៧៩/៧៩** · ជំហានដែលមិនប្តូរអ្វីសោះ ១ ➜ ០។
- **Release APK ធ្លាក់** (run 36823040118) ៖ `apksigner` ថ្មីសរសេរ `V2 Signer: certificate SHA-256 digest` ខណៈ workflow `grep 'Signer #1 …'` ➜
  អានបាន «គ្មាន» ➜ «មិនស្មើ pin» ខណៈវិញ្ញាបនបត្រ **ស្មើ pin បេះបិទ** (`c2a1b725…`)។ `android:check` ផ្ទៀងតែ *អក្សរ* នៃច្រកទ្វារ ➜ មិនដែលរត់ការស្រង់
  លើ output ពិត។ ការកែ ៖ `ZoeW/scripts/apk-cert-check.mjs` (ស្រង់ទម្រង់ទាំង ២ · ទាមទារ `Verifies` · signer ១ · វិញ្ញាបនបត្រតែមួយគ្រប់ scheme ·
  ស្មើ pin) · workflow ហៅវា · `android:check` រត់វាលើ output ពិតរបស់ runner + ករណីបដិសេធ ៦ (mutation ៣/៣ ចាប់ ៖ កាត់ `exit 1` · ឈប់ប្រៀប pin ·
  ដកទម្រង់ `V2 Signer:`)។ ⚠️ workflow រត់ពេល `version.ts` ប្រែលើ main ➜ Release 2.46.0 មិនកើតទេ — ការឡើងកំណែ ZoeW បន្ទាប់ ឬ «Run workflow» ដោយដៃ។
- **CI GitHub ២៣ នាទី** ៖ runner (repo ឯកជន) មាន CPU **២** ➜ lane 2 ហើយ `checker-coverage` + `exit-code-integrity` រត់ម្នាក់ឯង ~៣៧៣ វិ. ·
  job «Firebase rules» ១០ នាទីរត់អ្នកយាម emu/* ស្ទួន។ ការកែ ៖ `RUNALL_SHARD=k/n` ក្នុងម៉ាស៊ីនរត់ (LPT តាម `RUNALL_HINTS` ដែលវាស់លើ runner ពិត ➜
  ទម្ងន់ ៨០៩–៨១១ ក្នុងមួយផ្នែក) · `audit.yml` = matrix ៤ ផ្នែក · ផ្នែកនីមួយៗបើក emulator ហើយរត់ទង់ STRICT ដូច Runbook ➜ job «Firebase rules» លុប។
  អ្នកយាម (`runall-runner-test` ៧ក/៧ខ) ៖ ផ្នែកមិនជាន់ · មិនខ្វះ (fixture + បញ្ជីពិត ១៩៧) · matrix ↔ n · ទង់ STRICT ↔ Runbook · តម្លៃខុស ៦ ➜ បដិសេធ ·
  mutation ៣/៣ ចាប់ (matrix ខ្វះផ្នែក ៤ · ដក `MONEYGUARD_STRICT` · ការបែងចែកជាន់)។ ⚠️ នាទីគិតថ្លៃ ៖ ផ្នែក ៤ × (~២ នាទីរៀបចំ + ការងារ)
  ប្រហែលស្មើមុន (២៣ + ១០) ព្រោះ job «Firebase rules» ស្ទួនត្រូវលុប។

### Supabase + កូដអញ្ជើញ ៖ អ្វីដែលការវាស់រកឃើញពេលបញ្ចប់ (2026-10-01 · ZoeW 2.46.0 · ZoeKeyGen 2.23.0)

ម្ចាស់គម្រោងបើកផ្លូវ Supabase ម្តងទៀតក្នុងទម្រង់ **ឥតគិតថ្លៃ** ៖ Free tier · **កូដអញ្ជើញ** ជំនួស SMS OTP (ការសម្រេច «មិនផ្ទេរ» ខាងក្រោមជាប់នឹងថ្លៃ
SMS + Pro)។ ការងាររៀបចំលើ ៤ commit (`8ff2d6e` ➜ `3cb1686`) ហើយជុំនេះបញ្ចប់ជំហាន ៣ក–៣ឃ។ CI ពេញលើកដំបូង (emulator · `*_STRICT` · `SUPABASE_STRICT=1`)
ធ្លាក់ **២១** ៖

- **ការធ្លាក់ពិតក្នុងកូដ** ៖ `supabase-sdk.ts` ប៉ះ `document` ផ្ទាល់ (៣ · `purity:check`) ➜ ឆ្លង `platform/document-io.ts` · `supabase-rtdb.ts` ដក `Date.now() - startedAt`
  (`monotonic-gate`) ➜ `elapsedSince()` · ZoeKeyGen ៖ `${labels[state][0]}` មិន escape (`html-sink-escaping` ៖ ថេរ ➜ badge ថេរ ៣) · `sbAdminPasswordInput`/ស្លាក
  ហាងមិនស្ថិតក្នុងផ្លូវចាកចេញដែល checker ស្គាល់ (`secret-hygiene` · `dom-hygiene` ➜ helper សម្អាតរាប់ **តែពេល** `showLoginModalWithPrefill()` ហៅវាពិត)។
- **អ្នកយាមដែលស្កេនអក្សរចាស់** ៖ `tx-outcome-test` រក `fb = withTransactionOutcomeResolution(await waitForFirebaseSDK(` ➜ កូដថ្មីប្រើ `nextFb = …` ➜ FAIL ខណៈការធានានៅដដែល
  ➜ ដេរីវេ ៖ អថេរណាដែលរុំ ត្រូវក្លាយជា `fb` (probe ៖ ដក wrapper ➜ FAIL) · `csp-enforced` អានសារ «វាលទទេ» ជា literal ➜ ternary តាម backend ➜ យកសាខា Firebase ·
  sandbox ខ្វះឈ្មោះថ្មី (`connection-recovery` ៖ `isSupabaseConfig` · `health-check` ៖ `databaseHealthLabel` · `firebase-config-paste` ៖ helper Supabase · `crud-rules-flow` ៖ `auth`)។
- **បញ្ជីរឹង** ៖ `checker-coverage` (harness `supabase-pg.js` · `supabase-fake-server.js` មិនមែន checker) · `sdk-surface` (`fb.accountOf` … មិនមែន export របស់ loader ➜
  ផ្ទៃ adapter ដេរីវេពី `createSupabaseSdk()` ពិត បូកការអះអាងថ្មី **២** ៖ `fb.X` ដែល SDK Firebase មាន ត្រូវមានក្នុង adapter · ឈ្មោះ adapter-only ប្រើក្រោមច្រកទ្វារ) ·
  `shared-fns` (`normalizeFirebaseConfig` ZoeW ទទួល Supabase ➜ divergent មានហេតុផល) · `state-hygiene` (`pendingInvite` ➜ ផ្លូវចាកចេញខ្លួនវាអានវា) · coverage · README · emu ក្នុង Runbook។
- **ការវាស់តាមពេល ➜ ធ្លាក់ពេលម៉ាស៊ីនរវល់** ៖ `supabase-datastore` mutation «គ្មាន tenant lock» **រស់រាន** ក្នុង run-all ពេញ (ឆ្លងពេលរត់ម្នាក់ឯង) ៖ ការអះអាង «ទី ២ រង់ចាំ lock»
  មិនដែលឃើញ mutation នោះសោះ (`insert … on conflict do nothing` ក៏រង់ចាំ tuple ដែល T1 កំពុង update) ➜ មានតែការប្រណាំង `Promise.all` ដែលចាប់វា ដោយសំណាង ➜
  សេណារីយ៉ូថ្មី ៖ session ទី ៣ កាន់ `for update` លើ `zoe_tenant_state` ➜ ទី ២ ចាប់ផ្តើម ➜ រង់ចាំរហូត `pg_stat_activity` រាយ `Lock` ➜ ទី ១ សរសេរ ➜ seq ត្រូវ +1/+2 ➜
  mutation ចាប់ **ជានិច្ច**។ ⛔ `migrations/*_zoe_rules.sql` គ្មានអ្នកយាមភាពស្រស់ធៀប rules ➜ ការកែ rules អាចភ្លេច generate ➜ Postgres អនុវត្ត rules ចាស់ ➜ បន្ថែម (probe
  ៖ rules ប្រែ ➜ FAIL)។
- **ផ្ទាំងអ្នកលក់ ZoeKeyGen** (`keygen-supabase-admin-test`) ៖ mutation ៣ ដំបូងរស់រាន ➜ (១) ស្កេនអក្សរ «ឈ្មោះគណនី» ប្រកាន់អក្សរតូចធំ (` SoKha ` នៅក្នុងវាល) ➜ មិនប្រកាន់ ·
  (២) ការដក gate ក្រោយ `/token` មិនប្រែលទ្ធផលដែលមើលឃើញ តែផ្ញើសំណើក្រោយចាកចេញ ➜ អះអាង «គ្មានសំណើក្រោយចាកចេញ» · (៣) `parseInt` ទទួល «5abc» ➜ ករណី ៤ ➜ **២៣/២៣**។
- **ទិដ្ឋភាព checker ខុសពីកូដ ship (ជុំទី ២ នៃការកែ)** ៖ (១) `build-audit.mjs` ប្តូរ `firebaseState.fb` ➜ `fb` ➜ `const fb = firebaseState.fb;` ក្លាយជា
  `const fb = fb;` (**៥** កន្លែង ៖ ៤ ថ្មី + `probeDatabaseLiveness()` លើ `main` ដែលក្លាយជា `db !== db`) ➜ TDZ ក្នុង `vm` ➜ `health-check-test` ធ្លាក់ ·
  `cleanupJournalScope()` ត្រឡប់ `''` ស្ងាត់ៗ (`catch` លេប) ➜ checker វាស់ឥរិយាបថដែល App មិនមាន ➜ ប្រភពប្រើ `firebaseState.fb` ផ្ទាល់ (`fb.X` នៅមើលឃើញ
  សម្រាប់ `sdk-surface`) · build វាស់បដិសេធការប្រកាសយោងខ្លួនឯង (probe ៖ ទិដ្ឋភាពចាស់ ➜ ៥/៥ · ករណីធម្មតា ➜ ០)។ (២) `supabase-rtdb.ts` នាំចូល
  `core/elapsed` ➜ module នោះឡើងជាដំបូង ➜ `function elapsedSince` នៅតួអក្សរទី ០ ➜ `extractFn()` (`\n` មុន `function`) រកមិនឃើញ ➜ stub ចាស់ ➜
  `monotonic-gate-test` ក្រហម **៥** ដោយមូលហេតុខុស ➜ ទិដ្ឋភាពចាប់ផ្តើមដោយ `\n` + ជាន់ «ស្រង់ពីកូដពិត»។ (៣) `doc-scope-test` រាយ `zoe_docs` ·
  `zoe_admin_write` ថា «លែងមានក្នុងកូដ ship» ➜ កូដ server របស់ Supabase (migration · Edge Function) ចូលវិសាលភាព (ដេរីវេពីថតពិត)។
- **CI លើ GitHub (ការរត់ពិតលើកដំបូងក្រោយកូតាវិលមក · PR #276)** ៖ job «Firebase rules ↔ payload» ធ្លាក់ក្នុង ៥ វិ. នៅជំហាន build វាស់ ដោយ log
  រាយត្រឹម «exit code 1» (`M=$(… | tail -1)` លាក់ output) ➜ មូលហេតុ ៖ `build-audit.mjs` គូរ `index.html` ពិតក្នុង Chromium (`/opt/pw-browsers/chromium`)
  ខណៈ job នោះទាញ Chromium **ក្រោយ** build ហើយមិនភ្ជាប់ផ្លូវនោះ (លំដាប់នេះមានលើ `main` តាំងពីប្តូរទៅ React · run ចាស់ៗធ្លាក់ ៤ វិ. ព្រោះ **គ្មាន runner**
  ➜ មិនដែលវាស់)។ ការបង្កើតឡើងវិញក្នុងស្រុក (worktree ស្អាត · `npm ci` · deps root ដូច CI) **ឆ្លង** ព្រោះម៉ាស៊ីននេះមាន Chromium ស្រាប់ ➜ probe ៖ ប្តូរផ្លូវ
  Chromium ទៅថតទទេ ➜ ធ្លាក់ ៣ វិ. `executable doesn't exist`។ ការកែ ៖ ទាញ Chromium **មុន** build + ភ្ជាប់ `/opt/pw-browsers/chromium` · ជំហាន build
  បង្ហាញ output/stderr ពេញពេលធ្លាក់ (ផ្លូវ tree យកពី stdout តែប៉ុណ្ណោះ)។
- **probe ដែលវាស់ build ចាស់ ➜ សន្និដ្ឋានខុស** ៖ ក្រោយកែប្រអប់ Config ខ្ញុំដកធាតុ `INTENTIONAL_UI` ចេញ ព្រោះ «គ្មានធាតុ ➜ `parity:dom` នៅតែឆ្លង»
  ➜ CI លើ GitHub ក្រហម (`parity:dom` ៧២២/៧២០ · `live` · `deep` ៧៩/៧៩) ៖ ប្រអប់ mount ជានិច្ច។ `parity-dom.mjs` វាស់ **`dist/`** (មិនមែន `dist-parity/`
  ដែលខ្ញុំទើប build) ហើយ `dist/` នៅជា build **មុន** ការកែ ➜ សញ្ញា ៖ ចំនួនធាតុក្នុងស្រុក ៧១៥/៧១៥ ≠ CI ៧២០។ probe ឡើងវិញលើ build ស្រស់ ៖ គ្មានធាតុ ➜ ៧២២/៧២០ ·
  មានធាតុ ➜ ៧១៥/៧១៥ ➜ ធាតុត្រឡប់មកវិញ។ ⛔ មុនជឿ probe ត្រូវបញ្ជាក់ថា artifact ដែលវាស់មានការកែ (`grep` អត្ថបទថ្មីក្នុង bundle) — សំណួរ ១៣ លើ **build** មិនត្រឹម `*_APP_DIR`។
- **`smoke` ក្រហមតែលើ GitHub** ៖ `console.error: Failed to load resource: … 401` ➜ `syncServerTime()` (`license-verify.js`) អាន root License Project
  (`/.json?shallow=true` · default-deny ➜ 401 ដោយចេតនា ៖ ត្រូវការតែ header `Date`)។ ក្នុងស្រុក proxy ទប់ ➜ `ERR_…` ➜ ត្រូវតម្រង ➜ បៃតង ➜ smoke **អាស្រ័យលើ
  បរិស្ថាន** (មានលើ `main` តាំងពី React · មិនដែលរត់លើ GitHub)។ ការកែ ៖ smoke ផ្តាច់រាល់ការហៅទៅក្រៅ (`page.route` ➜ `abort`) · probe ៖ ក្លែង 401 លើ host License ➜
  មុនកែធ្លាក់ដូច CI · ក្រោយកែឆ្លង។
- ⚠️ រូបថតផ្ទាំងក្នុង Chromium នៅទីនេះ ៖ គ្មាន font ខ្មែរក្នុងប្រព័ន្ធ ➜ អក្សរបាក់ រហូតដល់ផ្ទុក **Kantumruy Pro** ពិត (`document.fonts.load`) — មិនមែនកំហុស App។

### ឧបករណ៍បង្កើតអតិថិជនថ្មីលើ Firebase (2026-09-30 · `tools/` + `audit-tools/` តែប៉ុណ្ណោះ ➜ គ្មានការឡើងកំណែ)

សំណើម្ចាស់គម្រោង (ម្តងទៀត) ៖ Supabase Project **តែមួយ** (`tenant_id` · RLS) ព្រោះការបង្កើត Firebase Project · Security Rules · គណនី Login
ដោយដៃរាល់អតិថិជនថ្មី ហត់ និងយូរ។ តាមការសម្រេចខាងក្រោម («⛔ កុំស្នើផ្លូវនេះម្តងទៀតដោយមិនលើកថ្លៃមកជាមុន») ថ្លៃ និងកូតារួមត្រូវលើកមុនសាងអ្វី ➜
ម្ចាស់គម្រោងជ្រើស **Firebase ស្វ័យប្រវត្តិ** ៖ $0 · នៅមួយ Project ក្នុងមួយអតិថិជន (កូតា Spark រៀងខ្លួន) · ZoeW/ZoeKeyGen/rules **មិនប្រែ**។

**អ្វីដែលសាង** ៖ `tools/firebase-provision/` (`new` · `rules --all` · `user` · `verify` · `show` · launcher `.cmd` ៣) ប្រើ `firebase-tools` **15.32.0**
(pin) ជាបណ្ណាល័យ ៖ Login ផ្លូវការរបស់វា (គ្មាន OAuth client ផ្ទាល់ខ្លួន) · function management ផ្លូវការ (`createCloudProject` · `addFirebaseToCloudProject` ·
`createWebApp` · `ensure` · `createInstance` · `updateRulesWithClient`) · endpoint ២ ដែល CLI គ្មាន (Authentication `admin/v2 …/config` · `v1/projects/…/accounts`)
ចម្លងទម្រង់ពី `gcp/auth.js` របស់វា (`x-goog-user-project`)។ ជំហាននីមួយៗកត់ក្នុង `state/` ➜ រត់ម្តងទៀតបន្តពីកន្លែងធ្លាក់។

**អ្វីដែលការវាស់រកឃើញ (មុន commit)** ៖
- **firebase-tools ផ្ញើ `Bearer owner` លើ URL `http://`** (`isLocalInsecureRequest`) ➜ Google ក្លែងលើ http **មិនដែលរត់ផ្លូវ token** ➜ mutation «ដក `requireAuth`»
  នឹងរស់រាន ➜ Google ក្លែងត្រូវជា **HTTPS** (CA ពី openssl ➜ `NODE_EXTRA_CA_CERTS`) ហើយបដិសេធ Bearer ដែល token endpoint មិនបានចេញ ➜ mutation នោះក្រហម **១៨**។
- apiv2 របស់ firebase-tools ប្រើ `HTTPS_PROXY` **ដោយគ្មាន `NO_PROXY`** ➜ env របស់ child ត្រូវសាងពីទទេ។
- `rtdb.updateRules()` បន្ថែម `?ns=` លើ host ដែលមិនមែន firebase ➜ path ខូច (`/?ns=x/.settings/rules.json`) ➜ ឧបករណ៍ប្រើ `updateRulesWithClient()` លើ
  `databaseUrl` របស់ instance (លើ Google ពិត host ផ្ទុក namespace រួច ➜ ដូចគ្នា)។
- **409 លើ Project ដែលការហៅរបស់យើងទើបបង្កើត** (ចម្លើយបាត់ · firebase-tools retry បណ្តាញ) ➜ កូដដំបូងចាត់ទុកថា «មានគេយក» ហើយបង្កើត `zoew-<សាខា>-xxxx`
  ទី ២ ➜ ពិនិត្យ `GET projects/<id>` ឡើងវិញមុនប្តូរ ID (ថ្នាក់ដដែលនឹង «`disconnect` ≠ មិនបានអនុវត្ត»)។
- ការកំណត់ Authentication ៖ server ដែលទទួល PATCH តែមិនអនុវត្តវាល (updateMask) ➜ ឧបករណ៍ **អានត្រឡប់** ហើយធ្លាក់ «did not stick» · `verify` សាកចុះឈ្មោះពិតតាម
  apiKey សាធារណៈ ➜ ចុះបាន ➜ លុបគណនី probe + FAIL។
- ការបើក API របស់ firebase-tools រង់ចាំ ១០ វិ. ក្នុងមួយជុំ (`POLL_SETTINGS`) ➜ `ZOE_PROVISION_API_POLL_MS` សម្រាប់តេស្ត។
- ឈ្មោះ Project របស់ Google ទទួលតែ អក្សរ · លេខ · ដកឃ្លា · `-` `'` `!` (៤–៣០ តួ) ➜ regex ដំបូងអនុញ្ញាត `_` `.` ហើយឈ្មោះលំនាំដើមលើសាខាវែងលើស ៣០
  តួ ➜ Google នឹងបដិសេធការបង្កើត ➜ regex ស្របច្បាប់ Google · ឈ្មោះលំនាំដើមកាត់ត្រឹម ៣០ · Google ក្លែងបដិសេធដូចពិត។
- Email enumeration protection ជា **វាលស្រេចចិត្ត** ៖ PATCH តែមួយរួមវាលចាំបាច់ ➜ Google បដិសេធវាលមួយ (400) ➜ sign-up **មិនត្រូវបិទ** ➜ PATCH វាលចាំបាច់ម្តងទៀត ·
  `verify` រាយ enumeration ជា `SKIP` (មិនប៉ះ exit code)។
- **meta-checker ចាប់ checker ថ្មីរបស់ខ្ញុំ ២ ដង** (CI ពេញលើកទី ១) ៖ `checker-coverage` ៖ baseline ត្រូវជា `FBPROVISION_APP_DIR="$BASE" node …` ត្រង់ៗ (env ទី ២
  ចន្លោះ ➜ រាប់មិនឃើញ) · `exit-code-integrity` ៖ checker ដែលពុល `ok()` ត្រូវចប់ក្នុង **៦០ វិ.** តែវាចំណាយ ~១១០ វិ. (សេណារីយ៉ូ + mutation ជាជួរ) ➜ «ផុតថវិកា ≠
  ការធ្លាក់» ➜ ⛔ មិនបង្កើនពិដាន ៖ សេណារីយ៉ូ និង mutation រត់ **ស្របគ្នា** (Google ក្លែង · state · port ផ្ទាល់ខ្លួន) ហើយការអះអាងចាក់ចូល `ok()` **តាមលំដាប់ថេរ**
  ក្រោយចប់ (ការពុលគ្របទាំងអស់) ➜ ~២៨ វិ. · ~៣២ វិ. ក្រោមបន្ទុក CPU ៣/៤ · ពុល ➜ `0 ok, 93 FAIL` ក្នុង ~៣៤ វិ.។

**`firebase-provision-test`** ៖ កិច្ចសន្យាឆ្លងឯកសារ (អ៊ីមែល ↔ `siteCodeFromEmail()` ពិត · Project ID ↔ `PROJECT_ID_RE` · Setup Link ↔ `decodeSetupPayload()`
ពិត · DSN · `.cmd` ASCII+CRLF · lock · ឈ្មោះ Project) + សេណារីយ៉ូ ១១ លើ CLI ពិត + firebase-tools ពិតទល់ Google ក្លែងដែលមានស្ថានភាព (API បិទ · operation ដែលត្រូវ
poll · sign-up · rules · updateMask · វាលដែលបដិសេធ) + **mutation ១៤/១៤ ក្រហម** ➜ **៩៣ ok** · ~៣០ វិ.។ ⛔ ព្រំដែន ៖ Google **ពិត** មិនត្រូវបានហៅ (session នេះគ្មានគណនី/បណ្តាញ) ➜
ការរត់លើកដំបូងលើគណនីពិតជាសកម្មភាពដោយដៃ ហើយ `verify` ជាអ្នកវាស់លទ្ធផលពិត។ ⚠️ Function ZTO អាន `FIREBASE_PROJECT_IDS` បានត្រឹម `PROJECT_ID_MAX` (**១៦**) ➜
លើសនោះ មុខងារ «ទាញបញ្ជី ZTO» បិទសម្រាប់ទាំងអស់គ្នា — មិនទាន់កែ (ឧបករណ៍ និង README ប្រាប់ពិដាននេះ)។

**CI ពេញ** (emulator · `*_STRICT` · `FBPROVISION_STRICT=1` · `RUNALL_JOBS=4`) ៖ លើកទី ១ ធ្លាក់ ៣ ➜ meta-checker ២ ខាងលើ (ជួសជុល) · `zoew-suite` ➜ `rules:check`
Android «ស្តារ MR1» (ZoeW **មិនប្រែ** ➜ ថ្នាក់ដដែលនឹងការធ្លាក់ក្រោមបន្ទុកដែលកត់ក្នុងធាតុ Supabase ខាងក្រោម) ➜ លើកទី ២ លើ tree ចុងក្រោយ ៖ **១៩១ ពេញលេញ · ០ មួយផ្នែក ·
០ រំលង**។ checker លើ tree មុនកែ (`origin/main`) ➜ `0 ok, 1 FAIL`។

**សកម្មភាពដែលត្រូវធ្វើដោយដៃ** ៖ `tools/firebase-provision/setup.cmd` (Login Google ម្តង) ➜ `new-customer.cmd --branch <សាខាសាកល្បង> --user test` ➜ exit 0 ➜ Login ក្នុង
ZoeW ➜ អតិថិជនចាស់ ៖ `node provision.js new --project-id <id> --branch <សាខា> --adopt` ម្នាក់ៗ ➜ `deploy-rules.cmd` គ្របពួកគេ។ ⛔ គ្មាន Deploy · គ្មាន Publish ·
ZoeW/ZoeKeyGen មិនប្រែ។

### ការសម្រេច ៖ មិនផ្ទេរទៅ Supabase (2026-09-30)

ម្ចាស់គម្រោងស្នើ Supabase Project តែមួយ (tenant · RLS · ចុះឈ្មោះ OTP) ➜ ជំហាន ០–១ ត្រូវសាង និងផ្ទៀងផ្ទាត់ (commit `e97590a` · `d25b1ca` · `f89cb34`) រួច
**ដកចេញវិញ** តាមការសម្រេចរបស់ម្ចាស់គម្រោង ៖ **មិនចង់បង់ប្រាក់** — Supabase Pro (backup · មិនផ្អាក) និង SMS OTP របស់ Firebase (Blaze) សុទ្ធតែគិតប្រាក់ ហើយ Project
តែមួយធ្វើឲ្យអតិថិជនទាំងអស់ចែកកូតាឥតគិតថ្លៃតែមួយ (ខណៈ «មួយ Project ក្នុងមួយអតិថិជន» ឲ្យកូតាឥតគិតថ្លៃរៀងខ្លួន)។ ⛔ កុំស្នើផ្លូវនេះម្តងទៀតដោយមិនលើកថ្លៃមកជាមុន។
កូដ និងអ្នកយាមនៅក្នុងប្រវត្តិ git (`git show e97590a`) បើត្រូវការយោង។
⛔ **ការសម្រេចនេះត្រូវប្តូររួច** ៖ ZoeW 2.46.0 (2026-10-01) ប្រើ Supabase Free · Project តែមួយ · ចុះឈ្មោះដោយកូដអញ្ជើញ (គ្មាន OTP) — មើល «Supabase + កូដអញ្ជើញ» ខាងលើ។

### APK splash · PTR លើ tablet ផ្តេក (2026-09-30 · ZoeW 2.45.8)

រកឃើញដោយ **ម្ចាស់គម្រោង** (រូបថត + វីដេអូ tablet 11.5") — មិនមែនដោយឧបករណ៍ទេ ៖ checker ទាំងអស់រត់ក្នុង Chromium ដែល (១) មិនមាន launch theme របស់ Android
និង (២) វាស់ PTR តែទំហំទូរស័ព្ទ។

**១. launch theme** ៖ template Capacitor (`styles.xml` ដូចបេះបិទ) ដាក់ `android:background="@drawable/splash"` ➜ theme attribute ជា **background លំនាំដើមរបស់
គ្រប់ View** ➜ រូបថតទី ១ ៖ របា «ZoeW» + logo ច្របាច់ ២ ក្នុងរបា។ ការកែលើកទី ១ (2.45.7 ៖ ដក `android:background` · `postSplashScreenTheme` ច្បាស់ · icon =
`@mipmap/ic_launcher`) ដើរតាមឯកសារ Android តែរូបថតទី ២ ៖ **ការ៉េ ព្រិល** ➜ icon splash 288dp ពង្រីកស្រទាប់ PNG របស់ adaptive icon ហើយ ROM នោះមិនបិទជ្រុង
(ឯកសារនិយាយថា Android 12+ បិទជារង្វង់ — ROM មិនធ្វើ)។ ⛔ មេរៀន ៖ រូបរាងលើ ROM មិនអាចសន្មតពីឯកសារ ➜ រចនាឲ្យ **មិនអាស្រ័យ** លើការបិទជ្រុង ៖ vector ដែល
មាតិកានៅក្នុងរង្វង់ 192dp។ vector ដេរីវេពី `icon.svg` ដោយ function តែមួយ (`android-splash-vector.mjs`) ដែលទាំងស្គ្រីបបង្កើត និង `android:check` ប្រើ ➜ logo មាន
ច្បាប់ចម្លងទី ២ តែ **មិនអាចឃ្លាត** ដោយស្ងាត់។ ⛔ ការវាស់ ៖ build APK ពិត (sign · FCM) ➜ `aapt2 dump resources` បញ្ជាក់ theme ក្នុង APK · render vector (ទាំងមាន/គ្មាន
mask 192dp) ក្នុង Chromium ➜ រូបដូចគ្នា។ ឧបករណ៍ពិតនៅតែជាការវាស់ចុងក្រោយ (📌)។

**២. PTR ≥992px** ៖ វីដេអូ ➜ ស៊ុម ៦ fps តាម ffmpeg ➜ រង្វង់ PTR ឈរលើគែមក្រោមរបា Tab។ វាស់ក្នុង Chromium (iOS standalone ក្លែង · ទាញពិតរហូតដល់ class `ready`) ៖
ទូរស័ព្ទ គម្លាត **+10.2px** ក្រោម navbar · tablet បញ្ឈរ **+10.2** · tablet ផ្តេក **−48.8** · iPad ផ្តេក **−47.8**។ ការកែ ៖ CSS តែក្នុង `@media (min-width: 992px)`
(`react-root.css` ➜ `app.css` នៅ byte-identical នឹង vanilla) ➜ ទាំង ៤ ទំហំ **+10.2**។ ⛔ ការអះអាងជា **ទំនាក់ទំនង** (ស្មើទូរស័ព្ទ ±2px) មិនមែនលេខថេរ ➜ navbar
ទូរស័ព្ទប្រែ ➜ អ្នកយាមធ្លាក់ មិនមែនបៃតងលើលេខចាស់។ ⛔ តំបន់ហាមចូល (ច្បាប់ ១១) ៖ ប៉ះតែ `top` របស់សញ្ញានៅ ≥992px · គ្មានការប្តូរ gesture/threshold/ចលនា។

### Deep audit 2.45.7 ៖ ការតភ្ជាប់ «ងាប់ស្ងាត់» លើ SDK ពិត · parity:deep ដែលលាក់ជំហានដែលធ្លាក់ (2026-09-30 · ZoeW 2.45.7)

baseline (tree មិនប៉ះ `737ca05` · emulator · `*_STRICT` · `RUNALL_JOBS=4`) ៖ **១៨៨ ពេញលេញ · ០ មួយផ្នែក · ០ រំលង · ធ្លាក់ ១** (`zoew-parity` ៖ `parity:deep`
«ជំហានខុស ៣»)។ ⛔ ជំហាន **ណា** មិនដឹង ៖ `zoew-suite-test` បោះពុម្ពតែ tail ១០ បន្ទាត់ ➜ ឃើញតែសេណារីយ៉ូចុងក្រោយ (Google Sheet · ✅ ទាំងអស់)។ ការបង្កើតឡើងវិញ
**៥ ដង** (ម្នាក់ឯង · បន្ទុក CPU ៤ · `Emulation.setCPUThrottlingRate` ៦ ដង · ស្របជាមួយ checker browser ៣ · ស្របជាមួយ `zoew-suite` + `money-guardian` +
`revenue-fuzz`) ➜ **៧៩/៧៩ រាល់ដង** ➜ មូលហេតុមិនទាន់ដឹង (សម្មតិកម្ម ៖ `waitForTimeout(150)` ពេលពិតថេរក្នុងជំហាន ខណៈ I/O ពិតរត់លើនាឡិកាពិត) ➜ ⛔ មិនកែ settle
ដោយគ្មានភស្តុតាង · `zoew-suite-test` ឥឡូវបោះពុម្ព **បន្ទាត់ ❌ · `[ស្រទាប់] ភាពខុសគ្នា` · 💥 ពីគ្រប់សេណារីយ៉ូ** មុន tail ➜ ការធ្លាក់លើកក្រោយប្រាប់ជំហាន និងស្រទាប់។

**១. 🔴 ការតភ្ជាប់ «ងាប់ស្ងាត់» (zombie socket)** ៖ រកឃើញដោយសួរ «checker បណ្តាញណាប្រើ SDK *ពិត*?» ➜ គ្មាន (`connection-recovery-test` ·
`reconnect-ladder-test` · `connection-state-fuzz-test` បាញ់ `.info/connected` តាមតេស្ត) ➜ អានប្រភព SDK 12.19.0 ៖ `WebSocketConnection.resetKeepAlive()` ផ្ញើ `0`
រាល់ ៤៥ វិ. **ដោយមិនរង់ចាំចម្លើយ** · `OnlineMonitor` បិទការតភ្ជាប់តែលើ `window` `offline` ➜ វាស់ (Node · SDK ពិត · emulator · proxy TCP ដែលឈប់បញ្ជូនដោយ
គ្មាន FIN/RST) ៖ `.info/connected` = **`true` ១០០ វិ. ពេញ** · `get()` លើ path គ្មាន listener ➜ **ផុតពិដាន**។ លើ App ពិត (`emu/app-network-e2e-test` · tree មុនកែ) ៖
«ភ្ជាប់ Server រួចរាល់» ជាប់ **១២០ វិ.+** ហើយក្រោយបណ្តាញមកវិញ (socket ចាស់ងាប់) **មិនភ្ជាប់វិញ** — ធាតុថ្មី ៣ លើ server មិនមកដល់ ➜ **FAIL ៩**។

ការកែ ៖ `probeDatabaseLiveness()` (round trip ពិត ៖ `get()` លើ `zoew_barcode_registry/__zoew_liveness__` — អក្សរតូច ➜ មិនអាចប៉ះកូនសោ registry ដែលជាអក្សរធំ ·
ចម្លើយណាក៏ដោយ រួម `permission_denied` = រស់ · ពិដាន ១០ វិ.) ➜ ផុត ➜ `noteDatabaseLinkUnresponsive()` ➜ `forceDatabaseReconnect()` (ផលដូច `offline` របស់ SDK ៖
transaction ដែលផ្ញើរួចទៅផ្លូវ `disconnect` ដែល wrapper ដោះរួចហើយ) · ទ្វារ ៣ ៖ `dbOp` ព្យួរ + claim/save ការស្កេនព្យួរ · ភ្ញាក់ពី background ≥ ៣០ វិ. · វដ្ត ៦០ វិ.
(មើលឃើញ · គ្មាន round trip ៥៥ វិ.) · ⛔ មិនវាស់ពេល listener នៅ pending (ការទាញដំបូងធំលើបណ្តាញយឺតដាក់ចម្លើយ `g` ខាងក្រោយ ➜ ការផ្តាច់ខុស ➜ ទាញឡើងវិញគ្មានទីបញ្ចប់) ·
ផ្តាច់ ≤ ១ ដង/៣០ វិ. · 🩺 ជួរ Firebase ប្រើការវាស់ដដែល។ វាស់បាន (tree ក្រោយកែ) ៖ offline ➜ «ក្រៅបណ្ដាញ» **៤ ms** · online ➜ បៃតង **~២១០ ms** · zombie ➜ ឈប់បៃតង
**២៥ វិ.** (ការសរសេរ ៖ ១៥ + ១០) · **១០ វិ.** (ភ្ញាក់ · វដ្ត) · បណ្តាញមកវិញ ➜ ភ្ជាប់វិញ + ទិន្នន័យថ្មី **~២០០ ms** · យឺត ៣ វិ./ជុំ ➜ រស់ (មិនផ្តាច់) · onValue សកម្ម
**១** ក្នុងមួយ path ក្រោយការឆ្លង ៦ ដង · WebSocket រស់ **១** ➜ **២៧/២៧**។

mutation លើការកែ (build វាស់ពេញ · e2e ពេញ) ៖

| # | mutation | លទ្ធផល |
|---|---|---|
| M1 | ដកទ្វារ `dbOp` ព្យួរ | ❌ ២ (ង ៖ ជាប់បៃតង · មិនភ្ជាប់វិញ) |
| M2 | ដកទ្វារភ្ញាក់ពី background | ❌ ២ (ច) |
| M3 | ដកការហៅក្នុងវដ្ត ៦០ វិ. | ❌ ៣ (ជ) |
| M4 | វាស់ ➜ មិនផ្តាច់ | ❌ ៧ (ង · ច · ជ ៖ ជាប់បៃតង · មិនភ្ជាប់វិញ · WebSocket រស់ ០) |
| M5 | ពិដានវាស់ ១០ ➜ ២ វិ. (ទិសផ្ទុយ ៖ យឺតតែរស់) | ❌ ១ (គ ៖ ការតភ្ជាប់យឺត ៣ វិ. ត្រូវច្រឡំជា zombie) |

⛔ អន្ទាក់ harness ដែលធ្វើឲ្យការរត់ដំបូង **បៃតងក្លែងក្លាយលើកូដមុនកែ** («ភ្ជាប់វិញ ✅») ៖ (១) Chromium ចរចា `permessage-deflate` ➜ frame handshake ត្រូវបង្ហាប់ ➜
ការសរសេរ host `"h":"127.0.0.1:9000"` ឡើងវិញមិនកើត ➜ SDK ភ្ជាប់ឡើងវិញទៅ emulator **ផ្ទាល់** (ដក `Sec-WebSocket-Extensions`) · (២) ក្រោយ WebSocket បរាជ័យ
(`previous_websocket_failure` ក្នុង `localStorage`) SDK ចាប់ផ្តើមដោយ **long-poll** (`/.lp` · JSONP) ហើយ upgrade ទៅ WebSocket តាម host ក្នុងតួ HTTP ➜ ត្រូវសរសេរ
ឡើងវិញទាំងនោះដែរ (`Content-Length` ថ្មី) · (៣) proxy ដែលធ្វើឲ្យ socket ថ្មីក្នុងពេលដាច់ **ងាប់ជារៀងរហូត** បង្កើតការភ្ជាប់វិញ ៣៥ វិ. ក្លែងក្លាយ (Chromium ជាប់
handshake នោះ) ➜ ពិតប្រាកដ SYN ដែលគ្មានចម្លើយត្រូវផ្ញើឡើងវិញ ហើយជោគជ័យពេលបណ្តាញមកវិញ ➜ proxy **ទប់** វា ហើយ **ដោះ** ពេល restore · (៤) វដ្ត ≥ ៦០ វិ. ត្រូវចាប់ទុក
(`__fireIntervals`) ➜ ផ្នែកនីមួយៗវាស់តែទ្វាររបស់វា។ ⛔ ការសង្កេតដែល **បដិសេធ** ៖ long-poll ក្រោយ offline/online **មិនមែន** មកពី `forceDatabaseReconnect()`
របស់ App (rebind វាជា no-op ➜ លំនាំដូចគ្នា ws · lp · ws · lp · បៃតងក្នុង ~២១០ ms) ➜ មិនកែ។

⛔ ចន្លោះដែលនៅសល់ ៖ **ZoeKeyGen មិនទាន់មានការវាស់ភាពរស់** (ឧបករណ៍ admin ៖ ប្រតិបត្តិការមានពិដាន ១៥ វិ. រួច តែចំណុចស្ថានភាពអាចបៃតងក្លែងក្លាយ) ·
ឧបករណ៍ពិត (iOS resume · WiFi គ្មានអ៊ីនធឺណិត) មិនទាន់វាស់ ➜ `CLAUDE.md` 📌។

ផលប៉ះពាល់លើ checker ៖ `dbOp` ពិតឥឡូវហៅ `probeDatabaseLiveness()` ពេលព្យួរ ➜ sandbox `vm` **១២ ឯកសារ** ដែលរត់ `dbOp` ពិតដោយគ្មានវាលស្ថានភាពថ្មី ធ្លាក់
`ReferenceError` (សញ្ញាល្អ ៖ ពួកវារត់កូដ ship ពិត) ➜ stub «មិនវាស់» (`null`) ក្នុង sandbox (ការវាស់ពិតរស់ក្នុង `emu/app-network-e2e`) · `daily-collected-test` មាន
sandbox **២** (ទី ២ ផ្ទុក FunctionDeclaration ទាំងអស់) ➜ stub ទាំង ២ · `clock-hygiene` អនុញ្ញាត function ៤ (ត្រា local `Date.now()` ដែល `elapsedSince()` វាស់ ➜ ច្បាប់
«មូលដ្ឋាននាឡិកា») · `state-hygiene` ទទួល `documentHiddenAt` (ត្រាពេល មិនមែនទិន្នន័យអតិថិជន)។ run-all ចុងក្រោយ (emulator · `*_STRICT` · `NETE2E_STRICT=1`) ៖
**១៩០ ពេញលេញ · ០ មួយផ្នែក · ០ រំលង · ធ្លាក់ ០** (៦១៣ វិ. · lane ៤)។

**២. ការវាស់ដែល *បដិសេធ* សម្មតិកម្ម** (កុំវាស់ឡើងវិញដោយគ្មានហេតុផលថ្មី) ៖
- XSS ៖ `ZoeW/src/**` គ្មាន `innerHTML` (ក្រៅ `audit-compat.ts` ដែលជា build វាស់) · URL ថាមវន្តតែ `tel:` · ZoeKeyGen `innerHTML` ទាំងអស់ឆ្លង `escapeHtml()`
  (`html-sink-escaping` ចាក់សោ)។ secret ក្នុង URL ៖ `auth=` (ID token ក្នុងការអាន REST របស់ wrapper) ស្ថិតក្នុង `SECRET_PARAM_PATTERN`។
- ឯកសារ «មិនមាននរណាយោង» ក្នុង repo (ក្រៅ manifest · ប្រវត្តិ) ៖ `.npmrc` · `push-cron.mjs` (Netlify រកតាមថត) · `tsconfig.json` (`tsc -b`) ➜ ប្រើពិតទាំង ៣។
- `MIGRATION.md` «កូនសោ `localStorage` ទាំង ៤៦» ៖ លេខរឹងដែលគ្មានអ្នកវាស់ (ឥឡូវច្រើនជាងនោះ) ➜ យោង `npm run parity` ផ្នែក ៤ ជំនួស។

### Push លើ APK ព្យួរ ៖ plugin Capacitor ជា thenable (2026-09-30 · ZoeW 2.45.6)

រកឃើញដោយ **ម្ចាស់គម្រោង** (រូបថតអេក្រង់ ៖ «⏳ កំពុងភ្ជាប់…» ជាប់ · គ្មានប្រអប់សុំសិទ្ធិ) លើ APK ដែល sign + FCM ដំបូងគេ — **មិនមែនដោយឧបករណ៍ទេ** ៖
`push-client.test.tsx` មាន ២៩ តេស្តបៃតង រួមទាំង «watchdog ➜ `error` ក្នុងពិដាន» ព្រោះ mock ជា **object ធម្មតា** (`then` = `undefined`) ➜ ថ្នាក់ «stub ដែល
ទទួលយកគ្រប់យ៉ាង» (ការព្រមាន ២ ក្នុង `CLAUDE.md`) លើស្នាមភ្ជាប់ App ↔ Capacitor។ ⛔ មូលហេតុដែលវារស់រាន ៖ ផ្លូវ APK មិនដែលរត់លើឧបករណ៍ពិតមុន (workflow
`Android APK` មិនដែលបង្កើត Release ➜ APK ដែលមាន FCM មិនដែលមាន) ហើយ vitest · `native:check` មិនប្រើ `@capacitor/core` ពិត។

⛔ មេរៀន ៖ **mock ត្រូវចម្លង *អត្ថន័យ* របស់ dependency ពិត មិនមែនត្រឹម *ផ្ទៃ* (ឈ្មោះ method) ទេ** — Proxy ដែលឆ្លើយ property ណាក៏ដោយ ជាលក្ខណៈ
ពិសេសរបស់ plugin Capacitor ហើយ mock ដែលខ្វះវា បាំងថ្នាក់ «resolve ទៅ plugin» ទាំងមូល ➜ តេស្ត «Capacitor ពិតជា thenable» ចងការស្មោះនោះទៅកំណែ
`@capacitor/core` ដែលដំឡើង។ ⛔ plugin ផ្សេងទៀត (`haptics` · `share` · `filesystem` · `printer` · `app` · `native-biometric`) បំបែកពី module namespace ឬ
static import ➜ មិនដែល resolve ទៅ plugin ➜ មិនរងផល (ពិនិត្យលើ `import('@capacitor/…'|'@capgo/…')` ទាំងអស់ក្នុង `src/**`)។ ⛔ ជាន់ទី ២ ៖ ការព្យួរណាមួយ
**មុន** watchdog បង្កើត «`busy` ជារៀងរហូត» (សោ) ➜ ពិដានលើជំហានដែលមិនសួរអ្នកប្រើ។

⛔ ចំហៀង ៖ ការ build APK (Gradle) ក្នុងម៉ាស៊ីនដដែល ធ្វើឲ្យ `npm run lint` ក្នុង `zoew-suite` ធ្លាក់ ព្រោះ ESLint ស្កេន output ក្រោម
`android/app/build/` (`native-bridge.js` · ២៩ ឯកសារ) ➜ `eslint.config.mjs` មិនស្កេន `android` (git មិនតាមដាន JS/TS នៅទីនោះទេ · ឯកសារដែលស្កេន ៣០៨ ➜ ២៧៩ =
ត្រឹម `android/` ២៩ · `src/` និង `tests/` ដដែល)។ run-all លើកដំបូង ៖ **១៨៨ ពេញលេញ · ០ មួយផ្នែក · ០ រំលង · ធ្លាក់ ១** (`zoew-suite` ៖ lint តែប៉ុណ្ណោះ)។

### Deep audit 2.45.5 ៖ `navigator.onLine` ដែលកុហក · អ្នកយាម parity ដែលគ្មាននរណារត់ (2026-09-30 · ZoeW 2.45.5 · ZoeKeyGen 2.22.1)

baseline (tree មិនប៉ះ · emulator · `*_STRICT`) ៖ **១៨៨ ពេញលេញ · ០ មួយផ្នែក · ០ រំលង · ០ ធ្លាក់** (៥៦៩ វិ.)។ កំហុសទាំងអស់ខាងក្រោម **បៃតងលើសំណុំនោះ**។

**១. `navigator.onLine` កុហក ➜ ការស្តារ SDK ចំណាយពិដានខណៈបណ្តាញស្លាប់** ៖ រកឃើញដោយសួរ «តើ *អ្វីខ្លះ* ពឹងលើ `onLine`?» (ឯកសារ `src/**` ១៨) បន្ទាប់ពី
ផ្ទៀងក្នុងប្រភព Chromium ថា WebView គ្មាន `ACCESS_NETWORK_STATE` ឲ្យ `onLine = true` ជានិច្ច។ `reloadForFirebaseSdk()` ជឿ `onLine` ជាសាលក្រម «មានបណ្តាញ» ➜
ពិដាន ៣ អស់ក្នុង ~៦០–៩០ វិ. ➜ ក្រោយនោះ checker ចាស់ **អះអាង** «ក្រោយអស់ពិដាន ការស្តារត្រឡប់ទៅជណ្តើរចាស់» — ជណ្តើរដែល **មិនអាចជោគជ័យ** (module map
ចងចាំការបរាជ័យ) ➜ ការអះអាងនោះចាក់សោស្ថានភាពជាប់។ ⛔ មេរៀន ៖ ពិដានដែល **អស់ដោយគ្មានសាលក្រមពិត** ជាអន្ទាក់ស្ថាពរដូច «កូនសោ registry កំព្រា» ➜
មុនចំណាយពិដាន ត្រូវ **វាស់** លក្ខខណ្ឌដែលធ្វើឲ្យការចំណាយមានប្រយោជន៍។ ⛔ ការវាស់ខ្លួនវាត្រូវឆ្លង CSP ➜ `netlify-config-scope-test` ឃ ដេរីវេ origin ពីកូដ
(Chromium ពិត ៖ CSP ចាស់ ➜ `connect-src` violation · fetch បោះ ➜ ការវាស់ «ឈានមិនដល់» ជារៀងរហូត ➜ ការកែក្លាយជា «មិនដែលផ្ទុកឡើងវិញ»)។

**២. Push លើ APK** ៖ ការបិទមិនប្រាប់ server (web ប្រាប់) — រកឃើញដោយ **តារាងប្រៀបធៀបបងប្អូន** web ↔ native នៃ `disablePush()`។ callback `registration`
ទទួល token ដោយមិនសួរ «អ្នកប្រើចង់បើកទេ?» — រកឃើញដោយអានកូដ plugin Capacitor ពិត (`MessagingService.onNewToken` ➜ `registration` ពេល FCM auto-init)។
⛔ ច្រកទ្វារដំបូង (ផ្អែកលើ `saved.on`) **បំបែកកិច្ចសន្យាចាស់** «token យឺតក្រោយ watchdog នៅតែបញ្ចប់ជា on» (តេស្តចាស់ធ្លាក់ ១) ➜ ចេតនាអ្នកប្រើត្រូវជា
វាលដាច់ដោយឡែក (`nativeWanted`) មិនមែនដេរីវេពីស្ថានភាព UI។

**៣. 🔴 អ្នកយាម parity ធៀប ZoeW ដើម ក្រហមស្ងាត់ៗ តាំងពី 2.43.0** ៖ `npm run parity:all` ➜ `parity:dom` **❌ ៣/៣** អេក្រង់ · `parity:live` **១៨/១៨** ជំហានខុស ·
`parity:deep` **៧៩/៧៩** ជំហានខុស — លើ `main` ផងដែរ (ផ្ទៀងលើ tree មុនកែ)។ មូលហេតុ ៖ `zoew-suite` រត់តែ `parity` (កាតាឡុក) ➜ DOM · live · deep
**មិនដែលរត់ក្នុង CI** ➜ ផ្ទៃថ្មីដោយចេតនា (ផ្ទាំង 🔔 · logo SVG · ល្បឿនស៊ុមក្នុងរបា Slide · token `op`) ធ្វើឲ្យគ្រប់ជំហានក្រហម ➜ ការខុសគ្នាពិតណាក៏ដោយ
លិចក្នុងសំលេងរំខាន។ ការខុសគ្នាពិតប្រាកដមានតែ **២ ប្រភេទ** នៅ `parity:deep` (logo · `op`) ➜ ការកែ ៖ បញ្ជីតែមួយ `INTENTIONAL_UI` (`scripts/snapshot.mjs` ·
skip ៦ selector · opaque ២ · floating ២ · navbar −១៤px លើទូរស័ព្ទ) ➜ **DOM ៧២០/៧២០ × ៣ · layout ១៨/១៨ × ៣ · live ១៨/១៨ · deep ៧៩/៧៩** ហើយការងារ `zoew-parity`
(`zoew-suite-test.js --parity` · ១៦៨ វិ. · `dist-parity/` និង ZoeW ដើមក្នុងថតឯកជន ➜ មិនប្រណាំង `dist/`/`.original/` ជាមួយ `zoew-suite`)។

mutation លើ `dist` (ផ្ទៀងថាការលើកលែងមិនបិទបាំងការខុសគ្នាពិត) ៖

| # | mutation | លទ្ធផល |
|---|---|---|
| M1 | CSS `.page-main` −៥៦px (ច្បាប់ដែល **មិនអនុវត្ត** ក្នុងស្ថានភាពដែលវាស់) | រស់រាន — ⛔ mutation មិនទៅដល់អេក្រង់ (មិនមែនចន្លោះ) |
| M2 | ខ្សែអក្សរ «ធុងសំរាម» ទី ១ ក្នុង bundle (សារ **មិនបានគូរ**) | រស់រាន — ⛔ ដដែល |
| M3 | រូប 📷 របា Tab ➜ 📸 (គូរពិត) | `parity:dom` ❌ ៣/៣ · `parity:live` ❌ ១៨ |
| M4 | `.page-side { margin-top: 56px }` | `parity:dom` ❌ ៣/៣ (layout ១៧ · ១៧ · ១៤ /១៨) |
| M5 | navbar កម្ពស់ខុសពី −១៤px ដែលប្រកាស | `parity:dom` ❌ ៣/៣ |
| M6 | ផ្លូវ ledger ថ្ងៃប្តូរឈ្មោះ | `parity:deep` ❌ ៧២ ជំហាន |

⛔ មេរៀន M1/M2 ៖ «mutation រស់រាន» មានន័យតែពេល mutation **ទៅដល់ផ្ទៃដែលវាស់** — ផ្ទៀងវាជាមុន (grep ថាវាចុះលើឯកសារ **និង** ថាវាគូរ/រត់ក្នុងសេណារីយ៉ូ)
មុនសន្និដ្ឋាន «ចន្លោះ»។

**៤. ការវាស់ដែល *បដិសេធ* សម្មតិកម្ម** (កុំវាស់ឡើងវិញដោយគ្មានហេតុផលថ្មី) ៖
- `MainActivity` `preferredDisplayModeId` (mode Hz ខ្ពស់បំផុត) **មិនចាក់សោ** ល្បឿនអេក្រង់ ៖ AOSP `DisplayModeDirector` Android 12 · 13 · 14 បម្លែងវាជា
  `Vote.forBaseModeRefreshRate()` ដែលរក្សាជួរ physical/render `[0, ∞]` ➜ LTPO នៅចុះ Hz ពេលស្ងៀមបាន (Android 11 មិនបានពិនិត្យ)។
- ទង់ busy/in-flight ៣៥ កន្លែង ៖ រាល់មួយមាន `finally` · `withTimeout` · ឬការដោះពេលបើកប្រអប់វិញ (`manualAdjustBusy`) ➜ គ្មានថ្នាក់ «ការព្យួរ ≠ ការធ្លាក់» ថ្មី។
- Push server (`push-core.mjs`) ៖ SSRF (host push ពិតតែប៉ុណ្ណោះ) · License ECDSA + Revoke · ledger ETag ➜ គ្មានកំហុស។ `unsubscribe` គ្មាន License ជាការរចនា
  (endpoint/token ជា secret របស់ឧបករណ៍)។
- XSS ៖ `ZoeW/src/**` គ្មាន `innerHTML`/`dangerouslySetInnerHTML` · URL ថាមវន្តតែ `tel:` · SW `notificationclick` ដាក់ URL ក្នុង origin។
- secret ក្នុង repo ៖ មានតែ fixture តេស្ត (API key ក្លែង · private key សម្រាប់ចុះហត្ថលេខា ID token ក្លែងក្នុង `idtoken-fixture.js`)។

**៥. ការសម្អាត** ៖ លុប `ExampleUnitTest.java` · `ExampleInstrumentedTest.java` (template Capacitor · package `com.getcapacitor.myapp`) — តេស្ត instrumented
អះអាង package `com.getcapacitor.app` ➜ **ធ្លាក់** បើនរណារត់វាលើ `com.zoesystem.zoew` ➜ ជាឯកសារបំភ្លៃ មិនមែនអ្នកយាម។

**៦. CI ចុងក្រោយ** (tree `a93decc` · emulator · `*_STRICT` · `RUNALL_JOBS=4`) ៖ **១៨៩ ពេញលេញ · ០ មួយផ្នែក · ០ រំលង · ០ ធ្លាក់** (៦០២ វិ. · ផលបូកពេល checker
១៩២២ វិ.) — ១៨៨ របស់ baseline បូក `zoew-parity` (១៧៤ វិ.)។ ⚠️ ការរត់កណ្តាលទី (ពេល `push-server.test.ts` កំពុងកែ) ធ្លាក់ `zoew-suite` ម្តង ➜ រត់ឡើងវិញលើ tree
ដែល commit រួច ➜ ១៦/១៦ · output នៃការរត់នោះត្រូវរក្សាទុកតែជាសង្ខេបដែលច្រោះ (`run-all.sh` បោះពុម្ព output របស់ checker ដែលធ្លាក់ តែ state មិនរក្សាវា) ➜
មូលហេតុនៃការធ្លាក់នោះមិនអាចវាស់ពី log បានទេ ⛔ រក្សា log ពេញ (`> file 2>&1`) មុនច្រោះ។

### Mutation testing ជុំ ២ ៖ ១៥ mutation + ៣ ផ្ទៀងផ្ទាត់ ➜ ចន្លោះ ៣ (ខ្សែភ្ជាប់ SW ↔ ទំព័រ) · control ១ (2026-09-29 · ZoeW 2.45.4)

- **វិធី** ៖ ដូចជុំ ១ តែរត់ក្នុង **git worktree ដាច់ដោយឡែក** (tree ធ្វើការមិនប៉ះ) · subset checker ៣០ ក្នុងមួយ mutation (~១៩០ វិ.)។ ⛔ worktree
  ត្រូវ **គ្មាន symlink `node_modules` នៅ root** — ការផ្គុំ measure root ចម្លងវាចូល repo មេជា `node_modules/node_modules` ➜ mutation ៨ ចេញ
  «UNKNOWN» ក្នុង ៧ វិ. (វាស់បាន ៖ ការរត់លើកទី ១ ត្រូវបោះបង់)។

| # | Mutation | អ្នកចាប់ |
|---|---|---|
| N16 | SW `pushOpenUrl` ទទួល URL ក្រៅ origin | `zoew-suite-test` |
| N17 | ការទាញដំណឹងមិនដោះ `notifyFeedInFlight` | `zoew-suite-test` |
| N18 | តារាងអតិថិជនមិនគោរព `linkIsFrugal()` | `lookup-prefetch-test` · `adaptive-link-test` |
| N19 | តារាងអតិថិជនទាញខណៈប្រអប់បើក | `lookup-prefetch-test` · `lookup-freshness-test` |
| N20 | SW install គ្មាន `cache: 'no-cache'` | `sw-install-integrity-test` |
| N21 | License រំលងបណ្តាញ ➜ `ok:false` (App ទាំង ២) | `license-clock-trust-test` · `license-network-pressure-test` |
| N22 | ជុំបោស ZTO មិនដោះ in-flight ក្នុង `finally` | `zto-sync-banner-test` |
| N23 | Push ដក `pushStep` លើ `subscribe` | `zoew-suite-test` |
| N24 | Push token មិនបញ្ឈប់ watchdog | `zoew-suite-test` (+ `sw-install-integrity-test` ជុំទី ៤ **ធ្លាក់ម្តងម្កាល** — មិនពាក់ព័ន្ធ · មើលខាងក្រោម) |
| N25 | `.status-dot` `infinite` វិញ | `perf-check` |
| N26 | record primitive មិនរំលង | `field-shape-test` |
| N27 | ប្តូរឈ្មោះអថេរក្នុងស្រុក (control) | រស់រាន (ត្រឹមត្រូវ) |
| N28 | ដក listener `navigator.serviceWorker` ➜ `'message'` | 🔴 **រស់រាន** ➜ ឥឡូវ `sw-client-wiring-test` |
| N29 | `controllerchange` មិនបង្ហាញផ្ទាំងកំណែថ្មី | 🔴 **រស់រាន** ➜ ឥឡូវ `sw-client-wiring-test` |
| N30 | `visibilitychange` មិនពិនិត្យ SW update | 🔴 **រស់រាន** ➜ ឥឡូវ `sw-client-wiring-test` |
| R1 | rules ៖ ដក `hasChildren()` ពី `$itemId` ប្រវត្តិ | `rules-duplicate-keys` · `emu/crud-rules-flow` |
| M14 · M11b | (ជុំ ១ · ផ្ទៀងផ្ទាត់ការកែ) | `reconnect-ladder-test` · `lookup-failure-identity-test` |

- **N28–N30 ៖ មូលហេតុដែលរស់រាន** — ថ្នាក់ដដែលនឹង M14 ៖ handler ព្រឹត្តិការណ៍ជា arrow ក្នុង `registerServiceWorker()` ហើយ **ចុងទាំង ២** នៃស្នាមភ្ជាប់
  មានតេស្តដាច់ពីគ្នា (`client.postMessage` ក្នុង SW · `handleServiceWorkerMessage()` ផ្ទាល់ · `showUpdateAvailableBanner()` ផ្ទាល់) ➜ គ្មាននរណាសួរថា
  «សារដែល SW ពិតផ្ញើ ទៅដល់ handler ទេ?»។ ⛔ `ctx.serviceWorkers()` របស់ Playwright អនុញ្ញាត `evaluate` ក្នុងបរិបទ SW ពិត ➜ ផ្ញើតាម
  `clients.matchAll()` ដូច `notificationclick`។ ⛔ ពិដាន ១៥ នាទីវាស់ដោយនាឡិកាទំព័រដែលរំកិល (`Date.now` ក្នុង `addInitScript`) ➜ ទិសផ្ទុយ
  «មុនពិដាន ➜ គ្មានការហៅ» ចាប់ការដកពិដាន។ `notifyDrawerOpen` · `notifyFeedInFlight` **មិនបើកលើ `window`** (មិននៅក្នុង `_generated-state.json`) ➜
  អានពី DOM (`#notifyDrawer.open` · `#zoeUpdateBanner`) និងការហៅ server។
- **`sw-install-integrity-test` ជុំទី ៤ (B ➜ C) ធ្លាក់ម្តងម្កាល ៖ ការប្រណាំងក្នុង checker (App ត្រឹមត្រូវ)** — ធ្លាក់ក្នុង N24 (កែតែ `push.ts`) និងម្តងទៀតក្នុង CI ពេញ។
  ⛔ «flake» មិនមែនមូលហេតុ ➜ ជំហានទី ១ ៖ ការធ្លាក់រាយមូលហេតុ ➜ CI ពេញ ៖ `serverWasmHits: 0 · serverSwHits: 1 · effectiveType: 4g · controller: activated` ➜
  **មិនមែន** link «frugal» · `sw.js` ត្រូវទាញ ១ ដង តែ `.wasm` មិនដែល ➜ SW **A** (ចាស់) នៅគ្រប់គ្រង ៖ វាពិនិត្យ deploy ឃើញ `-b` ➜ មិន revalidate (**ត្រឹមត្រូវ** តាមច្បាប់
  «មិនចាក់ឯកសារ deploy ថ្មីចូល cache ចាស់»)។ មូលហេតុ ៖ `install` ដាក់ `CORE_SHELL` (រួម `.wasm`) សិន រួចទើប `OPTIONAL_SHELL` ➜ `skipWaiting()` ➜ `clients.claim()`
  ខណៈជំហាន B របស់ checker ឈប់រង់ចាំពេល `.wasm` ចូល cache `-b` ➜ ពេលម៉ាស៊ីនរវល់ ចន្លោះនោះលើសបង្អួច ១២ វិ.។ ⛔ ការសាកក្រោមបន្ទុក ១៦ ដង (រួម CPU ពេញ) **មិន**
  បង្កើតវាឡើងវិញ — ការពន្យារដោយចេតនាទើបបង្កើតបាន ៖ server សាកល្បងពន្យារ `OPTIONAL_SHELL` ទី ១ (ដេរីវេពី `sw.js` ពិត) ១៣ វិ. ពេល install B ➜ ចន្លោះប្រណាំង
  កើត **ជានិច្ច** (លក្ខខណ្ឌចាំបាច់ថ្មី) ➜ កំណែគ្មានការរង់ចាំ ធ្លាក់ **ជាប់លាប់** ដោយហត្ថលេខាដូចការធ្លាក់ក្នុង CI បេះបិទ · កំណែកែ (រង់ចាំ B ចាប់យកទំព័រ ៖ `installing`/`waiting`
  ទទេ · cache `-a` លុប) ➜ **២៧/២៧**។ ⛔ មេរៀន ៖ ការរង់ចាំ «ទិន្នន័យថ្មីនៅក្នុង cache» មិនមែន «SW ថ្មីគ្រប់គ្រង» · ការប្រណាំងដែលកើតម្តងម្កាល ត្រូវបង្កើត
  **ដោយការពន្យារដោយចេតនា** មិនមែនដោយការរត់ច្រើនដង។

### Mutation testing ផ្នែកបណ្តាញ ៖ ១៥ mutation ➜ ចន្លោះ ២ · equivalent ១ · control ១ (2026-09-29 · ZoeW 2.45.4)

- **វិធី** ៖ ក្នុងមួយ mutation កែ `ZoeW/src` ១ កន្លែង ➜ `RUNALL_ONLY=<checker បណ្តាញ ៣៦ រួម zoew-suite-test>` + `RUNALL_STATE=` ➜ ស្តារ
  (~១៥២ វិ./mutation · BASE ៣៦/៣៦ បៃតង ១៥៩ វិ. ➜ ការធ្លាក់ = ការចាប់ពិត)។ ⛔ អានឈ្មោះ checker ពីបន្ទាត់ `❌ ធ្លាក់ (N) ៖ …` របស់ run-all
  មិនមែន regex លើបន្ទាត់ checker (`*** FAIL ***` ខកខាន)។ ⛔ harness កែ `ZoeW/src` **នៅនឹងកន្លែង** ➜ កុំកែ `audit-tools/` · `ZoeW/tests` ខណៈវារត់
  (measure root ចម្លង `audit-tools/` ថ្មីរាល់ mutation)។

| # | Mutation | អ្នកចាប់ |
|---|---|---|
| M01 | `visibilitychange` មិនហៅ `retryFailedDbListenersNow()` | `connection-recovery-test` |
| M02 | `.info/connected=true` មិនហៅ `flushPendingHistoryPatches()` | `history-patch-retry-test` |
| M03 | ដកពិដាន `RECONNECT_FORCE_MIN_GAP_MS` | `monotonic-gate-test` · `connection-recovery-test` |
| M04 | `.info/serverTimeOffset` ងាប់ ➜ `isDatabaseConnected = false` | `connection-recovery-test` |
| M05 | ដក `dbListenerReportedFailures.delete(pathKey)` | `connection-recovery-test` |
| M06 | ដកច្រកទ្វារជំនាន់ពី callback `dailyCollected` | `connection-recovery-test` |
| M07 | timeout របស់ `fetchWithTimeout` មិន `abort()` | `network-timeout-test` |
| M08 | `retryAsync` មិនគោរព `noRetry` | `lookup-failure-identity-test` · `health-check-test` |
| M09 | SW revalidate HTML ចូល cache | `zoew-suite-test` (`sw-revalidation-timeout.test.ts`) |
| M10 | ដក `anyModalIsOpen()` ពី `reloadForFirebaseSdk()` | `connection-recovery-test` |
| M11 | ដក `ZTO_AUTH_EXPIRED` ពី `lookupFailureIsDefinitive()` | **equivalent** — Function ផ្ញើវាជាមួយ **401** ➜ សារ `HTTP 401` ធ្វើឲ្យស្ថាពរដដែល |
| M11b | ដក `ZTO_AUTH_NOT_CONFIGURED` | 🔴 **រស់រាន** checker lookup ៧ ➜ ឥឡូវ `lookup-failure-identity-test` |
| M12 | `online` មិនដាក់ `networkJustReturned = true` | `connection-recovery-test` |
| M13 | `/disconnect\|already deleted/i` ➜ `/disconnect/i` | `history-patch-retry-test` |
| M14 | `offline` មិនហៅ `clearReconnectWatchdog()` | 🔴 **រស់រាន** checker ៣៦ ➜ ឥឡូវ `reconnect-ladder-test` |
| M15 | ប្តូរឈ្មោះអថេរក្នុងស្រុក (control) | រស់រាន (ត្រឹមត្រូវ) |

- **M14 ៖ មូលហេតុដែលរស់រាន** ៖ `reconnect-ladder-test` ក្លែងជណ្តើរ តែ **មិនដែលរត់ handler `offline`/`online`** ក្នុង `setupConnectionRecovery()`។
  ផលពិត ៖ timer ជំហានវែង (៦០ វិ.) នៅរស់ឆ្លងការដាច់ ➜ `online` ➜ `scheduleReconnectWatchdog()` `return` (timer មានរួច) ➜ ការព្យាយាមបន្ទាប់រង់ចាំ
  timer ចាស់ ជំនួសជំហាន ៥ វិ. · ចំនួនការព្យាយាមមិន reset ➜ «កំពុងភ្ជាប់…» មិនលេច។ ⛔ ការវាស់ជំនាន់ដំបូងប្រើការដាច់ **៣ × ៦០ វិ.** ➜ ចាប់បានតែ ១
  ការអះអាង ព្រោះ timer ចាស់បាញ់ខណៈក្រៅបណ្តាញ ហើយសម្អាតខ្លួនឯង ➜ ការដាច់ត្រូវ **ខ្លីជាង** ពេលនៅសល់របស់ timer (២ × ជំហានដំបូង)។
  ក្រោយពង្រីក ៖ M14 ➜ **ធ្លាក់ ២** · tree ស្អាត **២៦/២៦** · ថតទទេ exit 1។
- **M11b ៖ មូលហេតុដែលរស់រាន** ៖ ការអះអាង cooldown ចាស់វាស់ `lookupFailureCooldownMs("definitive")` (ថេរ) និងការបរាជ័យ timeout តែប៉ុណ្ណោះ ➜
  គ្មាននរណាសួរថា **កូដណា** ទៅដល់ «definitive» លើផ្លូវ `attemptAutoLookup()` ពិត។ `ZTO_AUTH_NOT_CONFIGURED` · `ZTO_CONFIG_INVALID` ·
  `ZTO_PROXY_NOT_CONFIGURED` មកជាមួយ **503** ➜ មានតែការពិនិត្យកូដទេដែលធ្វើឲ្យវាស្ថាពរ ➜ បើបាត់ ការស្កេនសាកម្តងទៀតរាល់ ៦ វិ. ទៅ Function
  ដែលមិនទាន់កំណត់។ ក្រោយពង្រីក (កូដ ➜ status **ដេរីវេពី `zto-order-detail.js`** ៖ auth/config ៤ ➜ ៣០ វិ. · 429/5xx ៦ ➜ ខ្លីជាង) ៖ M11b ➜ **ធ្លាក់**
  (`6000`) · tree ស្អាត **៥០/៥០** · M11 នៅ **៥០/៥០** (equivalent មិនត្រូវចាក់សោ) · ថតទទេ exit 1។
- ⛔ **មេរៀន** ៖ «ធ្លាក់ត្រឹមតែម្ខាងនៃឯកសារ» — M14 រស់ព្រោះ checker ស្រង់តែ function ដែលមានឈ្មោះ ខណៈ handler ព្រឹត្តិការណ៍ជា arrow function
  ក្នុង `setupConnectionRecovery()` (ថ្នាក់ដដែលនឹង `retryFirebaseSdkNow()` ក្នុង `CLAUDE.md` ៖ «`shared-fns.js` មើលមិនឃើញ handler») ➜ សួរ
  «តើ handler ព្រឹត្តិការណ៍ណាខ្លះ **គ្មាននរណារត់**?»។

### `run-all.sh` ស្របគ្នា · state ដែលបន្តបាន (2026-09-28 · ឧបករណ៍ប៉ុណ្ណោះ ➜ គ្មានការឡើងកំណែ App)

⛔ **កូដ ship មិនប្រែ** (`ZoeW/` · `ZoeKeyGen/` មិនប៉ះ) ➜ `APP_VERSION`/`CACHE_VERSION` មិនឡើង (ច្បាប់ ៦ · `version-bump-scope`)។
សកម្មភាពដែលត្រូវធ្វើដោយដៃ ៖ **គ្មាន**។

- **មូលហេតុ** ៖ កូតា GitHub Actions អស់ ➜ `run-all.sh` ក្នុង session ជា CI តែមួយ។ checker ១៨៤ រត់ **ជាជួរ** តាម `run()`
  ➜ session ដែលអស់កូតាកណ្តាលទី **បាត់លទ្ធផលទាំងមូល** (ម្ចាស់គម្រោងផ្គុំ log មួយផ្នែកៗដោយដៃ)។
- **វាស់មុន** (4 CPU · RTDB emulator · `CRUD_FLOW_STRICT=1 VERSIONSCOPE_STRICT=1 MONEYGUARD_STRICT=1` · tree `0ef79fc`) ៖
  **១៦៩៤ វិ. (២៨.២ នាទី) · ១៨៤ PASS**។ យឺតជាងគេ ៖ `exit-code-integrity` ២៩២ · `money-guardian` ១៦៥ · `zoew-suite` ១២៧ ·
  `revenue-fuzz` ១២៤ · `app-lock` ៩៨ · `ui-flow` ៩៥ · `checker-coverage` ៦៩ វិ.។
- **វាស់ក្រោយ** (ម៉ាស៊ីនដដែល · ទង់ដដែល · `RUNALL_JOBS=4` · session ថ្មី · គ្មាន state ➜ លំដាប់ពី `RUNALL_HINTS`) ៖ **tree ក្រោយ merge PR #261 (`ceac95e`) ៖ ៥២៩ វិ. (៨.៨ នាទី) · ១៨៥ PASS · ០ មួយផ្នែក · ០ រំលង ➜ លឿន ៣.២×** (`exit-code-integrity` របស់ main ៨៩.៧ វិ. · ផលបូកពេល checker ១៥៧៥ វិ.)។ branch មុនរួមបញ្ចូល main ៖ ៥៨៥ វិ. (២.៩×)។ ផលបូកពេល checker ១៦៣៤ វិ. · ដំណាក់កាល meta ម្នាក់ឯង ~២១១ វិ. (`checker-coverage` ៦៨ + `exit-code-integrity` ១៤៣) + ដំណាក់កាលស្របគ្នា ~៣៦០ វិ. (≈ ផលបូក/៤ ➜ lane ពេញ)។ ជុំដំបូងគ្មាន `RUNALL_HINTS` ៖ ៦៥៤ វិ. (`zoew-suite` ចាប់ផ្តើមចុងក្រោយ)។ ⛔ ជាន់ក្រោមនៃពេលឥឡូវជា **ដំណាក់កាល meta** ៖ ការឲ្យវាជាន់ lane ផ្សេង ត្រូវវាស់ជាមុនថា ស្រមោល `.tmp-poison-*` មិនប៉ះ checker ដែលដើរថត `audit-tools/`
- **`exit-code-integrity` ២៩២ វិ. = ៩៧% នៃពិដាន ៣០០ វិ.** ៖ branch នេះរកឃើញ និងកែវាដោយឡែក (pool + `timeout` + រត់ឡើងវិញម្នាក់ឯង ➜ ១៤២ វិ.) តែ `main` merge ការកែដ៏តឹងជាង (ផ្នែកបន្ទាប់ ៖ timeout = `unverified` · `money-guardian` រំលង matrix ពេលពុល ➜ ៧៥ វិ.) មុន ➜ ពេល merge **យកកំណែ `main` ទាំងស្រុង** ហើយដកការកែ និងការចាក់សោស្តាទិចរបស់ branch នេះចោល។ នៅសល់ ៖ `checker-coverage` ផ្នែក ៥ (SIGKILL `exit-code-integrity` ក្រោយ ២.៥ វិ.) សម្លាប់កូនពុលកំព្រាតាមឈ្មោះស្រមោល `.tmp-poison-<pid>-` (PID ជាក់លាក់ ៖ កូនដែលរត់ស្របគ្នាពេលឪពុកត្រូវ SIGKILL **គ្មានថវិកាទៀតទេ** ➜ រត់រហូតដល់ចប់ ជាន់ដំណាក់កាលបន្ទាប់ — វាស់ឃើញលើកំណែ pool ៖ `money-guardian` ពុល + អ្នកយាមកូន ៦០ វិ.)។
- **lane ដែលវិភាគ/វាស់** ៖ (១) `checker-coverage` · `exit-code-integrity` **សរសេរ ហើយបោស** `.tmp-poison-*` ក្នុង
  `audit-tools/` — ការបោសរបស់ `exit-code-integrity` កូន (ផ្នែក ៥) លុបស្រមោលដែល `exit-code-integrity` មួយទៀតកំពុងរត់ ➜
  **excl** (រត់ម្នាក់ឯង) · (២) RTDB emulator តែមួយ ➜ `emu/*` + `money-guardian` **ម្តងមួយ** · (៣) browser ៖ **វាស់មុនសម្រេច** — checker browser ៤៦ តែឯង `RUNALL_JOBS=4 RUNALL_BROWSER_JOBS=4` **២ ជុំ** ➜ **០ ការធ្លាក់** (២២៥ វិ. ធៀបផលបូក ៨៥៨ វិ. = ៣.៨×) បូកការរត់ពេញស្របគ្នា (browser ៤ ជាមួយ lane ផ្សេង) ០ ការធ្លាក់ ➜ ការរត់ browser ១៣៨ ក្រោម ការប្រជែង ៤ ផ្លូវ គ្មានការធ្លាក់ ➜ លំនាំដើម `RUNALL_BROWSER_JOBS` = `RUNALL_JOBS` · (៤) **លំដាប់រត់** ៖ session ថ្មីគ្មាន state ➜ ជុំដំបូង `zoew-suite` (~១៣០ វិ.) ចាប់ផ្តើម **ចុងក្រោយ** (លំដាប់បញ្ជី) ➜ កន្ទុយវែង ➜ `RUNALL_HINTS` (checker យឺតជាងគេ ១៥ · ប៉ះតែលំដាប់) · (៥) `node --check` ក្នុង «ទម្លាប់គម្រោង» ធ្លាប់ `exit 1` **ក្នុង shell មេ** ➜ កំហុស syntax បញ្ឈប់ run-all ដោយគ្មានសេចក្តីសង្ខេប ➜ ឥឡូវជា FAIL ដែលមានឈ្មោះ (ពិនិត្យទាំង ២ ទិសលើ fixture)
- **អ្នកយាម** ៖ `runall-runner-test` (ឥរិយាបថ ៖ checker ក្លែងដេក/ធ្លាក់/SKIP/ព្យួរ ➜ ចន្លោះ start/end ពិត) **ធ្លាក់ ២៦**
  លើ `run-all.sh` ជាជួរចាស់ (ស្របគ្នា ១ · គ្មាន state/RESUME/ONLY · TERM បន្សល់ `timeout`+node កំព្រា · បញ្ជី lane ទទេ) ·
  ផ្នែក ៦ ផ្ទៀង lane នៃបញ្ជីពិតទល់នឹងភស្តុតាងក្នុងប្រភព **ទាំង ២ ទិស** (ជំនាន់ដំបូងរាយខុស `license-seat-test` ·
  `doc-scope-test` ព្រោះ `emu/…js` លេចក្នុង **comment** ➜ ភស្តុតាងត្រូវកាត់ comment ដោយ acorn មុន) · `hang-guard` ស្រង់ប្លុក
  `#@runner-begin`…`#@runner-end` (tree ចាស់ ➜ `run()`) រត់ checker ព្យួរ **ជាមួយ** checker បៃតង (ការព្យួរមិនលេបលទ្ធផលដទៃ)។
- ⛔ **harness ត្រូវ env ស្អាត** ៖ checker រត់ជាកូនរបស់ run-all ពិត ➜ `RUNALL_STATE`/`RUNALL_ONLY`/`RUNALL_RESUME` ដែល export
  នឹងធ្វើឲ្យ fixture សរសេរចូល state ពិត ឬត្រូវត្រងចោល ➜ `hang-guard` · `runall-runner-test` លុប `RUNALL_*` មុនរត់ harness។

### meta-checker លើសពិដាន ៣០០ វិ. ក្រោយ 2.42.8 ៖ `exit-code-integrity` រត់កូនជាជួរ · timeout ត្រូវរាប់ជា «ធ្លាក់ត្រឹមត្រូវ»

- **អ្វីដែលឃើញ** ៖ ក្រោយ merge PR #259 `run-all.sh` ធ្លាក់ **១** ៖ `exit-code-integrity (meta)` «ព្យួរ — លើសពិដាន 300s» ខណៈ checker ផ្សេងឆ្លង។
  កូដ App មិនពាក់ព័ន្ធ (ការកែប៉ះតែ `audit-tools/` ➜ App មិនឡើងកំណែ)។ ការអះអាង «គ្រប់ gate ជោគជ័យ» ក្នុងធាតុ 2.42.8 ផ្នែក ១ មកពីការរត់
  ជាផ្នែករួចបូក log ➜ ការរត់ checker ដែលធ្លាក់ **ដាច់ដោយឡែក គ្មានពិដាន ៣០០ វិ.** លាក់ថ្នាក់នេះ។
- **មូលហេតុឫសគល់ ២** ៖
  1. វាពុល និងរត់ checker កូន **១០៨ ម្តងមួយៗ** (`execFileSync`) ➜ **២៨០ វិ.** លើម៉ាស៊ីន ៤ CPU និង **៣៦៧.៦ វិ.** លើម៉ាស៊ីនមួយទៀត ➜ checker ថ្មី
     នីមួយៗរុញវាជិតពិដានបន្តិចម្តងៗ រហូតហួស។
  2. កូនដែលផុតថវិកា ៦០ វិ. ទទួល `rc = 'timeout/crash'` ➜ `rc !== 0` ➜ រាប់ជា «ការធ្លាក់ឡើងដល់ exit code» ➜ checker ដែល **ព្យួរ** ពេលការអះអាង
     ធ្លាក់ ត្រូវរាយបៃតង។ វាស់បាន ៖ `money-guardian-test` (ការរត់ធម្មតា **១៥៣ វិ.**) ផុត ៦០ វិ. រាល់ដង ហើយ `exit-code-integrity` ពុល **ខ្លួនឯង**
     រួចរត់ការពុលទាំងមូលម្តងទៀតជាកូន រហូតត្រូវសម្លាប់ ➜ ~២ នាទីដែលមិនវាស់អ្វីសោះ។
- **ការកែ** ៖ ការពុលរត់ **ស្របគ្នាក្នុងពិដាន** (`EXITCODE_CONCURRENCY` · លំនាំដើម = CPU ក្នុងចន្លោះ ២–៨ · `emu/*` ក្នុងផ្លូវតែមួយ) · settle តាម
  រចនាសម្ព័ន្ធ (SIGKILL ពេលផុតថវិកា + timer ទី ២ · កូនដែលនៅរស់ត្រូវសម្លាប់ពេលឪពុកចេញ) · សាលក្រម ៤ ៖ `failed` · `skipped` · `fake-green` ·
  **`unverified`** (ផុតថវិកា · signal · បើកមិនកើត ➜ FAIL) · ពេល `EXITCODE_CHILD` ៖ `exit-code-integrity` រំលងការពុល និង `money-guardian-test`
  រំលងអ្នកយាម × mutation (ការអះអាងទាំងអស់ធ្លាក់រួចហើយ ➜ វាស់តែផ្លូវ exit · money-guardian ដាក់ `ok(false)` ➜ របៀបនោះមិនដែលបៃតង)។
  លទ្ធផល ៖ **២៨០ វិ. ➜ ៧៥ វិ.** · កូន ១០៨ គ្មាន `unverified` · កូនយឺតជាងគេ `write-stall-guard-test` ~៣៨ វិ. (យឺតដោយ timer ពិត ៖ រត់តែឯង
  ក៏ ៣៨.៥ វិ. ដដែល ➜ ថវិកា ៦០ វិ. មិនអាស្រ័យលើបន្ទុក CPU)។
- **អ្នកយាម** ៖ `hang-guard` រត់ `exit-code-integrity.js` របស់ tree ដែលវាស់ លើ fixture ៤០ checker (មួយ **ព្យួរ** · ៨ **យឺត ២ វិ.** ពេលពុល) ➜
  (ក) កូនដែលព្យួរ ➜ FAIL ដែលមានឈ្មោះ · (ខ) ចប់ < ១៤ វិ. (ជាជួរ ≥ ២០ វិ.)។ tree មុនកែ ៖ **ធ្លាក់ ២** (២១.១ វិ.) · mutation «timeout = ធ្លាក់
  ត្រឹមត្រូវ» ➜ ធ្លាក់ ១ · mutation «ស្របគ្នា = ១» ➜ ធ្លាក់ ១ (២១.១ វិ.) · ក្រោយកែ **១១/១១** (fixture ៦.២ វិ.)។ `exit-code-integrity` ខ្លួនវាមាន
  តារាងសាលក្រម ៩ ករណី (timeout · signal · spawn ធ្លាក់ ➜ `unverified`)។
- ⛔ **មេរៀន** ៖ ការបង្កើន `CHECKER_TIMEOUT` **មិនមែនការកែ** — វាលាក់ checker ដែលព្យួរពិត។ ការរត់ស្របគ្នាក្នុងពិដានជាដំណោះស្រាយតាមរចនាសម្ព័ន្ធ
  ដូច probe ថតទទេរបស់ `checker-coverage` និងអ្នកយាមរបស់ `money-guardian-test` ដែលធ្លាប់ជួបថ្នាក់ដដែល (2.42.7)។

### Deep audit 2.42.7 ៖ ហេតុអ្វី checker ១៨៣ បៃតងលើកំហុស ៦

- **ការសម្អាតដកលុយ ២ ដង** ៖ `cleanup-interrupt-atomicity-test` វាស់តែ **tab ដែលស្លាប់** («សម្លាប់ការសរសេរទី N» ➜ tab ថ្មីស្តារ) ➜
  ស្ថានភាព «អ្នកស្តាររត់ **ខណៈ** ការសម្អាតដែលនៅរស់កំពុងរង់ចាំការសរសេរធុងសំរាម» មិនដែលត្រូវដាក់ចូល (សំណួរ ៨ ៖ «ដាក់ប្រព័ន្ធក្នុង
  *ស្ថានភាព* ណា?») ។ journal = «ការងារដែលអាចត្រូវរំខាន» ➜ ⛔ សួរជានិច្ច ៖ «**អ្នកណាផ្សេងទៀតអានវា ខណៈម្ចាស់នៅរស់?**» (វដ្ត ៦០ វិ. ·
  `visibilitychange` · tab ទី ២ ដែលចែក `localStorage`)។
- **barcode ស្ទួន** ៖ fake SDK របស់ `tx-outcome-test` រត់ updater លើ **តម្លៃ server** ជានិច្ច ➜ ស្ថានភាព «cache ទទេ ➜ updater ឃើញ `null`
  ➜ ផ្ញើ `true`» (ឥរិយាបថ SDK ពិតលើ path គ្មាន listener) មិនដែលកើត ➜ registry មិនដែលផ្ញើ `true` លើកូនសោដែលមានរួច។ ⛔ មេរៀន ៖ ការ
  សម្រេចតាម **តម្លៃ** (មិនមែនអត្តសញ្ញាណ) មានលក្ខខណ្ឌលាក់ ៖ «តម្លៃនោះជារបស់ខ្ញុំតែម្នាក់» ➜ តម្លៃថេរ (`true` · `0` · `{}`) បំពានវា។
- **ការដក ledger បាត់** ៖ លក្ខខណ្ឌលាក់ដដែល លើតម្លៃ **ដែលគណនា** ៖ ឧបករណ៍ ២ ដកចំនួនដូចគ្នាពីមូលដ្ឋានដដែល ➜ តម្លៃដូចគ្នាបេះបិទ។ fake SDK
  មិនដែលដាក់ «ការសរសេររបស់ឧបករណ៍ផ្សេង *ចន្លោះ* ការផ្ញើ និងការអាន REST» ➜ proxy របស់ emulator ត្រូវការ `beforeCut` (សរសេរតម្លៃរបស់ឧបករណ៍
  ផ្សេងមុនកាត់ put របស់យើង)។ ⛔ ការកែដែលត្រូវការការប្តូរ rules ត្រូវ **fail-open លើ rules ចាស់** (`permission_denied` ➜ ឥរិយាបថចាស់) ➜
  លំដាប់ Publish/deploy មិនអាចបំបែក App បានទេ។
- **SW លាយកំណែ** ៖ checker SW ទាំងអស់វាស់ **install ដែលជោគជ័យ** ឬ **SW ដដែលក្នុង deploy ដដែល** (ជុំទី ៤ ថែមទាំងអះអាងថា «C ដោយគ្មាន
  SW ថ្មី ➜ ត្រូវចូល cache») ➜ ស្ថានភាព «deploy ថ្មី · install ថ្មីធ្លាក់ · SW ចាស់នៅគ្រប់គ្រង» មិនដែលត្រូវវាស់។ ⛔ `#appPages` មិនមែន
  ភស្តុតាងថា App ចាប់ផ្តើម (index.html របស់ build វាស់មាន markup ស្រាប់) ➜ វាស់ **asset ដែល HTML ក្នុង cache យោង** ក្រៅបណ្តាញ។
- **ការសម្គាល់ខល** ៖ `history-patch-retry-test` stub `runTransaction` ឲ្យបដិសេធ `disconnect` **ភ្លាម** ➜ wrapper 2.42.6 (ដែល *ពន្យារ*
  `disconnect`) ឈរ **ក្រៅ** sandbox ➜ ស្នាមភ្ជាប់ «wrapper ↔ ពិដាន `dbOp` ↔ ការចូលជួរ» គ្មានអ្នកវាស់ (សំណួរ ៧)។
- **Sentry** ៖ `sentry-load-race-test` ផ្នែក ៦ វាស់ព្យុះលើ **សារដដែល គ្មានអត្តសញ្ញាណ** ➜ event ដដែលលើ **កញ្ចប់ផ្សេងគ្នា** មិនដែលត្រូវវាស់។
- **Mutation** (`money-guardian-test` ១៥/១៥) ៖ «ledger លែងផ្ទុក `op`» ➜ `tx-outcome-test` ក្រហម · «ដកច្រកទ្វារអ្នកស្តារ» ➜ `cleanup-interrupt-atomicity-test` ក្រហម · «registry ជឿ
  applied» ➜ `tx-outcome-test` ក្រហម · SW «ដកច្រកទ្វារ deploy» ➜ `sw-install-integrity-test` ជុំទី ៥ ក្រហម · «ចូលជួរលើការព្យួរណាក៏ដោយ» ➜
  `history-patch-retry-test` ក្រហម ២ (ទិសផ្ទុយ)។ ⛔ អ្នកយាម ៨ × (១ + mutation ១៥) រត់ជាលំដាប់ **លើសពិដាន ៣០០ វិ.** របស់ `run-all.sh` (CI ជុំទី ១ ៖
  «ព្យួរ») ➜ `money-guardian-test` រត់អ្នកយាម **ស្របគ្នា** (`MONEYGUARD_JOBS` · លំនាំដើម ≤ ៤) ➜ ~១៦០ វិ. ក្រោមបន្ទុក CI។
- **`emu/crud-rules-flow`** (CI ជុំទី ១) ៖ sandbox ខ្វះ `markCleanupJournalLive` · `releaseCleanupJournalLive` · `navigator` ➜ checker ធ្លាក់
  «dependency មិនមានក្នុង scope» (វាចាប់បានត្រឹមត្រូវ ៖ helper ថ្មីក្នុង `claimAndCleanupItem`) ➜ បន្ថែមក្នុងបញ្ជីស្រង់។

### `disconnect` ដែល server អនុវត្តរួច (2.42.6) ៖ ហេតុអ្វី checker ទាំងអស់មើលមិនឃើញ

- **fake SDK ទាំងអស់ចាត់ «reject» = «មិនបានអនុវត្ត»** ➜ របៀបបរាជ័យទី ៥ («បដិសេធ តែអនុវត្តរួច») មិនដែលត្រូវដាក់ចូល។ ថ្នាក់នេះជា
  «stub ដែលនិយាយមិនពិតអំពី dependency» ដូច «stub ដែលទទួលយកគ្រប់ការសរសេរ» ក្នុង `CLAUDE.md` ការព្រមាន ២។
- **ការស្រាវជ្រាវ SDK** ៖ `repoAbortTransactions`/`cancelSentTransactions_` បដិសេធ transaction ស្ថានភាព `SENT` ដោយ `disconnect` ពេល
  ការតភ្ជាប់ដាច់ — server អាចបានទទួល `put` រួច ➜ លទ្ធផល **មិនដឹង** តាមនិយមន័យ។ ការធ្វើឲ្យកើតឡើងវិញក្នុង emulator ពិតតម្រូវ proxy ដែល
  (១) កាត់ **ក្រោយ** frame `put` (WebSocket frame ត្រូវ unmask ដើម្បីស្គាល់វា) និង (២) សរសេរ host ឡើងវិញ (SDK ទទួល host ខាងក្នុងពី
  handshake ហើយភ្ជាប់ផ្ទាល់ទៅ `9000` រំលង proxy ➜ ជុំដំបូងនៃ `emu/tx-disconnect-emu-test` មិនកំណត់)។
- **Mutation** (`money-guardian-test`) ៖ «wrapper បោះ error ដើមជានិច្ច» ➜ `tx-outcome-test` ក្រហម · «រំលងការពិនិត្យម្ចាស់ធុងសំរាម» ➜
  `tx-outcome-test` ក្រហម (ធុងសំរាមស្ទួន + ដកលុយ ២ ដងលើឧបករណ៍ ២)។

### Sentry storm (2.42.6)

- `connection-recovery-test` ផ្នែក ៣ខ លើកូដមុនកែ ៖ `{"captures":49,"rounds":6,"paths":7}` ➜ ក្រោយកែ ៧ (១/path) · ទិសផ្ទុយ ៖ ការដាច់
  **ថ្មី** ក្រោយស្តាររួច រាយការណ៍ម្តងទៀត។ ⛔ ការដកស្ទួនក្នុង `error-reporting.js` ជាជាន់ទី ២ ទូទៅ (App ទាំង ២) មិនមែនជំនួសជាន់ទី ១ ទេ ៖
  វាមិនស្គាល់ «ការដាច់ថ្មី» ហើយបង្អួច ១០ នាទីរបស់វានឹងលេបការដាច់ថ្មីដែលកើតក្នុងបង្អួចនោះ។


## 🔎 លិបិក្រម — ឈ្មោះ checker ➜ ការពន្យល់រស់នៅឯណា

> ⛔ **តារាងនេះដេរីវេពីការលេចពិត** នៃឈ្មោះ checker (`audit-tools/**/*.js`) ក្នុងឯកសារទាំង ២ — មិនមែនសរសេរដោយដៃ។
> ផ្លូវធម្មតា ៖ checker ធ្លាក់ ➜ រកឈ្មោះវាត្រង់នេះ ➜ `grep -n "<ឈ្មោះ>" docs/HISTORY.md docs/HISTORY-ARCHIVE.md`។

| Checker | `HISTORY.md` (សម័យ React) | `HISTORY-ARCHIVE.md` (vanilla · ផ្នែក ៦ ៖ ផ្ទេរទៅ React) |
|---|---|---|
| `action-binding-test` | ផ្នែក ២ | ផ្នែក ១ |
| `adaptive-link-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `animation-cost` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `app-lock-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `auth-recovery-test` | — | ផ្នែក ៣ · ផ្នែក ៦ |
| `barcode-shape-test` | — | ផ្នែក ២ |
| `biometric-unlock-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `boot-animation-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `boot-runtime` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `camera-resume-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `checker-coverage` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `cleanup-clock-guard-test` | — | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៦ |
| `cleanup-interrupt-atomicity-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៦ |
| `clear-history-finalization-fence-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `clock-basis-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `clock-hygiene` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `code-duplication-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `collected-mirror-fuzz-test` | — | ផ្នែក ១ |
| `collected-mirror-lifecycle-test` | — | ផ្នែក ១ |
| `collected-value-fuzz-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `comments` | — | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `compensation-order` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `concurrent-scan-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `connection-recovery-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `connection-state-fuzz-test` | ផ្នែក ២ | ផ្នែក ១ |
| `csp-enforced-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `csp-lazy-resource-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `css-classes` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៦ |
| `css-media-override` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `css-var-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `daily-collected-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `db-stall-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `dependency-security-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `doc-scope-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៦ |
| `dom-hygiene` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `duplicate-money-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `duplicate-scan-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `empty-state-truth-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/app-network-e2e-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `emu/app-writes-rules-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `emu/crud-rules-flow` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `emu/ledger-revert-emu-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `emu/license-seat-rules-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៥ |
| `emu/ns` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/restore-deadlock-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `emu/restore-mutation-emu-test` | — | ផ្នែក ២ · ផ្នែក ៥ |
| `emu/tx-disconnect-emu-test` | ផ្នែក ២ | ផ្នែក ៦ |
| `exit-code-integrity` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `expired-trash-retention-test` | — | ផ្នែក ១ |
| `export-cells-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `field-shape-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `firebase-backup-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `firebase-config-paste-test` | ផ្នែក ១ | ផ្នែក ៣ |
| `firebase-provision-test` | ផ្នែក ២ | — |
| `fluid-type-focus-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `function-surface-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `gesture-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `google-sheets-cache-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `hang-guard` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `health-check-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `history-menu-dismiss-test` | — | ផ្នែក ២ · ផ្នែក ៦ |
| `history-patch-retry-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៦ |
| `html-sink-escaping` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `idtoken-fixture` | ផ្នែក ២ | — |
| `inline-handler-xss-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `ios-panel-glide-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `item-money-integrity-test` | — | ផ្នែក ១ |
| `keygen-biometric-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `keygen-notice-test` | ផ្នែក ១ | — |
| `keygen-pin-flow-test` | ផ្នែក ១ | — |
| `keygen-session-security-test` | ផ្នែក ១ | ផ្នែក ២ |
| `keygen-supabase-admin-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `keylist-consistency-test` | — | ផ្នែក ១ |
| `khmer-timezone-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `late-commit-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `layout-check` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `layout-thrash` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `ledger-clamp-symmetry-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `ledger-count-integrity-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `ledger-failed-apply-revert-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `license-app-code-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `license-clock-rollback-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `license-clock-trust-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `license-grace-test` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `license-network-pressure-test` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `license-record-race-test` | — | ផ្នែក ២ |
| `license-seat-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៥ |
| `listener-leak-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `listener-pending-key-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `locker-claim-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `lookup-burst-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-config-secret-test` | — | ផ្នែក ១ |
| `lookup-failure-identity-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-freshness-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-prefetch-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `loop-termination-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `money-core` | ផ្នែក ១ | ផ្នែក ៦ |
| `money-guardian-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៦ |
| `money-reality-check` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៦ |
| `money-reality-test` | ផ្នែក ១ | ផ្នែក ២ |
| `monotonic-gate-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `monthly-ledger-agreement-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `monthly-report-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `netlify-config-scope-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៦ |
| `network-pressure-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `network-timeout-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `offline-shell-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `page-nav-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `panel-motion-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `panel-snap-ownership-test` | — | ផ្នែក ២ · ផ្នែក ៦ |
| `partial-pickup-cleanup-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `payload-schema` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `perf-check` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `periodic-network-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `phone-search-swipe-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `phone-suggest-test` | — | ផ្នែក ១ |
| `pickup-barcode-identity-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `pickup-ledger-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pickup-repair-test` | — | ផ្នែក ១ · ផ្នែក ៣ |
| `pickup-reset-test` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pin-prompt-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `policy-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `price-edit-abort-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៦ |
| `raw-read-shape-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `react-view` | — | ផ្នែក ៦ |
| `reconnect-ladder-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `redact-dump` | — | ផ្នែក ១ · ផ្នែក ២ |
| `registry-orphan-list` | ផ្នែក ១ | ផ្នែក ១ |
| `registry-orphan-list-test` | ផ្នែក ១ | ផ្នែក ១ |
| `registry-release-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `repository-contract-test` | — | ផ្នែក ២ · ផ្នែក ៦ |
| `repository-file-coverage` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៦ |
| `restore-finalization-fence-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `restore-marker-hygiene-test` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `revenue-fuzz-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `revenue-rules-clamp-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `rules-duplicate-keys` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ |
| `runall-runner-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `scan-engine-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `scan-remove-mode-test` | — | ផ្នែក ១ |
| `sdk-offline-boot-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sdk-surface` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `secret-hygiene` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `semantic-ui-color-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `sentry-load-race-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `setup-link-browser-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `setup-link-logout-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `setup-link-roundtrip-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `shared-fns` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sheet-import-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `slow-write-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stale-clear-claim-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `stale-write` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stall-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `stall-lock-release-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `state-hygiene` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `stats-collected-truth-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `stats-measurable-gate-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `stats-screen-agreement-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `storage-blocked-boot-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `storage-guard` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `strip-comments` | — | ផ្នែក ១ · ផ្នែក ៦ |
| `supabase-data-tools-test` | ផ្នែក ២ | — |
| `supabase-docs-cache-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `supabase-app-network-e2e-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `supabase-datastore-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `supabase-fake-server` | ផ្នែក ២ | — |
| `supabase-functions-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `supabase-pg` | ផ្នែក ២ | — |
| `supabase-rls-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `sw-abort-propagation-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `sw-backend-chunk-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `sw-cache-failure-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-cache-key-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-client-wiring-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `sw-install-integrity-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `sw-revalidate-pressure-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-shell-latency-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `toast-action-truth-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `toast-truth-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `trash-modal-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `ts-comments` | — | ផ្នែក ៦ |
| `tx-outcome-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៦ |
| `ui-flow-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `user-guide-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `version-bump-scope` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `version-check` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `wiring` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `write-stall-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zoew-suite-test` | ផ្នែក ២ | ផ្នែក ៦ |
| `zto-budget-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ |
| `zto-cookie-capture-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `zto-cookie-session-test` | — | ផ្នែក ២ |
| `zto-cookie-store-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-cookie-sync-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៦ |
| `zto-list-sync-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `zto-negative-cache-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-network-boundaries-test` | — | ផ្នែក ២ |
| `zto-proxy-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `zto-signed-status-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `zto-sync-banner-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
