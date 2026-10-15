import { modalIsOpen } from '../../core/modals';
import { uiState, type ModalKeyboardFit } from '../../core/state';
import { isAndroidDevice } from '../../platform/native';
import { modalElement } from '../components/modals/Modal';
import { commitNow } from '../flush';
import { topmostModal } from '../lifecycle/layers';
import type { LifecycleScope } from '../lifecycle/scope';
import { blurActiveElement, elementOf, focusElementWithoutScroll, setElementScrollTop, type RefName } from '../refs';
import { KEYBOARD_MIN_INSET_PX, noteKeyboardViewport } from './chrome-autohide';
import { tapEndedInPlace } from './ios-viewport';
import { usesIOSPanelHandoff } from './panels';

export const MODAL_FIELD_MARGIN_PX = 12;
export const MODAL_KEYBOARD_GAP_PX = 8;
export const MODAL_TAP_SLOP_PX = 10;
export const MODAL_TAP_MAX_MS = 500;
export const PAGE_TAP_KEYBOARD_RATIO = 0.5;

const PAGE_TAP_FIELDS: readonly RefName[] = ['hwScannerInput'];

const MODAL_TAP_TYPES = new Set(['text', 'tel', 'number', 'password', 'email', 'search', 'url', 'textarea']);

export interface ModalNaturalBox {
    top: number;
    height: number;
    pad: number;
    cap: number;
    safe?: number;
}

let modalWasOpen = false;
let modalStackSeen: string[] = [];
let modalDisplaySeen: Record<string, string> = {};
let keyboardOpenSeen = false;
let measureQueued = false;
let naturalBox: (ModalNaturalBox & { id: string }) | null = null;
let modalTap: { id: number; x: number; y: number; at: number; field: HTMLElement } | null = null;
let modalFocusRefused = false;
let modalTapFocused: HTMLElement | null = null;
let keyboardInsetSeen: { width: number; inset: number } | null = null;

export function keyboardVisibleViewport(): { top: number; height: number } | null {
    const vv = window.visualViewport;
    if (!vv || uiState.keyboardOpen) return null;
    const layout = window.innerHeight;
    const height = Math.round(vv.height);
    if (!Number.isFinite(layout) || !Number.isFinite(height) || height <= 0) return null;
    if (layout - height < KEYBOARD_MIN_INSET_PX) return null;
    const offset = Math.round(vv.offsetTop);
    const top = Number.isFinite(offset) ? Math.min(Math.max(0, offset), layout - height) : 0;
    return { top, height };
}

export function modalKeyboardViewport(): { top: number; height: number } | null {
    return uiState.isModalOpen ? keyboardVisibleViewport() : null;
}

export function measureKeyboardCover(): void {
    const view = keyboardVisibleViewport();
    if (view) noteKeyboardInsetSeen(Math.round(window.innerHeight) - view.height);
    const cover = view ? Math.max(0, Math.round(window.innerHeight) - view.top - view.height) : 0;
    if (uiState.keyboardCover !== cover) uiState.keyboardCover = cover;
}

function noteKeyboardInsetSeen(inset: number): void {
    const width = window.innerWidth;
    if (keyboardInsetSeen && keyboardInsetSeen.width === width && keyboardInsetSeen.inset >= inset) return;
    keyboardInsetSeen = { width, inset };
}

export function modalKeyboardFitFor(box: ModalNaturalBox, view: { top: number; height: number }): Omit<ModalKeyboardFit, 'id'> | null {
    const pan = view.top;
    const line = pan + view.height - MODAL_KEYBOARD_GAP_PX;
    let top = box.top + pan;
    if (pan === 0 && top + box.height <= line) return null;
    const ceil = pan + Math.max(box.pad, (box.safe || 0) + MODAL_KEYBOARD_GAP_PX);
    if (top + box.height > line) top = Math.max(ceil, line - box.height);
    top = Math.round(top);
    const max = Math.max(0, Math.floor(Math.min(box.cap, line - top)));
    return { top, max, shift: Math.round(top - box.pad) };
}

