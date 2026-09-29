import { cancelLogout, confirmLogout, drawerAuthFlow, drawerBiometricFlow, drawerConfigFlow, drawerCustomerTableFlow, drawerLockerSettingsFlow, drawerLookupApiFlow, submitLoginForm, toggleDrawerGroup } from './actions';
import { drawerAppLockFlow, forgetAppLockPin, runAppLockBiometric, submitAppLockForm } from '../features/app-lock';
import { logoutApp } from '../features/auth';
import { closeEditBarcodeModal, openEditBarcodePriceModal, openViewListModal, saveEditedBarcodePrice, toggleIndividualBarcodeClose } from '../features/barcode-ops';
import { runBiometricUnlock } from '../features/biometric';
import { cancelPinEntryFlow, cancelPinSetupFlow, saveFirebaseConfig } from '../features/config';
import { closeConfigQrScanner, openConfigQrScanner } from '../features/config-qr';
import { fetchCustomerDataTableRows, filterCustomerDataTable } from '../features/customer-table';
import { closeCameraManually, submitManualBarcode } from '../features/daily-stats';
import { handleCallAction, openCallMarkModal, openEditModal, saveEditedPhone, setCallMark, toggleCloseStatus } from '../features/entry-ops';
import { saveExchangeRate } from '../features/exchange-rate';
import { exportDataAsCsvForSheets, exportDataAsExcel, exportDataAsPDF } from '../features/export';
import { openHealthCheck, runHealthCheck } from '../features/health-check';
import { submitActivationKey } from '../features/license';
import { openLockerPicker, saveLockerSettings, selectCustomLocker } from '../features/locker';
import { cancelLocationChange, confirmLocationChange } from '../features/locker-assign';
import { saveLookupApiConfig, testLookupApiConfig } from '../features/lookup-config';
import { exportMonthlyReportAsExcel, exportMonthlyReportAsPDF, renderMonthlyReport } from '../features/monthly-report';
import { decodeImageFile, searchByPhone } from '../features/phone-suggest';
import { saveNewSecurityPin, verifySecurityPin } from '../features/pin';
import { cancelPermanentDelete, executePermanentDelete, executeRestoreItem, promptPermanentDelete } from '../features/restore';
import { confirmPhone } from '../features/scan-action';
import { cancelScannedRemoval, confirmScannedRemoval, setEntryScanMode } from '../features/scan-remove';
import { applySheetImportHeaderRow, closeSheetImportModal, drawerSheetImportFlow, editSheetImportConfig, handleSheetImportFileInput, loadSheetImportSelectedSheet, pickSheetImportFile, renderSheetImportPreview, resetSheetImportFileSelection, runSheetImport, runSheetImportClear, saveSheetImportConfig } from '../features/sheet-import';
import { openCollectedStatsModal, openDailyStatsModal, submitManualAdjustment } from '../features/stats-modals';
import { cancelRestoreItem, closeRecentlyDeletedModal, filterRecentlyDeleted, promptRestoreDeletedItem, showMoreTrashRows, toggleTrashGroup } from '../features/trash';
import { closeZtoListSyncModal, drawerZtoListSyncFlow, importZtoListRows, openZtoListSyncModal, runZtoListSyncPreview } from '../features/zto-list-sync';
import { closeZtoSyncModal, drawerZtoAutoCloseFlow, openZtoSyncModal, recheckZtoPickupStatus } from '../features/zto-status';
import { requestCameraPermission, toggleTorch } from '../services/camera';
import { debouncedSearchByPhone } from '../services/scan-engine';
import { renderEntryList, renderLockerList } from '../ui/entry-list';
import { closeModal, dismissPhoneModal } from '../ui/modal';
import { filterDataByCustomDate, filterDataByDate, moreMenuClearHistory, moreMenuDelete, moreMenuEditPhone, moreMenuExchangeRate, moreMenuExport, moreMenuManualAdjust, moreMenuMonthlyReport, moreMenuRecentlyDeleted, moreMenuResetPickup, moreMenuViewList, toggleHeaderMoreDropdown, toggleMoreDropdown } from '../ui/more-menu';
import { closeSideDrawer, openSideDrawer, switchAppPage } from '../ui/page-nav';
import { openNotifyDrawer } from '../features/notifications';
import { togglePush } from '../features/push';

