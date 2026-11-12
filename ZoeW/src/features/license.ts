import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { openModalIds } from '../core/modals';
import { viewState } from '../core/view-state';
import { firebaseState, uiState } from '../core/state';
import { safeFocusScanner } from '../core/timezone';
import { resumeInterruptedCleanups } from '../domain/cleanup';
import { updateAuthButton } from './auth';
import { prefetchCustomerDataTableRowsIfConfigured } from './customer-table';
import { captureAuthDatabaseGuard } from './exchange-rate';
import { refreshShopBoundUi } from './lookup-config';
import { armSessionExpiryCheck } from './session';
import { dbListenersBelongToSession, initDatabaseListeners } from '../services/db-listeners';
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
        case 'seat-released': return 'ឧបករណ៍នេះត្រូវបានដោះចេញពី Key ដោយអ្នកលក់! សូមទាក់ទងអ្នកលក់ ប្រសិនបើត្រូវប្រើឧបករណ៍នេះតទៅ។';
        case 'device-unverified': return 'ផ្ទៀងផ្ទាត់កូនសោឧបករណ៍មិនបានទេ! សូមអនុញ្ញាត Storage របស់ Browser ហើយប្រើ «ចុះឈ្មោះឧបករណ៍» ដើម្បីផ្ទៀងផ្ទាត់ជាមួយអ្នកលក់។ កុំលុបទិន្នន័យ App។';
        case 'seat-unavailable': return 'ប្រព័ន្ធអាជ្ញាប័ណ្ណមិនទាន់រៀបចំរួចទេ! សូមទាក់ទងអ្នកលក់ឱ្យពិនិត្យ Server, Public Key និង Firebase Rules។';
        case 'signature': return 'Key មិនត្រឹមត្រូវទេ (Signature Invalid)!';
        case 'network':
        case 'not-configured':
        case 'clock-unverified': return 'ភ្ជាប់ Server មិនបានទេ! សូមបើកអ៊ីនធឺណិត រួចសាកម្តងទៀត។';
        case 'verify-unavailable': return 'ផ្ទៀងផ្ទាត់ Key មិនបានទេ! សូមបិទបើក App ម្តងទៀត។';
        default: return 'Key មិនត្រឹមត្រូវទេ! សូមពិនិត្យម្តងទៀត។';
    }
}

let pendingActivation = null;
let activationRecoveryInFlight = null;

export async function ensureAppActivated() {
    if (viewState.backendKind === 'supabase') {
        pendingActivation = null;
        closeModal('activationModal');
        return true;
    }
    const sessionIsCurrent = captureAuthDatabaseGuard();
    const status = await ZoeLicense.getStatus(LICENSE_APP_CODE);
    if (!sessionIsCurrent()) return false;
    pendingActivation = status.reason === 'clock-unverified' ? { isCurrent: sessionIsCurrent, user: firebaseState.auth && firebaseState.auth.currentUser, generation: firebaseState.authGeneration } : null;
    if (status.state === 'active') {
        closeModal('activationModal');
        return true;
    }
    clearSeatEnrollment();
    viewState.seatEnrollmentOnly = false;
    viewState.activationMessage = (status.state === 'offline-grace-exceeded' && !status.reason)
        ? 'Key នេះនៅមានសុពលភាព ប៉ុន្តែត្រូវការភ្ជាប់អ៊ីនធឺណិតម្តងទៀត ដើម្បីផ្ទៀងផ្ទាត់។'
        : (status.reason ? licenseFailureMessage(status.reason) : 'សូមបញ្ចូល Activation Key សម្រាប់ ZoeW ដើម្បីបន្ត។');
    openModalHelper('activationModal');
    focusField('activationKeyInput');
    return false;
}

export function retryPendingActivation() {
    const pending = pendingActivation;
    if (!pending) return Promise.resolve(false);
    if (!pending.isCurrent()) {
        pendingActivation = null;
        return Promise.resolve(false);
    }
    if (!pending.user || viewState.activationBusy || openModalIds().some((id) => id !== 'activationModal' && id !== 'loginModal')) return Promise.resolve(false);
    if (activationRecoveryInFlight && activationRecoveryInFlight.isCurrent()) return activationRecoveryInFlight.result;
    if (activationRetry.timer) { clearTimeout(activationRetry.timer); activationRetry.timer = null; }
    const recovery = proceedAfterLogin(pending.user, pending.generation).finally(() => {
        if (activationRecoveryInFlight && activationRecoveryInFlight.result === recovery) activationRecoveryInFlight = null;
    });
    activationRecoveryInFlight = { isCurrent: pending.isCurrent, result: recovery };
    return recovery;
}

