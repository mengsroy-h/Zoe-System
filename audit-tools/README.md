# audit-tools

ឧបករណ៍ static-check + តេស្តសម្រាប់ការធ្វើ audit លើ Zoe-System។
រត់ពី **root** នៃ repo។ **មិនមែនជាផ្នែកនៃ App ណាមួយទេ — មិន deploy ទេ។**

> 📖 ឯកសារនេះសរសេរតែ **កំណែ · មុខងារ · របៀបប្រើប្រាស់ · ប្រព័ន្ធសុវត្ថិភាព ·
> អាជ្ញាប័ណ្ណ**។ **ហេតុអ្វី** checker នីមួយៗមាន និងលេខដែលវាស់បាន ស្ថិតក្នុង
> **[docs/HISTORY.md](../docs/HISTORY.md)**។

---

## កំណែ

ឧបករណ៍ទាំងនេះ **គ្មានកំណែផ្ទាល់ខ្លួន** ហើយ **មិនប៉ះ `APP_VERSION` ឬ
`CACHE_VERSION`** របស់ App ណាមួយឡើយ (`version-bump-scope.js` លើកលែងផ្លូវ
`audit-tools/`)។ ចំនួន assertion ពិតរបស់ checker នីមួយៗ **បោះពុម្ពពេលរត់** —
⛔ កុំចម្លងលេខទាំងនោះចូលឯកសារ ព្រោះវាចាស់លឿន។

---

## មុខងារ

`run-all.sh` រត់ការត្រួតពិនិត្យជាង **១២០** ដែលបែងចែកជា ៦ ក្រុម ៖

| ក្រុម | គ្របអ្វី |
|---|---|
| **តក្កវិជ្ជាអាជីវកម្ម** | ច្បាប់លុប/ដក · ធុងសំរាម · ការសម្អាតស្វ័យប្រវត្តិ · ស្ថិតិយក · ចំណូល |
| **បណ្តាញ និងការតភ្ជាប់** | timeout · retry · ការស្តារ listener · សម្ពាធសំណើ · បណ្តាញ «ភ្ជាប់តែស្លាប់» |
| **Service Worker** | សំបក cache · ការធ្វើឲ្យស្រស់ · ការធ្លាក់របស់ Cache API · ល្បឿនបើក App |
| **UI និងទម្រង់បង្ហាញ** | កាយវិការ · ចលនាផ្ទាំង · មាត្រដ្ឋានអក្សរ · ទម្រង់លើអេក្រង់ ៣២០–១៤៤០px (ទូរស័ព្ទ · ថេប្លេត · ផ្តេក · desktop ៖ `SIZES` ក្នុង `layout-check.js`) |
| **សុវត្ថិភាព** | CSP · XSS · ការលាក់ secret · storage · License · ចាក់សោ App |
| **Meta (ឧបករណ៍ត្រួតពិនិត្យឧបករណ៍)** | checker អាចធ្លាក់បានទេ · ព្យួរបានទេ · ការធ្លាក់ឡើងដល់ exit code ទេ |

ការត្រួតពិនិត្យដែលហៅ `chromium.launch(` (រាប់បាន ៖ `grep -l 'chromium\.launch(' audit-tools/*.js audit-tools/emu/*.js`) បើក **Chromium ពិត** ហើយវាស់ឥរិយាបថពិត មិនមែនអានកូដទេ — ⛔ កុំចម្លងចំនួនមកទីនេះ (វាចាស់លឿន)។

---

## របៀបប្រើប្រាស់

### ១. ដំឡើង dependency (ម្តងក្នុងមួយ session)

```bash
npm ci --prefix ZoeW
```

ZoeW ជា React ➜ dependency របស់វា (`vite` · `acorn` · `playwright-core` · `esbuild`) ក៏ជា dependency របស់ checker ដែរ
(`run-all.sh` ប្រើ `ZoeW/node_modules` ជា `NODE_PATH`)។

| Package | ត្រូវការសម្រាប់ |
|---|---|
| `acorn` | checker ស្តាទិចដែល parse តាម AST |
| `playwright-core` | តេស្តដែលបើក Chromium ពិត |
| `xlsx` | ការត្រួតពិនិត្យ XML ដែល Export emit ចេញ |

បើខ្វះមួយណា checker ដែលពឹងលើវា **SKIP ដោយស្អាត** — `run-all.sh` នៅតែរត់ចប់
ហើយរាយ `SKIPPED`/`PARTIAL PASS` **ដាច់ពី `PASS`** ដើម្បីកុំឲ្យការគ្របតេស្ត
មើលទៅពេញខណៈ browser មិនបានរត់។

Chromium នៅ `/opt/pw-browsers/chromium-*/chrome-linux/chrome` — ប្តូរបានតាម
env `*_CHROME` របស់ checker នីមួយៗ។

### ២. រត់ទាំងអស់

```bash
bash audit-tools/run-all.sh
```

**រត់វាមុនចាប់ផ្តើម និងក្រោយកែរាល់ដង។** បើវាបៃតងទាំងអស់ នោះមានន័យថា
កំហុសដែលបានដោះស្រាយរួច មិនបានត្រឡប់មកវិញទេ។

លើ ZoeW React វា **build tree វាស់** (`ZoeW/scripts/build-audit.mjs` ➜ `ZoeW/dist-audit/measure-root` ៖ ឯកសារ repo
ទាំងអស់ លើកលែង `ZoeW/` ដែលជំនួសដោយ build វាស់) រួចរត់ checker ទាំងអស់នៅទីនោះ។

**lane ស្របគ្នា** — checker រត់ស្របគ្នាក្នុងព្រំដែន ហើយ output **តាមលំដាប់បញ្ជីជានិច្ច** (checker នីមួយៗសរសេរ
ចូលឯកសារដាច់ ➜ បោះពុម្ពពេលអ្នកនៅខាងមុខចប់)។ ជួរនីមួយៗមានពេលវេលា ហើយចុងក្រោយមានសេចក្តីសង្ខេប ៖ ពេលរត់ ·
ឈ្មោះ checker **❌ ធ្លាក់ · ◐ មួយផ្នែក · ⊘ រំលង** · **១០ យឺតជាងគេ**។

| env | លំនាំដើម | អត្ថន័យ |
|---|---|---|
| `RUNALL_JOBS` | ចំនួន CPU ក្នុងព្រំដែន 2–6 | ចំនួន checker ស្របគ្នា · `1` = ជាជួរ (លំដាប់ដូចបញ្ជី) |
| `RUNALL_BROWSER_JOBS` | ស្មើ `RUNALL_JOBS` | checker ដែលបើក Chromium ស្របគ្នាអតិបរមា (បន្ថយបើសង្ស័យថាការធ្លាក់ browser មកពីការប្រជែង CPU) |
| `RUNALL_STATE` | `<git-dir>/zoe-runall-state.tsv` | ឯកសារលទ្ធផល ៖ ១ បន្ទាត់/checker (ស្លាក · សាលក្រម · វិនាទី · hash របស់ tree · អត្ថបទ) សរសេរ **ភ្លាមពេល checker ចប់** · ទទេ (`RUNALL_STATE=`) = បិទ |
| `RUNALL_RESUME=1` | បិទ | រត់តែ checker ដែល **ធ្លាក់ ឬគ្មានលទ្ធផល** · លទ្ធផលផ្សេងយកពី state (សម្គាល់ `↺`) · ⛔ **បដិសេធ** (exit 2) បើ tree ប្រែ |
| `RUNALL_ONLY=a,b` | — | រត់តែ checker ដែលមានឈ្មោះ (ស្លាកក្នុង output ឬ `audit-tools/<ឈ្មោះ>.js` ដូច `money-guardian-test` · `emu/ledger-revert-emu-test`) · ឈ្មោះមិនស្គាល់ ➜ បដិសេធ · សេចក្តីសង្ខេបប្រកាស «មិនពេញលេញ» |

```bash
bash audit-tools/run-all.sh                                   # ពេញ (lane ស្របគ្នា)
RUNALL_RESUME=1 bash audit-tools/run-all.sh                   # session ងាប់កណ្តាលទី ➜ បន្តតែអ្វីដែលខ្វះ/ធ្លាក់
RUNALL_ONLY=layout-check,emu/crud-rules-flow bash audit-tools/run-all.sh   # រត់ឡើងវិញតែ ២
cat "$(git rev-parse --absolute-git-dir)/zoe-runall-state.tsv"               # មើលវឌ្ឍនភាពខណៈកំពុងរត់
```

- **hash របស់ tree** = មាតិកាឯកសារដែល git ឃើញ (tracked + untracked មិន ignore) · `audit-tools/emu/real.rules.json` ·
  ទង់ `*_STRICT` ➜ ការកែឯកសារណាមួយ ឬការប្តូរទង់ STRICT = tree ថ្មី ➜ `RUNALL_RESUME=1` បដិសេធ ហើយត្រូវរត់ពេញ។
- `RUNALL_ONLY` (គ្មាន RESUME) រត់ឡើងវិញ **ទោះលទ្ធផលមុនជាអ្វីក៏ដោយ** (ឧ. `PARTIAL` ព្រោះ emulator មិនទាន់ឡើង) ហើយ
  បន្ថែមលទ្ធផលចូល state របស់ tree ដដែល។
- lane ៖ `emu/*` និង `money-guardian` **ម្តងមួយ** (RTDB emulator តែមួយ) · `checker-coverage` និង `exit-code-integrity`
  **រត់ម្នាក់ឯង** (ពួកវាសរសេរ/បោសឯកសារស្រមោល `.tmp-poison-*` ក្នុង `audit-tools/` ហើយ fan out ខាងក្នុងរួចស្រាប់) ·
  checker ដែលប្រភពមាន `chromium.launch(` ➜ lane browser។ lane ដេរីវេពីប្រភព ហើយ `runall-runner-test.js` ផ្ទៀងវា។
- `Ctrl-C` / `TERM` ➜ checker ដែលកំពុងរត់ត្រូវបញ្ឈប់ · លទ្ធផលដែលចប់រួចនៅក្នុង state ➜ `RUNALL_RESUME=1`។
- លំដាប់ **រត់** (មិនមែនលំដាប់បោះពុម្ព) ៖ meta ម្នាក់ឯងមុន រួច checker យូរជាងគេមុន — ពេលពី state មុន ឬពី `RUNALL_HINTS` ក្នុង
  `run-all.sh` ពេល session ថ្មីគ្មាន state (ប៉ះតែលំដាប់ មិនប៉ះសាលក្រម)។

### ៣. រត់តែមួយ

```bash
M=$(ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh | tail -1)   # build tree វាស់ ហើយឈប់
cd "$M" && node audit-tools/policy-test.js
```

⛔ `node audit-tools/<x>.js` **ពី root របស់ repo** វាស់ `ZoeW/app.js` ដែលលែងមាន (ZoeW ជា React) ➜ ធ្លាក់
«រកកូដមិនឃើញ» — មិនមែនកំហុសក្នុង App។

### ៤. រត់លើ tree ផ្សេង (បញ្ជាក់ថាតេស្តមិនទទេ)

រាល់ checker ភាគច្រើនទទួល env override ដើម្បីចង្អុលទៅថតផ្សេង។

⛔ **ពាក្យបញ្ជាពិតរស់នៅ [`../CLAUDE.md`](../CLAUDE.md) ➜ Runbook ជំហានទី ២
តែមួយកន្លែង — សូមចម្លងពីទីនោះ។** ⛔ **បើតេស្តថ្មីជោគជ័យលើ tree មុនកែ នោះវា
មិនចាប់អ្វីទេ — សរសេរវាឡើងវិញ។**

### ៥. Firebase RTDB emulator (សម្រាប់ការកែ rules)

⛔ **ការដំឡើង និងការបើក emulator រស់នៅ [`../CLAUDE.md`](../CLAUDE.md) ➜
Runbook ជំហានទី ០ តែមួយកន្លែង — សូមចម្លងពីទីនោះ។**

🔴 ហេតុអ្វីវាមិនស្ថិតនៅទីនេះទៀត ៖ ច្បាប់ចម្លងចាស់ក្នុងឯកសារនេះ **ឃ្លាតរួច
ទៅហើយ** ៣ កន្លែង ហើយមួយក្នុងចំណោមនោះ **គ្រោះថ្នាក់** ៖ វារាយ `java -jar`
ជា **foreground** (➜ បិទ shell របស់ session ជារៀងរហូត) ខណៈជំហានទី ០ រាយ
`setsid nohup … &`; វារាយ `npx` ដោយគ្មាន `--no-install`; ហើយការព្រមាន
`pkill` របស់វាចង្អៀតត្រឹម `firebase-database-emulator` ខណៈច្បាប់ពិតគឺ
**លំនាំណាក៏ដោយ** ដែលលេចក្នុងពាក្យបញ្ជារបស់អ្នក។ នេះជាអ្វីដែល **ច្បាប់ ១២**
ព្យាករណ៍ជាក់ស្តែង។

ក្រោយ emulator ដើររួច ការកែ rules ត្រូវការតែ ៖

```bash
cp firebase-database.rules.json audit-tools/emu/real.rules.json
bash audit-tools/emu/rules.sh
```

`real.rules.json` ជាឯកសារបង្កើតឡើងវិញរាល់ដង (gitignored) — **ចម្លងពី
`firebase-database.rules.json` ជានិច្ចមុនរត់** ដើម្បីកុំឲ្យតេស្តលើ rules ចាស់។

**អន្ទាក់ ៤ ដែលខាតពេលច្រើន** ៖

