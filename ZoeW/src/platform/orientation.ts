import { isAndroidDevice, isNativeAndroid } from './native';

export const TABLET_MIN_WIDTH_PX = 600;

export type OrientationLock = 'portrait-primary' | 'any';

let orientationRequested: OrientationLock | '' = '';

function installedDisplay(): boolean {
    try {
        if (typeof window.matchMedia !== 'function') return false;
        return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
    } catch {
        return false;
    }
}

export function orientationLockFor(): OrientationLock | null {
    if (isNativeAndroid() || !isAndroidDevice() || !installedDisplay()) return null;
    const device = window.screen;
    const short = device ? Math.min(Number(device.width), Number(device.height)) : NaN;
    if (!Number.isFinite(short) || short <= 0) return null;
    return short < TABLET_MIN_WIDTH_PX ? 'portrait-primary' : 'any';
}

export function applyOrientationLock(): void {
    const wanted = orientationLockFor();
    if (!wanted || wanted === orientationRequested) return;
    let orientation: (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    try { orientation = window.screen && (window.screen.orientation as typeof orientation); } catch { orientation = undefined; }
    if (!orientation || typeof orientation.lock !== 'function') return;
    orientationRequested = wanted;
    try {
        Promise.resolve(orientation.lock(wanted)).catch(() => {});
    } catch {}
}
