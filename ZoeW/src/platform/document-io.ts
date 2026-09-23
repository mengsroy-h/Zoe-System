/**
 * ⛔ ការប៉ះ `document` ដែល **មិនមែន UI** — កន្លែង **តែមួយ** ក្នុងកូដមុខងារ
 * (`npm run purity:check` អនុញ្ញាតតែឯកសារនេះ ជាមួយហេតុផលនីមួយៗ)។ React ជាម្ចាស់
 * UI ទាំងអស់ក្នុង `#root`; អ្វីខាងក្រោមរស់នៅ **ក្រៅ** វា ឬមិនដែលភ្ជាប់ទៅ document ៖
 *
 * - **resource hint ក្នុង `<head>`** (`preconnect`) — `<head>` មិនមែនរបស់ React
 * - **script បណ្ណាល័យ** (SheetJS) ផ្ទុកតាមតម្រូវការ — `<head>` ដដែល
 * - **តំណទាញយក** បណ្តោះអាសន្ន — វិធីតែមួយដែល browser ចាប់ផ្តើមការទាញយកឯកសារ
 * - **ផ្ទៃគូរ/រូបភាពក្រៅអេក្រង់** សម្រាប់ឌិកូដ Barcode/QR — មិនដែលភ្ជាប់ទៅ document
 * - **វដ្តជីវិតរបស់ទំព័រ** (`readyState` · `visibilitychange` · `hidden`) — ជា
 *   ព្រឹត្តិការណ៍របស់ browser មិនមែន DOM ដែល React គូរ
 */

/** ទំព័រផ្ទុកចប់ (`load` បាញ់រួច) */
export function documentLoadComplete(): boolean {
    return document.readyState === 'complete';
}

/** ទំព័រត្រូវលាក់ (App ទៅខាងក្រោយ · អេក្រង់បិទ) */
export function documentIsHidden(): boolean {
    return document.hidden;
}

/** ស្តាប់ការប្តូរភាពមើលឃើញរបស់ទំព័រ */
export function onDocumentVisibilityChange(fn: () => void): void {
    document.addEventListener('visibilitychange', fn);
}

/** ផ្ទៃគូរក្រៅអេក្រង់ (ឌិកូដ Barcode/QR) */
export function createScratchCanvas(): HTMLCanvasElement {
    return document.createElement('canvas');
}

/** ផ្ទុករូបភាពក្រៅអេក្រង់ (ឌិកូដ Barcode ពីរូបថត) */
export function loadScratchImage(url: string, onLoad: (img: HTMLImageElement) => void, onError: () => void): HTMLImageElement {
    const img = new Image();
    img.onload = () => onLoad(img);
    img.onerror = () => onError();
    img.src = url;
    return img;
}

/** `<link rel="preconnect">` ទៅ origin មួយ (រំលងបើមាន preconnect/dns-prefetch រួច) */
export function addPreconnectHint(origin: string): void {
    const already = Array.from(document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]'))
        .some((l: any) => l.href.replace(/\/$/, '') === origin);
    if (already) return;
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = origin;
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);
}

export interface ScriptSpec {
    url: string;
    integrity?: string;
    onLoad: () => void;
    onError: () => void;
}

/** បញ្ចូល `<script>` បណ្ណាល័យទៅ `<head>` (SRI បើមាន) */
export function injectScript(spec: ScriptSpec): HTMLScriptElement {
    const script = document.createElement('script');
    script.src = spec.url;
    if (spec.integrity) {
        script.integrity = spec.integrity;
        script.crossOrigin = 'anonymous';
    }
    script.onload = spec.onLoad;
    script.onerror = spec.onError;
    document.head.appendChild(script);
    return script;
}

/** ចាប់ផ្តើមការទាញយក blob URL ជាឯកសារ (តំណបណ្តោះអាសន្ន) */
export function downloadObjectUrl(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
