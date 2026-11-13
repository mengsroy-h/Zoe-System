import { cancelLicenseInvitation, clearLicenseInvitationIntent } from './license-invitations';
import { resetHealthCheck } from './health-check';
import { blankElementById } from '../app/slot-resets';
import { MODAL_IDS } from '../core/modals';
import { setFieldChecked, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, firebaseState, lookupState, scanState, securityState, uiState, ztoState } from '../core/state';
import { getServerClockBounds, pendingHistoryPatches, pendingRegistryReleases, serverClockIsTrustworthy } from '../core/clock';
import { appLocalStore, safeStoreRemove, safeStoreSet } from '../core/storage';
import { ENTRY_SCAN_MODE_KEY } from '../core/storage-keys';
import { hasPendingInvite, routePendingInvite } from './account';
import { cancelPendingLookupUnlock, clearLookupStatus } from './auto-lookup';
import { isPinFlowPending } from './config';
import { forgetRememberedLogin, loginBackendScope, rememberedLoginFor } from './login-memory';
import { forgetLoginPassword, prefillRememberedPassword } from './password-memory';
import { closeConfigQrScanner } from './config-qr';
import { restoreAfterPdfExport } from './export';
import { SCAN_FLOW_MODALS, resetBatchScan } from './batch-scan';
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
import { forceDatabaseReconnect } from '../services/connection';
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
    sessionAuthTime = null;
    safeStoreRemove(appLocalStore, 'zoew_login_time');
    if (!keepEmail) {
        forgetRememberedLogin();
        forgetLoginPassword();
    }
    clearZtoPickupStatusStore();
}

let loginPrefillScope = null;

let sessionAuthTime = null;
let sessionExpiryArm = null;

function sessionExpiryOwner(user) {
    const sessionAuth = firebaseState.auth;
    const sdk = firebaseState.fb;
    const sessionDb = firebaseState.db;
    const generation = firebaseState.authGeneration;
    const scope = loginBackendScope();
    return { auth: sessionAuth, sdk, db: sessionDb, generation, scope, user,
        current: () => sessionAuth === firebaseState.auth && sdk === firebaseState.fb && sessionDb === firebaseState.db
            && generation === firebaseState.authGeneration && scope === loginBackendScope() && sessionAuth?.currentUser === user };
}

function sessionVerdictAt(authTimeMs) {
    if (!Number.isFinite(authTimeMs) || !serverClockIsTrustworthy() || !Number.isFinite(firebaseState.serverTimeOffsetMs)) return 'unverified';
    const bounds = getServerClockBounds();
    if (!bounds || !Number.isFinite(bounds.lowerMs) || !Number.isFinite(bounds.upperMs) || !serverClockIsTrustworthy()) return 'unverified';
    if (bounds.lowerMs - authTimeMs > FOUR_HOURS_MS) return 'expired';
    return bounds.upperMs - authTimeMs <= FOUR_HOURS_MS ? 'live' : 'unverified';
}

export async function getFirebaseSessionVerdict(user) {
    const owner = sessionExpiryOwner(user);
    try {
        const tokenResult = await withTimeout(owner.sdk.getIdTokenResult(user), DB_OP_TIMEOUT_MS, 'Session check stalled');
        if (!owner.current()) return 'unverified';
        const authTimeMs = new Date(tokenResult.authTime).getTime();
        if (!Number.isFinite(authTimeMs)) return 'unverified';
        sessionAuthTime = { owner, authTimeMs };
        return sessionVerdictAt(authTimeMs);
    } catch (e) {
        return owner.current() && sessionAuthTime?.owner.current() && sessionAuthTime.owner.user === user
            ? sessionVerdictAt(sessionAuthTime.authTimeMs) : 'unverified';
    }
}

export function retrySessionVerification() {
    if ((navigator.onLine as boolean) !== false) forceDatabaseReconnect();
    return runSessionExpiryCheck();
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
    if (sessionExpiryArm?.current() && sessionExpiryArm.user === user && sessionExpiryArm.generation === generation) return true;
    const owner = sessionExpiryOwner(user);
    if (generation !== owner.generation || !owner.current()) return false;
    sessionExpiryArm = owner;
    const verifiedLive = firebaseState.sessionExpiryCheck === 'live' && sessionAuthTime?.owner.current()
        && sessionAuthTime.owner.user === user && sessionVerdictAt(sessionAuthTime.authTimeMs) === 'live';
    if (!verifiedLive) firebaseState.sessionExpiryCheck = 'pending';
    const settle = (verdict) => {
        if (sessionExpiryArm === owner) sessionExpiryArm = null;
        if (generation !== firebaseState.authGeneration || !owner.current()) return;
        if (verdict !== 'unverified') verdict = sessionVerdictAt(sessionAuthTime?.authTimeMs);
        firebaseState.sessionExpiryCheck = verdict;
        if (verdict === 'expired') forceExpireSession();
        else refreshLiveToasts();
    };
    getFirebaseSessionVerdict(user).then(settle, () => settle('unverified'));
    return true;
}

export function runSessionExpiryCheck() {
    if (firebaseState.sessionExpiryCheckInFlight || firebaseState.sessionExpiryCheck === 'pending' || firebaseState.sessionExpiryCheck === 'expired') return Promise.resolve(false);
    if (!firebaseState.auth || !firebaseState.auth.currentUser) return Promise.resolve(false);
    firebaseState.sessionExpiryCheckInFlight = true;
    const user = firebaseState.auth.currentUser;
    const owner = sessionExpiryOwner(user);
    if (!serverClockIsTrustworthy()) firebaseState.sessionExpiryCheck = 'unverified';
    return getFirebaseSessionVerdict(user).then((verdict) => {
        if (!owner.current()) return false;
        if (verdict !== 'unverified') verdict = sessionVerdictAt(sessionAuthTime?.authTimeMs);
        firebaseState.sessionExpiryCheck = verdict;
        if (verdict === 'expired') forceExpireSession();
        else refreshLiveToasts();
        return verdict === 'expired';
    }, () => false).finally(() => {
        firebaseState.sessionExpiryCheckInFlight = false;
    });
}

export function endScanFlow() {
    scanState.pendingBarcode = '';
    scanState.pendingScanSession = null;
    viewState.phoneModalBusy = false;
    SCAN_FLOW_MODALS.forEach((id) => closeModal(id));
}

export function endSessionUi() {
    securityState.pinFlowGeneration++;
    securityState.pinTargetAction = null;
    clearSensitiveModalFields();
    closeConfigQrScanner();
    MODAL_IDS.forEach((id) => closeModal(id));
}

export function clearSensitiveModalFields(preserveInvitationLink = false) {
    cancelLicenseInvitation();
    if (!preserveInvitationLink && firebaseState.auth?.currentUser) clearLicenseInvitationIntent();
    viewState.invitationCode = '';
    sessionAuthTime = null;
    resetHealthCheck();
    closeModal('ztoPalmSignModal');
    endScanFlow();
    viewState.manualAdjustBusy = false;
    viewState.scanEvidenceRetained = 0;
    viewState.priceOperationsStuck = 0;
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
    clearSensitiveModalFields(true);
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
