import { uiState } from '../../core/state';
import { hidePhoneSuggestions } from '../../features/phone-suggest';
import { commitNow } from '../flush';
import { animateElement, elementOf, fieldValue, isFieldFocused, type RefName } from '../refs';
import { entryScrollerInView, panelHasSearchFocus, panelIsCollapsed, setPanelCollapsed, syncHistoryExpandedLock, usesIOSPanelHandoff, type PanelKey } from './panels';
import { setPhoneSearchPulledUp } from './phone-search';

export const PANEL_GLIDE_MS = 220;

export const PANEL_GLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export const PANEL_GLIDE_SNAP_GRACE_MS = 260;

export const PANEL_SEARCH_GLIDE_MS = 280;

export const PANEL_SEARCH_GLIDE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

export const PANEL_GLIDE_HOLD_MAX_MS = 250;

export const PANEL_GLIDE_FLOW_FRAME_MS = 34;

export interface PanelGlideMotion {
    duration: number;
    easing: string;
    holdUntilFramesFlow: boolean;
}

export const PANEL_SEARCH_GLIDE: PanelGlideMotion = {
    duration: PANEL_SEARCH_GLIDE_MS,
    easing: PANEL_SEARCH_GLIDE_EASING,
    holdUntilFramesFlow: true
};

export interface PanelGlide {
    running(): boolean;
    settled(): Promise<boolean>;
}

const panelGlideAnimations = new WeakMap<Element, Animation>();

