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
import { refreshZtoListSyncUi } from '../features/zto-list-sync';
import { refreshZtoAutoCloseUi } from '../features/zto-status';
import { showAppChrome } from './chrome-autohide';

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
    uiState.drawerOpen = true;
}

export function closeSideDrawer() {
    uiState.drawerOpen = false;
}

export function isSideDrawerOpen() {
    return uiState.drawerOpen;
}

export function drawerAction(fn) {
    closeSideDrawer();
    if (typeof fn === 'function') fn();
}
