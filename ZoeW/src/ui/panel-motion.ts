import { byId } from '../core/dom';
import { uiState } from '../core/state';
import { hidePhoneSuggestions, setPhoneSearchPulledUp } from '../features/phone-suggest';
import { entryScrollerInView, syncHistoryExpandedLock, usesIOSPanelHandoff } from './page-nav';

export const PANEL_GLIDE_MS = 220;

export const PANEL_GLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export const PANEL_GLIDE_SNAP_GRACE_MS = 260;

export function panelMotionAllowed() {
    if (window.innerWidth >= 992) return false;
    if (typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function beginPanelGlideSnapPause() {
    const pages = byId('appPages');
    if (!pages) return () => {};
    const epoch = uiState.panelGlideEpoch;
    uiState.panelGlideTokens++;
    pages.classList.add('panel-gliding');
    if (uiState.panelGlideRelease !== null) clearTimeout(uiState.panelGlideRelease);
    uiState.panelGlideRelease = setTimeout(endPanelGlideSnapPause, PANEL_GLIDE_MS + PANEL_GLIDE_SNAP_GRACE_MS);
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
    const pages = byId('appPages');
    if (pages) pages.classList.remove('panel-gliding');
}

export function panelGlideFrom(el, beforeTop) {
    if (!el || typeof el.animate !== 'function' || !isFinite(beforeTop)) return;
    if (!panelMotionAllowed()) return;
    const delta = beforeTop - el.getBoundingClientRect().top;
    if (!isFinite(delta) || Math.abs(delta) < 2) return;
    const release = beginPanelGlideSnapPause();
    try {
        const anim = el.animate([
            { transform: 'translate3d(0,' + delta + 'px,0)' },
            { transform: 'translate3d(0,0,0)' }
        ], { duration: PANEL_GLIDE_MS, easing: PANEL_GLIDE_EASING });
        if (anim && anim.finished && typeof anim.finished.then === 'function') anim.finished.then(release, release);
        else if (anim) anim.onfinish = release;
    } catch (e) {
        release();
    }
}

export function setupSwipeGestures() {
    bindPanelSwipe({
        sideId: 'dataSideSection',
        mainId: 'dataMainSection',
        handleId: 'dragHandle',
        scroller: () => byId('tableResponsive'),
        blockCollapse: phoneSearchIsActive
    });
    bindPanelSwipe({
        sideId: 'entrySideSection',
        mainId: 'entryMainSection',
        handleId: 'entryDragHandle',
        scroller: entryScrollerInView,
        blockCollapse: () => false
    });
    syncHistoryExpandedLock();
}

export function phoneSearchIsActive() {
    const box = byId('phoneSuggestBox');
    if (box && box.classList.contains('show')) return true;
    const input = byId('searchPhoneInput');
    return !!(input && document.activeElement === input && input.value.trim());
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
    const sidebar = byId(config.sideId);
    const mainSection = byId(config.mainId);
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
        const beforeTop = mainSection.getBoundingClientRect().top;
        if (action === 'collapse') sidebar.classList.add('collapsed');
        else if (action === 'expand') sidebar.classList.remove('collapsed');
        else if (action === 'search') setPhoneSearchPulledUp(false);
        syncHistoryExpandedLock();
        panelGlideFrom(mainSection, beforeTop);
    }

    function actionForMainDiff(diffY, diffX) {
        if (Math.abs(diffY) < Math.abs(diffX) * 1.6) return '';
        if (diffY < -30 && !sidebar.classList.contains('collapsed') && !config.blockCollapse()) return 'collapse';
        if (diffY > 30 && scrollerAtTop() && sidebar.classList.contains('collapsed')) return 'expand';
        if (diffY > 30 && scrollerAtTop() && sidebar.classList.contains('search-focus')) return 'search';
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
            sidebar.classList.contains('collapsed') && e.cancelable) {
            e.preventDefault();
        }
        if (!downward) scrollerPendingExpand = false;
        else if (reachedTop && diffY > 30 && sidebar.classList.contains('collapsed')) scrollerPendingExpand = true;
    };
    const scrollerScroll = () => {
        const downward = scrollerLastDiffY > 30 &&
            Math.abs(scrollerLastDiffY) >= Math.abs(scrollerLastDiffX) * 1.6;
        if (scrollerTouchId !== null && downward && scrollerAtTop() &&
            sidebar.classList.contains('collapsed')) scrollerPendingExpand = true;
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
        const shouldExpand = finalDownward && sidebar.classList.contains('collapsed') &&
            (iosPanelHandoff ? (scrollerPendingExpand || scrollerAtTop()) : scrollerAtTop());
        scrollerPendingExpand = false;
        scrollerTouchId = null;
        scrollerLastDiffY = 0;
        scrollerLastDiffX = 0;
        if (apply && shouldExpand && !panelBlockedForTouch(endedTouchId)) applyPanelAction('expand');
    };
    [byId('tableResponsive'), byId('entryTableResponsive'),
     byId('lockerTableResponsive')].forEach((el) => {
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

    const dragHandle = byId(config.handleId);
    if (dragHandle) {
        dragHandle.addEventListener('click', () => {
            if (!sidebar.classList.contains('collapsed')) hidePhoneSuggestions();
            setPhoneSearchPulledUp(false);
            const beforeTop = mainSection.getBoundingClientRect().top;
            sidebar.classList.toggle('collapsed');
            syncHistoryExpandedLock();
            panelGlideFrom(mainSection, beforeTop);
        });
    }
}
