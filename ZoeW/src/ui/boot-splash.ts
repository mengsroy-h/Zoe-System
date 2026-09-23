import { uiState } from '../core/state';
import { byId } from '../core/dom';
import { elapsedSince } from '../core/elapsed';

export const BOOT_SPLASH_MIN_MS = 380;

export const BOOT_REVEAL_CLEANUP_MS = 760;

export const bootSplashStartedAt = Date.now();

export function hideBootSplash() {
    const splash = byId('bootSplash');
    if (!splash || splash.classList.contains('boot-splash-out')) return;
    splash.classList.add('boot-splash-out');
    document.body.classList.add('boot-reveal');
    setTimeout(() => {
        splash.classList.add('boot-splash-gone');
        document.body.classList.remove('boot-reveal');
    }, BOOT_REVEAL_CLEANUP_MS);
}

export function revealAppAfterBoot() {
    const wait = Math.max(0, BOOT_SPLASH_MIN_MS - elapsedSince(bootSplashStartedAt));
    setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(hideBootSplash));
    }, wait);
}

export function showUpdateAvailableBanner() {
    // ⛔ ច្រកទ្វារ idempotent ដើមគឺវត្តមាននៃធាតុ `#zoeUpdateBanner` ➜ ទង់
    //    នេះជំនួសវា **ទិសទាំង ២** ៖ ហៅ ២ ដង ➜ របា ១; ចុច ✕ ➜ ការហៅ
    //    បន្ទាប់បង្ហាញវិញ។
    if (uiState.updateBannerOpen) return;
    uiState.updateBannerOpen = true;
}
