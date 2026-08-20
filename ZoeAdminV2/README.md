# ZoeAdmin V2 — ប្រព័ន្ធគ្រប់គ្រងអីវ៉ាន់ (Admin, ជំនាន់ទី ២)

**ZoeAdmin V2** គឺជាការរចនាឡើងវិញទាំងស្រុងនៃ **ZoeAdmin** — មុខងារអាជីវកម្មដូចគ្នាបេះបិទ
(ស្កេន, COD/DOD, ស្ថិតិ, Export, ធុងសំរាម, Setup Link) តែ **រូបរាង, ការរៀបចំអេក្រង់ និងលំហូរ
ការងារ ថ្មីទាំងស្រុង** ព្រមទាំងមុខងារបន្ថែមមួយចំនួនដែល ZoeAdmin ដើមគ្មាន។

វាជា **Netlify site ដាច់ដោយឡែក** (origin ផ្សេង) ដូច្នេះវាមិនប៉ះពាល់ ZoeAdmin ដើមទេ —
អ្នកអាចដំណើរការទាំងពីរស្របគ្នា លើ Firebase project ដដែល ជាមួយទិន្នន័យដដែល។

> **Activation Key**៖ ប្រើ App code **`ADM`** ដូច ZoeAdmin ដើម — Key ដែលមានស្រាប់ដំណើរការភ្លាម
> ដោយមិនចាំបាច់បង្កើតថ្មី និងមិនចាំបាច់កែ ZoeKeyGen ទេ។

---

## អ្វីដែលថ្មីក្នុង V2

