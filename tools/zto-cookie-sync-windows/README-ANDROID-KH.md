# ZTO Cookie Sync — Android / Termux

ឯកសារនេះពន្យល់ **របៀបប្រើផ្លូវ Android + Termux**។ ផ្លូវ Windows ស្ថិតក្នុង
[`README-KH.md`](README-KH.md) ហើយវាដើរដោយឡែកពីគ្នា ៖ state · config និង
secret របស់ Android មិនពាក់ព័ន្ធនឹងរបស់ Windows ទេ។

## កំណែ

ឧបករណ៍នេះ **មិនមានលេខកំណែផ្ទាល់ខ្លួនទេ** — វា ship ជាមួយ repo ហើយ
`package.json` របស់វាចាក់សោ dependency តែមួយ។ ការផ្ទៀងផ្ទាត់ថាវាដើរត្រូវ
ធ្វើតាម `./sync-zto-cookie-termux.sh --check` មិនមែនតាមលេខកំណែទេ។

## មុខងារ

| ឯកសារ | តួនាទី |
| --- | --- |
| `setup-termux.sh` | ដំឡើង Node.js + ADB · សួរ និងរក្សា Netlify config |
| `connect-android.sh` | pair/connect Termux ADB ទៅ Android តាម Wireless debugging |
| `ensure-adb-connected.sh` | ភ្ជាប់ ADB ឡើងវិញដោយស្វ័យប្រវត្តិមុន sync |
| `sync-zto-cookie-termux.sh` | រត់ sync លើ Android |
| `android-cdp-capture.js` | ភ្ជាប់ Chrome Android តាម **ADB + Chrome DevTools Protocol (CDP)** ហើយចាប់ request/response ពិតពី ZTO |
| `install-home-button.sh` | បង្កើត shortcut «ZTO Cookie Sync» សម្រាប់ Home Screen |

`sync-zto-cookie.js` ស្គាល់ Android ដោយស្វ័យប្រវត្តិ ៖ Android ប្រើ CDP ខណៈ
Windows ប្រើ Edge/Chrome + Playwright។

## របៀបប្រើប្រាស់

### Setup ដំបូង

ក្នុង Termux៖

```bash
termux-setup-storage
cd ~/storage/downloads/"ZTO Cookie Sync"
bash setup-termux.sh
```

ដោយសារ Android shared storage មាន `noexec` និងមិនគាំទ្រ symlink ដូច filesystem ធម្មតា, installer នឹង copy project ទៅ៖

```text
$HOME/ZTO-Cookie-Sync
```

បន្ទាប់ពី setup សូមធ្វើការពី folder នេះ៖

```bash
cd ~/ZTO-Cookie-Sync
```

`setup-termux.sh` នឹង៖

1. ដំឡើង `nodejs` និង `android-tools` (ADB)
2. `npm install --ignore-scripts --no-audit --no-fund`
3. សួរ Netlify Site ID, Site URL, PAT និង `ZTO_PROXY_KEY` (ឬសោមួយក្នុង `ZTO_PROXY_KEYS` ៖ ផ្នែកក្រោយ `=`)
4. រក្សា secrets ក្នុង private Termux storage
5. ផ្ទៀងផ្ទាត់ Site ID + PAT តាម Netlify API

#### ភ្ជាប់ ADB ទៅ Android (ម្តងដំបូង / បន្ទាប់ពី port ប្ដូរ)

1. Android Settings → Developer options → **Wireless debugging** → On
2. ចុច **Pair device with pairing code**
3. ត្រឡប់ Termux ហើយរត់៖

```bash
cd ~/ZTO-Cookie-Sync
./connect-android.sh
```

Script នឹងសួរ៖

- `IP:PAIR_PORT` ដែលបង្ហាញក្នុង Pair device with pairing code
- pairing code 6 ខ្ទង់ (ADB សួរផ្ទាល់)
- `IP:DEBUG_PORT` ដែលបង្ហាញលើទំព័រ Wireless debugging មេ

ពិនិត្យ៖

```bash
adb devices
```

ត្រូវឃើញ device **មួយ** មាន status `device` មិនមែន `unauthorized` ឬ `offline`។

> Wireless debugging port អាចប្ដូរក្រោយ reboot ឬបិទ/បើក Wireless debugging។ បើ sync ប្រាប់ថា ADB មិន connected សូមរត់ `./connect-android.sh` ម្តងទៀត។

**មិនចាំបាច់បើក Chrome flag ពិសេសទេ**។ Android version នេះប្រើ ADB forward ទៅ Chrome DevTools socket ដោយផ្ទាល់។

#### Sync Cookie

```bash
cd ~/ZTO-Cookie-Sync
./sync-zto-cookie-termux.sh
```

វានឹង៖

1. បើក `gate.ztoglobal.com` ក្នុង Chrome Android តាម ADB
2. បន្ទាប់មកបើក Argus
3. មើល request/response ពិតទៅ `aargus-api.ztoglobal.com` តាម Chrome DevTools Protocol
4. ទទួលយក Cookie តែពេលមាន signed-in API response ដែលឆ្លង validation ដូច Windows version
5. upload Cookie ទៅ Netlify Blobs

បើវានៅតែរង់ចាំ សូមទៅ **Scan Management → Arrival Scan** ហើយស្កេន/វាយ Waybill មួយ។

របៀបផ្សេងទៀត៖

```bash
./sync-zto-cookie-termux.sh --check
./sync-zto-cookie-termux.sh --auto
./sync-zto-cookie-termux.sh --auto-ready
```

`--check` មិនត្រូវការ browser/ADB។ `--auto` ត្រូវការ ADB តែពេលវាសម្រេចថា Cookie ត្រូវ refresh។

