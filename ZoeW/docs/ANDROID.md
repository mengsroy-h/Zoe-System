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
| ស្ថានភាពបណ្តាញ (`navigator.onLine` · `online`/`offline`) | browser ផ្តល់ជានិច្ច | WebView ផ្តល់ **តែពេល** App មានសិទ្ធិ `ACCESS_NETWORK_STATE` (សិទ្ធិធម្មតា · គ្មានប្រអប់សុំ) — បើអត់ `onLine` = `true` ជានិច្ច ហើយ `online`/`offline` មិនដែលបាញ់ ➜ ការភ្ជាប់ឡើងវិញរង់ចាំជណ្តើរ (ដល់ ៦០ វិ.) · ស្ថានភាព «ក្រៅបណ្ដាញ» និង 🩺 «អ៊ីនធឺណិត» និយាយខុស (`npm run android:check` ចាក់សោសិទ្ធិនេះ) |
| សោ App ពេលចាកចេញ | `visibilitychange` | `pause`/`resume` របស់ Activity **បូក** `visibilitychange` (ការហៅស្ទួនត្រូវច្រានចេញ) |
| ZTO Lookup | `/.netlify/functions/…` same-origin | URL ពេញ ៖ `VITE_NATIVE_WEB_ORIGIN` + Function អនុញ្ញាត CORS ពី `https://localhost` · query ផ្ញើក្នុង header `X-Zoe-Query` ទៅ URL ថេរ ➜ preflight OPTIONS ១ ដង/២ ម៉ោង (មិនមែនរាល់ការស្កេន) · Function ចាស់ឆ្លើយ 400 ➜ App សាក URL មាន query ហើយចងចាំសម្រាប់ session នោះ |
| ល្បឿនអេក្រង់ | Chrome រត់តាមល្បឿនអេក្រង់ (90/120Hz) | ROM ជាច្រើនកំណត់ App ត្រឹម **60Hz** បើ App មិនស្នើ ➜ `MainActivity` ស្នើ mode ល្បឿនខ្ពស់បំផុតក្នុងទំហំដដែល (`preferredDisplayModeId`) រាល់ `onCreate`/`onResume` · ROM ខ្លះនៅតែកំណត់តាមការកំណត់ «Refresh rate» ក្នុង Settings របស់ទូរស័ព្ទ |
| Backup ទិន្នន័យ App | — | **បិទ** (`allowBackup=false` · `dataExtractionRules`) ៖ កៅអី License និង secret មិនត្រូវចម្លងទៅទូរស័ព្ទផ្សេង |
| model · serial ឧបករណ៍ | model ពី `userAgentData` (Chrome Android) · iPhone ត្រឹម «iPhone» · serial = ID App ១៦ តួ (SHA-256 នៃ ID License) | plugin ក្នុង App `ZoeDevice` (`DeviceInfoPlugin.java`) ៖ `Build.MANUFACTURER` + `Build.MODEL` · កំណែ Android · serial = **Android ID** (`Settings.Secure.ANDROID_ID` ៖ ស្ថិតស្ថេរលើទូរស័ព្ទនោះ + keystore ដដែល · ប្តូរតែពេល Factory reset) · គ្មានសិទ្ធិថ្មី (serial ពិតរបស់ hardware Android 10+ ហាម App ធម្មតា) |
| ធ្វើបច្ចុប្បន្នភាព App | Service Worker ទាញកំណែថ្មីដោយខ្លួនឯង | 🔔 «📱 កំណែ App» ៖ plugin ក្នុង App `ZoeApkUpdate` (`ApkUpdatePlugin.java`) សួរ GitHub ថា Release `zoew-android-v<កំណែ>` មាន `ZoeW-<កំណែ>.apk` ពិតឬនៅ (HEAD មិនតាម redirect ៖ 302 = មាន · 404 = គ្មាន) ➜ ប៊ូតុងតែពេលមាន ➜ ទាញចូល cache របស់ App (របារីកចម្រើន · ផ្ទៀង package និង versionName) ➜ ផ្ទាំងដំឡើងរបស់ Android (សិទ្ធិ `REQUEST_INSTALL_PACKAGES` · លើកដំបូង «អនុញ្ញាតពីប្រភពនេះ») · APK ចាស់ក្នុង cache លុបពេលបើក App ក្រោយដំឡើង |

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

### APK ពី GitHub Releases (ទាញយកងាយ)

