/**
 * ⛔ SECURITY-1 ៖ ការចូលដោយក្រយៅដៃ/មុខលើ web ត្រូវចងនឹង **WebAuthn PRF** តែប៉ុណ្ណោះ (ការសម្រេចរបស់ម្ចាស់គម្រោង ៖ PRF-only)។
 *    មុនកែ ៖ ឧបករណ៍គ្មាន PRF ធ្លាក់ចូលរបៀប `device` ដែលទុក `wrapKey` (សោ AES ឆៅ) ក្បែរ `wrapped` (PIN ដែលរុំ) ក្នុង localStorage ➜
 *    អ្នកណាចម្លង storage បាន ទទួល PIN វិញដោយគ្មានស្នាមម្រាមដៃ (WebAuthn `get()` គ្រាន់តែជាទ្វារ UI)។
 *    ឥឡូវ ៖ គ្មាន PRF ➜ មិនចង (ប្រាប់ឲ្យប្រើ PIN) · record `device` ចាស់ ➜ លុបចេញពី storage ពេលបើក App + ប្រាប់ម្តង · មិនដោះ PIN ពីវា។
 *    ទិសផ្ទុយ ៖ PRF ➜ ចង និងដោះសោដូចដើម (គ្មាន `wrapKey`)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ toasts: [] as string[], alerts: [] as string[], prf: true, getCalls: 0 }));

vi.mock('../src/ui/toast', async (orig) => ({ ...(await orig<any>()), showToast: (m: string) => { h.toasts.push(String(m)); } }));
vi.mock('../src/platform/native', async (orig) => ({ ...(await orig<any>()), isNativeApp: () => false }));

import { BIOMETRIC_STORAGE_KEY } from '../src/core/storage-keys';
import {
    biometricUnlockPin, bytesToB64, enrollBiometricRecord, initBiometricUi, isBiometricEnabled, startBiometricEnrollment, wrapPinWithRawKey
} from '../src/features/biometric';

const PIN = '482915';
const PRF_KEY = new Uint8Array(32).fill(7);

function installWebAuthn() {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    (window as any).PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => true };
    const credentials = {
        create: async () => ({
            rawId: new Uint8Array([1, 2, 3, 4]).buffer,
            getClientExtensionResults: () => (h.prf ? { prf: { enabled: true } } : {})
        }),
        get: async (opts: any) => {
            h.getCalls++;
            const wantsPrf = !!(opts && opts.publicKey && opts.publicKey.extensions && opts.publicKey.extensions.prf);
            return {
                getClientExtensionResults: () => (h.prf && wantsPrf ? { prf: { results: { first: PRF_KEY.buffer } } } : {})
            };
        }
    };
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: credentials });
}

const stored = () => window.localStorage.getItem(BIOMETRIC_STORAGE_KEY);

beforeEach(() => {
    h.toasts.length = 0;
    h.alerts.length = 0;
    h.prf = true;
    h.getCalls = 0;
    window.localStorage.clear();
    installWebAuthn();
    vi.stubGlobal('alert', (m: string) => { h.alerts.push(String(m)); });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('SECURITY-1 ៖ biometric web = PRF-only', () => {
    it('⛔ ឧបករណ៍គ្មាន PRF ➜ មិនចង · គ្មាន record · គ្មាន wrapKey ក្នុង storage · ប្រាប់ឲ្យប្រើ PIN', async () => {
        h.prf = false;
        const rec = await enrollBiometricRecord(PIN);
        expect(rec).toBeNull();
        await startBiometricEnrollment(PIN);
        expect(stored()).toBeNull();
        expect(JSON.stringify(window.localStorage)).not.toMatch(/wrapKey/);
        expect(isBiometricEnabled()).toBe(false);
        expect(h.toasts.concat(h.alerts).some((m) => /PIN/.test(m))).toBe(true);
    });

    it('⛔ record `device` ចាស់ ➜ ពេលបើក App លុបចេញពី storage · បិទ · ប្រាប់ម្តង', async () => {
        window.localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify({
            mode: 'device', credentialId: 'AQIDBA==', wrapKey: 'S0VZS0VZS0VZS0VZS0VZS0VZS0VZS0VZS0VZS0VZS0U=', wrapped: { iv: 'aXZpdml2aXZpdml2', data: 'ZGF0YQ==' }
        }));
        await initBiometricUi();
        expect(stored()).toBeNull();
        expect(isBiometricEnabled()).toBe(false);
        expect(h.toasts.filter((m) => /ក្រយៅដៃ|មុខ/.test(m)).length).toBe(1);
        await initBiometricUi();
        expect(h.toasts.filter((m) => /ក្រយៅដៃ|មុខ/.test(m)).length).toBe(1);
    });

    it('⛔ record `device` ពិត (wrapKey ឌិគ្រីប PIN បាន · ត្រូវគេដាក់វិញ) មិនដោះ PIN ទេ', async () => {
        const deviceKey = new Uint8Array(32).fill(9);
        window.localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify({
            mode: 'device', credentialId: 'AQIDBA==', wrapKey: bytesToB64(deviceKey), wrapped: await wrapPinWithRawKey(PIN, deviceKey)
        }));
        expect(await biometricUnlockPin()).toBe('');
    });

    it('ទិសផ្ទុយ ៖ ឧបករណ៍មាន PRF ➜ ចង `prf` (គ្មាន wrapKey) ➜ ដោះសោបាន PIN ដដែល · record `prf` មិនត្រូវលុបពេលបើក App', async () => {
        await startBiometricEnrollment(PIN);
        const rec = JSON.parse(stored() || 'null');
        expect(rec && rec.mode).toBe('prf');
        expect(rec && rec.wrapKey).toBeUndefined();
        expect(JSON.stringify(rec)).not.toContain(PIN);
        expect(await biometricUnlockPin()).toBe(PIN);
        await initBiometricUi();
        expect(stored()).not.toBeNull();
        expect(isBiometricEnabled()).toBe(true);
    });
});