export const ACTION_REGISTRY: Record<string, (...args: any[]) => any> = Object.freeze({
    applySheetImportHeaderRow,
    cancelLocationChange,
    cancelLogout,
    cancelPermanentDelete,
    cancelPinEntryFlow,
    cancelPinSetupFlow,
    cancelRestoreItem,
    cancelScannedRemoval,
    closeCameraManually,
    closeConfigQrScanner,
    closeEditBarcodeModal,
    closeModal,
    closeRecentlyDeletedModal,
    closeSheetImportModal,
    closeSideDrawer,
    closeZtoListSyncModal,
    closeZtoSyncModal,
    confirmLocationChange,
    confirmLogout,
    confirmPhone,
    confirmScannedRemoval,
    debouncedSearchByPhone,
    decodeImageFile,
    dismissPhoneModal,
    drawerAppLockFlow,
    drawerAuthFlow,
    drawerBiometricFlow,
    drawerConfigFlow,
    drawerCustomerTableFlow,
    drawerLockerSettingsFlow,
    drawerLookupApiFlow,
    drawerSheetImportFlow,
    drawerZtoAutoCloseFlow,
    drawerZtoListSyncFlow,
    editSheetImportConfig,
    executePermanentDelete,
    executeRestoreItem,
    exportDataAsCsvForSheets,
    exportDataAsExcel,
    exportDataAsPDF,
    exportMonthlyReportAsExcel,
    exportMonthlyReportAsPDF,
    fetchCustomerDataTableRows,
    filterCustomerDataTable,
    filterDataByCustomDate,
    filterDataByDate,
    filterRecentlyDeleted,
    forgetAppLockPin,
    handleCallAction,
    handleSheetImportFileInput,
    importZtoListRows,
    loadSheetImportSelectedSheet,
    logoutApp,
    moreMenuClearHistory,
    moreMenuDelete,
    moreMenuEditPhone,
    moreMenuExchangeRate,
    moreMenuExport,
    moreMenuManualAdjust,
    moreMenuMonthlyReport,
    moreMenuRecentlyDeleted,
    moreMenuResetPickup,
    moreMenuViewList,
    openCallMarkModal,
    openCollectedStatsModal,
    openConfigQrScanner,
    openDailyStatsModal,
    openEditBarcodePriceModal,
    openEditModal,
    openHealthCheck,
    openLockerPicker,
    openNotifyDrawer,
    togglePush,
    openSideDrawer,
    openViewListModal,
    openZtoListSyncModal,
    openZtoSyncModal,
    pickSheetImportFile,
    promptPermanentDelete,
    promptRestoreDeletedItem,
    recheckZtoPickupStatus,
    renderEntryList,
    renderLockerList,
    renderMonthlyReport,
    renderSheetImportPreview,
    requestCameraPermission,
    resetSheetImportFileSelection,
    runAppLockBiometric,
    runBiometricUnlock,
    runHealthCheck,
    runSheetImport,
    runSheetImportClear,
    runZtoListSyncPreview,
    saveEditedBarcodePrice,
    saveEditedPhone,
    saveExchangeRate,
    saveFirebaseConfig,
    saveLockerSettings,
    saveLookupApiConfig,
    saveNewSecurityPin,
    saveSheetImportConfig,
    searchByPhone,
    selectCustomLocker,
    setCallMark,
    setEntryScanMode,
    showMoreTrashRows,
    submitActivationKey,
    submitAppLockForm,
    submitLoginForm,
    submitManualAdjustment,
    submitManualBarcode,
    switchAppPage,
    testLookupApiConfig,
    toggleCloseStatus,
    toggleDrawerGroup,
    toggleHeaderMoreDropdown,
    toggleIndividualBarcodeClose,
    toggleMoreDropdown,
    toggleTorch,
    toggleTrashGroup,
    verifySecurityPin,
});

export const ACTION_NAMES: readonly string[] = Object.freeze(Object.keys(ACTION_REGISTRY));

export function lookupAction(name: string): ((...args: any[]) => any) | null {
    if (!name || !Object.prototype.hasOwnProperty.call(ACTION_REGISTRY, name)) return null;
    const fn = ACTION_REGISTRY[name];
    return typeof fn === 'function' ? fn : null;
}
