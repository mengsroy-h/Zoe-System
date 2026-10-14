import { modalIsOpen } from '../../core/modals';
import { uiState, type ModalKeyboardFit } from '../../core/state';
import { modalElement } from '../components/modals/Modal';
import { commitNow } from '../flush';
import { topmostModal } from '../lifecycle/layers';
import type { LifecycleScope } from '../lifecycle/scope';
import { focusElementWithoutScroll, setElementScrollTop } from '../refs';
import { KEYBOARD_MIN_INSET_PX } from './chrome-autohide';
import { usesIOSPanelHandoff } from './panels';

export const MODAL_FIELD_MARGIN_PX = 12;
export const MODAL_KEYBOARD_GAP_PX = 8;
export const MODAL_KEYBOARD_MIN_VISIBLE_PX = 180;
export const MODAL_TAP_SLOP_PX = 10;
export const MODAL_TAP_MAX_MS = 500;

const MODAL_TAP_TYPES = new Set(['text', 'tel', 'number', 'password', 'email', 'search', 'url', 'textarea']);

export interface ModalNaturalBox {
    top: number;
    height: number;
    pad: number;
    cap: number;
    raised?: boolean;
}

let modalWasOpen = false;
let modalStackSeen: string[] = [];
let modalDisplaySeen: Record<string, string> = {};
let measureQueued = false;
let naturalBox: (ModalNaturalBox & { id: string }) | null = null;
let modalTap: { id: number; x: number; y: number; at: number; field: HTMLElement } | null = null;
let modalFocusRefused = false;

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

export function modalKeyboardFitFor(box: ModalNaturalBox, view: { top: number; height: number }): Omit<ModalKeyboardFit, 'id'> | null {
    const pan = view.top;
    const line = pan + view.height - MODAL_KEYBOARD_GAP_PX;
    let top = box.top + pan;
    if (pan === 0 && top + box.height <= line) return null;
    const floor = Math.min(box.height, MODAL_KEYBOARD_MIN_VISIBLE_PX);
    if (box.raised) top = pan + box.pad;
    else if (line - top < floor) top = Math.max(pan + box.pad, line - floor);
    top = Math.round(top);
    const max = Math.max(0, Math.floor(Math.min(box.cap, line - top)));
    return { top, max, shift: Math.round(top - box.pad) };
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
        const margin = Math.min(MODAL_FIELD_MARGIN_PX, Math.max(0, (box.height - rect.height) / 2));
        const top = box.top + margin;
        const bottom = box.bottom - margin;
        let delta = rect.bottom > bottom ? rect.bottom - bottom : 0;
        if (rect.top - delta < top) delta = rect.top - top;
        if (delta) setElementScrollTop(node, node.scrollTop + delta);
    }
}

export function focusedModalFieldClipped(inModal?: Element | null): boolean {
    const field = focusedModalField();
    if (!field) return false;
    const modal = field.closest('.modal');
    if (inModal && modal !== inModal) return false;
    const rect = field.getBoundingClientRect();
    for (let node = field.parentElement; node && node !== modal; node = node.parentElement) {
        if (!scrollsY(node)) continue;
        const box = node.getBoundingClientRect();
        if (rect.top < box.top - 1 || rect.bottom > box.bottom + 1) return true;
    }
    return false;
}

function modalContentOf(modal: HTMLElement): HTMLElement | null {
    for (const child of Array.from(modal.children)) {
        if (child.matches('.modal-content')) return child as HTMLElement;
    }
    return null;
}

function naturalBoxOf(modal: HTMLElement, content: HTMLElement): ModalNaturalBox {
    const box = modal.getBoundingClientRect();
    const cap = parseFloat(window.getComputedStyle(content).maxHeight);
    const pad = parseFloat(window.getComputedStyle(modal).paddingTop);
    const top = content.offsetParent === modal ? box.top + content.offsetTop : content.getBoundingClientRect().top;
    return { top, height: content.offsetHeight, pad: Number.isFinite(pad) ? pad : 0, cap: Number.isFinite(cap) && cap > 0 ? cap : Infinity };
}

function setModalKeyboardFit(next: ModalKeyboardFit | null): boolean {
    const now = uiState.modalKeyboardFit;
    if (!now && !next) return false;
    if (now && next && now.id === next.id && now.top === next.top && now.max === next.max && now.shift === next.shift) return false;
    uiState.modalKeyboardFit = next;
    return true;
}

function fitModalToKeyboard(view: { top: number; height: number }): boolean {
    const id = topmostModal();
    const modal = id ? modalElement(id) : null;
    const content = modal ? modalContentOf(modal) : null;
    if (!id || !modal || !content) {
        naturalBox = null;
        return setModalKeyboardFit(null);
    }
    const now = uiState.modalKeyboardFit;
    if (!naturalBox || naturalBox.id !== id || !now || now.id !== id) {
        if (now) {
            uiState.modalKeyboardFit = null;
            commitNow();
        }
        naturalBox = Object.assign({ id }, naturalBoxOf(modal, content));
    }
    const fit = modalKeyboardFitFor(naturalBox, view);
    return setModalKeyboardFit(fit ? Object.assign({ id }, fit) : null);
}

