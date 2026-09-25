# App Android របស់ ZoeW (Capacitor)

App Android ជា **សំបក native** ជុំវិញ build របស់ Vite ដដែលនឹង web ៖ កូដអាជីវកម្ម ·
លុយ · Firebase · License ដូចគ្នាបេះបិទ។ ⛔ **Android តែមួយ** — គ្មាន iOS native
(iPhone នៅប្រើ PWA ដដែល)។

---

## ១. អ្វីដែលខុសពី web

| មុខងារ | web / PWA | Android native |
|---|---|---|
| ជីវមាត្រ (ក្រយៅដៃ/មុខ) | WebAuthn | **BiometricPrompt + Android Keystore** (`@capgo/capacitor-native-biometric`) — PIN ចងនឹង `BIOMETRY_CURRENT_SET` ➜ ចុះឈ្មោះក្រយៅដៃថ្មីក្នុងទូរស័ព្ទ ➜ ការចងចាស់លែងប្រើបាន ហើយ App ប្រាប់ឲ្យបើកវាឡើងវិញ |
| Pull-to-refresh | Chrome មាន PTR ផ្ទាល់ · iOS PWA ប្រើ PTR របស់ App (ចាប់ផ្តើម ៤០% ខាងលើ · ស្រទាប់បើក ➜ គ្មាន PTR · ⛔ iPhone គ្មាន API ញ័រ) | PTR របស់ App (ដូច iOS) បូក **ការចាប់មុន slop** របស់ Chromium បូក **ញ័រម្តង** ពេលឆ្លងព្រំដែន (`@capacitor/haptics` · សិទ្ធិ `VIBRATE`) |
| ប៊ូតុង/កាយវិការ Back | — | បិទម៉ឺនុយ/ប្រអប់/របា Slide ➜ **ប្រវត្តិថយក្រោយ** (ទំព័រ · របៀបស្កេន ម្តងមួយជំហាន · ⛔ មិនត្រឡប់ចូលរបៀប «ដក») ➜ បង្រួម App |
| Export Excel/CSV | ទាញយក | សរសេរចូល cache ➜ ផ្ទាំង **Share** របស់ Android (Drive · Telegram · Excel …) |
| Export PDF · របាយការណ៍ខែ PDF | `window.print()` | **PrintManager** របស់ Android (Save as PDF) |
| Service Worker | cache សំបក | មិនចុះឈ្មោះ (ឯកសារទាំងអស់ស្ថិតក្នុង APK រួច) |
| សោ App ពេលចាកចេញ | `visibilitychange` | `pause`/`resume` របស់ Activity **បូក** `visibilitychange` (ការហៅស្ទួនត្រូវច្រានចេញ) |
| ZTO Lookup | `/.netlify/functions/…` same-origin | URL ពេញ ៖ `VITE_NATIVE_WEB_ORIGIN` + Function អនុញ្ញាត CORS ពី `https://localhost` |
| Backup ទិន្នន័យ App | — | **បិទ** (`allowBackup=false` · `dataExtractionRules`) ៖ កៅអី License និង secret មិនត្រូវចម្លងទៅទូរស័ព្ទផ្សេង |

---

## ២. Build APK

ត្រូវការ ៖ **Node.js** (ដូច web) · **Android Studio** (រួម Android SDK · JDK 21)។

```bash
cd ZoeW
npm install
npm run android:sync     # build (--mode android) ➜ ចម្លងចូល android/
npm run android:open     # បើក Android Studio
```

ក្នុង Android Studio ៖ **Build ➜ Generate Signed App Bundle / APK** ➜ ជ្រើស
**APK** ➜ បង្កើត ឬជ្រើស keystore ➜ **release**។

⛔ **រក្សា keystore ឲ្យបាន** ៖ APK ថ្មីដែល sign ដោយ keystore ផ្សេង **ដំឡើងជាន់
APK ចាស់មិនបាន** (អតិថិជនត្រូវលុប App ចាស់ ➜ បាត់ការចូលប្រព័ន្ធ · PIN ·
Activation)។ ⛔ កុំដាក់ keystore ក្នុង repo។

### លេខកំណែ APK

`versionName` និង `versionCode` **ដេរីវេពី `APP_VERSION`** (`src/core/version.ts`)
ពេល Gradle build — គ្មានលេខទី ២ ត្រូវកែដោយដៃ ៖

