import { viewState } from '../core/view-state';
import { securityState } from '../core/state';
import { appLocalStore, safeStoreGet } from '../core/storage';
import { BIOMETRIC_STORAGE_KEY } from '../core/storage-keys';
import { noteAppLockExcuse } from './app-lock';
import { completePinUnlock, requestPinBeforeConfig } from './pin';
import { verifyStoredPin } from '../services/crypto';
import { showToast } from '../ui/toast';
import { isNativeApp } from '../platform/native';

export const BIOMETRIC_PRF_SALT = 'zoew-biometric-pin-wrap-v1';

export function bytesToB64(buf) {
    const bytes = new Uint8Array(buf);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return btoa(out);
}

export function b64ToBytes(b64) {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

export function readBiometricRecord() {
    try {
        const raw = appLocalStore.getItem(BIOMETRIC_STORAGE_KEY);
        if (!raw) return null;
        const rec = JSON.parse(raw);
        if (!rec || typeof rec.credentialId !== 'string' || !rec.credentialId) return null;
        if (rec.mode !== 'prf' && rec.mode !== 'device' && rec.mode !== 'native') return null;
        if (!rec.wrapped || typeof rec.wrapped.iv !== 'string' || typeof rec.wrapped.data !== 'string') return null;
        if (rec.mode === 'device' && typeof rec.wrapKey !== 'string') return null;
        return rec;
    } catch (e) {
        return null;
    }
}

export function writeBiometricRecord(rec) {
    try {
        appLocalStore.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(rec));
        return true;
    } catch (e) {
        return false;
    }
}

export function clearBiometricRecord() {
    try {
        appLocalStore.removeItem(BIOMETRIC_STORAGE_KEY);
        if (isNativeApp()) import('../platform/native-biometric').then((m) => m.nativeForgetPin(), () => {});
        return true;
    } catch (e) {
        return false;
    }
}

export function isBiometricEnabled() {
    return !!readBiometricRecord();
}

export async function biometricPlatformAvailable() {
    if (isNativeApp()) return import('../platform/native-biometric').then((m) => m.nativeBiometricAvailable(), () => false);
    try {
        if (!window.isSecureContext) return false;
        if (!window.PublicKeyCredential || !navigator.credentials) return false;
        if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
        return false;
    }
}

export async function wrapPinWithRawKey(pin, rawKey) {
    const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(pin));
    return { iv: bytesToB64(iv), data: bytesToB64(cipher) };
}

export async function unwrapPinWithRawKey(wrapped, rawKey) {
    try {
        const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: b64ToBytes(wrapped.iv) },
            key,
            b64ToBytes(wrapped.data)
        );
        return new TextDecoder().decode(plain);
    } catch (e) {
        return '';
    }
}

export async function biometricPrfBytes(credentialId) {
    try {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rpId: window.location.hostname,
                allowCredentials: [{ type: 'public-key', id: b64ToBytes(credentialId), transports: ['internal'] }],
                userVerification: 'required',
                timeout: 60000,
                extensions: { prf: { eval: { first: new TextEncoder().encode(BIOMETRIC_PRF_SALT) } } }
            }
        });
        const results: any = assertion && (assertion as any).getClientExtensionResults();
        const first = results && results.prf && results.prf.results && results.prf.results.first;
        return first ? new Uint8Array(first) : null;
    } catch (e) {
        return null;
    }
}

export async function enrollBiometricRecord(pin) {
    if (isNativeApp()) {
        const nativeBiometric = await import('../platform/native-biometric');
        await nativeBiometric.nativeStorePin(pin);
        return { mode: 'native', credentialId: nativeBiometric.NATIVE_BIOMETRIC_SERVER, wrapped: { iv: '', data: '' } };
    }
    const credential = await navigator.credentials.create({
        publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: { name: 'ZoeW', id: window.location.hostname },
            user: {
                id: crypto.getRandomValues(new Uint8Array(16)),
                name: 'zoew-device',
                displayName: 'ZoeW'
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'discouraged',
                requireResidentKey: false
            },
            timeout: 60000,
            attestation: 'none',
            extensions: { prf: { eval: { first: new TextEncoder().encode(BIOMETRIC_PRF_SALT) } } }
        }
    });
    if (!credential) return null;
    const credentialId = bytesToB64((credential as any).rawId);
    let ext: any = {};
    try {
        ext = (credential as any).getClientExtensionResults() || {};
    } catch (e) {
        ext = {};
    }
    if (ext.prf && ext.prf.enabled) {
        const rawKey = await biometricPrfBytes(credentialId);
        if (rawKey) return { mode: 'prf', credentialId, wrapped: await wrapPinWithRawKey(pin, rawKey) };
    }
    const deviceKey = crypto.getRandomValues(new Uint8Array(32));
    return {
        mode: 'device',
        credentialId,
        wrapKey: bytesToB64(deviceKey),
        wrapped: await wrapPinWithRawKey(pin, deviceKey)
    };
}

export async function biometricUnlockPin() {
    noteAppLockExcuse();
    const rec = readBiometricRecord();
    if (!rec) return '';
    if (rec.mode === 'native') {
        const result = await (await import('../platform/native-biometric')).nativeUnlockPin();
        if (result.status === 'ok') return result.pin;
        if (result.status === 'invalidated') {
            clearBiometricRecord();
            refreshBiometricUi();
            showToast('⚠️ ក្រយៅដៃ/មុខក្នុងទូរស័ព្ទត្រូវបានប្តូរ ➜ ការចងចាស់លែងប្រើបាន! សូមវាយ PIN រួចបើកវាឡើងវិញក្នុងម៉ឺនុយការកំណត់។');
        }
        return '';
    }
    if (rec.mode === 'prf') {
        const rawKey = await biometricPrfBytes(rec.credentialId);
        if (!rawKey) return '';
        return await unwrapPinWithRawKey(rec.wrapped, rawKey);
    }
    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rpId: window.location.hostname,
            allowCredentials: [{ type: 'public-key', id: b64ToBytes(rec.credentialId), transports: ['internal'] }],
            userVerification: 'required',
            timeout: 60000
        }
    });
    if (!assertion) return '';
    return await unwrapPinWithRawKey(rec.wrapped, b64ToBytes(rec.wrapKey));
}