1. `firebase emulators:start` **upload rules មិនចេញ** កាត់ proxy — រត់ jar ផ្ទាល់។
2. `.settings/rules.json` និង `auth_variable_override` **ទាំងពីរត្រូវការ**
   `-H "Authorization: Bearer owner"` — បើគ្មាន rules មិន load ទេ ហើយ
   **តេស្តទាំងអស់ជោគជ័យក្លែងក្លាយ**។
3. ⛔ កុំប្រើ `pkill -f <លំនាំ>` សម្រាប់ **លំនាំណាក៏ដោយ** ដែលលេចក្នុង
   ពាក្យបញ្ជារបស់អ្នក — វាផ្គូផ្គងនឹង shell របស់ខ្លួនឯង ➜ សម្លាប់ session
   (មើល `../CLAUDE.md` Runbook ជំហានទី ០)។ បិទតាម **PID ជាក់លាក់** វិញ
   រួចផ្ទៀងផ្ទាត់ដោយ `curl` ទៅ port 9000។
4. request ដែលមាន `Bearer owner` **ដោយគ្មាន** `auth_variable_override`
   ត្រូវចាត់ទុកជា project owner ➜ **រំលង rules ទាំងស្រុង**។ សម្រាប់តេស្ត
   «unauthenticated ត្រូវ DENIED» **កុំផ្ញើ Authorization header សោះ**។

⛔ **តែងតែពិនិត្យថា write ដែលគួរ DENIED ពិតជា DENIED** មុននឹងជឿលទ្ធផល។

### ៦. បញ្ជី checker និង env override

#### Meta — ត្រួតពិនិត្យឧបករណ៍ខ្លួនឯង (**រត់ ៣ នេះមុនគេ**)

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `checker-coverage.js` | checker ត្រូវ **អាចធ្លាក់បាន** — ថតទទេ ➜ គ្មានមួយណាបៃតង; រាល់ checker ត្រូវភ្ជាប់ការរត់ធម្មតា និង baseline; CLI ដែលត្រូវការ dump ត្រូវមាន fixture checker; CI និង runner ត្រូវស៊ីគ្នា; `pageerror` ត្រូវឃើញការបដិសេធ promise ដែរ | — |
| `repository-file-coverage.js` | ឯកសារគម្រោងទាំងអស់ត្រូវមានធាតុក្នុងបញ្ជីការគ្របដណ្ដប់; ឯកសារថ្មី ការយាមដែលបាត់ និងតំណឯកសារសកម្មដែលបាក់ ត្រូវធ្លាក់; ប្រភេទ manual/integrity មិនមែន behavioral coverage | `REPOCOVER_APP_DIR` |
| `repository-contract-test.js` | ផ្ទៀងផ្ទាត់ Apps Script manifest, CSV template, backup config example និង package lock ធៀបនឹងកិច្ចសន្យាកូដដែលប្រើវា | `REPOCONTRACT_APP_DIR` |
| `money-reality-test.js` | រត់ CLI របាយការណ៍ និង redaction លើ fixture ពិត; លទ្ធផលមុន/ក្រោយត្រូវស៊ីគ្នា; ទិន្នន័យរសើបត្រូវលាក់; launcher មិនប្រកាសជោគជ័យពេល redaction ធ្លាក់។ ⛔ **ការឃ្លាតរវាងកញ្ចក់ `zoew_daily_collected_cod_dod` និងប្រវត្តិ ត្រូវចេញ exit 1 ពិត** (៥ អ័ក្ស បូកជាន់អប្បបរមា «វិសាលភាពទទេ») ហើយ ៤ សេណារីយ៉ូទិសផ្ទុយត្រូវ **នៅ exit 0** ៖ កញ្ចក់ស៊ីគ្នា (រួម barcode បិទក្នុងធុងសំរាម) · កូនសោគ្មានម្ចាស់ · ថ្ងៃខុស · barcode ដែលបិទមុនកញ្ចក់ចាប់ផ្តើម | `MONEYREALTEST_APP_DIR` |
| `hang-guard.js` | checker ត្រូវអាចធ្លាក់បាន **ក្នុងពេលកំណត់** — ការព្យួរ ≠ ការធ្លាក់ · រត់ `exit-code-integrity.js` លើ fixture ៤០ checker ៖ កូនដែលព្យួរពេលពុល ➜ FAIL ដែលមានឈ្មោះ · ការពុលរត់ស្របគ្នា | `HANGGUARD_APP_DIR` |
| `runall-runner-test.js` | ម៉ាស៊ីនរត់ `run-all.sh` ខ្លួនវា (ប្លុក `#@runner-begin`…`#@runner-end` ពិត លើ checker ក្លែង) ៖ ស្របគ្នាពិត (វាស់ពីចន្លោះ start/end) · output តាមលំដាប់បញ្ជី ≡ ជាជួរ · emu ម្តងមួយ · meta ម្នាក់ឯង · browser មានពិដាន · ព្យួរ ➜ FAIL · state/`RUNALL_RESUME` (tree ផ្សេង ➜ បដិសេធ)/`RUNALL_ONLY` (ឈ្មោះមិនស្គាល់ ➜ បដិសេធ) · TERM មិនបន្សល់ process កំព្រា · lane នៃបញ្ជីពិតត្រូវនឹងភស្តុតាងក្នុងប្រភព (ទាំង ២ ទិស) | `RUNALLRUNNER_APP_DIR` |
| `exit-code-integrity.js` | ការធ្លាក់ត្រូវឡើងដល់ **exit code** — «FAIL» ដែលចេញ exit 0 = បៃតងក្លែងក្លាយ · ពុល checker កូន **ស្របគ្នា** (`emu/*` ម្តងមួយ) · កូនដែលផុតថវិកា ឬស្លាប់ដោយ signal ខណៈពុល = FAIL (វាស់មិនបាន) · បោះពុម្ពពេលសរុប និងកូនយឺតជាងគេ ៥ | `EXITCODE_APP_DIR` · `EXITCODE_CONCURRENCY` (លំនាំដើម = ចំនួន CPU ក្នុងចន្លោះ ២–៨) · `EXITCODE_TIMEOUT_MS` (ថវិកាកូនមួយ · លំនាំដើម ៦០០០០) |
| `shared-fns.js` | helper ដែលចែករំលែក ZoeW ↔ ZoeKeyGen ត្រូវ byte-identical | — |
| `version-check.js` | `app.js` ↔ `manifest.json` ↔ `index.html` ក្នុង App នីមួយៗ | `VERSION_APP_DIR` |
| `version-bump-scope.js` | ឡើងកំណែ **តែ App ដែលកែពិត** | `VERSIONSCOPE_APP_DIR` · `VERSIONSCOPE_BASE` |
| `semantic-ui-color-test.js` | ពណ៌ប៊ូតុងតាមអត្ថន័យ និងស្ថានភាព បិទ/បើក · ពណ៌ទឹកប្រាក់ យករួច/មិនទាន់យក/សរុប · ស្លាកតារាងតូចមិនមានពាក្យស្ថានភាពស្ទួន | `SEMANTIC_UI_APP_DIR` |
| `user-guide-test.js` | សៀវភៅណែនាំ HTML ពេញលេញ · accessibility · តំណពីលេខកំណែទាំង ២ បើកក្នុងផ្ទាំង App ដដែលសម្រាប់ PWA/WebView · cache Offline · SW មិនបង្វែរ `guide.html` ឬ Netlify `/guide` ទៅ `index.html` · ⛔ **រាល់កុងតាក់របា Slide ត្រូវមានការពន្យល់ក្នុងសៀវភៅ** — បញ្ជីពាក្យ **ដេរីវេពី `index.html` ពិត** មិនមែនបញ្ជីរឹង (បញ្ជីរឹង = កាលបរិច្ឆេទផុតកំណត់) | `USER_GUIDE_APP_DIR` |
| `netlify-config-scope-test.js` | ⛔ **គ្មាន root `netlify.toml`** (វាបង្វែរ build របស់ App មួយទៀត) · config ត្រូវស៊ីនឹងអ្វីដែល App ship · រាល់ config ត្រូវមាន checker អាន | `NETLIFYSCOPE_APP_DIR` |
| `function-surface-test.js` | ផ្ទៃ function ទាំងមូល · ទប់ declaration ឈ្មោះស្ទួន · រាល់ `data-act` មាន function ពិត | `FNSURFACE_APP_DIR` |
| `code-duplication-test.js` | តក្កវិជ្ជាដដែលរស់ **២ កន្លែង** ក្នុងឯកសារ ship តែមួយ (តួ function · ប្លុក statement) ➜ ជុំក្រោយកែមួយ ភ្លេចមួយ | `DUPCODE_APP_DIR` |

