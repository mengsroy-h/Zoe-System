import { uiState } from '../core/state';
import { isSideDrawerOpen } from './page-nav';

export function showAppChrome() {
    if (uiState.chromeHidden) {
        uiState.chromeHidden = false;
    }
}

export function hideAppChrome() {
    if (uiState.chromeHidden) return;
    if (window.innerWidth >= 992) return;
    if (uiState.isModalOpen || isSideDrawerOpen()) return;
    uiState.chromeHidden = true;
}
