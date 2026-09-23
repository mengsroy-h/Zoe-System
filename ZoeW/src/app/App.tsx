import { useLayoutEffect } from 'react';
import { AppShell } from './components/AppShell';
import { DocumentEffects } from './components/shell/DocumentEffects';
import { PtrIndicator } from './components/shell/PtrIndicator';
import { UpdateBanner } from './components/shell/UpdateBanner';
import { bootApplication } from './lifecycle/boot';
import { createLifecycleScope } from './lifecycle/scope';

/**
 * សំបករបស់ App។
 *
 * ⛔ លំដាប់នៃធាតុរស់នៅក្នុង `AppShell` ដែល **កើតពី `index.html` ដើម** ៖
 *    `style.css` ប្រើ `z-index` និង selector បងប្អូន ➜ លំដាប់ក្នុងឯកសារ
 *    ជាផ្នែកនៃឥរិយាបថ មិនមែនត្រឹមរចនាប័ទ្មទេ។
 *
 * Lifecycle ៖ mount ➜ `bootApplication(scope)` · unmount ➜ `scope.dispose()`
 * ដកវិញនូវរាល់ listener/interval ដែលដំណាក់ boot ចាក់ (មើល `lifecycle/scope.ts`)។
 */
export function App() {
    // ⛔ `useLayoutEffect` + microtask ៖ boot រត់ **ក្រោយ DOM ចុះ តែមុនការគូរ
    //    លើអេក្រង់** ដូច `<script>` នៅចុង `<body>` របស់ ZoeW ដើម ហើយ **ក្រៅ**
    //    lifecycle របស់ React ➜ កូដមុខងារអាចហៅ `commitNow()` (focus · វាស់)
    //    បាន (React ហាម `flushSync` ក្នុង effect)។
    useLayoutEffect(() => {
        const scope = createLifecycleScope();
        queueMicrotask(() => {
            if (!scope.disposed) bootApplication(scope);
        });
        return () => scope.dispose();
    }, []);

    // ⛔ `PtrIndicator` ឈរ **ក្រោយ** `AppShell` ៖ App ដើម `appendChild` វា
    //    ទៅ `document.body` ➜ វាជាកូនចុងក្រោយ។ `#root { display: contents }`
    //    រក្សាលំដាប់ឯកសារនោះឲ្យដូចគ្នាបេះបិទ។
    return (
        <>
            <AppShell />
            <DocumentEffects />
            <UpdateBanner />
            <PtrIndicator />
        </>
    );
}
