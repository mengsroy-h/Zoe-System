import { BACKDROP_KEEP_MODALS, modalMeta, openModalIds } from '../../core/modals';
import { uiState } from '../../core/state';
import { dismissModal } from '../../ui/modal-stack';
import { closeGlobalMoreMenu, moreMenuAnchor, moreMenuOpenedAt } from '../../ui/more-menu';
import { closeSideDrawer, isSideDrawerOpen } from '../../ui/page-nav';
import { modalElement } from '../components/modals/Modal';
import { elementOf } from '../refs';

export function topmostModal(): string | null {
    let top: string | null = null;
    let topZ = -Infinity;
    openModalIds().forEach((id) => {
        const el = modalElement(id);
        if (!el) return;
        const parsed = parseInt(window.getComputedStyle(el).zIndex, 10);
        const z = isNaN(parsed) ? 0 : parsed;
        if (z >= topZ) { topZ = z; top = id; }
    });
    return top;
}

export function closeTopmostLayer(options: { includeMoreMenu: boolean }): boolean {
    if (options.includeMoreMenu && uiState.moreMenuOpen) {
        closeGlobalMoreMenu();
        return true;
    }
    const top = topmostModal();
    if (top) {
        dismissModal(top);
        return true;
    }
    if (isSideDrawerOpen()) {
        closeSideDrawer();
        return true;
    }
    return false;
}

export function modalBackdropTarget(target: EventTarget | null): string | null {
    for (const id of openModalIds()) {
        if (modalElement(id) !== target) continue;
        return modalMeta(id) && !BACKDROP_KEEP_MODALS.includes(id) ? id : null;
    }
    return null;
}

export function dismissGlobalMoreMenuOutside(e) {
    const target = e.target;
    if (target && target.closest) {
        const menu = elementOf('globalMoreMenu');
        if (menu && menu.contains(target)) return;
        if (e.type === 'click' && target.closest('.more-btn, .header-more-btn')) return;
    }
    closeGlobalMoreMenu();
}

export const MORE_MENU_WHEEL_GAP_MS = 150;

let moreMenuInputAt = -Infinity;
let moreMenuWheelAt = -Infinity;

export function noteMoreMenuInput(event?: Event): void {
    const target = event ? event.target as Node | null : null;
    const menu = elementOf('globalMoreMenu');
    const anchor = moreMenuAnchor() as Node | null;
    if (target && target.nodeType === 1 && ((menu && menu.contains(target)) || (anchor && anchor.contains(target)))) return;
    const now = performance.now();
    if (event && event.type === 'wheel') {
        const continued = now - moreMenuWheelAt <= MORE_MENU_WHEEL_GAP_MS;
        moreMenuWheelAt = now;
        if (continued) return;
    }
    moreMenuInputAt = now;
}

export function moreMenuScrollDismisses(scrolled: EventTarget | null): boolean {
    const node = scrolled as Node | null;
    const menu = elementOf('globalMoreMenu');
    if (node && menu && node.nodeType === 1 && menu.contains(node)) return false;
    const anchor = moreMenuAnchor() as Node | null;
    if (!anchor || !anchor.isConnected || !node || typeof node.contains !== 'function' || node.contains(anchor)) return true;
    return moreMenuInputAt > moreMenuOpenedAt();
}
