import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupNativeShell } from '../../src/app/lifecycle/native-shell';
import { createLifecycleScope } from '../../src/app/lifecycle/scope';
import { securityState, uiState } from '../../src/core/state';

const native = vi.hoisted(() => ({ addListener: vi.fn(), minimizeApp: vi.fn(async () => {}) }));
vi.mock('@capacitor/app', () => ({ App: native }));
vi.mock('@capacitor/core', () => ({}));

beforeEach(() => {
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    native.addListener.mockReset();
    native.minimizeApp.mockClear();
    securityState.appIsLocked = true;
    uiState.currentAppPage = 'data';
});
afterEach(() => { delete (window as any).Capacitor; });

describe('Android listener ៖ សម្អាតការចុះឈ្មោះមិនពេញលេញ', () => {
    it('listener មួយបដិសេធ ➜ listener ផ្សេងត្រូវដកចេញពេល dispose', async () => {
        const remove = vi.fn(async () => {});
        native.addListener.mockImplementation((name: string) => name === 'pause'
            ? Promise.reject(new Error('bridge unavailable')) : Promise.resolve({ remove }));
        const scope = createLifecycleScope();
        setupNativeShell(scope);
        await vi.waitFor(() => expect(native.addListener).toHaveBeenCalledTimes(3));
        scope.dispose();
        await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
    });

    it('handle មកយឺតក្រោយ dispose ➜ callback មិនដំណើរការ និង handle ត្រូវដកចេញ', async () => {
        let resolve!: (value: any) => void;
        const pending = new Promise((yes) => { resolve = yes; });
        const remove = vi.fn(async () => {});
        let back!: () => void;
        native.addListener.mockImplementation((name: string, callback: () => void) => {
            if (name === 'backButton') { back = callback; return pending; }
            return Promise.resolve({ remove });
        });
        const scope = createLifecycleScope();
        setupNativeShell(scope);
        await vi.waitFor(() => expect(native.addListener).toHaveBeenCalledTimes(3));
        scope.dispose();
        back();
        expect(native.minimizeApp).not.toHaveBeenCalled();
        resolve({ remove });
        await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(3));
    });
});
