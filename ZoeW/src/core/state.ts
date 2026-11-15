import { createStore, registerStore } from './store';
import { appLocalStore, safeStoreGet } from './storage';
import { ACTIVE_LOCKER_KEY, ENTRY_SCAN_MODE_KEY } from './storage-keys';
import type { DeletedParcelRow, ParcelRow } from '../domain/parcel';
import type { BackendAuth, BackendConfig, BackendDatabase, BackendReference, BackendSdk } from '../services/backend-types';
import type { CollectedDayView, LedgerBucketView, PickupDayView } from '../domain/statistics';
import type { EntryMode } from './view-state';
import type { BarcodeListRow, CardsView, CollectedStatCard, DailyStatCard, EntryListRow, LockerBarcodeEntry, LockerGridView, LockerListView, MonthlyReportView, MoreMenuItem, PdfExportView, PhoneSuggestion, ScannedRemoval, ScannedRemovalOperation, SheetImportView, ToastView, TrashSummaryModel, TrashView } from '../ui/view-types';

void ACTIVE_LOCKER_KEY; void ENTRY_SCAN_MODE_KEY; void appLocalStore; void safeStoreGet;

export interface FirebaseState {
    authButtonIsLoggedIn: boolean;
    firebaseConfig: BackendConfig | null;
    fb: BackendSdk | null;
    auth: BackendAuth | null;
    db: BackendDatabase | null;
    dbRefHistory: BackendReference<Record<string, ParcelRow>> | null;
    dbRefDeleted: BackendReference<Record<string, DeletedParcelRow>> | null;
    dbRefDailyRevenue: BackendReference<Partial<Record<string, LedgerBucketView>>> | null;
    dbRefMonthlyRevenue: BackendReference<Partial<Record<string, LedgerBucketView>>> | null;
    dbRefDailyPickup: BackendReference<Partial<Record<string, PickupDayView>>> | null;
    dbRefDailyCollected: BackendReference<Partial<Record<string, CollectedDayView>>> | null;
    dbRefExchangeRate: BackendReference<number> | null;
    dbRefZtoSignedSweep: BackendReference | null;
    dbRefZtoTrashMode: BackendReference | null;
    dbRefZtoSweepLane: BackendReference | null;
    dbRefConnected: BackendReference<boolean> | null;
    dbRefServerTimeOffset: BackendReference<number> | null;
    authUnsubscribe: (() => void) | null;
    authRecoveryTimeout: ReturnType<typeof setTimeout> | null;
    authGeneration: number;
    authLoginOperation: any;
    sessionExpiryCheck: string;
    isDatabaseConnected: boolean;
    hasEverConnectedToDatabase: boolean;
    networkJustReturned: boolean;
    autoLoginAttempted: boolean;
    isInitializingFirebase: boolean;
    serverTimeOffsetMs: number;
    serverClockTrusted: boolean;
    isDatabaseInitialized: boolean;
    dbListenersFailed: boolean;
    dbListenerRecoveryTimer: any;
    dbListenerRecoveryAttempt: number;
    lastDbListenerAttemptAt: number;
    dbListenerOutageNoticeShown: boolean;
    dbListenerPendingSeen: number;
    dbListenerProgressAt: number;
    dbListenerGeneration: number;
    infoListenersFailed: boolean;
    infoListenerRecoveryTimer: any;
    infoListenerRecoveryAttempt: number;
    infoListenerGeneration: number;
    reconnectWatchdogTimer: any;
    reconnectWatchdogAttempt: number;
    lastForcedReconnectAt: number;
    firebaseSdkRetryTimer: any;
    firebaseSdkRetryAttempt: number;
    lastFirebaseSdkAttemptAt: number;
    lastFirebaseSdkReloadAt: number;
    firebaseSdkProbeInFlight: boolean;
    lateFirebaseSdkListenerArmed: boolean;
    firebaseSdkUnavailable: boolean;
    sdkUnavailableNoticeShown: boolean;
    sessionExpiryCheckInFlight: boolean;
    licenseRecheckInFlight: boolean;
    dbLivenessProbe: Promise<boolean | null> | null;
    lastDbLivenessOkAt: number;
    lastDbLivenessCycleAt: number;
    documentHiddenAt: number;
}

