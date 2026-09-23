import { runOnWindowLoad } from '../core/lifecycle';
import { scanState, uiState } from '../core/state';
import { renderAppVersionLabels, setupActionDelegation } from '../core/actions';
import { elapsedSince } from '../core/elapsed';
import { safeFocusScanner } from '../core/timezone';
import { resumeInterruptedCleanups, runScheduledCleanup } from '../domain/cleanup';
import { initAppLock } from '../features/app-lock';
import { initBiometricUi } from '../features/biometric';
import { applySetupLinkFromUrl } from '../features/config';
import { prefetchCustomerDataTableRowsIfConfigured } from '../features/customer-table';
import { CUSTOMER_TABLE_CACHE_MS } from '../features/customer-table-prefetch';
import { setupHardwareScanner, setupVisibilityHandling } from '../features/daily-stats';
import { LICENSE_RECHECK_INTERVAL_MS, runPeriodicLicenseCheck } from '../features/license';
import { warmZtoLookupProxyNow } from '../features/lookup-api';
import { setupPhoneSuggestions } from '../features/phone-suggest';
import { runSessionExpiryCheck } from '../features/session';
import { setupSheetImportDropZone } from '../features/sheet-import';
import { refreshZtoListSyncUi } from '../features/zto-list-sync';
import { refreshZtoAutoCloseUi, renderZtoSyncViews, scheduleZtoStatusSweep } from '../features/zto-status';
import { setupConnectionRecovery } from '../services/connection';
import { restoreLookupSecretKey } from '../services/crypto';
import { updateRecentPhonesList } from '../services/db-listeners';
import { initFirebase } from '../services/firebase-init';
import { NATIVE_SCAN_FORMAT_NAMES, initScanEngine, scanEngineReady } from '../services/scan-engine';
import { revealAppAfterBoot, showUpdateAvailableBanner } from '../ui/boot-splash';
import { setupChromeAutoHide } from '../ui/chrome-autohide';
import { sweepRecallHighlights } from '../ui/history-refresh';
import { cleanupResources } from '../ui/modal';
import { dismissModal, topmostModal } from '../ui/modal-stack';
import { closeGlobalMoreMenu, dismissGlobalMoreMenuOutside } from '../ui/more-menu';
import { closeSideDrawer, isSideDrawerOpen, switchAppPage } from '../ui/page-nav';
import { setupSwipeGestures } from '../ui/panel-motion';
import { setupAdaptivePerformance } from '../ui/perf';
import { setupIOSPullToRefresh } from '../ui/pull-to-refresh';
import { showToast } from '../ui/toast';

export function runLegacyBootstrapStatements() {
    renderAppVersionLabels();

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => { window.scrollTo(0, 0); });
    }

    setupActionDelegation();

    if ('serviceWorker' in navigator) {
        runOnWindowLoad(() => {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
                const SW_UPDATE_MIN_GAP_MS = 15 * 60 * 1000;
                let lastSwUpdateAt = Date.now();
                const throttledSwUpdate = () => {
                    if ((navigator.onLine as boolean) === false) return;
                    if (elapsedSince(lastSwUpdateAt) < SW_UPDATE_MIN_GAP_MS) return;
                    lastSwUpdateAt = Date.now();
                    reg.update().catch(() => {});
                };
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') throttledSwUpdate();
                });
                window.addEventListener('focus', throttledSwUpdate);
                window.addEventListener('online', throttledSwUpdate);
                setInterval(throttledSwUpdate, 30 * 60 * 1000);
            }).catch(() => {});

            const hadControllerAtLoad = !!navigator.serviceWorker.controller;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (hadControllerAtLoad) showUpdateAvailableBanner();
            });
        });
    }

    window.addEventListener('beforeunload', cleanupResources);

    initAppLock();

    restoreLookupSecretKey().then((restored) => {
        if (!restored) return;
        renderZtoSyncViews();
        scheduleZtoStatusSweep();
    }, () => {});

    runOnWindowLoad(function () {
        if (window.ZoeErrors) ZoeErrors.init('zoew');
        if (window.ZoeLicense) window.ZoeLicense.syncServerTime().catch(() => {});
        applySetupLinkFromUrl();
        initFirebase();
        refreshZtoAutoCloseUi();
        refreshZtoListSyncUi();
        prefetchCustomerDataTableRowsIfConfigured();

        setInterval(() => {
            prefetchCustomerDataTableRowsIfConfigured();
        }, CUSTOMER_TABLE_CACHE_MS);

        setInterval(runSessionExpiryCheck, 60000);

        setInterval(runPeriodicLicenseCheck, LICENSE_RECHECK_INTERVAL_MS);

        setInterval(sweepRecallHighlights, 60000);
        setInterval(() => {
            runScheduledCleanup();
            resumeInterruptedCleanups();
            scheduleZtoStatusSweep();
        }, 60000);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            sweepRecallHighlights();
            runScheduledCleanup();
            resumeInterruptedCleanups();
            scheduleZtoStatusSweep();
            if (uiState.currentAppPage === 'entry') warmZtoLookupProxyNow();
        });

        (function waitForZXingThenInitScanEngine(deadline) {
            deadline = deadline || (Date.now() + 15000);
            if (scanEngineReady()) { initScanEngine(); return; }
            if (Date.now() >= deadline) {
                showToast('⚠️ មិនអាចផ្ទុកម៉ាស៊ីនស្កេន Barcode បានទេ! កាមេរ៉ាអាចនឹងប្រើការមិនកើត សូម Refresh ទំព័រ ឬប្រើម៉ាស៊ីនស្កេន/វាយបញ្ចូលដោយដៃ');
                return;
            }
            setTimeout(() => waitForZXingThenInitScanEngine(deadline), 300);
        })();

        if ('BarcodeDetector' in window) {
            try {
                scanState.nativeDetector = new BarcodeDetector({ formats: NATIVE_SCAN_FORMAT_NAMES });
            } catch (e) {
                scanState.nativeDetector = null;
            }
        }

        setupHardwareScanner();
        setupConnectionRecovery();
        switchAppPage('data');
        initBiometricUi();
        setupSwipeGestures();
        setupChromeAutoHide();
        setupAdaptivePerformance();
        setupIOSPullToRefresh();
        setupVisibilityHandling();
        updateRecentPhonesList();
        setupPhoneSuggestions();
        setupSheetImportDropZone();

        document.addEventListener('click', (e) => {
            dismissGlobalMoreMenuOutside(e);
            safeFocusScanner();
        });

        document.addEventListener('pointerdown', dismissGlobalMoreMenuOutside, { capture: true, passive: true });
        window.addEventListener('scroll', (e) => {
            const scrolled = e.target as any;
            if (scrolled && scrolled.closest && scrolled.closest('#globalMoreMenu')) return;
            closeGlobalMoreMenu();
        }, { capture: true, passive: true });
        window.addEventListener('resize', closeGlobalMoreMenu);

        document.addEventListener('click', (e) => {
            const clicked = e.target as any;
            if (clicked && clicked.classList && clicked.classList.contains('modal') && clicked.style.display === 'flex') {
                dismissModal(clicked);
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const openModals = Array.from(document.querySelectorAll('.modal')).filter((m: any) => m.style.display === 'flex');
            const openModalEl = topmostModal(openModals);
            if (openModalEl) { dismissModal(openModalEl); return; }
            if (isSideDrawerOpen()) closeSideDrawer();
        });

        revealAppAfterBoot();
    });
}
