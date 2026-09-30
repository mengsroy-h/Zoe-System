# 🏗️ បង្កើតអតិថិជនថ្មីលើ Firebase ដោយពាក្យបញ្ជាតែមួយ (Windows)

ឧបករណ៍នេះធ្វើជំនួសអ្នកនូវការងារដែលធ្លាប់ចុចដោយដៃក្នុង Firebase Console រាល់ពេលមាន
អតិថិជនថ្មី ៖ **បង្កើត Project · Realtime Database · ដំឡើង Security Rules · បិទការចុះឈ្មោះ
សាធារណៈ · បង្កើតគណនី Login របស់បុគ្គលិក** ហើយបញ្ចប់ដោយ **វាស់សុវត្ថិភាពពិត** និងបញ្ចេញ
Firebase config (បូក Setup Link បើអ្នកចង់)។

✅ **ឥតគិតថ្លៃ** ៖ អតិថិជននីមួយៗនៅតែមាន Firebase Project **ផ្ទាល់ខ្លួន** លើគម្រោង **Spark**
(គ្មានការភ្ជាប់ Billing) ➜ កូតាឥតគិតថ្លៃរៀងៗខ្លួន ដូចការបង្កើតដោយដៃបេះបិទ។ App ZoeW
**មិនប្រែអ្វីទាំងអស់**។

---

## កំណែ

ឧបករណ៍មូលដ្ឋាន — **មិន deploy ទេ** ហើយវា **មិនប៉ះ `APP_VERSION` ឬ `CACHE_VERSION` របស់ PWA
ណាមួយឡើយ**។ វាពឹងលើ **`firebase-tools`** (Firebase CLI ផ្លូវការរបស់ Google) ដែលចាក់សោកំណែ
**ពិតប្រាកដ** ក្នុង [`package.json`](package.json) និង [`package-lock.json`](package-lock.json)
របស់ថតនេះ។ ⛔ ការឡើងកំណែ `firebase-tools` ត្រូវរត់ checker `firebase-provision-test`
ជាមុន ៖ ឧបករណ៍ប្រើ function ខាងក្នុងរបស់វា ហើយ checker វាស់ថា function ទាំងនោះនៅមាន។

## មុខងារ

| ពាក្យបញ្ជា | ធ្វើអ្វី |
|---|---|
| `setup.cmd` | ដំឡើង `firebase-tools` ក្នុងថតនេះ រួចបើក browser ឲ្យ Login គណនី Google (ម្តងគត់) |
| `new-customer.cmd` | អតិថិជនថ្មី ៖ បង្កើតគ្រប់យ៉ាង ➜ វាស់សុវត្ថិភាព ➜ បង្ហាញ config · ពាក្យសម្ងាត់ |
| `deploy-rules.cmd` | ដំឡើង `firebase-database.rules.json` របស់ repo ទៅ **អតិថិជនទាំងអស់** ក្នុងពេលតែមួយ រួចវាស់ឡើងវិញ |
| `node provision.js user …` | បន្ថែមបុគ្គលិក ឬកំណត់ពាក្យសម្ងាត់ថ្មី (`--reset`) |
| `node provision.js verify …` | វាស់សុវត្ថិភាព Project មួយ ឬទាំងអស់ (មិនកែអ្វី) |
| `node provision.js show …` | បង្ហាញ config និង Setup Link ម្តងទៀត |
| `node provision.js doctor` | ពិនិត្យឧបករណ៍ ៖ Node · `firebase-tools` · ការ Login |

**`new` ធ្វើជំហានទាំងនេះតាមលំដាប់** (ជំហាននីមួយៗកត់ទុក ➜ បើធ្លាក់កណ្តាលទី រត់ពាក្យបញ្ជា
ដដែលម្តងទៀត វាបន្តពីកន្លែងធ្លាក់ ដោយមិនបង្កើតស្ទួន) ៖

