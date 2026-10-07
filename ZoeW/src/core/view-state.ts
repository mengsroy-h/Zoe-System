import { createStore, registerStore } from './store';

export type ScanRemoveTextId = 'scanRemoveBarcodeText' | 'scanRemovePhoneText' | 'scanRemoveLockerText'
    | 'scanRemoveStateText' | 'scanRemoveCodText' | 'scanRemoveDodText';

export type EntryMode = 'parcel' | 'locker' | 'remove';

export type DataSummaryId = 'grandTotalCount' | 'todayTotalCount' | 'todayClosedCount' | 'todayPackagesPickedUpCount'
    | 'summaryCodDollar' | 'summaryCodRiel' | 'summaryDodDollar' | 'summaryDodRiel' | 'summaryTotalDollar' | 'summaryTotalRiel';

export interface ConfigLinkSummary {
    backend: 'firebase' | 'supabase';
    host: string;
    invite: boolean;
    official: boolean;
    dsn: boolean;
    payload?: any;
}

export interface ViewState {
    appVersionLabel: string;
    displayRateText: string;
    jankText: string;

    connectionStatus: 'online' | 'connecting' | 'offline' | null;
    connectionText: string;

    bootSplashPhase: 'shown' | 'out' | 'gone';
    bootRevealing: boolean;
    perfLite: boolean;
    documentTitle: string | null;

    loginBusy: boolean;
    backendKind: 'firebase' | 'supabase';
    configBackend: 'firebase' | 'supabase';
    configManual: boolean;
    configPendingLink: ConfigLinkSummary | null;
    loginMode: 'login' | 'register' | 'reset';

    appLockOpen: boolean;
    appLockMessage: string;
    appLockToggleText: string;
    appLockToggleOn: boolean;
    appLockBiometricVisible: boolean;

    biometricToggleText: string;
    biometricToggleOn: boolean;
    biometricUnsupported: boolean;
    pinBiometricVisible: boolean;
    pinBiometricBusy: boolean;

    drawerGroupsOpen: string[];
    drawerGroupsHidden: string[];
    ztoAutoCloseText: string;
    ztoAutoCloseOn: boolean;
    ztoAutoCloseVisible: boolean;
    ztoListSyncText: string;
    ztoListSyncOn: boolean;
    ztoListSyncDrawerVisible: boolean;
    ztoListSyncBtnVisible: boolean;

    selectedFilterTitle: string;
    historyCountText: string;
    ztoSyncModalNote: string;
    ztoListSyncNote: string;
    ztoListSyncSite: string;
    dataSummary: Record<DataSummaryId, string>;

    cameraView: 'initial' | 'live' | 'closed';
    cameraZoomDisplay: '' | 'none' | 'flex';
    cameraTorchDisplay: '' | 'none' | 'flex';
    cameraOverlayDisplay: '' | 'none' | 'flex';
    cameraZoomRange: { min: number; max: number; step: number } | null;
    cameraWebkitInline: boolean;

    entryModeShown: EntryMode;
    removeScanDetail: string;
    scanRemoveTexts: Record<ScanRemoveTextId, string>;
    entryListCountText: string;
    entryListEmpty: boolean;
    lockerListEmpty: boolean;
    activeLockerLabel: string;

    modalBarcodeText: string;
    phoneModalBusy: boolean;
    lookupStatus: { kind: string; text: string };

    listModalPhoneText: string;
    editBcPcText: string;
    callMarkPhoneText: string;
    editModalBarcodeText: string;
    locationWarningText: string;

    siParts: Record<string, boolean>;
    siStatusFoot: string;
    siConfigSaving: boolean;
    siImportBtnDisabled: boolean;
    siImportBtnText: string;
    siClearBtnBusy: boolean;
    siDropHot: boolean;

    exportFilterLabel: string;

    activationMessage: string;
    activationBusy: boolean;

    healthRecheckBusy: boolean;

    lookupHeaderValuePlaceholder: string;
    lookupTestBusy: boolean;
    manualAdjustBusy: boolean;

    customerTableStatus: string;

    pinPromptVerifyText: string;
    pinPromptSetupText: string;
}

