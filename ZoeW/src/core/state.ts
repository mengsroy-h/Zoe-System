import { createStore, registerStore } from './store';
import { appLocalStore, safeStoreGet } from './storage';
import { ACTIVE_LOCKER_KEY, ENTRY_SCAN_MODE_KEY } from './storage-keys';

void ACTIVE_LOCKER_KEY; void ENTRY_SCAN_MODE_KEY; void appLocalStore; void safeStoreGet;

export interface FirebaseState {
    authButtonIsLoggedIn: boolean;
    firebaseConfig: any;
    fb: any;
    auth: any;
    db: any;
    dbRefHistory: any;
    dbRefDeleted: any;
    dbRefDailyRevenue: any;
    dbRefMonthlyRevenue: any;
    dbRefDailyPickup: any;
    dbRefDailyCollected: any;
    dbRefExchangeRate: any;
    dbRefConnected: any;
    dbRefServerTimeOffset: any;
    authUnsubscribe: any;
    authRecoveryTimeout: any;
    authGeneration: number;
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
    lateFirebaseSdkListenerArmed: boolean;
    firebaseSdkUnavailable: boolean;
    sdkUnavailableNoticeShown: boolean;
    sessionExpiryCheckInFlight: boolean;
    licenseRecheckInFlight: boolean;
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
    dbRefConnected: null,
    dbRefServerTimeOffset: null,
    authUnsubscribe: null,
    authRecoveryTimeout: null,
    authGeneration: 0,
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
    lateFirebaseSdkListenerArmed: false,
    firebaseSdkUnavailable: false,
    sdkUnavailableNoticeShown: false,
    sessionExpiryCheckInFlight: false,
    licenseRecheckInFlight: false,
});
registerStore(firebaseState);

export interface DataState {
    exchangeRateRiel: any;
    scanHistory: any[];
    deletedItems: any[];
    dailyRevenueData: Record<string, any>;
    monthlyRevenueData: Record<string, any>;
    dailyPickupData: Record<string, any>;
    dailyCollectedData: Record<string, any>;
    pickupResetInFlight: boolean;
    exchangeRateSaveInFlight: boolean;
    historyPatchFlushInFlight: boolean;
    registryReleaseFlushInFlight: boolean;
    pickupLedgerRepairDone: boolean;
    pickupLedgerRepairRunning: boolean;
    recentPhonesSignature: any;
    deletedCleanupInFlight: boolean;
    cleanupResumeInFlight: boolean;
    clearHistoryInFlight: boolean;
    recentPhonesOptions: string[];
}

export const dataState = createStore<DataState>('dataState', {
    exchangeRateRiel: parseFloat(safeStoreGet(appLocalStore, 'zoew_exchange_rate')) || 4100,
    scanHistory: [],
    deletedItems: [],
    dailyRevenueData: {},
    monthlyRevenueData: {},
    dailyPickupData: {},
    dailyCollectedData: {},
    pickupResetInFlight: false,
    exchangeRateSaveInFlight: false,
    historyPatchFlushInFlight: false,
    registryReleaseFlushInFlight: false,
    pickupLedgerRepairDone: false,
    pickupLedgerRepairRunning: false,
    recentPhonesSignature: null,
    deletedCleanupInFlight: false,
    cleanupResumeInFlight: false,
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
    lastScannedCode: string;
    lastScanTime: number;
    nativeDetector: any;
    ownCaptureCanvas: any;
    ownCaptureCtx: any;
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
    lastScannedCode: "",
    lastScanTime: 0,
    nativeDetector: null,
    ownCaptureCanvas: null,
    ownCaptureCtx: null,
});
registerStore(scanState);

