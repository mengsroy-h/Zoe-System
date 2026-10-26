# ប្រវត្តិ Zoe-System — ការងារបច្ចុប្បន្ន និងកំណែ ZoeW React ថ្មីៗ

> ⛔ **ឯកសារនេះជា *ប្រវត្តិ* មិនមែន *ច្បាប់* ទេ** — ច្បាប់ដែលត្រូវអនុវត្តរស់នៅ [`CLAUDE.md`](../CLAUDE.md) ហើយច្បាប់
> នីមួយៗចងទៅ **ឧបករណ៍ដែលចាក់សោវា**។ ត្រង់នេះទុក *ហេតុអ្វី* ច្បាប់មួយមាន · របៀបដែលកំហុសត្រូវរកឃើញ · **លេខដែលវាស់បាន**។
>
> ⛔ **ប្រវត្តិរស់នៅ ២ ឯកសារក្នុងថត `docs/` នៅ root តែប៉ុណ្ណោះ** (`CLAUDE.md` ច្បាប់ ៩) ៖
>
> | ឯកសារ | គ្របអ្វី |
> |---|---|
> | **`docs/HISTORY.md`** (ឯកសារនេះ) | ការងារមិនទាន់បញ្ចប់ · កំណែ ZoeW `2.50.100` ➜ ឥឡូវ · ប្រវត្តិការរកឃើញសម័យ React · **ធាតុថ្មីទាំងអស់សរសេរនៅទីនេះ** |
> | **[`docs/HISTORY-ARCHIVE.md`](HISTORY-ARCHIVE.md)** | សម័យ **ZoeW vanilla** ៖ ZoeW ≤ `2.37.3` · ZoeKeyGen ≤ `2.20.2` (ដល់ 2026-09-18) · កំណែមុន `2.20.0` · អត្ថបទដែលដកចេញពី `CLAUDE.md` · **ផ្នែក ៦ ៖ សម័យផ្ទេរទៅ React** (ZoeW `2.38.0` ➜ `2.42.11` · parity ឆៅ) · **ផ្នែក ៧ ៖ សម័យ React ដំបូង** (ZoeW `2.43.0` ➜ `2.49.6`) · **អានបានតែមិនបន្ថែមធាតុថ្មី** |
> | **archive ផ្នែក ៨** | កំណត់ត្រាកំណែ ZoeW `2.50.0` ➜ `2.50.99` ផ្លាស់ទាំងស្រុងពីផ្នែក ១; ការងារមិនទាន់ផ្ទៀងនៅក្នុង 📌 ដដែល |
>
> ⛔ **កុំអានពីដើមដល់ចប់** — វាជាឯកសារយោង។ ផ្លូវធម្មតា ៖ checker ធ្លាក់ ➜ `grep -n "<ឈ្មោះ checker>" docs/HISTORY*.md`
> (គ្របទាំង ២ ឯកសារ) ឬមើល **[🔎 លិបិក្រម](#-លិបិក្រម--ឈ្មោះ-checker--ការពន្យល់រស់នៅឯណា)** នៅចុងឯកសារនេះ។
>
> | ត្រូវការអ្វី | មើលកន្លែងណា |
> |---|---|
> | «សកម្មភាពដែលត្រូវធ្វើដោយដៃ» · អ្នកប្រើឃើញអ្វីខុសពីមុន | **ផ្នែក ១** (ឯកសារនេះ) · កំណែ ≤ 2.37.3 ➜ archive ផ្នែក ១ · `2.38.0` ➜ `2.42.11` ➜ archive ផ្នែក ៦ · `2.43.0` ➜ `2.49.6` ➜ archive ផ្នែក ៧ · `2.50.0` ➜ `2.50.99` ➜ archive ផ្នែក ៨ |
> | ហេតុអ្វី checker មួយមាន · លេខ mutation · ការវាស់ដែល **បដិសេធ** សម្មតិកម្ម | **ផ្នែក ២** (ឯកសារនេះ) · archive ផ្នែក ២ · ៧ |
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

> ⛔ **ផ្នែកនេះកាន់តែការងារដែលនៅបើក** ៖ ស្ថានភាព git · អ្វីដែលអ្នកប្រើមិនទាន់បញ្ជាក់ · សកម្មភាពដោយដៃដែលមិនទាន់ធ្វើ · ការសម្រេចដែលនៅរស់។
> អ្នកប្រើបញ្ជាក់ ឬធ្វើរួច ➜ **លុបធាតុនោះ** (កំណត់ត្រាអចិន្ត្រៃយ៍រស់ក្នុងផ្នែក ១ · ២) ⛔ កុំបន្ថែមខ្សែ branch/PR ចាស់ (git ជាភស្តុតាង) ·
> ⛔ ≤ ៨០ បន្ទាត់ (`doc-scope-test`)។

### 🤝 Handoff

- ⛔ **ផ្ទៀងផ្ទាត់ git មុនជឿអត្ថបទនេះ** (`git log --oneline -3 origin/main` · `git rev-list --count origin/main..origin/<branch>`) · ⛔ កុំ merge ដោយគ្មានសំណើម្ចាស់គម្រោង ·
  ឆ្លើយជាខ្មែរ · ផ្ទៀងវិសាលភាពការអនុញ្ញាតមុន publication; PR មិនមានន័យថាអនុញ្ញាត merge ឬ deploy ដោយដៃទេ។
- ⛔ លទ្ធផល local ត្រូវភ្ជាប់ source/tree និងវិសាលភាព checks; មិនជំនួស CI ៤ ផ្នែក ឬការផ្ទៀង live runtime/ឧបករណ៍ពិត។ ការអនុញ្ញាត និងព្រំដែនជុំបច្ចុប្បន្នយកពីសន្ទនា; ឯកសារចាស់មិនផ្ដល់សិទ្ធិថ្មី ឬដាក់កម្រិតជំនួសសំណើបច្ចុប្បន្នទេ។

### 🔬 Audit បច្ចុប្បន្ន និងការបន្ត session

- ⏳ **[2.50.158 · A311]** ផ្ទៀងស្ថានភាពលើកមុន និងពេលពិនិត្យថ្មីមិនបានលើឧបករណ៍ដើម។ មូលហេតុ fresh lookup មិនច្បាស់នៅឡើយ; រង់ចាំរូប «ព័ត៌មានលម្អិត»។ មិនសន្មត signed/unsigned បច្ចុប្បន្នពីភស្តុតាងចាស់។ ផ្ទៀងផ្នែករង់ចាំ/រក្សាទុក, fresh Sign auto-hide, original export, manual clear/reload និងពិដាន ៤០; legacy មិន replay និងរូបដាច់តាមឧបករណ៍។
- ⏳ **[2.50.162 · A318–A327]** latest main ដែលបានផ្ទៀង៖ `4cd59cfa`។ Local regression វាស់ cleanup/restore · health · session · notification; ត្រូវផ្ទៀង CI លើ commit ចុងក្រោយ និង flow A–B–C លើឧបករណ៍ពិត។ ពុំទាន់មាន production throughput/latency benchmark សម្រាប់ចំនួនហាងធំ។
- ⏳ **[2.50.152 · A301–A302]** ផ្ទៀង update clients ទាំងអស់ និងស្តារប្រាក់/ជួរលាយ · គណនី · APK លើឧបករណ៍ពិត។ Supabase migrations ផ្ទៀងរួច (A304) និងម្ចាស់គម្រោងបញ្ជាក់ Firebase Publish រួចសម្រាប់គម្រោងគោលដៅ; គ្រប់គម្រោងអតិថិជនខាងក្រៅ/clients ទាំងអស់នៅត្រូវផ្ទៀងដោយឡែក។
- ⏳ **[2.50.153 · A305]** សាក selected-ready Sign · request-specific photo proof · rejected row ត្រូវ verification · ផ្ទាំងទាញបញ្ជីគ្មានរូបភ្នែក។ durable-only និង signed+exact-original+guarded-close/CAS រួមរួច; ផ្ទៀង client/server ត្រូវគ្នា និង update ឧបករណ៍សាខាទាំងអស់ដោយមិន uninstall/Clear Data/ប្តូរ PIN។
- ⏳ **[2.50.150–2.50.151 · ZoeKeyGen 2.24.25]** ផ្ទៀងលើឧបករណ៍ពិត៖ ZTO Login · ទាញបញ្ជី ZTO (កាត់ការរង់ចាំ 11.0–15.0s និង 6.0–8.0s) · Sign ពិនិត្យស្ថានភាព (កាត់ CORS preflight និង stale socket) និង Sign កញ្ចប់ 3–4 ក្នុងម្ចាស់តែមួយ។ ការវាស់ល្បឿនក្នុង session ជា synthetic; គ្មាន live ZTO timing។ ផ្ទៀង CI លើ commit ចុងក្រោយតាម GitHub។
- ⏳ ផ្ទៀងលើឧបករណ៍ពិត ៖ 🛠️ ដោះការស្តារដែលជាប់ (PIN) លើហាងដែលមានធាតុបែបនេះ · iPhone PWA ៖ បង្វិលបញ្ឈរ ↔ ផ្តេកច្រើនដងលើទំព័រទិន្នន័យ និងស្កេន (កាតបញ្ជីបញ្ចប់ពីលើ tab bar · ជួរឃើញ · PTR/អូស/លាក់របារដដែល) ទាំង iPhone មាន notch និង SE/8។
- ⏳ Restore ចាស់ ៖ ផ្លូវ Admin និង rollback មានកំណត់ត្រាការកែក្នុង A262–A263 រួច; អ្វីនៅសល់គឺផ្ទៀងលើហាងពិត និងជួរកំព្រាដែល claim លែងចង្អុលទៅ (A262) · កុំសន្និដ្ឋានពី handoff ចាស់ថា rollback មិនទាន់មាន។
- នៅបើក ៖ (c) «ghost» ពី App ចាស់ — ជួរ history គ្មាន markers ដែលកាន់កូដដែលនៅក្នុងធុងសំរាម (lease ផុតហើយ markers ត្រូវដក) អាចដកប្រាក់ស្ទួន (៨ ថ្ងៃ · ដក) ➜ ត្រូវវាស់លើ dump ពិត។

### ⏳ អ្នកប្រើមិនទាន់បញ្ជាក់

- ⏳ **[2.50.142]** ចលនាប្រអប់តាម keyboard (✅ ម្ចាស់គម្រោង ៖ Chrome Android PWA · APK គ្រប់ប្រអប់ · Sign · ZTO ចុច Barcode ទំព័រនៅនឹង លើ APK សាក `24fb3b7` · iPhone PWA ប្រអប់រអិល) ៖ tablet។
- ⏳ **[2.50.137]** (rules Firebase `zto_sweep_lead` Publish រួច) ហាង Firebase ៖ ទូរស័ព្ទ ២–៣ ក្នុងសាខាតែមួយ ➜ Sign ក្នុង ZTO ➜ ZoeW បិទក្នុងប៉ុន្មានវិនាទី · Netlify Usage មិនកើន · ហាងចងច្រើនសាខា ៖ ព្រឹកក្រោយមួយយប់ ការបិទតាម ZTO ដើរដោយមិនចាំទូរស័ព្ទសាខាផ្សេង។
- ⏳ **[2.50.136]** ច្បាប់ស្តារថ្មីជំនួសការរង់ចាំផ្ទៀងស្តារចាស់៖ ZTO Login ហាមស្តារគ្រប់ trash; Cookie signed ហាមស្តារ; unsigned Cookie forwarded នៅអនុញ្ញាត។ លំដាប់ ៖ Publish rules Firebase + រត់ SQL Supabase មុន merge ➜ merge ➜ ឧបករណ៍ ZTO មុនគេ ➜ ស្តារលើឧបករណ៍ថ្មីក្នុងរយៈលាយ (សកម្មភាពដោយដៃ [2.50.136] · ⛔ មិនផ្អាកហាង)។ ផ្ទៀងលើឧបករណ៍ពិត ៖ ឧបករណ៍ Palm ពីរ ➜ មួយប្តូរចេញពី Palm ➜ ឧបករណ៍គ្មាន ZTO នៅអនុវត្ត Palm · App ត្រូវបិទកណ្តាលការបិទ/ដក ➜ ចំណូលតាមថ្ងៃយកត្រឹមត្រូវក្រោយបើកវិញ។
- ⏳ **[2.50.135]** Sign លើឧបករណ៍ពិត៖ លេខទូរស័ព្ទមួយ២–៣កញ្ចប់ · បញ្ហាត្រូវបញ្ជាក់ · បិទ App/បើកវិញ និងបណ្ដាញដាច់/ភ្ជាប់វិញ។ APK ថ្មី៖ beep ជាប់ពេលស្កេន១ និងស្កេនជាប់ៗគ្នា · លើកដំបូង/ក្រោយ resume · volume ទាប/០ និងស្តារត្រឡប់។
- ⏳ **[2.50.132]** APK capture និង Gallery៖ GPS មកយឺត/ប្រហាក់ប្រហែល · font ដូច Palm · Gallery មាន/គ្មាន EXIF; iOS PWA ម្ចាស់គម្រោងបញ្ជាក់កូអរដោនេមានរួច។ **[2.50.128]** កញ្ចប់ខុសទីតាំងពិត ➜ ធុងសំរាម «ខុសទីតាំង» · លុយដក។
- ⏳ **[2.50.127]** (rules `ztoSignedAt` · `ztoReturnedAt` Publish រួច · ✅ ម្ចាស់គម្រោង ៖ iPhone លឿន · QR iPhone ល្អ) ✍️ Sign លើ Android ពិត ៖ QR លើបុង · ល្បឿន · Gallery iPhone · សម្លេង/ញ័រ · 🔒 Sign រួច/ធុងសំរាម 🔒 លើកញ្ចប់ពិត។
- ⏳ **[2.50.96]** សកម្មភាព ១ (កែតម្លៃកញ្ចប់យករួចលើហាង Firebase និង Supabase)។
- ⏳ **[2.50.94]** សកម្មភាព ១ (migration Supabase ចូល live ពេល merge) · ៣ (ប៉ះផ្ទៃងងឹតលើផ្ទាំងដក/បញ្ចូលច្រើន) · ៤ (ហាង Supabase)។
- ⏳ **[2.50.95]** សកម្មភាព ១ (ប៉ះផ្ទៃងងឹតលើផ្ទាំងបញ្ជីកញ្ចប់ពី ZTO)។

### 🔧 សកម្មភាពដោយដៃដែលនៅបើក (ម្ចាស់គម្រោង)

- 💡 Netlify env `ZTO_DETAIL_IDENTITY` (`optional` ➜ `require` · Sign Palm ជា endpoint សរសេរ ➜ `require` ទើបអ្នកមានតែសោភ្ជាប់គ្មានគណនី ZoeW Sign មិនបាន) — env តែប៉ុណ្ណោះ គ្មានកូដ (ការសម្រេចម្ចាស់គម្រោង · [2.50.93] សកម្មភាព ២ · [2.50.47])។
- ⏳ **Backup ស្វ័យប្រវត្តិ** (ពន្យារដោយចេតនា) ៖ secret `ZOE_BACKUP_TARGETS` · `ZOE_BACKUP_PASSPHRASE` ([`firebase-backup/README.md`](../firebase-backup/README.md) ជំហានទី ៦)
  ➜ Run workflow ➜ **ទាញ artifact មកសាកស្តារ**។ ⛔ run «success» ដោយគ្មាន secret ឈប់ត្រឹម «ពិនិត្យ secret» = **គ្មាន backup** · GitHub ផ្អាក schedule ក្រោយ
  repo ស្ងាត់ ៦០ ថ្ងៃ ➜ backup ឈប់ស្ងាត់ ➜ ពិនិត្យ **Actions** មុន។
- ⏳ **repo នៅ Public** (ផ្ទៀង GitHub metadata ឡើងវិញ 2026-10-24 ៖ `visibility: public`) ៖ ផែនការ Private (repo Releases ដាច់ · `ZOE_RELEASES_TOKEN` · ច្បាប់ «Public repo» ក្នុង `CLAUDE.md`)
  ➜ ម្ចាស់គម្រោង ៖ Forks · Secret scanning + Push protection · Make private។ ប្រវត្តិ git ៖ ម្ចាស់គម្រោង «មិនបាច់ធ្វើ» ([2.50.93] សកម្មភាព ៤)។
- ⏳ `tools/supabase-migrate/` — តែពេលអតិថិជន Firebase ចង់ប្តូរ (dry-run មុន)។

### 🧭 ZTO Palm (Login · Lookup ➜ ពេញ)

- 🗳️ PR Login Palm merge ដោយ **merge commit** ➜ commit ដើម `d509638` (សោ protocol ក្នុងកូដ · screenshot សាកល្បង) នៅក្នុង history `main` ➜ ការសម្រេចម្ចាស់គម្រោង
  (ទុក · ឬសរសេរ history ឡើងវិញ — ⛔ មិនធ្វើដោយគ្មានសំណើ) · សោនៅតែ env (ZTO ជាអ្នកកាន់សោ ➜ ប្តូរមិនបាន)។
- ⏳ **[2.50.126]** Netlify Logs `push-cron` ពេលទូរស័ព្ទច្រើន ៖ `"reason":"partial"` រួច `"sent"` ក្នុង run បន្ទាប់ · ZoeKeyGen ផ្ទាំងហាង Supabase បង្ហាញហាង/គណនីគ្រប់។
- 📚 កាតាឡុក ៖ [`ZoeW/docs/ZTO-PALM-API.md`](../ZoeW/docs/ZTO-PALM-API.md) · ផ្លូវ Sign តាមសំណើម្ចាស់គម្រោងនៅ [2.50.120]–[2.50.121]។
- ⏳ **[2.50.118]** 🗑️ ចុចកាត «➖ ដក + ត្រឡប់» ➜ បញ្ជីតែ «ដក» និង «ត្រឡប់» (iPhone · Android · APK) · ↩️ បញ្ជីចុះហត្ថលេខាមិនគ្រប់ ➜ «📌 … មិនទាន់ដក»។
- ⏳ **[2.50.119]** Login ZTO Palm តាមសាខា (A ➜ B ក្នុងសាខាដដែល · «ផ្តាច់ Palm» លើ A ➜ B នៅស្កេន/ទាញបាន ✅ ម្ចាស់គម្រោងបញ្ជាក់លើ Preview) ៖
  សាខាផ្សេងដែលប្រើសោភ្ជាប់ដូចគ្នា Login គណនីខ្លួន ➜ មិនជាន់គ្នា · ប្រើច្រើនថ្ងៃ ៖ ZTO មិនបដិសេធ token តែមួយលើទូរស័ព្ទច្រើនព្រមគ្នា (៤២៩ · Login ឡើងវិញញឹកញាប់)។
- ⏳ **[2.50.117]** (Firebase rules `returned` Publish រួច) 🗑️ «ត្រឡប់» (ថ្ងៃទី ៨ ឬ ZTO ស្កេនត្រឡប់ · ដកលុយ · ចំនួន) · 🔔/📲 «ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ» ➜ ម្ចាស់គម្រោងអានថាត្រូវគោលការណ៍។
- ⏳ **[2.50.115]–[2.50.116]** ↩️ កញ្ចប់ត្រឡប់ ៖ ទាញបញ្ជី 10-14 ➜ 10-17 ➜ កញ្ចប់ត្រឡប់ដែលបាន 🧪 ក្នុង «↩️ ត្រឡប់ទៅវិញ» · បើបើកក្នុង ZoeW ➜ ធុងសំរាម «ត្រឡប់» + លុយដក (Palm · Cookie)។
- ⏳ **[2.50.114]** Palm ៖ បើក App ថ្ងៃក្រោយ ➜ ស្កេន/ទាញបានដោយមិន Login ZTO Palm ម្តងទៀត · ⏱ ពិតក្នុង A189 ·
  ❌ ម្ចាស់គម្រោង ៖ បិទ App មួយយប់ ➜ 🩺 HTTP 502 ទាល់តែ Login វាយពាក្យសម្ងាត់ ➜ A264 (Function · deploy ពេល merge) ➜ ព្រឹកបន្ទាប់ 🩺 ✅ ដោយមិនវាយពាក្យសម្ងាត់ ·
  បើនៅ ❌ ➜ ថតអត្ថបទស្កេន (`palm:…` បន្ទាប់ «ជាប់ត្រង់») ·
  A265 ៖ ស្កេនរបៀប Cookie ច្រើនជាប់គ្នា ➜ 🩺 ជួរ ZTO ៖ ស្កេនលើការភ្ជាប់ «បើករួច» ច្រើនជាង «ថ្មី» (ដូច Palm A179) ·
  តំបន់ Function ប្តូរបានតែក្រោយ Upgrade Netlify (ការកំណត់ Netlify ➜ គ្មានកូដ · ម្ចាស់គម្រោងសម្រេច)។
- ⏳ **[2.50.120]–[2.50.124]** ម្ចាស់គម្រោងបានអនុញ្ញាត Sign៖ ចែកចាយ ➜ ទទួល; កញ្ចប់មានបញ្ហា បង្ហាញសារ/បញ្ជាក់តាម Palm។ ម្ចាស់គម្រោងបញ្ជាក់ Preview ជោគជ័យ; សាកបន្ថែមលេខមួយច្រើនកញ្ចប់ និងឧបករណ៍នៅសកម្មភាពផ្នែក ១។
  [2.50.124] ៖ ផ្ទាំង Sign រចនាឡើងវិញ (A207–A212) ➜ ពិនិត្យលើទូរស័ព្ទពិត ·
  Preview ៖ Login Palm ម្តងទៀត ➜ «សោមិនត្រឹមត្រូវ» ទាល់តែ clear site data (A214 ៖ មិនមែន App Lock · មិនប៉ះទង្គិច App Palm · ម្ចាស់គម្រោង ៖ APK main ទុកយូរ ➜ Palm ប្រើបាន គ្មានបញ្ហាសោខុស ➜ ជាបញ្ហារបស់ Preview) ➜ [2.50.125] ពេលកើតម្តងទៀត
  ថតសារមុន clear (សោភ្ជាប់ ៖ ប្រភព · ចំនួនតួ · ស្នាមម្រាម · ឬ «Server ទទួលសោភ្ជាប់ ZoeW រួច តែ ZTO បដិសេធ» + កូដ ZTO)។

### 🗳️ ការសម្រេច និងការកំណត់ដែលនៅរស់

- ✅ backend ទាំង ២ (Firebase · Supabase) តាមជម្រើសអតិថិជន ➜ ច្បាប់ក្នុង `CLAUDE.md` «What the system is» (⛔ កុំចម្លងមកទីនេះ)។
- ✅ **ZoeW នៅ React + TypeScript + Capacitor** (ម្ចាស់គម្រោង ៖ មិនប្តូរទៅ Flutter — ការសរសេរឡើងវិញបាត់ checker ប្រាក់ និងការផ្ទៀងលើឧបករណ៍ពិតទាំងអស់) ➜ រូបរាងថ្មីធ្វើក្នុង React ដដែល។
- ✅ **`ZTO_UPSTREAM_TIMEOUT_MS = 7000`** ក្នុង Netlify env ដោយចេតនា (កូដលំនាំដើម `6000`) ➜ តម្លៃនេះក្នុង `?diag=1` មិនមែនកំហុស ·
  ⛔ កុំបង្កើន `ZTO_REQUEST_BUDGET_MS` ដល់ `10000` ដោយមិនវាស់ផ្លូវ client ឡើងវិញ។
- ✅ **Sentry `ZTO_UPSTREAM_REJECTED` ពី barcode តេស្ត** ៖ មិនកែ · ⛔ កុំធ្វើឲ្យស្ងាត់ទាំងអស់ (បាំងការដាច់ ZTO ពិត) · `lookupReason: ""` ក្នុង breadcrumb មិនមែនកំហុស។
- ✅ **Firebase rules Business + License Publish រួច** · Push (VAPID · FCM · `google-services.json`) កំណត់រួច ➜ ការសរសេរត្រូវបដិសេធ ➜ ពិនិត្យ rules មុនកូដ ·
  Activate `seat-unavailable`/«Key នេះមិនមែនសម្រាប់ ZoeW» ➜ ពិនិត្យថាជា Key ចាស់ (`a: 'ADM'`) មុន។
- 🗳️ សមត្ថភាពមុនដាក់ប្រើជាផ្លូវការ (Firebase Spark egress · License Project តែមួយ · Netlify Functions/credit · Supabase realtime · ពិដាន Push) ➜ ម្ចាស់គម្រោងសម្រេច
  (ផ្នែក ២ «Deep audit ៣» · «Deep audit ៦» A222 ៖ ឧបករណ៍ ZTO ៣ ក្នុងសាខាអាន ZTO ដដែល ៣ ដង ➜ ជម្រើស leader សាខា = តំបន់ LOCK ត្រូវសំណើ ·
  A265 ជម្រើស ក–ង ➜ ម្ចាស់គម្រោងជ្រើស ឃ (A266 ៖ ផ្លាស់វេនអាន Sign) · ក · ខ · គ · ង នៅបើក · ការពិនិត្យកញ្ចប់បើកម៉ោងម្តងមិនទាន់ចែករំលែក) ·
  A223 ៖ repo Public ➜ `ZOE_RUNNER_MODE=github` ទើប Audit CI រត់ពិត (self-hosted ➜ «skipped» មិនមែនបៃតង) · ព្រំដែនដែលទទួលស្គាល់ និងការរកឃើញដែលបានបដិសេធ ➜ ផ្នែក ២ «Deep audit ៣–៥» (⛔ កុំរាយការណ៍ម្តងទៀត)។

## 📗 ផ្នែក ១ — កំណត់ត្រាតាមកំណែ (សម័យ React · អ្នកប្រើឃើញអ្វីខុសពីមុន)

### [2.50.162] — 2026-10-26 · ZoeW ៖ Deep audit ប្រចាំថ្ងៃ — cleanup · ស្ថានភាពពិត · session · ជូនដំណឹង (A318–A327)

**ZoeW** (`zoew-v425` ➜ `zoew-v426`)។ **ZoeKeyGen មិនប្រែ**។ មូលដ្ឋាន audit គឺ latest `main` ដែលបាន fetch និងផ្ទៀង `4cd59cfa8c601c606c5c2198c1f724ae90617135`។

#### អ្វីដែលខុសពីមុន

- Cookie៖ កញ្ចប់ «យករួច» ចូលធុងសំរាមក្រោយបិទលើ ZoeW ២ ម៉ោង; Sign ពិតហាមស្តារ ហើយ unsigned ត្រូវផ្ទៀង upstream ថ្មីមុនស្តារ។ Palm៖ រង់ចាំ Sign ពិត ២ ម៉ោង និងហាមស្តារ; ជួរចាស់គ្មាន barcode មិនប្ដូរទៅគោលការណ៍ local ដោយស្ងាត់។ លុយ `pickup` មិនដក។
- Health Check បង្ហាញតែអ្វីដែលបានវាស់៖ snapshot ទទេ/ចាស់ និង listener ដែលមិនទាន់ត្រៀមមិនអាចបៃតង។ Storage ត្រូវសាកសរសេរ អាន និងលុបពិត; ស្ថានភាព browser network និង SW controller ជាព័ត៌មានរហូតមានភស្តុតាងគ្រប់។
- ការសរសេរត្រា ZTO និង Push ក្រោយ await ចងទៅ session/ហាងដើម។ ការជូនដំណឹងជិតត្រឡប់រក្សាពេលដំបូងៗក្នុងពិដាន ដោយមិនអាស្រ័យលើលំដាប់ជួរ។
- Delete/Remove/cleanup ចប់យឺតក្រោយប្តូរ session មិនដោះសោ operation ថ្មីដែលប្រើ item ID ដដែល។
- Supabase៖ write ដែល server ទទួលតែ ACK បាត់ មិន replay ដោយគ្មានភស្តុតាងថា operation receipt នៅក្នុងរយៈសុវត្ថិភាព; ការត្រឡប់មកវិញក្រោយ offline ច្រើនថ្ងៃរក្សាស្ថានភាពមិនទាន់បញ្ជាក់ ដើម្បីកុំបូកលុយស្ទួន ឬសរសេរជាន់តម្លៃថ្មី។
- Checker មិនរាយ «ជោគជ័យទាំងអស់» ពេលមាន SKIP/PARTIAL; Resume សាកករណីមិនទាន់វាស់ពេញឡើងវិញ។ ឯកសារបច្ចុប្បន្ន និងបណ្ណសារមានផ្លូវស្វែងរកច្បាស់។
- Smoke/SW checker ផ្ទៀងកំណែ App និង cache ជាមួយ source មុន browser; build ចាស់ ឬលាយកំណែមិនអាចយកជាភស្តុតាងបៃតងបាន។
- IndexedDB ដែលអានសោយឺតក្រោយ lock/logout មិនដាក់សោត្រឡប់ក្នុង memory ឬជាន់សោថ្មី; ផ្ទៀង session និងស្ថានភាពចាក់សោម្តងទៀតពេល read ចប់។

#### អ្នកយាម

ភស្តុតាងមុន/ក្រោយ និងព្រំដែននៃការវាស់រស់ក្នុង A318–A327 ខាងក្រោម។ លទ្ធផល local មិនមែនជាលទ្ធផល CI ឬ load test លើផលិតកម្ម។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- Update App លើឧបករណ៍សាខាទាំងអស់ រួចផ្ទៀង Cookie/Palm cleanup និង restore លើឧបករណ៍ពិត។ កុំលុប storage ឬ queue ដើម្បីសាក update។
- ផ្ទៀង Firebase និង Supabase ដោយ A–B–C៖ ចុចស្ទួន បណ្ដាញដាច់/យឺត និងបិទ App មុន/ក្រោយ server commit; ផ្ទៀង barcode និង ledger រាល់ជំហាន។ Matrix ក្នុង CI និងការវាស់កម្រិតផលិតកម្មត្រូវរាយលទ្ធផលដាច់ពី unit simulation។
- ការកែខាងលើមិនបន្ថែម database rule, migration ឬ server endpoint; គ្មានការដាក់ច្បាប់ DB ថ្មីដោយដៃសម្រាប់ជុំនេះ។

### [2.50.161] — 2026-10-26 · ZoeW ៖ ម៉ឺនុយសកម្មភាព Sign បង្រួម (A317)

**ZoeW** (`zoew-v424` ➜ `zoew-v425`)។ **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន · អ្នកយាម

- តាមរូបម្ចាស់៖ ប៊ូតុងសកម្មភាពធ្វើឱ្យជួរ Sign ធំពេក។ ប៊ូតុង និងព័ត៌មានលម្អិតស្ថិតក្នុង ⋯ ជ្រុងខាងស្តាំ; បើកតែមួយជួរ និងនៅក្នុងលំហូរ modal ដើម្បី scroll បានដោយមិនបាំងជួរផ្សេង។
- ស្ថានភាព និងថ្ងៃសម្អាតនៅខាងមុខ។ Message របស់ការងារមិនទាន់ Sign នៅតែបង្ហាញ; សេចក្តីពន្យល់ Sign ដែលមាន deadline ស្ថិតក្នុងព័ត៌មានលម្អិត។
- `queued-sign-photo-ui.test.tsx` ផ្ទៀងសកម្មភាព/លេខការងារ · busy · lock/unlock · បិទខាងក្រៅ/Escape។ `queued-sign-photo-layout.test.ts` ផ្ទៀង ៩ ទំហំ និងរក្សា screenshot សំយោគក្នុង CI រយៈពេល ៧ ថ្ងៃ។ មិនប្តូរ Sign API, កាលសម្អាត, លុយ ឬ DB rules។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ម្ចាស់ពិនិត្យ screenshot មុន merge; ក្រោយអាប់ដេតផ្ទៀងទំហំលើឧបករណ៍ពិត។ មិនមាន migration ឬការកំណត់ credential ថ្មី។

### [2.50.160] — 2026-10-26 · ZoeW ៖ ចំនួនកញ្ចប់នៅទំព័រស្កេន (A312)

**ZoeW** (`zoew-v423` ➜ `zoew-v424`)។ **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន · អ្នកយាម

- QA លើ Firebase សាកល្បងរកឃើញ៖ អតិថិជនម្នាក់មាន ៣ កញ្ចប់ ប៉ុន្តែចំណងជើងទំព័រស្កេនបង្ហាញ ១ ព្រោះរាប់ជួរអតិថិជន។ ឥឡូវរាប់បញ្ជី Barcode; ទិន្នន័យចាស់គ្មានបញ្ជីប្រើ count និង Barcode ដើម។
- ស្វែងរក Barcode ដែលមានអក្សរ និងលេខ មិនយកតែលេខខាងក្នុងទៅផ្គូផ្គងលេខទូរស័ព្ទផ្សេងទេ; គាំទ្រលេខទូរស័ព្ទជាខ្មែរ និងការបំបែកដោយចន្លោះ។
- តម្រងស្វែងរករក្សាជួរអតិថិជនដូចដើម; ចំនួនជាកញ្ចប់ក្នុងជួរដែលតម្រងបាន មិនមែនចំនួនជួរដែលអេក្រង់គូរ។ មិនកែ money ledger, Sign, DB rules ឬ migrations។
- Deep audit បន្ថែមការផ្ទៀងនាឡិកាមុន commit លុបរូប Sign និងការពារវាលអត្ថបទក្នុង CSV (A315–A316)។
- `list-render-scope.test.tsx` ផ្ទៀង Barcode ច្រើន · យកខ្លះ · ថ្ងៃផ្សេង · ស្វែងរក · legacy · ពិដានបង្ហាញ។ `session-switch-fuzz.test.ts` និង `zto-palm-sign.test.tsx` ផ្ទៀង fixture ឯករាជ្យ និងលំដាប់បញ្ចប់ async។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយ update ផ្ទៀងទំព័រស្កេនដោយអតិថិជនដែលមានកញ្ចប់ច្រើន។ គ្មានការផ្លាស់ប្តូរ DB ឬ credentials។ ការបញ្ជាក់ live ZTO និងឧបករណ៍ពិតនៅដាច់ពី QA ដោយ simulator។

### [2.50.159] — 2026-10-26 · ZoeW ៖ កាលកំណត់ queue និងលុបការងារអចិន្ត្រៃយ៍

**ZoeW** (`zoew-v422` ➜ `zoew-v423`)។ **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- សំណើម្ចាស់៖ Sign បញ្ជាក់ពី ZTO ទោះគ្មានរូប ត្រូវសម្អាតអចិន្ត្រៃយ៍; unsigned រង់ចាំហើយចូលសង្គ្រោះ; លុបដោយដៃគ្មាន Undo និងលាក់បញ្ជីទទេ។
- កាលសម្អាត 24 ម៉ោងក្រោយភស្តុតាង Sign និងនាឡិកា Server ដែលទុកចិត្ត។ ការងារមិនទាន់បញ្ជាក់រង់ចាំ 10 នាទី; ការបន្តដោយដៃបើកបង្អួចរង់ចាំថ្មីដោយរក្សា request ដើម។
- ការលុបដោយបញ្ជាក់ប្រើ revision/CAS និង lease; cancellation លើ server អនុញ្ញាតតែការកក់ដែលមិនទាន់ផ្ញើ។ Unknown/in-flight និង legacy journal មិនបើកផ្លូវ replay ដោយងងឹត។
- Main CI មុននេះ npm test លើស 240s; checker បង្ហាញចុង stdout និង stderr ដាច់គ្នា ដោយមិនបង្កើន timeout។ មូលហេតុយឺតនៅ CI មិនទាន់បានបញ្ជាក់។

#### អ្នកយាម និងដែនកំណត់

តេស្ត outbox, journal, UI, និង App→Function seam ប្រើទិន្នន័យសាកល្បង។ clock-hygiene ផ្ទៀងនាឡិកាកាលសម្អាត។ ការផ្ទៀង browser ក្នុង workspace ឆាតជាប់ការបើក socket; មិនចាត់ local ជា zoew-suite ពេញ ឬ UI គ្រប់ទំហំ pass ទេ។ ក្រោយម្ចាស់ merge PR #360, main `f62a2a70` ឆ្លង Audit CI ទាំង ៤ ផ្នែក (`40265357722`) និង Android release; web/APK ផ្ទៀងកំណែរួច។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

មុន release ត្រូវឆ្លង checker ពាក់ព័ន្ធ និង zoew-suite ក្នុងបរិស្ថានដែល browser រត់បាន។ ក្រោយ update ប្រើឧបករណ៍ដើម និង PIN ដើម; រក្សាច្បាប់ចម្លងរូបដែលចង់ទុកមុនកាលលុប។ គ្មាន DB rules/migration ឬ credentials ថ្មី។ ការលុបមិនប៉ះកំណត់ត្រាកញ្ចប់ និងលុយ។

### [2.50.158] — 2026-10-25 · ZoeW ៖ រក្សាភស្តុតាង Sign ពេលពិនិត្យថ្មីមិនបាន (A311)

**ZoeW** (`zoew-v421` ➜ `zoew-v422`)។ ⛔ **ZoeKeyGen មិនប្រែ** (`2.24.26` · `zoekeygen-v137`)។

#### អ្វីដែលខុសពីមុន

- ស្ថានភាព Sign ដែលមានមិនត្រូវជំនួសដោយ unknown ពេល status ថ្មីមិនបានលទ្ធផលដែលទុកចិត្ត។ បញ្ជីបង្ហាញ «លើកមុន» និងការពិនិត្យថ្មីមិនបាន ដោយបំបែកពីភស្តុតាងរូប។
- Record ដែលបាត់ signed តែមានភស្តុតាងក្នុង parcel ដូចគ្នាអាចបង្ហាញស្ថានភាពចាស់; មិនបង្កើតភស្តុតាងដែលបាត់។ Fresh matching status នៅតែត្រូវការសម្រាប់ auto-hide និង continuation; មិន replay receipt, លុប original ឬប្ដូរការគណនាប្រាក់។

#### អ្នកយាម

`ZoeW/tests/palm-sign-outbox.test.tsx` · `ZoeW/tests/queued-sign-photo-ui.test.tsx` · `ZoeW/tests/queued-sign-photo-layout.test.ts`។ លទ្ធផល និងដែនកំណត់នៅ A311។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយ release៖ update App លើឧបករណ៍ដើម ហើយផ្ទៀងស្ថានភាព/ព័ត៌មានលម្អិត ដោយរក្សា App data, PIN និងរូប។ មូលហេតុ fresh lookup លើឧបករណ៍ពិតនៅមិនទាន់បញ្ជាក់; កុំ Sign ស្ទួនដើម្បីសាក។ គ្មាន DB rules/migration ឬ credentials ថ្មី។

### [2.50.157] — 2026-10-25 · ZoeW ៖ បញ្ជី Sign ស្រួលប្រើ និងផ្ទៀងប្រាក់តាមថ្ងៃស្កេន (A309–A310)

**ZoeW** (`zoew-v420` ➜ `zoew-v421`)។ **ZoeKeyGen មិនប្រែ** (`2.24.26` · `zoekeygen-v137`)។

#### អ្វីដែលខុសពីមុន

- ផ្នែក «រង់ចាំ» បើកជាមុន; «រក្សាទុក» បង្ហាញស្ថានភាពខ្លី ប៊ូតុងរក្សារូប និងពិនិត្យតែអាន។ ប៊ូតុងមានចន្លោះលើអេក្រង់តូច; ព័ត៌មានវែងនៅក្នុង Details និងប្រើ modal រួម។
- Sign ដែលផ្ទៀងថ្មីពី ZTO តាម Barcode អាចចេញពីបញ្ជីត្រូវពិនិត្យទោះខ្វះភស្តុតាងរូប។ រូប/សំណើ/ប្រវត្តិនៅអាចបង្ហាញ និង export; manual clear មិនកត់ unsigned ថាជោគជ័យ។ ពិដាន ៤០ និងលក្ខខណ្ឌលុបរូបពិតនៅដដែល; មិនមាន replay ឬ supplementary photo ថ្មី។
- Checker ប្រាក់គិតតាមថ្ងៃស្កេនពិត និងផ្ទៀងគ្រប់ថ្ងៃ/ខែដែលប៉ះ។ កូដគណនាប្រាក់ App មិនប្រែ។

#### អ្នកយាម

`ZoeW/tests/palm-sign-outbox.test.tsx` · `ZoeW/tests/palm-sign-outbox-idb.test.ts` · `ZoeW/tests/queued-sign-photo-ui.test.tsx` · `ZoeW/tests/queued-sign-photo-layout.test.ts` · `ZoeW/tests/money-multidevice-oracle.test.ts` · `ZoeW/tests/lookup-modes-money.test.ts`។ លទ្ធផល និងដែនកំណត់នៅ A309–A310។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយ release៖ update ZoeW លើឧបករណ៍ដើមដោយមិន uninstall/Clear Data/ប្ដូរ PIN; ផ្ទៀងបញ្ជី និង export រូបដែលរក្សាទុក។ មិនត្រូវ Sign ម្ដងទៀតដោយសាររូបខ្វះ។ គ្មាន DB rules/migration ឬ credentials ថ្មី។

### [2.50.156] — 2026-10-25 · ZoeW ៖ បញ្ជីសង្គ្រោះការងារ Sign និងរូបដើម (A308)

**ZoeW** (`zoew-v419` ➜ `zoew-v420`)។ **ZoeKeyGen មិនប្រែ** (`2.24.26` · `zoekeygen-v137`)។

#### អ្វីដែលខុសពីមុន

- អ្នកប្រើអាចផ្លាស់ការងារដែលផ្អាកពី active queue ទៅបញ្ជីត្រូវសង្គ្រោះដាច់ដោយឡែក។ រូបដើម ឈ្មោះ Barcode អត្តសញ្ញាណសំណើ និង journal linkage នៅក្នុង IndexedDB អ៊ិនគ្រីបដដែល; មានចំនួន និង export រូប ហើយមិនរត់ស្វ័យប្រវត្តិ។ មិនចាត់ថា Sign បញ្ចប់ និងមិនលុបរូប។
- សារ Sign និងភស្តុតាងរូបដើមបង្ហាញដាច់គ្នា។ ករណី Sign តាម Palm ដោយគ្មានរូប មិនត្រូវផ្ញើ Sign ឬ supplementary photo ដោយស្វ័យប្រវត្តិ។
- បន្តតាមការចុចប៉ុណ្ណោះ ហើយផ្ទៀង current journal/reservation proof ម្ដងទៀត ជាមួយ original/request ដើម។ Unsigned tracking មិនអនុញ្ញាត replay; legacy ខ្វះភស្តុតាងនៅតែត្រូវរក្សារូប និងពិនិត្យដោយដៃ។ In-flight/lease/CAS conflict មិនអនុញ្ញាតផ្លាស់ជាន់ការងារ។

#### អ្នកយាម

`ZoeW/tests/palm-sign-outbox.test.tsx` · `ZoeW/tests/palm-sign-outbox-store-unit.test.ts` · `ZoeW/tests/palm-sign-outbox-idb.test.ts`។ លទ្ធផល និងដែនកំណត់នៅ A308។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយ CI ឆ្លង និងការអនុញ្ញាត merge៖ update ទៅ `2.50.156`/`zoew-v420` ដោយរក្សាទិន្នន័យ App និង PIN ដើម។ បើក queue ក្នុងឧបករណ៍ដែលកាន់រូប ➜ ផ្លាស់ការងារដែលផ្អាកទៅ 🗂️ ➜ ផ្ទៀងបិទ/បើក និង export រូប។ ការងារត្រូវសង្គ្រោះនៅរាប់ក្នុងពិដាន ៤០; វាមិនមែនការលុបឬជោគជ័យ។ គ្មាន DB rules/migration/env ថ្មី។ មិនទាន់ផ្ទៀង live ZTO ឬឧបករណ៍អតិថិជន។

### [2.50.155] — 2026-10-25 · ZoeW ៖ ផ្ទៀង queue ក្រោយកញ្ចប់ចូលធុងសំរាមស្វ័យប្រវត្តិ (A307)

**ZoeW** (`zoew-v418` ➜ `zoew-v419`)។ **ZoeKeyGen មិនប្រែ** (`2.24.26` · `zoekeygen-v137`)។

#### អ្វីដែលខុសពីមុន

- កញ្ចប់ដែល ZTO បញ្ជាក់ `ztoClosed: true` ហើយ auto-close ផ្លាស់ទៅ trash មិនរារាំង queue ពីការផ្ទៀង Sign និងរូបដើមទៀត។ គ្របទាំង parent ទាំងមូល និង barcode មួយក្នុងជួរលាយ; មិនស្តារ parent ឬសរសេរលុយឡើងវិញ។
- Queue បញ្ចប់តែក្រោយ Sign និង hash រូបត្រូវនឹង request ដើម ហើយអាន trash/history/restore evidence បានត្រឹមត្រូវ និង local CAS ឆ្លង។ បើរូប ឬស្ថានភាពមិនច្បាស់ ➜ ផ្អាកឱ្យពិនិត្យដោយដៃ ដោយរក្សារូប និងសំណើដើម; មិនផ្ញើ receipt ឬបោះបង់ការងារដោយស្វ័យប្រវត្តិ។
- សារ legacy unsigned ពន្យល់ថា «ពិនិត្យឡើងវិញ» មិនផ្ញើ Sign។ ករណីនេះ **នៅមិនទាន់មាន safe continuation**; មិនយក unsigned tracking ឬ lease ផុតជាភស្តុតាងថាសំណើមុនមិនបានផ្ញើទេ។

#### អ្នកយាម

`ZoeW/tests/palm-sign-outbox.test.tsx` · `ZoeW/tests/pickup-cleanup-collected-race.test.ts` · `ZoeW/tests/palm-sign-journal.test.ts`។ លទ្ធផល និងដែនកំណត់នៅ A307។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយ CI ឆ្លង និងការអនុញ្ញាត merge ដាច់ដោយឡែក៖ update ទៅ `2.50.155`/`zoew-v419` ដោយមិន uninstall/Clear Data/ប្តូរ PIN។ បើក queue ក្នុងឧបករណ៍ដើមដែលរក្សារូប ហើយផ្ទៀងកញ្ចប់ auto-trash; ភស្តុតាងមិនគ្រប់ត្រូវរក្សាទុករូបដើម និងពិនិត្យក្នុង ZTO ដោយដៃ។ Legacy unsigned មិនត្រូវបង្ខំ replay; ដោះស្រាយភាពមិនច្បាស់នៃ receipt/photo មុនសម្រេចសកម្មភាពបន្ទាប់។ គ្មាន DB rules/migration/env ថ្មី និងគ្មានការអះអាងថាល្បឿន ZTO បានកើន។

---

### [2.50.154] — 2026-10-25 · ZoeW ៖ Sign ZTO អាន journal តាម modern Function (A306)

**ZoeW** (`zoew-v417` ➜ `zoew-v418`)។ **ZoeKeyGen មិនប្រែ** (`2.24.26` · `zoekeygen-v137`)។ ម្ចាស់គម្រោងស្នើកែ និងតេស្តបន្ថែមក្រោយរាយការណ៍ថាបញ្ហាមិនទាន់បាត់; ជុំនេះរៀបចំ local ប៉ុណ្ណោះ។

#### អ្វីដែលខុសពីមុន

- Function Sign ប្រើ modern runtime context ដើម្បីអាន journal ថ្មីបំផុត និងបន្តពីសារព្រមានទៅការបញ្ជាក់ដោយរក្សាការកក់ និងការពារផ្ញើរូប/`05` ស្ទួន។ ផ្លូវ Function សាធារណៈដដែល។
- Context សម្រាប់ strong read មិនគ្រប់ ឬការផ្ទៀងការកក់មុនផ្ញើមិនជោគជ័យ ➜ បដិសេធមុនផ្ញើរូប/`05`; មិនបន្ទាបទៅការអាន cache ចាស់ ឬសន្មត endpoint។ បើលទ្ធផលក្រោយបញ្ជូនមិនច្បាស់ ការរក្សារូបដើម និងការងារត្រូវផ្ទៀងរបស់ App នៅដដែល។

#### អ្នកយាម

`ZoeW/tests/zto-modern-entry.test.ts` · `ZoeW/tests/zto-function-artifact.test.ts` · `ZoeW/tests/zto-lock.test.ts` · `audit-tools/repository-contract-test.js` · `audit-tools/security-guard-test.js` · `audit-tools/comments.js`។ ភស្តុតាង source/SDK/runtime ពិត និងដែនកំណត់នៅ A306; លទ្ធផល local មិនបញ្ជាក់រោគសញ្ញាលើផលិតកម្មថាបាត់ទេ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយអនុញ្ញាត publication/deployment ដាច់ដោយឡែក៖ ផ្ទៀង deployment ប្រើ modern Function នៅ URL ដដែល និង runtime មាន strong-read context; update ZoeW ទៅ `2.50.154`/`zoew-v418` លើ iPhone PWA និង Android PWA/APK។ សាកកញ្ចប់ថ្មីមានសារព្រមាន ➜ បញ្ជាក់ ➜ ផ្ទៀងថារូប និង `05` មួយដង ហើយការងារបិទតែក្រោយភស្តុតាងដែលត្រូវការ។ ការងារចាស់ដែលលទ្ធផលមិនច្បាស់នៅត្រូវផ្ទៀង មិន blind replay; រក្សា data/PIN/រូបដើម ដោយមិន uninstall/Clear Data។ គ្មាន DB rules/migration ឬ credentials ថ្មី; មិនទាមទារ PAT ឬកំណត់ uncached endpoint ដោយដៃ។ មិនបាន publish/deploy ឬសាកឧបករណ៍ពិតក្នុងជុំនេះ; ព្រំដែន network evidence ពន្យល់ក្នុង A306។

### [2.50.153] — 2026-10-25 · ZoeW ៖ Sign ដែលត្រៀមរួច · ភស្តុតាងរូបភាព និងលទ្ធផលត្រូវផ្ទៀង (A305)

**ZoeW** (`zoew-v416` ➜ `zoew-v417`)។ **ZoeKeyGen មិនប្រែ** (`2.24.26` · `zoekeygen-v137`)។ ម្ចាស់គម្រោងអនុញ្ញាតកែ ZTO និងស្នើផ្ទាល់ដក emoji រូបភ្នែកពីផ្ទាំងទាញបញ្ជី ដោយរក្សាឥរិយាបថដើម។

#### អ្វីដែលខុសពីមុន

- កញ្ចប់ដែលបានជ្រើស និងមាន status ត្រៀមរួចអាចបន្តទៅរូបភាព/Sign ដោយមិនរង់ចាំ status របស់កញ្ចប់ផ្សេងដែលមិនបានជ្រើស; កញ្ចប់ដែលបានជ្រើសតែមិនទាន់ត្រៀមនៅតែត្រូវរង់ចាំ។
- Sign រក្សា encrypted job ជាប់មុន write និងទាមទារ server reservation; មិនមាន foreground fallback ពេល durable storage មិនបាន។ Auto-clear តែ signed + exact-original readback + guarded local close/commit និង revision CAS។ ACK/listing មិនគ្រប់។
- Per-row rejection ដែលផ្គូផ្គង identity រក្សាទុកជាលទ្ធផលត្រូវ verification ហើយ non-replayable; មិនចាត់ជា unsigned ដែលអាច retry សុវត្ថិភាពទេ។
- ដក emoji រូបភ្នែកពីផ្ទាំងទាញបញ្ជី ZTO តាមសំណើ; មិនប្តូរប៊ូតុង/status/handlers។

- រក្សាទុករូបដើមតាម encrypted job ដោយ local-only Web/native output; មិនកែ queue ឬហៅ ZTO ពី export ហើយ background worker មិនផ្អាក។
- Explicit false នៅ prewrite gate ឆ្លើយបដិសេធជាក់លាក់ ដើម្បីកុំឱ្យ client វិល poll ការងារដែលមិនបានផ្ញើ។ Server-only read helper អាន `querySignPic`; `listed` មិនមែន exact photo proof និង manual probes អានតែប៉ុណ្ណោះ។

#### អ្នកយាម

`ZoeW/tests/zto-palm-sign.test.tsx` · `ZoeW/tests/zto-palm-sign-server.test.ts` · `ZoeW/tests/zto-palm-sign-e2e.test.tsx` · `ZoeW/tests/palm-sign-journal.test.ts` · `ZoeW/tests/palm-sign-outbox.test.tsx` · `ZoeW/tests/zto-lock.test.ts`។ Final protocol 14 ឯកសារ/599 tests និង independent review 225 tests ឆ្លង; លទ្ធផល targeted មិនជំនួស CI ឬ live ZTO។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយអនុញ្ញាតដាក់ប្រើ App/Function៖ សាក iPhone PWA និង Android PWA/APK លើកញ្ចប់ដែលបានជ្រើសត្រៀមរួច ខណៈកញ្ចប់ផ្សេងនៅ pending; ផ្ទៀងរូបភាពជាក់លាក់របស់សំណើ និងការបដិសេធតាមជួរមិន resend; ផ្ទៀងផ្ទាំងទាញបញ្ជីគ្មានរូបភ្នែក និងដំណើរការដដែល។ គ្មាន Firebase/Supabase rules ឬ migrations ថ្មីសម្រាប់ជុំនេះ។ គ្មាន live ZTO/ឧបករណ៍ពិតបានសាកក្នុង session។ ផ្ទៀង Android save/share chosen file និង hash រូបដើម; កុំលុប data/PIN/job ដើម។ Native copy ក្រោយ handoff នៅ cache រហូត OS សម្អាត មិនអះអាង secure erase។ Client/Server ត្រូវផ្គូផ្គង ហើយ update ឧបករណ៍សាខាទាំងអស់ដោយមិន uninstall/Clear Data/ប្តូរ PIN។ Unknown/recompressed/unsupported photo និង legacy/reused-barcode jobs នៅ manual hold; cancel/discard ច្បាស់មាន server tombstone។ សាក signed+exact-original+guarded close មុន auto-clear និង manual read-only probes; មិន blind replay ពេល image/05 outcome មិនច្បាស់។ គ្មាន DB rules/migration/credentials ថ្មី។

### [2.50.152] — 2026-10-24 · ZoeW ៖ ផ្ទៀងស្ថិតិ និងប្រាក់ · ការងារយឺតតាមវគ្គគណនី (A299)

**ZoeW** (`zoew-v415` ➜ `zoew-v416`) · **ZoeKeyGen `2.24.26`** (`zoekeygen-v136` ➜ `zoekeygen-v137`)។

#### អ្វីដែលខុសពីមុន

- ការសម្អាតអាន server witnesses មុនដកលើកដំបូង និងផ្ទៀង journal រក្សាទុកជាប់; ការបើកឡើងវិញមិនលុបការងារមិនទាន់ផ្ទៀងច្បាស់ ឬប្តូរ prior proof កណ្តាល recovery (A302)។
- ស្តារប្រាក់យកតែចំនួនដែលបានដកពិតដាច់តាមថ្ងៃ/ខែ មិនបូកតម្លៃកញ្ចប់ពេញក្រោយការដកត្រូវ clamp។ កញ្ចប់ទំនើបខ្វះភស្តុតាងរង់ចាំផ្ទៀង ជំនួសការបូកតាមសន្មត (A301)។
- ស្ថិតិយករួចលើជួរដែលមានកញ្ចប់បើក និងបិទលាយគ្នា រាប់តែកញ្ចប់បិទ មិនរាប់កញ្ចប់បើកចូលចំនួនយករួច។
- ការផ្ទៀងប្រាក់យករួចអានទិន្នន័យកញ្ចប់ចាស់ និងបញ្ជីដែលរក្សាជា object លេខ ដូចផ្លូវ normalize ទិន្នន័យធម្មតា។
- Supabase រក្សា own keys ពិសេសក្នុង snapshot និងការសរសេរ ដោយមិនយក property ដែលមរតកពី prototype មកជាទិន្នន័យ។
- ការបង្កើតគណនី និងស្តារពាក្យសម្ងាត់មិនយកលទ្ធផលយឺតមកប៉ះវគ្គថ្មី។ ការបោះបង់ទាញ APK មិនបើកកម្មវិធីដំឡើងក្រោយលទ្ធផលយឺត។
- កាមេរ៉ា Config QR មិនបើក scanner ពីសំណើ permission ចាស់ក្រោយបិទផ្ទាំង ឬប្តូរវគ្គ។
- Service Worker របស់ App ទាំងពីររក្សា JS/CSS/WASM ជាមួយ shell កំណែដូចគ្នា ដោយមិនធ្វើ background refresh លើកូដរបស់ shell ចាស់។

#### អ្នកយាម

`ZoeW/tests/daily-stats-mixed-pickup.test.ts` · `ZoeW/tests/pickup-cleanup-collected-race.test.ts` · `ZoeW/tests/supabase-own-keys.test.ts` · `ZoeW/tests/account-session-race.test.ts` · `ZoeW/tests/notify-apk-link.test.tsx` · `ZoeW/tests/config-qr-session.test.ts` · `ZoeW/tests/sw-revalidation-timeout.test.ts` · `audit-tools/adaptive-link-test.js` · `ZoeW/tests/cleanup-ledger-key.test.ts` · `ZoeW/tests/trash-retry-session.test.ts` · `ZoeW/tests/three-device-recovery.test.ts`។ ភស្តុតាង និងដែនកំណត់ ➜ A299 · A301 · A302; CI លើ commit ចុងក្រោយនៅត្រូវផ្ទៀង មិនទាន់អះអាងថាជុំ audit ចប់។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយអនុញ្ញាតដាក់ប្រើ៖ ផ្ទៀងលើ iPhone PWA និង Android PWA/APK ពិត លើហាង Firebase និង Supabase៖ ជួរមួយមានកញ្ចប់បើក/បិទលាយគ្នា ➜ ចំនួន និង COD/DOD យករួចត្រឹមត្រូវ; ប្តូរគណនីពេលបង្កើត/ស្តារពាក្យសម្ងាត់កំពុងរង់ចាំ; បោះបង់ទាញ APK ខណៈបណ្ដាញយឺត ➜ មិនបើកដំឡើង។ បើក/បិទ Config QR ពេលសុំសិទ្ធិកាមេរ៉ា; ទុក tab ចាស់របស់ App ទាំងពីរខណៈដាក់កំណែថ្មី រួចផ្ទៀងការប្តូរកំណែ និង offline។ **មុន merge App**៖ Publish `firebase-database.rules.json` លើ Firebase Business គ្រប់ហាង និងអនុវត្ត Supabase migrations ដែលត្រូវការ តាមលំដាប់៖ `20261025025905_zoe_quota_cleanup.sql` និង `20261025025945_zoe_rules.sql`។ **បន្ទាប់ពីដាក់ App ត្រូវ update clients ទាំងអស់ទៅ 2.50.152** មុនពឹងលើ protocol ថ្មី; writer ចាស់អាចលុប monthly proof។ សាក manual-adjusted daily/monthly ➜ ដក ➜ ស្តារ និងករណីខ្វះ proof ត្រូវ hold។ Supabase migrations អនុវត្ត និងផ្ទៀងរួចតាមការអនុញ្ញាត (A304); Firebase Business rules នៅរង់ចាំម្ចាស់គម្រោង Publish ដោយដៃ។ មិនបានសាកឧបករណ៍ពិតក្នុង session នេះ។

### [2.50.151] — 2026-10-24 · ZoeW ៖ បង្កើនល្បឿន ZTO Login · ទាញបញ្ជី ZTO និង Sign ពិនិត្យស្ថានភាព (A298)

**ZoeW** (`zoew-v414` ➜ `zoew-v415`) · ⛔ **ZoeKeyGen មិនប្រែ** (`2.24.25` · `zoekeygen-v136`)។ ម្ចាស់គម្រោងស្នើផ្ទាល់ឱ្យទាញកូដថ្មីពី `main` ហើយពិនិត្យ និងកែល្បឿន **ZTO Login**, **អាន/ទាញបញ្ជី ZTO** (11.0–15.0s · ពេលខ្លះ 6.0–8.0s) និង **Sign ពិនិត្យស្ថានភាព** (~0.50–2.0s) ឱ្យរហ័សដូច **Lookup** (~0.6s) ➜ អនុញ្ញាតកែតំបន់ចាក់សោ ZTO (`zto-palm-login.ts` · `_shared/zto-palm.js` · `zto-order-detail.js` · `zto-list-sync.ts`) និងធ្វើបច្ចុប្បន្នភាព `LOCK`។

#### អ្វីដែលខុសពីមុន

- 📥 **ទាញបញ្ជី ZTO (`zto-list-sync.ts` · `_shared/zto-palm.js`)** ៖
  - ដក `cache: 'no-store'` ពីការហៅទាញបញ្ជី ដើម្បីឱ្យ Android WebView/Chromium ចងចាំ CORS preflight `OPTIONS` រយៈពេល 2 ម៉ោងដូច Lookup (កាត់ការរង់ចាំ preflight ស្ទួន 8–15 ជុំ) ខណៈ Server នៅរក្សា `Cache-Control: no-store`។
  - កំណត់ពិដានពេលរង់ចាំ `queryTrackInfo` ក្នុងការទាញបញ្ជីត្រឹម `3000ms` ជំនួស `7000ms` ដូច្នេះ socket ZTO តែមួយគាំងមិនអូសក្រុមទាំងមូលដល់អស់ថវិកា Function 9s ហើយបង្ខំឱ្យធ្លាក់ចូល Pass 2 (មូលហេតុចម្បងនៃ 11.0–15.0s) ឡើយ។
  - Worker ដែលទំនេរចាប់ផ្ដើមផ្ទៀង track ភ្លាមៗពេលគ្មានទំព័រក្នុងជួររង់ចាំ ទោះចំនួនកញ្ចប់តិចជាង 30 ក៏ដោយ (មិនដេករង់ចាំទំព័របន្ទាប់ចប់ ~1.5s)។
  - ឌិគ្រីបសោភ្ជាប់ និងអាន `X-Zoe-Id-Token` តែម្តងក្នុងមួយជុំទាញបញ្ជី Palm ជំនួសការធ្វើស្ទួនរាល់ទំព័រ/ក្រុម ហើយរំលង `resolveZtoListSignedVerdicts` ក្រោយទាញបញ្ជី Palm (ព្រោះរាល់ជួរបានផ្ទៀងតាម `queryTrackInfo` រួច) និងបន្ថយការរង់ចាំ retry ពី `1000ms` មក `300ms`។
- ✍️ **Sign ពិនិត្យស្ថានភាព និងការផ្ញើ Sign (`zto-palm-sign.ts` · `palm-sign-outbox.ts` · `_shared/zto-palm.js` · `zto-order-detail.js`)** ៖
  - ដក `cache: 'no-store'` ចេញពីការពិនិត្យស្ថានភាព ចែកចាយ Sign ផ្ទៀងឡើងវិញ និង outbox ដើម្បីឱ្យ WebView ចងចាំ CORS preflight `OPTIONS ?palm=sign` ដូច Lookup។
  - ផ្លូវអាន `queryTrackInfo` ក្នុង `signPalm` សាកការភ្ជាប់ថ្មីស្វ័យប្រវត្តិម្តងទៀតពេលជួប socket ចាស់ដែល ZTO បិទស្ងាត់ (`UND_ERR_SOCKET` / `ECONNRESET`) ដូច Lookup ដែរ ខណៈផ្លូវសរសេរ (`saveScanInfo` · `saveBillPic` · `newBusinessCheck`) ⛔ មិនសាកស្ទួនឡើយ។
  - `palmDeps` ចងចាំលទ្ធផលផ្ទៀង `X-Zoe-Id-Token` ក្នុងសំណើ HTTP តែមួយ ដើម្បីមិនផ្ទៀងស្ទួនពេលពិនិត្យស្ថានភាព ឬពេល renew session រួម។
- 🔐 **ZTO Login (`zto-palm-login.ts` · `_shared/zto-palm.js`)** ៖
  - ដក `cache: 'no-store'` ចេញពី Login/ភ្ជាប់ហាង/refresh ដើម្បីចងចាំ CORS preflight។
  - ពេល Login ដោយដៃលើ container ត្រជាក់ Server អានបញ្ជីសាខា `palm-sites` ស្របគ្នានឹងការសរសេរ session `palm-session` ក្នុង 1 RTT ហើយលើ container ក្តៅដែលស្គាល់សាខាក្នុង memory រួច មិនអាន/សរសេរ `palm-sites` ស្ទួនឡើយ។
- 🛠️ **ជួស CI លើ `main` (`.github/workflows/opencode.yml` · `repository-file-coverage.json`)** ៖ លើក `permissions:` (read-only) ទៅកម្រិតឯកសារខាងលើគេ ដាក់លក្ខខណ្ឌ `author_association` (`OWNER`/`MEMBER`/`COLLABORATOR`) ការពារកុំឱ្យគណនីសាធារណៈក្រៅក្រុមហៅ `/oc` ប្រើ `ANTHROPIC_API_KEY` និងចុះបញ្ជីអ្នកយាម `github-workflow-security` ក្នុង `repository-file-coverage.json`។

#### អ្នកយាម

`ZoeW/tests/zto-palm-sign-server.test.ts` · `ZoeW/tests/zto-palm-sign.test.tsx` · `ZoeW/tests/zto-palm-list.test.tsx` · `ZoeW/tests/zto-palm-list-e2e.test.tsx` · `ZoeW/tests/zto-palm-server.test.ts` · `ZoeW/tests/zto-palm-login.test.tsx` · `ZoeW/tests/zto-palm-shared.test.ts` · `ZoeW/tests/zto-lock.test.ts` (sha256 ថ្មី 4 ឯកសារ) · `ZoeW/tests/native/zto-preflight.test.ts` · `ZoeW/tests/native/zto-cors.test.ts` · `audit-tools/security-guard-test.js` · `audit-tools/repository-file-coverage.js`។ មូលហេតុ និងការផ្ទៀងក្រហម ➜ បៃតង ➜ A298។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយ deploy Function និង App កំណែ `2.50.151` (និងដំឡើង APK ថ្មីបើសាកលើ App Android)៖ សាក ZTO Login, ទាញបញ្ជី ZTO និងចុច Sign ពិនិត្យស្ថានភាពលើឧបករណ៍ពិត ដើម្បីផ្ទៀងរយៈពេលឆ្លើយតបជាក់ស្តែង។ គ្មាន rules, SQL migration ឬ environment variable ថ្មី។

### [2.50.150] — 2026-10-24 · ZoeW និង ZoeKeyGen 2.24.25 ៖ កែ R1–R5 ដែល audit បញ្ជាក់ (A297)

**ZoeW** (`zoew-v413` ➜ `zoew-v414`) · **ZoeKeyGen** (`zoekeygen-v135` ➜ `zoekeygen-v136`)។

#### អ្វីដែលខុសពីមុន

- Reset ស្ថិតិយកកញ្ចប់ឈប់ពេលប្ដូរ session ហើយ callback ចាស់មិនប៉ះស្ថិតិ ឬសោរបស់ការងារថ្មី។ កែទូរស័ព្ទរក្សា pickup ដែល Reset រួច។
- ស្តារ backup ដដែលជុំថ្មីមាន operation identity ថ្មី; retry សំណើដដែលនៅការពារការសរសេរស្ទួន។
- Push បញ្ឈប់ subscription តាម revision ដែលបានផ្ទៀង ដូច្នេះការផ្ទេរហាង ឬ refresh មិនត្រូវការងារចាស់លុប។
- KeyGen បញ្ឈប់ retry របស់ seat និងដំណឹងមុនសរសេរ ពេល admin/session/database ប្រែ។

#### អ្នកយាម

`pickup-reset-session.test.ts` · `phone-pickup-stale-view.test.ts` · `lookup-modes-money.test.ts` · `push-server.test.ts` · `keygen-session-security-test` · `supabase-data-tools-test`។ លទ្ធផល red/green និងព្រំដែន ➜ A297; full Audit CI ត្រូវផ្ទៀងលើ SHA នៃ PR ចុងក្រោយ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

ក្រោយទទួលកំណែថ្មី៖ សាក Reset និងកែលេខទូរស័ព្ទលើទិន្នន័យសាក; ផ្ទៀង Push លើឧបករណ៍ដែលប្ដូរហាង និង KeyGen ក្រោយ logout/login។ Sign ជាក្រុម និងរូបតាម Barcode ត្រូវផ្ទៀងលើឧបករណ៍ពិតតាម pending ខាងលើ។ គ្មាន rules, SQL migration ឬ environment ថ្មីដែលត្រូវ deploy សម្រាប់ R1–R5។ មិន merge ជំនួសម្ចាស់គម្រោង។

### [2.50.149] — 2026-10-24 · ZoeW ៖ Sign ចូល queue និងបញ្ជាក់សារដែល ZTO អនុញ្ញាតដោយស្វ័យប្រវត្តិ (A296)

**ZoeW** (`zoew-v412` ➜ `zoew-v413`)។ ម្ចាស់គម្រោងស្នើឱ្យកញ្ចប់ 3–4 របស់ម្ចាស់តែមួយមិនសួរបញ្ជាក់បញ្ហាម្តងមួយៗ ទាំងចែកចាយស្វ័យប្រវត្តិ និង Sign; ចុច Sign រួចរក្សារូប/ការងារចូល queue។ សំណើនេះជំនួស flow បញ្ជាក់ធម្មតាដោយដៃពីកំណែចាស់។ ZoeKeyGen មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- Scan នៅចាប់រូប និងចែកចាយតាម Barcode។ សារដែល Server បញ្ជាក់ថាអនុញ្ញាតបន្ត ត្រូវបញ្ជាក់ជាមួយ token របស់កញ្ចប់នោះដោយស្វ័យប្រវត្តិមួយដង។ ZTO នៅពិនិត្យលក្ខខណ្ឌឡើងវិញមុនសរសេរ។
- ចុច Sign រក្សាកញ្ចប់ដែលរួចរាល់ចូល queue ភ្លាម ដោយមិនរង់ចាំ receipt-check ក្នុង modal។ រូប ឈ្មោះ request និង proof ដាច់តាមកញ្ចប់; បិទ modal តែក្រោយរក្សាទុកបាន។
- Worker រក្សា token និងបន្ត lease មុន auto-replay; សារប្រែម្តងទៀត, ការហាម, auth/schema error និងចម្លើយសរសេរមិនច្បាស់ នៅតែឈប់/ផ្ទៀងតាមផ្លូវរបស់វា។ Queue ចាស់រក្សាជម្រើសបញ្ជាក់ដើម។
- ការបិទកញ្ចប់/ប្រាក់នៅរង់ចាំ photo ACK និង Sign ACK ត្រឹមត្រូវ។ ពិដាន workers 2 និង server business/payment/site checks មិនប្រែ។

#### អ្នកយាម

`ZoeW/tests/palm-sign-confirmation-transport.test.ts` · `ZoeW/tests/zto-palm-sign.test.tsx` · `ZoeW/tests/zto-palm-sign-e2e.test.tsx` · `ZoeW/tests/palm-sign-outbox.test.tsx` · `ZoeW/tests/palm-sign-outbox-idb.test.ts` · `ZoeW/tests/palm-sign-journal.test.ts` · `ZoeW/tests/zto-palm-sign-server.test.ts` · `ZoeW/tests/lookup-modes-money.test.ts` · `emu/money-multidevice-emu-test` · `supabase-money-multishop-test`។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. ផ្ទៀង CI លើ commit ចុងក្រោយ និង preview; មិន merge ដោយស្វ័យប្រវត្តិ។ គ្មាន rules, SQL ឬ env ថ្មី។
2. សាកកញ្ចប់ 3–4 របស់ម្ចាស់តែមួយ៖ រូបនីមួយៗត្រូវតាម Barcode, សារ ZTO ធម្មតាបន្តដោយស្វ័យប្រវត្តិ, សារហាមបន្តបង្ហាញក្នុង queue ហើយមិនបិទកញ្ចប់។
3. សាកបណ្ដាញដាច់/បើក App ឡើងវិញ និងរក្សារូបមិនបាន; ផ្ទៀង photo/Sign ក្នុង ZTO ពីប្រតិបត្តិការពិត។ APK ត្រូវ build កំណែថ្មីដើម្បីទទួល flow នេះ។

### [2.50.148] — 2026-10-24 · ZoeW ៖ ZTO អានស្របគ្នាមានពិដាន និងចែករំលែកការអានកំពុងដំណើរការ (A294)

**ZoeW** (`zoew-v411` ➜ `zoew-v412`)។ សំណើម្ចាស់គម្រោង៖ ពិនិត្យ Cookie/Blob និង ZTO Login ទាំងអស់ វាស់ sync/read/write ហើយបង្កើនល្បឿនដែលអាចធ្វើបាន; ពិនិត្យ `draft.7z` របស់ Palm។ សំណើនេះអនុញ្ញាតកែតំបន់ ZTO ដែលចាក់សោ។ ZoeKeyGen មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- Cold requests ដែលចូលព្រមគ្នាចែករំលែក Blob credential/session read និង Supabase identity read ក្នុង boundary ដដែល។ Deadline នីមួយៗ និង fresh rotation រក្សាដដែល។
- Cookie lifetime persistence រក្សាលំដាប់ក្រោយ companion reads ដើម្បីកុំបាត់ត្រាបដិសេធពី request ដែលចូលព្រមគ្នា។ Palm signed-list primary និង sibling reads រត់ស្របគ្នា; primary failure មិនរង់ចាំ sibling យឺតរហូតបាត់ renewal budget។
- Detail sweep របស់ Cookie/Palm អានមុនមានពិដាន 3; verdict និង business writes អនុវត្តតាមលំដាប់។ ពិដាន 10 កញ្ចប់ក្នុងជុំ, cadence, import lanes និង Sign outbox មិនឡើង។

#### អ្នកយាម

`ZoeW/tests/zto-read-sharing.test.ts` · `ZoeW/tests/zto-palm-shared.test.ts` · `ZoeW/tests/zto-sweep-prefetch.test.ts` · `ZoeW/tests/zto-session-race.test.ts` · `ZoeW/tests/zto-signed-sync.test.tsx` · `zto-list-sync-test` · `zto-sync-banner-test` · `zto-cookie-session-test`។ លទ្ធផលវាស់ និងព្រំដែនភស្តុតាងនៅផ្នែក ២ A294–A295។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. ផ្ទៀង branch/commit និង CI ថ្មីមុន merge; មិនបាន merge ឬ deploy ក្នុង session នេះ។ គ្មាន rules, SQL ឬ env ថ្មី។
2. Preview ➜ ផ្ទុក ZoeW 2.50.148 ➜ សាក Cookie និង Palm (សាខាតែមួយ/ច្រើន), token ផុត, ប្ដូរគណនី, ក្រៅបណ្ដាញ, ស្កេនខណៈ sweep និងស្ថិតិ COD/DOD។ APK ត្រូវ build ជាមួយកំណែថ្មី ដើម្បីទទួល client prefetch។
3. វាស់ live latency ពី diagnostics/operation ពិត ដោយរក្សាចំនួន request មានពិដាន; កុំផ្ញើ Sign សាកល្បងលើ parcel ពិត។

### [2.50.147] — 2026-10-24 · ZoeW ៖ ដក probe 🔬 ពី PR #349 ក្រោយម្ចាស់គម្រោងបញ្ជាក់ការកែ iPhone PWA ជោគជ័យ

**ZoeW** (`zoew-v410` ➜ `zoew-v411`)។ ម្ចាស់គម្រោង ៖ «ដក probe 🔬 ចេញក្នុង PR349 ការកែជោគជ័យ» ➜ បិទការផ្ទៀងផ្ទាត់ iPhone PWA របស់ A286–A288 និងដកធាតុនោះពី «📌»។ ⛔ **ZoeKeyGen មិនប្រែ** · Android native · rules · SQL · Function មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- ដក toast 🔬 សម្រាប់វាស់ទំព័ររុញលើ deploy preview រួមទាំង listener · state · constants · accessor និង test ដែលមានតែ probe។
- រក្សាការកែ focus របស់ iPhone PWA ៖ ចុចត្រង់ប្រអប់ · ស្លាក · ក្បែរប្រអប់ និង ∧/∨ ក្រោយអូសរំកិល ➜ ទំព័រ និងផ្ទាំងនៅនឹង។ ប្រវត្តិរូប probe និងការវាស់នៅផ្នែក ២ A285–A288 នៅជាភស្តុតាង។

#### អ្នកយាម

`ZoeW/tests/ios-adjusted-tap-focus.test.ts` · `ZoeW/tests/modal-keyboard.test.tsx` និងអ្នកយាម focus/keyboard ដែលនៅក្នុង repo។ ជុំថែទាំនេះមិនបន្ថែមលេខ A ថ្មី។

ក្នុង session Windows ៖ `tsc` · `eslint .` ✅ · តេស្តពាក់ព័ន្ធ ៤ ឯកសារ 124/124 ✅ (`ios-adjusted-tap-focus` · `ios-synthetic-click-focus` · `modal-keyboard` · `forbidden-zone-lock`) · build វាស់ជាមួយ Chromium ពិត ✅ · `strip-comments` សម្អាត ០ · `doc-scope-test` 110 · `state-hygiene` · `comments` · `version-check` · `version-bump-scope` 18 · `repository-file-coverage` 10 ✅។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Preview ➜ «កំណែថ្មី» (2.50.147) ដើម្បីផ្ទុកកំណែដែលដក probe រួច។ គ្មាន rules · SQL · env ត្រូវកំណត់។
2. រង់ចាំ Audit CI ទាំង ៤ ផ្នែកបៃតងលើ commit ចុងក្រោយរបស់ PR #349។ ⛔ មិន merge ដោយគ្មានសំណើម្ចាស់គម្រោង។

### [2.50.146] — 2026-10-24 · ZoeW ៖ iPhone PWA ៖ ∧/∨ លើ keyboard ក្រោយអូសរំកិល ➜ ទំព័រនៅនឹង (A288)

**ZoeW** (`zoew-v409` ➜ `zoew-v410`)។ ⛔ **ZoeKeyGen មិនប្រែ** · Android native · rules · SQL · Function មិនប្រែ · Android មិនប្រែ។ ម្ចាស់គម្រោងលើ preview [2.50.145] ៖ «ចុចធម្មតាលែងអីហើយ
ទាល់ចុច pgup pgdn បានអត់ មុនមុន ចុចប្តូរប្រអប់វាយ touch ក៏រុញដែរឥឡុវចុចសាកច្រើនដងឃើញថាលែងអី» + toast 🔬 ២ (ផ្ទាំង Sign ៖ ៦០ · ១១៨pt)។

#### អ្វីដែលខុសពីមុន

- **iPhone ៖ អូសរំកិល (ផ្ទាំង · ទំព័រ) រួចចុច ∧/∨ ភ្លាមៗ (< ១ វិ.)** ៖ ប្រអប់ដែលទទួល focus ត្រូវ refocus `preventScroll` ➜ ទំព័រនៅនឹង (មុនកែ ៖ App ចាត់ focus នោះជារបស់ការអូស ➜ ទុកឲ្យ iOS ➜
  ទំព័ររុញ ៦០–១១៨pt មួយភ្លែត) · ការចុចដែលរំកិលតិច (≤ `TAP_FOCUS_MOVE_MAX_PX`) នៅជាការចុចរបស់ iOS ដូចមុន · Android មិនប្រែ · probe 🔬 នៅ (preview តែប៉ុណ្ណោះ)។

#### អ្នកយាម

`ZoeW/tests/ios-adjusted-tap-focus.test.ts` +៦ (សរុប ៤៣ ៖ tape 6:35 ៖ អូសលើវីដេអូ · លើស្លាក · បញ្ឈរសុទ្ធ · touchcancel ➜ ∨ ➜ refocus · ទិសផ្ទុយ ៖ រំកិល ≤ ៤៥px · ចុចមិនរំកិល) — មុនកែធ្លាក់ ៤ ·
mutation ៨ ➜ ចាប់ ៨ · `ios-accessory-focus` (A139 ៖ ការអូស ៤០px នៅជាការចុច) · suite ពាក់ព័ន្ធ ២២ ឯកសារ ៣៧៥/៣៧៥ · `state-hygiene` (`tapFocusTouch`)។ ការវាស់ ➜ ផ្នែក ២ A288។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **iPhone** ៖ preview ➜ «កំណែថ្មី» (2.50.146) ➜ ✍️ Sign ➜ ចុចប្រអប់ឈ្មោះ ➜ អូសរំកិលផ្ទាំង ➜ ∨ ➜ ∧ ច្រើនដង · ទំព័រស្កេន ៖ ចុច Barcode ➜ ∨ ➜ ទំព័រមិនរុញ ➜ ប្រាប់ ·
   នៅរុញ ➜ ថត toast 🔬 ផ្ញើមក។
2. ⛔ **កុំ merge កំណែនេះតែឯង** ៖ ដក probe ក្នុង PR ដដែលមុន merge (បន្ទាប់ PR #348)។

### [2.50.145] — 2026-10-24 · ZoeW ៖ iPhone PWA ៖ ផ្ទាំង Sign · ZTO ៖ ចុចស្លាក ឬក្បែរប្រអប់ឈ្មោះ · Barcode ➜ ទំព័រនៅនឹង · probe 🔬 វាស់ផ្ទាំងបើកផង (A287)

**ZoeW** (`zoew-v408` ➜ `zoew-v409`)។ ⛔ **ZoeKeyGen មិនប្រែ** · Android native · rules · SQL · Function មិនប្រែ · Android (APK · Chrome) មិនប្រែ។ សំណើម្ចាស់គម្រោង ៖ «សូម វាស់លើ modal sign ios pwa» ·
«ក្នុង modal sign នៅរុញទំព័រម្តងម្កាលដែរ ពេលចុច ប្រអប់វាយ ឈ្មោះ និង barcode»។

#### អ្វីដែលខុសពីមុន

- **iPhone · ផ្ទាំងដែលមានស្លាក `label[for]` ពីលើប្រអប់វាយ** (✍️ Sign · ZTO ៖ «👤 ឈ្មោះអ្នកទទួល» · «⌨️ ម៉ាស៊ីនស្កេន ឬវាយ Barcode») ៖ ចុចលើស្លាក ឬក្បែរប្រអប់ (iOS ផ្ញើការចុចទៅស្លាក) ➜ App ចាប់ ហើយ focus
  ប្រអប់ `preventScroll` (មុនកែ ៖ ស្លាក focus ប្រអប់ដោយខ្លួនឯង ➜ iOS រំកិលទំព័រ) · ស្លាករបស់ checkbox · ប៊ូតុង · ផ្ទាំងបិទ · Android ➜ ដូចមុន។
- 🔬 **deploy preview តែប៉ុណ្ណោះ** ៖ probe [2.50.143] ត្រឡប់មកវិញ ហើយ **ប្រាប់ពេលផ្ទាំងបើកផង** ៖ ក្បាល toast + ស្ថានភាពប្រអប់ដែលចុច (ឬដែល mousedown សំយោគទៅដល់ពេលចុចក្បែរ ៖ `ts:div`) ៖ `ប្រអប់ sn`/`sb`
  (ឈ្មោះ · Barcode របស់ Sign) · `~` = ស្លាក · `ផ្ទាំង <id> card<top> fit<shift>/<max> vp<top>+<height>` · scroll ស្តាប់ជា capture (ឃើញការរុញ document មុន App ទាញត្រឡប់ ០) ·
  ⛔ មិនប្តូរការចាប់ · focus · ចលនា · host ផលិតកម្ម ➜ គ្មាន listener។

#### អ្នកយាម

`ZoeW/tests/ios-adjusted-tap-focus.test.ts` +៣ (សរុប ៣៧ ៖ ស្លាកក្នុងផ្ទាំង Sign ៖ មុនកែធ្លាក់ ២ · ទិសផ្ទុយ ៖ checkbox · ប៊ូតុង · ផ្ទាំងបិទ · Android) · `ZoeW/tests/ios-push-probe.test.ts` ១១
(ផ្ទាំង Sign ៖ `ts:div` ➜ `md:sn~ p1` · ផ្ទាំង · កាត · fit · document រំកិលហើយ App ទាញ ០ ➜ probe នៅឃើញ · ផ្លូវលេចចាស់ ៖ ឥឡូវ mousedown ចាប់ `p1`) · mutation ៨ ➜ ចាប់ ៨ · suite ពាក់ព័ន្ធ
១៨ ឯកសារ ៣៤០/៣៤០ · `state-hygiene` (`pushProbe`)។ ការវាស់ ➜ ផ្នែក ២ A287។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **iPhone** ៖ បើករូបតំណាង preview ➜ «កំណែថ្មី» ➜ ផ្ទុកឡើងវិញ (ឬ Add to Home Screen ម្តងទៀត) ➜ បើក ✍️ Sign ➜ ចុចប្រអប់ឈ្មោះ · Barcode ច្រើនដង (ត្រង់ប្រអប់ · លើស្លាក · ក្បែរ) · ✓ · ∨ ➜
   ទំព័ររុញ ➜ toast 🔬 លេច ➜ ថតអេក្រង់ផ្ញើមក · ទំព័រមិនរុញ ➜ ប្រាប់ · ធ្វើដូចគ្នាលើទំព័រស្កេន ([2.50.144])។
2. ⛔ **កុំ merge កំណែនេះតែឯង** ៖ probe ត្រូវដកចេញក្នុង PR ដដែលមុន merge (បន្ទាប់ PR #348) · ⛔ គ្មាន rules · SQL · env។

### [2.50.144] — 2026-10-24 · ZoeW ៖ iPhone PWA ៖ ទំព័រនៅនឹងពេល keyboard លោត — ចាប់ការចុចសំយោគក្បែរប្រអប់ · PIN App Lock · ∨ · ត្រឡប់ចូល App (A286)

**ZoeW** (`zoew-v407` ➜ `zoew-v408`)។ ⛔ **ZoeKeyGen មិនប្រែ** · Android native · rules · SQL · Function មិនប្រែ · Android (APK · Chrome) មិនប្រែ។ លទ្ធផល probe [2.50.143] ពី iPhone ម្ចាស់គម្រោង
(toast 🔬 ១០ រូប ២ ជុំ ៖ «ដោះស្រាយ PR349 បញ្ហា PWA ios រុញទំព័រពេលkeybaord លោត») ➜ ផ្លូវ ៥ ដែលវាស់បាន ➜ ផ្នែក ២ A286 · probe ដកចេញ។

#### អ្វីដែលខុសពីមុន

- **ទំព័រស្កេន ៖ ចុចក្បែរកន្លែងវាយ Barcode** (ផ្ទៃងងឹតជុំវិញ · ចន្លោះស្លាក ↔ ប្រអប់ · wrapper ⚡) ៖ iOS ផ្ញើការចុចទៅប្រអប់ ឬស្លាក «ស្កេន Barcode» ដែលនៅជិតបំផុត ➜ App ចាប់ពេល
  `mousedown` សំយោគ ហើយ focus `preventScroll` ➜ ទំព័រ និង navbar នៅនឹង (មុនកែ ៖ ១៣៣pt · navbar ចេញពីអេក្រង់ · រុញនៅដដែលរហូត keyboard បិទ)។ `touchend` មិន cancelable លើប្រអប់ផ្ទាល់ ក៏ចាប់ដូចគ្នា។
- **ប្រអប់ស្វែងរកលេខទូរស័ព្ទ · ប្រអប់ស្វែងរកក្នុង tab ស្កេន (បញ្ជីកញ្ចប់ · Locker)** ៖ ចុចក្បែរប្រអប់ ➜ ទាញឡើង/បង្រួមផ្ទាំងមុន ហើយ focus `preventScroll` ដូចចុចត្រង់ប្រអប់
  (មុនកែ ៖ ទំព័ររុញ ២១៨–៣៤៥pt មួយភ្លែតហើយត្រឡប់)។
- **keyboard ∨ ភ្លាមក្រោយចុចកន្លែងវាយ Barcode** (< ១ វិ.) ៖ ប្រអប់ស្វែងរកដែលទទួល focus ត្រូវ refocus `preventScroll` (មុនកែ ៖ ២៧៧pt មួយភ្លែត) — focus ដំបូងក្រោយការចុចតែប៉ុណ្ណោះជារបស់ការចុច។
- **App Lock** ៖ ចុចប្រអប់ PIN (focus ដោយកូដ គ្មាន keyboard) ➜ ចាប់ដូចប្រអប់ក្នុងផ្ទាំង · focus ដោយកូដ (ចាក់សោ · ត្រឡប់ចូល App) មាន `preventScroll` ពេលប្រអប់ PIN នៅពីលើ keyboard ដែលរំពឹង
  (មុនកែ ៖ ១៩៧pt) · ប្រអប់ PIN ដែល keyboard នឹងបាំង (iPad ផ្តេក) ➜ iOS បង្ហាញដូចមុន។
- **ត្រឡប់ពី App ផ្សេង (ឬផ្ទាំងប្រព័ន្ធ) ខណៈកន្លែងវាយ Barcode នៅ focus** ៖ keyboard បិទ ➜ ចុចប្រអប់ម្តងទៀតត្រូវចាប់ (មុនកែ ៖ App ចាំថា «ចុចរួច» ➜ ទុកឲ្យ iOS ➜ ១៩៦pt)។
- ទិសផ្ទុយ ៖ iPad + mouse · ប្រអប់ដែល keyboard នឹងបាំង · ប៊ូតុង «បញ្ជូន» ក្បែរប្រអប់ · ប្រអប់ focus ហើយ keyboard បើក (ប្តូរ caret) · iPad keyboard អណ្តែត · Android ➜ ដូចមុន ·
  🔬 toast របស់ preview ត្រូវដកចេញ។

#### អ្នកយាម

`ZoeW/tests/ios-adjusted-tap-focus.test.ts` ៣៤ (ច្បាប់ WebKit ក្លែង ៖ touch ទៅធាតុក្រោមម្រាមដៃ · mousedown/click ទៅប្រអប់/ស្លាក · focus ចុងក្រោយមុនបង្ហាញ keyboard ឈ្នះ) —
មុនកែធ្លាក់ ១៨/៣៤ · mutation ៣៥ ➜ ចាប់ ៣៤ (នៅរស់ ១ ៖ blur មុន focus ដែលមានតាំងពីមុន ៖ ម៉ូដែល jsdom បែងចែកមិនបាន) · `ios-search-pulldown` (រង្វង់ import ៖ `app-lock.ts` មិន import
`modal-keyboard` ➜ boot ចង `appLockPinFocusOptions`) · suite iOS · modal · scanner · App Lock ២៥ ឯកសារ ៣៧២/៣៧២។ ការវាស់ ➜ ផ្នែក ២ A286។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **iPhone** ៖ Safari ➜ link preview របស់ PR ➜ Share ➜ **Add to Home Screen** (ឬបើករូបតំណាង preview ចាស់ ➜ «កំណែថ្មី» ➜ ផ្ទុកឡើងវិញ) ➜ ធ្វើដូចពេលទំព័ររុញ ៖ ចុចកន្លែងវាយ Barcode ច្រើនដង
   (ទាំងក្បែរប្រអប់ · ស្លាក · ⚡) ក្នុងរបៀប ៣ · ✓ · ∨ ភ្លាមៗ · ស្វែងរកលើទំព័រទិន្នន័យ និង tab ស្កេន · ចាក់សោ ➜ ត្រឡប់ចូល ➜ ចុច PIN · ទៅ App ផ្សេង ➜ ត្រឡប់ ➜ ចុច Barcode ➜
   ទំព័រ និង navbar មិនរុញ ➜ ប្រាប់ · នៅរុញ ➜ ប្រាប់ទំព័រ · របៀប · អ្វីដែលបានចុច។
2. ⛔ **merge បន្ទាប់ PR #348** ហើយ CI ៤ ផ្នែកបៃតង · ⛔ គ្មាន rules · SQL · env។

### [2.50.143] — 2026-10-24 · ZoeW ៖ iPhone (deploy preview តែប៉ុណ្ណោះ) ៖ ឧបករណ៍វាស់ពេលទំព័រស្កេនរុញឡើង — toast 🔬 (A285)

**ZoeW** (`zoew-v406` ➜ `zoew-v407`)។ ⛔ **ZoeKeyGen មិនប្រែ** · Android native · rules · SQL · Function មិនប្រែ · ⛔ ឥរិយាបថ App លើ production មិនប្រែ (probe រត់តែលើ
host `deploy-preview-<N>--zoew.netlify.app` + App លើ Home Screen iOS)។ រាយការណ៍ម្ចាស់គម្រោង ៖ «ios រុញទំព័រទៅលើម្តងម្កាល តែmodal រអិល smooth ហើយ សូមពិនិត្យ ios pwa» ·
ចុចកន្លែងវាយលើកដំបូង «ជូនធម្មតា ជូនរុញទំព័រទៅលើ ជាពិសេសក្នុង tab ស្កេន ចុចក្នុងកន្លែងបញ្ចូល barcode ៤-៥ដង អីរុញម្តង ហើយអំឡុងពេលវាកំពុងរុញ ចុចក្នុងប្រអប់ស្វែងរក
កាន់តែរុញថែម» · «វាអត់ចូលពីក្រោម navbar វារុញទាំងnavbar ទៅផុត» · App ផលិតកម្ម 2.50.141 ក៏រុញដែរ · រូបថតអេក្រង់ ២ · ការសម្រេច ៖ PR ថ្មី · វាស់មុនកែ។

#### អ្វីដែលខុសពីមុន

- 🔬 **iPhone · App លើ Home Screen · deploy preview តែប៉ុណ្ណោះ** ៖ ទំព័រទាំងមូល (navbar រួម) រុញ ≥ `PUSH_PROBE_MIN_PX` ខណៈគ្មានម្រាមដៃលើអេក្រង់ និងគ្មានប្រអប់បើក ➜
  ក្រោយ `PUSH_PROBE_SETTLE_MS` toast «🔬 ទំព័ររុញ …» (នៅ `PUSH_PROBE_TOAST_MS`) ប្រាប់ ៖ ចំនួនរុញខ្ពស់បំផុត · visual viewport · document · កម្ពស់ keyboard ពេលនេះ ·
  ស្ថានភាពកន្លែងវាយ Barcode ពេលចុចចុងក្រោយ (`បាកូដ` ៖ របៀប · focus · keyboard · ចុចរួច · ការ focus ត្រូវបដិសេធ · ប្រអប់បើក · ផ្ទាំងបង្រួម · ការប៉ាន់ «នៅពីលើ keyboard» ·
  ការលើក `#appPages` · keyboard ដែលចាំ · បាតប្រអប់) · ព្រឹត្តិការណ៍ចុងក្រោយ `PUSH_PROBE_TAPE_MAX` (`ts` ចុច · `te` លែងដៃ ms Δ cancelable prevented · `md`/`ck` សំយោគ ·
  `fo`/`bl` · `kb` · `vs` · `ws`) ជាមួយ ms ធៀបនឹងការរុញ ➜ ម្ចាស់គម្រោងថតអេក្រង់ផ្ញើមក។ រុញថែម ≥ `PUSH_PROBE_STEP_PX` (ឧ. ចុចស្វែងរកពេលកំពុងរុញ) ➜ toast មួយទៀត ·
  ⛔ មិនប្តូរការចាប់ · focus · ចលនា · scroll (listener `passive` ទាំងអស់) · មិនផ្ញើទៅណា (Sentry មិនទទួល preview) · host ផលិតកម្ម · Android · កុំព្យូទ័រ ➜ គ្មាន listener។

#### អ្នកយាម

`ZoeW/tests/ios-push-probe.test.ts` ៩ (ជាមួយ `listenModalKeyboard()` ពិត ៖ ចុចយូរ ➜ `p0` · ចុចដែល App ចាប់ ➜ `p1` + focus មុន mousedown · Δ14 · `c0` · ប្រអប់ដែល keyboard
នឹងបាំង `a0` · ស្លាក/⚡ `bc~` · រុញជាជំហាន ➜ toast មួយ · ចុចស្វែងរកពេលរុញ ➜ toast ទីពីរ · រុញហើយត្រឡប់ ០ · ទិសផ្ទុយ ៖ host ផលិតកម្ម · មិនមែន Home Screen · ម្រាមដៃ ·
ប្រអប់បើក · ក្រោម `PUSH_PROBE_MIN_PX` · passive · dispose) — mutation ១៥ ➜ ចាប់ ១៥ · `state-hygiene` (`pushProbe`)។ ការវាស់ ➜ ផ្នែក ២ A285។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. ⛔ **កុំ merge កំណែនេះតែឯង** ៖ ជាឧបករណ៍វាស់ ➜ លទ្ធផលពី iPhone ពិតមកដល់ ➜ ការកែចំផ្លូវដែលវាស់បាន + ដក probe ក្នុង PR ដដែល ទើបពិនិត្យ merge (បន្ទាប់ពី PR #348)។
2. **iPhone** ៖ Safari ➜ link preview របស់ PR ➜ Share ➜ **Add to Home Screen** ➜ បើកពីរូបតំណាង ➜ Login ➜ ទំព័រស្កេន ➜ ធ្វើដូចពេលទំព័ររុញ (ចុចកន្លែងវាយ Barcode ច្រើនដង ·
   ✓ · ចុចម្តងទៀត · ប្តូររបៀប · ស្វែងរក) ➜ ទំព័ររុញ ➜ toast 🔬 លេចក្នុងកន្លះវិនាទី ➜ ថតអេក្រង់ (toast នៅ ៣០ វិ.) ➜ ផ្ញើមក · toast ច្រើន ➜ ផ្ញើទាំងអស់ ·
   ទំព័ររុញតែគ្មាន toast ➜ ប្រាប់ (ផ្លូវផ្សេងពីអ្វីដែល probe មើល)។ ⛔ ប្រើរូបតំណាង preview សម្រាប់សាកតែប៉ុណ្ណោះ។

### [2.50.142] — 2026-10-23 · ZoeW ៖ ប្រអប់រអិលរលូនស្របជាមួយ keyboard — compositor · ល្បឿនបន្ត · ពេលវេលា IME Android (A282)

**ZoeW** (`zoew-v405` ➜ `zoew-v406`)។ ⛔ **ZoeKeyGen មិនប្រែ** · Android native (`MainActivity`) · rules · SQL · Function មិនប្រែ។ សំណើម្ចាស់គម្រោង ៖
«អោយគ្រប់ modal ទាំងអស់ពេលបើក keyboard អោយមានចលនារអិល smooth ស្របជាមួយ keyboard កុំអោយអាក់អាក់ ទាំង PWA ios android, apk និងគ្រប់ទំហំអេក្រង់ អោយឆ្លាតវៃ»។

#### អ្វីដែលខុសពីមុន

- **ចលនាកាតរត់លើ compositor** ៖ ចលនារអិលកាតប្រើ `composite: 'add'` ដែល Chromium មិនដាក់លើ compositor (trace ៖ `compositeFailed` 80) ➜ ចលនារត់លើ main thread
  ព្រមគ្នានឹង React · layout · `visualViewport` resize ពេល keyboard លោត ➜ ស៊ុមធ្លាក់ (អាក់)។ ឥឡូវ `replace` · keyframes មានតែ `transform` ➜ trace ៖ `compositeFailed` ០
  លើ APK · Chrome Android · iPhone · iPad · `add` នៅតែពេល animation ផ្សេងកំពុងរត់លើកាត (pop-in ពេលប្រអប់ទើបបើក)។
- **keyboard ប្តូរកម្ពស់កណ្តាលចលនា** (ឧ. Android ប្រកាសកម្ពស់ keyboard មុន រួចកម្ពស់ពិត · អក្សរ ↔ លេខ) ៖ ចលនាថ្មីចាប់ពីទីតាំង **និងល្បឿន** ដែលកាតកំពុងមាន
  (មុនកែ ៖ ល្បឿនលោតភ្លាម ×1.75–×2.9 = ឈប់ហើយស្ទុះ) · មិនហួសគោលដៅ · មិនថយក្រោយ។
- **Android (APK · Chrome)** ៖ កាតរអិល 285ms តាមខ្សែកោង `cubic-bezier(0.2, 0, 0, 1)` = ពេលវេលា IME របស់ Android (`InsetsController`) ➜ ស្របល្បឿន keyboard ·
  iPhone · iPad · កុំព្យូទ័រ ៖ 250ms ដដែល។
- **ផ្ទៃងងឹតក្រោយ keyboard** ៖ លែងលេចភ្លាមៗពីលើបាតកាតខណៈកាតកំពុងរអិល (មុនកែ ៖ បាំងបាតកាតរហូត 69px នៅស៊ុមដំបូង) ➜ រអិលឡើងពីបាតអេក្រង់ជាមួយ keyboard
  ដោយពេលវេលាដូចកាត ➜ មិនដែលកាត់បាតកាត · នៅពីលើកាតដដែល (គ្របស្រមោលកាត ➜ keyboard ថ្លារបស់ iPhone នៅពណ៌តែមួយ)។
- ទិសផ្ទុយ ៖ «បន្ថយចលនា» (Reduce Motion) ➜ ទៅកន្លែងភ្លាមដូចមុន · ប្រអប់ថ្មីបើកខណៈ keyboard បើក ➜ ផ្ទៃងងឹតមិនរអិល · browser គ្មាន `KeyframeEffect.pseudoElement`
  ➜ ផ្ទៃងងឹតនៅនឹង (មិនរំកិល backdrop ទាំងមូល)។
- **APK ៖ ចុចកន្លែងវាយក្នុងប្រអប់ (ឧ. Barcode ក្នុង Sign · ZTO)** (រាយការណ៍ម្ចាស់គម្រោងលើ APK សាក `2.50.142-test.2e332ab` ៖ «វាកន្ត្រាក់រុញឡើងទាំងទំព័រមួយភ្លែត»
  · Chrome Android ៖ រលូនល្អ) ៖ ទំព័រទាំងមូលលែងរុញឡើង ➜ APK ចាប់ការចុច (focus `preventScroll` ៖ WebView លែងរំកិលទំព័រទៅរកប្រអប់វាយ) ហើយ App រមូរប្រអប់វាយ
  ចូលក្នុងកាតខ្លួនឯង · ចុចលើកដំបូង caret នៅចុងអត្ថបទ (ចុចម្តងទៀតពេល keyboard បើក ➜ caret តាមកន្លែងចុច) · Chrome Android មិនប្រែ (A283)។

#### អ្នកយាម

`ZoeW/tests/modal-keyboard.test.tsx` +៩ (ចលនា ៖ មុនកែធ្លាក់ ៨/៥៧ · APK ចុចប្រអប់វាយ ៖ មុនកែធ្លាក់ ១/៥៨ · ក្រោយកែ ៥៨/៥៨) · `modal-keyboard-device-test` (ឆ) ៖
trace Chromium `compositeFailed` · ពេលវេលាតាមវេទិកា · ផ្ទៃងងឹតមិនកាត់បាតកាត · ល្បឿនបន្តលើ Web Animations ពិត (មុនកែធ្លាក់ ៩ · ក្រោយកែ ២៧/២៧) · (ឋ) APK · Sign ZTO ៖
ចុចត្រូវចាប់ (focus `preventScroll`) · keyboard បើក ➜ ចុច Barcode ដែលលេចតែគែមលើ ➜ App រមូរវាចូលក្នុងកាត · `state-hygiene` (state ថ្មី `keyboardLayer` · `layerGlide`)។
ការវាស់ ➜ ផ្នែក ២ A282 · A283។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **គ្មាន rules · គ្មាន SQL · Function មិនប្រែ** ➜ គ្មានលំដាប់មុន merge · ពិនិត្យ PR និង CI ៤ ផ្នែកមុន merge។
2. **ឧបករណ៍** (ក្រោយ merge) ៖ PWA ៖ របារ «កំណែថ្មី» · APK ៖ 🔔 ➜ 📥 ដំឡើង 2.50.142។
3. **ផ្ទៀងលើឧបករណ៍ពិត** (iPhone PWA · Android Chrome PWA · APK · tablet) ៖ បើកប្រអប់មានកន្លែងវាយ (PIN · ផ្ទាំងលេខទូរស័ព្ទ · API ស្វែងរកអតិថិជន · បញ្ចូលច្រើន ·
   Sign · ZTO) ➜ ចុចកន្លែងវាយ ➜ កាត និងផ្ទៃងងឹតរអិលព្រមគ្នាជាមួយ keyboard មិនអាក់ · ប្តូរអក្សរ ↔ លេខ ➜ បន្តរអិល មិនឈប់ហើយស្ទុះ · Done ➜ ចុះវិញរលូន។
   Chromium ក្លែង keyboard មិនជំនួស IME ពិតរបស់ WebKit/Android បានទេ ➜ បើកាតលឿន ឬយឺតជាង keyboard ប្រាប់ (`MODAL_GLIDE_MS` · `MODAL_GLIDE_ANDROID_MS`)។
4. **APK ថ្មី · Sign · ZTO** ៖ ចុចកន្លែងវាយ Barcode (និងឈ្មោះអ្នកទទួល) ➜ ទំព័រមិនរុញឡើង · keyboard បើកហើយចុច Barcode ដែលនៅបាតកាត ➜ វារមូរចូលមើលឃើញ ·
   ចុចម្តងទៀតលើអត្ថបទដែលមានស្រាប់ ➜ caret តាមកន្លែងចុច។

### [2.50.141] — 2026-10-23 · ZoeW ៖ ប្រអប់ Sign · ZTO ពេល keyboard រំកិលផ្ទៃ APK

**ZoeW** (`zoew-v405`)។ វីដេអូពីម្ចាស់គម្រោងលើ **APK · Xiaomi 14 Ultra** បង្ហាញប្រអប់ Sign · ZTO លោតពេលបើក keyboard និងប្ដូរវាលឈ្មោះទៅ barcode។

- ពេល Android បង្រួម WebView រួច ហើយ visual viewport រំកិលបន្តិច ប្រអប់គិតទីតាំងតាមផ្ទៃដែលមើលឃើញ។ ប្រើកម្ពស់ WebView ដែលបង្រួមរួច ដើម្បីមិនដកកម្ពស់ keyboard ចាស់ពីរដង។
- ការរំកិល offset ជាបន្តបន្ទាប់រក្សាកាតនៅទីតាំងដដែលលើអេក្រង់; វាលដែលកំពុងវាយនៅអាចរមូរប្រើបាន។
- អ្នកយាម៖ `ZoeW/tests/modal-keyboard.test.tsx` និង `modal-keyboard-device-test` បើក Sign form ពិត រួមវាលឈ្មោះ និង barcode លើទំហំទូរស័ព្ទ/tablet។

**សកម្មភាពដោយដៃ**៖ សាក APK ថ្មីលើ Xiaomi 14 Ultra ដោយបើក Sign · ZTO, ចុចឈ្មោះ/Barcode ឆ្លាស់គ្នា, បិទ/បើក keyboard និងរមូរកាត។ ពិនិត្យ PR និង CI មុន merge។ ការសាកក្នុង Chromium ដែលក្លែង keyboard មិនអាចបញ្ជាក់ចលនា IME ពិតរបស់ឧបករណ៍បានទាំងស្រុង។ មិនត្រូវការ SQL migration ឬ Firebase rules ថ្មី។

### [2.50.140] — 2026-10-23 · ZoeW + ZoeKeyGen `2.24.24` ៖ Deep audit — modal · សំណើស្ទួន · ស្ថិតិ · ការសង្គ្រោះប្រាក់

**ZoeW** (`zoew-v404`) · **ZoeKeyGen** (`zoekeygen-v135`)។ សំណើម្ចាស់គម្រោង៖ ពិនិត្យចលនា និង flow ប្រចាំថ្ងៃទាំងពីរ App លើ PWA iOS/Android, APK, tablet និង computer ព្រមទាំងប្រាក់/ចំនួនពេលសកម្មភាពស្ទួន។

#### ការកែដែលមានភស្តុតាងមុន/ក្រោយ

- **លទ្ធផលប្រាក់មិនច្បាស់លាស់**៖ `unknown` មិនត្រូវបានគិតជាសូន្យដើម្បីបូក/ដកបំពេញទៀតទេ។ ការផ្ទៀងថ្ងៃ/ខែផ្អាកការសរសេរដែលផ្អែកលើការស្មាន ទាំងសំណើដើម និងសំណើកែ; ស្ថានភាព pending និងចំនួនដែលបញ្ជាក់បាននៅតែរក្សា។ មុនកែ daily $10 ➜ $15 ដែលបាត់ ACK អាចបូកឡើង $20 ខណៈ monthly $15 ហើយរាយតែ warning។
- **ប្រាក់ Supabase**៖ កំណត់ត្រា companion recovery រក្សាទុករហូតដល់ transaction បញ្ជាក់ commit ឬ token បញ្ជាក់ថាអនុវត្តរួច។ មុនកែ បិទ adapter ក្រោយសម្រេច follow-up តែមុនផ្ញើ អាចបាត់កំណត់ត្រាជួសជុលទាំង apply/undo។ តេស្តរួមការបដិសេធ ការឆ្លើយយឺត និង replay ក្រោយ reload។
- **កែស្ថិតិដោយដៃ**៖ បើក modal ឡើងវិញមិនដោះ busy របស់សំណើរង់ចាំ។ Session reset ដោះស្ថានភាពចាស់ ហើយ callback ចាស់មិនប៉ះសំណើថ្មី។ លទ្ធផលមិនពេញលេញមិនណែនាំឱ្យចុចបូក/ដកម្តងទៀតដោយមិនពិនិត្យ។ Input ដែល browser សម្គាល់ `badInput`, លេខមិន finite/ធំពេក និងចំនួនប្រភាគ ត្រូវបដិសេធមុនសរសេរ។
- **លេខទូរស័ព្ទ និងស្ថិតិយក**៖ ការរក្សាទុកតម្លៃដូច local view នៅតែ reconcile ម្ចាស់ barcode ប្រសិនបើឧបករណ៍ផ្សេងបានកែលេខនៅ server។ តេស្តទាំងចម្លើយភ្លាម ចម្លើយយឺត និង no-op ក្រោយ Reset; rollback អានម្ចាស់ barcode ពី server ថ្មី ដើម្បីមិនសរសេរជាន់ឧបករណ៍ផ្សេង។
- **ZoeKeyGen សំណើគ្រប់គ្រង**៖ ចេញកូដអញ្ជើញ/ប្តូរពាក្យសម្ងាត់ និងពន្យារ/បិទហាង ប្រើ busy តែមួយចងទៅ session។ មុនកែ ការចុចពីរដងអាចបង្កើតកូដពីរ ហើយចម្លើយចាស់បង្ហាញកូដ reset ដែលលែងប្រើបាន។
- **ZoeKeyGen modal**៖ ផ្ទៃខាងក្រោយមិនរមូរពេល modal បើក; មាតិកាខាងក្នុងរមូរបាន ហើយបិទ modal ចុងក្រោយទើបផ្ទៃខាងក្រោយរមូរវិញ។ ប្រើ class ដោយមិនពឹង `:has`; Tab/Shift+Tab នៅក្នុងប្រអប់លើគេ ហើយ resize ពេលគ្មាន modal រក្សាទីតាំងទំព័រ។
- **ZoeW keyboard**៖ Tab/Shift+Tab រុំពីធាតុចុង/ដើមក្នុង modal មុន browser toolbar យក focus។ Browser checker មិនទទួល BODY ជាភស្តុតាងថា focus នៅក្នុង modal ទៀតទេ។
- **Excel**៖ ឈ្មោះឯកសារចាប់យកជាមួយទិន្នន័យ មុនរង់ចាំ XLSX; ប្តូរតម្រង ឬខែកណ្តាលពេលទាញ library មិនប្តូរឈ្មោះឯកសាររបស់ទិន្នន័យដើម។

#### អ្នកយាម

`ZoeW/tests/supabase-ledger-replay-companion.test.ts` · `ledger-unknown-no-retry.test.ts` · `manual-adjust-single-flight.test.ts` · `manual-adjust-number-browser.test.ts` · `phone-pickup-stale-view.test.ts` · `modal-focus-trap.test.ts` · `export-request-snapshot.test.ts` · `keygen-supabase-admin-test` · `keygen-modal-scroll-test` · `modal-keyboard-test`។ តេស្តថ្មីបង្ហាញកំហុសលើ source មុនកែ។

#### ព្រំដែននៃការផ្ទៀងផ្ទាត់ និងសកម្មភាពដោយដៃ

- លទ្ធផល ledger ដែល server បដិសេធការអាន ឬបាត់ភស្តុតាង token នៅតែជា **unknown**។ ការកែនេះទប់ delta ស្មានថ្មី និងរក្សា warning; សំណើដើមអាចបាន commit តែផ្នែកខ្លះ ហើយត្រូវផ្ទៀងផ្ទាត់ភស្តុតាង/ស្ថិតិមុនកែម្ដងទៀត។ ការធានា end-to-end គ្រប់កាលៈទេសៈនៅត្រូវការ receipt តាម operation ID ដែលរក្សារហូតដល់ settle លើ backend ទាំងពីរ។
- ពិនិត្យ PR និង CI ៤ ផ្នែក មុនសម្រេច merge។ ការកែនេះមិនត្រូវការ SQL migration ឬ Firebase rules ថ្មី។
- សាកលើឧបករណ៍ពិត៖ iPhone PWA, Android PWA/APK, tablet និង computer — បើក/បិទ modal, keyboard, scroll/tab bar, ចុចស្ទួនពេលបណ្ដាញយឺត និងសង្គ្រោះក្រោយបិទ app។ Chromium និង native bridge ក្លែងមិនជំនួសតេស្ត WebKit/APK ពិតទេ។

### [2.50.139] — 2026-10-23 · ZoeW + ZoeKeyGen `2.24.23` ៖ Deep audit — PIN · License · ស្ថិតិយក · បោះពុម្ព · camera · cache

**ZoeW** (`zoew-v402` ➜ `zoew-v403`) · **ZoeKeyGen** (`zoekeygen-v133` ➜ `zoekeygen-v134`)។ ការកែទាំងអស់មាន regression បរាជ័យមុនកែ។ មិនកែច្បាប់លុប/ដក · Firebase rules · SQL migration ឬតំបន់ ZTO/PTR/scroll ដែលចាក់សោទេ។

#### អ្វីដែលខុសពីមុន

- **PIN និងក្រយៅដៃ/មុខ**៖ ការបោះបង់ បើកប្រអប់ថ្មី ប្តូរ PIN ឬ «ភ្លេច PIN» ខណៈផ្ទៀងផ្ទាត់មិនទាន់ចប់ លែងអនុញ្ញាតឱ្យលទ្ធផលចាស់បើក Config ឬសិទ្ធិរបស់វគ្គថ្មី។ ការកំណត់ PIN ដំបូងដែលបោះបង់មុន commit មិនសរសេរ PIN។
- **ស្ថិតិយកកញ្ចប់លើឧបករណ៍ច្រើន**៖ ការជួសជុលទិន្នន័យចាស់រក្សា barcode និងម្ចាស់លេខទូរស័ព្ទដែល server មានរួច ទោះចំនួននៅដដែល។ ការផ្ទេរ placeholder `_lg_` នៅដំណើរការ ហើយ transaction ត្រូវឃើញ record ដើម និងវគ្គដើម។
- **Supabase**៖ tab ដែលខក storage event ចាកចេញ បញ្ចប់ session នៅពេលអាន token; refresh token បរាជ័យបណ្តោះអាសន្នដែល session នៅក្នុង storage មិនត្រូវបានរាប់ជាការចាកចេញ។
- **ZoeKeyGen**៖ ចម្លើយបញ្ជី Key/ហាងចាស់មិនសរសេរជាន់ refresh ថ្មី ឬបង្ហាញកំហុសជាន់បញ្ជីថ្មី។
- **PDF និងស្លាក**៖ ការបោះពុម្ពបរាជ័យប្រគល់ផ្ទាំង និងចំណងជើងដើមវិញ; callback ពីការបោះពុម្ពចាស់មិនបិទ report ថ្មី ឬបើក print dialog ក្រោយវគ្គបញ្ចប់។
- **Service Worker របស់ ZoeKeyGen**៖ HTML fallback ដែល server ឆ្លើយ 200 មិនត្រូវបានរក្សាជា JS/CSS/icon នៅពេល install, revalidate ឬ cache miss។
- **ចុះឈ្មោះ/កំណត់ពាក្យសម្ងាត់ថ្មី**៖ body លើសទំហំឆ្លើយ 413 ដោយមិនរង់ចាំ stream cancellation ដែលអាចព្យួរ។
- **Activation Key ក្នុង App ទាំងពីរ**៖ activation ចាស់មិនជាន់ Key/activation ថ្មី ឬស្តារ record ដែលបាន deactivate; ការធ្វើបច្ចុប្បន្នភាពម៉ោងធម្មតារបស់ getStatus មិនលុបសិទ្ធិរបស់ activation ដែលកំពុងរង់ចាំ។
- **កាមេរ៉ា**៖ លទ្ធផល decode ពី stream ចាស់មិនចូលបញ្ជាក់ barcode ឬចាប់ផ្តើម loop វិញ ក្រោយបិទ/បើក camera ថ្មី។

#### អ្នកយាម

`ZoeW/tests/pin-flow-race.test.ts` · `ZoeW/tests/pickup-repair-race.test.ts` · `ZoeW/tests/supabase-cross-tab-signout.test.ts` · `ZoeW/tests/supabase-auth-unavailable.test.ts` · `ZoeW/tests/print-relayout.test.tsx` · `ZoeW/tests/native/print-operation.test.ts` · `ZoeW/tests/sw-revalidation-timeout.test.ts` · `ZoeW/tests/scan-camera-session.test.ts` · `keygen-session-security-test` · `license-record-race-test` · `supabase-functions-test`។ ភស្តុតាងមុន/ក្រោយ ➜ ផ្នែក ២ A273–A281។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ពិនិត្យ PR និង CI ៤ ផ្នែក មុនសម្រេច merge; ការកែនេះមិនបាន merge ឬ deploy ផលិតកម្មដោយ session audit ទេ។
- ក្រោយ merge ដែលបានអនុញ្ញាត៖ ផ្ទៀង Netlify deploy របស់ App ទាំងពីរ និង Supabase GitHub deployment របស់ `register` · `reset-password`។ បើមិនប្រើ GitHub integration ត្រូវ deploy Edge Functions ទាំងពីរតាម `supabase/README.md`។ គ្មាន Firebase rules ឬ SQL ដែលត្រូវ Publish។
- សាកលើ iPhone PWA និង Android ពិត៖ បោះបង់ PIN/biometric កំពុងផ្ទៀងផ្ទាត់ · ភ្លេច PIN ពេលរង់ចាំ · បិទ/បើក camera ពេល decode · PDF/ស្លាកបរាជ័យ/ត្រឡប់ពី print dialog។ Browser និង plugin ក្លែងមិនជំនួសការសាកឧបករណ៍ពិតទេ។

### [2.50.138] — 2026-10-23 · ZoeW ៖ ទាញបញ្ជី ZTO Palm កាត់ទំព័រ hint ចាស់តាមចម្លើយទំព័រដំបូងដែលមកដល់ (A272)

**ZoeW** (`zoew-v401` ➜ `zoew-v402`)។ ⛔ **ZoeKeyGen មិនប្រែ** · Netlify Function មិនប្រែ · rules មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- **ទាញបញ្ជីកញ្ចប់ពី ZTO តាម ZTO Login (Palm)** (សំណើម្ចាស់គម្រោង ៖ «PR ថ្មីក្រោយ #343» ➜ កែ `src/features/zto-list-sync.ts` ក្នុងតំបន់ ZTO ចាក់សោ)៖ App អានទំព័រ ២.. ភ្លាមតាមចំនួនទំព័រដែលការទាញមុនឃើញ (hint) ➜ ពេលបញ្ជីខ្លីជាង hint ចម្លើយទំព័រណាក៏ដោយដែលមកដល់មុន (មិនចាំតែទំព័រ ១) កាត់ទំព័រ hint ដែលលើសចំនួនដែល ZTO រាយការណ៍ ➜ ទំព័រ ១ ឆ្លើយយឺត ➜ App លែងបន្តអានទំព័រទទេ (វាស់ ៖ hint ១២០ ទំព័រ · ទំព័រ ១ យឺត ៖ ការអានបញ្ជី ZTO ៥៨–៦៤ ➜ ១៦–១៨ · ការហៅ Function ៣៧–៦២ ➜ ១៦–៤៣) · tab ដែលមិនទាន់មានចម្លើយណារាយការណ៍ចំនួន រក្សា hint រហូតទំព័រ ១ ឆ្លើយ · ក្រោយទំព័រ ១ ឆ្លើយ ដូចមុនទាំងស្រុង · បញ្ជី · track · ការនាំចូលមិនប្រែ។

#### អ្នកយាម

`ZoeW/tests/zto-palm-list-e2e.test.tsx` «⏱ hint ចាស់ 120 ទំព័រ · ទំព័រ ១ ឆ្លើយក្រោយទំព័រ speculative» (stock 0 · 950 ៖ មុនកែធ្លាក់ ២/២) · `ZoeW/tests/zto-lock.test.ts` (`LOCK` ថ្មីរបស់ `zto-list-sync.ts`)។ ការវាស់ ➜ ផ្នែក ២ A272។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **គ្មាន rules · គ្មាន SQL** (Firebase · Supabase មិនប្រែ) · Function មិនប្រែ ➜ គ្មានលំដាប់មុន merge។
2. **ឧបករណ៍** (ក្រោយ merge) ៖ PWA ៖ របារ «កំណែថ្មី» · APK ៖ 🔔 ➜ 📥 ដំឡើង 2.50.138។
3. **ផ្ទៀងលើឧបករណ៍ពិត** (ស្រេចចិត្ត) ៖ ទាញបញ្ជីតាម ZTO Login លើចន្លោះ ១ ថ្ងៃ បន្ទាប់ពីការទាញចន្លោះ ៧ ថ្ងៃ ➜ បញ្ជីគ្រប់ · ⏱ មិនយឺតជាងការទាញលើកដំបូង។

### [2.50.137] — 2026-10-22 · ZoeW ៖ ឧបករណ៍ក្នុងសាខាផ្លាស់វេនអាន Sign ពី ZTO · Palm Login ឡើងវិញដោយខ្លួនឯង · Cookie ទុកការភ្ជាប់ (A264 · A265 · A266 · A267 · A268 · A269)

**ZoeW** (`zoew-v400` ➜ `zoew-v401`)។ Netlify Function `zto-order-detail` (A264 · A265) ចេញជាមួយ merge ដដែល។

#### អ្វីដែលខុសពីមុន

- **ឧបករណ៍ក្នុងសាខាផ្លាស់វេនគ្នាអាន Sign ពី ZTO** (ជម្រើស ឃ · សំណើម្ចាស់គម្រោង «បើក PR ហើយធ្វើជម្រើស ឃ»)៖ ហាង Firebase តែប៉ុណ្ណោះ (ការសម្រេចម្ចាស់គម្រោង ៖ ហាង Supabase អានដូចមុន ព្រោះការកក់នីមួយៗធ្វើឲ្យគ្រប់ទូរស័ព្ទទទួលសារ Realtime) ៖ ឧបករណ៍ ZTO ក្នុងសាខាតែមួយ (Palm ៖ លេខសាខា · Cookie ៖ ដែនអ៊ីមែលគណនី) កក់វេនលើ `zoew_settings/zto_sweep_lead/<សាខា>` មុនអានបញ្ជី Sign ➜ ឧបករណ៍ពីរមិនអានព្រមគ្នា ហើយសាខាអានរៀងរាល់ ល្បឿនឧបករណ៍ ÷ ចំនួនឧបករណ៍ដែលកំពុងចង់អាន (មិនតិចជាង ៥ វិ.) ➜ Sign ក្នុង ZTO ➜ ZoeW បិទឆាប់តាមចំនួនឧបករណ៍ (ឧបករណ៍ ៣ កំពុងប្រើ ៖ ≤ ~៧ វិ.) · ឧបករណ៍នីមួយៗមិនអានញឹកជាងមុន ➜ ការហៅ Function មិនលើសមុន · ឧបករណ៍តែមួយ = ដូចមុនទាំងស្រុង · rules មិនទាន់ Publish ឬ DB មិនឆ្លើយ ➜ ឧបករណ៍អានដោយខ្លួនឯងដូចមុន · ការពិនិត្យ `/detail` (របារ «ZTO មិនទាន់បិទ» · កញ្ចប់បើកម៉ោងម្តង) នៅតាមឧបករណ៍ដូចមុន · ឧបករណ៍ដែលការរង់ចាំ ៨ ថ្ងៃកំពុងរង់ចាំ អានដោយខ្លួនឯង (មិនទុកវេន) · ឧបករណ៍អានដាក់ភស្តុតាង Sign លើគ្រប់កញ្ចប់បិទដែលបញ្ជី Sign ប្រាប់ម៉ោង Sign (Cookie) ហើយសរសេរត្រាភ្លាម ➜ របារ «ZTO មិនទាន់បិទ» និងការហាមបើកវិញលើឧបករណ៍ផ្សេងតាមការអាននោះ · Palm (បញ្ជីគ្មានម៉ោង) ៖ តែកញ្ចប់ដែលឧបករណ៍អានធ្លាប់វាស់ «មិនទាន់» (A268) · ម៉ោង Sign ក្នុងបញ្ជីដែលមុនពេល restore កញ្ចប់ មិនបិទ និងមិនបង្វិលកញ្ចប់នោះ (`/detail` ស្ថានភាពបច្ចុប្បន្នសម្រេច · A269) · `guide.html` («🔄 បិទតាម ZTO ស្វ័យប្រវត្តិ») ពន្យល់ការផ្លាស់វេន។
- **ZTO Login របស់ហាង (A264 · A267 · A268 · A269)**៖ token ដែល ZTO លែងទទួល តែឆ្លើយជាការបដិសេធធម្មតា ➜ Function Login ឡើងវិញ ហើយសាកម្ដងទៀតដោយខ្លួនឯង ➜ បិទ App មួយយប់ ➜ 🩺 និងស្កេនដំណើរការដោយមិនវាយពាក្យសម្ងាត់ · session សាខាផ្សេងនៃហាងដែលចងច្រើនសាខាក៏ Login ឡើងវិញដូចគ្នាពេលអានបញ្ជី Sign ពេញលេញ · Login ដែល ZTO ឆ្លើយ `SYSTEM_ERROR` (ZTO ខូច) = «ZTO មិនឆ្លើយ» មិនមែន «គណនីត្រូវបដិសេធ» ➜ ZTO ល្អវិញ ➜ ដើរវិញដោយខ្លួនឯង (មិនបាច់វាយពាក្យសម្ងាត់) · សំណើដែលរង់ចាំ Login មិនបានយ៉ាងហោចណាស់ ២,៥ វិ. (`SHARED_RENEW_MIN_WAIT_MS`) មិនចាប់ផ្តើម Login ឡើងវិញ ➜ សំណើបន្ទាប់ Login (A268 · A269)។
- **ស្កេន Cookie (A265)**៖ Function ទុកការភ្ជាប់ទៅ ZTO ៦០ វិ. ដូច Palm ➜ ស្កេនឃ្លាតគ្នាលើស ៤ វិ. លែងបង់ TCP + TLS ថ្មី។

#### អ្នកយាម

`ZoeW/tests/zto-sweep-lane.test.ts` · `ZoeW/tests/zto-lock.test.ts` · `ZoeW/tests/zto-signed-cadence.test.tsx` · `ZoeW/tests/session-switch-fuzz.test.ts` · `emu/app-writes-rules-test` · `emu/supabase-rules-parity-test` · `ZoeW/tests/zto-palm-shared.test.ts` · `ZoeW/tests/zto-upstream-timing.test.ts` · `ZoeW/tests/zto-palm-server.test.ts` · `zto-list-sync-test`។ ការវាស់ ➜ ផ្នែក ២ A264 · A265 · A266 · A267 · A268 · A269។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **Firebase rules (មុន merge)** ៖ Publish `firebase-database.rules.json` ទៅ Firebase ហាងទាំងអស់ (ថ្មី ៖ `zoew_settings/zto_sweep_lead`) — Console ➜ Publish ឬ `tools/firebase-provision/deploy-rules.cmd` · rules License មិនប្រែ។ rules ថ្មីត្រឹមតែបន្ថែម node ➜ App ចាស់ (`2.50.136`) មិនប៉ះពាល់ (វាមិនសរសេរផ្លូវនេះ) · App ថ្មីលើ rules ចាស់ ➜ listener បដិសេធ ➜ ឧបករណ៍អានដូចមុន (គ្មានការផ្លាស់វេន) ➜ លំដាប់មិនធ្វើឲ្យខូចអ្វី តែ Publish មុន merge ដើម្បីឲ្យការផ្លាស់វេនដំណើរការភ្លាម។
2. **Supabase** ៖ គ្មានអ្វីត្រូវធ្វើមុន merge (ហាង Supabase មិនផ្លាស់វេន ➜ មិនសរសេរ ឬអាន `zto_sweep_lead`) · ពេល merge GitHub integration ដាក់ `supabase/migrations/20261022043452_zoe_rules.sql` (`create or replace` · ស្មើ rules JSON) · ក្រោយ merge ពិនិត្យ ✓ Supabase លើ merge commit។
3. **ឧបករណ៍** (ក្រោយ merge) ៖ ធ្វើបច្ចុប្បន្នភាពឧបករណ៍ ZTO (PWA ៖ របារ «កំណែថ្មី» · APK ៖ 🔔 ➜ 📥) ➜ ការផ្លាស់វេនកើតតែរវាងឧបករណ៍ថ្មី · ឧបករណ៍ចាស់អានដូចមុន មិនរារាំងអ្វី។
4. **ផ្ទៀងលើឧបករណ៍ពិត** ៖ ហាង Firebase ៖ ទូរស័ព្ទ ២–៣ គ្រឿងក្នុងសាខាតែមួយបើក App ➜ Sign កញ្ចប់មួយក្នុង ZTO (ក្រៅ ZoeW) ➜ ZoeW បិទក្នុងប៉ុន្មានវិនាទី · Netlify Usage ៖ ការហៅ `zto-order-detail` មិនកើន · ព្រឹកក្រោយបិទ App មួយយប់ ៖ 🩺 ZTO Login ✅ ដោយមិនវាយពាក្យសម្ងាត់ (A264) · 🩺 `?diag=1` `upstreamTiming.scans.argus` ៖ ស្កេនលើការភ្ជាប់បើករួចលឿនជាងការភ្ជាប់ថ្មី ហើយ `timeouts` មិនកើន (A265)។

### [2.50.136] — 2026-10-20 · ច្បាប់ធុងសំរាមទូទាំងហាង · ភស្តុតាង Sign · ផ្លូវ Lookup Google Sheet (A261 · A262)

**ZoeW** (`zoew-v399` ➜ `zoew-v400`)។ **ZoeKeyGen** `2.24.21` ➜ `2.24.22` (`zoekeygen-v132` ➜ `zoekeygen-v133`)។

#### អ្វីដែលខុសពីមុន

- ZTO Login៖ កញ្ចប់ចូលធុងសំរាមហើយហាមស្តារគ្រប់មូលហេតុ។ Pickup cleanup រាប់ ២ ម៉ោងពី Sign ពិត។ Cookie៖ បិទក្នុង ZoeW និង ZTO Sign ពិត ➜ ចូលធុងសំរាមភ្លាម · កញ្ចប់ Sign ពិតហាមស្តារ។
- **ច្បាប់ទូទាំងហាង** (សំណើម្ចាស់គម្រោង «ទូទាំងហាង» · ការសម្រេច «ត្រាតាមឧបករណ៍»)៖ ឧបករណ៍ ZTO នីមួយៗសរសេរត្រារបស់ខ្លួន `zoew_settings/zto_trash_mode/{palm|cookie}/<សោឧបករណ៍>`; ឧបករណ៍ដែលមិនភ្ជាប់ ZTO អនុវត្តរបៀបតឹងបំផុតដែលសកម្មក្នុង ៧ ថ្ងៃ (Palm លើ Cookie · ត្រាចាស់ `palmAt`/`cookieAt` នៅរាប់)។ សញ្ញាមិនទាន់មក ➜ សម្អាតស្វ័យប្រវត្តិ និងស្តារត្រូវរង់ចាំ។ ឧបករណ៍ចាកពី Palm ដកតែត្រារបស់ខ្លួន (ឧបករណ៍ Palm ផ្សេងនៅរក្សារបៀបហាង) · rules មិនទាន់ Publish ➜ ផ្អាកការសរសេរត្រា ៦ ម៉ោង មិនរារាំងការសរសេរផ្សេង · ការដកត្រាដែលព្យួរពេលប្តូរ Database ឬចូលគណនីឡើងវិញ លែងរារាំងការដកត្រារបស់ session ថ្មី។
- Restore៖ Cookie សួរ ZTO ថ្មីមុនស្តារ · ជួរដែលកំពុងស្តារមិនអាចបិទ/បើក · Restore ដែលបោះចោលហើយ lease អស់ ត្រូវបោះបង់ដោយស្វ័យប្រវត្តិ តែពេលកញ្ចប់មានភស្តុតាង Sign ឬត្រឡប់ (របៀប Palm របស់ឧបករណ៍តែម្នាក់ឯងមិនបង្កក) · 🛠️ (PIN) ដោះការស្តារដែលជាប់ ដោយដកតែ Barcode ដែលការស្តារដាក់ចូល មិនបូកប្រាក់វិញ · ជួរដែល Restore ផ្សេងរៀបចំរួចមិនត្រូវយកជាគោលដៅ។
- ZTO Sign៖ កញ្ចប់បិទ «មិនទាន់ Sign» ត្រូវសួរម្ដងទៀតរៀងរាល់ម៉ោង ហើយនៅក្នុងរបាទោះ ZTO ឆ្លើយមិនច្បាស់ · ម៉ោង Sign ពិតមិនបាត់ពេលបើក App មុនម៉ោង server មក។
- Lookup Google Sheet៖ តារាងអតិថិជនចាស់ជាង ១០ នាទីមិនឆ្លើយពេលមានអ៊ីនធឺណិត (សួរ Sheet ផ្ទាល់) · ជួរ Excel មិនឆ្លើយពេល Lookup ជា ZTO · នាំចូល «បន្ថែមថ្មី + កែអ្វីដែលប្រែ» ដែលមាន Column «— មិនប្រើ —» ត្រូវការអ្នកសរសេរ v3 ឡើង (រក្សាតម្លៃចាស់ក្នុង Sheet) · អស់ពេលរង់ចាំ ➜ «មិនទាន់ដឹងលទ្ធផល»។
- Setup Link (ZoeKeyGen)៖ `key=` របស់ Apps Script ត្រូវរុំដោយកូដ ៦ ខ្ទង់ ហើយនៅក្នុងវាល URL រហូតដល់បង្កើតជោគជ័យ · URL ដែលមានឈ្មោះ secret ក្នុង query (រួមទាំងពាក្យជាប់គ្នាដូច `authtoken`) ត្រូវបដិសេធ · Apps Script គ្មាន key · key ទទេ · ឬ key + Header ➜ សារប្រាប់ច្បាស់។
- នាំចូល Excel ទៅ Sheet៖ ចុចនាំចូលមិនបានខណៈឯកសារថ្មីកំពុងរៀបចំ · លទ្ធផលដែលមកក្រោយបិទផ្ទាំងនៅតែធ្វើបច្ចុប្បន្នភាពតារាង · cache Fast Mode របស់ barcode ដែលនាំចូលត្រូវលុប · ចម្លើយ Lookup ដែលកំពុងរត់មិនជាន់តម្លៃនាំចូលក្នុងតារាង។
- ZTO «មិនទាន់បិទ»៖ កញ្ចប់ដែល Sign នៅសាខាផ្សេង ឬ record ZTO គ្មានទិន្នន័យអតិថិជន តែ Sign រួច ចេញពីរបា (Cookie សួរ `status=1` ដូច Palm) · ចម្លើយនោះឆ្លងការត្រួតសាខា។
- iPhone PWA ផ្តេក (រាយការណ៍ម្ចាស់គម្រោង)៖ បង្វិលអេក្រង់ ➜ បញ្ជីប្រវត្តិមានកម្ពស់ត្រឹមត្រូវ (App វាស់ទំហំ navbar/tab bar ឡើងវិញពេល body ឬរបារប្តូរទំហំ · `listenIOSPageSize()`)។
- ចំណូលតាមថ្ងៃយក៖ ការបិទលើបណ្តាញយឺត ខណៈ Cookie សម្អាតភ្លាម ឬឧបករណ៍ផ្សេងដាក់កញ្ចប់ចូលធុងសំរាម «យករួច» មុន ➜ កំណត់ត្រាចំណូលនៅតែសរសេរ · ការបិទដែលលទ្ធផលមិនច្បាស់ ➜ Sync ពី server · បិទទាំងជួរមិនប្តូរម៉ោងបិទរបស់ barcode ដែលបិទរួច (ថ្ងៃចំណូលមិនរំកិល · Reset ចំនួនយករួចមិនត្រឡប់មកវិញ) · App ត្រូវបិទ ឬប្តូរហាងកណ្តាលការបិទ/បើក/ដក ➜ កំណត់ត្រាចំណូលតាមថ្ងៃយកបញ្ចប់ពេលបើក App ម្តងទៀត (journal ក្នុងឧបករណ៍) · ការដកដែលដាច់ពេលប្តូរហាងមានសញ្ញា Sentry តែម្តង · Reset ចំនួនយករួចលើឧបករណ៍ផ្សេងនៅជាប់ ពេល App បើកវិញក្រោយការ Sync ចំណូលតាមថ្ងៃយកត្រូវកាត់។
- Push៖ ការរំលឹកកញ្ចប់ជិតត្រឡប់ម៉ោង ៨ ព្រឹកដំណើរការមុនដំណឹងអ្នកលក់ (ការអានដំណឹងយឺតមិនបាត់ការរំលឹក)។
- ធុងសំរាម៖ ធុងសំរាមចាស់ដែល Sign រួចហើយជាប់ claim Restore ចាស់ លុបតាមកំណត់បាន · Restore ដែលផ្អាករួចមិនសរសេរម្ដងទៀតរាល់ជុំ។
- Queue Sign៖ ការងារដែលអានមិនបានក្រោយប្តូរ PIN មិនរារាំង Sign កញ្ចប់នោះម្ដងទៀត (ការងារថ្មីជំនួសវា)។
- ធុងសំរាម (សំណើម្ចាស់គម្រោង)៖ ការស្តារដែលជាប់ ➜ 🛠️ (PIN) ដក Barcode ដែលការស្តារដាក់ចូលពីជួរអតិថិជន ដោយមិនបូកប្រាក់វិញ · ការស្តារមិនទាន់ចប់ ➜ ⏳🔄។
- Supabase · Push · Queue Sign (ការកែមុន)៖ ផ្នែក ២ A261។

#### អ្នកយាម

`ZoeW/tests/zto-trash-mode-shop.test.ts` · `ZoeW/tests/zto-trash-mode-devices.test.ts` · `ZoeW/tests/native-recovery-plain-cas.test.ts` · `ZoeW/tests/collected-mirror-durable.test.ts` · `ZoeW/tests/zto-sign-evidence-refresh.test.ts` · `ZoeW/tests/restore-terminal-cancel.test.ts` · `ZoeW/tests/zto-restore-verification.test.ts` · `ZoeW/tests/sheet-lookup-freshness.test.ts` · `ZoeW/tests/setup-lookup.test.tsx` · `ZoeW/tests/lookup-import-race.test.ts` · `ZoeW/tests/zto-list-bare-record-probe.test.ts` · `ZoeW/tests/zto-lock.test.ts` · `ZoeW/tests/pickup-cleanup-collected-race.test.ts` · `ZoeW/tests/close-restamp-idempotent.test.ts` · `ZoeW/tests/push-server.test.ts` · `ZoeW/tests/palm-sign-outbox.test.tsx` · `google-sheets-cache-test` · `zto-import/test.js` · `zto-sync-banner-test` · `lookup-freshness-test` · `emu/app-writes-rules-test` · `emu/restore-deadlock-test` · `emu/crud-rules-flow` · `emu/restore-mutation-emu-test` · `emu/supabase-rules-parity-test`។ ភស្តុតាង និងការវាស់ ➜ ផ្នែក ២ A261 · A262 · A263។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **Firebase rules (មុន merge)** ៖ Publish `firebase-database.rules.json` ទៅ Firebase ហាងទាំងអស់ (ថ្មី `zoew_settings/zto_trash_mode` ត្រាតាមឧបករណ៍ · ច្បាប់បោះបង់ Restore · ត្រា Sign ក្នុងធុងសំរាម) — Console ➜ Publish ឬ `tools/firebase-provision/deploy-rules.cmd` · rules License មិនប្រែ។ Publish ជា atomic ហើយ App ចាស់ (`2.50.135`) ធ្វើការធម្មតាលើទិន្នន័យដែលវាសរសេរ (វាស់ ៖ App `main` × rules ថ្មី ២០ ok · ០ FAIL) · rules ចាស់បដិសេធធាតុធុងសំរាមរបស់ App ថ្មី (`trashMode` · `restoreBlocked`) ➜ merge មុន Publish = លុប/ដក/សម្អាតជាប់ (Preview ដែលភ្ជាប់ហាងពិតក៏ដូចគ្នា)។
2. **Supabase (មុន merge)** ៖ រត់ `supabase/migrations/20261021030435_zoe_rules.sql` ម្តងក្នុង SQL Editor របស់ project ពិត (`create or replace` · រត់ឡើងវិញបានដោយសុវត្ថិភាព · ស្មើ rules JSON) ➜ គ្មានចន្លោះ App ថ្មីលើ rules ចាស់ · ពេល merge GitHub integration រត់ migration ទាំង ៤ (`20261019140325` · `20261020014826` · `20261020074743` · `20261021030435`) ម្តងទៀតដោយគ្មានគ្រោះថ្នាក់ · ក្រោយ merge ពិនិត្យ ✓ Supabase លើ merge commit។
3. **ឧបករណ៍** (ក្រោយ merge) ៖ ធ្វើបច្ចុប្បន្នភាព **ឧបករណ៍ ZTO (Palm · Cookie) មុនគេ** រួចឧបករណ៍ផ្សេង (PWA ៖ បើក App ➜ Refresh ពីរបារ «កំណែថ្មី» · APK ៖ 🔔 ➜ 📥) ៖ ត្រារបៀបហាងមកតែពីឧបករណ៍ ZTO ថ្មី ហើយ App ចាស់ដាក់ត្រា Sign លើធាតុធុងសំរាមរបស់ App ថ្មីមិនបាន។ ក្នុងរយៈឧបករណ៍លាយ (ច្រើនថ្ងៃ) **ស្តារ 🔄 លើឧបករណ៍ដែលធ្វើបច្ចុប្បន្នភាពរួច** ៖ App ចាស់ស្តារធាតុរបស់ App ថ្មីទៅជួរថ្មីមិនបាន («❌ ស្តារទិន្នន័យបរាជ័យ» · Sentry `money` · claim ២ នាទី · ប្រាក់មិនប្រែ) · Sentry `clearStaleRestoreMarkers` · `stale claim release` (`data`) និង `Restore failed:` ពី App ចាស់ ជាសញ្ញារំពឹងទុក ⛔ កុំផ្អាកហាងតាម ZoeKeyGen (`CLAUDE.md` ច្បាប់ ១០ ៖ Revoke មិនឃាត់ការសរសេរ ហើយលុប Activation គ្រប់ឧបករណ៍ · បិទហាង Supabase ចាកចេញគ្រប់ឧបករណ៍ ហើយការសរសេរក្នុងចន្លោះនោះបាត់)។
4. **Apps Script** (template មិន deploy ដោយខ្លួនឯង) ៖ copy `zto-import/google-sheets-api/Code.gs` (អ្នកអាន `SCRIPT_VERSION` 2 ➜ 🩺 រំពឹង 2) · `zto-import/Code.gs` (អ្នកសរសេរ 4 ៖ រាយការណ៍ `written` · មុន deploy ចម្លើយ `ok:false` ចាស់បង្ហាញ «មិនទាន់ដឹងលទ្ធផល») · `zto-import/Watch.gs` · `zto-import/Index.html` ទៅ script.google.com រួច Deploy ជាកំណែថ្មី។
5. **ZoeKeyGen** ៖ deploy រួច Link API Google Sheet ចាស់ដែលមាន `key=` ក្នុង URL ត្រូវ ZoeW ថ្មីបដិសេធ ➜ បង្កើត Link ថ្មី · បើធ្លាប់ចែក Link នោះ ➜ ប្តូរ `API_KEY` ក្នុង Script Properties។ ZoeW ត្រូវ deploy **មុន** ZoeKeyGen (ZoeW ចាស់បដិសេធ Link ថ្មីដោយសុវត្ថិភាព)។

### [2.50.135] — 2026-10-19 · ZoeW ៖ Sign រង់ចាំខាងក្រោយ · beep ជាប់ · ស្លាក ZTO (A259 · A260)

**ZoeW** (`zoew-v398` ➜ `zoew-v399`) · **ZoeKeyGen `2.24.21` មិនប្រែ**។ ម្ចាស់គម្រោងរាយការណ៍ APK Android ស្កេនតែមួយក៏សម្លេងដាច់ និងស្នើសម្លេង realtime។

- APK បន្លឺ tone ជាប់១៥០ms និងមិនកាត់ចាប់ផ្ដើមឡើងវិញពេលហៅស្ទួន។ រៀបចំ engine ពេល load/resume ហើយប្រើឡើងវិញរវាងការស្កេន; ការចាក់សម្លេងមិនរង់ចាំ Lookup/Save/network។
- ក្រោយ tone ចប់ ស្តារ media volume; pause/destroy សម្អាត engine ហើយគោរពការប្ដូរ volume របស់អ្នកប្រើ។ PWA/fallback មិនបង្កើត tone ជាន់គ្នា និងមិនចាក់សម្លេងចាស់ក្រោយ context ត្រូវជំនួស។

- Sign៖ ពិនិត្យលក្ខខណ្ឌ និងបញ្ជាក់បញ្ហានៅ foreground សិន; រក្សារូប/ការងារអ៊ិនគ្រីបបានរួច ទើបបិទផ្ទាំងឲ្យធ្វើការបន្ទាប់។ បញ្ជី ✍️ បង្ហាញការងាររង់ចាំ; បញ្ហាថ្មីមិនអនុម័តស្វ័យប្រវត្តិ។ បិទ App បញ្ឈប់ worker បណ្ដោះអាសន្ន ហើយបន្តពេលបើក/ដោះសោ/online។
- ស្លាកដែលអ្នកប្រើឃើញ Palm ➜ ZTO តាមសំណើម្ចាស់គម្រោង។ Protocol, header និងឈ្មោះ storage នៅដដែល។

**សកម្មភាពដោយដៃ**៖ ដំឡើង APK កំណែថ្មីដើម្បីទទួល Java plugin; refresh Web preview តែមួយមិនប្ដូរ native tone ទេ។ សាកស្កេនលើកដំបូង, ជាប់ៗគ្នា, ក្រោយចូល App វិញ និង volume០។ សាក Sign លេខមួយ២–៣កញ្ចប់ មានបញ្ហា និង offline/reopen; កុំលុបទិន្នន័យ App ពេលមានការងារ ✍️ រង់ចាំ។ គ្មាន rules, migration ឬ env ថ្មី។

### [2.50.134] — 2026-10-19 · ZoeW ៖ បន្ត journal ក្រោយដោះសោ · ផ្ទៀង CI · ត្រួតពិនិត្យប្រភព Palm (A256 · A257 · A258)

**ZoeW** (`zoew-v397` ➜ `zoew-v398`) · **ZoeKeyGen `2.24.21` មិនប្រែ**។ ម្ចាស់គម្រោង merge ជុំមុនខណៈ CI ក្រហម រួចស្នើឱ្យផ្ទៀងផ្ទាត់ការងារឱ្យចប់ស្អាត។

- ពេល recovery រំលងការងារដែលម្ចាស់ដើមនៅកាន់សោ ការដោះសោនោះចាប់បន្ត journal ដែលនៅសល់។ វារង់ចាំ Web Lock ដោះពិត និង recovery pass កំពុងរត់ រួចផ្ទៀង database/auth generation និងហាងដើម។ ការប្តូរ session មិនបញ្ជូនការងារចាស់ទៅហាងថ្មី។
- Recovery ផ្ទៀង source និង target Restore ថ្មីពី Server មុនបង្កើត trash ដែលបាត់ឡើងវិញ ដើម្បីការពារ view ចាស់ក្រោយ Restore ពីឧបករណ៍ផ្សេង។
- Palm ទាញបញ្ជីមកដល់ `03` ដោយ SSO ពី Login Palm ផ្ទាល់ និងមិនពឹង Cookie Blob។ ម្ចាស់គម្រោងផ្ទៀងបញ្ជីធម្មតា៣ដងបាន១៨កញ្ចប់គ្រប់ រួមទាំងកញ្ចប់មិនទាន់ចែកចាយ; ពេល៥.៧/៣.៩/៣.៩វិ.។ ប្រភពនេះជំនួសបេក្ខភាពចែកចាយ; រក្សា signed tab `5` និង own-site track ដើម្បីផ្ទៀងថ្ងៃ/ស្ថានភាព។ ដក probe សាកល្បង និងផ្លូវចែកចាយស្ទួនចេញ។
- ជួរ paging Palm ប្រើឈ្មោះ `pageTask` ត្រឹមប្រភេទការងារ; checker schema ដែលស្គាល់ `entry` ថាជា record លុយនៅតែតឹងដដែល។ មិនបន្ថែម `tabs` ទៅ Firebase rules, មិនលើកលែង guard និងមិនផ្លាស់អត្ថន័យការទាញទំព័រ។

**សកម្មភាពដោយដៃ**៖ deploy Web/PWA និងធ្វើបច្ចុប្បន្នភាព APK ដើម្បីទទួល bundle ថ្មី។ គ្មាន rules, SQL migration ឬ env ថ្មី។ ផ្ទៀងលុប/ដក/ស្តារពេល offline/reconnect ហើយប្តូរគណនីក្រោយមានការងាររង់ចាំ; ការងារហាងដើមមិនត្រូវប៉ះហាងថ្មី។

### [2.50.133] — 2026-10-19 · ZoeW ៖ ទំព័រ Palm តាមចំនួនបច្ចុប្បន្ន (A255)

**ZoeW** (`zoew-v396` ➜ `zoew-v397`) · **ZoeKeyGen `2.24.21` មិនប្រែ**។ សំណើម្ចាស់គម្រោង៖ ក្រោយបញ្ចប់ជុំមុន ធៀប `draft.7z` និងពិនិត្យល្បឿនទាញបញ្ជី ZTO, read/write/sync និង Sign បន្ថែម។

- Palm នៅតែចាប់ទាញទំព័រដែលចាំពីជុំមុនស្របគ្នា។ ពេលទំព័រទី១ឆ្លើយចំនួនថ្មី វាដកតែទំព័រ/tab លើសដែលមិនទាន់ចាប់ផ្តើមពីជួររង់ចាំ។ Tab ដែលនៅមានទិន្នន័យ និង request កំពុងរត់នៅបន្ត; ZTO រាយការណ៍ចំនួនកើនវិញ ➜ ទំព័រនោះអាចចូលជួរឡើងវិញ។
- ការផ្ទៀង track ម្តងមួយ barcode, លក្ខខណ្ឌសាខា/ថ្ងៃ/ប្រភព/Sign និងលុយនៅដដែល។ ក្នុង lab ចាំចំនួនចាស់១២០ទំព័រ និងបណ្តាញ ZTO សិប្បនិម្មិត២០ms៖ list requests ២៤២ ➜ ១៨ ឬ២០ តាមចំនួនកញ្ចប់។ ល្បឿន ZTO ពិតអាស្រ័យបណ្តាញ និងចំនួន track; មិនអះអាងថាគ្រប់ការទាញលឿនតាមសមាមាត្រនេះទេ។

**សកម្មភាពដោយដៃ**៖ deploy Web/PWA ហើយ refresh/update; APK ប្រើ bundle ថ្មីត្រូវ build កំណែថ្មី។ គ្មាន rules, SQL migration ឬ env ថ្មី។ សាកហាង Palm ដែលចំនួន stock ថយពីជុំមុន រួចធៀបចំនួន barcode និងស្ថានភាពជាមួយ Cookie។

### [2.50.132] — 2026-10-19 · ZoeW ៖ លុប/ដក/ស្តារ · GPS រូប Sign · សម្លេងស្កេន (A250 · A251 · A252 · A253 · A254)

**ZoeW** (`zoew-v395` ➜ `zoew-v396`) · **ZoeKeyGen `2.24.21` មិនប្រែ**។ សំណើម្ចាស់គម្រោង៖ Cookie ពី Blob និង Palm Login លើ Firebase/Supabase · លុប→ស្តារ · ដក→ស្តារ · auto cleanup→ស្តារ · ចុចស្ទួន · ច្រើនឧបករណ៍ · offline/reconnect · បណ្តាញយឺត · បិទ App កណ្តាលប្រតិបត្តិការ។

- លុប ដក និង auto cleanup រក្សា before-image ក្នុងការងាររង់ចាំ **មុន** transaction ដក barcode ចេញពី history។ បើបិទ App ក្រោយ server commit តែមុន ACK ការបើកវិញអាចបំពេញ trash; snapshot ថ្មីពី backend ក៏ចាប់ផ្តើម recovery។ ទំហំផ្ទុកពេញរហូតរក្សា intent មិនបាន ➜ ផ្អាកមុនលុប/ដក ដើម្បីរក្សាទិន្នន័យ និងលុយដើម។
- ដក barcode សរសេរ trash មុន ហើយប្រើ ledger event ដែលមានអត្តសញ្ញាណដដែលពេល retry; flip `isDeducted` ក្រោយផ្ទៀងលុយ។ Restore ស្គាល់ event នេះ និងសម្គាល់ថាបានបូកវិញក្នុង finalization ដដែល។ ការប្តូរ session កណ្តាល monthly/daily បញ្ឈប់ការសរសេរបន្តទៅហាងថ្មី។
- Restore រក្សា token/target ជាមួយ shop scope មុន claim និងរារាំងចុចស្ទួនក្នុងឧបករណ៍ដដែល។ បើក App វិញ រួចសាក Restore អាចប្រើ claim ដើម។ ចម្លើយ resync ចាស់មិនជាន់ arrays ថ្មីដែល listener បានផ្តល់ក្នុងពេលរង់ចាំ។

- រូប Sign រង់ចាំ GPS ដែលមកយឺតលើ frame ដើម; Android high-accuracy អស់ពេលសាកទីតាំងប្រហាក់ប្រហែល។ រូបទើបថតដែលមាន EXIF GPS រក្សាកូអរដោនេដើម។ Gallery មាន EXIF ម៉ោង/GPS គ្រប់ ➜ ប្រើរបស់រូប; បើមិនគ្រប់ ➜ ដាក់ម៉ោង/ទីតាំងពេលជ្រើស ដោយមានសារប្រាប់ប្រភព។ ពេល location មិនអាចទទួលបាន បង្ហាញស្ថានភាព និងមិនប្រឌិតកូអរដោនេ។
- Font ត្រាពណ៌ក្រហមសុទ្ធ Roboto bold បង្រួមតាមទទឹងដូច flow Sign ក្នុង APK យោង; font ភ្ជាប់ក្នុង App ដើម្បីប្រើ offline លើ PWA/APK។

- សម្លេងស្កេនលើ APK ប្រើ native tone និងលើក media volume ពេល beep រួចស្តារវិញ; PWA ប្រើ gain ពេញ និង ramp ដើម្បីកាត់ click ប៉ុន្តែនៅតាមកម្រិតសម្លេង/mute របស់ OS។

**សកម្មភាពដោយដៃ**៖ deploy Web/PWA និងធ្វើបច្ចុប្បន្នភាព APK; មិនមាន rules ឬ SQL migration ថ្មីក្នុងជុំនេះ។ សាកបិទ/បើកពិតលើ iOS/Android/APK ពេលកំពុងដក និងស្តារ រួចផ្ទៀងប្រាក់ និង barcode។ លើ APK សាក capture មុន/ក្រោយ GPS ឆ្លើយ និង Gallery មាន/គ្មាន EXIF; ផ្ទៀងកូអរដោនេ/font។ សាក scan ពេល media volume ទាប/0 រួចផ្ទៀងថាកម្រិតដើមត្រឡប់ក្រោយ beep និងបិទ App។ iOS PWA មានកូអរដោនេ ម្ចាស់គម្រោងបញ្ជាក់រួច; ផ្ទៀងបន្តក្រោយ update។ តេស្ត cloud ប្រើ Chromium + backend ក្នុង lab និង Cookie/Palm/ZTO សិប្បនិម្មិត; មិនប៉ះ production Cookie ឬលុយអតិថិជន។

### [2.50.131] — 2026-10-19 · ZoeW ៖ Health Check ផ្ទៀង Session Palm ជាមួយ ZTO (A249)

**ZoeW** (`zoew-v394` ➜ `zoew-v395`) · **ZoeKeyGen `2.24.21` មិនប្រែ**។ សំណើម្ចាស់គម្រោង៖ មាន Session Palm តែជួរ Health នៅតែសញ្ញាព័ត៌មាន; ម្ចាស់គម្រោងបញ្ជាក់ថា Palm លឿនជាងមុនលើ preview។

- Health Palm ស្នើ `diag=1&verify=1`; Function អាន `queryDispatchList` តែ ១ ជួរ ដើម្បីបញ្ជាក់ថា ZTO ទទួល session។ ចម្លើយមិនផ្ញើ barcode/លេខទូរស័ព្ទ/token មក Health។
- Session របស់ឧបករណ៍ ឬ shared ដែលបានផ្ទៀងផ្ទាត់ ➜ ✅; shared token ដែល ZTO បដិសេធ ➜ renew តាម single-flight/CAS ដែលមានស្រាប់ រួចសាកម្តងទៀត។ គ្មាន session, ផុតកំណត់, សាខាផ្សេង, rate limit ឬបណ្តាញខូច មិនបង្ហាញជោគជ័យ។
- ផ្ញើ ID token ទៅតែ host ដែលទុកចិត្ត ហើយរង់ចាំរៀបចំ credential ទាំងអស់។ Function ចាស់ដែលមិនស្គាល់ verify នៅតែ ℹ️; ចម្លើយផ្ទៀងផ្ទាត់មិនច្បាស់ជា ⚠️ ហើយសេចក្តីសង្ខេបក៏មិនបៃតង។
- រួបរួមការរៀបចំ credential របស់ Login/shared connect ទៅ `palmRequestCredentials()` បន្ទាប់ពី code-duplication guard រកឃើញប្លុកស្ទួន។

**អ្នកយាម**៖ `tests/zto-palm-login.test.tsx` · `tests/zto-palm-server.test.ts` · `tests/zto-palm-backends.test.tsx` · `tests/zto-palm-shared-app.test.tsx` · `health-check-test` · `code-duplication-test`។ A249 កត់ត្រាភស្តុតាងមុន/ក្រោយកែ។

**សកម្មភាពដោយដៃ**៖ deploy App និង Function ជាមួយគ្នា (PR preview ធ្វើដោយស្វ័យប្រវត្តិ) រួចបើក «ពិនិត្យប្រព័ន្ធ» ម្តងទៀត។ APK ត្រូវដំឡើង build ថ្មីដើម្បីប្រើ Health ថ្មី។ គ្មាន rules/migration/secret ថ្មី។

### [2.50.130] — 2026-10-19 · ZoeW + ZoeKeyGen `2.24.21` ៖ Deep audit — ការពារ log · លទ្ធផលសរសេរ Supabase · ផ្ទាំងស្កេនផ្តេក · Palm រៀបចំសំណើព្រមគ្នា

**ZoeW** (`zoew-v393` ➜ `zoew-v394`) និង **ZoeKeyGen** (`zoekeygen-v131` ➜ `zoekeygen-v132`)។

#### អ្វីដែលខុសពីមុន

- ការរាយកំហុសលាក់ credential ខ្លីក្នុង Authorization និង cookie ទាំងមូល ទោះ header នៅក្នុង quote ឬវង់ក្រចក។
- ZoeW មិនរាយថាសរសេរជោគជ័យត្រឹម HTTP 200 បើ JSON គ្មាន verdict ត្រឹមត្រូវ។ ចម្លើយមិនច្បាស់ប្រើ `op_id` ដើមសម្រាប់ retry ហើយ journal នៅតែចងចាំថាសំណើមុនអាចបាន commit រួច ទោះ auth ដាច់ក្នុងសំណើបន្ទាប់។
- ទូរស័ព្ទផ្តេកកម្ពស់ខ្លី៖ banner ដកកញ្ចប់ និងប្រអប់សង្ខេបលុយបង្រួម ដើម្បីឲ្យប៊ូតុងកាមេរ៉ា និងតម្រងថ្ងៃស្ថិតពីលើរបា Tab។
- ការ undo និង recovery អាន history/trash ពី Server មុនស្តារស្ថិតិ pickup ដើម្បីមិនប្រើ listener ចាស់។ ការអាន/Save បរាជ័យរក្សា journal; Reset នៅសូន្យដដែល បើការប្ដូរស្ថានភាពមិនបានអនុវត្ត។
- សម្អាត import/អថេរដែលមិនប្រើ និងបើក `noUnusedLocals`។ សម្អាត handoff ដែលរាយ branch មិនទាន់ merge ខណៈ git បង្ហាញថា merge រួច។
- Sign រៀបចំ Palm header តែម្តង។ Login/ភ្ជាប់ Palm របស់ហាង និងការទាញបញ្ជី Palm/Cookie រៀបចំ credential និង ID token ព្រមគ្នា ដោយរង់ចាំទាំងពីរ និងពិនិត្យ session មុនផ្ញើ។ «ពិនិត្យ ZTO» ក្នុងផ្ទាំង Sign អានអតិបរមា ៤ ព្រមគ្នា រួច Save ម្តងមួយតាមលំដាប់; បរាជ័យរង់ចាំសំណើកំពុងរត់ និងឈប់ចែកការងារថ្មី។

#### អ្នកយាម

`secret-hygiene` · `tests/supabase-write-bad-body.test.ts` · `tests/supabase-journal-recovery.test.ts` · `tests/pickup-interrupted-close.test.ts` · `layout-check` · `typecheck`។ ការសម្អាត `zto-status.ts` ប៉ះតែ import មិនប្រើ តាមសំណើម្ចាស់គម្រោង audit ZTO និង dead code; `zto-list-sync` · `zto-sync-banner` · `zto-signed-sync` PASS មុនធ្វើបច្ចុប្បន្នភាព LOCK។

សំណើម្ចាស់គម្រោងបង្កើនល្បឿន Palm/Cookie អនុញ្ញាតកែ `zto-palm-login.ts` និង `zto-list-sync.ts` (A248)។ តេស្តមុនកែ FAIL ៧ សម្រាប់ duplicate decrypt/ការរង់ចាំគ្នា និង FAIL ៥ សម្រាប់ pool/session; តេស្ត login/sign/token origin ក្រោយកែ PASS ៩៦។ Benchmark សិប្បនិម្មិត status ២៥ ms × ៨ កញ្ចប់៖ ២១៤ ms ➜ ៥៣ ms; មិនមែន latency វាស់លើ ZTO ពិត។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

គ្មាន SQL migration, Firebase rules ឬ secret ថ្មី។ មុន merge សូមពិនិត្យការកែ និងសាកលើទូរស័ព្ទពិត; cloud browser មិនជំនួស iPhone/Android ពិតទេ។

### [2.50.129] — 2026-10-18 · ZoeW ៖ «ខុសទីតាំង» តែពេល ZTO ស្កេនបញ្ហា «ទីតាំងមិនត្រឹមត្រូវ» មុនបញ្ជូនចេញ · បញ្ជូនចេញតែម្យ៉ាង ➜ «បញ្ជូនចេញ» ស្តារបាន (A234) · ត្រា `ztoSentOutAt` (A239 · A240) · រូប Gallery មានម៉ោងថតពិត (A235) · ពិនិត្យឡើងវិញ (A236–A238)

**ZoeW** (`zoew-v392` ➜ `zoew-v393`) · Function `zto-order-detail.js` · `_shared/zto-palm.js` (តំបន់ LOCK ZTO ៖ សំណើផ្ទាល់) · rules ថ្មី `ztoSentOutAt` (Firebase · Supabase migration `20261018144557_zoe_rules.sql`)។
សំណើម្ចាស់គម្រោង ៖ «ធ្វើទាំងពីអោយស្អាតទៅ» — ចម្លើយលើចំណុចសម្រេច ២ ៖ ① រូប 🖼 Gallery ទទួលស្លាកម៉ោង/ទីតាំង **ពេលជ្រើស** មិនមែនពេលថត ·
② បុគ្គលិកប្រើ «ផ្ញើចេញ» (`02`) ជំនួស «ត្រឡប់ការស្កេន» (`-710`) ➜ ZoeW ដាក់ «ខុសទីតាំង»។ លម្អិត ៖ ផ្នែក ២ A234 · A235។

- 📍 **ខុសទីតាំង ត្រូវការមូលហេតុពី ZTO** ៖ ស្កេនបញ្ហានៃសាខាខ្លួនដែល `problemReason` ជា «ទីតាំងមិនត្រឹមត្រូវ» (`MISPLACED_REASONS` ៣ ភាសា ៖ ខ្មែរ · `地址不详` · `Incorrect location` · ដកតួអក្សរមើលមិនឃើញ)
  នៅចន្លោះការមកដល់ចុងក្រោយ និងការបញ្ជូនចេញ ➜ `ztoMisplacedAt` (ដូចមុន) · បញ្ជូនចេញដោយគ្មានស្កេននោះ ➜ `ztoSentOutAt` ➜ ភស្តុតាងប្រភេទ `sent` ៖ ធុងសំរាម «បញ្ជូនចេញ» · ដកលុយ និងចំនួនកញ្ចប់ដូចគ្នា ·
  **ស្តារបាន** (មិនមែន `-710` ➜ មិន 🔒) · ប្រអប់ទាញបញ្ជី «📤 ZTO ស្កេនបញ្ជូនចេញ» · សារសង្ខេប «📤 បញ្ជូនចេញរួច N» ·
  🔒 នៅតែកញ្ចប់ដែល ZTO ស្កេនត្រឡប់ `-710` (`trashRestoreBlockOf()` ចាក់សោតែភស្តុតាង `returned`)។
- 🍪 **Cookie** ៖ Function `?list=1&problem=1` អានបញ្ជី Argus `ZTO_LIST_PROBLEM_SCAN_TYPE` (លំនាំដើម `30` «ការចុះឈ្មោះបញ្ហា» · `off` បិទ) ហើយឆ្លើយតែជួរដែល `problemReason`
  ស្ថិតក្នុង `ZTO_LIST_MISPLACED_REASONS` (លំនាំដើម ៣ ភាសា · `off` បិទ) ចុងក្រោយក្នុងមួយ Barcode (`problemScans` ចូលចំនួនរាប់) ➜ App អានជាមួយ `returned=1` · `sent=1`
  (`fetchZtoReturnedPages()`) ៖ ស្កេនបញ្ហា ≤ ពេលបញ្ជូនចេញ ➜ «ខុសទីតាំង» · ផ្សេងទៀត ➜ «📤 បញ្ជូនចេញ» · បញ្ជី `30` អានមិនបាន ឬ `off` ➜ ដកដដែល ធុងសំរាម «ត្រឡប់» គ្មានត្រា
  (`sentUnverified` ➜ ភស្តុតាង `left`) + ⚠️ «មិនបានគ្រប់» · ការពិនិត្យនៅខាងក្រោយអានបញ្ជី `30` ពីថ្ងៃកញ្ចប់បើកចាស់បំផុត (`ztoOpenSinceDay()`) មិនមែនតែម្សិលមិញ ➜ ថ្ងៃនេះ (A240)។
- 📤 **ត្រា «បញ្ជូនចេញ» ក្នុង DB** (សំណើម្ចាស់គម្រោង ៖ «ហេតុអីមិនដាក់ត្រាក្នុង DB?» ➜ «ធ្វើ បន្ថែមត្រា ztoSentOutAt អោយស្អាតពេញលេញ») ៖ `syncZtoFinalMarks()` កត់ `ztoSentOutAt`
  តែម្យ៉ាងលើធាតុធុងសំរាម `returned` (⛔ មិនកត់ `ztoReturnedAt` ➜ គ្មាន App ណា 🔒) ➜ ធុងសំរាមក្រុម «បញ្ជូនចេញ» (`TRASH_REASON_META.sent`) · 🔔 📤 «📤 បញ្ជូនចេញ» · ប្រអប់ទាញបញ្ជី «ធុងសំរាម «បញ្ជូនចេញ»» ·
  ឃើញដូចគ្នាលើគ្រប់ទូរស័ព្ទ ទោះគ្មានភស្តុតាងក្នុងខ្លួន · ដាច់ពីច្បាប់ ៨ ថ្ងៃ (នៅ «ត្រឡប់») · តម្លៃ DB នៅ `returned` (លុយ · រក្សាទុក ២ ថ្ងៃមិនប្រែ) · ការស្តារដក `ztoSentOutAt` ·
  App ចាស់ ៖ ត្រា «ខុសទីតាំង» របស់វាលើការបញ្ជូនចេញ ➜ `ztoSentOutAt` ឈ្នះ · `ztoReturnedAt` តែម្យ៉ាង (rules ចាស់បដិសេធ `ztoMisplacedAt`) ➜ `ztoSentOutAt` ដោះ 🔒 ·
  ត្រាដែល App ចាស់យកតាមការស្តារ (`restoredAt` ក្រោយត្រា) ➜ មិនរាប់ · rules មិនទាន់ Publish ➜ ត្រា Sign/ត្រឡប់ផ្សេងនៅចូល ហើយស្លាកនៅតាមភស្តុតាងក្នុងឧបករណ៍ (A239)។
- 🖼 **រូប Sign ពី Gallery** ៖ ស្លាកក្រហមពី EXIF របស់រូប (`readPhotoExif()` អាន ≤ `PALM_SIGN_EXIF_READ_BYTES` ៖ `DateTimeOriginal` + `OffsetTimeOriginal` ➜ ម៉ោងភ្នំពេញ ·
  គ្មាន offset ➜ ម៉ោងនាឡិការូបដដែល · GPS EXIF · `0,0` ដែល Android/iOS លុបទីតាំង ➜ តែម៉ោង) · រូបគ្មានម៉ោងថត ➜ **គ្មានស្លាក** (មិនដាក់ម៉ោង/ទីតាំងពេលជ្រើស) ·
  📷 ថតឥឡូវ និងកាមេរ៉ាផ្ទាល់ ➜ ម៉ោងឥឡូវ + ទីតាំងបច្ចុប្បន្នដូចមុន។
- 🔎 **ពិនិត្យឡើងវិញ** (សំណើ ៖ «ផ្ទៀងផ្ទាត់ការងារឡើងវិញក្រែងមានចន្លោះ») ៖ ① **App ចាស់ (APK មិនទាន់ដំឡើងថ្មី) + Function ថ្មី** ៖ បញ្ជូនចេញតែម្យ៉ាងគ្មាន `ztoMisplacedAt` ➜ App ចាស់អានជាត្រឡប់ `-710`
  ហើយកត់ `ztoReturnedAt` ➜ 🔒 លើគ្រប់ឧបករណ៍ (ស្តារមិនបានជារៀងរហូត) ➜ Function ទុក `ztoMisplacedAt` លើរាល់ការបញ្ជូនចេញ ហើយ `ztoSentOutAt` បញ្ជាក់ «បញ្ជូនចេញ» (App ថ្មីអានមុន) (A236) ·
  ② 📷 ក្នុង APK គ្មានសិទ្ធិកាមេរ៉ា ➜ Capacitor បើកកម្មវិធីជ្រើសឯកសារ ➜ រូបចាស់ទទួលម៉ោងឥឡូវ ➜ រូប 📷 ចាស់ជាង `PALM_SIGN_FRESH_SHOT_MS` (១០ នាទី · EXIF ឬ `lastModified`) ➜ ច្បាប់ Gallery (A237) ·
  ③ Cookie ៖ «ទីតាំងមិនត្រឹមត្រូវ» នៃវដ្តមុន (មុនការមកដល់ចុងក្រោយ ឬមុនចូល/ស្តារក្នុង ZoeW) ➜ «📤 បញ្ជូនចេញ» · អានបញ្ជី `30` តែពេលមានការបញ្ជូនចេញ (សន្សំការហៅ Netlify) (A238) ·
  ④ EXIF pointer ប្រភេទ IFD (`13`)។
- 🧪 `ZoeW/tests/zto-palm-server.test.ts` (📍 ១៤ ករណី ៖ មុនកែធ្លាក់ទាំងអស់) · `ZoeW/tests/zto-returned.test.tsx` (Cookie ៖ `30` + `02` · `30` ធ្លាក់/`off` · Function `problem=1`) ·
  `ZoeW/tests/zto-palm-returned.test.tsx` · `ZoeW/tests/zto-returned-cleanup.test.ts` (ពិនិត្យនៅខាងក្រោយ ៖ «ខុសទីតាំង» · «ត្រឡប់» ស្តារបាន · លុយដក ២០) · `ZoeW/tests/zto-final-marks.test.tsx`
  (📤 គ្មានត្រា · ស្តារបាន · ធាតុចម្រុះជាមួយ `-710` ➜ 🔒) · `ZoeW/tests/palm-sign-camera.test.ts` (EXIF II/MM · offset · S/W · `0,0` · ឯកសារខូច · 🖼/📷) ·
  `ZoeW/tests/zto-signed-cadence.test.tsx` (បញ្ជីត្រឡប់ · បញ្ជូនចេញ · ស្កេនបញ្ហា ≤ ម្តងក្នុងមួយម៉ោង) · `revenue-fuzz-test` (`ztoFinal` ៖ ៣ ប្រភេទ) · `ZoeW/tests/zto-lock.test.ts` (LOCK ថ្មី) ·
  ត្រា `ztoSentOutAt` ៖ `ZoeW/tests/zto-final-marks.test.tsx` ៦ · `ZoeW/tests/zto-returned-cleanup.test.ts` ៤ · `ZoeW/tests/zto-returned.test.tsx` · `ZoeW/tests/cleanup-ledger-key.test.ts` ·
  `emu/app-writes-rules-test` (ការសរសេរ `ztoSentOutAt` ≥ ១ · rules គ្មានវា ➜ បដិសេធ) · `trash-modal-test` (ក្រុម «បញ្ជូនចេញ» · ត្រាមុន `restoredAt`)។

**សកម្មភាពដោយដៃ** ៖ ១. **Publish rules** `firebase-database.rules.json` (`ztoSentOutAt` ថ្មី · `ztoMisplacedAt` របស់ [2.50.128]) ក្នុង Firebase Console ➜ Realtime Database ➜ Rules
(ឬ `tools/firebase-provision/deploy-rules.cmd`) · ហាង Supabase ៖ migration ចូលពេល merge ទៅ `main` · មុន Publish ៖ ស្លាក «បញ្ជូនចេញ» នៅតែលើទូរស័ព្ទដែលអានឃើញ (ការដក · លុយ · ការស្តារមិនប៉ះ) · ២. Netlify env ស្រេចចិត្ត ៖ `ZTO_LIST_PROBLEM_SCAN_TYPE` ·
`ZTO_LIST_MISPLACED_REASONS` (លំនាំដើមគ្រប់គ្រាន់ · [`ZoeW/ZTO-SETUP-KH.md`](../ZoeW/ZTO-SETUP-KH.md)) · ៣. សាកលើកញ្ចប់ពិត ៖ «ទីតាំងមិនត្រឹមត្រូវ» ➜ បញ្ជូនចេញ ➜ «ខុសទីតាំង» ·
បញ្ជូនចេញតែម្យ៉ាង ➜ «បញ្ជូនចេញ» លើទូរស័ព្ទផ្សេងទៀតក៏ដូចគ្នា ហើយ 🔄 ស្តារបាន · ៤. ✍️ Sign ៖ 🖼 ជ្រើសរូបចាស់ ➜ ស្លាកម៉ោងថតរូបនោះ (APK ថ្មីត្រូវដំឡើង)។

### [2.50.128] — 2026-10-18 · ZoeW ៖ រូប Sign មានម៉ោង និងកូអរដោនេ ដូច ZTO Palm (A231) · កញ្ចប់ខុសទីតាំងចេញពីបញ្ជីទៅធុងសំរាម «ខុសទីតាំង» (A230)

**ZoeW** (`zoew-v391` ➜ `zoew-v392`) · rules ថ្មី (`firebase-database.rules.json` + `supabase/migrations/20261018084522_zoe_rules.sql`) · APK សិទ្ធិទីតាំង · Netlify header។
សំណើម្ចាស់គម្រោង ៖ «សូមអោយ app ZoeW ពេល Sign ចាប់រូបភាពមាន timestamp និង កូអរដោនេ ដូច ZTO Palm ពិត» · «កញ្ចប់ ខុសទីតាំង "ទីតាំងមិនត្រឹមត្រូវ" ហើយត្រូវ
ស្កេនបញ្ចូនទៅទីតាំង ពិត របស់វា សូមអោយ ZoeW ស្គាល់ ហើយដកចេញពី បញ្ជី ដូចអីវ៉ាន់ត្រឡប់ដែរ តែមានស្លាក "ខុសទីតាំង" ក្នុងធុងសំរាម» (តំបន់ LOCK ZTO ៖ សំណើផ្ទាល់)។
លម្អិត ៖ ផ្នែក ២ A230 · A231 · A232 · A233។

- 📍 **រូប Sign** ៖ ម៉ោង `YYYY-MM-DD HH:MM:SS` (Asia/Phnom_Penh · នាឡិកា server) និងកូអរដោនេ `lat, lng` (៥ ខ្ទង់) ពណ៌ក្រហម ជ្រុងក្រោមឆ្វេង ដូច ZTO Palm ·
  ទីតាំងតាម `navigator.geolocation.watchPosition` តែពេលផ្ទាំង Sign បើក (បិទ ➜ `clearWatch`) · ទីតាំងចាស់ជាង ២ នាទី ឬភាពត្រឹមត្រូវ > 5000 m ➜ រូបមានតែម៉ោង (Android «ប្រហាក់ប្រហែល» ≈ ២–៣ គ.ម. នៅមានកូអរដោនេ) ·
  កាមេរ៉ា · 📷 · 🖼 ដូចគ្នា · Netlify `Permissions-Policy` `geolocation=(self)` · APK `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (គ្មាន background)។
- 📍 **ខុសទីតាំង** ៖ ZTO Palm `status=1` និង `tracks=` ឆ្លើយ `ztoMisplacedAt` = ស្កេន `2` 发件 នៃសាខាខ្លួន ក្រោយការមកដល់ចុងក្រោយ (គ្មាន `-710` · មិនបិទ) ហើយ
  `ztoReturnedAt` ដដែល ➜ ផ្លូវត្រឡប់ដដែល (`removeReturnedZtoBarcodes()` ➜ ធុងសំរាម `returned` · លុយ និងចំនួនកញ្ចប់ដក) · `syncZtoFinalMarks()` កត់ `ztoMisplacedAt`
  លើ barcode ➜ ធុងសំរាមស្លាក «ខុសទីតាំង» (ក្រុមដាច់ពី «ត្រឡប់») · 🔔 «📤» «📍 ខុសទីតាំង» · ស្តារបាន (មិន 🔒 ៖ ហាងច្រើនសាខាលើ DB តែមួយ សាខាផ្សេងទទួលកញ្ចប់ ·
  ក្រោយស្តារ `restoredAt` ក្រោយស្កេនបញ្ជូនចេញ ➜ មិនដកម្តងទៀត) · ប្រអប់ទាញបញ្ជី «📍 ខុសទីតាំង · ZTO ស្កេនបញ្ជូនចេញ» ·
  ស្កេនបញ្ហា `-582` តែម្យ៉ាង (ទូរស័ព្ទមិនលើក ក៏ប្រើកូដនេះ) ➜ មិនដក។
- ✍️ **ចែកចាយកញ្ចប់មានបញ្ហា** (សំណើ ៖ «ZTO Palm ពេលស្កេន ចែកចាយមិនផ្ទុករូបភាពទេនិងឈ្មោះទេ តែមានសារលោតបញ្ជាក់ បញ្ហាដូចពេល Sign ដែរ … ការ Sign ដំណើរការត្រឹមត្រូវ100%ហើយ») ៖
  ការស្កេនចែកចាយ `04` ដែល ZTO ឆ្លើយសារបញ្ហា (`newBusinessCheck` · `whetherForce: false`) បង្ហាញផ្ទាំង «⚠️ បញ្ជាក់កញ្ចប់» ដូច Sign ➜ «បញ្ជាក់ និងបន្ត» ផ្ញើ `04` ជាមួយ token ·
  «បោះបង់» ➜ មិនចែកចាយ (ស្កេនម្តងទៀតសួរម្តងទៀត) · ZTO ហាម ➜ «⛔ ZTO មិនអនុញ្ញាតឲ្យចែកចាយ» + សារ · ការចែកចាយនៅតែគ្មានរូប គ្មានឈ្មោះ · ការទទួល `05` (Sign) មិនប្រែ (A232)។
- 🍪 **Cookie ស្គាល់ «ខុសទីតាំង» ដូច Palm** (សំណើ ៖ «អោយ cookie ស្គាល់ស្ថានភាពដូច ZTO Palm login ផង cookie sync read ដូច palm ផង តែមិនអាច write») ៖ Function `?list=1&sent=1` អានបញ្ជី Argus
  `ZTO_LIST_SEND_SCAN_TYPE` (លំនាំដើម `02` ផ្ញើចេញ · `off` បិទ) ក្នុងចន្លោះដូច `returned=1` ➜ App អានជាមួយបញ្ជីត្រឡប់ (ទាញបញ្ជី · ពិនិត្យនៅខាងក្រោយម្តងក្នុងមួយម៉ោង) ➜ Barcode បើកក្នុង ZoeW
  ដែលសាខាស្កេនបញ្ជូនចេញក្រោយចូល ZoeW ➜ ធុងសំរាម «ខុសទីតាំង» (ដកលុយ · ចំនួន) · Barcode ដែលមានស្កេនត្រឡប់ក្នុងចន្លោះ ➜ «ត្រឡប់» · អានបញ្ជីបញ្ជូនចេញមិនបាន ➜ «⚠️ ពិនិត្យកញ្ចប់ខុសទីតាំង… មិនបានគ្រប់» ·
  Cookie នៅតែគ្មាន Sign (អានតែប៉ុណ្ណោះ) · ព្រំដែនទទួលស្គាល់ ៖ ជួរ (អតិថិជន + ថ្ងៃ) តែមួយដែលមានទាំងត្រឡប់ និងខុសទីតាំងក្នុងជុំដដែល ➜ ធាតុធុងសំរាមមួយ ស្លាក «ត្រឡប់» (A233)។
- 🔎 **ពិនិត្យឡើងវិញ** (សំណើ ៖ «តេស្តមុខងារថ្មី … និងការកែ ឡើងវិញមើលក្រែងមានចន្លោះ») ៖ ① rules មិនទាន់មាន `ztoMisplacedAt` ➜ ការសរសេរទាំងមូលត្រូវបដិសេធ ហើយ `ztoReturnedAt` (🔒 ស្តារ) ក៏បាត់ ➜
  ឥឡូវសរសេរម្តងទៀតដោយគ្មាន `ztoMisplacedAt` (`ztoMisplacedRefused` ៣០ នាទី) ហើយកត់ស្លាកម្តងទៀតក្រោយ Publish · ស្លាក/🔒 «ខុសទីតាំង» តាមភស្តុតាងក្នុងឧបករណ៍ ទោះ DB មានតែ `ztoReturnedAt` ·
  ② ប្រអប់ទាញបញ្ជីរាប់កញ្ចប់ខុសទីតាំងជា «ស្កេនត្រឡប់រួច» ➜ ឥឡូវ «📍 ខុសទីតាំង (បញ្ជូនចេញរួច) N» ដាច់ · ③ រូប Sign ៖ ម្ចាស់គម្រោង «Font Bold ធំពេក» ➜ អក្សរធម្មតា (`400`) · ៣.៥% នៃជ្រុងខ្លី
  (`PALM_SIGN_STAMP_SIZE`) · គ្មានគែមខ្មៅ · ពណ៌ `#ff4444` ដូចរូប ZTO Palm ពិត (វាស់ក្នុង Chromium លើរូបពិតរបស់ម្ចាស់គម្រោង) · ④ តេស្ត App + Function ពិត `ZoeW/tests/zto-palm-sign-e2e.test.tsx` ·
  ⑥ ស្តារ «ខុសទីតាំង» ៖ barcode ត្រឡប់ចូលបញ្ជីនៅកាន់ `ztoReturnedAt` · `ztoMisplacedAt` ➜ ក្រោយមក ZTO ស្កេនត្រឡប់ `-710` ពិត ➜ ស្លាក «ខុសទីតាំង» ហើយស្តារបាន
  (បំពានច្បាប់ «ត្រឡប់ ZTO 🔒») ➜ `executeRestoreItem()` ដកត្រាទាំង ២ (`ZoeW/tests/cleanup-ledger-key.test.ts` ៖ មុនកែធ្លាក់) · ⑦ APK ៖ Capacitor `BridgeWebChromeClient` មាន
  `permissionListener` តែមួយ ➜ បើកផ្ទាំង Sign លើកដំបូង សួរកាមេរ៉ា និងទីតាំងព្រមគ្នា ➜ មួយបាត់ (កាមេរ៉ាជាប់ ឬទីតាំងបាត់) ➜ សួរទីតាំងតែក្រោយកាមេរ៉ាចប់ ឬ ៨ វិ.
  (`ZoeW/tests/palm-sign-camera.test.ts` ៖ មុនកែធ្លាក់) · ព្រំដែន ៖ ហាង Cookie ដែលផ្ញើកញ្ចប់ចេញច្រើន (បញ្ជី `02` លើសពិដានទំព័រ) ➜ «⚠️ ពិនិត្យកញ្ចប់ខុសទីតាំង… មិនបានគ្រប់» · ដកតែអ្វីដែលអានបាន (មិនដកខុស)។
  ⑤ ហាងច្រើនសាខាលើ DB តែមួយ ៖ សាខា A ផ្ញើកញ្ចប់ទៅសាខា B នៃហាងដដែល ➜ A ដាក់ «ខុសទីតាំង» ហើយ 🔒 រារាំងការស្តារ ➜ B ស្កេនបញ្ចូលមិនបាន (registry កាន់ដោយធុងសំរាម) ➜ «ខុសទីតាំង» ស្តារបាន (`ZoeW/tests/zto-final-marks.test.tsx` ៖ មុនកែធ្លាក់)។
- 🧪 `ZoeW/tests/zto-palm-server.test.ts` (📍 ៧ ករណី · លំដាប់ពិតរបស់ម្ចាស់គម្រោង) · `ZoeW/tests/zto-palm-returned.test.tsx` · `ZoeW/tests/zto-final-marks.test.tsx` ·
  `ZoeW/tests/zto-returned-cleanup.test.ts` · `ZoeW/tests/palm-sign-camera.test.ts` (ម៉ោង · កូអរដោនេ · watch/clearWatch · stamp មុន JPEG · អក្សរធម្មតា គ្មានគែម) · `ZoeW/tests/zto-palm-sign.test.tsx` ·
  `emu/app-writes-rules-test` (`ztoMisplacedAt` + probe rules គ្មានវា) · `npm run android:check` · `netlify-config-scope-test` · `security-guard-test`។

**សកម្មភាពដោយដៃ** ៖ ១. ⛔ **Publish rules** `firebase-database.rules.json` ទៅគ្រប់គម្រោង Firebase (Console ➜ Realtime Database ➜ Rules ➜ Publish ឬ
`tools/firebase-provision/deploy-rules.cmd`) — មុន Publish ការកត់ភស្តុតាង ZTO លើកញ្ចប់ខុសទីតាំងត្រូវបដិសេធ (កញ្ចប់នៅតែដក · ស្លាកពឹងភស្តុតាងក្នុងឧបករណ៍) ·
Supabase ៖ migration `20261018084522_zoe_rules.sql` ចូលពេល merge ទៅ `main`។ ២. ពេលបើក «✍️ Sign» លើកដំបូង ទូរស័ព្ទសួរសិទ្ធិទីតាំង ➜ «អនុញ្ញាត» (APK ថ្មីត្រូវដំឡើង)។
៣. សាកលើកញ្ចប់ខុសទីតាំងពិត ៖ បើកក្នុង ZoeW ➜ ZTO ស្កេនបញ្ជូនចេញ ➜ ធុងសំរាម «ខុសទីតាំង» · លុយដក។

### [2.50.127] — 2026-10-18 · ZoeW ៖ ស្ថិតិ «យករួច» ត្រឹមត្រូវ ទោះ App បិទពាក់កណ្តាលការបិទ/បើកកញ្ចប់ (A225) · កញ្ចប់ Sign/ត្រឡប់ក្នុង ZTO ចាក់សោ · ធុងសំរាមថ្មីនៅលើ (A226) · Sign មួយជុំ លឿន · iOS អាន QR (A227)

**ZoeW** (`zoew-v390` ➜ `zoew-v391`) · rules ថ្មី (`firebase-database.rules.json` + `supabase/migrations/20261018011107_zoe_rules.sql`)។ សំណើម្ចាស់គម្រោង ៖ «ស៊ើប A225 បន្ត» ·
«សម្រួលធុងសំរាម អោយធាតុថ្មីៗដែលចូលក្រោយគេនៅលើគេ … កញ្ចប់ដែលស្កេនត្រឡប់រួចដាច់ខាតត្រូវតែត្រឡប់ទៅសាខាកណ្តាលវិញ … កញ្ចប់ដែល sign បិទបញ្ជីពិតពី ZTO
ក៏មិនអាចត្រឡប់មក unsign បាន … គួតែកញ្ចប់ដែលគ្រាន់តែបិទក្នុង ZoeW អាចស្តារបាន … កែប៉ូតុងអោយស្គាល់កញ្ចប់ដែល sign ហើយពិត មិនអាចបើកវិញបានក្នុង ZoeW» ·
សម្រេច ៖ «ហាមតែ ZTO ស្កេនត្រឡប់» (ត្រឡប់ថ្ងៃទី ៨ នៅស្តារបាន) · «កត់លើកញ្ចប់ក្នុង DB»។ Sign ៖ «អោយលឺសម្លេង និង ញ័រពេលស្កេនជោគជ័យ … ពត៍មានពី ZTO … វែងពេក … លើ ios មិន
recognize barcode ពីរូបភាព … ធ្វើអោយ ios ស្គាល់ទាំង QR … មាន QR មួយទៀតមិនទាក់ទងនិង ZTO … បង្កើនល្បឿន flow Sign»។ លម្អិត ៖ ផ្នែក ២ A225 · A226 · A227 · A228 · A229។

- ✅ **ស្ថិតិ «កញ្ចប់យករួច»** ៖ ការបិទ/បើកកញ្ចប់សរសេរស្ថិតិថ្ងៃ និងកញ្ចប់ ២ ដងដាច់ពីគ្នា ➜ App បិទ · Refresh · បណ្តាញដាច់ចន្លោះនោះ ➜ ស្ថិតិលើស ឬខ្វះជារៀងរហូត។ ឥឡូវ App កត់ប្រតិបត្តិការក្នុង journal `zoew_pickup_journal_v1` (ថ្ងៃ + កូនសោ barcode) ➜ ពេលបើកលើកក្រោយ (ទិដ្ឋភាពស្រស់ · ហាងដដែល) កំណត់កូនសោនីមួយៗតាមស្ថានភាព barcode ពិត ➜ Reset ចំនួនយករួចមិនកើតឡើងវិញ (មិនរាប់ថ្ងៃឡើងវិញទាំងមូល) · tab ផ្សេងដែលនៅកាន់ប្រតិបត្តិការ (Web Lock) មិនត្រូវប៉ះ។
- 🔒 **កញ្ចប់ដែលចប់ក្នុង ZTO** ៖ ភស្តុតាងកត់លើ barcode ក្នុង DB (`ztoSignedAt` ពេល ZTO ថា Sign · `ztoReturnedAt` ពេល ZTO ស្កេនត្រឡប់) ដោយការសរសេរដាច់ពីការរក្សាទុកកញ្ចប់
  (`syncZtoFinalMarks()` ៖ rules មិនទាន់ Publish ➜ ការងារផ្សេងដើរធម្មតា) ➜ ប៊ូតុង «🔒 Sign រួច» ជំនួស «❌ បើក» · ការបើកវិញបដិសេធក្នុង transaction លើតម្លៃ server ·
  ធុងសំរាម 🔒 ជំនួស 🔄 (ត្រឡប់ ZTO · «យករួច» ដែលគ្រប់ barcode Sign) · «ត្រឡប់» ថ្ងៃទី ៨ · «លុប» · «ដក» នៅស្តារបាន · Sign តាម «✍️ Sign» កត់ verdict ភ្លាម។
- 🗑️ **ធុងសំរាម** ៖ ក្រុម និងធាតុក្នុងក្រុមតម្រៀបតាម `deletedAt` ថ្មីបំផុតមុន។
- 🔳 **QR ក្នុង tab ស្កេន** ៖ ស្កេនបញ្ចូល · ដក · Locker និង «📁 យក Barcode ពីរូបភាព» អាន QR លេខកញ្ចប់លើបុងផង (iPhone · Android) · Barcode ឃើញព្រមគ្នា ➜ យក Barcode · QR ផ្សព្វផ្សាយ/link មិនរាប់។
- ♻️ **ស្តារ** ៖ ការស្តារដែលជោគជ័យមិនបង្ហាញ «❌ ស្តារទិន្នន័យបរាជ័យ» ទៀតពេលបណ្តាញអានយឺតភ្លាមក្រោយស្តារ (ការអានដែលគ្មានប្រយោជន៍ត្រូវដកចេញ)។
- ✍️ **Sign មួយជុំ** ៖ បើកផ្ទាំង ➜ ពិនិត្យស្ថានភាព ZTO គ្រប់ Barcode ស្របគ្នា ➜ ស្កេនម្តង (កាមេរ៉ា · ម៉ាស៊ីនស្កេន · ថត · Gallery) ➜ សម្លេង + ញ័រ (APK · Android; iPhone web មានតែសម្លេង) ចាប់រូប ហើយស្កេនចែកចាយ `04` ភ្លាម (រំលងបើ ZTO ចែកចាយរួច) ➜ វាយឈ្មោះ ➜ «✍️ Sign (N)» ផ្ញើស្របគ្នា ·
  សារ ZTO បត់ខ្លី (ចុចអានពេញ) · ✕ ដករូប · អាន QR លេខកញ្ចប់លើបុង ទាំង iPhone និង Android (QR ផ្សព្វផ្សាយមិនរាប់) · iOS ៖ កាមេរ៉ាអានលឿនជាងមុន · រូប/Gallery អានរូបធំ (≤ 2600px) ពិដាន 10s។
- 🧪 `ZoeW/tests/pickup-interrupted-close.test.ts` (មុនកែ ៣ ទិសធ្លាក់ ៖ បិទកញ្ចប់ ស្ថិតិ ២ ⟷ បិទ ០ · បិទ barcode ស្ថិតិ ០ ⟷ បិទ ១ · បើកវិញ ស្ថិតិ ០ ⟷ បិទ ១) · អ្នកយាមពហុឧបករណ៍ទាំង ២ រង់ចាំ journal ស្ថិតិយកទទេមុនវាស់។

- 🧪 `ZoeW/tests/scan-qr.test.ts` · `ZoeW/tests/scan-image-qr.test.ts` · `scan-engine-test` ផ្នែក QR (ZXing ពិត)។
- 🧪 `ZoeW/tests/zto-palm-sign.test.tsx` (flow មួយជុំ · ចែកចាយពេលស្កេន · សម្លេង/ញ័រ · ✕) · `ZoeW/tests/palm-sign-camera.test.ts` (QR ផ្សេងមិនរាប់ · អានលឿន/ស៊ីជម្រៅ · រូបធំ) · `scan-engine-test` ស្គាល់ `readCanvasSymbols()`។
- 🧪 `ZoeW/tests/zto-final-marks.test.tsx` · op `ztoFinal` ក្នុង `revenue-fuzz-test` + probe rules ចាស់ក្នុង `emu/app-writes-rules-test` · សេណារីយ៉ូ `syncZtoFinalMarks` ក្នុង `ZoeW/tests/session-switch-fuzz.test.ts`។

**សកម្មភាពដោយដៃ** ៖ ⛔ **Publish rules** `firebase-database.rules.json` ទៅ **គ្រប់គម្រោង Firebase របស់អតិថិជន** (Console ➜ Realtime Database ➜ Rules ➜ Publish ឬ
`tools/firebase-provision/deploy-rules.cmd`) — មុន Publish ការកត់ Sign/ត្រឡប់មិនចូល DB (ប៊ូតុង 🔒 ពឹង verdict ក្នុងឧបករណ៍តែប៉ុណ្ណោះ) · Supabase ៖ migration
`20261018011107_zoe_rules.sql` ចូលពេល merge ទៅ `main` (ឬ paste ក្នុង SQL Editor)។ Deploy ZoeW ពេលម្ចាស់គម្រោងស្នើ merge។

### [2.50.126] — 2026-10-17 · ZoeW + ZoeKeyGen `2.24.20` ៖ Deep audit ៦ — ហាងសាខាច្រើន (Palm) មិនដកលុយកញ្ចប់ដែលយកនៅសាខាផ្សេង · Push ដល់គ្រប់ហាង/ទូរស័ព្ទ · ផ្ទាំងហាង Supabase លើស ១០០០ · Sign ប្រាប់ឲ្យរង់ចាំ

**ZoeW** (`zoew-v389` ➜ `zoew-v390`) · **ZoeKeyGen `2.24.20`** (`zoekeygen-v130` ➜ `zoekeygen-v131`) · Function `zto-order-detail.js` + `_shared/zto-palm.js` (ឯកសារ LOCK ➜ sha256 ថ្មីក្នុង `tests/zto-lock.test.ts`) ·
`netlify/lib/push-core.mjs`។ សំណើម្ចាស់គម្រោង ៖ «deep audit … Network, security leak, Race, duplicate listener, service worker, backendទាំង២, money … ច្បាប់លុប/ដក,
function ZTO Palm login/Cookie … កុំជឿជាក់លើ checker … តេស្តបើថ្ងៃក្រោយ app មានអតិថិជនប្រើច្រើនសាខាច្រើន ក្នុងមួយសាខា ប្រើ2-3devices» · «សាខា នីមួយៗមានសុទ្ធតែមាន account
ZTO Palm ផ្លូវការដែលក្រុមហ៊ុនផ្តល់អោយ» ➜ ការកែឯកសារ LOCK ផ្អែកលើសំណើនេះ + កំហុសលុយដែលវាស់បាន (A215)។ លម្អិត ៖ ផ្នែក ២ «Deep audit ៦»។

- 🏢 **Function ZTO ៖ គម្រោង Firebase ដែល `FIREBASE_PROJECT_IDS` ចងសាខាច្រើន + Palm** (A215 · ការកំណត់ដែល `ZTO-SETUP-KH.md` ផ្នែក ៤គ អនុញ្ញាត) ៖ ការអានបញ្ជីចុះហត្ថលេខា
  អានគ្រប់សាខាដែលចង តាម session Palm របស់សាខានីមួយៗ ➜ កញ្ចប់ដែលអតិថិជនយកនៅសាខាផ្សេង មិនត្រូវ «ត្រឡប់» ដកលុយ។ ⛔ ម្ចាស់គម្រោង ៖ «firebase project 1 តែឯង ក្នុង 1សាខា
  មិនដូច supabase project មួយតែ ផ្ទុកទិន្នន័យសាខាច្រើន» ➜ ការរៀបចំពិតមិនចូលផ្លូវនេះ (គម្រោងចងសាខាតែមួយ ➜ `siblingBranches` = [] ➜ ឥរិយាបថដូចមុនបេះបិទ · តេស្តទិសផ្ទុយ)។
- 📲 **Push** (A216 · A217) ៖ ការរំលឹកម៉ោង ៨ ព្រឹកដើរហាង ៨ ស្របគ្នា ➜ ដល់គ្រប់ហាង · ដំណឹងអ្នកលក់ផ្ញើជាចំណែក ➜ run ដែលអស់ពិដានបន្តនៅ cron បន្ទាប់ (ម្តងគត់ក្នុងមួយទូរស័ព្ទ) ·
  Logs `push-cron` អាចឃើញ `"reason":"partial"` (ឯកសារ `ZoeW/README.md`)។
- ✍️ **Sign** (A218) ៖ ចុច «✍️ Sign» ពេលការផ្ញើមុននៅរង់ចាំ ZTO ➜ សារ «⏳ … សូមរង់ចាំបន្តិច» (មិនស្ងាត់)។
- 🏪 **ZoeKeyGen ផ្ទាំង «ហាង Supabase»** (A224) ៖ បញ្ជីហាង · គណនី · ឧបករណ៍ទាញជាទំព័ររហូតគ្រប់ ➜ ហាង/គណនីលើស ១០០០ (Max rows របស់ Supabase) បង្ហាញគ្រប់ ·
  អានគណនីមិនបាន ➜ «⚠️ អានបញ្ជីគណនីមិនបាន» ហើយ 🎟️ សុំ Refresh មុនចេញកូដអញ្ជើញ។
- 🧪 អ្នកយាមថ្មី ៖ `supabase-money-multishop-test` (គម្រោង Supabase មួយ · ហាង ២ × ឧបករណ៍ ៣ · App ពិត · Postgres ពិត) · `emu/money-multidevice-emu-test` ឧបករណ៍ ៣ +
  «ZTO ត្រឡប់» ប្រជែង · `ZoeW/tests/zto-palm-multibranch-hold.test.tsx` · `ZoeW/tests/push-server.test.ts` (ហាង ៤០០ · ទូរស័ព្ទ ៣០០០) · `ZoeW/tests/zto-palm-sign.test.tsx`។

**សកម្មភាពដោយដៃ** ៖ គ្មាន env · rules · migration ថ្មី។ Deploy ZoeW (merge ពេលម្ចាស់គម្រោងស្នើ) ➜ Function ZTO + `push-cron` ថ្មីចូលជាមួយ។ គម្រោង Firebase មួយ = សាខាមួយ
(ការរៀបចំពិត) ➜ គ្មានសកម្មភាពសម្រាប់ A215 · ថ្ងៃក្រោយបើចងសាខាច្រើនក្នុង `FIREBASE_PROJECT_IDS` ➜ សាខានីមួយៗត្រូវ Login គណនី Palm របស់ខ្លួនម្តង (សាខាមិន Login ➜ ការរង់ចាំថ្ងៃទី ៨
ការពារបានតែ `ZTO_ABANDON_HOLD_MAX_MS` ៣០ នាទី ដូច A161)។

### [2.50.125] — 2026-10-17 · ZoeW ៖ សារ Login ZTO Palm ប្រាប់មូលហេតុពិត (ឯកសារ LOCK តាមសំណើ)

**ZoeW** (`zoew-v388` ➜ `zoew-v389`) · ZoeKeyGen · Function មិនប្រែ។ ម្ចាស់គម្រោងរាយការណ៍លើ Preview ៖ «ក្រោយមកខ្ញុំចូល ម្តងទៀតបែនិយាយថា សោមិនត្រឹមត្រូវ» ·
«ZTO_PROXY_KEY ដដែល មិនប្រែខ្ញុំ copy past យ៉ាងណាក៏មិនត្រូវ ទាល់តែ clear cache site» ➜ ជ្រើស «ទុកដដែល + សារច្បាស់» (មិន Login រាល់ពេលបើក App ៖
ចំនួន Login ទៅ ZTO · session សាខារួម · ពាក្យសម្ងាត់មិននៅលើទូរស័ព្ទ)។ ⛔ ឯកសារ LOCK `src/features/zto-palm-login.ts` ប្រែតាមការជ្រើសនោះ ➜ sha256 ថ្មីក្នុង `tests/zto-lock.test.ts`។

- `palmLoginFailureText()` (Login · «ប្រើ Login Palm របស់ហាង» · toast Login ស្វ័យប្រវត្តិ) ៖ 401 គ្មាន `code` (Server បដិសេធសោភ្ជាប់) ➜ ប្រាប់ប្រភពសោ (ប្រអប់ Secret ·
  សោដែលរក្សាទុក) ចំនួនតួ ស្នាមម្រាម SHA-256 ៨ តួ និងតួអក្សរមើលមិនឃើញ ⛔ មិនបង្ហាញសោ · 401 ដែលមាន code ផ្សេង ➜ បង្ហាញ code (មិនមែនសារសោខុស) ·
  `ZTO_PALM_LOGIN_REJECTED` ➜ «Server ទទួលសោភ្ជាប់ ZoeW រួច តែ ZTO បដិសេធ…» · គ្មាន code ➜ លេខ HTTP (A213)។
- CI លើ [2.50.124] (`d5bf1be`) ៖ ផ្នែក ១ · ២ · ៤ ជាប់ · ផ្នែក ៣ ធ្លាក់តែ `css-classes` ៖ `'palm-sign-state is-' + tone` បន្សល់ `.is-` ➜ `codeTone()` ឲ្យឈ្មោះ class ពេញ
  (វាស់ក្នុងម៉ាស៊ីន ៖ `.is-` ធ្លាក់ ➜ ជាប់ · `doc-scope-test` · `version-check` ជាប់)។
- CI លើ `3bd3b8a` ផ្នែក ២ ៖ `security-guard` ៖ សារថ្មីដាក់ឈ្មោះ env សោ Server ក្នុង bundle client (⛔ ច្បាប់ «Public repo») ➜ សារនិយាយ «សោភ្ជាប់ ZoeW ពីការកំណត់ Netlify»
  ជំនួសឈ្មោះ env · sha256 LOCK ធ្វើបច្ចុប្បន្នភាពម្តងទៀត (វាស់ក្នុងម៉ាស៊ីន ៖ `security-guard-test` 55 ok · 0 FAIL)។

**សកម្មភាពដោយដៃ** ៖ គ្មាន env · rules។ ពេល «សោភ្ជាប់ ZoeW មិនត្រឹមត្រូវ» លើកក្រោយ ➜ ថតសារទាំងមូល (ប្រភព · ចំនួនតួ · ស្នាមម្រាម) **មុន** clear site data
➜ ធៀបស្នាមម្រាមជាមួយទូរស័ព្ទដែល Login បាន ➜ ដឹងថាទូរស័ព្ទផ្ញើសោខុស ឬ Server ប្រើសោផ្សេង។

### [2.50.124] — 2026-10-17 · ZoeW ៖ Audit Sign ZTO Palm (PR #330) · ផ្ទាំង Sign រចនាឡើងវិញ · ពង្រឹងពេលប្រើច្រើន

**ZoeW** (`zoew-v387` ➜ `zoew-v388`) · ZoeKeyGen មិនប្រែ · Function ប្រែតែ `_shared/zto-palm-sign.js` (ក្រៅ LOCK) · ⛔ ឯកសារ LOCK ZTO មិនប៉ះ។
សំណើម្ចាស់គម្រោង ៖ «ពិនិត្យ PR#330 Audit ពង្រឹងមុខងារថ្មី មើលវាស៊ីសង្វាក់ជាមួយ app ទេ? … flow modal/ui ប៉ូតុង security, backend ទាំងពី ZTO palm/cookie blob
បើថ្ងៃក្រោយ app មានអ្នកប្រើច្រើន … កែលម្អ ប៉ូតុង និង modal មុខងារថ្មីអោយស្អាតផង» · «រចនារួចថតអោយខ្ញុំមើលផង»។

- ផ្ទាំង Sign ៖ ជំហាន «១ ចែកចាយ ➜ ២ ទទួល» · វីដេអូមានស៊ុមតម្រង់ និងប៊ូតុង «🔄 បើកកាមេរ៉ាឡើងវិញ» លើវីដេអូ · កាមេរ៉ាផ្អាក ➜ សរសេរមូលហេតុលើវីដេអូ
  (វាយឈ្មោះ · កំពុងពិនិត្យ · រង់ចាំបញ្ជាក់) · កាតកញ្ចប់មានស្លាកស្ថានភាពតាមពណ៌ និងរូបតូច · ផ្ទាំងបញ្ជាក់ ZTO នៅលើបញ្ជីកញ្ចប់ · 📷/🖼 ស្មើគ្នាជួរតែមួយ ·
  «⬆ ផ្ញើបញ្ជី (N)» · «បន្ទាប់» ពណ៌បៃតង។ ប៊ូតុង «✍️ Sign» ក្នុងជួរប្រវត្តិ និងបញ្ជី Barcode មិនប្រែ (ពណ៌ដូច «✅ បិទ»)។
- កំហុសដែលរកឃើញ និងកែ (ផ្នែក ២ ៖ A207–A212) ៖ ជួរកញ្ចប់ត្រួតលើគ្នា · Login Palm បន្តពេលកំពុងផ្ញើបោះចោលចម្លើយ ZTO · ភស្តុតាងចែកចាយចាស់គ្មានផ្លូវបន្ត ·
  ប៉ះផ្ទៃងងឹតបិទផ្ទាំង Sign · Server បដិសេធ 429 ក្រោយ Sign ២៥៦ ក្នុង ១០ នាទី · ជំហានចែកចាយផ្ញើរូបដែល Server មិនប្រើ។
- `CLAUDE.md` ៖ ជួរ «ZTO Palm lookup» ឲ្យត្រូវនឹង PR (endpoint សរសេរតែផ្លូវ Sign ដែលអ្នកប្រើចុច · ⛔ endpoint បង់ប្រាក់) · ជួរថ្មី «ZTO Palm Sign» · Modals · Hardware scanner។

**សកម្មភាពដោយដៃ** ៖ គ្មាន env · rules · migration ថ្មី។ លើ Preview (ទូរស័ព្ទពិត) ៖ បើក Sign ➜ ពិនិត្យរូបរាងជំហានទាំង ២ · ប៉ះខាងក្រៅផ្ទាំង ➜ នៅបើក ·
កញ្ចប់ ២–៣ ចែកចាយ ➜ ទទួល ➜ ZTO Palm និង ZoeW បិទត្រូវ ហើយរូបទទួលឃើញក្នុង ZTO។

### [2.50.123] — 2026-10-17 · ZoeW ៖ លេខមួយមានកញ្ចប់ច្រើន និងបិទផ្ទាំង Sign ពេលចប់

**ZoeW** (`zoew-v385` ➜ `zoew-v387`) · ZoeKeyGen មិនប្រែ។ ម្ចាស់គម្រោងបញ្ជាក់ Preview «wow ជោគជ័យហើយ» ហើយស្នើសាកលេខទូរស័ព្ទមួយមាន ២–៣ កញ្ចប់ និងបិទ modal ក្រោយ Sign ជោគជ័យ។

- បិទផ្ទាំង និងបង្ហាញសារចំនួនកញ្ចប់ ក្រោយ Barcode ទាំងអស់ក្នុងវគ្គ Sign ទទួលជោគជ័យ និងរក្សាទុកក្នុង ZoeW។ ជ្រើសតែខ្លះ ឬកញ្ចប់មួយនៅរង់ចាំបញ្ជាក់/ចម្លើយ/ការរក្សាទុក ទុកផ្ទាំងបើក។ ការពិនិត្យស្ថានភាពដែលរកឃើញទទួលរួច ក៏បិទផ្ទាំងពេលគ្រប់ដែរ។
- តេស្ត ២ និង ៣ កញ្ចប់ធ្លាក់មុនកែ ព្រោះ modal មិនបិទ។ ផ្ទៀងផ្លូវបិទពិត និង transaction តាម Barcode៖ បិទ parent តែក្រោយកញ្ចប់ចុងក្រោយ, កញ្ចប់ ២/៣ តែអតិថិជន ១ និង COD/DOD ត្រូវគ្នា។ មិនកែ function លុយ/បិទកញ្ចប់។
- CI រកឃើញ `css-classes` ធ្លាក់ ព្រោះ `.palm-sign-problem` គ្មាន rule; ភ្ជាប់ style អក្សរនិងទម្ងន់ដូចសារព្រមានរបស់ផ្ទាំង Sign។
- ការរត់ audit ក្នុងម៉ាស៊ីនលើកំណែមុននេះ ផ្នែកតេស្តទាំងអស់លើសពេល 240s ពេលរត់ជាមួយការវាស់ធ្ងន់ ៤ lane។ រត់ឡើងវិញលើកំណែថ្មីដោយ lane តិច ដោយរក្សា assertion និងពិដានដដែល; CI ត្រូវវាស់ទាំង ៤ ផ្នែក។

**សកម្មភាពដោយដៃ**៖ សាកលេខមួយ ២–៣ កញ្ចប់៖ ទទួលគ្រប់រួច ផ្ទាំងបិទ និងចំនួនយករួចត្រូវ; កញ្ចប់មួយត្រូវការបញ្ជាក់ ឬបរាជ័យ ទុកផ្ទាំងឲ្យបន្ត។

### [2.50.122] — 2026-10-17 · ZoeW ៖ ជ្រើសរូបពី Gallery ក្នុង Sign

**ZoeW** (`zoew-v384` ➜ `zoew-v385`) · ZoeKeyGen មិនប្រែ។ សំណើម្ចាស់គម្រោង៖ «អោយមានកន្លែងយករូបពី gallery ផង»។

- ប៊ូតុង «🖼 ជ្រើសរូបពី Gallery» ដាច់ពី «📷 ថតរូបកញ្ចប់»; Gallery ប្រើ picker គ្មាន `capture`។ បង្រួមរូបជា JPEG និងអាន Barcode ពីរូប តាមផ្លូវដែលមានស្រាប់។ បើ decoder អានមិនបាន វាយ Barcode ជាមុន ហើយជ្រើសរូបវិញ។
- រូបជ្រើសដោយដៃអាចជំនួសរូប auto capture មុនផ្ញើ; camera scan ធម្មតាមិនជំនួសរូបដែលបានជ្រើស។ ពេលរង់ចាំបញ្ជាក់ ឬលទ្ធផល upload មិនច្បាស់ មិនអនុញ្ញាតជំនួសរូប។ តេស្តបង្ហាញការជំនួសរូបធ្លាក់មុនកែ។

**សកម្មភាពដោយដៃ**៖ សាក Gallery លើ Android/iPhone៖ ជ្រើសរូបមាន Barcode និងរូបដែលត្រូវវាយ Barcode ដោយដៃ; ផ្ទៀង thumbnail និងរូបនៅ ZTO ក្រោយ Sign ជោគជ័យ។ គ្មាន env ឬ rules ថ្មី។

### [2.50.121] — 2026-10-17 · ZoeW ៖ ស្គាល់សារកញ្ចប់មានបញ្ហា និងបញ្ជាក់មុនទទួល

**ZoeW** (`zoew-v383` ➜ `zoew-v384`) · ZoeKeyGen មិនប្រែ។ ម្ចាស់គម្រោងផ្ញើរូប Palm សួរបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ និងរូប ZoeW បដិសេធដោយសារទូទៅ។

- ផ្ទៀង APK៖ `BillCodeScanCheck` ផ្ញើ `message`/`whetherForce` ទៅ `SignScanActivity.showBillCodeCheckDialog`; `false` អនុញ្ញាតបញ្ជាក់ ហើយបន្តទៅ `addScanInfoToAEGS`; `true` មានតែបោះបង់។ ZoeW បង្ហាញសារពិតតាម Barcode និងសញ្ញាព្រមាន មុនផ្ញើរូប/បញ្ជីទទួល។
- Tracking ពីម្ចាស់គម្រោងបង្ហាញ `-579` (ទាក់ទងមិនបាន), `-71`/`-588` (ចែកចាយច្រើនលើក) និង `4` ដើម។ ពេលបើក Sign បង្ហាញស្កេនបញ្ហាថ្មីបំផុត (`29`/`-579` ឬ marker បញ្ហាច្បាស់ពី ZTO) ត្រូវ Barcode/សាខា/វដ្តបច្ចុប្បន្ន។ ស្កេនចែកចាយច្រើនលើកមិនចាត់ជាបញ្ហា; `-71`/`-588` ដែលចង `preOrNextID: "04"` ត្រូវសាខា/វដ្ត អាចរំលងចែកចាយដូច `4`។ ស្លាកបញ្ហាមិនជំនួសការបញ្ជាក់ពី ZTO។
- «បញ្ជាក់ និងបន្ត» អនុម័តតែកញ្ចប់នោះ។ «បោះបង់» មិនសរសេរទៅ ZTO។ កាមេរ៉ា ឈ្មោះ និងជម្រើសកញ្ចប់ផ្អាកពេលរង់ចាំបញ្ជាក់។ ផ្លាស់ហាង/គណនី/Config ឬបិទផ្ទាំង បញ្ជាក់ចាស់មិនអាចបន្ត។
- Server អ៊ិនគ្រីបភស្តុតាងបញ្ជាក់ចង session/Barcode/request/ឈ្មោះ/រូប/ភស្តុតាងចែកចាយ និងសារព្រមាន រយៈពេល ៥ នាទី។ ពិនិត្យ ZTO ម្តងទៀត; សារថ្មីទាមទារបញ្ជាក់ថ្មី។ ការហាមបន្ត និងកំហុស upstream មិនបម្លែងទៅការអនុម័ត។ សារ `90187`/`90189` ដែលត្រូវការផ្លូវ retry ផ្សេង នៅបង្ហាញមូលហេតុ ហើយមិនប្តូរ ignore flags។

**ការផ្ទៀងផ្ទាត់**៖ តេស្ត server និង React ថ្មីធ្លាក់លើកូដមុនកែ (បដិសេធជំនួសសួរ; គ្មានផ្ទាំងបញ្ជាក់)។ ផ្ទៀងបោះបង់ បញ្ជាក់ បញ្ជាក់ស្ទួន Barcode ច្រើន ភស្តុតាងក្លែង/ផុតកំណត់ សារប្តូរ និងចម្លើយ upload បាត់។

**សកម្មភាពដោយដៃ**៖ ក្រោយ deploy សាកកញ្ចប់មានបញ្ហាដូចរូប៖ ពិនិត្យសារត្រូវ ZTO ➜ បោះបង់ម្តង (នៅបើក) ➜ ក្រោយដោះស្រាយបញ្ហា បញ្ជាក់ ➜ ផ្ទៀងទទួលជោគជ័យក្នុង ZTO Palm និង ZoeW។ គ្មាន env ឬ rules ថ្មី។

### [2.50.120] — 2026-10-17 · ZoeW ៖ Sign ZTO Palm ពីរជំហាន និងរំលងចែកចាយដែលធ្វើរួច

**សំណើម្ចាស់គម្រោង**៖ Palm mode ប្តូរ «បិទ» ទៅ «Sign»; Cookie ពី Blob ត្រឡប់ជា «បិទ»។ តាមការបញ្ជាក់ចុងក្រោយ៖ ស្កេនចែកចាយ/ចាប់រូប/ផ្ញើបញ្ជី ➜ វាយឈ្មោះអតិថិជន ➜ ស្កេនទទួល/ចាប់រូប/ផ្ញើបញ្ជី។ ចែកចាយរួចរំលងទៅទទួល។ ទាញ `main` ថ្មី `a05af2ee` ដែលមាន shared Palm session មុនបន្ត។

- ផ្ទៀង resource ខ្មែរ `dispatch_scan` និង `sign_scan` ក្នុង APK ព្រមទាំង `DispatchScanPresenter`, `SignScanPresenter`, `ScanDataUploadInterceptor` និង `ImageUploadInterceptor`។ ផ្លូវត្រឹមត្រូវប្រើ `newBusinessCheck` + `saveScanInfo` (`04`/`05`); មិនប្រើផ្លូវ KH online-payment `uploadKhSignScan` ទេ។ រូបទទួល `picType: 1`; APK មិនភ្ជាប់ bitmap ក្នុង record ចែកចាយ។
- React media exit `attachPalmSignStream` នៅ `refs.ts` ចង `srcObject`; purity guard កំណត់ពិដានការសរសេរនេះត្រឹម ១ កន្លែង និងមានតេស្តបិទ stream ក្រោយ permission ឆ្លើយយឺត។
- Camera ចាប់រូបពី frame ដដែលដែល decoder អាន Barcode។ ទទួលត្រូវមានឈ្មោះមុនបើកស្កេន ហើយចាប់រូបថ្មីក្រោយប្តូរជំហាន។ គាំទ្រ hardware Enter/Tab និង file capture ជាជម្រើស។ បិទផ្ទាំងឬប្តូរហាង លុបរូប និងវគ្គ Sign។
- Server ផ្ទៀង tracking ត្រូវ Barcode/សាខា/ពេល និងចេញភស្តុតាងចែកចាយអ៊ិនគ្រីបចង session/Barcode/requestId។ ទទួលដោយគ្មានភស្តុតាងមិនអនុញ្ញាត។ ចែកចាយរួចត្រូវមិនចាស់ជាងការមកដល់ថ្មី/ត្រឡប់/ផ្ទេរសាខា។ មិនទុកចិត្ត flag ពី client។
- ប្រើ session ទូរស័ព្ទ និង shared session របស់សាខា។ Login username ជាអ្នកចែកចាយ ដូច APK។ អាច renew និងសាកម្ដងទៀតតែការអាន status; scan write មិន replay ស្វ័យប្រវត្តិ។ លទ្ធផល upload ជាបញ្ជីបរាជ័យតាម barScannerId; បាត់ចម្លើយទុកមិនច្បាស់។ បិទ ZoeW តាម `applyBarcodeCloseChange` ក្រោយទទួលជោគជ័យប៉ុណ្ណោះ។
- អ្នកយាម App Lock ស្រង់ function ដោយ Acorn ដើម្បីកុំឲ្យ quote ក្នុង regex ស្រង់ឆ្លង function; អ្នកយាម logout ប្រើ function ទាំងមូល និង mutation ដក reset ជំនួសចម្ងាយ ២០០ តួ។ បន្ថែម coverage mapping សម្រាប់ឯកសារ Sign។

**ការផ្ទៀងផ្ទាត់**៖ តេស្ត ZTO ៤២ ឯកសារ/៦៧៤ ករណីឆ្លង; browser ទូរស័ព្ទ 390×844 ផ្ទៀងចាប់រូបស្វ័យប្រវត្តិ ស្កេនពីរជំហាន វាយឈ្មោះមុនស្កេនទទួល និង Cookie ត្រឡប់ «បិទ» ដោយគ្មាន page error។ Typecheck, lint, build, purity, wiring, CSP និងឯកសារឆ្លង។ CI ពេញត្រូវតាមដានលើ PR។

**សកម្មភាពដោយដៃ**៖ ក្រោយ deploy សាក Palm និង shared Palm លើកញ្ចប់ពិតមួយមិនទាន់ចែកចាយ និងមួយចែកចាយរួច; វាយឈ្មោះ ស្កេន ចាប់រូប ផ្ញើ និងផ្ទៀងលទ្ធផលក្នុង ZTO Palm។ ប្តូរទៅ Cookie ហើយផ្ទៀង «បិទ»។ គ្មាន env ឬ database rules ថ្មី។ មិនទាន់សាកសរសេរលើ ZTO ផលិតកម្មពីបរិស្ថាននេះ។

### [2.50.119] — 2026-10-17 · ZoeW ៖ Login ZTO Palm ម្តង ប្រើបានគ្រប់ទូរស័ព្ទក្នុងសាខា (session ទុកលើ Server តាមសាខា) · ដកសំណល់ `expired`

**ZoeW `2.50.119`** (`zoew-v381` ➜ `zoew-v382`) · ⛔ ZoeKeyGen មិនប្រែ · Function ZTO ប្រែ (`zto-order-detail.js` · `_shared/zto-palm.js` ៖ session Palm តាមសាខាក្នុង Netlify Blobs) ·
rules មិនប្រែ · គ្មាន migration · គ្មាន env ថ្មី (ប្រើ `ZTO_PALM_SESSION_SECRET` និង store `zto-auth` ស្រាប់)។
ម្ចាស់គម្រោង ៖ «អោយ ZTO Palm login ដំណើរការដូច Cookie blob 100%» · «Login Palm ម្តង ប្រើគ្រប់ទូរស័ព្ទ … បើសាខាផ្សេងគ្នា មាន Account Palm សម្រាប់សាខាខ្លូនឯងគ្រប់សាខា» ·
«ស្វែងរកពាក្យ expired ផុតកំណត់ លុបចេញអោយអស់ ព្រោះ App លែងមានមុខងារហ្នឹងទៀតហើយ» ➜ តំបន់ចាក់សោ ZTO (`zto-palm-login.ts` · `_shared/zto-palm.js` · `zto-order-detail.js` ·
`lookup-api.ts`) និងតំបន់ហាម (`app.css` ៖ ជួរ CSS ងាប់មួយ) កែតាមសំណើទាំងនេះ · របាយការណ៍ម្ចាស់គម្រោងលើ Preview ៖ «ពេលទូរស័ព្ទមួយទៀតផ្តាច់ទូរស័ព្ទមួយទៀត
លោត Session ZTO Palm ផុតកំណត់» (សោដដែល · សាខាតែមួយ · backend តែមួយ) ➜ `zto-list-sync.ts` · `auto-lookup.ts` កែដែរ · `LOCK` ថ្មី · មូលហេតុ ➜ ផ្នែក ២ A203–A206។

#### អ្វីដែលខុសពីមុន

- 🔐 **Login ZTO Palm ទុកលើ Server តាមសាខា** (ដូច Cookie Blob) ៖ Login ក្នុង «API ស្វែងរកអតិថិជន» ➜ Function ទុក token ZTO (AES-GCM ដោយសោដេរីវេពី
  `ZTO_PALM_SESSION_SECRET` · ចងនឹងសោភ្ជាប់) ក្នុង store `zto-auth` key `palm-session/<ស្លាកសោ>/<លេខសាខា>` ➜ ទូរស័ព្ទទុកតែ `palmShared: true` + គណនី (សាខា · ឈ្មោះ) ·
  ⛔ គ្មាន session · `refreshToken` · ពាក្យសម្ងាត់ក្នុងទូរស័ព្ទ។
- 📱 **ទូរស័ព្ទផ្សេងក្នុងសាខាដដែល** ៖ «ប្រើ Login Palm របស់ហាង» (`?palm=status`) ➜ ភ្ជាប់ភ្លាម ➜ ស្កេន · ទាញបញ្ជី · បិទតាម ZTO ដោយមិន Login · សាខាមកពីគណនី ZoeW
  (Firebase `@zoew<សាខា>.com` · Supabase `branch_code`) ឬពីសាខាតែមួយគត់ដែលមាន session ➜ ទូរស័ព្ទផ្ញើ `X-Zoe-Palm-Site`។
- 🏢 **សាខាច្រើនប្រើសោភ្ជាប់ដដែល** ៖ សាខានីមួយៗ Login គណនី Palm របស់ខ្លួន ➜ session ដាច់ពីគ្នា (មិនជាន់គ្នា) · គណនី ZoeW សាខា A មិនប្រើ session សាខា B (`branch:palm-other-branch`)។
- 🔄 **Server Login ឡើងវិញដោយខ្លួនឯង** ៖ session អាយុ ≥ ៤ ម៉ោង ➜ ឆ្លើយភ្លាម ហើយ Login នៅ background (lease រវាង container) · ZTO បដិសេធ token (401) ➜ Login ម្តង
  (single-flight) ហើយបន្តសំណើ · ZTO បដិសេធគណនី ➜ Server ចំណាំ ➜ គ្រប់ទូរស័ព្ទប្រាប់ «Login ZTO Palm ម្តងទៀត» (មិនព្យាយាមរាល់សំណើ) · បណ្ដាញធ្លាក់ ➜ 503 (សាកម្តងទៀត)។
- 🔌 **«ផ្តាច់ Palm»** ផ្តាច់តែទូរស័ព្ទនោះ (មិនសួរ · មិនហៅ Server) ៖ Login Palm របស់សាខានៅលើ Server ➜ ទូរស័ព្ទផ្សេងស្កេន · ទាញបញ្ជីបានដដែល · «ប្រើ Login Palm របស់ហាង» ភ្ជាប់វិញ ·
  Server គ្មានផ្លូវលុប Login របស់សាខា (`?palm=logout` ឆ្លើយ 405) ➜ Login ដោយគណនីថ្មីជំនួស Login ចាស់។
- 🔑 Server ឆ្លើយ 401 ដោយមូលហេតុ ➜ ទាញបញ្ជី និងស្កេនប្រាប់មូលហេតុពិត (`palmSessionLostText()`) ៖ «Login ZTO Palm របស់សាខានេះមិនមាននៅលើ Server» (`palm:no-session`) ·
  «ZTO បដិសេធ Login Palm របស់សាខានេះ» (`palm:login-rejected`) · «Server អាន Login Palm … មិនបាន» (`palm:unreadable`) · «Server មិនស្គាល់សាខា…» (`palm:branch-unknown`) ·
  «Session ZTO Palm ផុតកំណត់» នៅតែសម្រាប់ session ផ្ទាល់ទូរស័ព្ទ ឬ 401 ដែលគ្មានមូលហេតុ។
- 📲 ទូរស័ព្ទដែល Login Palm លើកំណែចាស់ (មាន `refreshToken`) ➜ refresh ម្តង ➜ ចូលរួម session សាខា ហើយលុប session ផ្ទាល់ · Blobs សរសេរមិនបាន ➜ session នៅលើទូរស័ព្ទដូចមុន (`shared: false`)។
- 🩺 ជួរ Lookup (Palm) ៖ session ហាង ➜ សួរ Server (`?palm=1&diag=1`) មិនមែនអាន session ក្នុងទូរស័ព្ទ។
- 🧹 **ដកសំណល់ `expired`** (មុខងារ «ផុតកំណត់» ត្រូវជំនួសដោយ «ត្រឡប់» តាំងពី 2.50.117) ៖ ថេរ `EXPIRED_TRASH_RETENTION_MS` ➜ `RETURNED_TRASH_RETENTION_MS` (តម្លៃដដែល ២ ថ្ងៃ) ·
  ជួរ CSS ងាប់ `.trash-tag-expired` (គ្មានធាតុប្រើ · ស្លាក «ត្រឡប់» ប្រើ `.trash-tag-returned` ក្នុង `react-root.css`) · checker `expired-trash-retention-test` ➜
  `returned-trash-retention-test` · ចំណងជើងតេស្ត/checker · README ឈប់ហៅកញ្ចប់ត្រឡប់ថា «ផុតកំណត់»/`expired` · ⛔ ឥរិយាបថ App មិនប្រែ ·
  នៅរក្សា «ផុតកំណត់» ដែលពិត ៖ Activation Key · ហាង Supabase · វគ្គ Login ៤ ម៉ោង · Session Palm · កូដអញ្ជើញ/កូដប្តូរពាក្យសម្ងាត់ · អ្នកយាមអវត្តមាន `expired`។
- 📄 `announcements.json` ៖ ចំណុចតែជុំនេះ · `guide.html` · `ZoeW/docs/ZTO-PALM.md` · `ZoeW/ZTO-SETUP-KH.md` · `CLAUDE.md` (ជួរ «ZTO Palm lookup» · ថេរ `RETURNED_TRASH_RETENTION_MS`)។

#### អ្នកយាម

- `ZoeW/tests/zto-palm-shared.test.ts` (ថ្មី · ១៩ ៖ Function ពិត + Blobs ក្លែង ៖ ទូរស័ព្ទគ្មាន session ស្កេនបាន · ហាង/សោផ្សេងមិនឃើញ · Blob ចម្លងទៅសោផ្សេងបើកមិនបាន ·
  401 ➜ Login ម្តងទោះស្កេនព្រមគ្នា ៥ · container ច្រើន ➜ lease CAS · ការបដិសេធគណនីចំណាំក្នុង Blob · Blobs គាំង/ធ្លាក់ · `?palm=logout` ➜ 405 Blob នៅ · diag · សាខា ២ · `require` សាខាផ្សេង) ·
  `ZoeW/tests/zto-palm-shared-app.test.tsx` (ថ្មី · ១២ = ៦ × backend ២ ៖ App ពិត A Login ➜ B ប្រើ Login ហាង ➜ ទាញបញ្ជី · token ងាប់ ➜ Server Login ឡើងវិញ · ទូរស័ព្ទកំណែចាស់ ·
  «ផ្តាច់ Palm» លើ A ➜ B ទាញបាន · Server គ្មាន Login ➜ សារមូលហេតុពិត · សាខា B តាមគណនី ZoeW) · `ZoeW/tests/zto-palm-login.test.tsx` · `ZoeW/tests/zto-palm-server.test.ts` (គ្មាន token ក្នុងទូរស័ព្ទ ➜ Server សម្រេច) ·
  `ZoeW/tests/zto-lock.test.ts` (sha256 ថ្មី ៦) · `ZoeW/tests/forbidden-zone-lock.test.ts` (sha256 `app.css` ថ្មី) · `returned-trash-retention-test` (ឈ្មោះថ្មី · ការអះអាងដដែល) · `zto-cookie-session-test` · `code-duplication-test` · `clock-hygiene` (ធ្លាក់លើ commit ទី ១ ➜ A205)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.119) ➜ ទូរស័ព្ទ A ៖ Login ZTO Palm ➜ ស្កេន/ទាញបាន · ទូរស័ព្ទ B (សាខាដដែល · មានតែសោភ្ជាប់) ៖ «ប្រើ Login Palm របស់ហាង» ➜ ស្កេន/ទាញបានដោយមិនវាយពាក្យសម្ងាត់ (✅ ម្ចាស់គម្រោងបញ្ជាក់លើ Preview) ·
   ⛔ មិនទាន់វាស់លើ ZTO ពិតថា token តែមួយប្រើលើទូរស័ព្ទច្រើនព្រមគ្នា ZTO ព្រម (ZTO បដិសេធ ➜ Server Login ឡើងវិញដោយខ្លួនឯង តែបើវាបដិសេធញឹកញាប់ ➜ ប្រាប់)។
2. ទូរស័ព្ទ A ចុច «ផ្តាច់ Palm» ➜ មិនសួរ · ទូរស័ព្ទ B (សាខាដដែល) ស្កេន/ទាញបានដដែល (មិនលោត «ផុតកំណត់») · A ចុច «ប្រើ Login Palm របស់ហាង» ➜ ភ្ជាប់វិញដោយមិនវាយពាក្យសម្ងាត់
   (✅ ម្ចាស់គម្រោង ៖ «សាកលើ Preview រួចហើយ ដំណើរការល្អ»)។
3. សាខាពីរប្រើសោភ្ជាប់ដដែល ➜ Login គណនី Palm នៃសាខានីមួយៗ ➜ ទាញបញ្ជី ➜ ឈ្មោះ/លេខសាខាត្រូវ។
4. គ្មាន rules · env · migration (Function deploy ជាមួយ App · ប្រើ Netlify Blobs ស្រាប់)។

### [2.50.118] — 2026-10-17 · ZoeW ៖ ZTO Palm ទាញបញ្ជីកញ្ចប់មកដល់រសៀលគ្រប់ · ធុងសំរាម ចុចកាត «➖ ដក + ត្រឡប់» មើលតែប្រភេទនោះ · កញ្ចប់ត្រឡប់ដកតែពេលភស្តុតាងហត្ថលេខាគ្រប់ · Barcode ស្តាររួចមិនដកម្តងទៀត

**ZoeW `2.50.118`** (`zoew-v380` ➜ `zoew-v381`) · ⛔ ZoeKeyGen មិនប្រែ · Function ZTO ប្រែ (`_shared/zto-palm.js` ៖ tab `4d`) · rules មិនប្រែ · គ្មាន migration · គ្មាន env ថ្មី។
ម្ចាស់គម្រោង ៖ «deep audit … ពង្រឺងល្បឿន ZTO ទាញបញ្ជី/Lookup/ស្កេនត្រឡប់ ដកចូលធុងសំរាមតាម … អានកូដរកកំហុស ឬ ចន្លោះ … កុំជឿជាក់លើ checker» ·
«ក្នុងធុងសំរាមពេលចុច កន្លែង ដក+ត្រឡប់ អោយlistបង្ហាញតែកញ្ចប់ ដកនិងត្រឡប់» ➜ តំបន់ចាក់សោ ZTO (`zto-status.ts` · `zto-list-sync.ts` · `zto/model.ts`) កែតាមសំណើនេះ ·
`LOCK` ថ្មី · មូលហេតុ ➜ ផ្នែក ២ A196–A202។

#### អ្វីដែលខុសពីមុន

- 📥 **ទាញបញ្ជី ZTO Palm** (របាយការណ៍ម្ចាស់គម្រោង ៖ ថ្ងៃ 10-17 ដដែល Cookie ៦១ ថ្មី ⟷ Palm ៤៧ · កញ្ចប់មកដល់ 13:59–14:32 ខ្វះ · App Palm ឃើញវាក្នុង tab «បញ្ជូន») ៖
  Function អាន tab «បញ្ជូន» ២ ដង ៖ គ្មានថ្ងៃ (ដដែល) និងតាម `dispEmpDateFrom`/`dispEmpDateTo` លើចន្លោះជ្រើស ➜ max(ដល់ថ្ងៃ, ថ្ងៃនេះ) ដូច App Palm (`4d`) ·
  track នៅតែជាភស្តុតាងមកដល់តែមួយ (ថ្ងៃចាត់មិនមែនថ្ងៃមកដល់)។
- 🗑️ **ធុងសំរាម** ៖ កាត «➖ ដក + ត្រឡប់» និង «✅ យករួច + លុប» ជាប៊ូតុង ➜ ចុច ➜ បញ្ជីតែប្រភេទនោះ (កាតមានគែមដិត · `aria-pressed`) · ចុចកាតដដែល ➜ ទាំងអស់ ·
  ការស្វែងរកដំណើរការជាមួយ · កាតទាំង ២ នៅតួលេខពេញ · បន្ទាត់ «សរុប» រាប់តែប្រភេទដែលបង្ហាញ («បង្ហាញតែ ➖ ដក + ត្រឡប់») · បិទប្រអប់ ឬចាកចេញ ➜ តម្រងបាត់ ·
  បង្ហាញតែប៉ុណ្ណោះ (🔄/✖️ នៅលើ id មួយ · គ្មានការសរសេរ)។
- ↩️ **ពិនិត្យនៅខាងក្រោយ (Cookie)** ៖ ដកកញ្ចប់ត្រឡប់តែពេលអានបញ្ជី «ចុះហត្ថលេខា» បានពេញ ហើយមិនដកកញ្ចប់ណាដែលមានក្នុងបញ្ជីនោះ (មុននេះ ៖ ដករាល់ជុំ ហើយលើកលែងតែ ≤ ១០ ដែលបិទក្នុងជុំ)។
- 📥 **ទាញបញ្ជី (Cookie)** ៖ បញ្ជីចុះហត្ថលេខាអានមិនគ្រប់ (`signedState` ≠ `ok`) ➜ មិនដកកញ្ចប់ត្រឡប់ · ជួរ «↩️» ប្រាប់ «📌 បើកក្នុង ZoeW · អានបញ្ជីចុះហត្ថលេខាមិនគ្រប់ ➜ មិនទាន់ដក (ទាញម្តងទៀត)»
  (កុងតាក់បិទ ➜ សារកុងតាក់ដដែល)។
- 🔄 **ស្តាររួចមិនដកម្តងទៀត** ៖ ការដកកញ្ចប់ត្រឡប់ផ្ញើម៉ោងត្រឡប់ក្នុងមួយ Barcode (`returnedAt`) ហើយ transaction ពិនិត្យជាមួយ Barcode លើ Server (`barcodeReturnCounts()` ៖ `createdAt` · `restoredAt`) ➜
  ទូរស័ព្ទដែល view មិនទាន់ឃើញការស្តារ មិនដក Barcode នោះម្តងទៀត។
- ⏱ ចាកចេញ · ប្តូរហាង · ប្តូរ Config Lookup ➜ វគ្គថ្មីអានបញ្ជីត្រឡប់ (Cookie) ភ្លាម (មុននេះ ៖ រង់ចាំដល់ ១ ម៉ោងរបស់វគ្គមុន)។
- 💰 **ស្តារធាតុ «ត្រឡប់»** ៖ ពេលស្ថិតិចំណូលថ្ងៃលើទូរស័ព្ទនោះមិនទាន់ Sync ហើយធាតុមិនទាន់សម្គាល់ «ដករួច» ➜ «⏳ ស្ថិតិចំណូលមិនទាន់ Sync — សូមរង់ចាំបន្តិច ហើយស្តារម្តងទៀត»
  (មិនស្តារដោយមិនបូកលុយវិញ) · Sync រួច ➜ ស្តារ ហើយបូកវិញធម្មតា។
- 📄 ឯកសារ ៖ `CLAUDE.md` បញ្ជីតំបន់ចាក់សោ ZTO = គ្រប់ឯកសារក្នុង `LOCK` (`zto-palm-login.ts` · `_shared/zto-palm.js` ខ្វះ) · «📌» Handoff ៖ `main` 2.50.117 (មុន ៖ 2.50.111) · branch `claude/zto-audit`
  merge រួចជា PR #326 (មុន ៖ «មិនទាន់ merge») · `trash-modal-test` ស្លាក «ដក + ត្រឡប់»។

#### អ្នកយាម

- `ZoeW/tests/trash-reason-filter.test.tsx` (ថ្មី · ៦ ៖ ចុច · ចុចម្តងទៀត · ប្តូរកាត · ស្វែងរក + តម្រង · ទទេ · បិទប្រអប់ · ទំព័រដំបូង · id ពិត · `ACTION_ALLOWLIST`) ·
  `ZoeW/tests/zto-returned-cleanup.test.ts` +៧ (៤ ធ្លាក់លើ 2.50.117) · `trash-modal-test` +៣ (តម្រង ៖ កាត · សរុប · `aria-pressed`) · `empty-state-truth-test` (helper ថ្មី) ·
  `ZoeW/tests/zto-returned.test.tsx` (fixture មាន `signedState: 'ok'` ដូចការទាញពិត · ការអះអាងមិនប្រែ) · `ZoeW/tests/zto-lock.test.ts` (sha256 ថ្មី ៣) ·
  `ZoeW/tests/zto-palm-list-e2e.test.tsx` «📮» (ធ្លាក់លើ 2.50.117 ៖ ៥) · `ZoeW/tests/zto-palm-server.test.ts` (សំណើ tab «បញ្ជូន» ២) ·
  `ZoeW/tests/cleanup-ledger-key.test.ts` «៩គ» (ធ្លាក់លើ 2.50.117) · `layout-check` ទទឹងប្រអប់វាស់ `offsetWidth` (A200 ៖ checker វាស់ចលនា មិនមែន App ខុស)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.118) ➜ Login ZTO Palm ➜ 📥 ទាញថ្ងៃដូច Cookie ➜ ចំនួនជួរ និង «🆕 ថ្មី» ស្មើ Cookie (កញ្ចប់មកដល់រសៀលមាន) ·
   បើនៅខ្វះ ➜ 🧪 Barcode ដែលខ្វះ ➜ ផ្ញើ `queryTrackInfo` (track ZTO យឺត ➜ មូលហេតុផ្សេង)។
2. 🗑️ ធុងសំរាម ➜ ចុច «➖ ដក + ត្រឡប់» ➜ បញ្ជីមានតែ «ដក» និង «ត្រឡប់» · ចុចម្តងទៀត ➜ ទាំងអស់ · «✅ យករួច + លុប» ដូចគ្នា (iPhone · Android · APK)។
3. គ្មាន rules · env · migration (Function deploy ជាមួយ App)។

### [2.50.117] — 2026-10-17 · ZoeW ៖ ធុងសំរាម `returned` «ត្រឡប់» (ជំនួស «ផុតកំណត់») · ជូនដំណឹង «ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ» · លំដាប់ច្បាប់ ៧ ថ្ងៃ

**ZoeW `2.50.117`** (`zoew-v379` ➜ `zoew-v380`) · ZoeKeyGen ដដែល · Function push ប្រែ (អត្ថបទការរំលឹកម៉ោង ៨) · **Firebase rules ថ្មី** (`trashReason` ៖ `returned` ជំនួស `expired`) ·
**migration Supabase ថ្មី** (`20261017053127_zoe_rules.sql` ពី rules ដដែល) · គ្មាន env ថ្មី។
ម្ចាស់គម្រោង ៖ «តែកែអោយជូនដំណឹងកញ្ចប់ជិតផុតកំណត់ ត្រូវស្កេនត្រលប់ គោលការណ៍ក្រុមហ៊ុន កញ្ចប់ដែលលើស ៧ថ្ងៃត្រូវត្រលប់ទៅសាខាកណ្តាលវិញ រៀបចំច្បាប់អោយមានរបៀបផង» ·
«កញ្ចប់បិទយករួច ទាញចូលបានតែចូលជាកញ្ចប់ បិទរួចនិងបូកចូលចំណូលដូច ដើម · កញ្ចប់ដែលត្រឡប់រំលង និងប្រាប់កញ្ចប់នោះមានក្នុងបញ្ជីតែត្រូវបានស្កេនត្រឡប់ ·
… ធុងសំរាម ស្លាក "ត្រឡប់" … ដកលុយដកចំនួនកញ្ចប់ … · ការជូនដំណឹងត្រូវរាយការណ៍ថា កញ្ចប់ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ សូមធ្វើការស្កេនត្រឡប់» ·
«ដកមុខងារ ផុតកំណត់ចេញ ព្រោះវាជា ត្រឡប់ តែដំណើរការវាស្រដៀងគ្នា» (ជម្រើស ៖ ច្បាប់ថ្ងៃទី ៨ នៅ ស្លាក «ត្រឡប់») · «ដាក់ returned ទៅ ខ្ញុំចូលចិត្ត ពិតពិត» ·
«កែអោយស្អាតទៅ គ្មានទិន្នន័យអតិថិជនណាមួយឡើយ · មានតែខ្ញុំប្រើតែម្នាក់ទេ» ➜ `cleanup.ts` · `zto-list-sync.ts` · `zto/model.ts` (តំបន់ចាក់សោ ៖ អត្ថបទប្រអប់
តាមសំណើនេះ · `LOCK` ថ្មី) · មូលហេតុ ➜ ផ្នែក ២ A193 · A195។

- **តម្លៃតែមួយ `returned` «ត្រឡប់»** ៖ ច្បាប់ថ្ងៃទី ៨ និង ZTO ស្កេនត្រឡប់ សរសេរ `trashReason: 'returned'` ➜ ដកលុយ និងចំនួនកញ្ចប់ · journal · ledger keyed ·
  flag តាមលុយ · sweep កូនសោ · ស្តារតាមកូនសោ · លុបក្រោយ ២ ថ្ងៃ ដូចមុន · `expired` ដកចេញពីកូដ · rules · តេស្ត (គ្មានទិន្នន័យអតិថិជន ➜ គ្មានការបកប្រែទិន្នន័យចាស់) ·
  គ្មានស្លាក «ផុតកំណត់» សម្រាប់កញ្ចប់ (ធុងសំរាម · កាត «➖ ដក + ត្រឡប់» · 🔔 · សៀវភៅ · ឯកសារ)។
- **ច្បាប់តាមលំដាប់** (នាឡិកាតែមួយ `ABANDON_AGE_MS`) ៖ ១ រង់ចាំក្នុងទូ ៧ ថ្ងៃ ➜ ២ ២៤ ម៉ោងចុងក្រោយ 🔔 + 📲 ម៉ោង ៨ ៖ «ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ
  សូមធ្វើការស្កេនត្រឡប់» ➜ ៣ លើស ៧ ថ្ងៃ ៖ យកចេញពីទូ ស្កេន «ត្រឡប់» ក្នុង ZTO ➜ ៤ ZoeW ដកទៅធុងសំរាម «ត្រឡប់» (ZTO ស្កេនត្រឡប់ ➜ ភ្លាម · មិនទាន់ស្កេន ➜ ថ្ងៃទី ៨) ➜
  ៥ 📤 ពិនិត្យ · ធុងសំរាម ២ ថ្ងៃ (ស្តារបាន · បូកវិញ) ➜ សៀវភៅ «គោលការណ៍ ៧ ថ្ងៃ» ៥ ជំហាន · `CLAUDE.md` វដ្តជាលំដាប់។
- **ទាញបញ្ជី ZTO** ៖ ZTO បិទ (ចុះហត្ថលេខា) ➜ បញ្ចូលជា «យករួច» ចូលចំណូល (ដដែល) · ត្រឡប់ ➜ ក្រុម «↩️ មានក្នុងបញ្ជី តែស្កេនត្រឡប់រួច (រំលង · មិនបញ្ចូល)» ·
  បើកក្នុង ZoeW ➜ «🗑️ … ធុងសំរាម «ត្រឡប់» (ដកលុយ និងចំនួនកញ្ចប់)»។
- 🔔 ៖ ក្រុម «📦 កញ្ចប់ជិតដល់ពេលត្រឡប់» · សេចក្តីសង្ខេប «ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ សូមធ្វើការស្កេនត្រឡប់» · ជួរដល់ពេល «↩️ ស្កេនត្រឡប់» ·
  📤 «ត្រឡប់ (លើស ៧ ថ្ងៃ ឬ ZTO ស្កេនត្រឡប់)» · 📲 «📦 N កញ្ចប់ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ» · អត្ថបទនៅកន្លែងតែមួយ (`NOTIFY_RETURN_*`)។
- អ្នកយាម ៖ `zto-returned-cleanup.test.ts` (`returned` ទាំង ២ ផ្លូវ · ចំនួនកញ្ចប់ · ២ ថ្ងៃ · sweep · ស្តារ · 📤 · rules គ្មាន `expired`) · `expiry-return-policy.test.tsx`
  (ថ្មី · ៥ ៖ ធ្លាក់លើ 2.50.116 ៥/៥) · `zto-returned.test.tsx` · `zto-palm-returned.test.tsx` · `push-server.test.ts` · `trash-modal-test` · `emu/app-writes-rules-test`
  (rules ពិតទទួល `returned` · rules ចាស់បដិសេធ) · `revenue-fuzz-test` (op `returned`) · `zto-sync-banner-test` ផ្នែក ១០ (A195) · checker/តេស្តធុងសំរាមទាំងអស់ ➜ `returned` ·
  `npm run rules:check` (`cleanup-rules-check.mjs` ៖ React ពិត web + Android · ៧ ថ្ងៃ · កញ្ចប់លាយ · ២ ថ្ងៃ ➜ `returned` · ធ្លាក់ ៨ លើ `expired` ចាស់ ➜ ៨៥ ok)។
- CI 2.50.115–2.50.116 ៖ waybill ពិតក្នុង `docs/HISTORY.md` (`security-guard-test`) · ជួរលិបិក្រម (`doc-scope-test`) ➜ ផ្នែក ២ A194។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. ✅ (ម្ចាស់គម្រោង ៖ «Publish rules រួចហើយ») **Firebase Console ➜ Realtime Database ➜ Rules** ➜ បិទភ្ជាប់ `firebase-database.rules.json` ➜ **Publish** (ឬ `tools/firebase-provision/deploy-rules.cmd`)
   **មុន**ប្រើ 2.50.117 ៖ rules ចាស់បដិសេធ `returned` ➜ ការសម្អាតធ្លាក់ ហើយកញ្ចប់ត្រឡប់ទៅប្រវត្តិវិញ (លុយមិនខុស តែមិនដក រហូតដល់ Publish)។
2. Supabase ៖ migration `20261017053127_zoe_rules.sql` អនុវត្តដោយស្វ័យប្រវត្តិពេល merge ទៅ `main` (ឬបិទភ្ជាប់ក្នុង SQL Editor)។
3. App Android ៖ ដំឡើង APK 2.50.117 (APK ចាស់ស្គាល់តែ `expired`)។
4. Deploy Preview (2.50.117) ➜ 🗑️ ស្លាក «ត្រឡប់» · ទាញបញ្ជីដែលមានកញ្ចប់ត្រឡប់ ➜ ក្រុម «↩️ មានក្នុងបញ្ជី តែស្កេនត្រឡប់រួច» · កញ្ចប់បើកក្នុង ZoeW ➜ 🗑️ «ត្រឡប់» ·
   ស្ថិតិចុះ COD និងចំនួនកញ្ចប់ · 🔔 «📦 កញ្ចប់ជិតដល់ពេលត្រឡប់» · 📲 ព្រឹកស្អែក ម៉ោង ៨ (ពី site ផលិតកម្មក្រោយ merge)។

### [2.50.116] — 2026-10-17 · ZoeW ៖ កញ្ចប់ត្រឡប់ដកចេញពី ZoeW ដូចផុតកំណត់ (ដកលុយ)

**ZoeW `2.50.116`** (`zoew-v378` ➜ `zoew-v379`) · ZoeKeyGen ដដែល · Function ប្រែ (Palm `status=1` ឆ្លើយ `ztoReturnedAt`) · គ្មាន env · Firebase rules ឬ migration ថ្មី។
ម្ចាស់គម្រោង ៖ «អីវ៉ាន់ដែល ត្រលប់ អោយដកចេញពី ZoeW អោយដូច ផុតកំណត់ដែរទៅ … មិនបាច់មានច្បាប់ដក ថ្ងៃទី8 ក៏បាន … ដកលុយដូចគ្នា និយាយអោយចំគឺដកដូចដកផុតកំណត់»
➜ `zto-status.ts` · `zto-palm.js` · `zto-list-sync.ts` · `zto/model.ts` (តំបន់ចាក់សោ) និង `cleanup.ts` · `zto-returned.ts` (ថ្មី) កែតាមសំណើនេះ · `LOCK` ថ្មី · មូលហេតុ ➜ ផ្នែក ២ A192។

- Barcode បើកក្នុង ZoeW ដែល ZTO បង្ហាញថាសាខាស្កេន «ត្រឡប់» (`-710`) ក្រោយវាចូល ZoeW ➜ ធុងសំរាម «ផុតកំណត់» · ដកលុយភ្លាម តាមផ្លូវដដែលនឹងច្បាប់ ៨ ថ្ងៃ
  (`claimAndCleanupItem('abandon', { codes })` ៖ journal · ledger keyed · flag ធុងសំរាមតាមលុយ) · មិនរង់ចាំថ្ងៃទី ៨ · Barcode បិទ ឬមិនត្រឡប់មិនប៉ះ។
- ពេល App ដឹង ៖ ទាញបញ្ជី (Cookie បញ្ជី `-710` · Palm track) · ពិនិត្យនៅខាងក្រោយ (Palm `status=1` ក្នុងមួយ Barcode · Cookie បញ្ជី `-710` ≤ ម្តងក្នុងមួយម៉ោង) ·
  លក្ខខណ្ឌ ៖ «បិទតាម ZTO ស្វ័យប្រវត្តិ» បើក · នាឡិកា server + ការតភ្ជាប់ · ហាងដឹង · ZTO ចុះហត្ថលេខាឈ្នះ · ស្តារវិញក្រោយការត្រឡប់ ➜ មិនដកម្តងទៀត។
- ប្រអប់បញ្ជី ៖ ជួរ «↩️» ដែលបើកក្នុង ZoeW ➜ «🗑️ បើកក្នុង ZoeW ➜ ដកចេញដូចផុតកំណត់ (ដកលុយ)» · អក្សរសង្ខេប «🗑️ ដកកញ្ចប់ត្រឡប់ចេញពី ZoeW N»។
- អ្នកយាម ៖ `zto-returned-cleanup.test.ts` (ថ្មី · ១១ ៖ លុយ · ធុងសំរាម · ទ្វារ ៣ · ចុះហត្ថលេខាឈ្នះ · ស្តារ · កុងតាក់ · នាឡិកា ៖ ទ្វារនីមួយៗធ្លាក់ពេលដកការភ្ជាប់វា ·
  `codes` ធ្លាក់លើ cleanup ចាស់) · `zto-palm-server` (`ztoReturnedAt` ៤) · `zto-multibranch-signed-hold` (បញ្ជីចុះហត្ថលេខាគ្រប់សាខាដដែល + បញ្ជី `-710` តែសាខាខ្លួន)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.116) ➜ ទាញបញ្ជី 2026-10-14 ➜ 2026-10-17 ➜ កញ្ចប់ត្រឡប់ដែលបាន 🧪 (បើនៅបើកក្នុង ZoeW) ចូលធុងសំរាម «ផុតកំណត់» · 🔔 «📤» បង្ហាញវា ·
   ស្ថិតិប្រាក់ចុះ COD របស់វា (Palm · Cookie)។
2. គ្មាន env · Firebase rules ត្រូវកំណត់។

### [2.50.115] — 2026-10-17 · ZoeW ៖ កញ្ចប់ត្រឡប់ទៅវិញ (↩️) ក្នុងបញ្ជី ZTO ទាំង Cookie និង Palm

**ZoeW `2.50.115`** (`zoew-v377` ➜ `zoew-v378`) · ZoeKeyGen ដដែល · Function ប្រែ (`?list=1&returned=1` · Palm `tracks=` ឆ្លើយ `returnedAt`) ·
env ថ្មីស្រេចចិត្ត `ZTO_LIST_RETURN_SCAN_TYPE` (លំនាំដើម `-710` ➜ មិនចាំបាច់កំណត់) · គ្មាន Firebase rules ឬ migration ថ្មី។
ម្ចាស់គម្រោង ៖ «ចង់ឲ្យកញ្ចប់ដែលត្រឡប់ទៅវិញត្រូវលាក់ ឬបង្ហាញសញ្ញាក្នុងបញ្ជី ទាំង Cookie និង palm» ➜ `zto-order-detail.js` · `zto-palm.js` · `zto-list-sync.ts` ·
`zto/model.ts` កែតាមសំណើនេះ · `LOCK` ថ្មី · មូលហេតុ ➜ ផ្នែក ២ A191។

- ប្រអប់បញ្ជី ZTO ៖ ក្រុមថ្មី «↩️ ត្រឡប់ទៅវិញ (មិនបញ្ចូល)» = កញ្ចប់ដែលសាខាស្កេន «ត្រឡប់ការស្កេន» (`-710`) ក្រោយមកដល់ · ជួរបង្ហាញ «↩️ ZTO ត្រឡប់ស្កេន ៖ ម៉ោង» ·
  មានក្នុង ZoeW រួច ➜ «📌 មានក្នុង ZoeW រួច ➜ ZoeW មិនដកដោយស្វ័យប្រវត្តិ» · អក្សរសង្ខេប «↩️ ត្រឡប់ទៅវិញ N ➜ មិនបញ្ចូល» · ZTO ចុះហត្ថលេខារួច ឬមកដល់ម្តងទៀតក្រោយត្រឡប់
  ➜ មិនចូលក្រុមនេះ · ពិនិត្យមិនបាន ➜ ការទាញនៅដំណើរការ ហើយប្រាប់ «⚠️ ពិនិត្យកញ្ចប់ត្រឡប់ទៅវិញមិនបានគ្រប់»។
- Cookie ៖ App អានបញ្ជីស្កេន `-710` នៃសាខា (ពីថ្ងៃចាប់ផ្តើមដល់ថ្ងៃនេះ) ស្របគ្នាជាមួយបញ្ជីមកដល់ · Palm ៖ track ដែលអានរួចផ្តល់ `action: "-710"`។
- អ្នកយាម ៖ `zto-returned.test.tsx` (ថ្មី · ៤ ៖ Function ពិត + App ពិត · ធ្លាក់លើ 2.50.114 ៤/៤) · `zto-palm-returned.test.tsx` (ថ្មី · លំដាប់ track ពិតពី 🧪 ·
  ធ្លាក់លើ 2.50.114) · `zto-session-race` · `zto-signed-mismatch` · `zto-signed-sync` ៖ ការស្នើ `returned=1` ឆ្លើយ «បិទ» ក្រៅ mock ដែលរាប់ ➜ ការអះអាងទាំងអស់នៅដដែល។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.115) ➜ ទាញបញ្ជីថ្ងៃ 2026-10-14 ➜ 2026-10-17 ➜ កញ្ចប់ត្រឡប់ដែលបាន 🧪 ត្រូវនៅក្នុង «↩️ ត្រឡប់ទៅវិញ» (Palm) · សាកលើរបៀប Cookie ដូចគ្នា (បើប្រើ)។
2. គ្មាន env ត្រូវកំណត់ (`ZTO_LIST_RETURN_SCAN_TYPE` លំនាំដើម `-710` · `off` បិទ)។

### [2.50.114] — 2026-10-17 · ZoeW ៖ ZTO Palm បង្ហាញឈ្មោះសាខាដូច Cookie

**ZoeW `2.50.114`** (`zoew-v376` ➜ `zoew-v377`) · ZoeKeyGen ដដែល · Function ប្រែ (`tracks=` ឆ្លើយ `siteName`) · គ្មាន env · Firebase rules ឬ migration ថ្មី។
ម្ចាស់គម្រោង ៖ «ហើយមិនមានឈ្មោះសាខាទេ មានតែលេខ បើប្រcookie បានមាន ចិងបានន័យថាវាមិនដំណើរការដូច cookie 100%សោះ» ➜ `zto-palm.js` ·
`zto-list-sync.ts` · `zto-palm-login.ts` កែតាមសំណើនេះ · `LOCK` ថ្មី · មូលហេតុ ➜ ផ្នែក ២ A190។

- ប្រអប់បញ្ជី ZTO (Palm) ៖ «🏢 សាខា ៖ ឈ្មោះ · លេខ» ដូច Cookie — ឈ្មោះពីស្កេនចុងក្រោយនៃសាខាខ្លួន (មិនមែនសាខាដឹកបន្ត) ពេល Login ZTO ឆ្លើយឈ្មោះទទេ ·
  ស្ថានភាព Login Palm ក្នុង «API ស្វែងរកអតិថិជន» ក៏បង្ហាញឈ្មោះក្រោយការទាញលើកដំបូង (ចាំតែពេលទទេ · លេខសាខាដដែល · មិនប៉ះ session)។
- អ្នកយាម ៖ `zto-palm-server.test.ts` «🏢 ឈ្មោះសាខា» · `zto-palm-list-e2e.test.tsx` «🏢 ឈ្មោះសាខាដូច Cookie» (ធ្លាក់លើ 2.50.113 ៖ `KH001` តែលេខ)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.114) ➜ ទាញបញ្ជី ZTO ➜ «🏢 សាខា ៖ ឈ្មោះ · លេខ» · ☰ API ស្វែងរកអតិថិជន ➜ «✅ បានភ្ជាប់ Palm · សាខា ឈ្មោះ»។
2. ទាញជួរថ្ងៃដដែល ២ ដងជាប់គ្នា ➜ ផ្ញើ ⏱ ទាំង ២ ([2.50.113])។

### [2.50.113] — 2026-10-17 · ZoeW ៖ ទាញបញ្ជី ZTO Palm ផ្ទៀង track ជាក្រុម ៣០ វិញ

**ZoeW `2.50.113`** (`zoew-v375` ➜ `zoew-v376`) · ZoeKeyGen ដដែល · Function ប្រែ (`tracks=` ≤ ៣០ វិញ) · គ្មាន env · Firebase rules ឬ migration ថ្មី។
ម្ចាស់គម្រោងលើ 2.50.112 ៖ «ZTO 29 ជួរ … ⏱ 11.5 វិ» · «មានអារម្មណ៍ថាយឺតជាងមុន» (ផ្នែក ៖ ទាញបញ្ជី ZTO) ➜ `zto-list-sync.ts` · `zto-palm.js`
កែតាមសំណើនេះ · `LOCK` ថ្មី · មូលហេតុ ➜ ផ្នែក ២ A189។

- ទាញបញ្ជី Palm ៖ ក្រុម track ≤ ៣០ ក្នុងមួយសំណើ (ដូច 2.50.111) · ចុងបញ្ជីចែកស្មើតាមស្លតទំនេរ ≤ ៣០ · ការចាំចំនួនទំព័រ · Login ស្វ័យប្រវត្តិ · អក្សរខ្លី នៅដដែល។
- អ្នកយាម ៖ `zto-palm-list-e2e.test.tsx` «⏱ ក្រុម track ≤ ៣០» (ធ្លាក់លើ 2.50.112 ៖ ក្រុម `60,60,60,60,60,60,31,31`) · `zto-palm-server.test.ts` (៣១ ➜ 400)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.113) ➜ ទាញបញ្ជីជួរថ្ងៃដដែល ២ ដងជាប់គ្នា ➜ ផ្ញើ ⏱ ទាំង ២ (ទី ២ ប្រើចំនួនទំព័រដែលចាំ)។
2. សកម្មភាព [2.50.112] ១ · ៣ · ៤ នៅដដែល (Login ZTO Palm ម្តង · ថ្ងៃបន្ទាប់ស្កេន/ទាញដោយមិន Login · គ្មាន env)។

### [2.50.112] — 2026-10-17 · ZoeW ៖ ZTO Palm Login ឡើងវិញនៅ background · ទាញបញ្ជីលឿន · អក្សរប្រអប់ខ្លី

**ZoeW `2.50.112`** (`zoew-v374` ➜ `zoew-v375`) · ZoeKeyGen ដដែល · Function ប្រែ (`?palm=refresh` · `tracks=` ≤ ៦០) · គ្មាន env · Firebase rules ឬ migration ថ្មី។
សំណើម្ចាស់គម្រោង ៖ «អក្សរវែងពេកសូមកែសម្រួល ការងារយើងធ្វើរួចហើយមិនបាចរាយចិងទៀតក៏បាន» · «បើសិនជាអាចចង់បង្កើនល្បឿនថែមទៀត» ·
«ហើយអោយ Palm login នៅbackgroudខ្លួនឯងពេលបើក app ZoeW ដើម្បីការពារ session» ➜ ឯកសារក្នុងតំបន់ចាក់សោ ZTO (`zto-palm-login.ts` · `zto-palm.js` ·
`zto-order-detail.js` · `zto-list-sync.ts` · `zto-status.ts` · `auto-lookup.ts`) កែតាមសំណើនេះ · `LOCK` ថ្មី · មូលហេតុ ➜ ផ្នែក ២ A187 · A188។

- ប្រអប់ទាញបញ្ជី ៖ «ZTO N ជួរ · ថ្ងៃ ➜ ថ្ងៃ · 🔒 ZTO បិទរួច N ➜ «យករួច» · ✍️ ចុះហត្ថលេខា (មកដល់មុន …) N ➜ «យករួច» · ⏱ X វិ · 👁️ មើលជាមុន» ·
  គ្មានរបាយការណ៍ track/សំណើ/ZTO ឆ្លើយមធ្យម · Palm មិនរាប់ «កញ្ចប់មិនមកដល់ក្នុងចន្លោះ» · Cookie «⏭️ ស្កេនផ្សេង N មិនរាប់» · ការព្រមាន (track ខ្វះ · ទំព័រខ្វះ ·
  បញ្ជីចុះហត្ថលេខា) នៅដដែល។
- ល្បឿន ៖ App ចាំចំនួនទំព័រនៃ tab នីមួយៗ (`zoew_zto_palm_pages_v1` ៖ ចំនួនប៉ុណ្ណោះ · ហាង + សាខា Palm) ➜ ស្នើទំព័រ ២.. ជាមួយទំព័រ ១ ·
  ពេលបញ្ជីដឹងគ្រប់ ➜ track ចែកស្មើគ្នាតាមស្លត (≤ ៦០ ក្នុងមួយសំណើ · ៤៥៥ ➜ ៨ × ៥៧) · ពិដាន ZTO ៦៤ ក្នុងពេលតែមួយដដែល។
- Login ឡើងវិញនៅ background ៖ Login ដោយដៃផ្តល់ `refreshToken` ដែល Server បិទ (AES-GCM ដោយសោពី `ZTO_PALM_SESSION_SECRET` · ចងនឹងសោហាង · ៣០ ថ្ងៃ ពន្យាររាល់ពេលប្រើ)
  ➜ App រក្សាវាអ៊ិនគ្រីបដោយ PIN (`palmRefreshTokenEnc`) · បើក App · ត្រឡប់មក · ដោះសោ PIN · ជុំ ៦០ វិ ➜ session អាយុ ≥ ៤ ម៉ោង Login ឡើងវិញស្ងាត់ៗ ·
  ZTO បដិសេធ session (ស្កេន · ស្ថានភាព ZTO · ទាញបញ្ជី) ➜ Login ឡើងវិញភ្លាម (≤ ម្តងក្នុង ៦០ វិ) ហើយ «✅ Login ZTO Palm ឡើងវិញរួច» · ZTO បដិសេធគណនី ➜ ប្រាប់ម្តង · Login ដោយដៃ។
- អ្នកយាម ៖ `zto-palm-refresh.test.tsx` (ថ្មី · ៣៤ ៖ Firebase/Supabase · ចាស់/ក្មេង · ZTO បដិសេធ session/គណនី/captcha · បណ្តាញខូច · ហៅស្របគ្នា · ពិដាន ៦០ វិ ·
  require · សាខាផ្សេង · កំពុងទាញ · ចាកចេញ/ប្តូរហាង/Login ដោយដៃ កណ្តាលផ្លូវ · ផ្តាច់ · ទ្វារ boot/PIN) · `zto-palm-server.test.ts` +១៦ · `zto-palm-list-e2e.test.tsx` +៦ ·
  `zto-palm-login.test.tsx` +១ ➜ ៥៨ ធ្លាក់លើកូដមុនកែ · sandbox checker ៖ `biometric-unlock-test` (ផ្លូវជីវមាត្រ Login ឡើងវិញម្តង) · `lookup-prefetch-test`
  (stub ដែលរាប់) · `setup-link-logout-test` (ចាកចេញ ➜ ស្ថានភាព Login ឡើងវិញ reset · ដកការហៅ ➜ ធ្លាក់) · `clock-hygiene` (ហេតុផលនាឡិកា ៣)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.112) ➜ ☰ API ស្វែងរកអតិថិជន ➜ **Login ZTO Palm ម្តង** (session ពីកំណែមុនគ្មាន `refreshToken` ➜ Login ស្វ័យប្រវត្តិចាប់ផ្តើមក្រោយ Login នេះ)។
2. ទាញបញ្ជីជួរថ្ងៃដដែល ២ ដង ➜ ផ្ញើ ⏱ (ការទាញទី ២ ប្រើចំនួនទំព័រដែលចាំ) · ទិន្នន័យដូច 2.50.111។
3. ថ្ងៃបន្ទាប់ (session > ៨ ម៉ោង) ➜ បើក App ដោះសោ PIN ➜ ស្កេន ឬទាញបញ្ជីបានដោយមិន Login ម្តងទៀត។
4. គ្មានការប្តូរ Netlify env · Deploy Function ជាមួយ App (Netlify ធ្វើស្វ័យប្រវត្តិ)។

### [2.50.111] — 2026-10-17 · ZoeW ៖ ZTO Palm ដូច Cookie លើ backend ទាំង ២ — មូលហេតុពិតពេល Server បដិសេធគណនី · តេស្ត race

**ZoeW `2.50.111`** (`zoew-v373` ➜ `zoew-v374`) · ZoeKeyGen ដដែល · គ្មាន env · Firebase rules ឬ migration ថ្មី · Function មិនប្រែ។
សំណើម្ចាស់គម្រោង ៖ «អោយpalm ដំណើរការពេញលេញដូច cookie គ្រប់ backend តេស្ត race ផង» · «សូមរៀបចំអោយមានស្តង់ដារនិងយកចិត្តទុកដាក់» ➜ តំបន់ចាក់សោ ZTO
(`zto-list-sync.ts`) កែតាមសំណើនេះ · `LOCK` ថ្មី · មូលហេតុ ➜ ផ្នែក ២ A186។

- App ៖ ការអានបញ្ជី Palm (មកដល់ · ចុះហត្ថលេខា) ដែល Function បដិសេធដោយសារគណនី ZoeW (`ZTO_IDENTITY_REQUIRED` · `ZTO_IDENTITY_UNAVAILABLE` ·
  `ZTO_CONFIG_INVALID` ដែលមូលហេតុជាការកំណត់អត្តសញ្ញាណ) ក្លាយជា `notConfigured` + មូលហេតុ ដូចបញ្ជី Cookie ➜ សារដូចគ្នា (គណនីគ្មានសាខា · ហាងផុតកំណត់/បិទ ·
  ផ្ទៀងផ្ទាត់មិនបាន សាកម្តងទៀត · Server មិនទាន់កំណត់) និងសាលក្រម «ស្ថាពរ ឬបណ្តោះអាសន្ន» ដូចគ្នាសម្រាប់ការរង់ចាំ ៨ ថ្ងៃ · `ZTO_IDENTITY_UNAVAILABLE` នៅសាកម្តងទៀត ·
  `site:palm-other-branch` ➜ «🏢 គណនី ZoeW នេះជាសាខាផ្សេងពីគណនី ZTO Palm — សូម Login ZTO Palm របស់សាខានេះ» · `site:palm-missing` ➜ «🔑 គណនី ZTO Palm នេះ
  គ្មានលេខសាខា — សូម Login ZTO Palm ម្តងទៀត» ⛔ «Session ZTO Palm ផុតកំណត់» នៅសម្រាប់តែ session Palm ផុតកំណត់ពិត (`ZTO_AUTH_EXPIRED`)។
- អ្នកយាម ៖ `zto-palm-backends.test.tsx` (ថ្មី · ២១ ៖ App ពិត + Function ពិត · Firebase/Supabase × `ZTO_DETAIL_IDENTITY` off/optional/require ➜ ជួរដូចគ្នា ·
  គណនីសាខាផ្សេង · token ផុតកំណត់ · Server ផ្ទៀងមិនបាន · គណនីគ្មានហាង · ហាងផុតកំណត់/បិទ · បញ្ជីចុះហត្ថលេខា និងការរង់ចាំ ៨ ថ្ងៃ — ៩ ធ្លាក់លើ `507f1d7`) ·
  `zto-palm-race.test.tsx` (ថ្មី · ១៤ ៖ ចាកចេញ · ប្តូរហាង · Login Palm ម្តងទៀត · ចុចពីរដង · បរាជ័យយឺតរបស់វគ្គចាស់ · បញ្ជីចុះហត្ថលេខាយឺត × backend ទាំង ២ —
  ជាប់លើកូដមុនកែ · mutation ៣ ដែលដកច្រក session ធ្លាក់) · ឧបករណ៍រួម `zto-palm-harness.ts`។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.111) ➜ ពិនិត្យកំណែក្រោម ☰ ➜ ទាញបញ្ជី Palm ជួរថ្ងៃដដែល (ហាង Firebase · បើមានហាង Supabase ក៏សាកផង) ➜ ទិន្នន័យដូច 2.50.110។
2. គ្មានការប្តូរ Netlify env · `ZTO_DETAIL_IDENTITY=require` (💡 «📌») ពេលបើកនៅថ្ងៃក្រោយ ➜ ប្រអប់ Palm ប្រាប់មូលហេតុដូច Cookie។

### [2.50.110] — 2026-10-17 · ZoeW ៖ ទាញបញ្ជី ZTO Palm ស្របគ្នា ៦៤ (ការជ្រើសរបស់ម្ចាស់គម្រោង)

**ZoeW `2.50.110`** (`zoew-v372` ➜ `zoew-v373`) · ZoeKeyGen ដដែល · គ្មាន env · Firebase rules ឬ migration ថ្មី · Function មិនប្រែ។
លទ្ធផលម្ចាស់គម្រោងលើ 2.50.109 ៖ «⏱ Palm ៖ ផ្ទៀង 455 កញ្ចប់ ក្នុង 17.5 វិនាទី — បញ្ជី 4.4 វិ · track 14.6 វិ (សំណើ track 455 · ZTO ឆ្លើយមធ្យម
0.33 វិ/សំណើ)» · តំបន់ Function ប្តូរមិនបាន (Netlify «Upgrade to customize» · CMH Ohio) ➜ ម្ចាស់គម្រោងជ្រើស «ស្របគ្នា 64» ទោះដឹងហានិភ័យ
(ZTO អាចកំណត់ល្បឿន ឬបិទគណនី Palm) · «សូមរៀបចំអោយមានស្តង់ដារនិងយកចិត្តទុកដាក់» ➜ តំបន់ចាក់សោ ZTO (`zto-list-sync.ts`) កែតាមសំណើនេះ ·
`LOCK` ថ្មី · លេខវាស់ ➜ ផ្នែក ២ A185។

- App ៖ `ZTO_PALM_LIST_CONCURRENCY` ៤ ➜ ៨ (សំណើទៅ Function ក្នុងពេលតែមួយ · ទំព័របេក្ខភាព និងក្រុម track) ➜ track ទៅ ZTO ≤ ៨ × ៨ = ៦៤ ក្នុងពេលតែមួយ ·
  Function (`PALM_TRACK_CONCURRENCY` ៨ · ≤ ៣០ Barcode ក្នុងមួយសំណើ) មិនប្រែ។
- អ្នកយាម ៖ `zto-palm-list-e2e.test.tsx` «⏱ ស្របគ្នា 64» (455 កញ្ចប់ ៖ សំណើ track ទៅ Function ស្របគ្នា = ៨ · track ទៅ ZTO > ៣២ និង ≤ ៦៤ · track = N ·
  `unverified` ទទេ — ធ្លាក់លើ `65ee4a6` ៖ ស្របគ្នា ៤) · តេស្តល្បឿនដើមព្រំដែន ≤ ៦៤។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.110) ➜ ពិនិត្យកំណែក្រោម ☰ ➜ ទាញជួរថ្ងៃដដែល (10/14 ➜ 10/17) ➜ ផ្ញើបន្ទាត់ «⏱ Palm ៖ …» ទាំងមូល (គំរូប៉ាន់ ≈ 11–13 វិ)។
2. ពិនិត្យថាគ្មាន «⚠️ ZTO មិនឆ្លើយ track» ឬ «ទាញមិនបាន N ទំព័រ» ថ្មី (សញ្ញា ZTO កំណត់ល្បឿន) · ស្កេន Palm និងបិទតាម ZTO នៅដំណើរការដូចមុន។

### [2.50.109] — 2026-10-17 · ZoeW ៖ ទាញបញ្ជី ZTO Palm ៖ track ចាប់ពីទំព័រទី ១ · ម្តងមួយ Barcode · ពេលតាមដំណាក់កាល

**ZoeW `2.50.109`** (`zoew-v371` ➜ `zoew-v372`) · ZoeKeyGen ដដែល · គ្មាន env · Firebase rules ឬ migration ថ្មី។
លទ្ធផលម្ចាស់គម្រោងលើ 2.50.108 ៖ «⏱ Palm ៖ ផ្ទៀង 443 កញ្ចប់ ក្នុង 16.4 វិនាទី (សំណើ track 452)» · ទិន្នន័យដូច Cookie ➜ ម្ចាស់គម្រោងជ្រើស
«កែដែលគ្មានហានិភ័យ» (មិនបង្កើនការស្របគ្នា · មិនទុក cache) · «cookie ទាញតែ 1-3វិនាទី» ➜ តំបន់ចាក់សោ ZTO (`zto-palm.js` · `zto-list-sync.ts`)
កែតាមសំណើនេះ · `LOCK` ថ្មី · លេខវាស់ ➜ ផ្នែក ២ A184។

- Function ៖ `queryTrackInfo` ម្តងមួយ Barcode ជានិច្ច (ZTO ពិតឆ្លើយទទេចំពោះ `mailNos` «A,B» ➜ សំណើសាក ៩ ក្នុង ៤៥២ ខាតពេលមួយជុំ) ·
  `trackCalls` = ចំនួនសំណើ track ពិត (រាប់ការសាកម្តងទៀត) · `trackWaitMs` = ពេល ZTO ឆ្លើយសរុប។
- App ៖ ទំព័រទី ១ មកដល់ ➜ ចាប់ផ្ទៀង track ភ្លាម ៖ សំណើ ៤ ក្នុងពេលតែមួយ យកទំព័របេក្ខភាពដែលនៅសល់មុន រួចក្រុម track ៣០ (មិនរង់ចាំបញ្ជីគ្រប់ទំព័រ) ·
  ការស្របគ្នាដដែល (≤ ៣២ សំណើទៅ ZTO) · ប្រអប់បង្ហាញ «⏱ Palm ៖ ផ្ទៀង N កញ្ចប់ ក្នុង X វិនាទី — បញ្ជី A វិ · track B វិ (សំណើ track M ·
  ZTO ឆ្លើយមធ្យម C វិ/សំណើ)»។
- អ្នកយាម ៖ `zto-palm-list-e2e.test.tsx` (ទំព័រទី ២ យឺត ➜ track ≥ ៦០ មុនវាចប់ · គ្មាន `mailNos` ច្រើនលេខ · track = N · ប្រអប់មានពេលតាមដំណាក់កាល —
  ធ្លាក់លើ `c0ced42` ៖ track ០ មុនទំព័រទី ២ ចប់) · `zto-palm-server.test.ts` (៣០ Barcode = ៣០ សំណើម្តងមួយលេខ · ស្របគ្នា ៨ · `trackCalls` រាប់ការសាកម្តងទៀត —
  ៣ ធ្លាក់លើ `c0ced42`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.109) ➜ Login ZTO Palm ➜ 📥 ទាញជួរថ្ងៃដដែល (443 កញ្ចប់) ➜ ផ្ញើបន្ទាត់ «⏱ Palm ៖ …» ទាំងមូល (សរុប · បញ្ជី · track ·
   ZTO ឆ្លើយមធ្យម) ➜ លេខ «ZTO ឆ្លើយមធ្យម» សម្រេចជំហានបន្ទាប់ (ពេលសរុប ≈ N × មធ្យម ÷ ៣២)។
2. ផ្ទៀងទិន្នន័យដដែលនឹង 2.50.108 (Barcode · ម៉ោងមកដល់ · ប្រភព · បិទរួច/មិនទាន់)។

### [2.50.108] — 2026-10-17 · ZoeW ៖ ទាញបញ្ជី ZTO Palm លឿន (បេក្ខភាព ១០០ ជួរ · track ជាក្រុមស្របគ្នា)

**ZoeW `2.50.108`** (`zoew-v370` ➜ `zoew-v371`) · ZoeKeyGen ដដែល · គ្មាន env · Firebase rules ឬ migration ថ្មី។
សំណើម្ចាស់គម្រោង ៖ «ទិន្នន័យមានត្រឹមត្រូវហើយតែ យូរណាស់ពេលចុចទាញបញ្ជីទំរាំចេញទិន្នន័យ ប្រហែល 1-2នាទីឯណោះ cookie តែប៉ុន្មាន វិនាទីទេ» ➜
តំបន់ចាក់សោ ZTO (`zto-palm.js` · `zto-list-sync.ts`) កែតាមសំណើនេះ · `LOCK` ថ្មី · មូលហេតុ និងលេខវាស់ ➜ ផ្នែក ២ A183។

- Function ៖ `?palm=1&list=1&candidates=1` អានបេក្ខភាព `listPageSize` (១០០) ជួរក្នុងមួយ tab ដោយគ្មាន track (លេខទូរស័ព្ទ · COD/DOD · ប្រភព `recSite`) ·
  `?palm=1&list=1&tracks=A,B,…` (≤ ៣០) អាន track ៨ ស្របគ្នា ហើយឆ្លើយម៉ោងមកដល់ក្នុងចន្លោះ · ស្ថានភាពបិទ · ម៉ោងចុះហត្ថលេខា · ប្រភពពី track (គ្មានលេខទូរស័ព្ទ) ·
  សាក `mailNos` «A,B,…» (≤ ១០) ក្នុងសំណើតែមួយ ៖ ទទួលតែ track ដែល `mailNo` ត្រូវ Barcode នីមួយៗ · ZTO មិនគាំទ្រ ➜ ម្តងមួយលេខ (ចងចាំ ១០ នាទី) ·
  ZTO បម្រើ `pageSize` តិចជាងសំណើ ➜ ទំព័រពេញមិនមែនទំព័រចុងក្រោយ។ contract ទំព័រ `tabs`/`verify` របស់ [2.50.107] ត្រូវប្តូរ (មិនទាន់ដល់ `main`)។
- App ៖ ដំណាក់កាល ១ អានទំព័របេក្ខភាព ៤ ក្នុងពេលតែមួយ · ដំណាក់កាល ២ ផ្ញើ track ៤ សំណើ × ៣០ Barcode ក្នុងពេលតែមួយ (≤ ៣២ សំណើទៅ ZTO) ·
  Barcode ដែលនៅខ្វះ ➜ ៣ ជុំ · វឌ្ឍនភាព «ផ្ទៀង track X/Y កញ្ចប់» · ប្រអប់បង្ហាញ «⏱ Palm ៖ ផ្ទៀង N កញ្ចប់ ក្នុង X វិនាទី (សំណើ track M)»។
- អ្នកយាម ៖ `zto-palm-list-e2e.test.tsx` (ទាំងពេល ZTO អាន track ម្តងមួយលេខ និងច្រើនលេខ · តេស្តល្បឿន ៖ សំណើបញ្ជីតែ ៤ · Function ២ + ⌈N/៣០⌉ ·
  track ស្របគ្នា ≥ ១៦ ≤ ៣២ — ធ្លាក់លើ `0469d7a` ៖ សំណើបញ្ជី ៣៦) · `zto-palm-server.test.ts` (`candidates` · `tracks` · ច្រើនលេខ/ត្រឡប់ម្តងមួយ ៤ ករណី ·
  ZTO យឺត ១.៥ វិ × ៣០ កញ្ចប់ក្នុងថវិកា)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.108) ➜ Login ZTO Palm ➜ 📥 ទាញជួរថ្ងៃដូច Cookie ➜ កត់ «⏱ Palm ៖ ផ្ទៀង N កញ្ចប់ ក្នុង X វិនាទី (សំណើ track M)» ៖
   M ជិត N ÷ ១០ = ZTO គាំទ្រ track ច្រើនលេខ (លឿនបំផុត) · M ≈ N = ម្តងមួយលេខ ➜ ផ្ញើលេខទាំង ៣ មកវិញ។
2. ផ្ទៀងទិន្នន័យដដែលនឹង 2.50.106 (Barcode · ម៉ោងមកដល់ · ប្រភព · បិទរួច/មិនទាន់) ធៀប Cookie។

### [2.50.107] — 2026-10-17 · ZoeW ៖ ទាញបញ្ជី ZTO Palm ស្ថិរដូច Cookie (សាកម្តងទៀត · កញ្ចប់មួយមិនធ្លាក់ទាំងបញ្ជី)

**ZoeW `2.50.107`** (`zoew-v369` ➜ `zoew-v370`) · ZoeKeyGen ដដែល · គ្មាន env · Firebase rules ឬ migration ថ្មី។
សំណើម្ចាស់គម្រោង (PR #328) ៖ «login palm ទាញ បញ្ជីZTO មិនបាន … បិទដោយស្វ័យប្រវត្តិតាមZTO និងប្រាប់បិទក្នុងZoeW តែZTO Palm មិនទាន់បិទ
ដំណើរការល្អហើយ សូមពិនិត្យនិងធ្វើអោយការទាញរបស់Palm mode ដូចទៅនិង Cookie 100% ផង មានទាំងប្រភពនិងពត៍មានទិន្នន័យបិទរួចឬនៅ» ·
«ធ្វើអោយវា ដំណើរការល្អដូច cookie ដែរទៅ» ➜ តំបន់ចាក់សោ ZTO (`zto-palm.js` · `zto-list-sync.ts`) កែតាមសំណើនេះ · `LOCK` ថ្មី · មូលហេតុ ➜ ផ្នែក ២ A181–A182។

- Function (`?palm=1&list=1`) ៖ `queryDispatchList` និង `queryTrackInfo` សាកម្តងទៀតមួយដងក្នុងថវិកា (5xx · អស់ពេល · `status:false`) ·
  track មួយកញ្ចប់ខូច ឬមិនឆ្លើយ ➜ Barcode ចូល `unverified` + `unverifiedReasons` ហើយទំព័រនៅតែឆ្លើយ 200 · Session ផុតកំណត់ ➜ 401 ទាំងទំព័រ ·
  `tabs` អានតែ tab ដែលនៅមានទំព័រ (`tabPages`) · `verify` អាន track តែ Barcode ដែលស្នើ · track ដែល `mailNo` ផ្សេង (ឧ. លេខជើងដំបូង)
  ឬម៉ោង/action ខូចមិនជាភស្តុតាង · `result: []` អានម្តងទៀត ហើយនៅទទេ ➜ `palm:track-empty` · ស្ថានភាពបិទ = ស្កេន `5` សាខាខ្លួននៅក្រោយ ឬស្មើមកដល់ចុងក្រោយ
  (ដូចបញ្ជី `05` របស់ Cookie) · `mail.isSign: 0` ផ្ទុយ ➜ `null`។
- App ៖ ផ្លូវ Palm ដាច់ (`fetchZtoPalmListAllPages`) ៖ ២ ទំព័រក្នុងពេលតែមួយ · ទំព័រសាកម្តងទៀតដល់ ៣ ដង · Barcode `unverified` សាកម្តងទៀត ២ ដង ·
  នៅសល់ ➜ «⚠️ ZTO មិនឆ្លើយ track N កញ្ចប់ (Barcode …)» · ទំព័រដែលនៅតែមិនឆ្លើយ ➜ «⚠️ ទាញមិនបាន N ទំព័រ» · 401 ➜ «🔑 … Login ZTO Palm ម្តងទៀត» ·
  វឌ្ឍនភាព «ទំព័រ X/Y»។ រង្វិលជុំដែល PR #328 ចែករំលែករវាង Cookie និង Palm ត្រូវបំបែក ➜ រង្វិលជុំ Cookie ដូច `main` ត្រង់ៗ (បន្ថែមតែ `pageLimit`)។
- អ្នកយាមថ្មី ៖ `ZoeW/tests/zto-palm-list-e2e.test.tsx` (App ពិត + Function ពិត + ZTO Palm ក្លែង · ៦ test ធ្លាក់លើកូដមុនកែ) ·
  `ZoeW/tests/zto-palm-server.test.ts` (`tabs`/`verify` · សញ្ញាចុះហត្ថលេខា · track ខូច ➜ `unverified`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy Preview (2.50.107) ➜ Login ZTO Palm ➜ ☰ ZTO ➜ 📥 ទាញបញ្ជី ជួរថ្ងៃដូចប្រអប់ Cookie ➜ ផ្ទៀង Barcode · ម៉ោងមកដល់ ·
   ប្រភព (🇨🇳 · 🇻🇳 · ផ្សេងៗ) · «✍️ ZTO ចុះហត្ថលេខា (បិទ)» ធៀបនឹង Cookie។
2. «⚠️ ZTO មិនឆ្លើយ track» ឬ «⚠️ ទាញមិនបាន N ទំព័រ» ➜ ទាញម្តងទៀត · នៅតែមាន ➜ ផ្ញើរូបប្រអប់ (មាន Barcode និងកូដ) · សាក Barcode នោះក្នុង 🧪។
3. ផ្ទៀងចំនួន «⏭️ កញ្ចប់ Palm ដែលមិនមានស្កេនមកដល់សាខាក្នុងចន្លោះនេះ» និងពេលទាញ ៖ tab «បញ្ជូន» គ្មានជួរថ្ងៃ ➜ ចំនួនធំខ្លាំង = ការទាញយឺត ➜ ប្រាប់មកវិញ។

### [2.50.106] — 2026-10-17 · ZoeW ៖ ទំព័រចុះហត្ថលេខាអស់មុន មិនត្រូវបិទបញ្ជីមកដល់

**ZoeW `2.50.106`** (`zoew-v368` ➜ `zoew-v369`) · គ្មាន env ឬ database rules ថ្មី។
ម្ចាស់គម្រោងផ្តល់កូដ `palm:list-5-items` ➜ បញ្ជីចុះហត្ថលេខាជាកន្លែងបដិសេធ។ តេស្តបញ្ជាក់ករណី
`list:null`/គ្មាន `list` នៅទំព័រហួសចុង (`page=2`, `pages=1`, `total>0`) និងបញ្ជីសូន្យដែលនៅមាន `pages=1`៖ កូដចាស់ឆ្លើយ 502។
ផ្ទៀងសញ្ញា pagination មុនរាប់ទំព័រនេះជាទទេ (`total=0` ឬ `page>pages`) ហើយរក្សាការអានបញ្ជីផ្សេងទៀតបន្ត។
`pages:false` និង String ទទេមិនត្រូវរាប់ជា ០; កូដកំហុសដែលនៅសល់បង្ហាញ type និង page ដើម្បីកំណត់ករណីបានច្បាស់។
តេស្តទំព័រទទេ ៥ និង metadata ខូច ២ ធ្លាក់មុនកែ។ កែតំបន់សោ `zto-palm.js` តាមកូដកំហុសម្ចាស់គម្រោង; `LOCK` ថ្មី។

ការផ្ទៀងផ្ទាត់៖ typecheck · lint · តេស្ត Palm/សោ ១៤០ និងអ្នកយាមពាក់ព័ន្ធ ១១ ឆ្លង។ ការរត់ពេញចាប់ផ្តើមឡើងវិញក្រោយកែតាមកូដកំហុសពិត។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Preview បង្ហាញ 2.50.106 ➜ ទាញជួរថ្ងៃដដែល ➜ ផ្ទៀងចំនួន និង Barcode ធៀប Cookie។ បើនៅបរាជ័យ កូដថ្មីមាន type និង page។

### [2.50.105] — 2026-10-17 · ZoeW ៖ កុំឲ្យ metadata ចុះហត្ថលេខាបិទបញ្ជីមកដល់ Palm

**ZoeW `2.50.105`** (`zoew-v367` ➜ `zoew-v368`) · គ្មាន env ឬ database rules ថ្មី។
ម្ចាស់គម្រោងផ្តល់រូប `HTTP 502 · ZTO_INVALID_RESPONSE`; កូដនេះមិនបញ្ជាក់ថាខូចត្រង់បញ្ជី ឬ track ទេ។
តេស្តតាម `QueryTrackingRPTO` របស់ APK (មាន `tracks`, គ្មាន `mail/isSign`) បង្ហាញថា validator បដិសេធភស្តុតាងមកដល់ត្រឹមត្រូវ។
កែបញ្ជីមកដល់ឲ្យផ្ទៀង Barcode តាម envelope ឬ track ទាំងអស់ត្រូវគ្នា ដោយមិនទាមទារ metadata ចុះហត្ថលេខា;
ខ្វះ metadata ទុក `ztoClosed:null`, មិនទាយថាបិទ។ ទទួល `list:null` ជាទទេតែមាន `total=0/pages=0` បញ្ជាក់។
កំហុសមាន `palm:list-<ប្រភេទ>-<field>` ឬ `palm:track-<field>` និង Barcode របស់ track ដែលបរាជ័យ ដើម្បីសាក 🧪 បានត្រង់លេខ។
មិនមាន phone, token ឬ message ដើមក្នុងកំហុស។ កែតំបន់សោ `zto-palm.js` និង `zto-list-sync.ts` តាមរបាយការណ៍នេះ; តេស្តថ្មី ១០ ធ្លាក់មុនកែ និងឆ្លងក្រោយកែ។

ការផ្ទៀងផ្ទាត់៖ typecheck · lint · តេស្ត Palm/សោ ១៣៣ និងអ្នកយាមពាក់ព័ន្ធ ១១ ឆ្លង; ការរត់ពេញកំពុងបន្ត។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Preview បង្ហាញ 2.50.105 ➜ ទាញជួរថ្ងៃដដែល។ បើនៅបរាជ័យ ផ្ទៀងកូដ `palm:…` និង Barcode ក្នុងសារ; 🧪 លេខនោះបង្ហាញ JSON ដើម។
2. មូលហេតុពិតរបស់ 502 ក្នុងគណនីនៅមិនទាន់ផ្ទៀង ដោយរូបមានតែកូដទូទៅ; ការវាស់ metadata ខ្វះបញ្ជាក់ bug តាម DTO, មិនមែនចម្លើយពិតថ្មីរបស់គណនី។

### [2.50.104] — 2026-10-17 · ZoeW ៖ កាត់បន្ទុកមួយសំណើពេលទាញបញ្ជី Palm

**ZoeW `2.50.104`** (`zoew-v366` ➜ `zoew-v367`) · គ្មាន env ឬ database rules ថ្មី។
ម្ចាស់គម្រោងបញ្ជាក់ថាបិទតាម ZTO និងរបាររំលឹកដំណើរការហើយ; ទាញបញ្ជីបរាជ័យក្រោយប្រហែល ១០ វិនាទី។
តេស្តថវិកាពិតជាមួយ upstream យឺត ១.៥ វិនាទី បង្ហាញថាទំព័រ ២០ × ៣ ប្រភេទត្រូវសួរ track ដល់ ៦០ ហើយឆ្លើយ 504។
បន្ថយមួយប្រភេទមួយទំព័រត្រឹម ៥ ➜ អតិបរមា ១៥ បេក្ខភាព; អានទំព័របន្តដដែល ដើម្បីមិនកាត់បញ្ជី។
តេស្តដដែលឆ្លើយ 200 និងមានជួរ ១៥ ពេញ។ កំហុស HTTP និងកូដមូលហេតុសុវត្ថិភាពបង្ហាញក្នុងប្រអប់ (មិនបង្ហាញ message ដើម)។
កែតំបន់សោ `zto-palm.js` និង `zto-list-sync.ts` តាមរបាយការណ៍នេះ; តេស្តធ្លាក់មុនកែ ហើយ `LOCK` ថ្មី។

ការផ្ទៀងផ្ទាត់៖ typecheck · lint · តេស្ត Palm/សោ ១២៣ ករណី និងអ្នកយាមពាក់ព័ន្ធ ១១ ឆ្លងទាំងអស់។
ការរត់ពេញសម្រាប់កំណែមុនបាន timeout `money-guardian` ៣០០ វិនាទី ហើយឈប់ពេលម្ចាស់គម្រោងរាយការណ៍ទាញបញ្ជីបរាជ័យ;
កំណែនេះវាស់អ្នកយាមពាក់ព័ន្ធ (`RUNALL_ONLY`), មិនអះអាងថា `run-all` ពេញបៃតង។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Preview បង្ហាញ 2.50.104 ➜ 📥 ➜ ថ្ងៃដដែល ➜ ផ្ទៀងបញ្ជីធៀប Cookie។ បើបរាជ័យ កត់ HTTP និងកូដមូលហេតុដែលបង្ហាញ។

### [2.50.103] — 2026-10-17 · ZoeW ៖ បើកការទាញបញ្ជី Palm និងស្ថានភាពពេញតាម track

**ZoeW `2.50.103`** (`zoew-v365` ➜ `zoew-v366`) · ZoeKeyGen ដដែល · គ្មាន env, Firebase rules ឬ migration ថ្មី។
ម្ចាស់គម្រោងផ្តល់ track ពិត (មកដល់ `action=3`, ចុះហត្ថលេខា `action=5`, `mail.isSign=0/1`, `siteCode`) ហើយស្នើ
«ធ្វើឲ្យដូច Cookie ១០០% កុំឲ្យខ្វះ» និងបើកមុខងារទាញបញ្ជីដែលបានបិទវិញ។ តំបន់ចាក់សោ ZTO កែតាមសំណើនេះ៖
`zto-palm.js` · `zto-order-detail.js` · `zto-list-sync.ts` · `zto-status.ts`; `LOCK` ថ្មី។

- ទាញបញ្ជី Palm ៖ អានកញ្ចប់ពី `queryDispatchList` ប្រភេទ `1` (បញ្ហា), `4` (ចាត់ចែក), `5` (ចុះហត្ថលេខា) ទំព័រ ២០ ជួរ;
  ប្រភេទ `1/4` មិនកាត់តាមថ្ងៃចាត់ចែក។ អាន track របស់គ្រប់ Barcode (៨ សំណើស្របគ្នា ក្នុងថវិកា Function) ហើយរកតែ
  `action=3` ត្រូវសាខា និងថ្ងៃដែលជ្រើស។ កញ្ចប់នៅតាមផ្លូវមិនចូលបញ្ជី; ការមកដល់ច្រើនដងនៅតែមានជួរពិត ហើយ client ច្រោះស្ទួនដូច Cookie។
- ទំព័រ Palm អានបន្តជាក្រុម ៣ ដល់គ្រប់ទំព័រ (ពិដានការពារ ១០០០ បង្ហាញការមិនពេញលេញ); ទំព័រដែលច្រោះហើយទទេមិនបញ្ឈប់ការទាញ។
  Track ខ្វះ/បរាជ័យ ឬថវិកាមិនគ្រប់ ➜ បដិសេធបញ្ជីទាំងទំព័រ ជំនួសការបាត់ Barcode ស្ងាត់។
- ការចុះហត្ថលេខា/របាររំលឹក ៖ `status=1` អាន track មួយសំណើ; ផ្ទៀង Barcode, សាខា, ថ្ងៃពិត និង `isSign`។ ស្កេនចុះហត្ថលេខាមុនការមកដល់ថ្មី
  មិនបិទ lifecycle ថ្មី។ ចម្លើយទទេ/ខូច/ផ្ទុយគ្នា ➜ unknown។ Lookup ពេលស្កេននៅតែមួយសំណើ។
  កញ្ចប់នៅបើកត្រូវពិនិត្យ track ដូច Cookie ទោះបញ្ជីចុះហត្ថលេខាបរាជ័យ; កញ្ចប់ដែលបញ្ជីបានបិទរួចមិនហៅស្ទួន។
- ប៊ូតុង 📥 និងកុងតាក់ ☰ Palm បើកវិញ; ការនាំចូល និងការពារច្បាប់លុយប្រើ flow ដូច Cookie។ របាររំលឹកមិនទាន់ចុះហត្ថលេខា ដំណើរការក្នុង Palm។
- ប្រភព VN · CN · ផ្សេងៗ ៖ ប្រើវាលប្រភពដូច Cookie បើ ZTO ផ្តល់ ឬឈ្មោះកន្លែងទទួលដើមពីស្កេន `1` និងសារតាមភាសា;
  ទុក `from` លើជួរមកដល់ និងចុះហត្ថលេខា។ មិនយកសាខាដឹកបន្ត ឬប្រទេសអ្នកទទួលមកកំណត់ប្រភពទេ។
- កាតាឡុក API បន្ថែម field និងប្រភេទទិន្នន័យគ្រប់ request/response model និង nested class ពី APK តាមសំណើម្ចាស់គម្រោង។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Preview ៖ Login Palm ➜ Fast Mode ➜ ☰ ZTO បើក «ទាញបញ្ជីកញ្ចប់ពី ZTO» ➜ 📥 ➜ ថ្ងៃដូច Cookie ➜ ផ្ទៀង Barcode គ្រប់លេខ ម៉ោងមកដល់ និង COD/DOD · ប្រភព VN/CN/ផ្សេងៗទាំងក្នុងបញ្ជី និងប្រវត្តិ។
2. ផ្ទៀងកញ្ចប់ចុះហត្ថលេខា និងមិនទាន់ចុះហត្ថលេខា ➜ របាររំលឹក និងការនាំចូលយករួច ត្រូវដូច Cookie។ បើ Track មិនគ្រប់ សាកទាញម្តងទៀត។

### [2.50.102] — 2026-10-17 · ZoeW ៖ queryTrackInfo ផ្ញើ mailNos ជា String តាម APK Palm

**ZoeW `2.50.102`** (`zoew-v364` ➜ `zoew-v365`) · ZoeKeyGen ដដែល · គ្មាន env, Firebase rules ឬ migration ថ្មី។
ម្ចាស់គម្រោងផ្តល់ `draft.7z` (APK ស្រាយ) ក្រោយ 🧪 ឆ្លើយ `queryTrackInfo.result: []` ទាំងពីរកញ្ចប់។
ផ្ទៀង `PDARequestImpl.queryTrackInfo(String, Callback)` ពី `classes4.dex` ៖ `mailType` = លេខ `1` និង `mailNos` = String។
កូដយើងផ្ញើ `mailNos` ជា array ➜ ខុស protocol ពិត។

- `zto-palm.js` ផ្ញើ `{mailType: 1, mailNos: barcode}` និងគណនា `x-sign` លើ JSON នោះ។ កែតំបន់ចាក់សោតាមរបាយការណ៍ម្ចាស់គម្រោង; `LOCK` ថ្មី។
- តេស្ត request ពិតចាក់សោប្រភេទ String និងហត្ថលេខា; ធ្លាក់ពេលផ្ញើ array។ ឯកសារការប្រើ និងកាតាឡុក API ផ្ទៀងជាមួយ APK។
- ផ្ទៀង `ScanType` ៖ មកដល់ `3` · ចាត់ចែក `4` · ចុះហត្ថលេខា `5`; `ScanQueryDetailPresenter.queryScanRecord` អាន
  `UploadPoolTable` ក្នុងឧបករណ៍។ ផែនទី field Cookie (`agentAmount/fcAmount`) និង Palm (`cod/dod`) កត់ក្នុងឯកសារការប្រើ។
- មិនដាក់ APK, កូដ decompile, សោ protocol ឬទិន្នន័យអតិថិជនក្នុង repo។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Preview កំណែនេះ ៖ 🧪 សាក Barcode ពីរដដែល ➜ ផ្ញើ `queryTrackInfo` ពេញ ដើម្បីផ្ទៀង action, siteCode និង time សម្រាប់មកដល់/ចុះហត្ថលេខា។
2. `result: []` នៅតែមិនមែនភស្តុតាងថាកញ្ចប់មិនទាន់ចុះហត្ថលេខា; មិនបើកស្ថានភាព ឬបញ្ជី Palm តាមការទាយ។

### [2.50.101] — 2026-10-16 · ZoeW ៖ COD/DOD Palm ដាច់ពី mapping Cookie

**ZoeW `2.50.101`** (`zoew-v363` ➜ `zoew-v364`) · ZoeKeyGen ដដែល · គ្មាន env, Firebase rules ឬ migration ថ្មី។
ម្ចាស់គម្រោងផ្តល់ចម្លើយ 🧪 ពិតពីកញ្ចប់ ២ ៖ `billInfoQuery.result.cod` · `.dod` · `.consigneeMobile` និង `.dispSiteId`។
`queryTrackInfo.result` ទទេទាំងពីរ (`[]`) ➜ មិនប្រើជាភស្តុតាងមកដល់ ឬចុះហត្ថលេខា។

- `palmDeps.project` អាន `cod` និង `dod` ផ្ទាល់; mapping `ZTO_FIELD_COD/DOD` របស់ Cookie និងវាល `agentAmount/fcAmount`
  មិនជំនួសតម្លៃ Palm ទេ។ សូន្យជាតម្លៃត្រឹមត្រូវ។ កូដ Cookie ដដែល។
- តំបន់ចាក់សោ `zto-order-detail.js` កែតាមរបាយការណ៍ field ខុសគ្នារបស់ម្ចាស់គម្រោង; `LOCK` ថ្មី។ តេស្ត override mapping Cookie
  និងដាក់តម្លៃផ្សេង ដើម្បីបង្ហាញថា Palm នៅតែយក `cod/dod` (តេស្តធ្លាក់លើកូដមុនកែ)។ ទិន្នន័យសាកជាសិប្បនិម្មិត។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Preview កំណែនេះ ៖ សាក Barcode Palm ម្តងទៀត ហើយផ្ទៀងលេខទូរស័ព្ទ និង COD/DOD ជាមួយ App Palm។
2. បញ្ជាក់ទម្រង់ request `queryTrackInfo` ពី APK Palm; ចម្លើយ `[]` មិនទាន់អនុញ្ញាតឲ្យបើកបញ្ជីមកដល់ ឬស្ថានភាពកញ្ចប់មួយៗទេ។

### [2.50.100] — 2026-10-16 · ZoeW ៖ 🧪 Palm បង្ហាញ billInfoQuery និង queryTrackInfo ពេញ

**ZoeW `2.50.100`** (`zoew-v362` ➜ `zoew-v363`) · ZoeKeyGen ដដែល · គ្មាន Firebase rules ឬ migration ថ្មី។
សំណើម្ចាស់គម្រោងក្នុង PR #328 ៖ 🧪 អាន full `queryTrackInfo` របស់ Barcode ដើម្បីរៀបចំ Palm ដូច Cookie sync;
ម្ចាស់គម្រោងបញ្ជាក់ថា Cookie ពី Blob និង Palm ប្រើ field ខុសគ្នា ធ្វើឲ្យ mapping រួមទាញតម្លៃខុស។
តំបន់ ZTO ចាក់សោ `zto-palm.js` កែតាមសំណើនេះ និងធ្វើបច្ចុប្បន្នភាព `LOCK`។

- 🧪 ក្នុងរបៀប Palm បន្ថែម `track=1` តែសំណើសាកល្បង; Function អាន `billInfoQuery` ➜ ផ្ទៀងសាខា ➜ អាន
  `POST /zto/locus/v1/queryTrackInfo` (`mailType: 1` · `mailNos: [barcode]`) ដោយ session និងហត្ថលេខា Palm។
- ចម្លើយដើមទាំងពីរនៅដដែល; mapping Cookie មិនស្គាល់ COD/DOD Palm ក៏អាចពិនិត្យ field ដើមបាន។ ការស្កេនធម្មតានៅតែប្រើ lookup ដដែល។
- ZTO JSON បង្ហាញពេញក្នុង textarea អាចអូស និងចម្លងបាន; គ្មានពិដាន ១៥០០ តួអក្សរ។ បើក Config ថ្មី សាកថ្មី ឬបិទ session ➜ លុបលទ្ធផលក្នុង memory។
- តេស្តលើ handler និង React ពិត ៖ JSON លើស ៤០០០ តួ · session/header · field មិនស្គាល់ · សាខាផ្សេង/បាត់ · upstream 401/429/500។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. លើ Deploy Preview PR #328 ៖ Login Palm ➜ API ស្វែងរក ➜ 🧪 ➜ Barcode ពិត ➜ ចម្លង `billInfoQuery` និង `queryTrackInfo`
   ដើម្បីផ្ទៀង field និងស្កេនមកដល់/ចុះហត្ថលេខាធៀប Cookie។ Mapping Palm ត្រូវផ្អែកលើចម្លើយពិតនេះ។
2. មិនត្រូវការ env ថ្មី។ ការទាញបញ្ជីមកដល់ក្នុងរបៀប Palm នៅតែបិទ; ការកែនេះផ្តល់ទិន្នន័យសម្រាប់រៀបចំជំហានបន្ទាប់។

## 🐛 ផ្នែក ២ — ប្រវត្តិកំហុស និងលេខដែលវាស់បាន (សម័យ React)

### 2026-10-26 — A327 ៖ Matrix reconnect ត្រូវទទួលពេល event loop ពិត

- Scale matrix ក្នុង A318 ធ្លាក់ដោយ harness រង់ចាំ Sign ពេល offline៖ `startZtoFinalMarkSweep()` ឆ្លើយភ្លាម ហើយ microtask loop មិនទុកពេលឱ្យ timer reconnect 250ms។ Chrome ពិតវាស់ ៦៧,៧៧៣,៧៦០ attempts ក្នុង 15004ms ដោយគ្មាន Sign; deadline ចប់ស្ងាត់ធ្វើឱ្យការផ្ទៀងបន្ទាប់រាយ root ខុស។
- `money-cookie-blob.js` ទុក 20ms រវាងការសាក និងទាមទារ expected Sign ពេល deadline; diagnostic មានតែ fields ដែលកំណត់ច្បាស់។ Product code មិនប្រែសម្រាប់ការកែ harness នេះ។ ក្រោយកែ Chrome វាស់ 278ms / ១៤ attempts / Sign ពិតក្រោយ reconnect។
- `money-multidevice-oracle.test.ts` បន្ថែម regression ពី loop ពិត ២៖ reconnect ត្រូវដំណើរការ និងខ្វះ Sign ត្រូវ reject។ ទាំងពីរ fail មុនកែ; full file ៣៣ pass ក្រោយកែ។ នេះមិនជំនួសការរត់ matrix ៨ × ៣ ឡើងវិញទេ; scale run ដំបូងនៅជា failure រហូតមានភស្តុតាង run ថ្មី។

### 2026-10-26 — A326 ៖ សោ IndexedDB មកយឺតក្រោយ lock/logout

- U1 ដែលនៅមិនទាន់បញ្ជាក់ពីជុំមុន ឥឡូវមានភស្តុតាងពី Chrome ពិត៖ `lookup-key-restore-idb.test.ts` bundle source ពិតក្នុង memory ហើយប្រើ native IndexedDB និង WebCrypto ជាមួយ AES key ដែល `extractable: false`។ រត់ `restoreLookupSecretKey()` · `logoutApp()` · `showAppLockScreen()` ពិតដោយគ្មានការពន្យារ IndexedDB ក្លែងក្លាយ; SDK sign-out និង local HTML route ជា fixtures។
- មុនកែ៖ ៤ fail (logout, lock, សោថ្មីជំនួស និង auth generation ប្រែ) / ២ controls pass (session ដដែល និង boot ដែលចាក់សោរួច)។ បញ្ហាគឺសោដែលបានសម្អាតត្រឡប់មក memory ឬជាន់សោថ្មី; UI នៅចាក់សោ ហើយមិនអះអាង PIN bypass ឬការលេចធ្លាយសោទៅក្រៅ។
- `restoreLookupSecretKey()` កត់ auth generation និង key identity មុន read ហើយផ្ទៀងទាំងពីរ រួម `appIsLocked` និង `appLockShouldArm()` មុន assignment។ ក្រោយកែ៖ ៦/៦ pass លើ Chrome; focused ៦ files ៥៤/៥៤ pass និង targeted lint pass។
- ក្រោយ rebuild៖ `app-lock-test` លើ Chrome ពិត ១៥៩/១៥៩ pass រួម PTR restore, locked startup និង IDB deletion; `secret-hygiene` ២៦៤/២៦៤ និង `lookup-config-secret-test` ៨/៨ pass។

### 2026-10-26 — A325 ៖ Smoke/SW checker បដិសេធ build ចាស់មុន browser

- វាស់ `dist` ដែលមាន cache `v415` ខណៈ source `v426`៖ checker ចាស់អាច PASS លើ artifact ចាស់។ `build-checker-freshness.test.ts` រត់ startup និង exit របស់ script ពិត៖ ១១ fail/៤ positive controls pass មុនកែ; ក្រោយកែ ១៥/១៥ pass។
- `assert-current-build.mjs` ផ្ទៀង source `APP_VERSION` ជាមួយ dist manifest និង cache literal តែមួយក្នុង SW ជាមួយ source `CACHE_VERSION`។ Missing/invalid/mixed/stale artifact ធ្លាក់មុនបើក browser ដោយប្រាប់ឱ្យ build; `DIST_DIR` របស់ SW checker នៅគាំទ្រ។
- Live SW check ត្រូវមាន activated worker, cache ដែលរំពឹង និង entries យ៉ាងតិច ៨ នៅក្នុង cache នោះ។ ឈ្មោះ cache ចាស់ ឬចំនួន entries ពី cache ផ្សេងមិនជំនួសភស្តុតាងរបស់ build ដែលកំពុងវាស់។
- Default dist ចាស់ `2.50.151` ត្រូវបដិសេធដោយ smoke/SW មុន browser ពេល source `2.50.162`។ ក្រោយ build ពី source៖ production smoke និង notice check pass; Chrome SW production `zoew-v426`, activated និង entries ២៣ pass; custom audit `DIST_DIR` entries ២៥ pass។ ការផ្ទៀង release/cache version មិនមែន content hash របស់ source ទាំងមូលទេ; ការកែ source ក្នុងកំណែដដែលនៅតែត្រូវ rebuild មុនវាស់។

### 2026-10-26 — A324 ៖ ផ្ទៀង Supabase ផលិតកម្មដោយអានតែប៉ុណ្ណោះ

- Connected Supabase tools ផ្ទៀងគម្រោង ZoeW `igqmfpmhrkvclzjafdov` ជា active/healthy លើ Postgres 17។ Migration history ២៩ ត្រូវគ្នានឹង repo រួម `20261025025905` quota cleanup និង `20261025025945` rules។ គ្មាន production write, migration ឬការកែ setting ក្នុងការផ្ទៀងនេះ។
- Public tables ៩ បើក RLS; `zoe_ops` មិនផ្តល់ client grants ទៅ `PUBLIC`/`anon`/`authenticated`។ Advisor INFO «គ្មាន policy» សម្រាប់ path ដែលបិទ direct access ហើយប្រើ private RPC ជាចេតនា; មិនបើក policy ដើម្បីលុប warning។ Performance INFO indexes FK មិនទាន់ប្រើ ២ រក្សាទុក។
- Security WARN៖ leaked password protection នៅបិទ។ វាជាការកំណត់ដែលឯកសារ Supabase រាយស្រាប់ក្នុងព្រំដែន Free/Pro; ការអាននេះមិនបានបើកវាទេ។
- Aggregate `tenant_state` ១ និង payload 2230124 bytes គ្រាន់តែជាស្ថានភាពគម្រោងដែលបានអាន; មិនមែនការតេស្តច្រើនហាង/ឧបករណ៍ ឬភស្តុតាង capacity។ Live Firebase និង live ZTO មិនទទួលភស្តុតាងជំនួសពី Supabase read-only checks ទេ។

### 2026-10-26 — A323 ៖ Supabase live write ក្រោយ operation receipt ផុតអាយុ

- `supabase-live-op-retention.test.ts` វាស់ `set`/increment ដែល server apply តែ ACK បាត់, page នៅរស់, offline ៧២ ម៉ោង ហើយ `zoe_ops` ត្រូវ purge៖ operation ទាំងពីរប្រតិបត្តិម្ដងទៀត (២ fail មុនកែ); positive control ៣ ម៉ោង pass។ Increment បូកស្ទួន ហើយ stale set អាចជាន់តម្លៃដែលឧបករណ៍ផ្សេងកែរួច។
- Live non-CAS set/update/increment ដែលមានលទ្ធផលមិនច្បាស់ ត្រូវអាន `zoe_now` មុន resend ហើយវាស់ពី server bound របស់ first send ដើម។ អាយុត្រូវនៅក្នុង `0..SB_OP_REPLAY_SAFE_MS` (២៤ ម៉ោង); clock មិនត្រឹមត្រូវ/ថយក្រោយ ឬផុតរយៈ ➜ ទុក journal unresolved និង `txOutcome: unknown`, recovery blocked។ មិនប្រើនាឡិកាឧបករណ៍ដើម្បីអនុញ្ញាត replay។
- Write ដែលមានភស្តុតាងថាមិនទាន់បានផ្ញើ អាចចេញក្រោយ offline ៧២ ម៉ោង ហើយកត់ first-send bound ថ្មី។ CAS transaction conflict/witness logic នៅដដែល; គ្មាន migration ឬ server change។ Dedicated tests ៨/៨ pass រួម peer value 120, rollback, malformed clock, known-unsent/fresh lost ACK, clock read បរាជ័យមុនផ្ញើ, account switch ពេល clock pending និង safe replay ៣ ម៉ោង។
- Final Supabase source suite៖ ២៦ ឯកសារ ២៣៣/២៣៣ pass (39.44s)។ Fixture ចាស់ ៤ បន្ថែម `zoe_now` scalar តាម contract ពិត។ Operation ចាស់ដែលមិនអាចបញ្ជាក់ត្រូវរក្សា journal ហើយឆ្លង recovery/reconciliation; មិនអះអាងជោគជ័យ ឬលុប evidence ដោយស្វ័យប្រវត្តិ។

### 2026-10-26 — A322 ៖ ACK របស់ cleanup ចាស់មិនដោះសោ operation ថ្មី

- `cleanup-applied-ownership.test.ts` បង្កើតការប្រណាំងលើ cleanup/delete/remove៖ កាន់ destructive history ACK, ប្ដូរ auth generation, ដោះ owner ចាស់ និងដាក់ owner/gate ថ្មីលើ item ID ដដែល; ACK ចាស់ឆ្លើយយឺតរួចលុប owner ថ្មី។ ករណីដំបូង ៣ fail មុនកែ; បន្ថែមករណីរក្សា journal owner ចាស់ ៣ ទៀត ក៏ fail ក្រោយការកែដំបូង។
- បន្ថែម stale CAS updater និង delayed foreign-slot collision reply ២ ករណី fail មុនការកែ slot fence។ Timeout ក្នុង session ដដែលបង្កើត operation ជាន់គ្នា ២ ករណីបន្ថែម (completion ទាំងពីរលំដាប់) ក៏ fail មុនកែ reference ownership។ Regression ថ្មីទាំង ១០ ឥឡូវ pass។
- `beginCleanupOperation()` និង `releaseCleanupOperation()` តាម gate token និង journal owner របស់ operation នីមួយៗ; mark/prepare/rekey រក្សា ownership ហើយ session ចាស់មិនកាន់ owner ថ្មី។ `owner.operations` រក្សា shared Web Lock ដល់ operation ដែលបានចុះឈ្មោះចប់ទាំងអស់។ Slot ពិនិត្យ database/API/auth generation ទាំងក្នុង updater និងពេល reply។
- Finalization ដោះតែ entry ដែល operation នោះកាន់; មិនដោះជុំថ្មីដោយសារតែ ID ដូចគ្នា។ គ្រប `cleanup.ts` · `barcode-ops.ts` · `entry-ops.ts`។ Focused regression ជាការវាស់ module + delayed backend harness; broader suites និង emulator/SQL/browser matrix ត្រូវផ្ទៀងលើការកែរួម មុនសន្និដ្ឋានទាំងពីរ backend។
- Source suite ក្រោយ reference-aware fix៖ ៤ ឯកសារ ១៥១/១៥១ pass រួម `cleanup-applied-ownership.test.ts` ២៩ និង foreign-slot/pickup/mirror guards។
- Final measure lifecycle guards ៩ មាន ៦៩៧ assertions pass; source three-device recovery ៩១/៩១ pass រួម negative controls ស្ទួនប្រាក់/បាត់ journal។ Matrix ៧ flow × ៥ failure modes × ២ auth modes × ២ backend (១៤០ flow cases បូក sequential flows) មិនបានរត់ក្នុង local session; ត្រូវយកភស្តុតាងពី CI ដាច់ដោយឡែក។

### 2026-10-26 — A321 ៖ ត្រា ZTO និង Push មិនឆ្លង session; ជូនដំណឹងមានពិដានត្រឹមត្រូវ

- `zto-final-mark-session.test.ts` និង `expiry-schedule-cap.test.ts` មុនកែ៖ ៦ fail/១ control pass; `push-schedule-session.test.ts` មុនកែ ៣/៣ fail។ CAS updater ឥឡូវផ្ទៀង auth/lookup/reset ownership ម្តងទៀត; reset អនុញ្ញាតជុំថ្មី ហើយ finally របស់ជុំចាស់មិនដោះ latch ថ្មី។
- ការរៀបពេលជិតត្រឡប់ទុកពេលដំបូងៗអតិបរមា ២០០០ ដោយ bounded heap `O(N log 2000)`; input order មិនលុប earliest deadlines ហើយ timestamp ស្ទួនរក្សាចំនួនពិត។ Push ពិនិត្យ shop/auth និងការកំណត់បើក មុន POST និងមុនកត់ local stamp; token ដែលឆ្លើយយឺតមិនសរសេរទៅហាងថ្មី។
- Focused ៦ ឯកសារ ១១៩/១១៩ pass។ Broader ZTO/Palm/Push ៦៩ ឯកសារ៖ ១៨៣៤ pass, ៣ expectation Cookie ចាស់ដែលផ្នែក A319 កែ/សាកឡើងវិញ, ២ skip ព្រោះ browser path Linux។ Rerun outbox IndexedDB ដោយ Chrome ពិតលើ Windows៖ ២/២ pass; auth/tenant ៦ ឯកសារ ៣៥/៣៥ pass។ គ្មាន schema/server change។
- ការគណនាពេលលើកញ្ចប់ច្រើន និងការវាស់ concurrency ក្នុង harness មិនមែន throughput/latency benchmark លើ Supabase, Firebase ឬ ZTO ផលិតកម្ម។ លទ្ធផល multi-shop/device ត្រូវភ្ជាប់ backend ពិតដែលបានរត់ និងចំនួនឧបករណ៍ មុនសន្និដ្ឋានសមត្ថភាព scale។
- Secret checks៖ `secret-hygiene` ២៦៤, `lookup-config-secret-test` ៨/៨ និង `security-guard-test` ៥៦/៥៦ pass រួម production build, reverse probes លេចធ្លាយ ១៥ ប្រភេទ និង RLS tables ៩។ វិសាលភាពគឺ source/build បច្ចុប្បន្ន; មិនមែន scan git history ឬ production environment។
- State hygiene បន្ថែមរកឃើញ Push closure រក្សា session ក្រោយ logout៖ regression ១ fail/៣ controls pass មុនកែ។ `resetPushScheduleSession()` ភ្ជាប់ session cleanup និងដោះ owner/in-flight/attempt stamp; completion ដោះតែ closure ខ្លួនឯង និងមិនលុប saved device subscription។ Focused ៥ ឯកសារ ៧២/៧២ pass។
- Final measure `state-hygiene` ផ្ទៀង state ៣៧៣៖ ZoeW ៣០០ (reset ១៩១ / documented ១០៩), KeyGen ៧៣ (reset ៧០ / accepted ៣)។ ការយាមស្ថានភាពមិនជំនួសការវាស់ secret លើ production environment។

### 2026-10-26 — A320 ៖ Health Check និង DB liveness ផ្ទៀងលទ្ធផលដែលមានភស្តុតាង

- `health-runtime-evidence.test.ts` មុនកែ៖ ៨/១០ fail និង ២ positive controls pass; បន្ថែម signed-out/initializing/expired snapshot ៣ ករណី ក៏ fail មុនកែ (សរុប ១១/១៣)។ `db-liveness.test.ts` បន្ថែម ២ ករណី fail ព្រោះ synchronous throw/client rejection ត្រូវរាប់ថាភ្ជាប់ Server បាន។
- ក្រោយកែ៖ ពិនិត្យ snapshot/session/listener និង ownership ក្រោយ await, សាក storage round trip ពិត, មិនបង្ហាញ network/SW ✅ ដោយសារ property មួយប៉ុណ្ណោះ។ [MDN navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) បញ្ជាក់ថា browser online hint មិនធានាថា service អាចភ្ជាប់បាន។
- Focused health/advice/no-backend/connection៖ ៥ ឯកសារ ៤៣ tests pass; typecheck/lint ឆ្លងក្រោយបន្ថែម phase checks។ Network/listener/SW បន្ថែម៖ ៩ ឯកសារ ៦៩ tests pass។ នេះវាស់គំរូ failure និង module behavior; មិនជំនួស browser Health Check ជាមួយ ZTO/DB ផលិតកម្មទេ។ Supabase read-only inspection រស់ក្នុង A324 ដាច់ដោយឡែក។
- Measure build ចុងក្រោយរួម A322/A323៖ `health-check-test` ២១៩ pass។ `connection-recovery-test` ២៤១, `connection-state-fuzz-test` ៥២៩៧១ assertions ក្នុង ៥៧៦០ steps និង `network-timeout-test` ២៦ pass។ Chrome ពិត៖ `listener-leak-test` ១៧ pass ពី login/reconfig ៣, relisten ៥ និង online/offline ៨ ជុំដោយគ្មានការកើន; positive leak control ០ ➜ ៤ ត្រូវចាប់។
- Service Worker លើ Chrome ពិត៖ `sw-install-integrity-test` ៦២ និង `offline-shell-test` ១៩ pass; rerun ជាមួយ browser path ពិតក្រោយ Linux default path មិនមានលើ Windows។
- Daily flow បន្ថែម ១៦ ឯកសារ ១៥៨ tests pass៖ Export, close restamp, hardware scanner, Locker, batch scan, daily stats, import race, phone pickup, camera/image QR និង scanner modal/focus។ ចំនួននេះរាយតាម suite ដែលរត់; មិនបូកជាមួយ suite ផ្សេងដើម្បីអះអាង test ឯករាជ្យសរុបទេ។
- Production build៖ native checks ១១៨ pass; `history-window-check` ០ FAIL លើ ៦០០ rows សម្រាប់ Android APK bridge និង PWA Android/iPhone ក្នុង Chromium។ Native bridge និង device behavior ជា simulation; មិនមែនការសាក APK ឬទូរស័ព្ទពិត។

### 2026-10-26 — A319 ៖ គោលការណ៍ Cookie ២ ម៉ោង និងជួរ Palm ចាស់

- សំណើម្ចាស់គម្រោងកំណត់ Cookie cleanup ក្រោយបិទ «យករួច» លើ ZoeW ២ ម៉ោង។ Function មុនកែបដិសេធ unsigned ដែលគ្រប់ ២ ម៉ោង តែទទួល signed ដែលទើបបិទភ្លាម៖ regression ធ្លាក់ ២ ករណី។ `barcodeCloseIsRipe()` ឥឡូវអាន `closedAt` ក្នុង Cookie; Palm នៅអាន Sign ពិត។
- `zto-final-marks.test.tsx` និង `lookup-modes-money.test.ts` ៩០ pass។ Palm ជួរចាស់គ្មាន/ទទេ barcode array ធ្លាប់ fallback ទៅ local ហើយចូលធុងសំរាមដែលស្តារមិនបានដោយគ្មាន Sign៖ មុនកែ ២ fail/២ controls pass; ក្រោយកែ ៤ pass។ `pickup-cleanup-collected-race` · `zto-abandon-signed-gate` · `zto-signed-only-purge` ៥៧ pass ក្រោយកែ expectation តាមគោលការណ៍ថ្មី។
- `money-cookie-blob.js` ពង្រីក matrix ពី ៦ ទៅ ៧ flow ដើម្បីបំបែក Cookie unsigned cleanup ដែលស្តារបានពី signed cleanup ដែលហាមស្តារ។ ការពង្រីក test មិនមែនលទ្ធផលរត់ទេ៖ matrix Firebase/Supabase ពេញនៅត្រូវផ្ទៀងដោយឡែក; unit harness ជា simulation។

### 2026-10-26 — A318 ៖ Checker មិនបៃតងពេលខ្វះភស្តុតាង និងឯកសារសម្រាប់ session ក្រោយ

- `runall-runner-test` បន្ថែមសេណារីយ៉ូ dependency មិនមាន ➜ មកវិញលើ tree ដដែល។ មុនកែ៖ ៣ assertions ធ្លាក់; runner រាយ ✅ «ជោគជ័យទាំងអស់» ទោះមាន SKIPPED/PARTIAL ហើយ RESUME មិនសាកពួកវាឡើងវិញ។ ក្រោយកែ៖ focused block ៥/៥ pass; យកតែ PASS ពេញលេញពី state និងរាយ ⚠️ ពេលគ្របមិនពេញ។ Exit code ដោយគ្មាន STRICT នៅរក្សាន័យ «គ្មាន FAIL»; មិនមែនភស្តុតាងថាគ្រប់ checker បានរត់ទេ។
- Full runner checker លើ Windows Git Bash មានការធ្លាក់ផ្នែក GNU timeout/TERM/PATH ដែលតេស្តសម្រាប់ Linux; focused block រត់ production runner ពិត។ ត្រូវផ្ទៀង full runner ក្នុង CI មុនរាយការណ៍ថាឆ្លងទាំងអស់។
- [CI 40300784912](https://github.com/mengsroy-h/Zoe-System/actions/runs/40300784912) លើ `7c0d10ac` ផ្ទៀង Linux `runall-runner` ៧០/៧០, `exit-code-integrity` ១១/១១ និង `repository-file-coverage` ១០/១០ pass។ Shard ១ រាយ ៥០ pass/១ fail/០ partial/០ skip; `emu/restore-mutation` ធ្លាក់ដោយ missing `cleanupOperationOwners` ក្នុង extracted harness។ លទ្ធផលអ្នកយាម runner មិនមែន full CI បៃតង។
- ពិនិត្យឯកសារ Markdown ដែល tracked ទាំង ២៥ និង relative links ២១២៖ គ្មាន target បាត់។ `CLAUDE.md` បែង core table ជា ៦ ប្រធានបទ ដោយផ្ទៀងជួរដើមទាំង ១៣៦ មិនបាត់; session authority យកពីសន្ទនាបច្ចុប្បន្ន មិនមែន handoff ចាស់។
- Focused runner summary/state/resume/selection បន្ថែម៖ ១៨/១៨ pass រួម SKIP/PARTIAL ដាច់ៗ និង filtered run។ `repository-file-coverage` ១០/១០ និង `doc-scope-test` ១១០/១១០ pass; mapping គ្រប test ថ្មី ហើយមិនអះអាងការគ្របដណ្តប់រាល់បន្ទាត់នៃ implementation។ `npm run doc:check` ក៏ឆ្លង។
- បន្ថែម `workflow_dispatch.multishop_scale` ក្នុង `audit.yml`៖ false ដោយលំនាំដើម; true រត់តែ Supabase matrix ៨ ហាង × ៣ devices លើ shard ១, ដក shard filter និងរក្សា timeout/STRICT ដដែល។ PR/push និង dispatch ធម្មតានៅរត់ CI ពេញ ៤ ផ្នែក។ Concurrency group ដាច់ និងរំលង screenshot artifact ក្នុង scale run។ `repository-contract-test` វាស់ source expressions និង shell step ពិត៖ ៤ fail មុនបន្ថែម workflow, ៧/៧ pass ក្រោយកែ។ នេះជាភស្តុតាង wiring; លទ្ធផល scale ត្រូវយកពី run ពិត។ [GitHub matrix/exclude](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations) ជាប្រភពសម្រាប់ matrix policy។
- ផ្លាស់ release entries `2.50.0–2.50.99` ចំនួន ៣៦៦៥ បន្ទាត់ / 786404 bytes ទៅ archive ផ្នែក ៨ ដោយមិនកែខ្លឹមសារ។ SHA-256 នៃ block ដែលផ្លាស់៖ `fa6366abe624d431d275e21eccc62b3f5825eca783348ae7c52314f97c90a9cf`។ ផ្ទៀង version headings និង finding IDs ទាំងពីរឯកសារមិនបាត់/ស្ទួន ហើយលិបិក្រមដេរីវេឡើងវិញពីប្រភពរបស់ `doc-scope-test`។
- [Scale run 40300785631](https://github.com/mengsroy-h/Zoe-System/actions/runs/40300785631) លើ `7c0d10ac0d46f0bd64dbef47e7dcc62e631b3b3e` បញ្ជាក់ wiring ពិត៖ job តែមួយ, checker តែមួយក្នុង ២១៥, banner ៨ ហាង × ៣ devices និងឧបករណ៍ ២៤ ចូលបានដោយឃើញតែហាងខ្លួន។ Matrix ធ្លាក់ក្រោយ 158.1s នៅ `Palm pickup2h/offline-online/move` (រំពឹង barcode ក្នុង trash តែបាន history)។ Runner រាយ FAIL/មិនពេញលេញត្រឹមត្រូវ; លទ្ធផលនេះមិនបញ្ជាក់ scale correctness ឬ capacity ផលិតកម្ម ហើយត្រូវវាស់ឡើងវិញក្រោយដោះស្រាយ។

### 2026-10-26 — A317 ៖ ម៉ឺនុយ Sign បង្រួមតាមរូបម្ចាស់

- `queued-sign-photo-ui.test.tsx` បន្ថែម guard មុនកែ៖ រំពឹងសកម្មភាព ០ ពេលម៉ឺនុយបិទ ប៉ុន្តែឃើញ ៦ ប៊ូតុង។ បន្ទាប់មកផ្ទេរប៊ូតុងទៅ disclosure ក្នុងជួរ; ការបញ្ជាក់អចិន្ត្រៃយ៍នៅក្នុង handler ដើម។
- បើកតែមួយជួរ, បិទមុន callback, បិទពេលចុចខាងក្រៅ/Escape និង reset ពេល lock ឬ modal បិទ។ Screenshot ប្រើ React component/CSS ពិត ជាមួយទិន្នន័យសំយោគ និង mocks ដែលមិនទាក់ទង ZTO/DB ពិត។
- តេស្ត UI ១៣ និង notifications ២១ pass; outbox ២១៧ pass ជាមួយម៉ឺនុយថ្មី។ Typecheck/lint, clock-hygiene ២៣, security-guard ៥៦ និង repository-contract ១៣០ pass។
- ផ្ទៀងលើ Windows Chrome ជាមួយ Kantumruy Pro/Inter ពី URL របស់ app៖ ៩/៩ ទំហំ pass និងបានផ្ញើ screenshot ឱ្យម្ចាស់មើល។ ពេល CI ថតរូប តេស្ត allowlist តែ Google Fonts និងផ្ទៀង HTTP 200, fonts.load/check និង rendered font; តេស្តទូទៅនៅបិទ network។
- CI ជុំដំបូងវាស់ប៊ូតុងពេល `modalPopIn` នៅ scale 0.92: 44px ក្លាយជា 40.48px។ Layout test រង់ចាំ animation ពិតចប់ មិនបន្ថយទំហំ 44px និងមិនបិទ animation ផលិតកម្ម។
- ការវាស់ Windows Chrome ខាងលើមិនជំនួសការផ្ទៀង iPhone/Android ពិតទេ; layout guards ត្រូវឆ្លង CI លើ commit ដែលដាក់ប្រើ។ គ្មានការកែ `app.css` ដែលជាតំបន់ចាក់សោ។

### 2026-10-26 — A316 ៖ CSV វាលថ្ងៃ/ម៉ោង និងការបំបែកជួរដោយ CR

- `scanDate` និង `time` ជា string ក្នុង rules; CSV ផ្ទុក raw values ដោយមិនឆ្លង `csvSafeText` ខណៈ locker/status មាន guard។ ការសាក export ពិតជាមួយតម្លៃសំយោគ `=1+1`, សញ្ញា formula និង control characters ឃើញ raw formula នៅថ្ងៃ/ម៉ោង។ CR ដែលមិន quote បង្កើត ៥ ជួរ ជំនួស header និងកញ្ចប់ ១។ មិនបាន execute formula ឬទាក់ទង endpoint ខាងក្រៅ។
- `export-request-snapshot.test.ts` បន្ថែម CSV round-trip តាម SheetJS ពិត៖ មុនកែ ៧ fail, ២ pass; ក្រោយកែរួម full-width variants សរុប ២៣ pass ជាមួយ Excel snapshot tests ចាស់។ ផ្ទៀង ១០ columns, ២ rows, តម្លៃអត្ថបទ, leading zero របស់ phone/Barcode និង COD/DOD មិនប្រែ។
- CSV quote CR និង LF, neutralize វាលថ្ងៃ/ម៉ោង ហើយពង្រីក unsafe leading characters ទៅ LF/full-width variants។ មិនប្ដូរ database, គណនាប្រាក់ ឬ XLSX export។ [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection) ពន្យល់ថាការបកស្រាយអាចខុសតាម spreadsheet client; មិនធានាក្រោយកម្មវិធីផ្សេង save/reopen ឯកសារឡើងវិញទេ។

### 2026-10-26 — A315 ៖ Race នាឡិកាមុនលុបរូប Sign និងជុំបូកដកបាត់ ACK

- Deep audit រកឃើញ៖ `maintainQueueLifecycle()` ផ្ទៀង ២៤ ម៉ោងមុន await IndexedDB ប៉ុន្តែ commit predicate ពិនិត្យតែ owner និង clock trust។ បើ offset កែថយក្រោយ ឬទៅ Infinity ក្នុងចន្លោះនេះ អាចលុបរូបមុនកាលកំណត់។ តេស្តលើ app function ពិត និង delayed commit predicate មុនកែ៖ ២ fail, ៣ pass។
- Predicate ឥឡូវអាន `getServerNow()` ម្ដងទៀតនៅពេល commit, ត្រូវ finite និងដល់ deadline។ Matrix rollback, invalid clock, trust lost, auth switch និង positive control ទាំង ៥ pass; មិនប៉ះទិន្នន័យកញ្ចប់ ឬ ledger។
- `lookup-modes-money.test.ts` បន្ថែម ៤ សេណារីយ៉ូ (Sheet/Cookie × លំដាប់បញ្ច្រាស)៖ អតិថិជនម្នាក់ ៣ កញ្ចប់, ដក/ស្តារកញ្ចប់ដដែល ៦ ជុំក្នុងមួយសេណារីយ៉ូ, commit តែបាត់ ACK រាល់ជុំ, ចុចស្ទួន។ ២៤ ជុំស្តាររាប់ Barcode និង COD/DOD ត្រឹមត្រូវ; មិនរកឃើញ bug លុយថ្មីក្នុងករណីនេះ។ SDK ជា simulator មិនមែនឧបករណ៍ពិត។

### 2026-10-26 — A314 ៖ Dependency audit លើឧបករណ៍ build/test និង Firebase Provision

- `npm audit` មុនកែ៖ ZoeW ៩ advisories (high ៧, low ២); dependencies ផលិតកម្មដោយ `--omit=dev` គ្មាន advisory។ Firebase Provision ៦ (high ៤, moderate ២)។ មិនមែនភស្តុតាងថាបានវាយប្រហារទិន្នន័យផលិតកម្មទេ។
- ផ្ទៀងកំណែជួសជុលពី npm និង [Happy DOM advisory](https://github.com/advisories/GHSA-834v-8h66-3h79), [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) និង Vite advisories GHSA-9jrq-w75r-8gcw / GHSA-rq7h-c2jc-7f22 / GHSA-vfpm-58rq-9qcg។ Happy DOM 21.0.4, Vite 8.3.5, Vitest 5.0.5 ត្រូវ pin; Zod 4.6.7 ក្នុង lockfile។ មិនបង្ខំ `npm audit fix --force`។
- Firebase Provision រក្សា firebase-tools 15.32.1 និងដំឡើង transitive dependencies ក្នុង semver ដែលឧបករណ៍ទទួល; tool package 1.0.2។ `dependency-security-test` ផ្ទៀង patch floor ដាច់តាម major របស់ body-parser និង undici ដើម្បីមិនរាប់ major ថ្មីដែលនៅ vulnerable ថាជាសុវត្ថិភាព។
- ក្រោយកែ `npm audit` រាយ ០ សម្រាប់ ZoeW ទាំងអស់ និង production, Firebase Provision, Supabase និង Backup។ Cookie helper ប្រើ lockfile បណ្ដោះអាសន្នពី dependency ដែល pin ដដែល ក៏រាយ ០; មិនប្ដូរគោលការណ៍ lockfile ក្នុង repo។ Guard ដល់ ៣៣ pass; Provision regression និង mutation ១៨៧ pass, Supabase Edge Function ២៣៥ pass។
- ការអានកូដជុំចុងក្រោយគ្របព្រំដែន session/admin របស់ ZoeKeyGen, Sign/លុយរបស់ ZoeW, HTTP/អត្តសញ្ញាណ Push, Supabase account/rules, backup/ផ្ទេរ, Firebase Provision និង Cookie/Apps Script import។ Cookie sync ១៨៣, capture ៥៦, zto-import ៩១ pass។ Postgres local បដិសេធ Unix socket; មិនចាត់ SQL runtime ថា pass ក្នុង workspace ទេ និងមិនកែ guard ដើម្បីឆ្លង។
- Guard លើ lockfile មុនកែធ្លាក់ ៤ ករណី ZoeW; ក្រោយកែ ២៧ pass មុនបន្ថែម floor របស់ Provision។ Critical app tests ៤៤៤ pass លើ dependencies ថ្មី។ លទ្ធផលពេញនៅ CI របស់ commit ជុំថ្មី; ការខ្វះ Chromium និង proxy dispatcher ក្នុង workspace ត្រូវរាយដាច់ មិនលាក់ជា pass។

### 2026-10-26 — A313 ៖ Backup · Push · Provision ហាមផ្ញើ credential តាម redirect

- Audit លើ `firebase-backup/supabase.js`៖ fetch លំនាំដើមតាម HTTP redirect; ការវាស់ដោយ server ពីរលើ loopback និង key ក្លែងឃើញ request ទីពីរទទួល apikey។ ផ្លូវ OAuth ក្នុង `backup.js` ក៏អាចបន្ត POST body ទៅ redirect 307/308។ មិនប្រើ credentials ឬទិន្នន័យពិត។
- `firebase-backup-test.js` បន្ថែម network regression ១០ ករណី៖ Supabase RPC និង Firebase/OAuth លើ 301/302/303/307/308 ត្រូវបដិសេធ និងគ្មាន request ដល់ទីតាំងបន្ទាប់។ មុនកែ៖ ៩៦ pass, ១០ fail។ ក្រោយកែ៖ ១០៦ pass, ០ fail។
- ពិនិត្យច្រកដូចគ្នាក្នុង Push service៖ `push-server.test.ts` បញ្ជាក់ redirect ៥ ប្រភេទអាចឱ្យទទួល identity ពីគោលដៅបន្ទាប់; OAuth/FCM មិនមាន redirect guard។ មុនកែ ៦ fail, ៦១ pass; ក្រោយកែ ៦៧ pass។ Shared request កំណត់ `redirect: 'error'` ដូចគ្នា ដើម្បីរក្សាគោលដៅផ្ទៀងអត្តសញ្ញាណ និងការផ្ញើសារ។ មិនប្ដូរ schedule, recipients ឬការអ៊ិនគ្រីប។
- Firebase Provision មាន public login/sign-up probe ដែលផ្ទុក password ក្នុង POST body។ `firebase-provision-test` បន្ថែម loopback redirect ៥ និង contract admin/DB client ២; មុនកែទាំង ៧ ធ្លាក់; ក្រោយកែ ១៩៤ pass។ Probe និង client ដែលឧបករណ៍បង្កើតឥឡូវហាម redirect ដោយរក្សា SDK context។ មិនកែ credentials ឬ settings ផលិតកម្ម។
- Client ទាំងពីរកំណត់ `redirect: 'error'` ជានិច្ច; CLI ផ្ទេរប្រើ client ដូចគ្នា។ មិនប្ដូរ URL គោលដៅ សោ សិទ្ធិ DB ឬគោលការណ៍ retry។ Tool package ឡើង 1.1.1; មិនប៉ះកំណែ ZoeKeyGen។

### 2026-10-26 — A312 ៖ QA ចំនួនកញ្ចប់ និងភាពឯករាជ្យរបស់តេស្ត

- ភស្តុតាង live នៅ Firebase សាកល្បង៖ ៣ Barcode ក្នុងជួរអតិថិជនមួយ; Dashboard រាប់ ៣ និងលុយត្រឹមត្រូវ តែ `renderEntryList()` រាប់ `rows.length`។ Regression មុនកែ៖ ២ ធ្លាក់ (រំពឹង ៥ បាន ២; legacy រំពឹង ៥០០ បាន ២៥០)។ ក្រោយកែ `list-render-scope.test.tsx` ទាំង ១០ pass រួម shuffle។
- Regression ស្វែងរក `QA-A2` បង្ហាញជួរខុស ព្រោះ strip អក្សរហើយយក `2` ទៅផ្គូផ្គងទូរស័ព្ទផ្សេង។ មុនកែ៖ ១ fail; រាប់តាម phone digits តែសម្រាប់ query ដែលមានទម្រង់លេខទូរស័ព្ទ។ `page-nav-test` រក្សា ១ ជួរ តែផ្ទៀង ២ កញ្ចប់តាម fixture ពិត។
- `zto-palm-sign.test.tsx` រំពឹងលំដាប់ callback ដែល async មិនធានា; សាកដដែល ៥ ដង មាន ១ ធ្លាក់ ទោះ Barcode ទាំងពីរត្រឹមត្រូវ។ Assertion ប្រៀប sorted array រក្សាចំនួន និងចាប់ស្ទួនដដែល។
- `session-switch-fuzz.test.ts` shuffle seed 360159 ធ្លាក់ ២ ព្រោះ fixture រក្សា pickupResetInFlight និង pause របស់ database ដើម។ Fixture ឥឡូវផ្ដល់ DB identity ថ្មី និង reset flag នៅចន្លោះ scenario; retry baseline ត្រូវមាន write ពិត មិនអនុញ្ញាត pass ដោយមិនវាស់។ ៦៨ ករណី pass លើ seed 360159, 1, 159360 និង 20261026។ គ្មានការបន្ធូរ guard ផលិតកម្ម។
- QA live ផ្ទៀង duplicate scan, partial pickup/reopen, Remove, edit/Cancel, reload, realtime រវាង tab, CSV និងរបាយការណ៍។ ការស្តារក្នុងហាងសាកល្បងត្រូវគោលការណ៍ ZTO Login ចាក់សោ; មិន bypass។ មិនបាន Sign ZTO ពិត ឬតេស្តកាមេរ៉ា/បិទ APK កណ្តាល upload លើឧបករណ៍ពិត។


### CI ជួរ Sign — បែង Vitest ដោយមិនរំលងតេស្ត (2026-10-26)

- Audit `40259019200` លើ `187ce711`៖ ផ្នែក ១ និង៣ pass; ផ្នែក៤ខ្វះ mapping របស់ `zoew-suite-diagnostics.test.ts`; ផ្នែក២ test លើស 240s។ បញ្ជី stdout ថ្មីបង្ហាញថាតេស្តនៅបន្តជោគជ័យ មិនមែនភស្តុតាងថា assertion ទាំងអស់ pass ទេ។
- វាស់ដោយ Vitest `BaseSequencer` ពិត៖ ឯកសារ 258 បែងជា 129 + 129, គ្មានស្ទួន ឬខ្វះ។ `list --filesOnly` ផ្ទាល់មិនអនុវត្ត sharding ដូច runner ទេ ដូច្នេះមិនយកវាជាភស្តុតាងនៃការបែងចែក។
- `zoew-suite` មាន ៣ ផ្នែក៖ type/lint និង Vitest 1/2; build/browser ដដែល; Vitest 2/2។ CI នៅប្រើ GitHub jobs ៤ដដែល។ រក្សាពិដាន test 240s និងពិដាន checker ដដែល; គ្មាន test skip ឬបិទ isolation។ ផ្នែក build/browser មុនចំណាយ 221.4s ដូច្នេះមិនបន្ថែម Vitest លើវាទេ។
- ការផ្ទៀងប្រាក់ និងអតិថិជនក្នុងតេស្តមិនកែ។ Assertions រូប/queue ផ្ទៀងថាការងារជោគជ័យនៅរក្សាដល់កាល 24 ម៉ោង ជំនួសការរំពឹងលុបភ្លាម; សេណារីយ៉ូ session ផ្សេងគ្នាដាច់ fixture ពីគ្នា។
- អ្នកយាម៖ `repository-file-coverage` · `runall-runner-test` · `repository-contract-test` · `zoew-suite-diagnostics.test.ts` · `zto-palm-sign.test.tsx` · `zto-partial-customer-real-close.test.ts`។ Browser/network ក្នុង local នៅជាប់សិទ្ធិ; CI ត្រូវបញ្ជាក់លទ្ធផលពេញ។
- មុន push៖ regression និងការផ្ទៀងប្រាក់ 158 ករណី pass; file coverage 10/10, runner 63 និង repository contract 130 pass ក្នុង layout fixture static ដែលមាន vendor ពិត។ ការរត់ test shards ក្នុង local ចាប់បានតេស្តចាស់ដែលរំពឹងលុបភ្លាម ហើយបានកែឱ្យត្រូវកាលរក្សា 24 ម៉ោង; assertion លុយទាំងអស់នៅដដែល។


### 2026-10-25 — A311 ៖ ការពិនិត្យថ្មីមិនបានបាំងភស្តុតាង Sign ដែលមាន

| លេខ | ប្រភេទ | មូលហេតុ និងវិសាលភាព | អ្នកយាម |
|---|---|---|---|
| A311 | Sign status និង freshness | status អានមិនបានជំនួស signed ដោយ undefined; statusChecked បិទ fallback ហើយសារខ្លីបាំងព័ត៌មានចាស់ | `palm-sign-outbox.test.tsx` · `queued-sign-photo-ui.test.tsx` · `queued-sign-photo-layout.test.ts` |

- មូលដ្ឋាន `1e375c77e99a55847570202cc6069e4d93270405`។ Screenshot បង្ហាញការងាររក្សាទុកពីរមានស្លាក unknown ដូចគ្នា។ គ្មាន IndexedDB migration reset; ផ្លូវ held/recovery/trash status និង UI precedence បង្កើត regression នេះបានក្នុង fixture។ មិនបញ្ជាក់ថា live lookup ខូចដោយមូលហេតុណា។
- **RED ៩** មុនកែ ➜ **GREEN ២០២/២០២** ក្នុង outbox/UI files។ គ្រប signed/unsigned/unknown ចាស់, HTTP/network/cached/barcode mismatch, reload, original/request retention, មិន auto-hide និងមិន resume ពេល fresh status មិនបាន។ Fresh-response/CAS/session/restore guards ដើមនៅឆ្លង។
- Chromium ពិត `/usr/bin/chromium`៖ **៧/៧** viewport checks (320/360, phone, tablet, desktop និង short/landscape); synthetic screenshots បង្ហាញស្លាកលើកមុន និង failure ដោយ Details បិទ។ Typecheck, focused lint, comments និង diff checks ឆ្លង។ ជុំ release ផ្ទៀងបន្ថែម locked-zone ជាមួយ suite ដដែល៖ ២២៥/២២៥; notice/doc/android metadata, version និង scope checks ឆ្លង។
- ការកែរក្សា last-known signed/photo evidence; optional statusUnavailable បំបែក freshness។ Fresh status gate មិនទន់; unavailable មិនអនុញ្ញាត continuation។ គ្មាន receipt/photo replay, original purge ឬ app accounting change។ គ្មាន live ZTO/DB calls, full local QA ឬការផ្ទៀងទូរស័ព្ទពិត; រង់ចាំព័ត៌មានលម្អិត និង CI លើ PR។

- PR CI `40245483886` ផ្នែក ១ ធ្លាក់ `clock-hygiene`៖ local `at: Date.now()` ផ្លាស់ពី helpers ចាស់ទៅ `previousSignCheck` ប៉ុន្តែបញ្ជី exact AST sites មិនទាន់តាម។ កែតែ checker៖ ចង្អុល property `at` នៅ helper ថ្មី និងដក sites ចាស់ ៣ ដែលលែងមាន; មិនអនុញ្ញាត function ទាំងមូល។ Local checker GREEN ២៣/២៣; mutation បន្ថែម raw clock ផ្សេងក្នុង helper និងប្ដូរទៅ server field `createdAt` នៅតែ RED ទាំងពីរ។ គ្មាន app behavior ឬ accounting change ក្នុង CI repair នេះ។ ផ្នែក ២ ជុំដើមផុតពិដាន full Vitest ២៤០ វិនាទី ដោយ log មិនបង្ហាញ assertion ជាក់លាក់; មិនបង្កើនពិដាន ឬរំលងតេស្ត។ ផ្នែក ៣/៤ ឆ្លង។ មុន push ការកែ៖ checker ចាស់ reproduce RED ២ ដូច CI; `clock-hygiene` ថ្មី ២៣/២៣ និង `zoew-suite` ទាំង ១៣ ជំហាន local ឆ្លង (full Vitest ២២១.៥s, native ១៧២.៣s, rules ២២.៥s) ក្រោមពិដានដើម។ Browser harness ប្ដូរតែ executable path ទៅ Chromium ដែលមាន; មិនប្ដូរ assertions។ CI លើ head ថ្មីនៅត្រូវផ្ទៀង។

### 2026-10-25 — A309 ៖ បញ្ជី Sign តូចចង្អៀត និងការបញ្ចប់ដែលច្រឡំជាមួយការលុបរូប

| លេខ | ប្រភេទ | មូលហេតុ និងវិសាលភាព | អ្នកយាម |
|---|---|---|---|
| A309 | UI និងការរក្សារូប Sign | សារវែង/ប៊ូតុងប៉ះគ្នា; signed ខ្វះរូបនៅបង្ហាញជាការងារជាប់ | `palm-sign-outbox.test.tsx` · `palm-sign-outbox-idb.test.ts` · `queued-sign-photo-ui.test.tsx` · `queued-sign-photo-layout.test.ts` |

- មូលដ្ឋាន `c00dac8b5dcc0675d129f67e0d73f0c05ed46588`។ Fresh successful status ត្រូវ Barcode, signed, មិន cached/returned; local flag និង HTTP200 តែឯងមិនអនុញ្ញាតលាក់ការងារ។ មិនសន្និដ្ឋានប្រភព Palm ពីការខ្វះរូប។
- រក្សា encrypted row ដើមដោយ visibility marker; originals/request/history/សមត្ថភាព ៤០ ដដែល។ Manual dismiss ត្រូវបញ្ជាក់ និង CAS/lease; គ្មាន receipt/photo replay, cancel in-flight ឬ money write។ Physical purge នៅត្រូវ exact-original proof និង guarded close ដដែល។
- ការវាស់ local មុនរួម៖ focused UI/outbox/store ២០៨ ករណីឆ្លងតាមជុំ; Chromium render ៧ viewport រួម 320/360, tablet/desktop និង landscape/short។ Screenshot ផ្ទៀង Khmer wrapping, touch target, spacing, overflow, footer និង shared modal size។ មិនជំនួសការសាកឧបករណ៍ពិត ឬ live Sign។
- ការផ្ទៀងលើ source រួមកំណែនេះ៖ ៩ test files / ២៩៥ ករណីឆ្លង (រួម UI, outbox, money oracle, layout និង locked zones); typecheck/lint/build, version/scope, doc-scope ១១០, clock ២៣, comments និង Android metadata ១២៥ ឆ្លង។ Remote CI នៅរង់ចាំ; មិនបានរត់ full QA ឬ live operations។

- PR CI `40219772479` ផ្នែក ៤ ធ្លាក់ `fluid-type-focus-test`៖ queue CSS មាន font-size ថេរជា px ៧ ចំណុច មិនប្រើមាត្រដ្ឋាន App។ ប្ដូរទៅ `calc(N * var(--fs-unit))` ដោយរក្សាទំហំគោល/spacing និង assertions ដើម។ Rendered font-scale regression ថ្មី RED ៦/៧ viewport មុនកែ ➜ GREEN ៧/៧; typography checker ពិត GREEN ៧២/៧២, typecheck និង focused ESLint ឆ្លង។

### 2026-10-25 — A310 ៖ Money checker រំពឹងថ្ងៃដើមពេល scan ឆ្លងអធ្រាត្រកម្ពុជា

| លេខ | ប្រភេទ | មូលហេតុ និងវិសាលភាព | អ្នកយាម |
|---|---|---|---|
| A310 | Checker តាមថ្ងៃ/ខែ | expected totals ចងនឹងថ្ងៃចាប់ផ្តើម ខណៈ App កត់តាមថ្ងៃស្កេនថ្មី | `emu/money-multidevice-test` · `money-multidevice-oracle.test.ts` · `lookup-modes-money.test.ts` |

- Main Audit `40212978722` ធ្លាក់ `sequence/unsigned/removeBarcode/scan: COD`: actual `461.07`, expected `471.07`; invariant/identity មុន assertion ឆ្លង។ Run ចាប់ផ្តើម `16:59:14 UTC` មុនអធ្រាត្រកម្ពុជា; raw failed DB snapshot មិនមាន ដូច្នេះ attribution នេះមានភស្តុតាងខ្លាំង តែមិនមែនអានពី snapshot ដើម។
- Same-day controls ឆ្លងលើ source 155 និង 156; controlled rollover ធ្វើ checker ដើម RED ទាំងពីរ ហើយ emulator បង្ហាញថ្ងៃថ្មី COD10/DOD2/count1 និង monthly sum ត្រឹមត្រូវ។ មិនឃើញប្រាក់បាត់ក្នុងករណីវាស់នេះ; មិនកែ app accounting។
- Expected deltas សរសេរដាច់ពី actual totals; scanDate ត្រូវ timestamp និង before/after server-time window។ ផ្ទៀង union នៃគ្រប់ថ្ងៃ/ខែ និងរក្សា COD/DOD/count/barcode/registry assertions។ Unit/App fixture ៦០ ឆ្លង; real RTDB emulator same-day Sheet/Cookie/Palm ២៥២ checkpoints, day rollover ១៦ និង month rollover ១៦។ Corruption controls រួមប្រាក់, ថ្ងៃចាស់, ខែ, barcode បាត់/ស្ទួន និង timestamp ខុស។
- មិនរត់ random-operation sweep, Supabase/Postgres runtime ឬ full local QA។ តេស្តប្រើ synthetic data; CI លើ commit រួម និងការផ្ទៀងផលិតកម្មនៅមិនទាន់មាន។

- PR CI `40220960260` ផ្នែក ១/២/៤ ឆ្លង; ផ្នែក ៣ ធ្លាក់ `supabase-money-multishop-test` ក្នុង timestamp window ថ្មី។ Supabase RPC កែ offset កណ្ដាល confirm ដូច្នេះតម្លៃមុន/ក្រោយមិនធានាគ្របពេល scan។ Controlled Postgres RED៖ createdAt `1792953989912`, before `1792953994892`, after `1792953989968`; endpoint window ខកពេល scan ៥៦ ms។ Checker កត់ range នៃ clock reads ក្នុង confirm ដោយរក្សាតម្លៃ Date.now ដើម និងស្ដារក្នុង finally; មិនបន្ថែម tolerance ឬយក actual money មកធ្វើ expected។ Unit drift ±/stable/month boundary និង restore-on-error RED ២ ➜ GREEN ៦៤/៦៤ ជាមួយ App fixtures; real Postgres ២ ហាង × ៣ ឧបករណ៍ ជាមួយ controlled offset correction ឆ្លង assertions ១០ និង `zoe_write` ៩៣៨ សំណើ។ Typecheck/lint/syntax/diff ឆ្លង; app accounting មិនប្រែ។

### 2026-10-25 — A308 ៖ ផ្អាក active queue ដោយរក្សាការងារ និងបំបែកភស្តុតាង Sign/រូប

| លេខ | ប្រភេទ | មូលហេតុ និងវិសាលភាព | អ្នកយាម |
|---|---|---|---|
| A308 | ការសង្គ្រោះការងារ Sign ដែលផ្អាក | Queue មិនមានបញ្ជីរក្សាការងារដាច់ពីការរត់ ហើយសាររួម Sign/រូបបាំងភាពខុសគ្នារវាង signed ខ្វះរូប និង unsigned legacy | `palm-sign-outbox.test.tsx` · `palm-sign-outbox-store-unit.test.ts` · `palm-sign-outbox-idb.test.ts` |

- មូលដ្ឋាន `a2db361453f9d9dca96fc2047685dababe25597f`។ ផ្លូវថ្មីរក្សា encrypted row ដើម និង phase `action` ជាមួយ recovery marker; ទាំង scheduler និង actions ទប់ automatic receipt/photo replay។ Archive ប្រើ local CAS និងមិនរំខានសំណើដែល lease នៅសល់; resume មានប្រវត្តិ និងផ្ទៀង server capability ថ្មី មិនប្ដូរ receipt request ID។
- **RED**៖ តេស្តថ្មីលើ source មុនកែ ធ្លាក់ ៧/១០; partial-trash signed diagnosis បន្ថែមធ្លាក់ ១/២ មុនកែ selector។ **GREEN**៖ focused outbox/store/IndexedDB **១៨២/១៨២**។ គ្រប archive/reload/export/count, original/hash/request retention, signed/no-photo, legacy/different request, stale capability, auth switch, in-flight/lease/CAS, no money writes និង same-barcode ពីរឧបករណ៍ដោយ request/photo ផ្សេងគ្នា។
- Real Chromium `/usr/bin/chromium`៖ បិទ persistent browser ហើយបើក profile ដើម អាច decrypt រូប និង recovery metadata; context ឧបករណ៍ទីពីរដាច់គ្នា។ Typecheck, changed-file ESLint, production build និង diff-check ឆ្លងលើ source; មិនរត់ full local QA ឬ ២១៤ checkers។
- ដែនកំណត់៖ legacy ភស្តុតាងមិនគ្រប់ **មិនទាន់អាច resend**; supplementary photo មិនមានផ្លូវថ្មី។ Recovery នៅក្នុងពិដានសរុប ៤០ និងត្រូវរក្សា App data/PIN; រូបនៅលើឧបករណ៍ដើម មិនមាន cross-device photo recovery។ CI និង live device verification នៅត្រូវផ្ទៀង; មិនមាន live ZTO/DB writes ក្នុងការវាស់។

- CI លើ `ce88012ec6556ed4a36faf3dc0d419a39319123f`៖ ផ្នែក ១ ធ្លាក់ `clock-hygiene` (ចំណុចនាឡិកា local ថ្មីមិនទាន់មានហេតុផលក្នុង inventory); ផ្នែក ២ ធ្លាក់ `queued-sign-photo-ui.test.tsx` (mock គ្មាន `recoveryRows` ហើយ button index លែងចង្អុល export)។ ផ្នែក ៣/៤ ឆ្លង។ កែតែ checker/test៖ បន្ថែម exact property/expression sites មិនអនុញ្ញាត function ទាំងមូល និងកែ fixture/ជ្រើស export តាមស្លាក ដោយរក្សា assertions។ Reproduce RED ទាំងពីរ ➜ clock ២៣/២៣ និង UI active/recovery ២/២ GREEN; mutation បន្ថែម raw clock និង `createdAt: Date.now()` នៅក្នុង recovery function នៅតែត្រូវបដិសេធ។ Shipped source និង safeguards មិនប្រែ; មិនទាន់ push ការកែនេះ ហើយ CI ដើមនៅក្រហម។

### 2026-10-25 — A307 ៖ auto-trash ចេញពី active history មុន Sign outbox ផ្ទៀងរូបបញ្ចប់

| លេខ | ប្រភេទ | មូលហេតុ និងវិសាលភាព | អ្នកយាម |
|---|---|---|---|
| A307 | ចន្លោះ auto-close និង Sign queue | `processJob()` រក parent តែក្នុង `scanHistory` ហើយត្រឡប់មុន `receipt-status`; signed parent ដែល auto-trash រួចធ្វើឱ្យ queue រង់ចាំម្តងហើយម្តងទៀត | `palm-sign-outbox.test.tsx` · `pickup-cleanup-collected-race.test.ts` · `palm-sign-journal.test.ts` |

- មូលដ្ឋាន `328d05d308da6e6bbb592b7aee65b883a262dd25`។ របាយការណ៍បញ្ជាក់ពីរផ្លូវផ្សេងគ្នា៖ signed auto-trash និង unsigned legacy journal; មិនសន្មតថាជា fresh Sign failure ឬ client ចាស់ទេ។
- Reconciliation ប្រើ barcode lifecycle ដើម និង trash ID របស់ whole/partial cleanup; status និង original-photo binding ដដែល។ Server receipt/photo proof ត្រូវ code/request/hash; អាន trash មុននិងក្រោយ history/restore-finalization ដើម្បីរកការស្តារដែលបានមើលឃើញ និងទាមទារ local outbox CAS មុន cleanup។ Server/journal protocol, money និង auto-trash logic មិនកែ។
- **RED**៖ តេស្តថ្មីដូចគ្នា ៣ ករណី (whole/partial auto-trash និង legacy diagnosis) ធ្លាក់លើ source main មុនកែ ក្នុងថតដាច់ដោយឡែក។ **GREEN**៖ outbox ១៥៩ + cleanup-race ១៧ = **១៧៦/១៧៦**; ក្នុងនោះ new regression ២៣។ Real-server legacy guards **៣/៣** គ្រប claimed/photo/retry និង lease expiry ដោយគ្មាន image/receipt replay ឬ journal reset។
- ផ្លូវថ្មីឆ្លងពីចម្លើយ `ztoClosed: true` ➜ real close/final mark ➜ automatic cleanup ➜ ផ្ទៀង queue ក្នុង trash។ Negative cases គ្រប wrong hash/request, unsigned, missing photo proof, restore claim/target, trash បាត់, DB failure, auth switch និង CAS conflict; រូបដើមនៅរក្សាទុក។
- Typecheck, changed-file ESLint, production build និង diff-check ឆ្លង។ បណ្តាញ/DB ក្នុងតេស្តជាសិប្បនិម្មិត; មិនបានធ្វើ live Sign/upload/DB write។ Full local QA និង ២១៤ checkers មិនរត់ក្នុងជុំនេះ; CI និងឧបករណ៍ពិតនៅត្រូវផ្ទៀងលើកំណែចុងក្រោយ។ Legacy unsigned នៅ **មិនទាន់ដោះស្រាយឱ្យបន្ត Sign**; ការផ្ទៀង status មិនបង្កើតភស្តុតាងថាសំណើមុនមិនបានផ្ញើឡើយ។

### 2026-10-25 — A306 ៖ Lambda adapter បាត់ Blobs strong-read context · artifact API2 ពិត

| លេខ | ប្រភេទ | មូលហេតុ និងវិសាលភាព | អ្នកយាម |
|---|---|---|---|
| A306 | ZTO Sign journal នៅច្រក runtime/SDK | `connectLambda(event)` របស់ SDK ពិតមិនរក្សា `uncachedEdgeURL`; journal strong read តាម legacy context បរាជ័យមុន fetch | `zto-modern-entry.test.ts` · `zto-function-artifact.test.ts` · `zto-lock.test.ts` · `repository-contract-test` |

- មូលដ្ឋានផ្ទៀង local៖ commit `7d87465f28d12f095f5442c16885895aae339d45`, tree `56fdd93181f52997de9efffdf32fbaf04e902485`, ZoeW `2.50.153`/`zoew-v417`។
- A305 កែ journal ទៅ `consistency: 'strong'` សម្រាប់ថ្នាក់ stale-cache/CAS auto-confirm loop ដែល reproduce បាន។ ការវាស់បន្តប្រើ physical `@netlify/blobs 11.1.3`៖ `openCookieStore()` ហៅ `connectLambda(event)` រាល់ដង; adapter នេះបាត់ uncached endpoint ទោះ context ដើមមានវាក៏ដោយ។ Legacy/env-only path ➜ strong read throw/503 មុន fetch; modern global context ពេញអាចអានបាន។ នេះជាថ្នាក់កំហុសដែលបានវាស់ មិនមែនភស្តុតាងផ្ទាល់ពី failing request របស់អតិថិជន។
- កែតែច្រក Function៖ sole default-export `zto-order-detail.mjs` ប្រើ official `@netlify/aws-lambda-compat 2.0.3` `withLambda` និង static import Blobs; implementation ដើមផ្លាស់ទៅ `_shared/zto-order-detail-core.cjs` ជាមួយ relative imports ត្រូវគ្នា។ Private WeakMap ចង event ទៅ SDK ថេរតែពេល modern handler ដំណើរការ និងសម្អាតក្នុង `finally`; event នោះប្រើ zero-config `getStore()` ដោយមិនហៅ legacy connector។ មិនយក SDK/context ពី request មិនចម្លង global context និងមិនយក token ទៅធ្វើ PAT។ Legacy tests នៅច្រកច្បាស់ និង fail closed។
- Official adapter បម្លែង response តែបន្ទាប់ពី modern wrapper ប្តូរ body របស់ `204/205/304` ទៅ `null`; business handler/CAS/strong reads ដើមរក្សាដដែល។ Entry មិនមាន named `handler` ឬឯកសារ `.js` ឈ្មោះដូចគ្នា។ Static SDK import ចាំបាច់៖ source-only test មិនអាចចាប់ NFT artifact ដែលបាត់ SDK ពេលពឹង dynamic CJS require បាន។
- Official `@netlify/zip-it-and-ship-it 16.5.1` discovery/manifest ជ្រើស runtime API2 និង route `/.netlify/functions/zto-order-detail` ដដែល។ Emitted artifact ដាច់ដោយឡែកមាន injected runtime `2.24.0` byte-identical, physical SDK `11.1.3` និង adapter `2.0.3`; resolver បដិសេធ module ក្រៅ artifact និងគ្មាន symlink/source fallback។ Network transports ត្រូវបិទ; ក្លែងតែ network responses និង AWS response stream plumbing មិនក្លែង journal។
- Actual runtime→adapter→SDK→journal៖ reserve→warning→confirm→replay ➜ រូប **១**, scan `05` **១**, strong uncached journal reads **៣**, authoritative conditional CAS **៨**, cached journal reads/actual network attempts/outside modules **០**។ Missing context ឬ uncached endpoint ➜ **503 មុន fetch**; ករណីសាក conflict នៅ CAS មុនផ្ញើដំបូង ➜ **503** ដោយគ្មានរូប/`05`។ CAS ក្រោយការផ្ញើរូបអាចបរាជ័យដែរ; លទ្ធផលនោះនៅតែត្រូវផ្ទៀង ហើយមិនមានការធានាថាមិនទាន់ផ្ញើរូបទេ។ Auth/CORS204, UTF-8 body limits និង binary behavior, private-marker spoof/mutation/cleanup ត្រូវវាស់ផង។
- Source checkpoint `c24b47d6`៖ physical official-registry `npm ci`, typecheck, lint និង build ឆ្លង; ZTO/journal/native suite **៦០ ឯកសារ/១៣៦១ tests**, modern entry **២២/២២**, artifact **៧/៧**, independent boundary **៧/៧** ឆ្លង (ក្រុមមាន overlap មិនបូក unique)។ Relevant aggregate **២២/២៣**, skip **០**; ក្រហមតែ version guard ព្រោះ checkpoint នោះមិនទាន់ឡើង metadata។ Dependency ចាស់រក្សាបាន លើកលែង `postcss`/`nanoid` ដែលត្រូវឡើងតាម dependency ផ្លូវការថ្មី; physical lock install ឆ្លង មិនមាន proxy/security override ថ្មី។
- ក្រោយ metadata `2.50.154`/`zoew-v418`៖ physical `npm ci`/`npm ls --all`, typecheck/lint/build, `doc:check`/`android:check`, smoke/Service Worker/NOTICE ឆ្លង។ Vitest ចុងក្រោយ **៦២ ឯកសារ/១៣៩៣ tests** ឆ្លង រួម artifact **៩/៩**, modern entry **២២/២២**, lock **១៦/១៦** និង notifications **៣០/៣០** (ក្រុមមាន overlap មិនបូក unique)។ Artifact controls បន្ថែម៖ reserve ស្ទួនរក្សា owner ដដែលដោយ strong GET **២**, conditional-new PUT **១** និង journal row **១**; ដក private marker តែក្នុង generated artifact ចម្លង ➜ **503**, journal HTTP/រូប/`05` **០**។ Source core/entry មិនប្រែ។ CORS controls ថ្មីរត់ selector/consumer ពិតលើផ្លូវដែលត្រូវរាប់/មិនត្រូវរាប់ និង JSON exclusions៖ baseline **៤ PASS/២ FAIL** ➜ current **៦/៦ PASS**; repository contract **១៣០/១៣០ PASS**។ Independent reviewer បិទការរកឃើញពីក្បាលលិបិក្រម និង prewrite-CAS wording ហើយពិនិត្យ late tests ដោយគ្មាន finding នៅសល់។ Smoke/Service Worker/banner មាន external-request guard; ភស្តុតាងនេះមិនគ្រប audit prerender ដំបូងទេ។ Checkpoint relevant aggregate លើ `2.50.154` ឆ្លង **២៣/២៣ checkers**, fail/partial/skip **០**, រួម version **១៨/១៨**, version scope **១៨/១៨** និង document scope **១១០/១១០**; វិសាលភាព **២៣/២១៤** មិនមែន full aggregate ឬ remote CI ហើយមិនជំនួសការផ្ទៀង live runtime/ឧបករណ៍ពិត។
- Guards ផ្លាស់ paths ទៅ core/entry និងគ្រប `.cjs/.mjs`៖ comments, CORS, function inventory, repository coverage និង locked-zone hashes។ Scanner regression ក្រហមលើ code មុនកែ និងបៃតងក្រោយកែ; generated audit renderer លើកលែងតែមាន provenance ខណៈ shipped CJS ឈ្មោះដូចគ្នានៅតែស្កេន។ UI test លំដាប់ completion មួយបរាជ័យមិនថេរលើ baseline ដើមផង; មិនបន្ធូរ assertion ហើយ final source suite ខាងលើឆ្លង។ Local keep-alive tests **១៦/១៦** ឆ្លងដោយមិនប្តូរ proxy។
- ព្រំដែន៖ actual production context មិនបានអាន; live ZTO/DB request និង queue mutation មិនត្រូវបានអនុញ្ញាត ហើយគ្មាន publication/deployment ឬ real-device test។ Audit prerender ដំបូងគ្មាន external-network guard ហើយអាចបង្ក License clock read ទៅ Firebase; គ្មាន network log បញ្ជាក់ថាសំណើចេញពី browser ឬដល់ endpoint ឬអត់ ដូច្នេះការបញ្ជូនមិនច្បាស់។ ការរត់គ្មាន guard ត្រូវបានបញ្ឈប់; harness បានបន្ថែម context-route និង fetch guard សម្រាប់ non-loopback ហើយ guarded rerun ឆ្លង **២៣/២៣ checkers**, fail/partial/skip **០**។ Guard log កត់ external resource requests **៥** (script/stylesheet) ដែលត្រូវបិទ; init fetch guard បដិសេធ non-loopback មុន actual fetch ហើយលទ្ធផលនេះមិនអាចបញ្ជាក់ការបញ្ជូន clock read ដំបូងបានទេ។ Artifact tests ដែលបិទ physical transports មានភស្តុតាង actual network attempts **០** ដាច់ដោយឡែក។ Full aggregate/remote CI និងការបញ្ជាក់ពីអ្នកប្រើនៅ pending; មិនអះអាងថាកញ្ចប់ពិតមានមូលហេតុនេះ ឬថាបញ្ហាបាត់។ កំណែ `2.50.154`/`zoew-v418` រៀបចំតាមការអនុញ្ញាត local; KeyGen `2.24.26`/`zoekeygen-v137` មិនប្រែ។

### 2026-10-25 — A305 ៖ ZTO selected-ready · request-bound photo proof · rejection មិនអាច replay

> **ការកែតម្រូវសំខាន់ពីអ្នកប្រើ**៖ បុគ្គលិកបាន Sign ដោយដៃក្នុង official Palm ដោយគ្មានរូបភាព បន្ទាប់ពី ZoeW នៅ unsigned។ ដូច្នេះ **គ្មានភស្តុតាងថា ZoeW បានបាត់រូបពិត**។ ការជាប់ដំបូងរបស់ fresh branch-problem/auto-confirm នៅមិនទាន់បញ្ជាក់មូលហេតុ និងកំពុងស៊ើបអង្កេត read-only; កុំច្រឡំជាមួយ synthetic secondary safeguards ខាងក្រោម។

| លេខ | ប្រភេទ | មូលហេតុ និងវិសាលភាព | អ្នកយាម |
|---|---|---|---|
| A305 | ការកែ ZTO តាមការអនុញ្ញាតម្ចាស់គម្រោង | global pending រារាំង selected-ready; generic signed state មិនបញ្ជាក់រូបភាពរបស់សំណើ; per-row rejection ត្រូវរក្សាជា verification/non-replayable | `zto-palm-sign.test.tsx` · `zto-palm-sign-server.test.ts` · `palm-sign-journal.test.ts` · `palm-sign-outbox.test.tsx` · `zto-palm-sign-e2e.test.tsx` |

- មូលដ្ឋាន៖ merged `815e2cf` (local baseline `ba0e7aaa` មាន tree ដូចគ្នា)។ ម្ចាស់គម្រោងស្នើដក emoji រូបភ្នែកពីផ្ទាំងទាញបញ្ជីផង; ការកែតំបន់ចាក់សោត្រូវផ្គូផ្គង hash ក្នុង `zto-lock.test.ts` តាម source ពិត មិនបន្ថយ guard។
- Selected readiness វាស់តែជួរដែលជ្រើស មិនរំលង pending របស់ជួរដែលជ្រើសទេ។ Foreground completion ផ្ទៀង journal របស់ request និង photo; row rejection ផ្គូផ្គង identity រក្សាទុកខុសពី safe unsigned/retry ហើយត្រូវ verification។
- ក្រុម Sign ដំបូង មុនការរួម protocol ចុងក្រោយ ក្រោយ `70ac7468` និង partial-customer tests៖ 9 ឯកសារ/282 tests ឆ្លង; typecheck/lint/build ឆ្លងលើ source ចុងក្រោយ និង comment check 280 ស្អាត។ មិនទាន់អះអាង full CI លើ commit ថ្មី PASS។ គ្មាន live ZTO timing, Sign លើសេវាពិត ឬ physical-device verification។
- Guard រក្សា original row identity មុន headers ហើយ safe-hold ពេល identity ប្រែ ដើម្បីកុំឱ្យ cached ACK ពីការចុចម្ដងទៀតបិទ lifecycle ដែលបានស្តារថ្មី។ Regression 5 ក្រហមមុនកែ; មិនយក ACK ចាស់ជាភស្តុតាងរបស់កញ្ចប់ថ្មី។ ម្ចាស់គម្រោងស្នើផ្ទៀង customer phone តែមួយមានកញ្ចប់ច្រើន ហើយ Sign តែមួយផ្នែក; `zto-partial-customer-real-close.test.ts` មាន 5 ករណី និង negative controls ឆ្លងក្នុងក្រុមចុងក្រោយ ក្រោយជួស import path (ការរត់ដំបូងមិនទាន់ collect tests)។
- Stability លើ source integrated៖ synthetic fsync/SIGKILL boundaries 6/6 ឆ្លង ដោយ scan05 មិនលើស 1; different-ID collisions 20/20 មាន photo 1/scan 1/success 1។ Encrypted client restart ប្រើ status-only ដោយ receipt replay 0; forced-replay scratch mutation ធ្លាក់ oracle ដូចរំពឹង។ Focused tests 232 មាន overlap ជាមួយក្រុម 266 មុន មិនបូកជាសរុបថ្មីទេ។ Storage/network ជា mocks មិនមែន real IndexedDB/ឧបករណ៍ពិត/live ZTO។
- Same-phone fixture៖ កញ្ចប់ 5 មាន COD 15/DOD 1.5; Sign លេខ 1 និង 4 រំពឹង collected COD 5/DOD 0.5, packages 2/customer 1 និង row បើក; Sign គ្រប់ 5 រំពឹង packages 5/customer 1 និង row បិទ។ ផ្ទៀង repeated/cross-day/other-phone/prior-row/photo association ដោយប្រើ actual Sign/close/pickup/collected modules ជាមួយ simulated transport/DB ដែលអនុវត្ត real `.validate` ប៉ុណ្ណោះ មិនមែន emulator/`.write`/RLS។
- Queue UX (`70ac7468`) បែងចែកហេតុផល safe queue 4 ក្រោយ `RETRY_READY`៖ closed តែរូបភាពសំណើនេះមិនទាន់ផ្ទៀង/not dispatched/missing proof/invalid status។ Desired regressions 4 ក្រហមមុនកែ ➜ focused 62 PASS; មិនប្តូរ retry workflow។
- Screenshot queue៖ ការអានកូដបញ្ជាក់ផ្លូវ rejection ចាស់អាចចូល `sending` និង poll មិនចប់; មិនមែនភស្តុតាង root cause នៃកញ្ចប់ពិតក្នុងរូបទេ។ កំណែនេះបែងចែក rejection ថ្មី ប៉ុន្តែ **មិនដោះ historical ambiguous `sending` ដោយស្វ័យប្រវត្តិ**; ត្រូវ verification ដោយឡែក។ មិនអះអាងថាស្គាល់ incident root cause ឬបាន recovery។
- រួម source `ce5ce474`៖ rescue `queued-sign-photo.ts`/`queued-photo-output.ts` local-only អាន encrypted job និង read-only modal refresh; មិន pause worker។ `queued-sign-photo.test.ts` · `queued-sign-photo-ui.test.tsx` · `queued-photo-output.test.ts` ផ្ទៀង owner/session/lock និង native exact-byte cache checks។ Copy ចាស់មិន overwrite/លុប; ថ្មីមិនទាន់ handoff ទើប cleanup; ក្រោយ handoff ទុកឱ្យ receiver អាន ហើយ OS សម្អាតពេលក្រោយ។ Android chosen-file/hash verification លើឧបករណ៍ពិតនៅមិនទាន់ធ្វើ។
- Read-only `zto-palm-photo-status.test.ts` ផ្ទៀង `querySignPic` ជា `listed`/`none_observed`/`unknown`; listing មិនបញ្ជាក់ exact bytes/request-specific photo ហើយ manual probes អានតែប៉ុណ្ណោះ។ ACK fields ផ្គូផ្គង schema របស់ APK ផ្លូវការដែលបានពិនិត្យ; ផលប៉ះពាល់ order difference មិនទាន់មានភស្តុតាង។ គ្មានទិន្នន័យអតិថិជន ឬផ្លូវ archive ឯកជនក្នុងកំណត់ត្រានេះ។
- Prewrite explicit-false loop៖ baseline 3 regression ក្រហម ➜ ក្រុម 173 បៃតង; combined rescue/read-helper 5 ឯកសារ/110 PASS។ Broader default run មាន 1335 PASS ប៉ុន្តែ baseline EnvProxy failure និង browser blocked ដូច្នេះមិនមែន full-suite PASS។ ក្រុមទាំងនេះអាច overlap មិនបូកជាចំនួន unique។ LOCK នៅ checkpoint នោះមិន refresh ដើម្បីរំលង guards ទេ; លទ្ធផលចុងក្រោយនៅខាងក្រោម។
- Final integration `202a65d1` រួម production `0a61dca6` និង tests-only `aec7da0b`៖ durable-only មុន write, mandatory reservation, safe pre-scan resume និង warning/prewrite continuation តាម one-shot intent។ Unknown image/05 មិន blind replay; photo verification មាន bounded backoff។ Explicit cancel/discard មាន server tombstone; probes អានតែប៉ុណ្ណោះ។ External ZTO payload/order/force flags មិនប្រែ។
- Auto-clear តម្រូវ signed + exact-original SHA readback + guarded local close/commit និង revision CAS។ ACK/listing មិនគ្រប់។ Unknown/recompressed/unsupported images និង legacy/reused-barcode jobs នៅ manual hold។ Durable storage បរាជ័យ ➜ រក្សាទម្រង់/រូប មិនផ្ញើ foreground fallback។ Policy ដែលម្ចាស់គម្រោងអនុម័តអនុវត្តក្នុង tree នេះរួច; real-device verification នៅត្រូវធ្វើ។
- Final protocol tests 14 ឯកសារ/599 PASS; independent review 225/225 PASS; types/lint/build/syntax/comment checks ឆ្លង។ `zto-partial-customer-real-close.test.ts` ចុងក្រោយ 5/5 រត់ real app → durable queue → real handler/reservation/exact SHA → real close/money ជាមួយ simulated network/DB `.validate`; មិនបន្ថយ assertions។ Payload 900000 ទទួលបាន និង 900001 បដិសេធ។ ក្រុមទាំងនេះមាន overlap មិនបូកជាចំនួន unique។
- `palm-sign-reservation.test.ts` · `palm-sign-outbox-store-unit.test.ts` · `zto-receipt-photo-readback.test.ts` និង fixture `palm-sign-journal-before-reservation.cjs` គ្រប protocol/readback/durable boundaries។ LOCK បច្ចុប្បន្នភាពក្រោយ remote `88cc` behavioral guards ឆ្លង; នេះមិនមែន final combined CI PASS។ Browser និង CI លើ commit ចុងក្រោយនៅ pending។
- ប្រវត្តិ auto-confirm `39a0a9fd` ផ្លាស់ preflight ទៅក្រោយ enqueue ហើយបង្ហាញ logical-refusal loop; នេះមិនបញ្ជាក់ root cause នៃកញ្ចប់ពិតទេ។ គ្មាន customer IDs/URLs/signatures/pixels ក្នុងកំណត់ត្រា។ Transport read ដែលបានអនុញ្ញាតមិនមែនភស្តុតាង original identity ឬ live Sign។
- ម្ចាស់គម្រោងស្នើ merge រួមក្រោយកែ/ផ្ទៀងទាំងអស់៖ release `2.50.153`/A305 តែមួយ គ្មាន release ដាច់សម្រាប់ rescue។ ត្រូវ deploy matching client/server និង update ឧបករណ៍សាខាទាំងអស់ដោយមិន uninstall/Clear Data/ប្តូរ PIN ដើម្បីរក្សារូប។ គ្មាន DB rule/migration/new credentials; មិនទាន់អះអាង real-device ឬ final CI PASS។
- ផ្ទៀង actual handler បន្ថែម៖ synthetic request មាន `photoProtocol`+SHA តែខ្វះ reservation អាចឆ្លង legacy retry ក្រោយ upload ACK បាត់ ហើយផ្ញើរូបស្ទួន។ UI ថ្មីផ្ញើ reservation ជានិច្ច; old clients ខ្វះ protocols ទាំងពីរត្រូវបដិសេធ។ នេះមិនមែន normal-UI bypass ឬភស្តុតាង incident ពិតទេ។ Source `1595c412` (parent `a52e5d33`) ទាមទារ actual receipt reservation លើកលែង validated `receipt-check`; legacy journal អាន status-only និងដក old write fallback។ Independent review 253/253 PASS; parent aggregate លើ `adae5325` 16 ឯកសារ/639 PASS និង typecheck/lint/build ឆ្លង; independent 253 មាន overlap មិនបូកជាចំនួន unique។ Clock checker repair និង final CI នៅ pending។
- Tests-only fixtures ជួស shared `Response` និងរង់ចាំ encrypted writer persistence; partial-customer reversed-arrival 6/6 ឆ្លង រួម swap/duplicate/missing/extra negative controls។ Counts មុនជាភស្តុតាងតាម checkpoint មាន overlap មិនមែន unique total។ ការបញ្ជាក់អ្នកប្រើថ្មី៖ clean parcel ថ្មីដំណើរការ; ការរង់ចាំមុនស្ថិតលើ parcel ដដែលដែលមាន queue លើឧបករណ៍មួយទៀត។ ការសាកថ្មីបន្ទាប់៖ fresh problem-warning parcel ក៏រង់ចាំជាប់ក្នុង queue; clean fresh parcels ដំណើរការ។ នេះជាភស្តុតាងថ្មី មិនទាន់មាន response ឬ root cause បញ្ជាក់; មិនកត់លេខកញ្ចប់ក្នុងឯកសារ។
- CI `clock-hygiene`៖ raw calls 8 ជា local binding/photo-poll/cancel-recheck/warning-refresh deadlines មិនមែន retention/revenue។ Mapping ថ្មីចាក់សោ AST expression និង sink ក្នុង function ជាក់លាក់ មិនបើក function ទាំងមូល; server-field និង retention guards នៅដដែល។ Real generated text baseline FAIL 1/21 PASS ➜ 23/23 PASS; បន្ថែម raw clock ក្រៅចំណុចដែលអនុញ្ញាតក្នុង function ដដែល និងដក mapped site ទាំងពីរធ្លាក់តាម guard។ មិនកែ App source; final CI នៅត្រូវរត់។

- CI money fixtures៖ `lookup-modes-money.test.ts` ចាស់ប្រើ photo string មិនមែន Base64; baseline 4 FAIL/26 PASS ➜ fixture migration 30/30 PASS។ រក្សា money/stale-write/original-retention assertions និងផ្ទៀង reservation/request-bound proof; production មិនប្រែ។ Parent combined 17 ឯកសារ/669 PASS; final CI លើ head ថ្មីនៅ pending។
- Secondary external-Sign guard `aa53e14f` (production ដូច `05f9c8df`) អាន authenticated tracking មុន READY និងមុន receipt (ធម្មតាអានបន្ថែម 2)។ Known signed រារាំងការសរសេរ និងរក្សាអត្ថបទអព្យាក្រឹត មិនសន្និដ្ឋានថា ZoeW ជាអ្នក Sign; unknown tracking fail closed។ មិនធានា atomicity ប្រសិនបើឧបករណ៍ខាងក្រៅ Sign ក្រោយការអានទេ។ Capture-time `04` នៅលឿនដដែល; already-`04` រំលង dispatch។
- Signed តែរូបមិនទាន់ផ្ទៀង៖ 5 លទ្ធផលឬ grace 5 នាទី ➜ durable manual/action ដោយរក្សារូបដើម និងអាច export/read-only recheck។ មិន reset budget; exact proof មកក្រោយអាច guarded cleanup។ Child 15 ឯកសារ/686 PASS និង independent 354 PASS; parent ចុងក្រោយ 17 ឯកសារ/709 PASS (ក្រុម overlap មិនបូក unique)។ Parent type/lint/build ឆ្លង; CI `da7eccbc` ទាំង 4 ឆ្លងមុន secondary fix នេះ មិនមែន CI របស់ source ថ្មី។
- `clock-hygiene` បន្ថែមតែ exact AST sites 2 ក្នុង `waitForPhoto` សម្រាប់ local grace hold និងកំណត់ delay មិនលើស grace; មិនបើក function ទាំងមូល។ Fresh nonbrowser text view baseline 1 FAIL/22 PASS ➜ 23/23 PASS; មិនអះអាង browser build ឆ្លង។ Server timestamp/retention guards រក្សាដដែល; unauthorized-clock ក្នុង function ដដែល និងដក exact mapped site បង្កើត 1 FAIL/22 PASS ទាំងពីរ។
- Primary regression candidate `c858c217`៖ [Netlify Blobs consistency](https://docs.netlify.com/build/data-and-storage/netlify-blobs/#consistency) និង installed SDK `11.1.3` បញ្ជាក់ default eventual និង overwrite lag អាចដល់ 60s។ Actual historical UI/outbox/handler ជាមួយ versioned-cache model និង authoritative CAS បង្កើត old manual success/production clean success ប៉ុន្តែ production warning ជាប់ដោយគ្មាន photo/05។ ការសាក poll នៅ 61/122s ក្រោយ cache expiry នៅបង្កើត stale-ETag cycle; reservation បច្ចុប្បន្នរងផលប៉ះពាល់ដូចគ្នា។ Model គោរព documented bound មិនអះអាងថាស្មើ Netlify internal cache គ្រប់លម្អិតទេ។
- កែ production តែមួយបន្ទាត់៖ journal `getWithMetadata` ប្រើ `consistency: 'strong'`។ Shared cookie/session stores មិនប្រែ; CAS/leases/2500ms នៅដដែល និងគ្មាន eventual fallback។ Strong unavailable ➜ 503/zero writes។ Independent 86/86 PASS; parent 17-file suite 711/711 PASS និង typecheck/lint/build របស់ fix នេះឆ្លង។ CI1005 លើ head `0b2` ទាំង 4 ឆ្លងមុន fix នេះ; new CI នៅ pending។
- នេះជាថ្នាក់មូលហេតុដែល reproduce បាន និងផ្គូផ្គងរោគសញ្ញា **មិនទាន់បញ្ជាក់ថាជាមូលហេតុនៃកញ្ចប់ពិត**; live controlled attempt នៅ pending។ Tracking/scan-history responses មិនមែន failing confirmation response ហើយមិនជំនួសភស្តុតាងនោះទេ។

### 2026-10-25 — A304 ៖ បំពេញ fixtures នៅសល់ · រាយការណ៍ failure គ្រប់ · ផ្គូផ្គង SQL versions ដែលអនុវត្តរួច

| លេខ | ប្រភេទ | លទ្ធផល | អ្នកយាម |
|---|---|---|---|
| A304 | Tests/CI diagnostics និងឈ្មោះ migration | គ្មាន App source/client version/announcement change; SQL bytes មិនប្រែ និងគ្មាន data reset | `zoew-suite-test` · `remove-stale-session.test.ts` · `restore-terminal-cancel.test.ts` · `session-switch-fuzz.test.ts` · `zto-final-marks.test.tsx` · `zto-returned-cleanup.test.ts` |

- Fixtures នៅសល់ 5 ឯកសារ៖ ផ្គូផ្គង authoritative REST/server receipts និងរង់ចាំ async work ត្រឹមត្រូវ; targeted 193 tests (ក្រុម worker 113 + 80)។ Root direct related 38 ឯកសារ/875 PASS ដោយគ្មាន unhandled error។ ទាំងនេះមិនមែន full CI verdict។
- `zoew-suite-test` logger បង្ហាញ index របស់ failed files ទាំងអស់៖ fixture 65 បង្ហាញថាចាស់បាត់ failure ចុងក្រោយ ខណៈថ្មីបង្ហាញគ្រប់។ មិនប្តូរ verdict, arguments ឬ timeouts។
- Supabase migrations អនុវត្តតាមការអនុញ្ញាតរួច និងផ្ទៀង exact function bodies/ACL។ ឈ្មោះឯកសារដែលមិនទាន់ merge ផ្គូផ្គង recorded versions៖ `20261025025905_zoe_quota_cleanup.sql` (SHA-256 `5908260b87adff1252b506f7b89db526ff06e117cb1473d0d6a46a6f523ef7e5`) និង `20261025025945_zoe_rules.sql` (SHA-256 `31831276b28337c9e043ea6344715f9863e52fb0326ef0512566fc4df03a2a87`)។ SQL bytes ដូចដើម; មិនប្តូរឈ្មោះ migration ចាស់លើ main និងគ្មាន data reset។
- **បិទការរង់ចាំរបស់ជុំនេះ**៖ ម្ចាស់គម្រោងបញ្ជាក់ Firebase Business rules សម្រាប់គម្រោងគោលដៅរួច; PR352 head CI ទាំង 4 ឆ្លង និង merge រួច។ គម្រោងអតិថិជនផ្សេង/clients ទាំងអស់ត្រូវផ្ទៀង rollout ដោយឡែក។

### 2026-10-25 — A303 ៖ កែ fixtures និង guards ឱ្យផ្គូផ្គង authoritative reads និង receipt proof

| លេខ | ប្រភេទ | លទ្ធផល | អ្នកយាម |
|---|---|---|---|
| A303 | កែ tests/CI contract ប៉ុណ្ណោះ | មិនកែ runtime App source មិនឡើង client version និងមិនកែ announcement; ការរង់ចាំដោយចេតនាលើ rules ចាស់/ខ្វះ proof នៅដដែល | `cleanup-interrupt-atomicity-test` · `emu/restore-mutation-emu-test` · `ui-flow-test` · `collected-mirror-lifecycle-test` |

- Vitest fixtures 8 ឯកសារប្រើ authoritative REST តាម `ZoeW/tests/helpers/cleanup-server-read.ts`៖ `cleanup-applied-ownership.test.ts` · `cleanup-deduct-order.test.ts` · `cleanup-foreign-slot.test.ts` · `cleanup-journal-cap.test.ts` · `cleanup-resume-session.test.ts` · `cleanup-sweep-batch.test.ts` · `late-commit-stale-session.test.ts` · `lookup-modes-money.test.ts`។ មុនកែ 74 PASS/45 FAIL ➜ 119 PASS ដោយគ្មាន unhandled error; មិនបម្លែង deliberate old-rules/missing-proof holds ទៅ success ទេ។
- Restore emulator៖ មុនកែ 133 PASS/73 FAIL ➜ 256 PASS; poison រំលង proof gate បង្កើត 244 PASS/12 FAIL។ Browser `ui-flow-test` និង `collected-mirror-lifecycle-test` seed receipts ទាំងពីរ; បានផ្ទៀងតែ VM ក្នុង session មិនមែន browser PASS មុន CI។
- Cleanup interruption៖ ធម្មតា 104 PASS; KC15 mutant 4 FAIL និង live-owner mutant 3 FAIL។ មិនបន្ថយ mutation expectations ឬកែ App source ដើម្បីឱ្យ fixture បៃតងទេ។ ក្រុមនេះមានឯកសារចាស់ 12 និង helper ថ្មី 1 មុនការកែ metadata។
- CI ជុំមុនបញ្ចប់ 1 shard PASS/3 FAIL; លទ្ធផលខាងលើជាការផ្ទៀង targeted មិនជំនួស CI លើ commit ក្រុមកែនេះទេ។ គ្មានការប្តូរ live services។

### 2026-10-25 — A302 ៖ cleanup ក្រោយ restart ត្រូវរក្សា server witnesses និង journal ដែលមិនទាន់ផ្ទៀងច្បាស់

| លេខ | ប្រភេទ | មូលហេតុឫសគល់ | អ្នកយាម |
|---|---|---|---|
| A302 | កំហុស recovery ដែលវាស់លើ modules ពិត | Server មាន `op` តែ daily view របស់ A នៅចាស់; kill ក្រោយ monthly debit មុន daily ➜ resume ចាស់លុប journal ហើយ daily/monthly ខុសគ្នា | `three-device-recovery.test.ts` · `cleanup-ledger-key.test.ts` |

- មុន debit ដំបូង៖ អាន authoritative witnesses ពី server និងផ្ទៀង durable journal។ Recovery មិន refresh prior witnesses; ករណីមិនទាន់មាន proof គ្រប់ត្រូវរក្សា journal ឆ្លង restart, counter រក្សាទុកមានពិដាន 10 និងទប់សារព្រមានស្ទួន។ ចំនួន retry សរុបមិនមានពិដានទេ; resume ក្រោយពី timer 60s/visibility/debounced sync/owner handoff អាចសាកទៀត។ មិនរកឃើញ self hot loop ហើយនេះមិនមែន backoff។
- ABC hardened integrated 91/91 PASS៖ 84 matrix kill/restart · seeds `1,6,23,42,71,101` · 12 ករណី server commit ដែលបានផ្ញើមុន kill តែមកដល់ក្រោយ kill · negative controls 2 ចាប់ duplicate credit/lost journal · regressions 3 ដែលក្រហមមុន source fix ហើយបៃតងក្រោយកែ។ ចំនួនទាំងនេះជាប្រភេទគ្របក្នុង matrix មិនត្រូវបូកទាំងអស់ជាចំនួន tests ថ្មីទេ។
- Harness ប្រើ real modules ក្នុង VMs ឯករាជ្យ 3 ជាមួយ disk journals និង shared server simulator; delay 2–5ms និង late commit 40ms។ Snapshot sync ដោយដៃ មិនមែន realtime listeners ឬ real SDK CAS។ **មិនមែនទូរស័ព្ទពិត 3 ឬ full network emulator**។ Killed-context storage/fetch/microtask dead gates និង finalization-fence self-tests បន្ថែម; lost-journal negative control ផ្ទៀង money oracle មិនមែនតែអវត្តមាន journal។ ករណី legacy tokenless និង missing daily proof រក្សា **HELD ជាមួយ durable journal** មិនអះអាងថា converged។ Fresh-prior regression ដាច់ដោយឡែកមុនកែ 2/2 ក្រហម ➜ ក្រោយកែ 2/2 បៃតង; `cleanup-ledger-key.test.ts` ចុងក្រោយ 29/29 រួម safety checks 4 លើ read/storage/session/retry counter។ Unknown intents ដែលរក្សាទុករាប់ក្នុងពិដាន journal 200 ជា safety hold ដោយចេតនា។ Affected gate ចុងក្រោយ 5 ឯកសារ/163 PASS ក្នុង 6.92s (cleanup 29 + ABC 91 + ledger replay/not-applied/unknown 43); typecheck/lint/build/doc-check ឆ្លង។ Full CI លើ combined commit នៅត្រូវផ្ទៀង។
- Extractor repairs 7៖ diagnostics 273 assertions PASS លើ isolated nonbrowser text compiler (`late-commit-test` 67 · `restore-marker-hygiene-test` 29 · `db-stall-guard-test` 31 · `partial-pickup-cleanup-test` 52 · `stall-lock-release-test` 31 · `ledger-failed-apply-revert-test` 50 · `ledger-count-integrity-test` 13)។ Old null-reader poison ធ្លាក់ដូចរំពឹង; មិនមែន full CI/browser guard verdict។
- សកម្មភាពលើឧបករណ៍ពិត៖ ក្រោយ prerequisites ក្នុង release `2.50.152` សាកបិទ App កណ្តាលសម្អាត បើកឡើងវិញ និងផ្ទៀង daily/monthly ជាមួយ journal; ករណីខ្វះ proof ត្រូវនៅរង់ចាំដោយមិនដកឬបូកតាមការសន្មត។ គ្មានការប្តូរ live services ក្នុង session។

### 2026-10-25 — A301 ៖ ស្តារប្រាក់លើសក្រោយ clamp និងភស្តុតាងដាច់តាមថ្ងៃ/ខែ

| លេខ | ប្រភេទ | មូលហេតុឫសគល់ | អ្នកយាម |
|---|---|---|---|
| A301 | កំហុសប្រាក់ដែលវាស់លើកូដពិត | manual adjustment ធ្វើឱ្យចំនួននៅសល់តិចជាងតម្លៃកញ្ចប់; ដក `2 → 0` តែស្តារតម្លៃពេញធ្វើឱ្យក្លាយជា `7`។ Receipt ចាស់មិនគ្រប actual delta ដាច់តាម bucket | `cleanup-ledger-key.test.ts` · `trash-retry-session.test.ts` · `emu/supabase-rules-parity-test` · `supabase-rls-test` |

- Cleanup រក្សា actual COD/DOD/count ដែល clamp បាន ក្នុង daily និង monthly receipts ដោយឯករាជ្យ។ Restore អាន proof ទាំងពីរ ផ្ទៀង lifecycle stamp ហើយស្តារតែ actual របស់ bucket នីមួយៗ; replay ដែល `back` រួចមិនបូកស្ទួន។ Receipt-required keyed events មិន downgrade ទៅ keyless ពេល `permission_denied`។
- Modern array-backed trash ដែលត្រូវការភស្តុតាង តែ proof បាត់/legacy/pruned ត្រូវ hold; មិនសន្មតថាតម្លៃកញ្ចប់ជាចំនួនដែលបានដកទេ។ ផ្លូវ fallback ទិន្នន័យប្រវត្តិគ្មាន array នៅជាករណីជាក់លាក់ **គ្មានការធានា inverse ប្រវត្តិ**; មិនអះអាងថាទិន្នន័យចាស់គ្រប់ករណីសង្គ្រោះបានទេ។
- ភស្តុតាង៖ baseline 6 FAIL ➜ ក្រោយកែបៃតង។ Stress matrix 108 fixtures · 432 pairs · 864 claims · 864 checkpoints · 5184 field assertions។ ក្រុម 10 ឯកសារ 139 tests និង supplement 24 មាន overlap 19 ➜ 144 unique; typecheck/lint ឆ្លង។ មិនបានរត់ browser។
- ក្រុម integrated ចុងក្រោយ៖ 10 ឯកសារ/144 tests ឆ្លងក្នុង 187.94s រួម money guards ថ្មី។ `revenue-rules-clamp-test` ផ្ទៀង schema របស់ receipt objects ជ្រៅតាមកូន៖ isolated 53 PASS; accept-all poison បង្កើត 42 FAIL។ `cleanup-interrupt-atomicity-test` ផ្ទៀង rules ចាស់ឱ្យ fail closed៖ មិនដកប្រាក់ មិនដាក់ deducted flag និងមាន trash តែមួយ; សេណារីយ៉ូ ownership លើ rules គាំទ្ររក្សាដដែល។ Full CI guards មិនទាន់រត់; ភស្តុតាង clients A/B/C ឯករាជ្យ និងដែនកំណត់ ➜ A302។
- Backend៖ RTDB parity subset 376 PASS/0 FAIL (exit 1 ដោយចេតនា ព្រោះ subset មិនមែន full run); rules 21 PASS/0 FAIL; Supabase RLS ពេញ 480 PASS និង datastore 191 PASS។ មិនយក subset exit ឬ CI head ចាស់ជាភស្តុតាង combined CI ទេ; CI លើ combined commit មិនទាន់រត់។
- បន្ថែម migration `20261025025945_zoe_rules.sql` តាម Business rules។ សកម្មភាពចាំបាច់៖ Publish Firebase Business rules និងរត់ Supabase migrations មុន merge App; update clients ទាំងអស់ទៅ `2.50.152` មុនពឹងលើ monthly receipts ព្រោះ writer ចាស់អាចលុប proof។ មិនបានប្តូរ live services។ បន្ថែមក្នុង release ដែលមិនទាន់ merge ដដែល មិនឡើង `2.50.153`។

### 2026-10-25 — A300 ៖ Supabase quota ពេញ និងទំហំបម្រុងសម្អាតមានពិដាន

| លេខ | ប្រភេទ | មូលហេតុឫសគល់ | អ្នកយាម |
|---|---|---|---|
| A300 | កំហុសដែលវាស់លើ Postgres ពិត និងគោលការណ៍សម្អាតមានពិដាន | លុប registry `true` ដកបានតែ 4 bytes តែបន្ថែម receipt; housekeeping រង់ចាំការសរសេរដែលបានជោគជ័យ ➜ ហាងពេញមិនអាចលុបតូច | `supabase-datastore-test` · `supabase-rls-test` |

- មូលដ្ឋាន៖ `c9cd859302e17285c9a44c2fe86de2cbb15ea80b`។ Regression ថ្មីលើ migration មុនកែបង្ហាញការលុបតូច · replay · ព្រំដែនបម្រុង · ការសម្អាតកំណត់ត្រាផុត · ការលុបស្របគ្នាក្រហម។
- Migration បន្ថែម `20261025025905_zoe_quota_cleanup.sql` រក្សា `quota_bytes` ធម្មតា និងរាប់ `bytes` តាមឯកសារ/tombstone/receipt ដដែល។ សម្អាតតែ receipt ផុត ២ ថ្ងៃ និង tombstone ផុត ៧ ថ្ងៃមុនសម្រេចបដិសេធ; replay នៅមុន cleanup និងនៅក្រោម tenant lock។ ការបដិសេធ rollback ទាំងការសរសេរ និង cleanup ក្នុង transaction ដូចគ្នា។
- **គោលការណ៍មានពិដានច្បាស់**៖ ការសរសេរដែលប្តូរតែឯកសាររស់ទៅ `null` អាចបន្ថែម metadata ដល់ `quota_bytes + 1048576`។ មិនមែនលុប quota ឬធានាថាសម្អាតគ្រប់ចំនួនបានទេ៖ បម្រុងអស់នៅតែ `quota_exceeded`។ No-op · បង្កើតថ្មី · mixed write · លុបកូនខ្លះដែលឯកសារនៅរស់ មិនអាចខ្ចីបម្រុង។ ការបង្រួមទំហំសរុប និង Admin រក្សាឥរិយាបថដើម។
- ផ្ទៀងលើ PG17 បណ្តោះអាសន្នតាម TCP៖ fresh install · ព្រំដែន `quota + 1 MiB` និងលើស 1 byte · replay/no-op · mixed rollback · root មាន tombstone · លុបកូនចុងក្រោយ · op_id ដូចគ្នា និងខុសគ្នាប្រណាំង · tenant ផ្សេង · accounting ក្រោយ resurrection/GC។ Upgrade លើហាងចាស់ពេញ `bytes = quota = 257` រក្សាទិន្នន័យ និង ACL ដដែល; ក្រោយ migration លុបតូចបាន `bytes = 417` ដោយរក្សា receipt ថ្មីទាំងពីរ។
- លទ្ធផល targeted លើកូដចុងក្រោយ៖ `supabase-datastore-test` ឆ្លង 191 រួម mutation និង upgrade; `supabase-rls-test` ឆ្លង 480; Supabase typecheck និង `strip-comments --check` ឆ្លង។ Build សម្រាប់ doc/version guards ជាប់ Chromium socket (`Operation not permitted`) របស់ sandbox; មិនរាយការណ៍ថា guards ទាំងនោះ PASS ទេ។
- **សកម្មភាពដោយដៃ**៖ migration មិនបានអនុវត្តលើសេវាពិតទេ; ត្រូវអនុម័តការដាក់ប្រើតាមផ្លូវ migration របស់គម្រោង។ Server-only៖ គ្មានការឡើងកំណែ ZoeW/ZoeKeyGen។ លទ្ធផល session ជា targeted checks មិនជំនួស CI លើ commit ចុងក្រោយ ឬការផ្ទៀងឧបករណ៍ពិត។

- **កែ contract របស់ CI guards ដាច់ពី source App**៖ `state-hygiene` កត់ហេតុផល lifetime របស់ `accountOperation` (សញ្ញាម្ចាស់ទទេ គ្មាន credentials; callback ផ្ទៀងវគ្គ) និង `nativeDownload` (សន្យាទាញ APK សាធារណៈ; ត្រូវរង់ចាំ native worker មុនដោះ busy) ជាមួយ `account-session-race.test.ts` និង `notify-apk-link.test.tsx`។ មិន reset ទិន្នន័យដើម្បីឱ្យ checker បៃតងដោយបំបែក ownership ទេ។
- `sw-install-integrity-test` និង `sw-revalidation-timeout.test.ts` ផ្ទៀង WASM ដែលមានក្នុង cache ជាប់នឹង shell ដោយ **zero fetch**; PNG ជា positive control សម្រាប់ background refresh។ នេះផ្គូផ្គងគោលការណ៍កូដ pinned ក្នុង A299 មិនប្តូរកូដ ship និងមិនបន្ថយការផ្ទៀង refresh ឡើយ។ Targeted tests ឆ្លង 88; typecheck និង lint ឆ្លង។ Browser guard នៅជាប់ socket របស់ sandbox មិនចាត់ជា PASS។
- CI លើ head មុនកែ៖ shard 1 និង 4 បរាជ័យ, shard 2 និង 3 ឆ្លង; មិនមែន CI របស់ commit ថ្មីទេ។ ការកែ money protocol រួមនៅ A301; កំណត់ត្រានេះមិនអះអាងថា audit ទាំងមូលចប់ ឬ CI ចុងក្រោយបៃតងទេ។

### 2026-10-24 — A299 ៖ audit ស្ថិតិ · ទិន្នន័យប្រាក់ចាស់ · own keys និងលទ្ធផលយឺត

| លេខ | ប្រភេទ | មូលហេតុឫសគល់ | អ្នកយាម |
|---|---|---|---|
| A299 | កំហុសដែលវាស់លើកូដពិតមុនកែ | ចំនួនលើជួរលាយរាប់កញ្ចប់បើក; ផ្លូវប្រាក់អានរាងទិន្នន័យមិនដូច normalizer; Supabase ប្រើ property access ដែលបាត់ own keys ពិសេស; ការងាររង់ចាំខ្វះការផ្ទៀងម្ចាស់វគ្គ/ការបោះបង់ | `daily-stats-mixed-pickup.test.ts` · `pickup-cleanup-collected-race.test.ts` · `supabase-own-keys.test.ts` · `account-session-race.test.ts` · `notify-apk-link.test.tsx` |

- មូលដ្ឋាន audit៖ `a5218a05abfd390d0abf01ed2f7f1f77f9595b80`។ កែតែចន្លោះដែលមាន regression បង្ហាញមុនកែ; មិនកែតំបន់ PTR/ចលនាបញ្ជី ឬ ZTO ដែលចាក់សោ។
- ស្ថិតិ៖ `daily-stats-mixed-pickup.test.ts` និង `pickup-reset-session.test.ts` ឆ្លង 16/16។ ប្រាក់៖ `pickup-cleanup-collected-race.test.ts` បង្ហាញ 5 ករណីក្រហមមុនកែ; ក្រុមផ្ទៀងក្រោយកែឆ្លង 46 និង 111 (មាន tests ស្ទួនរវាងក្រុម មិនបូកជាចំនួនតែមួយ)។
- Supabase៖ `supabase-own-keys.test.ts` បង្ហាញ 4/4 ក្រហមមុនកែ; ក្រុម adapter ចុងក្រោយឆ្លង 76/76។ គណនី៖ `account-session-race.test.ts` · `supabase-account.test.ts` · `auth-flow-race.test.ts` ឆ្លង 64/64។ APK៖ `notify-apk-link.test.tsx` មុនកែ 2 FAIL/15 PASS; បន្ថែមករណី timeout ហើយក្រោយកែចុងក្រោយឆ្លង 21/21។ ទាំងនេះជាក្រុម targeted មិនមែន full suite។
- ការផ្ទៀងឯករាជ្យ APK រកឃើញថា cancel acknowledgment មិនស្មើ native worker ចប់៖ regression 1 FAIL/19 PASS មុនកែបន្ថែម។ ប៊ូតុង retry រង់ចាំ worker ចប់ ឬពិដាន 45s; cancel call គាំងនៅមានពិដាន 20s។ តេស្តថ្មីគ្រប worker មិនចប់ និងការសាកម្ដងទៀតក្រោយបោះបង់។
- Service Worker៖ `sw-revalidation-timeout.test.ts` បង្ហាញ 5 regression ក្រហមមុនកែ ខណៈ 28 tests ចាស់ឆ្លង (ZoeW JS/CSS/WASM និង ZoeKeyGen JS/CSS)។ ក្រោយកែឆ្លង 33/33។ ផ្លូវ refresh រូបភាព/manifest និង cache miss នៅដដែល; `adaptive-link-test.js` ផ្ទៀងធនធានរូបភាពដើម្បីរក្សាអត្ថន័យ optional revalidation។
- កាមេរ៉ា៖ `config-qr-session.test.ts` ផ្ទៀងលទ្ធផល permission ចាស់ក្រោយបិទ/បើកផ្ទាំង និងប្តូរវគ្គ៖ មុនកែ 6 FAIL/1 PASS; ក្រោយកែជាមួយ camera/lock ឆ្លង 16/16។
- ក្រុមប្រាក់ចុងក្រោយឆ្លង 158 tests ក្នុង 7 ឯកសារ រួម legacy price fallback។ Supabase RLS ឆ្លង 480 និង datastore 151 លើ TCP-only Postgres harness បណ្តោះអាសន្ន; Edge typecheck ឆ្លង។ ការលុបតូចពេល quota ពេញត្រូវបានបន្តវាស់ និងកែដោយគោលការណ៍បម្រុងមានពិដានក្នុង A300។
- ការផ្ទៀងបន្ថែម push client/server ឆ្លង 116/116; ក្រុមរួមចុងក្រោយ 23 ឯកសារ/474 tests ឆ្លង រួម APK 21 និង forbidden-zone/ZTO locks។ typecheck/lint/strip និង build ឆ្លងមុនការកែ APK retry ចុងក្រោយ; build ចុងក្រោយកំពុងផ្ទៀងឡើងវិញ។ slot ownership · purity 15 · doc:check · android 125 ឆ្លង។ sw:check ជាប់ browser/socket របស់ sandbox មិនចាត់ជា PASS។ Browser measurement ក្នុង session ជាប់ការអនុញ្ញាត socket របស់ sandbox; មិនចាត់ជា PASS។ CI ចុងក្រោយ និង real-device verification នៅត្រូវធ្វើ។

### 2026-10-24 — A298 ៖ ហេតុអ្វី Lookup លឿន (~0.6s) តែ ZTO Login · ទាញបញ្ជី ZTO (6–15s) និង Sign ពិនិត្យស្ថានភាព (0.5–2s) នៅយឺត

| លេខ | ប្រភេទ | មូលហេតុឫសគល់ | អ្នកយាម |
|---|---|---|---|
| A298 | សំណើម្ចាស់គម្រោងផ្ទាល់ (តំបន់ចាក់សោ ZTO) | Uncached CORS preflights (`cache: 'no-store'`) · stale socket លើ `signPalm` status · timeout `7000ms` លើ `palmTrackJob` · idle pipeline workers · WebCrypto/ID-token ស្ទួន · sequential Blob RTTs ក្នុង `palmLogin` | `zto-palm-sign-server.test.ts` · `zto-palm-sign.test.tsx` · `zto-palm-list.test.tsx` · `zto-palm-server.test.ts` · `zto-palm-login.test.tsx` · `zto-palm-shared.test.ts` · `zto-lock.test.ts` |

- **ការផ្ទៀង `main` មុនកែ**៖ `git fetch origin main` បញ្ជាក់ថា local `HEAD` (`f0861e26`) ដូច `origin/main` 100% រួចស្រេច។ ម្ចាស់គម្រោងរាយការណ៍លេខវាស់លើការប្រើពិត៖ Lookup ~0.6s, ទាញបញ្ជី ZTO 11.0–15.0s (ពេលខ្លះ 6.0–8.0s), Sign ពិនិត្យស្ថានភាព ~0.50–2.0s និង ZTO Login នៅរាងយឺតទោះក្រោយ PR #350 (`0e2f50ce`)។
- **មូលហេតុទី ១ — `cache: 'no-store'` បំបែកការចងចាំ CORS preflight លើផ្លូវទាំង 3**៖ `auto-lookup.ts` និង `zto-status.ts` មិនដាក់ `cache: 'no-store'` ទេ (`CLAUDE.md` ហាមដាក់) ទើប Android WebView (`https://localhost` ➜ Netlify) ចងចាំ `OPTIONS` preflight បាន `Access-Control-Max-Age: 7200` (2 ម៉ោង)។ ផ្ទុយទៅវិញ `zto-list-sync.ts`, `zto-palm-sign.ts`, `palm-sign-outbox.ts` និង `zto-palm-login.ts` នៅសល់ `cache: 'no-store'` ដែលបង្ខំ Chromium ឱ្យផ្ញើ `OPTIONS` preflight ថ្មីរាល់ទំព័រ/ក្រុម/ការចុច (+0.3–0.6s ក្នុងមួយសំណើ ឬ +1.0–2.5s ក្នុងមួយជុំទាញបញ្ជី)។ Server ឆ្លើយ `Cache-Control: no-store` ស្រាប់ ដូច្នេះការដក `cache: 'no-store'` ពីជម្រើស `fetch` មិនធ្វើឱ្យចម្លើយចាស់ជាប់ cache ឡើយ (រក្សា `cache: 'no-store'` តែលើ `warmZtoLookupProxyIfConfigured` `OPTIONS` និង `firebase-sdk.ts`)។
- **មូលហេតុទី ២ — Sign ពិនិត្យស្ថានភាព (0.5–2.0s)**៖ ក្នុង `_shared/zto-palm.js` បន្ទាត់ `handlePalm` ហៅ `sign.signPalm` ដោយមិនបើក `retryStale` សម្រាប់ `TRACK_INFO_PATH`។ ដោយសារ ZTO មិនផ្ញើ `Keep-Alive` ហើយបិទ idle socket ស្ងាត់ៗ (`UND_ERR_SOCKET` / `ECONNRESET`), ការអានស្ថានភាពដំបូងលើ warm container បរាជ័យ 502 ជំនួសការសាកភ្លាមលើ socket ថ្មីដូច Lookup។ កែឱ្យបើក `retryStale` ចំពោះតែ `path === TRACK_INFO_PATH` (⛔ `saveScanInfo`, `saveBillPic`, `newBusinessCheck` និង `doLogin` មិនសាកស្ទួនដាច់ខាត) និង memoize `resolveListIdentity`/`resolveDetailAccess` ក្នុង `palmDeps` ដើម្បីកុំឱ្យផ្ទៀង `X-Zoe-Id-Token` ស្ទួនក្នុងសំណើតែមួយ។
- **មូលហេតុទី ៣ — ទាញបញ្ជី ZTO (11.0–15.0s និង 6.0–8.0s)**៖
  1. **កំពូលភ្នំ 11.0–15.0s**៖ `palmTrackJob` ប្រើ `deps.upstreamMs()` (`7000ms` ក្នុង production)។ ពេល socket `queryTrackInfo` តែមួយគាំង វាអូសក្រុមនោះ 7.0s រហូតអស់ថវិកា Function 9s ធ្វើឱ្យកញ្ចប់នៅសល់ធ្លាក់ចូល `unverified` ហើយបង្ខំ client រង់ចាំ 1.0s រួចរត់ Pass 2 (+3–6s = 11.0–15.0s)។ កំណត់ `PALM_TRACK_TIMEOUT_MS = 3000` (ដូច `palmSsoRead` 3000ms) កាត់ socket គាំងត្រឹម 3.0s ដើម្បីឱ្យ retry `+250ms` បញ្ចប់ក្នុង Pass 1 (~3.5s) ដោយគ្មាន `unverified` (តេស្ត ZTO យឺត 1500ms នៅបៃតង)។
  2. **ពេលធម្មតា 6.0–8.0s**៖ (ក) `pipelineWorker` ផ្អាករាល់ពេល `queue.length < 30` ខណៈទំព័រទី 2 កំពុងអាន `/getUserInfo` + `/scan/page/scan` (~1.5s); កែលក្ខខណ្ឌទៅ `queue.length >= 30 || (queue.length && !pageQueue.length)` ដើម្បីឱ្យ worker ទំនេរផ្ទៀងកញ្ចប់ដែលមានស្រាប់ភ្លាមៗ ដោយរក្សាពិដានចំនួនសំណើ Function ដដែល។ (ខ) ឌិគ្រីប WebCrypto AES-GCM និងអាន `ztoIdToken()` តែម្តងក្នុង `fetchZtoPalmListAllPages` ជំនួសការធ្វើស្ទួន 10–20 ដង និងអានតែម្តងជំនួស `resolveZtoListSignedVerdicts` ក្រោយទាញបញ្ជី Palm (ដែលមានភស្តុតាង `queryTrackInfo` រួច) ព្រមទាំងបន្ថយ `ZTO_PALM_LIST_RETRY_MS` ពី `1000ms` មក `300ms`។
- **មូលហេតុទី ៤ — ZTO Login**៖ ពេល Login ដោយដៃ (`!joining`), `palmLogin` សរសេរ `palm-session` រួចទើបអាន `palm-sites` ដោយបង្ខំ រួចទើបសរសេរ `palm-sites` ជាបន្តបន្ទាប់ (2–3 Blob RTTs)។ កែឱ្យចាប់ផ្ដើមអាន `palm-sites` ស្របគ្នានឹង `writeShared` លើ cold container (សល់ 1–2 RTTs) និងរំលងការអាន/សរសេរ `palm-sites` ទាំងស្រុងលើ warm container ដែលមានសាខានោះក្នុង `sharedIndexes` រួច (0 extra Blob reads)។
- **លទ្ធផលក្រហម ➜ បៃតង**៖ តេស្តថ្មីទាំង 6 ឯកសារធ្លាក់ក្រហមលើកូដមុនកែ (`status` 502 លើ `UND_ERR_SOCKET`, `cache: 'no-store'` លើ Sign/List/Login, `palmTrackJob` មិនចប់ក្នុង 4s ពេលគាំង 1 កញ្ចប់ និង `reads = 1` លើ warm re-login) ហើយបៃតង 100% ក្រោយកែ។
- **ការជួស CI ធ្លាក់លើ `main` (`f0861e26` · run `40080450479`)**៖ CI ធ្លាក់ 2 កន្លែងប៉ុណ្ណោះលើ `.github/workflows/opencode.yml`៖ (1) ផ្នែក 2/4 `security-guard-test.js` ទាមទារ `permissions:` នៅកម្រិតឯកសារខាងលើគេ (`^permissions:`) ខណៈ `f0861e26` ដាក់ត្រឹមក្នុង `jobs.opencode`; (2) ផ្នែក 4/4 `repository-file-coverage.js` ខ្វះ mapping សម្រាប់ `.github/workflows/opencode.yml`។ តាមចម្លើយជ្រើសរើសរបស់ម្ចាស់គម្រោង បានរក្សាទុក `.github/workflows/opencode.yml`, លើក `permissions:` (read-only) ទៅកម្រិតឯកសារ, បន្ថែមលក្ខខណ្ឌ `author_association` (`OWNER`/`MEMBER`/`COLLABORATOR`) ការពារ secret លើ repo សាធារណៈ និងចុះបញ្ជី policy `github-workflow-security` ក្នុង `audit-tools/repository-file-coverage.json` ➜ `security-guard-test` 55/55 និង `repository-file-coverage` 10/10 ឆ្លងទាំងអស់។

### 2026-10-24 — A297 ៖ ជួស R1–R5 និងដាក់ regression អចិន្ត្រៃយ៍

| លេខ | ប្រភេទ | ការកែ | អ្នកយាម |
|---|---|---|---|
| A297 | ការកែបញ្ហាដែលរកឃើញក្នុង A289–A293 | Session ownership · pickup membership · restore intent · Push CAS · admin retry | `pickup-reset-session.test.ts` · `phone-pickup-stale-view.test.ts` · `supabase-data-tools-test` · `push-server.test.ts` · `keygen-session-security-test` |

- **R1/A289 និង R2/A290 កែរួច**៖ Reset ចាប់ SDK/database/auth generation និង owner; ពិនិត្យក្នុង updater និងមុន/ក្រោយ await។ Phone edit ផ្លាស់ម្ចាស់តែ identities ដែល server pickup នៅរាប់ ហើយ late reconcile/rollback ប្រើច្បាប់ដូចគ្នា។ Baseline `39a0a9fd`៖ 16 FAIL / 6 PASS; ក្រោយកែ 22 PASS ហើយបន្ថែម null record/legacy/Reset ពិត និង logout ពិតដែល signOut រង់ចាំ success/failure ទៅ 27 ករណី PASS។ ក្រុមតេស្តពាក់ព័ន្ធ 181 PASS និង journal 113 PASS; audit guards 306 assertions PASS។ Fixed delay ក្នុង assertions journal បីបានប្ដូរទៅ bounded wait លើស្ថានភាពពិត; មូលដ្ឋានក៏ធ្លាក់ timing នោះលើ Windows។ មិនប្ដូរ COD/DOD semantics ឬ record schema។
- **R3/A291 កែរួច**៖ `crypto.randomUUID()` មួយសម្រាប់ការរត់ CLI ដែលត្រូវ apply រួម tenant/index/content ក្នុង batch ID; client retry រក្សា arguments ដដែល។ គ្មាន checkpoint/resume journal ក្នុង CLI; រត់ម្ដងទៀតអាន server ហើយសរសេរតែ diff ដែលនៅសល់។ HTTP + child CLI ពិត៖ 2 PASS / 5 FAIL មុនកែ ➜ 7 PASS ក្រោយកែ។ `supabase-data-tools-test` បន្ថែម restore→delete→restore លើ Postgres ពិត និង mutation ដក intent; លទ្ធផល SQL ស្ថិតក្នុង CI ព្រោះ Windows session នេះគ្មាន Postgres17។
- **R4/A292 កែរួច**៖ victims មកតែពី index CAS ដែលឈ្នះ និង record snapshot មុន CAS។ Blobs SDK `delete(key)` គ្មាន condition ដូច្នេះប្រើ CAS សញ្ញាអសកម្ម; record/index មាន revision ថ្មីរាល់ registration ដើម្បីការពារ same-content ABA។ Rollback, unsubscribe និង 410 cleanup ក៏រក្សា revision ថ្មី។ Tombstone មិនទទួល Push និងមិនរាប់ជាឧបករណ៍សកម្ម; capacity scan មានពិដានសំណើ/ពេលវេលា។ Guards ក្រហមលើ 5 scenarios មុនកែ រួម Firebase/Supabase stale owner និង CAS retry; regression ក្រោយកែ 62 PASS រួម migration/refresh/rollback/410 និង capacity reuse។ សញ្ញាអសកម្មនៅក្នុង Blob storage៖ storage/list-read cost អាចកើន ហើយការរាប់ active ក្រោយ physical records ≥5000 អាចឆ្លើយ retryable `503 subs:unverified` លើ store ធំ/យឺត; មិនប្រើ unconditional delete ដែលប្រណាំងនឹងម្ចាស់ថ្មី។
- **R5/A293 កែរួច**៖ retry callbacks ទាំងបួនពិនិត្យ generation/database មុនសរសេរ ហើយ `noRetry` ពេល stale។ Actual retry + auth lifecycle៖ baseline 327/346 (19 FAIL) ➜ 346/346 PASS; notice83, PIN18, biometric27 PASS។ រួម admin ផ្សេង, UID ដដែល login ថ្មី, DB ផ្សេង, confirmation switch និង late timeout; same-admin/PIN-only ជា positive controls។ Write ដែលផ្ញើរួចមុន logout មិនអាចត្រូវ UI លុបចោលពី server បាន; guard ទប់ការផ្ញើ retry ថ្មី។
- Harness លំដាប់ប្រាក់ថ្មីក្នុង CI `39a0a9fd` ឆ្លង Sheet checkpoints ប៉ុន្តែ Cookie scan រង់ចាំព្រោះ Restore បើក modal ធុងសំរាមឡើងវិញ។ `money-cookie-blob.js` ឥឡូវបិទតាម `cancelRestoreItem()`/`closeRecentlyDeletedModal()` មុនស្កេនថ្មី និងចុង flow; មិនកែ flag ដោយផ្ទាល់ មិនបន្ថយ assertions ប្រាក់។ Real-source VM បញ្ជាក់ modal ធម្មតា និង duplicate-restore រារាំង scan មុនកែ ហើយបន្តបានក្រោយកែ; PIN និង Restore កំពុងរត់នៅត្រូវបដិសេធ។
- CI `b31cd7ce` បង្ហាញបញ្ហា harness/checker ចំនួន៤៖ `state-hygiene` ខ្វះហេតុផល owner ទទេដែលរក្សាតែមួយ; `security-guard` ចាប់ literal key ក្លែង; Palm fixture ខ្វះ `billInfoQuery`; `ui-flow` បិទ PH1 ដោយមិនបញ្ចូល identity ក្នុង pickup map។ កែហេតុផល owner មាន real logout tests, ប្រើ SECRET ក្លែងដែល random នៅពេលរត់, បន្ថែម Palm lookup ដែលផ្ទៀង token/site និង seed PH1 ឱ្យត្រូវចំនួន។ មិនបន្ថយ assertions ប្រាក់/សុវត្ថិភាព៖ UI browser 1 FAIL / 89 PASS ➜ 95 PASS រួម Reset→stale view→phone edit រក្សាចំនួនសូន្យ និង COD/DOD; security55 PASS; Palm Function probe 502 ➜ 200 ជាមួយ phone/COD/DOD ត្រឹមត្រូវ។ CI នោះឆ្លង Cookie realDB flow និង Postgres data-tools109 មុនកែ harness; realDB Palm ពេញលេញ និង suite ទាំងមូលនៅត្រូវផ្ទៀងលើ SHA ក្រោយកែ។
- Source fixes បានពិនិត្យឯករាជ្យ; CI លើ final SHA ជាលក្ខខណ្ឌបញ្ចប់ មិនយក baseline CI ឬ fixtures ជំនួស realDB checks។ Live ZTO timing និង iPhone/Android/APK manual validation នៅដាច់ពី regression ទាំងនេះ។

### 2026-10-24 — A296 ៖ Sign បញ្ជាក់សារធម្មតាដោយស្វ័យប្រវត្តិ និងរក្សា queue មុនរង់ចាំ ZTO

| លេខ | ប្រភេទ | លទ្ធផល | អ្នកយាម |
|---|---|---|---|
| A296 | សំណើម្ចាស់៖ កាត់ការសួរបញ្ជាក់ម្តងមួយកញ្ចប់ | ប្រើ sealed token ដើមដោយស្វ័យប្រវត្តិមានពិដាន ហើយរក្សារូប/ការងារមុន network preflight | `palm-sign-confirmation-transport.test.ts` · `zto-palm-sign.test.tsx` · `palm-sign-outbox.test.tsx` |

មូលដ្ឋានការកែនេះ `02b9dadf` មាន Audit CI `40054357280` ជាប់ 4/4 shards (214 checkers); CI នោះមិនជំនួសការផ្ទៀងកំណែ Sign ថ្មីទេ។ Guard ថ្មីត្រូវក្រហមលើ source មូលដ្ឋាន មុនកែ។

Native Palm និង server ដែលមានស្រាប់បែងចែកសារបន្តបានពីសារហាម៖ `whetherForce:true` គ្មានប៊ូតុងបន្ត; `90187`/`90189` ជាផ្លូវពិសេស COD/site override ដែល ZoeW នៅបដិសេធ។ ប្រើតែ `ZTO_PALM_SIGN_CONFIRM_REQUIRED` ត្រឹម Barcode/stage/message/token; មិនប្រើពាក្យស្មាន ឬ `problemScan` ជាភស្តុតាងអនុញ្ញាត។ Token នៅចង session, request, Barcode, name, photo, proof និង warning hash; backend និង ignore flags មិនប្រែ។

Queue ថ្មីមានជម្រើស auto-confirm; worker រក្សា token និង renew lease តាម CAS មុន replay។ មាន token ស្រាប់មិនអនុម័តសារថ្មីស្ងាត់ៗទៀត។ Lost ACK នៅពិនិត្យ journal/status; មិនផ្ញើ 05 ស្ទួនតាមការសន្និដ្ឋាន។ ម្ចាស់ដូចគ្នាមិនចែក token ឬរូបគ្នា។

**ការផ្ទៀង Sign ក្នុង session៖** ZTO/Palm 59 files / 1228 tests ឆ្លង; TypeScript, lint, production/audit build, docs scope 110, Android 125 និង notice ឆ្លង។ Guard ថ្មីចាប់ការបញ្ជាក់ស្ទួន/សារខុសអត្តសញ្ញាណ, token persistence/CAS/lease, session ប្រែ និង parcel ស្តារ/ដកកណ្តាល warning។ Regression ក្រហមមុនកែរកឃើញ replay ចាស់; ការផ្ទៀងចុងក្រោយមិនរកឃើញ regression នោះទៀត។

**សំណើផ្ទៀងប្រាក់បន្ថែម៖** ម្ចាស់គម្រោងស្នើគ្រប ZTO Login, Cookie/Blob និង Sheet lookup ហើយលំដាប់ «ដក → ស្តារ → លុប → ស្តារ»។ `lookup-modes-money.test.ts` 30/30 ឆ្លងដោយហៅ scan/save, registry, ledger, restore gates, close និង outbox ពិត; ជំនួសតែ SDK/HTTP/disk boundaries។ ទាំង daily/monthly ត្រូវ literal COD/DOD/count និង history/trash/pickup/collected identities នៅរាល់ជំហាន។

- Sheet និង Cookie unsigned ដែល ZTO ផ្ទៀងថ្មីអនុញ្ញាត៖ `10/2/1` ➜ ដក `0/0/0` ➜ ស្តារ `10/2/1` ➜ លុប `10/2/1` ➜ ស្តារ `10/2/1`; ធ្វើស្ទួនមិនប្តូរប្រាក់។
- Palm និង Cookie signed៖ ស្តារហាមក្រោយដក/លុប; ប្តូរ device ទៅ Sheet មិនលុបច្បាប់នៅក្នុង trash។ Cached/unverified/offline Cookie response មិនអនុម័តស្តារ។
- គ្រប registry ពេល view ចាស់, lookup យឺត, transaction retry រក្សា operation ID, restore commit បាត់ ACK, close ស្ទួន និងកញ្ចប់ពីរក្នុងម្ចាស់តែមួយ។ Queue ➜ `recordSigned` ➜ close/ledger ពិតគ្រប late ACK ជាមួយ sweep, lost ACK recovery, auto-confirm និង ACK ក្រោយដក។
- បន្ថែម sequence ដូចគ្នាទៅ `money-cookie-blob.js` ដែលហៅដោយ real RTDB `emu/money-multidevice-emu-test` និង real Postgres `supabase-money-multishop-test`៖ Sheet មុន Cookie/Palm, action ស្ទួនឆ្លងឧបករណ៍, server invariants រាល់ជំហាន និង actual restore gates។ ក្នុង Windows នេះគ្មាន emulator/WSL/Docker ដំណើរការ; ការរត់ DB ពិតត្រូវផ្ទៀងតាម CI លើ commit ចុងក្រោយ មិនយក Vitest fixture ជំនួស។

### 2026-10-24 — A294–A295 ៖ ZTO performance និង checker ដែលឈប់មុនបញ្ចប់

| លេខ | ប្រភេទ | លទ្ធផល | អ្នកយាម |
|---|---|---|---|
| A294 | ការបង្កើនល្បឿនតាមសំណើម្ចាស់ | កាត់ duplicate pending reads និងរង់ចាំឯករាជ្យ; business writes នៅតែមានលំដាប់ | `zto-read-sharing.test.ts` · `zto-palm-shared.test.ts` · `zto-sweep-prefetch.test.ts` |
| A295 | កំហុស checker ដែលបានកែ | VM require ខុសថតធ្វើឱ្យ cookie-session checker ឈប់មុនចប់ជាមួយ exit 0 | `zto-cookie-session-test` |

ម្ចាស់គម្រោងស្នើផ្ទាល់ឱ្យពិនិត្យ និងបង្កើនល្បឿន ZTO Cookie/Blob និង ZTO Login ហើយផ្តល់ Palm archive។ មូលដ្ឋាន `fe3b648f`; ការកែឯកសារមុនការស្នើបន្ថែមនៅ `c3e9a183`។ Guard ក្រហមមុនកែ ➜ កែ ➜ ពិនិត្យ guard ទាំងផ្លូវវិជ្ជមាន/អវិជ្ជមាន ➜ ប្តូរ fingerprint របស់ឯកសារដែលបានអនុញ្ញាតក្នុង `zto-lock.test.ts`។

**ការវាស់ synthetic ពី code ពិត, មិនមែន ZTO server latency៖**

- Cookie៖ 8 cold lookups Blob reads 8 ➜ 1; list modes 3 ប្រើ identity/Blob reads 3/3 ➜ 1/1។ ក្នុង fixture ដែល service ទាំងអស់រត់ស្របគ្នាបានស្រាប់ latency ស្ទើរដដែល—អត្ថប្រយោជន៍គឺកាត់ request ស្ទួន។ ការសាក lifetime write ស្របគ្នាបានកាត់ 1516 ➜ 984 ms ប៉ុន្តែរកឃើញ race ហើយដកការកែនោះវិញ; មិនរាប់ជាលទ្ធផលកំណែចុងក្រោយ។
- Palm៖ signed list 2 សាខា median 110.59 ➜ 66.68 ms; 3 សាខា 116.77 ➜ 69.28 ms (10 samples, network delay ក្លែង 35 ms)។ Cold callers 6 ➜ Blob read 1; fixture ដែល Blob capacity=2 ប្រើ median 135.90 ➜ 49.99 ms។ Capacity=2 ជាសន្មត់របស់ fixture មិនមែនការវាស់ Netlify។
- Detail sweep actual imported function៖ 10 reads × 80 ms និង writes × 5 ms, 850 ➜ 340 ms; max reads 1 ➜ 3, max writes 1, ledger 55 ដដែល។ Session/offline/scanning ប្រែពេលរង់ចាំ ➜ មិនអនុវត្តចម្លើយ stale។
- Import actual client/ledger functions ជាមួយ DB fixture 10 ms៖ 100 អតិថិជនផ្សេងគ្នា 878 ms, អតិថិជនតែមួយ 3300 ms; ទាំងពីរ ledger count 100/COD 5050។ មិនប្តូរ import concurrency 4 ឬ lane phone+day។
- Sign receipt fixture មាន 6 upstream calls តាមលំដាប់; dispatch និង receipt-check មាន 2។ មិនបំបែក precheck/photo/journal/scan writes ព្រោះ ACK និង business dependencies។

**ភាពត្រឹមត្រូវ៖** keys ចែក pending reads តាម Blob context/version និង issuer/publishable-key/token ឬ Palm slot/proxy-key; ចម្លើយបរាជ័យ/timeout ត្រូវដក, deadline អ្នករង់ចាំខ្លីមិនកាត់អ្នករង់ចាំវែង។ Fresh cookie bypass ធ្វើឱ្យចម្លើយចាស់មិនជាន់ rotation។ ក្នុង candidate ដំបូង ការរង់ចាំ sibling ទាំងអស់ពេល primary auth ផុតស៊ី renewal budget: baseline 200 ➜ candidate 503; ត្រូវបានកែឱ្យ primary failure ត្រឡប់មុន និង sibling renewal រង់ចាំ primary success; guard ដូចគ្នា baseline/final 200។

ការផ្ទៀងចុងក្រោយរកឃើញ race ក្នុង lifetime overlap៖ request A ទទួលជោគជ័យហើយចាប់ផ្តើម persistence ខណៈ signed companion យឺត; request B បដិសេធ Cookie តែ `life.inFlight` ធ្វើឱ្យត្រាបដិសេធបាត់។ Guard ពី handler ពិតក្រហមលើ candidate ហើយដកតែ overlap វិញ រក្សា read sharing។ Baseline និងកំណែចុងក្រោយរក្សា `ended:true`; មិនយកល្បឿនដែលបាត់ correctness។

**A295៖** `zto-cookie-session-test.js` បញ្ជូន require របស់ audit-tools ទៅ VM ដូច្នេះ require('./_shared/zto-palm') ទៅថតខុស។ នៅ baseline មាន FAIL 3 បន្ទាប់មក pending Promise គ្មាន active handle ➜ process exit 0 មុន summary។ កែ fixture ឱ្យ load module ពិតក្នុង VM ដដែល (fetch stub ដដែល), បន្ថែម watchdog 10 វិនាទីក្នុង scenario; ឥឡូវ execute 32 scenarios។ CI មូលដ្ឋានបៃតងមិនបានបញ្ជាក់ scenario ទាំងនេះទេ។

**ការផ្ទៀងចុងក្រោយក្នុង Windows៖** តេស្ត ZTO/Palm ពាក់ព័ន្ធ 58 files/1188 tests ឆ្លង (ជុំដំបូង 1187 pass និង IndexedDB suite មួយខ្វះ Linux Chromium; កំណត់ `ZOEW_TEST_BROWSER` ទៅ Chrome ក្នុងម៉ាស៊ីនហើយរត់ suite នោះឡើងវិញ 1/1)។ `zto-list-sync-test` 595 · `zto-sync-banner-test` 206 · `zto-cookie-session-test` 32 · `zto-budget-test` 63 · `zto-cookie-store-test` 91 · TypeScript · lint · build · `doc-scope-test` 110 · `doc:check` · `version-check` · `version-bump-scope` 18 · `repository-file-coverage` 10 · Android config 125 ឆ្លង។ Banner checker លើ Windows មាន `route.continue()` ទៅ localhost timeout ទោះ Node fetch បាន200; scratch wrapper ផ្គត់ផ្គង់ bytes ពិតពី local HTTP server ទៅ browser ដោយរក្សា assertions ដើមទាំង206។ មិនបានកែ checker ដើម្បីរំលង assertion និងមិនជំនួស Linux CI ពេញ។

**Palm archive៖** build ដែលបានផ្តល់ version 2.9.93/code171; jadx បក 9,323 classes និងរាយការណ៍ 127 errors។ Generic scan batch 100 មាន per-barScannerId failures; photo uploads នៅតែ per-image, preorder ➜ COD/DOD ➜ business check ➜ sign-log មាន dependencies។ មិនចម្លង batch ឬ timeout ជា server capacity; មិនរត់ app ឬប្រើ embedded credentials។

**Live៖** user ផ្តល់ zoew.netlify.app និង login។ Public GET 8 samples/path វាស់បានតែ client➜Netlify (function ឆ្លើយ401 ដោយគ្មាន proxy key, មិនដល់ ZTO)។ IAB មិនគាំទ្រ prompt(); Chrome dialog automation timeout ហើយ Computer Use បញ្ឈប់ដោយមិនអាចផ្ទៀង URL window បាន។ គ្មាន ZTO live latency/throughput ឬ successful live write measurement។ កុំអះអាងថា server ដល់ពិដាន ឬ performance production ឡើងតាមភាគរយ fixture។

### 2026-10-24 — Audit ពី main ៖ រកឃើញ A289–A293 · រៀបចំឯកសារ និង handoff

សំណើម្ចាស់គម្រោង ៖ review និង audit project ទាំងមូល ដោយយកកំណែថ្មីពី `main`; បន្តរៀបចំ `CLAUDE.md` · `HISTORY.md` និងពិនិត្យឯកសារ Markdown ទាំងអស់ ដើម្បីឱ្យ session ក្រោយបន្តបាន។
មូលដ្ឋាននៃការវាស់ ៖ commit `fe3b648f974f0dc358aeba9252a489969a90cf0b` · ZoeW `2.50.147` · ZoeKeyGen `2.24.24`។ Workspace ថ្មីត្រូវបាន clone ពី `main`។
**ស្ថានភាពប្រវត្តិ ៖ នៅដំណាក់កាលដំបូង (`c3e9a183`) បញ្ហាទាំង ៥ នៅបើក និងកែតែឯកសារ; ការកែបញ្ហាទាំង ៥ រួចកត់ក្នុង A297។** ការងារ ZTO ដែលស្នើបន្ថែមមានកំណត់ត្រាដាច់ក្នុង A294–A295 និង [2.50.148]។

| លេខអចិន្ត្រៃយ៍ | លេខក្នុងរបាយការណ៍ | អាទិភាព | កំហុសដែលបញ្ជាក់បាន | ប្រភពនៅមូលដ្ឋានដែលបាន audit |
|---|---|---|---|---|
| A289 | R1 | P1 | Reset pickup ច្រើនថ្ងៃបន្តសរសេរទៅហាងថ្មីក្រោយ session ប្រែ | `ZoeW/src/domain/collected.ts:367-370` |
| A290 | R2 | P2 | កែទូរស័ព្ទលើកញ្ចប់បិទរួច បង្កើត pickup count ដែល Reset លុបឡើងវិញ | `ZoeW/src/features/entry-ops.ts:136-153` |
| A291 | R3 | P2 | Restore backup ជុំថ្មីប្រើ batch operation ID ចាស់ ហើយ server replay លទ្ធផលមុន | `tools/supabase-migrate/migrate.js:359-360,520-525` |
| A292 | R4 | P2 | Eviction ពី push index A ចាស់លុប subscription ដែលផ្ទេរទៅ identity B | `ZoeW/netlify/lib/push-core.mjs:399-401` |
| A293 | R5 | P2 | Retry របស់ KeyGen សរសេរ intent admin A ក្រោយ logout/login ជា admin B | `ZoeKeyGen/app.js:3000,3036,3281,3322` |

#### R1 · A289 — Reset pickup ឆ្លង session

`resetPickupStats()` រក្សាបញ្ជីថ្ងៃពីហាង A ប៉ុន្តែ iteration នីមួយៗប្រើ `firebaseState.fb`/`firebaseState.db` ដែលរស់ ដោយគ្មាន database/auth-generation owner check។
**របៀបបង្កើតឡើងវិញ ៖** seed ស្ថិតិយករួចពីរថ្ងៃក្នុង A ➜ Reset តម្រង «ទាំងអស់» ➜ SDK fixture ទប់ Promise នៃ write ថ្ងៃទីមួយ ➜ ប្តូរ `db` និង `authGeneration` ទៅ B ដែលមានស្ថិតិខ្លួនឯង ➜ resolve Promise ចាស់។
**លទ្ធផលវាស់ ៖** write ទីមួយទៅ A, write ទីពីរទៅ B ជាមួយ `{ packagesPickedUp: 0 }`; callback ក៏ជាន់ local counters របស់ B។ តម្រងថ្ងៃតែមួយមិនមាន write ទីពីរ ប៉ុន្តែ callback ចាស់នៅតែជាន់ state ថ្មី។
PIN បិទមុនហៅ action (`features/pin.ts`) ហើយ Config មិនមាន gate របស់ Reset (`features/config.ts`)។ ផលប៉ះពាល់ជាចំនួនកញ្ចប់/អតិថិជនយករួច; function នេះមិនកែ COD/DOD ledger ហើយមិនមែនភស្តុតាងរំលង server RLS ទេ។
**គោលដៅការកែដែលកំណត់ពេលរកឃើញ ៖** ចាប់ SDK/database/auth generation និង operation owner; ផ្ទៀងមុន write, ក្នុង updater និងក្រោយ await; state/toast/ការដោះសោក៏ត្រូវជារបស់ owner នោះ។ បន្ថែម multi-day និង late-completion regression។

#### R2 · A290 — កែទូរស័ព្ទក្រោយ Reset

**របៀបបង្កើតឡើងវិញ ៖** seed history មាន barcode បិទរួចមួយ និង pickup `{ packagesPickedUp: 0 }` ក្រោយ Reset ➜ កែទូរស័ព្ទទៅលេខថ្មី ➜ SDK fixture អនុវត្ត transaction និង history patch ពិត។
**លទ្ធផលវាស់ ៖** count ប្រែ 0 ➜ 1 ជាមួយ `pickedUpPhones` និង `pickedUpBarcodes` ដែលបង្កើតឡើងវិញ។ `closedPickupMarks()` បញ្ជូន barcode ដែលបិទទាំងអស់ទៅ `markPickupBarcodes()`/`reapplyPickupMarks()` ទោះ key លែងមានក្នុង pickup record។
**គោលដៅការកែដែលកំណត់ពេលរកឃើញ ៖** ផ្លាស់ phone owner តែ keys ដែលនៅមានក្នុង server pickup record ដោយរក្សា count; កុំបញ្ចូល key ដែល Reset លុប។ ត្រូវវាស់ success/failure/late និង stale view។
`ZoeW/tests/phone-pickup-stale-view.test.ts` មានករណី Reset បន្ទាប់មករក្សាលេខដដែល; branch ដែលលេខប្រែមិនត្រូវបានវាស់។ `ZoeW/tests/session-switch-fuzz.test.ts` សាក Reset ថ្ងៃតែមួយ ដូច្នេះមិនវាស់ iteration ទីពីររបស់ R1។

#### R3 · A291 — Restore ដែលត្រូវបាន deduplicate ជាមួយជុំមុន

`batchOpId()` hash តែ tenant + ខ្លឹមសារ batch។ SQL ចុងក្រោយ `supabase/migrations/20261016120000_zoe_linear_write.sql:653-655` ត្រឡប់ cached `zoe_ops` មុនសរសេរ; housekeeping នៅជួរ 866 សម្អាត ops ចាស់ជាង ២ ថ្ងៃ។
**របៀបបង្កើតឡើងវិញ ៖** export មាន parcel p1 មួយ ➜ ហៅ CLI ពិត `node tools/supabase-migrate/migrate.js backup.json --tenant <uuid> --apply --replace` ទល់ RPC fixture ដែលរក្សា result តាម tenant/op ID ដូច SQL ➜ លើកទីមួយជោគជ័យ ➜ លុប p1 ក្នុង fixture ➜ ហៅ CLI ដដែល ខណៈ op ចាស់នៅសល់។
**លទ្ធផលវាស់ ៖** `firstExit: 0`, `secondExit: 1`, actual writes 1, replays 1, p1 នៅបាត់; final verification រាយ `VERIFY FAILED` ត្រឹមត្រូវ។ មិនមែន success ក្លែងក្លាយទេ។ Cache lookup មិនកាត់តាមអាយុផ្ទាល់ ដូច្នេះព្រំដែនអាស្រ័យ cleanup ផង។
**គោលដៅការកែដែលកំណត់ពេលរកឃើញ ៖** operation identity សម្រាប់ restore intent ថ្មី ខណៈ request retry និង resume របស់ intent ដដែលរក្សា ID ដដែល; កុំប្រើ random ID ថ្មីរាល់ retry ដែលអាចបំបែកការពារចម្លើយបាត់។
ភស្តុតាងនេះប្រើ CLI ពិត និង RPC model នៃ SQL ដែលបានអាន/ផ្ទៀងឯករាជ្យ; scenario ថ្មីមិនទាន់រត់លើ Postgres ពិតទេ។

#### R4 · A292 — Push eviction ត្រូវម្ចាស់ថ្មី

**របៀបបង្កើតឡើងវិញ ៖** import `push-core.mjs` ពិត ជាមួយ ETag store និង license fixtures ➜ subscribe endpoint ដដែលជា identity A ➜ subscribe ជា B ហើយធ្វើឱ្យ CAS ដក key ពី index A ចាញ់ទាំង ៤ លើក ➜ បន្ថែម subscriptions ថ្មី 10 សម្រាប់ A ដល់ eviction។
**លទ្ធផលវាស់ ៖** record របស់ B ត្រូវ `store.delete(k)` លុបដោយគ្មាន current-owner/revision fence ប៉ុន្តែ index B នៅចង្អុលទៅ key នោះ; `migratedDeviceExists: false`, `tenantBStillIndexesDevice: true`។
ផលប៉ះពាល់ជាការបាត់ Push រហូត resubscribe; មិនមានភស្តុតាងលេច business data ឬរំលង tenant RLS។ Client អាចរក្សា PushSubscription ដដែលពេល resync identity ដូច្នេះនេះជាផ្លូវអាចទៅដល់បាន។
**គោលដៅការកែដែលកំណត់ពេលរកឃើញ ៖** deletion ត្រូវផ្ទៀង ownership និង revision ជាមួយគ្នា; read owner រួច unconditional delete នៅមាន race។ Guard ត្រូវរួម stale index, CAS ចាញ់, migration និង capacity eviction។

**ករណី CAS បន្ថែម ៖** `dropped` នៅក្រៅ updater ហើយប្រមូល victim ពីការប៉ុនប៉ងដែលបរាជ័យ។ ពេល device0 refresh ជាន់នឹង subscribe device10 ក្នុង index ពេញ, CAS retry ជោគជ័យរក្សា device0 ប៉ុន្តែការលុបបន្ទាប់នៅលុបវា។ Probe ប្រើ `service.subscribe` ពិតជាន់គ្នា៖ index 10, records 9, `refreshedDeviceExists: false`។ ត្រូវយក victim តែពី CAS ដែលជោគជ័យ រួម ownership/revision fence។

#### R5 · A293 — KeyGen retry ក្រោយ admin ប្រែ

**របៀបបង្កើតឡើងវិញ ៖** ស្រង់ functions ពិត `setKeySeatLimit`, `releaseKeySeat`, `sendNotice`, `deleteNotice`, `retryAsync`, `logoutApp` និង auth callback ➜ admin A ផ្ញើ seat write ទីមួយ ➜ SDK fixture បដិសេធ ➜ logout/login ជា admin B ក្នុង retry delay ➜ អនុញ្ញាត retry បន្ត។
**លទ្ធផលវាស់ ៖** functions ទាំងបួនផ្ញើ write A ➜ write B ទោះ `authGeneration` ប្រែ និង cache ត្រូវសម្អាត។ `operationDb` ចាប់ database ចាស់ ប៉ុន្តែ SDK របស់ App នោះប្រើគណនី B; guard ក្រោយ await មិនទប់ side effect ថ្មីក្នុង retry callback។
B ក្នុង scenario ជាគណនី admin ដែលមានសិទ្ធិ; មិនមែន Firebase rules bypass។ Release ដែល retry យឺតអាចលុបការចងឧបករណ៍ថ្មីដែលចូលក្នុងចន្លោះ។
**គោលដៅការកែដែលកំណត់ពេលរកឃើញ ៖** ផ្ទៀង operation generation/database មុនរាល់ write ក្នុង retry callback និងបញ្ឈប់ `noRetry` ពេលវគ្គប្រែ ដូចផ្លូវ Generate។ Existing seat checker ប្រើ retry fixture ដែលហៅតែម្តង ដូច្នេះមិនវាស់ចន្លោះនេះ។ Probe ឯករាជ្យវាស់ ១២ ករណី៖ normal retry ៤, stale-session reproduction ៤ និង guard ក្នុង sandbox ៤; ដំណឹងផ្ញើ/លុបត្រូវគ្របដូច seat operations។

#### U1 — ការស្តារសោមកយឺត ត្រូវផ្ទៀងបន្ថែម

**បានផ្ទៀង និងកែបន្ទាប់ក្នុង A326 (2026-10-26)**។ អត្ថបទខាងក្រោមរក្សាស្ថានភាពភស្តុតាងនៅពេលរកឃើញដំបូង; មិនមែនការងារនៅបើកទៀត។

`ZoeW/src/services/crypto.ts:115-123` ពិនិត្យ `appLockShouldArm()` មុនចាប់ផ្តើមអាន IndexedDB ហើយកំណត់ `lookupSecretKey` ពេល Promise ដោះស្រាយ។ ការចាក់សោ/ចាកចេញនៅចន្លោះគឺជាករណីត្រូវវាស់។ VM ដែលពន្យារចម្លើយបង្ហាញ late assignment ប៉ុន្តែមិនទាន់បញ្ជាក់ថាលំដាប់នេះអាចកើតជាមួយ transaction scheduling ពិតរបស់ IndexedDB និង boot/logout flow ទេ។ ដូច្នេះ **មិនរាប់ក្នុងកំហុសបញ្ជាក់ទាំង ៥** និងមិនអះអាងថារំលង PIN ឬលេច secret; session បន្ទាប់ត្រូវប្រើ browser និងទិន្នន័យក្លែងដើម្បីផ្ទៀង។

#### លទ្ធផលផ្ទៀង និងព្រំដែន

- [Audit CI 40047083493](https://github.com/mengsroy-h/Zoe-System/actions/runs/40047083493) លើ SHA មូលដ្ឋានដូចគ្នា ៖ **214/214 checker ទាំង ៤ ផ្នែកជាប់**, 0 failures, 0 partial, 0 skips (50 + 54 + 57 + 53)។ នេះជា CI ដែលមានស្រាប់ មិនមែន full suite ដែលរត់ថ្មីលើ Windows ក្នុងជុំនេះ។
- Focused Vitest ក្នុង session ៖ **280/280 tests ក្នុង ១៤ files ជាប់**៖ UI/locks/push ១៦៩, pickup/session ៧៣ និង native lifecycle/Back/print/orientation ៣៨។ Typecheck, lint, build, React slot/purity និង Android configuration guard ក៏ជាប់។
- Backend guards ក្នុង session៖ Supabase Functions strict **235 PASS**, Firebase Backup **92 PASS**, KeyGen session guard **178 PASS**។ Browser audit build ប្រើ Chrome ដែលមានក្នុង Windows; គ្មានការប្តូរកូដ production សម្រាប់ host នេះ។
- នៅដំណាក់កាលដំបូង Repro ទាំង ៥ ប្រើ source/module ពិត និង fixtures; scripts ស្ថិតក្រៅ repo ហើយ **មិនមែន regression guards អចិន្ត្រៃយ៍**។ ជំហានខាងលើជាភស្តុតាងសម្រាប់បង្កើតតេស្តម្តងទៀត; session ក្រោយមិនត្រូវពឹងផ្លូវឯកសារក្នុងម៉ាស៊ីននេះ។ គ្មាន mutation លើការកែ ព្រោះមិនទាន់មានការកែកូដ។
- `npm audit --json` លើ package contexts ដែលមាន lockfiles ទាំង ៤ ៖ ZoeW high 3; Firebase provisioning high 4 + moderate 2; Supabase និង backup 0; ZoeW `--omit=dev` រាយ 0 (នេះជាការចាត់ dependency របស់ npm មិនមែនភស្តុតាងថា browser bundle គ្មានហានិភ័យទេ ព្រោះ client libraries ក៏នៅ devDependencies)។ នេះជា ៩ package entries ក្នុងពីរ lockfiles (៨ ឈ្មោះខុសគ្នា) មិនមែន exploit ដែលបានបញ្ជាក់ ៩ ទេ។ Advisories ពាក់ព័ន្ធ tooling/provisioning ត្រូវវាយតម្លៃ reachability និង patch ក្នុងជុំថែទាំដាច់ដោយឡែក។
- មិនបានចូល production database, deploy settings ឬ secrets និងមិនបានសាក iPhone/WebKit ឬ APK លើឧបករណ៍ពិត។ ការពិនិត្យ source មិនបញ្ជាក់ថា project គ្មានកំហុសទាំងស្រុង។ ការសម្រេចទទួលយក និងការរង់ចាំ owner verification ពីជុំមុននៅតាម «📌»; មិនបង្កើតការបញ្ជាក់ជំនួសម្ចាស់គម្រោង។
- ឯកសារជុំនេះ ៖ ដក handoff ដែលអះអាង branch A261–A263 ជាស្ថានភាពបច្ចុប្បន្ន, បំបែកប្រវត្តិរួចពីការងារនៅបើក និងយោង R1–R5 ទៅលេខ A អចិន្ត្រៃយ៍។ បណ្ណសាររក្សាប្រវត្តិដដែល; មិនបន្ថែមកំណែ App ក្នុងផ្នែក ១ សម្រាប់ការរៀបចំឯកសារនេះ។

### 2026-10-24 — A288 ៖ iPhone PWA ៖ ∧/∨ ក្រោយអូសរំកិល ➜ `keepKeyboardFocusInPlace()` ចាត់ focus ជារបស់ការអូស ➜ ទំព័ររុញ ➜ [2.50.146]

toast 🔬 ពី iPhone ម្ចាស់គម្រោង (6:35 · preview [2.50.145] · ផ្ទាំង Sign · keyboard ៤០៣) ៖ ការចុចធម្មតាលែងរុញ (A287 ✅) · នៅសល់ពេលចុច ∧/∨ ៖

| toast | tape (ms ធៀបការរុញ) | រុញ |
|---|---|---|
| ១ | `ts:video#palmSignVideo c0` ➜ `te:200ms Δ-56,-85 c0` · `ts:sn~ c0` ➜ `te:167ms Δ-56,-107 c0 p0` (អូស) ➜ ៦៤២ms ➜ `bl:sn · fo:sb` (គ្មាន touch ៖ ∨) ➜ `kb:403→319` · `vs:0→118` ➜ ០ ក្នុង ៧៧ms | ១១៨pt |
| ២ | `ts:sn` ➜ `te:75ms p1` (ចាប់ ✓) ➜ `ts:video c0` ➜ `te:275ms Δ-57,-149 c0 p0` (អូស) ➜ ៩៥៤ms ➜ `bl:sn · fo:sb` (∨) ➜ `vs:0→60` ➜ ០ ក្នុង ៨៣ms | ៦០pt |

**មូលហេតុ** ៖ `keepKeyboardFocusInPlace()` (A139 · A286) ទុក focus ដំបូងក្រោយ touchstart ក្នុង `NATIVE_TAP_FOCUS_MS` (១០០០ms) ជារបស់ការចុច ➜ ការអូស (រំកិលផ្ទាំង ៖ touchend
មិន cancelable) មិនដែល focus ➜ focus របស់ ∨ ក្រោយ ៦៤២/៩៥៤ms ក្លាយជា «focus របស់ការចុច» ➜ គ្មាន refocus ➜ `focusNextFocusedElement` គ្មាន preventScroll ➜ iPhone `forceScroll`។

**ការកែ** ៖ `tapFocusTouch` (ជំនួស `tapFocusPending`) ៖ id + ចំណុចចាប់ផ្តើម ➜ touchend រំកិលលើស `TAP_FOCUS_MOVE_MAX_PX` (៤៥ ៖ ការចុចដែលរំកិលតិចនៅជាការចុចរបស់ iOS ៖
`ios-accessory-focus` A139 អះអាងការអូស ៤០px ➜ iOS focus) ឬ `touchcancel` ➜ លែងមានការចុចរង់ចាំ ➜ focus បន្ទាប់ (∨/∧) ត្រូវ refocus `preventScroll` ក្នុង focus event។ ⚠️ ៤៥ ជាតម្លៃ
`allowableMovement` របស់ UIKit តាមការចងចាំ (មិនបានផ្ទៀងប្រភព) ៖ ការអូសដែលវាស់បាន (១០៧ · ១៤៩pt) លើសឆ្ងាយ។

**ភស្តុតាង** ៖ `ZoeW/tests/ios-adjusted-tap-focus.test.ts` +៦ (មុនកែធ្លាក់ ៤ · ក្រោយកែ ៤៣/៤៣) · mutation ៨ ➜ ចាប់ ៨ (ដក touchcancel · ដកការរំកិល · តែអ័ក្ស X · slop ១០ · `>=` · ៤៥ ➜ ២០០ ·
មិនប្រើការចុចរង់ចាំ) · ⏳ លើ iPhone ពិត។

### 2026-10-24 — A287 ៖ iPhone PWA ៖ ផ្ទាំង Sign · ZTO ៖ ស្លាក `label[for]` ក្នុងផ្ទាំងមិនត្រូវចាប់ ➜ ទំព័ររុញពេលចុចប្រអប់ឈ្មោះ · Barcode ➜ [2.50.145]

រាយការណ៍ម្ចាស់គម្រោងលើ preview [2.50.144] ៖ «ក្នុង modal sign នៅរុញទំព័រម្តងម្កាលដែរ ពេលចុច ប្រអប់វាយ ឈ្មោះ និង barcode» · probe [2.50.143] មិនប្រាប់ពេលផ្ទាំងបើក ➜ គ្មាន toast។
**ផ្លូវ (កូដ + ច្បាប់ WebKit A286)** ៖ ផ្ទាំង Sign មានស្លាក «👤 ឈ្មោះអ្នកទទួល» (`label[for=palmSignName]`) និង «⌨️ ម៉ាស៊ីនស្កេន ឬវាយ Barcode» (`label[for=palmSignBarcode]`) ពីលើប្រអប់ផ្ទាល់ ·
`iosPageTapFieldOf()` ផ្គូផ្គងស្លាក/⚡ តែរបស់ `hwScannerInput` ➜ ចុចលើស្លាក ឬក្បែរប្រអប់ (touch adjustment ៖ ស្លាកតូចជាង root React) ➜ `modalTapField(label)` = null ➜ touchend មិនចាប់ ·
mousedown សំយោគលើស្លាកក៏មិនចាប់ ➜ click របស់ស្លាក ➜ `control->focus()` គ្មាន preventScroll = ផ្លូវ ១ របស់ A286 ក្នុងផ្ទាំង។

**ការកែ** ៖ `iosTapFieldOf()` (ជំនួស `iosPageTapFieldOf()`) ៖ iOS standalone ៖ `label[for]` ក្នុង `.modal` ➜ ប្រអប់ដែលវាភ្ជាប់ក្នុងផ្ទាំងដដែល ➜ `modalTapField()` (ប្រភេទអត្ថបទ · ផ្ទាំងបើក) ·
`swallowCaughtClick()` លេប click របស់ស្លាកនោះ · Android មិនប្រែ (`usesIOSPanelHandoff()`)។ **probe** ត្រឡប់មកវិញ ហើយពង្រីក ៖ ផ្ទាំងបើកក៏ប្រាប់ (មុន ៖ `uiState.isModalOpen` ➜ ស្ងាត់) ·
ស្ថានភាពប្រអប់ ៖ touchstart លើប្រអប់ ឬ mousedown សំយោគពេល touch មិនលើប្រអប់ · ផ្ទាំង · កាត · `modalKeyboardFit` · `modalViewportTop/Height` · scroll capture (ផ្ទាំងបើក ៖ `restoreIOSDocumentScroll()`
ទាញ document ត្រឡប់ ០ ក្នុង scroll listener ដដែល ➜ listener ធម្មតាឃើញ ០)។

**ភស្តុតាង** ៖ `ZoeW/tests/ios-adjusted-tap-focus.test.ts` ស្លាក Sign ៖ មុនកែធ្លាក់ ២/៣ (ទិសផ្ទុយជាប់) · ក្រោយកែ ៣៧/៣៧ · `ZoeW/tests/ios-push-probe.test.ts` ១១ · mutation ៨ ➜ ចាប់ ៨
(ផ្ទាំងស្ងាត់ · scroll មិន capture · mousedown ជាន់ស្ថានភាព touchstart · `~` · `sn` · ក្បាលផ្ទាំង · ការផ្គូផ្គងស្លាកផ្ទាំង) · ⏳ លើ iPhone ពិត ៖ ផ្ទាំង Sign មិនរុញ ឬ toast ប្រាប់ផ្លូវផ្សេង។

### 2026-10-24 — A286 ៖ iPhone PWA ៖ toast 🔬 ពី iPhone ពិត ➜ ផ្លូវ ៥ ដែល focus គ្មាន `preventScroll` ទៅដល់ WebKit ➜ [2.50.144]

លទ្ធផល probe A285 ([2.50.143]) ពីម្ចាស់គម្រោង (iPhone · App លើ Home Screen · 390×844pt · ជុំ ១ ៖ ៧ រូប 4:54–4:58 · ជុំ ២ ៖ ៣ រូប 5:25–5:28) ៖

| # | ទំព័រ | tape (ms ធៀបការរុញ) | រុញ | មូលហេតុ |
|---|---|---|---|---|
| ១ | ស្កេន · កញ្ចប់ (×៣) | `ts:div#hardwareScannerBox`/`ts:div` `c0` ➜ `te` ~៩០ms `p0` ➜ `md:bc~` · `ck:bc~` · `ck:bc` · `fo:bc` ➜ `kb:0→304` · `vs`/`ws` ១៣៣ | ១៣៣pt នៅដដែល | ម្រាមដៃលើ div ក្បែរប្រអប់ ➜ App មិនចាប់ (គោលដៅ touch មិនមែនប្រអប់) ➜ WebKit ផ្ញើការចុចសំយោគទៅស្លាក `label[for]` ➜ ស្លាក focus ប្រអប់ (គ្មាន preventScroll) |
| ២ | ទិន្នន័យ · ស្កេន Locker | `ts:div` ➜ `te p0` ➜ `md:ph`/`md:sr` ➜ `fo` ➜ `vs` ២១៨/៣៤៥ ➜ ០ ក្នុង ៣៦–៤៩ms | ២១៨–៣៤៥pt មួយភ្លែត | ដូច ១ ៖ mousedown ផ្ទាល់លើប្រអប់ស្វែងរក ➜ focus លំនាំដើម |
| ៣ | ទិន្នន័យ (ក្រោយ App Lock) | `fo:input#appLockPinInput` (កូដ ៖ គ្មាន keyboard) ➜ `ts:input#appLockPinInput` ➜ `te p0` ➜ `md` · `ck` ➜ `kb:0→240` · `vs`/`ws` ១៩៧ | ១៩៧pt | ប្រអប់ PIN មិនមែនប្រអប់ដែល App ចាប់ ➜ mousedown refocus (`elementDidRefocus` ជម្រើសលំនាំដើម) ជំនួស focus មុន keyboard បង្ហាញ |
| ៤ | ស្កេន · កញ្ចប់ | `ts:bc` ➜ `te p1` (ចាប់ ✓) ➜ `fo:bc` ➜ `kb:0→403` ➜ ~៩៧០ms ➜ `bl:bc` · `fo:sr` (គ្មាន touch ៖ ∨) ➜ `vs` ២៧៧ ➜ ០ | ២៧៧pt មួយភ្លែត | `keepKeyboardFocusInPlace()` រំលងគ្រប់ focus ក្នុង `NATIVE_TAP_FOCUS_MS` (១០០០ms) ក្រោយ touch ➜ focus របស់ ∨ ក្លាយជា «focus របស់ការចុច» |
| ៥ | ស្កេន · ដក | `bl:win` · `fo:win` · `fo:bc` (WebKit ស្តារ focus) ➜ `kb:403→0` ➜ `បាកូដ mr f1 k0 t1` ➜ `ts:bc` ➜ `te p0` ➜ `md:bc` · `ck:bc` ➜ `vs` ១៩៦ | ១៩៦pt | `modalTapFocused` នៅចាំ (WebKit បញ្ជូន `focus` តែគ្មាន `focusin`) ➜ «ប្រអប់ focus រួច · ចុចរួច» ➜ ទុកឲ្យ iOS ខណៈ keyboard បិទ |

**ប្រភព WebKit (`main` · `webkitgtk-2.48.0`)** ៖ `attemptSyntheticClick` ➜ `nodeRespondingToClickEvents` (touch adjustment ៖ ធាតុ «ឆ្លើយការចុច» ជិតបំផុត ៖ ប្រអប់វាយឈ្នះភ្លាម · ស្លាកតូចជាង root
React) ➜ `completeSyntheticClick` (`m_userIsInteracting` = true ➜ focus ដោយ JS ក្នុង mousedown បង្ហាញ keyboard) · `elementDidFocus` ទុក `m_pendingFocusedElementUpdate` (ជម្រើសរបស់ focus
ចុងក្រោយ ខណៈ keyboard មិនទាន់បង្ហាញ ៖ `shouldDispatchUpdateAfterFocusingElement`) · `completeSyntheticClick` សម័យនេះ **គ្មាន** `elementDidRefocus` ចុងក្រោយទៀតទេ ➜ focus `preventScroll`
ក្នុង mousedown + លេប click របស់ស្លាក = ព័ត៌មានដែលផ្ញើមាន preventScroll។

**ការកែ** ៖ `focusSyntheticTapField()` (`mousedown` capture ៖ touch ចប់ ≤ `CAUGHT_CLICK_MS` · គ្មានម្រាមដៃ · ប៊ូតុងឆ្វេង · iOS standalone) ➜ `catchIOSSearchSyntheticTap()` (ប្រអប់ស្វែងរក ៖
ផ្លូវដូច touchend) ឬ `modalTapField()` ➜ `focusCaughtField()` (រួមជាមួយ touchend ៖ blur ពេល focus រួច · `caughtClick` លេប click) · `.app-lock` ពេលចាក់សោ + PIN នៅពីលើ keyboard ដែលរំពឹង ➜ ចាប់
(ផ្លូវ ៣) · `appLockPinFocusOptions()` ➜ focus ដោយកូដ `preventScroll` (boot ចង ៖ `app-lock.ts` import `modal-keyboard` ➜ រង្វង់ `panel-motion` ➜ `phone-suggest` ➜ … ➜ `app-lock`
ធ្វើឲ្យ `IOS_SEARCH_PULLDOWN_SETTLE_MS` = NaN ក្នុង `ios-search-pulldown`) · `tapFocusPending` ៖ តែ focus ដំបូងក្រោយ touchstart ជារបស់ការចុច (ផ្លូវ ៤) · window `blur` ➜ ភ្លេច
`modalTapFocused` លើ iOS (ផ្លូវ ៥)។ Android មិនប្រែ។

**ភស្តុតាង** ៖ `ZoeW/tests/ios-adjusted-tap-focus.test.ts` ៣៤ (មុនកែធ្លាក់ ១៨) · mutation ៣៥ ➜ ចាប់ ៣៤ (នៅរស់ ១ ៖ blur មុន focus របស់ `focusCaughtField()` ដែលមានតាំងពីមុន —
`ios-synthetic-click-focus` · `modal-keyboard` ក៏មិនចាប់ ៖ ម៉ូដែល jsdom មិនបែងចែក focus ថ្មី ↔ refocus) · ⚠️ Chromium មិនបង្កើតការរុញរបស់ WebKit ➜ ⏳ ផ្ទៀងលើ iPhone ពិត ([2.50.144])។
probe (`ios-push-probe.ts` · `ZoeW/tests/ios-push-probe.test.ts`) ដកចេញ ៖ ស្តារពី `12e6b03` បើត្រូវវាស់ផ្លូវថ្មី (➜ A287)។

### 2026-10-24 — A285 ៖ iPhone PWA ៖ ទំព័រស្កេនរុញឡើងទាំង navbar ម្តងម្កាល — រូបថតអេក្រង់ + ប្រភព WebKit ➜ probe [2.50.143]

រាយការណ៍ម្ចាស់គម្រោង (preview PR #348 · App ផលិតកម្ម 2.50.141 ក៏មាន) ➜ ផ្នែក ១ [2.50.143]។ **រូបថត ២ (11:40 · របៀប «បញ្ចូលកញ្ចប់» · ផ្ទាំងសុំសិទ្ធិកាមេរ៉ា ·
keyboard អង់គ្លេស + របារ ∧ ∨ ✓ iOS 26 · ស៊ុម 591×1280 ≈ 1.5px/pt)** ៖ (១) កន្លែងវាយ Barcode focus ➜ ទំព័រទាំងមូលរុញ ~១០០pt (បាត navbar ~១០pt · ប៊ូតុងរបៀបនៅក្រោមម៉ោង) ·
ប្រអប់ ~២៥៤–២៨៥pt ជិតកណ្តាលផ្ទៃពីលើ keyboard។ (២) ចុចប្រអប់ស្វែងរក ➜ ផ្ទាំងស្កេនបង្រួម (ត្រឹមត្រូវ) តែប្រអប់ស្វែងរកនៅ ~៨៧pt ក្រោមរបារស្ថានភាព · navbar នៅក្រៅអេក្រង់ ➜
ការរុញពី (១) នៅដដែល (ការចាប់ស្វែងរក `focus({ preventScroll })` មិនរំកិល · visual viewport ដែលរុញមិនត្រឡប់ខណៈ keyboard បើក · `scrollWindowToTop()` រំកិលតែ layout viewport)។

**ប្រភព WebKit (`main`)** ៖ `_zoomToRevealFocusedElement` ចេញតែពេល `_focusedElementInformation.preventScroll` · iPhone ៖ `forceScroll:[self requiresAccessoryView]` ➜
`_zoomToFocusRect` រំលង «មើលឃើញហើយ» ហើយដាក់ប្រអប់នៅកណ្តាលផ្ទៃពីលើ keyboard (`_zoomToCenter … honorScrollability:NO`) = រូប (១)។ `Element::dispatchFocusEvent` ៖ ព្រឹត្តិការណ៍ `focus`
មុន `elementDidFocus` (`DispatchFocusEventBeforeNotifyingClient`) · `WebPage::elementDidFocus` ទុក `m_pendingFocusedElementUpdate` ដែល focus/refocus ក្រោយជំនួសជម្រើស ខណៈ keyboard
មិនទាន់បង្ហាញ (`shouldDispatchUpdateAfterFocusingElement`) ហើយផ្ញើពេលចុចសំយោគចប់ (`completeSyntheticClick` ➜ `flushPendingFocusedElementUpdateIfNeeded`) · ប្រអប់ដដែល
(`_isSameAsFocusedElement`) ➜ `accessoryOpen` ➜ ការបង្ហាញប្រើព័ត៌មាន focus **ចាស់** (មិនជំនួស) ➜ ការរុញ = focus មួយគ្មាន `preventScroll` ទៅដល់ WebKit។

**ផ្លូវដែលអាចលេច (មិនទាន់វាស់)** ៖ ការចុចដែល App មិនចាប់ (> `MODAL_TAP_MAX_MS` · > `MODAL_TAP_SLOP_PX` · `touchend` មិន cancelable · keyboard ដែលចាំប៉ាន់ថាបាំងប្រអប់ ៖
ប្រភេទ `text` ចែកជាមួយប្រអប់ស្វែងរក ➜ keyboard ខ្ពស់ជាង (ភាសាផ្សេង) ដែលចាំពីការស្វែងរក · `modalFocusRefused`) · ចុចដែលចាប់តែ focus គ្មាន `preventScroll` មកជំនួសមុនផ្ញើ ·
ផ្លូវ WebKit ផ្សេង ➜ ការអានកូដសម្រេចមិនបាន (Forbidden zone ៖ វាស់មុន) ➜ probe [2.50.143] (`ios-push-probe.ts`) ៖ toast 🔬 លើ preview · Chromium មិនបង្កើតការរុញរបស់ WebKit ➜
ការផ្ទៀងលើ iPhone ពិតតែប៉ុណ្ណោះ ➜ លទ្ធផល · ការកែ ➜ A286។

### 2026-10-23 — A284 ៖ CI PR #348 ៖ `tests/native/scan-beep.test.ts` (Java ពិត) ហួសពិដាន vitest ៥ វិ.

CI run `39984306123` (commit `99b2b80` ៖ កែតែ `docs/HISTORY.md`) ផ្នែក ២/៤ ធ្លាក់ ១ ៖ `zoew-suite 1/2` ➜ `scan-beep.test.ts` «Java ពិត …» ៖ «If this is a long-running test, pass a timeout
value…» · commit មុន (`24fb3b7` ៖ កូដដដែល) ៤/៤ ជាប់ ➜ មិនមែនពីការកែ។ **មូលហេតុ** ៖ តេស្តចងក្រង Java ដោយ `javac` (ពិដាន `execFileSync` ២០ វិ.) ហើយរត់ Probe (១០ វិ.)
តែតេស្តខ្លួនឯងប្រើពិដានលំនាំដើម vitest ៥ វិ. ➜ runner រវល់ ➜ `javac` លើស ៥ វិ.។ **ការកែ** ៖ ពិដានតេស្ត ៤០ វិ. (> ២០ + ១០) ➜ ពិដានខាងក្នុងបាញ់មុន (សារច្បាស់) ·
ក្នុង session ៩/៩ ✅ · ⛔ មិនប៉ះ `ScanBeepPlugin.java` ឬការអះអាង។

### 2026-10-23 — A283 ៖ APK · Sign ZTO ៖ ចុចកន្លែងវាយ Barcode ➜ WebView រំកិលទំព័រទាំងមូលមួយភ្លែត (`ScrollFocusedEditableElementIntoView`) ➜ [2.50.142]

រាយការណ៍ម្ចាស់គម្រោងលើ APK សាក `2.50.142-test.2e332ab` (A282) ៖ «modal ទាំងអស់ពេល keyboard លោតមករអិល smooth ល្អហើយ តែ ... modal Sign ពេលចុចកន្លែងវាយបញ្ចូល barcode
ដោយដៃ វាកន្ត្រាក់រុញឡើងទាំងទំព័រមួយភ្លែត» · Chrome Android preview ៖ រលូនល្អ។

**មូលហេតុ (ប្រភព Chromium `web_frame_widget_impl.cc`)** ៖ `ScrollFocusedEditableElementIntoView()` (១) ចេញភ្លាមពេល focus ចុងក្រោយរបស់ document មាន
`preventScroll` (`GetFocusOptions()->preventScroll()`) · (២) រត់រាល់ការប្តូរ visual properties ដែលមាន `scroll_focused_node_into_view` («used only for WebView») ➜ APK រាល់ resize ·
(៣) ដាក់ caret នៅកណ្តាល (`ScrollAlignment::CenterIfNeeded`) តាម `AbsoluteBoundingBoxRect()` ដែលរាប់ `transform` ➜ ពេលកាតកំពុងរអិល (ឬ inset ចាស់ពេល hold ចប់ ៖ A282 ·
[2.50.141]) ប្រអប់វាយដែលនៅទាបក្នុងកាតវែង (Sign ៖ កាមេរ៉ា · បញ្ជីកញ្ចប់ · ឧបករណ៍ · ទម្រង់ Barcode ខាងក្រោម) ហាក់ដូចត្រូវ keyboard បាំង ➜ visual viewport រំកិលទាំងទំព័រ ➜
WebView បង្រួម ➜ pan ត្រឡប់ ០ = «កន្ត្រាក់មួយភ្លែត»។ [2.50.141] រក្សាកាតនៅនឹងពេល pan តែទំព័រក្រោយ backdrop នៅតែរំកិល · ច្បាប់ចាស់ «Android ៖ ប្រអប់វាយក្នុងប្រអប់ ➜ native»
ហើយ (ឋ) អះអាង native tap (`ends[0] === false`) ដែលជាប់លើកូដមុនកែ។

**ការកែ** ៖ `noteModalTouchStart()` ៖ APK (`isNativeAndroid()`) ចាប់ការចុចប្រអប់វាយក្នុងប្រអប់ដូច iOS (touchend `preventDefault` + `focus({ preventScroll })` ៖ caret ចុង) ➜
`GetFocusOptions()` មាន `preventScroll` ➜ WebView មិនរំកិលទំព័រទៀតទេ (ទាំងពេល keyboard លោត និងពេល WebView បង្រួម) · `focusModalFieldWithoutScroll()` ៖ Android ➜
`revealFocusedModalField()` (WebView លែងរមូរប្រអប់វាយក្នុងកាតឲ្យ ៖ ចុចប្រអប់ផ្សេងពេល keyboard បើក) · ប្រអប់ដែល focus រួច + keyboard បើក ➜ native (caret តាមកន្លែងចុច) ·
`pointerdown` · `focusin` (កំណត់ `keyboardOpen`) នៅរត់ · Chrome Android មិនប្រែ (រលូនល្អ · autofill/password manager នៅលើការចុចពិត)។

**ភស្តុតាង** ៖ `ZoeW/tests/modal-keyboard.test.tsx` «APK ➜ ចុចប្រអប់វាយក្នុងប្រអប់» ៖ មុនកែធ្លាក់ ១/៥៨ · ក្រោយកែ ៥៨/៥៨ · `modal-keyboard-device-test` (ឋ) ៖ native tap ➜
ចុចត្រូវចាប់ + focus `preventScroll` (Sign ៖ ឈ្មោះ · Barcode × ៤ ឧបករណ៍) · keyboard បើក ➜ ចុច Barcode ដែលលេចតែគែមលើ ➜ App រមូរវាចូលក្នុងកាត · pan ០ (ទូរស័ព្ទ ៣ ករណី) ·
ផ្នែក ១–៤ ១៦ · ៧៤ · ២៧ · ៦៩ · `modal-keyboard-test` ១៨ · ១៦ · ៤០ ✅។ ⚠️ Chromium desktop មិនមាន IME ➜ មិនអាចបង្កើត pan ពិតរបស់ WebView ➜ អ្នកយាមវាស់លក្ខខណ្ឌដែល
Chromium ពិនិត្យ (focus `preventScroll`) · ✅ ម្ចាស់គម្រោងបញ្ជាក់លើ APK សាក `2.50.142-test.24fb3b7` ៖ «wow អេមហើយ»។

### 2026-10-23 — A282 ៖ ចលនាប្រអប់តាម keyboard ៖ `composite: 'add'` មិនដែលទៅ compositor · ប្តូរគោលដៅកណ្តាលចលនាចាប់ពីស្ងៀម · ផ្ទៃងងឹតបាំងបាតកាត ➜ [2.50.142]

Baseline `95db8ecc` (PR #347 បាន merge)។ សំណើម្ចាស់គម្រោង (គ្មានវីដេអូ) ៖ «គ្រប់ modal ពេលបើក keyboard អោយមានចលនារអិល smooth ស្របជាមួយ keyboard កុំអោយអាក់អាក់
ទាំង PWA ios android, apk»។ វាស់លើ App ពិត (audit build) ក្នុង Chromium ពិត · keyboard ក្លែង (`FAKE_VIEWPORT`) · bridge APK ក្លែង · trace Chromium ពិត ៖

**មូលហេតុ (វាស់)** ៖
1. `glideModalCard()` លេង `transform` ដោយ `composite: 'add'` ➜ trace (`blink.animations` ៖ ព្រឹត្តិការណ៍ `Animation`) លើ `DIV class='modal-content'` ៖ `compositeFailed` 80
   (= 16 `kEffectHasNonReplaceCompositeMode` + 64 `kTargetHasIncompatibleAnimations`) គ្រប់ឧបករណ៍ (APK · Chrome Android · iPhone · iPad) ➜ ចលនារត់លើ main thread
   ដែលរវល់ React commit · layout · `visualViewport` resize ពេល keyboard លោត។ ប្រភព Chromium `compositor_animations.cc` ៖ keyframe ណា `Composite() != kCompositeReplace`
   (មិន neutral) ➜ មិនដាក់លើ compositor។ ⛔ WebKit (iPhone) មិនបានវាស់ផ្ទាល់ ៖ ការកែធ្វើឲ្យ `replace` ដែលទាំងពីរម៉ាស៊ីនដាក់លើ compositor បាន។
2. keyboard ប្តូរកម្ពស់ ៤០% ចូលចលនា ➜ ចលនាថ្មីចាប់ពីទីតាំងត្រូវ តែល្បឿនតាម easeOutCubic ពីស្ងៀម ➜ វាស់លើ Web Animations ពិត (`currentTime` ក្នុង task តែមួយ ·
   ផលដកលំដាប់ ២ ៖ មិនពឹងស៊ុម CI) ៖ APK 412×915 −0.391 ➜ −1.139 px/ms (×2.9) · APK tablet 1280×800 −0.425 ➜ −0.776 · Chrome 360×740 −0.352 ➜ −0.618 = ឈប់ហើយស្ទុះ។
3. ស្រទាប់ក្រោយ keyboard (`.modal::after`) លេចភ្លាមនៅបន្ទាត់ keyboard ខណៈកាតនៅរអិលពីក្រោម ➜ ស្រទាប់ (គូរពីលើកាតតាមលំដាប់) បាំងបាតកាតនៅស៊ុមដំបូង ៖
   APK tablet 69px (បាតកាត 508.7 · ស្រទាប់ 440) · Chrome 360×740 33px · iPhone 15px · iPad 8px ➜ កាតមើលទៅដូច «ត្រូវកាត់» រួចលេចឡើងវិញ។

**ការកែ** ៖ `startGlide()` ៖ `replace` · keyframes `transform` តែមួយ (`add` តែពេល animation ផ្សេងកំពុងរត់លើកាត ៖ pop-in) · `glideMotion()` អានទីតាំង/ល្បឿនពី
`currentTime` + cubic-bezier របស់ចលនាខ្លួនឯង (មិនមែន rect) · `glideCurveFrom()` ៖ ល្បឿនក្លាយជាចំណុចត្រួតពិនិត្យទី ១ (`y1 = slope × x1` ក្នុង [0, 1] ➜ មិនហួស · មិនថយ) ·
Android ៖ `MODAL_GLIDE_ANDROID_MS` 285 · `MODAL_GLIDE_ANDROID_CURVE` (0.2, 0, 0, 1) = `InsetsController` `ANIMATION_DURATION_SYNC_IME_MS` · `SYNC_IME_INTERPOLATOR`
(APK មាន `WindowInsetsAnimation.Callback` ➜ ផ្លូវ sync) · iOS រក្សា `MODAL_GLIDE_MS` 250 (ខ្សែកោង keyboard UIKit មិនបានវាស់) · `glideKeyboardLayer()` ៖
`pseudoElement: '::after'` រអិលពី `innerHeight − modalViewportHeight` (កំពូលស្រទាប់ = បាតអេក្រង់ ទោះមាន safe-area) ដោយពេលវេលាកាតដែលចាប់ផ្តើមក្នុងការវាស់ដដែល ➜
វឌ្ឍនភាពតែមួយ ➜ គម្លាត (កំពូលស្រទាប់ − បាតកាត) = បន្សំលីនេអ៊ែរនៃតម្លៃមិនអវិជ្ជមានពីរ ➜ មិនដែលកាត់ · គ្មាន `KeyframeEffect.pseudoElement` ➜ មិនរអិល (Chrome 84 ·
Safari 14 ៖ option `pseudoElement` មកជាមួយគ្នា · MDN BCD)។

**ការសាកដែលបដិសេធ** ៖ (ក) ដាក់ស្រទាប់ក្រោមកាត (`z-index: -1`) ➜ `modal-keyboard-test` «ផ្ទៃក្រោយ keyboard ពណ៌តែមួយ» ធ្លាក់ ២៦/២៦ ករណី (គម្លាតពណ៌ 14 ៖
ស្រមោលកាត `0 18px 40px -12px` លេចលើស្រទាប់ក្រោមបន្ទាត់ keyboard) ➜ ដកវិញ · ច្បាប់ ⛔ ក្នុង `CLAUDE.md`។ (ខ) ផលដកទៅមុខ ៤ ms អានល្បឿនខ្សែកោងថ្មីលើស ~14%
(ខ្សែកោងបង្កើនល្បឿនភ្លាមក្រោយចាប់ផ្តើម ៖ APK 412×915 អាន 0.284 ➜ 0.333 ទោះទីតាំងត្រូវ 0.01px) ➜ ផលដកលំដាប់ ២។

**ភស្តុតាង** ៖ `ZoeW/tests/modal-keyboard.test.tsx` +៨ ៖ មុនកែ ៨ ធ្លាក់/៥៧ · ក្រោយកែ ៥៧/៥៧ · `modal-keyboard-device-test` (ឆ) ៖ មុនកែ ៩ ធ្លាក់ (ថេរ ១ · compositor ៥ ·
ល្បឿន ៣) · ក្រោយកែ ២៧/២៧ (trace ៖ `compositeFailed` ០ · ស្រទាប់ចាប់ពីបាតអេក្រង់ · មិនកាត់បាតកាតគ្រប់វឌ្ឍនភាព · ល្បឿនខណៈប្តូរ APK 412×915 −0.292 ➜ −0.286 ·
APK tablet −0.318 ➜ −0.314 · Chrome 360×740 −0.264 ➜ −0.260 px/ms) · ផ្នែក ១/២/៤ ១៦ · ៧៤ · ៦៤ · `modal-keyboard-test` ១–៣ ១៨ · ១៦ · ៤០ (រួមពណ៌តែមួយក្រោយ keyboard)
✅ (Chrome Windows ក្នុង session)។ ⏳ ផ្ទៀងលើ iPhone/Android ពិត ➜ ផ្នែក ១ [2.50.142]។

### 2026-10-23 — APK · Sign · ZTO ៖ native viewport pan ក្រោយ WebView បង្រួម ➜ [2.50.141]

Baseline `bd4fd201` (PR #346 បាន merge)។ វីដេអូ `Screenrecorder-2026-10-23-19-17-42-331.mp4` ពី Xiaomi 14 Ultra APK បង្ហាញកាតលោតឡើងរួចត្រឡប់។ ការបង្កើតករណីឡើងវិញក្នុង Chromium ជាមួយ native bridge ក្លែង៖ WebView បង្រួមរួច (`keyboardOpen = true`) ប៉ុន្តែ visual viewport នៅមានកម្ពស់ចាស់ ហើយ `offsetTop = 100` រយៈពេល ៨០ms ➜ កំពូលដែលមើលឃើញ `39.08 → −60.92 → 39.08px`; `scrollTop` ក្នុងកាតនៅ ១៨២ ដដែល។ នេះជាការលោតកាតទាំងមូល មិនមែនការរមូរទៅវាលខាងក្រោមទេ។ តម្លៃនេះវាស់ពី reproduction មិនមែនទាញលេខពីវីដេអូឧបករណ៍ពិតទេ។

មូលហេតុ៖ `keyboardVisibleViewport()` ចេញ `null` ពេល layout បង្រួម ដើម្បីមិនដក IME inset ពីរដង; `modalKeyboardViewport()` ប្រើលទ្ធផលនោះទាំងស្រុង ទើបបាត់ offset នៃ native pan។ ការកែបន្ថែម native positive-pan view ដែលប្រើ `innerHeight` ពេញ និងប្ដូរ fit ដែលមានរួចតាមភាពខុសគ្នានៃ offset មុនផ្ទៀងព្រំដែន។ ដូច្នេះទីតាំងទាក់ទងនឹងអេក្រង់ និងពិដានកម្ពស់ដែលបានរក្សានៅដដែល ទាំងពេល pan កើន និងត្រឡប់សូន្យ។ `keyboardCover` នៅសូន្យ ហើយ native tap មិនត្រូវបានចាប់ជំនួស។

ចន្លោះអ្នកយាមចាស់៖ បញ្ជី input ត្រូវបានអានមុនបើក Sign form ដែល mount តែពេលប្រអប់បើក ហើយការសាក shrink រង់ចាំចលនាចប់រួច។ `modal-keyboard-device-test` បន្ថែម form ពិត + parcel មួយ និង native tap លើវាលឈ្មោះ/barcode, WebView បង្រួមកណ្តាលចលនា និង pan `12→28→90→110→70→0`។ Baseline ធ្លាក់ ៨ checks; `ZoeW/tests/modal-keyboard.test.tsx` មុនកែ ៤៨ PASS/១ FAIL ហើយក្រោយកែ ៤៩/៤៩។ ការពិនិត្យឯករាជ្យបន្ថែមករណី keyboard រាយការណ៍ ៤១០px រួចស្ងប់ ៣៣០px៖ កាតដែលរក្សាកម្ពស់ ៣៧៤px មិនត្រូវរីកដល់ ៤៤២px ពេល pan ទេ; checker គ្របករណីនេះផង។ ក្រុម browser ថ្មីចុងក្រោយ ៤៣/៤៣ PASS (រាប់ទាំងការគ្របផ្នែក checker); unit ៤៩/៤៩ PASS។ ទិសផ្ទុយ PWA Android និង iOS រក្សាកម្ពស់ visual viewport ដើម។ ការផ្ទៀង APK ពិតនៅជាសកម្មភាពដោយដៃខាងផ្នែក ១។

### 2026-10-23 — Modal និងប្រាក់ពេលបាត់ចម្លើយ server ➜ [2.50.140]

ការពិនិត្យថ្មីលើ baseline `d4fef191` រួម modal/scroll/focus/resize, សំណើគ្រប់គ្រងស្ទួន, manual adjustment, pickup ownership និង Supabase recovery។ ZoeKeyGen Chromium matrix ៤ viewport × ២ reduced-motion modes រួម modal ៦ និង nested/busy cases៖ ៥៣២/៥៣២; admin ជាមួយ Postgres ពិត ១៦០/១៦០។ ZoeW numeric input ក្នុង Chromium ១០/១០ (មុនកែ ៩ ធ្លាក់) បញ្ជាក់ថា `badInput` អាចធ្វើឱ្យ `.value` ទទេ ហើយការអានតែតម្លៃនឹងបាត់ input ខូច។

CI ចាប់ការភ្ជាប់ baseline និង file coverage របស់អ្នកយាមថ្មីដែលខ្វះ; បានបំពេញទាំងពីរ។ `fluid-type-focus-test` មាន pointer probe ក្រៅប្រអប់ ខណៈ PIN នៅបើក ហើយ focus trap ថ្មីទប់ត្រឹមត្រូវ។ Fixture បិទប្រអប់តាម App និងផ្ទៀងថាគ្មានប្រអប់បើក មុនសាកម៉ៅស៍; លក្ខខណ្ឌថាប៊ូតុងត្រូវទទួល focus ហើយគ្មាន outline ពី mouse នៅដដែល។

Ledger មានចន្លោះដែល checker ចាស់អះអាងតែ `ok:false`៖ សំណើបាន commit តែបាត់ ACK ហើយ REST អានមិនបាន ➜ `unknown` មាន delta សូន្យ ➜ correction ស្មានថាមិនបានសរសេរ ហើយសរសេរស្ទួន។ ការកែទប់ទាំង correction និង alignment នៅពេលគ្មានភស្តុតាង រក្សា unknown ពី promise rejection និងការកែដែលមិនច្បាស់លាស់។ `ledger-unknown-no-retry.test.ts` ដំបូងធ្លាក់ ២១ ករណីមុនកែ; matrix ចុងក្រោយ ២៩/២៩ និងក្រុម ៦ files ៥៩/៥៩។

`tx-outcome-test` ឥឡូវផ្ទៀងទាំងទឹកប្រាក់ COD/DOD, ចំនួន និងចំនួនការសរសេរ ពេលបូក/ដក លើថ្ងៃ/ខែ/ទាំងពីរ និង corrective write ដែលបាត់ចម្លើយ៖ ១៤៦/១៤៦។ `ledger-failed-apply-revert-test` ៥០/៥០ · `monthly-ledger-agreement-test` ២៨/២៨ · Chromium `ledger-clamp-symmetry-test` ១៣/១៣។ Record ចាស់គ្មាន token ដែលមិនអាចបញ្ជាក់សំណើមិនដល់ នៅតែ pending ជំនួសការទាយដកបន្ថែម; មិនអះអាង automatic completion ពេលភស្តុតាងបាត់ទេ។

### 2026-10-23 — Deep audit ៖ លទ្ធផល async ត្រូវជារបស់ operation និងវគ្គដែលនៅមានសិទ្ធិ

Baseline `b233b4bc` មាន Audit CI ទាំង ៤ ផ្នែកជោគជ័យ។ ការសាកល្បងថ្មីខាងក្រោមបង្ហាញចន្លោះដែល baseline មិនទាន់វាស់; លទ្ធផល selected checks មិនត្រូវបានហៅថា full CI green ទេ។

| លេខ | កំហុសដែលបញ្ជាក់ | ការកែ និងភស្តុតាង |
|---|---|---|
| A273 | PIN/biometric/setup ឆ្លើយក្រោយបោះបង់ ឬបើកសកម្មភាពថ្មី; Forget PIN ពេល verify កំពុងរង់ចាំអាចស្តារសម័យដោះសោចាស់ | `pin-flow-race.test.ts`៖ regression ដំបូង ៥ ធ្លាក់/៦; ករណី Forget PIN ក៏ធ្លាក់មុនកែ។ Generation + action + modal + hash fences; regression ចុងក្រោយ ៩/៩។ `pin-prompt-test` ៩១ · `biometric-unlock-test` ៥៤ · `lookup-prefetch-test` ២៧០។ Fixtures VM បន្ថែម helper និងប្រអប់ PIN បើកពិត ដោយរក្សា assertions។ `zto-sync-banner-test` ប្តូរពីព្រំដែន ៩០០ តួអក្សរទៅ AST ក្នុង function ពិត និង mutation controls; fixture App Lock មាន hash PIN ពិត៖ ២០៦ PASS។ `lookup-freshness-test` វាស់ការដាក់ derived key ពិតជំនួស exact-expression string ជាមួយ positive/negative controls៖ ១៩២ PASS។ |
| A274 | Pickup repair របស់ទិដ្ឋភាពចាស់អាចជាន់សំណុំ barcode/លេខទូរស័ព្ទថ្មីនៅចំនួនដដែល | `pickup-repair-race.test.ts` មុនកែ ៤ ធ្លាក់/៩; ក្រោយកែ ៩/៩ និងក្រុមពាក់ព័ន្ធ ៩៥/៩៥។ រក្សា genuine identities, អនុញ្ញាត placeholder migration, CAS record ដើម និង session fence ក្នុង updater។ History/trash និង pickup ជា node ផ្សេងៗនៅឡើយ; មិនអះអាង root-atomic migration ទេ។ |
| A275 | Supabase `accessToken()` មិនបញ្ចប់ session ពេល tab ខក logout event ហើយ storage បាត់ | `supabase-cross-tab-signout.test.ts` regression បរាជ័យមុនកែ; `supabase-auth-unavailable.test.ts` មានទិសផ្ទុយ session នៅក្នុង storage + refresh 503។ ក្រុមពាក់ព័ន្ធ ៣១/៣១។ |
| A276 | Refresh បញ្ជី Key/ហាងក្នុងវគ្គដដែលឆ្លើយខុសលំដាប់ អាចជាន់ revoked/extended state ឬ error ថ្មី | `keygen-session-security-test` មាន deferred real-function probes៖ មុនកែ ៦ FAIL; owner token ក្រោយកែ ១៧៨/១៧៨។ Reset owner ពេល logout និង admin reset; `state-hygiene`៖ state ៧៣ មាន reset ៧០ និង accepted ៣, គ្មានខ្វះ។ `keygen-supabase-admin-test` ជាមួយ Postgres ពិត ១០៩/១០៩។ |
| A277 | Print បរាជ័យទុក report/title ជាប់; native return event ពី job ចាស់អាចលុប report ថ្មី ហើយ resume មុន listener handle ត្រៀមអាច throw | `print-relayout.test.tsx` មុនកែ ៣ FAIL; `native/print-operation.test.ts` seam ពិតមុន platform fix ៤ FAIL/៦។ Owner token ក្នុង export និង predicate នៅព្រំដែន import/listener/event ក្នុង `file-output.ts`; ក្រុមចុងក្រោយ ២៥/២៥។ `label-print.test.tsx` នៅគ្របផ្លូវស្លាក។ |
| A278 | ZoeKeyGen SW ទទួល HTML fallback 200 ជា asset នៅច្រក install/revalidate/miss | `sw-revalidation-timeout.test.ts` regression មុនកែ ៤ FAIL; ក្រោយកែ ២៨/២៨។ `sw-install-integrity-test` ៥៩ · `sw-cache-failure-test` ៤៤ · `sw-cache-key-test` ២៧។ ពិនិត្យ Content-Type តាម asset key ទាំង ៤ ច្រក; core install បដិសេធ shell ខុស។ |
| A279 | Request body លើសទំហំ តែ `await reader.cancel()` ព្យួរ ធ្វើឱ្យ register/reset មិនឆ្លើយ 413 | `supabase-functions-test` មុនកែ ១ FAIL/២៣៤; ក្រោយកែ ២៣៥ PASS រួម mutation ដែលដាក់ await វិញហើយក្រហម។ Cancel នៅតែហៅ ហើយ rejection មាន handler; មិនរង់ចាំវាមុន HTTP response។ |
| A280 | Activation A យឺតជាន់ activation B ឬស្តារ record ក្រោយ deactivate ក្នុង App ទាំងពីរ | `license-record-race-test` extended baseline ២៤ FAIL; positive control getStatus metadata រកឃើញ regression ក្នុងការកែដំបូង ១៦ FAIL។ Final owner + stable identity + `activationId` ចៃដន្យក្នុង local record រក្សា normal metadata writes និងការពារ same-key cross-tab activation; ក្រោយកែ ១៤០/១៤០។ Shared `license-verify.js` byte-identical; legacy record នៅអានបាន។ |
| A281 | ZXing/native decode ចាស់ឆ្លើយក្រោយ stop/restart camera អាចបញ្ជាក់ fresh frame តែមួយ ឬបន្ត loop ចាស់ | `scan-camera-session.test.ts` មុនកែ ២ FAIL/៤; ក្រោយកែ camera ក្រុម ៤ files/១៧ tests PASS។ Request id + stream identity fences នៅមុន/ក្រោយ decode និងការកំណត់ loop បន្ទាប់; bitmap cleanup នៅក្នុង finally។ |

### 2026-10-23 — A272 ៖ CI PR #343 ៖ `zto-palm-list-e2e` «hint ចាស់ 120» ៖ App កាត់ទំព័រ hint Palm តែពេលទំព័រ ១ ឆ្លើយ

CI លើ PR #343 (`19ceaf3` ៖ កែតែតេស្ត) ផ្នែក ២/៤ ធ្លាក់ ១ ៖ `zoew-suite` ➜ `tests/zto-palm-list-e2e.test.tsx` «⏱ hint ចាស់ 120 ទំព័រ · stock 950» ៖
`expected [...] to not include 'list:5:9'` · `main` `641547d` និង PR #342 ជាប់ ➜ comment លើ PR (មិនមែនពី PR នេះ · ការកែស្នើ) · រត់ផ្នែកនោះម្តងទៀតម្តង ៖ ជាប់ ➜ ៤/៤។

**មូលហេតុ (វាស់)** ៖ `fetchZtoPalmListAllPages()` ដាក់ទំព័រ ១ (tab `3` · `5`) និងទំព័រ hint ២..N ពីការទាញមុន (`ztoPalmPageHint()`) ក្នុងជួរតែមួយ ហើយ
`trimPageHints()` (កាត់ទំព័រ/tab hint ដែលលើសចំនួន ZTO រាយការណ៍) រត់តែក្នុង `if (entry.first)` ➜ ពេលទំព័រ ១ ឆ្លើយក្រោយទំព័រ speculative (CI រវល់) worker ដែល
ទំព័រ speculative ឆ្លើយរួចយកទំព័រ hint បន្ទាប់ (ទំព័រ ៩ មាន tab `5`) មុនការកាត់ ➜ សំណើលើស។ បង្កើតឡើងវិញ ៖ hint ១២០ ទំព័រ · ទំព័រ ១ ៩០ms ធៀបទំព័រផ្សេង ២០ms ➜
ការអានបញ្ជី ZTO ៥៨–៦៤ (tab `5` ២៩–៣២ ខណៈ tab នោះមានតែទំព័រ ១) · ការហៅ Function ៣៧–៤០ (stock 0) · ៦២ (stock 950) ធៀបករណីទំព័រ ១ ឆ្លើយមុន ១៦ · ៤៣ ➜
hint ចាស់បន្តបង្កើតសំណើទទេរហូតទំព័រ ១ ឆ្លើយ។

**ការកែ** (សំណើម្ចាស់គម្រោង ៖ «PR ថ្មីក្រោយ #343» · `src/features/zto-list-sync.ts` តំបន់ ZTO ចាក់សោ ➜ `LOCK` ថ្មី · [2.50.138]) ៖ `trimPageHints()` រត់ក្រោយចម្លើយទំព័រ
នីមួយៗ (មុន `if (known) plan(tabPages)`) · មុនទំព័រ ១ ឆ្លើយ (`!known`) tab ដែលមិនទាន់មានចម្លើយណារាយការណ៍ចំនួនរក្សា hint (`hasOwnProperty`) ➜ ក្រោយទំព័រ ១ ឆ្លើយ
លក្ខខណ្ឌដូចកូដចាក់សោចាស់ទាំងស្រុង (tab ដែលទំព័រ ១ មិនរាយការណ៍ = ០) · `tabPages` យកតម្លៃធំបំផុត ➜ ការកាត់ក្រោយទំព័រ ១ មិនដកអ្វីថ្មី · ការកក់ដែលដក (`requested`)
ត្រូវលុប ➜ ចំនួនកើនក្រោយមកកំណត់ពេលទំព័រទាំងនោះម្តងទៀត (ច្បាប់ដើម)។ ZTO ពិតរាយការណ៍ `pages` (`queryDispatchList`) និង `total` (ស្កេនមកដល់ `03`) ➜ ចំនួន
ពីទំព័រ speculative ជាចំនួនពិត · ចំនួនទាយ (ZTO គ្មាន `pages`) ជាព្រំក្រោមដូចចម្លើយទំព័រ ១ ពីមុន។

**ភស្តុតាង** ៖ អ្នកយាមថ្មី «⏱ hint ចាស់ 120 ទំព័រ · ទំព័រ ១ ឆ្លើយក្រោយទំព័រ speculative» (stock 0 · 950 ៖ tab `5` = ទំព័រ ១ + ៧ speculative ដែលចាប់ផ្តើមមុន
ចម្លើយដំបូង · ការអានបញ្ជី ≤ ព្រំដែនដដែលនៃតេស្ត hint ចាស់ · ទំព័រ ៩–១០ tab `3` · គ្មានទំព័រ ១១) ៖ មុនកែ ធ្លាក់ ២/២ (tab `5` ២៩–៣២) · ក្រោយកែ ៖ ការអានបញ្ជី
១៦ · ១៨ (tab `5` ៨) · ការហៅ Function ១៦ · ៤៣ (= ករណីទំព័រ ១ ឆ្លើយមុន) · probe `stale-palm-page-hint-slow-first` · តេស្ត hint ចាស់ទាំង ៤ ៖ ៤ ដងស្របគ្នាក្រោម
បន្ទុក ✅ · `zto-palm-list-e2e` + `zto-palm-list` + `zto-palm-backends` + `zto-palm-race` ៧៨ ✅។

### 2026-10-23 — A271 ៖ CI PR #343 ៖ `emu/tx-disconnect-emu-test` proxy កាត់ ack របស់ listen ជំនួស ack របស់ put

CI លើ PR #343 (`b95617d` ៖ កែតែតេស្ត និងឯកសារ) ផ្នែក ៤/៤ ធ្លាក់ ១ ៖ `emu/tx-disconnect-emu-test` ផ្នែក ក «server ពិតបានអនុវត្តរួច (10 ➜ 7)» ឃើញ
`{"codDollar":10}` ➜ ការអះអាង ២ បន្ទាប់ធ្លាក់តាម (wrapper ពិតឆ្លើយ `applied` + `8` ត្រឹមត្រូវតាម server ពិត) · `main` និង PR #342 ជាប់លើកូដ App ដដែល។

**មូលហេតុ (វាស់)** ៖ កត់ត្រាសារលើខ្សែ ៖ ពេល `drop-ack` armed ឧបករណ៍ផ្ញើ listen `q` (`r:4` ៖ `/ledger`) និង put `p` (`r:5` ៖ hash នៃ cache ទទេ) ➜ ack
ok ដំបូងពី server ជា `r:4` (listen) ➜ proxy ចាស់កាត់ ack `"s":"ok"` ដំបូងរបស់សំណើណាមួយ (`/"b":\{"s":"ok"/` + `/"r":\d+/`) ➜ put ដែល server បដិសេធ
(`datastale`) មិនបានផ្ញើម្តងទៀត ➜ server នៅ 10។ ធម្មតា listen `/ledger` ទទួល ack មុន armed (`settle(300)` + `waitConnected`) តែពេល CI រវល់
(lane `money-guardian` ស្របគ្នា · emulator JVM) ack មកក្រោយ។ បង្កើតឡើងវិញ ៖ ភ្ជាប់ listener `/ledger` ពេល armed ➜ proxy ចាស់ធ្លាក់ ៣/៣ (ការអះអាង ៣ ដដែល
CI)។

**ការកែ** (`audit-tools/emu/tx-disconnect-emu-test.js` តែប៉ុណ្ណោះ) ៖ ពេល armed proxy កត់ `r` នៃ put transaction (`"a":"p"` + `"h":`) ដែលផ្ញើ ហើយកាត់តែ ack
ok នៃ `r` ទាំងនោះ (`okAckRequests()`) ➜ ack listen · `datastale` ឆ្លងទៅ ➜ SDK រត់ updater ម្តងទៀតលើ 10 ➜ put ថ្មីត្រូវ server អនុវត្ត ➜ ack របស់វាត្រូវកាត់។
ការអះអាងទាំងអស់មិនប្រែ · `CLAUDE.md` «Harness traps» ថែមច្បាប់។

**ភស្តុតាង** ៖ checker ដែលកែ ៖ ធម្មតា ២៥ ok ×៣ · listen ពេល armed ២៥ ok ×៣ (ចាស់ ៖ ធ្លាក់ ៣ ×៣) · mutation `txSameValue()` ➜ `false` (wrapper លែងស្គាល់
តម្លៃដែលបានអនុវត្ត) ➜ FAIL ២ (wrapper ផ្នែក ក · ខ) ខណៈលក្ខខណ្ឌចាំបាច់ជាប់ ➜ checker នៅខាំ។ គ្មាន bump (តែ `audit-tools/` · ឯកសារ)។

### 2026-10-23 — A270 ៖ CI `main` ក្រោយ merge PR #342 ៖ `history-window-check` «ចលនាស្វែងរកមិនលោត» វាស់ស៊ុមតាមនាឡិកាក្លែងរបស់ Playwright

Audit លើ `main` `641547d` (merge PR #342) ៖ ផ្នែក ៣/៤ ធ្លាក់ ១ ៖ `native:check` ➜ `history-window-check` «PWA iPhone ៖ ចលនាស្វែងរកមិនលោត»
`steps [0, 0.03, 0.063, 0.108, 0, 0.152, 0.285, 0, 0.097 …]` ខណៈ tree ដដែល (`54024e9`) ជាប់ ៤/៤ លើ PR head `b8c614d` ហើយកូដចលនា (តំបន់ហាមប៉ះ)
មិនប្រែ ➜ រត់ផ្នែកនោះម្តងទៀតម្តងគត់ ៖ ជាប់ ➜ `main` បៃតង ៤/៤ (APK Release ក៏បៃតង)។

**មូលហេតុ (វាស់)** ៖ ក្រោមបន្ទុក CPU ៤ ការវាស់ចាស់ធ្លាក់ ១/៣០ និង ១/៨០។ កំណត់ត្រាតាមស៊ុមនៃការធ្លាក់ ៖ callback `requestAnimationFrame` ទៅមុខ ១៥ms
តែ `document.timeline.currentTime` នៅដដែល (`134801.8` ២ ដង ➜ ជំហាន ០) ហើយ callback បន្ទាប់ (១៨ms) timeline លោត ៣៣,៣ms ➜ ជំហាន ០,២២៦ ·
`currentTime` របស់ animation តាម timeline ត្រង់ (`100.1 → 100.1 → 133.4`) ➜ ចលនារលូនតាមនាឡិការបស់វាផ្ទាល់។ `page.clock.setFixedTime()` ដំឡើងនាឡិកាក្លែងរបស់
Playwright ដែលជំនួស `requestAnimationFrame` និង `performance.now()` ផង (`performance.now() − now` = ០ គ្រប់គំរូ) ➜ callback មួយជា tick របស់ timer
មិនមែនស៊ុមដែល browser គូរ ➜ ម៉ាស៊ីនរវល់ ៖ tick ពីរធ្លាក់ក្នុងស៊ុមពិតតែមួយ (០) ហើយ tick បន្ទាប់គ្របស៊ុមពីរ (ជំហានទ្វេ) = ការវាស់ខុស មិនមែនចលនាដែលមើលឃើញ។
ការធ្លាក់មុនៗនៃការអះអាងនេះ (ស៊ុម ២២,៦% ក្រោយស៊ុម ០ · APK ២៨% · PWA Android ០,២១) មានលំនាំដដែល ៖ ជំហាន ០ ជាប់នឹងជំហានទ្វេ។

**ការកែ** (`ZoeW/scripts/history-window-check.mjs` តែប៉ុណ្ណោះ) ៖ គំរូនីមួយៗកត់ `document.timeline.currentTime` (នាឡិកាដែលបើក Web Animations · Playwright
មិនក្លែង) ➜ គំរូនៃស៊ុមដដែលបញ្ចូលគ្នា (ទីតាំងចុងក្រោយ · `pending` បើគំរូណាមួយ pending) ➜ ជំហានតែរវាងស៊ុមពិតជាប់គ្នា ≤ ២០ms ហើយមិនមែនក្រោយស៊ុម `pending`។
ការអះអាងមិនប្រែ (≤ ២០% ក្នុងមួយស៊ុម · ជំហាន ≥ ៨ · ឃើញ `pending` ≥ ១) · `CLAUDE.md` «Harness traps» ថែមច្បាប់ ⛔ មិនវាស់ចលនាតាមម៉ោង rAF ក្រោម `page.clock`។

**ភស្តុតាង** ៖ គំរូដដែល ៨០ ដងក្រោមបន្ទុក ៖ ការវាស់ចាស់ធ្លាក់ ១ · ការវាស់ថ្មី ០ · គំរូនៃការធ្លាក់ទាំងពីរ ៖ ចាស់ ០,២២៦ · ០,២៦ ➜ FAIL · ថ្មីអតិបរមា
០,១៥៧ ➜ PASS · រត់ពេញ ៖ ធម្មតា ៩៦ ✅ · ០ FAIL · ក្រោមបន្ទុក CPU ៤ ៩៦ ✅ · ០ FAIL · mutation `PANEL_SEARCH_GLIDE_MS` ២៨០ ➜ ៦០ ➜ FAIL ៣/៣ (APK · PWA Android ·
PWA iPhone ៖ ជំហាន ០,៥២៨) ហើយតែការអះអាងនេះ។ គ្មាន bump (តែ `ZoeW/scripts/` · ឯកសារ)។

### 2026-10-22 — A269 ៖ ការពិនិត្យជុំ ៦ មុន merge (A264 · A266 · A268) ៖ Login ឡើងវិញតែពេលរង់ចាំបានយូរគ្រប់ Login · ម៉ោង Sign មុន restore មិនមែនភស្តុតាង

សំណើម្ចាស់គម្រោង ៖ «ផ្ទៀងផ្ទាត់… រហូតទាល់តែលែងមានកំហុសទើបខ្ញុំ merge» (ការពិនិត្យឯករាជ្យលើការកែជុំ ៥)។ `netlify/functions/_shared/zto-palm.js` · `src/features/zto-status.ts` កែ (តំបន់ ZTO ចាក់សោ ៖ `LOCK` ថ្មីទាំងពីរ) · `src/domain/barcode.ts` · `src/features/zto-final-marks.ts` · កំណែ [2.50.137] ដដែល (មិនទាន់ merge)។

**[Medium] R6-1 Login ឡើងវិញចាប់ផ្តើមពេលរង់ចាំនៅសល់ (> 0) ខ្លីជាង Login ខ្លួនឯង។** Root cause ៖ R5-2 (A268) រំលង Login តែពេលរង់ចាំ ≤ 0 ➜ ពេលរង់ចាំវិជ្ជមានតិច (រាប់រយ ms) នៅតែចាប់ផ្តើម Login (អាន Blob + Login ZTO + សរសេរ Blob) ➜ `settleWithin()` ឈប់រង់ចាំ ➜ ចម្លើយចេញ ➜ Login រត់ក្រោយចម្លើយ ➜ Function ផ្អាក ➜ ពេលបើកវិញ timer ផុតមុន ➜ បរាជ័យបណ្តោះអាសន្ន ➜ `SHARED_RENEW_GAP_MS` (៦០ វិ.) នៃ 503 `palm:renewing` (ព្រំដែន (៣) របស់ A268 ដែលអ្នកពិនិត្យវាយតម្លៃ Medium)។ វាស់ (Function ពិត · Blobs ក្លែង · ថវិកា ៤ ៥០០ ms · ZTO ៣ ០០០ ms · Login ZTO ក្លែង ១ ០០០ ms) ៖ ZTO ឆ្លើយបដិសេធក្រោយ ២ ០០០ · ២ ៥០០ ms (ពេលរង់ចាំ ≈ ៨០០ · ៣០០ ms) ➜ មុនកែ ៖ Login ចាប់ផ្តើមក្នុងសំណើ ហើយបញ្ចប់ក្រោយចម្លើយ (Blob ប្រែក្រោយចម្លើយ) · ផ្លូវ `exact=1` សាខា B (ZTO ១ ០០០ ms × ២) ដូចគ្នា · អ្នកពិនិត្យបិទ thread ៧ វិ. (`Atomics.wait`) ជំនួសការផ្អាក ➜ ស្កេនបន្ទាប់ 503 `palm:renewing` ហើយគ្មាន Login ថ្មី។ ការកែ ៖ `renewalWithinBudget()` ចាប់ផ្តើមតែពេលរង់ចាំ ≥ `SHARED_RENEW_MIN_WAIT_MS` (២ ៥០០ ms ≈ ២–៥ ដងនៃ Login ធម្មតា) · ខ្លីជាងនោះ ➜ ចម្លើយដូចមុន (503 `palm:renewing` · ចម្លើយ ZTO ពិត · 503 `palm:branch-unread`) គ្មានការកត់បរាជ័យ ➜ សំណើបន្ទាប់ Login · ថវិកាលំនាំដើម (៩ ០០០ ms) ៖ Login ឡើងវិញក្នុងសំណើពេល ZTO ឆ្លើយបដិសេធក្នុង ≤ ~៤,៨ វិ.។ ⛔ មិនជ្រើសការ «មិនកត់បរាជ័យដែលកើតពីការផ្អាក» ៖ Login យឺតជាងពេលរង់ចាំនឹងចាប់ផ្តើមម្តងក្នុងមួយសំណើ (ZTO risk control ➜ captcha ➜ ចាក់សោគ្រប់ទូរស័ព្ទរហូត Login ដោយដៃ) · ការកត់បរាជ័យរក្សា ≤ ១ Login ក្នុង `SHARED_RENEW_GAP_MS` ក្នុងមួយ container។
អ្នកយាម ៖ `zto-palm-shared.test.ts` describe «ជុំ ៦» ៣ (ស្កេន ZTO ២ ០០០ · ២ ៥០០ ms · `exact=1` ហាងចងសាខាពីរ ៖ គ្មាន Login ក្នុង ឬក្រោយចម្លើយ · Blob មិនប្រែក្រោយចម្លើយ · សំណើបន្ទាប់ Login ម្តង ហើយ 200) ➜ មុនកែ ៣ ធ្លាក់ · mutation ៖ ត្រឡប់ទៅ `> 0` ➜ ៣/៣ ធ្លាក់ · អ្នកយាម «ជុំ ៥» ៣ ៖ សំណើបន្ទាប់ប្រើថវិកាលំនាំដើម (មិនពឹងលើគម្លាត ~២៨០ ms ពីកម្រិតថ្មី)។

**[Low] R6-2 ម៉ោង Sign Cookie មុនពេល restore កញ្ចប់ បិទកញ្ចប់បើក និង (ចាប់ពី R5-1) បង្វិលកញ្ចប់បិទទៅ «Sign»។** Root cause ៖ បញ្ជី Sign Cookie ជាព្រឹត្តិការណ៍ស្កេន `05` លើចន្លោះថ្ងៃ ➜ អាចមាន Sign ចាស់ជាងការ restore របស់កញ្ចប់ (restore Cookie ឆ្លងតែពេល ZTO មិនបង្ហាញ Sign ➜ Sign ចាស់ជាងនោះ = វដ្តមុន ឬ PDA ផ្ញើក្រោយ) · អ្នកបោះត្រា (`applyZtoFinalMarks()`) បដិសេធ Sign ចាស់ជាង `restoredAt` (គោលការណ៍ «មិនឆ្លងជុំ restore ក្រោយ») តែការអាន Sign បិទកញ្ចប់បើកដែល restore (មានមុន PR) ហើយ R5-1 បង្វិលកញ្ចប់បិទទៅ «true» ដោយ Sign នោះ ➜ «true» គ្មានត្រា ៖ ចេញពីរបារ · ហាមបើកវិញ · សរសេរត្រាឡើងវិញរៀងរាល់ ៥ នាទី · ការសម្អាត Cookie មិនដល់។ វាស់ (harness ផ្លាស់វេន ៖ restore T0−៦០ នាទី · Sign T0−១២០ នាទី · `/detail` «មិនទាន់») ៖ មុនកែ ➜ កញ្ចប់បើកបិទ · កញ្ចប់បិទបង្វិល «true»។ ការកែ ៖ `barcodeSignBasis()` (`domain/barcode.ts`) ជាមូលដ្ឋានតែមួយរបស់អ្នកបោះត្រា និងការអាន Sign (entries មាន `since`) ➜ ជួរ Sign ចាស់ជាងមូលដ្ឋាន = គ្មានភស្តុតាង ➜ មិនបិទ · មិនបង្វិល · `/detail` ជុំដដែលសម្រេច (ស្ថានភាពបច្ចុប្បន្ន)។
អ្នកយាម ៖ `zto-sweep-lane.test.ts` describe «ជុំ ៦» ៣ (បើក · បិទ ➜ មុនកែ ២ ធ្លាក់ · ទិសផ្ទុយ ៖ Sign ក្រោយ restore ➜ បិទ · បង្វិល · ត្រាម៉ោងពិត) · mutation ៖ ដកមូលដ្ឋានពីរង្វិលបើក ➜ អ្នកយាមបើកធ្លាក់ · ពីរង្វិលបិទ ➜ អ្នកយាមបិទធ្លាក់។

**ព្រំដែន** ៖ (១) Login ZTO យឺតជាងពេលរង់ចាំ (≥ ២,៥ វិ.) នៅរត់ក្រោយចម្លើយ ➜ បរាជ័យកត់ ➜ ≤ ១ Login ក្នុង ៦០ វិ. ក្នុងមួយ container (ការពារ risk control) · (២) មានមុន PR ៖ Login ឡើងវិញតាមអាយុ session (`SHARED_RENEW_AGE_MS` · fire-and-forget) រត់ក្រោយចម្លើយជានិច្ច ➜ លើ Lambda ភាគច្រើនត្រូវផ្អាក ហើយបរាជ័យស្ងាត់ (គ្មានផលលើស្កេន ៖ token ស្លាប់ ➜ Login ក្នុងសំណើ) · (៣) មានមុន PR ៖ ការនាំចូលបញ្ជី ZTO (`zto-list-sync.ts` ៖ ភស្តុតាង Sign `withSigned`) មិនប្រៀបម៉ោង Sign នឹង restore (នាំចូលដោយដៃ មានការមើលមុន) · `/detail` ដែលឆ្លើយ Sign ម៉ោងចាស់ជាង restore (PDA ផ្ញើក្រោយ · ម៉ោង PDA យឺត) ➜ «true» ដែលអ្នកបោះត្រាបដិសេធ (ច្បាប់អ្នកបោះត្រាដើម)។

### 2026-10-22 — A268 ៖ ការពិនិត្យជុំ ៥ មុន merge (A264 · A266) ៖ ឧបករណ៍អានផ្ទេរភស្តុតាង Sign របស់គ្រប់កញ្ចប់បិទ · Login ឡើងវិញតែពេលនៅមានពេលរង់ចាំ

សំណើម្ចាស់គម្រោង ៖ «ផ្ទៀងផ្ទាត់ម្តងទៀតមើល» (ការពិនិត្យឯករាជ្យជុំ ៥)។ `src/features/zto-status.ts` · `netlify/functions/_shared/zto-palm.js` កែ (តំបន់ ZTO ចាក់សោ ៖ `LOCK` ថ្មីទាំងពីរ) · កំណែ [2.50.137] ដដែល (មិនទាន់ merge)។

**[Medium] R5-1 ឧបករណ៍ដែលទុកវេន ៖ របារ «ZTO មិនទាន់បិទ» និងការហាមបើកវិញ មិនតាមការអានរបស់ឧបករណ៍អាន។** Root cause ៖ ការអាន Sign (`closeZtoSignedBarcodes()`) បង្វិលតែ verdict «មិនទាន់» **របស់ឧបករណ៍អានខ្លួនឯង** (`ztoStatusPendingList()`) ➜ កញ្ចប់បិទដែលឧបករណ៍អានគ្មាន verdict (ស្កេនជាប់ ➜ `/detail` ផ្អាកដោយផ្ទាំងបើក · `/detail` មិនទាន់សួរដល់ក្នុងកញ្ចប់បិទច្រើន · ឆ្លើយ `null`) មិនបាន verdict «Sign» ➜ គ្មានត្រា `ztoSignedAt` ➜ ឧបករណ៍ស្ងាត់ដែលទុកវេន (ឧបករណ៍សកម្មកក់រៀងរាល់ ២០ វិ. < ចន្លោះរបស់វា ៣០ វិ.) រក្សា «មិនទាន់» ក្នុងរបារ ហើយបើកកញ្ចប់ដែល Sign រួចវិញបាន រហូតដល់ការពិនិត្យម៉ោងម្តងរបស់វា (មុនការផ្លាស់វេន វាអានខ្លួនឯងក្នុង ≤ ៦០ វិ.)។ វាស់ (harness A266 + history បញ្ចាំងទៅ `scheduleZtoFinalMarks()` ដូច `renderHistory()`) ៖ មុនកែ ➜ ៣ នាទីក្រោយ Sign ត្រា server មិនសរសេរ · របារ និងការហាមបើកវិញមិនប្តូរ (កញ្ចប់ ១ ស្កេនជាប់ · កញ្ចប់ ១ ក្នុងកញ្ចប់បិទ ៨១ · កញ្ចប់ ៤៥ Sign ព្រមគ្នា) ➜ ក្រោយកែ ៨ វិ. · ៨ វិ. · ១២ វិ.។ ការកែ ៖ បញ្ជីបង្វិល = គ្រប់កញ្ចប់បិទដែលគ្មានត្រា server និងគ្មាន verdict «Sign» ក្នុងឧបករណ៍ (`signedStale`) ➜ ឧបករណ៍អានណាក៏ផ្ទេរភស្តុតាងឲ្យសាខា · លក្ខខណ្ឌចាប់ផ្តើមការអានមិនប្តូរ (កញ្ចប់បើក ឬ verdict «មិនទាន់») ➜ ការហៅ Function មិនកើន · ភស្តុតាងពិតតែពីបញ្ជី Sign (code ស្មើ) · ការអានដែលមានម៉ោង Sign (Cookie `signedRows` `at` ➜ ត្រាម៉ោងពិត) ៖ គ្រប់កញ្ចប់ · គ្មានម៉ោង (Palm) ៖ តែ «មិនទាន់» របស់ឧបករណ៍ខ្លួន (កថាខណ្ឌ CI ខាងក្រោម) · verdict ដែលបង្វិលរក្សាទុកម្តងក្នុងមួយការអាន (`setZtoPickupVerdict(…, deferSave)` ➜ `saveZtoPickupStatus()` ម្តង) ៖ ការរក្សាទុកមួយកញ្ចប់ម្តង = O(n²) (verdict ២ ០០០ ៖ ១ ០០០ ដង ≈ ១,៥ វិ. លើ CPU server · ទូរស័ព្ទយឺតជាង) ➜ ការអានដំបូងក្រោយ Logout ដែលបង្វិលច្រើន មិនជាប់ thread។
អ្នកយាម ៖ `zto-sweep-lane.test.ts` describe «ជុំ ៥» ៤ (មុនកែ ៣ ធ្លាក់ · ទិសផ្ទុយ ៖ កញ្ចប់បិទមិនទាន់ Sign ➜ គ្មានត្រា · «មិនទាន់» នៅ · ការអានមិនញឹកជាងមុន) · mutation ៖ ដក `scheduleZtoFinalMarks()` ក្រោយបង្វិល (អ្នកយាម LANE-2 + ៣ ថ្មីធ្លាក់ ➜ harness ថ្មីមិនធ្វើឲ្យអ្នកយាមជុំ ២ ខ្សោយ) · កំណត់ ២០ កញ្ចប់ក្នុងមួយការអាន · រក្សាទុកម្តងមួយកញ្ចប់ (៤៦ ដង) · ដកការរក្សាទុកក្រោយបង្វិល ➜ ធ្លាក់ទាំងអស់ · ដក `!entry.signed` ➜ នៅបៃតង (បង្វិលកញ្ចប់ដែលមានត្រារួច = គ្មានផលលើភស្តុតាង តែបន្ថែម verdict ក្នុង store ➜ រក្សាជាការសន្សំ)។

**CI ផ្នែក ៣/៤ លើ `0f8643d` ធ្លាក់ ៖ `supabase-money-multishop` (Palm pickup2h/offline-online/move ៖ កញ្ចប់នៅ history ជំនួស trash)។** ធ្វើឡើងវិញបានក្នុង session ២ ដង (មិនមែន flake) · ត្រឡប់តែ `signedStale` ➜ `signedPending` ➜ ឆ្លង ➜ មូលហេតុពី R5-1។ យន្តការ (debug លើ measure tree) ៖ បញ្ជី Sign Palm គ្មានម៉ោង Sign (`signedRows` `at` ទទេ) ➜ ការបង្វិលទូលាយដាក់ verdict «Sign» ម៉ោង «ឃើញ» (now) លើកញ្ចប់ដែលឧបករណ៍មិនដែលវាស់ ➜ `syncZtoFinalMarks()` សរសេរ `ztoSignedAt` = ម៉ោងឃើញ ➜ ការសម្អាត ២ ម៉ោងរបស់ ZTO Login រាប់ពីម៉ោងឃើញ ➜ កញ្ចប់ Sign តាំងពី ៣ ម៉ោងមុននៅ history · ឧបករណ៍ដែល probe បានម៉ោងពិតក៏កែមិនបាន ៖ ការសរសេរម៉ោងឃើញមុនរបស់វាឃើញត្រារបស់ឧបករណ៍ផ្សេងរួច (`committed: false`) ➜ `ztoFinalFailedAt` បិទផ្លូវនោះ ៥ នាទី។ ការកែ ៖ បង្វិលទូលាយតែពេលការអានមានម៉ោង Sign · គ្មានម៉ោង ➜ តែ «មិនទាន់» របស់ឧបករណ៍ខ្លួន (ដូចមុន R5-1)។ វាស់ ៖ `supabase-money-multishop` ✅ · `emu/money-multidevice-emu-test` (RTDB emulator ពិត) PASS 8/8 · របារ Cookie ៨ វិ. · ៨ វិ. · ១២ វិ. ដដែល។ អ្នកយាម ៖ `zto-sweep-lane.test.ts` Palm ១ ថ្មី (a មិនដែលវាស់ ➜ គ្មានត្រាម៉ោងឃើញ · /detail របស់ a វាស់ ➜ ត្រាម៉ោងពិត ➜ របារលើ b បាត់) · harness ៖ `signedRows` `at` សម្រាប់ Cookie ដូច Function ពិត · /detail ឆ្លើយតាមការ Sign · mutation ៖ ដកលក្ខខណ្ឌម៉ោង ➜ តេស្ត Palm ធ្លាក់ · ត្រឡប់ទៅ `signedPending` ➜ តេស្ត Cookie ៣ ធ្លាក់។

**[Low] R5-2 Login ឡើងវិញចាប់ផ្តើមពេលសំណើគ្មានពេលរង់ចាំសល់។** Root cause ៖ ផ្លូវ Login ឡើងវិញក្នុងសំណើ (`palmGetShared()` · Sign ពិនិត្យស្ថានភាព · `renewBranch()` សាខាផ្សេង) ហៅ `settleWithin(…, remainingOf(deps) − 1500)` ទោះពេលនោះ ≤ 0 ➜ `settleWithin()` ចាប់ផ្តើម Login ហើយឈប់រង់ចាំភ្លាម ➜ Login រត់ក្រោយចម្លើយ (fire-and-forget) ➜ Function ផ្អាក ➜ ពេលបើក container ម្តងទៀត timer ពិដាន Login ផុតមុនការអាន socket ➜ «បរាជ័យបណ្តោះអាសន្ន» ➜ គ្មាន Login ឡើងវិញក្នុង container នោះ `SHARED_RENEW_GAP_MS` (៦០ វិ.) ➜ ហាងដែលមាន container តែមួយ ៖ ស្កេន/បញ្ជី 503 រហូត ៦០ វិ. ក្រោយ token ស្លាប់។ វាស់ (Function ពិត · Blobs ក្លែង · ZTO ក្លែងយឺត ៖ ថវិកា ៤ ០០០–៤ ៥០០ ms · ZTO ២ ៩០០ ms ឬ ១ ៤៥០ ms × ២) ៖ មុនកែ ➜ Login ចាប់ផ្តើមក្នុងសំណើដែលគ្មានពេលរង់ចាំ ទាំង ៣ ផ្លូវ។ ការកែ ៖ `renewalWithinBudget()` ៖ ពេលរង់ចាំ ≤ 0 ➜ មិនចាប់ផ្តើម (`reason: 'budget'`) ➜ ចម្លើយដូចការ Login បរាជ័យបណ្តោះអាសន្ន (503 `palm:renewing` · ចម្លើយ ZTO ពិត · 503 `palm:branch-unread`) ហើយគ្មានការផ្អាក ៦០ វិ. ➜ សំណើបន្ទាប់ Login ក្នុងថវិកា។
អ្នកយាម ៖ `zto-palm-shared.test.ts` describe «ជុំ ៥» ៣ (ស្កេន · Sign ពិនិត្យស្ថានភាព · `exact=1` ហាងចងសាខាពីរ ៖ គ្មាន Login ក្នុង ឬក្រោយចម្លើយ · Blob សាខា B មិនប្រែ · សំណើបន្ទាប់ Login ម្តង ហើយ 200) ➜ មុនកែ ៣ ធ្លាក់ · mutation ៖ ត្រឡប់ផ្លូវនីមួយៗទៅ `settleWithin()` ➜ អ្នកយាមរបស់វាធ្លាក់ ៣/៣ · `zto-palm-shared` + `zto-palm-server` ១៨៨ PASS។

**ព្រំដែន** ៖ (១) ឧបករណ៍ដែលទុកវេនរក្សា verdict «មិនទាន់» របស់ខ្លួន (របារ និងការហាមបើកវិញអានត្រា server) ➜ `/detail` សួរកញ្ចប់នោះម្តងក្នុងមួយម៉ោង (ដូចមុន) · (២) ការសរសេរត្រា ≤ `ZTO_FINAL_SWEEP_BATCH` ក្នុងមួយជុំ ➜ ជុំបន្ទាប់ចាប់ផ្តើមពី snapshot history (`renderHistory()` ➜ `scheduleZtoFinalMarks()`) · (៣) ZTO យឺតជាប់ (> ~៣,៧ វិ. ក្នុងមួយការហៅលើផ្លូវដែលអានពីរដង) ➜ Login ឡើងវិញកើតតែពីសំណើដែលនៅមានពេល · Login ដែលចាប់ផ្តើមជាមួយពេលរង់ចាំវិជ្ជមានតិច អាចនៅរត់ក្រោយចម្លើយ (គ្មាន abort តាមថវិកា) · (៤) Palm ៖ បញ្ជី Sign គ្មានម៉ោង ➜ កញ្ចប់ដែលឧបករណ៍អានមិនដែលវាស់ ៖ របារលើឧបករណ៍ស្ងាត់រង់ចាំ /detail របស់ឧបករណ៍អាន (ផ្អាកពេលស្កេនជាប់) ឬការពិនិត្យម៉ោងម្តងរបស់ខ្លួន · (៥) មានមុន PR ៖ ការសរសេរត្រាដែល server មានរួច (`committed: false`) បិទការកែម៉ោងពិតពីឧបករណ៍នោះ ៥ នាទី (`ztoFinalFailedAt`) ➜ ការកែមកពីឧបករណ៍ផ្សេងដែល probe។

### 2026-10-22 — A267 ៖ ការពិនិត្យជុំ ៣ មុន merge (A264 · A265 · A266) ៖ ZTO ខូចមិនបិទ Login សាខា · session សាខាផ្សេង Login ឡើងវិញ · ហាង Supabase មិនផ្លាស់វេន

សំណើម្ចាស់គម្រោង ៖ «ផ្ទៀងផ្ទាត់ការងារឡើងវិញម្តងទៀតក្រែងមានចន្លោះឬកំហុសលាក់ខ្លួន … រហូតទាល់តែលែងមានកំហុសទើបខ្ញុំ merge»។ `netlify/functions/_shared/zto-palm.js` · `src/services/zto-sweep-lane.ts` កែ (តំបន់ ZTO ចាក់សោ ៖ `LOCK` ថ្មីទាំងពីរ) · កំណែ [2.50.137] ដដែល (មិនទាន់ merge)។

**[Medium/High] R3-1 ZTO ខូចទាំងមូល ➜ Login ឆ្លើយ `SYSTEM_ERROR` ➜ សញ្ញាបដិសេធបិទគ្រប់ទូរស័ព្ទក្នុងសាខា។** Root cause ៖ `palmUpstreamLogin()` ចាត់ចម្លើយ `status: false` ទាំងអស់ជា `ZTO_PALM_LOGIN_REJECTED` ➜ ពេល ZTO ខូច (Lookup ក៏ Login ក៏ឆ្លើយ `SYSTEM_ERROR`) ការ Login ឡើងវិញ (`runRenewShared()`) សរសេរ tombstone `rejected` ➜ គ្រប់ container ឆ្លើយ 401 `palm:login-rejected` ហើយ App លុប refresh token (`PALM_REFRESH_FINAL_CODES`) ➜ ZTO ល្អវិញក៏នៅតែបិទ រហូតមាននរណាវាយពាក្យសម្ងាត់។ A264 ធ្វើឲ្យវាកើតញឹក ៖ ពេល ZTO ខូច ចម្លើយ 502 លើ token ចាស់ ≥ ១៥ នាទីធ្វើឲ្យ Login ឡើងវិញភ្លាម (`tokenSuspected()`) · មុន A264 មានតែការ Login តាមអាយុ ៤ ម៉ោង។ Login ដោយដៃពេល ZTO ខូចក៏បង្ហាញ «គណនី ឬពាក្យសម្ងាត់ ZTO មិនត្រឹមត្រូវ» ខុសការពិត។ Fix ៖ `PALM_OUTAGE_CODES` (`SYSTEM_ERROR` ៖ កូដដែល ZTO ឲ្យ token ស្លាប់ផងដែរ) ➜ `upstream:unavailable` ➜ 502 `ZTO_UNAVAILABLE` + `reason: palm:SYSTEM_ERROR` ➜ ការ Login ឡើងវិញជាការបរាជ័យបណ្តោះអាសន្ន (`palm:renewing` · ចន្លោះ `SHARED_RENEW_GAP_MS`) · គ្មាន tombstone · App រក្សា refresh token (រង់ចាំ `PALM_REFRESH_RETRY_MS`)។ ការបដិសេធគណនីពិត (`login_password_error` …) នៅជា tombstone ដូចមុន។

**[Medium] R3-2 ហាងចងច្រើនសាខា ៖ token សាខាផ្សេងស្លាប់ពេលយប់ ➜ ការអាន Sign ពេញលេញ (`exact=1`) ឆ្លើយ 503 `palm:branch-unread` ជាប់។** Root cause ៖ `siblingSignedPage()` Login សាខាផ្សេងឡើងវិញតែលើ 401 ហើយមិន await (`renewBranch()` fire-and-forget) ➜ ZTO ឆ្លើយ token ស្លាប់ជាការបដិសេធ 502 មិនមែន 401 ➜ មិន Login ទាល់តែសោះ · សូម្បី 401 ក៏ការងារក្រោយចម្លើយកក (Lambda) ➜ ការអានពេញលេញបរាជ័យរហូតទូរស័ព្ទសាខានោះប្រើ ZTO ម្តង ➜ ការរង់ចាំ ៨ ថ្ងៃ (`ztoAbandonCleanupIsHeld()`) ដោះតែតាមពិដាន episode ➜ កញ្ចប់ដែល Sign នៅសាខាផ្សេងអាចផុតកំណត់ (ដកលុយ)។ Fix ៖ ទំព័រសាខាផ្សេងដែល ZTO ឆ្លើយ 401 ឬការបដិសេធដែលសង្ស័យដូច `tokenSuspected()` (token ≥ `SHARED_SUSPECT_AGE_MS`) ➜ Login សាខានោះឡើងវិញ **await** ក្នុងថវិកា (`renewBranch()` ➜ `settleWithin(renewShared…)`) ហើយអានម្តងទៀត។

**R3-3 (ការសម្រេចម្ចាស់គម្រោង ៖ «ផ្លាស់វេនតែ Firebase») ហាង Supabase ៖ ការកក់វេនថ្លៃ។** ការសរសេរ Supabase នីមួយៗបង្កើន seq របស់ហាង ➜ trigger `zoe_tenant_state_broadcast` ➜ `realtime.send` ទៅគ្រប់ទូរស័ព្ទក្នុងហាង ➜ ទូរស័ព្ទនីមួយៗ `zoe_pull` ➜ ទូរស័ព្ទ N ផ្លាស់វេន ៖ N ÷ C ការកក់ក្នុងមួយវិនាទី × N ការទាញ = N² ÷ C (C = `ZTO_SIGNED_SWEEP_ACTIVE_MS` ២០ វិ.) ➜ ទូរស័ព្ទ ១០ ៖ ~៥ សារ Realtime + ៥ ការទាញក្នុងមួយវិនាទីជាប់រហូត ក្នុងគម្រោង Supabase ដែលហាងច្រើនប្រើរួម (Firebase ៖ ការកក់មួយ = តម្លៃតូចមួយដល់ listener · គ្មានការទាញ)។ Fix ៖ `attachZtoSweepLaneListener()` មិនភ្ជាប់អ្វីលើ adapter Supabase (`tenantScope`) ➜ ស្ថានភាព `off` ➜ `ztoSweepLaneTurn()` ឆ្លើយ `solo` ➜ ទូរស័ព្ទ Supabase អានរៀងខ្លួនដូចមុនជម្រើស ឃ (គ្មានការសរសេរ · គ្មានថ្លៃថ្មី)។ rules `zto_sweep_lead` ក្នុង SQL Supabase នៅ (rules តែមួយប្រភព) តែ App មិនសរសេរទីនោះ។

**អ្នកយាម** ៖ `ZoeW/tests/zto-palm-shared.test.ts` ៤ ថ្មីក្នុង describe A264 (ZTO ខូចទាំងមូល ➜ គ្មាន tombstone · ZTO ល្អវិញ +៦១ វិ. ➜ Login ឡើងវិញដោយខ្លួនឯង · Login ដោយដៃពេល ZTO ខូច ➜ 502 `ZTO_UNAVAILABLE` (ទិសផ្ទុយ ៖ `login_password_error` ➜ 401 `ZTO_PALM_LOGIN_REJECTED`) · ហាងចងសាខាពីរ (`FIREBASE_PROJECT_IDS` `…:kh001|kh002`) ការអានព្រឹក ➜ 200 ពេញលេញ (ទិសផ្ទុយ ៖ token សាខា B ក្មេង ➜ 503 `palm:branch-unread` គ្មាន Login)) · `ZoeW/tests/zto-sweep-lane.test.ts` describe «ហាង Supabase ៖ មិនផ្លាស់វេន» (ទូរស័ព្ទ Supabase ២ ➜ គ្មានការសរសេរវេន · អានតាមល្បឿនខ្លួន · ទិសផ្ទុយ Firebase មានការកក់)។ លើកូដមុនកែ ៖ ៤ ធ្លាក់ · ៤១ ឆ្លង (រួមទិសផ្ទុយ)។ Mutation ៣ ៖ ៣ ចាប់ ដោយតេស្តរបស់វា (`SYSTEM_ERROR` ជាការបដិសេធ ➜ ២ ធ្លាក់ · Login សាខា B មិន await ➜ ១ ធ្លាក់ · ដកការលើកលែងអាយុ ១៥ នាទី ➜ ទិសផ្ទុយធ្លាក់)។ ផ្ទៀងដោយការអាន ៖ ផ្លូវ `?palm=refresh` ពេល ZTO ខូច ➜ 502 `ZTO_UNAVAILABLE` ➜ App រក្សា refresh token · retry ការភ្ជាប់ចាស់ (A265) មានតែសំណើអាន (Login និង Sign មិន retry) · ការផ្តាច់/ភ្ជាប់ listener វេនស៊ីមេទ្រីក្រោមការប្តូរ backend។

**ព្រំដែន** ៖ (១) ZTO ខូចយូរ ➜ container នីមួយៗសាក Login ≤ ១ ដងក្នុង `SHARED_RENEW_GAP_MS` (ZTO អាចស្នើ captcha ➜ `ZTO_PALM_VERIFICATION_REQUIRED` ➜ tombstone ➜ Login ដោយដៃ) · (២) Login ដោយដៃពេល ZTO ខូចបង្ហាញកូដពិត «Server ZTO ឆ្លើយ ZTO_UNAVAILABLE (HTTP 502)» មិនមែនអត្ថបទខ្មែរដាច់ដោយឡែក (`zto-palm-login.ts` ក្នុងសោ មិនកែ) · (៣) សំណើដែលត្រូវ Login ទាំងសាខាខ្លួន និងសាខាផ្សេងអាចផុតថវិកា ➜ 503 ម្តង · session ថ្មីនៅក្នុង Blob ➜ ការអានបន្ទាប់ (backoff) ជោគជ័យ · (៤) ការភ្ជាប់ដែល ZTO ទម្លាក់ដោយស្ងាត់ (គ្មាន RST) ➜ សំណើលើវាចាំដល់ `ZTO_UPSTREAM_TIMEOUT_MS` ដូចការភ្ជាប់ថ្មីដែលខូច ➜ `?diag=1` `upstreamTiming.scans.argus.timeouts` បង្ហាញវា · (៥) ហាង Supabase មិនទទួលល្បឿនពីការផ្លាស់វេន។

### 2026-10-22 — A266 ៖ ជម្រើស ឃ ៖ ឧបករណ៍ក្នុងសាខាផ្លាស់វេនគ្នាអានបញ្ជី Sign ZTO

សំណើម្ចាស់គម្រោង ៖ «បើក PR ហើយធ្វើជម្រើស ឃ» (A265 ឃ. ឧបករណ៍មួយក្នុងសាខាអាន ZTO ជំនួសគ្រប់ឧបករណ៍ ➜ cadence លឿនដោយមិនបន្ថែមការហៅ)។ `src/features/zto-status.ts` កែ · `src/services/zto-sweep-lane.ts` ថ្មី (តំបន់ ZTO ចាក់សោ ៖ `LOCK` ថ្មី និងបន្ថែមឯកសារថ្មីក្នុងសោ) · rules ថ្មី `zoew_settings/zto_sweep_lead` · SQL Supabase `20261022043452_zoe_rules.sql` · [2.50.137]។

**ការរចនា ៖ «ផ្លាស់វេន» មិនមែន «អ្នកនាំជាប់»** ៖ ការបិទតាម Sign ចូល DB រួម ➜ សព្វថ្ងៃឧបករណ៍ N ដែលអានរៀងៗខ្លួន (ជំហានចៃដន្យ) ធ្វើឲ្យសាខាឃើញ Sign ជាមធ្យម ~C ÷ (N+1) រួចហើយ (C = `ZTO_SIGNED_SWEEP_ACTIVE_MS`) ➜ អ្នកនាំជាប់តែមួយដែលអានតាម C ធ្វើឲ្យសាខា **យឺតជាងមុន** ហើយលឿនបានតែដោយបន្ថែមការហៅ (ឧបករណ៍តែមួយ ៖ ×២)។ ដូច្នេះ ៖ ការអាននីមួយៗកក់ CAS លើ `zoew_settings/zto_sweep_lead/<lane>` = `{ device, at }` · ឧបករណ៍រំលងពេលឧបករណ៍ផ្សេងទើបកក់ក្នុងចន្លោះ C ÷ (1 + ឧបករណ៍ផ្សេងដែលឃើញកក់ក្នុង 2C) (មិនតិចជាង ៥ វិ.) ហើយភ្ញាក់ពេលដល់វេន · ឧបករណ៍នីមួយៗរក្សា C ជាពិដានខ្លួន ➜ ការហៅមិនលើសមុនគ្រប់ចំនួនឧបករណ៍ · ឧបករណ៍ N សកម្មស្មើគ្នា ➜ ចន្លោះ C ÷ N។ lane = Palm លេខសាខា · Cookie ដែនអ៊ីមែលគណនី (សាខាដែល Function យកពី identity) ➜ សាខាផ្សេងលើ DB តែមួយមិនរំលងគ្នា (បញ្ជីខុសគ្នា)។ ការពិនិត្យ `/detail` មិនចូលវេន (verdict របារ «មិនទាន់បិទ» រស់ក្នុងឧបករណ៍ · ការពិនិត្យកញ្ចប់បើកម៉ោងម្តងមិនចែករំលែក)។

**វាស់ (harness ឧបករណ៍ច្រើន ៖ module graph ដាច់ក្នុងមួយឧបករណ៍ · `zto-status.ts` ពិត · DB រួមក្លែង (listener ពន្យារ 50 ms · transaction អាតូមិក) · timer ក្លែង)** ៖ ឧបករណ៍ ៣ កំពុងប្រើ បើក App ឃ្លាត ១ វិ. · ZTO Sign កញ្ចប់ ១៤ ឃ្លាត ៣៧ វិ. ៖ មុនកែ ➜ ការអាន ៣ ជាប់គ្នាក្នុង ២ វិ. រួចស្ងាត់ ~១៨ វិ. · Sign ➜ បិទ យឺតបំផុត ១៥ វិ. · ការអាន ~៨៧ ក្នុង ១០ នាទី ⟷ ក្រោយកែ ➜ វេន a→b→c រៀងរាល់ ៧,២ វិ. (C ÷ ៣ + ០,៥ វិ. កាលវិភាគ) · យឺតបំផុត ៦,៩ វិ. · ការអាន ៨២ · ឧបករណ៍នីមួយៗ ≥ ២០ វិ. ម្តង · ឧបករណ៍មួយចាកចេញ ➜ ឧបករណ៍ ២ ដែលនៅសល់ ≤ ១០ វិ. (មុនកែ ១៨ វិ.) · ឧបករណ៍តែមួយ ➜ ២០,៥ វិ. ដូចមុន។

**អ្នកយាម** ៖ `ZoeW/tests/zto-sweep-lane.test.ts` ១០ + ២ ជុំ ២ (មុនកែ ៥ ធ្លាក់ ៖ ល្បឿនឧបករណ៍ ៣ · ឧបករណ៍ចាកចេញ · lane តាមសាខា · ត្រាអនាគត · CAS ៖ ទិសផ្ទុយ ៥ បៃតងមុនកែ ៖ ឧបករណ៍តែមួយ · សាខាផ្សេង · rules មិនទាន់ Publish · ការកក់ជាប់ · ចុចពិនិត្យ) · `emu/app-writes-rules-test` (ការកក់ពិតរបស់ App ១៦ ក្នុង ៨ លំដាប់ ➜ rules ពិតទទួល · rules ចាស់បដិសេធ · probe ១០ រាងខុស ➜ បដិសេធ · ការកក់បច្ចុប្បន្ន និងការលុប lane ➜ ទទួល ៖ ៣០ ok) · `emu/supabase-rules-parity` · `supabase-rls` · `supabase-datastore` PASS · `ZoeW/tests/session-switch-fuzz.test.ts` (ការកក់វេនជាការសរសេរថ្មី ➜ សេណារីយ៉ូ fuzz ប្តូរហាង ២ ៖ គ្មានការសរសេរក្រោយការប្តូរ) · sandbox ៣ (`connection-recovery-test` · `registry-release-test` · `clock-hygiene` ហេតុផល `Date.now()`) ស្គាល់ function ថ្មី · mutation ៨ ៖ ៨ ចាប់ (ដកការរំលងវេន · ចន្លោះមិនចែកតាមឧបករណ៍ · CAS សរសេរជានិច្ច · ត្រាអនាគតរារាំង · lane តែមួយគ្រប់សាខា · ការកក់គ្មានពិដាន · មិនភ្ញាក់ពេលដល់វេន · ការកក់ជាប់មិនផ្អាក ៖ ចាប់ក្រោយតឹងតេស្ត «ការកក់ជាប់» ➜ ក្រោយជាប់ម្តង អានតាមល្បឿនធម្មតា)។

**ការពិនិត្យខ្លួនឯងក្រោយ push (ជុំ ២) ៖ ឧបករណ៍ដែលទុកវេនបាត់ការការពាររបស់ខ្លួន។** ឧបករណ៍សកម្មតិច (បើកទុក ៦០ វិ. · លាក់ ២ នាទី) ក្នុង lane ជាមួយឧបករណ៍កំពុងប្រើ (២០ វិ.) ៖ ចន្លោះរបស់វា (C ÷ ២ = ៣០ វិ.) ធំជាងចន្លោះការកក់របស់ឧបករណ៍សកម្ម ➜ វាមិនដែលបានវេន (វាស់ ៖ ០ ការអានក្នុង ៤០ នាទី) ➜ ស្ថានភាពដែលពឹងលើការអានផ្ទាល់ខ្លួនឈប់ដើរ។
**[Medium] LANE-1 ការរង់ចាំ ៨ ថ្ងៃ (A) របស់ឧបករណ៍ដែលទុកវេនផុតដោយគ្មានការអាន។** Root cause៖ `ztoAbandonCleanupIsHeld()` លើឧបករណ៍ដែលមាន ZTO ដោះតែដោយការអាន Sign ពេញលេញ **ផ្ទាល់ខ្លួន** ដែលគ្របពេលទុំ (`ztoSignedCompleteServerAt`) ហើយ episode ចាប់ផ្តើមថ្មីតែក្រោយការអានពេញលេញ ឬការផ្អាក ៥ នាទី ➜ ឧបករណ៍ដែលមិនដែលបានវេន ហើយមានកញ្ចប់ទុំជាប់ (កញ្ចប់ដែលដកមិនបាន) រក្សា episode តែមួយ ➜ ក្រោយ ៣០ នាទី វាដោះគ្រប់កញ្ចប់ដែលទុំក្រោយនោះ **ភ្លាម**។ Danger scenario៖ អតិថិជនយកកញ្ចប់នៅថ្ងៃទី ៨ · បុគ្គលិក Sign ក្នុង ZTO ១ វិ. មុនកញ្ចប់ទុំ · ឧបករណ៍អានទើបអានរួច (វេនក្រោយ ~២០ វិ.) · ការសម្អាតលើឧបករណ៍ស្ងាត់រត់មុន ➜ ដកកញ្ចប់ដែលយករួច (ដកលុយខុស)។ មុនជម្រើស ឃ ឧបករណ៍នីមួយៗអានដោយខ្លួនឯង ➜ episode ថ្មីរាល់ការអាន ➜ មិនកើត។ Fix៖ ឧបករណ៍ដែលការរង់ចាំសកម្ម (`ztoAbandonHoldIsActive()` ដូចច្បាប់ Data Saver) មិនទុកវេន ៖ អានដោយខ្លួនឯងតាមល្បឿនខ្លួន (ការហៅមិនលើសមុនជម្រើស ឃ)។
**[Low] LANE-2 របារ «ZTO មិនទាន់បិទ» លើឧបករណ៍ដែលទុកវេនយឺត។** Root cause៖ verdict ក្នុងឧបករណ៍ ➜ ឧបករណ៍ដែលទុកវេនដឹងតាមត្រា `ztoSignedAt` ដែលឧបករណ៍អានសរសេរ តែឧបករណ៍អានសរសេរវាតាមជុំ ៦០ វិ. (`scheduleZtoFinalMarks()`) ឬពេល history ប្តូរ (ការ flip verdict មិនប្តូរ history) ➜ វាស់ ៖ Sign ➜ របារលើឧបករណ៍ស្ងាត់បាត់ ៦២ វិ.។ Fix៖ ការអាន Sign ដែលបិទ ឬ flip ➜ `scheduleZtoFinalMarks()` ភ្លាម ➜ ≤ វេនអាន + ~២ វិ.។
អ្នកយាម ៖ `zto-sweep-lane.test.ts` describe «ឧបករណ៍ដែលទុកវេន» ២ (harness ៖ ការសម្អាតហៅការរង់ចាំរៀងរាល់នាទី · history ក្នុង DB ក្លែងបញ្ចាំងទៅគ្រប់ឧបករណ៍ · ជុំ ៦០ វិ. របស់ `scheduleZtoFinalMarks()`) ➜ មុនកែ ធ្លាក់ទាំងពីរ (ដោះការរង់ចាំ ០ ms ក្រោយទុំ ខណៈកញ្ចប់ Sign នៅបើក · របារ ៦២ វិ.) · mutation ២ ៖ ២ ចាប់ (ដកការលើកលែងការរង់ចាំ ➜ តេស្ត ១ ធ្លាក់តែមួយ · ដក `scheduleZtoFinalMarks()` ➜ តេស្ត ២ ធ្លាក់តែមួយ) · `LOCK` `zto-status.ts` ថ្មី · vitest តំបន់ ZTO ១៤ ឯកសារ ៣២៨ PASS។

**ព្រំដែន** ៖ (១) ឧបករណ៍សកម្មតិចទុកវេនឲ្យឧបករណ៍សកម្មជាង ➜ ការអានរបស់វាកើតតែពេលការរង់ចាំ ៨ ថ្ងៃសកម្ម ឬពេលអ្នកប្រើប៉ះវា (ល្បឿន ២០ វិ.) · verdict «មិនទាន់បិទ» របស់វាប្តូរតាមត្រា `ztoSignedAt` ពីឧបករណ៍អាន ឬការពិនិត្យម៉ោងម្តង · (២) Cookie Supabase ៖ lane តាមដែនអ៊ីមែលហាង (គណនីដែនផ្សេងក្នុងហាងតែមួយ ➜ lane ដាច់ ➜ មិនអានលើសមុន) · (៣) ការកក់មួយ = ការសរសេរ DB មួយក្នុងមួយការអាន (advisory · មិនចូល journal) · (៤) ការពិនិត្យ `/detail` កញ្ចប់បើកម៉ោងម្តងនៅតាមឧបករណ៍ (ការចែករំលែកត្រូវ path មួយទៀត ➜ ការសម្រេចក្រោយ)។ Playwright «Resulting promise was garbage collected» (A221) ពេលរត់ mutation vitest ស្របនឹង run-all ➜ `emu/app-writes-rules` ម្នាក់ឯង ➜ PASS ៣០។

### 2026-10-22 — A265 ៖ ZTO «ដូច realtime» ៖ វាស់ពេលនៃមុខងារ ZTO នីមួយៗ · Cookie ទុកការភ្ជាប់ ZTO ៦០ វិ ដូច Palm

សំណើម្ចាស់គម្រោង៖ «តើចង់បង្កើនល្បឿនអោយលឿន មុខងារដែលទាក់ទងជាមួយ ZTO ទាំងអស់មិនថា Cookie ឬ ZTO login អោយដូច realtime ជាមួយ ZTO តែម្តងបានអត់ សូមតេស្តមើល បើបានសូមកែសម្រួលបន្ថែម»។ `_shared/zto-palm.js` · `zto-order-detail.js` (តំបន់ ZTO ចាក់សោ) កែតាមសំណើនេះ · `LOCK` ថ្មី · Function តែប៉ុណ្ណោះ ➜ មិនឡើងកំណែ App។

**ពេលនៃមុខងារ ZTO នីមួយៗ (អានពីកូដ · ZTO មិនផ្ញើដំណឹង ➜ ZoeW ត្រូវសួរ ➜ realtime ពិតមិនមាន)** ៖ ស្កេន Lookup ➜ ZTO ឆ្លើយ ~០.២–០.៩ វិ (A175–A179) + App ↔ Function ↔ ZTO (Function នៅ `us-east-2` · ZTO នៅអាស៊ី) · បិទតាម ZTO (ចុះហត្ថលេខា) ➜ ≤ ២០ វិ ពេលកំពុងប្រើ (`ZTO_SIGNED_SWEEP_ACTIVE_MS` · ប៉ះ/វាយក្នុង ៥ នាទី) · ≤ ៦០ វិ អេក្រង់បើកទំនេរ · ≤ ២ នាទី ពេល App នៅខាងក្រោយ · ស្កេនត្រឡប់ `-710`/បញ្ជូនចេញ ➜ ធុងសំរាម «ត្រឡប់» ≤ ១ ម៉ោង (`ZTO_OPEN_RECHECK_MS` ៖ Cookie អានបញ្ជីត្រឡប់ម៉ោងម្តង · Palm អាន track កញ្ចប់បើកនីមួយៗម៉ោងម្តង) · កញ្ចប់មកដល់ថ្មី ➜ ចុច «ទាញបញ្ជីកញ្ចប់ពី ZTO» · ទាញចុះ (PTR) ➜ App ចាប់ផ្តើមថ្មី ➜ អានចុះហត្ថលេខា និងត្រឡប់ភ្លាម។

**[Low] ZTO-SPEED-1 ស្កេន Cookie ភ្ជាប់ ZTO ថ្មីម្តងៗ។** Root cause៖ `requestOnce()` (ស្កេន `/detail` · បញ្ជី Argus ទាំងអស់) និងការអាន SSO របស់បញ្ជី Palm (`palmSsoRead()`) ហៅ `fetch` ដោយ pool លំនាំដើម ៖ ZTO គ្មាន `Keep-Alive` ➜ ការភ្ជាប់ទំនេរត្រូវបិទក្រោយ ៤ វិ ➜ ស្កេនឃ្លាតជាង ៤ វិ ចំណាយ TCP + TLS ថ្មីរាល់ដង (A175 ៖ Cookie ៤/៦ ស្កេនលើការភ្ជាប់ថ្មី · A177 ៖ ថ្មី ០.៨២ វិ ⟷ បើករួច ០.៣៨ វិ) ខណៈ Palm ទុក ៦០ វិ តាំងពី A178 (A179 ៖ មធ្យម ០.៥៩ ➜ ០.៣២ វិ)។ Fix៖ `ztoFetch()` + `ztoDispatcher()` (Agent ៦០ វិ ដដែលនឹង Palm · pool មួយក្នុងមួយ host) សម្រាប់ Palm · Cookie · SSO · ការភ្ជាប់ដែល ZTO បិទរួច (`UND_ERR_SOCKET` · `ECONNRESET` · `EPIPE`) ➜ សាកម្តងទៀតភ្លាមមួយដង (Cookie មិនចាយ `ZTO_UPSTREAM_RETRIES` · គ្មាន backoff ២៥០ ms)។ វាស់ជាមួយម៉ូដែល (server HTTPS ក្នុងម៉ាស៊ីន · proxy ពន្យារ ៧៥ ms ម្ខាង + ១ RTT មុនបៃទីមួយ = TCP · TLS 1.3 · ZTO គិត ២៣០ ms · គ្មាន Keep-Alive · Function ពិតមុន/ក្រោយ) ៖ ស្កេនឃ្លាត ៦ វិ · ១៥ វិ · ៤៥ វិ ➜ មុន ០.៧០ វិ រាល់ស្កេន (ការភ្ជាប់ = ចំនួនស្កេន) ⟷ ក្រោយ ០.៣៩ វិ (ការភ្ជាប់ ១) · ឃ្លាត ៣ វិ ➜ ០.៣៩ វិ ទាំងពីរ · ឃ្លាត ៧០ វិ ➜ ០.៧០–០.៧៧ វិ ទាំងពីរ (លើស ៦០ វិ) ➜ ម៉ូដែលស្របនឹង A177 (ថ្មី ០.៨២ · បើករួច ០.៣៨)។ ព្រំដែន ៖ សំណើ ZTO ដំបូងបង្អស់របស់ container ដែល HTTP client មិនទាន់ផ្ទុក (គ្មាន dispatcher សកល) ប្រើ pool លំនាំដើម ➜ ការភ្ជាប់បន្ថែមម្តង (ផលិតកម្ម ៖ ការអាន Blobs ផ្ទុកវាមុនរួច)។ អ្នកយាម ៖ `zto-upstream-timing.test.ts` describe «Cookie (Argus) keeps its ZTO connection» ៤ (កូដមុនកែ ៣ ធ្លាក់ · fail-open ទិសផ្ទុយបៃតង) · `zto-palm-server.test.ts` «arrival list reads … same Agent» (ធ្លាក់មុនកែ) · `zto-list-sync-test` ៖ ផ្លូវ ZTO តែមួយ (`ztoFetch(` ១ ក្នុង Function · `fetch(` ZTO ១ ក្នុង `zto-palm.js` · probe `fetch(` ទី ៣ ➜ ធ្លាក់) · mutation ៧ ៖ ៦ ចាប់ (`ZTO_KEEP_ALIVE_MS` ៤ វិ · Argus `fetch` ផ្ទាល់ · SSO `fetch` ផ្ទាល់ · សាកលើគ្រប់កំហុស · Argus គ្មានការសាក · Agent មិនបញ្ជូន) · ១ ស្មើ (ដកបន្ទាត់ `AbortError` ៖ ពិដានឈ្នះការប្រណាំងមុនជានិច្ច)។

**ជម្រើសដែលនៅសល់ = ការសម្រេចម្ចាស់គម្រោង (តម្លៃ Netlify · A222)** ៖ ក. ចុះហត្ថលេខា ១០ វិ ពេលកំពុងប្រើ ➜ បិទតាម ZTO ≤ ១០ វិ · ការហៅ Function +~១៨០/ម៉ោង/ឧបករណ៍សកម្ម · ខ. Cookie អានត្រឡប់ ១០ នាទីម្តង ➜ ≤ ១០ នាទី · +~១២–១៨/ម៉ោង/ឧបករណ៍ · គ. Palm ពិនិត្យកញ្ចប់បើកតាមក្រុម `tracks=` ៣០ ➜ ការហៅ Function តិចជាងឥឡូវ ~៣០ ដង អាចពិនិត្យញឹកជាង តែ verdict `tracks=` (`trackEvidence()`) ខុសពី `status=1` (`trackingVerdict()`) ➜ ផ្លូវបិទ/ដកលុយ ត្រូវវាស់ជាមួយគណនីពិតមុន · ឃ. ឧបករណ៍មួយក្នុងសាខាអាន ZTO ជំនួសគ្រប់ឧបករណ៍ (A222) ➜ cadence លឿនដោយមិនបន្ថែមការហៅ តែត្រូវ path + rules ថ្មី (Firebase Publish គ្រប់ project · Supabase SQL) មុន merge · ង. តំបន់ Function ជិត ZTO (ការកំណត់ Netlify · គម្រោងបង់ប្រាក់) ➜ គ្រប់ស្កេន/ការអានលឿនជាង (ផ្លូវ ២ ដងឆ្លងប៉ាស៊ីហ្វិក)។

### 2026-10-22 — A264 ៖ token ZTO Palm របស់ហាងស្លាប់ពេលយប់ ➜ ZTO ឆ្លើយ `SYSTEM_ERROR` (502) ហើយ Function មិន Login ឡើងវិញ

របាយការណ៍ម្ចាស់គម្រោង៖ «ZTO login បន្ទាប់ពីបិទ App ZoeW មួយយប់ ក្នុង ZTO login ✅ តែពិនិត្យសុខភាព ❌ error https 502 ជាក់ស្តែងក៏វាអត់ដំណើរការពិត · ចុចផ្តាច់ ZTO ហើយចុចប្រើ ZTO login របស់ហាង ✅ ក៏នៅតែ 502 · ទាល់តែផ្តាច់ ZTO ហើយ login ដោយវាយ Username Password បានដំណើរការ»។ `_shared/zto-palm.js` នៅក្នុងតំបន់ ZTO ចាក់សោ ➜ កែតាមរបាយការណ៍នេះ (`CLAUDE.md` «Locked zone — ZTO») · Function តែប៉ុណ្ណោះ ➜ មិនឡើងកំណែ App។

**[Medium] PALM-DEAD-1 token របស់ហាងដែល ZTO លែងទទួល ឆ្លើយជាការបដិសេធធម្មតា ➜ គ្មានផ្លូវ Login ឡើងវិញ។** Root cause៖ `palmGetShared()` Login ឡើងវិញ (single-flight + សាកម្តងទៀត) តែពេលចម្លើយ = 401 `ZTO_AUTH_EXPIRED` ៖ HTTP 401/403 ឬ `statusCode` ក្នុង `AUTH_EXPIRED_RE` (`not_login` · `token_expired` … ជាកូដទាយ មិនដែលវាស់ជាមួយ ZTO ពិត)។ ភស្តុតាង Sentry `JAVASCRIPT-REACT-M` (ស្កេនមួយ · `lookupReason: palm:SYSTEM_ERROR`) ៖ ZTO ឆ្លើយ HTTP 200 `status:false` `statusCode:SYSTEM_ERROR` ➜ Function បកជា 502 `ZTO_UPSTREAM_REJECTED` ➜ មិន Login ឡើងវិញ។ ការ Login ឡើងវិញតាមអាយុ (≥ ៤ ម៉ោង) រត់នៅ background **ក្រោយ** ចម្លើយ ➜ Netlify (Lambda) កក container ពេលចម្លើយចេញ ➜ timer `SHARED_RENEW_CEILING_MS` · `SHARED_LOGIN_TIMEOUT_MS` ផុតពេល thaw ➜ ស្ទើរមិនដែលចប់ (vitest មិនកក ➜ តេស្តចាស់បៃតង = ស្ថានភាពដែលមិនដែលចូល)។ «ប្រើ Login ZTO របស់ហាង» (`?palm=status`) អានតែ Blob ➜ ✅ ខណៈ token ស្លាប់ · Login ដោយដៃសរសេរ token ថ្មីជាន់ Blob ➜ ទើបដំណើរការ។ Fix៖ `tokenSuspected()` ៖ ចម្លើយ 502 ដែល ZTO បដិសេធ (`ZTO_UPSTREAM_REJECTED` · Sign ពិនិត្យស្ថានភាព `ZTO_PALM_STATUS_UNCONFIRMED` · SSO `palm:identity-rejected`/`palm:arrival-rejected`) លើ token ហាងដែលមានអាយុ ≥ `SHARED_SUSPECT_AGE_MS` (១៥ នាទី) ➜ ផ្លូវ Login ឡើងវិញដដែល (អាន Blob មុន · single-flight · CAS) ហើយសាកម្តងទៀតម្តង (🩺 · ស្កេន · ទាញបញ្ជី · Sign ពិនិត្យស្ថានភាព) · Login បរាជ័យដោយបណ្ដាញ ➜ ចម្លើយ ZTO ដើម (មិនមែន 503) · ZTO បដិសេធគណនី ➜ សញ្ញា «បដិសេធ» ដូចផ្លូវ 401 (Login មិនបរាជ័យដដែលៗ)។ Danger ដែលការពារ ៖ ZTO ខ្លួនឯងមានបញ្ហា (token ថ្មីក៏បដិសេធ) ➜ token ថ្មីក្មេងជាង ១៥ នាទី មិនសង្ស័យ ➜ ≤ ១ Login ក្នុង ១៥ នាទី · 5xx · បណ្ដាញ · យឺត · ការពិនិត្យទម្រង់របស់យើង (ជួរគ្មានទិន្នន័យអតិថិជន) មិនសង្ស័យ។ អ្នកយាម ៖ `ZoeW/tests/zto-palm-shared.test.ts` describe «របាយការណ៍ម្ចាស់គម្រោង ៖ បិទ App មួយយប់» ៨ តេស្ត (ZTO ក្លែង ៖ token ស្លាប់ឆ្លើយ `SYSTEM_ERROR` · SSO `success:false`) ➜ កូដមុនកែ ៧/៨ ធ្លាក់ (🩺 502 ដូចម្ចាស់គម្រោងឃើញ · ទិសផ្ទុយបៃតងទាំងពីរ) · mutation ៨ ចាប់ទាំងអស់ ៖ ដក SSO · ដក Sign status · ដក gate Sign · ដក «ចម្លើយ ZTO ដើម» · gate អាយុ = 0 · គ្រប់ status · គ្រប់ `ZTO_INVALID_RESPONSE` · `ZTO_UNAVAILABLE` ។ `LOCK` `_shared/zto-palm.js` ថ្មី។ ព្រំដែន ៖ session ផ្ទាល់ទូរស័ព្ទ (Blob សរសេរមិនបានពេល Login) មិនប្តូរ — App refresh វាតាមអាយុដោយខ្លួនឯង · ការ Login តាមអាយុនៅ background នៅដដែល (មិនពឹងលើវាទៀត)។

### 2026-10-21 — A263 ៖ បិទការរកឃើញ A262 ដែលបានផ្ទៀង · ផ្លូវ Admin · ការសម្រេចម្ចាស់គម្រោង

សំណើម្ចាស់គម្រោង៖ «បង្កើតផ្លូវ Admin សម្រាប់ Restore ចាស់» · ការសម្រេច FIXSHOP-3 = ត្រាតាមឧបករណ៍ · ZS-A1..3 = ជួសក្នុងតំបន់ ZTO ចាក់សោ (សំណើម្ចាស់គម្រោង 2026-10-20 ➜ LOCK sha256 ថ្មីរបស់ `zto-status.ts` · `zto-order-detail.js`) · «បន្តដោយខ្លួនឯង ... សម្រេចតាមគំនិតអ្នក»។ រាល់ការកែ ៖ fixer ➜ reviewer ប្រឆាំង (mutation លើ guard) ➜ ជុំកែបន្ទាប់ រហូត OK ឬនៅសល់តែព្រំដែនដែលកត់ទុក។

**[Low] FIXSHOP-2 ការបោះបង់ Restore ស្វ័យប្រវត្តិមិនគោរព lease ដែលនាឡិកាឧបករណ៍ផ្សេងលឿនជាង។** Root cause៖ `restoreAwaitsCancellation()` វាស់ lease ដោយ view ក្នុងសតិ ហើយ `claimedAt` លើសម៉ោងបច្ចុប្បន្នត្រូវចាត់ថាមិនសកម្ម · ការបង្កកក្នុង transaction មិនពិនិត្យ lease លើតម្លៃ server។ Danger scenario៖ ឧបករណ៍ A ស្តារ (នាឡិកាលឿន ៤០០ ms · retry ដោយ token ដដែល) ខណៈ B (មើលជា Palm) ឃើញ claim ចាស់ក្នុង cache ➜ B បង្កកការស្តារដែលកំពុងរស់។ Fix៖ `RESTORE_CLAIM_FUTURE_MS` · view ធុងសំរាមត្រូវស្រស់ · ការបង្កកពិនិត្យ lease ឡើងវិញលើតម្លៃ server តែផ្លូវផ្ទៃក្រោយ (`evidenceOnly`) ⛔ មិនមែនផ្លូវអ្នកស្តារខ្លួនឯង។ Guard ៖ `zto-trash-mode-shop` ៤ តេស្ត (ក្រហមលើ add5673 · M10 ៖ ដក tolerance ក្នុង transaction ➜ ក្រហម)។

**[Low] ZS-A1..3 (តំបន់ចាក់សោ · សំណើម្ចាស់គម្រោង)។** ZS-A1 ៖ barcode ដែលការផ្ទៀងស្តារកត់ «មិនទាន់ Sign» (record ZTO គ្មានទិន្នន័យអតិថិជន) មិនចេញពីរបាពេល ZTO Sign ព្រោះ Cookie មិនផ្ញើ `status=1` ហើយ cache «រកមិនឃើញ» បាំង ➜ ផ្ញើ `status=1` ទាំងពីររបៀប · ការអានស្ថានភាពរំលង cache អវិជ្ជមាន។ ZS-A2 ៖ barcode បិទដែល record មាន `ztoSignedAt` (Sign នៅសាខាផ្សេង) នៅក្នុងរបា ➜ មិនចូល · `holdFalse` មិនរក្សា `false`។ ZS-A3 ៖ ចម្លើយ `ZTO_NO_CUSTOMER_DATA` រំលងការត្រួតសាខា ➜ ឆ្លង `ZTO_DETAIL_BRANCH_PATHS` ដូច `/detail` (fail-closed)។ Guard ៖ `zto-restore-verification` · `zto-sign-evidence-refresh` (ក្រហម ៤ លើ add5673) · `zto-list-bare-record-probe` (ការទាញបញ្ជី Cookie ៖ signed ➜ កើតបិទ · unsigned ➜ `too-old-open` · គ្មាន verdict ➜ `too-old-unknown` · ក្រហម ៤/៤ ពេលដាក់ URL ចាស់វិញ)។

**[Medium] FS-3 · [Low] FS-1 · FS-2 · FS-4..FS-9 · CHK-7..9 — ផ្លូវ Lookup Google Sheet (ជុំបន្ត)។** FS-3 ៖ ចុចនាំចូលខណៈ prepare ឯកសារ B កំពុងរង់ចាំ ➜ mapping ឯកសារ A អនុវត្តលើ B ➜ ឥឡូវប៊ូតុងបិទ · mapping −1 · `runSheetImport` បដិសេធ។ FS-1 cache Fast Mode ចាស់ក្រោយនាំចូល · FS-2 លទ្ធផលក្រោយបិទផ្ទាំងមិនដល់តារាង · FS-4 `newOnly` ជឿជួរដោយ `added` មិនត្រូវ · FS-5 Setup Link បាត់ `key=` ពេលបង្កើតបរាជ័យ ហើយបង្កើតម្តងទៀត (ជួសរួមក្នុងជុំ ៣ ៖ ដកពីវាលតែក្រោយជោគជ័យ · Apps Script គ្មាន key ឬ key ទទេ ឬ key + Header ➜ សារជាក់លាក់) · FS-6 ឈ្មោះ secret ពាក្យតែមួយ (`authtoken` · `clientsecret` …) ➜ ពាក្យវែងរកកន្លែងណាក៏បាន · FS-7 upsert Column មិនផ្គូផ្គង ➜ តាម `scriptVersion` ≥ 3 · FS-8 ចម្លើយ `ok:false`/មិនមែន JSON ➜ «មិនទាន់ដឹងលទ្ធផល» (writer `Code.gs` v4 រាយការណ៍ `written`) · FS-9 លេខទូរស័ព្ទគ្មានខ្ទង់ ➜ ទទេដូចអ្នកអាន · CHK-7 `customerTableNeedsRefresh` slack · CHK-8 `zto-import/test.js` អានពិដានពី measure tree · CHK-9 `SCRIPT_VERSION` អ្នកអាន = ZoeW។ Review ៣ ជុំ ៖ Lookup កំពុងរត់ពេលនាំចូលចុះ ➜ សញ្ញា `lookupsSupersededByImport` (មិនសរសេរតារាង/cache · សម្អាតជាមួយ cache តារាង · Lookup ZTO មិនប៉ះ) · guard ពាក្យ secret ទាញពី regex ពិតទាំងពីរ App (ដកពាក្យណាមួយ ➜ ក្រហម ៧២/៧២)។ **ព្រំដែនទទួលយក** ៖ ចម្លើយ Lookup ដែលអាន Sheet មុនការនាំចូលនៅតែបំពេញផ្ទាំងស្កេន ហើយ auto-save តម្លៃនោះ (= ស្កេនមុនបន្តិច · ចំណុចកែស្ថិតក្នុង `auto-lookup.ts` ចាក់សោ) ➜ មិនកែ។

**[Low] CHK-4 · CHK-5 · CHK-6 (តេស្តតែប៉ុណ្ណោះ)។** CHK-4 ត្រា `ztoSignedAt` ពី sweep · CHK-6 ធុងសំរាម `returned` ដែលមាន `ztoSentOutAt` · CHK-5 gate របស់ការសម្អាតស្វ័យប្រវត្តិក្នុងហាង ZTO (sweep · នាឡិកា · claim ខ្លួនឯង · គម្លាតត្រា · តាមត្រាឧបករណ៍) ➜ mutation TM2/TM6/TM7/TM9 ក្រហម។

**[Medium] FIXSHOP-3 ត្រារបៀបធុងសំរាមទូទាំងហាង (ការសម្រេចម្ចាស់គម្រោង ៖ ត្រាតាមឧបករណ៍ · ពិនិត្យឡើងវិញ ៦ ជុំ)។** Root cause៖ ត្រារួម `palmAt`/`cookieAt` មួយ ➜ ឧបករណ៍ Palm ដែលចាកចេញដកត្រាដែលឧបករណ៍ Palm ផ្សេងនៅពឹង (ឬត្រាថ្មីជាន់គ្នា) ➜ ឧបករណ៍គ្មាន ZTO ធ្លាក់ទៅ Cookie/local រហូតដល់ឧបករណ៍ Palm សរសេរម្តងទៀត (រហូត ៦ ម៉ោង) ➜ ស្តារកញ្ចប់ Sign បាន។ Fix៖ ត្រា `palm/<សោឧបករណ៍>` · `cookie/<សោឧបករណ៍>` (សោចៃដន្យក្នុងហាង ⛔ មិនមែនលេខសម្គាល់ឧបករណ៍) · របៀប = ត្រាថ្មីបំផុតរបស់ឧបករណ៍ណាមួយ (`palmAt`/`cookieAt` ចាស់រាប់) · ការដកត្រាជា «បំណង» ក្នុងឧបករណ៍ · ការសម្អាតត្រាចាស់ CAS · ការសរសេរតែពេលសញ្ញាហាងអានបានពី Database ដែលបម្រើហាងនោះ (`ztoTrashModeWritable()`) · transaction advisory ៖ មិនដែល `unknown` មិនចូល journal (ការជួបពិនិត្យជុំ ៥–៦ ៖ Firebase ពីមុនរាយការណ៍ money ហើយ blocked ការសរសេរទាំងអស់ពេល rules មិនទាន់ Publish) · rules បដិសេធ ➜ ផ្អាក ៦ ម៉ោង + ត្រាចាស់ម្តង + Sentry `data` ម្តង។ Root fix បន្ថែម ៖ `native-write-recovery` ជួរ CAS ធម្មតា (គ្មាន `op`) ដែលការអានស្តារត្រូវ rules បដិសេធ ➜ ទម្លាក់ (មុន ៖ `blocked` ➜ ឧបករណ៍ឈប់សរសេររហូត 🩺) · `react-view` `literalInit` ទទួល literal ជាន់ៗ (sandbox ឃើញ `ztoTrashMode`)។ Guard ៖ `zto-trash-mode-devices` · `zto-trash-mode-shop` · `native-recovery-plain-cas` · `native-durable-write` · `session-switch-fuzz` · `supabase-journal-recovery` · `emu/app-writes-rules-test` · `emu/supabase-rules-parity-test` (mutation ជុំនីមួយៗក្រហម)។

**[Medium] Rules ថ្មី × App ចាស់ (វាស់មុន Publish)។** App `main` (`2.50.135`) × rules របស់ branch លើ emulator (`emu/app-writes-rules-test` លើ build `main`) ➜ ១៩ ok · ១ FAIL ៖ App ចាស់ (`syncZtoFinalMarks()`) ដាក់ `ztoSignedAt` លើធាតុធុងសំរាមដែលមានស្រាប់ ហើយ rules ទាមទារ `restoreBlocked` ➜ ការលុប/ដក/សម្អាតកញ្ចប់ Sign លើឧបករណ៍ចាស់ត្រូវបដិសេធ។ Fix ៖ `ztoSignedAt` គ្មាន `restoreBlocked` ទទួលតែលើធាតុគ្មាន `trashMode` (អ្នកសរសេរ legacy) · ធាតុមាន `trashMode` (App ថ្មី) នៅត្រូវមាន flag ➜ ២០ ok · ០ FAIL · parity ២ backend (create · leaf · rewrite · restamp legacy ទទួល · `trashMode` គ្មាន flag បដិសេធ) · `emu/restore-deadlock-test` ៣៩ · `cleanup-resume-session`។ ទិសផ្ទុយ (App ថ្មី × rules ចាស់ ៖ `$other` បដិសេធ `trashMode`) ➜ លំដាប់ Publish មុន (ផ្នែក ១ សកម្មភាព ១)។ Migration Supabase តែមួយ `20261021030435_zoe_rules.sql` ជំនួស migration ពីរដែលមិនដែល push។

**[Medium] MX-1 កំណត់ត្រាចំណូលតាមថ្ងៃយក (mirror) រួចពី App ត្រូវ kill (ពិនិត្យឡើងវិញ ៦ ជុំ)។** Root cause៖ ការបិទ/បើក/ដក សរសេរ mirror ក្រោយការសរសេរប្រាក់/ទិន្នន័យ ដោយគ្មាន journal ➜ App ស្លាប់ចន្លោះ ➜ កំណត់ត្រាបាត់ ឬចាស់។ Fix ៖ journal ស្ថិតិយកកាន់ item ហើយនៅរហូតដល់ reconcile mirror ឆ្លើយ `true` · journal សម្អាតមានជំហាន `collected` ក្រោយ `flip` (គ្មានការងារប្រាក់) · ការដកផ្ទាល់កាន់ live marker រហូតដល់ការលុប mirror ឆ្លើយ។ ការរកឃើញតាមជុំ ៖ ៣ ៖ entry ហាងផ្សេងទម្លាក់ស្ងាត់ · offline ចំណាយ `dbOp` ១៥ វិនាទីក្នុងមួយ entry ➜ Sentry · `false` ភ្លាម · ៤ ៖ ការលុប mark ចុះយឺតលុប mark របស់ barcode ដែលឧបករណ៍ផ្សេង Restore ហើយបិទវិញ ➜ `remarkCleanupCollectedKept()` · ៥ ៖ ប្រតិបត្តិការមួយ ២–៣ សញ្ញា money · ជុំទម្លាក់ ៨ entry ផ្ញើបានតែ ៥ (តម្រង repeat) · mark ដាក់វិញលើការស្តារដែលបោះបង់ · Remove legacy `isDeducted` ស្លាប់នៅ slot ដក ២ ដង (`[100,10,10]` ➜ `[96,9,9]`) ➜ `switchReported` · ផ្ញើមួយក្នុងមួយ zone ក្នុងមួយជុំ · journal កត់ប្រាក់តែ barcode ដែលផ្លូវផ្ទាល់ដក · ៦ ៖ Delete សញ្ញា ២ · សញ្ញាទម្លាក់បាត់ពេលទំព័រស្លាប់ · barcode ដករួច legacy មិនដក mark · `cleanupCollectedKept()` រក្សា mark ការស្តារមិនទាន់ចប់ · ការសរសេរ mirror ក្រោយប្តូរ session ➜ `noteDeleteSessionSwitch()` · entry ហាងផ្សេងមុនគេ · `cleanupDropsMirror()` · រំលង `restoreAddedCodes` · `isCurrent()` ក្រោយការអាន។ Guard ៖ `ZoeW/tests/collected-mirror-durable.test.ts` (៨១ តេស្ត · ក្រហមលើ commit មុនជុំនីមួយៗ) · `pickup-cleanup-collected-race` · `payload-schema` (`LOCAL_RECORDS`) · `emu/money-multidevice-emu-test` ៨/៨ · `money-guardian-test` ២៥ · ២២ · `revenue-fuzz-test`។

**ច្បាប់ Runbook (សំណើម្ចាស់គម្រោង)។** run-all STRICT ពេញក្នុង session (៤ CPU) ចំណាយ ៦០–៩០ នាទី ហើយប្រជែង CPU ជាមួយការងារ ខណៈ CI បំបែក ៤ ម៉ាស៊ីនចប់ក្នុង ~១៥ នាទី ➜ ម្ចាស់គម្រោង ៖ «ពេលចប់ការងារ push ចាំលទ្ធផលពី CI»។ Runbook ជំហាន ០ · ៣ ៖ session រត់តែការពិនិត្យលឿន (`node --check` · `strip-comments` · tsc · eslint · vitest តាមតំបន់ · checker តាមតំបន់លើ measure tree · `doc-scope-test` ជាមួយ `ZOE_REPO_ROOT`) ➜ push ➜ CI ៤ ផ្នែកបៃតងទាំងអស់ ទើបរាយការណ៍ថាចប់ · ផ្នែកក្រហម ➜ ផលិតឡើងវិញតែ checker នោះក្នុង session។ ទង់ STRICT របស់ Runbook នៅដដែល (`runall-runner-test` ផ្ទៀង CI ⊇ Runbook)។

**ការផ្ទៀងផ្ទាត់ចុងក្រោយ A263 (reviewer ប្រឆាំង ៥ ផ្នែក + អ្នកបដិសេធម្នាក់ក្នុងមួយការរកឃើញ)។** ពិត ៖ MX1-PJ-1 [Low] journal ស្ថិតិយករង់ចាំ mirror មុនជម្រះ តែ `resumePickupIntents()` សរសេរ pickup ដែលចុះរួចម្តងទៀត ➜ Reset ចំនួនយករួចពីឧបករណ៍ផ្សេងត្រឡប់មកវិញ (វាស់ ៖ head `packagesPickedUp` 1 · 1d9fc09 0) · FS3 [Medium] App ចាស់ស្តារធាតុធុងសំរាមរបស់ App ថ្មីទៅជួរថ្មីមិនបាន (`trashMode` ចម្លងទៅ history · `$other`) ហើយត្រា Sign របស់វាលើធាតុ `trashMode` ត្រូវបដិសេធ ➜ សម្រេច ៖ ព្រំដែនរយៈលាយ (ការកែ rules + ការដក `trashMode` ពី history នៅគ្រប់ទ្វារ ៩ កន្លែងប្រថុយលើផ្លូវប្រាក់ ចំណែកលំដាប់ rollout ដោះស្រាយបាន) + probe parity ទាំង ២ backend · DOC-1..4 ឯកសារ (ការអះអាងភាពត្រូវគ្នា App ចាស់ · `CLAUDE.md` ផ្ទុយគ្នា · ជួរ trash mode · body announcements «កែ… ពង្រឹង…» ➜ អ្នកយាម `doc-scope-test` ពាក្យរាយការណ៍ការកែក្នុង 🔔) · GG-2 · GG-3 guard ខ្វះ (`ztoTrashModeWritable()` `mark.state` · តម្រៀប entry ហាងផ្សេងមុន)។ បដិសេធ ៖ SL-1 (ឈ្មោះ `appkey` តាមច្បាប់ README) · DOC-5 · GG-1។ ស្រាវជ្រាវ «ផ្អាកហាងមុន Publish» (វាស់លើកូដពិត) ៖ Revoke Firebase លុប Activation (ត្រូវវាយ Key ឡើងវិញ) ហើយមិនឃាត់ការសរសេរ · បិទហាង Supabase ចាកចេញ និងបដិសេធការសរសេរជាស្ថាពរ ➜ ច្បាប់ ១០ ក្នុង `CLAUDE.md` + សកម្មភាពដោយដៃ [2.50.136]។

**ការកែក្រោយការផ្ទៀងផ្ទាត់ចុងក្រោយ (reviewer ប្រឆាំង រហូត OK)។** MX1-PJ-1 ៖ ទង់ `pickupDone` ពេលការសរសេរស្ថិតិយកឆ្លើយ `true` ➜ ការស្តាររត់តែ mirror (Reset នៅជាប់) · entry legacy ទទួលទង់តែក្រោយការសរសេររបស់ការស្តារចុះពិត · ការបដិសេធ mirror មានពិដាន (`collectedTries`) · entry ផ្ទាល់មិនត្រូវកាត់ ហើយរស់ពេលនាឡិកាថយក្រោយ ➜ guard ១២ ក្នុង `ZoeW/tests/collected-mirror-durable.test.ts` (mutant M2 · M4 · M12 · M17 · M21 · M22 · R17 · R27 · R29 ក្រហម · ក្រហមលើ fd87f7b ៖ Reset `{packagesPickedUp:0}` ➜ 1) · ពិនិត្យឡើងវិញ ៣ ជុំ។ GG-2 · GG-3 guard (`ztoTrashModeWritable()` `mark.state` · ការតម្រៀបហាងផ្សេងមុន) · DOC-3 pin · FS3 parity probe ទាំង ២ backend (ការស្តារជួរថ្មីរបស់ App ចាស់ ➜ បដិសេធ · merge ➜ ទទួល · ត្រា Sign ធាតុ `trashMode` គ្មាន flag ➜ បដិសេធ)។ កំហុសពិតដែល reviewer រកឃើញ ៖ ចំនួនរាប់ការដកត្រារបៀបធុងសំរាមដែលកំពុងផ្ញើ (`ztoTrashModeWithdrawing`) នៅទូទាំងទំព័រ ➜ ការដកត្រាដែលព្យួរឆ្លងការប្តូរ backend រារាំងការដកត្រានោះរហូតបើក App វិញ (ត្រា Palm ចាស់នៅ ៧ ថ្ងៃ) ➜ ជាកម្មសិទ្ធិ session (Database + `authGeneration`) · guard ក្នុង `zto-trash-mode-devices` (ក្រហមលើកូដចាស់)។

**ព្រំដែនដែលទទួលស្គាល់ (A263)។** (១) abandon ដែល ledger `unknown` ➜ «រង់ចាំការបញ្ជាក់» + hand-off «unverified» = សញ្ញា money ២ ក្នុងហាងដដែល (ក្រៅ MX-1 · សញ្ញាលើស មិនមែនប្រាក់ខុស)។ (២) ម្ចាស់ពីរនាក់ចុច 🛠️ ព្រមគ្នា + ការស្កេនចន្លោះ ➜ ការសរសេរទាំងជួរលើកទីពីរអាចជាន់ការស្កេននោះ (គ្មាន CAS)។ (៣) Remove ដែលផ្អាក + Reconfig ➜ mark mirror ហាងដើមនៅរហូត retention (Sentry `data`)។ (៤) FS-2 ៖ ចម្លើយ Lookup ដែលកំពុងរត់ (ឯកសារ `auto-lookup.ts` ចាក់សោ) រក្សាទុក COD មុននាំចូល ➜ ការអានរៀបលំដាប់មុនការនាំចូល។ (៥) tab ពីរនៃ install តែមួយប្តូររបៀបក្នុងវិនាទី ➜ ត្រាមួយមកក្រោយ (៦ ម៉ោងជួសខ្លួនឯង)។ (៦) APK WIP ចាស់អានតែ `palmAt` ➜ ធ្វើបច្ចុប្បន្នភាព។ (៧) ឧបករណ៍លាយ ៖ App ចាស់ស្តារធាតុរបស់ App ថ្មីទៅជួរថ្មី និងដាក់ត្រា Sign លើធាតុ `trashMode` មិនបាន (FS3 ខាងលើ · ប្រាក់មិនប្រែ) ➜ ស្តារលើឧបករណ៍ថ្មី · ឧបករណ៍ ZTO ធ្វើបច្ចុប្បន្នភាពមុនគេ។ (៨) rules ថ្មីបដិសេធការសម្អាតការស្តារដែលគេបោះចោលរបស់ App ចាស់ (`clearStaleRestoreMarkers` · `releaseStaleRestoreClaimForPurge`) ដោយចេតនា (បិទទ្វារ «ghost») ➜ ជួរនោះរង់ចាំការចុច 🔄 ឡើងវិញ ឬ 🛠️ លើឧបករណ៍ថ្មី។ (៩) mirror ចំណូលតាមថ្ងៃយករបស់ការស្តារ (`executeRestoreItem()` ក្រោយ finalize) មិនទាន់មាន journal ➜ ទំព័រស្លាប់ចន្លោះនោះ កំណត់ត្រាខ្វះរហូត reconcile បន្ទាប់ (ប្រាក់មិនប៉ះ · journal មុន finalize នឹងដាក់ mark លើកូដរបស់ការស្តារមិនទាន់ចប់ ដែលច្បាប់ហាម)។ (១០) ព័ត៌មាន (មានពីមុន) ៖ entry ស្ថិតិយកមិនផ្ទាល់ត្រូវទម្លាក់ពេលនាឡិកាថយក្រោយ · `trimPickupJournal()` អាចកាត់ entry ផ្ទាល់របស់ tab ផ្សេង · `notePickupCollectedRefused()` អាចផ្ញើ Sentry សម្រាប់ entry ដែល tab ផ្សេងលុបរួច។

**Checker ៖** `item-money-integrity-test` FAIL 3 ក្រោយ BOOT របស់ fuzz ផ្តល់ម៉ោង Server ពិត (6e930ea) ➜ ច្បាប់ ៨ ថ្ងៃពិតយកជួរ legacy មុនការហៅផ្ទាល់ (bisect ៖ មិនមែនកំហុស App) ➜ ផ្អាក `runAutomaticCleanupRules` តែក្នុងសេណារីយ៉ូ + អះអាងថាទ្វារពិតត្រូវហៅ · `emu/crud-rules-flow` sandbox ខ្វះ `RESTORE_CLAIM_FUTURE_MS`/helper Admin ➜ បន្ថែម។

### 2026-10-20 — A262 ៖ បន្ត PR340 · ផ្លូវ Lookup Sheet · ចំណូលតាមថ្ងៃយក · ផ្ទៀងឡើងវិញ

សំណើម្ចាស់គម្រោង៖ បន្ត PR340 (ដំណាក់ ១–៣ រួច · ដំណាក់ ៤ មិនទាន់ចប់) · «ផ្ទៀងផ្ទាត់ការងារទាំងអស់ឡើងវិញអោយល្អិតល្អន់» · «មើលផ្លូវ lookup ពី sheet»។ ម្ចាស់គម្រោងជ្រើស «ទូទាំងហាង» សម្រាប់ច្បាប់ធុងសំរាម។ ការផ្ទៀងប្រើ workflow (lens ៖ shop-mode · restore · zto-sign · matrix · collected · checkers · sheet + អ្នកផ្ទៀង)។ ⛔ Locked zone ៖ `zto-status.ts` · `zto-order-detail.js` ប្តូរក្នុងជុំ audit ដែលម្ចាស់គម្រោងស្នើ (ZS-1..5 ខាងក្រោម) ➜ LOCK ថ្មីក្នុង `ZoeW/tests/zto-lock.test.ts` · តេស្ត ZTO ទាំងអស់ PASS។

**[Medium] COL-1 កំណត់ត្រាចំណូលតាមថ្ងៃយកបាត់ ពេលការសម្អាត «យករួច» មកមុន reconcile នៃការបិទ។** Root cause៖ `reconcileCollectedHistory()` រកតែ `history/<id>` ហើយ `trash/<id>` តែពេលជួរបាត់ទាំងមូល; ការសម្អាតផ្នែកដាក់ barcode ក្នុង id ផ្សេង (`cleanupPartialTrashId()`) ➜ រកមិនឃើញ ➜ មិនសរសេរ ហើយគ្មានផ្លូវណាសរសេរវាទៀត។ Danger scenario៖ Cookie «ភ្លាម» ៖ ACK នៃការបិទយឺត ➜ final marks (២ វិ.) និង sweep claim barcode ក្នុងចន្លោះ · ឬ Supabase reply បាត់ ហើយឧបករណ៍ B សម្អាតមុនការផ្ញើឡើងវិញ ➜ អេក្រង់ចំណូលតាមថ្ងៃយកខ្វះ COD នោះ។ Fix៖ ការបិទលើឧបករណ៍នេះទប់ `claimAndCleanupItem('close')` នៃជួរនោះរហូត reconcile ចប់ (`holdCollectedSettle()` · ≤ `COLLECTED_SETTLE_HOLD_MS`) · barcode ដែលឧបករណ៍ផ្សេងដកចេញ ➜ អានពីច្បាប់ចម្លង trash `pickup` (deleted view ➜ អាន server ឡើងវិញ) ⛔ មិនមែន `remove`/`returned`។ `ZoeW/tests/pickup-cleanup-collected-race.test.ts` ៖ មុនកែ ៥ FAIL (ឧបករណ៍ដដែល ×២ · ឧបករណ៍ផ្សេង · unknown ×២) ➜ ក្រោយកែ ១០ PASS (control និងទិសផ្ទុយ `remove` ➜ ០ record)។ Lens collected រកឃើញដោយឯករាជ្យ (probe A)។

**[Low] COL-2 ការព្រមាន «…មិនទាន់ Sync ពេញលេញ» ក្លែង។** Root cause៖ ការអានផ្ទៀងក្រោយសរសេរ mirror ឃើញ barcode ទៅ trash `pickup` ➜ null ➜ ចាត់ថាបរាជ័យ ទោះ record ត្រឹមត្រូវ។ Fix៖ ផ្លូវអានដដែលនឹង COL-1 + ការទប់។ Regression FAIL មុនកែ ➜ PASS (✅ បង្ហាញ · គ្មាន ⚠️)។

**[Medium] COL-3 ការបិទដែលលទ្ធផល `unknown` មិន reconcile mirror។** Root cause៖ ផ្លូវបរាជ័យ revert ស្ថិតិយករួចពី server តែមិនប៉ះ `zoew_daily_collected_cod_dod`។ Danger scenario៖ disconnect ហើយ REST អានឃើញតម្លៃផ្សេង (ឧបករណ៍ផ្សេង stamp ZTO/Locker) ➜ `unknown` ➜ server បិទ · ស្ថិតិយករួចមាន · ចំណូលតាមថ្ងៃយកខ្វះ។ Fix៖ `txOutcome: 'unknown'` (ភ្លាម ឬ late) ➜ reconcile ពី server (`healCollectedAfterUnknown`) លើទ្វារទាំងពីរ។ Regression ៖ landed ➜ ១ record (FAIL មុនកែ) · មិន landed ➜ ០ (ទិសផ្ទុយ)។

**[Medium] COL-4 បិទទាំងជួរ stamp barcode ដែលបិទរួច។** Root cause៖ `toggleCloseStatus()` អនុវត្តលើគ្រប់ barcode; ការកែ ZTO-3 ធ្វើតែ `applyBarcodeCloseChange()`។ Danger scenario៖ C បិទម្សិលមិញ 23:30 · ថ្ងៃនេះបិទទាំងជួរ ➜ ចំណូល C រំកិលទៅថ្ងៃនេះ · Local ២ ម៉ោងចាប់ផ្តើមឡើងវិញ · ក្រោយ «Reset ចំនួនយករួច» C ត្រឡប់ (០ ➜ ២ ជំនួស ១)។ Fix៖ stamp និង mark តែ barcode ដែលប្តូរ; `closedAt` ជួររក្សាពេលគ្មានអ្វីប្តូរ។ `ZoeW/tests/close-restamp-idempotent.test.ts` ផ្នែក COL-4 ៖ ៣ FAIL មុនកែ · ទិសផ្ទុយ (បើក ➜ បិទម្ដងទៀត ➜ stamp ថ្មី) PASS។ CI ដំបូងនៃ PR341 ចាប់ការកែដំបូង ៖ ការដក barcode ដែលមិនប្តូរចេញពី mark របស់ server ធ្វើឲ្យ `reapplyPickupMarks()` ត្រឡប់ mark ក្នុងស្រុកទៅស្ថានភាពចាស់ (A បើកជួរក្រៅបណ្តាញ · B បើកមុន ➜ server ០ ➜ ១ ៖ `pickup-barcode-identity-test` ៣ឃ · `money-guardian`)។ ការកែចុងក្រោយ ៖ ការបើកវិញ mark គ្រប់ barcode · ការបិទ mark barcode ដែលប្តូរលើ server + barcode ដែលទិដ្ឋភាពឧបករណ៍នេះបាន mark (`localMarkedKeys`) ➜ គ្មាន undo ចាស់ · barcode ដែលទិដ្ឋភាពទាំងពីរឃើញបិទរួច មិនប៉ះ (Reset មិនត្រឡប់)។

**[Low] ធុងសំរាមចាស់ Sign រួច + claim Restore ចាស់ purge មិនបាន។** Root cause៖ rules `barcodes/$idx/ztoSignedAt` ទាមទារ `restoreBlocked === true`; `releaseStaleRestoreClaimForPurge()` សរសេរធាតុទាំងមូលដោយគ្មាន flag ➜ `permission_denied` រៀងរហូត (purge ស្ងាត់ · លុបដោយដៃ ❌)។ Fix៖ release ដាក់ `restoreBlocked` ពេល barcode មានភស្តុតាង Sign (គ្មាន `trashMode` ប្រឌិត)។ Vitest (rule ក្លែង) FAIL មុនកែ · `emu/restore-deadlock-test` ផ្ទៀង rules ពិត៖ គ្មាន flag ➜ បដិសេធ · មាន flag ➜ ដោះ claim និង purge បាន (១៥ PASS)។

**[Low] Push ៖ ការរំលឹកម៉ោង ៨ ត្រូវដំណឹងស៊ីបង្អួច claim។** Root cause៖ PR340 ប្តូរ `PUSH_CLAIM_RESERVE_MS` ទៅ ១៦ វិ. ➜ claim ចាប់ផ្តើមបានតែ ៤ វិ. ដំបូង; ដំណឹងរត់មុនជាមួយ `startedAt` ដដែល ➜ ការអានដំណឹងគាំងដល់ពិដាន ៤ វិ. កាត់ការរំលឹកគ្រប់ run ក្នុងម៉ោង ៨។ Fix៖ `runPushCron()` រត់ការរំលឹកមុនដំណឹង (ក្រៅម៉ោង ៨ ចប់ភ្លាមគ្មាន I/O · ដំណឹងថ្មីមាន `op=kick`)។ Regression ៖ ការអានគាំង ១២ run ➜ ការរំលឹក ១ (FAIL មុនកែ) · `ZoeW/tests/push-server.test.ts` រួម scale ៣០០០ ឧបករណ៍ / ៤០០ ហាង ៩៦ PASS។

**[Low] Queue Sign ៖ row អានមិនបានរារាំង barcode នោះ។** Root cause៖ id = sha256(owner + code) មិនអាស្រ័យ key · `addSignJob()` បដិសេធ id ដដែល។ Danger scenario៖ «ភ្លេច PIN?» ➜ PIN ថ្មី ➜ Sign កញ្ចប់នោះលែងបានលើឧបករណ៍នោះ។ Fix៖ Sign ថ្មីជំនួស row ដែល key បច្ចុប្បន្នបើកមិនបាន (`replaceSignJob()` លើ revision) · សារប្រាប់ឲ្យ Sign ម្ដងទៀត។ Regression FAIL មុនកែ · outbox suites ៣៩ PASS។

**[Low] Freeze ដដែលរាល់ជុំ recovery។** `cancelBlockedRestore()` សរសេរ `restoreBlocked` ដដែលទោះ freeze រួច ➜ ឥឡូវរំលង (regression FAIL មុនកែ)។ តេស្តប្តូរគណនីពឹងលើការសរសេរ freeze នោះ ➜ ប្តូរទៅ «ការសរសេរដំបូង» (មិនអាស្រ័យ path)។ ព្រំដែន ៖ legacy prepare គ្មាន `restoreAddedCodes` នៅទប់ជួរ history ឲ្យ Admin ផ្ទៀង (មិនស្មានលុប)។

**[Low] MX-3 ឧបករណ៍ចាកពីរបៀប ZTO ដកត្រាហាងរបស់ឧបករណ៍ផ្សេង។** Root cause៖ `withdrawZtoTrashMode()` សរសេរ `palmAt: null` ទោះត្រានោះជារបស់ឧបករណ៍ Palm ផ្សេងដែលនៅសកម្ម។ Danger scenario៖ ឧបករណ៍មិនភ្ជាប់ ZTO ធ្លាក់ទៅច្បាប់ local ២ ម៉ោង ➜ កញ្ចប់បិទតែមិនទាន់ Sign ចូលធុងសំរាម `trashMode: 'local'` (ស្តារបាន) ក្នុងហាង Palm។ Fix៖ ដកតែត្រាដែលខ្លួនសរសេរ (`ztoTrashModeStamped`) តាម transaction ដែលសរសេរ null តែពេលតម្លៃនៅជារបស់ខ្លួន · op ដកត្រាចូល revenue-fuzz ➜ `emu/app-writes-rules-test` replay ជាមួយ rules ពិត។ Regression FAIL មុនកែ (ត្រាឧបករណ៍ផ្សេង · ត្រាដែលទើបចុះថ្មី)។

**CI ដំបូងនៃ PR341 ក្រហម (ទាំងអស់ជារបស់ PR នេះ) ៖** sandbox ៥ ខ្វះ `ztoTrashModeOf` · `raw-read-shape-test` ខ្វះ helper ថ្មីក្នុង transaction បិទទាំងជួរ · parity `wrong-owner` ហួសសម័យក្រោយ alt 5 លែងទាមទារ token (1d9864c) ➜ ឥឡូវទទួល · toast ZoeKeyGen គ្មាន prefix ថ្នាក់ · COL-4 ខាងលើ។ មូលហេតុរួម ៖ ខ្ញុំរត់តែ checker មួយផ្នែកមុន push ➜ ⛔ run-all STRICT ពេញមុនរាល់ push (Runbook ជំហាន ០)។

**[High] iPhone PWA ផ្តេក ៖ បញ្ជីប្រវត្តិមើលមិនឃើញ (រាយការណ៍ម្ចាស់គម្រោង · រូបថត iPhone 16)។** Root cause៖ លើ iOS standalone `--page-extension`/`--chrome-bottom` = កម្ពស់ body (`100dvh` + safe-area) − `innerHeight` វាស់តែពេល `resize` · `visualViewport` `resize` · ResizeObserver content-box លើ navbar/tab bar (`chrome-autohide.ts`, ចាក់សោ)។ ពេលបង្វិល WebKit ឲ្យ `innerHeight` ថ្មីក្នុងព្រឹត្តិការណ៍ resize ខណៈ `100dvh` នៅតម្លៃបញ្ឈរ ➜ 886 − 393 = 493 ➜ `--chrome-bottom` 559 គាំង (គ្មានព្រឹត្តិការណ៍ក្រោយ)។ Danger៖ កាតបញ្ជី = 393 − 52 − 559 − 16 < 0 ➜ 0px · ក្បាលកាតហៀរ · `#appPages` padding 567px ➜ មើលឃើញតែផ្ទៃទទេ (ត្រូវនឹងរូបថត) · បង្វិលត្រឡប់ ➜ បញ្ជី 26px នៅក្រោម tab bar · iPhone SE ៖ safe-area តែម្នាក់ឯងប្តូរ ➜ `--chrome-top` ខុស 20px។ Fix៖ `listenIOSPageSize()` (ios-viewport.ts · មិនប៉ះឯកសារចាក់សោ) ៖ ResizeObserver លើ body និង border-box របស់ navbar/tab bar ➜ `measureAppChromeSize()` ឡើងវិញ · តែ iOS standalone (`usesIOSPanelHandoff()`)។ វាស់ ៖ ធរណីមាត្រ JSON ដូចគ្នាបេះបិទមុន/ក្រោយក្នុង ១៧ សេណារីយ៉ូដែលគ្មានការបង្វិលយឺត (iOS បញ្ឈរ · iPad · Android · tablet · desktop)។ អ្នកយាម ៖ `panel-motion-test` (+៨ ៖ បង្វិលយឺតទាំងពីរទិស · SE inset) ➜ មុនកែ ៣ FAIL · ការជួសដំបូង (body តែម្នាក់ឯង) ១ FAIL · ចុងក្រោយ 119/119។ ព្រំដែន ៖ លំដាប់ WebKit (dvh/env មកក្រោយ resize) វាស់មិនបានក្នុង Chromium ➜ ត្រូវសាកលើ iPhone ពិត (📌)។

**[Medium] FIXSHOP-1 ៖ ឧបករណ៍មើលជា Palm បង្កក Restore របស់ឧបករណ៍ Cookie (ផ្ទៀងផ្ទាត់ដោយ lens fix-shop-restore + verify)។** Root cause៖ `restoreAwaitsCancellation()` (SHOPMODE-1) សម្រេចដោយ `trashRestoreBlockOf(item)` ដែលឆ្លើយ `palm` សម្រាប់គ្រប់ធាតុពេលរបៀបឧបករណ៍/ហាងជា Palm ➜ `cancelBlockedRestore()` សរសេរ `restoreBlocked: true` (monotonic)។ Danger៖ ហាងចម្រុះ Palm + Cookie ៖ ទូរស័ព្ទ Cookie ស្តារធាតុ Cookie មិនទាន់ Sign · finalize ធ្លាក់បណ្តាញ · lease អស់ ➜ ទូរស័ព្ទ Palm ណាមួយបង្កកវាជារៀងរហូត · Cookie ឃើញ «Sign ក្នុង ZTO រួច» ពុំពិត · កញ្ចប់ស្តារមិនបាន។ Fix៖ ផ្លូវស្វ័យប្រវត្តិប្រើតែភស្តុតាងលើធាតុ (`trashRestoreBlockOf(item, true)` · `cancelBlockedRestore(…, { evidenceOnly: true })`) ➜ របៀបឧបករណ៍តែម្នាក់ឯងមិនបង្កក · claim/ជួរដែល prepare នៅសម្រាប់ទូរស័ព្ទ Cookie បញ្ចប់ (⏳🔄)។ តេស្ត ៖ `zto-trash-mode-shop` (FIXSHOP-1 ធ្លាក់មុនកែ · ភស្តុតាង Sign ➜ នៅតែបោះបង់ និងបង្កក)។ ព្រំដែន ៖ Restore ដែលបោះចោលក្នុងហាងគ្មានឧបករណ៍ Cookie នៅជាប់រហូតមានឧបករណ៍ Cookie ឬ rules ថ្មីសម្រាប់ rollback គ្មាន `restoreBlocked` (📌)។

**[Medium] ការស្តារ legacy ដែលជាប់ (សំណើម្ចាស់គម្រោង «បង្កើតផ្លូវ Admin»)។** Root cause៖ ការ prepare ពី App ដែលគ្មាន `restoreAddedCodes` (ឬ provenance ខូច) ➜ `cancelBlockedRestore()` ឆ្លើយ `recovery-required` ហើយ rules បិទជួរ H ទាំងស្រុងពេល T `restoreBlocked` (alt 5 ទាមទារ provenance) ➜ H បិទ/បើក/លុប/សម្អាតមិនបាន · T purge មិនបាន · គ្មានផ្លូវក្នុង App។ Fix៖ 🛠️ លើជួរធុងសំរាម (`restoreBlocked` + `restoreClaim`) ➜ PIN `heldRestore` ➜ អាន T និង H ពី server ថ្មី (`readRestoreServerNode()`) ➜ `restoreHeldPlan()` ➜ `confirm()` (Barcode ដែលដក · បិទរួចដែលទុក · គ្មានត្រាដែលទុក · COD/DOD) ➜ `cancelBlockedRestore(…, { admin: true })` ➜ ការសរសេរ root តែមួយ (`releaseHeldRestoreRow()` ៖ ជួរ H ដែលគណនាឡើងវិញដោយ `restoreRowWithout()` + `restoreClaim: null` របស់ T) · រក្សា `restoreBlocked` · មិនបូកប្រាក់ · Sentry money (`removedCod`/`removedDod` · ចំនួនដែលទុក)។ ជួរ legacy ដកតែ copy បើក ដែល `restoredAt` ≥ `deletedAt` របស់ T (ត្រារបស់ prepare) · copy បិទរួចនៅដដែល (mark យក/ចំណូលតាមថ្ងៃយកនៅត្រូវ) · copy គ្មានត្រា (ឧ. slot ធុងសំរាមចាស់) នៅដដែល ហើយរាយការណ៍ · ជួរ item-level ➜ សារដោយដៃ + Sentry មិនសរសេរ។ **ការពិនិត្យ critic (វាស់លើ emulator)៖** ជំនាន់ដំបូងបន្ធូរ alt 5 (ដក provenance/token) ➜ App 2.50.135 (`clearStaleRestoreMarkers` ដក markers ក្នុង transaction ថ្នាំងតែមួយ ទុក Barcode) ត្រូវបានទទួលលើជួរ legacy ដែលជាប់ ➜ claim ត្រូវដោះជាបន្តបន្ទាប់ ➜ «ghost» (copy បើកក្នុង H + T ដកប្រាក់រួច ➜ ក្បួន ៨ ថ្ងៃដកម្តងទៀត)។ Rules ចុងក្រោយ ៖ alt 5 ដើមវិញ + alt ថ្មី (គ្មាន provenance · T blocked · claim ចង្អុលជួរនេះ · **claim ត្រូវដោះក្នុងការសរសេរដដែល**) ➜ ការសរសេរថ្នាំងតែមួយរបស់ App ចាស់ ➜ បដិសេធ · ការសរសេរ atomic របស់ 🛠️ ➜ ទទួល · migration `20261020074743`។ ចន្លោះដែលកែផងដែរ ៖ (b) គោលដៅលែងចង្អុល T ➜ មិនប៉ះ ដោះតែ claim · (d) ក្រោយដក គណនា `isClosed`/`closedAt`/`barcode` ឡើងវិញ · របង shop ក្នុង `cancelBlockedRestore()` + Sentry money ពេលប្តូរ session ក្រោយការសរសេរ · `supabase-update-contract` ចាប់ `sdk.update(`/`api.update(` ដែរ (`markZtoTrashMode` · `markZtoShopSweep` · `createNativeWriteRecovery` · `releaseHeldRestoreRow` ចាត់ថ្នាក់)។ MX-2 ៖ claim លើធាតុដែលស្តារបាន ➜ ប៊ូតុង ⏳🔄។ តេស្ត ៖ `restore-terminal-cancel` (១១ ថ្មីធ្លាក់លើកូដមុនកែ ៖ ការសរសេរតែមួយ · copy បិទរួច/គ្មានត្រានៅ · គោលដៅផ្សេង · item-level · អានមិនបាន · ប្តូរគណនីពេលអាន/ក្រោយសរសេរ · ACK បាត់) · `session-switch-fuzz` (ការអាន REST ត្រូវរាប់ជាការហៅ) · probe rules RTDB+Postgres។ ព្រំដែនដែលនៅ ៖ ជួរកំព្រា (H ដែល claim លែងចង្អុល ប៉ុន្តែនៅកាន់ markers របស់ T) គ្មាន 🛠️ · (c) «ghost» ពី production ចាស់ (H គ្មាន markers តែកាន់កូដ T) អាចដកស្ទួនដោយ ៨ ថ្ងៃ/ដក — មិនទាន់វាស់លើទិន្នន័យពិត (📌)។

**Sheet lookup (A262) ៖** [Medium] តារាងអតិថិជនចាស់ឆ្លើយពេលមានអ៊ីនធឺណិត ➜ ពិដាន `CUSTOMER_TABLE_TRUST_MS` (offline នៅប្រើ) · [Medium] ជួរ Excel ចូលតារាងពេល Lookup ជា ZTO ➜ តែ Lookup បញ្ជី · [Medium] upsert ជាមួយ Column «— មិនប្រើ —» ជាន់តម្លៃ Sheet ➜ បដិសេធ + អ្នកសរសេររក្សា Column មិនផ្គូផ្គង · [Low] អស់ពេល = មិនទាន់ដឹងលទ្ធផល · generation របស់ឯកសារ/header · `key=` ក្នុង Link ➜ រុំដោយកូដ ៦ ខ្ទង់ · template អ្នកអាន v2 (trim key · tab បាត់ ➜ error មិនមែន «រកមិនឃើញ» · លេខ/ទូរស័ព្ទ) · អ្នកសរសេរ v3 · Watch.gs · Index.html។ តេស្តថ្មីធ្លាក់លើ tree មុនកែ (`sheet-lookup-freshness` · `setup-lookup` · `google-sheets-cache-test` · `zto-import/test.js`)។

**ច្បាប់ហាង · Restore · Sign (lens រកឃើញ ហើយកែក្នុងជុំនេះ) ៖** SHOPMODE-1 (Medium) Restore ដែលបោះចោលលើឧបករណ៍មើលជា Palm ជាប់ ➜ `restoreAwaitsCancellation()` · SHOPMODE-2 ត្រា `palmAt` មិនដក ➜ `withdrawZtoTrashMode()` + ចុះត្រាឡើងវិញតាមអាយុ server · SHOPMODE-3 លុប/ដកពេលសញ្ញា pending ➜ របៀបចុងក្រោយនៃហាងដដែល · RST-2 ជួរដែល Restore ផ្សេងរៀបចំរួចមិនមែនគោលដៅ merge · ZS-1 barcode បើកដែលបិទមិនបានលែងសួរ ZTO រាល់ជុំ · ZS-2 `false` + ចម្លើយមិនច្បាស់ ➜ នៅក្នុងរបា (`holdFalse`) · ZS-3 `signedAt` មិនបាត់មុនម៉ោង server · ZS-5 `restore=1` record គ្មានទិន្នន័យអតិថិជន ➜ `ZTO_NO_CUSTOMER_DATA` + verdict។ តេស្តថ្មីទាំងអស់ធ្លាក់មុនកែ (ZS-4 ជាការការពារចង្វាក់)។ ការកែ 563ac0d ៖ ការរក្សាទុក Lookup ចាស់ចងការកំណត់ទៅហាងខុស (setup-lookup ៣ FAIL ក្នុង vitest ពេញ) ➜ `ztoTrashModeOf()`។

**Checker ខូចដោយ commit មុនក្នុងជុំនេះ (រកឃើញមុន CI) ៖** `ztoTrashModeOf()` ថ្មី ➜ sandbox ៧ `ReferenceError` · `emu/crud-rules-flow` ខ្វះឈ្មោះ ៧ (ចាប់ដោយផ្នែក «dependency ក្នុង scope ពិត») · `emu/restore-mutation-emu-test` ខ្វះ `ztoState` (៦៣ FAIL) · lint warning ១ · `tsc -b` typing តេស្ត ២។ ទាំងអស់ PASS ក្រោយកែ (182 ok · 141 ok · …)។ មូលហេតុ ៖ vitest PASS មិនមែនសញ្ញា run-all — sandbox ស្រង់ function តាមឈ្មោះ ត្រូវរត់ឡើងវិញក្រោយប្តូរ helper។

### 2026-10-19 — A261 ៖ Audit ៥ ដំណាក់កាល · ទិន្នន័យពិត និងច្បាប់ធុងសំរាមថ្មី

សំណើម្ចាស់គម្រោង៖ audit បណ្ដាញ/security/race/SW, workflow ZTO, ភាពស៊ីគ្នា Firebase–Supabase, checker បៃតងក្លែងក្លាយ និងលុយក្រោម multi-device/offline/slow/kill។ អនុញ្ញាត agent ជំនួយ ៣ នាក់សម្រាប់ជុំនេះ។ ច្បាប់ថ្មី៖ ZTO Login trash ហាមស្តារទាំងអស់ និង pickup cleanup ២ ម៉ោងក្រោយ Sign ពិត; Cookie pickup cleanup **ភ្លាម** ពេល ZoeW យករួច និង ZTO Sign ពិតគ្រប់ទាំងពីរ។ កំណត់ត្រាចាស់ដែលនិយាយថា delete/remove ស្តារបានជានិច្ច គឺប្រវត្តិ មិនមែនច្បាប់បច្ចុប្បន្ន។

**[High] Supabase retry ឆ្លងគណនី។** Root cause៖ 401 refresh អាន session ថ្មីដោយមិនផ្ទៀង uid នៃសំណើដើម។ Danger scenario៖ tab ផ្សេងប្ដូរគណនី ខណៈសំណើកែប្រាក់ចាស់រង់ចាំ; retry ប្រើ token គណនីថ្មី។ Fix៖ fence session មុន refresh និងមុន replay; same-user refresh នៅដើរ។ ភស្តុតាង real supabase-js៖ ករណី storage event មក/មិនមក ធ្លាក់ទាំង២មុនកែ; ៨filesពាក់ព័ន្ធ PASS៥៦ និងផ្ទៀងទិន្នន័យហាងទាំងពីរមិនប្រែក្រោយបដិសេធ។

**[High] ការសម្អាត restore marker ប្រើ DB ថ្មីក្រោយប្ដូរគណនី។** Root cause៖ `clearStaleRestoreMarkers()` អាន source រួចប្រើ live DB/API ក្រោយ await ដោយគ្មាន generation fence។ Danger scenario៖ A កំពុងផ្ទៀង orphan marker ខណៈអ្នកប្ដូរទៅហាង B; callback ចាស់ចាប់សរសេរក្នុង B។ Fix៖ capture DB/API/generation ពេលចាប់ផ្ដើម ហើយផ្ទៀងមុន source read, ក្រោយ ACK និងក្នុង updater។ `restore-marker-hygiene-test` actual extracted helper៖ មុនកែ PASS២៨/FAIL១ (`newTenantWrites:1`) → ក្រោយ PASS២៩/FAIL០; normal cleanup controls នៅរត់។

**[High] CAS ត្រឡប់ snapshot របស់ឧបករណ៍ផ្សេង។** Root cause៖ ACK ត្រឡប់ live cache ជំនួសតម្លៃ transaction ខ្លួន។ Danger scenario៖ A commit ១ រួច ACK យឺត; B commit ២ និង realtime មកមុន ACK A; caller A ឃើញ២។ Fix៖ snapshot ត្រឡប់ cloned canonical proposal ដែល commit; cache/listener រក្សាតម្លៃថ្មី។ Real RTDB/Postgres parity មុនកែ PASS៩៤/FAIL១ → ក្រោយកែ PASS៩៥; unit៧ រួម deletion/null។

**[Medium] Sync ពេញ១០០០ទំព័រប្រកាសរួចទោះនៅ more។** Root cause៖ loop cap ធ្លាក់ចូល ready/onSynced ដោយមិនផ្ទៀងចុងបញ្ជី។ Danger scenario៖ ហាងធំ pull មិនទាន់ពេញ តែអេក្រង់ប្រាប់បាន Sync។ Fix៖ រក្សា stage/cursor និងស្ថានភាពមិនពេញ; retry បន្តរហូតទំព័រចុងក្រោយ ទើប publish។ Regression វាស់ព្រំដែន១០០១ជួរពិត មុនកែ FAIL។

**[Medium] Push ឆ្លងហាងតាម index ចាស់។** Root cause៖ expiry ជឿ bykey index មិនផ្ទៀង subscription.keyId បច្ចុប្បន្ន។ Danger scenario៖ device ផ្លាស់ A→B តែ index A មិនទាន់លុប; ទទួលចំនួនកញ្ចប់ A។ Fix៖ ផ្ទៀង owner នៅពេល send; Firebase/Supabase regressions FAILមុនកែ។

**[Medium] Timeout មិន abort និង notice carry រំលងអ្នកទទួល។** Root cause៖ Promise timeout ទុក HTTP រស់; claim៣២ ប៉ុន្តែ worker១៦ ហើយកាត់កន្ទុយពេល budget អស់។ Danger scenario៖ request គាំងមាន៣៣រស់លើពិដាន១៦; read១៥.៩វិ + send៥វិ ផ្ញើ១៦ និងបាត់១៦ ទោះ cron បន្ទាប់។ Fix៖ AbortController គ្រប headers/body; claim ត្រឹម១batch និង reserve read/OAuth/send មុន claim; ផ្ញើគ្រប់អ្នកដែលបាន reserve។ Push suite PASS៤១; regressionថ្មី៦/៦ FAILលើ baseline។ Scale៣០០០អ្នក/៤០០ហាង ផ្ទៀង exact sets និងគ្មានស្ទួន ប្រើ virtual network delay៤០ms/២០០ms; នេះមិនមែន throughput production។ At-most-once attempt នៅមានដែនកំណត់ crash ក្រោយ claim/ACK មិនច្បាស់ អាចបាត់ដំណឹង។

**[High] Money checker បៃតងទោះ barcode/phone ខុស។** Root cause៖ គណនា pickExtra/pickMissing តែមិន assert; ផ្ទៀងតែចំនួន phone សរុប និង registry កំព្រា មិនផ្ទៀង registry បាត់។ Danger scenario៖ ចំនួនយកត្រឹមត្រូវ តែចុះទៅ barcode/អតិថិជនផ្សេង។ Fix៖ exact barcode set, per-phone counts, registry ទាំងពីរទិស និង canonical code/encoding។ `ZoeW/tests/money-multidevice-oracle.test.ts` Regression៩៖ មុនកែ FAIL៧/PASS២ → ក្រោយ PASS៩; រួម valid escaped barcode ដែលមុននេះ false failure។

**[Medium] Queue Sign មួយខូចរារាំងកញ្ចប់ទាំងអស់/clock rollback ពន្យារយូរ។** Root cause៖ decrypt error បោះចេញពី loop ទាំងមូល; future lease/retry គ្មានពិដានសមហេតុផល។ Danger scenario៖ key ចាស់/រូបអ៊ិនគ្រីបអានមិនបាន ឬនាឡិកាថយ១ម៉ោង; កញ្ចប់ផ្សេងមិនបន្ត។ Fix៖ រក្សាទុក row ខូច បង្ហាញចំនួន និងបន្ត row ផ្សេង; bounded deadline កែតែ deadline ខុសប្រក្រតី ហើយ checking នៅ poll ACK មិន resend05។ Regression៣ FAILមុនកែ; valid lease/retry positive controls នៅទប់មុនកំណត់។ Root targeted queue+policy PASS៦៦ (`ZoeW/tests/palm-sign-outbox.test.tsx` · `ZoeW/tests/zto-final-marks.test.tsx`)។

**ច្បាប់ស្តារ/cleanup និង schema rollout។** Policy tests១៣ FAILលើច្បាប់ចាស់ តាមសំណើថ្មី; មិនអះអាងថាច្បាប់អាជីវកម្មចាស់ដែលម្ចាស់ធ្លាប់អនុញ្ញាតជាកំហុសទេ។ Persist trashMode/restoreBlocked មុន journal/claim, guard ក្នុង transaction និង rules ទាំងពីរ; signed trash គ្រប់មូលហេតុត្រូវ block។ Rules matrix actual RTDB/Postgres មុនកែ PASS១៧/FAIL៣០; ក្រោយ flag និង exacttime schema PASS៥៣/FAIL០។ ការបន្ថែម cancellation/provenance បាន PASS៨១/FAIL២៣ មុនកែ → PASS១០៤; expiry/target fencing បន្ថែម PASS១០៨/FAIL៧ → PASS១១៥/FAIL០។ ទាំងនេះជាតេស្ត policy គោលដៅ (debug exit១ដោយចេតនា មិនរាប់ជាពេញ)។ API បោះចោល Sign time ត្រូវប្ដូរឲ្យ carry signedAt/signedAtExact តាម detail/list/import; ផ្លូវខ្វះម៉ោង enrich ក្នុង bounded status batch១០ ដោយមិនយក dispatch time មកប្រឌិត។ Timestamp guards មុនកែ FAIL១៤; ZTO targeted៧០PASS និង import៧PASS។

**[High] ភស្តុតាង Sign ក្នុង cache រំលងដោយ exception forwarded/misplaced។** Root cause៖ ពិនិត្យករណីចាកចេញពីសាខាមុនពិនិត្យ cached Sign។ Danger scenario៖ Cookie មាន Sign ថ្មី តែមិនទាន់ stamp DB; ប៊ូតុង/claim អាចចាប់ស្តារកញ្ចប់ដែល Sign រួច។ Fix៖ ភស្តុតាង Sign ត្រូវមានអាទិភាពមុន exception; regression២ FAILមុនកែ → PASSក្នុង suite៦៦ខាងលើ។

**[High] ស្តារតាមស្ថានភាព unsigned ចាស់។** Root cause៖ trash លុប/ដកមិនស្ថិតក្នុង pickup status sweep ហើយ detail cache/single-flight អាចត្រឡប់ចម្លើយមុន Sign។ Danger scenario៖ លុបកញ្ចប់ រួច Sign ក្នុង ZTO ផ្សេង; ឧបករណ៍ដែលគ្មានភស្តុតាងថ្មីអាចស្តារ និងបូកប្រាក់វិញ។ Fix៖ Cookie restore ផ្ទៀងគ្រប់ barcode តាមសំណើ `restore=1` មុន claim; Function រំលង result cache និងសំណើចាស់កំពុងរត់ ទាំង auth retry ហើយឆ្លើយ `verifiedForRestore`។ Client ផ្ទៀង identity, barcode, success/found, verdict និង freshness; offline/unknown/endpoint ចាស់មិនអនុញ្ញាតស្តារ; ពិដាន៣សំណើ និង session fence។ `ZoeW/tests/zto-restore-verification.test.ts`៖ server cache/in-flight regression២ FAILមុនកែ; independent review រកឃើញ upstream barcode បាត់/ខុសត្រូវបានចាត់ថា fresh proof (regression២FAIL)។ Fix បន្ថែមទាមទារ explicit upstream barcode match មុនផ្ដល់ marker; suite១៤PASS គ្រប Function ពិតជាមួយ upstream ក្លែង, cache/in-flight, ប្ដូរគណនី និងទិសផ្ទុយ local។ វាមិនអាចធ្វើ distributed transaction ជាមួយប្រព័ន្ធ ZTO ខាងក្រៅបានទេ; ភស្តុតាងថ្មីត្រូវបានផ្ទៀងមុន mutation ហើយភស្តុតាង Sign ដែល App ឃើញកណ្ដាលប្រតិបត្តិការ ត្រូវគ្របដោយ terminal cancellation។ Sign ខាងក្រៅដែលមិនទាន់ឃើញ មិនអាចធានា atomic ជាមួយ DB បានឡើយ។

**[High] Sign មកកណ្ដាល Restore ទុក claim ដែល retry អាចបូកប្រាក់វិញ។** Root cause៖ post-claim guard បោះ error តែទុក durable claim; final-mark sweep រំលង claim ហើយឧបករណ៍ B អាច reclaim ក្រោយ lease អស់ដោយគ្មាន verdict របស់ A។ Danger scenario៖ A claim/prepare រួចទើបឃើញ Sign; B ស្តារក្រោយ១២០០០១ms ធ្វើប្រាក់៩៣→១០០ទោះកញ្ចប់ Sign រួច។ Fix៖ freeze source `restoreBlocked`, ប្រើ `restoreAddedCodes` កត់តែ barcode ដែល prepare បន្ថែម, cancellation CAS ដកតែ barcode នោះ និងរក្សា neighbor/call metadata, បញ្ចប់ markers ទើបដោះ claim; មិនមាន revenue increment ក្នុង cancellation។ Expiry មិនអនុញ្ញាតសម្អាត prepared history; takeover រក្សា target ក្នុង CAS ដដែល។ Original target ដែលមាន closed sibling ត្រូវប្រើ target ថ្មីដោយមាន intent ជាប់លាប់។ `ZoeW/tests/restore-terminal-cancel.test.ts` ថ្មី១៥ និង existing retry/recovery៣៨ = PASS៥៣; baseline stranded-claim, call metadata, occupied target និង expired provenance សុទ្ធតែធ្លាក់មុនកែ។ Legacy provenance ខ្វះ/ខុស ឬ token handoff មិនត្រូវគ្នា ត្រូវ hold និងប្រាប់ Admin ផ្ទៀងជាក់លាក់; មិនស្មានលុប ឬបូកប្រាក់។

**[High] Cleanup ចាស់ជាប់ពេល upgrade និង mode ប្រែកណ្ដាល CAS។** Root cause៖ journal ចាស់ខ្វះ policy stamp ដែល rules ថ្មីទាមទារ; retry ប្រើលក្ខខណ្ឌ mode ដើម ប៉ុន្តែ stamp តាម mode ថ្មី។ Danger scenario៖ App បិទក្រោយដក history/ledger មុនសរសេរ trash ឬ flag; recovery ត្រូវ rules បដិសេធ។ ប្ដូរពី local ទៅ ZTO Login ពេល CAS retry អាចយក unsigned local-close ចូល trash ខុសលក្ខខណ្ឌ។ Fix៖ normalize ភស្តុតាង signed ក្នុង journal និង current trash មុន recovery write; preserve mode/flag; CAS បដិសេធ mode ប្រែមុន commit ហើយការងារដែល commit រួចបញ្ចប់តាម mode ដែលកត់ទុក។ `ZoeW/tests/cleanup-resume-session.test.ts` · `ZoeW/tests/cleanup-sweep-batch.test.ts`៖ regression៥ FAILមុនកែ → PASS; oracle ប្រើ signed-field validator ពិត រួម replay លុយមិនស្ទួន។

**[Medium] លុបទាំងអស់អាចប្ដូរច្បាប់ស្តារកណ្ដាល batch។** Root cause៖ ក្រោយ awaited claim និងពេល trash slot ត្រូវកាន់ដោយជីវិតចាស់ កូដអាន mode ថ្មី។ Danger scenario៖ ចាប់ផ្ដើមលុបក្នុង ZTO Login រួចប្ដូរទៅ Cookie; ធាតុខ្លះក្លាយជាអាចស្តារបាន។ Fix៖ ចាប់ mode ម្ដង ហើយបញ្ជូនតាម regular/fallback delete paths; enum-validated internal override។ `ZoeW/tests/clear-history-foreign-slot.test.ts`៖ regression២ FAIL → full៥PASS; barcode នៅតែមួយ copy, trash ចាស់មិនប្រែ, money មិនប្រែ និង claim/finalization ទាំងអស់ត្រូវបានដោះ។

**Phase ១ — ផ្ទៃដែលបានពិនិត្យ៖** network deadlines/late commit, connection observers និង detach តាម session/tenant, SW install/update/cache/fetch/push, Netlify auth/session/sign, credential-origin និង error redaction ក្នុង App ទាំងពីរ, CSP និង HTML sinks។ មិនរកឃើញ application `innerHTML`/`dangerouslySetInnerHTML`/`eval` sink ថ្មី ឬ server secret ថ្មីក្នុង shipped source; public Firebase/Supabase config មិនមែន server secret។ SW ប្រើ network-only សម្រាប់ Functions និងមិន cache cross-origin/non-GET; cache shell មាន response type/deploy guard។ មិនបានបង្កើតករណី duplicate listener ថ្មីជាក់លាក់។ ទាំងនេះជាលទ្ធផល code review មិនមែនភស្តុតាងថាគ្មានចន្លោះទាំងអស់ទេ។

**Checker extraction៖** `policy-test` ធ្លាក់ព្រោះចងទៅ parameter list ចាស់របស់ clear-history helper។ ប្ដូរទៅ AST FunctionDeclaration តាមឈ្មោះ និងបដិសេធ function បាត់/ស្ទួន; assertions៦៥PASS ហើយ negative control ចាក់ការកែប្រាក់ក្នុង builder ពិតត្រូវចាប់បាន។ នេះជាការកែ false failure របស់ឧបករណ៍ មិនបន្ថយការផ្ទៀងលុយ។

**Checker បៃតង/ក្រហមក្លែងក្លាយ៖** trash-modal checker ធ្លាប់ចង pickup ទាំងអស់ទៅ២ម៉ោង; ឥឡូវ local២ម៉ោង, Cookieលក្ខខណ្ឌគ្រប់ភ្លាម និង ZTO Login២ម៉ោងពី Sign ពិត។ Assertions១២១PASS ហើយ mutations៧/៧ត្រូវចាប់បាន។ Exit-code poisoning គោរព CPU quota/availableParallelism និងចាត់ browser wrapper តាម subprocess/import ពិតរហូតដល់ child; ករណីមិនមែន browser នៅរត់ ហើយ timeout/signal នៅជា unverified/FAIL។ Tracked regressions១២PASS; ការរំលង browser chain ក្នុង poison meta-test មិនរំលង checker នោះក្នុង run-all ទេ។ Child capture failure ឥឡូវបង្ហាញ exit code/signal និង bounded stderr ជំនួស error ទទេ។

**Checker budgets៖** Matrix បន្ថែមករណីពិតដែលចំណាយពេលលើសពិដានទូទៅ។ `runall-runner-test` វាស់ argument របស់ timeout ពិត៖ RTDB matrix ២៤០០វិ, Supabase matrix ៣០០០វិ, checker ផ្សេង៣០០វិ; `CHECKER_TIMEOUT` explicit នៅ override ទាំងអស់។ Regressionមុនកែ ថវិកា matrixទាំង២ខុស; ក្រោយកែ runner suite PASS៦៣ រួមការបញ្ឈប់ hang ពិតដោយ override១វិ។ មិនដកករណី test ដើម្បីឲ្យទាន់ពេលទេ។

**ការផ្ទៀងផ្ទាត់រួម៖** កំណត់ត្រាលទ្ធផល full strict និង real network matrix ត្រូវបំពេញក្រោយរត់ចប់។ ករណី cleanup/recovery ពេញ២files PASS៣៧។ Outbox worker ពីរប្រើ App→Function/journal ពិតជាមួយ DB/Blob/upstream ក្លែង៖ deadline ពី clock rollback ខណៈ ACK05 រង់ចាំ ទទួលតែ១ upload/05 ក្នុងមួយ barcode និង pickup/collected មិនស្ទួន; នេះជាការបង្កើត deadline ក្នុង persisted row មិនមែនប្ដូរនាឡិកាលើទូរស័ព្ទពីរពិតទេ។ មិនបានធ្វើ live penetration test, Sentry query ឬវាស់ physical iOS/Android/production load។

**ព្រំដែនស្ថាបត្យកម្មដែលនៅសល់៖** Supabase per-tenant row lock ការពារការសរសេរជាន់គ្នា តែ CPU/I/O/connection នៅចែកគ្នា។ zoe_ops កត់ idempotency receipts២ថ្ងៃ និង zoe_docs មាន seq/updated_at; Firebase មាន write receipts/operation witnesses។ វាមិនមែន immutable audit history គ្រប់ transaction ជារៀងរហូតទេ។ ការធានានោះត្រូវ trusted server writer/audit retention ដាច់ដោយឡែក; authorized clients នៅអាចកែទិន្នន័យតាម trust model ដែលបានទទួលយក។ Stamp មិនមែន cryptographic proof របស់ ZTO; legacy trash គ្មាន mode មិនអាចសន្និដ្ឋានប្រវត្តិពីឧបករណ៍ផ្សេងបាន។ មិនបាន Sign ឬកែប្រាក់ production ដើម្បីធ្វើតេស្តទេ។

**Context/dead-code៖** ផ្ទៀង local links ក្នុង tracked Markdown២៥ឯកសារ គ្មាន target ខូច; កែ current rules/README/pending handoff ដែលផ្ទុយគោលការណ៍ថ្មី និងពាក្យធានា Push/scaling លើសភស្តុតាង។ រកមិនឃើញ dead source ដែលអាចលុបដោយមានភស្តុតាង; ACTION_ALLOWLIST ដែលមើលទៅ unused ត្រូវបានប្រើដោយ audit generator, entrypoints/SW/Vite ក៏មាន external consumers។ មិនលុបតាមការស្មាន។


### 2026-10-19 — A260 ៖ Sign រក្សាទុកមុនបិទផ្ទាំង · កញ្ចប់ច្រើនក្នុងលេខមួយ · ស្លាក ZTO

- សំណើម្ចាស់គម្រោង៖ scan → ចុច Sign → បញ្ជាក់បញ្ហា → ផ្ញើ ZTO; បន្ទាប់ពីរក្សារូប/ការងារបាន អនុញ្ញាតធ្វើកញ្ចប់បន្ទាប់ ខណៈរង់ចាំ ZTO។ `receipt-check` អានតែ order/business check; warning token ចងរូបតាម SHA-256, barcode, request, proof, name និង session។ Worker ពិនិត្យម្ដងទៀត ហើយបញ្ហាប្រែ/forbidden/expired/photo ប្រែ មិនផ្ញើរូបឬ05 ដោយស្វ័យប្រវត្តិ។
- IndexedDB អ៊ិនគ្រីបរូប និងទិន្នន័យការងារតាម shop/user; transaction complete ទើប modal បិទ។ Actual Chromium test៖ reload រកឃើញរូប៣, key ខុសបដិសេធ, owner ផ្សេងមិនឃើញ, CAS ពីរ tab ឈ្នះតែមួយ, abort ក្រោយ request success មិនបន្លំថា commit។ Queue រក្សាការងារពេល app បិទ; មិនអះអាងថា OS អនុញ្ញាត JS រត់ពេល app ត្រូវ kill ទេ។
- Server journal ប្រើ ETag CAS ដាច់តាមសាខា/barcode ហើយកត់ photo ACK មុន phase sending។ Cold containers ប្រជែងគ្នា និង ACK05បាត់៖ មិនបាញ់05ម្ដងទៀត; `receipt-status` ផ្ទៀង track។ Signed ពី request ផ្សេងមិនអះអាងថារូបរបស់ការងារនេះបានទៅដល់ទេ។ Unknown ដែលមិនមានភស្តុតាងបិទនៅតែរង់ចាំ; មិនអាចធានា upstream exactly-once ដោយប្រឌិត ACK។
- Lab ២ និង៣កញ្ចប់ក្នុងលេខទូរស័ព្ទមួយ៖ real App + Function + close helper លើ transaction-memory DB; កញ្ចប់ទី២មាន warning, ទី១ ACKបាត់, រូបមិនច្រឡំ, parent មិនបិទមុនគ្រប់, packages២/៣, customer១, COD៣/៦ និង DOD១/១.៥។ នេះមិនមែន live Firebase/Supabase ឬទូរស័ព្ទពិតទេ; strict backend audit រត់ដាច់។ Restore ខណៈ ACK/DB update រង់ចាំមិនឲ្យការងារចាស់បិទវគ្គថ្មី។
- តេស្ត server៦ដំបូង FAIL៦ លើផ្លូវមុន journal។ ការផ្ទៀង SDK រកឃើញ edge-only Lambda មិនគាំទ្រ strong read; regression ថ្មី FAIL១/១៤ មុនកែ ហើយប្រើការអានធម្មតាជាមួយ CAS ដែលបដិសេធ snapshot ចាស់។ Existing ZTO ៤៩files PASS៩០៩ ក្រោយប្ដូរស្លាក; អនុញ្ញាត update LOCK តែ៤ files ដែលប្ដូរអត្ថបទ UI (`auto-lookup`, `zto-list-sync`, `zto-status`, `zto-palm-login`)។
- ផ្ទៀងបន្ថែម៖ mutation ដក photo ACK និង transaction restore fence លើច្បាប់ចម្លង FAIL២/១៧ តាមរំពឹង; tree ពិត PASS១៧។ Chromium UI ១២ការងារ លើទទឹង៣២០/៣៩០/៧៦៨/១២៨០ មិនហៀរ និង scroll បាន។ ម្ចាស់គម្រោងបញ្ជាក់ថា preview ដំណើរការល្អ។ CRUD sandbox ខ្វះ `barcodeSignIdentity`; raw-read harness ខ្វះ `opts` និង helper ដដែល។ ផ្ទុក helper/closure ពិត ដោយមិនដាក់ stub; CRUD PASS១៣៩ និង raw-read PASS៣១ រួមទាំង sparse barcode + ACK ក្រោយ restore; ដក transaction fence លើច្បាប់ចម្លង ➜ FAIL២/៣១ តាមរំពឹង។ CI `d0851331` វាស់២១៣៖ PASS២០៧/FAIL៦ (harness២, state/clock documentation២, doc index/timer១, CSS class មិនប្រើ១); ការផ្ទៀងមុន merge ត្រូវយក CI របស់ commit ចុងក្រោយទាំង៤ផ្នែក។ ដក class `has-badge` ដែលគ្មាន CSS និងកត់ mutex/lease local ព្រមទាំង timerទី៨; មិនបន្ធូរ money/ACK assertions។ Full audit រកឃើញ `document.hidden` នៅក្រៅស្រទាប់ React; ប្ដូរទៅ `documentIsHidden()` របស់ platform ហើយ purity១៥ និង queue១៧ PASS។
- អ្នកយាម៖ `palm-sign-journal.test.ts`, `palm-sign-outbox.test.tsx`, `palm-sign-outbox-idb.test.ts`; guards ចាស់នៅដដែល។ ព្រំដែន៖ ត្រូវផ្ទៀង APK/PWA ពិត និង ACK/photo នៅ ZTO; ការលុប site data ឬការប្ដូរ PIN key ពេល queue មានការងារមិនស្ថិតក្នុងការធានាស្តារដោយ browser reload។

### 2026-10-19 — A259 ៖ APK beep ខ្លី និងចាប់ផ្ដើមស្ទួន · រៀបចំសម្លេងទុកជាមុន

- សំណើម្ចាស់គម្រោង៖ APK Android ស្កេនតែមួយក៏ដាច់ និងចង់បានសម្លេង realtime។ Android AOSP `ToneGenerator.cpp` កំណត់ `TONE_PROP_BEEP` ជា tone៤០ms; ការផ្ញើ duration១៥០មិនពន្យារកម្មវិធីសម្លេងរបស់វាទេ។ `TONE_PROP_PROMPT` មាន segmentជាប់២០០ms និងត្រូវកាត់នៅ១៥០តាមសំណើ ZoeW។ Java lifecycle test ប្រើរយៈពេលតាម AOSP; មិនអះអាងថាបានស្ដាប់លើទូរស័ព្ទពិត។
- កូដមុនហៅ `finish()` រាល់ scan ➜ release និងស្តារ/បង្កើន volume កណ្ដាលសម្លេង។ ឥឡូវ coalesce ពេល tone កំពុងលេង, prepare engine ពេល load/resume, reuse ពេល foreground និង release ពេល pause/destroy។ OS បដិសេធ ឬ tone ចាប់មិនបាន ➜ cleanup និងអនុញ្ញាត fallback; background មិនបន្លឺ late scan។
- Web Audio មុនអាចជាន់ tone full-scale និង resume ស្ទួន។ WeakMap តាម context ផ្ទុកតែ audio lifecycle; មិនផ្ទុកទិន្នន័យកញ្ចប់។ Callback ចាស់មិនលុប tone ថ្មី និង resume មកយឺតមិនចាក់ទៅ context ថ្មី។
- Regression ដំបូង៨៖ source មុនកែ FAIL៤ (native duration/burst និង web overlap/resume)។ សំណើ realtime បន្ថែម lifecycle/warm guard; កូដមុន reuse/prepare FAIL៤/៩។ ក្រោយកែ beep៩ និង scanner/modal/lookup/listener ទាំង៤files PASS៥៥។ Typecheck និង android contract១២៥ PASS មុនប្ដូរលេខកំណែ; full audit រត់លើ tree ចុងក្រោយបន្ត។

### 2026-10-19 — A258 ៖ Palm សុទ្ធ · បញ្ជីចែកចាយមិនគ្រប arrival-only

- ម្ចាស់គម្រោងបង្ហាញ Cookie មាន១៨ arrival តែ Palm មាន១ និងជ្រើស Palm សុទ្ធ ដោយមិនពឹង Cookie ពី Blob។ Payload ពិតពីរកញ្ចប់មាន own-site action `3` និងគ្មាន `4`; ZoeW ឆ្លើយ `ztoArrivalAt` ត្រឹមត្រូវ។ កញ្ចប់ដែលចែកចាយរួចមាន `4` ក្រោយ `3`។ បញ្ហាស្ថិតនៅប្រភព candidate មិនមែនការផ្ទៀង track។
- ផ្ទៀង `draft.7z`៖ `DispatchListActivity` ប្រើ `un_dispatch_tab`; `DispatchTabFragment` ផ្ញើ `queryDispatchList`, `billStatus: 4`, `status: 0`, ថ្ងៃជ្រើស និង `pageSize: 1000`។ សំណើសាកល្បង `4a` (ស្លាក queue ក្នុង ZoeW មិនមែនវាល upstream) ត្រូវទម្រង់នេះ ប៉ុន្តែម្ចាស់គម្រោងសាក preview ហើយនៅខក arrival-only ដដែល ➜ ដកសំណើបន្ថែមនេះចេញ។ មិនទុកការងារដែលមិនជួយឱ្យបន្ថែម latency។
- តេស្តសិប្បនិម្មិតមុនដាក់ arrival-only ឱ្យចម្លើយទំហំ១០០០តែឯង។ វាគ្រាន់តែបញ្ជាក់ទម្រង់សំណើ និងមិនមែនភស្តុតាងថា ZTO ពិតផ្ញើដូច្នោះទេ។ ដក fixture សន្មតនេះចេញជាមួយសំណើ `4a` ហើយមិនរាប់ថាដោះស្រាយករណី១៨/១។ វាស់មុន/ក្រោយដោយ list៥០ms, track៣០ms, ដំណើរ App→Function១០ms, warmup១+៥ដង៖ cold stock២២ median១០៩→១០៨ms;១៧២៖២៣២→២៣៣ms;៩៧២៖៧៣៧→៧៤៤ms; warm៩៧២៖៦៨១→៧០៧ms។ គ្មាន speedup ច្បាស់ និងមិនមែន production benchmark។
- ពិនិត្យ URL H5 ដែលមានក្នុង APK (`apdah5.ztoglobal.com`) និង JavaScript សាធារណៈរបស់វា៖ `SignMonitor` ➜ `LocalAgingMonitor` ប្រើ `intlreport.ztoglobal.com/getUserInfo` និង `/report/seaKhLocalAgingMonitor/queryDetail`, condition `searchStartDate`, `searchEndDate`, `siteCodeList`, `queryType: 2`, ទំព័រមាន `data.result`/`data.total`។ Native bridge ផ្តល់ SSO ពី Login Palm សម្រាប់ `PDA_USER_COOKIE_01`/`PDA_SSO_COOKIE_01`; មិនត្រូវការ Cookie ពី Blob។ មិនប្រើ token ឬសោ default ដែលមានក្នុង bundle សាធារណៈឡើយ។
- បន្ថែម diagnostic ក្នុង 🧪 តែប៉ុណ្ណោះ៖ បើ `track=1&arrivalProbe=1` និងមាន arrival ដែល track ផ្ទៀងបាន ➜ ប្រើ SSO ក្នុង sealed session, ផ្ទៀង report identity ត្រូវសាខា, អានទំព័រទី១១០ជួរដោយ host/path ថេរ និងមិនតាម redirect។ ឆ្លើយតែ Barcode និង field របាយការណ៍ដែលអនុញ្ញាត; មិនផ្ញើ credentials ឬលេខទូរស័ព្ទរបស់ report ទៅ client, `complete: false` ជានិច្ច។ Ordinary Lookup/list/status/Sign មិនហៅ report។ Probe ខូចមិនបំផ្លាញ Lookup ដែលនៅដំណើរការ។
- Probe regressions ដំបូង១០៖ source មុនកែធ្លាក់៧; ក្រោយកែ និងបន្ថែម failure modes សរុប១៣ PASS។ Server suite PASS១៤៧; ZTO modules៤៣files PASS៨៤០ មុនធ្វើបច្ចុប្បន្នភាព LOCK; checker ZTO១១/១១ PASS ដោយគ្មាន SKIP/PARTIAL។ Typecheck PASS។ ករណីសាខាខុស/redirect មិនទៅ detail, report ជាប់ត្រូវ abort, credentials ដែល upstream echo ក្នុង field ដែលអនុញ្ញាតក៏ត្រូវលាក់។
- មិនប្រើ report ជាប្រភពនាំចូល ឬជាភស្តុតាងមកដល់/លុយទេ រហូតផ្ទៀងចម្លើយពិត។ `centreComeDate` គឺ field របាយការណ៍ មិនអាចជំនួស own-site arrival track។

- ចម្លើយ preview ពិតរបស់ម្ចាស់គម្រោង៖ report identity ត្រូវសាខា និង `state: ok` ប៉ុន្តែ `total: 0`, `targetOnPage: false` សម្រាប់ arrival-only ដែលមាន track ពិត។ ដូច្នេះដក runtime report probe ចេញ; វាមិនមែនប្រភពដែលត្រូវការ។ រូបបញ្ជីបន្ថែមក៏នៅបង្ហាញតែកញ្ចប់ដែលបានចែកចាយ។
- ជំនួស diagnostic ដោយសាក SSO Palm ដដែលលើ `aargus-api.ztoglobal.com/getUserInfo` និង `/scan/page/scan` ប្រភេទ `03` សម្រាប់ថ្ងៃមកដល់តែ១។ ប្រើ request/projection Argus ដែលមានស្រាប់, fixed host/path និងទំហំ១០០, មិនអាន Cookie Blob, ទំព័រសាកនៅ `complete: false`។ ការបង្ហាញម៉ោងមកដល់មិនបញ្ជាក់ coverage ទេ; ត្រូវរង់ចាំចម្លើយ ZTO ពិតមុនប្ដូរប្រភពបញ្ជីធម្មតា។ Source ចាស់ធ្លាក់៤លើតេស្ត contract ថ្មី; កំណត់ LOCK ថ្មីតាមសំណើម្ចាស់គម្រោងក្រោយ guard បៃតង។ ក្រោយកែ ZTO unit៨៤២ក្នុង៤៣files និង checker១១/១១ PASS, SKIP/PARTIAL០; នេះជាភស្តុតាង contract/isolation មិនមែន coverage upstream ពិត។

- ម្ចាស់គម្រោងផ្ញើ probe ថ្មី៖ `source: palm-sso-scan03`, `total: 18`, `targetOnPage: true` រួមទាំង arrival-only ហើយបញ្ជាក់១៨ស្មើ Cookie Blob។ នេះជាភស្តុតាង upstream ពិតដែល report មុនមិនមាន។ `action: 3` ក្នុង native track និង `scanTypeCode: 03` ក្នុង Argus list ជាវាលផ្សេងគ្នា; កំហុសមុនគឺប្រភពចែកចាយខ្វះកញ្ចប់ មិនមែនការបន្ថែមសូន្យ។
- បញ្ជីធម្មតាឥឡូវប្រើ SSO scan03 ជាបេក្ខភាព និង native signed tab5 ជា companion។ ផ្ទៀង identity ត្រូវសាខាមុនអានទំព័រ, host/path ថេរ, មិនតាម redirect មិនអាន Cookie Blob។ តេស្ត contract ថ្មី១៥លើ source មុនកែធ្លាក់១២; ក្រោយកែជាប់១៥។ តេស្ត metadata បន្ថែមចាប់ truncated total និង page មិនត្រូវ ធ្លាក់៣មុនកែ; source បដិសេធភាពមិនគ្រប់ជំនួសបញ្ជីបៃតងក្លែងក្លាយ។ រក្សា track proof, signed/return verdict, dedup, retry និង old APK tab aliases; ដក diagnostic និង native dispatch candidate helper ដែលឈប់ប្រើ។
- Fixture App/Function និង money integration ប្ដូរ upstream ក្លែងទៅ native Login JWT + SSO identity/scan03 តាម contract ដែលផ្ទៀងពិត; Cookie ផ្លូវដើម និង real backend/rules/ledger មិនត្រូវជំនួស។ មិនកាត់ assertion លុយ ឬសាខា។ កំណត់ LOCK ថ្មីតាមសំណើម្ចាស់គម្រោងក្រោយ ZTO guard បៃតង។
- វាស់ App→Function ពិតមុន (`33a185d8`) និងក្រោយលើទិន្នន័យសាកដូចគ្នា៖ មកដល់១៨ + signed companion៤, COD៦៣/DOD០ និង barcode/time/closed/origin ស្មើគ្នារាល់ជុំ។ Upstream ក្លែងរង់ចាំ៨០ms/សំណើ, App→Function២០ms, ១ cold + ៥ warm; median warm៖ បេក្ខភាពក្រៅចន្លោះបន្ថែម០៖ ២០៨→២៨៨ms (SSO identity បន្ថែម១សំណើ); បន្ថែម១៥០៖ ៤៥១→២៨៩ms (លឿន៣៦%); បន្ថែម៩៥០៖ ១៦៨០→២៨៨ms (លឿន៨៣%)។ សំណើ ZTO រួម identity៖ ៣០→២២, ១៨១→២២, ៩៨៩→២២។ មិនយកបញ្ជីចាស់ដែលខ្វះជួរមកធៀបល្បឿន; ទាំងពីរបានលទ្ធផលដូចគ្នា។ នេះជាការវាស់ lab មិនមែនពេលឆ្លើយ ZTO ពិត។

- ផ្ទៀងការប្ដូរប្រភពចុងក្រោយ៖ ZTO unit៨៤៦/៤៣files, checker ZTO១១/១១ PASS ដោយគ្មាន SKIP/PARTIAL និង typecheck PASS មុនកំណត់ LOCK ថ្មី។ តេស្ត server១៥៣រួម metadata/page/truncation និង SSO isolation។

- ម្ចាស់គម្រោងបញ្ជាក់ normal preview លើ `68ad3271`៖ Palm ទាញ៣ដងបាន១៨ទាំងអស់ រួម arrival-only, ពេល៥.៧/៣.៩/៣.៩វិ.។ មុនកែម្ចាស់គម្រោងរាយការណ៍១១–១៥វិ.; median៣.៩មានការរង់ចាំតិចប្រហែល៦៥–៧៤% តាមការសង្កេតនេះ មិនមែន paired benchmark។ ម្ចាស់គម្រោងថាឥឡូវលឿនជាង Cookie ប៉ុន្តែមិនមានពេល Cookie list ជាលេខសម្រាប់គណនា។
- Lookup/Sign lab៖ App និង Function ពិតមុន/ក្រោយ, upstream៨០ms, Function២០ms និង local closeក្លែង២០ms; ៦ដងមួយtree, median៥warm។ Lookup១០១.៥៦→១០១.៧២ms, cache០.០៣→០.០២ms, preflight១០១.៦៨→១០៣.២២ms, dispatch១៨២.១១→១៨២.៨៤ms, receipt៥២៥.២៨→៥២៥.១៧ms; សំណើ១/០/១/២/៦ដដែល។ PASS១២/១២ និង double-submit មានតែ04/05/photo/local closeមួយ។ មិនរួម uploadរូបពិត, GPS, ពេលមនុស្ស និង backend closeពិត; ការកែ arrival មិនបានបង្កើនល្បឿន Lookup/Sign ក្នុង lab។ អ្នកប្រើឃើញ Cookie Lookup០.៦–១.xវិ., warm០.៦–០.៩វិ. និង Palm ពេលខ្លះយឺតបន្តិច; គ្មានពេល Sign ពិត។
- CI `39244360916` លើ `68ad3271`៖ shard៤ success, PASS២១៣/២១៣, FAIL/PARTIAL/SKIP០ តាម summary ក្នុង logs ទាំង៤។ Local full run ត្រូវឈប់ exit១៣០ ពេលចាប់ការកែ beep តាមសំណើថ្មី; មិនរាប់វាជា full PASS។ មុនឈប់ Supabase money multishop, Firebase money multidevice, CRUD real-rules និង fuzz seed២០០ បន្ថែម PASS។

### 2026-10-19 — A257 ៖ ផ្ទៀងឡើងវិញ · recovery មិនបង្កើត trash ក្រោយ peer Restore

- ម្ចាស់គម្រោងស្នើផ្ទៀងការងារឡើងវិញ។ Checkout ដាច់ដោយឡែកពី PR head `781bfed5`៖ ឧបករណ៍ផ្សេង Restore មុន recovery អាន trash ចុងក្រោយ ខណៈ view នៅចាស់ ➜ regression stage `moved` និង `slot` FAIL២ ដោយ trash ត្រូវបង្កើតឡើងវិញ និងដក៧។ ក្រោយកែ source read រកឃើញ merge ទៅ target ផ្សេងនៅខ្វះភស្តុតាង ➜ regression ផ្សេង២ FAIL; មិនយក checker ចាស់ដែលបៃតងមកបិទករណីថ្មីទាំងនេះទេ។
- `cleanupHistoryForRecovery()` រួមការអាន source record ថ្មី និង target ដែល `zoew_restore_finalizations/<trashId>` ចង្អុល។ TargetId ជា hint ប៉ុណ្ណោះ៖ អាន target ពិតពី backend សិន ហើយជំនួសតែ source/target នោះក្នុង history សម្រាប់ការផ្ទៀង។ Hint ចាស់ដែល Server មិនមាន barcode នោះមិនរារាំងការបញ្ចប់ cleanup ត្រឹមត្រូវឡើយ។
- ប្រើភស្តុតាងដដែលក្នុង slot, trash ដែលបាត់ក្រោយ move/ledger និង missing flip។ Read បរាជ័យ ឬ database/auth generation ប្រែ ➜ រក្សា journal រង់ចាំ និងមិនសរសេរបន្ត។ មិនទាញ history ពេញដើម្បីរក merge target ហើយមិនបន្ថែមអាននេះទៅ normal Sign/write ទេ។
- CI ក្រោយកែឈ្មោះ local TDZ ឆ្លង៣shards តែ CRUD sandbox scope guard ចាប់ dependency ថ្មីដែលនៅខ្វះ៖ `cleanupResumeBarrier` និង `resumeInterruptedCleanups`។ ផ្ទុក barrier, recovery pass/entry និង ownership function ពិតជាមួយថេរ និង state របស់វា; មិនដាក់ stub success ហើយមិនបន្ថយ scope guard។ ក្រោយកែ CRUD rules checker PASS១៣៩ ដោយ STRICT និង emulator ពិត។
- Unit module cleanup/restore/session៩ files PASS១១៤៖ peer restore ទៅ source/merge target ក្នុង stage moved/slot/ledger, ប្តូរហាងពេលអាន finalization/target, hint ចាស់ និង source ID មិនត្រឹមត្រូវ។ Harness ស្រង់ source ផ្ទុក helper ពិត; ZTO banner guard ក៏ហាម helper លុយថ្មីពី status module ដដែល។
- Full run លើ `781bfed5` ត្រូវបញ្ឈប់តាម `runall_abort` ក្រោយរកឃើញ race ថ្មីនេះ ដើម្បីរត់លើ code ដែលកែរួច។ រក្សា state/log ដែលចប់រួច ប៉ុន្តែមិនបញ្ចូលពួកវាទៅ state នៃ snapshot ថ្មី។

### 2026-10-19 — A256 ៖ CI ក្រហមក្រោយ merge និង cleanup recovery handoff

- CI លើ PR ជុំមុន៖ shard៣ជាប់ journal១ក្នុង Cookie Remove/offline-online ខណៈ adapter pending០ និង phase ready; ការផ្ទៀង barcode/លុយនៅជំហាននោះមិនបានដល់។ Main CI រត់ឡើងវិញ shard៣ PASS ប៉ុន្តែ shard៤នៅ FAIL `payload-schema`: `entry.tabs` ក្នុង queue Palm ត្រូវចាត់ថាជា database record ដោយ guard តាមឈ្មោះ។ មិនចាត់ការឆ្លងម្តងទៀតជាភស្តុតាងថា race អស់ឡើយ។
- កែឈ្មោះ local variable ដែលទើបបន្ថែមក្នុង `trimPageHints()` ជា `pageTask` ដើម្បីមិនច្រឡំ record; រក្សា guard និង schema ដើមទាំងស្រុង។ ការកែ ZTO LOCK នេះស្ថិតក្នុងសំណើម្ចាស់គម្រោងឱ្យបញ្ចប់ការផ្ទៀងផ្ទាត់ការងារល្បឿន។
- ការរត់ lab ឡើងវិញដោយ seed០ដូច CI PASS មុនកែ ដូច្នេះមិនអះអាងថាបង្កើត timing CI ដដែលបានទេ។ Regression គ្រប់គ្រងលំដាប់បានចាប់ចន្លោះ handoff៖ recovery រំលង live owner ហើយក្រោយម្ចាស់ដោះសោគ្មានអ្នកចាប់បន្ត។ Regression ដំបូង២ FAIL មុនកែ; មានករណី recovery pass ផ្សេងកំពុងអានផង។
- Owner រក្សា database/auth generation ពេលចាប់សោ និង promise នៃ Web Lock; ដោះសោហើយ journal នៅសល់ ➜ រង់ចាំ lock settled និង recovery pass ចប់ រួច resume តែក្នុង session/ហាងដើម។ Barrier ជា promise សម្របការងារ គ្មាន credential ឬទិន្នន័យអតិថិជន។ ការបន្តមិនបាន commit មិនបង្កើត trash ឬកាត់ប្រាក់; keyed ledger ដើមធានាថា retry មិនបូក/ដកស្ទួន។
- Regression បន្ថែម២បង្កើត history view ផ្ទុយពី Server៖ មិនបាន commit តែ view បាត់ barcode និងបាន commit តែ view នៅមាន barcode។ មុនកែ fresh proof ទាំង២ FAIL។ `resolveCleanupSlot()` អាន source record ដើមពី backend មុនសម្រេច ownership ហើយជំនួសតែ source នោះក្នុងការផ្ទៀង view; read បរាជ័យ ឬ session ប្រែ ➜ រង់ចាំ ដោយមិនបង្កើត trash ឬកាត់លុយតាម cache ចាស់។
- Harness ស្រង់កូដត្រូវផ្ទុក barrier ពិតជាមួយ recovery functions; មិនជំនួសជាការឆ្លើយ success។ Failure diagnostics ក្នុង money flow រក្សា journal/live owner/history/trash របស់ fixture ដើម្បីបែងចែក pending work និងចម្លើយ read ចាស់ ដោយមិនលុប assertion ឬបង្កើន timeout។
- តេស្ត module ZTO៤៣ files PASS៨២៧ (ក្រៅ LOCK មុនប្តូរ hash); cleanup/restore/session ចុងក្រោយ៩ files PASS១០០ និង LOCK PASS១៤។ Guard ZTO ទាំង១១ PASS មុនធ្វើបច្ចុប្បន្នភាពតែ hash `zto-list-sync.ts`; payload-schema និង state-hygiene ក៏ PASS ដោយគ្មាន exception ថ្មី។ តេស្ត rules ដាច់ដោយឡែកមួយបរាជ័យព្រោះ emulator ឈប់; ចាប់ផ្តើម emulator ឡើងវិញ ហើយរក្សាប្រវត្តិ failure នោះ មិនរាប់ជាបៃតង។
- ក្រោយ fresh proof៖ checker ពាក់ព័ន្ធ៦/៦ PASS, គ្មាន SKIP/PARTIAL (Firebase/Supabase money, transaction outcome១១០, real-rules restore១៨២, payload និង state)។ Cookie/Palm លើហាង Supabase២ + Firebase១ មាន២៦៤ checkpoints,១៩២០ repeated calls និង៩៦ page closes; server money/barcode និង view ត្រូវគ្នា។ នេះជាការរត់ពាក់ព័ន្ធ មិនជំនួស full audit ទេ។
- ការរត់ full ក្នុង cloud ជុំមុនត្រូវបានរំខានក្រោយ state១៦៧ checker (១៦៦ PASS,១ FAIL payload-schema); មិនមែនការរត់ពេញ និងមិនត្រូវរាយការណ៍ថា២១៣បៃតង។

### 2026-10-19 — A255 ៖ ធៀប Palm APK និងកាត់ការទាញទំព័រលើស

- សំណើផ្ទាល់ម្ចាស់គម្រោងឱ្យធៀប `draft.7z` និងបង្កើនល្បឿនបន្ថែម អនុញ្ញាតឱ្យកែ `src/features/zto-list-sync.ts` ក្នុងតំបន់ ZTO LOCK។ Regression មុនកែធ្លាក់២៖ hint ចាស់១២០ទំព័រនាំឱ្យទាញ២៤២ list requests ទោះ Server រាយការណ៍ចំនួនថ្មីតិច។ មូលហេតុ៖ `plan()` បន្ថែមការងារតែប៉ុណ្ណោះ ហើយមិនដក speculative work ចាស់ពីជួររង់ចាំ។
- កែតែ queued entries ក្រោយទំព័រទី១៖ រក្សា tab ដែលមានទំព័រពិត និង request ចាប់ផ្តើមរួច; សម្អាត reservation របស់ការងារដែលដក ដើម្បី metadata កើនក្រោយមកអាច schedule ទំព័រនោះវិញ។ មិនបង្កើន concurrency៨×៨, មិនលុប track, មិនប្តូរ write/Sign/លុយ និងមិន cache សាលក្រមចាស់ទេ។
- វាស់ App និង Function ពិតជាមួយ upstream សិប្បនិម្មិតដែល list response ពន្យារ២០ms៖ stock បន្ថែម០ ➜ list២៤២→១៨, Function១២៨→១៦, ៣៤៥→៣២ms; stock បន្ថែម៩៥០ ➜ list២៤២→២០, Function១៥៣→៤៣, ៤៧៤→១៤២ms។ ជាការវាស់ករណី hint លើសជាក់លាក់ មិនមែន production benchmark ឬការធានាល្បឿនគ្រប់ stock។ Barcode លទ្ធផលដដែល និង track គ្រប់ candidate ម្តងមួយ។ Guard បន្ថែមផ្ទៀងថា metadata កើនក្រោយ prune អាចអានទំព័រ៩/១០ឡើងវិញដោយគ្មានស្ទួន។
- តេស្ត ZTO ៤៣ files PASS៨២៧ (ក្រៅ file LOCK មុនប្តូរ hash), រួច E2E ចុងក្រោយ PASS១៨។ Mutation ដកការសម្អាត reservation ➜ regression ក្រហម ព្រោះទំព័រ៩/១០មិនត្រឡប់ចូលជួរ; ស្តារកូដវិញ PASS។ Checker ZTO ទាំង១១ PASS ដោយគ្មាន SKIP/PARTIAL លើ snapshot កូដពិតក្រោយ mutation រួចទើបប្តូរ sha256 តែ `zto-list-sync.ts` ក្នុង LOCK; មិនបន្ថយអ្នកយាមណាមួយ។
- អាន APK ជាឯកសារយោងតែប៉ុណ្ណោះ៖ `PDARequestImpl.getDispatchList` ប្រើ pageNum/pageSize; pageSize១០០០ នៅ `getExpressList(orderStatus=2)` ជា endpoint ផ្សេង ដូច្នេះមិនចម្លងទៅ dispatch។ `getSignScanList(waybillList)` សម្រាប់ព័ត៌មាន Waybill/ប្រាក់ មិនជំនួស arrival-track proof។ Native `uploadSign(List)` ប្រើ local SQL/UploadPool និងលទ្ធផលតាម `barScannerId`; ការទទួលចូល local queue មិនស្មើ server Sign ជោគជ័យ។ ZoeW នៅតែផ្ទៀង server និងបញ្ចៀសការបញ្ជូន Sign ស្ទួនពេលចម្លើយមិនច្បាស់។
- read/write/sync៖ ZoeW មាន independent-path write gates និង batch, durable operation IDs/replay, incremental listener sync និង credential preparation ស្របគ្នារួច។ Fresh reads មុនកែលុយចាំបាច់សម្រាប់ឧបករណ៍ច្រើន; មិនយក snapshot ចាស់មកបន្ថយ request។ Cookie អាន arrival list ដោយផ្ទាល់ ខណៈ Palm ត្រូវ track ម្តងមួយកញ្ចប់; មិនមានភស្តុតាងថា API APK ផ្សេងអាចជំនួស semantic នេះបានទេ។

### 2026-10-19 — A254 ៖ សម្លេងស្កេនខ្លាំង តាមសំណើម្ចាស់គម្រោង

- ម្ចាស់គម្រោងចង់ឱ្យ beep ខ្លាំងដោយមិនតាម volume ទូរស័ព្ទ។ PWA មិនមាន API បង្ខំ system volume/mute; Android native អាចលើក media stream តាម permission `MODIFY_AUDIO_SETTINGS`។ មិនអះអាងថាអាចជំនួស volume ថេរ/DND/OEM ឬកម្រិតផ្នែក hardware ទេ។
- មុនកែ Web Audio gain `0.1` និងគ្មាន native scan tone; regression FAIL ២។ APK ប្រើ plugin `ZoeScanBeep`, tone ១៥០ ms និងស្តារ volume ក្រោយ ២០០ ms ឬ pause/destroy; ចុចស្ទួនលែង tone មុន/លុប timer ដើម, អ្នកប្រើប្តូរ volume ក្នុងពេលនោះ ➜ មិនជាន់ការប្តូររបស់គាត់។ មិនលើក volume ក្នុង call/communication mode, មិនប្តូរ DND policy; OS បដិសេធ ➜ fallback web ដោយមិនរារាំង scan។
- PWA gain ពេញ (`1`) ជាមួយ attack/release ramp និង disconnect nodes ពេលចប់; plugin ថ្មីមិនមានលើ APK ចាស់ ➜ Web Audio fallback ម្តង, គ្មាន beep ស្ទួន។ `tests/native/scan-beep.test.ts` វាស់ JS dispatch និង compile/run Java plugin ពិតជាមួយ AudioManager/ToneGenerator/Handler stubs៖ volume 0, restore, duplicate, user change, fixed volume, call, permission failure និង tone failure។ មិនមែនការវាស់កម្លាំងសម្លេងលើឧបករណ៍ពិត។

### 2026-10-19 — A253 ៖ APK ខ្វះកូអរដោនេ និង font/Gallery តាម Palm

- ម្ចាស់គម្រោងបង្ហាញ ZoeW APK មានតែ timestamp ទោះអនុញ្ញាត location; រូប Palm APK និង iOS PWA មានកូអរដោនេ។ សំណើថ្មីឱ្យផ្គូផ្គង font ក្នុង `draft.7z` និងដាក់ម៉ោង/GPS ពេលជ្រើស Gallery ជំនួសច្បាប់ចាស់ដែលហាម bold និងហាមពេលជ្រើស។ កែច្បាប់ដើមក្នុង CLAUDE តែមួយកន្លែង។
- Regression មុនកែ FAIL ៤៖ ស្កេនមុន fix បញ្ជូនរូបគ្មាន GPS, Permissions API ព្យួររារាំង watch, owner ទី១បិទបញ្ឈប់ watch ទោះទី២នៅបើក និង EXIF GPS រូបទើបថតត្រូវចោល។ Font regression មុនកែ FAIL ១។ ក្រោយកែ តេស្ត service/Sign ទាំង៣ files PASS ៨៥ រួម coarse fallback, permission denied និង font constructor បរាជ័យ។
- Frame និងម៉ោងចាប់ដើមរក្សាដដែលក្នុងពេលរង់ចាំ; GPS watch មួយតាមចំនួនអ្នកប្រើ មាន epoch guard និង query ceiling។ Timeout high-accuracy ទុកពេលឱ្យ coarse fallback; មិនមានកូអរដោនេ ➜ បង្ហាញស្ថានភាពពិត។ Gallery គ្មាន EXIF គ្រប់ប្រើម៉ោង/GPS ពេលជ្រើស និងប្រាប់ក្នុង UI; មាន EXIF គ្រប់រក្សារបស់រូប។
- អាន `com.zto.pda.Z10.component.utils.image.WaterMarkUtil` ដែល `SignScanActivity$8` និង `FileCenter$3` ហៅពិត៖ TextPaint fake-bold ពណ៌ `#ff0000`, ទំហំតាមកម្ពស់ និងបង្រួមតាមទទឹង។ មិនយក framework watermark ផ្សេងដែល Sign មិនប្រើ។ Bundle Roboto Latin 700 ពី `@fontsource/roboto@5.3.0` (SIL OFL) ជាមួយ NOTICE/អាជ្ញាបណ្ណ និង SW core asset; APK/decompile មិនចូល repository។
- Hardware scanner ប្រើ fallback រូប sync ដាច់ពី camera និងអាចឆ្លង GPS wait; regression បន្ថែម FAIL ២ មុនកែ។ `acceptPalmSignBarcode()` ទទួលអត្តសញ្ញាណ scan ភ្លាម ប៉ុន្តែរង់ចាំ `capturePalmSignPhoto()` មុនទទួលរូប/dispatch; ចុចស្ទួនប្រើការងាររូបដដែល និងប្រើ operation fence ដែលមានស្រាប់។ បិទ/បើកផ្ទាំង ឬប្តូរគណនីមិនទទួលរូបចាស់; គ្មានការប្ដូរទម្រង់ API សរសេរ Sign។
- `purity:check` ចាប់ font loader ប៉ះ `document.fonts`/`baseURI` ពី service; ផ្លាស់ DOM I/O ទៅ `loadScratchFont()` ក្នុង `platform/document-io.ts` ដូច offscreen canvas។ Guard អនុញ្ញាតតែ property ពិតក្នុងច្រក I/O នោះម្តងមួយ; services នៅតែហាម DOM ដដែល។ តេស្ត constructor failure ផ្ទៀងថា factory ត្រូវបានហៅពិត។ Tarball font ផ្ទៀង SHA-512 ជាមួយ npm registry និង bytes font/OFL ដដែលពី archive។
- ក្រោយបន្ថែម hardware wait និង epoch regression៖ តេស្ត GPS/Sign/scanner queue/native beep ទាំង៥ files PASS ១២១; typecheck/lint PASS។ Negative probes របស់ purity guard បដិសេធ DOM access ពី service និងការបន្ថែម font access ទី២ក្នុង I/O ខណៈ baseline ត្រឹមត្រូវនៅ PASS។
- `state-hygiene` ទាមទារហេតុផលឱ្យ state រស់ក្រោយ logout៖ font-load promise និង native-beep proxy ជា resource សាធារណៈគ្មានទិន្នន័យគណនី; GPS epoch ជាលេខរាប់ឡើងសុទ្ធដែលត្រូវរក្សា ដើម្បីបដិសេធ callback ចាស់។ កត់ ACCEPTED តែ resource ទាំង៣នោះ ដោយមិនលើកលែង config/token របស់អ្នកប្រើ។
- Full STRICT បន្ទាប់បន្ថែម GPS/beep រត់គ្រប់ ២១៣ checker៖ ២០៩ PASS · ៤ FAIL · ០ SKIP/PARTIAL។ ការរាយការណ៍ ៣ គឺ font DOM I/O, state resource rationale និងលិបិក្រម; កែរួច metadata ១០/១០ PASS លើ snapshot ចុងក្រោយ។ Layout មួយអស់ពេល ៣០០វិ៖ history probe ដាច់ដោយឡែកគ្រប់ទទឹង PASS ហើយ layout ពេញរត់ឡើងវិញ PASS ២៥៩ assertions ក្នុង ១៦៣វិ ដោយមិនបង្កើន budget ឬបន្ថយ assertion។ Unit suite ពេញលើ snapshot ចុងក្រោយក៏ PASS (ជំហាន zoew-suite ផ្នែក១ សរុប ១៥១វិ)។ រក្សា full-run ដែល exit ៤ ជាប្រវត្តិ មិនបញ្ចូលលទ្ធផលពី snapshot ផ្សេងទៅ state ចាស់ ឬហៅវាថា full green ទេ។
- ដែនភស្តុតាង៖ cloud មិនមានទូរស័ព្ទ APK ពិត។ ករណី Android ក្នុងតេស្តវាស់ browser callback/permission race និងការដាក់ត្រា; មិនអះអាងថាវាស់ Android location provider គ្រប់ម៉ូដែល។

### 2026-10-19 — Cookie Blob និង Palm Login · បណ្តាញ និងបិទ App កណ្តាល flow (A250 · A251 · A252)

- **ភស្តុតាងមុនកែ**៖ browser ពិត + Function `zto-order-detail` ពិត + Blob SDK/Argus សាកល្បង + Firebase emulator/rules ពិត។ ក្រោយ claim លុប history ដល់ server តែមុន ACK បិទ page ➜ Delete បាត់ barcode ពី history និង trash ខណៈ COD ក្នុង ledger រក្សា `143.34`; ទិន្នន័យ barcode ដែលសល់តំណាងត្រឹម `133.34`។ ការកែរក្សា before-image ក្នុង trash និងរក្សាលុយតាមច្បាប់ Delete។ Remove ក៏បាត់ barcode ក្នុងចន្លោះដូចគ្នា; pickup 2h បាត់ barcode និងមាន pickup key កំព្រា។ ទាំងនេះជាចន្លោះមុន domain journal សរសេរ មិនមែនអះអាងតាមការអានកូដប៉ុណ្ណោះ។
- **Restore**៖ ក្រោយ server ដាក់ claim ហើយបិទ App មុន ACK ការសាកថ្មីបង្កើត token ថ្មី ➜ ជាប់ lease ខ្លួនឯង។ Supabase ៣ devices ស្តារស្របគ្នា ក៏ឃើញ server/history ត្រឹមត្រូវ តែឧបករណ៍ចាញ់ទទួល resync ចាស់មកក្រោយ listener ថ្មី ➜ ទិដ្ឋភាពបង្ហាញ trash ចាស់។ Regression បន្ថែមទៅ `trash-retry-session.test.ts`; លទ្ធផល UI ត្រូវតាម server ក្រោយជំហាននីមួយៗ។
- **Harness**៖ `money-cookie-blob.js` ប្រើ Cookie តែពី store `zto-auth/cookie` (គ្មាន token/env fallback), Function ពិតផ្ទៀង ID token/`my_account`; SB fixture ចេញ JWT `iss` ដូច GoTrue។ Argus ត្រូវទទួល Cookie ត្រឹមត្រូវ; list/detail/Blob reads មានជាន់អប្បបរមា។ DB SDK, rules, migrations, RLS, CAS និង ledger មិន stub។ Network gate លើ HTTP/RTDB WebSocket ទប់មុន write ឬទប់ ACK ក្រោយ `ok` ពិត; បិទ page ពិត ហើយបើក page ថ្មីក្នុង storage ដដែល។ កំណត់ ripe age បន្ទាប់ពី arm gate ដើម្បីកុំឱ្យ cleanup រត់ហួសការចាក់។
- **Palm Login និង Cookie លើ backend ទាំង២**៖ browser ពិត Login Palm ម្តងតាម App/Function ហើយ devices ២–៣ ភ្ជាប់ session ហាងពី Blob; មិន inject session ឬ stub ផ្លូវលុយ។ Assert សាខាត្រឹមត្រូវ និងគ្មាន session/refreshToken/ពាក្យសម្ងាត់ក្នុង config ទូរស័ព្ទ។ Cookie ប្រើ host/API របស់ខ្លួន; Palm ប្រើ token ពី Login ទៅ host/API របស់ Palm ដោយមិនផ្ញើ Cookie។ លើ Firebase ១ហាង និង Supabase ២ហាង × ៣devices របៀបនីមួយៗវាស់ ៤៤ checkpoints (លុប · ដក · pickup 2h · abandon ថ្ងៃទី៨ × duplicate/offline/slow/close មុន write/close ក្រោយ commit × move/restore)៖ សរុប **២៦៤ checkpoints · ១៩២០ calls ស្ទួន · ៩៦ page closes** PASS។ COD/DOD/count ដែលរំពឹងទុកគណនាឯករាជ្យពី flags; អាន ledger ថ្ងៃ/ខែ, registry, pickup និងទីតាំង barcode ពី server ហើយផ្ទៀងទិដ្ឋភាពគ្រប់ device ក្រោយជំហាននីមួយៗ។ Supabase រត់ហាងតាម batch ២ ស្របគ្នា ដោយរក្សាពិដាន checker ៣០០វិ។ គ្មានការប៉ះ production ឬការអះអាងថាជាការវាស់ឧបករណ៍ iOS/APK ពិត។
- **Regression បន្ទាប់ពីកែ**៖ unit suite ពេញ **២៣១៨ tests/២១១ files PASS**, typecheck/lint PASS។ `cleanup-interrupt-atomicity-test` ៨២, `tx-outcome-test` ១១០, `ledger-failed-apply-revert-test` ៥០, real-rules `emu/restore-mutation-emu-test` ១៨២ PASS; `money-guardian-test` ទាំង២ផ្នែក STRICT PASS (២៥ + ២២) ដោយគ្មាន SKIP។ Full audit នៃជុំមុននៅ A241–A247 មិនមែនភស្តុតាងថា tree ជុំនេះបៃតងពេញទេ។
- **Recovery ត្រូវសម្រេចពីទីតាំង barcode**៖ random seed 201 ចាប់ឃើញ before-image នៃ partial claim ដែលមិនបានអនុវត្ត ត្រូវបានបញ្ចូល trash ទោះ barcode នៅក្នុង history; ផ្ទៀង history/trash ទាំងអស់មុន claim slot។ Guard រំខានក៏ចាប់ early release របស់ live lock ក្រោយ `settleLockWithin()` ដោះសោ UI ខណៈ trash write នៅហោះ; lock រស់រហូត `finishCleanup()` ចប់ពិត ដើម្បីរារាំង recovery ដកស្ទួនលើ rules legacy។ ករណី legacy · tab ដដែល · tab ផ្សេង · tab ស្លាប់ ឆ្លងទាំង ៨២ ការអះអាង។
- **ច្បាប់លុប/ដកក្នុង CLAUDE**៖ បញ្ជាក់ប្រាក់/ចំនួនលើ Delete, Remove, Restore និងលក្ខខណ្ឌ pending; `isDeducted` ជា settled flag ហើយ event/journal ជាភស្តុតាងពេលរំខាន។ កែ clock ស្តារឱ្យបែងចែក closed/open និងរក្សា fallback សម្រាប់ legacy គ្មាន barcode array។ លុបតារាង mapping trash ដែលស្ទួន ដោយយោង scenario table តែមួយ។ `doc-scope-test` ផ្ទៀងស្ទួន/ផ្ទុយ និងលិបិក្រម។
- **ការកែ checker ដែលមានហេតុផល**៖ quota test ផ្ទៀង history/ledger នៅដដែលពេលមិនអាចរក្សា before-image; មិនបង្ខំឱ្យប្រតិបត្តិការប្រថុយបន្ត។ Remove test ផ្ទៀង trash មួយ, barcode មួយ, write បង្កើត + flip, COD ថ្ងៃ/ខែ និងករណីប្តូរ session នៅចំណុច await ដដែល។ `late-commit-test` ផ្ទុក helper before-image/live lock ពិត; `write-stall-guard-test` និង `stale-write` ស្គាល់ `claimCleanupTrashSlot` ដែលជាទ្វារថ្មីរបស់ Remove ដោយរក្សា floor ដើម និងពង្រឹងថា Delete/Remove ទាំង២ត្រូវបានវាស់។ កែ App ឱ្យ late commit មិនបន្ថែម progress toast ទី២ ហើយរក្សាសារជោគជ័យដើមដែលត្រឹមត្រូវនឹងការកាត់ប្រាក់។ គ្មានការលុប assertion, skip ឬបង្កើន timeout ដើម្បីធ្វើឱ្យបៃតង។

### 2026-10-19 — Deep audit cloud ៖ ចន្លោះ checker និងលទ្ធផលសរសេរមិនច្បាស់ (A241 · A242 · A243 · A244 · A245 · A246 · A247)

- **A241 — secret leak**៖ VM លើ source ពិតបង្ហាញ credential `Basic`/`Bearer` ខ្លី និង cookie ទីពីរក្នុង header ដែលមាន quote នៅសល់។ ការបន្ថែមករណីទាំងបួនទៅ `secret-hygiene` ធ្វើឲ្យ tree មុនកែ FAIL 4; source កែរួច PASS 264។ credential សាកល្បងសុទ្ធតែក្លែង មិនមាន secret ពិតក្នុង log។
- **A242 — Supabase write verdict**៖ HTTP 200 + `{}`/`[]`/`{"ok":"false"}` អាចធ្វើឲ្យ set រាយជោគជ័យដោយគ្មាន write និង transaction រាយបរាជ័យក្រោយ commit។ ចម្លើយទទេឆ្លងចេញពី catch ដោយគ្មាន `uncertain` ក្នុង journal; retry ដែល auth មិនអាចផ្ញើអាចប្ដូរវាទៅ `queued`, បាត់ព្រំដែនអាយុ replay។ តេស្តថ្មី FAIL 6 ក្នុង bad-body និង FAIL 4 ក្នុង journal លើ source មុនកែ; កែ validation នៅក្នុង catch boundary រួច តេស្តពាក់ព័ន្ធ PASS 29។
- **A243 — layout**៖ browser ពិតទំហំ 780×300 នៅរបៀបដក មានប៊ូតុង y=244..269 ខណៈរបា Tab ចាប់ពី y=255។ រត់ដដែលជាមួយ fontconfig distro ក៏ FAIL ដូចគ្នា; មិនមែនបញ្ហា font setup។ checker ពិនិត្យប៊ូតុងទាំងមូល ជំនួសពិនិត្យតែកណ្ដាល; កែតែ `react-root.css`, មិនប៉ះឯកសារ PTR/scroll ដែលចាក់សោ។
- **A244–A245 — pickup race និងការបាត់ journal**៖ stress 8 ហាង × 3 devices × 40 ជុំ (2411 `zoe_write`) រកឃើញ pickup 5 ខណៈ barcode បិទ 4; COD/DOD នៅត្រឹមត្រូវ។ ប្រតិបត្តិការបើកពី cache ចាស់ abort ក្រោយឧបករណ៍ផ្សេងដក barcode បើកទៅ trash រួច ប៉ុន្តែ revert ដាក់ pickup ចាស់វិញ។ អាន history/trash ពី Server មុន revert និងរក្សា intent ពេល pickup commit មិនជោគជ័យ។ regression អប្បបរមា 3 FAIL មុនកែ; តេស្តពាក់ព័ន្ធដំបូង 18 PASS; តេស្ត listener មកយឺតបន្ថែមរកឃើញ A246។
- **A246 — listener មកយឺត និង recovery**៖ ការប្ដូរ whole/barcode ទទួលចម្លើយមុន listener ថ្មី បង្កើត pickup ចាស់វិញ (probe FAIL 2); បើការអានបរាជ័យ រួច recovery ប្រើ listener ចាស់ ក៏ FAIL 1។ ផ្លូវទាំងពីរប្រើ `readPickupTruthViews()` រួម៖ Firebase REST `no-store` ជំនួស SDK cache; Supabase `zoe_read` ពិត។ មិនអាចអានបាន ឬប្ដូរ session ➜ មិនសរសេរតាមការសន្មត និងរក្សា journal។ តេស្ត clamp ចាប់ការកែដំបូងថាបង្កើត Reset ឡើងវិញ ➜ undo រក្សា mark ដែលមិនបានផ្លាស់ប្តូរ; lookup តាម Map ដើម្បីជៀសវាង O(n²)។ តេស្ត `pickup-interrupted-close` PASS 18 លើ main ថ្មី រួមទាំង recovery ដែល listener មិនទាន់មក។
- **A247 — Supabase read verdict**៖ `zoe_read` HTTP 200 ដែលជា `null`/`{}`/`[]`/`{"docs":null}` ត្រូវបានចាត់ថាទិន្នន័យអវត្តមាន; probe មុនកែ FAIL 4 ខណៈ valid `docs: []` អានបានត្រឹមត្រូវ។ ឥឡូវបដិសេធ response ដែលគ្មាន docs array ដើម្បីមិនសម្រេច undo/recovery តាមទិន្នន័យទទេក្លែង។
- **dead code និងឯកសារ**៖ compiler `noUnusedLocals` បង្ហាញ binding មិនប្រើ; លុប import/អថេរទាំងនោះ ហើយរក្សា await នៃការស្តារទិន្នន័យ។ មិនលុបឯកសារដោយគ្រាន់តែមិនឃើញ static import ព្រោះ CLI/Apps Script/native មាន entry point ផ្សេង។ Handoff ចាស់រាយ branch មិនទាន់ merge តែ `git log` បង្ហាញ merge commit `c39268c0`; លុបស្ថានភាពចាស់ និងសេចក្តីផ្អាក Supabase ដែលសំណើ audit ថ្មីបានជំនួស។
- **stress ដំបូងក្រោយកែ មុនបញ្ចូល main ថ្មី**៖ Supabase 8 ហាង × 3 devices × 40 ជុំ PASS លើ Postgres ពិត (2420 សំណើ `zoe_write`; cross-shop concurrency 26, return race 50, offline/online 191, offline/reload 146)។ Firebase 3 devices × 5 លំដាប់ × 30 ជុំ និង fuzz seed ថ្មី 14 × 50 PASS; ដែននេះជាការសាកក្នុង cloud មូលដ្ឋាន មិនមែនការវាស់ quota/latency លើ production។
- **ភាពត្រឹមត្រូវរបស់ checker**៖ mutation នៃ pickup revert ប្ដូរយុថ្កាទៅ body ថ្មី ដោយរក្សាកំហុស no-op ដដែល និង floor 10។ CRUD sandbox បញ្ចូល `pickupTruthMarks` ពិត ជំនួសខ្វះ dependency។ iPad reverse fixture ចាស់មាន input bottom 407 + gap 8 នៅពីលើ keyboard line 422 (820−398) ដូច្នេះមិនទាន់ចូលស្ថានភាពបាំង; fixture ប្រើ inset 430 ហើយរក្សា precondition/behavior assertions។ App-lock harness មិនអនុញ្ញាត `tel:` បើកទំព័រ error របស់ headless (storage ត្រូវបដិសេធ); click capture ពិត និង lifecycle/one-shot exemption នៅតែវាស់។ មិនប្ដូរកូដ App Lock ឬ iOS ដើម្បីឲ្យ checker បៃតង។ Feed update ទុកតែកំណែចុងក្រោយតាម guard ដែលមានស្រាប់។ `supabase-notify-dirty` fake transport កែឲ្យឆ្លើយ `zoe_read` ជា `docs` array តាម API ពិត និងបដិសេធ RPC មិនស្គាល់; ទុក assertions សម្អាតហាងចាស់ដដែល។
- **បញ្ចូល main ថ្មី**៖ សំណើម្ចាស់គម្រោងផ្ទៀងផ្ទាត់ `63713d7d` (PR335)។ រក្សាមុខងារ ZTO/EXIF និង rules ថ្មីរបស់ main; កំណែ audit ប្ដូរទៅ 2.50.130 និងលេខ A241–A247 ដើម្បីមិនស្ទួន A234–A240 របស់ main។ Native checker ចាប់ pending ពេល focus មុន rAF ដើម្បីមិនខកខាន animation ចាប់ផ្ដើម; keyboard checker ចាត់កាតតាមទំហំល្មមពិត (390 មិនល្មម 389) ដោយរក្សា assertions ពេញលេញ។
- **បរិស្ថាន**៖ Node 24 · Java 21 · Chromium · Postgres ពិត · RTDB emulator ដែលផ្ទៀង size/checksum។ Firebase Node SDK មិនគោរព `NO_PROXY` ពេលបើក WebSocket ទៅ loopback; ដក proxy variables តែពី process តេស្តមូលដ្ឋាន។ ការដំឡើង និង startup instructions រស់ក្នុង cloud environment settings។
- **baseline លើ main ថ្មី**៖ full strict រត់គ្រប់ 213 checker៖ 212 PASS, 1 FAIL, 0 SKIP/PARTIAL។ មូលហេតុ fail គឺ fixture `supabase-notify-dirty` មិនឆ្លើយ `docs` array; កែ fixture រួច unit suite ទាំងមូល PASS 2,278 tests/211 files។ មិនចាត់ full run ដែល exit 1 ថាបៃតងទេ។ Stress ក្រោយបញ្ចូល main ថ្មី PASS៖ Supabase 8 ហាង × 3 devices × 40 ជុំ (2412 `zoe_write`, concurrency 26, return race 52, offline/online 195, offline/reload 144); Firebase 3 devices × 5 × 30; money fuzz 14 × 50។

### 2026-10-19 — A248 ៖ ល្បឿន Palm/Cookie តាមសំណើម្ចាស់គម្រោង និង APK ឯកសារយោង

- `draft.7z` មាន bytecode/resources APK មិនមែន Gradle project។ អាន archive ដោយមិនរត់ APK/DEX/native library និងមិនអនុវត្តសេចក្តីណែនាំក្នុងឯកសារ។ JADX ពី release ផ្លូវការផ្ទៀង SHA-256 មុនប្រើ; APK និងកូដ decompile នៅក្រៅ checkout។
- `PDARequestImpl.queryTrackInfo` ផ្ញើ `mailType:1` និង `mailNos` string; មិនមានភស្តុតាងថាទទួល barcode ច្រើន។ កូដ KH Sign របស់ APK មាន payment gate, local upload queue និង batch upload ជាមួយលទ្ធផលតាម `barScannerId`; មិនយក queue success ឬ HTTP success ជំនួស Sign ជោគជ័យក្នុង ZoeW។ ការទាញ Palm នៅតែរក្សាភស្តុតាង branch/date/status មុនបញ្ចូល។
- `headersFor()` ធ្លាប់ហៅ `addPalmSessionHeader()` ស្ទួនក្រោយ `buildLookupRequestHeaders()`; negative test decrypt ២ ជំនួស ១ FAIL ពិត។ លុបការហៅស្ទួន ហើយរៀបចំ identity ដោយឡែកព្រមគ្នា; merge trusted identity ចុងក្រោយ។ Login/ភ្ជាប់ shared និង list Palm/Cookie ក៏រៀបចំ credential + identity ព្រមគ្នា។ Barrier tests មុនកែ FAIL ៦ បន្ថែម; fetch មិនចេញមុន credential/identity រួច និង token គណនីពិតឈ្នះ config header។ គ្មាន plaintext cache ថ្មី។
- Recheck unknown Sign ធ្លាប់អាន status ម្តងមួយ; barrier តម្រូវ ៤ in-flight ធ្លាក់ពិត។ ប្រើ pool ដែលមានស្រាប់ជាមួយពិដាន ៤; ប្រមូលចម្លើយរួច Save តាមលំដាប់ដើម ដើម្បីមិនបន្ថែម write race ក្នុង item តែមួយ។ Failure ឈប់ចែកការងារថ្មី និងរង់ចាំសំណើចាស់មុនលែង busy; auth/database/config/modal switch មិនបិទកញ្ចប់តាមចម្លើយយឺត (negative tests ៥ FAIL មុនកែ)។
- Controlled benchmark រត់មុខងារពិតដោយ status latency សិប្បនិម្មិត ២៥ ms៖ ៨ កញ្ចប់ ២១៤ ms មុនកែ និង ៥៣ ms ក្រោយកែ; GET ចំនួន ៨ ដដែល និង Save ម្តងមួយ។ តេស្ត login/sign/token origin PASS ៩៦។ មិនបង្កើន concurrency របស់ list/track, មិនបង្កើន timeout និងមិនប្ដូរ API សរសេរ Sign ដោយគ្មាន contract ពិត។
- មុនធ្វើបច្ចុប្បន្នភាព LOCK តែ `zto-palm-login.ts` និង `zto-list-sync.ts`៖ ZTO unit suite PASS 799 tests/43 files (លើកលែង lock ដែលកំពុងរង់ចាំ hash តាមលំដាប់ច្បាប់) និង audit ZTO ទាំង 11 ឧបករណ៍ PASS រួម `zto-list-sync` 595 និង `zto-sync-banner` 202។ Hash និង assertions ផ្សេងរក្សាដដែល។
- Full strict លើ `c61e816b` រត់គ្រប់ 213 checker៖ 212 PASS, code-duplication FAIL 1, SKIP/PARTIAL 0។ Guard ចាប់ប្លុក credential 241 តួនៅ Login/shared connect; រួបរួម helper រួច ZTO suite 799 និង guard ZTO 11 + duplication + function-surface + doc-scope PASS។ មិនប្ដូរ runner state ឬចាត់ exit 1 ថាបៃតង។ Stress លើ commit នេះ PASS៖ Supabase 8 ហាង × 3 devices × 40 ជុំ (2408 `zoe_write`, cross-shop 27, return race 52, offline/online 191, offline/reload 151); Firebase 3 devices × 5 × 30 និង money fuzz 14 × 50។

### 2026-10-19 — A249 ៖ Health Palm មាន Session តែមិនទាន់បញ្ជាក់ការភ្ជាប់

- រូប Android របស់ម្ចាស់គម្រោងបង្ហាញ ℹ️ «មាន session Palm របស់ហាងលើ Server» ទោះ Lookup/ទាញបញ្ជីប្រើបាន។ Diagnostic ចាស់បញ្ជាក់តែការរក្សាទុក session ហើយ client តែងតែប្រើ `info`។ Negative tests 8 FAIL លើផ្លូវ App និង Function មុនបន្ថែម verification។
- `verify=1` អានតែ `queryDispatchList` `{ billStatus:'1', status:0, pageNum:1, pageSize:1 }`; auth/branch gates ដូចមុខងារអានផ្សេង។ ការពិនិត្យមានតែពេលបើក Health ឬចុចពិនិត្យម្តងទៀត; មិនបន្ថែម timer ឬ plaintext cache។ Shared auth failure ប្រើការបន្ត session ដែលមានស្រាប់; timeout និង rate limit មិនត្រូវបង្កើន។
- App + Function ពិតលើ Firebase/Supabase × identity off/optional/require វាស់ contract `session.source = device/shared` និង ✅; សាខាផ្សេងមិនហៅ ZTO។ តេស្ត shared renew លើ backend ទាំងពីរបញ្ជាក់ថា renew ម្តង ហើយទើប ✅ ក្រោយ ZTO ទទួល។
- Envelope ខូច (`verified` string · source មិនស្គាល់ · success/configured មិនពិត) ធ្លាប់បាន info ហើយ summary បៃតង; negative controls 4 FAIL មុនកែ validation។ ឥឡូវ ⚠️ ទាំងជួរ និង summary; response ចាស់ដែលគ្មាន `verified` នៅតែ info ដោយមិនអះអាងថា session បានផ្ទៀងផ្ទាត់។ តេស្ត host មិនទុកចិត្តរក្សាការមិនផ្ញើ session/ID token។
- មុនប្ដូរ hash តែ `zto-palm-login.ts` (helper រួម) និង `_shared/zto-palm.js` (Health verify)៖ ZTO suite PASS 822 tests/43 files និង audit ZTO 11 + health-check + code-duplication + function-surface + secret-hygiene + doc-scope PASS ទាំង 16។ Typecheck/lint PASS; មិនកែ assertions ឬពិដាន checker។


### 2026-10-18 — «ខុសទីតាំង» តាមមូលហេតុ ZTO · រូប Gallery តាម EXIF (សំណើម្ចាស់គម្រោង «ធ្វើទាំងពីអោយស្អាតទៅ» · A234 · A235 · ពិនិត្យឡើងវិញ A236 · A237 · A238) · ត្រា «បញ្ជូនចេញ» (A239 · A240)

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A240 | **ត្រា «បញ្ជូនចេញ» អចិន្ត្រៃយ៍ត្រូវការភស្តុតាងពេញ** — ការពិនិត្យនៅខាងក្រោយ (Cookie) អានបញ្ជី `30` លើចន្លោះបញ្ជីត្រឡប់ (ក្រោយជុំពេញ ៖ ម្សិលមិញ ➜ ថ្ងៃនេះ) ➜ «ទីតាំងមិនត្រឹមត្រូវ» ដែលស្កេនមុននោះ (ក្រោយកញ្ចប់ចូល ZoeW) មើលមិនឃើញ ➜ «បញ្ជូនចេញ» · បញ្ជី `30` ធ្លាក់/`off` ➜ ការបញ្ជូនចេញទាំងអស់ចាត់ជា «បញ្ជូនចេញ» · មុន A239 ភស្តុតាងនេះនៅក្នុងឧបករណ៍ (ស្លាក «ត្រឡប់» ដូចគ្នា) ➜ គ្មានផលប៉ះពាល់ · ក្រោយ A239 វាក្លាយជាត្រាលើគ្រប់ទូរស័ព្ទ | `ZoeW/tests/zto-returned-cleanup.test.ts` (ចន្លោះតូច + ស្កេនបញ្ហាមុន ៣ ថ្ងៃ ➜ «ខុសទីតាំង» · `problem=1` ពី `dk(4)` ៖ មុនកែ `dk(1)` ➜ ធ្លាក់) · `ZoeW/tests/zto-returned.test.tsx` (`30` ធ្លាក់/`off` ➜ `sentUnverified` ➜ `left` ៖ មុនកែធ្លាក់) · `ZoeW/tests/zto-final-marks.test.tsx` (`left` ➜ គ្មានត្រា ៖ មុនកែកត់ `ztoReturnedAt` ➜ ធ្លាក់) | [2.50.129] `fetchZtoReturnedPages(cfg, from, to, problemFrom)` · `ztoOpenSinceDay()` (ក៏ប្រើក្នុង `ztoSignedSweepRange()` · លទ្ធផលដូចមុន) · `sentUnverified` · ភស្តុតាង `left` · `ztoListTrashLabel()` · LOCK ថ្មី (សំណើម្ចាស់គម្រោង) |
| A239 | **បញ្ជូនចេញតែម្យ៉ាងគ្មានត្រាក្នុង DB** (សំណើម្ចាស់គម្រោង ៖ «ហេតុអីមិនដាក់ត្រាក្នុង DB?» ➜ «ធ្វើ … អោយស្អាតពេញលេញ») — ទូរស័ព្ទដែលមិនបានអាន ZTO មិនអាចប្រាប់ «បញ្ជូនចេញ» ពី «ត្រឡប់ ៨ ថ្ងៃ» · ការរចនា ៖ `ztoSentOutAt` តែម្យ៉ាង (⛔ `ztoReturnedAt` ➜ App ចាស់ 🔒) · ផលប៉ះពាល់ App ចាស់ដែលរកឃើញពេលរចនា ៖ ① Function ទុក `ztoMisplacedAt` លើរាល់ការបញ្ជូនចេញ (A236) ➜ APK ចាស់កត់ «ខុសទីតាំង» លើការបញ្ជូនចេញ ➜ ត្រូវ `ztoSentOutAt` ឈ្នះ `ztoMisplacedAt` · ② rules ចាស់បដិសេធ `ztoMisplacedAt` ➜ APK ចាស់កត់ `ztoReturnedAt` តែម្យ៉ាង ➜ 🔒 ➜ `ztoSentOutAt` ដោះ · ③ App ចាស់ស្តារដោយមិនដក `ztoSentOutAt` ➜ ត្រាតាមចូលប្រវត្តិ ➜ ច្បាប់ ៨ ថ្ងៃលើកក្រោយជា «បញ្ជូនចេញ» ខុស ➜ ត្រាមុន `restoredAt` មិនរាប់ · ④ rules មិនទាន់ Publish ➜ ធាតុដែលចង់តែ `ztoSentOutAt` មិនត្រូវកំណត់ `ztoFinalRefusedDb` (វាឈប់ត្រា Sign/ត្រឡប់ទាំងអស់ ៣០ នាទី) | `ZoeW/tests/zto-final-marks.test.tsx` ៦ ថ្មី (ត្រា · ស្លាកលើឧបករណ៍ផ្សេង · ① · ② · ③ · `left` · rules បដិសេធ ៖ មុនកែធ្លាក់ទាំងអស់) · `ZoeW/tests/zto-returned-cleanup.test.ts` (🔔 · ធុងសំរាម «បញ្ជូនចេញ» · ឈ្មោះធុងសំរាមក្នុងប្រអប់ ៖ មុនកែធ្លាក់) · `ZoeW/tests/cleanup-ledger-key.test.ts` (ស្តារ ➜ ដក `ztoSentOutAt` ៖ មុនកែធ្លាក់) · តេស្តថ្មីសរុប ១៤ ធ្លាក់លើកូដមុនកែ · `emu/app-writes-rules-test` (rules គ្មាន `ztoSentOutAt` ➜ បដិសេធ ៖ ការរត់ដំបូង ការសរសេរ `ztoSentOutAt` = ០ ព្រោះ `revenue-fuzz-test` ជ្រើសប្រភេទតាមលេខរាប់ក្នុងទំព័រ ដែលចាប់ពីសូន្យរាល់ជុំ ➜ ជុំនីមួយៗមាន op លើ barcode បើកតិច ➜ តែ `misplaced` · ជួសជុល ៖ លេខរាប់ឆ្លងជុំ `ztoFinalOpenSeq` · ៤ ប្រភេទរួម `left`) | [2.50.129] rules `ztoSentOutAt` (ប្រវត្តិ + ធុងសំរាម) · migration `20261018144557_zoe_rules.sql` · `barcodeZtoSentOut()` · `barcodeZtoLeftKind()` · `trashItemSentOut()` · `trashItemLeftBranch()` · `TRASH_REASON_META.sent` · `ztoSentOutRefused` · ជណ្ដើរបដិសេធ `ZTO_LABEL_STAMPS` · `executeRestoreItem()` ដក `ztoSentOutAt` · 🔔 `sentOut` |
| A238 | **Cookie ៖ «ទីតាំងមិនត្រឹមត្រូវ» នៃវដ្តមុនធ្វើឲ្យការបញ្ជូនចេញថ្មីជា «ខុសទីតាំង»** (បញ្ជីរក្សាស្កេនបញ្ហាចុងក្រោយ ≤ ៣១ ថ្ងៃ គ្មានការមកដល់តាម Barcode) · អានបញ្ជី `30` រៀងរាល់ម៉ោងទោះគ្មានការបញ្ជូនចេញ (ការហៅ Netlify +១/ឧបករណ៍/ម៉ោង) | `ZoeW/tests/zto-returned.test.tsx` (ទាញបញ្ជី ៖ ស្កេនបញ្ហាមុនការមកដល់ចុងក្រោយ ➜ `sentOut` ៖ មុនកែធ្លាក់ · គ្មានបញ្ជូនចេញ ➜ គ្មាន `30`) · `ZoeW/tests/zto-returned-cleanup.test.ts` (ពិនិត្យនៅខាងក្រោយ ៖ ស្កេនបញ្ហាមុនចូល ZoeW ➜ «ត្រឡប់» ស្តារបាន ៖ មុនកែធ្លាក់ · ការសាកដំបូងនៅក្រៅចន្លោះអាន ➜ ជាប់ទាំងមុនកែ ➜ ដាក់ម៉ោងក្នុងចន្លោះ «ម្សិលមិញ ➜ ថ្ងៃនេះ») · `ZoeW/tests/zto-multibranch-signed-hold.test.tsx` · `ZoeW/tests/zto-signed-cadence.test.tsx` | [2.50.129] `problemAt` លើសញ្ញា misplaced · `classifyZtoListRows()` ប្រៀបនឹងការមកដល់ · `ztoReturnedTargets()` ប្រៀបនឹង `barcodeReturnCounts()` · `problem=1` តែពេល `sends.length` |
| A237 | **📷 បើកកម្មវិធីជ្រើសឯកសារ ➜ រូបចាស់ទទួលម៉ោងឥឡូវ** — APK ៖ Capacitor `BridgeWebChromeClient` បើកអ្នកជ្រើសឯកសារពេលសិទ្ធិកាមេរ៉ាត្រូវបដិសេធ ទោះមាន `capture` ➜ ចន្លោះដូច A235 តាមប៊ូតុង 📷 | `ZoeW/tests/palm-sign-camera.test.ts` (📷 ៖ EXIF ចាស់ ➜ ស្លាក EXIF · ថតមុន ១ នាទី ➜ ម៉ោងឥឡូវ · គ្មាន offset ➜ ម៉ោងភ្នំពេញ · គ្មាន EXIF + ឯកសារចាស់ ➜ គ្មានស្លាក ៖ មុនកែ helper មិនមាន ➜ ធ្លាក់) | [2.50.129] `palmSignFileStampLines(file, source)` · `PALM_SIGN_FRESH_SHOT_MS` · `palmSignExifShot()` (`appZoneWallClockToMillis()` ពេលគ្មាន offset) · pointer IFD `13` |
| A236 | **App ចាស់ (2.50.128 ក្នុង APK) + Function 2.50.129 ៖ បញ្ជូនចេញតែម្យ៉ាង ➜ 🔒 ជារៀងរហូត** — Function ថ្មីដក `ztoMisplacedAt` ពីការបញ្ជូនចេញតែម្យ៉ាង ➜ App ចាស់ (`data.ztoMisplacedAt === ztoReturnedAt` មិនពិត) ចាត់ជាត្រឡប់ `-710` ➜ `syncZtoFinalMarks()` កត់ `ztoReturnedAt` គ្មាន `ztoMisplacedAt` ➜ `trashZtoFinalBlock()` 🔒 លើគ្រប់ឧបករណ៍ · APK រក្សាកូដ web ចាស់រហូតដល់ដំឡើងថ្មី | `ZoeW/tests/zto-palm-server.test.ts` «🔁 App ដែលមិនទាន់ស្គាល់ `ztoSentOutAt`» (អានចម្លើយ Function តាមច្បាប់ App ចាស់ ៖ commit មុនកែ ➜ `returned` ធ្លាក់ · ក្រោយកែ ➜ `misplaced`) | [2.50.129] `ztoMisplacedAt` លើរាល់ការបញ្ជូនចេញ · `ztoSentOutAt` បញ្ជាក់ · App អាន `ztoSentOutAt` មុន (`zto-status.ts` · `zto-list-sync.ts`) |
| A235 | **រូប 🖼 Gallery ក្នុង Sign ទទួលស្លាកម៉ោង និងទីតាំងពេលជ្រើស** — `palmSignPhotoFromFile()` ដាក់ `getServerNow()` + ទីតាំងបច្ចុប្បន្នលើគ្រប់រូប ➜ រូបដែលថតម្សិលមិញនៅកន្លែងផ្សេង បង្ហាញម៉ោង/ទីតាំងថ្ងៃនេះ (ភស្តុតាងខុស) | `ZoeW/tests/palm-sign-camera.test.ts` ២ ថ្មី (JPEG ពិតសាងពី byte ៖ II/MM · `OffsetTimeOriginal` · S/W · GPS `0,0` · ម៉ោង `0000:00:00` · ឯកសារខូច/កាត់ · pointer ខុស ➜ មិនបោះកំហុស · 🖼 EXIF ➜ ស្លាក EXIF · គ្មាន EXIF ➜ គ្មានស្លាក · 📷 ➜ ម៉ោងឥឡូវ ៖ មុនកែ helper មិនមាន ➜ ធ្លាក់) | [2.50.129] `readPhotoExif()` (APP1 ➜ TIFF ➜ IFD0 ➜ Exif/GPS · ព្រំដែនរាល់ការអាន · loop ≤ 64 marker · ≤ 256 entry) · `palmSignExifShot()` · `palmSignFramePhoto(canvas, lines)` · `takePhoto(file, 'camera' \| 'gallery')` |
| A234 | **បុគ្គលិកប្រើ «ផ្ញើចេញ» (`02`/`2`) ជំនួស «ត្រឡប់ការស្កេន» (`-710`) ➜ ZoeW ដាក់ «ខុសទីតាំង»** (ការពិនិត្យឡើងវិញក្រោយ A230) — ភស្តុតាង A230 គឺការបញ្ជូនចេញតែម្យ៉ាង ➜ ស្លាកខុស (លុយត្រឹមត្រូវ) · 🧪 ពិតរបស់ម្ចាស់គម្រោង ៖ `-582` `problemReason` «ទីតាំងមិនត្រឹមត្រូវ» (`msgEng` «Incorrect location» · `message` 原因是【地址不详】) ចំណែក `actionName` 地址不详，电话联系不上 រួមទាំងមូលហេតុទូរស័ព្ទ ➜ មូលហេតុជាអ្នកបំបែក | `ZoeW/tests/zto-palm-server.test.ts` ១៤ ករណី (៣ ភាសា · U+200B · មូលហេតុផ្សេង · វដ្តមុន · ក្រោយបញ្ជូនចេញ · សាខាផ្សេង · ត្រឡប់ឈ្នះ ៖ មុនកែធ្លាក់ទាំងអស់) · `ZoeW/tests/zto-returned.test.tsx` ៣ (Cookie `30`+`02` · `30` ធ្លាក់ ➜ `partial` · `off` · Function `problem=1` ៖ ៣ ភាសា · ចុងក្រោយ · រាប់គ្រប់ ៧) · `ZoeW/tests/zto-returned-cleanup.test.ts` · `ZoeW/tests/zto-final-marks.test.tsx` · `ZoeW/tests/zto-multibranch-signed-hold.test.tsx` (`-710` · `02` · `30` តែសាខាខ្លួន) · `ZoeW/tests/zto-signed-cadence.test.tsx` G2 (ការអានបញ្ជីត្រឡប់ធ្លាប់រាប់ជា `/detail` ➜ ដាច់ពីគ្នា + វាស់ ≤ ម្តង/ម៉ោង) | [2.50.129] `MISPLACED_REASONS` · `ztoSentOutAt` · `sentOutAt` (`_shared/zto-palm.js`) · `readListProblemConfig()` · kind `problem` (`zto-order-detail.js`) · ភស្តុតាង `{ at, kind }` (`noteZtoReturnedEvidence(code, at, kind)`) · `ztoReturnedKindOf()` · ប្រភេទ `sent` គ្មានត្រា · LOCK ថ្មី (សំណើម្ចាស់គម្រោង) |

### 2026-10-18 — ខុសទីតាំង · រូប Sign មានម៉ោង និងកូអរដោនេ · បញ្ជាក់ពេលចែកចាយ (សំណើម្ចាស់គម្រោង · A230 · A231 · A232 · A233)

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A233 | **Cookie មិនស្គាល់កញ្ចប់ខុសទីតាំង** (ភស្តុតាងតែ Palm `tracks`) · Argus មិនផ្តល់ track តាម Barcode ក្នុងផ្លូវ Cookie ➜ ប្រើបញ្ជីស្កេនតាមប្រភេទ (ដូច `-710`) ៖ កូដ Argus ស្របនឹង action Palm (`03` មកដល់ · `05` ចុះហត្ថលេខា) ➜ ផ្ញើចេញ = `02` (env កែបាន) · ព្រោះបញ្ជីមិនដឹងការមកដល់តាម Barcode ក្នុងការពិនិត្យនៅខាងក្រោយ ➜ មូលដ្ឋានគឺពេលចូល ZoeW (`barcodeReturnCounts()`) | `ZoeW/tests/zto-returned.test.tsx` ២ ថ្មី (ទាញបញ្ជី ៖ `misplaced` · ត្រឡប់ឈ្នះ · `off` មិនសួរ `02` · បញ្ជីធ្លាក់ ➜ `sentState` failed ៖ មុនកែធ្លាក់) · `ZoeW/tests/zto-returned-cleanup.test.ts` (ពិនិត្យនៅខាងក្រោយ ៖ ខុសទីតាំង · ត្រឡប់ · ជួរចម្រុះ ➜ «ត្រឡប់» · លុយដក ១៧) | [2.50.128] `zto-order-detail.js` (`readListSendConfig()` · kind `sent`) · `fetchZtoReturnedPages()` = `fetchZtoScanPages()` ×២ · LOCK ថ្មី · ✅ ម្ចាស់គម្រោង inspect Argus ពិត ៖ ជួរ `scanTypeCode: "02"` `scanTypeDesc: "អីវ៉ាន់ផ្ញើរចេញ"` (`scanSiteCode` សាខាខ្លួន · `preOrNextStationCode` ជា **ឈ្មោះ** សាខាបន្ទាប់ មិនមែនកូដ) · ស្កេនបញ្ហា `30` «ការចុះឈ្មោះបញ្ហា» `problemReason` «ទីតាំងមិនត្រឹមត្រូវ» ➜ ចាក់សោក្នុង `ZoeW/tests/zto-returned.test.tsx` (រាងជួរពិត · លេខសំយោគ) |
| A232 | **ការចែកចាយ `04` កញ្ចប់មានបញ្ហា ៖ ZoeW បដិសេធ ចំណែក ZTO Palm ពិតសួរបញ្ជាក់** — Function ទទួលការបញ្ជាក់តែ `stage === 'receipt'` (`stage !== 'receipt'` ➜ `ZTO_PALM_SIGN_CHECK_REJECTED`) ➜ កញ្ចប់ដែល ZTO អនុញ្ញាតដោយបញ្ជាក់ ចែកចាយក្នុង ZoeW មិនបាន ហើយ Sign មិនបានតាមក្រោយ | `ZoeW/tests/zto-palm-sign-server.test.ts` (ចែកចាយ ៖ សួរបញ្ជាក់ · គ្មានរូប/ឈ្មោះ · token ចែកចាយមិនប្រើសម្រាប់ទទួល · ចុចស្ទួន ➜ `04` តែម្តង ៖ មុនកែធ្លាក់) · `ZoeW/tests/zto-palm-sign.test.tsx` (ផ្ទាំងបញ្ជាក់ · បោះបង់ · ស្កេនម្តងទៀត · បញ្ជាក់ ➜ token ៖ មុនកែធ្លាក់) | [2.50.128] `_shared/zto-palm-sign.js` ៖ ហាមតែ `whetherForce: true` · `90187`/`90189` (ទាំង ២ ដំណាក់កាល) · `dispatchPalmSignCode(code, approval)` · `PalmSignConfirmation.stage` · ការទទួល `05` មិនប្រែ · `ZoeW/tests/zto-palm-sign-e2e.test.tsx` (App + Function ពិត ៖ មុនកែ ២/៣ ធ្លាក់ · «Sign មិនប្រែ» ជាប់ទាំងមុន និងក្រោយ) |
| A231 | **រូប Sign ពី ZoeW គ្មានម៉ោង និងកូអរដោនេ** (ម្ចាស់គម្រោងផ្ញើរូប ២ ៖ ZTO Palm មាន `2026-10-15 12:03:43` · `12.30011, 105.41921` ក្រហមជ្រុងក្រោមឆ្វេង · ZoeW គ្មាន) · ឧបសគ្គ ៖ Netlify `Permissions-Policy` `geolocation=()` បិទ geolocation ក្នុង PWA · APK គ្មានសិទ្ធិទីតាំង (WebView `BridgeWebChromeClient` ស្នើតែសិទ្ធិដែលប្រកាស) · Android ផ្អាក Activity ពេលសួរ ➜ App Lock | `ZoeW/tests/palm-sign-camera.test.ts` ៣ ថ្មី (ម៉ោង Asia/Phnom_Penh · ទីតាំងចាស់/មិនច្បាស់ ➜ តែម៉ោង · watch តែពេលផ្ទាំងបើក · clearWatch ពេលបិទ · លើកលែងការចាក់សោពេលមិនទាន់អនុញ្ញាត · stamp មុន JPEG) · `npm run android:check` · `netlify-config-scope-test` (ដេរីវេ ៖ App ប្រើ `navigator.geolocation` ➜ `geolocation=(self)` · មិនប្រើ ➜ `()`) | [2.50.128] `stampPalmSignPhoto()` ក្នុង `palmSignFramePhoto()` (fail-open) · `startPalmSignLocation()` ពី `SignForm` · `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (⛔ គ្មាន background) |
| A230 | **កញ្ចប់ខុសទីតាំងនៅក្នុងបញ្ជីបើក** — 🧪 ពិតរបស់ម្ចាស់គម្រោង ៖ `3` មកដល់ 13:25:26 ➜ `4` 13:33:04 ➜ `-582` «ទីតាំងមិនត្រឹមត្រូវ» 13:34:12 ➜ `2` 发件 ទៅ KC-01 13:34:40 · `ztoReturnedAt: null` ➜ ZoeW ទុកកញ្ចប់បើក (លុយមិនដក) ទោះវាចេញពីសាខាហើយ · ភស្តុតាងជ្រើស ៖ ស្កេន `2` នៃសាខាខ្លួនក្រោយមកដល់ (⛔ មិនមែន `-582` តែម្យ៉ាង ៖ `actionName` 地址不详，电话联系不上 ក៏ប្រើពេលទូរស័ព្ទមិនលើក ហើយកញ្ចប់នៅហាង) | `ZoeW/tests/zto-palm-server.test.ts` ៧ ករណី (លំដាប់ពិត · ត្រឡប់ឈ្នះ · ទទួលហើយបញ្ជូន · សាខាផ្សេង · មកដល់ម្តងទៀត · `-582` តែម្យ៉ាង · Sign ឈ្នះ ៖ មុនកែ `ztoMisplacedAt` មិនមាន ➜ ធ្លាក់) · `ZoeW/tests/zto-palm-returned.test.tsx` · `ZoeW/tests/zto-final-marks.test.tsx` · `ZoeW/tests/zto-returned-cleanup.test.ts` · `emu/app-writes-rules-test` (probe rules គ្មាន `ztoMisplacedAt` ➜ បដិសេធ) | [2.50.128] `_shared/zto-palm.js` (`SEND_OUT_ACTION`) · `zto-status.ts` · `zto-list-sync.ts` · `zto/model.ts` (LOCK ថ្មី) · `trashDisplayReasonOf()` · `trashReasonOf()` មិនឆ្លើយ `misplaced` (តម្លៃរក្សាទុកនៅ ៤ · `misplaced` ជាស្លាកបង្ហាញតែប៉ុណ្ណោះ) |

### 2026-10-18 — កញ្ចប់ចប់ក្នុង ZTO ៖ បើកវិញ · ស្តារ · Sign លឿន (សំណើម្ចាស់គម្រោង · A226 · A227 · A228 · A229)

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A229 | **tab ស្កេន (បញ្ចូល · ដក · Locker) · រូបភាព អានតែ Code128** — សំណើម្ចាស់គម្រោង ៖ «អោយ ការស្កេន ក្នុង tab ស្កេន … ស្គាល់ QR ដូចគ្នាផងលឿនល្អណាស់» · ហានិភ័យ ៖ គ្មានបញ្ជីរំពឹងទុក ➜ QR ផ្សព្វផ្សាយលើបុងអាចក្លាយជាកញ្ចប់ · ស៊ុម band ZXing (≤ 240px ខ្ពស់ ពង្រីកផ្តេក) បង្ខូចរាង QR | ZXing ពិត (`scan-engine-test` ផ្នែក QR) ៖ QR លេខកញ្ចប់ + QR URL ➜ លេខកញ្ចប់ (លឿន · ស៊ីជម្រៅ) · QR URL តែឯង ➜ '' · reader Code128 មិនអាន QR (ទិសផ្ទុយ) · `ZoeW/tests/scan-qr.test.ts` ៧ · `ZoeW/tests/scan-image-qr.test.ts` ២ (មុនកែ ៖ helper មិនមាន ➜ ធ្លាក់) | [2.50.127] `src/services/scan-formats.ts` (`pickScanCode()` ៖ Code128 ឈ្នះ · QR តែរាង Barcode ZTO `ztoBarcodeShapeIsValid()`) · ZXing ៖ រៀងរាល់ `LIVE_SCAN_QR_EVERY` អានស៊ុមមិនបង្ខូចរាង ≤ `LIVE_SCAN_QR_DIM` (`decodeLiveQrFrame()`) · Android ៖ `upgradeNativeDetectorForQr()` (តែពេលប្រព័ន្ធគាំទ្រ) · រូបភាព ៖ `scanQrReader(true)` · Sign ប្រើ detector ដដែល |
| A228 | **ស្តារជោគជ័យ តែ App ប្រកាស «❌ ស្តារទិន្នន័យបរាជ័យ»** (សំណើ «អានកូដផ្លូវ ស្តារឡើងវិញ … clean up») — ក្រោយ finalize `executeRestoreItem()` អានធាតុប្រវត្តិម្តងទៀត (`dbOp` ពិដាន 15s) ទៅអថេរ `resultingLiveItem` ដែលគ្មានអ្នកប្រើ ➜ ការអាននោះបរាជ័យ ឬអស់ពេល ➜ catch ៖ alert បរាជ័យ · Sentry money · មិនផ្ទុកធុងសំរាម/ប្រវត្តិឡើងវិញ ទោះកញ្ចប់ស្តាររួច និងលុយបូកវិញរួច | `ZoeW/tests/cleanup-ledger-key.test.ts` «ការអានប្រវត្តិក្រោយ finalize បរាជ័យ» (មុនកែ ៖ alert ១ ដង ➜ ធ្លាក់ · ក្រោយកែ ៖ ✅ · លុយ 100/10 ត្រឹមត្រូវ) | [2.50.127] ដកការអាន និងអថេរដែលគ្មានអ្នកប្រើ (ក្រៅពីនេះ export ទាំងអស់ក្នុង `restore.ts` មានអ្នកហៅ) · `payload-schema.js` ដកឈ្មោះអថេរនោះ |
| A227 | **Sign យឺត និង iOS អានរូបមិនបាន** — Sign ត្រូវស្កេន ២ ជុំ (ចែកចាយ ➜ ចុចផ្ញើ ➜ ទៅជំហានទទួល ➜ ស្កេនម្តងទៀត ➜ ផ្ញើ) ហើយ status/receipt ផ្ញើម្តងមួយ · iPhone គ្មាន `BarcodeDetector` ➜ ZXing tryHarder លើ frame 1280px រៀងរាល់ 150ms · រូប/Gallery បង្រួមដល់ 1280px រួចអានក្រោមពិដាន 3s ➜ Barcode ឆ្ងាយក្នុងរូប 4032px តូចពេក ឬអស់ពេល (WASM លើ iOS) · Code128 តែមួយ ទោះបុងមាន QR លេខដូចគ្នា | ZXing ពិតក្នុង Chromium ៖ បុងសំយោគ (Code128 + QR លេខកញ្ចប់ + QR ផ្សព្វផ្សាយ) ➜ Code128+QR អានឃើញ QR លេខកញ្ចប់ និង QR ផ្សព្វផ្សាយ ➜ `palmSignPickCode()` យកតែលេខកញ្ចប់ · Code128 គ្របបិទ ➜ QR នៅអានបាន · Barcode ក្រៅកណ្តាល ➜ ការអានលឿន (គ្មាន tryHarder) មិនឃើញ ការអានស៊ីជម្រៅឃើញ (ហេតុនេះរៀងរាល់ frame ទី ៤ ស៊ីជម្រៅ) · `ZoeW/tests/zto-palm-sign.test.tsx` ៤៨ · `ZoeW/tests/palm-sign-camera.test.ts` ១០ (មុនកែ ៖ helper/flow ថ្មីមិនមាន ➜ ធ្លាក់) · ⏳ iPhone ពិតមិនអាចវាស់លើម៉ាស៊ីននេះ | [2.50.127] flow មួយជុំ ៖ status ៤ ស្របគ្នា · ស្កេន ➜ រូប + សម្លេង + ញ័រ + `04` ភ្លាម (`dispatchPalmSignCode()`) · ឈ្មោះ ➜ «✍️ Sign (N)» receipt ៣ ស្របគ្នា · ✕ ដករូប · សារ ZTO បត់ (`<details>`) · Code128 + QR (`PALM_SIGN_FORMAT_NAMES`, តែលេខកញ្ចប់) · Android ៖ `BarcodeDetector` `code_128` + `qr_code` (`upgradeNativeDetectorForQr()`, ម្ចាស់គម្រោង ៖ «ផ្លូវ QR អស្ចារ្យ … ចង់អោយ android មានផ្លូវ QR ដែរ») · iOS ៖ frame លឿន 960px រៀងរាល់ 60ms + ស៊ីជម្រៅ ១/៤ · រូប ៖ ស៊ីជម្រៅ 1600 ➜ 2600px ពិដាន 10s (`palmSignDecodeImage()`) · `readCanvasSymbols()` ចែករំលែកជាមួយ `decodeBarcodeFromCanvasManual()` |
| A226 | **កញ្ចប់ Sign ឬស្កេនត្រឡប់ក្នុង ZTO រួច នៅបើកវិញ/ស្តារបានក្នុង ZoeW** — ZTO គ្មានការស្តារ ៖ ការបើកវិញធ្វើឲ្យកញ្ចប់ Sign ចូលរបា «មិនទាន់បិទ» ហើយការស្តារ «ត្រឡប់» បើកកញ្ចប់ដែលទៅសាខាកណ្តាលហើយ (បូកលុយវិញ) · ធុងសំរាមរាយតាមលំដាប់ id (ពេលស្កេន) មិនមែនពេលចូល | `ZoeW/tests/zto-final-marks.test.tsx` ១៤ (មុនកែ ៖ helper/ប៊ូតុងមិនមាន ➜ ធ្លាក់ទាំងអស់) · `emu/app-writes-rules-test` ៖ rules ពិតទទួល ៣៥៦/៣៥៦ ការសរសេរ App (ភស្តុតាង ZTO ៦) · rules ចាស់ (គ្មានវាលទាំង ២) ➜ បដិសេធ · `ZoeW/tests/session-switch-fuzz.test.ts` សេណារីយ៉ូ `syncZtoFinalMarks` (ប្តូរហាងពាក់កណ្តាល ➜ ០ ការសរសេរបន្ទាប់) · vitest ទាំងមូល ២១៧៧/២១៧៧ | [2.50.127] `ztoSignedAt` · `ztoReturnedAt` លើ barcode (rules ប្រវត្តិ + ធុងសំរាម) · `syncZtoFinalMarks()` (verdict ZTO `true` លើ barcode បិទ · ភស្តុតាងពី `removeReturnedZtoBarcodes()` ➜ transaction មួយ/ធាតុ · `permission_denied` ➜ ឈប់ `ZTO_FINAL_REFUSED_RETRY_MS`) · `barcodeZtoSigned()` ក្នុង transaction បើកវិញ (`toggleCloseStatus` · `applyBarcodeCloseChange`) · `trashZtoFinalBlock()` ក្នុង `executeRestoreItem()` · `trashRestoreBlockOf()` (ធុងសំរាម 🔒) · Palm Sign ➜ `setZtoPickupVerdict(code, true)` · `buildTrashGroups()` តម្រៀប `deletedAt` · sandbox `emu/crud-rules-flow` · `pickup-barcode-identity-test` · `connection-recovery-test` ស្គាល់ helper ថ្មី |

### 2026-10-17 — Deep audit ៦ (សំណើម្ចាស់គម្រោង ៖ «deep audit … កុំជឿជាក់លើ checker … ច្រើនសាខា ក្នុងមួយសាខា ប្រើ2-3devices … សម្អាត ឯកសារឈប់ប្រើ ពិនិត្យ CLAUDE.md … HISTORY.md» · គ្មាន agent) ➜ [2.50.126]

វិធី ៖ run-all STRICT ពេញលើ `cb082e4` (emulator RTDB រស់ · Postgres ពិត) ៖ **២០៩ ជាប់ · ៣ ធ្លាក់ · មួយផ្នែក ០ · រំលង ០** (ធ្លាក់ = A221 · `repository-file-coverage`
ព្រោះឯកសារថ្មីរបស់ជុំនេះលេចកណ្តាលការរត់) · អានកូដថ្មីបំផុត (Sign · session សាខា Palm · កញ្ចប់ត្រឡប់ ➜ ធុងសំរាម · Push) · ពិនិត្យថ្នេរ «គម្រោងមួយ សាខាច្រើន · ឧបករណ៍ ២–៣
ក្នុងសាខា» លើ backend ទាំង ២ ដោយ App ពិត · តេស្តថ្មីនីមួយៗធ្លាក់លើកូដមុនកែ ហើយជាប់ក្រោយកែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A225 | **ស្ថិតិយក (`packagesPickedUp`) លើស/ខ្វះ barcode បិទ ក្រោយទំព័រស្លាប់ចន្លោះការសរសេរ ២ ដង** — `supabase-money-multishop` ក្នុង CI (`69ea205` · ផ្នែក ៣/៤) ហាង ០ ជុំ ៥ (`s0d0:restore[offline-reload]` · `s0d1:closeOrder[offline-reload]` · `s0d2:closeBarcode`) ៖ `pkg` ៣ ⟷ barcode បិទ ១ · លុយ (ថ្ងៃ · ខែ · ចំនួន) · registry · barcode ត្រឹមត្រូវ ➜ មូលហេតុ ៖ បិទ/បើកសរសេរ `zoew_daily_pickup_cod_dod/<ថ្ងៃ>` (`markPickupBarcodes`, **មុន**) និង `zoew_scan_history_cod_dod/<id>` ជា transaction ២ ដាច់ពីគ្នា · ការត្រឡប់វិញ (`revertPickupMarks` · `reapplyPickupMarks`) រស់តែក្នុងទំព័រ ➜ reload · បិទ App · transaction មួយព្យួរ ➜ ស្ថិតិខុសជារៀងរហូត · `planPickupLedgerRepair` ជួសតែពេលចំនួនស្មើ (រក្សា Reset) · adapter Supabase ៖ ការ sync ចប់ (`ready` ➜ `wakeWaiters()`) ដាស់ transaction ដែលរង់ចាំ link ទោះ `goOffline` ➜ transaction ស្ថិតិអាចចេញមុន ហើយ history នៅរង់ចាំរហូត reload | ម៉ាស៊ីននេះ fuzz ១៣/១៣ ជាប់ (seed ០ ៣ ដង + seed ១–១០ ពេល CPU រវល់) ➜ តេស្តកំណត់ `ZoeW/tests/pickup-interrupted-close.test.ts` (fake SDK · transaction មួយព្យួរ = ទំព័រស្លាប់ ➜ ទំព័រថ្មី) ៖ **មុនកែ ៣ ទិសធ្លាក់** (បិទកញ្ចប់ ស្ថិតិ ២ ⟷ បិទ ០ · បិទ barcode ស្ថិតិ ០ ⟷ បិទ ១ · បើកវិញ ស្ថិតិ ០ ⟷ បិទ ១) + probe journal ១ ➜ ក្រោយកែ ៧/៧ · vitest ទាំងមូល ២១៦២/២១៦២ | [2.50.127] journal `zoew_pickup_journal_v1` តាម helper តែមួយ `pickupIntentTracker()` នៃផ្លូវបិទទាំង ២ (`code-duplication-test`) (`beginPickupIntent` មុនការសរសេរស្ថិតិដំបូង · កូនសោ server បន្ថែមមុន reconcile · `endPickupIntent` ពេលការសរសេរចុងក្រោយចប់ · ប្តូរ session ➜ `releasePickupIntent` តែ) · `resumePickupIntents()` (`runScheduledCleanup` · `debouncedRenderAfterHistorySync`) បញ្ចប់ entry ដែលគ្មានប្រតិបត្តិការរស់ (`pickupIntentsLive` + Web Lock `zoew-cleanup-live-<id>`) ៖ កូនសោនីមួយៗ = ស្ថានភាព barcode ពិត (`pickupTruthMarks`) ⛔ មិនរាប់ថ្ងៃឡើងវិញ (Reset នៅ ០ · តេស្តទិសផ្ទុយ) · អ្នកយាមពហុឧបករណ៍ ២ រង់ចាំ `pickupJournal` ០ · sandbox របស់ `late-commit-test` · `emu/crud-rules-flow` · `pickup-barcode-identity-test` · `daily-collected-test` · `connection-recovery-test` ស្គាល់ journal ជា stub ឥតប្រសិទ្ធិភាព (ការវាស់ journal នៅក្នុងតេស្តខាងលើ) · `clock-hygiene` ៖ អាយុ entry ជាត្រា local វាស់តាម `elapsedSince()` · ការភ្ញាក់ `wakeWaiters()` ពេល offline មិនកែ (គ្មានផលពិត ៖ គ្មានបណ្តាញ rpc ធ្លាក់ · journal គ្របផលរបស់វា) |
| A224 | **ZoeKeyGen ផ្ទាំង «🏪 ហាង Supabase» ទាញ `tenants` · `tenant_members` · `member_devices` ដោយ GET តែមួយ** ➜ PostgREST កាត់ត្រឹម «Max rows» (Supabase លំនាំដើម ១០០០) ដោយស្ងាត់ ➜ ហាងច្រើន (~៣៣៣ ហាង × ៣ គណនី) ➜ គណនីថ្មីៗ (`order=created_at.asc`) និងហាងចាស់ៗបាត់ពីផ្ទាំង ខណៈ «អានបាន» | `supabase-fake-server.js` អនុវត្ត `maxRows` (១០០០) + `limit`/`offset` + `order` ច្រើនជួរឈរដូច PostgREST · `keygen-supabase-admin-test` ថ្មី ៖ មុនកែ **ហាង ១០០០/១០១០ · គណនី ១០០០/១០០៨** ➜ ក្រោយកែ គ្រប់ · ១០៨/១០៨ | `sbAdminList()` ៖ `limit` `SB_ADMIN_PAGE_ROWS` (៥០០) + `offset` រហូតទំព័រទទេ (មិនពឹង page size ព្រោះ Max rows អាចតូចជាង) · order មានកូនសោពិសេស · ≤ `SB_ADMIN_LIST_MAX_PAGES` ផុត ➜ អានមិនបាន · ពិនិត្យ `sbAdminIsCurrent()` ក្រោយទំព័រនីមួយៗ · ផ្ទាំងដដែល ៖ អានគណនីមិនបាន ➜ បង្ហាញ «-» ដូចគ្មានគណនី ហើយ 🎟️ ចេញកូដ **ម្ចាស់ហាង** ទី ២ (តួនាទីយកពីបញ្ជីនោះ) ➜ `sbMemberReadFailed` ៖ «⚠️ អានបញ្ជីគណនីមិនបាន» · 🎟️ សុំ Refresh មុន (តេស្តថ្មី ៖ មុនកែ FAIL «-» ➜ ក្រោយកែ ១០៩/១០៩) · បញ្ជីទាំង ៣ សម្រេច «អានបាន» តាម `sbAdminRows()` តែមួយ (`code-duplication-test` ៖ ប្លុក ៣ ដដែល ➜ FAIL) |
| A223 | **CI ៖ `audit.yml` · `android-shell-check.yml` «រំលង» (មិនមែន «ធ្លាក់») ពេល repo Public + `ZOE_RUNNER_MODE` ≠ `github`** ➜ GitHub បង្ហាញ check skipped ដូចបៃតង (ការការពារ runner self-hosted លើ repo Public ដោយចេតនា · `docs/SELF-HOSTED-RUNNERS.md` «Audit PR skipped») | អាន `if:` ទាំង ៣ workflow (`security-guard-test` ទាមទារលក្ខខណ្ឌ private សម្រាប់ self-hosted) | មិនកែ (ការកំណត់ repo របស់ម្ចាស់គម្រោង) ➜ ពេល repo នៅ Public ត្រូវ `ZOE_RUNNER_MODE=github` ទើប CI រត់ពិត · ⛔ «skipped» ≠ «passed» |
| A222 | **សមត្ថភាពពេលហាងច្រើន (គ្មានកូដ · បន្ថែមលើ A55–A58)** ៖ ឧបករណ៍ ZTO នីមួយៗអានបញ្ជីចុះហត្ថលេខាដោយខ្លួនឯង (`ZTO_SIGNED_SWEEP_ACTIVE_MS` ២០ វិ. ➜ ~១៨០/ម៉ោងពេលសកម្ម) និងពិនិត្យ `/detail` កញ្ចប់បើកនីមួយៗរៀងរាល់ម៉ោង (`ZTO_OPEN_RECHECK_MS` · ១០ កញ្ចប់/២០ វិ.) ➜ ឧបករណ៍ ៣ ក្នុងសាខាធ្វើការដដែល ៣ ដង (សញ្ញាហាងចែករំលែកតែ «ពេញលេញ») | កញ្ចប់បើក ៣០០ ➜ ~៣០០ + ~១៨០ ការហៅ Function/ម៉ោង/ឧបករណ៍ ➜ ឧបករណ៍ ៣ × ១០ ម៉ោង ≈ ១៤,០០០–១៨,០០០/ថ្ងៃ/សាខា · Netlify ប្តូរទៅតម្លៃ credit (compute GB-ម៉ោង + សំណើ) តាំងពី 2025 | ម្ចាស់គម្រោងសម្រេច (តំបន់ LOCK ZTO) ៖ ឧបករណ៍មួយក្នុងសាខាជាអ្នកអាន (leader) ឬពង្រីក cadence · ពិនិត្យ Usage Netlify មុនបន្ថែមសាខា |
| A221 | **checker ញ័រពេល CPU រវល់** ៖ `panel-motion` (ជាន់អប្បបរមា «តំបន់ប្រៀបមានមាតិកាពិត» ៧៦៨px · តែពេល run-all ២ ត្រួតគ្នា) · `ledger-clamp-symmetry` ផ្នែក ៥ ឬ ៦ «Resulting promise was garbage collected» (V8 inspector ៖ promise របស់ `removeSingleBarcode` មិនមានអ្នកយោង) — ធ្លាក់ក្នុង run-all **តែមួយ** ៤ lane ក្នុងម៉ាស៊ីននេះ ២/២ ដង | រត់ម្នាក់ឯង ៖ `panel-motion` ១១១/១១១ · `ledger-clamp-symmetry` ៦/៦ + ១០ ដង GC បង្ខំ ➜ គ្មានការព្យួរ · `removeSingleBarcode` ចប់ក្នុង ~១.៦ វិ. ជានិច្ច · **បង្កើតឡើងវិញបាន** ៖ ៨ ច្បាប់ស្របគ្នាលើ CPU ៤ ➜ ធ្លាក់ ២/៨ (ផ្នែក ៥ · ៦) · ច្បាប់ដែលកាន់ promise នៅ `window` + ពិដាន ២០ វិ. រក «HANG» ➜ ១២/១២ ជាប់ · គ្មាន HANG · គ្មាន pageerror · CI (`audit.yml` ៤ ផ្នែក · lane ២ · browser ≤ ១) ជាប់ | មិនកែកូដ App (promise ចប់ពេលមានអ្នកយោង ➜ គ្មានការព្យួររបស់ App ដែលវាស់បាន) · មិនកែ checker (ការកាន់ promise អាចលាក់ការព្យួរពិត) ➜ ⛔ កុំរត់ run-all ពីរព្រមគ្នា · ក្នុងម៉ាស៊ីន CPU ៤ រត់ `RUNALL_BROWSER_JOBS=1` ដូច CI ឬ `RUNALL_RESUME=1` ចំពោះ checker នេះ · ធ្លាក់ក្នុង CI ➜ ស៊ើប (អ្វីដែល `removeSingleBarcode` រង់ចាំពេលធ្លាក់) |
| A220 | **ឯកសារ ៖ `ZoeW/docs/ZTO-PALM.md` សរសេរថា «ZoeW មិនផ្ញើ sign scan ទៅ ZTO ទេ (endpoint សរសេររបស់ Palm មិនដែលហៅ)»** ខណៈផ្នែក «Sign ទៅ ZTO» ក្នុងឯកសារដដែល និង `CLAUDE.md` ពិពណ៌នាផ្លូវ Sign ពិត · `ZTO-PALM-API.md` ដាក់ endpoint Sign ក្រោម `_shared/zto-palm.js` (ពិតនៅ `_shared/zto-palm-sign.js`) · «📌» Handoff ៖ `main` 2.50.117 (ពិត ៖ `cb082e4` 2.50.125) | `CLAUDE.md` ៖ ឈ្មោះ function/constant ១,២៣១ និងផ្លូវឯកសារទាំងអស់មានក្នុងកូដពិត (លើកលែងឈ្មោះខាងក្រៅ ៦ ៖ `TIMED_OUT` · `__vitePreload` · Cookie ZTO · env ដែលដកចេញដោយចេតនា) · បន្ទាត់វែងស្ទួនរវាង `HISTORY.md` ↔ `HISTORY-ARCHIVE.md` = ០ | កែអត្ថបទ ២ ឯកសារ · «📌» សរសេរឡើងវិញ (Handoff · លុបធាតុ ✅ · ការសម្រេច ៦៤ ក្នុង `CLAUDE.md` រួច) |
| A219 | **លុយពហុឧបករណ៍ ៖ គ្មានអ្នកយាមហាងច្រើនលើ Supabase · Firebase វាស់តែឧបករណ៍ ២ · ទ្វារ «ZTO ត្រឡប់ ➜ ធុងសំរាម» (ដកលុយ · ថ្មី) មិនដែលប្រជែងពីឧបករណ៍ច្រើន** | `supabase-money-multishop-test` ថ្មី (គម្រោងមួយ · ហាង ២ × ឧបករណ៍ ៣ · App ពិត · adapter · Postgres ពិត) ៖ ៦ ជុំ ➜ ជាប់ · seed ១–៤ × ១០ ជុំ ➜ ជាប់ · mutation ledger −1.5 ➜ FAIL «ledger ថ្ងៃ ≠ …» · ធាតុហាង ០ ក្នុងហាង ១ ➜ FAIL «ទិន្នន័យហាងផ្សេងលេចចូល» · `emu/money-multidevice-emu-test` ឧបករណ៍ ៣ + «ZTO ត្រឡប់» ប្រជែង ៖ PASS ៨/៨ (offline+reload ៣០ · offline+online ១៦ · ប្រជែង ZTO ត្រឡប់ ៦) · seed ២០–២៤ × ១៤ ជុំ ➜ PASS (reload ៣៧ · offline+online ៥៣ · ការសម្អាតប្រជែង ១៤ · ZTO ត្រឡប់ប្រជែង ១៦) | គ្មានការបូក/ដកស្ទួន ឬទិន្នន័យហាងលេចក្នុងការវាស់ · អ្នកយាមចូល run-all (`money-multidevice-core.js` រួម) |
| A218 | **Sign ៖ ចុច «✍️ Sign» ពេលការផ្ញើមុននៅរង់ចាំ ZTO (បិទផ្ទាំងហើយ) ➜ គ្មានអ្វីកើតឡើង** រហូតដល់ ៤៥ វិ. (`openZtoPalmSign()` ត្រឡប់ស្ងាត់លើ `busy`) | `zto-palm-sign.test.tsx` ថ្មី ៖ មុនកែ toast `''` ➜ ក្រោយកែ «⏳ ការ Sign មុនកំពុងរង់ចាំចម្លើយ ZTO …» · ចម្លើយមកក្រោយបិទផ្ទាំងមិនបិទកញ្ចប់ · ក្រោយនោះបើកបាន | toast ប្រាប់ឲ្យរង់ចាំ |
| A217 | **ដំណឹងអ្នកលក់ (📢) ផ្ញើទៅ subscription ទាំងអស់ក្នុង run តែមួយ** ➜ ledger `state/notices` ចាក់សោមុន ➜ run អស់ពិដាន ២០ វិ. ➜ ទូរស័ព្ទដែលនៅសល់មិនដែលទទួល | `push-server.test.ts` ថ្មី (Blobs ៤០ ms · Push ២០០ ms · ទូរស័ព្ទ ៣,០០០ · cron រហូត run លែង `partial`, ពិដាន ២៨៨) ៖ មុនកែ **២,២៥២–២,៣៣២ មិនទទួល** ➜ ក្រោយកែ ០ មិនទទួល · ០ ស្ទួន · run ≤ ៣០ វិ. · run `partial` នីមួយៗផ្ញើបន្ថែម (ម៉ាស៊ីននេះ ៦ run · CI យឺតជាងនេះ ➜ ចំនួន cron ថេរ ៨ ធ្លាក់ក្លែងក្លាយក្នុង CI ➜ ចំនួនមិនថេរ · CPU រវល់ ៦ ច្បាប់ស្របគ្នា ៦/៦ ជាប់) | ផ្ញើជាចំណែក `PUSH_NOTICE_CHUNK` (៣២) តាមលំដាប់កូនសោ · ចំណែកនីមួយៗ claim ក្នុង `carry` (id + កូនសោចុងក្រោយ) មុនផ្ញើ ➜ cron បន្ទាប់បន្ត · `"reason":"partial"` |
| A216 | **ការរំលឹកម៉ោង ៨ ព្រឹកដើរ schedule ម្តងមួយតាមលំដាប់ដដែលរាល់ cron** (អាន schedule + ledger ២ ដងសម្រាប់ហាងដែលផ្ញើរួច) ➜ ពិដាន ២០ វិ. អស់មុនដល់ចុងបញ្ជី ➜ ហាងចុងជួរមិនដែលទទួល · ការ claim ក្បែរពិដាន ➜ ledger ចាក់សោ តែការផ្ញើត្រូវកាត់ | `push-server.test.ts` ថ្មី (ហាង ៤០០ · cron ១២ ដងក្នុងម៉ោង ៨) ៖ មុនកែ **២១២ ហាងមិនទទួល · ៥ claim តែមិនផ្ញើ** ➜ ក្រោយកែ ០ · ០ · run ≤ ៣០ វិ. | ហាង `PUSH_EXPIRY_CONCURRENCY` (៨) ស្របគ្នា · អាន ledger មុន schedule · claim តែពេលនៅសល់ `PUSH_CLAIM_RESERVE_MS` (៤ វិ.) |
| A215 | **ZTO-E14 លើផ្លូវ Palm** ៖ គម្រោង Firebase ចងសាខាច្រើន · ការអាន `?palm=1&list=1&signed=1&exact=1` ប្រើ session សាខាឧបករណ៍ ➜ ZTO ឆ្លើយតែសាខានោះ ➜ «ពេញលេញ» ➜ ការសម្អាតថ្ងៃទី ៨ ដកលុយកញ្ចប់ដែលអតិថិជនយកនៅសាខាផ្សេង (Cookie កែរួចក្នុង A161 តែផ្លូវ Palm មកក្រោយ) | `zto-palm-multibranch-hold.test.tsx` ថ្មី (App ពិត + Function ពិត + Palm ក្លែងដែលឆ្លើយតែសាខាគណនី + ID token ពិត) ៖ មុនកែ ២ ធ្លាក់ (`abandon` កញ្ចប់ចុះហត្ថលេខានៅ 770022 · `ztoSignedCompleteAt` > 0) · ទិសផ្ទុយ ២ ជាប់ ➜ ក្រោយកែ ៤/៤ · `vitest tests/zto-* tests/push-*` ជាប់ | Function អានសាខាដែលចងផ្សេងទៀតតាម session សាខារៀងខ្លួន (`siblingBranches` ពី `FIREBASE_PROJECT_IDS` · `branchSession` ពី Blobs · តែលេខ barcode) · សាខាគ្មាន session/អានមិនបាន ➜ 503 `palm:branch-unread` · ព្រំដែន ៖ សាខាដែលមិនដែល Login Palm ការពារបានតែ `ZTO_ABANDON_HOLD_MAX_MS` (ដូច A161) · ម្ចាស់គម្រោង ៖ គម្រោង Firebase មួយ = សាខាមួយ ➜ ការរៀបចំពិតមិនចូលផ្លូវនេះ (ការកែ = ឥរិយាបថដដែលពេលចងសាខាតែមួយ) |

អានហើយមិនឃើញចន្លោះថ្មី ៖ `_shared/zto-palm-sign.js` (ភស្តុតាងចែកចាយចង token · `barScannerId` ថេរ · `runs`) · `removeReturnedZtoBarcodes()` ➜ `claimAndCleanupItem('abandon', { codes, returnedAt })`
(ពិនិត្យលើ barcode server ក្នុង transaction · `restoredAt` ពី `executeRestoreItem()`) · ពិដាន subscription Push (`PUSH_SUBS_PER_KEY_MAX` · `PUSH_SUBS_TOTAL_MAX`) · `setInterval` ៧ (ត្រូវនឹង `CLAUDE.md`)។

### 2026-10-17 — CI PR #330 ៖ លិបិក្រមប្រវត្តិមិនទាន់តាមកំណត់ត្រាថ្មី

- Audit #880 លើ `a32ec7f6` ៖ ផ្នែក ១ · ២ · ៤ ជាប់ · ផ្នែក ៣ ធ្លាក់តែ `doc-scope-test` ព្រោះលិបិក្រមខុស ៣ ជួរ ៖ `version-check` · `ZoeW/tests/zto-palm-login.test.tsx` · `ZoeW/tests/zto-palm-shared-app.test.tsx`។
- ដេរីវេលិបិក្រមឡើងវិញតាមការលេចពិតក្នុងប្រវត្តិទាំង ២ និងឯកសារតេស្តបច្ចុប្បន្ន។ កែតែឯកសារ · គ្មានការឡើងកំណែ App · គ្មានសកម្មភាពដោយដៃថ្មី។

### 2026-10-17 — Audit PR #330 ៖ Sign ZTO Palm ធៀប App · ផ្ទាំង Sign · ពេលប្រើច្រើន

វិធី ៖ អានកូដ PR ទាំង ១៣ commit (`zto-palm-sign.js` · `zto-palm-sign.ts` · `ZtoPalmSignModal.tsx` · `palm-sign-camera.ts`) ធៀប `CLAUDE.md` ·
browser 390×844 និង 320 (harness React ពិត · ពុម្ព Kantumruy Pro · កាមេរ៉ាក្លែង) · តេស្តថ្មីនីមួយៗធ្លាក់លើកូដ PR មុនកែ ហើយជាប់ក្រោយកែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A214 | **ម្ចាស់គម្រោងសង្ស័យ App Lock ធ្វើឲ្យ Login Palm «សោមិនត្រឹមត្រូវ»** (Preview ៖ បាត់ក្រោយ clear site data · App Palm បើកនៅពេល ZoeW Login ➜ មិនចាកចេញ ➜ គ្មានការប៉ះទង្គិច session) | vitest ថ្មី (`zto-palm-login.test.tsx` «App Lock ↔ Login Palm») ៖ ចាក់សោ ➜ បើកដោយ PIN ៣ ដង ➜ Login ផ្ញើសោដែលរក្សាទុកដដែល · សោវាយផ្ញើដូចវាយ · ចាក់សោពេល Login កំពុងរត់ ➜ ចម្លើយបោះចោល មិនមែនសារសោខុស · ភ្លេច PIN ➜ PIN ថ្មី ➜ មិនផ្ញើសោ សុំវាយ · mutation `completeAppUnlock()` យកសោពី PIN ខុស ➜ FAIL · ម្ចាស់គម្រោង «តេស្តបិទ app អោយជាប់ applock 20-40 នាទី» ➜ `zto-palm-shared-app.test.tsx` (Function ពិត · Blobs · `ZTO_DETAIL_IDENTITY=require`) Firebase/Supabase × ២០ នាទី · ៤០ នាទី · ៥ ម៉ោង ➜ PIN ➜ Login ស្វ័យប្រវត្តិ · ទាញបញ្ជី · «ប្រើ Login Palm របស់ហាង» · Login ដោយដៃ ៖ គ្មាន 401 (PASS ៦/៦ · សោ Server ប្តូរ ➜ FAIL ៦/៦) | App Lock មិនមែនមូលហេតុ (PASS ៣/៣) · decrypt សោខុស ➜ `''` មិនផ្ញើសោខុស · មូលហេតុដែលនៅសល់ ៖ ZTO បដិសេធលេខឧបករណ៍ចាស់ (`zoew_palm_device_id` ថ្មីក្រោយ clear) ឬតួមើលមិនឃើញ ➜ [2.50.125] សារបែងចែក |
| A213 | **សារ Login Palm «សោភ្ជាប់ ZoeW មិនត្រឹមត្រូវ» មិនប្រាប់អ្វីដែលទូរស័ព្ទផ្ញើ** ហើយគ្រប 401 គ្រប់ code ដែលមិនស្គាល់ (ឧ. `ZTO_AUTH_EXPIRED`) · `ZTO_PALM_LOGIN_REJECTED` មិនប្រាប់ថាសោភ្ជាប់ត្រូវ ➜ ម្ចាស់គម្រោងបែងចែកមិនបានថាសោ ឬគណនី | vitest ៖ សារគ្មានប្រភព · ចំនួនតួ · ស្នាមម្រាម · code ផ្សេងបង្ហាញជាសោខុស (FAIL ២) | `proxyKeyEvidence()` · `palmLoginFailureText()` async ➜ PASS · មូលហេតុដើមលើ Preview នៅរង់ចាំសារថ្មីពីម្ចាស់គម្រោង |
| A212 | **ជំហានចែកចាយផ្ញើរូប JPEG (base64 ~២០០–៥០០ KB) ដែល Server ផ្ទៀងតែមិនប្រើ** (APK មិនភ្ជាប់រូបចែកចាយ) · កាមេរ៉ាបង្កើត JPEG ថ្មីរាល់ ១៥០ms ពេល Barcode ដដែលនៅមុខកាមេរ៉ា | vitest ៖ body ចែកចាយមាន `photo` · Server 400 ពេលគ្មានរូប · `toDataURL` ហៅរាល់ frame (FAIL ៤) | client មិនផ្ញើរូបចែកចាយ · Server ទទួលចែកចាយគ្មានរូប (រូបខុសទម្រង់នៅ 400) · `palmSignWantsFrame()` ➜ PASS |
| A211 | **Server `runs` ទុកចម្លើយជោគជ័យ ១០ នាទី ហើយឆ្លើយ 429 ពេលដល់ ២៥៦ ក្នុង container មួយ** — គ្រប់ហាងរួមគ្នា (Lambda ប្រើ container ក្តៅដដែល) ➜ ~១២ កញ្ចប់/នាទី សរុបគ្រប់ហាង | vitest ៖ Sign ៣០០ ដង ➜ ទី ២៥៧ 429 (FAIL ហើយតេស្ត Server បន្ទាប់ធ្លាក់ ២៣) | លុបចម្លើយចាស់ដែលចប់មុន (លំដាប់ចូល) · 429 តែពេលពេញដោយសំណើកំពុងរត់ · retry ដដែលនៅប្រើចម្លើយដដែល ➜ PASS |
| A210 | **ប៉ះផ្ទៃងងឹតបិទផ្ទាំង Sign** ➜ `cancelZtoPalmSign()` លុបរូប ឈ្មោះ ជំហាន (គោលការណ៍ម្ចាស់គម្រោង «ប៉ះខុសមិនបោះបង់ការស្កេន») | `modal-backdrop-keep` ៖ FAIL | `BACKDROP_KEEP_MODALS` ➜ PASS · Back/Escape/«បិទ» នៅបិទ |
| A209 | **ភស្តុតាងចែកចាយចងនឹង token ➜ token ប្តូរ (refresh · Login ឡើងវិញ · renew សាខា) ➜ ទទួលធ្លាក់ `ZTO_PALM_DISPATCH_REQUIRED` រហូត** ត្រូវបិទផ្ទាំងបើកថ្មី (បាត់រូប/ឈ្មោះ) · status ឃើញទទួលរួច ➜ លទ្ធផលស្ទួនជាមួយបរាជ័យចាស់ | vitest ៖ ផ្ញើម្តងទៀតប្រើភស្តុតាងចាស់ · លទ្ធផល ២ ជួរ (FAIL ២) | អាន status ភ្លាមយកភស្តុតាងថ្មី រក្សារូប/ឈ្មោះ · លទ្ធផលតែមួយ ➜ PASS |
| A208 | **Login Palm បន្តស្វ័យប្រវត្តិពេលកំពុងផ្ញើ** ៖ `refreshZtoPalmSession()` សរសេរ `palmTokenEnc`/`palmLoginAt` ក្នុង config ➜ `JSON.stringify(cfg)` ខុស ➜ ចម្លើយ ZTO បោះចោល (ZTO Sign រួច · ZoeW មិនបិទ · សារជាប់ «កំពុងផ្ញើ») | vitest ៖ refresh ពេល fetch កំពុងរង់ចាំ ➜ គ្មានការបិទ (FAIL) | `palmSignConfigKey()` មិនរាប់ field session Palm · សាខា Palm ផ្សេងនៅបោះចោល ➜ PASS |
| A207 | **ជួរកញ្ចប់ត្រួតលើគ្នា** ពេលមានស្លាកបញ្ហា + សារព្រមាន + លទ្ធផល (flex column + `max-height: 180px` ➜ ជួរបង្រួម អត្ថបទហៀរគ្របជួរបន្ទាប់ ឃើញលើរូបថត 390px) | `layout-check` ថ្មី ៖ FAIL ៨ (ត្រួត + 📷/🖼 មិនស្មើ) គ្រប់ទទឹង 320 · 390 · 768 · 1280 | grid · គ្មាន scroll ក្នុង scroll · ផ្ទាំងរចនាឡើងវិញ ➜ PASS |

មិនកែ ៖ (១) របៀប Palm គ្មានប៊ូតុងបិទដោយដៃ ➜ ម្ចាស់គម្រោង ៖ «ហាងមានតែកញ្ចប់ ZTO មិនអីទេ» ➜ ទុកដដែល ·
(២) ការទទួលហៅ ZTO ៦ ដងជាប់គ្នា (រួមរូប) ក្រោមថវិកា Function ៩ វិ. (`ZTO_REQUEST_BUDGET_MS` · ឯកសារ LOCK) ➜ ZTO យឺត ➜ «⏳ មិនទាន់បញ្ជាក់» ច្រើន — វាស់ `?diag=1` `upstreamTiming` មុនសម្រេច ·
(៣) កញ្ចប់មួយ = Function ≥ ៣ ដង (status · ចែកចាយ · ទទួល) ➜ គណនាកូតា Netlify ពេលហាងច្រើន · (៤) `runs` ការពារ retry តែក្នុង container ដដែល (barScannerId ថេរតាម request)។

### 2026-10-17 — Sign កញ្ចប់មានបញ្ហា៖ ZoeW បដិសេធសារដែល Palm អនុញ្ញាតបញ្ជាក់

មូលហេតុ៖ Server ចាត់ `newBusinessCheck.result.message` ទាំងអស់ជាការហាម ដោយមិនអាន `whetherForce`; UI គ្មានផ្លូវបញ្ជាក់។ តេស្តពិតមុនកែ៖ server ទទួល `ZTO_PALM_SIGN_CHECK_REJECTED` ជំនួសការសួរ; React គ្មានផ្ទាំងបញ្ជាក់។ ម្ចាស់គម្រោងផ្តល់ tracking `-579` បន្ថែម៖ status ពីមុនមិនមានស្លាកបញ្ហា ហើយតេស្ត server/React ថ្មីទាំងពីរធ្លាក់មុនកែ។

ផ្ទៀង APK រួច បន្ថែមផ្លូវបញ្ជាក់ចងសារព្រមាន/កញ្ចប់ និងពិនិត្យឡើងវិញ មុន upload។ ស្លាក tracking សម្រាប់អ្នកប្រើឃើញប៉ុណ្ណោះ; សិទ្ធិបន្តមកពីចម្លើយ business check ពិត។ តេស្តគ្របបញ្ជាក់/បោះបង់ សារប្តូរ ថយវដ្ត ពេលចាស់ សាខាផ្សេង token ក្លែង និងចម្លើយ upload បាត់។ ទិន្នន័យកញ្ចប់ពិតមិនដាក់ក្នុង fixture ឬ git។

### 2026-10-17 — Deep audit PR #331 ជុំ ២ ៖ Login ZTO Palm ដូច Cookie Blob (session តាមសាខា) · សំណល់ `expired`

សំណើ ៖ «Audit project ទាំងមូលឡើងវិញក្នុង PR331 … អោយ ZTO Palm login ដំណើរការដូច Cookie blob 100% … កុំជឿជាក់លើ checker … បើថ្ងៃក្រោយ app មានអតិថិជនប្រើច្រើន» ·
«Login Palm ម្តង ប្រើគ្រប់ទូរស័ព្ទ ដូចម្តេចទៅ? សាខាតែមួយតែឧបករណ៍ច្រើនឬយ៉ាងណា?» · «ស្វែងរកពាក្យ expired ផុតកំណត់ លុបចេញអោយអស់»។ វិធី ៖ អានទ្វារ Palm ទាំងអស់
(Login · refresh · ស្កេន · ទាញបញ្ជី · status · 🩺) ធៀបនឹង Cookie Blob (`resolveCookieCredential()` ៖ memory ➜ Blob ➜ env · ETag CAS · 401 ➜ អានឡើងវិញ) · fuzz ក្រៅ seed លំនាំដើម
(`FUZZ_RUN0=300 FUZZ_RUNS=20 FUZZ_OPS=60` ៖ PASS ៣/៣ · `ledgerBlip` applied ៨ · lost ១០) · `git grep` ពាក្យ `expired`/«ផុតកំណត់» គ្រប់ឯកសារ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A206 | **ទូរស័ព្ទមួយ «ផ្តាច់ Palm» ➜ ទូរស័ព្ទមួយទៀតលោត «Session ZTO Palm ផុតកំណត់»** (របាយការណ៍ម្ចាស់គម្រោងលើ Preview · សោដដែល · សាខាតែមួយ · backend តែមួយ) ៖ `disconnectZtoPalm()` លើទូរស័ព្ទ session ហាងហៅ `POST ?palm=logout` ➜ Function លុប Blob `palm-session/<ស្លាកសោ>/<សាខា>` (Login តែមួយរបស់សាខា) ➜ ទូរស័ព្ទផ្សេងទាំងអស់គ្មាន session · Server ឆ្លើយ 401 `ZTO_AUTH_EXPIRED` + `reason: palm:no-session` តែ App ទាញបញ្ជី (`zto-list-sync.ts`) និងស្កេន (`auto-lookup.ts`) មិនអាន `reason` ➜ «ផុតកំណត់» (session មិនបានផុត ៖ វាត្រូវលុប) | តេស្តមុនកែ ៖ ធ្លាក់ ៦ លើកូដ `c1036cb` ៖ Function `?palm=logout` ➜ 200 + លុប Blob (២ ៖ សាខា ១ · សាខា ២) · App «ផ្តាច់ Palm» ហៅ `confirm` + លុប Blob (២ backend) · សារ «🔑 Session ZTO Palm ផុតកំណត់…» ពេល Server គ្មាន Login (២ backend) | «ផ្តាច់ Palm» = ផ្តាច់តែទូរស័ព្ទនេះ (`disconnectZtoPalmLocally()` · មិនសួរ · មិនហៅ Server) · ដក `palmLogout()` និង `logout` ពី `isPalmPost()` ➜ `POST ?palm=logout` ឆ្លើយ 405 មុនសោភ្ជាប់ · `changeSiteIndex()` ➜ `addSiteIndex()` (គ្មានអ្នកដក) · `palmSessionLostText(cfg, reason)` ក្នុង `zto-palm-login.ts` (តែទូរស័ព្ទ session ហាង · មូលហេតុមិនស្គាល់ ➜ «ផុតកំណត់») · `palmEditSession()` គ្មានប៉ារ៉ាម៉ែត្រ · `LOCK` sha256 ថ្មី ៤ (`zto-palm-login.ts` · `_shared/zto-palm.js` · `zto-list-sync.ts` · `auto-lookup.ts`) · ក្រោយកែ ៖ ៣១/៣១ ជាប់ · ម្ចាស់គម្រោងសាកលើ Preview ៖ «ដំណើរការល្អ» |
| A205 | **run-all STRICT លើ commit ទី ១ នៃជុំនេះ ៖ ជោគជ័យ ២០៨ · ធ្លាក់ ៤** (គ្មាន SKIP · emulator រស់) ៖ (១) `zto-cookie-session-test` ៖ Function ហៅ `require('./_shared/zto-palm')` លើ **គ្រប់** សំណើ (`isPalmQuery()` · `isPalmPost()`) ➜ សំណើ Cookie ផ្ទុក module Palm ដែរ · checker រត់ Function ក្នុង `vm` ជាមួយ `require` របស់ខ្លួន ➜ `MODULE_NOT_FOUND` (មុនជុំនេះ មានតែសំណើ `palm=` ផ្ទុកវា) · (២) `code-duplication-test` ៖ ប្លុកពិនិត្យវគ្គ ៩ បន្ទាត់ដដែលក្នុង `submitZtoPalmLogin()` និង `connectSharedZtoPalm()` · (៣) `clock-hygiene` ៖ ត្រា `palmLoginAt` (`Date.now()`) ផ្លាស់ទៅ `palmConfigFor()` ➜ ធាតុអនុញ្ញាត `submitZtoPalmLogin` ងាប់ · (៤) `modal-keyboard-device` ៣/៤ ៖ `lookupApiConfigModal` លើ tablet APK ផ្តេក ៖ ការរអិល ២៧px វាស់បាន ៨ ស៊ុម (១៦៧ ms នៃ ២៥០) ខណៈ lane browser ៤ រត់ស្របគ្នា | រត់តែឯង ៖ (១)–(៣) ធ្លាក់ដដែល (កំណត់បាន) · (៤) ជាប់ ១៨/១៨ ពីរដង ➜ ការវាស់ស៊ុមក្រោមបន្ទុក មិនមែនប្រអប់ខុស (⛔ មិនហៅ «flake» ៖ រត់ពេញម្តងទៀតក្រោយកែ) | Function ផ្ទុក module Palm តែពេលមាន `palm=` (`palmQuery.palm && …`) · helper តែមួយ `palmEditSession()` · ធាតុអនុញ្ញាតប្តូរទៅ `palmConfigFor` (ហេតុផលដដែល) · អត្ថបទបញ្ជាក់ «ផ្តាច់ Palm» និយាយពី **សាខា** (មិនមែនហាង) · `LOCK` sha256 ថ្មី |
| A204 | **សំណល់មុខងារ «ផុតកំណត់» ក្រោយ 2.50.117** ៖ ធុងសំរាមប្រើតម្លៃតែមួយ `returned` («ត្រឡប់») តែឈ្មោះចាស់នៅ ៖ ថេរ `EXPIRED_TRASH_RETENTION_MS` (`session.ts` · `cleanup.ts` · `cleanup-rules-check.mjs` · checker ៨) · CSS `.trash-tag-expired` ក្នុង `app.css` (តំបន់ហាម · គ្មានធាតុណាមាន class នោះ ➜ ងាប់) · checker `expired-trash-retention-test` · id/ចំណងជើងតេស្ត (`expired_old` · `itm_expired` · «ជិតផុតកំណត់» · «កាលវិភាគផុតកំណត់») · README root «`expired` ➜ ២ ថ្ងៃ» ➜ session ក្រោយ `grep expired` អាចសន្មតថាមុខងារនៅរស់ ហើយសាងឡើងវិញ | `git grep -i expired` + «ផុតកំណត់» ៖ ញែកតាមអត្ថន័យ ៖ មុខងារធុងសំរាម ⟷ License · ហាង Supabase · វគ្គ Login · Session Palm/Cookie · កូដអញ្ជើញ · lease ស្តារ · ពាក្យ «កាលបរិច្ឆេទផុតកំណត់» (បញ្ជីរឹង) · `money:core` បង្កើតឡើងវិញ ➜ មិនប្រែ (ថេរមិននៅក្នុង money core) | ប្តូរឈ្មោះ ៖ `RETURNED_TRASH_RETENTION_MS` · `returned-trash-retention-test` (`RETURNEDTRASH_APP_DIR`) · លុបជួរ CSS ងាប់ (សំណើម្ចាស់គម្រោង · `forbidden-zone-lock` sha256 ថ្មី · ⛔ PTR/ចលនា/រមូរមិនប៉ះ) · ចំណងជើង «ជិតដល់ពេលត្រឡប់» ដូច UI (`NotifyDrawer` «កញ្ចប់ជិតដល់ពេលត្រឡប់») · រក្សា ៖ អ្នកយាមអវត្តមាន (`trash-modal-test` · `zto-returned-cleanup` · `expiry-return-policy` · probe rules ចាស់ក្នុង `emu/app-writes-rules-test`) និងសម្រង់ម្ចាស់គម្រោង · ⛔ ប្រវត្តិចាស់ (archive ៖ `EXPIRED_TRASH_RETENTION_MS` សម័យ vanilla) មិនសរសេរឡើងវិញ · ឈ្មោះ checker ក្នុងប្រវត្តិទាំង ២ ប្តូរតាម (លិបិក្រម) |
| A203 | **Login ZTO Palm ជាប់ទូរស័ព្ទមួយ ⟷ Cookie ជាប់ Server** ៖ Cookie Argus ទុកក្នុង Blob ➜ គ្រប់ទូរស័ព្ទប្រើ (Sync ម្តង) · Palm ៖ session + `refreshToken` អ៊ិនគ្រីបក្នុង `zoew_lookup_api_config` របស់ទូរស័ព្ទនីមួយៗ ➜ ទូរស័ព្ទ ៥ = Login ៥ ដង (ពាក្យសម្ងាត់ Palm ត្រូវចែកឲ្យបុគ្គលិក) · ម្ចាស់គម្រោងបញ្ជាក់ ៖ សាខានីមួយៗមានគណនី Palm ផ្ទាល់ ➜ session ហាងតែមួយក្នុងសោភ្ជាប់មួយ នឹងឲ្យសាខា B ប្រើ token សាខា A | រចនា ៖ Blob `palm-session/<ស្លាកសោ>/<សាខា>` (AES-GCM · សោដេរីវេពី `ZTO_PALM_SESSION_SECRET` ស្លាក `zoew:palm:shared:v1:` · AAD = sha256(សោភ្ជាប់) ➜ Blob ចម្លងទៅសោផ្សេងបើកមិនបាន) + បញ្ជី `palm-sites/<ស្លាកសោ>` · memory ៦០ វិ (ស្កេនធម្មតាមិនអាន Blob) · ETag CAS (`onlyIfMatch`/`onlyIfNew`) គ្រប់ការសរសេរ · lease ៣០ វិ សម្រាប់ Login តាមអាយុ · single-flight `slot#age`/`slot#auth` · ការបដិសេធចុងក្រោយ ➜ សញ្ញា `rejected` អ៊ិនគ្រីប · សាខាពី `X-Zoe-Palm-Site` ➜ session ផ្ទាល់ ➜ សាខាតែមួយក្នុងបញ្ជី · តេស្ត Function ពិត ១៩ + App ពិត ១០ (Firebase · Supabase) ៖ Login ព្រមគ្នា ៥ ➜ ZTO ឃើញ Login ១ · container ៣ ➜ ១ · ⛔ មិនទាន់វាស់លើ ZTO ពិត ៖ token តែមួយលើទូរស័ព្ទច្រើនព្រមគ្នា · អត្រាកំណត់ Login របស់ ZTO | Login ម្តងក្នុងសាខា ➜ គ្រប់ទូរស័ព្ទនៃសាខា · ទូរស័ព្ទមិនកាន់ token/ពាក្យសម្ងាត់ · Blobs ធ្លាក់ពេល Login ➜ `shared: false` (ផ្លូវទូរស័ព្ទដូចមុន · fail-open) · ទូរស័ព្ទកំណែចាស់ចូលរួមតាម `?palm=refresh` · `require` + សាខាផ្សេង ➜ `branch:palm-other-branch` (មិនផ្ញើទៅ ZTO) · «📌» ៖ ម្ចាស់គម្រោងផ្ទៀងលើ Preview |

ព្រំដែនសមត្ថភាព (អតិថិជនច្រើន · មិនកែ · ម្ចាស់គម្រោងសម្រេច) ៖ សំណើ Function រាប់តាមទូរស័ព្ទ (ការអានបញ្ជីចុះហត្ថលេខា · ស្កេន) មិនមែនតាមហាង ➜ កូតា Netlify ក្នុង
«🗳️ សមត្ថភាពមុនដាក់ប្រើជាផ្លូវការ» · session Palm មួយក្នុងមួយសាខា ➜ សំណើ ZTO ទាំងអស់នៃសាខាប្រើ token ដដែល (អត្រាកំណត់ ZTO មិនទាន់វាស់)។ ការអានលុយ · លុប/ដក · race ·
listener · SW · backend ២ លើកូដដែលប្រែក្នុង PR នេះ ៖ គ្មានកំហុសថ្មី (fuzz ខាងលើ · តេស្តដែលមានស្រាប់ក្នុង A196–A202)។

### 2026-10-17 — Deep audit ផ្លូវ «កញ្ចប់ត្រឡប់ ➜ ធុងសំរាម» ៖ ហត្ថលេខាមិនឈ្នះគ្រប់ទ្វារ · view ចាស់ដក Barcode ស្តាររួចម្តងទៀត

សំណើ ៖ «deep audit … ស្កេនត្រឡប់ ដកចូលធុងសំរាមតាម … អានកូដរកកំហុស ឬ ចន្លោះវិញអោយស្អាតកុំជឿជាក់លើ checker»។ វិធី ៖ អានទ្វារទាំង ៣ នៃ `removeReturnedZtoBarcodes()`
(ទាញបញ្ជី · ពិនិត្យនៅខាងក្រោយ Cookie · Palm `status=1`) ធៀបនឹងច្បាប់ «ZTO sign evidence wins» · សរសេរតេស្ត App ពិត + Function ពិត + ZTO ក្លែង ដែលចូលស្ថានភាពនោះ ➜ ធ្លាក់លើ 2.50.117 ➜ កែ។
run-all STRICT លើ 2.50.117 (emulator រស់) មុនកែ ៖ ជោគជ័យ ២១១ · ធ្លាក់ ១ (`layout-check` ➜ A200)។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A202 | **ទាញបញ្ជី Palm ខ្វះកញ្ចប់មកដល់រសៀល** (របាយការណ៍ម្ចាស់គម្រោង · រូបប្រអប់ ២) ៖ ថ្ងៃ 2026-10-17 ដដែល ៖ Cookie «ZTO ៥៥ ជួរ · 🆕 ៦១» (មកដល់ 13:59–14:32) ⟷ Palm «ZTO ៤១ ជួរ · 🆕 ៤៧» (មកដល់ 08:10–08:12 តែប៉ុណ្ណោះ) · 🔒 ២១ · ✍️ ៧ ស្មើគ្នា ➜ ខ្វះ ១៤ ជួរ · ម្ចាស់គម្រោងបញ្ជាក់ ៖ កញ្ចប់ដែលខ្វះ (មកដល់ 14:32) លេចក្នុង tab «បញ្ជូន» នៃ App Palm | App Palm អាន tab «បញ្ជូន» តាម `dispEmpDateFrom`/`dispEmpDateTo` (កាតាឡុក) ⟷ Function អាន `billStatus` `4` **គ្មានថ្ងៃ** (2.50.103 ៖ «without dispatch-date filtering» ដើម្បីកុំយកថ្ងៃចាត់ជាថ្ងៃមកដល់ · A180) ➜ ZTO ឆ្លើយបញ្ជីគ្មានថ្ងៃខុសពី tab ដែល App បង្ហាញ · ⛔ មិនទាន់វាស់លើ ZTO ពិតថាបញ្ជីគ្មានថ្ងៃឆ្លើយអ្វីពិតប្រាកដ (ម្ចាស់គម្រោងមិនទាន់ 🧪 track) ➜ ការកែជា superset ៖ មិនដកការអានគ្មានថ្ងៃ | tab `4d` = `billStatus` `4` + `dispEmpDate*` លើចន្លោះជ្រើស ➜ max(ដល់ថ្ងៃ, ថ្ងៃនេះ) (ដូចបញ្ជីចុះហត្ថលេខា) · បេក្ខភាពស្ទួនរវាង tab ដកក្នុងមួយទំព័រ (ជួរខុសទម្រង់រាប់ម្តង) · track នៅជាភស្តុតាងតែមួយ · `zto-palm-list-e2e` ZTO ក្លែង ៖ បញ្ជីគ្មានថ្ងៃមិនមានកញ្ចប់ចាត់ថ្ងៃនោះ ➜ 2.50.117 ៥ ធ្លាក់ · ការអានគ្មានថ្ងៃនៅ (កញ្ចប់ចាត់មុនចន្លោះ) · កញ្ចប់នៅតាមផ្លូវមិនក្លាយជាជួរ · «📌» ៖ ម្ចាស់គម្រោងផ្ទៀងលើ Preview |
| A201 | **វគ្គថ្មីរង់ចាំការអានបញ្ជីត្រឡប់ដល់ ១ ម៉ោង** ៖ `ztoState.ztoReturnedSweepAt` (≤ ម្តង/`ZTO_OPEN_RECHECK_MS`) មិន reset ជាមួយវគ្គ ZTO (`clearZtoPickupStatusStore()` ៖ ចាកចេញ · ប្តូរហាង · ប្តូរ Config Lookup) ខណៈម៉ោងផ្សេងទាំងអស់ reset ➜ ហាងបន្ទាប់មិនដកកញ្ចប់ត្រឡប់រហូតដល់ ១ ម៉ោង · តេស្តចាស់ reset វាដោយដៃក្នុង `beforeEach` (បាំងចន្លោះ) | `zto-returned-cleanup.test.ts` «វគ្គថ្មីអានបញ្ជីត្រឡប់ភ្លាម» ៖ 2.50.117 ➜ សំណើ `returned=1` ០ | reset ក្នុង `clearZtoPickupStatusStore()` (តំបន់ចាក់សោ · សំណើនេះ · `LOCK`) |
| A200 | **`layout-check` ធ្លាក់តែពេល run-all រវល់** ៖ run-all STRICT លើ 2.50.117 ៖ «modal លើ tablet/desktop មិនចង្អៀតជាងទូរស័ព្ទ» ➜ `pinSetupModal @768px 271u < 276u` · រត់តែឯង ➜ ជាប់ · ⛔ «flake» មិនមែនមូលហេតុ | រត់ ៤ ស្របគ្នា ➜ ១ ជាប់ · ១ ធ្លាក់ (លេខដដែល) · ២ លើសពិដាន · វាស់ទទឹងគ្រប់ទំហំ ៥ ដង ៖ ទំហំដដែលឲ្យលេខផ្សេងគ្នា (320 ៖ 272.3 · 278.7 · 284.1u · 768 ៖ 270.8–290.4u · 1280 ៖ 376–403u) · `.modal-content` មាន `width: 100%` + `max-width` (មិនអាស្រ័យអត្ថបទ) ➜ ទទឹងពិត 320 = 296px ÷ 1px = 296u · 768 = 353px ÷ 1.2px = 294u · 272.3 = 296 × **0.92** = `modalPopIn` ចាប់ផ្តើម (`scale(0.92)` ➜ 1 · bezier លើស ១) ➜ `getBoundingClientRect()` វាស់ទទឹងតាមដំណាក់កាលចលនា ➜ ក្រោមបន្ទុក ទំហំនីមួយៗវាស់ដំណាក់កាលផ្សេង · ⛔ App មិនខុស (ទទឹងពិត 768 = 294u ≥ 287u) | checker វាស់ `offsetWidth` (ទទឹង layout · មិនរាប់ transform) ដូចច្បាប់ «every measure stays transform-free» · App មិនប្រែ |
| A199 | **ស្តារធាតុ «ត្រឡប់» ពេល ledger ថ្ងៃមិនទាន់ Sync ➜ លុយបាត់** ៖ ធាតុ `returned` ដែល flip មិនទាន់ដល់ (Barcode `isDeducted: false` · ledger ដករួច · សោ `ded/<trashId>`) ស្តារលើឧបករណ៍ដែល listener ledger ថ្ងៃ pending/failed ➜ `restoreLedgerKeyFor()` ត្រឡប់ `null` (អានសោមិនបាន) ➜ កញ្ចប់ត្រឡប់ចូលប្រវត្តិ **ដោយមិនបូក** ➜ គ្មាន journal លើឧបករណ៍នោះ ➜ ចំណូល · ចំនួនកញ្ចប់ ខ្វះជាអចិន្ត្រៃយ៍ | `cleanup-ledger-key.test.ts` «៩គ» ៖ flip ព្យួរ · journal បាត់ · view ledger ថ្ងៃ pending ➜ 2.50.117 ៖ ធុងសំរាមទទេ · ledger នៅ 90/9 (គួរ 100/10) | `restoreAwaitsLedgerView()` ៖ `returned` + គ្មាន Barcode `isDeducted` + view ledger ថ្ងៃមិនស្រស់ ➜ មិនស្តារ (មុន claim តាម preview · ក្រោយ claim តាម Server) ➜ «⏳ ស្ថិតិចំណូលមិនទាន់ Sync — សូមរង់ចាំបន្តិច ហើយស្តារម្តងទៀត» · គ្មានការសរសេរ · ស្រស់វិញ ➜ ស្តារបូក ១០ · `CLAUDE.md` ជួរ «Interrupted cleanup» |
| A198 | **ទាញបញ្ជី (Cookie) ដកកញ្ចប់ត្រឡប់ ទោះបញ្ជីចុះហត្ថលេខាអានមិនបាន** ៖ `runZtoListSyncPreview()` ហៅ `removeReturnedZtoBarcodes(returned, …, signed)` ជានិច្ច ខណៈ `signed` មកពី companion `withSigned` ដែលអាច `signedOk: false` · `partial` ➜ កញ្ចប់ដែល ZTO ចុះហត្ថលេខា (អតិថិជនយករួច) + មានស្កេន `-710` ➜ ធុងសំរាម «ត្រឡប់» + ដកលុយ · ជួរ «↩️» សរសេរ «🗑️ … ធុងសំរាម» | `zto-returned-cleanup.test.ts` «ទាញបញ្ជី (Cookie) ៖ អានបញ្ជីចុះហត្ថលេខាមិនបាន» (ZTO `05` ឆ្លើយ 502) ៖ 2.50.117 ➜ Barcode ចេញពីប្រវត្តិ · ledger 100 ➜ 90 | ដកតែ `signedState === 'ok'` (Palm ៖ `ok` ជានិច្ច ព្រោះភស្តុតាងក្នុងមួយ Barcode) · `removeHeld` (`signed` · `switch`) ➜ «📌 … អានបញ្ជីចុះហត្ថលេខាមិនគ្រប់ ➜ មិនទាន់ដក (ទាញម្តងទៀត)» ⛔ មិនមែនសារ «កុងតាក់បិទ» · `zto-returned.test.tsx` fixture មាន `signedState: 'ok'` (ការទាញពិតមានជានិច្ច) |
| A197 | **ពិនិត្យនៅខាងក្រោយ (Cookie) ៖ ហត្ថលេខាមិនឈ្នះ** ៖ `runZtoStatusSweep()` ហៅ `removeReturnedZtoBarcodes(back.returned, dataToScan)` **គ្មាន** កូដចុះហត្ថលេខា · `closeZtoSignedBarcodes()` បិទ ≤ `ZTO_STATUS_SWEEP_BATCH` (១០) ក្នុងមួយជុំ ហើយរំលង Barcode ដែល `ztoSignedCloseIsHeld()` ➜ Barcode ចុះហត្ថលេខាទី ១១.. នៅបើកលើ Server · transaction `abandon` `{ codes }` ឃើញ «បើក» ➜ ដក · ក៏ដកពេលបញ្ជីចុះហត្ថលេខាអានមិនបាន | តេស្ត ៖ Barcode ១១ ចុះហត្ថលេខា · Barcode ចុងក្រោយមាន `-710` ➜ 2.50.117 ៖ ធុងសំរាម «ត្រឡប់» · ledger 100 ➜ 99 · count 10 ➜ 9 · បញ្ជីចុះហត្ថលេខា 502 ➜ ដក | `closeZtoSignedBarcodes()` ត្រឡប់ `signedCodes` (គ្រប់កូដនៃការអានពេញ · `partial`/`truncated`/បរាជ័យ ➜ `null`) ➜ ការដកជាត្រឡប់រត់តែពេលមាន `signedCodes` ហើយលើកលែងពួកវា · ជុំក្រោយបិទ Barcode ទី ១១ ជា «យក» |
| A196 | **view ចាស់ដក Barcode ដែលស្តាររួចម្តងទៀត** ៖ `ztoReturnedTargets()` ពិនិត្យ `ម៉ោងត្រឡប់ ≥ max(createdAt, restoredAt)` លើ view **ក្នុងទូរស័ព្ទ** តែ transaction `abandon` `{ codes }` ដកតាមឈ្មោះលើតម្លៃ Server ដោយមិនពិនិត្យម្តងទៀត ➜ ទូរស័ព្ទដែលក្រៅបណ្ដាញ (view មុនការស្តារ) ដក Barcode ដែលម្ចាស់គម្រោងស្តារ (`restoredAt` ក្រោយការត្រឡប់) ម្តងទៀត + ដកលុយម្តងទៀត | តេស្ត ៖ Server `restoredAt` = ១ ម៉ោងមុន · view ទូរស័ព្ទគ្មាន · ត្រឡប់ ១ ថ្ងៃមុន ➜ 2.50.117 ៖ Barcode ចេញ · ledger 100 ➜ 90 · ទិសផ្ទុយ (គ្មានការស្តារ) ➜ ដកដដែល | `opts.returnedAt` (Map កូដ ➜ ម៉ោងត្រឡប់) ➜ updater ពិនិត្យ `barcodeReturnCounts()` លើ Barcode Server · `barcodeReturnBasis()` ជារូបមន្តតែមួយ (`ztoReturnedTargets()` ប្រើដូចគ្នា) · `codes` គ្មាន `returnedAt` (តេស្តចាស់) ➜ ឥរិយាបថដើម |

### 2026-10-17 — Palm ៖ ល្បឿនជុំ ៣ (ម៉ូដែល) · Login ឡើងវិញនៅ background · អក្សរប្រអប់ខ្លី

សំណើ ៖ «បើសិនជាអាចចង់បង្កើនល្បឿនថែមទៀត» · «អោយ Palm login នៅbackgroudខ្លួនឯង…» · «អក្សរវែងពេក…»។ លទ្ធផលពិត 2.50.111 ៖ 421 បេក្ខភាព ➜ 29 ជួរ ·
12.5 វិ (បញ្ជី 6.0 · track 10.3 · ZTO 0.49 វិ/សំណើ)។ ZTO ស្របគ្នាពិត ≈ 421 × 0.49 ÷ 10.3 ≈ ២០ ក្នុង ៦៤ ➜ ពេលបាត់នៅការធ្វើដំណើរ App ↔ Function និងរលកក្រុម track។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A195 | **ស្នាមវាល Function ↔ App មិនស្គាល់ `ztoReturnedAt`** ៖ CI 2.50.116 shard ៣/៤ ៖ `zto-sync-banner-test` ផ្នែក ១០ ទាមទារឲ្យ App អានតែ `data.ztoClosed` ➜ A192 អាន `data.ztoReturnedAt` (Palm `status=1`) ➜ ធ្លាក់ | log CI ៖ «App មិនត្រូវអានឈ្មោះផ្សេង… ➜ data.ztoReturnedAt» | ⛔ មិនបន្ថយអ្នកយាម ៖ ដេរីវេសំណុំឈ្មោះដែល Function **និង** `_shared/zto-palm.js` ផលិតពិត (`zto…:` · `.zto… =`) ហើយទាមទាររាល់ `data.zto…` ក្នុង App ស្ថិតក្នុងសំណុំ · probe ទិសផ្ទុយ ៖ ឈ្មោះខុសមួយតួ (`ztoReturnAt` · `ztoClose`) មិនស្ថិតក្នុងសំណុំ |
| A194 | **waybill ពិតក្នុង `docs/HISTORY.md` · លិបិក្រមខ្វះ** ៖ CI 2.50.115 ធ្លាក់ shard ២/៤ (`security-guard-test` ៖ waybill កញ្ចប់ត្រឡប់ដែលម្ចាស់គម្រោង 🧪 សរសេរជាលេខពិត ៣ កន្លែង) · shard ៣/៤ (`doc-scope-test` ៖ ជួរ A191 · A192 ដាក់ឈ្មោះអ្នកយាមខ្លី ➜ លិបិក្រម «ផ្នែក ២» មិនស្មើការលេចពិត) | log CI ពិត ៖ `docs/HISTORY.md:79` · `:118` · `:4085` · «ជួរខុស/ខ្វះ/លើស 2» | លេខពិត ➜ «កញ្ចប់ត្រឡប់ដែលបាន 🧪» · A191 · A192 ដាក់ឈ្មោះឯកសារពេញ · ⛔ history git នៅមានលេខនោះ (មិនសរសេរ history ឡើងវិញដោយគ្មានសំណើ) |
| A193 | **ការជូនដំណឹងជិតផុតកំណត់មិនប្រាប់ឲ្យស្កេនត្រឡប់ · ធុងសំរាម «ផុតកំណត់» ខណៈកញ្ចប់ជាកញ្ចប់ត្រឡប់** ៖ 🔔 «📦» និងការរំលឹកម៉ោង ៨ និយាយតែ «ប្រព័ន្ធដកចេញ (ដកលុយ)» ខណៈគោលការណ៍ក្រុមហ៊ុន ៖ កញ្ចប់លើស ៧ ថ្ងៃ ត្រូវត្រឡប់ទៅសាខាកណ្តាល · ម្ចាស់គម្រោង ៖ «ដកមុខងារ ផុតកំណត់ចេញ ព្រោះវាជា ត្រឡប់» · «ដាក់ returned ទៅ» · «កែអោយស្អាតទៅ គ្មានទិន្នន័យអតិថិជន» · ច្បាប់វដ្តនៅខ្ចាត់ខ្ចាយ | `expiry-return-policy.test.tsx` លើ 2.50.116 ៖ ៥/៥ ធ្លាក់ · `zto-returned-cleanup.test.ts` (`returned` · rules គ្មាន `expired`) ធ្លាក់លើ 2.50.116 · rules ពិតមាន `expired` ➜ `returned` ត្រូវ rules ថ្មី · «៧ ថ្ងៃ» = `ABANDON_AGE_MS` (`>` ➜ ចូលថ្ងៃទី ៨) | តម្លៃតែមួយ `returned` (ស្លាក «ត្រឡប់») ជំនួស `expired` ក្នុងកូដ · rules · migration · តេស្ត · checker (គ្មានការបកប្រែទិន្នន័យចាស់ ៖ គ្មានអតិថិជន) · ច្បាប់ថ្ងៃទី ៨ នៅ (ជម្រើសម្ចាស់គម្រោង) · អត្ថបទ `NOTIFY_RETURN_*` · push ចម្លង (តេស្តបង្ខំ) · សៀវភៅ ៥ ជំហាន · `CLAUDE.md` វដ្តជាលំដាប់ · ⛔ ចំនួនថ្ងៃ · ការដកលុយ មិនប្រែ |
| A192 | **កញ្ចប់ត្រឡប់នៅបើកក្នុង ZoeW រហូតដល់ថ្ងៃទី ៨** ៖ ZoeW ដឹងការត្រឡប់ (A191) តែលុយនៅក្នុងស្ថិតិ ៨ ថ្ងៃ ➜ ម្ចាស់គម្រោង ៖ ដកដូចផុតកំណត់ ដោយមិនរង់ចាំ | ផ្លូវ ៨ ថ្ងៃ (`claimAndCleanupItem('abandon')`) ជ្រើស barcode តាមអាយុក្នុង transaction ➜ ត្រូវការជម្រើស barcode តាមឈ្មោះ ដោយរក្សា journal · ledger keyed · flip ដដែល · ការប្រណាំង ៖ Palm `ztoClosed: true` + `-710` ➜ បិទ «យក» មុន (`ztoReturnedAt` មិនផ្ញើ) · ស្តារវិញ ➜ `restoredAt` > ម៉ោងត្រឡប់ ➜ មិនដកម្តងទៀត · `run-all` លើ 2.50.115 ធ្លាក់ ១៩៤ ដោយ `npm run money:core` សាងសង់ `dist-audit` ឡើងវិញកណ្តាលការរត់ (`ENOENT uv_cwd`) ➜ មិនមែនកំហុស App · ⛔ កុំ build កណ្តាល run-all | `claimAndCleanupItem(id, 'abandon', { codes })` · `removeReturnedZtoBarcodes()` · ទ្វារ ៣ · `zto-returned-cleanup.test.ts` ១១ (ទ្វារនីមួយៗ mutation ➜ ធ្លាក់) |
| A191 | **កញ្ចប់ត្រឡប់ទៅវិញចូលបញ្ជីជា «🆕 ថ្មី»** ៖ ម្ចាស់គម្រោងឃើញ កញ្ចប់ត្រឡប់ដែលបាន 🧪 ក្នុង «ថ្មី» ខណៈ track ZTO Palm បង្ហាញ «ត្រឡប់ស្កេន» ហើយដាក់ឡានទៅ KC-01 ➜ បើបញ្ចូល វានៅបើកក្នុង ZoeW រហូតដល់ ៨ ថ្ងៃ | 🧪 ZTO Palm ពិត (ម្ចាស់គម្រោង) ៖ `3` 到件 15:29:45 ➜ `4` 派件 ➜ `-579` · `-585` (កញ្ចប់មានបញ្ហា) ➜ **`-710` 退货中** 08:00:34 ➜ `2` 发件 ទៅ KC-01 · Argus payload ពិតពីមុន ៖ `scanTypeCode: "-710"` «ត្រឡប់ការស្កេន» ➜ កូដដូចគ្នាទាំង ២ របៀប · ជួរមកដល់ Argus មាន `isRefund` តែន័យលើជួរមកដល់មិនទាន់វាស់ ➜ មិនប្រើ | Cookie ៖ `returned=1` (ស្កេន `-710` · ជួរ companion · កូដតែម្យ៉ាង · រាប់ `returnedScans`) · Palm ៖ `returnedAt` ពី `-710` សាខាខ្លួន ≥ មកដល់ចុងក្រោយ · client ៖ ក្រុម `returned` (មិនបញ្ចូល · ZTO បិទរួចឈ្នះ · `📌` បើមានក្នុង ZoeW) · `zto-returned.test.tsx` ៤/៤ · `zto-palm-returned.test.tsx` ធ្លាក់លើ 2.50.114 |
| A190 | **Palm បង្ហាញតែលេខសាខា** ៖ Cookie យកឈ្មោះពីជួរស្កេន (`scanSite` ➜ `siteName`) តែ Palm យកពី `doLogin` `siteName` ដែល ZTO ពិតឆ្លើយទទេ ➜ «🏢 សាខា ៖ 881859» · ស្ថានភាព Login Palm «សាខា 881859» | តេស្ត App ពិត + Function ពិត (Login ឆ្លើយ `siteName` ទទេ · ស្កេនមកដល់មាន `siteName` · ស្កេនដឹកបន្តសាខាផ្សេង) ៖ 2.50.113 ➜ `KH001` · `TrackingRPTO` មាន `siteCode` · `siteName` (កាតាឡុក API) | `trackEvidence()` ៖ ឈ្មោះពីស្កេនចុងក្រោយនៃសាខាខ្លួន · `palmTracks()` ៖ `session.siteName` មុន បើទទេ ➜ ឈ្មោះពី track · `notePalmSiteName()` · `zto-palm-server` · `zto-palm-list-e2e` · Preview ពិត ៖ «磅湛省斯登德朗县MerSorChrey市场KC-15 · 881859» (Cookie ៖ «MerSorChrey») ➜ ម្ចាស់គម្រោង ៖ «ចិងក៏ល្អដែរ វាជាឈ្មោះពិត» ➜ ទុកឈ្មោះពេញពី ZTO · មិនកាត់ · មិនទាយពីអត្ថបទសារ |
| A189 | **ក្រុម track ធំ (≤ ៦០) «មានអារម្មណ៍ថាយឺតជាងមុន»** ៖ ម៉ូដែល A187 ទាយ −២១–២៩% តែលើ ZTO ពិត 2.50.112 ៖ 29 ជួរ · ⏱ 11.5 វិ (2.50.111 ៖ 12.5 វិ ថ្ងៃមុន · ZTO ឆ្លើយខុសគ្នាតាមម៉ោង 0.23–0.49 វិ/សំណើ) ហើយម្ចាស់គម្រោងឃើញការទាញយឺតជាង | តេស្តលើ App ពិត + Function ពិត ៖ 2.50.112 ផ្ញើក្រុម `60,60,60,60,60,60,31,31` (ក្រុម ៦០ ចាប់ផ្តើមពេលទំព័រនៅមក · ការចែកស្មើកើតតែចុងបញ្ជី) ➜ សំណើនីមួយៗ ៧–៨ ជុំ ZTO (កញ្ចប់យឺតបំផុតក្នុងក្រុមកំណត់ពេលសំណើ) · វឌ្ឍនភាព «ផ្ទៀង track X/Y» ឡើងតែ ៨ ដង ⛔ ម៉ូដែលមិនមែនភស្តុតាង ៖ ការវាស់ពិតឈ្នះ | `ZTO_PALM_TRACK_BATCH` · `PALM_TRACKS_MAX` ៣០ វិញ · ការចាំទំព័រ + ចែកស្មើ ≤ ៣០ នៅដដែល · `zto-palm-list-e2e` «⏱ ក្រុម track ≤ ៣០» ធ្លាក់លើ 2.50.112 · ⏱ ពិត (ZTO ពិត · ៤ ថ្ងៃ · 122 ជួរ · 141 ថ្មី) ៖ 2.50.113 7.4 វិ · 2.50.114 ទាញទី ១ 13.6 វិ (deploy ថ្មី ➜ Function ចាប់ផ្តើមត្រជាក់) ➜ ទី ២ 8.7 វិ · លំដាប់ជួរ Palm = លំដាប់ track ឆ្លើយ (ខុសគ្នារាល់ការទាញ) · ឈ្មោះសាខាពី track ជាភាសាចិន |
| A187 | **ពេលទាញ Palm បាត់នៅរលកសំណើ មិនមែននៅ ZTO** ៖ ទំព័រ ២.. ចាំទំព័រ ១ (មួយជុំ App ↔ Function) · ក្រុម track ៣០ ➜ ៤៥៥ កញ្ចប់ = ១៦ សំណើលើ ៨ ស្លត (២ រលក · ការធ្វើដំណើរពីរដង) | ម៉ូដែលក្លែង (ZTO lognormal 0.23/0.49 វិ · App ↔ Function 0.6/0.8 វិ · tab 20/300/135) ធៀប ១២ គោលការណ៍ × ៤ បរិយាកាស × ៣ ទំហំ (125 · 455 · 880) ៖ មូលដ្ឋាន 5.76 វិ (ពិត 8.3) · 10.38 (ពិត 12.5) ➜ ចាំទំព័រ + ចែកស្មើ ≤ ៦០ ៖ 4.08 · 8.21 (−២១–២៩%) · 125 ៖ 3.20 ➜ 2.86 · ក្រុម ៦០ តែមិនចែកស្មើ ៖ 125 យឺតជាង (3.96) ➜ បដិសេធ · Function ១៦ × App ៤ ៖ មិនល្អជាង · ⛔ ប្តូរតំបន់ Function បានតែក្រោយ Upgrade (ការកំណត់) | `ztoPalmPageHint()` · `ztoPalmTrackBatchSize()` · `PALM_TRACKS_MAX` ៣០ ➜ ៦០ · `zto-palm-list-e2e` ៖ ទំព័រ ២–៥ ស្នើមុនទំព័រ ១ ឆ្លើយ · ការចាំលើស/ខ្វះ/សាខាផ្សេង · ៤០០ ➜ ≤ ៩ សំណើ · ៥៨ ➜ ៨ សំណើស្មើ · ពិតត្រូវវាស់លើឧបករណ៍ («📌») |
| A188 | **Session Palm ផុតកំណត់ ៨ ម៉ោង ➜ Login ដោយដៃរាល់ថ្ងៃ** ៖ App មិនរក្សាពាក្យសម្ងាត់ (ត្រឹមត្រូវ) ➜ គ្មានផ្លូវ Login ឡើងវិញ | រចនា ៖ Server បិទគណនី (AES-GCM · ស្លាកសោផ្សេងពី session · ចងនឹងសោហាង · ៣០ ថ្ងៃ) ➜ ទូរស័ព្ទកាន់តែកញ្ចប់ដែលខ្លួនមិនអាចបើក · ការប្រជែង ៖ ការទាញដែលកំពុងរត់ (session ថ្មីតាម `storeLookupApiConfig()` នឹងបោះការទាញ និងសម្អាតសាលក្រម ZTO) ➜ សរសេរនៅនឹងកន្លែង + មិនបន្តពេលទាញ · 401 ពី session ចាស់ក្រោយបន្តរួច ➜ មិនបន្តម្តងទៀត · ZTO risk control (captcha) ➜ ≤ ម្តង/៦០ វិ ពេលបដិសេធ · ≥ ៤ ម៉ោងពេលធម្មតា · `encryptLookupSecret()` ឲ្យ object ➜ ប្រៀប session ដោយ `JSON.stringify` (ការប្រៀបដោយ reference ឃើញ «បន្តរួច» ជានិច្ច ➜ តេស្តចាប់) · ឈ្មោះ `palmRefreshEnc` មិនត្រូវ Sentry redaction ➜ `palmRefreshTokenEnc` | `zto-palm-refresh.test.tsx` ៣៤/៣៤ ធ្លាក់លើកូដមុនកែ · `zto-palm-server.test.ts` ១៥ ធ្លាក់ (refresh · ៦០) · session ច្រើនក្នុងមួយគណនី ៖ ម្ចាស់គម្រោងប្រើគណនី Palm ដដែលលើទូរស័ព្ទ ៣ គ្រឿងរាល់ថ្ងៃ ➜ ZTO មិនកំណត់ session មួយក្នុងមួយគណនី ➜ Login ឡើងវិញរបស់ ZoeW មិនកាត់ session ឧបករណ៍ផ្សេង |

### 2026-10-17 — Palm លើ backend ទាំង ២ ៖ Server បដិសេធគណនី ZoeW ➜ App ថា «Session Palm ផុតកំណត់»

សំណើ ៖ «អោយpalm ដំណើរការពេញលេញដូច cookie គ្រប់ backend តេស្ត race ផង»។ វាស់ ៖ App ពិត + Function ពិត + ZTO Palm ក្លែង + អត្តសញ្ញាណ Firebase (ID token
ចុះហត្ថលេខាពិត) និង Supabase (`my_account()` ក្លែង) × `ZTO_DETAIL_IDENTITY` ទាំង ៣។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A186 | **សារខុសពេល Server បដិសេធគណនី ZoeW លើបញ្ជី Palm** ៖ បញ្ជី Cookie ទទួល `enabled:false` + `reason` (`fetchZtoListPage()` ➜ `notConfigured`) តែបញ្ជី Palm ទទួល `401 ZTO_IDENTITY_REQUIRED` / `503 ZTO_IDENTITY_UNAVAILABLE` ពី `palmList()` (`deps.lookupAccess()` ➜ `resolveDetailAccess()`) ➜ App ថា «🔑 Session ZTO Palm ផុតកំណត់ — Login ZTO Palm» (token ផុតកំណត់ · គណនីគ្មានហាង · ហាងផុតកំណត់/បិទ) ឬ «ទាញបញ្ជីពី ZTO មិនបាន (HTTP 503)» (Supabase/វិញ្ញាបនបត្រមិនឆ្លើយ) · `site:palm-other-branch` ➜ «គណនីនេះគ្មានលេខសាខា ZTO» · ផ្លូវធម្មតា ៖ ជួរដូចគ្នាគ្រប់ backend × របៀប · race ៖ ច្រក session (`captureZtoSession()` · `ownsLock()`) ដំណើរការ | `zto-palm-backends.test.tsx` ៩/២១ ធ្លាក់លើ `507f1d7` (៦ របៀប require × backend · ៣ ហាង Supabase) · `zto-palm-race.test.tsx` ១៤/១៤ ជាប់មុនកែ · mutation ៖ worker មិនពិនិត្យ session ➜ ៣ ធ្លាក់ · `finally` ដោះសោជានិច្ច ➜ ២ ធ្លាក់ · sweep មិនពិនិត្យ session ក្រោយ fetch ➜ ២ ធ្លាក់ | `fetchZtoListPage()` ៖ `ZTO_LIST_IDENTITY_CODES` + `ZTO_LIST_IDENTITY_SERVER_REASONS` ➜ `notConfigured` + `listReason` (`transient` សម្រាប់ `ZTO_IDENTITY_UNAVAILABLE` ➜ `ztoPalmPageRetryable()`) · សារ `site:palm-other-branch` · `site:palm-missing` · ការរង់ចាំ ៨ ថ្ងៃ ៖ បណ្តោះអាសន្ន ➜ នៅរង់ចាំ · ស្ថាពរ ➜ បិទមុខងារ ដូច Cookie (`ZTO_IDENTITY_REQUIRED` `site:*` មុនកែ = បរាជ័យបណ្តោះអាសន្ន) · ព្រំដែនដែលទទួល ៖ `optional`/`off` មិនផ្ទៀងគណនីលើបញ្ជី Palm (session Palm ជារបស់សាខាមួយ) · គណនី Firebase គ្មានសាខា + require ➜ បញ្ជី Palm ដើរ (ផ្ទៀងរួច តែគ្មានសាខាប្រៀប) ⟷ គណនី Supabase គ្មានហាង ➜ `site:no-account` (មិនមែនអត្តសញ្ញាណផ្ទៀងរួច · ច្បាប់ CLAUDE.md) |

### 2026-10-17 — ទាញបញ្ជី Palm 17.5 វិ ៖ ZTO ស្របគ្នាពិតត្រឹម ~១០ ក្នុង ៣២ · តំបន់ Function ជាប់ Ohio

របាយការណ៍ (Preview PR #328 · 2.50.109) ៖ «⏱ Palm ៖ ផ្ទៀង 455 កញ្ចប់ ក្នុង 17.5 វិនាទី — បញ្ជី 4.4 វិ · track 14.6 វិ (សំណើ track 455 ·
ZTO ឆ្លើយមធ្យម 0.33 វិ/សំណើ)» · Netlify «Functions region ៖ CMH (Ohio, US East) · Upgrade to customize»។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A185 | **ZTO ស្របគ្នាពិតត្រឹម ~១០ ក្នុង ៣២** ៖ ការងារ ZTO = 455 × 0.33 = 150 វិ ➜ ស្របគ្នា ៣២ ពេញគួរ ≈ 4.7 វិ តែ track 14.6 វិ (150 ÷ 14.6 ≈ ១០) ➜ ពេលបាត់នៅការធ្វើដំណើរ App (កម្ពុជា) ↔ Function (`us-east-2`) រាល់សំណើ និងការរង់ចាំកញ្ចប់យឺតជាងគេក្នុងក្រុមនីមួយៗ · ៧ វិ (បញ្ជី + track) ជាជាន់ក្រោមរបស់ Palm ទោះស្របគ្នា ៣២ ពេញ ➜ Palm មិនដល់ Cookie (១–៣ វិ) ទេ | គំរូក្លែង (lognormal ZTO មធ្យម 0.33 វិ · RTT 0.35 វិ + Function 0.9 វិ) តម្រូវតាមលេខពិត ៖ កំណែនេះ 17.0 វិ ⟷ ពិត 17.5 · រៀបក្រុមឡើងវិញស្របគ្នា ៣២ ដដែល ៖ −3…6% · Function ៨ ក្នុងមួយ × សំណើ ៨ (៦៤) ៖ **11.2 វិ** · Function ១៦ × ៤ ៖ 15.6 វិ · App ពិត + Function ពិត + ZTO ក្លែង 455 កញ្ចប់ (ZTO 20–60ms · បញ្ជី 150ms) ៖ ស្របគ្នា ៤ **1.05 វិ** ⟷ ៨ **0.70 វិ** (−33% · ជួរដដែល) | ប្តូរតំបន់ Function ➜ ត្រូវ Upgrade Netlify (ម្ចាស់គម្រោងមិនទាន់សម្រេច) · ម្ចាស់គម្រោងជ្រើស «ស្របគ្នា 64» ➜ `ZTO_PALM_LIST_CONCURRENCY` ៨ ([2.50.110]) · ម្ចាស់គម្រោងវាស់ 2.50.110 ៖ 455 កញ្ចប់ **8.3 វិ** (បញ្ជី 3.0 · track 7.2 · ZTO 0.23 វិ/សំណើ · ជួរដដែល · គ្មាន «ZTO មិនឆ្លើយ track») ➜ −53% · ZTO មិនកំណត់ល្បឿន |

### 2026-10-17 — ទាញបញ្ជី Palm 16.4 វិ ៖ ZTO មិនឆ្លើយ `mailNos` ច្រើនលេខ · track រង់ចាំបញ្ជីគ្រប់ទំព័រ

របាយការណ៍ (Preview PR #328 · 2.50.108) ៖ «⏱ Palm ៖ ផ្ទៀង 443 កញ្ចប់ ក្នុង 16.4 វិនាទី (សំណើ track 452)» · «cookie ទាញតែ 1-3វិនាទី» ·
«cookie មិនចាញ់ទេ cookie លឿនជាង»។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A184 | **Palm track ច្រើនលេខមិនដំណើរការលើ ZTO ពិត** (សំណើ 452 = 443 + សំណើសាក «A,B» ៩ ៖ មួយ Function container មួយ ទទេ ➜ ម្តងមួយលេខ) · **track ចាប់ផ្តើមតែក្រោយបញ្ជីគ្រប់ទំព័រ** · ប្រអប់មិនប្រាប់ថាពេលទៅណា | ពេលពិត ≈ N × (ពេល ZTO ឆ្លើយ) ÷ ៣២ + ទំព័រ ៖ track ត្រូវការ 443 សំណើ ➜ Cookie (បញ្ជីស្កេន `03` ស្រាប់ ១–៣ សំណើ) នៅតែលឿនជាងដោយធម្មជាតិ · App ពិត + Function ពិត + ZTO ក្លែង 443 កញ្ចប់ (ZTO ៦០ms · បញ្ជី ១២០ms · ÷១០) ៖ `c0ced42` **1.33 វិ** (ZTO ៤៦២) · ថ្មី **1.27 វិ** (ZTO ៤៥០) — tab «បញ្ជូន» ៥ ទំព័រ ➜ សំណើ ៤ យកទំព័រមុន ➜ ចំណេញតិច · ចំណេញធំពេលទំព័រយឺតជាង track | ម្តងមួយ Barcode · track ចាប់ពីទំព័រទី ១ ក្នុងបណ្តុំ ៤ ដដែល · `trackCalls` ពិត + `trackWaitMs` ➜ «បញ្ជី · track · ZTO ឆ្លើយមធ្យម» ក្នុងប្រអប់ · ⛔ មិនបង្កើនការស្របគ្នា ឬ cache (ម្ចាស់គម្រោងជ្រើស «គ្មានហានិភ័យ») ➜ «📌» [2.50.109] |

### 2026-10-17 — ទាញបញ្ជី Palm យឺត ១–២ នាទី ៖ មួយសំណើ Function ក្នុង ៥ បេក្ខភាព

របាយការណ៍ (Preview PR #328 · 2.50.106) ៖ «ទិន្នន័យមានត្រឹមត្រូវហើយតែ យូរណាស់ … ប្រហែល 1-2នាទី … cookie តែប៉ុន្មាន វិនាទីទេ»។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A183 | **ទាញបញ្ជី Palm យឺត** ៖ ទំព័រមួយ = ៥ បេក្ខភាពក្នុងមួយ tab + track ក្នុង Function តែមួយ ➜ កញ្ចប់ N = សំណើ Function ≈ N/៥ (ម្តងៗ ៖ RTT ទៅ Function + បញ្ជី ZTO + track) · App ៣ ទំព័រស្របគ្នា (2.50.106) / ២ (2.50.107) · tab អស់ទំព័រត្រូវអានរាល់ទំព័រ (2.50.106) | App ពិត + Function ពិត + ZTO ក្លែង ៥២២ កញ្ចប់ · latency ÷១០ (ZTO ៣០ms · Function ២៥ms) ៖ `3e78c96` **3.3 វិ** (Function ១០៣ · ZTO ៨២៩) · `0469d7a` **4.9 វិ** (Function ១០៤) · ថ្មី **1.0 វិ** (track ម្តងមួយលេខ · Function ២៤ · ZTO ៥៤២) · **0.49 វិ** (ZTO គាំទ្រច្រើនលេខ · ZTO ៦១) | ២ ដំណាក់កាល (`candidates=1` ១០០ ជួរ · `tracks=` ៣០ × ៤ ស្របគ្នា) · `mailNos` ច្រើនលេខដែលផ្ទៀងតាម Barcode · តេស្តល្បឿនធ្លាក់លើ `0469d7a` (សំណើបញ្ជី ៣៦ ≠ ៤) · ⛔ មិនទាន់វាស់លើ ZTO ពិតថា `mailNos` «A,B» ដំណើរការ ➜ «📌» [2.50.108] (ប្រអប់បង្ហាញ «សំណើ track M») |

### 2026-10-17 — ទាញបញ្ជី Palm បរាជ័យ ៖ សំណើ ZTO រាប់រយ គ្មានការសាកម្តងទៀត · កញ្ចប់មួយធ្លាក់ទាំងបញ្ជី

របាយការណ៍ (PR #328 · 2.50.106) ៖ «login palm ទាញ បញ្ជីZTO មិនបាន» ខណៈ «បិទដោយស្វ័យប្រវត្តិតាមZTO និងប្រាប់បិទក្នុងZoeW តែZTO Palm មិនទាន់បិទ ដំណើរការល្អហើយ»។
រូបចុងក្រោយមិនមានកូដ ➜ វាស់រចនាសម្ព័ន្ធផ្លូវទាញជាមុន (CLAUDE.md «Warnings» ១ ៖ បញ្ហាដដែលចូលតាមទ្វារច្រើន = រចនាសម្ព័ន្ធខូច)។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A181 | **សំណើ ZTO រាប់រយ គ្មានការសាកម្តងទៀត** ៖ Cookie ទាញបញ្ជីដោយសំណើពីរបី ⟷ Palm ៖ ទំព័រ (៥ បេក្ខភាព/tab) × ៣ tab `queryDispatchList` + `queryTrackInfo` ម្តងមួយ Barcode · Function `Promise.all` ទាំងទំព័រ · App `Promise.all` ទាំងបញ្ជី ➜ សំណើបរាជ័យតែ ១ = «ទាញបញ្ជីមិនបាន» (ឧ. បរាជ័យ ១% × ២០០ សំណើ ➜ ជោគជ័យ ≈ ១៣%) · tab ដែលអស់ទំព័រត្រូវអានរាល់ទំព័រ (`list:null` ➜ `palm:list-5-items` [2.50.105]) | `zto-palm-list-e2e.test.tsx` ៖ App ពិត + Function ពិត + ZTO ក្លែង ២៣ កញ្ចប់ · 503/`SYS_BUSY` លើ ៦ សំណើ ➜ កូដមុនកែ «HTTP 502 · palm:SYS_BUSY» · tab «បញ្ហា» ១ ទំព័រ អាន ៣ ដង | Function សាកម្តងទៀត ១ ដង (`palmRead`) · App សាកទំព័រ ៣ ដង (`fetchZtoPalmPage`) · `tabs`/`tabPages` · mutation ៖ `ZTO_PALM_LIST_PAGE_TRIES_MAX = 1` ឬ `ZTO_PALM_LIST_VERIFY_TRIES_MAX = 0` ➜ test ធ្លាក់ · ៦ test ថ្មីធ្លាក់លើ `3e78c96` |
| A182 | **track មួយកញ្ចប់ធ្លាក់ទាំងបញ្ជី** ៖ `arrivalTrackRows()` បោះកំហុស (`track-barcode` · `track-time` · `track-empty` …) ➜ ទំព័រ 502 ➜ បញ្ជីទាំងមូលបរាជ័យ · ផ្លូវ `status=1` (របារ · បិទស្វ័យប្រវត្តិ) ដែលម្ចាស់គម្រោងថាដំណើរការ ទុក track ដូចគ្នាជា `null` ដោយមិនធ្លាក់ | e2e ៖ track ជើងដំបូង (`mailNo` ផ្សេង) ➜ កូដមុនកែ «palm:track-barcode · Barcode …» · track 502 រហូត ➜ «palm:track-response» · Session ផុតកំណត់ ➜ «HTTP 401» គ្មានការណែនាំ | `trackEvidence()` យកតែ track របស់ Barcode នោះ · Barcode ដែលនៅតែមិនឆ្លើយ ➜ `unverified` + ⚠️ ក្នុងប្រអប់ (មិនបាត់ស្ងាត់) · `result: []` មិនមែនភស្តុតាង ([2.50.101]) ➜ `palm:track-empty` · 401 ➜ «Login ZTO Palm ម្តងទៀត» · ⛔ មិនទាន់វាស់លើគណនីពិតថាទ្វារណាជាករណីពិតរបស់ម្ចាស់គម្រោង ➜ «📌» [2.50.107] |

ការរត់ ៖ `run-all` ពេញ (គ្មាន RTDB emulator · Postgres · `firebase-tools` ➜ `emu/*` · Supabase ៦ រំលង ១២ មួយផ្នែក · ⛔ មិនមែនបៃតងពេញ) ៖ ១៩១ ឆ្លង · ៣ ធ្លាក់ ➜
`toast-action-truth` (toast «🔑» ថ្មីគ្មាន prefix ថ្នាក់ ➜ «⚠️») · `phone-search-swipe-test` «ចាកចេញ ➜ ដោះការហូតឡើងវិញ» (PR #328 ដាក់ `viewState.lookupTestResult`
មុន `setPhoneSearchPulledUp(false)` ក្នុង `clearSensitiveModalFields()` ➜ ហួស ២០០ តួ ➜ ប្តូរលំដាប់) · `native:check` «APK ៖ ចលនាស្វែងរកមិនលោត» ស៊ុមមួយ ២៨%
ពេល lane ៤ រវល់ (មិនប៉ះកូដចលនា) ➜ រត់ឡើងវិញ (`RUNALL_ONLY` ៧) ទាំង ៣ ឆ្លង · `zoew-suite` ទាំង ២ ផ្នែកឆ្លង។

### 2026-10-16 — បញ្ជី Palm ខុស ៖ tab «បញ្ជូន» មិនមែនកញ្ចប់មកដល់

របាយការណ៍ ៖ «Palm ទាញបញ្ជី ទិន្នន័យខុស … ថ្ងៃនេះជាក់ស្តែងកញ្ចប់ចូលមកមានតែអតិថិជនម្នាក់គត់ … Cookie បង្ហាញត្រឹមត្រូវ» · «ZTO_LIST_SCAN_TYPE = 03 (អីវ៉ាន់មកដល់)»។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A180 | **បញ្ជីមកដល់ Palm មិនមែនស្កេនមកដល់** ៖ ថ្ងៃដដែល ប្រអប់ Cookie (ស្កេន `03`) ឆ្លើយ ២៤ ជួរ (អតិថិជនម្នាក់ · មកដល់ ១៥:៣០) + ✍️ ១៤ ⟷ ប្រអប់ Palm ឆ្លើយ ៦៩ ជួរ ម៉ោង ០៧:៥៧–០៧:៥៨ អតិថិជនច្រើន ទាំង ៦៩ «ថ្មី (មិនទាន់មានក្នុង ZoeW)» · កញ្ចប់អតិថិជនដដែលមាននៅបញ្ជីទាំងពីរ ៖ Palm ០៧:៥៧ ⟷ Cookie មកដល់ ១៥:៣០ · ព័ត៌មានកញ្ចប់មួយពី web Argus ៖ `billStatus` `4` · `dispEmpDate` ព្រឹកថ្ងៃដដែល · `recSiteDate` ៤ ថ្ងៃមុន · `signSiteDate` ទទេ | រូបប្រអប់ទាំងពីរលើ preview `d4a20e7` (ជុំមើលជាមុន ៖ គ្មានការបញ្ចូល) · response web Argus | `queryDispatchList` `billStatus` `4` តាម `dispEmpDate*` = កញ្ចប់ដែល ZTO ចាត់ឲ្យសាខាចែក រួមទាំងកញ្ចប់នៅតាមផ្លូវ មិនមែនស្កេនមកដល់ `03` · `DispatchQueryInfoQTO` គ្មានប្រភេទស្កេន · កាតាឡុក App Palm គ្មាន endpoint អានបញ្ជីស្កេនមកដល់ (`queryTrackInfo` ម្តងមួយកញ្ចប់) ➜ បញ្ជីមកដល់ Palm បិទ (`palm:no-arrival-list` · App លាក់ការទាញ) ⛔ មិននាំចូលពី tab «បញ្ជូន» · A176 (ស្ថានភាពជួរ = ស្ថានភាពបច្ចុប្បន្ន) ត្រឹមត្រូវ តែការសន្មត «tab «បញ្ជូន» = មកដល់» ខុស · បញ្ជីចុះហត្ថលេខា (`5` · `signSiteDate`) រក្សា (auto-close · ការរង់ចាំ ៨ ថ្ងៃ) · ផ្លូវ ១០០% ៖ web Argus ផ្ទៀង `scan/page/scan` ដោយ Cookie `BOS-MAN-SESSION` តែប៉ុណ្ណោះ (header request ៖ គ្មាន `Authorization`) ➜ សាក token Palm ក្នុង PR ថ្មី · mutation ៖ កូដមុនកែ ➜ ៧ test ធ្លាក់ · `zto-list-sync-test` (CI ផ្នែក ២/៤) ៖ sandbox របស់ `refreshZtoListSyncUi()` ត្រូវការ `ztoListPalmMode` ➜ បន្ថែម stub |

### 2026-10-16 — Lookup Palm យឺតជាង Lookup Cookie (ម្ចាស់គម្រោងវាស់លើទូរស័ព្ទ)

របាយការណ៍ ៖ «lookup របស់ palm 1.2-1.5 វិនាទី» · «cookie lookup លឿនជាង នៅតែ 0.6-1.0 ដដែល»។ ម៉ាស៊ីន session ភ្ជាប់ host ZTO មិនបាន
(`aargus-api.ztoglobal.com` · `.net` ➜ បណ្ដាញបិទ) ➜ វាស់ពីទីនេះមិនបាន ➜ សង់ឧបករណ៍វាស់ក្នុង Function មុន មិនទាយ។ អានកូដ ៖ ផ្លូវ Palm ក្នុង Function
(ស្រាយ session AES-GCM · `sessionKey()`) និងក្នុង App (ស្រាយ session ដោយសោ PIN) ចំណាយតិចជាង ms ➜ ភាពខុសគ្នានៅ ZTO ឬនៅការភ្ជាប់។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A173 | របៀប Palm មិនកម្តៅ Function (`warmZtoLookupProxyIfConfigured()` ចេញភ្លាមពេល Palm) ខណៈរបៀប Cookie កម្តៅតាមចេតនាអ្នកប្រើ និងក្រោយការស្កេន ➜ container ត្រជាក់ចំណាយ cold start លើការស្កេន | `zto-palm-list.test.tsx` ៖ Palm ➜ គ្មានសំណើកម្តៅ | `OPTIONS ?palm=1` (គ្មានសោ · គ្មាន session) ➜ Function រំលងការអាន Cookie (`isPalmPreflight()` · A168) · ទិសផ្ទុយ ៖ Cookie គ្មាន `palm=1` |
| A174 | មូលហេតុនៅសល់វាស់មិនបាន ៖ `upstreamTiming` មិនរាប់ Palm · គ្មានការរាប់ការភ្ជាប់ TLS ថ្មី | `?diag=1` Palm គ្មានពេល | `upstreamTiming.palm` (`detail` · `list` · `signed`) + `connections` (`argus` · `palm` ៖ undici `diagnostics_channel`) ➜ 🩺 ជាវិនាទី · ⛔ ព្រឹត្តិការណ៍ `beforeConnect` និង `connected` ពិតដឹក `connectParams` **ផ្សេងគ្នា** (វាស់ ៖ `fetch` ពិត) ➜ ការផ្គូរតាម object (`WeakMap`) មិនដែលបានពេល ➜ ផ្គូរតាម host + port · test ពិតជាមួយ server ក្នុងម៉ាស៊ីន (`ZoeW/tests/zto-upstream-timing.test.ts`) ធ្លាក់លើការផ្គូរតាម object |
| A175 | ម្ចាស់គម្រោងវាស់លើ preview (🩺) ៖ **Palm** ZTO ឆ្លើយមធ្យម ០.៥៨ វិ · ចុងក្រោយ ០.៦២ វិ (៣ ដង) · ភ្ជាប់ថ្មី ៣ ដង មធ្យម ០.៦៧ វិ ⟷ **Cookie** មធ្យម ០.៥៤ វិ · ចុងក្រោយ ០.២៤ វិ (៦ ដង) · ភ្ជាប់ថ្មី ៤ ដង មធ្យម ០.២៨ វិ ➜ មធ្យមស្ទើរស្មើ · ភាពខុសគ្នានៅការភ្ជាប់ (ការភ្ជាប់ Palm ថ្លៃជាង ២ ដង ហើយមិនឃើញការប្រើឡើងវិញ) ឬនៅ ZTO Palm ផ្ទាល់ ➜ **ចម្លើយមិនច្បាស់** ៖ ការភ្ជាប់ Palm ក៏រាប់ការអានបញ្ជីចុះហត្ថលេខា (បិទតាម ZTO) ដែរ ហើយការភ្ជាប់មធ្យម (០.៦៧) ធំជាងពេលស្កេនមធ្យម (០.៥៨) ➜ ស្កេនខ្លះប្រើការភ្ជាប់ដែលបើករួច | 🩺 preview `f05f3cd` | វាស់ម្តងទៀតមុនកែ ៖ `upstreamTiming.scans` (ស្កេនតាមការភ្ជាប់ថ្មី/បើករួច · undici `request:create` ➜ `sendHeaders` (socket ថ្មីតែសម្រាប់សំណើទីមួយរបស់វា) ➜ `request:headers`) · `keepAliveSec`/`closes` ពី header ចម្លើយ · `runtime.region` ⛔ មិនទាន់ប្តូរការភ្ជាប់ ឬតំបន់ ដោយគ្មានលេខនេះ |
| A176 | **បញ្ជី Palm ទទេ** ៖ ZTO ផ្ញើ ៨០ ជួរ ➜ ទាញបាន ០ · «ស្កេនប្រភេទផ្សេង ៨០ ជួរ មិនរាប់» ខណៈ Cookie ទាញបាន ១៥១ | ម្ចាស់គម្រោង preview `3b23580` (🩺 + ផ្ទាំងបញ្ជី) | `palmListBody()` ទាមទារស្ថានភាពជួរ = `4` តែ `billStatus` របស់ជួរ = ស្ថានភាពបច្ចុប្បន្នរបស់កញ្ចប់ (មិនមែនតម្រងសំណើ) ➜ ជួរមកដល់ទាំងអស់ធ្លាក់ទៅ `otherScans` ➜ ជួរនៃសំណើ `4` ទាំងអស់ជាកញ្ចប់មកដល់ លើកលែងជួរស្ថានភាព `5` (ភស្តុតាង) · អ្នកយាម `zto-palm-server.test.ts` (ជួរស្ថានភាព `1` · ទទេ · គ្មានវាល ➜ មកដល់) ធ្លាក់លើកូដមុនកែ · ⛔ បញ្ជីចុះហត្ថលេខានៅទាមទារ `5` (ស្ថានភាពចុងក្រោយ · គ្មានភស្តុតាងថាខុស · ផ្លូវលុយ) · ✅ ម្ចាស់គម្រោងបញ្ជាក់លើ preview `de0287f` ៖ «ទាញបញ្ជីកញ្ចប់ពី ZTO បានហើយ» |
| A177 | **មូលហេតុល្បឿន Palm វាស់បានច្បាស់** ៖ Palm ស្កេនលើការភ្ជាប់ដែលបើករួច **០.២២ វិ** (៣) — លឿនជាង Cookie ០.៣៨ វិ (២) · លើការភ្ជាប់ថ្មី **០.៩១ វិ** (៣) ⟷ Cookie ០.៨២ វិ (៣) · ការភ្ជាប់ថ្មី Palm ០.៦៨ វិ ⟷ Cookie ០.៣២ វិ · ZTO **មិនប្រាប់រយៈទុកការភ្ជាប់** (គ្មាន header `Keep-Alive`) · Function នៅ `us-east-2` | ម្ចាស់គម្រោង preview `3b23580` | server ZTO Palm មិនយឺតទេ ៖ ពេលបន្ថែមទាំងអស់ = ការភ្ជាប់ថ្មី (TCP + TLS ទៅ host Palm ឆ្ងាយពី `us-east-2`) · ZTO គ្មាន hint ➜ undici ទុកការភ្ជាប់ទំនេរតែ ៤ វិ (លំនាំដើម) ➜ ការស្កេនដែលឃ្លាតលើស ៤ វិ ភ្ជាប់ថ្មីម្តងៗ ➜ ជំហានបន្ទាប់ ៖ ទុកការភ្ជាប់ Palm យូរជាង ឬប្តូរតំបន់ Function ទៅជិត ZTO (ការកំណត់ Netlify · ម្ចាស់គម្រោងសម្រេច) |
| A178 | **ទុកការភ្ជាប់ Palm ៦០ វិ** (ម្ចាស់គម្រោងជ្រើស «ក») | ពិសោធ fetch ពិត ៖ server គ្មាន `Keep-Alive` (ដូច ZTO) ➜ pool លំនាំដើមភ្ជាប់ថ្មីក្រោយទំនេរ ៤.៦ វិ (២ ការភ្ជាប់) · Agent ៦០ វិ ➜ ១ · ការភ្ជាប់ដែល server បិទរួច ➜ `TypeError: fetch failed` + `cause.code` `UND_ERR_SOCKET` | `palmDispatcher()` ៖ Agent ពី constructor របស់ dispatcher សកល (`Symbol.for('undici.globalDispatcher.1')`) ⛔ គ្មាន dependency ថ្មី · គ្មាន dispatcher សកល (សំណើទីមួយរបស់ container) ឬមិនមែន `Agent` ➜ client លំនាំដើម · `UND_ERR_SOCKET`/`ECONNRESET`/`EPIPE` ➜ ស្កេន/បញ្ជីព្យាយាមម្តងទៀតមួយដងក្នុងថវិកាដដែល ⛔ មិនមែន Login · អ្នកយាម `zto-palm-server.test.ts` (fetch ពិត + server ក្នុងម៉ាស៊ីន · mutation `PALM_KEEP_ALIVE_MS` = 4000 ➜ ធ្លាក់) |
| A179 | **ម្ចាស់គម្រោងវាស់ក្រោយទុកការភ្ជាប់ ៦០ វិ** ៖ Palm ZTO ឆ្លើយមធ្យម **០.៣២ វិ** · ចុងក្រោយ ០.២១ វិ (៦ ដង) · ស្កេនលើការភ្ជាប់ដែលបើករួច **៥ ដង** មធ្យម ០.២១ វិ ⟷ ការភ្ជាប់ថ្មី **១ ដង** ០.៨៣ វិ · គ្មានការហួសពេល (មុន ៖ មធ្យម ០.៥៩ វិ · ថ្មី ៣ / បើករួច ៣ · A177) · ក្រៅពីនេះ ៖ preview ឆ្លើយ 401 «សោភ្ជាប់ ZoeW មិនត្រឹមត្រូវ» ខណៈ main ចូលបាន ➜ កូដ Login (App) និងការពិនិត្យសោ (Function) ដូច main ➜ ម្ចាស់គម្រោងសម្អាតទិន្នន័យ site preview ហើយវាយសោឡើងវិញ ➜ ចូលបាន · Login លើកទីមួយក្រោយនោះ «ZTO ឆ្លើយតបយឺតពេក» ម្តង | 🩺 preview `85b9dde` | ការទុកការភ្ជាប់ផ្តល់លទ្ធផលតាមការវាស់ ៖ ៥/៦ ស្កេនប្រើការភ្ជាប់ដដែល · មូលហេតុ 401 មិនបានវាស់ (ការកំណត់ដែលរក្សាទុកលើ site preview ឬ env Deploy Previews) · ការហួសពេល Login ៖ ម្ចាស់គម្រោង ៖ «ប្រហែលមកពីបណ្តាញ … សាក login ទៀតមិនអីទេ» ➜ បិទ (ការវាស់សព្វថ្ងៃមិនរាប់ Login ➜ បើកើតម្តងទៀត បន្ថែមការវាស់ Login មុនកែ) |

### 2026-10-16 — កាតាឡុក API ZTO Palm ពី APK ដែលម្ចាស់គម្រោងផ្តល់ (ឯកសារតែប៉ុណ្ណោះ)

សំណើ ៖ «កត់ត្រាទុកទាំងអស់ … ថ្ងៃក្រោយខ្ញុំចង់ update មុខងារបន្ថែមចូល ZoeW អោយស្គាល់គ្រប់មុខងារផ្លូវការរបស់ ZTO»។ APK ពន្លាក្នុង folder ដាច់
(មិនរត់អ្វីពីក្នុងវា) ➜ decompile `classes4/5.dex` ➜ ស្រង់ `PDAService` (Retrofit ៖ method · path · `result`) · `PDARequestImpl` (field body) ·
class `rpto`/`rqto` (field response) · screen ដែលហៅ ➜ [`ZoeW/docs/ZTO-PALM-API.md`](../ZoeW/docs/ZTO-PALM-API.md) ៖ endpoint ១១៣ (អាន ៦៥ · សរសេរ ៤៨
តាមឈ្មោះ) · កូដស្ថានភាព (`billStatus` ១ · ៤ · ៥ · `mailType` ១) · ផែនទី ZoeW ➜ Palm។ ⛔ គ្មានសោ protocol · គ្មានកូដ decompile ក្នុង repo
(ការដកសោពី APK ត្រូវបដិសេធដោយប្រព័ន្ធសុវត្ថិភាព session ➜ សោនៅតែ env)។ `billInfoQuery` គ្មានវាលស្ថានភាព ➜ ភស្តុតាងចុះហត្ថលេខាមកពី
`queryDispatchList` `billStatus` `5` (tab «ចុះហត្ថលេខា» របស់ App)។ ឯកសារតែប៉ុណ្ណោះ ➜ គ្មានការឡើងកំណែ។

### 2026-10-16 — Audit PR (Login ZTO Palm · [2.50.97]) ៖ ចន្លោះ identity · សោ protocol ក្នុង repo · វាល COD/DOD · checker ក្រហម ១៣

សំណើ ៖ «audit មុខងារថ្មី ក្នុង PR … ប៉ះទង្គិចជាមួយ cookie ពី blob · ដំណើរការត្រឹមត្រូវ · race · លេចធ្លាយ secret» ➜ «កែទាំងអស់ដែលរកឃើញថាមានចន្លោះ»។
វាស់ដោយ handler ពិត (`fn.handler`) + ZTO ក្លែង · App ពិតក្នុង vitest · CI ៤ ផ្នែក។ ផ្លូវ Palm មិនប៉ះ Cookie Blob ទេ (Login + Lookup ➜ ការហៅ Blob ០)។
អ្នកយាមថ្មី ១១ (server) + ១០ (App) ធ្លាក់លើកូដមុនកែ ➜ ជាប់ក្រោយកែ។ ផ្ទៀងភាពដូចគ្នា ៖ env = តម្លៃសោដើម ➜ password AES និង `x-sign` ស្មើ oracle Java របស់ PR។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A163 | **ផ្លូវ Palm រំលង `ZTO_DETAIL_IDENTITY=require` និង `ZTO_DETAIL_BRANCH_PATHS`** | Argus 401 `ZTO_IDENTITY_REQUIRED` · Palm 200 មានលេខទូរស័ព្ទ | Palm ប្រើ `detailAccessFor()` · `detailResponseBody()` ដូច `/detail` · Login ត្រូវការគណនីពេល `require` · App ផ្ញើ `X-Zoe-Id-Token` ជាមួយ Login |
| A164 | **សោ protocol ZTO Palm (`SIGN_KEY` · `PASSWORD_KEY`) សរសេរក្នុងកូដ** (repo ចាត់ទុកជាសាធារណៈ) | `security-guard-test` មិនចាប់ | អានតែពី env `ZTO_PALM_SIGN_KEY` · `ZTO_PALM_PASSWORD_KEY` · ខ្វះ ➜ 503 `ZTO_PALM_NOT_CONFIGURED` + `reason` មុនផ្ញើអ្វីទៅ ZTO · tests ប្រើសោសិប្បនិម្មិត + oracle `openssl` |
| A165 | **COD/DOD ៖ Palm អាន `cod`/`dod` មុន `agentAmount`/`fcAmount`** (ផ្ទុយ Argus) · boolean/អវិជ្ជមាន ➜ lookup ទាំងមូល 502 | `cod:0, agentAmount:4.5` ➜ COD 0 | `pickNumber()` + `config.codPaths`/`dodPaths` របស់ Argus ➜ 4.5 · អវិជ្ជមាន ➜ 0 · មិនមែនលេខ ➜ រំលង |
| A166 | billCode ZTO អក្សរធំ · ស្កេនអក្សរតូច ➜ 502 | `khab123456` ទល់ `KHAB123456` | ប្រៀបដោយមិនខ្វល់អក្សរធំតូច (trim) |
| A167 | កូដ ZTO ដែលមិនស្គាល់ ➜ 502 ទទេ · Login `status:false` គ្រប់ហេតុ ➜ «ពាក្យសម្ងាត់ខុស» | `TOKEN_EXPIRE` · `VERSION_TOO_LOW` | `reason: palm:<code>` (តួអក្សរសុវត្ថិភាព) ➜ App បង្ហាញ · ⛔ មិនទាយកូដ |
| A168 | preflight Palm (APK) អាន Cookie Argus ពី Blobs (`prewarmCookieCredential`) | OPTIONS ➜ `getStore` + read | `isPalmPreflight()` (query `palm` ឬ header `x-zoe-palm-token`) ➜ រំលង · preflight Argus នៅអានដដែល |
| A169 | ពេលរង់ចាំ ZTO Palm ១០ វិ. ថេរ (លើសថវិកា `ZTO_REQUEST_BUDGET_MS` · ប៊ូតុង 🧪 ១១ វិ.) | ព្យួរ ➜ 504 នៅ ១០ វិ. | `upstreamMs()` = min(`upstreamTimeoutMs`, ថវិកាដែលនៅសល់) |
| A170 | App ៖ អ្នកសម្រេចពីរ (`provider` ទល់ URL `palm=1`) · ឈ្មោះគណនី Palm ក្នុង localStorage · សារ «កំពុងចូល…» ជាប់ · 🩺 session ផុត ➜ ❌ HTTP 401 | config URL Palm គ្មាន `provider` ➜ auto-close/status sweep នៅបើក | `lookupApiIsPalm()` តែមួយ · `palmAccount` = សាខាតែប៉ុណ្ណោះ · `dropped()` · `healthPalmLookupRow()` + ជំហាន 💡 env Palm |
| A171 | **checker ក្រហម ១៣ ក្នុង CI** (sandbox lookup ខ្វះ `lookupApiIsPalm` · `phone-search-swipe` បង្អួច ២០០ តួ · `clear-history-claim-test` កាត់តាមលំដាប់ម៉ូឌុល · ឯកសារថ្មីគ្មាន mapping · ប្រអប់វាយក្នុង `<details>` បិទ focus មិនបាន) | CI ៤ ផ្នែក | ចាក់ helper ពិតចូល sandbox · `clear-history-claim-test` អានម៉ូឌុលពី `audit-module-views.json` · mapping ៥ · `modal-keyboard*` បើក `<details>` ក្នុង `.modal` មុនវាស់ (ប្រអប់វាយ Palm ត្រូវវាស់ដូចគេ) |
| A172 | ព្រំដែនដែលកត់ (មិនកែ) | — | Server គ្មានបញ្ជី session ➜ «ផ្តាច់ Palm» លុបតែក្នុងឧបករណ៍ (session ដែលចម្លងរួចផុតក្នុង ៨ ម៉ោង · ប្តូរ `ZTO_PALM_SESSION_SECRET` ឈប់ទាំងអស់) · របៀប Palm មិនបិទកញ្ចប់តាម ZTO ➜ ព្រមានក្នុងផ្ទាំង · `guide.html` · ZTO អាចអនុញ្ញាត session មួយក្នុងមួយគណនី (មិនទាន់វាស់ជាមួយ ZTO ពិត) |

### 2026-10-16 — Audit ZTO ទាំងមូល (សំណើម្ចាស់គម្រោង) ៖ គម្រោងតែមួយ សាខាច្រើន ➜ ការអានបញ្ជីចុះហត្ថលេខារបស់សាខាមួយដោះការរង់ចាំ ៨ ថ្ងៃទូទាំងហាង (ZTO-E14 · កែ Function)

សំណើ ៖ «audit ផ្នែក ZTO ទាំងមូល» (Function · App · ឧបករណ៍ Cookie Sync · តំបន់ចាក់សោ ➜ អ្នកយាមមុន · សួរម្ចាស់គម្រោងមុនកែ) ➜ ZTO-E14 ➜ ម្ចាស់គម្រោងជ្រើស
«(ក) កែ Function» ➜ កែតែ `ZoeW/netlify/functions/zto-order-detail.js` (កូដ server ➜ មិនមែនកូដ ship ➜ គ្មានការឡើងកំណែ · `CLAUDE.md` ជួរ «Versions») ·
`LOCK` ធ្វើបច្ចុប្បន្នភាព (តែ Function · ឯកសារ App ក្នុងតំបន់ចាក់សោមិនប្រែ)។ **សកម្មភាពដោយដៃ** ៖ គ្មាន (Netlify deploy Function ពេល merge · env មិនប្រែ) ·
គម្រោងដែលចងសាខា N ➜ ការអានចុះហត្ថលេខាជុំបិទតាម ZTO ហៅ ZTO N ដង ក្នុងការហៅ Function ដដែល (ចំនួន Netlify invocation មិនប្រែ)។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A161 | **ZTO-E14 ៖ គម្រោង Firebase មួយចងសាខាច្រើន (`FIREBASE_PROJECT_IDS=zoew-v1:101\|102` — `ZTO-SETUP-KH.md` ផ្នែក ៤គ គាំទ្រ) ➜ ការរង់ចាំ ៨ ថ្ងៃលែងការពារកញ្ចប់សាខាផ្សេង** | ប្រវត្តិតែមួយកាន់កញ្ចប់សាខាទាំង ២ · Function អានបញ្ជី «ចុះហត្ថលេខា» តែសាខារបស់គណនី (`scanSiteCode` ពី email) · `closeZtoSignedBarcodes()` ចាត់ «ពេញលេញ» (`ztoSignedCompleteAt` + សញ្ញាហាង `completeAt`) ពេលគ្មានកញ្ចប់បើកណាក្នុងបញ្ជី **សាខាខ្លួន** នៅរង់ចាំ ➜ `ztoAbandonCleanupIsHeld()` ដោះ (ឧបករណ៍នេះ និងឧបករណ៍គ្មាន ZTO តាមសញ្ញាហាង) ➜ `abandon` ដកលុយកញ្ចប់សាខា 102 ដែល ZTO ចុះហត្ថលេខារួច ខណៈឧបករណ៍ 102 មិនទាន់អាន (ឧ. បិទចុងសប្តាហ៍)។ វាស់ (vitest ៖ Function ពិត + client ពិត + ZTO ក្លែង + ID token ចុះហត្ថលេខាពិត) ៖ កញ្ចប់ ១ · `ZTO_DETAIL_IDENTITY` `require`/`optional` + `ZTO_DETAIL_BRANCH_PATHS` ➜ `/detail` ឆ្លើយ `ZTO_OTHER_BRANCH` ➜ **ដកលុយ** (FAIL) · `off` (production បច្ចុប្បន្ន) ➜ `/detail` បិទវាក្នុងជុំដដែល · កញ្ចប់ ១៥ · `off` ➜ `/detail` បិទ ១០ (`ZTO_STATUS_SWEEP_BATCH`) · **ដកលុយ ៥** · ទិសផ្ទុយ ៖ គម្រោងសាខាតែមួយ · កញ្ចប់សាខាខ្លួនឯង ➜ បិទ «យករួច» (PASS) · ហាង Supabase (១ ហាង = ១ សាខា) មិនរងផល | ម្ចាស់គម្រោង ៖ «(ក) កែ Function» ➜ អ្នកយាមមុន `ZoeW/tests/zto-multibranch-signed-hold.test.tsx` (លើ Function មុនកែ ៖ **FAIL ២/៦** ៖ សាខាផ្សេងដកលុយ · សាខាមួយ 503 ក៏ «ពេញលេញ») ➜ `listSignedBranchSites()` + `mergeSignedBranches()` ៖ `signed=1&exact=1` របស់គម្រោងដែលចងសាខា ≥ ២ អានបញ្ជីចុះហត្ថលេខាគ្រប់សាខាដែលចងស្របគ្នា (single-flight · ថវិកាដដែល · 401 ➜ រត់ឡើងវិញជាមួយ Cookie ថ្មី) ➜ សាខាណាមួយបរាជ័យ ➜ ចម្លើយបរាជ័យ (មិន cache · client backoff · មិនពេញលេញ) · cache key `\|B<សាខា>` · បញ្ជីមកដល់ និង `withSigned` នៅសាខាគណនី ➜ ក្រោយកែ **PASS ៦/៦** · vitest ZTO ២៦ ឯកសារ ៣០៩ តេស្ត PASS · checker ZTO ១១ PASS · run-all STRICT ពេញ (emulator · Postgres) ៖ PASS ២១០ · FAIL ២ (`doc-scope-test` ៖ លិបិក្រម 🔎 ខ្វះអ្នកយាមថ្មី ➜ បន្ថែម · `layout-check` អស់ពិដាន ៣០០ វិ. ក្រោម ៤ lane គ្មាន assertion ធ្លាក់) ➜ រត់ម្តងទៀត PASS ២/២ (`layout-check` ១៧១ វិ.) |
| A162 | **Audit ZTO ៖ ផ្លូវដែលវាស់/អានហើយមិនឃើញចន្លោះថ្មី** | `RUNALL_ONLY` checker ZTO ១១ ➜ PASS ១១ (មិនពេញលេញ · គ្មាន emulator) · អាន `handleRequest()` · identity Firebase/Supabase · cache/single-flight (ការផ្ទៀងសាខាលើ cache hit និងអ្នកចូលរួម single-flight ក្នុងមួយសំណើ) · ថវិកា (certs · Cookie · upstream · retry 401 · companion ក្នុងពិដាន) · `fetchZtoListAllPages()` · `fetchZtoSignedCodes()`/`fetchZtoSignedPages()` (`pagesUnknown` · ការបំបែកតាមថ្ងៃ) · `ztoSignedSweepRange()` (`ZTO_SIGNED_SWEEP_RECENT_MS` ១២ ម៉ោង ≤ ២៤ ម៉ោង ➜ ជួរ «ម្សិលមិញ ➜ ថ្ងៃនេះ» គ្របចន្លោះអានគ្រប់ពេល) · `ztoIdentityTargetTrusted()` (origin · មិនមែន path · `{barcode}` encode) | ព្រំដែនដែលកត់ (មិនកែ) ៖ ZTO ឆ្លើយលើស `LIST_ROW_MAX` (២០០) ក្នុងមួយទំព័រ ➜ កាត់ស្ងាត់ (`pageSize` ≤ ១០០ ➜ តែពេល ZTO មិនអើពើ `pageSize`) · Termux `adb forward tcp:9222` បើកតែក្នុងពេលចាប់ Cookie (`127.0.0.1` លើទូរស័ព្ទ) · `?diag=1` `access.branch.seen` បង្ហាញលេខសាខា ≤ ៨ ដល់អ្នកមាន proxy key (មិនមែន secret) |
### 2026-10-16 — [2.50.96] ៖ កែតម្លៃកញ្ចប់បិទ ➜ «ចំណូលយករួច» តាមថ្ងៃ (បន្តពី A156)

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A160 | **កែតម្លៃកញ្ចប់បិទ ➜ `runTransaction` លើ root `zoew_daily_collected_cod_dod` ទាំងមូល (៧ ថ្ងៃ)** | SDK Firebase ពិត + RTDB emulator (proxy TCP រាប់បៃ · ឧបករណ៍ A កែ · B ស្តាប់ root) ៖ root ៧ ថ្ងៃ × ១០០ / ១០០០ / ៤០០០ key (JSON ២៦ KB · ២៥៩ KB · ១.០៤ MB) ➜ A ផ្ញើឡើង ២៦ KB · ២៥៩ KB · ១.០៤ MB ទាញមកវិញ ២ ដង (៥២ KB · ៥១៨ KB · ២.០៧ MB) · **B ទាញ root ទាំងមូលម្តងទៀត** (២៦ KB · ២៥៩ KB · ១.០៤ MB) រាល់ការកែតម្លៃមួយ · transaction លើ `<ថ្ងៃ>/<key>` ៖ ឡើង ១៦២ · ចុះ ១៧៤ · B ១១៤ បៃ (ថេរ) · Supabase (adapter ពិត) ៖ CAS root = op មួយ `x` + `v` = root ✕ ២ (៥៣២ KB នៅ ១០០០/ថ្ងៃ · Postgres ពិត CAS root ៣២០០០ key ៥៦៧៦ms ៖ A156) | ✅ [2.50.96] ៖ transaction តាម leaf `<ថ្ងៃ>/<key>` (ថ្ងៃក្នុងទិដ្ឋភាព + ៧ ថ្ងៃ + ថ្ងៃបិទ · គ្មាន ➜ `null` ឲ្យ server សម្រេច) ➜ ការកែតម្លៃមួយលើ root ៧ × ១០០០ ៖ Firebase ≈ ៣៣០ បៃ · Supabase ≈ ៦៦០ បៃ ឡើង (ក្លែង) · អ្នកយាម `ZoeW/tests/collected-price-day-scope.test.ts` (មុនកែ ធ្លាក់ ៦ · ន័យ ១០ ឆ្លងទាំងមុននិងក្រោយ) · `daily-collected-test` fake ស្មើ RTDB (null លើផ្លូវគ្មាន = គ្មានប្រែ) · `emu/restore-mutation` gate ទប់គ្រប់ការសរសេរក្រោម root collected (CI ផ្នែក 3/4 លើ `73746dc` ៖ gate ស្មើ root ➜ timeout) |

### 2026-10-16 — សំណើម្ចាស់គម្រោង ៖ រៀបចំ `CLAUDE.md` · `HISTORY.md` ឲ្យមានសណ្តាប់ធ្នាប់ · ការពារការសរសេរស្ទួន · សម្អាតឯកសារចាស់

សំណើ ៖ «ចាំពេលការងារចប់ សូមរៀបចំ ឯកសារ CLAUDE.md HISTORY.md អោយមានសន្តាប់ធ្នាប់ និងការពារការសរសេរស្ទួន និង cleanup ឯកសារចាស់ចាស់ដែលមិនប្រើ»។
ជុំឯកសារ + `audit-tools/` តែប៉ុណ្ណោះ ➜ គ្មានការឡើងកំណែ (`CLAUDE.md` ច្បាប់ ៨)។

- **វាស់មុនរៀបចំ** (`56a3709`) ៖ «📌» ២០៨ បន្ទាត់ (ខ្សែ branch/PR ចាស់ · ធាតុ ⏳ ដែលម្ចាស់គម្រោងបញ្ជាក់រួច) · ផ្នែក ១ មាន ១២១ កំណែ (`2.43.0` ➜ `2.50.94`) ·
  ផ្នែក ២ ផ្នែកតាមកាលបរិច្ឆេទមិនតាមលំដាប់ (`2026-10-04` ក្រោយ `2026-10-03`) + ២៤ ផ្នែកគ្មានកាលបរិច្ឆេទនៅចុង · ជួរ A135 ➜ A159 (2026-10-16) នៅក្នុងតារាង
  2026-10-15 · លិបិក្រមមិនតម្រៀប · `CLAUDE.md` ច្បាប់ ZTO ដដែលសរសេរ ២ កន្លែង (ជួរតារាងស្នូល + ផ្នែក «ZTO status») · តារាង Map ខ្វះ ៤ ផ្នែក និងមិនតាមលំដាប់ឯកសារ ·
  `ZoeW/docs/MIGRATION.md` (ផែនការផ្ទេរទៅ React ដែលបញ្ចប់រួច) ។ ឯកសារ `.md` ផ្សេងទៀតគ្មានឯកសារស្លាប់ (README ទាំងអស់ដេរីវេពីថតពិត)។
- **អ្នកយាមមុន** (`doc-scope-test` ផ្នែក ៨ ៖ ក្បាលកំណែ `### [X.Y.Z]` មួយក្នុងមួយកំណែ និងលេខ `A<n>` មួយក្នុងមួយការរកឃើញ ក្នុងឯកសារប្រវត្តិទាំង ២ ·
  ផ្នែក ១ កំណែថ្មីនៅលើ · ផ្នែក ២ កាលបរិច្ឆេទថ្មីនៅលើ · «📌» ≤ ៨០ បន្ទាត់ · `CLAUDE.md` គ្មានឃ្លា ១០ ពាក្យ (≥ ៦០ តួ) ដដែលលើ ២ បន្ទាត់ · លិបិក្រមតារាងតែមួយតម្រៀប ·
  probe ទិសទាំង ២) ➜ លើឯកសារ `56a3709` **FAIL ៤** (លំដាប់កាលបរិច្ឆេទ · «📌» ២០៨ · ឃ្លា ZTO បន្ទាត់ ៣២៦/៣៧៤ · លិបិក្រម ៣៨៥ ជួរមិនតម្រៀប) ➜ ក្រោយរៀបចំ **PASS**។
- **រៀបចំ** ៖ «📌» សរសេរឡើងវិញ ៤២ បន្ទាត់ (តែការងារបើក · Handoff · ⏳ [2.50.94] · សកម្មភាពដោយដៃបើក · ការសម្រេចដែលនៅរស់) · ផ្នែក ១ `2.43.0` ➜ `2.49.6`
  (២៤ កំណែ · merge រួច) និង ២៤ ផ្នែកគ្មានកាលបរិច្ឆេទ ➜ `HISTORY-ARCHIVE.md` **ផ្នែក ៧** (សម័យ React ដំបូង) · ផ្នែក ២ តម្រៀបតាមកាលបរិច្ឆេទ (ថ្មីនៅលើ · ១១៦ ផ្នែក) ·
  ជួរ A135 ➜ A159 ផ្លាស់ទៅផ្នែក «2026-10-16 — ជុំ 2.50.83 ➜ 2.50.94» · លិបិក្រមបង្កើតឡើងវិញ (ដេរីវេ · តម្រៀប) · `HISTORY.md` ៧៩០១ ➜ ៥៨២៩ បន្ទាត់ · `HISTORY-ARCHIVE.md` ២៤០៥៥ ➜ ២៥៩៨៨។
  `CLAUDE.md` ៖ ជួរ ZTO ក្នុងតារាងស្នូលយោងផ្នែក ZTO (មិនចម្លង) · Map តាមលំដាប់ឯកសារ (+ What the system is · Accepted by design · Rules carried · References) ·
  ច្បាប់ ១២ + ជួរ «Document scope» បន្ថែមច្បាប់គ្មានការសរសេរស្ទួន។ `ZoeW/docs/MIGRATION.md` លុប ➜ ខ្លឹមសារដែលនៅប្រើ (deploy preview · ឧបករណ៍ពិត · origin ផ្សេង +
  កៅអី Activate · ការថយក្រោយ · Service Worker · rules មិន deploy ដោយខ្លួនឯង) ➜ `ZoeW/docs/DEVELOPMENT.md` «Deploy preview · ឧបករណ៍ពិត · ការថយក្រោយ» ·
  តំណ ២ ក្នុង archive ➜ អត្ថបទធម្មតា · `repository-file-coverage.json` ដកធាតុ។
- ⛔ ប្រវត្តិមិនត្រូវសរសេរឡើងវិញ ៖ ផ្នែកដែលផ្លាស់ទៅ archive ចម្លងពាក្យដដែល (គ្មានការកែខ្លឹមសារ) · ផ្នែក ១ · ២ នៅសល់មិនកែខ្លឹមសារ។

### 2026-10-16 — ជុំ 2.50.83 ➜ 2.50.94 ៖ iPhone keyboard · ZTO · 🩺 · audit សុវត្ថិភាព · Supabase ចំណាយលីនេអ៊ែរ

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A135 | **iPhone ៖ ទំព័រធ្លាក់ម្តងម្កាល ក្រោយចុចកន្លែងវាយ Barcode (រាយការណ៍ម្ចាស់គម្រោងលើ 2.50.82)** | Chromium គ្មាន WebKit ➜ ការសាក (គ) ជាប់ទាំងអស់ · អានកូដ (មិនមែនភស្តុតាង) ៖ ផ្លូវដែលការចុចទៅ iOS ដើម ៖ អូស > `MODAL_TAP_SLOP_PX` ឬចុចយូរ > `MODAL_TAP_MAX_MS` ដែល UIKit នៅរាប់ជាការចុច · ចុចម្តងទៀតលើប្រអប់ដែល focus រួច ក្រោយ keyboard បិទ (`modalTapFocused`) · `modalFocusRefused` · ការប៉ាន់ «keyboard នឹងបាំង» (`pageFieldStaysAboveKeyboard()`) | វាស់លើឧបករណ៍ពិត ៖ `iosPageTap` (ផ្លូវ + លេខ ➜ Sentry ពេលទំព័ររំកិលក្នុង `PAGE_TAP_PROBE_MS` គ្មានម្រាមដៃ) ➜ ⚠️ ចាំទិន្នន័យ ➜ កែតែផ្លូវដែលវាស់ឃើញ (អ្នកយាមមុនកែ) |
| A136 | **iPhone ៖ ផ្ទាំងកន្ត្រាក់ពេល keyboard លោតឡើង (2.50.82 production)** | ម្ចាស់គម្រោង ៖ iPhone · ពេល keyboard លោតឡើង · មុន merge (គ្មានចលនា) មិនអីទេ · Android រលូន · keyboard iOS ប្រាប់កម្ពស់ច្រើនដងពេលលោត (លោតហួស ហើយស្ងប់ ៖ ការចាំ keyboard ធ្លាប់ឃើញ) ➜ `glideModalCard()` ចាប់ផ្តើមម្តងហើយម្តងទៀត · ចលនាឡើងលើស ហើយចុះ | ចលនាតែលើ Android (`isAndroidDevice()`) ➜ iOS ភ្លាមដូចមុន · `modal-keyboard-device-test` (ឆ) iPhone · iPad ➜ ភ្លាម ➜ ✅ |
| A137 | **iPhone ៖ ទំព័រធ្លាក់ក្រោយចុចកន្លែងវាយ Barcode (Sentry JAVASCRIPT-REACT-K)** | `iosPageTap caught document` ៖ dx ០ · dy ០ · ៥៩ms · មិន focus · គ្មាន keyboard · ប្រអប់ ៣៣៨–៣៦៨ លើ ៨៤៤ (keyboard ដែលចាំ ៤០៣ ➜ បន្ទាត់ ៤៤១ ៖ ចាប់) ➜ document scrollY ២៣០ · visual viewport offsetTop ២៧៧ · គ្មានម្រាមដៃ ➜ WebKit រំកិលទោះ `focus({ preventScroll })` (ប្រភព WebKit trunk ៖ `_zoomToRevealFocusedElement` គោរព `preventScroll` ➜ ផ្លូវផ្សេង · មិនទាន់ដឹងច្បាស់) | ក្រោយការចុចដែលចាប់បាន ខណៈប្រអប់នៅ focus ៖ document រំកិល ➜ `scrollWindowToTop()` (`restorePageFieldScroll()`) · `iosPageTap` នៅវាស់ ➜ ⚠️ ចាំម្ចាស់គម្រោងសាក |
| A138 | **Sentry Session Replay នៅថត (ផ្ទុយច្បាប់ «Secret leaks»)** | `search_replays` ៖ replay ២០ ក្នុង ៣០ ថ្ងៃ (ZoeW 2.50.53 ➜ 2.50.82 · APK · iPhone · ZoeKeyGen) ទោះ `guardedOptions()` ដាក់ `replaysSessionSampleRate` · `replaysOnErrorSampleRate` = ០ · `environment` · `release` របស់ App ក្នុង replay ➜ options របស់ App ចូល ប៉ុន្តែ Replay នៅដំណើរការ (ប្រហែល Loader Script ក្នុង Sentry UI បើក Replay) | ⚠️ មិនទាន់កែ ៖ ចាំម្ចាស់គម្រោងសម្រេច (បិទ Replay ក្នុង Sentry ➜ Settings ➜ Loader Script · ឬអ្នកយាមថ្មី + កូដ) |
| A139 | **iPhone ៖ ចុច ∨/∧ លើ keyboard ➜ ទំព័រលោត (preview 2.50.83 · ទំព័រស្កេន · ផ្ទាំងលេខទូរស័ព្ទ/COD · ផ្ទាំងផ្សេង)** | ប្រភព WebKit trunk ៖ `accessoryTab:` ➜ `WebPage::focusNextFocusedElement()` ➜ `element->focus()` (គ្មាន `FocusOptions`) ➜ `PendingFocusedElementUpdate.options.preventScroll` = false ➜ `_zoomToRevealFocusedElement` (`forceScroll:[self requiresAccessoryView]` ៖ iPhone រំកិលជានិច្ច) · ព្រឹត្តិការណ៍ `focus` រត់មុនជូនដំណឹង client (`DispatchFocusEventBeforeNotifyingClient`) · `focus()` លើធាតុដែល focus រួច ➜ `elementDidRefocus` ➜ ក្លាយជាព័ត៌មាន ហើយការជូនដំណឹងដើមត្រូវបោះចោល (`m_focusedElement == element` · keyboard បង្ហាញ) · `focusin` រត់ក្រោយការជូនដំណឹង ➜ គ្មានឥទ្ធិពល | `keepKeyboardFocusInPlace()` (`focus` capture · keyboard បង្ហាញ · គ្មានម្រាមដៃ · គ្មានការលែងដៃក្នុង `NATIVE_TAP_FOCUS_MS` · ប្រអប់នៅមើលឃើញ) ➜ `focus({ preventScroll })` · អ្នកយាម vitest + `modal-keyboard-device-test` (ជ) ➜ ✅ (⚠️ ចាំម្ចាស់គម្រោងសាក) |
| A140 | **iPhone ៖ ចលនាផ្ទាំងតាម keyboard (សំណើ «ios មិនអាចដាក់ចលនា រអិលដូច android បានទេឬ?»)** | A136 ៖ ចលនាតាមកម្ពស់នីមួយៗ ➜ កន្ត្រាក់ · `modal-keyboard-device-test` (ឈ) ៖ ចុច + លោតហួស ➜ ស្ងប់ ៖ 2.50.83 (ភ្លាម) ក៏ឡើងហួស ហើយចុះ (`back` ១ · `over` ៥) · 2.50.82 (រអិលគ្រប់កម្ពស់) `back` ៣–៨ · `over` ៩–១៣ | ផ្លូវ iOS ដាច់ពី Android (`iosModalKeyboardViewport()`) ៖ ការរំពឹងកម្ពស់ពីការចាំពេលចុច/ប្តូរប្រអប់ (`forecastModalKeyboard()`) · គ្មានការរំពឹង ➜ កម្ពស់ដំបូង · កម្ពស់ចន្លោះរំលងរហូតស្ងប់ `IOS_KEYBOARD_SETTLE_MS` · Done ➜ ចុះភ្លាម · keyboard មិនលោតក្នុង `IOS_KEYBOARD_FORECAST_MS` ➜ ត្រឡប់ ហើយឈប់រំពឹង ➜ ✅ (⚠️ ចាំម្ចាស់គម្រោងសាក ៖ ការរាយការណ៍កម្ពស់ពិតរបស់ iOS មិនអាចវាស់នៅទីនេះ) |
| A141 | **preview មិនផ្ញើ Sentry** | `search_errors` ៖ គ្មានព្រឹត្តិការណ៍ `deploy-preview` ក្នុង ៣០ ថ្ងៃ · `find_dropped_events` (១៤ ថ្ងៃ) ៖ គ្មាន `invalid`/`filtered` នៅ server (តែ `client_discard` ៥) · កូដ App មិនបិទ Sentry តាម host ➜ ទំនង Allowed Domains/Loader នៃគម្រោង Sentry · ព្រឹត្តិការណ៍ A137 ៖ `scrollY` ២៣០ · `offsetTop` ២៧៧ ដោយគ្មាន `_zoomToRevealFocusedElement` (preventScroll) ➜ ផ្លូវផ្សេង (`_scrollToAndRevealSelectionIfNeeded` ពេល keyboard ប្តូរកម្ពស់ · UIKit `_adjustForAutomaticKeyboardInfo`) មិនទាន់ដឹង | `iosPageTap` បន្ថែម `afterMs` · `viewportHeight` · `docHeight` · `stillFocused` ➜ ⚠️ ចាំទិន្នន័យ (production ក្រោយ merge ឬ Allowed Domains) ➜ កែតែផ្លូវដែលវាស់ឃើញ |
| A142 | **ពិនិត្យកូដ 2.50.84 ៖ focus ពីប្រអប់វាយទៅ select · date ក្នុងផ្ទាំង iPhone** | `noteIOSFieldBlur()` ប្រើ `textEntryField(e.relatedTarget)` ➜ select/date (កង់ជ្រើសនៅកន្លែង keyboard · `requiresAccessoryView`) រាប់ជា «keyboard បិទ» ➜ `iosClosing` ➜ ផ្ទាំងចុះក្រោមកង់ · `noteIOSFieldFocus()` មិនលុប `iosClosing` ពេល focus select · `keepKeyboardFocusInPlace()` មិនគ្រប select (∨ ទៅ select ➜ `_zoomToRevealFocusedElement`) · តេស្ត happy-dom ៖ `<select>` ជា Proxy ➜ `this` ≠ `document.activeElement` (គំរូ WebKit ប្រៀបធៀបតាម id) | `inputViewField()` (ប្រអប់វាយ · select · date/time) សម្រាប់ focus · blur · ∨/∧ ➜ 2.50.85 · វាស់ក្នុង vitest តែប៉ុណ្ណោះ (ផ្ទាំងពិតដែលមានប្រអប់វាយ + select មើលឃើញព្រមគ្នាពេលបើក ៖ គ្មាន ➜ device-test មិនមានគោល) |
| A143 | **iPhone ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័រលោតចុះ ហើយរអិលត្រឡប់ (វីដេអូ preview 2.50.85)** | វីដេអូ ៣០ រូប/វិ ៖ logo navbar ១៥១px ➜ ១៤៦ (iOS ចាប់ផ្តើមរំកិលឡើង) ➜ ៤៣៤ · ៥៩០ · ៥៨៨ (ចុះ ១៣៨ · ២១៤ · ២១៣pt) ➜ ត្រឡប់ក្នុង ២០០–២៤០ms · ចំនួនស្មើ `_zoomToFocusRect` ដាក់ប្រអប់នៅកណ្តាលផ្ទៃពីលើ keyboard (របៀបបញ្ចូល ≈ ១៤៧ · ដក ≈ ២១៥) ➜ preventScroll បាត់ · ប្រភព WebKit ៖ `FocusController::setFocusedElement` លើធាតុដែល focus រួច ➜ `elementDidRefocus` (ជម្រើស click) ➜ `WebPage::elementDidFocus` សរសេរជាន់ព័ត៌មានរង់ចាំ ពេល `!m_isShowingInputViewForFocusedElement` ➜ `completeSyntheticClick` flush · ការទាញ ០ របស់ App (`restorePageFieldScroll`) ពេលចលនា keyboard (additive) រត់ ➜ ចុះ ហើយត្រឡប់ · `pageFieldCaught` នៅជាប់ក្រោយ blur ➜ focus ក្រោយក៏ត្រូវទាញ | `swallowCaughtClick()` (`mousedown` · `click` នៃការចុចដែលចាប់ · `CAUGHT_CLICK_MS` · ប្រអប់/ស្លាក/⚡ តែប៉ុណ្ណោះ) · `forgetPageFieldCaught()` ➜ 2.50.86 · ⚠️ ផ្លូវផ្សេងទៀតដែល iOS អាច focus (text interaction `focusTextInputContextAndPlaceCaret`) មិនទាន់វាស់ ➜ `iosPageTap` Sentry ក្រោយ merge |
| A144 | **preview 2.50.86 នៅតែធ្លាក់ · សំណើ «clean up · សរសេរថ្មី · ឆ្លាតវៃដូច Android»** | ទំព័រចុះក្រោមកម្ពស់ធម្មតា (logo ១៥១ ➜ ៤៣៤–៥៩០px) មានតែពេល model `scrollTo(0, 0)` កាត់ចលនា UIKit (additive ៖ A47) ➜ ទាមទារការទាញរបស់ App · `boot.ts` ៖ `visualViewport` `resize` ➜ `scrollWindowToTop` គ្រប់ឧបករណ៍ (រត់ពេល keyboard ចាប់ផ្តើមលោត) · `restorePageFieldScroll` (2.50.83) · «ដូច Android» (`interactive-widget=resizes-content`) ៖ WebKit trunk `MetaViewportInteractiveWidgetEnabled` (Cocoa true) តែ Safari មិនទាន់ចេញ (bram.us · MDN bcd #29011) ➜ មិនអាចប្រើ | iOS standalone «បង្ការ មិនតទល់» ៖ `settleDocumentScroll()` (keyboard បង្ហាញ ➜ មិនទាញ) · ដក `restorePageFieldScroll` · probe `iosPageTap` ➜ 2.50.87 · ⚠️ iOS រំកិលតាមផ្លូវផ្សេងដែលមិនទាន់ដឹង ➜ ឃើញរអិលរលូន (មិនលោត) ➜ ចាំវីដេអូ |
| A145 | **កញ្ចប់បិទក្នុង ZoeW តែ ZTO Palm មិនទាន់បិទ បាត់ពីរបា «ZTO មិនទាន់បិទ» ក្រោយពីរបីម៉ោង** | ការសម្អាត ២ ម៉ោងផ្លាស់កញ្ចប់បិទទៅធុង «យករួច» ➜ `ztoStatusTrashItemCounts()` រាប់ត្រឹម `ZTO_STATUS_TTL_MS` ១២ ម៉ោងក្រោយ `deletedAt` (≈ ១៤ ម៉ោងក្រោយបិទ) · `loadZtoPickupStatusOnce()` បោះសាលក្រមចាស់ជាង ១២ ម៉ោង · `ZTO_STATUS_MAX` ៣០០ < ៣ ថ្ងៃនៃហាងមមាញឹក · តំបន់ចាក់សោ ➜ ប្រែតែតាមសំណើ | ម្ចាស់គម្រោងជ្រើស ៣ ថ្ងៃ ➜ `ZTO_STATUS_TTL_MS` ៣ ថ្ងៃ · `ZTO_STATUS_MAX` ២០០០ · `LOCK` ថ្មី · `zto-remind-days.test.ts` ➜ 2.50.89 · ZoeW ពិនិត្យ ZTO តែពេល App បើក (គ្មាន server sweep) |
| A146 | **iPhone ស្កេនដក ៖ ចុចកន្លែងវាយ ➜ navbar ចេញ · ចុចស្វែងរក ➜ ប្រអប់ស្វែងរកក្រោមរបាស្ថានភាព (វីដេអូ preview 2.50.89)** | ស៊ុមវីដេអូ ៖ ប្រអប់ចប់ ៤៤៥pt · បន្ទាត់ keyboard ដែលធ្លាប់វាស់ (អង់គ្លេស + របារ ∧∨✓ iOS 26) ខ្ពស់ជាង ➜ `pageFieldStaysAboveKeyboard()` false ➜ ទុកឲ្យ iOS ➜ document រំកិល ១៤៦pt (ប្រអប់កណ្តាល) · ស្វែងរក ➜ `glideEntryPanelCollapsed()` ត្រឹមត្រូវ តែ document នៅរំកិល ➜ ប្រអប់ស្វែងរក ១៥០pt ខ្ពស់ពេក · Android ៖ Chromium រំកិល `#appPages` · Chromium ៖ `#appPages.scrollTop = 18` ពេល snap បើក ➜ ០ · ផ្អាក ➜ ១៨ · បើកវិញ ➜ ០ | iOS < 992px ៖ ចាប់ + `raisePageField()` ក្នុង `#appPages` (snap ផ្អាក · ចុះវិញពេល blur · ស្ងប់ ➜ លើកបន្ថែម) ➜ 2.50.90 · អ្នកយាម `ZoeW/tests/ios-page-field-raise.test.ts` · `modal-keyboard-device-test` (ដ) · ⚠️ browser មិនក្លែងការរំកិល document របស់ iOS ➜ ផ្ទៀងផ្ទាត់លើ iPhone ពិត |
| A147 | **ពិនិត្យសុវត្ថិភាពក្រោយកែផ្ទាំងច្រើនដង ៖ Tab ចេញពីផ្ទាំង PIN · Activate** | probe browser ពិត ៖ ផ្ទាំង PIN ៧ × (ផ្ទៃងងឹត · Escape · ម៉ាស៊ីនស្កេន + Enter/Tab · Tab ×១២ + Enter · PIN ខុស) · Activate (Key ដកហូតពេលកំពុងប្រើ) · ចាក់សោ App ➜ តែ Tab ធ្លាក់ ៖ focus ទៅ `navMenuBtn` · `navNotifyBtn` · `btnFilterToday` · `customDateInput` · ចាក់សោ App ៖ ទំព័រ `visibility: hidden` ➜ គ្មាន · `history.back()` លើ web ➜ ចាកចេញពីទំព័រ (Back ពិត ៖ `native-back`) | `modal-focus-trap.ts` (`focusin` ➜ ត្រឡប់ចូលផ្ទាំងខាងលើ) ➜ 2.50.91 · អ្នកយាម `ZoeW/tests/modal-focus-trap.test.ts` · `modal-keyboard-test` (Tab ផ្ទាំង ៤ ៖ មុនកែ ធ្លាក់ ៤) |
| A148 | **🩺 App ទើបដំឡើង ៖ ប្រាប់តែផ្លូវភ្ជាប់ Firebase ទោះ App គាំទ្រ Server ២ (សំណើម្ចាស់គម្រោង)** | `runHealthCheck()` ពិត គ្មាន `zoew_firebase_config` ៖ ជួរ «Firebase» ❌ «មិនទាន់ភ្ជាប់ម្តងណាទេ» · ជួរអាជ្ញាប័ណ្ណ ❌ «មិនទាន់មាន Activation Key» · 💡 «App មិនដែលភ្ជាប់ Firebase» + «សុំ Key» · Config Supabase ដែល SDK មិនទាន់ផ្ទុក ➜ ជួរ «Firebase» ដដែល (`viewState.backendKind` លំនាំដើម `firebase`) | `healthBackendKind()` ពី Config ដែលរក្សាទុក ➜ ជួរ «Server (Firebase · Supabase)» + 💡 ផ្លូវទាំង ២ · ជួរអាជ្ញាប័ណ្ណ ℹ️ ➜ 2.50.92 · អ្នកយាម `ZoeW/tests/health-no-backend.test.ts` (មុនកែ ធ្លាក់ ៣) · `health-check-test` |
| A149 | **token គណនីហាងទៅ host ណាក៏បាន ដែលផ្លូវដូច Function ZTO (audit សុវត្ថិភាព)** | `lookupApiIsZto()` ពិនិត្យតែផ្លូវ · vitest ពិត ៖ `https://evil.example/.netlify/functions/zto-order-detail` · `https://<ref>.supabase.co/functions/v1/x/.netlify/functions/zto-order-detail` ➜ `X-Zoe-Id-Token` ចេញ · Setup Link lookup-only ជា `official` ជានិច្ច (គ្មានការព្រមាន domain) · CSP web អនុញ្ញាត `*.supabase.co` · APK គ្មាន CSP ➜ Firebase ID token = អាន/សរសេរទិន្នន័យហាងទាំងមូល (rules `auth != null`) | `ztoIdentityTargetTrusted()` ➜ 2.50.93 (ម្ចាស់គម្រោងអនុញ្ញាតតំបន់ចាក់សោ) · អ្នកយាម `ZoeW/tests/zto-token-origin.test.ts` (មុនកែ ធ្លាក់ ៣) |
| A150 | **License ៖ record មិនចងនឹងហត្ថលេខា · អានកៅអីមិនបាន = online ល្អ (audit សុវត្ថិភាព)** | `license-verify.js` ពិតក្នុង vm ៖ record `{ keyString: Key A (Revoke ក៏បាន), id: Key B }` ➜ ពិនិត្យ online លើ B ➜ active ៣០១ ថ្ងៃ + កក់កៅអីលើ Key អ្នកផ្សេង · កៅអី 503 (URL filter) + `lastOnlineCheck` ២០ ថ្ងៃ ➜ active ហើយរំកិល `lastOnlineCheck` (ពិដាន ៣ ថ្ងៃមិនដែលចាប់ផ្តើម) | `sigCheck.payload.id`/`exp` · `seat === 'unknown'` មិនរំកិល ➜ 2.50.93 · ZoeKeyGen 2.24.19 · អ្នកយាម `license-seat-test` ១១ក · ១១ខ (មុនកែ ធ្លាក់ ៤) |
| A151 | **Push ៖ sub កំព្រាក្រោយ index រវល់ ➜ ពេញពិដានគ្រប់ហាង (audit សុវត្ថិភាព)** | `push-core.mjs` ពិត + Blobs ក្លែង ៖ ២០០ subscribe ស្របគ្នា (Key/គណនីពិត ១) ➜ ១៨៩ `sub/` · ១០ ក្នុង index · ១៧៩ កំព្រា (រាប់ក្នុង `PUSH_SUBS_TOTAL_MAX` ៥០០០ · ទទួលដំណឹងគ្រប់ដង · មិនដែលកាត់) | ដក/ស្តារ record ពេល index រវល់ ➜ 2.50.93 (server) · អ្នកយាម `ZoeW/tests/push-server.test.ts` (១២០ ស្របគ្នា ➜ គ្មានកំព្រា) |
| A152 | **CI ៖ keystore ផលិតកម្មអាចប៉ះពី branch ណាក៏បាន (audit សុវត្ថិភាព · តាមការកំណត់)** | `android-release.yml` ៖ `workflow_dispatch` លើ branch ណាក៏រត់ workflow របស់ branch នោះជាមួយ `ZOEW_KEYSTORE_*` · `npm ci` (lifecycle) + Gradle ក្នុង job ដដែល · runner Windows self-hosted មិនមែន ephemeral | ⚠️ សកម្មភាព ៣ របស់ [2.50.93] (GitHub Environment + អ្នកអនុម័ត + តែ `main`) · កូដមិនប្រែ |
| A153 | **ប្រវត្តិ git ៖ លេខទូរស័ព្ទដែលមើលទៅពិត (audit សុវត្ថិភាព)** | clone ពេញ ១៤២៨ commit ៖ លេខ ~១៣ (ឧ. `097415…` ១១៦ ដង · `096389…` ៧៩ ដង) ក្នុង fixture/ឯកសារចាស់ · HEAD ស្អាត (`security-guard-test` បិទផ្លូវថ្មី) · **គ្មាន secret** (token · private key · service account · cookie ពិត) | ⚠️ សកម្មភាព ៤ របស់ [2.50.93] (ម្ចាស់គម្រោងសម្រេច) |
| A154 | **Supabase ៖ ការផ្ទៀងផ្ទាត់ rules ចំណាយការ៉េ ➜ DoS ឆ្លងហាង (audit សុវត្ថិភាព)** | Postgres ពិត ៖ សរសេរ ១ ឯកសារ `zoew_daily_collected_cod_dod` ៤០០០ keys (៩៨ KB) ➜ អស់ ៨ វិ. (`statement_timeout`) · `zoe_snap_val` អានឯកសារទាំងមូលរាល់ leaf · គ្មាន quota/rate ក្នុងហាង · **គ្មានការអាន/សរសេរឆ្លងហាង · គ្មានការឡើងសិទ្ធិ** (RLS · definer · realtime · invite/reset ល្អ) | ✅ [2.50.94] (A156 · A157) ៖ migration `20261016120000_zoe_linear_write.sql` · ពិដាន ៨ MiB/ការសរសេរ · quota ក្នុងហាង · `supabase-datastore-test` ផ្នែក ៣ |
| A155 | **ចំណុចតូច/ការណែនាំ (audit សុវត្ថិភាព)** | `?list=1` Project មិនចងសាខា ជឿអ៊ីមែល (ម្ចាស់គម្រោង ៖ ចង env) · `/detail` `ZTO_DETAIL_IDENTITY=off` លំនាំដើម · cache «រកមិនឃើញ» បត់អក្សរធំ/តូច (≤ ១២០ វិ.) · កូដ Setup Link ៦ ខ្ទង់ (ម្ចាស់គម្រោង ៖ ទុក) · PIN/Signing Key ៖ PBKDF2 salt ថេរ (ត្រូវចូលឧបករណ៍) · APK គ្មាន CSP · កៅអី License ៖ device ID អានបាន (ត្រូវ devtools) · admin Supabase គ្មាន MFA · FileProvider ធំជាងត្រូវការ · APK updater មិនពិនិត្យ cert ផ្ទាល់ (Android ពិនិត្យរួច) | មិនកែក្នុងជុំនេះ — ការសម្រេចម្ចាស់គម្រោង ឬជុំបន្ទាប់ (មើល PR #322) |
| A156 | **Supabase ៖ ចំណាយការ៉េក្នុង `zoe_apply` · rules (A154 ពិនិត្យលម្អិត)** | Postgres 17 ពិត · ហាងមួយ ៖ ប្រភព ៖ `zoe_canon` (`result \|\| jsonb_build_object` មួយៗ) · ctx ផ្ទុក `pre` ចម្លងរាល់ node (`p_ctx \|\| …`) · `zoe_snap_val` អានឯកសារពីតារាងរាល់ leaf · `.validate` កម្រិត root ប្រមូល root ទាំងមូលរាល់ op · `jsonb_set` លើ `work` ទាំងមូលរាល់ op · ផ្លូវជាន់ O(n²)។ មុន ➜ ក្រោយ ៖ update ១០០ ផ្លូវចូលថ្ងៃ ២០០០ key ៨១៦៩ ➜ ៧៤ms · ១ key ចូលថ្ងៃ ២០០០ ១១២ ➜ ២៧ms · ឯកសារ ២០០០ key ២០៤១ ➜ ៣៣៩ms · ៤០០០ key (profile ៖ `zoe_eval` ៦៤០០៨ ➜ ៣៦០០៥ ហៅ) ១១៧១ ➜ ៥២៥ms · reconcile ១៦០ ផ្លូវ root ៣២០០០ key ៤៨៦ms · CAS root ៣២០០០ key ៥៦៧៦ms (នៅជិតពិដាន ៖ ហាង ~៤០០០/ថ្ងៃ កែតម្លៃកញ្ចប់បិទ ➜ `runTransaction` លើ root ទាំងមូលក្នុង App) · ឯកសារ 1 MB (៣០០០០ key · វាយប្រហារ) ៣៩៧៩ms ក្នុង `statement_timeout` (ការសរសេររបស់ហាងមួយរត់ម្តងមួយ ➜ ≤ ១ CPU) · ការសរសេរប៉ះឯកសារ ១០ MB ៣០៣០ms ➜ ពិដាន ៨ MiB | ✅ [2.50.94] · 💡 ជុំក្រោយ (បើហាងធំលើ Supabase) ៖ App `runTransaction` តាមថ្ងៃ ជំនួស root ចំណូលយករួចទាំងមូល |
| A157 | **Postgres 17 ៖ `jsonb_agg` · `jsonb_object_agg` ចំណាយការ៉េតាមទំហំតម្លៃនីមួយៗ ➜ DoS ផ្លូវអាន · ហាងធំទាញពេញមិនរួច** | វាស់ ៖ តម្លៃមួយ ២០០០ · ៨០០០ · ៣២០០០ key ➜ ៥៧ · ៩២៨ · ១៥៩៨៨ms (`jsonb_build_object` · ការបម្លែងតាម text ៖ ២ · ៨ · ៣៨ms / ៣ · ១២ · ៦៩ms) ➜ `zoe_pull`/`zoe_read` ឯកសារ 1 MB ម្តង ≈ ១៦ វិ. (ការអានមិនជាប់ tenant lock ➜ ស្របគ្នាច្រើន CPU) · ហាង ~៤០០០ barcode/ថ្ងៃ (ឯកសារ pickup ប្រចាំថ្ងៃរក្សាទុកជានិច្ច) ៖ ទំព័រ pull ពេញលើស ៨ វិ. ➜ ឧបករណ៍ថ្មីមិនអាចទាញ។ ក្រោយ ៖ `zoe_read` ឯកសារ 1 MB ១២១ms · ឯកសារ ២០០០០ key ២ ៦៦ms · ទាញពេញ ~១២ MB ២ ទំព័រ (យឺតបំផុត < ១ វិ.) | ✅ [2.50.94] ៖ object/array សាងពី text (`zoe_json_object` · `string_agg`) · ទំព័រ `zoe_pull` ≤ 2 MiB |
| A158 | **mutation របស់ `supabase-datastore-test` អាចធ្លាក់លើកូដស្លាប់** | `create or replace` ក្នុង migration ថ្មី ➜ anchor ចាស់នៅលេចម្តង តែប្តូរនិយមន័យដែលត្រូវជំនួស ➜ «មិនចាប់» (ឬ anchor ដូចគ្នា ២ ដង ➜ «ត្រូវលេចម្តង») · `public.zoe_write` ដើមផ្លាស់ទៅ `private` ដោយ `DO` block (ការញែកអត្ថបទមិនឃើញ) | ✅ [2.50.94] ៖ អនុវត្តនៅ occurrence ចុងក្រោយ + digest `pg_get_functiondef` · policy · ACL · trigger ត្រូវប្រែ (mutation ដែលមិនប្រែនិយមន័យរស់ ➜ FAIL) |
| A159 | **`doc-scope-test` ៖ function SQL ដែលហៅតែក្នុង SQL ត្រូវចាត់ថា «លែងមាន» · លិបិក្រមខ្វះផ្នែក ១ របស់ `supabase-data-tools-test`** | run-all STRICT ពេញលើ `56a3709` ➜ ឆ្លង ២១០ · មួយផ្នែក ០ · រំលង ០ · ធ្លាក់ ២ ៖ (១) `doc-scope-test` ៖ `CLAUDE.md` យោង `zoe_merge()` · `zoe_json_object()` ដែលប្រកាសតែក្នុង `supabase/migrations/*.sql` ➜ ការរកការប្រកាសអានតែ JS/shell ➜ «លែងមានក្នុងកូដ» (false positive) · ជួរលិបិក្រម `supabase-data-tools-test` ខ្វះ «ផ្នែក ១» (ឈ្មោះថ្មីក្នុង [2.50.94]) · (២) `ui-flow` ៖ Playwright «Resulting promise was garbage collected» ពេល CPU រវល់ (`toggleCloseStatus` · លំនាំ harness ដដែលនឹងផ្នែក ២ ខាងក្រោម) ➜ រត់ម្នាក់ឯង ៩០/៩០ · រត់ម្តងទៀតក្នុង run-all ➜ ឆ្លង | ការរកការប្រកាសអាន migration **តាមលំដាប់** (`sqlFunctionsAliveIn()` ៖ `create` ➜ រស់ · `drop function x(…)` សម្លាប់តែ arity នោះ · `drop function x` សម្លាប់ទាំងអស់ · បង្កើតឡើងវិញ ➜ រស់) ព្រោះ migration append-only ➜ វត្តមានអក្សរមិនមែនភស្តុតាង · ជាន់ ≥ ១០ migration · ≥ ៤០ function · probe ទិសទាំង ២ · mutation ៖ យោង `zoe_rule_true()` (drop ក្នុង migration ចុងក្រោយ) ➜ **FAIL** «លែងមានក្នុងកូដ ៖ zoe_rule_true» · ស្តារ ➜ PASS ១០១ · លិបិក្រមបង្កើតឡើងវិញ (៣៨៥ ជួរ) |

### 2026-10-15 — សំណើម្ចាស់គម្រោងលើ 2.50.81 (`1529f3e`) ៖ ពិនិត្យការវាស់ keyboard ស្វ័យប្រវត្តិ · iOS ទាញទំព័រម្តងម្កាលក្នុង tab ស្កេន

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A128 | **ពង្រីក (pinch zoom) ➜ App យល់ថាមាន keyboard** | Chromium ពិត 1280×800 · `Emulation.setPageScaleFactor` ១.៦ ៖ `visualViewport.height` ៥០០ / `innerHeight` ៨០០ ➜ `softKeyboardShown()` true · `keyboardCover` ៣០០ · `modalKeyboardFit` · `zoew_keyboard_inset_v1` = `{"1280x800\|number":300}` · ផ្ទាំងលេខទូរស័ព្ទបើក + focus COD ➜ ម៉ាស៊ីនស្កេន `77100000308752` + Enter ➜ COD = Barcode (មិនចូលជួរ · `SCAN_MONEY_MAX` រារាំងការរក្សាទុក ➜ ការស្កេនបាត់) · zoom ១ ➜ ចូលជួរ · iPad (mobile emulation) ៖ meta `user-scalable=no` ➜ Chromium មិន zoom (Safari iOS មិនគោរព meta ➜ ក្លែងក្នុង vitest) · Android ៖ meta ➜ zoom មិនបាន (scale ១) | `visualViewportKeyboardInset()` (`refs.ts`) ៖ `innerHeight − round(height × scale)` · scale តែ > ១ ➜ Android · iPhone ធម្មតា រូបមន្តដដែល · `keyboardVisibleViewport()` · ការចាំ · `iosKeyboardInsetPx()` ប្រើមួយនេះ ➜ ✅ |
| A129 | **iOS ៖ ចុចកន្លែងវាយ Barcode ទំព័រធ្លាក់ម្តងម្កាល (គ្រប់របៀប)** | ផ្លូវដែលរួចពីការចាប់ ៖ (១) ស្លាក `label for="hwScannerInput"` ពីលើប្រអប់ ➜ iOS focus ខ្លួនឯង (ចុចពិត Chromium ៖ touchend មិន preventDefault · focus មិនឆ្លង `focus({ preventScroll })` · iPhone ៨ ករណី) · (២) ⚡ absolute លើប្រអប់ (z-index ១) ➜ ចុចមិនធ្វើអ្វី · (៣) ការចុចរំកិល > `MODAL_TAP_SLOP_PX` ឬយូរជាង `MODAL_TAP_MAX_MS` ➜ iOS (កម្រិតការចុចរបស់ UIKit មិនអាចវាស់នៅទីនេះ) · (៤) focus មិនជាប់ម្តង ➜ `modalFocusRefused` រហូតដល់ reload · (៥) ប្រអប់ focus រួច + ចុចរួច + គ្មាន keyboard ➜ iOS (keyboard អណ្តែត iPad) | (១)(២) ចាប់ដូចប្រអប់តែ iOS (`iosPageTapFieldOf()`) ➜ ✅ · (៣)–(៥) គ្មានភស្តុតាងលើឧបករណ៍ ➜ មិនប្តូរ · បើនៅធ្លាក់ ➜ វីដេអូ |
| A130 | **ការចាំ keyboard ៖ ចំណុចផ្សេងទៀតដែលពិនិត្យ** | ប្តូរភាសា keyboard (ខ្មែរ/អង់គ្លេស) ➜ កម្ពស់ចុងក្រោយដែលស្ងប់ (ម្ចាស់គម្រោង ៖ Android រលូន) · keyboard បិទខណៈប្រអប់នៅ focus (ប៊ូតុងលាក់ keyboard iPad · Gboard) ➜ ព្រឹត្តិការណ៍ពេលបិទអាចចាំតម្លៃពាក់កណ្តាល (បើ WebKit រាយការណ៍រាល់ស៊ុម) · បង្វិលអេក្រង់ខណៈ keyboard បើក ➜ លំដាប់ `resize` WebKit មិនអាចវាស់នៅទីនេះ | មិនប្តូរ (គ្មានភស្តុតាង · Android មិនប៉ះតាមសំណើ) |
| A131 | **Android ៖ ផ្ទាំង keyboard លេខកន្ត្រាក់ (លោតឡើង ហើយត្រឡប់ចុះ)** | វីដេអូម្ចាស់គម្រោង (APK · «កែប្រែ COD, DOD») ស៊ុមដោយស៊ុម ៖ បើកលើកដំបូង កាត ៦២៦ ➜ ១៨៤ នៅដដែល · ក្រោយប្រើ keyboard អក្សរ បើកម្តងទៀត ៖ ៦២៦ ➜ ១៣៩ (keyboard ចាប់ផ្តើម · IME ប្រាប់កម្ពស់ QWERTY ចាស់) ➜ ១៨៤ ពេល hold ចប់ (WebView បង្រួមតាម keyboard លេខពិត · កំពូល keyboard ១៥២១/១៥១៧ ស្មើគ្នាទាំងពីរលើក) · Chromium ពិត (keyboard +៨០ ➜ ពិត) ៖ ១០០ ➜ ១៣៩ · ២១ ➜ ៤០ · ២៤៥ ➜ ២៨៥ · Chrome (ទំព័របង្រួម) ដូចគ្នា | Android ៖ keyboard នៅបើក ➜ កាតមិនចុះ (`androidFitStaysUp()` · `androidHeldFitView()` ៖ APK `keyboardOpen` ឬទំព័របង្រួម `keyboardLayoutShrank()`) ➜ ✅ |
| A132 | **Android ៖ ការចាំ keyboard កត់កម្ពស់ចាស់** | build `178e0a2` ៖ `zoew_keyboard_inset_v1` = `{"412x915\|number":410}` (កម្ពស់ដែល IME ប្រាប់ពេលចាប់ផ្តើម) ជំនួស ៣៣០ (ពិត) ៖ `measureKeyboardCover()` កត់រាល់ `resize` ពេល visualViewport មាន keyboard · APK ក្រោយ WebView បង្រួម (inset ០) មិនកត់ទាល់តែសោះ ➜ Android មិនដែលមានកម្ពស់ពិត · keyboard ក្រុមហ៊ុនផ្សេង · ពង្រីកទំហំ ➜ ដូចគ្នា | Android ៖ `keyboardSession` (កម្ពស់ទំព័រពេញពេល keyboard លេចដំបូង) ➜ កម្ពស់ = ពេញ − ផ្ទៃមើលឃើញ · កត់តែពេលស្ងប់ (`KEYBOARD_SETTLE_MS` ក្រោយបង្រួម · `KEYBOARD_TRUST_MS` visualViewport ក្រៅ APK · ⛔ APK hold) · `learnedKeyboardView()` ដាក់កាតតាមកម្ពស់ដែលចាំ មុនស្ងប់ · iPhone ដូចដើម ➜ ✅ |
| A133 | **ទូរស័ព្ទបង្វិលផ្តេក (សំណើម្ចាស់គម្រោង ៖ ទូរស័ព្ទមិនផ្តេក · tablet ផ្តេកបាន)** | APK ៖ AndroidManifest គ្មាន `screenOrientation` · `MainActivity` មិនស្នើ ➜ បង្វិលតាម sensor · PWA Android ៖ manifest `portrait-primary` ចាក់សោ **tablet ផង** · iPhone/iPad ៖ WebKit មិនគោរព manifest `orientation` ហើយ `screen.orientation.lock()` មិនមាន ➜ ចាក់សោពី web មិនបាន · ប្លង់ទូរស័ព្ទផ្តេក (A124) នៅសម្រាប់ iPhone · Browser tab | APK `orientationFor(smallestScreenWidthDp)` (< ៦០០ ➜ PORTRAIT) · PWA tablet `lock('any')` · iPhone ៖ ម្ចាស់គម្រោងជ្រើស «ទុកដូចសព្វថ្ងៃ» (Control Center · ប្លង់ផ្តេក A124 នៅ · មិនបិទ App ពេលផ្តេក ៖ ស្កេនកាមេរ៉ាទូរស័ព្ទផ្អៀងមិនរំខាន) |
| A134 | **ផ្ទាំងលោតភ្លាមតាម keyboard (សំណើម្ចាស់គម្រោង ៖ ថែមចលនា App ទាំងមូល)** | build `a9d20c6` (Chromium ពិត · ថតរាល់ស៊ុម) ៖ ១៧ ប្រអប់ × ៥ ឧបករណ៍ ➜ កាតផ្លាស់ទីក្នុង ១ ស៊ុម (ស៊ុមកណ្តាល ០ ៖ PIN iPhone ៣១២ ➜ ២៨០ · Chrome ២៥៧ ➜ ១០៧) · ការតម្រូវប្តូរ `margin-top`/`align-items` (CSS transition មិនអាចចាប់ពី `center` ➜ `flex-start` · ទោះបានក៏ layout រាល់ស៊ុម) · APK ៖ keyboard បិទ ➜ WebView ធំឡើង ➜ កាតទៅកណ្តាលថ្មីដោយ layout ផ្ទាល់ (fit បាត់តាំងពី WebView បង្រួម ៖ គ្មានការតម្រូវណាប្តូរ) | FLIP ៖ `glideModalCard()` ចាប់ទីតាំងដែលមើលឃើញ (`modalRest` + offset ចលនា) ➜ `transform` Web Animations (`composite: 'add'` · `MODAL_GLIDE_MS`) · `ResizeObserver` លើកាត (មាតិកា ➜ កត់ភ្លាម) និង `.modal` (Android viewport ➜ រអិល) · visual viewport រំកិល ➜ ទីតាំងលើអេក្រង់ដដែល ➜ គ្មានចលនា ➜ ✅ |

### 2026-10-15 — សំណើម្ចាស់គម្រោងលើ 2.50.81 (`b86ed08`) ៖ «ផ្ទៀងផ្ទាត់ការងារ និង តេស្តឡើងវិញ app ទាំងមូល»

- CI 776 លើ `b86ed08` ៖ ៤/៤ ✅ (CI 775 លើ `42628fc` ត្រូវបោះបង់ដោយ push ថ្មី · ផ្នែក 4/4 ជាប់មុនបោះបង់)។
- ការផ្ទៀងផលប៉ះពាល់ `ada318c..b86ed08` ៖ (១) បន្ទាត់លុប ៖ announcements ថែមក្បៀស · ប្រយោគ NIIMBOT ក្នុង guide ពង្រីក · កូដ Share រៀបឡើងវិញក្នុង `download()` +
  `imageShareSheetPreferred()` · (៣) អ្នកប្រើ `shareImageFiles()` តែ `saveLabelImagesFromModal()` (`'saved'` ➜ «✅ បានទាញយក…» ពិត) · (៤) Share ៖ esbuild bundle កូដមុន/ក្រោយ ១០ UA ×
  ១០ ចម្លើយ Share = ១០០ ករណី ➜ ដូចគ្នា ៥២ · ប្រែ ៤៨ (កុំព្យូទ័រ ➜ ទាញយក · ទូរស័ព្ទ/iPad Share បដិសេធ ➜ ទាញយក) · ០ ករណីគ្មានឯកសារ គ្មាន Share (ក្រៅពីបោះបង់) ·
  ប្លង់ ៖ `getBoundingClientRect()` គ្រប់ធាតុ (ទំព័រទិន្នន័យ · ស្កេន ៣ របៀប · navbar · របា Tab) build មុន/ក្រោយ ១៣ ទំហំ (ទូរស័ព្ទបញ្ឈរ ៥ · tablet ៤ · ព្រំដែន 991×501 ·
  desktop ៣) ➜ ខុស ០ · ទិសផ្ទុយ ទូរស័ព្ទផ្តេក ២ ➜ ខុស ៧៥២ (ប្លង់ ២ ជួរឈរ · របា Tab ៦៦ ➜ ៤៥) · (៥) `imageShareSheetPreferred()` លើ `userAgent` · `maxTouchPoints` `undefined` ➜ មិនបោះកំហុស។
- តេស្ត App ទាំងមូល ៖ លំហូរប្រចាំថ្ងៃ ១៤ ឧបករណ៍ ៥១៨/៥១៨ · flow2 ៧២/៧២ (ស្គ្រីប ៖ រំលងជួរ spacer ទទេរបស់ virtualizer) · ប្លង់ ៥៦០ ស្ថានភាព ➜ ប្រែតែទូរស័ព្ទផ្តេក ២
  (កន្លែងវាយ Barcode ទទឹង ៥៨១ ➜ ២៥១ ក្នុងជួរឈររបស់វា · ធាតុនៅក្រោមក្បាលតារាងពេលរមូរដល់ចុង ៧ ➜ ២) · កំហុស JavaScript ០។
- `native:check` ធ្លាក់ ១ ក្នុង run-all ក្នុង session (ម៉ាស៊ីន ៤ CPU · lane ៤ រវល់) ៖ «PTR លើ native ៖ ទាញចុះ ➜ ផ្ទុកឡើងវិញ» ➜ រត់ម្នាក់ឯង ១១៨/១១៨ · CI ៤/៤ ✅។ មូលហេតុ ៖
  `waitForEvent('framenavigated', 6000)` ចាប់ផ្តើមមុន `pull()` ដែលបញ្ជូន touchMove CDP ៥០ ដង ហើយរង់ចាំ ack ម្តងមួយៗ (២.១ វិ. ក្រោម busy loop ៦ · App ផ្ទុកឡើងវិញ ០.៣៦ វិ.
  ក្រោយលែងដៃ) ➜ ពិដានរាប់ពេលរបស់ harness ➜ ឥឡូវ ៦ វិ. ចាប់ពីលែងដៃ · detail `pullMs` · `reloadAfterReleaseMs` · mutation (`location.reload` ➜ គ្មាន) ➜ FAIL ២ (ផ្នែក ១ +
  ៤ខ latch ដែលមិនប្តូរ ៖ dispatch ក្នុង `evaluate` តែមួយ) · busy loop ៨ ➜ ១១៨/១១៨ · ⛔ មិនបង្កើនពិដាន។ ឧបករណ៍តែប៉ុណ្ណោះ ➜ មិនប្តូរកំណែ។

### 2026-10-15 — សំណើម្ចាស់គម្រោងលើ 2.50.81 (`8d66650`) ៖ តេស្តលំហូរប្រើប្រាស់ប្រចាំថ្ងៃ គ្រប់ទំហំអេក្រង់ គ្រប់ឧបករណ៍

**វិធី** ៖ ស្គ្រីបរុករក (មិនមែនអ្នកយាម) លើ App ពិត (audit build `8d66650`) + Firebase ក្លែង + lookup ក្លែង (ឆ្លើយក្រោយ ១.៥ វិ.) · ចុចពិត (touch លើទូរស័ព្ទ/tablet ·
កណ្តុរលើកុំព្យូទ័រ) ហើយពិនិត្យ `elementFromPoint` មុនចុចរាល់ដង · keyboard ពិត (មនុស្ស ១៣០ms/គ្រាប់ · ម៉ាស៊ីនស្កេន ៤ms/គ្រាប់ + Enter) · ឧបករណ៍ ១៤ (iPhone ៣២០ · ៣៧៥ · ៣៩០ · ៤៣០ ·
Android ៣៦០ · ៤១២ · iPhone/Android ផ្តេក · iPad mini · Air ផ្តេក · Pro · Android tablet · Laptop · Desktop) × ៣៧ ការអះអាង ៖ ម៉ាស៊ីនស្កេនមិនចុចប្រអប់ ➜ វាយដោយដៃ ➜ រក្សាទុក ·
ស្កេនពេលផ្ទាំងបើក ➜ ជួរ ➜ ផ្ទាំងបន្ទាប់បើកឯង · ស្ទួន · COD ធំខុស ➜ កែ ➜ រក្សាទុក · Lookup Auto save / កំពុងវាយ · Locker · ដក · ស្វែងរក · បិទ/បើក (ស្ថិតិយករួច) · កែតម្លៃ ·
កែលេខ · លុប ➜ ស្តារ (លុបមិនដក · ដកបន្ថែមវិញ) · ស្ថិតិ ២ · បញ្ចូលច្រើន · ស្លាក · Export · COD/DOD/ចំនួនគ្រប់ជួរ = សរុប Barcode · កំហុស JS ·
បន្ថែម ៦ ឧបករណ៍ × ១២ ៖ Enter ពីលេខទូរស័ព្ទ ➜ Locker ➜ COD ➜ DOD (Enter លើ DOD មិនរក្សាទុក) · ល្បឿនវាយ · តម្រងថ្ងៃ · ប្លង់ ១៤ ទំហំ × ៤០ ស្ថានភាព ធៀបជុំមុន។
លទ្ធផល ៖ ៥១១/៥១៨ + ៧១/៧២ (ខុសទាំងអស់ពន្យល់ខាងក្រោម) · ប្លង់ ០ ថ្មី · កំហុស JS ០ · ចំណូលថ្ងៃ (+ រក្សាទុក · − ដក · + ស្តារការដក · លុបមិនប៉ះ · កែតម្លៃ = ភាពខុសគ្នា) ត្រូវគ្រប់ឧបករណ៍ ·
CI លើ `8d66650` ៤/៤ បៃតង។ ការអះអាងខុសរបស់ស្គ្រីបខ្លួនឯង (មិនមែន App) ៖ marker ចុចចាស់នៅលើប៊ូតុងមុន · ជួរ spacer របស់ virtualizer (Android) គ្មានថ្ងៃ ➜ កែស្គ្រីប។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A124 | **Android ផ្តេក 780×360 ៖ «📋 បញ្ចូលច្រើន» នៅក្រោមរបា Tab** | ប៊ូតុង ២៧៩–៣១៧ ⟷ កំពូលរបា Tab ២៩៤ (កម្ពស់ ៦៦) ➜ កណ្តាលប៊ូតុងជារបា Tab · អូសពិត (touch CDP) ៦០px ➜ snap ត្រឡប់ ០ · ១២០ · ២០០px ➜ snap ទៅ `.page-main` (២៧៤) ➜ ប៊ូតុងទៅក្រោម navbar ➜ ចុចបានតែ ១៥px ខាងលើ · 732×412 · iPhone 667×375 · 844×390 ចុចបាន | សំណើម្ចាស់គម្រោង «កែ A124 ទៅ ហើយ push ហ្មង សាងអ្នកយាមសិនមុនកែ» ➜ `layout-check` `landscapeScanReach` (មុនកែ FAIL ២ ៖ របៀបដក ៖ កន្លែងវាយ Barcode · «បញ្ជូន» ក៏នៅក្រោមរបា Tab · 756×336 ប៊ូតុងតម្រងទំព័រទិន្នន័យ) ➜ ផ្ទាំងស្កេន ២ ជួរឈរ + របា Tab បង្រួម តែទូរស័ព្ទផ្តេក (`react-root.css`) ➜ ៧/៧ ✅ · snap · ចលនាផ្ទាំង មិនប៉ះ |
| A125 | **Tablet ៖ ចុច «✅ បិទ» ភ្លាមក្រោយចេញពីស្វែងរក ➜ បិទជួរផ្សេង** | iPad mini · Android tablet ៖ ស្គ្រីបចុច ៥០០ms ក្រោយ blur · វាស់រាល់ស៊ុម ៖ ជួររអិល ៤៥០ ➜ ៧៤០ ក្នុង ~៤៩០ms (ទាញស្វែងរកចុះ `PANEL_SEARCH_GLIDE` + រង់ស៊ុម) ទូរស័ព្ទដូចគ្នា · `elementFromPoint` ត្រូវ ➜ touch មកដល់ពេលជួររំកិល | ចលនាដែលម្ចាស់គម្រោងផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត (តំបន់ហាម) · រង់ ១ វិ. ➜ ៧៤/៧៤ ✅ · មិនកែ |
| A126 | **ការវាយលឿន ↔ ម៉ាស៊ីនស្កេន ក្នុងផ្ទាំងលេខទូរស័ព្ទ** | ៩០ · ៧០ · ៦១ms/គ្រាប់ + Enter ➜ លេខចូលប្រអប់ · cursor ទៅ Locker · មិនចូលជួរ (៦ ឧបករណ៍) · ៤៥ms (២២ គ្រាប់/វិ.) ➜ ⚠️ «គ្មាន Enter/Tab» · ៣០ms + Enter ➜ ជួរ | ដូចការរចនា (`SCANNER_KEY_GAP_MS`) ✅ |
| A127 | **កុំព្យូទ័រ ៖ «🖼️ រក្សាទុកជារូបភាព» ➜ «❌ រក្សាទុករូបភាពស្លាកមិនបាន»** (រាយការណ៍ម្ចាស់គម្រោង) | Edge Windows (browser ពិត) ៖ `navigator.share` + `canShare({ files })` = true ➜ App បើក Share ជំនួសការទាញយក (A107 ចង់ឲ្យកុំព្យូទ័រទាញយក) · Share បដិសេធ `NotAllowedError` ➜ ❌ · ០ ឯកសារ · Android ដូចគ្នាពេលបដិសេធ | `imageShareSheetPreferred()` ៖ តែទូរស័ព្ទ · iPad បើក Share · បដិសេធ (មិនមែនបោះបង់) ➜ ទាញយកជំនួស (`file-output.ts`) · អ្នកយាម `label-image.test.tsx` (មុនកែ FAIL ៣) · `layout-check` (មុនកែ FAIL ២) ➜ ✅ |

### 2026-10-15 — វីដេអូ Chrome Android លើ deploy preview 320 · ម៉ាស៊ីនស្កេន Bluetooth/USB ស្វ័យប្រវត្តិ · ការស្កេនពេលផ្ទាំងបើក ➜ ជួរ

**វិធី** ៖ វីដេអូ Chrome Android (1080×2400 · keyboard ខ្មែរ/អង់គ្លេស · របារ URL ខាងក្រោម) ➜ ffmpeg ៤ ស៊ុម/វិ. ➜ វាស់កន្លែងវាយ · navbar · keyboard ·
កូដ Chromium (`web_frame_widget_impl.cc` · `web_view_impl.cc` · `local_dom_window.cc` · `root_frame_viewport.cc` · `mouse_event_manager.cc` · `document.cc`) ·
Chromium ពិត ៖ meta viewport ពង្រីកបាន + pinch ➜ visual viewport រំកិលពិត · ព្រឹត្តិការណ៍ keyboard ពិត (CDP `Input.dispatchKeyEvent` ៖ key «១» · code Digit1)។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A117 | **Chrome Android ៖ ចុចកន្លែងវាយ Barcode (របៀបដក) ➜ ទំព័រ និង navbar រំកិលឡើង ~១៨០px ហើយនៅ** | វីដេអូ ៖ ស៊ុម 2.5 ➜ 3.0 វិ. កន្លែងវាយពី ៤៤–៤៧% ទៅ ២៤–២៧% (ប្រហែលកណ្តាលផ្ទៃពីលើ keyboard) · keyboard ខ្មែរ + របារ URL កំពូល ៤៩% · ពេលខ្លះមិនរំកិល (26.25–27.0 វិ.) ពេលខ្លះរំកិល (ចុចម្តងទៀត) · កូដ ៖ `ComputeScaleAndScrollForEditableElementRects` រំកិល (កណ្តាល) តែពេលប្រអប់/caret មិននៅក្នុង visual viewport ទាំងស្រុង · `ScrollFocusedEditableElementIntoView` រំលងពេល `GetFocusOptions()->preventScroll()` · ចុចប្រអប់ដែល focus រួច ➜ `HandleMouseFocus` មិនហៅ `SetFocusedElement` ➜ options នៅជាប់ · ទីតាំងពិត (App · UA Android) ៖ 411×830 របៀបដក បាត 384 (៤៦%) · 360×740 393 (៥៣%) · 915×412 343 (៨៣%) | ការចុចកន្លែងវាយ Barcode លើ Android ចាប់ដូច iPhone (`noteModalTouchStart` ៖ `isAndroidDevice()` · modal ➜ មិនចាប់ · focus រួច + `keyboardOpen`/visualViewport ➜ មិនចាប់) ➜ ✅ ៦ ឧបករណ៍ |
| A118 | **Chrome Android ៖ ទំព័ររំកិលរួច ➜ ចុចស្វែងរកបញ្ជីកញ្ចប់ ➜ ឃើញតែ «📭» ៣ វិ.** | វីដេអូ ៖ 4.75 វិ. ទំព័ររំកិល (ពី A117) ➜ 5.0 ចុចស្វែងរក ➜ 5.25–8.0 តែសារទទេនៅកំពូល ➜ បិទ keyboard ➜ ត្រឡប់ · visual viewport នៅរំកិល ១៧៩px ខណៈការបង្រួមលើកប្រអប់ទៅ y≈១១០ · Chromium ពិត (pinch ➜ offsetTop 88) ៖ `window.scrollTo(0, 0)` ➜ 88 (ប៉ះតែ layout viewport ៖ `LocalDOMWindow::scrollTo` ➜ `LayoutViewport()`) · `documentElement.scrollIntoView({ block: 'start' })` ➜ ០ (`RootFrameViewport::ScrollIntoView` ចែកការរំកិលដល់ visual viewport) | `resetVisualViewportPan()` (refs) ក្នុងការចុចស្វែងរក Android មុនបង្រួម ➜ App ពិត (pinch) ៖ ៨៨ ➜ ០ · ប្រអប់ស្វែងរក y ១០៦/១៧៣ ក្នុងផ្ទៃ ➜ ✅ (មុនកែ 88 នៅដដែល) |
| A119 | **ម៉ាស៊ីនស្កេន Bluetooth/USB** (សំណើម្ចាស់គម្រោង) | App ពិត (Chromium · ព្រឹត្តិការណ៍ keyboard ពិត) ៖ ទូរស័ព្ទ ៖ App មិន focus ប្រអប់ (`safeFocusScanner()` តែកុំព្យូទ័រ) ➜ ស្កេនក្រោយរក្សាទុក ➜ បាត់ · កុំព្យូទ័រ ៖ ក្រោយចុចប៊ូតុង (ការចុចប៊ូតុងមិន focus ប្រអប់) ➜ បាត់ ហើយ Enter ចុចប៊ូតុងនោះ · keyboard ខ្មែរ ៖ key «១» code Digit1 ➜ ប្រអប់ទទួល «១» · Tab ➜ focus ចេញ មិនបញ្ជូន · focus ក្នុង `keydown` ➜ តួអក្សរចូលប្រអប់ថ្មី (Chromium) ប៉ុន្តែ App បញ្ចូលខ្លួនឯង (មិនពឹងលើ engine) · មុនកែ FAIL ៩/១២ | `noteScannerKeyDown()` (document `keydown` capture) · `scannerKeyChar()` (`key` ASCII ➜ ដដែល · ផ្សេង ➜ `usLayoutChar(code)` · លេខខ្មែរ) · `latinDigits()` · Tab លឿន ➜ `submitManualBarcode()` ➜ ✅ ១២/១២ (Android · iPhone · កុំព្យូទ័រ) |
| A120 | **ការផ្ទៀងផ្ទាត់ឡើងវិញ** (សំណើម្ចាស់គម្រោង ៖ «សូមផ្ទៀងផ្ទាត់ការងារឡើងវិញ ក្រែងមានចន្លោះ») | ៤ ចន្លោះលើ `c7b23da` ៖ (១) `repository-file-coverage` FAIL ៖ តេស្តថ្មីគ្មាន mapping (ឯកសារនីមួយៗក្នុង `ZoeW/tests/` មានជួរផ្ទាល់) · (២) `npm run purity:check` FAIL ៖ `refs.ts` `.value +=` (fallback) លើសពិដាន `.value =` ១ · `scrollIntoView` ២ > ១ — ការពិនិត្យទាំងពីរមិនបានរត់មុន push (run-all រត់ក្នុងផ្ទៃខាងក្រោយ) ➜ CI ផ្នែក `zoew-suite 1/2` · `repository-file-coverage` នឹងក្រហម · (៣) keyboard ខ្មែរ NiDA មានគ្រាប់ដែលវាយតួអក្សរ ២ («ុះ» · «ោះ») ➜ `scannerKeyChar()` ទទួលតែ `key` មួយតួ ➜ ទុកឲ្យ native ➜ Barcode ជាអក្សរខ្មែរ · (៤) «📋 បញ្ចូលច្រើន» (ប្រអប់សម្រាប់ម៉ាស៊ីនស្កេន) ៖ keyboard ខ្មែរមិនបម្លែង · suffix Tab ➜ focus ចេញ ➜ ការស្កេនបន្ទាប់បាត់ · គ្មាន focus ក្នុងប្រអប់ ➜ បាត់ | (១) mapping `zoew-self-verification` ➜ ១០/១០ · (២) `insertFieldText()` គ្មាន fallback `.value` (បញ្ចូលមិនបាន ➜ `false` ➜ គ្រាប់ទៅ native) · `setRangeText` ក្នុង `DOM_METHODS` · ច្រកចេញមានហេតុផល ➜ ១៥/១៥ · (៣) `key` មិនមែន ASCII (មួយ ឬច្រើនតួ) ➜ `usLayoutChar(code)` · (៤) `scannerCaptureField()` ៖ «📋 បញ្ចូលច្រើន» ខាងលើ ➜ `batchBarcodeInput` · Tab លឿន ➜ ជួរថ្មី · `input` ➜ ចំនួន ➜ ✅ vitest +២ · ឧបករណ៍ពិត ៤៩/៤៩ |
| A121 | **ការស្កេនពេលផ្ទាំងលេខទូរស័ព្ទបើក ↔ Auto save ពី lookup** (សំណើម្ចាស់គម្រោង ៖ «ពិនិត្យផ្លូវ Auto save ពេលស្គាល់លេខទូរស័ព្ទពី lookup … ក្រែងប្រជែងគ្នាជាមួយការបន្ថែមថ្មី» · «ប៉ះតំបន់លុយ សាងអ្នកយាមមុន») | កូដមុនកែ (App ពិត · `triggerScanAction` · lookup ពិតតាម `fetch` ក្លែង · `confirmPhone` ពិត · registry/ledger/save ក្លែង · ព្រឹត្តិការណ៍ keyboard ដែលធ្វើតាម browser ៖ គ្រាប់មិន `preventDefault` ➜ ចូលប្រអប់ · Enter លើប៊ូតុង ➜ ចុច) ៖ ផ្ទាំង A បើក (lookup កំពុងរក) ➜ ស្កេន B ៖ focus COD ➜ lookup ស្គាល់ ➜ Auto save រក្សាទុក A `["012345678", 7810122334455, 1]` + «✅ រក្សាទុកបានជោគជ័យ!» · DOD ➜ `[…, 5, 7810322334455]` · លេខទូរស័ព្ទ ➜ «✅ បានទាញយក…» គ្មាន Auto save (`fillEmptyLookupFields()` បំពេញតែប្រអប់ទទេ) · Locker ➜ Locker = B · ប្រអប់ Barcode ក្រោយផ្ទាំង ➜ `submitManualBarcode()` ចេញពេលផ្ទាំងបើក ➜ «BC» · ផ្ទាំងបិទពាក់កណ្តាល ➜ កន្ទុយ B ចូលប្រអប់ Barcode ហើយបញ្ជូន (Barcode ខ្លី) · «🗑️ បញ្ជាក់ដក» focus ➜ Enter ចុច (កាត់លុយ) · `type=number` ៖ `setRangeText` បោះ `InvalidStateError` (happy-dom · Chromium) · `execCommand('insertText')` ក្នុង Chromium ពិត ៖ «1» «.» «5» ➜ `1.5` · caret កណ្តាលលេខទូរស័ព្ទ ➜ ត្រូវ | ទប់គ្រាប់ពេលផ្ទាំងបើក (`scannerHoldScope()` · `heldKeys`) ➜ ការវាយត្រឡប់ចូលប្រអប់ (`typeIntoElement()`) · ការស្កេន ➜ ជួរ (`queueScannedCode()` ➜ ការរត់ «📥» នៃជួរ «📋 បញ្ចូលច្រើន» ៖ របៀបស្កេន · រង់ចាំការដក) ➜ `scanner-modal-queue.test.tsx` ២០ (កូដមុនកែ FAIL ១២ · checkbox + ផ្ទាំងដកស្កេនដដែល លើ `0f2b40e` FAIL ២ · Android keyboard លើអេក្រង់ លើ `56a567c` FAIL ១ · ផ្ទាំង PIN តែឯង លើ `b1e3898` FAIL ១) · `modal-keyboard-device-test` (ង) កូដមុនកែ FAIL ៣ ➜ ៥២/៥២ · ការប៉ះពាល់ ៖ `layout-check` វាយ ០ms = ការស្កេន ➜ 90ms · ទិសផ្ទុយ «modal បើក» ក្នុងតេស្តម៉ាស៊ីនស្កេន ➜ គ្រាប់ត្រូវទប់ · Auto save មិនប្រែ (ឯកសារ ZTO ចាក់សោ `auto-lookup.ts` មិនប៉ះ) |
| A122 | **Fast Mode ៖ ម៉ាស៊ីនស្កេនគ្មាន Enter/Tab · COD/DOD ធំខុសធម្មតា** (សំណើម្ចាស់គម្រោង ៖ «ដែលអ្នកថា Fast mode មានចន្លោះនោះសូមកែអោយស្អាតចុះ») | `e33a872` (App ពិត · lookup Auto save ពិត · registry/ledger/save ក្លែង) ៖ គ្រាប់លឿន ១៤ គ្មាន suffix ចូល COD ➜ timer `SCANNER_SUFFIX_GAP_MS` ត្រឡប់គ្រាប់ចូល COD (`78101355667788`) ➜ Auto save · ប្រអប់ Barcode ក្រោយផ្ទាំង = `ZTQZ140002` · COD `7810122334455` ដែលមិនឆ្លងការទប់ (បិទភ្ជាប់ · keyboard លើអេក្រង់ iPhone) ➜ `confirmPhone()` រក្សាទុក (Auto save · «រំលង») · checker ១៣ ដែលស្រង់ `confirmPhone` ចូល sandbox (`duplicate-money` · `revenue-fuzz` · …) ៖ ថេរថ្មីមិនបាក់ពួកវា | ស្រទាប់ ២ ៖ ការទប់បោះបង់ការស្កេនគ្មាន suffix (`releaseHeldKeys()` ៖ ≥ `SCANNER_MIN_CHARS` ➜ toast) · `confirmPhone()` បដិសេធ COD/DOD > `SCAN_MONEY_MAX` មុន claim/ledger ➜ `scanner-modal-queue.test.tsx` +៤ (`e33a872` FAIL ៤) · `modal-keyboard-device-test` (ង) +៣ · `user-guide-test` ស្រង់ពិដានពីកូដ |
| A123 | **Lookup Auto save ↔ មនុស្សកំពុងវាយ (`auto-lookup.ts` ក្នុងសោ ZTO)** (សំណើម្ចាស់គម្រោង ៖ «ត្រូវការកែ auto-lookup.ts របស់ ZTO ដែរឬ បើត្រូវកែក៏កែចុះ») | ចម្លើយ ៖ ត្រូវ — វាស់លើ `d50bb01` (App ពិត · lookup ពិតតាម `fetch` ក្លែង) ៖ `applyLookupFillToModal()` រក្សាទុកស្វ័យប្រវត្តិពេល lookup បំពេញលេខទូរស័ព្ទ ទោះមនុស្សកំពុងវាយ COD ➜ `["012345678", 1, 1]` (ចង់ 15) · `armLookupFocus()` ពិនិត្យតែប្រអប់លេខទូរស័ព្ទទទេ ➜ ទាញ cursor ចេញពី COD/Locker ➜ «5» ចូលលេខទូរស័ព្ទ · ច្បាប់ CLAUDE.md «unless the user typed» មានក្នុងអត្ថបទ តែកូដពិនិត្យតែលេខទូរស័ព្ទ | `scanState.phoneModalTyped` (`input` លើប្រអប់ ៤ · កំណត់ឡើងវិញក្នុង `triggerScanAction()`) ➜ Auto save តែពេលមិនទាន់វាយ (វាយរួច ➜ ℹ️ ជាមួយ COD/DOD lookup) · `armLookupFocus()` មិនទាញ cursor ពេលបានវាយ ឬប្រអប់វាយក្នុងផ្ទាំង focus ➜ `scanner-modal-queue.test.tsx` +៤ (`d50bb01` FAIL ៣) · សោ ZTO ៖ sha256 `auto-lookup.ts` ថ្មីក្នុង `tests/zto-lock.test.ts` តាមសំណើនេះ · អ្នកយាម ZTO ទាំងអស់បៃតង |

### 2026-10-15 — វីដេអូម្ចាស់គម្រោងលើ 2.50.80 ៖ iPhone របៀបស្កេនដក ទំព័រធ្លាក់ · Android ស្វែងរក Locker កន្ត្រាក់

**វិធី** ៖ វីដេអូ iPhone (60fps) · APK (~90fps) ➜ ffmpeg ស៊ុមម្តងមួយ (pts) ➜ វាស់ទីតាំងកន្លែងវាយ · navbar · កំពូល keyboard ពីស៊ុមពេញទំហំ ➜ App ពិត (audit build) ក្នុង Chromium ៖ iPhone standalone
ក្លែង + របារស្ថានភាពក្លែង (padding 59px ៖ ទីតាំងត្រូវនឹងវីដេអូ ៖ កញ្ចប់ 378 · ដក 442) · Android ចុចពិតដោយ touchscreen ➜ guard ធ្លាក់លើកូដចាស់ ➜ ទើបកែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A114 | **iPhone ៖ របៀបស្កេនដក ➜ ចុចកន្លែងវាយ ➜ ទំព័រ និង navbar ធ្លាក់ ~៩០pt ហើយត្រឡប់** (របៀបកញ្ចប់ ✅) | វីដេអូ ៖ ស៊ុម 7.15–7.35 វិ. navbar ធ្លាក់ពី 78 ទៅ 171 (panel px) មុន keyboard · កន្លែងវាយរបៀបដក បាត 442pt (ប៊ូតុងក្រហម + ផ្ទាំងផ្កាឈូក ៖ +64pt ធៀបរបៀបកញ្ចប់ 378) · keyboard ខ្មែរ + របារ ⌃⌄✓ កំពូល 487pt (៤៣%) · ច្បាប់ ៥០% ➜ បន្ទាត់ 426 < 450 ➜ មិនចាប់ · តម្លៃ keyboard ដែលវាស់ (`keyboardInsetSeen`) ក្នុងការក្លែង ➜ ចាប់ ប៉ុន្តែលើឧបករណ៍ការចុចដដែលធ្លាក់ ➜ មិនពឹងលើវាតែមួយ | ទូរស័ព្ទបញ្ឈរ ៤៥% (`PAGE_TAP_PHONE_KEYBOARD_RATIO`) ៖ 450 ≤ 469 ➜ ចាប់ · SE (667 · status 20) របៀបដក ➜ keyboard ពិត 305 បាំង ➜ iOS · iPad/ផ្តេក ៥០% ➜ ✅ |
| A115 | **Android ៖ ចុចប្រអប់ស្វែងរក Locker ➜ ទំព័រកន្ត្រាក់ឡើងលើ** | វីដេអូ ៖ ចុចលើកទី ២ (35.2 វិ.) ៖ keyboard ចាប់ផ្តើមខណៈប្រអប់ស្វែងរកនៅទាប ➜ navbar បាត់ (ទំព័រទាំងមូលរំកិល) ➜ បន្ទាប់មកតែសារទទេនៅកំពូល (ប្រអប់ស្វែងរកផុតពីលើ) ➜ ត្រឡប់ · ចុចលើកទី ១ (33.5 វិ.) keyboard មកក្រោយការរអិល ➜ រលូន · Chromium `ScrollFocusedEditableElementIntoView` ពេល IME បង្ហាញ ➜ តែ focus ដែលគ្មាន `preventScroll` | ប្រអប់ស្វែងរក tab ស្កេនលើ Android ចាប់ការចុចដូច iOS (`noteIOSSearchTouchStart` ៖ `isAndroidDevice()` · ប្រអប់ស្វែងរកលេខមិនរាប់) ➜ បង្រួមមុន + `focus({ preventScroll })` ➜ ✅ |
| A116 | **ហេតុអ្វីតម្លៃ keyboard ដែលវាស់មិនបានជួយក្នុងវីដេអូ** (សំណើម្ចាស់គម្រោង ៖ «ឆ្លាតវៃវាស់ keyboard ដោយខ្លួនឯង») | វីដេអូ ៖ ចុចរបៀបកញ្ចប់ (keyboard បើក 2.3 វិ.) មុនរបៀបដក (7.1 វិ.) ➜ App គួរតែស្គាល់ keyboard រួច · ការក្លែង ៖ keyboard ស្ងប់តែមួយ ➜ ចាប់ · keyboard iOS លោតហួស (spring) ➜ ព្រឹត្តិការណ៍ visualViewport មួយមានកម្ពស់ធំជាងចុងក្រោយ ➜ `keyboardInsetSeen` ទុក **ធំបំផុត** ➜ 420 ➜ បន្ទាត់ 432 < 450 ➜ មិនចាប់ (ធ្លាក់ដូចវីដេអូ · FAIL លើ `c611d62`) · តម្លៃនៅតែក្នុង memory (reload បាត់) | `zoew_keyboard_inset_v1` ៖ តម្លៃចុងក្រោយដែលស្ងប់ (កត់តែពេលកន្លែងវាយ focus ៖ ពេលបិទ keyboard field blur មុន ➜ តម្លៃពេលបិទមិនចូល) · តាមអេក្រង់ × ប្រភេទ · នៅក្រោយ reload ➜ ✅ ២៦/២៦ |

### 2026-10-15 — វីដេអូម្ចាស់គម្រោងលើ 2.50.79 ៖ APK ប្រអប់នៅញ៉ាក់ · iPhone ចុចកន្លែងវាយ Barcode ទំព័រធ្លាក់ · បញ្ជី Locker ធ្លាក់

**វិធី** ៖ វីដេអូ ២ (iPhone · APK) ➜ ffmpeg ស៊ុមម្តងមួយ (pts) · ពង្រីកស៊ុមចប់ keyboard ➜ App ពិត (audit build) ក្នុង Chromium ៖ APK ក្លែង (setViewportSize បង្រួម ខណៈ visualViewport ក្លែង
នៅរាយការណ៍ inset ចាស់) · iPhone/iPad standalone ក្លែង (UA iPhone ➜ App មិន focus ដោយកូដ · UA កុំព្យូទ័រ iPad ➜ focus ដោយកូដ) ➜ guard ធ្លាក់លើកូដចាស់ ➜ ទើបកែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A110 | **APK ៖ ប្រអប់លោតឡើងហើយត្រឡប់ពេល keyboard លោតចប់** | វីដេអូពង្រីក ៖ មានតែកាតប្រអប់ផ្លាស់ទី (ទំព័រខាងក្រោយនៅ) ➜ ច្របាប់ទៅកំពូល ~៣–៥ ស៊ុម ហើយត្រឡប់ = «ស៊ុមខូច ៣» របស់ A103 · មូលហេតុ ៖ `KeyboardOpenHold.release()` (MATCH_PARENT) បង្រួម WebView ខណៈ Chromium នៅរាយការណ៍ inset IME ➜ `visualViewport.height` = កម្ពស់បង្រួម − keyboard ➜ `modalKeyboardHoldFitFor()` តម្រូវលើផ្ទៃ ២៥៥px (412×915 ៖ PIN កំពូល 178 ➜ 13 ➜ 178 · បាត 407 ➜ 242) · ការកែលើកទី ១ (`keyboardOpen` ➜ null តែប៉ុណ្ណោះ) ៖ ដដែល 178 ➜ 13 — វាស់ ៖ `body.keyboard-open` មាន តែការវាស់ visualViewport រត់ **មុន** window `resize` (Chromium មិនធានាលំដាប់) ហើយគ្មានអ្វីវាស់ម្តងទៀត | `keyboardVisibleViewport()` ➜ null ពេល `keyboardOpen` · `noteKeyboardViewport()` (មានរួច · មិនកែឯកសារចាក់សោ) ចុះឈ្មោះលើ visualViewport `resize` មុនការវាស់ · ការប្តូរ `keyboardOpen` ➜ `queueModalMeasure()` + `measureKeyboardCover()` ➜ APK ៥ ទំហំ ✅ · PWA Chrome · iPhone មិនប្រែ |
| A111 | **iPhone ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័រធ្លាក់ហើយរអិលត្រឡប់** | វីដេអូ ៖ ស៊ុម 0.70–0.81 វិ. navbar និងទំព័រធ្លាក់ចុះ ពេល keyboard លោត ➜ ត្រឡប់ · `hwScannerInput` នៅក្រៅប្រអប់ ➜ មិនចូលការចាប់របស់ប្រអប់ (A104) · ទីតាំង (App ពិត) ៖ បាត 319 (375×667 · 393×852 = ៤៨% · ៣៧%) · 322 (430×932) · 275 (852×393 = ៧០%) · 275 (iPad 820×1180) · 441 (iPad 1180×820 = ៥៤%) ⟷ keyboard ពិត ~៣៩% បញ្ឈរ · ~៥៣% iPhone ផ្តេក · ~៤៩% iPad ផ្តេក ➜ ការចាប់គ្រប់ទំហំនឹងបាំងកន្លែងវាយពេលផ្តេក | ការចាប់ប្រអប់ពង្រីកទៅ `hwScannerInput` (គ្មានប្រអប់បើក) តែពេលបាត + `MODAL_KEYBOARD_GAP_PX` ≤ បន្ទាត់ keyboard (inset ធំបំផុតដែលវាស់នៅទទឹងនេះ ឬ ៥០% ៖ ៤៥% ធ្លាក់ iPad ផ្តេក 449 ≤ 451) · ផ្តេក ➜ iOS · iPad focus ដោយកូដ ➜ ចាប់ដូច A104 ➜ ✅ |
| A112 | **ស្វែងរក «📍 បញ្ជីទីតាំង Locker» ឡើង ➜ ចុច «ទីតាំងទាំងអស់» ➜ បញ្ជីធ្លាក់** (រាយការណ៍ម្ចាស់គម្រោង iPhone) | App ពិត (APK · PWA Android · PWA iPhone ក្លែង) ៖ focus ស្វែងរក ➜ ផ្ទាំងបង្រួម (បញ្ជីឡើង) ➜ focus `#lockerListFilter` ➜ ៩០០ms ក្រោយ ផ្ទាំងបើកវិញ (`entryPanelCollapsed` false) ➜ បញ្ជីធ្លាក់ · មូលហេតុ ៖ `entrySearchBlurred()` ពិនិត្យតែប្រអប់ស្វែងរក (focus · អត្ថបទ) · select ក្នុង `.filter-bar` ដដែលមិនរាប់ | `entrySearchInUse()` ៖ ប្រអប់ស្វែងរក focus · Locker ៖ select focus · ទីតាំងជ្រើស · អត្ថបទ ➜ មិនបើក · select មាន ref + `onBlur={entrySearchBlurred}` ➜ «ទីតាំងទាំងអស់» + ទទេ ➜ បើកវិញ ➜ ✅ ៣/៣ |
| A113 | **CI លើ PR #319 ៖ ផ្នែក 3/4 ក្រហម** | `state-hygiene` ៖ `keyboardOpenSeen` · `keyboardInsetSeen` (ថ្មីក្នុង `modal-keyboard.ts`) មិនកំណត់ឡើងវិញពេល logout ហើយមិនកត់ហេតុផល | ACCEPTED មានហេតុផល (boolean ប្លង់ · កម្ពស់ keyboard របស់ឧបករណ៍ · គ្មានទិន្នន័យអតិថិជន · `listenModalKeyboard()` កំណត់ឡើងវិញ) ➜ ✅ |

### 2026-10-15 — វីដេអូម្ចាស់គម្រោងលើ 2.50.78 ៖ ប្តូរ Paper size ➜ ក្រដាសស · APK ប្រអប់កន្ត្រាក់ ២ ដង · iPhone «បញ្ចូលច្រើន» ទំព័រធ្លាក់មួយភ្លែត

**វិធី** ៖ វីដេអូ ៣ (iPhone 60fps ១៣ វិ. · iPhone 60fps ២៣ វិ. · APK ~៨៩fps ៤៣ វិ.) ➜ ffmpeg ស៊ុមម្តងមួយ ➜ វាស់ទីតាំងដោយ profile ជួរឈរ (ស្វែងរកការរំកិលបញ្ឈរ ±៤៥០px ធៀបស៊ុមដើម) និងគែមកាត ➜
App ពិត (audit build) ក្នុង Chromium ៖ APK ក្លែង (bridge Capacitor · visualViewport បង្រួមដោយមិនប្តូរ innerHeight ➜ setViewportSize) · iPhone standalone ក្លែង ➜ guard ធ្លាក់លើកូដចាស់ ➜ ទើបកែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A102 | **បោះពុម្ព ៖ ប្តូរ Paper size ➜ «Page 1 of 1» ស** | iPhone ៖ A4 «Page 1 of 7» ស្លាកពេញ ➜ A3 ➜ «Page 1 of 1» ស ➜ A4 ➜ «Page 1 of 2» ស · APK ៖ Letter ៤៨ ទំព័រ ➜ ISO A5 ➜ «1/1» ស · មូលហេតុ ៖ `beginPdfPrint()` ចង `afterprint` ➜ `restoreAfterPdfExport()` · WebKit/WebView ផ្ញើ `beforeprint`/`afterprint` រាល់ការគូរ preview (ផ្ទាំងបោះពុម្ពនៅបើក) | `afterprint` ➜ `armPdfExportRestore()` · សម្អាតតែពេល `pointerdown`/`keydown` លើ document · `print-relayout.test` លើកូដចាស់ FAIL ៣ ➜ ៤/៤ |
| A103 | **APK ៖ ប្រអប់ផ្លាស់ទី ២ ដងពេល keyboard លោត** | វីដេអូ ៖ កាត «បញ្ចូលច្រើន» កំពូល 684 ➜ 375 (−៣០៩px ≈ ១១៨dp) នៅស៊ុមដំបូងនៃ keyboard ➜ ឈរ ➜ ចប់ចលនា ➜ 295 (−៨០px) + ស៊ុមខូច ៣ · ស៊ុមកណ្តាល ៖ ស្រទាប់ `.modal::after` ស្រអាប់ចាប់ពីបន្ទាត់ keyboard ចុងក្រោយ ➜ visualViewport បង្រួមភ្លាមពេល `KeyboardOpenHold` រក្សា WebView · Chromium ក្លែង (412×915 · keyboard 330) ៖ ១៨/១៨ ប្រអប់ (បញ្ចូលច្រើន 252 ➜ 165 ➜ 87 · PIN 343 ➜ 343 ➜ 178) | Android (APK · PWA Chrome) ៖ `modalKeyboardHoldFitFor()` = កណ្តាលផ្ទៃពីលើ keyboard (padding · cap ៨៥vh × កម្ពស់ថ្មី/ចាស់) ➜ ១៨/១៨ × APK ២ ទំហំ + PWA ផ្លាស់ទីតែម្តង (±1px) · `.si-modal-content` រក្សា flex (`modal-kb-hold`) · ⚠️ ប្រអប់មានធាតុ vh ខាងក្នុង (ឧ. preview Excel ៣០vh) អាចរំកិលតិចពេល WebView បង្រួម · ស៊ុមខូចពេល WebView ប្តូរទំហំ ជារបស់ WebView |
| A106 | **បោះពុម្ពស្លាកមិនឆ្លាតវៃ ៖ ទំហំ CSS បង្ខំ** (សំណើ ៖ «អាចឆ្លាស់គ្រប់ប្រភេទក្រដាស») | `page.pdf()` ២៤ ស្លាក ៖ 50×30 លើ A4/A3/A5/Letter/Legal/4×6 ➜ ២៤ ទំព័រ (១ ស្លាកតូច/ទំព័រ) · លើក្រដាស 50×30 ➜ ៤៨ ទំព័រ (ទទេឆ្លាស់ ៖ margin ២mm) · 60×40 លើ 50×30 ➜ ៤៨ · «single» លើ 50×30 ➜ ១២០ (ស្លាកបែក ៥ ទំព័រ) · A4 ៣ ជួរឈរលើរមូរ ➜ អក្សរកាត់ · វីដេអូ Android ៖ Letter «1/48» ស្លាកតូចជ្រុងទំព័រ · Chromium ៖ media query `print` វាស់តាមក្រដាស (50×30 · 60×40 ➜ តូច · A4 · 4×6 ➜ ធំ) | ក្រដាសសម្រេច ៖ រមូរ ➜ ១/ទំព័រគ្រប់ប្លង់ (២៤/២៤) · A4 ➜ ១ ទំព័រ · A5 ➜ ២ · 4×6 ➜ ៦ · `labelPrintFit` × ៨ ក្រដាស ✅ |
| A107 | **NIIMBOT B1 ៖ បោះពុម្ពតាម App NIIMBOT ប៉ុណ្ណោះ** (Bluetooth · ទទឹង ២០–៥០mm · 203dpi) | «Save as PDF» ➜ ក្រដាស Letter + ស្លាកតូចជ្រុង ➜ ត្រូវកាត់ក្នុង App | PNG ទំហំពិត (៨ ចំណុច/mm) · ZXing អាន Barcode វិញ ១២/១២ · iPhone/Android Share · APK Share · កុំព្យូទ័រទាញយក |
| A105 | **ស្លាក ៖ ក្រដាស A5 + ប្លង់ A4 ៣ ជួរឈរ ➜ លេខ Barcode ហួសស្លាក** (ការវាស់គ្រប់ទំហំក្រដាសតាមសំណើ) | `labelPrintFit` A5 (484px) ៖ «ZT880000000000» ទទឹង ១៤៧px ⟷ ក្នុងស្លាក ១២៧px (១១ ស្លាក) · សន្លឹកលើស ៩px · Letter ឆ្លង | `.label-code` បង្រួម (`100cqw` ÷ តួ · monospace ០.៦២em) ➜ ៤ ក្រដាស × ៦ ប្លង់ ✅ |
| A108 | **CI លើ PR #318 ៖ ផ្នែកក្រហម** | `doc-scope-test` ៖ លិបិក្រមខ្វះ `modal-keyboard-device-test` · `minmax(` ក្នុង CLAUDE.md អានជាឈ្មោះ helper · `state-hygiene` ៖ `modalTapFocused` មិនកត់ហេតុផល · `loop-termination` ៖ `labelImageFiles()` រង្វិល `for` ស្វែងរកឈ្មោះទំនេរ គ្មានពិដាន | លិបិក្រម + ពាក្យ CLAUDE.md · ACCEPTED មានហេតុផល (handle ធាតុ · សម្អាតពេល focusin) · ឈ្មោះស្ទួនរាប់តាម `Map` (គ្មានរង្វិល · Barcode សល់តែអក្សរ/លេខ ➜ `_n` មិនជាន់ឈ្មោះផ្សេង · `ZoeW/tests/label-image.test.tsx` ៣ ឈ្មោះ) · `code-duplication-test` ៖ ការបោះពុម្ព និងរូបភាពចាប់ផ្តើមដោយប្លុកដដែល ៧ បន្ទាត់ ➜ `labelRowsFromModal()` តែមួយ ➜ ✅ |
| A109 | **ម្ចាស់គម្រោង ៖ «checker ទាំងអស់នៅនិយាយ ZoeW/app.js»** | `ZoeW/app.js` គ្មានក្នុង repo ទៀតទេ · checker អាន `ZoeW/dist-audit/measure-root/ZoeW/app.js` ដែល `ZoeW/scripts/build-audit.mjs` បង្កើតពី `ZoeW/src/**` រាល់ run (ភស្តុតាង ៖ `labelImageFiles` ថ្មីនៅក្នុងវា) | ក្បាល run-all បន្ថែមបន្ទាត់មួយ ៖ «ZoeW/app.js ក្នុង checker = ទិដ្ឋភាពអត្ថបទ build ពី ZoeW/src/**» · បន្ទាត់ចុងក្រោយ `ZOE_MEASURE_ONLY` នៅជាផ្លូវ ➜ ✅ |
| A104 | **iPhone ៖ «បញ្ចូលច្រើន» ➜ ចុចកន្លែងវាយ ➜ ទំព័រធ្លាក់ ១៣០pt ហើយលោតត្រឡប់** | ស៊ុម ៦០fps ៖ ស៊ុម ៤–៥ ទំព័ររំកិលឡើង −៨ · −២០px (WebKit បង្ហាញកន្លែងវាយ តាមចលនា keyboard) ➜ ស៊ុម ៦ ធ្លាក់ +៣០០px (ផ្ទៃសខាងលើ ៖ backdrop ក៏ធ្លាក់) ➜ ត្រឡប់ ០ ក្នុង ១០ ស៊ុម (rubber band) · កន្លែងវាយមានស៊ុម focus មុនចុច ➜ `openBatchScanModal()` focus ១៥០ms (iOS មិនបើក keyboard) ➜ ការចុចលើកន្លែងវាយដែល focus រួចទៅផ្លូវ iOS ដើម (`modalTapField()` បដិសេធ `activeElement`) ➜ `restoreIOSDocumentScroll()` (2.50.77) ទាញ ០ កណ្តាលចលនា WebKit | focus រួច + keyboard មិនទាន់បើក + មិនទាន់ចុច ➜ ចាប់ (blur + `focus({ preventScroll })`) · `modal-keyboard-test` + `modal-keyboard.test` លើកូដចាស់ FAIL ២ + ២ · ⚠️ keyboard ពិតរបស់ iOS វាស់មិនបាន ➜ សាកលើ iPhone ពិត |

### 2026-10-15 — សំណើម្ចាស់គម្រោងលើ 2.50.77 ៖ តេស្ត App ទាំងមូលតាមការប្រើប្រចាំថ្ងៃ គ្រប់ទំហំ ធៀបស្តង់ដារ App ទូទៅ

**វិធី** ៖ ស្គ្រីបរុករក (មិនមែនអ្នកយាម) លើ App ពិត + Firebase ក្លែង · font ពិត (Kantumruy Pro · Inter ពី npm) · ១៤ ទំហំ × ៣៩ ស្ថានភាព ៖ វាស់ ធាតុលើសអេក្រង់ · អត្ថបទកាត់ ·
ប៊ូតុងដែលធាតុផ្សេងបាំង (elementFromPoint) · ប៊ូតុងក្នុងប្រអប់ចុចដល់ (scrollIntoView) · ទំហំគោលដៅចុច · អក្សរតូច · «៛» ធ្លាក់ម្នាក់ឯង (Range) · រូបថត ➜ ចំណុចដែលឃើញ ➜ សរសេរអ្នកយាមក្នុង
`layout-check` ➜ ធ្លាក់លើ `203be0b` ➜ ទើបកែ · run-all STRICT ពេញលើ `203be0b` (2.50.77) ៖ ✅ ២០៦/២០៦ (០ មួយផ្នែក · ០ រំលង)។ ត្រឹមត្រូវរួច (មិនកែ) ៖ scroll ផ្តេក ០ · ប្រអប់ ២៨ ×
ទំហំ ១៤ សមអេក្រង់ · ប៊ូតុងចុចដល់ទាំងអស់ · លំហូរ ស្កេន ➜ រក្សាទុក · ស្ទួន · Locker · ដក · បិទ · លុប ➜ ស្តារ មានសារត្រឹមត្រូវ ·
គោលដៅចុចផ្សេង (ប៊ូតុងតម្រង ២៧px · «📅 កញ្ចប់ប្រចាំថ្ងៃ» ២០px · «⋮» ២៥×២៤) ឆ្លង WCAG 2.2 AA (២៤px តាមគម្លាត) ➜ ទុកដដែល (ការពង្រីកនឹងប្តូរកម្ពស់ជួរ)។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A96 | **CSS ស្លាកបោះពុម្ពជ្រាបចូលក្រឡាស្ថិតិ** | `.stat-card .label` ៖ `border-top-style: dashed` · `padding: 11.34px` (៣mm) · `background: #fff` គ្រប់ទំហំ ៨ (រូបថត ៖ ប្រអប់ដាច់ៗជុំវិញស្លាក ៣) · មូលហេតុ ៖ `.label { … }` ទូទៅក្នុង `react-root.css` (2.50.65) | CSS ស្លាកនៅក្រោម `.label-sheet` ➜ `none` · `0px` · ថ្លា (ទិសផ្ទុយ ៖ `.label-sheet .label` នៅ dashed) |
| A97 | **ស្លាកបោះពុម្ពកាត់លុយ · បំបែកលេខ · លើសក្រដាស** | `LabelSheet` ពិត · media print · 'Liberation Sans' ៖ 50×30 លុយ ២ លើស (១៨៦/១៧៤px) · 40×30 meta ហួសបាត ៣ · លេខបំបែក ២ · 60×40 លុយ/meta ហួស ៧ · A4 ៣ ជួរឈរ ទទឹង [៣៣៤,៣៦០,៣០៩] សន្លឹកលើស ៣១៦px (បញ្ឈរ) · A4 ២ ជួរឈរ លើស ១០៩px · font ពិត ៖ em/តួ លុយ ០.៤៩–០.៦១ · លេខ ០.៥០–០.៦៥ | `container-type: inline-size` + `min(អតិបរមា, 100cqw / (តួ × ០.៦២))` (លុយ) · `(100cqw / តួ − letter-spacing) / ០.៦៦` (លេខ) · `minmax(0, 1fr)` ➜ ៤ ការអះអាង ✅ |
| A98 | **toast ជាន់របា Tab** | `#toastContainer` បាត ៥៤៤ ⟷ របា Tab កំពូល ៥០៨ (៣២០×៥៦៨) · ៨៧៦ ⟷ ៨៣៨ (៤១២) · ១០០០ ⟷ ៩៥៩ (៧៦៨) · ៤០៦ ⟷ ៣៦៥ (៩៣២×៤៣០) | `max(--tabbar-height + 12px, 24px + max(safe-area, --keyboard-cover))` ពេលរបា Tab បង្ហាញ < ៩៩២ ➜ ✅ · `chrome-hidden` · desktop ➜ ២៤px |
| A99 | **«៛» ធ្លាក់ម្នាក់ឯង** | «61,203,160 ៛» ៖ top តួលេខចុងក្រោយ ≠ «៛» (> ៣px) លើ ៣២០ · ៣៦០ · ៤១២ · ១២៨០ · ១៤៤០ (iPad ១០២៤–១៣៦៦ ក្នុងស្គ្រីបរុករក) | `white-space: nowrap` លើ `#summary*Riel` ➜ ✅ |
| A100 | **ប្រអប់ស្កេន ៖ Enter គ្មានប្រសិទ្ធភាព · ✖ តូច** | វាយលេខ + Enter ➜ cursor នៅដដែល (Locker/COD/DOD ត្រូវកណ្តុរ) · ☰ 🔔 ៣២×៣២ · ✖ ២៨×២៨ ➜ ចុច ±២០px ពីកណ្តាល ➜ ខុស ៨/៨ ចំណុច | Enter ➜ ប្រអប់បន្ទាប់ · DOD ➜ blur · `confirmPhone` ០ ដង · ✖ `::after` ៤៤×៤៤ ➜ ✅ · មិនលួចការចុចធាតុផ្សេង |
| A101 | **ផ្ទៃចុច ☰ ៤៤px ➜ PTR លើ APK ស្លាប់** (CI លើ `bc32e1f` ៖ shard ៣/៤) | `npm run native:check` FAIL ៣ ៖ ទាញចុះ ➜ មិន `spinning` · គ្មាន haptic · គ្មាន reload ➜ touch CDP នៅ (៤០,៥២) ក្រោម navbar ➜ Chromium touch adjustment បញ្ជូនទៅ `navMenuBtn` (`::after` ហួសបាត navbar ៦px) ➜ PTR ត្រូវ block · shard ២/៤ ៖ កណ្តាល ✖ ប្រអប់ស្កេន នៅ ២២px ពីជ្រុងកាត ➜ ចំណុចអង្កត់ទ្រូង (២០,−២០) ធ្លាក់លើជ្រុងមូលរបស់កាត (`--radius-xl` ➜ ក្រៅកាត) ➜ `layout` FAIL ១ | ដកការពង្រីក ☰ · 🔔 ➜ `native:check` ១១៦/០ · `tapTargetLayout` ៖ ទិសផ្ទុយ ក្រោមបាត ☰ · 🔔 ៤px មិនមែនប៊ូតុង (ដាក់ការពង្រីកវិញ ➜ FAIL) · អង្កត់ទ្រូង ±១៥px |

### 2026-10-15 — រាយការណ៍ម្ចាស់គម្រោងលើ 2.50.76 ៖ «បញ្ចូលច្រើន» + keyboard ➜ ទំព័ររអិលឡើង navbar បាត់ · វាស់គ្រប់ទំហំ រួម tablet

**វិធី** ៖ អាន focus ដោយកូដទាំងអស់ (`grep focusField(`) ➜ `openBatchScanModal()` focus ក្នុង `setTimeout` ១៥០ms គ្មាន `preventScroll` · Chromium មិនរំកិល document សម្រាប់ធាតុ fixed ➜ វាស់ **មូលហេតុ** ជំនួស ៖
spy `HTMLElement.prototype.focus` (options) + គំរូ document រំកិល (spacer absolute ➜ document រមូរបាន ដូច iOS ពេល keyboard) · ទំហំ tablet/ផ្តេកក្នុងច្បាប់ទីតាំង ➜ ធ្លាក់លើ `13a0421` ➜ ទើបកែ ·
run-all STRICT ពេញលើ `13a0421` (2.50.76) ៖ ✅ ២០៦/២០៦ (០ មួយផ្នែក · ០ រំលង)។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A95 | **ទំព័រខាងក្រោយរអិលឡើងពេល keyboard បើកក្នុងប្រអប់ · ទូរស័ព្ទផ្តេក Sheet import** | `focusField()` លើប្រអប់វាយ (ref) ៣៤ ក្នុងគ្រប់ប្រអប់ ➜ `preventScroll: false` ៣៤/៣៤ · `openBatchScanModal()` ពិត ➜ `batchBarcodeInput` `preventScroll: false` · document `scrollTo(0, 220)` ខណៈប្រអប់បើក (iOS standalone) ➜ នៅ ២២០ (`restoreIOSDocumentScroll()` តែពេលស្វែងរក) · 844×390 keyboard ២០០ ៖ `sheetImportModal` ផ្ទៃរមូរ `.si-scroll` [១០២,១០៦] = ៤px ➜ ប្រអប់វាយ ៤ មើលមិនឃើញ · iPad បញ្ឈរ/ផ្តេក ៖ ត្រឹមត្រូវរួច | `focusField()` ➜ `preventScroll` ក្នុង `.modal` · `iosModalDocumentLocked()` · `.modal.modal-kb > .si-modal-content { display: block }` ➜ `modal-keyboard-test` FAIL ៤ ➜ ៥៣/៥៣ |

### 2026-10-15 — រូបថត iPhone ម្ចាស់គម្រោងលើ 2.50.75 ៖ ប៊ូតុង PIN · ចំណងជើង «បញ្ចូលច្រើន» ត្រូវកាត់

**វិធី** ៖ App ពិត (audit build) · visualViewport ក្លែង 393×852 · keyboard ៤០០ (អានពីរូបថត ៖ ១.៥ px ក្នុងមួយ CSS px · បន្ទាត់ keyboard ≈ ៤៥២) ➜ វាស់កាតមុនកែ ➜ សរសេរច្បាប់ទីតាំងថ្មីក្នុង
`modal-keyboard-test` ➜ ធ្លាក់លើ `a7d9b02` ➜ ទើបកែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A94 | **ប្រអប់ខ្លីត្រូវកាត់ · ប្រអប់វែងមិនប្រើផ្ទៃពីលើ** | 2.50.75 · 393×852 · keyboard ៤០០ ៖ `pinModal` ២២៨px ➜ កាត [២៦៤,៤៤៤] = ១៨០ (ជាន់ `MODAL_KEYBOARD_MIN_VISIBLE_PX`) · ប៊ូតុងមើលមិនឃើញ · `editPhoneModal` ២១១ ➜ ១៨០ · `batchScanModal` ៤១០ ➜ ២២៣ (`scrollTop` ៣២ ➜ ចំណងជើងលាក់) ខណៈផ្ទៃ [១២,៤៤៤] = ៤៣២ · `lookupApiConfigModal` ៧៩០ ➜ ៣៨០ (កំពូល ៦៤ ៖ ៥២px ទំនេរពីលើ) · 375×667 ៖ ចំណងជើង «API» ក៏លាក់ដែរ · មូលហេតុ ៖ «កំពូលមិនផ្លាស់ទី» អនុវត្តលើគ្រប់ប្រអប់ ទោះប្រអប់នោះល្មមផ្ទៃ | `modalKeyboardFitFor()` ៖ ល្មម ➜ `top = line − height` · មិនល្មម ➜ `top = offsetTop + max(pad, --modal-safe-top + GAP)` · ដក `raised` · `focusedModalFieldClipped()` · `MODAL_KEYBOARD_MIN_VISIBLE_PX` · `modal-keyboard-test` (ទំហំទី ៤ + status bar ក្លែង) FAIL ៩ ➜ ៤៣/៤៣ |

### 2026-10-15 — សំណើម្ចាស់គម្រោង ៖ CI PR #317 ធ្លាក់ · ផ្ទៀងផ្ទាត់ការងារក្នុង PR ឡើងវិញ (ចន្លោះ · មុខងារខុសស្តង់ដារ)

**វិធី** ៖ log CI លើ `be04280` (ផ្នែក ២ · ៣ · ៤ ធ្លាក់ ១ ក្នុងមួយផ្នែក) ➜ កែ ➜ checker ទាំង ៣ ជាប់លើ build វាស់ · អានកូដដែល PR ប្តូរ ➜ សម្មតិកម្ម ➜ វាស់ក្នុង Chromium ពិត (visualViewport ក្លែងរបស់
`modal-keyboard-test`) មុនកែ ➜ ឧបករណ៍ធ្លាក់លើ tree មុនកែ ➜ ទើបកែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A91 | **CI ៣ ផ្នែកធ្លាក់** | `zoew-suite-test` ៖ eslint `no-useless-assignment` (`let caret = null; try { caret = … } catch (e) { caret = null; }` ➜ តម្លៃដំបូងមិនដែលអាន) + `@typescript-eslint/no-unused-vars` (`e`) · `function-surface-test` ៖ `touchById ×2` · `code-duplication-test` ៖ `touchById@25848 \| touchById@26090` (១៤០ តួ) + ប្លុក ៣៤៨ តួ (`focusIOSSearchWithoutScroll` ធៀប `focusModalFieldWithoutScroll`) ៖ [2.50.73] ចម្លង helper ជំនួសការនាំចូល | `catch {}` · `tapEndedInPlace(e, tap, slopPx, maxMs)` មួយ (cancelable · គ្មានម្រាមដៃនៅលើ · `touchById` · គម្លាត · ពេល) ➜ ៖ eslint ស្អាត · ២៧/២៧ · ១៤/១៤ · vitest iOS ៧ ឯកសារ ៧៨/៧៨ (`ios-search-tap-focus` ទ្រាំ `changedTouches` `[null, …]` ➜ រក្សា `touchById` ⛔ មិនមែន `touchByIdentifier()` របស់ `panel-motion.ts` ដែលអាន `.identifier` លើ `null`) |
| A92 | **toast នៅក្រោយ keyboard (iPhone · Android Chrome)** | toast `fixed` បាត ២៤px នៃ layout viewport ៖ iOS មិនបង្រួមវា ➜ keyboard ៣៣៦px បាំង ➜ App ពិត ៖ ១៦/១៦ ករណី (ទំព័រ · `batchScanModal` · `pinModal` · `lookupApiConfigModal` · រំកិល ០/១៤០ · 390×844 · 320×568) toast នៅ ៧៩០–៨២០ ធៀបផ្ទៃមើលឃើញ ០–៥០៨ / ១៤០–៦៤៨ · ផ្លូវពិត ៖ ប៊ូតុងក្នុងប្រអប់ (iOS មិនបិទ keyboard) · `startBatchScan()` ទទេ · `testLookupApiConfig` · កូដអញ្ជើញ · Barcode ស្ទួនក្នុង `hwScannerInput` | `measureKeyboardCover()` ➜ `uiState.keyboardCover` ➜ `--keyboard-cover` ➜ `.toast-container` ➜ ១៦/១៦ នៅក្នុងផ្ទៃមើលឃើញ និងនៅខាងលើប្រអប់ · keyboard បិទ / APK ➜ ២៤px · `modal-keyboard-test` +៥ · vitest +៤ |
| A93 | **សម្មតិកម្មដែលវាស់ហើយបដិសេធ** | បង្វិលអេក្រង់ខណៈ keyboard បើក (`naturalBox` វាស់ក្នុងបញ្ឈរ) ៖ 844×390 keyboard ២០០ ➜ `lookupApiConfigModal` កំពូល ១២ បាត ១៨២ ≤ ផ្ទៃមើលឃើញ ១៩០ · `editPhoneModal` ដូចគ្នា (ផ្លូវ «ផ្ទៃនៅសល់ < ជាន់» លើកកំពូល) · caret នៅចុងពេលចុចប្រអប់វាយលើកដំបូង (iOS) ៖ ការសម្រេចរបស់ [2.50.73] (ការចុចលើកទី ២ ដាក់ caret តាមកន្លែងចុច) | មិនប្តូរ |

### 2026-10-15 — រាយការណ៍ម្ចាស់គម្រោង ៖ ផ្ទៃពីលើ keyboard ពណ៌ពីរ (ទើសភ្នែក) · តេស្តសុវត្ថិភាពម្តងទៀត

**វិធី** ៖ ឧបករណ៍មុន ៖ `modal-keyboard-test` ថតរូប (Chromium screenshot · ស្រាយ PNG) តំបន់ក្រោយ keyboard ហើយវាស់គម្លាតពណ៌ រត់លើ 2.50.73 (`a5bf0af`) ➜ ធ្លាក់ ➜ ទើបកែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A90 | **ផ្ទៃក្រោយ keyboard ថ្លា ពណ៌ច្រើន · ផ្ទាំងចាក់សោ App ក្រោម keyboard** | 2.50.73 ៖ ៤០/៤០ ករណីពណ៌ច្រើន (390×844 ទំព័រទិន្នន័យ ៖ rgb [៨,១៤,២៥] ➜ [១១១,១១៦,១២៧] គម្លាត ១០៣ · រំកិល ១៤០ ៖ ១០២) ៖ ផ្ទៃងងឹតថ្លា ៦០% លើកាត · ប៊ូតុង · របារ tab ➜ keyboard ថ្លារបស់ iPhone ឃើញពណ៌ច្រើន · ផ្ទាំងចាក់សោ ៖ ក្រឡាគ្មានចំណុចលេច (ទំព័រខាងក្រោយ `visibility: hidden`) · ចុច · Escape · PIN ខុស ➜ នៅចាក់សោ | `.modal::after` ស្រអាប់ (ផ្ទៃងងឹតលើ `--body-bg`) ពី `--modal-kb-line` ចុះក្រោម ➜ ៤០/៤០ ពណ៌តែមួយ (គម្លាត ≤ ៣ · checker រក្សា ២៦ ករណី) · ផ្ទាំងចាក់សោ ៖ គ្មានផ្លូវរំលង (ចាក់សោក្នុង `modal-keyboard-test`) |

### 2026-10-15 — សំណើម្ចាស់គម្រោងលើ 2.50.72 ៖ ប្រអប់វែងផុតអេក្រង់ · ពីលើ keyboard ពណ៌ពីរ · តេស្តសុវត្ថិភាព PIN/Login

**វិធី** ៖ ឧបករណ៍មុន ៖ `modal-keyboard-test` សរសេរច្បាប់ថ្មី (ទីតាំងដើមលើអេក្រង់ · បាតត្រឹម keyboard · backdrop + `elementFromPoint` ក្នុងផ្ទៃ keyboard · ក្រឡាសុវត្ថិភាព) រត់លើ
2.50.72 (`b802db2`) ➜ ធ្លាក់ ➜ ទើបកែ · `pin-prompt-test` ផ្នែកថ្មីរត់លើ mutation ➜ ធ្លាក់។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A88 | **ប្រអប់ + keyboard ➜ ប្រអប់ទាំងមូលរំកិល (ប្រអប់វែងផុត) · ក្រោយ keyboard គ្មានផ្ទៃងងឹត (ពណ៌ពីរ) · ទំព័រខាងក្រោយប្រអប់ចូល/PIN ទទួលការចុច** | 2.50.72 ៖ ៣៤ កន្លែងវាយ × ៣ ទំហំ ធ្លាក់គ្រប់ទំហំ (390×844 ៖ PIN កំពូល ៣០៨ ➜ ១៤០ · backdrop [០,៥០៨] ឈប់ត្រឹម keyboard · ក្រោយ keyboard = ទំព័រ) · `lookupApiConfigModal` ១៨/១៨ កំពូលផ្លាស់ទី · រំកិល ១៤០ ៖ កំពូលលើអេក្រង់ ១៩៣ ➜ ២៥ · ក្រឡាសុវត្ថិភាព ៖ ២៣៨/៥៩៥ ចំណុចជាទំព័រ (`daily-stats-btn` · `appPages` ក្រោយ keyboard · `app-navbar` ពេលរំកិល) សម្រាប់ login · Activate · PIN · កំណត់ PIN · ចុចផ្ទៃងងឹតក្រោម keyboard មិនបោះបង់ PIN (ការចុចទៅទំព័រ) · APK ៖ កន្លែងវាយចុងក្រោយ [៦៤៧,៦៩៣] នៅក្រោមកាត (បាត ៤៧០) · iPhone ៖ ចុចកន្លែងវាយ ➜ touchend មិន preventDefault (iOS រំកិលទំព័រ) | `.modal` ពេញ + `::after` (`--modal-kb-pan` + safe-area) · `.modal-kb` តែប្រអប់ខាងលើគេ (កំពូលដើម + `offsetTop` · `max-height` ត្រឹម keyboard − ៨) · reveal គម្លាតបង្រួម · raised ពេលអ្នករមូរខាងក្នុងតូចជាងកន្លែងវាយ (`sheetImportModal` 320×568 ៖ `si-scroll` ៥៣px) · វាស់ក្រោយ React គូរ (`editPhoneModal` បើកខណៈ keyboard បើក ៖ មុន ➜ មិនតម្រូវ) · APK `resize` reveal · ការចុច iPhone ➜ `focusElementWithoutScroll()` ➜ ៣២/៣២ |
| A89 | **ផ្លូវរំលង PIN/Login ដែលអ្នកប្រើធ្វើបាន** | ផ្លូវដែលពិនិត្យ ៖ ចុចផ្ទៃងងឹត · Escape · Back (`native-back`) · ទំព័រខាងក្រោយ (ក្រឡា) · ប៊ូតុងដែលហៅគោលដៅក្រោយ PIN ដោយផ្ទាល់ (`ACTION_REGISTRY` ∪ `ACTION_ALLOWLIST` ៖ ១៤៨ ឈ្មោះ) · ប្រអប់កំណត់ PIN ពេលមាន PIN · PIN ខុស (សោ ៥ ដង/៦០ វិ.) · ការបោះបង់ (`cancelPinEntryFlow`/`cancelPinSetupFlow` សម្អាត `pinTargetAction`) ៖ គោលដៅក្រោយ PIN ១៤ ឈ្មោះ + `openConfigModal` ➜ ០ ដែលប៊ូតុងហៅដោយផ្ទាល់ · ២ ពិនិត្យខ្លួនឯង (`openZtoListSyncModal` · `recheckZtoPickupStatus` ៖ សោ secret ➜ `requestPinBeforeConfig(ខ្លួនឯង)`) · `pinSetupModal` បើកតែ `!savedPin` (២ កន្លែង) | គ្មានផ្លូវរំលងដែលអ្នកប្រើធ្វើបាន (ក្រៅពី A88 ដែលកែរួច) · `pin-prompt-test` ចាក់សោ (mutation ➜ ធ្លាក់) · ព្រំដែនដែលទទួលស្គាល់ ៖ ការកែ DOM/localStorage ដោយ DevTools (PIN · ចំនួនខុស) — «Inspect element» ការពារមិនបាន ហើយទិន្នន័យការពារដោយ rules (`auth != null`) មិនមែនដោយប្រអប់ |

### 2026-10-15 — វីដេអូម្ចាស់គម្រោងលើ 2.50.71 ៖ ប្រអប់ + keyboard ➜ អូសផ្ទៃខាងក្រោយ ➜ ញ៉ាក់

**វិធី** ៖ វីដេអូ `_030` (៨៨០×១៩២០ · ១២.៧ វិ.) ➜ ស៊ុម ៥/វិ.

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A87 | **ប្រអប់ + keyboard ➜ អូសផ្ទៃខាងក្រោយ ➜ ទំព័រ + ប្រអប់រំកិល ហើយលោតត្រឡប់** | វីដេអូ ៖ ២.៤ វិ. focus ➜ iOS រំកិលទំព័រ (ប្រអប់នៅកំពូល) ➜ ២.៦ វិ. ប្រអប់ចុះមកកណ្តាលពីលើ keyboard ([2.50.71]) · ៤.០–៥.២ វិ. អូស ➜ ប្រអប់ឡើងបាត់ក្បាលក្រោម status bar · ទំព័រខាងក្រោយឃើញនៅបាត ➜ លោតត្រឡប់ · ការចាក់សោការអូស (`blockIOSKeyboardPan` · touch-action) មានតែពេលស្វែងរក ➜ ប្រអប់គ្មាន · Chromium (`gesture-test` `webkitPan`) ៖ ផ្ទៃខាងក្រោយ touch-action `auto` · touchmove ដំបូងមិនចាប់ (ផ្ទៃខាងក្រោយ · កាត · textarea) | `iosKeyboardPanLocked()` រួមប្រអប់ · `gesture-test` ២ ធ្លាក់លើ 2.50.71 ➜ ១៧៦ · `ios-keyboard-pan.test.ts` +៤ · ⚠️ ការលោតពេល focus ដំបូង (iOS បង្ហាញកន្លែងវាយមុន keyboard ចប់) នៅដដែល · ⚠️ សកម្មភាព ១–២ [2.50.72] |

### 2026-10-14 — សំណើម្ចាស់គម្រោង ៖ ប្រអប់ដែលមានកន្លែងវាយ ត្រូវ keyboard បាំង

**វិធី** ៖ ឧបករណ៍មុន ៖ `modal-keyboard-test` (App ពិត · visualViewport ក្លែងព្រោះ Chromium គ្មាន keyboard · បញ្ជីប្រអប់ពី DOM) រត់លើ 2.50.70 ➜ ធ្លាក់ ➜ ទើបកែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A86 | **ប្រអប់ដែលមានកន្លែងវាយ ៖ keyboard បាំងកាត ឬកន្លែងវាយ** | 2.50.70 ៖ ៣៤ កន្លែងវាយ × ៣ ទំហំ ៖ គ្រប់ទំហំធ្លាក់ (ឧ. 390×844 ៖ PIN កាត [308,536] ផ្ទៃមើលឃើញ [0,508] · Config [205,639] · 320×568 ៖ កន្លែងវាយ PIN [272,318] ក្រោមផ្ទៃ [0,315]) · ផ្ទៃរំកិល ១៤០ ➜ កាតមិនតាម · បើកប្រអប់ខណៈ keyboard បើក ➜ នៅក្រោម · APK (viewport បង្រួម) ➜ នៅក្នុងរួច | `listenModalKeyboard()` ➜ `.modal` = visualViewport · `.modal-content` 100% · `revealFocusedModalField()` · ១៨/១៨ · mutation (បិទការរមូរកន្លែងវាយ) ➜ ៣ ធ្លាក់ · ⚠️ សកម្មភាព ១–២ [2.50.71] |

### 2026-10-14 — រាយការណ៍ម្ចាស់គម្រោង ៖ មានតែការអូសក្នុងប្រអប់វាយលេខស្វែងរកដែលរំកិលទំព័រ (iPhone)

**វិធី** ៖ ម្ចាស់គម្រោងបញ្ជាក់ ៖ កន្លែងផ្សេងទប់បាន · មានតែការអូសចាប់ផ្តើមក្នុងប្រអប់វាយលេខ ➜ អាន `blockIOSKeyboardPan()` (លើកលែង `INPUT`/`TEXTAREA` គ្រប់ប្រអប់) និងប្រភព WebKit
`main` (`WKContentViewInteraction.mm` `deferringGestureRecognizer:shouldDeferOtherGestureRecognizer:` · `HTMLInputElement::createInnerTextStyle`)។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A85 | **keyboard បើក ➜ អូសឡើងចុះក្នុងប្រអប់វាយលេខស្វែងរក ➜ ទំព័រ + navbar រំកិល** | WebKit ៖ `_touchMoveDeferringGestureRecognizer` ពន្យារ `UIPanGestureRecognizer`/`UIPinchGestureRecognizer` ទាំងអស់ក្រោម web view ហើយបោះបង់វាតែពេល touchmove ដំបូងត្រូវ preventDefault (`_touchStartedNearSelectionHandle` ➜ មិនពន្យារ) · inner text របស់ input = `overflow: hidden` (មិនមែនអ្នករមូរ ➜ touch-action `none` ពី body) ➜ pan ដែលរំកិលទំព័រ = pan របស់ text interaction ដែល touch-action មិនឃាត់ · `blockIOSKeyboardPan()` លើកលែងប្រអប់អក្សរ ➜ មិនទប់ · Chromium (`gesture-test` `webkitPan`) ៖ `#searchPhoneInput` focus · អូសចុះ/ឡើង ➜ touchmove ដំបូងមិនចាប់ ➜ pan ចាប់ផ្តើម | ប្រអប់ស្វែងរក (`IOS_SEARCH_FIELDS`) អូសបញ្ឈរ ➜ ទប់ · `gesture-test` ១ ធ្លាក់លើ 2.50.69 ➜ ១៧០ · `ios-keyboard-pan.test.ts` +១ · ⚠️ សកម្មភាព ១–២ [2.50.70] |

### 2026-10-14 — ការផ្ទៀងផ្ទាត់ PR #317 ឡើងវិញ (សំណើម្ចាស់គម្រោង) ៖ keyboard បើក · បញ្ជីលេខដែលស្នើ · ការដោះ snap ភ្លាម

**វិធី** ៖ អាន diff ទាំងមូល `origin/main..5fad053` (កូដដែលដឹកជញ្ជូន) ➜ ចំណុចដែល tool មិនទាន់វាស់ ៖ checker [2.50.68] ពិនិត្យតែ ៦ ចំណុចដែលរើស ➜ ប្តូរទៅក្រឡា ២២px លើផ្ទៃខាងលើ
keyboard ទាំងមូល (ទំព័រទិន្នន័យ · ទំព័រស្កេន · Suggestion) · ប្រភព WebKit `main` (`LocalFrameViewLayoutContext.cpp` · `LocalFrameView.cpp` · `RenderLayerScrollableArea.cpp` ·
`ScrollingEffectsController.cpp` · `ScrollableArea.cpp`) សម្រាប់ការដោះ snap ភ្លាម។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A83 | **keyboard បើក ➜ អូសលើបញ្ជីលេខដែលស្នើ ➜ ទំព័ររំកិល** | ក្រឡា ៣៨០ ចំណុច ៖ Suggestion ២ ជួរ (sh = ch) ➜ `.phone-suggest-item` · `-number` · `-meta` ៤២ ចំណុច `auto` ➜ scroll view មេ · ១២ ជួរ (រមូរបាន) ➜ ១៥៤ ចំណុចក្នុង `#phoneSuggestBox` `overscroll-behavior-y: auto` (ចុងបញ្ជីបន្ត) · ទំព័រស្កេន ៖ ០ · ទំព័រទិន្នន័យ (បញ្ជីពេញ · ទទេ) ៖ ០ | `iosKeyboardSuggestFixed` ➜ `body.ios-keyboard-suggest-fixed` ➜ `touch-action: none` · `contain` · `gesture-test` ២ ធ្លាក់លើ 2.50.68 ➜ ១៦៦ · ⚠️ សកម្មភាព ១ [2.50.69] |
| A84 | **ការដោះ snap ភ្លាមក្នុង `settleIOSSearchPullDown()` ([2.50.68]) នៅតែលុប snap state?** | WebKit ៖ អ្នករមូរ overflow (`#appPages`) គណនា snap offsets ក្នុង layout ខ្លួនឯង (`RenderLayerScrollableArea::updateScrollInfoAfterLayout` ➜ `updateSnapOffsets` ➜ `scroll-snap-type: none` ➜ `clearSnapOffsets` ➜ `m_scrollSnapState = nullptr`) · layout ដែលបង្ខំ (អាន `scrollTop`) ដំណើរការ post-layout ភ្លាម (`runOrScheduleAsynchronousTasks`) · state ថ្មីជ្រើសសន្ទស្សន៍ជិតបំផុត (`shouldComputeCurrentSnapIndices`) · ការទាញចុះតាម `glidePhoneSearchPulledUp()` កាន់ token ការរអិលខ្លួនឯងរហូតចប់ | គ្មានការកែ · ⚠️ `resnapAfterLayout` ក្នុង `performPostLayoutTasks` សម្រាប់តែ frame view ក្នុង WebKit `main` ➜ យន្តការ re-snap ពិតលើ iOS ដែលកំពុងប្រើ មិនទាន់វាស់បាន ➜ ការផ្អាកគ្រប layout នៃ commit ទាំងពីរករណី |
| — | `.modal-content` ដែលរមូរមិនបាន ពេលប្រអប់បើកលើការស្វែងរកទាញឡើង + keyboard | backdrop `none` (ហាម) · ក្នុង `.modal-content` (`overflow-y: auto`) ➜ `auto` ដូចប្រអប់ទាំងអស់ពីមុន | មិនកែ (ក្រៅសំណើ · មិនមែនការថយក្រោយ) · កត់ក្នុង `CLAUDE.md` «Not covered» |

### 2026-10-14 — វីដេអូម្ចាស់គម្រោងលើ 2.50.67 ៖ iPhone keyboard បើក ទំព័ររំកិល · ប្រអប់ស្វែងរកលិចពាក់កណ្តាលក្រោយបិទ keyboard

**វិធី** ៖ វីដេអូ `_441` (៨៨០×១៩២០ · ១៣.៨ វិ.) + រូបថត ➜ ប្រភព WebKit ពិត (`WKContentViewInteraction.mm` `_handleTouchActionsForTouchEvent` · `WKTouchActionGestureRecognizer.mm` ·
`WKWebViewIOS.mm` `axesToPreventScrollingForPanGestureInScrollView` · `ScrollingTreeScrollingNodeDelegateIOS.mm` · `StyleAdjuster.cpp` `computeUsedTouchAction`) ➜ គំរូក្នុង `gesture-test` លើ CSS ពិត។
⚠️ ហេតុដែល `blockIOSKeyboardPan()` មិនទប់ក្នុងវីដេអូ (បញ្ជីទទេ ➜ Chromium វាស់ «គ្មានកន្លែង» ➜ ការសម្រេច block) មិនទាន់វាស់បានក្រៅ iPhone ➜ ការកែមិនពឹង JS ទៀតទេ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A81 | **iPhone PWA ៖ keyboard បើក ➜ ទំព័រ + navbar រំកិល** | វីដេអូ ៖ ស្វែងរក (keyboard · បញ្ជីទទេ) ➜ ៤.៥ · ៧.៥ · ៩.០–១០.៥ វិ. ទំព័រទាំងមូលឡើង ~៦០pt (navbar ចេញ) ➜ លោតត្រឡប់ · WebKit ៖ touch-action នៅចំណុចចាប់ផ្តើម ➜ `_preventsPanningInYAxis` ➜ scroll view មេមិនរំកិល (UI process · មិនពឹង JS) · Chromium វាស់ (គំរូ WebKit) ៖ navbar `pan-y` (html/body) · ប្រអប់ស្វែងរក `manipulation` · កាត · ដងអូស `auto` (`.app-pages` `overflow-y: hidden` ➜ `overflow-x` = `auto` ➜ ចាប់ផ្តើម auto ឡើងវិញ) ➜ មិនហាម Y ទាំងអស់ · បញ្ជីទទេ ៖ sh = ch = 246 (គ្មាន scroll view កូន) | `body.ios-keyboard` ➜ `touch-action: none` លើ `body` · `.app-pages` · បញ្ជីរមូរមិនបាន ➜ `body.ios-keyboard-list-fixed` · `gesture-test` ៥ ធ្លាក់លើ 2.50.67 ➜ ១៦០ · ⚠️ សកម្មភាព ១ [2.50.68] |
| A82 | **iPhone PWA ៖ បិទ keyboard ហើយអូស ➜ ប្រអប់ស្វែងរកលិចពាក់កណ្តាល** (រូបថត ៖ កាតបញ្ជីនៅ ~៤៨pt ក្រោមទីតាំង snap · ក្នុង proximity) | ការផ្អាក snap របស់ [2.50.67] មិនដោះ token (រង់ចាំពិដាន `PANEL_SEARCH_GLIDE_MS + PANEL_GLIDE_HOLD_MAX_MS + PANEL_GLIDE_SNAP_GRACE_MS` ≈ ០.៨ វិ.) ➜ UIScrollView កំណត់គោលដៅនៅពេលលែងដៃ (snap offsets ទទេ) ➜ ឈប់ពាក់កណ្តាល | ដោះការផ្អាកភ្លាមក្រោយ layout នៃ commit · ម្រាមដៃក្នុងចន្លោះទាញចុះ ➜ `endPanelGlideSnapPause()` · `ios-search-resnap.test.tsx` +៤ (៤ ធ្លាក់លើ 2.50.67) · ⚠️ សកម្មភាព ២ [2.50.68] |

### 2026-10-14 — វីដេអូម្ចាស់គម្រោងលើ PR #317 ៖ iPhone PTR នៅពិបាក · ប្រអប់ស្វែងរកនៅលាក់ពេលបិទ keyboard ➜ ប្រភព WebKit ពិត

**វិធី** ៖ ញែកវីដេអូ ២ (ffmpeg ៖ ២–១២ ស៊ុម/វិ. · ស៊ុមកាត់ផ្នែកខាងលើ) ➜ សម្មតិកម្មពីការអានកូដ ➜ អានប្រភព WebKit ពិត (GitHub `WebKit/WebKit` `main` ៖
`WKContentViewInteraction.mm` · `WebPageProxy.cpp` · `ScrollSnapAnimatorState.cpp` · `ScrollingEffectsController.cpp` · `ScrollableArea.cpp` · `ScrollAnimator.cpp` ·
`LocalFrameView.cpp` · `LocalFrameViewLayoutContext.cpp` · `ScrollSnapOffsetsInfo.cpp`) ➜ គំរូក្នុងអ្នកយាម (Chromium/happy-dom មិនអនុវត្តច្បាប់ WebKit) ➜ ធ្លាក់លើដើមឈើ PR #317 ➜ កែ។
⚠️ ការចាប់ DOM `cancelable` សម្រាប់ touch event «unpreventable» នៅក្នុង WebKitAdditions (មិនមែនប្រភពបើក) ➜ សន្និដ្ឋានពីវីដេអូ (ទាញវែងគ្មានរង្វង់ = PTR `park()` ដោយ `!e.cancelable`)។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A79 | **iPhone PWA ៖ PTR ម្តងកេះម្តងអត់** (ម្ចាស់គម្រោង ៖ «PTR នៅតែពិបាក» ក្រោយ switch haptic ដកចេញ · A77 មិនមែនមូលហេតុ) | វីដេអូ `_541` (៨៨០×១៩២០ · ២៧.២ វិ.) ៖ ទាញ ≥ ៧ ដង ទំព័រ bounce ~១០០–១៩០pt (រង្វង់មិនលេច) · កេះ ១ ដង (១២.៦ វិ. ៖ រង្វង់ + ទំព័រ bounce ព្រមគ្នា) · WebKit ៖ `handlePreventableTouchEvent` ➜ `m_touchMovePreventionState` `Waiting` តែ touchmove **ដំបូង** ➜ `doneDeferringTouchMove(handled)` · `scrollViewWillStartPanOrPinchGesture` ➜ `_touchEventsCanPreventNativeGestures = NO` ➜ event បន្ទាប់ `handleUnpreventableTouchEvent` លើកលែង `isDefaultPrevented` ជាប់ (`_touchEvent:preventsNativeGestures:`) · PTR iOS ចាប់តែក្រោយ `AXIS_SLOP` 22px > hysteresis pan ~១០pt ➜ ករណីកេះ = move ដំបូងលោតឆ្ងាយ ឬ move មុន pan ត្រូវចាប់ (bounce + រង្វង់ = ស៊ុម ១២.៦ វិ.) | `claimsBeforeSlop()` ៖ iOS standalone ចាប់ touchmove ចុះបញ្ឈរតាំងពី move ដំបូង (ដូច APK) · ប៊ូតុងក្នុងជួរតារាងមិនចាប់មុន slop · `gesture-test` គំរូ `webkitPan` ៨ ធ្លាក់លើ PR #317 ➜ ១៥០/១៥០ · `LOCK` ថ្មី · ⚠️ សកម្មភាព ១ [2.50.67] |
| A80 | **iPhone PWA ៖ បិទ keyboard ➜ ប្រអប់ស្វែងរកនៅលាក់ ~១ វិ.** (ការកែ A78 មិនដើរ) | វីដេអូ `_804` (៨៨០×១៩២០ · ១៤.៤ វិ.) ៖ blur ៨.៩០ វិ. ➜ ប្រអប់ស្វែងរក **រអិលឡើង** ៨.៩៨–៩.៣២ ➜ លាក់ក្រោម navbar ➜ លោតត្រឡប់ ៩.៩៨ (= ១៥០ms blur + `IOS_SEARCH_PULLDOWN_SETTLE_MS` ៩៩០ms) · ករណីទី ១ (៣.០ ➜ ៤.០ វិ.) ដូចគ្នា · CSS ៖ `.page-main` ជាគោលដៅ snap តែមួយ · WebKit ៖ `ScrollSnapAnimatorState::resnapAfterLayout` រក្សាប្រអប់ដែល snap មុន layout · ខណៈទាញឡើង offset `.page-main` = ០ = scrollTop ➜ កត់ `.page-main` · `performPostLayoutTasks` ➜ `resnapAfterLayout()` សមកាលក្នុង layout ដែល `getBoundingClientRect` បង្ខំ (`runOrScheduleAsynchronousTasks`) ➜ ការពិនិត្យ [2.50.66] រត់ក្នុង subscriber **មុន** React commit (`dataPanelSearchFocus` immediate ➜ `flushSync`) ➜ ឃើញ ០ · `scroll-snap-type: none` ➜ `setSnapOffsetsInfo(empty)` ➜ `m_scrollSnapState = nullptr` · state ថ្មី ➜ `updateActiveScrollSnapIndexForClientOffset()` (proximity ០.៣ snapport) · scroll ពី App ➜ `setCurrentPosition` ➜ index ជិតបំផុត | `settleIOSSearchPullDown()` ៖ `beginPanelGlideSnapPause()` មុន commit (commit ដដែល) · `ios-search-resnap.test.tsx` ៤ (គំរូ WebKit លើ React ពិត · ៣ ធ្លាក់លើ PR #317 · ១ = គំរូអាចធ្លាក់) · ⚠️ សកម្មភាព ២ [2.50.67] |

### 2026-10-14 — វីដេអូម្ចាស់គម្រោង ៖ iPhone PWA ស្វែងរកលេខពេល keyboard បើក ➜ ទំព័ររំកិលតាមម្រាមដៃ ហើយលោតត្រឡប់ ➜ [2.50.65]

**វិធី** ៖ ញែកវីដេអូ (VID_20261014_155824 · ៨៨៤×១៩២០ · ៦០ ស៊ុម/វិ. · ២១.៩ វិ. · keyboard លេខបើកពេញវីដេអូ · ប្រអប់ស្វែងរកទាញឡើង) ជាស៊ុម ៣០ ស៊ុម/វិ. (`ffmpeg`) ➜ វាស់ទីតាំងបញ្ឈរ
នៃកាតស្វែងរក + ក្បាលបញ្ជី (template ១៤០px) រាល់ស៊ុម ➜ អានកូដ `ios-viewport.ts` · CSS `search-focus` · ច្បាប់ 2.50.42/2.50.45 ➜ សង់ vitest ដែលធ្លាក់លើកូដមុនកែ ➜ កែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A76 | **iPhone PWA ៖ អូសលើកាតបញ្ជីខណៈស្វែងរកលេខ ➜ ទំព័រទាំងមូលរំកិលឡើង ហើយលោតត្រឡប់** (ម្ចាស់គម្រោង ៖ «ចលនា scroll iOS ខុសប្រក្រតី · APK · PWA Android រលូន») | ព្រឹត្តិការណ៍ ៧ (១.១ · ២.៣ · ៣.៧ · ៤.៨ · ៦.២ · ១៨.២ · ១៩.៤ វិ.) ដូចគ្នា ៖ ទំព័រទាំងមូល (navbar · ប្រអប់ស្វែងរក · កាត) រំកិលឡើង > ២០០px (មាត្រដ្ឋាន ៤៨០) ក្នុង ១៣០–៣០០ms តាមម្រាមដៃ ➜ បង្ហាញផ្នែកសដែលនៅក្រោយ keyboard (ប៊ូតុង «បន្ថែម» · ចន្លោះទទេ) ➜ ឈរ ២០០–៣០០ms ➜ ត្រឡប់ ០ ក្នុង **១ ស៊ុម** (មិនមែន rubber band ដែលមានចលនា) · Chromium (ក្លែង iOS standalone) ៖ `.page-main` ក្រោម `search-focus` = `flex: 1 1 0` ក្នុង `.app-page.active { height: 100% }` នៃ `.app-pages` = `100dvh − chrome` ➜ iOS មិនបង្រួម `100dvh`/`innerHeight` ពេល keyboard បើក (Android បង្រួម) ➜ កាតលាតដល់ក្រោយ keyboard · ជួរនៅទីនោះមើលមិនឃើញក្រៅពីអូស document (iOS អនុញ្ញាតទោះ `html.ios-standalone { overflow-y: hidden }`) · `restoreIOSDocumentScroll()` (2.50.42) ត្រឡប់ ០ ពេល `scroll` មកដល់ = ចុងកាយវិការ (WebKit ផ្ញើ `scroll` ពេល viewport ស្ថិរ) ➜ លោត ១ ស៊ុម | (១) inset keyboard ពី `visualViewport` ➜ `.app-pages` `padding-bottom` ➜ កាតចប់ពីលើ keyboard (គ្មានជួរលាក់ · គ្មានហេតុអូស) · (២) `touchmove` បញ្ឈរក្រៅអ្នករមូរមានកន្លែង ➜ `preventDefault()` (ដូច body-scroll-lock លើ iOS) ➜ document មិនរំកិល · ការត្រឡប់ ០ នៅជាខ្សែទីពីរ · ⚠️ keyboard iOS វាស់មិនបានក្នុងបរិស្ថាននេះ ➜ ត្រូវសាកលើ iPhone ពិត · `ZoeW/tests/ios-keyboard-pan.test.ts` ១០ ធ្លាក់លើដើមឈើមុនកែ |
| A77 | **iPhone PWA ៖ PTR អត់ញ័រ** (ម្ចាស់គម្រោង) | `hapticTick()` ៖ APK ➜ Capacitor Haptics · web ➜ `navigator.vibrate` — WebKit (iOS Safari · PWA) គ្មាន `vibrate` ➜ គ្មានអ្វី (ច្បាប់ចាស់ «iPhone web has no vibration API») · ឯកសារ WebKit/Safari 17.4 ៖ `<input type="checkbox" switch>` លេង haptic ប្រព័ន្ធពេលផ្លាស់ ទាំងពី `label.click()` (ការប្រើទូទៅ ៖ បណ្ណាល័យ haptic web លើ iOS 18) · Chromium/Firefox/jsdom គ្មាន IDL `switch` ➜ `'switch' in input` = false | `iosHapticSwitchTick()` ជាផ្លូវធ្លាក់ក្រោយ `vibrate` · សាងម្តង · ក្រៅអេក្រង់ · ⚠️ វាស់មិនបានក្រៅ iPhone ➜ សកម្មភាព ៣ · `haptic-ios-switch.test.ts` ៥ · ⛔ **ដកចេញក្នុង [2.50.66]** ៖ `label.click()` ក្នុងកាយវិការធ្វើឲ្យ PTR iOS ម្តងដើរម្តងអត់ (ម្ចាស់គម្រោង) · iOS 26.5+ លេងញ័រតែពីចុចផ្ទាល់ (WebKit bug 309082 · ios-haptics «iOS 17.4–26.4») ➜ ព្រំដែនទទួលស្គាល់ ៖ iPhone web គ្មានញ័រ PTR |
| A78 | **iPhone PWA ៖ បិទ keyboard ក្រោយស្វែងរក ➜ ប្រអប់ស្វែងរកលាក់ក្រោម navbar** (ម្ចាស់គម្រោង ៖ «scroll ទៅលាក់ ស្វែងរក អត់ជិតស្អាត» · Android ត្រឹមត្រូវ) | រូបថត ៖ navbar នៅនឹង · ក្រោម navbar ឃើញតែផ្នែកក្រោមប្រអប់ស្វែងរក (≈ 45px) · ដៃអូស · កាតបញ្ជី ➜ `#appPages` រំកិល (មិនមែន document) · Chromium ក្លែង iOS (audit build · ៣៩០×៨៤៤ · ៣៧៥×៦៦៧) ៖ ចាប់ពី scrollTop ០ · កណ្តាល (411) · snap `.page-main` (411) ➜ ទាញឡើង ➜ `overflow-y: hidden` · ចន្លោះរមូរ ០ ➜ scrollTop ០ ➜ ទាញចុះ ➜ ០ · កាតស្វែងរក top 374 (ឃើញពេញ) ➜ Chromium/Android មិនបង្កបាន · WebKit ៖ snap offsets ២ (page-side · page-main) ស្មើ ០ ខណៈទាញឡើង ➜ ក្រោយប្លង់ប្រែ re-snap ទៅ `.page-main` ឬរក្សាទីតាំងមុន focus (វាស់មិនបានក្រៅ iPhone) | `settleIOSSearchPullDown()` ៖ ទាញចុះ ➜ `#appPages` ០ ក្នុង microtask ដដែល + `panelGlideFrom()` ពីទីតាំងដែលឃើញ (មិនលោត) · ពិនិត្យយឺត `IOS_SEARCH_PULLDOWN_SETTLE_MS` (ម្រាមដៃប៉ះ · ទាញឡើងវិញ · focus ➜ មិនប៉ះ) · iOS standalone ទូរស័ព្ទតែប៉ុណ្ណោះ · `ios-search-pulldown.test.ts` ៥ (មុនកែ ៤ ធ្លាក់) · ⚠️ សកម្មភាព ១ [2.50.66] |

### 2026-10-14 — Deep audit ជុំទី ៤ ៖ toast ↔ ដំណាក់កាលការសរសេរ · Supabase replay មិនចូលដំណាក់កាល · 🧠 ការណែនាំ · ZoeW 2.50.64

សំណើម្ចាស់គម្រោង ៖ «Deep Audit Project ទាំងមូល … real live toast និងបន្ថែមភាពឆ្លាតវៃ»។ វិធី ៖ Sentry (issue មិនទាន់ដោះស្រាយ ៩ · ៣០ ថ្ងៃ) · អានផ្លូវពិត (Remove · Delete · Restore · close/reopen · scan save · ledger · registry · toast · connection flow · sheet import · Apps Script ២ · lookup) · run-all STRICT baseline លើ `ef0bf5b` (PR #314) ➜ ០ FAIL · វាស់ចន្លោះដែល checker មិនយាម។

- **Sentry (ឧបករណ៍ពិត · 2.50.47–2.50.57)** ៖ `Database link unresponsive` (probe ពេល resume · ៣ អ្នកប្រើ Android 16 APK) · `Database operation stalled` · `Cleanup stopped after a database switch` (ការសម្អាត ២ ម៉ោង stage `claim` ដែលចប់ក្រោយប្តូរ session · iPhone PWA) · `Interrupted cleanup resumed with unverified ledger` (2.50.47 ចាស់ ៖ journal `ledger` គ្មានភស្តុតាង ➜ មិនប៉ះលុយ · ប្រាប់អ្នកប្រើ) · `permission_denied` លើ trash ៧ ដង (rules មិនទាន់ Publish · [2.50.49] សកម្មភាព ១) · «Perf overlay» ១៣៦ event ពី build ក្រៅ git ➜ **ទាំងអស់ជាអ្នកយាមដែលដើរតាមការរចនា** — គ្មាន event ប្រាក់ស្ទួន · គ្មាន exception មិនស្គាល់។
- **ចន្លោះ ១ (កែ)** ៖ `liveToastState()` អាន transport · listener ប៉ុណ្ណោះ ➜ ✅ «ទិន្នន័យទាន់សម័យ» ខណៈ `connectionFlowSnapshot()` = `recovering` (journal Firebase · replay Supabase) ឬ `blocked` ឬ `syncing` (`isDatabaseInitialized` false · គ្មាន path pending) — របាខាងលើ (`renderConnectionStatus()`) ប្រាប់ «កំពុងផ្ទៀងផ្ទាត់ការសរសេរ...» តែ toast ប្រាប់ ✅ ➜ ផ្ទុយគ្នា · ការសរសេររង់ចាំដែលនឹងប្តូរលេខមិនទាន់សម្រេច។ កែ ៖ `liveWritePhaseState(head)` អាន `viewState.connectionPhase` (ដាក់ដោយ `renderConnectionStatus()` មុន `refreshLiveToasts()` — មិនហៅ `connectionFlowSnapshot()` ពី `toast.ts` ព្រោះ `connection-flow ➜ native-write-recovery ➜ tx-outcome ➜ network ➜ toast` ជារង្វង់) ➜ `blocked` = ⚠️ settled · `recovering` · `syncing` = 🔄 unsettled · `config` មិនប្រែ (សារនោះនិយាយតែការតភ្ជាប់)។ តេស្តធ្លាក់ ៤/៥ លើដើមឈើមុនកែ (`expected 'ready' to be 'recovering'` · `null to be 'signin'` · `'success' to be 'warn'` · `0 to be 1`)។
- **ចន្លោះ ២ (កែ)** ៖ `connectionFlowSnapshot()` អាន `db.recoveryState().blocked` របស់ Supabase តែមិនអាន `.recovering` ➜ ខណៈ `recoverWrites()` ផ្ញើ `zoe_write` ឡើងវិញ ដំណាក់កាល = `ready` (Firebase ៖ `nativeWriteRecoveryState().recovering` ចូល `recovering` រួចហើយ) ➜ របា «ភ្ជាប់ Server រួចរាល់» ខណៈ replay ដើរ · `canWrite` មិនប្រែ (`recovering` សរសេរបាន)។
- **ចន្លោះ ៣ (កែក្នុង template · ម្ចាស់គម្រោងសម្រេច «យកស្អាត»)** ៖ `zto-import/google-sheets-api/Code.gs` cache `customer_rows_v2_<lastRow>` ប្តូរសោតែពេលចំនួនជួរប្រែ · សំណើ `fresh=1` អានពី Sheet រួច **សរសេរ cache ឡើងវិញ** ➜ ការនាំចូលពី ZoeW (`scheduleCustomerTableSoonRefresh(true)`) ធ្វើឲ្យឧបករណ៍ផ្សេងឃើញទិន្នន័យថ្មីភ្លាម (JSON ≤ 90KB · ធំជាង ➜ cache មិនប្រើ) ➜ ចន្លោះនៅសល់តែពេលនាំចូល **ក្រៅ ZoeW** (Watch.gs · Index.html) ដែលកែជួរដែលមាន ឬ `replace` ចំនួនស្មើ ➜ ឧបករណ៍ផ្សេងអានចាស់ ≤ ៥ នាទី។ ជម្រើសដែលបដិសេធ ៖ សោតាមម៉ោងកែ Sheet (ត្រូវ `DriveApp.getFileById().getLastUpdated()` ➜ scope Drive ទាំងមូល + អនុញ្ញាតឡើងវិញ · ហៅ Drive រាល់សំណើ · ប្រែតាម tab ណាក៏បាន) · អ្នកសរសេរលុប cache អ្នកអាន (project ២ `CacheService` ដាច់ ➜ ត្រូវ `UrlFetchApp` + API_KEY ឆ្លង project)។ កែ ៖ `CACHE_TTL_SECONDS` 300 ➜ **60** (អាន Sheet ពេញ ≤ ១ ដង/នាទី · `SCRIPT_VERSION` 1 ដដែល ព្រោះទម្រង់ចម្លើយមិនប្រែ) · `google-sheets-cache-test` អាន TTL ពី `Code.gs` ហើយចាក់សោ ១០ ≤ TTL ≤ ៦០ (mutation 300 ➜ ធ្លាក់ · 60 ➜ ជាប់)។ ⛔ `Code.gs` ជា template ➜ ត្រូវ Deploy ដោយដៃ (សកម្មភាព ៣ ក្នុង [2.50.64])។
- **អានហើយគ្មានកំហុស (ភស្តុតាង = អ្នកយាមស្រាប់)** ៖ Remove/Delete/Restore/close ផ្លូវ session · late commit · trash slot · registry release (`executePermanentDelete()` ដោះសោភ្លាមគ្មាន `registryReleaseVerdict()` — ត្រឹមត្រូវ ៖ barcode ក្នុងធុងសំរាមស្កេនម្តងទៀតមិនបាន (`isBarcodeAlreadyUsed()` + registry) ➜ គ្មានម្ចាស់ផ្សេង) · scan save (claim ➜ ledger ➜ data · `null` ពេល barcode មានរួច = registry ស៊ីគ្នា) · sheet import (ពាក្យសម្ងាត់ encrypted AES-GCM តាម PIN · URL regex `/exec` · `LockService` · replace សរសេរមុនលុប) · lookup Apps Script (`API_KEY` fail-closed) · auth/session (4 ម៉ោង · `authGeneration` · persistence) · secret ៖ `headerValue` plaintext មានតែផ្លូវ legacy ➜ `encryptLookupSecret` ពេលរក្សាទុក · គ្មាន `console.log` secret · `security-guard-test` បៃតង។
- **🧠 ការណែនាំ (មុខងារថ្មី · «ភាពឆ្លាតវៃ»)** ៖ `src/features/health-advice.ts` (pure · `buildHealthAdvice(rows)` ➜ `{ level · title · steps ≤ 3 · healed }`) ៖ ស្គាល់ជួរតាម label (`HEALTH_ADVICE_LABELS` · Lookup តាមបុព្វបទ · Firebase/Supabase) · ជំហានតាមអត្ថបទ detail (`detailHas()`) · ច្បាប់មូលហេតុ ៖ `HEALED_BY_NETWORK` (database · clock · lookup · license) · `HEALED_BY_DATABASE` (clock) · ទម្ងន់ ❌ ០ / ⚠️ ១០ + ប្រភេទ (network ០ · storage ១ · database ២ · ផ្សេង ៣) · `HealthAdviceBox` (react-root.css · មិនប៉ះ `app.css` ដែលចាក់សោ) · `uiState.healthAdvice` null ពេល run ថ្មី និងពេល `healthCheckList` reset។ `doc-scope-test` ផ្នែក គ រាប់ `health…Row()` ក្នុង `runHealthCheck()` ដដែល ៩ (advice មិនមែនជួរ)។
- **ឯកសារ** ៖ `guide.html` §១៧ ធាតុ 🧠 · `announcements.json` ធាតុ `update` = 2.50.64 · `repository-file-coverage.json` +៤ ឯកសារ។
- **ភស្តុតាង (run-all STRICT · emulator RTDB · Postgres ពិត · firebase-tools ពិត)** ៖ baseline `ef0bf5b` ➜ ២០៤/២០៥ (ធ្លាក់តែ `version-bump-scope` ព្រោះកូដកំពុងកែខណៈរត់) · ជុំ ១ លើ `929e37f` ➜ ២០០/២០៥ (README កំណែចាស់ ×២ · `health-check-test` មិនស្រង់ `buildHealthAdvice` · `css-classes` class ផ្សំ `'health-' + level` · `emu/supabase-rules-parity` capture ធ្លាក់ក្រោម CPU រវល់) ➜ កែ `b2a0da9`–`5e7f2ee` · ជុំ ២ លើ `5e7f2ee` ➜ **២០៣/២០៥** (ធ្លាក់ `doc-scope-test` លិបិក្រមខ្វះឈ្មោះថ្មី ៣ · `revenue-fuzz` Playwright «Resulting promise was garbage collected» នៅ ៣,៨ វិ. មុនតេស្តចាប់ផ្តើម) ➜ កែលិបិក្រម `8070cb1` ➜ `RUNALL_ONLY=doc-scope-test,revenue-fuzz-test` **២/២ PASS** (revenue-fuzz ១៤៦ វិ. · ៣/៣)។ Fuzz seed ថ្មីលើដើមឈើវាស់ `8070cb1` ៖ `FUZZ_RUN0=700 FUZZ_RUNS=10 FUZZ_OPS=60 revenue-fuzz` ➜ PASS ៣/៣ (invariant ចំណូល ១០ លំដាប់ × ៦០ · «ឧបករណ៍ផ្សេងដក» បាញ់ ១០ · ledgerBlip applied ៩ · lost ៨) · `MFUZZ_RUN0=300 MFUZZ_RUNS=8 MFUZZ_OPS=40 collected-mirror-fuzz` ➜ ✅ ១,៩៧៧ · `CONNFUZZ_RUN0=200 CONNFUZZ_RUNS=6 CONNFUZZ_OPS=80 connection-state-fuzz` ➜ ✅ ៤,៤៣៩ (ជំហាន ៤៨០ · ស្ថានភាពចម្រុះ ២៣០)។ មិនអះអាង full fresh run ១ ដងដែលឆ្លង ២០៥/២០៥ លើ hash ចុងក្រោយ (`8070cb1` ប្រែពី `5e7f2ee` តែ `docs/HISTORY.md`)។

### 2026-10-14 — Deep audit ជុំទី ៣ ៖ ឧបករណ៍ ២ ពិតលើ emulator · ledger replay បញ្ចប់ពាក់កណ្តាលប្រតិបត្តិការ · ZoeW 2.50.62

សំណើម្ចាស់គម្រោង ៖ «deep audit ស៊ីជម្រៅមួយជុំទៀត … លែងមានកំហុសក្នុងការ sync/write ចូល backend និងគ្មានការដក/បូកស្ទួន ការសម្អាតស្វ័យប្រវត្តិដំណើរការត្រឹមត្រូវបំផុត តេស្តអោយបានច្រើនដង»។ មូលដ្ឋាន `ab53ef9` (2.50.61)។

- **តេស្តច្រើនដង (ឧបករណ៍ដែលមាន · seed ថ្មី · ដដែលៗ)** ៖ `revenue-fuzz` ៣ ជួរ seed ថ្មី (RUN0 100 × ១៤ × ៥០ · RUN0 500 × ៨ × ១២០ ➜ PASS · ledgerBlip ទាំង ២ របៀបបាញ់) · `collected-mirror-fuzz` RUN0 50 × ៨ × ១៤ ➜ ៧២៩ ok · `collected-value-fuzz` RUN0 1000 × ៤០០ ➜ ៣៥១២ ok · `emu/tx-disconnect` ×២ · `emu/ledger-revert` ×២ · `emu/restore-mutation` ×២ · `emu/app-writes-rules` · `emu/app-network-e2e` ×២ · `cleanup-interrupt-atomicity` ×៣ · `concurrent-scan` ×៣ · `partial-pickup-cleanup` · `duplicate-money` ×២ · `money-guardian` · vitest (session-switch fuzz · cleanup journal · trash retry · late commit · durable write · journal recovery · ledger ring) ×៣ ➜ **ទាំងអស់ជាប់** — គ្មានការដក/បូកស្ទួនក្នុងថ្នាក់ដែលឧបករណ៍ដែលមានវាស់។ ⛔ `revenue-fuzz` RUN0 300 × ១០ × ៨០ ធ្លាក់ម្តងដោយ harness (`page.evaluate: Resulting promise was garbage collected` — ទំព័រ reload ខណៈ evaluate ក្រោមការរវល់ CPU ពី checker ផ្សេងស្របគ្នា; រត់ម្តងទៀត ២ លំដាប់ដដែល ➜ ជាប់) — សូមមើលការរត់ម្តងទៀតខាងក្រោម។
- **ចន្លោះដែលឧបករណ៍មិនវាស់** ៖ គ្មាន checker ណាដាក់ **ឧបករណ៍ ២ ពិត** (App ពិត ២ context · SDK Firebase ពិត · rules ពិត) ឲ្យប្រជែងគ្នាលើទិន្នន័យតែមួយ ហើយ**ស្លាប់ពាក់កណ្តាលប្រតិបត្តិការ** (offline ➜ reload)។ `revenue-fuzz` = ឧបករណ៍ ១ លើ fake SDK (ឧបករណ៍ផ្សេង = ការចាក់) · `emu/app-network-e2e` = ការសរសេរ ១ ក្រោយ reload។ ➜ ឧបករណ៍ថ្មី `audit-tools/emu/money-multidevice-emu-test.js` ៖ ឧបករណ៍ A/B (uid ផ្សេង) · ១២ ជុំ × ៣–៤ លំដាប់ · op ចៃដន្យ (ស្កេន · បិទ · ដក · លុប · ស្តារ · កែតម្លៃ · ការសម្អាត ២h/៧ថ្ងៃ ដែលធ្វើឲ្យចាស់តាម REST owner រួចឲ្យឧបករណ៍ទាំងពីររត់ `runAutomaticCleanupRules()` ព្រមគ្នា) · របៀបបណ្តាញ ៖ online · offline➜online · offline➜**reload** (150–1550ms ក្រោយចាប់ផ្តើម op) · ស្ងប់ = ops ចប់ · pending ០ · journal ០ · cleanup journal ០ · phase ready · អថេរអានពី server (REST owner) ៖ ledger ថ្ងៃ = ផលបូក barcode `isDeducted !== true` · ledger ខែ = ផលបូកថ្ងៃ · ស្ថិតិយក = barcode បិទ · sum(pickedUpPhones) · barcode មិនស្ទួន · registry មិនកំព្រា · barcode ដែលធ្លាប់ដល់ server មិនបាត់ · គ្មានឧបករណ៍ blocked។
- **លទ្ធផលលើដើមឈើមុនកែ (2.50.61)** ៖ **ធ្លាក់ ៣/៣ លំដាប់** · ទាំង ៣ ចប់ដោយ `editPrice[offline-reload]` ៖ ឧ. run 0 ledger ថ្ងៃ cod ៨៧,០៨ ខណៈផលបូក barcode ៩១,២៦ (count ស្មើ ៧ = ៧) — ledger ប្រែតាម delta កែតម្លៃ តែ barcode នៅតម្លៃចាស់។ មូលហេតុ ៖ `saveEditedBarcodePrice()` និង `addOrUpdateEntry()` ចេញ delta ledger (`addRevenueToDailyAndMonthlyRecord`) **មុន** transaction ទិន្នន័យ (ledger optimistic · `correctRevenueLedgerToActual` ក្រោយ commit) ➜ ក្រៅបណ្តាញ ទាំងពីរចូល journal (row intent `revenue-delta` + row CAS history) ➜ reload ➜ queue SDK បាត់ ➜ recovery ៖ row CAS history ទម្លាក់ (តម្លៃ ≠ ផ្ញើ) តែ row intent ledger ➜ witness `not-applied` ➜ **replay** ➜ ពាក់កណ្តាលប្រតិបត្តិការ។ ស្កេន ៖ ការអះអាង registry (transaction) មុន ➜ ក្រៅបណ្តាញទាំងស្រុង មិនដល់ delta ទេ (ជាប់ · run 1 #0) តែបង្អួច «claim ack ➜ offline» មានដូចគ្នា។ ដក ៖ delta ចេញក្រោយ transaction history ack ➜ replay ត្រឹមត្រូវ (មិនប៉ះ)។ Supabase (probe `supabase-ledger-replay-companion.test.ts` លើ adapter ពិត + server ក្លែង CAS) ៖ ថ្នាក់ដដែល ៖ row CAS នីមួយៗ replay ដោយឯករាជ្យ ➜ CAS ledger conflict (ឧបករណ៍ផ្សេងសរសេរ ledger) ខណៈ CAS history ចុះ ➜ ledger ៥០ ជំនួស ៥៥ · ផ្ទុយ (history conflict · ledger ចុះ) ➜ ៤៥ ជំនួស ៤០ — **៣/៤ ធ្លាក់មុនកែ**។
- **កែ** ៖ intent `revenue-delta` ដែលការសរសេរទិន្នន័យជាដៃគូនៅដាច់ដោយឡែក (ស្កេន · កែតម្លៃ) ដឹកនាំ `companion` (`ledgerDeltaCompanion()` ៖ item · barcode · តម្លៃថ្មី · តម្លៃចាស់ — ស្កេន ៖ `targetItemId` បង្កើតមុន delta) ➜ Firebase `settleRow` ៖ អាន item តាម REST (អានមិនបាន ➜ deferred · មិនទាយ) ➜ `ledgerCompanionState()` ៖ `holds` ➜ replay (ដូចដើម) · `prior` + witness applied ➜ ដកវិញម្តង (token `op_r…` ➜ idempotent · recovery ម្តងទៀត ០ ការសរសេរ) · `absent`/`unknown` (ដកដោយឧបករណ៍ផ្សេង · កែបន្ត) ➜ ទម្លាក់ដោយមិនសរសេរ · Supabase `recoverWrites` ៖ row ដែលមាន companion មិន resend CAS ដើមទេ (base ចាស់នឹង conflict ខណៈ row ដៃគូចុះ) ➜ សម្រេចក្រោយ row ឯទៀត ➜ transaction ថ្មីពី intent (`ledgerJournalUpdate` · witness token) ក្រោយ recovery ចប់ (មិនមែនក្នុងវា ៖ `waitForWriteRecovery` រង់ចាំ recovery ➜ deadlock វាស់បានជុំទី ១)។
- **លំដាប់** ៖ item ថ្មីស្កេនក្រៅបណ្តាញ = `update` (receipt) ដែលត្រូវផ្ញើឡើងវិញ + row intent ledger ដែល queue មុន ➜ recovery ជុំដំបូងសម្រេច ledger មុន (`absent` ➜ ទម្លាក់) រួចទើប item ចុះ ➜ ledger ខ្វះកញ្ចប់ (mutation «ជុំតែមួយ» ➜ count ២ ជំនួស ៣ · គ្មានការសរសេរ ledger) ➜ Firebase `runRecovery` និង Supabase `recoverWrites` សម្រេច row ដែលមាន companion **ក្រោយ row ឯទៀតទាំងអស់**។
- **អ្នកយាមដែលត្រូវតាមក្រោយ** ៖ helper ថ្មី (`ledgerDeltaIntent` · `ledgerDeltaCompanion` · `ledgerCompanionState`) ចូលបញ្ជីស្រង់របស់ checker sandbox ១៣ (`revenue-rules-clamp` · `price-edit-abort` · `late-commit` · `cleanup-interrupt-atomicity` · `emu/ledger-revert` · `ledger-failed-apply-revert` · `tx-outcome` · `monthly-ledger-agreement` · `ledger-count-integrity` · `concurrent-scan` · `zto-list-sync` …) — sandbox ដែលខូចព្រោះ helper ថ្មី = checker រត់កូដពិត · `item-money` ៖ វាល companion ឈ្មោះ `wantCod`/`wantDod` (មិនមែនការសរសេរ `.cod/.dod`) · `clear-history-claim-test` ធ្លាក់ដោយ `DB_OP_TIMEOUT_MS` ប្រកាសពីរដង ៖ adapter Supabase (`supabase-rtdb.ts` រួច `supabase-sdk.ts`) import `domain/ledger` ➜ Vite ប្តូរ closure នៃ chunk `supabase-backend` ➜ លំដាប់ module ក្នុងទិដ្ឋភាព checker ប្រែទាំងស្រុង (CLEAR_HISTORY block ឥឡូវគ្របលើ `network.ts`) ➜ helper ចូលតាម `supabaseEnv().ledgerCompanion` ➜ លំដាប់ដូចដើមទាំង ១០០% (diff `audit-module-views.json` ទទេ) — កត់ជា trap ក្នុង CLAUDE.md។
- **ភស្តុតាង** ៖ `emu/money-multidevice-emu-test` ៤/៤ លំដាប់ × ១២ ជុំ ជាប់ក្រោយកែ · លំដាប់បន្ថែម RUN0 10 × ៦ × ១៦ ➜ ជាប់ (offline+reload · ការសម្អាតប្រជែង · ស្តារ/ដក ស្របគ្នា) · ពេលរត់លំនាំដើម ≈ ៥៥ វិ. (offline+reload ៦ · offline+online ៥ · ការសម្អាតប្រជែង ៣ · op ស្របគ្នា ១០+) · `ledger-replay-companion.test.ts` ៩/៩ (ធ្លាក់ ៧/៨ លើដើមឈើមុនកែ · តេស្តលំដាប់ធ្លាក់លើ mutation ជុំតែមួយ) · `supabase-ledger-replay-companion.test.ts` ៤/៤ (៣/៤ ធ្លាក់មុនកែ) · vitest ពេញ ១៦៥ ឯកសារ · ១៤៥២ តេស្ត · run-all STRICT **២០៥/២០៥** (partial ០ · SKIP ០ · `revenue-fuzz` RUN0 300 × ១០ × ៨០ រត់ម្តងទៀតម្នាក់ឯង ➜ PASS)។ ព្រំដែនដែលទទួល ៖ barcode ស្កេនក្រៅបណ្តាញដែល queue បាត់ដោយ reload មុន claim ចុះ មិនដែលដល់ server (ដូចមុន [2.50.59]) · delta ledger ស្កេនចុះរួចតែ save បាត់ (barcode `absent`) ➜ ទម្លាក់ដោយគ្មានការដកវិញ (មិនអាចបែងចែកពី «ដកដោយឧបករណ៍ផ្សេង» ដោយមិនអានធុងសំរាមទាំងមូល) ➜ ledger ខ្ពស់ បង្អួច RTT មួយ · receipt `zoew_write_receipts` ត្រូវអានទាំងមូលម្តងក្នុងមួយ session (purge) ហើយ receipt របស់គណនីដែលលែងប្រើមិនដែល purge (ទំហំ · មិនមែនលុយ)។

### 2026-10-13 — CI ធ្លាក់លើ `a5e2f89` (ផ្នែក 2/4) ៖ `shop-device-note.test.ts` រង់ចាំ fake ms ថេរ ខណៈ SHA-256 ពិតដើរលើ thread pool · គ្មាន bump

រាយការណ៍ម្ចាស់គម្រោង ៖ «CI fail»។ run 718 (`a5e2f89`) ៖ shard 2/4 ធ្លាក់ ១ (`zoew-suite 1/2` ➜ `npm run test`) ៖ `tests/shop-device-note.test.ts` «បើក App ៖ គណនីស្គាល់ហាង ➜ ផ្ញើ serial…» ➜ `expected [] to deeply equal [{…}]` (note `note_my_device` មិនដែលផ្ញើក្នុង `advance(3000)`); run 717 (`54cc15c`) ជាប់ · ៤ commits រវាងនោះ (2.50.61) មិនប៉ះ `shop-device` · `device-info` · transport · SDK Supabase ទេ។

- **បន្តផលមិនបាន** ៖ ឯកសារតេស្តរត់ ១២ ដង ក្រោម CPU hog ៦ ➜ ០/១២ ធ្លាក់ · ៣២ ដង ៨ instance ស្របគ្នា ➜ ០/៣២ ➜ មិនមែន CPU ធម្មតាទេ។
- **មូលហេតុវាស់បាន** ៖ `loadDeviceInfo()` ➜ `appSerialOf()` = `crypto.subtle.digest` ពិត (libuv thread pool ➜ macrotask) ក្នុងផ្លូវ boot (`restoreSession` ➜ `applyAccount` ➜ `onTenantChanged` ➜ `noteShopDevice()`)។ `advance(3000)` = ១២ × `advanceTimersByTimeAsync(250)` ➜ ផ្តល់ tick ពិតតែពីរបី ➜ digest ដែលយឺតលើសពីនោះ ➜ note មិនទាន់ផ្ញើ ➜ `[]`។ Probe ៖ ពន្យារតែ digest ទី១ (ផ្លូវ boot) ដោយ `setTimeout` ពិត ➜ **២ms ជាប់ · ១០ms ធ្លាក់ · ៣០ms ធ្លាក់ · ១០០ms ធ្លាក់** ដោយ assertion ដូច CI ដូចគ្នា (probe ដំបូងដែលពន្យារគ្រប់ digest ជាប់រហូត ១២០០ms ព្រោះ `await appSerialOf()` របស់តេស្តខ្លួនឯងរង់ចាំពេលពិតអោយ — probe ខុស)។ Runner CI ៤ core រត់ `money-guardian` + `supabase-app-network-e2e` + vitest `auto` ស្របគ្នា ➜ thread pool យឺត ១០ms+ កើតបាន។
- **កែ (តេស្តតែប៉ុណ្ណោះ · កូដ App មិនប្រែ)** ៖ `settle(done, maxFakeMs, maxRealMs)` ៖ រង់ចាំ `realSetTimeout(5)` ពិត (ចាប់មុន `useFakeTimers`) រវាងជំហាន fake ២៥០ms រហូត note មកដល់ · ពិដានពេលពិត ២០០០ms តាម `Date.now` ពិតដែលចាប់ទុក (⛔ `process.hrtime` · `performance.now` ត្រូវ fake-timers ក្លែងដែរ ➜ ពិដានបានវាស់ fake ms ➜ ជុំមួយ loop គ្មានពិដាន ➜ ធ្លាក់ដោយ timeout ៥s ជំនួស assertion) · `advance()` នៅដដែលសម្រាប់ `SHOP_DEVICE_RETRY_MS` (ការហៅបន្ទាប់ `await` ដោយតេស្តផ្ទាល់)។
- **ភស្តុតាង** ៖ តេស្តកែរួច ៣/៣ ជាប់ (≈ ២,២s) · probe digest ទី១ យឺត **១០០ms · ១០០០ms ➜ ជាប់** · mutation «server មិនដែលទទួល note» ➜ **ធ្លាក់ ៣/៣ ដោយ assertion** (`expected [] …` · «សាកម្តង» · `expected +0 to be 1`) ក្នុង ≈ ២s ក្នុងមួយតេស្ត (មិនមែន timeout)។ `typecheck` · `lint` ជាប់។

### 2026-10-13 — Deep audit PR #313 ឡើងវិញ (probe ពិត · មិនទុកចិត្ត checker) · ZoeW 2.50.60

មូលដ្ឋាន `eb88d7b` (PR #313 head · ៨ commits លើ `main` `4649331`)។ run-all STRICT លើដើមឈើ PR មុនកែ ៖ **២០២/២០៤ PASS · partial ០ · SKIP ០** (ធ្លាក់ ២ ជា artifact នៃការរត់ probe ស្របគ្នា ៖ `repository-file-coverage` ឃើញឯកសារ probe បណ្តោះអាសន្ន · `native:check` history-window-check ចលនាស្វែងរក iPhone ផុតពេលម៉ាស៊ីនរវល់) — ⛔ បៃតង ២០៤/២០៤ របស់ PR មិនបានឃើញចន្លោះ ៨ ខាងក្រោមទេ ព្រោះគ្មាន checker ណាវាស់ «journal row នៅសល់ក្រោយបិទ App» · «ចាកចេញពេល request កំពុងដើរ» · «listener ចុះមុនហាងស្គាល់» · «fetch ពេល auth ស្តារ» ឬ «localStorage បិទ»។

Probe ១២ ករណី (vitest · adapter ពិត · fake SDK · transport ក្លែង) ធ្លាក់ទាំង ១២ លើ `eb88d7b` ហើយ control ៣ ជាប់; ក្រោយកែ ១៥/១៥ PASS ៖

1. **Firebase ៖ transaction ធម្មតាបាត់ពាក់កណ្តាលផ្លូវ ➜ រារាំងឧបករណ៍រហូត** (`recoverRow()` ៖ row គ្មាន `hash` · គ្មាន `intent` · គ្មាន token ➜ `resolved = false` ➜ `blocked++` ➜ `mutate()` បដិសេធគ្រប់ការសរសេរ `write_recovery_pending`; 🩺 ➜ recovery ដដែល ➜ blocked ដដែល)។ វាស់ ៖ តម្លៃ Server ដដែល (មិនបានអនុវត្ត) និងតម្លៃបរទេស ទាំង ២ ➜ `write_recovery_pending` · dispatched ០ · row ១។ កែ ៖ row ធម្មតាសម្រេចតាមតម្លៃតែប៉ុណ្ណោះ ➜ ទម្លាក់ (`if (token) resolved = false`)។ Control ៖ intent ledger ដែលសាក្សីសម្រេចមិនបាន នៅ blocked ដដែល។
2. **ការអាន receipt បរាជ័យលើបណ្តាញ (ក្រៅបណ្តាញ · Server មិនឆ្លើយ) ➜ blocked** (catch នៃ recovery ➜ `blocked++`)។ កែ ៖ `deferred` + `verified()` loop (`NATIVE_RECOVERY_RETRY_GAP_MS` · តែ online) · ការសរសេររង់ចាំ · phase `recovering`។ វាស់ ៖ fetch ធ្លាក់ ៣ ជុំ ➜ settled null · blocked ០ · deferred true ➜ បណ្តាញមក ➜ `sent` · dispatched ២ (resend + ថ្មី) · row ០។
3. **rules មិនទាន់ Publish ➜ ហាងសរសេរអ្វីមិនបាន** (`sendAtomic` ➜ `permission_denied` លើផ្លូវ receipt ➜ ការសរសេរទាំងអស់ធ្លាក់; គ្មាន Web Locks ➜ អាន receipt ➜ 401 ➜ blocked)។ កែ ៖ `receiptRefused` ➜ ការសរសេរដដែលម្តងតាម SDK ធម្មតា · row ទម្លាក់; receipt ដែលអានមិនបាន (`txReadWasRefused`) លើ row hash ➜ ទម្លាក់។ វាស់ ៖ `sent` · sent [4200] · reads ០ · blocked ០។
4. **localStorage បិទ ➜ ការសរសេរទាំងអស់ត្រូវបដិសេធ** (`persist()` ➜ `write_journal_unavailable`)។ កែ ៖ `journal.available()` ➜ គ្មាន journal ➜ `mutate()` ហៅ SDK ត្រង់។ row ខូច ➜ `list()` រំលង ⛔ មិន throw (ពីមុន row ខូចមួយ ➜ Supabase `recoverWrites` blocked រហូត)។
5. **Supabase ៖ row `cancelled` ពី sign-out ➜ សម័យបន្ទាប់ blocked រហូត** (`recoverWrites()` ៖ `cancelled` ➜ `blocked++`; `retryWriteRecovery()` ➜ ដដែល)។ វាស់ ៖ `WRITE_RECOVERY_PENDING` ទាំង set និង retry។ កែ ៖ `cancelled` ដើរតាមច្បាប់ `sent` (op_id ដដែល · ក្នុង `SB_OP_REPLAY_SAFE_MS`)។ វាស់ ៖ replay op_id ដើម · សរសេរ ២ · blocked ០ · row ០; control ៖ row ផុតបង្អួច នៅ blocked ១។
6. **Supabase ៖ ការសរសេរដែល recovery បដិសេធ ទុក row `queued`** ➜ replay ពេលក្រោយ (phantom)។ កែ ៖ `enqueueWrite()` ដក row ពេល `waitForWriteRecovery()` throw។
7. **Listener ចុះមុនហាងស្គាល់ ➜ ស្ងាត់ជារៀងរហូត** (`capture()` ៖ tenant `''` ➜ `'A'` ➜ `current()` false ➜ callback ត្រូវច្រោះ មិនបិទ · មិនប្រាប់ App)។ វាស់ (`createSupabaseSdk` ពិត · `readAccount` null · `my_account` យឺត) ៖ មុន account ឃើញ ១ ធាតុ · ក្រោយ account មិនឃើញធាតុ ២ ដែលសរសេរ; control (account cached) ឃើញ ២។ កែ ៖ tenant `''` ពេលចាប់ = មិនចង (`capture()` · `captureConnectionOperation()`); A ➜ B នៅបញ្ចប់ដដែល។
8. **fetch កំណែ App ពេលបើក App ត្រូវ abort ដោយ auth ស្តារ** (`initNotifications()` ➜ `fetchNotifyFeed(false)` មុន `onAuthStateChanged` ➜ `authGeneration++` ➜ `CONNECTION_SCOPE_CHANGED`)។ កែ ៖ `fetchWithTimeout(…, { scope: 'page' })` សម្រាប់ feed · seller notices; request ទៅ Function នៅចងដដែល។

ចន្លោះរចនាដែលកែបន្ថែម ៖ **`zoew_write_receipts` កើនរហូត** (rules PR #313 ហាមលុប · ១ receipt ក្នុងមួយ `set`/`update` · ~២–៤ ក្នុងមួយកញ្ចប់ · backup ទាំងមូលកើនជារៀងរាល់ថ្ងៃ) ➜ rules ឲ្យលុប receipt ខ្លួនឯង `at < now - 172800000` · `purgeReceipts()` (SDK `get` · ≤ 500 · ម្តងក្នុងមួយសម័យក្រោយ recovery ស្អាត) · row hash ដែល `queuedAt` ចាស់ជាងបង្អួច ➜ blocked (receipt អាចបាត់) · probe parity ៩ ជំហានមាន verdict រំពឹង (បង្កើតតែ uid ខ្លួន · មិនជាន់ · លុបតែចាស់ជាង ២ ថ្ងៃ · មិនលុបរបស់អ្នកដទៃ)។ **Verdict `unknown` លើការសរសេរដែលមិនដែលផ្ញើ** (`ended()` របស់ Proxy) ➜ `not-applied` (ledger resend ≤ 3 ដង ➜ verdict ជាក់លាក់ · គ្មាន Sentry money ក្លែង)។

លទ្ធផលចុងក្រោយលើ `d893c3b` ៖ run-all STRICT (emulator RTDB · Postgres ពិត · firebase-tools ពិត) **២០៤/២០៤ PASS · partial ០ · SKIP ០** · vitest ១៤៣៦ ករណី + ១៥ ថ្មី PASS · probe parity receipt ៩ ជំហាន RTDB = Postgres។ ជុំ ១ លើ `cbe133a` ធ្លាក់ ៥ (package.json មិនទាន់ bump · probe receipt រត់ក្រោយ `sc.drop()` · harness toast reject តែម្តង ➜ fallback ឃើញ success · probe SDK ប្តូរពី ZoeKeyGen · លិបិក្រម) ➜ កែក្នុង `b668d46`; ជុំ ២ ធ្លាក់ ១ (តេស្ត deferred រង់ចាំ digest មិនគ្រប់ក្រោម CPU រវល់) ➜ កែក្នុង `d893c3b`។

ZoeW 2.50.61 (ផ្លូវចេញ PIN «លុបការសរសេររង់ចាំ») ៖ run-all STRICT **២០៤/២០៤ PASS · partial ០ · SKIP ០** លើ `f754d44` (ជុំមុនធ្លាក់ ១១ ដោយ emulator RTDB ស្លាប់កណ្តាលការរត់ (ECONNREFUSED) + helper មិនប្រើ ➜ ចាប់ផ្តើម emulator ឡើងវិញ · ដក helper)។

ពិនិត្យដោយអាន (គ្មានកំហុស · មិនកែ) ៖ Delete/Remove/restore ទៅតាមតារាងសេណារីយ៉ូ (`isDeducted` នៅជាវាលសម្រេចតែមួយ) · `runLedgerTransaction()` replay ដោយ token ខ្លួនឯង ➜ `txAppliedDelta` = delta នៃជុំដែល commit (RTDB commit តែពេល hash ស្មើ) ➜ មិនដកស្ទួន · `withFirebaseAuthOwnership` (`beforeAuthStateChanged` ពិត) · `setupConnectionRecovery()` cleanup · `probeDatabaseLiveness` epoch · SW (`CACHE_VERSION` តែប៉ុណ្ណោះ) · `secret-hygiene` (journal ក្នុង localStorage មានទិន្នន័យអតិថិជនតែ row ដែលកំពុងដើរ · scope តាមគណនី)។ ដែលមិនបានវាស់លើឧបករណ៍ពិត ៖ iPhone/Android PWA + APK (សកម្មភាព ៣ ផ្នែក ១)។

### 2026-10-13 — Connection architecture ទាំង ៦ ចំណុច · ZoeW 2.50.59

មូលដ្ឋាន `f7c3043` ក្នុង PR #313។ តេស្តថ្មីដូចគ្នា ២៥ ករណីក្នុង ៥ ឯកសារ៖ មុនកែ ២១ FAIL និង ៤ control PASS; ក្រោយកែ ២៥/២៥ PASS។ វាស់ lifecycle readiness, listener ownership, logout/tenant switch ពេល fetch ឬ body នៅរង់ចាំ, Supabase lost ACK/reload ជាមួយ op_id ដើម, offline queue, storage quota, replay window ផុត, Firebase immutable receipt និង SDK transaction callback មកពីរដង។ ចំនួន FAIL ជាចំនួនសេណារីយ៉ូ មិនមែនកំហុសឯករាជ្យ ២១ ទេ។ Full Vitest ដំបូងក្រោយកែ fixture ownership៖ ១៥៨ ឯកសារ / ១៤០៩ tests PASS; ការរត់ពេញលើ tree ចុងក្រោយត្រូវផ្ទៀងផ្ទាត់បន្ថែម។

Real SDK/RTDB បានចាប់កំហុសដែល fake SDK មិនបដិសេធ៖ `ref(db, '')` មិនអនុញ្ញាត path ទទេ ➜ ប្រើ `ref(db)`; native journal ត្រូវដកពេល verdict `not-applied` ជាក់លាក់ ដើម្បីកុំរារាំងការដកបន្ទាប់; recovery ត្រូវរង់ចាំម្ចាស់ Web Lock ហើយពិនិត្យ journal វិញដោយខ្លួនឯង។ Supabase recovery conflict ត្រូវពិនិត្យអាយុម្តងទៀតតាមម៉ោង response មុនដក journal; replay window អាចផុតកណ្តាល request។ Replay attempt ដែល unsent មិនលុបភាពមិនច្បាស់នៃ attempt មុនដែលបានផ្ញើរួចទេ; intent នៅ sent ឬ cancelled តាម owner ដើម។ Receipt replay បញ្ជាក់ counter មិនស្ទួន តែ UI ជាប់ syncing ទោះ phase ready និង journal ទទេ ➜ snapshot ចុងក្រោយត្រូវ render connection status; regression ដាច់ដោយឡែកធ្លាក់លើការអនុវត្តមុនកែច្រកនេះ។ `connection-recovery-test` ចាប់ initialization error និងវាស់ syncing មុន snapshot មកដល់ / ready ក្រោយគ្រប់ view មកដល់។ Supabase adapter parity ពិត ៩២ PASS និង RTDB/Postgres rules parity ១៣ PASS ក្នុងការរត់ផ្តោត; ការរត់ផ្តោតមិនមែនសាលក្រមពេញលេញ ២០៤ checker ទេ។

Native set/update បញ្ចូលទិន្នន័យ និង receipt ក្នុង atomic SDK update ដដែល; receipt មាន UID និង hash ហើយ rules មិនអនុញ្ញាត overwrite/delete។ Ledger ចាស់ដែលគ្មាន token ទទួល metadata anchor តាម CAS មុន delta ដំបូង ដោយមិនប្រែប្រាក់; requested money intent រក្សា prepared មុនរង់ចាំ ACK របស់ metadata និងប្តូរ sent ក្នុង updater មុនផ្ញើ delta ដូច្នេះ reload កណ្តាលការរៀបចំមិនបាត់ intent។ Recovery updater រក្សា witness និង journal មុនការសរសេររបស់ខ្លួនផង; witness ដែលមិនច្បាស់នៅ unknown ដដែល។ Native CAS recovery ប្រើ ledger witness និង requested intent ដើម; គ្មាន Web Locks ➜ អានផ្ទៀងផ្ទាត់បាន តែមិន replay transaction ដែល outcome មិនទាន់ច្បាស់។ Supabase replay ប្រើ server-clock window ខ្លីជាង retention របស់ `zoe_ops`; outcome ចាស់ឬមិនច្បាស់រក្សា journal និងផ្អាក writes។ Native receipt recovery ផ្ទៀងផ្ទាត់ hash នៃ payload មុន replay; payload ប្រែត្រូវរក្សា និង blocked។ PERMISSION_DENIED របស់ write ថ្មីដែលកាន់ Web Lock មិនត្រូវបាត់ក្រោម error ពី receipt read។ Pending counter គ្រប request ដែលនៅរង់ចាំ lock និង SDK; 🩺 មិនរាយ healthy ពេល write នៅ pending ហើយ fuzz វាស់ invariant ក្រោយ pending ចប់ (ពិដាន ១.៥ វិនាទី; មិនចាំតម្លៃដែលរំពឹងឬបង្កើនពិដាន checker)។

Full STRICT ជុំដំបូង ១៧៣ PASS / ៣១ FAIL និង CI ធ្លាក់ទាំង ៤ ផ្នែក; មិនរាប់វាជា full green។ ការរត់ផ្តោតក្រោយកែ dependency/atomic-path fixtures និងកំហុស runtime បាន PASS ២៧/២៩; ករណីពីរចុងក្រោយកែហើយរត់ឡើងវិញជាមួយ backend parity និង health បាន PASS ទាំង ៥ ដែលជ្រើស។ លទ្ធផលទាំងនេះមិនមែន full run ស្អាតមួយទេ; ត្រូវរត់ STRICT ពេញឡើងវិញលើ tree ចុងក្រោយ។ ក្រុម React typecheck/lint/Vitest/Android បាន PASS ក្នុងការរត់ថ្មី។ Checker Web/Android ដំបូងប្រៀបធៀប receipt UUID/hash ពី platform ខុសគ្នា ➜ កែឱ្យផ្ទៀងផ្ទាត់ hash ទៅ raw payload ក្នុង platform នីមួយៗ មុន normalize protocol identity; ចំនួន receipt និង UID/timestamp និង DB/ប្រាក់នៅប្រៀបធៀបដដែល។ cleanup-rules-check បាន PASS ៨៥ ករណី។ Shared VM runtime ត្រូវចង window.storage ឱ្យត្រឹម browser និងមិនប្រកាស storage ជាន់ដែល harness ផ្គត់ផ្គង់; PIN/biometric/secret/late-commit assertions ដើមបាន PASS។

មិនអាចអះអាងថាគ្រប់ network failure ឬ race ដែលអាចកើតមានត្រូវបានលុបទាំងអស់ទេ។ សកម្មភាព Publish Firebase rules / Supabase migrations / ឧបករណ៍ពិតនៅផ្នែក ១។

លទ្ធផលចុងក្រោយលើ source `9eb6f17` (App code ដូច `cd44676`)៖ STRICT ពេញក្នុង session បាន PASS ២០៤/២០៤ checker, FAIL ០, partial ០ និង SKIP ០។ CI run `38353611586` បាន PASS ទាំង ៤ ផ្នែក៖ ៥៤ + ៥០ + ៥០ + ៥០ = ២០៤; គ្មាន partial/SKIP។ React suite ទាំងពីរបាន PASS រួម typecheck, lint, Vitest, Android, build, SW, smoke, native និង cleanup rules។ Financial fuzz ក្រៅ default seeds ៣០០–៣១៣៖ ១៤ លំដាប់ × ៥០ ប្រតិបត្តិការ, invariant ទាំងអស់ PASS; other-device remove ១៤ លំដាប់, applied ACK ៥ និង lost ACK ៧ លំដាប់។ មិនបានរំលង checker ឬបង្កើន timeout; local money-guardian រត់ JOBS=៤ តាម option ដែលមានស្រាប់។ ចុងក្រោយនេះផ្លាស់តែកំណត់ត្រាលទ្ធផល; App source និងអ្នកយាមមិនប្រែ។

### 2026-10-12 — Audit race/login/network ក្រោយ merge PR #312 · ZoeW 2.50.58

`firebase-auth-write-ownership.test.ts`៖ Firebase Auth SDK ពិតមានករណីបន្ថែម៖ native signin A មកក្រោយ logout ប្តូរ currentUser ពី null ទៅ A និងហៅ listener; signin B ខណៈ A នៅរង់ចាំក៏អាចហៅ listener A កណ្តាល។ Regression ៤៖ មុនកែ ២ FAIL និង control ២ PASS; ក្រោយ auth facade ៤/៤ PASS។ Control គ្រប normal signin/logout និង invalid credentials ➜ login ថ្មី។ Guard ចុះមុន SDK ប្តូរ user និងដោះក្រោយ request; signin ជំនួសរង់ចាំ request ចាស់ settle ដើម្បីកុំឱ្យ guard ចាស់បដិសេធ request ថ្មី។ មិនកែ SDK/vendor។ Full STRICT ដំបូងត្រូវបានបញ្ឈប់ក្រោយរកឃើញករណីនេះ ទោះ checker ដែលចប់ PASS ក៏ដោយ; មិនរាប់វាជា full run ជោគជ័យ។

មូលដ្ឋាន `4649331` ដែលបាន merge PR #312។ តេស្តថ្មីដូចគ្នា ៤៩ សេណារីយ៉ូ ក្នុង ៩ ឯកសារ៖ មុនកែ ៤២ FAIL និង ៧ control PASS; ក្រោយកែ ៤៩/៤៩ PASS។ នេះជាចំនួនសេណារីយ៉ូបរាជ័យ មិនមែនកំហុសឯករាជ្យ ៤២ ទេ។ ប្រើ feature និង adapter ពិត; `supabase-auth-write-ownership.test.ts`៖ ករណី Supabase auth storage ប្រើ supabase-js `2.117.2` ពិត ពន្យារ HTTP response។ Login A ក្រោយ logout ឬ login B ធ្លាប់សរសេរ A ទៅ storage ទោះ outer generation guard បដិសេធ promise; ឥឡូវ guard នៅមុន SDK ទទួល response។ Control បញ្ជាក់ cached restore មិនបិទ refresh ដែលមកក្រោយពិដាន ៣ វិនាទី។ ក្រុម auth/transport ពាក់ព័ន្ធ ២៦ ឯកសារ ១៨៩ PASS; តេស្ត control refresh ដែលបន្ថែមក្រោយការរត់នេះបាន PASS ក្នុងក្រុម ៤៩។ Control refresh មកយឺតក្រោយ logout វាស់ storage writes ក្រោយ logout និង storage ចុងក្រោយ៖ PASS ទាំងកូដមុនកែ និងក្រោយកែ; មិនចាត់វាជាកំហុសថ្មី។

ចន្លោះ checker៖ `connection-recovery-test` ធ្លាប់ catch initialization error ប៉ុន្តែនៅ PASS។ Harness ថ្មីចាប់ error និងដាក់ dependency ពិត (`loginBackendScope`, `ZTO_SHOP_SWEEP_PATH`, auth.currentUser); បញ្ជាក់ init គ្មាន error លាក់ ក្នុង ៤ ករណី។ ចំនួន assertions ថ្មី ២៤០ PASS។ Cache delta របស់ Supabase App E2E ធ្លាក់ពេល tenant ប្តូរកណ្តាល cache load; កែ cacheTried ដើម្បីសាក cache របស់ context ថ្មីវិញ។ State hygiene ចែង lifetime នៃ opaque write owner token ដែលគ្មាន credentials/data និងមាន regression សម្រាប់ ACK/reject ចាស់។

វាស់តាមលំដាប់៖ network/login/sync ដំបូង ២៥ checker៖ ២៣ PASS និង ២ FAIL; ក្រោយកែ ៥ checker ដែលពាក់ព័ន្ធ PASS ទាំងអស់។ Backend writes ដំបូង ១២ checker៖ ១១ PASS និង ១ FAIL; connection harness ថ្មី ២៤០ PASS, write stall ៤៣ PASS និង state hygiene PASS ក្រោយកែ។ មាន Firebase SDK + emulator/rules ពិត និង Supabase SDK + embedded Postgres/schema/RLS ពិត; adapter parity ៩២ PASS, CRUD ១៣៧ PASS, disconnect transaction ២៥ PASS, transaction outcome ១១០ PASS, late commit ៦៧ PASS។ មិនសរសេរ production data។

Supabase production read-only 2026-10-12៖ `ACTIVE_HEALTHY`; តារាង public ទាំង ៩ បើក RLS, anon គ្មាន SELECT និង authenticated គ្មាន direct INSERT/UPDATE/DELETE។ Advisor មាន INFO `zoe_ops` គ្មាន policy (table idempotency តាម RPC), INFO index មិនទាន់ប្រើ ២ និង WARN [Leaked Password Protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) ដូចមុន។ មិនប្តូរ production settings។

Financial flows៖ checker ដែលជ្រើស ២៣/២០៤ PASS ទាំងអស់ · ០ skip/partial; គ្រប policy, partial cleanup, pickup ledger/repair/reset, price abort, restore/clear-history fences, emulator restore/ledger និង money guardian mutation ទាំងពីរផ្នែក។ Revenue fuzz ១២×៤៥ និង collected mirror ៥×៨ PASS។ `npm audit` ពិតលើ ZoeW, Supabase និង Firebase provision៖ vulnerabilities ០ ទាំងបី។

កែ checker ក្រោយ full/CI រកឃើញ drift៖ periodic VM ដាក់ authGeneration/database ពិតដែល helper ប្រើ; page navigation រង់ចាំ microtask logout មុនអានចំនួន SDK calls; toast order ស្គាល់ SDK alias ដែលចាប់ពី fb ពិត។ Sheet import/App Lock fake initial callback ប្រើ auth.currentUser ដូច SDK API ជំនួស user clone មិនស្របគ្នា ដែលធ្វើឱ្យ auth recovery រំខាន flow។ Native auth fixture បង្កើត JWT unsigned ពី claims ក្លែងក្លាយ (`fake-signature`) ជំនួស literal ដែល security guard ចាត់ជាទិន្នន័យសម្ងាត់; មិនដាក់ allowlist។ ក្រោយកែ៖ periodic ៧៧, security ៥៥, navigation ៥៥, toast ៩០, Sheet import ៨២, App Lock ១៦២ និង docs ៩៩ PASS; native SDK តេស្ត ៤/៤ PASS។ គ្មាន assertion ដក ឬប្តូរ expected outcome ដើម្បីបៃតង។

Full STRICT ២០៤ checker លើ fingerprint `b263b4a3014a9a68`៖ ១៩៧ PASS · ៧ FAIL · ០ skip/partial (២១០៦ វិនាទី)។ FAIL ៦ ជា fixture/index drift ដែលបានកែខាងលើ; meta exit-code integrity ធ្លាក់ព្រោះ poisoned child ឆ្លងពិដាន ៦០ វិនាទី ហើយត្រូវចាត់ FAIL ត្រឹមត្រូវ។ ក្រោយកែ រត់ checker ដែលពាក់ព័ន្ធ ១៣ លើ fresh fingerprint `2d59ec07f316ff3c`៖ ១៣/១៣ PASS · ០ skip/partial រួម meta ដោយប្រើ concurrency និងពិដានដើម។ App/runtime bytes នៅដដែល (`app.js` SHA-256 `f7b24f8aecde3d9692c09e5188f8b6a42972e89ad7e1f90e3a98ab36c8923942`); មិនអះអាងមាន full local run ថ្មីលើ hash ចុងក្រោយឆ្លងទាំង២០៤ទេ។ CI fresh លើ commit `d166cc8` (run `38272187747`) ផ្នែកទាំង ៤/៤ SUCCESS គ្រប checker ទាំង២០៤។ Financial fuzz seeds បន្ថែម ៣០០–៣១១ (`FUZZ_RUNS=12`, `FUZZ_OPS=55`) PASS (១៩១.២ វិនាទី) និង mirror seeds ៣០០–៣១២ (`MFUZZ_RUNS=13`, `MFUZZ_OPS=11`) PASS (១៦៨.៩ វិនាទី)។ គោលការណ៍ Delete មិនដកប្រាក់, Remove/expired ដក និង restore បូកតែករណី isDeducted ដដែល។ Cloud tests មិនជំនួសការសាក iPhone/Android ពិត ឬធានាគ្រប់ interleaving/outage ទេ។

### 2026-10-12 — PR #312៖ Deep audit ឡើងវិញ និងកែចន្លោះក្នុង checker

កូដមុនកែ `076ed7b`។ បន្ទាប់ពី run-all STRICT ២០៤ checker ឆ្លងទាំងអស់ (រត់ពេញ និង resume លើ fingerprint `21cc6286fb77f49e` ដដែល · ០ skip/partial) តេស្ត race និង barcode បន្ថែមនៅតែបង្ហាញកំហុសពិត ៤៖ `zoe_read` យឺតជាន់ cache ហាងថ្មី · verification របស់ App បិទលុប session ថ្មី · Sheet open decrypt យឺតដាក់ plaintext ហាងចាស់ · `%` ជាន់ key punctuation ធ្វើឱ្យ barcode ទីពីរទាមទារមិនបាន និង pickup ២ ក្លាយជា ១។ កំណែថ្មីការពារ ownership នៅ await និងធ្វើ key bijective តាម barcode ដែល normalize រួច។ ទិន្នន័យ barcode ពិតគ្មាន `%` តាមការបញ្ជាក់ម្ចាស់គម្រោង។

Checker ចាស់៖ child money guard timeout/SIGTERM ត្រូវបម្លែងទៅ code 1 ហើយរាប់ថា «ចាប់ mutant បាន»។ តេស្ត child ពិតបញ្ជាក់កំហុស ហើយកំណែថ្មីចាត់ interrupted ជា FAIL របស់ checker; មិនរាប់ចូល caughtBy។ Backup mode mutation មិនលេចក្រោម umask 0077; checker ថ្មីកំណត់តែ umask កូន 0022 ពេល spawn ហើយស្តារ parent ភ្លាមៗ។ មិនសរសេរទិន្នន័យផលិតកម្ម។

តេស្ត regression ១៩ ដូចគ្នារត់លើកូដមុនកែ៖ ១៥ FAIL · ៤ control PASS។ ក្រោយកែ៖ ១៩/១៩ PASS; បន្ថែម owner safety ២ ករណី (capture/unrelated listener និង constructor throw)៖ សរុប ២១/២១ PASS; typecheck/lint ឆ្លង។ Full run-all STRICT លើ fingerprint `7350fc3cd36cbff0`៖ ២០១ PASS · ៣ FAIL · ០ partial · ០ skip (៣១២២ វិនាទី)។ FAIL គឺលិបិក្រមតេស្តថ្មីខ្វះ ៣ ឈ្មោះ · generated money-core ចាស់ · feed មាន update ចាស់ និងថ្មី ខុសសំណើទុកតែ update ចុងក្រោយ។ កែទាំង៣ និងរត់ checker ដែលប៉ះ និង meta/metadata/security សរុប ១០ ឡើងវិញលើ fingerprint `13b3ae5c396df491`៖ ១០/១០ PASS · ០ FAIL/skip/partial។ Money CLI ៦០/៦០; តេស្ត CLI ដូចគ្នាលើឧបករណ៍មុនកែ៖ ៥៦ PASS · ៤ FAIL (encoded identity និង numeric PII)។ សាលក្រម checker ២០៤ បន្ទាប់ពីផ្ទៀងផ្ទាត់ការកែផ្នែកដែលប៉ះ៖ PASS ទាំងអស់; មិនអះអាង full fresh run ថ្មីមួយដែលឆ្លងទាំង២០៤លើ hash ចុងក្រោយទេ។ Source App/runtime នៅដដែលក្រោយ full run; ក្រោយមកកែតែ feed, ឯកសារ និងឧបករណ៍ CLI ដែលមាន regression ផ្ទាល់។

Supabase SDK cleanup ដែលរកឃើញបន្ថែម៖ Chromium ពិត + supabase-js ពិត, បើក/បិទ client ២០ ដង៖ កូដមុនកែនៅសល់ window listener ៦០ និង BroadcastChannel មិនបិទ ២០; ក្រោយកែនៅសល់ ០ listener និងបិទ channel ២០/២០។ Listener របស់ App ដែលមិនមែន SDK នៅដើរ; pageerror ០។ Auth init យឺតដែលភ្ជាប់ visibility listener ក្រោយ close ក៏មាន regression pre-fix red ➜ fixed។ Constructor scope កាន់ listener តែក្នុង createClient synchronous ហើយស្ដារ descriptor ដើមភ្លាមៗ; មិនប្ដូរកូដ SDK/vendor។

CLI consumers បន្ថែម៖ `money-reality-check.js` encode registry/collected keys ពីរដង ហើយ `redact-dump.js` hash raw barcode ខុសពី key ដែល encode រួច; fixture `AB.C`/`AB%2EC` រាយកំហុសលុយក្លែងក្លាយ ៣ ទោះ ledger ត្រឹមត្រូវ។ Numeric phone/barcode/secret នៅក្នុង JSON number មិនត្រូវ hash ហើយឧបករណ៍នៅរាយ safe to share។ កែដោយប្រើ barcode encoder ពិតពី money-core និង numeric whitelist តាម schema (រួម c/d និង pickedUpPhones counters)។ `money-reality-test` វាស់ encoded និង numeric dump មុន/ក្រោយសម្អាត, អត្តសញ្ញាណមិនលេច, ចំនួន/ទឹកប្រាក់មិនប្រែ; test ថ្មីធ្លាក់លើឧបករណ៍មុនកែ។ គ្មានការអាន ឬសរសេរទិន្នន័យអតិថិជនពិត។

ការវាស់បន្ថែមមុនកែ៖ fuzz seed 200–227 × 75 operations (28×75) ជាប់ invariants និងផ្លូវ other-device/applied-lost; browser 3000 history + 3000 trash នៅ 360/1024px, initDatabaseListeners 30 ដងនៅតែ 10 subscriptions (path មួយមានតែ ១), page/listener error ០, frame p95 16.7ms; desktop មាន frame យឺត 116.6ms មួយ។ មិនអះអាង hardware FPS។ Local PostgreSQL suites រត់បានដោយ embedded PG17; ការខកខាន UID ក្នុងកំណត់ត្រាមុនមិនមែន FAIL SQL ដែលនៅសល់ទេ។ Supabase live read-only៖ migration 14 ដូច repo · public tables 9 មាន RLS · anon គ្មាន SELECT · authenticated គ្មាន direct DML · forged user_metadata មិនក្លាយជា admin។ Leaked Password Protection disabled និង JWT revoke boundary នៅដដែល។

### 2026-10-12 — CLI braces backport តាមសំណើម្ចាស់គម្រោង

- បញ្ជាក់កំណែដើម `braces@3.0.3`៖ balanced pattern depth 4900 ប្រវែង 9801 តួ ➜ compile បោះ Maximum call stack size exceeded លើ Node ពិត។ AST depth 20000 ក៏ឆ្លង character gate ដែរ។
- `tools/firebase-provision` **1.0.1**៖ local fork **3.0.3-zoe.1** (មិនមែនកំណែផ្លូវការ) + parser cap 100 រួម parentheses និង walker guard តាម iterative validation។ AST ដែល caller ផ្ដល់ផ្ទាល់ និង child cycle ក៏បដិសេធដោយ BRACES_MAX_DEPTH។ quoted/escaped/class literals មិនចាត់ជានesting។ CLI 15.32.1 · chokidar 3.6.0 · dependency registry ផ្សេងទៀតរក្សា lock ដដែល។
- npm file dependency/override ចងទៅ vendor ដែល pack ដំឡើងតាម npm ci --ignore-scripts។ សាក clean install ដោយដក NODE_PATH; actual chokidar require.resolve និង bytes ដូច source patched។ មិនពឹង global module ឬ postinstall hook។
- `firebase-provision-test`៖ corpus 38 ករណីពី upstream · public entrypoints · cap/cap+1 · exploit string · unclosed nesting · direct AST/cycle · literal ទិសផ្ទុយ · runtime byte identity និង watcher glob {a,b} ផ្ទាល់។ ដក guard ទាំង ៤ ទ្វារ ➜ behavior controls ក្រហម។ CLI HTTPS provisioning + mutation នៅឆ្លង (សរុប 187/187)។
- Provenance និង MIT license រក្សា; ដកតែបន្ទាត់ backport នឹងទទួល hash ត្រូវនឹង upstream package bytes។ រាល់ឯកសារ vendor/fixture មានការចុះ guard coverage។
- ភស្តុតាងការកែជាលទ្ធផល exploit/behavior/source ត្រឹមត្រូវ។ Registry advisory មិនបានវាយតម្លៃ fork ក្នុង repo; npm audit សម្រាប់ local package មិនធានាកូដនេះដោយខ្លួនវាទេ។ មិនអះអាងបានដោះស្រាយ regex complexity ឬការប្រើ glob មិនទុកចិត្តគ្រប់ប្រភេទ។
- Full run STRICT ទាំង 204 checker (tree fingerprint ac43fd7383a14b42)៖ 196 PASS · 8 FAIL · 0 partial · 0 skip។ FAIL 1 ជា version នៅក្រៅ header ក្នុង CLAUDE.md ➜ កែ និង rerun docs 99/99; Postgres 7 នៅជាប់ UID mapping។
- CI មុននៅ commit 5423eb0៖ 3 shard ឆ្លង; shard 2 ធ្លាក់តែ keygen-supabase-admin-test ដែលនៅរំពឹងប៊ូតុង 3 ក្រោយ UI មានប៊ូតុង Lookup ទី 4។ កែ assertion ឱ្យគ្រប sb-lookup និង action/id ទាំង 4 ដដែល។ Local Postgres ជាប់ UID ដូចមុន; ត្រូវឱ្យ CI ជុំថ្មីវាស់ SQL path នោះ។

### 2026-10-12 — Deep audit ទាំង Project និង Supabase Lookup

មូលដ្ឋានគឺ PR #312។ តេស្តបៃតងអះអាងតែសេណារីយ៉ូដែលវាស់; ប្រើកូដពិត, ពន្យារពេល promise, ផ្លាស់ប្តូរហាងកណ្តាល await និងបដិសេធ Cache API ដើម្បីរកចន្លោះថ្មី។ អ្នកយាមថ្មីនៅក្នុង `ZoeW/tests/shop-bound-settings.test.ts` · `ZoeW/tests/setup-lookup.test.tsx` · `ZoeW/tests/sw-revalidation-timeout.test.ts`។

| ផ្នែក | អ្វីដែលវាស់ និងភស្តុតាង | ព្រំដែន |
|---|---|---|
| Function/លុយ | full guards សម្រាប់ close/remove/delete/restore · registry · ledger · cleanup; fuzz លើ seed និងចំនួន operation បន្ថែម | មិនប្តូរគោលការណ៍លុយ; fake SDK មិនជំនួស rules ពិត |
| Race | Lookup Save/Migrate/Test និង Sheet Save/Status/Clear ៧ ករណី pre-fix red ➜ fixed; save ថ្មីឈ្នះ save ចាស់ | crypto/network promise ពន្យារដោយចេតនាលើ function ពិត |
| Supabase Lookup | UI ជ្រើសហាង ➜ ciphertext AAD ➜ ZoeW store/get; tenant tamper/strip និង backend mismatch បដិសេធ | Header Secret/code មិននៅក្នុង Link/storage plaintext; legacy Link ដដែល |
| SW | activate keys/delete failure ទាំងពីរ App ៤ ករណី pre-fix red ➜ claim ឆ្លង; offline/cache/deploy tests | មិនរាប់ Cache API failure ជាបណ្តាញដើរ |
| Smooth/layout | browser traces និង perf guards · iOS/Android paths · 600-row native/PWA harness; 320px index collision កែ ➜ layout 151/151 | Chromium ក្លែង iOS មិនមែន Safari ពិត; hardware FPS មិនទាន់វាស់ |
| Firebase/network | emulator ពិត, real rules, SDK transaction តាម TCP proxy drop-request/drop-ack; network connect/offline/body-hang/reconnect guards | localhost ត្រូវរត់ emulator និង checker ក្នុង exec/network namespace ដូចគ្នា; Node SDK មិនប្រើ ambient HTTP proxy |
| Duplicate listener/session | listener leak · backend switch/detach · auth/session race · logout/reconnect lifecycle guards និងអាន callers | លទ្ធផលតែសេណារីយ៉ូដែលរត់ |
| Supabase live | project healthy; migration ដល់ member_devices; RLS លើ public tables ទាំងអស់; anon គ្មាន select និង authenticated គ្មាន direct DML; RPC grants/private wrappers; read-only JWT user_metadata=admin មិនអាន tenant/docs/admin rows និងមិនក្លាយជា admin | គ្មានការកែទិន្នន័យផលិតកម្ម; local Postgres ៥ suite និង parity ២ មិនអាច init ដោយ UID map មានតែ uid 0 |
| Security/dependency | npm audit ZoeW 5 high ➜ patched 0; Supabase/Backup/Cookie tool 0; Firebase Provision 11 ➜ 3 high upstream braces គ្មាន patch; secret hygiene · CSP · shipped bundle · license/PIN · input/XSS guards | audit live: Leaked Password Protection disabled; unused-index INFO មិនមែនមូលហេតុលុប index |

`dependency-security-test`៖ lockfile មុនកែមាន source-map-js 1.2.1 និង grpc 1.9.16 ➜ patch floor ត្រូវធ្លាក់; lockfile ថ្មីឆ្លង។ CLI lockfile ចាស់ basic-ftp/Core/uuid ក៏ធ្លាក់ patch floor; CLI ថ្មី HTTPS workflow + mutation 93/93 ហើយ PubSub ផ្ទុកបាន និង inbound baggage 1000 entries ត្រូវកាត់ត្រឹម 180។ Sheet Status/Clear control ប្រើ source មុនកែដាច់ពី test suite ផ្សេង ➜ ធ្លាក់ ២ ទោះ shopScope A/B ត្រឹមត្រូវ; ក្រោយកែឆ្លង។ បិទ Sheet កណ្តាល await សម្អាត busy/button flags ភ្លាមៗ និងដក owner របស់សំណើចាស់។

**ការផ្ទៀងផ្ទាត់ចុងក្រោយ**៖ run-all STRICT ជាមួយ Firebase emulator ពិត រត់ checker ទាំង ២០៤ លើ code tree `2c932bd5a2c7eb92` (០ partial · ០ skip)៖ ១៩៤ PASS · ១០ FAIL។ ៣ ករណីគឺ harness ដែលមិនទាន់ចាក់ state/helper Sheet ថ្មី ២ និងលិបិក្រម ១ ➜ កែហើយ rerun៖ logout 72/72 · freshness 171/171 · docs 99/99។ ដូច្នេះការវាស់ដែលឆ្លងសរុប ១៩៧; នៅសល់ Postgres ៧ ជា FAIL ដោយ UID map មិនមែនបញ្ហា SQL ដែលបានបញ្ជាក់។ React suite ទាំងពីរ · layout 151/151 · perf 31/31 · native និង Firebase emulator suites ឆ្លង។ Fuzz បន្ថែម seed 100–113៖ 14×50 ឆ្លង · cross-device injection 14 · ledger applied/lost 6/10។

CLI dependency patch ធ្វើក្រោយ full run ➜ សាកផ្នែកដែលប៉ះឡើងវិញ៖ HTTPS Provision + mutation 93/93 · dependency guard 23/23 · meta-checker 36/36។ Control lockfile ចាស់ធ្លាក់ ៥ patch floor ពិត (ZoeW ២ · CLI ៣); មិនរាប់ CLI npm audit នៅសល់ ៣ high ជា ០ ហើយមិនអះអាងថា full run លើ commit ចុងក្រោយបៃតងទាំង ២០៤។

Live Supabase logs 24h៖ source ៩ · severity ERROR/FATAL ០ ក្នុង aggregate ដែលសាក; នេះមិនបញ្ជាក់គ្មាន HTTP 4xx/5xx ទាំងអស់ទេ។ `zoe_ops` RLS/no-policy មានដោយចេតនា និងគ្មាន anon/authenticated select/DML grant។

Advisory យោង៖ [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) · [grpc certificates](https://github.com/advisories/GHSA-m9gg-hp2v-232j) · [grpc error disclosure](https://github.com/advisories/GHSA-f596-whhp-79r4)។ ផ្លូវ upgrade ជា patch override; មិន downgrade Firebase តាម npm audit suggestion។ CLI៖ [basic-ftp](https://github.com/advisories/GHSA-c475-qrg2-pj4r) · [OpenTelemetry Core](https://github.com/advisories/GHSA-8988-4f7v-96qf) · [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq) · [braces គ្មាន patch](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)។ មិន override chokidar ទៅ major ដែលបាត់ glob behavior ដើម្បីឱ្យ audit បៃតងទេ។

### 2026-10-10 — Deep audit ៥ (សំណើម្ចាស់គម្រោង ៖ «deep audit Network, Race, duplicate listener, sw, firebase, supabase, money, ច្បាប់លុប ដក, zto, Cookie … កុំជឿជាក់លើ checker ក្រែង checker បៃតងក្លែងក្លាយ» · «commit ចូល PR#309» · គ្មាន agent) ➜ [2.50.53]

- **មូលដ្ឋាន** ៖ run-all STRICT (emulator RTDB រស់) លើ `05a24c5` ៖ ២០៣ ជាប់ · ធ្លាក់ ១ = `repository-file-coverage` ព្រោះអ្នកយាមថ្មីលេចកណ្តាលការរត់ (artifact · មិនមែនកូដ)។
- 🔴 **ធុងសំរាម slot របស់ id ដែលបង្កើតឡើងវិញ** (ការរកឃើញពិត · លុយ + បាត់ទិន្នន័យ) ៖ «Merge into a gone item» (`mergeBarcodeIntoHistoryItem()` ឃើញ null ➜ ធាតុថ្មីក្រោម
  id ចាស់) ជាទ្វារដែលបានរចនា ប៉ុន្តែគ្មានអ្នកណាវាស់អ្វីកើតឡើងពេលធាតុថ្មីនោះត្រូវសម្អាត ឬលុប ខណៈ `trash/<id>` នៅកាន់ជីវិតចាស់ (លុប ៣០ ថ្ងៃ · ផុតកំណត់ ២ ថ្ងៃ · យករួច ៣០ ថ្ងៃ)។
  `claimCleanupTrashSlot()` ([2.50.52]) ចាត់ទុក «slot មាន deletedAt ផ្សេង» = ការ claim ដូចគ្នារបស់ឧបករណ៍ផ្សេង ➜ `trashElsewhere` ➜ journal លុប · គ្មាន ledger ➜ barcode ថ្មីដែល
  claim ចេញពីប្រវត្តិរួច **មិននៅទីណាសោះ** (abandon ៖ ប្រាក់មិនកាត់ ➜ ចំណូលលើស · registry ជាប់ · close ៖ កំណត់ត្រាយករួចបាត់) · resume `slot` ឃើញ `history/<id>` ដែលបង្កើតឡើងវិញ
  ➜ «elsewhere» ដូចគ្នា · `deleteSingleItem()` សរសេរ trash ដោយ overwrite ➜ ច្បាប់ចម្លងចាស់ (ឧ. ផុតកំណត់ដែលកាត់រួច) បាត់ ហើយ registry របស់វាមិនដែលដោះ។
  វាស់ (`ZoeW/tests/cleanup-foreign-slot.test.ts` · module ពិត · store រួម) ៖ abandon ➜ ច្បាប់ចម្លង C = **០** · ledger ១០០ (រំពឹង ៩៣) · close ➜ ០ · ឧបករណ៍ ២ ➜ ០ · resume ➜ `''` (រំពឹង `restored`) · លុប ➜ ច្បាប់ចម្លងចាស់ត្រូវជាន់។
  បង្អួចកើត ៖ Firebase ≈ RTT (ស្កេន/ZTO ខណៈឧបករណ៍ផ្សេងលុប) · **Supabase ធំជាង** ៖ realtime ស្ងាត់ ➜ ទិដ្ឋភាពចាស់រហូត `SB_POLL_REALTIME_MS` (៥ នាទី) ➜ CAS conflict ➜ updater ទទួល null ➜ ធាតុថ្មីក្រោម id ចាស់។
  **ហេតុអ្វី checker បៃតង** ៖ អ្នកយាម slot ([2.50.52]) seed តែ «ច្បាប់ចម្លងដូចគ្នា» ឬ slot ទំនេរ · `merge-into-deleted-item.test.ts` វាស់តែផ្នែកបញ្ចូល មិនវាស់ជីវិតបន្ទាប់របស់ធាតុថ្មី
  (សំណួរ ៨ ៖ មិនចូលស្ថានភាពកំហុស)។ ការកែ ៖ `trashSlotSharesClaim()` (ច្បាប់ចម្លងកាន់ barcode ណាមួយរបស់យើង = ការ claim ដូចគ្នា ➜ elsewhere ដដែល · គ្មាន ➜ ជីវិតផ្សេង ➜
  slot ផ្លាស់ម្តងទៅ `cleanupPartialTrashId(id, <trashReason>|slot)` · journal + live marker ប្តូរ key) · `resolveCleanupSlot()` ៖ ប្រវត្តិ id ដដែលត្រូវកាន់ barcode របស់យើងទើបជាភស្តុតាង ·
  `deleteSingleItem()` សរសេរតាម slot ដដែល។ Mutation ៥ ➜ ធ្លាក់ ៥ · ១ · ១ · ១ · ១ (គ្មាន move · ប្រវត្តិតាម id · resume ចាត់ទុកគ្រប់ម្ចាស់ជា elsewhere · លុប overwrite ·
  `trashSlotSharesClaim` ឆ្លើយ false ជានិច្ច ➜ ទិសផ្ទុយ ៦ ចាប់)។ sandbox ៩ ដែលស្រង់ `claimCleanupTrashSlot()` ទទួល helper ថ្មី (stub `true` លើ tree ចាស់ = ឥរិយាបថចាស់) ·
  `emu/crud-rules-flow` STRICT ៖ ការលុបតាម transaction ឆ្លង rules ពិត ១៣៧/១៣៧ · run-all STRICT លើ tree កែ ៖ ២០២/២០៤ ➜ `ui-flow-test` ៖ fixture «ធុងសំរាមបរាជ័យ»
  ទប់តែ `update()` ➜ ការលុបតាម slot (`runTransaction()`) ឆ្លង ➜ សេណារីយ៉ូមិនដែលកើត (FAIL ២) ➜ ទប់ទ្វារសរសេរធុងសំរាមទាំង ២ (មិនបន្ធូរការអះអាង ➜ ៩០/៩០) ·
  `doc-scope-test` ៖ ជួរលិបិក្រមអ្នកយាមថ្មី ➜ run-all STRICT ពេញលើ tree ចុងក្រោយ ៖ ២០៣/២០៤ · `perf` លើសពិដាន ៣០០ វិ. ពេលម៉ាស៊ីនរវល់ (ពេលរត់សរុប ១០១២ វិ.
  ធៀប ៨៩២ វិ. លើកមុន · ការអះអាងទាំងអស់មុនពិដាន ok) ➜ `RUNALL_RESUME=1` tree ដដែល ៖ `perf` ជាប់ ៧៣,៦ វិ. ➜ **២០៤/២០៤** (០ មួយផ្នែក · ០ រំលង · emulator រស់)។
- 🟠 **ZoeKeyGen SW គ្មាន `cache: 'no-cache'`** ៖ កត់ក្នុង Deep audit ជុំ ២ (2026-10-04 · «សង្កេតក្រៅវិសាលភាព ➜ ជុំ ៣») តែមិនដែលធ្វើ ➜ checker វាស់តែ ZoeW (ជុំទី ៤ ប្រើ
  `zoew-v` · `.wasm`)។ វាស់ browser ពិត (`qrcode.js` A `immutable` ➜ SW B) ៖ cache `-b` កាន់ A (**ធ្លាក់**) ➜ ក្រោយកែ B។ ផលប៉ះពាល់ថ្ងៃនេះតូច (`netlify.toml` ផ្ញើ `no-cache` លើ
  `*.js` · `*.css` · `*.png`) តែច្បាប់មានដើម្បីមិនពឹង header (CDN ចាស់ · header ប្តូរ)។ checker SW ៨ របស់ ZoeKeyGen ជាប់ទាំងអស់ក្រោយកែ។
- 🟡 **ប្រអប់ Extend របស់ ZoeKeyGen ប្រាប់ផ្ទុយការពិត** ៖ «ធ្វើការតែលើគ្រឿងដែល Activate រួច … លែងអាច Activate លើគ្រឿងថ្មី» តែ `activate()` យកពិដាន `online.expiresAt`
  (`license-clock-rollback-test` ច.១ វាស់ ៖ Key ហួស `exp` ដែល sign + DB Extend ➜ `valid`) ➜ អ្នកលក់បង្កើត Key ថ្មីឥតប្រយោជន៍ · ច.៩ ធ្លាក់លើ index.html មុនកែ។
- **បានពិនិត្យ មិនមែនកំហុស** ៖ ការលុបជាអចិន្ត្រៃយ៍ដោយដៃមិនដោះ `ded/<id>` (ដោះ ➜ journal `ledger` របស់ឧបករណ៍ផ្សេងរត់ការកាត់ម្តងទៀតពេល ring រុញ token ចេញ ➜ កាត់ ២ ដង ➜
  ការរក្សាសោ = មានសុវត្ថិភាពជាង · leak ~៧០ byte) · listener DB (generation gate · `detachDatabaseListeners()` មុនភ្ជាប់) · កាមេរ៉ា (`pause` ដដែលមិនស្ទួន · `loadedmetadata` ដកពេលបិទ) ·
  adapter Supabase (window listener ដកក្នុង `deleteApp` · CAS ពី server view + `waitDeps`) · registry · SW ZoeW (`deployUnchangedDuringInstall` · `responseFitsKey`) · push resync ·
  Setup Link (PIN + កាត) · តំបន់ចាក់សោ ZTO/Cookie (អានតែប៉ុណ្ណោះ · គ្មានការកែ)។
- **ជុំ ២** (ម្ចាស់គម្រោង ៖ «អ្វីនៅសល់កែឲ្យស្អាតទាំងអស់» ➜ ព្រំដែន ៥ ដែលជុំ ១ ទុក ➜ អ្នកយាមមុន ➜ កែ) ៖
  ក. **«លុបទាំងអស់» លើ id ដែល slot កាន់ជីវិតចាស់** ៖ ជុំ ១ កត់ថា «fail-safe» ➜ **ខុស** ៖ rules បដិសេធ finalize (`!root…recently_deleted/$itemId.exists()`) គ្រប់ដង ➜
  `finalizeClaimedHistoryClear()` សាក ៣ ដង (១,៥ + ៣ វិ.) ➜ «លុបមិនបានជោគជ័យ» + Sentry · `clearClaim` នៅលើធាតុ ហើយ `activeClearHistoryClaims` កាន់ token ➜
  `releaseStaleClearHistoryClaim()` មិនដោះលើឧបករណ៍នេះ ➜ ការសម្អាត ២ ម៉ោង/៨ ថ្ងៃ · ដក · លុប រំលងធាតុនោះរហូត reload (ឧបករណ៍ផ្សេង ៖ រហូតផុត lease) · «លុបទាំងអស់» ម្តងទៀតបរាជ័យដដែល។
  ឥឡូវ ៖ ការអានក្រោយការបដិសេធ (history កាន់ claim របស់យើង + trash មាន) ➜ `CLEAR_HISTORY_SLOT_TAKEN` (មិន retry) ➜ `releaseOwnClearHistoryClaim()` ➜
  `deleteSingleItem(id, { confirmed, quiet })` (slot ផ្លាស់ពីជុំ ១ · លទ្ធផល `deleted`/`pending`/`blocked`/`missing`/`failed`/`stale` ➜ ចំនួនក្នុងសារសង្ខេបតែមួយ)។
  អ្នកយាម `clear-history-foreign-slot.test.ts` ៖ fake អនុវត្ត fence finalize + ច្បាប់លុប history ដែលមាន `clearClaim` ពិត (មិនមែន fake ទទួលអ្វីៗទាំងអស់ ➜ សំណួរ «stubs accepting
  everything») ➜ មុនកែ ៖ ធាតុនៅ · ធ្លាក់ ២/៣ (ទិសផ្ទុយ slot ទំនេរ ៖ ផ្លូវ finalize ដើម · ការបដិសេធ ០)។
  ខ. **`restoreClaimedItemToScanHistory()` ទាំងមូល + `history/<id>` បង្កើតឡើងវិញ** ៖ `if (currentItem) return currentItem` ➜ barcode ដែល claim បាត់ ➜ ឥឡូវបញ្ចូលដូចផ្លូវផ្នែក
  (dedupe តាម code · ដក `isDeducted`) · តេស្ត ៩ ៖ មុនកែ `['D']` ➜ `['D','C']` · ១០ (ទិសផ្ទុយ ៖ គ្មានធាតុ ➜ ធាតុដែល claim ទាំងមូល) ជាប់ទាំងពីរ។
  គ. **`assignLockerToEntry()` ក្រោយប្តូរ session** ៖ ចម្លើយយឺត (ក្រោយពិដាន ១២ វិ.) ក្រោយចាកចេញ/ប្តូរ Database កែ `lockerBarcodeIndex` របស់ session ថ្មី (id + barcode ដដែល ពេលចូល
  គណនីដដែលវិញ) ហើយបង្ហាញ ✅/❌ ➜ ឥឡូវ `assignIsCurrent()` (db + `authGeneration`) ចាំងមុនរាយការណ៍ · `locker-claim-guard-test` sandbox ប្រកាស `authGeneration`។
  ឃ. **ZoeKeyGen `generateLicenseKey()`** ៖ ប្រតិបត្តិការ Admin ផ្សេងចាប់ `operationDb` រួច តែ Generate retry ដោយ `fb.ref(db)` ➜ Reconfig ចន្លោះ retry (១ វិ. · ២ វិ.) ➜ Key ចូល
  License Project ថ្មី ➜ ឥឡូវ `operationDb` + `generateIsCurrent()` (db · admin · Signing Key) · retry ក្រៅ session ➜ `noRetry`។ checker ថ្មីប្រើ `retryAsync()` ពិតពីកូដ ship
  (stub របស់ harness មិន retry ➜ ស្ថានភាពកំហុសមិនដែលកើត ➜ សំណួរ ៨)។ ស្កេន `fb.ref(db` ទាំងអស់ក្នុង ZoeKeyGen ➜ `migrateLegacyLicenseKeyMetadata()` (ប៊ូតុងក្នុងបញ្ជី Key) ក៏ដូចគ្នា ៖
  អាន A ➜ Reconfig ➜ សរសេរការផ្លាស់ទីរបស់ A ចូល B + ✅ ➜ កែតាមលំនាំដដែល (`isCurrent()` ក្រោយការអាន · ក្រោយការសរសេរ · ក្នុង `catch`) · `.info/*` និង `refreshKeyList()` (អានតែប៉ុណ្ណោះ ·
  `keyListSessionGeneration`) មិនមែនកំហុស។
  ច. **ការសាកឡើងវិញឆ្លង session (ZoeW)** ៖ ស្កេន `retryAsync(` ទាំងអស់ក្នុង ZoeW ដូច ឃ ➜ ការសរសេរធុងសំរាមរបស់ `claimAndCleanupItem()` · `deleteSingleItem()` ·
  `removeSingleBarcode()` សាក ៤ ដង (១,៥ · ៣ · ៦ វិ.) តាម `firebaseState.db` បច្ចុប្បន្ន ហើយការពិនិត្យ session នៅតែក្រោយការសាកចប់ ➜ ការសាកដែលកើតក្រោយការចាកចេញ/ប្តូរ Config
  = ការសរសេរថ្មីក្រោម session ថ្មី (Firebase ៖ Database ថ្មី · Supabase ៖ ការសរសេរដែលរង់ចាំត្រូវបដិសេធដោយ `authScope` ➜ `retryAsync()` សាកម្តងទៀតក្រោមគណនីថ្មី ➜ tenant ផ្សេង)
  ➜ កញ្ចប់ហាង A ចូលធុងសំរាមហាង B · «ដក» ៖ ការស្តារ barcode ក្រោយបរាជ័យសរសេរចូលប្រវត្តិហាង B (`revertRevenueLedgerDelta()` មាន `applied.isCurrent` រួចហើយ ➜ ledger មិនប៉ះ) ·
  `restoreClaimedItemToScanHistory()` ចាប់ ref ដើម តែនៅលើ Supabase db ដដែល + គណនីថ្មី ➜ tenant ផ្សេង។ ឥឡូវ closure នៃការសាកនីមួយៗពិនិត្យ session (`noRetry`) · «ដក» ចាប់
  session ពេល `finishRemoval()` ចាប់ផ្តើម (ផ្លូវ late commit ក្នុងហាងដដែលមិនប្រែ) ហើយឈប់មុនការស្តារពេល session ប្តូរ (ព្រំដែន MONEY-3 «ដក» គ្មាន journal ដដែល ៖ Sentry money)។
  ឆ. **resume ពេលប្តូរ session កណ្តាលផ្លូវ** (ម្ចាស់គម្រោង ៖ «ហេតុអីបានមិនទាន់វាស់» ➜ វាស់) ៖ `resumeCleanupJournalEntry()` ពិនិត្យ scope តែនៅដើម ➜ ប្តូរហាងពេលអានធុងសំរាម
  (stage `moved`) ➜ ទិដ្ឋភាពហាង B «barcode មិនត្រឡប់» ➜ សរសេរធុងសំរាមហាង A ចូល B ➜ **កាត់ ៧ ពី ledger ខែ និងថ្ងៃរបស់ហាង B** ➜ flip ក្នុង B (`ZoeW/tests/cleanup-resume-session.test.ts` ១) ·
  stage `slot` ដូចគ្នា (៣) · ប្តូរក្រោយសរសេរធុងសំរាមក្នុង A ➜ កាត់ក្នុង B (៤)។ ការប្តូរកណ្តាលជំហាន ledger ខែមិនបន្តទៅថ្ងៃ (`commitLedgerEventStep()` ពិនិត្យ session ក្រោយ
  transaction រួច ➜ ២ ជាប់មុនកែ = អ្នកយាមទិសផ្ទុយ)។ ការកែ ៖ ចាប់ session នៅដើម `resumeCleanupJournalEntry()` · `resolveCleanupSlot()` · `settleCleanupDeduction()` ➜ ពិនិត្យក្រោយ
  `await` នីមួយៗ និងក្នុង closure នៃការសាក (`noRetry`) ➜ journal នៅសម្រាប់ហាងដើម។
- **ជុំ ៣** (ម្ចាស់គម្រោង ៖ «វាស់ឡើងវិញទាំងអស់នៅអ្វីដែលមិនទាន់វាស់ ជាពិសេសការពារលេចទិន្នន័យចូលគ្នារវាងហាងខុសគ្នា» · «ផ្ទៀងផ្ទាត់ រកកំហុសទូទាំង project») ៖
  ជំនួសការអានទ្វារម្តងមួយ (ក្រុមដដែលនៃកំហុសលេចតាមទ្វារជាច្រើន ➜ រចនាសម្ព័ន្ធ ➜ វាស់ជាសំណុំ) ➜ **fuzz ប្តូរ session** (`ZoeW/tests/session-switch-fuzz.test.ts`) ៖ ប្រតិបត្តិការសរសេរពិត ២៧ (ស្កេនរក្សាទុក · ដក · លុប ·
  បិទ/បើក · កែតម្លៃ · កែលេខ · ការហៅ · Locker · សម្អាត ២ ម៉ោង/៨ ថ្ងៃ · sweep · resume ៣ stage · ស្តារ · លុបអចិន្ត្រៃយ៍ · លុបទាំងអស់ · Reset · អត្រាប្រាក់ · registry claim/release ·
  origin · purge · ដោះ clearClaim ចាស់ · ជួសជុល pickup) ➜ ចម្លើយនៃការហៅ Firebase ទី k មកដល់ក្រោយ macrotask ដែលប្តូរហាង (Database + `authGeneration` ថ្មី) ➜ ដំណើរការ
  timer ៩០ វិ. (retry · ពិដាន `dbOp` · late commit) ➜ រាប់ការសរសេរដែលចេញក្រោយការប្តូរ (Supabase ៖ ការសរសេរក្រោយការប្តូរ = គណនីថ្មី = ហាងផ្សេង មិនថា ref ចាប់មុនឬអត់)។
  កំណែដំបូងប្តូរហាងក្នុងកូដ synchronous (កណ្តាលការហៅ) ➜ artifact (ការប្តូរពិតកើតតែពេល event loop ទំនេរ) ➜ ប្តូរដោយ macrotask ➜ លទ្ធផលពិត ៖ **៦ ទ្វារលេច** ៖
  ដក (transaction ប្រវត្តិឆ្លើយក្រោយការប្តូរ ➜ `finishRemoval()` ចាប់ session ថ្មី ➜ កាត់ ledger ថ្ងៃ/ខែ + ធុងសំរាមក្នុង B) · ស្តារ (គ្រប់ k ៖ claim · ប្រវត្តិ · finalize · mirror ក្នុង B) ·
  លុបអចិន្ត្រៃយ៍ + purge (ដោះ registry ក្នុង B ➜ ការការពារស្កេនស្ទួនរបស់ B ខូច) · លុបទាំងអស់ (loop + retry finalize) · `repairPickupLedgerOnce()` (សំណុំ barcode + លេខទូរស័ព្ទ A ចូល B)។
  ការកែ ៖ ចាប់ session នៅដើម ➜ ពិនិត្យក្រោយ `await` នីមួយៗ (ស្តារ ៖ sentinel `RESTORE_SESSION_SWITCHED` ➜ `catch` ឈប់ស្ងាត់ៗ + Sentry money · គ្មាន alert/អានទិដ្ឋភាពឡើងវិញក្នុង B) ·
  «ដក» ចាប់ session នៅដើម (មិនមែននៅ `finishRemoval()`) ➜ late commit ក្រោយប្តូរ ➜ ឈប់ + Sentry money (ដូច «លុប» · ការសម្អាត)។ ៦ ទ្វារផ្សេង (បិទ/បើក · Locker · ការហៅ · កែលេខ ·
  `reconcileCollectedHistory()` · `releaseBarcodesInRegistry()` · `saveBarcodeOrigins()` · `commitLedgerEventStep()`) មានការពិនិត្យរួច ➜ ជាប់មុនកែ។ ជួររង់ចាំ (`pendingRegistryReleases` ·
  `pendingHistoryPatches`) សម្អាតពេលចាកចេញ (`clearSensitiveModalFields()`) និងប្តូរ Config (teardown) រួចហើយ។ **ផ្លូវ retry** ៖ របៀប fuzz ដំបូង «ការសរសេរទី ១ ធ្លាក់»
  ជាប់ ៥៤/៥៤ = **បៃតងក្លែង** (ការសរសេរទី ១ របស់ការស្តារជា claim ➜ ឈប់មុនដល់ finalize) ➜ ប្តូរទៅ «ការសរសេរទី w ធ្លាក់» គ្រប់ w ➜ រកឃើញ `finalizeClaimedRestore()` ៖
  រង្វិលសាក ៣ ដង (`update` ពហុផ្លូវ ៖ finalization · លុបធុងសំរាម · **បូកប្រាក់ ledger ត្រឡប់** · កូនសោ ledger) អាន `firebaseState.db` បច្ចុប្បន្ន ➜ ការប្តូរហាងក្នុងចន្លោះ
  ១,៥ វិ. នៃការសាក ➜ `update` ចេញទៅហាង B (Firebase ៖ rules របង witness បដិសេធ · Supabase ៖ ច្បាប់ដដែល តែការផ្ញើខ្លួនឯងបានលេចរួច) ➜ ការកែ ៖ ចាប់ Database + `authGeneration`
  នៅដើម ➜ ពិនិត្យមុនការសាកនីមួយៗ និងក្រោយការអានធុងសំរាម (`RESTORE_SESSION_SWITCHED` ➜ `executeRestoreItem()` ឈប់ + Sentry money)។ ⛔ តំបន់ចាក់សោ ZTO (`zto-list-sync` · `zto-status` · `zto-shop-sweep`)
  មិនកែ ៖ វាហៅ `claimBarcodeInRegistry()` · `addOrUpdateEntry()` · `applyBarcodeCloseChange()` ដែល fuzz វាស់ ➜ ជាប់ · `markZtoShopSweep()` សរសេរតែត្រាពេល (មិនមែនទិន្នន័យអតិថិជន)។
  **ទិន្នន័យក្នុងឧបករណ៍ឆ្លងហាង** (វាស់តាម logout ពិត ៖ `onAuthStateChanged(null)` + `clearSensitiveModalFields()` · teardown `initFirebase()`) ៖ ប្រវត្តិ · ធុងសំរាម · ledger · pickup ·
  mirror · Locker index · តារាងអតិថិជន + cache Lookup (`clearCustomerDataTableCache()`) · ជួររង់ចាំ · ZTO · docs cache Supabase ➜ សម្អាត។ **អត្រាប្រាក់** ➜ កំហុស ៖ listener
  ធ្វើបច្ចុប្បន្នភាពតែពេលមានតម្លៃ ➜ ហាង B ដែលគ្មាន node បន្តប្រើអត្រាហាង A (memory + `zoew_exchange_rate`) ➜ node ទទេ = 4100 + ដកច្បាប់ចម្លង។ **ការសម្រេចរបស់ម្ចាស់គម្រោង**
  (ការរចនា មិនមែនកំហុសកូដ ➜ មិនកែ) ៖ ការកំណត់ Lookup API · តារាងអតិថិជន (`zoew_lookup_api_config`) · Excel ទៅ Sheet ជារបស់ **ឧបករណ៍** ➜ ឧបករណ៍មួយដែលចូលហាង Supabase ច្រើន
  (Project តែមួយ) ប្រើ Lookup/តារាងអតិថិជនរបស់ហាងដែលកំណត់ចុងក្រោយ (ZTO `/detail` ការពារដោយ `ZTO_DETAIL_IDENTITY=require` + `ZTO_DETAIL_BRANCH_PATHS`) · push ហាង Supabase
  (`supabaseTenantKeyId()`) មិនដោះពេលចាកចេញ ➜ ឧបករណ៍នៅទទួលការរំលឹកជិតផុតកំណត់របស់ហាងមុន (ពេលវេលាប៉ុណ្ណោះ គ្មានទិន្នន័យអតិថិជន) ➜ handoff។
  **ស្កេនរចនាសម្ព័ន្ធ** (មុខងារ async ក្នុង `ZoeW/src` ដែលសរសេរ Firebase ក្រោយ `await`) ៖ ១១ គ្មានការពិនិត្យ session តែសរសេរតែម្តងនៅដើម (មុន `await` ដំបូង) ហើយអ្នកហៅពិនិត្យរួច
  (ស្តារ · លុបទាំងអស់ · resume · `applyCleanupRevenue()` ចាប់ផ្តើម ledger synchronous) ➜ គ្មានទ្វារលេចថ្មី។
  **ធាតុ «មិនទាន់វាស់» ក្នុង handoff** ៖ localStorage ពេញ ➜ វាស់ (`cleanup-deduct-order.test.ts` ១២ ៖ `vi.spyOn(appLocalStore, 'setItem')` បោះ QuotaExceededError ·
  លក្ខខណ្ឌចាំបាច់ ៖ App ព្យាយាមសរសេរ journal ពិត · ការប្តូរ prototype ដំបូងមិនប៉ះ storage របស់ App ➜ តេស្តជាប់ដោយមិនចូលស្ថានភាព = បៃតងក្លែង ➜ ចាប់បានដោយការអះអាង
  លក្ខខណ្ឌ) ➜ ការសម្អាតដែលមិនត្រូវរំខាននៅត្រឹមត្រូវ (ធុងសំរាម flip · ledger ៩០ · កាត់ម្តង) · ព្រំដែន ៖ storage ពេញ **និង** App ស្លាប់កណ្តាលការសម្អាត ➜ គ្មាន journal ដើម្បីបន្ត
  (`fail-open` ជាការសម្រេចដែលមានស្រាប់)។ ZTO `pages` អវត្តមាន ➜ វាស់ (probe លើ `zto-list-sync-test` harness ពិត · មិន commit) ៖ ZTO ឆ្លើយ ១០០ ជួរ (ពេញទំព័រ) គ្មាន `meta.pages`
  ➜ Function `pages: 1` ➜ `fetchZtoSignedPages()` `truncated: false` ➜ ការអានចុះហត្ថលេខា «ពេញលេញ» ➜ កញ្ចប់ចុះហត្ថលេខានៅទំព័រ ២+ អាចសម្អាត ៨ ថ្ងៃជា «ផុតកំណត់» (កាត់ប្រាក់)
  ➜ ⛔ **តំបន់ចាក់សោ** (`zto-order-detail.js` · `zto-list-sync.ts`) ➜ មិនកែ ➜ ស្នើម្ចាស់គម្រោង ➜ ម្ចាស់គម្រោង ៖ «ZTO កែចុះ» ➜ **ZTO-E13** (ខាងក្រោម)។ born-closed `closedAt` ·
  sign list truncate ក្នុងមួយថ្ងៃ ➜ អ្នកយាមដែលមានស្រាប់ (`zto-born-closed-merge` · `zto-signed-cadence` · `zto-signed-only-purge`) · ការសម្អាតពេលអេក្រង់ PIN ➜ រចនាត្រឹមត្រូវ
  (ការងារហាងនៅរត់ · toast រង់ចាំ `releaseHeldToasts()`)។ **វាស់មិនបាននៅទីនេះ** (ត្រូវការបរិស្ថានពិត) ៖ edge functions/CORS លើ APK · captive portal ពិត · egress ring `ops` ·
  event «Perf overlay» · realtime Supabase ស្ងាត់ (poll ៥ នាទី = ការសម្រេចរបស់ម្ចាស់គម្រោងនៅរង់ចាំ)។
  ការផ្ទៀងផ្ទាត់ជុំ ២ ៖ vitest ១២៨ ឯកសារ · ១១៦៥/១១៦៥ · `tsc` ស្អាត · checker sandbox ១៩ ពាក់ព័ន្ធ ជាប់ · run-all STRICT (emulator RTDB រស់) លើ `2b72656` បញ្ឈប់ដោយចេតនា
  (រកឃើញ Migrate ក្រោយ commit) ➜ លើ `235e1b7` ៖ **២០៤/២០៤** (០ មួយផ្នែក · ០ រំលង)។
  ង. **ធាតុចាស់គ្មាន `barcodes`** («មិនទាន់វាស់» ក្នុង handoff) ៖ វាស់ ➜ ការសម្អាត ៨ ថ្ងៃ ៖ ledger ១០០ ➜ ៩៣ តែ `uncollectedValueByDate()` នៅរាប់ ៧ (`isDeducted` កម្រិតធាតុមិនដែល flip ·
  rules ធុងសំរាមគ្មាន `isDeducted` កម្រិតធាតុ) ➜ «ចំណូល (យករួច)» ៨៦ ជំនួស ៩៣ រហូត purge ២ ថ្ងៃ ➜ ឥឡូវ `ensureBarcodeArrayForItem()` ក្នុង claim abandon (ដូច `removeSingleBarcode()`) ·
  sandbox ៥ (`cleanup-interrupt-atomicity` · `db-stall-guard` · `ledger-count-integrity` · `partial-pickup-cleanup` · `restore-marker-hygiene`) ស្រង់ helper នេះ (មុន ៖ ReferenceError ក្នុង updater
  ➜ ធ្លាក់ ៥៦ · ៤ · ៨ · ១៩) · `policy-test` ស្រង់ `deleteSingleItem(` តាមបុព្វបទ (ប៉ារ៉ាម៉ែត្រ `opts` ថ្មី)។

### 2026-10-09 — Deep audit ៤ (សំណើម្ចាស់គម្រោង ៖ «deep audit Network, Race, duplicate listener, sw, firebase, supabase, money, ច្បាប់លុប ដក, zto, Cookie … កុំជឿជាក់លើ checker ក្រែង checker បៃតងក្លែងក្លាយ») ➜ [2.50.52]

- 🔴 **ZoeKeyGen ៖ `isDatabaseInitialized` មិនដែលប្រកាស** (ការរកឃើញពិត · មានតាំងពី commit ដំបូងរបស់ repo `238d7f5`) ៖ function ជណ្តើរស្តារ SDK ចម្លងពី ZoeW
  (`firebaseState.isDatabaseInitialized` ➜ ទិដ្ឋភាពអត្ថបទជា global) អានឈ្មោះនេះ ៤ កន្លែង តែ ZoeKeyGen មិនប្រកាស ➜ script ធម្មតា = `ReferenceError` ពេលបន្ទាត់រត់។
  វាស់ក្នុង Chromium ពិត (gstatic បិទ · ពិដាន SDK ១៥ វិ. ➜ ០,៨ វិ.) មុនកែ ៖ `pageerror`/`unhandledrejection` «isDatabaseInitialized is not defined» ×២ · probe ទៅ host SDK **០** ·
  ការរង់ចាំ SDK **១** (ជណ្តើរមិនដែលរត់) ខណៈ toast «កំពុងព្យាយាមម្តងទៀត...» · `firebasesdkready` យឺត ➜ `initializeApp` **០** ដង (listener បោះ) ➜ ZoeKeyGen ជាប់ «ក្រៅបណ្ដាញ»
  រហូតដល់ចុច Refresh ដោយដៃ។ ក្រោយកែ ៖ ReferenceError ០ · ជណ្តើររត់ · SDK យឺត ➜ `initFirebase()` ពិត។
- **ហេតុអ្វី checker បៃតងក្លែង** ៖ `connection-recovery-test` ស្រង់ function ZoeKeyGen ទៅ `vm` ហើយ **ប្រកាស `isDatabaseInitialized: false` ជំនួស App** (sandbox ទទួលយកអ្វីៗទាំងអស់ ·
  CLAUDE.md «Warnings» ២) · `sdk-offline-boot-test` វាស់ browser តែ ZoeW។ ឥឡូវ sandbox ផ្តល់អថេរតែពេល App ប្រកាសវាពិត · ផ្នែក browser ZoeKeyGen ថ្មី ·
  `function-surface-test` វិភាគ scope ពិតរបស់ script ធម្មតាទាំងអស់ពី `<script src>` (probe `ghostFlagNeverDeclared` ត្រូវរកឃើញ · ជាន់ការយោង ≥ ៥០០០/៨០០) ➜ ថ្នាក់ «អាន
  ឈ្មោះគ្មានការប្រកាស» ទាំងមូល មិនមែនតែឈ្មោះនេះ។ ស្កេនបន្ថែម (ESLint `no-undef` · Node) ៖ `netlify/` · `tools/` · `firebase-backup/` · `supabase/scripts` ➜ ០។
- 🔴 **Push ៖ កូនសោ VAPID ប្តូរ ➜ PWA «បើក» តែស្ងាត់** (ពីរបាយការណ៍ម្ចាស់គម្រោងក្នុង session នេះ) ៖ `subscribeWeb()` ពិនិត្យកូនសោ (ពេលចុចបើក) តែ `resyncPush()`
  (ពេលបើក App · រាល់ ២៤ ម៉ោង) មិនពិនិត្យ ➜ subscription ដែលជាវដោយកូនសោចាស់ត្រូវផ្ញើទៅ server រៀងរហូត · push service បដិសេធ (៤០៣ VAPID មិនត្រូវ) ➜ `push-cron`
  រាប់ `fail` (មិនមែន `gone` ➜ មិនលុប) ➜ គ្មានសញ្ញាណាមួយលើទូរស័ព្ទ។ មិនអាចវាស់ site ពិតពីទីនេះ (proxy បិទ `zoew.netlify.app`) ➜ មូលហេតុផ្សេងដែលនៅអាចមាន ៖ env ថ្មីមិនទាន់
  Deploy · `FCM_SERVICE_ACCOUNT` ពី Project ផ្សេង (APK) · Xiaomi Autostart ➜ ការពិនិត្យដោយដៃក្នុង README។
- **បានវាស់ ហើយមិនមែនកំហុស** ៖ Sentry ១៤ ថ្ងៃ (៧ issue) ៖ `JAVASCRIPT-REACT-D` (2.50.47 · បានកែក្នុង [2.50.49]) · `-7` · `-9` មានក្នុងផ្នែកនេះរួច · `-8`
  (`permission_denied` ៧ event · APK ហាង Supabase · ១ ដង/ផ្លូវ/ការដាច់ ✓ `dbListenerReportedFailures`) · `-B`/`-C` «Database link unresponsive» (probe zombie socket ✓) ·
  Supabase Project ផ្ទាល់ ៖ migration live ១៣ = repo ១៣ · advisor security ៖ `zoe_ops` RLS គ្មាន policy (ចេតនា ៖ ចូលតាម definer តែប៉ុណ្ណោះ) · **Leaked Password Protection បិទ**
  (ការកំណត់ Auth ក្នុង Dashboard · ⏳ ម្ចាស់គម្រោងពិចារណា) · performance ៖ index FK ២ មិនទាន់ប្រើ (តារាងតូច) · listener ZoeW (`detachDatabaseListeners()` មុនភ្ជាប់ ·
  generation gate គ្រប់ callback) · listener adapter Supabase (`app._unlisten`) · ZoeKeyGen `.info/*` · auth (detach មុន attach)។
- 🟠 **ZoeKeyGen ៖ teardown auth ខុសពី ZoeW** (ផ្លូវបងប្អូន · `setupAuthListener` · `initFirebase` ក្នុង `EXPECTED_DIVERGENT` របស់ `shared-fns` ➜ គ្មានអ្នកយាមធៀប) ៖
  ZoeW ផ្តាច់ auth/ពិដាន/ឡើងជំនាន់មុន `deleteApp` (ច្បាប់ «Stale callbacks») តែ ZoeKeyGen មិនធ្វើ ហើយពិដាន ៨ វិ. ជាអថេរក្នុង function ➜ កែក្នុង [2.50.52]។ ផលប៉ះពាល់
  តិច (Config License ប្តូរកម្រ) តែជាថ្នាក់ដូច `isDatabaseInitialized` ៖ function ចម្លងពី ZoeW ដោយខ្វះស្ថានភាពរបស់វា។
- 🔴 **ជុំបន្ត (session ដដែល) ៖ ថ្នាក់ «ជំនាន់ session រសើប ប្រើជាសញ្ញាសម្គាល់យូរ»** (ZoeKeyGen) ៖ `closeModal('pinModal')` · `clearSigningKey()` · Signing Key ផុតពេលទំនេរ ·
  `initFirebase()` ឡើង `sensitiveSessionGeneration` ដើម្បីបោះបង់ប្រតិបត្តិការ PIN ដែលកំពុងហោះ តែ (១) `finally` របស់ `generateLicenseKey()` ដោះសោតែពេល session នៅ ➜
  សោជាប់ (ប៊ូតុងស្លាប់ · `expireIdleSigningKey()` លែងដក Key) · (២) `sbAdminIsCurrent()` ពិនិត្យជំនាន់ដែលចាប់ពេលចូល Supabase ➜ ផ្ទាំងហាងទាំងមូល return ស្ងាត់ ➜ កែក្នុង
  [2.50.52] (សោមានម្ចាស់ · `adminOwnerIsCurrent()` = `uid` + UI ចូលរួច)។ (៣) ប្រតិបត្តិការកែ Key (Generate · Revoke · Extend · ឧបករណ៍ · ដំណឹង) បោះសារ ✅/⏳ និង Key ដែល
  Generate ពេលបិទប្រអប់ PIN កណ្តាលការសរសេរ (ការសរសេរនៅចុះ ➜ Key ខ្មោចក្នុងបញ្ជី) ➜ ម្ចាស់គម្រោង «កែទាំងអស់» ➜ កែក្នុង [2.50.52] (`adminOperationIsCurrent()` = `uid` +
  `authGeneration`)។ ច្បាប់ ៖ ជំនាន់ session រសើបការពារតែប្រតិបត្តិការ **សម្ងាត់** (Signing Key · keypair · ក្រយៅដៃ · Clipboard) · ប្រតិបត្តិការ admin ចងនឹងអ្នកចូល។ checker ចាស់ក្លែង
  «ចាកចេញ» ដោយ `invalidateSensitiveSession()` តែម្តង (= បិទប្រអប់ PIN មិនមែនការចាកចេញ) ➜ អះអាងចាស់លាក់ថ្នាក់នេះ ➜ ឥឡូវក្លែងដូច `logoutApp()` ពិត។
- 🔴 **Service Worker ៖ deploy ជាន់កណ្តាល install** (ធាតុ «មិនទាន់វាស់» ក្នុង Handoff) ➜ វាស់ក្នុង browser ពិត ៖ `cache.addAll()` ទទួល `index.html` 200 ក្រោម key JS ចម្បង ➜
  SW activate ➜ App ស ➜ កែក្នុង [2.50.52] (`shellEntriesFit()`)។ ព្រំដែនដែលនៅសល់ ៖ ឯកសារគ្មាន hash (vendor · `boot-flags.js` · ZoeKeyGen ទាំងមូល) អាចជាលាយ deploy N/N+1
  បើ deploy ជាន់ចំកណ្តាល install (online ដើរ · ក្រៅបណ្តាញអាចខ្វះ asset ថ្មី រហូតដល់ SW បន្ទាប់) ➜ ដំណោះស្រាយដែលអាចធ្វើ ៖ ពិនិត្យ sw.js ពិតក្រោយ `addAll` (មាន `CACHE_VERSION` ដដែល ➜ ទទួល ·
  ខុស ➜ install ធ្លាក់ · បណ្តាញធ្លាក់ ➜ ទទួល) ➜ ម្ចាស់គម្រោង «កែទាំងអស់» ➜ កែក្នុង [2.50.52] (`deployUnchangedDuringInstall()` · App ទាំង ២)។
- 🔬 **វាស់លើ Firebase SDK ពិត (emulator)** ៖ `set()` · `runTransaction()` · `get()` ដែលរង់ចាំ offline **មិន settle ទាល់តែសោះ** ក្រោយ `deleteApp()` ➜ សោដែលដោះតែក្នុង
  `then`/late handler ជាប់រហូតក្រោយប្តូរ Config/backend ➜ `exchangeRateSaveInFlight` (ប៊ូតុងរក្សាទុកអត្រាប្រាក់ស្ងាត់) កែក្នុង [2.50.52] (teardown ដោះ ដូច
  `historyPatchFlushInFlight` · `registryReleaseFlushInFlight`)។ សោផ្សេងបានពិនិត្យ ៖ `clearHistoryInFlight` · `pickupResetInFlight` · `deletedCleanupInFlight` · `phoneModalBusy` ·
  `sessionExpiryCheckInFlight` · `notifyFeedInFlight` · `ztoWarmupInFlight` · push (`scheduleInFlight` · `busy`) មានពិដានគ្រប់ await ✓ · `cleanupResumeInFlight` រង់ចាំប្រតិបត្តិការ
  ledger ដោយគ្មានពិដាន (ច្បាប់ «⛔ never give up on a time ceiling») ➜ ក្រោយប្តូរ Config ខណៈ resume ព្យួរ ការ resume បន្ទាប់រង់ចាំ reload (journal នៅដដែល · Web Lock របស់ entry ក៏ជាប់
  ដោយ promise ស្លាប់) ➜ ពន្យារ មិនបាត់ · ព្រំដែនដែលទទួលស្គាល់។
- **ការដកពាក់កណ្តាល + `disconnect` ពេលទិដ្ឋភាពធុងសំរាមចាស់** (`cleanupClaimAccountedElsewhere()`) ៖ ឧបករណ៍ ២ claim barcode ដដែលដែលទុំ ហើយមួយទទួល `applied` តាមការអាន REST
  (តម្លៃនៅសល់ដូចគ្នា) ➜ ពិនិត្យតែធុងសំរាមក្នុងសតិ ➜ ទិដ្ឋភាពចាស់ ឬការសរសេរធុងសំរាមរបស់ឧបករណ៍ផ្សេងមិនទាន់មកដល់ ➜ `ours` ➜ ធុងសំរាម ២ + ដក ២ ដង។ ការប្តូរ `stale ➜ unknown`
  ដោះដូរការដក ២ ដងនឹងកញ្ចប់បាត់ (គ្មានធុងសំរាម) ➜ មិនកែដោយសង្ស័យ។ ដំណោះស្រាយរចនាសម្ព័ន្ធ ៖ id ធុងសំរាមកំណត់ពី item + សំណុំ barcode ➜ `claimCleanupTrashSlot()` សម្រេចដូចការ claim
  ទាំងមូល ➜ ម្ចាស់គម្រោង «កែទាំងអស់» ➜ កែក្នុង [2.50.52]។ ពេលសរសេរអ្នកយាម ឃើញថ្នាក់ធំជាង ៖ ការ claim ធម្មតា (ទាំងមូល និងពាក់កណ្តាល) សរសេរធុងសំរាមដោយ overwrite ➜ Y ដែល
  `applied` ខុស ហើយកាន់ slot មុន X ➜ X ជាន់ ហើយដកម្តងទៀត (token ledger មាន `deletedAt` ផ្សេង ➜ `ded/<trashId>` មិនរារាំង) ➜ ការសរសេរធុងសំរាមនៃការសម្អាតទាំងអស់ឆ្លង slot។
- 🔴 **ប្រអប់ស្វែងរកបាត់ពេលអូសបញ្ជី (រាយការណ៍ម្ចាស់គម្រោង)** ៖ probe ដំបូង (Chromium · iOS standalone ក្លែង · ចុចប្រអប់ ➜ អូស) **មិនឃើញ** ព្រោះមិនវាយលេខ ➜ បញ្ជីវែង
  រមូរខ្លួនឯង ➜ ការអូសមិនដែលហូរទៅ `#appPages` (សំណួរ ៨ «សេណារីយ៉ូត្រូវចូលស្ថានភាពកំហុស»)។ វាយលេខឲ្យសល់ ១ ជួរ ➜ ឃើញភ្លាមលើ iOS **និង Android** (`pagesTop 96` ·
  កាតនៅក្រោម navbar) ហើយ blur ➜ ទ្វារទី ២ (`collapse`)។ មេរៀន ៖ «មិនបានឃើញ» ≠ «គ្មាន» ➜ វាស់ស្ថានភាពដែលអ្នកប្រើពិពណ៌នា (កំពុងស្វែងរក = មានលេខ = លទ្ធផលតិច) ➜ កែក្នុង [2.50.52]។
- **បានពិនិត្យ មិនមែនកំហុស** ៖ fuzz លុយ seed ថ្មី `FUZZ_RUN0=700 FUZZ_RUNS=24 FUZZ_OPS=90` PASS ៣/៣ («ឧបករណ៍ផ្សេងដក» ២៤ លំដាប់ · `ledgerBlip` applied ១៨ · lost ១៨) ·
  `tools/supabase-migrate` (op_id កំណត់ពីទិន្នន័យ ➜ rerun = replay · ផ្ទៀងហាងក្រោយសរសេរ · ចាប់ការសរសេរពីឧបករណ៍ផ្សេង) · ZoeW គ្មាន sink HTML ឆៅ (`tel:` មាន prefix) ·
  Edge Functions ចុះឈ្មោះ/ប្តូរពាក្យសម្ងាត់ · ការដោះ registry ជា batch (rules អនុញ្ញាតលុបជានិច្ច) · rules `exchange_rate` ·
  Sentry ៩០ ថ្ងៃ ៖ events ទាំងអស់ `app: zoew` · `find_dropped_events` គ្មាន `filtered` (Allowed Domains មិនបោះ ZoeKeyGen) ➜ ZoeKeyGen ០ event = គ្មាន error
  (ឬមិនទាន់មានអ្នកប្រើ) · adapter Supabase ផ្ញើ auth event តែពេលចូល/ចេញ/ស្តារ ➜ `phoneModalBusy` មិនជាប់ · CORS Edge Functions សម្រាប់ APK (`https://localhost` ក្នុង README) ·
  `dispatchNotices` at-most-once (`onlyIfMatch` ledger) · ការទាញ 🔔 feed · push config មានពិដាន។
- **មិនទាន់វាស់/សម្រេច (ទុកម្ចាស់គម្រោង)** ៖ Supabase realtime ស្ងាត់ពី server (`realtime.send` ក្នុង `zoe_broadcast_seq` លេបកំហុសដោយចេតនា) ➜ ឧបករណ៍នៅ `SUBSCRIBED` ហើយទាញតែ
  `SB_POLL_REALTIME_MS` (៥ នាទី) ➜ ជម្រើស ៖ ទាញរៀងរាល់ ៦០ វិ. ពេលអេក្រង់បើក (egress តូច · ១ RPC/នាទី/ឧបករណ៍) ឬចាប់ការបាត់ broadcast តាមលេខ seq។
- **ZTO-E13 (សំណើម្ចាស់គម្រោង ៖ «ZTO កែចុះ» · «ពិនិត្យអោយស្អាតចុះ ZTO ហើយចាក់សោរវិញ»)** ៖ ផ្លូវតំបន់ចាក់សោ ៖ អ្នកយាមមុន ➜ កែ ➜ អ្នកយាម ZTO ទាំងអស់ ➜ `LOCK`។
  ការរចនា ៖ Function មិនដឹងទំព័របន្ទាប់ទេ ➜ «ទំព័រពេញ = ប្រហែលមានបន្ត» (`pagesUnknown` · `pages` = ទំព័រ + ១) · client អាន **តាមលំដាប់** (មិនមែនស្របគ្នាដល់ពិដាន ៖ ZTO
  ដែលបដិសេធទំព័រហួសចុងនឹងធ្វើឲ្យការទាញទាំងមូលធ្លាក់) · រង្វិល `for (;;)` មានព្រំដែនរចនាសម្ព័ន្ធ (ជុំនីមួយៗ `readArrival`/`readSigned` កើន ឬឈប់ · ≤ ពិដាន ៣) ·
  ZTO មាន `pages` ➜ រលកតែមួយដូចមុន (វាស់ ៖ ការហៅ upstream ដដែល) · ពិដាន client (៣) ≤ លំនាំដើម server `ZTO_LIST_MAX_PAGES` ចាក់សោដោយ `zto-list-sync-test` ស្រាប់។
  វាស់មុនកែ ៖ vitest ៦/៩ FAIL · checker ៣ FAIL (`{"pages":1}` · ទំព័រទី ២ ទទេ `{"pages":0}`)។ ព្រំដែន ៖ ZTO ដែលមិនអើពើ `pageNum` (ឆ្លើយទំព័រដដែល) ➜ ស្ទួនក្នុងបញ្ជី (ក្រុម
  «♻️ ស្ទួន») ហើយពិដាននៅពេញ ➜ `truncated` (មិនពេញលេញ ➜ មិនកាត់ប្រាក់ខុស)។
- **ជុំ ៤ (ម្ចាស់គម្រោង ៖ «ok ធ្វើទាំង៣ចំណុចហ្នឹងទៅ» ➜ ចំណុចដែលជុំ ៣ ទុកឲ្យម្ចាស់គម្រោងសម្រេច + អាយុ Cookie)** ៖
  - **ការកំណត់ជាប់ឧបករណ៍** ៖ `zoew_lookup_api_config` · `zoew_sheet_import_config` គ្មានហាង ➜ ហាង B ប្រើ Lookup/តារាងអតិថិជន/Sheet របស់ហាង A។ ការរចនា ៖ `shopScope()`
    (`src/core/shop-scope.ts`) = មូលដ្ឋានដដែលនឹង journal ការសម្អាត (`cleanupJournalScope()` ហៅវា ➜ គ្មានរូបមន្តទី ២) · `sameShop()` ស្មើ `/` ចុង និងអក្សរធំ/តូច ·
    ហាងមិនទាន់ស្គាល់ (Supabase មុនបាន `tenant`) ➜ ការកំណត់ដែលចងរួចមិនប្រើ (fail-closed) · ការកំណត់ចាស់ ➜ ចងទៅហាងដំបូងដែលអានវា (ម្ចាស់ពិតមិនអាចដឹង ➜ ព្រំដែនដែលទទួលស្គាល់ ➜
    [2.50.53] សកម្មភាព ៥)។ វាស់មុនកែ ៥/៦ FAIL។ **checker បៃតងក្លែង** ៖ `late-commit-test` · `tx-outcome-test` ជាប់ទោះ sandbox គ្មាន `shopScope` ព្រោះការហៅ journal fail-open
    (`ReferenceError` ត្រូវលេប) ➜ journal មិនដែលដំណើរការក្នុង checker ទាំងនោះ ➜ sandbox ៧ (atomicity · tx-outcome · late-commit · db-stall · partial-pickup · crud-rules-flow ·
    lookup-config-secret) ប្រកាស `shopScope` ពិតឥឡូវ។
  - **Push** ៖ Server ត្រឹមត្រូវរួច (`subscribe` ក្រោម keyId ថ្មីដកចេញពី `bykey/<ចាស់>` ➜ `push-server.test.ts` ជាប់លើកូដមុនកែ) ➜ ចន្លោះនៅ client ៖ `resyncPush()` ចុះឈ្មោះឡើងវិញ
    តែរៀងរាល់ `PUSH_RESYNC_MS` (៦ ម៉ោង) ➜ ហាងចាស់ផ្ញើ «ជិតផុតកំណត់» ទៅឧបករណ៍ដែលចូលហាងផ្សេងរហូតដល់ ៦ ម៉ោង · Firebase ៖ keyId = Activation Key (ដដែលគ្រប់ហាង) ➜ `sched/<keyId>`
    របស់ហាងចាស់នៅ រហូតដល់ហត្ថលេខាកាលវិភាគប្តូរ (ហាងថ្មីដែលកាលវិភាគដូចគ្នា ➜ មិនផ្ញើ)។ កែ ៖ `PushSaved.shop` · `pushShopMoved()` ➜ ចុះឈ្មោះភ្លាម (`resumePushAfterSignIn()`) ·
    ជោគជ័យ ➜ `syncExpirySchedule(true)` · ធ្លាក់ ➜ `PUSH_RESYNC_RETRY_MS` (មិនរាល់ `visibilitychange`) · ការកំណត់ចាស់គ្មាន `shop` ➜ ចុះឈ្មោះម្តង។ វាស់មុនកែ ៥/៦ FAIL។
  - **អាយុ Cookie ZTO** (តំបន់ចាក់សោ ៖ អ្នកយាមមុន ➜ កែ ➜ អ្នកយាម ZTO ទាំងអស់ ➜ `LOCK`) ៖ មុន ៖ `authAcceptedAt`/`authRejectedAt` រស់ក្នុង container មួយ ហើយ reset ពេល Cookie
    ប្តូរតម្លៃ (ការបន្តអាយុ) ➜ គ្មានទិន្នន័យឆ្លើយ «១០–១៤ ម៉ោង ឬ ៣–៤ ម៉ោង»។ ការរចនា ៖ key `cookie-life` ដាច់ពី `cookie` (ឧបករណ៍ Sync សរសេរជាន់ metadata របស់ `cookie` ➜ ប្រវត្តិ
    មិនអាចនៅទីនោះ) · កូនសោ = `syncedAt` (ការ Sync មួយ = ជីវិតមួយ · ការបន្តអាយុមិនចាប់ជីវិតថ្មី) · បញ្ចូលដោយ max (`a` · `r`) ➜ លំដាប់ការសរសេររវាង container មិនសំខាន់ ·
    «ស្លាប់» = `r > a` ➜ ការបដិសេធមួយភ្លែតដែល ZTO ទទួលវិញ ព្យាបាលខ្លួនឯង · ETag `onlyIfMatch`/`onlyIfNew` + សាក ៣ ដង · ការបដិសេធកត់តែនៅចម្លើយ `ZTO_AUTH_EXPIRED` ចុងក្រោយ ហើយ
    តែពេល session នៅជា Cookie បច្ចុប្បន្ន (Cookie ចាស់ដែល Sync ថ្មីជំនួស មិនរាប់ថាស្លាប់) · ការទទួលសរសេរ ≤ ១ ដង/`COOKIE_LIFE_ACCEPT_GAP_MS`/container (ភ្លាមពេល Sync ថ្មី ឬក្រោយ
    ការបដិសេធដែលកត់) · ថវិកា ៖ `cookieRenewTimeoutMs()` ស្របគ្នាជាមួយ `flushCookieRenewal()` · ធ្លាក់ ➜ មិនសាករហូត `COOKIE_LIFE_RETRY_MS` (Blob ជាប់គាំងមិនបន្ថែម ≤ ០.៩ វិ.
    លើរាល់ការស្កេន) · diag អានស្របគ្នាជាមួយការអាន Cookie (≤ `COOKIE_STORE_TIMEOUT_MS`)។ វាស់មុនកែ ១២/១២ FAIL។ **fake ក្លែង** ៖ Blobs ក្លែងក្នុង `zto-cookie-store-test` មិនបែងចែក key
    (key ណាក៏ = Cookie) ➜ ការសរសេរ `cookie-life` នឹងជាន់ Cookie ក្នុង fake (មិនមែនក្នុង Blobs ពិត) ➜ fake បែងចែក key ឥឡូវ · «diag ទី ២ ប្រើ cache» រាប់តែ key `cookie`។
    ព្រំដែន ៖ «ប្រើបានចុងក្រោយ» ពី container ផ្សេងច្បាស់ ≤ ១០ នាទី (container ដដែលច្បាស់) · Cookie ពី env ឬ Sync ដោយឧបករណ៍ចាស់ (គ្មាន `syncedAt`) ➜ មិនវាស់ ·
    Sync session ដដែលម្តងទៀត (ចុចដោយដៃពេលវានៅរស់) ➜ ជីវិតថ្មី (អាយុរាប់ពី Sync ចុងក្រោយ = តិចជាងអាយុពិតនៃការចូល Argus) · `idleMs` មិនរងផល ( `--auto` Sync តែពេល Cookie ស្លាប់)។
  - **ការពិនិត្យ ZTO ម្តងទៀត (ម្ចាស់គម្រោង ៖ «ពិនិត្យ ZTO អោយហ្មត់ចត់ … ពេលរួចស្អាតចាក់សោរវា»)** ៖ អានការកែជុំ ៤ ពីផ្លូវ ZTO ទាំងអស់ដែលអាន `getLookupApiConfig()` ➜
    **រកឃើញ regression** ៖ ការកំណត់ដែលចងហាងមិនប្រើពេលហាងមិនទាន់ស្គាល់ ➜ ហាង Supabase ដែល session ស្តារ តែគណនីមិនទាន់មកដល់ (គ្មាន cache គណនី · `my_account()` ក្រៅបណ្តាញ)
    ➜ `ztoAutoCloseEnabled()` = `false` ➜ `ztoAbandonCleanupIsHeld()` មិនរង់ចាំ ➜ ទិដ្ឋភាពប្រវត្តិស្រស់មកដល់ (Supabase ទាញបានទោះគណនីមិនទាន់ផ្ទៀង) ➜ ការសម្អាត ៨ ថ្ងៃដកលុយកញ្ចប់
    ដែល ZTO ចុះហត្ថលេខារួច (សញ្ញាហាងជួយតែពេលឧបករណ៍ ZTO ផ្សេងកំពុងអាន)។ ក្នុងផ្លូវដដែល ៖ `cleanupJournalScopeMismatch()` = `false` ពេល scope បច្ចុប្បន្នទទេ ➜ journal របស់ហាង A
    បន្តក្នុងហាងដែលមិនទាន់ស្គាល់ (ចន្លោះចាស់)។ កែ ៖ `shopScopePending()` (config Supabase + គ្មាន `tenant`) ➜ `runAutomaticCleanupRules()` · `resumeInterruptedCleanups()` រង់ចាំ
    ⛔ មិនកែឯកសារចាក់សោ (`zto-status.ts` មិនប្រែ ➜ `LOCK` មិនប្រែ) · Firebase ស្គាល់ហាងជានិច្ច (`databaseURL`)។ វាស់ ៖ `7894e2d` ២/៤ FAIL · `f572e1d` ១/៤ (journal) · ក្រោយកែ ៤/៤។
    sandbox ដែលស្រង់ `runAutomaticCleanupRules()`/`resumeInterruptedCleanups()` (`cleanup-clock-guard-test` · `cleanup-interrupt-atomicity-test` · `partial-pickup-cleanup-test` ·
    `restore-marker-hygiene-test` · `stale-clear-claim-test` · `emu/crud-rules-flow`) ធ្លាក់ `ReferenceError` ភ្លាម (មិនលេបដូច journal) ➜ ប្រកាស `shopScopePending()` ពិត ➜ ជាប់ទាំងអស់។
    ព្រំដែនដែលទទួលស្គាល់ ៖ ឧបករណ៍ចូលហាងច្រើន ➜ ហាងដែលមិនទាន់កំណត់ API ZTO លើឧបករណ៍នេះមិនរង់ចាំ ZTO ([2.50.53] សកម្មភាព ៥ ⚠️)។
  - **warning (ម្ចាស់គម្រោង ៖ «ពិនិត្យរក warning ហើយប្រាប់ខ្ញុំ និងកែសម្រួលផង»)** ៖ ប្រភពដែលវាស់ ៖ eslint · tsc · vitest · CI `npm ci` (log ផ្នែក 1/4) · Supabase advisors។
    ① eslint `react-hooks/incompatible-library` (`HistoryTableBody.tsx` ៖ `useVirtualizer()`) ៖ rule ប្រាប់ថា React Compiler នឹងរំលង memoize ➜ build **មិនប្រើ** React Compiler
    (`vite.config.mts` គ្មាន babel/compiler) ➜ គ្មានផលពេលរត់ ➜ បិទ rule តែលើឯកសារនោះ (`'use no memo'` សាករួច ៖ warning នៅ)។ ② npm 11 `install-scripts` ៖ advisory ក្នុង npm 11
    (`strict-allow-scripts` = `false` ➜ script នៅរត់) តែ npm 12 បិទជាលំនាំដើម ➜ `allowScripts` pinned ➜ វាស់ដោយ npm 11.21 ពិត (`npm ci` ក្នុងថតបណ្តោះអាសន្ន) ៖
    `No packages with unreviewed install scripts` · esbuild 0.28.2 ដំណើរការ · Postgres symlink ១៤។ ③ `deprecated` (`glob@10` · `uuid@9` · `json-ptr` · `node-domexception`) ៖
    មកពី `firebase-tools` (កំណែចុងក្រោយ 15.33.0 នៅពឹង `glob ^10.5.0`) ➜ `overrides` អាចបំបែក firebase-tools ➜ មិនកែ (រង់ចាំ upstream)។ ④ Supabase WARN «Leaked Password
    Protection» ➜ ការកំណត់ Dashboard (ម្ចាស់គម្រោងសម្រេច · handoff) · INFO ៣ ដោយចេតនា (`zoe_ops` អានតែតាម function · index របស់ foreign key)។
    ⑤ `sw-install-integrity-test` ធ្លាក់ ១ ដងក្នុង run-all (load 4.8 លើ CPU ៤) ៖ ជុំទី ១ រង់ចាំ ៨ វិ. ឲ្យ install ដែលបរាជ័យក្លាយជា `redundant` ➜ SW នៅ `installing`
    (មិន activate · cache ទទេ ➜ ការការពារត្រឹមត្រូវ) ➜ ពិដាន ២០ វិ. ដូចជុំទី ២ (ការអះអាងមិនប្រែ) · រត់ម្នាក់ឯង ➜ ជាប់ · CI ៤/៤ ជាប់លើ tree ដដែល។

### 2026-10-09 — ចលនាតាមវីដេអូ និងរូប emoji ➜ [2.50.51]

- `positionPhoneSuggestBox()` ពិនិត្យតែ `rect.bottom < 0`៖ input នៅ `top=-4`, `bottom=40` ប៉ុន្តែ navbar បញ្ចប់នៅ `51` ➜ input លាក់ពេញ តែ suggestion នៅបើក។ ព្រំដែនថ្មីប្រើ navbar, appPages និង visual viewport; ពេលប្តូរ search-focus បិទមុន commit។
- `.scanner-input-wrapper .icon` មាន `z-index: 1`; `.page-side` មិនមាន stacking context ពេលបើក ➜ icon ឆ្លងលើ `.page-main` ដែល transform បង្កើត context កម្រិត auto។ វាស់មុនកែ៖ hit-test ត្រឡប់ icon នៅ ៣ សំណាកកាតកញ្ចប់ និង ២ សំណាក Locker ក្នុង profile នីមួយៗ។ `isolation: isolate` រក្សា z-index របស់ scanner នៅក្នុងផ្ទាំងរបស់វា។
- CI Audit ផ្នែក 4/4 លើ `c5f792e`៖ `phone-suggest-test` បង្កើតលេខដោយ prefix ចាស់ តែរំពឹង prefix សំយោគថ្មី ក្រោយការប្តូរលេខ fixture។ កែ generator/query/expectation ទាំងបីទៅលេខសំយោគដូចគ្នា; មិនដក assertion។
- Reduce Motion៖ computed toast transition នៅតែ `0.25s` ទាំងពីរ App និងប៊ូតុង ZoeKeyGen នៅតែមាន transition។ សាកទាំង `reduce` និង `no-preference` ដើម្បីការពារការបិទចលនាធម្មតាខុសចេតនា។
- ពិនិត្យ flow កាតបន្ថែមតាមសំណើម្ចាស់គម្រោង៖ Chromium នៅទទឹង 320, 414, 768, 1024 និង 1280px; ZoeW ផ្ទាំងទិន្នន័យ/កញ្ចប់/Locker/ដកកញ្ចប់ និង ZoeKeyGen បង្កើតសោ/បញ្ជី/តំណ/ហាង/សារ។ វាស់កាតស្ថិតិ ស្វែងរក scanner និងបញ្ជីពេលស្ងៀម និងពេល focus/blur/បង្រួម/ពង្រីក/ប្តូរ tab; សំណាកចលនាប្រើ animation ពិតនៅ 0%, 20%, 40%, 60%, 80% និង 100%។ លទ្ធផល ៤៦៤ សេណារីយ៉ូ និង ៦៨៣៦ ការវាស់រួមទាំង hit-test និងការត្រួតគ្នានៃកាត៖ គ្មានធាតុលេចឆ្លងលើកាតខាងមុខក្រោយកែ។ ប្រើទិន្នន័យសំយោគ; មិនជំនួសការសាកលើឧបករណ៍ពិត។

### 2026-10-09 — Deep audit security (សំណើម្ចាស់គម្រោង ៖ «deep audit security ការពារ និងពង្រឹង និង leak secret» · «អ្នកយាមសម្រាប់ security គ្រប់ផ្នែក») ➜ [2.50.50]

- **Sentry Replay/tracing** (ការរកឃើញពិត) ៖ Sentry មាន replay ថតសម័យ production (ឧ. ២២ នាទី · `zoew@2.50.47` · options `sessionSampleRate=0.1, errorSampleRate=1`) និង span
  `http.client` ១៣ ៨២១ ក្នុង ៧ ថ្ងៃ (Supabase · Netlify · Firebase · identitytoolkit) ➜ ប្រភព ៖ Loader settings ក្នុង Sentry UI (Replay · Performance បើកតាមលំនាំដើម)
  ព្រោះ `guardedOptions()` មិនកំណត់ rate ទាំងនោះ។ Replay · span · log **មិនឆ្លង** `beforeSend` ➜ ការលាក់ `SECRET_PARAM_PATTERN` មិនគ្រប ➜ ផ្លូវលេចធ្លាយ ៖
  `txReadServerValue()` (ZoeW) · `readUserRoleViaRest()` (ZoeKeyGen) ដាក់ ID token ក្នុង `?auth=`។ វាស់ ៣០ ថ្ងៃ ៖ span `http.client` ដែល URL/query មាន `auth` = **០** ➜
  គ្មានភស្តុតាងថា token លេចពិត (អានតែកម្រ ៖ disconnect កណ្តាល transaction) តែផ្លូវបើក ➜ បិទក្នុង [2.50.50] (`sentry-load-race-test` ផ្នែក ៥ ក្រហមមុនកែ)។
  ⏳ ការកំណត់ Loader ក្នុង UI ជាសកម្មភាពម្ចាស់គម្រោង ([2.50.50] សកម្មភាព ២)។
- **`security-guard-test`** (ថ្មី · repo public + App ដែល ship) ៖ ក secret ក្នុងឯកសារ repo (git ls-files + ឯកសារថ្មី · ប្រភេទ ១៥ + ទិសផ្ទុយគ្រប់ប្រភេទ) · env ដែល commit
  (`ZoeW/.env.android` តែ `VITE_NATIVE_WEB_ORIGIN`) · ខ env/ឈ្មោះ secret server ក្នុង client · `sourcemap: false` · `define` · គ លេខទូរស័ព្ទ/waybill ពិត · ឃ CSP/header
  (ratchet ប្រភពមានហេតុផល) · CORS របស់ Function · ង GitHub Actions · ច Firebase rules សាធារណៈ · ឆ Supabase `verify_jwt`/RLS/grant · ជ **bundle ផលិតកម្មពិត**
  (`vite build` ទៅថតបណ្តោះអាសន្នរាល់ដង ≈ ២ វិ. ➜ មិនពឹង `ZoeW/dist` ដែលនៅសល់ ៖ sourcemap · secret · bridge build វាស់ · លេខអតិថិជន) · ឈ APK (WebView debug ·
  mixed content · cleartext · component exported)។ mutation លើច្បាប់ចម្លង ១៦/១៦ ក្រហម ៖ CSP host ទាំងមូល · `unsafe-inline` · `persist-credentials: true` ·
  `pull_request_target` · លេខទូរស័ព្ទ/waybill ពិត · `import.meta.env.VITE_*TOKEN` · `sourcemap: true` (ផ្នែក ខ + ជ) · WebView debug · provider exported · `.write: true` ·
  `verify_jwt = false` ថ្មី · CORS `*` លើ Function ZTO · env ថ្មីក្នុង `.env.android` · GitHub token ក្នុងឯកសារ · តារាងគ្មាន RLS · ថតទទេ ➜ ២៩ FAIL។
  ការរកឃើញពេលសាងអ្នកយាម ៖ `service_role` ក្នុង bundle = អត្ថបទការពារ (`supabaseKeyIsSecret()` បដិសេធ key) មិនមែន secret ➜ មិនស្ថិតក្នុងបញ្ជីឈ្មោះ server។
- **លេខអតិថិជនពិតក្នុង repo public** ៖ fixture/ឯកសារ ៤៨ (តេស្ត · `zto-import` · `docs`) មានលេខទូរស័ព្ទ ២១ និង waybill ២២ ដែលមិនមែនលំនាំសំយោគ (ខ្លះជាលេខហាង KC-15) ➜
  ប្តូរជាប់គ្នាគ្រប់ឯកសារ (៣៣១ កន្លែង ៖ ៣ ខ្ទង់ក្រោយលេខក្រុមហ៊ុន ➜ `000` · waybill ខ្ទង់ ៧–១០ ➜ `0000` · ខ្ទង់ចុងក្រោយដដែល ➜ ការស្វែងរកតាមចុងលេខ · ប្រវែង · ក្រុមហ៊ុនដដែល) ·
  ⛔ commit ចាស់នៅមានលេខទាំងនោះ (📌 ធាតុ ៣ក)។ ស្កេនប្រវត្តិពេញ (`git fetch --unshallow` · blob ៧៦៦២) ៖ secret ពិត **គ្មាន** · លេខអតិថិជនមិនសំយោគ ៥៥ តម្លៃ។
- **ពង្រឹងផ្សេង** ៖ CSP `script-src` ថត `firebasejs/` · `android-release.yml` checkout `persist-credentials: false` (token `contents: write` មិននៅលើ disk runner) ·
  `csp-lazy-resource-test` គោរព path។
- **វាស់ ➜ ល្អរួច (កុំរាយការណ៍ម្តងទៀត)** ៖ Android ៖ `allowBackup="false"` · `dataExtractionRules` · `webContentsDebuggingEnabled: false` · `allowMixedContent: false` ·
  FileProvider មិន exported · Function ZTO CORS តែ `https://localhost` (APK) · Function Push CORS `*` ដោយ auth ក្នុង body (គ្មាន Cookie) · Sentry `sendDefaultPii: false` ·
  `SellerTelegramLink` `rel="noopener noreferrer"` · គ្មាន `dangerouslySetInnerHTML` · Supabase advisor ៖ `zoe_ops` RLS គ្មាន policy (ចេតនា ៖ ចូលតែតាម definer) ·
  ⏳ Leaked password protection បិទ ([2.50.50] សកម្មភាព ៤)។

### 2026-10-09 — ហាង Supabase KC-15 ៖ ការដកផុតកំណត់ត្រូវកាត់ពាក់កណ្តាល ➜ Task #16 «សោដកក្នុង ledger» ➜ [2.50.49]

**អាការៈ** ៖ «ស្កេនតាមថ្ងៃ» ៣៥៣ ≠ យករួច ២៥៧ + នៅសល់ ៩២ = ៣៤៩។ **មូលហេតុ** ៖ កញ្ចប់ផុតកំណត់ ៣ (barcode ៤ · $12.75 · ថ្ងៃ 2026-10-02) ត្រូវដកនៅ 10-09 ម៉ោង 08:33
(iPhone · 2.50.47) ចំពេលម្ចាស់គម្រោង redeploy Netlify ➜ ការដកត្រូវកាត់ ➜ journal នៅ stage `ledger` ➜ ការស្តាររាយការណ៍ «unverified» ហើយមិនដក (Sentry JAVASCRIPT-REACT-D · itemCount 1)។

**ការជួសទិន្នន័យ (ម្ចាស់គម្រោងអនុញ្ញាតម្តងមួយៗ · session មុន)** ៖ (១) op `adminRepairKC15expired20261009` (02:37 UTC · DO block ផ្ទៀងតម្លៃមុន + `private.zoe_apply`) ៖
ថ្ងៃ 10-02 ១៥៧,០៨/៤២ ➜ ១៤៤,៣៣/៣៨ · ខែ 2026-10 ១២៣២,៦៩/២៦២ ➜ ១២១៩,៩៤/២៥៨ · flip barcode ៤ ➜ `isDeducted: true` (count ៤២ មុនជួស = barcode ៤ មិនទាន់ដក ➜ មិនដកពីរដង) ·
(២) op `adminRepairKC15drift362_20261009` (03:17 UTC) ៖ ថ្ងៃ 10-02 COD លើស +$3.62 ➜ ១៤០,៧១/២,៥/៣៨ · ខែ ១២១៦,៣២/១២,៥/២៥៨ ➜ គ្រប់ថ្ងៃស្មើ identity
(Σ barcode `isDeducted != true` ក្នុងប្រវត្តិ + ធុងសំរាម)។ ⛔ កុំសរសេរលុយ KC-15 ម្តងទៀត។

**+$3.62 ៖ អ្វីដែលវាស់បាន** ៖ ថ្ងៃ 09-29 ➜ 10-07 នាំចូលពីបញ្ជី ZTO ក្នុងពេលតែមួយ (10-07 00:14–00:23 UTC · 2.50.2/2.50.3) ត្រូវគ្នាទាំងអស់ · 10-02 ជាថ្ងៃតែមួយដែលឆ្លងការដក
ផុតកំណត់ (10-09 01:33 UTC) · `zoe_ops` (រក្សា ២ ថ្ងៃ · `{ok,seq,docs}` គ្មានចំនួនទឹកប្រាក់) ៖ 10-07 02:19 ➜ 10-09 01:33 គ្មានការសរសេរថ្ងៃ 10-02 · ក្នុង 01:33:34–01:33:53 ថ្ងៃ 10-02
ត្រូវសរសេរ ២២ ដង ៖ ២០ គូនឹងកញ្ចប់ ២០ ដែល flip · **២ លើស** (seq 3102 · 3125) នៅកន្លែងកញ្ចប់ «unverified» ៣ ➜ សរុប count ០ · COD +៣,៦២ (បើការនាំចូលត្រឹមត្រូវ) ·
គ្មានការរួមផ្សំធម្មតាណាពន្យល់បាន (មិនមែនដកខ្វះ ១ + ដកពីរដង ១ ដែល count ស្មើ · មិនមែនផ្នែកនៃកញ្ចប់ដែលបូកបាន ៣,៦២) ➜ ចំនួនទឹកប្រាក់នៃការសរសេរនីមួយៗវាស់មិនបានទៀតទេ។
កូដ cleanup 2.50.45 = 2.50.47 · ការដកផ្ទាល់គណនាពី barcode របស់ server ➜ ចំណុចសង្ស័យ ៖ reload កណ្តាលការដក + ការស្តារ/ការរស់ប៉ះគ្នា។

**ថ្នាក់កំហុស (វាស់លើ tree មុនកែ · `cleanup-ledger-key.test.ts`)** ៖ (ក) ការដកដែលចម្លើយបាត់គ្មានភស្តុតាងនៅ server ➜ ការស្តារជ្រើស «មិនប៉ះលុយ» ជានិច្ច ➜ ledger ខុសដោយស្ងាត់
(KC-15) · (ខ) flip ចុះ ហើយ App ស្លាប់មុនលុប journal ➜ អ្នកប្រើស្តារ (+១០ តាម flag) ➜ journal stage `flip` ឃើញធុងសំរាមបាត់ + barcode ត្រឡប់ ➜ បូកវិញម្តងទៀត ➜ **១១០** ·
(គ) undo (`applyCleanupRevenue(+1)`) ដែលកាត់ពាក់កណ្តាល ➜ រត់ម្តងទៀត ➜ ថ្ងៃ **១១០** · (ឃ) ឧបករណ៍ស្លាប់កណ្តាល flip + journal បាត់ ➜ ការស្តារមិនបូកវិញ (flag false) ➜ ៩០។

**ការរចនា (ហេតុអ្វី ខែ ➜ ថ្ងៃ · token កំណត់ · `prior`)** ៖ record ខែ (`zoew_monthly_revenue_cod_dod`) ត្រូវសរសេររាល់ការស្កេន (ring ១២ ប្តូររហ័ស) ➜ សោក្នុងខែនឹងធ្វើឲ្យរាល់ការស្កេនផ្ញើ
record ខែធំជាងមុន (egress) ➜ សោតែក្នុងថ្ងៃ (record ថ្ងៃផុតកំណត់ ≥ ៨ ថ្ងៃ ស្ងាត់) · ខែដកមុន ➜ សោថ្ងៃ = ទាំង ២ ចុះ។ App ≤ 2.50.48 សរសេរ record ថ្ងៃឡើងវិញដោយគ្មាន `ded` ➜ token
កំណត់ក្នុង ring ជាភស្តុតាងទី ២ (App ≥ 2.50.22 រក្សា ring ហើយរុញ seq ទាបចេញមុន ➜ token មុនការដកនៅ ⇒ token យើង (seq ខ្ពស់ជាង) ក៏នៅ បើបានចុះ)។ ⛔ token ផ្ទាល់គ្មាន `prior` មិនគ្រប់
គ្រាន់ ៖ ring ពេញ ឬ App < 2.50.22 លុប ring ➜ «គ្មាន token» មិនមែនភស្តុតាង «មិនទាន់ចុះ» (ដកពីរដង) ➜ សម្រេចមិនបាន ➜ មិនប៉ះលុយ។ ទំហំ ៖ សោ ~៧០ byte/កញ្ចប់ផុតកំណត់
ក្នុង record ថ្ងៃ ➜ purge ២ ថ្ងៃលុបវា។ ការសរសេរ `ded` លើ rules ចាស់ (emulator) ៖ ៤០១ ➜ ថយទៅ token គ្មានសោ ➜ ២០០។

**ជុំបញ្ចប់ (session ទី ៣ · run-all STRICT ពេញលើ `d0940f9` ៖ ១៩៦ ជាប់ · ធ្លាក់ ៦)** ៖ handoff រាយការណ៍តែ checker ពាក់ព័ន្ធ ៣០ ➜ run-all ពេញរកឃើញ ៖
(១) sandbox ៣ ខ្វះ function ថ្មី (`returned-trash-retention-test` · `write-stall-guard-test` ៖ `cleanupLedgerKeyOf` · `connection-recovery-test` ៖
`runCleanupLedgerKeySweep` ➜ stub ដូចការងារសម្អាតផ្សេង) · (២) **bug ពិត** ៖ `releaseCleanupLedgerKeys()` គ្មានពិដាន ហើយ purge រង់ចាំវាក្រោមសោ ➜
អ្នកយាម `write-stall-guard-test` ផ្នែក ២ខ មុនកែ FAIL ➜ `dbOp()` · (៣) លិបិក្រមខ្វះជួរ `ZoeW/tests/cleanup-ledger-key.test.ts` ·
(៤) `zoew-suite-test` លើសពិដាន ៣០០ វិ. (ជំហាន ១៣ តាមលំដាប់ · `native:check` · `rules:check` មិនទាន់រត់) ➜ ⛔ មិនបង្កើន `CHECKER_TIMEOUT` ➜
`--part=1/2` (ឋិតិវន្ត · vitest) · `--part=2/2` (build ហើយអ្វីៗដែលប្រើ `dist` តាមលំដាប់) ដូច `money-guardian-test` · (៥) `zto-network-boundaries-test`
«HTTP body ព្យួរ» ៖ fetch ដំបូងក្នុង process + lane ស្របគ្នា ➜ ពិដាន ១០០ms ផុតមុនសំណើទៅដល់ server (វាស់ ៖ ម៉ាស៊ីនពេញ CPU ៖ កំណែចាស់ធ្លាក់ ១/៦ ·
កំណែថ្មី (កំដៅ fetch · ពិដាន ៤០០ms) ជាប់ ៤/៤) · (៦) `money-guardian-test` ទាំង ២ ផ្នែកជាប់ (២៥ · ២២)។ checker ក្រហម ២ របស់ handoff ៖
`emu/crud-rules-flow` (sandbox ខ្វះ ៤ ឈ្មោះ ➜ ផ្ទុក function ពិត + ផ្នែក ៥) · `rules:check` (parity Android = web ៖ id/`at` របស់សោ `ded` ថ្មីរាល់ដង ➜ ប្តូរឈ្មោះតាមធុងសំរាម ·
cod/dod/count ប្រៀបធៀបដដែល ➜ ៧៥ ok)។

### 2026-10-09 — វីដេអូម្ចាស់គម្រោង ៖ ប្រអប់ស្នើលេខ · keyboard · សារទទេទំព័រស្កេន ➜ [2.50.48]

**វិធី** ៖ ញែកវីដេអូ ៣ (APK · PWA Android ៩០ ស៊ុម/វិ. · iPhone ៦០ ស៊ុម/វិ.) ជាស៊ុម (`ffmpeg` ២០–៦០ ស៊ុម/វិ.) ➜ វាស់ទីតាំងកាតស្វែងរក · ប្រអប់ស្នើលេខ · keyboard តាមស៊ុម ➜
សង់អ្នកយាមក្នុង Chromium ដែលធ្លាក់លើកូដមុនកែ ➜ កែ។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A72 | **ប្រអប់ស្នើលេខនៅទីតាំងចាស់ ហើយលោតតាមក្រោយ** (ទាំង ៣) | វីដេអូ APK ៖ កាតរអិល ១៦០ ➜ ៥៥ ក្នុង ~១០០ms ខណៈប្រអប់ស្នើនៅ y ១៩៥ (ទីតាំងចាស់) ៦ ស៊ុម ➜ លោតទៅ ៩៧ ពេល timer `positionPhoneSuggestBox` 180ms · មូលហេតុ ៖ `positionPhoneSuggestBox()` អាន rect ដែលមាន transform FLIP (ស៊ុម ០ = ទីតាំងចាស់) · Chromium ៖ គម្លាតប្រអប់/ប្រអប់ស្វែងរក ៤ ➜ ៩៨ ➜ … ➜ ៣០០px ១០ ស៊ុម | ជុំដំបូង ៖ ប្រអប់តាម glide ក្នុងនាឡិកាដូចគ្នា ➜ ម្ចាស់គម្រោងស្នើក្នុងជុំដដែល ➜ ប្រអប់បិទពេលរអិល ធ្លាក់ចុះក្រោយ `settled()` |
| A73 | **«keyboard ដូច glitch»** | APK ៖ keyboard រអិល ~២០០ms រលូន · របា Tab លាក់ពេល keyboard ចាប់ផ្តើម (ច្បាប់ keyboard-open) ចំពេលប្រអប់ស្នើលោត ➜ មើលទៅរញ៉េរញ៉ៃ · PWA Android ៖ Chrome បង្ហាញរបារ autofill «kc15 •••••» (ឈ្មោះចូល) + រូបតំណាងពាក្យសម្ងាត់/កាត/ទីតាំង ពីលើ keyboard មុន keyboard មកដល់ (ចន្លោះទទេ ~១០០ms) · ប្រអប់ស្វែងរក `type="tel"` `autocomplete="off"` · ប្រអប់ PIN `type="password"` ក្រៅ `<form>` (App Lock · PIN) ➜ Chrome អាចដាក់ fields ក្រៅ form ក្នុង «form» តែមួយ ➜ ទាយប្រអប់ស្វែងរកជា username (⚠️ ទ្រឹស្តី · វាស់លើ Chrome Android មិនបាន) · iPhone ៖ របារ ^ v ✓ របស់ iOS | ផ្នែកដែល App គ្រប់គ្រង (ប្រអប់ស្នើលោត) ➜ A72 · របារ autofill Chrome ➜ មិនកែ (រង់ចាំម្ចាស់គម្រោងរាយការណ៍បើនៅរំខាន) |
| A74 | **iPhone ៖ ចលនាស្វែងរកមើលទៅលោត** | វីដេអូ iPhone (៦០ ស៊ុម/វិ.) ៖ ស៊ុមចុងក្រោយមុនការប្រែ ➜ ស៊ុមបន្ទាប់កាតនៅ ~៩០% នៃចម្ងាយ (២១២ ➜ ៧២ · ចុង ៦៤) · ខ្សែកោង `cubic-bezier(0.22, 1, 0.36, 1)` 220ms ៖ ៨០ms = ៨៩% ➜ iOS មិនបង្ហាញស៊ុម ~៨០ms ពេលរៀបចំ keyboard ខណៈនាឡិកា animation រត់ · ទំព័រស្កេនដូចគ្នា (ផ្ទាំងបង្រួមភ្លាម) · blur (glide ក្នុង timer ១៥០ms) រលូន ➜ មិនមែន Reduce Motion · Chromium ៖ ស៊ុមដំបូង ៣១.៦% · busy-loop ១២០ms ក្រោយស៊ុមដំបូង ➜ ៩៨% | `PANEL_SEARCH_GLIDE` ៖ `cubic-bezier(0.4, 0, 0.2, 1)` (៨០ms = ៣៣%) · pause រហូតស៊ុមហូរ ➜ ក្រោយកក ០% · ⚠️ ការកកលើ iOS អាចកើតក្រៅ web process (ទ្រឹស្តី) ➜ ខ្សែកោងថ្មីជាស្រទាប់ការពារទី ២ |
| A75 | **ទំព័រស្កេន ៖ ប្រអប់កញ្ចប់ «ឡើងមកឈរពីលើ keyboard តាមក្រោយ»** | វីដេអូ APK ៖ keyboard ពេញ ១២.៦ វិ. ➜ ១២.៨ វិ. សារ «មិនទាន់មាន…» លោតពីក្រោម keyboard មកពីលើ (KeyboardOpenHold បង្រួម WebView តែម្តងពេលចប់) · PWA Android ៖ ដូចគ្នា (Chrome បង្រួមក្រោយ keyboard) · មូលហេតុ ៖ `.table-responsive` `flex: 1` ➜ សារទទេជាកូនចុងកាត ➜ ផ្លាស់ទីតាមបាតកាត (`100dvh`) · Chromium ៖ ផ្ទៃ -៣៣០ ➜ សារ ៧២៥ ➜ ៣៩៥ | `.entry-search-open` ៖ តារាង `flex: 0 0 auto` · សារ `flex: 1 1 auto` (តែពេលស្វែងរកក្នុងផ្ទាំងបង្រួម ➜ សេណារីយ៉ូ `panel-motion-test` ផ្នែក ៩ មិនប្រែ) |

- **អ្នកយាមដែលត្រូវតាមក្រោយ** (run-all STRICT លើ `2705554` ៖ ធ្លាក់ ២ · ជាប់ ២០០) ៖ (១) `layout-thrash` រង់ចាំត្រឹម ៨០ms ក្រោយ focus + input ហើយតម្រូវ `#phoneSuggestBox.show` ➜ ឥឡូវប្រអប់ធ្លាក់ចុះតែក្រោយ glide ចប់ (រង់ចាំស៊ុមហូរ ≤ `PANEL_GLIDE_HOLD_MAX_MS` + `PANEL_SEARCH_GLIDE_MS`) ➜ poll រហូតបង្ហាញក្នុងពិដាន `SUGGEST_SHOW_CEILING_MS` (១៥០០ms · ផុតពិដាន = FAIL)។ មិនមែនបន្ធូរទេ ៖ អ្វីដែលវាស់ (ចំនួនការវាស់ទីតាំងពេលរមូរ ≤ ៤) មិនប្រែ · (២) `doc-scope-test` ៖ លិបិក្រម 🔎 ជួរ `panel-motion-test` (ផ្នែក ១ · ផ្នែក ២) · `panel-snap-ownership-test` (ផ្នែក ១) តាមការលេចថ្មីនៃ [2.50.48] · (៣) run-all STRICT លើ `fd7b03e` ៖ ២០១/២០២ ➜ `zoew-suite` ធ្លាក់ដោយ `history-window-check` «ចលនាស្វែងរកមិនលោត» PWA Android `steps [0, 0.21, 0.152 …]` (រត់ម្នាក់ឯង ៖ ជាប់)។ វាស់ស្ថានភាព animation តាមស៊ុម ៖ ធម្មតា `pending · currentTime 0` ➜ `running 17ms` (០,០០៨) · ពេលម៉ាស៊ីនរវល់ ៖ main thread នៅឃើញ `pending` (ទីតាំងដើម) ខណៈ compositor រត់រួច ➜ startTime ត្រូវដាក់ថយក្រោយ ➜ ស៊ុមបន្ទាប់លោតទៅ `currentTime ≈ 67ms` (០,២០៩ = ការរីកចម្រើនសរុប ៤ ស៊ុម) = ការវាស់ខុសរបស់ main thread មិនមែនចលនាដែលមើលឃើញ ➜ មិនរាប់ជំហានដែលស៊ុមមុនជា `pending` · ជាន់អប្បបរមា ៖ ឃើញ `pending` ≥ ១ · ជំហាន ≥ ៨។ Mutation `PANEL_SEARCH_GLIDE_MS` ២៨០ ➜ ៦០ ➜ FAIL ៣/៣ (APK · PWA Android · PWA iPhone) · ការលោតពេលចាប់ផ្តើម (A74) នៅតែវាស់ដោយ «ស៊ុមកក ១២០ms» ➜ run-all STRICT លើ `f30684c` ៖ **២០២/២០២** (មួយផ្នែក ០ · រំលង ០)។ គ្មាន bump (តែ `audit-tools/` · `ZoeW/scripts/` · ឯកសារ)។

### 2026-10-08 — Deep audit ៣ (សំណើម្ចាស់គម្រោង ៖ «deep audit គ្រប់ជ្រុងជ្រោយ មុនប្រកាសឲ្យប្រើជាផ្លូវការ») ➜ [2.50.46]

**វិធី** ៖ run-all STRICT ពេញ (emulator RTDB · Postgres ពិត) មុនកែ ➜ អានកូដដោយផ្ទាល់ (លុយ · Supabase adapter + SQL · SW · Push · ZTO Function · License ·
ឯកសារ) ផ្តោតលើបញ្ជី «មិនទាន់វាស់» ក្នុង Handoff · ការប៉ាន់ទំហំទិន្នន័យ/កូតាពេលអតិថិជនច្រើន · សំណើម្ចាស់គម្រោង ៣ ក្នុងជុំដដែល។

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A49 | **Supabase ៖ CAS ចម្លើយបាត់ ➜ ផ្ញើវិញក្រោយ `zoe_ops` purge ➜ `not-applied` ខុស ➜ ledger កាត់ ២ ដង** (Handoff «`zoe_ops` > ២ ថ្ងៃ · purge») | Claude ៖ SQL ៖ `zoe_apply()` រក្សា `result` តែពេលជោគជ័យ · `conflict` មិនកត់ · `private.zoe_housekeeping()` លុប op > ២ ថ្ងៃ រៀងរាល់ ៦៤ seq របស់ហាង ➜ op ដែលលុបរួច = op ថ្មី ➜ CAS ប្រៀប `x` ចាស់នឹងតម្លៃដែលខ្លួនឯងសរសេររួច ➜ conflict · adapter (`lost` ➜ `not-applied`) · vitest adapter ពិត + server ក្លែង (op purge) ៖ ៣ ថ្ងៃ ➜ `applied` ២ · `codDollar` ៩០ (ត្រូវ ៩៥) · លក្ខខណ្ឌពិត ៖ ចម្លើយបាត់ចំពេលបណ្តាញដាច់ + App រស់ (APK ផ្ទៃខាងក្រោយ) > ២ ថ្ងៃ + ឧបករណ៍ផ្សេងក្នុងហាងសរសេរ ≥ ៦៤ ដង | `SB_OP_REPLAY_SAFE_MS` (២៤ ម៉ោង) ➜ witness ring ឬ `unknown` · តេស្តទាញរយៈរក្សាពី migration |
| A50 | **SW ទ្វារ miss ដាក់ចម្លើយ SPA fallback (HTML) ក្រោម key chunk** (Handoff «SW miss-door») | Claude ៖ `netlify.toml` `/* ➜ /index.html 200` + `scripts/serve.mjs` ធ្វើត្រាប់ដូចគ្នា ➜ chunk ឈ្មោះចាស់ក្រោយ deploy = HTML 200 · `sw-backend-chunk-test` ផ្នែក ៤ ថ្មី ៖ មុនកែ FAIL ២ (cache មាន HTML ៨៩,៥៩៣ bytes · ការផ្ទុកក្រោយ chunk មានវិញនៅទទួល HTML) | `responseFitsKey()` · ⛔ មិនប្រើ `shellDeployIsCurrent()` លើទ្វារ miss (បណ្តាញយឺត ➜ chunk មិនចូល cache ➜ បាត់ក្រៅបណ្តាញ) |
| A51 | **ចុចស្វែងរកលេខ ➜ ផ្ទាំងលោតភ្លាម** (រាយការណ៍ម្ចាស់គម្រោង ៖ «ចលនាអត់ smooth · keyboard លោតមកក៏មិនសូវរលូន») | Claude ៖ `history-window-check` (៤១៤×៨៩៦) ៖ កាតស្វែងរក ៣៥៧ ➜ ៥៩ · បញ្ជី ៤៥៤ ➜ ១៥៦ ក្នុងស៊ុមតែមួយ (គ្មាន animation) លើ APK · PWA Android · PWA iPhone · ផ្លូវអូស/ចុចរបា glide (`panelGlideFrom`) តែផ្លូវ focus មិន glide · ករណីទំព័ររមូរ (កាតនៅ -៣៨) ៖ focus ធម្មតា browser រំកិលមុន onFocus ➜ វាស់ពីការចុចពេលកាតមើលឃើញ (ផ្លូវធម្មតា) | FLIP កាត + បញ្ជី · មុនកែ FAIL ៦ ➜ ០ · ⚠️ ត្រូវសាកលើទូរស័ព្ទពិត |
| A52 | **ទំព័រស្កេន ៖ ប្រអប់ស្វែងរកនៅក្រោម ➜ keyboard គ្របលទ្ធផល** (សំណើម្ចាស់គម្រោង) | Claude ៖ ប្រអប់ y ៤៣៦ (បញ្ជីកញ្ចប់) · ៥០៣ (Locker) · keyboard ~៣៣០ ➜ ផ្ទៃលទ្ធផល ៦០–១៣០px · គ្មានការបង្រួម · iOS ៖ ផ្លូវ tap/document-scroll គ្របតែ `searchPhoneInput` | `entry-search.ts` · ផ្លូវ iOS ទូទៅ (`IOS_SEARCH_FIELDS`) · មុនកែ FAIL ៦ ➜ ០ |
| A53 | **🔔 គ្មានវិធីសួរកំណែថ្មីភ្លាម** (សំណើម្ចាស់គម្រោង) | APK ៖ `absent` ➜ សួរម្តងទៀតក្រោយ `APK_RELEASE_RECHECK_MS` (២ នាទី) តែពេលបើក 🔔 · PWA ៖ `reg.update()` តែ visibility/focus/online/៣០ នាទី (gap ១៥ នាទី) | `checkForAppUpdate()` · `checkApkRelease(v, true)` |
| A54 | **`history-window-check` keyboard ធ្លាក់ក្រោមបន្ទុក run-all** (`zoew-suite` FAIL ក្នុង run-all មុនកែ ២០០/២០២) | Claude ៖ ឯកឯង ៣/៣ PASS · ក្រោម lane ៤ ៖ `window.__kb` មាន resize តែ ១ (Chromium បញ្ចូល resize ២ ពេលស៊ុមយឺត) = artifact ការវាស់ | រង់ចាំ resize ពិត (`waitForFunction`) មុនប្តូរទំហំម្តងទៀត · ការអះអាងមិនប្រែ |
| A55 | **ហាង Firebase (Spark ១០ GB/ខែ) ៖ egress ពេលអតិថិជនមមាញឹក** (Handoff ៦ក · គ្មានកូដ) | Claude ៖ JSON តាមរូបរាងពិត (`scan-action.ts` · `cleanup.ts`) ៖ ៣០០ កញ្ចប់/ថ្ងៃ ➜ ធុងសំរាម ៣០ ថ្ងៃ ៦,៩៣០ ធាតុ ≈ ៤.៣ MB · `zoew_daily_pickup_cod_dod` ≈ ១៣ kB/ថ្ងៃ (`pickedUpBarcodes` ៩ kB) ≈ ៤.៥ MB/ឆ្នាំ មិនដែលសម្អាត · ចំណូលថ្ងៃ ≈ ១២៥ kB/ឆ្នាំ · listener `onValue` ទាញ root ទាំងមូលរាល់ការផ្ទុកទំព័រ (Web SDK គ្មាន cache disk · PTR = reload) ➜ ~៤–៩ MB/ការបើក · ១០០ កញ្ចប់/ថ្ងៃ ➜ ~១.៥–៣ MB | ម្ចាស់គម្រោងសម្រេច (Blaze + budget · Supabase សម្រាប់ហាងធំ · ឬការបង្រួម `pickedUpBarcodes` ថ្ងៃចាស់ = ការប្តូររចនាសម្ព័ន្ធ) |
| A56 | **License Project តែមួយ ៖ egress ដំណឹងអ្នកលក់** (Handoff ៦ខ) | Claude ៖ `NOTIFY_FEED_INTERVAL_MS` ៥ នាទី · `limitToLast=20` · title ≤ ១២០ + body ≤ ៦០០ តួ (ខ្មែរ ៣ bytes) ➜ ~៦–៤០ kB/ការទាញ · timer រត់ពេលលាក់ (ច្បាប់ CLAUDE.md) ➜ ឧបករណ៍បើកពេញថ្ងៃ ~២៨៨ ការទាញ ➜ ១០០ ឧបករណ៍ ≈ ៥–១០+ GB/ខែ | ពិនិត្យ Usage · Blaze + budget · (ជម្រើសកូដ ៖ ពង្រីកចន្លោះ ឬរំលងពេលលាក់ = ប្តូរច្បាប់ timer ➜ ត្រូវសំណើ) |
| A57 | **Netlify Functions ៖ ZTO Palm** (Handoff ៦គ) | Claude ៖ `ZTO_SIGNED_SWEEP_ACTIVE_MS` ២០ វិ. · `VISIBLE` ៦០ វិ. · `GAP` ២ នាទី ➜ ~១៨០/ម៉ោង (សកម្ម) · ~៦០/ម៉ោង (បើក) ➜ ~១,២០០/ថ្ងៃ/ឧបករណ៍ ZTO + `/detail` តាមការស្កេន · cache ក្នុង Function មិនកាត់ចំនួនការហៅ | ពិនិត្យកូតា Netlify មុនបន្ថែមហាង |
| A58 | **Supabase Project តែមួយ** (Handoff ៦ឃ) | Claude ៖ `zoe_write` ចាក់សោ `zoe_tenant_state` ក្នុងមួយហាង (មិនប៉ះហាងផ្សេង) · `zoe_pull` ប្រើ index `(tenant_id, seq)` · `zoe_ops` ~១៥ ការសរសេរ/កញ្ចប់ ➜ ~៤,៥០០/ថ្ងៃ (៣០០ កញ្ចប់) × ២ ថ្ងៃ · realtime ១ websocket/ឧបករណ៍ | ពិដាន realtime ព្រមគ្នា (Free ២០០ · Pro ៥០០) ជាដែនកំណត់ចំនួនឧបករណ៍បើកព្រមគ្នា |
| A59 | **Push cron · `ZTO_PROXY_KEY`** (Handoff ៦ង · ៦ច) | Claude ៖ `dispatchNotices()` ឡើង ledger មុនផ្ញើ · `PUSH_RUN_BUDGET_MS` ២០ វិ. · ១៦ ព្រមគ្នា ➜ ~១,០០០ subscription/ដំណឹង · `PUSH_SUBS_TOTAL_MAX` ៥,០០០ · `/detail` ចងតែ `ZTO_PROXY_KEY` (មិនចងអត្តសញ្ញាណ/សាខាដូច `?list=1`) | គ្មានកូដ (តំបន់ចាក់សោ ZTO ➜ ត្រូវសំណើ) |
| A60 | **run-all STRICT ពេញលើ tree 1d619b4 (emulator RTDB · Postgres ពិត) ៖ ធ្លាក់ ៥ · ជោគជ័យ ១៩៧ · មួយផ្នែក ០ · រំលង ០** (ជុំបន្ត Deep audit ៣) | Claude ៖ (១) `phone-suggest-test` · `phone-search-swipe-test` រំពឹង `phoneSearchFocused()` ហៅ `setPhoneSearchPulledUp(true)` ផ្ទាល់ (ឥឡូវតាម `glidePhoneSearchPulledUp`) ➜ ReferenceError/regex · (២) `sw-cache-failure-test` ៖ `responseFitsKey()` អាន `response.headers` ដោយគ្មាន `try` ➜ TypeError ក្នុង `.then` ➜ `.catch(() => null)` ➜ ចម្លើយបណ្តាញល្អក្លាយ `Response.error()` (impact ជំហាន ៥ ៖ helper ថ្មីលើផ្លូវក្តៅបោះ) · (៣) `clock-hygiene` ៖ `Date.now()` ក្នុង `checkForAppUpdate()` · `probeApkRelease()` គ្មានហេតុផល + ធាតុងាប់ `checkApkRelease` · (៤) `loop-termination` ៖ `while (… elapsedSince(startedAt) < NOTIFY_FEED_TIMEOUT_MS)` គ្មានព្រំដែនរចនាសម្ព័ន្ធ · ក្រោយកែ `zoew-suite` lint ៖ `no-useless-assignment` | checker ស្វែងរកលេខដើរតាមខ្សែហៅពិត (helper ដែលបញ្ជូនប៉ារ៉ាម៉ែត្រទៅ `setPhoneSearchPulledUp`) + ទិសផ្ទុយ (ដកការហៅ ➜ ធ្លាក់) · `responseFitsKey()` អាន headers មិនបាន ➜ ផ្ទុកដូចមុន (fail-open) · `APP_UPDATE_CHECK_WAIT_MAX` ជុំ · allowlist នាឡិកាមានហេតុផលពិត |
| A61 | **Supabase ៖ បង្អួច `SB_OP_REPLAY_SAFE_MS` វាស់តាមនាឡិកាឧបករណ៍** (workflow ពិនិត្យ diff 2.50.46 · អ្នកផ្ទៀងប្រឆាំង ៖ confirmed) | Claude ៖ `elapsedSince(lostAt)` ៖ នាឡិកាថយក្រោយ *មួយផ្នែក* (ឧ. NTP កែ ៣០ ម៉ោងក្នុងការដាច់ ៥០ ម៉ោង) ➜ អាន ២០ ម៉ោង ≤ ២៤ ➜ `not-applied` ខណៈ op ត្រូវ purge (server ៖ `created_at < now() - 2 days`) ➜ ledger កាត់ ២ ដង · vitest ថ្មី ៖ មុនកែ `applied` ២ | អាយុ = `res.now` (conflict) − `now` ចុងក្រោយដែលឃើញមុនផ្ញើលើកដំបូង (`serverNowSeen` ➜ `sentAfter`) ៖ ចម្លើយដែលទទួលមុនផ្ញើ = ព្រំក្រោមនៃ `created_at` (causality) ➜ គ្មាននាឡិកាឧបករណ៍ · គ្មាន `now` ឬអវិជ្ជមាន ➜ witness/`unknown` · fake `supabase-tx-outcome` ឆ្លើយ conflict មាន `now` ដូច migration ពិត |
| A62 | **🔔 «🔄 ពិនិត្យកំណែថ្មី» ✅ ពេល feed កំណែទាញមិនបាន តែដំណឹងអ្នកលក់ឆ្លើយ** (confirmed) · **⚠️ នៅជាប់ក្រោយ feed ទាញបានវិញ** (confirmed nit) | Claude ៖ `fetchNotifyFeed()` = `results[0] \|\| results[1]` ➜ License RTDB ឆ្លើយ `null` ក៏ជា «ជោគជ័យ» · ✅ «កំណែចុងក្រោយ» មកពី cache · `appUpdateCheck` `failed` គ្មានអ្នក reset · vitest ថ្មី ២ ៖ មុនកែ FAIL ២ | សេចក្តីសម្រេចពី feed កំណែតែប៉ុណ្ណោះ (`fetchNotifyFeed(true, true)`) · feed កំណែទាញបាន ➜ `failed` ➜ `idle` |
| A63 | **iPhone PWA · ទំព័រស្កេន · កាមេរ៉ាកំពុងស្កេន ៖ ការចុចប្រអប់ស្វែងរកនៅ preventDefault + `preventScroll` + ការរំកិល document ត្រឡប់ ០ ខណៈផ្ទាំងមិនបង្រួម ➜ ប្រអប់នៅក្រោម keyboard** (confirmed) | Claude ៖ កាមេរ៉ា (`--scan-box-h` ~១៩០px) រុញប្រអប់ទៅ y ~៥៦០ · ~៦៣០ (៤១៤×៨៩៦) · `entrySearchFocused()` លែងបង្រួម (30a6eb4) តែ `searchTapField()` · `restoreIOSDocumentScroll()` មិនដឹង · vitest ថ្មី ២ មុនកែ FAIL | `entrySearchMovesField()` តែមួយ ៖ focus · ការចុច iOS · ការត្រឡប់ ០ (តែពេលផ្ទាំងបង្រួម) ➜ កាមេរ៉ា + ផ្ទាំងបើក ➜ iOS ធម្មតា |
| A64 | **ទំព័រស្កេន ៖ flag «focus ជាអ្នកបង្រួម» ចាស់ · ប្រអប់ Locker លាក់មានអក្សរ ➜ បើកវិញខុស/មិនបើក** (confirmed nit ×២) | Claude ៖ flag កំណត់តែពេល focus បង្រួម មិនដែលសម្អាតពេលផ្ទាំងបើកដោយដៃ ➜ បង្រួមដោយដៃ ➜ ចាកចេញ ➜ បើកវិញ · `ENTRY_SEARCH_FIELDS.some(value)` អានប្រអប់លាក់ · តេស្តទិសផ្ទុយចាស់ PASS ដោយចៃដន្យ (flag លេចពីតេស្តមុន) · vitest ថ្មី ៣ មុនកែ FAIL | `listenEntrySearchPanel()` (store subscription ៖ ផ្ទាំងបើក ➜ flag សម្អាត · boot សម្អាត) · ពិនិត្យតែប្រអប់នៃរបៀបដែលបង្ហាញ |
| A65 | **SW ៖ ពាក់កណ្តាល revalidate នៃ `responseFitsKey()` គ្មានអ្នកយាម** (confirmed) | Claude ៖ `sw-backend-chunk-test` ផ្នែក ៤ ដើរតែទ្វារ miss · mutant ដក `responseFitsKey` ពី `revalidateShell()` រស់គ្រប់ checker | `sw-revalidation-timeout.test.ts` +២ (HTML ➜ put ០ · JS ➜ put ១) · mutant ➜ FAIL |
| A66 | **iPhone PWA ៖ FLIP ចាប់ផ្តើមមុន `focus()` ➜ ប្រអប់គូរនៅទីតាំងចាស់ពេល focus** (uncertain · តំបន់ហាម) | អ្នកផ្ទៀង ៖ លំដាប់កូដពិត (Chromium ៖ កាតនៅទីតាំងចាស់ក្រោយ `focus()`) តែការរំកិលបង្ហាញ keyboard របស់ WebKit វាស់មិនបាន | ⛔ គ្មានកូដ (`phone-search.ts` ចាក់សោ · មិនកែតាមទ្រឹស្តី WebKit) ➜ [2.50.46] សកម្មភាព ២–៣ ៖ មើលការធ្លាក់/រអិលទំព័រទាំងមូល (រោគសញ្ញា A47) · ការវាស់ Chromium របស់ Claude ២ ➜ A70 |
| A67 | **`sw-backend-chunk-test` ធ្លាក់ម្តងក្នុង run-all STRICT (95e91a0 ៖ ជោគជ័យ ២០១ · ធ្លាក់ ១) ៖ «ទិសផ្ទុយ ៖ chunk ពិតចូល cache ធម្មតា»** (ផ្នែក ៤ ថ្មីរបស់ 2.50.46) | Claude ៖ ទ្វារ miss របស់ SW ឆ្លើយទំព័រមុន `cache.put()` ចប់ (មិន await ដោយចេតនា) តែតេស្តអាន cache ភ្លាមក្រោយ `fetch` · ១២ ដងព្រមគ្នា (៦ × ២) មិនកើតឡើងវិញ ➜ ធ្វើត្រាប់ disk យឺត (put ពន្យារ ៤០០ms ក្នុងច្បាប់ចម្លង sw.js) ➜ ធ្លាក់ ៣ កន្លែង (ផ្នែក ២ ក៏ដូចគ្នា) · ការអះអាងអវិជ្ជមាន «មិនដាក់ HTML» ភ្លាមៗ អាច PASS ទទេពេល put យឺត = ការវាស់ race មិនមែនកូដ App | `cacheHasEventually()` (≤ `CACHE_PUT_SETTLE_MS`) · `cacheStaysEmpty()` (ពេញ `CACHE_PUT_GRACE_MS`) · put យឺត ➜ PASS ២៦ · put យឺត + mutant HTML ទ្វារ miss ➜ FAIL ២ · tree ពិត ➜ PASS ២៦ |
| A68 | **`ZTO_PROXY_KEY` តែមួយគ្រប់ហាង ៖ `/detail` មិនចងគណនី/សាខា** (Handoff ៦ច · A59 ➜ ម្ចាស់គម្រោង ៖ «ធ្វើ ២ ៣ ៤ ចុះ») | Claude ៖ `handleRequest()` ផ្ទៀងតែ `timingSafeEqualText(ZTO_PROXY_KEY, …)` ➜ `/detail` ឆ្លើយលេខទូរស័ព្ទ · COD ដល់អ្នកមានសោ · `?list=1` ចង ID token + សាខារួច (`resolveListIdentity()`) · App ផ្ញើ token តែ `?list=1` · `zto-proxy-test` ផ្នែក ១២ មុនកែ FAIL ១៨ · vitest មុនកែ FAIL ៥ | [2.50.47] ៖ `ZTO_PROXY_KEYS` · `ZTO_DETAIL_IDENTITY` · `ZTO_DETAIL_BRANCH_PATHS` (លំនាំដើមដដែល · ម្ចាស់គម្រោងបើកតាមជំហាន) · `resolveListIdentity()` ប្រើឡើងវិញ (គ្មានការផ្ទៀងទី ២) · ⚠️ វាលសាខា ZTO ពិតត្រូវវាស់លើ Argus |
| A69 | **run-all STRICT ពេញលើ b3c420c ([2.50.47]) ៖ ធ្លាក់ ៦ · ជោគជ័យ ១៩៦ · មួយផ្នែក ០ · រំលង ០** | Claude ៖ (១) `lookup-prefetch-test` · `lookup-freshness-test` · `lookup-failure-identity-test` · `lookup-burst-test` · `health-check-test` រត់ `attemptAutoLookup()` · `healthLookupRow()` ពិតក្នុង sandbox ដែលគ្មាន helper ថ្មី `addZtoIdentityHeader()` · `ztoAccessText()` ➜ ReferenceError ➜ catch ➜ «មិនអាចភ្ជាប់ ZTO» (FAIL ២៩ ក្នុង `health-check-test` · `lookup-burst-test` ៖ `window is not defined` ក្នុង catch) · (២) ក្រោយបន្ថែម helper ពិត ៖ `lookup-prefetch-test` FAIL ៣ ៖ សេណារីយ៉ូ «Lookup ចាស់មិនដោះសោ Lookup ថ្មី» រាប់ `__fetches` ភ្លាមក្រោយហៅ ខណៈ `fetch` ឥឡូវចេញក្រោយ `await` (សោ `autoLookupInFlight` នៅតែចាក់មុន `await` ➜ ឥរិយាបថស្ទួនមិនប្រែ) · ការអះអាង «មិនបាញ់សំណើទី ៣ ស្ទួន» ដោយគ្មានការរង់ចាំ = PASS ទទេ · (៣) `doc-scope-test` ៖ លិបិក្រម ៣ ជួរ | helper ពិតចូល sandbox (គ្មាន `fb`/`auth` ➜ `ztoIdToken()` ពិតឆ្លើយ '' · ការវាស់ token ៖ `zto-detail-identity.test.ts`) · `settleTurns()` មុនរាប់ `__fetches` (ទាំងការអះអាងវិជ្ជមាន និង «មិនបាញ់») · checker ទាំង ៦ + `checker-coverage` · `hang-guard` · `exit-code-integrity` PASS |
| A70 | **Claude ២ ៖ ផ្ទៀងឯករាជ្យ 651cb0d (session ផ្សេង · read-only · ម្ចាស់គម្រោងស្នើ)** | Claude ២ ៖ run-all STRICT ពេញ ✅ ២០២ · A60–A67 ៖ tree មុនកែ FAIL · HEAD PASS · mutant នីមួយៗ FAIL ➜ បញ្ជាក់ · រកឃើញ (១) minor ៖ mutant `if (!(age > SB_OP_REPLAY_SAFE_MS))` (conflict គ្មាន `now` ➜ `NaN` ➜ `not-applied` ➜ ledger កាត់ ២ ដង) រស់គ្រប់អ្នកយាម Supabase (vitest ១៨៧ · adapter-parity ៩២ · app-network-e2e · tx-disconnect) · (២) nit ៖ mutant `sentAfter = Date.now() + serverOffset` រស់ (នាឡិកាឧបករណ៍លោតទៅមុខមុនផ្ញើ ➜ អាយុតូចពេក ➜ `not-applied` ខុស) · (៣) A66 ក្នុង Chromium ៖ `focus()`/`scrollIntoView` តម្រង់ទីតាំងដែល**គូរ** (transform រួម) · ៤១៤×៨៩៦ ៖ គ្មានការរំកិល · ៣៧៥×៦៦៧ (keyboard ២៦០) ៖ reveal ក្នុងស៊ុមដំបូងនៃការរអិលរំកិល `#appPages` ១៨px (`searchPhoneInput`) · ៦០px (`entryListSearchInput`) រួចត្រឡប់ ០ ក្នុង ៧០០ms (ស្រដៀង A47) · WebKit វាស់មិនបាន | Claude ៖ ផ្ទៀងប្រឆាំងលើ tree ពិត ៖ (១) `supabase-op-retention` «conflict គ្មាន `now`» (ce5bc34) · (២) តេស្តថ្មី «នាឡិកាលោតទៅមុខ ៣០ ម៉ោង មុនផ្ញើ + ដាច់ ៥០ ម៉ោង» ➜ mutant នីមួយៗ FAIL ១ · កូដពិត PASS ៩/៩ · គ្មានកូដ App ប្រែ · (៣) ⛔ គ្មានកូដ (តំបន់ហាម) ➜ សាកលើ iPhone SE / ទូរស័ព្ទតូចបន្ថែម (⏳ 2.50.46) |
| A71 | **ការពិនិត្យប្រឆាំង [2.50.47] (workflow ៦ agent ៖ security · regressions · docs-tests + អ្នកផ្ទៀងម្នាក់ក្នុងមួយផ្នែក · ម្ចាស់គម្រោងបើក workflow ក្នុង session នេះ)** ៖ រកឃើញ ១៦ ➜ confirmed ១០ (major ១ · minor ៩) · refuted ៤ · ស្ទួន ២ | Claude ៖ (១) **major** ៖ សាខា Firebase មកពី `email` ក្នុង token ដែលអ្នកប្រើប្តូរបាន (`accounts:update` · sign-up បិទមិនរារាំង) ហើយគ្មានការចងគម្រោង ↔ សាខា ➜ បុគ្គលិកហាង A ប្តូរ email ទៅ `@zoew<សាខា B>.com` ➜ `/detail` ឆ្លើយលេខទូរស័ព្ទ · COD ហាង B (handler ពិត · token fixture) · ⛔ `email_verified` មិនមែនដំណោះស្រាយ (ឧបករណ៍ provision មិនផ្ទៀង email) · (២) Supabase គណនីគ្មានហាង = verified លើ `/detail` ខណៈ `?list=1` បដិសេធ · (៣) token យឺត/ផុត ➜ 401 ➜ «ចាកចេញ» + cooldown ៣០ វិ. (បំពាន «ផ្ទៀងមិនបាន ≠ ខុស») · (៤) `optional` រង់ចាំការផ្ទៀងលើរាល់សំណើ (Supabase ព្យួរ ➜ +៣ វិ. · cache ក៏ដូចគ្នា) · (៥) ប៊ូតុង 🧪 គ្មាន token ➜ 401 ពេល `require` · (៦) ឯកសារ ៖ លុប `ZTO_PROXY_KEY` ➜ Cookie Sync `--auto` ឈប់ស្ងាត់ («could not reach») · «សាក `optional` មុន `require`» មិនមានពិត (សាខាកំណត់រួចលើ `optional`) · (៧) គ្មានអ្នកយាម ៖ ការរាប់ `?diag=1` · 503 ផ្ទៀងមិនបាន/កំណត់ខុស · វាលសាខាច្រើន (mutant ៧ រស់) · refuted ៖ token ទៅ host ផ្សេង (URL កំណត់ក្រោម PIN · sweep សញ្ញាផ្ញើរួចពីមុន) · `optional`+សាខា = ការរចនា (ឯកសារត្រូវកែ ➜ (៦)) · typo env បិទ `?list=1` (លំនាំមានស្រាប់ · fail-closed) · `off` រង់ចាំ token (cache · ពិដាន ៣ វិ.) | [2.50.47] ៖ `FIREBASE_PROJECT_IDS` `projectId:សាខា` · `branch:project-unbound`/`-mismatch` · Supabase `site:no-account` · `optional` មិន await (រាប់ក្នុងធុងដែលចាប់ផ្តើម) · `ztoIdentityRefusalIsTransient()` · សារ ⚙️ តាមមូលហេតុសាខា · 🧪 ផ្ញើ token · Cookie Sync `key-rejected` · ZTO-SETUP ៤គ/៤ឃ/៦ · តេស្តថ្មីធ្លាក់មុនកែ (Function ១៤ · vitest ៤ · Sync ២) · mutant ១០ ➜ FAIL ទាំងអស់ |

- **ឯកសារ** ៖ Handoff ៖ ស្ថានភាព git (PR #304 merge · repo Public វាស់តាម API) · «នៅសល់តែ [2.50.1]» ផ្ទុយនឹងបញ្ជី ⏳ ១៥ ធាតុ ➜ កែ · «សន្សំកូតា» (ច្បាប់ក្នុង HISTORY ផ្ទុយ
  `CLAUDE.md` Runbook) ➜ យោង Runbook · `firebase-backup/README.md` ៖ repo សាធារណៈ ➜ artifact ទាញបានដោយអ្នកមានគណនី ➜ ពាក្យសម្ងាត់ចៃដន្យ ≥ ៣២ តួ · `CLAUDE.md` ៖ ច្បាប់ថ្មី ៤ (Supabase
  conflict ក្រោយបង្អួច · HTML ក្រោម key · glide ស្វែងរក · ប៊ូតុងពិនិត្យកំណែ) ក្នុងជួរដែលមានស្រាប់ (គ្មានជួរថ្មី) · ដកស្ទួន ២ ៖ តារាង Base directory
  ក្នុង «Netlify: 2 sites» (ដដែលនឹង «Accepted by design» និងជួរ 📝) ➜ យោង · «`function-surface-test.js` blocks duplicate declarations» ក្នុង Short rules (ដដែលនឹងតារាង «Rules carried by specific checkers»)។
- **ឯកសារឈប់ប្រើ** ៖ ពិនិត្យ `git ls-files` ទាំងអស់ (ឈ្មោះឯកសារ ↔ ការយោង) ➜ គ្មានឯកសារងាប់ · `src/core/runtime.ts` (`ACTION_ALLOWLIST`) អានដោយ checker ➜ រក្សា ·
  `ZoeW/docs/MIGRATION.md` ធ្វើបច្ចុប្បន្នភាពក្នុង DOCS-5 ➜ រក្សា។
- **មិនបានរកឃើញ** (អានរួច) ៖ ច្បាប់ RLS · `current_tenant_id()` (user ១ = ហាង ១) · Edge Function register/reset (កូដ ១០០ bit · CORS ចង origin) · `ApkUpdatePlugin.java` (HTTPS ·
  packageName + versionName · Android ផ្ទៀង signature ពេលដំឡើង) · license meta (display តែប៉ុណ្ណោះ) · listener ស្ទួន (`addEventListener` គ្រប់កន្លែង ➜ scope ឬ function ដដែល) · គ្មាន
  `innerHTML` ក្នុង ZoeW React · គ្មាន secret ក្នុង repo (`git grep` private key · token · `sb_secret_`)។
- **ជុំបន្ត (session ថ្មី · A60–A67)** ៖ run-all STRICT ពេញលើ tree ចុងក្រោយរបស់ session មុន (A60) ➜ workflow ពិនិត្យ diff `fe52290..HEAD` (ម្ចាស់គម្រោងបើក
  workflow ក្នុង session នេះ ៖ ៥ ផ្នែក — លុយ/Supabase · SW · UI ស្វែងរក · ពិនិត្យកំណែ · ឯកសារ/ឧបករណ៍ — រកឃើញ ១២ ➜ អ្នកផ្ទៀងប្រឆាំងម្នាក់ក្នុងមួយផ្នែក ៖ confirmed ៩ ·
  refuted ១ (កែរួចក្នុង A60) · uncertain ១ (A66) · ការរកឃើញឯកសារ ៣ ៖ guide.html ប្រយោគ 🔄 កាត់ «ចុច ➜» ចេញពីប៊ូតុង 📥 · ករណីកាមេរ៉ាមិនបានសរសេរ · announcements «APK លើ GitHub»
  បង្ហាញលើគ្រប់វេទិកា ➜ កែ) · fuzz លុយជ្រៅ `FUZZ_RUN0=300 FUZZ_RUNS=20 FUZZ_OPS=80` PASS ៣/៣ (៧ នាទី · `ledgerBlip` applied ១៥ · lost ១១)។

### 2026-10-08 — iPhone PWA ៖ ចុចស្វែងរកលេខ navbar ធ្លាក់ ហើយរអិលឡើង · iOS 26 បង្ហាញ 18.7 ➜ [2.50.45]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A47 | **iPhone PWA ៖ ចុចស្វែងរកលេខ ➜ navbar «រមូរពីក្រោមឡើងលើ»** (វីដេអូ VID_20261008_210711 · iOS 26.5 · ក្រោយ [2.50.42]) | Claude ៖ រូប ៣០ fps ៖ ស៊ុមដំបូងប្រអប់ទាញឡើងរួច (navbar នៅលើ) ➜ keyboard ចាប់ផ្តើម ➜ ទំព័រទាំងមូលធ្លាក់ ~១៩០ ➜ ១៤៧ ➜ ១០៤ ➜ ៥៥ ➜ ០ px (~២០០ms · ករណី ២ ដូចគ្នា) = ចលនា UIKit បន្ថែម (additive) ដែល model ត្រូវ `scrollTo(0, 0)` កាត់កណ្តាល · Chromium (ក្លែង iOS standalone · ៣៩០×៨៤៤) ៖ ប្រអប់មុនទាញឡើង y=៣៧០ ក្រោយ y=៩២ ➜ ដាក់ y=៣៧០ កណ្តាលផ្ទៃពីលើ keyboard (~៤៧០px) ≈ រំកិល ~១៩០ = ចំនួនក្នុងវីដេអូ ➜ iOS ប្រើទីតាំងមុនទាញឡើង · ការត្រឡប់ ០ ពេលក្រោយ = ឃើញរំកិលឡើង ហើយលោតចុះ (អាក្រក់ជាង) ➜ ត្រូវកុំឲ្យ iOS រំកិលតាំងពីដំបូង · probe Chromium ក្រោយកែ ៖ ចុច ➜ `focus({preventScroll:true})` ពេលទាញឡើងរួច · អូស/សង្កត់យូរ ➜ ផ្លូវធម្មតា · Android មិនប្រែ · ០ error · ⚠️ keyboard iOS វាស់មិនបានក្នុងបរិស្ថាននេះ · run-all STRICT (emulator) ៖ ២០១/២០២ · FAIL ១ `state-hygiene` (`searchTap` · `searchFocusRefused` គ្មានហេតុផល ➜ ACCEPTED ៖ ចំណុចប៉ះ · flag browser គ្មានទិន្នន័យអតិថិជន) ➜ checker ពាក់ព័ន្ធ ១០ PASS លើ tree ចុងក្រោយ | ទាញឡើងមុន focus ដោយ App (`focusIOSSearchWithoutScroll()`) · ⚠️ ត្រូវសាកលើ iPhone |
| A48 | **iPhone iOS 26.5 បង្ហាញ «iOS 18.7»** (រាយការណ៍ម្ចាស់គម្រោង) | Claude ៖ WebKit បញ្ជាក់ ៖ Safari លើ iOS 26 រាយ OS ក្នុង UA ជា 18_6 ដោយចេតនា (ការពារគេហទំព័រដែលប្រៀប 26 < 18 · កាត់ fingerprint) ហើយ «Version/26.0» ពិត · លេខបង្កកប្តូរ 18_6 ➜ 18_6_2 ➜ 18_7 · Chrome iOS រាយ OS ពិត · `deviceFromUserAgent()` អានតែ `OS (\d+)_(\d+)` ➜ 18.7 · UA App លើ Home Screen អាចគ្មាន `Version/` ➜ ពិនិត្យលក្ខណៈ engine Safari 26 (anchor positioning · scroll-driven animation មិនមានក្នុង Safari 18) · iOS 18.7 ពិតមាន (ឧបករណ៍ដែល iOS 26 មិនគាំទ្រ) ➜ OS 18_7 តែឯងមិនអាចសន្និដ្ឋានថាបង្កក | `Version/` ≥ 26 ➜ លេខពិត · បង្កក + engine 26 ➜ «iOS 26+» |

### 2026-10-08 — ស្គាល់ model · serial ទូរស័ព្ទ ➜ [2.50.44]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A46 | **ស្គាល់ model · serial ទូរស័ព្ទ** (សំណើម្ចាស់គម្រោង · ការសម្រេច ៖ ☰ · 🩺 + ZoeKeyGen · Android ID / ID App) | Claude ៖ serial ពិតរបស់ hardware ៖ Android 10+ `Build.getSerial()` ត្រូវ `READ_PRIVILEGED_PHONE_STATE` (App ប្រព័ន្ធតែប៉ុណ្ណោះ) · browser គ្មាន API · Chrome Android UA ត្រូវកាត់ (`Android 10; K`) ➜ model តែតាម `getHighEntropyValues(['model'])` · License ៖ `checkLocalStatus()` ហៅ `checkOnline(…, { claimSeat: true })` រាល់ការពិនិត្យ ➜ meta ដើរតាមផ្លូវនោះបានដោយមិនបំពាន «`checkOnline()` គ្មាន `claimSeat` មិនសរសេរ» · rules `$slot/$other: false` បដិសេធ meta (emulator ៖ 401) · `keylist-consistency-test` មានអ្នកយាម «លេខសម្គាល់កៅអីពេញមិនដល់ DOM» ➜ serial PWA = SHA-256 មិនមែន ID · `native:check` ជុំ ១ ៖ `info` ២ ដង (License stub គ្មាន `setDeviceMeta` ➜ សួរម្តងទៀតរាល់ពេល) ➜ សាកម្តងទៀតតែពេល License មិនទាន់ផ្ទុក ឬគ្មាន serial · **ការផ្ទៀងផលប៉ះពាល់** ៖ run-all STRICT លើ 2.50.44 ៖ FAIL ៤ ➜ `periodic-network-guard-test` (`ensureAppActivated` ពិតហៅ `loadDeviceInfo` ➜ ReferenceError ក្នុង sandbox ➜ ដកការហៅចេញពីផ្លូវ Activation ព្រោះ `license-verify.js` ជា script ធម្មតាមុន module ➜ boot ឃើញវាជានិច្ច) · `function-surface-test` (`cleanText` ស្ទួននឹង `notifications.ts` ➜ `cleanDeviceText`) · `doc-scope-test` (ប្រយោគ «៩ ជួរ» ក្នុង `ZoeW/README.md` ត្រូវបំបែក ➜ ជាន់អប្បបរមា ៣ ឯកសារ) · `css-classes` (`.device-info-name` · `.device-info-serial` គ្មាន rule) · ការអាន ៖ meta PUT អាចយកកន្លែងទី ២ នៃ `NET_MAX_IN_FLIGHT` ➜ សរសេរតែពេលគ្មានសំណើ License ផ្សេង · `NotifyDrawer` ទាំងមូលជាវ `apkUpdate` ➜ ផ្លាស់ទៅ `ApkUpdateBlock` | plugin `ZoeDevice` · `loadDeviceInfo()` · `setDeviceMeta()`/`noteSeatMeta()` · rules `meta` · ZoeKeyGen បន្ទាត់កៅអី · ⚠️ Publish rules License |

### 2026-10-08 — APK ៖ ទាញក្នុង App · ប៊ូតុងតែពេល Release ពិតមាន ➜ [2.50.43]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A45 | **APK ៖ link ក្រៅ App គ្មានផ្ទាំងដំឡើង · ប៊ូតុងមុន Release ➜ 404** (សំណើ · រាយការណ៍ម្ចាស់គម្រោង · Release 2.50.41 លុបដោយម្ចាស់គម្រោង) | Claude ៖ `curl -I` ពិត ៖ `zoew-android-v2.50.42/ZoeW-2.50.42.apk` ➜ 302 ទៅ `objects.githubusercontent.com` · `2.50.41` · `9.9.9` ➜ 404 · HEAD តាម redirect ➜ 401 (URL ចុះហត្ថលេខាសម្រាប់ GET) ➜ probe មិនតាម redirect · GET ➜ 200 `application/vnd.android.package-archive` ៨៥៨៩៧៤៧ bytes · គ្មាន Android SDK (dl.google.com បិទក្នុងបរិស្ថាននេះ) ➜ `javac` + Robolectric `android-all` 14 (Maven Central) + `JSObject` · `PluginCall` · annotation ពិតរបស់ Capacitor + stub `Plugin` · androidx តាម signature ពិត ➜ 0 error · harness JVM ហៅ `probe()` ពិត ➜ 302 / 404 / 404 · `bad-version` ➜ គ្មាន request · run-all STRICT ជុំ ១ ៖ FAIL ៤ ➜ `state-hygiene` (`pluginLoad` · `updateSeq` គ្មានហេតុផល) · `clock-hygiene` (`Date.now()` គ្មានហេតុផល) · `doc-scope-test` (`setInterval` ទី ៨ ➜ ការពារឈប់រីកដែលរាប់ពេល App នៅខាងក្រោយ ➜ បោះបង់ខុសពេលអ្នកប្រើចេញទៅ App ផ្សេង) · តេស្តរង់ចាំ dynamic import ខ្លីពេកពេល suite រត់ព្រមគ្នា (ការវាស់) | plugin `ZoeApkUpdate` · ពិនិត្យ Release មុនប៊ូតុង · ឈប់រីករាប់តែពេល App នៅលើអេក្រង់ (`setTimeout` · `documentIsHidden()`) · ⚠️ download/install វាស់បានតែលើទូរស័ព្ទពិត |

### 2026-10-08 — iPhone PWA ៖ ស្វែងរកលេខលោតទំព័រ ➜ [2.50.42]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A44 | **iPhone PWA ៖ ស្វែងរកលេខ ➜ «⋯» ➜ ស្វែងរក ➜ ទំព័រលោត** (វីដេអូ IMG_1101) | Claude ៖ រូប ១០ fps ៖ ស្វែងរក (ទាញឡើង · keyboard) ➜ ចុច «⋯» ➜ keyboard បិទ · ផ្ទាំងចុះ ➜ ម៉ឺនុយបើក (ចុចលើកទី ២) ➜ ម៉ឺនុយបិទ ➜ ស្វែងរក focus ➜ ទំព័រលោតឡើង ~៣០០px ហើយនៅជាប់ · ករណីមួយទៀត ៖ ស្វែងរកធម្មតា ➜ លោតចុះ · Chromium (touch ៣៩០×៨៤៤) ៖ ស្ថានភាព App (`search-focus` · `scrollY` ០ · `#appPages` ០ · ទីតាំងប្រអប់ ៩២) ដូចគ្នាបេះបិទរវាងការចុចធម្មតា និងក្រោយ «⋯» ➜ មូលហេតុនៅ iOS · កូដ ៖ `scrollWindowToTop()` តែលើ `visualViewport` `resize` | ត្រឡប់ document ទៅ ០ លើ `scroll` ខណៈស្វែងរកទាញឡើង (iOS standalone) · ⚠️ ត្រូវសាកលើ iPhone |

### 2026-10-08 — Password manager · Private Key ចម្លង ➜ [2.50.41]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A43 | **Password manager · Private Key ចម្លង** (សំណើម្ចាស់គម្រោង) | Claude ៖ `layout-check` ZoeKeyGen មុនកែ ៖ Private Key = `TEXTAREA` · `sbAdminPasswordInput` មិននៅក្នុង form · គ្មាន `name` · `LoginModal` ZoeW មុនកែ ៖ autocomplete ត្រឹមត្រូវ តែគ្មាន `name` · `license-verify.js` ពិតក្នុង Node WebCrypto ៖ `generateKeyPair()` ➜ `JSON.stringify` ➜ `JSON.parse` ➜ `signNewKey` ➜ `verifyKeyString` = `{valid:false, reason:'signature'}` (មិនផ្គូផ្គង Public Key ដែល ship) · normalizer មុនកែ FAIL ១១ (smart quotes · ZWSP · អត្ថបទជុំវិញ ➜ «មិនត្រឹមត្រូវ» + Sentry) | form + username លាក់ + `name` · normalizer · សារ Deploy |

### 2026-10-08 — ក្រយៅដៃ web លើ Android ➜ [2.50.40]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A42 | **Android PWA ៖ ក្រយៅដៃ «មិនគាំទ្រ PRF» ក្លែងក្លាយ** (រូបពីម្ចាស់គម្រោង) | Claude ៖ ប្រៀបធៀប ZoeW ↔ ZoeKeyGen ៖ ZoeKeyGen `residentKey: 'required'` + PRF ពី `create()` + `prf: {}` ➜ `get()` (កែរួច) · ZoeW `residentKey: 'discouraged'` + ទាមទារ `prf.enabled` + ចាប់ការបោះបង់ជា «មិនគាំទ្រ» · WebAuthn ក្លែងតាម Android ➜ មុនកែ FAIL ៥/៦ | ផ្ទេរការកែរបស់ ZoeKeyGen · function PRF ៣ ដូចគ្នាបេះបិទ |

### 2026-10-08 — សំណើម្ចាស់គម្រោង ៖ 🔔 ក្រុមពន្លា ➜ [2.50.39]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A41 | **🔔 ក្រុមពន្លា** (សំណើម្ចាស់គម្រោង) · «ថ្មី» 📤 លើស ៦០ ជួរ | Claude ៖ `notifications.ts` ពិត ៖ ធាតុធុងសំរាម `expired` ៧០ ➜ `markNotifyRemovedSeen()` ៣ ដង ➜ `unseen` ១០ · ១០ · ១០ (រាប់តែ ៦០ ជួរដែលបង្ហាញ ➜ លេខក្រហមជាប់រហូត) · `layout-check` មុនកែ ៖ គ្មានក្បាលក្រុម · ៥០ ជួរគូរភ្លាមពេលបើក | `DrawerGroup` រួម + `lazy` · ទំព័រ ២០ លើគ្រប់ជួរ · «ថ្មី» រាប់តែពេលក្រុមពន្លា |

- ការវាស់ «រមូរដល់ចុង» ដំបូង (`scrollTop = scrollHeight`) លោតហួស sentinel ក្នុងស៊ុមតែមួយ (sentinel ពី ១៤៤៩ ➜ −៣៣៨ px) ➜ IntersectionObserver មិនឃើញការប្រសព្វ ➜ artifact ការវាស់ (អ្នកប្រើរមូរជាបន្តបន្ទាប់ + ប៊ូតុង «បង្ហាញ … ទៀត») ➜ `scrollIntoView` sentinel។
- ស្លាក «ថ្មី N» នៅក្បាល ៖ ៣២០px ➜ ឈ្មោះក្រុមនៅសល់ ២៦% នៃក្បាល (`gap` ១០px របស់ ☰) ➜ `gap: 6px` តែក្នុង 🔔 (`.notify-group > .drawer-group-head`) ➜ ≥ ៣០%។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ០ (ឯកសារ · គ្មាន bump)

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A35 | **DOCS-1** Handoff និយាយ «មិនទាន់ merge» ខុស | Claude ៖ `git merge-base --is-ancestor 8e83fc9 origin/main` ➜ 2.50.13 នៅក្នុង `main` (PR #296 ចូលតាម PR #297) · Handoff ចែង `main` = 2.50.4 · PR #292 · #295 «មិនទាន់ merge» ខណៈ `main` = 2.50.25 | សរសេរ Handoff ឡើងវិញពី git · ⛔ គ្មានអ្នកយាមពឹង git (ស្ថានភាព merge ប្រែរាល់ PR · ច្បាប់ ៥ ៖ git ជាភស្តុតាង) |
| A36 | **DOCS-2** លិបិក្រម 🔎 | generator (regex ដូច `doc-scope-test`) ➜ ៤០/២០១ ជួរខុសផ្នែក · អ្នកយាម vitest ១០៣ ដែលឯកសារយោង គ្មានជួរ | regenerate · `doc-scope-test` ៖ ជួរនីមួយៗ = ផ្នែកដែលឈ្មោះលេចពិត (ទិសទាំងពីរ · checker + vitest · មុនកែ FAIL ១៤៣) |
| A37 | **DOCS-4** បញ្ជី README (ច្បាប់ ៩) · «Other dirs» | `CLAUDE.md` ខ្វះ README ៤ · `tools/` ៣ · workflow ២ · `ZOE_RUNNER_MODE` · `docs/SELF-HOSTED-RUNNERS.md` គ្មានអ្នកស្កេន (root `docs/` លើកលែងទាំងមូល) | បញ្ជីពេញ · `doc-scope-test` ស្កេន root `docs/` លើកលែងតែឯកសារប្រវត្តិ ២ |
| A38 | **DOCS-5** `ZoeW/docs/MIGRATION.md` | ជំហាន ២ «ដូចមុន» · ការថយក្រោយ «build `ZoeW/` static ចាស់» · «App ថ្មីមិនបន្ថែម path rules» (ខុស ៖ `origins` · `zoew_settings/zto_signed_sweep` · `ops`) | កែតាមការពិត (Publish deploy មុន · ច្បាប់ ១០) |
| A39 | **DOCS-6** ច្បាប់ `planPickupLedgerRepair()` | `CLAUDE.md` ៖ `bucket.total === recordedPackages` ➜ គ្មានក្នុងកូដ · កូដ ៖ `pickupSetSize(set) === recorded` + ពិនិត្យម្តងទៀតលើតម្លៃ server ក្នុង transaction | កែច្បាប់ |

- លិបិក្រមត្រូវ regenerate **ចុងក្រោយ** ក្នុងជុំណាដែលបន្ថែមអត្ថបទប្រវត្តិ (ឈ្មោះ checker/vitest ថ្មីក្នុងផ្នែកថ្មី ➜ `doc-scope-test` ក្រហមរហូតដល់ជួរត្រូវ)។

### 2026-10-08 — Deep audit ២ ៖ ជុំ ១៥ (UI · NATIVE) ➜ [2.50.34]–[2.50.38]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A31 | **UI-1** scanner ដៃបាត់ focus ក្រោយ Escape | Claude ៖ React ពិត (jsdom) ៖ focus ក្នុង `#exchangeRateInput` ➜ `closeModal()` ➜ `activeElement` នៅ `exchangeRateInput` (browser ពិត ៖ ធ្លាក់ទៅ `body` នៅការគូរបន្ទាប់) | មិនអើពើប្រអប់អក្សរក្នុង `.modal` ពេលគ្មានប្រអប់បើក |
| A32 | **UI-2** ប្រអប់ចូលនៅក្រោម ☰ | Claude ៖ React ពិត ៖ ☰ បើក ➜ `showLoginModalWithPrefill()` ➜ `#sideDrawer.open` នៅ | `drawerOpen = false` ក្នុង `clearSensitiveModalFields()` |
| A33 | **UI-3 · UI-4 · UI-5/6 · UI-7** | Claude ៖ browser ពិត (`layout-check`) ៖ banner បាត ៩០០ គ្របរបា Tab · បញ្ជី ZTO គូរ ២០០/២០០ ពេលបើក · ព័ត៌មានជួរ 🔔 ទទឹង ០px (៣២០) / ៤៥px (៤១២) + «…» · Enter ក្នុងវាល PIN ➜ `__pinOk = 0` · cursor មិននៅវាល PIN | CSS `react-root.css` · root `.modal-content` · `<form onSubmit>` + focus កុំព្យូទ័រ |
| A34 | **NATIVE-1 · 3 · 7 · 8** (+ NATIVE-4 វាស់) | Claude ៖ React/jsdom ៖ pause/resume ក្នុង getUserMedia/requestPermissions ➜ `appIsLocked` · Back លើប្រអប់ចូល ➜ `minimize` ០ ដង · Chromium ៖ ប្តូរកម្ពស់ 880 ➜ 560 ➜ `UpdateLayoutTree` ៧៥៩/២៦០៨ ធាតុ (`@property` ➜ ៨) · fake bridge safe-area ខាងក្រោម ៤៨px ➜ NavigationBar LIGHT ពេលប្រអប់បើក | excuse មុនប្រអប់ · `ROOT_SCREEN_MODALS` · `@property --fs-unit` · `appliedNav` |
| A40 | **សំណើម្ចាស់គម្រោង** ៖ link APK · 🔔 ធំលើកុំព្យូទ័រ | Claude ៖ GitHub ៖ repo public · Release `zoew-android-v2.50.25` · `ZoeW-<កំណែ>.apk` (workflow) · `layout-check` ៖ 🔔 ១២៨០px = ៣២០ | `apkDownloadUrl()` + link តែ APK · `max-width: 400px` ≥ 992px |

### 2026-10-08 — Deep audit ២ ៖ ជុំ ១៤ (SCALE-2..7) ➜ [2.50.30]–[2.50.33]

| # | ចំណុច | ការវាស់ | លទ្ធផល |
|---|---|---|---|
| A26 | **SCALE-2** ការសម្អាតច្រើនរយកញ្ចប់រារាំង main thread | Claude ៖ `cleanup.ts` ពិត + SDK ក្លែង ៖ ៣០០ ripe ➜ `runScheduledCleanup()` ចាប់ផ្តើម ២០០ (ពិដាន journal) ក្នុងការហៅ synchronous តែមួយ · FAIL ២/៤ | batch ៨ + yield ៥០ms + ជុំដើរគ្រប់ (`cleanupSweepVisited`) |
| A27 | **SCALE-3** `notify()` Supabase serialize គ្រប់ root រាល់ការហៅ | Claude ៖ adapter ពិត + transport ក្លែង (getter រាប់ការអាន) ៖ poll ទទេ ២ ដង ➜ អាន root ធំ ១២០ · pull ប្រែតែ root តូច ➜ ៦០ · ការសរសេរ root តូច ➜ ១២០ · FAIL ៣/៦ | dirty roots សម្គាល់នៅកន្លែងប្រែ · listener មិនទាន់ fire ➜ fire ជានិច្ច |
| A28 | **SCALE-6** flush registry O(key × barcode) | Claude ៖ `registry.ts` ពិត ៖ key ២០០ (គ្មានម្ចាស់ ១៥០) លើប្រវត្តិ ៣០០ + ធុងសំរាម ១៥០០ ➜ អាន `barcodes` ១,១៧៤,៥០០ ដង (≈ ៣២៦ ដងនៃការដើរម្តង) | សំណុំ key មានម្ចាស់ម្តងក្នុងមួយ flush |
| A29 | **SCALE-7** `Intl.DateTimeFormat` ថ្មីរាល់ការហៅ | Claude ៖ `appZoneParts()` ៥០០ ដង ➜ បង្កើត ៥០០ | formatter លើ function (key តាម constructor) |
| A30 | **SCALE-4** ធុងសំរាម ៣០ ថ្ងៃ (fixture ៨៥០០) | Claude ៖ function ពិតដែលដើរធុងសំរាម ២០០០ ➜ ៨៥០០ ធាតុ (២ barcode/ធាតុ) ៖ `buildTrashGroups` ១៣ ➜ ៤១ms · `planPickupLedgerRepair` ៧ ➜ ២៥ms · `removedParcelsView` ២ ➜ ៤ms · `uncollectedValueByDate` ២ ➜ ៧ms · `rawSnapshotToItemList` ១ ➜ ៤ms · `isBarcodeAlreadyUsed` ២ ➜ ៣ms · `refreshNotifyView` · `runAutomaticCleanupRules` ≤ ៣ms ➜ លីនេអ៊ែរទាំងអស់ · ផ្លូវ O(N²) តែមួយគត់ = flush registry (A28) | ⛔ មិនកែកូដ (Set index ថ្មីនឹងត្រូវ invalidate តាម `unshift`/`splice` ៥ កន្លែង ➜ ហានិភ័យលើសតម្លៃ) |

- ការរចនាដំបូង (cursor តាមលិបិក្រមរង្វិល) ➜ កញ្ចប់ ២០ ដែលបរាជ័យភ្លាមនៅសល់ ➜ ការហៅនីមួយៗចាប់ផ្តើម ៨ ក្នុងចំណោម ២០ ម្តងទៀត ➜ ជុំមិនដែលចប់ (timer បន្តរហូត · FAIL ១) ហើយលិបិក្រមរំកិលពេលបញ្ជីរួញ ➜
  ប្តូរទៅ Set នៃ id ដែលបានមើលក្នុងជុំ ៖ ជុំចប់ពេលគ្រប់ id ត្រូវមើល · ជុំក្រោយ (កេះថ្មី) ព្យាយាមកញ្ចប់បរាជ័យម្តងទៀត។
- ការហៅដោយគ្មាន limit (checker ចាស់ ១០+) មិនប៉ះ state ថ្មី (`cleanupSweepVisited` អានតែពេលមាន limit) ➜ sandbox មិនត្រូវប្តូរ (លើកលែង `connection-recovery-test` ៖ ថេរ `CLEANUP_SWEEP_BATCH`)។
- ⛔ ការស៊ើបអង្កេតមិនប៉ះ probe liveness (`probeDatabaseLiveness()`) ទេ។
- run-all STRICT ជុំ ១៤ ៖ ២០១/២០២ ៖ `money-reality` ៖ `audit-tools/money-core.js` ចាស់ — `appZoneParts()` (SCALE-7) ជាផ្នែកនៃកូដលុយ ➜ `npm --prefix ZoeW run money:core` ·
  មេរៀន ៖ កូដម៉ោង/ថ្ងៃក៏ជាកូដលុយ ➜ regenerate money-core រាល់ពេលប៉ះ `timezone.ts`។
- ops (ពី MONEY-4) ៖ ring `ops` (≤ `LEDGER_OP_RING_MAX` token) បន្ថែម ~២៥០ byte ក្នុង record ថ្ងៃ/ខែ ➜ Firebase `onValue` លើ root ផ្ញើតែ child ដែលប្រែ (delta) ·
  Supabase pull ផ្ញើតែ doc ដែលប្រែ ➜ egress បន្ថែមក្នុងមួយការសរសេរ ledger ≈ record មួយ · ⛔ មិនវាស់ live (គ្មានទិន្នន័យអតិថិជន) ➜ «មិនទាន់វាស់» ក្នុង Handoff។
- SCALE-2 ក្រោយ push ៖ `emu/crud-rules-flow` (ការពិនិត្យ dependency ឋិតិវន្តរបស់ sandbox) ចាប់ `dataState` · `scheduleCleanupSweepContinuation` ➜ stub (ការហៅគ្មាន limit មិនអានវា) ·
  មេរៀន ៖ ផ្ទៀងផ្ទាត់ checker sandbox ទាំងអស់ដែលស្រង់ function ដែលប្រែ មុន push (មិនមែនតែ checker ដែលរត់វា)។
- UI-7 ៖ ការវាស់ Enter ក្នុង `app-lock-test` ក្រុម ២១ មិនបាន ៖ អន្ទាក់ harness ដែលបានកត់ (Chromium headless ឈប់បញ្ជូន input ពិតក្រោយវដ្តចាកចេញ/ត្រឡប់ ៖ `page.press` ត្រឡប់ជោគជ័យ
  តែតម្លៃនៅក្នុងវាល · probe ទំព័រស្រស់ ➜ Enter ដើរ) ➜ ការវាស់ផ្លាស់ទៅ `layout-check` ទំព័រស្រស់។
- SCALE-3 ៖ mutation ដំបូង ៤ រស់ (scope · stage swap · reset · listener មិនទាន់ fire) ➜ test scope ដំបូងមិនចូលស្ថានភាពពិត (ការសរសេរត្រូវបដិសេធមុនផ្ញើ ព្រោះ scope ប្តូរមុន rpc) ➜ រង់ចាំឲ្យ
  ការសរសេរនៅក្នុង rpc សិន · បន្ថែម test reset កណ្តាលសម័យ · listener ក្រោយ permission_denied · tenant ប្តូរ (notify ខណៈ pull ពេញរង់ចាំ) · ការសម្គាល់ក្នុង `resetForSignOut()` ស្ទួន (listener ត្រូវ reset `fired`
  ហើយ pull `since = 0` តែងជា reset ➜ stage swap) ➜ រួមក្នុង `clearServerView()` តែមួយ។

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
| D6 | «All 8 ZoeW `setInterval` timers» | `scope.every(` ក្នុង `boot.ts` និង Sign outbox | ៨ ✓ |
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
  - **អ្នកយាម** ៖ `zto-list-sync-test` ផ្នែក ៥ក — តម្លៃដូចគ្នា (`'0'` · `'000'` · `''` · `'0-0'` · `' 0 '` · `'00 000 000'` · `'+855-0'` · `'081000403'` · `'855960007345'`) ឆ្លង handler ពិតតាម `?list=1` និង `/detail` ➜ phone ស្មើគ្នា (ជាន់អប្បបរមា ៖ វាស់ពិតគ្រប់តម្លៃ) · placeholder + COD ➜ `found:true` phone ទទេ · placeholder គ្មាន COD/DOD ➜ `found:false` · ទិសផ្ទុយ ៖ លេខពិតគ្មាន COD/DOD ➜ ឆ្លងកាត់។ `ZoeW/tests/zto-placeholder-phone.test.tsx` — handler ពិតនៅពីក្រោយ `fetch` របស់ App + `triggerScanAction`/`attemptAutoLookup`/`confirmPhone`/`addOrUpdateEntry` ពិត · Firebase SDK ក្លែងក្នុងអង្គចងចាំ ➜ ២ ជួរ «គ្មានលេខ» · ទិសផ្ទុយ ៖ លេខពិតដូចគ្នា ២ ដង ➜ ១ ជួរ count ២។
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

## 🔎 លិបិក្រម — ឈ្មោះ checker ➜ ការពន្យល់រស់នៅឯណា

> ⛔ **តារាងនេះដេរីវេពីការលេចពិត** នៃឈ្មោះ checker (`audit-tools/**/*.js`) និងអ្នកយាម vitest (`ZoeW/tests/**/*.test.ts(x)`) ក្នុងឯកសារទាំង ២ (`doc-scope-test` វាស់ទិសទាំងពីរ) — មិនមែនសរសេរដោយដៃ។
> ផ្លូវធម្មតា ៖ checker ធ្លាក់ ➜ រកឈ្មោះវាត្រង់នេះ ➜ `grep -n "<ឈ្មោះ>" docs/HISTORY.md docs/HISTORY-ARCHIVE.md`។

| Checker | HISTORY.md | HISTORY-ARCHIVE.md |
|---|---|---|
| `action-binding-test` | — | ផ្នែក ១ · ផ្នែក ៧ |
| `adaptive-link-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ |
| `animation-cost` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `app-lock-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៨ |
| `auth-recovery-test` | — | ផ្នែក ៣ · ផ្នែក ៦ |
| `barcode-shape-test` | — | ផ្នែក ២ |
| `biometric-unlock-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៨ |
| `boot-animation-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៨ |
| `boot-runtime` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `camera-resume-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `checker-coverage` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `cleanup-clock-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៨ |
| `cleanup-interrupt-atomicity-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `clear-history-claim-test` | ផ្នែក ២ | ផ្នែក ៨ |
| `clear-history-finalization-fence-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `clock-basis-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `clock-hygiene` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៧ · ផ្នែក ៨ |
| `code-duplication-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៨ |
| `collected-mirror-fuzz-test` | — | ផ្នែក ១ |
| `collected-mirror-lifecycle-test` | ផ្នែក ២ | ផ្នែក ១ |
| `collected-value-fuzz-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `comments` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `compensation-order` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `concurrent-scan-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៨ |
| `connection-recovery-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `connection-state-fuzz-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៧ |
| `csp-enforced-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៨ |
| `csp-lazy-resource-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៨ |
| `css-classes` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `css-media-override` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `css-var-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `daily-collected-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៧ · ផ្នែក ៨ |
| `db-stall-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `dependency-security-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៨ |
| `doc-scope-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `dom-hygiene` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ · ផ្នែក ៨ |
| `duplicate-money-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `duplicate-scan-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `empty-state-truth-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/app-network-e2e-test` | ផ្នែក ២ | ផ្នែក ៧ · ផ្នែក ៨ |
| `emu/app-writes-rules-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `emu/crud-rules-flow` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ · ផ្នែក ៨ |
| `emu/ledger-revert-emu-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `emu/license-seat-rules-test` | — | ផ្នែក ១ · ផ្នែក ៥ · ផ្នែក ៧ · ផ្នែក ៨ |
| `emu/money-multidevice-emu-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `emu/ns` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/restore-deadlock-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `emu/restore-mutation-emu-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៥ |
| `emu/supabase-rules-parity-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `emu/tx-disconnect-emu-test` | ផ្នែក ២ | ផ្នែក ៦ · ផ្នែក ៧ |
| `exit-code-integrity` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `export-cells-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៨ |
| `field-shape-test` | — | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៧ |
| `firebase-backup-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `firebase-config-paste-test` | — | ផ្នែក ៣ · ផ្នែក ៧ |
| `firebase-provision-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `fluid-type-focus-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ · ផ្នែក ៨ |
| `function-surface-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៨ |
| `gesture-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `google-sheets-cache-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `hang-guard` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `health-check-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៧ · ផ្នែក ៨ |
| `history-menu-dismiss-test` | — | ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៨ |
| `history-patch-retry-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `html-sink-escaping` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `idtoken-fixture` | — | ផ្នែក ៧ · ផ្នែក ៨ |
| `inline-handler-xss-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `ios-panel-glide-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `item-money-integrity-test` | ផ្នែក ២ | ផ្នែក ១ |
| `keygen-biometric-test` | — | ផ្នែក ៧ · ផ្នែក ៨ |
| `keygen-modal-scroll-test` | ផ្នែក ១ | — |
| `keygen-notice-test` | — | ផ្នែក ៧ · ផ្នែក ៨ |
| `keygen-pin-flow-test` | — | ផ្នែក ៧ |
| `keygen-session-security-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៧ · ផ្នែក ៨ |
| `keygen-supabase-admin-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ · ផ្នែក ៨ |
| `keylist-consistency-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៨ |
| `khmer-timezone-test` | — | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៨ |
| `late-commit-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `layout-check` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `layout-thrash` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `ledger-clamp-symmetry-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `ledger-count-integrity-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `ledger-failed-apply-revert-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `license-app-code-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `license-clock-rollback-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៨ |
| `license-clock-trust-test` | — | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៧ |
| `license-grace-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `license-network-pressure-test` | — | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `license-record-race-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ |
| `license-seat-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៥ · ផ្នែក ៧ · ផ្នែក ៨ |
| `listener-leak-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `listener-pending-key-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `locker-claim-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `lookup-burst-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-config-secret-test` | ផ្នែក ២ | ផ្នែក ១ |
| `lookup-failure-identity-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `lookup-freshness-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `lookup-prefetch-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ · ផ្នែក ៨ |
| `loop-termination-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `modal-keyboard-device-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `modal-keyboard-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `money-cookie-blob` | ផ្នែក ២ | — |
| `money-core` | ផ្នែក ២ | ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `money-guardian-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `money-multidevice-core` | ផ្នែក ២ | — |
| `money-reality-check` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `money-reality-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៧ · ផ្នែក ៨ |
| `monotonic-gate-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៧ |
| `monthly-ledger-agreement-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `monthly-report-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `netlify-config-scope-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៧ |
| `network-pressure-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `network-timeout-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `offline-shell-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `page-nav-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៨ |
| `panel-motion-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `panel-snap-ownership-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៨ |
| `partial-pickup-cleanup-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៨ |
| `payload-schema` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៨ |
| `perf-check` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ · ផ្នែក ៨ |
| `periodic-network-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `phone-search-swipe-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៨ |
| `phone-suggest-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៨ |
| `pickup-barcode-identity-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `pickup-ledger-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pickup-repair-test` | — | ផ្នែក ១ · ផ្នែក ៣ |
| `pickup-reset-test` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pin-prompt-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៨ |
| `policy-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៨ |
| `price-edit-abort-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៦ |
| `raw-read-shape-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `react-view` | ផ្នែក ២ | ផ្នែក ៦ · ផ្នែក ៨ |
| `reconnect-ladder-test` | — | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `redact-dump` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៨ |
| `registry-orphan-list` | — | ផ្នែក ១ · ផ្នែក ៧ |
| `registry-orphan-list-test` | — | ផ្នែក ១ · ផ្នែក ៧ |
| `registry-release-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៨ |
| `repository-contract-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `repository-file-coverage` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `restore-finalization-fence-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `restore-marker-hygiene-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `restore-race-test` | — | ផ្នែក ៨ |
| `returned-trash-retention-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៨ |
| `revenue-fuzz-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៨ |
| `revenue-rules-clamp-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `rules-duplicate-keys` | — | ផ្នែក ៣ · ផ្នែក ៧ |
| `runall-runner-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `scan-engine-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៨ |
| `scan-remove-mode-test` | — | ផ្នែក ១ |
| `sdk-offline-boot-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៨ |
| `sdk-surface` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `secret-hygiene` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `security-guard-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `semantic-ui-color-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `sentry-load-race-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `setup-link-browser-test` | — | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៧ |
| `setup-link-logout-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ · ផ្នែក ៨ |
| `setup-link-roundtrip-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `shared-fns` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ · ផ្នែក ៨ |
| `sheet-import-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `slow-write-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stale-clear-claim-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `stale-write` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stall-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `stall-lock-release-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `state-hygiene` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `stats-collected-truth-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `stats-measurable-gate-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `stats-screen-agreement-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `storage-blocked-boot-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `storage-guard` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `strip-comments` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៦ · ផ្នែក ៨ |
| `supabase-app-network-e2e-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `supabase-data-tools-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `supabase-datastore-test` | ផ្នែក ២ | ផ្នែក ៧ · ផ្នែក ៨ |
| `supabase-docs-cache-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `supabase-fake-server` | ផ្នែក ២ | ផ្នែក ៧ |
| `supabase-functions-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `supabase-money-multishop-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `supabase-pg` | — | ផ្នែក ៧ |
| `supabase-rls-test` | ផ្នែក ២ | ផ្នែក ៧ · ផ្នែក ៨ |
| `sw-abort-propagation-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `sw-backend-chunk-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `sw-cache-failure-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៨ |
| `sw-cache-key-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-client-wiring-test` | — | ផ្នែក ៧ |
| `sw-install-integrity-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `sw-revalidate-pressure-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-shell-latency-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `toast-action-truth-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៨ |
| `toast-truth-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `trash-modal-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `ts-comments` | — | ផ្នែក ៦ |
| `tx-outcome-test` | ផ្នែក ២ | ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `ui-flow-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `user-guide-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៨ |
| `version-bump-scope` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `version-check` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `wiring` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `write-stall-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ · ផ្នែក ៨ |
| `zoew-suite-test` | ផ្នែក ២ | ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `zto-budget-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៧ |
| `zto-cookie-capture-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `zto-cookie-session-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ |
| `zto-cookie-store-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ · ផ្នែក ៨ |
| `zto-cookie-sync-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ · ផ្នែក ៨ |
| `zto-list-sync-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៧ · ផ្នែក ៨ |
| `zto-negative-cache-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-network-boundaries-test` | ផ្នែក ២ | ផ្នែក ២ |
| `zto-proxy-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៨ |
| `zto-signed-status-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `zto-sync-banner-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៧ · ផ្នែក ៨ |
| `ZoeW/tests/account-session-race.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/activation-retry.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/adaptive-refresh.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/app-icon-logo.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/audit-checker-outcomes.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/audit-lifecycle.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/auth-flow-race.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/backend-switch-detach.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/barcode-key-encoding.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/barcode-origin.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/batch-scan.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/biometric-android-prf.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/biometric-no-device-mode.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/build-checker-freshness.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/chrome-autohide-intent.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/cleanup-applied-ownership.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/cleanup-deduct-order.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/cleanup-foreign-slot.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/cleanup-journal-cap.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/cleanup-ledger-key.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/cleanup-resume-session.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/cleanup-sweep-batch.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/clear-history-foreign-slot.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/close-restamp-idempotent.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/code128-parity.test.tsx` | — | ផ្នែក ៦ |
| `ZoeW/tests/collected-mirror-durable.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/collected-price-day-scope.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/collected-sync-pending.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/config-modal.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/config-qr-session.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/connection-flow-contract.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/connection-request-owner.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/connection-scope-discovery.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/daily-stats-mixed-pickup.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/db-liveness.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/device-info.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/discard-pending-writes.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/durable-connection-write.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/exchange-rate-backend-switch.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/exchange-rate-completion-race.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/exchange-rate-shop-switch.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/expiry-return-policy.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/expiry-schedule-cap.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/export-request-snapshot.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/firebase-auth-write-ownership.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/firebase-loader-gate.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/forbidden-zone-lock.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/hardware-scanner.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/health-advice.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/health-no-backend.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/health-runtime-evidence.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/history-paging.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/history-patch-late-commit.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/ios-accessory-focus.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/ios-adjusted-tap-focus.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/ios-entry-search-tap.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/ios-history-bottom.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/ios-keyboard-pan.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/ios-page-field-raise.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/ios-search-pulldown.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/ios-search-resnap.test.tsx` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/ios-search-tap-focus.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/ios-search-viewport.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/ios-synthetic-click-focus.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/keyboard-tabbar.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/label-image.test.tsx` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/label-print.test.tsx` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/late-commit-stale-session.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/ledger-native-retry-identity.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/ledger-not-applied-retry.test.ts` | — | ផ្នែក ៧ · ផ្នែក ៨ |
| `ZoeW/tests/ledger-op-ring.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/ledger-replay-companion.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/ledger-stale-session.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/ledger-unknown-no-retry.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/list-paging.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/list-render-scope.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៦ · ផ្នែក ៧ |
| `ZoeW/tests/locker-assign-session.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/locker-occupant.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/locker-scan-direct.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/login-autofill.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/login-over-drawer.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/login-routing.test.tsx` | ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/lookup-import-race.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/lookup-key-restore-idb.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/lookup-late-answer-busy.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/lookup-modes-money.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/manual-adjust-number-browser.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/manual-adjust-single-flight.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/merge-into-deleted-item.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/modal-backdrop-keep.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/modal-chrome-state.test.tsx` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/modal-focus-trap.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/modal-keyboard.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/money-multidevice-oracle.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/more-menu-scroll.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/native-durable-write.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/native-receipt-retention.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/native-recovery-plain-cas.test.ts` | ផ្នែក ១ | ផ្នែក ៨ |
| `ZoeW/tests/native/app-lock-away.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/native/immediate-ui.test.tsx` | — | ផ្នែក ៦ |
| `ZoeW/tests/native/native-back.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/native/print-operation.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/native/render-crash.test.tsx` | — | ផ្នែក ៦ |
| `ZoeW/tests/native/scan-beep.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/native/status-bar-tone.test.ts` | — | ផ្នែក ៦ |
| `ZoeW/tests/native/zto-cors.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/native/zto-preflight.test.ts` | ផ្នែក ១ | ផ្នែក ៦ |
| `ZoeW/tests/network-toast-phase.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/network-toast.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/notifications.test.tsx` | ផ្នែក ២ | ផ្នែក ៧ · ផ្នែក ៨ |
| `ZoeW/tests/notify-apk-link.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/notify-groups.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/notify-update-check.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/orientation-lock.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/palm-sign-camera.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/palm-sign-confirmation-transport.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/palm-sign-journal.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/palm-sign-outbox-idb.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/palm-sign-outbox-store-unit.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/palm-sign-outbox.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/palm-sign-reservation.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/password-save-race.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/phone-pickup-stale-view.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/phone-suggest-idle-scroll.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/pickup-cleanup-collected-race.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/pickup-interrupted-close.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/pickup-repair-race.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/pickup-reset-session.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/pin-flow-race.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/print-relayout.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/push-client.test.tsx` | — | ផ្នែក ៧ · ផ្នែក ៨ |
| `ZoeW/tests/push-schedule-session.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/push-server.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ · ផ្នែក ៨ |
| `ZoeW/tests/pwa-icons.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/queued-photo-output.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/queued-sign-photo-layout.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/queued-sign-photo-ui.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/queued-sign-photo.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/reconfig-invite-seam.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/recovery-toast-dedup.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/registry-claim-proven.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/registry-flush-scale.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/registry-session-race.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/remember-password.test.tsx` | ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/remove-stale-session.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/restore-terminal-cancel.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/scan-camera-session.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/scan-engine-recovery.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/scan-image-qr.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/scan-qr.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/scanner-focus-after-close.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/scanner-modal-queue.test.tsx` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/scroll-thumb.test.tsx` | — | ផ្នែក ៧ · ផ្នែក ៨ |
| `ZoeW/tests/search-glide-hold.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/seller-notices.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/session-expiry-race.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/session-switch-fuzz.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/setup-lookup.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/sheet-lookup-freshness.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/shop-bound-settings.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/shop-bound-ui-refresh.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/shop-device-note.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/shop-pending-cleanup.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/supabase-account.test.tsx` | ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/supabase-auth-unavailable.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/supabase-auth-write-ownership.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/supabase-clock-skew.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-cross-tab-signout.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/supabase-gateway-5xx.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-journal-recovery.test.ts` | ផ្នែក ១ | ផ្នែក ៨ |
| `ZoeW/tests/supabase-ledger-replay-companion.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/supabase-live-op-retention.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/supabase-notify-dirty.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/supabase-offline-restore.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-op-retention.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/supabase-own-keys.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/supabase-pull-paging.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-realtime-race.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/supabase-realtime-ws.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-signout-offline.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-signout-race.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-signout-stage.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/supabase-sync-owner.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/supabase-tenant-switch.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/supabase-transport-hang.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-tx-outcome.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-unsent-tx.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-update-contract.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/supabase-write-bad-body.test.ts` | ផ្នែក ១ | ផ្នែក ៨ |
| `ZoeW/tests/sw-revalidation-timeout.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ · ផ្នែក ៨ |
| `ZoeW/tests/tenant-app-session.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/three-device-recovery.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/toast-backend.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/toast-live-expiry.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/toast-parity.test.tsx` | — | ផ្នែក ៦ |
| `ZoeW/tests/toast-visibility.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/trash-reason-filter.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/trash-retry-session.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/tx-outcome-timeout.test.ts` | ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/zoew-suite-diagnostics.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/zone-format-cache.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-abandon-blocked-sweep.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-abandon-signed-gate.test.tsx` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-barcode-shape.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-born-closed-merge.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-cookie-life.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-detail-identity.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-final-mark-session.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-final-marks.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-function-artifact.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-import-lanes.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-list-bare-record-probe.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-list-identity.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/zto-list-origin-import.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-list-origin.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-lock.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-modern-entry.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-multibranch-signed-hold.test.tsx` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-pages-unknown.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-palm-backends.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-list-e2e.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-list.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-palm-login.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-palm-multibranch-hold.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-photo-status.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-race.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-refresh.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-returned.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-server.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-palm-shared-app.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-shared.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-sign-e2e.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-sign-server.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-sign.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-partial-customer-real-close.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-placeholder-phone.test.tsx` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-read-sharing.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-receipt-photo-readback.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-remind-days.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-restore-verification.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-returned-cleanup.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-returned.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-session-race.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-shop-sweep-marker.test.tsx` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-sign-evidence-refresh.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-signed-cadence.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-signed-mismatch.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-signed-only-import.test.tsx` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-signed-only-purge.test.ts` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-signed-past-range.test.tsx` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-signed-sync.test.tsx` | ផ្នែក ១ | ផ្នែក ៨ |
| `ZoeW/tests/zto-signed-truncation.test.tsx` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-stale-bar.test.tsx` | — | ផ្នែក ៨ |
| `ZoeW/tests/zto-sweep-lane.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-sweep-prefetch.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-token-origin.test.ts` | ផ្នែក ២ | ផ្នែក ៨ |
| `ZoeW/tests/zto-trash-mode-devices.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-trash-mode-shop.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-upstream-timing.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៨ |
