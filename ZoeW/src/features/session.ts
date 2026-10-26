import { resetHealthCheck } from './health-check';
import { blankElementById } from '../app/slot-resets';
import { MODAL_IDS } from '../core/modals';
import { setFieldChecked, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, firebaseState, lookupState, securityState, uiState, ztoState } from '../core/state';
import { getServerNow, pendingHistoryPatches, pendingRegistryReleases } from '../core/clock';
import { appLocalStore, safeStoreRemove, safeStoreSet } from '../core/storage';
import { ENTRY_SCAN_MODE_KEY } from '../core/storage-keys';
import { hasPendingInvite, routePendingInvite } from './account';
import { cancelPendingLookupUnlock, clearLookupStatus } from './auto-lookup';
import { isPinFlowPending } from './config';
import { forgetRememberedLogin, loginBackendScope, rememberedLoginFor } from './login-memory';
import { forgetLoginPassword, prefillRememberedPassword } from './password-memory';
import { closeConfigQrScanner } from './config-qr';
import { restoreAfterPdfExport } from './export';
import { resetBatchScan } from './batch-scan';
import { resetZtoPalmRefresh } from './zto-palm-login';
import { resetLabelPrint } from './label-print';
import { expandedTrashGroups } from './locker';
import { hidePhoneSuggestions } from './phone-suggest';
import { setPhoneSearchPulledUp } from '../app/behaviors/phone-search';
import { clearSheetImportSession } from './sheet-import';
import { ztoListSignedProbe } from './zto-list-sync';
import { resetZtoFinalMarks } from './zto-final-marks';
import { resetPushScheduleSession } from './push';
import { clearZtoPickupStatusStore } from './zto-status';
import { DB_OP_TIMEOUT_MS, withTimeout } from '../services/network';
import { resetScanConfirm } from '../services/scan-engine';
import { forgetSupabaseDocsCache } from '../services/supabase-docs-cache';
import { invalidateLookupKeyRestore } from '../services/crypto';
import { showAppChrome } from '../ui/chrome-autohide';
import { closeModal, openModalHelper } from '../ui/modal';
import { endPanelGlideSnapPause } from '../app/behaviors/panel-motion';
import { reannounceOrShowToast, refreshLiveToasts } from '../ui/toast';

export const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const ABANDON_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const RETURNED_TRASH_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const TRASH_WRITE_SLOW_NOTICE_MS = 15000;

export function clearRememberedSession(keepEmail) {
    safeStoreRemove(appLocalStore, 'zoew_login_time');
    if (!keepEmail) {
        forgetRememberedLogin();
        forgetLoginPassword();
    }
    clearZtoPickupStatusStore();
}

let loginPrefillScope = null;

export async function isFirebaseSessionExpired(user) {
    try {
        const tokenResult = await withTimeout(firebaseState.fb.getIdTokenResult(user), DB_OP_TIMEOUT_MS, 'Session check stalled');
        const authTimeMs = new Date(tokenResult.authTime).getTime();
        if (isNaN(authTimeMs)) return false;
        return (getServerNow() - authTimeMs) > FOUR_HOURS_MS;
    } catch (e) {
        return false;
    }
}

export const SESSION_EXPIRED_TOAST = '⏱️ ផុតកំណត់ ៤ ម៉ោងហើយ! សូមវាយពាក្យសម្ងាត់ និងចុចចូលប្រព័ន្ធម្ដងទៀត។';

export const SESSION_SIGNED_OUT_TOAST = '⚠️ បានចាកចេញពីប្រព័ន្ធ — សូមចូលប្រព័ន្ធម្ដងទៀត';

export function forceExpireSession() {
    const expiryGeneration = ++firebaseState.authGeneration;
    const expiryAuth = firebaseState.auth;
    const expiryFb = firebaseState.fb;
    const expiryScope = loginBackendScope();
    const expiredUser = expiryAuth && expiryAuth.currentUser;
    firebaseState.sessionExpiryCheck = 'expired';
    refreshLiveToasts();
    const finish = () => {
        if (firebaseState.auth !== expiryAuth || firebaseState.fb !== expiryFb || loginBackendScope() !== expiryScope || (expiryAuth.currentUser && (expiryAuth.currentUser !== expiredUser || firebaseState.authGeneration !== expiryGeneration)) || firebaseState.authLoginOperation) return;
        clearRememberedSession(true);
        showLoginModalWithPrefill();
        reannounceOrShowToast(SESSION_EXPIRED_TOAST);
    };
    expiryFb.signOut(expiryAuth).then(finish, finish);
}

