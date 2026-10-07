import { scanState, uiState } from '../../core/state';
import { renderAppVersionLabels } from '../../core/actions';
import { elapsedSince } from '../../core/elapsed';
import { safeFocusScanner } from '../../core/timezone';
import { resumeInterruptedCleanups, runScheduledCleanup } from '../../domain/cleanup';
import { initAppLock } from '../../features/app-lock';
import { initBiometricUi } from '../../features/biometric';
import { applySetupLinkFromUrl } from '../../features/config';
import { prefetchCustomerDataTableRowsIfConfigured } from '../../features/customer-table';
import { CUSTOMER_TABLE_CACHE_MS } from '../../features/customer-table-prefetch';
import { setupHardwareScanner, setupVisibilityHandling } from '../behaviors/scanner-input';
import { LICENSE_RECHECK_INTERVAL_MS, runPeriodicLicenseCheck } from '../../features/license';
import { warmZtoLookupProxyNow } from '../../features/lookup-api';
import { runSessionExpiryCheck } from '../../features/session';
import { refreshZtoListSyncUi } from '../../features/zto-list-sync';
import { retryZtoShopSweepListener } from '../../services/zto-shop-sweep';
import { noteZtoUserActivity, refreshZtoAutoCloseUi, renderZtoSyncViews, scheduleZtoStatusSweep } from '../../features/zto-status';
import { isNativeApp } from '../../platform/native';
import { scrollWindowToTop } from '../../platform/document-io';
import { probeDatabaseLivenessIfIdle, setupConnectionRecovery } from '../../services/connection';
import { restoreLookupSecretKey } from '../../services/crypto';
import { updateRecentPhonesList } from '../../services/db-listeners';
import { initFirebase } from '../../services/firebase-init';
import { initNotifications, NOTIFY_FEED_INTERVAL_MS, notifyPeriodicTick } from '../../features/notifications';
import { consumePushOpenRequest, ensureNativePushListeners, handleServiceWorkerMessage, refreshPushStatus, resyncPush, syncExpirySchedule, watchPushIdentity } from '../../features/push';
import { NATIVE_SCAN_FORMAT_NAMES, initScanEngine, scanEngineReady } from '../../services/scan-engine';
import { revealAppAfterBoot, showUpdateAvailableBanner } from '../../ui/boot-splash';
import { setupChromeAutoHide } from '../behaviors/chrome-autohide';
import { sweepRecallHighlights } from '../../ui/history-refresh';
import { cleanupResources } from '../../ui/modal';
import { closeGlobalMoreMenu } from '../../ui/more-menu';
import { switchAppPage } from '../../ui/page-nav';
import { setupSwipeGestures } from '../behaviors/panel-motion';
import { setupPhoneSuggestions } from '../behaviors/phone-search';
import { setupAdaptivePerformance } from '../../ui/perf';
import { setupIOSPullToRefresh } from '../behaviors/pull-to-refresh';
import { setupScrollThumb } from '../behaviors/scroll-thumb';
import { showToast } from '../../ui/toast';
import { dismissModal } from '../../ui/modal-stack';
import { closeTopmostLayer, dismissGlobalMoreMenuOutside, modalBackdropTarget } from './layers';
import { setupNativeShell } from './native-shell';
import { oncePerPage, type LifecycleScope } from './scope';
import { elementOf } from '../refs';

export function bootApplication(scope: LifecycleScope): void {
    bootShell(scope);
    scope.onLoad(() => {
        startCoreServices();
        startPeriodicTasks(scope);
        startScanEngine();
        startInteractions();
        startGlobalDismissals(scope);
        revealAppAfterBoot();
    });
}

function bootShell(scope: LifecycleScope): void {
    renderAppVersionLabels();

    if (window.visualViewport) {
        scope.listen(window.visualViewport, 'resize', scrollWindowToTop);
    }

    if ('serviceWorker' in navigator && !isNativeApp()) {
        scope.onLoad(() => registerServiceWorker(scope));
    }

    scope.listen(window, 'beforeunload', cleanupResources);

    oncePerPage('app-lock', initAppLock);

    restoreLookupSecretKey().then((restored) => {
        if (!restored || scope.disposed) return;
        renderZtoSyncViews();
        scheduleZtoStatusSweep();
    }, () => {});

    setupNativeShell(scope);
}

