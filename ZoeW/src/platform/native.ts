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

export function pullToRefreshSupported(): boolean {
    return (window.navigator as any).standalone === true || isNativeAndroid();
}

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
