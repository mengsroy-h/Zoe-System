import { uiState } from '../core/state';
import { viewState } from '../core/view-state';
import { elapsedSince } from '../core/elapsed';

export const BOOT_SPLASH_MIN_MS = 380;

export const BOOT_REVEAL_CLEANUP_MS = 760;

export const bootSplashStartedAt = Date.now();

export function hideBootSplash() {
    if (viewState.bootSplashPhase !== 'shown') return;
    viewState.bootSplashPhase = 'out';
    viewState.bootRevealing = true;
    setTimeout(() => {
        viewState.bootSplashPhase = 'gone';
        viewState.bootRevealing = false;
    }, BOOT_REVEAL_CLEANUP_MS);
}

export function armBootSplashFallback() {
    setTimeout(() => {
        if (viewState.bootSplashPhase !== 'shown') return;
        viewState.bootSplashPhase = 'out';
        setTimeout(() => { viewState.bootSplashPhase = 'gone'; }, 700);
    }, BOOT_SPLASH_FALLBACK_MS);
}

export const BOOT_SPLASH_FALLBACK_MS = 6000;

export function revealAppAfterBoot() {
    const wait = Math.max(0, BOOT_SPLASH_MIN_MS - elapsedSince(bootSplashStartedAt));
    setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(hideBootSplash));
    }, wait);
}

export function showUpdateAvailableBanner() {
    uiState.updateReady = true;
    if (uiState.updateBannerOpen) return;
    uiState.updateBannerOpen = true;
}
