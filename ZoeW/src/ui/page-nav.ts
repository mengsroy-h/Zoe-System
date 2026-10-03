import { syncHistoryExpandedLock } from '../app/behaviors/panels';
import { setPhoneSearchPulledUp } from '../app/behaviors/phone-search';
import { setScrollTop } from '../app/refs';
import { scanState, uiState } from '../core/state';
import { refreshDrawerGroups } from '../core/actions';
import { closeConfigQrScanner } from '../features/config-qr';
import { showCameraClosedBox, stopCurrentStream } from '../features/daily-stats';
import { warmZtoLookupProxyNow } from '../features/lookup-api';
import { hidePhoneSuggestions } from '../features/phone-suggest';
import { setEntryScanMode } from '../features/scan-remove';
import { markNotifyFeedSeen, markNotifyRemovedSeen } from '../features/notifications';
import { refreshZtoListSyncUi } from '../features/zto-list-sync';
import { refreshZtoAutoCloseUi } from '../features/zto-status';
import { showAppChrome } from './chrome-autohide';
import { measureDisplayRateForDrawer, refreshJankText } from './perf';

export function switchAppPage(page?) {
    const target = page === 'entry' ? 'entry' : 'data';
    uiState.currentAppPage = target;

    hidePhoneSuggestions();
    setPhoneSearchPulledUp(false);
    showAppChrome();
    syncHistoryExpandedLock();
    setScrollTop('appPages', 0);

    if (target === 'entry') {
        setEntryScanMode(uiState.entryScanMode);
        warmZtoLookupProxyNow();
    } else {
        const cameraWasLive = scanState.isCameraScanning || scanState.isCameraStarting;
        stopCurrentStream();
        if (cameraWasLive) showCameraClosedBox();
        closeConfigQrScanner();
    }
}

export function openSideDrawer() {
    showAppChrome();
    hidePhoneSuggestions();
    refreshZtoAutoCloseUi();
    refreshZtoListSyncUi();
    refreshDrawerGroups();
    if (uiState.notifyDrawerOpen) {
        markNotifyFeedSeen();
        markNotifyRemovedSeen();
    }
    uiState.notifyDrawerOpen = false;
    uiState.drawerOpen = true;
    measureDisplayRateForDrawer();
    refreshJankText();
}

export function closeSideDrawer() {
    if (uiState.notifyDrawerOpen) {
        markNotifyFeedSeen();
        markNotifyRemovedSeen();
    }
    uiState.drawerOpen = false;
    uiState.notifyDrawerOpen = false;
}

export function isSideDrawerOpen() {
    return uiState.drawerOpen || uiState.notifyDrawerOpen;
}

export function drawerAction(fn) {
    closeSideDrawer();
    if (typeof fn === 'function') fn();
}
