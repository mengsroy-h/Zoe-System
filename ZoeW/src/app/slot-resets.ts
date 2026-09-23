import { dataState, lookupState, uiState, ztoState } from '../core/state';
import { viewState, type ScanRemoveTextId } from '../core/view-state';
import { emptySheetImportView } from './components/sheet/model';
import { REF_NAMES, setFieldValue, type RefName } from './refs';

/**
 * ការសម្អាតធាតុតាម **id** (`clearSensitiveModalFields()` ៖ បញ្ជី `fieldsToBlank`)
 * ត្រូវឆ្លងកាត់ **state/ref** មិនមែន DOM ៖ `el.textContent = ''` ដកកូនរបស់ React
 * ពីក្រោមវា ➜ ការគូរបន្ទាប់ធ្លាក់ (`removeChild`) ➜ App ស ហើយទិន្នន័យអតិថិជន
 * ដែលនៅក្នុង store ត្រឡប់មកវិញ។
 *
 * ⛔ id ថ្មីក្នុង `fieldsToBlank` ត្រូវមានផ្លូវមួយខាងក្រោម (list · input · អត្ថបទ)
 *    បើអត់ `blankElementById()` ត្រឡប់ `false` ➜ `npm test` ធ្លាក់។
 */
export const REACT_OWNED_IDS: readonly string[] = ["historyTableBody","entryListTableBody","lockerListTableBody","trashSummaryBox","deletedTableBody","monthlyReportBody","dailyStatsContainer","collectedStatsContainer","customerDataTableBody","healthCheckList","barcodeListContainer","lockerGrid","menuContentContainer","phoneSuggestBox","recentPhonesList","ztoSyncBanner","ztoSyncList","ztoListSyncBody","pdfExportPrintArea","toastContainer","siConfigSummary","siConfigMsg","siFileMsg","siMapMsg","siActionMsg","siClearMsg","siChips","siPreviewBody","monthlyReportMonthSel","lockerListFilter","siSheetSel","siMapBarcode","siMapDod","siMapCod","siMapPhone"];

function sheetPatch(patch: any) {
    uiState.sheetImportView = Object.assign({}, uiState.sheetImportView || emptySheetImportView(), patch);
}

function sheetMsgClear(id: string) {
    const msgs = Object.assign({}, (uiState.sheetImportView || emptySheetImportView()).msgs);
    msgs[id] = null;
    sheetPatch({ msgs: msgs });
}

function sheetMapClear(id: string) {
    const mapping = Object.assign({}, (uiState.sheetImportView || emptySheetImportView()).mapping);
    delete mapping[id];
    sheetPatch({ mapping: mapping });
}

/** អត្ថបទសុទ្ធដែល JSX អានពី `viewState` (id ➜ ការកំណត់ជា `''`) */
const TEXT_BLANKERS: Record<string, () => void> = {
    listModalPhoneText: () => { viewState.listModalPhoneText = ''; },
    callMarkPhoneText: () => { viewState.callMarkPhoneText = ''; },
    editBcPcText: () => { viewState.editBcPcText = ''; },
    editModalBarcodeText: () => { viewState.editModalBarcodeText = ''; },
    modalBarcodeText: () => { viewState.modalBarcodeText = ''; },
    locationWarningText: () => { viewState.locationWarningText = ''; },
    entryListCount: () => { viewState.entryListCountText = ''; },
    removeScanBannerDetail: () => { viewState.removeScanDetail = ''; },
    hardwareScannerLabel: () => { /* ស្លាកដេរីវេពី `viewState.entryModeShown` (កំណត់ជា parcel ក្នុងផ្លូវដដែល) */ },
    siStatusFoot: () => { viewState.siStatusFoot = ''; },
    appLockMsg: () => { viewState.appLockMessage = ''; },
    ztoListSyncNote: () => { viewState.ztoListSyncNote = ''; },
};

function blankScanRemoveText(id: ScanRemoveTextId): void {
    viewState.scanRemoveTexts = Object.assign({}, viewState.scanRemoveTexts, { [id]: '' });
}

