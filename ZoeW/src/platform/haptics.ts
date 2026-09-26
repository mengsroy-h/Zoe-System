import { isNativeApp } from './native';

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
    } catch { }
}
