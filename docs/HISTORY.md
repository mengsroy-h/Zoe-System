# ប្រវត្តិ Zoe-System — សម័យ ZoeW React (ពី 2.38.0)

> ⛔ **ឯកសារនេះជា *ប្រវត្តិ* មិនមែន *ច្បាប់* ទេ** — ច្បាប់ដែលត្រូវអនុវត្តរស់នៅ [`CLAUDE.md`](../CLAUDE.md) ហើយច្បាប់
> នីមួយៗចងទៅ **ឧបករណ៍ដែលចាក់សោវា**។ ត្រង់នេះទុក *ហេតុអ្វី* ច្បាប់មួយមាន · របៀបដែលកំហុសត្រូវរកឃើញ · **លេខដែលវាស់បាន**។
>
> ⛔ **ប្រវត្តិរស់នៅ ២ ឯកសារក្នុងថត `docs/` នៅ root តែប៉ុណ្ណោះ** (`CLAUDE.md` ច្បាប់ ៩) ៖
>
> | ឯកសារ | គ្របអ្វី |
> |---|---|
> | **`docs/HISTORY.md`** (ឯកសារនេះ) | សម័យ **ZoeW React** ៖ ZoeW `2.38.0` ➜ ឥឡូវ (ពី 2026-09-23) · **ធាតុថ្មីទាំងអស់សរសេរនៅទីនេះ** |
> | **[`docs/HISTORY-ARCHIVE.md`](HISTORY-ARCHIVE.md)** | សម័យ **ZoeW vanilla** ៖ ZoeW ≤ `2.37.3` · ZoeKeyGen ≤ `2.20.2` (ដល់ 2026-09-18) · កំណែមុន `2.20.0` · អត្ថបទដែលដកចេញពី `CLAUDE.md` · **អានបានតែមិនបន្ថែម** |
>
> ⛔ **កុំអានពីដើមដល់ចប់** — វាជាឯកសារយោង។ ផ្លូវធម្មតា ៖ checker ធ្លាក់ ➜ `grep -n "<ឈ្មោះ checker>" docs/HISTORY*.md`
> (គ្របទាំង ២ ឯកសារ) ឬមើល **[🔎 លិបិក្រម](#-លិបិក្រម--ឈ្មោះ-checker--ការពន្យល់រស់នៅឯណា)** នៅចុងឯកសារនេះ។
>
> | ត្រូវការអ្វី | មើលកន្លែងណា |
> |---|---|
> | «សកម្មភាពដែលត្រូវធ្វើដោយដៃ» · អ្នកប្រើឃើញអ្វីខុសពីមុន | **ផ្នែក ១** (ឯកសារនេះ) · កំណែ ≤ 2.37.3 ➜ archive ផ្នែក ១ |
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

## 📗 ផ្នែក ១ — កំណត់ត្រាតាមកំណែ (សម័យ React · អ្នកប្រើឃើញអ្វីខុសពីមុន)

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

### [2.42.11] — 2026-09-29 · ZoeW ៖ **APK ស្នើល្បឿនអេក្រង់ខ្ពស់បំផុត** · **លេខ Hz ពិត និងកំណែ WebView ក្នុងរបា Slide** (merge រួច · PR #266)

**ZoeW `2.42.11` (`zoew-v238`)**។ ⛔ **ZoeKeyGen មិនប្រែ** (`2.20.6`)។

**របាយការណ៍ម្ចាស់គម្រោង** ៖ *«APK build ថ្មីហើយនៅតែមិនរលូនដូច PWA កែកែមិនចេះចប់ សន្និដ្ធានមិនដែលត្រូវសោះចឹង?»*

#### ការសារភាព និងការវាស់ឡើងវិញ

- ជុំ 2.42.9–2.42.10 កាត់ការងារដែលមាន **ទាំង PWA ទាំង APK** (វាស់ក្នុង Chromium លើ server) ➜ វាធ្វើឲ្យទាំង ២ លឿនជាងមុន តែ **មិនប៉ះគម្លាត
  APK ធៀប PWA** ទេ ព្រោះម៉ាស៊ីន audit **មិនមែន Android WebView**។ កំហុសនៃការសន្និដ្ឋាន ៖ ការអះអាងថា «APK នឹងរលូនដូច PWA» ដោយគ្មានការវាស់លើ WebView។
- ការពិនិត្យគ្រប់អ្វីដែល APK ខុសពី PWA ៖ `MainActivity` ជា template ទទេ · theme ប្តូរមុនសាង WebView (គ្មាន overdraw) · `SystemBars`
  ធ្វើការតែពេលពណ៌ប្រែ · JS តែលើ native ៖ PTR `touchmove` non-passive + ការវាស់ពណ៌របាស្ថានភាព (តូច ~១៥ ms/ការហូតក្រោម CPU ×4)។
  ➜ ការសាងគម្រោង Android ឡើងវិញពី template **មិនប្តូរ WebView ទេ**។ ភាពខុសគ្នាធំដែលនៅសល់គឺ **បរិស្ថានរត់** ៖ ROM Android ជាច្រើន
  (ColorOS/Realme UI/Funtouch/HyperOS/One UI adaptive) ឲ្យ Chrome រត់ 90/120Hz តែកំណត់ App ផ្សេងត្រឹម **60Hz** លុះត្រាតែ App ស្នើ ➜
  App យើងមិនដែលស្នើ។ ⚠️ នេះជា **សម្មតិកម្ម** ដែលម៉ាស៊ីននេះវាស់មិនបាន ➜ ជុំនេះបន្ថែម **ឧបករណ៍វាស់លើទូរស័ព្ទ** ជាមួយការកែ។

#### ការកែ

- `MainActivity` ស្នើ mode ល្បឿនខ្ពស់បំផុតក្នុងទំហំដដែល (`WindowManager.LayoutParams.preferredDisplayModeId` · API ផ្លូវការ) រាល់
  `onCreate`/`onResume` · ការបរាជ័យមិនគាំង App។ ផ្ទៀងផ្ទាត់ ៖ compile ជាមួយ framework Android 14 ពិត (Robolectric `android-all` ·
  `-Werror`) · ការជ្រើស mode ៧/៧ ករណី (60 ➜ 120Hz · មិនប្តូរទំហំ · null)។ ⛔ build APK ពេញធ្វើមិនបាននៅទីនេះ (`dl.google.com` ត្រូវបិទ)។
- ជើងរបា Slide បង្ហាញ **«អេក្រង់ NNHz · WebView/Chrome/Safari វវ»** វាស់ពី rAF រាល់ពេលបើករបា (median ៣០ ស៊ុម) ➜ ម្ចាស់គម្រោងប្រៀប
  PWA ធៀប APK លើទូរស័ព្ទដដែលបាន។

#### អ្នកយាម

- `npm run android:check` ៖ onCreate/onResume ស្នើ · `preferredDisplayModeId = best.getModeId()` · ជ្រើសតែទំហំដដែល + refresh ខ្ពស់ជាង ·
  `catch (RuntimeException …)` — mutation **៦/៦** ចាប់បាន (រួម `true || …` ដែល regex ជំនាន់ដំបូងខកខាន)។
- `ZoeW/tests/native/display-rate.test.tsx` (៧ ៖ UA WebView/Chrome/Safari · 120/90/60Hz ពី rAF ក្លែង · ការហៅស្ទួន · rAF បោះ · `SideDrawer` ពិត ·
  `openSideDrawer()` កេះ) — mutation **៤/៤** ចាប់បាន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ⛔ **build APK ថ្មីពី `main` (merge រួច · PR #266)** ➜ បើករបា Slide ក្នុង APK និងក្នុង PWA (Chrome) លើទូរស័ព្ទដដែល ➜ ប្រាប់លេខ Hz ទាំង ២ ៖
  APK 120 ≈ PWA 120 តែនៅមិនរលូន ➜ មូលហេតុផ្សេង (ជុំក្រោយវាស់តាម `chrome://inspect` លើ debug build) · APK 60 ខណៈ PWA 120 ➜ ROM
  មិនគោរពការស្នើ ➜ បើក «Refresh rate/Smooth display» សម្រាប់ ZoeW ក្នុង Settings។
- គ្មាន Firebase rules · គ្មាន env ថ្មី។

### [2.42.10] — 2026-09-29 · ZoeW ៖ **ជួរដេកច្រើន (filter «ទាំងអស់») ៖ ហូតប្រអប់ប្រវត្តិ · រមូរ · បើកធុងសំរាម លែងគូរតារាងទាំងមូលឡើងវិញ** (merge រួចក្នុង PR #264)

**ZoeW `2.42.10` (`zoew-v237`)**។ ⛔ **ZoeKeyGen មិនប្រែ** (`2.20.6`)។

**របាយការណ៍ម្ចាស់គម្រោង (ទូរស័ព្ទពិត)** ៖ *«capacitor app នៅតែមិន smooth ដូច PWA»* · *«ពេលឈរលើ filter ទាំងអស់ មានបញ្ជីជួរដេកច្រើន
ចលនាហូតប្រអប់ប្រវត្តិ អាក់អាក់ និង បើកធុងសំរាមក៏ដូច glitch មិនអាក់ខ្លាំងតែមើលទៅឃើញថាមិនរលូន»*។

#### មូលហេតុ (វាស់ មិនមែនស្មាន)

- `HistoryTableBody` subscribe **`uiState` ទាំងមូល** (`useStore(dataState, uiState)`) ហើយ `HistoryRow` មាន `memo` តែ `row` ជា object ថ្មី
  រាល់ការគូរ ➜ `memo` មិនដែលរារាំងអ្វីសោះ ➜ **រាល់** ការប្រែ `uiState` (ហូតប្រអប់ · បើកម៉ឺនុយ (...) · បើកប្រអប់ · លាក់របា Tab ខណៈរមូរ ·
  ប្តូរទំព័រ) គូរ **ជួរដេកទាំងអស់** ឡើងវិញ។ វាលទាំងនោះនៅក្នុង `markImmediate` ➜ commit **ភ្លាម** ➜ ការគូរ ១៥០០ ជួររត់ **ខាងក្នុងផ្លូវចលនា**
  (មុន FLIP វាស់ · ក្នុង rAF នៃការរមូរ)។ តារាងប្រវត្តិ **គ្មានពិដាន** (ខុសពីបញ្ជីស្កេន/Locker/ធុងសំរាម ២០០) ➜ filter «ទាំងអស់» ធ្ងន់ជាងគេ។
- ពាក់កណ្តាលទី ២ ៖ ឪពុក (`PageData` · `PageEntry`) គូរឡើងវិញរាល់ការហូត/បង្រួម ➜ React គូរកូនដែលមិនមែន `memo` តាម ➜ ការសាង model
  ១៥០០ ជួរ ទោះ subscription ត្រូវរួចក៏ដោយ (trace ៖ React ~២៤០ ms/ការហូត នៅសល់ក្រោយកែតែ subscription)។
- ⚠️ វាមិនមែនកំហុសតែលើ APK ទេ — PWA ក៏ដូចគ្នា (ផ្លូវកូដដដែល)។ ភាពខុសគ្នាដែលវាស់បានរវាង web និង APK ក្នុង Chromium តូច ៖
  `measureStatusBarTone()` (`elementsFromPoint`) លើ APK បង្ខំ layout មុនពេល ➜ ~១៥ ms/ការហូត (CPU ×4)។

#### ការកែ

- `HistoryTableBody` subscribe តែ `historyView` + `historyRenderSeq` (លេខរៀងថ្មីក្នុង `renderHistory()` ជំនួស `uiState.touch()` ➜ ធាតុកែ
  **នៅនឹងកន្លែង** + `renderHistory()` នៅតែគូរ) · `dataState` (អត្រាប្តូរ) · `firebaseState` (listener ធ្លាក់ ➜ សារ «វាស់មិនបាន» ពេលបញ្ជីទទេ ៖
  ពីមុនវាពឹងលើការប្រែ `uiState` ផ្សេងដោយចៃដន្យ)។
- `HistoryRow` ប្រៀបតាម **តម្លៃ** (`sameHistoryRowModel()` ៖ វាលកម្រិតទី ១ + object រាបស្មើមួយជាន់ដូច `money`) ➜ snapshot Firebase ថ្មីដែល
  តម្លៃដដែល ➜ ០ ជួរគូរ · ធាតុ ១ ប្រែ ➜ ១ ជួរ · អត្រាប្តូរប្រែ ➜ គ្រប់ជួរ។
- បញ្ជីស្កេន · Locker · ធុងសំរាម subscribe តែវាល view របស់ខ្លួន (អ្នកផលិតវា assign object ថ្មីជានិច្ច — ផ្ទៀងរួច) ·
  ឪពុកប្រើ `MemoHistoryTableBody` · `MemoEntryListTableBody` · `MemoLockerListTableBody` (function ដើមនៅតែ export សម្រាប់ `react-view`)។

#### ការវាស់ (Chromium · CPU ×4 · ១៥០០ ជួរលើ ៧ ថ្ងៃ · filter «ទាំងអស់» · ធុងសំរាម ២០០ · web / APK ក្លែង)

| សេណារីយ៉ូ | មុនកែ | ក្រោយកែ |
|---|---|---|
| ហូតប្រអប់ ៤ ដង ៖ long task សរុប (median) | 2078 / 1959 ms | **419 / 479 ms** |
| ហូតប្រអប់ ៖ ស៊ុមជាប់យូរបំផុត (median) | 1650 / 1533 ms | **267 / 300 ms** |
| រមូរ (របា Tab លាក់) ៖ long task | 2122 / 2061 ms | **423 / 387 ms** |
| បើកធុងសំរាម ៖ JavaScript ក្នុងការចុច | 766 ms | **89 ms** |

⛔ **អ្វីដែលនៅសល់ (វាស់រួច · មិនកែក្នុងជុំនេះ)** ៖ (១) PrePaint ~២៥០ ms និង HitTest ~១០០ ms ក្នុងមួយការហូត ដែលកើនតាមទំហំ DOM
(តារាង ៤២,០០០ node) ៖ `will-change: transform` លើ `.page-main` បន្ថយ PrePaint ~៣០–៥០% តែជា CSS ក្នុង **តំបន់ហាមចូល** ➜ ត្រូវវាស់លើ iPhone
និង Android ពិតមុន · (២) layout តារាងធុងសំរាម ២០០ ក្រុម (~៦០០ ms ក្រោម CPU ×4 ក្នុងម៉ាស៊ីននេះ · `table-layout: fixed` មិនជួយ ·
`body { overflow }` មិនមែនមូលហេតុ) — ផ្នែកធំអាចជាការរកពុម្ពអក្សរខ្មែរ/emoji ដែលម៉ាស៊ីននេះគ្មាន ➜ ត្រូវវាស់លើទូរស័ព្ទ ·
(៣) ភាពខុសគ្នារចនាសម្ព័ន្ធតែមួយរវាង APK និង PWA Android ៖ `touchmove` **non-passive** របស់ PTR លើ `document` (APK តែប៉ុណ្ណោះ)។

#### អ្នកយាម

- `ZoeW/tests/list-render-scope.test.tsx` (៨ ៖ mount `PageData` · `PageEntry` · `RecentlyDeletedModal` **ពិត** · រាប់ការគូរ body តាម getter លើ
  `phone` របស់ទិន្នន័យ · ការប្រែ `uiState` ១៦ ប្រភេទ ➜ ០ · បើកធុងសំរាម ➜ តែធុងសំរាម · ទិសផ្ទុយ ៦)។ **`main` ធ្លាក់ ៦/៨** ·
  mutation **១៣/១៣ ចាប់បាន** (body subscribe `uiState` ទាំងមូល · `memo` លំនាំដើម · គ្មាន `historyRenderSeq` · comparator ស្មើជានិច្ច ·
  គ្មាន `firebaseState` · ការប្រៀបរំលង `money` · ឪពុកប្រើ function ធម្មតា ×៣ · បញ្ជីស្កេន/ធុងសំរាម subscribe វាលផ្សេង ×២)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ⛔ **សាកលើ Android (APK + PWA) និង iPhone (PWA) ពិត** ជាមួយ filter «ទាំងអស់» និងជួរដេកច្រើន ៖ ហូតប្រអប់ប្រវត្តិឡើង/ចុះ · រមូរតារាង ·
  បើក/បិទធុងសំរាម · ចុច «យក»/«ដក»/កែតម្លៃលើជួរមួយ ➜ ជួរនោះប្រែភ្លាម · ប្តូរអត្រាប្រាក់ ➜ លេខរៀលប្រែគ្រប់ជួរ។
- APK ៖ build ថ្មីពី `main` (web ផ្ទុកក្នុង APK)។ PWA ៖ ✅ Netlify deploy រួចពេល merge PR #264 ➜ បើក App ឡើងវិញដើម្បីទទួល។
- គ្មាន Firebase rules · គ្មាន env ថ្មី។

### [2.42.9] — 2026-09-28 · ZoeW ៖ **ហូតប្រអប់ប្រវត្តិលឿនជាងមុន ~១០ ដង** (PWA និង APK) · **ស្កេន ZTO លើ APK លែងចំណាយ preflight រាល់ការស្កេន** (merge រួចក្នុង PR #260)

**ZoeW `2.42.9` (`zoew-v236`)**។ ⛔ **ZoeKeyGen មិនប្រែ** (`2.20.6`)។

#### អ្វីដែលអ្នកប្រើឃើញខុសពីមុន

- **ហូតប្រអប់ប្រវត្តិ (ចុច/អូសដងអូស)** ៖ ពីមុន រាល់ការហូត browser គណនា layout នៃទំព័រទាំងមូលឡើងវិញ ➜ ចលនាគាំងមួយភ្លែតនៅដើម
  (វាស់បាន ២៦០ ជួរ ៖ main thread ជាប់ **៥៧០–៦៦០ms** លើ CPU server · **៣.៤–៣.៧ វិ.** ពេល CPU យឺត ៤ ដងដូចទូរស័ព្ទធម្មតា) ➜ ឥឡូវ
  **៣៤–៦៥ms** / **២៦០–៣៤៨ms**។ រូបរាង និងទីតាំងមិនប្រែ (វាស់ ៣៦ snapshot ៖ Android + iOS · ៣ ទំហំអេក្រង់ · ទំព័រ ២)។
- **ស្កេន ZTO លើ APK** ៖ ម្ចាស់គម្រោងវាស់លើទូរស័ព្ទ ៖ PWA **០.៦–០.៧ វិ.** · APK **១.២–១.៧ វិ.** (ពេលខ្លះ ០.៧–០.៨)។ មូលហេតុ ៖ APK
  (origin `https://localhost`) ហៅ Function ជា cross-origin ជាមួយ header ផ្ទាល់ខ្លួន ➜ WebView ផ្ញើ preflight OPTIONS មុន GET ហើយ cache
  របស់ preflight ចងនឹង **URL ពេញ** ➜ barcode ក្នុង query = preflight **រាល់ការស្កេន** (២ ជុំទៅមក)។ វាស់ក្នុង Chromium ៖ ៥ សំណើ ➜
  OPTIONS **៥**; URL ថេរ + query ក្នុង header `X-Zoe-Query` ➜ OPTIONS **១** (⛔ `cache: 'no-store'` រំលង cache preflight ➜ ៥ វិញ)។
  ឥឡូវ APK ផ្ញើ query ក្នុង header ទៅ URL ថេរ (`nativeFunctionRequest()` ក្នុង `fetchWithTimeout` ជាច្រកតែមួយ) · Function អាន header
  នោះពេលគ្មាន query string (query string ឈ្នះ · `__proto__` មិនពុល · ពិដាន ២០៤៨ តួ) · `Access-Control-Max-Age` 600 ➜ **7200**
  (ពិដាន Chromium)។ web មិនប្រែ (same-origin គ្មាន preflight)។ ⛔ Function ចាស់ (មិនស្គាល់ header) ឆ្លើយ 400 ➜ App សាក URL
  មាន query ម្តង ហើយចងចាំ (`lookupState.nativeQueryHeaderUnsupported`) ➜ APK ថ្មីមិនខូចពេល Netlify មិនទាន់ deploy។

#### អ្នកយាម

- `zto-proxy-test` ផ្នែក ២ខ (Function ៖ header ≡ query · query ឈ្នះ · `__proto__` · ពិដាន · Max-Age 7200 ➜ មុនកែធ្លាក់ ៥) ·
  `ZoeW/tests/native/zto-preflight.test.ts` (១០ ៖ APK ➜ URL ថេរ · web/គ្មាន header/OPTIONS warm-up/origin ផ្សេង ➜ មិនប្រែ · ផ្លូវបម្រុង ៣
  ករណី · mutation «`fetchWithTimeout` ត្រឡប់ទៅ `resolveNativeApiUrl`» ➜ ធ្លាក់) · `network-timeout-test` ៖ ច្បាប់ «`fetch(` តែក្នុង
  `fetchWithTimeout`» ឥឡូវរាប់តាម **រចនាសម្ព័ន្ធ** (តួ function) មិនមែនផ្គូផ្គងអក្សរ `fetch(url, opts)`។
- `panel-motion-test` ផ្នែក ៨ ៖ trace ពិតពេលហូត ➜ សមាមាត្រ object ដែល dirty ត្រូវ < ៥០% (មុនកែ **៩៧.៨%** ធ្លាក់ ៣/៣ viewport ·
  ក្រោយកែ ៥៣/៥៣)។ checker តំបន់ហាមចូលទាំងអស់ឆ្លង ៖ `gesture-test` · `ios-panel-glide-test` · `panel-snap-ownership-test` ·
  `phone-search-swipe-test` · `page-nav-test` · `layout-check` · `history-menu-dismiss-test`។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ⛔ **សាកលើ iPhone (PWA) និង Android (PWA + APK) ពិត** (merge រួចមុនការសាក · តំបន់ហាមចូល ៖ ចលនាផ្ទាំង) ៖ ហូតប្រអប់ប្រវត្តិឡើង/ចុះច្រើនដង ·
  រមូរតារាងក្នុងរបៀបពង្រីក · ទាញចុះដើម្បី Refresh (PTR) · ប្តូរទំព័រ ២ · ពិនិត្យថាជួរចុងក្រោយមិនជាប់ក្រោមរបា Tab។
- ⛔ **Netlify ត្រូវ deploy មុនចែក APK ថ្មី** (Function ស្គាល់ `X-Zoe-Query`) — ✅ ការ merge PR #260 deploy Netlify រួច ➜ build APK ពី `main`។
- វាស់លើ APK ពិតក្រោយ deploy ៖ ស្កេន ZTO ត្រូវចុះមកជិត PWA (០.៦–០.៨ វិ.) ក្រៅពីការស្កេនដំបូងក្នុងរយៈ ២ ម៉ោង។
- គ្មាន Firebase rules · គ្មាន env ថ្មី។

### [2.42.8] — 2026-09-28 · ZoeW · ZoeKeyGen ៖ Deep audit session/race · timeout ពិត · Service Worker (merge រួចក្នុង PR #259)

**ZoeW `2.42.8` (`zoew-v235`) · ZoeKeyGen `2.20.6` (`zoekeygen-v105`)**។ មូលដ្ឋានវាស់៖ commit `443e4151c6395b30d0c6a351c1889e3d6a1d164e`។

- **ZTO ចម្លើយយឺតឆ្លង session/config**៖ សាលក្រម និងបញ្ជីអតិថិជនអាចត្រឡប់ចូល state/storage ក្រោយ logout។ ការបរាជ័យចាស់ក៏អាចដោះសោការទាញថ្មី។
  ការងារនីមួយៗចាប់ generation របស់ session/auth/config និង database; ពិនិត្យក្រោយ `await` និងមុនការសរសេរ។ សម្អាត timer និងសាលក្រមពេលប្ដូរ config។
  គ្របការទាញបញ្ជី ការពិនិត្យ signed និងការនាំចូលជាបាច់; ការងារចាស់មិនបង្ហាញ toast ឬប្ដូរ lock របស់ការងារថ្មី។
- **Registry និង ledger ឆ្លង database**៖ late claim/retry អាចដោះ barcode នៅ project ថ្មី; ការតម្រឹមថ្ងៃ/ខែ និងសំណងអាចប៉ះ ledger ថ្មី។
  វាស់មុនកែ៖ សំណង scan ចាស់ធ្វើឲ្យប្រាក់ក្នុងសតិ project ថ្មី **100 ➜ 95**។ ការកែចង callback/retry នឹង database និង auth generation ដើម។
  ការស្កេនដែលបានចាប់ផ្តើមសរសេររួចមិនត្រូវបញ្ច្រាសដោយសារតែ timeout ទេ; សាលក្រម `disconnect` នៅតែ `applied / not-applied / unknown`។
- **Firebase outcome read ជាប់លើ token**៖ `getIdToken()` ព្យួរអាចរំលងពិដានអាន ៨ វិ. និងសរុប ៦០ វិ.។ ពិដានថ្មីគ្រប token + fetch + body និងថវិកាសល់ពិត។
  token មកយឺតមិនបង្កើតសំណើក្រោយ timeout; ការរង់ចាំមិនបន្តទៅ auth session ថ្មី។
- **SW របស់ App ទាំង ២**៖ deploy probe/revalidation ដែលគ្រាន់តែ abort អាចទុក `waitUntil` ជាប់។ Promise ឥឡូវ settle ក្នុង ៦ វិ. ទោះគ្មាន AbortController
  ឬ fetch/body មិនស្តាប់ abort; response headers ដែលមកក្រោយ timeout មិនសរសេរ cache។ HTML ដែលដំឡើងរួចមិន revalidate ទៅកំណែថ្មីក្នុង cache ចាស់។
- **Capacitor Android listener**៖ listener មួយបដិសេធក្នុង `Promise.all` ធ្វើឲ្យ handle ផ្សេងគ្មានការសម្អាត។ ចុះ cleanup តាម handle នីមួយៗ
  ពេលវាមកដល់ និងមិនឲ្យ callback ឬ native style បន្តក្រោយ scope dispose។ តេស្តទាំង ២ ធ្លាក់មុនកែ និងឆ្លងក្រោយកែ។
- **Firebase project switch**៖ retry queue និងសាលក្រម ZTO ដែលមានស្រាប់ក៏ត្រូវសម្អាត មុនភ្ជាប់ project ថ្មី; តេស្តហៅ `initFirebase()` ពិត។
- **Dependency**៖ pin `xcode > uuid` ទៅ `11.1.1` តាម scoped override ដើម្បីដក advisory `GHSA-w5hq-g745-h8pq` ពី build tooling។
  បានសាក `require('xcode')` និង `generateUuid()` ពិត; មិន downgrade Capacitor CLI។
- **ឯកសារ**៖ កែ CLAUDE.md ដែលណែនាំឲ្យជឿ checker បៃតង និងមិនអានកូដ; កែពិដាន Netlify ដែលច្រឡំ synchronous នឹង streaming។
  កែ DEVELOPMENT/PARITY មិនឲ្យកាតាឡុក ១០០% ក្លាយជា behavioral coverage ១០០%; ដក pragma TypeScript ដែលមិនមាន។
  ការយោងកំណែ App និង cache ស៊ីនឹងកូដ។ ពិនិត្យ inventory `.md` ទាំង ២២; archive ជាប្រវត្តិ មិនយកមកអះអាងអំពីកូដបច្ចុប្បន្ន។

#### ភស្តុតាងតេស្ត

- តេស្ត regression ៦ ឯកសារក្នុង `ZoeW/tests/` នាំចូល module/SW ពិត។ លើ tree មុនកែ៖ **២៧ ធ្លាក់ · ២ ជោគជ័យ / ២៩** (exit 1)។
  អ្វីដែលក្លែងគឺព្រំដែន network/Firebase/Capacitor bridge និង timer ដើម្បីបង្ខំ race; មិនក្លែង function ដែលត្រូវវាស់។
- ក្រោយកែ regression ទាំង **២៩ / ២៩** ឆ្លងកាត់។
- **Local CI គ្រប ១៨៤ gates** របស់ `run-all.sh`៖ រួមលទ្ធផលពីការរត់ ២ ផ្នែកដែលបានបន្តក្រោយ session ផ្អាក និងការរត់ checker ដែលធ្លាក់ឡើងវិញ។
  លទ្ធផលចុងក្រោយគ្រប់ gate ជោគជ័យ; គ្មាន SKIP ឬ partial pass។ ប្រើ `CRUD_FLOW_STRICT=1`, `VERSIONSCOPE_STRICT=1`, `MONEYGUARD_STRICT=1`។
  RTDB emulator ពិត ៦ checker ឆ្លង **៣៤៦ assertions**; Chromium ពិតគ្រប offline/online, SW, retry/timeout, XSS/CSP, app lock, listener leak និង performance។
- `zoew-suite-test.js` ឆ្លងជាឯករាជ្យ (exit 0)៖ **១៤ npm tasks** រួម typecheck, lint, Vitest, parity, web build, smoke, Android config, native bridge និង cleanup rules។
  `npm ci`, `npm run android:sync` និង `npm audit` បានរត់ពិត; audit ចុងក្រោយ **០ vulnerability**។ បរិស្ថានវាស់៖ Node 24 · Chromium 153 · RTDB emulator 4.11.2។
- ការរត់ដំបូងឃើញកំហុសបរិស្ថាន ២៖ Node Firebase SDK មិនគោរព bypass proxy សម្រាប់ loopback និង WASM ក្នុង oracle ដើមខ្វះ។
  តេស្ត `emu/tx-disconnect` រត់ SDK ទៅ `127.0.0.1` ផ្ទាល់ដោយ `env -u HTTP_PROXY -u http_proxy` រួចឆ្លង **២៥ assertions**។
  WASM oracle ទាញពី `zxing-wasm@3.1.3` ហើយផ្ទៀងផ្ទាត់ Git blob **`8f72ed6ac38fe375787ba13d71c7872bbaa7f1a7`** ស្មើ commit ដើម មុនរត់ suite ឡើងវិញ។
- Fixture VM ចាស់បន្ថែម auth generation និង dependency របស់ session; assertions ចាស់រក្សាទុក។ បានស្រង់ `money-core.js` ឡើងវិញ; byte នៅដដែល (ការកែ session មិននៅក្នុង core ដែលឧបករណ៍នោះស្រង់)។
- `cleanup-clock-guard-test.js` និង `restore-marker-hygiene-test.js` ធ្លាប់រាយបៃតង ខណៈ log មាន `ReferenceError` ដែល catch លាក់ទុក។
  បន្ថែមការអះអាងថាគ្មាន runtime error មិនបានរំពឹងទុក៖ មុនកែ fixture ទាំង ២ ក្រហមពិត; ផ្ទុក helper timeout/lock ពិតរួច ឆ្លង **១៧ និង ២៧** assertions។
- `comments.js` ធ្លាប់អាន JavaScript តាម cwd ទោះបានស្នើ root ផ្សេង និងមិនរាប់ parse error ជាការធ្លាក់។ តេស្តថ្មី ៣ ក្រហមមុនកែ ឆ្លងក្រោយកែ។
  ថត Cordova ដែល `cap sync` បង្កើតមិនត្រូវ strip marker; Gradle របស់គម្រោងនៅតែវាស់។ `repository-contract-test.js` ឆ្លង **៤៣** assertions។
  ទិដ្ឋភាព JSX សម្រាប់ audit ដែលបូក module ចូលគ្នាមាន import ស្ទួន; checker វាស់ TSX ប្រភពទាំងអស់ជំនួសការចាត់ទិដ្ឋភាពនោះជាកូដ ship។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- មិនកែ Firebase rules ក្នុងជុំនេះ។ merge/deploy រួចក្នុង PR #259។
- សាកលើ Android ពិត និង iPhone/PWA ពិត៖ network ប្ដូរ Wi-Fi/mobile/offline ខណៈ scan, ZTO និងការចាកចេញ/ចូលវិញ។
- គ្មាន live ZTO credential ឬ Android signing keystore ក្នុងបរិស្ថាន audit; មិនអះអាងថាតេស្តគ្រប់ឧបករណ៍ ឬបានចេញ signed APK។
- `npm run android:sync` បាន build web និង sync plugin ពិត។ ការសាក `./gradlew --no-daemon assembleDebug` ឈប់ពេលទាញ Gradle (`Network is unreachable`);
  URL redirect ទៅ GitHub distribution ក៏ timeout តាម proxy។ បរិស្ថាននេះមាន Java 17 និងគ្មាន Android SDK; release workflow ត្រូវការ Java 21 និង keystore ដើម។
- បើប្ដូរ Firebase project ខណៈ write កំពុង pending ត្រូវពិនិត្យទិន្នន័យ project ដើមក្រោយត្រឡប់មកវិញ៖ ការទប់ការសរសេរឆ្លង project
  មិនអាចធានាថា multi-step operation ដើមបានបញ្ចប់ទាំងអស់ក្រោយ logout ទេ។

### [2.42.7] — 2026-09-26 · ZoeW · ZoeKeyGen ៖ **Deep audit ៖ 🔴 ការសម្អាតដកលុយ ២ ដង · 🔴 barcode ស្ទួនក្រោយ `disconnect` · 🔴 ការដក ledger បាត់ក្រោយ `disconnect` · 🔴 SW លាយកំណែ ➜ ក្រៅបណ្តាញ App ស** · ការសម្គាល់ខលបាត់ · Sentry លេប id កញ្ចប់ (merge រួចក្នុង PR #256)

**ZoeW** (`zoew-v233` ➜ `zoew-v234`) · **ZoeKeyGen** (`zoekeygen-v103` ➜ `zoekeygen-v104` ៖ `error-reporting.js` ចែករំលែក · `sw.js`)។
⛔ **checker ១៧៧ បៃតងទាំងអស់ + `emu/*` ៦ បៃតង លើ tree មុនកែ** — កំហុសទាំង ៦ ខាងក្រោមគ្មានអ្នកវាស់សោះ។

#### 🔴 ១. ការសម្អាត ៧ ថ្ងៃ ដកលុយ ២ ដង (អ្នកស្តារ journal រត់ចំកណ្តាលការសម្អាតដែលនៅរស់)

- **អ្វីដែលអ្នកប្រើអាចជួប** ៖ បណ្តាញយឺត/ដាច់មួយភ្លែតខណៈការសម្អាត «ផុតកំណត់» កំពុងសរសេរធុងសំរាម ➜ វដ្ត ៦០ វិ. ឬការត្រឡប់មក App
  (`visibilitychange`) ឬ tab ទី ២ លើឧបករណ៍ដដែល រត់ `resumeInterruptedCleanups()` ➜ វាឃើញធាតុ journal `moved` ដូចការរំខាន ➜ សរសេរ
  ធុងសំរាមម្តងទៀត ហើយ **ដកលុយ** ➜ ពេលការសរសេរដើមចុះ ការសម្អាតដើមក៏ដកលុយដែរ ➜ **ស្ថិតិប្រាក់ និងចំនួនកញ្ចប់ដក ២ ដង**។
- **វាស់បាន** (`cleanup-interrupt-atomicity-test` ផ្នែក ៥ជ · ការសម្អាតពិតលើ sandbox ពិត) ៖ ថ្ងៃ **$236.24 ➜ $214.10** (ត្រូវ $225.17) ·
  ចំនួន **54 ➜ 48** (ត្រូវ 51) · ledger ខែដូចគ្នា។
- **ការកែ** ៖ `withCleanupEntryOwnership()` ជាច្រកទ្វារតែមួយរបស់អ្នកស្តារ ៖ `cleanupJournalLive` (ការសម្អាតដែលនៅរស់ក្នុង page ដោះក្នុង
  `finally`) · **Web Locks** `zoew-cleanup-live-<id>` ឆ្លង tab (browser ដោះសោពេល tab ស្លាប់ ➜ ការរំខានពិតនៅតែត្រូវបញ្ចប់) · fail-open
  ពេលគ្មាន API (ឥរិយាបថដើម) · អ្នកស្តារអានធាតុ **ស្រស់** ពី journal ក្រោយបានសិទ្ធិ (មិនមែនច្បាប់ចម្លងចាស់ពីដើមជុំ)។
- **អ្នកយាម** ៖ ផ្នែក ៥ជ (tab ដដែល ១ ដង · ៣ ដង) · ៥ឈ (tab ២ ជាមួយ Web Locks ក្លែង ៖ tab រស់ ➜ មិនប៉ះ · tab ស្លាប់ ➜ ត្រូវបញ្ចប់ ហើយដក ១ ដង)
  ➜ **ធ្លាក់ ១៤ លើ tree មុនកែ** · `money-guardian-test` mutation ថ្មី (ដកច្រកទ្វារ) ➜ ក្រហម។

#### 🔴 ២. barcode ស្ទួន ➜ COD បូក ២ ដង (registry ក្រោយ `disconnect` · ការថយក្រោយពី 2.42.6)

- wrapper `disconnect` (2.42.6) សម្រេច «អនុវត្តរួច» ពេលតម្លៃ server **ស្មើតម្លៃដែលផ្ញើ**។ registry សរសេរ **`true` ថេរ** ហើយ path នោះ
  គ្មាន listener ➜ SDK ពិតរត់ updater លើ cache ទទេ (`null`) ➜ ផ្ញើ `true` ➜ បើ barcode **ចុះឈ្មោះរួចដោយកញ្ចប់ផ្សេង** ហើយការតភ្ជាប់ដាច់មុន
  server ឆ្លើយ `datastale` ➜ REST ឃើញ `true` ➜ `'claimed'` ➜ ការស្កេនត្រូវរក្សាទុក ➜ **barcode ស្ទួន ➜ COD បូក ២ ដង** (ជាន់ទី ៤ ជាសាលក្រម
  server តែមួយ)។
- **ភស្តុតាង SDK ពិត** (`emu/tx-disconnect-emu-test` ផ្នែក គ ៖ Firebase 12.19 + emulator + proxy កាត់ put) ៖ updater ឃើញ `null` ទោះ server
  មាន `true` · `claimBarcodeInRegistry()` ពិតរបស់ App ឆ្លើយ **`claimed`** លើ tree មុនកែ។
- **ការកែ** ៖ `txOutcome: 'applied'` លើ registry ➜ **`unknown`** (ច្បាប់ «ផ្ទៀងផ្ទាត់មិនបាន ≠ គ្មានស្ទួន» ៖ អន្ទាក់កូនសោកំព្រាថ្លៃតិចជាងលុយស្ទួន)។
  ⛔ ច្បាប់ទូទៅ ៖ «ស្មើតម្លៃដែលផ្ញើ» ជាភស្តុតាងតែពេលតម្លៃនោះជារបស់អ្នកសរសេរម្នាក់ (token · ទិន្នន័យកញ្ចប់)។
- **អ្នកយាម** ៖ `tx-outcome-test` ផ្នែក ៥ (ធ្លាក់ ៣ មុនកែ) · `emu/tx-disconnect-emu-test` ផ្នែក គ (ធ្លាក់ ១ មុនកែ) · `money-guardian-test`
  mutation ថ្មី ➜ ក្រហម។

#### 🔴 ២ខ. ការដក ledger បាត់ ពេលឧបករណ៍ ២ ដកចំនួនដូចគ្នា + `disconnect` (ថ្នាក់ដដែលនឹង ២ លើ ledger ថ្ងៃ/ខែ)

- **អ្វីដែលអ្នកប្រើអាចជួប** ៖ ឧបករណ៍ ២ ដក (ដក barcode · ការសម្អាត ៧ ថ្ងៃ) **ចំនួនដូចគ្នាបេះបិទ** (cod · dod · count) លើថ្ងៃដដែល ក្នុងពេលជិតគ្នា
  ហើយការតភ្ជាប់របស់ម្ខាងដាច់មុន server ឆ្លើយ ➜ wrapper អាន REST ឃើញតម្លៃ **ស្មើតម្លៃដែលខ្លួនផ្ញើ** (តែជារបស់ឧបករណ៍ផ្សេង) ➜ ជឿ «applied» ➜
  ការដកមួយបាត់ ➜ **ចំណូល និងចំនួនកញ្ចប់លើស** ជាអចិន្ត្រៃយ៍។
- **វាស់បាន** ៖ `tx-outcome-test` ផ្នែក ៤ខ ៖ ឧបករណ៍ផ្សេង 100 ➜ 95 + ការដករបស់យើង ➜ ថ្ងៃនៅ **95** (ត្រូវ 90) · `emu/tx-disconnect-emu-test` ផ្នែក ឃ
  (SDK ពិត + emulator + proxy ដែលសរសេរតម្លៃរបស់ឧបករណ៍ផ្សេង មុនកាត់ put របស់យើង) ➜ `committed: true · txOutcome: 'applied'` លើ tree មុនកែ។
- **ការកែ** ៖ `runLedgerTransaction()` (ចំណុចច្របាច់តែមួយនៃ `commitDailyRevenueDelta` · `commitMonthlyRevenueDelta`) ដាក់ **token `op` តែមួយក្នុងមួយការ
  សរសេរ** ក្នុង record ថ្ងៃ/ខែ ➜ តម្លៃដែលផ្ញើមានម្ចាស់តែម្នាក់ ➜ wrapper បែងចែកបាន។ rules (Business) ទទួល `op` ស្រេចចិត្ត (ខ្សែអក្សរ ៨–៤០ តួ)។
  ⛔ **មិនខូចទោះ Publish rules មុន ឬក្រោយ deploy** ៖ rules ចាស់បដិសេធ `op` (`$other`) ➜ `permission_denied` ➜ ផ្ញើម្តងទៀតគ្មាន `op`
  (ឥរិយាបថ 2.42.6 បេះបិទ · ចំណាយ ១ round trip បន្ថែមរហូតដល់ Publish)។ អ្នកអាន ledger ទាំងអស់អានតាមឈ្មោះវាល ➜ `op` មិនលេចក្នុងលេខណាមួយ។
- **អ្នកយាម** ៖ `tx-outcome-test` ផ្នែក ៤ខ (ធ្លាក់មុនកែ · ទិសផ្ទុយ «rules មិនទាន់ Publish ➜ ចុះ ១ ដង» · `op` លើថ្ងៃ និងខែ) · `emu/tx-disconnect-emu-test`
  ផ្នែក ឃ · `money-guardian-test` mutation «ledger ថ្ងៃលែងផ្ទុក `op`» ➜ ក្រហម · `revenue-rules-clamp-test` ដេរីវេ validator `op` ពី rules ពិត។

#### 🔴 ៣. Service Worker ចាក់ឯកសារ deploy ថ្មីចូល cache ចាស់ ➜ ក្រៅបណ្តាញ App ស

- deploy ថ្មី ➜ SW ថ្មី install ~៣ MB (បណ្តាញយឺត · អ្នកប្រើបិទ App កណ្តាលទី ➜ install ធ្លាក់) ➜ SW ចាស់នៅគ្រប់គ្រង ហើយការធ្វើឲ្យស្រស់ខាងក្រោយ
  សរសេរ `index.html` **ថ្មី** ចូល cache **ចាស់** ➜ HTML យោង `assets/index-<hash ថ្មី>.js` ដែលគ្មានក្នុង cache ➜ **បើកក្រៅបណ្តាញ App មិនចាប់ផ្តើម**
  (ថ្នាក់ដដែលនឹង `zxing-wasm.js` ថ្មី + `.wasm` ចាស់ ➜ `LinkError` ➜ iPhone ស្កេនមិនបាន តាមទ្វារទី ២)។
- **វាស់បាន** (Chromium ពិត · SW ពិត · គ្មាន route) ៖ cache `-a` ផ្ទុក HTML **B** · `index-…-b.js` ក្រៅបណ្តាញ **`ok: false`**។
- **ការកែ** ៖ `shellDeployIsCurrent()` (App ទាំង ២) ៖ ការធ្វើឲ្យស្រស់សរសេរតែពេល `sw.js` លើ server នៅជាកំណែ `CACHE_VERSION` ខ្លួនឯង (memo ៦០ វិ. ·
  ពិដានពេលដដែល · ធ្លាក់ ➜ មិនសរសេរ) ➜ deploy ថ្មីមកតាម install ជាក្រុម (atomic) តែមួយផ្លូវ · ការព្យាបាលក្នុង deploy ដដែល (ជុំទី ៤ ៖ B ➜ C) នៅដដែល។
- **អ្នកយាម** ៖ `sw-install-integrity-test` ជុំទី ៥ (ធ្លាក់មុនកែ · mutation «ដកច្រកទ្វារ» ធ្លាក់) · `adaptive-link-test` ស្រង់ helper ពិត (async)។

#### 🟠 ៤. ការសម្គាល់ «ខល» ពេលបណ្តាញដាច់ ➜ revert + «បរាជ័យ» (ការថយក្រោយពី 2.42.6)

- wrapper `disconnect` អាន REST រហូតដល់ ៦០ វិ. ពេលបណ្តាញដាច់ ➜ `dbOp` (១៥ វិ.) ផុតមុន ➜ «stalled» ➜ `patchHistoryItemFields()` revert +
  សារ «បរាជ័យ» ជំនួស **ការចូលជួរ** (កំហុស Sentry 2.20.1 ៖ ស្លាក «✔️ ខល» លោតត្រឡប់ ➜ ចុចខលលេខនោះម្តងទៀត)។ វាស់ (wrapper ពិត) ៖ ក្រៅបណ្តាញ
  និង `fetch` ធ្លាក់ ➜ `saved: false · queued: 0`; SDK ឆៅ (មុន 2.42.6) ➜ `queued`។
- **ការកែ** ៖ wrapper ចុះឈ្មោះ `transactionDisconnectPending(promise)` ខណៈកំពុងអាន server ➜ ពេល `dbOp` ផុត ការសម្រេចប្រើកំហុស `disconnect` ពិត
  ➜ ចូលជួរ (ច្បាប់ «តែ `disconnect` ចូលជួរ» នៅដដែល · ការព្យួរសុទ្ធនៅតែ revert — ទិសផ្ទុយមានអ្នកយាម)។
- **អ្នកយាម** ៖ `history-patch-retry-test` (wrapper ពិត ២ ស្ថានភាព + ទិសផ្ទុយ «ព្យួរសុទ្ធ») ➜ ធ្លាក់ ១០ មុនកែ · mutation «ចូលជួរលើការព្យួរណាក៏ដោយ» ធ្លាក់ ២។

#### 🟠 ៥. Sentry លេប id កញ្ចប់ (ការដក event ស្ទួន 2.42.6)

- ហត្ថលេខា = zone · context · message ➜ event លុយដដែលលើ **កញ្ចប់ផ្សេងគ្នា** ក្នុង ១០ នាទីត្រូវទប់ ➜ Admin មិនឃើញ `itemId` ទី ២ («ទិន្នន័យកញ្ចប់ …
  អាចនឹងបាត់! សូមប្រាប់ Admin») · `runTransactionResolved` រាយការណ៍ ១ ដង/path តែ path ទី ២ ត្រូវទប់។
- **ការកែ** (`error-reporting.js` App ទាំង ២ · byte-identical) ៖ អត្តសញ្ញាណ (`itemId` · `item` · `barcode` · `keyId` · `date` · `path`) ផ្សេងគ្នា ➜ ផ្ញើ
  (ពិដាន ៥/ហត្ថលេខា/បង្អួច) · ព្យុះលើ id ដដែលនៅតែទប់។ **អ្នកយាម** ៖ `sentry-load-race-test` ផ្នែក ៦ខ ➜ ធ្លាក់ ២ មុនកែ។

#### ឯកសារ

- `ZoeW/docs/TYPESCRIPT.md` យោង `byId()` · `src/core/dom.ts` · `elInput`/`elDiv` · `HistoryItem`/`BarcodeEntry` ដែល **លែងមាន** ➜ សរសេរឡើងវិញតាម
  `src/app/refs.ts` ពិត។ `CLAUDE.md` Runbook ៖ `money-guardian-test.js` រត់លើ repo React អាន `ZoeW/app.js` ដែលលែងមាន ➜ ផ្លាស់ `MONEYGUARD_STRICT=1`
  ទៅលើ `run-all.sh` · emulator ដែលបើកដោយ `setsid nohup … &` ងាប់ពេល shell call ចប់ (វាស់បាន) ➜ ត្រូវ `curl` មុន run-all។
  🔎 លិបិក្រមនៅចុងឯកសារនេះរាយ «ផ្នែក ២» សម្រាប់ checker **~១២០** ដែលមិនដែលលេចក្នុង `HISTORY.md` សោះ (ឧ. `boot-runtime` · `camera-resume-test`)
  ➜ session ក្រោយរកការពន្យល់នៅកន្លែងខុស ➜ ជួរ `HISTORY.md` ដេរីវេឡើងវិញពីការលេចពិត (ឈ្មោះពេញ ឬឈ្មោះគ្មាន `-test`) · `—` = ការពន្យល់រស់តែក្នុង archive។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- ⛔ **Firebase rules (Business) ប្រែ** ៖ បិទភ្ជាប់ `firebase-database.rules.json` ចូល Firebase Console (Project អាជីវកម្ម) ➜ Realtime Database ➜ Rules ➜
  **Publish** (វាល `op` ក្នុង `zoew_daily_revenue_cod_dod/$date` និង `zoew_monthly_revenue_cod_dod/$month`)។ លំដាប់មិនសំខាន់ ៖ មុន Publish App ដើរដូច 2.42.6
  (ចំណាយ ១ round trip បន្ថែមលើការសរសេរ ledger) · ក្រោយ Publish ការការពារ ២ខ សកម្ម។ ⛔ rules របស់ License (ZoeKeyGen) **មិនប្រែ**។
- គ្មាន env ថ្មី ➜ merge ពេលម្ចាស់គម្រោងស្នើ ➜ Netlify build ខ្លួនឯង (`zoew-v234` · `zoekeygen-v104`)។
- **សាកលើឧបករណ៍ពិត (ស្រេចចិត្ត)** ៖ បើក App (online) ➜ បិទ WiFi/Data ➜ បិទ App ទាំងស្រុង ➜ បើកវិញក្រៅបណ្តាញ ➜ App ត្រូវបើក ហើយស្កេនបាន។
- Sentry ៖ event `zone: money` ដដែលលើកញ្ចប់ផ្សេងគ្នាឥឡូវលេចដាច់ពីគ្នា (រហូតដល់ ៥ ក្នុង ១០ នាទី)។

### [2.42.6] — 2026-09-26 · ZoeW · ZoeKeyGen ៖ **Deep audit ៖ 🔴 transaction `disconnect` ដែល server អនុវត្តរួច** · Sentry លែងទទួលព្យុះកំហុសដដែល · កូដ React គ្មាន comment (merge រួចក្នុង PR #254)

#### 🔴 `disconnect` ≠ «មិនបានអនុវត្ត» (កំហុសលុយ · checker ១៨២+ បៃតងលើ tree នោះ)

- **អ្វីដែលអ្នកប្រើអាចជួប** ៖ បណ្តាញដាច់ចំពេលការសម្អាតស្វ័យប្រវត្តិ (២ ម៉ោង/៧ ថ្ងៃ) ឬការកែទឹកប្រាក់ ➜ Firebase SDK បដិសេធ
  transaction ដោយ `disconnect` ខណៈ server **commit រួច** (ack បាត់ក្នុងផ្លូវ) ➜ App ចាត់ទុកថា «មិនបានកើត» ៖ ការសម្អាត **មិនសរសេរ
  ធុងសំរាម** (កញ្ចប់បាត់ពីទាំងប្រវត្តិ ទាំងធុងសំរាម) ហើយ **មិនដកលុយ** · ការកែ ledger ទៅតម្លៃពិត **ដក ២ ដង**។
- **ភស្តុតាង** ៖ SDK Firebase ពិត (កំណែដដែលនឹង CDN `12.19.0`) + RTDB emulator ពិត + proxy TCP ដែលកាត់ការតភ្ជាប់ **ក្រោយ** frame
  `put` របស់ transaction ទៅដល់ server ➜ promise reject `disconnect` ខណៈ server ប្រែរួច។ ⛔ `fb.get()` មិនអាចជាអ្នកសម្រេច ៖ listener
  សកម្ម ➜ វាឆ្លើយពី cache ក្នុងស្រុក។ លើកូដមុនកែ (`tx-outcome-test`) ៖ កញ្ចប់ **មិនចូលធុងសំរាម** · ledger ថ្ងៃ/ខែ **នៅ 100**
  (ត្រូវ 92.25) · ចំនួនកញ្ចប់ **20** (ត្រូវ 18) · `correctRevenueLedgerToActual` ៖ **100 ➜ 90** (ត្រូវ 95) · Sentry money ក្លែង
  «Automatic cleanup transaction failed»។
- **ការកែ** (ចំណុចច្របាច់តែមួយ ⛔ មិនមែនកែកន្លែងហៅ ៤០+) ៖ `src/services/tx-outcome.ts` ➜ `withTransactionOutcomeResolution()` រុំ
  `fb` ម្តងក្នុង `initFirebase()` ➜ រាល់ `fb.runTransaction` ដែលបដិសេធ `disconnect` អាន server តាម **REST + ID token**
  (`cache: 'no-store'` · host ត្រូវស៊ីនឹង `databaseURL` · ពិដានការអាន ៨ វិ. · ការព្យាយាមមានព្រំដែន ៣០ ដង/៦០ វិ.) ហើយប្រៀបនឹងតម្លៃ
  **ដែលបានផ្ញើ** និង **មុនផ្ញើ** (ថតមុន updater កែ `current`) ៖ `applied` ➜ `{ committed: true, txOutcome: 'applied' }` · `not-applied`
  ➜ បដិសេធដដែល (សម្គាល់ `txOutcome` ➜ ការសម្អាតលែងផ្ញើ Sentry money ក្លែង) · `unknown` ➜ បដិសេធ + Sentry `zone: 'money'` ១ ដង/path។
  ការសម្អាតដែល commit យឺត ពិនិត្យ `cleanupClaimAccountedElsewhere()` (ធុងសំរាមលើ server · barcode ក្នុងធុងសំរាមថ្មីៗ) មុនសរសេរ ➜
  ឧបករណ៍ ២ មិនសរសេរធុងសំរាម/ដកលុយស្ទួន។
- **អ្នកយាម** ៖ `tx-outcome-test` (sandbox ពិត · ការសម្អាត ២ ផ្លូវ · ledger · `unknown` · ការអានធ្លាក់មានព្រំដែន · wrapper អាន
  `runTransaction` ពេលហៅ) ➜ **ធ្លាក់ ១៩ លើកូដមុនកែ** (`❌ ធ្លាក់ 19 / ok 20`) · `emu/tx-disconnect-emu-test` (SDK ពិត · emulator ពិត · ករណី applied និង
  not-applied) ➜ **ធ្លាក់ ៣ លើកូដមុនកែ** · `money-guardian-test` mutation ២ ថ្មី (ដកការអាន server · ដកការពិនិត្យម្ចាស់ធុងសំរាម) ➜ ក្រហមពិត។

#### Sentry ៖ ព្យុះកំហុសដដែល

- listener ដែល rules បដិសេធ (`permission_denied`) ត្រូវភ្ជាប់ឡើងវិញតាមជណ្តើរស្តារ ➜ **រាល់ជុំ × រាល់ path** ផ្ញើ event ទៅ Sentry
  (វាស់ ៖ ៦ ជុំ × ៧ path = **៤៩ event** ក្នុងការដាច់តែមួយ ➜ ស៊ីកូតា Sentry · បាំងកំហុសពិត)។ ការកែ ៖ `dbListenerReportedFailures` ➜
  **១ ដង/path/ការដាច់** (លុបពេល path រស់វិញ ➜ ការដាច់ថ្មីរាយការណ៍ម្តងទៀត) ➜ **៧**។ បូក `ZoeErrors.capture()` ក្នុង `error-reporting.js`
  (App ទាំង ២ · byte-identical) ដក event ដដែល (zone · context · message) ក្នុង ១០ នាទី ហើយភ្ជាប់ `suppressedRepeats` ទៅ event បន្ទាប់
  (ពិដាន ២០០ signature · នាឡិកាថយក្រោយ ➜ fail-open)។ អ្នកយាម ៖ `connection-recovery-test` ផ្នែក ៣ខ (មុនកែ ៖ `captures: 49`) ·
  `sentry-load-race-test` ផ្នែក ៦។

#### ZTO parity · សុវត្ថិភាព · ឯកសារ vanilla · comment

- **ZTO ធៀប ZoeW vanilla** ៖ `logic:check` (តួ function ទាំងអស់ដូចដើម លើកលែងការកែដែលមានហេតុផល) + ការប្រៀបថេរ ZTO ទាំងអស់ ➜
  **ស៊ីគ្នា** (គ្មានការកែ)។ **សុវត្ថិភាព** (XSS · secret · CSP · ការលាក់ Sentry) ៖ គ្មានចន្លោះថ្មី — event `unknown` ផ្ទុកតែ `pathname`
  ហើយ ID token ក្នុង `?auth=` របស់ការអាន REST (breadcrumb `fetch`) ត្រូវលាក់ដោយ `SECRET_PARAM_PATTERN` ស្រាប់ (`secret-hygiene` វាស់ករណីនេះ)។
- **ឯកសារសម័យ vanilla** ៖ ដក `ZoeW/scripts/package.sh` + script `npm run package` (ខ្ចប់ zip សម្រាប់ប្រគល់ពីសម័យផ្ទេរ · គ្មានអ្នកប្រើ)។
  ⛔ `.original/` · `parity-*` · `logic-identity` · `old-app.mjs` **នៅដដែលដោយចេតនា** ៖ ពួកវាជាអ្នកយាម parity ដែលរត់ក្នុង `verify`/`parity:all`។
- **comment** (សំណើម្ចាស់គម្រោង) ៖ លុប **៧០១** comment ក្នុង **១១៥** ឯកសារ (`src/**` · Netlify Function · config) និង HTML comment ៥
  ក្នុង `index.html` ទាំង ២ App។ `ts-comments` (ថ្មី) ៖ TypeScript AST ➜ លុប ➜ **esbuild compile មុន/ក្រោយត្រូវដូចគ្នាបេះបិទ** (ខុស ➜
  មិនប៉ះឯកសារ) · `/// <reference …>` រក្សា។ `comments` វាស់ប្រភព React (ដេរីវេពីទីតាំង root វាស់ ➜ baseline ក៏វាស់ដែរ · root វាស់ដែលរក
  ប្រភពមិនឃើញ = FAIL) · `strip-comments` សម្អាត React/HTML។ `repository-contract-test` ៖ TSX ពិត + ករណី ASI (comment មានបន្ទាត់ថ្មីក្រោយ
  `return`) ត្រូវ **បោះបង់** ➜ mutation «រំលងការផ្ទៀងផ្ទាត់ compile» ធ្លាក់។ ESLint `no-empty` ទទួល `allowEmptyCatch` (catch ទទេ = ការលេប
  ដោយចេតនា ដែលពីមុនមាន comment បំពេញ)។ ផ្ទៀងផ្ទាត់ ៖ `npm run verify` (tsc · eslint · slot · purity · vitest · build · parity · smoke ·
  sw · doc · android · native) · `logic:check` · `parity:dom/live/deep` · `rules:check` បៃតងទាំងអស់។
- **អក្សរថៃ** ៖ ម្ចាស់គម្រោងចាប់បានថាការសន្ទនាលាយពាក្យថៃ (U+0E00–U+0E7F · ស្រដៀងខ្មែរ ➜ រអិលកាត់ភ្នែក) ➜ `doc-scope-test`
  ស្កេនគ្រប់ឯកសារអត្ថបទក្នុង repo រួម `ZoeW/src/**` (វាស់ ៖ repo **០** ជួរ · commit **០**)។ probe ៖ អក្សរថៃក្នុង `docs/` ➜ FAIL ·
  ក្នុង `ZoeW/src` ➜ FAIL · root វាស់រកប្រភពមិនឃើញ ➜ FAIL · ថតទទេ ➜ FAIL · ទិសផ្ទុយ ៖ អក្សរខ្មែរមិនត្រូវចាប់។ ⛔ វាចាប់ខ្លួនវាលើក
  ដំបូង ៖ comment របស់ checker ដាក់ពាក្យថៃជាឧទាហរណ៍ ➜ ដកចេញ (probe សាងពី code point)។
- **comment ក្នុង Gradle** (សំណើម្ចាស់គម្រោង · ក្រោយ merge #254) ៖ លុប comment **២៦** ក្នុង `android/build.gradle` · `android/app/build.gradle` ·
  `android/gradle.properties`។ `ts-comments` មាន lexer Groovy (string · slashy regex · ការចែក) និង properties (ជួរបន្ត `\` មិនមែន comment) ➜
  token ក្រៅ comment ត្រូវដូចគ្នាមុន/ក្រោយ។ ⛔ ឯកសារដែល Capacitor សាងឡើងវិញ (header «DO NOT EDIT» ៖ `capacitor.build.gradle` ·
  `capacitor.settings.gradle`) **លើកលែង** ព្រោះ `cap sync` សរសេរវាវិញ។ ភស្តុតាង ៖ APK `clean assembleRelease --rerun-tasks` មុន/ក្រោយ ➜
  **SHA-256 ដដែល** (`8aed3e6c…86fc28` · ធាតុ ៩៤១ + CRC ដូចគ្នា) · `comments` ធ្លាក់លើ tree មុនសម្អាត (៨ · ៣ · ១៥) · fixture ក្នុង `repository-contract-test` ចាប់ mutation ២ (ដក slashy · ដក
  continuation)។ ⛔ កំណែមិនឡើង (Gradle មិនមែនកូដ ship របស់ web ➜ `version-bump-scope`)។
- `firebase@12.19.0` ចូល `devDependencies` របស់ ZoeW (SDK ពិតសម្រាប់ `emu/tx-disconnect-emu-test` · **មិន ship** — App ផ្ទុក SDK ពី CDN ដដែល)។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មានការកែ Firebase rules · គ្មាន env ថ្មី** ➜ merge ពេលម្ចាស់គម្រោងស្នើ ➜ Netlify build ខ្លួនឯង (`zoew-v233` · `zoekeygen-v103`)។
- **Sentry** ៖ event ថ្មីដែលអាចលេច ៖ `Transaction outcome unknown after disconnect` (`zone: money`) និង `Cleanup claim committed after
  disconnect but ownership unverified` — ⛔ វាមានន័យថា «ផ្ទៀងផ្ទាត់មិនបាន» ➜ ពិនិត្យ node នោះលើ Firebase Console (លុយមិនត្រូវប៉ះដោយ App)។
  event ដដែលៗឥឡូវមានវាល `suppressedRepeats` (ចំនួនដែលដកចេញក្នុង ១០ នាទី)។
- **សាកលើឧបករណ៍ពិត (ស្រេចចិត្ត)** ៖ បិទ WiFi ចំពេលកែទឹកប្រាក់ ➜ បើកវិញ ➜ លេខលើអេក្រង់ត្រូវស្មើ Firebase Console (មិនដក ២ ដង)។
- ✅ **តេស្តផ្សេងៗ (កំណែ 2.42.6/2.20.4 · ZoeKeyGen · View Source · APK · Sentry) — ម្ចាស់គម្រោងរាយការណ៍ថាដើរទាំងអស់**។ «View Source ៖ គ្មាន
  `<!--`» ៖ comment តែមួយដែលនៅសល់ (`This site is hosted on Netlify …` · `utm_source=ai-legible`) **Netlify បញ្ចូលនៅ Edge** ពេលផ្ញើទំព័រ
  មិនមែនមកពី repo (`index.html` ក្នុង repo និងលទ្ធផល build មាន `<!--` **០**) ➜ ⛔ កុំសរសេរ Edge Function ដើម្បីលុបវា (ហានិភ័យលើ SW · CSP ·
  ល្បឿន ដើម្បីអ្វីដែលគ្មានផលប៉ះពាល់)។ ZoeKeyGen មាន devtools guard ➜ ម្ចាស់គម្រោងចាត់ទុកចំណុចនោះបញ្ជាក់រួចតាម repo។
- ✅ **តេស្តលុយលើឧបករណ៍ពិត — ម្ចាស់គម្រោងបញ្ជាក់ថាជោគជ័យទាំងអស់** (បញ្ចូល · កែតម្លៃ · បិទ/បើក «យក» · ដក · ស្តារ · ការដាច់បណ្តាញ
  ចំពេលរក្សាទុក · លេខលើអេក្រង់ = Firebase Console រាល់ជំហាន)។ ⚠️ ជំហាន `disconnect` ដែលជោគជ័យ បញ្ជាក់ថា **គ្មានការថយក្រោយ** ប៉ុន្តែមិន
  បញ្ជាក់ថាការដាច់ចំចន្លោះមិល្លីវិនាទីនោះទេ ➜ ភស្តុតាងនៃការកែនៅតែជា `emu/tx-disconnect-emu-test` (SDK ពិត)។
- ⛔ សម្រាប់ developer ៖ `npm ci --prefix ZoeW` ម្តងទៀត (dependency `firebase` ថ្មី)។

### [2.42.5] — 2026-09-25 · ZoeW ៖ **🔴 hotfix ៖ iPhone ស្កេន Barcode មិនបាន ក្រោយ ZXing-WASM 3.1.4** · APK 2.42.4 build ក្នុង session · pin វិញ្ញាបនបត្រ keystore (merge #252)

#### 🔴 iPhone ស្កេនមិនបាន (របាយការណ៍ម្ចាស់គម្រោង ក្រោយ merge 2.42.4)

- **សញ្ញា** (Sentry breadcrumb) ៖ `LinkError: WebAssembly.instantiate(): Import #70 "a" "qa": function import requires a callable`
  ➜ `Aborted(…)`។ Android មិនប៉ះ ព្រោះវាប្រើ `BarcodeDetector` ផ្ទាល់ (មិនមែន ZXing) — iPhone គ្មាន API នោះ ➜ ពឹង ZXing តែម្យ៉ាង។
- **មូលហេតុវាស់បាន** ៖ `.wasm` 3.1.3 មាន import **៧៨** (#70 = `a.qa`) · 3.1.4 មាន **៧០** (គ្មាន #70) ➜ ឧបករណ៍ផ្ទុក
  **JS 3.1.4 + wasm 3.1.3**។ ឯកសារ ២ ក្នុង repo ស៊ីគ្នា (`scan-engine-test` បៃតង) ➜ ការលាយកើតពី **cache** ៖ `netlify.toml`
  ដាក់ `/*.wasm` ➜ `max-age=31536000, immutable` លើឈ្មោះ **គ្មាន hash** (`vendor/zxing_reader.wasm`) ខណៈ `/*.js` ➜ `no-cache`
  ➜ SW ថ្មី `cache.addAll(CORE_SHELL)` (cache mode លំនាំដើម) យក wasm ចាស់ពី HTTP cache ចាក់ចូល cache ថ្មី ហើយ
  `revalidateShell` ទាញពី HTTP cache ដដែល ➜ ពុលវាម្តងទៀតរាល់ពេលប្រើ។
- ⛔ **checker ១៨២ បៃតងទាំងអស់** លើ tree នោះ ៖ គ្មាននរណាវាស់ «ការ deploy ជាន់ HTTP cache ចាស់» ហើយ **`ctx.route()` របស់
  Playwright បិទ HTTP cache** ➜ checker SW ដែលមានស្រាប់ **មិនអាច** ឃើញថ្នាក់នេះទោះចង់ក៏ដោយ (វាស់ ៖ ជុំទី ៤ ថ្មីឆ្លងលើ tree ខូច
  រហូតដល់ដក `route` ចេញ)។
- **ការកែ** ៖ (១) `sw.ts` ៖ `FRESH = 'no-cache'` លើ install (`addAll` · `add`) · `revalidateShell` · ការទាញ shell ពេល cache
  miss ➜ SW **មិនពឹង header** (HTTP cache ចាស់លើឧបករណ៍មិនប្រែតាម header ថ្មីទេ) · (២) `netlify.toml` ៖ `/*.wasm` · `/*.png` ➜
  `no-cache` (ZoeKeyGen `/*.png` ដែរ · `immutable` នៅតែលើ `/assets/*` ដែលមាន hash ពី Vite) · (៣) `CACHE_VERSION` `zoew-v232` ➜
  ឧបករណ៍ដំឡើង SW ថ្មីដែលទាញ wasm ស្រស់ ហើយការទាញ `no-cache` ក៏ **ព្យាបាល** entry ចាស់ក្នុង HTTP cache ដែរ។
- **អ្នកយាម** ៖ `sw-install-integrity-test` ជុំទី ៤ (Chromium ពិត **គ្មាន route** · server បម្រើ wasm ជាមួយ `immutable` + ETag
  ដោយចេតនា ➜ វាស់ SW តែម្នាក់ឯង) ៖ SW ថ្មីត្រូវទាញ B ពី server (មុនកែ ៖ **A · serverHits 0**) · revalidate ត្រូវនាំ C (មុនកែ ៖
  ជាប់ A) ➜ **ធ្លាក់ ២ មុនកែ · ឆ្លងក្រោយកែ**។ `netlify-config-scope-test` ផ្នែក ៥ ៖ cache យូរ តែលើឯកសារដែលឈ្មោះមាន hash
  (ដេរីវេពីឯកសារ ship ពិត · ទិសផ្ទុយ ៖ `/assets/*` ទទួលបាន) ➜ **ធ្លាក់ ៣ លើ `netlify.toml` របស់ `main`**។
- **CI ពេញចាប់ checker មួយដែលបាក់** ៖ `adaptive-link-test` ស្រង់ `revalidateShell()` ចូល `vm` ➜ `FRESH` ថ្មីជាអថេរសេរី ➜
  `ReferenceError` (សញ្ញាល្អ ៖ checker រត់កូដ ship ពិត)។ ការកែ ៖ ថេរខ្សែអក្សរកម្រិតកំពូលដែល `revalidateShell()` យោង ត្រូវ **ស្រង់ពី
  `sw.js` ពិត** (មិនចាក់ក្នុង sandbox) · regex atomic ត្រូវទទួល `addAll(CORE_SHELL.map(…))` ដូច `sw-install-integrity-test`។

#### APK 2.42.4 build ក្នុង session · keystore · pin

- **build** (ក្រោយម្ចាស់គម្រោងបើក `dl.google.com` ក្នុង network របស់ environment — ការកែចូលជាធរមានលើ container ដែលកំពុងរត់
  ក្រោយរង់ចាំប៉ុន្មាននាទី ៖ ស្ទង់រាល់ ៣០ វិ. ៤០៣ ➜ ២០០) ៖ cmdline-tools 23.0 (SHA-1 ផ្ទៀងនឹង repository XML) ➜
  `platforms;android-36` · `build-tools;36.0.0` ➜ `android:sync` ➜ `gradlew assembleRelease` ក្នុង **ច្បាប់ចម្លង** នៃ commit។ វាស់លើ
  APK ពិត ៖ `com.zoesystem.zoew` · `2.42.4` · versionCode `2042004` · minSdk 24 · targetSdk 36 · `allowBackup=false` · គ្មាន bridge
  វាស់ · `apksigner verify` ✅ (v2 · signer ១)។ APK + `.sha256` ផ្ញើជូនម្ចាស់គម្រោងក្នុងការសន្ទនា (session គ្មាន API បង្កើត Release)។
- **keystore ថ្មី** (ម្ចាស់គម្រោងជ្រើស ៖ «បង្កើត keystore ថ្មី») ៖ PKCS12 · RSA 4096 · អាយុ ៣០ ឆ្នាំ · `CN=ZoeW, O=Zoe System, C=KH` ·
  alias `zoew` ➜ sign តាម **ផ្លូវ Gradle ដដែលនឹង workflow** (env `ZOEW_KEYSTORE_*`)។ keystore + ឯកសារ secret ៤ ផ្ញើជូនម្ចាស់គម្រោង
  ⛔ **មិនចូល repo · មិនចូល PR**។
- **pin វិញ្ញាបនបត្រ** `ZoeW/android/release-cert.sha256` (SHA-256 `c2a1b725…aecabd` · មិនសម្ងាត់) ៖ workflow ប្រៀបវិញ្ញាបនបត្រ APK
  (signer ១ តែមួយ) នឹង pin ក្រោយ `apksigner verify` មុន Release ➜ secret ដែលចង្អុលទៅ keystore ផ្សេង = **គ្មាន Release**។ ច្បាប់
  «keystore តែមួយជារៀងរហូត» ធ្លាប់ជា **អត្ថបទ** ➜ ឥឡូវជា **ឧបករណ៍**។ វាស់ ៖ ជំហាន shell ពិត (`bash -e` ដូច Actions) លើ output
  `apksigner` ពិត ➜ keystore ត្រឹមត្រូវ **exit 0** · keystore ផ្សេង **exit 1** · មិន sign **exit 1**; `android:check` ផ្នែក ៨ ថ្មី ២ ➜
  probe **៥/៥** ធ្លាក់។
- **អន្ទាក់ build ដែលអ្នកយាមចាប់បាន** ៖ `node_modules` ជា **symlink** ក្នុងច្បាប់ចម្លង ➜ `cap sync` សរសេរផ្លូវ **absolute** ចូល
  `capacitor.settings.gradle` ➜ `android:check` ផ្នែក ៥ ធ្លាក់ **៧** (ត្រឹមត្រូវ) · Maven Central ឆ្លើយ `429` ➜ រត់ Gradle ម្តងទៀត។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **merge PR ឆាប់តាមដែលអាច** ➜ Netlify build ខ្លួនឯង។ គ្មានការកែ Firebase rules · គ្មាន env ថ្មី។
- ✅ **iPhone ស្កេនបានវិញ** — ម្ចាស់គម្រោងបញ្ជាក់លើ iPhone ពិត ក្រោយ merge #252 (deploy `zoew-v232`)។
- ✅ **APK ZoeW លើ Android ពិត** (sign ដោយ keystore `CN=ZoeW`) ៖ ស្កេន · ចូលប្រព័ន្ធ · PTR · Export ដើរទាំងអស់ — ម្ចាស់គម្រោងបញ្ជាក់។
- ✅ **ZoeKeyGen ៖ ប៊ូតុងចូល/ចាកចេញ ១ ចុច = ១ សកម្មភាព** (`navAuthFlow()`) — ម្ចាស់គម្រោងបញ្ជាក់លើឧបករណ៍ពិត។
- ✅ **ZoeKeyGen ៖ Reconfig កណ្តាលការផ្ទុក SDK — បិទដោយអ្នកយាម ជំនួសការសាកលើឧបករណ៍** (ការសម្រេចរបស់ម្ចាស់គម្រោង ៖
  បណ្តាញពិតមិនដែលយឺតល្មម ហើយការសាកត្រូវ paste Config របស់ Project ផ្សេងចូលឧបករណ៍អ្នកលក់ពិត)។ `connection-recovery-test`
  ផ្នែក ១៥ខ រត់ `initFirebase()` ពិតរបស់ ZoeKeyGen ដោយទប់ SDK កណ្តាលការផ្ទុក ➜ វាស់បាន ៖ ដក
  `if (currentConfig !== savedConfig) initFirebase();` ចេញ ➜ **ធ្លាក់** (`got: ["https://old.example"]` · exit 1) · ទិសផ្ទុយ
  (config មិនប្រែ ➜ init តែ ១ ដង) នៅបៃតង។
- **iPhone ដែលស្កេនមិនបាន** ៖ បើក App ម្តង (SW ថ្មីដំឡើងខាងក្រោយ) ➜ **បិទ App ទាំងស្រុង** (អូសចេញពីបញ្ជី App) ➜ បើកម្តងទៀត ➜
  ស្កេនសាក។ ⛔ កុំ «លុប Website Data» ជាដំណោះស្រាយដំបូង — វាលុប PIN · ការចូល · កៅអី License (Device ID ថ្មី ➜ ត្រូវដោះក្នុង ZoeKeyGen)។
- **App Android** ៖ ដំឡើង `ZoeW-2.42.4.apk` លើ Android ពិត ➜ ស្កេន · ចូលប្រព័ន្ធ · PTR · Export · ⛔ ZoeW Android ចាស់ដែល sign ដោយ
  key ផ្សេង (ឧ. build ពី Android Studio) ➜ លុប App ចាស់ម្តង ➜ ដោះកៅអី License ក្នុង ZoeKeyGen។
- ⛔ **keystore** ៖ រក្សា `zoew-release.jks` + `ZOEW-KEYSTORE-SECRETS.txt` (Password Manager + ច្បាប់ចម្លង ២ កន្លែង) · បាត់ = App
  ដំឡើងជាន់មិនបានទៀត។ **កំណត់ secret ៤** (`ZOEW_KEYSTORE_BASE64` · `ZOEW_KEYSTORE_PASSWORD` · `ZOEW_KEY_ALIAS` · `ZOEW_KEY_PASSWORD`)
  **មុន merge** ➜ merge ប្តូរ `version.ts` លើ `main` ➜ workflow បង្កើត Release `zoew-android-v2.42.5` (ពេល Actions មានកូតា)។

### [2.42.4] — 2026-09-25 · ZoeW · ZoeKeyGen ៖ **ឡើងកំណែ toolchain និងបណ្ណាល័យទៅចុងក្រោយ** · ការថយក្រោយ ២ ដែលការឡើង Vite 8 នាំមក ត្រូវចាប់មុន ship

**សំណើម្ចាស់គម្រោង** ៖ *«update អ្វីៗដែលមានក្នុង ZoeW ទៅ version ចុងក្រោយទាំងអស់ ដូចជា gradle, sdk, ឬផ្សេងៗ»* ·
*«មើល version របស់ firebase SDK, sentry, Xzing, sheet, pdf, excel, និង ផ្សេងៗ … បើ update ទៅជំនាន់ចុងក្រោយបានសូម update ចុះ»*។

**ZoeW ប្រែ** (`zoew-v230` ➜ `zoew-v231`) · **ZoeKeyGen ប្រែ** (`zoekeygen-v101` ➜ `zoekeygen-v102` ៖ Firebase · Sentry fallback)។

#### អ្វីដែលឡើង

| ផ្នែក | មុន ➜ ក្រោយ | ការផ្ទៀងផ្ទាត់ |
|---|---|---|
| Firebase JS SDK (App ទាំង ២) | 12.17.1 ➜ **12.19.0** | ឈ្មោះ export ដែល loader ប្រើ (ZoeW ២២ · ZoeKeyGen ២១) មានក្នុង build CDN ពិត (npm) · `notifyAuthListeners` ក្នុង `@firebase/auth@1.13.6` ដូចដែល `auth-recovery-test` ធ្វើត្រាប់តាម |
| ZXing-WASM (ម៉ាស៊ីនស្កេន) | 3.1.3 ➜ **3.1.4** | ឯកសារ vendor ចាស់ = build ផ្លូវការ byte ទល់ byte · ថ្មី ៖ API ដដែល ៤០ ឈ្មោះ · `ZXING_WASM_SHA256` ស្មើ sha256 នៃ `.wasm` |
| Sentry fallback SDK (App ទាំង ២) | 7.120.3 ➜ **10.75.3** | Sentry ពិត (៣០ ថ្ងៃ) ៖ event ទាំងអស់មកពី SDK **10.71–10.75.3** តាម Loader · fallback 7.x **០ event** ➜ fallback = SDK ដែលផលិតកម្មបញ្ជាក់ថាដើរ។ ⛔ មិនមែន 11.0.0 (ចេញ ២ ថ្ងៃមុន · CDN វាស់មិនបានពីទីនេះ) |
| Vite · plugin-react · Vitest | 7 · 5 · 3 ➜ **8.3 · 6.1 · 5.0** | `npm run verify` · CI ពេញ |
| ESLint · @eslint/js · globals | 9 · 9 · 16 ➜ **10.11 · 10.0 · 17.12** | ច្បាប់ថ្មី ២ (`no-useless-assignment` · `preserve-caught-error`) ➜ ២៩ កន្លែង **អានទាំងអស់ ៖ ០ កំហុសពិត** (តម្លៃចាប់ផ្តើមការពារ · `throw` ក្នុង `catch`) |
| TypeScript | 5.9.3 ➜ **6.0.3** | ⛔ មិនមែន 7.0 ៖ `typescript-eslint` ទាមទារ `<6.1.0` (npm បដិសេធ peer) · `baseUrl` (deprecated ក្នុង TS 6) ត្រូវដក |
| esbuild · @netlify/blobs · floor ផ្សេងៗ | 0.25 ➜ **0.28** · 11.0.2 ➜ **11.1.1** | lockfile សាងថ្មីទាំងស្រុង |
| Android Gradle Plugin · Gradle | 8.13.0 · 8.14.3 ➜ **8.13.2 · 8.14.5** | patch ចុងក្រោយក្នុងខ្សែដែល Capacitor 8 គាំទ្រ |
| `playwright-core` (Windows helper) | 1.62.1 ➜ **1.63.0** | ដូច ZoeW |

**មិនឡើង (វាស់រួច)** ៖ Capacitor 8.5.2 · plugin ទាំងអស់ · React 19.3 · SheetJS 0.20.3 · qrcode-generator 2.0.4 (`ZoeKeyGen/qrcode.js`)
ជា **កំណែចុងក្រោយ stable រួចហើយ** · PDF ប្រើ print របស់ browser (គ្មានបណ្ណាល័យ)។ ⛔ **AGP 9 · Gradle 9 · compileSdk 37** ត្រូវការ
**Capacitor 9** ដែលនៅជា **alpha** (`9.0.0-alpha.7`) — template របស់វាលើក `minSdk` ទៅ **26** (បោះ Android 7.x) ហើយ plugin `@capgo/*`
គ្មានកំណែ 9 ទេ ➜ build Android វាស់មិនបាននៅទីនេះ (គ្មាន Android SDK) ➜ **មិនធ្វើ**។ `npm audit` ៖ ផលិតកម្ម **០**; dev ៣ moderate
(`uuid` ក្នុង `@capacitor/cli` ➜ `xcode` ៖ ឧបករណ៍ iOS · មានតាំងពី `main` · ការកែ = បន្ថយ CLI) ➜ ទុកដដែល។

#### ការថយក្រោយដែលការឡើងនាំមក — ចាប់មុន ship

- 🔴 **Vite 8 (Rolldown) ៖ web ផ្ទុកកូដ native ហើយក្រៅបណ្តាញចាប់ផ្តើមមិនកើត**។ Rolldown បម្លែង `manualChunks` ទៅជា group ដែល
  **ចាប់ dependency របស់ម៉ូឌុលដែលវាចាប់ផង** ➜ helper `__vitePreload` (plugin Capacitor ហៅ `import()`) ធ្លាក់ចូល chunk
  `native-plugins` ➜ `index` import chunk នោះដោយ **static** ហើយ `index.html` preload វា ➜ Service Worker មិន cache chunk នោះ
  ➜ **ក្រៅបណ្តាញ App ចាប់ផ្តើមមិនកើត**។ `android:check` ធ្លាក់ **២** · `native:check` ធ្លាក់ **១** (⛔ `smoke` · `sw:check` បៃតង)។
  ការកែ ៖ `codeSplitting.groups` ជាមួយ `priority` ច្បាស់ (helper ៣ · react ២ · native ១)។
- 🔴 **Lightning CSS (minifier CSS លំនាំដើមរបស់ Vite 8) សរសេរ CSS ឡើងវិញដោយគ្មានអ្នកវាស់**។ CSS ក្នុង build ខុសពី baseline
  **២,៣៩៧ បន្ទាត់** ៖ រៀបលំដាប់ declaration (`-webkit-*` ឡើងលើ) · design token **១៣/៣៥** ត្រូវសរសេរឡើងវិញ (`#0066FF` ➜ `#06f` ·
  `rgba(0,0,0,.05)` ➜ `#0000000d`) — ក្នុង CSS ដែលគ្រប PTR/ចលនាផ្ទាំង (តំបន់ហាមចូល) ខណៈ checker CSS/ប្លង់វាស់ CSS **ប្រភព**
  (`build-audit.mjs`) ➜ **គ្មាននរណាឃើញ**។ ការកែ ៖ `cssMinify: 'esbuild'` ➜ CSS ក្នុង build **ស្មើ baseline byte ទល់ byte**
  (លើកលែង marker `/*$vite$:1*/` នៅចុង)។

#### អ្នកយាមថ្មី

- `npm run smoke` ៖ (ក) JS ក្នុង build ត្រូវ parse បានក្នុង `build.target` (ដេរីវេពី `vite.config.mts`) — probe `target: 'esnext'` ➜
  **៦ ឯកសារធ្លាក់**; (ខ) design token CSS ទៅដល់ build ដូចដែលសរសេរ — probe «ដក `cssMinify`» ➜ **ធ្លាក់** (token ត្រូវសរសេរឡើងវិញ)។
- `npm run android:check` ផ្នែក ៧ ៖ config Android ↔ template របស់ Capacitor ដែលដំឡើង (SDK · AndroidX ស្មើ · AGP · Gradle ·
  google-services ឡើងបានតែ patch) — probe **៥/៥** ធ្លាក់ (AGP 9.4.0 · compileSdk 37 · Gradle 9.8.0 · androidx.core 1.19.0 · AGP 8.12.0)។
- `zto-cookie-sync-test` ៖ literal `'1.62.1'` (កាលបរិច្ឆេទផុតកំណត់) ➜ អះអាង **pin ជាកំណែជាក់លាក់** (probe `^1.63.0` ➜ ធ្លាក់)។

#### ឯកសារ ៖ `CLAUDE.md` បង្រួម · ប្រវត្តិបំបែកជា ២ ឯកសារ (សំណើម្ចាស់គម្រោង)

**សំណើ** ៖ *«ពិនិត្យមើល CLAUDE.md ផងក្រែងមានកន្លែងខុស … សម្អាតប្រសិនបើវាសល់ឯកសារចាស់ៗដែលទាក់ទងជាមួយ ZoeW កាលនៅជា
vanilla … HISTORY.md សម្រួលចោលខ្លះ … បំបែកជា HISTORY ARCHIVE»*។

- **ការវាស់ មុនការកែ** ៖ ឈ្មោះ helper **២៣៩/២៣៩** ដែល `CLAUDE.md` យោងជា `x()` នៅមានក្នុងកូដ ship (App React រក្សាឈ្មោះ
  function) · ការយោងក្នុង backtick **៧៦៣** ➜ បាត់ **១៣** សុទ្ធតែមានហេតុផល។ ការអះអាងអំពី **យន្តការ vanilla** ដែលខុស ៖ **៦**
  ➜ កែ (`initAppLock()` + TDZ ➜ boot · `ZoeW/vendor/` ➜ `ZoeW/public/vendor/` · `style.css` ➜ `src/styles/app.css` (ដូច vanilla
  byte ទល់ byte) · `CORE_SHELL` សរសេរដោយដៃ ➜ ដេរីវេក្នុង `vite.config.mts` · ហេតុផល `style=` «១៩០ កន្លែង» · អន្ទាក់ `let`
  កម្រិត module ➜ ឃ្លាំង state + bridge វាស់)។
- **`CLAUDE.md` ៤៣៤ KB ➜ ~៣៤៨ KB** ៖ ជួរតារាងស្នូលវែងបំផុត **១៦** (ដល់ ១១,០០០ តួក្នុងមួយក្រឡា) សរសេរឡើងវិញជា **ច្បាប់ខ្លី**
  ដោយរក្សាគ្រប់ ⛔ ច្បាប់ · ឈ្មោះ function · កូនសោ; narrative «វាស់បាន (x.y.z)» ផ្លាស់ទៅ `docs/HISTORY-ARCHIVE.md` **ផ្នែក ៥**
  **ដោយមិនកែ** (បូក `git show 2c998d1:CLAUDE.md` សម្រាប់ឯកសារពេញ)។ ច្បាប់ ៩ · ១២ · «📌 ការងារដែលនៅសល់» ក៏បង្រួមដែរ។
- **`docs/HISTORY.md` ២,៥ MB ➜ ~១៤៨ KB** ៖ សម័យ React (ZoeW `2.38.0` ➜ ឥឡូវ) នៅទីនេះ · សម័យ vanilla (ផ្នែក ១–៤ ចាស់) ផ្លាស់ទៅ
  **`docs/HISTORY-ARCHIVE.md`** ដោយ **មិនលុបបន្ទាត់ណាមួយ** (ផ្នែកទាំងអស់បូកស្មើចំនួនបន្ទាត់ដើម ២៣,៥៨៧)។ លិបិក្រម checker
  **ដេរីវេ** ពីការលេចពិតក្នុងឯកសារទាំង ២ (១៧៧ ជួរ)។
- **អ្នកយាម (`doc-scope-test`)** ៖ ច្បាប់ ៩ ថ្មី (ឯកសារ ២ · គ្មានទី ៣) · ប្រវត្តិ *ផ្លាស់ទី* មិនមែនលុប (វាស់លើទាំង ២) ·
  `HISTORY.md` តភ្ជាប់ទៅ archive · **លិបិក្រមគ្រប checker ដែលលេចក្នុងប្រវត្តិ** — probe ៣/៣ ធ្លាក់ (ដកជួរលិបិក្រម · ឯកសារ
  ប្រវត្តិទី ៣ · ដកតំណ)។ `doc-scope-test` ក៏ចាប់កំហុស ២ របស់ការកែខ្លួនឯង (`` `import()` `` មើលទៅដូច helper · តំណពី root
  ដែលបាក់ក្នុង `docs/`)។

#### checker SW ៖ race ពេលអាន bridge វាស់

- CI ពេញជុំទី ១ ៖ **១៨០ PASS · ២ FAIL** (`sw-cache-key` · `sw-shell-latency` ➜ `appJs:false`) ខណៈរត់ដាច់ដោយឡែក **ឆ្លង**។
  មូលហេតុ ៖ App React ដំឡើង bridge វាស់ (`expose-globals`) តាម dynamic import **អសមកាល** ➜ វាអាចមកដល់ **ក្រោយ** `load`
  ហើយ checker អាន `window.initScanEngine` ភ្លាម (ម៉ាស៊ីនរវល់ ➜ ធ្លាក់)។ race ដដែលមាន **៥ កន្លែង** (៣ បៃតងដោយសំណាង)។
  ការកែ ៖ `waitAuditBridge()` តែមួយក្នុង `audit-tools/react-view.js` (ពិដាន ២ វិ. — ខ្លីជាងការពន្យារបណ្តាញ ៥ វិ. ➜ chunk ដែល
  មិននៅក្នុង cache នៅតែធ្លាក់)។

#### APK ពី GitHub Releases (សំណើម្ចាស់គម្រោង ៖ «Build apk ដាក់ក្នុង Github ជា release ឬ package … ងាយស្រួល download»)

- **`.github/workflows/android-release.yml` (ថ្មី)** ៖ build web (`--mode android`) ➜ `cap sync` ➜ `gradlew assembleRelease` ➜
  `apksigner verify` ➜ **GitHub Release** `zoew-android-v<APP_VERSION>` (`ZoeW-<កំណែ>.apk` + `.sha256`) ៖ ពេល `APP_VERSION`
  ប្រែលើ `main` ឬចុច Run workflow · កំណែដែលមាន Release រួច ➜ មិន build ម្តងទៀត។
- ⛔ **keystore តែមួយជារៀងរហូត** ៖ `build.gradle` sign តាម env (`ZOEW_KEYSTORE_FILE` …) តែពេល env មាន (Android Studio ដើរដូចមុន) ·
  គ្មាន secret ➜ **មិន build** (⛔ គ្មានការធ្លាក់ចុះទៅ debug key របស់ runner ដែលប្រែរាល់ការរត់ ➜ APK ដំឡើងជាន់មិនបាន ➜
  បាត់ PIN · កៅអី License) · keystore លុបចេញពី runner ជានិច្ច · `*.jks` · `*.keystore` ហាមក្នុង `.gitignore` (ធ្លាប់ comment ចោល)។
- **អ្នកយាម** ៖ `android:check` ផ្នែក ៨ (ស្នាមភ្ជាប់ឈ្មោះ env workflow ↔ `build.gradle` · គ្មានផ្លូវ debug · លក្ខខណ្ឌ secret លើជំហាន
  gradle · `apksigner verify` មុន Release · គ្មាន keystore ក្នុង tree) — probe **៤/៤** ធ្លាក់។
- ⚠️ **APK មិនទាន់ build ក្នុងជុំនេះ** ៖ GitHub Actions របស់ម្ចាស់គម្រោងនៅអស់កូតា (job បញ្ចប់ក្នុង ២ វិ. គ្មានជំហាន) ហើយ
  environment នៃ session នេះបិទ `dl.google.com` (Android SDK) ➜ វាស់មិនបាន។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **Netlify build ខ្លួនឯង** (App ទាំង ២) · គ្មានការកែ Firebase rules · គ្មាន env ថ្មី។
- **សាកលើទូរស័ព្ទពិត (iPhone + Android)** ៖ ស្កេន Barcode (ZXing-WASM ថ្មី) · ចូលប្រព័ន្ធ (Firebase ថ្មី) · Export Excel · បើក App
  ក្រៅបណ្តាញ។ ZoeKeyGen ៖ ចូលប្រព័ន្ធ · បញ្ជី Key។
- **App Android** ៖ Android Studio ទាញ Gradle 8.14.5 និង AGP 8.13.2 ពេល Sync លើកដំបូង ➜ `npm run android:sync` ➜ build APK ➜ សាក។
- **Windows helper (ស្រេចចិត្ត)** ៖ រត់ `setup.cmd` ម្តងទៀតដើម្បីទទួល `playwright-core` 1.63.0 (ការដំឡើងចាស់នៅដើរធម្មតា)។
- **Sentry (ស្រេចចិត្ត · មិនទាន់ណែនាំ)** ៖ Loader កំពុងប្រើ **10.x** (ឡើង patch ដោយស្វ័យប្រវត្តិ)។ ការប្តូរទៅ 11.x ក្នុង Sentry ➜
  Project Settings ➜ Client Keys ➜ Loader Script — ⛔ រង់ចាំ 11.x ចាស់ជាងនេះ។

### [2.42.3] — 2026-09-25 · ZoeW ៖ **អេក្រង់សលែងកើតពីកំហុស render តែមួយ** · CI ពេញរត់ក្នុង session · money checker លើ App React (merge រួចក្នុង PR #250)

**សំណើម្ចាស់គម្រោង** ៖ *«Deep Audit project ទាំងមូល … វាស់ឡើងវិញទាំងអស់ … ពិនិត្យមើល sentry, money checker, អោយដើរជាមួយ React …
រត់ CI ពិតជំនួស Github ព្រោះ Github action ខ្ញុំអស់ quota»* · *«មើល tool money checker ផង»*។

**ZoeW ប្រែ** (`zoew-v229` ➜ `zoew-v230`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន (អ្នកប្រើ)

- 🔴 **កំហុស render តែមួយលែងធ្វើឲ្យ App ក្លាយជាអេក្រង់ស**។ React unmount ដើមឈើ **ទាំងមូល** ពេល component មួយបោះកំហុស
  (ឧ. ទិន្នន័យ Firebase ដែលមានរូបរាងមិនរំពឹង) ➜ អេក្រង់ស គ្មានប៊ូតុង គ្មានសារ — ខណៈ App ដើម (vanilla) មិនដែលសដោយកំហុស
  តែមួយទេ (DOM នៅដដែល)។ ឥឡូវ `AppErrorBoundary` បង្ហាញ «⚠️ App ជួបបញ្ហាក្នុងការបង្ហាញ» ជាមួយប៊ូតុង «🔄 ផ្ទុក App ឡើងវិញ»។
- 🔴 **កំហុស render ដែលព្រំដែនចាប់ ត្រូវឡើងដល់ Sentry ដែរ**។ លំនាំដើមរបស់ React 19 ៖ កំហុសដែល error boundary **ចាប់** ទៅត្រឹម
  `console.error` ➜ Sentry **មិនឃើញ** ➜ ព្រំដែនថ្មីនឹងលាក់កំហុសពីអ្នកថែទាំ។ ដូច្នេះ `createRoot(host, { onCaughtError, onUncaughtError })`
  បញ្ជូនទាំង ២ តាម `reportError()` ➜ អ្នកស្តាប់ `error` របស់ `error-reporting.js` (Sentry) ឃើញវាដូចកំហុសដទៃ។ ⛔ **មិនបន្ថែមប៊ូតុង «Break the world» របស់ `@sentry/react` ចូលផលិតកម្ម**
  (អ្នកប្រើណាក៏ចុចបំបែក App បាន) — ការផ្ទៀងផ្ទាត់ត្រូវជាតេស្ត `tests/native/render-crash.test.tsx` (កំហុសក្នុង render ➜ ផ្ទាំងជំនួស +
  `reportError` ទទួលកំហុសដដែល · ទិសផ្ទុយ ៖ គ្មានកំហុស ➜ គ្មានផ្ទាំង គ្មានការរាយការណ៍)។

#### `audit-tools`

- **`run-all.sh` រត់លើ repo React ដោយផ្ទាល់** ៖ វា build `ZoeW/dist-audit` ហើយប្រមូល tree វាស់ (`ZoeW/dist-audit/measure-root`) រួចរត់
  checker ទាំងអស់លើវា ➜ **CI ពេញរត់ក្នុង session** (GitHub Actions អស់កូតា)។
- **`zoew-suite-test.js` (ថ្មី)** ៖ អ្នកយាមផ្ទាល់ខ្លួនរបស់ ZoeW React (tsc · eslint · vitest · purity · native · android · rules · parity ·
  smoke · SW) ចូល `run-all.sh` ➜ មុននេះ tests/scripts/android **គ្មាននរណារត់វាក្នុង CI**។
- **money checker (`money-reality-check.js` · `check-money.cmd`) ដើរលើ repo React** ៖ កូដលុយពិតត្រូវស្រង់ចូល
  `audit-tools/money-core.js` (`npm --prefix ZoeW run money:core`) ជាមួយ **អ្នកយាមភាពស្រស់** (កូដលុយប្រែ ➜ ត្រូវបង្កើតវាឡើងវិញ)។
  function លុយ **១៩/១៩ ដូច ZoeW ដើម token ទល់ token**។ `comments` · `strip-comments` ស្កេន `ZoeW/public` (កូដ JS ដែល ship ដោយផ្ទាល់)។

- 🔴 **`doc-scope-test` មិនដែលស្កេន `ZoeW/docs/*.md` សោះ** ៖ `listAllDocs()` រំលងថតឈ្មោះ `docs` **គ្រប់ជម្រៅ** ខណៈច្បាប់ ៩
  លើកលែងតែ `docs/` **នៅ root** ➜ លទ្ធផល parity ឆៅ និងប្រវត្តិការរកឃើញរស់នៅ `ZoeW/docs/` ដោយគ្មានអ្នកយាម។ វាស់បាន ៖ អ្នកយាមដែល
  កែរួច **ធ្លាក់ ២** លើ tree មុនកែ (កំណត់ត្រាកំណែក្នុង `ZoeW/docs/DEVELOPMENT.md` · ការអះអាងទំហំ `app.js` ដែលលែងមានន័យ)។
- **`npm run smoke` ចាក់សោថា bridge វាស់មិនចូល build ផលិតកម្ម** (២ ជាន់ ៖ export ពិតមិនលេចលើ `window` · គ្មានសញ្ញា
  `__auditOrig`/`__auditRebind` ក្នុង `dist/assets`)។ វាស់បាន ៖ build ដោយ `VITE_EXPOSE_GLOBALS=1` ➜ ធ្លាក់ទាំង ២ ជាន់។
- **បញ្ជី slot ផ្លាស់ទៅ `ZoeW/scripts/slot-registry.cjs`** ហើយ `slot:check` ផ្ទៀងផ្ទាត់វាទល់នឹង `REACT_OWNED_IDS` (ទាំង ២ ទិស) និង
  component ដែល export ពិត (mutation ២/២ ចាប់)។ ឧបករណ៍ codemod (`ZoeW/tools/*` · `npm run generate`) និង `npm run audit:run`
  **ត្រូវលុប** ៖ វាសរសេរជាន់ `src/` ទាំងមូល (អន្ទាក់) · `run-all.sh` ជំនួស `audit:run`។
- **`.github/workflows/audit.yml`** ៖ ដំឡើង dependency របស់ ZoeW · job `firebase-rules` រត់ checker លើ tree វាស់
  (`ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh`) ➜ ពេលកូតា GitHub Actions ត្រឡប់មកវិញ CI មិនធ្លាក់ដោយ «រក `ZoeW/app.js` មិនឃើញ»។
- 🔴 **`zoew-suite` (checker ថ្មី) ចាប់ការថយក្រោយភ្លាមក្នុងការរត់ដំបូង** ៖ ច្បាប់ CSS របស់ផ្ទាំង crash ត្រូវដាក់ក្នុង `app.css` ➜
  `npm run parity` ធ្លាក់ (`app.css` ត្រូវដូច `style.css` ដើម **byte ទល់ byte**) ➜ ផ្លាស់ទៅ `react-root.css`។ មុនជុំនេះ parity
  **គ្មាននរណារត់ក្នុង CI ទេ**។
- 🔴 **checker CSS ស្តាទិចមើលតែពាក់កណ្តាលនៃ CSS/JSX** ៖ `style.css` របស់ tree វាស់ = `app.css` តែឯង (ខ្វះ `react-root.css` ·
  `native.css`) ហើយ `css-classes` ស្កេនតែ markup **ដំបូង** (`index.html`) ➜ class **១១៦** ក្នុង JSX ដែលមិនគូរពេលដំបូង
  (ផ្ទាំង crash · toast · បញ្ជីថាមវន្ត) គ្មានអ្នកវាស់។ ឥឡូវ `style.css` = CSS ដែល ship ពិត (តាមលំដាប់នាំចូលរបស់ `main.tsx`) ·
  `css-classes` ស្កេន `components.js` ដែរ (១៨០ ➜ **២៩៦** class) ➜ probe «ដក `.app-crash-reload`» ធ្លាក់។
- **Deep Audit (ការវាស់ក្រៅសំណុំ)** ៖ fuzz **ក្រៅជួរ seed លំនាំដើម** លើ App React — revenue (seed 100–113 × 50 ops) ·
  collected-value (seed 500+) · mirror (seed 300+) · connection-state (seed 700+ · ៥,៧៦០ ជំហាន) ➜ **បៃតងទាំង ៤**។ mutation
  `trashReason` របស់ «លុបទាំងអស់» ➜ `policy-test` · `trash-modal-test` ចាប់ (មិនមែនចន្លោះ ➜ មិនសាង checker ស្ទួន)។

#### ឯកសារ ៖ ប្រវត្តិរស់នៅកន្លែងតែមួយ

- `docs/HISTORY-ARCHIVE.md` · `docs/ARCHIVE-2026-09-03.md` ➜ **ផ្នែក ៣ · ៤** នៃឯកសារនេះ (តំណដែលបាក់បម្លែងជាអត្ថបទ) ·
  `ZoeW/docs/ADDED-VALUE.md` · `PARITY-RESULTS.md` ➜ **ផ្នែក ២**។ ⛔ លែងមានឯកសារបណ្ណសារដាច់ដោយឡែក (`CLAUDE.md` ច្បាប់ ៩)។
- `CLAUDE.md` ៖ ការអះអាងចាស់ដែលគ្រោះថ្នាក់សម្រាប់ session ក្រោយត្រូវកែ — «checker ភាគច្រើនមិនទាន់វាស់ App React» · «`ZoeW/app.js`
  ជាឯកសារកូដតែមួយ ~១៤,៤០០ បន្ទាត់ · function ជា global» · Runbook (`npm i acorn …` ➜ `npm ci --prefix ZoeW` · `git diff … ZoeW/app.js` ➜
  `ZoeW/src ZoeW/public`) · ច្បាប់ ៣ (comment ក្នុង `src/**`) · «កុំ merge មុនការផ្ទេរ checker» ➜ App React ជាផលិតកម្មរួច
  (`main` = 2.42.1 · ផ្ទៀងផ្ទាត់តាម git)។
- `ZoeW/docs/*` ៖ លេខ cache ចាស់ (`zoew-v227`) · ការអះអាង «manifest គ្មានលេខកំណែ» ខុស · PARITY.md ផ្នែក ៥ (checker «ធ្លាក់ដោយ
  រចនាសម្ព័ន្ធ») · MIGRATION.md លក្ខខណ្ឌទី ២ (សម្រេចរួច) ➜ កែតាមការពិត។ `guide.html` ៖ ដកកំណត់ត្រាប្រវត្តិ · បន្ថែមជំនួយសម្រាប់ផ្ទាំង
  «⚠️ App ជួបបញ្ហាក្នុងការបង្ហាញ»។

#### សកម្មភាពដែលត្រូវធ្វើដោយដៃ

- **គ្មាន** ៖ គ្មានការកែ Firebase rules · គ្មានការប្តូរ env។ Netlify build ខ្លួនឯង។ ⛔ **កុំដាក់ `VITE_EXPOSE_GLOBALS` ក្នុង env របស់
  Netlify** (`npm run smoke` នឹងធ្លាក់ តែ Netlify មិនរត់ smoke)។
- **អ្នកប្រើ `check-money.cmd` លើ Windows** ៖ ត្រូវទាញថត repo ថ្មី (ឯកសារ `audit-tools/money-core.js` ចាំបាច់) — ថតចាស់ដែលគ្មាន
  `ZoeW/app.js` នឹងរាយ «money code not found»។

### [2.42.2] — 2026-09-25 · ZoeW ៖ **`audit-tools` វាស់ App React** · លុបកូដងាប់ ១៩ ដែល checker រកឃើញ (merge រួចក្នុង PR #250)

**សំណើម្ចាស់គម្រោង** ៖ *«ចាប់ផ្ដើមទាំងអស់ទៅ អោវាស់បានទាំង 181 ហ្នឹងមកអោយបានពេញលេញដូច ZoeW កាលនៅជា vanillajs»* ·
*«បន្តធ្វើ checker ដែលនៅសល់ទាំងអស់ទៅ»*។

**ZoeW ប្រែ** (`zoew-v228` ➜ `zoew-v229`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន (អ្នកប្រើ)

- **គ្មានអ្វីដែលអ្នកប្រើមើលឃើញខុសពីមុនទេ**។ កូដ ship ដែលប្រែ ៖
  - ជម្រើសខែរបស់របាយការណ៍ខែ · Tab ក្នុងឯកសារ Excel · ជម្រើសផ្គូផ្គងជួរឈរ ហៅសកម្មភាពតាម `act()` (ព្រំដែន
    `ACTION_REGISTRY`) ជំនួសការហៅ function ដោយផ្ទាល់ — ឥរិយាបថដដែល (`act()` ➜ `lookupAction()` ➜ function ដដែល)។
  - function ងាប់ **១៩** ត្រូវលុប ៖ builder HTML **៧** (`buildHistoryRowHtml` · `healthRowHtml` · `trashGroupRowHtml` ·
    `trashActionButtonsHtml` · `trashSummaryCardHtml` · `monthlyReportMismatchNote` · `ztoListGroupHtml`) — JSX គូរពី
    model រួចហើយ · helper ref **៧** (`fieldFiles` · `blurField` · `selectFieldText` · `activeElementTag` · `elementRect` ·
    `refNameOf` · `onRefChange`) · store **២** (`subscribeAll` · `globalVersion`) · `runOnWindowLoad` + `documentLoadComplete`
    (`scope.onLoad()` ជាអ្នកការពារពិត) · `sheetImportViewOf`។ builder ២ ដែលតេស្ត parity ត្រូវការ រស់ជា **oracle** ក្នុង
    `ZoeW/tests/oracles/` (មិនចូលផលិតកម្ម)។

#### `audit-tools` ៖ ទិដ្ឋភាព App React (`ZoeW/scripts/build-audit.mjs` ➜ `ZoeW/dist-audit/ZoeW`)

checker ដើមស្រង់អត្ថបទពី `ZoeW/app.js` · អាន markup ថេរក្នុង `index.html` · ជំនួស `window.<fn>` ➜ លើ App React
ពួកវា **មិនរត់** ឬ **វាស់អ្វីផ្សេង**។ ឥឡូវ build វាស់ផលិត ៖

| ឯកសារ | អ្វី |
|---|---|
| `app.js` | ទិដ្ឋភាពអត្ថបទពីប្រភព TypeScript (លុបតែ type · ផ្ទៀងផ្ទាត់ token ទល់ token) · `<ឃ្លាំង>.<វាល>` ➜ `<វាល>` |
| `index.html` | markup ដំបូងរបស់ React ពិត + `data-act` ពី prop ពិត (`audit-annotate.ts`) |
| `sw.js` | ទិដ្ឋភាពអានបានរបស់ `src/sw/sw.ts` — ផ្ទៀងផ្ទាត់ **byte ទល់ byte** នឹងឯកសារដែល ship |
| `react-render.cjs` | SSR នៃ component ទាំងអស់ ➜ checker `vm` អាន **JSX ពិត** (មិនមែន markup ចម្លងដោយដៃ) |
| `components.js` | ទិដ្ឋភាពអត្ថបទនៃ `.tsx` (ការយោង · `onAct()`) |
| `view-originals.js` | តួ **ដើម** នៃ function ដែលទិដ្ឋភាព override (ការយោងរបស់វាជាការយោងពិត) |

helper រួម ៖ `audit-tools/react-view.js` (`renderFromContext` · `actionUsages` · `swShell` …)។

#### ការរកឃើញ (ការវាស់ មិនមែនការអាន)

- 🔴 **`npx tsc --noEmit -p .` មិនពិនិត្យអ្វីសោះ** — `tsconfig.json` ជា solution file (`"files": []`) ➜ វាចេញ ០
  ដោយស្ងាត់ ខណៈ `audit-compat.ts` នាំចូល export ដែលលុបរួច។ ⛔ ត្រូវប្រើ `npm run typecheck` (`tsc -b`)។
- `function-surface` រាយ **១៩** ៖ ងាប់ពិត **១៧** (+ **២** ងាប់តាមខ្សែ ៖ `trashActionButtonsHtml` · `documentLoadComplete`) · **២**
  ជាសំណល់នៃទិដ្ឋភាព (`allStores` · `modalIsMounted` — override លុបការយោង ➜ `view-originals.js`)។ `buildHistoryRowHtml()` ងាប់ **ជាច្បាប់ចម្លងទី ២ នៃរូបមន្តលុយរបស់ជួរដេក**
  (`activeCod` · `activeDod` · Locker) ➜ `code-duplication` រាយ ២ (ច្បាប់ ១២ លើកូដ ៖ ជុំក្រោយកែមួយ ភ្លេចមួយ)។
- `wiring` · `csp-enforced` ៖ ធាតុ **៣** ក្នុង `ACTION_ALLOWLIST` គ្មាន `act()` ណាហៅ (សិទ្ធិលើស) ➜ ការហៅឆ្លងកាត់ `act()` វិញ។
- `html-sink-escaping` ៖ ក្នុង React គ្មាន HTML តាមការតភ្ជាប់ខ្សែអក្សរទៀតទេ ➜ ជាន់អប្បបរមា «រកឃើញ ≥ ១» មិនអាចពិតបាន ➜
  ជំនួសដោយ **probe** (scanner ដដែលត្រូវរាប់ និងរាយ sink ដែលដាំ) បូក **គ្មាន `dangerouslySetInnerHTML`** ក្នុង JSX។
- `action-binding` ៖ អ្នកស្តាប់ទី ២ ក្នុង React ចងតាម `refWithNative()` / `scope.listen(elementOf(…))` មិនមែន
  `getElementById` ➜ mutation «`refWithNative` ហៅសកម្មភាពដដែលនឹង `onChange={onAct(…)}`» ត្រូវចាប់។
- `csp-enforced` (browser) ៖ ការជំនួស `window.openViewListModal` / `window.loginWithFirebase` **មិនវាស់អ្វីទេ** លើ App React
  (សកម្មភាពហៅតាម `ACTION_REGISTRY`) ➜ វាស់ **ផល** វិញ ៖ ប្រអប់បង្ហាញលេខ/Barcode របស់ `row1` · សារ «វាលទទេ» ពិតរបស់ `loginWithFirebase()`
  (អានចេញពី `app.js`)។ mutation ៤/៤ ចាប់ (`lookupAction` · registry ឃ្លាត · `args` ខុស · `evt` បាត់)។
- `parity-static` ៖ ការប្រៀបធៀបអត្ថបទបង្រួមចន្លោះទទេ (HTML និង JSX បង្ហាញ `\n    ` ជាចន្លោះ ១) — អត្ថបទព្រមានរបាយការណ៍ខែ
  មិនបាត់ទេ វាខុសត្រឹម indent។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0`–`2.42.1` នៅដដែល (checker ដែលនៅសល់ · iPhone + Android ពិត)។
២. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify** · App Android មិនចាំបាច់ build ថ្មី (គ្មានអ្វីអ្នកប្រើឃើញ)។
៣. សាក ៖ 📊 របាយការណ៍ខែ ➜ ប្តូរខែ ➜ តារាងប្តូរ · នាំចូល Excel ➜ ប្តូរ Tab ➜ ជួរឈរបំពេញវិញ · ប្តូរជួរឈរ ➜ មើលជាមុនប្តូរ។

### [2.42.1] — 2026-09-24 · ZoeW ៖ **App Android ៖ រូបតំណាងរបាស្ថានភាព (ម៉ោង · ថ្ម) មើលឃើញវិញ** (merge រួចក្នុង PR #250)

**របាយការណ៍អ្នកប្រើ (ទូរស័ព្ទ Android ពិត · រូបថតអេក្រង់)** ៖ *«App android fullscreen ស្អាត ហើយតែ status bar
អត់ប្រែពណ៌ មើល status bar អត់ឃើញ ធម្មតាពេលចូលផ្ទៃ ស status bar ដូទៅពណ៌ខ្មៅ»*។

**ZoeW ប្រែ** (`zoew-v227` ➜ `zoew-v228`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន

- លើ WebView ពេញអេក្រង់ រូបតំណាងរបាស្ថានភាព **ស លើ navbar ស** ➜ មើលមិនឃើញ។ ឥឡូវ ៖ **ខ្មៅ** លើ navbar ស ·
  **ស** ពេលប្រអប់ (ផ្ទៃងងឹតថ្លាៗ) បើក · **ខ្មៅវិញ** ពេលបិទ។ Web · PWA · iPhone **មិនប៉ះ** (កូដរត់តែលើ native)។

🔴 **មូលហេតុ ៖ ការសន្មតអំពី layout ជំនួសការវាស់** — `statusBarStyleFor()` សម្រេច «inset > 0 ➜ navbar
**ក្រហម** ➜ រូបតំណាងស» ខណៈ navbar ពិតជា `--card-bg` (**`#ffffff`**)។ ⛔ **ហើយតេស្តចាក់សោកំហុសនោះ** ៖
`native-back.test.tsx` អះអាង `statusBarStyleFor(24) === 'dark'` ➜ tsc · vitest · `native-check` (75) **បៃតងទាំងអស់**
ព្រោះ Chromium ឆ្លើយ `env(safe-area-inset-top)` = **0** ជានិច្ច ➜ ផ្លូវពេញអេក្រង់ **មិនដែលត្រូវរត់ក្នុង browser**
(សំណួរ ៨ ៖ «តើ checker ដាក់ប្រព័ន្ធក្នុង *ស្ថានភាព* ណា?»)។

**ការកែ** ៖ `measureStatusBarTone()` វាស់ **ស្រទាប់ពិត** នៅក្រោមរបា (`elementsFromPoint` · ៥ ចំណុចតាមទទឹង ·
ពណ៌ផ្ទៃ + `opacity` រួមធាតុមេ) ➜ `status-bar-tone.ts` (សុទ្ធសាធ) លាយស្រទាប់លើផ្ទៃស ➜ ពន្លឺ WCAG ➜ ជ្រើសពណ៌ដែល
មាន **កម្រិតផ្ទុយខ្ពស់ជាង**។ វាស់ឡើងវិញពេល `resize` · `uiState` · `securityState` ប្រែ (rAF + ម្តងទៀតក្រោយ
**៣២០ ms** ពេលចលនាប្រអប់/របា Slide ចប់)។ inset ០ (WebView ចាស់) ➜ `light` ដដែល។

#### អ្នកយាមថ្មី

- `native-check` សេណារីយ៉ូ **៤ឃ** ៖ safe-area **ពិត** តាម CDP (`Emulation.setSafeAreaInsetsOverride` ➜ `env()` ពិត
  ➜ navbar ទទួល padding ដូចលើទូរស័ព្ទ) ហើយវាស់ **ការហៅ plugin** ក្រោយការប្តូរ state (⛔ មិនមែនហៅ function ដោយផ្ទាល់)។
  វាស់បាន ៖ លើកូដ **មុនកែ** ➜ ធ្លាក់ **២** (`{"style":"DARK","bg":"rgb(255, 255, 255)"}` — របាយការណ៍អ្នកប្រើបេះបិទ);
  mutation «ដក `uiState.subscribe`» ➜ ធ្លាក់ «ប្រអប់បើក ➜ DARK» (`LIGHT`)។ ក្រោយកែ ➜ **82 ok · 0 FAIL**។
- `tests/native/status-bar-tone.test.ts` (៩) ៖ ពណ៌អានចេញពី `app.css` **ពិត** (`--card-bg` · `--body-bg` · `.modal` ·
  `.drawer-backdrop`) មិនមែនសរសេរដោយដៃ · ទិសផ្ទុយ (ផ្ទៃងងឹត ➜ `dark`) · fade (opacity 0 ➜ `light`) · ពណ៌ខូច ➜ រំលង។
  តេស្តចាស់ដែលចាក់សោកំហុស (`statusBarStyleFor(24) === 'dark'`) **ត្រូវដកចេញ**។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0`–`2.42.0` នៅដដែល។
២. **App Android** ៖ build APK ថ្មី (`npm run android:sync` ➜ Android Studio) — គ្មាន plugin ថ្មី។
៣. សាកលើ **Android ពិត** ៖ បើក App ➜ ម៉ោង/ថ្មខាងលើ **ខ្មៅ** មើលឃើញ · ចុច «📅 កញ្ចប់ប្រចាំថ្ងៃ» ➜ **ស** ·
   បិទប្រអប់ ➜ **ខ្មៅវិញ** · បើករបា Slide · ចាក់សោ App (ចាកចេញ ➜ ត្រឡប់មក) ➜ មើលឃើញជានិច្ច។
៤. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify**។

### [2.42.0] — 2026-09-23 · ZoeW ៖ **React ១០០% ពេញលេញ** — ស្រទាប់ React ខ្លួនឯងលែងសរសេរ DOM ក្រៅច្រកចេញ (merge រួចក្នុង PR #247)

**សំណើម្ចាស់គម្រោង** ៖ *«2.41.0 ជា React ពេញលេញ 100% នៅ?»* ➜ ចម្លើយស្មោះត្រង់ ៖ **មិនទាន់** —
*«ធ្វើទាំងអស់ អោយស្អាតពេញលេញជា React 100% ទៅ»*។

**ZoeW ប្រែ** (`zoew-v226` ➜ `zoew-v227`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលខុសពីមុន (អ្នកប្រើ **មិនឃើញ** អ្វីប្រែ — ការរៀបចំខាងក្នុង)

🔴 **អ្នកយាមជំនាន់មុនបៃតងក្លាយ** ៖ `purity:check` រាយ «ការប៉ះ DOM ក្រៅ React ៖ 0» ខណៈ
`src/app/behaviors` (កាយវិការ) សរសេរ `style` · `classList` · `scrollTop` · `setAttribute` លើធាតុរបស់ React
**~៤០ បន្ទាត់** — ព្រោះវាវាស់តែថតមុខងារ (`core` … `platform`) ➜ **លេខ 0 មិនមែនការវាស់ទាំង App**។

| អ្វី | មុន (imperative) | ឥឡូវ (React) |
|---|---|---|
| សញ្ញា PTR (transform · opacity · `ready`/`snapping`/`spinning`) | `indicator.style.*` · `classList` រាល់ `touchmove` | ឃ្លាំង **`ptrState`** (អ្នកជាវតែមួយ) ➜ `PtrIndicator` គូរ · `renderNow()` ក្នុងការ dispatch ដដែល |
| ការតាមដានថា PTR អាចកើត (listener non-passive) | `MutationObserver` លើ class របស់ធាតុ React | `uiState.subscribe` (ប្រភពនៃ class ទាំងនោះ) |
| ទីតាំងប្រអប់ណែនាំលេខ | `box.style.width/left/top` | state `uiState.phoneSuggest*` ➜ `style` ក្នុង JSX |
| ព្រឹត្តិការណ៍ប្រអប់ស្វែងរកលេខ · ប្រអប់ណែនាំ | `addEventListener` (input · focus · blur · keydown · mousedown · click) | `onInput` · `onFocus` · `onBlur` · `onKeyDown` · `onMouseDown` · `onClick` លើជួរ |
| ទម្លាក់ឯកសារ (នាំចូល Excel) | `addEventListener` (drag*) ក្នុង `setupSheetImportDropZone()` | `onDragEnter` · `onDragOver` · `onDragLeave` · `onDrop` |
| Enter របស់ម៉ាស៊ីនស្កេន hardware | `addEventListener('keypress')` | `onKeyPress` |
| ចុចដងអូសផ្ទាំង | `addEventListener('click')` ក្នុង `bindPanelSwipe` | `onClick` ➜ `togglePanelFromHandle()` (តួដដែល) |
| អថេរ CSS `--chrome-*` លើ `<html>` | `document.documentElement.style.setProperty` | state ➜ `DocumentEffects` (`useLayoutEffect`) |
| ធាតុវាស់ safe-area (Android) | `createElement` + `appendChild` + `remove` រាល់ការវាស់ | `SafeAreaProbe` (JSX · តែលើ native) + ref |
| `webkit-playsinline` របស់វីដេអូ | `setAttribute` (`app/media.ts`) | ទង់ស្អិត `viewState.cameraWebkitInline` ➜ JSX (ឯកសារ `media.ts` ដកចេញ) |
| សំណាញ់ ៦ វិ. ក្នុង `boot-flags.js` | ដាក់ class លើ `#bootSplash` របស់ React | **ដកចេញ** ៖ ផ្ទាំងជារបស់ React តែមួយ (bundle ដួល = គ្មានផ្ទាំង) · ផ្លូវបម្រុង ៦ វិ. នៅក្នុង React |
| `scrollTop` · `scrollIntoView` · `animate()` ក្នុងកាយវិការ | សរសេរត្រង់ៗ | ច្រកចេញតែមួយ `src/app/refs.ts` · ការរមូរ document ➜ `platform/document-io.ts` |

⛔ **អ្វីដែលនៅមិនមែន JSX ដោយចេតនា** (React ខ្លួនឯងគ្មានទម្រង់ប្រកាស) — រាប់ដោយអ្នកយាមជាមួយ
**ហេតុផល និងពិដានតឹង** (`ZoeW/docs/ARCHITECTURE.md` ផ្នែក ១០ «ច្រកចេញ») ៖ focus · រមូរ · `animate()` ·
input uncontrolled (`refs.ts`) · `<html>`/`<body>` (`DocumentEffects`) · `srcObject`/`muted` របស់ `<video>` ·
listener `touch*` non-passive (React ចាក់វាជា passive) · listener លើ `document`/`window` · `<head>`/ការទាញយក
(`document-io.ts`) · class លើ `<html>` **មុន** stylesheet (`boot-flags.js`)។

#### អ្នកយាមថ្មី/ពង្រឹង

- **`purity:check`** វាស់ `src/app/**` ផង ៖ ការសរសេរ DOM (class · style · attribute · អត្ថបទ · focus · រមូរ ·
  ចលនា · listener លើធាតុ) **០** ក្រៅច្រកចេញ `APP_ALLOWED` (ពិដានតឹង · ធាតុងាប់ ➜ ធ្លាក់)។ Mutation **៦/៦**
  ចាប់ ៖ `style` លើសញ្ញា PTR · `blur()` ក្នុងកាយវិការ · `focus()` លើសពិដានក្នុង `refs.ts` · `classList` ក្នុង
  JSX handler · `el.animate()` ត្រង់ៗ · `addEventListener` លើធាតុថ្មី។
- **`native-check`** (+៥) ៖ សញ្ញា PTR ផ្លាស់ទីតាមម្រាមដៃ · ចុះ DOM **ក្នុងការ dispatch ដដែល** · `ready` ·
  `touchcancel` ➜ ត្រឡប់ភ្លាម · លែងដៃ ➜ `spinning`។ ⛔ វាស់រួច ៖ touch របស់ CDP រត់ microtask **រវាង
  listener** ➜ ការវាស់ដំបូងមិនបែងចែក (mutation «ដក `renderNow`» **រស់រាន**) ➜ ប្តូរទៅ touch ដែល script
  បញ្ជូន (គ្មាន checkpoint) ➜ mutation ដដែល **ធ្លាក់ ២**។

#### អ្វីដែលវាស់បាន

| ការវាស់ | `2.41.0` | **`2.42.0`** |
|---|---|---|
| `audit-tools/run-all.sh` (emulator · strict) ជោគជ័យ / ធ្លាក់ / រំលង | 61 / 120 / 0 | **61 / 120 / 0** |
| ការអះអាងដែលធ្លាក់ (អត្ថបទមិនស្ទួន) | 781 | **782** |

- ស្ថានភាព checker **មិនប្រែមួយណាសោះ** · ការអះអាងធ្លាក់ **ថ្មី ១ តែប៉ុណ្ណោះ** ៖ `boot-animation` «សំណាញ់សុវត្ថិភាព
  ក្នុង `boot-flags.js`» — ការស្វែងរក **អក្សរ** ក្នុង `boot-flags.js` ដែលដកចេញ **ដោយចេតនា** (ផ្ទាំងបើកជារបស់
  React តែមួយ ➜ bundle ដួល = គ្មានផ្ទាំង · ផ្លូវបម្រុង ៦ វិ. ក្នុង React)។ ⛔ checker នោះវាស់ markup ថេរនៃ
  `index.html` ដើម ដែល App React គ្មាន (`index.html` ផលិតកម្មមានតែ `#root`)។
- តំបន់ហាមចូលនៅ **PASS** ដដែល ៖ `gesture` 107 (រួមការចាក់/ដក listener PTR តាមស្ថានភាពផ្ទាំង ➜ `uiState.subscribe`)
  · `panel-motion` 47 · `ios-panel-glide` 38 · `history-menu` 57 · `layout-thrash` 5។
- ZoeW ខ្លួនឯង ៖ `verify` (purity **15** · vitest 61 · android-check 48) · `native-check` **75** · `logic:check`
  (function ដើមបាត់ **០** · ដកចេញដោយចេតនា ៥) · `parity:all` (DOM/layout 721/721 × ៣ · deep · cleanup-rules 115)
  — **បៃតងទាំងអស់**។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0`–`2.41.0` នៅដដែល។
២. **App Android** ៖ build APK ថ្មី (`npm run android:sync` ➜ Android Studio) — គ្មាន plugin ថ្មី។
៣. សាកលើ **iPhone PWA និង Android ពិត** (តំបន់ដែលកូដប្រែ) ៖ ទាញចុះ (PTR) ➜ សញ្ញាវិលរលូន · ស្វែងរកលេខ
   ➜ ប្រអប់ណែនាំលេចត្រង់ក្រោមប្រអប់ · ព្រួញ/Enter/ចុចជួរណែនាំ · ចុចដងអូសផ្ទាំង · ទម្លាក់ឯកសារ Excel
   (កុំព្យូទ័រ) · ម៉ាស៊ីនស្កេន Bluetooth/USB (Enter) · កាមេរ៉ាលើ iPhone។
៤. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify**។

### [2.41.0] — 2026-09-23 · ZoeW ៖ **PTR តាមស្តង់ដា App** (តំបន់ខាងលើ · ស្រទាប់ · ញ័រ) · កំហុស ៥ ដែល `audit-tools` រកឃើញលើ `2.40.0` (merge រួចក្នុង PR #247)

**សំណើម្ចាស់គម្រោង** ៖ *«សម្រួល PTR អោយកេះដើរតែពេលប្រអប់ប្រវត្តិមិនទាន់ហូតឡើងបានហើយ
និងពេលបើក modal ផ្សេងៗកុំអោយកេះ PTR ដោយកំណត់តំបន់កេះតែកំណាត់ខាងលើ និងញ័រផង
ដូចទៅហ្នឹងស្តង់ដា App ផ្សេងៗ»*។

**ZoeW ប្រែ** (`zoew-v225` ➜ `zoew-v226`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលអ្នកប្រើឃើញ

- **PTR (ទាញចុះដើម្បីផ្ទុកឡើងវិញ)** — ⛔ តំបន់ហាមប៉ះ ច្បាប់ ១១ ៖ ប៉ះតាមសំណើច្បាស់ ៖
  - ម្រាមដៃត្រូវ **ចាប់ផ្តើមក្នុង ៤០% ខាងលើ** នៃអេក្រង់ ➜ ការអូសពីពាក់កណ្តាល/បាត មិនផ្ទុក
    ទំព័រដោយចៃដន្យ
  - **ប្រអប់ · ម៉ឺនុយ (...) · របា Slide · សោ App បើក ➜ គ្មាន PTR** — រួមទាំង **ការប៉ះដែល
    បិទម៉ឺនុយ** (វាបិទម៉ឺនុយប៉ុណ្ណោះ មិនផ្ទុកទំព័រ)
  - **ញ័រម្តង** ពេលទាញគ្រប់ («លែងដៃដើម្បីផ្ទុក») — App Android (`@capacitor/haptics`)
    និង Chrome លើ Android · ⛔ **iPhone មិនញ័រ** ៖ Safari មិនផ្តល់ API ញ័រដល់ទំព័រវែបទេ
  - ផ្ទាំងប្រវត្តិហូតឡើង ➜ គ្មាន PTR (ដូចមុន — វាស់ម្តងទៀតដោយ `gesture-test`)
- **ផ្ទាំងបើក App (splash)** ៖ សំណាញ់ ៦ វិនាទីក្នុង `boot-flags.js` ត្រឡប់មកវិញ ➜ បើកូដ App ដួល
  ផ្ទាំងនៅតែរសាត់ (`2.40.0` ផ្លាស់វាចូល React ➜ ដើរតែពេល React នៅរស់)។

#### កំហុសដែល `audit-tools/run-all.sh` (checker ដើម · ឯករាជ្យ) រកឃើញលើ `2.40.0`

⛔ ការប្រៀបធៀប **តាមការអះអាងនីមួយៗ** (មិនត្រឹមស្ថានភាព checker) រវាង `2.39.0` និង
`2.40.0` ៖ ការអះអាងធ្លាក់ថ្មី **៥៧** (និងបាត់ ៨ — ភាគច្រើនប្តូរតែអត្ថបទកំហុស `byId` ➜ `fieldValue`) — ភាគច្រើនលាក់ក្នុង checker ដែលក្រហមស្រាប់ ➜ វិភាគម្តងមួយ ៖

| ថ្នាក់ | មូលហេតុ | ការកែ |
|---|---|---|
| **DOM មិនប្រែក្នុង tick ដដែល** (`duplicate-scan` · `item-money` · `duplicate-money` · `page-nav` · `app-lock` · `history-menu` · `ios-panel-glide`) | App ដើមកែ DOM ផ្ទាល់ ➜ ប្រអប់ · របា Slide · ម៉ឺនុយ · ផ្ទាំង ប្រែ **ភ្លាម**; React ២.៤០ ប្រែក្នុង microtask ➜ កូដ/អ្នកវាស់ដែលអានភ្លាមឃើញស្ថានភាពចាស់ (ឧ. ម៉ឺនុយមិនបិទ ខណៈចលនាបើកកំពុងរត់ · snap មិនត្រឡប់ក្រោយ cleanup) | **វាល `markImmediate`** ក្នុង store (រចនាសម្ព័ន្ធ UI ១៨ វាល) ➜ ចុះ DOM ក្នុង tick ដដែល — ⛔ រចនាសម្ព័ន្ធ មិនមែនការចាក់ `commitNow()` ម្តងមួយកន្លែង · អ្នកយាម ៖ `tests/native/immediate-ui.test.tsx` (mutation «បញ្ជីទទេ» ➜ ៤/៤ ធ្លាក់) |
| **ក្រៅបណ្តាញ build វាស់ដួល** (`sw-shell-latency` · `offline-shell` · `sw-cache-key`) | glob `./platform/**` ក្នុង `expose-globals.ts` នាំ plugin Capacitor ជា static ➜ web ផ្ទុក chunk `native-plugins` ដែល SW មិន cache | ដក glob នោះ (build ផលិតកម្មមិនដែលរងផល ៖ `android:check` «web មិនផ្ទុកកូដ native») |
| **សំណាញ់ splash** (`boot-animation`) | បាត់ពី `boot-flags.js` | ប្រគល់ដូច `2.39.0` បេះបិទ |
| **ឈ្មោះ function ប៉ះគ្នាក្នុង bundle វាស់** (`cleanup-interrupt-atomicity` · `late-commit`) | helper ថ្មី `scrollTopOf()` ក្នុង `refs.ts` ប៉ះឈ្មោះ function ដើម ➜ esbuild ប្តូរឈ្មោះ `parseTimestampFromId2` · `buildHistoryRowHtml2` · `scrollTopOf2` ➜ checker ស្រង់តាមឈ្មោះមិនឃើញ | ដក helper ដែលមិនប្រើ និង import ដែលមិនប្រើ |
| **CLAUDE.md យោង helper ដែលដកចេញ** (`doc-scope-test`) | `code128SvgElement()` | ➜ `Code128Svg` · `code128Bars()` |

⛔ **ការធ្លាក់ថ្មីដែលនៅសល់ ជា «វាស់មិនបាន»** (ពិនិត្យម្តងមួយ ៖ ឥរិយាបថនៅដដែល) ៖ checker
ស្តាទិចរកអក្សរក្នុងតួ function ដែលផ្លាស់ចូល helper (`blurActiveElement()` · `beginPdfPrint()` ·
`injectScript()`) · យន្តការ delegation ដែលដកចេញដោយចេតនា · `ReferenceError` ក្នុង `vm` (helper ថ្មី) ·
`doc-scope` កាត់ ១៦០០ តួលើ bundle (indent ២) ➜ រអិលចូល HTML ជួរដេក។

#### អ្វីដែលវាស់បាន

| ការវាស់ | `main` (ZoeW ដើម) | `2.39.0` | `2.40.0` | **`2.41.0`** |
|---|---|---|---|---|
| `audit-tools/run-all.sh` (emulator · `CRUD_FLOW_STRICT=1` · `VERSIONSCOPE_STRICT=1`) ជោគជ័យ / ធ្លាក់ / រំលង | 180 / 1 / 0 | 61 / 120 / 0 | 59 / 122 / 0 | **61 / 120 / 0** |
| ការអះអាងដែលធ្លាក់ (អត្ថបទមិនស្ទួន) | — | 766 | 815 | **781** |

- ធៀប `2.40.0` ៖ ការអះអាងធ្លាក់ **ដកចេញ ៣៤** (ថ្នាក់ ៥ ក្នុងតារាងខាងលើ) · **ថ្មី ១** ៖ `page-nav` «បោះបង់ ➜
  បិទប្រអប់» — វាស់ម្តងមួយ ៖ checker ចុច `[data-act="cancelLogout"]` ដែលលែងមាន (សកម្មភាពជា `onClick`)
  ➜ ការចុចគ្មានអ្វីកើត ➜ **សំណល់នៃការវាស់** ដូច `2.39.0` បេះបិទ (`2.40.0` រាយ ok ដោយ **ចៃដន្យ** ៖ ប្រអប់
  មិនដែលបើកសោះ ➜ «មិនបើក» ពិតដោយស្វ័យប្រវត្តិ)។
- `main` ធ្លាក់ ១ (`repository-file-coverage`) ៖ `node_modules` ដែលមិនស្ថិតក្នុង git ក្នុង repo ស្រមោល — សំណល់នៃការវាស់។
- ZoeW ខ្លួនឯង ៖ `verify` (purity 11 · vitest 61 · native-check 70 · android-check 48) · `logic:check` (function
  ដើមបាត់ **០**) · `parity:all` (DOM/layout 721/721 × អេក្រង់ ៣ · deep · cleanup-rules 115) — **បៃតងទាំងអស់**។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0`–`2.40.0` នៅដដែល។
២. **App Android** ៖ build APK ថ្មី (`npm run android:sync` ➜ Android Studio) — plugin ថ្មី
   `@capacitor/haptics` (សិទ្ធិ `VIBRATE` មានរួច)។
៣. សាកលើ **iPhone PWA និង Android ពិត** ៖ ទាញចុះពីផ្នែកខាងលើ ➜ ផ្ទុក (Android ញ័រម្តង) ·
   ទាញពីផ្នែកខាងក្រោម ➜ មិនផ្ទុក · ទាញពេលប្រអប់/ម៉ឺនុយបើក ➜ មិនផ្ទុក · ផ្ទាំងប្រវត្តិហូតឡើង ➜
   មិនផ្ទុក។ ⛔ **តំបន់ ៤០% ជាលេខដែលអាចកែបាន** (`PTR_START_ZONE_RATIO`) — ប្រាប់បើចង់ធំ/តូចជាងនេះ។
៤. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify**។

### [2.40.0] — 2026-09-23 · ZoeW ៖ **React ១០០%** — React ជាម្ចាស់ DOM តែមួយ (merge រួចក្នុង PR #247)

**សំណើម្ចាស់គម្រោង** ៖ *«ខ្ញុំចង់បាន ZoeW ថ្មីជា React ពេញលេញ 100% មិនមែនលាយ»* ·
*«រៀបចំគម្រោងថ្មី អោយមាន JSX, Component lifecycle និងតម្រង់ state management ផង
ដើម្បីថ្ងៃមុខទៅ ងាយស្រួលអភិវឌ្ឍន៍បន្ថែម ឬត្រូវពង្រីកថែម»*។

**ZoeW ប្រែ** (`zoew-v224` ➜ `zoew-v225`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលអ្នកប្រើឃើញ

- **ដូចមុនបេះបិទ** លើ web/PWA និង Android (parity ទាំង ៥ ជាន់ ខាងក្រោម) — លើកលែង
  **ប្រអប់ធីក «ចងចាំអ៊ីមែល» ក្នុងប្រអប់ចូលប្រព័ន្ធ ដោះធីកបានវិញ** ៖ ក្នុង `2.39.0`
  React ចាក់សោវា (`checked` គ្មាន `onChange`) — វាស់ក្នុង browser ៖ `2.39.0` ចុច ➜ នៅធីក ·
  `2.40.0` ចុច ➜ ដោះធីក។ ⛔ ZoeW ដើមលើ `main` មិនដែលមានកំហុសនេះទេ។

#### ស្ថាបត្យកម្ម (សម្រាប់ការអភិវឌ្ឍបន្ត ៖ `ZoeW/docs/ARCHITECTURE.md` ផ្នែក ១១ · `EXTENDING.md`)

- **កូដមុខងារ** (`src/core` · `domain` · `features` · `services` · `ui` · `platform`) ប៉ះ DOM
  **០** កន្លែង (ពី **៧៧៤**) ៖ ប្រអប់ = `uiState.modalDisplay` (`<Modal>`) · អត្ថបទ/ទង់ =
  `viewState` · class ស្ថានភាព (ផ្ទាំង · របា Slide · ម៉ឺនុយ · សោ App) = `uiState` ·
  focus/តម្លៃ/វាស់/រមូរ = ref តាមឈ្មោះ (`src/app/refs.ts`) · `commitNow()` មុនរាល់ការវាស់។
- **កាយវិការ · PTR · ចលនាផ្ទាំង · ការលាក់របា** ផ្លាស់ទៅ `src/app/behaviors/` (ស្រទាប់ React
  តាម ref) — តក្កវិជ្ជាដដែល (`logic:check` ៖ តំបន់ហាមចូល ២០ function ខុសពីដើម **សុទ្ធតែ**
  ការប្តូរ DOM ➜ state/ref ដែលមានហេតុផលម្តងមួយៗ · លំដាប់ · លក្ខខណ្ឌ · slop · ratio ដដែល)។
- `setupActionDelegation()` ដកចេញ ៖ ការចុចទាំងអស់ឆ្លង `onAct()` តែមួយ ➜ គ្មាន listener
  ទី ២ នៅកម្រិត `document` (ច្បាប់ ៤ នៃ «CSP និង `data-act`»)។
- ការប៉ះ `document` ដែលមិនមែន UI (`<head>` · ទាញយក · canvas ក្រៅអេក្រង់ · វដ្តជីវិតទំព័រ)
  រស់ក្នុង `src/platform/document-io.ts` តែមួយ។
- Category ក្នុងរបា Slide ៖ `hidden` ជា state ដែល `refreshDrawerGroups()` សរសេរ (ដូចដើម ៖
  ពេលបើករបា) — ការដេរីវេរាល់ការគូរ ធ្វើឲ្យ DOM ខុសពីដើម (`parity:dom` ចាប់បាន ៣/៣ អេក្រង់)។
- `domText()` ៖ ការបម្លែងដូច setter `innerText` (`undefined` ➜ «undefined») ពេលតម្លៃមកពី
  ទិន្នន័យ — JSX គូរ `{undefined}` ជាទទេ ➜ `parity:deep` ៤០ ជំហានធ្លាក់មុនកែ។

#### អ្នកយាមថ្មី ៖ `npm run purity:check` (ក្នុង `verify`)

| ការវាស់ | វាស់ថាវាធ្លាក់ |
|---|---|
| កូដមុខងារប៉ះ DOM ០ · ការលើកលែងមានហេតុផល **និងពិដានចំនួន** (ពិដានធូរ ឬធាតុងាប់ ➜ ធ្លាក់) | mutation ៣/៣ (`classList` ក្នុង feature · `createElement` ថ្មីក្នុង `document-io` · `elementOf` ក្នុង ui) |
| **ឈ្មោះ ref គ្រប់ឈ្មោះមាន `ref={…}` ពិតចង** (AST មិនមែនវត្តមានអក្សរ) | ✅ ចាប់កំហុសពិតដែលការផ្ទេរជុំនេះបង្កើត ៖ `<video id="configQrVideo">` គ្មាន ref ➜ ស្កេន QR ពេល Config ធ្លាក់ «configQrVideo missing» (browser ៖ មុនកែ ប្រអប់បិទ គ្មាន stream · ក្រោយកែ stream ភ្ជាប់) — tsc · eslint បៃតងលើវា · ការស្កេនអក្សរជំនាន់ដំបូងក៏ **បៃតងក្លែងក្លាយ** (`refTo('x')` ដែលមិនដែលឈរលើ `ref=`) ➜ ប្តូរទៅ AST · mutation ២/២ |
| គ្មាន input ដែល React ចាក់សោ (`value`/`checked` គ្មាន `onChange`) | ✅ tree `2.39.0` ➜ ធ្លាក់ ២ (`rememberMeCheckbox` · `zoomSlider`) |
| ថតទទេ | ✅ ធ្លាក់ (ជាន់អប្បបរមា) |

`slot:check` ពង្រីកទៅ `src/app/**/*.ts` និង `elementOf()` (កូដមុខងារលែងមាន `byId` ➜ ជាន់អប្បបរមា
ចាស់ «ការចង byId >= 100» ធ្លាក់ «ការស្កេនតូចពេក» — វាស់រួចថាវានៅចាប់ `elementOf('phoneSuggestBox').textContent = ''`)។
`src/audit-compat.ts` (**build វាស់តែប៉ុណ្ណោះ**) បកប្រែការសរសេរ class របស់ checker ដើម
(`.collapsed` · `.chrome-hidden` …) ជា state ដដែល ➜ checker វាស់ App React ពិតដោយមិនកែ checker។

#### អ្វីដែលវាស់បាន

| ការវាស់ | លទ្ធផល |
|---|---|
| `npm run verify` (type · lint · slot · **purity** · test · build · parity · smoke · SW · doc · `android:check` · `native:check`) | ✅ ទាំងអស់ · vitest ៥៧ · `android:check` ៤៧ · `native:check` ៦០ |
| `parity` · `parity:dom` · `parity:live` · `parity:deep` · `rules:check` ធៀប ZoeW ដើម | static ១០០% (function ៧៣៥/៧៣៥ + ដកចេញដោយចេតនា ៤ មានហេតុផល) · ធាតុ ៧២១/៧២១ × ៣ អេក្រង់ · ១៨/១៨ · **៧៩/៧៩** · **១១៥/១១៥** |
| `logic:check` | ដូចដើម ៥២០ · ខុសដោយចេតនា ២១៥ · បាត់ ០ · ដកចេញដោយចេតនា ៤ · តំបន់ហាមចូល ៣៣ function (១៣ ដូចដើម · ២០ ខុសដោយហេតុផលកត់ត្រា) |
| `audit-tools/run-all.sh` (emulator រត់) | កំពុងវាស់លើ `main` · `2.39.0` · `2.40.0` ➜ លទ្ធផលក្នុង commit បន្ទាប់ (`ZoeW/docs/PARITY-RESULTS.md` ផ្នែក ៥) |

⛔ **អ្វីដែលមិនបានវាស់** ៖ iPhone PWA ពិត · Android ពិត · APK compile (ដូច `2.39.0`)។
⛔ **តំបន់ហាមចូល (ច្បាប់ ១១) ត្រូវបានផ្លាស់ទីតាមសំណើច្បាស់** ៖ តក្កវិជ្ជាដដែល តែការសាកលើ
ឧបករណ៍ពិតទាំង ២ ប្រព័ន្ធ (PTR · អូសផ្ទាំង · ការលាក់របា) ជាលក្ខខណ្ឌមុន merge។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0` · `2.39.0` នៅដដែល។
២. សាកលើ **iPhone PWA និង Android ពិត** ៖ PTR · អូសផ្ទាំងប្រវត្តិ/ស្កេន · ការលាក់របា Tab ·
   ប្រអប់ស្វែងរកលេខ (auto pull up) · ម៉ាស៊ីនស្កេន hardware · ស្កេន QR ពេល Config ·
   ប្រអប់ធីក «ចងចាំអ៊ីមែល»។
៣. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify** · Android ៖ build APK ថ្មី
   (`npm run android:sync`) បើចង់បានកំណែនេះលើទូរស័ព្ទ។

### [2.39.0] — 2026-09-23 · ZoeW ៖ **App Android (Capacitor)** · lifecycle ជាដំណាក់ · ការវាស់ច្បាប់លុយ/សម្អាត (merge រួចក្នុង PR #247)

**សំណើម្ចាស់គម្រោង** ៖ *«រៀបចំគម្រោងថ្មីហ្នឹង អោយគាំទ្រការ setup Capacitor សម្រាប់តែ
android ផង គាំទ្រ biometric, ptr, និង app logo … អោយ Capacitor ដំណើរការទាំងអស់
បានពេញលេញ»* · *«រៀបចំគម្រោងថ្មី អោយមាន JSX, Component lifecycle និងតម្រង់ state
management»* · *«អោយ APK មានលេខកំណែពិតផង»* · *«ដាក់ប្រវត្តិថយក្រោយ android ផង»* ·
*«សូមផ្ទៀងផ្ទាត់ច្បាប់ លុប/ដក និង auto cleanup ២ម៉ោង ៧ថ្ងៃ ២ថ្ងៃ ៣០ថ្ងៃ ផង»*។

**ZoeW ប្រែ** (`zoew-v223` ➜ `zoew-v224`) · **ZoeKeyGen មិនប្រែ**។

#### អ្វីដែលអ្នកប្រើឃើញ

- **App Android** (`ZoeW/android/` · appId `com.zoesystem.zoew`) ៖ logo ក្រហម-គូបស
  (adaptive · themed · legacy · splash — កើតពីរូបមេ `resources/icon.svg`) ·
  **លេខកំណែ APK = `APP_VERSION`** (`versionCode` = X×1000000 + Y×1000 + Z ដេរីវេពេល
  Gradle build) · ជីវមាត្រតាម **Android Keystore** · PTR · **ប៊ូតុង Back ជាមួយ
  ប្រវត្តិថយក្រោយ** (ម៉ឺនុយ/ប្រអប់/របា Slide ➜ អេក្រង់មុនម្តងមួយជំហាន ➜ បង្រួម
  App · ⛔ មិនត្រឡប់ចូលរបៀប «ដក») · Export ➜ ផ្ទាំង Share · PDF ➜ PrintManager ·
  សោ App ពេល pause/resume · បិទ backup (កៅអី License មិនត្រូវក្លែងតាមការស្តារ)។
- **web/PWA ៖ មិនប្រែ** — លើកលែង ៖ ជួរ 🩺 «របៀបក្រៅបណ្ដាញ» លើ App Android និងសៀវភៅ
  ណែនាំមានផ្នែក «App Android»។
- ZTO Function ៖ CORS **តែ** origin `https://localhost` (App Android) — សំណើ web
  (same-origin) ទទួល header ដូចមុនបេះបិទ។

#### ស្ថាបត្យកម្ម (សម្រាប់ការអភិវឌ្ឍបន្ត ៖ `ZoeW/docs/EXTENDING.md`)

- `src/boot/bootstrap-statements.ts` ➜ **`src/app/lifecycle/boot.ts`** ៖ ដំណាក់ដែលមាន
  ឈ្មោះ តាមលំដាប់ដើមបេះបិទ · `LifecycleScope` (`listen`/`every`/`onLoad`/`onDispose`
  ដកវិញពេល unmount) · `oncePerPage()` សម្រាប់ការចាប់ផ្តើមដែលដកវិញមិនបាន ➜
  StrictMode/HMR មិនបង្កើត listener ស្ទួន។
- `src/platform/` ៖ អ្នកសម្រេច web ធៀប native តែមួយ · plugin ផ្ទុកតាម dynamic
  import ក្នុង chunk `native-plugins` ដែល Service Worker រំលង (web មិនផ្ទុកវាសោះ)។
- `useStoreValue(store, select)` ៖ component គូរឡើងវិញតែពេលតម្លៃដែលអានប្រែ។
- សោ App ៖ `noteAppLockAway()` ច្រានការហៅស្ទួន (`pause` + `visibilitychange`) —
  បើអត់ ការហៅទី ២ ស៊ីការលើកលែងការខល ហើយចាក់សោខុស។ web ៖ ឥរិយាបថដដែល។

#### អ្វីដែលវាស់បាន

| ការវាស់ | លទ្ធផល |
|---|---|
| `npm run verify` (type · lint · test · build · parity · smoke · SW · doc · `android:check` · `native:check`) | ✅ ទាំងអស់ · vitest ៥៧ · `android:check` ៤៧ · `native:check` ៦០ |
| `parity:dom` · `parity:live` · `parity:deep` ធៀប ZoeW ដើម | ធាតុ ៧២១/៧២១ · ១៨ ជំហាន · **៧៩ ជំហាន** ដូចគ្នាបេះបិទ |
| `logic:check` | ដូចដើម ៦៦៣ · ខុសដោយចេតនា ៧៦ · បាត់ ០ · តំបន់ហាមចូល ៣០/៣១ (`setupIOSPullToRefresh` ខុសដោយហេតុផលកត់ត្រា) |
| **`rules:check` (ថ្មី)** ៖ លុប/ដក · ២ម៉ោង · ៧ថ្ងៃ · កញ្ចប់លាយ · ២ថ្ងៃ · ៣០ថ្ងៃ (ទិន្នន័យ ±១ នាទី សងខាងព្រំដែន) · ledger ថ្ងៃ/ខែ · registry · ស្តារ | **១១៥/១១៥** លើ **ZoeW ដើម · React web · React Android** · DB ក្រោយរាល់ជំហាន = ZoeW ដើម |
| mutation លើ `rules:check` ៖ ធុងសំរាម expired ប្រើ ៣០ ថ្ងៃ · ៧ ថ្ងៃ មិនសម្គាល់ `isDeducted` | **២/២ ចាប់បាន** |
| mutation លើ `native:check` ៖ ដក `setupNativeShell` · ដកការចាប់មុន slop របស់ PTR | **២/២ ចាប់បាន** (តែការចាប់មុន slop ត្រូវការសេណារីយ៉ូ «latch របស់ Chromium» ៖ touch ក្លែងរបស់ CDP **មិន** ធ្លាក់ដោយគ្មានវា) |
| mutation លើ `android:check` ៖ `versionName` literal · `allowBackup` · import static ពី plugin · `package.json` ≠ `APP_VERSION` | **៤/៤ ចាប់បាន** · ថតទទេ ➜ ៥៤ FAIL |
| Gradle ពិត ៖ មុខងារដេរីវេកំណែ | `2.38.0` ➜ `2038000` · `2.39.10` ➜ `2039010` · លេខខូច ➜ build បដិសេធ |
| `audit-tools/` តំបន់ហាមចូល លើ tree adapter | `gesture` ១០៧ · `panel-motion` ៤៧ · `ios-panel-glide` ៣៨ — ដូចជុំមុន |
| `audit-tools/` លុយ/សម្អាត (`trash-modal` · `partial-pickup-cleanup` · `expired-trash-retention` · `policy` · …) | **ដូច baseline HEAD បេះបិទ** — តែពួកវា **មិនអាចវាស់ React** (គាំងពេលស្រង់ `app.js`) ➜ អ្នកវាស់ពិតគឺ `rules:check` និង `parity:deep` |
| `app-lock-test` | ធ្លាក់ ១៥ = baseline (regex «ហៅ top level» ពង្រីកទទួល `oncePerPage('app-lock', initAppLock)`) |

⛔ **អ្វីដែលមិនបានវាស់** ៖ APK **មិនបាន compile** ក្នុងម៉ាស៊ីននេះ (`dl.google.com`
ត្រូវ proxy ហាម ➜ គ្មាន Android SDK/AGP) · កូដ Java របស់ plugin · WebView ពិត ·
Keystore · ទូរស័ព្ទពិត។ `native:check` វាស់ផ្លូវ JS ដល់ព្រំដែន bridge **តែប៉ុណ្ណោះ**។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** — លក្ខខណ្ឌរបស់ `2.38.0` នៅដដែល (សាកលើ iPhone PWA +
   Android ពិត · ផ្ទេរ checker · `repository-file-coverage` · `ZoeW/docs/MIGRATION.md`
   ដំណាក់ ២)។
២. **Build APK** ៖ `cd ZoeW && npm install && npm run android:sync && npm run
   android:open` ➜ Android Studio ➜ Generate Signed APK។ ⛔ **រក្សា keystore** (បាត់ ➜
   APK ថ្មីដំឡើងជាន់ចាស់មិនបាន) · ⛔ កុំ commit វា។
៣. **ZTO Lookup ក្នុង App Android** ត្រូវការ Function ដែលមាន CORS ថ្មី ➜ ដំណើរការ
   តែក្រោយ deploy កូដនេះទៅ `https://zoew.netlify.app` (តម្លៃក្នុង `ZoeW/.env.android`)។
៤. **Firebase** ៖ បើ API key មានការរឹតបន្តឹង HTTP referrer ➜ បន្ថែម `https://localhost`។
៥. **License** ៖ App Android និង PWA លើទូរស័ព្ទដដែល = **២ កៅអី** ក្នុង Key។
៦. សាកលើទូរស័ព្ទពិតតាមតារាង ១៣ ជួរ ក្នុង `ZoeW/docs/ANDROID.md` ផ្នែក ៥ —
   ⛔ ជាពិសេស **PTR** (តំបន់ហាមចូល ច្បាប់ ១១ — ប៉ះតាមសំណើច្បាស់ ផ្លូវ iOS មិនប្រែ) ·
   ប៊ូតុង Back · ជីវមាត្រ (រួម «ក្រយៅដៃត្រូវប្តូរ») · របាស្ថានភាពលើ WebView ចាស់/ថ្មី។
៧. ⛔ **គ្មានការកែ Firebase rules** · **គ្មាន env ថ្មីលើ Netlify**។

### [2.38.0] — 2026-09-23 · ZoeW ជា **React + TypeScript + Vite** (merge រួចក្នុង PR #247)

**សំណើម្ចាស់គម្រោង** ៖ *«ខ្ញុំចង់អោយ app ZoeW មាន framework និង build step
ត្រឹមត្រូវ … កុំអោយបាត់មុខងារ ទោះ ០.១%»* រួច *«បើអាចជំនួស ZoeW បាន សូម commit
push ចូល ZoeW»* និង *«រត់ full suits ហើយ commit push»*។

#### អ្វីដែលប្រែ

- `ZoeW/` ទាំងមូលជំនួសដោយគម្រោង React 19 + TypeScript + Vite ៖ កូដតក្កវិជ្ជា
  ក្នុង `src/core` · `src/domain` · `src/features` · `src/services` · `src/ui`
  **កើតពី `app.js` ដើមដោយ codemod** (ឈ្មោះ function · ថេរ · កូនសោ storage
  ដដែល) ហើយ UI ទាំងមូលជា React component។ `style.css` **ដូចដើម byte-for-byte**។
- Netlify ៖ Build command `npm run build` · Publish `dist` (កំណត់ក្នុង
  `ZoeW/netlify.toml`)។ Function ZTO **ដូចដើម byte-for-byte**។
- `license-verify.js` · `error-reporting.js` នៅ byte-identical ជាមួយ ZoeKeyGen
  (ឥឡូវរស់នៅ `ZoeW/public/`)។

#### អ្វីដែលវាស់បាន (លម្អិត ៖ `ZoeW/docs/PARITY-RESULTS.md`)

| ការវាស់ | លទ្ធផល |
|---|---|
| កាតាឡុក (function · ថេរ · state · `data-act` · id · កូនសោ storage · អត្ថបទ · CSS) | ១០០% ទាំង ៨ អ័ក្ស |
| DOM និង layout ទំហំអេក្រង់ ៣ | ធាតុ ៧២១/៧២១ ដូចគ្នា |
| ជំហាន ៧៩ (ផ្លូវលុយ · ចាកចេញ/ចូលវិញ · ZTO · Google Sheet · PDF) × ៦ ជាន់ | ដូចគ្នាបេះបិទ ធៀបនឹង App ដើមដែលកំពុងរត់ |
| function ធៀបដើមតាម token | ដូចគ្នា ៦៧៥ · ខុសដោយចេតនា ៦៤ · បាត់ ០ · តំបន់ហាមចូល ៣០/៣១ (`setupIOSPullToRefresh` ខុសដោយចេតនា) |
| checker តំបន់ហាមចូលរបស់ `audit-tools/` លើ App React | `gesture` ១០៧ · `panel-motion` ៤៧ · `ios-panel-glide` ៣៨ — បៃតង |
| **`audit-tools/run-all.sh` ទាំងមូល** (tree សម្រួល) | ✅ **៥៨** · ❌ **១២០** · ⏭️ ៣ (គ្មាន emulator) |

⛔ **ការធ្លាក់ ១២០ ភាគច្រើនជា *រចនាសម្ព័ន្ធ*** — checker ស្រង់អត្ថបទពី
`app.js` · អាន markup ថេរក្នុង `index.html` · ជំនួស `window.<fn>` ដែលការហៅ
ខាងក្នុង module មិនឆ្លងកាត់ ➜ **ពួកវាមិនបានវាស់ App នេះ**។ ⛔ ការធ្លាក់ទាំងនោះ
**មិនត្រូវបានពិនិត្យម្តងមួយៗទាំងអស់ទេ** ➜ «រចនាសម្ព័ន្ធ» ជាការចាត់ថ្នាក់តាម
គំរូ មិនមែនការធានា។ ការរត់ដោយផ្ទាល់លើ repo (គ្មាន tree សម្រួល) ៖ checker ZoeW
ស្ទើរទាំងអស់ធ្លាក់ដោយ `ENOENT … ZoeW/app.js`។

#### កំហុសពិតដែល checker ដើមរកឃើញ (parity មើលមិនឃើញ) — កែរួច

| កំហុស | អ្នកចាប់ |
|---|---|
| `"type": "module"` ក្នុង `ZoeW/package.json` ➜ Node ផ្ទុក Function ZTO (`require`) ជា ES module ➜ `require is not defined` | `zto-proxy-test` |
| `package-lock.json` ឃ្លាតពី `package.json` (ឈ្មោះ · កំណែ · `engines` · react ក្នុង `dependencies`) | `repository-contract-test` |
| `ZoeW/README.md` ក្លាយជាឯកសារអ្នកអភិវឌ្ឍ ➜ បាត់ផ្នែក ៥ នៃច្បាប់ ៩ និងខ្លឹមសារ «របៀបប្រើ» | `doc-scope-test` |
| build ship sourcemap ដែលផ្ទុក comment (ច្បាប់ ៣) | ការពិនិត្យដោយដៃ |
| `firebase-loader.js` ក្នុង `public/` មាន comment (ច្បាប់ ៣) | `comments` |

⛔ **មេរៀន** ៖ parity ប្រៀបធៀប **App** ចាស់នឹងថ្មី — តែ Function ខាង server ·
`package.json` · ឯកសារ repo **ស្ថិតក្រៅ App** ➜ harness parity ក្លែង ZTO តាម
`route` ហើយ **មិនដែលផ្ទុក Function ពិតសោះ**។ checker ដើមនៅតែចាំបាច់។

#### ⛔ សកម្មភាពដែលត្រូវធ្វើដោយដៃ

១. ⛔ **កុំ merge ចូល `main`** ។ លក្ខខណ្ឌ ៖ (ក) សាកលើ **iPhone (PWA លើអេក្រង់
   ដើម) និង Android ពិត** — PTR · ចលនាផ្ទាំងប្រវត្តិ · ការរមូរ (ច្បាប់ ១១);
   (ខ) checker របស់ `audit-tools/` ត្រូវវាស់ App នេះបានពិត (ផ្ទេរទៅ `src/**` ឬ
   ហៅតាម module) និងចាត់ឯកសារថ្មីក្នុង `audit-tools/repository-file-coverage.json`
   (ឥឡូវ `repository-file-coverage` ធ្លាក់ ៖ ឯកសារថ្មីគ្មានអ្នកយាម)។ លម្អិត ៖
   `ZoeW/docs/MIGRATION.md` ដំណាក់ ២។
២. ការសាកលើ deploy preview មាន **origin ផ្សេង** ➜ ត្រូវ Activate ម្តងទៀត ➜
   ⛔ **ស៊ីកៅអីឧបករណ៍** (`maxDevices`) ➜ ប្រើ Key សាកល្បង ឬសុំ admin ដោះកៅអីក្រោយ
   សាករួច។
៣. ⛔ **`check-money.cmd` (`tools/money-check-windows/`) លែងដើរលើ branch នេះ** —
   `money-reality-check.js` ស្រង់ **កូដលុយពិត** ពី `ZoeW/app.js` ដែលលែងមាន ➜
   ការវាស់លុយលើ dump ផលិតកម្ម ត្រូវរត់ពី `main` រហូតដល់ឧបករណ៍នោះត្រូវផ្ទេរ។
៤. ⛔ **គ្មានការកែ Firebase rules** · **គ្មានការប្តូរ env**។ ZoeKeyGen មិនប្រែ។

## 🐛 ផ្នែក ២ — ប្រវត្តិកំហុស និងលេខដែលវាស់បាន (សម័យ React)

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


### ការផ្ទេរ ZoeW ទៅ React ៖ ការរកឃើញ · ការពង្រឹង · លេខ parity ដែលវាស់បាន (ធ្លាប់ជា `ZoeW/docs/ADDED-VALUE.md` · `PARITY-RESULTS.md`)

> ⛔ **បណ្ណសារ** ៖ លេខក្នុងនេះជារូបភាពនៃថ្ងៃដែលវាត្រូវវាស់ — ផលិតលេខថ្មីដោយ `npm --prefix ZoeW run parity:all` (វិធីសាស្ត្រ ៖
> [`ZoeW/docs/PARITY.md`](../ZoeW/docs/PARITY.md))។ ច្បាប់ដែលនៅរស់រស់នៅ [`ZoeW/docs/ARCHITECTURE.md`](../ZoeW/docs/ARCHITECTURE.md) និង `CLAUDE.md`។

#### ក. ការរកឃើញ និងការពង្រឹង (`ADDED-VALUE.md`)

> អ្នកប្រើស្នើ ៖ *«បើមានចំនុចខ្វះខាតសូមជួយអភិវឌ្ឍន៍បន្ថែមផង»*។
> ផ្នែកខាងក្រោមរាយអ្វីដែល **បន្ថែមលើ** ការផ្ទេរមុខងារ ១:១ ។

---

#### ១. ចន្លោះពិតដែលរកឃើញ និងបិទ

ការសាងឡើងវិញនេះបានចាប់បញ្ហា **៤** ដែលនឹងក្លាយជាកំហុសពិតលើផលិតកម្ម ៖

| # | បញ្ហា | របៀបដែលវាចាប់បាន | ការដោះស្រាយ |
|---|---|---|---|
| ១ | `body { display: flex }` ជាមួយ `order:` លើរបា ➜ ធាតុរុំរបស់ React នឹង **បំបែក layout desktop** | ការអានច្បាប់ CSS មុនសរសេរ + ការវាស់ layout | `#root { display: contents }` |
| ២ | `window.addEventListener('load', …)` នឹង **មិនបាញ់ជារៀងរហូត** បើ React mount ក្រោយ `load` ➜ App មិនចាប់ផ្តើមសោះ | ការវិភាគលំដាប់ចាប់ផ្តើម | `scope.onLoad()` (`src/app/lifecycle/scope.ts`) — រត់ភ្លាមបើផ្ទុករួច |
| ៣ | React **មិនដាក់ attribute `muted`** លើ `<video>` ➜ ច្បាប់ autoplay លើ iOS អាចបដិសេធកាមេរ៉ា | `parity-dom.mjs` ចាប់បានថា attribute បាត់ | `ref` ដែលដាក់ attribute មកវិញ |
| ៤ | ការ dedent របស់ codemod កាត់ចូល **ខាងក្នុង template literal** ➜ HTML នាំចេញ និងរបាយការណ៍ប្រែ | ការវាស់អត្ថបទខ្មែរ ១០០% | dedent ក្លាយជា edit លើអត្ថបទដើម ដោយចេះជៀស quasi |

⛔ ចំណុចទី ៣ និងទី ៤ **មើលមិនឃើញដោយការអានកូដ** — មានតែការវាស់ទេដែល
ចាប់វាបាន។

---

#### ២. ការពង្រឹងដែលជាប់មកជាមួយស្ថាបត្យកម្មថ្មី

##### បញ្ជីសំបករបស់ Service Worker ឈប់ខូចដោយស្ងាត់

ZoeW ដើមសរសេរ `CORE_SHELL` ដោយដៃ។ ធនធានថ្មីដែលភ្លេចដាក់ចូល ➜ **ការស្កេន
ស្លាប់ស្ងាត់ៗពេលក្រៅបណ្តាញ** ។ ឥឡូវបញ្ជីនោះ **ដេរីវេពី `dist/` ពិត** ➜
ថ្នាក់កំហុសនោះលុបចោលតាមរចនាសម្ព័ន្ធ។

##### ព្រំដែនសកម្មភាពពិនិត្យបានពេល build

`window[name]` ➜ ចុះបញ្ជីដែល import ពីម្ចាស់។ ឈ្មោះដែលបាត់ ➜ **build ធ្លាក់**
ជំនួសប៊ូតុងដែលចុចមិនដើរលើផលិតកម្ម។

##### XSS ឈប់ពឹងលើវិន័យ

`sanitizeInput()` នៅមានដដែលសម្រាប់ផ្លូវដែលនៅជា HTML string។ តែតារាងស្នូល
ទាំង ៣ (ប្រវត្តិ · បញ្ជីស្កេន · បញ្ជី Locker) ឥឡូវជា React ➜ **ការគេច
អក្សរជាលំនាំដើម** ។

##### Cache របស់ browser ឈប់ចាស់

ឈ្មោះឯកសារមាន hash ➜ `Cache-Control: immutable` លើ `/assets/*` ➜ អ្នកប្រើ
ទទួលកូដថ្មីភ្លាម ខណៈធនធានចាស់ cache បានយូរ។

##### ការពិនិត្យ type ឆ្លង module ៧០+

ZoeW ដើមគ្មានការពិនិត្យសោះ។ ការពិនិត្យថ្មីបានចាប់ឃើញ **អាគុយម៉ង់លើស**
ក្នុងការហៅ `removeSingleBarcode(itemId, barcodeCode, 'scan-confirmed')` ដែល
មិនដែលអាន — ឥឡូវវាសម្គាល់ច្បាស់ជាជាងលាក់។

---

#### ៣. ឧបករណ៍វាស់ថ្មី

| ឧបករណ៍ | អ្វីដែលវាចាប់ |
|---|---|
| `scripts/parity-static.mjs` | មុខងារ · ថេរ · state · សកម្មភាព · id · កូនសោ · អត្ថបទ · CSS ដែលបាត់ |
| `scripts/parity-dom.mjs` | DOM និង layout ខុសគ្នា លើទំហំអេក្រង់ ៣ |
| `scripts/parity-live.mjs` | លទ្ធផលខុសគ្នា **ជាមួយទិន្នន័យពិត** រួមទាំង *ការសរសេរទៅ server* |
| `scripts/smoke.mjs` | កំហុស runtime ពេល boot |
| `tests/history-row-parity.test.tsx` | ការគូរជួរដេក និងការចុច ខុសពីដើម |
| `scripts/run-audit-tools.mjs` | រត់ checker របស់ ZoeW ដើមលើ tree ថ្មី |

⛔ ឧបករណ៍ទាំងនេះ **មិនមែនតេស្តដែលអះអាងតាមការរំពឹងទុកដែលសរសេរដោយដៃទេ** ៖
ពួកវាប្រៀបធៀបនឹង **App ចាស់ដែលកំពុងរត់ពិតៗ** ➜ ពួកវាមិនអាចខុសទាំងស្រុង
ក្នុងទិសដៅដដែលបានទេ។

---

#### ៤. អ្វីដែល **មិន** ធ្វើ ដោយចេតនា

| អ្វី | ហេតុអ្វី |
|---|---|
| bundle Firebase SDK ពី npm | វានឹងលុបផ្លូវស្តារ «SDK ផ្ទុកមិនបាន» ទាំងមូល |
| bundle SheetJS / ZXing | CSP ហាម CDN ហើយធនធានក្នុង origin ធ្វើឲ្យស្កេនដើរក្រៅបណ្តាញ |
| បំបែក `style.css` ជាច្រើនឯកសារ | លំដាប់ cascade ជាផ្នែកនៃឥរិយាបថ (មានប្លុក `@media` ២ ដែលពឹងលើគ្នា) |
| ប្តូរ PTR · ចលនាផ្ទាំង · ការរមូរ | តំបន់ដែលត្រូវការជុំកែច្រើន និងការថយក្រោយ ២ ដងទើបត្រូវ |
| ប្តូរច្បាប់លុយណាមួយ | ការផ្ទេរ ១:១ ជាលក្ខខណ្ឌនៃ parity |
| បំលែង renderer ក្នុងប្រអប់ទៅ React | មុខងារមិនប្រែ; ហានិភ័យមិនសមនឹងផល — មើលផ្នែកបន្ទាប់ |

---

#### ៥. ការគូរទាំងអស់ជា React

រាល់ផ្ទៃដែលអ្នកប្រើឃើញ ត្រូវគូរដោយ React ៖ តារាងប្រវត្តិ · បញ្ជីស្កេន ·
បញ្ជី Locker · ធុងសំរាម · របាយការណ៍ខែ · កាតស្ថិតិ ២ · តារាងអតិថិជន ·
ពិនិត្យសុខភាព · បញ្ជីកញ្ចប់ក្នុងប្រអប់ · ក្រឡា Locker · ម៉ឺនុយ (...) ·
ការណែនាំលេខទូរស័ព្ទ · របា ZTO និងប្រអប់របស់វា · មើលជាមុនការទាញបញ្ជី ZTO ·
ផ្ទៃបោះពុម្ព PDF · **toast** · **របា «មានកំណែថ្មី»** · **សញ្ញា PTR** ·
និង **ប្រអប់នាំចូល Excel ទាំងមូល** (សារ ៥ · សេចក្តីសង្ខេប · chip ·
មើលជាមុន · `<select>` ទាំង ៥)។

រូបរាង ២ ៖

| រូបរាង | អត្ថន័យ | ឧទាហរណ៍ |
|---|---|---|
| **slot** | React ជាម្ចាស់ *មាតិកា* នៃធាតុដែលមានស្រាប់ | `historyTableBody` · `siChips` · `toastContainer` |
| **element slot** | React ជាម្ចាស់ *ធាតុទាំងមូល* | `<select>` ទាំង ៧ (តម្លៃជា state ➜ ការទុកឲ្យ DOM កាន់តម្លៃ ខណៈ React គូរជម្រើស បង្កើតការប្រណាំងលំដាប់) |

##### អ្វីដែល *នៅ* imperative ដោយចេតនា (ច្រកចេញ — React គ្មានទម្រង់ប្រកាស)

| កន្លែង | ហេតុអ្វី |
|---|---|
| focus · តម្លៃ input · ការរមូរ · FLIP របស់ផ្ទាំង (`animate()`) | ច្រកចេញតែមួយ `src/app/refs.ts` — ច្រកចេញបន្ទាន់ដែល React ណែនាំ (input ជា uncontrolled) |
| វីដេអូកាមេរ៉ា (`srcObject` · `muted`) | React គ្មាន prop `srcObject` · React មិនសរសេរ attribute `muted` (iOS autoplay) |
| listener `touch*` របស់ការអូសផ្ទាំង | React ចាក់ listener `touch*` ជា passive ➜ `preventDefault()` របស់ iOS មិនដើរ |
| `<html>`/`<body>` (class · អថេរ CSS · overflow · title) | ក្រៅ `#root` ➜ `DocumentEffects` ពី state (`useLayoutEffect`) |

⛔ **សញ្ញា PTR គូរដោយ React** (`ptrState` ➜ `PtrIndicator`) រាល់ `touchmove` ក្នុងការ dispatch ដដែល
(`native-check` វាស់) — លែងជាការសរសេរ `style` ផ្ទាល់ទៀតហើយ។
| `<link rel=preconnect>` · `<script>` loader · `<canvas>` ក្រៅអេក្រង់ · `<a download>` | នៅក្រៅ `#root` ឬមិនដែលចូល DOM ➜ រស់ក្នុង `src/platform/document-io.ts` តែមួយ (ការលើកលែងមានហេតុផល និងពិដានចំនួនក្នុង `purity:check`) |

⛔ ក្រៅពីនេះ **React ជាម្ចាស់ DOM តែមួយ** ៖ កូដមុខងារ (`core` · `domain` · `features` ·
`services` · `ui` · `platform`) ប៉ះ DOM **០** កន្លែង — ប្រអប់ · អត្ថបទ · class ស្ថានភាព ·
ប៊ូតុងរវល់ ជា state ដែល JSX គូរ (`ARCHITECTURE.md` ផ្នែក ១១)។

##### អ្នកយាមដែលបន្ថែមក្នុងជុំនេះ

| អ្នកយាម | អ្វីដែលវាចាប់ | បានវាស់ថាធ្លាក់ |
|---|---|---|
| `FUNCTION_REPLACEMENTS` ស្ទួន | ការជំនួស ២ លើ function តែមួយ ➜ ធាតុចុងក្រោយសរសេរជាន់មុន **ដោយស្ងាត់** | ✅ (វាចាប់កំហុសពិត ៖ `renderLockerList` មាន ២ ជំនាន់ ➜ `<select>` នៅសរសេរ `innerHTML`) |
| «element slot គ្មានព្រឹត្តិការណ៍» | React យកធាតុទាំងមូល តែភ្លេចចង handler ➜ ប៊ូតុងស្លាប់ស្ងាត់ៗ | ✅ |
| `tests/code128-parity` | រូប Barcode ដែល React គូរ ខុសពីកំណែដើមដែលឌិកូដដោយ ZXing រួច ➜ **កញ្ចប់ខុសត្រូវបិទក្នុង ZTO** | ✅ (mutation លើ `viewBox` ➜ ក្រហម ៦/៧) |
| `npm run slot:check` | កូដ imperative ប៉ះកូនរបស់ slot React ➜ **App ស** · ទិន្នន័យអតិថិជនត្រឡប់មកវិញក្រោយចាកចេញ | ✅ (ចាប់កំហុសពិត ៣ ឯកសារ · ៣៣ កន្លែង) |
| `reset:` ចាំបាច់ក្នុង `SLOTS` | slot ថ្មីដែលគ្មានការសម្អាតតាម store | ✅ (ការផលិតធ្លាក់) |
| `npm run parity:deep` | ផ្លូវលុយ · ចាកចេញ · ZTO · Sheet · PDF ខុសពីដើម — **៦ ជាន់** រាល់ជំហាន | ✅ (ចាប់ ៖ App ស · ជួរ 🩺 ទទេ · `style=""`) |
| `tests/health-row-parity` + type `HealthRow[]` | ជួរ 🩺 ត្រឡប់ HTML ជំនួស model | ✅ (TypeScript បដិសេធ) |
| `npm run purity:check` | កូដមុខងារប៉ះ DOM ផ្ទាល់ (React លែងជាម្ចាស់តែមួយ) · component ស្វែងរក DOM តាម id · **ឈ្មោះ ref ដែលគ្មាន `ref={…}` ចង** (➜ `elementOf()` = `null` ជានិច្ច) | ✅ (ចាប់កំហុសពិត ៖ ស្កេន QR ពេល Config ធ្លាក់ «configQrVideo missing» — វាស់ក្នុង browser ៖ មុនកែ គ្មាន stream · ក្រោយកែ stream ភ្ជាប់ · mutation ៥/៥ ចាប់ · ថតទទេ ➜ ធ្លាក់) |

#### ខ. លទ្ធផល parity ឆៅ (`PARITY-RESULTS.md`)

> ⚠️ ឯកសារនេះជា **លទ្ធផលឆៅ** នៃការរត់ឧបករណ៍វាស់។ វិធីសាស្ត្រ និងហេតុផល
> ស្ថិតក្នុង [`PARITY.md`](../ZoeW/docs/PARITY.md) ។ ផលិតវាឡើងវិញដោយ `npm run parity:all`
> និង `npm test` ។

---

#### ១. កាតាឡុក (`npm run parity`)

```
╔══════════════════════════════════════════════════════════════════════╗
║  របាយការណ៍ parity ៖ ZoeW (ដើម) ➜ ZoeW React (React + Vite)            ║
╚══════════════════════════════════════════════════════════════════════╝

✅ Function កម្រិតកំពូល         735/735    100.00%
✅ បញ្ជី «ដកចេញដោយចេតនា» មិនងាប់     4/4      100.00%
✅ ថេរ (const)                  213/213    100.00%
✅ State (let)                  176/176    100.00%
✅ សកម្មភាព (data-act)          118/118    100.00%
✅ id ក្នុង index.html          263/263    100.00%
✅ កូនសោ storage                 46/46     100.00%
✅ អត្ថបទដែលអ្នកប្រើអាន         777/777    100.00%
✅ បញ្ជីអត្ថបទ «ដកចេញដោយចេតនា» មិនងាប់     1/1      100.00%
✅ style.css (byte)               1/1      100.00%

🗑️  function ដើមដែលដកចេញដោយចេតនា ៖ 4 (scripts/intentional-removals.mjs)
      • readActionArgs
      • runElementAction
      • setupActionDelegation
      • code128SvgElement

Module ថ្មី ៖ 186 ឯកសារ
Function ដែល export ៖ 978
វាល state ៖ 176
```

---

#### ២. DOM និង layout (`npm run parity:dom`)

```
╔══════════════════════════════════════════════════════════════════════╗
║  parity នៃ DOM និង layout ៖ ZoeW ដើម ធៀបនឹង ZoeW React              ║
╚══════════════════════════════════════════════════════════════════════╝

✅ ទូរស័ព្ទ  390×844   ធាតុ 721/721  ·  layout 18/18
✅ ថេប្លេត  800×1000   ធាតុ 721/721  ·  layout 18/18
✅ Desktop 1440×900   ធាតុ 721/721  ·  layout 18/18

✅ DOM និង layout ដូចគ្នាគ្រប់ទំហំអេក្រង់
```

---

#### ៣. ទិន្នន័យពិត និងអន្តរកម្ម (`npm run parity:live`)

⛔ App ទាំង ២ ភ្ជាប់នឹង **Firebase ក្លែងក្លាយតែមួយ** ➜ លេខ · លុយ · ការសរសេរ
ទៅ server ត្រូវប្រៀបធៀបលើទិន្នន័យដដែល រួចដើរជំហានអន្តរកម្ម ១៨ ដូចគ្នាបេះបិទ។

```
╔══════════════════════════════════════════════════════════════════════╗
║  parity ជាមួយទិន្នន័យ ៖ ZoeW ដើម ធៀបនឹង ZoeW React                   ║
╚══════════════════════════════════════════════════════════════════════╝

✅ historyRows                  3
✅ historyTable                 ដូចគ្នា (4286 តួ)
✅ entryList                    ដូចគ្នា (0 តួ)
✅ lockerList                   ដូចគ្នា (0 តួ)
✅ trashList                    
✅ count                        3
✅ grandTotalCount              4
✅ todayTotalCount              0
✅ todayClosedCount             1
✅ todayPackagesPickedUpCount   1
✅ summaryCodDollar             $19.50
✅ summaryCodRiel               79,950 ៛
✅ summaryDodDollar             $6.75
✅ summaryDodRiel               27,675 ៛
✅ summaryTotalDollar           $26.25
✅ summaryTotalRiel             107,625 ៛
✅ statusText                   ភ្ជាប់ Server រួចរាល់
✅ writeLog                     txn zoew_scan_history_cod_dod/i2,update zoew_recently_deleted_cod_dod
✅ listenerThrew                null
✅ rejections                   

កំហុស runtime ៖ ដើម 0 · ថ្មី 0

── អន្តរកម្មជាបន្តបន្ទាប់ ──
✅ តម្រង «ទាំងអស់»                ធាតុ 801/801  អេក្រង់ប្រែ
✅ ប្រអប់បញ្ជីកញ្ចប់              ធាតុ 813/813  អេក្រង់ប្រែ
✅ បិទប្រអប់បញ្ជី                 ធាតុ 813/813  អេក្រង់ប្រែ
✅ ទំព័រស្កេន                     ធាតុ 837/837  អេក្រង់ប្រែ
✅ របៀប Locker                    ធាតុ 851/851  អេក្រង់ប្រែ
✅ របៀបដក                         ធាតុ 851/851  អេក្រង់ប្រែ
✅ ត្រឡប់របៀបកញ្ចប់               ធាតុ 851/851  អេក្រង់ប្រែ
✅ ត្រឡប់ទំព័រទិន្នន័យ            ធាតុ 851/851  អេក្រង់ប្រែ
✅ ម៉ឺនុយ (...) ខាងលើ             ធាតុ 858/858  អេក្រង់ប្រែ
✅ ធុងសំរាម                       ធាតុ 908/908  អេក្រង់ប្រែ
✅ បិទធុងសំរាម                    ធាតុ 908/908  អេក្រង់ប្រែ
✅ របាយការណ៍ខែ                    ធាតុ 963/963  អេក្រង់ប្រែ
✅ បិទរបាយការណ៍ខែ                 ធាតុ 963/963  អេក្រង់ប្រែ
✅ បើករបា Slide                   ធាតុ 963/963  អេក្រង់ប្រែ
✅ ពន្លា Category «ការតភ្ជាប់»    ធាតុ 963/963  អេក្រង់ប្រែ
✅ ពន្លា Category «ឧបករណ៍»        ធាតុ 963/963  អេក្រង់ប្រែ
✅ បិទរបា Slide                   ធាតុ 963/963  អេក្រង់ប្រែ
✅ តម្រង «ថ្ងៃនេះ» វិញ            ធាតុ 963/963  អេក្រង់ប្រែ

── តារាងទំព័រស្កេន (មានទិន្នន័យ) ──
✅ បញ្ជីកញ្ចប់ថ្ងៃនេះ         768 តួ
✅ បញ្ជីតាម Locker            312 តួ

កំហុស runtime សរុប ៖ ដើម 0 · ថ្មី 0
ជំហានដែលមិនប្តូរអេក្រង់ ៖ 0/18

✅ គ្រប់វាល 20 · គ្រប់ជំហាន 18 · គ្រប់តារាង ដូចគ្នាបេះបិទ
```

---

#### ៣ខ. ផ្លូវលុយ · ចាកចេញ · ZTO · Google Sheet · PDF (`npm run parity:deep`)

⛔ **ហេតុអ្វីមានជាន់នេះ** ៖ `parity:live` មិនដែល **សរសេរលុយ** ទេ (គ្មានជំហានណា
ស្កេន · បិទ · ដក · ស្តារ) ហើយវាប្រៀបធៀបត្រឹម `op + path` នៃការសរសេរ — App ២
អាចសរសេរ **ចំនួនលុយខុសគ្នា** ទៅ path ដដែល ហើយវានៅតែរាយ ✅។

រាល់ជំហានប្រៀបធៀប **៦ ជាន់** ៖ អេក្រង់ទាំងមូល (រួមតម្លៃ form control) · ការសរសេរ
ទៅ server (**តម្លៃពេញ**) · ស្ថានភាព DB **ទាំងមូល** · ប្រអប់ `confirm`/`alert` ·
តួសំណើទៅ Apps Script/ZTO · សារ toast តាមលំដាប់ — បូក **ផ្ទៃបោះពុម្ព PDF** តាមក្រឡា។
នាឡិកា browser **ឈប់** ហើយរំកិលដោយចំនួនដូចគ្នាទាំង ២ App ➜ ត្រា «ឥឡូវ» ស្មើគ្នា។
ជំហានដែល **មិនប្តូរអ្វីសោះ** រាប់ជាការធ្លាក់ (វាមិនបានវាស់អ្វីទេ)។

```
╔══════════════════════════════════════════════════════════════════════╗
║  parity ជម្រៅ ៖ ផ្លូវលុយ · ចាកចេញ/ចូលវិញ · ប្រអប់ (ZoeW ដើម ➜ Next)  ║
╚══════════════════════════════════════════════════════════════════════╝

── សេណារីយ៉ូ ៖ ស្នូល (ស្កេន · លុយ · ធុងសំរាម · PIN · នាំចូល · ចាកចេញ) ──
✅ ទំព័រស្កេន                         សរសេរ  0
✅ ស្កេន NEW1 ➜ ប្រអប់លេខទូរស័ព្ទ     សរសេរ  0
✅ បំពេញ ➜ យល់ព្រម (សរសេរលុយ)         សរសេរ  4  🔔
✅ ស្កេន AA1 ស្ទួន                    សរសេរ  0  🔔
✅ ត្រឡប់ទំព័រទិន្នន័យ                សរសេរ  0
✅ តម្រង «ទាំងអស់»                    សរសេរ  0
✅ បិទកញ្ចប់ 012345678                សរសេរ  4  🔔  💬
✅ បើកវិញ 012345678                   សរសេរ  4  🔔  💬
✅ បញ្ជី ➜ បិទ barcode ទី ២           សរសេរ  4  🔔  💬
✅ កែតម្លៃ barcode ទី ១               សរសេរ  4  🔔
✅ បិទប្រអប់បញ្ជី                     សរសេរ  0
✅ សម្គាល់ការខល «អត់លើក»              សរសេរ  1  🔔
✅ កែលេខទូរស័ព្ទ 0888888              សរសេរ  1  🔔
✅ លុបកញ្ចប់ 0888889                  សរសេរ  2  🔔  💬
✅ ធុងសំរាម                           សរសេរ  0
✅ ស្តារធាតុទី ១                      សរសេរ  5  🔔
✅ លុបជាអចិន្ត្រៃយ៍ធាតុទី ១           សរសេរ  3
✅ បិទធុងសំរាម                        សរសេរ  0
✅ របៀបដក ➜ ស្កេន CC1                 សរសេរ  0
✅ បញ្ជាក់ការដក (ដកលុយ)               សរសេរ  4  🔔
✅ របៀប Locker ➜ ស្កេន NEW1           សរសេរ  1  🔔
✅ ត្រឡប់របៀបកញ្ចប់ ➜ ទំព័រទិន្នន័យ   សរសេរ  0
✅ អត្រាប្រាក់ 4200                   សរសេរ  1  🔔
✅ ស្ថិតិប្រចាំថ្ងៃ                   សរសេរ  0
✅ បិទស្ថិតិ                          សរសេរ  0
✅ ចំណូលប្រចាំថ្ងៃ                    សរសេរ  0
✅ បិទចំណូល                           សរសេរ  0
✅ ស្វែងរក «015»                      សរសេរ  0
✅ សម្អាតការស្វែងរក                   សរសេរ  0
✅ Reset ចំនួនយករួច ➜ កំណត់ PIN       សរសេរ  1  🔔  💬
✅ របា Slide ➜ ពិនិត្យសុខភាព          សរសេរ  0
✅ បិទពិនិត្យសុខភាព                   សរសេរ  0
✅ នាំចូល Excel ➜ PIN                 សរសេរ  0
✅ រក្សាទុកការតភ្ជាប់ Sheet           សរសេរ  0  🔔  📤
✅ ជ្រើសឯកសារ CSV                     សរសេរ  0  📤
✅ ផ្គូផ្គង Barcode · DOD · Phone     សរសេរ  0
✅ ផ្គូផ្គង COD ➜ ជួរឈរ C             សរសេរ  0
✅ ផ្គូផ្គង COD ➜ មិនប្រើ             សរសេរ  0
✅ ផ្គូផ្គង COD ➜ ជួរឈរ C វិញ         សរសេរ  0
✅ របៀប «ថ្មីតែប៉ុណ្ណោះ»              សរសេរ  0
✅ នាំចូលទៅ Sheet                     សរសេរ  0  🔔  📤
✅ សម្អាតទិន្នន័យក្នុង Sheet          សរសេរ  0  🔔  💬  📤
✅ បិទប្រអប់នាំចូល                    សរសេរ  0
✅ កែទឹកប្រាក់/កញ្ចប់ (PIN)           សរសេរ  2  🔔
✅ តម្រងថ្ងៃផ្ទាល់ខ្លួន 2026-09-21    សរសេរ  0
✅ តម្រង «ទាំងអស់» វិញ                សរសេរ  0
✅ កំណត់ទូ Locker (PIN)               សរសេរ  0  🔔
✅ ប្តូរទូ ➜ ក្រឡាទី ៣                សរសេរ  0  🔔
✅ ត្រឡប់ទំព័រទិន្នន័យ (២)            សរសេរ  0
✅ របាយការណ៍ខែ ➜ ជ្រើសខែ              សរសេរ  0
✅ របាយការណ៍ខែ ➜ PDF                  សរសេរ  0
✅ Export ➜ PDF (ប្រវត្តិ)            សរសេរ  0
✅ ចាកចេញ                             សរសេរ  0  🔔
✅ ទិន្នន័យអតិថិជនក្រោយចាកចេញ         ដើម [] · ថ្មី []
✅ ចូលវិញ                             សរសេរ  0  🔔
✅ ទំព័រស្កេនក្រោយចូលវិញ              សរសេរ  0
✅ បញ្ជី Locker ក្រោយចូលវិញ           សរសេរ  0
✅ ធុងសំរាមក្រោយចូលវិញ                សរសេរ  0
✅ បិទធុងសំរាម (២)                    សរសេរ  0
✅ លុបទាំងអស់ (PIN)                   សរសេរ  9  🔔  💬
✅ ធុងសំរាមក្រោយលុបទាំងអស់            សរសេរ  0

── សេណារីយ៉ូ ៖ ZTO (របា · ប្រអប់ · ទាញបញ្ជី · បញ្ចូល) ──
✅ ទំព័រទិន្នន័យ (មានរបា ZTO)         សរសេរ  0
✅ ចុចរបា ➜ បញ្ជី ZTO មិនទាន់បិទ      សរសេរ  0
✅ ពិនិត្យម្តងទៀត                     សរសេរ  0  🔔
✅ បិទបញ្ជី                           សរសេរ  0
✅ បើកទាញបញ្ជី ZTO ➜ កំណត់ PIN        សរសេរ  0
✅ ជួរថ្ងៃ 2026-09-17 ➜ 2026-09-22    សរសេរ  0
✅ ទាញបញ្ជី (មើលជាមុន)                សរសេរ  0  🔔
✅ បញ្ចូល (សរសេរលុយ)                  សរសេរ 16  🔔  💬
✅ បិទប្រអប់ទាញបញ្ជី                  សរសេរ  0
✅ តារាង «ថ្ងៃនេះ» ក្រោយបញ្ចូល        សរសេរ  0
✅ ទំព័រស្កេន ➜ ស្កេន ZL9 ស្ទួន       សរសេរ  0  🔔
✅ ស្កេន ZL5 ➜ ZTO បំពេញស្វ័យប្រវត្តិ សរសេរ  0
✅ យល់ព្រម (សរសេរលុយពី ZTO)           សរសេរ  4  🔔

── សេណារីយ៉ូ ៖ Google Sheet (តារាងអតិថិជន · Lookup) ──
✅ តារាងអតិថិជន (PIN)                 សរសេរ  0
✅ ស្វែងរកក្នុងតារាង «096»            សរសេរ  0
✅ ស្វែងរក «<b>» (គេចអក្សរ)           សរសេរ  0
✅ បិទតារាង                           សរសេរ  0
✅ ទំព័រស្កេន ➜ ស្កេន NEW7 (Lookup Sheet) សរសេរ  0  🔔
✅ យល់ព្រម (សរសេរលុយពី Sheet)         សរសេរ  4  🔔

កំហុស runtime ៖ ដើម 0 · ថ្មី 0
ជំហានដែលមិនប្តូរអ្វីសោះ ៖ 0/79

✅ ជំហានទាំង 79 ដូចគ្នាបេះបិទ (អេក្រង់ · ការសរសេរ · DB · ប្រអប់ native · Apps Script · toast · ZTO)
```

---

#### ៤. តេស្ត differential នៃការគូរ (`npm test`)

```
 RUN  v3.2.7 /home/user/zoew-next

 ✓ tests/code128-parity.test.tsx (7 tests) 100ms
 ✓ tests/toast-parity.test.tsx (7 tests) 85ms
 ✓ tests/health-row-parity.test.tsx (9 tests) 53ms
 ✓ tests/history-row-parity.test.tsx (2 tests) 2051ms
   ✓ ជួរដេកប្រវត្តិ ៖ React ធៀបនឹង builder ចាស់ > ផលិតរចនាសម្ព័ន្ធដូចគ្នាលើទិន្នន័យចៃដន្យ ៣០០ ធាតុ  1604ms
   ✓ ជួរដេកប្រវត្តិ ៖ React ធៀបនឹង builder ចាស់ > ការចុចពិត ហៅសកម្មភាពដដែលនឹង `data-act` ចាស់  445ms

 Test Files  4 passed (4)
      Tests  25 passed (25)
   Start at  20:46:44
   Duration  4.06s (transform 1.59s, setup 71ms, collect 3.88s, tests 2.29s, environment 1.41s, prepare 435ms)
```

**អ្វីដែលតេស្តទាំងនេះចាក់សោ ៖**

| ឯកសារ | ថ្នាក់កំហុសដែលវាចាប់ | mutation ដែលវាស់ថាក្រហម |
|---|---|---|
| `history-row-parity` | ជួរដេកប្រវត្តិរបស់ React ឃ្លាតពី builder HTML ចាស់ លើទិន្នន័យចៃដន្យ ៣០០ ធាតុ · ការចុចហៅសកម្មភាពខុស | ✅ |
| `code128-parity` | រូប Barcode ដែល React គូរ ខុសពីកំណែដើមដែលឌិកូដដោយ ZXing រួច ➜ **កញ្ចប់ខុសត្រូវបិទក្នុង ZTO** | `viewBox` ចង្អៀត ១០ module ➜ **៦/៧ ក្រហម** |
| `toast-parity` | ការចុះឈ្មោះ toast ផ្លាស់ពី DOM ទៅបញ្ជីក្នុង store ➜ ពិដាន ៤ · អ្នកបោះរំលង toast រស់ · class តាមសញ្ញា · ចលនា `.show` ២ ដំណាក់ · ការប្រកាសឡើងវិញ | ពិដាន ៤ ➜ ៩៩ · អ្នកបោះមិនរំលង · `.show` មិនដាក់ ➜ **ក្រហមទាំង ៣** |
| `health-row-parity` | ជួរ 🩺 របស់ React ខុសពី `healthRowHtml()` ដើម (អ្នកសម្រេច) · ជួរ «កំពុងពិនិត្យ…» (⏳ · គ្មាន detail) · **ទិសផ្ទុយ** ៖ ខ្សែអក្សរ HTML មិនមែនជាជួរ | ✅ + TypeScript (`HealthRow[]`) បដិសេធអ្នកសាងជួរដែលត្រឡប់ខ្សែអក្សរ |

---

#### ៥. កំហុសពិតដែលឧបករណ៍វាស់ចាប់បាន

⛔ **នេះជាហេតុផលដែលឧបករណ៍ទាំងនេះមាន** — ការអានកូដមិនបានឃើញពួកវាទេ ៖

| កំហុស | អ្នកចាប់ | ផលប៉ះពាល់បើ ship |
|---|---|---|
| `#root` បំបែក layout desktop (`body{display:flex}` + `order:`) | `parity:dom` | ទំព័រខូចលើកុំព្យូទ័រ |
| `load` បាញ់រួចមុន React mount | `smoke` | ការចាប់ផ្តើមខ្លះមិនរត់ |
| React ទម្លាក់ attribute `muted` លើ `<video>` | `parity:dom` | កាមេរ៉ាមិនចាប់ផ្តើមលើ iOS |
| dedent កាត់ខាងក្នុង template literal | `verify` (typecheck) | កូដខូច |
| `FUNCTION_REPLACEMENTS` ស្ទួន ➜ `renderLockerList` ជំនាន់ចាស់ឈ្នះ | អ្នកយាមថ្មី | `<select>` នៅសរសេរ `innerHTML` ➜ តម្រងលោតត្រឡប់ |
| ម៉ឺនុយ (...) ត្រូវវាស់ទំហំ **មុន** React គូរធាតុរបស់វា | `parity:live` | ម៉ឺនុយហៀរក្រៅអេក្រង់ (left 245px ធៀប 137px) ➜ ចុចមិនដល់ |
| ប៊ូតុងម៉ឺនុយ (...) បាត់ `data-act` | `parity:live` | **ម៉ឺនុយទាំងមូលស្លាប់** ៖ Export · របាយការណ៍ខែ · កែទឹកប្រាក់ · អត្រាប្រាក់ · ធុងសំរាម · Reset · លុបទាំងអស់ |
| ជម្រើស «— មិនប្រើ —» លេចមុន `fillSheetImportMappingSelects()` | `parity:dom` | ធាតុលើសពេលសម្រាក |
| **`hidePhoneSuggestions()` សម្អាត `phoneSuggestBox` តាម `textContent = ''`** ខណៈ React ជាម្ចាស់កូនរបស់វា | `parity:deep` ➜ `slot:check` | **App ទាំងមូលក្លាយជាអេក្រង់ស** (`removeChild` ធ្លាក់ ➜ React បោះបង់ root) — ក្រោយវាយក្នុងប្រអប់ស្វែងរក រួចសម្អាត ឬចេញពីវា ៖ ការប្រើប្រាស់ **រាល់ថ្ងៃ** |
| **ការចាកចេញសម្អាត ២០+ slot តាម DOM** (`clearSensitiveModalFields()`) | `slot:check` | ទិន្នន័យអតិថិជន **នៅក្នុង store** ➜ ត្រឡប់មកវិញពេលគូរលើកក្រោយ · តារាងនៅទទេក្រោយចូលវិញ |
| **🩺 ពិនិត្យសុខភាព ៖ អ្នកសាងជួរទាំង ៩ នៅត្រឡប់ខ្សែអក្សរ HTML** ខណៈ component រំពឹង model | `parity:deep` ➜ TypeScript | ប្រអប់បង្ហាញ **ជួរទទេ ៩** ខណៈ parity ស្តាទិច ១០០% |
| ស្លាក «ថ្មី» ➜ «យកហើយ» ប្រើ `<span>` ដដែលឡើងវិញ ➜ សល់ `style=""` | `parity:deep` | attribute លើស (មើលមិនឃើញ តែ DOM មិនដូចដើម) |
| **`"type": "module"` ក្នុង `package.json`** ➜ Node ផ្ទុក Function ZTO (`require`) ជា ES module ➜ `require is not defined` (វាស់បានក្នុង Node · ⚠️ មិនបានវាស់លើ Netlify ពិត) | `zto-proxy-test` (checker ដើម) | ហានិភ័យ ៖ **Function ZTO មិនផ្ទុក ➜ ការស្កេន ZTO ធ្លាក់** — parity មើលមិនឃើញ ព្រោះវាក្លែង ZTO តាម `route` មិនបានផ្ទុក Function ពិតសោះ |
| `package-lock.json` ឃ្លាតពី `package.json` (ឈ្មោះ · កំណែ · `engines` · ទីតាំង react) | `repository-contract-test` (checker ដើម) | ការដំឡើងលើ Netlify មិនកំណត់ទុកជាមុន |
| build ship **sourcemap** ដែលផ្ទុក comment ទាំងអស់ | ការពិនិត្យដោយដៃក្រោយ `comments` | ខុសច្បាប់ ៣ (កូដ ship គ្មាន comment) |
| README ក្លាយជាឯកសារអ្នកអភិវឌ្ឍ ➜ បាត់ **ផ្នែក ៥ នៃច្បាប់ ៩** និងខ្លឹមសារ «របៀបប្រើ» ៤៩២ បន្ទាត់ | `doc-scope-test` (checker ដើម) | អ្នកតំឡើងបាត់ឯកសារណែនាំ · ការអះអាងកំណែជាកំណត់ត្រាតាមកំណែ |

##### កំហុសក្នុង **ឧបករណ៍វាស់ខ្លួនឯង** ដែលរកឃើញ (ក្រោមពួកវា ការវាស់ពីមុនខ្សោយជាងការអះអាង)

| កំហុស | ផល |
|---|---|
| ទិន្នន័យគំរូចងនឹងថ្ងៃ `2026-09-22` តែនាឡិកា browser ជាម៉ោងពិត | ក្រោយពាក់កណ្តាលអធ្រាត្រនៅភ្នំពេញ ទិដ្ឋភាព «ថ្ងៃនេះ» **ទទេទាំង ២ App** ➜ ជំហានវាស់អ្វីក៏មិនបាន · ច្បាប់ ២ ម៉ោងរត់ឬមិនរត់ តាមម៉ោងដែលរត់ |
| Firebase ក្លែងក្លាយ **មិនដែលបាញ់** `onAuthStateChanged` ពេលចាកចេញ | ផ្លូវចាកចេញ/ចូលវិញ **មិនដែលត្រូវវាស់** |
| Firebase ក្លែងក្លាយបាញ់ `.info/connected = null` រាល់ការសរសេរ | App ទាំង ២ ជឿថាដាច់បណ្តាញមួយភ្លែតក្រោយរាល់ការសរសេរ |
| `page.route` មើលមិនឃើញសំណើរបស់ Service Worker | ផ្លូវ ZTO ត្រូវ 404 ➜ «ពិនិត្យមិនបាន» ទាំង ២ App |


##### `audit-tools/run-all.sh` លើ App React (tree `dist-audit` ក្នុង repo ស្រមោល)

រត់ជាមួយ RTDB emulator ពិត · `CRUD_FLOW_STRICT=1` · `VERSIONSCOPE_STRICT=1` ៖

| tree | ✅ ជោគជ័យ | ❌ ធ្លាក់ | ⏭️ រំលង |
|---|---|---|---|
| ZoeW ដើម (`main`) | 180 | 1 | 0 |
| App React — build វាស់ចាស់ (អត្ថបទ esbuild · `index.html` ទទេ) | 61 | 120 | 0 |
| App React — ស្រទាប់ build វាស់ ([`MIGRATION.md`](../ZoeW/docs/MIGRATION.md) ដំណាក់ ២) | **108** | **73** | 0 |

- ⛔ **សុពលភាព** ៖ `money-guardian` ចាក់ mutation លុយ **១០/១០** ចូលកូដ React ➜ អ្នកយាម **ចាប់បានទាំងអស់**
  (ការធ្លាក់ ១ របស់វាគឺ `price-edit-abort-test` មិនទាន់បៃតងលើ tree ស្អាត)។ checker លុយដែលបៃតង ៖ `policy-test` ·
  `revenue-fuzz` · `ledger-clamp-symmetry` · `ledger-failed-apply-revert` · `monthly-ledger-agreement` ·
  `pickup-ledger` · `pickup-barcode-identity` · `collected-mirror-*` · `cleanup-interrupt-atomicity` · `money-reality` …
- ស្ថានភាព checker ពីបៃតង ➜ ក្រហម **១** ៖ `state-hygiene` (វាឃើញ `let` កម្រិត module ២ ថ្មីរបស់ឃ្លាំង ·
  ⛔ ហើយវា **មិនឃើញ** state ក្នុងឃ្លាំងទាល់តែសោះ ➜ ត្រូវផ្ទេរ checker)។

- `main` ធ្លាក់ ១ (`repository-file-coverage`) ៖ `node_modules` ក្រៅ git ក្នុង repo ស្រមោល — សំណល់នៃការវាស់។
- ការធ្លាក់លើ App React ភាគច្រើនជា **សំណល់នៃការវាស់** ៖ checker ស្រង់អត្ថបទ/function តាមឈ្មោះពី `app.js`
  ចាស់ចូល `vm` (helper ថ្មី ➜ `ReferenceError`) · ជំនួស `window.<fn>` (ការហៅខាងក្នុង module មិនឆ្លង `window`) ·
  ចុច `[data-act=…]` ដែលលែងមាន (សកម្មភាពជា `onClick`) · ចាប់ listener តាម `addEventListener` ក្នុង `vm`
  (handler ជា prop របស់ JSX)។
- ⛔ **ការប្រៀបធៀបត្រូវធ្វើតាមការអះអាងនីមួយៗ** មិនមែនតាមស្ថានភាព checker ៖ checker ដែលក្រហមស្រាប់
  លាក់ការថយក្រោយថ្មី (វាស់បាន ៖ ការធ្លាក់ថ្មីពិត ៥ ថ្នាក់ លាក់ក្នុង checker ដែលក្រហមរួច)។
- ⛔ **checker ទាំងនោះមិនទាន់ត្រូវបានផ្ទេរ** ➜ ភាពបៃតងនៃឧបករណ៍របស់ ZoeW ខ្លួនឯងមិនមែនការធានាថា
  គ្មានកំហុសពិតលាក់ខ្លួនក្នុងការធ្លាក់ទាំងនោះទេ ([`MIGRATION.md`](../ZoeW/docs/MIGRATION.md) ដំណាក់ ២)។

ការរត់ដោយផ្ទាល់លើ repo (គ្មាន tree សម្រួល) ៖ checker ZoeW ស្ទើរទាំងអស់ធ្លាក់
ដោយ `ENOENT … ZoeW/app.js`។

---

#### ៦. សេចក្តីសន្និដ្ឋាន

| វិមាត្រ | លទ្ធផល |
|---|---|
| មុខងារ · ថេរ · state · សកម្មភាព · id · កូនសោ · អត្ថបទ · CSS | **១០០%** គ្រប់វិមាត្រ |
| ធាតុ DOM និង layout លើទំហំអេក្រង់ ៣ | **ដូចគ្នាបេះបិទ** |
| តារាង · ស្ថិតិ · លុយ · ការសរសេរទៅ server ជាមួយទិន្នន័យពិត | **ដូចគ្នាបេះបិទ** |
| ផ្លូវលុយទាំងអស់ · ចាកចេញ/ចូលវិញ · ZTO · Google Sheet · PDF (**៧៩ ជំហាន · ៦ ជាន់**) | **ដូចគ្នាបេះបិទ** · ជំហានទទេ ០ · កំហុស runtime ០ |
| ជំហានអន្តរកម្ម (តម្រង · ប្រអប់ · ទំព័រ · របៀប · ម៉ឺនុយ · ធុងសំរាម · របាយការណ៍ខែ · របា Slide) | **ដូចគ្នាបេះបិទ** |
| ការគូរជួរដេកប្រវត្តិ លើទិន្នន័យចៃដន្យ ៣០០ ធាតុ | **ដូចគ្នាបេះបិទ** |
| កំហុស runtime | **០** ទាំង App ចាស់ និងថ្មី |

---

## 🔎 លិបិក្រម — ឈ្មោះ checker ➜ ការពន្យល់រស់នៅឯណា

> ⛔ **តារាងនេះដេរីវេពីការលេចពិត** នៃឈ្មោះ checker (`audit-tools/**/*.js`) ក្នុងឯកសារទាំង ២ — មិនមែនសរសេរដោយដៃ។
> ផ្លូវធម្មតា ៖ checker ធ្លាក់ ➜ រកឈ្មោះវាត្រង់នេះ ➜ `grep -n "<ឈ្មោះ>" docs/HISTORY.md docs/HISTORY-ARCHIVE.md`។

| Checker | `HISTORY.md` (សម័យ React) | `HISTORY-ARCHIVE.md` (សម័យ vanilla) |
|---|---|---|
| `action-binding-test` | ផ្នែក ១ | ផ្នែក ១ |
| `adaptive-link-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `animation-cost` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `app-lock-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ |
| `auth-recovery-test` | ផ្នែក ១ | ផ្នែក ៣ |
| `barcode-shape-test` | — | ផ្នែក ២ |
| `biometric-unlock-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `boot-animation-test` | ផ្នែក ១ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `boot-runtime` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `camera-resume-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `checker-coverage` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `cleanup-clock-guard-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `cleanup-interrupt-atomicity-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៥ |
| `clear-history-finalization-fence-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `clock-basis-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `clock-hygiene` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `code-duplication-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `collected-mirror-fuzz-test` | — | ផ្នែក ១ |
| `collected-mirror-lifecycle-test` | — | ផ្នែក ១ |
| `collected-value-fuzz-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `comments` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ៣ · ផ្នែក ៤ |
| `compensation-order` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `concurrent-scan-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `connection-recovery-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `connection-state-fuzz-test` | — | ផ្នែក ១ |
| `csp-enforced-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `csp-lazy-resource-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `css-classes` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `css-media-override` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `css-var-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `daily-collected-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `db-stall-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `dependency-security-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `doc-scope-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `dom-hygiene` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `duplicate-money-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៤ |
| `duplicate-scan-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៤ |
| `empty-state-truth-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/crud-rules-flow` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `emu/ledger-revert-emu-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `emu/license-seat-rules-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៥ |
| `emu/ns` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `emu/restore-deadlock-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `emu/restore-mutation-emu-test` | — | ផ្នែក ២ · ផ្នែក ៥ |
| `emu/tx-disconnect-emu-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `exit-code-integrity` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `expired-trash-retention-test` | ផ្នែក ១ | ផ្នែក ១ |
| `export-cells-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `field-shape-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `firebase-backup-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `firebase-config-paste-test` | — | ផ្នែក ៣ |
| `fluid-type-focus-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `function-surface-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៤ |
| `gesture-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `google-sheets-cache-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `hang-guard` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `health-check-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `history-menu-dismiss-test` | ផ្នែក ១ | ផ្នែក ២ |
| `history-patch-retry-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `html-sink-escaping` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `inline-handler-xss-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `ios-panel-glide-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `item-money-integrity-test` | — | ផ្នែក ១ |
| `keygen-notice-test` | ផ្នែក ១ | — |
| `keygen-session-security-test` | — | ផ្នែក ២ |
| `keylist-consistency-test` | — | ផ្នែក ១ |
| `khmer-timezone-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `late-commit-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `layout-check` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `layout-thrash` | ផ្នែក ១ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `ledger-clamp-symmetry-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `ledger-count-integrity-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `ledger-failed-apply-revert-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `license-app-code-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `license-clock-rollback-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `license-clock-trust-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `license-grace-test` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `license-network-pressure-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `license-record-race-test` | — | ផ្នែក ២ |
| `license-seat-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ៥ |
| `listener-leak-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `listener-pending-key-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `locker-claim-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `lookup-burst-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-config-secret-test` | — | ផ្នែក ១ |
| `lookup-failure-identity-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-freshness-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `lookup-prefetch-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `loop-termination-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `money-guardian-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `money-core` | ផ្នែក ១ (កូដស្រង់សម្រាប់ money checker) | — |
| `money-reality-check` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `money-reality-test` | ផ្នែក ២ | ផ្នែក ២ |
| `monotonic-gate-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `monthly-ledger-agreement-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `monthly-report-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `netlify-config-scope-test` | ផ្នែក ១ | ផ្នែក ២ |
| `network-pressure-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `network-timeout-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `offline-shell-test` | ផ្នែក ១ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `page-nav-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `panel-motion-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `panel-snap-ownership-test` | ផ្នែក ១ | ផ្នែក ២ |
| `partial-pickup-cleanup-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `payload-schema` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `perf-check` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `periodic-network-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `phone-search-swipe-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `phone-suggest-test` | — | ផ្នែក ១ |
| `pickup-barcode-identity-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `pickup-ledger-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pickup-repair-test` | — | ផ្នែក ១ · ផ្នែក ៣ |
| `pickup-reset-test` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `pin-prompt-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `policy-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `price-edit-abort-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `raw-read-shape-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `react-view` | ផ្នែក ១ | — |
| `reconnect-ladder-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `redact-dump` | — | ផ្នែក ១ · ផ្នែក ២ |
| `registry-orphan-list` | — | ផ្នែក ១ |
| `registry-orphan-list-test` | — | ផ្នែក ១ |
| `registry-release-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `repository-contract-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ |
| `repository-file-coverage` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ |
| `restore-finalization-fence-test` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `restore-marker-hygiene-test` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `revenue-fuzz-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `revenue-rules-clamp-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ |
| `rules-duplicate-keys` | — | ផ្នែក ៣ |
| `runall-runner-test` | ផ្នែក ២ | — |
| `scan-engine-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `scan-remove-mode-test` | — | ផ្នែក ១ |
| `sdk-offline-boot-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sdk-surface` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `secret-hygiene` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `semantic-ui-color-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `sentry-load-race-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `setup-link-browser-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `setup-link-logout-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `setup-link-roundtrip-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `shared-fns` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sheet-import-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `slow-write-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stale-clear-claim-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `stale-write` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stall-guard-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `stall-lock-release-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `state-hygiene` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `stats-collected-truth-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `stats-measurable-gate-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `stats-screen-agreement-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `storage-blocked-boot-test` | — | ផ្នែក ១ · ផ្នែក ៤ |
| `storage-guard` | — | ផ្នែក ១ · ផ្នែក ៣ · ផ្នែក ៤ |
| `strip-comments` | ផ្នែក ១ | ផ្នែក ១ |
| `sw-abort-propagation-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `sw-cache-failure-test` | — | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-cache-key-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-install-integrity-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-revalidate-pressure-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `sw-shell-latency-test` | ផ្នែក ១ | ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `toast-action-truth-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `toast-truth-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `trash-modal-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ · ផ្នែក ៥ |
| `ts-comments` | ផ្នែក ១ | — |
| `tx-outcome-test` | ផ្នែក ១ · ផ្នែក ២ | — |
| `ui-flow-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `user-guide-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `version-bump-scope` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `version-check` | — | ផ្នែក ៣ · ផ្នែក ៤ |
| `wiring` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៣ · ផ្នែក ៤ |
| `write-stall-guard-test` | ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zoew-suite-test` | ផ្នែក ១ | — |
| `zto-budget-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ |
| `zto-cookie-capture-test` | — | ផ្នែក ១ · ផ្នែក ២ |
| `zto-cookie-session-test` | — | ផ្នែក ២ |
| `zto-cookie-store-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-cookie-sync-test` | ផ្នែក ១ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-list-sync-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
| `zto-negative-cache-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ |
| `zto-network-boundaries-test` | — | ផ្នែក ២ |
| `zto-proxy-test` | ផ្នែក ១ · ផ្នែក ២ | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៤ · ផ្នែក ៥ |
| `zto-signed-status-test` | — | ផ្នែក ១ · ផ្នែក ៥ |
| `zto-sync-banner-test` | — | ផ្នែក ១ · ផ្នែក ២ · ផ្នែក ៥ |
