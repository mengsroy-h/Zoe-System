import { useLayoutEffect } from 'react';
import { uiState } from '../../../core/state';
import { viewState } from '../../../core/view-state';
import { useStoreValue } from '../../hooks/useStore';

let capturedBaseTitle: string | null = null;

export function documentBaseTitle(): string {
    if (capturedBaseTitle === null) capturedBaseTitle = document.title;
    return capturedBaseTitle;
}

function useBodyClass(className: string, on: boolean): void {
    useLayoutEffect(() => {
        document.body.classList.toggle(className, on);
    }, [className, on]);
}

function useHtmlVar(name: string, value: string): void {
    useLayoutEffect(() => {
        if (value) document.documentElement.style.setProperty(name, value);
    }, [name, value]);
}

export function DocumentEffects() {
    const scrollLocked = useStoreValue(uiState, (s) => s.isModalOpen);
    const chromeHidden = useStoreValue(uiState, (s) => s.chromeHidden);
    const keyboardOpen = useStoreValue(uiState, (s) => s.keyboardOpen);
    const iosKeyboardInset = useStoreValue(uiState, (s) => s.iosKeyboardInset);
    const iosKeyboardListFixed = useStoreValue(uiState, (s) => s.iosKeyboardListFixed);
    const iosKeyboardSuggestFixed = useStoreValue(uiState, (s) => s.iosKeyboardSuggestFixed);
    const modalViewportTop = useStoreValue(uiState, (s) => s.modalViewportTop);
    const modalViewportHeight = useStoreValue(uiState, (s) => s.modalViewportHeight);
    const appLocked = useStoreValue(viewState, (s) => s.appLockOpen);
    const bootRevealing = useStoreValue(viewState, (s) => s.bootRevealing);
    const perfLite = useStoreValue(viewState, (s) => s.perfLite);
    const title = useStoreValue(viewState, (s) => s.documentTitle);

    useLayoutEffect(() => {
        document.body.style.overflow = scrollLocked ? 'hidden' : '';
    }, [scrollLocked]);

    useBodyClass('app-locked', appLocked);
    useBodyClass('boot-reveal', bootRevealing);
    useBodyClass('perf-lite', perfLite);
    useBodyClass('chrome-hidden', chromeHidden || keyboardOpen);
    useBodyClass('keyboard-open', keyboardOpen);
    useBodyClass('ios-keyboard', iosKeyboardInset > 0);
    useBodyClass('ios-keyboard-list-fixed', iosKeyboardInset > 0 && iosKeyboardListFixed);
    useBodyClass('ios-keyboard-suggest-fixed', iosKeyboardInset > 0 && iosKeyboardSuggestFixed);
    useBodyClass('modal-keyboard', modalViewportHeight > 0);

    useHtmlVar('--chrome-top', useStoreValue(uiState, (s) => s.chromeTopVar));
    useHtmlVar('--tabbar-height', useStoreValue(uiState, (s) => s.tabbarHeightVar));
    useHtmlVar('--page-extension', useStoreValue(uiState, (s) => s.pageExtensionVar));
    useHtmlVar('--chrome-bottom', useStoreValue(uiState, (s) => s.chromeBottomVar));
    useHtmlVar('--ios-keyboard-inset', iosKeyboardInset > 0 ? iosKeyboardInset + 'px' : '0px');
    useHtmlVar('--modal-vv-top', modalViewportTop + 'px');
    useHtmlVar('--modal-vv-height', modalViewportHeight > 0 ? modalViewportHeight + 'px' : '100%');

    useLayoutEffect(() => {
        const base = documentBaseTitle();
        const next = title === null ? base : title;
        if (document.title !== next) document.title = next;
    }, [title]);

    return null;
}
