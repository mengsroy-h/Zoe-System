# ប្រវត្តិ Zoe-System — សម័យ ZoeW React (ពី 2.50.0)

> ⛔ **ឯកសារនេះជា *ប្រវត្តិ* មិនមែន *ច្បាប់* ទេ** — ច្បាប់ដែលត្រូវអនុវត្តរស់នៅ [`CLAUDE.md`](../CLAUDE.md) ហើយច្បាប់
> នីមួយៗចងទៅ **ឧបករណ៍ដែលចាក់សោវា**។ ត្រង់នេះទុក *ហេតុអ្វី* ច្បាប់មួយមាន · របៀបដែលកំហុសត្រូវរកឃើញ · **លេខដែលវាស់បាន**។
>
> ⛔ **ប្រវត្តិរស់នៅ ២ ឯកសារក្នុងថត `docs/` នៅ root តែប៉ុណ្ណោះ** (`CLAUDE.md` ច្បាប់ ៩) ៖
>
> | ឯកសារ | គ្របអ្វី |
> |---|---|
> | **`docs/HISTORY.md`** (ឯកសារនេះ) | សម័យ **ZoeW React** ៖ ZoeW `2.50.0` ➜ ឥឡូវ (ពី 2026-10-06) · **ធាតុថ្មីទាំងអស់សរសេរនៅទីនេះ** |
> | **[`docs/HISTORY-ARCHIVE.md`](HISTORY-ARCHIVE.md)** | សម័យ **ZoeW vanilla** ៖ ZoeW ≤ `2.37.3` · ZoeKeyGen ≤ `2.20.2` (ដល់ 2026-09-18) · កំណែមុន `2.20.0` · អត្ថបទដែលដកចេញពី `CLAUDE.md` · **ផ្នែក ៦ ៖ សម័យផ្ទេរទៅ React** (ZoeW `2.38.0` ➜ `2.42.11` · parity ឆៅ) · **ផ្នែក ៧ ៖ សម័យ React ដំបូង** (ZoeW `2.43.0` ➜ `2.49.6`) · **អានបានតែមិនបន្ថែមធាតុថ្មី** |
>
> ⛔ **កុំអានពីដើមដល់ចប់** — វាជាឯកសារយោង។ ផ្លូវធម្មតា ៖ checker ធ្លាក់ ➜ `grep -n "<ឈ្មោះ checker>" docs/HISTORY*.md`
> (គ្របទាំង ២ ឯកសារ) ឬមើល **[🔎 លិបិក្រម](#-លិបិក្រម--ឈ្មោះ-checker--ការពន្យល់រស់នៅឯណា)** នៅចុងឯកសារនេះ។
>
> | ត្រូវការអ្វី | មើលកន្លែងណា |
> |---|---|
> | «សកម្មភាពដែលត្រូវធ្វើដោយដៃ» · អ្នកប្រើឃើញអ្វីខុសពីមុន | **ផ្នែក ១** (ឯកសារនេះ) · កំណែ ≤ 2.37.3 ➜ archive ផ្នែក ១ · `2.38.0` ➜ `2.42.11` ➜ archive ផ្នែក ៦ · `2.43.0` ➜ `2.49.6` ➜ archive ផ្នែក ៧ |
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
  ឆ្លើយជាខ្មែរ · ⛔ ម្ចាស់គម្រោង **មិនអនុញ្ញាត agent/workflow** ដោយគ្មានការសួរ (កូតា) ➜ សួរមុនជានិច្ច។
- ⛔ ច្បាប់រត់ checker ➜ `CLAUDE.md` Runbook (run-all ពេញមុន push) · ម្ចាស់គម្រោងអាចស្នើរត់តែ checker ពាក់ព័ន្ធ (`RUNALL_ONLY`) ➜ កត់ក្នុងផ្នែក ២ ថាមិនបានរត់ពេញ។

### ⏳ អ្នកប្រើមិនទាន់បញ្ជាក់

- ⏳ **[2.50.129]** (rules `ztoSentOutAt` Publish រួច) កញ្ចប់ «ទីតាំងមិនត្រឹមត្រូវ» ➜ បញ្ជូនចេញ ➜ «ខុសទីតាំង» · បញ្ជូនចេញតែម្យ៉ាង ➜ «បញ្ជូនចេញ» ស្តារបាន លើគ្រប់ទូរស័ព្ទ (Cookie · Palm · APK ចាស់ ➜ ស្តារបាន) · រូប Sign ពី Gallery ឬរូបចាស់តាម 📷 ➜ ម៉ោងថតពិត។
- ⏳ **[2.50.128]** (rules `ztoMisplacedAt` Publish រួច) រូប Sign មានម៉ោង + កូអរដោនេ (iPhone · Android · APK ៖ អនុញ្ញាតទីតាំង) · កញ្ចប់ខុសទីតាំងពិត ➜ ធុងសំរាម «ខុសទីតាំង» · លុយដក។
- ⏳ **[2.50.127]** (rules `ztoSignedAt` · `ztoReturnedAt` Publish រួច · ✅ ម្ចាស់គម្រោង ៖ iPhone លឿន · QR iPhone ល្អ) ✍️ Sign លើ Android ពិត ៖ QR លើបុង · ល្បឿន · Gallery iPhone · សម្លេង/ញ័រ · 🔒 Sign រួច/ធុងសំរាម 🔒 លើកញ្ចប់ពិត។
- ⏳ **[2.50.96]** សកម្មភាព ១ (កែតម្លៃកញ្ចប់យករួចលើហាង Firebase និង Supabase)។
- ⏳ **[2.50.94]** សកម្មភាព ១ (migration Supabase ចូល live ពេល merge) · ៣ (ប៉ះផ្ទៃងងឹតលើផ្ទាំងដក/បញ្ចូលច្រើន) · ៤ (ហាង Supabase)។
- ⏳ **[2.50.95]** សកម្មភាព ១ (ប៉ះផ្ទៃងងឹតលើផ្ទាំងបញ្ជីកញ្ចប់ពី ZTO)។

### 🔧 សកម្មភាពដោយដៃដែលនៅបើក (ម្ចាស់គម្រោង)

- 💡 Netlify env `ZTO_DETAIL_IDENTITY` (`optional` ➜ `require` · Sign Palm ជា endpoint សរសេរ ➜ `require` ទើបអ្នកមានតែសោភ្ជាប់គ្មានគណនី ZoeW Sign មិនបាន) — env តែប៉ុណ្ណោះ គ្មានកូដ (ការសម្រេចម្ចាស់គម្រោង · [2.50.93] សកម្មភាព ២ · [2.50.47])។
- ⏳ **Backup ស្វ័យប្រវត្តិ** (ពន្យារដោយចេតនា) ៖ secret `ZOE_BACKUP_TARGETS` · `ZOE_BACKUP_PASSPHRASE` ([`firebase-backup/README.md`](../firebase-backup/README.md) ជំហានទី ៦)
  ➜ Run workflow ➜ **ទាញ artifact មកសាកស្តារ**។ ⛔ run «success» ដោយគ្មាន secret ឈប់ត្រឹម «ពិនិត្យ secret» = **គ្មាន backup** · GitHub ផ្អាក schedule ក្រោយ
  repo ស្ងាត់ ៦០ ថ្ងៃ ➜ backup ឈប់ស្ងាត់ ➜ ពិនិត្យ **Actions** មុន។
- ⏳ **repo នៅ Public** (វាស់ 2026-10-16 ៖ `visibility: public`) ៖ ផែនការ Private (repo Releases ដាច់ · `ZOE_RELEASES_TOKEN` · ច្បាប់ «Public repo» ក្នុង `CLAUDE.md`)
  ➜ ម្ចាស់គម្រោង ៖ Forks · Secret scanning + Push protection · Make private។ ប្រវត្តិ git ៖ ម្ចាស់គម្រោង «មិនបាច់ធ្វើ» ([2.50.93] សកម្មភាព ៤)។
- ⏳ `tools/supabase-migrate/` — តែពេលអតិថិជន Firebase ចង់ប្តូរ (dry-run មុន)។

### 🧭 ZTO Palm (Login · Lookup ➜ ពេញ)

- 🗳️ PR Login Palm merge ដោយ **merge commit** ➜ commit ដើម `d509638` (សោ protocol ក្នុងកូដ · screenshot សាកល្បង) នៅក្នុង history `main` ➜ ការសម្រេចម្ចាស់គម្រោង
  (ទុក · ឬសរសេរ history ឡើងវិញ — ⛔ មិនធ្វើដោយគ្មានសំណើ) · សោនៅតែ env (ZTO ជាអ្នកកាន់សោ ➜ ប្តូរមិនបាន)។
- ⏳ **[2.50.126]** Netlify Logs `push-cron` ពេលទូរស័ព្ទច្រើន ៖ `"reason":"partial"` រួច `"sent"` ក្នុង run បន្ទាប់ · ZoeKeyGen ផ្ទាំងហាង Supabase បង្ហាញហាង/គណនីគ្រប់។
- 📚 កាតាឡុក ៖ [`ZoeW/docs/ZTO-PALM-API.md`](../ZoeW/docs/ZTO-PALM-API.md) · ផ្លូវ Sign តាមសំណើម្ចាស់គម្រោងនៅ [2.50.120]–[2.50.121]។
- ⏳ **[2.50.118]** 📥 Palm ទាញថ្ងៃដូច Cookie ➜ ចំនួនជួរ · «🆕 ថ្មី» ស្មើ Cookie (A202 ៖ មិនទាន់វាស់លើ ZTO ពិត · នៅខ្វះ ➜ 🧪 track កញ្ចប់ដែលខ្វះ) ·
  🗑️ ចុចកាត «➖ ដក + ត្រឡប់» ➜ បញ្ជីតែ «ដក» និង «ត្រឡប់» (iPhone · Android · APK) · ↩️ បញ្ជីចុះហត្ថលេខាមិនគ្រប់ ➜ «📌 … មិនទាន់ដក»។
- ⏳ **[2.50.119]** Login ZTO Palm តាមសាខា (A ➜ B ក្នុងសាខាដដែល · «ផ្តាច់ Palm» លើ A ➜ B នៅស្កេន/ទាញបាន ✅ ម្ចាស់គម្រោងបញ្ជាក់លើ Preview) ៖
  សាខាផ្សេងដែលប្រើសោភ្ជាប់ដូចគ្នា Login គណនីខ្លួន ➜ មិនជាន់គ្នា · ប្រើច្រើនថ្ងៃ ៖ ZTO មិនបដិសេធ token តែមួយលើទូរស័ព្ទច្រើនព្រមគ្នា (៤២៩ · Login ឡើងវិញញឹកញាប់)។
- ⏳ **[2.50.117]** (Firebase rules `returned` Publish រួច) 🗑️ «ត្រឡប់» (ថ្ងៃទី ៨ ឬ ZTO ស្កេនត្រឡប់ · ដកលុយ · ចំនួន) · 🔔/📲 «ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ» ➜ ម្ចាស់គម្រោងអានថាត្រូវគោលការណ៍។
- ⏳ **[2.50.115]–[2.50.116]** ↩️ កញ្ចប់ត្រឡប់ ៖ ទាញបញ្ជី 10-14 ➜ 10-17 ➜ កញ្ចប់ត្រឡប់ដែលបាន 🧪 ក្នុង «↩️ ត្រឡប់ទៅវិញ» · បើបើកក្នុង ZoeW ➜ ធុងសំរាម «ត្រឡប់» + លុយដក (Palm · Cookie)។
- ⏳ **[2.50.114]** Palm ៖ បើក App ថ្ងៃក្រោយ ➜ ស្កេន/ទាញបានដោយមិន Login ZTO Palm ម្តងទៀត · ⏱ ពិតក្នុង A189 ·
  តំបន់ Function ប្តូរបានតែក្រោយ Upgrade Netlify (ការកំណត់ Netlify ➜ គ្មានកូដ · ម្ចាស់គម្រោងសម្រេច)។
- ⏳ **[2.50.120]–[2.50.124]** ម្ចាស់គម្រោងបានអនុញ្ញាត Sign៖ ចែកចាយ ➜ ទទួល; កញ្ចប់មានបញ្ហា បង្ហាញសារ/បញ្ជាក់តាម Palm។ ម្ចាស់គម្រោងបញ្ជាក់ Preview ជោគជ័យ; សាកបន្ថែមលេខមួយច្រើនកញ្ចប់ និងឧបករណ៍នៅសកម្មភាពផ្នែក ១។
  [2.50.124] ៖ ផ្ទាំង Sign រចនាឡើងវិញ (A207–A212) ➜ ពិនិត្យលើទូរស័ព្ទពិត ·
  Preview ៖ Login Palm ម្តងទៀត ➜ «សោមិនត្រឹមត្រូវ» ទាល់តែ clear site data (A214 ៖ មិនមែន App Lock · មិនប៉ះទង្គិច App Palm · ម្ចាស់គម្រោង ៖ APK main ទុកយូរ ➜ Palm ប្រើបាន គ្មានបញ្ហាសោខុស ➜ ជាបញ្ហារបស់ Preview) ➜ [2.50.125] ពេលកើតម្តងទៀត
  ថតសារមុន clear (សោភ្ជាប់ ៖ ប្រភព · ចំនួនតួ · ស្នាមម្រាម · ឬ «Server ទទួលសោភ្ជាប់ ZoeW រួច តែ ZTO បដិសេធ» + កូដ ZTO)។

### 🗳️ ការសម្រេច និងការកំណត់ដែលនៅរស់

- ✅ backend ទាំង ២ (Firebase · Supabase) តាមជម្រើសអតិថិជន ➜ ច្បាប់ក្នុង `CLAUDE.md` «What the system is» (⛔ កុំចម្លងមកទីនេះ)។
- ✅ **`ZTO_UPSTREAM_TIMEOUT_MS = 7000`** ក្នុង Netlify env ដោយចេតនា (កូដលំនាំដើម `6000`) ➜ តម្លៃនេះក្នុង `?diag=1` មិនមែនកំហុស ·
  ⛔ កុំបង្កើន `ZTO_REQUEST_BUDGET_MS` ដល់ `10000` ដោយមិនវាស់ផ្លូវ client ឡើងវិញ។
- ✅ **Sentry `ZTO_UPSTREAM_REJECTED` ពី barcode តេស្ត** ៖ មិនកែ · ⛔ កុំធ្វើឲ្យស្ងាត់ទាំងអស់ (បាំងការដាច់ ZTO ពិត) · `lookupReason: ""` ក្នុង breadcrumb មិនមែនកំហុស។
- ✅ **Firebase rules Business + License Publish រួច** · Push (VAPID · FCM · `google-services.json`) កំណត់រួច ➜ ការសរសេរត្រូវបដិសេធ ➜ ពិនិត្យ rules មុនកូដ ·
  Activate `seat-unavailable`/«Key នេះមិនមែនសម្រាប់ ZoeW» ➜ ពិនិត្យថាជា Key ចាស់ (`a: 'ADM'`) មុន។
- 🗳️ សមត្ថភាពមុនដាក់ប្រើជាផ្លូវការ (Firebase Spark egress · License Project តែមួយ · Netlify Functions/credit · Supabase realtime · ពិដាន Push) ➜ ម្ចាស់គម្រោងសម្រេច
  (ផ្នែក ២ «Deep audit ៣» · «Deep audit ៦» A222 ៖ ឧបករណ៍ ZTO ៣ ក្នុងសាខាអាន ZTO ដដែល ៣ ដង ➜ ជម្រើស leader សាខា = តំបន់ LOCK ត្រូវសំណើ) ·
  A223 ៖ repo Public ➜ `ZOE_RUNNER_MODE=github` ទើប Audit CI រត់ពិត (self-hosted ➜ «skipped» មិនមែនបៃតង) · ព្រំដែនដែលទទួលស្គាល់ និងការរកឃើញដែលបានបដិសេធ ➜ ផ្នែក ២ «Deep audit ៣–៥» (⛔ កុំរាយការណ៍ម្តងទៀត)។

## 📗 ផ្នែក ១ — កំណត់ត្រាតាមកំណែ (សម័យ React · អ្នកប្រើឃើញអ្វីខុសពីមុន)

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

### [2.50.99] — 2026-10-16 · ZoeW ៖ របៀប Palm លែងទាញបញ្ជីកញ្ចប់មកដល់ (tab «បញ្ជូន» មិនមែនកញ្ចប់មកដល់)

**ZoeW `2.50.99`** (`zoew-v361` ➜ `zoew-v362`) · ZoeKeyGen ដដែល · គ្មាន Firebase rules ឬ migration ថ្មី · គ្មានកូដ Android native។
ម្ចាស់គម្រោងរាយការណ៍ (A180) ៖ «Palm ទាញបញ្ជី ទិន្នន័យខុស … ថ្ងៃនេះកញ្ចប់ចូលមកមានតែអតិថិជនម្នាក់គត់ … Cookie បង្ហាញត្រឹមត្រូវ» ➜ តំបន់ចាក់សោ ZTO
ប្រែតាមរបាយការណ៍នេះ (`zto-palm.js` · `zto-order-detail.js` · `zto-list-sync.ts` ➜ `LOCK` ថ្មី)។

- Function ៖ `?palm=1&list=1` ឆ្លើយតែបញ្ជីចុះហត្ថលេខា (`signed=1` · `exact=1` ➜ `queryDispatchList` `billStatus` `5`)។ សំណើបញ្ជីគ្មាន `signed=1`
  (`withSigned` ផង) ➜ `enabled:false` `palm:no-arrival-list` មុនហៅ ZTO។ `?diag=1` លែងមាន `upstreamTiming.palm.list`។
- App ៖ ក្នុងរបៀប Palm «ទាញបញ្ជីកញ្ចប់ពី ZTO» បិទ (`ztoListPalmMode()`) ៖ ប៊ូតុង 📥 និងកុងតាក់ ☰ លាក់ · ការទាញមិនផ្ញើសំណើ · សារ
  `ZTO_PALM_NO_LIST_TEXT` ប្រាប់ឲ្យប្រើរបៀប Cookie · កុងតាក់ដែលរក្សាទុកនៅដដែលសម្រាប់របៀប Cookie។ «បិទតាម ZTO ស្វ័យប្រវត្តិ» និងការរង់ចាំ ៨ ថ្ងៃ
  ដំណើរការដូចមុន។ ផ្ទាំង Palm · `guide.html` · `ZTO-PALM.md` · `ZTO-PALM-API.md` · `ZTO-SETUP-KH.md` ពន្យល់។
- អ្នកយាម ៖ `zto-palm-server.test.ts` · `zto-palm-list.test.tsx` · `zto-upstream-timing.test.ts` · `zto-palm-login.test.tsx` (៧ ធ្លាក់លើកូដមុនកែ)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. លើ preview (របៀប Palm) ៖ ☰ ZTO គ្មាន «ទាញបញ្ជីកញ្ចប់ពី ZTO» · ប៊ូតុង 📥 លើទំព័រទិន្នន័យលាក់ · ប្តូរទៅរបៀប Cookie ➜ ទាំងពីរលេចវិញ។
2. សាក «បិទតាម ZTO» របៀប Palm (មើល [2.50.98] សកម្មភាព ៣) មុន merge។

### [2.50.98] — 2026-10-16 · ZoeW ៖ ZTO Palm ទាញបញ្ជី និងបិទតាម ZTO (Palm ពេញ)

**ZoeW `2.50.98`** (`zoew-v360` ➜ `zoew-v361`) · ZoeKeyGen ដដែល · គ្មាន Firebase rules ឬ migration ថ្មី · គ្មានកូដ Android native។
សំណើម្ចាស់គម្រោង ៖ «ZTO Palm mode គួតែមានសមត្ថភាពខ្លាំងជាង sync Cookie» ➜ ជ្រើស «Palm ពេញ (បញ្ជី + ចុះហត្ថលេខា)» · កញ្ចប់មកដល់ហាង
បង្ហាញក្នុង tab «បញ្ជូន» (ម្ចាស់គម្រោងបញ្ជាក់) · PR ថ្មី។ តំបន់ចាក់សោ ZTO ប្រែតាមសំណើនេះ (`zto-palm.js` · `zto-order-detail.js` ·
`zto-list-sync.ts` · `zto-status.ts` ➜ `LOCK` ថ្មី)។

- Function ៖ `?palm=1&list=1` ឆ្លើយកិច្ចសន្យាបញ្ជី Argus ពី `queryDispatchList` តែប៉ុណ្ណោះ (មកដល់ = `billStatus` `4` · `dispEmpDate*` ·
  ចុះហត្ថលេខា = `billStatus` `5` · `signSiteDate*` · `withSigned` ស្របគ្នា · `signed=1` · `exact=1` · `pagesUnknown`)។ តែជួរ `billStatus` `5`
  ទេជាភស្តុតាង · Palm គ្មានម៉ោងចុះហត្ថលេខា ➜ `signedRows.at` ទទេ (មិននាំចូលដោយទាយថ្ងៃ) · គណនី ZoeW ផ្ទៀងរួចសាខាផ្សេង ➜ `site:palm-other-branch`។
  Session Palm ចងសាខា (`site` · `siteName`)។
- App ៖ URL បញ្ជីរក្សា `palm=1` · ផ្ញើ session Palm · ☰ ZTO (ទាញបញ្ជី · បិទតាម ZTO) និងការរង់ចាំ ៨ ថ្ងៃ ដំណើរការក្នុងរបៀប Palm ·
  មិនពិនិត្យ `/detail` ម្តងមួយៗ (`billInfoQuery` គ្មានស្ថានភាព ➜ គ្មានរបារ «មិនទាន់ចុះហត្ថលេខា»)។ ផ្ទាំង Palm · `guide.html` ពន្យល់។
- អ្នកយាមថ្មី ៖ `ZoeW/tests/zto-palm-list.test.tsx` (៤ ធ្លាក់លើកូដមុនកែ) · `zto-palm-server.test.ts` ផ្នែកបញ្ជី (៨ ធ្លាក់លើកូដមុនកែ ·
  endpoint ដែលហៅត្រូវនៅក្នុងបញ្ជីអានតែប៉ុណ្ណោះ)។ test ចាស់ ៣ ដែលសន្មតថា Palm បិទមុខងារ ZTO ត្រូវប្តូរតាមសំណើ។
- ល្បឿន Lookup Palm (ម្ចាស់គម្រោងរាយការណ៍ Palm យឺតជាង Cookie · A173–A174) ៖ របៀប Palm កម្តៅ Function ដូចរបៀប Cookie (`OPTIONS ?palm=1` ·
  គ្មានសោ · គ្មាន session · Function មិនអាន Cookie) · `?diag=1` វាស់ពេល ZTO Palm ឆ្លើយ (`upstreamTiming.palm`) និងការភ្ជាប់ TCP+TLS ថ្មីទៅ ZTO
  (`upstreamTiming.connections`) ➜ 🩺 ជួរ Lookup បង្ហាញជាវិនាទី។ អ្នកយាមថ្មី `ZoeW/tests/zto-upstream-timing.test.ts` (៦ ធ្លាក់លើកូដមុនកែ) ·
  `zto-palm-list.test.tsx` (កម្តៅ) · `zto-palm-login.test.tsx` (🩺)។ បន្ទាប់ពីម្ចាស់គម្រោងវាស់លើ preview (A175) ៖ ពេលស្កេនបំបែកតាមការភ្ជាប់ថ្មី
  ឬការភ្ជាប់ដែលបើករួច (`upstreamTiming.scans`) · រយៈដែល ZTO ទុកការភ្ជាប់ (`keepAliveSec` · `closes`) · តំបន់ Function (`runtime.region`) ➜ 🩺 ដដែល។
- ល្បឿន Palm (ម្ចាស់គម្រោង ៖ «ធ្វើជម្រើស ក» · A178) ៖ Function ទុកការភ្ជាប់ទៅ ZTO Palm ៦០ វិនាទី (`palmDispatcher()`) ➜ ការស្កេនបន្តបន្ទាប់ប្រើការភ្ជាប់ដដែល ·
  ការភ្ជាប់ដែល ZTO បិទរួច ➜ ស្កេន/បញ្ជីព្យាយាមម្តងទៀតមួយដង (⛔ មិនមែន Login)។
- បញ្ជី Palm ទទេ (ម្ចាស់គម្រោង ៖ «cookie ចុចបញ្ជី ZTO មានទិន្នន័យ តែ login palm មិនឃើញទិន្នន័យ» · A176) ៖ ជួរនីមួយៗនៃសំណើ `billStatus` `4` ជាកញ្ចប់មកដល់
  លើកលែងជួរដែលស្ថានភាពខ្លួនឯង `5` (ភស្តុតាងចុះហត្ថលេខា) ⛔ លែងទាមទារស្ថានភាពជួរ `4` · បញ្ជីចុះហត្ថលេខា (`5`) មិនប្តូរ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. env Palm ៣ (មើល [2.50.97]) ត្រូវមានក្នុង Netlify Deploy Previews ដើម្បីសាក PR នេះ។
2. លើ preview ៖ ☰ ZTO ➜ បើក «ទាញបញ្ជីកញ្ចប់ពី ZTO» ➜ ទាញថ្ងៃនេះ ➜ ធៀបនឹង tab «បញ្ជូន» ក្នុង App Palm (ចំនួន · លេខទូរស័ព្ទ · COD/DOD)។
3. ចុះហត្ថលេខាកញ្ចប់មួយក្នុង App Palm ➜ ក្នុង ZoeW កញ្ចប់នោះបិទ «យក» ដោយស្វ័យប្រវត្តិ (ឬចុច 🔄 ក្នុងរបារ ZTO)។
   ⛔ សាកលើ preview មុន merge ព្រោះវាប៉ះ auto-close និងការសម្អាត ៨ ថ្ងៃ (លុយ)។
4. ល្បឿន ៖ ស្កេន ៥–១០ កញ្ចប់ក្នុងរបៀប Palm ➜ 🩺 ពិនិត្យសុខភាពប្រព័ន្ធ ➜ ជួរ «Lookup អតិថិជន (ZTO Palm)» ➜ កត់ «ស្កេនលើការភ្ជាប់ថ្មី» ·
   «ស្កេនលើការភ្ជាប់ដែលបើករួច» · «ZTO ទុកការភ្ជាប់» · «Function នៅ» ➜ ធ្វើដូចគ្នាក្នុងរបៀប Cookie ➜ ផ្ញើរូបទាំងពីរមក។

### [2.50.97] — 2026-10-16 · ZoeW ៖ Login ZTO Palm សម្រាប់ Lookup

**ZoeW `2.50.97`** (`zoew-v359` ➜ `zoew-v360`) · ZoeKeyGen ដដែល · គ្មាន Firebase rules ឬ migration ថ្មី។
សំណើម្ចាស់គម្រោង៖ បន្ថែម Login ZTO Palm ក្នុង ZoeW ដើម្បីទាញ Lookup ទៅមុខងារដែលមានស្រាប់ និងបើក PR។

- ផ្ទាំងការកំណត់ Lookup មាន Login Palm និងផ្តាច់ session។ Login ជោគជ័យរៀបចំ URL និង fields ស្វ័យប្រវត្តិ។
- ផ្ទៀងផ្ទាត់ទម្រង់ពី APK Palm `2.9.92`: password AES/ECB/PKCS5Padding, `x-sign` MD5/Base64, `x-token`,
  login `/zto/system/v1/doLogin` និង lookup `/zto/basic/v1/billInfoQuery`។ លេខទូរស័ព្ទ encrypted ត្រូវស្រាយមុនបំពេញ។
- Session របស់ឧបករណ៍នីមួយៗអ៊ិនគ្រីបនៅ server និងដោយ PIN នៅ App; មិនរក្សាទុក password និងមិនប្តូរ Argus Cookie។
  ការឆ្លើយយឺតក្រោយប្តូរហាង/PIN/config ឬបិទផ្ទាំងមិនអាចរក្សាទុកជាន់បាន។ Logout សម្អាត fields និងព័ត៌មានគណនី Palm។
- Palm ជា lookup មួយ barcode (លេខទូរស័ព្ទ/COD/DOD) សម្រាប់គណនី KH; មិនហៅ Argus list ឬផ្ញើ sign scan ទៅ ZTO។
- អ្នកយាមថ្មី៖ `ZoeW/tests/zto-palm-server.test.ts` និង `ZoeW/tests/zto-palm-login.test.tsx` គ្រប AES/MD5 ពី Java,
  session isolation/expiry, login failure, native origin, ការលេចធ្លាយ secret និងការបំពេញផ្ទាំងស្កេនពិត។ ស្នាមម្រាមដៃ ZTO
  ប្តូរតែឯកសារដែលពាក់ព័ន្ធនឹងសំណើនេះ; មិនបន្ធូរការផ្ទៀងផ្ទាត់ចាស់។
- Audit PR (សំណើម្ចាស់គម្រោង «កែទាំងអស់ដែលរកឃើញថាមានចន្លោះ» · A163–A172 ផ្នែក ២)៖ សោ protocol Palm អានតែពី env ·
  Login/Lookup Palm អនុវត្ត `ZTO_DETAIL_IDENTITY` · `ZTO_DETAIL_BRANCH_PATHS` ដូច `/detail` · COD/DOD អានតាមវាល Argus ·
  billCode មិនខ្វល់អក្សរធំតូច · កូដ ZTO ដែលមិនស្គាល់បង្ហាញជា `palm:<code>` · preflight Palm មិនអាន Cookie ពី Blobs ·
  ពេលរង់ចាំ ZTO តាមថវិកា Function · App សម្រេចរបៀប Palm ពី URL តែមួយ · មិនរក្សាឈ្មោះគណនី Palm · ផ្ញើគណនី ZoeW ជាមួយ Login ·
  🩺 ប្រាប់ពី session/env Palm · ផ្ទាំង Palm ព្រមានថាវាមិនបិទកញ្ចប់តាម ZTO។ `LOCK` ZTO ធ្វើបច្ចុប្បន្នភាពតាមសំណើនេះ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. មុនប្រើ បន្ថែមក្នុង Netlify Functions (Production និង Deploy Previews) រួច deploy ZoeW៖ `ZTO_PALM_SESSION_SECRET`
   (ចៃដន្យយ៉ាងតិច 32 តួអក្សរ) · `ZTO_PALM_SIGN_KEY` · `ZTO_PALM_PASSWORD_KEY` (សោ protocol ZTO Palm, 16 bytes) — ⛔ កុំ commit តម្លៃទាំងនេះ។
   ខ្វះណាមួយ ➜ Login Palm ឆ្លើយ «Server មិនទាន់បានកំណត់ ZTO Palm (palm:…)»។
   ប្រើ `ZTO_PROXY_KEY`/proxy keys ដែលមានស្រាប់; មិនដាក់ session secret ក្នុង frontend។ មើល `ZoeW/docs/ZTO-PALM.md`។
2. បើកការកំណត់ API ដោយ PIN ➜ Login ZTO Palm ➜ គណនីដែលមានសិទ្ធិ ➜ ស្កេនកញ្ចប់ពិត ហើយផ្ទៀងលេខទូរស័ព្ទ និង COD/DOD។
   Tests ប្រើគណនីសិប្បនិម្មិត និង upstream ក្លែង; មិនទាន់ផ្ទៀងផ្ទាត់ login ជាមួយ ZTO server ពិត។
3. សាក session ផុតកំណត់, login ម្តងទៀត និងផ្តាច់ Palm លើ web និង APK។ មិន merge ឬ deploy ក្នុងការងារនេះ។

### [2.50.96] — 2026-10-16 · ZoeW ៖ **កែតម្លៃកញ្ចប់ដែលយករួច ➜ «ចំណូលយករួច» ប៉ះតែថ្ងៃពាក់ព័ន្ធ (មិនមែន root ៧ ថ្ងៃទាំងមូល)**

**ZoeW `2.50.96`** (`zoew-v358` ➜ `zoew-v359`) · ⛔ **ZoeKeyGen មិនប្រែ** · គ្មាន Firebase rules · គ្មាន migration Supabase · គ្មានកូដ Android native។
ការងារបន្តពី A156 (💡 «App `runTransaction` តាមថ្ងៃ ជំនួស root ចំណូលយករួចទាំងមូល») ក្រោយ merge PR #323 · merge `main` (PR #324 · [2.50.95]) ➜ ឡើងកំណែម្តងទៀត · ការវាស់ ➜ ផ្នែក ២ A160។

#### អ្វីដែលខុសពីមុន

- 💵 កែតម្លៃកញ្ចប់ដែលបិទរួច ➜ `syncCollectedValueForBarcode()` ➜ `reconcileCollectedHistory(…, true)` ៖ transaction លើ `zoew_daily_collected_cod_dod/<ថ្ងៃ>/<key>`
  នីមួយៗ (ថ្ងៃក្នុងទិដ្ឋភាព + ៧ ថ្ងៃ retention + ថ្ងៃបិទរបស់ barcode · ស្របគ្នា) ជំនួស transaction មួយលើ root ទាំងមូល។ `reconcileCollectedPriceState(current, barcode, keep)`
  សម្រេចតម្លៃ leaf ៖ គ្មាន ➜ `null` (server សម្រេច · មិនបង្កើត) · បិទ ➜ តម្លៃ server របស់ barcode · បើក ➜ លុប · ថ្ងៃចាស់ស្ទួន ➜ លុបក្រោយ (ថ្ងៃថ្មីជាងឈ្នះ)។
  ពិដាន retry · `'pending'` (⏳ ➜ ✅) · `error.message === 'set'` ➜ អានឡើងវិញ ដដែល · ⛔ មិនប៉ះ `isDeducted` · ledger · `packagesPickedUp`។

#### អ្នកយាម

- `ZoeW/tests/collected-price-day-scope.test.ts` (ថ្មី ១៦ · SDK ក្លែងន័យ Firebase + adapter Supabase ពិត) — មុនកែ ធ្លាក់ ៦ (បៃ ២៦៦ KB · ៥៣២ KB > ២ KB) · ន័យ ១០ ឆ្លងទាំងមុន
  និងក្រោយ (បើកវិញ · ទិដ្ឋភាពចាស់ · ឧបករណ៍ ២ ៖ លុប key · សរសេរតម្លៃចាស់ · ផ្លាស់ថ្ងៃ)។
- `daily-collected-test` ៖ fake SDK សរសេរ `null` លើផ្លូវគ្មាន ➜ គ្មានប្រែ · មិនទុក node ទទេ (ស្មើ RTDB ពិត · មិនបន្ធូរការផ្ទៀងផ្ទាត់)។
- `emu/restore-mutation` «សម្អាតជាន់ការកែតម្លៃ» ៖ gate ទប់**គ្រប់**ការសរសេរក្រោម root collected (root ឬ `<ថ្ងៃ>/<key>`) មុន HTTP ផ្ញើ (មុន ៖ តែផ្លូវស្មើ root ➜ CI
  `COLLECTED_WRITE_DID_NOT_REACH_GATE`) ➜ RTDB ពិត ៖ leaf ៨ ទប់ · leaf ថ្ងៃដែលសម្អាតរួចទទួល `412` ➜ រត់លើ `null` ➜ មិនបង្កើតថ្ងៃវិញ · ១៨២/១៨២។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ) ➜ APK ថ្មី `zoew-android-v2.50.96` (កូដ Android ដដែល)។ Firebase rules ៖ **គ្មាន** · migration Supabase ៖ **គ្មាន**។
1. សាក ៖ ហាង Firebase និងហាង Supabase ➜ បិទកញ្ចប់ («យករួច») ➜ ⋯ «កែតម្លៃកញ្ចប់» ➜ «✅ បានកែប្រែទឹកប្រាក់…» · 💵 «ចំណូលប្រចាំថ្ងៃ» យករួចប្រែតាមតម្លៃថ្មី ក្នុងថ្ងៃដដែល ·
   ឧបករណ៍ទី ២ ឃើញតម្លៃថ្មី · កញ្ចប់បើក (មិនទាន់យក) កែតម្លៃ ➜ ចំណូលយករួចមិនប្រែ។

### [2.50.95] — 2026-10-16 · ZoeW ៖ **ផ្ទាំង «📥 បញ្ជីកញ្ចប់ពី ZTO» មិនបិទពេលប៉ះផ្ទៃទទេ**

**ZoeW `2.50.95`** (`zoew-v357` ➜ `zoew-v358`) · ⛔ **ZoeKeyGen មិនប្រែ** · គ្មាន Firebase rules · migration · Android native ថ្មី · ⛔ តំបន់ចាក់សោ ZTO មិនប្រែ
(`LOCK` ដដែល ៖ ការកែនៅ `src/core/modals.ts` តែប៉ុណ្ណោះ)។
សំណើម្ចាស់គម្រោង ៖ «ខ្ញុំចង់ អោយ modal បញ្ជីZTO ប៉ះផ្ទៃទទេមិនបិទ មួយទៀត ការពារពេលកំពុងទាញបញ្ជីប៉ះចៃដន្យ»។

#### អ្វីដែលខុសពីមុន

- 📥 បញ្ជីកញ្ចប់ពី ZTO ៖ ប៉ះផ្ទៃងងឹតខាងក្រៅផ្ទាំង ➜ ផ្ទាំងនៅបើក (`BACKDROP_KEEP_MODALS` + `ztoListSyncModal`) · បិទដោយប៊ូតុង «បិទ» · Back · Escape ដដែល។
  មុននេះ ប៉ះខុសមួយហៅ `closeZtoListSyncModal()` ដែលលុបបញ្ជីដែលទាញរួច (`ztoListSyncResult = null`) ➜ ត្រូវទាញម្តងទៀត។

#### អ្នកយាម

- `ZoeW/tests/modal-backdrop-keep.test.tsx` (+ផ្ទាំងបញ្ជី ZTO ពិត) — មុនកែ ធ្លាក់ ១ (ប៉ះផ្ទៃងងឹត ➜ បិទ) · ក្រោយកែ ២០/២០ រួម `zto-lock` ដដែល។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ) ➜ APK ថ្មី `zoew-android-v2.50.95` (កូដ Android ដដែល)។ Firebase rules · migration ៖ **គ្មាន**។
1. សាក ៖ ☰ ➜ ZTO ➜ ទាញបញ្ជីកញ្ចប់ពី ZTO ➜ «📥 ទាញបញ្ជី» ➜ ប៉ះផ្ទៃងងឹតពេលកំពុងទាញ និងក្រោយបញ្ជីលេច ➜ ផ្ទាំងនៅបើក បញ្ជីនៅដដែល · «បិទ»/Back ➜ បិទ
   (iPhone · Android · កុំព្យូទ័រ)។

### [2.50.94] — 2026-10-16 · ZoeW · migration Supabase ៖ **ផ្ទាំង «ផ្ទៀងផ្ទាត់មុនដកកញ្ចប់» · «បញ្ចូលច្រើន» មិនបិទពេលប៉ះផ្ទៃទទេ · Supabase ចំណាយលីនេអ៊ែរ (A154) · ពិដានទំហំក្នុងហាង**

**ZoeW `2.50.94`** (`zoew-v356` ➜ `zoew-v357`) · migration Supabase ថ្មី `20261016120000_zoe_linear_write.sql` · ⛔ **ZoeKeyGen មិនប្រែ** · គ្មាន Firebase rules · Android native ថ្មី។
សំណើម្ចាស់គម្រោង ៖ «រួចធ្វើ 5» (ចំណុច ៥ នៃ audit [2.50.93] = A154 · ក្រោយ merge PR #322) · «កែ សម្រួល modal "ផ្ទៀងផ្ទាត់មុនដកកញ្ចប់" និង "បញ្ចូលច្រើន"
កុំអោយប៉ះផ្ទៃទទេបិទ modal អី»។ ការសម្រេចម្ចាស់គម្រោងលើសកម្មភាព [2.50.93] ៖ ១ · ៣ · ៤ «មិនបាច់ធ្វើ» · ២ (`ZTO_DETAIL_IDENTITY`) ជា env Netlify តែប៉ុណ្ណោះ (គ្មានកូដ) ·
៥ = ជុំនេះ។

#### អ្វីដែលខុសពីមុន

- 🗑️ ផ្ទៀងផ្ទាត់មុនដកកញ្ចប់ · 📋 បញ្ចូលច្រើន ៖ ប៉ះផ្ទៃងងឹតខាងក្រៅផ្ទាំង ➜ ផ្ទាំងនៅបើក (`BACKDROP_KEEP_MODALS`) · បិទដោយប៊ូតុងក្នុងផ្ទាំង · Back · Escape ដដែល។
- ☁️ Supabase (server) ៖ ការសរសេរ និងការអាន ចំណាយលីនេអ៊ែរតាមទំហំ (A156 · A157) ៖ rules ឃើញឯកសារមុន/ក្រោយការសរសេរដែលបញ្ជូនម្តង (មិនសាងសង់ context ឡើងវិញ ឬអានឯកសារ
  ពីតារាងរាល់ node) · `exists`/`hasChildren` កម្រិត root មិនប្រមូល root ទាំងមូល · ការបញ្ចូល op ទៅឯកសារមួយជុំ (`zoe_merge`) · ការពិនិត្យផ្លូវជាន់តម្រៀប · ឈប់ប្រើ
  `jsonb_agg`/`jsonb_object_agg` លើតម្លៃឯកសារ (`zoe_write` · `zoe_read` · `zoe_pull` · `zoe_admin_export`)។ ពិដាន ៖ ការសរសេរមួយប៉ះឯកសារ ≤ 8 MiB · ទំព័រ
  `zoe_pull` ≤ 2 MiB (មិនកាត់ការសរសេរមួយ) · ទំហំក្នុងហាង `zoe_tenant_state.bytes` ≤ `quota_bytes` (លំនាំដើម 1 GiB ៖ ការសរសេរដែលធំឡើងលើស ➜ `quota_exceeded` ·
  ការលុប និង Admin ឆ្លងបាន)។ ច្បាប់ rules · verdict មិនប្រែ (វាស់ធៀប RTDB emulator)។

#### អ្នកយាម

- `ZoeW/tests/modal-backdrop-keep.test.tsx` (+២ ផ្ទាំង) — មុនកែ ធ្លាក់ ២។
- `supabase-datastore-test` ផ្នែក ៣ «ចំណាយលីនេអ៊ែរ» (ថ្មី ៧ ក្រោម `statement_timeout` ៨ វិ.) — មុនកែ ធ្លាក់ ៦ (reconcile ៨០០៣ms ដាច់ · CAS root · ឯកសារ ២០០០០ barcode
  Admin សរសេរមិនរួច · គ្មានពិដានទំហំ · pull ១ ទំព័រ) · ទំហំក្នុងហាង/quota (ថ្មី ៦ ក្នុង body) + mutation ថ្មី ៣ · mutation អនុវត្តលើនិយមន័យដែលរស់ (A158)។
- `supabase-rls-test` ចាត់ថ្នាក់ function private ថ្មី ៦ · `emu/supabase-rules-parity` anchor ថ្មី · `supabase-data-tools-test` mutation SQL ទៅ occurrence ចុងក្រោយ (`zoe_admin_export` ថ្មី)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ) ➜ APK ថ្មី `zoew-android-v2.50.94` (កូដ Android ដដែល)។ Firebase rules ៖ **គ្មាន**។
1. ⚠️ **migration Supabase** ៖ merge ចូល `main` ➜ GitHub integration អនុវត្ត `20261016120000_zoe_linear_write.sql` (ឬបិទភ្ជាប់ក្នុង SQL Editor ហើយ `migration repair`
   តាម `supabase/README.md`) ➜ migration គណនា `bytes` របស់ហាងនីមួយៗ។
2. ពិនិត្យទំហំហាង ៖ SQL ក្នុង `supabase/README.md` ផ្នែក «ទំហំហាង (quota)»។
3. សាក ៖ របៀបស្កេនដក ➜ ផ្ទាំងផ្ទៀងផ្ទាត់ ➜ ប៉ះផ្ទៃងងឹត ➜ នៅបើក · «បោះបង់»/Back ➜ បិទ · «📋 បញ្ចូលច្រើន» ដូចគ្នា (iPhone · Android · កុំព្យូទ័រ)។
4. សាកហាង Supabase ៖ ស្កេន · បិទ/បើក · កែតម្លៃ · ទាញពេញ (ឧបករណ៍ថ្មី) ដំណើរការដូចមុន។

### [2.50.93] — 2026-10-16 · ZoeW · ZoeKeyGen `2.24.19` ៖ **audit សុវត្ថិភាពគម្រោងទាំងមូល ៖ token គណនីទៅតែ ZoeW · Activation Key ចងនឹងហត្ថលេខា · កៅអីអានមិនបាន = ក្រៅបណ្ដាញ · Push គ្មាន sub កំព្រា**

**ZoeW `2.50.93`** (`zoew-v355` ➜ `zoew-v356`) · **ZoeKeyGen `2.24.19`** (`zoekeygen-v129` ➜ `zoekeygen-v130` ៖ `license-verify.js` ដូចគ្នាបេះបិទ) · គ្មាន rules · migration · Android native ថ្មី ·
⛔ **តំបន់ចាក់សោ ZTO ប្រែតាមការអនុញ្ញាតម្ចាស់គម្រោង** (`lookup-api.ts` · `zto-list-sync.ts` ➜ `LOCK` ថ្មី)។
សំណើម្ចាស់គម្រោង ៖ «ពេលការងារ ចប់ សូម audit ជុំនេះក្នុង PR នេះ ផ្តោតលើប្រព័ន្ធសុវត្ថិភាពproject ទាំងមូល ទាំង២app ពិនិត្យ ក្រែងមានលេចធ្លាយ secret និងការវាយប្រហារផ្សេង
ធានាបានថា app ទាំង២ រឹងមាំគ្រប់គ្រាន់»។ ការសម្រេចម្ចាស់គម្រោង ៖ token ZTO ➜ «កែ» · `?list=1` Project មិនចងសាខា ➜ «ចង env តែប៉ុណ្ណោះ» · កូដ Setup Link ➜ «ទុក ៦ ខ្ទង់»។

#### របៀប audit

៥ ផ្នែកស្របគ្នា (អានកូដ + វាស់ពិត) ៖ Netlify Functions (module ពិត + env/fetch/Blobs ក្លែង) · Firebase rules និង License (emulator RTDB ពិត · `license-verify.js` ពិតក្នុង vm) ·
Supabase (Postgres 17 ពិត + migrations ទាំងអស់ · វាយជា anon/authenticated ហាង A/B/admin) · App ទាំង ២ (XSS · CSP · ការផ្ទុក · KDF benchmark) ·
CI/Android/ឧបករណ៍ + **ប្រវត្តិ git ពេញ** (១៤២៨ commit · គ្រប់ branch · refs/pull)។ បន្ថែម ៖ `npm audit` (ZoeW · supabase · firebase-provision ៖ ០) ·
probe browser PIN · Activate · ចាក់សោ App (ឧបករណ៍ ៤ ៖ ធ្លាក់ ០ / ២៣៦)។

#### អ្វីដែលខុសពីមុន

- 🔒 `X-Zoe-Id-Token` ទៅតែ origin ZoeW (web) ឬ `VITE_NATIVE_WEB_ORIGIN` (APK) — `ztoIdentityTargetTrusted()` (A149)។ host ផ្សេង ➜ `/detail` ចេញគ្មាន token · ទាញបញ្ជី ➜ បដិសេធ `host:untrusted`។
- 🔒 License ៖ `getStatus()` ពិនិត្យ online លើ `id` ក្នុង payload ដែលបានចុះហត្ថលេខា (ពិដាន `exp` ក៏ដូចគ្នា) · អានកៅអីមិនបាន (បណ្ដាញ) មិនរំកិល `lastOnlineCheck` (A150)។
- 🔒 Push (server) ៖ subscribe ដែល index រវល់ ➜ ដក/ស្តារ record វិញ ➜ គ្មាន `sub/` កំព្រា (A151)។

#### អ្នកយាម

- `ZoeW/tests/zto-token-origin.test.ts` ៤ (ថ្មី) — មុនកែ ធ្លាក់ ៣ (token ទៅ `evil.example` · `*.supabase.co` · ទាញបញ្ជីចេញ)។ តេស្ត ZTO ១៥ ឯកសារប្តូរ URL Function ទៅ origin ZoeW
  (ការកំណត់ពិត ៖ CSP web អនុញ្ញាតតែ `'self'`) · checker ៤ (`health-check` · `lookup-burst` · `lookup-failure-identity` · `lookup-prefetch`) បញ្ចូល helper ពិត។
- `license-seat-test` ១១ក · ១១ខ (ថ្មី ៦) — មុនកែ ធ្លាក់ ៤ (`lastOnlineCheck` រំកិល · active ៤ ថ្ងៃ · អាន/កក់កៅអីលើ Key អ្នកផ្សេង)។
- `ZoeW/tests/push-server.test.ts` (ថ្មី ១ ៖ index រវល់ · ១២០ ស្របគ្នា) — មុនកែ ធ្លាក់ (sub កំព្រា)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** និង **ZoeKeyGen** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ) ➜ APK ថ្មី `zoew-android-v2.50.93` (កូដ Android ដដែល)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. ⚠️ **Netlify env (ការសម្រេចម្ចាស់គម្រោង ៖ ចង env)** ៖ `FIREBASE_PROJECT_IDS` ៖ ដាក់សាខាលើរាល់ Project (`projectId:881859` ឬ `projectId:881859|881860`) ➜ `?list=1` លែងជឿលេខសាខាពីអ៊ីមែល
   (អ្នកប្រើប្តូរអ៊ីមែលខ្លួនឯងបាន) · ពិនិត្យ `?diag=1` `access.branch.unboundProjects` = ០។
2. 💡 ណែនាំ ៖ Netlify env `ZTO_DETAIL_IDENTITY=require` (លំនាំដើម `off` ៖ អ្នកកាន់ proxy key ណាក៏យកលេខទូរស័ព្ទ/COD តាម waybill បាន) — សាកស្កេនបន្ទាប់ពីកំណត់។
3. 💡 ណែនាំ ៖ GitHub ➜ Settings ➜ Environments ៖ ដាក់ `ZOEW_KEYSTORE_*` · `ZOE_RELEASES_TOKEN` ក្នុង Environment ដែលត្រូវការអ្នកអនុម័ត + តែ `main` ·
   បើក «immutable releases» លើ repo Releases (A152)។
4. 💡 ប្រវត្តិ git មានលេខទូរស័ព្ទដែលមើលទៅពិត (A153) ៖ បើពិត ➜ សម្រេចលុបប្រវត្តិ (`git filter-repo` + GitHub Support) — ខ្ញុំមិនធ្វើ (force-push `main`)។
5. សាក ៖ ស្កេន ZTO · ទាញបញ្ជី ZTO · ការបិទស្វ័យប្រវត្តិ ដំណើរការដូចមុន (URL Function = ZoeW ដដែល) · Push បើក/បិទ · Activate Key ថ្មីលើឧបករណ៍ថ្មី។

### [2.50.92] — 2026-10-16 · ZoeW ៖ **🩺 ពិនិត្យសុខភាព ៖ App ទើបដំឡើង (មិនទាន់កំណត់ Config) ➜ ប្រាប់ផ្លូវភ្ជាប់ទាំង Firebase និង Supabase**

**ZoeW `2.50.92`** (`zoew-v354` ➜ `zoew-v355`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី · ⛔ ឯកសារចាក់សោ មិនប៉ះ — `health-check.ts` · `health-advice.ts` · `guide.html`។
សំណើម្ចាស់គម្រោង ៖ «កែសម្រួលពេល app ទើបតម្លើងថ្មីមិនទាន់បានភ្ជាប់ backend server ណាមួយទេ តែក្នុង ពិនិត្យសុខភាព ប្រាប់តែពីរបៀបភ្ជាប់ firebase
ទាំងដែល app បច្ចុប្បន្ន គាំទ្រ beckend ដល់ទៅ 2» (A148)។

#### អ្វីដែលខុសពីមុន

- 🩺 គ្មាន `zoew_firebase_config` ➜ ជួរ **Server (Firebase · Supabase)** ❌ «មិនទាន់កំណត់ Config — App ភ្ជាប់បាន Server ២ ប្រភេទ» · 💡 ជំហានទី ១ ៖ ☰ ➜ Config / Reconfig ៖
  QR/Setup Link ពីអ្នកលក់ (ស្គាល់ប្រភេទ Server ដោយខ្លួនឯង) ឬបំពេញដោយដៃ ➜ Firebase (Config + Activation Key) · Supabase (Project URL + Publishable key + គណនីហាង/លេខកូដអញ្ជើញ)។
  ជួរអាជ្ញាប័ណ្ណ ➜ ℹ️ «អាស្រ័យលើ Server» (មុន ៖ ❌ «មិនទាន់មាន Activation Key» + 💡 «សុំ Key» ដែលខុសសម្រាប់ហាង Supabase)។
- ប្រភេទ Server ក្នុង 🩺 ដេរីវេពី Config ដែលរក្សាទុក (`healthBackendKind()`) ៖ Config Supabase ដែល SDK មិនទាន់ផ្ទុក ➜ ជួរ «Supabase» + ជួរហាង
  (មុន ៖ `viewState.backendKind` នៅ `firebase` ➜ ជួរ «Firebase» + សុំ Activation Key)។ Config Firebase ➜ ដដែល។

#### អ្នកយាម

- `ZoeW/tests/health-no-backend.test.ts` ៤ (ថ្មី · `runHealthCheck()` ពិត) — មុនកែ ធ្លាក់ ៣ (ទិសផ្ទុយ Config Firebase ជោគជ័យទាំងមុន ទាំងក្រោយ)។
- `health-check-test` ៖ App ទើបដំឡើង (ជួរ Server · ជួរអាជ្ញាប័ណ្ណ ℹ️ · 💡 ជំហានទី ១ រាយ ២ ផ្លូវ) · Config Supabase ក្នុងឃ្លាំង ➜ «Supabase» ➜ ១៩៨/១៩៨។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy ៖ មើល [2.50.93] (កំណែ 2.50.92 មិនចេញ production ដាច់ដោយឡែក)។
1. ឧបករណ៍ថ្មី (ឬ Browser ផ្ទាំង Private) មិនទាន់កំណត់ Config ៖ បោះបង់ផ្ទាំង Config ➜ ☰ ➜ 🩺 ពិនិត្យសុខភាពប្រព័ន្ធ ➜ ជួរ «Server (Firebase · Supabase)» និង 💡 រាយផ្លូវទាំង ២។

### [2.50.91] — 2026-10-16 · ZoeW ៖ **សុវត្ថិភាព ៖ ផ្ទាំង PIN · Activate · ផ្ទាំងផ្សេង ➜ Tab មិនចេញទៅប៊ូតុងទំព័រខាងក្រោយ · តេស្ត flow ឡើងវិញ · Android មិនប្រែ**

**ZoeW `2.50.91`** (`zoew-v353` ➜ `zoew-v354`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី · ⛔ ឯកសារចាក់សោ មិនប៉ះ — `modal-focus-trap.ts` ថ្មី + ១ បន្ទាត់ក្នុង `boot.ts`។
សំណើម្ចាស់គម្រោង ៖ «សូមតេស្ត flow ឡើងវិញដូចរាល់ដង ដែលធ្លាប់តេស្តក្នុង session នេះ ហើយ ពិនិត្យប្រព័ន្ធសុវត្ថិភាពក្រែងក្រោយកែ modal ច្រើនដងអាចបង្ករចន្លោះ អាច bypass pin ឬ activate key ឬ ផ្នែកសុវត្ថិភាពផ្សេងៗ»
(iPhone 2.50.90 ៖ «Ios ជោគជ័យហើយ» · «លែងមានធ្លាក់ឬកន្ត្រាក់ទៀតហើយ»)។

#### អ្វីដែលរកឃើញ (browser ពិត · App ពិត · ការវាយប្រហារ ៧ ផ្លូវ × ផ្ទាំង PIN ៧ · Activate · ចាក់សោ App)

- ✅ ចុចផ្ទៃងងឹត · Escape · ម៉ាស៊ីនស្កេន (+ Enter · + Tab) · PIN ខុស · Key ក្លែង ➜ គ្មានផ្ទាំងគោលដៅបើក · ទិន្នន័យមិនប្រែ · ផ្ទាំង Activate/ចាក់សោ គ្របគ្រប់ចំណុច ·
  បោះបង់ PIN «Reset» ➜ PIN «Config» ត្រូវ ➜ Reset មិនរត់ (គោលដៅចាស់មិននៅ) · គោលដៅក្រោយ PIN មិននៅក្នុង `ACTION_ALLOWLIST` (ក្រៅពី ២ ដែល gate ខ្លួនឯង)។
- 🐛 **Tab** (keyboard កុំព្យូទ័រ · Bluetooth) ពីផ្ទាំង PIN ឬ Activate ➜ focus ទៅ ☰ · 🔔 · «ថ្ងៃនេះ» · កាលបរិច្ឆេទ ខាងក្រោយផ្ទាំង ➜ Enter អាចបើក ☰ ឬចុចប៊ូតុងទំព័រ
  (ចុច/កណ្តុរមិនបាន ៖ ផ្ទាំងគ្របគ្រប់ចំណុច)។ ធ្ងន់បំផុត ៖ Key ត្រូវដកហូតពេលកំពុងប្រើ ➜ ទិន្នន័យនៅលើទំព័រ ➜ អ្នកប្រើ keyboard បន្តប្រើខាងក្រោយផ្ទាំង Activate បាន។
  ផ្ទាំងចាក់សោ App ៖ គ្មាន (ទំព័រ `visibility: hidden`)។ ចាប់ពីពេលណា ៖ ផ្ទាំងទាំងអស់មិនដែលមាន focus trap (មិនមែនមកពីការកែ keyboard ថ្មីៗ)។
- ℹ️ ក្រយៅដៃ ៖ បិទផ្ទាំង PIN ខណៈការស្កេនក្រយៅដៃកំពុងរត់ ➜ ជោគជ័យយឺត ➜ បើក Config (គោលដៅលំនាំដើម) — ផ្ទាំងក្រយៅដៃ OS គ្របពីលើ App ➜ មិនអាចបិទផ្ទាំង PIN បានខណៈនោះ ➜ មិនកែ (គ្មានផ្លូវពិត)។

#### អ្វីដែលខុសពីមុន

- 🔒 ផ្ទាំងបើក ➜ focus នៅក្នុងផ្ទាំងខាងលើបង្អស់ (`listenModalFocusTrap()` · `focusTrapLayer()` ៖ ផ្ទាំងចាក់សោពេល App ចាក់សោ · បើមិនដូច្នោះ ផ្ទាំងខាងលើ) ៖ focus ចេញ ➜ ត្រឡប់ទៅធាតុដំបូង
  (Shift+Tab ➜ ធាតុចុងក្រោយ) ដោយ `preventScroll` · toast នៅប្រើបាន · គ្មានផ្ទាំង ➜ មិនប៉ះ។ Android · iPhone ៖ ចុចដូចមុន (មិនប្រើ Tab)។

#### អ្នកយាម

- `ZoeW/tests/modal-focus-trap.test.ts` ៥ (ថ្មី) — mutation ៤ ➜ ចាប់ ៤។
- `modal-keyboard-test` ៖ `loginModal` · `activationModal` · `pinModal` · `pinSetupModal` ➜ Tab/Shift+Tab ×១៤ ➜ focus នៅក្នុងប្រអប់ · Enter ➜ គ្មានអ្វីខាងក្រោយរត់ (browser ពិត)។
  build មុនការកែ (`boot.ts` គ្មាន `listenModalFocusTrap(scope)`) ➜ ធ្លាក់ ៤ (ផ្ទាំងទាំង ៤) · 2.50.91 ➜ ជោគជ័យ ៥៩។
- `state-hygiene` (CI ផ្នែក ១ ធ្លាក់លើ `7ed6303`) ៖ `tabBackwards` (ទិស Tab ចុងក្រោយ · boolean · គ្មានទិន្នន័យអតិថិជន) ➜ `ACCEPTED` ជាមួយហេតុផល ➜ PASS។
- `fluid-type-focus-test` (CI ផ្នែក ៣ ធ្លាក់លើ `7ed6303`) ៖ App បើក `pinSetupModal` ពេល boot ➜ `#hwScannerInput.focus()` ត្រូវ focus trap ត្រឡប់ចូលផ្ទាំង (ត្រឹមត្រូវ ៖ ប្រអប់ខាងក្រោយផ្ទាំង)
  ➜ checker បិទផ្ទាំងតាម App (`closeModal`) មុនវាស់រង្វង់ (លក្ខខណ្ឌមុន ៖ គ្មានផ្ទាំងបើក · `isModalOpen` = `false`) ហើយបើកវិញក្រោយវាស់ ➜ ៧០/៧០។
- `doc-scope-test` (CI ផ្នែក ៣) ៖ លិបិក្រមរាយ `ios-page-field-raise.test.ts` · `modal-focus-trap.test.ts` ក្នុងផ្នែក ២ តែជួរ A146 · A147 មិនដាក់ឈ្មោះ ➜ ជួរទាំង ២ ដាក់ឈ្មោះអ្នកយាម ➜ PASS
  (រត់ដោយផ្ទាល់គ្មាន `ZOE_REPO_ROOT` ➜ បញ្ជី vitest ទទេ ➜ បៃតងក្លែង ៖ ត្រូវរត់តាម `RUNALL_ONLY`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy ៖ មើល [2.50.93] (កំណែ 2.50.91 មិនចេញ production ដាច់ដោយឡែក)។
1. កុំព្យូទ័រ (keyboard) ៖ បើកផ្ទាំង PIN (ឧ. ☰ ➜ Config) ➜ ចុច Tab ច្រើនដង ➜ focus នៅក្នុងផ្ទាំង (មិនទៅ ☰ ឬប៊ូតុងខាងក្រោយ)។
2. iPhone · Android ៖ ផ្ទាំងទាំងអស់ធ្វើការដូចមុន (ចុចប្រអប់វាយ · ∨/∧ · ផ្ទាំងរអិល)។

### [2.50.90] — 2026-10-16 · ZoeW ៖ **iPhone ស្កេនដក ៖ កន្លែងវាយ Barcode ដែល keyboard នឹងបាំង ➜ ផ្ទាំងស្កេនរអិលឡើងក្នុង `#appPages` (navbar នៅនឹង ដូច Android) · ចុចស្វែងរកពេលកំពុងវាយ ➜ ប្រអប់ស្វែងរកក្រោម navbar · Android មិនប្រែ**

**ZoeW `2.50.90`** (`zoew-v352` ➜ `zoew-v353`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី · ⛔ ឯកសារចាក់សោ មិនប៉ះ — `modal-keyboard.ts` តែប៉ុណ្ណោះ (ប្រើ `beginPanelGlideSnapPause()` · `panelGlideFrom()` ដែលមានស្រាប់)។
វីដេអូម្ចាស់គម្រោង (iPhone · preview 2.50.89) ៖ «Modal pgup/pgdn គ្រាន់បើជាមុនហើយ ក្នុងវិដេអូនេះបង្ហាញទាំងអស់ ដោយលែកតែ tab ស្កេន ក្នុងកន្លែង ស្កេនដកសូមមើក្នុងវិដេអូ
ពេលកំពុងឈfocusនៅកន្លែងវាយបញ្ចូល តែខ្ញុំសាក់ចុចក្នុងប្រអប់ស្វែងរកវាកាន់តែរុញទំព័រទៅលើបាត់ navbar ios មិនជាប់ល្អដូច android សោះ នេះជាចំណុចទើសភ្នែក»។

#### មូលហេតុ (វាស់ពីវីដេអូ ៖ ស៊ុមពេញ ៤៤៤×៩៦០ ➜ pt)

- របៀបដក ៖ កន្លែងវាយ Barcode ចប់ ៤៤៥pt (៥២%) ក្រោម banner ដក · keyboard អង់គ្លេស + របារ ∧∨✓ (iOS 26) ➜ បន្ទាត់ keyboard ដែលធ្លាប់វាស់នៅខាងលើវា ➜ ច្បាប់ចាស់ «keyboard នឹងបាំង ➜ ទុកឲ្យ iOS»
  ➜ iOS រំកិល **document** ១៤៦pt (ប្រអប់នៅកណ្តាល · navbar ចេញពីអេក្រង់) គ្រប់ពេលចុច។ របៀបបញ្ចូល (ប្រអប់ចប់ ៣៨១pt ៖ ចាប់) ➜ មិនរំកិល។
- ចុចប្រអប់ស្វែងរកខណៈនោះ ➜ ផ្ទាំងបង្រួម (ត្រឹមត្រូវ) តែ document នៅរំកិល ១៤៦pt ➜ ប្រអប់ស្វែងរកនៅក្រោមរបាស្ថានភាព (ឃើញក្នុងវីដេអូ ១៥០pt ខ្ពស់ជាងទីតាំងល្អ)។
- Android ៖ WebView បង្រួម ➜ Chromium រំកិល `#appPages` (ធុងរមូរខាងក្នុង) ➜ navbar នៅនឹង។

#### អ្វីដែលខុសពីមុន

- 🐛 iPhone (App លើ Home Screen · ទូរស័ព្ទ < 992px) ៖ ចុចកន្លែងវាយ Barcode ដែល keyboard នឹងបាំង ➜ App ចាប់ (focus({ preventScroll })) ហើយរអិល `#appPages` ឡើង **ត្រឹមតែត្រូវការ**
  (បាតប្រអប់ + ៨ ≤ បន្ទាត់ keyboard ដែលធ្លាប់វាស់) ទន្ទឹមនឹង keyboard ➜ navbar · document នៅនឹង (ដូច Android)។ keyboard ស្ងប់ខ្ពស់ជាងការប៉ាន់ ➜ ក្រោយ
  `IOS_KEYBOARD_SETTLE_MS` លើកបន្ថែម (មិនដែលចុះ)។ ✓ / blur ➜ រអិលចុះវិញត្រឹមចំនួនដែលលើក។ ចុចស្វែងរក ➜ ផ្ទាំងបង្រួមដូចមុន · App មិនរំកិលទៀត ➜ ប្រអប់ស្វែងរកនៅក្រោម navbar។
- snap ៖ `#appPages` មាន `scroll-snap-type: y proximity` ➜ browser ទាញ `scrollTop` ដែល App សរសេរត្រឡប់ ០ ភ្លាម (វាស់ក្នុង Chromium ៖ ១៨ ➜ ០ · ផ្អាក ➜ ១៨ · បើកវិញ ➜ ០)
  ➜ App ផ្អាក snap (`panel-gliding`) ពេលលើក ហើយបើកវិញពេល blur ⛔ មិនទុកលើសពេល blur (PTR ត្រូវការ snap · ពិដាន `PAGE_RAISE_HOLD_MAX_MS`)។
- លើកមិនបាន (ប្រអប់នឹងឡើងក្រោម navbar · ធុងរមូរមិនគ្រប់ · ជិត snap `.page-main` · iPad ផ្តេក ≥ 992px) ➜ ទុកឲ្យ iOS ដូចមុន។ Android ៖ មិនប៉ះ។

#### អ្នកយាម

- `ZoeW/tests/ios-page-field-raise.test.ts` ១៣ (ថ្មី · គំរូ `#appPages` + snap ដូច Chromium) ៖ ចាប់ + លើក ១៩ · ស្លាក · ✓ ចុះវិញ · ស្ងប់ខ្ពស់ ➜ លើកបន្ថែម មិនចុះ ·
  វីដេអូ (ស្វែងរកក្រោយលើក) · snap ត្រឡប់ពេលប្តូរទំព័រ · ផ្ទាំងបើក ➜ ចុះក្រោមផ្ទាំង · ទិសផ្ទុយ ៖ ប្រអប់នៅពីលើ keyboard · ក្រោម navbar · គ្មានចន្លោះ · ជិត snap · Android ·
  ផ្ទាំងបើក — កូដ [2.50.89] FAIL ៥ · mutation ១២ ➜ ចាប់ ១២។
- `modal-keyboard-device-test` (browser ពិត · App ពិត) ផ្នែក ២/៤ (គ) ៖ iPhone SE របៀបដក (ពីមុនជាទិសផ្ទុយ «ទុកឲ្យ iOS») + iPhone 393×852 keyboard ៤២០ ➜ ចាប់ · `#appPages` ឡើង ·
  navbar/document នៅនឹង · ប្រអប់នៅពីលើ keyboard ពិត · ផ្នែក ៤/៤ (ដ ថ្មី) ៖ វីដេអូ ➜ ចុចស្វែងរក ➜ ប្រអប់ស្វែងរកក្រោម navbar · ✓ ➜ ចុះវិញ ០ · ទិសផ្ទុយ Chrome Android ➜ App មិនរំកិល —
  build 2.50.89 FAIL ៨ ➜ ឆ្លងទាំងអស់។ ⚠️ browser មិនក្លែងការរំកិល document របស់ iOS ខ្លួនឯង ➜ អ្នកយាមវាស់ថា App ចាប់ ហើយលើក (ដកមូលហេតុ) · ផ្ទៀងផ្ទាត់លើ iPhone ពិត។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy ៖ មើល [2.50.93] (កំណែ 2.50.90 មិនចេញ production ដាច់ដោយឡែក)។
1. iPhone (App លើ Home Screen) ៖ របៀបស្កេនដក ➜ ចុចកន្លែងវាយ Barcode ➜ navbar នៅនឹង · ផ្ទាំងស្កេនរអិលឡើងបន្តិច · កន្លែងវាយនៅពីលើ keyboard ➜ ចុចប្រអប់ស្វែងរក ➜ ប្រអប់ស្វែងរកនៅក្រោម navbar
   ➜ ✓ ➜ ផ្ទាំងចុះវិញ ➜ ទាញចុះ (PTR) នៅធ្វើការ។ keyboard ខ្មែរ/អង់គ្លេស ទាំងពីរ។ បើ navbar នៅតែចេញ ➜ ផ្ញើវីដេអូ។
2. Android ៖ របៀបដក ➜ ដូចមុន (មិនប្រែ)។

### [2.50.89] — 2026-10-16 · ZoeW ៖ **របា «ZTO មិនទាន់បិទ» រំលឹក ៣ ថ្ងៃ (មិនមែន ១២ ម៉ោង) — កញ្ចប់ដែលចូលធុងសំរាម «យករួច» ក្រោយ ២ ម៉ោង នៅតែរំលឹក**

**ZoeW `2.50.89`** (`zoew-v351` ➜ `zoew-v352`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី។
សំណើម្ចាស់គម្រោង ៖ «បញ្ហាមួយទៀតកញ្ចប់មិនទាន់បិទក្នុង ZTO Palm យូម៉ោងខ្លះមិនបង្ហាញប្រាប់ ក្នុងZoeWបិទតែ ZTO Palm មិនទាន់បិទ ឬមកពីកញ្ចប់នោះចូលធុងសំរាមបន្ទាប់ពី ២ម៉ោង»
➜ សំណួរ «ចង់ឲ្យរបារំលឹករយៈពេលប៉ុន្មាន?» ➜ ម្ចាស់គម្រោងជ្រើស **«៣ ថ្ងៃ»**។
⛔ **តំបន់ចាក់សោ ZTO** ៖ `src/features/zto-status.ts` ប្រែតាមសំណើខាងលើ ➜ sha256 ថ្មីក្នុង `ZoeW/tests/zto-lock.test.ts` `LOCK`
(`968bad53…` ➜ `3e456891…`) · ប្រែតែថេរ ២ (`ZTO_STATUS_TTL_MS` · `ZTO_STATUS_MAX`) · ក្បួនផ្សេងមិនប៉ះ។

#### មូលហេតុ (វាស់ពីកូដ)

- របាអានកញ្ចប់បិទក្នុង `scanHistory` និងធុងសំរាម «យករួច» ត្រឹម `ZTO_STATUS_TTL_MS` = **១២ ម៉ោង** ក្រោយចូលធុង (ការសម្អាត ២ ម៉ោងផ្លាស់កញ្ចប់បិទទៅធុងសំរាម)
  ➜ ≈ **១៤ ម៉ោង** ក្រោយចុចបិទ កញ្ចប់បាត់ពីរបា ទោះ ZTO Palm មិនទាន់បិទ។ សាលក្រម `false` ក្នុង `zoew_zto_pickup_status_v1` ក៏ផុត ១២ ម៉ោង · ទុកបាន ៣០០ ប៉ុណ្ណោះ។
- ✅ ចម្លើយ «ឬមកពីកញ្ចប់នោះចូលធុងសំរាមបន្ទាប់ពី ២ម៉ោង» ៖ **មែន** — ការចូលធុង ២ ម៉ោងមិនដកចេញភ្លាម តែបើក «នាឡិកា ១២ ម៉ោង»។

#### អ្វីដែលខុសពីមុន

- 🟡 ធុងសំរាម «យករួច» រាប់ក្នុងរបា **៣ ថ្ងៃ** ក្រោយចូល · សាលក្រមក្នុងឧបករណ៍រស់ ៣ ថ្ងៃ · `ZTO_STATUS_MAX` ៣០០ ➜ ២០០០ (៣ ថ្ងៃ × ~៤០០ កញ្ចប់/ថ្ងៃ ទុកបានគ្រប់ ➜ បើក App ឡើងវិញ
  មិនសួរ ZTO ម្តងទៀត)។ ការហៅ ZTO ៖ ច្បាប់ដដែល (១ ដង/Barcode · ១០/ជុំ · sign list បិទ `false` ➜ `true` ដោយគ្មាន `/detail`)។
- ⛔ ប្រាក់ · `isDeducted` · ការសម្អាត ២ ម៉ោង/៨ ថ្ងៃ · Firebase ៖ មិនប៉ះ (សាលក្រមនៅក្នុង `localStorage` ប៉ុណ្ណោះ)។
- `guide.html` ៖ ប្រយោគថ្មីក្រោមរបា «ZTO មិនទាន់បិទ» ប្រាប់ «៣ ថ្ងៃ» (ដកពីកូដក្នុងតេស្ត) · ZoeW ពិនិត្យ ZTO តែពេល App បើក។

#### អ្នកយាម

- `ZoeW/tests/zto-remind-days.test.ts` ៥ (ថ្មី) ៖ ព្រំដែន ៣ ថ្ងៃ + `guide.html` ស្មើកូដ · ធុង «យករួច» ១៤ ម៉ោង · ២ ថ្ងៃ · ~៣ ថ្ងៃ + `false` ➜ ក្នុងរបា · លើស ៣ ថ្ងៃ ➜ ចេញ ·
  ទិសផ្ទុយ (លុប · ដក · ផុតកំណត់ · `true` ➜ មិនបង្ហាញ) · សាលក្រម ២ ថ្ងៃមុនរស់ក្រោយ reload · ១២០០ សាលក្រមនៅគ្រប់ — កូដ [2.50.88] FAIL ៤/៥ (ទិសផ្ទុយ PASS ទាំងមុនទាំងក្រោយ)។
- `audit-tools/zto-sync-banner-test.js` ផ្នែក ៣ខ (ធុងចាស់ ៤៨ ម៉ោងថេរ ➜ `ZTO_STATUS_TTL_MS` + ១ ម៉ោង លាក់ · − ១ ម៉ោង នៅលេច) · ផ្នែក ១៤ ៖ ធុងចាស់ «ហួសព្រំដែន» ដកពី `ttl` (មិនមែន ១៣ ម៉ោងថេរ) — run-all STRICT ទី ១ ចាប់បាន ៣ខ ធ្លាក់ ➜ កែ ➜ ២០០ ok · `audit-tools/empty-state-truth-test.js` អាន `ZTO_STATUS_TTL_MS`
  ពីកូដ (`readProductConst()`) ➜ ប្តូរថេរថ្ងៃក្រោយ មិនបង្ខូចអ្នកយាម។
- ZTO vitest ២៤ ឯកសារ ✅ · `zto-lock` ✅ (sha256 ថ្មី)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy ៖ មើល [2.50.93] (កំណែ 2.50.89 មិនចេញ production ដាច់ដោយឡែក)។
1. ZTO ៖ បិទ «យក» កញ្ចប់មួយក្នុង ZoeW ដែល ZTO Palm មិនទាន់បិទ ➜ ក្រោយ ២ ម៉ោង (ចូលធុង «យករួច») ថ្ងៃបន្ទាប់ ➜ របា «ZTO មិនទាន់បិទ» នៅបង្ហាញ ➜ បិទក្នុង ZTO Palm ➜ របាដកចេញ។
2. iPhone ៖ សកម្មភាព ១ របស់ [2.50.87]។

### [2.50.88] — 2026-10-16 · ZoeW ៖ **iPhone SE ៖ keyboard ចាប់ផ្តើមលោត ➜ App មិនទាញទំព័រ (បន្ថែម [2.50.87]) · Android មិនប្រែ**

**ZoeW `2.50.88`** (`zoew-v350` ➜ `zoew-v351`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី · ⛔ ឯកសារចាក់សោ មិនប៉ះ — `modal-keyboard.ts` តែប៉ុណ្ណោះ។
សំណើម្ចាស់គម្រោង ៖ «ពិនិត្យផង» (ពិនិត្យ [2.50.87])។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone SE (keyboard ទាប) ៖ ពេល keyboard ចាប់ផ្តើមលោត iOS អាចប្រាប់កម្ពស់ដំបូង ~៤០% (≈ ១០៤pt < `KEYBOARD_MIN_INSET_PX` ១២០)** ➜ [2.50.87] មិនរាប់ជា keyboard ➜ ការទាញ
  document ទៅ ០ នៅរត់កណ្តាលចលនា។ ឥឡូវ `settleDocumentScroll()` មិនទាញ ពេលប្រអប់វាយកំពុង focus ផងដែរ (keyboard កំពុងមក ឬបង្ហាញ) · blur + keyboard បាត់ ➜ ទាញដូចមុន។

#### អ្នកយាម

- `ZoeW/tests/ios-synthetic-click-focus.test.ts` +១ (សរុប ១២) ៖ ចុចចាប់ ➜ keyboard ១០៤ ➜ មិនទាញ · blur + keyboard ០ ➜ ទាញ — កូដ [2.50.87] FAIL ១ · mutation ២ ➜ ចាប់ ២។
- `modal-keyboard-device-test` ផ្នែក ៤/៤ (ញ · browser ពិត · App ពិត) ៖ iPhone 393 (បញ្ចូល · keyboard ១៣៤ ➜ ២៦៩ ➜ ៤០០ ➜ ៣៣៦) · SE 375 (ដក · ១០៤ ➜ ២០៨ ➜ ២៦០) · Locker ៖ ចុចកន្លែងវាយ
  Barcode ➜ keyboard លោត ➜ `window.scrollTo` ០ ដង · keyboard បាត់ ➜ ១ · ទិសផ្ទុយ Chrome Android ➜ ១ (ដូចមុន) — build 2.50.86 FAIL ៣ (`scrollTo` ៨ · ៣ · ២ ដង ពេល keyboard លោត) ➜ ១៧/១៧។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy ៖ មើល [2.50.93] (កំណែ 2.50.88 មិនចេញ production ដាច់ដោយឡែក)។
1. iPhone ៖ សកម្មភាព ១ របស់ [2.50.87] (រួមទាំង iPhone SE បើមាន)។

### [2.50.87] — 2026-10-16 · ZoeW ៖ **iPhone ៖ «បង្ការ មិនតទល់» — App លែងទាញទំព័រត្រឡប់ពេល keyboard លោត · សម្អាតកូដ iOS · Android មិនប្រែ**

**ZoeW `2.50.87`** (`zoew-v349` ➜ `zoew-v350`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `chrome-autohide.ts` ·
`phone-search.ts` · `app.css` · ZTO) មិនប៉ះ — ការកែក្នុង `modal-keyboard.ts` និង `boot.ts` តែប៉ុណ្ណោះ។
សំណើម្ចាស់គម្រោង ៖ «Preview commit ថ្មីនៅតែធ្លាក់ទំព័រដដែល» (2.50.86) · «សូមសម្រួល iOS អោយត្រឹមត្រូវ clean up កូដមុនមុន សរសេថ្មីមក អោយឆ្លាតវៃ ដូច android ទៅ»។
«ដូច Android ពិតៗ» (`interactive-widget=resizes-content` ៖ ផ្ទៃ App បង្រួមពេល keyboard បើក) មានក្នុងប្រភព WebKit តែ Safari/iOS មិនទាន់ចេញ ➜ iOS រក្សា keyboard គ្របពីលើ ហើយប្រើក្បួនមួយ (ផ្នែក ២ A144)។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័រលោតចុះ ហើយរអិលត្រឡប់** (2.50.86 នៅតែមាន)។ ទំព័រលោតចុះក្រោមកម្ពស់ធម្មតាបាន លុះត្រា App ទាញ document ទៅ ០ ពេល keyboard
  កំពុងលោត (UIKit រំកិលបន្ថែម ៖ A47 · A143) ៖ App មានការទាញនោះ ២ កន្លែង — `boot.ts` (រាល់ visualViewport `resize` គ្រប់ឧបករណ៍ តាំងពីសម័យមុន) និង `restorePageFieldScroll()` (2.50.83)។
  ឥឡូវ iOS standalone ៖ ពេល keyboard បង្ហាញ App មិនសរសេរ scroll របស់ document ទាល់តែសោះ (`settleDocumentScroll()` ៖ ទាញ ០ តែពេល keyboard បាត់) · `restorePageFieldScroll()` ដកចេញ ·
  App នៅជាអ្នក focus (ចុចដែលចាប់ · ចុចសំយោគ · ∨/∧) ដើម្បីកុំឲ្យ iOS រំកិល។ ប្រសិនបើ iOS នៅរំកិលតាមផ្លូវផ្សេង ➜ ឃើញទំព័ររអិលឡើងរលូនជាមួយ keyboard (មិនលោតចុះ) ➜ ផ្ញើវីដេអូ។
- 🧹 **សម្អាត** ៖ ដក probe Sentry `iosPageTap` (រង្វាស់បណ្តោះអាសន្ន ៖ preview មិនផ្ញើ · មូលហេតុរកឃើញពីវីដេអូ) · ដក `pageFieldCaught` · `forgetPageFieldCaught()` — កូដ iOS ៖ ចុចចាប់ · ចុចសំយោគ ·
  ∨/∧ · ផ្ទាំងរអិលតែម្តង · `settleDocumentScroll()`។ Android · iOS Safari (មិនមែន standalone) ៖ ការទាញលើ visualViewport `resize` ដូចមុន។

#### អ្នកយាម

- `ZoeW/tests/ios-synthetic-click-focus.test.ts` +៣ (សរុប ១១) ៖ ចុចចាប់ ➜ document រំកិល ➜ មិនទាញ · visualViewport `resize` ៖ keyboard លោត ➜ មិនទាញ · keyboard បាត់ ➜ ទាញ ·
  Safari browser · Android ➜ ទាញដូចមុន · boot ចង `settleDocumentScroll` — កូដ [2.50.86] FAIL ៣ · mutation ៣ ➜ ចាប់ ៣ · `ZoeW/tests/ios-page-tap-probe.test.ts` ដកចេញ (probe · ការទាញ ដកចេញ)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy ៖ មើល [2.50.93] (កំណែ 2.50.87 មិនចេញ production ដាច់ដោយឡែក)។
1. **iPhone** ៖ ទំព័រស្កេន ៖ ចុចកន្លែងវាយ Barcode ច្រើនដង (របៀបបញ្ចូល · ដក · Locker · ក្រោយស្វែងរក · ក្រោយប្តូររបៀប · ក្រោយ Done) ➜ ទំព័រមិនលោតចុះ។ បើទំព័ររអិលឡើងជាមួយ keyboard ➜
   ផ្ញើវីដេអូ។ សកម្មភាពរបស់ [2.50.84] · [2.50.85] នៅដដែល។

### [2.50.86] — 2026-10-16 · ZoeW ៖ **iPhone ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័រមិនលោតចុះ (ចុចសំយោគ WebKit មិនលុប preventScroll) · Android មិនប្រែ**

**ZoeW `2.50.86`** (`zoew-v348` ➜ `zoew-v349`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `chrome-autohide.ts` ·
`phone-search.ts` · `app.css` · ZTO) មិនប៉ះ — ការកែក្នុង `modal-keyboard.ts` តែប៉ុណ្ណោះ (ផ្លូវ iOS standalone · `usesIOSPanelHandoff()`)។
វីដេអូម្ចាស់គម្រោង (preview 2.50.85 · App លើ Home Screen · គ្មានអត្ថបទ) ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័រ (navbar រួម) លោតចុះ ហើយរអិលត្រឡប់ ៣ ដងក្នុង ២៥ វិនាទី (ផ្នែក ២ A143)។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័រលោតចុះ ហើយរអិលត្រឡប់**។ App ចាប់ការចុច (`preventScroll`) ប៉ុន្តែ WebKit នៅតែអាចផ្ញើ «ចុចសំយោគ» (`mousedown` · `click`) ពេល
  វាមិនអាចការពារព្រឹត្តិការណ៍ touch (ឧ. ចុចភ្លាមក្រោយទំព័ររអិល · ក្រោយប្តូររបៀប) ➜ focus ប្រអប់ម្តងទៀតដោយគ្មាន `preventScroll` មុន keyboard បង្ហាញ ➜ iOS រំកិលដាក់ប្រអប់នៅកណ្តាល ➜
  App ទាញត្រឡប់ ០ ខណៈចលនា keyboard នៅរត់ ➜ ទំព័រលោតចុះ។ ឥឡូវ App បោះចោល `mousedown` · `click` នៃការចុចដែលបានចាប់ (`CAUGHT_CLICK_MS` · លើប្រអប់ ឬស្លាក/⚡ របស់វាតែប៉ុណ្ណោះ ·
  ការប៉ះថ្មីបញ្ចប់) ➜ iOS មិនរំកិល។ ប្រអប់ដែល App ចាប់ blur ហើយ ➜ App លែងទាញ document ត្រឡប់ (focus ក្រោយដែល iOS បង្ហាញខ្លួនឯង រអិលរលូនជាមួយ keyboard)។

#### អ្នកយាម

- `ZoeW/tests/ios-synthetic-click-focus.test.ts` ៩ (ច្បាប់ WebKit ក្លែង ៖ focus/refocus ពេល keyboard មិនទាន់បង្ហាញ ➜ ការចុងក្រោយឈ្នះ · ចុចសំយោគ ៖ `mousedown` focus ប្រអប់ · `click` ស្លាក
  focus ប្រអប់ដែលភ្ជាប់) ៖ កន្លែងវាយ Barcode · ស្លាក · ប្រអប់ក្នុងផ្ទាំង ➜ preventScroll នៅ · ទិសផ្ទុយ ៖ ប្រអប់ក្រោយ keyboard (iOS បង្ហាញ) · Android · ក្រោយពេលកំណត់ · ការប៉ះថ្មី ·
  ប៊ូតុង submit (iPad + mouse) · ចុចប្រអប់ដែល focus រួច (Paste) ➜ មិនប៉ះ · ទង់ចាស់ ៖ blur ➜ focus ក្រោយ ➜ មិនទាញ — កូដ [2.50.85] FAIL ៥ ➜ ៩/៩ · mutation ១០ ➜ ចាប់ ១០។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy ៖ មើល [2.50.93] (កំណែ 2.50.86 មិនចេញ production ដាច់ដោយឡែក)។
1. **iPhone** ៖ ទំព័រស្កេន ៖ ចុចកន្លែងវាយ Barcode ច្រើនដង (របៀបបញ្ចូល · ដក · Locker · ក្រោយស្វែងរក · ក្រោយប្តូររបៀប · ក្រោយចុច Done) ➜ ទំព័រ និង navbar នៅនឹងកន្លែង។
   សកម្មភាព ១–៤ របស់ [2.50.84] និង ១ របស់ [2.50.85] នៅដដែល។

### [2.50.85] — 2026-10-16 · ZoeW ៖ **iPhone ៖ ពីប្រអប់វាយទៅប្រអប់ជ្រើស ឬថ្ងៃខែក្នុងផ្ទាំង ➜ ផ្ទាំងនៅពីលើកង់ជ្រើស · ∨/∧ ទៅប្រអប់ទាំងនោះ ➜ ទំព័រនៅនឹង · Android មិនប្រែ**

**ZoeW `2.50.85`** (`zoew-v347` ➜ `zoew-v348`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `chrome-autohide.ts` ·
`phone-search.ts` · `app.css` · ZTO) មិនប៉ះ — ការកែក្នុង `modal-keyboard.ts` តែប៉ុណ្ណោះ (ផ្លូវ iOS · `isAndroidDevice()` ➜ ចេញមុន)។ ការពិនិត្យកូដ [2.50.84] ផ្ទាល់ (A142)។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone ៖ ពីប្រអប់វាយទៅប្រអប់ជ្រើស (select) ឬថ្ងៃខែ (date) ក្នុងផ្ទាំង ➜ ផ្ទាំងធ្លាក់ចុះក្រោមកង់ជ្រើស**។ [2.50.84] គិតថា focus ចាកចេញពីប្រអប់វាយទៅធាតុដែលមិនមែនប្រអប់វាយ = keyboard
  កំពុងបិទ ➜ ផ្ទាំងរអិលចុះ ខណៈ iPhone បង្ហាញកង់ជ្រើសនៅកន្លែង keyboard ➜ ផ្ទាំងនៅក្រោយកង់។ ឥឡូវ select · date/time = ធាតុដែលមានកង់ជ្រើស (`inputViewField()`) ៖ focus ទៅទីនោះ ➜ ផ្ទាំងនៅលើ ·
  ចាកចេញទៅគ្មានអ្វី (Done) ➜ រអិលចុះតែម្តង · focus ទៅធាតុនោះម្តងទៀតពេលកំពុងចុះ ➜ ឈប់ចុះ ហើយវាស់ភ្លាម · checkbox/ប៊ូតុង (keyboard បិទពិត) ➜ ចុះដូចមុន។
- 🐛 **iPhone ៖ ∨/∧ ទៅប្រអប់ជ្រើស ឬថ្ងៃខែ ➜ ទំព័រលោត** (ផ្លូវ WebKit ដូច A139 ៖ `nextAssistableElement` រាប់ select)។ ឥឡូវ focus ឡើងវិញដោយ `preventScroll` ក្នុងព្រឹត្តិការណ៍ `focus` ដូចប្រអប់វាយ
  (ក្នុងផ្ទាំង · ទំព័រ ៖ ពីលើ keyboard ប៉ុណ្ណោះ)។

#### អ្នកយាម

- `ZoeW/tests/modal-keyboard.test.tsx` ៖ ប្រអប់វាយ ➜ select ➜ ផ្ទាំងនៅ (៥០៨ · ក្នុង focusout ក៏ ៥០៨ ៖ គ្មានចុះ-ឡើង) · កង់ ២៦០ ➜ ៥៨៤ · Done ➜ ០ ភ្លាម ទោះ keyboard ប្រាប់ ១២០ · focus select ពេលចុះ ➜ ៧២៤ ភ្លាម · date ➜ នៅ · checkbox ➜ ០ ·
  `ZoeW/tests/ios-accessory-focus.test.ts` ៖ ∨ ប្រអប់វាយ ➜ select ➜ date ➜ select ➜ ∧ ប្រអប់វាយ ➜ preventScroll រាល់ការប្តូរ · focus ម្តង (គំរូ WebKit ប្រៀបធៀបតាម id ៖ happy-dom ក្តោប `<select>` ដោយ Proxy)
  — កូដ [2.50.84] FAIL ២ ➜ ៥៥/៥៥ · mutation ៧ (`inputViewField` ↔ `textEntryField` ក្នុង ∨ · blur (ធាតុចាកចេញ · ធាតុទៅ) · focus · select ➜ null · ប្រភេទថ្ងៃខែ · មិនវាស់ពេលឈប់ចុះ) ➜ ចាប់ ៧។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy ៖ មើល [2.50.93] (កំណែ 2.50.85 មិនចេញ production ដាច់ដោយឡែក)។
1. **iPhone** ៖ ផ្ទាំងដែលមានប្រអប់វាយ និងប្រអប់ជ្រើស (ឧ. នាំចូល Excel ទៅ Sheet) ➜ ចុចប្រអប់វាយ ➜ ចុចប្រអប់ជ្រើស (ឬ ∨) ➜ ផ្ទាំងនៅពីលើកង់ · Done ➜ ចុះតែម្តង។ សកម្មភាព ១–៤ របស់ [2.50.84] នៅដដែល។

### [2.50.84] — 2026-10-16 · ZoeW ៖ **iPhone ៖ ផ្ទាំងរអិលតាម keyboard តែម្តង · ចុច ∨/∧ (ប្រអប់បន្ទាប់/មុន) ទំព័រនៅនឹងកន្លែង · Android មិនប្រែ**

**ZoeW `2.50.84`** (`zoew-v346` ➜ `zoew-v347`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `chrome-autohide.ts` ·
`phone-search.ts` · `app.css` · ZTO) មិនប៉ះ — ការកែក្នុង `modal-keyboard.ts` តែប៉ុណ្ណោះ។
សំណើម្ចាស់គម្រោង (preview 2.50.83 · App លើ Home Screen) ៖ «iphone ផ្ទាំងលែងកន្ត្រាក់ តែ កន្លែងវាយbarcode នៅលោតទំព័រម្តងម្កាលដដែល និង ពេលចុចសញ្ញា ចុះមកប្រអប់បន្ទាប់របស់ keybaord
PgUp/PgDn លោតទំព័រ» (ចម្លើយ ៖ ទំព័រស្កេន (Barcode) · ផ្ទាំងលេខទូរស័ព្ទ/COD · ផ្ទាំងផ្សេង) · «ចុះios មិនអាចដាក់ចលនា រអិលដូច android បានទេឬ?» ➜ Android (APK · Chrome) មិនប្រែ ៖
ផ្លូវ Android ទាំងអស់ដដែល (`isAndroidDevice()` ➜ `modalKeyboardViewport()` · `usesIOSPanelHandoff()`) · `modal-keyboard-device-test` ផ្នែក ១–៣ Android ជាប់ដូចដើម · ∨/∧ Chrome Android ➜ App មិនប៉ះ។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone ៖ ចុច ∨/∧ លើ keyboard ➜ ទំព័រលោត** (ផ្នែក ២ A139)។ WebKit ប្តូរប្រអប់ដោយ `focus()` គ្មាន `preventScroll` ហើយ iPhone រំកិលទំព័រជានិច្ច (ទោះប្រអប់មើលឃើញ) ➜ App ទាញត្រឡប់។
  ឥឡូវ App focus ប្រអប់ថ្មីឡើងវិញដោយ `preventScroll` **ក្នុងព្រឹត្តិការណ៍ `focus`** (មុន WebKit ផ្ញើព័ត៌មាន focus) ➜ ទំព័រ · navbar នៅនឹងកន្លែង ៖ ផ្ទាំងទាំងអស់ · ទំព័រស្កេន
  (កន្លែងវាយ Barcode ⇄ ស្វែងរកក្នុងបញ្ជី) · ប្រអប់ដែល keyboard នឹងបាំង (ស្វែងរកពេលកាមេរ៉ាបើក) ➜ iOS បង្ហាញដដែល។
- ✨ **iPhone ៖ ផ្ទាំងរអិលតាម keyboard** (ផ្នែក ២ A140)។ ចុចប្រអប់វាយ ➜ ផ្ទាំងរអិលតែម្តងទៅកន្លែងចុងក្រោយ ទន្ទឹមនឹង keyboard (កម្ពស់ keyboard ដែលចាំពីមុន) · កម្ពស់ចន្លោះដែល iOS ប្រាប់ពេល
  keyboard កំពុងលោត (លោតហួស · កើនបន្តិចម្តងៗ) ត្រូវរំលង · keyboard ស្ងប់ (`IOS_KEYBOARD_SETTLE_MS`) ➜ កម្ពស់ពិត (រអិលម្តងទៀតតែពេលខុសពីការចាំ) · Done ➜ រអិលចុះតែម្តង ·
  ∨ ទៅ keyboard ប្រភេទផ្សេង (លេខ ➜ អក្សរ) ➜ រអិលតែម្តង · ចុច ហើយ keyboard មិនលោត (iPad + keyboard ពិត) ➜ ត្រឡប់ម្តង ហើយលែងរំពឹង។ លើកដំបូង (មិនទាន់ចាំ) ➜ កម្ពស់ដំបូងដែល iOS ប្រាប់។
- 🔬 **iPhone ៖ កន្លែងវាយ Barcode នៅលោតម្តងម្កាល** (ផ្នែក ២ A141)។ preview មិនផ្ញើ Sentry (គ្មានព្រឹត្តិការណ៍ preview ក្នុង ៣០ ថ្ងៃ · Sentry មិនបោះចោលអ្វីនៅ server) ➜ ការសាក
  លើ preview គ្មានទិន្នន័យ។ `iosPageTap` បន្ថែមលេខ ៖ `afterMs` (ពេលពីលែងដៃ) · `viewportHeight` (keyboard ពេលនោះ) · `docHeight` · `stillFocused` ➜ ទិន្នន័យពី production ក្រោយ merge។

#### អ្នកយាម

- `ZoeW/tests/ios-accessory-focus.test.ts` ៧ (ច្បាប់ focus WebKit ក្លែង ៖ ព័ត៌មាន focus = ការជូនដំណឹងដំបូង · ផ្ទាំងលេខទូរស័ព្ទ/COD ៦ ការប្តូរ ➜ preventScroll · focus ម្តង · caret ដដែល ·
  ទំព័រស្កេនទាំងពីរទិស · ទិសផ្ទុយ ៖ គ្មាន keyboard · ចុចដែល App មិនចាប់ · ម្រាមដៃនៅលើអេក្រង់ · ស្វែងរកក្រោយ keyboard ពេលកាមេរ៉ា · កន្លែងវាយ Barcode ក្រោយ keyboard · Android ·
  checkbox/ប៊ូតុង) — កូដមុនកែ FAIL ២ ➜ ៧/៧ · mutation លក្ខខណ្ឌនីមួយៗ ៧ ➜ ចាប់ ៧។
- `modal-keyboard-device-test` ផ្នែក ៤/៤ (ថ្មី) ៖ (ឈ) iPhone 393×852 · SE 375×667 ៖ ១៧ ផ្ទាំង ➜ ចុច (ការចុចពិត) + keyboard ប្រាប់ (លោតហួស +៦៤ ➜ ស្ងប់ · កើន ៤០% ➜ ៨០% ➜ ១០០%) ➜
  រអិលតែម្តង (គ្មានត្រឡប់ · គ្មានហួស) · ស្ងប់ ➜ មិនផ្លាស់ទី · Done + កម្ពស់ចន្លោះពេលចុះ ➜ រអិលចុះតែម្តង · ∨ លេខ ➜ អក្សរ ➜ តែម្តង · keyboard មិនលោត ➜ ត្រឡប់ម្តង ហើយលែងរំពឹង ·
  (ជ) ∨/∧ ៧ ផ្ទាំង × ៣០ ដង + ទំព័រស្កេន ➜ preventScroll · Chrome Android ➜ មិនប៉ះ — build 2.50.83 FAIL ៥ · build «រអិលតាមកម្ពស់នីមួយៗ» (2.50.82) FAIL ១–២ · ដក `iosForecastMissed` FAIL ២ ➜ ១៣/១៣ ·
  (ឆ) iPhone · iPad ➜ រអិល (ដូច Android) ១៨/១៨ · `ZoeW/tests/modal-keyboard.test.tsx` ៖ កម្ពស់ប្តូរ ➜ ទីតាំងដើមរក្សា · កម្ពស់ថ្មីក្រោយ `IOS_KEYBOARD_SETTLE_MS` ·
  `ZoeW/tests/ios-page-tap-probe.test.ts` ៖ លេខថ្មី (`afterMs` · `viewportHeight` · `docHeight` · `stillFocused`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy ៖ មើល [2.50.93] (កំណែ 2.50.84 មិនចេញ production ដាច់ដោយឡែក)។
1. **iPhone ៖ ∨/∧** ៖ ផ្ទាំងលេខទូរស័ព្ទ/COD · ផ្ទាំងផ្សេង · ទំព័រស្កេន (កន្លែងវាយ Barcode ➜ ∨) ➜ ទំព័រ និង navbar នៅនឹងកន្លែង។
2. **iPhone ៖ ចលនា** ៖ ប៉ះកន្លែងវាយក្នុងផ្ទាំង (PIN · បញ្ចូលច្រើន · កែលេខទូរស័ព្ទ) ➜ ផ្ទាំងរអិលតែម្តងទន្ទឹមនឹង keyboard · Done ➜ រអិលចុះ។ លើកដំបូងក្រោយដំឡើងអាចរអិលពីរដង (App មិនទាន់ចាំ
   កម្ពស់ keyboard) ➜ លើកទីពីរត្រូវរអិលតែម្តង។ បើនៅកន្ត្រាក់ ➜ ប្រាប់ផ្ទាំងណា ➜ ត្រឡប់ទៅ «ភ្លាម» បាន។
3. **iPhone ៖ កន្លែងវាយ Barcode** ៖ preview មិនផ្ញើ Sentry ➜ បើចង់បានទិន្នន័យពី preview ៖ Sentry ➜ Settings ➜ Projects ➜ `javascript-react` ➜ Allowed Domains (បន្ថែម `*.netlify.app`) ·
   បើមិនដូច្នោះ ទិន្នន័យមកក្រោយ merge (`iosPageTap …`)។
4. **Android** ៖ គ្មានអ្វីត្រូវសាក (កូដ Android ដដែល)។

### [2.50.83] — 2026-10-16 · ZoeW ៖ **iPhone ៖ ផ្ទាំងទៅកន្លែងភ្លាមពេល keyboard លោត (មិនកន្ត្រាក់) · ចុចកន្លែងវាយ Barcode ទំព័រនៅនឹងកន្លែង · Android មិនប្រែ**

**ZoeW `2.50.83`** (`zoew-v345` ➜ `zoew-v346`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration · Android native ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `chrome-autohide.ts` ·
`phone-search.ts` · `app.css` · ZTO) មិនប៉ះ — ការកែក្នុង `modal-keyboard.ts` តែប៉ុណ្ណោះ។
សំណើម្ចាស់គម្រោង ៖ «iphone ធ្លាក់ទំព័រម្តងហើយ មើល Sentry ផង និង modal ក៏កន្ត្រាក់ដែរ មុន merge មិនអីផង» (ចម្លើយ ៖ iPhone · ពេល keyboard លោតឡើង) · «modal ios មុន merge អត់អីទេ» ·
«android ដំណើរការ ត្រឹមត្រូវហើយ គ្មានកន្ត្រាក់ គ្រប់យ៉ាងរលូន សូមការពារកែ ios កុំអោយ android ប្រែ» ➜ Android (APK · Chrome) មិនប្រែមួយបន្ទាត់ (`isAndroidDevice()` ·
`usesIOSPanelHandoff()`) ៖ `modal-keyboard-device-test` (ក) (ក២) (ឆ) Android ជាប់ដូចដើម។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone · iPad ៖ ផ្ទាំងកន្ត្រាក់ពេល keyboard លោតឡើង** (ផ្នែក ២ A136)។ ចលនារអិល [2.50.82] (`glideModalCard()`) ចាប់ផ្តើមម្តងហើយម្តងទៀត ពេល keyboard iOS ប្រាប់កម្ពស់ច្រើនដងពេលលោត
  (លោតហួស ហើយស្ងប់) ➜ កាតឡើង ចុះ។ ឥឡូវ ចលនាតែលើ Android ៖ iOS ➜ កាតទៅទីតាំងត្រូវភ្លាមដូចមុន [2.50.82] (ទីតាំង · ការវាស់ · ការចាប់ការចុច ដដែល)។
- 🐛 **iPhone ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័រធ្លាក់ម្តងម្កាល** (ផ្នែក ២ A137 ៖ Sentry `iosPageTap caught document`)។ ការចុចត្រូវចាប់ (`focus({ preventScroll })`) ប៉ុន្តែ WebKit
  នៅរំកិល document ២៣០px (visual viewport ២៧៧) ពេល keyboard លោត។ ឥឡូវ ក្រោយការចុចដែលចាប់បាន (`pageFieldCaught`) ខណៈប្រអប់នៅ focus ៖ document រំកិលដោយគ្មានម្រាមដៃ ➜ ត្រឡប់ ០
  (`restorePageFieldScroll()` ➜ `scrollWindowToTop()` ដូចប្រអប់ស្វែងរក · ផ្ទាំង) · keyboard នឹងបាំងប្រអប់ (មិនចាប់) ➜ iOS បង្ហាញដដែល · blur · ផ្ទាំងបើក · Android ➜ មិនប៉ះ។
  ឧបករណ៍វាស់ `iosPageTap` នៅដដែល ➜ បើនៅធ្លាក់ Sentry ប្រាប់ផ្លូវម្តងទៀត។

#### អ្នកយាម

- `ZoeW/tests/ios-page-tap-probe.test.ts` +២ (ចាប់ ➜ document ២៣០ · visual viewport scroll ➜ `scrollTo(0, 0)` · នៅ focus · ០ ➜ មិនហៅទៀត · ទិសផ្ទុយ ៖ keyboard បាំង (មិនចាប់) · blur ·
  ផ្ទាំងបើក · Android ➜ មិនប៉ះ) — កូដមុនកែ FAIL ១ ➜ ៦/៦ · `modal-keyboard-device-test` (ឆ) ៖ iPhone · iPad ➜ ភ្លាម (១ ជំហាន · គ្មានស៊ុមកណ្តាល · គ្មានចលនានៅសល់) · Android
  APK ២ · Chrome ➜ រអិលដូចដើម · «បន្ថយចលនា» ផ្លាស់ទៅ Chrome Android · ការប្តូរកម្ពស់កណ្តាលចលនា ៖ Android តែប៉ុណ្ណោះ — build `2dfaa9c` FAIL ៣ (iPhone · iPad · iPhone មាតិកា) ➜ ១៧/១៧។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ) ➜ APK ថ្មី `zoew-android-v2.50.83` (workflow `main` · កូដ Android ដដែល)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone ៖ ផ្ទាំង** ៖ បើក «បញ្ចូលច្រើន» · «កែលេខទូរស័ព្ទ» · ផ្ទាំង PIN ➜ ប៉ះកន្លែងវាយ ➜ keyboard លោត ➜ ផ្ទាំងទៅកន្លែងតែម្តង មិនកន្ត្រាក់ (ដូចមុន 2.50.82)។
2. **iPhone ៖ កន្លែងវាយ Barcode** ៖ ស្កេនធម្មតា (ចុចកន្លែងវាយ · ស្លាក · ⚡ · គ្រប់របៀប) ➜ ទំព័រនៅនឹងកន្លែង។ បើនៅធ្លាក់ ➜ ប្រាប់ម៉ោង ➜ ខ្ញុំអាន Sentry (`iosPageTap …`)។
3. **Android** ៖ គ្មានអ្វីត្រូវសាក (កូដ Android ដដែល · ផ្ទាំងនៅរអិលដូចដើម)។

### [2.50.82] — 2026-10-15 · ZoeW ៖ **ផ្ទាំងរអិលតាម keyboard (App ទាំងមូល) · Android ៖ ចាំកម្ពស់ keyboard ពិត (keyboard ណាក៏បាន · ពង្រីកទំហំ) ➜ ផ្ទាំង keyboard លេខឡើងតែម្តង · ទូរស័ព្ទនៅបញ្ឈរ tablet បង្វិលបាន · iPhone ៖ ចុចស្លាក «ស្កេន Barcode…» · ⚡ ទំព័រមិនធ្លាក់ · ពង្រីកអេក្រង់ (zoom) មិនមែន keyboard**

**ZoeW `2.50.82`** (`zoew-v344` ➜ `zoew-v345`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · Android native ៖ `MainActivity.java` (ទិសអេក្រង់) ➜ APK ថ្មី ·
⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `chrome-autohide.ts` · `phone-search.ts` · `app.css` · ZTO) មិនប៉ះ — ការកែក្នុង `modal-keyboard.ts` · `ios-viewport.ts` · `refs.ts` ·
`platform/orientation.ts` · `boot.ts`។
សំណើម្ចាស់គម្រោង ៖ «ពិនិតមើល ការវាស់ keyboard ដោយស្វ័យប្រវត្តិឆ្លាតវៃ មើលមានចន្លោះឬកំហុសអត់» · «android ដំណើរការរលូនល្អហើយគ្មានកំហុស មិនថាប្តូរទៅ ភាសាខ្មែរ ឬ អង់គ្លេស» ·
«តែ ios ដូចនៅទាញទំព័រម្តងម្កាល ក្នុង tab ស្កេន» (ចម្លើយ ៖ ចុចកន្លែងវាយ Barcode · កញ្ចប់ · Locker · ដក · មិនប្រាកដ) · «សូមកុំកែអោយប៉ះពាល់ដល់android ព្រោះandroid ដំណើរការត្រឹមត្រូវហើយ» ·
បន្ទាប់មក ៖ «android ដូចខ្វះការវាស់ keybaord ពេលវាលោតតែលេខ មិនមែន អក្សរ ដូច modal កែលេខទូរស័ព្ទ កែទឹកប្រាក់ … មានកន្ត្រាក់ពេលបើកmodal ទាំងនោះ» (ចម្លើយ ៖ APK · Chrome / PWA ·
keyboard បិទមុន · «លោតឡើង ហើយត្រឡប់ចុះ» · វីដេអូ · «ក្រៅពីហ្នឹង រលូនគ្រប់យ៉ាង») · «សូមធ្វើអោយវឆ្លាតវៃចេះវាស់ keyboard ដោយខ្លួនឯងបាន ស្វ័យប្រវត្តិ មិនថាគេប្រើ keybaord
thirdparty ឬគេពង្រីកទំហំ keybaord» · «ហើយ lock កុំអោយផ្តេកបានលើទូរស័ព្ទ ទាំងអស់ តែសម្រាប់ tablet អោយផ្តេកបាន» · «android apk លែងអីហើយ តែថែម animation សម្រាប់modal
ពេលលោតតាម keybaord ក្នុងappទាំងមូលផង»។ ➜ Android ប្តូរតែករណីទាំងនេះ ៖ ផ្ទាំង keyboard ដែលធ្លាប់ចុះវិញ · ការចាំកម្ពស់ · ទិសអេក្រង់ទូរស័ព្ទ · ចលនា (ទីតាំងចុងក្រោយនៅដដែល ៖
`modal-keyboard-device-test` (ក) ៥ APK + ២ Chrome ជាប់ដដែល)។

#### អ្វីដែលខុសពីមុន

- ✨ **ផ្ទាំងរអិលតាម keyboard (App ទាំងមូល)** (ផ្នែក ២ A134)។ ផ្ទាំងដែលត្រូវផ្លាស់ទីព្រោះ keyboard (iPhone · iPad · APK · Chrome/PWA) លោតភ្លាមមួយស៊ុម ➜ ឥឡូវ កាតរអិលពីកន្លែងដែល
  មើលឃើញទៅកន្លែងថ្មី (`glideModalCard()` ៖ `transform` តាម Web Animations · `composite: 'add'` · `MODAL_GLIDE_MS` ២៥០ · easeOutCubic ៖ GPU គូរ · គ្មាន layout ក្នុងស៊ុម) ពេល keyboard បើក ·
  បិទ · ប្តូរកម្ពស់កណ្តាលចលនា (បន្តពីទីតាំងបច្ចុប្បន្ន) · APK ៖ WebView ធំឡើងពេល keyboard បិទ (`ResizeObserver` លើ `.modal` ៖ ទីតាំងចាស់ = `modalRest`) · ទីតាំងចុងក្រោយ · ការវាស់ ·
  ការរំកិលប្រអប់វាយ ដូចដើម (ការវាស់មិនរាប់ `transform`)។ ⛔ ភ្លាមដូចដើម ៖ visual viewport រំកិល (កាតនៅនឹងលើអេក្រង់) · មាតិកាប្រអប់ប្តូរទំហំ · បង្វិល · iPhone/កុំព្យូទ័រ viewport
  ប្តូរ (មិនមែន keyboard) · «បន្ថយចលនា» (`prefers-reduced-motion`) · ⛔ `.modal` មិនផ្លាស់ទី។
- 🔬 **iPhone ៖ វាស់ពេលទំព័រធ្លាក់ក្រោយចុចកន្លែងវាយ Barcode** (ផ្នែក ២ A135 ៖ «ម្តងម្កាល» · Chromium គ្មាន WebKit ➜ វាស់នៅទីនេះមិនបាន)។ iOS standalone ៖ ចុចកន្លែងវាយ Barcode ·
  ស្លាក · ⚡ (គ្មានប្រអប់បើក) ➜ កត់ផ្លូវ (`caught` · `moved` · `slow` · `focused-tapped` · `focused-keyboard` · `covered` · `refused` · `multi` · `uncancelable`) + លេខ
  (dx · dy · ms · ទីតាំងប្រអប់ · keyboard ដែលចាំ · focus) ➜ ក្នុង `PAGE_TAP_PROBE_MS` ក្រោយលែងដៃ ដោយគ្មានម្រាមដៃលើអេក្រង់ ៖ document · visual viewport · `#appPages` រំកិល ➜ Sentry
  ម្តង/ផ្លូវ/ទំព័រ (`zone: 'ui'` · `context: 'iosPageTap <ផ្លូវ> <អ្វីរំកិល>'` · លេខតែប៉ុណ្ណោះ ⛔ មិនផ្ញើអត្ថបទប្រអប់)។ ⛔ មិនប្តូរឥរិយាបថ ៖ ការចាប់ · focus ដូចដើម · Android · កុំព្យូទ័រ ➜ មិនកត់។
- 🐛 **Android (APK · Chrome) ៖ ផ្ទាំង keyboard លេខ (កែលេខទូរស័ព្ទ · កែទឹកប្រាក់ · កែប្រែ COD/DOD · អត្រាប្រាក់) កន្ត្រាក់ «លោតឡើង ហើយត្រឡប់ចុះ»** (ផ្នែក ២ A131 ·
  វីដេអូ)។ keyboard ប្រាប់កម្ពស់ចាស់ (QWERTY ពីការប្រើមុន) ពេលចាប់ផ្តើម ➜ កាតឡើងខ្ពស់ពេក ➜ keyboard លេខស្ងប់ (ទាបជាង) ➜ WebView បង្រួម ➜ កាតចុះ ៤៥px។ ឥឡូវ ៖ ពេល keyboard
  នៅបើក កាត Android មិនចុះវិញទេ (`androidFitStaysUp()` · ឆ្លងការបង្រួម WebView/ទំព័រ `androidHeldFitView()`) ខណៈនៅមើលឃើញពេញ · keyboard ខ្ពស់ជាង ➜ ឡើង · ស្មើ ➜ ដូចដើម។
- ✨ **Android ចាំកម្ពស់ keyboard ពិតដោយខ្លួនឯង** (ផ្នែក ២ A132 ៖ keyboard ក្រុមហ៊ុនណាក៏បាន · ពង្រីក ឬបង្រួមទំហំ)។ កម្ពស់ពិត = កម្ពស់ទំព័រពេញមុន keyboard −
  ផ្ទៃមើលឃើញ (`keyboardSession`) កត់តែពេលវាស្ងប់ ៖ ទំព័របង្រួមហើយនៅដដែល `KEYBOARD_SETTLE_MS` · ឬ visualViewport នៅដដែល `KEYBOARD_TRUST_MS` ក្រៅ APK ⛔ មិនដែលកត់កម្ពស់ពេល APK
  hold (keyboard ប្រាប់ចាស់) · តាមទំហំអេក្រង់ + ប្រភេទ keyboard (`tel` · `number` · `decimal` · អក្សរ …) ➜ បើកលើកក្រោយ កាតទៅទីតាំងពិតតែម្តង (`learnedKeyboardView()`) ទោះ
  keyboard ប្រាប់កម្ពស់ចាស់ · ប្តូរទំហំ keyboard ➜ ឡើងម្តង ហើយចាំថ្មី · ក្បួនចុចកន្លែងវាយ Barcode (Android) ប្រើកម្ពស់ពិតនេះដែរ។ ⛔ iPhone ចាំដូចដើម។
- ✨ **ទូរស័ព្ទនៅបញ្ឈរ · tablet បង្វិលបាន** (ផ្នែក ២ A133)។ APK ៖ `MainActivity` សម្រេចតាមទទឹងតូចបំផុត (`smallestScreenWidthDp` < `TABLET_MIN_WIDTH_DP` ៦០០ ➜
  `SCREEN_ORIENTATION_PORTRAIT` · ផ្សេង ➜ `UNSPECIFIED`) ក្នុង `onCreate` (មុន `super` ៖ មិនគូរផ្តេកមុន) និង `onConfigurationChanged` (ទូរស័ព្ទបត់ · បំបែកអេក្រង់) · PWA
  Android ដែលដំឡើង ៖ manifest `portrait-primary` (ចាក់សោទូរស័ព្ទ) + tablet សុំ `screen.orientation.lock('any')` (`applyOrientationLock()` ពេល boot និង `resize` · បដិសេធ ➜
  ស្ងាត់) · iPhone ៖ Apple មិនឲ្យ App web ចាក់សោ ➜ `guide.html` ណែនាំ Control Center · Browser tab ➜ មិនប៉ះ។
- 🐛 **iPhone · iPad ៖ ចុចស្លាក «ស្កេន Barcode…» ឬរូប ⚡ ➜ ទំព័រធ្លាក់** (ផ្នែក ២ A129)។ ស្លាក `label for="hwScannerInput"` នៅពីលើកន្លែងវាយ ៖ ចុចវា (ឧ. ចុចខាងលើប្រអប់បន្តិច)
  ➜ iOS focus កន្លែងវាយខ្លួនឯង មិនឆ្លងការចាប់របស់ App ➜ WebKit រំកិលទំព័រ · ⚡ (absolute លើប្រអប់) ៖ ចុចមិនធ្វើអ្វី។ ឥឡូវ iOS standalone ៖ ចុចស្លាក · ⚡ ➜ ចាប់ដូចចុចប្រអប់
  (`iosPageTapFieldOf()` ➜ `focus({ preventScroll })` · ច្បាប់ keyboard ដដែល ៖ keyboard នឹងបាំង ➜ iOS) · ប៊ូតុង «បញ្ជូន» · ស្លាក «📁» · ការអូស ➜ មិនប៉ះ · ⛔ Android ដូចដើម។
- 🐛💰 **ពង្រីកអេក្រង់ (pinch zoom) ➜ App យល់ថាមាន keyboard** (ផ្នែក ២ A128)។ កុំព្យូទ័រ (trackpad · អេក្រង់ប៉ះ) · iPad ៖ zoom ១.៦ ➜ `innerHeight − visualViewport.height` = ៣០០
  ➜ `softKeyboardShown()` ➜ ម៉ាស៊ីនស្កេនពេលផ្ទាំងលេខទូរស័ព្ទបើក វាយ Barcode ចូលប្រអប់ COD ផ្ទាល់ (មិនចូលជួរ «📥») · toast ឡើង ៣០០px · ផ្ទាំងបង្រួម · ចាំ «keyboard» ៣០០។
  ឥឡូវ keyboard = `innerHeight − visualViewport.height × scale` (`visualViewportKeyboardInset()` ៖ scale គិតតែពេល > ១ · រូបមន្តតែមួយសម្រាប់ផ្ទាំង · toast · ការចាំ · ស្វែងរក iOS) ➜
  zoom គ្មាន keyboard ➜ ០ · zoom + keyboard ➜ keyboard ពិត · Android · iPhone ធម្មតា (scale ១) ➜ រូបមន្តដដែល។

#### អ្នកយាម

- `ZoeW/tests/modal-keyboard.test.tsx` +៤ ៖ zoom (គ្មាន keyboard ➜ គ្មានផ្ទៃ · `softKeyboardShown()` false · toast ០ · មិនចាំ · zoom + keyboard ➜ ចាំ ៣៣៦ · ទិសផ្ទុយ scale ១/គ្មាន/< ១/NaN
  ➜ រូបមន្តដដែល) · ស្លាក/⚡ (iOS ចាប់ · keyboard បើក ➜ iOS · ប៊ូតុង · ស្លាក 📁 · អូស ➜ មិនប៉ះ · Android ➜ មិនប៉ះ) · `ios-keyboard-pan.test.ts` +១ (zoom ➜ ០ · zoom + keyboard ➜ ៣៣៦) —
  កូដមុនកែ FAIL ៤ ➜ ១៤៩/១៤៩ (៩ ឯកសារ keyboard · ស្វែងរក · ម៉ាស៊ីនស្កេន)។
- `modal-keyboard-device-test` (Chromium ពិត) +១៦ ៖ (គ) ចុចពិតលើស្លាក · ⚡ ៖ iPhone ៨ ករណី ➜ ចាប់ · Android ៦ ➜ ដូចដើម (ទិសផ្ទុយ) · (ច) កុំព្យូទ័រ 1280×800 ៖
  `Emulation.setPageScaleFactor` ១.៦ ➜ មិនមែន keyboard · ម៉ាស៊ីនស្កេនពេលផ្ទាំងបើក ➜ ចូលជួរ · COD មិនប្រែ — build មុនកែ FAIL ១០ (iPhone ៨ · zoom ២ · Android ៦ ជាប់) ➜ ៧៥/៧៥។
- Android keyboard លេខ · ការចាំ ៖ `ZoeW/tests/modal-keyboard.test.tsx` +៤ (Chrome ៣៨០ ➜ ៣០០ កាតនៅ ១១២ · APK hold ៣៨០ ➜ WebView ៣០០ កាតនៅ ១១២ · ឆ្លាតវៃ APK ៖ ចាំ ៣០០ ក្រោយ
  `KEYBOARD_SETTLE_MS` ➜ បើកលើកក្រោយ hold ៣៨០ កាត ១៥២ តែម្តង · keyboard ពង្រីក ៣៦០ ➜ ឡើងម្តង ចាំ ៣៦០ · hold មិនកត់ទោះយូរ · អក្សរ ≠ លេខ · Chrome ៖ visualViewport ស្ងប់
  `KEYBOARD_TRUST_MS` · ទំព័របង្រួម · កំពុងបិទមិនកត់) · ការសាក Chrome ៤០៧ ចាំក្រោយ `KEYBOARD_TRUST_MS` (មិនកត់ភ្លាម) — កូដមុនកែ FAIL ៥ ➜ ៤៦/៤៦ ·
  `modal-keyboard-device-test` (ក២) ៖ ៥ ផ្ទាំងលេខ × APK ៣ + Chrome ២ ៖ keyboard ប្រាប់ +៨០ ➜ WebView/ទំព័របង្រួមតាមពិត ➜ លើកដំបូងមិនចុះ · ចាំកម្ពស់ពិត · លើកក្រោយទៅទីតាំងពិត
  តែម្តង (គ្មាន `.modal-kb`) — build `178e0a2` FAIL ៥ (កាតចុះ ១០០ ➜ ១៣៩ ដូចវីដេអូ · ចាំ ៤១០ ខុសជំនួស ៣៣០) ➜ ៨០/៨០។
  `modal-keyboard-device-test` រត់តែឯង ៣០៩ វិ. ក្រោយ (ក២) ➜ run-all «ព្យួរ — លើសពិដាន 300s» ➜ ចែកជា `--part=1/2` ((ក) ១១៧ + (ខ) ៣៥ វិ.) · `--part=2/2` ((ក២) ៦៩ · (គ) ៤៩ · (ង) ២៣ · ផ្សេង ១៤ វិ.) ដូច `zoew-suite` (ពិនិត្យថា run-all រត់ផ្នែកទាំង ២ · ក្រុមគ្របគ្រប់ផ្នែកម្តងគត់) ⛔ មិនបង្កើន `CHECKER_TIMEOUT`។
- ចលនា ៖ `modal-keyboard-device-test` ផ្នែក (ឆ) `--part=3/3` (Chromium ពិត · ថតទីតាំងកាតលើអេក្រង់រាល់ស៊ុម) ៖ ១៧ ប្រអប់ × APK ទូរស័ព្ទ · APK tablet ផ្តេក · Chrome · iPhone · iPad ➜
  keyboard បើក/បិទ ➜ ជំហាននីមួយៗតាមខ្សែកោងក្នុងរយៈស៊ុម (+១០%) · ស៊ុមកណ្តាលផ្លូវ · មិនត្រឡប់ក្រោយ · មិនហួស · ≈ `MODAL_GLIDE_MS` · ឈប់ត្រឹមទីតាំងត្រូវ · APK WebView បង្រួម ➜ មិនផ្លាស់ទី ·
  iPhone/iPad visual viewport រំកិល ➜ នៅនឹង · keyboard ប្តូរកម្ពស់កណ្តាលចលនា ➜ បន្ត · ទិសផ្ទុយ ៖ មាតិកាធំឡើង ➜ ភ្លាម ហើយ keyboard ក្រោយមក រអិលពីទីតាំងថ្មី · បង្វិល tablet · iPhone viewport ប្តូរ ➜ ភ្លាម ·
  «បន្ថយចលនា» ➜ ភ្លាម — build មុនកែ (`a9d20c6`) FAIL ៩ (កាតលោតមួយស៊ុម ៖ ស៊ុមកណ្តាល ០) ➜ ១៩/១៩ · mutation (មិនតាមដានទំហំកាត · ចលនាលើ viewport គ្រប់វេទិកា) FAIL ៤ ·
  `settle()` រង់ចាំចលនាចប់មុនវាស់ទីតាំងសម្រាក ➜ ផ្នែក ១/៣ ១៦/១៦ · ២/៣ ៧១/៧១ (ផ្នែកនីមួយៗ ~១៦០ វិ. < ៣០០) · `modal-keyboard-test` វាស់ទីតាំងដើមកណ្តាលចលនាបិទ (រង់ចាំ ១២០ms <
  `MODAL_GLIDE_MS`) ➜ iPad ផ្តេក FAIL ១ ➜ `settle()` រង់ចាំចលនាដូចគ្នា ➜ ៥៣/៥៣ ប៉ុន្តែ ៣១០ វិ. ➜ ចែក `--part=1/3` (ទូរស័ព្ទ ៤ ទំហំ ១២០ វិ.) · `2/3` (ផ្តេក · iPad ៩០ វិ.) · `3/3` (ផ្នែកផ្សេង ១០៣ វិ.)
  (ក្រុមគ្របទំហំទាំង ៧ ម្តងគត់ · run-all រត់ផ្នែកទាំង ៣) ⛔ មិនបង្កើន `CHECKER_TIMEOUT`។
- ការវាស់ iPhone ៖ `ZoeW/tests/ios-page-tap-probe.test.ts` ៤ (ចាប់ ➜ document រំកិល ➜ ផ្ញើម្តង · លេខតែប៉ុណ្ណោះ (គ្មានអត្ថបទប្រអប់) · អូស ➜ visual viewport · ចុចយូរ ➜ `#appPages` ·
  ចុចម្តងទៀតពេល focus រួច ➜ document · ផ្លូវនីមួយៗម្តង · ទិសផ្ទុយ ៖ ម្រាមដៃនៅលើអេក្រង់ · ក្រោយ `PAGE_TAP_PROBE_MS` · មិនរំកិល · ធាតុផ្សេង · Android · ប្រអប់បើក · ZoeErrors គ្មាន) —
  កូដមុនកែ FAIL ២ ➜ ៤/៤ · mutation (ដកលក្ខខណ្ឌម្រាមដៃ · ដក «ម្តង/ផ្លូវ») FAIL ១ ម្តងៗ។
- ទិសអេក្រង់ ៖ `ZoeW/tests/orientation-lock.test.ts` ៥ (PWA ទូរស័ព្ទ ➜ `portrait-primary` ម្តង · foldable បើក ➜ `any` · tablet · ៥៩៩/៦០០ · tab · APK · iPhone · iPad · កុំព្យូទ័រ
  ➜ មិនហៅ · បដិសេធ · បោះ · គ្មាន ➜ មិនបោះ · ព្រំដែន ៦០០ ដូចគ្នានឹង `MainActivity` · AndroidManifest គ្មាន `screenOrientation`) · `npm run android:check` +៥ ·
  `orientationFor()` ពិត compile (`javac` + android stub) ៖ ៣២០ · ៤១១ · ៥៩៩ ➜ PORTRAIT · ៦០០ · ៦៧៣ · ៨០០ · ០ · −១ ➜ UNSPECIFIED។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ) ➜ APK ថ្មី `zoew-android-v2.50.82` (workflow `main`)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone (PWA)** ៖ ទំព័រស្កេន (កញ្ចប់ · Locker · ដក) ➜ ចុចស្លាក «ស្កេន Barcode…» ពីលើប្រអប់ ឬ ⚡ ➜ keyboard លោត · ទំព័រ និង navbar នៅនឹងកន្លែង · ចុចកន្លែងវាយច្រើនដង ➜ មិនធ្លាក់។
   បើនៅធ្លាក់ម្តងម្កាល ➜ សូមថតវីដេអូ (ផ្នែក ២ A129 ៖ ផ្លូវផ្សេងទៀតដែលមិនអាចវាស់នៅទីនេះ)។
2. **កុំព្យូទ័រ + ម៉ាស៊ីនស្កេន USB** ៖ ពង្រីកអេក្រង់ (pinch លើ trackpad) ➜ ស្កេន ➜ ផ្ទាំងលេខទូរស័ព្ទបើក ➜ ចុច COD ➜ ស្កេនម្តងទៀត ➜ ចូលជួរ «📥» · COD មិនប្រែ។
3. **Android keyboard លេខ (APK និង Chrome/PWA)** ៖ បើក «កែលេខទូរស័ព្ទ» (ឬ «កែប្រែ COD, DOD») ➜ ប៉ះកន្លែងវាយ ➜ កាតឡើងតែម្តង មិនចុះវិញ ➜ បិទ ➜ ប៉ះប្រអប់ស្វែងរក (keyboard អក្សរ)
   ➜ បិទ ➜ បើកផ្ទាំងលេខម្តងទៀត ➜ កាតទៅកន្លែងតែម្តង (ករណីវីដេអូ)។ ប្តូរទំហំ keyboard (Gboard ៖ ⚙️ ➜ កម្ពស់ keyboard) ➜ បើកម្តង កាតអាចឡើងម្តង ➜ បើកលើកក្រោយ ទៅកន្លែងពិតភ្លាម។
4. **ទិសអេក្រង់** ៖ ទូរស័ព្ទ Android (APK ថ្មី · PWA ដែលដំឡើង) បង្វិលផ្តេក ➜ App នៅបញ្ឈរ · tablet ➜ បង្វិលបាន · ទូរស័ព្ទបត់ ៖ បើកធំ ➜ បង្វិលបាន · បត់វិញ ➜ បញ្ឈរ។ PWA tablet
   ដែលនៅបញ្ឈរ ➜ ដក App ហើយដំឡើងពី Chrome ម្តងទៀត (Chrome ខ្លះមិនឲ្យ PWA ដោះសោទិស ➜ ប្រាប់ខ្ញុំ)។ iPhone ៖ ចាក់សោពី Control Center (Apple មិនឲ្យ App web ចាក់សោ)។
5. **ផ្ទាំងរអិលតាម keyboard (iPhone · iPad · APK · Chrome)** ៖ បើក «បញ្ចូលច្រើន» · «កែលេខទូរស័ព្ទ» · ផ្ទាំង PIN ➜ ប៉ះកន្លែងវាយ ➜ កាតរអិលឡើងទន្ទឹមនឹង keyboard (មិនលោតភ្លាម) ➜
   បិទ keyboard ➜ រអិលចុះវិញ។ ចលនាលឿន ឬយឺតពេកធៀប keyboard ➜ ប្រាប់ខ្ញុំ (`MODAL_GLIDE_MS`)។ «បន្ថយចលនា» (Reduce Motion) បើក ➜ ទៅកន្លែងភ្លាម។
6. **iPhone ៖ ទំព័រធ្លាក់ម្តងម្កាល (ឧបករណ៍វាស់)** ៖ ប្រើ App ស្កេនធម្មតា (ចុចកន្លែងវាយ Barcode · ស្លាក · ⚡ · គ្រប់របៀប) ទាល់តែទំព័រធ្លាក់ម្តង ➜ ប្រាប់ខ្ញុំម៉ោងប្រហាក់ប្រហែល ➜
   ខ្ញុំអាន Sentry (`zone: ui` · `iosPageTap …`) ➜ ដឹងផ្លូវពិត ➜ កែតែផ្លូវនោះ (អ្នកយាមមុនកែ)។

### [2.50.81] — 2026-10-15 · ZoeW ៖ **ម៉ាស៊ីនស្កេន Bluetooth/USB ស្វ័យប្រវត្តិ · ស្កេនពេលផ្ទាំងបើក ➜ ចូលជួរ · Fast Mode មិនរក្សាទុក COD ខុស · iPhone ៖ របៀបស្កេនដក ចុចកន្លែងវាយ ទំព័រមិនធ្លាក់ · App ចាំកម្ពស់ keyboard ពិត · Android (App · Chrome) ៖ កន្លែងវាយ Barcode · ស្វែងរក មិនរំកិលទំព័រ**

**ZoeW `2.50.81`** (`zoew-v343` ➜ `zoew-v344`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `phone-search.ts` · `app.css` · ZTO) មិនប៉ះ —
ការកែក្នុង `modal-keyboard.ts` · `ios-viewport.ts` · `storage-keys.ts` · `scanner-input.ts` · `refs.ts` · `core/text.ts` · `scan-action.ts` · `batch-scan.ts` · `react-root.css` · `file-output.ts` · `guide.html` · `README.md`។
រាយការណ៍ម្ចាស់គម្រោង (វីដេអូ iPhone ១ · APK ១ លើ 2.50.80) ៖ «ios នៅមានចន្លោះតែ1 ក្រៅពីហ្នឹងដំណើរការត្រឹមត្រូវ គឺចន្លោះកន្លែង ស្កេនដកកញ្ចប់ ពេលចុច ក្នុងប្រអប់វាយ keyboard ឡើងមក
ធ្លាក់ ទំព័រទាំងមូល បន្តិច។ ដោយលែក android តាម modal នីមួយៗគ្រាន់បើជាងមុនច្រើន … តែចំនុចខ្លាំងគឺ កន្លែង ស្វែងរក ក្នុង locker ចុចស្វែងរកទៅទាញកន្ត្រាក់ឡើងលើ» ·
បន្ទាប់មក ៖ «ចុះអាចអោយវា ឆ្លាតវៃវាស់keybaordដោយខ្លួនឯង គ្រប់ឧបករណ៍គ្រប់ទំហំទៅបានអត់» · «ពិនិត្យមើល របៀបស្កេនតាម ឧបករណ៍ស្កេន មិនថា Bluetooth ឬ usb ផងថាវាដំណើរការធម្មតាឬអត់» ·
«ដោយស្វ័យប្រវត្តិ និយាយអោយចំ អោយគ្របយ៉ាងវាគណនា ដោយស្វ័យប្រវត្តិទៅបានអត់» · វីដេអូ Chrome Android លើ deploy preview 320 (គ្មានអត្ថបទ) ·
«កែអោយស្អាតទាំងអស់ទៅ … តែបើកន្លែងណាប៉ះតំបន់លុយសូមសាងអ្នកយាមមុនកែកូដ និងអោយការស្កេនដោយម៉ាស៊ីនស្កេន ប្រើក្នុង បញ្ចូលច្រើនបានផង និង ពិនិត្យផ្លូវ Auto save
ពេលស្គាល់លេខទូរស័ព្ទពី lookup ផងក្រែងកែរួចវាប្រជែងគ្នាជាមួយការបន្ថែមថ្មី»។

#### អ្វីដែលខុសពីមុន

- ✨ **ម៉ាស៊ីនស្កេន Bluetooth/USB ស្វ័យប្រវត្តិ** (សំណើម្ចាស់គម្រោង · A119)។ មុននេះ ៖ ទូរស័ព្ទគ្មានអ្វី focus (ក្រោយរក្សាទុក · ក្រោយចុចប៊ូតុង) ➜ ការស្កេនបាត់ · keyboard ខ្មែរ ➜ Barcode ជាលេខខ្មែរ
  «៧៧១…» · ម៉ាស៊ីនកំណត់ suffix Tab ➜ ចេញពីប្រអប់ ការស្កេនមិនបញ្ជូន។ ឥឡូវ ៖ ទំព័រស្កេន · គ្មានប្រអប់/ផ្ទាំងចំហៀង · មិនចាក់សោ · គ្មានកន្លែងវាយអក្សរ focus (ប៊ូតុង · select ·
  checkbox រាប់ថាគ្មាន) ➜ គ្រាប់ចុចតួអក្សរចូលប្រអប់ «⚡ ស្កេន Barcode» (focus មិនរំកិល) · `key` មិនមែន ASCII ➜ តួអក្សរ US នៃគ្រាប់ (`code` ៖ ម៉ាស៊ីនស្កេនក្លែង keyboard US) ·
  លេខខ្មែរ ០–៩ ➜ 0–9 នៅ `triggerScanAction()` (ផ្លូវស្កេនតែមួយ) និង «បញ្ចូលច្រើន» · ≥ `SCANNER_MIN_CHARS` គ្រាប់លឿន (≤ `SCANNER_KEY_GAP_MS`) + Tab ក្នុង `SCANNER_SUFFIX_GAP_MS`
  ➜ បញ្ជូនដូច Enter។ ⛔ មិនបញ្ជូនដោយគ្មាន suffix (Bluetooth អាចផ្អាកកណ្តាល Barcode ➜ Barcode ខ្លី = លុយខុស)។ «📋 បញ្ចូលច្រើន» ដូចគ្នា (A120) ៖ ប្រអប់បញ្ចូលច្រើននៅខាងលើ +
  គ្មានកន្លែងវាយ focus ➜ ការស្កេនចូលប្រអប់បញ្ចូលច្រើន · keyboard ខ្មែរ ➜ ឡាតាំង · Tab លឿន ➜ ជួរថ្មី (focus នៅ) · ចំនួនរាប់ឡើង (`input`) · គ្រាប់ខ្មែរដែលវាយតួអក្សរច្រើន («ុះ») ក៏តាម `code`។
- 🐛💰 **ស្កេនពេលផ្ទាំង «🎉 ស្កេនបានជោគជ័យ!» បើក ➜ លេខ Barcode ចូលប្រអប់ ➜ Auto save រក្សាទុកលុយខុស** (សំណើម្ចាស់គម្រោង · A121)។ វាស់លើកូដមុនកែ (App ពិត · lookup
  Auto save) ៖ focus នៅ COD ➜ ស្កេន B ➜ lookup ស្គាល់លេខទូរស័ព្ទ ➜ Auto save រក្សាទុក A ជាមួយ **COD = ៧ ៨១០ ១២២ ៣៣៤ ៤៥៥** (លេខ B) និង «✅ រក្សាទុកបានជោគជ័យ!» · DOD ដូចគ្នា ·
  លេខទូរស័ព្ទ ➜ lookup មិនបំពេញ (ប្រអប់មិនទទេ) ➜ គ្មាន Auto save · Locker = លេខ B · ប្រអប់ Barcode នៅក្រោយផ្ទាំង ➜ B នៅជាប់ ➜ ការស្កេនបន្ទាប់ក្លាយជា «BC» (Barcode ខុស) ·
  ប៊ូតុង «🗑️ បញ្ជាក់ដក» focus ➜ Enter របស់ម៉ាស៊ីនស្កេនចុចវា (កាត់លុយ) · B បាត់គ្រប់ករណី។ ឥឡូវ ៖ ពេលផ្ទាំងបើក (មិនមែន «📋 បញ្ចូលច្រើន») · keyboard លើអេក្រង់មិនបង្ហាញ ·
  focus នៅប្រអប់ផ្ទាំងលេខទូរស័ព្ទ · ប្រអប់ Barcode ឬគ្មានកន្លែងវាយ ➜ គ្រាប់ចុចតួអក្សរត្រូវទប់ (≤ `SCANNER_KEY_GAP_MS` · ≤ `SCANNER_SUFFIX_GAP_MS` ពេលវាដូចការស្កេន) ៖
  ការវាយរបស់មនុស្ស ➜ ចូលប្រអប់ដដែលនៅ caret (`typeIntoElement()` ៖ `execCommand('insertText')` ដើរលើ `type=number`) · ការស្កេន (≥ `SCANNER_MIN_CHARS` គ្រាប់លឿន + Enter/Tab)
  ➜ ប្រអប់ និងប៊ូតុងមិនប៉ះ (Enter មិនទៅប្រអប់បន្ទាប់ · មិនចុចប៊ូតុង) ➜ ចូលជួរ (`queueScannedCode()` ៖ «📥 ការស្កេនតាមជួរ» + ⏹️) ➜ បើកតាមលំដាប់ក្រោយផ្ទាំងបិទ តាមផ្លូវស្កេនធម្មតា
  (`triggerScanAction()` · របៀបស្កេនដដែល · ការដកកំពុងដំណើរការ ➜ រង់ចាំ · តែពេលផ្ទាំងដំណើរការស្កេនបើក ៖ លេខទូរស័ព្ទ · ដក · ព្រមាន Locker; ផ្ទាំងផ្សេងតែឯង
  (PIN · Config) ➜ មិនចូលជួរ ប្រាប់ឲ្យបិទផ្ទាំងសិន) · ផ្ទាំងបិទពាក់កណ្តាលការស្កេន (Auto save) ➜ Barcode ពេញនៅតែចូលជួរ (មិនកាត់) · Barcode ដែលផ្ទាំង
  លេខទូរស័ព្ទ ឬផ្ទាំងដកកំពុងបង្ហាញ (អានពីរដង) · មាននៅក្នុងជួររួច ➜ ប្រាប់ មិនបន្ថែម · «📋 បញ្ចូលច្រើន» កំពុងរត់ ➜ បន្ថែមចុងជួរ · ប្តូរគណនី/ហាង ➜ ទម្លាក់ស្ងាត់ · ទំព័រផ្សេង ➜ មិនចូលជួរ ប្រាប់ឲ្យស្កេននៅទំព័រស្កេន ·
  ផ្ទាំងបើកពាក់កណ្តាលការស្កេនលើទំព័រ ➜ មិនចូលជួរ ប្រាប់ឲ្យស្កេនម្ដងទៀត។ Auto save ពី lookup ឥឡូវអានតែតម្លៃដែល lookup/មនុស្សបំពេញ (ការស្កេនមិនដែលនៅក្នុងប្រអប់)។
  keyboard លើអេក្រង់ iPhone បង្ហាញ (ការវាយលើទូរស័ព្ទ) · ប្រអប់វាយរបស់ផ្ទាំងផ្សេង (PIN · Config · កែតម្លៃ) ➜ មិនប៉ះ · Android ៖ keyboard លើអេក្រង់ផ្ញើ `Unidentified`
  (មិនត្រូវទប់) ➜ ម៉ាស៊ីនស្កេនត្រូវចាប់ទោះ «Show virtual keyboard» បើក។
- 💰 **Fast Mode ៖ ម៉ាស៊ីនស្កេនគ្មាន Enter/Tab · COD/DOD ធំខុសធម្មតា** (សំណើម្ចាស់គម្រោង «ដែលអ្នកថា Fast mode មានចន្លោះនោះសូមកែអោយស្អាតចុះ» · A122)។
  វាស់លើ `e33a872` ៖ ម៉ាស៊ីនស្កេនដែលមិនផ្ញើ Enter/Tab ស្កេនពេល focus នៅ COD ➜ គ្រាប់ដែលទប់ត្រឡប់ចូល COD ក្រោយ `SCANNER_SUFFIX_GAP_MS` ➜
  COD = `78101355667788` ➜ lookup ស្គាល់ ➜ Auto save រក្សាទុកលុយខុស · ប្រអប់ Barcode ក្រោយផ្ទាំង ➜ B នៅជាប់ · COD បិទភ្ជាប់/វាយលើ keyboard
  លើអេក្រង់ (មិនឆ្លងការទប់) `7810122334455` ➜ Auto save · «រំលង» រក្សាទុកដូចដើម។ ឥឡូវ ៖ (១) ការទប់ ៖ ≥ `SCANNER_MIN_CHARS` គ្រាប់លឿនដែលចប់ដោយគ្មាន
  Enter/Tab = ម៉ាស៊ីនស្កេនគ្មាន suffix ➜ បោះបង់ + ប្រាប់ឲ្យកំណត់ Enter/Tab ⛔ មិនដែលចូលប្រអប់ (ការវាយរបស់មនុស្ស < `SCANNER_MIN_CHARS` គ្រាប់លឿន
  ចូលដូចដើម) · (២) ផ្លូវរក្សាទុកតែមួយ `confirmPhone()` (Auto save · «រំលង» · «យល់ព្រម») ៖ COD ឬ DOD លើស `SCAN_MONEY_MAX` ($100000) ➜ មិនរក្សាទុក ·
  មិន claim · មិនសរសេរអ្វី · ផ្ទាំងនៅ · focus ប្រអប់នោះ · ប្រាប់ចំនួន ➜ កែ ហើយ «យល់ព្រម» ម្ដងទៀត។ ផ្លូវផ្សេង (កែតម្លៃកញ្ចប់ · នាំចូលបញ្ជី ZTO) មិនប្រែ។
- 💰 **Lookup Auto save ពេលមនុស្សកំពុងវាយ · cursor លោតចេញពីប្រអប់** (សំណើម្ចាស់គម្រោង «ត្រូវការកែ auto-lookup.ts របស់ ZTO ដែរឬ បើត្រូវកែក៏កែចុះ» ·
  ឯកសារក្នុងសោ ZTO · A123)។ វាស់លើ `d50bb01` ៖ វាយ COD «1» (ចង់ 15) ពេល lookup កំពុងរក ➜ lookup ស្គាល់ ➜ Auto save រក្សាទុក
  `["012345678", 1, 1]` (COD $1) · lookup រកមិនឃើញ ពេលកំពុងវាយ COD ➜ `armLookupFocus()` ទាញ cursor ទៅលេខទូរស័ព្ទ ➜ «5» ចូលលេខទូរស័ព្ទ
  (COD `1` · phone `5`) · ចុចប្រអប់ Locker (មិនទាន់វាយ) ➜ cursor លោតទៅលេខទូរស័ព្ទ។ ឥឡូវ ៖ `scanState.phoneModalTyped` = មាន `input` លើប្រអប់ទាំង ៤
  (`notePhoneModalInput()` · កំណត់ឡើងវិញរាល់ការស្កេន · lookup បំពេញដោយគ្មាន event) ➜ Auto save តែពេលមិនទាន់វាយ · វាយរួច ➜ បំពេញតែប្រអប់ទទេ +
  «ℹ️ រកឃើញអតិថិជន (COD … · DOD …) — អ្នកបានវាយ … ចុច «យល់ព្រម»» · `armLookupFocus()` មិនទាញ cursor ពេលបានវាយ ឬប្រអប់វាយក្នុងផ្ទាំងកំពុង focus។
- 🐛 **Chrome Android ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័រ និង navbar រំកិលឡើង ហើយនៅដដែល** (A117)។ keyboard Chrome បង្រួមតែ visual viewport (resizes-visual) ➜ Chromium
  `ScrollFocusedEditableElementIntoView` រំកិល visual viewport ឲ្យប្រអប់នៅកណ្តាល ពេលប្រអប់មិននៅក្នុងផ្ទៃមើលឃើញទាំងស្រុង។ ឥឡូវការចុចកន្លែងវាយ Barcode លើ Android (App · Chrome)
  ចាប់ដូច iPhone ពេលវានៅពីលើ keyboard (ការចាំ/ប៉ាន់ដដែល) ➜ `focus({ preventScroll: true })` ➜ Chromium រំលងការរំកិល (ចុចម្តងទៀតក៏ដូច្នេះ ៖ focus options នៅជាប់)។
  ប្រអប់វាយក្នុងប្រអប់ (modal) · ប្រអប់ focus រួច + keyboard បើក · keyboard បាំង (ផ្តេក) ➜ Android ធ្វើខ្លួនឯង។
- 🐛 **Chrome Android ៖ ទំព័ររំកិលរួច (keyboard បើក) ➜ ចុចស្វែងរកបញ្ជីកញ្ចប់ ➜ ឃើញតែ «📭» ~៣ វិ.** (A118)។ ការបង្រួមផ្ទាំង + `focus({ preventScroll })` ទុកប្រអប់ស្វែងរកពីលើ
  visual viewport ដែលនៅរំកិល។ ឥឡូវការចុចស្វែងរក tab ស្កេនលើ Android ត្រឡប់ visual viewport ទៅកំពូលមុន (`resetVisualViewportPan()` ៖ `documentElement.scrollIntoView` ·
  ⛔ `window.scrollTo` រំកិលតែ layout viewport — វាស់ក្នុង Chromium ពិត)។

- 🐛 **iPhone ៖ របៀបស្កេនដកកញ្ចប់ ➜ ចុចកន្លែងវាយ Barcode ➜ ទំព័រធ្លាក់** (A114)។ ប៊ូតុងក្រហម និងផ្ទាំងពណ៌ផ្កាឈូករុញកន្លែងវាយចុះ ➜ បាត 442pt លើ 852 (៥២% · រួមរបារស្ថានភាព 59pt)
  ធំជាងការប៉ាន់ keyboard ៥០% ➜ ការចុចទៅផ្លូវ iOS ដើម។ keyboard ខ្មែរពិតរបស់ម្ចាស់គម្រោងយក ៤៣% (កំពូល 487pt)។ ឥឡូវទូរស័ព្ទបញ្ឈរ (ទទឹង < `PAGE_TAP_PHONE_MAX_WIDTH` ៦០០)
  ប៉ាន់ ៤៥% (`PAGE_TAP_PHONE_KEYBOARD_RATIO`) ➜ ចាប់ការចុច · iPad · ផ្តេក នៅ ៥០% · iPhone SE (667) របៀបដក ➜ keyboard ពិតបាំង ➜ iOS ធ្វើខ្លួនឯង។
- ✨ **App ចាំកម្ពស់ keyboard ពិតរបស់ឧបករណ៍** (សំណើម្ចាស់គម្រោង · A116)។ keyboard បើកពេលកន្លែងវាយណាមួយ focus ➜ កត់កម្ពស់ចុងក្រោយដែលស្ងប់ តាមទំហំអេក្រង់ (បញ្ឈរ/ផ្តេក ·
  split) និងប្រភេទ keyboard (អក្សរ · លេខ · tel …) ក្នុង `zoew_keyboard_inset_v1` (ការកំណត់ឧបករណ៍ ៖ នៅក្រោយ reload · បិទ App) ➜ ការសម្រេចចាប់ការចុចកន្លែងវាយ Barcode ប្រើ keyboard
  ពិត · ការប៉ាន់ (៤៥% · ៥០%) ប្រើតែមុន keyboard បើកលើកដំបូងលើឧបករណ៍ ឬទំហំអេក្រង់នោះ។ មុននេះ App ចាំតម្លៃ **ធំបំផុត** ក្នុង memory ៖ keyboard iOS លោតហួសពេលបើក ➜
  តម្លៃហួសត្រូវចាំ ➜ របៀបដកនៅទៅផ្លូវ iOS ទោះ keyboard បានបើកម្តងរួច (ដូចវីដេអូ)។
- 🐛 **Android (App · Chrome) ៖ ចុចប្រអប់ស្វែងរក Locker ➜ ទំព័រកន្ត្រាក់ឡើងលើ** (A115)។ keyboard លោតខណៈការរអិលនៅទុកប្រអប់ទាប ➜ Chromium រំកិលទំព័រទាំងមូល (navbar បាត់)
  ដើម្បីបង្ហាញប្រអប់ ➜ ការរអិលបន្តឡើង ➜ រំកិលហួស (ប្រអប់ស្វែងរកបាត់ពីលើ) ➜ លោតត្រឡប់។ ឥឡូវប្រអប់ស្វែងរក tab ស្កេន (បញ្ជីកញ្ចប់ · Locker) លើ Android ចាប់ការចុចដូច iOS ៖
  `touchend` preventDefault ➜ បង្រួមផ្ទាំងស្កេនមុន ➜ `focus({ preventScroll: true })` (Chromium មិនរំកិលពេល keyboard លោត)។ កាមេរ៉ាកំពុងស្កេន ➜ ធ្វើតាម browser ·
  ប្រអប់ស្វែងរកលេខ (ទំព័រទិន្នន័យ) លើ Android មិនប្រែ (តំបន់ហាម · មិនមានរាយការណ៍)។
- 🐛 **ទូរស័ព្ទផ្តេក ៖ ប៊ូតុងទំព័រស្កេននៅក្រោមរបា Tab** (សំណើម្ចាស់គម្រោង «កែ A124 ទៅ ហើយ push ហ្មង សាងអ្នកយាមសិនមុនកែ» · ផ្នែក ២ A124)។ Android ផ្តេក 780×360 ៖
  «📁 យក Barcode ពីរូបភាព» · «📋 បញ្ចូលច្រើន» នៅក្រោមរបា Tab (កម្ពស់ ៦៦) ពេលទំព័រនៅកំពូល · របៀបដក ៖ កន្លែងវាយ Barcode · «បញ្ជូន» ក៏នៅក្រោម (780×360 · iPhone SE ផ្តេក 667×375) ·
  APK 756×336 ៖ ប៊ូតុងតម្រងថ្ងៃ (ទំព័រទិន្នន័យ) ក៏នៅក្រោម · អូសតិច (< ~១០០px) ➜ snap ទាញត្រឡប់ ០ (តំបន់ហាម ⛔ មិនប៉ះ) ➜ ចុចមិនបាន។ ឥឡូវ ទូរស័ព្ទផ្តេក (< ៩៩២ · កម្ពស់ ≤ ៥០០) ៖
  ផ្ទាំងស្កេន ២ ជួរឈរ (ឆ្វេង ៖ ប៊ូតុងរបៀប ៣ · ផ្ទាំងរបៀបដក · កាមេរ៉ា · ស្តាំខាងលើ ៖ កន្លែងវាយ Barcode · រូបភាព · បញ្ចូលច្រើន ៖ ជួរឈរនីមួយៗទទឹងប្រហែលទូរស័ព្ទបញ្ឈរ ·
  កន្លែងវាយបាត ១១៧px ➜ keyboard ផ្តេកពិត (iPhone 209/393 · Android 190–200) មិនបាំង ➜ ការចុចត្រូវចាប់ (ទំព័រមិនរំកិល · ច្បាប់ A114/A117 ដដែល)) ·
  របា Tab បង្រួម (រូបនៅក្បែរអក្សរ · ផ្ទៃចុច ៣៦px ៖ ដូចរបា Tab iPhone ផ្តេក) ➜ គ្រប់ប៊ូតុង/កន្លែងវាយចុចបានពេលទំព័រនៅកំពូល (កម្ពស់ ៣០០–៤៣០)។ CSS តែក្នុង `react-root.css`
  (`@media (max-width: 991px) and (orientation: landscape) and (max-height: 500px)`) ⛔ បញ្ឈរ · tablet · desktop · snap · ចលនាផ្ទាំង មិនប្រែ។
- 🐛 **កុំព្យូទ័រ ៖ «🖼️ រក្សាទុកជារូបភាព» (NIIMBOT) ➜ «❌ រក្សាទុករូបភាពស្លាកមិនបាន»** (រាយការណ៍ម្ចាស់គម្រោង ៖ «រក្សាទុកស្លាក រូបភាព niimbot អត់បានលើ កុំព្យូទ័រ
  លោត toast រក្សាទុករូបភាពស្លាកមិនបាន» · ផ្នែក ២ A127)។ Chrome · Edge លើ Windows/Mac មាន Web Share ជាមួយឯកសារ ➜ App បើកផ្ទាំង Share ជំនួសការទាញយក · Share បដិសេធ
  (`NotAllowedError` ៖ ឯកសារច្រើន · សកម្មភាពអ្នកប្រើផុតក្រោយគូររូប) ➜ ❌ ហើយគ្មានឯកសារ។ ឥឡូវ ៖ កុំព្យូទ័រ ➜ ទាញយក PNG ផ្ទាល់ (`imageShareSheetPreferred()` ៖ ទូរស័ព្ទ ·
  iPad (Macintosh + ចុចច្រើនម្រាម) ប៉ុណ្ណោះបើក Share) · Share បដិសេធដោយហេតុផលផ្សេងពីការបោះបង់ ➜ ទាញយកជំនួស (✅) · បោះបង់ (`AbortError`) ➜ គ្មានសារ ដូចមុន ·
  APK មិនប្រែ។ NIIMBOT ដំណើរការជាមួយកុំព្យូទ័រ ៖ PNG ដែលទាញយក ➜ ផ្ញើទៅទូរស័ព្ទ ➜ App NIIMBOT ➜ បញ្ចូលរូប។

#### អ្នកយាម

- `modal-keyboard-device-test` (គ) +៤ ឧបករណ៍ក្លែងរបារស្ថានភាព (`SAFE_TOP`) ៖ iPhone 393×852 status 59 (របៀបកញ្ចប់ · របៀបដក keyboard ខ្មែរ 365) · Pro Max របៀបដក ➜ ចាប់ ·
  iPhone SE status 20 របៀបដក ➜ iOS — លើ `5a360b8` FAIL ១ (របៀបដក បាត 442 ៖ មិនចាប់) ➜ ២៥/២៥ · +១ keyboard លោតហួស 420 ➜ ស្ងប់ 365 ក្នុងរបៀបកញ្ចប់ ➜ របៀបដក ➜ ចាប់ —
  លើ `c611d62` (ចាំធំបំផុត) FAIL ១ ➜ ២៦/២៦។
- `ZoeW/tests/modal-keyboard.test.tsx` +៥ (ការចាំ keyboard) ៖ លោតហួស ➜ ចាំតម្លៃស្ងប់ · reload ➜ នៅចាំ · ឧបករណ៍ថ្មី ➜ ៤៥% · តាមប្រភេទ (tel មិនប៉ះអក្សរ · មិនទាន់វាស់ ➜ ធំបំផុតនៃអេក្រង់) ·
  ទំហំអេក្រង់ផ្សេង ➜ ដាច់ពីគ្នា · គ្មាន field focus ➜ មិនចាំ · storage ខូច ➜ មិនប្រើ · ពិដាន `KEYBOARD_MEMORY_MAX` — មុនកែ FAIL ៥។
- `history-window-check` +៣ ៖ ចុចពិត (touchscreen) លើប្រអប់ស្វែងរក Locker ៖ APK · PWA Android ➜ ចាប់ · បង្រួម · `preventScroll` · document ០ · PWA iPhone (មិនមែន standalone) ➜ browser —
  មុនកែ FAIL ២ ➜ ០។
- `ZoeW/tests/ios-entry-search-tap.test.ts` ៖ Android ➜ ចាប់ (Locker · បញ្ជីកញ្ចប់ · កាមេរ៉ា ➜ browser) · ការអះអាងចាស់ «Android/web ➜ browser» ចែកជាកុំព្យូទ័រ/web ➜ browser ·
  `ZoeW/tests/ios-search-tap-focus.test.ts` ៖ ប្រអប់ស្វែងរកលេខលើ Android ➜ មិនប៉ះ · `ZoeW/tests/modal-keyboard.test.tsx` ៖ ទូរស័ព្ទបញ្ឈរ ៤៥% (៥០% ធ្លាក់) — មុនកែ FAIL ២។
- `modal-keyboard-device-test` (គ) +៦ Android (Chrome 411×830 របៀបដក keyboard 407 · 360×740 · 412×915 · tablet បញ្ឈរ ➜ ចាប់ · ផ្តេក · tablet ផ្តេក ➜ Android) · (ឃ) visual viewport ពិត
  (meta ពង្រីកបាន + pinch ➜ offsetTop 88) ➜ ចុចស្វែងរកបញ្ជីកញ្ចប់ · Locker ➜ offsetTop ០ · ប្រអប់ក្នុងផ្ទៃមើលឃើញ · (ង) ម៉ាស៊ីនស្កេន ៖ ព្រឹត្តិការណ៍ keyboard ពិត (CDP) Android · iPhone ·
  កុំព្យូទ័រ ៖ គ្មានអ្វី focus + Enter · keyboard ខ្មែរ (key «៧» · code Digit7) · suffix Tab ➜ ផ្ទាំងបញ្ជាក់បើកជាមួយ Barcode ពិត · ទិសផ្ទុយ ប្រអប់ស្វែងរក ➜ មិនលួច —
  មុនកែ FAIL ១៥ (៦ + ៩) ➜ ៤៦/៤៦។
- `ZoeW/tests/hardware-scanner.test.tsx` (ថ្មី · ១១) ៖ តួអក្សរ US តាម `code` (Shift · CapsLock · Numpad · សញ្ញា · ឈ្មោះ prototype) · keyboard ខ្មែរ · Ctrl/Space/Unidentified ➜ ទទេ ·
  `latinDigits` · បញ្ចូលច្រើន · `triggerScanAction()` លេខខ្មែរ · គ្មាន focus · ប៊ូតុង/select focus (Enter មិនចុចប៊ូតុង · select មិនប្តូរ) · Tab លឿន ➜ បញ្ជូន · វាយយឺត/តិច/Shift+Tab/Tab យឺត ➜
  មិនបញ្ជូន · ប្រអប់ស្វែងរក · modal · ទំព័រទិន្នន័យ · ចាក់សោ · ផ្ទាំងចំហៀង ➜ មិនលួច — មុនកែ FAIL ១១ ·
  `ZoeW/tests/modal-keyboard.test.tsx` +១ Android ៖ ចុចកន្លែងវាយ Barcode ➜ ចាប់ · ចាំ keyboard 407 · focus ដោយកូដគ្មាន keyboard ➜ ចាប់ · keyboard បើក · modal · បាំង · កុំព្យូទ័រ ➜ មិនចាប់ ·
  `ZoeW/tests/ios-entry-search-tap.test.ts` +១ ៖ visual viewport រំកិល ➜ `documentElement.scrollIntoView` មុនបង្រួម · មិនរំកិល · iOS ➜ មិនហៅ — មុនកែ FAIL ២។
- ការផ្ទៀងផ្ទាត់ឡើងវិញ (សំណើម្ចាស់គម្រោង · A120) ៖ `hardware-scanner.test.tsx` +២ («📋 បញ្ចូលច្រើន» ៖ គ្មាន focus · ខ្មែរ · Tab ➜ ជួរថ្មី · Enter · ចំនួន «3 Barcode» · ទិសផ្ទុយ ផ្ទាំងបញ្ជាក់
  លើវា · វាយយឺត + Tab) · គ្រាប់ខ្មែរតួអក្សរច្រើន — លើ `c7b23da` FAIL ២ · `modal-keyboard-device-test` (ង) +៣ «📋 បញ្ចូលច្រើន» ព្រឹត្តិការណ៍ keyboard ពិត ➜ ៤៩/៤៩ ·
  `react-purity-check` ស្គាល់ `setRangeText` · ច្រកចេញ `refs.ts` មានហេតុផល (`scrollIntoView` ២ · `setRangeText` ១) — `c7b23da` FAIL ១ (`.value` លើសពិដាន) ·
  `repository-file-coverage.json` + `ZoeW/tests/hardware-scanner.test.tsx` — `c7b23da` FAIL ១។
- 💰 `ZoeW/tests/scanner-modal-queue.test.tsx` (ថ្មី · ២១ ៖ App ពិត · lookup Auto save ពិត · registry/ledger/save ក្លែង) ៖ focus COD · លេខទូរស័ព្ទ · DOD · Locker ➜ ស្កេន B + Enter ➜
  ប្រអប់មិនប្រែ · focus មិនរំកិល ➜ Auto save រក្សាទុក A = lookup (`012345678` · ៥ · ១) ➜ B បើកបន្ទាប់ · ប្រអប់ Barcode ក្រោយផ្ទាំង ➜ B · C តាមលំដាប់ (មិន «BC») · ផ្ទាំងបិទពាក់កណ្តាល ➜
  Barcode ពេញ · អានពីរដង · «📋 បញ្ចូលច្រើន» X · Y · C · ប្តូរវគ្គ ➜ ទម្លាក់ · ⏹️ · ផ្ទាំងបើកពាក់កណ្តាលការស្កេនលើទំព័រ · ប៊ូតុង «🗑️ បញ្ជាក់ដក» focus ➜ មិនដក ➜ B ក្នុងរបៀបដក ·
  ទំព័រទិន្នន័យ ➜ មិនចុចប៊ូតុង · ទិសផ្ទុយ ៖ ការវាយល្បឿនមនុស្ស (លេខទូរស័ព្ទ · Locker · COD + Enter ទៅប្រអប់បន្ទាប់) · លឿន ៣ តួ ➜ មិនបាត់ · keyboard លើអេក្រង់ · ផ្ទាំង PIN ➜ មិនប៉ះ —
  លើកូដមុនកែ FAIL ១២ ➜ ១៧/១៧ · ការពិនិត្យ diff ខ្លួនឯង +២ ៖ checkbox ក្នុងផ្ទាំង focus ➜ គ្រាប់ដែលទប់មិនប្តូរ `value` (`typeIntoElement()` ទទួលតែប្រអប់វាយអក្សរ) ·
  ស្កេន Barcode ដែលផ្ទាំង «ដក» កំពុងបង្ហាញ ➜ មិនចូលជួរ — លើ `0f2b40e` FAIL ២ ➜ ១៩/១៩ · Android បង្ហាញ keyboard លើអេក្រង់ពេលភ្ជាប់ម៉ាស៊ីនស្កេន
  («Show virtual keyboard») ➜ ការស្កេននៅតែមិនចូល COD (keyboard លើអេក្រង់ Android ផ្ញើ `Unidentified` មិនត្រូវទប់) — លើ `56a567c` FAIL ១ ➜ ២០/២០ ·
  ផ្ទាំងមិនមែនដំណើរការស្កេន (PIN តែឯង) · គ្មានប្រអប់ focus ➜ វាយលេខលឿន + Enter ➜ មិនចូលជួរ ប្រាប់ឲ្យបិទផ្ទាំងសិន (`SCAN_FLOW_MODALS`) — លើ `b1e3898` FAIL ១ ➜ ២១/២១ ·
  💰 Fast Mode +៤ ៖ ម៉ាស៊ីនស្កេនគ្មាន suffix ចូល COD ➜ COD ទទេ · ប្រាប់ ➜ Auto save = lookup · ប្រអប់ Barcode ក្រោយផ្ទាំង ➜ ទទេ · COD `7810122334455`
  ➜ Auto save មិនរក្សាទុក · ផ្ទាំងនៅ · focus COD ➜ កែជា ៥ ➜ រក្សាទុក ៥ · DOD លើសពិដាន + «រំលង» ➜ មិនរក្សាទុក · ទិសផ្ទុយ ត្រឹម `SCAN_MONEY_MAX` ➜ រក្សាទុក —
  លើ `e33a872` FAIL ៤ ➜ ២៥/២៥ · `modal-keyboard-device-test` (ង) +៣ (ព្រឹត្តិការណ៍ keyboard ពិត ៖ គ្មាន Enter/Tab ➜ COD មិនប្រែ · COD ធំ ➜ «យល់ព្រម»
  មិនរក្សាទុក) — លើ `e33a872` FAIL ៦ (៣ ថ្មី + ៣ «បិទ ➜ បើកបន្ទាប់» ៖ «យល់ព្រម» រក្សាទុក COD ធំ ហើយបិទផ្ទាំង) ➜ ៥៥/៥៥ ·
  💰 Lookup ↔ ការវាយ +៤ ៖ វាយ COD «1» ➜ lookup ស្គាល់ ➜ មិន Auto save · ℹ️ COD 15 ➜ វាយ «5» ➜ យល់ព្រម ➜ COD 15 · រកមិនឃើញពេលវាយ COD ➜ cursor នៅ COD ·
  ចុច Locker ➜ cursor នៅ Locker · ទិសផ្ទុយ មិនវាយ ➜ Auto save ដូចដើម · រកមិនឃើញ ➜ cursor ទៅលេខទូរស័ព្ទ — លើ `d50bb01` FAIL ៣ ➜ ២៩/២៩ ·
  `tests/zto-lock.test.ts` sha256 `auto-lookup.ts` ថ្មី · `lookup-prefetch-test` ២៦៤/២៦៤ (`react-view` ផ្តល់ `activeElementIsInModal` ឲ្យ sandbox) ·
  `zto-list-sync-test` ៥៩៥ · `zto-sync-banner-test` ១៩៨ · `user-guide-test` ៖ `guide.html` ប្រាប់ពិដានដែលស្រង់ពី `SCAN_MONEY_MAX` · `hardware-scanner.test.tsx` ទិសផ្ទុយ «modal បើក» ៖ គ្រាប់ត្រូវទប់ (មិនចូលប្រអប់ Barcode) ·
  `modal-keyboard-device-test` (ង) +៣ (Android · iPhone · កុំព្យូទ័រ ៖ ព្រឹត្តិការណ៍ keyboard ពិត) ៖ វាយ COD «2.5» ល្បឿនមនុស្ស ➜ ចូល · ស្កេន + Enter ➜ COD មិនប្រែ · ចូលជួរ ➜
  បិទ ➜ បើកបន្ទាប់ — កូដមុនកែ FAIL ៣ ➜ ៥២/៥២ · `layout-check` វាយលេខទូរស័ព្ទល្បឿនមនុស្ស (90ms/គ្រាប់ ៖ ០ms = ការស្កេន) · `react-purity-check` ស្គាល់ `document.execCommand` ·
  `state-hygiene` `heldKeys` មានហេតុផល · CI លើ `e33a872` ៖ `toast-action-truth` FAIL ១ (toast «📥 Barcode (…)» គ្មានសញ្ញាប្រភេទ) ➜ «⏳ 📥 …» (ចូលជួរ = កំពុងរង់ចាំ) ➜ ៦៧/៦៧។
- `layout-check` +៧ (`landscapeScanReach` · A124) ៖ ទូរស័ព្ទផ្តេក ៧ ទំហំ (780×360 · 756×336 · 780×300 · 640×360 · 667×375 · 844×390 · 932×430) × ៣ របៀប ៖ គ្រប់ប៊ូតុង/កន្លែងវាយ
  ក្នុង `#entrySideSection` ចុចត្រូវចំកណ្តាលពេល scroll ០ · ទំព័រទិន្នន័យ (≥ ៣៣៦) ប៊ូតុងតម្រង ៤ · `--tabbar-height` = កម្ពស់របា Tab ពិតក្រោយបង្វិល · ផ្ទៃចុច Tab ≥ ៣២px · ទិសផ្ទុយ ៖
  បញ្ឈរ (៣៩០ · ៣៦០ · ៧៦៨) ផ្ទាំងជួរឈរតែមួយ · រូប Tab នៅលើអក្សរ — កូដមុនកែ FAIL ២ (៧៨០×៣៦០ ៖ រូបភាព · បញ្ចូលច្រើន ➜ របា Tab · របៀបដក ៖ កន្លែងវាយ · ៧៥៦×៣៣៦ តម្រង) ➜ ៧/៧។
- `modal-keyboard-device-test` (គ) ៖ ការរៀបលើកទី ១ (ប៊ូតុងរបៀបពេញខាងលើ · កន្លែងវាយក្រោម ៖ បាត ១៨៣) ធ្វើឲ្យ iPhone ផ្តេក 852×393 ចាប់ការចុច ខណៈ keyboard ពិត ២០៩ គ្របគម្លាត ៨px ➜
  FAIL ២ ➜ ប្លង់ថ្មី ៖ កន្លែងវាយខាងលើស្តាំ (បាត ១១៧) ➜ ទូរស័ព្ទផ្តេក ២ ករណី (iPhone 852×393 · Android 915×412) ប្តូរពី «ប្រព័ន្ធ» ទៅ «ចាប់» (preventDefault · `preventScroll` · document ០ ·
  keyboard ពិតមិនបាំង ៖ test ផ្ទៀងផ្ទាត់ខ្លួនឯង) + Android 780×360 របៀបដក keyboard ២០០ (A124) · ទិសផ្ទុយ «keyboard បាំង ➜ ប្រព័ន្ធ» នៅ (iPad ផ្តេក · Android tablet ផ្តេក · iPhone SE របៀបដក) ·
  (ង) ការស្កេនក្លែងពេលផ្ទាំងបើក ៖ ម៉ាស៊ីនតេស្តផ្អាក > `SCANNER_KEY_GAP_MS` (CDP · GC ៖ ធ្លាក់ ២ ដងក្នុង ៣ ការរត់ · build មុន/ក្រោយកែ ០/២០ ពេលរត់ម្នាក់ឯង · ចន្លោះ ១៥–២៩ms) ➜ វាស់ចន្លោះពិត
  (`event.timeStamp`) · ធ្វើម្តងទៀតតែពេលនោះ (≤ ៣) · ការអះអាងជាន់អប្បបរមា «ល្បឿនម៉ាស៊ីនស្កេន» · mutation (`count >= 4` ➜ `false` ៖ ការស្កេនគ្មាន suffix វាយចូល COD) ➜ FAIL ៣ ➜ ៥៩/៥៩។
- `ZoeW/tests/label-image.test.tsx` +២ (A127) ៖ Windows · Mac (មាន `navigator.share`) ➜ ទាញយក · គ្មាន Share · iPad ➜ Share · Android `NotAllowedError` ➜ ទាញយកជំនួស ·
  ប៊ូតុងលើកុំព្យូទ័រ ➜ «✅ បានទាញយករូបភាពស្លាក 3» គ្មាន ❌ · ការអះអាងចាស់ «NotAllowedError ➜ reject» (ចាក់សោកំហុស) ប្តូរ — កូដមុនកែ FAIL ៣ ➜ ៧/៧ ·
  `layout-check` +៣ (`labelImageExport` ៖ browser ពិត · ការទាញយកពិតរបស់ Playwright) ៖ Edge Windows Share បដិសេធ ➜ ទាញយក PNG ២ · ✅ · Android `NotAllowedError` ➜ ទាញយក ២ ·
  ទិសផ្ទុយ Android `AbortError` ➜ ០ ទាញយក · គ្មានសារ — build មុនកែ FAIL ២ (Edge · Android ៖ «❌ រក្សាទុករូបភាពស្លាកមិនបាន» · ០ ឯកសារ) ➜ ៩/៩។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ) ➜ APK ថ្មី `zoew-android-v2.50.81` (workflow `main`)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone (PWA)** ៖ ទំព័រស្កេន ➜ 🗑️ ស្កេនដកកញ្ចប់ ➜ ចុចកន្លែងវាយ Barcode ➜ keyboard លោតឡើង ទំព័រ និង navbar នៅនឹងកន្លែង (របៀបកញ្ចប់ · Locker ដូចគ្នា)។
2. **APK · Chrome Android** ៖ 📍 កំណត់ទីតាំង Locker ➜ ចុចប្រអប់ស្វែងរក (ផ្ទាំងស្កេនបើក) ➜ បញ្ជីរអិលឡើងតែម្តង ប្រអប់ស្វែងរកនៅពីលើ keyboard (navbar មិនបាត់) · 📦 បញ្ជីកញ្ចប់ដូចគ្នា ·
   keyboard លោត ➜ វាយបាន (បើ keyboard មិនលោត ➜ ចុចម្តងទៀត ហើយប្រាប់ខ្ញុំ)។
3. **APK** ៖ ប្រអប់ផ្សេងៗ ➜ នៅដូច 2.50.80។
4. **Chrome Android · APK** ៖ ទំព័រស្កេន ➜ 🗑️ ស្កេនដកកញ្ចប់ ➜ ចុចកន្លែងវាយ Barcode (keyboard ខ្មែរ ឬអង់គ្លេស) ➜ ទំព័រ និង navbar នៅនឹងកន្លែង · ចុចម្តងទៀតក៏ដូច្នេះ ·
   បន្ទាប់មកចុចប្រអប់ស្វែងរក 📦 បញ្ជីកញ្ចប់ ➜ ប្រអប់ស្វែងរកនៅកំពូល (navbar ឃើញ) ភ្លាម។
5. **ម៉ាស៊ីនស្កេន Bluetooth (ទូរស័ព្ទ) · USB (កុំព្យូទ័រ)** ៖ ទំព័រស្កេន ➜ មិនចុចប្រអប់ ➜ ស្កេន ➜ ផ្ទាំងបញ្ជាក់បើកជាមួយ Barcode ត្រឹមត្រូវ · ស្កេនបន្តបន្ទាប់ (ក្រោយរក្សាទុក)
   មិនបាត់ · ប្តូរ keyboard ជាខ្មែរ ➜ ស្កេន ➜ Barcode ជាលេខឡាតាំង · ម៉ាស៊ីនកំណត់ suffix Tab ក៏បញ្ជូន · កំពុងវាយក្នុងប្រអប់ស្វែងរក ➜ ការស្កេនចូលប្រអប់ស្វែងរក។
6. **ម៉ាស៊ីនស្កេន ពេលផ្ទាំង «🎉 ស្កេនបានជោគជ័យ!» បើក** ៖ ស្កេន A ➜ ផ្ទាំង A បើក ➜ ចុចប្រអប់ COD ➜ ស្កេន B ➜ COD នៅទទេ · ឃើញ «📥 ការស្កេនតាមជួរ» ➜ រក្សាទុក ឬបោះបង់ A ➜
   ផ្ទាំង B បើកដោយខ្លួនឯង · Auto save (lookup ស្គាល់លេខ) ពេលស្កេនបន្តបន្ទាប់លឿនៗ ➜ A · B · C រក្សាទុកតាមលំដាប់ លុយត្រូវ · វាយលេខទូរស័ព្ទ/COD ដោយដៃនៅធម្មតា
   (បើអក្សរយឺត ឬបាត់ ➜ ប្រាប់ខ្ញុំ)។
7. **Fast Mode** ៖ ផ្ទាំងស្កេនបើក ➜ វាយ COD «7810122334455» ➜ «យល់ព្រម» ➜ ⚠️ មិនរក្សាទុក ផ្ទាំងនៅ ➜ កែជាចំនួនពិត ➜ រក្សាទុក ·
   ម៉ាស៊ីនស្កេនដែលមិនទាន់កំណត់ Enter/Tab ➜ ស្កេនពេលផ្ទាំងបើក ➜ ⚠️ ប្រាប់ឲ្យកំណត់ Enter/Tab (COD មិនប្រែ)។
8. **Lookup (ZTO) ពេលកំពុងវាយ** ៖ ស្កេន ➜ ចុច COD ហើយវាយភ្លាម (មុន lookup ចប់) ➜ lookup ស្គាល់ ➜ មិនរក្សាទុកស្វ័យប្រវត្តិ · ឃើញ ℹ️ COD/DOD
   ពី ZTO · cursor នៅ COD ➜ វាយចប់ ➜ «យល់ព្រម» · មិនវាយអ្វី ➜ Auto save ដូចធម្មតា។
9. **ទូរស័ព្ទផ្តេក (APK · Chrome Android · iPhone)** ៖ បង្វិលទូរស័ព្ទ ➜ ទំព័រស្កេន ➜ ប៊ូតុងរបៀប · កាមេរ៉ានៅឆ្វេង · កន្លែងវាយ Barcode · «📁» · «📋 បញ្ចូលច្រើន» នៅស្តាំខាងលើ
   ពីលើរបា Tab (មិនបាច់អូស) · ចុចកន្លែងវាយ ➜ keyboard លោត ទំព័រមិនរំកិល កន្លែងវាយនៅពីលើ keyboard · 🗑️ របៀបដក ដូចគ្នា · បើកកាមេរ៉ាផ្តេក ➜ ស្កេនបាន ·
   បង្វិលត្រឡប់បញ្ឈរ ➜ ដូចមុន (ជួរឈរតែមួយ · រូប Tab នៅលើអក្សរ) ·
   ទំព័រទិន្នន័យផ្តេក ➜ ប៊ូតុងតម្រងថ្ងៃចុចបាន។
10. **កុំព្យូទ័រ (Chrome · Edge) ៖ NIIMBOT** ៖ ផ្ទាំងបោះពុម្ពស្លាក ➜ «🖼️ រក្សាទុកជារូបភាព» ➜ PNG ទាញយកចូល Downloads (មួយស្លាកមួយឯកសារ · Browser អាចសួរ «ទាញយកឯកសារច្រើន» ➜ អនុញ្ញាត) ·
   ✅ គ្មាន ❌ ➜ ផ្ញើ PNG ទៅទូរស័ព្ទ ➜ App NIIMBOT បញ្ចូលរូប ➜ បោះពុម្ព · ទូរស័ព្ទ ➜ ផ្ទាំង Share ដូចមុន។

### [2.50.80] — 2026-10-15 · ZoeW ៖ **APK ៖ ប្រអប់មិនញ៉ាក់ពេល keyboard លោតចប់ · iPhone ៖ ចុចកន្លែងវាយ Barcode ទំព័រមិនធ្លាក់ · បញ្ជី Locker មិនធ្លាក់ពេលជ្រើសទីតាំង**

**ZoeW `2.50.80`** (`zoew-v342` ➜ `zoew-v343`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `chrome-autohide.ts` · `app.css` · ZTO) មិនប៉ះ —
ការកែក្នុង `modal-keyboard.ts` (ហៅ `noteKeyboardViewport()` ដែលមានរួចក្នុង `chrome-autohide.ts` · មិនកែឯកសារនោះ) · `entry-search.ts` · `LockerListFilterSelect.tsx` · `refs.ts`។
រាយការណ៍ម្ចាស់គម្រោង (វីដេអូ iPhone ១ · APK ១ លើ 2.50.79) ៖ «Android នៅតែញ៉ាក់ពេល keyboard លោតមក ios modal លែងអីហើយ តែមកកើតលើ កន្លែងវាយបញ្ចូល barcode វិញ» ·
បន្ទាប់មក ៖ «Ios ពេលប្រអប់ស្វែងរក📍 បញ្ជីទីតាំង Lockerកំពុងតែ ឡើង ហើយពេលចុច ទីតាំងទាំងអស់ ធ្លាក់មកភ្លាមធ្វើអោយសល់ កន្លែង select ទីតាំង · គ្រប់ modal លើ android មិនមែនគ្រាន់តែ modal បញ្ចូលច្រើន ទេ»។

#### អ្វីដែលខុសពីមុន

- 🐛 **APK ៖ ប្រអប់លោតឡើងហើយត្រឡប់ពេល keyboard លោតចប់** (គ្រប់ប្រអប់ · ផ្នែក ២ A110)។ ពេល `KeyboardOpenHold` ចប់ WebView បង្រួម ប៉ុន្តែ Chromium នៅរាយការណ៍ inset keyboard
  ចាស់ពីរបីស៊ុម ➜ ការតម្រូវ Android ឃើញ keyboard ពីលើ WebView ដែលបង្រួមរួច ➜ ច្របាច់ប្រអប់ទៅកំពូល (412×915 ៖ PIN កំពូល 178 ➜ 13 ➜ 178)។ ឥឡូវ `uiState.keyboardOpen`
  (WebView បង្រួមសម្រាប់ keyboard) ➜ គ្មានការតម្រូវ (`keyboardVisibleViewport()` ➜ null) · `noteKeyboardViewport()` រត់លើ visualViewport `resize` មុនការវាស់ ហើយការប្តូរ
  `keyboardOpen` វាស់ម្តងទៀត (លំដាប់ព្រឹត្តិការណ៍ណាក៏ដោយ)។ iPhone · PWA Chrome មិនប្រែ (`keyboardOpen` តែ APK)។
- 🐛 **iPhone ៖ ទំព័រស្កេន ➜ ចុចកន្លែងវាយ Barcode ➜ ទំព័រ និង navbar ធ្លាក់ចុះហើយរអិលត្រឡប់** (A111)។ កន្លែងវាយនេះនៅក្រៅប្រអប់ ➜ ការចុចទៅផ្លូវ iOS ដើម ➜ WebKit
  រំកិលទំព័រពេល keyboard លោត។ ឥឡូវ (iOS standalone · គ្មានប្រអប់បើក) ការចុចកន្លែងវាយ Barcode ដែលនឹងនៅពីលើ keyboard (`pageFieldStaysAboveKeyboard()` ៖ inset ធំបំផុតដែលវាស់បាន
  នៅទទឹងនេះ ឬ `PAGE_TAP_KEYBOARD_RATIO` ៥០% នៃកម្ពស់) ➜ `touchend` preventDefault + `focus({ preventScroll })` ដូចកន្លែងវាយក្នុងប្រអប់ · iPad (UA កុំព្យូទ័រ ៖ App focus កន្លែងវាយ
  ដោយកូដ គ្មាន keyboard) ➜ ចាប់ដូចគ្នា · keyboard នឹងបាំងកន្លែងវាយ (iPhone ផ្តេក · iPad ផ្តេក) ➜ iOS ធ្វើខ្លួនឯង ដើម្បីបង្ហាញវា។ Android មិនប្រែ។
- 🐛 **ទំព័រស្កេន «📍 បញ្ជីទីតាំង Locker» ៖ ស្វែងរកឡើង ➜ ចុច «ទីតាំងទាំងអស់» ➜ បញ្ជីធ្លាក់ចុះ សល់តែ select** (A112 · គ្រប់ឧបករណ៍)។ ចុច select ➜ ប្រអប់ស្វែងរក blur ➜
  `entrySearchBlurred()` ឃើញប្រអប់ទទេ ➜ បើកផ្ទាំងស្កេនវិញ ➜ បញ្ជីធ្លាក់ពីក្រោយ picker។ ឥឡូវ select ទីតាំងជាផ្នែកនៃការស្វែងរក (`entrySearchInUse()`) ៖ focus ទៅ select ឬទីតាំងដែលជ្រើស
  ➜ ផ្ទាំងនៅបង្រួម (បញ្ជីនៅខាងលើ) · ចាកចេញពី select ពេលស្វែងរកទទេ និង «ទីតាំងទាំងអស់» ➜ បើកវិញ។ ការអូស/handle បើកផ្ទាំងបានជានិច្ច។

#### អ្នកយាម

- `modal-keyboard-device-test` ៖ (ក) APK +ជំហាន «inset ចាស់» (setViewportSize បង្រួម ខណៈ visualViewport នៅរាយការណ៍ keyboard ➜ ប្រអប់នៅទីតាំងដដែល ±1px · ៥ ទំហំ × ១៧ ប្រអប់) ·
  (គ) ថ្មី ៖ កន្លែងវាយ Barcode លើ App ពិត × iPhone SE 375×667 · iPhone 393×852 · Pro Max 430×932 (ចាប់ · `preventScroll` · document ០ · keyboard បើក ➜ iOS) · iPad បញ្ឈរ
  (focus ដោយកូដ ➜ ចាប់) · ទិសផ្ទុយ iPhone ផ្តេក · iPad ផ្តេក (keyboard ពិតបាំង ➜ iOS) — លើ `72cd9a4` (មុនកែ) FAIL ៩ (APK ៥ · iPhone/iPad ៤) ➜ ២១/២១។
- `ZoeW/tests/search-glide-hold.test.ts` +១ ៖ ស្វែងរក Locker ឡើង ➜ focus select ➜ នៅបង្រួម · ជ្រើសទីតាំង ➜ នៅបង្រួម · «ទីតាំងទាំងអស់» ➜ បើកវិញ · ប្រអប់ស្វែងរកចាកចេញទទេ ➜ បើកវិញ —
  មុនកែ FAIL · `native:check` (`history-window-check`) +៣ (APK · PWA Android · PWA iPhone ៖ App ពិត · ref + `onBlur` លើ select ពិត) — មុនកែ FAIL ៣ ➜ ០ FAIL។
- `ZoeW/tests/modal-keyboard.test.tsx` +២ ៖ hold ចប់ + inset ចាស់ ➜ `keyboardOpen` · គ្មាន `.modal-kb` · `keyboardCover` ០ (visualViewport មុន/ក្រោយ window `resize`) · កន្លែងវាយ
  Barcode ៖ ចាប់ · keyboard បើក ➜ iOS · keyboard ធ្លាប់វាស់ (៣៣៦) កំណត់បន្ទាត់ · ផ្តេក ➜ iOS · focus ដោយកូដ ➜ ចាប់ · កន្លែងវាយផ្សេង · ប្រអប់បើក · មិនមែន iOS ➜ មិនប៉ះ — មុនកែ FAIL ២។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ) ➜ APK ថ្មី `zoew-android-v2.50.80` (workflow `main`) · សាក APK មុន merge ៖ Actions ➜ `android-release.yml` ➜
   Run workflow លើ branch ➜ Pre-release `…-test.<commit>`។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **APK** ៖ បើក PIN · «📋 បញ្ចូលច្រើន» · កែលេខ ➜ ចុចកន្លែងវាយ ➜ ប្រអប់ផ្លាស់ទីតែម្តងពេល keyboard ចាប់ផ្តើម ហើយនៅស្ងៀមពេល keyboard លោតចប់ (គ្មានការលោតឡើងហើយត្រឡប់)។
2. **iPhone (PWA)** ៖ ទំព័រស្កេន ➜ ចុចកន្លែងវាយ Barcode ➜ keyboard លោតឡើង ទំព័រ និង navbar នៅនឹងកន្លែង · វាយ/ស្កេន ➜ Enter ធម្មតា · iPhone ផ្តេក ➜ iOS បង្ហាញកន្លែងវាយពីលើ keyboard។
3. **iPad (PWA)** ៖ ទំព័រស្កេន ➜ ចុចកន្លែងវាយ Barcode (បញ្ឈរ) ➜ ទំព័រនៅនឹងកន្លែង។
4. **iPhone · Android** ៖ ទំព័រស្កេន ➜ 📍 កំណត់ទីតាំង Locker ➜ ចុចប្រអប់ស្វែងរក (បញ្ជីឡើង) ➜ ចុច «ទីតាំងទាំងអស់» ➜ បញ្ជីនៅខាងលើ · ជ្រើសទីតាំង ➜ បញ្ជីច្រោះ ·
   ជ្រើស «ទីតាំងទាំងអស់» វិញ (ស្វែងរកទទេ) ➜ ផ្ទាំងស្កេនបើកវិញ។
5. **APK** ៖ សាកប្រអប់ផ្សេងៗ (PIN · កែលេខ · កែតម្លៃ · Config · API ស្វែងរកអតិថិជន · Login …) ➜ គ្រប់ប្រអប់ផ្លាស់ទីតែម្តង (ការកែមួយសម្រាប់គ្រប់ប្រអប់ · វាស់ ១៧ ប្រអប់ × ៥ ទំហំ)។

### [2.50.79] — 2026-10-15 · ZoeW ៖ **បោះពុម្ព ៖ ប្តូរទំហំក្រដាស ➜ ទិន្នន័យនៅ · APK ៖ ប្រអប់ផ្លាស់ទីតែម្តងពេល keyboard លោត · iPhone ៖ «បញ្ចូលច្រើន» ទំព័រមិនធ្លាក់**

**ZoeW `2.50.79`** (`zoew-v341` ➜ `zoew-v342`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · ZTO) មិនប៉ះ —
ការកែក្នុង `export.ts` · `file-output.ts` · `modal-keyboard.ts` · `Modal.tsx` · `state.ts` (`ModalKeyboardFit.hold`) · `PdfPrintArea.tsx` · `HealthAdviceBox.tsx` · `label-print.ts` ·
`label-image.ts` (ថ្មី) · `LabelPrintModal.tsx` · `action-registry.ts` · `runtime.ts` · `react-root.css` · `guide.html`។
រាយការណ៍ម្ចាស់គម្រោង (វីដេអូ iPhone ២ · APK ១ លើ 2.50.78) ៖ «គ្រប់យ៉ាងដំណើរការត្រឹមត្រូវហើយ តែនៅមានចំណុចទើសភ្នែក ៖ លើ iOS ពេលបើក modal បញ្ចូលច្រើន ហើយចុចឲ្យចេញ keyboard
ទំព័រទាំងមូលធ្លាក់ចុះមួយភ្លែត · android កន្ត្រាក់ ២ ដង ពេល keyboard លោតឡើង គ្រប់ modal · ពេលប្តូរ Paper size កន្លែង print បាត់ទិន្នន័យពី ZoeW ឃើញតែក្រដាស ស ទាំង iOS និង android» ·
បន្ទាប់មក ៖ «វាស់គ្រប់ទំហំអេក្រង់ គ្រប់ប្រភេទឧបករណ៍ផង ក្រែងមានចន្លោះឬកំហុស · សូមដូរ emoji 🧠 ចេញ ដាក់ 💡 · ហើយបើក pr ផង»។

#### អ្វីដែលខុសពីមុន

- 🐛 **បោះពុម្ព ៖ ប្តូរ Paper size ➜ ក្រដាសស** (iPhone · APK · ផ្នែក ២ A102)។ ទូរស័ព្ទគូរទំព័របោះពុម្ពម្តងទៀតរាល់ពេលប្តូរក្រដាស ហើយផ្ញើ `afterprint` ក្រោយការគូរនីមួយៗ
  (ខណៈផ្ទាំងបោះពុម្ពនៅបើក) · `afterprint` ដំបូងសម្អាត `pdfExportView` ➜ ការគូរបន្ទាប់ទទេ។ ឥឡូវ `afterprint` គ្រាន់តែរង់ចាំ (`armPdfExportRestore()`) ៖ ទិដ្ឋភាពបោះពុម្ពនៅរហូតដល់
  ការប៉ះ App វិញ (`pointerdown` · `keydown`) · ការបោះពុម្ពថ្មីចាប់ផ្តើមពីសូន្យ · logout សម្អាតភ្លាម · APK ត្រឡប់ពីផ្ទាំងបោះពុម្ព (`resume` ➜ `PRINT_RETURNED_EVENT`) សម្អាតភ្លាម។
- 🐛 **ស្លាក ៖ ក្រដាស A5 · ប្លង់ A4 ៣ ជួរឈរ ➜ លេខ Barcode ហួសស្លាក** (A105 ៖ រកឃើញដោយការវាស់គ្រប់ទំហំក្រដាស)។ ឥឡូវលេខ Barcode បង្រួមល្មមស្លាកដូចលេខទូរស័ព្ទ និងលុយ
  (`--label-code-chars` · `--label-code-max` តាមប្លង់ · មួយបន្ទាត់)។
- ✨ **🩺 ពិនិត្យសុខភាព ៖ ការណែនាំក្រោមបញ្ជីប្រើរូប 💡** (សំណើម្ចាស់គម្រោង) — App · `guide.html` · README។
- ✨ **បោះពុម្ពស្លាកឆ្លាតវៃ ៖ ក្រដាសតាមផ្ទាំងបោះពុម្ព** (សំណើម្ចាស់គម្រោង ៖ «ធ្វើអោយវាឆ្លាតវៃ អាចឆ្លាស់គ្រប់ប្រភេទក្រដាស» · A106)។ ដក `@page … { size }` ដែលបង្ខំ
  (Chromium · WebView Android គោរពវាទោះជ្រើសក្រដាសអ្វី ➜ ស្លាកតូចមួយក្នុង A4 មួយ · ទំព័រទទេឆ្លាស់លើរមូរ · «single» លើ 50×30 បែកជា ៥ ទំព័រ) ➜ ក្រដាសស្លាក (`max-width: 75mm` ឬ
  `max-height: 50mm` · margin ១.៥mm) ➜ គ្រប់ប្លង់ ១ ស្លាក/ទំព័រល្មមក្រដាស · ក្រដាសធំ ➜ ស្លាក 50×30 · 40×30 · 60×40 តម្រៀបទំហំពិត (មានបន្ទាត់កាត់) · A4 ៣/២ ជួរឈរ
  បន្ថយជួរឈរលើក្រដាសតូច (A5 · 4×6in)។ ផ្ទាំងបោះពុម្ពមានសារណែនាំ 💡 អំពីក្រដាស។
- ✨ **ស្លាកជារូបភាព (NIIMBOT B1 · App ស្លាក)** (សំណើរបស់ខ្ញុំ · ម្ចាស់គម្រោងយល់ព្រម · A107)។ ប៊ូតុង «🖼️ រក្សាទុកជារូបភាព» ➜ PNG មួយស្លាកមួយ ទំហំពិត
  (`drawLabelImage()` ៖ ៨ ចំណុច/mm = 203dpi · 50×30 ➜ 400×240 · ស-ខ្មៅសុទ្ធសម្រាប់ម៉ាស៊ីនកម្តៅ) ➜ `shareImageFiles()` ៖ iPhone/Android Web Share (ឯកសារ) · APK Filesystem +
  Share មួយដង · កុំព្យូទ័រ ទាញយក · ≤ `LABEL_IMAGE_MAX` ២០០ ក្នុងមួយដង។
- 🐛 **APK ៖ ប្រអប់កន្ត្រាក់ ២ ដងពេល keyboard លោត** (គ្រប់ប្រអប់ · A103)។ `KeyboardOpenHold` រក្សាកម្ពស់ WebView ពេល keyboard លោត ប៉ុន្តែ visualViewport បង្រួមភ្លាម ➜
  ការតម្រូវ (ច្បាប់ iPhone ៖ បាតត្រឹម keyboard) ផ្លាស់ទីប្រអប់ម្តង ➜ ចប់ចលនា WebView បង្រួម ➜ ប្រអប់ចូលកណ្តាលវិញ ផ្លាស់ទីលើកទីពីរ (PIN ៖ ផ្លាស់ទីតែពេលចប់)។
  ឥឡូវលើ Android (`isAndroidDevice()` ៖ APK និង PWA Chrome ដែលបង្រួមក្រោយ keyboard ដែរ · A75) ការតម្រូវដាក់ប្រអប់នៅកណ្តាលផ្ទៃពីលើ keyboard ដូចប្លង់ក្រោយ viewport បង្រួម
  (`modalKeyboardHoldFitFor()` ៖ padding · ៨៥vh តាមកម្ពស់ថ្មី) ➜ ផ្លាស់ទីតែម្តងពេល keyboard ចាប់ផ្តើម · «នាំចូល Excel ទៅ Sheet» រក្សាប្លង់ flex (`modal-kb-hold`)។ iPhone មិនប្រែ។
- 🐛 **iPhone ៖ «📋 បញ្ចូលច្រើន» ➜ ចុចកន្លែងវាយ ➜ ទំព័រទាំងមូលធ្លាក់ចុះ ១៣០pt ហើយលោតត្រឡប់** (A104)។ ប្រអប់ focus កន្លែងវាយដោយកូដ (១៥០ms សម្រាប់ម៉ាស៊ីនស្កេន) ដោយ iOS
  មិនបើក keyboard · ការចុចលើកន្លែងវាយដែល focus រួចទៅផ្លូវ iOS ដើម ➜ WebKit រំកិលទំព័រពេល keyboard លោត ➜ `restoreIOSDocumentScroll()` ទាញត្រឡប់ ០ កណ្តាលចលនា។
  ឥឡូវ កន្លែងវាយដែល focus រួច តែ keyboard មិនទាន់បើក (ហើយមិនទាន់ចុចម្តង) ➜ ចាប់ការចុចដូចកន្លែងវាយមិនទាន់ focus (blur + `focus({ preventScroll })`) ·
  keyboard បើករួច ឬចុចរួចម្តង (keyboard អណ្តែតលើ iPad) ➜ iOS ធ្វើខ្លួនឯង (caret តាមកន្លែងចុច)។

#### អ្នកយាម

- `ZoeW/tests/print-relayout.test.tsx` (ថ្មី · ៥) ៖ ស្លាក · PDF តារាង ៖ `beforeprint`/`afterprint` ៣ ដង ➜ ស្លាក/ជួរនៅ · ប៉ះ/ចុចគ្រាប់ចុច ➜ សម្អាត + ចំណងជើងដើម ·
  ការប៉ះមុន `afterprint` មិនសម្អាត · ការបោះពុម្ពថ្មី · APK `PRINT_RETURNED_EVENT` ➜ សម្អាតភ្លាម · logout — លើកូដចាស់ FAIL ៣ · `label-print.test` ៖ ការអះអាង «afterprint សម្អាត» (ចាក់សោកំហុស) ➜ ប៉ះ App វិញទើបសម្អាត។
- `modal-keyboard-device-test` (ថ្មី · ដាច់ពី `modal-keyboard-test` ដែលជិតពិដាន ៣០០ វិ.) ៖ Android ៧ ប្រភេទ (APK ទូរស័ព្ទតូច 360×640 · ទូរស័ព្ទ 412×915 · ផ្តេក 915×412 ·
  tablet បញ្ឈរ 800×1280 · tablet ផ្តេក 1280×800 · PWA Chrome 412×915 · 360×740) × គ្រប់ប្រអប់ដែលមានកន្លែងវាយ (១៧ · ដេរីវេពី DOM = ១១៩ ករណី) ៖ ទីតាំងពេលលោត = ក្រោយ viewport បង្រួម (±1px) ·
  បាតនៅពីលើ keyboard · កន្លែងវាយមើលឃើញ · iPhone 393×852 · iPad 820×1180 × ១៧ ប្រអប់ ៖ focus ដោយកូដ ➜ ចុច ➜ preventDefault · `preventScroll` · keyboard បើក ➜ iOS ·
  «បញ្ចូលច្រើន» ពិត · ទិសផ្ទុយ (Android មិនប៉ះការចុច · iPhone នៅច្បាប់បាតត្រឹម keyboard) — លើ `655677e` (មុនកែ) FAIL ១១ (ឧ. PIN 343 ➜ 343 ➜ 178) ➜ ១៥/១៥។
- `layout-check` +២ ៖ `printRelayoutPdf` (Chromium `page.pdf()` ផ្ញើ `beforeprint`/`afterprint` ពិតរាល់ PDF ដូចទូរស័ព្ទ ៖ ស្លាក ៦ ប្លង់ + តារាង PDF × ក្រដាស ៦ = ៤២ PDF ៖
  DOM + ចំនួនទំព័រ PDF · ចុច App វិញ ➜ សម្អាត) — លើ `655677e` ៖ A4 ២៤ ទំព័រ ➜ A3 «១ ទំព័រ» ស (ដូចវីដេអូ) FAIL · `labelPrintFit` ក្រដាស ២ ➜ ៤ (+ Letter · A5) — មុនកែ FAIL ២ (A5 ៖ លេខ Barcode ហួស)។
- `native:check` ៖ ត្រឡប់ពីផ្ទាំងបោះពុម្ព (resume) ➜ ចំណងជើងវិញ (ក្រោយប្តូរ `afterprint` ការអះអាងនេះធ្លាក់ ➜ `PRINT_RETURNED_EVENT`) · ស្លាកជារូបភាពលើ APK (PNG ៤ = ៤ ក្នុង
  Cache/labels · Share ១ ដង) · `health-advice.test` +១ (💡 · មុនកែ FAIL)។
- `layout-check` ៖ `printRelayoutPdf` ក្រដាស ៦ ➜ ១០ (+ 4×6in · ក្រដាសស្លាក 50×30 · 40×30 · 60×40) + ការអះអាងឆ្លាតវៃ (រមូរ ➜ ២៤/២៤ ទំព័រ · ក្រដាសធំ ➜ ≥ ២ ស្លាក/ទំព័រ) ·
  `labelPrintFit` ក្រដាស ៤ ➜ ៨ (+ 4×6in · ក្រដាសស្លាក ៣ ៖ ស្លាកល្មមមួយទំព័រ) — មុនកែ FAIL ៥ · `labelImageExport` (ថ្មី ៖ ទំហំ PNG · ខ្លឹមសារមិនប៉ះគែម · ZXing អាន Barcode
  វិញ · ឈ្មោះ · `navigator.share`) — មុនកែ FAIL · `ZoeW/tests/label-image.test.tsx` (ថ្មី · ៥) · `label-print.test` ៖ ការអះអាង `@page zoeLabel… { size }` (ចាក់សោកំហុស) ➜ គ្មានទំហំបង្ខំ។
- `ZoeW/tests/modal-keyboard.test.tsx` +៤ ៖ `modalKeyboardHoldFitFor()` (តម្លៃពីវីដេអូ · ៨៥vh តាមកម្ពស់ថ្មី · NaN/០) · ចុចកន្លែងវាយដែល focus ដោយកូដ ➜ ចាប់ · keyboard បើក /
  ចុចរួចម្តង ➜ iOS · focus ម្តងទៀតដោយកូដ ➜ ចាប់វិញ — ការអះអាងចាស់ «focus រួច ➜ iOS ជានិច្ច» (ចាក់សោកំហុស) ចែកជាករណីទាំងនេះ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ) ➜ APK ថ្មី `zoew-android-v2.50.79` (workflow `main`)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **បោះពុម្ព (iPhone · APK)** ៖ 🖨️ បោះពុម្ពស្លាក ឬ Export PDF ➜ ប្តូរ Paper size (A4 ➜ A3 ➜ A5 ➜ Letter) · ទិសក្រដាស ➜ ទិន្នន័យនៅគ្រប់ទំព័រ · ត្រឡប់មក App ➜ ប្រើធម្មតា។
2. **APK · PWA Android** ៖ «📋 បញ្ចូលច្រើន» · PIN · កែលេខ · Config ➜ ចុចកន្លែងវាយ ➜ ប្រអប់ឡើងតែម្តងពេល keyboard ចាប់ផ្តើមលោត (មិនកន្ត្រាក់ពេល keyboard ឈប់)។
3. **iPhone PWA** ៖ «📋 បញ្ចូលច្រើន» ➜ ចុចកន្លែងវាយ ➜ ទំព័រ និង navbar នៅនឹងកន្លែង (មិនធ្លាក់ចុះ) · ចុចម្តងទៀតពេល keyboard បើក ➜ caret តាមកន្លែងចុច · **iPad** (keyboard អណ្តែត) ដូចគ្នា។
4. ⚠️ iPhone ៖ ការបោះពុម្ពលើកដំបូងអាចបង្ហាញ «This website has been blocked from automatically printing» (សារ iOS) ➜ «Allow»។ ☰ ➜ 🩺 ➜ ការណែនាំមានរូប 💡។
   ស្លាក A4 ៣ ជួរឈរ ➜ ក្រដាស A5 ➜ លេខ Barcode នៅក្នុងស្លាក។
5. **បោះពុម្ពឆ្លាតវៃ** ៖ ស្លាក 50×30 ➜ ក្រដាស A4 ➜ ស្លាកច្រើនក្នុងមួយទំព័រ · ម៉ាស៊ីនស្លាក (ក្រដាស 50×30) ➜ មួយស្លាកមួយទំព័រ គ្មានទំព័រទទេ។
6. **NIIMBOT B1** ៖ ផ្ទាំងបោះពុម្ពស្លាក ➜ «🖼️ រក្សាទុកជារូបភាព» ➜ រក្សាទុកក្នុង Photos/Gallery ➜ App NIIMBOT ➜ បញ្ចូលរូប (ស្លាក 50×30) ➜ បោះពុម្ព ➜ ស្កេន Barcode លើស្លាកដែលចេញ។
   សកម្មភាពរបស់ [2.50.67]–[2.50.78] នៅដដែល។

---

### [2.50.78] — 2026-10-15 · ZoeW ៖ **តេស្ត App ទាំងមូលតាមការប្រើប្រចាំថ្ងៃ គ្រប់ទំហំអេក្រង់ ➜ ស្លាកបោះពុម្ពសមក្រដាស · ក្រឡាស្ថិតិ · toast ពីលើរបា Tab · Enter ទៅប្រអប់បន្ទាប់**

**ZoeW `2.50.78`** (`zoew-v340` ➜ `zoew-v341`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែក្នុង `react-root.css` · `PdfPrintArea.tsx` (`LabelSheet`) · `PhoneModal.tsx`។
សំណើម្ចាស់គម្រោង ៖ «សូមតេស្ត app ទាំងមូល ទម្រង់បង្ហាញគ្រប់ទំហំ តាមសកម្មភាពប្រើប្រចាំថ្ងៃជាក់ស្តែង ដោយគំនិតរបស់អ្នក សាកល្បងមើលថាតើវាត្រឹមត្រូវតាមស្តង់ដារ app ទូទៅទេ»។
តេស្ត ៖ App ពិត (audit build · Firebase ក្លែង · ទិន្នន័យ ៣៩ ជួរ · font Kantumruy Pro/Inter ពិត) × ទំហំ ១៤ (ទូរស័ព្ទ ៥ · ទូរស័ព្ទផ្តេក ២ · iPad ៥ · កុំព្យូទ័រ ២) × ស្ថានភាព ៣៩
(ទំព័រទិន្នន័យ/ស្កេន/Locker/ដក · ☰ · 🔔 · ម៉ឺនុយ · ប្រអប់ ២៨ · ស្វែងរក · រមូរដល់ចុង) + លំហូរប្រចាំថ្ងៃ (ស្កេន ➜ រក្សាទុក · ស្ទួន · Locker · ដក · បិទ · លុប ➜ ស្តារ) ៖
គ្មាន scroll ផ្តេក · គ្មានធាតុលើសអេក្រង់ · ប្រអប់ ២៨ សមអេក្រង់ ប៊ូតុងទាំងអស់ចុចដល់ · លំហូរទាំងអស់មានសារ ✅/⚠️ ត្រឹមត្រូវ · គ្មាន error ក្នុង console — ចំណុចខុសស្តង់ដារដែលវាស់ឃើញ ៖

#### អ្វីដែលខុសពីមុន

- 🐛 **ក្រឡាស្ថិតិ «កញ្ចប់សរុប (នៅសល់)» · «ស្កេនតាមថ្ងៃ» · «អតិថិជនយក» មានប្រអប់ដាច់ៗ ផ្ទៃស និង padding ៣mm ជុំវិញស្លាក** (គ្រប់អេក្រង់ · ផ្នែក ២ A96)។
  CSS ស្លាកបោះពុម្ព (2.50.65) ប្រើឈ្មោះ class ទូទៅ `.label` ដែល `span.label` នៃក្រឡាស្ថិតិក៏ប្រើ ➜ ឥឡូវ CSS ស្លាកបោះពុម្ពទាំងអស់នៅក្រោម `.label-sheet` ➜ ស្លាកក្រឡាជាអក្សរតូចធម្មតា។
- 🐛 **ស្លាកបោះពុម្ព ៖ COD/DOD ត្រូវកាត់លើក្រដាស · លេខទូរស័ព្ទបំបែកបន្ទាត់ · A4 បញ្ឈរលើសក្រដាស** (A97)។ 60×40 ៖ «COD $25.00 · DOD $3.50» (៥៣.៥/៥៣.០mm) ·
  50×30 ៖ «COD $1234.56 · DOD $245.50» · 40×30 ៖ លុយបត់ ២ បន្ទាត់ ➜ ថ្ងៃ/Locker ហួសបាតស្លាក · លេខ ១២ ខ្ទង់ (+855…) បំបែក · A4 ៣ ជួរឈរ បញ្ឈរ ៖ ជួរឈរទី ៣ ហួសក្រដាស ៣១៦px។
  ឥឡូវ ស្លាកនីមួយៗជា container (`container-type: inline-size`) ➜ លេខទូរស័ព្ទ និងលុយបង្រួមល្មមទទឹងស្លាក (`--label-phone-chars` · `--label-money-chars` ពី `LabelSheet` ·
  ទំហំអតិបរមាតាម layout ដដែល) · មួយបន្ទាត់ · ក្រឡាចត្រង្គ A4 `minmax(0, 1fr)` ➜ ស្លាកទទឹងស្មើ មិនលើសក្រដាស។
- 🐛 **toast បាំងរបា Tab ខាងក្រោម** (ទូរស័ព្ទ · tablet < ៩៩២ · A98)។ toast (រាល់ការស្កេន/រក្សាទុក) នៅបាត ២៤px ➜ ជាន់ស្លាក «📋 ទិន្នន័យ» · «📷 ស្កេន» ➜
  ឥឡូវ toast នៅពីលើរបា Tab ១២px (ស្តង់ដារ snackbar ពីលើ bottom navigation) · របា Tab លាក់ (រមូរ) / desktop / keyboard បើក ➜ ដូចដើម។
- 🐛 **ចំនួនរៀលសរុបប្រចាំថ្ងៃ ៖ «៛» ធ្លាក់ទៅបន្ទាត់ថ្មីម្នាក់ឯង** (៣២០ · iPad · ១២៨០ · A99) ➜ «61,203,160 ៛» នៅបន្ទាត់តែមួយ។
- ✨ **ប្រអប់ស្កេន ៖ Enter ទៅប្រអប់បន្ទាប់** (A100)។ លេខទូរស័ព្ទ ➜ Locker ➜ COD ➜ DOD (`enterKeyHint` next · DOD done ➜ បិទ keyboard) ⛔ Enter មិនរក្សាទុក
  (ម៉ាស៊ីនស្កេនផ្ញើ Enter ក្រោយ Barcode ➜ ការស្កេនខុសប្រអប់មិនក្លាយជាលេខ/លុយដែលរក្សាទុក)។ ✨ ✖ បិទ (ផ្ទាំង ☰ · 🔔 · ប្រអប់ស្កេន · ២៨px) មានផ្ទៃចុច ៤៤×៤៤ (រូបរាងដដែល)។
  ⛔ ☰ · 🔔 ក្នុង navbar មិនពង្រីក ៖ Chromium (touch adjustment) បញ្ជូនការចុចក្រោម navbar ទៅប៊ូតុង ➜ PTR មិនចាប់ផ្តើម (ផ្នែក ២ A101)។

#### អ្នកយាម

- `layout-check` +៤៣ ៖ ក្រឡាស្ថិតិគ្មាន CSS ស្លាកជ្រាប (ទំហំ ៨ · ទិសផ្ទុយ ៖ ស្លាកក្នុង `.label-sheet` នៅមានគែម) · «៛» មិនធ្លាក់ម្នាក់ឯង (Range តួលេខ ⟷ «៛») ·
  `toastTabbarLayout` (៥ ទំហំ · `chrome-hidden` · desktop) · `labelPrintFit` (`LabelSheet` ពិត · media print · ៨ ទំហំលុយ × ៦ layout × A4 ផ្តេក/បញ្ឈរ · font 'Liberation Sans') ·
  `tapTargetLayout` (elementFromPoint គែម ±២១px · អង្កត់ទ្រូង ±១៥px · ទិសផ្ទុយ ៖ ☰ · 🔔 មិនពង្រីកចុះក្រោម · មិនលួចការចុចធាតុផ្សេង) · `phoneModalEnterNext` — លើ `203be0b` FAIL ២២ ➜ ក្រោយកែ ២១៨/២១៨។
- `modal-keyboard-test` ៖ ទីតាំងដើមរបស់ toast (keyboard បិទ) = ពីលើរបា Tab ពេលវាបង្ហាញ · `ZoeW/tests/label-print.test.tsx` ៖ CSS ស្លាកនៅក្រោម `.label-sheet` តែប៉ុណ្ណោះ (លើ CSS ចាស់ FAIL)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **បោះពុម្ពស្លាកពិត** (50×30 · 60×40 · A4) ៖ កញ្ចប់មានទាំង COD និង DOD ➜ ចំនួនលុយពេញក្នុងស្លាក · លេខទូរស័ព្ទមួយបន្ទាត់ · A4 បញ្ឈរ ៣ ជួរឈរ មិនកាត់។
2. **iPhone · Android** ៖ ក្រឡាស្ថិតិ ៣ ជាអក្សរធម្មតា · ស្កេន ➜ toast នៅពីលើរបា «ទិន្នន័យ · ស្កេន»។
3. **Android/កុំព្យូទ័រ** ៖ ប្រអប់ស្កេន ➜ វាយលេខ + Enter ➜ ទៅ Locker ➜ COD ➜ DOD · Enter លើ DOD មិនរក្សាទុក (ចុច «យល់ព្រម»)។
4. សកម្មភាពរបស់ [2.50.67]–[2.50.77] នៅដដែល។

---

### [2.50.77] — 2026-10-15 · ZoeW ៖ **ប្រអប់ + keyboard ➜ ទំព័រខាងក្រោយ និង navbar នៅនឹងកន្លែង · វាស់គ្រប់ប្រអប់លើទូរស័ព្ទ និង tablet បញ្ឈរ/ផ្តេក**

**ZoeW `2.50.77`** (`zoew-v339` ➜ `zoew-v340`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែក្នុង `refs.ts` (`focusField()`) · `ios-viewport.ts` · `react-root.css` · `guide.html`។
រាយការណ៍ម្ចាស់គម្រោង ៖ «📋 បញ្ចូលច្រើន ពេលបើក keyboard ពេលខ្លះ ផ្ទៃ background រអិលទៅលើ បាត់ navbar ដូចក្នុងរូប · សូមពិនិត្យ វាស់គ្រប់ modal អោយត្រូវស្តង់ដារ
គ្រប់ទំហំអេក្រង់ រួមទាំង tablet ផ្តេក ឬ បញ្ឈរ»។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone ៖ ប្រអប់ + keyboard ➜ ទំព័រខាងក្រោយរអិលឡើង · navbar បាត់ (ពេលខ្លះ)** (ផ្នែក ២ A95)។ `openBatchScanModal()` focus ប្រអប់វាយ ១៥០ms ក្រោយចុច (សម្រាប់ម៉ាស៊ីនស្កេន)
  ដោយ `focusField()` គ្មាន `preventScroll` ➜ ពេល iOS បើក keyboard (មិនមែនរាល់ដង ៖ focus ក្នុង `setTimeout`) វារំកិល document ដើម្បីបង្ហាញប្រអប់វាយ ➜ navbar ចេញពីអេក្រង់ ·
  ប្រអប់កែលេខ · លេខទូរស័ព្ទក្រោយស្កេន · Activate · ចូលប្រព័ន្ធ (ចុះឈ្មោះ · ប្តូរពាក្យសម្ងាត់) focus ដោយកូដដូចគ្នា · ការការពារ «document ត្រឡប់ ០» មានតែពេលស្វែងរក។ ឥឡូវ ៖
  `focusField()` បន្ថែម `preventScroll` ជានិច្ចលើប្រអប់វាយក្នុង `.modal` (ប្រអប់តម្រូវខ្លួនពីលើ keyboard ដោយខ្លួនឯង) · ខណៈប្រអប់បើកលើ iPhone standalone document រំកិល ➜
  ត្រឡប់ ០ (`restoreIOSDocumentScroll()` ដូចពេលស្វែងរក) · Android/web មិនប្រែ។
- 🐛 **ទូរស័ព្ទផ្តេក ៖ «នាំចូល Excel ទៅ Sheet» + keyboard ➜ ផ្ទៃរមូរខាងក្នុងនៅ ៤px · ប្រអប់វាយមើលមិនឃើញ** (A95)។ កាត flex (`.si-modal-content` ៖ ក្បាល · ផ្ទៃរមូរ · ប៊ូតុង)
  ក្នុងកម្ពស់ ១៧០px ពីលើ keyboard ➜ ក្បាល និងប៊ូតុងយកស្ទើរទាំងអស់។ ឥឡូវ ពេលតម្រូវពីលើ keyboard (`.modal-kb`) កាតនោះជាអ្នករមូរតែមួយ (`display: block`) ➜ ប្រអប់វាយរមូរមកមើលឃើញ។

#### អ្នកយាម

- `modal-keyboard-test` ៖ ទំហំ ៧ (ទូរស័ព្ទ ៤ · ទូរស័ព្ទផ្តេក 844×390 · iPad បញ្ឈរ 820×1180 · iPad ផ្តេក 1180×820 + status bar ក្លែង) × គ្រប់ប្រអប់វាយ (៣៤) · (ក) `focusField()` លើគ្រប់ប្រអប់វាយ (ref)
  ក្នុងគ្រប់ប្រអប់ និង `openBatchScanModal()` ពិត ➜ `preventScroll` · (ខ) document រំកិល ២២០px ខណៈប្រអប់បើក ➜ ០ (iOS) · គ្មានប្រអប់ / Android ➜ មិនប៉ះ — លើ `13a0421` FAIL ៤
  (ទូរស័ព្ទផ្តេក `sheetImportModal` · (ក) ៣៤ ករណី + «បញ្ចូលច្រើន» · (ខ) ២២០) ➜ ក្រោយកែ ៥៣/៥៣។
- `ZoeW/tests/modal-keyboard.test.tsx` +២ (`focusField()` ក្នុង/ក្រៅប្រអប់ · `openBatchScanModal()` ក្រោយ ១៥០ms) · `ZoeW/tests/ios-search-viewport.test.ts` +១ (ប្រអប់បើក ➜ ០ · Android ➜ មិនប៉ះ)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ ទំព័រស្កេន ➜ «📋 បញ្ចូលច្រើន» (ច្រើនដង) ➜ keyboard បើក ➜ navbar នៅលើអេក្រង់ជានិច្ច · ទំព័រខាងក្រោយមិនរអិល · កែលេខ · ចូលប្រព័ន្ធ ដូចគ្នា។
2. **iPad** (បញ្ឈរ · ផ្តេក) និង **iPhone ផ្តេក** ៖ ប្រអប់ PIN · «API ស្វែងរកអតិថិជន» · «នាំចូល Excel ទៅ Sheet» ➜ ចុចកន្លែងវាយ ➜ កន្លែងវាយមើលឃើញពីលើ keyboard · ប្រអប់មិនផុតអេក្រង់។
3. **Android** ៖ ដូចដើម។ សកម្មភាពរបស់ [2.50.67]–[2.50.76] នៅដដែល។

---

### [2.50.76] — 2026-10-15 · ZoeW ៖ **ប្រអប់ + keyboard ➜ ប្រអប់ខ្លីឃើញទាំងមូល · ប្រអប់វែងប្រើផ្ទៃពេញពីលើ keyboard** (រូបថត iPhone ម្ចាស់គម្រោង)

**ZoeW `2.50.76`** (`zoew-v338` ➜ `zoew-v339`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែក្នុង `modal-keyboard.ts` · `react-root.css` · `guide.html`។
រាយការណ៍ម្ចាស់គម្រោង (រូបថត iPhone ២ លើ 2.50.75) ៖ ប្រអប់ PIN ➜ ប៊ូតុង «ផ្ទៀងផ្ទាត់ · បោះបង់» ត្រូវកាត់ពាក់កណ្តាល · «📋 បញ្ចូលច្រើន» ➜ ចំណងជើងត្រូវកាត់ ខណៈផ្ទៃពីលើកាតទំនេរ។

#### អ្វីដែលខុសពីមុន

- 🐛 **ប្រអប់ខ្លីត្រូវកាត់ ទោះផ្ទៃពីលើ keyboard គ្រប់គ្រាន់** (ផ្នែក ២ A94)។ [2.50.73] រក្សាកំពូលកាតនៅដដែល (ដើម្បីកុំឲ្យប្រអប់វែងផុតអេក្រង់) ហើយកាត់តែបាត ➜ ប្រអប់
  PIN (២២៨px) ត្រូវកាត់មក ១៨០px (ប៊ូតុងបាត់) ខណៈផ្ទៃពីលើ keyboard មាន ៣៨៩px · «បញ្ចូលច្រើន» (៤១០px) ត្រូវកាត់មក ២២៣px ហើយរមូរលាក់ចំណងជើង។ ឥឡូវ ៖
  ប្រអប់ដែលល្មមផ្ទៃពីលើ keyboard ➜ ឡើងតែល្មមឲ្យបាតត្រឹម keyboard (គម្លាត ៨px) ➜ ឃើញទាំងមូល · ប្រអប់វែងជាងផ្ទៃនោះ ➜ កំពូលនៅកំពូលផ្ទៃមើលឃើញ
  (ក្រោម status bar ៖ `--modal-safe-top` = `env(safe-area-inset-top)` + ៨px · ឬ padding ១២px) ហើយរមូរក្នុងខ្លួន ⛔ មិនដែលផុតអេក្រង់ (ការព្រួយបារម្ភរបស់ [2.50.73]
  រក្សាទុក) · ប្រអប់ដែលនៅពីលើ keyboard ស្រាប់ ➜ មិនប្តូរ · ផ្ទៃមើលឃើញរំកិល (`offsetTop`) ➜ ប្រអប់ខ្លីនៅទីតាំងលើអេក្រង់ដដែល។ ផ្លូវ «លើកកំពូល» (`raised` ·
  `focusedModalFieldClipped()` · ជាន់ ១៨០px) ដកចេញ ព្រោះច្បាប់ថ្មីប្រើផ្ទៃពេញរួចហើយ។

#### អ្នកយាម

- `modal-keyboard-test` ៖ ច្បាប់ទីតាំងថ្មី (ប្រអប់ខ្លី ៖ មិនកាត់ · កំពូល = បន្ទាត់ keyboard − កម្ពស់ · ប្រអប់វែង ៖ កំពូល = កំពូលផ្ទៃមើលឃើញ · បាតដល់ keyboard · គ្រប់ករណី ៖ មិនក្រោម status bar) ·
  ទំហំទី ៤ iPhone 393×852 · keyboard ៤០០ (ដូចរូបថត) + status bar ក្លែង ៤៧px · «API ស្វែងរកអតិថិជន» នៅកំពូលផ្ទៃមើលឃើញគ្រប់ទំហំ · ផ្លូវទាំង ២ ត្រូវរត់ (≥ ១០ ម្នាក់) —
  លើ `a7d9b02` FAIL ៩ (pinModal ៖ «ល្មមផ្ទៃ ៣៨៩ ≥ ២២៨» តែកាត់ · ផ្ទៃរំកិល · ប្តូរប្រអប់វាយ · បើកប្រអប់ខណៈ keyboard បើក) ➜ ក្រោយកែ ៤៣/៤៣។
- `ZoeW/tests/modal-keyboard.test.tsx` ៖ `modalKeyboardFitFor()` (ប្រអប់ខ្លីឡើងល្មម · ប្រអប់វែងនៅកំពូលផ្ទៃ · `safe` · ផ្ទៃរំកិល · តម្លៃខុស) · DOM ៖ ករណីរូបថត 393×852 + `--modal-safe-top` ·
  ខ្សែភ្ជាប់ CSS `@property --modal-safe-top` — ២៤/២៤។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ ☰ ➜ Config (PIN) ➜ ចុចកន្លែងវាយ PIN ➜ ប្រអប់ឡើងពីលើ keyboard ទាំងមូល (ចំណងជើង · កន្លែងវាយ · ប៊ូតុង «ផ្ទៀងផ្ទាត់ · បោះបង់» ឃើញពេញ) · «📋 បញ្ចូលច្រើន»
   ➜ ចុចប្រអប់វាយ ➜ ចំណងជើងនៅក្រោមរបារស្ថានភាព · កន្លែងវាយមើលឃើញ · រមូរក្នុងប្រអប់ដើម្បីឃើញប៊ូតុង · «API ស្វែងរកអតិថិជន» ➜ ប្រអប់មិនផុតអេក្រង់។
2. **Android** (APK) ៖ ប្រអប់ + keyboard ដូចដើម · Chrome/PWA ៖ ដូច iPhone។
3. សកម្មភាពរបស់ [2.50.67]–[2.50.75] នៅដដែល (សាក iPhone ពិតមុន merge)។

---

### [2.50.75] — 2026-10-15 · ZoeW ៖ **CI របស់ PR #317 ធ្លាក់ ៣ ➜ កែ · toast នៅពីលើ keyboard (ផ្ទៀងផ្ទាត់ PR #317 ឡើងវិញ)**

**ZoeW `2.50.75`** (`zoew-v337` ➜ `zoew-v338`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែក្នុង `ios-viewport.ts` · `modal-keyboard.ts` · `state.ts` · `DocumentEffects.tsx` · `react-root.css` · `guide.html`។
សំណើម្ចាស់គម្រោង ៖ «PR317 CI fail សូមផ្ទៀងផ្ទាត់ការងារក្នុង PR ឡើងវិញទាំងអស់ ក្រែងមានចន្លោះឬមុខងារខ្លះខុសស្តង់ដារ សូមកែសម្រួលអោយដំណើរការដូច app ស្តង់ដារទូទៅ»។

#### អ្វីដែលខុសពីមុន

- 🐛 **CI របស់ PR #317 (`be04280`) ធ្លាក់ ៣ ផ្នែក** (ផ្នែក ២ A91) ៖ ផ្នែក ២/៤ `zoew-suite-test` (`npm run lint` ៖ `no-useless-assignment` លើ `caret` ក្នុង
  `ZoeW/tests/modal-keyboard.test.tsx`) · ផ្នែក ៣/៤ `function-surface-test` (top-level `touchById` ប្រកាស ២ ដង ៖ `ios-viewport.ts` · `modal-keyboard.ts`) · ផ្នែក ៤/៤
  `code-duplication-test` (តួ `touchById` ១៤០ តួ + ប្លុករូបរាងដូចគ្នា ៣៤៨ តួ ៖ ការពិនិត្យការចុច ម្រាមដៃ · គម្លាត · ពេល)។ ឥឡូវការពិនិត្យការចុចរស់នៅកន្លែងតែមួយ
  `tapEndedInPlace()` (`ios-viewport.ts`) ដែលប្រអប់ស្វែងរក និងប្រអប់ (modal) ប្រើរួមគ្នា — ឥរិយាបថដដែល (`touchById` ដដែលទ្រាំ `changedTouches` មានធាតុ `null`)។
- 🐛 **iPhone ៖ toast នៅក្រោយ keyboard** (A92)។ iOS មិនបង្រួម layout viewport ពេល keyboard បើក ➜ `.toast-container` (fixed · បាត ២៤px) នៅក្រោយ keyboard ➜ ប៊ូតុងក្នុងប្រអប់
  (keyboard នៅបើក ព្រោះប៊ូតុងមិនយក focus លើ iOS) ហាក់ដូចជាមិនដំណើរការ ៖ «▶️ ចាប់ផ្តើម» ក្នុង «📋 បញ្ចូលច្រើន» ពេលទទេ («⚠️ សូមវាយ ឬស្កេន Barcode…») · «🧪 សាកល្បង» ក្នុង
  «API ស្វែងរកអតិថិជន» («⏳ កំពុងសាកល្បង…») · សារកូដអញ្ជើញក្នុងប្រអប់ចូល · Barcode ស្ទួនពេលវាយក្នុង `hwScannerInput`។ ឥឡូវ `measureKeyboardCover()` (visualViewport
  `resize`/`scroll` · មានឬគ្មានប្រអប់) ➜ `uiState.keyboardCover` (layout px ក្រោមផ្ទៃមើលឃើញ · តិចជាង `KEYBOARD_MIN_INSET_PX` ➜ ០ · APK ➜ ០) ➜ `--keyboard-cover` ➜
  `.toast-container` `bottom: 24px + max(safe-area, cover)` ➜ toast នៅពីលើ keyboard ទាំងពេល iOS រំកិល `offsetTop` និងនៅខាងលើប្រអប់ · keyboard បិទ ➜ បាត ២៤px ដូចដើម ·
  Android Chrome/PWA (keyboard បង្រួមតែ visual viewport) ទទួលដូចគ្នា។
- 🔎 **ការផ្ទៀងផ្ទាត់ PR #317 ឡើងវិញ** (A93) ៖ កូដដែលប្តូរក្នុង PR (`ios-viewport.ts` · `modal-keyboard.ts` · `Modal.tsx` · `DocumentEffects.tsx` · `refs.ts` · `react-root.css` ·
  `pull-to-refresh.ts` · `haptics.ts` · ស្លាក/ប៊ូតុង/ផ្ទាំងបោះពុម្ព) អានម្តងមួយៗ ➜ ចន្លោះដែលវាស់ឃើញតែ A92 · សម្មតិកម្មដែលវាស់ហើយបដិសេធ ៖ បង្វិលអេក្រង់ខណៈ keyboard បើក (កាតនៅក្នុងផ្ទៃមើលឃើញ) ។

#### អ្នកយាម

- `modal-keyboard-test` +៥ ៖ toast ពីលើ keyboard (ទំព័រ · ប្រអប់ ៣ · រំកិល ០/១៤០ · ទំហំ ២ ៖ ១៦ ករណី · `elementFromPoint` ➜ toast នៅខាងលើប្រអប់) · ទិសផ្ទុយ keyboard បិទ (បាត ២៤px ·
  ទំហំ ២) · APK (`--keyboard-cover` ០ · បាត ២៤px នៃ viewport ដែលបង្រួម) · គំរូអាចធ្លាក់ (ទីតាំងដើមនៅក្រោយ keyboard ១៦/១៦) — លើ `be04280` toast ១៦/១៦ នៅ ៧៩០–៨២០ ក្រោមផ្ទៃមើលឃើញ
  (៥០៨ · ៦៤៨ ពេលរំកិល) ➜ FAIL ➜ ក្រោយកែ ៤០/៤០។
- `ZoeW/tests/modal-keyboard.test.tsx` +៤ ៖ `keyboardCover` · `--keyboard-cover` (៣៣៦ · ១៩៦ ពេលរំកិល ១៤០ · ០) · ប្រអប់ + keyboard · ទិសផ្ទុយ (គម្លាតតូច · APK · NaN/០/អវិជ្ជមាន/Infinity ·
  គ្មាន visualViewport) · dispose ➜ ០ · listen ម្តងទៀតវាស់ភ្លាម · ខ្សែភ្ជាប់ CSS — ២៤/២៤។
- CI ៖ `npm run lint` ស្អាត · `function-surface-test` ២៧/២៧ · `code-duplication-test` ១៤/១៤ (លើ `be04280` ១ FAIL · ២ FAIL)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ «📋 បញ្ចូលច្រើន» ➜ ចុចប្រអប់វាយ (keyboard បើក) ➜ លុបអក្សរទាំងអស់ ➜ «▶️ ចាប់ផ្តើម» ➜ សារ «⚠️ សូមវាយ ឬស្កេន Barcode…» លេចពីលើ keyboard ·
   «API ស្វែងរកអតិថិជន» ➜ ចុចកន្លែងវាយ ➜ «🧪 សាកល្បង» ➜ សារ «⏳ កំពុងសាកល្បង…» ពីលើ keyboard · បិទ keyboard ➜ សារនៅខាងក្រោមអេក្រង់។
2. **Android** ៖ APK ➜ toast នៅខាងក្រោមពីលើ keyboard (មិនប្រែ) · Chrome/PWA ➜ toast ពីលើ keyboard។
3. សកម្មភាពរបស់ [2.50.67]–[2.50.74] នៅដដែល (សាក iPhone ពិតមុន merge)។

---

### [2.50.74] — 2026-10-15 · ZoeW ៖ **ប្រអប់ + keyboard ➜ ផ្ទៃក្រោយ keyboard ពណ៌តែមួយ · តេស្តសុវត្ថិភាពផ្ទាំងចាក់សោ**

**ZoeW `2.50.74`** (`zoew-v336` ➜ `zoew-v337`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែក្នុង `react-root.css` · `DocumentEffects.tsx` · `guide.html`។
រាយការណ៍ម្ចាស់គម្រោង ៖ «ផ្ទៃពីសរថ្លាពីលើ keyboard ពណ៌ពីរខុសគ្នាទៀត សូមសម្រួល · រំកិល background លែងបានហើយ ok តែនៅទើសភ្នែកកន្លែងសរ · បន្ទាប់ពីកែរួចសូមតេស្តសុវត្ថិភាព
ក្រែងអាច bypass ឬរំលង modal pin code និង login»។

#### អ្វីដែលខុសពីមុន

- 🐛 **keyboard របស់ iPhone ថ្លា ➜ អ្វីនៅក្រោយវាលេចមកជាពណ៌ច្រើន** (ផ្នែក ២ A90)។ [2.50.73] ផ្ទៃងងឹតគ្របក្រោយ keyboard រួច ប៉ុន្តែវាថ្លា ៦០% ➜ កាត · ប៊ូតុង · របារ tab
  ខាងក្រោមលេចតាមពណ៌ផ្សេងៗ (rgb ៨,១៤,២៥ ដល់ ១១១,១១៦,១២៧)។ ឥឡូវ ខណៈប្រអប់កាន់ keyboard (`body.modal-keyboard`) `.modal::after` ជាស្រទាប់ **ស្រអាប់** (ពណ៌ផ្ទៃងងឹតលើ `--body-bg`)
  ពីបន្ទាត់ keyboard (`--modal-kb-line` = `offsetTop` + កម្ពស់ផ្ទៃមើលឃើញ) ចុះក្រោមរហូតហួសការរំកិល + safe-area ➜ keyboard និងរបារពីលើវាឃើញពណ៌តែមួយ · កាតប្រអប់ឈប់ពីលើបន្ទាត់នោះ ៨px
  ជានិច្ច ➜ ស្រទាប់មិនបាំងអ្វីដែលមើលឃើញ · keyboard បិទ ➜ ដូចដើម · APK មិនប្រែ។
- 🔒 **តេស្តសុវត្ថិភាពបន្ថែម** (A90) ៖ ផ្ទាំងចាក់សោ App ៖ គ្រប់ចំណុចលើអេក្រង់ (keyboard បិទ/បើក/រំកិល) ជារបស់ផ្ទាំងចាក់សោ · ចុចជ្រុង/ចំហៀង/ក្រោម · Escape · PIN ខុស ➜ នៅចាក់សោ ·
  PIN ត្រូវ ➜ ដោះ · ប្រអប់ចូល · Activate · PIN · កំណត់ PIN ដូច [2.50.73] (ក្រឡា · noDismiss · Escape · PIN ខុស/ត្រូវ) · `pin-prompt-test` (គោលដៅក្រោយ PIN មិនអាចហៅពីប៊ូតុង)។

#### អ្នកយាម

- `modal-keyboard-test` +២ ៖ **រូបថតពិត** ផ្ទៃក្រោយ keyboard (ប្រអប់ ៥ · ទំព័រទិន្នន័យ/ស្កេន · រំកិល ០/១៤០ · ទំហំ ២ ៖ ២៦ ករណី) ➜ គម្លាតពណ៌ ≤ ៣ · ផ្ទាំងចាក់សោ App (ក្រឡា · ចុច ·
  Escape · PIN ខុស/ត្រូវ) — លើ 2.50.73 ៤០/៤០ ពណ៌ច្រើន (គម្លាត ១០២–១០៣ · មុនបង្រួមមក ២៦ ករណី) ➜ ៣៥/៣៥។ `backdropFull` អានទីតាំង `::after` ពិត (top + height)។
- `ZoeW/tests/modal-keyboard.test.tsx` ៖ `--modal-kb-line` (៥០៨ · ៦២៨ ពេលរំកិល · `100%` ពេលបិទ) · ខ្សែភ្ជាប់ CSS ថ្មី — ២០/២០។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ បើកប្រអប់ (PIN · API ស្វែងរកអតិថិជន · កែលេខ · «📋 បញ្ចូលច្រើន») ➜ ចុចកន្លែងវាយ ➜ keyboard និងរបារពីលើវា (ផ្ទៃថ្លា) ពណ៌តែមួយ ទាំងទំព័រទិន្នន័យ និងទំព័រស្កេន ·
   ប្រអប់នៅកន្លែងដដែល · អូសផ្ទៃខាងក្រោយមិនរំកិល។
2. **iPhone PWA** ៖ បើក «ចាក់សោពេលបើក App» ➜ ចេញ/ចូល App ➜ ផ្ទាំងចាក់សោ ➜ ចុចកន្លែងវាយ PIN ➜ ចុចកន្លែងផ្សេង · PIN ខុស ➜ នៅចាក់សោ · PIN ត្រូវ ➜ ដោះ។
3. **Android** (APK · PWA) ៖ ប្រអប់ + keyboard ➜ ធម្មតា (keyboard មិនថ្លា ➜ មិនប្រែ)។

---

### [2.50.73] — 2026-10-15 · ZoeW ៖ **ប្រអប់ + keyboard ➜ ប្រអប់នៅកន្លែងដដែល មានតែបាតខ្លីត្រឹម keyboard · backdrop គ្របពេញ · តេស្តសុវត្ថិភាព PIN/Login**

**ZoeW `2.50.73`** (`zoew-v335` ➜ `zoew-v336`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែក្នុង `modal-keyboard.ts` · `Modal.tsx` · `refs.ts` (`focusElementWithoutScroll`) · `state.ts` · `DocumentEffects.tsx` · `react-root.css` · `guide.html`។
សំណើម្ចាស់គម្រោង (លើ 2.50.72) ៖ «កុំអោយរំកិលឡើងទាំងមូលអី ព្រោះ modal ខ្លះវែងអាចផុត ឧទាហរណ៍ modal "API ស្វែងរកអតិថិជន" អោយរំកិលកុំអោយបាំងតែកន្លែងបញ្ចូលអក្សរឬលេខបានហើយ ·
តេស្តមើលផងទាំង ios android អោយហ្មត់ចត់ · បន្ទាប់ពីកែរួចសូមតេស្តប្រព័ន្ធសុវត្ថិភាពផង ក្រែងអាច bypass ឬរំលង modal pin code និង login · ផ្ទៃពីសរថ្លាពីលើ keyboard ពណ៌ពីរខុសគ្នា»។

#### អ្វីដែលខុសពីមុន

- 🐛 **ប្រអប់ + keyboard ➜ ប្រអប់ទាំងមូលរំកិលឡើង (ប្រអប់វែងផុតអេក្រង់) · ពីលើ keyboard ពណ៌ពីរ** (ផ្នែក ២ A88)។ [2.50.71] បង្រួម `.modal` ទាំងមូលឲ្យស្មើផ្ទៃមើលឃើញ ➜ កាតចុះមក
  កណ្តាលផ្ទៃនោះ (PIN ៖ កំពូល ៣០៨ ➜ ១៤០) ហើយផ្ទៃងងឹតឈប់ត្រឹម keyboard ➜ ក្រោយ keyboard ថ្លាជាទំព័រ (កាត · ប៊ូតុង) ➜ ពណ៌ពីរ។ ឥឡូវ ៖ `.modal` ពេញ layout viewport ជានិច្ច ហើយ `::after`
  លាតចុះក្រោមតាមការរំកិល (`--modal-kb-pan`) + `env(safe-area-inset-bottom)` ➜ ក្រោយ keyboard ជាផ្ទៃងងឹតតែមួយ · មានតែប្រអប់ខាងលើគេដែលបាតនៅក្រោយ keyboard ទទួល `.modal-kb`
  (`modalKeyboardFitFor()` ➜ `uiState.modalKeyboardFit` ➜ `Modal.tsx`) ៖ កំពូល · ឆ្វេង · ស្តាំ **ដដែលលើអេក្រង់** (វាស់ពេលមិនទាន់តម្រូវ · គ្មាន transform · iOS រំកិល `offsetTop` ➜ បូកវា) ·
  មានតែបាតខ្លីមកត្រឹម keyboard (គម្លាត `MODAL_KEYBOARD_GAP_PX` ៨px) ហើយរមូរក្នុងខ្លួន ➜ កន្លែងវាយមើលឃើញ (គម្លាត ≤ ១២px ៖ អ្នករមូរតូចបង្រួមគម្លាត) · ប្រអប់ដែលនៅពីលើ keyboard រួច ➜ មិនប៉ះ ·
  ផ្ទៃនៅសល់ < `MODAL_KEYBOARD_MIN_VISIBLE_PX` (១៨០px) ឬអ្នករមូរខាងក្នុងទាបជាងកន្លែងវាយ ➜ ទើបលើកកំពូល · បើកប្រអប់ខណៈ keyboard បើក ➜ វាស់ក្រោយ React គូរ (microtask) ·
  ជាន់ប្រអប់ ➜ តម្រូវតែប្រអប់ខាងលើគេ · APK (WebView បង្រួម) ➜ មិនប្តូរប្លង់ តែ `resize` រមូរកន្លែងវាយមកមើលឃើញ។
- ✨ **iPhone (App លើ Home Screen) ៖ ចុចកន្លែងវាយក្នុងប្រអប់ ➜ keyboard បើកដោយទំព័រមិនរំកិល** ៖ ការចុច (មិនអូស · មិនសង្កត់យូរ · ម្រាមដៃមួយ) លើកន្លែងវាយដែលមិនទាន់ focus
  ➜ `touchend` `preventDefault()` + `focusElementWithoutScroll()` (caret នៅចុងអត្ថបទ · `focus({ preventScroll: true })`) ➜ iOS មិនរំកិលទំព័រទាំងមូលដើម្បីបង្ហាញវា (ប្រអប់រមូរខ្លួនឯង) ·
  កន្លែងវាយដែល focus រួច · date · checkbox · readonly · Android/web ➜ ធម្មតា · focus មិនជាប់ ➜ ការចុចបន្ទាប់ទុកឲ្យ iOS។
- 🔒 **តេស្តសុវត្ថិភាព PIN/Login** (ផ្នែក ២ A89) ៖ ប្រអប់ចូល · Activate · PIN · កំណត់ PIN ៖ គ្រប់ចំណុចលើអេក្រង់ (ក្រឡា ២៤px · keyboard បិទ/បើក/រំកិល) ជារបស់ប្រអប់ ·
  ប្រអប់ចូល/Activate មិនបិទដោយការចុចផ្ទៃងងឹត ឬ Escape · ការបោះបង់ PIN មិនរត់សកម្មភាព · PIN ខុសមិនរត់ · PIN ត្រូវរត់ម្តង · គ្មានសកម្មភាពក្រោយ PIN ណាដែលប៊ូតុងហៅដោយផ្ទាល់បាន ·
  ប្រអប់កំណត់ PIN បើកតែពេលគ្មាន PIN ទុក។ ⚠️ លើ [2.50.71]–[2.50.72] (មិនដែលនៅ `main`) ផ្ទៃក្រោយ keyboard គ្មានផ្ទៃងងឹត ➜ ទំព័រខាងក្រោយប្រអប់ចូល/PIN ទទួលការចុចបាន (ពេល keyboard
  កំពុងចុះ) — ឥឡូវបិទ។

#### អ្នកយាម

- `modal-keyboard-test` (សរសេរឡើងវិញ) ៖ ៣៤ កន្លែងវាយ × ៣ ទំហំ ➜ កំពូល · ឆ្វេង · ស្តាំដដែល (ឬលើកតែពេលផ្ទៃតូច) · បាតត្រឹម keyboard · កន្លែងវាយមើលឃើញ · backdrop ពេញ ·
  `elementFromPoint` ក្នុងផ្ទៃ keyboard = ប្រអប់ · `lookupApiConfigModal` កំពូលដដែលគ្រប់ទំហំ · រំកិល ១៤០ (`::after` ≥ ១៣៩px) · ប្តូរកន្លែងវាយ · keyboard បិទ ➜ ដូចដើម · បិទប្រអប់ ·
  បើកប្រអប់ខណៈ keyboard បើក · APK (ប្រអប់វែង កន្លែងវាយខាងក្រោម) · ការចុចលើ iPhone (preventDefault · caret ចុង · ទិសផ្ទុយ) · សុវត្ថិភាព (ក្រឡា · noDismiss · Escape · PIN ខុស/ត្រូវ) —
  លើ 2.50.72 ១៥ ធ្លាក់ ➜ ៣២/៣២។
- `ZoeW/tests/modal-keyboard.test.tsx` (សរសេរឡើងវិញ · ២០) ៖ `modalKeyboardFitFor()` (នៅពីលើ ➜ null · វែង · រំកិល · តូចទាប ➜ ជាន់ · raised · cap · NaN) · Modal ពិត ៖ class/អថេរ ·
  ទីតាំងដើមរក្សាទុក · ប្រអប់បិទ/បើក/ជាន់ (microtask) · reveal (គម្លាតបង្រួម · textarea ខ្ពស់) · raised · APK resize · dispose · ការចុច iPhone (៤) · ខ្សែភ្ជាប់ CSS។
- `pin-prompt-test` +៦ ៖ គោលដៅក្រោយ PIN (១៤ ឈ្មោះ + `openConfigModal`) មិននៅក្នុង `ACTION_REGISTRY` ∪ `ACTION_ALLOWLIST` លើកលែងតែពិនិត្យខ្លួនឯង (២ ៖ ZTO) · ប្រអប់កំណត់ PIN
  បើកតែពេលគ្មាន PIN · ជាន់អប្បបរមា — mutation (`openSheetImportModal` ចូល `ACTION_REGISTRY`) ➜ ធ្លាក់។
- `react-purity` ៖ ច្រកចេញ `refs.ts` `.focus()` ៣ ➜ ៤ · `.setSelectionRange()` ១ (មានហេតុផល)។ `state-hygiene` ៖ អថេរ ៦ ថ្មីមានហេតុផល។
- repo ៖ ថត `ZoeW/.history-window-check-dist` (លទ្ធផល build បណ្តោះអាសន្នរបស់ `history-window-check` ដែលរត់មិនទាន់ចប់) commit ដោយចៃដន្យក្នុង `b802db2` ➜ លុប ·
  `ZoeW/.gitignore` ការពារ (`repository-file-coverage` ធ្លាក់លើវា)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ ☰ ➜ «API ស្វែងរកអតិថិជន» (PIN) ➜ ចុចកន្លែងវាយខាងក្រោម (Header · Password) ➜ ប្រអប់នៅកន្លែងដដែល (ចំណងជើងនៅដដែល) · បាតឈប់ពីលើ keyboard · កន្លែងវាយលេចឡើង ·
   ទំព័រមិនរំកិល · ផ្ទៃពីលើ keyboard ពណ៌តែមួយ (ងងឹត) · រមូរប្រអប់ឡើងចុះបាន · បិទ keyboard ➜ ប្រអប់ដូចដើម។
2. **iPhone PWA** ៖ ប្រអប់ PIN · កែលេខទូរស័ព្ទ · «📋 បញ្ចូលច្រើន» · Config ➜ ដូចខ្ទង់ ១ · ចុចកន្លែងវាយដែល focus រួច ➜ caret តាមកន្លែងចុច (ធម្មតា)។
3. **Android** (APK · PWA) ៖ ប្រអប់ដដែល ➜ keyboard មិនបាំងកន្លែងវាយ · ប្រអប់មិនផុតអេក្រង់។
4. **សុវត្ថិភាព** ៖ ប្រអប់ PIN បើក ➜ ចុចផ្ទៃងងឹត ឬបោះបង់ ➜ សកម្មភាពមិនរត់ · ប្រអប់ចូល ➜ ចុចផ្ទៃងងឹតមិនបិទ · ទំព័រខាងក្រោយចុចមិនបាន (ទាំងពេល keyboard បើក)។

---

### [2.50.72] — 2026-10-15 · ZoeW ៖ **iPhone PWA ៖ ប្រអប់ + keyboard ➜ អូសផ្ទៃខាងក្រោយ ឬលើប្រអប់ ទំព័រមិនរំកិល (មិនញ៉ាក់)**

**ZoeW `2.50.72`** (`zoew-v334` ➜ `zoew-v335`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែក្នុង `ios-viewport.ts` · `react-root.css`។
រាយការណ៍ម្ចាស់គម្រោង (លើ 2.50.71 · វីដេអូ VID_20261015_051457_030) ៖ «ចន្លោះមួយពេល modal បើកពេល scroll ទៅផ្ទៃ background រំកិលបានធ្វើអោយចលនាញ៉ាក់»។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone PWA ៖ ប្រអប់បើក + keyboard ➜ អូសលើផ្ទៃងងឹតខាងក្រោយ ➜ ទំព័រ និងប្រអប់រំកិលឡើង រួចប្រអប់លោតត្រឡប់** (ផ្នែក ២ A87)។ keyboard បើក ➜ iOS ឲ្យរំកិលផ្ទៃមើលឃើញ
  (visual viewport) ➜ ប្រអប់ ([2.50.71]) តាម `offsetTop` ពី event `scroll` យឺតមួយស៊ុម ➜ ញ៉ាក់។ ឥឡូវ ការចាក់សោការអូសរបស់ការស្វែងរក ([2.50.68]–[2.50.70]) អនុវត្តលើប្រអប់ដែរ ខណៈ
  `body.modal-keyboard` (`iosModalKeyboardLocked()` ➜ `iosKeyboardPanLocked()`) ៖ `body` · `.modal` `touch-action: none` · `.modal-content` `overscroll-behavior-y: contain` · touchmove ដំបូងត្រូវចាប់លើ
  ផ្ទៃខាងក្រោយ · កាត · កន្លែងវាយ (រួមទាំង textarea គ្មានកន្លែង) · textarea និងកាតវែង ➜ រមូរក្នុងខ្លួន · អូសផ្ដេក ➜ ទស្សន៍ទ្រនិច · keyboard បិទ ➜ ដូចដើម · Android/web មិនប្រែ។

#### អ្នកយាម

- `ZoeW/tests/ios-keyboard-pan.test.ts` +៤ ៖ ផ្ទៃខាងក្រោយ · កាតគ្មានកន្លែង · input · textarea គ្មានកន្លែង ➜ preventDefault · textarea/កាតមានកន្លែង ➜ មិនប៉ះ · ដល់ចុង ➜ ទប់ · ផ្ដេក ➜ មិនប៉ះ ·
  keyboard បិទ · មិនមែន iOS standalone ➜ គ្មាន listener · ខ្សែភ្ជាប់ CSS — លើ 2.50.71 ៤/៤ ធ្លាក់។
- `gesture-test` ៖ browser ពិត · ប្រអប់ `batchScanModal` + textarea focus + `body.modal-keyboard` ➜ ផ្ទៃខាងក្រោយ WebKit ហាម Y · ផ្ទៃខាងក្រោយ · កាត · textarea ➜ touchmove ដំបូងត្រូវចាប់
  · iOS មិនចាប់ផ្តើម pan (`webkitPan`) · ទិសផ្ទុយ (ផ្ដេក · textarea វែង · keyboard បិទ) — លើ 2.50.71 ២ ធ្លាក់ ➜ ១៧៦/១៧៦។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ ផ្ទាំងស្កេន ➜ «📋 បញ្ចូលច្រើន» ➜ ចុចប្រអប់វាយ (keyboard បើក) ➜ អូសលើផ្ទៃងងឹតខាងក្រោយ · លើប្រអប់ · ក្នុងប្រអប់វាយ ➜ ទំព័រ និងប្រអប់មិនរំកិល · មិនញ៉ាក់ ·
   ចុចប៊ូតុង «▶ ចាប់ផ្តើម» · «បិទ» ➜ ធម្មតា · បិទភ្ជាប់បញ្ជី Barcode វែង ➜ ប្រអប់វាយរមូរក្នុងខ្លួន។
2. **iPhone PWA** ៖ សាកប្រអប់ផ្សេងដែលមានកន្លែងវាយ (PIN · Config · កែលេខ) ដូចខ្ទង់ ១ + សកម្មភាព ១–២ របស់ [2.50.71]។
3. **Android** (APK · PWA) ៖ មិនប្រែ។

---

### [2.50.71] — 2026-10-14 · ZoeW ៖ **ប្រអប់ដែលមានកន្លែងវាយអក្សរ/លេខ រំកិលឡើងនៅពីលើ keyboard** (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.71`** (`zoew-v333` ➜ `zoew-v334`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ឯកសារថ្មី `src/app/behaviors/modal-keyboard.ts` · `state.ts` · `DocumentEffects.tsx` · `boot.ts` · `react-root.css` · `guide.html`។
សំណើម្ចាស់គម្រោង ៖ «បន្ថែមមុខងារអោយ modal ណាដែលមានប្រអប់វាយបញ្ចូលអក្សរឬលេខឆ្លាតវៃ ចេះរកិលពេលបាំង keyboard ហើយសូមតេស្តអោយហ្មត់ចត់»។

#### អ្វីដែលខុសពីមុន

- ✨ **ប្រអប់ណាក៏ដោយដែលបើក ពេល keyboard បាំងផ្នែកខាងក្រោម ➜ ប្រអប់ស្ថិតក្នុងផ្ទៃដែលមើលឃើញពីលើ keyboard ហើយកន្លែងដែលកំពុងវាយលេចឲ្យឃើញ** (ផ្នែក ២ A86)។
  iPhone មិនបង្រួមទំព័រពេល keyboard បើក ➜ `.modal` (fixed · ១០០%) នៅកណ្តាលអេក្រង់ពេញ ➜ keyboard បាំងពាក់កណ្តាលក្រោម (PIN · Config · Lookup API · Login · …)។ ឥឡូវ ៖
  `listenModalKeyboard()` (visualViewport `resize`/`scroll` · `focusin` · ប្រអប់បើក/បិទ) ➜ `modalKeyboardViewport()` (`innerHeight - visualViewport.height` ≥ `KEYBOARD_MIN_INSET_PX`) ➜
  `uiState.modalViewportTop/Height` ➜ `body.modal-keyboard` + `--modal-vv-top` · `--modal-vv-height` ➜ `.modal` យកផ្ទៃមើលឃើញ · `.modal-content` `max-height: 100%` (ប្រអប់វែងរមូរក្នុងខ្លួន) ➜
  `revealFocusedModalField()` រមូរកន្លែងវាយចូលមើលឃើញ (គម្លាត ១២px · `setElementScrollTop` · មិនប្រើ `scrollIntoView` ដែលរមូរទំព័រលើ iOS)។ iOS រំកិលផ្ទៃមើលឃើញ (`offsetTop`) ➜ ប្រអប់តាម ·
  ប្តូរកន្លែងវាយ ➜ រមូរតាម · បិទ keyboard ឬបិទប្រអប់ ➜ ដូចដើម · APK (WebView បង្រួមខ្លួនឯង) ➜ មិនប្តូរ។ `guide.html` ផ្នែក ៥ ពន្យល់។

#### អ្នកយាម

- `modal-keyboard-test` (ថ្មី · browser ពិត · App ពិត · visualViewport ក្លែង) ៖ ប្រអប់ និងកន្លែងវាយ **ដេរីវេពី DOM** (គ្រប់ `.modal` ដែលមាន input អក្សរ/លេខ ឬ textarea មើលឃើញ ៖ ៣៤ កន្លែងវាយ)
  × ទំហំ ៣ (390×844 keyboard 336 · 375×667 keyboard 260 · 320×568 keyboard 253) ➜ កាតប្រអប់ និងកន្លែងវាយនៅក្នុងផ្ទៃមើលឃើញ · មិនត្រូវអ្នករមូរកាត់ · ផ្ទៃមើលឃើញរំកិល ១៤០px · ប្តូរកន្លែងវាយ ·
  បើកប្រអប់ខណៈ keyboard បើករួច · ទិសផ្ទុយ (keyboard បិទ ➜ ទីតាំងដើម · បិទប្រអប់ · គម្លាតតូច · APK បង្រួម viewport) · ជាន់អប្បបរមា (≥ ១៥ ប្រអប់ · ≥ ៦០ ការវាស់ · ≥ ១០ ករណីបាំងមុនការកែ) —
  លើ 2.50.70 ៧ ធ្លាក់ ➜ ១៨/១៨ · mutation (បិទ `revealFocusedModalField()`) ➜ ៣ ធ្លាក់។
- `ZoeW/tests/modal-keyboard.test.tsx` (ថ្មី · ១០) ៖ ផ្ទៃមើលឃើញ (offsetTop · clamp · គម្លាតតូច · ប្រអប់បិទ · គ្មាន visualViewport · NaN/០/អវិជ្ជមាន · APK) · listener ➜ state ➜ body class + អថេរ CSS ·
  ប្រអប់បិទ/បើកខណៈ keyboard បើក · ការរមូរកន្លែងវាយ (ក្រោម · លើ · មើលឃើញហើយ · textarea ខ្ពស់) · focusin · focus ក្រៅប្រអប់ · dispose · ខ្សែភ្ជាប់ boot/CSS/DocumentEffects។
- `state-hygiene` ៖ `modalWasOpen` ➜ `ACCEPTED` ជាមួយហេតុផល។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ បើកប្រអប់ PIN · Config (☰ ➜ Config) · API ស្វែងរកអតិថិជន · កែលេខទូរស័ព្ទ · កែតម្លៃកញ្ចប់ ➜ ចុចកន្លែងវាយ ➜ keyboard បើក ➜ ប្រអប់ទាំងមូលនៅពីលើ keyboard ·
   កន្លែងវាយមើលឃើញ · ប្រអប់វែងរមូរក្នុងខ្លួន · ចុចកន្លែងវាយបន្ទាប់ ➜ លេចឲ្យឃើញ · បិទ keyboard ➜ ប្រអប់ត្រឡប់កណ្តាល។
2. **iPhone តូច (SE)** ៖ សាកដូចខ្ទង់ ១ (ផ្ទៃមើលឃើញតូចបំផុត)។
3. **Android** (APK · PWA) ៖ ប្រអប់នៅពីលើ keyboard ដូចមុន (APK មិនប្តូរ)។
4. សកម្មភាព ១–៣ របស់ [2.50.70] នៅតែត្រូវសាក។

---

### [2.50.70] — 2026-10-14 · ZoeW ៖ **iPhone PWA ៖ អូសក្នុងប្រអប់វាយលេខស្វែងរក ➜ ទំព័រ និង navbar មិនរំកិល (ដូច Android)**

**ZoeW `2.50.70`** (`zoew-v332` ➜ `zoew-v333`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែតែមួយបន្ទាត់ក្នុង `ios-viewport.ts` (`blockIOSKeyboardPan()`)។
រាយការណ៍ម្ចាស់គម្រោង (លើ PR #317 Deploy Preview) ៖ «Scroll កន្លែងផ្សេងអត់បានទេ តែពេល scroll ប៉ះក្នុងប្រអប់ស្វែងរកបានទៅ … ទាល់តែយកម្រាមដៃទៅអូស scroll ក្នុងប្រអប់វាយលេខ
ស្វែងរក បាន scroll ទៅ តែ android អត់អី … ចលនានោះមកពីខ្ញុំ scroll ទើបលោតចុះលោតឡើង … android ពេលកំពុងស្វែងរក scroll បានតែ list បញ្ជី និង list suggestion phone number
ខ្ញុំចង់បានបែប android … សូមអានកូដរបស់ android ហើយ ធ្វើតាមអោយដូច android ទៅ»។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone PWA ៖ keyboard បើក ➜ អូសឡើងចុះក្នុងប្រអប់វាយលេខស្វែងរកខ្លួនឯង ➜ ទំព័រទាំងមូល និង navbar រំកិល ហើយលោតត្រឡប់** (ផ្នែក ២ A85)។ Android មិនមានកូដពិសេសទេ ៖
  Chrome/WebView បង្រួមទំព័រពេល keyboard បើក ➜ គ្មានចន្លោះឲ្យអូស។ iOS មិនបង្រួម ➜ `ios-viewport.ts` ទប់ការអូសខ្លួនឯង ហើយ `blockIOSKeyboardPan()` លើកលែងគ្រប់ប្រអប់អក្សរ ➜
  ការអូសចាប់ផ្តើមលើប្រអប់វាយលេខដែលកំពុង focus រត់ទៅ pan របស់ text interaction (មិនស្តាប់ `touch-action`) ➜ ទំព័ររំកិល។ ឥឡូវ ៖ ប្រអប់ស្វែងរក (`IOS_SEARCH_FIELDS` ៖ លេខទូរស័ព្ទ ·
  ផ្ទាំងស្កេន) អូសបញ្ឈរ ➜ ទប់ touchmove ដំបូង (WebKit បោះបង់ pan ទាំងអស់ក្រោម web view) · អូសផ្ដេក ➜ ទស្សន៍ទ្រនិចដូចធម្មតា · ប្រអប់អក្សរផ្សេង ➜ ដូចដើម · Android/web មិនប្រែ។

#### អ្នកយាម

- `ZoeW/tests/ios-keyboard-pan.test.ts` +១ ៖ អូសបញ្ឈរលើប្រអប់ស្វែងរក (ចុះ/ឡើង) ➜ preventDefault · ផ្ដេក ➜ មិនប៉ះ · ប្រអប់អក្សរផ្សេង ➜ មិនប៉ះ · ប្រអប់មិនទាញឡើង ➜ មិនប៉ះ — លើ 2.50.69 ធ្លាក់។
- `gesture-test` ៖ browser ពិត · `#searchPhoneInput` ដែល focus (ចុះ/ឡើង) និង `#entryListSearchInput` (ផ្ទាំងស្កេន) ➜ touchmove ដំបូងត្រូវចាប់ · iOS មិនចាប់ផ្តើម pan (គំរូ `webkitPan`) ·
  ផ្ដេក ➜ មិនចាប់ — លើ 2.50.69 ១ ធ្លាក់ ➜ ១៧០/១៧០។
- ភស្តុតាង ៖ `run-all.sh` STRICT (emulator រស់) **២០៥/២០៥** ពេញលេញ (០ មួយផ្នែក · ០ រំលង) លើ `d39b280` · vitest ១៧២ ឯកសារ / ១៥១០ · tsc · eslint · purity ១៥/១៥។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ ស្វែងរកលេខ (keyboard បើក) ➜ ដាក់ម្រាមដៃក្នុងប្រអប់វាយលេខ ហើយអូសឡើងចុះ ➜ ទំព័រ និង navbar មិនរំកិល · ចុចក្នុងប្រអប់ ➜ វាយលេខបានធម្មតា · អូសឆ្វេងស្តាំ ➜ ទស្សន៍ទ្រនិចផ្លាស់ទី។
2. **iPhone PWA** ៖ ផ្ទាំងស្កេន ➜ ប្រអប់ស្វែងរកបញ្ជី ➜ ដូចសកម្មភាព ១។
3. **iPhone PWA** ៖ សកម្មភាព ១–២ របស់ [2.50.69] និង [2.50.68] នៅតែត្រូវសាក (អូសលើបញ្ជីលេខដែលស្នើ · ក្រៅបញ្ជី · បិទ keyboard ហើយអូសឡើង)។
4. **Android** (APK · PWA) ៖ មិនប្រែ។

---

### [2.50.69] — 2026-10-14 · ZoeW ៖ **iPhone PWA ៖ keyboard បើក ➜ អូសលើបញ្ជីលេខដែលស្នើ ទំព័រមិនរំកិល** (ការផ្ទៀងផ្ទាត់ PR #317 ឡើងវិញ)

**ZoeW `2.50.69`** (`zoew-v331` ➜ `zoew-v332`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែក្នុង `ios-viewport.ts` · `react-root.css` · `DocumentEffects.tsx` · `state.ts`។
សំណើម្ចាស់គម្រោង ៖ «ផ្ទៀងផ្ទាត់ ឡើងវិញទាំងអស់នៅអ្វីដែលទើបកែលើ PR 317 ក្រែងមាន កំហុស ឬចន្លោះ»។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone PWA ៖ keyboard បើក ➜ អូសលើបញ្ជីលេខទូរស័ព្ទដែលស្នើ (`.phone-suggest`) ➜ ទំព័រ និង navbar នៅតែរំកិល** (ផ្នែក ២ A83)។ [2.50.68] ការពារតែកន្លែងក្រៅបញ្ជី
  និងបញ្ជីប្រវត្តិ ៖ ប្រអប់ Suggestion (fixed · `overflow-y: auto` ➜ touch-action ចាប់ផ្តើម `auto` ឡើងវិញ) ជួរតិច ➜ រមូរមិនបាន ➜ scroll view មេយកការអូស · ជួរច្រើន ➜ ចុងបញ្ជីបន្តទៅ
  scroll view មេ។ ឥឡូវ ៖ `measureIOSKeyboardListRoom()` វាស់ប្រអប់ Suggestion ដែលបើកដែរ (ResizeObserver) ➜ `uiState.iosKeyboardSuggestFixed` ➜ `body.ios-keyboard-suggest-fixed` ➜
  `touch-action: none` · ប្រអប់ Suggestion `overscroll-behavior-y: contain` ខណៈ `body.ios-keyboard`។ Android/web មិនប្រែ។

#### អ្នកយាម

- `gesture-test` ៖ គំរូ WebKit used-touch-action លើ **ក្រឡា ២២px** នៃផ្ទៃខាងលើ keyboard (មិនមែនតែចំណុចដែលរើស) ៖ ចំណុចនីមួយៗ ហាមអូស Y ឬនៅក្នុងអ្នករមូរកូនដែលមានចន្លោះ + `contain` ·
  ទំព័រទិន្នន័យ (បញ្ជីពេញ · ទទេ) · Suggestion ២ ជួរ (រមូរមិនបាន) · ១២ ជួរ (រមូរបាន) · ទំព័រស្កេន (ស្វែងរកបញ្ជី) · ទិសផ្ទុយ ៖ keyboard បិទ ➜ គំរូរកឃើញចំណុចដែល scroll view មេយក ·
  តារាងប្រវត្តិមិនរមូរផ្ដេក (៣២០ · ៤១២ ➜ `touch-action: none` លើបញ្ជីខ្លីមិនដកការរមូរផ្ដេក) — លើ 2.50.68 Suggestion ២/២ ធ្លាក់ ➜ ១៦៧/១៦៧។
- `ZoeW/tests/ios-search-resnap.test.tsx` +១ (`iosKeyboardSuggestFixed` ↔ class · បិទ Suggestion · keyboard បិទ) · ខ្សែភ្ជាប់ CSS (touch-action + contain) — លើ 2.50.68 ២/២ ធ្លាក់។
- ភស្តុតាង ៖ `run-all.sh` STRICT (emulator រស់) **២០៥/២០៥** ពេញលេញ (០ មួយផ្នែក · ០ រំលង) លើ `16dc7e1` · vitest ១៧២ ឯកសារ / ១៥០៩ · tsc · eslint · purity ១៥/១៥។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ វាយលេខ ១–២ ខ្ទង់ក្នុងប្រអប់ស្វែងរក (keyboard បើក · បញ្ជីលេខដែលស្នើលេច) ➜ អូសឡើងចុះលើបញ្ជីនោះ ➜ ទំព័រ និង navbar មិនរំកិល · បញ្ជីវែងរមូរក្នុងប្រអប់ · ចុចលេខ ➜ ស្វែងរកធម្មតា។
2. **iPhone PWA** ៖ សកម្មភាព ១–២ របស់ [2.50.68] (អូសក្រៅបញ្ជី · បិទ keyboard ហើយអូសឡើង) នៅតែត្រូវសាក។
3. **Android** (APK · PWA) ៖ មិនប្រែ។

---

### [2.50.68] — 2026-10-14 · ZoeW ៖ **iPhone PWA ៖ ស្វែងរក (keyboard បើក) ➜ ទំព័រ និង navbar មិនរំកិល · បិទ keyboard ហើយអូសភ្លាម ➜ snap ទៅកាតបញ្ជីពេញ**

**ZoeW `2.50.68`** (`zoew-v330` ➜ `zoew-v331`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · `panels.ts` · ZTO) មិនប៉ះ —
ការកែក្នុង `ios-viewport.ts` · `react-root.css` · `DocumentEffects.tsx` · `state.ts`។
រាយការណ៍ម្ចាស់គម្រោង (លើ 2.50.67 ៖ «PTR ដើរល្អដូច android ហើយ») ៖ «ios ពេលកំពុងប្រើប្រអប់ស្វែងរក scroll ទាំងទំព័របាន ពេល scroll ទៅដើរទាំង navbar អត់ល្អដូច apk និង pwa android»
(វីដេអូ VID_20261014_213311_441) · «ពេលខ្លះបិទ keyboard ហើយ scroll ឡើង … ប្រអប់ស្វែងរកអត់លិចបាត់ស្អាត លិចបានពាក់កណ្តាលទាល់តែយើង scroll រុញថែម» (រូបថត)។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone PWA ៖ keyboard បើក ➜ អូស ➜ ទំព័រទាំងមូលព្រមទាំង navbar រំកិល ហើយលោតត្រឡប់** (ផ្នែក ២ A81 · វីដេអូ ៖ បញ្ជីទទេ «គ្មានទិន្នន័យ» · ៤.៥ · ៧.៥ · ៩–១០.៥ វិ.)។
  ការទប់ `touchmove` របស់ [2.50.65] មិនគ្រប់គ្រាន់លើឧបករណ៍ពិត ➜ ឥឡូវប្រើច្រកដែល WebKit សម្រេចខ្លួនឯងក្នុង UI process ពេលចាប់ផ្តើមប៉ះ (មិនរង់ចាំ JS) ៖
  `touch-action: none` លើ `body` និង `.app-pages` ខណៈ `body.ios-keyboard` (navbar · ប្រអប់ស្វែងរក · ក្បាលកាត · ដងអូស ➜ scroll view មេមិនរំកិល) · បញ្ជីដែលរមូរបាន ➜ `auto`
  (អ្នករមូរចាប់ផ្តើមពី auto ឡើងវិញ ➜ បញ្ជីរមូរដូច Android) · បញ្ជីដែលរមូរមិនបាន (ទទេ · ខ្លី ៖ គ្មាន scroll view កូន ➜ scroll view មេយកការអូស) ➜
  `measureIOSKeyboardListRoom()` (ResizeObserver លើបញ្ជី និងខ្លឹមសារ) ➜ `body.ios-keyboard-list-fixed` ➜ `touch-action: none` លើបញ្ជីនោះ។ keyboard បិទ ➜ ដូចដើម · Android/web មិនប្រែ។
- 🐛 **iPhone PWA ៖ បិទ keyboard ហើយអូសបញ្ជីឡើងភ្លាម ➜ ប្រអប់ស្វែងរកលិចពាក់កណ្តាលក្រោម navbar** (A82)។ ការផ្អាក snap ក្រោយទាញចុះ ([2.50.67]) នៅដល់ពិដាន (~០.៨ វិ.)
  ➜ ការអូសក្នុងចន្លោះនោះឈប់ដោយគ្មាន snap។ ឥឡូវ ៖ ការផ្អាករបស់ `settleIOSSearchPullDown()` គ្របតែ layout នៃ commit (ដោះវិញភ្លាម · ការរអិលស្វែងរកផ្អាកខ្លួនឯង) · ម្រាមដៃប៉ះក្នុងចន្លោះ
  ទាញចុះ ➜ `endPanelGlideSnapPause()` ➜ ការអូសរបស់អ្នកប្រើ snap ទៅកាតបញ្ជីពេញ។ re-snap ទៅ `.page-main` ([2.50.67]) នៅតែមិនកើត (snap state ត្រូវលុបក្នុង layout ដែលផ្អាក)។

#### អ្នកយាម

- `gesture-test` ៖ គំរូ `computeUsedTouchAction` របស់ WebKit លើ CSS ពិត ៖ keyboard បើក ➜ navbar · ប្រអប់ស្វែងរក · ចំណងជើង · ដងអូស · ក្បាលកាតបញ្ជី ហាមអូស Y · ជួរបញ្ជី `auto` ·
  បញ្ជីទទេ ➜ `body.ios-keyboard-list-fixed` + ហាម · បញ្ជីមានជួរវិញ ➜ ដក · keyboard បិទ ➜ ដូចដើម — លើ 2.50.67 ៥ ធ្លាក់ ➜ ១៦០/១៦០។
- `ZoeW/tests/ios-search-resnap.test.tsx` +៤ ៖ ការផ្អាកមិនលើសការរអិល · ម្រាមដៃបញ្ចប់ការផ្អាក (ក្រៅចន្លោះ ➜ មិនប៉ះ) · `iosKeyboardListFixed` ↔ class · ខ្សែភ្ជាប់ CSS — លើ 2.50.67 ៤/៤ ធ្លាក់។
  `ios-search-pulldown.test.ts` ៖ snap ផ្អាកពេលអាន layout ហើយដោះវិញភ្លាម។
- `state-hygiene` (CI ផ្នែក ៣ ធ្លាក់លើ `c799f42`) ៖ `listRoomObserver` (ResizeObserver នៃបញ្ជី · គ្មានទិន្នន័យអតិថិជន · ផ្ដាច់ដោយ `watchIOSKeyboardListRoom(false)` ពេលស្វែងរកបិទ និង boot-scope dispose) ➜ `ACCEPTED` ជាមួយហេតុផល ➜ PASS។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ ស្វែងរកលេខ (keyboard បើក) ➜ អូសលើ navbar · ប្រអប់ស្វែងរក · កាតបញ្ជី (ទទេ និងមានជួរច្រើន) ➜ ទំព័រ និង navbar មិនរំកិល · បញ្ជីមានជួរ ➜ រមូរ · ចុចជួរ/ប៊ូតុង ➜ ធម្មតា។
2. **iPhone PWA** ៖ បិទ keyboard (ប្រអប់ទទេ) ហើយអូសបញ្ជីឡើងភ្លាម ➜ កាតបញ្ជីឡើងដល់ក្រោម navbar ពេញ · ⛔ ប្រអប់ស្វែងរកមិនឈប់ពាក់កណ្តាល។ PTR ដូច 2.50.67។
3. **Android** (APK · PWA) ៖ មិនប្រែ។

---

### [2.50.67] — 2026-10-14 · ZoeW ៖ **iPhone PWA ៖ PTR កេះគ្រប់ដង (ចាប់ touchmove ដំបូង) · បិទ keyboard ក្រោយស្វែងរក ➜ ប្រអប់ស្វែងរកមិនលាក់ (snap ផ្អាកមុន commit)**

**ZoeW `2.50.67`** (`zoew-v329` ➜ `zoew-v330`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ZTO មិនប៉ះ · **តំបន់ហាម PTR** ៖ `pull-to-refresh.ts` កែតាមរបាយការណ៍វីដេអូ
(`LOCK` sha256 ថ្មី ក្នុង `forbidden-zone-lock.test.ts`) · `panel-motion.ts` · `phone-search.ts` · `app.css` មិនប៉ះ។
រាយការណ៍ម្ចាស់គម្រោង (វីដេអូ iPhone ២ ៖ VID_20261014_200654_541 · VID_20261014_200654_804 · លើ PR #317) ៖ «PTR នៅតែពិបាក · ស្វែងរក នៅតែមិនលិបបាត់ពេលបិទ keyboard»។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone PWA ៖ PTR ម្តងកេះម្តងអត់** (ផ្នែក ២ A79)។ វីដេអូ ៖ ទាញ ≥ ៧ ដង ទំព័រ bounce ចុះ ~១០០–១៩០pt គ្មានរង្វង់ PTR · កេះតែ ១ ដង។ មូលហេតុ (ប្រភព WebKit ពិត) ៖
  WebKit ពន្យារ UIScrollView pan តែចំពោះ touchmove **ដំបូង** (`m_touchMovePreventionState`) · PTR ហៅ `preventDefault()` តែក្រោយ `AXIS_SLOP` 22px ➜ touchmove ដំបូង
  មិនត្រូវចាប់ ➜ pan ចាប់ផ្តើមនៅ ~១០pt ➜ `_touchEventsCanPreventNativeGestures = NO` ➜ touchmove បន្ទាប់ `cancelable: false` ➜ PTR `park()` (កេះបានតែពេល move ដំបូងលោត ≥ 22px)។
  ឥឡូវ ៖ ការទាញដែល PTR តាម (កំពូល · ៤០% ខាងលើ · មិនមែនប្រអប់/ម៉ឺនុយ/ប៊ូតុង) ចាប់ touchmove ចុះបញ្ឈរ **តាំងពី move ដំបូង** (`claimsBeforeSlop()` ៖ ដូច APK) ➜ iOS មិនចាប់ផ្តើម pan ·
  គ្មាន bounce · កម្រិត indicator/refresh ដដែល (56 · 213px)។ ប៊ូតុងក្នុងជួរតារាង ➜ មិនចាប់មុន slop (tap នៅធម្មតា) · អូសឡើង/ផ្ដេក · តារាងរមូររួច · ប្រអប់ · ម៉ឺនុយ · ប៊ូតុង/វាលក្រៅតារាង ➜ ដូចដើម។
  Android (APK) មិនប្រែ (ចាប់មុន slop ដូចដើម · រួមទាំងប៊ូតុងក្នុងតារាង)។
- 🐛 **iPhone PWA ៖ បិទ keyboard ក្រោយស្វែងរក ➜ ប្រអប់ស្វែងរករអិលឡើងលាក់ក្រោម navbar ~១ វិ. ហើយលោតត្រឡប់** (ផ្នែក ២ A80 · ការកែ [2.50.66] ពិនិត្យ **មុន** React commit ➜ ឃើញ ០ ➜ មិនធ្វើអ្វី)។
  មូលហេតុ (ប្រភព WebKit ពិត) ៖ `.page-main` ជាគោលដៅ snap តែមួយ · ខណៈប្រអប់ទាញឡើង offset របស់វា = ០ = ទីតាំងរមូរ ➜ WebKit កត់វាជាប្រអប់ដែល snap ➜ ទាញចុះ ➜
  `resnapAfterLayout()` ក្នុង layout ដំបូងក្រោយ commit (សមកាល) រំកិលទៅ offset ថ្មីរបស់ `.page-main` ➜ ការរអិលទៅទីតាំងនោះ ➜ ការពិនិត្យយឺត (`IOS_SEARCH_PULLDOWN_SETTLE_MS`) លោតត្រឡប់ ០។
  ឥឡូវ ៖ `settleIOSSearchPullDown()` ផ្អាក snap (`beginPanelGlideSnapPause()` ➜ `panel-gliding`) **ក្នុង commit ដដែលនឹងការទាញចុះ** ➜ WebKit លុប snap state ➜ គ្មាន re-snap ➜ ប្រអប់ស្វែងរក
  រអិលចុះទៅកន្លែងដើម (ក្រោមកាត «គ្រប់គ្រងប្រចាំថ្ងៃ») ➜ snap ត្រឡប់នៅ ០ (គ្មានគោលដៅក្នុង proximity) ➜ នៅដដែល។ Android/web · អេក្រង់ ≥ 992 មិនប្រែ។

#### អ្នកយាម

- `gesture-test` ៖ គំរូ WebKit (`webkitPan` ៖ pan ចាប់ផ្តើមនៅ ១០px បើ touchmove ដំបូងមិនត្រូវចាប់ · ក្រោយនោះ `cancelable: false` លើកលែង move មុន pan ត្រូវចាប់) ៖ ទាញ ២ · ៤ · ១២ px/ស៊ុម ➜
  move ដំបូងត្រូវចាប់ · គ្មាន pan · ready · ទិសផ្ទុយ (អូសឡើង ➜ pan ធម្មតា · ប៊ូតុងក្នុងជួរ ➜ មិនចាប់) · អូសខ្លី 14px ➜ ចាប់ move ដំបូង តែមិន refresh · indicator លាក់ — លើដើមឈើ PR #317 ៨ ធ្លាក់ ➜ ១៥០/១៥០។
- `ZoeW/tests/ios-search-resnap.test.tsx` (ថ្មី ៤) ៖ គំរូ re-snap របស់ WebKit លើ DOM ដែល React ពិតគូរ (`AppPages` · លំដាប់ commit ពិត) ៖ គំរូអាចធ្លាក់ (គ្មានការផ្អាក ➜ re-snap · ប្រអប់ស្វែងរកលាក់ ·
  ការរអិលឡើង = វីដេអូ) · ទាញចុះ ➜ `panel-gliding` · គ្មាន re-snap · scrollTop ០ · ការរអិលចុះទៅទីតាំងពិត · ក្រោយ snap ត្រឡប់ + ការពិនិត្យយឺត ➜ ០ · App មិនសរសេរ scroll · ទាញឡើង/ចុះម្តងទៀត —
  លើដើមឈើ PR #317 ៣/៤ ធ្លាក់ (គំរូដែលអាចធ្លាក់ជាប់)។ `ios-search-pulldown.test.ts` ៖ + snap ផ្អាក · Android/web មិនផ្អាក។
- `forbidden-zone-lock` ៖ sha256 `pull-to-refresh.ts` ថ្មី (សំណើ ៖ វីដេអូម្ចាស់គម្រោងខាងលើ)។
- `npm run purity:check` ៖ ពិដានការលើកលែង `platform/document-io.ts` ត្រឡប់ដូចមុន switch haptic (`createElement` ៤ · `document.body` ៣ · `appendChild` ៣ · `click` ១ · ដក `setAttribute` · `className`) —
  PR #317 ដកកូដ haptic តែទុកពិដាន ➜ ២ FAIL («ធាតុងាប់» · «ពិដានតឹង») ➜ ១៥/១៥។

#### ភស្តុតាង (session · emulator RTDB · Postgres ពិត)

- vitest ១៧២ ឯកសារ · ១៥០៤ · `tsc -b` · eslint · `purity:check` ១៥/១៥ · strip-comments ស្អាត ២៦០។
- run-all STRICT (`0c99f7d`) ៖ ២០២/២០៥ — ធ្លាក់ ៣ ៖ `doc-scope-test` (CLAUDE.md យោង `resnapAfterLayout()` ជា helper ដែលមិនមានក្នុង repo · លិបិក្រម `forbidden-zone-lock.test.ts` ខ្វះ ផ្នែក ១ ➜ កែទាំង ២) ·
  `layout` (`pinSetupModal` @768px 271u < 276u ពេល ៤ lanes រវល់ · CSS មិនប៉ះក្នុងជុំនេះ) · `revenue-fuzz` («Resulting promise was garbage collected» របស់ Playwright · មិនមែន assertion) ➜
  `RUNALL_ONLY` លើ tree ដដែល ៖ `layout` ១៧៥ PASS · `revenue-fuzz` PASS ➜ ធ្លាក់តែពេលម៉ាស៊ីនរវល់ ⛔ មិនប្តូរពិដាន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. Deploy **ZoeW** (merge ចូល `main` ពេលម្ចាស់គម្រោងស្នើ)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
1. **iPhone PWA** ៖ ទាញចុះពី ៤០% ខាងលើ ពេលបញ្ជីនៅកំពូល (យឺត · ធម្មតា · លឿន) ➜ រង្វង់ PTR តាមម្រាមដៃតាំងពីដើម · ទំព័រមិន bounce · លែងដៃពេលរង្វង់ក្រហម ➜ ផ្ទុកឡើងវិញគ្រប់ដង។
   ពិនិត្យទិសផ្ទុយ ៖ ចុចប៊ូតុងជួរតារាង · អូសបញ្ជីឡើង · អូសផ្ដេក ➜ ធម្មតា។ នៅពិបាក ➜ វីដេអូ + ប្រាប់កន្លែងដាក់ម្រាមដៃ (ទាញចាប់ពីក្រោម ៤០% មិនកេះ ៖ ច្បាប់ម្ចាស់គម្រោង)។
2. **iPhone PWA** ៖ ស្វែងរកលេខ ➜ បិទ keyboard (ចុច «✓» ឬចុចក្រៅ · ប្រអប់ទទេ) ➜ ប្រអប់ស្វែងរករអិលចុះទៅក្រោមកាត «គ្រប់គ្រងប្រចាំថ្ងៃ» · ⛔ មិនឡើងលាក់ក្រោម navbar · មិនលោត។
3. **Android** (APK · PWA) ៖ PTR · ស្វែងរក ដូចដើម។

---

### [2.50.66] — 2026-10-14 · ZoeW ៖ **iPhone PWA ៖ បិទ keyboard ក្រោយស្វែងរក ➜ ប្រអប់ស្វែងរកនៅឃើញ · ស្លាកស្ថិតិបត់បន្ទាត់ · ប៊ូតុង «បញ្ចូលច្រើន» ស្មើ · ផ្ទាំងបោះពុម្ពលើអេក្រង់តូច**

**ZoeW `2.50.66`** (`zoew-v328` ➜ `zoew-v329`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts` · ZTO) មិនប៉ះ — ការកែទាំងអស់ក្នុង `ios-viewport.ts` · `react-root.css` · `LabelPrintModal.tsx`។
រាយការណ៍ម្ចាស់គម្រោង (រូបថត iPhone ៣ សន្លឹក ក្រោយ merge PR #316) ៖ «iOS ពេលចុចបិទ keyboard scroll ទៅលាក់ ស្វែងរក អត់ជិតស្អាត · ប៊ូតុង បញ្ចូលច្រើនមិនស្មើគេឯង · ពិនិត្យ modal ថ្មីអោយសមស្របគ្រប់ទំហំអេក្រង់ · ទម្រង់បង្ហាញថ្មីធ្វើអោយអានអក្សរមិនអស់ នៅកន្លែង គ្រប់គ្រងកញ្ចប់ប្រចាំថ្ងៃ លើអេក្រង់តូច»។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone PWA ៖ ស្វែងរកលេខ ➜ បិទ keyboard ➜ ទំព័ររំកិលឡើង ➜ ប្រអប់ស្វែងរកលាក់ក្រោម navbar** (ផ្នែក ២ A78)។ Chromium (ក្លែង iOS) វាស់បាន ៖ ទាញឡើង ➜ `#appPages` គ្មានចន្លោះរមូរ ➜
  `scrollTop` ត្រឡប់ ០ ➜ ទាញចុះ ➜ ០ (ប្រអប់ស្វែងរកនៅ 374px · ឃើញពេញ) — Android ត្រឹមត្រូវដូចម្ចាស់គម្រោងនិយាយ។ WebKit ទុកទីតាំងផ្សេង (snap `.page-main` ឬទីតាំងមុន focus) ➜
  ឥឡូវ ៖ ប្រអប់ទាញចុះ (`dataPanelSearchFocus` true ➜ false · iOS standalone · ទូរស័ព្ទ) ➜ `settleIOSSearchPullDown()` ក្នុង microtask ដដែល ៖ `#appPages` ➜ ០ តាម
  `setElementScrollTop()` ហើយការរអិលចាប់ផ្តើមឡើងវិញពីទីតាំងដែលឃើញ (`panelGlideFrom()` លើកាតស្វែងរក + កាតបញ្ជី · ចលនាស្វែងរកដដែល ➜ មិនលោត) · ក្រោយ
  `IOS_SEARCH_PULLDOWN_SETTLE_MS` (ការរអិល + hold + grace + 200ms) បើ WebKit រំកិលម្តងទៀត (keyboard បិទយឺត) ➜ ០ ម្តងទៀត ⛔ មិនប៉ះពេលមានម្រាមដៃប៉ះក្នុងចន្លោះនោះ ·
  ប្រអប់ទាញឡើងវិញ · ប្រអប់នៅ focus។ Android/web · អេក្រង់ ≥ 992 ➜ មិនប៉ះ។ ប្រអប់ដែលមានលេខនៅក្នុង (មិនទាញចុះ) នៅដដែលដូចមុន។
- 🐛 **iPhone PWA ៖ PTR ម្តងដើរម្តងអត់ (ម្ចាស់គម្រោង ៖ «PTR មុនលើ iOS ស្រួលកេះដូច APK និង PWA Chrome តែឥឡូវម្តងកេះបានម្តងអត់») ហើយនៅតែមិនញ័រ** (A77 កែ)។
  ការប្រែតែមួយគត់លើផ្លូវ PTR iOS ក្នុង 2.50.65 (diff `7960a90..9272d88` ៖ touch · scroll · PTR · iOS) = `iosHapticSwitchTick()` ➜ `label.click()` លើ
  `<input switch>` **ក្នុងកាយវិការទាញ** (touchmove · ដល់កម្រិត) ➜ WebKit បញ្ចប់/កាត់ touch ➜ PTR ចោល · ហើយ iOS 26.5+ (WebKit bug 309082) លេងញ័រតែពីចុចផ្ទាល់
  (click ពី script = untrusted) ➜ មិនញ័រទោះដើរ។ ឥឡូវ ៖ ដក switch ចេញទាំងស្រុង (`haptics.ts` web ➜ `navigator.vibrate` តែប៉ុណ្ណោះ · `document-io.ts` ·
  `.haptic-switch` · `haptic-ios-switch.test.ts`) ➜ PTR iOS ដូច 2.50.64 · ⛔ ព្រំដែនទទួលស្គាល់ ៖ iPhone web គ្មានញ័រ PTR (APK · Android ញ័រដូចដើម) ·
  ឯកសារ PTR ចាក់សោមិនប៉ះ (ហៅ `hapticTick()` ដដែល)។
- 📊 **«កញ្ចប់សរុប (នៅសល់)» កាត់ «…» លើអេក្រង់តូច** ៖ `.stat-card .label` ក្នុង `app.css` (ចាក់សោ) ជា `nowrap + ellipsis` ➜ វាស់ ៖ ៣២០ ទាំង ៣ ស្លាក · ៣៦០–៤១២ ស្លាកទី ១ ·
  ១២៨០ ទាំង ៣ (ជួរឈរ ៣៨០px) ➜ `react-root.css` បត់បន្ទាត់ (`white-space: normal` · `overflow-wrap: anywhere` ៖ «អតិថិជនយក» គ្មានកន្លែងបត់ក្នុងពុម្ពជំនួសរបស់ CI ➜ បត់ក្នុងពាក្យជាជាងកាត់ · មិនកាត់) ➜ អានបានគ្រប់ទទឹង (វាស់ ៣២០–១២៨០ ជាមួយពុម្ព Kantumruy Pro ពិត និងពុម្ពជំនួស ៖ ០ កាត់)។
- 📋 **ប៊ូតុង «📋 បញ្ចូលច្រើន» ≠ «📁 យក Barcode ពីរូបភាព»** (១៨០×៣៨ ទល់ ១២៨×៤២ ៖ `button` មាន margin UA · ទទឹងតាមអក្សរ) ➜ `flex: 1 1 0` · `margin: 0` · `font-family: inherit` ·
  បត់អក្សរ ➜ ស្មើគ្នា (វាស់ ៣២០–១២៨០ ៖ ទទឹងស្មើ · កម្ពស់ស្មើ)។
- 🖨️ **ផ្ទាំងបោះពុម្ពស្លាកលើអេក្រង់តូច** ៖ គំរូ 50×30 (zoom 1.6) ទទឹង ២៩២px ក្នុងកន្លែង ២៥៨px នៅ ៣២០ ➜ scroll ផ្តេក · លេខទូរស័ព្ទកាត់ ➜ `@media (max-width: 359px)` zoom 1.3
  (60×40 ➜ 1.1) ➜ សមទទឹង · កុងតាក់ «តែកញ្ចប់មិនទាន់យក» ➜ «បង្ហាញតែកញ្ចប់មិនទាន់យក» (ស្រៈ «ែ» នៅដើមពាក្យគូរចូលចន្លោះប្រអប់ធីក ➜ មើលទៅជាប់ · ឥឡូវចាប់ផ្តើមដូចកុងតាក់ដទៃ) ·
  ក្រឡាកុងតាក់ ≥ 200px (desktop ៖ ២ ជួរឈរ មិនបត់អក្សរ)។ ផ្ទាំង «📋 បញ្ចូល Barcode ច្រើន» វាស់ ៣២០–១២៨០ ៖ សមរួចហើយ (មិនប្រែ)។

#### អ្នកយាម

- `ZoeW/tests/ios-search-pulldown.test.ts` (ថ្មី ៥) ៖ ទាញចុះខណៈ `#appPages` រំកិលរួច ➜ ០ + រអិលឡើងវិញ ២ ធាតុ (កាតស្វែងរក · កាតបញ្ជី · `PANEL_SEARCH_GLIDE`) · WebKit រំកិលម្តងទៀត
  ➜ ០ នៅ `IOS_SEARCH_PULLDOWN_SETTLE_MS` (> ការរអិល + hold + grace) · ទិសផ្ទុយ (ម្រាមដៃប៉ះ · ទាញឡើងវិញ · focus · Android/web · អេក្រង់ធំ) · ខ្សែភ្ជាប់ (`setElementScrollTop` ·
  `listenIOSKeyboard`) — លើដើមឈើមុនកែ ៤/៥ ធ្លាក់ (ទិសផ្ទុយជាប់ដោយសារគ្មានកូដ)។
- `layout-check` +៣ ក្នុង ZoeW គ្រប់ទំហំ (៣២០ · ៣៦០ · ៤១២ · ៧៦៨ · ១០២៤ · ១២៨០) ៖ ស្លាកក្រឡាស្ថិតិ ៣ មិនកាត់ · មិន `nowrap`/`ellipsis` · ប៊ូតុងទាំង ២ ទទឹង/កម្ពស់ ±1px · ក្នុងជួរ ·
  អក្សរមិនកាត់ · គំរូស្លាកតូច ៣ ទំហំ (ស្លាកពិត ៖ លេខ ១០ ខ្ទង់ · Barcode · COD/DOD · ថ្ងៃ · Locker) គ្មាន scroll ផ្តេក · លេខមិនកាត់ — លើដើមឈើមុនកែ ធ្លាក់ (ស្លាក · ប៊ូតុង · ៣២០ preview)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

0. **iPhone PWA** ៖ PTR ទាញពី ៤០% ខាងលើ ពេលបញ្ជីនៅកំពូល ➜ ត្រូវកេះគ្រប់ដង ដូច 2.50.64 (ញ័រ ៖ គ្មាន — ព្រំដែន iOS)។
1. **iPhone PWA** ៖ ស្វែងរកលេខ (keyboard បើក) ➜ ចុចក្រៅប្រអប់ដើម្បីបិទ keyboard (ប្រអប់ទទេ) ➜ ទំព័រត្រូវត្រឡប់ទៅកំពូល ៖ កាត «គ្រប់គ្រងប្រចាំថ្ងៃ» · ប្រអប់ស្វែងរក ·
   កាតបញ្ជីតាមលំដាប់ ⛔ ប្រអប់ស្វែងរកមិនលាក់ក្រោម navbar។ បើនៅលាក់ ➜ ថតវីដេអូ (ម៉ោងបិទ keyboard ➜ ទីតាំងចុងក្រោយ) — WebKit អាចរំកិលក្រោយ ១ វិ.។
2. **iPhone** ៖ ស្លាក «កញ្ចប់សរុប (នៅសល់)» បង្ហាញ ២ បន្ទាត់ · ទំព័រស្កេន ប៊ូតុងទាំង ២ ស្មើគ្នា · ផ្ទាំងបោះពុម្ពស្លាកគំរូមិនលើសអេក្រង់។
3. **Android** (APK · PWA) ៖ មិនប្រែ (ពិនិត្យស្លាកស្ថិតិ · ប៊ូតុង)។

---

### [2.50.65] — 2026-10-14 · ZoeW ៖ **🖨️ បោះពុម្ពស្លាកកញ្ចប់ · 📋 បញ្ចូល Barcode ច្រើន · iPhone PWA ៖ ស្វែងរកលេខពេល keyboard បើក ➜ កាតបញ្ជីចប់ពីលើ keyboard · PTR ញ័រ**

**ZoeW `2.50.65`** (`zoew-v327` ➜ `zoew-v328`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `app.css` · `phone-search.ts`) មិនប៉ះ · Android (APK · PWA) · កុំព្យូទ័រ មិនប្រែ។
រាយការណ៍ម្ចាស់គម្រោង (វីដេអូ VID_20261014_155824) ៖ «ចលនា scroll របស់ PWA iOS ដូចខុសប្រក្រតី ដោយឡែកចំពោះ APK និង PWA Android រលូនល្អ»។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone PWA ៖ ស្វែងរកលេខ (ប្រអប់ទាញឡើង · keyboard បើក) ➜ អូសលើកាតបញ្ជី ➜ ទំព័រទាំងមូល (navbar · ប្រអប់ស្វែងរក) រំកិលឡើងតាមម្រាមដៃ បង្ហាញចន្លោះទទេ
  ហើយលែងដៃ ➜ លោតត្រឡប់ក្នុង ១ ស៊ុម** (ផ្នែក ២ A76)។ មូលហេតុ ៖ iOS មិនបង្រួម viewport ពេល keyboard បើក (Android បង្រួម) ➜ កាតបញ្ជី (`100dvh`) លាតដល់ក្រោយ keyboard ·
  iOS អនុញ្ញាតឲ្យអូស document ទោះ root ចាក់សោ ➜ `restoreIOSDocumentScroll()` (2.50.42) ត្រឡប់ ០ ពេល `scroll` មកដល់ (ចុងកាយវិការ) = លោត។ ឥឡូវ ៖ (១) `visualViewport`
  `resize` វាស់កម្ពស់ keyboard (`innerHeight - visualViewport.height` ≥ `KEYBOARD_MIN_INSET_PX`) ➜ `uiState.iosKeyboardInset` ➜ `body.ios-keyboard` + `--ios-keyboard-inset`
  ➜ `.app-pages` `padding-bottom` ➜ កាតបញ្ជីចប់ ៨px ពីលើ keyboard ហើយបញ្ជីរមូរក្នុងកាតខ្លួនឯង (ដូច Android) · (២) `touchmove` បញ្ឈរក្រៅអ្នករមូរដែលមានកន្លែងក្នុងទិសនោះ ➜
  `preventDefault()` (`blockIOSKeyboardPan()`) ➜ document មិនរំកិល · អ្នករមូរមានកន្លែង · អូសផ្ដេក · ក្នុងប្រអប់អក្សរ · ម្រាមដៃពីរ ➜ iOS ធម្មតា · `restoreIOSDocumentScroll()`
  នៅជាខ្សែការពារទីពីរ។ ប្រអប់បិទ ឬ keyboard បិទ ➜ ០ ➜ ទម្រង់ដើម។
- 🖨️ **បោះពុម្ពស្លាកកញ្ចប់** (ម្ចាស់គម្រោង ៖ «print លេខទូរស័ព្ទនិង barcode ថ្ងៃទី/ខែ ឧ. (15/10) តែលេខទូរស័ព្ទសុំដាក់ធំៗ … យកទៅបិទជាប់កញ្ចប់អីវ៉ាន់ព្រោះកញ្ចប់អីវ៉ាន់មិនមានលេខទូរស័ព្ទទេ»)
  ៖ ម៉ឺនុយ (...) ខាងលើ «🖨️ បោះពុម្ពស្លាក (តម្រង)» = កញ្ចប់ទាំងអស់តាមតម្រងថ្ងៃ · ម៉ឺនុយ (...) តាមជួរ «🖨️ បោះពុម្ពស្លាក» = អតិថិជននោះ ➜ **ផ្ទាំង `labelPrintModal`** (ម្ចាស់គម្រោង ៖
  «បន្ថែម modal print … ដូច modal sheet … ធ្វើតាមគំនិតរបស់អ្នក») ៖ វិសាលភាព · សង្ខេប (ស្លាក N · អតិថិជន M) · ទំហំស្លាក **មួយសន្លឹកមួយស្លាក** (ម្ចាស់គម្រោង ៖ «ដាក់អោយចេញម្តងមួយសន្លឹក … មិនមែន print ជា A4 ទេ … ដូច price tag») ៖ `50x30` លំនាំដើម (ម្ចាស់គម្រោង ៖ «ប្រើជាមួយ printer តូចបែបនេះបានផង 50×30mm» — Niimbot B1 ៖ named page
  `@page zoeLabel50x30 { size: 50mm 30mm }` · ស្លាក 47×27mm · លេខ 17pt · Barcode 7mm · ⚠️ ម៉ាស៊ីនប្រភេទនេះបោះពុម្ពតាម App របស់វា ➜ Save as PDF ➜ App · ⚠️ Safari/iOS មិនស្គាល់ named page ➜ ទំហំទំព័រតាម dialog ប៉ុណ្ណោះ · Chromium/Android/APK ត្រឹមត្រូវ) · `40x30` · `60x40` (named page ផ្ទាល់ខ្លួន · អក្សរតាមទំហំ) · `single` (ទំហំតាម dialog) · `a4-3` (៩/ទំព័រ) · `a4-2` (ធំ) ជាជម្រើសបន្ទាប់បន្សំ (`break-after: page` លើស្លាកតូចទាំងអស់) · កុងតាក់ តម្លៃ $ · ថ្ងៃ/ខែ · Locker · «តែកញ្ចប់មិនទាន់យក» (លំនាំដើមបើក ៖ រំលង Barcode `isClosed`) · ជម្រើសរក្សាទុក `zoew_label_print_v1` ·
  **preview ផ្ទាល់** (`LabelSheet` ដដែល · ≤ ៦ · `zoom` .55) · «🖨️ បោះពុម្ព» (បិទពេលគ្មានស្លាក) · screenshot ទូរស័ព្ទ/កុំព្យូទ័រ ផ្ញើម្ចាស់គម្រោង។ ស្លាកមួយក្នុងមួយ Barcode
  (`features/label-print.ts` ➜ `buildLabelRows()`) ៖ លេខទូរស័ព្ទ ៣០pt ដិត · Code 128 (SVG ដដែលនឹងបញ្ជី ZTO · ស្កេនបាន) · លេខ Barcode · ថ្ងៃ/ខែ ពី `scanDate`
  (`labelDateOf('2026-10-15')` = 15/10) · ទឹកប្រាក់ «COD $6.93 · DOD $…» (`labelMoneyText()` · តែ > 0 · ដូចដែលម្ចាស់គម្រោងសរសេរដោយដៃលើបុង ៖ ថ្ងៃ · លេខ · ដុល្លារ) · Locker (N/A ➜ គ្មាន) · គ្មានលេខ ➜ «—»។ ផ្លូវបោះពុម្ព = ផ្លូវ PDF export ដដែល (`uiState.pdfExportView = { kind: 'labels' }` ➜
  `#pdfExportPrintArea` `LabelSheet` ➜ `beginPdfPrint()` ៖ web print dialog · APK plugin printer) · A4 ផ្ដេក (`@page` ដដែល) ៣ ជួរឈរ · ទទេ ➜ toast តាម `emptyViewMessage` · គ្មាន print។
- 📋 **បញ្ចូល Barcode ច្រើន** (ម្ចាស់គម្រោង ៖ «វាយបញ្ចូល ឬឧបករណ៍ស្កេន barcode បានច្រើន 10-20 barcode ទើបចុចបញ្ចូលម្តង ហើយអោយ auto lookup ដូចគ្នាបេះបិទ») ៖ ទំព័រស្កេន ·
  របៀបបញ្ចូលកញ្ចប់ ➜ «📋 បញ្ចូលច្រើន» (ក្រោមប្រអប់ Hardware scanner) ➜ ផ្ទាំង `batchScanModal` (textarea មួយជួរមួយ Barcode · ឧបករណ៍ស្កេនផ្ញើ Enter ➜ ជួរថ្មី · រាប់ចំនួន)
  ➜ «▶️ ចាប់ផ្តើម» ➜ `startBatchScan()` (`features/batch-scan.ts`) បញ្ចូល **ម្តងមួយៗតាម `triggerScanAction()` ដដែល** (ផ្លូវស្កេនធម្មតា ៖ claim · lookup · ផ្ទាំងបញ្ជាក់ ·
  Fast Mode autoSubmit) ហើយរង់ចាំ `phoneModal` បិទ (រក្សាទុក ឬបោះបង់) ទើបបន្ត (subscription លើ `uiState` · គ្មាន timer) · Barcode មានរួច ➜ រំលង · ផ្ទាំងផ្សេងបើក ➜ រង់ចាំ ·
  ប្តូររបៀបស្កេន ឬក្រៅបណ្ដាញ (`navigator.onLine === false` · ដូចការនាំចូលបញ្ជី ZTO) ➜ ឈប់ + សរុប · ប្តូរ session ➜ ឈប់ស្ងាត់ · «⏹️ បញ្ឈប់» ➜ ចប់ក្រោយកញ្ចប់បច្ចុប្បន្ន · logout ➜ `resetBatchScan()` · បន្ទាត់ស្ថានភាព «📋 កំពុងបញ្ចូល N/M · code» ក្នុង
  ប្រអប់ scanner · ចប់ ➜ toast «✅ បញ្ចូលច្រើនចប់ ៖ បញ្ចូល N · មានរួច K · រំលង J» (រាប់ Barcode ដែលចូលបញ្ជី — ការរក្សាទុកនីមួយៗប្រាប់ ✅/⏳/⚠️ របស់វាដដែល) · ≤ `BATCH_SCAN_MAX` (200)។
- 📳 **iPhone PWA ៖ PTR ញ័រពេលទាញគ្រប់** (ម្ចាស់គម្រោង ៖ «iOS PTR អត់ញ័រ» · A77)។ WebKit គ្មាន `navigator.vibrate` ➜ `hapticTick()` ធ្លាក់ទៅ `iosHapticSwitchTick()`
  (`platform/document-io.ts`) ៖ `<label><input type="checkbox" switch>` លាក់ក្រៅអេក្រង់ (មិន `display: none`) សាងម្តងក្នុងទំព័រ ➜ `label.click()` ➜ Safari (iOS 17.4+)
  លេងញ័រពេល switch ផ្លាស់ · browser គ្មាន `switch` (`'switch' in input` មិនពិត) ➜ គ្មានអ្វី · Android web នៅ `vibrate` · APK នៅ Capacitor Haptics ·
  ឯកសារ PTR ចាក់សោមិនប៉ះ (ហៅ `hapticTick()` ដដែល)។
- ⚠️ **មិនទាន់វាស់លើ iPhone ពិត** ៖ Chromium គ្មាន keyboard iOS ហើយគ្មាន `switch` ➜ មូលហេតុសន្និដ្ឋានពីរូបវីដេអូ (A76) · haptic ពីឯកសារ WebKit (A77) ➜ ត្រូវសាក (សកម្មភាព ២)។

#### អ្នកយាម

- `ZoeW/tests/ios-keyboard-pan.test.ts` (ថ្មី ១០) ៖ inset ពី `visualViewport` (≥ កម្រិត · keyboard បិទ ➜ ០ · ប្រអប់បិទខណៈ keyboard បើក ➜ ០ · ទាញឡើងម្តងទៀត ➜ វាស់ឡើងវិញ ·
  ប្រអប់មិនទាញឡើង · អេក្រង់ធំ · Android/web ➜ ០ · គ្មាន listener) · ខ្សែភ្ជាប់ (boot · `DocumentEffects` · `react-root.css` ត្រឹម `html.ios-standalone body.ios-keyboard`) ·
  `touchmove` (preventDefault ក្រៅអ្នករមូរ · ចាក់សោក្នុងកាយវិការ · អ្នករមូរមានកន្លែង/ដល់ចុង/ត្រឡប់ទិស · ផ្ដេក · ប្រអប់អក្សរ · ម្រាមដៃពីរ · មិន cancelable · listener
  capture + មិន passive) — លើដើមឈើមុនកែ ១០/១០ ធ្លាក់។ `ios-search-viewport` · `ios-search-tap-focus` នៅបៃតង (២៥/២៥)។
- `ZoeW/tests/label-print.test.tsx` (ថ្មី ៩) ៖ `labelDateOf` · `labelMoneyText` · `buildLabelRows` (មួយ Barcode មួយស្លាក · — · Locker · ធាតុចាស់ · `openOnly`) · ជម្រើស
  localStorage (លំនាំដើម · ខូច) · ម៉ឺនុយ ➜ modal (វាល · preview ៣ · សង្ខេប · class ប្លង់) · ប្តូរជម្រើស ➜ preview + រក្សាទុក + ផ្ទុកវិញ · បោះពុម្ព ➜ modal បិទ · view `labels`
  + `options` · `#pdfExportPrintArea` គូរគ្រប់ស្លាក · `afterprint` សម្អាត · តាមជួរ · ≤ `LABEL_PREVIEW_MAX` · ទទេ/stale/យករួចទាំងអស់ ➜ toast/សង្ខេប · ប៊ូតុងបិទ · logout · ខ្សែភ្ជាប់ · CSS។
- `ZoeW/tests/batch-scan.test.ts` (ថ្មី ១១) ៖ ញែក · រាប់ · ៣ Barcode ម្តងមួយៗ រង់ចាំផ្ទាំង · មានរួច/trigger គ្មានផ្ទាំង ➜ បន្ត · ផ្ទាំងផ្សេង ➜ រង់ចាំ · បញ្ឈប់ · ប្តូររបៀប/session/logout ·
  ក្រៅបណ្ដាញ ➜ ឈប់ · ទទេ/លើសពិដាន · ខ្សែភ្ជាប់ (MODAL_IDS · AppShell · ACTION_ALLOWLIST = ACTION_NAMES · PageEntry · logout) · **`triggerScanAction` ពិត** ➜ `attemptAutoLookup(code)` ហៅម្តងមួយតាមលំដាប់
  ហើយ `phoneModal` ពិតបើក (ម្ចាស់គម្រោង ៖ «Lookup ឆ្លើយត្រូវអត់?» — ផ្លូវ lookup ដដែលនឹងស្កេនធម្មតា · ZTO ពិតសាកលើឧបករណ៍) (១១ ករណី)។
- `ZoeW/tests/haptic-ios-switch.test.ts` (ថ្មី ៥) ៖ គ្មាន `vibrate` + `switch` មាន ➜ label + `input[switch]` មួយក្នុង `<body>` · ចុច ➜ `checked` ផ្លាស់រាល់ដង · សាងម្តង ·
  `vibrate` មាន ➜ ហៅ `vibrate` · គ្មាន switch · គ្មាន `switch` ➜ គ្មានធាតុ · មិន throw · CSS `.haptic-switch` ក្រៅអេក្រង់ មិន `display: none` — លើដើមឈើមុនកែ ធ្លាក់។

#### ភស្តុតាង (run-all STRICT · emulator RTDB · Postgres ពិត)

- ជុំ ១ (`c7c056d`) ៖ ២០១/២០៥ — ធ្លាក់ ៤ ពីការកែ tree កណ្តាលរត់ (កំណែក្នុង README/CLAUDE.md · ឯកសារថ្មីមិនទាន់ map · `gesture` ៖ listener `touchmove` ទប់ទី ២ លើ document)
  ➜ listener ចងតែខណៈប្រអប់ស្វែងរកទាញឡើង · ជុំ ២–៤ ឈប់ដោយដៃ (commit ថ្មីចេញបន្ត) · **ជុំ ៥ (`6071e43`) ៖ ១៩៧/២០៥ — ធ្លាក់ ៨ ជាចន្លោះនៃការងារថ្មី** ៖
  `setup-link-logout-test` (sandbox ខ្វះ stub `resetBatchScan`/`resetLabelPrint`) · `clear-history-claim-test` (import `label-print ➜ ui/more-menu` ប្តូរលំដាប់ module ក្នុង
  text view ➜ `clearHistory()` មុន `CLEAR_HISTORY_CLAIM_LEASE_MS` ➜ ប្លុក helper រកមិនឃើញ ➜ វាស់ edge នីមួយៗដោយ build-audit ៥ variant ➜ `filteredHistoryItems()` ក្នុង `export.ts`
  ជំនួស) · `function-surface-test` (`batchScanIsRunning` គ្មានអ្នកហៅ ➜ ប្រើក្នុង `openBatchScanModal`) · `state-hygiene` (`keyboardPanScope` ➜ ACCEPTED) ·
  `repository-file-coverage` (`LabelPrintModal.tsx` គ្មាន mapping) · `security-guard` (លេខទូរស័ព្ទ/waybill ពិតពីរូបម្ចាស់គម្រោងក្នុង test ➜ លេខសំយោគ `0960001234` ·
  `771000003…`) · `css-classes` (`.label-date` គ្មាន rule · class `'layout-' + x` ➜ ផែនទី class ជាអក្សរពេញ) · `toast-action-truth` (toast «⏹️ …» គ្មានន័យ ➜ «ℹ️ …») ➜
  ទាំង ៨ PASS លើ `RUNALL_ONLY` (`setup-link-logout` ៧២ · `clear-history-claim` ៦ · `function-surface` ២៧ · `security-guard` ៥៥ · `toast-action-truth` ៦៧) ➜ **ជុំ ៦ (`fbb48c0`) ៖ ២០៣/២០៥ · ០ រំលង** — ធ្លាក់ ២ ៖ `export-cells-test` (sandbox កាត់ `buildExportRows()` ហៅ `filteredHistoryItems()` ដែលមិនមានក្នុង sandbox ➜ `buildExportRows()`
  ហៅ `getFilteredDataByDate()` ផ្ទាល់ដដែល · `filteredHistoryItems()` នៅតែសម្រាប់ `label-print` ➜ `RUNALL_ONLY` PASS ៣៣) · `zoew-suite 2/2` ➜ `history-window-check` «PWA Android ៖
  ចលនាស្វែងរកមិនលោត» ស៊ុមទី ៨ ផ្លាស់ទី ២២.៦% ក្រោយស៊ុម ០ (ស៊ុមធ្លាក់ពេល ៤ lanes រវល់ · កូដចាក់សោមិនប៉ះ · PASS ជុំ ៥) ➜ រត់ `npm run native:check` តែឯងម្តង ➜ ១១៦ ok ·
  history-window ០ FAIL (APK · PWA Android · PWA iPhone ទាំង ៣ ✅) = flake ពី CPU ⛔ មិនប្តូរពិដាន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** (merge ចូល `main`)។ Firebase rules · migration Supabase ៖ **គ្មាន**។
2. iPhone (App លើ Home Screen) ៖ ចុចស្វែងរកលេខ ➜ keyboard បើក ➜ (ក) កាតបញ្ជីចប់ពីលើ keyboard (គ្មានជួរនៅក្រោយ keyboard) · (ខ) អូសឡើង/ចុះលើកាត ➜ navbar និងប្រអប់ស្វែងរក
   នៅនឹងកន្លែង · គ្មានលោត · (គ) បញ្ជីវែង (> ៥ ជួរ) ➜ រមូរក្នុងកាតដល់ជួរចុងក្រោយ · (ឃ) បញ្ជីស្នើលេខវែង ➜ រមូរបាន · (ង) ប្រអប់ស្វែងរកទំព័រស្កេន ➜ ដូចគ្នា ·
   (ច) បិទ keyboard ➜ ទម្រង់ដើម។ នៅខុស ➜ ថតវីដេអូម្តងទៀត។
3. iPhone ៖ ទាញចុះដើម្បីផ្ទុកឡើងវិញ ➜ ញ័រម្ដងពេលទាញគ្រប់ (iOS 17.4 ឡើង · ការកំណត់ System Haptics បើក)។ មិនញ័រ ➜ ប្រាប់កំណែ iOS។
4. Android (APK · PWA) ៖ ស្វែងរក · PTR ដដែល (គួរតែមិនប្រែ)។
5. 🖨️ ស្លាក ៖ ស្កេនកញ្ចប់ ២–៣ ➜ ម៉ឺនុយ (...) ខាងលើ ➜ «🖨️ បោះពុម្ពស្លាក (ថ្ងៃនេះ)» ➜ ផ្ទាំងបើក (preview · ប្តូរប្លង់/កុងតាក់ ➜ preview ប្រែ · បិទ/បើកវិញ ➜ ជម្រើសនៅ) ➜ «🖨️ បោះពុម្ព» ➜
   print dialog បង្ហាញស្លាក (លេខធំ · Barcode · COD/DOD $ · ថ្ងៃ/ខែ · Locker) ➜ បោះពុម្ព ឬ Save as PDF · ប្លង់ «ម៉ាស៊ីនបោះពុម្ពស្លាក» ➜ មួយស្លាកមួយទំព័រ ·
   ស្កេនស្លាកដែលបោះពុម្ពដោយឧបករណ៍ស្កេន ➜ លេខត្រូវ · ម៉ឺនុយតាមជួរ ➜ តែអតិថិជននោះ · APK ➜ ផ្ទាំង printer Android។ ទំហំ/ប្លង់មិនសម ➜ ប្រាប់ទំហំក្រដាស/ម៉ាស៊ីនបោះពុម្ពដែលប្រើ។
6. 📋 បញ្ចូលច្រើន ៖ ទំព័រស្កេន ➜ «📋 បញ្ចូលច្រើន» ➜ ស្កេន ៣–៥ Barcode ដោយឧបករណ៍ (មួយជួរមួយ) ➜ ▶️ ចាប់ផ្តើម ➜ កញ្ចប់បញ្ចូលម្តងមួយៗ (Fast Mode ➜ ដោយខ្លួនឯង · ក្រៅ Fast Mode ➜
   ផ្ទាំងបញ្ជាក់ម្តងមួយ) ➜ សាររំលង Barcode មានរួច · ⏹️ បញ្ឈប់ · ប្តូររបៀបស្កេនពាក់កណ្តាល ➜ ឈប់ + សរុប។

### [2.50.64] — 2026-10-14 · 🧠 ការណែនាំឆ្លាតវៃក្នុង 🩺 ពិនិត្យសុខភាព · toast រស់និយាយតាមដំណាក់កាលការសរសេរ (Deep audit ជុំទី ៤)

**ZoeW** (`zoew-v326` ➜ `zoew-v327`)។ ⛔ **ZoeKeyGen មិនប្រែ**។ សំណើម្ចាស់គម្រោង ៖ «Deep Audit Project ទាំងមូល កែសម្រួលកំហុស បំពេញចន្លោះ ពង្រឹងសុវត្ថិភាព ការងារលេចធ្លាយ secret ដំណើរការរលូនគ្រប់ flow … real live toast និងបន្ថែមភាពឆ្លាតវៃ អោយដូច CLAUDE Ai»។ លទ្ធផលវាស់ និងចន្លោះដែលរកឃើញ ៖ ផ្នែក ២ «Deep audit ជុំទី ៤»។

#### អ្វីដែលអ្នកប្រើឃើញ

- **🩺 ពិនិត្យសុខភាពប្រព័ន្ធ ➜ 🧠 ការណែនាំ** (ប្រអប់ក្រោមបញ្ជី ៩ ជួរ) ៖ App អានលទ្ធផលទាំងអស់ រួចប្រាប់ **មូលហេតុចម្បង** និង **ជំហានត្រូវធ្វើមុន** (យ៉ាងច្រើន ៣ · ❌ មុន ⚠️) ជាភាសាធម្មតា — ឧ. ក្រៅបណ្ដាញ ➜ «ភ្ជាប់ WiFi ឬទិន្នន័យចល័តសិន» ហើយប្រាប់ថាជួរ Firebase/Supabase · នាឡិកា · Lookup · អាជ្ញាប័ណ្ណ **នឹងជាវិញដោយខ្លួនឯង** (មិនរាយជាជំហាន) · Server ដាច់ តែបណ្ដាញល្អ ➜ Config/Setup Link មុន · Cookie ZTO បដិសេធ ➜ sync-zto-cookie · Key ជិតផុត ➜ ទាក់ទងអ្នកលក់ · ការសរសេរ blocked ➜ ☰ ឧបករណ៍ ➜ «លុបការសរសេររង់ចាំ»។ ទាំងអស់ ✅ ➜ «ប្រព័ន្ធដំណើរការធម្មតា — មិនចាំបាច់ធ្វើអ្វីទេ»។ វាដេរីវេពីជួរដែលវាស់បានប៉ុណ្ណោះ (អានតែប៉ុណ្ណោះ · គ្មានបណ្ដាញ · គ្មានការសរសេរ) ហើយបាត់ជាមួយជួរពេលចាកចេញ។
- **Toast បណ្ដាញ · toast ចូលប្រព័ន្ធ និយាយតាមដំណាក់កាលពិត** ៖ ខណៈ App ផ្ទៀងផ្ទាត់ការសរសេររង់ចាំ (journal Firebase ពេលបើក App · replay Supabase ក្រោយក្រៅបណ្ដាញ) toast ប្រាប់ «🔄 … កំពុងផ្ទៀងផ្ទាត់ការសរសេររង់ចាំ...» ហើយ ✅ លេចម្តងពេលចប់ · ការសរសេរដែលផ្ទៀងផ្ទាត់មិនបាន (blocked) ➜ «⚠️ … មានការសរសេរមិនទាន់ផ្ទៀងផ្ទាត់ — សូមពិនិត្យទិន្នន័យ ឬលុបវាតាម ☰ ឧបករណ៍» · listener មិនទាន់ភ្ជាប់ ➜ «កំពុងទាញទិន្នន័យ»។ ពីមុន toast និយាយ «✅ ទិន្នន័យទាន់សម័យ» ខណៈរបាខាងលើប្រាប់ «កំពុងផ្ទៀងផ្ទាត់ការសរសេរ...» (ផ្ទុយគ្នា)។
- **ហាង Supabase** ៖ ពេល adapter ផ្ញើការសរសេរដែលសល់ឡើងវិញ (`recoveryState().recovering`) របាខាងលើប្រាប់ «កំពុងផ្ទៀងផ្ទាត់ការសរសេរ...» (ពណ៌លឿង) ដូច Firebase — ពីមុន «ភ្ជាប់ Server រួចរាល់» ខណៈ replay នៅដើរ។

#### អ្នកយាម

`ZoeW/tests/network-toast-phase.test.tsx` (ថ្មី ៥ ករណី ៖ Supabase recovering ➜ ដំណាក់កាល `recovering` · របា · toast មិន ✅ · ចប់ ➜ ✅ ម្តង / Firebase journal (mock `nativeWriteRecoveryState`) ➜ toast ចូលប្រព័ន្ធ / blocked ➜ ⚠️ បញ្ចប់ · មិនដែល ✅ / syncing / ក្រៅបណ្ដាញ និង listener ងាប់ឈ្នះ — ធ្លាក់ ៤/៥ លើដើមឈើមុនកែ) · `ZoeW/tests/health-advice.test.ts` (ថ្មី ៧ ករណី ៖ ទាំងអស់ ✅ · ក្រៅបណ្ដាញបង្ក្រាបជួរផលវិបាក · Server ដាច់ · ❌ មុន ⚠️ + ពិដាន ៣ + គ្មានស្ទួន · blocked · ទិន្នន័យខូច · logout លុប) · តេស្ត ZoeW ១,៤៦៥ · `typecheck` · `lint` · `purity` · `slot` · run-all STRICT។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy ZoeW (Netlify) · APK ចេញតាម workflow ធម្មតា។ Firebase rules · migration Supabase ៖ **គ្មាន**។
3. **Apps Script Lookup (ហាងដែលប្រើ Google Sheet)** ៖ script.google.com ➜ project `google-sheets-api` ➜ ជំនួស `Code.gs` ដោយឯកសារថ្មី (`CACHE_TTL_SECONDS = 60`) ➜ **Deploy ➜ New version** (`SCRIPT_VERSION` នៅ 1 ➜ 🩺 មិន ⚠️)។ មិន Deploy ➜ ឧបករណ៍ផ្សេងឃើញការនាំចូលក្រៅ ZoeW យឺត ≤ ៥ នាទីដូចមុន (មិនមែនកំហុស)។
2. សាកលើទូរស័ព្ទពិត ៖ ☰ ➜ 🩺 ➜ ប្រអប់ 🧠 លេចក្រោមបញ្ជី (បិទ WiFi ➜ ពិនិត្យម្តងទៀត ➜ ជំហានទី ១ = ភ្ជាប់បណ្ដាញ · ជួរ Server/Lookup រាយថា «នឹងជាវិញដោយខ្លួនឯង») · ហាង Supabase ៖ ស្កេនក្រៅបណ្ដាញ ➜ បើកបណ្ដាញ ➜ របា «កំពុងផ្ទៀងផ្ទាត់ការសរសេរ...» មួយភ្លែត ➜ «ភ្ជាប់ Server រួចរាល់» · toast ✅ ម្តង។

### [ZoeKeyGen 2.24.18] — 2026-10-14 · ZoeKeyGen ៖ ទម្រង់តាមលំដាប់ការងារ · របាស្ថានភាព · កាតវគ្គ · ចាកចេញស្វ័យប្រវត្តិ · CSP គ្មាន inline style

**ZoeKeyGen `2.24.18`** (`zoekeygen-v128` ➜ `zoekeygen-v129`)។ ZoeW `2.50.62` ដដែល។ សំណើម្ចាស់គម្រោង ៖ «រៀបចំ layout របស់ ZoeKeyGen ឡើងវិញអោយងាយស្រួលប្រើនិងត្រឹមត្រូវតាមលំដាប់ និងពង្រឹងសុវត្ថិភាពការពារការវាយប្រហារ»។

#### អ្វីដែលអ្នកប្រើឃើញ

- កាតរៀបតាមលំដាប់ការងារ ហើយមានលេខ ៖ ១ Signing Key ➜ ២ បង្កើត Key ➜ ៣ បញ្ជី Key ➜ ៤ ហាង Supabase ➜ ៥ Setup Link ➜ ៦ ដំណឹង (ពីមុន ៖ Link និងដំណឹងមុនហាង · បញ្ជី Key នៅបាតទំព័រ)។ របា Tab ទូរស័ព្ទ ៖ បង្កើត · បញ្ជី · ហាង · Link · ដំណឹង។ លើកុំព្យូទ័រ Setup Link ពេញទទឹង (ពីមុនកាតវែងម្ខាងទុកចន្លោះទទេ)។
- របាស្ថានភាពខាងលើគ្រប់ផ្ទាំង ៖ chip ចូលរួច · Signing Key · Supabase Admin (ពណ៌តាមស្ថានភាពពិត) + ប៊ូតុង «➡️ ជំហានបន្ទាប់» (ចូល ➜ Load Signing Key ➜ ✅ រួចរាល់) ដែលបើកប្រអប់ចូល ឬនាំទៅកាតនោះ។
- កាត «🔒 វគ្គ និងសុវត្ថិភាព» (ក្បែរ «បង្កើត Key») ៖ អ្នកប្រើ · ស្ថានភាព Signing Key / Supabase Admin ជាមួយពិដានទុកចោល · «🔒 ចាក់សោវគ្គឥឡូវ» (ដក Signing Key + Supabase Admin ចេញពីសតិភ្លាម) · «⚙️ Config · PIN · ក្រយៅដៃ»។
- **ចាកចេញដោយស្វ័យប្រវត្តិ** ក្រោយមិនប្រើ ៣០ នាទី (ចុច/វាយ = សកម្មភាព · នាឡិកាថយក្រោយ = ផុត) ៖ ចាក់សោវគ្គ រួចចាកចេញ (គ្មាន confirm · លើកលែងកំពុង Generate ឬ Keypair ថ្មីមិនទាន់ចម្លង) — ពីមុនសម័យ Admin (Revoke · Extend · កៅអី · ដំណឹង) នៅបើករហូតលើឧបករណ៍ដែលទុកចោល។
- សុវត្ថិភាព header ៖ `style-src` គ្មាន `'unsafe-inline'` (style attribute ៣៥ ក្នុង `index.html` ➜ class · `--modal-w` តាម class `modal-w-*` · QR ជា SVG រួចហើយ) · `X-XSS-Protection: 0` (filter ចាស់ដែលបង្ក XS-Leak)។

#### អ្នកយាម

`csp-enforced-test` ផ្នែក ៣ (ថ្មី ៖ ZoeKeyGen ក្រោម header ពិត ៖ ០ ការរំលោភ ពេល boot · ផ្ទាំង ៥ · ប្រអប់ PIN · QR · ទទឹង modal តាម class · probe ផ្ទុយ ៖ style ដែលចាក់ត្រូវបដិសេធ) · `keygen-session-security-test` (ថ្មី ១២ ករណី ៖ ពិដាន ១០–៦០ នាទី ≥ Signing Key · មិនចូល/កំពុង Generate/Keypair មិនចម្លង ➜ មិនចាកចេញ · សកម្មភាពពន្យារ · ដល់ពិដាន ➜ lock silent + logoutApp(true) · នាឡិកាថយក្រោយ · ខ្សែភ្ជាប់ boot · `logoutApp(true)` គ្មាន confirm · `lockKeygenSession` ៖ mutation ពិដាន ×១០០ ➜ ធ្លាក់ ២) · `dom-hygiene` (`kgNextBtn` ស្លាកថេរ) · `keygen-supabase-admin-test` (stub `refreshKgStatus`) · `layout-check` · `css-classes` · `fluid-type-focus`។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy ZoeKeyGen (Netlify base `ZoeKeyGen`) ➜ header CSP ថ្មីចូលជាធរមាន · គ្មាន rules ថ្មី។
2. សាកលើទូរស័ព្ទ + កុំព្យូទ័រ ៖ ចូល ➜ ស្ថានភាព «ជំហានបន្ទាប់» ➜ Load Signing Key ➜ chip បៃតង · «ចាក់សោវគ្គឥឡូវ» ➜ Signing Key ចេញ · ទុកចោល ៣០ នាទី ➜ ចាកចេញ · QR/ប្រអប់ទាំងអស់បង្ហាញធម្មតា (Console គ្មាន CSP violation)។

### [2.50.63] — 2026-10-14 · APK Android ចែកតាម repo Release public ដាច់ដោយឡែក (រៀបចំប្តូរ repo source ជា Private)

**ZoeW** (`zoew-v325` ➜ `zoew-v326`)។ ⛔ **ZoeKeyGen មិនប្រែ**។ សំណើម្ចាស់គម្រោង («តោះចាប់ផ្តើមប្តូរ» repo ទៅ Private · ក្រោយសំណួរ «បើគេទាញ source code ទៅដោះ Activation Key … ប្រើបានអត់?») ➜ ជំហានទី ២ នៃផែនការ ៖ Release ផ្លូវការរបស់ APK ចេញទៅ repo public ដែលមានតែ Release (`ZOE_RELEASES_REPO` = `mengsroy-h/Zoe-System-releases`) ព្រោះ Release ក្នុង repo Private ទាមទារ login ➜ `ApkUpdatePlugin.java` probe ➜ 404 ជានិច្ច ➜ ប៊ូតុង «📥 ទាញយក និងដំឡើង APK» លែងលេចលើគ្រប់ទូរស័ព្ទ (ឧបករណ៍លែង update ស្វ័យប្រវត្តិ)។

#### អ្វីដែលអ្នកប្រើឃើញ

- App Android probe និងទាញ APK ពី `https://github.com/mengsroy-h/Zoe-System-releases/releases/download/zoew-android-v<កំណែ>/ZoeW-<កំណែ>.apk` (`RELEASE_BASE`)។ ប៊ូតុង · របារីក · ការផ្ទៀង package/versionName · ផ្ទាំងដំឡើង ៖ ដូចដដែល។
- ⛔ កំណែ ≤ 2.50.62 probe repo source ➜ ក្រោយ repo source ជា Private ➜ 404 ➜ ប៊ូតុងមិនលេច ➜ ត្រូវ sideload ដោយដៃម្តង ➜ **ប្តូរ Private តែក្រោយទូរស័ព្ទទាំងអស់ដំឡើង 2.50.63 ឬក្រោយ** (ខណៈ repo source នៅ public ទូរស័ព្ទទាំងនោះឃើញ 2.50.63 តាម Release ក្នុង repo source ដូចដដែល)។

#### workflow `android-release.yml`

- env `ZOE_RELEASES_REPO` · step «ពិនិត្យ token របស់ repo Release» (main · `ZOE_RELEASES_TOKEN` គ្មាន ➜ `exit 1` មុន build · កត់ `mirrored`) · Release ពី `main` ➜ repo source (បណ្ណសារ · token ធម្មតា) **និង** repo Release (PAT fine-grained Contents R/W តែ repo នោះ) · step «ចម្លង Release ដែលមានរួច» (exists=true · mirrored=false ➜ `gh release download` + `create --repo` · មិន build) · APK សាក (branch ផ្សេង) ចេញតែក្នុង repo source។
- secret ទី ៥ `ZOE_RELEASES_TOKEN` ចូលបញ្ជី server-only របស់ `security-guard-test` (មិនដែលលេចក្នុង client/bundle)។

#### អ្នកយាម

`npm run android:check` 3ខ (RELEASE_BASE = `https://github.com/<ZOE_RELEASES_REPO>/releases/download/` អានពី workflow · repo ≠ repo source — mutation ៖ ចង្អុល `RELEASE_BASE` ត្រឡប់ទៅ repo source ➜ ១ FAIL; ការរៀបលំដាប់ apksigner/pin វាស់ទល់នឹង step «បង្កើត GitHub Release» ព្រោះ step ចម្លងនៅមុនវាហើយមិន build) · `repository-contract-test` (+៤ ករណីលើ script ពិត ៖ main ➜ `gh release create` ២ ដង · ទី ២ ដោយ `ZOE_RELEASES_TOKEN` + `--repo` · branch ផ្សេង ➜ ១ ដងគ្មាន `--repo` · main គ្មាន token ➜ ធ្លាក់ · step token/ចម្លងមានលក្ខខណ្ឌត្រឹមត្រូវ) · `ZoeW/tests/notify-apk-link.test.tsx` (URL Java = URL workflow តាម `ZOE_RELEASES_REPO` · repo ≠ source) · `version-bump-scope` (ថ្មី ៖ កូដ native Android `android/app/src/main/**` · `capacitor.config.ts` រាប់ជាកូដ ship របស់ ZoeW React — ជុំនេះកែតែ Java ➜ checker ចាស់អាន «គ្មានការកែពិត» ហើយបដិសេធការឡើងកំណែ ខណៈ Release ថ្មីត្រូវការកំណែថ្មី · probe ២ ទិស) · `run-all` STRICT។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **មុន merge** ៖ GitHub ➜ New repository `Zoe-System-releases` · **Public** · ធីក «Add a README file» (repo គ្មាន commit ➜ tag បង្កើតមិនបាន) ➜ Developer settings ➜ Fine-grained PAT ៖ Repository access = តែ repo នោះ · Contents = Read and write ➜ Settings ➜ Secrets ➜ `ZOE_RELEASES_TOKEN` ក្នុង `Zoe-System` (មើល `ZoeW/docs/ANDROID.md` «APK ពី GitHub Releases»)។ ⛔ គ្មាន secret ➜ workflow APK លើ `main` ធ្លាក់ (ដោយចេតនា)។
2. ក្រោយ merge ៖ workflow ចេញ Release 2.50.63 ទៅ repo ទាំងពីរ ➜ ទូរស័ព្ទ 2.50.62 ➜ 🔔 ➜ «📥» ➜ ដំឡើង ➜ App ថ្មី probe repo Release ➜ ផ្ទៀងលើទូរស័ព្ទពិត ៖ បើក 🔔 ➜ «📱 កំណែ App» មិនបង្ហាញប៊ូតុង (ទាន់សម័យ) · browser incognito ➜ `https://github.com/mengsroy-h/Zoe-System-releases/releases` ឃើញ APK។
3. Private ៖ តាមផែនការ (ពិនិត្យ Insights ➜ Forks · រង់ចាំទូរស័ព្ទទាំងអស់ដល់ 2.50.63+ តាម Sentry tag `release` · Make private · ផ្ទៀង Audit/Netlify/Supabase/Claude · quota Actions — `docs/SELF-HOSTED-RUNNERS.md` ជំហាន ១៣–១៤)។
4. Firebase rules · migration Supabase ៖ គ្មាន។

### [2.50.62] — 2026-10-14 · ប្រាក់ Sync ត្រឹមត្រូវ ទោះបិទ App ពេលក្រៅបណ្តាញ (ledger replay មិនបញ្ចប់ពាក់កណ្តាលប្រតិបត្តិការ)

**ZoeW** (`zoew-v324` ➜ `zoew-v325`)។ ZoeKeyGen រក្សាកំណែដដែល។ Deep audit ជុំទី ៣ តាមសំណើម្ចាស់គម្រោង («លែងមានកំហុសក្នុងការ sync/write ចូល backend និងគ្មានការដក/បូកស្ទួន … តេស្តអោយបានច្រើនដង») ➜ checker ថ្មី `emu/money-multidevice-emu-test` (ឧបករណ៍ ២ ពិត · SDK ពិត · rules ពិត · offline · reload) រកឃើញថា journal របស់ [2.50.59] replay delta ledger **ដោយឯករាជ្យ** ពីការសរសេរទិន្នន័យដែលជាដៃគូ ➜ កែតម្លៃ ឬស្កេនក្រៅបណ្តាញ រួច reload (PTR · បិទ App) ➜ ledger ប្រែ តែតម្លៃកញ្ចប់មិនប្រែ (ឬផ្ទុយ)។

#### អ្វីដែលអ្នកប្រើឃើញ

- កែតម្លៃកញ្ចប់ ឬស្កេន ខណៈក្រៅបណ្តាញ ហើយបើក App វិញមុនបណ្តាញមក ➜ ស្ថិតិប្រាក់ប្រែ**តែ**ពេលតម្លៃកញ្ចប់ប្រែពិតលើ Server (ទាំង Firebase និង Supabase) · បើស្ថិតិប្រែរួចខណៈកញ្ចប់នៅតម្លៃចាស់ ➜ កែត្រឡប់វិញម្តងដោយស្វ័យប្រវត្តិ · អានពី Server មិនបាន ➜ រង់ចាំបណ្តាញ (មិនទាយ · មិន blocked)។
- ការដក · ការសម្អាត · ការកែស្ថិតិដោយដៃ ៖ ដូចដើម (delta របស់វាតាមក្រោយការសរសេរទិន្នន័យដែលចុះរួច)។

#### អ្នកយាម

`emu/money-multidevice-emu-test` (ថ្មី ៖ ៣/៣ លំដាប់ធ្លាក់លើដើមឈើមុនកែ ➜ ៤/៤ ជាប់) · `ZoeW/tests/ledger-replay-companion.test.ts` (ថ្មី · ៩ · Firebase recovery · លំដាប់ companion ក្រោយ update) · `ZoeW/tests/supabase-ledger-replay-companion.test.ts` (ថ្មី · ៤ · adapter ៖ ៣/៤ ធ្លាក់មុនកែ) · `vitest` ពេញ · `run-all` STRICT។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. គ្មាន Firebase rules ថ្មី · គ្មាន migration Supabase ថ្មី · គ្មាន env ថ្មី (ការកែទាំងអស់នៅក្នុង App)។ Merge ➜ Netlify deploy ➜ App ទាញកំណែថ្មី។
2. ⛔ សាកលើឧបករណ៍ពិត ៖ បិទ Wi‑Fi/data ➜ កែតម្លៃកញ្ចប់មួយ ➜ ទាញ PTR (ឬបិទ App) មុនបើកបណ្តាញ ➜ បើកបណ្តាញ ➜ ពិនិត្យថា «ចំណូល (យករួច)» និងតម្លៃកញ្ចប់ស៊ីគ្នា (ទាំងហាង Firebase និង Supabase)។

### [2.50.61] — 2026-10-13 · ផ្លូវចេញសម្រាប់ការសរសេររង់ចាំដែលផ្ទៀងផ្ទាត់មិនបាន (PIN)

**ZoeW** (`zoew-v323` ➜ `zoew-v324`)។ ZoeKeyGen រក្សាកំណែដដែល។ បន្តពី [2.50.60] តាមសំណើម្ចាស់គម្រោង «កែឲ្យស្អាតទាំងអស់» ៖ row ដែលសម្រេចមិនបានជារៀងរហូត (intent ប្រាក់ដែល ring ប្តូរអស់ · ផុតបង្អួច ២ ថ្ងៃ · receipt hash ខុស) លែងរារាំងឧបករណ៍រហូតដល់សម្អាត site data ទៀត។

#### អ្វីដែលអ្នកប្រើឃើញ

- ☰ ឧបករណ៍ ➜ **«🧹 លុបការសរសេររង់ចាំ»** លេចតែពេលស្ថានភាពជា «មានការសរសេរមិនទាន់ផ្ទៀងផ្ទាត់» (blocked) · ក្រោម PIN · មាន confirm ប្រាប់ថាការសរសេរទាំងនោះមិនត្រូវអនុវត្តឡើងវិញ និងឲ្យផ្ទៀងផ្ទាត់កញ្ចប់/ចំណូលដោយដៃ។
- លុប ➜ journal row ទាំងអស់នៃ backend/គណនី/ហាងបច្ចុប្បន្នត្រូវដក (Supabase ៖ តែគណនី + ហាងនេះ · ការសរសេរកំពុងដើរមិនប៉ះ) · Sentry money កត់ផ្លូវដែលលុប · recovery រត់ឡើងវិញ ➜ ការសរសេរថ្មីដំណើរការ។ 🩺 និងបន្ទាត់ស្ថានភាពប្រាប់ផ្លូវនេះ។

#### អ្នកយាម

`ZoeW/tests/discard-pending-writes.test.tsx` (Firebase blocked ➜ លុប ➜ Sentry money ➜ សរសេរបាន · confirm បដិសេធ ➜ នៅ blocked · Supabase ដកតែហាងនេះ · ប៊ូតុងលេចតែពេល blocked + PIN key) · `pin-prompt-test` (key `discardPendingWrites`) · `doc-scope-test` (ស្លាករបា Slide)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. ដូច [2.50.60] ៖ Publish Firebase rules · migration Supabase · សាកឧបករណ៍ពិត។ បន្ថែម ៖ ធ្វើឲ្យឧបករណ៍ blocked (ឧ. ប្តូរ hash របស់ journal row ក្នុង localStorage) ➜ ☰ ឧបករណ៍ ➜ លុប ➜ សរសេរបាន។
2. ពេលឃើញ Sentry «Pending writes discarded by the owner» ➜ ផ្ទៀងផ្ទាត់ចំណូលថ្ងៃនោះជាមួយ `check-money.cmd`។

### [2.50.60] — 2026-10-13 · Deep audit PR #313 ឡើងវិញ ៖ ការសរសេររង់ចាំមិនរារាំង App ទាំងមូល

**ZoeW** (`zoew-v322` ➜ `zoew-v323`)។ ZoeKeyGen រក្សាកំណែដដែល។ ជុំនេះវាស់ PR #313 ដោយ probe ពិត (មិនទុកចិត្ត checker បៃតង) ➜ រកឃើញ ៨ ចន្លោះដែល checker ទាំង ២០៤ មិនបានឃើញ ហើយកែទាំងអស់ជាមួយអ្នកយាមថ្មី ១៥ ករណី (មុនកែ ១២ FAIL · ៣ control PASS)។

#### អ្វីដែលអ្នកប្រើឃើញ

- **Firebase ៖ transaction ធម្មតា (កញ្ចប់ · registry · ស្ថិតិ) ដែលបាត់ពាក់កណ្តាលផ្លូវ** (បិទ App · ឧបករណ៍សម្លាប់ App · reload ខណៈការសរសេរនៅក្រៅបណ្តាញ) **មិនរារាំងការសរសេរទាំងអស់របស់ឧបករណ៍ទៀតទេ**។ ពីមុន journal row បែបនេះធ្វើឲ្យ App បង្ហាញ «មានការសរសេរមិនទាន់ផ្ទៀងផ្ទាត់» ហើយបដិសេធការស្កេន · បិទ · Locker · អត្រាប្រាក់ គ្រប់យ៉ាងរហូត (🩺 ពិនិត្យម្តងទៀតក៏ដដែល)។ ឥឡូវ row ធម្មតាសម្រេចតាមតម្លៃ Server ៖ ស្មើតម្លៃដែលផ្ញើ = បានអនុវត្ត · ផ្សេង = មិនបានអនុវត្ត (ដូចមុនមាន journal)។ តែ intent ប្រាក់ (ledger) ដែលសាក្សីសម្រេចមិនបាន ទើបនៅរង់ចាំ 🩺 (ដូច PR #313)។
- **ក្រៅបណ្តាញ ឬ Server មិនឆ្លើយពេលបើក App ដែលមាន journal row** ➜ App រង់ចាំបណ្តាញ (ការសរសេររង់ចាំ · ស្ថានភាព «កំពុងផ្ទៀងផ្ទាត់ការសរសេរ...») ហើយសាកអានឡើងវិញរៀងរាល់ ២ វិ. ពេល online ⛔ មិនចាត់ទុកជា «រារាំង» ទៀត។
- **ហាង Firebase ដែល rules មិនទាន់ Publish** ➜ ការសរសេរនៅដើរតាមផ្លូវ SDK ធម្មតា (គ្មាន receipt) ជំនួសឲ្យ «permission_denied» គ្រប់ការសរសេរ; receipt ដែល rules មិនឲ្យអាន ➜ row ត្រូវទម្លាក់ មិនរារាំង។
- **ហាង Supabase ៖ ការសរសេរដែលនៅសល់ពីការចាកចេញ** (ចេញពេល request កំពុងដើរ) ត្រូវផ្ញើឡើងវិញដោយ `op_id` ដើមពេលគណនីដដែលចូលហាងដដែលវិញ (ក្នុងបង្អួច ២ ថ្ងៃ) ⛔ ពីមុន row «cancelled» រារាំងការសរសេរទាំងអស់នៃសម័យបន្ទាប់ជារៀងរហូត។ ការសរសេរដែលត្រូវបដិសេធពេល recovery រារាំង មិនទុក row «queued» ឲ្យ replay ក្រោយ (phantom write)។
- **Listener ដែលចុះមុនហាងស្គាល់** (session ស្តារក្រៅបណ្តាញ · account មកយឺត) បន្តទទួលទិន្នន័យក្រោយហាងមក ⛔ ពីមុនវាស្ងាត់ជារៀងរហូត (view stale រហូតដល់ reload)។ ការប្តូរពីហាង A ទៅ B នៅតែបញ្ចប់ listener ចាស់។
- **ទាញកំណែ App និងសេចក្តីជូនដំណឹងអ្នកលក់** (`announcements.json` · seller notices) មិនត្រូវបោះបង់ពេលការចូលប្រព័ន្ធស្តារពេលបើក App ទៀត ➜ 🔔 មិនបង្ហាញ ⚠️ ខុសរាល់ការបើក។
- **Browser ដែល localStorage បិទ** (private mode) ➜ ការសរសេរដើរដោយគ្មាន journal (fail-open ដូច journal សម្អាត) ⛔ ពីមុនបដិសេធការសរសេរទាំងអស់។ row journal ខូចមួយ មិនធ្វើឲ្យ scope ទាំងមូលខូច។
- **Firebase receipts (`zoew_write_receipts`) មិនកើនរហូតទៀត** ៖ rules ឲ្យឧបករណ៍លុបតែ receipt ខ្លួនឯងដែលចាស់ជាង ២ ថ្ងៃ ហើយ App សម្អាតវាដោយស្វ័យប្រវត្តិម្តងក្នុងមួយសម័យក្រោយ recovery ស្អាត (≤ 500 ក្នុងមួយដង)។ Journal row ចាស់ជាង ២ ថ្ងៃ មិន replay ទេ (receipt អាចត្រូវសម្អាតរួច) ➜ រង់ចាំ 🩺 ដូច Supabase។
- ការសរសេរដែលត្រូវបដិសេធមុនផ្ញើ (session ប្តូរ · ផុតកំណត់ · កំពុង init) ផ្តល់ verdict `not-applied` ជាក់លាក់ ⛔ មិនមែន `unknown` (Sentry money ក្លែងក្លាយ · ledger «មិនដែល ok») ទៀត។

#### អ្នកយាម

`ZoeW/tests/native-recovery-plain-cas.test.ts` (row ធម្មតា · deferred · rules refuse · storage បិទ · control intent ប្រាក់) · `ZoeW/tests/native-receipt-retention.test.ts` (rules = ថេរ · purge · row ផុតបង្អួច) · `ZoeW/tests/supabase-journal-recovery.test.ts` (row ក្រោយ sign-out · phantom · row ខូច) · `ZoeW/tests/connection-scope-discovery.test.ts` (listener មុនហាងស្គាល់ + control · lease · fetch scope page · verdict not-applied) · `emu/supabase-rules-parity-test` (probe rules receipt ៖ RTDB = Postgres និង verdict រំពឹង ៩ ជំហាន)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **Publish Firebase Business rules ថ្មី (កំណែនេះ · ជំនួស rules របស់ 2.50.59 ដែលមិនទាន់ Publish) ទៅគ្រប់ project អតិថិជនមុន merge** (`firebase-database.rules.json` ឬ `tools/firebase-provision/deploy-rules.cmd`) ៖ `zoew_write_receipts/$operation` ឥឡូវឲ្យលុប receipt ខ្លួនឯងដែលចាស់ជាង ២ ថ្ងៃ។ ហាងដែល rules យឺត នៅសរសេរបានតាមផ្លូវធម្មតា (គ្មាន receipt) ទើបមិនដាច់ទៀត។
2. Supabase migration ថ្មី `20261013093425_zoe_rules.sql` (បន្ថែមលើ `20261013004220_zoe_rules.sql` និង `20261013004512_receipt_auth_uid.sql` របស់ PR #313) អនុវត្តតាម GitHub integration ក្រោយ merge ឬបិទភ្ជាប់ក្នុង SQL Editor។
3. Deploy ZoeW និង build APK ថ្មី។ សាកពិត ៖ ស្កេនខណៈបណ្តាញយឺត ➜ សម្លាប់ App មុនការសរសេរចប់ ➜ បើកវិញ ➜ ត្រូវស្កេនបន្តបាន (មិនឃើញ «មានការសរសេរមិនទាន់ផ្ទៀងផ្ទាត់»); បើក App ក្រៅបណ្តាញដែលមានការសរសេររង់ចាំ ➜ ចូលបណ្តាញ ➜ ការសរសេរចប់ដោយខ្លួនឯង; Supabase ៖ ចាកចេញពេលបណ្តាញគាំង ➜ ចូលវិញ ➜ សរសេរបាន។
4. **ការសម្រេចរបស់ម្ចាស់គម្រោង (មិនបានសាងសង់)** ៖ row ដែលសម្រេចមិនបានជារៀងរហូត (intent ប្រាក់ដែល ring ប្តូរអស់ · row ផុតបង្អួច ២ ថ្ងៃ · receipt hash ខុស) នៅរារាំងការសរសេរនៃឧបករណ៍រហូតដល់សម្អាត site data — ត្រូវការផ្លូវចេញ (ឧ. ប៊ូតុងក្រោម PIN «លុបការសរសេររង់ចាំ» ដែលកត់ Sentry money) ប្រសិនបើម្ចាស់គម្រោងចង់បាន។
5. គោលការណ៍ Delete មិនដកប្រាក់ · Remove/expired ដក · restore បូកតែ `isDeducted` ដដែល។ ZTO · PTR · ចលនា · ZoeKeyGen មិនប៉ះ។

### [2.50.59] — 2026-10-13 · Connection flow ទាំង ៦ ចំណុចតាមសំណើម្ចាស់គម្រោង

**ZoeW** (`zoew-v321` ➜ `zoew-v322`)។ ZoeKeyGen រក្សាកំណែដដែល។

#### អ្វីដែលអ្នកប្រើឃើញ

- App បែងចែកការចាប់ផ្តើម ចូលប្រព័ន្ធ ទាញទិន្នន័យ ក្រៅបណ្តាញ ស្ដារ និងការសរសេរដែលមិនទាន់ផ្ទៀងផ្ទាត់។ ភ្ជាប់ transport រួច តែ views ឬ recovery នៅរង់ចាំ ➜ មិនរាយ ready។
- SDK facade និង network requests ចង backend/user/tenant/session; callback/read ចាស់មិនជាន់សម័យថ្មី។ Registry ដោះ subscription និង callback ជាមួយម្ចាស់របស់វា; reconnect lifecycle មាន cleanup និងមិនចុះ window listener ស្ទួន។
- Pending writes មាន journal តាម backend/user/ហាង។ Firebase set/update បញ្ចូល data និង immutable receipt ក្នុង atomic update ដដែល; replay ផ្ទៀងផ្ទាត់ receipt មុន ហើយ increment មិនអនុវត្តស្ទួន។ Supabase រក្សា op_id ដើម និងចង replay window តាមម៉ោង Server។
- Native transaction recovery ប្រើ Web Locks ដើម្បីកុំ replay operation ដែល tab ផ្សេងនៅកាន់។ Ledger intent មាន requested delta និង event identity ដើម; តែអនុវត្តពេល witness បញ្ជាក់សុវត្ថិភាព។ Platform គ្មាន Web Locks មិនសាក transaction ដែលមិនទាន់មាន verdict ដោយការស្មាន។
- SDK retry របស់ ledger មិនគណនាប្រាក់ម្តងទៀតពេល op token របស់ខ្លួនមានរួច។ លទ្ធផលមិនច្បាស់ ➜ ផ្អាកការសរសេរថ្មី និងអាចផ្ទៀងផ្ទាត់តាម 🩺 ពិនិត្យប្រព័ន្ធ។

#### អ្នកយាម

`ZoeW/tests/connection-flow-contract.test.ts` · `ZoeW/tests/connection-request-owner.test.ts` · `ZoeW/tests/durable-connection-write.test.ts` · `ZoeW/tests/native-durable-write.test.ts` · `ZoeW/tests/ledger-native-retry-identity.test.ts`។ `emu/app-network-e2e-test` វាស់ SDK ពិត + reload + receipt replay និង `emu/supabase-rules-parity-test` វាស់ auth.uid ជាមួយ RTDB/Postgres។ លទ្ធផលចុងក្រោយនៅផ្នែក ២។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. **Publish Firebase Business rules ថ្មីមុនប្រើ App កំណែនេះ** (`firebase-database.rules.json` ឬ tools/firebase-provision/deploy-rules.cmd) ដើម្បីអនុញ្ញាត `zoew_write_receipts` ជាមួយការសរសេរទិន្នន័យ។ គ្មានការប្តូរ License rules។
2. Supabase migrations `20261013004220_zoe_rules.sql` និង `20261013004512_receipt_auth_uid.sql` អនុវត្តតាម GitHub integration ក្រោយ merge; ផ្ទៀងផ្ទាត់ការចូលរបស់វាមុន deploy។
3. Deploy ZoeW និង build APK ថ្មី។ សាក iPhone PWA, Android PWA និង APK៖ offline write ➜ បិទ/បើក ➜ reconnect; logout/login និងប្តូរហាងពេល request យឺត; App ពីរ tabs និងឧបករណ៍ពីរ។ កុំសម្អាត site data ពេលមាន pending writes; Firebase receipts មិនត្រូវលុបជាការសម្អាតធម្មតា។
4. គោលការណ៍ Delete មិនដកប្រាក់, Remove/expired ដក និង restore បូកតែ isDeducted ដដែល។ Supabase Leaked Password Protection ជាការសម្រេចរបស់ម្ចាស់គម្រោងដូចមុន។

### [2.50.58] — 2026-10-12 · Audit ផ្តោត race, login/security និង Firebase/Supabase listener

**ZoeW `2.50.58`** (`zoew-v320` ➜ `zoew-v321`)។ ZoeKeyGen មិនប្រែ។ គ្មាន migration/env/rules ថ្មី; គោលការណ៍ Delete/Remove និង COD/DOD ដដែល។

- Login ពិនិត្យ ready និងភាពស្របគ្នារវាង Config, auth.app.options និង stored Config មុនផ្ញើ credentials; ចាប់ auth/SDK/backend scope មុន persistence; មិនផ្ញើ credentials A ទៅ auth B ក្រោយ Config ប្តូរ។ Completion/error/finally ចាស់មិនជាន់ email/password field ឬ busy state របស់ login ថ្មី។
- Auth listener ចង owner និង currentUser; callback queued ចាស់ក្រោយ unsubscribe/replacement ឬ snapshot user A ខណៈ auth មាន B មិនប្តូរ auth generation និងមិនបន្ត activation។ Auth storage recovery ពិនិត្យ owner និង timeout token ក្រោយ IndexedDB enumeration មុន delete/reload; auth ready កណ្តាល enumeration ធ្វើឱ្យ recovery ចាស់ឈប់។
- Logout និង session expiry មិនសម្អាត remembered session/សោ/UI របស់សម័យថ្មី បើ response ចាស់មកយឺត ទោះ success ឬ failure។
- Logout/session expiry invalidate generation ភ្លាម; completion ចាស់ និង periodic expiry ចាស់មិនលុប login ថ្មី ទោះ UID និង user object ដដែល។
- Supabase SDK៖ response auth ចាស់ត្រូវបដិសេធមុន SDK សរសេរ session ឬជូនដំណឹង listener; login A ដែលមកក្រោយ logout/login B មិនស្តារ A ទៀត។ ការស្តារពី cache មិន invalidate refresh ដែលកំពុងរង់ចាំលើ session ដដែល។ `supabase-auth-write-ownership.test.ts` ប្រើ supabase-js ពិត។
- Firebase SDK៖ auth facade រៀប signin តាមលំដាប់ក្នុង auth ដដែល និង invalidate ភ្លាមពេល logout/សំណើ login ថ្មី។ `beforeAuthStateChanged` រារាំង signin ចាស់មុនរក្សា user/session និង listener; guard ត្រូវដោះក្នុង finally។ `firebase-auth-write-ownership.test.ts` ប្រើ Firebase Auth `12.19.0` ពិត។
- អត្រាប្រាក់៖ write owner token ដោះតែ mutex របស់ខ្លួន; late ACK/reject ពី App Supabase ដែលបិទ មិនដោះ mutex របស់ backend ថ្មី។ ការដោះ mutex ក្រោយ logout លើ backend ដដែលនៅដដែល ដើម្បីកុំឱ្យ write ដែលនៅរស់ជាន់សម័យថ្មី។ `exchange-rate-completion-race.test.ts` រត់ feature + adapter ពិត។
- Remembered password៖ crypto និង IndexedDB open ចាស់មិន overwrite/delete record ថ្មី។ Save/forget ពិនិត្យ generation ក្នុង transaction action; មិនហៅ global forget ពី stale save។ AES-GCM និង backend/account binding ដដែល។
- Supabase Realtime៖ token/setAuth បញ្ចប់ក្រោយ close មិនបង្កើត channel; queued broadcast/status និង token failure ក្រោយ unsubscribe/session change មិនបន្ត callbacks។ Channel teardown promise rejection ត្រូវបានសម្អាត។
- Tenant ប្ដូរលើ UID/db ដដែល៖ SDK ផ្តល់ tenant មុន/ក្រោយឱ្យ App; App invalidate auth generation, សម្អាត business/sensitive views និងភ្ជាប់ listeners ទៅសម័យថ្មី។ `tenant-app-session.test.ts` វាស់ App handler ពិត និង SDK seam ពិត; guard របស់ flow ចាស់ផុតសុពលភាព។
- Supabase sync ចង pull និង offline write/CAS retry ជាមួយ tenant និង auth scope; ប្ដូរហាង invalidate snapshot/cursor/cache ហើយទាញ view ថ្មី។ A acknowledgement ដែល server ទទួលរួចនៅជា success ប៉ុន្តែមិនបញ្ចូល docs A ក្នុង B; conflict ចាស់មិន retry ទៅ B។ `supabase-sync-owner.test.ts` វាស់ទាំងផ្លូវនេះ។
- Regression ប្រើ source ពិត៖ `auth-flow-race.test.ts` · `password-save-race.test.ts` · `session-expiry-race.test.ts` · `supabase-realtime-race.test.ts` និងតេស្តថ្មីទាំង ៩ ឯកសារនៅក្នុង index ខាងក្រោម; រត់ដូចគ្នាលើ main `4649331` និង source ក្រោយកែ។ លទ្ធផលវាស់ និង STRICT កត់ក្នុងផ្នែក ២។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ក្រោយ deploy សាក iPhone/Android៖ login/logout និងប្តូរ Config ពេលបណ្តាញយឺត ឬដាច់; ចងចាំ password និងបើក App វិញ។ មិនត្រូវការ data migration ឬ Publish rules ថ្មី។
២. Supabase Leaked Password Protection និង access JWT ដែលនៅ valid ក្រោយ session revoke ជាព្រំដែនដដែលដែលផ្នែក ១មុនបានកត់; audit នេះមិនផ្លាស់ប្តូរការកំណត់ផលិតកម្ម។
៣. លទ្ធផលវាស់បញ្ជាក់សេណារីយ៉ូដែលបានរត់; មិនធានាថាគ្រប់ interleaving ឬ outage ផលិតកម្មមិនអាចមានកំហុសឡើយ។

### [2.50.57] — 2026-10-12 · PR #312៖ បញ្ចប់ការកែ race និង barcode ពី Deep audit ឡើងវិញ

**ZoeW `2.50.57`** (`zoew-v319` ➜ `zoew-v320`)។ **ZoeKeyGen `2.24.17` មិនប្រែ**។ គ្មាន migration/env/rules ថ្មី។ គោលការណ៍ Delete/Remove និងការបូកដក COD/DOD ដដែល។

#### អ្វីដែលខុសពីមុន · អ្នកយាម

- Supabase `get()` ពិនិត្យសម័យ គណនី និង tenant មុនបញ្ចូល response; សំណើហាង A ដែលឆ្លើយក្រោយចាកចេញ មិនជាន់ cache/listener ហាង B។
- បិទ Supabase App ដក auth subscription ទាំងពីរ និង dispose BroadcastChannel/visibility listener របស់ SDK; បញ្ឈប់ការសរសេរ storage របស់ transport ចាស់។ Window listeners ដែល SDK បង្កើតក្នុង constructor ចង owner ហើយដកពេល close; initialize យឺតចប់ក្រោយ close ត្រូវ dispose ម្ដងទៀត។ Account verification/restore/logout ដែលនៅរង់ចាំ មិនលុបការចូលប្រព័ន្ធថ្មី។
- Excel → Sheet៖ ការបើកប្រអប់ពិនិត្យសម័យ/ហាង/សោនៅរាល់ await; decrypt ចាស់មិនដាក់ URL/ពាក្យសម្ងាត់ និងមិនផ្ញើ status របស់ហាងចាស់។
- Registry/pickup៖ escape `%` ដើម្បីឱ្យ `AB.C` និង `AB%2EC` មាន key ដាច់ពីគ្នា; barcode គ្មាន `%` រក្សា key ចាស់ដដែល។ ឧបករណ៍ registry-orphan មិន encode key ក្នុង dump ពីរដង និងការពារ key legacy ដែលមានម្ចាស់។
- CLI audit៖ `money-core.js` ផលិតឡើងវិញពី encoder ថ្មី; `money-reality-check.js` និង `redact-dump.js` រក្សាទំនាក់ទំនង barcode encoded និង numeric identities។ Numeric phone/barcode/id/secret មិននៅ plaintext ក្នុង dump ដែលសម្អាត។
- `audit-lifecycle.test.ts` · `barcode-key-encoding.test.ts` · `audit-checker-outcomes.test.ts` វាស់ function ពិត + WebCrypto/supabase-js/child timeout ពិត។ Money guardian លែងរាប់ការផ្ដាច់/timeout ជា mutation detection; backup checker កំណត់ child umask ដើម្បីកុំឱ្យ mode 0600 mutation បៃតងតាមម៉ាស៊ីន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ទិន្នន័យពិតមានតែ barcode ធម្មតាគ្មាន `%` (ម្ចាស់គម្រោងបញ្ជាក់ក្នុងជុំនេះ)៖ **គ្មានការផ្លាស់ទីទិន្នន័យ**។ បើនាំចូល backup ចាស់ពីប្រភពផ្សេងដែលមាន `%` ត្រូវពិនិត្យ registry/pickup/collected/origins មុនប្រើ; កុំប្ដូរ key ឬ totals ដោយស្វ័យប្រវត្តិ។
២. ក្រោយ deploy សាក iPhone Safari/PWA និង Android PWA/APK ពិត៖ ប្តូរហាងខណៈបណ្តាញយឺត · ចាកចេញ/ចូលវិញ · បិទ/បើក Excel → Sheet · រមូរបញ្ជីវែង។ Headless Chromium មិនជំនួស hardware ពិតទេ។
៣. Supabase Leaked Password Protection នៅ disabled; ត្រូវពិនិត្យ Settings/គម្រោងថ្លៃដោយម្ចាស់គម្រោង។ Session revoke ទុក access JWT ដែលមិនទាន់ផុតប្រើបានតាមព្រំដែនដែល README ទទួលស្គាល់; មិនប្តូរគោលការណ៍នេះក្នុងជុំនេះ។ មិនទាន់ merge។
៤. បើធ្លាប់សម្អាត dump ដោយកំណែចាស់ ត្រូវសម្អាតពី dump ដើមឡើងវិញមុនផ្ញើ និងពិនិត្យឯកសារចាស់ដែលបានផ្ញើ សម្រាប់ phone/barcode/secret ដែលជា JSON number។ ឧបករណ៍ថ្មីត្រូវមាន `money-core.js` ក្នុងថតដូចគ្នា។

### [2.50.56 / ZoeKeyGen 2.24.17] — 2026-10-12 · Deep audit ទាំង Project និង Link Lookup ចងហាង Supabase

**សំណើម្ចាស់គម្រោង**៖ deep audit function · ភាពរលូន · network · Supabase/Firebase · SW · race · listener · security ដោយមិនទុកចិត្ត checker បៃតង និងបន្ថែមការចង API តាម ZoeKeyGen សម្រាប់ហាង Supabase។

**ZoeW `2.50.56`** (`zoew-v318` ➜ `zoew-v319`) · **ZoeKeyGen `2.24.17`** (`zoekeygen-v127` ➜ `zoekeygen-v128`)។ គ្មាន migration/env/rules ថ្មី និងមិនប្តូរគោលការណ៍លុយ។

#### អ្វីដែលខុសពីមុន

- ZoeKeyGen៖ 🏪 ហាង ➜ 🔗 API ស្វែងរក បំពេញ Config Supabase និងជ្រើសហាងក្នុងផ្ទាំង Link។ target `shop` = Project + tenant UUID ចូល AES-GCM AAD។ ZoeW រក្សា target មុន Login; គណនីហាងផ្សេងមិនយក API នោះទៅប្រើ។ កែ/ដក tenant ឬប្តូរ Project មិនទទួល។ Link ចាស់ដែលគ្មាន target នៅតែអានបាន។ Supabase Admin ចាកចេញកណ្តាល encrypt ➜ គ្មាន Link/QR/កូដលេចយឺត។
- Lookup៖ encrypt/migrate ពន្យារ ក្រោយប្តូរហាង/គណនី/សោ PIN មិនរក្សាទុកលទ្ធផលចាស់។ Save ថ្មីឈ្នះ Save ចាស់។ Test API មិនផ្ញើ Header របស់ហាងចាស់ក្រោយ decrypt យឺត ហើយមិនបង្ហាញលទ្ធផលចាស់ក្នុងសម័យថ្មី។
- Excel → Sheet៖ status/encrypt/import/clear យឺតក្រោយប្តូរហាង មិនចងការតភ្ជាប់ ឬ cache/UI ហាង A ទៅ B; owner ការពារ finally ចាស់មិនបញ្ចប់ការងារថ្មី។
- SW ទាំងពីរ៖ `caches.keys()`/`caches.delete()` បោះកំហុសពេល activate នៅតែហៅ `clients.claim()`; ការលុប cache ចាស់មិនទប់ activation។ filter cache របស់ App ដដែល។
- ប្រវត្តិ 320px៖ លេខរៀងវែង/ស្លាកអាចបត់ក្នុងក្រឡាខ្លួន មិនជាន់ក្រឡាអតិថិជន; ទទឹងជួរឈរមិនប្រែ។
- dependency៖ pin `source-map-js 1.2.2` និង `@grpc/grpc-js 1.13.6` តាម advisory ថ្មី; `npm audit` ពី 5 high ទៅ 0 vulnerability។ Firebase SDK version ដដែល។

**ការបន្តតាមសំណើម្ចាស់គម្រោង «CLI មាន ៣ high ពី braces … កែអោយត្រឹមត្រូវបានអត់»**៖ Firebase Provision **1.0.1** ប្រើ `braces` local backport `3.0.3-zoe.1`។ CLI/chokidar version ដដែល; parser ចង brace/paren depth 100 ហើយ walkers ពិនិត្យ AST ផ្ទាល់/child cycle មុន recursion។ upstream source និង MIT license រក្សា និងផ្ទៀង hash; glob behavior និង module ផ្ទុកពិតមានតេស្ត។ npm audit សម្រាប់ local dependency មិនមែនភស្តុតាងកូដ patched; ត្រូវឆ្លងករណី exploit/corpus/mutation ផង។

#### អ្នកយាម

- `ZoeW/tests/shop-bound-settings.test.ts`៖ ៧ ករណី race ថ្មីធ្លាក់មុនកែ; ក្រោយកែមានលទ្ធផលថ្មីឈ្នះ និងគ្មានការសរសេរ/ផ្ញើសោឆ្លងហាង។
- `ZoeW/tests/setup-lookup.test.tsx`៖ producer UI ពិត ➜ ciphertext ➜ receiver ពិត ➜ target scope; tamper/strip tenant · Project ខុស · Admin logout ក្នុង encrypt; legacy ទាំងពីរ backend នៅតែឆ្លង។
- `ZoeW/tests/sw-revalidation-timeout.test.ts`៖ activate Cache failure ៤ ករណីធ្លាក់មុនកែ; ក្រោយកែ claim ១ ដង។
- `layout-check`៖ ករណីលេខរៀងជាន់ក្រឡាធ្លាក់មុនកែ ➜ ក្រោយកែ 151/151។ `dependency-security-test` ចាក់សោ patch floor ក្នុង lockfile។
- កំណត់ត្រា audit និងព្រំដែនការសាក៖ ផ្នែក ២ «Deep audit ទាំង Project និង Supabase Lookup»។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. សាក deploy preview ZoeKeyGen៖ ចូល Supabase Admin ➜ ជ្រើសហាង ➜ 🔗 API ស្វែងរក ➜ បំពេញ URL/Header ➜ Link/QR + កូដ ៦ ខ្ទង់ដាច់ដោយឡែក។
២. សាក ZoeW៖ PIN ➜ បើក Link ➜ កូដ ➜ ចូលគណនីហាងគោលដៅ ➜ Lookup។ សាកគណនីហាងផ្សេង និង Link ចាស់ Firebase/Supabase ផង។
៣. សាក iPhone PWA + Android PWA + APK ពិត៖ search · keyboard · scrollbar · បញ្ជីវែង · modal · PTR · ប្តូរហាងពេលសំណើកំពុងរង់ចាំ។ មិនទាន់ merge។
៤. Supabase live advisor នៅរាយ Leaked Password Protection disabled; ត្រូវពិនិត្យ Settings និងគម្រោងថ្លៃមុនបើក។ Local Postgres transaction suite ជាប់ UID mapping របស់បរិស្ថាននេះ; ត្រូវរត់លើ runner ដែលអាចប្តូរទៅ OS user Postgres។ មិនរាប់ការខកខានជា PASS។

### [2.50.55] — 2026-10-12 · iPhone PWA ៖ scrollbar ពីរត្រួតគ្នា · ប្រវត្តិមិនដល់បាត · កាត់ការងារអំឡុងរមូរ

**សំណើម្ចាស់គម្រោង**៖ វីដេអូ `17952.mp4` បង្ហាញស្វែងរកលេខ ➜ បើកបញ្ជីកញ្ចប់ ➜ keyboard បាត់ ➜ របា Tab លាក់ ប៉ុន្តែប្រវត្តិនៅទុកចន្លោះនៅបាត។ ម្ចាស់បញ្ជាក់ថា scrollbar បន្ថែមដាក់ដោយចេតនាសម្រាប់ APK និង iOS PWA ព្រោះពីមុនមិនមាន; ឥឡូវ iOS បង្ហាញពីរ។ ការសង្ស័យថា Safari update មិនទាន់ផ្ទៀងផ្ទាត់លើឧបករណ៍ពិត។ ម្ចាស់ស្នើបន្ថែមឱ្យ App ទាំងមូលរលូនជាងមុន ព្រោះ APK និង PWA Android រលូនជាងពេលខ្លះ។

**ZoeW `2.50.55`** (`zoew-v317` ➜ `zoew-v318`)។ ZoeKeyGen ដដែល; គ្មាន migration/env/rules ថ្មី។

#### អ្វីដែលខុសពីមុន

- `@supports (-webkit-touch-callout: none)` រក្សា padding របស់របា Tab លើ `.app-pages` ដែលនៅស្ថានភាពស្វែងរក ទោះ `chrome-hidden`។ ច្បាប់ប្រគល់ចន្លោះវិញធ្លាប់គ្របតែ `history-expanded`។ ឥឡូវវាគ្រប `.app-pages` ទាំងអស់នៅផ្លូវ iOS ហើយទុក `--page-extension` និងគែម ៨px ដដែល។
- `drawsOwnScrollThumb()` ដំឡើងខ្សែបន្ថែមតែលើ APK Android។ iOS PWA ប្រើ scrollbar ប្រព័ន្ធ។ PTR របស់ iOS និងខ្សែ ៣px របស់ APK នៅដដែល។
- ការរមូរគ្រប់ផ្ទាំង/ប្រអប់ធ្លាប់ដាក់ rAF ដើម្បីកំណត់ទីតាំងបញ្ជីណែនាំលេខ ទោះបញ្ជីបិទ ហើយហៅ `commitNow()` ដោយបង្ខំ flush React គ្រប់ store មុនពិនិត្យថាមានបញ្ជី។ ឥឡូវបញ្ជីបិទ ➜ មិនដាក់ rAF និងមិន flush; បញ្ជីបើកនៅតែវាស់មួយដងក្នុងស៊ុម។ ផ្លូវរួមនេះជួយ iOS · Android · desktop ដោយមិនប្តូររយៈពេល/easing ចលនា។
- iOS មិនមាន watcher របស់ scrollbar បន្ថែមដែលអាន `getBoundingClientRect()` រាល់ស៊ុមពេលខ្សែលេច។
- ការកែតំបន់ហាមមានសំណើពិត និងកត់ក្នុងសោ `app.css` + `phone-search.ts`; `chrome-autohide` · ចលនាផ្ទាំង · snap · PTR មិនប្រែ។

#### អ្នកយាម

- `ZoeW/tests/ios-history-bottom.test.ts` វាស់ cascade CSS ពិតនៅស្ថានភាព search + chrome-hidden និង platform gate។ ករណីទាំងពីរធ្លាក់លើកូដមុនកែ។
- `phone-suggest-idle-scroll.test.ts` ធ្លាក់លើ source មុនកែ៖ បញ្ជីបិទនៅតែ flush និងដាក់ rAF។ ក្រោយកែ ៣០ scroll + resize ➜ ០ rAF; បញ្ជីបើក ➜ ១ rAF ដដែល។
- `audit-tools/panel-motion-test.js` បន្ថែមស្វែងរក ➜ បើក/បិទ modal ➜ របាលាក់ · safe-area ០/៣៤px ដោយវាស់គែមផ្ទាំងពិត។ `scroll-thumb.test.tsx` វាស់ការរមូរ iOS មិនដំឡើង overlay និងរក្សាតេស្តខ្សែពេញលើ APK។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⏳ សាក deploy preview លើ iPhone PWA ពិត៖ ធ្វើដូចវីដេអូ ចុចស្វែងរក ➜ បើកបញ្ជីកញ្ចប់ ➜ keyboard បិទ ➜ បិទ modal ➜ អូសបញ្ជីឱ្យរបា Tab លាក់។ គែមប្រវត្តិចុះដល់បាត ហើយមាន scrollbar តែមួយ។ សាកលេខទទេ និងលេខដែលវាយរួច; សាកបង្វិលអេក្រង់ និងត្រឡប់មក App វិញ។
២. ⏳ សាក APK Android ពិត៖ ខ្សែ ៣px លេចពេលរមូរ ហើយបាត់ក្រោយស្ងៀម; keyboard · របា Tab · អូសបើក/បិទផ្ទាំង · PTR ដំណើរការដូចមុន។ ត្រូវផ្ទៀងផ្ទាត់ឧបករណ៍ទាំងពីរមុន merge។
៣. ក្រោយ merge/deploy បើក ZoeW ឱ្យបាន `2.50.55`។

### [ZoeKeyGen 2.24.16] — 2026-10-11 · Setup Lookup ៖ ទទួល URL របស់ ZTO ដែលចាប់ផ្ដើម `/`

**ZoeKeyGen `2.24.16`** (`zoekeygen-v126` ➜ `zoekeygen-v127`)។ ZoeW `2.50.54` / `zoew-v317` ដដែល; កែតែកូដអ្នកបង្កើត Link និងតេស្ត។

#### អ្វីដែលខុសពីមុន

- ម្ចាស់រាយការណ៍ Setup Lookup របស់ ZTO បង្កើត Link មិនបាន និងផ្ដល់ `/.netlify/functions/zto-order-detail?barcode={barcode}`។ ផ្លូវនេះត្រឹមត្រូវតាមការកំណត់ ZoeW ប៉ុន្តែ producer ទាមទារ HTTPS ពេញ។ ឥឡូវ ផ្លូវចាប់ផ្ដើម `/` បំពេញ origin ពី Base URL របស់ ZoeW មុនចាក់សោ Header; មិនយក domain របស់ ZoeKeyGen ហើយមិនយក subpath/query/hash របស់ Base URL។ URL HTTPS ពេញរបស់ proxy ផ្សេងនៅដដែល។
- វាល URL បង្ហាញទម្រង់ ZTO និងពន្យល់ domain គោលដៅ។ Link មាន HTTPS ពេញ ដែល receiver ផ្ទៀងផ្ទាត់បានដោយ AAD ដដែល។ HTTP, protocol-relative (`//`), userinfo និង URL គ្មាន `{barcode}` នៅតែបដិសេធ។

#### អ្នកយាម

- `ZoeW/tests/setup-lookup.test.tsx` រត់ producer ពិត ➜ receiver ពិត៖ relative ZTO + Base URL មាន subpath/query/hash ➜ decrypt និង local encrypted storage; HTTPS proxy ផ្សេង; placeholder ក្នុង path; URL មិនត្រឹមត្រូវ។ ករណី ZTO ថ្មីធ្លាក់លើ source មុនកែ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. Deploy ZoeKeyGen ➜ បិទហើយបើក App ឱ្យបានកំណែ `2.24.16`។ មិនមាន migration/env/rules ថ្មី។
២. Base URL ដាក់ site របស់ ZoeW គោលដៅ; URL API ដាក់ `/.netlify/functions/zto-order-detail?barcode={barcode}`; Header `X-Zoe-Proxy-Key` និងកូនសោ ➜ បង្កើត Link/QR ថ្មី ហើយប្រាប់កូដ ៦ ខ្ទង់ដាច់ដោយឡែក។ API នៅ domain ផ្សេងត្រូវប្រើ HTTPS ពេញ។
៣. អ្នកទទួលឆ្លង PIN ពិនិត្យ destination និងវាយកូដ ➜ សាក Lookup បាកូដ។ បើ producer នៅកំណែចាស់ អាចបញ្ចូល URL HTTPS ពេញរបស់ ZoeW បាន។

### [2.50.54] — 2026-10-10 · ZoeW ៖ **ហាង Supabase ៖ ប៊ូតុង «📥 បញ្ជី ZTO» លេចពេលបើក App (មិនរង់ចាំបើក ☰)** (រាយការណ៍ម្ចាស់គម្រោងក្រោយ merge PR #309 ៖ «ពេលបើក app ដំបូងអត់មានប៊ូតុង បញ្ជីZTO … តែគ្រាន់តែចុចបើក side menu លេចប៊ូតុង បញ្ជីZTO ភ្លាម ។ ដោយឡែក firebase អត់អីទេ») · ZoeW + ZoeKeyGen `2.24.15` ៖ **ហាង Supabase កត់ model · Serial ទូរស័ព្ទ ដូចកៅអី Key** (សំណើម្ចាស់គម្រោង ៖ «ចង់អោយ Supabase រក្សា model និង serrial id ដូច activate key ដែល» ➜ ជ្រើស «កត់ និងបង្ហាញប៉ុណ្ណោះ»)

**ZoeW `2.50.54`** (`zoew-v316` ➜ `zoew-v317`) · **ZoeKeyGen `2.24.15`** (`zoekeygen-v125` ➜ `zoekeygen-v126`)។ migration Supabase ថ្មី `20261010140000_zoe_member_devices.sql` ·
គ្មាន rules Firebase/env ថ្មី · តំបន់ហាម និងតំបន់ចាក់សោ ZTO មិនប៉ះ (`LOCK` ដដែល)។

#### អ្វីដែលខុសពីមុន

- 🔄 **PTR នៅ tablet និងពេល navbar កើនកម្ពស់** (ម្ចាស់ស្នើកែ PTR · branch មិនទាន់ merge ➜ កំណែដដែល)៖ indicator យកកម្ពស់ navbar ដែល App វាស់រួចតាម `--chrome-top`។ មុនកែ tablet 768/800/991px មានចន្លោះ 7px ទល់នឹងទូរស័ព្ទ 10.2px; navbar 100px ធ្វើឱ្យ indicator ជាន់របា។ `gesture-test` ប្រើ touch ពិតក្នុង Chromium ដើម្បីចាប់កំហុសទាំងនេះ និងព្រំដែន 992px; មិនប្ដូរកម្រិតទាញ ឬការសម្រេច refresh។ មុន merge ត្រូវសាកលើ iPhone និង Android ពិត៖ ទាញស្រាល · ទាញដល់ ready · បោះបង់ · refresh · បង្វិលអេក្រង់ និងពិនិត្យ safe-area។ ការវាស់ក្នុង Cloud មិនជំនួសឧបករណ៍ពិតទេ។
- 🔗 **Setup Link/QR រួម API ស្វែងរកអតិថិជន** (សំណើម្ចាស់ · branch មិនទាន់ merge ➜ កំណែដដែល)៖ មុននេះ Link ភ្ជាប់តែ backend។ កាត ZoeKeyGen បញ្ចូល URL HTTPS · Header · mapping · Fast Mode · enabled និងបង្កើតកូដ ៦ ខ្ទង់ពី Web Crypto។ PBKDF2-SHA256 300000 + AES-GCM ចាក់សោ Header និងផ្ទៀងផ្ទាត់ metadata ដើម្បីទប់ការកែ URL។ ZoeW ឆ្លង PIN · បង្ហាញ host · ចុចភ្ជាប់ · សួរកូដ ➜ encrypt កូនសោក្នុងម៉ាស៊ីន និងចងហាង។ lookup-only សម្រាប់ហាងភ្ជាប់រួច; combined សម្រាប់ Firebase/Supabase ថ្មី។ កូដខុស/បោះបង់/logout កណ្ដាល crypto ➜ គ្មានការរក្សាទុក។ អ្នកយាម `tests/setup-lookup.test.tsx` រត់កូដលក់ និងកូដទទួលពិត; `secret-hygiene` លាក់ `keyEnc` និងកូដ។ **សកម្មភាពដោយដៃ**៖ បង្កើត Link ថ្មី · កត់កូដ និងប្រាប់ដាច់ដោយឡែក · អ្នកទទួលវាយ PIN និងកូដ។ គ្មាន migration/env/rules ថ្មីសម្រាប់ Lookup។
- 🚚 **ហាង Supabase** ៖ បើក App (ស្តារ session) ➜ ប៊ូតុង «📥 បញ្ជី ZTO» នៅក្បាលប្រវត្តិលេចភ្លាមពេលគណនីស្គាល់ហាង ហើយក្រុម ZTO ក្នុង ☰ គណនាឡើងវិញព្រមគ្នា។
  មុនកែ ៖ ការកំណត់ API ZTO ចងហាង ([2.50.53] ជុំ ៤) ➜ boot គណនាប៊ូតុងមុន SDK Supabase និងគណនីមកដល់ (ហាងមិនទាន់ស្គាល់ ➜ «មិនមែនហាងនេះ» ➜ លាក់) ហើយគ្មានអ្វីគណនា
  ឡើងវិញ រហូតបើក ☰ (`openSideDrawer()`)។ Firebase ស្គាល់ហាងពី `databaseURL` តាំងពី boot ➜ មិនរងផលប៉ះពាល់។
- 🏪 **Firebase Reconfig ពីហាង A ទៅហាង B** (ចន្លោះដដែល · វាស់) ៖ ប៊ូតុងរបស់ហាង A លាក់ពេលចូលហាង B (មុន ៖ នៅលេចរហូតបើក ☰)។
- ច្រកតែមួយ `refreshShopBoundUi()` (`features/lookup-config.ts`) ៖ boot · រក្សាទុក API ស្វែងរកអតិថិជន · ចូលប្រព័ន្ធ/ស្តារ (`proceedAfterLogin()` មុនការពិនិត្យ License) ·
  គណនី Supabase មកដល់ ប្តូរ ឬបាត់ (adapter `onTenantChanged` ➜ env របស់ App) · ☰ (`openSideDrawer()` ក្នុងតំបន់ហាម មិនប៉ះ)។
- 📱 **ហាង Supabase ៖ ឧបករណ៍របស់ហាង** ៖ គណនីស្គាល់ហាង (ស្តារ · ចូល · គណនីមកដល់យឺត) ➜ ZoeW ផ្ញើ model · ប្រព័ន្ធ · Serial (Android ID ឬ ID App ១៦ តួ ដែល ☰ · 🩺 បង្ហាញ)
  ទៅ RPC `note_my_device` ម្តងក្នុងមួយទំព័រ/គណនី (ធ្លាក់ ➜ សាកម្តងទៀតក្រោយ ៥ នាទីពីវដ្ត ៦០ វិ.) ➜ តារាង `member_devices` (ហាង + Serial · គណនីចុងក្រោយ · ថ្ងៃប្រើចុងក្រោយ ·
  ≤ ៣០ ក្នុងមួយហាង · មានតែ Admin អាន)។ ZoeKeyGen «🏪 ហាង Supabase» ៖ ក្រោមគណនីនៃហាងនីមួយៗ មួយបន្ទាត់ក្នុងមួយទូរស័ព្ទ
  `Samsung SM-A546E · Android 14 · Serial … · sokha · ប្រើចុងក្រោយ …` (ទម្រង់ដូចកៅអី Key · គ្មាន emoji) · អានមិនបាន (migration មិនទាន់ដាក់) ➜ «⚠️ អានបញ្ជីឧបករណ៍មិនបាន»។
  សម្រាប់មើលតែប៉ុណ្ណោះ ⛔ មិនកំណត់ចំនួនទូរស័ព្ទ ហើយមិនប៉ះការចូលប្រព័ន្ធ (ការកំណត់ចំនួនដូច `maxDevices` = ការងារដាច់ដោយឡែក បើម្ចាស់គម្រោងស្នើ)។

#### អ្នកយាម

- `ZoeW/tests/shop-bound-ui-refresh.test.ts` (ថ្មី · ៦ · adapter Supabase ពិត + transport ពិត + env ពិតរបស់ App តាម `loadSupabaseFb()` · `proceedAfterLogin()` ពិត) ៖ ស្តារ + គណនីក្នុង cache ·
  គណនីមកដល់យឺត (`my_account()` ឆ្លើយក្រោយ) · ចាកចេញ ➜ លាក់ · ហាងផ្សេង ➜ នៅលាក់ · Supabase ចូលប្រព័ន្ធ · Firebase Reconfig A ➜ B ➜ **ធ្លាក់ ៥/៦ លើ `5767bc2`** (main ក្រោយ PR #309) · ជាប់ ៦/៦ ·
  mutation ៖ ដក `onTenantChanged` ក្នុង env ➜ ធ្លាក់ ៣ (ផ្លូវ adapter) · ដក `refreshShopBoundUi()` ក្នុង `proceedAfterLogin()` ➜ ធ្លាក់ ២ (ផ្លូវចូលប្រព័ន្ធ)។
- ឧបករណ៍ Supabase ៖ `supabase-rls-test` +១៤ (Postgres ពិត · `note_my_device` ៖ ហាង/គណនីពី `auth.uid()` · anon · គណនីគ្មានហាង · ហាងបិទ · serial/model/ប្រព័ន្ធខុស ·
  ព័ត៌មានដដែលក្នុង ១ ម៉ោងមិនសរសេរ · Serial អក្សរធំ = ជួរដដែល · សមាជិកមិនអាន · DML ផ្ទាល់បដិសេធ · ពិដាន ៣០) + mutation ៦ (policy `using (true)` · ហាងពី client ·
  ទទួលហាងបិទ · គ្មានពិដាន · សរសេររាល់ការហៅ · anon ហៅបាន) ➜ ៤៨០/៤៨០ · `keygen-supabase-admin-test` +៥ (RPC ពិត ➜ បន្ទាត់ឧបករណ៍ · XSS model · អានមិនបាន ≠ គ្មាន) ➜ ១០៧/១០៧ ·
  `ZoeW/tests/shop-device-note.test.ts` (ថ្មី · ៤ · adapter + transport + env ពិត) ➜ mutation ៖ ដក `noteShopDevice()` ពី env ➜ ធ្លាក់ ៣ · ដកគម្លាតក្រោយធ្លាក់ ➜ ធ្លាក់ ១។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. Merge ➜ migration `20261010140000_zoe_member_devices.sql` ចូល Supabase ស្វ័យប្រវត្តិ (GitHub integration) ឬ paste ក្នុង SQL Editor ➜ Netlify Deploy **ZoeW** និង
   **ZoeKeyGen** (APK 2.50.54 build ដោយ workflow ពេល merge ដូចធម្មតា)។
២. ហាង Supabase ដែលបានកំណត់ API ZTO និងបើក «ទាញបញ្ជីកញ្ចប់ពី ZTO» ៖ បិទ App ទាំងស្រុង ➜ បើកវិញ ➜ ប៊ូតុង «📥 បញ្ជី ZTO» លេចដោយមិនបើក ☰។
៣. ZoeKeyGen ➜ «🏪 ហាង Supabase» ➜ 🔄 Refresh ៖ ក្រោយទូរស័ព្ទនីមួយៗបើក ZoeW កំណែថ្មី (ចូលហាង) ➜ បន្ទាត់ «model · ប្រព័ន្ធ · Serial · គណនី · ប្រើចុងក្រោយ» ក្រោមហាងនោះ ·
   Serial ស្មើអ្វីដែលទូរស័ព្ទបង្ហាញក្នុង ☰ ខាងក្រោម។

### [2.50.53] — 2026-10-10 · ZoeW ៖ **iPhone បង្ហាញត្រឹម «iPhone» + កំណែ iOS (ដកការទាយ model ពីទំហំអេក្រង់)** (សំណើម្ចាស់គម្រោង ៖ «បើអោយវាស់តាមទំហំអេក្រង់ចិងចេញ model មិនច្បាស់ថាមួយណាទេ សូមអោយអានពី hardware វិញទៅ» ➜ ពន្យល់ថា web/PWA លើ iPhone អាន hardware មិនបាន ➜ ម្ចាស់គម្រោង ៖ «ចិងដាក់អោយឃើញតែ iPhone ដូចមុនចុះ») · ZoeW + ZoeKeyGen `2.24.14` ៖ **Deep audit ៥ ៖ ការសម្អាត/ការលុបលើ id ដែលធុងសំរាមនៅកាន់ជីវិតចាស់ · SW ZoeKeyGen ទាញឯកសារស្រស់ · ប្រអប់ Extend ប្រាប់ការពិត** (សំណើម្ចាស់គម្រោង ៖ «deep audit … commit ចូល PR#309»)

**ZoeW `2.50.53`** (`zoew-v315` ➜ `zoew-v316` · PR #309 មិនទាន់ merge ➜ Deep audit ៥ ចូលកំណែដដែល) · **ZoeKeyGen `2.24.14`** (`zoekeygen-v124` ➜ `zoekeygen-v125` · Deep audit ៥)។
គ្មាន rules/migration/env ថ្មី · តំបន់ហាមមិនប៉ះ · តំបន់ចាក់សោ ZTO កែតាមសំណើម្ចាស់គម្រោង «ZTO កែចុះ» និង «ពិនិត្យអោយស្អាតចុះ ZTO ហើយចាក់សោរវិញ»
(`zto-order-detail.js` · `zto-list-sync.ts` ➜ sha256 ថ្មីក្នុង `ZoeW/tests/zto-lock.test.ts` `LOCK`) និង «ok ធ្វើទាំង៣ចំណុចហ្នឹងទៅ» (ជុំ ៤ ៖ អាយុ Cookie ក្នុង
`zto-order-detail.js` ➜ `LOCK` ថ្មីម្តងទៀត · Blob `cookie-life` ក្នុង store `zto-auth` បង្កើតដោយខ្លួនឯង)។

#### អ្វីដែលខុសពីមុន

- 📱 **ZoeW (PWA iPhone) ☰ · 🩺 · កៅអី Key** ៖ model = «iPhone» គ្រប់ទំហំអេក្រង់ (ដូច [2.50.51]) · កំណែ iOS ពិតនៅដដែល ([2.50.45] ៖ «iOS 26.5» · Home Screen «iOS 26+»)។
  ហេតុ ៖ [2.50.52] ទាយពីទំហំអេក្រង់ × pixel ratio × កំណែ iOS ➜ ទូរស័ព្ទ `390×844@3` iOS 26.5 ពិតរបស់ម្ចាស់គម្រោងបង្ហាញ «iPhone 12 / 12 Pro / 13 / 13 Pro / 14 / 16e / 17e»
  (រូបអេក្រង់ ☰) ➜ មិនច្បាស់។ «អានពី hardware» ធ្វើមិនបាន ៖ Safari/PWA មិនផ្តល់ identifier (`iPhone14,5` …) · UA = «iPhone» · WebGL = «Apple GPU» · hardware តែមួយដែលមើលបាន
  (បញ្ជីកែវកាមេរ៉ាក្រោយ ក្រោយបើកកាមេរ៉ា) បំបែកបានត្រឹម ៣ ក្រុម (១ កែវ 16e/17e · ២ កែវ 12/13/14 · ៣ កែវ 12 Pro/13 Pro) ➜ ម្ចាស់គម្រោងជ្រើស «iPhone»។
  ការអាន model ពិតលើ iPhone ត្រូវការ App iPhone ដើម (native · Xcode · Apple Developer) — មិនមែនក្នុងជុំនេះ។ App Android អាន hardware ពិតដដែល (`ZoeDevice`)។
- 🧹 `IPHONE_MODELS` · `iphoneModelFromScreen()` · `iosVersionOf()` · `iosFitsModel()` ដកចេញ ➜ `src/features/device-info.ts` ដូច [2.50.51] បេះបិទ (`git diff 4e7afb4~1` = ០)។
  Serial (ID App ១៦ តួ) · បន្ទាត់គ្មាន emoji ([2.50.52]) មិនប្រែ។ កៅអីដែលកត់ model ក្រុមរួច ➜ `noteSeatMeta()` សរសេរ «iPhone» ពេលពិនិត្យ Key លើកក្រោយ (ខុសពីតម្លៃចាស់)។
- 🗑️ **ZoeW (Deep audit ៥) ៖ កញ្ចប់ដែលបញ្ចូលក្រោម id ដែលធុងសំរាមនៅកាន់ច្បាប់ចម្លងចាស់** (ការស្កេន/បញ្ជី ZTO លើទិដ្ឋភាពចាស់ ➜ «Merge into a gone item» បង្កើត
  ធាតុថ្មីក្រោម id ចាស់ ខណៈ `trash/<id>` នៅកាន់ច្បាប់ចម្លងនៃការលុប/ផុតកំណត់/យករួចមុន) ៖ ការសម្អាត ៨ ថ្ងៃ និង ២ ម៉ោង ដាក់កញ្ចប់នោះចូលធុងសំរាម (slot ផ្លាស់ទៅ id
  កំណត់ `cleanupPartialTrashId(id, <trashReason>|slot)`) ហើយ ៨ ថ្ងៃកាត់ប្រាក់ ១ ដង (មុន ៖ កញ្ចប់បាត់ពីប្រវត្តិ និងធុងសំរាម · ប្រាក់មិនកាត់ · កូនសោ registry ជាប់) ·
  ការ **លុប** ធាតុនោះមិនសរសេរជាន់ច្បាប់ចម្លងចាស់ទៀត (slot ដដែល · ច្បាប់ចម្លងចាស់នៅ ហើយ purge តាមពេលវេលារបស់វា)។ ឧបករណ៍ ២ claim ធាតុដដែល ➜ id ផ្លាស់ដូចគ្នា ➜ ច្បាប់ចម្លង ១ · កាត់ ១ ដង។
- 🌐 **ZoeKeyGen (Deep audit ៥) ៖ Service Worker ទាញឯកសារសំបកពី server ជានិច្ច** (`cache: 'no-cache'` លើ install CORE/OPTIONAL · navigate · shell ដែលខ្វះក្នុង cache ដូច ZoeW)
  ➜ HTTP cache ចាស់ (header `immutable` ពី CDN ឬ deploy ចាស់) មិនចូល cache SW ថ្មីទៀតទេ។
- 🔑 **ZoeKeyGen (Deep audit ៥) ៖ ប្រអប់ «⏳ បន្ថែមសុពលភាព»** ប្រាប់ការពិត ៖ ថ្ងៃផុតកំណត់ថ្មីរក្សាលើ Server · គ្រឿងដែល Activate រួចទទួលវាពេលពិនិត្យ Key បន្ទាប់ ·
  គ្រឿងថ្មី/Reset Activate Key នេះបានរហូតដល់ថ្ងៃថ្មី (តាមចំនួនឧបករណ៍)។ អត្ថបទមុនប្រាប់ផ្ទុយ («តែគ្រឿងដែល Activate រួច») ➜ អ្នកលក់បង្កើត Key ថ្មីឥតប្រយោជន៍។
- 🗑️ **ZoeW (Deep audit ៥ ជុំ ២ · ម្ចាស់គម្រោង ៖ «អ្វីនៅសល់កែឲ្យស្អាតទាំងអស់»)** ៖
  «លុបទាំងអស់» ធាតុដែល `trash/<id>` នៅកាន់ច្បាប់ចម្លងនៃជីវិតមុន ➜ ចូលធុងសំរាម «លុប» ក្បែរច្បាប់ចម្លងនោះ (មុន ៖ rules បដិសេធការ finalize ៣ ដង ➜ «លុបមិនបានជោគជ័យ» ·
  `clearClaim` ជាប់លើធាតុ ➜ ការសម្អាត ២ ម៉ោង/៨ ថ្ងៃ · ដក · លុប រំលងធាតុនោះ រហូត reload ឬផុត lease) · ការសម្អាត ៨ ថ្ងៃលើធាតុចាស់គ្មាន `barcodes` (ទម្រង់មុន React) ➜
  ធុងសំរាមកាន់ barcode របស់វា `isDeducted: true` (មុន ៖ ledger កាត់រួច តែ «ចំណូល (យករួច)» នៅរាប់វាថាមិនទាន់យក ➜ ចំណូលបង្ហាញតិចជាងពិតរហូត purge) ·
  ការសម្អាតដែលសរសេរធុងសំរាមមិនបាន ហើយត្រឡប់ទៅប្រវត្តិ ខណៈឧបករណ៍ផ្សេងបង្កើតធាតុឡើងវិញក្រោម id ដដែល ➜ barcode ដែល claim ចូលធាតុនោះ (មុន ៖ បាត់ពីប្រវត្តិ និងធុងសំរាម) ·
  Locker ៖ ការកំណត់ទីតាំងដែលចុះយឺត (ឬបរាជ័យ) ក្រោយចាកចេញ/ប្តូរ Config ➜ មិនកែទិដ្ឋភាព · មិនបង្ហាញ ✅/❌ ក្នុង session ថ្មី ·
  ការសរសេរធុងសំរាមឡើងវិញ (សម្អាត · លុប · ដក) និងការស្តារ barcode ចូលប្រវត្តិ ឈប់ពេលចាកចេញ/ប្តូរ Config កណ្តាលការសាក (មុន ៖ ការសាកលើកក្រោយសរសេរកញ្ចប់ហាង A
  ចូលហាង B — ហាង Supabase ៖ គណនីថ្មីក្នុង Project ដដែល) · ការបន្តការសម្អាតដែលត្រូវរំខាន ឈប់ពេល session ប្តូរកណ្តាលផ្លូវ (មុន ៖ សរសេរធុងសំរាម និង **កាត់ប្រាក់**
  ក្នុងហាងថ្មី)។
- 🔐 **ZoeW (Deep audit ៥ ជុំ ៣ · ម្ចាស់គម្រោង ៖ «វាស់ឡើងវិញទាំងអស់ … ការពារលេចទិន្នន័យចូលគ្នារវាងហាងខុសគ្នា»)** ៖ ចម្លើយ Firebase/Supabase ដែលមកដល់ក្រោយចាកចេញ
  ឬប្តូរ Config មិនបន្តការងាររបស់ហាងចាស់ក្នុងហាងថ្មីទៀតទេ ៖ «ដក» (មុន ៖ **កាត់ប្រាក់** ledger + ធុងសំរាមក្នុងហាងថ្មី) · ការស្តារ (ការសាក finalize ក្រោយបណ្តាញធ្លាក់ផង ៖ មុន ៖ **បូកប្រាក់ត្រឡប់** ចូលហាងថ្មី) · លុបអចិន្ត្រៃយ៍ និង purge ធុងសំរាម (មុន ៖
  **ដោះកូនសោស្កេនស្ទួន** របស់ហាងថ្មី) · «លុបទាំងអស់» · ការជួសជុលស្ថិតិយករួច (មុន ៖ សរសេរ barcode + លេខទូរស័ព្ទហាងចាស់ចូលស្ថិតិហាងថ្មី)។
  អត្រាប្រាក់ ៖ ហាងដែលមិនដែលកំណត់អត្រា បង្ហាញលំនាំដើម 4100 (មុន ៖ បន្តប្រើអត្រារបស់ហាងមុនដែលបានបើកលើឧបករណ៍នេះ)។
- 📚 **ZTO-E13 (ZoeW + Function · Deep audit ៥ ជុំ ៣ · សំណើម្ចាស់គម្រោង «ZTO កែចុះ») ៖ ZTO ឆ្លើយបញ្ជីគ្មាន `pages`** ៖ ទំព័រពេញ (= `pageSize`) ដែល ZTO មិនប្រាប់
  ចំនួនទំព័រ ➜ Function រាយ `pagesUnknown: true` និង `pages` = ទំព័រនេះ + ១ (ទំព័រមិនពេញ ➜ ទំព័រនេះ · ទំព័រទទេ ➜ ទំព័រមុន) ➜ ជុំបិទតាម ZTO (`fetchZtoSignedPages()`) និង
  ប្រអប់ «ទាញបញ្ជីពី ZTO» (`fetchZtoListAllPages()` ៖ បញ្ជីមកដល់ និងភស្តុតាងចុះហត្ថលេខា) អានទំព័របន្ទាប់ម្តងមួយៗរហូតទំព័រមិនពេញ ឬពិដាន ៣ ទំព័រ · ពិដានហើយនៅពេញ ➜
  `truncated` (ជុំបិទ ៖ អានតាមថ្ងៃ · មិនពេញលេញ ➜ ការសម្អាត ៨ ថ្ងៃរង់ចាំ) · ប្រអប់ ៖ «បញ្ជីវែងជាង ៣ ទំព័រ» · ភស្តុតាង ➜ `partial`) · «ZTO រាយ N» = ផលបូកទំព័រ។
  មុនកែ ៖ Function រាយ `pages: 1` ➜ client អានតែទំព័រ ១ ហើយហៅថា «ពេញលេញ» ➜ ភស្តុតាងចុះហត្ថលេខាទំព័រ ២+ បាត់ ➜ កញ្ចប់ដែលយករួចអាចត្រូវសម្អាត ៨ ថ្ងៃជា «ផុតកំណត់»
  (កាត់ប្រាក់) · ប្រអប់ទាញបានត្រឹម ១០០ ជួរដោយគ្មានការព្រមាន។ ZTO ដែលប្រាប់ `pages` ➜ ការហៅ ZTO ដដែល (ទំព័រ ២..N ស្របគ្នា)។
- 🏪 **ZoeW (ជុំ ៤ · ម្ចាស់គម្រោង ៖ «ok ធ្វើទាំង៣ចំណុចហ្នឹងទៅ») ៖ ការកំណត់ដែលជារបស់ហាង** ៖ API ស្វែងរកអតិថិជន/តារាងអតិថិជន (`zoew_lookup_api_config`) និងការតភ្ជាប់
  Excel ➜ Sheet (`zoew_sheet_import_config`) កត់ហាងដែលកំណត់វា (Firebase ៖ `databaseURL` · Supabase ៖ Project + ហាង) ➜ ចូលហាងផ្សេងលើឧបករណ៍ដដែល ➜ មិនប្រើ (ប្រអប់ទទេ ➜
  កំណត់សម្រាប់ហាងនោះ) · ត្រឡប់ហាងដើម ➜ ប្រើបានវិញ។ មុន ៖ ហាង B ស្វែងរកតាម Lookup/តារាងអតិថិជនរបស់ហាង A ហើយ «នាំចូល Excel» សរសេរចូល Sheet ហាង A។
  ការកំណត់ចាស់ (គ្មានហាង) ➜ ចងទៅហាងដែលបើកវាមុនគេក្រោយ update។ ហាង Supabase ដែល session ស្តារ តែគណនីមិនទាន់មកដល់ (ហាងមិនទាន់ស្គាល់) ➜ ការសម្អាតស្វ័យប្រវត្តិ
  និងការបន្តការសម្អាតដែលត្រូវរំខាន រង់ចាំរហូតស្គាល់ហាង (ការរង់ចាំបញ្ជី «ចុះហត្ថលេខា» ZTO មុនការសម្អាត ៨ ថ្ងៃ មិនបាត់ · journal ហាង A មិនបន្តក្នុងហាងដែលប្រហែលជាហាង B)។
- 📲 **ZoeW (ជុំ ៤) ៖ Push ជារបស់ហាង** ៖ ចូលហាងផ្សេង (Supabase ៖ គណនីហាងផ្សេង · Firebase ៖ Reconfig) ➜ App ចុះឈ្មោះ Push ឡើងវិញក្រោមហាងថ្មីភ្លាម (Supabase ៖ ហាងចាស់លែងផ្ញើ
  ដំណឹងទៅឧបករណ៍នេះ) ហើយផ្ញើកាលវិភាគ «ជិតផុតកំណត់» របស់ហាងថ្មីភ្លាម។ មុន ៖ ឧបករណ៍នៅទទួល «ជិតផុតកំណត់» របស់ហាងចាស់ រហូតដល់ ៦ ម៉ោង (ឬរហូតបិទ/បើក 📲)។
- ⏱️ **Function ZTO + 🩺 (ជុំ ៤ · តំបន់ចាក់សោ · ម្ចាស់គម្រោង ៖ «ហេតុអ្វី Cookie ពេលខ្លះប្រើបាន ១០–១៤ ម៉ោង ពេលខ្លះ ៣–៤ ម៉ោង») ៖ អាយុ Cookie** ៖ Function កត់ក្នុង
  Blob `cookie-life` តាមការ Sync នីមួយៗ ៖ ពេល ZTO ទទួលចុងក្រោយ និងពេល ZTO បដិសេធ (៨ ការ Sync ចុងក្រោយ) ➜ 🩺 ជួរ ZTO ៖ «អាយុ Cookie ក្រោយ Sync ៖ ប្រើបាន 11 ម៉ោង ➜
  បដិសេធនៅ 14 ម៉ោង (ទំនេរ 3 ម៉ោង មុនបដិសេធ)» (Cookie ៣ ចុងក្រោយដែលស្លាប់)។ ទំនេរយូរ ➜ ZTO ផុតដោយគ្មានការប្រើ · ទំនេរខ្លី ➜ ZTO បិទ session ពីខាងខ្លួន (ចូល Argus
  ម្តងទៀតកន្លែងផ្សេង · ZTO restart)។ សាលក្រម ✅/⚠️/❌ មិនប្រែ · ការស្កេនមិនយឺត (សរសេរ ≤ ១ ដង/១០ នាទី ក្នុងថវិកាសំណើ)។
- 🧹 **ឧបករណ៍អភិវឌ្ឍ (ជុំ ៤ · ម្ចាស់គម្រោង ៖ «ពិនិត្យរក warning ហើយប្រាប់ខ្ញុំ និងកែសម្រួលផង»)** ៖ `npm ci` (npm 11 ក្នុង CI) លែងព្រមាន
  `install-scripts not yet covered by allowScripts` ➜ `allowScripts` (pinned តាមកំណែ) ក្នុង `ZoeW/package.json` (`esbuild` · `@firebase/util` · `protobufjs`) និង
  `supabase/package.json` (`@embedded-postgres/linux-x64`) ➜ npm 12 (បិទ install script ដែលមិនទាន់អនុញ្ញាតជាលំនាំដើម) នៅដំឡើង esbuild/Postgres ដូចមុន · eslint ០ warning។
  អ្នកប្រើមិនឃើញអ្វីប្រែ។
- 🔑 **ZoeKeyGen (ជុំ ២) ៖ Generate Key · Migrate Key ចាស់** ៖ ការសរសេរ (retry ទី ២–៣ ផង) ទៅ License Project ដែលចាប់ពេលចាប់ផ្តើម ហើយឈប់ពេលប្តូរ Config/ចាកចេញ
  (មុន ៖ Generate retry អាន `db` បច្ចុប្បន្ន ➜ Reconfig ចន្លោះ retry សរសេរ Key ចូល License Project ថ្មី ហើយបង្ហាញ Key ដូចជោគជ័យ · Migrate អានពី Project A ហើយសរសេរការផ្លាស់ទីចូល
  Project ដែលភ្ជាប់ពេលអានចប់ + ✅ ក្នុង session ថ្មី)។

#### អ្នកយាម

- `ZoeW/tests/device-info.test.tsx` ៖ iPhone PWA ពិត (`loadDeviceInfo`) ៧ ទំហំ (`390×844` · `402×874` · `393×852` · `440×956` · `420×912` · `375×812@2.88` · `320×693`) ➜ model «iPhone» ·
  កំណែ iOS ពិត · meta License `{ model: 'iPhone' }` · កូដ ៖ device-info មិនអាន `screen.width/height` · `devicePixelRatio` · គ្មានឈ្មោះ «iPhone <លេខ>» ·
  `IPHONE_MODELS`/`iphoneModelFromScreen` មិន export ➜ **ធ្លាក់ ២ លើកូដ [2.50.52]** (`git show HEAD:…device-info.ts`) · ជាប់ ១៥/១៥ លើកូដថ្មី។
- `ZoeW/tests/cleanup-foreign-slot.test.ts` (ថ្មី · ៨ · `claimAndCleanupItem` · `resumeCleanupJournalEntry` · `deleteSingleItem` ពិត) ៖ abandon/close លើ id ដែល slot កាន់ជីវិតចាស់ ·
  ឧបករណ៍ ២ (`applied`) · resume `slot` · ប្រវត្តិ id ដដែលមាន barcode ផ្សេង · លុប · ទិសផ្ទុយ ២ (ច្បាប់ចម្លងដូចគ្នា ➜ «elsewhere» · slot ទំនេរ ➜ id ធាតុ) ➜ **ធ្លាក់ ៦/៨ លើកូដមុនកែ** · ជាប់ ៨/៨។
- `sw-install-integrity-test` ជុំទី ៤ខ (ZoeKeyGen ៖ `qrcode.js` A `immutable` ក្នុង HTTP cache ➜ SW B ត្រូវទាញ B) ➜ **ធ្លាក់លើ sw.js មុនកែ** · ជាប់ ៥៩/៥៩។
- `license-clock-rollback-test` ច.៨–ច.៩ (ច.១ វាស់ថា Key ដែល Extend Activate លើគ្រឿងថ្មីបាន ➜ ប្រអប់ Extend មិនត្រូវប្រាប់ផ្ទុយ) ➜ **ធ្លាក់លើ index.html មុនកែ** · ជាប់ ៣៥/៣៥។
- ជុំ ២ ៖ `ZoeW/tests/clear-history-foreign-slot.test.ts` (ថ្មី · ៣ · `clearHistory()` ពិត · fake Firebase អនុវត្ត fence ពិតរបស់ rules) ➜ **ធ្លាក់ ២/៣ មុនកែ** · ជាប់ ៣/៣ ·
  `cleanup-foreign-slot.test.ts` ៩–១០ (ធុងសំរាមបរាជ័យ + ប្រវត្តិបង្កើតឡើងវិញ · ទិសផ្ទុយ) ➜ ៩ **ធ្លាក់មុនកែ** (`['D']`) · ជាប់ ១០/១០ ·
  `cleanup-deduct-order.test.ts` ១១ (ធាតុគ្មាន `barcodes`) ➜ **ធ្លាក់មុនកែ** · ជាប់ ១២/១២ · `ZoeW/tests/locker-assign-session.test.ts` (ថ្មី · ៤) ➜ **ធ្លាក់ ២ មុនកែ** · ជាប់ ៤/៤ ·
  `keygen-session-security-test` «ប្តូរ Database កណ្តាល retry» (`retryAsync()` ពិត) · «ប្តូរ Database ចន្លោះការអាន និងការសរសេររបស់ Migrate» ➜ **ធ្លាក់ ២ + ២ មុនកែ** · ជាប់ ១៥០/១៥០។
  `ZoeW/tests/trash-retry-session.test.ts` (ថ្មី · ៥ · `claimAndCleanupItem` · `deleteSingleItem` · `removeSingleBarcode` · `restoreClaimedItemToScanHistory` ពិត · fake កត់ Database
  នៃការសរសេរនីមួយៗ) ➜ **ធ្លាក់ ៤/៥ មុនកែ** (ការសាកឡើងវិញសរសេរចូលហាង B) · ជាប់ ៥/៥។
  `ZoeW/tests/cleanup-resume-session.test.ts` (ថ្មី · ៥ · `resumeCleanupJournalEntry` ពិត · ប្តូរហាងនៅការអានធុងសំរាម · ក្រោយសរសេរធុងសំរាម · ពេលអាន slot · ក្រោយជំហាន ledger ខែ ·
  ទិសផ្ទុយ) ➜ **ធ្លាក់ ៣/៥ មុនកែ** (ធុងសំរាម + ledger ខែ/ថ្ងៃ + flip ក្នុងហាង B) · ជាប់ ៥/៥។
- ជុំ ៣ ៖ `ZoeW/tests/session-switch-fuzz.test.ts` (ថ្មី · ២៧ ប្រតិបត្តិការសរសេរពិត · ចម្លើយនៃការហៅទី k មកក្រោយ macrotask ដែលប្តូរហាង · k = ១…N · ការរត់មូលដ្ឋាននីមួយៗត្រូវសរសេរ)
  ➜ **ធ្លាក់ ៦/២៧ មុនកែ** (ដក · ស្តារ · លុបអចិន្ត្រៃយ៍ · លុបទាំងអស់ · purge · ជួសជុល pickup) · ជាប់ ២៧/២៧ · `clear-history-claim-test` sandbox ប្រកាស `authGeneration`។
  របៀប retry ក្នុង fuzz ដដែល (ការសរសេរទី w ធ្លាក់ · w = ១…W × ប្តូរហាងនៅ k = ១…N) ➜ **ធ្លាក់ ១/២៧ មុនកែ** (ស្តារ ៖ `w=3 k=5/12` · `k=6/12` ➜ finalize សាក `update` ក្នុង B) ·
  ជាប់ ៥៤/៥៤ · `restore-race-test` sandbox ប្រកាស `authGeneration` (៨/៨)។
  `ZoeW/tests/exchange-rate-shop-switch.test.ts` (ថ្មី · ២ · `initDatabaseListeners()` ពិត) ➜ **ធ្លាក់ ១/២ មុនកែ** (ហាង B = 4000 របស់ហាង A) · ជាប់ ២/២។
- ZTO-E13 ៖ `ZoeW/tests/zto-pages-unknown.test.tsx` (ថ្មី · ៩ · Function ពិត + client ពិត + ZTO ក្លែងគ្មាន `pages`/`total`) ➜ **ធ្លាក់ ៦/៩ មុនកែ** (ទាញបាន ១០០ ពី ២៥០ ·
  `truncated: false` ពេល ៣៥០ · ភស្តុតាង `ok` ពេល ៣៥០) · ទិសផ្ទុយ ៣ (ទំព័រមិនពេញ ➜ ការហៅ ZTO ១ ដង · ZTO មាន `pages` ➜ ការហៅ `03 1–3` · `05 1–2` ដដែល) · ជាប់ ៩/៩ ·
  `zto-list-sync-test` ZTO-E10 ៥ ការអះអាង (ទំព័រ ១/២ ពេញ · មិនពេញ · ទទេ · មាន meta) ➜ **ធ្លាក់ ៣ មុនកែ** · ជាប់ ៥៩៥ ok · អ្នកយាម ZTO ផ្សេងទាំងអស់បៃតង
  (vitest ZTO ២៤ ឯកសារ · `zto-sync-banner` ១៩៨ · `zto-proxy` ១៩៧ · `zto-budget` ៦៣ · `zto-cookie-*` · `zto-negative-cache` · `zto-signed-status` · `zto-network-boundaries`)។
- ជុំ ៤ ៖ `ZoeW/tests/shop-bound-settings.test.ts` (ថ្មី · ៦ · `getLookupApiConfig` · `saveLookupApiConfig` · `readSheetImportStoredConfig` ពិត · Supabase ហាង A/B · ចាកចេញ ·
  Firebase Reconfig · ទិសផ្ទុយ ៖ `/` ចុង · ការកំណត់ចាស់) ➜ **ធ្លាក់ ៥/៦ មុនកែ** · ជាប់ ៦/៦ · `push-client.test.tsx` «⛔ Push ជារបស់ហាង» (ថ្មី · ៦ · web · APK · Firebase
  Reconfig · ការកំណត់ចាស់ · ធ្លាក់ ➜ មិនសាករាល់ `visibilitychange`) ➜ **ធ្លាក់ ៥/៦ មុនកែ** · ជាប់ ៦/៦ · `push-server.test.ts` (subscription ផ្លាស់ពី index ហាង A ទៅ B ·
  `dispatchExpiry` ហាង A មិនផ្ញើ) ➜ ជាប់លើកូដមុនកែផង (Server ត្រឹមត្រូវរួច) ·
  `ZoeW/tests/zto-cookie-life.test.ts` (ថ្មី · ១២ · Function ពិត + Blobs ក្លែងដែលបែងចែក key · container ថ្មី · ETag ប្រណាំង · Blob ជាប់គាំង ➜ ឆ្លើយក្នុង ២.៥ វិ. · Cookie env ·
  ទិន្នន័យខូច · អត្ថបទ 🩺) ➜ **ធ្លាក់ ១២/១២ មុនកែ** · ជាប់ ១២/១២ · `health-check-test` +៧ (អត្ថបទអាយុ · Cookie រស់មិនរាយ «បដិសេធ» · សាលក្រមមិនប្រែ · `cookie.life` ខូច ៤) ➜
  ១៧៨ ok · `zto-cookie-store-test` ៖ Blobs ក្លែងបែងចែក key · «diag ទី ២ ប្រើ cache» រាប់តែការអាន key `cookie` ➜ ៩១ ok · អ្នកយាម ZTO ទាំងអស់បៃតង (vitest ZTO + push-server
  ២៤ ឯកសារ ៣២៦ · `zto-list-sync` ៥៩៥ · `zto-sync-banner` ១៩៨ · `zto-proxy` ១៩៧ · `zto-budget` ៦៣ · `zto-cookie-session` ៣២ · `zto-cookie-sync` ១៨៣ · `zto-cookie-capture` ៥៦ ·
  `zto-negative-cache` ៣៥ · `zto-signed-status` ៥៧ · `zto-network-boundaries` ១១)។
  `ZoeW/tests/shop-pending-cleanup.test.tsx` (ថ្មី · ៤ · `runAutomaticCleanupRules` · `resumeInterruptedCleanups` ពិត · ហាង Supabase មិនទាន់ស្គាល់ · ទិសផ្ទុយ ២ ៖ Firebase · Supabase
  ស្គាល់ គ្មាន ZTO ➜ ផុតកំណត់ធម្មតា) ➜ **ធ្លាក់ ២/៤ លើ `7894e2d`** (ការរង់ចាំ ZTO បាត់ ➜ កញ្ចប់ ៨ ថ្ងៃដកលុយ · journal បន្ត) · លើ `f572e1d` ធ្លាក់តែ journal (ចន្លោះចាស់) · ជាប់ ៤/៤។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. Merge ➜ Netlify Deploy **ZoeW** និង **ZoeKeyGen** (`2.24.14`)។ Function ZTO (`zto-order-detail.js`) ចេញជាមួយ Deploy ZoeW (env មិនប្រែ)។
២. iPhone (App លើ Home Screen) ៖ ☰ ខាងក្រោម និង 🩺 ➜ «iPhone · iOS 26.x» (ឬ «iOS 26+») · Serial ដដែល។
៣. ZoeKeyGen ➜ បញ្ជី Key ➜ កៅអីរបស់ iPhone នោះ ៖ «d1 · iPhone · iOS … · Serial …» ក្រោយ iPhone បើក App កំណែថ្មី (ពិនិត្យ Key)។ APK ៖ ផ្លូវ Android (`ZoeDevice`) មិនប្រែ (APK 2.50.53 build ដោយ workflow ពេល merge ដូចធម្មតា)។
៤. ZoeKeyGen ៖ បើកម្តង ➜ កំណែ `2.24.14` ក្នុងប្រអប់ចូល · បញ្ជី Key ➜ «⏳ បន្ថែម» ➜ អត្ថបទថ្មី (គ្រឿងថ្មី/Reset Activate បានរហូតដល់ថ្ងៃថ្មី)។ គ្មានការសាកពិសេសសម្រាប់ការកែធុងសំរាម
   (កើតតែពេលឧបករណ៍ ២ កែអតិថិជនដដែលព្រមគ្នា) ➜ ពិនិត្យ Sentry `zone: money` ក្រោយ Deploy ដូចធម្មតា។
៥. ឧបករណ៍ដែលចូលហាងច្រើន (Supabase ៖ គណនីហាងផ្សេង · Firebase ៖ Reconfig) ៖ ក្រោយ update ការកំណត់ API ស្វែងរកអតិថិជន/តារាងអតិថិជន និង «នាំចូល Excel ទៅ Sheet» ចាស់
   ចងទៅហាងដែលបើកមុនគេ ➜ ក្នុងហាងនីមួយៗ ☰ ➜ «API ស្វែងរកអតិថិជន» · «នាំចូល Excel ទៅ Sheet» ➜ ពិនិត្យ/កំណត់ម្តងទៀត។ ឧបករណ៍ហាងតែមួយ ៖ គ្មានអ្វីត្រូវធ្វើ។
   ⚠️ **ហាង ZTO** ៖ ហាងដែលមិនទាន់កំណត់ API ZTO លើឧបករណ៍នេះ មិនរង់ចាំបញ្ជី «ចុះហត្ថលេខា» មុនការសម្អាត ៨ ថ្ងៃ (លើកលែងតែឧបករណ៍ ZTO ផ្សេងក្នុងហាងនោះកំពុងអាន ៖
   សញ្ញាហាង `zto_signed_sweep`) ➜ កំណត់ API ZTO ក្នុងហាងនោះភ្លាមក្រោយ update។
   Push ៖ ចូលហាង B ➜ 🔔 ➜ 📲 នៅ «បើក» · ដំណឹង «ជិតផុតកំណត់» មកពីហាង B តែប៉ុណ្ណោះ។
៦. ZTO ៖ គ្មាន env ថ្មី ➜ ក្រោយ Deploy ប្រើ Lookup ធម្មតា · ពេល Cookie មួយត្រូវ ZTO បដិសេធ ហើយ Sync ថ្មី ➜ 🩺 ជួរ ZTO បង្ហាញ «អាយុ Cookie ក្រោយ Sync ៖ ប្រើបាន … ➜
   បដិសេធនៅ … (ទំនេរ …)»។ ប្រមូល ២–៣ ជីវិត រួចប្រាប់ Claude ដើម្បីវិភាគ (ទំនេរយូរ = ZTO idle timeout · ទំនេរខ្លី = ZTO បិទ session)។ Cookie ដែល Sync ដោយឧបករណ៍ចាស់
   (គ្មាន `syncedAt`) ឬពី env ➜ មិនវាស់ ➜ ប្រើ `sync-zto-cookie` បច្ចុប្បន្ន។

### [2.50.52] — 2026-10-09 · ZoeW + ZoeKeyGen ៖ **model iPhone ពិតពីទំហំអេក្រង់ × pixel ratio × កំណែ iOS · បន្ទាត់ model/serial គ្មាន emoji** (សំណើម្ចាស់គម្រោង ៖ «កែកន្លែងបង្ហាញ model ឧបករណ៍ អោយស្គាល់ model ពិតសម្រាប់ iphone … និងដក emoji ចេញទាំង ២ កន្លែង model និង serial ទាំងក្នុង ZoeKeyGen និង ZoeW»)

**ZoeW `2.50.52`** (`zoew-v314` ➜ `zoew-v315`) · **ZoeKeyGen `2.24.13`** (`zoekeygen-v123` ➜ `zoekeygen-v124`) · គ្មាន rules/migration/env ថ្មី · តំបន់ហាម/ចាក់សោមិនប៉ះ។

#### អ្វីដែលខុសពីមុន

- 📱 **ZoeW (PWA iPhone)** ៖ Safari មិនប្រាប់ model ក្នុង UA ➜ `iphoneModelFromScreen()` ស្គាល់ពី `screen.width × screen.height` (ចំណុច · បង្វិលក៏ដូចគ្នា) × `devicePixelRatio`
  (បង្គត់ ➜ 12 mini ២,៨៨ = ៣) × កំណែ iOS (`IPHONE_MODELS` ៖ iPhone SE ១ ➜ 18 Pro Max · កំណែ iOS ដំបូង និងចុងក្រោយដែលគាំទ្រ) ៖
  `402×874@3` + iOS 26.5 ➜ «iPhone 16 Pro / 17 / 17 Pro» · Home Screen «iOS 26+» ➜ បន្ថែម «18 Pro» · iOS 18.5 ➜ «iPhone 16 Pro» · `420×912@3` ➜ «iPhone Air»។
  ⛔ model ដែលមានអេក្រង់ដូចគ្នាពិតប្រាកដ (ឧ. 14 Pro · 15 · 15 Pro · 16) web បំបែកមិនបាន ➜ បង្ហាញជាក្រុម មិនទាយមួយ · ទំហំមិនស្គាល់ (Display Zoom «Larger Text» ឧ. `320×693@3` ·
  model ថ្មីមិនទាន់ក្នុងតារាង · iPhone Duo) ➜ «iPhone» ដូចមុន។ ⚠️ ព្រំដែនដែលទទួលស្គាល់ ៖ iPhone Pro Max ដែលបើក Display Zoom រាយការណ៍ `375×812@3` ដូច 11 Pro / 12 mini / 13 mini
  ➜ ស្លាកក្រុមតូចនោះ (Serial នៅតែត្រឹមត្រូវ — វាជាអត្តសញ្ញាណពិតរបស់កៅអី)។ model ផ្ញើទៅកៅអី License តាម `setDeviceMeta()` ដដែល (ស្លាកវែងបំផុត ៤៩ តួ ≤ ៨០ របស់ rules)។
- ✂️ **ZoeW ☰ · 🩺** (`DeviceInfoLine`) ៖ «<model> · <ប្រព័ន្ធ>» និង «Serial (…) ៖ <លេខ>» ជាអក្សរសុទ្ធ (គ្មាន 📱 · 🔖)។
- ✂️ **ZoeKeyGen បញ្ជីកៅអី** (`seatDeviceLabel()`) ៖ `d1 · <model> · <ប្រព័ន្ធ> · Serial <លេខ> · ចងនៅ <ថ្ងៃ>` (គ្មាន 📱 · 🔖 · serial មានស្លាក «Serial»)។
  ស្លាក/ប៊ូតុង «📱 n/max» · «📱 ចំនួនឧបករណ៍» មិនប្រែ (មិនមែនបន្ទាត់ model/serial)។
- 🌐 **ZoeKeyGen ៖ Firebase SDK ផ្ទុកមិនទាន់ពេលបើក ➜ App ភ្ជាប់ឡើងវិញដោយខ្លួនឯង** (deep audit · ផ្នែក ២ «Deep audit ៤») ៖ `isDatabaseInitialized`
  ត្រូវបានអាន ៤ កន្លែង (`armLateFirebaseSdkListener` · `scheduleFirebaseSdkRetry` ×២ · `retryFirebaseSdkNow`) តែ **មិនដែលប្រកាស** ➜ `ReferenceError` ➜ ជណ្តើរព្យាយាម ·
  SDK ដែលមកយឺត · handler `online` ដាច់ស្ងាត់ ខណៈ toast ថា «កំពុងព្យាយាមម្តងទៀត...» ➜ ឥឡូវប្រកាស + កំណត់ `true` ពេល `initFirebase()` ជោគជ័យ។
- 🔐 **ZoeKeyGen ៖ ប្តូរ Config ➜ auth ចាស់មិនរំខានសម័យថ្មី** (ផ្លូវបងប្អូនធៀប ZoeW) ៖ `initFirebase()` ផ្តាច់ listener auth ចាស់ · លុបពិដាន ៨ វិ. · ឡើង `authGeneration` **មុន**
  `deleteApp()` (Firebase បញ្ជូន callback `null` ក្រោយ `deleteApp` ➜ បើកប្រអប់ចូល · `sbAdminReset()` លើ admin ដែលចូលរួច) · `setupAuthListener()` រក្សាពិដានតែមួយ
  (`authRecoveryTimeout`) ➜ ការហៅលើកទី ២ មុន auth ឆ្លើយ មិនទុកពិដានចាស់ដែលលុប IndexedDB Firebase + reload លើ admin ដែលចូលរួចទេ។
- 🔑 **ZoeKeyGen ៖ បិទប្រអប់ PIN ខណៈ Generate Key ➜ ប៊ូតុង Generate មិនស្លាប់ · Signing Key ផុតពេលទំនេរបានវិញ** (deep audit) ៖ `closeModal('pinModal')` (បោះបង់ ឬ
  PIN ត្រូវ សម្រាប់ ⚙️ Config …) និង `initFirebase()` ធ្វើឲ្យ session រសើបអស់សុពលភាព ➜ `generateLicenseKey()` បញ្ចប់ដោយមិនបង្ហាញ Key (ដូចមុន) តែ `finally` ក៏ពិនិត្យ session ដែរ ➜
  `isGeneratingKey` ជាប់ `true` · ប៊ូតុង «កំពុងបង្កើត...» រហូតដល់ចាកចេញ ហើយ `expireIdleSigningKey()` (បដិសេធពេល `isGeneratingKey`) មិនដក Signing Key ចេញពីសតិទៀតទេ ➜
  ឥឡូវសោ Generate មានម្ចាស់ (`generateKeyOwner` ដូច `noticeSendOwner`) ➜ សំណើដែលចាក់សោជាអ្នកដោះ · សំណើចាស់មិនដោះសោរបស់សំណើថ្មី។
- 🔑 **ZoeKeyGen ៖ បិទប្រអប់ PIN កណ្តាលការកែ Key ➜ លទ្ធផល និង ✅ នៅបង្ហាញ** (deep audit · ថ្នាក់ដូចផ្ទាំង Supabase ខាងក្រោម) ៖ Generate · Extend · Revoke ·
  ចំនួនឧបករណ៍ · ដោះឧបករណ៍ · ផ្ញើ/លុបដំណឹង ពិនិត្យជំនាន់ session រសើប (`isSensitiveSessionCurrent`) ក្រោយ `await` ➜ `closeModal('pinModal')` (ឧ. ⚙️ Config ហើយបោះបង់) ឡើងជំនាន់នោះ ➜
  ការសរសេរចុះ DB ពិត តែ App **ស្ងាត់** ៖ Key ដែល Generate ចុះក្នុង DB តែមិនបង្ហាញ (Key ខ្មោចក្នុងបញ្ជី ➜ អ្នកលក់ Generate ម្តងទៀត) · គ្មាន ✅ · បញ្ជីមិន Refresh ➜ ឥឡូវ
  `adminOperationIsCurrent()` = អ្នកប្រើ ZoeKeyGen ដដែល (`uid` · `adminOwnerIsCurrent()` ដែលផ្ទាំង Supabase ប្រើ) + `authGeneration` ដដែល ➜ ការចាកចេញ ឬចូលវិញ (គណនីដដែល) នៅតែបោះលទ្ធផលចោល ·
  ប្រតិបត្តិការសម្ងាត់ (Load/ស្តារ Signing Key · keypair · ចងក្រយៅដៃ · Clipboard) រក្សា `isSensitiveSessionCurrent()` ដដែល។
- 🏪 **ZoeKeyGen ៖ បិទប្រអប់ PIN ក្រោយចូល Supabase Admin ➜ ផ្ទាំង «🏪 ហាង Supabase» នៅប្រើបាន** (deep audit) ៖ `sbAdminIsCurrent()` ពិនិត្យជំនាន់ session រសើប
  ដែលចាប់ពេលចូល Supabase ➜ `closeModal('pinModal')` (ឧ. ⚙️ Config) · `clearSigningKey()` · Signing Key ផុតពេលទំនេរ ឡើងជំនាន់នោះ ➜ ផ្ទាំងនៅបង្ហាញ តែប៊ូតុង
  បង្កើតហាង · ចេញកូដអញ្ជើញ · ពន្យារ · បិទ/បើក · កូដប្តូរពាក្យសម្ងាត់ · 🔄 Refresh **return ស្ងាត់** (គ្មានសារ) រហូតដល់ចាកចេញពី Supabase ហើយចូលម្តងទៀត ➜ ឥឡូវ
  `adminOwnerIsCurrent()` = អ្នកប្រើ ZoeKeyGen ដដែល (`uid`) + UI ចូលរួច · session ផ្ទាំងដដែល (`sbAdminSession`) ➜ ការចាកចេញពី ZoeKeyGen នៅតែសម្អាតផ្ទាំងតាម
  `showLoginModalWithPrefill()` ➜ `sbAdminReset()` ដូចមុន។
- 🧰 **ZoeW ៖ Deploy ថ្មីចូលផ្សាយកណ្តាល install របស់ Service Worker ➜ App មិនស** (deep audit · «មិនទាន់វាស់ ៖ install `addAll` ពេល deploy ជាន់» ក្នុង Handoff) ៖
  asset ឈ្មោះ hash របស់ deploy ចាស់លែងមាន ➜ Netlify (`/* ➜ /index.html 200`) ឆ្លើយ `index.html` ➜ `cache.addAll()` (status ok) រក្សា HTML ក្រោម key JS ចម្បង ➜
  SW activate ➜ cache-first ផ្តល់ HTML ជំនួស JS ➜ App ស រហូតដល់ SW បន្ទាប់ (ច្បាប់ `responseFitsKey()` មានតែលើ fetch/ការធ្វើឲ្យស្រស់ មិនលើ install) ➜ ឥឡូវ
  `shellEntriesFit()` ពិនិត្យ CORE ក្រោយ `addAll` ➜ HTML ក្រោម key មិនមែន HTML ➜ install ធ្លាក់ (browser សាក sw.js ថ្មីពេលក្រោយ) · OPTIONAL ដែលទទួល HTML ត្រូវលុបចេញពី
  cache (SW នៅ activate · fetch ពេលប្រើពីបណ្តាញ)។
- 🧰 **ZoeW + ZoeKeyGen ៖ ឯកសារគ្មាន hash ពី deploy ២ មិនលាយក្នុង cache តែមួយ** (ម្ចាស់គម្រោង «កែទាំងអស់» · ព្រំដែនដែលនៅសល់ពីធាតុខាងលើ) ៖ `index.html` ·
  `boot-flags.js` · vendor · ZoeKeyGen ទាំងមូល មានឈ្មោះដដែលគ្រប់ deploy ➜ deploy ថ្មីចូលផ្សាយកណ្តាល install ➜ cache កំណែ N ផ្ទុកឯកសារ N+1 លាយ N (ក្រៅបណ្តាញ
  `index.html` ថ្មីយោង asset ដែលគ្មានក្នុង cache) រហូតដល់ SW បន្ទាប់ ➜ ឥឡូវ ក្រោយ cache ពេញ `deployUnchangedDuringInstall()` អាន sw.js ដែលកំពុងផ្សាយ ៖ `CACHE_VERSION` ផ្សេង ➜
  install ធ្លាក់ (browser install sw.js ថ្មីពេលពិនិត្យបន្ទាប់) · អានមិនបាន ឬព្យួរលើស `INSTALL_DEPLOY_CHECK_TIMEOUT_MS` (១០ វិ.) ➜ ទទួល (មិនមែនភស្តុតាងថាប្តូរ)។ ចំណាយ ៖
  ការស្នើ sw.js ១ ដង/install (conditional `no-cache`)។
- 💱 **ZoeW ៖ រក្សាអត្រាប្រាក់ព្យួរ ➜ ប្តូរ Config/backend ➜ ប៊ូតុង «រក្សាទុកអត្រាប្រាក់» ដើរវិញ** (deep audit) ៖ `exchangeRateSaveInFlight` រស់រានឆ្លង logout ដោយចេតនា
  («settle ក្នុង late handler») តែវាស់លើ Firebase SDK ពិត (emulator) ៖ `set()` ដែលរង់ចាំ offline **មិន settle ទាល់តែសោះ** ក្រោយ `deleteApp()` ➜ late handler មិនរត់ ➜
  សោជាប់ ➜ ចុចរក្សាទុក return 'pending' ស្ងាត់ (គ្មាន toast · ប្រអប់មិនបិទ) រហូតដល់ reload ➜ ឥឡូវ teardown ក្នុង `initFirebase()` ដោះសោនេះ (ការសរសេរចាស់ស្លាប់ជាមួយ App ចាស់)។
- 🔎 **ZoeW ៖ កំពុងស្វែងរកលេខ ហើយអូសបញ្ជី ➜ ប្រអប់ស្វែងរកមិនបាត់** (រាយការណ៍ម្ចាស់គម្រោង ៖ រូប + «PWA iOS ពេលកំពុងស្វែងរក scroll list ទៅក្រោម បាត់ប្រអប់ស្វែងរក» ·
  តំបន់ហាមឃាត់ ➜ វាស់ iOS និង Android ដោយផ្ទាល់) ៖ ទ្វារ ២ ដែលបង្កើតរោគសញ្ញាដូចគ្នាលើ **iOS និង Android** ៖ (ក) keyboard បើក · លទ្ធផលតិច (តារាងរមូរមិនបាន) ➜ ការអូសហូរទៅ
  `#appPages` ➜ snap `proximity` ឈប់ត្រឹមក្បាល `.page-main` ➜ កាតស្វែងរកនៅក្រោម navbar · (ខ) keyboard បិទតែលេខនៅ (ប្រអប់នៅហូតឡើង) ➜ អូសឡើង = បង្រួមផ្ទាំងទាំងមូល
  (`phoneSearchIsActive()` រាប់តែវាលដែល focus) · ហើយ (គ) បញ្ជីវែង ៖ ជួរចុងក្រោយនៅក្រោមអេក្រង់ (កាតបញ្ជីកម្ពស់ពេញអេក្រង់ ចាប់ផ្តើមក្រោមកាតស្វែងរក ➜ លើស ~៩៦px) ➜ ឥឡូវ
  ពេលប្រអប់ហូតឡើង កាតបញ្ជីយកតែកន្លែងនៅសល់ក្រោមកាតស្វែងរក (`react-root.css` ៖ `.app-pages` `overflow-y: hidden` · ទំព័រសកម្ម `height: 100%` · `.page-main` `flex: 1 1 0` ដូច
  `history-expanded` ➜ `#appPages` គ្មានអ្វីរមូរ ➜ គ្មានការហូរ គ្មាន snap) · `phoneSearchIsActive()` រាប់ `dataPanelSearchFocus` ដែរ ➜ ច្បាប់ «អូសឡើងមិនបិទផ្ទាំងពេលកំពុងស្វែងរក»
  ពិតទាំង keyboard បិទ។ ដំណោះស្រាយដំបូង (snap `mandatory` តែត្រឹមកាតស្វែងរក) ទុកប្រអប់បាន តែវាស់ឃើញជួរចុងក្រោយនៃបញ្ជីវែងកាត់ពាក់កណ្តាល ➜ បោះបង់។
  បញ្ជីវែងនៅរមូរខ្លួនឯងដូចដើម · ចុចដងអូសនៅបង្រួមបាន (ចេតនាច្បាស់) · អូសចុះនៅទាញប្រអប់ចុះវិញ។ សោតំបន់ហាម ៖ `panel-motion.ts` sha256 ថ្មីក្នុង `LOCK` (សំណើម្ចាស់គម្រោង ·
  ហេតុផលខាងលើ)។
- 💰 **ZoeW ៖ ឧបករណ៍ ២ សម្អាតកញ្ចប់ដដែលស្របគ្នា ➜ ធុងសំរាម ១ · ដកលុយ ១ ដង** (ម្ចាស់គម្រោង «កែទាំងអស់» · ផ្នែក ២ «ការដកពាក់កណ្តាល + `disconnect`») ៖
  ឧបករណ៍ X claim barcode ដែលទុំ (commit ធម្មតា) · ឧបករណ៍ Y ផ្ញើពីទិដ្ឋភាពមុន X ហើយចម្លើយបាត់ ➜ ការអាន server ឃើញតម្លៃនៅសល់ដូចដែល Y ផ្ញើ ➜ `applied` ទោះ Y មិនមែនអ្នកដក ➜
  (ក) ការដកពាក់កណ្តាល ៖ id ធុងសំរាមចៃដន្យ ➜ ធុងសំរាម ២ ច្បាប់ + ដក ២ ដង ពេលធុងសំរាមរបស់ X មិនទាន់មកដល់ទិដ្ឋភាព Y · (ខ) ទាំងមូល និងពាក់កណ្តាល ៖ X សរសេរធុងសំរាមដោយ
  overwrite ➜ បើ Y កាន់ slot មុន X ការសរសេររបស់ X ជាន់ច្បាប់ Y ហើយដកម្តងទៀត ➜ ឥឡូវ ការ claim ពាក់កណ្តាលមាន id កំណត់ (`cleanupPartialTrashId()` ៖ ម៉ោង item + token នៃ
  item · មូលហេតុ · barcode ដែល claim ជាមួយ `closedAt`/`restoredAt`) · ការសរសេរធុងសំរាមនៃការសម្អាត **ទាំងអស់** ឆ្លង slot create-if-absent (`claimCleanupTrashSlot()` ៖
  commit ឬ slot មានច្បាប់របស់យើង (`deletedAt` ដដែល) = របស់យើង) · journal ចាប់ផ្តើមនៅ `slot` ➜ ដកតែម្តង មិនថាលំដាប់ណា។ ព្រំដែនដែលទទួលស្គាល់ ៖ ច្បាប់ចាស់ក្នុង slot ពីវដ្តមុន
  (ការសរសេរធុងសំរាមធ្លាក់គ្រប់ការសាក តែចុះយឺត ហើយត្រូវស្តារចូលប្រវត្តិវិញ) ➜ ការ claim ដដែលបន្ទាប់មិនដក (ចំណូលខ្ពស់ មិនដក ២ ដង)។
- 📲 **ZoeW ៖ Server ប្តូរកូនសោ VAPID ➜ PWA ចុះឈ្មោះ push ឡើងវិញ** (រាយការណ៍ម្ចាស់គម្រោង ៖ «លុប env ហើយដាក់វិញ … ក្នុង app ឃើញការជូនដំណឹងពី ZoeKeyGen
  គ្រាន់វាមិនលោត notification ពេលចេញពី app») ៖ `resyncPush()` ផ្ញើ subscription ដែលមានស្រាប់ឡើងវិញដោយមិនពិនិត្យថា `applicationServerKey` របស់វាស្មើកូនសោ server
  ឥឡូវ ➜ ក្រោយប្តូរ `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` server រក្សា subscription ចាស់ (ការផ្ញើធ្លាក់ `fail`) ខណៈ 🔔 បង្ហាញ «បើក» ➜ ស្ងាត់រហូតដល់អ្នកប្រើបិទ/បើកដោយដៃ។
  ឥឡូវ ៖ ការ resync លើកដំបូងក្នុងទំព័រ (ពេលបើក App) ទាញ `?op=config` ម្តង ➜ កូនសោខុស ➜ `unsubscribe()` + ជាវថ្មីដោយកូនសោថ្មី + ផ្ញើ endpoint ថ្មី · ជាវមិនបាន
  (Safari ទាមទារការចុច) ➜ ស្ថានភាព «បិទ» ដោយស្មោះ · កូនសោដូចគ្នា ➜ គ្មាន POST (ពិនិត្យតែម្តង/ទំព័រ មិនមែនរាល់ `visibilitychange`)។
- 📲 **ZoeW ៖ ការចុះឈ្មោះ push ដែលធ្លាក់ ឬបាត់ពី server ➜ ចុះឈ្មោះឡើងវិញដោយខ្លួនឯង** (ម្ចាស់គម្រោង ៖ APK «ដើរហើយ» តែក្រោយ 🔔 ➜ 📲 បិទ ➜ បើក) ៖
  `PUSH_RESYNC_MS` ២៤ ➜ **៦ ម៉ោង** (server បាត់ការចុះឈ្មោះបាន ៖ token FCM ប្តូរខណៈ App បិទ · ពិដាន `PUSH_SUBS_PER_KEY_MAX` ១០/Key ដកចាស់ចេញ ➜ ការបើក App
  បន្ទាប់ចុះឈ្មោះឡើងវិញ) · ចម្លើយ server មិន `ok` (ឧ. ៥០៣ ពេល env បាត់) ➜ កត់ `failedAt` ➜ resync សាកម្តងទៀតក្រោយ `PUSH_RESYNC_RETRY_MS` (១៥ នាទី) ទោះ sync
  ជោគជ័យចុងក្រោយថ្មី ⛔ មិនសាករាល់ `visibilitychange` · ទាំង APK (`onNativeToken`) និង web។ ចំណាយ ៖ ≤ ៤ POST/ថ្ងៃ/ឧបករណ៍ (តែពេលបើក App)។

#### អ្នកយាម

- `ZoeW/tests/device-info.test.tsx` ៖ តារាង ៣០ ករណី (ក្រុម · តម្រង iOS · Home Screen 26+ · បង្វិល · DPR ២,៨៨ · ទំហំមិនស្គាល់ ➜ `''` · តម្លៃខូច) · ស្លាកគ្រប់ទំហំ ≤ ៨០ ·
  គ្មានឈ្មោះស្ទួន · `loadDeviceInfo()` ពិតផ្ញើ model ក្រុមទៅ License · `DeviceInfoLine` គ្មាន emoji (`\p{Extended_Pictographic}`) ➜ មុនកែ ៤/១៦ ធ្លាក់ · ក្រោយកែ ១៦/១៦។
- `keylist-consistency-test` ៖ បន្ទាត់កៅអីទាំង ៣ គ្មាន emoji · serial មានស្លាក «Serial» ➜ មុនកែ ២ ធ្លាក់ (`📱 d1 · … · 🔖 1a2b…`) · ក្រោយកែ ៥០/៥០។
- `function-surface-test` ផ្នែកថ្មី ៖ ឈ្មោះដែលអានតែគ្មានការប្រកាសក្នុង script ធម្មតា (eslint-scope លើ `<script src>` ពិតរបស់ index.html ទាំង ២ App + `ZoeKeyGen/sw.js`) ·
  `sdk-offline-boot-test` ផ្នែក ៣ ៖ ZoeKeyGen ក្នុង Chromium ពិត · `connection-recovery-test` ៖ sandbox លែងប្រកាស `isDatabaseInitialized` ជំនួស App ➜ មុនកែ ទាំង ៣ ក្រហម ·
  ក្រោយកែ ២៧/២៧ · ២៣០/២៣០ · ២៤/២៤។
- `ZoeW/tests/push-client.test.tsx` ៖ កូនសោ VAPID ប្តូរ ➜ ជាវថ្មី + endpoint ថ្មី · ជាវមិនបាន ➜ «បិទ» គ្មាន POST · ទិសផ្ទុយ ៖ កូនសោដូចគ្នា ➜ គ្មាន POST · config ១ ដង/ទំព័រ ➜
  មុនកែ ៣ ធ្លាក់ · ក្រោយកែ ៤៤/៤៤ · ការចុះឈ្មោះធ្លាក់/បាត់ ៖ ពិដាន resync ≤ ៦ ម៉ោង · APK ៧ ម៉ោង ➜ `PN.register` · ៥០៣ ➜ `failedAt` + សាកក្រោយ ១៥ នាទី (មិនមុន) ·
  web ធ្លាក់ ➜ មិនសាករាល់ការហៅ ➜ ក្រោយ ១៥ នាទីជោគជ័យ ➜ មុនកែ (`b01f5cf`) ៤ ធ្លាក់ · ក្រោយកែ ៤៨/៤៨។
- `keygen-session-security-test` ៖ `closeModal('pinModal')` ពិតកណ្តាល Generate (ដំណាក់កាលម៉ោង Server · ការសរសេរ) ➜ សោដោះ · ប៊ូតុងប្រើបាន · Generate បន្ទាប់បង្ហាញ Key ➜
  មុនកែ ៤ ធ្លាក់ (`isGeneratingKey: true · disabled: true`) · ក្រោយកែ ១២៩/១២៩ · បិទប្រអប់ PIN កណ្តាល Generate ➜ Key បង្ហាញ · កណ្តាលការសរសេរ Extend · Revoke · ចំនួនឧបករណ៍ ·
  ដោះឧបករណ៍ ➜ ✅ + Refresh · ទិសផ្ទុយ ៖ ចាកចេញ ➜ ចូលវិញ (គណនីដដែល) ➜ គ្មាន ✅ · ការក្លែងការចាកចេញធ្វើដូច `logoutApp()` ពិត (`authGeneration++` · `invalidateSensitiveSession()` ·
  `isSignedInUiActive = false`, អះអាងលើកូដពិត) ➜ មុនកែ ៦ ធ្លាក់ · ក្រោយកែ ១៤២/១៤២ · `keygen-notice-test` ៖ បិទប្រអប់ PIN កណ្តាលការផ្ញើ/លុបដំណឹង ➜ ✅ + ទាញបញ្ជី ➜ មុនកែ ២ ធ្លាក់ ·
  ក្រោយកែ ៨៣/៨៣។
- `keygen-supabase-admin-test` ៖ `closeModal('pinModal')` ពិតក្រោយចូល Supabase ➜ 🔄 Refresh អានបញ្ជីហាងពិត · បង្កើតហាងបន្ទាប់ចុះ DB ➜ មុនកែ ១០ ធ្លាក់ (ការបង្កើតហាង ·
  កូដអញ្ជើញ · បញ្ជី · XSS ទាំងអស់ return ស្ងាត់) · ក្រោយកែ ១០២/១០២ (Postgres ពិត)។
- `sw-install-integrity-test` ជុំទី ៧ · ៧ខ (browser ពិត · build ពិត · deploy ជាន់មុនផ្ទុកទំព័រ ព្រោះ App ចុះឈ្មោះ sw.js ខ្លួនឯង) ៖ JS ចម្បងទទួល `index.html` ➜ install ធ្លាក់ ·
  ម៉ាស៊ីនបម្រើធម្មតា ➜ install ដដែល activate ជាមួយ JS ពិត · OPTIONAL ទទួល HTML ➜ activate តែគ្មាន HTML ក្នុង cache ➜ មុនកែ ៤ ធ្លាក់ · ក្រោយកែ ៤៤/៤៤ · checker SW ផ្សេង ៨ បៃតង ·
  ជុំទី ៨ (App ទាំង ២ · ស្របគ្នា) ៖ ការស្នើ script របស់ browser (`Service-Worker: script`) ទទួល sw.js ពិត · ការអានពីក្នុង SW ទទួល sw.js `CACHE_VERSION` ផ្សេង ➜ install ធ្លាក់ ·
  ទិសផ្ទុយ ៖ deploy ដដែល ➜ activate · 503 ➜ activate · ព្យួរ ➜ activate ក្នុងពិដាន (ដេរីវេពី sw.js ពិត) + ៨ វិ. ➜ មុនកែ ៦ ធ្លាក់ · ក្រោយកែ ៥៦/៥៦។
- `ZoeW/tests/exchange-rate-backend-switch.test.ts` ៖ រក្សាអត្រាប្រាក់ព្យួរ (`dbOp` ផុត ➜ 'pending') ➜ `initFirebase()` ប្តូរ Config ➜ ការរក្សាទុកបន្ទាប់ 'done' តាម App ថ្មី · ទិសផ្ទុយ ៖
  គ្មាន teardown ➜ ចុចលើកទី ២ នៅ 'pending' (គ្មានការសរសេរត្រួតគ្នា) ➜ មុនកែ ១ ធ្លាក់ (`'pending'`) · ក្រោយកែ ២/២។
- `ios-panel-glide-test` ផ្នែក ៧ (build ពិត · Android និង iOS · ការអូសដោយម្រាមដៃពិត CDP) ៖ ចុចប្រអប់ ➜ ហូតឡើង · snap ផ្អាកអំឡុងចលនាហូតឡើង · បញ្ជីវែងរមូរខ្លួនឯង ·
  វាយលេខ (លទ្ធផល ១) ➜ អូស ➜ ប្រអប់នៅ · blur តែលេខនៅ ➜ អូសឡើង ➜ មិនបង្រួម · ប្រអប់នៅ · បញ្ជីវែងរមូរដល់ចុង ➜ ជួរចុងក្រោយនៅលើរបា Tab ➜ មុនកែ ៦ ធ្លាក់
  (`pagesTop 97 · cardTop −38` · `collapsed: true` · ជួរចុងក្រោយ ៧៩៥ > ៧១៨) · ក្រោយកែ ៥៦/៥៦ (ការអូសចាប់ផ្តើមកណ្តាលបញ្ជីដែលមើលឃើញ ៖ គែមកាត Android `::after` ចាប់ការចុច) ·
  `phone-search-swipe-test` ៖ ប្រអប់ហូតឡើង · keyboard បិទ · លេខនៅ ➜ អូសឡើងមិនបង្រួម (ទិសផ្ទុយ ៖ មិនស្វែងរក ➜ បង្រួម) ➜ មុនកែ ១ ធ្លាក់ · ក្រោយកែ ៧១/៧១ ·
  `history-window-check` (`native:check` · APK · PWA Android · PWA iPhone) ៖ ជំហាន [2.50.51] «រមូរប្រអប់ស្វែងរកចូលក្រោមរបាខាងលើ ➜ suggestion បិទ» លែងកើតបាន (ប្រអប់ហូតឡើង =
  `#appPages` គ្មានអ្វីរមូរ) ➜ ប្តូរជាការធានាថ្មី ៖ `scrollTop = 500` មិនរុញប្រអប់ចូលក្រោមរបាខាងលើ · suggestion នៅបើកជាប់ក្រោមប្រអប់ (មិនអណ្តែតដាច់ ៖ គោលបំណងនៃសំណើ [2.50.51]) ➜
  មុនកែ ៣ ធ្លាក់ · ក្រោយកែ ០ · ច្រកសុវត្ថិភាព «ប្រអប់ចេញពីផ្ទៃដែលមើលឃើញ ➜ suggestion បិទ» (navbar · visual viewport) នៅវាស់ក្នុង `phone-suggest-test` ·
  អ្នកយាមតំបន់ហាមផ្សេង (`gesture-test` ១៣០ · `panel-motion-test` ១០៧ · `panel-snap-ownership-test` ៣០ · `page-nav-test` ៥៥) បៃតងលើ build ដែលកែ។
- `money-guardian-test` ៖ mutation «ការសម្អាតក្រោយ `disconnect` មិនពិនិត្យថាឧបករណ៍ផ្សេងដកលុយរួច» ផ្លាស់ទៅ slot (`(current) => (current ? undefined : trashItem)` ➜ សរសេរជាន់) ព្រោះ
  ខ្សែយុថ្កាចាស់ (`if (result.txOutcome === 'applied') {`) លែងមាន · `tx-outcome-test` ចាប់វា (ថ្ងៃ ៩២.២៥ ជំនួស ១០០) · mutation «អ្នកស្តារបញ្ចប់ការសម្អាតដែល *នៅរស់*»
  (ដក `cleanupJournalLive.has()`) រួចខ្លួន ព្រោះ journal ចាប់ផ្តើមនៅ `slot` ➜ អ្នកស្តារឆ្លងកាត់ `resolveCleanupSlot()` ហើយ harness មិនធ្វើសមកាលកម្មទិដ្ឋភាពប្រវត្តិ (id នៅ ➜ «elsewhere»)
  ➜ `cleanup-interrupt-atomicity-test` ៥ជ ធ្វើសមកាលកម្មទិដ្ឋភាពដូច listener ពិត ➜ mutant ៖ អ្នកស្តារកាន់ slot (`deletedAt` ដដែល = របស់យើង) ហើយដកលើកទី ២ លើផ្លូវ legacy
  (២១៤.១) ➜ ចាប់បានវិញ · tree ស្អាត ៨២/៨២ ➜ ការពិនិត្យសោរស់នៅតែជាការការពារចាំបាច់។
- `ZoeW/tests/cleanup-applied-ownership.test.ts` ១២–១៩ ៖ ឧបករណ៍ ២ ក្នុងហាងដដែល (store រួម · ទិដ្ឋភាពដាច់) ៖ ពាក់កណ្តាល abandon/close ៖ X ចប់មុន · Y `applied` ពីទិដ្ឋភាពមុន
  (លក្ខខណ្ឌ ៖ តម្លៃនៅសល់ដែល Y ផ្ញើ = server) ➜ ធុងសំរាម ១ · ដក ១ ដង · X commit តែការសរសេរធុងសំរាមព្យួរ · Y សរសេរមុន ➜ X មិនជាន់ (ពាក់កណ្តាល និងទាំងមូល) · id ៖ លំដាប់ barcode
  មិនប្តូរ id · `restoredAt`/`closedAt`/មូលហេតុ/សំណុំ/item ផ្សេង ➜ id ផ្សេង · ស្តារហើយ claim ម្តងទៀត ៦ ជុំ ➜ ប្រវែងដដែល (≤ ៦៤) · `ded/<trashId>` ចងនឹង id កំណត់ ➜ មុនកែ ៤ ធ្លាក់
  (ធុងសំរាម ២ · ចំណូល ៨០ ជំនួស ៩០) · ក្រោយកែ ១៩/១៩ · ធាតុ ៦ (ការ claim ធម្មតាឆ្លង slot មិនមែន overwrite) ប្តូរតាមច្បាប់ថ្មី · `cleanup-journal-cap.test.ts` ព្យួរទ្វារ slot ដែរ
  (មិនដូច្នោះការព្យួរដែលវាពិពណ៌នាមិនកើត) · checker sandbox (`partial-pickup-cleanup` · `cleanup-interrupt-atomicity` · `ledger-count-integrity` · `stall-lock-release` ·
  `late-commit` · `db-stall-guard` · `restore-marker-hygiene` · `tx-outcome` · `policy-test` · `emu/crud-rules-flow`) ស្រង់ helper ថ្មី (មិនមាន tree ចាស់ ➜ stub) ហើយ fake
  ព្យួរ/ចាំទ្វារ slot ដូចទ្វារ `update`។
- `connection-recovery-test` ៖ ZoeKeyGen Reconfig មាន App ចាស់ ➜ auth ផ្តាច់ + ជំនាន់ឡើងមុន `deleteApp` · `setupAuthListener()` ២ ដង + auth ឆ្លើយលើ listener ថ្មី ➜
  ពិដានចាស់មិនបាញ់ (ទិសផ្ទុយ ៖ គ្មាន auth ➜ ការស្តារ ១ ដង) ➜ មុនកែ ២ ធ្លាក់ (`authOffAtDelete: false` · `recoveries: 1`) · ក្រោយកែ ២៣៥/២៣៥។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Merge ➜ Deploy ZoeW + ZoeKeyGen (គ្មាន rules · migration · env ថ្មី)។
2. iPhone (App លើ Home Screen) ៖ បើក ☰ ➜ ខាងក្រោមឃើញ «iPhone <model ឬក្រុម> · iOS …» និង «Serial (ID App) ៖ …» គ្មាន emoji · ពិនិត្យ Key ម្តង (បើក App ធម្មតា) ➜ ZoeKeyGen
   បញ្ជី Key ➜ បន្ទាត់កៅអី «d1 · iPhone … · iOS … · Serial … · ចងនៅ …»។ ⚠️ បើបង្ហាញត្រឹម «iPhone» ៖ Settings ➜ Display & Brightness ➜ Display Zoom ➜ Default (Larger Text ប្តូរទំហំអេក្រង់) ·
   ឬ model ថ្មីមិនទាន់ក្នុងតារាង ➜ ផ្ញើ `screen.width × screen.height × devicePixelRatio` មក។
3. ZoeKeyGen (ជម្រើស) ៖ បិទ Wi-Fi/ទិន្នន័យ ➜ បើក ZoeKeyGen ➜ ឃើញ «⚠️ ភ្ជាប់ Server មិនបានទេ … កំពុងព្យាយាមម្តងទៀត...» ➜ បើកបណ្តាញវិញ ➜ ក្នុង ~៥–៣០ វិ.
   App ភ្ជាប់/ផ្ទុកឡើងវិញដោយខ្លួនឯង (មិនបាច់ចុច Refresh)។
4. Push ៖ ពិនិត្យតាម `ZoeW/README.md` ផ្នែក «ពិនិត្យពេលដំណឹងបង្ហាញក្នុង 🔔 តែមិនលោតពេលចេញពី App» ៖ `…/.netlify/functions/push?op=config` ➜ `web`/`fcm` = `true` ·
   ⛔ ក្រោយកែ env ក្នុង Netlify ➜ **Trigger deploy** · Logs ➜ Functions ➜ `push-cron` ➜ `reason`/`sent`/`fail` · iPhone ដែលបង្ហាញ «បិទ» ក្រោយ update ➜ ចុចបើកម្តងទៀត។
5. ZoeKeyGen (ជម្រើស) ៖ ចូល «🏪 ហាង Supabase» ➜ ចុច ⚙️ (ប្រអប់ PIN) ហើយបោះបង់ ➜ 🔄 Refresh / បង្កើតហាង នៅដើរ (មិនស្ងាត់) · Generate Key ហើយបើក/បិទប្រអប់ PIN ពេលកំពុងបង្កើត ➜
   ប៊ូតុង «🔐 Generate Key» ត្រឡប់មកប្រើបាន ហើយ Key ដែលបានបង្កើតបង្ហាញ · Extend/Revoke Key ហើយបិទប្រអប់ PIN ពេលកំពុងរក្សាទុក ➜ ឃើញ ✅ និងបញ្ជីថ្មី។
6. ⛔ **ZoeW ៖ សាកលើ iPhone (App លើ Home Screen) និង Android ពិតមុន merge** (តំបន់ហាមឃាត់ ៖ ការរមូរ · ផ្ទាំង) ៖ ទំព័រទិន្នន័យ ➜ ចុចប្រអប់ស្វែងរកលេខ ➜ វាយលេខដែលមានតែ
   ១–២ នាក់ ➜ អូសបញ្ជីឡើង/ចុះ ➜ ប្រអប់ស្វែងរកនៅ · ចុច «Done»/បិទ keyboard ➜ អូសបញ្ជីឡើង ➜ ប្រអប់នៅ (ផ្ទាំងមិនបង្រួម) · វាយលេខខ្លី (លទ្ធផលច្រើន) ➜
   រមូរដល់ចុង ➜ ជួរចុងក្រោយឃើញពេញ · លុបលេខ ឬអូសចុះ ➜ ប្រអប់ត្រឡប់ចុះ ·
   មិនស្វែងរក ➜ អូសឡើងបង្រួមផ្ទាំង · PTR · ការអូសផ្ទាំង · ចលនាហូតឡើង នៅដូចដើម។ ផ្ញើវីដេអូខ្លីមក ប្រសិនបើខុស។
7. ZoeW (ជម្រើស · ហាងដែលមានឧបករណ៍ច្រើន) ៖ ក្រោយ Deploy ពិនិត្យ 🗑️ ធុងសំរាមម្តងម្កាល ៖ កញ្ចប់ «ផុតកំណត់» ពាក់កណ្តាលមិនលេចជា ២ ជួរដូចគ្នា · ចំណូលប្រចាំថ្ងៃមិនធ្លាក់ទ្វេដង។

### [2.50.51] — 2026-10-09 · suggestion បិទពេលប្រអប់លាក់ · emoji scanner មិនលេចចូលកាត · Reduce Motion ទាំងពីរ App

**ZoeW `2.50.51`** (`zoew-v313` ➜ `zoew-v314`) · **ZoeKeyGen `2.24.12`** (`zoekeygen-v122` ➜ `zoekeygen-v123`)។ សំណើម្ចាស់គម្រោង៖ វីដេអូពីរ និងរូប emoji ⚡ លេចចូលតារាង; កែពី branch របស់ PR #307 និងដោះស្រាយ checker ដែលធ្លាក់។

#### អ្វីដែលខុសពីមុន

- **ZoeW**៖ suggestion បិទពេលប្រអប់ស្វែងរកចូលក្រោម navbar ឬចេញពីផ្ទៃដែលមើលឃើញ (រួម visual viewport ពេល keyboard បើក)។ ការទាញផ្ទាំងចុះបិទ suggestion មុនចលនា; ការរមូរខាងក្នុង suggestion និងជ្រើសលេខនៅដដែល។
- **ZoeW**៖ `.page-side` មាន stacking context ផ្ទាល់នៅទំហំទូរស័ព្ទ/ថេប្លេត ដូច្នេះ emoji ⚡ និងធាតុ scanner មិនឆ្លងលើកាតកញ្ចប់/Locker ដែលកំពុងរអិល។ រយៈពេល ខ្សែកោង និង PTR មិនប្រែ។
- **App ទាំងពីរ**៖ toast គោរព Reduce Motion; ZoeKeyGen ប៊ូតុង និង ZoeW drawer ក៏បិទ transition តាមការកំណត់នេះ។
- **PR checker**៖ `phone-suggest-test` ប្រើលេខសំយោគ `011000000`–`011000349` ស៊ីគ្នាទាំង fixture, query និងលទ្ធផលរំពឹង; នៅតែសាកលេខទាំងចុងថ្មី និងចុងចាស់ក្នុងបញ្ជី ៣៥០។

#### អ្នកយាម

- `history-window-check`៖ វាស់ suggestion លាក់/រមូរខាងក្នុង/ជ្រើសលេខ និង `elementFromPoint` លើកាតពេលចលនាចុះ ក្នុង profile APK · Android PWA · iPhone PWA។ មុនកែបញ្ហាទាំងពីរធ្លាក់គ្រប់ profile។
- `boot-animation-test`៖ computed transition របស់ toast និងប៊ូតុងលើ CSS ពិតទាំងពីរ App; Reduce Motion ក្រហមទាំងពីរមុនកែ ខណៈចលនាធម្មតាមានសកម្មភាព។
- `forbidden-zone-lock`៖ ប្តូរស្នាម `phone-search.ts` តាមសំណើវីដេអូនេះ; សោផ្សេងរក្សាដដែល។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- សាកលើ Android និង iPhone ពិតមុន merge៖ រមូរលាក់ប្រអប់ស្វែងរក, ជ្រើសលេខ, បិទ keyboard នៅកាតកញ្ចប់/Locker, អូសផ្ទាំង និង PTR។ Browser profile មិនជំនួសការវាស់ keyboard/compositor លើឧបករណ៍ពិត។
- ក្រោយ merge និង deploy អនុម័ត៖ ធ្វើបច្ចុប្បន្នភាព PWA ទាំងពីរ និង APK ដើម្បីទទួលកំណែនេះ។ គ្មានការប្តូរ database rules ឬ env។

### [2.50.50] — 2026-10-09 · ZoeW + ZoeKeyGen ៖ **ឯកជនភាព ៖ Sentry ទទួលតែ error ដែលលាក់ secret រួច (Session Replay · tracing · logs របស់ Loader បិទ) · CSP `script-src` តឹង · អ្នកយាម security** (សំណើម្ចាស់គម្រោង ៖ «deep audit security ការពារ និងពង្រឹង និង leak secret» · «បង្កើតអ្នកយាមសម្រាប់ security គ្រប់ផ្នែក … ទាំងក្នុង repo និង app»)

**ZoeW `2.50.50`** (`zoew-v312` ➜ `zoew-v313`) · **ZoeKeyGen `2.24.11`** (`zoekeygen-v121` ➜ `zoekeygen-v122`) · គ្មាន rules/migration/env ថ្មី · តំបន់ហាម/ចាក់សោមិនប៉ះ។

#### អ្វីដែលខុសពីមុន

- 🔒 **Sentry** (`error-reporting.js` · byte-identical ×២) ៖ `guardedOptions()` កំណត់ `tracesSampleRate: 0` · `replaysSessionSampleRate: 0` · `replaysOnErrorSampleRate: 0` ·
  `enableLogs: false`។ Loader (`js.sentry-cdn.com/<key>.min.js` ក្នុង `index.html`) ច្របាច់ option របស់ App ពីលើលំនាំដើមដែលកំណត់ក្នុង Sentry UI ➜ មុននេះ option ដែល App
  មិនកំណត់ = លំនាំដើម UI ៖ **Session Replay `0.1/1.0`** (ថត ១០% នៃសម័យ · ១០០% ពេល error) និង **tracing** (span `http.client` មាន URL ពេញ) — ទាំងពីរ **មិនឆ្លង**
  `beforeSend`/`beforeBreadcrumb` ➜ ការលាក់ secret មិនគ្រប។ ឥឡូវផ្លូវទាំង ២ (`tagApp()` តាម `Sentry.onLoad` · `applySentryInit()` តាម DSN) ផ្ញើតែ error event ដែលលាក់រួច។
  ⛔ បន្ទាត់ `options.tracesSampleRate = 0;` ក្នុង `applySentryInit()` ដកចេញ ព្រោះផ្លាស់ទៅ `guardedOptions()` ដែលផ្លូវទាំង ២ ប្រើ (ការលុបដែលមានហេតុផល)។
- 🛡️ **CSP** (App ទាំង ២) ៖ `script-src` `https://www.gstatic.com` ➜ `https://www.gstatic.com/firebasejs/` ➜ script ពីថតផ្សេងលើ www.gstatic.com (ឧបករណ៍រំលង CSP ប្រភេទ
  JSONP/បណ្ណាល័យចាស់) ត្រូវបដិសេធ · Firebase SDK (`firebasejs/12.19.0/…` ក្នុង `firebase-loader.js` · `modulepreload` របស់ ZoeKeyGen) ដើរដដែល · `connect-src`
  (probe `generate_204`) មិនប្រែ។

#### អ្នកយាម

- `sentry-load-race-test` ផ្នែក ៥ (ថ្មី) ៖ Loader ក្លែងច្របាច់ option ពីលើលំនាំដើម UI (Replay `0.1/1.0` · tracing ១ · logs · PII) ➜ មុនកែ **FAIL** ៖
  `onLoad` ➜ `traces 1 · replay 0.1/1 · logs true` · DSN ➜ `traces 0 · replay 0.1/1 · logs true` (ដូច replay ពិតក្នុង Sentry ៖ `sessionSampleRate=0.1, errorSampleRate=1`) ➜
  ក្រោយកែ ៣៨/៣៨ · ទិសផ្ទុយ ៖ App មិនកំណត់ ➜ Loader ក្លែងបើកវិញ (ការវាស់អាចក្រហមពិត)។
- `security-guard-test` (ថ្មី) ៖ ៥៥ assertion · mutation ១៦/១៦ ក្រហម (ផ្នែក ២ «Deep audit security»)។
- `csp-lazy-resource-test` ៖ `cspAllows()` គោរព path និង wildcard ដូច browser (មុននេះប្រៀបតែ host ➜ ប្រភពដែលមាន path មិនត្រូវវាស់) + ទិសផ្ទុយ ៦។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy ZoeW · ZoeKeyGen (Netlify ពី `main`) ➜ ធ្វើបច្ចុប្បន្នភាពឧបករណ៍ (App ចាស់នៅផ្ញើ Replay/tracing តាមលំដាប់ UI)។
2. **Sentry** (ណែនាំ · ការពារ App ចាស់) ៖ Project `javascript-react` ➜ Settings ➜ Client Keys (DSN) ➜ Loader Script ➜ បិទ **Session Replay** · **Performance Monitoring** ·
   (Logs/Feedback បើមាន) · Security & Privacy ➜ បើក **Prevent Storing of IP Addresses** · ពិចារណាលុប replay ដែលថតរួច (Explore ➜ Replays)។
3. **GitHub** (ណែនាំ) ៖ Settings ➜ Code security ➜ **Secret scanning** + **Push protection** · **Dependabot alerts**។
4. **Supabase** (ណែនាំ · advisor) ៖ Authentication ➜ Password security ➜ បើក **Leaked password protection**។
5. ប្រវត្តិ git (លេខអតិថិជនក្នុង commit ចាស់) ➜ ការសម្រេចម្ចាស់គម្រោង (📌 ធាតុ ៣ក)។

### [2.50.49] — 2026-10-09 · ZoeW ៖ **ការដកប្រាក់កញ្ចប់ផុតកំណត់ (៨ ថ្ងៃ) ចុះតែម្តង ទោះ App ស្លាប់ពាក់កណ្តាល — សោដកក្នុង ledger** (ហាង KC-15 · Task #16 · ម្ចាស់គម្រោងជ្រើស «សោដកក្នុង ledger»)

**ZoeW `2.50.49`** (`zoew-v311` ➜ `zoew-v312`) · ⛔ ZoeKeyGen មិនប្រែ · **Firebase rules ប្រែ** (`ded/$trashId` ក្នុង `zoew_daily_revenue_cod_dod/$date`) ·
**migration Supabase ថ្មី** `supabase/migrations/20261009035130_zoe_rules.sql` (`generate-rules-sql.mjs`) · គ្មាន env ថ្មី · តំបន់ហាម/ចាក់សោមិនប៉ះ។

#### អ្វីដែលខុសពីមុន

- 💵 **ការដកនៃការសម្អាត ៧ ថ្ងៃ (`expired`)** ៖ transaction ២ ជំហានតាមលំដាប់ **ខែ ➜ ថ្ងៃ** (`deductCleanupLedgerKeyed()` ➜ `commitLedgerEventStep()`) ដែលផ្ទុក token កំណត់ពី
  (id ធុងសំរាម · `deletedAt`) (`ledgerEventToken()`) ជា `op` និងក្នុង ring `ops` · ថ្ងៃផ្ទុកសោ `ded/<trashId>` = `{ at, cod, dod, count }` (ចំនួនដែល server ដកពិត) ➜
  **សោនៅថ្ងៃ = ការដកទាំង ២ ចុះហើយ**។ ជំហាននីមួយៗ idempotent ៖ ឃើញសោ ឬ token ➜ «រួចហើយ» (មិនសរសេរ)។ អ្នកសរសេរ ledger ថ្ងៃគ្រប់រូបរក្សា `ded` (`ledgerCarryDed()`)។
- 🔁 **ការស្តារ (journal stage `ledger`)** ៖ journal កត់ `ledger: 'keyed'` + `prior` (token ក្នុង record ថ្ងៃ/ខែ មុនការដកលើកដំបូង) ➜ App បើកវិញ រត់ការដកម្តងទៀត ៖ សោ/token ➜ រួចហើយ ·
  token មុនៗនៅតែមាន ➜ ការដកមិនទាន់ចុះ ➜ ដក · គ្មានភស្តុតាង (ring ពេញរុញចេញ · App ចាស់លុប ring) ➜ **មិនប៉ះលុយ** + «⚠️ … មិនអាចផ្ទៀងផ្ទាត់» ដូចមុន។ បរាជ័យបណ្តោះអាសន្ន ➜
  ព្យាយាមរាល់វដ្ត ៦០ វិ. ≤ `CLEANUP_LEDGER_RETRY_MAX` ដង (សារ «⏳ ការសម្អាតបានរក្សាទុក — ស្ថិតិប្រាក់នឹង Sync ស្វ័យប្រវត្តិ។»)។
- 🔄 **ការស្តារពីធុងសំរាម** ៖ គ្មាន barcode ណា flag `isDeducted` តែសោនៅថ្ងៃ (ការដកចុះ · flip មិនទាន់) ➜ បូកវិញតាមសោ (`restoreLedgerKeyFor()`) · ការបូកវិញដែលមានសោ ➜ សរសេរ
  tombstone `back: true` ក្នុងការសរសេរ atomic ដដែល ➜ journal ដែលរត់ក្រោយមិនបូកវិញលើកទី ២។
- ↩️ **ស្តារមុនសោចុះ** (journal ឃើញធុងសំរាមបាត់ ហើយ barcode ត្រឡប់ចូលប្រវត្តិ) ៖ stage `undo` ➜ ថ្ងៃ (បូកវិញតាមសោ + tombstone `back: true, undo: true`) ➜ ខែ (token `u`) ·
  tombstone របស់ការស្តារ (គ្មាន `undo`) ➜ ការស្តារបូកវិញទាំង ២ រួចហើយ ➜ មិនបូកម្តងទៀត។
- 🧹 **អ្នកបោស** `runCleanupLedgerKeySweep()` (វដ្ត ៦០ វិ.) ៖ ធុងសំរាម `expired` មិនទាន់ flip ចាស់ជាង `CLEANUP_KEY_SWEEP_GRACE_MS` គ្មាន journal លើឧបករណ៍នេះ ហើយសោនៅថ្ងៃ (`at` ដូចគ្នា) ➜
  flip `isDeducted: true` (មិនប៉ះលុយ) · គ្មានសោ ➜ មិនធ្វើអ្វី ➜ ឧបករណ៍ដែលស្លាប់កណ្តាលការ flip មិនទុកកញ្ចប់ «មិនទាន់ដក» ក្នុងធុងសំរាមទៀត។
- 🗑️ **purge (២ ថ្ងៃ)** លុបសោនៃធុងសំរាមដែល purge (`releaseCleanupLedgerKeys()`) ➜ record ថ្ងៃមិនរីកឥតឈប់ · ការលុបសោមានពិដាន `dbOp()` ៖ purge
  រង់ចាំវាក្រោមសោ `deletedCleanupInFlight` ➜ បណ្តាញស្លាប់ចន្លោះការសរសេរទាំង ២ (ឬ socket zombie) មិនធ្វើឲ្យសោជាប់ ហើយ purge ងាប់ទៀតទេ។
- 🔐 **rules មិនទាន់ Publish** ➜ ការសរសេរ `ded` ត្រូវបដិសេធ ➜ App ថយទៅ token គ្មានសោ (ការស្តារនៅតែសម្រេចដោយ token · អ្នកបោស និងការស្តារតាមសោមិនដំណើរការ) · rules ចាស់ជាង ring ➜
  ផ្លូវចាស់ (journal `legacy`) ➜ ការស្តារ = «unverified» ដូចមុន។
- ⚠️ **ព្រំដែន** ៖ App ≤ 2.50.48 ក្នុងហាងដដែលសរសេរ record ថ្ងៃដោយគ្មាន `ded` ➜ សោបាត់ តែ token ក្នុង ring នៅជាភស្តុតាង (App ≥ 2.50.22 រក្សា ring) · App < 2.50.22 លុប ring ➜
  សម្រេចមិនបាន ➜ «unverified» (មិនដកពីរដង) ➜ ⛔ ធ្វើបច្ចុប្បន្នភាពគ្រប់ឧបករណ៍ក្នុងហាង។

#### អ្នកយាម

- `ZoeW/tests/cleanup-ledger-key.test.ts` (ថ្មី · ១៨) ៖ មុនកែ **FAIL ១៣/១៨** ៖ KC-15 ពិត (`unverified` · ១០០ មិនមែន ៩០) · ការដកចុះតែចម្លើយបាត់ (មិន flip) · ខែ/ថ្ងៃចុះតែម្ខាង (១០០/៩០) ·
  journal ចាស់រត់ម្តងទៀត · App ចាស់លុបសោ · flip ចុះ + journal មិនទាន់លុប + ស្តារ ➜ **១១០** (បូកវិញ ២ ដង) · ស្តារមិនបូកវិញតាមសោ (៩០) · undo ខែត្រូវកាត់ ➜ ថ្ងៃ **១១០** ·
  អ្នកបោស · rules បដិសេធ `ded` + ចម្លើយបាត់ ➜ ក្រោយកែ ១៨/១៨ (ទិសផ្ទុយ ៥ ៖ គ្មានភស្តុតាង ➜ មិនប៉ះលុយ · id ដដែលផុតកំណត់ម្តងទៀត ➜ ដកម្តងទៀត · អ្នកបោសមិនដក · rules ចាស់ ➜ ការដកនៅចុះ)។
- `audit-tools/cleanup-interrupt-atomicity-test.js` ផ្នែក ៣ខ (ថ្មី · ១៨ · record មាន ring) ៖ មុនកែ FAIL (unverified · មិន flip) ➜ ក្រោយ ៧៩/៧៩ · ផ្នែក ៣ (record គ្មាន ring ➜ មិនប៉ះលុយ) មិនប្រែ។
- `money-guardian-test` mutation ថ្មី ៣ (token មិនរាប់ · សោមិនរាប់ · មិនទាមទារ token មុន) ➜ ចាប់ដោយ `cleanup-interrupt-atomicity-test` ៣ខ-ខ · ៣ខ-គ · ៣ (ដកលើកទី ២)។
- emulator RTDB ៖ rules ថ្មីទទួលសោ · tombstone ហើយបដិសេធ ៦ រាងខុស (cod អវិជ្ជមាន · ខ្វះ `count` · វាលលើស · ធាតុ primitive · `back:false` · `ded` primitive) ·
  rules ចាស់ (Publish បច្ចុប្បន្ន) បដិសេធ `ded` តែទទួល token ➜ ការថយក្រោយត្រូវ។
- `ZoeW/tests/remove-stale-session.test.ts` ៖ យុថ្កាថ្មី (`deductCleanupRevenue` · ច្រកផ្ទាល់) ➜ `stale` មុនសារ/Sentry · `supabase-update-contract` ៖ `releaseCleanupLedgerKeys` = IDEMPOTENT ·
  `finalizeClaimedRestore` + សោដក ១ = BOUNDED។
- `write-stall-guard-test` ផ្នែក ២ខ (ថ្មី) ៖ purge ជោគជ័យ តែការលុបសោ `ded` ព្យួរ ➜ មុនកែ **FAIL** (សោ `deletedCleanupInFlight` ជាប់ក្រោយ ១៧,៥ វិ.) ➜ ក្រោយកែ ដោះក្នុងពិដាន។
- `returned-trash-retention-test` ៖ purge ដោះសោ `ded` តែរបស់ធុងសំរាម `expired` ដែល purge ពិត និង `at` ដដែល (សោ `at` ផ្សេង · `pickup` មិនប៉ះ)។
- `emu/crud-rules-flow` ផ្នែក ៥ (ថ្មី) ៖ ការសម្អាតផុតកំណត់ពិតក្នុង sandbox ➜ payload ពិត (ប្រវត្តិ · ធុងសំរាម · ខែ · ថ្ងៃ + `ded` · flip) ➜ rules ពិតលើ emulator
  ទទួល · server ៖ ថ្ងៃ/ខែដក ៨,២៩ · ២ · `ded/id_e` = `{ at · cod · dod · count }` · ទិសផ្ទុយ ៖ rules គ្មាន `ded` ➜ បដិសេធ · `ded` ខុសទម្រង់ ➜ បដិសេធ
  (mutation បិទការសរសេរ `ded` ➜ ធ្លាក់ ៣)។ មុននេះផ្លូវសរសេរ `ded` គ្មានអ្នកវាស់ជាមួយ rules ពិត (fuzz គ្មាន op ផុតកំណត់)។
- `ZoeW/tests/cleanup-ledger-key.test.ts` ១២គ (ថ្មី ➜ ១៩) ៖ សោ `back:true` ឬ `at` ផ្សេង ➜ អ្នកបោសមិន flip · លុយមិនប្រែ (mutation ដកលក្ខខណ្ឌ `at`/`back` ➜ ធ្លាក់)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. ⛔ **Publish Firebase rules** (`firebase-database.rules.json`) ទៅ **គ្រប់អតិថិជន Firebase មុន Deploy** ៖ Firebase Console ➜ Realtime Database ➜ Rules ➜ បិទភ្ជាប់ ➜ Publish ឬ
   `tools/firebase-provision/deploy-rules.cmd` (មិន Publish ➜ App នៅដើរ តែគ្មានសោ ➜ អ្នកបោស និងការស្តារតាមសោមិនដំណើរការ)។
2. merge ➜ migration Supabase `20261009035130_zoe_rules.sql` ចូល live តាម GitHub integration (ឬបិទភ្ជាប់ក្នុង SQL Editor) ➜ ផ្ទៀង version ក្រោយ merge។
3. Deploy **ZoeW** ➜ build APK ថ្មី ➜ ⛔ ធ្វើបច្ចុប្បន្នភាព **គ្រប់ឧបករណ៍** ក្នុងហាង (App ចាស់លុបសោពេលសរសេរ ledger ថ្ងៃដដែល)។
4. សាក ៖ កញ្ចប់ផុតកំណត់ (៨ ថ្ងៃ) ចូលធុងសំរាម ➜ Console/Supabase ៖ `zoew_daily_revenue_cod_dod/<ថ្ងៃស្កេន>/ded/<id ធុងសំរាម>` មាន `at · cod · dod · count` ·
   ចំណូល/ចំនួនដក **តែម្តង** · ធាតុធុងសំរាម `isDeducted: true` · ស្តារវា ➜ ប្រាក់បូកវិញតែម្តង ហើយសោមាន `back: true`។
5. Sentry ៖ «Automatic cleanup revenue awaits confirmation» (zone money) = ការដកមិនទាន់បញ្ជាក់ ➜ journal ព្យាយាមម្តងទៀត · «Interrupted cleanup resumed with unverified ledger» នៅមានពេលគ្មានភស្តុតាង។

### [2.50.48] — 2026-10-09 · ZoeW ៖ **ស្វែងរក ៖ ប្រអប់ស្នើលេខធ្លាក់ចុះពេលប្រអប់ទៅដល់ · ចលនាមើលឃើញពេញលើ iPhone · សារទទេទំព័រស្កេនមិនលោតតាម keyboard** (វីដេអូម្ចាស់គម្រោង ៣ ៖ APK · PWA Android · PWA iPhone)

**ZoeW `2.50.48`** (`zoew-v310` ➜ `zoew-v311`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ តំបន់ហាម ៖ `panel-motion.ts` · `phone-search.ts` ប្រែតាមរបាយការណ៍ម្ចាស់គម្រោង
(វីដេអូ ៖ «phone suggestion glitch អត់រលូនតាមប្រអប់ស្វែងរកសោះ · keyboard ដូច glitch បន្តិច · tab scan ពេល keyboard ឡើងពេញរួច ទើបប្រអប់កញ្ចប់ដែលបានបញ្ចូលថ្ងៃនេះ ឡើងមកឈរពីលើ keyboard
តាមក្រោយ» · ក្នុងជុំដដែល ៖ «អោយ suggestion ធ្លាក់មកពេលប្រអប់ស្វែងរកទៅដល់លើរួចរាល់វិញទៅ») ➜ sha256 ថ្មីក្នុង `LOCK` (`forbidden-zone-lock`) · ចលនាអូស/ចុចរបា (`panelGlideFrom` គ្មាន motion) ·
`panels.ts` · `app.css` · PTR មិនប្រែ (`panel-motion-test` · `gesture-test` · `ios-panel-glide-test` · `panel-snap-ownership-test` · `phone-search-swipe-test` បៃតង)។

#### អ្វីដែលខុសពីមុន

- 🔍 **ប្រអប់ស្នើលេខ** ៖ បិទពេលប្រអប់ស្វែងរកកំពុងរអិល (`showPhoneSuggestions()` រង់ចាំ `phoneSearchGlideRunning()`) ➜ glide ចប់ពិត (`PanelGlide.settled()`) ➜ បើក ហើយធ្លាក់ចុះពីលើ
  (`dropPhoneSuggestBox()` ៖ opacity + `translate3d(0,-10px)` ➜ ០ · `PHONE_SUGGEST_DROP_MS` · Reduce Motion ➜ គ្មានចលនា) · glide ថ្មីជំនួស ឬប្រអប់លែង focus ➜ មិនបើក។
- 📱 **ចលនាស្វែងរក** (`PANEL_SEARCH_GLIDE` ៖ ស្វែងរកលេខ · ទំព័រស្កេន) ៖ ខ្សែកោង `cubic-bezier(0.4, 0, 0.2, 1)` · `PANEL_SEARCH_GLIDE_MS` ៖ ស៊ុមនីមួយៗ ≤ ១៦% នៃចម្ងាយ ·
  ចាប់ផ្តើមនៅទីតាំងចាស់ (pause) ហើយរត់តែពេលស៊ុមហូរ (២ ស៊ុមជាប់គ្នា ≤ `PANEL_GLIDE_FLOW_FRAME_MS` · ពិដាន `PANEL_GLIDE_HOLD_MAX_MS`) ➜ iPhone ដែលមិនបង្ហាញស៊ុម ~៨០ms ពេលរៀបចំ keyboard
  មើលឃើញចលនាពេញ · glide ថ្មីលើធាតុដដែលបោះបង់ glide ចាស់ (`stopPanelGlide()`) · timer ដក snap pause តាមរយៈពេលពិត (`beginPanelGlideSnapPause(spanMs)` លំនាំដើម `PANEL_GLIDE_MS`)។
- 📦 **ទំព័រស្កេន** ៖ ការស្វែងរកពេលផ្ទាំងស្កេនបង្រួម (`uiState.entrySearchActive` ➜ `.page-main.entry-search-open`) ➜ សារ «មិនទាន់មាន…» នៅក្រោមក្បាលតារាង (មិននៅចុងកាត) ➜ WebView/Chrome
  បង្រួមផ្ទៃក្រោយ keyboard ឡើងពេញ ➜ សារនៅដដែលពីលើ keyboard · ផ្ទាំងបើកវិញតាមផ្លូវណាក៏ដោយ ➜ ត្រឡប់ទៅចុងកាត (ស៊ុមក្រោមកាត Android = iOS មិនប្រែ)។

#### អ្នកយាម

- `ZoeW/scripts/history-window-check.mjs` (+១៥ ក្នុង ៣ របៀប) ៖ ប្រអប់ស្នើលេខមិនបង្ហាញពេលកាតកំពុងរអិល · បើក ≤ ១៥០ms ក្រោយកាតទៅដល់ · ធ្លាក់ពីលើមកនៅក្រោមប្រអប់ ៤px ·
  ស៊ុមនីមួយៗ (≤ ២០ms) ≤ ២០% នៃចម្ងាយ · ស៊ុមកក ១២០ms ក្រោយ focus ➜ ស៊ុមដំបូងក្រោយកក ≤ ២០% · ទំព័រស្កេន (បញ្ជីកញ្ចប់ · Locker) ៖ សារទទេមិនផ្លាស់ទីពេលផ្ទៃបង្រួម ៣៣០px ហើយនៅពីលើ —
  មុនកែ FAIL ១៥ (ប្រអប់នៅទីតាំងចាស់ ៩៨ ➜ ៣០០px ពីប្រអប់ ១០ ស៊ុម · ស៊ុមដំបូង ៣១.៦% · ក្រោយកក ៩៨% · សារលោត ៧២៥ ➜ ៣៩៥)។
- `ZoeW/tests/search-glide-hold.test.ts` (៧) ៖ pause ➜ ស៊ុមកកមិនរាប់ ➜ play · ពិដានពេលគ្មានស៊ុម · `settled()` true/false · glide ថ្មីបោះបង់ចាស់ · glide អូសមិនប្រែ · `entrySearchActive`
  (focus បង្រួម · ផ្ទាំងបើក ➜ false · បង្រួមដោយដៃ ➜ មិនបើកវិញ)។
- checker ដែលកាត់ function ពិតចូល sandbox ស្គាល់ helper ថ្មី ៖ `panel-snap-ownership-test` · `phone-search-swipe-test` (timer `spanMs`) · `phone-suggest-test` · `state-hygiene` (`phoneSearchGlide`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Merge ➜ Deploy **ZoeW** · build APK ថ្មី។
2. iPhone PWA (App លើ Home Screen) ៖ ចុចស្វែងរកលេខ ➜ ប្រអប់រអិលឡើងដល់លើ (ឃើញចលនា មិនលោតទៅចុងភ្លាម) ➜ បញ្ជីលេខស្នើធ្លាក់ចុះក្រោមប្រអប់ ➜ ចាកចេញ ➜ ចុះវិញ។
3. Android PWA · APK ៖ ដូចជំហាន ២ · ប្រអប់ស្នើលេខមិនលេចនៅទីតាំងចាស់ពេលកំពុងរអិល។
4. ទំព័រស្កេន (ទាំង ៣) ៖ ចុចស្វែងរក ➜ វាយ «zz» ➜ សារ «មិនទាន់មាន…» នៅក្រោមក្បាលតារាង ពីលើ keyboard ហើយមិនលោតពេល keyboard ឡើងពេញ · Locker ដូចគ្នា ·
   ⚠️ Android PWA ៖ របារ «kc15 •••••» ពីលើ keyboard ជារបារ autofill របស់ Chrome (ផ្នែក ២ A73) ➜ រាយការណ៍បើនៅរំខាន។

### [2.50.47] — 2026-10-09 · ZoeW + Function ZTO ៖ **`/detail` ៖ សោតាមហាង · ចងគណនី · កំណត់សាខា** (សំណើម្ចាស់គម្រោង ៖ «ធ្វើ ២ ៣ ៤ ចុះ» · Handoff ៦ច)

**ZoeW `2.50.47`** (`zoew-v309` ➜ `zoew-v310`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · migration ថ្មី · env ថ្មី ៣ (ស្រេចចិត្ត · មិនកំណត់ ➜ ឥរិយាបថដដែល) ·
⛔ តំបន់ចាក់សោ ZTO ៖ ប្រែតាមសំណើម្ចាស់គម្រោង ➜ sha256 ថ្មីក្នុង `LOCK` (`zto-lock.test.ts`) សម្រាប់ `zto-order-detail.js` · `zto-status.ts` · `auto-lookup.ts` · `lookup-api.ts` ·
អ្នកយាមធ្លាក់មុនកែ ➜ កែ ➜ អ្នកយាម ZTO ទាំងអស់បៃតង។ ការពិនិត្យប្រឆាំង (workflow ៦ agent · ផ្នែក ២ A71) ➜ កែក្នុងជុំដដែល (មិនទាន់ merge ➜ កំណែដដែល) ៖
`LOCK` ថ្មីម្តងទៀតសម្រាប់ `zto-order-detail.js` · `auto-lookup.ts` · `lookup-api.ts`។

#### អ្វីដែលខុសពីមុន

- 🔐 **(២) សោមួយក្នុងមួយហាង** ៖ Netlify `ZTO_PROXY_KEYS` = `ឈ្មោះ=សោ` (comma · បន្ទាត់ថ្មី) · `ZTO_PROXY_KEY` ចាស់នៅដំណើរការ (ឈ្មោះ `default`) ➜ ប្តូរម្តងមួយហាង ·
  សោហាងមួយលេច ➜ លុបតែធាតុនោះ · ធាតុខុស (គ្មានឈ្មោះ · ឈ្មោះខុស · សោ < ១៦ តួ · ស្ទួន) មិនផ្តល់សិទ្ធិ · `?diag=1` `access.keyLabel` · `keys` · `invalidKeys` ·
  🩺 ជួរ Lookup ZTO បង្ហាញ «សោហាង ឈ្មោះ» និង «ផ្ទៀងគណនី require/optional»។
- 👤 **(៣) ចងគណនី** ៖ App ផ្ញើ `X-Zoe-Id-Token` (គណនីដែលកំពុងចូល · ពិដាន ៣ វិ.) លើការស្កេន ZTO និងការពិនិត្យស្ថានភាព ZTO — តែទៅ Function ZTO (`lookupApiIsZto()`) ⛔ មិនដែលទៅ API ស្វែងរកផ្សេង ·
  Function `ZTO_DETAIL_IDENTITY` = `off` (លំនាំដើម) · `optional` (ពិនិត្យ · មិនបដិសេធ · រាប់) · `require` (គ្មាន/មិនត្រឹមត្រូវ ➜ 401 `ZTO_IDENTITY_REQUIRED` មុន cache និង ZTO ·
  certs/Supabase មិនឆ្លើយ ➜ 503 `ZTO_IDENTITY_UNAVAILABLE` ➜ App សាកម្តងទៀត) · តម្លៃខុស ➜ `ZTO_CONFIG_INVALID` · App ៖ «🔒 ZTO ត្រូវការគណនីដែលកំពុងចូល — សូមចាកចេញ ហើយចូលគណនីម្តងទៀត» ·
  «⚠️ ផ្ទៀងផ្ទាត់គណនីជាមួយ Server មិនបាន — សូមស្កេនម្ដងទៀត»។
- 🏢 **(៤) កំណត់សាខា** ៖ `ZTO_DETAIL_BRANCH_PATHS` (វាលក្នុងកំណត់ត្រា ZTO) ➜ ឆ្លើយតែពេលលេខសាខាក្នុងកំណត់ត្រា = សាខាគណនី · ផ្សេង · គ្មានវាល · គណនីគ្មានសាខា ➜
  200 `found:false` `ZTO_OTHER_BRANCH` (គ្មានលេខទូរស័ព្ទ · COD) ➜ App ៖ «⚠️ កញ្ចប់នេះជារបស់សាខាផ្សេង — ZTO មិនបង្ហាញព័ត៌មានអតិថិជនទេ» · cache មិនរំលង ·
  `?diag=1` `access.branch` (`matched` · `other` · `missing` · `seen`) សម្រាប់ផ្ទៀងវាលមុន `require`។
- 🔗 **ចងគម្រោង Firebase ↔ សាខា** (A71 ៖ email ជាសញ្ញាដែលអ្នកប្រើប្តូរខ្លួនឯងបាន) ៖ `FIREBASE_PROJECT_IDS` ធាតុ `projectId:សាខា|សាខា` ➜ email ក្រៅសាខាដែលចង ➜
  គ្មានសាខា (`?list=1` `site:no-account` · `/detail` `branch:project-mismatch`) · គម្រោងមិនចង + កំណត់សាខា `/detail` ➜ `branch:project-unbound` · ការចងខុសទម្រង់ ➜
  `idtoken:project-unset` · `?diag=1` `access.branch.unboundProjects`។ ធាតុគ្មាន `:` ➜ ដូចមុន (`?list=1` មិនប្រែ)។
- 👤 គណនី Supabase គ្មានហាង (`my_account()` ០ ជួរ) ➜ មិនមែនគណនីដែលផ្ទៀងរួច (`site:no-account` · 401 ពេល `require`) · `optional` គ្មានការកំណត់សាខា ➜ មិនរង់ចាំការផ្ទៀង
  (Supabase/certs ព្យួរ ➜ មិនបន្ថែម ៣ វិ. លើរាល់ការស្កេន)។
- 🔄 App ៖ គណនីកំពុងចូល តែ token យកមិនទាន់ (refresh យឺត > ៣ វិ.) ឬ `idtoken:expired` · `kid-unknown` · `future` ➜ «⚠️ ផ្ទៀងផ្ទាត់គណនីជាមួយ Server មិនបាន — សូមស្កេនម្ដងទៀត» +
  cooldown ខ្លី (មិនមែន «ចាកចេញ» + cooldown ៣០ វិ.) · `ZTO_OTHER_BRANCH` មូលហេតុក្រៅ `branch:other` ➜ «⚙️ ផ្ទៀងសាខាកញ្ចប់នេះមិនបាន (Config សាខា ZTO នៅ Netlify) — ជាប់ត្រង់ …» ·
  ប៊ូតុង 🧪 សាកល្បង ផ្ញើ `X-Zoe-Id-Token` ដូចការស្កេន (តែទៅ Function ZTO)។
- 🛠️ ឧបករណ៍ Cookie Sync ៖ Function បដិសេធសោ ➜ `key-rejected` «the Function refused the proxy key …» (មិនមែន «could not reach the Function») · prompt ទទួលសោពី `ZTO_PROXY_KEYS`។
- 📖 `ZoeW/ZTO-SETUP-KH.md` ផ្នែក ៤ឃ ថ្មី (ជំហាន ១–៣) · ផ្នែក ៤គ (ការចងគម្រោង) · ផ្នែក ៦ (កូដ ZTO ថ្មី) · `guide.html` ផ្នែក ១៤ (សោហាង និងគណនី) · README ឧបករណ៍ Sync។

#### អ្នកយាម

- `audit-tools/zto-proxy-test.js` ផ្នែក ១២ (Function ពិត · token RS256 ពិតពី `idtoken-fixture.js`) ៖ សោហាង A · B · សោមាន `=` · សោក្រៅបញ្ជី · កាត់មួយតួ · `default` រួមជាមួយ ·
  ធាតុខុស ៤ · គ្មានសោត្រឹមត្រូវ · `require` គ្មាន token · token ក្លែង · cache មិនរំលង · certs ធ្លាក់ ➜ 503 · `optional` · តម្លៃខុស · សាខាត្រូវ/ផ្សេង/គ្មានវាល/គណនីគ្មានសាខា ·
  `optional` + សាខា · `off` មិនកំណត់ · ផ្លូវខុស · `?diag=1` (label · គ្មានតម្លៃសោ · ការរាប់ · `seen` គ្មានលេខទូរស័ព្ទ) · preflight APK — មុនកែ FAIL ១៨ (១៦៤ ok)។
- `ZoeW/tests/zto-detail-identity.test.ts` (៨) ៖ ស្កេន · ពិនិត្យស្ថានភាព ➜ មាន token · API ផ្សេង ➜ គ្មាន token · គ្មានគណនី ➜ សំណើនៅចេញ · `ZTO_OTHER_BRANCH` ·
  `ZTO_IDENTITY_REQUIRED` · `ZTO_IDENTITY_UNAVAILABLE` (សាកម្តងទៀត) · 🩺 «សោហាង» — មុនកែ FAIL ៥/៧ (+ 🩺)។
- A71 ៖ `zto-proxy-test` ផ្នែក ១២ +១៦ (គម្រោងមិនចង · ក្លែង email · `?list=1` · ការចងត្រូវ · `unboundProjects` · ការចងខុសទម្រង់ · វាលសាខា ២ · Supabase គ្មានហាង/សមាជិក ·
  503 project-unset/supabase-unreachable/supabase-unset · `optional` + Supabase ព្យួរ · ការរាប់ `?diag=1`) — មុនកែ FAIL ១៤ · mutant ១០ (ការរាប់ ៣ · ហេតុផល 503 ២ · `some`➜`every` ·
  ការចង ២ · Supabase គ្មានហាង · រង់ចាំជានិច្ច) ➜ FAIL ទាំងអស់ · `zto-detail-identity.test.ts` +៥ (token ព្យួរ · expired/kid-unknown/future · ទិសផ្ទុយ signature/គ្មានគណនី ·
  មូលហេតុសាខា · ប៊ូតុង 🧪) — មុនកែ FAIL ៤ · `zto-cookie-sync-test` +២ (`key-rejected`) — មុនកែ FAIL ២។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Merge ➜ Deploy **ZoeW** · build APK ថ្មី។ មិនកំណត់ env ថ្មី ➜ ឥរិយាបថដូចមុនទាំងស្រុង។
2. **សោតាមហាង** (`ZoeW/ZTO-SETUP-KH.md` ផ្នែក ៤ឃ ជំហាន ១) ៖ បង្កើតសោមួយក្នុងមួយហាង ➜ Netlify `ZTO_PROXY_KEYS` ➜ Trigger deploy ➜ ទូរស័ព្ទនីមួយៗ ៖ API ស្វែងរកអតិថិជន ➜
   តម្លៃ Header = សោហាងនោះ ➜ 🩺 «សោហាង ឈ្មោះ» ➜ គ្មានទូរស័ព្ទណា «default» ➜ ⛔ **ម៉ាស៊ីន Cookie Sync** ៖ រត់ `setup.cmd` / `setup-termux.sh` ម្តងទៀតជាមួយសោមួយក្នុង
   `ZTO_PROXY_KEYS` ➜ `sync-zto-cookie.cmd --check` OK (🩺 មើលម៉ាស៊ីន Sync មិនឃើញ) ➜ ទើបលុប `ZTO_PROXY_KEY` ➜ Trigger deploy។
3. **ចងគណនី** (ជំហាន ២) ៖ ទូរស័ព្ទទាំងអស់ update ដល់ 2.50.47 (កំណែចាស់មិនផ្ញើ token ➜ ការស្កេនធ្លាក់ពេល `require`) ➜ `ZTO_DETAIL_IDENTITY=optional` ➜ មួយថ្ងៃ ➜
   `?diag=1` `access.missing` · `rejected` នៅ ០ ➜ `require`។
4. **កំណត់សាខា** (ជំហាន ៣) ៖ ចងគម្រោង Firebase នីមួយៗ `FIREBASE_PROJECT_IDS=projectId:លេខសាខា` (`?diag=1` `access.branch.unboundProjects` = ០) ➜ Argus ➜ រកវាលលេខសាខាក្នុង
   `order/detail` លើកញ្ចប់ច្រើន ➜ `ZTO_DETAIL_BRANCH_PATHS` ➜ ⛔ មានប្រសិទ្ធភាពភ្លាមលើគ្រប់ទូរស័ព្ទដែលផ្ញើគណនី (`optional` ក៏ដូច `require` · គ្មានដំណាក់កាលមើលតែប៉ុណ្ណោះ) ➜
   ស្កេនកញ្ចប់សាខាខ្លួនឯង ➜ `?diag=1` `access.branch.matched` កើន · `other`/`missing` នៅ ០ ➜ មិនដូច្នោះ ➜ `ZTO_DETAIL_BRANCH_PATHS=off` ➜ Trigger deploy ➜ រកវាលម្តងទៀត។
   ⚠️ មិនទាន់វាស់លើទិន្នន័យ ZTO ពិត (ឈ្មោះវាលសាខាក្នុង `order/detail` មិនស្គាល់នៅទីនេះ)។

### [2.50.46] — 2026-10-08 · ZoeW ៖ **ស្វែងរករអិលរលូន (ទំព័រទិន្នន័យ · ទំព័រស្កេន) · 🔔 «🔄 ពិនិត្យកំណែថ្មី» · Supabase មិនកាត់ពីរដង · SW មិនផ្ទុក HTML ជា chunk** (Deep audit ៣ · សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.46`** (`zoew-v308` ➜ `zoew-v309`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ តំបន់ហាម ៖ `phone-search.ts` ប្រែតាមសំណើម្ចាស់គម្រោង
(«ពេលចុចស្វែងរកលេខ ពេល focus auto ហូតឡើង ចលនាអត់ smooth និង keyboard លោតមកក៏មិនសូវរលូន») ➜ sha256 ថ្មីក្នុង `LOCK` (`forbidden-zone-lock`) · `panels.ts` · `panel-motion.ts` ·
`app.css` · PTR មិនប៉ះ។

#### អ្វីដែលខុសពីមុន

- ✨ **ចុចស្វែងរកលេខ ➜ ផ្ទាំងរអិលឡើង** (មុននេះលោតភ្លាម ~៣០០px ក្នុងស៊ុមតែមួយ ខណៈ keyboard ចាប់ផ្តើម)។ ការទាញឡើង/ចុះពេល focus · blur ឥឡូវរអិល ២២០ms
  ដូចការអូសផ្ទាំង (`glidePhoneSearchPulledUp()` ៖ FLIP កាតស្វែងរក + បញ្ជី តាម `panelGlideFrom()` · ផ្អាក snap ដូចមុន)។ iPhone PWA ៖ ការចុច ➜ រអិលឡើងមុន ➜ `focus({ preventScroll })` ([2.50.45])។
- ✨ **ទំព័រស្កេន ៖ ចុចស្វែងរកបញ្ជីកញ្ចប់ ឬបញ្ជី Locker ➜ ផ្ទាំងស្កេនបង្រួមដោយរអិល** (សំណើម្ចាស់គម្រោង «ពិនិត្យកន្លែងស្វែងរកក្នុង tab ស្កេនផង») ៖ មុននេះប្រអប់នៅ y ៤៣៦ · ៥០៣
  (៤១៤×៨៩៦) ➜ keyboard គ្របលទ្ធផល ហើយ iOS រំកិលទំព័រ។ ឥឡូវប្រអប់ឡើង y ~១០៦ · ចាកចេញពីប្រអប់ទទេ ➜ ផ្ទាំងស្កេនបើកវិញ (តែពេល focus ជាអ្នកបង្រួម · មានអក្សរ ➜ នៅបង្រួម · កាមេរ៉ាកំពុងស្កេន ➜ មិនបង្រួម ព្រោះកាមេរ៉ាលាក់នៅតែស្កេន) ·
  iPhone PWA ៖ ការចុច ➜ បង្រួមមុន ➜ `focus({ preventScroll })` · document រំកិល ➜ ត្រឡប់ ០ (ដូចប្រអប់ស្វែងរកលេខ) · កាមេរ៉ាកំពុងស្កេន ➜ ផ្ទាំងនៅបើក ហើយការចុចជារបស់ iOS
  (iOS រំកិលបង្ហាញប្រអប់លើ keyboard · `entrySearchMovesField()`) · អ្នកប្រើបើកផ្ទាំងដោយដៃ ➜ ការចាកចេញពីប្រអប់មិនបើកវិញទៀត (អ្នកប្រើជាអ្នកបង្រួម) · ពិនិត្យតែប្រអប់នៃរបៀបដែលបង្ហាញ។
- ✨ **🔔 «📱 កំណែ App» ៖ ប៊ូតុង «🔄 ពិនិត្យកំណែថ្មី»** (សំណើម្ចាស់គម្រោង) ៖ ទាញព័ត៌មានកំណែភ្លាម · APK ៖ សួរ GitHub Release ម្តងទៀតភ្លាម (មុននេះរង់ចាំ ២ នាទីក្រោយ
  «មិនទាន់មាន») · PWA ៖ សួរ Service Worker ឲ្យទាញកំណែថ្មី ➜ «Refresh ឥឡូវនេះ» · ខណៈពិនិត្យ ➜ ប៊ូតុងបិទ · feed កំណែទាញមិនបាន ➜ ⚠️ (ដំណឹងអ្នកលក់ដែលឆ្លើយមិនរាប់ថាពិនិត្យបាន) ·
  feed ទាញបានពេលក្រោយ (បើក 🔔) ➜ ⚠️ បាត់។
- 🐛 **ហាង Supabase ៖ ការកាត់ប្រាក់ដែលចម្លើយបាត់ ហើយផ្ញើម្តងទៀតក្រោយ `zoe_ops` លុបលទ្ធផល (២ ថ្ងៃ) ➜ កាត់ពីរដង** ៖ op ដែលលុបរួចត្រូវវាយតម្លៃ CAS ថ្មី ➜ ប៉ះតម្លៃដែលខ្លួនឯងសរសេររួច
  ➜ `conflict` ➜ adapter ឆ្លើយ `not-applied` ➜ `runLedgerTransaction()` ផ្ញើម្តងទៀត។ ឥឡូវ ៖ conflict ក្រោយ `SB_OP_REPLAY_SAFE_MS` (២៤ ម៉ោង < ២ ថ្ងៃ · វាស់តាមនាឡិកា server ៖ `now` របស់
  conflict ដក `now` ចុងក្រោយដែលឃើញមុនផ្ញើ ➜ នាឡិកាឧបករណ៍ដែលថយក្រោយមិនប៉ះ) សម្រេចដោយ ring `ops`
  (`txOutcomeWitness`) ➜ `applied` តែម្តង · គ្មាន witness ➜ `unknown` (Sentry money · មិនទាយ)។
- 🐛 **PWA ៖ deploy ថ្មីខណៈ SW ចាស់គ្រប់គ្រង ➜ chunk ឈ្មោះចាស់ (ឧ. `supabase-backend`) ត្រូវ Netlify ឆ្លើយ `index.html` 200 ➜ SW ផ្ទុក HTML ក្រោម key របស់ chunk**
  ➜ `import()` បរាជ័យរហូតដល់ SW ថ្មី (ហាង Firebase ប្តូរ Config ទៅ Supabase ចំពេល deploy ➜ «Supabase មិនទាន់រួចរាល់»)។ ឥឡូវ HTML មិនចូល cache ក្រោម key ដែលមិនមែន HTML
  (`responseFitsKey()` ទាំងទ្វារ miss និង revalidate · អាន header មិនបាន ➜ ផ្ទុកដូចមុន)។

#### អ្នកយាម

- `ZoeW/tests/supabase-op-retention.test.ts` (៥) ៖ ព្រំដែន adapter ≤ ពាក់កណ្តាលរយៈរក្សា `zoe_ops` ដែលទាញពី migration ពិត · ledger ផ្ញើវិញក្រោយ ៣ ថ្ងៃ + purge ➜ កាត់តែម្តង
  (`applied`) · CAS គ្មាន witness ➜ `unknown` + រាយការណ៍ · ទិសផ្ទុយ ៖ ក្នុងបង្អួច (op នៅ) ➜ replay · មិនដែលចុះ + ឧបករណ៍ផ្សេងសរសេរ ➜ `not-applied` ➜ សាកឡើងវិញ ➜ កាត់តែម្តង —
  មុនកែ FAIL ៣/៥ (ការកាត់ ២ ដង ៖ `applied` ២ · `codDollar` ៩០ ជំនួស ៩៥)។
- `audit-tools/sw-backend-chunk-test.js` ផ្នែក ៤ (Chromium ពិត · `sw.js` ពិត) ៖ server ឆ្លើយ `index.html` ជំនួស chunk ដែលលែងមាន ➜ SW មិនផ្ទុក · chunk មានវិញ ➜ chunk ពិត —
  មុនកែ FAIL ២ (ការផ្ទុកលើកក្រោយទទួល HTML ៨៩,៥៩៣ bytes ពី cache)។
- `ZoeW/scripts/history-window-check.mjs` (APK · PWA Android · PWA iPhone) ៖ ចុចស្វែងរកលេខ ➜ FLIP ចាប់ផ្តើមពីទីតាំងចាស់ (±២px) · ចប់គ្មាន transform សល់ · blur ➜ រអិលចុះ ·
  ទំព័រស្កេន (បញ្ជីកញ្ចប់ · Locker) ➜ បង្រួមដោយរអិល · ប្រអប់ឡើង ≥ ១០០px · blur ទទេ ➜ បើកវិញ — មុនកែ FAIL ១២/១២ · ការវាស់ keyboard រង់ចាំ `resize` ពិត (មុននេះធ្លាក់ម្តងក្រោមបន្ទុក run-all)។
- `ZoeW/tests/ios-entry-search-tap.test.ts` (៨) ៖ iPhone PWA ចុចប្រអប់ស្វែងរកទំព័រស្កេន ➜ preventDefault · បង្រួមមុន focus · `preventScroll` · blur ទទេ/មានអក្សរ · បង្រួមដោយដៃមុន · កាមេរ៉ាកំពុងស្កេន ·
  អេក្រង់ធំ · tab ផ្សេង · Android ➜ មិនប៉ះ · document រំកិល ➜ ០។
- `ZoeW/tests/notify-update-check.test.tsx` (៩) ៖ ខ្សែភ្ជាប់ (registry · allowlist) · APK «មិនទាន់មាន» ទើបពិនិត្យ ➜ ចុច ➜ probe ភ្លាម ➜ ប៊ូតុងទាញយក · PWA `registration.update()` ·
  កំពុងពិនិត្យ ➜ បិទ · មិនបាន ➜ ⚠️ · feed កំណែធ្លាក់ + ដំណឹងអ្នកលក់ឆ្លើយ ➜ ⚠️ · feed ទាញបានវិញ ➜ ⚠️ បាត់ · `updateReady` ➜ គ្មានប៊ូតុង — ២ ថ្មីមុនកែ FAIL ២។
- `ZoeW/tests/supabase-op-retention.test.ts` (+២) ៖ នាឡិកាឧបករណ៍ថយក្រោយ ៣០ ម៉ោងក្នុងការដាច់ ៥០ ម៉ោង + purge ➜ កាត់តែម្តង (មុនកែ `applied` ២) · ទិសផ្ទុយ ៖ ការដាច់ ៣ ម៉ោង ➜ replay ·
  fake server មាននាឡិកាផ្ទាល់ខ្លួន និង `now` ក្នុងចម្លើយ write ដូច migration ពិត។
- `ZoeW/tests/ios-entry-search-tap.test.ts` (+៦) ៖ កាមេរ៉ា ➜ ការចុចជារបស់ iOS · កាមេរ៉ា + ផ្ទាំងបង្រួមរួច ➜ preventScroll · ការរំកិល document នៅដដែលពេលផ្ទាំងបើក · flag ចាស់ក្រោយបើក/បង្រួមដោយដៃ ·
  ប្រអប់ Locker លាក់ · focus ម្តងទៀត ➜ នៅបើកវិញ — មុនកែ FAIL ៥។
- `ZoeW/tests/sw-revalidation-timeout.test.ts` (+២) ៖ ទ្វារ revalidate ៖ HTML ➜ គ្មាន put · JS ➜ put — mutant ដក `responseFitsKey` ពី revalidate ➜ FAIL។
- `phone-search-swipe-test` · `phone-suggest-test` ៖ onFocus ហូតឡើងតាមខ្សែហៅពិត + ទិសផ្ទុយ · `clock-hygiene` · `loop-termination` · `sw-cache-failure-test` ធ្លាក់លើ tree មុនកែ (A60)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** (merge ចូល `main`) · build APK ថ្មី (workflow ពី `main`)។
2. iPhone PWA · Android PWA · APK ៖ ទំព័រទិន្នន័យ ➜ ចុចស្វែងរកលេខ ➜ ប្រអប់រអិលឡើង (មិនលោត) · keyboard បើកដោយទំព័រនៅនឹងកន្លែង · ចាកចេញពីប្រអប់ទទេ ➜ រអិលចុះវិញ។
   iPhone PWA ៖ មើលជាពិសេសថាទំព័រទាំងមូល (navbar ផង) **មិនធ្លាក់ចុះ ហើយរអិលឡើងវិញ** ពេល keyboard បើក (រោគសញ្ញាវីដេអូ 2.50.45 · A66 ៖ ចលនាចាប់ផ្តើមមុន focus) ➜ ឃើញ ➜ ផ្ញើវីដេអូ។
   ⚠️ ចលនាវាស់តែក្នុង Chromium (តំបន់ហាម ➜ ត្រូវសាកលើទូរស័ព្ទពិតទាំង ២ មុនចាត់ថារួច) · ⛔ PTR · អូសផ្ទាំង ត្រូវដដែល។
3. ទំព័រស្កេន ៖ ចុចប្រអប់ស្វែងរកបញ្ជីកញ្ចប់ (និងរបៀប Locker) ➜ ផ្ទាំងស្កេនបង្រួមដោយរអិល · លទ្ធផលនៅលើ keyboard · ចាកចេញពីប្រអប់ទទេ ➜ ផ្ទាំងស្កេនបើកវិញ · ស្កេនបន្តបាន។
   កាមេរ៉ាកំពុងស្កេន ➜ ចុចប្រអប់ស្វែងរក ➜ ផ្ទាំងនៅបើក ហើយប្រអប់មើលឃើញលើ keyboard (iPhone PWA ៖ iOS រំកិលបង្ហាញ)។
4. 🔔 ➜ «🔄 ពិនិត្យកំណែថ្មី» ៖ APK ពេល Release កំពុង build ➜ ចុចក្រោយ Release ចេញ ➜ ប៊ូតុងទាញយកលេចភ្លាម · PWA ➜ «Refresh ឥឡូវនេះ» ពេលមានកំណែថ្មី។
5. គ្មានការសាកពិសេសសម្រាប់ Supabase/SW (ការវាស់ក្នុងតេស្ត) · ⚠️ មុនដាក់ប្រើជាផ្លូវការ ៖ អាន Handoff ៦ (កូតា Firebase Spark · License Project · Netlify · Supabase · Push · `ZTO_PROXY_KEY`)។

### [2.50.45] — 2026-10-08 · ZoeW (iPhone PWA) ៖ **ចុចស្វែងរកលេខ ➜ navbar មិនរំកិល · ☰ · 🩺 បង្ហាញកំណែ iOS 26 ពិត** (រាយការណ៍ម្ចាស់គម្រោង · វីដេអូ)

**ZoeW `2.50.45`** (`zoew-v307` ➜ `zoew-v308`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `phone-search.ts` · `panels.ts` · `app.css`) មិនប៉ះ · Android/web មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone PWA ៖ ចុចស្វែងរកលេខ ➜ navbar ហាក់ «រមូរពីក្រោមឡើងលើ»** (វីដេអូ ៖ ទំព័រទាំងមូលធ្លាក់ចុះ ~១៩០px ហើយរអិលឡើងវិញ ~២០០ms ពេល keyboard បើក ·
  ករណីពីរដូចគ្នា)។ iOS រំកិល document ដើម្បីដាក់ប្រអប់កណ្តាល តាមទីតាំង *មុន* ការទាញឡើង (y≈៣៧០) ហើយ [2.50.42] ត្រឡប់ ០ កណ្តាលចលនានោះ។ ឥឡូវ iOS standalone ៖
  ការចុចលើប្រអប់ស្វែងរកលេខ (មិនទាន់ focus) ➜ App ទាញប្រអប់ឡើងមុន ហើយ `focus({ preventScroll: true })` ខ្លួនឯង ➜ iOS ឃើញប្រអប់នៅខាងលើរួច ➜ គ្មានហេតុរំកិល ·
  អូសលើប្រអប់ · សង្កត់យូរ · ចុចពេល focus រួច ➜ iOS ធម្មតា · focus មិនជាប់ ➜ ទាញចុះវិញ ហើយទុកការចុចបន្ទាប់ឲ្យ iOS។ ការត្រឡប់ ០ របស់ [2.50.42] នៅជាខ្សែការពារទីពីរ។
- 🐛 **☰ · 🩺 ៖ iPhone iOS 26.5 បង្ហាញ «iOS 18.7»** ៖ Safari លើ iOS 26 បង្កកលេខ OS ក្នុង user agent (18_6 ➜ 18_7) ដោយចេតនា ចំណែក «Version/26.x» នៅពិត ➜
  អាន `Version/` ពេល ≥ 26 · UA គ្មាន `Version/` (App លើ Home Screen) + OS បង្កក + engine Safari 26 (`CSS.supports` anchor positioning · scroll-driven animation) ➜
  «iOS 26+» · iOS 18 ពិត · Chrome iOS (OS ពិត) ➜ ដដែល · កៅអី Key ក្នុង ZoeKeyGen ទទួលកំណែថ្មីពេល App ពិនិត្យ License លើកក្រោយ។

#### អ្នកយាម

- `ZoeW/tests/ios-search-tap-focus.test.ts` (៩) ៖ ចុច ➜ `touchend` preventDefault · ទាញឡើងមុន focus · `preventScroll` · focus ពិត · ខ្សែភ្ជាប់ boot (capture · `touchend` មិន passive) ·
  ទិសផ្ទុយ ៖ អូស · សង្កត់យូរ · focus រួច · Android/web · អេក្រង់ធំ · ម្រាមដៃពីរ · `touchcancel` · ធាតុផ្សេង · event ចម្លែក (គ្មាន touches · `timeStamp` NaN) · fail-open —
  មុនកែ FAIL ៨/៨ · mutation ៩/៩ ចាប់បាន។
- `ZoeW/tests/device-info.test.tsx` (+៣) ៖ `Version/26.5` · `Version/26.5.1` ➜ «iOS 26.5» · គ្មាន Version + engine 26 ➜ «iOS 26+» · ទិសផ្ទុយ iOS 18.7/18.7.2/18.5 · Chrome iOS ·
  `Version/` លេខវែងមិនធម្មតា ➜ មិនយក — មុនកែ FAIL ២ · old↔new លើ UA ២២ ករណី ៖ ខុសតែ iPhone/iPad ដែល OS បង្កក។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** (merge ចូល `main`)។
2. iPhone (App លើ Home Screen) ៖ ចុចស្វែងរកលេខ ១០ ដង (ចុចធម្មតា · ក្រោយ «⋯» · ពេលបញ្ជីរមូរចុះ) ➜ ប្រអប់ឡើងទៅខាងលើ · keyboard បើក · navbar មិនធ្លាក់ ហើយរអិល ·
   បញ្ជីលេខនៅក្រោមប្រអប់។ នៅរំកិល ➜ ថតវីដេអូម្តងទៀត។
3. iPhone ៖ អូសចាប់ផ្តើមលើប្រអប់ស្វែងរក ➜ ទំព័ររមូរ (មិនបើក keyboard) · សង្កត់យូរ ➜ ម៉ឺនុយ «បិទភ្ជាប់» ធម្មតា · Android PWA/APK ៖ ស្វែងរកដដែល។
4. iPhone ៖ ☰ ឬ 🩺 ➜ «iOS 26.x» (ឬ «iOS 26+») មិនមែន «iOS 18.7» · ZoeKeyGen ៖ បន្ទាត់កៅអីរបស់ iPhone ប្រែតាម (ក្រោយ App ពិនិត្យ License)។

### [2.50.44] — 2026-10-08 · ZoeW · ZoeKeyGen ៖ **ស្គាល់ model · serial ទូរស័ព្ទ (APK · PWA) ➜ ☰ · 🩺 · កៅអី Key ក្នុង ZoeKeyGen** (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.44`** (`zoew-v306` ➜ `zoew-v307`) · **ZoeKeyGen `2.24.10`** (`zoekeygen-v120` ➜ `zoekeygen-v121`) · `license-verify.js` ថ្មី (ដូចគ្នាបេះបិទក្នុង ២ App) ·
**rules License ថ្មី** (`license_seats/…/<slot>/meta`) · Android ៖ plugin ក្នុង App ថ្មី `ZoeDevice` (`DeviceInfoPlugin.java`) · គ្មានសិទ្ធិ Android ថ្មី · គ្មាន env · migration។

#### អ្វីដែលខុសពីមុន

- 🆕 **☰ (ខាងក្រោម) និង 🩺 ពិនិត្យសុខភាពប្រព័ន្ធ (ខាងលើ) បង្ហាញ «📱 model · កំណែប្រព័ន្ធ» និង «🔖 Serial»** ៖ App Android = `Samsung SM-A546E · Android 14` + **Android ID**
  (ស្ថិតស្ថេរលើទូរស័ព្ទនោះ · នៅដដែលពេលដំឡើង App ឡើងវិញ · ប្តូរតែពេល Factory reset) · PWA Android = model ពី Chrome + **ID App ១៦ តួ** ·
  iPhone = «iPhone · iOS 17.5» + ID App (Safari មិនប្រាប់ model) · កុំព្យូទ័រ = ប្រព័ន្ធ + ID App។ serial ពិតរបស់ hardware អានមិនបាន (Android 10+ ហាម App ធម្មតា ·
  browser មិនផ្តល់) ➜ ការសម្រេចម្ចាស់គម្រោង ៖ Android ID / ID App។ ID App = ស្នាម SHA-256 នៃលេខសម្គាល់ License (⛔ មិនបង្ហាញលេខសម្គាល់កៅអីផ្ទាល់)។
- 🆕 **ZoeKeyGen ៖ បញ្ជី Key ក្រោមស្លាក 📱 កៅអីនីមួយៗមួយបន្ទាត់** ៖ `d1 · Samsung SM-A546E · Android 14 · 🔖 <serial> · ចងនៅ <ថ្ងៃ>` ➜ ដឹងថាកៅអីណាជាទូរស័ព្ទណា មុនដោះ។
  ZoeW ផ្ញើ model · serial ពេលពិនិត្យ Key (ផ្លូវ `claimSeat` ដដែល) តែពេលប្រែ · កៅអីដែលទូរស័ព្ទមិនទាន់បើក App កំណែនេះ ➜ `ID <៦ តួ>…` ដូចមុន។
- ព័ត៌មាននេះសម្រាប់មើលតែប៉ុណ្ណោះ ៖ ការសរសេរ meta បរាជ័យ (rules មិនទាន់ Publish · បណ្តាញ) មិនប៉ះ Activate ឬស្ថានភាព Key ទេ។

#### អ្នកយាម

- `ZoeW/tests/device-info.test.tsx` (ថ្មី · ១០) ៖ APK plugin ➜ model · Android ID · ផ្ញើ License · ឈ្មោះក្រុមហ៊ុនមិនស្ទួន · plugin បរាជ័យ ➜ UA · PWA UA កាត់ (K) ➜ userAgentData ·
  userAgentData ជាប់ ➜ UA ក្រោយពិដាន · ID App = SHA-256 ១៦ តួ មិនមែនលេខសម្គាល់ · iPhone · License មិនទាន់ផ្ទុក ➜ សាកម្តងទៀត · UI · ខ្សែភ្ជាប់ ☰ · 🩺 · boot។
- `license-seat-test` ផ្នែក ១៨ (ថ្មី · ១២) ៖ meta សរសេរ ១ ដងទៅកៅអីខ្លួនឯង · ⛔ សំណើ License ផ្សេងកំពុងរត់ ➜ meta មិនយកកន្លែងបណ្តាញ (ពិដាន ២) · ដដែល ➜ មិនសរសេរ · ⛔ `checkOnline()` គ្មាន `claimSeat` ➜ គ្មានការសរសេរ · 401 ➜ Key នៅ active ·
  មិនសាកម្តងទៀត · hang ➜ verdict មិនរង់ចាំ · Activate ថ្មី ➜ meta · គ្មាន meta ➜ មិនសរសេរ · ⛔ កៅអីអ្នកដទៃ · សម្អាតអត្ថបទ — មុនកែ ៖ FAIL ១៣។
- `emu/license-seat-rules-test` ផ្នែក ១៤ (ថ្មី · rules ពិតលើ emulator) ៖ meta លើកៅអីមាន ➜ ទទួល · កៅអីទំនេរ · ប្តូរ device · វាលបន្ថែម · ប្រវែង · ខ្វះ · ប្រភេទ ➜ បដិសេធ ·
  ព្រំដែន ៨០ · ៤០ · ៦៤ ➜ ទទួល — មុនកែ rules ៖ FAIL ៣។
- `keylist-consistency-test` (ថ្មី ៦) ៖ បន្ទាត់មួយក្នុងមួយកៅអី · model · platform · serial · HTML escape · «-» មិនបង្ហាញ · ⛔ លេខសម្គាល់កៅអីពេញមិនដល់ DOM — មុនកែ ៖ FAIL ៥។
- `npm run android:check` ៣គ (ថ្មី · ៦) ៖ ឈ្មោះ plugin ស្មើ JS · `registerPlugin` មុន `super.onCreate` · វាលដែល JS អាន · Android ID · ⛔ គ្មាន `READ_PHONE_STATE` / `getSerial()` · គ្មាន comment ·
  `npm run native:check` ៤ច (ថ្មី) ៖ `@capacitor/core` ពិត + header ពី Java ➜ boot ហៅ `info` ១ ដង ➜ ☰ «Samsung SM-A546E · Android 14» + Android ID។
- Java compile ជាមួយ framework Android ពិត + class Capacitor ពិត ➜ 0 error។
- ការផ្ទៀងផលប៉ះពាល់ (សំណើម្ចាស់គម្រោង) ៖ `checkOnline()` ចាស់ ↔ ថ្មី ១៦ ករណី ➜ verdict · កៅអីដូចគ្នាបេះបិទ (ការសរសេរបន្ថែមមានតែ `meta`) · ផ្លូវ Activation (`ensureAppActivated`) ដូច `main`
  បេះបិទ · helper ថ្មីទាំងអស់ ៖ ទិន្នន័យខុស ១៥–១៦ ប្រភេទ ➜ មិនគាំង · layout ៣២០ · ៣៩០ · ១២៨០ ៖ ☰ · 🩺 · 🔔 APK · បញ្ជី Key ZoeKeyGen ➜ គ្មានលើស/ជាន់ ·
  progress ទាញ APK ➜ re-render តែប្លុក APK (`notify-apk-link.test.tsx` ១៥ · មុនកែ ក្រុម 📦/📤 re-render រាល់ tick)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. ⚠️ **Firebase Console (License Project · ZoeKeyGen) ➜ Realtime Database ➜ Rules ➜ paste `ZoeKeyGen/firebase-database.rules.json` ➜ Publish** (វាល `meta` ក្នុងកៅអី)។
   មុន Publish ៖ ZoeW សរសេរ meta មិនបាន (ស្ងាត់ · Activate ធម្មតា) ➜ ZoeKeyGen បង្ហាញ `ID <៦ តួ>…` ដូចមុន។
2. Merge ចូល `main` ➜ Deploy ZoeW + ZoeKeyGen + workflow build APK 2.50.44។
3. ទូរស័ព្ទ ៖ ☰ ➜ ខាងក្រោមឃើញ «📱 <model> · Android <កំណែ>» និង «🔖 Serial (Android ID)» (APK) / «Serial (ID App)» (PWA · iPhone) · 🩺 ខាងលើដូចគ្នា ·
   បិទ/បើក App ➜ serial ដដែល។
4. ZoeKeyGen ➜ បញ្ជី Key ➜ ក្រោម 📱 ឃើញបន្ទាត់កៅអីនីមួយៗ (ក្រោយទូរស័ព្ទបើក App កំណែនេះ ហើយពិនិត្យ Key ម្តង ឬ Activate) ➜ serial ស្មើនឹងអ្វីដែលទូរស័ព្ទបង្ហាញ។

### [2.50.43] — 2026-10-08 · ZoeW (APK) ៖ **ទាញ APK ថ្មីក្នុង App ➜ ផ្ទាំងដំឡើង · ប៊ូតុងតែពេល Release ពិតមាន** (សំណើ · រាយការណ៍ម្ចាស់គម្រោង)

**ZoeW `2.50.43`** (`zoew-v305` ➜ `zoew-v306`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · Android ៖ plugin ក្នុង App ថ្មី `ZoeApkUpdate` (`ApkUpdatePlugin.java`) + សិទ្ធិ `REQUEST_INSTALL_PACKAGES` ➜ មានតែក្នុង APK ដែល build ពីកំណែនេះ · web/PWA មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- 🆕 **🔔 «📱 កំណែ App» លើ APK ៖ ទាញ APK ក្នុង App** ៖ link ចាស់បើក browser ក្រៅ ➜ ទាញចប់ តែគ្មានអ្វីលោតឲ្យដំឡើង (រាយការណ៍ម្ចាស់គម្រោង)។ ឥឡូវប៊ូតុង
  «📥 ទាញយក និងដំឡើង APK កំណែ X» ទាញក្នុង App (របារីកចម្រើន % · MB · ✖️ បោះបង់) ➜ ផ្ទាំងដំឡើងរបស់ Android លោតឡើង។ លើកដំបូង Android សួរ «អនុញ្ញាតពីប្រភពនេះ»
  (Install unknown apps) ➜ បើក ➜ ត្រឡប់មក ➜ ផ្ទាំងដំឡើងបើកបន្ត។ បរាជ័យ (បណ្តាញ · ឯកសារមិនពេញ · ទំហំផ្ទុក · ឈប់រីក ៤៥ វិ. ខណៈ App នៅលើអេក្រង់ — ចេញទៅ App ផ្សេង ➜ ទាញបន្ត) ➜ សារច្បាស់ ➜ ចុចម្តងទៀតបាន ·
  ចេញពី App ទៅ Settings/ផ្ទាំងដំឡើង ➜ ត្រឡប់មកមិនសុំ PIN។
- 🐛 **ប៊ូតុងបង្ហាញមុន APK ចេញ ➜ 404** (រាយការណ៍ម្ចាស់គម្រោង) ៖ Netlify ចេញ feed កំណែថ្មីភ្លាម ខណៈ workflow នៅ build APK · Release ដែលលុបចោល (2.50.41) ក៏ 404។
  ឥឡូវ App សួរ GitHub មុន ➜ ប៊ូតុងតែពេលឯកសារ APK ពិតមាន · មិនទាន់មាន ➜ «⏳ APK កំណែ X មិនទាន់មានលើ GitHub Release — App ពិនិត្យម្តងទៀតពេលបើក 🔔»
  (សួរម្តងទៀតក្រោយ ២ នាទី · ពិនិត្យមិនបាន ➜ ៣០ វិ.)។
- APK ដែលទាញទុកក្នុង cache ➜ លុបដោយខ្លួនឯងពេលបើក App ក្រោយដំឡើងរួច។

#### អ្នកយាម

- `ZoeW/tests/notify-apk-link.test.tsx` (សរសេរឡើងវិញ · ១៤) ៖ URL ដែល Java សាង = workflow ពិត · method JS ⊆ `@PluginMethod` · Release គ្មាន / កំពុងពិនិត្យ / ពិនិត្យមិនបាន ➜ គ្មានប៊ូតុង ·
  មាន ➜ ទាញក្នុង App ➜ progress ➜ excuse ➜ install · Settings ➜ អនុញ្ញាត ➜ excuse ថ្មី ➜ installer · បដិសេធ ➜ ណែនាំ · បរាជ័យ / 404 · ឈប់រីក ➜ បោះបង់ · App នៅខាងក្រោយ ➜ មិនរាប់ថាឈប់រីក (mutation ដកការពារនោះ ➜ ក្រហម) · ប៊ូតុងបោះបង់ ·
  ពិនិត្យម្តងទៀតតាមពេល · ទិសផ្ទុយ web/PWA · កំណែចុងក្រោយ — plugin mock ជា Proxy thenable ដូច Capacitor ពិត — មុនកែ ៖ FAIL ១១/១៣។
- `npm run native:check` ៤ង (ថ្មី · ២ សេណារីយ៉ូ) ៖ `@capacitor/core` ពិត + header ដេរីវេពី `@PluginMethod` ក្នុង Java ពិត ➜ Release គ្មាន ➜ គ្មានប៊ូតុង · មាន ➜ probe ➜
  addListener ➜ download ➜ install ➜ removeListener · គ្មាន «not implemented»។
- `npm run android:check` ៣ខ (ថ្មី · ១២) ៖ ឈ្មោះ plugin ស្មើ JS · `registerPlugin` មុន `super.onCreate` · `REQUEST_INSTALL_PACKAGES` · probe HEAD មិនតាម redirect · ពេលកំណត់ connect/read ·
  `.part` ➜ ពេញ ➜ ផ្ទៀង package + versionName · FileProvider · Settings ➜ installer · method JS ⊆ Java · event progress · Java គ្មាន comment។
- Java compile ជាមួយ framework Android ពិត + class Capacitor ពិត ➜ 0 error · `probe()` ពិតទៅ GitHub ៖ 2.50.42 ➜ 302 មាន · 2.50.41 ➜ 404 · កំណែមិនទាន់ build ➜ 404 (ផ្នែក ២ A45)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Merge ចូល `main` ➜ Deploy ZoeW + workflow build APK (Release `zoew-android-v2.50.43`)។
2. ⚠️ **APK 2.50.42 ដែលមានក្នុងទូរស័ព្ទនៅប្រើ link ចាស់** (plugin ថ្មីមានតែក្នុង APK 2.50.43) ➜ ដំឡើង APK 2.50.43 ដោយដៃម្តង (GitHub ➜ Releases ➜ ទាញ ➜ បើកពី Downloads)។
3. ពី 2.50.43 ទៅ ៖ ពេលកំណែបន្ទាប់ចេញ ➜ 🔔 ៖ (ក) ខណៈ workflow កំពុង build ➜ «មិនទាន់មាន» គ្មានប៊ូតុង · (ខ) build ចប់ ➜ បិទ/បើក 🔔 ក្រោយ ២ នាទី ➜ ប៊ូតុង ➜ ចុច ➜ របារីក ➜
   ផ្ទាំងដំឡើង ➜ «ដំឡើង» ➜ App ថ្មីបើក · ទិន្នន័យ · PIN · Activation នៅដដែល · លើកដំបូង ៖ «អនុញ្ញាតពីប្រភពនេះ» ➜ ត្រឡប់មក ➜ ផ្ទាំងដំឡើងបើកបន្ត · ✖️ បោះបង់ពេលកំពុងទាញ ➜ ប៊ូតុងវិញ។

### [2.50.42] — 2026-10-08 · ZoeW (iPhone PWA) ៖ **ស្វែងរកលេខ ➜ keyboard មិនរំកិលទំព័រឡើង/ចុះទៀត** (រាយការណ៍ម្ចាស់គម្រោង · វីដេអូ)

**ZoeW `2.50.42`** (`zoew-v304` ➜ `zoew-v305`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ ឯកសារចាក់សោ (PTR · ចលនាផ្ទាំង · `phone-search.ts`) មិនប៉ះ · Android/web មិនប្រែ។

#### អ្វីដែលខុសពីមុន

- 🐛 **iPhone PWA ៖ ស្វែងរកលេខ ➜ ចុច «⋯» ➜ ចុចស្វែងរកម្តងទៀត ➜ ទំព័រលោតឡើង** (navbar បាត់ · បញ្ជីលេខទូរស័ព្ទជាន់ម៉ោង · នៅដដែលរហូតបិទ keyboard ·
  ម្តងម្កាលលោតចុះ មានចន្លោះទទេខាងលើ) · Android PWA មិនអី (ម្ចាស់គម្រោងសាក)។ App ត្រឡប់ document ទៅ ០ តែពេល `visualViewport` `resize` ➜ ការរំកិលរបស់ keyboard ដែលមកក្រោយ
  resize (តាមល្បឿន ➜ ម្តងម្កាល) នៅជាប់។ ឥឡូវ iOS standalone ខណៈប្រអប់ស្វែងរកលេខទាញឡើង ៖ `scroll` លើ window ឬ `visualViewport` ➜ `restoreIOSDocumentScroll()` ➜ ០
  (root ចាក់សោ ➜ document រំកិល = artifact) · ប្រអប់ផ្សេងនៅឲ្យ iOS រំកិលបង្ហាញដដែល។
- ⚠️ **មិនទាន់វាស់លើ iPhone ពិត** ៖ Chromium មិនមាន keyboard iOS ➜ មូលហេតុសន្និដ្ឋានពីរូបវីដេអូ (ផ្នែក ២ A44) ➜ ត្រូវសាក (សកម្មភាព ២)។

#### អ្នកយាម

- `ZoeW/tests/ios-search-viewport.test.ts` (៦) ៖ iOS standalone + ស្វែងរកទាញឡើង ៖ document រំកិល (window · `visualViewport`) ➜ `scrollTo(0, 0)` · ខ្សែភ្ជាប់ boot ·
  ទិសផ្ទុយ ៖ Android/web · ប្រអប់ផ្សេង · document មិនរំកិល · ការរមូរខាងក្នុង ➜ មិនប៉ះ — មុនកែ ៖ module/ខ្សែភ្ជាប់គ្មាន · mutation ៥/៥ ចាប់បាន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** (merge ចូល `main`)។
2. iPhone (App លើ Home Screen) ៖ ចុចស្វែងរកលេខ ➜ ចុច «⋯» ➜ ចុចស្វែងរកម្តងទៀត (សាក ៥ ដង) · ចុចស្វែងរកធម្មតា (៥ ដង) ➜ navbar និងប្រអប់ស្វែងរកនៅខាងលើ · បញ្ជីលេខនៅក្រោមប្រអប់ ·
   គ្មានចន្លោះទទេ។ នៅលោត ➜ ថតវីដេអូម្តងទៀត។
3. Android PWA ៖ ស្វែងរកដដែល (គួរតែមិនប្រែ)។

### [2.50.41] — 2026-10-08 · ZoeW + ZoeKeyGen ៖ **ចូលប្រព័ន្ធ និង Private Key ស្គាល់ Google Password Manager · iOS Passwords · Private Key ដែលចម្លងមក Load បាន** (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.41`** (`zoew-v303` ➜ `zoew-v304`) · **ZoeKeyGen `2.24.9`** (`zoekeygen-v119` ➜ `zoekeygen-v120`) · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 🔑 **ZoeKeyGen Private Key ↔ password manager** ៖ `<textarea>` (password manager មិនបំពេញ textarea) ➜ `<input type="password" autocomplete="current-password">` ក្នុង
  `#signingKeyForm` ជាមួយ username លាក់ «ZoeKeyGen Signing Key» (entry ដាច់ពីគណនី Admin) · Enter/«📥 Load Key» = submit (`data-on="submit"` · `preventDefault()`) ·
  Load ជោគជ័យ ➜ form លាក់ (browser ដឹងថាការចូលជោគជ័យ ➜ សួររក្សាទុក) · «🗑️ សម្អាត» ➜ form លេចវិញ។
- 🔐 **ZoeKeyGen ចូល Supabase Admin** ៖ អ៊ីមែល/ពាក្យសម្ងាត់មិននៅក្នុង `<form>` (browser មិនសួររក្សា) ➜ `#sbAdminForm` · submit ➜ `sbAdminLogin(event)` · ចូលរួច ➜ form លាក់ · ចាកចេញ ➜ លេចវិញ។
- 🏷️ **`name`** លើប្រអប់ចូលប្រព័ន្ធគ្រប់កន្លែង (ZoeW ៖ ចូល · ចុះឈ្មោះ · ប្តូរពាក្យសម្ងាត់ · ZoeKeyGen ៖ ចូល · Supabase Admin)។
- 🧹 **Private Key ដែលចម្លងមក** (រាយការណ៍ម្ចាស់គម្រោង ៖ «generate ពី ZoeKeyGen ខ្លួនឯង copy ដាក់អត់ស្គាល់») ៖ `normalizeSigningKeyText()` ដក « » “ ” ·
  តួមើលមិនឃើញ (ZWSP · BOM · NBSP) · បន្ទាត់បាក់កណ្តាលតម្លៃ · អត្ថបទជុំវិញ · `'` ➜ JWK ស្អាតតែ `kty·crv·d·x·y` (`key_ops` · `ext` របស់ `exportKey` ដកចេញ) · Public Key ➜ «នេះជា Public Key» ·
  មិនមែន JSON ➜ សារ JSON · ⛔ កំហុសអ្នកប្រើលែងផ្ញើ Sentry។ ការវាស់ ៖ key ដែលទើបបង្កើតអាន JSON បាន ប៉ុន្តែផ្ទៀងផ្ទាត់នឹង Public Key ក្នុង `license-verify.js` ➜ `signature` ➜
  **Keypair ថ្មី Load មិនបានដោយការរចនា** រហូតដល់ Public Key ថ្មីចូល App ទាំងអស់ ➜ សារ និងប្រអប់ Keypair ថ្មីប្រាប់ឲ្យដាក់ Public Key ក្នុង `license-verify.js` ហើយ Deploy។

#### អ្នកយាម

- `ZoeW/tests/login-autofill.test.tsx` (៧) ៖ `LoginModal` ពិត (Firebase/Supabase · ចូល/ចុះឈ្មោះ/ប្តូរ) ៖ ពាក្យសម្ងាត់ក្នុង form + submit + username មុនវា + `name` ·
  ទិសផ្ទុយ ៖ កូដអញ្ជើញ `off` · កូដប្តូរ `one-time-code` — មុនកែ FAIL ៥/៧។
- `layout-check` (browser ពិត · ZoeKeyGen) ៖ ពាក្យសម្ងាត់ ៣ ជា `current-password` ក្នុង form ត្រឹមត្រូវ · Private Key = `<input type="password">` + username លាក់ · PIN `off` ·
  `requestSubmit()` ➜ សកម្មភាពពិតរត់ · ⛔ URL មិនប្រែ — មុនកែ FAIL ៥។
- `keygen-session-security-test` (+១១) ៖ ចម្លង ៧ ប្រភេទ ➜ Load + JWK ស្អាតទៅ `signNewKey` · Public Key/មិនមែន JSON/RSA ➜ សារត្រូវ គ្មាន Sentry · Keypair ថ្មី ➜ សារ Deploy — មុនកែ FAIL ១១។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** + **ZoeKeyGen** (merge ចូល `main`)។
2. ZoeKeyGen (iPhone Safari/PWA · Android Chrome) ៖ បិទភ្ជាប់ Private Key ➜ Load ➜ browser សួររក្សា ➜ រក្សា · Refresh ➜ ចុចប្រអប់ Private Key ➜ ជ្រើស «ZoeKeyGen Signing Key» ➜
   Load · ចូល Supabase Admin ➜ សួររក្សា · ចម្លង Private Key ពី Notes/chat ➜ Load បាន។
3. ZoeW ៖ ចូលប្រព័ន្ធ ➜ សួររក្សាពាក្យសម្ងាត់ ➜ លើកក្រោយ ចុចប្រអប់ឈ្មោះគណនី ➜ ជ្រើសគណនី។
4. ⛔ Keypair ថ្មី ៖ ផ្ញើ Public Key ថ្មីមក Claude (ឬដាក់ខ្លួនឯង) ក្នុង `ZoeW/public/license-verify.js` និង `ZoeKeyGen/license-verify.js` (byte-identical) ➜ Deploy ➜ ទើប Load Private Key ថ្មីបាន (Key ចាស់ទាំងអស់នឹងផ្ទៀងផ្ទាត់មិនកើត)។

### [2.50.40] — 2026-10-08 · ZoeW ៖ **PWA លើ Android ចងក្រយៅដៃ/មុខបាន (passkey · WebAuthn PRF)** (រាយការណ៍ម្ចាស់គម្រោង)

**ZoeW `2.50.40`** (`zoew-v302` ➜ `zoew-v303`) · ⛔ ZoeKeyGen មិនប្រែ (កែរួចពីមុន) · គ្មាន rules · env · migration ថ្មី · ⛔ PRF-only ដដែល។

#### អ្វីដែលខុសពីមុន

- 🐛 **Android PWA ៖ «❌ មិនអាចចងក្រយៅដៃ ឬមុខបានទេ — … (WebAuthn PRF)» ទោះទូរស័ព្ទគាំទ្រ** (រូបពីម្ចាស់គម្រោង · APK មិនអី ព្រោះប្រើក្រយៅដៃ native) —
  ZoeW បង្កើត credential `residentKey: 'discouraged'` ➜ Android (Google Password Manager) ផ្តល់ PRF តែលើ **passkey** (discoverable) ➜ `prf.enabled: false` ➜
  «មិនគាំទ្រ» ក្លែងក្លាយ។ ZoeKeyGen កែកំហុសដដែលរួច (ផ្នែក ១ «ZoeKeyGen ៖ ក្រយៅដៃ/មុខ «មិនគាំទ្រ» លើ Android») តែ ZoeW មិនទាន់ ➜ ថ្នេររវាង ២ App។
- ឥឡូវ ZoeW ដូច ZoeKeyGen ៖ `residentKey: 'required'` · PRF ដែល `create()` ផ្តល់ផ្ទាល់ ➜ ប្រើភ្លាម (ស្កេនតែម្តង · `biometricPrfFirst()`) · `prf: {}` គ្មាន `enabled` ➜ សួរ `get()` ·
  បោះបង់ការស្កេនទី ២ ➜ «❌ បានបោះបង់ …» (`biometricPrfEval()` បោះ) មិនមែន «មិនគាំទ្រ» · សារមិនគាំទ្រណែនាំ «លើ Android ៖ រក្សា passkey ក្នុង Google Password Manager ឬប្រើ App ZoeW សម្រាប់ Android» ·
  `biometricPrfFirst` · `biometricPrfEval` · `biometricPrfBytes` ដូចគ្នាបេះបិទទាំង ២ App (`shared-fns` ដកចេញពីបញ្ជី «បែកគ្នាដោយចេតនា»)។
- កំណត់ត្រាដែលចងរួច (iPhone) ដើរដដែល (`get()` តាម credential id)។ ការចងម្តងៗបង្កើត passkey «ZoeW» ថ្មីក្នុងកម្មវិធីគ្រប់គ្រងពាក្យសម្ងាត់ (លុបចាស់បានក្នុងកម្មវិធីនោះ)។

#### អ្នកយាម

- `ZoeW/tests/biometric-android-prf.test.ts` (៦) ៖ WebAuthn ក្លែងតាម Android (PRF តែ passkey) ៖ ស្នើ `residentKey: 'required'` ➜ ចង + ស្រាយ PIN · PRF ក្នុង `create()` ➜ `get()` ០ ដង ·
  `prf: {}` ➜ `get()` ១ ដង · បោះបង់ស្កេនទី ២ ➜ «បោះបង់» · `enabled: false` ➜ មិនចង + Google Password Manager — មុនកែ FAIL ៥/៦ · mutation ៥/៥ ចាប់បាន។
- `biometric-unlock-test` (sandbox ត្រូវការ `biometricPrfFirst` · `biometricPrfEval`) · `keygen-biometric-test` ២៧ · `shared-fns` (គ្មានការបែកគ្នាមិនរំពឹង)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** (merge ចូល `main`)។
2. Android Chrome (PWA) ៖ ⚙️ ➜ 🔐 ចូលដោយក្រយៅដៃ ឬមុខ ➜ PIN ➜ ស្កេនក្រយៅដៃ (បើសួរ ➜ រក្សាក្នុង Google Password Manager) ➜ ✅ · បិទ/បើក App ➜ ដោះសោដោយក្រយៅដៃ។
3. iPhone PWA ៖ បិទ ➜ បើក 🔐 ម្តងទៀត ➜ ✅ (passkey iCloud Keychain)។

### [2.50.39] — 2026-10-08 · ZoeW ៖ **🔔 «កញ្ចប់ជិតផុតកំណត់» និង «កញ្ចប់ដែលដករួច» ជាក្រុមពន្លាដូចម៉ឺនុយ ☰ · មើលបានគ្រប់កញ្ចប់** (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.39`** (`zoew-v301` ➜ `zoew-v302`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ PTR · ចលនាផ្ទាំង · ការរមូរ មិនប៉ះ។

#### អ្វីដែលខុសពីមុន

- 🔔 **ក្រុមពន្លា** ៖ «📦 កញ្ចប់ជិតផុតកំណត់» និង «📤 កញ្ចប់ដែលដករួច» ប្រើ `DrawerGroup` ដដែលនឹង category ក្នុង ☰ (ដកចេញពី `SideDrawer.tsx` ជា component រួម) ៖
  បិទជាលំនាំដើម · ក្បាលបង្ហាញចំនួនកញ្ចប់ (`—` = វាស់មិនបាន · ពណ៌លឿងពេលមាន) និង «ថ្មី N» (📤) · ចុចក្បាល ➜ ពន្លា/បិទ · ចងចាំក្នុង `zoew_drawer_groups_v1` ដូច ☰
  (`notifyGroupExpiry` · `notifyGroupRemoved` · ក្រុមនីមួយៗឯករាជ្យ · ☰ មិនប្រែ) · `openNotifyDrawer()` អានស្ថានភាពនោះ (`refreshDrawerGroups()`)។
- 📜 **មើលបានគ្រប់កញ្ចប់** ៖ បញ្ជីលែងកាត់ត្រឹម ៦០ ជួរ («… និង N ជួរទៀត») ➜ ទំព័រ ២០ (`NOTIFY_PAGE_ROWS`) · ទាញបន្ថែមពេលរមូរ `.drawer-body` ដល់ចុងបញ្ជី ឬចុច
  «⬇️ បង្ហាញ … ទៀត» · ជួរគូរតែពេលក្រុមពន្លា (`lazy` ➜ ផ្ទាំងបិទមិនគូរជួររាប់រយរាល់ការ sync)។
- 🆕 **«ថ្មី» ក្នុង 📤 = បានឃើញពិត** ៖ រាប់ថាបានមើលតែពេលក្រុម 📤 ពន្លា ខណៈបិទផ្ទាំង 🔔 · បើក ☰ ពីលើ · ឬបិទក្រុម (`toggleNotifyGroup`) ➜ ក្រុមបិទ ➜ លេខក្រហមនៅ។
- 🐛 កញ្ចប់ដករួចលើស ៦០ ជួរ ➜ លេខក្រហមលើ 🔔 នៅជាប់រហូត (ផ្នែក ២ A41) ➜ ឥឡូវរាប់ថាបានមើលគ្រប់ជួរ។

#### អ្នកយាម

- `ZoeW/tests/notify-groups.test.tsx` (៨) ៖ បិទជាលំនាំដើម · ក្បាលជាប៊ូតុង + ចំនួន · ពន្លា ➜ ២០ · «បង្ហាញ … ទៀត» ➜ គ្រប់ ៧៥/៧០ ជួរ · ចងចាំ + ឯករាជ្យ + ☰ មិនប្រែ ·
  «ថ្មី» តាមក្រុម (បិទ ➜ មិនរាប់ · ពន្លា ➜ គ្រប់ ៧០) · បិទក្រុម/☰ ➜ បានមើល · `—` ពេលវាស់មិនបាន · `0` ពេលគ្មាន — មុនកែ FAIL ៧/៨ · mutation ១០/១០ ចាប់បាន។
- `layout-check` (browser ពិត) ៖ ក្បាល 📤 បិទជាលំនាំដើម · ចំនួន + «ថ្មី» · ក្បាលមិនលើស ឈ្មោះមិនគាបតូច ៣២០ · ៤១២ · ពន្លា ➜ ២០ · រមូរ `.drawer-body` ដល់ចុងបញ្ជី ➜ ៤០ —
  មុនកែ FAIL ៤ · mutation root `el.parentElement` (ធាតុមិនរមូរ) ➜ ៥០ ភ្លាម ➜ ចាប់បាន។
- `tests/notifications.test.tsx` · `tests/push-client.test.tsx` ៖ ពន្លាក្រុមមុនពិនិត្យបញ្ជី (ច្បាប់ដដែល ៖ ចាកចេញ ➜ លេខទូរស័ព្ទមិនសល់ក្នុង DOM · 🧹 មិនប៉ះបញ្ជីកញ្ចប់)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ (merge ចូល `main`)។
2. សាក ៖ 🔔 ➜ ក្រុមទាំងពីរបិទ (ចំនួននៅក្បាល) ➜ ចុចពន្លា ➜ បញ្ជី · រមូរដល់ចុង ➜ ទាញបន្ថែម · បិទ/បើក App ➜ ក្រុមដែលពន្លានៅពន្លា · 📤 ៖ ក្រុមបិទ ➜ បិទ 🔔 ➜
   លេខក្រហមនៅ · ពន្លា ➜ បិទ 🔔 ➜ លេខក្រហមរបស់ 📤 បាត់។

### [2.50.38] — 2026-10-08 · ZoeW ៖ **🔔 ៖ link ទាញយក APK កំណែថ្មី · ផ្ទាំង 🔔 ធំជាងលើកុំព្យូទ័រ** (សំណើម្ចាស់គម្រោង)

**ZoeW `2.50.38`** (`zoew-v300` ➜ `zoew-v301`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 📥 App Android (APK) ៖ ពេល feed (`announcements.json`) មានកំណែថ្មីជាង `APP_VERSION` ➜ ផ្ទាំង 🔔 «📱 កំណែ App» បង្ហាញប៊ូតុង **📥 ទាញយក APK កំណែ X**
  ➜ ឯកសារ `ZoeW-X.apk` ក្នុង GitHub Release `zoew-android-vX` (repo public · workflow `android-release.yml` បង្កើតពី `main`) · បើកក្រៅ App (browser ទាញយក) ·
  web/PWA គ្មាន link (ទាញកំណែថ្មីដោយខ្លួនឯង) · កំណែពី feed ដែលមិនមែន X.Y.Z ➜ គ្មាន link។
- 🖥️ ផ្ទាំង 🔔 លើកុំព្យូទ័រ (≥ 992px) ៖ ទទឹង ៣២០ ➜ ៤០០px · ទូរស័ព្ទ និង ☰ ដូចដើម។
- `guide.html` ៖ «📱 កំណែ App» ពន្យល់ប៊ូតុងទាញយក APK។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ (merge ចូល `main` ➜ workflow បង្កើត Release `zoew-android-v2.50.38`)។
2. សាក ៖ APK កំណែចាស់ (ឧ. 2.50.25) ➜ 🔔 ➜ «📥 ទាញយក APK កំណែ …» ➜ browser ទាញយក ➜ ដំឡើងជាន់ ➜ ទិន្នន័យនៅដដែល · កុំព្យូទ័រ ៖ 🔔 ធំជាងមុន · ទូរស័ព្ទដូចដើម។

#### អ្នកយាម

- `ZoeW/tests/notify-apk-link.test.tsx` (ថ្មី · ៤) ៖ URL = ស្លាក + ឈ្មោះឯកសារដែល `android-release.yml` ពិតបង្កើត (ថ្នេរ ២ ឯកសារ) · APK + កំណែថ្មី ➜ link `target=_blank` ·
  web ➜ គ្មាន · កំណែចុងក្រោយ ➜ គ្មាន · កំណែមិនមែន X.Y.Z ➜ គ្មាន URL (មុនកែ FAIL ២) · `layout-check` ៖ 🔔 ៤១២ ➜ ៣២០ · ១២៨០ ➜ ៣៨០–៤៤០ · ☰ ៣២០ (មុនកែ FAIL ១)។

### [2.50.37] — 2026-10-08 · ZoeW (APK) ៖ **ប្រអប់សុំសិទ្ធិលែងចាក់សោ App · Back លើប្រអប់ចូលបង្រួម App · keyboard លែងគណនា style គ្រប់ធាតុ · រូបតំណាងរបា navigation តាមផ្ទៃពិត** (Deep audit ២ · ជុំ ១៥ · NATIVE-1 · NATIVE-3 · NATIVE-7 · NATIVE-8)

**ZoeW `2.50.37`** (`zoew-v299` ➜ `zoew-v300`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ PTR · ចលនាផ្ទាំង · ការរមូរ មិនប៉ះ។

#### អ្វីដែលខុសពីមុន

- 🔐 **NATIVE-1** ៖ ប្រអប់សុំសិទ្ធិរបស់ Android (កាមេរ៉ាសម្រាប់ QR Setup Link · ការជូនដំណឹង) ផ្អាក Activity ➜ `pause`/`resume` ➜ App ចាក់សោពេលត្រឡប់ពីប្រអប់។
  ឥឡូវ `noteAppLockExcuse()` មុនប្រអប់ (Push ៖ តែពេលប្រអប់អាចលេច — សិទ្ធិមិនទាន់ granted/denied)។
- ◀️ **NATIVE-3** ៖ Back លើប្រអប់ចូល / Activation (មិនបិទបាន) មិនធ្វើអ្វី ➜ អ្នកប្រើជាប់។ ឥឡូវ Back លើអេក្រង់ឫស (`ROOT_SCREEN_MODALS`) បង្រួម App · ប្រអប់ `noDismiss` ផ្សេង
  (ប្រអប់លេខទូរស័ព្ទ) នៅស៊ី Back ដូចដើម · ប្រអប់ផ្សេងពីលើប្រអប់ចូល ➜ Back បិទវាមុន។
- ⌨️ **NATIVE-7** ៖ keyboard APK ប្តូរកម្ពស់ WebView ➜ `--fs-unit` (clamp ជាមួយ `vw`) មិនចុះឈ្មោះ ➜ Chromium គណនា style ឡើងវិញគ្រប់ធាតុ (ទោះតម្លៃមិនប្រែ)។
  ឥឡូវ `@property --fs-unit { syntax: '<length>' }` (`react-root.css`) ➜ គណនាជា px នៅ `:root` ➜ ការប្តូរកម្ពស់គណនាតែធាតុមួយចំនួន · ទំហំអក្សរដូចដើម។
- 🧭 **NATIVE-8** ៖ រូបតំណាងរបា navigation កំណត់ LIGHT ម្តងពេលចាប់ផ្តើម ➜ ប្រអប់បើក (ផ្ទៃងងឹត) ➜ រូបតំណាងខ្មៅលើផ្ទៃងងឹត។ ឥឡូវវាស់ផ្ទៃនៅ inset ខាងក្រោម
  ដូចរបាស្ថានភាព (`measureNavigationBarTone()` · `SafeAreaProbe` `padding-bottom`) ហើយប្តូរតែពេលប្រែ (`appliedNav`)។
- 🌗 **NATIVE-4** (វាស់ឋិតិវន្ត · មិនកែ) ៖ Theme `DayNight` មិនប៉ះទំព័រ web (គ្មាន `color-scheme` · targetSdk 36 បិទ algorithmic darkening) · `windowBackground` = `--body-bg` រួច ➜
  នៅសល់តែប្រអប់ JS (`alert`/`confirm`) ដែលតាមរបៀបងងឹតរបស់ប្រព័ន្ធ ➜ ត្រូវវាស់លើទូរស័ព្ទពិត (សកម្មភាព ៣)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. សាក APK (សោ App បើក) ៖ Config ➜ ស្កេន QR ➜ ប្រអប់សិទ្ធិកាមេរ៉ា ➜ អនុញ្ញាត ➜ មិនសុំ PIN · 🔔 ➜ បើក Push ➜ ប្រអប់សិទ្ធិ ➜ មិនសុំ PIN · ចាកចេញ ➜ ប្រអប់ចូល ➜ Back ➜ App បង្រួម ·
   ប៉ះប្រអប់ស្វែងរកលេខ ➜ keyboard បើករលូន · បើកប្រអប់ ➜ រូបតំណាងរបា navigation ស · បិទ ➜ ខ្មៅ។
3. ទូរស័ព្ទរបៀបងងឹត (Dark theme) ៖ ប្រអប់ «បញ្ជាក់» (ឧ. បោះបង់កញ្ចប់) មើលទៅអាន់អានឬទេ? (NATIVE-4 ៖ ប្រាប់មកវិញ បើចង់ឲ្យភ្លឺជានិច្ច)

#### អ្នកយាម

- `tests/native/app-lock-away.test.tsx` (+២) · `tests/push-client.test.tsx` (+១) ៖ ប្រអប់សិទ្ធិ (pause ➜ resume ក្នុងការសុំ) ➜ មិនចាក់សោ · សិទ្ធិមានរួច ➜ មិនបើកការលើកលែង (មុនកែ FAIL ២) ·
  `tests/native/native-back.test.tsx` (+២) ៖ ប្រអប់ចូល/Activation ➜ បង្រួម · ប្រអប់ពីលើ ➜ បិទវាមុន (មុនកែ FAIL ១) · `perf-check` keyboard ៖ ប្តូរកម្ពស់ ៧៥៩ ➜ ៨ ធាតុ ·
  probe ទទឹង ១៧១៥ (មុនកែ FAIL ១) · `npm run native:check` ៤ឃ២ ៖ safe-area ខាងក្រោម ៤៨px ➜ ប្រអប់បើក DARK · បិទ LIGHT (មុនកែ FAIL ១ ៖ LIGHT)។

### [2.50.36] — 2026-10-08 · ZoeW ៖ **banner កំណែថ្មីលែងគ្របរបា Tab · បញ្ជី ZTO ទាញជាទំព័រពិត · ជួរ 🔔 បង្ហាញ Locker ពេញ · ប្រអប់ PIN ចុច Enter បាន** (Deep audit ២ · ជុំ ១៥ · UI-3 · UI-4 · UI-5/6 · UI-7)

**ZoeW `2.50.36`** (`zoew-v298` ➜ `zoew-v299`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី · ⛔ PTR · ចលនាផ្ទាំង · ការរមូរ មិនប៉ះ។

#### អ្វីដែលខុសពីមុន

- 🔄 **UI-3** ៖ banner «មានកំណែថ្មី» (`position: fixed; bottom: 0; z-index: 990`) គ្របរបា Tab ខាងក្រោម (z-index 900) លើទូរស័ព្ទ/ថេប្លេត ➜ ចុចប្តូរទំព័រមិនបាន។
  ឥឡូវ < 992px ៖ banner នៅពីលើរបា (`bottom: var(--tabbar-height)`) · របាលាក់ (`chrome-hidden`) ➜ ចុះដល់បាត · desktop (របាខាងលើ) ដូចដើម។
- 📋 **UI-4** ៖ បញ្ជី ZTO «មិនទាន់បិទ» ៖ root របស់ IntersectionObserver ជា `.zto-sync-list` (មិនរមូរ) ➜ sentinel «ប្រសព្វ» ជានិច្ច ➜ ទាញគ្រប់ទំព័រភ្លាម (២០០ barcode SVG ពេលបើក)។
  ឥឡូវ root = `.modal-content` (ធាតុដែលរមូរពិត) ➜ ទំព័រ ២០ ហើយទាញបន្ថែមពេលរមូរជិតចុង។
- 📦 **UI-5/6** ៖ ជួរ 🔔 «ជិតផុតកំណត់» · «ដករួច» កាត់ព័ត៌មាន (ចំនួន · Locker) ដោយ «…» ហើយលើទូរស័ព្ទ ៣២០px ព័ត៌មានគាបដល់ ០px ➜ ឥឡូវបត់ចុះបន្ទាត់ថ្មី មិនកាត់។
- 🔒 **UI-7** ៖ ប្រអប់ PIN ៖ ចុច Enter មិនធ្វើអ្វី · cursor មិននៅក្នុងវាល PIN ➜ ឥឡូវ Enter = ផ្ទៀងផ្ទាត់ (`<form onSubmit>` ➜ `submitSecurityPinForm`) · កុំព្យូទ័រ focus វាល PIN ភ្លាម ·
  ទូរស័ព្ទមិន focus (keyboard មិនលោតគ្រប)។
- run-all ៖ ចំណងជើងផ្នែក «តេស្តឥរិយាបថ» ប្រាប់ការពិត (កូដពិតពី `ZoeW/src` តាម audit build · `ZoeKeyGen/app.js`)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. សាក ៖ ទូរស័ព្ទ ៖ ពេល banner «មានកំណែថ្មី» លេច ➜ របា Tab នៅមើលឃើញ និងចុចបាន · 🔔 ➜ ជួរដែលមាន Locker វែងបង្ហាញពេញ ·
   បញ្ជី ZTO «មិនទាន់បិទ» ច្រើន ➜ បើកលឿន ហើយរមូរចុះទាញបន្ថែម · កុំព្យូទ័រ ៖ Config ➜ វាយ PIN ➜ Enter។

#### អ្នកយាម

- `layout-check` (browser ពិត · ផ្នែកថ្មី ៤) ៖ banner នៅពីលើរបា Tab · `chrome-hidden` ➜ បាត · desktop បាត (មុនកែ FAIL ១) · បញ្ជី ZTO ២០០ ➜ បើកគូរ ២០ · រមូរ ➜ ទំព័របន្ទាប់
  (មុនកែ FAIL ២ ៖ គូរ ២០០ ភ្លាម) · ជួរ 🔔 ៣២០/៤១២ ៖ មិនកាត់ · ព័ត៌មាន ≥ ៤០% នៃជួរ (មុនកែ FAIL ២ ៖ «…» · ទទឹង ០/៤៥px) · ប្រអប់ PIN ៖ focus · Enter ➜ ផ្ទៀងផ្ទាត់ ·
  ទូរស័ព្ទមិន focus (មុនកែ FAIL ២) · `app-lock-test` ១៦២ · `pin-prompt-test` ៧៧ · `lookup-prefetch-test` ២៦៤ (sandbox ៖ `isMobileDevice` · `focusField`)។

### [2.50.35] — 2026-10-08 · ZoeW ៖ **session ផុត/ចាកចេញ ខណៈ ☰ បើក ➜ ប្រអប់ចូលលែងនៅក្រោមរបា Slide** (Deep audit ២ · ជុំ ១៥ · UI-2)

**ZoeW `2.50.35`** (`zoew-v297` ➜ `zoew-v298`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 🚪 **UI-2** ៖ `clearSensitiveModalFields()` (ហៅពី `showLoginModalWithPrefill()`) បិទ 🔔 តែមិនបិទ ☰ ➜ ប្រអប់ចូលបើកនៅក្រោមរបា Slide (ស្រទាប់ខ្ពស់ជាង) ➜ អ្នកប្រើឃើញម៉ឺនុយ មិនឃើញប្រអប់ចូល។
  ឥឡូវការសម្អាត session បិទ ☰ តាម state (`uiState.drawerOpen = false`) · ⛔ មិនមែន `closeSideDrawer()` (វាសម្គាល់ 🔔 ថា «បានឃើញ») · ⛔ លំដាប់ស្រទាប់មិនប្រែ។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. សាក ៖ បើក ☰ ➜ ទុកឲ្យ session ៤ ម៉ោងផុត (ឬចាកចេញពីឧបករណ៍ផ្សេងសម្រាប់ហាង Supabase) ➜ ប្រអប់ចូលនៅខាងលើ · ☰ បិទ។

#### អ្នកយាម

- `ZoeW/tests/login-over-drawer.test.tsx` (ថ្មី · ៣ · React ពិត) ៖ ☰ បើក ➜ `showLoginModalWithPrefill()` ➜ ☰ បិទ · ប្រអប់ចូលបើក (មុនកែ FAIL ១) ·
  ទិសផ្ទុយ ៖ 🔔 មិនត្រូវសម្គាល់ «បានឃើញ» (mutation `closeSideDrawer()` ➜ FAIL ១)។

### [2.50.34] — 2026-10-08 · ZoeW ៖ **កុំព្យូទ័រ ៖ បិទប្រអប់ខណៈ cursor នៅក្នុងប្រអប់អក្សរ ➜ scanner ដៃទទួល focus វិញ** (Deep audit ២ · ជុំ ១៥ · UI-1)

**ZoeW `2.50.34`** (`zoew-v296` ➜ `zoew-v297`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- ⌨️ **UI-1** ៖ បិទប្រអប់ (Escape · Enter · ប៊ូតុង) ខណៈ cursor នៅក្នុងប្រអប់អក្សររបស់ប្រអប់នោះ ➜ `safeFocusScanner()` ឃើញ `document.activeElement` នៅជាប្រអប់អក្សរនោះ
  (browser ផ្លាស់ focus ចេញពីធាតុដែលលាក់តែនៅការគូរបន្ទាប់) ➜ ឈប់ ➜ focus ធ្លាក់ទៅ `body` ➜ ការស្កេនបន្ទាប់ពី scanner ដៃបាត់។ ឥឡូវប្រអប់អក្សរនៅក្នុង `.modal`
  ពេលគ្មានប្រអប់បើក មិនរារាំង scanner ទៀត (`activeElementIsInModal()`) · ប្រអប់អក្សរខាងក្រៅប្រអប់ (ស្វែងរកលេខ) នៅរក្សា focus ដូចដើម។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. សាក (កុំព្យូទ័រ + scanner ដៃ) ៖ បើកប្រអប់ «អត្រាប្រាក់» ➜ ចុចក្នុងប្រអប់អក្សរ ➜ Escape ➜ ស្កេន Barcode ភ្លាម ➜ ប្រអប់លេខទូរស័ព្ទបើក។

#### អ្នកយាម

- `ZoeW/tests/scanner-focus-after-close.test.tsx` (ថ្មី · ៤ · React ពិត) ៖ បិទ ➜ focus `hwScannerInput` (មុនកែ FAIL ១ ៖ នៅ `exchangeRateInput`) · ទិសផ្ទុយ ៖ ប្រអប់ក្រោមនៅបើក ➜ មិនលួច ·
  ប្រអប់អក្សរខាងក្រៅប្រអប់ ➜ focus នៅដដែល · mutation (ដកលក្ខខណ្ឌ) ➜ FAIL ១។

### [2.50.33] — 2026-10-08 · ZoeW ៖ **ថ្ងៃ និងម៉ោងកម្ពុជាគណនាដោយ formatter តែមួយ** (Deep audit ២ · ជុំ ១៤ · SCALE-7)

**ZoeW `2.50.33`** (`zoew-v295` ➜ `zoew-v296`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 🕒 **SCALE-7** ៖ `appZoneParts()` (ថ្ងៃ · ម៉ោង `Asia/Phnom_Penh`) បង្កើត `Intl.DateTimeFormat` ថ្មីរាល់ការហៅ ➜ រាល់ជួរប្រវត្តិ · ការស្កេន · ស្ថិតិ · Export បង់តម្លៃបង្កើត formatter។
  ឥឡូវ formatter បង្កើតម្តង ហើយទុកលើ function ខ្លួនវា (`appZoneParts.zoneFormat` · checker ស្រង់តែ function ➜ គ្មានអថេរ module) · `Intl.DateTimeFormat` ប្តូរ ឬបោះ ➜ បង្កើតថ្មី ឬ fallback UTC+7 ដូចដើម ·
  លទ្ធផលស្មើការបង្កើតថ្មីរាល់ដង។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. គ្មានការសាកពិសេស (ម៉ោងស្កេន · ថ្ងៃក្នុងតម្រង · របាយការណ៍ខែ ដូចដើម)។

#### អ្នកយាម

- `ZoeW/tests/zone-format-cache.test.ts` (ថ្មី · ២ · `timezone.ts` ពិត · constructor រាប់) ៖ ហៅ ៥០០ ដង ➜ បង្កើត ≤ ១ · លទ្ធផលស្មើ formatter ថ្មីលើ ៦ ចំណុច ·
  Intl បោះ ➜ fallback ត្រឹមត្រូវ · Intl ត្រឡប់មក ➜ បង្កើតម្តង (មុនកែ FAIL ២ ៖ បង្កើត ៥០០ · ៦) · mutation (ឈប់ពិនិត្យ constructor) ➜ FAIL ១ ·
  `khmer-timezone-test` ២១ · `emu/crud-rules-flow` (Intl បរាជ័យកណ្តាល sandbox) ១២៦។

### [2.50.32] — 2026-10-08 · ZoeW ៖ **ការដោះ Barcode ពីបញ្ជីប្រឆាំងស្ទួនច្រើនរយក្នុងពេលតែមួយ លែងធ្វើឲ្យអេក្រង់កក** (Deep audit ២ · ជុំ ១៤ · SCALE-6)

**ZoeW `2.50.32`** (`zoew-v294` ➜ `zoew-v295`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- 🔑 **SCALE-6** ៖ `flushPendingRegistryReleases()` សួរ `registryReleaseVerdict(key)` ម្តងមួយ key ➜ `registryKeyIsOwned()` ដើរប្រវត្តិ + ធុងសំរាមទាំងមូល ហើយគណនា
  `barcodeRegistryKey()` (regex) លើគ្រប់ barcode ម្តងទៀតសម្រាប់ key នីមួយៗ ➜ O(key × barcode) ៖ ការលុបធុងសំរាមច្រើនរយ (ធុងសំរាម ៣០ ថ្ងៃធំ) ធ្វើឲ្យ listener callback បន្ទាប់កក។
  ឥឡូវការ flush មួយបង្កើតសំណុំ key ដែលមានម្ចាស់ម្តង (`ownedRegistryKeys()`) ហើយសម្រេចគ្រប់ key លើសំណុំនោះ · លទ្ធផលដូចដើម (គ្មានម្ចាស់ ➜ ដោះ · មានម្ចាស់ ➜ ទុក · ទិដ្ឋភាពមិនស្រស់ ➜ ពន្យារ) ·
  សំណុំបង្កើតថ្មីរាល់ flush · ⛔ មិនផ្លាស់ទៅវដ្ត ៦០ វិ.។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. គ្មានការសាកពិសេស (ការសម្អាតធុងសំរាមស្វ័យប្រវត្តិ ៣០ ថ្ងៃ · លុបជាអចិន្ត្រៃយ៍ ➜ ស្កេន Barcode ដដែលម្តងទៀតបានដូចដើម)។

#### អ្នកយាម

- `ZoeW/tests/registry-flush-scale.test.ts` (ថ្មី · ៤ · `registry.ts` ពិត · getter រាប់ការអាន `barcodes`) ៖ key ២០០ លើធាតុ ១៨០០ ➜ អាន ≤ ២ ដងនៃការដើរម្តង · ដោះតែ key គ្មានម្ចាស់ ១៥០ ·
  ទិដ្ឋភាពមិនស្រស់ ➜ ពន្យារ · ធាតុថ្មីកាន់កាប់ key ➜ មានម្ចាស់ក្នុង flush បន្ទាប់ (មុនកែ FAIL ១ ៖ អាន ១,១៧៤,៥០០ ដង ធៀបនឹងពិដាន ១៤,៤០០) · mutation ៤ ➜ FAIL ទាំង ៤ ·
  `registry-release-test` ស្រង់ `ownedRegistryKeys` (៥៧ ok)។

### [2.50.31] — 2026-10-08 · ZoeW ៖ **ហាង Supabase ៖ ការធ្វើសមកាលកម្មគណនាឡើងវិញតែទិន្នន័យដែលប្រែ** (Deep audit ២ · ជុំ ១៤ · SCALE-3)

**ZoeW `2.50.31`** (`zoew-v293` ➜ `zoew-v294`) · ⛔ ZoeKeyGen មិនប្រែ · គ្មាន rules · env · migration ថ្មី។

#### អ្វីដែលខុសពីមុន

- ⚡ **SCALE-3** ៖ `notify()` របស់ adapter Supabase គណនា និង serialize (`canonicalJson`) តម្លៃរបស់គ្រប់ listener រាល់ពេលហៅ (រាល់ pull · poll ទទេរៀងរាល់ ៥ នាទី ·
  ការសរសេរ · `get()`) ➜ root ធំ (ធុងសំរាម ៣០ ថ្ងៃ · ប្រវត្តិ) ត្រូវ serialize ឡើងវិញ ទោះគ្មានអ្វីប្រែក្នុងវា។ ឥឡូវ root ត្រូវសម្គាល់ថា «ប្រែ» នៅកន្លែងដែលវាប្រែ ៖ doc server សរសេរ ·
  overlay ការសរសេរចូលជួរ/ចប់ (root របស់ op) · ទិដ្ឋភាព server សម្អាត · stage ប្តូរ · `authScope` ប្តូរ (ទាំងអស់ ➜ `clearServerView()`/`markAllDirty()`) ➜ `notify()` គណនាតែ listener ដែល root ប្រែ ·
  listener ដែលមិនទាន់ទទួលដំបូងទទួលជានិច្ច · ឥរិយាបថដូចដើម (តម្លៃ · លំដាប់ · ការដកតម្លៃដែលត្រូវបដិសេធ · ការសម្អាតពេលហាងប្តូរ)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

1. Deploy **ZoeW** ➜ build APK ឡើងវិញ។
2. សាក (ហាង Supabase) ៖ ស្កេន · បិទ · ដក · ស្តារ ➜ តារាង និងស្ថិតិប្រែភ្លាមដូចដើម · ឧបករណ៍ពីរ ៖ ការប្រែលើឧបករណ៍មួយទៅដល់ឧបករណ៍មួយទៀត។

#### អ្នកយាម

- `ZoeW/tests/supabase-notify-dirty.test.ts` (ថ្មី · ១១ · adapter ពិត + transport ក្លែងដែលរាប់ការអាន doc តាម getter) ៖ poll ទទេ ➜ អាន ០ · pull ប្រែតែ root តូច ➜ root ធំអាន ០ ·
  ការសរសេរ overlay ➜ root ធំអាន ០ (overlay បង្ហាញភ្លាម) · ការសរសេរបដិសេធ ➜ overlay ដកចេញ · scope ប្តូរខណៈការសរសេរព្យួរ ➜ overlay លែងបង្ហាញ · ទិសផ្ទុយ ៖ ប្រែក្នុង root ធំ ➜ ទៅដល់ ·
  reset កណ្តាលសម័យ · listener ថ្មីក្រោយ permission_denied ➜ null · tenant ប្តូរ ➜ ទិដ្ឋភាពចាស់សម្អាត · resetForSignOut ➜ pull ពេញ (មុនកែ FAIL ៣ ៖ អាន ១២០ · ៦០ · ១២០) · mutation ៨ ➜ FAIL ទាំង ៨ · ១ សមមូល (ការសម្អាតពេល cache ជាហាងផ្សេង ៖ `ready = false` ពេលនោះ ➜ `notify()` មិនដំណើរការ · stage swap សម្គាល់ទាំងអស់)។

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

## 🐛 ផ្នែក ២ — ប្រវត្តិកំហុស និងលេខដែលវាស់បាន (សម័យ React)

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

| Checker | `HISTORY.md` (សម័យ React) | `HISTORY-ARCHIVE.md` (vanilla · ផ្នែក ៦ ៖ ផ្ទេរទៅ React · ផ្នែក ៧ ៖ React ដំបូង) |
|---|---|---|
| `action-binding-test` | — | ផ្នែក ១ · ផ្នែក ៧ |
| `adaptive-link-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ |
| `animation-cost` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `app-lock-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `auth-recovery-test` | — | ផ្នែក ៣ · ផ្នែក ៦ |
| `barcode-shape-test` | — | ផ្នែក ២ |
| `biometric-unlock-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៤ |
| `boot-animation-test` | ផ្នែក ១ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `boot-runtime` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `camera-resume-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `checker-coverage` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `cleanup-clock-guard-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៦ |
| `cleanup-interrupt-atomicity-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ |
| `clear-history-claim-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `clear-history-finalization-fence-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `clock-basis-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `clock-hygiene` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៧ |
| `code-duplication-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `collected-mirror-fuzz-test` | — | ផ្នែក ១ |
| `collected-mirror-lifecycle-test` | — | ផ្នែក ១ |
| `collected-value-fuzz-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `comments` | ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `compensation-order` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `concurrent-scan-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `connection-recovery-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `connection-state-fuzz-test` | — | ផ្នែក ១ · ផ្នែក ៧ |
| `csp-enforced-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `csp-lazy-resource-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `css-classes` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `css-media-override` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `css-var-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `daily-collected-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៧ |
| `db-stall-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `dependency-security-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `doc-scope-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ |
| `dom-hygiene` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `duplicate-money-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `duplicate-scan-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `empty-state-truth-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/app-network-e2e-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `emu/app-writes-rules-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `emu/crud-rules-flow` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `emu/ledger-revert-emu-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `emu/license-seat-rules-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៥ · ផ្នែក ៧ |
| `emu/money-multidevice-emu-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `emu/ns` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/restore-deadlock-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `emu/restore-mutation-emu-test` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៥ |
| `emu/supabase-rules-parity-test` | ផ្នែក ១ | — |
| `emu/tx-disconnect-emu-test` | — | ផ្នែក ៦ · ផ្នែក ៧ |
| `exit-code-integrity` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `export-cells-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `field-shape-test` | — | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៧ |
| `firebase-backup-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `firebase-config-paste-test` | — | ផ្នែក ៣ · ផ្នែក ៧ |
| `firebase-provision-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `fluid-type-focus-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `function-surface-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `gesture-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `google-sheets-cache-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `hang-guard` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `health-check-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៧ |
| `history-menu-dismiss-test` | ផ្នែក ១ | ផ្នែក ២ · ផ្នែក ៦ |
| `history-patch-retry-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `html-sink-escaping` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `idtoken-fixture` | ផ្នែក ១ | ផ្នែក ៧ |
| `inline-handler-xss-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `ios-panel-glide-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `item-money-integrity-test` | — | ផ្នែក ១ |
| `keygen-biometric-test` | ផ្នែក ១ | ផ្នែក ៧ |
| `keygen-notice-test` | ផ្នែក ១ | ផ្នែក ៧ |
| `keygen-pin-flow-test` | — | ផ្នែក ៧ |
| `keygen-session-security-test` | ផ្នែក ១ | ផ្នែក ២ · ផ្នែក ៧ |
| `keygen-supabase-admin-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `keylist-consistency-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ |
| `khmer-timezone-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៤ |
| `late-commit-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `layout-check` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `layout-thrash` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `ledger-clamp-symmetry-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `ledger-count-integrity-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `ledger-failed-apply-revert-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `license-app-code-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `license-clock-rollback-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `license-clock-trust-test` | — | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៧ |
| `license-grace-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `license-network-pressure-test` | — | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `license-record-race-test` | — | ផ្នែក ២ |
| `license-seat-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៥ · ផ្នែក ៧ |
| `listener-leak-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `listener-pending-key-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `locker-claim-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `lookup-burst-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-config-secret-test` | — | ផ្នែក ១ |
| `lookup-failure-identity-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `lookup-freshness-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `lookup-prefetch-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `loop-termination-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `modal-keyboard-device-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `modal-keyboard-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `money-core` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៦ · ផ្នែក ៧ |
| `money-guardian-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៧ |
| `money-multidevice-core` | ផ្នែក ២ | — |
| `money-reality-check` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ |
| `money-reality-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៧ |
| `monotonic-gate-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៧ |
| `monthly-ledger-agreement-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `monthly-report-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `netlify-config-scope-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៧ |
| `network-pressure-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `network-timeout-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `offline-shell-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `page-nav-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `panel-motion-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `panel-snap-ownership-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៦ |
| `partial-pickup-cleanup-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `payload-schema` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `perf-check` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `periodic-network-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `phone-search-swipe-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `phone-suggest-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ |
| `pickup-barcode-identity-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `pickup-ledger-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pickup-repair-test` | — | ផ្នែក ១ · ផ្នែក ៣ |
| `pickup-reset-test` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pin-prompt-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៤ |
| `policy-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `price-edit-abort-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៦ |
| `raw-read-shape-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `react-view` | ផ្នែក ១ | ផ្នែក ៦ |
| `reconnect-ladder-test` | — | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `redact-dump` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `registry-orphan-list` | — | ផ្នែក ១ · ផ្នែក ៧ |
| `registry-orphan-list-test` | — | ផ្នែក ១ · ផ្នែក ៧ |
| `registry-release-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `repository-contract-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៧ |
| `repository-file-coverage` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៦ · ផ្នែក ៧ |
| `restore-finalization-fence-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `restore-marker-hygiene-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `restore-race-test` | ផ្នែក ១ | — |
| `returned-trash-retention-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ |
| `revenue-fuzz-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `revenue-rules-clamp-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `rules-duplicate-keys` | — | ផ្នែក ៣ · ផ្នែក ៧ |
| `runall-runner-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `scan-engine-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ |
| `scan-remove-mode-test` | — | ផ្នែក ១ |
| `sdk-offline-boot-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sdk-surface` | ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `secret-hygiene` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ · ផ្នែក ៧ |
| `security-guard-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `semantic-ui-color-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `sentry-load-race-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `setup-link-browser-test` | — | ផ្នែក ១ · ផ្នែក ៤ · ផ្នែក ៧ |
| `setup-link-logout-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `setup-link-roundtrip-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `shared-fns` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `sheet-import-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `slow-write-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stale-clear-claim-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `stale-write` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stall-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `stall-lock-release-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `state-hygiene` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `stats-collected-truth-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `stats-measurable-gate-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `stats-screen-agreement-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `storage-blocked-boot-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `storage-guard` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `strip-comments` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៦ |
| `supabase-app-network-e2e-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `supabase-data-tools-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `supabase-datastore-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `supabase-docs-cache-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `supabase-fake-server` | ផ្នែក ២ | ផ្នែក ៧ |
| `supabase-functions-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `supabase-money-multishop-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `supabase-pg` | — | ផ្នែក ៧ |
| `supabase-rls-test` | ផ្នែក ១ | ផ្នែក ៧ |
| `sw-abort-propagation-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `sw-backend-chunk-test` | ផ្នែក ២ | ផ្នែក ៧ |
| `sw-cache-failure-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-cache-key-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-client-wiring-test` | — | ផ្នែក ៧ |
| `sw-install-integrity-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `sw-revalidate-pressure-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-shell-latency-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `toast-action-truth-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `toast-truth-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `trash-modal-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `ts-comments` | — | ផ្នែក ៦ |
| `tx-outcome-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៦ · ផ្នែក ៧ |
| `ui-flow-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `user-guide-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `version-bump-scope` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `version-check` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៧ |
| `wiring` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `write-stall-guard-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `zoew-suite-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៦ · ផ្នែក ៧ |
| `zto-budget-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៧ |
| `zto-cookie-capture-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `zto-cookie-session-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ |
| `zto-cookie-store-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៧ |
| `zto-cookie-sync-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៦ · ផ្នែក ៧ |
| `zto-list-sync-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៧ |
| `zto-negative-cache-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-network-boundaries-test` | ផ្នែក ២ | ផ្នែក ២ |
| `zto-proxy-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ · ផ្នែក ៦ |
| `zto-signed-status-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `zto-sync-banner-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ · ផ្នែក ៧ |
| `ZoeW/tests/activation-retry.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/adaptive-refresh.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/app-icon-logo.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/audit-checker-outcomes.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/audit-lifecycle.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/auth-flow-race.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/backend-switch-detach.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/barcode-key-encoding.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/barcode-origin.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/batch-scan.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/biometric-android-prf.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/biometric-no-device-mode.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/chrome-autohide-intent.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/cleanup-applied-ownership.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/cleanup-deduct-order.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/cleanup-foreign-slot.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/cleanup-journal-cap.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/cleanup-ledger-key.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/cleanup-resume-session.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/cleanup-sweep-batch.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/clear-history-foreign-slot.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/close-restamp-idempotent.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/code128-parity.test.tsx` | — | ផ្នែក ៦ |
| `ZoeW/tests/collected-price-day-scope.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/collected-sync-pending.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/config-modal.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/connection-flow-contract.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/connection-request-owner.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/connection-scope-discovery.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/device-info.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/discard-pending-writes.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/durable-connection-write.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/exchange-rate-backend-switch.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/exchange-rate-completion-race.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/exchange-rate-shop-switch.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/expiry-return-policy.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/firebase-auth-write-ownership.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/firebase-loader-gate.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/forbidden-zone-lock.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/hardware-scanner.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/health-advice.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/health-no-backend.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/history-paging.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/history-patch-late-commit.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/ios-accessory-focus.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/ios-entry-search-tap.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/ios-history-bottom.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/ios-keyboard-pan.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/ios-page-field-raise.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/ios-search-pulldown.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/ios-search-resnap.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/ios-search-tap-focus.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/ios-search-viewport.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/ios-synthetic-click-focus.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/keyboard-tabbar.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/label-image.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/label-print.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/late-commit-stale-session.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/ledger-native-retry-identity.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/ledger-not-applied-retry.test.ts` | ផ្នែក ១ | ផ្នែក ៧ |
| `ZoeW/tests/ledger-op-ring.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/ledger-replay-companion.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/ledger-stale-session.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/list-paging.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/list-render-scope.test.tsx` | — | ផ្នែក ៦ · ផ្នែក ៧ |
| `ZoeW/tests/locker-assign-session.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/locker-occupant.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/locker-scan-direct.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/login-autofill.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/login-over-drawer.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/login-routing.test.tsx` | ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/lookup-import-race.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/lookup-late-answer-busy.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/merge-into-deleted-item.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/modal-backdrop-keep.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/modal-chrome-state.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/modal-focus-trap.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/modal-keyboard.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/more-menu-scroll.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/native-durable-write.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/native-receipt-retention.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/native-recovery-plain-cas.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/native/app-lock-away.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/native/immediate-ui.test.tsx` | — | ផ្នែក ៦ |
| `ZoeW/tests/native/native-back.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/native/render-crash.test.tsx` | — | ផ្នែក ៦ |
| `ZoeW/tests/native/status-bar-tone.test.ts` | — | ផ្នែក ៦ |
| `ZoeW/tests/native/zto-preflight.test.ts` | — | ផ្នែក ៦ |
| `ZoeW/tests/network-toast-phase.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/network-toast.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/notifications.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/notify-apk-link.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/notify-groups.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/notify-update-check.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/orientation-lock.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/palm-sign-camera.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/password-save-race.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/phone-suggest-idle-scroll.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/pickup-interrupted-close.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/print-relayout.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/push-client.test.tsx` | ផ្នែក ១ | ផ្នែក ៧ |
| `ZoeW/tests/push-server.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/pwa-icons.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/reconfig-invite-seam.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/recovery-toast-dedup.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/registry-claim-proven.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/registry-flush-scale.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/registry-session-race.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/remember-password.test.tsx` | ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/remove-stale-session.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/scan-engine-recovery.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/scan-image-qr.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/scan-qr.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/scanner-focus-after-close.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/scanner-modal-queue.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/scroll-thumb.test.tsx` | ផ្នែក ១ | ផ្នែក ៧ |
| `ZoeW/tests/search-glide-hold.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/seller-notices.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/session-expiry-race.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/session-switch-fuzz.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/setup-lookup.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/shop-bound-settings.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/shop-bound-ui-refresh.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/shop-device-note.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/shop-pending-cleanup.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-account.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-auth-unavailable.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-auth-write-ownership.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/supabase-clock-skew.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-cross-tab-signout.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-gateway-5xx.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-journal-recovery.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-ledger-replay-companion.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/supabase-notify-dirty.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-offline-restore.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-op-retention.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-pull-paging.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-realtime-race.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-realtime-ws.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-signout-offline.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-signout-race.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-signout-stage.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-sync-owner.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-tenant-switch.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-transport-hang.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-tx-outcome.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-unsent-tx.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/supabase-update-contract.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/supabase-write-bad-body.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/sw-revalidation-timeout.test.ts` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/tenant-app-session.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/toast-backend.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/toast-live-expiry.test.tsx` | — | ផ្នែក ៧ |
| `ZoeW/tests/toast-parity.test.tsx` | — | ផ្នែក ៦ |
| `ZoeW/tests/toast-visibility.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/trash-reason-filter.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/trash-retry-session.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/tx-outcome-timeout.test.ts` | ផ្នែក ២ | ផ្នែក ៧ |
| `ZoeW/tests/zone-format-cache.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-abandon-blocked-sweep.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-abandon-signed-gate.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-barcode-shape.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-born-closed-merge.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-cookie-life.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-detail-identity.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-final-marks.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-import-lanes.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-list-identity.test.ts` | — | ផ្នែក ៧ |
| `ZoeW/tests/zto-list-origin-import.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-list-origin.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-lock.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-multibranch-signed-hold.test.tsx` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-pages-unknown.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-palm-backends.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-list-e2e.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-list.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-login.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-multibranch-hold.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-race.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-refresh.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-returned.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-server.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-shared-app.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-shared.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-palm-sign-e2e.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-sign-server.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-palm-sign.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-placeholder-phone.test.tsx` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-remind-days.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-returned-cleanup.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-returned.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-session-race.test.ts` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-shop-sweep-marker.test.tsx` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-signed-cadence.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-signed-mismatch.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-signed-only-import.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-signed-only-purge.test.ts` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-signed-past-range.test.tsx` | ផ្នែក ២ | — |
| `ZoeW/tests/zto-signed-sync.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-signed-truncation.test.tsx` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-stale-bar.test.tsx` | ផ្នែក ១ | — |
| `ZoeW/tests/zto-token-origin.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ZoeW/tests/zto-upstream-timing.test.ts` | ផ្នែក ១ · ផ្នែក ២ | — |
