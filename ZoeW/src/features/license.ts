import { byId } from '../core/dom';
import { firebaseState, uiState } from '../core/state';
import { safeFocusScanner } from '../core/timezone';
import { resumeInterruptedCleanups } from '../domain/cleanup';
import { updateAuthButton } from './auth';
import { prefetchCustomerDataTableRowsIfConfigured } from './customer-table';
import { captureAuthDatabaseGuard } from './exchange-rate';
import { armSessionExpiryCheck } from './session';
import { initDatabaseListeners } from '../services/db-listeners';
import { withTimeout } from '../services/network';
import { closeModal, openModalHelper } from '../ui/modal';
import { showLiveToast, showToast } from '../ui/toast';

export const LICENSE_APP_CODE = 'ZOE';

export const LICENSE_RECHECK_INTERVAL_MS = 15 * 60 * 1000;

export function licenseFailureMessage(reason) {
    switch (reason) {
        case 'app-mismatch': return 'Key នេះមិនមែនសម្រាប់ ZoeW ទេ!';
        case 'expired':
        case 'expired-server': return 'Key នេះបានផុតកំណត់ហើយ!';
        case 'revoked': return 'Key នេះត្រូវបានដកហូតសិទ្ធិ (Revoked)!';
        case 'not-found': return 'Key នេះមិនមានក្នុងប្រព័ន្ធទេ!';
        case 'seat-taken': return 'Key នេះប្រើគ្រប់ចំនួនឧបករណ៍ដែលអនុញ្ញាតហើយ! សូមទាក់ទងអ្នកលក់ ដើម្បីបន្ថែមចំនួនឧបករណ៍ ឬដោះឧបករណ៍ចាស់ចេញ។';
        case 'device-unverified': return 'សម្គាល់ឧបករណ៍នេះមិនបានទេ! សូមបើក Storage (Cookie) របស់ Browser រួចសាកម្តងទៀត។';
        case 'seat-unavailable': return 'ប្រព័ន្ធអាជ្ញាប័ណ្ណមិនទាន់រៀបចំរួចទេ! សូមប្រាប់អ្នកលក់ឲ្យ Publish Firebase Rules ថ្មី។';
        case 'signature': return 'Key មិនត្រឹមត្រូវទេ (Signature Invalid)!';
        case 'network':
        case 'not-configured':
        case 'clock-unverified': return 'ភ្ជាប់ Server មិនបានទេ! សូមបើកអ៊ីនធឺណិត រួចសាកម្តងទៀត។';
        case 'verify-unavailable': return 'ផ្ទៀងផ្ទាត់ Key មិនបានទេ! សូមបិទបើក App ម្តងទៀត។';
        default: return 'Key មិនត្រឹមត្រូវទេ! សូមពិនិត្យម្តងទៀត។';
    }
}

export async function ensureAppActivated() {
    const sessionIsCurrent = captureAuthDatabaseGuard();
    const status = await ZoeLicense.getStatus(LICENSE_APP_CODE);
    if (!sessionIsCurrent()) return false;
    if (status.state === 'active') {
        closeModal('activationModal');
        return true;
    }
    const msgEl = byId('activationModalMsg');
    if (msgEl) {
        msgEl.textContent = (status.state === 'offline-grace-exceeded')
            ? 'Key នេះនៅមានសុពលភាព ប៉ុន្តែត្រូវការភ្ជាប់អ៊ីនធឺណិតម្តងទៀត ដើម្បីផ្ទៀងផ្ទាត់។'
            : (status.reason ? licenseFailureMessage(status.reason) : 'សូមបញ្ចូល Activation Key សម្រាប់ ZoeW ដើម្បីបន្ត។');
    }
    openModalHelper('activationModal');
    const keyInput = byId('activationKeyInput');
    if (keyInput) keyInput.focus();
    return false;
}

export function runPeriodicLicenseCheck() {
    if (firebaseState.licenseRecheckInFlight || !firebaseState.auth || !firebaseState.auth.currentUser || !firebaseState.isDatabaseInitialized || uiState.isModalOpen) return Promise.resolve(false);
    firebaseState.licenseRecheckInFlight = true;
    return withTimeout(ensureAppActivated(), 20000, 'Periodic activation check timed out').then((result) => result, (error) => {
        if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'periodic ensureAppActivated' });
        return false;
    }).finally(() => {
        firebaseState.licenseRecheckInFlight = false;
    });
}

export async function submitActivationKey() {
    const btn = byId('activationSubmitBtn');
    if (btn && btn.disabled) return;
    const sessionIsCurrent = captureAuthDatabaseGuard();
    const originalBtnText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'កំពុងផ្ទៀងផ្ទាត់...'; }
    try {
        const input = byId('activationKeyInput');
        const keyStr = input ? input.value.trim() : '';
        if (!keyStr) { showToast('⚠️ សូមបញ្ចូល Activation Key!'); return; }
        const result = await withTimeout(ZoeLicense.activate(keyStr, LICENSE_APP_CODE), 30000, 'Activation timed out');
        if (!sessionIsCurrent()) return;
        if (!result.valid) {
            if (input) input.value = '';
            showToast(licenseFailureMessage(result.reason));
            return;
        }
        if (input) input.value = '';
        const activated = await withTimeout(ensureAppActivated(), 20000, 'Activation timed out');
        if (!sessionIsCurrent()) return;
        if (activated) {
            showToast("✅ Active ជោគជ័យ!");
            updateAuthButton(true);
            if (!firebaseState.isDatabaseInitialized && !initDatabaseListeners()) {
                showToast('⚠️ មិនអាចភ្ជាប់ទិន្នន័យបានទេ! សូម Refresh ទំព័រ។');
            }
            armSessionExpiryCheck(firebaseState.auth && firebaseState.auth.currentUser, firebaseState.authGeneration);
            safeFocusScanner();
        } else {
            showToast("⚠️ Key ត្រូវបានផ្ទៀងផ្ទាត់ក្នុងគ្រឿង ប៉ុន្តែប្រព័ន្ធច្រានចោល — សូមមើលសារនៅក្នុងប្រអប់ខាងលើ");
        }
    } catch (e) {
        if (!sessionIsCurrent()) return;
        console.error('submitActivationKey failed:', e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'submitActivationKey' });
        showToast('❌ កំហុសមិនរំពឹងទុក: ' + (e && e.message ? e.message : String(e)));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = originalBtnText; }
    }
}

export async function proceedAfterLogin(user, myAuthGeneration) {
    let activated;
    try {
        activated = await withTimeout(ensureAppActivated(), 20000, 'Activation check timed out');
    } catch (e) {
        if (myAuthGeneration !== firebaseState.authGeneration) return;
        console.error("Activation check failed:", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Activation check after login" });
        showToast("⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិប្រើប្រាស់បានទេ! សូមសាកល្បងចូលម្តងទៀត។");
        return;
    }
    if (myAuthGeneration !== firebaseState.authGeneration) return;
    if (!activated) {
        closeModal('loginModal');
        return;
    }

    closeModal('loginModal');
    const wasAlreadySignedIn = firebaseState.isDatabaseInitialized;
    updateAuthButton(true);

    armSessionExpiryCheck(user, myAuthGeneration);

    if (!firebaseState.isDatabaseInitialized && !initDatabaseListeners()) {
        showToast('⚠️ មិនអាចភ្ជាប់ទិន្នន័យបានទេ! សូម Refresh ទំព័រ។');
    }
    if (!wasAlreadySignedIn) showLiveToast('signin');
    resumeInterruptedCleanups();
    prefetchCustomerDataTableRowsIfConfigured();
    safeFocusScanner();
}
