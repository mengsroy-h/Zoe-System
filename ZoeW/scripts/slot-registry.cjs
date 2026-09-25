'use strict';
/**
 * បញ្ជី slot របស់ React — ធាតុដែល React ជាម្ចាស់ *មាតិកា* (slot) ឬ *ធាតុទាំងមូល* (element slot)។
 *
 * ⛔ ជាប្រភពនៃការវាស់ ២ ៖ `slot-ownership-check.mjs` (កូដ imperative មិនត្រូវប៉ះកូនរបស់វា) និង
 *    `doc-check.mjs` (តារាងក្នុង `docs/ARCHITECTURE.md`)។ ⛔ វាមិនមែនបញ្ជីរឹងឯករាជ្យទេ ៖
 *    `slot-ownership-check.mjs` ផ្ទៀងផ្ទាត់ថា (១) id ទាំងអស់ស្មើ `REACT_OWNED_IDS` ក្នុង
 *    `src/app/slot-resets.ts` (ការសម្អាតតាម store) ទាំង ២ ទិស និង (២) `component` នីមួយៗ export ពិតពី
 *    `src/app/components/<from>.tsx` ➜ slot ថ្មីដែលភ្លេចចុះឈ្មោះ ឬឈ្មោះដែលលែងមាន ➜ ធ្លាក់។
 */
const SLOTS = {
    historyTableBody: { component: 'HistoryTableBody', from: 'history/HistoryTableBody' },
    entryListTableBody: { component: 'EntryListTableBody', from: 'entry/EntryListTableBody' },
    lockerListTableBody: { component: 'LockerListTableBody', from: 'entry/LockerListTableBody' },
    trashSummaryBox: { component: 'TrashSummaryBox', from: 'trash/TrashSummaryBox' },
    deletedTableBody: { component: 'TrashTableBody', from: 'trash/TrashTableBody' },
    monthlyReportBody: { component: 'MonthlyReportBody', from: 'reports/MonthlyReportBody' },
    dailyStatsContainer: { component: 'DailyStatsCards', from: 'stats/StatsCards' },
    collectedStatsContainer: { component: 'CollectedStatsCards', from: 'stats/StatsCards' },
    customerDataTableBody: { component: 'CustomerTableBody', from: 'customer/CustomerTableBody' },
    healthCheckList: { component: 'HealthCheckList', from: 'health/HealthCheckList' },
    barcodeListContainer: { component: 'BarcodeListContainer', from: 'barcode/BarcodeListContainer' },
    lockerGrid: { component: 'LockerGrid', from: 'locker/LockerGrid' },
    menuContentContainer: { component: 'MoreMenuContent', from: 'menu/MoreMenuContent' },
    phoneSuggestBox: { component: 'PhoneSuggestList', from: 'suggest/PhoneSuggestList' },
    recentPhonesList: { component: 'RecentPhonesOptions', from: 'RecentPhonesOptions' },
    ztoSyncBanner: { component: 'ZtoSyncBanner', from: 'zto/ZtoSyncBanner' },
    ztoSyncList: { component: 'ZtoSyncList', from: 'zto/ZtoSyncList' },
    ztoListSyncBody: { component: 'ZtoListSyncBody', from: 'zto/ZtoListSyncBody' },
    pdfExportPrintArea: { component: 'PdfPrintArea', from: 'PdfPrintArea' },
    toastContainer: { component: 'ToastList', from: 'toast/ToastList' },
    siConfigSummary: { component: 'SiConfigSummary', from: 'sheet/SheetImportParts' },
    siConfigMsg: { component: 'SiConfigMsg', from: 'sheet/SheetImportParts' },
    siFileMsg: { component: 'SiFileMsg', from: 'sheet/SheetImportParts' },
    siMapMsg: { component: 'SiMapMsg', from: 'sheet/SheetImportParts' },
    siActionMsg: { component: 'SiActionMsg', from: 'sheet/SheetImportParts' },
    siClearMsg: { component: 'SiClearMsg', from: 'sheet/SheetImportParts' },
    siChips: { component: 'SiChips', from: 'sheet/SheetImportParts' },
    siPreviewBody: { component: 'SiPreviewBody', from: 'sheet/SheetImportParts' }
};

/** element slot ៖ form control ដែលតម្លៃជា *state* (React គូរធាតុទាំងមូល) */
const ELEMENT_SLOTS = {
    monthlyReportMonthSel: { component: 'MonthlyReportMonthSelect', from: 'reports/MonthlyReportMonthSelect' },
    lockerListFilter: { component: 'LockerListFilterSelect', from: 'entry/LockerListFilterSelect' },
    siSheetSel: { component: 'SiSheetSelect', from: 'sheet/SheetImportSelects' },
    siMapBarcode: { component: 'SiMapBarcode', from: 'sheet/SheetImportSelects' },
    siMapDod: { component: 'SiMapDod', from: 'sheet/SheetImportSelects' },
    siMapCod: { component: 'SiMapCod', from: 'sheet/SheetImportSelects' },
    siMapPhone: { component: 'SiMapPhone', from: 'sheet/SheetImportSelects' }
};

module.exports = { SLOTS, ELEMENT_SLOTS };