export function armSessionExpiryCheck(user, generation) {
    if (!user) return false;
    firebaseState.sessionExpiryCheck = 'pending';
    const settle = (expired) => {
        if (generation !== firebaseState.authGeneration) return;
        firebaseState.sessionExpiryCheck = expired ? 'expired' : 'live';
        if (expired) forceExpireSession();
        else refreshLiveToasts();
    };
    isFirebaseSessionExpired(user).then(settle, () => settle(false));
    return true;
}

export function runSessionExpiryCheck() {
    if (firebaseState.sessionExpiryCheckInFlight || firebaseState.sessionExpiryCheck === 'pending' || firebaseState.sessionExpiryCheck === 'expired') return Promise.resolve(false);
    if (!firebaseState.auth || !firebaseState.auth.currentUser) return Promise.resolve(false);
    firebaseState.sessionExpiryCheckInFlight = true;
    const generation = firebaseState.authGeneration;
    const sessionAuth = firebaseState.auth;
    const database = firebaseState.db;
    const user = firebaseState.auth.currentUser;
    return isFirebaseSessionExpired(user).then((expired) => {
        if (expired && generation === firebaseState.authGeneration && firebaseState.auth === sessionAuth && firebaseState.db === database && sessionAuth.currentUser === user) forceExpireSession();
        return expired;
    }, () => false).finally(() => {
        firebaseState.sessionExpiryCheckInFlight = false;
    });
}