#### តក្កវិជ្ជាអាជីវកម្ម — លុយ · ធុងសំរាម · ការសម្អាត

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `policy-test.js` | គោលការណ៍ **លុប ទល់នឹង ដក**; `deleteSingleItem` និង `buildClearHistoryTrashItem` **មិនប៉ះលុយ** | `POLICY_APP_DIR` |
| `trash-modal-test.js` | ស្លាកធុងសំរាម ↔ ថេរ · ការ merge · តួលេខសរុប ២ ក្រុម ⛔ **បូក ៖ រត់ `renderTrashSummary()` ពិត ➜ អានលេខចេញពី HTML** (ក្រុម ២ ដេរីវេពី `TRASH_REASON_META` · រក្សាសេន · ការអភិរក្សចំនួន) | `TRASH_APP_DIR` |
| `partial-pickup-cleanup-test.js` | ច្បាប់ ២ ម៉ោង / ថ្ងៃទី ៨ ដើរតាម **barcode** មិនមែនកញ្ចប់ | `PARTIAL_APP_DIR` |
| `expired-trash-retention-test.js` | ថេររក្សាទុក ២ ថ្ងៃ / ៣០ ថ្ងៃ និង `DB_OP_TIMEOUT_MS` មិនត្រូវឃ្លាតពីគ្នា | `EXPIREDTRASH_APP_DIR` |
| `restore-marker-hygiene-test.js` | marker របស់ប្រវត្តិ មិនធ្លាក់ចូលធុងសំរាម · ការសម្អាតមិនដណ្តើមធាតុដែលកំពុងស្តារ | `MARKER_APP_DIR` |
| `pickup-ledger-test.js` | អតិថិជនយក ↔ កញ្ចប់យក រាប់លើ **មូលដ្ឋានតែមួយ** | `PICKUP_APP_DIR` |
| `pickup-reset-test.js` | Reset ស្ថិតិយក ៖ node នៅមានជាមួយ `0` · គោរពតម្រង · មិនប៉ះលុយ | `PICKUPRESET_APP_DIR` |
| `pickup-repair-test.js` | ការជួសជុលស្ថិតិយកស្វ័យប្រវត្តិ | `PICKUPREPAIR_APP_DIR` |
| `pickup-barcode-identity-test.js` | ស្ថិតិយករាប់តាម **សំណុំ barcode** ៖ ឧបករណ៍ ២ ចែក store តែមួយ · rules ពិត · ការចូជួរក្រៅបណ្តាញ | `PICKUPID_APP_DIR` |
| `revenue-fuzz-test.js` | invariant ចំណូល/ស្ថិតិ លើលំដាប់ចៃដន្យ (rules ពិត · អថេរ registry និងធុងសំរាម) · `FUZZ_CAPTURE=<file>` ➜ សរសេរការសរសេរទាំងអស់ដែល fake ទទួល (សម្រាប់ `emu/app-writes-rules-test.js`) | `FUZZ_APP_DIR` · `FUZZ_CAPTURE` |
| `ledger-clamp-symmetry-test.js` | «អនុវត្ត ➜ ដកវិញ» ត្រូវជាគូបញ្ច្រាសពិត — ការ clamp ត្រឹម 0 មិនត្រូវបង្កើតចំណូល | `CLAMPSYM_APP_DIR` |
| `emu/ledger-revert-emu-test.js` | ដដែល តែវាស់លើ **RTDB emulator ពិត ជាមួយ rules ពិត** (មិនមែន stub) | `LEDGEREMU_APP_DIR` |
| `ledger-failed-apply-revert-test.js` | ការសរសេរ ledger **ធ្លាក់** រួចការដកវិញ **ជោគជ័យ** ➜ មិនត្រូវដកលេខដែលមិនដែលត្រូវបូក | `LEDGERFAIL_APP_DIR` |
| `tx-outcome-test.js` | transaction ដែល SDK បដិសេធដោយ `disconnect` អាន **ចុះលើ server រួច** ➜ wrapper `runTransaction` សម្រេចលទ្ធផលពិតដោយអាន server (REST) · ការសម្អាតមិនបាត់ធុងសំរាម · ledger មិនដក ២ ដង · `disconnect` គ្មានគ្រោះមិនផ្ញើ Sentry money · registry (`true` ថេរ) ក្រោយ `disconnect` មិនត្រូវជា `claimed` (updater លើ cache ទទេដូច SDK ពិត) · ledger ៖ ឧបករណ៍ផ្សេងសរសេរតម្លៃដូចគ្នា ➜ ការដករបស់យើងមិនបាត់ (token `op`) · rules ចាស់បដិសេធ `op` ➜ សរសេរ ១ ដង | `TXOUTCOME_APP_DIR` |
| `monthly-ledger-agreement-test.js` | `monthly[M]` ត្រូវស្មើផលបូក `daily[d ∈ M]` — clamp ក្នុងមួយធុង · ការសរសេរធ្លាក់ខាងម្ខាង · សាលក្រមរបស់ខែដែល node កាត់ចោល · float ឆៅក្នុងការស្តារ ⛔ **បូក ៖ ការស្តារត្រូវបូកត្រឡប់គ្រប់វាល (COD·DOD·count) ចូលទាំងធុងថ្ងៃ និងធុងខែ** | `MONTHLYAGREE_APP_DIR` |
| `revenue-rules-clamp-test.js` | ⛔ តម្លៃដែល **rules ពិតបដិសេធ** ត្រូវ clamp មុនសរសេរ · revert ត្រូវដក **delta ដែល server អនុវត្ត** (ចំណូល **និង** ស្ថិតិយក) | `REVCLAMP_APP_DIR` |
| `duplicate-money-test.js` | barcode ស្ទួន ➜ លុយបូកស្ទួន — ការរក្សាទុកត្រូវការសាលក្រម `'claimed'` ពិតពី server | `DUPMONEY_APP_DIR` |
| `item-money-integrity-test.js` | **លុយសរុបរបស់ *ជួរដេក*** (⚠️ `item` = អតិថិជនម្នាក់ក្នុងថ្ងៃមួយ · `barcode` = កញ្ចប់ ១) ៖ `item.cod/.dod/.price` ត្រូវស្មើផលបូក barcodes — ជាន់ ១ AST (ការសរសេរលុយត្រូវឆ្លងកាត់ helper) · ជាន់ ២ helper លើ input ច្រើន · ជាន់ ៣ invariant លើ item **ក្នុងសតិ និងលើ server** ក្រោយ operation កំណត់ ៧ | `ITEMMONEY_APP_DIR` |
| `stats-collected-truth-test.js` | អានលេខចំណូលពី DOM នៃស្ថិតិប្រចាំថ្ងៃក្នុង browser ពិត៖ យករួច · មិនទាន់យក · ដករួច; ចំណូល = ledger ដកមិនទាន់យក ហើយតម្លៃកញ្ចប់ទាំងអស់មិនត្រូវកាត់ | `STATSTRUTH_APP_DIR` |
| `stats-screen-agreement-test.js` | រត់ `openDailyStatsModal()` និង `buildMonthlyReport()` ពិតក្នុង `vm` ហើយអាន HTML៖ ទឹកប្រាក់ប្រចាំថ្ងៃត្រូវស៊ីនឹងផលបូកក្នុងរបាយការណ៍ខែ រួមករណី `open_d > cod_d` | `STATSAGREE_APP_DIR` |
| `stats-measurable-gate-test.js` | **អេក្រង់ស្ថិតិមិនត្រូវរាយលេខលើអ្វីដែលវាស់មិនបាន** ៖ រូបមន្ត «ចំណូល» គឺ `ledger − កញ្ចប់មិនទាន់យក` ➜ ច្រកទ្វារ `collectedValueIsMeasurable()` ត្រូវគ្រប **ទាំងសងខាង** (`history` · `deleted` **និង `dailyRevenue`**)។ រត់អេក្រង់ពិត ក្នុង `vm` ដោយដាក់ listener ក្នុងរបៀប **ព្យួរ** និង **ងាប់** រួចអានលេខចេញពី HTML ➜ ត្រូវឃើញ `—` មិនមែន `$0.00` | `STATSGATE_APP_DIR` |
| `collected-value-fuzz-test.js` | **លេខលុយលើអេក្រង់ត្រូវត្រឹមត្រូវលើ *លំដាប់ចៃដន្យ*** ៖ សាងស្ថានភាពចៃដន្យ (រួមទាំងការឃ្លាតពិត ៖ «កែទឹកប្រាក់» ដោយដៃ · ថ្ងៃគ្មានជួរ ledger · ledger ខែឃ្លាតពីថ្ងៃ · listener ព្យួរ/ងាប់) រួចរត់អេក្រង់ **ពិត** ក្នុង `vm` ហើយអានលេខចេញពី HTML។ អះអាងអថេរ ៥ ៖ (ក) ថ្ងៃ↔របាយការណ៍ខែ · (ខ) ខែ=ផលបូកថ្ងៃ · (គ) វាស់មិនបាន➜`—` · (ឃ) ចំណូល=Σ barcode `isClosed && !isDeducted` · (ង) ចំណូល+មិនទាន់យក=តម្លៃទាំងអស់។ ⛔ តម្លៃសាកល្បង**មានសេន** (លេខមូលលាក់ mutation នៃការបង្គត់) | `COLLECTFUZZ_APP_DIR` · `CFUZZ_RUNS` · `CFUZZ_RUN0` |
| `empty-state-truth-test.js` | **អេក្រង់មិនត្រូវអះអាង «គ្មានទិន្នន័យ» ខណៈការពិតគឺ «មិនទាន់មកដល់»** ៖ ច្បាប់ដដែលនឹង 2.31.7 តែលើ **ករណីបញ្ជីទទេ**។ រត់អេក្រង់ **ពិត** (ស្ថិតិប្រចាំថ្ងៃ · **ចំណូលប្រចាំថ្ងៃ** · របាយការណ៍ខែ · ធុងសំរាម · តារាងប្រវត្តិ) ក្នុង `vm` ដោយដាក់ listener ក្នុងរបៀប **ព្យួរ (pending)** និង **ងាប់ (failed)** រួច **អានអត្ថបទដែលអ្នកប្រើឃើញ** ➜ ត្រូវជា «វាស់មិនបាន» មិនមែន «គ្មានទិន្នន័យ»។ ⛔ ទិសផ្ទុយ ៣ ៖ listener រស់ + ទទេពិត ➜ សារដើមដដែល · តម្រងស្វែងរករកមិនឃើញ ➜ «រកមិនឃើញ» · បញ្ជីមិនទទេ ➜ ជួរដេកធម្មតា។ ⛔ **អេក្រង់ទី ៦ ៖ ប្រអប់ «ZTO មិនទាន់បិទ»** (វាធ្លាប់ត្រូវ **stub ចោល** ➜ គ្មានតេស្តសោះ) បូក **របា** និង **toast 🔄** ៖ ទាំង ៣ អានប្រភព **២** ➜ ច្រកទ្វារ `ZTO_SYNC_VIEW_KEYS` ត្រូវគ្រប **២**។ បូក ៖ ភាពមិនពេញត្រូវចូល **signature** (cache មិនបង្កកអត្ថបទចាស់ ពេល listener ងាប់ *ក្រោយ*) | `EMPTYSTATE_APP_DIR` |
| `daily-collected-test.js` | ចំណូលតាមថ្ងៃយក៖ អត្តសញ្ញាណ barcode · តម្លៃ server ក្រោយ close · ផ្លាស់ថ្ងៃទាំងគូ · បដិសេធ/late write · repair មានពិដាន · auth/database fence · delete/restore/reopen · កែតម្លៃផ្ទៀង server ទោះ listener យឺត និងមិនបង្កើតធាតុថ្មី · cleanup ៧ ថ្ងៃមុន write ចុះ server · អធ្រាត្រ/late ACK · native set-cancel retry មានពិដាន · listener rollback និងស្នាមភ្ជាប់ rules។ មិនអះអាង atomicity រវាង history និង mirror | `COLLECTED_APP_DIR` |
| `collected-mirror-lifecycle-test.js` | កញ្ចក់ `zoew_daily_collected_cod_dod` ត្រូវដើរតាម ledger ៖ «ដក» កញ្ចប់ដែលយករួច ➜ លុបធាតុកញ្ចក់ · «ស្តារ» ➜ សាងវាឡើងវិញ **តែមួយ** លើថ្ងៃនៃ `closedAt` ថ្មី (រួមទាំងការផ្លាស់ចេញពីថ្ងៃចាស់) · ⛔ ទិសផ្ទុយ ៖ «លុប» មិនប៉ះ ledger ➜ ក៏មិនប៉ះកញ្ចក់។ App ពិតក្នុង Chromium + fake RTDB ដែលបដិសេធតាម rules ពិត | `COLLECTEDMIRROR_APP_DIR` |
| `collected-mirror-fuzz-test.js` | **កញ្ចក់ `zoew_daily_collected_cod_dod` ត្រូវត្រឹមត្រូវលើ *លំដាប់ចៃដន្យ*** ៖ បិទ · បើកវិញ · ដក · លុប · ស្តារ · កែទឹកប្រាក់ តាមលំដាប់ចៃដន្យក្នុង App **ពិត** (Chromium + fake RTDB ដែលបដិសេធតាម rules ពិត)។ អយស្ករ**ឯករាជ្យ** ៖ Σ កញ្ចក់ = Σ barcode `isClosed && !isDeducted` គ្រប់កន្លែង (ដេរីវេពី `collected = ledger − open`) ➜ ការធ្លាក់ = អេក្រង់លុយ ២ និយាយផ្ទុយគ្នា។ បូកអះអាង ៖ គ្មានកូនសោឈរលើ ២ ថ្ងៃ · គ្មានធាតុកំព្រា · តម្លៃត្រូវនឹង barcode ពិត · គ្មានការបដិសេធពី rules។ ⛔ ការវាស់ធ្វើ **ក្រោយរាល់ប្រតិបត្តិការ** មិនមែនត្រឹមចុងលំដាប់ — ការអះអាងតែនៅចុងធ្វើឲ្យប្រតិបត្តិការក្រោយៗ **លុបភស្តុតាង** នៃការធ្លាក់មុន (ស្នាមភ្ជាប់ «ដក» និង «ស្តារ» ត្រូវការលំដាប់ **ផ្ទុយគ្នា** ➜ ការចាប់មួយបាត់មួយទៀត) | `MIRRORFUZZ_APP_DIR` · `MFUZZ_RUNS` (៥) · `MFUZZ_RUN0` · `MFUZZ_OPS` (៨) |
| `loop-termination-test.js` | **រង្វិលជុំក្នុងកូដ ship ត្រូវឈប់លើ input អាក្រក់** ៖ ស្រង់តួ function ពិតរួចរត់ក្នុង child process ដាច់ដោយឡែក (ពិដានពេល + ពិដាន heap) ➜ ការមិនចេះឈប់ក្លាយជាការធ្លាក់ដែលមានឈ្មោះ ជំនួស **tab ដែលជាប់ស្ងាត់ៗ**។ គ្រប ៖ `sheetImportColumnLetter` (`Infinity` ➜ `Math.floor(Infinity/26)-1` នៅ `Infinity`) · `legacyPickupPlaceholders` (ព្រំដែនមកពី Firebase ដែល rules ទាមទារត្រឹម `>= 0`) បូកទិសផ្ទុយ (តម្លៃធម្មតានៅត្រឹមត្រូវ) និងអ្នកយាមរចនាសម្ព័ន្ធលើ `while` **គ្រប់កន្លែង** ក្នុង `app.js` **របស់ App ទាំង ២** | `LOOPTERM_APP_DIR` |
| `money-reality-check.js` ⚠️ **មិនរត់ក្នុង `run-all.sh`** (ត្រូវការឯកសារ dump) | 🩺 **ការវាស់លុយលើទិន្នន័យផលិតកម្មពិត — អានសុទ្ធសាធ** ៖ `node audit-tools/money-reality-check.js <dump.json|.json.gz>` (Firebase Console ➜ Realtime Database ➜ ⋮ ➜ Export JSON)។ យកកូដលុយ **ពិត** (`ZoeW/app.js` ឬ លើ repo ZoeW React ៖ `money-core.js`) មករត់លើ dump ➜ ពិនិត្យ ៩ ៖ ledger ខែ = Σ ថ្ងៃ · លុយជួរដេក = Σ barcodes · ស្ថិតិយកជាអត្តសញ្ញាណ · លេខអវិជ្ជមាន/NaN · «ចំណូល (យករួច)» ដែលអេក្រង់នឹងបង្ហាញ · **កញ្ចក់ `zoew_daily_collected_cod_dod` ↔ ប្រវត្តិ** (❌ កូនសោបាត់ · ថ្ងៃទាំងមូលបាត់ · រាប់ស្ទួន · ទឹកប្រាក់ខុស · កូនសោនៅសល់ក្រោយបើកវិញ; ⚠️ ថ្ងៃខុស · កូនសោគ្មានម្ចាស់) · barcode ស្ទួន · កូនសោ registry កំព្រា · **«ស្កេនតាមថ្ងៃ» (`totalCount`) ↔ កញ្ចប់ដែលនៅក្នុងប្រព័ន្ធ** (⚠️ លម្អៀង ➜ ledger រាប់កញ្ចប់ដែលលែងមាន ➜ ចំណូលធំជាងការពិត)។ ⛔ **មិនបោះពុម្ពលេខទូរស័ព្ទ ឬ barcode** · **មិនភ្ជាប់បណ្តាញ** · **មិនសរសេរអ្វី** | `MONEYREAL_APP_DIR` |
| `money-core.js` (ទិន្នន័យ មិនមែន checker) | កូដលុយពិត ២១ (function + ថេរ) ដែល `money-reality-check.js` អានលើ repo ZoeW React ដែលគ្មាន build (ឧ. `check-money.cmd` លើ Windows)។ ⛔ **កុំកែដោយដៃ** ៖ ផលិតដោយ `npm --prefix ZoeW run money:core` ពី src ពិត ហើយ `money-reality-test` ធ្លាក់ពេលវាចាស់ជាងកូដ | — |
| `redact-dump.js` ⚠️ **មិនរត់ក្នុង `run-all.sh`** | 🔒 **សម្អាត dump ➜ ឯកសារដែលផ្ញើបាន** ៖ `node audit-tools/redact-dump.js <dump.json> [out.json]`។ ជំនួសលេខទូរស័ព្ទ · barcode · id ដោយ hash (salt **ចៃដន្យរាល់ការរត់** ➜ បញ្ច្រាសមិនបាន) · លុប Locker/ឈ្មោះ/token។ ⛔ រក្សា **រចនាសម្ព័ន្ធ និងទឹកប្រាក់** ➜ `money-reality-check` ឲ្យលទ្ធផល **ដូចគ្នាបេះបិទ** (វាស់បាន ៖ ការវាស់លុយ **មុន/ក្រោយសម្អាត ដូចគ្នាបេះបិទ** ➜ កំហុសដែលបញ្ចូល ត្រូវចាប់បានទាំង ២ ខាង)។ មានជាន់ស្កេនរកលេខទូរស័ព្ទសល់ ➜ exit 1 | — |
| `registry-orphan-list.js` ⚠️ **មិនរត់ក្នុង `run-all.sh`** | 🔑 **បញ្ជីកូនសោ `zoew_barcode_registry` កំព្រា ➜ ឯកសារ payload** ៖ `node audit-tools/registry-orphan-list.js <dump.json|.json.gz> [out.json]`។ ប្រើ `barcodeRegistryKey()` **ពិតចេញពី `app.js`**; ម្ចាស់រាប់ទាំង **ប្រវត្តិ និងធុងសំរាម**។ បញ្ចេញ `{"KEY":null,…}` សម្រាប់ `curl -X PATCH` (merge ➜ កូនសោដទៃមិនប៉ះ)។ ⛔ **មិនភ្ជាប់បណ្តាញ · មិនលុបអ្វី · មិនបោះពុម្ព barcode លើអេក្រង់**។ ច្រកទ្វារបដិសេធ **៤** ៖ គ្មាន node registry · dump គ្មានប្រវត្តិ+ធុងសំរាម · កំព្រា ១០០% · **dump ដែល `redact-dump.js` សម្អាតរួច** (កូនសោពិតជាអក្សរធំជានិច្ច ➜ បច្ច័យ hash អក្សរតូច = ស្នាមច្បាស់)។ បំបែកជាកញ្ចប់ ៥,០០០ | `REGORPHAN_APP_DIR` |
| `registry-orphan-list-test.js` | **អ្នកយាមរបស់ឧបករណ៍ខាងលើ** ៖ រត់ឧបករណ៍ពិតជា process ដាច់ដោយឡែក លើ dump ក្លែង រួច **អានឯកសារលទ្ធផលពិត**។ ការអះអាងស្នូល ៖ ⛔ **កូនសោដែលមានម្ចាស់ មិនត្រូវចូលបញ្ជីលុបដាច់ខាត** (រួម barcode ក្នុងធុងសំរាម · barcodes ជា object · កូនសោអក្សរតូច)។ mutation **៦/៦** ចាប់បាន; ⛔ ទិសផ្ទុយ ៖ barcode ពិតដែល *មើលទៅដូច* hash (អក្សរធំ) មិនត្រូវបដិសេធ | `REGORPHANTEST_APP_DIR` |
| `registry-release-test.js` | កូនសោ `zoew_barcode_registry` កំព្រា ➜ barcode ជាប់អន្ទាក់ · ជួរដោះត្រូវមានច្រកចេញទី ២ | `REGISTRY_APP_DIR` |
| `money-guardian-test.js` | ⛔ **«សំណុំបៃតង» មិនមែនភស្តុតាង** — បំបែកតក្កវិជ្ជាលុយ រួចទាមទារថាអ្នកយាមយ៉ាងតិច ១ ក្រហម · អ្នកយាមរត់ស្របគ្នា (ក្នុងពិដានរបស់ `run-all.sh`) | `MONEYGUARD_APP_DIR` · `MONEYGUARD_JOBS` |
| `price-edit-abort-test.js` | ⛔ transaction ដែល **បោះបង់** ➜ ការបញ្ច្រាសលុយត្រូវរត់ដដែល · ការ **ព្យួរ** ≠ ការបរាជ័យ | `PRICEABORT_APP_DIR` |
| `stale-write.js` | គ្មានការសរសេរ item ទាំងមូលពីសតិ | `STALEWRITE_APP_DIR` |
| `compensation-order.js` | `.then(A).catch(B)` ដែល B ជាការសង្គ្រោះ | `COMP_APP_DIR` |
| `payload-schema.js` | payload ដែលសរសេរទៅ Firebase ↔ schema ក្នុង rules (**២ ទិស**) | — |
| `field-shape-test.js` | រូបរាងវាលឆៅ (លេខជាចំនួន · null · XSS) | `FIELDSHAPE_APP_DIR` |
| `raw-read-shape-test.js` | រូបរាងទិន្នន័យដែលអានចេញ | `RAWREAD_APP_DIR` |
| `concurrent-scan-test.js` | ការស្កេនស្របគ្នា | `CONCSCAN_APP_DIR` |
| `slow-write-test.js` | ការសរសេរដែលចុះយឺតក្រោយ timeout | `SLOWWRITE_APP_DIR` |
| `restore-race-test.js` · `restore-finalization-fence-test.js` | ការស្តារស្របគ្នា និង fence | — |
| `clear-history-claim-test.js` · `clear-history-finalization-fence-test.js` | «លុបទាំងអស់» claim និង fence | — |
| `emu/crud-rules-flow.js` | payload ពិត ធៀបនឹង **rules ពិត** លើ emulator | `CRUDFLOW_APP_DIR` |
| `emu/restore-deadlock-test.js` | witness ដែលបន្សល់ មិនត្រូវចាក់សោ id (deadlock ៣ ខាង) | `DEADLOCK_APP_DIR` |
| `emu/restore-mutation-emu-test.js` | លុប/ដក/កែតម្លៃចន្លោះ Restore · marker fence · cached history និង retry · អាយុ Barcode ស្តារធៀប siblings; sandbox ផ្គត់ផ្គង់ auth/database និង collected ref, អាន collected snapshot ពិត និងស្រង់ថេរពី App; ព្យួរ price write មុន HTTP acceptance រួច cleanup ឆ្លងអធ្រាត្រ និងកែ sibling ដោយ client ផ្សេង ដើម្បីវាស់ ETag conflict/retry; rules និង RTDB ពិត | `RESTOREMUTATION_APP_DIR` |
| `emu/rules.sh` | rules ពិតលើ emulator ពិត | — |
| `idtoken-fixture.js` | helper ៖ វិញ្ញាបនបត្រ និងការចុះហត្ថលេខា **Firebase ID token សាកល្បង** (RS256 ពិត) ➜ checker ដែលរត់ `zto-order-detail.js` ពិត វាស់ការផ្ទៀងផ្ទាត់ token ដោយមិនចម្លងតក្កវិជ្ជា (សោសាកល្បងប៉ុណ្ណោះ — គ្មានសិទ្ធិលើផលិតកម្ម) | — |
| `react-view.js` | helper ៖ **ស្រទាប់ React** របស់ ZoeW (`createStore` · ឃ្លាំង · `fieldValue` · ប្រអប់ · `document-io`) ស្រង់ជា **កូដពិត** ពីទិដ្ឋភាព `app.js` ➜ checker ដែលស្រង់ function ចូល `vm` រត់តួអាជីវកម្មដែលហៅ helper ទាំងនោះបាន (DOM ក្លែងរបស់ checker នៅតែជាអ្វីដែលត្រូវវាស់) | — |
| `emu/ns.js` | helper ៖ RTDB namespace **តែមួយក្នុងមួយការរត់** (`emuNamespace()`) ➜ checker `emu/*` ដែលរត់ស្របគ្នា មិនជាន់ទិន្នន័យគ្នា | — |
| `rules-duplicate-keys.js` | rules JSON គ្មានកូនសោស្ទួន · វង់ក្រចកស្មើ · **node ដែលរំពឹង object ទាមទារ object** (`newData.hasChildren(…)` ➜ primitive ត្រូវបដិសេធ · បញ្ជីដេរីវេពី rules ពិតទាំង ២) | `RULESDUP_APP_DIR` |
| `rules-shape.js` | helper ៖ ដេរីវេ node ដែលរំពឹង object ពី rules ពិត (មាន schema កូន · អាចសរសេរបាន) និងការវាស់ពីរជំហានលើ emulator (control ដក guard របស់ node ➜ primitive ទទួល · rules ពិត ➜ បដិសេធ) សម្រាប់ `rules-duplicate-keys` · `emu/crud-rules-flow` · `emu/license-seat-rules-test` | — |
| `license-app-code-test.js` | rules របស់ License មិនរាយ App ដែលលុបចោលរួច · ZoeW និង ZoeKeyGen ប្រើកូដតែមួយ · ឈ្មោះ slot កៅអី និងពិដាន `maxDevices` ស៊ីគ្នាទាំង ៣ ឯកសារ | `APPCODE_APP_DIR` |
| `connection-state-fuzz-test.js` | ស្ថានភាព listener លើ **លំដាប់ចៃដន្យ** ៖ ទង់សរុប ↔ សំណុំតាមកូនសោ · «គ្មានទិន្នន័យ» ខណៈវាស់មិនបាន · បងប្អូនប្រកាសជំនួស · សារ «ភ្ជាប់មកវិញ» មុនពេល | `CONNFUZZ_APP_DIR` |
| `ledger-count-integrity-test.js` | ការដកលុយស្វ័យប្រវត្តិត្រូវដក **ចំនួនកញ្ចប់** (`totalCount`) ជាមួយលុយ លើ ledger **ពិត** (មិន stub) ៖ ថ្ងៃ · ខែ · សតិ ត្រូវស៊ីគ្នា; «យករួច» មិនប៉ះទាំង ២ | `LEDGERCOUNT_APP_DIR` |
| `cleanup-interrupt-atomicity-test.js` | ការរំខានពាក់កណ្តាល (deploy · PTR · បិទ tab · បណ្តាញដាច់) មិនត្រូវធ្វើឲ្យកញ្ចប់បាត់ពីទាំងប្រវត្តិ ទាំងធុងសំរាម ៖ សម្លាប់ការសរសេរនៅគ្រប់ចំណុច រួចអះអាងការអភិរក្ស barcode បូកទិសផ្ទុយ (សាលក្រម ledger មិនច្បាស់ ➜ មិនប៉ះលុយ · មិនដាស់កញ្ចប់ដែល purge រួច) · អ្នកស្តាររត់ចំកណ្តាលការសម្អាតដែល **នៅរស់** (tab ដដែល · tab ទី ២ តាម Web Locks ក្លែង) ➜ លុយដកម្តងគត់ · tab ស្លាប់ ➜ ត្រូវបញ្ចប់ | `CLEANUPATOMIC_APP_DIR` |