`.github/workflows/android-release.yml` build APK ដែល **sign រួច** ហើយបង្កើត **GitHub Release** មួយក្នុងមួយកំណែ
(`zoew-android-v<APP_VERSION>` · ឯកសារ `ZoeW-<កំណែ>.apk` + `.sha256`) ៖ ពេល `APP_VERSION` ប្រែលើ `main` ឬចុច
**Actions ➜ Android APK ➜ Run workflow**។ ទាញយក ៖ ទំព័រ repo ➜ **Releases** ➜ `ZoeW-<កំណែ>.apk` ➜ បើកលើទូរស័ព្ទ ➜ ដំឡើង។
ទូរស័ព្ទដែលមាន App រួច ៖ 🔔 ➜ «📥 ទាញយក និងដំឡើង APK» (បង្ហាញតែក្រោយ Release មានឯកសារ APK) ➜ ទាញ និងដំឡើងក្នុង App ·
លុប Release ឬ build មិនទាន់ចប់ ➜ ប៊ូតុងមិនបង្ហាញ។

### APK សាកពី branch (មុន merge)

**Actions ➜ Android APK ➜ Run workflow** ➜ «Use workflow from» ជ្រើស **branch** (មិនមែន `main`) ➜ **Run workflow** ➜ workflow build APK
ដែល sign ដោយ keystore ដដែល ហើយបង្កើត **Pre-release** `zoew-android-v<កំណែ>-test.<commit ៧ តួ>` (ឯកសារ `ZoeW-<កំណែ>-test.<commit>.apk`)
➜ **Releases** ➜ ទាញ APK ➜ ដំឡើងជាន់ App ដែលមានស្រាប់ (ទិន្នន័យ · PIN · Activation នៅដដែល)។ Pre-release មួយក្នុងមួយ commit ·
push លើ branch មិន build ស្វ័យប្រវត្តិ · Release ផ្លូវការនៃកំណែដដែល (ពី `main`) ដំឡើងជាន់ APK សាកបាន។ ⛔ APK សាកសម្រាប់ម្ចាស់គម្រោងសាក
តែប៉ុណ្ណោះ (កុំចែកឲ្យអតិថិជន) · លុប Pre-release និង tag របស់វាពេលលែងត្រូវការ (Releases ➜ Delete)។

⛔ **keystore តែមួយជារៀងរហូត** ៖ APK ដែល sign ដោយ keystore ផ្សេង **ដំឡើងជាន់ App ចាស់មិនបាន** ➜ ត្រូវលុប App ចាស់ ➜
បាត់ការចូលប្រព័ន្ធ · PIN · និង **កៅអី License** (Device ID ថ្មី ➜ Key ដែលមានពិដានឧបករណ៍ ១ ត្រូវឲ្យ admin ដោះឧបករណ៍ចាស់ក្នុង
ZoeKeyGen មុន)។ ដូច្នេះ workflow **មិន build ទាល់តែសោះ** ពេលគ្មាន keystore (គ្មានការធ្លាក់ចុះទៅ debug key)។

**keystore របស់ ZoeW មានរួច** (`CN=ZoeW, O=Zoe System, C=KH` · alias `zoew` · PKCS12 · RSA 4096) ហើយវិញ្ញាបនបត្ររបស់វា
(SHA-256 · មិនសម្ងាត់) **pin** ក្នុង `android/release-cert.sha256`។ workflow ប្រៀបវិញ្ញាបនបត្រ APK នឹង pin **ក្រោយ
`apksigner verify` និងមុន Release** ➜ secret ដែលចង្អុលទៅ keystore ផ្សេង ➜ ជំហានធ្លាក់ ➜ **គ្មាន Release** (APK ដែលទូរស័ព្ទ
ដំឡើងជាន់មិនបាន មិនចេញដល់អ្នកប្រើ)។ ⛔ **កុំបង្កើត keystore ថ្មី** — ការប្តូរ keystore ដោយចេតនា (ឧ. បាត់ keystore) ត្រូវកែ
`release-cert.sha256` ក្នុង commit ដដែល ហើយអ្នកប្រើ Android **ទាំងអស់** ត្រូវលុប App ចាស់ម្តង។

**ការរៀបចំ (ម្តង)** ៖

