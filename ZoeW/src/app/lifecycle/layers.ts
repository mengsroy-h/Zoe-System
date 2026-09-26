import { modalMeta, openModalIds } from '../../core/modals';
import { uiState } from '../../core/state';
import { dismissModal } from '../../ui/modal-stack';
import { closeGlobalMoreMenu } from '../../ui/more-menu';
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
        if (modalElement(id) === target) return modalMeta(id) ? id : null;
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
