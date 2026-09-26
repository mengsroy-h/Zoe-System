import { BootSplash } from './BootSplash';
import { AppLockScreen } from './AppLockScreen';
import { RecentPhonesDatalist } from './RecentPhonesDatalist';
import { AppNavbar } from './AppNavbar';
import { AppPages } from './AppPages';
import { PageTabBar } from './PageTabBar';
import { DrawerBackdrop } from './DrawerBackdrop';
import { SideDrawer } from './SideDrawer';
import { PinModal } from './modals/PinModal';
import { PinSetupModal } from './modals/PinSetupModal';
import { ConfigModal } from './modals/ConfigModal';
import { ConfigQrScanModal } from './modals/ConfigQrScanModal';
import { LookupApiConfigModal } from './modals/LookupApiConfigModal';
import { SheetImportModal } from './modals/SheetImportModal';
import { ExchangeRateModal } from './modals/ExchangeRateModal';
import { LoginModal } from './modals/LoginModal';
import { ManualAdjustModal } from './modals/ManualAdjustModal';
import { PhoneModal } from './modals/PhoneModal';
import { ScanRemoveModal } from './modals/ScanRemoveModal';
import { ZtoSyncModal } from './modals/ZtoSyncModal';
import { ZtoListSyncModal } from './modals/ZtoListSyncModal';
import { EditPhoneModal } from './modals/EditPhoneModal';
import { CallMarkModal } from './modals/CallMarkModal';
import { EditBarcodePriceModal } from './modals/EditBarcodePriceModal';
import { ViewListModal } from './modals/ViewListModal';
import { DailyStatsModal } from './modals/DailyStatsModal';
import { CollectedStatsModal } from './modals/CollectedStatsModal';
import { CustomerDataTableModal } from './modals/CustomerDataTableModal';
import { RecentlyDeletedModal } from './modals/RecentlyDeletedModal';
import { RestoreWarningModal } from './modals/RestoreWarningModal';
import { LogoutConfirmModal } from './modals/LogoutConfirmModal';
import { PermanentDeleteWarningModal } from './modals/PermanentDeleteWarningModal';
import { ExportDataModal } from './modals/ExportDataModal';
import { MonthlyReportModal } from './modals/MonthlyReportModal';
import { PhoneSuggestBox } from './PhoneSuggestBox';
import { GlobalMoreMenu } from './GlobalMoreMenu';
import { ActivationModal } from './modals/ActivationModal';
import { HealthCheckModal } from './modals/HealthCheckModal';
import { LockerPickerModal } from './modals/LockerPickerModal';
import { LockerSettingsModal } from './modals/LockerSettingsModal';
import { LocationWarningModal } from './modals/LocationWarningModal';
import { ToastContainer } from './ToastContainer';
import { PdfExportPrintArea } from './PdfExportPrintArea';

export function AppShell() {
    return (
        <>
            <BootSplash />
            <AppLockScreen />
            <RecentPhonesDatalist />
            <AppNavbar />
            <AppPages />
            <PageTabBar />
            <DrawerBackdrop />
            <SideDrawer />
            <PinModal />
            <PinSetupModal />
            <ConfigModal />
            <ConfigQrScanModal />
            <LookupApiConfigModal />
            <SheetImportModal />
            <ExchangeRateModal />
            <LoginModal />
            <ManualAdjustModal />
            <PhoneModal />
            <ScanRemoveModal />
            <ZtoSyncModal />
            <ZtoListSyncModal />
            <EditPhoneModal />
            <CallMarkModal />
            <EditBarcodePriceModal />
            <ViewListModal />
            <DailyStatsModal />
            <CollectedStatsModal />
            <CustomerDataTableModal />
            <RecentlyDeletedModal />
            <RestoreWarningModal />
            <LogoutConfirmModal />
            <PermanentDeleteWarningModal />
            <ExportDataModal />
            <MonthlyReportModal />
            <PhoneSuggestBox />
            <GlobalMoreMenu />
            <ActivationModal />
            <HealthCheckModal />
            <LockerPickerModal />
            <LockerSettingsModal />
            <LocationWarningModal />
            <ToastContainer />
            <PdfExportPrintArea />
        </>
    );
}