export const firebaseState = createStore<FirebaseState>('firebaseState', {
    authButtonIsLoggedIn: false,
    firebaseConfig: null,
    fb: null,
    auth: null,
    db: null,
    dbRefHistory: null,
    dbRefDeleted: null,
    dbRefDailyRevenue: null,
    dbRefMonthlyRevenue: null,
    dbRefDailyPickup: null,
    dbRefDailyCollected: null,
    dbRefExchangeRate: null,
    dbRefZtoSignedSweep: null,
    dbRefZtoTrashMode: null,
    dbRefZtoSweepLane: null,
    dbRefConnected: null,
    dbRefServerTimeOffset: null,
    authUnsubscribe: null,
    authRecoveryTimeout: null,
    authGeneration: 0,
    authLoginOperation: null,
    sessionExpiryCheck: 'pending',
    isDatabaseConnected: false,
    hasEverConnectedToDatabase: false,
    networkJustReturned: false,
    autoLoginAttempted: false,
    isInitializingFirebase: false,
    serverTimeOffsetMs: 0,
    serverClockTrusted: false,
    isDatabaseInitialized: false,
    dbListenersFailed: false,
    dbListenerRecoveryTimer: null,
    dbListenerRecoveryAttempt: 0,
    lastDbListenerAttemptAt: 0,
    dbListenerOutageNoticeShown: false,
    dbListenerPendingSeen: 0,
    dbListenerProgressAt: 0,
    dbListenerGeneration: 0,
    infoListenersFailed: false,
    infoListenerRecoveryTimer: null,
    infoListenerRecoveryAttempt: 0,
    infoListenerGeneration: 0,
    reconnectWatchdogTimer: null,
    reconnectWatchdogAttempt: 0,
    lastForcedReconnectAt: 0,
    firebaseSdkRetryTimer: null,
    firebaseSdkRetryAttempt: 0,
    lastFirebaseSdkAttemptAt: 0,
    lastFirebaseSdkReloadAt: 0,
    firebaseSdkProbeInFlight: false,
    lateFirebaseSdkListenerArmed: false,
    firebaseSdkUnavailable: false,
    sdkUnavailableNoticeShown: false,
    sessionExpiryCheckInFlight: false,
    licenseRecheckInFlight: false,
    dbLivenessProbe: null,
    lastDbLivenessOkAt: 0,
    lastDbLivenessCycleAt: 0,
    documentHiddenAt: 0,
});
registerStore(firebaseState);

export interface DataState {
    exchangeRateRiel: any;
    exchangeRateObservedVersion: number;
    scanHistory: ParcelRow[];
    deletedItems: DeletedParcelRow[];
    dailyRevenueData: Partial<Record<string, LedgerBucketView>>;
    monthlyRevenueData: Partial<Record<string, LedgerBucketView>>;
    dailyPickupData: Partial<Record<string, PickupDayView>>;
    dailyCollectedData: Partial<Record<string, CollectedDayView>>;
    pickupResetInFlight: boolean;
    exchangeRateSaveInFlight: boolean;
    exchangeRateSaveOperation: any;
    historyPatchFlushInFlight: boolean;
    registryReleaseFlushInFlight: boolean;
    pickupResumeInFlight: boolean;
    pickupPendingVersion: number;
    recentPhonesSignature: any;
    deletedCleanupInFlight: boolean;
    cleanupResumeInFlight: boolean;
    cleanupSweepVisited: Set<string>;
    cleanupSweepTimer: any;
    clearHistoryInFlight: boolean;
    recentPhonesOptions: string[];
}

