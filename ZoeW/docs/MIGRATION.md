# ការផ្លាស់ប្តូរពី ZoeW ទៅ ZoeW React

> ⛔ ZoeW ដើមកំពុងដំណើរការជាមួយ **អតិថិជនពិត និងលុយពិត**។ ឯកសារនេះ
> សរសេរឲ្យការផ្លាស់ប្តូរអាច **ថយក្រោយវិញបាន គ្រប់ពេល** ។

---

## ១. អ្វីដែល **មិន** ត្រូវប្តូរសោះ

| អ្វី | ហេតុអ្វី |
|---|---|
| Firebase Project និង rules | App ថ្មីអានសរសេរ path ដដែលបេះបិទ |
| Activation Key របស់អតិថិជន | `LICENSE_APP_CODE` នៅជា `'ZOE'` ដដែល |
| Netlify Function `zto-order-detail` | ចម្លងមកដោយមិនកែ |
| env របស់ ZTO (`ZTO_*`) | មិនប្រែ |
| Apps Script (Lookup និងនាំចូល) | មិនប្រែ |
| កូនសោ `localStorage` ទាំង ៤៦ | ដូចគ្នាបេះបិទ ➜ ឧបករណ៍ដែលប្រើរួច មិនបាត់ការកំណត់ |

⛔ **កូនសោ storage ដូចគ្នា** មានន័យថាអ្នកប្រើដែលបើក App ថ្មីលើឧបករណ៍ដដែល
រក្សា ៖ PIN · ការចងចាំជីវមាត្រ · Config · ការកំណត់ Locker · កុងតាក់ ZTO ·
សាលក្រម ZTO ក្នុង cache។ **គ្មានការតំឡើងឡើងវិញទេ។**

---

## ២. ជំហានដាក់ឲ្យប្រើ (សុវត្ថិភាព)

App នេះ **ជំនួសថត `ZoeW/` ដោយផ្ទាល់** ➜ Netlify site `zoew` ដដែល (base directory
**`ZoeW`** — ⛔ ប្រកាន់អក្សរតូចធំ) តែឥឡូវ build តាម `ZoeW/netlify.toml` ៖
`npm run build` ➜ publish `dist` · Functions `netlify/functions` · Node 22។
env ទាំងអស់ (`ZTO_*` · `ZTO_PROXY_KEY` …) នៅដដែល — គ្មានការចម្លង។

### ដំណាក់ ១ — Deploy preview របស់ branch (មុន merge)

១. បើក PR ពី branch ➜ Netlify សាង **deploy preview** (URL ដាច់ពីផលិតកម្ម)
២. ពិនិត្យ deploy log ៖ ត្រូវឃើញ `npm run build` និង `vite build` (មិនមែនការ
   publish ថត `.` ដូចមុន)
៣. ⛔ **សាកលើ iPhone ពិត (PWA ដំឡើងលើអេក្រង់ដើម) និង Android ពិត** — ច្បាប់ ១១
   របស់ `CLAUDE.md` ៖ PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ ត្រូវសាកលើឧបករណ៍ពិត
   **ទាំង ២ ប្រព័ន្ធ** មុន merge។ checker តំបន់ហាមចូលទាំង ៣ របស់ `audit-tools/`
   (`gesture` · `panel-motion` · `ios-panel-glide`) បៃតងលើ App នេះក្នុង Chromium
   តែ Chromium **ធ្វើត្រាប់តាម** iOS មិនមែន WebKit ពិត
៤. ⚠️ Deploy preview មាន **origin ផ្សេង** ➜ storage ទទេ ៖ ត្រូវបញ្ចូល Config និង
   **Activate** ម្តងទៀត។ ⛔ ការ Activate នោះ **ស៊ីកៅអីឧបករណ៍** (`maxDevices`) ដូច
   ឧបករណ៍ថ្មីមួយ ➜ ប្រើ Key សាកល្បង ឬសុំ admin ដោះកៅអីក្រោយសាករួច

⛔ **ការប្រើស្របគ្នាមានសុវត្ថិភាព** ៖ App ទាំង ២ សរសេរតាមច្បាប់ដដែល
(transaction · registry · ledger) ➜ ពួកវាមើលឃើញគ្នាទៅវិញទៅមកដូចឧបករណ៍ ២។

### ដំណាក់ ២ — merge ចូល `main`

⛔ **លក្ខខណ្ឌ ២ មុន merge** ៖

