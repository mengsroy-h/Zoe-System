import { isNativeApp } from './native';

export const HAPTIC_TICK_MS = 10;

export const HAPTIC_SCAN_MS = 60;

function hapticPulse(ms: number, strong: boolean): void {
    if (isNativeApp()) {
        import('@capacitor/haptics')
            .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: strong ? ImpactStyle.Heavy : ImpactStyle.Light }))
            .catch(() => {});
        return;
    }
    try {
        const nav = navigator as Navigator & { vibrate?: (pattern: number) => boolean };
        if (typeof nav.vibrate === 'function') nav.vibrate(ms);
    } catch { }
}

export function hapticTick(): void {
    hapticPulse(HAPTIC_TICK_MS, false);
}

export function hapticScan(): void {
    hapticPulse(HAPTIC_SCAN_MS, true);
}