export function runPeriodicLicenseCheck() {
    if (pendingActivation) return retryPendingActivation();
    if (firebaseState.licenseRecheckInFlight || !firebaseState.auth || !firebaseState.auth.currentUser || !firebaseState.isDatabaseInitialized || uiState.isModalOpen) return Promise.resolve(false);
    firebaseState.licenseRecheckInFlight = true;
    return withTimeout(ensureAppActivated(), 20000, 'Periodic activation check timed out').then((result) => result, (error) => {
        if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'periodic ensureAppActivated' });
        return false;
    }).finally(() => {
        firebaseState.licenseRecheckInFlight = false;
    });
}

let seatEnrollmentOperation = null;

export function clearSeatEnrollment() {
    seatEnrollmentOperation = null;
    viewState.seatEnrollmentEpoch++;
    viewState.seatEnrollmentBusy = false;
    viewState.seatEnrollmentJson = '';
    viewState.seatEnrollmentFingerprint = '';
    viewState.seatEnrollmentMessage = '';
}

export function openSeatEnrollment() {
    if (viewState.backendKind !== 'firebase' || !firebaseState.auth?.currentUser || !firebaseState.isDatabaseInitialized || openModalIds().includes('activationModal')) return;
    clearSeatEnrollment();
    viewState.seatEnrollmentOnly = true;
    viewState.activationMessage = 'រៀបចំសំណើចុះឈ្មោះឧបករណ៍ រួចផ្ញើឱ្យអ្នកលក់ផ្ទៀងផ្ទាត់។';
    uiState.drawerOpen = false;
    setFieldValue('activationKeyInput', '');
    openModalHelper('activationModal');
}

export function closeSeatEnrollment() {
    if (!viewState.seatEnrollmentOnly) return;
    clearSeatEnrollment();
    viewState.seatEnrollmentOnly = false;
    closeModal('activationModal');
}

function captureSeatEnrollmentScope(requireOpen: boolean) {
    const sessionIsCurrent = captureAuthDatabaseGuard();
    const epoch = viewState.seatEnrollmentEpoch;
    const input = fieldValue('activationKeyInput').trim();
    const selectedKey = () => input || (typeof ZoeLicense?.activationKeyString === 'function' ? ZoeLicense.activationKeyString(LICENSE_APP_CODE) : '');
    const keyString = selectedKey();
    return {
        keyString,
        isCurrent: () => sessionIsCurrent() && viewState.backendKind === 'firebase' && viewState.seatEnrollmentEpoch === epoch && (!requireOpen || openModalIds().includes('activationModal')) && fieldValue('activationKeyInput').trim() === input && selectedKey() === keyString
    };
}

export async function prepareSeatEnrollment() {
    if (viewState.backendKind !== 'firebase' || !firebaseState.auth?.currentUser || viewState.activationBusy) return;
    if (seatEnrollmentOperation?.isCurrent()) return;
    clearSeatEnrollment();
    const operation = captureSeatEnrollmentScope(false);
    const { keyString } = operation;
    if (!keyString) { viewState.seatEnrollmentMessage = 'សូមបញ្ចូល Activation Key មុនចុះឈ្មោះឧបករណ៍។'; return; }
    seatEnrollmentOperation = operation;
    viewState.seatEnrollmentBusy = true;
    const current = () => seatEnrollmentOperation === operation && operation.isCurrent();
    try {
        if (typeof ZoeLicense?.createSeatEnrollment !== 'function') throw new Error('enrollment-unavailable');
        const result = await withTimeout(ZoeLicense.createSeatEnrollment(keyString, LICENSE_APP_CODE), 20000, 'Enrollment timed out');
        if (!current()) return;
        if (!result?.valid) {
            viewState.seatEnrollmentMessage = 'រៀបចំសំណើមិនបានទេ។ សូមផ្ទៀងផ្ទាត់ Key និង Storage រួចទាក់ទងអ្នកលក់។ បើកូនសោឧបករណ៍បាត់ ឬខូច ត្រូវឱ្យអ្នកលក់ដោះកៅអីចាស់ និងចុះឈ្មោះឡើងវិញ។';
            return;
        }
        const enrollment = result.enrollment;
        if (!enrollment || typeof enrollment.payload !== 'string' || typeof enrollment.signature !== 'string' || !/^[a-f0-9]{64}$/.test(enrollment.fingerprint)) throw new Error('enrollment-invalid');
        viewState.seatEnrollmentJson = JSON.stringify({ payload: enrollment.payload, signature: enrollment.signature, fingerprint: enrollment.fingerprint });
        viewState.seatEnrollmentFingerprint = enrollment.fingerprint;
        viewState.seatEnrollmentMessage = 'ផ្ញើសំណើខាងក្រោមឱ្យអ្នកលក់ ហើយប្រៀបធៀប fingerprint តាមទំនាក់ទំនងដែលអ្នកស្គាល់។ សំណើនេះមិនទាន់ផ្ដល់សិទ្ធិប្រើប្រាស់ទេ។';
    } catch (e) {
        if (!current()) return;
        viewState.seatEnrollmentMessage = 'រៀបចំសំណើមិនបានទេ។ សូមពិនិត្យ Storage ហើយទាក់ទងអ្នកលក់។ កុំលុបទិន្នន័យ App ឬប្រើលេខសម្គាល់សាធារណៈដើម្បីសង្គ្រោះកូនសោ។';
    } finally {
        if (seatEnrollmentOperation === operation) {
            viewState.seatEnrollmentBusy = false;
            seatEnrollmentOperation = null;
        }
    }
}

