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

export const NATIVE_QUERY_HEADER = 'X-Zoe-Query';

const NATIVE_QUERY_MAX = 2048;

export function nativeFunctionRequest(url: string, options: any): { url: string; options: any } {
    const target = resolveNativeApiUrl(url);
    const unchanged = { url: target, options };
    try {
        return moveQueryToHeader(target, options) || unchanged;
    } catch {
        return unchanged;
    }
}

function moveQueryToHeader(target: string, options: any): { url: string; options: any } | null {
    if (!isNativeApp() || typeof target !== 'string') return null;
    const origin = nativeWebOrigin();
    if (!origin || !target.startsWith(origin + '/.netlify/functions/')) return null;
    const method = String((options && options.method) || 'GET').toUpperCase();
    if (method !== 'GET') return null;
    const headers = options && options.headers;
    if (!headers || typeof headers !== 'object' || Array.isArray(headers) || !Object.keys(headers).length) return null;
    const hashAt = target.indexOf('#');
    const bare = hashAt === -1 ? target : target.slice(0, hashAt);
    const queryAt = bare.indexOf('?');
    if (queryAt === -1) return null;
    const query = bare.slice(queryAt + 1);
    if (!query || query.length > NATIVE_QUERY_MAX) return null;
    return { url: bare.slice(0, queryAt), options: { ...options, headers: { ...headers, [NATIVE_QUERY_HEADER]: query } } };
}

export function nativeWebOrigin(): string {
    const raw = String(import.meta.env.VITE_NATIVE_WEB_ORIGIN || '').trim();
    if (!/^https:\/\/[^/\s?#]+$/i.test(raw.replace(/\/+$/, ''))) return '';
    return raw.replace(/\/+$/, '');
}
