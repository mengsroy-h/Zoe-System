import { AccessControl, NativeBiometric } from '@capgo/capacitor-native-biometric';

/**
 * ជីវមាត្រលើ Android native ៖ WebView របស់ Android **មិនគាំទ្រ WebAuthn**
 * ➜ ផ្លូវ `navigator.credentials` របស់ web ដើរមិនកើត។
 *
 * ⛔ គោលការណ៍ដដែលនឹង web ៖ ជីវមាត្រជាការ **ដោះសោ PIN** មិនមែនជំនួស PIN ។
 *    PIN ត្រូវរក្សាក្នុង Android Keystore ដោយ `BIOMETRY_CURRENT_SET` ➜ កូនសោ
 *    ឌិគ្រីបចងនឹងការផ្ទៀងផ្ទាត់ជីវមាត្រពិត (BiometricPrompt + CryptoObject)
 *    ស្មើនឹងរបៀប `prf` របស់ web — មិនមែន `device` (កូនសោក្នុង localStorage)។
 * ⛔ ការចុះឈ្មោះក្រយៅដៃថ្មីក្នុងទូរស័ព្ទ ធ្វើឲ្យកូនសោលែងប្រើបាន ➜
 *    `invalidated` ➜ App លុបការចង ហើយប្រាប់អ្នកប្រើ (មិនមែនធ្លាក់ស្ងាត់ៗ)។
 */
export const NATIVE_BIOMETRIC_SERVER = 'zoew.biometric.pin.v1';

export type NativeUnlockResult =
    | { status: 'ok'; pin: string }
    | { status: 'invalidated' }
    | { status: 'cancelled' };

export async function nativeBiometricAvailable(): Promise<boolean> {
    try {
        const result = await NativeBiometric.isAvailable({ useFallback: false });
        return !!(result && result.isAvailable);
    } catch {
        return false;
    }
}

export async function nativeStorePin(pin: string): Promise<boolean> {
    await NativeBiometric.setCredentials({
        username: 'zoew',
        password: pin,
        server: NATIVE_BIOMETRIC_SERVER,
        accessControl: AccessControl.BIOMETRY_CURRENT_SET,
        title: 'ZoeW',
        negativeButtonText: 'បោះបង់'
    });
    return true;
}

export async function nativeUnlockPin(): Promise<NativeUnlockResult> {
    try {
        const credentials = await NativeBiometric.getSecureCredentials({
            server: NATIVE_BIOMETRIC_SERVER,
            title: 'ZoeW',
            reason: 'ស្កេនក្រយៅដៃ ឬមុខ ដើម្បីដោះសោ',
            negativeButtonText: 'វាយ PIN'
        });
        const pin = credentials && typeof credentials.password === 'string' ? credentials.password : '';
        return pin ? { status: 'ok', pin } : { status: 'invalidated' };
    } catch (e) {
        return nativeUnlockFailure(e);
    }
}

/**
 * ⛔ plugin រាយការណ៍ «ក្រយៅដៃត្រូវបានប្តូរ» ជា **២ ដំណាក់** ៖ លើកដំបូង ➜
 *    `KeyPermanentlyInvalidatedException` ➜ វាលុបកូនសោ រួចឆ្លើយកូដ `0`
 *    («Biometric crypto object unavailable»); លើកក្រោយ ➜ កូដ `21` («No
 *    protected credentials found»)។ ទាំង ២ ជាសាលក្រមស្ថាពរ ➜ `invalidated`។
 * ⛔ កូដ `0` ផ្សេងៗ (Keystore ធ្លាក់បណ្តោះអាសន្ន) ➜ `cancelled` — «មិនអាច
 *    ផ្ទៀងផ្ទាត់» ≠ «ខុស» ➜ មិនលុបការចង។
 */
export function nativeUnlockFailure(e: unknown): NativeUnlockResult {
    const code = String((e && (e as any).code) || '');
    const message = String((e && (e as any).message) || '');
    if (code === '21') return { status: 'invalidated' };
    if (code === '0' && /crypto object unavailable|enrollment changed/i.test(message)) return { status: 'invalidated' };
    return { status: 'cancelled' };
}

export function nativeForgetPin(): void {
    NativeBiometric.deleteCredentials({ server: NATIVE_BIOMETRIC_SERVER }).catch(() => {});
}
