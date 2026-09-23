import { fieldValue, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { securityState } from '../core/state';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { markAppUnlockedForSession, refreshAppLockUi } from './app-lock';
import { clearBiometricRecord, isBiometricEnabled, refreshBiometricUi, runBiometricUnlock } from './biometric';
import { openConfigModal } from './config';
import { migrateLookupSecretIfNeeded } from './lookup-config';
import { scheduleZtoStatusSweep } from './zto-status';
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
    securityState.pinTargetAction = targetAction || openConfigModal;
    applyPinPromptText(promptKey);
    let savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
    if (!savedPin) {
        openModalHelper('pinSetupModal');
    } else {
        setFieldValue('securityPinInput', '');
        openModalHelper('pinModal');
        refreshBiometricUi();
        if (isBiometricEnabled()) runBiometricUnlock();
    }
}

export async function saveNewSecurityPin() {
    let pinVal = fieldValue('newSecurityPinInput').trim();
    if (!pinVal) {
        alert("សូមបញ្ចូលលេខ PIN ឱ្យបានត្រឹមត្រូវ!");
        return;
    }
    if (pinVal.length < 6) {
        alert("Security PIN ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ ដើម្បីសុវត្ថិភាព!");
        return;
    }
    try {
        appLocalStore.setItem('zoew_security_pin_hash', await hashPin(pinVal));
        securityState.lookupSecretKey = await deriveLookupSecretKey(pinVal);
    await rememberLookupSecretKey(securityState.lookupSecretKey);
        await migrateLookupSecretIfNeeded();
    } catch (e) {
        alert("មិនអាចកំណត់ PIN បានទេ! សូមប្រើ HTTPS ហើយសាកល្បងម្តងទៀត។");
        return;
    } finally {
        setFieldValue('newSecurityPinInput', '');
    }
    closeModal('pinSetupModal');
    clearBiometricRecord();
    refreshBiometricUi();
    markAppUnlockedForSession();
    refreshAppLockUi();
    showToast("✅ បានកំណត់ Security PIN រួចរាល់!");
    (securityState.pinTargetAction || openConfigModal)(pinVal);
}

export async function verifySecurityPin() {
    if (securityState.isVerifyingPin) return;

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
        if (savedPin && (await verifyStoredPin(enteredPin, savedPin))) {
            await completePinUnlock(enteredPin);
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
        alert("មិនអាចផ្ទៀងផ្ទាត់ PIN បានទេ! សូមប្រើ HTTPS ហើយសាកល្បងម្តងទៀត។");
    } finally {
        securityState.isVerifyingPin = false;
    }
}

export async function completePinUnlock(pin) {
    const savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
    if (savedPin && !savedPin.startsWith('pbkdf2:')) {
        safeStoreSet(appLocalStore, 'zoew_security_pin_hash', await hashPin(pin));
    }
    safeStoreRemove(appLocalStore, 'zoew_pin_fail_count');
    safeStoreRemove(appLocalStore, 'zoew_pin_lockout_until');
    securityState.lookupSecretKey = await deriveLookupSecretKey(pin);
    await rememberLookupSecretKey(securityState.lookupSecretKey);
    await migrateLookupSecretIfNeeded();
    closeModal('pinModal');
    scheduleZtoStatusSweep();
    (securityState.pinTargetAction || openConfigModal)(pin);
}
