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
- ⛔ ចលនារាល់ស៊ុម (PTR · អូសផ្ទាំង) **មិនចូល state របស់ React** — វារស់នៅ
  `src/ui/` ហើយកែ `style` ដោយផ្ទាល់ (តំបន់ហាមចូល `CLAUDE.md` ច្បាប់ ១១)
- ⛔ ធាតុដែល React ជាម្ចាស់ មិនត្រូវឲ្យកូដ imperative ប៉ះ **កូន** របស់វា
  (`npm run slot:check`)

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
  `npm run parity:deep` មុនជឿ

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
| parity ជាមួយ ZoeW ដើម | `scripts/parity-*.mjs` | `npm run parity:all` |
| ទាំងអស់ | — | `npm run verify` |

⛔ តេស្តថ្មីត្រូវ **ធ្លាក់លើកូដមុនកែ** — ដកការកែចេញម្តង ហើយមើលវាក្រហម
(`CLAUDE.md` ៖ «រកឃើញកំហុស ➜ សាងឧបករណ៍ជាមុន»)។