export function measureModalKeyboard(): void {
    modalWasOpen = uiState.isModalOpen;
    modalStackSeen = uiState.modalStack;
    modalDisplaySeen = uiState.modalDisplay;
    const view = modalKeyboardViewport();
    const top = view ? view.top : 0;
    const height = view ? view.height : 0;
    let changed = false;
    if (uiState.modalViewportTop !== top) { uiState.modalViewportTop = top; changed = true; }
    if (uiState.modalViewportHeight !== height) { uiState.modalViewportHeight = height; changed = true; }
    if (!view) {
        naturalBox = null;
        if (setModalKeyboardFit(null)) changed = true;
        if (changed) commitNow();
        return;
    }
    if (fitModalToKeyboard(view)) changed = true;
    if (changed) commitNow();
    revealFocusedModalField();
    const box = naturalBox;
    const fit = uiState.modalKeyboardFit;
    if (!box || box.raised || !fit || fit.id !== box.id || fit.top <= view.top + box.pad || !focusedModalFieldClipped(modalElement(box.id))) return;
    box.raised = true;
    const raised = modalKeyboardFitFor(box, view);
    if (!setModalKeyboardFit(raised ? Object.assign({ id: box.id }, raised) : null)) return;
    commitNow();
    revealFocusedModalField();
}

function queueModalMeasure(scope: LifecycleScope): void {
    if (measureQueued) return;
    measureQueued = true;
    queueMicrotask(() => {
        measureQueued = false;
        if (scope.disposed) return;
        commitNow();
        measureModalKeyboard();
    });
}

function noteModalFocus(): void {
    if (uiState.isModalOpen && uiState.modalViewportHeight > 0) measureModalKeyboard();
}

function revealAfterResize(): void {
    if (uiState.isModalOpen && uiState.modalViewportHeight === 0) revealFocusedModalField();
}

function modalTapField(target: EventTarget | null): HTMLElement | null {
    const el = target as HTMLInputElement | null;
    if (!el || typeof el.closest !== 'function' || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return null;
    if (!MODAL_TAP_TYPES.has(String(el.type || '').toLowerCase()) || el.disabled || el.readOnly || document.activeElement === el) return null;
    const modal = el.closest('.modal') as HTMLElement | null;
    return modal && modal.id && modalIsOpen(modal.id) ? el : null;
}

function touchById(list: ArrayLike<Touch> | null | undefined, id: number): Touch | null {
    if (!list) return null;
    for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].identifier === id) return list[i];
    }
    return null;
}

export function noteModalTouchStart(e: TouchEvent): void {
    modalTap = null;
    if (modalFocusRefused || !uiState.isModalOpen || !usesIOSPanelHandoff()) return;
    const field = modalTapField(e.target);
    if (!field || !e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    modalTap = { id: t.identifier, x: t.clientX, y: t.clientY, at: e.timeStamp, field };
}

export function forgetModalTap(): void {
    modalTap = null;
}

export function focusModalFieldWithoutScroll(e: TouchEvent): void {
    const tap = modalTap;
    modalTap = null;
    if (!tap || !e.cancelable || (e.touches && e.touches.length) || modalTapField(e.target) !== tap.field) return;
    const t = touchById(e.changedTouches, tap.id);
    if (!t || Math.abs(t.clientX - tap.x) > MODAL_TAP_SLOP_PX || Math.abs(t.clientY - tap.y) > MODAL_TAP_SLOP_PX) return;
    if (!(e.timeStamp - tap.at <= MODAL_TAP_MAX_MS)) return;
    e.preventDefault();
    if (!focusElementWithoutScroll(tap.field)) modalFocusRefused = true;
}

export function listenModalKeyboard(scope: LifecycleScope): void {
    modalWasOpen = false;
    modalStackSeen = uiState.modalStack;
    modalDisplaySeen = uiState.modalDisplay;
    measureQueued = false;
    naturalBox = null;
    modalTap = null;
    modalFocusRefused = false;
    if (uiState.modalViewportTop !== 0) uiState.modalViewportTop = 0;
    if (uiState.modalViewportHeight !== 0) uiState.modalViewportHeight = 0;
    if (uiState.modalKeyboardFit) uiState.modalKeyboardFit = null;
    scope.listen(window, 'resize', revealAfterResize);
    scope.listen(document, 'touchstart', noteModalTouchStart, { capture: true, passive: true });
    scope.listen(document, 'touchend', focusModalFieldWithoutScroll, { capture: true, passive: false });
    scope.listen(document, 'touchcancel', forgetModalTap, { capture: true, passive: true });
    scope.onDispose(() => {
        naturalBox = null;
        modalTap = null;
        uiState.modalViewportTop = 0;
        uiState.modalViewportHeight = 0;
        uiState.modalKeyboardFit = null;
    });
    const vv = window.visualViewport;
    if (!vv) return;
    scope.listen(vv, 'resize', measureModalKeyboard);
    scope.listen(vv, 'scroll', measureModalKeyboard);
    scope.listen(document, 'focusin', noteModalFocus);
    scope.onDispose(uiState.subscribe(() => {
        if (uiState.isModalOpen === modalWasOpen && uiState.modalStack === modalStackSeen && uiState.modalDisplay === modalDisplaySeen) return;
        modalWasOpen = uiState.isModalOpen;
        modalStackSeen = uiState.modalStack;
        modalDisplaySeen = uiState.modalDisplay;
        queueModalMeasure(scope);
    }));
}