#### នាឡិកា និងពេលវេលា

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `clock-hygiene.js` | retention ប្រើ `getServerNow()` មិនមែន `Date.now()` | `CLOCK_APP_DIR` |
| `clock-basis-test.js` | ត្រាដែលវាស់ដោយ `elapsedSince()` ត្រូវបោះដោយ `Date.now()` (មូលដ្ឋានលាយគ្នា ➜ ពិដានល្បឿនរលាយ) — ទាំងត្រាដែលជា **អថេរ** និងត្រាដែលជា **property** (`{P: …}` · `x.P = …`) បូកអាគុយម៉ង់ដែលមិនមែន Identifier; ⛔ ឈ្មោះ property តែមួយមិនត្រូវផ្ទុក **មូលដ្ឋាន ២** | `CLOCKBASIS_APP_DIR` |
| `doc-scope-test.js` | README ទាំងអស់ និង `ZTO-SETUP-KH.md` សរសេរតែ **របៀបប្រើ** ៖ ផ្នែក ៥ តាមលំដាប់ · គ្មានប្រវត្តិកំហុស · គ្មានកំណត់ត្រាតាមកំណែ · គ្មានចំនួន assertion ជា literal។ **ផ្នែក ៤** ៖ `docs/AUDIT-PROMPT.md` មិនចាស់ស្ងាត់ៗ។ **ផ្នែក ៥** ៖ ការអះអាងកំណែ **បច្ចុប្បន្ន** (ជួរតារាង root · «កំណែបច្ចុប្បន្ន» របស់ README នីមួយៗ · តារាងក្បាល `CLAUDE.md` រួម `CACHE_VERSION`) ត្រូវដេរីវេពី `APP_VERSION` ពិត — ⛔ ការយោង *ប្រវត្តិ* មិនប៉ះ។ ⛔ **បញ្ជីឯកសារត្រូវប្រៀបនឹងថតពិត** (`listReadmeFiles()`) ➜ README ថ្មីណាដែលមិនចូលបញ្ជី **ធ្វើឲ្យ checker ធ្លាក់** ជំនួសការរអិលកាត់ស្ងាត់ៗ។ **ផ្នែក ៦** ៖ ⛔ **ការរៀបរាប់ផ្ទៃ និងចំនួន ត្រូវដេរីវេពីកូដ ship** ៖ ធាតុរបា Slide និងម៉ឺនុយ (...) ស្រង់ចេញពី `index.html`/`app.js` ពិត · ចំនួនជួរ 🩺 ស្រង់ពី `runHealthCheck()` · ចំនួនអេក្រង់ដែលប្រើ `collectedValueOf()` · ទំហំ `app.js` (±១២%) · ចំនួនតំបន់ 📝 ស្មើចំនួនជួរ 📝 ពិត · ហើយ **ឈ្មោះ helper ដែលឯកសារយោង ត្រូវត្រូវបានប្រកាសនៅណាមួយក្នុង repo** (វាស់ជា *និយមន័យ* មិនមែន *វត្តមានអក្សរ* ➜ string literal របស់ checker មិនអាចធ្វើឲ្យវាងងឹត) · ហើយ **រាល់ `.js` ក្នុង `audit-tools/` ត្រូវមានឈ្មោះក្នុងកាតាឡុកនេះ** (⛔ លើកលែងឯកសារស្រមោល `.tmp-poison-*`) · ហើយចំនួនការវាស់ដែល `tools/money-check-windows/README-KH.md` អះអាង ត្រូវស្មើចំនួនផ្នែករបស់ `money-reality-check.js` ពិត · ⛔ កំណត់ត្រាតាមកំណែចាប់បានទោះមានពាក្យឈរកណ្តាល (`មុនកំណែ ZoeW …`) ហើយបញ្ជីអនុញ្ញាតដេរីវេពីការអះអាង «កំណែបច្ចុប្បន្ន» ដែលផ្ទៀងផ្ទាត់រួច · ⛔ គ្មានអក្សរថៃ (U+0E00–U+0E7F · ស្រដៀងខ្មែរ) ក្នុងឯកសារអត្ថបទណាមួយនៃ repo រួមប្រភព ZoeW React (ដេរីវេពីទីតាំង root វាស់ · probe ទិសផ្ទុយ ៖ អក្សរខ្មែរមិនត្រូវចាប់) | `DOCSCOPE_APP_DIR` |
| `monotonic-gate-test.js` | រយៈពេលកន្លងផុតឆ្លងកាត់ `elapsedSince()` (ថយក្រោយ ➜ fail-open) | `MONOGATE_APP_DIR` |
| `khmer-timezone-test.js` | ប្រតិទិនអាជីវកម្មជា `Asia/Phnom_Penh` គ្រប់ឧបករណ៍ | `KHMERTZ_APP_DIR` |
| `cleanup-clock-guard-test.js` | ការសម្អាតដែលបំផ្លាញ ត្រូវការនាឡិកា server **និងការភ្ជាប់រស់** | `CLEANUPCLOCK_APP_DIR` |