export const viewState = createStore<ViewState>('viewState', {
    appVersionLabel: '',
    displayRateText: '',
    jankText: '',
    connectionStatus: null,
    connectionText: 'ក្រៅបណ្ដាញ',
    bootSplashPhase: 'shown',
    bootRevealing: false,
    perfLite: false,
    documentTitle: null,

    loginBusy: false,
    backendKind: 'firebase',
    configBackend: 'firebase',
    configManual: false,
    configPendingLink: null,
    loginMode: 'login',

    appLockOpen: false,
    appLockMessage: '',
    appLockToggleText: 'បិទ',
    appLockToggleOn: false,
    appLockBiometricVisible: false,

    biometricToggleText: 'បិទ',
    biometricToggleOn: false,
    biometricUnsupported: false,
    pinBiometricVisible: false,
    pinBiometricBusy: false,

    drawerGroupsOpen: [],
    drawerGroupsHidden: [],
    ztoAutoCloseText: 'បើក',
    ztoAutoCloseOn: false,
    ztoAutoCloseVisible: false,
    ztoListSyncText: 'បិទ',
    ztoListSyncOn: false,
    ztoListSyncDrawerVisible: false,
    ztoListSyncBtnVisible: false,

    selectedFilterTitle: 'ថ្ងៃនេះ',
    historyCountText: '0',
    ztoSyncModalNote: '',
    ztoListSyncNote: '',
    ztoListSyncSite: '',
    dataSummary: {
        grandTotalCount: '0',
        todayTotalCount: '0',
        todayClosedCount: '0',
        todayPackagesPickedUpCount: '0',
        summaryCodDollar: '$0.00',
        summaryCodRiel: '0 ៛',
        summaryDodDollar: '$0.00',
        summaryDodRiel: '0 ៛',
        summaryTotalDollar: '$0.00',
        summaryTotalRiel: '0 ៛',
    },

    cameraView: 'initial',
    cameraZoomDisplay: '',
    cameraTorchDisplay: '',
    cameraOverlayDisplay: '',
    cameraZoomRange: null,
    cameraWebkitInline: false,

    entryModeShown: 'parcel',
    removeScanDetail: 'ស្កេន Barcode ហើយផ្ទៀងផ្ទាត់ព័ត៌មានមុនដក។',
    scanRemoveTexts: {
        scanRemoveBarcodeText: '',
        scanRemovePhoneText: '',
        scanRemoveLockerText: '',
        scanRemoveStateText: '',
        scanRemoveCodText: '',
        scanRemoveDodText: '',
    },
    entryListCountText: '0',
    entryListEmpty: false,
    lockerListEmpty: false,
    activeLockerLabel: '-',

    modalBarcodeText: '',
    phoneModalBusy: false,
    lookupStatus: { kind: '', text: '' },

    listModalPhoneText: '',
    editBcPcText: '',
    callMarkPhoneText: '',
    editModalBarcodeText: '',
    locationWarningText: '',

    siParts: {
        siConfigSummary: false,
        siConfigForm: true,
        siConfigEditRow: false,
        siFileCard: false,
        siMapCard: false,
        siActionCard: false,
        siClearCard: false,
        siPreviewWrap: false,
    },
    siStatusFoot: '',
    siConfigSaving: false,
    siImportBtnDisabled: false,
    siImportBtnText: 'នាំចូលទៅ Sheet',
    siClearBtnBusy: false,
    siDropHot: false,

    exportFilterLabel: 'ថ្ងៃនេះ',
    activationMessage: 'សូមបញ្ចូល Activation Key សម្រាប់ ZoeW ដើម្បីបន្ត។',
    activationBusy: false,
    healthRecheckBusy: false,
    lookupHeaderValuePlaceholder: 'ឧ. Bearer xxxxx ឬ Secret Key',
    lookupTestBusy: false,
    manualAdjustBusy: false,
    customerTableStatus: '',

    pinPromptVerifyText: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បី Config ឬ Reconfig',
    pinPromptSetupText: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការ Config លើកក្រោយ',
});
registerStore(viewState);
viewState.markImmediate(['drawerGroupsOpen', 'drawerGroupsHidden', 'appLockOpen', 'entryModeShown',
    'ztoAutoCloseVisible', 'ztoListSyncDrawerVisible', 'cameraWebkitInline']);

export function domText(value: unknown): string {
    return value === null ? '' : String(value);
}