export const dataState = createStore<DataState>('dataState', {
    exchangeRateRiel: parseFloat(safeStoreGet(appLocalStore, 'zoew_exchange_rate')) || 4100,
    exchangeRateObservedVersion: 0,
    scanHistory: [],
    deletedItems: [],
    dailyRevenueData: {},
    monthlyRevenueData: {},
    dailyPickupData: {},
    dailyCollectedData: {},
    pickupResetInFlight: false,
    exchangeRateSaveInFlight: false,
    exchangeRateSaveOperation: null,
    historyPatchFlushInFlight: false,
    registryReleaseFlushInFlight: false,
    pickupResumeInFlight: false,
    pickupPendingVersion: 0,
    recentPhonesSignature: null,
    deletedCleanupInFlight: false,
    cleanupResumeInFlight: false,
    cleanupSweepVisited: new Set(),
    cleanupSweepTimer: null,
    clearHistoryInFlight: false,
    recentPhonesOptions: [],
});
registerStore(dataState);

export interface ScanState {
    codeReader: any;
    liveScanCodeReader: any;
    scanConfirmCode: string;
    scanConfirmCount: number;
    scanConfirmAt: number;
    scanVideoResumeTimer: any;
    currentStream: any;
    isCameraScanning: boolean;
    isCameraStarting: boolean;
    cameraRequestId: number;
    pendingLoadedMetadataHandler: any;
    nativeLoopActive: boolean;
    zxingLoopActive: boolean;
    liveScanWidthIndex: number;
    liveScanCostEma: number;
    lastDecodedVideoTime: number;
    staleFrameStreak: number;
    freshFrameGateUsable: boolean;
    currentVideoTrack: any;
    torchOn: boolean;
    pendingBarcode: string;
    pendingScanSession: { db: BackendDatabase; auth: number } | null;
    phoneModalTyped: boolean;
    lastScannedCode: string;
    lastScanTime: number;
    nativeDetector: any;
    ownCaptureCanvas: any;
    ownCaptureCtx: any;
    ownQrCanvas: any;
    ownQrCtx: any;
    liveScanRound: number;
    scanEngineDown: boolean;
    scanEngineFailures: number;
    scanEngineRetryTimer: any;
    scanEngineFailureReported: boolean;
}

export const scanState = createStore<ScanState>('scanState', {
    codeReader: null,
    liveScanCodeReader: null,
    scanConfirmCode: '',
    scanConfirmCount: 0,
    scanConfirmAt: 0,
    scanVideoResumeTimer: null,
    currentStream: null,
    isCameraScanning: false,
    isCameraStarting: false,
    cameraRequestId: 0,
    pendingLoadedMetadataHandler: null,
    nativeLoopActive: false,
    zxingLoopActive: false,
    liveScanWidthIndex: -1,
    liveScanCostEma: 0,
    lastDecodedVideoTime: -1,
    staleFrameStreak: 0,
    freshFrameGateUsable: true,
    currentVideoTrack: null,
    torchOn: false,
    pendingBarcode: "",
    pendingScanSession: null,
    phoneModalTyped: false,
    lastScannedCode: "",
    lastScanTime: 0,
    nativeDetector: null,
    ownCaptureCanvas: null,
    ownCaptureCtx: null,
    ownQrCanvas: null,
    ownQrCtx: null,
    liveScanRound: 0,
    scanEngineDown: false,
    scanEngineFailures: 0,
    scanEngineRetryTimer: null,
    scanEngineFailureReported: false,
});
registerStore(scanState);

export interface ModalKeyboardFit {
    id: string;
    top: number;
    max: number;
    shift: number;
    hold?: boolean;
}

