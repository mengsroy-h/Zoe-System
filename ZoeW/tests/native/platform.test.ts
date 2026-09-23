/**
 * ⛔ ស្រទាប់ platform ត្រូវ **fail closed** ៖ គ្មាន bridge (web) ➜ ឥរិយាបថ web
 *    ដដែលបេះបិទ។ bridge Android ➜ PTR បើក · URL របស់ Function ទៅ origin ពិត។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNativeAndroid, isNativeApp, nativeWebOrigin, pullToRefreshSupported, resolveNativeApiUrl } from '../../src/platform/native';

function installBridge(platform: string, native = true) {
    (window as any).Capacitor = { isNativePlatform: () => native, getPlatform: () => platform };
}

afterEach(() => {
    delete (window as any).Capacitor;
    vi.unstubAllEnvs();
});

describe('platform/native', () => {
    it('web ៖ គ្មាន bridge ➜ មិនមែន native · PTR បិទ · URL ដដែល', () => {
        expect(isNativeApp()).toBe(false);
        expect(isNativeAndroid()).toBe(false);
        expect(pullToRefreshSupported()).toBe(false);
        vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', 'https://zoew.example.app');
        expect(resolveNativeApiUrl('/.netlify/functions/zto-order-detail?barcode=1')).toBe('/.netlify/functions/zto-order-detail?barcode=1');
    });

    it('bridge ដែលបោះ ➜ ចាត់ទុកជា web', () => {
        (window as any).Capacitor = { isNativePlatform: () => { throw new Error('x'); } };
        expect(isNativeApp()).toBe(false);
        expect(pullToRefreshSupported()).toBe(false);
    });

    it('Capacitor លើ web (isNativePlatform false) ➜ web', () => {
        installBridge('web', false);
        expect(isNativeApp()).toBe(false);
        expect(pullToRefreshSupported()).toBe(false);
    });

    it('Android native ➜ PTR បើក · URL relative ទៅ origin', () => {
        installBridge('android');
        expect(isNativeAndroid()).toBe(true);
        expect(pullToRefreshSupported()).toBe(true);
        vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', 'https://zoew.example.app/');
        expect(nativeWebOrigin()).toBe('https://zoew.example.app');
        expect(resolveNativeApiUrl('/.netlify/functions/zto-order-detail?diag=1')).toBe('https://zoew.example.app/.netlify/functions/zto-order-detail?diag=1');
        expect(resolveNativeApiUrl('https://other.example/api')).toBe('https://other.example/api');
        expect(resolveNativeApiUrl('https://script.google.com/macros/s/x/exec')).toBe('https://script.google.com/macros/s/x/exec');
    });

    it('origin មិនត្រឹមត្រូវ (http · មាន path) ➜ មិនប្តូរ URL', () => {
        installBridge('android');
        vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', 'http://zoew.example.app');
        expect(nativeWebOrigin()).toBe('');
        expect(resolveNativeApiUrl('/.netlify/functions/zto-order-detail')).toBe('/.netlify/functions/zto-order-detail');
        vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', 'https://zoew.example.app/sub');
        expect(nativeWebOrigin()).toBe('');
    });
});