1. **Project** ៖ `zoew-<លេខសាខា>` (បើឈ្មោះនោះមានគេយករួច ➜ បន្ថែមបច្ច័យ ៤ តួដោយស្វ័យប្រវត្តិ)
2. **Firebase** បើកលើ Project នោះ
3. បើក API ដែលត្រូវការ (Realtime Database · Authentication)
4. **Web App** ឈ្មោះ `ZoeW`
5. **Realtime Database** លំនាំដើម (តំបន់ `asia-southeast1` = សិង្ហបុរី)
6. **Security Rules** ពី `firebase-database.rules.json` របស់ repo ➜ អានត្រឡប់មកវិញ ហើយប្រៀបធៀប
7. **Authentication** ៖ បើក Email/Password · **បិទ «Enable create (sign-up)»** · **បិទ «Enable delete»** ·
   បើក Email enumeration protection
8. **គណនីបុគ្គលិក** `<ឈ្មោះ>@zoew<លេខសាខា>.com` ជាមួយពាក្យសម្ងាត់ចៃដន្យ ១៤ តួ

បន្ទាប់មកវា **វាស់សុវត្ថិភាពដោយផ្ទាល់** ដូចអ្នកវាយប្រហារនឹងធ្វើ ៖

| ការវាស់ | ត្រូវបាន |
|---|---|
| ការកំណត់ Authentication | sign-up និង delete បិទ · Email/Password បើក |
| **ចុះឈ្មោះដោយ apiKey សាធារណៈ** | ត្រូវបដិសេធ (`ADMIN_ONLY_OPERATION`) — បើចុះឈ្មោះបាន វាលុបគណនីសាកល្បងនោះ ហើយរាយ **FAIL** |
| Security Rules លើ Database | ដូច `firebase-database.rules.json` បេះបិទ |
| អានទិន្នន័យដោយគ្មាន Login | ត្រូវបដិសេធ |
| Login របស់បុគ្គលិកដែលទើបបង្កើត | ចូលបាន |
| អានទិន្នន័យក្រោយ Login | អានបាន (App ដើរ) |

## របៀបប្រើប្រាស់

### ជំហានទី ១ — ដំឡើង (ម្តងគត់)

1. ដំឡើង **Node.js 20 ឬថ្មីជាង** ពី <https://nodejs.org/>។
2. បើក <https://console.firebase.google.com/> ដោយគណនី Google ដែលអ្នកប្រើបង្កើតអតិថិជន ហើយយល់ព្រម
   **Terms of Service** របស់ Firebase ម្តង (បើមិនទាន់)។
3. ចុចពីរដងលើ **`setup.cmd`** ➜ browser បើក ➜ Login គណនី Google ដដែល ➜ ត្រឡប់មកវិញ ➜
   `doctor` ត្រូវរាយ `logged in : <អ៊ីមែលរបស់អ្នក>`។

### ជំហានទី ២ — អតិថិជនថ្មី

បើក Command Prompt ក្នុងថតនេះ រួចវាយ ៖

```bat
new-customer.cmd --branch 881859 --user sok,chan --app-url https://<ZoeW-site-របស់អ្នក>.netlify.app
```

- `--branch` ៖ លេខសាខា ZTO (ខ្ទង់ប៉ុន្មានក៏បាន) ➜ អ៊ីមែល `sok@zoew881859.com` · `chan@zoew881859.com`
- `--user` ៖ ឈ្មោះបុគ្គលិក (បំបែកដោយ comma) ឬអ៊ីមែលពេញ
- `--app-url` ៖ ដាក់ **ម្តងគត់** ➜ ឧបករណ៍ចងចាំ ហើយបង្ហាញ **Setup Link** រាល់អតិថិជន
- `--sentry-dsn` ៖ ស្រេចចិត្ត (ដាក់ម្តងគត់ដូចគ្នា) ➜ Setup Link ផ្ទុក DSN ដូច ZoeKeyGen
- ចុចពីរដងលើ `new-customer.cmd` ដោយគ្មានអ្វីក៏បាន ➜ វាសួរលេខសាខា និងឈ្មោះបុគ្គលិក

នៅចុងបញ្ចប់ វាបង្ហាញ ៖ Firebase config · Setup Link · **អ៊ីមែល និងពាក្យសម្ងាត់** ។
⛔ **ពាក្យសម្ងាត់បង្ហាញតែម្តងគត់ ហើយមិនរក្សាទុកក្នុងឯកសារណាទេ** ➜ ចម្លងវាមុនបិទបង្អួច។
បើភ្លេចចម្លង ➜ `node provision.js user --project zoew-881859 --user sok --reset`។