/**
 * សម្អាតធាតុមួយតាម id ៖ បញ្ជីរបស់ React (store) · input (ref) · អត្ថបទ (`viewState`)។
 * ត្រឡប់ `false` ពេល id មិនស្គាល់ (➜ តេស្តធ្លាក់ មិនមែនបាត់ស្ងាត់)។
 */
export function blankElementById(id: string): boolean {
    if (resetReactOwned(id)) return true;
    if ((REF_NAMES as readonly string[]).indexOf(id) !== -1) {
        setFieldValue(id as RefName, '');
        return true;
    }
    if (TEXT_BLANKERS[id]) { TEXT_BLANKERS[id](); return true; }
    if (id in viewState.scanRemoveTexts) { blankScanRemoveText(id as ScanRemoveTextId); return true; }
    return false;
}

/** សម្អាតធាតុតាម store បើ React ជាម្ចាស់វា ➜ `true`; បើមិនមែន ➜ `false` */
export function resetReactOwned(id: string): boolean {
    switch (id) {
        case 'historyTableBody': uiState.historyView = null; return true;
        case 'entryListTableBody': uiState.entryListView = null; return true;
        case 'lockerListTableBody': uiState.lockerListView = null; return true;
        case 'trashSummaryBox': uiState.trashSummary = null; return true;
        case 'deletedTableBody': uiState.trashView = null; return true;
        case 'monthlyReportBody': uiState.monthlyReportView = null; return true;
        case 'dailyStatsContainer': uiState.dailyStatsView = null; return true;
        case 'collectedStatsContainer': uiState.collectedStatsView = null; return true;
        case 'customerDataTableBody': lookupState.customerTableView = null; return true;
        case 'healthCheckList': uiState.healthRows = null; return true;
        case 'barcodeListContainer': uiState.viewListView = null; return true;
        case 'lockerGrid': uiState.lockerGridView = null; return true;
        case 'menuContentContainer': uiState.moreMenuItems = null; return true;
        case 'phoneSuggestBox': uiState.phoneSuggestItems = []; uiState.phoneSuggestActiveIndex = -1; return true;
        case 'recentPhonesList': dataState.recentPhonesOptions = []; return true;
        case 'ztoSyncBanner': ztoState.ztoBannerView = null; return true;
        case 'ztoSyncList': ztoState.ztoSyncListView = null; return true;
        case 'ztoListSyncBody': ztoState.ztoListPreview = null; return true;
        case 'pdfExportPrintArea': uiState.pdfExportView = null; return true;
        case 'toastContainer': uiState.toasts = []; return true;
        case 'siConfigSummary': sheetPatch({ summary: null }); return true;
        case 'siConfigMsg': sheetMsgClear('siConfigMsg'); return true;
        case 'siFileMsg': sheetMsgClear('siFileMsg'); return true;
        case 'siMapMsg': sheetMsgClear('siMapMsg'); return true;
        case 'siActionMsg': sheetMsgClear('siActionMsg'); return true;
        case 'siClearMsg': sheetMsgClear('siClearMsg'); return true;
        case 'siChips': sheetPatch({ chips: [] }); return true;
        case 'siPreviewBody': sheetPatch({ previewRows: [] }); return true;
        case 'monthlyReportMonthSel': uiState.monthlyReportMonths = []; uiState.monthlyReportMonth = ''; return true;
        case 'lockerListFilter': uiState.lockerFilterOptions = []; uiState.lockerFilterValue = ''; return true;
        case 'siSheetSel': sheetPatch({ sheetNames: [], sheetValue: '' }); return true;
        case 'siMapBarcode': sheetMapClear('siMapBarcode'); return true;
        case 'siMapDod': sheetMapClear('siMapDod'); return true;
        case 'siMapCod': sheetMapClear('siMapCod'); return true;
        case 'siMapPhone': sheetMapClear('siMapPhone'); return true;
    }
    return false;
}