```
versionName = APP_VERSION                       (X.Y.Z)
versionCode = X × 1000000 + Y × 1000 + Z         (ឡើងជានិច្ចតាម APP_VERSION)
```

⛔ Android បដិសេធការដំឡើង APK ដែល `versionCode` **ទាបជាង** កំណែដែលមានរួច ➜
ការឡើង `APP_VERSION` តាមធម្មតាគ្រប់គ្រាន់។ `APP_VERSION` ខូច ➜ build **ធ្លាក់**
(មិនចេញ APK លេខខុសស្ងាត់ៗ)។ `npm run android:check` ចាក់សោរូបមន្តនេះ។

### កំណែ Gradle · Android Gradle Plugin · SDK

config build Android (`android/variables.gradle` · `android/build.gradle` ·
`android/gradle/wrapper/gradle-wrapper.properties`) ត្រូវស្ថិតក្នុងខ្សែដែល **Capacitor
ដែលដំឡើង** ប្រកាសក្នុង template របស់វា ៖ SDK (`compileSdk` · `targetSdk` · `minSdk`) និង
AndroidX **ស្មើ** template · AGP · Gradle · google-services **ឡើងបានតែ patch** ក្នុងខ្សែ
major.minor ដដែល។ `npm run android:check` ចាក់សោវា។

⛔ ហេតុផល ៖ plugin Capacitor ទាំងអស់ត្រូវបានសាកជាមួយខ្សែនោះ ហើយការឡើងលើស (AGP major ថ្មី ·
`compileSdk` ថ្មី · AndroidX ដែលទាមទារ AGP ថ្មី) **ធ្លាក់តែពេល build ក្នុង Android Studio**
— ម៉ាស៊ីន CI នៃ repo នេះគ្មាន Android SDK ➜ វាស់មិនបាន។

ការឡើងលើសខ្សែនោះ = **ការឡើង Capacitor major** (ពេលវាចេញជា stable មិនមែន alpha/beta) ៖

```bash
cd ZoeW
npm install @capacitor/core@latest @capacitor/android@latest @capacitor/cli@latest   # + plugin @capacitor/* · @capgo/* ដែលស៊ីគ្នា
npx cap migrate          # Capacitor ធ្វើបច្ចុប្បន្នភាព config Android តាម template ថ្មី
npm run android:check    # ផ្ទៀងផ្ទាត់ config ↔ template ថ្មី
```

រួច **build ក្នុង Android Studio និងសាកលើទូរស័ព្ទពិត** (ផ្នែក ៥) មុន merge។

### ការកំណត់ (`.env.android`)

```
VITE_NATIVE_WEB_ORIGIN=https://zoew.netlify.app
```

App Android បម្រើពី `https://localhost` ➜ ផ្លូវ `/.netlify/functions/…` ត្រូវ
ដាក់ origin ពិតរបស់ Netlify ពីមុខ។ ⛔ ត្រូវជា `https://` គ្មាន path — តម្លៃខុស ➜
App មិនប្តូរ URL (ZTO Lookup ធ្លាក់ដោយសារ «Failed to fetch»)។

---

## ៣. Logo និង splash

រូបមេតែមួយ ៖ [`resources/icon.svg`](../resources/icon.svg) (ប្រអប់ក្រហម · គូបស —
ដូច icon របស់ PWA)។ ការប្តូរ logo ៖ កែរូបមេ រួច ៖

```bash
npm run android:icons    # ➜ android/app/src/main/res (legacy · round · adaptive · themed · splash)
```

- **Adaptive icon** (Android 8+) ៖ ផ្ទៃក្រោយ gradient ក្រហម (vector) · ផ្ទៃមុខ =
  គូបក្នុងតំបន់សុវត្ថិភាព
- **Themed icon** (Android 13+) ៖ ស្រមោលគូបពណ៌តែមួយ (បន្ទាត់កណ្តាលកាត់ចេញ)
- **Legacy** (Android 7) ៖ PNG រាងប្រអប់មូល និងរង្វង់

---

## ៤. សកម្មភាពដែលត្រូវធ្វើដោយដៃ (ម្តង)

