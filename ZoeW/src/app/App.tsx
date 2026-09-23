import { useLayoutEffect, useRef } from 'react';
import { runLegacyBootstrapStatements } from '../boot/bootstrap-statements';
import { AppShell } from './components/AppShell';
import { PtrIndicator } from './components/shell/PtrIndicator';
import { UpdateBanner } from './components/shell/UpdateBanner';

/**
 * សំបករបស់ App។
 *
 * ⛔ លំដាប់នៃធាតុរស់នៅក្នុង `AppShell` ដែល **កើតពី `index.html` ដើម** ៖
 *    `style.css` ប្រើ `z-index` និង selector បងប្អូន ➜ លំដាប់ក្នុងឯកសារ
 *    ជាផ្នែកនៃឥរិយាបថ មិនមែនត្រឹមរចនាប័ទ្មទេ។
 */
export function App() {
    const booted = useRef(false);

    // ⛔ `useLayoutEffect` មិនមែន `useEffect` ៖ កូដ imperative ដែលផ្ទេរមក
    //    អាន DOM តាម `byId()` ភ្លាមៗ ➜ វាត្រូវរត់ **ក្រោយ DOM ចុះ តែមុន
    //    ការគូរ** ដូច `<script>` នៅចុង `<body>` ដើមបេះបិទ។
    useLayoutEffect(() => {
        if (booted.current) return;
        booted.current = true;
        runLegacyBootstrapStatements();
    }, []);

    // ⛔ `PtrIndicator` ឈរ **ក្រោយ** `AppShell` ៖ App ដើម `appendChild` វា
    //    ទៅ `document.body` ➜ វាជាកូនចុងក្រោយ។ `#root { display: contents }`
    //    រក្សាលំដាប់ឯកសារនោះឲ្យដូចគ្នាបេះបិទ។
    return (
        <>
            <AppShell />
            <UpdateBanner />
            <PtrIndicator />
        </>
    );
}
