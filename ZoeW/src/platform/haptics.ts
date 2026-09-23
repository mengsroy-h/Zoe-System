import { isNativeApp } from './native';

/**
 * ញ័រខ្លី («tick») ដូចស្តង់ដា App ៖ ឧ. ពេល Pull-to-Refresh ឆ្លងព្រំដែន «លែងដៃដើម្បី
 * ផ្ទុកឡើងវិញ» ➜ អ្នកប្រើដឹងតាមដៃ មិនបាច់មើលសញ្ញា។
 *
 * - **App Android** ➜ `@capacitor/haptics` (Vibrator របស់ Android · impact Light)
 * - **web** ➜ `navigator.vibrate()` (Chrome លើ Android)
 * - ⛔ **iPhone (Safari · PWA) គ្មាន API ញ័រសម្រាប់ទំព័រវែបទេ** ➜ គ្មានអ្វីកើតឡើង
 *
 * ⛔ fail-closed ៖ រាល់ការធ្លាក់ត្រូវលេប — ការញ័រមិនត្រូវបំបែកកាយវិការណាមួយ។
 * ⛔ plugin ផ្ទុកតាម `import()` តែលើ native (chunk `native-plugins` · web មិនផ្ទុក)។
 */
export const HAPTIC_TICK_MS = 10;

export function hapticTick(): void {
    if (isNativeApp()) {
        import('@capacitor/haptics')
            .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
            .catch(() => {});
        return;
    }
    try {
        const nav = navigator as Navigator & { vibrate?: (pattern: number) => boolean };
        if (typeof nav.vibrate === 'function') nav.vibrate(HAPTIC_TICK_MS);
    } catch (e) { /* fail-closed */ }
}
