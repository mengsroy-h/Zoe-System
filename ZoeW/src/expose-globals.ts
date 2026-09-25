import { dataState, firebaseState, lookupState, scanState, securityState, sheetImportState, uiState, ztoState } from './core/state';
import groups from './_generated-state.json';
import { installAuditActionAnnotations, installAuditClassAdapter } from './audit-compat';
import { commitNow } from './app/flush';

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
    // ⛔ App ដើមសរសេរ DOM **ភ្លាម** ក្នុង function ➜ checker ហៅ `window.fn()` រួចអាន DOM ក្នុង tick ដដែល។ ក្នុង React ការហៅ
    //    ពី **ក្រៅ** event របស់ React គូរក្នុង microtask (ការចុចពិតជា discrete event ➜ React commit មុនព្រឹត្តិការណ៍បន្ទាប់)
    //    ➜ function ដែលបង្ហាញលើ `window` commit ភ្លាមក្រោយត្រឡប់ (`commitNow()` = flushSync) ដូចព្រឹត្តិការណ៍ discrete ។
    //    ⛔ ការហៅខាងក្នុង module មិនឆ្លង `window` ➜ ឥរិយាបថ App មិនប្រែ · `toString()` នៅជាប្រភពដើម (checker ខ្លះអានវា)។
    const NO_WRAP = new Set(['commitNow', 'renderNow', 'setImmediateCommit']);
    let depth = 0;
    const settle = () => { try { commitNow(); } catch { /* ក្នុង render របស់ React ➜ React គូរដោយខ្លួនឯង */ } };
    const wrap = (key: string, fn: (...args: any[]) => any) => {
        if (NO_WRAP.has(key) || /^[A-Z]|^use[A-Z]/.test(key)) return fn;
        const wrapped = function (this: unknown, ...args: any[]) {
            depth++;
            try { return fn.apply(this, args); } finally { depth--; if (depth === 0) settle(); }
        };
        Object.defineProperty(wrapped, 'length', { value: fn.length });
        Object.defineProperty(wrapped, 'name', { value: fn.name });
        (wrapped as any).__auditOrig = fn;
        wrapped.toString = () => Function.prototype.toString.call(fn);
        return wrapped;
    };
    const wrapCache = new WeakMap<(...args: any[]) => any, (...args: any[]) => any>();
    const wrapped = (key: string, fn: (...args: any[]) => any) => {
        let w2 = wrapCache.get(fn);
        if (!w2) { w2 = wrap(key, fn); wrapCache.set(fn, w2); }
        return w2;
    };
    // ⛔ `window.<fn> = stub` ➜ `__auditRebind()` (build វាស់ ៖ `vite.config.mts`) សរសេរ binding របស់ module ឡើងវិញ ➜ ការហៅ
    //    **ខាងក្នុង** ក៏ឆ្លង stub ដូច script សកលរបស់ App ដើម។ ការស្តារ (`window.<fn> = real`) ដោះ wrapper ត្រឡប់ទៅ function ដើម។
    //    function ដែលមិនមែន `export function` (គ្មាន binding ដែលសរសេរបាន) ➜ តម្លៃធម្មតាលើ `window` ដូចមុន។
    for (const mod of Object.values(modules) as Record<string, any>[]) {
        for (const key of Object.keys(mod)) {
            if (key.startsWith('__') || key in w) continue;
            const value = mod[key];
            if (typeof value !== 'function') { w[key] = value; continue; }
            const rebind = typeof mod.__auditRebind === 'function' ? mod.__auditRebind : null;
            Object.defineProperty(w, key, {
                configurable: true,
                enumerable: true,
                get: () => {
                    const cur = mod[key];
                    return typeof cur === 'function' ? wrapped(key, cur) : cur;
                },
                set: (v) => {
                    const target = v && v.__auditOrig ? v.__auditOrig : v;
                    if (rebind && rebind(key, target)) return;
                    Object.defineProperty(w, key, { configurable: true, enumerable: true, writable: true, value: v });
                }
            });
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
