import { resetReactOwned } from '../app/slot-resets';
import { byId } from '../core/dom';
import { dataState, firebaseState, lookupState, securityState, uiState, ztoState } from '../core/state';
import { getServerNow, pendingHistoryPatches, pendingRegistryReleases } from '../core/clock';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { ENTRY_SCAN_MODE_KEY } from '../core/storage-keys';
import { cancelPendingLookupUnlock, clearLookupStatus } from './auto-lookup';
import { isPinFlowPending } from './config';
import { closeConfigQrScanner } from './config-qr';
import { restoreAfterPdfExport } from './export';
import { expandedTrashGroups } from './locker';
import { hidePhoneSuggestions, setPhoneSearchPulledUp } from './phone-suggest';
import { clearSheetImportSession } from './sheet-import';
import { ztoListSignedProbe } from './zto-list-sync';
import { clearZtoPickupStatusStore } from './zto-status';
import { DB_OP_TIMEOUT_MS, withTimeout } from '../services/network';
import { resetScanConfirm } from '../services/scan-engine';
import { showAppChrome } from '../ui/chrome-autohide';
import { closeModal, openModalHelper } from '../ui/modal';
import { endPanelGlideSnapPause } from '../ui/panel-motion';
import { reannounceOrShowToast, refreshLiveToasts } from '../ui/toast';

export const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const ABANDON_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const EXPIRED_TRASH_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const TRASH_WRITE_SLOW_NOTICE_MS = 15000;

export function clearRememberedSession(keepEmail) {
    safeStoreRemove(appLocalStore, 'zoew_login_time');
    if (!keepEmail) safeStoreRemove(appLocalStore, 'remembered_email');
    clearZtoPickupStatusStore();
}

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
    firebaseState.sessionExpiryCheck = 'expired';
    refreshLiveToasts();
    const finish = () => {
        clearRememberedSession(true);
        showLoginModalWithPrefill();
        reannounceOrShowToast(SESSION_EXPIRED_TOAST);
    };
    firebaseState.fb.signOut(firebaseState.auth).then(finish, finish);
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
    const user = firebaseState.auth.currentUser;
    return isFirebaseSessionExpired(user).then((expired) => {
        if (expired && firebaseState.auth && firebaseState.auth.currentUser === user) forceExpireSession();
        return expired;
    }, () => false).finally(() => {
        firebaseState.sessionExpiryCheckInFlight = false;
    });
}

export function clearSensitiveModalFields() {
    hidePhoneSuggestions();
    setPhoneSearchPulledUp(false);
    clearZtoPickupStatusStore();
    const ztoSyncBannerEl = byId('ztoSyncBanner');
    if (ztoSyncBannerEl) ztoSyncBannerEl.classList.add('hidden');
    ztoState.ztoBannerView = null;
    ztoState.ztoSyncListView = null;
    ztoState.ztoStatusModalSig = '';
    const ztoSyncNoteEl = byId('ztoSyncModalNote');
    if (ztoSyncNoteEl) ztoSyncNoteEl.innerText = '';
    closeModal('ztoSyncModal');
    ztoState.ztoListPreview = null;
    ztoState.ztoListSyncResult = null;
    ztoListSignedProbe.clear();
    ztoState.ztoListSyncInFlight = false;
    closeModal('ztoListSyncModal');
    restoreAfterPdfExport();
    if (!isPinFlowPending()) securityState.pinTargetAction = null;
    uiState.pendingRestoreId = null;
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
    expandedTrashGroups.clear();
    uiState.activeParentItemId = null;
    securityState.lookupSecretKey = null;
    lookupState.sheetScriptVersionSeen = null;
    cancelPendingLookupUnlock();
    clearLookupStatus();
    clearSheetImportSession();
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
        'editModalBarcodeText', 'lookupApiHeaderValueInput',
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
        'ztoListSyncBody', 'ztoListSyncNote', 'ztoListSyncFrom', 'ztoListSyncTo'
    ];
    fieldsToBlank.forEach((id) => {
        if (resetReactOwned(id)) return;
        const el = byId(id);
        if (!el) return;
        if ('value' in el) el.value = '';
        else el.textContent = '';
    });
    uiState.lockerFilterOptions = [];
    uiState.lockerFilterValue = '';
    uiState.monthlyReportMonths = [];
    const parcelBtn = byId('modeParcelBtn');
    const lockerBtn = byId('modeLockerBtn');
    const removeBtn = byId('modeRemoveBtn');
    if (parcelBtn) parcelBtn.classList.add('active');
    if (lockerBtn) lockerBtn.classList.remove('active');
    if (removeBtn) removeBtn.classList.remove('active');
    if (parcelBtn) parcelBtn.setAttribute('aria-pressed', 'true');
    if (lockerBtn) lockerBtn.setAttribute('aria-pressed', 'false');
    if (removeBtn) removeBtn.setAttribute('aria-pressed', 'false');
    const entryPage = byId('pageEntry');
    if (entryPage) entryPage.classList.remove('remove-scan-active');
    const removeBanner = byId('removeScanBanner');
    if (removeBanner) removeBanner.classList.add('hidden');
    const lockerPanel = byId('lockerPanel');
    if (lockerPanel) lockerPanel.classList.add('hidden');
    const parcelPanel = byId('parcelPanel');
    if (parcelPanel) parcelPanel.classList.remove('hidden');
    const hwInput = byId('hwScannerInput');
    if (hwInput) hwInput.placeholder = 'ស្កេន Barcode...';
    const hwLabel = byId('hardwareScannerLabel');
    if (hwLabel) hwLabel.textContent = 'ស្កេន Barcode (Bluetooth/USB) ឬវាយបញ្ចូលដោយដៃ';
    const removeDetail = byId('removeScanBannerDetail');
    if (removeDetail) removeDetail.textContent = 'ស្កេន Barcode ហើយផ្ទៀងផ្ទាត់ព័ត៌មានមុនដក។';
    uiState.monthlyReportMonth = '';
}

export function showLoginModalWithPrefill() {
    clearSensitiveModalFields();
    refreshLiveToasts();
    closeConfigQrScanner();
    document.querySelectorAll('.modal').forEach((m) => {
        if (m.id !== 'loginModal') closeModal(m.id);
    });
    openModalHelper('loginModal');
    const savedEmail = safeStoreGet(appLocalStore, 'remembered_email');
    const emailInput = byId('loginEmailInput');
    const rememberCb = byId('rememberMeCheckbox');
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberCb) rememberCb.checked = true;
    }
}
