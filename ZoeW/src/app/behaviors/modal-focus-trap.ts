import { securityState, uiState } from '../../core/state';
import { modalElement } from '../components/modals/Modal';
import { topmostModal } from '../lifecycle/layers';
import type { LifecycleScope } from '../lifecycle/scope';
import { blurActiveElement, elementOf, focusElementWithoutScroll } from '../refs';

const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
const FOCUS_OUTSIDE_LAYER = '.toast-container';

let tabBackwards = false;

export function focusTrapLayer(): HTMLElement | null {
    if (securityState.appIsLocked) {
        const pin = elementOf('appLockPinInput');
        return pin ? (pin.closest('.app-lock') as HTMLElement | null) : null;
    }
    if (!uiState.isModalOpen) return null;
    const id = topmostModal();
    return id ? modalElement(id) : null;
}

function focusableIn(layer: HTMLElement): HTMLElement[] {
    return Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0 && window.getComputedStyle(el).visibility !== 'hidden');
}

export function keepFocusInLayer(e: FocusEvent): void {
    const target = e.target as HTMLElement | null;
    const layer = focusTrapLayer();
    if (!layer || !target || typeof target.closest !== 'function' || layer.contains(target) || target.closest(FOCUS_OUTSIDE_LAYER)) return;
    const items = focusableIn(layer);
    const next = items.length ? items[tabBackwards ? items.length - 1 : 0] : null;
    if (next && focusElementWithoutScroll(next)) return;
    if (document.activeElement === target) blurActiveElement();
}

function noteTabDirection(e: KeyboardEvent): void {
    if (e.key === 'Tab') tabBackwards = e.shiftKey;
}

export function listenModalFocusTrap(scope: LifecycleScope): void {
    tabBackwards = false;
    scope.listen(document, 'keydown', noteTabDirection, { capture: true });
    scope.listen(document, 'focusin', keepFocusInLayer, { capture: true });
}