export async function repairSeatEnrollmentIdentity() {
    if (viewState.backendKind !== 'firebase' || !firebaseState.auth?.currentUser || viewState.activationBusy || viewState.seatEnrollmentBusy || !openModalIds().includes('activationModal')) return;
    clearSeatEnrollment();
    const operation = captureSeatEnrollmentScope(true);
    const { keyString } = operation;
    if (!keyString) { viewState.seatEnrollmentMessage = 'សូមបញ្ចូល Activation Key មុនជួសជុលកូនសោឧបករណ៍។'; return; }
    seatEnrollmentOperation = operation;
    const current = () => seatEnrollmentOperation === operation && operation.isCurrent();
    viewState.seatEnrollmentBusy = true;
    try {
        if (typeof ZoeLicense?.inspectSeatIdentity !== 'function' || typeof ZoeLicense?.repairSeatIdentity !== 'function') throw new Error('repair-unavailable');
        const inspection = await withTimeout(ZoeLicense.inspectSeatIdentity(keyString, LICENSE_APP_CODE), 20000, 'Identity inspection timed out');
        if (!current()) return;
        if (!inspection?.valid || !inspection.repairToken || typeof inspection.keyId !== 'string') throw new Error('repair-unverified');
        const approved = confirm('ជំនួសកូនសោដែលខូចសម្រាប់អាជ្ញាប័ណ្ណ ' + inspection.keyId + ' នៅលើឧបករណ៍នេះ?\nកូនសោថ្មីត្រូវចុះឈ្មោះឡើងវិញ និងទទួលការយល់ព្រមពីអ្នកលក់។ អ្នកលក់ត្រូវដោះកៅអីចាស់បើចាំបាច់។ ការជួសជុលនេះមិនផ្ដល់សិទ្ធិប្រើប្រាស់ទេ ហើយមិនប៉ះពាល់ទិន្នន័យអាជីវកម្មឡើយ។');
        if (!current() || !approved) return;
        const result = await withTimeout(ZoeLicense.repairSeatIdentity(inspection.repairToken, current), 20000, 'Identity repair timed out');
        if (!current()) return;
        if (!result?.valid) throw new Error('repair-refused');
        viewState.seatEnrollmentMessage = 'កូនសោឧបករណ៍ត្រូវបានជំនួស។ សូមចុច «ចុះឈ្មោះឧបករណ៍» ហើយផ្ញើសំណើថ្មីឱ្យអ្នកលក់អនុម័ត និងដោះកៅអីចាស់បើចាំបាច់។ មិនទាន់ផ្ដល់សិទ្ធិប្រើប្រាស់ទេ។';
    } catch (e) {
        if (current()) viewState.seatEnrollmentMessage = 'មិនអាចបញ្ជាក់លទ្ធផលជួសជុលកូនសោបានទេ។ សូមសាក «ចុះឈ្មោះឧបករណ៍» ដើម្បីពិនិត្យកូនសោបច្ចុប្បន្ន ហើយទាក់ទងអ្នកលក់។ កុំលុបទិន្នន័យ App។';
    } finally {
        if (seatEnrollmentOperation === operation) {
            viewState.seatEnrollmentBusy = false;
            seatEnrollmentOperation = null;
        }
    }
}