លទ្ធផល (exit code) ៖ `0` រួចរាល់ និងវាស់ឆ្លងទាំងអស់ · `1` មានអ្វីធ្លាក់ (អានសារ ហើយរត់ម្តងទៀត) ·
`2` ពាក្យបញ្ជាខុស ឬបោះបង់ · `3` បង្កើតរួច តែការវាស់ខ្លះវាស់មិនបាន (បណ្តាញ) ➜ រត់ `verify` ពេលក្រោយ។

### ជំហានទី ៣ — អ្វីដែលនៅតែធ្វើដោយដៃ

1. **ZoeKeyGen** ៖ បង្កើត Activation Key សម្រាប់អតិថិជននេះ។
2. ផ្ញើ **Setup Link** (ឬ QR ពី ZoeKeyGen ដោយបិទភ្ជាប់ Firebase config ដែលបង្ហាញ) ទៅអតិថិជន។
3. **តែពេលអតិថិជនប្រើ «📥 ទាញបញ្ជីកញ្ចប់ពី ZTO»** ៖ បន្ថែម Project ID ចូល Netlify env
   `FIREBASE_PROJECT_IDS` (site `zoew`) រួច **Trigger deploy** (មើល [`ZoeW/ZTO-SETUP-KH.md`](../../ZoeW/ZTO-SETUP-KH.md))។
   ⛔ Function អានបានច្រើនបំផុត **១៦** Project ID — លើសនោះ មុខងារបញ្ជីបិទសម្រាប់ទាំងអស់គ្នា។

### ដំឡើង Rules ថ្មីទៅអតិថិជនទាំងអស់

ពេល `firebase-database.rules.json` ប្រែ (CLAUDE.md ច្បាប់ ១០) ជំនួសការ paste ក្នុង Console ម្តងមួយៗ ៖

```bat
deploy-rules.cmd
```

វារាយ Project ទាំងអស់ដែលឧបករណ៍នេះស្គាល់ ➜ សួរ **YES** ➜ ដំឡើង ➜ អានត្រឡប់មកវិញ ➜ រត់ `verify`
លើទាំងអស់។ សាកមុន ដោយមិនកែអ្វី ៖ `node provision.js rules --all --dry-run`។ Project មួយជាក់លាក់ ៖
`node provision.js rules --project zoew-881859`។

### អតិថិជនចាស់ (Project ដែលបង្កើតដោយដៃ)

ដើម្បីឲ្យ `deploy-rules.cmd` ស្គាល់វា និងចាក់សោ sign-up លើវាដែរ ៖

```bat
node provision.js new --project-id <project-id-ចាស់> --branch 881859 --adopt
```

⛔ `--adopt` ត្រូវការ ព្រោះ Project នោះមានរួច ៖ ឧបករណ៍មិនយក Project ដែលមានស្រាប់ដោយស្ងាត់ទេ។
វាមិនបង្កើត Database ថ្មី (ប្រើមួយដែលមានរួច) ហើយមិនប៉ះគណនីដែលមានរួច។

### ពេលមានបញ្ហា

| សារ | ធ្វើអ្វី |
|---|---|
| `Not logged in to Firebase` | រត់ `setup.cmd` ម្តងទៀត |
| `... Terms of Service ...` | បើក Firebase Console ដោយគណនីដដែល ➜ យល់ព្រម ➜ រត់ម្តងទៀត |
| project quota / `exceeded` | Google កំណត់ចំនួន Project ក្នុងមួយគណនី ➜ លុប Project ដែលលែងប្រើ ឬស្នើបន្ថែមកូតាពី Google |
| `timed out` | ការងារអាចនៅតែចប់ខាង Google ➜ រត់ពាក្យបញ្ជាដដែលម្តងទៀត |
| `[FAIL] public sign-up blocked` | sign-up នៅបើក ➜ Console ➜ Authentication ➜ Settings ➜ User actions ➜ ដកធីក **Enable create (sign-up)** ➜ `verify` ម្តងទៀត |
| `[FAIL] database rules` | `node provision.js rules --project <id>` |