1. **Netlify** ៖ deploy ZoeW ដែលមាន CORS ថ្មីរបស់ ZTO Function (ដំណើរការ
   ស្វ័យប្រវត្តិពេល merge)។ មុននោះ ZTO Lookup ក្នុង App Android ធ្លាក់។
2. **Firebase (Project Business)** ៖ បើ API key មានការរឹតបន្តឹង *HTTP referrer*
   សូមបន្ថែម `https://localhost` (Google Cloud Console ➜ Credentials)។ បើគ្មាន
   ការរឹតបន្តឹង មិនបាច់ធ្វើអ្វីទេ។
3. **License** ៖ ទូរស័ព្ទមួយដែលប្រើទាំង PWA និង App Android = **២ ឧបករណ៍**
   (storage ដាច់ពីគ្នា) ➜ ត្រូវប្រើកៅអី ២ ក្នុង Key ឬដោះឧបករណ៍ចាស់ក្នុង ZoeKeyGen។

---

## ៥. ការសាកលើទូរស័ព្ទពិត (មុន merge)

`npm run native:check` វាស់ផ្លូវ JS ទាំងអស់ដល់ព្រំដែន bridge ក្នុង Chromium ៖
វា **មិន** វាស់កូដ Java របស់ plugin · WebView ពិត · Keystore។ ដូច្នេះត្រូវសាក ៖

| # | សាក | រំពឹង |
|---|---|---|
| ១ | ដំឡើង APK ➜ រូប App លើអេក្រង់ដើម | logo ក្រហម-គូបស (adaptive · themed icon បើបើក) |
| ២ | Settings ➜ Apps ➜ ZoeW | កំណែ = `APP_VERSION` |
| ៣ | Config · Login · Activate | ដូច PWA |
| ៤ | ស្កេនដោយកាមេរ៉ា (លើកដំបូងសុំសិទ្ធិ) | កាមេរ៉ាបើក · ស្កេនបាន |
| ៥ | ទាញចុះពីផ្នែកខាងលើ (៤០%) នៅកំពូលបញ្ជី · ទាញពីផ្នែកខាងក្រោម · ទាញពេលប្រអប់/ម៉ឺនុយបើក | ខាងលើ ➜ សញ្ញា PTR លេច · **ញ័រម្តង** ពេលគ្រប់ ➜ ផ្ទុកឡើងវិញ · ខាងក្រោម ឬពេលស្រទាប់បើក ➜ មិនផ្ទុក · ⛔ កាយវិការអូសផ្ទាំងនៅដើរដូចមុន |
| ៦ | Back ៖ ម៉ឺនុយ · ប្រអប់ · របា Slide · ទំព័រ/របៀបស្កេន | បិទម្តងមួយ ➜ ត្រឡប់ម្តងមួយជំហាន ➜ បង្រួម App |
| ៧ | បើកជីវមាត្រ ➜ បិទ App ➜ បើកវិញ | ផ្ទាំងក្រយៅដៃ ➜ ដោះសោ |
| ៨ | បន្ថែមក្រយៅដៃថ្មីក្នុង Settings ➜ បើក App | សារ «ត្រូវបានប្តូរ» ➜ វាយ PIN |
| ៩ | Export Excel · CSV · PDF | ផ្ទាំង Share / Print បើក · ត្រឡប់មកមិនសុំ PIN |
| ១០ | ខលទៅអតិថិជន ➜ ត្រឡប់មក | មិនសុំ PIN (ការលើកលែង) |
| ១១ | ចាកចេញពី App ធម្មតា ➜ ត្រឡប់មក | សុំ PIN · task switcher មិនឃើញទិន្នន័យ |
| ១២ | ZTO Lookup · 🩺 ពិនិត្យសុខភាព | ដូច PWA · ជួរ «របៀបក្រៅបណ្ដាញ» ✅ |
| ១៣ | ទូរស័ព្ទ WebView ចាស់ ធៀបនឹងថ្មី · បើក/បិទប្រអប់ | របាស្ថានភាព (ម៉ោង · ថ្ម) មើលឃើញជានិច្ច ៖ រូបតំណាង **ខ្មៅ** លើ navbar ស · **ស** ពេលប្រអប់ (ផ្ទៃងងឹត) បើក · ខ្មៅវិញពេលបិទ |
