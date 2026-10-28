import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lab = vi.hoisted(() => ({
    verify: null as null | Promise<boolean>,
    key: null as null | Promise<any>,
    hash: null as null | Promise<string>
}));
vi.mock('../src/services/crypto', async (original) => ({
    ...(await original<any>()),
    verifyStoredPin: vi.fn(() => lab.verify || Promise.resolve(true)),
    deriveLookupSecretKey: vi.fn(() => lab.key || Promise.resolve({ type: 'secret', owner: 'PIN' })),
    hashPin: vi.fn(() => lab.hash || Promise.resolve('pbkdf2:new-pin')),
    rememberLookupSecretKey: vi.fn(async () => true)
}));
vi.mock('../src/features/zto-status', async (original) => ({
    ...(await original<any>()), scheduleZtoStatusSweep: vi.fn()
}));
vi.mock('../src/features/zto-palm-login', async (original) => ({
    ...(await original<any>()), refreshZtoPalmSession: vi.fn()
}));
vi.mock('../src/features/biometric', async (original) => ({
    ...(await original<any>()), isBiometricEnabled: () => false,
    refreshBiometricUi: vi.fn(), clearBiometricRecord: vi.fn()
}));
vi.mock('../src/ui/toast', async (original) => ({
    ...(await original<any>()), showToast: vi.fn()
}));

import { refTo, setFieldValue } from '../src/app/refs';
import { modalIsOpen, registerModalMeta, setModalDisplay, unregisterModalMeta } from '../src/core/modals';
import { firebaseState, securityState } from '../src/core/state';
import { appLocalStore, appSessionStore } from '../src/core/storage';
import { APP_LOCK_SESSION_KEY, BIOMETRIC_STORAGE_KEY } from '../src/core/storage-keys';
import { cancelPinEntryFlow, cancelPinSetupFlow } from '../src/features/config';
import { runBiometricUnlock, wrapPinWithRawKey } from '../src/features/biometric';
import { forgetAppLockPin, showAppLockScreen, verifyAppLockPin } from '../src/features/app-lock';
import { requestPinBeforeConfig, saveNewSecurityPin, verifySecurityPin } from '../src/features/pin';
import { deriveLookupSecretKey } from '../src/services/crypto';

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
};
const turn = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const modalIds = ['pinModal', 'pinSetupModal', 'configModal'];

beforeEach(() => {
    vi.clearAllMocks();
    appLocalStore.clear();
    appSessionStore.clear();
    appLocalStore.setItem('zoew_security_pin_hash', 'pbkdf2:original-pin');
    securityState.isVerifyingPin = false;
    securityState.lookupSecretKey = null;
    securityState.pinTargetAction = null;
    securityState.appLockBusy = false;
    securityState.appIsLocked = false;
    firebaseState.auth = null;
    lab.verify = null; lab.key = null; lab.hash = null;
    for (const id of modalIds) { registerModalMeta(id, {}); setModalDisplay(id, 'none'); }
    refTo('securityPinInput')(document.createElement('input'));
    refTo('newSecurityPinInput')(document.createElement('input'));
    refTo('appLockPinInput')(document.createElement('input'));
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', () => true);
});
afterEach(() => {
    for (const id of modalIds) { setModalDisplay(id, 'none'); unregisterModalMeta(id); }
    refTo('securityPinInput')(null); refTo('newSecurityPinInput')(null);
    refTo('appLockPinInput')(null);
    vi.unstubAllGlobals();
});

