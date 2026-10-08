# ការបន្ថែម និងពង្រីក ZoeW

ឯកសារនេះប្រាប់ **កន្លែងដាក់កូដថ្មី** — state · component · lifecycle · platform —
ដើម្បីកុំឲ្យមុខងារថ្មីបំបែកអ្វីដែលវាស់រួច។ រចនាសម្ព័ន្ធស្រទាប់ ៖
[`ARCHITECTURE.md`](ARCHITECTURE.md) ផ្នែក ២។

---

## ១. State ៖ ឃ្លាំងដែលប្រកាសការប្រែ

ឃ្លាំងទាំង ៨ រស់នៅ [`src/core/state.ts`](../src/core/state.ts) (`uiState` ·
`dataState` · `scanState` · `securityState` · `lookupState` · `firebaseState` ·
`sheetImportState` · `ztoState`)។ ការសរសេរ **ត្រង់ៗ** គឺជាការប្រកាសការប្រែ ៖

```ts
uiState.updateBannerOpen = true;      // Proxy ចាប់ ➜ React គូរក្នុង microtask តែមួយ
map.set(key, value); uiState.touch(); // កែ *ខាងក្នុង* វត្ថុ ➜ ត្រូវ touch()
```

វាលថ្មី ៖ បន្ថែមទាំង **interface** និង **តម្លៃដើម** ក្នុងឃ្លាំងដែលត្រឹមត្រូវ ៖

| ឃ្លាំង | ដាក់អ្វី |
|---|---|
| `uiState` | ទំព័រ · ប្រអប់ · ការបង្ហាញ (អ្វីដែលបាត់ពេល reload ក៏គ្មានបញ្ហា) |
| `dataState` | ទិន្នន័យពី Firebase (ប្រវត្តិ · ធុងសំរាម · ledger) |
| `securityState` | សោ App · PIN · ជីវមាត្រ · secret ក្នុងសតិ |
| `scanState` | កាមេរ៉ា · ម៉ាស៊ីនស្កេន |

⛔ state ដែលត្រូវ **ទុកលើឧបករណ៍** ទៅ `localStorage` តាម `appLocalStore` ·
`safeStoreSet()` (storage អាចត្រូវបិទ) — មិនមែនក្នុងឃ្លាំង។

---

## ២. Component ៖ អាន state

```tsx
import { useStoreValue } from '../hooks/useStore';

export function UpdateBanner() {
    const open = useStoreValue(uiState, (s) => s.updateBannerOpen); // គូរឡើងវិញតែពេលវាប្រែ
    if (!open) return null;
    return <div className="app-update-banner">…</div>;
}
```

- **`useStoreValue(store, select)`** ៖ component ថ្មី — គូរឡើងវិញតែពេល *តម្លៃដែល
  អាន* ប្រែ (primitive ប្រៀបតាម `Object.is`; object/array ចាត់ថាប្រែរាល់ការសរសេរ)
- **`useStore(...stores)`** ៖ component ដែលអានវាលច្រើន ឬវត្ថុដែលកែខាងក្នុង
- **`useStoreFields(store, ['a', 'b'])`** ៖ component ដែលអានវាលច្រើនពីឃ្លាំងតែមួយ
- ⛔ **បញ្ជីដែលមានជួរដេកច្រើន** ៖ subscribe តែវាល view របស់ខ្លួន (⛔ មិនមែន `useStore(uiState)` ទាំងមូល) ហើយឪពុកដែលគូរឡើងវិញញឹកញាប់
  ប្រើកំណែ `memo` — ច្បាប់ពេញ ៖ `CLAUDE.md` ជួរ «បញ្ជីធំៗ ↔ ការគូរឡើងវិញ»
- ⛔ ចលនារាល់ស៊ុម (PTR · អូសផ្ទាំង) **មិនចូល state របស់ React** — វារស់នៅ
  `src/app/behaviors/` ហើយកែ `style` តាម ref (តំបន់ហាមចូល `CLAUDE.md` ច្បាប់ ១១)
- ⛔ ធាតុដែល React ជាម្ចាស់ មិនត្រូវឲ្យកូដ imperative ប៉ះ **កូន** របស់វា
  (`npm run slot:check`)

### កូដមុខងារ ៖ សរសេរ state មិនមែន DOM (React ១០០%)

