/**
 * ⛔ ម្ចាស់គម្រោង (រូបពី Android PWA) ៖ «❌ មិនអាចចងក្រយៅដៃ ឬមុខបានទេ — … មិនគាំទ្រ … (WebAuthn PRF)» លើទូរស័ព្ទដែលគាំទ្រ PRF ·
 *    APK មិនអី (ក្រយៅដៃ native)។ Android (Google Password Manager) ផ្តល់ PRF តែលើ **passkey ដែល discoverable** ➜ credential
 *    `residentKey: 'discouraged'` ទទួល `prf.enabled: false` ➜ «មិនគាំទ្រ» ក្លែងក្លាយ (ZoeKeyGen កែរួច · ZoeW នៅដដែល ➜ ថ្នេររវាង ២ App)។
 * ⛔ ច្បាប់ ៖ ស្នើ passkey (`residentKey: 'required'`) · PRF ដែល `create()` ផ្តល់ផ្ទាល់ ➜ ប្រើភ្លាម (ស្កេនតែម្តង) · `prf: {}` គ្មាន `enabled` ➜ សួរ `get()` ·
 *    បោះបង់ការស្កេនទី ២ ➜ «បោះបង់» មិនមែន «មិនគាំទ្រ» · គ្មាន PRF ពិត (`enabled: false`) ➜ មិនចង ហើយណែនាំ Google Password Manager ·
 *    ⛔ PRF-only ដដែល ៖ គ្មាន record ដែលទុកសោក្នុងឧបករណ៍។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    toasts: [] as string[], alerts: [] as string[], creates: [] as any[], gets: 0,
    mode: { android: true, prfAtCreate: false, enabledMissing: false, noPrf: false, cancelGet: false }
}));

vi.mock('../src/ui/toast', async (orig) => ({ ...(await orig<any>()), showToast: (m: string) => { h.toasts.push(String(m)); } }));
vi.mock('../src/platform/native', async (orig) => ({ ...(await orig<any>()), isNativeApp: () => false }));

import { BIOMETRIC_STORAGE_KEY } from '../src/core/storage-keys';
import { biometricUnlockPin, startBiometricEnrollment } from '../src/features/biometric';

const PIN = '482915';
const PRF_KEY = new Uint8Array(32).fill(9);

function installAndroidWebAuthn() {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    (window as any).PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => true };
    let credPrf = false;
    const credentials = {
        create: async (opts: any) => {
            const sel = (opts && opts.publicKey && opts.publicKey.authenticatorSelection) || {};
            h.creates.push(sel);
            const discoverable = sel.residentKey === 'required' || sel.residentKey === 'preferred' || sel.requireResidentKey === true;
            credPrf = !h.mode.noPrf && (!h.mode.android || discoverable);
            const ext = !credPrf ? { prf: { enabled: false } }
                : h.mode.prfAtCreate ? { prf: { enabled: true, results: { first: PRF_KEY.buffer } } }
                : h.mode.enabledMissing ? { prf: {} } : { prf: { enabled: true } };
            return { rawId: new Uint8Array([5, 6, 7, 8]).buffer, getClientExtensionResults: () => ext };
        },
        get: async (opts: any) => {
            h.gets++;
            if (h.mode.cancelGet) throw new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError');
            const wantsPrf = !!(opts && opts.publicKey && opts.publicKey.extensions && opts.publicKey.extensions.prf);
            return { getClientExtensionResults: () => (credPrf && wantsPrf ? { prf: { results: { first: PRF_KEY.buffer } } } : {}) };
        }
    };
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: credentials });
}

const stored = () => window.localStorage.getItem(BIOMETRIC_STORAGE_KEY);
const unsupportedToast = () => h.toasts.find((t) => t.indexOf('WebAuthn PRF') !== -1);

beforeEach(() => {
    h.toasts.length = 0;
    h.alerts.length = 0;
    h.creates.length = 0;
    h.gets = 0;
    h.mode = { android: true, prfAtCreate: false, enabledMissing: false, noPrf: false, cancelGet: false };
    window.localStorage.clear();
    installAndroidWebAuthn();
    vi.stubGlobal('alert', (m: string) => { h.alerts.push(String(m)); });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ក្រយៅដៃ/មុខ web លើ Android ៖ PRF តែលើ passkey (discoverable)', () => {
    it('ជាន់អប្បបរមា ៖ ឧបករណ៍ក្លែងមិនមែន Android (PRF លើ credential ណាក៏បាន) ➜ ចងបាន', async () => {
        h.mode.android = false;
        await startBiometricEnrollment(PIN);
        expect(stored()).not.toBe(null);
        expect(JSON.parse(stored()!).mode).toBe('prf');
    });

    it('⛔ Android ➜ ស្នើ passkey (residentKey required) ➜ ចងបាន · ស្រាយ PIN ចេញវិញបាន · គ្មានសារ «មិនគាំទ្រ»', async () => {
        await startBiometricEnrollment(PIN);
        expect(h.creates[0]).toMatchObject({ residentKey: 'required', requireResidentKey: true });
        expect(unsupportedToast()).toBe(undefined);
        expect(stored()).not.toBe(null);
        const rec = JSON.parse(stored()!);
        expect(rec.mode).toBe('prf');
        expect(rec.wrapKey).toBe(undefined);
        expect(await biometricUnlockPin()).toBe(PIN);
    });

    it('⛔ PRF មកជាមួយ create() ➜ ប្រើភ្លាម (ស្កេនតែម្តង · គ្មាន get())', async () => {
        h.mode.prfAtCreate = true;
        await startBiometricEnrollment(PIN);
        expect(stored()).not.toBe(null);
        expect(h.gets).toBe(0);
        expect(await biometricUnlockPin()).toBe(PIN);
    });

    it('⛔ `prf: {}` (គ្មាន enabled) ➜ សួរ get() ➜ ចងបាន', async () => {
        h.mode.enabledMissing = true;
        await startBiometricEnrollment(PIN);
        expect(h.gets).toBe(1);
        expect(stored()).not.toBe(null);
        expect(unsupportedToast()).toBe(undefined);
    });

    it('⛔ បោះបង់ការស្កេនទី ២ ➜ «បោះបង់» មិនមែន «មិនគាំទ្រ PRF» · មិនចង', async () => {
        h.mode.cancelGet = true;
        await startBiometricEnrollment(PIN);
        expect(stored()).toBe(null);
        expect(unsupportedToast()).toBe(undefined);
        expect(h.toasts.some((t) => t.indexOf('បោះបង់') !== -1)).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ គ្មាន PRF ពិត (enabled: false លើ passkey) ➜ មិនចង · ប្រាប់ឲ្យប្រើ PIN និងណែនាំ Google Password Manager', async () => {
        h.mode.noPrf = true;
        await startBiometricEnrollment(PIN);
        expect(stored()).toBe(null);
        expect(unsupportedToast()).toBeTruthy();
        expect(unsupportedToast()).toContain('Google Password Manager');
        expect(unsupportedToast()).toContain('PIN');
    });
});
