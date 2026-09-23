import { securityState, uiState } from '../../core/state';
import { noteAppLockAway, relockAppAfterAway } from '../../features/app-lock';
import { setEntryScanMode } from '../../features/scan-remove';
import { isNativeAndroid } from '../../platform/native';
import { switchAppPage } from '../../ui/page-nav';
import { createBackHistory, screenOf, type BackHistory, type Screen } from './back-history';
import { closeTopmostLayer } from './layers';
import type { LifecycleScope } from './scope';

/**
 * ការភ្ជាប់សំបក native (Android · Capacitor) ទៅ App — **រត់តែលើ native**
 * ហើយ plugin ទាំងអស់ផ្ទុកតាម `import()` ➜ bundle របស់ web មិនប្រែ។
 *
 * ១. ប៊ូតុង Back របស់ Android ➜ `handleNativeBack()` (អ្នកសម្រេចតែមួយ) ជាមួយ
 *    **ប្រវត្តិថយក្រោយ** (`back-history.ts`) ដែលសង្កេតឃ្លាំង `uiState` តាំងពី
 *    boot ➜ Back ត្រឡប់ទៅអេក្រង់មុនម្តងមួយជំហាន។
 * ២. `pause`/`resume` របស់ Activity ➜ សោ App ៖ WebView អាចមិនបាញ់
 *    `visibilitychange` គ្រប់ករណី (ឧ. ផ្ទាំងជីវមាត្រ · Share ជា Activity
 *    ផ្សេង) ➜ ព្រឹត្តិការណ៍ Activity ជាសញ្ញាដែលទុកចិត្តបាន។ ⛔ ការហៅស្ទួន
 *    (Activity + `visibilitychange`) ត្រូវបានច្រានចេញក្នុង `noteAppLockAway()`
 *    ខ្លួនវា — បើមិនដូច្នេះការហៅទី ២ ស៊ីការលើកលែង (ការខល) ហើយចាក់សោខុស។
 * ៣. ពណ៌រូបតំណាងលើរបាប្រព័ន្ធ ៖ ដេរីវេពី **inset ដែលវាស់បាន** មិនមែនការសន្មត
 *    (`statusBarStyleFor()`)។ WebView ថ្មី (Chromium ≥ 140) ពេញអេក្រង់ ➜ navbar
 *    ក្រហមឈរក្រោមរបាស្ថានភាព ➜ រូបតំណាងស។ WebView ចាស់ ➜ Capacitor ដាក់
 *    padding ➜ របាឈរលើផ្ទៃភ្លឺ ➜ រូបតំណាងខ្មៅ (បើអត់ វាមើលមិនឃើញ)។ របាខាងក្រោម
 *    ឈរលើរបា Tab ពណ៌ភ្លឺ ឬផ្ទៃភ្លឺ ➜ រូបតំណាងខ្មៅជានិច្ច។
 */
export function setupNativeShell(scope: LifecycleScope): void {
    if (!isNativeAndroid()) return;
    // ⛔ ប្រវត្តិចាប់ផ្តើម **ភ្លាម** (មុន plugin ផ្ទុករួច) ➜ ការប្តូរទំព័រដំបូងៗ មិនបាត់
    const history = createBackHistory(() => screenOf(uiState));
    scope.onDispose(uiState.subscribe(history.observe));
    Promise.all([import('@capacitor/app'), import('@capacitor/core')]).then(async ([{ App }, core]) => {
        if (scope.disposed) return;
        const handles = await Promise.all([
            App.addListener('backButton', () => handleNativeBack(() => { App.minimizeApp().catch(() => {}); }, history)),
            App.addListener('pause', () => noteAppLockAway()),
            App.addListener('resume', () => relockAppAfterAway())
        ]);
        scope.onDispose(() => handles.forEach((h) => { h.remove().catch(() => {}); }));
        const { SystemBars, SystemBarsStyle, SystemBarType } = core as any;
        if (!SystemBars) return;
        let applied = '';
        const applyBarStyles = () => {
            const status = statusBarStyleFor(statusBarInsetPx());
            if (status === applied) return;
            applied = status;
            SystemBars.setStyle({ style: status === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light, bar: SystemBarType.StatusBar }).catch(() => {});
        };
        SystemBars.setStyle({ style: SystemBarsStyle.Light, bar: SystemBarType.NavigationBar }).catch(() => {});
        applyBarStyles();
        scope.listen(window, 'resize', applyBarStyles);
    }).catch((e) => {
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'Native shell setup failed' });
    });
}

/**
 * លំដាប់នៃប៊ូតុង Back ៖
 * ១. App ជាប់សោ ➜ បង្រួម App (⛔ មិនប៉ះប្រអប់ដែលលាក់នៅពីក្រោយសោ)
 * ២. ស្រទាប់បើក (ម៉ឺនុយ · ប្រអប់ · របា Slide) ➜ បិទស្រទាប់ខាងលើគេ
 * ៣. ប្រវត្តិ ➜ ត្រឡប់ទៅអេក្រង់មុន (ទំព័រ · របៀបស្កេន)
 * ៤. ប្រវត្តិអស់ តែនៅទំព័រស្កេន ➜ ទំព័រទិន្នន័យ
 * ៥. ទំព័រទិន្នន័យ ➜ បង្រួម App (⛔ មិនមែនបិទ — ការសរសេរដែលកំពុងហោះត្រូវរស់)
 */
export function handleNativeBack(minimize: () => void, history?: BackHistory): void {
    if (securityState.appIsLocked) { minimize(); return; }
    if (closeTopmostLayer({ includeMoreMenu: true })) return;
    const target = history ? history.popTarget() : null;
    if (target) { restoreScreen(target); return; }
    if (uiState.currentAppPage !== 'data') { switchAppPage('data'); return; }
    minimize();
}

function restoreScreen(target: Screen): void {
    if (uiState.currentAppPage !== target.page) switchAppPage(target.page);
    if (target.page === 'entry' && target.mode && uiState.entryScanMode !== target.mode) setEntryScanMode(target.mode);
}

/** កម្ពស់ `env(safe-area-inset-top)` ពិត (px) — ០ ពេល WebView មិនពេញអេក្រង់ */
export function statusBarInsetPx(): number {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
    document.body.appendChild(probe);
    const value = parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
    return value;
}

/**
 * `dark` = រូបតំណាងស (ផ្ទៃងងឹត/ក្រហមនៅក្រោម) · `light` = រូបតំណាងខ្មៅ។
 * ⛔ inset > 0 ➜ WebView ពេញអេក្រង់ ➜ navbar ក្រហមឈរក្រោមរបា ➜ `dark`។
 */
export function statusBarStyleFor(insetTopPx: number): 'dark' | 'light' {
    return insetTopPx > 0 ? 'dark' : 'light';
}