#### បណ្តាញ · ការតភ្ជាប់ · Service Worker

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `connection-recovery-test.js` | listener ដែលធ្លាក់ត្រូវត្រឡប់មកវិញ · បងប្អូនមិនប្រកាសជំនួស · `.info/*` ដែរ · **Reconfig កណ្តាលការផ្ទុក SDK ក្នុង App ទាំង ២** · ⛔ **ច្រកទ្វារជំនាន់ (`listenerGeneration`) ត្រូវមានគ្រប់ listener** — វដ្តដេរីវេពី `DB_LISTENER_KEYS` ពិត (callback ចាស់មិនប្រកាសទិដ្ឋភាពស្រស់ · មិនសរសេរជាន់) បូកទិសផ្ទុយ ៖ callback ថ្មី **ត្រូវ** ដក pending | `CONNRECOVERY_APP_DIR` |
| `reconnect-ladder-test.js` | វដ្តភ្ជាប់ឡើងវិញមិនកាត់ handshake | `LADDER_APP_DIR` |
| `network-timeout-test.js` | រាល់ `fetch` ត្រូវ abort ពិត | `NETTIMEOUT_APP_DIR` |
| `network-pressure-test.js` | ពិដានចំនួនសំណើស្របគ្នា | `NETPRESSURE_APP_DIR` |
| `license-network-pressure-test.js` | ផ្លូវបណ្តាញទី ៣ (`license-verify.js`) មានពិដានដែរ | `LICPRESSURE_APP_DIR` |
| `stall-guard-test.js` | បណ្តាញ «ភ្ជាប់តែស្លាប់» ព្យួរ — មិនបោះកំហុស | `STALLGUARD_APP_DIR` |
| `db-stall-guard-test.js` | RTDB មិនបដិសេធពេលក្រៅបណ្តាញ ➜ សោ in-flight ជាប់រហូត | `DBSTALL_APP_DIR` |
| `write-stall-guard-test.js` | ការសរសេរដែលព្យួរ **ខាងក្រោយ helper** ➜ ការសម្អាតស្វ័យប្រវត្តិងាប់ · គ្មានសារដល់អ្នកប្រើ | `WRITESTALL_APP_DIR` |
| `stall-lock-release-test.js` | សោការងារដែលឈរខាងក្រោយ **ការសរសេរធុងសំរាមដែលព្យួរ** ➜ ច្បាប់ ២ម៉ោង/៧ថ្ងៃ ងាប់លើកញ្ចប់នោះ (លុយមិនត្រូវដក) · របៀបស្កេនដកងាប់ទាំងស្រុង | `STALLLOCK_APP_DIR` |
| `locker-claim-guard-test.js` | ការកំណត់ Locker ជាន់នឹង «លុបទាំងអស់» ដែល claim រួច ➜ ការប្តូរបាត់ស្ងាត់ៗ ខណៈ toast រាយ ✅ | `LOCKERCLAIM_APP_DIR` |
| `stale-clear-claim-test.js` | `clearClaim` ដែល lease ផុត ជាអន្ទាក់ស្ថាពរ ➜ ច្បាប់ ២ម៉ោង/៧ថ្ងៃ ងាប់លើកញ្ចប់នោះ (លុយមិនត្រូវដក) | `STALECLAIM_APP_DIR` |
| `zoew-suite-test.js` | suite ផ្ទាល់ខ្លួនរបស់ ZoeW React (typecheck · lint · vitest · slot/purity · doc · android · logic · parity · build · sw · smoke · native · rules) ត្រូវរត់ពិតក្នុង run-all ➜ tests/scripts/android/config មិនខូចស្ងាត់ៗ; គ្មាន node_modules ឬ ZoeW ដើម ➜ FAIL មានឈ្មោះ (មិនមែន SKIP) · `--parity` (ការងារ `zoew-parity` ដាច់ដោយឡែក ព្រោះពិដាន ៣០០ វិ.) ៖ `parity:dom` · `parity:live` · `parity:deep` ធៀប ZoeW ដើម លើ `dist-parity/` និង ZoeW ដើមក្នុងថតឯកជន (មិនប្រណាំង `dist/` · `.original/`) | `ZOEWSUITE_APP_DIR` |
| `late-commit-test.js` | ⛔ ការព្យួរ ≠ ការមិនកើត — transaction ដែល commit **យឺតក្រោយពិដាន** ត្រូវបញ្ចប់ការងារក្រោយ commit | `LATECOMMIT_APP_DIR` |
| `periodic-network-guard-test.js` | callback Activate ចាស់មិនប្ដូរ UI/listener របស់ auth/database ថ្មី · ការងារតាមវដ្តមិនស៊ីបណ្តាញខុសពេល · ⛔ **ច្រកទ្វារ `sessionExpiryCheck` ដែលជាប់ `'pending'`** ➜ វដ្ត ៦០ វិ. មិនដែលរត់ ➜ ច្បាប់វគ្គ ៤ ម៉ោងងាប់ ៖ រាល់ផ្លូវដែលធ្វើឲ្យ App ប្រើបាន ត្រូវ arm វា (ការចូលប្រព័ន្ធ **និង** ការ Activate) | `PERIODICGUARD_APP_DIR` |
| `adaptive-link-test.js` | ការងារស្រេចចិត្តសម្របតាម 2G/Data Saver (**fail open**) | `ADAPTIVE_APP_DIR` |
| `history-patch-retry-test.js` | ការដាច់បណ្តាញ ≠ ការបរាជ័យ — ការសរសេរត្រូវរត់ឡើងវិញ · ជាមួយ wrapper `disconnect` ពិត (ក្រៅបណ្តាញ · `fetch` ធ្លាក់) ការសម្គាល់ខលនៅតែចូលជួរ · ការព្យួរសុទ្ធនៅតែ revert | `HISTPATCH_APP_DIR` |
| `sw-install-integrity-test.js` | SW មិន activate ដោយសំបកមិនពេញ · HTTP cache ចាស់មិនពុល cache SW · deploy ថ្មីដែល install ធ្លាក់ ➜ SW ចាស់មិនចាក់ឯកសារកំណែថ្មីចូល cache ចាស់ (asset ដែលសំបកយោងមានក្រៅបណ្តាញ) | `SWINTEG_APP_DIR` |
| `sw-shell-latency-test.js` | សំបកដែល cache រួច មិនរង់ចាំបណ្តាញ | `SWLATENCY_APP_DIR` |
| `sw-cache-key-test.js` | URL រសើប (Setup Link) មិនជាប់ក្នុង Cache Storage · `guide.html` និង Netlify `/guide` មាន route ផ្ទាល់ · direct navigation ទៅ `/app.js` នៅតែត្រឡប់ `index.html` | `SWKEY_APP_DIR` |
| `sw-cache-failure-test.js` | Cache API បរាជ័យ ≠ App ដាច់ | `SWFAIL_APP_DIR` |
| `sw-revalidate-pressure-test.js` | ការធ្វើឲ្យសំបកស្រស់ មិនស៊ីកូតាការតភ្ជាប់ | `SWREVAL_APP_DIR` |
| `sw-abort-propagation-test.js` | SW គោរព caller abort | `SWABORT_APP_DIR` |
| `sw-client-wiring-test.js` | ខ្សែភ្ជាប់ SW ↔ ទំព័រ ក្នុង `registerServiceWorker()` លើ App · SW · Chromium ពិត ៖ សារដែល SW ពិតផ្ញើ (`zoew-open-notify` ➜ ផ្ទាំង 🔔 · `zoew-push` ➜ ទាញដំណឹង · ប្រភេទដេរីវេពី `sw.js`) · `visibilitychange`/`focus`/`online` ➜ `reg.update()` ក្រោយពិដាន ១៥ នាទី · deploy ថ្មី ➜ `controllerchange` ➜ ផ្ទាំង «មានកំណែថ្មី» (ទិសផ្ទុយ ៖ ការដំឡើងដំបូង · សារមិនស្គាល់ · មុនពិដាន) | `SWWIRE_APP_DIR` |
| `offline-shell-test.js` | ស្កេនដើរពេលបណ្តាញដាច់ (គ្មានការពឹងលើ CDN) | `OFFLINE_APP_DIR` |
| `sdk-surface.js` | `fb.X` ដែល loader មិន export ➜ `undefined` ស្ងាត់ | `SDKSURFACE_APP_DIR` |
| `sdk-offline-boot-test.js` | បើកក្រៅបណ្តាញ ➜ ស្ថានភាព «ក្រៅបណ្ដាញ» មិនមែនប្រអប់ Config | `SDKBOOT_APP_DIR` |

