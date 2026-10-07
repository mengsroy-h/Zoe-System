import { securityState, uiState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { noteAppLockAway, relockAppAfterAway } from '../../features/app-lock';
import { setEntryScanMode } from '../../features/scan-remove';
import { isNativeAndroid } from '../../platform/native';
import { switchAppPage } from '../../ui/page-nav';
import { createBackHistory, screenOf, type BackHistory, type Screen } from './back-history';
import { closeTopmostLayer } from './layers';
import type { LifecycleScope } from './scope';
import { elementOf } from '../refs';
import { statusBarToneFor, type StatusBarTone } from './status-bar-tone';

export function setupNativeShell(scope: LifecycleScope): void {
    if (!isNativeAndroid()) return;
    const history = createBackHistory(() => screenOf(uiState));
    scope.onDispose(uiState.subscribe(history.observe));
    Promise.all([import('@capacitor/app'), import('@capacitor/core')]).then(async ([{ App }, core]) => {
        if (scope.disposed) return;
        await Promise.all([
            App.addListener('backButton', () => { if (!scope.disposed) handleNativeBack(() => { App.minimizeApp().catch(() => {}); }, history); }),
            App.addListener('pause', () => { if (!scope.disposed) noteAppLockAway(); }),
            App.addListener('resume', () => { if (!scope.disposed) relockAppAfterAway(); })
        ].map((pending) => pending.then((handle) => {
            scope.onDispose(() => { handle.remove().catch(() => {}); });
        })));
        if (scope.disposed) return;
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
        let frame = 0;
        let afterFrame: ReturnType<typeof setTimeout> | null = null;
        let settle: ReturnType<typeof setTimeout> | null = null;
        let layers = statusBarLayerSignature();
        const scheduleBarStyles = () => {
            const next = statusBarLayerSignature();
            if (next === layers) return;
            layers = next;
            if (!frame && !afterFrame) {
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    afterFrame = setTimeout(() => { afterFrame = null; applyBarStyles(); }, 0);
                });
            }
            if (settle) clearTimeout(settle);
            settle = setTimeout(() => { settle = null; applyBarStyles(); }, STATUS_BAR_SETTLE_MS);
        };
        scope.onDispose(uiState.subscribe(scheduleBarStyles));
        scope.onDispose(securityState.subscribe(scheduleBarStyles));
        scope.onDispose(viewState.subscribe(scheduleBarStyles));
        scope.onDispose(() => {
            if (frame) cancelAnimationFrame(frame);
            if (afterFrame) clearTimeout(afterFrame);
            if (settle) clearTimeout(settle);
        });
    }).catch((e) => {
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'Native shell setup failed' });
    });
}

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

export function statusBarLayerSignature(): string {
    const shown = uiState.modalDisplay || {};
    const modals = Object.keys(shown).filter((id) => shown[id] === 'flex').sort().join(',');
    return [modals, uiState.drawerOpen ? 1 : 0, uiState.notifyDrawerOpen ? 1 : 0, uiState.moreMenuOpen ? 1 : 0,
        securityState.appIsLocked ? 1 : 0, viewState.appLockOpen ? 1 : 0, viewState.bootSplashPhase].join('|');
}

export function statusBarInsetPx(): number {
    const probe = elementOf('safeAreaProbe');
    if (!probe) return 0;
    return parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
}

export const STATUS_BAR_SETTLE_MS = 320;

const STATUS_BAR_SAMPLE_XS = [0.08, 0.3, 0.5, 0.7, 0.92];

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
