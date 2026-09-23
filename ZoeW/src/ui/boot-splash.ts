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

/**
 * ផ្លូវបម្រុងពេល boot ជាប់ (ឧ. chunk យឺត) ៖ បន្ទាប់ពី ៦ វិនាទី ផ្ទាំងបើកត្រូវ
 * រសាត់ចេញដោយខ្លួនឯង ដើម្បីកុំឲ្យអ្នកប្រើជាប់មុខផ្ទាំងបើកជារៀងរហូត។
 *
 * ⛔ **ជាន់តែមួយ** (React) ៖ ផ្ទាំងជារបស់ React ហើយកើតតែក្រោយ mount ➜ bundle ដួល =
 *    គ្មានផ្ទាំង (មិនមែនផ្ទាំងជាប់)។ `boot-flags.js` របស់ ZoeW ដើមមានជាន់ទី ២ ព្រោះផ្ទាំង
 *    ដើមជា markup ថេរក្នុង `index.html` — ផ្ទាំងនោះលែងមាន។ state ដឹង ➜ `hideBootSplash()`
 *    ក្រោយមកមិនលេងចលនា reveal លើផ្ទាំងដែលរសាត់រួច (ដូចដើម)។
 */
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
    // ⛔ ច្រកទ្វារ idempotent ដើមគឺវត្តមាននៃធាតុ `#zoeUpdateBanner` ➜ ទង់
    //    នេះជំនួសវា **ទិសទាំង ២** ៖ ហៅ ២ ដង ➜ របា ១; ចុច ✕ ➜ ការហៅ
    //    បន្ទាប់បង្ហាញវិញ។
    if (uiState.updateBannerOpen) return;
    uiState.updateBannerOpen = true;
}
