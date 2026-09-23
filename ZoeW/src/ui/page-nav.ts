import { byId } from '../core/dom';
import { scanState, uiState } from '../core/state';
import { refreshDrawerGroups } from '../core/actions';
import { closeConfigQrScanner } from '../features/config-qr';
import { showCameraClosedBox, stopCurrentStream } from '../features/daily-stats';
import { warmZtoLookupProxyNow } from '../features/lookup-api';
import { hidePhoneSuggestions, setPhoneSearchPulledUp } from '../features/phone-suggest';
import { setEntryScanMode } from '../features/scan-remove';
import { refreshZtoListSyncUi } from '../features/zto-list-sync';
import { refreshZtoAutoCloseUi } from '../features/zto-status';
import { showAppChrome } from './chrome-autohide';

export function switchAppPage(page?) {
    const target = page === 'entry' ? 'entry' : 'data';
    uiState.currentAppPage = target;
    const dataPage = byId('pageData');
    const entryPage = byId('pageEntry');
    const dataTab = byId('pageTabData');
    const entryTab = byId('pageTabEntry');
    if (dataPage) dataPage.classList.toggle('active', target === 'data');
    if (entryPage) entryPage.classList.toggle('active', target === 'entry');
    if (dataTab) dataTab.classList.toggle('active', target === 'data');
    if (entryTab) entryTab.classList.toggle('active', target === 'entry');

    hidePhoneSuggestions();
    setPhoneSearchPulledUp(false);
    showAppChrome();
    syncHistoryExpandedLock();
    const pages = byId('appPages');
    if (pages) pages.scrollTop = 0;

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
    const drawer = byId('sideDrawer');
    const backdrop = byId('drawerBackdrop');
    if (!drawer || !backdrop) return;
    showAppChrome();
    hidePhoneSuggestions();
    refreshZtoAutoCloseUi();
    refreshZtoListSyncUi();
    refreshDrawerGroups();
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('open');
}

export function closeSideDrawer() {
    const drawer = byId('sideDrawer');
    const backdrop = byId('drawerBackdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('open');
}

export function isSideDrawerOpen() {
    const drawer = byId('sideDrawer');
    return !!(drawer && drawer.classList.contains('open'));
}

export function drawerAction(fn) {
    closeSideDrawer();
    if (typeof fn === 'function') fn();
}

export function activePanelSections() {
    const entryPage = byId('pageEntry');
    if (entryPage && entryPage.classList.contains('active')) {
        return {
            side: byId('entrySideSection'),
            main: byId('entryMainSection'),
            scroller: entryScrollerInView()
        };
    }
    const dataPage = byId('pageData');
    if (dataPage && dataPage.classList.contains('active')) {
        return {
            side: byId('dataSideSection'),
            main: byId('dataMainSection'),
            scroller: byId('tableResponsive')
        };
    }
    return { side: null, main: null, scroller: null };
}

export function entryScrollerInView() {
    const lockerPanel = byId('lockerPanel');
    const lockerVisible = !!lockerPanel && !lockerPanel.classList.contains('hidden');
    return byId(lockerVisible ? 'lockerTableResponsive' : 'entryTableResponsive');
}

export function usesIOSPanelHandoff() {
    return window.navigator && window.navigator.standalone === true &&
        window.CSS && typeof window.CSS.supports === 'function' &&
        window.CSS.supports('-webkit-touch-callout', 'none');
}

export function syncHistoryExpandedLock() {
    const pages = byId('appPages');
    if (!pages) return;
    const side = activePanelSections().side;
    const expanded = !!side && side.classList.contains('collapsed');
    const wasExpanded = pages.classList.contains('history-expanded');
    const iosUnlock = wasExpanded && !expanded && usesIOSPanelHandoff();
    if (expanded || iosUnlock) pages.scrollTop = 0;
    pages.classList.toggle('history-expanded', expanded);
    if (expanded || iosUnlock) {
        pages.scrollTop = 0;
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                if (pages.classList.contains('history-expanded') !== expanded) return;
                pages.scrollTop = 0;
                if (iosUnlock) {
                    requestAnimationFrame(() => {
                        if (!pages.classList.contains('history-expanded')) pages.scrollTop = 0;
                    });
                }
            });
        }
    }
}