កូដក្នុង `src/core` · `domain` · `features` · `services` · `ui` · `platform` **មិនប៉ះ
DOM សោះ** ហើយ `src/app/**` (component · កាយវិការ · lifecycle) សរសេរ DOM **តែតាមច្រកចេញ**
(`refs.ts` · `DocumentEffects`) — `npm run purity:check` វាស់ទាំង ២ ស្រទាប់។ អ្វីដែល `app.js` ដើមធ្វើលើ DOM មានផ្លូវថ្មីនីមួយៗ ៖

| ត្រូវការ | ⛔ កុំធ្វើ | ✅ ធ្វើ |
|---|---|---|
| បើក/បិទប្រអប់ | `el.style.display = 'flex'` | `openModalHelper(id)` · `closeModal(id)` (ប្រអប់ថ្មី ៖ `<Modal id=…>` + បន្ថែម id ក្នុង `MODAL_IDS`) |
| អត្ថបទ · ស្លាក · ប៊ូតុងរវល់ | `el.textContent = …` · `btn.disabled = …` | វាលក្នុង `viewState` (`src/core/view-state.ts`) ➜ JSX អាន |
| class ស្ថានភាព (បើក · បង្រួម · លាក់) | `el.classList.toggle(…)` | វាលក្នុង `uiState` ➜ JSX គណនា `className` |
| តម្លៃ input · focus · វាស់ · រមូរ | `byId(id).value` · `.focus()` | `fieldValue()` · `setFieldValue()` · `focusField()` · `elementSize()` · `setScrollTop()` (`src/app/refs.ts`) |
| `<head>` · ទាញយកឯកសារ · canvas ក្រៅអេក្រង់ · រមូរ document | `document.createElement(…)` · `window.scrollTo()` | `src/platform/document-io.ts` |
| ព្រឹត្តិការណ៍លើធាតុ (ចុច · វាយ · focus · ទម្លាក់ឯកសារ) | `el.addEventListener(…)` | prop របស់ JSX (`onClick` · `onInput` · `onKeyDown` · `onFocus` · `onDrop` …) — ⛔ native តែពេល React ធ្វើមិនបាន (`touch*` non-passive · `document`/`window`) |
| ទីតាំង · ទំហំដែលវាស់ (ឧ. ប្រអប់ណែនាំ) | `el.style.top = …` | វាស់ ➜ វាលក្នុង `uiState` ➜ `style={…}` ក្នុង JSX (`commitNow()` មុនវាស់បន្ត) |
| `<html>`/`<body>` (class · អថេរ CSS) | `document.body.classList…` | វាលក្នុង state ➜ `DocumentEffects` |

ធាតុថ្មីដែលត្រូវការ ref ៖ បន្ថែមឈ្មោះក្នុង `REF_NAMES` (`src/app/refs.ts`) **និង**
ចង `ref={refTo('name')}` ក្នុង component — ឈ្មោះដែលគ្មាន `ref=` ចង ➜ `purity:check` ធ្លាក់។
⛔ input ជា **uncontrolled** (`defaultValue` · `defaultChecked`) — `value`/`checked` ដែល
គ្មាន `onChange` បង្កក input ជារៀងរហូត។ ⛔ ពេលកូដបន្ទាប់ **វាស់** អ្វីដែលទើបសរសេរ
ក្នុង state ➜ `commitNow()` ជាមុន (helper របស់ `refs.ts` ធ្វើវាខ្លួនឯង)។

---

## ៣. Lifecycle ៖ listener · timer · ការចាប់ផ្តើម

ការចាប់ផ្តើមទាំងអស់រស់នៅ [`src/app/lifecycle/boot.ts`](../src/app/lifecycle/boot.ts)
ជាដំណាក់ដែលមានឈ្មោះ ហើយទទួល `LifecycleScope` ៖

```ts
scope.listen(window, 'online', onOnline);        // ដកវិញពេល unmount
scope.every(60000, runSweep);                    // interval ដកវិញបាន
scope.onLoad(() => …);                           // រត់ភ្លាមបើ load បាញ់រួច
scope.onDispose(() => cleanup());                // ការសម្អាតផ្ទាល់ខ្លួន
oncePerPage('my-setup', setupSomething);         // ម្តងក្នុងមួយអាយុទំព័រ
```

- listener/interval ដែលអ្នកចាក់ **ផ្ទាល់** ➜ `scope.listen()` / `scope.every()`
- function ដែលចាក់ listener **ខាងក្នុងខ្លួន** ហើយដកវិញមិនបាន ➜ `oncePerPage()`
  (បើអត់ StrictMode/HMR បង្កើតស្ទួន ➜ សកម្មភាពរត់ ២ ដង)
