import { createStore, registerStore } from './store';

/**
 * **អ្វីដែលអ្នកប្រើឃើញលើអេក្រង់** — អត្ថបទ · ពណ៌ · ការបង្ហាញ/លាក់ · ប៊ូតុងដែល
 * បិទ — ដែលកូដមុខងារសម្រេច ហើយ component របស់ React គូរ។
 *
 * ⛔ ច្បាប់ React ១០០% ៖ កូដក្នុង `core` · `domain` · `features` · `services` ·
 *    `ui` · `platform` **មិនប៉ះ DOM ទេ** — វាសរសេរវាលនៅទីនេះ ហើយ JSX អានវា
 *    (`npm run purity:check`)។
 * ⛔ វាលរៀបតាម **មុខងារ** (បុព្វបទ `appLock…` · `biometric…` …) ហើយរាបស្មើ
 *    (flat) ៖ Proxy របស់ឃ្លាំងចាប់តែការសរសេរ *កម្រិតកំពូល* ➜ វត្ថុខាងក្នុងដែល
 *    កែនៅនឹងកន្លែង នឹងមិនគូរឡើងវិញទេ។
 * ⛔ វាលថ្មី ៖ បន្ថែមទាំង interface និងតម្លៃដើម — តម្លៃដើមត្រូវ **ដូច markup
 *    ដើម** (អត្ថបទ/class ដែល `index.html` ដើមមានមុនកូដណារត់)។
 */
/** អត្ថបទក្នុងប្រអប់ «ស្កេនដកកញ្ចប់» (តាម id ក្នុង markup) */
export type ScanRemoveTextId = 'scanRemoveBarcodeText' | 'scanRemovePhoneText' | 'scanRemoveLockerText'
    | 'scanRemoveStateText' | 'scanRemoveCodText' | 'scanRemoveDodText';

export type EntryMode = 'parcel' | 'locker' | 'remove';

export type DataSummaryId = 'grandTotalCount' | 'todayTotalCount' | 'todayClosedCount' | 'todayPackagesPickedUpCount'
    | 'summaryCodDollar' | 'summaryCodRiel' | 'summaryDodDollar' | 'summaryDodRiel' | 'summaryTotalDollar' | 'summaryTotalRiel';

export interface ViewState {
    /** «កំណែប្រព័ន្ធ: X» (`[data-app-version]`) — គូរក្រោយ boot ដូចដើម */
    appVersionLabel: string;

    /* ── របាខាងលើ ៖ ស្ថានភាពការតភ្ជាប់ ── */
    /** `null` = មិនទាន់គូរ (markup ៖ ចំណុច `offline` · អត្ថបទគ្មាន class) */
    connectionStatus: 'online' | 'connecting' | 'offline' | null;
    connectionText: string;

    /* ── ផ្ទាំងបើក ── */
    /** `'shown'` ➜ `'out'` (រសាត់) ➜ `'gone'` */
    bootSplashPhase: 'shown' | 'out' | 'gone';
    /** `body.boot-reveal` អំឡុងចលនាបង្ហាញ App */
    bootRevealing: boolean;
    /** `body.perf-lite` ពេលឧបករណ៍ធ្លាក់ស៊ុមច្រើន */
    perfLite: boolean;
    /** `document.title` ជំនួស (Export PDF) — `null` = ចំណងជើងដើម */
    documentTitle: string | null;

    /* ── ចូលប្រព័ន្ធ ── */
    /** ប៊ូតុង «ចូលប្រព័ន្ធ» កំពុងរង់ចាំ Firebase (បិទ + «កំពុងចូល...») */
    loginBusy: boolean;

    /* ── ចាក់សោ App ── */
    appLockOpen: boolean;
    appLockMessage: string;
    appLockToggleText: string;
    appLockToggleOn: boolean;
    appLockBiometricVisible: boolean;

    /* ── ជីវមាត្រ ── */
    biometricToggleText: string;
    biometricToggleOn: boolean;
    biometricUnsupported: boolean;
    /** ប៊ូតុងស្កេនក្នុងប្រអប់ PIN (បង្ហាញតែពេលបើកជីវមាត្រ) */
    pinBiometricVisible: boolean;
    /** ប៊ូតុងស្កេនក្នុងប្រអប់ PIN កំពុងរង់ចាំ */
    pinBiometricBusy: boolean;

    /* ── របា Slide ── */
    /** Category ដែលពន្លា (`zoew_drawer_groups_v1`) */
    drawerGroupsOpen: string[];
    /** Category ដែលធាតុទាំងអស់លាក់ ➜ លាក់ទាំងក្បាល — សរសេរ **តែ** ដោយ `refreshDrawerGroups()` (ដូចដើម ៖ ពេលបើករបា Slide) */
    drawerGroupsHidden: string[];
    ztoAutoCloseText: string;
    ztoAutoCloseOn: boolean;
    /** កុងតាក់ ZTO លេចតែពេល Fast Mode គូស */
    ztoAutoCloseVisible: boolean;
    ztoListSyncText: string;
    ztoListSyncOn: boolean;
    ztoListSyncDrawerVisible: boolean;
    /** ប៊ូតុង «ទាញបញ្ជី ZTO» លើរបាប្រវត្តិ */
    ztoListSyncBtnVisible: boolean;