export function clearSensitiveModalFields() {
    resetHealthCheck();
    closeModal('ztoPalmSignModal');
    viewState.phoneModalBusy = false;
    viewState.manualAdjustBusy = false;
    viewState.configPendingLink = null;
    viewState.configManual = false;
    hidePhoneSuggestions();
    setPhoneSearchPulledUp(false);
    viewState.palmLoginBusy = false;
    viewState.palmLoginConnected = false;
    viewState.palmLoginStatus = '';
    viewState.lookupTestResult = '';
    clearZtoPickupStatusStore();
    resetZtoFinalMarks();
    resetPushScheduleSession();
    ztoState.ztoBannerView = null;
    ztoState.ztoSyncListView = null;
    ztoState.ztoStatusModalSig = '';
    viewState.ztoSyncModalNote = '';
    closeModal('ztoSyncModal');
    ztoState.ztoListPreview = null;
    ztoState.ztoListSyncResult = null;
    ztoListSignedProbe.clear();
    ztoState.ztoListSyncInFlight = false;
    closeModal('ztoListSyncModal');
    restoreAfterPdfExport();
    resetBatchScan();
    resetZtoPalmRefresh();
    closeModal('batchScanModal');
    resetLabelPrint();
    closeModal('labelPrintModal');
    if (!isPinFlowPending()) securityState.pinTargetAction = null;
    uiState.pendingRestoreId = null;
    uiState.pendingHeldRestoreId = null;
    uiState.pendingPermanentDeleteId = null;
    pendingHistoryPatches.clear();
    dataState.historyPatchFlushInFlight = false;
    pendingRegistryReleases.clear();
    dataState.registryReleaseFlushInFlight = false;
    uiState.pendingScannedRemoval = null;
    uiState.scanRemoveInFlight = null;
    uiState.entryScanMode = 'parcel';
    safeStoreSet(appLocalStore, ENTRY_SCAN_MODE_KEY, 'parcel');
    securityState.appLockExcuseAt = 0;
    securityState.appLockVeiled = false;
    uiState.deletedSearchQuery = '';
    uiState.trashReasonFilter = '';
    expandedTrashGroups.clear();
    uiState.activeParentItemId = null;
    invalidateLookupKeyRestore();
    securityState.lookupSecretKey = null;
    lookupState.sheetScriptVersionSeen = null;
    cancelPendingLookupUnlock();
    clearLookupStatus();
    clearSheetImportSession();
    void forgetSupabaseDocsCache();
    uiState.pendingLockerCode = null;
    uiState.lockerBarcodeIndex = {};
    dataState.recentPhonesSignature = null;
    resetScanConfirm();
    endPanelGlideSnapPause();
    showAppChrome();
    const fieldsToBlank = [
        'securityPinInput', 'newSecurityPinInput', 'loginPasswordInput', 'activationKeyInput',
        'listModalPhoneText', 'barcodeListContainer', 'callMarkPhoneText',
        'editBcPcText', 'editBcCodInput', 'editBcDodInput', 'editPhoneInput',
        'searchPhoneInput', 'hwScannerInput', 'customerDataTableSearchInput',
        'modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput',
        'manualDateInput', 'manualCodChangeInput', 'manualDodChangeInput', 'manualCountChangeInput',
        'editModalBarcodeText', 'lookupApiHeaderValueInput', 'ztoPalmUsernameInput', 'ztoPalmPasswordInput',
        'modalBarcodeText', 'pdfExportPrintArea', 'phoneSuggestBox',
        'deletedTableBody', 'deletedSearchInput', 'trashSummaryBox',
        'dailyStatsContainer', 'collectedStatsContainer',
        'menuContentContainer', 'lockerListTableBody', 'lockerListSearchInput',
        'healthCheckList', 'monthlyReportBody',
        'locationWarningText', 'customLockerInput',
        'entryListTableBody', 'entryListSearchInput', 'entryListCount',
        'scanRemoveBarcodeText', 'scanRemovePhoneText', 'scanRemoveLockerText',
        'scanRemoveStateText', 'scanRemoveCodText', 'scanRemoveDodText',
        'removeScanBannerDetail', 'hardwareScannerLabel',
        'siApiUrlInput', 'siApiPasswordInput', 'siFileInput', 'siHeaderRowInput', 'siModeSel',
        'siConfigSummary', 'siConfigMsg', 'siFileMsg', 'siMapMsg', 'siActionMsg', 'siClearMsg',
        'siStatusFoot', 'siChips', 'siPreviewBody', 'siSheetSel',
        'siMapBarcode', 'siMapDod', 'siMapCod', 'siMapPhone',
        'appLockPinInput', 'appLockMsg',
        'registerInviteInput', 'registerPasswordInput', 'registerPasswordConfirmInput', 'setupLinkInput',
        'resetCodeInput', 'resetPasswordInput', 'resetPasswordConfirmInput',
        'ztoListSyncBody', 'ztoListSyncNote', 'ztoListSyncFrom', 'ztoListSyncTo'
    ];
    fieldsToBlank.forEach((id) => {
        blankElementById(id);
    });
    uiState.lockerFilterOptions = [];
    uiState.lockerFilterValue = '';
    uiState.monthlyReportMonths = [];
    viewState.entryModeShown = 'parcel';
    viewState.removeScanDetail = 'ស្កេន Barcode ហើយផ្ទៀងផ្ទាត់ព័ត៌មានមុនដក។';
    uiState.monthlyReportMonth = '';
    uiState.drawerOpen = false;
    uiState.notifyDrawerOpen = false;
    uiState.notifyView = null;
    uiState.notifyRemovedView = null;
}

export function showLoginModalWithPrefill() {
    viewState.loginMode = 'login';
    clearSensitiveModalFields();
    refreshLiveToasts();
    closeConfigQrScanner();
    MODAL_IDS.forEach((id) => {
        if (id !== 'loginModal') closeModal(id);
    });
    openModalHelper('loginModal');
    const scope = loginBackendScope();
    const savedEmail = rememberedLoginFor(scope);
    if (savedEmail) {
        setFieldValue('loginEmailInput', savedEmail);
        setFieldChecked('rememberMeCheckbox', true);
    } else if (loginPrefillScope !== null && loginPrefillScope !== scope) {
        setFieldValue('loginEmailInput', '');
    }
    loginPrefillScope = scope;
    prefillRememberedPassword(savedEmail, scope);
    if (viewState.backendKind === 'supabase' && hasPendingInvite()) routePendingInvite();
}
