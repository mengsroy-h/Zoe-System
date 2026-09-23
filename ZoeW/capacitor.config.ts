import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App Android របស់ ZoeW (Capacitor) — ⛔ **Android តែមួយ** (គ្មាន iOS)។
 *
 * - `webDir: 'dist'` ៖ build របស់ Vite ដដែលនឹង web (`npm run android:sync`
 *   build ជាមួយ `--mode android` ដើម្បីអាន `.env.android`)។
 * - WebView បម្រើ App ពី `https://localhost` ➜ ZTO Function ត្រូវអនុញ្ញាត
 *   origin នោះ (CORS) ហើយ `VITE_NATIVE_WEB_ORIGIN` ប្រាប់ App ពី origin ពិត
 *   របស់ Netlify (មើល `src/platform/native.ts`)។
 * - `SystemBars.insetsHandling: 'native'` ៖ WebView ពេញអេក្រង់ ហើយ
 *   `env(safe-area-inset-*)` មានតម្លៃពិត ➜ `app.css` ប្រើវារួចហើយ។
 */
const config: CapacitorConfig = {
    appId: 'com.zoesystem.zoew',
    appName: 'ZoeW',
    webDir: 'dist',
    android: {
        allowMixedContent: false,
        webContentsDebuggingEnabled: false
    },
    plugins: {
        SystemBars: {
            insetsHandling: 'native',
            initialViewportFitValueHint: 'cover',
            // ⛔ ពណ៌ចាប់ផ្តើម = រូបតំណាងខ្មៅ (splash ផ្ទៃភ្លឺ) ➜ App ប្តូរវាតាម inset
            //    ដែលវាស់បាន ក្នុង `src/app/lifecycle/native-shell.ts`។
            style: 'LIGHT'
        },
        SplashScreen: {
            launchShowDuration: 400,
            launchAutoHide: true,
            backgroundColor: '#f8fafc',
            showSpinner: false,
            androidScaleType: 'CENTER_INSIDE'
        }
    }
};

export default config;
