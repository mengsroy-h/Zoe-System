/**
 * ពណ៌រូបតំណាងលើរបាស្ថានភាព (Android native) ៖ ដេរីវេពី **ពណ៌ផ្ទៃពិត** ដែលឈរនៅក្រោមរបា
 * មិនមែនពីការសន្មតអំពី layout។
 *
 * ⛔ ពេល WebView ពេញអេក្រង់ របាស្ថានភាពជាស្រទាប់ **ថ្លា** លើទំព័រ ➜ អ្វីដែលអ្នកប្រើឃើញនៅក្រោម
 *    រូបតំណាង គឺ navbar (`--card-bg` ស) · ប្រអប់ (ផ្ទៃងងឹតថ្លាៗ) · របា Slide … ➜ រូបតំណាងត្រូវ
 *    ផ្ទុយពន្លឺនឹងផ្ទៃនោះ។ ការសន្មត «navbar ក្រហម ➜ រូបតំណាងស» ធ្វើឲ្យរូបតំណាង **ស លើផ្ទៃស**
 *    (មើលមិនឃើញ)។
 *
 * function ទាំងនេះ **សុទ្ធសាធ** (គ្មាន DOM) ៖ អ្នកវាស់ក្នុង `native-shell.ts` ផ្គត់ផ្គង់ស្រទាប់
 * ពី `elementsFromPoint()` ហើយនៅទីនេះសម្រេច។
 */

export interface Rgba { r: number; g: number; b: number; a: number }
export interface BackdropLayer { color: string; opacity: number }
export type StatusBarTone = 'dark' | 'light';

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/** អាន `rgb()`/`rgba()` ដែល `getComputedStyle` ឆ្លើយ (ទាំងទម្រង់ក្បៀស និងទម្រង់ `/`) — មិនស្គាល់ ➜ `null` */
export function parseCssColor(text: string): Rgba | null {
    if (typeof text !== 'string') return null;
    const value = text.trim().toLowerCase();
    if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const match = /^rgba?\(\s*([^)]*)\)$/.exec(value);
    if (!match) return null;
    const parts = match[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return null;
    const channel = (p: string) => (p.endsWith('%') ? parseFloat(p) * 2.55 : parseFloat(p));
    const [r, g, b] = parts.slice(0, 3).map(channel);
    const a = parts.length === 4 ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
    if (![r, g, b, a].every(Number.isFinite)) return null;
    const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
    return { r: clamp(r, 255), g: clamp(g, 255), b: clamp(b, 255), a: clamp(a, 1) };
}

/**
 * លាយស្រទាប់ពីក្រោមឡើងលើ (`layers[0]` = **ខាងលើគេ** ដូចលំដាប់របស់ `elementsFromPoint()`)
 * លើផ្ទៃ canvas ស ➜ ពណ៌ដែលភ្នែកឃើញ។ ពណ៌ដែលអានមិនបាន ➜ រំលង (ថ្លា)។
 */
export function compositeBackdrop(layers: BackdropLayer[]): Rgba {
    let out = { ...WHITE };
    for (let i = layers.length - 1; i >= 0; i--) {
        const color = parseCssColor(layers[i].color);
        if (!color) continue;
        const opacity = Number.isFinite(layers[i].opacity) ? Math.min(1, Math.max(0, layers[i].opacity)) : 1;
        const a = color.a * opacity;
        if (a <= 0) continue;
        out = { r: color.r * a + out.r * (1 - a), g: color.g * a + out.g * (1 - a), b: color.b * a + out.b * (1 - a), a: 1 };
    }
    return out;
}

/** ពន្លឺដែលទាក់ទង (WCAG) ០ ➜ ១ */
export function relativeLuminance(color: Rgba): number {
    const lin = (c: number) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(color.r) + 0.7152 * lin(color.g) + 0.0722 * lin(color.b);
}

/**
 * `light` = រូបតំណាង **ខ្មៅ** (ផ្ទៃភ្លឺ) · `dark` = រូបតំណាង **ស** (ផ្ទៃងងឹត) — ឈ្មោះដូច
 * `SystemBarsStyle` របស់ Capacitor។ ជ្រើសពណ៌ដែលមាន **កម្រិតផ្ទុយខ្ពស់ជាង** (WCAG)។
 */
export function statusBarToneForLuminance(luminance: number): StatusBarTone {
    if (!Number.isFinite(luminance)) return 'light';
    const againstBlack = (luminance + 0.05) / 0.05;
    const againstWhite = 1.05 / (luminance + 0.05);
    return againstBlack >= againstWhite ? 'light' : 'dark';
}

/**
 * សាលក្រមចុងក្រោយ ៖ `insetTopPx` ០ ➜ WebView មិនពេញអេក្រង់ ➜ របាឈរលើផ្ទៃរបស់ Activity
 * (ភ្លឺ) ➜ `light`។ បើមិនដូច្នេះ ➜ មធ្យមពន្លឺនៃចំណុចវាស់ (រូបតំណាងរាយពេញទទឹងរបា)។
 * ⛔ គ្មានចំណុចវាស់ ➜ `light` (ផ្ទៃរបស់ App ភ្លឺជាលំនាំដើម)។
 */
export function statusBarToneFor(insetTopPx: number, samples: BackdropLayer[][]): StatusBarTone {
    if (!(insetTopPx > 0) || !samples.length) return 'light';
    const total = samples.reduce((sum, layers) => sum + relativeLuminance(compositeBackdrop(layers)), 0);
    return statusBarToneForLuminance(total / samples.length);
}