export interface UiState {
    perfSamplePending: boolean;
    displayHz: number;
    displayHzMeasured: boolean;
    displayHzPeak: number;
    currentFilterMode: string;
    customFilterDate: string;
    editingItemId: string | null;
    markingItemId: string | null;
    activeEditingBarcode: string | null;
    activeParentItemId: string | null;
    pendingRestoreId: string | null;
    isModalOpen: boolean;
    phoneModalDismissPromptOpen: boolean;
    searchTimer: ReturnType<typeof setTimeout> | null;
    globalAudioCtx: any;
    lastEnteredLocker: string;
    currentAppPage: string;
    panelGlideTokens: number;
    panelGlideEpoch: number;
    panelGlideRelease: ReturnType<typeof setTimeout> | null;
    chromeHidden: boolean;
    keyboardOpen: boolean;
    iosKeyboardInset: number;
    iosKeyboardListFixed: boolean;
    iosKeyboardSuggestFixed: boolean;
    modalViewportTop: number;
    modalViewportHeight: number;
    modalKeyboardFit: ModalKeyboardFit | null;
    keyboardCover: number;
    pdfExportOriginalTitle: string | null;
    monthlyReportMonth: string;
    lastRecallSignature: string;
    pendingHistoryViewRefresh: ReturnType<typeof setTimeout> | null;
    phoneSuggestItems: PhoneSuggestion[];
    phoneSuggestActiveIndex: number;
    phoneSuggestHideTimer: ReturnType<typeof setTimeout> | null;
    phoneSuggestOpen: boolean;
    deletedSearchQuery: string;
    trashReasonFilter: string;
    activeLocker: string;
    entryScanMode: EntryMode;
    lockerBarcodeIndex: Partial<Record<string, LockerBarcodeEntry>>;
    pendingLockerCode: string | null;
    lockerAssignGeneration: number;
    pendingScannedRemoval: ScannedRemoval | null;
    scanRemoveInFlight: ScannedRemovalOperation | null;
    pendingPermanentDeleteId: string | null;
    historyView: ParcelRow[] | null;
    historyRenderSeq: number;
    historyRenderLimit: number;
    historyViewKey: string;
    entryListView: EntryListRow[] | null;
    lockerListView: LockerListView | null;
    trashSummary: TrashSummaryModel | null;
    trashView: TrashView | null;
    trashRenderLimit: number;
    monthlyReportView: MonthlyReportView | null;
    dailyStatsView: CardsView<DailyStatCard> | null;
    collectedStatsView: CardsView<CollectedStatCard> | null;
    healthRows: import('../app/components/health/model').HealthRow[] | null;
    healthAdvice: import('../features/health-advice').HealthAdvice | null;
    healthRunSeq: number;
    viewListView: BarcodeListRow[] | null;
    lockerGridView: LockerGridView | null;
    moreMenuItems: MoreMenuItem[] | null;
    moreMenuOpen: boolean;
    moreMenuPosition: { top: number; left: number } | null;
    monthlyReportMonths: string[];
    lockerFilterOptions: string[];
    lockerFilterValue: string;
    pdfExportView: PdfExportView | null;
    toasts: ToastView[];
    updateBannerOpen: boolean;
    sheetImportView: SheetImportView | null;
    modalDisplay: Record<string, 'flex' | 'none'>;
    modalStack: string[];
    drawerOpen: boolean;
    notifyDrawerOpen: boolean;
    notifyView: import('../features/notifications').NotifyView | null;
    notifyRemovedView: import('../features/notifications').NotifyRemovedView | null;
    notifyRemovedSeenIds: string[];
    notifyFeed: import('../features/notifications').NotifyFeedItem[];
    notifySellerFeed: import('../features/notifications').NotifyFeedItem[];
    pushStatus: import('../features/push').PushStatus;
    notifyDismissedIds: string[];
    notifySeenIds: string[];
    notifyFeedFetchedAt: number;
    notifyFeedInFlight: boolean;
    apkRelease: import('../features/apk-update').ApkReleaseState;
    apkUpdate: import('../features/apk-update').ApkUpdateState;
    appUpdateCheck: { phase: 'idle' | 'checking' | 'done' | 'failed'; at: number };
    deviceInfo: import('../features/device-info').DeviceInfo;
    updateReady: boolean;
    dataPanelCollapsed: boolean;
    entryPanelCollapsed: boolean;
    entrySearchActive: boolean;
    dataPanelSearchFocus: boolean;
    historyExpanded: boolean;
    panelGliding: boolean;
    phoneSuggestWidth: string;
    phoneSuggestLeft: string;
    phoneSuggestTop: string;
    chromeTopVar: string;
    tabbarHeightVar: string;
    pageExtensionVar: string;
    chromeBottomVar: string;
}