export async function submitActivationKey() {
    if (viewState.activationBusy || viewState.seatEnrollmentBusy) return;
    const sessionIsCurrent = captureAuthDatabaseGuard();
    viewState.activationBusy = true;
    try {
        const keyStr = fieldValue('activationKeyInput').trim();
        if (!keyStr) { showToast('⚠️ សូមបញ្ចូល Activation Key!'); return; }
        const result = await withTimeout(ZoeLicense.activate(keyStr, LICENSE_APP_CODE), 30000, 'Activation timed out');
        if (!sessionIsCurrent()) return;
        if (!result.valid) {
            setFieldValue('activationKeyInput', '');
            showToast(licenseFailureMessage(result.reason));
            return;
        }
        setFieldValue('activationKeyInput', '');
        const activated = await withTimeout(ensureAppActivated(), 20000, 'Activation timed out');
        if (!sessionIsCurrent()) return;
        if (activated) {
            showToast("✅ Active ជោគជ័យ!");
            updateAuthButton(true);
            if (!dbListenersBelongToSession() && !initDatabaseListeners()) {
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
        viewState.activationBusy = false;
    }
}

export const ACTIVATION_RETRY_STEPS_MS = [5000, 15000, 30000, 60000];

export const ACTIVATION_RETRY_TOAST = '⚠️ ផ្ទៀងផ្ទាត់សិទ្ធិប្រើប្រាស់មិនទាន់បាន (បណ្តាញយឺត ឬដាច់) — កំពុងសាកម្តងទៀតដោយស្វ័យប្រវត្តិ...';

export const ACTIVATION_GIVE_UP_TOAST = '⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិប្រើប្រាស់បានទេ! សូមពិនិត្យអ៊ីនធឺណិត រួចបិទបើក App ម្តងទៀត។';

let activationRetry = { generation: -1, attempt: 0, timer: null };

export function cancelActivationRetry() {
    if (activationRetry.timer) clearTimeout(activationRetry.timer);
    activationRetry = { generation: -1, attempt: 0, timer: null };
}

export function scheduleActivationRetry(user, myAuthGeneration) {
    const sessionIsCurrent = captureAuthDatabaseGuard();
    if (activationRetry.generation !== myAuthGeneration) cancelActivationRetry();
    const attempt = activationRetry.attempt;
    if (attempt >= ACTIVATION_RETRY_STEPS_MS.length) {
        cancelActivationRetry();
        showToast(ACTIVATION_GIVE_UP_TOAST);
        return false;
    }
    if (activationRetry.timer) clearTimeout(activationRetry.timer);
    activationRetry.generation = myAuthGeneration;
    activationRetry.attempt = attempt + 1;
    activationRetry.timer = setTimeout(() => {
        activationRetry.timer = null;
        if (!sessionIsCurrent() || myAuthGeneration !== firebaseState.authGeneration) return;
        if (!firebaseState.auth || firebaseState.auth.currentUser !== user) return;
        if (pendingActivation) void retryPendingActivation();
        else void proceedAfterLogin(user, myAuthGeneration);
    }, ACTIVATION_RETRY_STEPS_MS[attempt]);
    if (attempt === 0) showToast(ACTIVATION_RETRY_TOAST);
    return true;
}

export async function proceedAfterLogin(user, myAuthGeneration) {
    if (myAuthGeneration !== firebaseState.authGeneration || !firebaseState.auth || firebaseState.auth.currentUser !== user) return false;
    const sessionIsCurrent = captureAuthDatabaseGuard();
    refreshShopBoundUi();
    let activated;
    try {
        activated = await withTimeout(ensureAppActivated(), 20000, 'Activation check timed out');
    } catch (e) {
        if (!sessionIsCurrent()) return false;
        console.error("Activation check failed:", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Activation check after login" });
        scheduleActivationRetry(user, myAuthGeneration);
        return false;
    }
    if (!sessionIsCurrent()) return false;
    if (!activated) {
        closeModal('loginModal');
        if (pendingActivation && pendingActivation.isCurrent()) scheduleActivationRetry(user, myAuthGeneration);
        else cancelActivationRetry();
        return false;
    }
    cancelActivationRetry();

    closeModal('loginModal');
    const wasAlreadySignedIn = dbListenersBelongToSession();
    updateAuthButton(true);

    armSessionExpiryCheck(user, myAuthGeneration);

    if (!dbListenersBelongToSession() && !initDatabaseListeners()) {
        showToast('⚠️ មិនអាចភ្ជាប់ទិន្នន័យបានទេ! សូម Refresh ទំព័រ។');
    }
    if (!wasAlreadySignedIn) showLiveToast('signin');
    resumeInterruptedCleanups();
    prefetchCustomerDataTableRowsIfConfigured();
    safeFocusScanner();
    return true;
}