export function panelMotionAllowed() {
    if (window.innerWidth >= 992) return false;
    if (typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function beginPanelGlideSnapPause(spanMs = PANEL_GLIDE_MS) {
    const pages = elementOf('appPages');
    if (!pages) return () => {};
    const epoch = uiState.panelGlideEpoch;
    uiState.panelGlideTokens++;
    uiState.panelGliding = true;
    commitNow();
    if (uiState.panelGlideRelease !== null) clearTimeout(uiState.panelGlideRelease);
    uiState.panelGlideRelease = setTimeout(endPanelGlideSnapPause, spanMs + PANEL_GLIDE_SNAP_GRACE_MS);
    let done = false;
    return () => {
        if (done) return;
        done = true;
        if (epoch !== uiState.panelGlideEpoch) return;
        uiState.panelGlideTokens--;
        if (uiState.panelGlideTokens <= 0) endPanelGlideSnapPause();
    };
}

export function endPanelGlideSnapPause() {
    uiState.panelGlideEpoch++;
    uiState.panelGlideTokens = 0;
    if (uiState.panelGlideRelease !== null) {
        clearTimeout(uiState.panelGlideRelease);
        uiState.panelGlideRelease = null;
    }
    uiState.panelGliding = false;
}

export function stopPanelGlide(el) {
    const previous = el ? panelGlideAnimations.get(el) : null;
    if (!previous) return;
    panelGlideAnimations.delete(el);
    try {
        if (typeof previous.cancel === 'function') previous.cancel();
    } catch (e) {}
}

export function playPanelGlideWhenFramesFlow(play) {
    if (typeof requestAnimationFrame !== 'function') {
        play();
        return;
    }
    let done = false;
    let last = -1;
    const fire = () => {
        if (done) return;
        done = true;
        clearTimeout(ceiling);
        play();
    };
    const ceiling = setTimeout(fire, PANEL_GLIDE_HOLD_MAX_MS);
    const tick = (now) => {
        if (done) return;
        if (last >= 0 && now - last <= PANEL_GLIDE_FLOW_FRAME_MS) {
            fire();
            return;
        }
        last = now;
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

export function panelGlideFrom(el, beforeTop, motion?: PanelGlideMotion): PanelGlide | null {
    if (!el || typeof el.animate !== 'function' || !isFinite(beforeTop)) return null;
    if (!panelMotionAllowed()) return null;
    stopPanelGlide(el);
    const delta = beforeTop - el.getBoundingClientRect().top;
    if (!isFinite(delta) || Math.abs(delta) < 2) return null;
    const timing = { duration: motion ? motion.duration : PANEL_GLIDE_MS, easing: motion ? motion.easing : PANEL_GLIDE_EASING };
    const keyframes = [
        { transform: 'translate3d(0,' + delta + 'px,0)' },
        { transform: 'translate3d(0,0,0)' }
    ];
    const holding = !!(motion && motion.holdUntilFramesFlow);
    const release = beginPanelGlideSnapPause(timing.duration + (holding ? PANEL_GLIDE_HOLD_MAX_MS : 0));
    let anim: Animation | null;
    try {
        anim = animateElement(el, keyframes, timing);
        if (anim) panelGlideAnimations.set(el, anim);
        if (anim && holding && typeof anim.pause === 'function') anim.pause();
        if (anim && anim.finished && typeof anim.finished.then === 'function') anim.finished.then(release, release);
        else if (anim) anim.onfinish = release;
    } catch (e) {
        release();
        return null;
    }
    if (!anim) return null;
    const lead = anim;
    if (holding) {
        playPanelGlideWhenFramesFlow(() => {
            if (panelGlideAnimations.get(el) !== lead || lead.playState !== 'paused') return;
            try { lead.play(); } catch (e) {}
        });
    }
    const running = () => panelGlideAnimations.get(el) === lead && lead.playState !== 'finished' && lead.playState !== 'idle';
    const settled = lead.finished && typeof lead.finished.then === 'function'
        ? lead.finished.then(() => panelGlideAnimations.get(el) === lead, () => false)
        : Promise.resolve(true);
    return { running: running, settled: () => settled };
}

export function setupSwipeGestures() {
    bindPanelSwipe({
        panel: 'data',
        sideId: 'dataSideSection',
        mainId: 'dataMainSection',
        scroller: () => elementOf('tableResponsive'),
        blockCollapse: phoneSearchIsActive
    });
    bindPanelSwipe({
        panel: 'entry',
        sideId: 'entrySideSection',
        mainId: 'entryMainSection',
        scroller: entryScrollerInView,
        blockCollapse: () => false
    });
    syncHistoryExpandedLock();
}

export function phoneSearchIsActive() {
    if (uiState.phoneSuggestOpen || uiState.dataPanelSearchFocus) return true;
    return !!(isFieldFocused('searchPhoneInput') && fieldValue('searchPhoneInput').trim());
}

export const iosTouchArbiter = { id: null, phase: 'idle', blockPanel: false };

export function beginIOSTouch(touch) {
    iosTouchArbiter.id = touch.identifier;
    iosTouchArbiter.phase = 'possible';
    iosTouchArbiter.blockPanel = false;
}

export function blockPanelForIOSTouch(phase) {
    iosTouchArbiter.phase = phase;
    iosTouchArbiter.blockPanel = true;
}

export function resetIOSTouchArbiter() {
    iosTouchArbiter.id = null;
    iosTouchArbiter.phase = 'idle';
    iosTouchArbiter.blockPanel = false;
}

export function panelBlockedForTouch(identifier) {
    if (iosTouchArbiter.phase === 'refreshing') return true;
    return iosTouchArbiter.id === identifier && iosTouchArbiter.blockPanel;
}

export function panelMayYieldToPTR(identifier) {
    return iosTouchArbiter.id === identifier &&
        (iosTouchArbiter.phase === 'tracking' || iosTouchArbiter.phase === 'held' || iosTouchArbiter.phase === 'ptr');
}

export function touchByIdentifier(list, identifier) {
    if (!list || identifier === null) return null;
    for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === identifier) return list[i];
    }
    return null;
}

export function bindPanelSwipe(config) {
    const sidebar = elementOf(config.sideId);
    const mainSection = elementOf(config.mainId);
    if (!sidebar || !mainSection) return;
    const iosPanelHandoff = usesIOSPanelHandoff();

    let startY = 0;
    let startX = 0;
    let isDragging = false;
    let pendingAction = '';
    let mainTouchId = null;
    let scrollerStartY = 0;
    let scrollerStartX = 0;
    let scrollerPendingExpand = false;
    let scrollerTouchId = null;
    let scrollerLastDiffY = 0;
    let scrollerLastDiffX = 0;

    function scrollTopOf() {
        const el = config.scroller();
        return el ? el.scrollTop : 0;
    }

    function scrollerAtTop() {
        return scrollTopOf() <= (iosPanelHandoff ? 1 : 0);
    }

    function applyPanelAction(action) {
        if (!action) return;
        commitNow();
        const beforeTop = mainSection.getBoundingClientRect().top;
        if (action === 'collapse') setPanelCollapsed(config.panel, true);
        else if (action === 'expand') setPanelCollapsed(config.panel, false);
        else if (action === 'search') setPhoneSearchPulledUp(false);
        syncHistoryExpandedLock();
        panelGlideFrom(mainSection, beforeTop);
    }

    function actionForMainDiff(diffY, diffX) {
        if (Math.abs(diffY) < Math.abs(diffX) * 1.6) return '';
        if (diffY < -30 && !panelIsCollapsed(config.panel) && !config.blockCollapse()) return 'collapse';
        if (diffY > 30 && scrollerAtTop() && panelIsCollapsed(config.panel)) return 'expand';
        if (diffY > 30 && scrollerAtTop() && panelHasSearchFocus(config.panel)) return 'search';
        return '';
    }

    function finishMainSwipe(e, apply) {
        const endedTouchId = mainTouchId;
        const endedTouch = endedTouchId !== null && e.touches.length === 0 ?
            touchByIdentifier(e.changedTouches, endedTouchId) : null;
        const finalDiffY = endedTouch ? endedTouch.clientY - startY : 0;
        const finalDiffX = endedTouch ? endedTouch.clientX - startX : 0;
        if (endedTouch && finalDiffY >= 56 && panelMayYieldToPTR(endedTouchId)) blockPanelForIOSTouch('ptr');
        pendingAction = endedTouch ? actionForMainDiff(finalDiffY, finalDiffX) : '';
        isDragging = false;
        mainTouchId = null;
        const action = pendingAction;
        pendingAction = '';
        if (apply && endedTouch && !panelBlockedForTouch(endedTouchId)) applyPanelAction(action);
    }

    const scrollerTouchStart = (e) => {
        scrollerPendingExpand = false;
        scrollerTouchId = null;
        scrollerLastDiffY = 0;
        scrollerLastDiffX = 0;
        if (e.touches.length !== 1) return;
        scrollerTouchId = e.touches[0].identifier;
        scrollerStartY = e.touches[0].clientY;
        scrollerStartX = e.touches[0].clientX;
    };
    const scrollerTouchMove = (e) => {
        if (e.touches.length !== 1 || window.innerWidth >= 992) {
            scrollerPendingExpand = false;
            scrollerTouchId = null;
            scrollerLastDiffY = 0;
            scrollerLastDiffX = 0;
            return;
        }
        const touch = touchByIdentifier(e.touches, scrollerTouchId);
        if (!touch) {
            scrollerPendingExpand = false;
            scrollerTouchId = null;
            scrollerLastDiffY = 0;
            scrollerLastDiffX = 0;
            return;
        }
        const diffY = touch.clientY - scrollerStartY;
        const diffX = touch.clientX - scrollerStartX;
        scrollerLastDiffY = diffY;
        scrollerLastDiffX = diffX;
        const downward = diffY > 0 && Math.abs(diffY) >= Math.abs(diffX) * 1.6;
        const reachedTop = scrollerAtTop();
        if (iosPanelHandoff && reachedTop && diffY >= 8 && downward &&
            panelIsCollapsed(config.panel) && e.cancelable) {
            e.preventDefault();
        }
        if (!downward) scrollerPendingExpand = false;
        else if (reachedTop && diffY > 30 && panelIsCollapsed(config.panel)) scrollerPendingExpand = true;
    };
    const scrollerScroll = () => {
        const downward = scrollerLastDiffY > 30 &&
            Math.abs(scrollerLastDiffY) >= Math.abs(scrollerLastDiffX) * 1.6;
        if (scrollerTouchId !== null && downward && scrollerAtTop() &&
            panelIsCollapsed(config.panel)) scrollerPendingExpand = true;
    };
    const finishScrollerSwipe = (e, apply) => {
        const endedTouchId = scrollerTouchId;
        const endedTouch = endedTouchId !== null && e.touches.length === 0 ?
            touchByIdentifier(e.changedTouches, endedTouchId) : null;
        const finalDiffY = endedTouch ? endedTouch.clientY - scrollerStartY : 0;
        const finalDiffX = endedTouch ? endedTouch.clientX - scrollerStartX : 0;
        if (endedTouch && finalDiffY >= 56 && panelMayYieldToPTR(endedTouchId)) blockPanelForIOSTouch('ptr');
        const finalDownward = !!endedTouch && finalDiffY > 30 &&
            Math.abs(finalDiffY) >= Math.abs(finalDiffX) * 1.6;
        const shouldExpand = finalDownward && panelIsCollapsed(config.panel) &&
            (iosPanelHandoff ? (scrollerPendingExpand || scrollerAtTop()) : scrollerAtTop());
        scrollerPendingExpand = false;
        scrollerTouchId = null;
        scrollerLastDiffY = 0;
        scrollerLastDiffX = 0;
        if (apply && shouldExpand && !panelBlockedForTouch(endedTouchId)) applyPanelAction('expand');
    };
    [elementOf('tableResponsive'), elementOf('entryTableResponsive'),
     elementOf('lockerTableResponsive')].forEach((el) => {
        if (!el || !mainSection.contains(el)) return;
        el.addEventListener('touchstart', scrollerTouchStart, { passive: true });
        el.addEventListener('touchmove', scrollerTouchMove, { passive: !iosPanelHandoff });
        if (iosPanelHandoff) el.addEventListener('scroll', scrollerScroll, { passive: true });
        el.addEventListener('touchend', (e) => finishScrollerSwipe(e, true), { passive: true });
        el.addEventListener('touchcancel', (e) => finishScrollerSwipe(e, false), { passive: true });
    });

    mainSection.addEventListener('touchstart', (e) => {
        pendingAction = '';
        mainTouchId = null;
        if (window.innerWidth >= 992 || e.touches.length !== 1) { isDragging = false; return; }
        mainTouchId = e.touches[0].identifier;
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        isDragging = true;
    }, { passive: true });

    mainSection.addEventListener('touchmove', (e) => {
        if (window.innerWidth >= 992 || e.touches.length !== 1) {
            isDragging = false;
            pendingAction = '';
            mainTouchId = null;
            return;
        }
        if (!isDragging) return;
        const touch = touchByIdentifier(e.touches, mainTouchId);
        if (!touch) { isDragging = false; pendingAction = ''; mainTouchId = null; return; }
        pendingAction = actionForMainDiff(touch.clientY - startY, touch.clientX - startX);
    }, { passive: true });

    mainSection.addEventListener('touchend', (e) => finishMainSwipe(e, true));
    mainSection.addEventListener('touchcancel', (e) => finishMainSwipe(e, false));
}

const PANEL_SECTIONS: Record<PanelKey, { side: RefName; main: RefName }> = {
    data: { side: 'dataSideSection', main: 'dataMainSection' },
    entry: { side: 'entrySideSection', main: 'entryMainSection' }
};

export function togglePanelFromHandle(panel: PanelKey) {
    const sections = PANEL_SECTIONS[panel];
    const mainSection = elementOf(sections.main);
    if (!elementOf(sections.side) || !mainSection) return;
    if (!panelIsCollapsed(panel)) hidePhoneSuggestions();
    setPhoneSearchPulledUp(false);
    commitNow();
    const beforeTop = mainSection.getBoundingClientRect().top;
    setPanelCollapsed(panel, !panelIsCollapsed(panel));
    syncHistoryExpandedLock();
    panelGlideFrom(mainSection, beforeTop);
}
