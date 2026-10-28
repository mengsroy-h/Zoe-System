import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { securityState } from '../core/state';
import { modalIsOpen } from '../core/modals';
import { isMobileDevice } from '../core/timezone';
import { appLocalStore, safeStoreGet, safeStoreRemove } from '../core/storage';
import { markAppUnlockedForSession, refreshAppLockUi } from './app-lock';
import { clearBiometricRecord, isBiometricEnabled, refreshBiometricUi, runBiometricUnlock } from './biometric';
import { openConfigModal } from './config';
import { scheduleZtoStatusSweep } from './zto-status';
import { refreshZtoPalmSession } from './zto-palm-login';
import { deriveLookupSecretKey, hashPin, rememberLookupSecretKey, verifyStoredPin } from '../services/crypto';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export const PIN_PROMPT_MESSAGES = {
    config: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បី Config ឬ Reconfig',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការ Config ឬ Reconfig លើកក្រោយ'
    },
    lookupApi: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីកំណត់ API ស្វែងរកអតិថិជន',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការកំណត់ API ស្វែងរកអតិថិជន លើកក្រោយ'
    },
    lookupUnlock: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីដោះសោការស្វែងរកអតិថិជន',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ដោះសោការស្វែងរកអតិថិជន លើកក្រោយ'
    },
    ztoStatus: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីពិនិត្យស្ថានភាពកញ្ចប់នៅ ZTO',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពិនិត្យស្ថានភាពកញ្ចប់នៅ ZTO លើកក្រោយ'
    },
    ztoListSync: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីទាញបញ្ជីកញ្ចប់ពី ZTO',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការទាញបញ្ជីកញ្ចប់ពី ZTO លើកក្រោយ'
    },
    locker: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីកំណត់ទូ Locker',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការកំណត់ទូ Locker លើកក្រោយ'
    },
    manualAdjust: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីកែទឹកប្រាក់ ឬចំនួនកញ្ចប់',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការកែទឹកប្រាក់ ឬចំនួនកញ្ចប់ លើកក្រោយ'
    },
    resetPickup: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បី Reset ចំនួនអតិថិជន និងកញ្ចប់យករួច',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការ Reset ចំនួនអតិថិជន និងកញ្ចប់យករួច លើកក្រោយ'
    },
    discardPendingWrites: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីលុបការសរសេររង់ចាំដែលផ្ទៀងផ្ទាត់មិនបាន',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការលុបការសរសេររង់ចាំ លើកក្រោយ'
    },
    clearHistory: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីលុបទិន្នន័យទាំងអស់',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការលុបទិន្នន័យទាំងអស់ លើកក្រោយ'
    },
    appLock: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីបើកការចាក់សោពេលបើក App',
        setup: 'សូមកំណត់លេខកូដ PIN ដែលនឹងប្រើដោះសោ App រាល់ពេលបើក'
    },
    appLockOff: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីបិទការចាក់សោពេលបើក App',
        setup: 'សូមកំណត់លេខកូដ PIN សិន មុននឹងប្តូរការចាក់សោពេលបើក App'
    },
    sheetImport: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីនាំចូល Excel ទៅ Google Sheet',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការនាំចូល Excel ទៅ Google Sheet លើកក្រោយ'
    },
    setupLink: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីអនុវត្ត Setup Link ចូល Config',
        setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការអនុវត្ត Setup Link លើកក្រោយ'
    },
    biometric: {
        verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីបើកការចូលដោយក្រយៅដៃ ឬមុខ',
        setup: 'សូមកំណត់លេខកូដ PIN សិន មុននឹងបើកការចូលដោយក្រយៅដៃ ឬមុខ'
    }
};

export function applyPinPromptText(promptKey) {
    const texts = PIN_PROMPT_MESSAGES[promptKey] || PIN_PROMPT_MESSAGES.config;
    viewState.pinPromptVerifyText = texts.verify;
    viewState.pinPromptSetupText = texts.setup;
}

export function requestPinBeforeConfig(targetAction, promptKey) {
    securityState.pinFlowGeneration++;
    securityState.pinTargetAction = targetAction || openConfigModal;
    applyPinPromptText(promptKey);
    let savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
    if (!savedPin) {
        openModalHelper('pinSetupModal');
    } else {
        setFieldValue('securityPinInput', '');
        openModalHelper('pinModal');
        if (!isMobileDevice()) focusField('securityPinInput');
        refreshBiometricUi();
        if (isBiometricEnabled()) runBiometricUnlock();
    }
}

export function capturePinFlow(modalId = 'pinModal') {
    const generation = securityState.pinFlowGeneration;
    const action = securityState.pinTargetAction;
    return () => generation === securityState.pinFlowGeneration && action === securityState.pinTargetAction && modalIsOpen(modalId);
}