#### Lookup API និង ZTO

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `lookup-prefetch-test.js` | ការទាញតារាងជាមុន ៖ ព្យាយាមវិញលឿន តែមិនបាញ់ចំពេលស្កេន · ការដោះសោ PIN ➜ Lookup បន្តភ្លាម · Keyboard មិនលោតកាត់ការស្វែងរក | `LOOKUPPREFETCH_APP_DIR` |
| `lookup-freshness-test.js` | នាំចូលរួច ➜ ទិន្នន័យត្រូវមកភ្លាម (client **និង** Apps Script) | `LOOKUPFRESH_APP_DIR` |
| `lookup-failure-identity-test.js` | `lookupCode` ត្រូវរស់រានពីការព្យាយាមឡើងវិញ · 401 ត្រូវណែនាំ Windows sync tool ➜ Netlify Blobs មិនមែន paste Cookie ដោយដៃ | `LOOKUPFAILURE_APP_DIR` |
| `lookup-burst-test.js` | ការស្កេនជាបន្តបន្ទាប់ ៖ ការរវល់ជា *ការរង់ចាំ* មិនមែន *ការបញ្ចប់* | `LOOKUPBURST_APP_DIR` |
| `lookup-config-secret-test.js` | Secret របស់ Lookup API ត្រូវអ៊ិនគ្រីប | — |
| `google-sheets-cache-test.js` | cache ខាង Apps Script | — |
| `sheet-import-test.js` | នាំចូល Excel ៖ PIN ជាច្រកទ្វារ · *simple request* · secret អ៊ិនគ្រីប · លេខ ០ នាំមុខ | `SHEETIMPORT_APP_DIR` |
| `zto-proxy-test.js` | ZTO proxy ៖ ការដក auto-login · ថវិកាពេល · «រកមិនឃើញ» ≠ កំហុស · `?diag=1` គ្មាន secret | `ZTOPROXY_APP_DIR` |
| `zto-cookie-store-test.js` | Cookie ក្នុង Netlify Blobs · Blobs មិនមែនចំណុចដាច់តែមួយ · ការបន្តអាយុ (ពិដានទប់ការសរសេរ តែមិនទប់ការចងចាំ) | `ZTOSTORE_APP_DIR` |
| `zto-budget-test.js` | ⛔ ថវិកាពេលត្រូវគ្របដណ្តប់ handler ទាំងមូល (អាន Cookie + upstream + ការបន្តអាយុ) · 401 ដោយ Cookie ចាស់ក្នុង cache ➜ អានឡើងវិញ ១ ដង | `ZTOBUDGET_APP_DIR` |
| `zto-negative-cache-test.js` | ⛔ សាលក្រម «រកមិនឃើញ» ត្រូវចូល cache (TTL ខ្លី) ដោយ **ការបរាជ័យបណ្តោះអាសន្នមិនចូល** · ស្នាមភ្ជាប់ ៖ លេខលំនាំដើមក្នុង `ZTO-SETUP-KH.md` ត្រូវស៊ីនឹងកូដ | `ZTONEG_APP_DIR` |
| `zto-cookie-sync-test.js` | Windows helper ៖ ចាប់ header ពិត · DPAPI · signed URL · របៀប `--auto` · ការព្យាយាមឡើងវិញមានពិដានពេលបណ្តាញដាច់ | `ZTO_SYNC_APP_DIR` |
| `zto-network-boundaries-test.js` | HTTP body ព្យួរ/លើសទំហំ/ដាច់កណ្តាល · រក្សា HTTP rejection · Cookie ថ្មីប្រើ single-flight តែមួយ | `ZTO_BOUNDARIES_APP_DIR` |
| `zto-cookie-session-test.js` | ការបន្ត Cookie ឆ្លង TTL · ទប់ write ចាស់ជាន់ Sync ថ្មី · សាលក្រម auth តាម Cookie | `ZTO_SESSION_APP_DIR` |
| `zto-cookie-capture-test.js` | រង់ចាំ Order Detail response ពិត · Cookie ក្រោយ renewal · បែងចែក fingerprint និងសុពលភាព | `ZTO_CAPTURE_APP_DIR` |
| `zto-signed-status-test.js` | ⛔ សាលក្រម «បិទរួចនៅ ZTO» មាន **៣** (`true`/`false`/`null`) · ការកំណត់ខុសបិទតែមុខងារនេះ **មិនសម្លាប់ Lookup** · cache ដាច់តាមការកំណត់ · តម្លៃមិនលេចក្នុង `?diag=1` | `ZTOSIGNED_APP_DIR` · **ឯកសារត្រូវនឹងកូដ** (មូលហេតុ `signedReason` · ពិដានចំនួន · វាល `?diag=1` ក្នុង `ZTO-SETUP-KH.md`) |
| `zto-list-sync-test.js` | ⛔ ការទាញ **បញ្ជី** ពី ZTO (`?list=1`) ៖ ការកំណត់ខុសបិទតែមុខងារបញ្ជី **មិនសម្លាប់ការស្កេន** · ការបញ្ចាំង PII នៅ server (ឈ្មោះ · អាសយដ្ឋានមិនឆ្លងកាត់; `fcAmount` ➜ **DOD លើផ្លូវបញ្ជីតែម្យ៉ាង**) · កូនសោ cache ផ្សេងពី barcode · ផ្លូវបណ្តាញរួម (`fetch(` ម្តងគត់) · **ការអភិរក្សនៃការចាត់ថ្នាក់ ៤ ក្រុម** · barcode ស្ទួនក្នុងទំព័រតែមួយ ➜ ធាតុចុងក្រោយឈ្នះ · ⛔ **ការមើលជាមុនមិនសរសេរអ្វីសោះ** · **ការបញ្ចូលឆ្លងទ្វារដដែលនឹងការស្កេន** · **វដ្តជីវិត ៣ ស្កេន (`03`/`04`/`05`) លើ barcode ដដែល ➜ កញ្ចប់ ១ មិនមែន ៣** · ⛔ **កាលបរិច្ឆេទដេរីវេពី *ថ្ងៃស្កេន ZTO* ទាំងស្រុង** (`scanDate` · `time` · `createdAt` · **ថ្ងៃ/ខែរបស់ ledger**) ហើយ **ជួរដេកដែលចាស់ជាងច្បាប់សម្អាត ➜ ក្រុម «រំលង»** (បើបញ្ចូល ➜ ចូលធុងសំរាមភ្លាម ➜ ដកលុយ) · **រាល់មូលហេតុរំលងមានអត្ថបទដល់អ្នកប្រើ** · ⛔ **លេខសាខាមកពី *សំណើ* មិនមែន env** ៖ វាចូល **កូនសោ cache** (សាខា ២ លើ instance តែមួយ ➜ ជួរដេកមិនលាយ) · មិនលេចក្នុង `?diag=1` · រូបរាងដេរីវេពី Function · គ្មានលេខសាខា ➜ **បោះ មិនប៉ះបណ្តាញ** · `ZTO_LIST_SITE_CODE` ដែលសល់ក្នុង Netlify **មិនដើរ** | `ZTOLIST_APP_DIR` · **ជាន់ការពារទី ២ តាម `scanTypeDesc`** («មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស» ៖ វាលអវត្តមាន ឬទទេ **មិនរំលង**) · ច្រកទ្វារ «វាស់បាន» លើក្រុម «ថ្មី»/«មានរួច» · ពិដានទំព័រខាង client មិនលើសខាង server · ការចុចរបស់អ្នកប្រើមិនទប់ដោយ `linkIsFrugal()` · ⛔ **របៀបបរាជ័យ «ព្យួរ» និង «យឺតតែជោគជ័យ» លើផ្លូវបញ្ចូល** ៖ `withTimeout()` ជា `Promise.race` ➜ claim ដែល timeout ត្រូវដោះ **យឺត** បើវាចុះជា `claimed`; ការសរសេរដែល timeout ⛔ **មិនដោះកូនសោ ភ្លាម** (commit យឺត ➜ **COD បូកស្ទួន**); សារត្រូវរាយ «⏳ កំពុងរក្សាទុក» មិនមែន «បរាជ័យ» |
| `zto-sync-banner-test.js` | ⛔ របា «ZTO មិនទាន់បិទ» ៖ «មិនទាន់វាស់» មិនក្លាយជា «មិនទាន់បិទ» · មុខងារដេកលក់ពេលគ្មានការកំណត់ · Barcode បើកវិញ ➜ របាបាត់ · XSS · ការចាកចេញលុបទាំង DOM ទាំង storage | `ZTOBANNER_APP_DIR` · **ការហៅជាប់រហូតពេលដេកលក់** · ការបោះចោលតាមតម្លៃ (`false` រស់ចុងក្រោយ **និងសាលក្រមថ្មីមិនបោះខ្លួនឯង**) · **ការទប់ពេល upstream ធ្លាក់ជាប់ៗ និងការកាត់ឲ្យខ្លីពេលបណ្ដាញត្រឡប់មកវិញ** · ច្រកទ្វារ 2G/ប្រអប់ (ចេតនាអ្នកប្រើឈ្នះ) · ការទប់វែងមិនភ្ញាក់រហូត · ស្នាមភ្ជាប់ឈ្មោះវាល ២ ឯកសារ · ទទឹងលើទូរស័ព្ទ ៣៦០px · អ្នកយាមលុយស្កេនម៉ូឌុលពិត · **fuzz លំដាប់ចៃដន្យ** · **ព្រំដែន TTL និងមូលដ្ឋាននាឡិកានៃផ្លូវធុងសំរាម** (រូបរាងឆៅ · នាឡិកាឃ្លាត ៣ ទិស · ត្រា `at` ឈរលើនាឡិកាឧបករណ៍) · **ការអត់ឃ្លាននៃជួរបោស** (barcode ដែល ZTO បដិសេធជានិច្ច មិនត្រូវជាប់ក្បាលជួរ ➜ កញ្ចប់បើកទទួលវេន ➜ ការបិទស្វ័យប្រវត្តិមិនស្លាប់; ⛔ ទិសផ្ទុយ ៖ មិនបង្កើតការហៅបន្ថែម) · **cursor ត្រូវរស់រានពីការបោះក្នុងរង្វិលជុំ** · **ច្រកទ្វារ `autoLookupInFlight`** (ទប់ទាំងជុំស្វ័យប្រវត្តិ ទាំងការចុច — ពិដានសំណើស្របគ្នា) · **ជាន់ទី ២ នៃកុងតាក់បិទស្វ័យប្រវត្តិ វាស់ដាច់ពីជាន់ទី ១** · **ធាតុដែលមាន `clearClaim` ឬ marker ស្តារ មិនចូលជួរបិទ** · ⛔ **«Fast Mode» ជាច្រកទ្វារនៃកុងតាក់ ZTO ទាំង ២** ៖ វាស់ការលេច/លាក់ដោយ `getComputedStyle()` ក្រោយ `openSideDrawer()` ពិត ហើយ **ការលាក់ត្រូវបិទមុខងារ** ដែរ (លំនាំដើម «បើក» មិនឈ្នះ Fast Mode ដែលដកគ្រីស) |

⛔ ក្រុមតេស្តរបស់ `zto-proxy-test.js` រត់ **តាមលំដាប់** ព្រោះពួកវាចែក
`process.env` និង `global.fetch` — ការរត់ស្របគ្នាបង្កើត **ការធ្លាក់ក្លែងក្លាយ**។