describe('ការផ្ទៀងផ្ទាត់ PIN ចងនឹងសំណើដែលអ្នកប្រើមិនទាន់បោះបង់', () => {
    it('សំណើនៅបើក និង PIN ត្រឹមត្រូវ ដំណើរការគោលដៅមួយដង', async () => {
        const action = vi.fn();
        requestPinBeforeConfig(action, 'locker');
        setFieldValue('securityPinInput', '482915');
        await verifySecurityPin();
        expect(action).toHaveBeenCalledExactlyOnceWith('482915');
        expect(modalIsOpen('pinModal')).toBe(false);
    });

    it('បោះបង់ពេលកំពុងផ្ទៀងផ្ទាត់ មិនបើក Config ឡើងវិញ', async () => {
        const gate = deferred<boolean>(); lab.verify = gate.promise;
        const action = vi.fn();
        requestPinBeforeConfig(action, 'locker');
        setFieldValue('securityPinInput', '482915');
        const pending = verifySecurityPin(); await turn();
        cancelPinEntryFlow();
        gate.resolve(true); await pending;
        expect(action).not.toHaveBeenCalled();
        expect(modalIsOpen('configModal')).toBe(false);
        expect(deriveLookupSecretKey).not.toHaveBeenCalled();
    });

    it('បោះបង់ និងសុំគោលដៅដដែលថ្មី មិនប្រើលទ្ធផលចាស់', async () => {
        const gate = deferred<boolean>(); lab.verify = gate.promise;
        const action = vi.fn();
        requestPinBeforeConfig(action, 'locker');
        setFieldValue('securityPinInput', '482915');
        const pending = verifySecurityPin(); await turn();
        cancelPinEntryFlow(); requestPinBeforeConfig(action, 'locker');
        gate.resolve(true); await pending;
        expect(action).not.toHaveBeenCalled();
        expect(modalIsOpen('pinModal')).toBe(true);
    });

    it('បោះបង់ពេលដេរីវេសោ មិនដំណើរការគោលដៅ ឬដាក់សោចូលសតិ', async () => {
        const gate = deferred<any>(); lab.key = gate.promise;
        const action = vi.fn();
        requestPinBeforeConfig(action, 'locker');
        setFieldValue('securityPinInput', '482915');
        const pending = verifySecurityPin(); await turn();
        expect(deriveLookupSecretKey).toHaveBeenCalledOnce();
        cancelPinEntryFlow();
        gate.resolve({ type: 'secret', owner: 'cancelled' }); await pending;
        expect(action).not.toHaveBeenCalled();
        expect(securityState.lookupSecretKey).toBeNull();
        expect(modalIsOpen('configModal')).toBe(false);
    });

    it('PIN ដែលប្តូរពេលកំពុងផ្ទៀងផ្ទាត់ មិនទទួលលទ្ធផល PIN ចាស់', async () => {
        const gate = deferred<boolean>(); lab.verify = gate.promise;
        const action = vi.fn();
        requestPinBeforeConfig(action, 'locker');
        setFieldValue('securityPinInput', '482915');
        const pending = verifySecurityPin(); await turn();
        appLocalStore.setItem('zoew_security_pin_hash', 'pbkdf2:other-pin');
        gate.resolve(true); await pending;
        expect(action).not.toHaveBeenCalled();
        expect(modalIsOpen('pinModal')).toBe(true);
    });

    it('បោះបង់កំណត់ PIN មុន hash ចប់ មិនរក្សាទុក PIN ឬបើក Config', async () => {
        appLocalStore.removeItem('zoew_security_pin_hash');
        const gate = deferred<string>(); lab.hash = gate.promise;
        const action = vi.fn();
        requestPinBeforeConfig(action, 'locker');
        setFieldValue('newSecurityPinInput', '482915');
        const pending = saveNewSecurityPin(); await turn();
        cancelPinSetupFlow();
        gate.resolve('pbkdf2:cancelled-pin'); await pending;
        expect(appLocalStore.getItem('zoew_security_pin_hash')).toBeNull();
        expect(action).not.toHaveBeenCalled();
        expect(modalIsOpen('configModal')).toBe(false);
    });

    it('បោះបង់ពេលកំពុងស្កេនជីវមាត្រ មិនបើក Config ក្រោយការស្កេនចប់', async () => {
        const key = new Uint8Array(32).fill(7);
        const wrapped = await wrapPinWithRawKey('482915', key);
        appLocalStore.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify({ mode: 'prf', credentialId: 'AQID', wrapped }));
        const gate = deferred<any>();
        const get = vi.fn(() => gate.promise);
        Object.defineProperty(navigator, 'credentials', { configurable: true, value: { get } });
        const action = vi.fn();
        requestPinBeforeConfig(action, 'locker');
        const pending = runBiometricUnlock(); await turn();
        expect(get).toHaveBeenCalledOnce();
        cancelPinEntryFlow();
        gate.resolve({ getClientExtensionResults: () => ({ prf: { results: { first: key.buffer } } }) });
        expect(await pending).toBe(false);
        expect(action).not.toHaveBeenCalled();
        expect(modalIsOpen('configModal')).toBe(false);
        expect(deriveLookupSecretKey).not.toHaveBeenCalled();
    });

    it('PIN ត្រឹមត្រូវក្នុងប្រអប់សោបច្ចុប្បន្ន ដោះសោ App បាន', async () => {
        showAppLockScreen();
        setFieldValue('appLockPinInput', '482915');
        expect(await verifyAppLockPin()).toBe(true);
        expect(appSessionStore.getItem(APP_LOCK_SESSION_KEY)).toBe('1');
        expect(securityState.appIsLocked).toBe(false);
    });

    it('លុប PIN ពេលផ្ទៀងផ្ទាត់កំពុងរង់ចាំ មិនដោះសោដោយលទ្ធផលចាស់', async () => {
        const gate = deferred<boolean>(); lab.verify = gate.promise;
        showAppLockScreen();
        setFieldValue('appLockPinInput', '482915');
        const pending = verifyAppLockPin(); await turn();
        forgetAppLockPin();
        gate.resolve(true);
        expect(await pending).toBe(false);
        expect(appSessionStore.getItem(APP_LOCK_SESSION_KEY)).toBeNull();
        expect(securityState.lookupSecretKey).toBeNull();
    });
});
