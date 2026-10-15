import { modalIsOpen } from '../../core/modals';
import { uiState, type ModalKeyboardFit } from '../../core/state';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../../core/storage';
import { KEYBOARD_INSET_KEY } from '../../core/storage-keys';
import { isAndroidDevice } from '../../platform/native';
import { modalElement } from '../components/modals/Modal';
import { commitNow } from '../flush';
import { topmostModal } from '../lifecycle/layers';
import type { LifecycleScope } from '../lifecycle/scope';
import { blurActiveElement, elementOf, focusElementWithoutScroll, setElementScrollTop, visualViewportKeyboardInset, type RefName } from '../refs';
import { KEYBOARD_MIN_INSET_PX, noteKeyboardViewport } from './chrome-autohide';
import { tapEndedInPlace } from './ios-viewport';
import { usesIOSPanelHandoff } from './panels';

export const MODAL_FIELD_MARGIN_PX = 12;
export const MODAL_KEYBOARD_GAP_PX = 8;
export const MODAL_TAP_SLOP_PX = 10;
export const MODAL_TAP_MAX_MS = 500;
export const PAGE_TAP_KEYBOARD_RATIO = 0.5;
export const PAGE_TAP_PHONE_KEYBOARD_RATIO = 0.45;
export const PAGE_TAP_PHONE_MAX_WIDTH = 600;
export const KEYBOARD_MEMORY_MAX = 24;

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
let keyboardMemory: Record<string, number> | null = null;

export function keyboardVisibleViewport(): { top: number; height: number } | null {
    const vv = window.visualViewport;
    if (!vv || uiState.keyboardOpen) return null;
    const layout = window.innerHeight;
    const height = Math.round(vv.height);
    if (!Number.isFinite(layout) || !Number.isFinite(height) || height <= 0) return null;
    if (visualViewportKeyboardInset() < KEYBOARD_MIN_INSET_PX) return null;
    const offset = Math.round(vv.offsetTop);
    const top = Number.isFinite(offset) ? Math.min(Math.max(0, offset), layout - height) : 0;
    return { top, height };
}

export function softKeyboardShown(): boolean {
    return uiState.keyboardOpen || keyboardVisibleViewport() !== null;
}

export function modalKeyboardViewport(): { top: number; height: number } | null {
    return uiState.isModalOpen ? keyboardVisibleViewport() : null;
}

export function measureKeyboardCover(): void {
    const view = keyboardVisibleViewport();
    if (view) rememberKeyboardInset(visualViewportKeyboardInset());
    const cover = view ? Math.max(0, Math.round(window.innerHeight) - view.top - view.height) : 0;
    if (uiState.keyboardCover !== cover) uiState.keyboardCover = cover;
}

function keyboardKind(el: Element | null): string {
    const field = el as HTMLInputElement | null;
    if (!field || (field.tagName !== 'INPUT' && field.tagName !== 'TEXTAREA')) return '';
    const mode = String(field.getAttribute('inputmode') || '').toLowerCase();
    if (mode) return mode;
    const type = String(field.type || '').toLowerCase();
    return type === 'tel' || type === 'number' || type === 'email' || type === 'url' ? type : 'text';
}

function keyboardScreenKey(): string {
    return Math.round(window.innerWidth) + 'x' + Math.round(window.innerHeight) + '|';
}

function loadKeyboardMemory(): Record<string, number> {
    if (keyboardMemory) return keyboardMemory;
    let parsed: unknown;
    try { parsed = JSON.parse(safeStoreGet(appLocalStore, KEYBOARD_INSET_KEY) || 'null'); } catch { parsed = null; }
    const memory: Record<string, number> = {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const key of Object.keys(parsed as Record<string, unknown>).slice(-KEYBOARD_MEMORY_MAX)) {
            const inset = Number((parsed as Record<string, unknown>)[key]);
            if (key.length <= 48 && Number.isFinite(inset) && inset >= KEYBOARD_MIN_INSET_PX && inset <= 4000) memory[key] = Math.round(inset);
        }
    }
    keyboardMemory = memory;
    return memory;
}

function rememberKeyboardInset(inset: number): void {
    const kind = keyboardKind(document.activeElement);
    if (!kind) return;
    const memory = loadKeyboardMemory();
    const key = keyboardScreenKey() + kind;
    if (memory[key] === inset) return;
    delete memory[key];
    memory[key] = inset;
    const keys = Object.keys(memory);
    for (let i = 0; i < keys.length - KEYBOARD_MEMORY_MAX; i++) delete memory[keys[i]];
    safeStoreSet(appLocalStore, KEYBOARD_INSET_KEY, JSON.stringify(memory));
}

export function rememberedKeyboardInset(el: Element): number {
    const memory = loadKeyboardMemory();
    const screen = keyboardScreenKey();
    const exact = memory[screen + keyboardKind(el)];
    if (exact) return exact;
    let widest = 0;
    for (const key of Object.keys(memory)) {
        if (key.startsWith(screen) && memory[key] > widest) widest = memory[key];
    }
    return widest;
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

function iosPageTapFieldOf(target: EventTarget | null): HTMLElement | null {
    const node = target as Element | null;
    if (!node || typeof node.closest !== 'function' || !usesIOSPanelHandoff()) return null;
    for (const name of PAGE_TAP_FIELDS) {
        const field = elementOf(name);
        if (!field || node === field) continue;
        const label = node.closest('label') as HTMLLabelElement | null;
        if (label && label.htmlFor && label.htmlFor === field.id) return field;
        const icon = node.closest('.icon');
        if (icon && field.parentElement && icon.parentElement === field.parentElement) return field;
    }
    return null;
}

function modalTapField(target: EventTarget | null): HTMLElement | null {
    const el = (iosPageTapFieldOf(target) || target) as HTMLInputElement | null;
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
    const seen = rememberedKeyboardInset(el);
    const phone = window.innerWidth < PAGE_TAP_PHONE_MAX_WIDTH && height > window.innerWidth;
    const inset = seen > 0 ? seen : Math.round(height * (phone ? PAGE_TAP_PHONE_KEYBOARD_RATIO : PAGE_TAP_KEYBOARD_RATIO));
    const box = el.getBoundingClientRect();
    return Number.isFinite(box.bottom) && box.height > 0 && box.top >= 0 && box.bottom + MODAL_KEYBOARD_GAP_PX <= height - inset;
}

export function noteModalTouchStart(e: TouchEvent): void {
    modalTap = null;
    if (modalFocusRefused) return;
    const ios = usesIOSPanelHandoff();
    if (!ios && !isAndroidDevice()) return;
    const field = modalTapField(e.target);
    if (!field || !e.touches || e.touches.length !== 1) return;
    if (!ios && (field.closest('.modal') || (document.activeElement === field && uiState.keyboardOpen))) return;
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
    keyboardMemory = null;
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