#### សុវត្ថិភាព · License · Storage

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `csp-enforced-test.js` | បម្រើ App ជាមួយ **header CSP ពិត** ➜ គ្មានការរំលោភ ហើយ UI នៅដើរ | `CSP_APP_DIR` |
| `csp-lazy-resource-test.js` | ធនធានផ្ទុក **យឺត** ក៏ត្រូវឆ្លង CSP ដែរ | `CSPLAZY_APP_DIR` |
| `inline-handler-xss-test.js` | ខ្សែអក្សរពី Firebase មិនធ្លាក់ចូល attribute របស់ handler | `INLINEXSS_APP_DIR` |
| `html-sink-escaping.js` | រាល់តម្លៃចូល HTML ត្រូវ `sanitizeInput()` (**ទាំង ២ ទម្រង់**) | `SINK_APP_DIR` |
| `secret-hygiene.js` | credential ក្នុង DOM · ការលាក់ secret មុនផ្ញើទៅ Sentry · ⛔ **បញ្ជីកូនសោសម្ងាត់ត្រូវគ្រប secret ដែល *ប្រព័ន្ធនេះកាន់*** — ឈ្មោះ **ដេរីវេពីកូដពិត** (អាគុយម៉ង់របស់ `encrypt/decryptLookupSecret()` · `PROXY_KEY_HEADER` · `process.env.ZTO_*KEY` · `SESSION_COOKIE_NAME`) មិនមែនបញ្ជីរឹង ➜ secret ថ្មីនៅជុំក្រោយមិនរអិលកាត់។ ⛔ ទិសផ្ទុយ ៖ ឈ្មោះមិនមែន secret ដែលមើលទៅស្រដៀង (`path` · `patch` · `dispatch` · `headerName`) មិនត្រូវលាក់ | — |
| `storage-guard.js` | រាល់ការប៉ះ storage ត្រូវការពារ (getter ខ្លួនវាក៏បោះដែរ) | `STORAGE_APP_DIR` |
| `storage-blocked-boot-test.js` | storage ដែលត្រូវបិទ ➜ App នៅតែបើកបាន | `STORAGEBOOT_APP_DIR` · `STORAGEBOOT_CHROME` |
| `dom-hygiene.js` · `state-hygiene.js` | គ្មានទិន្នន័យអតិថិជនសល់ក្រោយចាកចេញ | — |
| `setup-link-logout-test.js` | Setup Link មិនរស់រានក្រោយចាកចេញ | `SETUP_APP_DIR` |
| `setup-link-roundtrip-test.js` · `setup-link-browser-test.js` | ZoeKeyGen encode ↔ ZoeW decode | `SETUPRT_APP_DIR` · `SETUPLINK_APP_DIR` |
| `pin-prompt-test.js` | សារប្រអប់ PIN ត្រូវតាមប៊ូតុងដែលហៅ | `PINPROMPT_APP_DIR` |
| `biometric-unlock-test.js` | ជីវមាត្រជាការ **ដោះសោ PIN** មិនមែនជំនួស PIN | `BIOMETRIC_APP_DIR` |
| `app-lock-test.js` | ចាក់សោ App ៖ មិនប៉ះ session ៤ ម៉ោង · Refresh និងការខលមិនចាក់សោ · កុងតាក់ប្តូរបានទាំង ២ ទិស (បើក និងបិទ) | `APPLOCK_APP_DIR` · `APPLOCK_CHROME` |
| `health-check-test.js` | 🩺 ពិនិត្យសុខភាពប្រព័ន្ធ ៖ **អានសុទ្ធសាធ** · មិនបង្ខំ PIN · «ពិនិត្យមិនបាន» ជា ⚠️ មិនមែន ❌ **និងទិសផ្ទុយ ៖ ✅ ក៏ត្រូវវាស់ដែរ** · secret មិនឡើងដល់ DOM · ផ្លូវ Apps Script មិនផ្ញើ header · `fetchWithTimeout` ពិត មិន stub · ចំនួនជួរដែលគូរពិត | `HEALTH_APP_DIR` |
| `license-grace-test.js` | «ផ្ទៀងផ្ទាត់មិនបាន» ≠ «ហត្ថលេខាខុស» — កុំលុប record | — |
| `license-clock-trust-test.js` | ទង់ «sync រួច» បើកតែដោយតម្លៃពី server ពិត | `LICENSECLOCK_APP_DIR` |
| `license-clock-rollback-test.js` | ម៉ោងមិនអាចថយក្រោយ; Activate ត្រូវការសាលក្រម server | `LICROLLBACK_APP_DIR` |
| `license-record-race-test.js` | សាលក្រម License ចាស់មិនលុប/សរសេរជាន់ activation ថ្មី ឬស្តារ record ដែលបានលុប; ECDSA ពិត និងវគ្គពីរចែក storage | `LICRACE_APP_DIR` |
| `license-seat-test.js` | **Key ១ ➜ ឧបករណ៍តាមពិដាន** ៖ ពិដានលំនាំដើម ១ ➜ ឧបករណ៍ទី ២ បដិសេធ · ពិដាន ២ ➜ ឧបករណ៍ទី ២ ត្រូវបាន តែទី ៣ បដិសេធ · ការប្រណាំងរំកិលទៅ slot ទំនេរ · ឧបករណ៍ដដែល Activate ម្តងទៀតបាន · អានកៅអីមិនបាន ➜ **មិនលុប** record | `LICSEAT_APP_DIR` |
| `emu/license-seat-rules-test.js` | ច្បាប់ដដែល តែវាស់លើ **rules ពិត** របស់ License Project (RTDB emulator) ៖ អ្នកសម្រេចត្រូវឈរនៅ server មិនមែន client · ការដោះឧបករណ៍ជារបស់ admin តែម្នាក់ · **ដំណឹង `license_announcements`** ៖ payload/id ពី `buildNoticePayload()`/`newNoticeId()` ពិត · admin តែម្នាក់សរសេរ/លុប · ZoeW អានតាម `announcementsUrl()` ពិតដោយគ្មាន auth (`limitToLast`) · schema បដិសេធប្រភេទ `update` និងប្រវែងលើស | `LICSEATEMU_APP_DIR` · `LICSEATEMU_PORT` |
| `emu/tx-disconnect-emu-test.js` | ថ្នាក់ `disconnect` វាស់លើ **SDK Firebase ពិត** (កំណែដដែលនឹង CDN) · RTDB emulator ពិត · proxy TCP ៖ ack បាត់ក្រោយ server អនុវត្ត ➜ SDK បដិសេធ `disconnect` ខណៈ server ប្រែរួច · wrapper ពិតរបស់ App សម្រេចត្រូវទាំង ២ ករណី · registry ៖ SDK ពិតរត់ updater លើ cache ទទេ ➜ `claimBarcodeInRegistry()` ពិតមិន `claimed` លើ barcode ដែលចុះឈ្មោះរួច · ledger ៖ ឧបករណ៍ផ្សេងសរសេរតម្លៃដូចគ្នាមុន put របស់យើងត្រូវកាត់ ➜ `runLedgerTransaction()` ពិតមិន `committed` | `TXEMU_APP_DIR` · `TXEMU_PORT` |
| `emu/app-writes-rules-test.js` | **ការសរសេរពិតរបស់ App ↔ rules ពិត** ៖ រត់ `revenue-fuzz-test.js` (App ពិតក្នុង Chromium · ស្កេន · បិទ/បើក · ដក · លុប · ស្តារ · កែតម្លៃ · សម្អាត ២ម៉ោង/៧ថ្ងៃ · ឧបករណ៍ផ្សេង) ជាមួយ `FUZZ_CAPTURE` ➜ ចាក់ការសរសេរតាមលំដាប់ពិតទៅ RTDB emulator ជាមួយ `firebase-database.rules.json` ពិត ៖ App ➜ user · harness ➜ owner ➜ ការបដិសេធណាមួយ = FAIL · probe ទិសផ្ទុយ (record ប្រវត្តិ `.validate: false` ➜ ត្រូវបដិសេធ) · ជាន់ ≥ ១៥០ ការសរសេរ · គ្រប root ៩ | `APPWRITES_APP_DIR` · `APPWRITES_STRICT` · `APPWRITES_RUNS` · `APPWRITES_OPS` |
| `emu/app-network-e2e-test.js` | **App ពិត** (build វាស់ក្នុង Chromium) · **SDK Firebase ពិត** (កំណែដដែលនឹង CDN · បម្រើក្នុងស្រុក) · RTDB emulator ពិត + rules ពិត · proxy TCP ៖ offline/online ពិត ➜ ស្ថានភាព និងទិន្នន័យ · ការតភ្ជាប់ «ងាប់ស្ងាត់» (socket បើកតែឈប់បញ្ជូន · `navigator.onLine` នៅ `true`) ➜ App ត្រូវឈប់រាយ «ភ្ជាប់ Server រួចរាល់» ហើយភ្ជាប់វិញពេលបណ្តាញមកវិញ តាមទ្វារ ៣ (ការសរសេរព្យួរ · ភ្ញាក់ពី background · វដ្ត ៦០ វិ.) · ទិសផ្ទុយ ៖ យឺតតែរស់ ➜ មិនផ្តាច់ · listener មិនស្ទួនលើ SDK ពិត | `NETE2E_APP_DIR` · `NETE2E_EMU_PORT` · `NETE2E_STRICT` · `NETE2E_CHROME` · `NETE2E_DEBUG` |
| `keygen-pin-flow-test.js` · `keygen-session-security-test.js` | ផ្លូវ PIN និង session របស់ ZoeKeyGen; Load Signing Key កណ្ដាល Generate មិនចាក់សោប៊ូតុងជាប់ | `KEYGEN_APP_DIR` |
| `keygen-notice-test.js` | ដំណឹង ZoeKeyGen ➜ ZoeW (ផ្ទាំង 🔔) ៖ ប្រភេទ · ព្រំដែនប្រវែង · ទម្រង់ id ស៊ីគ្នារវាង `app.js` ↔ `index.html` ↔ rules · `sendNotice()`/`deleteNotice()` ពិតក្នុងរបៀបបរាជ័យ (បដិសេធ · ព្យួរហើយ commit យឺត · ការអានធ្លាក់ · logout កណ្តាលទី) ➜ toast ✅ តែក្រោយ commit · បញ្ជី escape HTML | `KEYGEN_APP_DIR` |
| `keylist-consistency-test.js` | meta ចាស់/ថ្មី merge ត្រឹមត្រូវ; ស្លាកឧបករណ៍មានសាលក្រម ៣ (ចងរួច · ទំនេរ · **ពិនិត្យមិនបាន**) ហើយលេខសម្គាល់ឧបករណ៍ពេញមិនឡើងដល់ DOM | `KEYLIST_APP_DIR` |
| `auth-recovery-test.js` | ការស្ដារ session ពេលបណ្ដាញយឺត (ZoeKeyGen) | `AUTH_APP_DIR` |
| `devtools-guard-test.js` | ការរកឃើញ DevTools (ZoeKeyGen) | `DEVGUARD_APP_DIR` |
| `dependency-security-test.js` | dependency ដែល vendor ត្រូវចាក់សោដោយ hash | `DEPSEC_APP_DIR` |
| `firebase-config-paste-test.js` · `firebase-backup-test.js` | ការ paste Config និង CLI បម្រុងទុក; native HTTP body ព្យួរ/បដិសេធត្រូវមានពិដាន និងបិទ socket | `FBACKUP_APP_DIR` |

#### UI · ទម្រង់បង្ហាញ · កាយវិការ

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `layout-check.js` | CSS បំបែក/លើសទទឹង លើ 320–1440px (**អះអាង ២ ខាង**) | `LAYOUT_APP_DIR` |
| `fluid-type-focus-test.js` | មាត្រដ្ឋានអក្សរ ៣ ជំហាន និងសញ្ញាផ្តោត | `FLUIDTYPE_APP_DIR` |
| `gesture-test.js` | PTR · ការលាក់របា Tab · ចង្វាក់ស៊ុម | `GESTURE_APP_DIR` |
| `history-menu-dismiss-test.js` | Chromium ពិត៖ ម៉ឺនុយ (...) បិទពេលអូសផ្ទាំង/រមូរខាងក្រៅ · ចលនាបើក និង Reduce Motion · ចុច/រមូរក្នុងម៉ឺនុយ | `HISTORYMENU_APP_DIR` |
| `panel-motion-test.js` | ចលនាផ្ទាំង ១:១ (កម្ពស់ស្មើ · snap ↔ PTR) · ស៊ុមក្រោមកាតលើ Android ដូច iOS (ប្រៀបរូបថត pixel) | `PANELMOTION_APP_DIR` · `PANELMOTION_SHOT_DIR` (រក្សារូបថត) |
| `panel-snap-ownership-test.js` | កូដពិតក្នុង VM៖ callback ចាស់ក្រោយ watchdog/cleanup មិនដោះ pause ថ្មី · ចលនាស្របគ្នា · deadline · ផ្លូវ finish/reject | `PANELSNAP_APP_DIR` |
| `ios-panel-glide-test.js` | ចលនាលើ iOS មិនឃ្លាតពី Android | `IOSGLIDE_APP_DIR` |
| `phone-search-swipe-test.js` | កាយវិការអូស និង auto pull up | `SWIPE_APP_DIR` |
| `phone-suggest-test.js` | ការណែនាំលេខទូរស័ព្ទ | `PHONE_APP_DIR` |
| `page-nav-test.js` | រចនាសម្ព័ន្ធទំព័រ · របា Slide · Locker | `PAGENAV_APP_DIR` |
| `ui-flow-test.js` | អន្តរកម្មជម្រៅ · ការប្រណាំងឧបករណ៍ច្រើន · ផ្លូវបរាជ័យ · ប្រអប់ជាន់លើបិទ ➜ ផ្លូវលុប/កែ មិនខូច | `UIFLOW_APP_DIR` |
| `toast-truth-test.js` | Toast និយាយការពិត realtime | `TOAST_APP_DIR` |
| `toast-action-truth-test.js` | Toast សកម្មភាពសរសេរ៖ pending/reject/commit ពិត · static semantic marker ទាំង ២ App | `TOAST_ACTION_APP_DIR` |
| `boot-runtime.js` · `boot-animation-test.js` | កំហុស runtime ពេល boot · ចលនា boot · ធនធានឆ្លង origin; សេណារីយ៉ូធម្មតាទប់សំណើក្រៅ origin ដើម្បីមិនពឹង CDN | `BOOT_APP_DIR` · `BOOTANIM_APP_DIR` |
| `animation-cost.js` · `layout-thrash.js` | ចលនាដែលបង្កើត layout/paint រាល់ស៊ុម | `ANIM_APP_DIR` · `THRASH_APP_DIR` |
| `css-classes.js` · `css-media-override.js` | class គ្មានច្បាប់ (ស្កេន markup ដំបូង · `app.js` · **JSX ទាំងអស់** ក្នុង `components.js` — class ដែលមិនគូរពេលដំបូង ក៏ត្រូវមានច្បាប់) · ច្បាប់ `@media` ដែលស្លាប់ · **class variant ដែលឈរមុន base របស់វា** (specificity ស្មើ ➜ លំដាប់ឈ្នះ ➜ ការប្រកាសស្លាប់ស្ងាត់ៗ) | `CSSMEDIA_APP_DIR` |
| `css-var-test.js` | `var(--x)` ដែលគ្មានការប្រកាស `--x` ➜ ច្បាប់ CSS ស្លាប់ស្ងាត់ៗ | `CSSVAR_APP_DIR` |
| `listener-leak-test.js` | listener/node កកកុញឆ្លងវដ្តពិត | `LEAK_APP_DIR` · `LEAK_CHROME` |
| `wiring.js` | HTML ↔ JS មិនត្រូវគ្នា (`id` · `data-act` · `data-close`) | — |
| `action-binding-test.js` | ធាតុ `data-act` ដែលទទួល `on*=` ខាង JS ➜ ការចុចរត់ ២ ផ្លូវ | `ACTIONBIND_APP_DIR` |
| `perf-check.js` | ដំណើរការនៅទិន្នន័យធំ | `PERF_APP_DIR` |
| `sentry-load-race-test.js` | Sentry មកយឺត ➜ កំហុសមិនធ្លាក់ចោល · ព្យុះ event ដដែលត្រូវទប់ តែ event លើកញ្ចប់/path ផ្សេងគ្នាត្រូវទៅដល់ (ពិដាន) | `SENTRYRACE_APP_DIR` |

#### ការស្កេន · Export · ទម្លាប់គម្រោង

| File | ចាក់សោអ្វី | Override |
|---|---|---|
| `scan-engine-test.js` | ល្បឿន · ជួរអាន · ភាពត្រឹមត្រូវនៃ Barcode (ITF ត្រូវបដិសេធ) | `SCAN_APP_DIR` |
| `scan-remove-mode-test.js` | របៀបស្កេនដក៖ preview · transaction/trash/ledger · duplicate/no-op/XSS · responsive ៤ ទំហំ | `SCANREMOVE_APP_DIR` |
| `duplicate-scan-test.js` | ការទប់ស្កាត់ Barcode ស្ទួន ៥ ជាន់ | `DUP_APP_DIR` |
| `barcode-shape-test.js` | រូបរាង Barcode | `BARCODE_APP_DIR` |
| `camera-resume-test.js` | កាមេរ៉ាកកក្រោយប្រអប់ native · dependency អវត្តមាន | `CAMERA_APP_DIR` |
| `export-cells-test.js` | លេខទូរស័ព្ទ/Barcode ជា TEXT ក្នុង XML · CSV មិនក្លាយជារូបមន្ត | — |
| `monthly-report-test.js` | របាយការណ៍ខែ ៖ មូលដ្ឋានតែមួយ (ថ្ងៃ) · អានសុទ្ធសាធ · រូបរាងឆៅ · ថ្ងៃជា TEXT ក្នុង Excel ⛔ **បូក ៖ គ្រប់ជួរឈរនាំចេញត្រូវផ្ទុកវាលរបស់របាយការណ៍ដែលចំណងជើងសន្យា** (ដេរីវេពីចំណងជើង) | `MREPORT_APP_DIR` |
| `listener-pending-key-test.js` | កូនសោដែលសួរ ត្រូវជាកូនសោដែលដាក់ចូល ⛔ និង listener នីមួយៗត្រូវរាយការណ៍ **កូនសោរបស់ខ្លួន** (`noteDbListenerAlive` / `handleDbListenerError` ត្រូវផ្គូផ្គង `listenerRefs`) | `PENDINGKEY_APP_DIR` |
| `comments.js` · `strip-comments.js` · `ts-comments.js` | កូដ App ដែល ship ត្រូវគ្មាន comment — JS/CSS ដែល ship ដោយផ្ទាល់ · ប្រភព ZoeW React (`src/**` · Netlify Function · config ៖ `ts-comments.js` ប្រើ TypeScript AST ហើយផ្ទៀងផ្ទាត់ថា esbuild compile មុន/ក្រោយដូចគ្នា) · Gradle (lexer Groovy/properties · token ក្រៅ comment ដូចគ្នា · ឯកសារដែល Capacitor សាងឡើងវិញលើកលែង) · HTML ដែល ship | `COMMENTS_APP_DIR` · `STRIP_APP_DIR` |
| `trimws.js <files>` | លុប trailing whitespace | — |