១. ឧបករណ៍ពិតទាំង ២ ប្រព័ន្ធឆ្លងកាត់ (ដំណាក់ ១)។
២. **សំណុំ `audit-tools/run-all.sh` ត្រូវវាស់ App នេះបានពិត** — ឥឡូវ checker
   ភាគច្រើនធ្លាក់ដោយ **រចនាសម្ព័ន្ធ** (ស្រង់អត្ថបទពី `app.js` · អាន markup ថេរក្នុង
   `index.html` · ជំនួស `window.<fn>`) ➜ ពួកវា **មិនបានវាស់** App នេះ (មើល
   [`PARITY.md`](PARITY.md) ផ្នែក ៥)។ តារាង «ច្បាប់ ➜ ឧបករណ៍» នៃ `CLAUDE.md` ជា
   **ការចងចាំ** របស់គម្រោង ➜ merge ខណៈអ្នកយាមមិនរត់ = បិទការការពារលុយ
   ដែលសាងអស់ ២០០ ជុំ។ ការងារ ៖ ផ្ទេរ checker ទៅស្រង់ពី `src/**` (ឈ្មោះ function
   ដដែល) ឬហៅតាម module ជំនួស `window` · ចាត់ឯកសារថ្មីក្នុង
   `audit-tools/repository-file-coverage.json` · ⛔ ផ្ទេរ `money-reality-check.js`
   (ឧបករណ៍ `check-money.cmd` ដែលអ្នកប្រើរត់លើ dump ផលិតកម្ម) ព្រោះវាស្រង់
   **កូដលុយពិត** ពី `ZoeW/app.js` ➜ ឥឡូវវា **លែងដើរ**។

បន្ទាប់ពីលក្ខខណ្ឌទាំង ២ ឆ្លងកាត់តែប៉ុណ្ណោះ។ ផលិតកម្មប្រើ **origin ដដែល**
➜ Config · PIN · License · ការកំណត់ Locker · កុងតាក់ ZTO **នៅដដែល** ៖ អ្នកប្រើមិនបាច់
តំឡើងឡើងវិញទេ។

### ដំណាក់ ៣ — ការថយក្រោយ

`git revert` commit merge ➜ Netlify build `ZoeW/` ចាស់ (static) ឡើងវិញ។ Service
Worker ចាស់ជំនួស SW ថ្មីនៅការបើកលើកក្រោយ ដូចការ deploy ធម្មតា។

---

## ៣. Service Worker និងសំបកចាស់

កំណែ cache ថ្មីជា `zoew-v223` ដែលបន្តលំដាប់ `zoew-v222` របស់ ZoeW ដើម។ SW លុប
cache ដែលចាប់ផ្តើមដោយ `zoew-` ទាំងអស់ដែលមិនមែនជាកំណែបច្ចុប្បន្ន ➜ សំបកចាស់
ត្រូវបោះចោលដោយស្វ័យប្រវត្តិ។

⛔ បើអ្នកប្រើនៅតែឃើញ App ចាស់ ៖ វាជា Service Worker ចាស់ដែលនៅ control ។ វាត្រូវ
ជំនួសខ្លួនក្នុងការបើកលើកក្រោយ (`skipWaiting` + `clients.claim`)។ បើចាំបាច់ ៖
បិទបើក App ២ ដង។

---

## ៤. ការកែកូដក្រោយការជំនួស

⛔ **`src/` ជាប្រភពការពិត** ៖ `app.js` ដើមលែងមានក្នុង `ZoeW/` ទៀតហើយ (វានៅក្នុង
ប្រវត្តិ git ➜ `npm run original:fetch`)។ ការកែថ្មីធ្វើក្នុង `src/` ផ្ទាល់ ហើយត្រូវ ៖

- `npm run verify` បៃតង
- `npm run parity:deep` · `npm run logic:check` ៖ បើការកែប្រែឥរិយាបថ **ដោយចេតនា**
  ភាពខុសគ្នាធៀបនឹងដើមនឹងលេច — នោះជាការរំពឹងទុក ➜ ពន្យល់វាក្នុង `docs/HISTORY.md`
- ⛔ `npm run generate` **ចាក់សោ** (វាសរសេរជាន់ `src/` ទាំងមូល) — ប្រើតែពេលចង់
  ផលិតឡើងវិញពីដើមដោយដឹងច្បាស់ (`ALLOW_REGENERATE=1`)

---

## ៥. សកម្មភាពដែលត្រូវធ្វើដោយដៃ

| # | អ្វី | កន្លែង |
|---|---|---|
| ១ | សាកលើ **iPhone ពិត (PWA)** និង **Android ពិត** នៅលើ deploy preview ៖ PTR · អូសផ្ទាំងប្រវត្តិ · រមូរ · ស្កេន | ឧបករណ៍ពិត |
| ២ | ពិនិត្យ deploy log ថា Netlify រត់ `npm run build` (base directory នៅ **`ZoeW`**) | Netlify UI |
| ៣ | ⛔ **កុំដាក់ `netlify.toml` នៅ root របស់ repo** | repo |
| ៤ | Activate លើ deploy preview ស៊ីកៅអីឧបករណ៍ ➜ ដោះកៅអីក្នុង ZoeKeyGen ក្រោយសាក | ZoeKeyGen |

⛔ **គ្មានការកែ Firebase rules ទេ** — App ថ្មីមិនបន្ថែម path ណាមួយឡើយ។
