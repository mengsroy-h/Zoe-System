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

### 🤝 Handoff សម្រាប់ session បន្ទាប់ (ផ្ទៀង main PR #280 merge រួច ➜ `074903a`)

⛔ **ផ្ទៀងផ្ទាត់ git មុនជឿអត្ថបទនេះ** (`git log --oneline -3 origin/main`)។ ⛔ កុំ merge ដោយគ្មានសំណើម្ចាស់គម្រោង។

**ជុំ 2026-10-03 (Claude)** ៖ branch `claude/gracious-feynman-t7vu3k` ឈរលើ `codex/supabase-audit-handoff` (PR #281) ➜ ZoeW **2.49.0** ៖ Handoff ជំហាន ២
(register បន្តបាន) **កែរួច** + checkbox «ចងចាំពាក្យសម្ងាត់» (សំណើម្ចាស់គម្រោង) ➜ merge branch នេះ = រួម 2.48.2 ផង។ មិនទាន់ merge/deploy។

**ជុំសន្សំកូតា 2026-10-03** ៖ branch `codex/supabase-audit-handoff` កែការប្រណាំងកូដប្តូរពាក្យសម្ងាត់ (ZoeW 2.48.2)។
migration ថ្មី `20261002154730_zoe_reset_claim.sql` + Edge Functions + សារ App; មិនទាន់ merge/deploy។
ផ្ទៀង live មុនកែ៖ main CI Audit/APK ជាប់ · migration ៤ · register/reset-password ACTIVE · Postgres 17.11 · តារាង public គ្មាន RLS = ០ ·
definer ក្នុង public ដែល anon/authenticated ហៅបាន = ០ · zoe_ops អានដោយ role ទាំង២ = false។ Advisor សល់ WARN Leaked Password Protection + INFO zoe_ops ដូចជុំមុន។

**បន្តតាមលំដាប់** ៖
1. PR #282 (draft · រួម PR #281) ៖ ពិនិត្យ CI; ក្រោយម្ចាស់គម្រោងស្នើ merge ➜ Edge Functions រួច Netlify/APK · សាក reset លើឧបករណ៍ពិត។
   ✅ migration `20261002154730_zoe_reset_claim.sql` អនុវត្តលើ live ដោយម្ចាស់គម្រោង (SQL Editor) ➜ version មិនបានកត់ ➜ Claude កត់វា (សមមូល
   `migration repair --status applied` តាមសំណើម្ចាស់គម្រោង · `statements` ទទេដូច repair មុនៗ) ➜ live មាន migration **៥** ស្មើ repo។
   ✅ Edge Functions `register` + `reset-password` deploy លើ live តាមសំណើម្ចាស់គម្រោង (មុន merge) ➜ **v9** = កូដ branch នេះ (`73db73a`) ·
   ប្រភព ១២ ឯកសារលើ live ស្មើ repo (`diff` + sha256) · v8 = កូដ `main` ➜ ត្រឡប់វិញ = deploy ពី `origin/main`។ App ផលិតកម្ម (2.48.1) មិនស្គាល់
   `password-reset-unknown` (ករណីកម្រ ៖ Auth មិនឆ្លើយ) ➜ បង្ហាញកូដឆៅ រហូតដល់ Netlify deploy 2.49.0។ នៅសល់ក្រោយ merge ៖ Netlify ZoeW + ZoeKeyGen + APK។
2. ✅ register createUser ឆ្លើយបាត់ ➜ retry ដោយឈ្មោះ + ពាក្យសម្ងាត់ដដែលបន្តគណនីដដែល · ✅ កូដប្រើ ១ ដង + App ផុតពិដាន ➜ retry ➜ `200 registered` ·
   ✅ retry ដំណាលគ្នាលែងលុបគណនី (2.49.0 · ផ្នែក ២)។ ⛔ Edge Functions live (v9) **មិនទាន់**មានកូដនេះ ➜ migration ២ ថ្មីមុន ➜ deploy ម្តងទៀត ([2.49.0] សកម្មភាពដោយដៃ)។
3. ✅ Supabase audit ជុំ 2026-10-03 (ផ្នែក ២) ៖ SQL/rules · adapter · Edge · ZoeKeyGen/Netlify · deploy/ops ពិនិត្យរួច។ **សំណើដែលនៅចាំការសម្រេច** ៖
   (ក) **backup ទិន្នន័យហាង Supabase** ⏳ WIP branch `wt/supabase-data-tools-wip` (`b005a0b` · RPC export · `firebase-backup` គោលដៅ Supabase · CLI ផ្ទេរ ·
   checker ថ្មី · agent ឈប់ដោយ session limit ➜ **មិនទាន់ផ្ទៀង**) · (ខ) ✅ ពិដានស្ងៀម ១៥ នាទី Admin Supabase ក្នុង ZoeKeyGen · (គ) ✅ index FK ៣ (`created_by` ២ + `invite_code_hash`) ៖ migration `20261003170000_zoe_fk_indexes.sql`។ ✅ ការរកឃើញ audit SQL គណនីទាំង ៣ កែរួច (ផ្នែក ២)។
   ⏸️ **Supabase deep audit ជុំ ២ ផ្អាក** (សំណើម្ចាស់គម្រោង ៖ បន្តកូដសិន) ៖ ចប់តែផ្នែក SQL គណនី (រកឃើញ ៣ ក្នុងផ្នែក ២) · ផ្នែក ៨ ទៀតនៅសល់។
4. IndexedDB cache zoe_docs (delta seq) ⌛ មិនទាន់ចាប់ផ្តើម (រចនា «egress-only» ៖ delta ពី cursor · ផ្តល់ callback តែក្រោយ server ឆ្លើយ · scope = URL + tenant + user ·
   សម្អាតពេលចាកចេញ) · CLI ផ្ទេរ Firebase ➜ Supabase ⏳ ក្នុង WIP (ក) ខាងលើ · ⏳ ឡើងកំណែ dependency ទាំងអស់ (សំណើម្ចាស់គម្រោង ៖ npm patch/minor · Actions v7/v6 ·
   Node 24 · TypeScript នៅ 6.0.3 ព្រោះ typescript-eslint < 6.1 · Postgres តេស្តនៅ 17 = live)។ ការកែ adapter/Postgres ត្រូវវាស់ emu/supabase-adapter-parity និង supabase-*។
5. សាកលើឧបករណ៍ iPhone/Android ពិតសម្រាប់ backend ទាំង២។ **រក្សា Firebase និង Supabase ជាជម្រើសរបស់អតិថិជន**; CLI ផ្ទេរប្រើតែសម្រាប់អតិថិជនដែលជ្រើសប្តូរ។

⛔ **សន្សំកូតា**៖ រត់តែ checker ពាក់ព័ន្ធ (RUNALL_ONLY) ហើយទុក CI វាស់ពេញ; ឆ្លើយជាខ្មែរ។

> ⛔ **ទុកតែអ្វីដែល *អ្នកប្រើមិនទាន់បញ្ជាក់* ឬ *ការសម្រេចដែលនៅរស់*។** អ្នកប្រើបញ្ជាក់ថាដំណើរការលើឧបករណ៍ពិត ➜
> លុបធាតុចេញពីទីនេះ (កំណត់ត្រាអចិន្ត្រៃយ៍រស់ក្នុង `docs/HISTORY*.md`)។

- ⏳ **Supabase (ZoeW 2.46.0 · ZoeKeyGen 2.23.0) — merge រួច (PR #276) · ✅ ម្ចាស់គម្រោង ៖ «Supabase ដំណើរការហើយ»** ៖ សកម្មភាពដោយដៃ
  (Project · migration ៣ · Admin · Edge Function + secrets · Netlify env · ហាងដំបូង) នៅ `docs/HISTORY.md` ផ្នែក ១ [2.46.0] ·
  ការដំឡើង ៖ [`supabase/README.md`](../supabase/README.md)។ ⏳ សាកលើ iPhone + Android ពិត ៖ ចុះឈ្មោះ · ចូល · ស្កេន · ក្រៅបណ្តាញ ➜ ភ្ជាប់វិញ ·
  ឧបករណ៍ ២ ក្នុងហាងដដែល · ភ្លេចពាក្យសម្ងាត់ · ហាងបិទ ➜ ចាកចេញ។ **ចំណុចបើក** (សម្រេចជាមួយម្ចាស់គម្រោង) ៖ (១) **Push** ៖ ចងនឹងគណនីហាងរួច
  (ZoeW 2.47.1) ➜ ⏳ សាកលើឧបករណ៍ពិត ·
  (២) **Egress Free 5 GB/ខែ** ៖ adapter ទាញពី `cursor=0` រាល់ការផ្ទុកទំព័រ ➜ គួរ cache `zoe_docs` ក្នុង IndexedDB (delta តាម `seq`) ·
  (៣) **ផ្ទេរទិន្នន័យអតិថិជនចាស់** Firebase ➜ Supabase ៖ CLI តាម `public.zoe_admin_write(p_tenant, p_op_id, p_ops, p_replace)` (មិនទាន់សាង) ·
  (៤) ✅ ម្ចាស់គម្រោងសម្រេច (2026-10-03) ៖ ដក chunk `supabase-backend` (~២៤១ KB) ចេញពីហាង Firebase ➜ ធ្វើរួចក្នុង 2.49.0 (ក្រុម install ដាច់ ·
  ហាង Supabase នៅបើកក្រៅបណ្តាញបាន · ឧបករណ៍ទាំងអស់ទាញវា **១ ដងចុងក្រោយ** ពេលផ្លាស់ពី SW ចាស់)។
  ការទាញ SDK Firebase ពេល Config ជា Supabase ៖ merge រួច (PR #279) ➜ ⏳ សាកលើឧបករណ៍ពិត។
- ⏳ **ZoeW 2.47.0 · ZoeKeyGen 2.24.0 — merge រួច (PR #277)** — សាកលើឧបករណ៍ពិត ៖
  ⚙️ ភ្ជាប់ប្រព័ន្ធ (QR រូបភាព · បិទភ្ជាប់ Link · ជ្រើស Supabase) · toast «Supabase» · toast បណ្តាញរស់ (បិទ WiFi ➜ បើកវិញ ➜ ✅) · icon ថ្មី (ដំឡើងម្តងទៀត) ·
  ZoeKeyGen ៖ Tab ទូរស័ព្ទ · Signing Key ផុត ១៥ នាទី (លម្អិត ៖ `docs/HISTORY.md` [2.47.0])។
- ⏳ **ZoeW 2.47.1 · ZoeKeyGen 2.24.1 — merge រួច (PR #278)** — សាកលើឧបករណ៍ពិត ៖ ហាង Supabase ➜ 🔔 បើកការជូនដំណឹង
  (គ្មាន Activation Key · ទូរស័ព្ទ ២ ក្នុងហាងដដែលទទួលការរំលឹកម៉ោង ៨) · រក្សាទុក Config Supabase ➜ គ្មានប្រអប់ចូលប្រព័ន្ធលេចមួយភ្លែត ·
  ZoeKeyGen ៖ ក្រយៅដៃ/មុខលើ Android (Chrome · Google Password Manager) · QR ចំកណ្តាល + 💾 រក្សាទុក QR (លម្អិត ៖ `docs/HISTORY.md` [2.47.1])។
- ⏳ **ZoeW 2.48.1 — PR #280 merge រួច** — ហាង Supabase ៖ ទុក App បើកលើ WiFi ដែលដក cable អ៊ីនធឺណិតពី router
  លើសពី ១ ម៉ោង (token ផុត) ➜ ដោតវិញ ➜ ទិន្នន័យពីឧបករណ៍ផ្សេងមកដល់ខ្លួនឯង (មិនបិទបើក App) · ចូលប្រព័ន្ធពេលបណ្តាញព្យួរ ➜ សារ «ភ្ជាប់ Server មិនបានទេ»
  ក្នុងប្រហែល ១៥–៣០ វិ.។ 🔔 បង្ហាញតែសារកំណែ 2.48.1 មួយ។
- ⏳ **ZoeW 2.48.0 · ZoeKeyGen 2.24.2 — merge រួច (PR #279)** — Supabase ៖ ✅ migration `20261002000100` (SECURITY DEFINER ➜ schema `private`)
  អនុវត្តរួច · `register`/`reset-password` deploy រួច · Security Advisor សល់តែ «Leaked Password Protection» (Pro)។
  សាកលើឧបករណ៍ពិត ៖ Reconfig Setup Link ដដែល ➜ ប្រអប់ចូល · ប្តូរ Config Firebase ⇄ Supabase · 🩺 License/ZTO · ZoeKeyGen ការកែ Key ពេលអ៊ីនធឺណិតយឺត
  (លម្អិត ៖ `docs/HISTORY.md` [2.48.0])។
- ⏳ **ZoeW 2.49.0 · ZoeKeyGen 2.24.3 — branch `claude/gracious-feynman-t7vu3k` (រួម PR #281) មិនទាន់ merge** — សាកលើឧបករណ៍ពិត ៖
  ចងចាំពាក្យសម្ងាត់ (ធីក/ដកធីក · ផុត ៤ ម៉ោង · ចាកចេញ) · ខ្សែរមូរលើ iPhone PWA + APK (⛔ PTR/ចលនាផ្ទាំងនៅដដែល) · modal ZoeKeyGen លើ tablet/desktop ·
  ចុះឈ្មោះ Supabase ដែលដាច់កណ្តាលទី · 🔔 «📤 កញ្ចប់ដែលដករួច» ក្រោយការសម្អាតផុតកំណត់ (លម្អិត ៖ [2.49.0])។
- ✅ **សេចក្តីសម្រេច៖ ZoeW គាំទ្រ backend ទាំង២តាមជម្រើសអតិថិជន — Firebase និង Supabase**។ ការសាង Supabase មិនមែនជាការបិទ Firebase ទេ។
  ត្រូវរក្សាផ្លូវ Config/Login, SDK, rules, provisioning, backup និងឯកសារដែលអតិថិជន Firebase ត្រូវការ។ CLI ផ្ទេរទិន្នន័យជាជម្រើសសម្រាប់អ្នកចង់ប្តូរ backend។
  ការសម្អាតអាចលុបតែកូដដែលបញ្ជាក់ថាមិនប្រើដោយ backend ទាំង២ និងមុខងាររួម។

- ⏳ **`tools/firebase-provision/` ៖ ការរត់លើកដំបូងលើគណនី Google ពិត** — checker រត់ `firebase-tools` ពិតទល់ Google **ក្លែង** តែប៉ុណ្ណោះ
  (session នេះហៅ Google ពិតមិនបាន) ➜ ម្ចាស់គម្រោង ៖ `setup.cmd` ➜ `new-customer.cmd --branch <សាខាសាកល្បង> --user test` ➜ ត្រូវ exit 0 (គ្មាន `FAIL` · `WARN`)
  ➜ Login ក្នុង ZoeW ដោយគណនីនោះ។ បន្ទាប់មក `new --project-id <id> --branch <សាខា> --adopt` សម្រាប់អតិថិជនចាស់ម្នាក់ៗ ➜ `deploy-rules.cmd` គ្របពួកគេ។
  ⛔ Function ZTO អាន `FIREBASE_PROJECT_IDS` បានត្រឹម `PROJECT_ID_MAX` (លើស ➜ មុខងារបញ្ជីបិទសម្រាប់ទាំងអស់គ្នា)។
- ⏳ **Publish rules ទាំង ២ (ZoeW 2.45.4 ៖ node ដែលរំពឹង object)** — `firebase-database.rules.json` ➜ Business Project · `ZoeKeyGen/firebase-database.rules.json`
  ➜ License Project (Firebase Console ➜ Realtime Database ➜ Rules ➜ paste ➜ Publish)។ លំដាប់ Deploy/Publish មិនសំខាន់ ៖ App ចាស់/ថ្មីមិនសរសេរ primitive ទេ
  (ការសរសេរពិតរបស់ App ៩៥៥ replay លើ rules ចាស់ និងថ្មី ➜ បដិសេធ **០ / ០** · `emu/app-writes-rules` ចាក់សោវារាល់ការរត់)។ ក្រោយ Publish ៖ សាក «កំណត់ទូ Locker» · បិទ/បើក · ដក · ស្តារ · ZoeKeyGen បង្កើត/Extend Key ម្តង។
- ⏳ **2.45.7 (ZoeW) ៖ Deploy + build APK ថ្មី ហើយសាកការតភ្ជាប់ «ងាប់ស្ងាត់» លើឧបករណ៍ពិត** — ដក cable អ៊ីនធឺណិតពី router (WiFi នៅ) ➜ ក្នុង ~១ នាទី
  ចំណុចស្ថានភាពឈប់បៃតង (ឬ ~២៥ វិ. ក្រោយស្កេនដែលព្យួរ) ➜ ដោតវិញ ➜ បៃតងវិញខ្លួនឯង + ទិន្នន័យពីឧបករណ៍ផ្សេងមកដល់ · 🩺 ជួរ Firebase ❌ ពេល Server មិនឆ្លើយ។
  ⛔ ZoeKeyGen **មិនទាន់មាន** ការវាស់ភាពរស់នេះ (ឧបករណ៍ admin ៖ ប្រតិបត្តិការមានពិដាន ១៥ វិ. រួច តែចំណុចស្ថានភាពអាចបៃតងក្លែងក្លាយដូចគ្នា)។
- ⏳ **2.45.5 (ZoeW) · 2.22.1 (ZoeKeyGen) ៖ Deploy ទាំង ២ site + build APK ថ្មី** — CSP ថ្មី (`connect-src` + `https://www.gstatic.com`) មកជាមួយ
  `netlify.toml` ក្នុង deploy ដដែល · សិទ្ធិ `ACCESS_NETWORK_STATE` ចូលតែតាម **APK ថ្មី**។ សាកលើឧបករណ៍ពិត ៖ APK បើក Airplane mode ➜ ចំណុចស្ថានភាព
  ប្តូរជា «ក្រៅបណ្ដាញ» ក្នុងប៉ុន្មានវិនាទី (មុននេះ «កំពុងភ្ជាប់…» ~៣៥ វិ.) · បិទ Airplane ➜ «ភ្ជាប់ Server រួចរាល់» វិញភ្លាម · 🩺 ជួរ «អ៊ីនធឺណិត»
  និយាយត្រូវ · បិទ Push លើ APK ខណៈអ៊ីនធឺណិតអន់ ➜ ដំណឹងពីអ្នកលក់លើកក្រោយ **មិនលោត**។ ⛔ ការវាស់ WebView ពិតធ្វើមិនបាននៅទីនេះ (គ្មាន Android SDK)។
- ⏳ **2.45.4 ៖ ប៊ូតុង «ខលម្តងទៀត» ភ្លឹប ៥.៥ ជុំ រួចនៅក្រហមជាប់** (ជំនួសការភ្លឹបជារៀងរហូត ➜ អេក្រង់ចុះ Hz បាន · សន្សំថ្ម) — ម្ចាស់គម្រោងត្រូវមើលលើទូរស័ព្ទពិតថាសញ្ញានៅច្បាស់គ្រប់គ្រាន់។
  ⛔ បើចង់បានការភ្លឹបជាប់វិញ ➜ ជាការសម្រេចរបស់ម្ចាស់គម្រោង (ថ្លៃ ៖ main thread គូរ ~៦០ ស៊ុម/វិ. ពេលមានជួរដេកនោះ) · `perf-check` ចាក់សោវាឥឡូវ។
- ⏳ **Backup ស្វ័យប្រវត្តិ — អ្នកប្រើពន្យារដោយចេតនា** (⛔ កុំដាស់តឿនរាល់ជុំ) ៖ `backup.yml` មិន backup អ្វីទេ រហូតដល់
  secret `ZOE_BACKUP_TARGETS` · `ZOE_BACKUP_PASSPHRASE` ត្រូវកំណត់ ([`firebase-backup/README.md`](../firebase-backup/README.md)
  ជំហានទី ៦) ➜ Run workflow ម្តង ➜ **ទាញ artifact មកសាកស្តារ** (backup ដែលមិនទាន់សាកស្តារ មិនទាន់ជា backup) ·
  backup ឈប់ស្ងាត់ ➜ ពិនិត្យ **Actions** មុន (GitHub ផ្អាក schedule ក្រោយ repo ស្ងាត់ ៦០ ថ្ងៃ)។
  ⛔ វាស់បាន (2026-09-29) ៖ run តាមកាលវិភាគ #21–#25 ធ្លាក់ក្នុង ~២ វិ. **គ្មាន runner** (កូតា Actions) ➜ **គ្មាន backup ណាមួយត្រូវបានបង្កើតទេ**។
- ✅ **Sentry event ពី barcode តេស្ត (`ZTO_UPSTREAM_REJECTED`) — អ្នកប្រើសម្រេចថាមិនកែ** (កញ្ចប់តេស្តដែលគ្មានក្នុង ZTO)។
  ⛔ កុំធ្វើឲ្យវាស្ងាត់ទាំងអស់ (បាំងការដាច់ ZTO ពិត) — មើលជួរ `ZTO_UPSTREAM_REJECTED` ក្នុងតារាងស្នូល · `lookupReason: ""`
  ក្នុង breadcrumb **មិនមែនកំហុស** (client អាន `reason` តែលើផ្លូវ `ZTO_CONFIG_INVALID`)។
- ✅ **`ZTO_UPSTREAM_TIMEOUT_MS = 7000` ក្នុង Netlify env ជាការកំណត់ដោយចេតនា** (កូដលំនាំដើម `6000` · ZTO ឆ្លើយ ២,១–៥,៣ វិ.
  លើផលិតកម្ម · បង្អួចអាន Cookie លើ container ត្រជាក់) ➜ តម្លៃមិនមែន `6000` ក្នុង `?diag=1` មិនមែនកំហុស។ ⛔ កុំបង្កើន
  `ZTO_REQUEST_BUDGET_MS` ដល់ `10000` ដោយមិនវាស់ផ្លូវ client ឡើងវិញ (ថវិកា App មិនមែនពិដាន platform)។
- ✅ **Firebase rules របស់ Business និង License Project ត្រូវ Publish រួច** (`pickedUpBarcodes` · កូដ App `ZOE` ·
  `maxDevices` · slot កៅអី · Key ថ្មីចេញរួច · វាល `op` ក្នុង ledger ថ្ងៃ/ខែ · `license_announcements`)។ ✅ Push (VAPID · FCM · `google-services.json`)
  កំណត់រួច។ ⛔ ការសរសេរស្ថិតិយកត្រូវបដិសេធ ➜ ពិនិត្យ rules មុនកូដ (`$other` បដិសេធវាល
  ដែលមិនស្គាល់) · Activate ធ្លាក់ `seat-unavailable`/«Key នេះមិនមែនសម្រាប់ ZoeW» ➜ ពិនិត្យថាជា Key ចាស់ (`a: 'ADM'`) មុន។

## 📗 ផ្នែក ១ — កំណត់ត្រាតាមកំណែ (សម័យ React · អ្នកប្រើឃើញអ្វីខុសពីមុន)

### [2.49.0] — 2026-10-03 · ZoeW · ZoeKeyGen `2.24.3` ៖ **ចងចាំពាក្យសម្ងាត់ (checkbox) · ខ្សែរមូរលើ APK/iPhone · ហាង Supabase ៖ ការចុះឈ្មោះដែលដាច់កណ្តាលទីបន្តបាន · ZoeKeyGen ៖ modal តាមទំហំអេក្រង់ · គ្មាន emoji មុខឈ្មោះគណនី · 🔔 កញ្ចប់ដែលដករួច**

**ZoeW `2.49.0`** (`zoew-v255` ➜ `zoew-v256`) — ឈរលើ [2.48.2] (PR #281 មិនទាន់ merge ➜ branch នេះរួម 2.48.2 ទាំងមូល) ·
**ZoeKeyGen `2.24.3`** (`zoekeygen-v113` ➜ `zoekeygen-v114`)។ ⛔ Firebase rules · Supabase migration **មិនប្រែ** (Edge Function `register` ប្រែ)។
សំណើម្ចាស់គម្រោង ៖ «Checkbox ចងចាំ Password login … ដកធីកបានដោយខ្លួនឯង» · «ដាក់ scrollbar សម្រាប់ APK និង PWA iOS … ដាក់តូចកុំបាំងអីផ្សេង» ·
«ពិនិត្យ modal ទាំងអស់អោយឆ្លាស់ទំហំតាមប្រភេទអេក្រង់ (ZoeKeyGen និង ZoeW)» · «ដក emoji ពីមុខ username ក្នុង ZoeKeyGen» · «ក្នុងជូនដំណឹងបន្ថែមប្រាប់ពីកញ្ចប់ដែលដករួចផង» · Handoff ជំហាន ២ (register)។

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

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ✅ ធ្វើរួច ៖ migration `20261002154730_zoe_reset_claim.sql` លើ live (កត់ version) ➜ Edge Function **`register`** និង `reset-password` **v9**។
- ⛔ **migration ថ្មី ៣** ៖ `20261003091742_zoe_register_spent_invite.sql` (`tenant_members.invite_code_hash` · `spent_invite_member` · `finish_registration` ចាក់សោកូដ)
  · `20261003160000_zoe_admin_races.sql` (`admin_extend_tenant` · `admin_issue_reset_code` ចាក់សោជួរសមាជិក) · `20261003170000_zoe_fk_indexes.sql` ➜ merge ចូល `main` (GitHub integration)
  ឬ paste ក្នុង SQL Editor + `migration repair --status applied <version>`។ ⛔ ធ្វើ **មុន** ៖ (ក) deploy Edge Function `register` + `reset-password` ម្តងទៀត
  (កូដ register ថ្មីគ្មាន RPC ➜ កូដប្រើមិនបានទាំងអស់ឆ្លើយ 502 ជំនួស 403 · Function v9 + DB ថ្មីដើរធម្មតា) · (ខ) Netlify ZoeKeyGen (គ្មាន `admin_extend_tenant` ➜ «ពន្យារ» បរាជ័យ)។
- បន្ទាប់មក ៖ Netlify ZoeW + ZoeKeyGen + APK ថ្មី។ គ្មាន Firebase rules · គ្មាន env ថ្មី។
- iPhone PWA + APK ៖ រមូរតារាងប្រវត្តិ · បញ្ជីក្នុង modal ➜ ខ្សែស្តើងលេច/បាត់ · ⛔ ពិនិត្យថា PTR · ចលនាផ្ទាំង · ភាពរលូនពេលរមូរ នៅដដែល (តំបន់ហាម ៖ វាស់លើឧបករណ៍ពិត ២ ប្រភេទមុន merge)។
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

### 2026-10-03 — CI ៖ `exit-code-integrity` លើសពិដាន 300s លើ runner CPU ២ (audit-tools តែប៉ុណ្ណោះ)

PR #282 ផ្នែក 1/4 ៖ `exit-code-integrity (meta)` «ព្យួរ — លើសពិដាន 300s»។ បង្កើតឡើងវិញ ៖ `EXITCODE_CONCURRENCY=2` (ដូច CI) ➜ ពុល ១១៥ checker ក្នុង **២៥៧ វិ.**
លើម៉ាស៊ីន ៤ CPU (CI យឺតជាង ➜ លើស) · CPU ពិតតែ ៧៩ វិ. ➜ កូនរង់ចាំ timer · lane ២ = ១ សម្រាប់ `emu/*` + ស្របគ្នាតែ ១។ `taskset -c 0,1` + lane ៤ ➜ **៩១ វិ.**
ហើយពេលកូនយឺតជាងគេដដែល (write-stall-guard ៣៨.៧ វិ. · cleanup-interrupt ២៣.៩ វិ.) ➜ អប្បបរមា lane ៤ ⛔ មិនបង្កើន `CHECKER_TIMEOUT`។

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
| `app-lock-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
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
| `emu/app-writes-rules-test` | ផ្នែក ១ | — |
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
| `revenue-fuzz-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
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
| `zto-list-sync-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `zto-negative-cache-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-network-boundaries-test` | — | ផ្នែក ២ |
| `zto-proxy-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `zto-signed-status-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `zto-sync-banner-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