export const uiState = createStore<UiState>('uiState', {
    perfSamplePending: false,
    displayHz: 60,
    displayHzMeasured: false,
    displayHzPeak: 0,
    currentFilterMode: 'today',
    customFilterDate: '',
    editingItemId: null,
    markingItemId: null,
    activeEditingBarcode: null,
    activeParentItemId: null,
    pendingRestoreId: null,
    isModalOpen: false,
    phoneModalDismissPromptOpen: false,
    searchTimer: null,
    globalAudioCtx: null,
    lastEnteredLocker: safeStoreGet(appLocalStore, 'last_entered_locker') || "",
    currentAppPage: 'data',
    panelGlideTokens: 0,
    panelGlideEpoch: 0,
    panelGlideRelease: null,
    chromeHidden: false,
    keyboardOpen: false,
    iosKeyboardInset: 0,
    iosKeyboardListFixed: false,
    iosKeyboardSuggestFixed: false,
    modalViewportTop: 0,
    modalViewportHeight: 0,
    modalKeyboardFit: null,
    keyboardCover: 0,
    pdfExportOriginalTitle: null,
    monthlyReportMonth: '',
    lastRecallSignature: '',
    pendingHistoryViewRefresh: null,
    phoneSuggestItems: [],
    phoneSuggestActiveIndex: -1,
    phoneSuggestHideTimer: null,
    phoneSuggestOpen: false,
    deletedSearchQuery: '',
    trashReasonFilter: '',
    activeLocker: safeStoreGet(appLocalStore, ACTIVE_LOCKER_KEY) || '',
    entryScanMode: safeStoreGet(appLocalStore, ENTRY_SCAN_MODE_KEY) === 'locker' ? 'locker' : 'parcel',
    lockerBarcodeIndex: {},
    pendingLockerCode: null,
    lockerAssignGeneration: 0,
    pendingScannedRemoval: null,
    scanRemoveInFlight: null,
    pendingPermanentDeleteId: null,
    historyView: null,
    historyRenderSeq: 0,
    historyRenderLimit: 50,
    historyViewKey: '',
    entryListView: null,
    lockerListView: null,
    trashSummary: null,
    trashView: null,
    trashRenderLimit: 20,
    monthlyReportView: null,
    dailyStatsView: null,
    collectedStatsView: null,
    healthRows: null,
    healthAdvice: null,
    healthRunSeq: 0,
    viewListView: null,
    lockerGridView: null,
    moreMenuItems: null,
    moreMenuOpen: false,
    moreMenuPosition: null,
    monthlyReportMonths: [],
    lockerFilterOptions: [],
    lockerFilterValue: '',
    pdfExportView: null,
    toasts: [],
    updateBannerOpen: false,
    sheetImportView: null,
    modalDisplay: {},
    modalStack: [],
    drawerOpen: false,
    notifyDrawerOpen: false,
    notifyView: null,
    notifyRemovedView: null,
    notifyRemovedSeenIds: [],
    notifyFeed: [],
    notifySellerFeed: [],
    pushStatus: 'unknown',
    notifyDismissedIds: [],
    notifySeenIds: [],
    notifyFeedFetchedAt: 0,
    notifyFeedInFlight: false,
    apkRelease: { version: '', state: 'idle', checkedAt: 0 },
    apkUpdate: { phase: 'idle', version: '', received: 0, total: 0, error: '' },
    appUpdateCheck: { phase: 'idle', at: 0 },
    deviceInfo: { state: 'idle', model: '', platform: '', serial: '', serialKind: '' },
    updateReady: false,
    dataPanelCollapsed: false,
    entryPanelCollapsed: false,
    entrySearchActive: false,
    dataPanelSearchFocus: false,
    historyExpanded: false,
    panelGliding: false,
    phoneSuggestWidth: '',
    phoneSuggestLeft: '',
    phoneSuggestTop: '',
    chromeTopVar: '',
    tabbarHeightVar: '',
    pageExtensionVar: '',
    chromeBottomVar: '',
});
registerStore(uiState);
uiState.markImmediate(['modalDisplay', 'modalStack', 'drawerOpen', 'notifyDrawerOpen', 'moreMenuOpen', 'moreMenuPosition', 'currentAppPage',
    'dataPanelCollapsed', 'entryPanelCollapsed', 'entrySearchActive', 'dataPanelSearchFocus', 'historyExpanded', 'panelGliding',
    'phoneSuggestOpen', 'chromeHidden', 'keyboardOpen']);