export async function saveNewSecurityPin() {
    if (securityState.isVerifyingPin) return;
    const isCurrent = capturePinFlow('pinSetupModal');
    if (!isCurrent() || safeStoreGet(appLocalStore, 'zoew_security_pin_hash')) return;
    let pinVal = fieldValue('newSecurityPinInput').trim();
    if (!pinVal) {
        alert("សូមបញ្ចូលលេខ PIN ឱ្យបានត្រឹមត្រូវ!");
        return;
    }
    if (pinVal.length < 6) {
        alert("Security PIN ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ ដើម្បីសុវត្ថិភាព!");
        return;
    }
    securityState.isVerifyingPin = true;
    try {
        const pinHash = await hashPin(pinVal);
        if (!isCurrent() || safeStoreGet(appLocalStore, 'zoew_security_pin_hash')) return;
        const key = await deriveLookupSecretKey(pinVal);
        if (!isCurrent() || safeStoreGet(appLocalStore, 'zoew_security_pin_hash')) return;
        appLocalStore.setItem('zoew_security_pin_hash', pinHash);
        securityState.lookupSecretKey = key;
        await rememberLookupSecretKey(key);
        if (!isCurrent() || safeStoreGet(appLocalStore, 'zoew_security_pin_hash') !== pinHash) return;
    } catch (e) {
        if (!isCurrent()) return;
        alert("មិនអាចកំណត់ PIN បានទេ! សូមប្រើ HTTPS ហើយសាកល្បងម្តងទៀត។");
        return;
    } finally {
        securityState.isVerifyingPin = false;
        if (isCurrent()) setFieldValue('newSecurityPinInput', '');
    }
    closeModal('pinSetupModal');
    clearBiometricRecord();
    refreshBiometricUi();
    markAppUnlockedForSession();
    refreshAppLockUi();
    showToast("✅ បានកំណត់ Security PIN រួចរាល់!");
    (securityState.pinTargetAction || openConfigModal)(pinVal);
}

export function submitSecurityPinForm(event?) {
    if (event) event.preventDefault();
    verifySecurityPin();
}

export async function verifySecurityPin() {
    if (securityState.isVerifyingPin) return;
    const isCurrent = capturePinFlow();
    if (!isCurrent()) return;

    let enteredPin = fieldValue('securityPinInput').trim();
    setFieldValue('securityPinInput', '');
    let savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');

    const lockoutUntil = parseInt(safeStoreGet(appLocalStore, 'zoew_pin_lockout_until') || '0');
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
        alert(`បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ${secondsLeft} វិនាទី មុននឹងសាកល្បងម្តងទៀត។`);
        return;
    }

    securityState.isVerifyingPin = true;
    try {
        const verified = savedPin && (await verifyStoredPin(enteredPin, savedPin));
        if (!isCurrent() || safeStoreGet(appLocalStore, 'zoew_security_pin_hash') !== savedPin) return;
        if (verified) {
            await completePinUnlock(enteredPin, isCurrent, savedPin);
        } else {
            let failCount = (parseInt(appLocalStore.getItem('zoew_pin_fail_count') || '0') || 0) + 1;
            if (failCount >= 5) {
                appLocalStore.setItem('zoew_pin_lockout_until', (Date.now() + 60000).toString());
                appLocalStore.setItem('zoew_pin_fail_count', '0');
                alert("បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ១ នាទី មុននឹងសាកល្បងម្តងទៀត។");
            } else {
                appLocalStore.setItem('zoew_pin_fail_count', failCount.toString());
                alert("លេខ PIN មិនត្រឹមត្រូវទេ!");
            }
        }
    } catch (e) {
        if (!isCurrent()) return;
        alert("មិនអាចផ្ទៀងផ្ទាត់ PIN បានទេ! សូមប្រើ HTTPS ហើយសាកល្បងម្តងទៀត។");
    } finally {
        securityState.isVerifyingPin = false;
    }
}

export async function completePinUnlock(pin, isCurrent = capturePinFlow(), savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash')) {
    if (!isCurrent() || safeStoreGet(appLocalStore, 'zoew_security_pin_hash') !== savedPin) return false;
    const key = await deriveLookupSecretKey(pin);
    if (!isCurrent() || safeStoreGet(appLocalStore, 'zoew_security_pin_hash') !== savedPin) return false;
    securityState.lookupSecretKey = key;
    await rememberLookupSecretKey(key);
    if (!isCurrent() || safeStoreGet(appLocalStore, 'zoew_security_pin_hash') !== savedPin) return false;
    safeStoreRemove(appLocalStore, 'zoew_pin_fail_count');
    safeStoreRemove(appLocalStore, 'zoew_pin_lockout_until');
    closeModal('pinModal');
    scheduleZtoStatusSweep();
    refreshZtoPalmSession();
    (securityState.pinTargetAction || openConfigModal)(pin);
    return true;
}
