import { securityState, uiState } from '../../core/state';
import { noteAppLockAway, relockAppAfterAway } from '../../features/app-lock';
import { setEntryScanMode } from '../../features/scan-remove';
import { isNativeAndroid } from '../../platform/native';
import { switchAppPage } from '../../ui/page-nav';
import { createBackHistory, screenOf, type BackHistory, type Screen } from './back-history';
import { closeTopmostLayer } from './layers';
import type { LifecycleScope } from './scope';
import { elementOf } from '../refs';
import { statusBarToneFor, type StatusBarTone } from './status-bar-tone';

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
 * ៣. ពណ៌រូបតំណាងលើរបាប្រព័ន្ធ ៖ ដេរីវេពី **ពណ៌ផ្ទៃពិតដែលឈរនៅក្រោមរបា** (`measureStatusBarTone()`
 *    ➜ `status-bar-tone.ts`) មិនមែនការសន្មតអំពី layout។ WebView ថ្មី (Chromium ≥ 140) ពេញអេក្រង់ ➜
 *    របាស្ថានភាពជាស្រទាប់ថ្លាលើ navbar **ស** ➜ រូបតំណាងខ្មៅ; ប្រអប់/របា Slide បើក ➜ ផ្ទៃងងឹតថ្លាៗ
 *    ➜ វាស់ឡើងវិញ។ WebView ចាស់ (inset ០) ➜ Capacitor ដាក់ padding ➜ ផ្ទៃភ្លឺ ➜ រូបតំណាងខ្មៅ។
 *    ⛔ ការសន្មត «inset > 0 ➜ navbar ក្រហម ➜ រូបតំណាងស» ធ្វើឲ្យរូបតំណាង **ស លើផ្ទៃស** ។
 *    របាខាងក្រោមឈរលើរបា Tab ពណ៌ភ្លឺ ➜ រូបតំណាងខ្មៅជានិច្ច។
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
            if (scope.disposed) return;
            const status = measureStatusBarTone();
            if (status === applied) return;
            applied = status;
            SystemBars.setStyle({ style: status === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light, bar: SystemBarType.StatusBar }).catch(() => {});
        };
        SystemBars.setStyle({ style: SystemBarsStyle.Light, bar: SystemBarType.NavigationBar }).catch(() => {});
        applyBarStyles();
        scope.listen(window, 'resize', applyBarStyles);
        // ⛔ ផ្ទៃក្រោមរបាប្រែតាម state (ប្រអប់ · របា Slide · សោ App) ➜ វាស់ក្រោយការគូរ (rAF)
        //    ហើយម្តងទៀតក្រោយចលនាចប់ (ប្រអប់ fade · របា Slide រអិល) ➜ សាលក្រមចុងក្រោយជារបស់ស្ថានភាពនឹង។
        let frame = 0;
        let settle: ReturnType<typeof setTimeout> | null = null;
        const scheduleBarStyles = () => {
            if (!frame) frame = requestAnimationFrame(() => { frame = 0; applyBarStyles(); });
            if (settle) clearTimeout(settle);
            settle = setTimeout(() => { settle = null; applyBarStyles(); }, STATUS_BAR_SETTLE_MS);
        };
        scope.onDispose(uiState.subscribe(scheduleBarStyles));
        scope.onDispose(securityState.subscribe(scheduleBarStyles));
        scope.onDispose(() => {
            if (frame) cancelAnimationFrame(frame);
            if (settle) clearTimeout(settle);
        });
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

/**
 * កម្ពស់ `env(safe-area-inset-top)` ពិត (px) — ០ ពេល WebView មិនពេញអេក្រង់ ។
 * អានពីធាតុវាស់ `SafeAreaProbe` (React គូរ) — ការវាស់ មិនមែនការសរសេរ DOM។
 */
export function statusBarInsetPx(): number {
    const probe = elementOf('safeAreaProbe');
    if (!probe) return 0;
    return parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
}

/** ចលនាប្រអប់ (0.18 វិ.) · របា Slide (0.25 វិ.) ចប់ ➜ វាស់ម្តងទៀត */
export const STATUS_BAR_SETTLE_MS = 320;

/** ចំណុចវាស់តាមទទឹងរបា (រូបតំណាងម៉ោងនៅឆ្វេង · ថ្មនៅស្តាំ) */
const STATUS_BAR_SAMPLE_XS = [0.08, 0.3, 0.5, 0.7, 0.92];

/**
 * វាស់ផ្ទៃក្រោមរបាស្ថានភាព ៖ ស្រទាប់ទាំងអស់នៅចំណុចនីមួយៗ (`elementsFromPoint` · ខាងលើគេមុន)
 * ជាមួយពណ៌ផ្ទៃ និង `opacity` ពិត (រួមធាតុមេ) ➜ `statusBarToneFor()`។
 * ⛔ ការវាស់ មិនមែនការសរសេរ DOM។ ⛔ ការវាស់ធ្លាក់ ➜ `light` (ផ្ទៃរបស់ App ភ្លឺជាលំនាំដើម)។
 */
export function measureStatusBarTone(): StatusBarTone {
    const inset = statusBarInsetPx();
    if (!(inset > 0)) return 'light';
    try {
        const opacityOf = new Map<Element, number>();
        const effectiveOpacity = (el: Element | null): number => {
            if (!el) return 1;
            const known = opacityOf.get(el);
            if (known !== undefined) return known;
            const own = parseFloat(window.getComputedStyle(el).opacity);
            const value = (Number.isFinite(own) ? own : 1) * effectiveOpacity(el.parentElement);
            opacityOf.set(el, value);
            return value;
        };
        const y = inset / 2;
        const samples = STATUS_BAR_SAMPLE_XS.map((fx) => document.elementsFromPoint(window.innerWidth * fx, y)
            .map((el) => ({ color: window.getComputedStyle(el).backgroundColor, opacity: effectiveOpacity(el) })));
        return statusBarToneFor(inset, samples);
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'Status bar tone measure failed' });
        return 'light';
    }
}