export interface PtrView {
    transform: string;
    opacity: string;
    ready: boolean;
    snapping: boolean;
    spinning: boolean;
}

export interface PtrState {
    view: PtrView | null;
}

export const ptrState = createStore<PtrState>('ptrState', { view: null });
registerStore(ptrState);

export interface ScrollThumbView {
    x: number;
    y: number;
    h: number;
    shown: boolean;
    cut?: boolean;
}

export interface ScrollThumbState {
    view: ScrollThumbView | null;
}

export const scrollThumbState = createStore<ScrollThumbState>('scrollThumbState', { view: null });
registerStore(scrollThumbState);

export interface SecurityState {
    lookupSecretKey: any;
    pinTargetAction: any;
    pinFlowGeneration: number;
    isVerifyingPin: boolean;
    biometricUnlockInFlight: boolean;
    appIsLocked: boolean;
    appLockBusy: boolean;
    appLockExcuseAt: number;
    appLockVeiled: boolean;
    appLockAwayNoted: boolean;
    configQrReader: any;
    configQrStream: any;
    configQrScanActive: boolean;
}

export const securityState = createStore<SecurityState>('securityState', {
    lookupSecretKey: null,
    pinTargetAction: null,
    pinFlowGeneration: 0,
    isVerifyingPin: false,
    biometricUnlockInFlight: false,
    appIsLocked: false,
    appLockBusy: false,
    appLockExcuseAt: 0,
    appLockVeiled: false,
    appLockAwayNoted: false,
    configQrReader: null,
    configQrStream: null,
    configQrScanActive: false,
});
registerStore(securityState);

export interface LookupState {
    customerDataTableRows: any;
    customerDataTableFetchedAt: number;
    customerDataTableFetchPromise: any;
    customerDataTableSessionGeneration: number;
    customerDataTableFetchGeneration: number;
    customerDataTableLastFailedAt: number;
    ztoWarmSoonTimer: any;
    ztoWarmSoonArmedAt: number;
    customerTableRetryTimer: any;
    customerTableFailStreak: number;
    customerTableSoonTimer: any;
    customerTableSoonArmedAt: number;
    customerTableIsPartial: boolean;
    sheetScriptVersionSeen: any;
    ztoWarmupAt: number;
    ztoWarmupInFlight: boolean;
    lookupLockedNoticeShown: boolean;
    pendingLookupUnlockBarcode: string;
    pendingLookupUnlockResolve: any;
    customerTableView: any | null;
}

export const lookupState = createStore<LookupState>('lookupState', {
    customerDataTableRows: null,
    customerDataTableFetchedAt: 0,
    customerDataTableFetchPromise: null,
    customerDataTableSessionGeneration: 0,
    customerDataTableFetchGeneration: 0,
    customerDataTableLastFailedAt: 0,
    ztoWarmSoonTimer: null,
    ztoWarmSoonArmedAt: 0,
    customerTableRetryTimer: null,
    customerTableFailStreak: 0,
    customerTableSoonTimer: null,
    customerTableSoonArmedAt: 0,
    customerTableIsPartial: false,
    sheetScriptVersionSeen: null,
    ztoWarmupAt: 0,
    ztoWarmupInFlight: false,
    lookupLockedNoticeShown: false,
    pendingLookupUnlockBarcode: '',
    pendingLookupUnlockResolve: null,
    customerTableView: null,
});
registerStore(lookupState);

export interface SheetImportState {
    sheetImportKey: any;
    sheetImportUrl: string;
    sheetImportPassword: string;
    sheetImportWorkbook: any;
    sheetImportSheetRows: any[];
    sheetImportHeaders: any[];
    sheetImportSignature: string;
    sheetImportBusy: boolean;
}

export const sheetImportState = createStore<SheetImportState>('sheetImportState', {
    sheetImportKey: null,
    sheetImportUrl: '',
    sheetImportPassword: '',
    sheetImportWorkbook: null,
    sheetImportSheetRows: [],
    sheetImportHeaders: [],
    sheetImportSignature: '',
    sheetImportBusy: false,
});
registerStore(sheetImportState);