1. GitHub ➜ Settings ➜ Secrets and variables ➜ Actions ➜ បន្ថែម secret ៤ ៖ `ZOEW_KEYSTORE_BASE64` (keystore ជា base64
   បន្ទាត់តែមួយ) · `ZOEW_KEYSTORE_PASSWORD` · `ZOEW_KEY_ALIAS` (`zoew`) · `ZOEW_KEY_PASSWORD` (ស្មើ `ZOEW_KEYSTORE_PASSWORD` —
   PKCS12 ប្រើពាក្យសម្ងាត់តែមួយ)។ base64 ពី `zoew-release.jks` ៖ `base64 -w0 zoew-release.jks` · Windows PowerShell ៖
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("zoew-release.jks"))`។
2. ⛔ **រក្សា `zoew-release.jks` និងពាក្យសម្ងាត់ទុកក្រៅ repo** (ឧ. Password Manager + ច្បាប់ចម្លង ២ កន្លែង) — បាត់ keystore =
   App ដំឡើងជាន់មិនបានទៀតទេ។ ⛔ កុំ commit វា (`.gitignore` ហាម `*.jks` · `*.keystore` ហើយ `npm run android:check` ពិនិត្យ)។

`build.gradle` sign APK តែពេល env `ZOEW_KEYSTORE_FILE` មាន ➜ Android Studio (**Generate Signed App Bundle / APK** ដោយជ្រើស
`zoew-release.jks`) នៅដើរដូចមុន។ `npm run android:check` ចាក់សោស្នាមភ្ជាប់ workflow ↔ `build.gradle` (ឈ្មោះ env · គ្មានផ្លូវ
debug · `apksigner verify`) និង pin (ទម្រង់ SHA-256 · ការប្រៀបមុន Release)។

**Build ក្នុង session Claude (cloud)** ៖ network របស់ environment ត្រូវអនុញ្ញាត `dl.google.com` (និង `maven.google.com` ដែល
បញ្ជូនបន្តទៅវា) ➜ SDK ៖ `cmdline-tools` ➜ `sdkmanager "platforms;android-36" "build-tools;36.0.0"` · `node_modules` ត្រូវជា
**ច្បាប់ចម្លងពិត** (symlink ធ្វើឲ្យ `cap sync` សរសេរផ្លូវ absolute ចូល `capacitor.settings.gradle` ➜ `android:check` ផ្នែក ៥
ធ្លាក់) · Maven Central ឆ្លើយ `429` ➜ រត់ Gradle ម្តងទៀត (dependency ដែលទាញរួចនៅក្នុង cache)។

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
— Audit job វាស់ config/bridge តែប៉ុណ្ណោះ; workflow `Android APK` សាង APK ពិតពេលមាន SDK, secret និងកូតា។

⛔ **Android Studio ស្នើ «Upgrade Android Gradle Plugin / Gradle ទៅ 9.x»** (AGP Upgrade Assistant) ពេល Sync ៖ វាជា
**ការណែនាំ** មិនមែនតម្រូវការទេ ➜ ចុច **Remind me tomorrow** ឬ **Don't ask for this project** ⛔ កុំចុច Upgrade។ Sync និង build
ដើរដោយកំណែក្នុង repo (JDK 21)។ ការទទួលវាប្តូរ `build.gradle` · `gradle-wrapper.properties` ចេញពីខ្សែ template ➜
`npm run android:check` ធ្លាក់ ហើយ plugin Capacitor អាច build មិនកើត។ បើ Sync **ធ្លាក់ពិត** (មិនមែនត្រឹមការស្នើ) សូមថតសារកំហុសទាំងមូល។

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
- **Splash ពេលបើក** (`AppTheme.NoActionBarLaunch` ក្នុង `values/styles.xml`) ៖ ផ្ទៃ `@color/splash_background` (ស្មើ
  `SplashScreen.backgroundColor` ក្នុង `capacitor.config.ts`) + icon vector `drawable/splash_icon.xml` (ដេរីវេពីរូបមេ ដោយ
  `npm run android:icons` · ប្រអប់ជ្រុងមូលក្នុងរង្វង់ 192dp ➜ ច្បាស់គ្រប់ទំហំ ទោះ ROM បិទជ្រុងឬអត់) · គ្មាន title/ActionBar · `postSplashScreenTheme` = `AppTheme.NoActionBar`។ ⛔ កុំដាក់ `android:background` ក្នុង
  theme នោះវិញ (វាក្លាយជា background លំនាំដើមរបស់ **គ្រប់ View** ➜ splash.png ពង្រីក/ច្របាច់ក្នុងរាល់ View)។ `splash.png`
  នៅសម្រាប់ផ្លូវបម្រុងរបស់ plugin តែប៉ុណ្ណោះ។ `npm run android:check` ចាក់សោទាំងនេះ

---

## ៤. សកម្មភាពដែលត្រូវធ្វើដោយដៃ (ម្តង)

1. **Netlify** ៖ deploy ZoeW ដែលមាន CORS ថ្មីរបស់ ZTO Function (ដំណើរការ
   ស្វ័យប្រវត្តិពេល merge)។ មុននោះ ZTO Lookup ក្នុង App Android ធ្លាក់។ ⛔ **deploy Netlify មុនចែក APK ថ្មី** ៖
   Function ដែលមិនទាន់ស្គាល់ header `X-Zoe-Query` ឆ្លើយ 400 ➜ APK សាក URL មាន query វិញ (ដំណើរការ តែលឿនដូច APK
   ចាស់ រហូតដល់ Function ថ្មី deploy ហើយ App ត្រូវបើកឡើងវិញ)។
2. **Firebase (Project Business)** ៖ បើ API key មានការរឹតបន្តឹង *HTTP referrer*
   សូមបន្ថែម `https://localhost` (Google Cloud Console ➜ Credentials)។ បើគ្មាន
   ការរឹតបន្តឹង មិនបាច់ធ្វើអ្វីទេ។
