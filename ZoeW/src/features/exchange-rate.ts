import { byId } from '../core/dom';
import { dataState, firebaseState } from '../core/state';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { armLateWrite, dbOp, dbOpStalled } from '../services/network';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export function openExchangeRateModal() {
    const rateInput = byId('exchangeRateInput');
    if(rateInput) rateInput.value = dataState.exchangeRateRiel;
    openModalHelper('exchangeRateModal');
}

export function captureAuthDatabaseGuard() {
    const generation = firebaseState.authGeneration;
    const database = firebaseState.db;
    const sessionAuth = firebaseState.auth;
    const user = firebaseState.auth && firebaseState.auth.currentUser;
    return () => generation === firebaseState.authGeneration && database === firebaseState.db && sessionAuth === firebaseState.auth && user === (firebaseState.auth && firebaseState.auth.currentUser);
}

export async function saveExchangeRate() {
    if (dataState.exchangeRateSaveInFlight) return 'pending';
    const sessionIsCurrent = captureAuthDatabaseGuard();
    const rateInput = byId('exchangeRateInput');
    let val = rateInput ? (parseFloat(rateInput.value) || 4100) : 4100;
    if (val <= 0) val = 4100;

    const previousRate = dataState.exchangeRateRiel;
    const restorePreviousRate = () => {
        if (!sessionIsCurrent()) return;
        dataState.exchangeRateRiel = previousRate;
        safeStoreSet(appLocalStore, 'zoew_exchange_rate', previousRate);
        refreshCurrentHistoryView();
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
    let exchangeRateWrite = null;
    let lateArmed = false;
    try {
        exchangeRateWrite = firebaseState.fb.set(firebaseState.dbRefExchangeRate, val);
        await dbOp(exchangeRateWrite);
        if (sessionIsCurrent()) showToast(`✅ បានរក្សាទុកអត្រាប្រាក់ 1$ = ${val.toLocaleString()} ៛ ទៅ Firebase រួចរាល់!`);
        return 'done';
    } catch (error) {
        if (exchangeRateWrite && dbOpStalled(error)) {
            lateArmed = armLateWrite(exchangeRateWrite, () => {
                dataState.exchangeRateSaveInFlight = false;
                if (!sessionIsCurrent()) return;
                showToast(`✅ បណ្តាញត្រឡប់មកវិញ — អត្រាប្រាក់ 1$ = ${val.toLocaleString()} ៛ បានរក្សាទុកទៅ Firebase រួចរាល់!`);
            }, () => {
                dataState.exchangeRateSaveInFlight = false;
                if (!sessionIsCurrent()) return;
                restorePreviousRate();
                showToast('⚠️ អត្រាប្រាក់មិនបានរក្សាទុកទៅ Firebase ទេ — បានត្រឡប់ទៅអត្រាមុនវិញ។');
            }, 'saveExchangeRate');
            if (lateArmed) {
                if (sessionIsCurrent()) showToast('⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរង់ចាំរក្សាទុកអត្រាប្រាក់។ សូមកុំកែម្ដងទៀត។');
                return 'pending';
            }
        }
        restorePreviousRate();
        if (sessionIsCurrent()) showToast('⚠️ អត្រាប្រាក់មិនបានរក្សាទុកទៅ Firebase ទេ — បានត្រឡប់ទៅអត្រាមុនវិញ។');
        return 'failed';
    } finally {
        if (!lateArmed) dataState.exchangeRateSaveInFlight = false;
    }
}