export interface ZtoState {
    ztoSessionGeneration: number;
    ztoStatusLoaded: boolean;
    ztoStatusSweepTimer: any;
    ztoStatusInFlight: boolean;
    ztoStatusLastSweepAt: number;
    ztoStatusFailStreak: number;
    ztoStatusBannerSig: string;
    ztoStatusModalSig: string;
    ztoStatusSweepCursor: number;
    ztoListSyncInFlight: boolean;
    ztoListSyncResult: any;
    ztoSignedSweepAt: number;
    ztoReturnedSweepAt: number;
    ztoSignedSweepOkAt: number;
    ztoSignedSweepWaitMs: number;
    ztoSignedCompleteAt: number;
    ztoSignedCompleteServerAt: number;
    ztoSignedOff: boolean;
    ztoSignedTruncatedNoted: boolean;
    ztoUserActiveAt: number;
    ztoAbandonHoldSince: number;
    ztoAbandonCheckedAt: number;
    ztoShopSweep: { state: string; activeAt: number; completeAt: number; advancedAt: number; failedAt: number };
    ztoShopSweepWrote: { activeAt: number; completeAt: number };
    ztoTrashMode: { state: string; palmAt: number; cookieAt: number; failedAt: number; stamps: Record<string, number>; shop: string };
    ztoTrashModeWrote: { palmAt: number; cookieAt: number };
    ztoSweepLane: { state: string; lanes: Record<string, { device: string; at: number }>; failedAt: number };
    ztoSignedSplitAt: number;
    ztoSignedSplitFrom: string;
    ztoSignedMismatchFrom: string;
    ztoSignedMismatchWideAt: number;
    ztoOriginRefusedDb: any;
    ztoFinalRefusedDb: any;
    ztoFinalRefusedAt: number;
    ztoFinalInFlight: boolean;
    ztoFinalTimer: any;
    ztoBannerView: any | null;
    ztoSyncListView: any | null;
    ztoListPreview: any | null;
}

export const ztoState = createStore<ZtoState>('ztoState', {
    ztoSessionGeneration: 0,
    ztoStatusLoaded: false,
    ztoStatusSweepTimer: null,
    ztoStatusInFlight: false,
    ztoStatusLastSweepAt: 0,
    ztoStatusFailStreak: 0,
    ztoStatusBannerSig: '',
    ztoStatusModalSig: '',
    ztoStatusSweepCursor: 0,
    ztoListSyncInFlight: false,
    ztoListSyncResult: null,
    ztoSignedSweepAt: 0,
    ztoReturnedSweepAt: 0,
    ztoSignedSweepOkAt: 0,
    ztoSignedSweepWaitMs: 0,
    ztoSignedCompleteAt: 0,
    ztoSignedCompleteServerAt: 0,
    ztoSignedOff: false,
    ztoSignedTruncatedNoted: false,
    ztoUserActiveAt: 0,
    ztoAbandonHoldSince: 0,
    ztoAbandonCheckedAt: 0,
    ztoShopSweep: { state: 'off', activeAt: 0, completeAt: 0, advancedAt: 0, failedAt: 0 },
    ztoShopSweepWrote: { activeAt: 0, completeAt: 0 },
    ztoTrashMode: { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: '' },
    ztoTrashModeWrote: { palmAt: 0, cookieAt: 0 },
    ztoSweepLane: { state: 'off', lanes: {}, failedAt: 0 },
    ztoSignedSplitAt: 0,
    ztoSignedSplitFrom: '',
    ztoSignedMismatchFrom: '',
    ztoSignedMismatchWideAt: 0,
    ztoOriginRefusedDb: null,
    ztoFinalRefusedDb: null,
    ztoFinalRefusedAt: 0,
    ztoFinalInFlight: false,
    ztoFinalTimer: null,
    ztoBannerView: null,
    ztoSyncListView: null,
    ztoListPreview: null,
});
registerStore(ztoState);
