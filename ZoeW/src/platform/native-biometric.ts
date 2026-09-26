import { AccessControl, NativeBiometric } from '@capgo/capacitor-native-biometric';

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
