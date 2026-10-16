import { modalIsOpen } from '../../core/modals';
import { uiState, type ModalKeyboardFit } from '../../core/state';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../../core/storage';
import { KEYBOARD_INSET_KEY } from '../../core/storage-keys';
import { scrollWindowToTop } from '../../platform/document-io';
import { isAndroidDevice, isNativeAndroid } from '../../platform/native';
import { modalElement } from '../components/modals/Modal';
import { commitNow } from '../flush';
import { topmostModal } from '../lifecycle/layers';
import type { LifecycleScope } from '../lifecycle/scope';
import { animateElement, blurActiveElement, elementOf, focusElementWithoutScroll, setElementScrollTop, visualViewportKeyboardInset, type RefName } from '../refs';
import { KEYBOARD_MIN_INSET_PX, noteKeyboardViewport } from './chrome-autohide';
import { ENTRY_SEARCH_FIELDS, entrySearchMovesField } from './entry-search';
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
export const KEYBOARD_SETTLE_MS = 400;
export const KEYBOARD_TRUST_MS = 1000;
export const MODAL_GLIDE_MS = 250;
export const MODAL_GLIDE_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)';
export const PAGE_TAP_PROBE_MS = 1500;
export const NATIVE_TAP_FOCUS_MS = 1000;
export const IOS_KEYBOARD_SETTLE_MS = 400;
export const IOS_KEYBOARD_FORECAST_MS = 1200;
const SEARCH_PULL_UP_MAX_WIDTH = 992;

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
let naturalBox: (ModalNaturalBox & { id: string; layout: number; width: number }) | null = null;
let modalTap: { id: number; x: number; y: number; at: number; field: HTMLElement } | null = null;
let modalFocusRefused = false;
let modalTapFocused: HTMLElement | null = null;
let keyboardMemory: Record<string, number> | null = null;
let keyboardSession: { w: number; h: number; seen: string; settled: boolean } | null = null;
let keyboardSettleTimer: ReturnType<typeof setTimeout> | null = null;
let modalRest: { card: HTMLElement; top: number; width: number } | null = null;
let modalGlide: { card: HTMLElement; to: number; anim: Animation } | null = null;
let modalWatched: HTMLElement | null = null;
let modalResizeObserver: ResizeObserver | null = null;
let pageTapStart: { field: HTMLElement; x: number; y: number; at: number; touches: number; focused: boolean; tapped: boolean; keyboard: boolean; above: boolean; refused: boolean } | null = null;
let pageTapProbe: { path: string; field: HTMLElement; at: number; until: number; pagesAt: number; numbers: Record<string, number> } | null = null;
let pageTapReported: string[] = [];
let touchesDown = 0;
let pageFieldCaught: HTMLElement | null = null;
let lastTouchEndAt = -Infinity;
let lastTouchTarget: EventTarget | null = null;
let iosKeyboard: { inset: number; settled: boolean; applied: number } | null = null;
let iosForecast = 0;
let iosForecastMissed = false;
let iosClosing = false;
let iosKeyboardTimer: ReturnType<typeof setTimeout> | null = null;

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
    const android = trackAndroidKeyboard();
    if (view && !android) rememberKeyboardInset(keyboardScreenKey(), visualViewportKeyboardInset());
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

function visibleViewportHeight(): number {
    const vv = window.visualViewport;
    const layout = Math.round(window.innerHeight);
    if (!vv) return layout;
    const height = Math.round(vv.height * (vv.scale > 1 ? vv.scale : 1));
    return Number.isFinite(height) && height > 0 ? Math.min(height, layout) : layout;
}

function clearKeyboardSettle(): void {
    if (keyboardSettleTimer !== null) clearTimeout(keyboardSettleTimer);
    keyboardSettleTimer = null;
}

function endKeyboardSession(): void {
    keyboardSession = null;
    clearKeyboardSettle();
}

function keyboardLayoutShrank(): boolean {
    const s = keyboardSession;
    return !!s && Math.round(window.innerWidth) === s.w && s.h - Math.round(window.innerHeight) >= KEYBOARD_MIN_INSET_PX;
}

function sessionInset(s: NonNullable<typeof keyboardSession>): number {
    return Math.round(window.innerWidth) === s.w ? s.h - visibleViewportHeight() : 0;
}