- ⛔ **លំដាប់ជាផ្នែកនៃឥរិយាបថ** — បន្ថែមនៅចុងដំណាក់ដែលត្រឹមត្រូវ រួចរត់
  `bash audit-tools/run-all.sh` (ពី root) មុនជឿ

---

## ៤. Platform ៖ web ធៀប Android native

**អ្នកសម្រេចតែមួយ** ៖ [`src/platform/native.ts`](../src/platform/native.ts)
(`isNativeApp()` · `isNativeAndroid()` · `pullToRefreshSupported()` ·
`resolveNativeApiUrl()`)។ ⛔ កុំសួរ `window.Capacitor` នៅកន្លែងផ្សេង។

មុខងារ native ថ្មី ៖

1. `npm install -D @capacitor/<plugin>` (ឬ `@capgo/…`)
2. ផ្ទុក plugin **តាម `import()` តែលើ native** ៖

   ```ts
   if (!isNativeApp()) return webPath();
   const { Haptics } = await import('@capacitor/haptics');
   ```

   ⛔ **គ្មាន `import … from '@capacitor/…'` static** នៅក្រៅ
   `src/platform/native-biometric.ts` (ដែលខ្លួនវាផ្ទុកតាម `import()`) ➜ bundle
   របស់ web មិនធំឡើង ហើយ Service Worker មិន cache chunk native
   (`npm run android:check` ចាក់សោ)
3. ផ្លូវ web ត្រូវនៅ **ដូចមុនបេះបិទ**
4. Activity ផ្សេងដែល plugin បើក (Share · Print · ជីវមាត្រ) ធ្វើឲ្យ App ទទួល
   `pause` ➜ ហៅ `noteAppLockExcuse()` មុនវា បើមិនដូច្នេះ ត្រឡប់មកនឹងសុំ PIN
5. `npm run android:sync` ➜ plugin ចូល `android/` ➜ `npm run android:check`
6. បន្ថែម `PluginHeaders` របស់វាក្នុង `scripts/native-check.mjs` ហើយសាកផ្លូវនោះ

---

## ៥. ប៊ូតុង Back និងប្រវត្តិ

- **ស្រទាប់** (ម៉ឺនុយ · ប្រអប់ · របា Slide) ៖ `closeTopmostLayer()`
  ([`layers.ts`](../src/app/lifecycle/layers.ts)) — អ្នកសម្រេចតែមួយនៃ Escape និង Back
- **ប្រវត្តិ** ៖ [`back-history.ts`](../src/app/lifecycle/back-history.ts) សង្កេត
  `uiState.currentAppPage` និង `uiState.entryScanMode` ➜ ទំព័រ/របៀបថ្មីដែលកំណត់
  តាមឃ្លាំង ចូលប្រវត្តិដោយស្វ័យប្រវត្តិ។ អេក្រង់ថ្មីដែលត្រូវការ Back ៖ បន្ថែមវាល
  ក្នុង `screenOf()` និង `restoreScreen()` (`native-shell.ts`)
- ⛔ Back **មិនត្រឡប់ចូល** អេក្រង់ដែលធ្វើសកម្មភាពបំផ្លាញ (ឧ. របៀប «ដក») —
  `safeScreen()` ជាកន្លែងកំណត់

---

## ៦. តេស្ត

| ប្រភេទ | កន្លែង | ពាក្យបញ្ជា |
|---|---|---|
| unit (helper សុទ្ធ · component) | `tests/**/*.test.ts(x)` | `npm test` |
| App ពិតក្នុង Chromium ជាមួយ bridge Android ក្លែង | `scripts/native-check.mjs` | `npm run native:check` |
| ស្នាមភ្ជាប់ Android (កំណែ · appId · សិទ្ធិ · logo · plugin) | `scripts/android-check.mjs` | `npm run android:check` |
| ច្បាប់លុប/ដក និងការសម្អាត លើ web និង Android | `scripts/cleanup-rules-check.mjs` | `npm run rules:check` |
| React ១០០% (កូដមុខងារមិនប៉ះ DOM · ref ចងពិត) | `scripts/react-purity-check.mjs` | `npm run purity:check` |
| ទាំងអស់ | — | `npm run verify` |

⛔ តេស្តថ្មីត្រូវ **ធ្លាក់លើកូដមុនកែ** — ដកការកែចេញម្តង ហើយមើលវាក្រហម
(`CLAUDE.md` ៖ «រកឃើញកំហុស ➜ សាងឧបករណ៍ជាមុន»)។