export function setBiometricLabel(target, busy) {
    if (target === 'pin') viewState.pinBiometricBusy = !!busy;
}

export function setBiometricBusy(busy) {
    setBiometricLabel('pin', busy);
}

export function refreshBiometricUi() {
    const enabled = isBiometricEnabled();
    viewState.biometricToggleText = enabled ? 'បើក' : 'បិទ';
    viewState.biometricToggleOn = enabled;
    viewState.pinBiometricVisible = enabled;
}

export async function runBiometricUnlock() {
    if (securityState.biometricUnlockInFlight || securityState.isVerifyingPin) return false;
    if (!isBiometricEnabled()) return false;
    const lockoutUntil = parseInt(safeStoreGet(appLocalStore, 'zoew_pin_lockout_until') || '0');
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
        showToast(`⚠️ បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ${secondsLeft} វិនាទី។`);
        return false;
    }
    securityState.biometricUnlockInFlight = true;
    setBiometricBusy(true);
    try {
        const pin = await biometricUnlockPin();
        if (!pin) return false;
        const savedPin = appLocalStore.getItem('zoew_security_pin_hash');
        if (!savedPin || !(await verifyStoredPin(pin, savedPin))) {
            clearBiometricRecord();
            refreshBiometricUi();
            showToast('⚠️ ការចងក្រយៅដៃ/មុខលែងត្រូវនឹង PIN បច្ចុប្បន្នទេ! សូមបើកវាឡើងវិញក្នុងម៉ឺនុយការកំណត់។');
            return false;
        }
        await completePinUnlock(pin);
        return true;
    } catch (e) {
        return false;
    } finally {
        securityState.biometricUnlockInFlight = false;
        setBiometricBusy(false);
    }
}

export async function startBiometricEnrollment(verifiedPin) {
    noteAppLockExcuse();
    if (securityState.biometricUnlockInFlight) return;
    if (!verifiedPin) {
        alert('មិនអាចបើកបានទេ! សូមវាយលេខកូដ PIN ម្តងទៀត។');
        return;
    }
    if (!(await biometricPlatformAvailable())) {
        alert(isNativeApp()
            ? 'ទូរស័ព្ទនេះមិនទាន់បើកក្រយៅដៃ ឬមុខទេ។ សូមកំណត់វាក្នុង Settings របស់ Android ជាមុនសិន រួចសាកម្តងទៀត។'
            : 'ឧបករណ៍នេះមិនគាំទ្រការស្កេនក្រយៅដៃ ឬមុខទេ។ ត្រូវការ iPhone/iPad (Safari) ឬ Android (Chrome) ដែលបានបើក Face ID / Touch ID / ក្រយៅដៃរួច ហើយបើកគេហទំព័រតាម HTTPS។');
        return;
    }
    securityState.biometricUnlockInFlight = true;
    try {
        const rec = await enrollBiometricRecord(verifiedPin);
        if (!rec) {
            showToast('❌ មិនអាចចងក្រយៅដៃ ឬមុខបានទេ!');
            return;
        }
        if (!writeBiometricRecord(rec)) {
            showToast('❌ អង្គចងចាំឧបករណ៍ពេញ! មិនអាចរក្សាទុកបានទេ។');
            return;
        }
        refreshBiometricUi();
        showToast(rec.mode === 'prf' || rec.mode === 'native'
            ? '✅ បើករួច! លើកក្រោយស្កេនក្រយៅដៃ ឬមុខ ជំនួសការវាយ PIN។'
            : '✅ បើករួច! លើកក្រោយស្កេនក្រយៅដៃ ឬមុខ ជំនួសការវាយ PIN។ (ឧបករណ៍នេះមិនគាំទ្រការចាក់សោដោយជីវមាត្រពេញលេញទេ — PIN ត្រូវរក្សាទុកក្នុងឧបករណ៍)');
    } catch (e) {
        showToast('❌ បានបោះបង់ ឬមិនអាចចងក្រយៅដៃ ឬមុខបានទេ!');
    } finally {
        securityState.biometricUnlockInFlight = false;
    }
}

export function toggleBiometricUnlock() {
    if (isBiometricEnabled()) {
        if (!confirm('បិទការចូលដោយក្រយៅដៃ ឬមុខ? អ្នកនឹងត្រូវវាយលេខកូដ PIN ដូចមុនវិញ។')) return;
        if (!clearBiometricRecord()) {
            showToast('❌ មិនអាចបិទការចូលដោយក្រយៅដៃ ឬមុខបានទេ — ការកំណត់នៅដដែល។');
            return;
        }
        refreshBiometricUi();
        showToast('✅ បានបិទការចូលដោយក្រយៅដៃ ឬមុខ។');
        return;
    }
    requestPinBeforeConfig(startBiometricEnrollment, 'biometric');
}

export async function initBiometricUi() {
    refreshBiometricUi();
    const supported = await biometricPlatformAvailable();
    viewState.biometricUnsupported = !supported;
    if (!supported && !isBiometricEnabled()) viewState.biometricToggleText = 'មិនគាំទ្រ';
}