function settleAndroidKeyboard(s: NonNullable<typeof keyboardSession>, inset: number): void {
    keyboardSettleTimer = null;
    if (keyboardSession !== s || sessionInset(s) !== inset) return;
    rememberKeyboardInset(s.w + 'x' + s.h + '|', inset);
    if (s.settled) return;
    s.settled = true;
    if (uiState.isModalOpen && uiState.modalViewportHeight > 0) measureModalKeyboard();
}

function trackAndroidKeyboard(): boolean {
    if (!isAndroidDevice()) {
        if (keyboardSession) endKeyboardSession();
        return false;
    }
    const w = Math.round(window.innerWidth);
    const layout = Math.round(window.innerHeight);
    if (!Number.isFinite(w) || !Number.isFinite(layout) || layout <= 0) {
        endKeyboardSession();
        return true;
    }
    let s = keyboardSession;
    if (s && s.w !== w) {
        endKeyboardSession();
        s = null;
    }
    if (!s) {
        if (uiState.keyboardOpen || layout - visibleViewportHeight() < KEYBOARD_MIN_INSET_PX) return true;
        s = keyboardSession = { w, h: layout, seen: '', settled: false };
    }
    if (layout > s.h) s.h = layout;
    const inset = sessionInset(s);
    if (inset < KEYBOARD_MIN_INSET_PX) {
        endKeyboardSession();
        return true;
    }
    const shrank = s.h - layout >= KEYBOARD_MIN_INSET_PX;
    if (shrank) s.settled = true;
    const seen = inset + (shrank ? '|shrank' : '|view');
    if (seen === s.seen) return true;
    s.seen = seen;
    clearKeyboardSettle();
    if (!shrank && isNativeAndroid()) return true;
    const session = s;
    keyboardSettleTimer = setTimeout(() => settleAndroidKeyboard(session, inset), shrank ? KEYBOARD_SETTLE_MS : KEYBOARD_TRUST_MS);
    return true;
}

function learnedKeyboardView(view: { top: number; height: number }): { top: number; height: number } {
    const s = keyboardSession;
    if (!s || s.settled || Math.round(window.innerWidth) !== s.w || Math.round(window.innerHeight) !== s.h) return view;
    const learned = loadKeyboardMemory()[s.w + 'x' + s.h + '|' + keyboardKind(document.activeElement)];
    if (!(learned >= KEYBOARD_MIN_INSET_PX) || learned >= s.h) return view;
    return { top: view.top, height: Math.max(0, Math.min(s.h - learned, s.h - view.top)) };
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

function rememberKeyboardInset(screen: string, inset: number): void {
    const kind = keyboardKind(document.activeElement);
    if (!kind) return;
    const memory = loadKeyboardMemory();
    const key = screen + kind;
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
        naturalBox = Object.assign({ id, layout: window.innerHeight, width: window.innerWidth }, naturalBoxOf(modal, content));
    }
    if (isAndroidDevice()) {
        const room = learnedKeyboardView(view);
        const fit = modalKeyboardHoldFitFor(naturalBox, room, naturalBox.layout);
        if (now && now.id === id && androidFitStaysUp(fit, room)) return false;
        return setModalKeyboardFit(Object.assign({ id }, fit));
    }
    const fit = modalKeyboardFitFor(naturalBox, view);
    return setModalKeyboardFit(fit ? Object.assign({ id }, fit) : null);
}

function androidFitStaysUp(next: { top: number }, view: { top: number; height: number }): boolean {
    const now = uiState.modalKeyboardFit;
    if (!now || !naturalBox || now.id !== naturalBox.id || next.top <= now.top || window.innerWidth !== naturalBox.width) return false;
    const height = Math.min(naturalBox.height, now.max);
    return Number.isFinite(height) && now.top >= view.top && now.top + height <= view.top + view.height;
}

function androidHeldFitView(): { top: number; height: number } | null {
    const now = uiState.modalKeyboardFit;
    if (!(uiState.keyboardOpen || keyboardLayoutShrank()) || !now || !naturalBox || now.id !== naturalBox.id || now.id !== topmostModal() || !isAndroidDevice()) return null;
    const height = Math.round(window.innerHeight);
    return Number.isFinite(height) && height > 0 ? { top: 0, height } : null;
}

function topmostModalCard(): { id: string; card: HTMLElement } | null {
    const id = topmostModal();
    const modal = id ? modalElement(id) : null;
    const card = modal ? modalContentOf(modal) : null;
    return id && card ? { id, card } : null;
}

function cardLayoutTop(card: HTMLElement): number {
    const modal = card.parentElement;
    return modal && card.offsetParent === modal && card.offsetHeight > 0 ? modal.getBoundingClientRect().top + card.offsetTop : NaN;
}

