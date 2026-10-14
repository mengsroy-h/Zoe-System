import { uiState } from '../../core/state';
import { commitNow } from '../flush';
import type { LifecycleScope } from '../lifecycle/scope';
import { setElementScrollTop } from '../refs';
import { KEYBOARD_MIN_INSET_PX } from './chrome-autohide';

export const MODAL_FIELD_MARGIN_PX = 12;

let modalWasOpen = false;

export function modalKeyboardViewport(): { top: number; height: number } | null {
    const vv = window.visualViewport;
    if (!vv || !uiState.isModalOpen) return null;
    const layout = window.innerHeight;
    const height = Math.round(vv.height);
    if (!Number.isFinite(layout) || !Number.isFinite(height) || height <= 0) return null;
    if (layout - height < KEYBOARD_MIN_INSET_PX) return null;
    const offset = Math.round(vv.offsetTop);
    const top = Number.isFinite(offset) ? Math.min(Math.max(0, offset), layout - height) : 0;
    return { top, height };
}

function scrollsY(node: Element): boolean {
    if (!(node.scrollHeight - node.clientHeight > 1)) return false;
    const overflowY = window.getComputedStyle(node).overflowY;
    return overflowY === 'auto' || overflowY === 'scroll';
}

function focusedModalField(): HTMLElement | null {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || typeof el.closest !== 'function') return null;
    return el.closest('.modal') ? el : null;
}

export function revealFocusedModalField(): void {
    const field = focusedModalField();
    if (!field) return;
    const modal = field.closest('.modal');
    for (let node = field.parentElement; node && node !== modal; node = node.parentElement) {
        if (!scrollsY(node)) continue;
        const box = node.getBoundingClientRect();
        const rect = field.getBoundingClientRect();
        const top = box.top + MODAL_FIELD_MARGIN_PX;
        const bottom = box.bottom - MODAL_FIELD_MARGIN_PX;
        let delta = rect.bottom > bottom ? rect.bottom - bottom : 0;
        if (rect.top - delta < top) delta = rect.top - top;
        if (delta) setElementScrollTop(node, node.scrollTop + delta);
    }
}

export function measureModalKeyboard(): void {
    modalWasOpen = uiState.isModalOpen;
    const next = modalKeyboardViewport();
    const top = next ? next.top : 0;
    const height = next ? next.height : 0;
    const changed = uiState.modalViewportTop !== top || uiState.modalViewportHeight !== height;
    if (uiState.modalViewportTop !== top) uiState.modalViewportTop = top;
    if (uiState.modalViewportHeight !== height) uiState.modalViewportHeight = height;
    if (!height) return;
    if (changed) commitNow();
    revealFocusedModalField();
}

function noteModalFocus(): void {
    if (uiState.modalViewportHeight > 0) revealFocusedModalField();
}

export function listenModalKeyboard(scope: LifecycleScope): void {
    modalWasOpen = false;
    if (uiState.modalViewportTop !== 0) uiState.modalViewportTop = 0;
    if (uiState.modalViewportHeight !== 0) uiState.modalViewportHeight = 0;
    const vv = window.visualViewport;
    if (!vv) return;
    scope.listen(vv, 'resize', measureModalKeyboard);
    scope.listen(vv, 'scroll', measureModalKeyboard);
    scope.listen(document, 'focusin', noteModalFocus);
    scope.onDispose(uiState.subscribe(() => {
        if (uiState.isModalOpen !== modalWasOpen) measureModalKeyboard();
    }));
    scope.onDispose(() => {
        uiState.modalViewportTop = 0;
        uiState.modalViewportHeight = 0;
    });
}