export interface UiState {
    perfSamplePending: boolean;
    displayHz: number;
    displayHzMeasured: boolean;
    currentFilterMode: string;
    customFilterDate: string;
    editingItemId: any;
    markingItemId: any;
    activeEditingBarcode: any;
    activeParentItemId: any;
    pendingRestoreId: any;
    isModalOpen: boolean;
    phoneModalDismissPromptOpen: boolean;
    searchTimer: any;
    globalAudioCtx: any;
    lastEnteredLocker: any;
    currentAppPage: string;
    panelGlideTokens: number;
    panelGlideEpoch: number;
    panelGlideRelease: any;
    chromeHidden: boolean;
    pdfExportOriginalTitle: any;
    monthlyReportMonth: string;
    lastRecallSignature: string;
    pendingHistoryViewRefresh: any;
    phoneSuggestItems: any[];
    phoneSuggestActiveIndex: number;
    phoneSuggestHideTimer: any;
    phoneSuggestOpen: boolean;
    deletedSearchQuery: string;
    activeLocker: any;
    entryScanMode: any;
    lockerBarcodeIndex: Record<string, any>;
    pendingLockerCode: any;
    lockerAssignGeneration: number;
    pendingScannedRemoval: any;
    scanRemoveInFlight: any;
    pendingPermanentDeleteId: any;
    historyView: any[] | null;
    entryListView: any[] | null;
    lockerListView: any | null;
    trashSummary: any | null;
    trashView: any | null;
    monthlyReportView: any | null;
    dailyStatsView: any | null;
    collectedStatsView: any | null;
    healthRows: import('../app/components/health/model').HealthRow[] | null;
    viewListView: any[] | null;
    lockerGridView: any | null;
    moreMenuItems: any[] | null;
    moreMenuOpen: boolean;
    moreMenuPosition: { top: number; left: number } | null;
    monthlyReportMonths: string[];
    lockerFilterOptions: string[];
    lockerFilterValue: string;
    pdfExportView: any | null;
    toasts: any[];
    updateBannerOpen: boolean;
    sheetImportView: any | null;
    modalDisplay: Record<string, 'flex' | 'none'>;
    drawerOpen: boolean;
    dataPanelCollapsed: boolean;
    entryPanelCollapsed: boolean;
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
    pdfExportOriginalTitle: null,
    monthlyReportMonth: '',
    lastRecallSignature: '',
    pendingHistoryViewRefresh: null,
    phoneSuggestItems: [],
    phoneSuggestActiveIndex: -1,
    phoneSuggestHideTimer: null,
    phoneSuggestOpen: false,
    deletedSearchQuery: '',
    activeLocker: safeStoreGet(appLocalStore, ACTIVE_LOCKER_KEY) || '',
    entryScanMode: safeStoreGet(appLocalStore, ENTRY_SCAN_MODE_KEY) === 'locker' ? 'locker' : 'parcel',
    lockerBarcodeIndex: {},
    pendingLockerCode: null,
    lockerAssignGeneration: 0,
    pendingScannedRemoval: null,
    scanRemoveInFlight: null,
    pendingPermanentDeleteId: null,
    historyView: null,
    entryListView: null,
    lockerListView: null,
    trashSummary: null,
    trashView: null,
    monthlyReportView: null,
    dailyStatsView: null,
    collectedStatsView: null,
    healthRows: null,
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
    drawerOpen: false,
    dataPanelCollapsed: false,
    entryPanelCollapsed: false,
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
uiState.markImmediate(['modalDisplay', 'drawerOpen', 'moreMenuOpen', 'moreMenuPosition', 'currentAppPage',
    'dataPanelCollapsed', 'entryPanelCollapsed', 'dataPanelSearchFocus', 'historyExpanded', 'panelGliding',
    'phoneSuggestOpen', 'chromeHidden']);

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

export interface SecurityState {
    lookupSecretKey: any;
    pinTargetAction: any;
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
    ztoBannerView: any | null;
    ztoSyncListView: any | null;
    ztoListPreview: any | null;
}

export const ztoState = createStore<ZtoState>('ztoState', {
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
    ztoBannerView: null,
    ztoSyncListView: null,
    ztoListPreview: null,
});
registerStore(ztoState);