function registerServiceWorker(scope: LifecycleScope): void {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
        const SW_UPDATE_MIN_GAP_MS = 15 * 60 * 1000;
        let lastSwUpdateAt = Date.now();
        const throttledSwUpdate = () => {
            if ((navigator.onLine as boolean) === false) return;
            if (elapsedSince(lastSwUpdateAt) < SW_UPDATE_MIN_GAP_MS) return;
            lastSwUpdateAt = Date.now();
            reg.update().catch(() => {});
        };
        scope.listen(document, 'visibilitychange', () => {
            if (document.visibilityState === 'visible') throttledSwUpdate();
        });
        scope.listen(window, 'focus', throttledSwUpdate);
        scope.listen(window, 'online', throttledSwUpdate);
        scope.every(30 * 60 * 1000, throttledSwUpdate);
    }).catch(() => {});

    scope.listen(navigator.serviceWorker, 'message', (event: MessageEvent) => handleServiceWorkerMessage(event.data));

    const hadControllerAtLoad = !!navigator.serviceWorker.controller;
    scope.listen(navigator.serviceWorker, 'controllerchange', () => {
        if (hadControllerAtLoad) showUpdateAvailableBanner();
    });
}

function startCoreServices(): void {
    oncePerPage('core-services', () => {
        if (window.ZoeErrors) ZoeErrors.init('zoew');
        if (window.ZoeLicense) window.ZoeLicense.syncServerTime().catch(() => {});
        applySetupLinkFromUrl();
        initFirebase();
        initNotifications();
        refreshPushStatus();
        watchPushIdentity();
        consumePushOpenRequest();
        ensureNativePushListeners();
        resyncPush();
    });
    refreshZtoAutoCloseUi();
    refreshZtoListSyncUi();
    prefetchCustomerDataTableRowsIfConfigured();
}

function startPeriodicTasks(scope: LifecycleScope): void {
    scope.every(CUSTOMER_TABLE_CACHE_MS, () => {
        prefetchCustomerDataTableRowsIfConfigured();
    });
    scope.every(60000, runSessionExpiryCheck);
    scope.every(LICENSE_RECHECK_INTERVAL_MS, runPeriodicLicenseCheck);
    scope.every(60000, sweepRecallHighlights);
    scope.every(NOTIFY_FEED_INTERVAL_MS, () => {
        notifyPeriodicTick();
        syncExpirySchedule();
    });
    scope.every(60000, () => {
        retryZtoShopSweepListener();
        runScheduledCleanup();
        resumeInterruptedCleanups();
        scheduleZtoStatusSweep();
        probeDatabaseLivenessIfIdle();
    });
    scope.listen(document, 'visibilitychange', () => {
        if (document.hidden) return;
        sweepRecallHighlights();
        retryZtoShopSweepListener();
        runScheduledCleanup();
        resumeInterruptedCleanups();
        scheduleZtoStatusSweep();
        notifyPeriodicTick();
        resyncPush();
        syncExpirySchedule();
        if (uiState.currentAppPage === 'entry') warmZtoLookupProxyNow();
    });
}

function startScanEngine(): void {
    oncePerPage('scan-engine', () => {
        (function waitForZXingThenInitScanEngine(deadline?: number) {
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
            } catch {
                scanState.nativeDetector = null;
            }
        }
    });
}

function startInteractions(): void {
    oncePerPage('interactions', () => {
        setupHardwareScanner();
        setupConnectionRecovery();
        switchAppPage('data');
        initBiometricUi();
        setupSwipeGestures();
        setupChromeAutoHide();
        setupAdaptivePerformance();
        setupIOSPullToRefresh();
        setupScrollThumb();
        setupVisibilityHandling();
        updateRecentPhonesList();
        setupPhoneSuggestions();
    });
}

function startGlobalDismissals(scope: LifecycleScope): void {
    scope.listen(document, 'click', (e) => {
        dismissGlobalMoreMenuOutside(e);
        safeFocusScanner();
    });

    scope.listen(document, 'pointerdown', dismissGlobalMoreMenuOutside, { capture: true, passive: true });
    scope.listen(document, 'pointerdown', noteZtoUserActivity, { capture: true, passive: true });
    scope.listen(document, 'keydown', noteZtoUserActivity, { capture: true, passive: true });
    scope.listen(window, 'scroll', (e) => {
        const scrolled = e.target as any;
        const menu = elementOf('globalMoreMenu');
        if (scrolled && scrolled.closest && menu && menu.contains(scrolled)) return;
        closeGlobalMoreMenu();
    }, { capture: true, passive: true });
    scope.listen(window, 'resize', closeGlobalMoreMenu);

    scope.listen(document, 'click', (e) => {
        const id = modalBackdropTarget(e.target);
        if (id) dismissModal(id);
    });
    scope.listen(document, 'keydown', (e) => {
        if (e.key !== 'Escape') return;
        closeTopmostLayer({ includeMoreMenu: false });
    });
}
