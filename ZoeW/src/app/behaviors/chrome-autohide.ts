import { uiState } from '../../core/state';
import { hideAppChrome, showAppChrome } from '../../ui/chrome-autohide';
import { commitNow } from '../flush';
import { elementOf } from '../refs';

export function appChromeElements() {
    return {
        navbar: elementOf('navbar'),
        tabbar: elementOf('pageTabBar')
    };
}

export function measureAppChromeSize() {
    const { navbar, tabbar } = appChromeElements();
    if (navbar) {
        const topHeight = navbar.offsetHeight;
        if (topHeight > 0) uiState.chromeTopVar = topHeight + 'px';
    }
    if (tabbar) {
        const pageHeight = document.body.getBoundingClientRect().height;
        const pageExtension = Math.max(0, Math.round(pageHeight - window.innerHeight));
        const bottomHeight = Math.round(tabbar.offsetHeight + pageExtension);
        uiState.tabbarHeightVar = Math.round(tabbar.offsetHeight) + 'px';
        uiState.pageExtensionVar = pageExtension + 'px';
        if (bottomHeight > 0) uiState.chromeBottomVar = bottomHeight + 'px';
    }
    commitNow();
}

export function scrollerOf(target) {
    let node = (target && target.nodeType === 1) ? target : null;
    while (node) {
        if (node.scrollHeight - node.clientHeight > 1) {
            const overflowY = window.getComputedStyle(node).overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll') return node;
        }
        node = node.parentElement;
    }
    return null;
}

export const CHROME_SCROLL_INTENT_MS = 1200;

export const CHROME_FLIP_SETTLE_MS = 250;

export function setupChromeAutoHide() {
    const pages = elementOf('appPages');
    const { navbar, tabbar } = appChromeElements();
    if (!pages || !navbar || !tabbar) return;

    const TOP_ZONE = 56;
    const HIDE_AFTER = 36;
    const SHOW_AFTER = 48;
    const BOTTOM_ZONE = 24;
    const MAX_STEP = 120;

    let activeScroller = null;
    let lastScrollTop = 0;
    let travel = 0;
    let pendingScroller = null;
    let scrollFrame = null;
    let touching = false;
    let inputAt = -Infinity;
    let flipAt = -Infinity;
    let flipsSinceInput = 0;
    let hiddenSeen = uiState.chromeHidden;

    const noteInput = () => {
        inputAt = performance.now();
        flipsSinceInput = 0;
    };
    const noteTouch = (event) => {
        touching = !!(event.touches && event.touches.length);
        noteInput();
    };
    const notePointerMove = (event) => { if (event.buttons) noteInput(); };
    const userIsScrolling = (now) => (touching || now - inputAt <= CHROME_SCROLL_INTENT_MS)
        && flipsSinceInput === 0 && now - flipAt >= CHROME_FLIP_SETTLE_MS;
    uiState.subscribe(() => {
        if (uiState.chromeHidden === hiddenSeen) return;
        hiddenSeen = uiState.chromeHidden;
        flipAt = performance.now();
        flipsSinceInput++;
    });

    const processScroll = () => {
        scrollFrame = null;
        const el = pendingScroller;
        pendingScroller = null;
        if (window.innerWidth >= 992) { showAppChrome(); return; }
        if (!el || typeof el.scrollTop !== 'number') return;
        if (el.closest('.modal, .side-drawer')) return;
        if (el !== activeScroller) {
            activeScroller = el;
            lastScrollTop = el.scrollTop;
            travel = 0;
            return;
        }
        const top = el.scrollTop;
        const delta = top - lastScrollTop;
        lastScrollTop = top;
        if (!delta) return;
        if (top <= TOP_ZONE) { travel = 0; showAppChrome(); return; }
        if (!userIsScrolling(performance.now())) { travel = 0; return; }
        const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, delta));
        if (step > 0 && el.scrollHeight - top - el.clientHeight <= BOTTOM_ZONE) { travel = 0; return; }
        if ((step > 0) !== (travel > 0)) travel = 0;
        travel += step;
        if (travel > HIDE_AFTER) { travel = 0; hideAppChrome(); }
        else if (travel < -SHOW_AFTER) { travel = 0; showAppChrome(); }
    };

    const onScroll = (event) => {
        pendingScroller = (event.target && event.target.nodeType === 1) ? event.target : pages;
        if (scrollFrame !== null) return;
        scrollFrame = requestAnimationFrame(processScroll);
    };

    const listenOptions = { capture: true, passive: true };
    document.addEventListener('scroll', onScroll, listenOptions);
    document.addEventListener('touchstart', noteTouch, listenOptions);
    document.addEventListener('touchmove', noteInput, listenOptions);
    document.addEventListener('touchend', noteTouch, listenOptions);
    document.addEventListener('touchcancel', noteTouch, listenOptions);
    document.addEventListener('wheel', noteInput, listenOptions);
    document.addEventListener('keydown', noteInput, listenOptions);
    document.addEventListener('pointerdown', noteInput, listenOptions);
    document.addEventListener('pointermove', notePointerMove, listenOptions);
    window.addEventListener('resize', () => {
        measureAppChromeSize();
        if (window.innerWidth >= 992) showAppChrome();
    });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', measureAppChromeSize);
    if (window.ResizeObserver) {
        const chromeSizeObserver = new ResizeObserver(measureAppChromeSize);
        chromeSizeObserver.observe(navbar);
        chromeSizeObserver.observe(tabbar);
    }
    measureAppChromeSize();
    setTimeout(measureAppChromeSize, 300);
}