function modalCardShownTop(card: HTMLElement): number {
    if (!modalRest || modalRest.card !== card) return NaN;
    const offset = modalGlide && modalGlide.card === card ? card.getBoundingClientRect().top - cardLayoutTop(card) : 0;
    return modalRest.top + offset;
}

function modalMotionAllowed(): boolean {
    try {
        return typeof window.matchMedia !== 'function' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
        return true;
    }
}

function stopModalGlide(): void {
    const glide = modalGlide;
    modalGlide = null;
    if (!glide) return;
    try { glide.anim.cancel(); } catch (e) {}
}

function watchModalCard(card: HTMLElement | null): void {
    if (card === modalWatched) return;
    modalWatched = card;
    if (!modalResizeObserver) return;
    modalResizeObserver.disconnect();
    if (!card) return;
    modalResizeObserver.observe(card);
    if (card.parentElement) modalResizeObserver.observe(card.parentElement);
}

function glideModalCard(shown: number, animate: boolean): void {
    const now = topmostModalCard();
    watchModalCard(now ? now.card : null);
    if (modalGlide && (!now || modalGlide.card !== now.card)) stopModalGlide();
    const to = now ? cardLayoutTop(now.card) - uiState.modalViewportTop : NaN;
    if (!now || !Number.isFinite(to)) {
        stopModalGlide();
        modalRest = null;
        return;
    }
    const was = modalRest;
    modalRest = { card: now.card, top: to, width: window.innerWidth };
    if (modalGlide && Math.abs(modalGlide.to - to) < 1) return;
    const running = !!modalGlide;
    stopModalGlide();
    if (!(animate || running) || !was || was.card !== now.card || was.width !== modalRest.width) return;
    const from = Math.round(shown - to);
    if (!Number.isFinite(from) || Math.abs(from) < 2 || !modalMotionAllowed()) return;
    let anim: Animation | null;
    try {
        anim = animateElement(now.card, [{ transform: 'translate3d(0,' + from + 'px,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: MODAL_GLIDE_MS, easing: MODAL_GLIDE_EASING, composite: 'add' });
    } catch (e) {
        anim = null;
    }
    if (!anim) return;
    const glide = { card: now.card, to, anim };
    modalGlide = glide;
    anim.onfinish = () => {
        if (modalGlide === glide) modalGlide = null;
    };
}

function noteModalResized(entries: ResizeObserverEntry[]): void {
    const now = topmostModalCard();
    if (!now || now.card !== modalWatched) return;
    const viewport = isAndroidDevice() && entries.some((entry) => entry.target === now.card.parentElement);
    glideModalCard(modalCardShownTop(now.card), viewport);
}

export function measureModalKeyboard(): void {
    trackAndroidKeyboard();
    trackIOSKeyboard();
    const now = topmostModalCard();
    const shown = now ? modalCardShownTop(now.card) : NaN;
    placeModalForKeyboard();
    glideModalCard(shown, true);
}

function clearIOSKeyboardTimer(): void {
    if (iosKeyboardTimer !== null) clearTimeout(iosKeyboardTimer);
    iosKeyboardTimer = null;
}

function resetIOSKeyboard(): void {
    clearIOSKeyboardTimer();
    iosKeyboard = null;
    iosForecast = 0;
    iosClosing = false;
}

function settleIOSKeyboard(): void {
    iosKeyboardTimer = null;
    if (iosForecast && !iosKeyboard) iosForecastMissed = true;
    iosForecast = 0;
    if (iosKeyboard) {
        iosKeyboard.settled = true;
        iosKeyboard.applied = 0;
    }
    if (uiState.isModalOpen) measureModalKeyboard();
}

function waitIOSKeyboard(ms: number): void {
    clearIOSKeyboardTimer();
    iosKeyboardTimer = setTimeout(settleIOSKeyboard, ms);
}

function trackIOSKeyboard(): void {
    if (isAndroidDevice()) {
        if (iosKeyboard || iosForecast || iosClosing) resetIOSKeyboard();
        return;
    }
    const inset = keyboardVisibleViewport() ? Math.round(visualViewportKeyboardInset()) : 0;
    if (!inset) {
        if (!iosKeyboard) return;
        resetIOSKeyboard();
        return;
    }
    if (iosKeyboard && Math.abs(iosKeyboard.inset - inset) < 2) return;
    if (!iosKeyboard) iosKeyboard = { inset, settled: false, applied: 0 };
    iosKeyboard.inset = inset;
    iosKeyboard.settled = false;
    waitIOSKeyboard(IOS_KEYBOARD_SETTLE_MS);
}

function viewForInset(inset: number, top: number): { top: number; height: number } {
    const layout = Math.round(window.innerHeight);
    const height = Math.max(0, layout - Math.round(inset));
    return { top: Math.min(Math.max(0, top), Math.max(0, layout - height)), height };
}

function iosModalKeyboardViewport(): { top: number; height: number } | null {
    if (!uiState.isModalOpen || iosClosing) return null;
    const real = keyboardVisibleViewport();
    const session = iosKeyboard;
    if (iosForecast && !(session && session.settled)) return viewForInset(iosForecast, real ? real.top : 0);
    if (!real || !session) return real;
    if (session.settled) return real;
    if (!session.applied) session.applied = session.inset;
    return viewForInset(session.applied, real.top);
}

function forecastModalKeyboard(field: HTMLElement): void {
    if (isAndroidDevice() || !uiState.isModalOpen || !field.closest('.modal') || (iosForecastMissed && !iosKeyboard)) return;
    const inset = rememberedKeyboardInset(field);
    if (!(inset >= KEYBOARD_MIN_INSET_PX)) return;
    const now = iosKeyboard ? iosKeyboard.inset : 0;
    if (now && Math.abs(now - inset) < 2) return;
    iosForecast = inset;
    iosClosing = false;
    if (iosKeyboard) {
        iosKeyboard.settled = false;
        iosKeyboard.applied = 0;
    }
    waitIOSKeyboard(IOS_KEYBOARD_FORECAST_MS);
    measureModalKeyboard();
}

function noteIOSFieldFocus(e: FocusEvent): void {
    const field = textEntryField(e.target);
    if (isAndroidDevice() || !field || touchesDown > 0) return;
    iosClosing = false;
    const tapped = performance.now() - lastTouchEndAt < NATIVE_TAP_FOCUS_MS;
    if (iosKeyboard || (tapped && lastTouchTarget === field)) forecastModalKeyboard(field);
}

function noteIOSFieldBlur(e: FocusEvent): void {
    if (isAndroidDevice() || !uiState.isModalOpen || !textEntryField(e.target) || textEntryField(e.relatedTarget)) return;
    if (!iosKeyboard && !iosForecast) return;
    iosClosing = true;
    iosForecast = 0;
    measureModalKeyboard();
}

function placeModalForKeyboard(): void {
    modalWasOpen = uiState.isModalOpen;
    modalStackSeen = uiState.modalStack;
    modalDisplaySeen = uiState.modalDisplay;
    keyboardOpenSeen = uiState.keyboardOpen;
    const view = isAndroidDevice() ? modalKeyboardViewport() : iosModalKeyboardViewport();
    const top = view ? view.top : 0;
    const height = view ? view.height : 0;
    let changed = false;
    if (uiState.modalViewportTop !== top) { uiState.modalViewportTop = top; changed = true; }
    if (uiState.modalViewportHeight !== height) { uiState.modalViewportHeight = height; changed = true; }
    if (!view) {
        const held = androidHeldFitView();
        if (!held || !naturalBox || !androidFitStaysUp(modalKeyboardHoldFitFor(naturalBox, held, naturalBox.layout), held)) {
            naturalBox = null;
            if (setModalKeyboardFit(null)) changed = true;
        }
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

function pageTapProbeField(target: EventTarget | null): HTMLElement | null {
    if (!usesIOSPanelHandoff() || uiState.isModalOpen) return null;
    const field = elementOf('hwScannerInput');
    return field && (target === field || iosPageTapFieldOf(target) === field) ? field : null;
}

function notePageTapStart(e: TouchEvent): void {
    pageTapStart = null;
    const field = pageTapProbeField(e.target);
    if (!field || !e.touches || !e.touches.length) return;
    const t = e.touches[0];
    pageTapStart = {
        field, x: t.clientX, y: t.clientY, at: e.timeStamp, touches: e.touches.length,
        focused: document.activeElement === field, tapped: modalTapFocused === field, keyboard: !!keyboardVisibleViewport(),
        above: pageFieldStaysAboveKeyboard(field), refused: modalFocusRefused
    };
}

function notePageTapEnd(e: TouchEvent, caught: boolean): void {
    const start = pageTapStart;
    pageTapStart = null;
    if (!start || !e.changedTouches || !e.changedTouches.length) return;
    const t = e.changedTouches[0];
    const dx = Math.round(t.clientX - start.x);
    const dy = Math.round(t.clientY - start.y);
    const ms = Math.round(e.timeStamp - start.at);
    const path = caught ? 'caught'
        : start.refused ? 'refused'
            : start.focused && start.keyboard ? 'focused-keyboard'
                : start.focused && start.tapped ? 'focused-tapped'
                    : !start.above ? 'covered'
                        : start.touches > 1 ? 'multi'
                            : Math.max(Math.abs(dx), Math.abs(dy)) > MODAL_TAP_SLOP_PX ? 'moved'
                                : ms > MODAL_TAP_MAX_MS ? 'slow'
                                    : !e.cancelable ? 'uncancelable' : 'other';
    const box = start.field.getBoundingClientRect();
    const pages = elementOf('appPages');
    const at = performance.now();
    pageTapProbe = {
        path,
        field: start.field,
        at,
        until: at + PAGE_TAP_PROBE_MS,
        pagesAt: pages ? pages.scrollTop : 0,
        numbers: {
            dx, dy, ms, fieldTop: Math.round(box.top), fieldBottom: Math.round(box.bottom), innerHeight: window.innerHeight, innerWidth: window.innerWidth,
            keyboardSeen: rememberedKeyboardInset(start.field), keyboard: start.keyboard ? 1 : 0, focused: start.focused ? 1 : 0, tapped: start.tapped ? 1 : 0
        }
    };
}

function notePageMoved(e: Event): void {
    const probe = pageTapProbe;
    if (!probe || touchesDown > 0) return;
    if (performance.now() > probe.until) {
        pageTapProbe = null;
        return;
    }
    const vv = window.visualViewport;
    const pages = elementOf('appPages');
    const target = e.target;
    const what = target === vv ? 'viewport' : target === document || target === document.documentElement || target === window ? 'document' : target === pages ? 'pages' : '';
    if (!what) return;
    const scrollY = Math.round(window.scrollY || 0);
    const viewportTop = vv ? Math.round(vv.offsetTop) : 0;
    if (what === 'pages' ? !pages || Math.abs(pages.scrollTop - probe.pagesAt) <= 1 : scrollY <= 1 && viewportTop <= 1) return;
    pageTapProbe = null;
    if (pageTapReported.indexOf(probe.path + ' ' + what) !== -1) return;
    pageTapReported = pageTapReported.concat(probe.path + ' ' + what);
    const errors = window.ZoeErrors;
    if (!errors || typeof errors.capture !== 'function') return;
    try {
        errors.capture(new Error('iOS page moved after a barcode field tap'), Object.assign({ zone: 'ui', context: 'iosPageTap ' + probe.path + ' ' + what }, probe.numbers,
            { scrollY, viewportTop, pagesMoved: pages ? Math.round(pages.scrollTop - probe.pagesAt) : 0, afterMs: Math.round(performance.now() - probe.at),
                viewportHeight: vv ? Math.round(vv.height) : 0, docHeight: Math.round(document.documentElement.scrollHeight || 0), stillFocused: document.activeElement === probe.field ? 1 : 0 }));
    } catch (err) {}
}

function restorePageFieldScroll(): void {
    const field = pageFieldCaught;
    if (!field) return;
    if (document.activeElement !== field) {
        pageFieldCaught = null;
        return;
    }
    if (uiState.isModalOpen || !usesIOSPanelHandoff() || (window.scrollY || 0) === 0) return;
    scrollWindowToTop();
}

function noteTouchesDown(e: TouchEvent): void {
    touchesDown = e.touches ? e.touches.length : 0;
    if (e.type !== 'touchend' && e.type !== 'touchcancel') return;
    lastTouchEndAt = performance.now();
    lastTouchTarget = e.type === 'touchend' && e.changedTouches && e.changedTouches.length ? e.changedTouches[0].target : null;
}

function textEntryField(target: EventTarget | null): HTMLElement | null {
    const el = target as HTMLInputElement | null;
    if (!el || typeof el.closest !== 'function' || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return null;
    return MODAL_TAP_TYPES.has(String(el.type || '').toLowerCase()) && !el.disabled && !el.readOnly ? el : null;
}

function keyboardFocusStaysInView(field: HTMLElement, view: { top: number; height: number }): boolean {
    const modal = field.closest('.modal') as HTMLElement | null;
    if (modal) return !!modal.id && modalIsOpen(modal.id);
    if (uiState.isModalOpen) return false;
    if (ENTRY_SEARCH_FIELDS.some((name) => elementOf(name) === field) && entrySearchMovesField()) return true;
    if (elementOf('searchPhoneInput') === field && window.innerWidth < SEARCH_PULL_UP_MAX_WIDTH) return true;
    const box = field.getBoundingClientRect();
    return box.height > 0 && box.top >= view.top && box.bottom + MODAL_KEYBOARD_GAP_PX <= view.top + view.height;
}

function keepKeyboardFocusInPlace(e: FocusEvent): void {
    if (touchesDown > 0 || !usesIOSPanelHandoff() || performance.now() - lastTouchEndAt < NATIVE_TAP_FOCUS_MS) return;
    const field = textEntryField(e.target);
    const view = field ? keyboardVisibleViewport() : null;
    if (!field || !view || document.activeElement !== field || !keyboardFocusStaysInView(field, view)) return;
    focusElementWithoutScroll(field);
}

export function noteModalTouchStart(e: TouchEvent): void {
    noteTouchesDown(e);
    notePageTapStart(e);
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

export function forgetModalTap(e?: TouchEvent): void {
    modalTap = null;
    pageTapStart = null;
    if (e) noteTouchesDown(e);
}

function forgetModalTapFocus(): void {
    modalTapFocused = null;
}

export function focusModalFieldWithoutScroll(e: TouchEvent): void {
    noteTouchesDown(e);
    const tap = modalTap;
    modalTap = null;
    if (!tap || modalTapField(e.target) !== tap.field || !tapEndedInPlace(e, tap, MODAL_TAP_SLOP_PX, MODAL_TAP_MAX_MS)) {
        notePageTapEnd(e, false);
        return;
    }
    notePageTapEnd(e, true);
    e.preventDefault();
    if (document.activeElement === tap.field) blurActiveElement();
    if (focusElementWithoutScroll(tap.field)) {
        modalTapFocused = tap.field;
        if (usesIOSPanelHandoff() && !tap.field.closest('.modal')) pageFieldCaught = tap.field;
    } else modalFocusRefused = true;
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
    endKeyboardSession();
    stopModalGlide();
    modalRest = null;
    modalWatched = null;
    pageTapStart = null;
    pageTapProbe = null;
    pageTapReported = [];
    touchesDown = 0;
    pageFieldCaught = null;
    lastTouchEndAt = -Infinity;
    lastTouchTarget = null;
    iosForecastMissed = false;
    resetIOSKeyboard();
    if (modalResizeObserver) modalResizeObserver.disconnect();
    modalResizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(noteModalResized) : null;
    if (uiState.modalViewportTop !== 0) uiState.modalViewportTop = 0;
    if (uiState.modalViewportHeight !== 0) uiState.modalViewportHeight = 0;
    if (uiState.modalKeyboardFit) uiState.modalKeyboardFit = null;
    if (uiState.keyboardCover !== 0) uiState.keyboardCover = 0;
    scope.listen(window, 'resize', trackAndroidKeyboard);
    scope.listen(window, 'resize', revealAfterResize);
    scope.listen(document, 'touchstart', noteModalTouchStart, { capture: true, passive: true });
    scope.listen(document, 'touchend', focusModalFieldWithoutScroll, { capture: true, passive: false });
    scope.listen(document, 'touchcancel', forgetModalTap, { capture: true, passive: true });
    scope.listen(document, 'focusin', forgetModalTapFocus, { capture: true });
    scope.listen(document, 'focus', keepKeyboardFocusInPlace, { capture: true });
    scope.listen(document, 'focusin', noteIOSFieldFocus, { capture: true });
    scope.listen(document, 'focusout', noteIOSFieldBlur, { capture: true });
    scope.listen(document, 'scroll', notePageMoved, { capture: true, passive: true });
    scope.listen(document, 'scroll', restorePageFieldScroll, { capture: true, passive: true });
    scope.onDispose(() => {
        endKeyboardSession();
        resetIOSKeyboard();
        stopModalGlide();
        if (modalResizeObserver) modalResizeObserver.disconnect();
        modalResizeObserver = null;
        modalRest = null;
        modalWatched = null;
        pageTapStart = null;
        pageTapProbe = null;
        pageFieldCaught = null;
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
    scope.listen(vv, 'scroll', notePageMoved);
    scope.listen(vv, 'scroll', restorePageFieldScroll);
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
