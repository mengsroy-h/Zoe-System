import { isNativeAndroid, pullToRefreshSupported } from '../../platform/native';
import { hapticTick } from '../../platform/haptics';
import { openModalIds } from '../../core/modals';
import { ptrState, securityState, uiState, type PtrView } from '../../core/state';
import { appSessionStore } from '../../core/storage';
import { showAppChrome } from '../../ui/chrome-autohide';
import { isSideDrawerOpen } from '../../ui/page-nav';
import { resetDocumentScroll } from '../../platform/document-io';
import { renderNow } from '../flush';
import { elementOf, setElementScrollTop } from '../refs';
import { scrollerOf } from './chrome-autohide';
import { activePanelSections, panelHasSearchFocus, panelIsCollapsed } from './panels';
import { beginIOSTouch, blockPanelForIOSTouch, iosTouchArbiter, resetIOSTouchArbiter, touchByIdentifier } from './panel-motion';

/**
 * ⛔ **តំបន់ហាមចូល** (`CLAUDE.md` ៖ «Pull-to-refresh លើ iOS PWA») — តក្កវិជ្ជា
 * ដូច `app.js` ដើមបេះបិទ ៖ `#appPages` តាម ref · ស្ថានភាពផ្ទាំងតាម state ·
 * សញ្ញា PTR (`PtrIndicator`) គូរពី **`ptrState`** (transform · opacity · class ចលនា)។
 * ⛔ រាល់ការប្តូរ ➜ `renderNow(ptrState)` ៖ ឃ្លាំងដាច់ដោយឡែក (អ្នកជាវតែមួយ) គូរ **ក្នុង
 *    ស៊ុមដដែល** នៃ `touchmove` ដូចការសរសេរ `style` ផ្ទាល់ពីមុន (វាស់ ៖ native-check · gesture-test)។
 */

/**
 * ⛔ **តំបន់កេះ** (សំណើម្ចាស់គម្រោង ៖ ដូចស្តង់ដា App) ៖ PTR ចាប់តែពេលម្រាមដៃ **ចាប់ផ្តើម**
 *    ក្នុង ៤០% ខាងលើនៃអេក្រង់ ➜ ការអូសចុះពីពាក់កណ្តាល/បាតអេក្រង់ (ឧ. ពេលរមូរបញ្ជី ឬ
 *    អូសផ្ទាំង) មិនអាចផ្ទុកទំព័រឡើងវិញដោយចៃដន្យ។
 */
export const PTR_START_ZONE_RATIO = 0.4;

export function ptrStartZoneBottom(): number {
    return Math.round(window.innerHeight * PTR_START_ZONE_RATIO);
}

/**
 * ⛔ ស្រទាប់ណាមួយបើក (ប្រអប់ · ម៉ឺនុយ (...) · របា Slide · សោ App) ➜ **គ្មាន PTR**។
 *    `openModalIds()` ជាប្រភពការពិតនៃប្រអប់ (រួមប្រអប់ដែលបើកដោយមិនឆ្លង `isModalOpen`)។
 */
export function ptrBlockedByOverlay(): boolean {
    return securityState.appIsLocked || uiState.isModalOpen || openModalIds().length > 0 ||
        uiState.moreMenuOpen || isSideDrawerOpen();
}

/** សញ្ញា PTR ដែល `PtrIndicator` គូរ (ref) */
export function ptrIndicatorElement(): any {
    return elementOf('ptrIndicator');
}