| # | មុខងារ | ហេតុអ្វី |
|---|---|---|
| ១ | **ផ្ទាំងងងឹត / ភ្លឺ / ស្វ័យប្រវត្តិ** | ZoeAdmin ដើមគ្មានសោះ។ ការងារពេលយប់ក្នុងហាង និងអេក្រង់ OLED សន្សំថ្ម។ រក្សាទុកក្នុង `localStorage`, តាមប្រព័ន្ធនៅពេលជ្រើស "ស្វ័យប្រវត្តិ" |
| ២ | **Tab ខាងក្រោម ៤ (ស្កេន · ប្រវត្តិ · ចំណូល · ផ្សេងៗ)** | ជំនួស sidebar ដែលត្រូវ "អូសឡើង/អូសចុះ" — យន្តការនោះជាប្រភពនៃកំហុសជាច្រើន (ជុំ ១១ និង PR #38) |
| ៣ | **បញ្ជីជា កាត ជំនួសតារាង ៤ ជួរឈរ** | លើទូរស័ព្ទ 360px តារាង `6% / 26% / 30% / 38%` ចង្អៀតពេក។ កាតបង្ហាញលេខទូរស័ព្ទធំ អានបានពីចម្ងាយ |
| ៤ | **តម្រងស្ថានភាព** — ទាំងអស់ / នៅសល់ / យកហើយ / មិនទាន់ខល / ត្រូវខលឡើងវិញ | ពីមុនត្រងបានតែតាម **ថ្ងៃ** ប៉ុណ្ណោះ |
| ៥ | **តម្រៀប** — ថ្មីបំផុត / ចាស់បំផុត / កញ្ចប់ច្រើន / ទឹកប្រាក់ច្រើន | រកកញ្ចប់ដែលមានតម្លៃខ្ពស់ ឬច្រើនកញ្ចប់បានលឿន |
| ៦ | **ផ្លាកលេខនៅលើ Tab ប្រវត្តិ** | ចំនួនកញ្ចប់ **នៅសល់** ក្នុងតម្រងថ្ងៃបច្ចុប្បន្ន — ឃើញភ្លាមដោយមិនចាំបាច់ចូលមើល |
| ៧ | **ប៊ូតុងចម្លងលេខទូរស័ព្ទ** | ចម្លងទៅ Telegram/កម្មវិធីផ្សេងបានតែមួយចុច |
| ៨ | **Logo និងអត្តសញ្ញាណថ្មី** | ស្លាកសញ្ញា "Z" ជាមួយធ្នឹមស្កេន លើ gradient indigo → violet → cyan |
| ៩ | **គ្រាប់ចុចផ្លូវកាត់ `/`** | លោតទៅប្រអប់ស្វែងរកភ្លាម (លើកុំព្យូទ័រ) |
| ១០ | **ស្ថានភាពទទេមានអត្ថន័យ** | ជំនួស "គ្មានទិន្នន័យ" ទទេ ដោយប្រាប់ថាគួរធ្វើអ្វីបន្ត |
| ១១ | **អក្សរធំជាងមុន** (14px មូលដ្ឋាន ជំនួស 13px) | អានបានក្នុងហាងដែលមានពន្លឺច្រើន |

**មុខងារអាជីវកម្មទាំងអស់នៅដដែលបេះបិទ** — គោលការណ៍ "លុប"/"ដក", បង្អួច ២ម៉ោង/៨ថ្ងៃ/១០ថ្ងៃ,
`runTransaction` សម្រាប់ចំណូល និងការស្កេន, ស្ថិតិអតិថិជនយក, Setup Link, Lookup API, Export —
កូដទាំងអស់នេះជាកូដដដែលដែលបានឆ្លងកាត់ការ audit ១២ ជុំ។

---

## រូបរាង (Design System)

**"Aurora"** — indigo → violet → cyan។

| Token | ភ្លឺ | ងងឹត |
|---|---|---|
| ផ្ទៃខាងក្រោយ | `#F4F6FC` | `#080B15` |
| ផ្ទៃកាត | `#FFFFFF` | `#121A2C` |
| ពណ៌ចម្បង | `#5850EC` | `#818CF8` |
| COD | `#0891B2` | `#22D3EE` |
| DOD | `#7C3AED` | `#A78BFA` |
| ជោគជ័យ | `#059669` | `#34D399` |
| គ្រោះថ្នាក់ | `#E11D48` | `#FB7185` |

- **អក្សរ**៖ Kantumruy Pro (ខ្មែរ) + Inter (ឡាតាំង/លេខ, `tabular-nums` សម្រាប់តម្រឹមលេខ)
- **ស៊ុមមូល**៖ 8 / 10 / 14 / 18 / 24px
- ផ្ទាំងងងឹតកំណត់តាម `data-theme` លើ `<html>` ដោយ script តូចក្នុង `<head>` — **គ្មានការភ្លឹបភ្លែត
  (FOUC)** ពេលបើក App
- CSS ប្រើ **alias tokens** (`--primary`, `--accent-blue`, `--accent-purple`, `--text-muted`,
  `--border-color`, `--success`, `--success-light`) ព្រោះ `app.js` សរសេរ inline style ដែលយោង
  ឈ្មោះទាំងនោះ — ដូច្នេះ markup ដែលបង្កើតដោយ JS ក៏ប្តូរពណ៌តាមផ្ទាំងងងឹតដែរ

### អេក្រង់

- **ទូរស័ព្ទ (< 992px)**៖ Tab ខាងក្រោម ៤ — បង្ហាញម្តងមួយផ្ទាំង
- **កុំព្យូទ័រ (≥ 992px)**៖ Tab បាត់ទៅ ប្តូរជា **ជួរឈរ ២** — ឆ្វេង៖ ស្កេន + ចំណូល + ការកំណត់,
  ស្តាំ៖ បញ្ជីប្រវត្តិ (sticky)។ ផ្ទាំងទាំងអស់មើលឃើញព្រមគ្នា

---

## រចនាសម្ព័ន្ធឯកសារ

| ឯកសារ | ចំណាំ |
|---|---|
| `index.html` | Markup ថ្មីទាំងស្រុង — **រក្សា `id` គ្រប់ណាដែល `app.js` ត្រូវការ** |
| `style.css` | Design system ថ្មី (ភ្លឺ + ងងឹត) |
| `app.js` | កូដ ZoeAdmin ដដែល + ការកែសម្រាប់ Tab, ផ្ទាំងពណ៌, តម្រង/តម្រៀប, កាត |
| `license-verify.js` | **byte-identical ទាំង ៥ App** — កុំកែម្តងមួយ App |
| `error-reporting.js` | **byte-identical ទាំង ៥ App** |
| `firebase-loader.js` | ដូច ZoeAdmin |
| `sw.js` | `CACHE_VERSION = 'zoeadminv2-vN'` — filter សម្អាតស្កេនតែ prefix `zoeadminv2-` |
| `icon-192.png` / `icon-512.png` | Logo ថ្មី (render ចេញពី SVG) |

### អ្វីដែលកែក្នុង `app.js` (ធៀបនឹង ZoeAdmin)

1. `zoeadmin` ➜ `zoeadminv2` សម្រាប់ Sentry tag និង PBKDF2 salt ទាំង ២
   (PIN និង Lookup API secret) — ដូច្នេះ PIN និង secret មិនឆ្លងគ្នារវាង ២ App
2. `setupSwipeGestures()` ➜ `switchTab()` / `setupTabNavigation()` / `updateOrdersTabBadge()`
3. `setPhoneSearchPulledUp()` **ត្រូវលុបចោល** — លែងត្រូវការ ព្រោះបញ្ជីមានផ្ទាំងផ្ទាល់ខ្លួន
4. `buildHistoryRowHtml()` / `renderHistory()` សរសេរឡើងវិញជា **កាត** (`<div>`) ជំនួស `<tr>`។
   រក្សា algorithm diff តាម `data-sig` ដដែល ដូច្នេះការ render នៅតែលឿន
5. បន្ថែម៖ `setTheme` / `cycleTheme` / `applyThemeUi` / `setupThemeWatcher`,
   `applyListRefinements` / `setStatusFilter` / `setSortMode` / `restoreListPreferences`,
   `clearPhoneSearch`, `copyPhoneToClipboard`, `setupKeyboardShortcuts`

> **លេខរៀង (ល.រ)** នៅតែជា **លេខតាមលំដាប់ស្កេន** ដដែល ទោះប្តូរការតម្រៀបក៏ដោយ —
> គណនាពី `historySeqById` ដែលបង្កើតពីបញ្ជីតាមលំដាប់ពេលវេលា មុនពេលត្រង/តម្រៀប។

---

## ដំឡើង (Deploy)

1. បង្កើត Netlify site ថ្មី ចង្អុលទៅថត `ZoeAdminV2/`
2. `netlify.toml` មាន CSP, security headers និង cache rules រួចរាល់ហើយ
3. **គ្មានការប្តូរ Firebase rules ទេ** — V2 អាន/សរសេរ path ដដែលនឹង ZoeAdmin ➜ **គ្មាន publish ថ្មី**
4. Config Firebase៖ Setup Link (`?setup=`) ពី ZoeKeyGen ឬស្កេន QR ក្នុង ⚙️ Config
   (ទាំងពីរឆ្លងកាត់ Security PIN ដដែល)
5. Activation Key៖ ប្រើ Key `ADM` ដែលមានស្រាប់

---

## ការធ្វើតេស្ត

V2 ត្រូវបានបញ្ចូលក្នុងឧបករណ៍ audit របស់គម្រោង៖

```bash
bash audit-tools/run-all.sh
```

គ្របដោយ `wiring.js`, `css-classes.js`, `dom-hygiene.js`, `comments.js`,
`boot-runtime.js` (Chromium ពិត) និង `setup-link-browser-test.js` (ផ្លូវ provisioning ពេញលេញ)។

---

## សុវត្ថិភាព (Security)

ដូច ZoeAdmin ដើមបេះបិទ៖ Firebase Auth + role `admin`, Security PIN សម្រាប់ Config,
CSP តឹងរ៉ឹង, សម្អាតទិន្នន័យក្នុង DOM ពេលចាកចេញ (រួមទាំង **តារាងធុងសំរាម, ស្ថិតិប្រចាំថ្ងៃ/ខែ**
ដែល V2 បិទបន្ថែម), និង Activation Key ដែល sign ដោយ ECDSA P-256។

## អាជ្ញាប័ណ្ណ (License)

កម្មសិទ្ធិឯកជន — Powered by ZoeW.