### ៧. Allowlist — កុំបន្ថែមដោយគ្មានហេតុផល

`dom-hygiene.js` (`ACCEPTED`) · `state-hygiene.js` · `css-classes.js`
(`IGNORE`) · `shared-fns.js` (`EXPECTED_DIVERGENT`) · `code-duplication-test.js`
(`ACCEPTED`) មាន allowlist ដែល
**រាល់ធាតុមានហេតុផលសរសេរជាប់**។

⛔ **ធាតុគ្មានហេតុផលនឹងលាក់កំហុសបន្ទាប់។** បើបន្ថែម helper ចែករំលែកថ្មី
ដែលត្រូវតែដូចគ្នា **កុំដាក់វាចូល `EXPECTED_DIVERGENT`** — ចម្លងឲ្យដូចគ្នាវិញ។

### ៨. 🔑 លុបកូនសោ `zoew_barcode_registry` **កំព្រា** (ជំហានពេញលេញ)

> **រោគសញ្ញា** ៖ ស្កេន barcode មួយ ➜ «⚠️ ត្រូវបានបញ្ចូលរួចហើយ» ខណៈកញ្ចប់នោះ
> **គ្មានក្នុងប្រវត្តិ និងគ្មានក្នុងធុងសំរាមសោះ**។ កូនសោនោះជា **កូនសោកំព្រា**
> (គ្មានម្ចាស់) ➜ barcode ជាប់អន្ទាក់ជារៀងរហូត។

⛔ **គ្មានផ្លូវស្វ័យប្រវត្តិទេ ហើយនោះជាចេតនា** ៖ registry ជា **ជាន់ការពារខាង
server តែមួយគត់** ប្រឆាំង barcode ស្ទួន (ជាន់ ១–៣ អានសតិរបស់ទូរស័ព្ទនោះ)។
ការលុបខុសមួយ ➜ barcode នោះស្កេនចូលបានម្តងទៀត ➜ **លុយបូកស្ទួន** ហើយ
**គ្មានផ្លូវសាង registry ឡើងវិញក្នុងកូដទេ**។ ការសម្រេចចុងក្រោយត្រូវជារបស់
**មនុស្ស**។ ការជាប់អន្ទាក់ថ្លៃតិចជាងលុយស្ទួន។

**ជំហានទី ១ — យក dump**

Firebase Console ➜ Realtime Database ➜ ⋮ (ខាងស្តាំ) ➜ **Export JSON** ➜
រក្សាទុកជា `dump.json` (ឬ `.json.gz`)។ ⛔ dump ត្រូវជា **root ទាំងមូល**
មិនមែនត្រឹម node `zoew_barcode_registry` ទេ — ឧបករណ៍ត្រូវការ `zoew_scan_history_cod_dod`
និង `zoew_recently_deleted_cod_dod` ដើម្បីដឹងថា **អ្នកណាជាម្ចាស់**។

**ជំហានទី ២ — បញ្ចេញបញ្ជី**

```bash
node audit-tools/registry-orphan-list.js dump.json orphans.json
```

ឧបករណ៍ **មិនភ្ជាប់បណ្តាញ · មិនលុបអ្វី · មិនបោះពុម្ព barcode លើអេក្រង់**
(មានតែចំនួន)។ វាបញ្ចេញ `{"KEY": null, …}` ចូល `orphans.json`។
បើកំព្រាច្រើន វាបំបែកជា `orphans.1.json` · `orphans.2.json` … (៥,០០០/ឯកសារ)។

⛔ **ការបដិសេធជាលទ្ធផលត្រឹមត្រូវ មិនមែនកំហុសទេ** ៖

| សារបដិសេធ | មានន័យថា |
|---|---|
| គ្មាន node `zoew_barcode_registry` | dump ខុស ឬ registry ទទេពិត |
| ប្រវត្តិ **និង** ធុងសំរាមទទេទាំង ២ | dump មិនពេញ ➜ អ្វីៗនឹងមើលទៅដូចកំព្រា |
| កំព្រា **១០០%** | ស្ទើរតែជានិច្ចជា **ទម្រង់កូនសោមិនត្រូវគ្នា** មិនមែន barcode ជាប់អន្ទាក់ |
| dump ដែល `redact-dump.js` សម្អាតរួច | កូនសោពិតជាអក្សរធំជានិច្ច ➜ បច្ច័យ hash អក្សរតូច = ស្នាមច្បាស់ |

**ជំហានទី ៣ — មើលដោយភ្នែក (⛔ ជំហានដែលរំលងមិនបាន)**

បើក `orphans.json` រួចផ្ទៀងផ្ទាត់ថាកូនសោនីមួយៗពិតជាគ្មានម្ចាស់។ វិធីលឿន ៖
យកលេខ barcode ២–៣ ទៅស្វែងរកក្នុង App (តារាងប្រវត្តិ និងធុងសំរាម) —
បើរកឃើញសូម្បីតែមួយ ⛔ **ឈប់ភ្លាម** ៖ dump មិនពេញ។

**ជំហានទី ៤ — ផ្ញើដោយខ្លួនឯង**

```bash
curl -X PATCH \
  'https://<PROJECT>-default-rtdb.<REGION>.firebasedatabase.app/zoew_barcode_registry.json?auth=<SECRET>' \
  -H 'Content-Type: application/json' \
  --data-binary @orphans.json
```

⛔ **លើ Windows ត្រូវសរសេរជា ១ បន្ទាត់ ហើយប្រើសញ្ញាសម្រង់ *ទ្វេ*** — CMD
មិនស្គាល់ `\` (បន្តបន្ទាត់) និង `'...'` ទេ ហើយ `<` ជា **redirect** ➜
ការទុកសញ្ញា `<URL>` ក្នុងពាក្យបញ្ជាបង្កើតសារ «Bad hostname» ៖

```
curl -i -X PATCH "https://<PROJECT>-default-rtdb.<REGION>.firebasedatabase.app/zoew_barcode_registry.json?auth=<SECRET>" -H "Content-Type: application/json" --data-binary "@orphans.json"
```

ក្នុង **PowerShell** ត្រូវសរសេរ **`curl.exe`** (ពាក្យ `curl` ទទេជា alias របស់
`Invoke-WebRequest` ➜ ទទួល argument ខុសគ្នា)។ ⛔ សញ្ញា `@` នៅមុខឈ្មោះឯកសារ
ជាផ្នែកនៃវាក្យសម្ព័ន្ធ `curl` («អាន body ចេញពី**ឯកសារ**នេះ») — គ្មានវា
`curl` ផ្ញើ **អក្សរ** `orphans.json` ជា body។

⛔ **`PATCH` ជា merge** ៖ កូនសោដែលមិនរៀបរាប់ក្នុងឯកសារ **នៅដដែល**។
⛔ **កុំប្រើ «Import JSON» ក្នុង Firebase Console ដាច់ខាត** — នោះជា
**REPLACE** ➜ វា **លុប registry ទាំងមូល** ➜ រាល់ barcode ក្នុងប្រព័ន្ធ
អាចស្កេនចូលស្ទួនបាន។ បើមានឯកសារច្រើន ផ្ញើ **មួយៗតាមលំដាប់**។

**ជំហានទី ៥ — ផ្ទៀងផ្ទាត់**

ស្កេន barcode ដែលធ្លាប់ជាប់ ➜ ត្រូវចូលបានធម្មតា។ បើនៅជាប់ដដែល ➜ កូនសោនោះ
មិនមែនកំព្រាទេ (កញ្ចប់នៅរស់នៅកន្លែងណាមួយ) ➜ ⛔ **កុំលុបបន្ថែម**។

### ៩. អន្ទាក់ក្នុង harness (បើសាង harness ថ្មី)

1. **`snapshot.val()` ត្រូវត្រឡប់ច្បាប់ចម្លងជ្រៅ** — បើត្រឡប់ reference
   ទៅ store នោះទិន្នន័យក្នុងសតិក្លាយជា alias ➜ ការកែត្រូវរាប់ពីរដង។
2. **អថេរ `let` កម្រិត module មិនស្ថិតលើ `window`** — មានតែ `function`
   declaration ទេ។ អានវាដោយឈ្មោះទទេ (`typeof x !== 'undefined' ? x : {}`)។
3. **seed ត្រូវប្រាកដនិយម** — ចំណូលថ្ងៃ **≥** ផលបូក item បើមិនដូច្នេះ
   clamp-to-0 បាញ់ ហើយការ revert មើលទៅដូចមិនស៊ីមេទ្រី ខណៈវាត្រឹមត្រូវ។
4. **Fake SDK ត្រូវគាំទ្រ `increment()`** — បើគ្មាន វា throw ហើយ invariant បែក។
5. **ការធ្វើតេស្តការប្រណាំង** ត្រូវដាក់ការសរសេររបស់ឧបករណ៍ផ្សេង **ក្នុងចន្លោះ**
   នៃការអាន និងការសរសេរ មិនមែនក្រោយវាទេ។

---

## ប្រព័ន្ធសុវត្ថិភាព

### ច្បាប់សម្រាប់ checker ខ្លួនឯង

| ច្បាប់ | មូលហេតុ |
|---|---|
| **`listen(0, '127.0.0.1')` ជានិច្ច** | port ថេរ ➜ ការរត់ ២ ស្របគ្នាធ្លាក់ដោយ `EADDRINUSE` (សញ្ញាក្លែងក្លាយ); `listen(port)` ទទេ bind `0.0.0.0` ➜ បើកថត App ចំហលើគ្រប់ interface |
| **ការពុលត្រូវធ្វើលើឯកសារស្រមោល** | `exit-code-integrity.js` ពុលច្បាប់ចម្លង `.tmp-poison-*` ➜ SIGKILL មិនអាចធ្វើឲ្យ repo ខូច |
| **ការអះអាង *អវត្តមាន* ត្រូវមានជាន់អប្បបរមា** | «គ្មានលំនាំអាក្រក់ទេ» ពិតដោយស្វ័យប្រវត្តិលើ input ទទេ |
| **កុំបញ្ឈប់ checker ពេលរកឈ្មោះមិនឃើញ** | `process.exit(1)` បិទបាំងការអះអាងខាងក្រោម ➜ រាយវាជាការធ្លាក់ **ដែលមានឈ្មោះ** រួច stub ជំនួស |
| **SKIP តែសម្រាប់ dependency របស់បរិស្ថាន** | SKIP លើឯកសាររបស់ repo ខ្លួនឯង ជាបៃតងក្លែងក្លាយ |
| **គ្មាន secret ក្នុងតេស្ត** | តម្លៃសាកល្បងត្រូវជាតម្លៃក្លែង; response body ដែលអាចមាន secret ត្រូវបោះចោល |

### សំណួរ ១៣ មុនជឿថា checker ថ្មីមួយដំណើរការ

⛔ **បញ្ជីនោះរស់នៅ [`../CLAUDE.md`](../CLAUDE.md) ផ្នែក «វិន័យរបស់ឧបករណ៍»
តែមួយកន្លែង — សូមអានវានៅទីនោះ។** ឯកសារនេះជា **កាតាឡុក** នៃ checker
(«ឧបករណ៍ណាវាស់អ្វី») មិនមែនឯកសារច្បាប់ទេ។

🔴 ហេតុអ្វីវាមិនស្ថិតនៅទីនេះទៀត ៖ វាធ្លាប់ត្រូវចម្លងមកទាំង ២ កន្លែង ហើយ
ច្បាប់ចម្លងនោះ **ឃ្លាតរួចទៅហើយ** — ធាតុទី ៩ ក្នុងឯកសារនេះរាយត្រឹម
«ធ្លាក់ ≠ ព្យួរ» ខណៈ `CLAUDE.md` រាយ **របៀបបរាជ័យទាំង ៤** (បដិសេធ ·
អវត្តមាន · ព្យួរ · **យឺតតែជោគជ័យ**) ➜ session ណាដែលអានតែឯកសារនេះ ទទួល
បញ្ជីខ្សោយជាង ហើយ **ជឿថាវាពេញលេញ**។ ធាតុ ៧ · ១០ · ១២ ក៏បាត់លម្អិត
ដដែល។ នេះជាអ្វីដែល **ច្បាប់ ១២** ព្យាករណ៍ជាក់ស្តែង។

⛔ **Mutation testing ៖ សួរថា *អ្នកណាចាប់* មិនមែន *តើចាប់បានទេ*។** ពេល
mutation មួយត្រូវចាប់បាន ត្រូវសួរបន្តថា «តើ checker ណាទៀត *គួរ* ចាប់វា
តែមិនចាប់?» — ចម្លើយបង្ហាញព្រំដែនពិតនៃការគ្របដណ្តប់។

---

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 **ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)**។

ផ្នែកមួយនៃ Zoe-System។ ឧបករណ៍ទាំងនេះមិន deploy និងមិនត្រូវការ Activation Key
ទេ។

⛔ **អត្ថបទអាជ្ញាប័ណ្ណពេញលេញជាឯកសារគ្រប់គ្រង** — សេចក្តីសង្ខេបខាងលើមិន
ជំនួសវាទេ ៖

| ឯកសារ | ខ្លឹមសារ |
|---|---|
| **[`LICENSE`](../LICENSE)** | កម្មសិទ្ធិលើ source code · ការហាមឃាត់ · ការចូលរួមរបស់អ្នកអភិវឌ្ឍ · ច្បាប់គ្រប់គ្រង |
| **[`NOTICE`](../NOTICE)** | attribution របស់កូដភាគីទីបីដែល ship (Apache-2.0 · MIT) |