export function setupIOSPullToRefresh() {
    if (!pullToRefreshSupported()) return;
    const claimBeforeSlop = isNativeAndroid();

    const pages = elementOf('appPages');
    if (!pages) return;

    if (!ptrIndicatorElement()) return;

    const AXIS_SLOP = 22;
    const ENGAGE_AT = 56;
    const AXIS_RATIO = 1.6;
    const INDICATOR_AT = 18;
    const TRIGGER_AT = 96;
    const MAX_TRAVEL = 140;
    const REST_Y = -46;
    const RELOAD_KEY = 'zoew_ptr_reload_pending';
    const RESTORATION_KEY = 'zoew_ptr_scroll_restoration';

    let startY = 0;
    let startX = 0;
    let touchId = null;
    let tracking = false;
    let engaged = false;
    let travel = 0;
    let refreshing = false;
    let startScroller = null;
    let startActiveScroller = null;
    let restoreTimers = [];
    let restoreFrames = [];
    let settlingScroll = false;
    let reloadWatchdog = null;
    let pullMoveListening = false;
    let scrollerMemoTarget = null;
    let scrollerMemoValue = null;
    let readyTicked = false;
    let overlayAtPointerDown = false;
    let view: PtrView = { transform: '', opacity: '', ready: false, snapping: false, spinning: false };

    /** ប្តូរសញ្ញា PTR ➜ React គូរភ្លាម (ស៊ុមដដែល) */
    function showIndicator(patch: Partial<PtrView>) {
        view = { ...view, ...patch };
        ptrState.view = view;
        renderNow(ptrState);
    }

    function scrollerForPull(target) {
        if (target === scrollerMemoTarget) return scrollerMemoValue;
        scrollerMemoTarget = target;
        scrollerMemoValue = scrollerOf(target);
        return scrollerMemoValue;
    }

    function resetScrollerMemo() {
        scrollerMemoTarget = null;
        scrollerMemoValue = null;
    }

    function dampen(raw) {
        return MAX_TRAVEL * (1 - Math.exp(-raw / 135));
    }

    function paint(distance) {
        const progress = Math.min(1, distance / TRIGGER_AT);
        const visible = Math.max(0, Math.min(1, (distance - INDICATOR_AT) / (TRIGGER_AT - INDICATOR_AT)));
        showIndicator({
            transform: 'translateY(' + (REST_Y + distance) + 'px) rotate(' + Math.round(progress * 270) + 'deg)',
            opacity: String(visible),
            ready: progress >= 1
        });
        // ⛔ ញ័រ **ម្តង** ពេលឆ្លងព្រំដែន «លែងដៃដើម្បីផ្ទុកឡើងវិញ» · ថយក្រោមព្រំដែន ➜ ត្រៀមម្តងទៀត
        if (progress >= 1 && !readyTicked) {
            readyTicked = true;
            hapticTick();
        } else if (progress < 1) {
            readyTicked = false;
        }
    }

    function park(resetArbiter?) {
        resetScrollerMemo();
        touchId = null;
        tracking = false;
        engaged = false;
        travel = 0;
        startScroller = null;
        startActiveScroller = null;
        readyTicked = false;
        showIndicator({ snapping: true, ready: false, spinning: false, opacity: '0', transform: 'translateY(' + REST_Y + 'px)' });
        if (resetArbiter !== false) resetIOSTouchArbiter();
    }

    function atStartTop(value) {
        return Number.isFinite(value) && value <= 1;
    }

    function atPullTop(value) {
        return Number.isFinite(value) && value <= 1;
    }

    function pullTargetBlocked(target) {
        if (refreshing || ptrBlockedByOverlay()) return true;
        if (!target || !target.closest) return false;
        if (target.closest('input, textarea, select, [contenteditable="true"], .app-navbar, .page-tabbar')) return true;
        const action = target.closest('button, a');
        return !!(action && !action.closest('.table-responsive'));
    }

    function pullRefreshDisabledByPanelState() {
        const sections = activePanelSections();
        const side = sections.side;
        return uiState.historyExpanded || !!(side &&
            (panelIsCollapsed(sections.panel) || panelHasSearchFocus(sections.panel)));
    }

    function capturePullContext(target) {
        if (uiState.isModalOpen || refreshing || pullRefreshDisabledByPanelState() || pullTargetBlocked(target)) return null;
        const root = document.scrollingElement || document.documentElement;
        if (!atStartTop(root ? root.scrollTop : 0) || !atStartTop(window.scrollY || 0)) return null;
        if (!atStartTop(document.body.scrollTop || 0) || !atStartTop(pages.scrollTop)) return null;
        const scroller = scrollerForPull(target);
        if (scroller && !atStartTop(scroller.scrollTop)) return null;
        const activeScroller = activePanelSections().scroller;
        if (activeScroller && activeScroller.offsetParent !== null && !atStartTop(activeScroller.scrollTop)) return null;
        return { scroller: scroller, activeScroller: activeScroller };
    }

    function pullContextStillValid(target) {
        if (uiState.isModalOpen || refreshing || pullRefreshDisabledByPanelState() || pullTargetBlocked(target)) return false;
        if (scrollerForPull(target) !== startScroller) return false;
        if (activePanelSections().scroller !== startActiveScroller) return false;
        const root = document.scrollingElement || document.documentElement;
        if (!atPullTop(root ? root.scrollTop : 0) || !atPullTop(window.scrollY || 0)) return false;
        if (!atPullTop(document.body.scrollTop || 0) || !atPullTop(pages.scrollTop)) return false;
        if (startScroller && !atPullTop(startScroller.scrollTop)) return false;
        if (startActiveScroller && startActiveScroller.offsetParent !== null && !atPullTop(startActiveScroller.scrollTop)) return false;
        return true;
    }

    function attachPullMoveListener() {
        if (pullMoveListening) return;
        document.addEventListener('touchmove', onPullTouchMove, { passive: false });
        pullMoveListening = true;
    }

    function detachPullMoveListener() {
        if (!pullMoveListening) return;
        document.removeEventListener('touchmove', onPullTouchMove);
        pullMoveListening = false;
    }

    function syncPullMoveListener() {
        if (pullRefreshDisabledByPanelState()) detachPullMoveListener();
        else attachPullMoveListener();
    }

    function markReload() {
        try { appSessionStore.setItem(RELOAD_KEY, '1'); } catch (e) {}
    }

    function hasReloadMarker() {
        try {
            return appSessionStore.getItem(RELOAD_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function clearReloadMarker() {
        try { appSessionStore.removeItem(RELOAD_KEY); } catch (e) {}
    }

    function rememberScrollRestoration() {
        if (!('scrollRestoration' in history)) return;
        try {
            if (appSessionStore.getItem(RESTORATION_KEY) === null) {
                appSessionStore.setItem(RESTORATION_KEY, history.scrollRestoration);
            }
        } catch (e) {}
        history.scrollRestoration = 'manual';
    }

    function restoreScrollRestoration() {
        let mode = 'auto';
        try {
            const saved = appSessionStore.getItem(RESTORATION_KEY);
            if (saved === 'manual') mode = 'manual';
            appSessionStore.removeItem(RESTORATION_KEY);
        } catch (e) {}
        if ('scrollRestoration' in history) history.scrollRestoration = mode as ScrollRestoration;
    }

    function resetScrollPosition() {
        resetDocumentScroll(() => {
            setElementScrollTop(pages, 0);
            const activeScroller = activePanelSections().scroller;
            if (activeScroller) setElementScrollTop(activeScroller, 0);
        });
        showAppChrome();
    }

    function settleScrollPosition() {
        cancelScrollSettling(false);
        settlingScroll = true;
        resetScrollPosition();
        const firstFrame = requestAnimationFrame(() => {
            resetScrollPosition();
            const secondFrame = requestAnimationFrame(resetScrollPosition);
            restoreFrames.push(secondFrame);
        });
        restoreFrames.push(firstFrame);
        [80, 260, 620].forEach((delay, index) => {
            const timer = setTimeout(() => {
                resetScrollPosition();
                if (index === 2) {
                    settlingScroll = false;
                    restoreTimers = [];
                    restoreFrames = [];
                    clearReloadMarker();
                    restoreScrollRestoration();
                }
            }, delay);
            restoreTimers.push(timer);
        });
    }

    function cancelScrollSettling(clearMarker?) {
        restoreTimers.forEach(clearTimeout);
        restoreFrames.forEach(cancelAnimationFrame);
        restoreTimers = [];
        restoreFrames = [];
        settlingScroll = false;
        if (clearMarker !== false) {
            clearReloadMarker();
            restoreScrollRestoration();
        }
    }

    // ⛔ ការប៉ះខាងក្រៅម៉ឺនុយ (...) បិទវានៅ `pointerdown` (capture) **មុន** `touchstart` ➜
    //    ចងចាំស្ថានភាពស្រទាប់ **មុន** ការបិទនោះ (window capture ឈរមុន document capture) ➜
    //    ការប៉ះដែលបិទស្រទាប់ មិនផ្ទុកទំព័រឡើងវិញ (ស្តង់ដា ៖ ការប៉ះដំបូងបិទស្រទាប់ប៉ុណ្ណោះ)
    window.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        overlayAtPointerDown = ptrBlockedByOverlay();
    }, { capture: true, passive: true });

    const restoringAfterPull = hasReloadMarker();
    if (restoringAfterPull) {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        settleScrollPosition();
        window.addEventListener('pageshow', () => {
            if (settlingScroll) settleScrollPosition();
        }, { once: true });
    }

    document.addEventListener('touchstart', (e) => {
        resetScrollerMemo();
        touchId = null;
        tracking = false;
        engaged = false;
        travel = 0;
        startScroller = null;
        startActiveScroller = null;
        if (refreshing) return;
        if (e.touches.length !== 1) {
            if (iosTouchArbiter.id !== null) blockPanelForIOSTouch('cancelled');
            park(false);
            return;
        }
        const touch = e.touches[0];
        beginIOSTouch(touch);
        touchId = touch.identifier;
        startY = touch.clientY;
        startX = touch.clientX;
        const overlayWasOpen = overlayAtPointerDown;
        overlayAtPointerDown = false;
        if (overlayWasOpen || startY > ptrStartZoneBottom()) return;
        const context = capturePullContext(e.target);
        if (!context) return;
        startScroller = context.scroller;
        startActiveScroller = context.activeScroller;
        tracking = true;
        iosTouchArbiter.phase = 'tracking';
        showIndicator({ snapping: false });
    }, { passive: true });

    function onPullTouchMove(e) {
        if (refreshing) return;
        if (e.touches.length !== 1) {
            if (iosTouchArbiter.id !== null) blockPanelForIOSTouch('cancelled');
            park(false);
            return;
        }
        if (touchId === null) return;
        const touch = touchByIdentifier(e.touches, touchId);
        if (!touch) { blockPanelForIOSTouch('cancelled'); park(false); return; }
        const deltaY = touch.clientY - startY;
        const deltaX = touch.clientX - startX;

        if (!tracking) {
            if (settlingScroll && (Math.abs(deltaY) >= AXIS_SLOP || Math.abs(deltaX) >= AXIS_SLOP)) cancelScrollSettling();
            return;
        }

        if (!engaged) {
            if (Math.abs(deltaY) < AXIS_SLOP && Math.abs(deltaX) < AXIS_SLOP) {
                if (claimBeforeSlop && deltaY > 0 && deltaY >= Math.abs(deltaX) * AXIS_RATIO && e.cancelable) e.preventDefault();
                return;
            }
            if (settlingScroll) cancelScrollSettling();
            if (deltaY <= 0 || deltaY < Math.abs(deltaX) * AXIS_RATIO) {
                park();
                return;
            }
            if (!e.cancelable || !pullContextStillValid(e.target)) { park(); return; }
            e.preventDefault();
            if (!e.defaultPrevented) { park(); return; }
            engaged = true;
            iosTouchArbiter.phase = 'held';
        }

        if (deltaY <= 0 || Math.abs(deltaX) > deltaY * 0.85 || !e.cancelable || !pullContextStillValid(e.target)) {
            park(iosTouchArbiter.blockPanel ? false : true);
            return;
        }
        e.preventDefault();
        if (!e.defaultPrevented) { park(); return; }
        if (deltaY >= ENGAGE_AT && !iosTouchArbiter.blockPanel) blockPanelForIOSTouch('ptr');
        const raw = deltaY - ENGAGE_AT;
        travel = raw > 0 ? dampen(raw) : 0;
        paint(travel);
    }

    document.addEventListener('touchend', (e) => {
        const endedTouchId = touchId;
        if (endedTouchId === null) {
            if (e.touches.length === 0) resetIOSTouchArbiter();
            return;
        }
        if (e.touches.length !== 0) {
            blockPanelForIOSTouch('cancelled');
            park(false);
            return;
        }
        const endedTouch = touchByIdentifier(e.changedTouches, endedTouchId);
        if (!endedTouch) { park(); return; }
        if (!tracking && !engaged) { park(); return; }
        const finalDeltaY = endedTouch.clientY - startY;
        const finalDeltaX = endedTouch.clientX - startX;
        const finalAxisValid = engaged ? Math.abs(finalDeltaX) <= finalDeltaY * 0.85 :
            finalDeltaY >= Math.abs(finalDeltaX) * AXIS_RATIO;
        if (finalDeltaY < AXIS_SLOP || !finalAxisValid ||
            !pullContextStillValid(e.target)) { park(); return; }
        if (finalDeltaY >= ENGAGE_AT && !iosTouchArbiter.blockPanel) blockPanelForIOSTouch('ptr');
        const finalRaw = finalDeltaY - ENGAGE_AT;
        travel = finalRaw > 0 ? dampen(finalRaw) : 0;
        paint(travel);
        tracking = false;
        engaged = false;
        if (travel >= TRIGGER_AT) {
            refreshing = true;
            blockPanelForIOSTouch('refreshing');
            touchId = null;
            startScroller = null;
            startActiveScroller = null;
            rememberScrollRestoration();
            markReload();
            resetScrollPosition();
            showIndicator({ snapping: true, spinning: true, opacity: '1', transform: 'translateY(' + (REST_Y + TRIGGER_AT) + 'px)' });
            setTimeout(() => window.location.reload(), 300);
            reloadWatchdog = setTimeout(() => {
                refreshing = false;
                reloadWatchdog = null;
                clearReloadMarker();
                restoreScrollRestoration();
                park();
            }, 5000);
            return;
        }
        park();
    }, { passive: true });

    document.addEventListener('touchcancel', (e) => {
        if (refreshing) return;
        blockPanelForIOSTouch('cancelled');
        park(e.touches.length === 0);
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !refreshing) park();
    });

    document.addEventListener('click', (e) => {
        if (!refreshing) return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);

    window.addEventListener('beforeunload', () => {
        if (!refreshing || reloadWatchdog === null) return;
        clearTimeout(reloadWatchdog);
        reloadWatchdog = null;
    });

    // ⛔ listener `touchmove` (non-passive) ត្រូវមាន **មុន** `touchstart` (Safari កំណត់ cancelability
    //    មុនវាចប់) ➜ តាមដាន **state** ដែលសម្រេចថា PTR អាចកើត (ផ្ទាំងបង្រួម · ស្វែងរក · ប្រវត្តិពង្រីក ·
    //    ទំព័រ) — ដូចការតាមដាន class ពីមុន តែមិនអាន DOM។
    uiState.subscribe(syncPullMoveListener);

    park();
    syncPullMoveListener();
    showIndicator({ snapping: false });
}
