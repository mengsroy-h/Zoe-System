/**
 * ស្រទាប់ platform ៖ **ចំណុចសម្រេចតែមួយ** ថា App កំពុងរត់ក្នុង browser ឬក្នុង
 * សំបក native (Capacitor)។
 *
 * ⛔ រាល់កូដដែលត្រូវការឥរិយាបថខុសគ្នាលើ native ត្រូវសួរតាមទីនេះ ➜ ការសម្រេច
 *    មិនបែកគ្នា ២ កន្លែង។
 * ⛔ អាន `window.Capacitor` ដែល **bridge native ចាក់មុនកូដ App** — មិន import
 *    `@capacitor/core` ដោយផ្ទាល់ទេ ➜ bundle របស់ web មិនផ្ទុកកូដ Capacitor សោះ
 *    (plugin ទាំងអស់ផ្ទុកតាម `import()` តែលើ native)។
 * ⛔ Web ត្រូវ **fail closed** ៖ bridge អវត្តមាន ឬបោះ ➜ ចាត់ទុកជា web ➜
 *    ឥរិយាបថ web ដដែល មិនមែនផ្លូវ native ពាក់កណ្តាល។
 */
function bridge(): any {
    try {
        return (window as any).Capacitor || null;
    } catch {
        return null;
    }
}

export function isNativeApp(): boolean {
    try {
        const cap = bridge();
        return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    } catch {
        return false;
    }
}

export function isNativeAndroid(): boolean {
    try {
        const cap = bridge();
        return isNativeApp() && typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android';
    } catch {
        return false;
    }
}

/**
 * PTR ផ្ទាល់ខ្លួនរបស់ App ត្រូវការតែពេល browser **គ្មាន** PTR របស់វា ៖
 * iOS PWA (standalone) និង WebView របស់ Android (Capacitor)។
 *
 * ⛔ Chrome លើ Android មាន PTR ដើមរួចហើយ ➜ ការបើក PTR របស់ App នៅទីនោះ
 *    = PTR ២ ជាន់គ្នា។ ⛔ `boot-flags.js` ដាក់ class `native-android` តាម
 *    លក្ខខណ្ឌដដែល មុន stylesheet ផ្ទុក។
 */
export function pullToRefreshSupported(): boolean {
    return (window.navigator as any).standalone === true || isNativeAndroid();
}

/**
 * URL របស់ Netlify Function លើ native ៖ WebView បម្រើ App ពី `https://localhost`
 * ➜ ផ្លូវ relative `/.netlify/functions/...` ចង្អុលទៅឯកសារក្នុងឧបករណ៍ មិនមែន
 * server ទេ។ `VITE_NATIVE_WEB_ORIGIN` (ដាក់ពេល build Android) ជាប្រភពតែមួយ។
 *
 * ⛔ Web ៖ ត្រឡប់ URL ដដែល **បេះបិទ** (គ្មានការប៉ះផ្លូវ web)។
 * ⛔ URL absolute (`https://…`) មិនប៉ះទេ ៖ អ្នកប្រើកំណត់វាដោយចេតនា។
 */
export function resolveNativeApiUrl(url: string): string {
    if (!isNativeApp() || typeof url !== 'string') return url;
    const origin = nativeWebOrigin();
    if (!origin) return url;
    if (url.startsWith('/.netlify/')) return origin + url;
    return url;
}

export function nativeWebOrigin(): string {
    const raw = String(import.meta.env.VITE_NATIVE_WEB_ORIGIN || '').trim();
    if (!/^https:\/\/[^/\s?#]+$/i.test(raw.replace(/\/+$/, ''))) return '';
    return raw.replace(/\/+$/, '');
}