3. **License** ៖ ទូរស័ព្ទមួយដែលប្រើទាំង PWA និង App Android = **២ ឧបករណ៍**
   (storage ដាច់ពីគ្នា) ➜ ត្រូវប្រើកៅអី ២ ក្នុង Key ឬដោះឧបករណ៍ចាស់ក្នុង ZoeKeyGen។
4. **ការជូនដំណឹងលើទូរស័ព្ទ (FCM)** ៖ Firebase Console របស់ **License Project** (Project រួមតែមួយ — មិនមែន Project របស់
   អតិថិជនណាម្នាក់) ➜ **Add app ➜ Android** ➜ package `com.zoesystem.zoew` ➜ ទាញ `google-services.json` ➜ GitHub secret
   **`ZOEW_GOOGLE_SERVICES_JSON`** (JSON ឬ base64)។ workflow សរសេរវាចូល `android/app/` **មុន** build web ហើយផ្ទៀងថា
   package ត្រឹមត្រូវ · build ក្នុងម៉ាស៊ីន ៖ ដាក់ឯកសារនោះក្នុង `android/app/` ⛔ **មិនចូល repo** (`android/.gitignore`)។
   គ្មានឯកសារ ➜ APK នៅដំណើរការធម្មតា តែផ្ទាំង 🔔 ប្រាប់ «មិនទាន់ភ្ជាប់ FCM» ហើយ App **មិនហៅ** plugin push ទាល់តែសោះ
   (`FirebaseMessaging` គ្មាន `google-services.json` ធ្វើឲ្យ App គាំង) ➜ ច្រកទ្វារ `__FCM_CONFIGURED__` ពេល build។
   server ផ្ញើតាម `FCM_SERVICE_ACCOUNT` (Netlify env) — មើល [README](../README.md) ផ្នែក ១១។

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
| ១៥ | 🔔 ពេល Release កំណែថ្មីមិនទាន់ចេញ ➜ ចេញរួច ➜ «📥 ទាញយក និងដំឡើង APK» | មិនទាន់ចេញ ➜ «មិនទាន់មាន» គ្មានប៊ូតុង · ចេញរួច ➜ របារីក ➜ ផ្ទាំងដំឡើង ➜ App ថ្មីបើក · ទិន្នន័យ · PIN · Activation នៅដដែល |
| ១៤ | តម្រង «ទាំងអស់» ➜ រមូរដល់ចុងបញ្ជីច្រើន ➜ បើក/បិទធុងសំរាម · បញ្ជី ZTO · ☰ · 🔔 ➜ រមូរឡើងវិញ · កែជួរ · ប្តូរតម្រង | មើលបានគ្រប់កញ្ចប់ · ប្រអប់រលូន · ទីតាំងនៅដដែលពេលបិទ · លេខ/ប៊ូតុងត្រូវតាមជួរ · តម្រងថ្មីចាប់ផ្តើមនៅកំពូល |
