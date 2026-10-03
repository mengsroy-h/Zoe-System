import { scrollThumbState, uiState } from '../../core/state';
import { drawsOwnScrollThumb } from '../../platform/native';
import { isSideDrawerOpen } from '../../ui/page-nav';
import { renderNow } from '../flush';

export const SCROLL_THUMB_WIDTH_PX = 3;
export const SCROLL_THUMB_INSET_PX = 2;
export const SCROLL_THUMB_MIN_PX = 24;
export const SCROLL_THUMB_IDLE_MS = 900;

function pxOf(value) {
    const n = parseFloat(String(value || ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function scrollThumbBand(rect, viewportHeight, overlayOpen, chromeTop, chromeBottom) {
    if (!rect || !(viewportHeight > 0)) return null;
    let top = Math.max(rect.top, 0);
    let bottom = Math.min(rect.bottom, viewportHeight);
    if (!overlayOpen) {
        top = Math.max(top, chromeTop);
        bottom = Math.min(bottom, viewportHeight - chromeBottom);
    }
    top += SCROLL_THUMB_INSET_PX;
    bottom -= SCROLL_THUMB_INSET_PX;
    return bottom - top >= SCROLL_THUMB_MIN_PX ? { top, bottom } : null;
}

export function scrollThumbGeometry(rect, band, scrollTop, scrollHeight, clientHeight) {
    const range = scrollHeight - clientHeight;
    if (!rect || !band || !(range > 1) || !(clientHeight > 0)) return null;
    const track = band.bottom - band.top;
    const h = Math.min(track, Math.max(SCROLL_THUMB_MIN_PX, Math.round(track * clientHeight / scrollHeight)));
    const ratio = Math.min(1, Math.max(0, scrollTop / range));
    return {
        x: Math.round(rect.right - SCROLL_THUMB_INSET_PX - SCROLL_THUMB_WIDTH_PX),
        y: Math.round(band.top + (track - h) * ratio),
        h
    };
}

function verticalScroller(el) {
    if (!el || el.nodeType !== 1) return false;
    const overflowY = window.getComputedStyle(el).overflowY;
    return overflowY === 'auto' || overflowY === 'scroll';
}

export function setupScrollThumb() {
    if (!drawsOwnScrollThumb()) return false;
    const lastTop = new WeakMap();
    let pending = null;
    let frame = null;
    let idleTimer = null;
    let view = null;

    const publish = (next) => {
        view = next;
        scrollThumbState.view = next;
        renderNow(scrollThumbState);
    };

    const hide = () => {
        idleTimer = null;
        if (view && view.shown) publish({ ...view, shown: false });
    };

    const process = () => {
        frame = null;
        const el = pending;
        pending = null;
        if (!verticalScroller(el)) return;
        const top = el.scrollTop;
        if (lastTop.get(el) === top) return;
        lastTop.set(el, top);
        const rect = el.getBoundingClientRect();
        const overlayOpen = !!uiState.isModalOpen || isSideDrawerOpen() || el.closest('.modal, .side-drawer') !== null;
        const chromeBottom = uiState.chromeHidden ? 0 : pxOf(uiState.tabbarHeightVar);
        const band = scrollThumbBand(rect, window.innerHeight, overlayOpen, pxOf(uiState.chromeTopVar), chromeBottom);
        const geo = scrollThumbGeometry(rect, band, top, el.scrollHeight, el.clientHeight);
        if (!geo) return;
        publish({ ...geo, shown: true });
        if (idleTimer !== null) clearTimeout(idleTimer);
        idleTimer = setTimeout(hide, SCROLL_THUMB_IDLE_MS);
    };

    document.addEventListener('scroll', (event) => {
        const target = event.target && (event.target as any).nodeType === 1 ? event.target : null;
        if (!target) return;
        pending = target;
        if (frame !== null) return;
        frame = requestAnimationFrame(process);
    }, { capture: true, passive: true });
    return true;
}