    /* ── ទំព័រទិន្នន័យ ── */
    selectedFilterTitle: string;
    /** ចំនួនជួរដេកក្នុងតារាងប្រវត្តិ (`#count`) */
    historyCountText: string;
    ztoSyncModalNote: string;
    ztoListSyncNote: string;
    /** តួលេខ «គ្រប់គ្រងប្រចាំថ្ងៃ» (id ក្នុង markup ➜ អត្ថបទ) */
    dataSummary: Record<DataSummaryId, string>;

    /* ── កាមេរ៉ា ── */
    /** `'initial'` (markup) · `'live'` (វីដេអូ) · `'closed'` (ប្រអប់ «កាមេរ៉ាបានបិទ») */
    cameraView: 'initial' | 'live' | 'closed';
    /** `display` របស់ zoom · ពិល · overlay (`''` = មិនដែលកំណត់ ➜ CSS) */
    cameraZoomDisplay: '' | 'none' | 'flex';
    cameraTorchDisplay: '' | 'none' | 'flex';
    cameraOverlayDisplay: '' | 'none' | 'flex';
    cameraZoomRange: { min: number; max: number; step: number } | null;

    /* ── ទំព័រស្កេន ── */
    /**
     * របៀបដែល **បង្ហាញ** (ប៊ូតុង · ផ្ទាំង · ស្លាក) — ⛔ ដាច់ពី
     * `uiState.entryScanMode` ដោយចេតនា ៖ App ដើមគូររបៀបតែពេល
     * `setEntryScanMode()` រត់ (ពេលចូលទំព័រស្កេន) មិនមែនពេល boot ទេ។
     */
    entryModeShown: EntryMode;
    removeScanDetail: string;
    scanRemoveTexts: Record<ScanRemoveTextId, string>;
    entryListCountText: string;
    entryListEmpty: boolean;
    lockerListEmpty: boolean;
    activeLockerLabel: string;

    /* ── ប្រអប់ស្កេន (phoneModal) ── */
    modalBarcodeText: string;
    /** ប៊ូតុងទាំង ៤ បិទ ខណៈកំពុងរក្សាទុក */
    phoneModalBusy: boolean;
    /** `#lookupStatus` ៖ `kind` = class បន្ថែម (`''` ➜ លាក់) */
    lookupStatus: { kind: string; text: string };

    /* ── ប្រអប់កែ · ខល · បញ្ជី barcode · ទីតាំង ── */
    listModalPhoneText: string;
    editBcPcText: string;
    callMarkPhoneText: string;
    editModalBarcodeText: string;
    locationWarningText: string;

    /* ── នាំចូល Excel ទៅ Sheet (ផ្ទៃដែលមិនស្ថិតក្នុង `uiState.sheetImportView`) ── */
    /** ផ្នែកដែលបង្ហាញ (id ➜ បង្ហាញ) — លំនាំដើមដូច markup */
    siParts: Record<string, boolean>;
    siStatusFoot: string;
    siConfigSaving: boolean;
    siImportBtnDisabled: boolean;
    siImportBtnText: string;
    siClearBtnBusy: boolean;
    siDropHot: boolean;

    /** ស្លាកតម្រងក្នុងប្រអប់ Export (`#exportFilterLabel`) */
    exportFilterLabel: string;

    /* ── License ── */
    activationMessage: string;
    /** ប៊ូតុង «ដាក់ Active» កំពុងផ្ទៀងផ្ទាត់ */
    activationBusy: boolean;

    /** ប៊ូតុង «ពិនិត្យម្តងទៀត» (🩺) ខណៈកំពុងពិនិត្យ */
    healthRecheckBusy: boolean;

    /* ── API ស្វែងរកអតិថិជន · កែស្ថិតិដោយដៃ ── */
    lookupHeaderValuePlaceholder: string;
    /** ប៊ូតុង «🧪 សាកល្បង» កំពុងរង់ចាំ */
    lookupTestBusy: boolean;
    /** ប៊ូតុងរក្សាទុកក្នុង «កែទឹកប្រាក់/កញ្ចប់» បិទ (ក្រោយចុចម្តង) */
    manualAdjustBusy: boolean;

    /* ── តារាងអតិថិជន ── */
    customerTableStatus: string;

    /* ── ប្រអប់ PIN (`PIN_PROMPT_MESSAGES`) ── */
    pinPromptVerifyText: string;
    pinPromptSetupText: string;
}

export const viewState = createStore<ViewState>('viewState', {
    appVersionLabel: '',
    connectionStatus: null,
    connectionText: 'ក្រៅបណ្ដាញ',
    bootSplashPhase: 'shown',
    bootRevealing: false,
    perfLite: false,
    documentTitle: null,

    loginBusy: false,

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

/**
 * ការបម្លែងដូច setter `textContent`/`innerText` របស់ DOM បេះបិទ ៖ `null` ➜ `''` ·
 * ផ្សេងទៀត ➜ `String(value)` (`undefined` ➜ «undefined» · លេខ ➜ អក្សរ)។
 *
 * ⛔ App ដើមសរសេរ `el.innerText = item.barcode` ➜ ធាតុចាស់ដែលគ្មានវាល `barcode`
 *    បង្ហាញ «undefined»; JSX គូរ `{undefined}` ជា **ទទេ** ➜ ឥរិយាបថខុស (វាស់បាន ៖
 *    `parity:deep` ៤០ ជំហាន)។ ប្រើ helper នេះពេលតម្លៃមកពី **ទិន្នន័យ** (`item.*`)។
 */
export function domText(value: unknown): string {
    return value === null ? '' : String(value);
}
