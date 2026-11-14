import { fieldValue, setFieldValue } from '../app/refs';
import { dataState, firebaseState } from '../core/state';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { armLateWrite, dbOp, dbOpStalled } from '../services/network';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';
import { localAuthSessionCurrent, localLogoutIntent } from '../services/local-logout-intent';
import { loginBackendScope } from './login-memory';

export function openExchangeRateModal() {
    setFieldValue('exchangeRateInput', String(dataState.exchangeRateRiel));
    openModalHelper('exchangeRateModal');
}

export function captureAuthDatabaseGuard() {
    const generation = firebaseState.authGeneration;
    const database = firebaseState.db;
    const sessionAuth = firebaseState.auth;
    const user = firebaseState.auth && firebaseState.auth.currentUser;
    const scope = loginBackendScope();
    const logoutCurrent = user?.uid ? localLogoutIntent.witness(scope, user.uid) : () => true;
    return () => generation === firebaseState.authGeneration && database === firebaseState.db && sessionAuth === firebaseState.auth && user === (firebaseState.auth && firebaseState.auth.currentUser)
        && (!user || localAuthSessionCurrent(sessionAuth, scope, user)) && logoutCurrent();
}

export async function saveExchangeRate() {
    if (dataState.exchangeRateSaveInFlight) return 'pending';
    const sessionIsCurrent = captureAuthDatabaseGuard();
    let val = parseFloat(fieldValue('exchangeRateInput')) || 4100;
    if (val <= 0) val = 4100;

    const previousRate = dataState.exchangeRateRiel;
    const observedVersion = dataState.exchangeRateObservedVersion;
    const restorePreviousRate = () => {
        if (!sessionIsCurrent() || dataState.exchangeRateObservedVersion !== observedVersion) return;
        dataState.exchangeRateRiel = previousRate;
        safeStoreSet(appLocalStore, 'zoew_exchange_rate', previousRate);
        refreshCurrentHistoryView();
    };
    const reportUnknownRate = () => {
        if (sessionIsCurrent()) showToast('⏳ មិនទាន់ដឹងលទ្ធផលរក្សាទុកអត្រាប្រាក់ — រក្សាភស្តុតាង និងកុំកែម្ដងទៀតរហូតផ្ទៀងផ្ទាត់។');
    };
    if (!safeStoreSet(appLocalStore, 'zoew_exchange_rate', val)) {
        showToast('❌ មិនអាចរក្សាទុកអត្រាប្រាក់ក្នុងឧបករណ៍នេះបានទេ — គ្មានអ្វីត្រូវបានផ្លាស់ប្តូរ។');
        return 'failed';
    }
    dataState.exchangeRateRiel = val;
    closeModal('exchangeRateModal');
    refreshCurrentHistoryView();
    if (!firebaseState.dbRefExchangeRate || !firebaseState.db || !firebaseState.fb) {
        restorePreviousRate();
        showToast('⚠️ មិនទាន់ភ្ជាប់ Firebase ទេ — អត្រាប្រាក់មិនត្រូវបានផ្លាស់ប្តូរ។');
        return 'failed';
    }

    dataState.exchangeRateSaveInFlight = true;
    const operation = {};
    dataState.exchangeRateSaveOperation = operation;
    const releaseWrite = () => {
        if (dataState.exchangeRateSaveOperation !== operation) return;
        dataState.exchangeRateSaveOperation = null;
        dataState.exchangeRateSaveInFlight = false;
    };
    let exchangeRateWrite = null;
    let lateArmed = false;
    try {
        exchangeRateWrite = firebaseState.fb.set(firebaseState.dbRefExchangeRate, val);
        await dbOp(exchangeRateWrite);
        if (sessionIsCurrent()) showToast(`✅ បានរក្សាទុកអត្រាប្រាក់ 1$ = ${val.toLocaleString()} ៛ ទៅ Firebase រួចរាល់!`);
        return 'done';
    } catch (error) {
        if (error && error.txOutcome === 'unknown') {
            reportUnknownRate();
            return 'pending';
        }
        if (exchangeRateWrite && dbOpStalled(error)) {
            lateArmed = armLateWrite(exchangeRateWrite, () => {
                releaseWrite();
                if (!sessionIsCurrent()) return;
                showToast(`✅ បណ្តាញត្រឡប់មកវិញ — អត្រាប្រាក់ 1$ = ${val.toLocaleString()} ៛ បានរក្សាទុកទៅ Firebase រួចរាល់!`);
            }, (lateError) => {
                releaseWrite();
                if (!sessionIsCurrent()) return;
                if (lateError && lateError.txOutcome === 'unknown') {
                    reportUnknownRate();
                    return;
                }
                restorePreviousRate();
                showToast('⚠️ ការកែអត្រាប្រាក់នេះមិនបានរក្សាទុកទៅ Server ទេ។');
            }, 'saveExchangeRate');
            if (lateArmed) {
                if (sessionIsCurrent()) showToast('⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរង់ចាំរក្សាទុកអត្រាប្រាក់។ សូមកុំកែម្ដងទៀត។');
                return 'pending';
            }
        }
        restorePreviousRate();
        if (sessionIsCurrent()) showToast('⚠️ ការកែអត្រាប្រាក់នេះមិនបានរក្សាទុកទៅ Server ទេ។');
        return 'failed';
    } finally {
        if (!lateArmed) releaseWrite();
    }
}
