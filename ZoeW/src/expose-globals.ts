import { dataState, firebaseState, lookupState, scanState, securityState, sheetImportState, uiState, ztoState } from './core/state';
import groups from './_generated-state.json';
import { installAuditActionAnnotations, installAuditClassAdapter } from './audit-compat';

/**
 * ⛔ កាយវិការ · PTR · ចលនាផ្ទាំង រស់ក្នុង `src/app/behaviors` (ស្រទាប់ React តាម ref)
 *    ➜ ពួកវាត្រូវបង្ហាញដែរ បើមិនដូច្នេះ checker តំបន់ហាមចូលរកមិនឃើញ
 *    `window.measureAppChromeSize` · `window.panelGlideFrom` … ហើយ **SKIP** ជំនួសការវាស់។
 * ⛔ សម្រាប់តែ build វាស់ (`VITE_EXPOSE_GLOBALS=1`) — **មិនដែលចូលផលិតកម្ម**
 *    (`main.tsx` import វាតែក្នុងសាខាដែល Vite ជំនួសជា `false` ពេល build ធម្មតា)។
 *
 * checker ដើមរបស់ `audit-tools/` (ឧ. តំបន់ហាមចូល ៖ PTR · ចលនាផ្ទាំង · ការរមូរ)
 * ហៅ `window.<function>` និងអាន `window.<state>` ព្រោះ `app.js` ចាស់ជា script សកល។
 * ការបង្ហាញផ្ទៃដដែលលើ App **React ពិត** អនុញ្ញាតឲ្យ checker ទាំងនោះវាស់ App ថ្មី
 * **ដោយមិនកែ checker មួយបន្ទាត់** — ភស្តុតាងខ្លាំងជាងតេស្តដែលយើងសរសេរខ្លួនឯង។
 */
export function exposeGlobals() {
    const modules = import.meta.glob(
        // ⛔ គ្មាន `./platform/**` ៖ `import.meta.glob` eager នាំ plugin Capacitor ចូលជា static ➜ web
        //    ផ្ទុក chunk `native-plugins` ដែល SW មិន cache (ដោយចេតនា) ➜ ក្រៅបណ្តាញ build វាស់ដួល
        //    (វាស់បាន ៖ sw-shell-latency · offline-shell · sw-cache-key)
        ['./core/**/*.ts', './domain/**/*.ts', './features/**/*.ts', './services/**/*.ts', './ui/**/*.ts',
            './app/behaviors/**/*.ts', './app/lifecycle/layers.ts', './app/refs.ts', './app/flush.ts'],
        { eager: true }
    );
    const w = window as any;
    for (const mod of Object.values(modules)) {
        for (const [key, value] of Object.entries(mod as Record<string, unknown>)) {
            if (!(key in w)) w[key] = value;
        }
    }
    installAuditClassAdapter();
    installAuditActionAnnotations();
    const stores: Record<string, any> = { firebaseState, dataState, scanState, uiState, securityState, lookupState, sheetImportState, ztoState };
    for (const [store, fields] of Object.entries(groups as Record<string, { name: string }[]>)) {
        for (const f of fields) {
            Object.defineProperty(w, f.name, {
                configurable: true,
                get: () => stores[store][f.name],
                set: (v) => { stores[store][f.name] = v; }
            });
        }
    }
}
