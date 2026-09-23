import { dataState, firebaseState, lookupState, scanState, securityState, sheetImportState, uiState, ztoState } from './core/state';
import groups from './_generated-state.json';

/**
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
        ['./core/**/*.ts', './domain/**/*.ts', './features/**/*.ts', './services/**/*.ts', './ui/**/*.ts', './boot/**/*.ts'],
        { eager: true }
    );
    const w = window as any;
    for (const mod of Object.values(modules)) {
        for (const [key, value] of Object.entries(mod as Record<string, unknown>)) {
            if (!(key in w)) w[key] = value;
        }
    }
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