#### បើ Chrome / capture មិនដំណើរការ

ពិនិត្យ៖

```bash
adb devices
node --version
npm --version
```

បើ ADB disconnected៖

```bash
./connect-android.sh
```

បើមាន device ច្រើនជាងមួយ សូម disconnect device ផ្សេង ឬកំណត់ serial៖

```bash
export ANDROID_SERIAL="IP:PORT"
./sync-zto-cookie-termux.sh
```

Android capture path គាំទ្រ **Google Chrome package `com.android.chrome`**។ វាប្រើ Chrome profile/session ដែលមានស្រាប់លើទូរស័ព្ទ ដូច្នេះបើ ZTO session មានរួច អ្នកមិនចាំបាច់ login ឡើងវិញទេ លុះត្រាតែ ZTO សួរ។

#### Windows

ផ្លូវ Windows ប្រើ៖

```text
setup.cmd
sync-zto-cookie.cmd
schedule-zto-cookie.cmd
```

Windows ប្រើ DPAPI។ Android និង Windows មាន state/config ដាច់ដោយឡែកពីគ្នា។

#### Home Screen button (ងាយប្រើបំផុត)

`install-home-button.sh` បង្កើត shortcut script ឈ្មោះ **ZTO Cookie Sync** ក្នុង៖

```text
$HOME/.shortcuts/ZTO Cookie Sync
```

`setup-termux.sh` បង្កើត shortcut file នេះឲ្យដោយស្វ័យប្រវត្តិ។ បើចង់សាងវាឡើងវិញ ៖

```bash
cd ~/ZTO-Cookie-Sync
./install-home-button.sh
```

បើ **Termux:Widget** មានរួច script នឹងបើក shortcut picker។ ជ្រើស **ZTO Cookie Sync** ដើម្បីដាក់ icon/shortcut លើ Home Screen។ បើមិនទាន់មាន Termux:Widget សូមដំឡើង add-on ដែលមកពី source ដូចគ្នានឹង Termux app របស់អ្នក រួច add Termux:Widget/Shortcut ទៅ Home Screen និងជ្រើស **ZTO Cookie Sync**។

ពេលចុច Home Screen button វានឹង៖

1. ចូល project ដោយស្វ័យប្រវត្តិ
2. ពិនិត្យ ADB
3. បើ ADB disconnect វាសាក reconnect ទៅ Wireless-debugging address ចុងក្រោយ
4. បើក Chrome/ZTO និងចាប់ Cookie
5. upload Cookie ទៅ Netlify

`connect-android.sh` ឥឡូវរក្សា debugging address ចុងក្រោយនៅ private Termux state៖

```text
$HOME/.local/state/Zoe-System/ZTO-Cookie-Sync/adb-connect-address.txt
```

បើ Wireless debugging port ប្ដូរ វាមិនអាចទាយ port ថ្មីបានទេ។ ក្នុងករណីនោះ run `./connect-android.sh` ម្តង ហើយ Home Screen button នឹងប្រើ address ថ្មីនៅលើកបន្ទាប់។

ក៏មាន command ខ្លី៖

```bash
zto-sync
```

#### One-Tap ADB reconnect

`ensure-adb-connected.sh` សាក reconnect ADB តាម address ចុងក្រោយ ហើយបើ port បានប្ដូរ វាស្វែងរក `_adb-tls-connect._tcp` តាម mDNS ដោយស្វ័យប្រវត្តិ។ បន្ទាប់ពី pair ម្តង ជាទូទៅអ្នកគ្រាន់តែបើក **Wireless debugging** ហើយចុច **ZTO Cookie Sync**។

## ប្រព័ន្ធសុវត្ថិភាព

Netlify PAT និង `ZTO_PROXY_KEY` **មិនប្រើ Windows DPAPI លើ Android ទេ** ៖
វារក្សានៅ **Termux private app storage** ៖

```text
$HOME/.local/state/Zoe-System/ZTO-Cookie-Sync/config.json
$HOME/.local/state/Zoe-System/ZTO-Cookie-Sync/netlify-token.secret
$HOME/.local/state/Zoe-System/ZTO-Cookie-Sync/proxy-key.secret
```

- secret file មាន permission `600` និងថតមាន `700`។ ការអានបដិសេធភ្លាម បើ
  permission ធូរជាងនោះ។
- ⛔ **កុំផ្លាស់ទី secret file ទៅ `/storage/emulated/0` ឬ Downloads** — ថត
  ទាំងនោះអានបានដោយ app ដទៃ។
- Cookie បង្ហាញលើអេក្រង់ដោយចេតនា (ងាយ paste ជាផ្លូវបម្រុង) ⛔ តែ **PAT និង
  `ZTO_PROXY_KEY` មិនបង្ហាញសោះ**។
- ការចាប់ទទួលយក Cookie **តែពេល ZTO ឆ្លើយដោយជោគជ័យលើ host ពិត** ៖ ចម្លើយ
  401/403 · redirect ទៅ IdP · JSON ខូច **មិនរាប់ជាជោគជ័យ** ហើយ jar ដែលមាន
  CR/LF/NUL ឬគ្មាន `BOS-MAN-SESSION` ត្រូវបដិសេធទាំងស្រុង។

> ⚠️ ការការពារនេះជា **private app sandbox + Unix file permission** របស់
> Termux មិនមែន DPAPI encryption ទេ។ អ្នកដែលចូល Termux app data បានក្នុង
> context ដែលមានសិទ្ធិខ្ពស់ (root) នៅតែអាចអាន secret បាន។

## អាជ្ញាប័ណ្ណ

រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)។
មើល [`LICENSE`](../../LICENSE) និង [`NOTICE`](../../NOTICE) នៅ root របស់ repo។
