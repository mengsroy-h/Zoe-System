import { uiState } from '../../core/state';
import { hideAppChrome, showAppChrome } from '../../ui/chrome-autohide';
import { isSideDrawerOpen } from '../../ui/page-nav';
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
        if (topHeight > 0) document.documentElement.style.setProperty('--chrome-top', topHeight + 'px');
    }
    if (tabbar) {
        const pageHeight = document.body.getBoundingClientRect().height;
        const pageExtension = Math.max(0, Math.round(pageHeight - window.innerHeight));
        const bottomHeight = Math.round(tabbar.offsetHeight + pageExtension);
        document.documentElement.style.setProperty('--tabbar-height', Math.round(tabbar.offsetHeight) + 'px');
        document.documentElement.style.setProperty('--page-extension', pageExtension + 'px');
        if (bottomHeight > 0) document.documentElement.style.setProperty('--chrome-bottom', bottomHeight + 'px');
    }
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

    const processScroll = () => {
        scrollFrame = null;
        const el = pendingScroller;
        pendingScroller = null;
        if (window.innerWidth >= 992) { showAppChrome(); return; }
        if (uiState.isModalOpen || isSideDrawerOpen()) { showAppChrome(); return; }
        if (!el || typeof el.scrollTop !== 'number') return;
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

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
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
