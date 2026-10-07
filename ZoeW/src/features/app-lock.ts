import { blurActiveElement, focusField, isFieldFocused, setFieldValue, fieldValue } from '../app/refs';
import { setupAppLockAwayGuard } from '../app/behaviors/app-lock-guard';
import { firebaseState, securityState } from '../core/state';
import { viewState } from '../core/view-state';
import { elapsedSince } from '../core/elapsed';
import { appLocalStore, appSessionStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { APP_LOCK_PREF_KEY, APP_LOCK_SESSION_KEY } from '../core/storage-keys';
import { safeFocusScanner } from '../core/timezone';
import { biometricUnlockPin, clearBiometricRecord, isBiometricEnabled, refreshBiometricUi } from './biometric';
import { migrateLookupSecretIfNeeded } from './lookup-config';
import { requestPinBeforeConfig } from './pin';
import { clearRememberedSession, showLoginModalWithPrefill } from './session';
import { deriveLookupSecretKey, forgetStoredLookupSecretKey, hashPin, rememberLookupSecretKey, verifyStoredPin } from '../services/crypto';
import { drawerAction } from '../ui/page-nav';
import { reannounceOrShowToast, releaseHeldToasts, showToast } from '../ui/toast';

export const APP_LOCK_MAX_FAILS = 5;

export const APP_LOCK_LOCKOUT_MS = 60000;

export const APP_LOCK_EXCUSE_WINDOW_MS = 60000;

export const APP_LOCK_EXCUSE_SELECTOR = 'a[href^="tel:"], a[href^="mailto:"], a[download], a[target="_blank"], input[type="file"]';

export function appLockPinIsSet() {
    try {
        return !!appLocalStore.getItem('zoew_security_pin_hash');
    } catch (e) {
        return false;
    }
}

export function appLockPrefIsOff() {
    return safeStoreGet(appLocalStore, APP_LOCK_PREF_KEY) === '0';
}

export function appLockIsEnabled() {
    return appLockPinIsSet() && !appLockPrefIsOff();
}

export function setAppLockPref(enabled) {
    return enabled
        ? safeStoreRemove(appLocalStore, APP_LOCK_PREF_KEY)
        : safeStoreSet(appLocalStore, APP_LOCK_PREF_KEY, '0');
}

export function appLockUnlockedThisSession() {
    try {
        return appSessionStore.getItem(APP_LOCK_SESSION_KEY) === '1';
    } catch (e) {
        return false;
    }
}

export function markAppUnlockedForSession() {
    safeStoreSet(appSessionStore, APP_LOCK_SESSION_KEY, '1');
}

export function clearAppUnlockedForSession() {
    safeStoreRemove(appSessionStore, APP_LOCK_SESSION_KEY);
    forgetStoredLookupSecretKey();
}

export function appLockShouldArm() {
    return appLockIsEnabled() && !appLockUnlockedThisSession();
}

export function noteAppLockExcuse() {
    securityState.appLockExcuseAt = Date.now();
}

export function noteAppLockAway() {
    if (securityState.appLockAwayNoted) return;
    securityState.appLockAwayNoted = true;
    const excused = elapsedSince(securityState.appLockExcuseAt) < APP_LOCK_EXCUSE_WINDOW_MS;
    securityState.appLockExcuseAt = 0;
    if (securityState.appIsLocked || excused || !appLockIsEnabled()) return;
    securityState.appLockVeiled = true;
    showAppLockScreen(true);
}

export function relockAppAfterAway() {
    securityState.appLockAwayNoted = false;
    if (!securityState.appLockVeiled) return;
    securityState.appLockVeiled = false;
    showAppLockScreen();
    if (isBiometricEnabled()) runAppLockBiometric(true);
}

export function setAppLockMsg(text) {
    viewState.appLockMessage = text || '';
}

export function setAppLockBusy(busy) {
    securityState.appLockBusy = !!busy;
}

export function refreshAppLockUi() {
    viewState.appLockToggleText = !appLockPinIsSet() ? 'ត្រូវកំណត់ PIN' : (appLockIsEnabled() ? 'បើក' : 'បិទ');
    viewState.appLockToggleOn = appLockIsEnabled();
    viewState.appLockBiometricVisible = isBiometricEnabled();
}

export function showAppLockScreen(keepSessionFlag?) {
    securityState.appIsLocked = true;
    if (keepSessionFlag !== true) clearAppUnlockedForSession();
    viewState.appLockOpen = true;
    setAppLockMsg('');
    setAppLockBusy(false);
    refreshAppLockUi();
    setFieldValue('appLockPinInput', '');
    if (!isFieldFocused('appLockPinInput')) {
        try { blurActiveElement(); } catch (e) { setAppLockMsg(''); }
    }
    try { focusField('appLockPinInput'); } catch (e) { setAppLockMsg(''); }
}

export function hideAppLockScreen() {
    securityState.appIsLocked = false;
    securityState.appLockVeiled = false;
    viewState.appLockOpen = false;
    setFieldValue('appLockPinInput', '');
    setAppLockMsg('');
    setAppLockBusy(false);
    releaseHeldToasts();
}

export function appLockLockoutSecondsLeft() {
    const until = parseInt(safeStoreGet(appLocalStore, 'zoew_pin_lockout_until') || '0');
    if (!until || Date.now() >= until) return 0;
    return Math.ceil((until - Date.now()) / 1000);
}

export function registerAppLockFailure() {
    const fails = (parseInt(safeStoreGet(appLocalStore, 'zoew_pin_fail_count') || '0') || 0) + 1;
    if (fails >= APP_LOCK_MAX_FAILS) {
        safeStoreSet(appLocalStore, 'zoew_pin_lockout_until', String(Date.now() + APP_LOCK_LOCKOUT_MS));
        safeStoreSet(appLocalStore, 'zoew_pin_fail_count', '0');
        return 0;
    }
    safeStoreSet(appLocalStore, 'zoew_pin_fail_count', String(fails));
    return APP_LOCK_MAX_FAILS - fails;
}

export async function completeAppUnlock(pin) {
    const savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
    if (savedPin && !savedPin.startsWith('pbkdf2:')) {
        safeStoreSet(appLocalStore, 'zoew_security_pin_hash', await hashPin(pin));
    }
    securityState.lookupSecretKey = await deriveLookupSecretKey(pin);
    await rememberLookupSecretKey(securityState.lookupSecretKey);
    await migrateLookupSecretIfNeeded();
    safeStoreRemove(appLocalStore, 'zoew_pin_fail_count');
    safeStoreRemove(appLocalStore, 'zoew_pin_lockout_until');
    markAppUnlockedForSession();
    hideAppLockScreen();
    safeFocusScanner();
}

export async function verifyAppLockPin() {
    if (securityState.appLockBusy) return false;
    const entered = fieldValue('appLockPinInput').trim();
    setFieldValue('appLockPinInput', '');
    const waitLeft = appLockLockoutSecondsLeft();
    if (waitLeft > 0) {
        setAppLockMsg('បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ' + waitLeft + ' វិនាទី។');
        return false;
    }
    if (!entered) {
        setAppLockMsg('សូមវាយលេខកូដ PIN');
        return false;
    }
    setAppLockBusy(true);
    try {
        const savedPin = appLocalStore.getItem('zoew_security_pin_hash');
        if (savedPin && (await verifyStoredPin(entered, savedPin))) {
            await completeAppUnlock(entered);
            return true;
        }
        const left = registerAppLockFailure();
        setAppLockMsg(left > 0
            ? 'លេខ PIN មិនត្រឹមត្រូវទេ! សល់ ' + left + ' ដងទៀត។'
            : 'បញ្ចូល PIN ខុសច្រើនដងពេក! ត្រូវរង់ចាំ ១ នាទី។');
        return false;
    } catch (e) {
        setAppLockMsg('ផ្ទៀងផ្ទាត់ PIN មិនបានទេ! សូមប្រើ HTTPS រួចសាកល្បងម្តងទៀត។');
        return false;
    } finally {
        setAppLockBusy(false);
    }
}

export function submitAppLockForm(event?) {
    if (event) event.preventDefault();
    verifyAppLockPin();
}

export async function runAppLockBiometric(silent?) {
    if (securityState.appLockBusy || securityState.biometricUnlockInFlight) return false;
    if (!isBiometricEnabled()) return false;
    const waitLeft = appLockLockoutSecondsLeft();
    if (waitLeft > 0) {
        setAppLockMsg('បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ' + waitLeft + ' វិនាទី។');
        return false;
    }
    securityState.biometricUnlockInFlight = true;
    setAppLockBusy(true);
    try {
        const pin = await biometricUnlockPin();
        if (!pin) {
            if (silent !== true) setAppLockMsg('ស្កេនមិនបានទេ — សូមវាយលេខកូដ PIN ជំនួស។');
            return false;
        }
        const savedPin = appLocalStore.getItem('zoew_security_pin_hash');
        if (!savedPin || !(await verifyStoredPin(pin, savedPin))) {
            clearBiometricRecord();
            refreshBiometricUi();
            refreshAppLockUi();
            setAppLockMsg('ការចងក្រយៅដៃ/មុខលែងត្រូវនឹង PIN បច្ចុប្បន្នទេ! សូមវាយ PIN ជំនួស។');
            return false;
        }
        await completeAppUnlock(pin);
        return true;
    } catch (e) {
        if (silent !== true) setAppLockMsg('ស្កេនមិនបានទេ — សូមវាយលេខកូដ PIN ជំនួស។');
        return false;
    } finally {
        securityState.biometricUnlockInFlight = false;
        setAppLockBusy(false);
    }
}

export function forgetAppLockPin() {
    if (!confirm('លុប Security PIN នៃឧបករណ៍នេះ រួចចាកចេញពីប្រព័ន្ធ?\n\n· ទិន្នន័យអាជីវកម្មមិនរងផលទេ\n· អ្នកនឹងត្រូវចូលប្រព័ន្ធដោយអ៊ីមែល និងពាក្យសម្ងាត់ម្តងទៀត\n· ការតភ្ជាប់ដែលអ៊ិនគ្រីបដោយ PIN ចាស់ ត្រូវកំណត់ថ្មី')) return;
    if (!safeStoreRemove(appLocalStore, 'zoew_security_pin_hash')) {
        showToast('❌ លុប Security PIN មិនបានទេ — PIN និងស្ថានភាពចូលប្រព័ន្ធនៅដដែល។');
        return;
    }
    safeStoreRemove(appLocalStore, 'zoew_pin_fail_count');
    safeStoreRemove(appLocalStore, 'zoew_pin_lockout_until');
    safeStoreRemove(appLocalStore, APP_LOCK_PREF_KEY);
    clearBiometricRecord();
    clearAppUnlockedForSession();
    clearRememberedSession(false);
    hideAppLockScreen();
    refreshBiometricUi();
    refreshAppLockUi();
    const finish = (signedOut) => {
        showLoginModalWithPrefill();
        reannounceOrShowToast(signedOut
            ? '⚠️ បានលុប PIN និងចាកចេញពីប្រព័ន្ធ — សូមចូលប្រព័ន្ធម្ដងទៀត'
            : '⚠️ បានលុប PIN ក្នុងឧបករណ៍ ប៉ុន្តែមិនអាចបញ្ជាក់ថាបានចាកចេញពីឧបករណ៍នេះទេ — សូម Refresh ហើយសាកចាកចេញម្តងទៀត');
    };
    if (firebaseState.auth) firebaseState.fb.signOut(firebaseState.auth).then(() => finish(true), () => finish(false));
    else finish(false);
}

export function drawerAppLockFlow() {
    drawerAction(function () {
        if (appLockIsEnabled()) {
            requestPinBeforeConfig(disableAppLockAfterPin, 'appLockOff');
            return;
        }
        requestPinBeforeConfig(armAppLockAfterPinSetup, 'appLock');
    });
}

export function armAppLockAfterPinSetup() {
    if (!setAppLockPref(true)) {
        showToast('❌ បើកការចាក់សោមិនបានទេ — ការកំណត់នៅដដែល។');
        return;
    }
    markAppUnlockedForSession();
    refreshAppLockUi();
    showToast('✅ បានបើកការចាក់សោ! លើកក្រោយបើក App ត្រូវវាយ PIN ឬស្កេនក្រយៅដៃ/មុខ។');
}

export function disableAppLockAfterPin() {
    if (!setAppLockPref(false)) {
        showToast('❌ បិទការចាក់សោមិនបានទេ — ការកំណត់នៅដដែល។');
        return;
    }
    markAppUnlockedForSession();
    refreshAppLockUi();
    showToast('✅ បានបិទការចាក់សោពេលបើក App។ Security PIN នៅដដែល។');
}

export function initAppLock() {
    refreshAppLockUi();
    setupAppLockAwayGuard();
    if (!appLockShouldArm()) {
        markAppUnlockedForSession();
        return;
    }
    showAppLockScreen();
    if (isBiometricEnabled()) runAppLockBiometric(true);
}