export function modalKeyboardHoldFitFor(box: ModalNaturalBox, view: { top: number; height: number }, layout: number): Omit<ModalKeyboardFit, 'id'> {
    const pad = Number.isFinite(box.pad) ? Math.max(0, box.pad) : 0;
    const scale = layout > 0 && Number.isFinite(layout) ? Math.min(1, view.height / layout) : 1;
    const room = Math.max(0, view.height - 2 * pad);
    const cap = Math.min(Number.isFinite(box.cap) && box.cap > 0 ? box.cap * scale : Infinity, room);
    const height = Number.isFinite(box.height) ? Math.min(Math.max(0, box.height), cap) : cap;
    const top = Math.round(view.top + pad + (room - height) / 2);
    return { top, max: Math.max(0, Math.floor(cap)), shift: Math.round(top - pad), hold: true };
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

function modalContentOf(modal: HTMLElement): HTMLElement | null {
    for (const child of Array.from(modal.children)) {
        if (child.matches('.modal-content')) return child as HTMLElement;
    }
    return null;
}

function naturalBoxOf(modal: HTMLElement, content: HTMLElement): ModalNaturalBox {
    const box = modal.getBoundingClientRect();
    const cap = parseFloat(window.getComputedStyle(content).maxHeight);
    const style = window.getComputedStyle(modal);
    const pad = parseFloat(style.paddingTop);
    const safe = parseFloat(style.getPropertyValue('--modal-safe-top'));
    const top = content.offsetParent === modal ? box.top + content.offsetTop : content.getBoundingClientRect().top;
    return {
        top,
        height: content.offsetHeight,
        pad: Number.isFinite(pad) ? pad : 0,
        cap: Number.isFinite(cap) && cap > 0 ? cap : Infinity,
        safe: Number.isFinite(safe) && safe > 0 ? safe : 0
    };
}

function setModalKeyboardFit(next: ModalKeyboardFit | null): boolean {
    const now = uiState.modalKeyboardFit;
    if (!now && !next) return false;
    if (now && next && now.id === next.id && now.top === next.top && now.max === next.max && now.shift === next.shift && !!now.hold === !!next.hold) return false;
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
    const fit = isAndroidDevice() ? modalKeyboardHoldFitFor(naturalBox, view, window.innerHeight) : modalKeyboardFitFor(naturalBox, view);
    return setModalKeyboardFit(fit ? Object.assign({ id }, fit) : null);
}

export function measureModalKeyboard(): void {
    modalWasOpen = uiState.isModalOpen;
    modalStackSeen = uiState.modalStack;
    modalDisplaySeen = uiState.modalDisplay;
    keyboardOpenSeen = uiState.keyboardOpen;
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
    if (!MODAL_TAP_TYPES.has(String(el.type || '').toLowerCase()) || el.disabled || el.readOnly) return null;
    if (document.activeElement === el && (el === modalTapFocused || keyboardVisibleViewport())) return null;
    const modal = el.closest('.modal') as HTMLElement | null;
    if (modal) return modal.id && modalIsOpen(modal.id) ? el : null;
    return !uiState.isModalOpen && PAGE_TAP_FIELDS.some((name) => elementOf(name) === el) && pageFieldStaysAboveKeyboard(el) ? el : null;
}

export function pageFieldStaysAboveKeyboard(el: HTMLElement): boolean {
    const height = window.innerHeight;
    if (!Number.isFinite(height) || height <= 0) return false;
    const seen = keyboardInsetSeen && keyboardInsetSeen.width === window.innerWidth ? keyboardInsetSeen.inset : 0;
    const inset = seen > 0 ? seen : Math.round(height * PAGE_TAP_KEYBOARD_RATIO);
    const box = el.getBoundingClientRect();
    return Number.isFinite(box.bottom) && box.height > 0 && box.top >= 0 && box.bottom + MODAL_KEYBOARD_GAP_PX <= height - inset;
}

export function noteModalTouchStart(e: TouchEvent): void {
    modalTap = null;
    if (modalFocusRefused || !usesIOSPanelHandoff()) return;
    const field = modalTapField(e.target);
    if (!field || !e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    modalTap = { id: t.identifier, x: t.clientX, y: t.clientY, at: e.timeStamp, field };
}

export function forgetModalTap(): void {
    modalTap = null;
}

function forgetModalTapFocus(): void {
    modalTapFocused = null;
}

export function focusModalFieldWithoutScroll(e: TouchEvent): void {
    const tap = modalTap;
    modalTap = null;
    if (!tap || modalTapField(e.target) !== tap.field || !tapEndedInPlace(e, tap, MODAL_TAP_SLOP_PX, MODAL_TAP_MAX_MS)) return;
    e.preventDefault();
    if (document.activeElement === tap.field) blurActiveElement();
    if (focusElementWithoutScroll(tap.field)) modalTapFocused = tap.field;
    else modalFocusRefused = true;
}

export function listenModalKeyboard(scope: LifecycleScope): void {
    modalWasOpen = false;
    modalStackSeen = uiState.modalStack;
    modalDisplaySeen = uiState.modalDisplay;
    keyboardOpenSeen = uiState.keyboardOpen;
    measureQueued = false;
    naturalBox = null;
    modalTap = null;
    modalFocusRefused = false;
    modalTapFocused = null;
    keyboardInsetSeen = null;
    if (uiState.modalViewportTop !== 0) uiState.modalViewportTop = 0;
    if (uiState.modalViewportHeight !== 0) uiState.modalViewportHeight = 0;
    if (uiState.modalKeyboardFit) uiState.modalKeyboardFit = null;
    if (uiState.keyboardCover !== 0) uiState.keyboardCover = 0;
    scope.listen(window, 'resize', revealAfterResize);
    scope.listen(document, 'touchstart', noteModalTouchStart, { capture: true, passive: true });
    scope.listen(document, 'touchend', focusModalFieldWithoutScroll, { capture: true, passive: false });
    scope.listen(document, 'touchcancel', forgetModalTap, { capture: true, passive: true });
    scope.listen(document, 'focusin', forgetModalTapFocus, { capture: true });
    scope.onDispose(() => {
        naturalBox = null;
        modalTap = null;
        modalTapFocused = null;
        uiState.modalViewportTop = 0;
        uiState.modalViewportHeight = 0;
        uiState.modalKeyboardFit = null;
        uiState.keyboardCover = 0;
    });
    const vv = window.visualViewport;
    if (!vv) return;
    scope.listen(vv, 'resize', noteKeyboardViewport);
    scope.listen(vv, 'resize', measureModalKeyboard);
    scope.listen(vv, 'scroll', measureModalKeyboard);
    scope.listen(vv, 'resize', measureKeyboardCover);
    scope.listen(vv, 'scroll', measureKeyboardCover);
    measureKeyboardCover();
    scope.listen(document, 'focusin', noteModalFocus);
    scope.onDispose(uiState.subscribe(() => {
        if (uiState.keyboardOpen !== keyboardOpenSeen) {
            keyboardOpenSeen = uiState.keyboardOpen;
            measureKeyboardCover();
            if (uiState.isModalOpen || uiState.modalViewportHeight > 0) queueModalMeasure(scope);
        }
        if (uiState.isModalOpen === modalWasOpen && uiState.modalStack === modalStackSeen && uiState.modalDisplay === modalDisplaySeen) return;
        modalWasOpen = uiState.isModalOpen;
        modalStackSeen = uiState.modalStack;
        modalDisplaySeen = uiState.modalDisplay;
        queueModalMeasure(scope);
    }));
}