ឯកសារ `state/` ក្នុងថតនេះកត់ Project ដែលឧបករណ៍ស្គាល់ (ដើម្បីបន្តការងារ និង `--all`) ⛔ កុំលុបវា។

## ប្រព័ន្ធសុវត្ថិភាព

- **Login ជាការ Login ផ្លូវការរបស់ Firebase CLI** ៖ token រស់ក្នុង configstore របស់ `firebase-tools`
  លើកុំព្យូទ័ររបស់អ្នក (មិនចូល repo · មិនចូល `state/`)។ ចាកចេញ ៖
  `node node_modules/firebase-tools/lib/bin/firebase.js logout`។
- **ពាក្យសម្ងាត់** បង្កើតដោយ `crypto` (១៤ តួ · គ្មានតួអក្សរងាយច្រឡំ) បង្ហាញលើអេក្រង់ **តែម្តង**
  ហើយ **មិនដែលសរសេរចូលឯកសារ**។ `state/` ផ្ទុកតែ Project ID · លេខសាខា · អ៊ីមែល (mode 600)។
- **sign-up ត្រូវបានវាស់ មិនមែនជឿ** ៖ ឧបករណ៍សាកចុះឈ្មោះគណនីថ្មីដោយ apiKey សាធារណៈ (ដូចអ្នកណាម្នាក់ដែលមាន
  Setup Link) ➜ ត្រូវបដិសេធ។ បើចុះឈ្មោះបាន វាលុបគណនីនោះភ្លាម ហើយរាយ **FAIL**។
  ⛔ Security Rules អនុញ្ញាតគ្រប់គណនីដែល Login ➜ sign-up ដែលបើក = អ្នកណាក៏អាន/សរសេរទិន្នន័យអតិថិជនបាន។
- **Rules មានប្រភពតែមួយ** គឺ `firebase-database.rules.json` របស់ repo ➜ ក្រោយដំឡើង វាអានត្រឡប់មកវិញ ហើយ
  ប្រៀបធៀប ➜ ការឃ្លាតលេចជា **FAIL**។
- **ឧបករណ៍មិនយក Project ដែលមានស្រាប់ដោយស្ងាត់** (ត្រូវ `--adopt`) · **មិនប្តូរពាក្យសម្ងាត់គណនីដែលមានស្រាប់**
  (ត្រូវ `user --reset`) · `rules` សួរ **YES** មុនដំឡើង។
- សារលើអេក្រង់ជា **ASCII អង់គ្លេស** ព្រោះ `cmd.exe` បំបែកអក្សរខ្មែរ។

## អាជ្ញាប័ណ្ណ

**កម្មសិទ្ធិឯកជន** — រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 **ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)**។

ផ្នែកមួយនៃ Zoe-System សម្រាប់ប្រើក្នុងអាជីវកម្មរបស់ម្ចាស់ប៉ុណ្ណោះ។ ឧបករណ៍នេះមិនត្រូវការ Activation Key ទេ
ព្រោះវាមិនមែនជា App របស់អតិថិជន — វាជាឧបករណ៍ថែទាំដែលរត់លើកុំព្យូទ័ររបស់ម្ចាស់។ `firebase-tools`
(អាជ្ញាប័ណ្ណ MIT របស់ Google) ត្រូវបានដំឡើងដោយ npm លើកុំព្យូទ័ររបស់អ្នក ហើយ **មិនចូល repo** ទេ។

⛔ **អត្ថបទអាជ្ញាប័ណ្ណពេញលេញជាឯកសារគ្រប់គ្រង** — សេចក្តីសង្ខេបខាងលើមិនជំនួសវាទេ ៖

| ឯកសារ | ខ្លឹមសារ |
|---|---|
| **[`LICENSE`](../../LICENSE)** | កម្មសិទ្ធិលើ source code · ការហាមឃាត់ · ការចូលរួមរបស់អ្នកអភិវឌ្ឍ · ច្បាប់គ្រប់គ្រង |
| **[`NOTICE`](../../NOTICE)** | attribution របស់កូដភាគីទីបីដែល ship (Apache-2.0 · MIT) |
