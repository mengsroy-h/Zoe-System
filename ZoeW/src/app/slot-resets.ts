import { dataState, lookupState, uiState, ztoState } from '../core/state';
import { emptySheetImportView } from './components/sheet/model';

/**
 * ⛔ ឯកសារនេះ **ផលិតដោយ `tools/html-to-jsx.cjs`** — កុំកែដោយដៃ។
 *
 * ធាតុដែល React ជាម្ចាស់ ត្រូវសម្អាតតាម **store** មិនមែនតាម DOM ៖
 * `el.textContent = ''` ដកកូនរបស់ React ពីក្រោមវា ➜ ការគូរបន្ទាប់ធ្លាក់
 * (`removeChild`) ➜ App ស ហើយទិន្នន័យអតិថិជនដែលនៅក្នុង store ត្រឡប់មកវិញ។
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

/** សម្អាតធាតុតាម store បើ React ជាម្ចាស់វា ➜ `true`; បើមិនមែន ➜ `false` (អ្នកហៅសម្អាត DOM ខ្លួនឯង) */
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
