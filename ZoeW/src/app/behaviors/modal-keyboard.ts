import { modalIsOpen } from '../../core/modals';
import { securityState, uiState, type ModalKeyboardFit } from '../../core/state';
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
import { catchIOSSearchSyntheticTap, tapEndedInPlace } from './ios-viewport';
import { PANEL_SEARCH_GLIDE, beginPanelGlideSnapPause, panelGlideFrom } from './panel-motion';
import { activePanelSections, panelIsCollapsed, usesIOSPanelHandoff } from './panels';

export const MODAL_FIELD_MARGIN_PX = 12;
export const MODAL_KEYBOARD_GAP_PX = 8;
export const MODAL_TAP_SLOP_PX = 10;
export const MODAL_TAP_MAX_MS = 500;
export const CAUGHT_CLICK_MS = 800;
export const PAGE_TAP_KEYBOARD_RATIO = 0.5;
export const PAGE_TAP_PHONE_KEYBOARD_RATIO = 0.45;
export const PAGE_TAP_PHONE_MAX_WIDTH = 600;
export const KEYBOARD_MEMORY_MAX = 24;
export const KEYBOARD_SETTLE_MS = 400;
export const KEYBOARD_TRUST_MS = 1000;
export type GlideCurve = readonly [number, number, number, number];
export const MODAL_GLIDE_MS = 250;
export const MODAL_GLIDE_CURVE: GlideCurve = [0.33, 1, 0.68, 1];
export const MODAL_GLIDE_ANDROID_MS = 285;
export const MODAL_GLIDE_ANDROID_CURVE: GlideCurve = [0.2, 0, 0, 1];
export const NATIVE_TAP_FOCUS_MS = 1000;
export const TAP_FOCUS_MOVE_MAX_PX = 45;
export const IOS_KEYBOARD_SETTLE_MS = 400;
export const IOS_KEYBOARD_FORECAST_MS = 1200;
export const PAGE_RAISE_TOP_MARGIN_PX = 12;
export const PAGE_RAISE_SNAP_CLEAR_RATIO = 0.35;
export const PAGE_RAISE_HOLD_MAX_MS = 300000;
const SEARCH_PULL_UP_MAX_WIDTH = 992;

const PAGE_TAP_FIELDS: readonly RefName[] = ['hwScannerInput'];

const MODAL_TAP_TYPES = new Set(['text', 'tel', 'number', 'password', 'email', 'search', 'url', 'textarea']);
const PICKER_INPUT_TYPES = new Set(['date', 'time', 'datetime-local', 'month', 'week']);

export interface ModalNaturalBox {
    top: number;
    height: number;
    pad: number;
    cap: number;
    safe?: number;
}

interface ModalGlide {
    el: HTMLElement;
    to: number;
    from: number;
    duration: number;
    curve: GlideCurve;
    anim: Animation;
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
let modalGlide: ModalGlide | null = null;
let keyboardLayer: { modal: HTMLElement; height: number } | null = null;
let layerGlide: ModalGlide | null = null;
let modalWatched: HTMLElement | null = null;
let modalResizeObserver: ResizeObserver | null = null;
let touchesDown = 0;
let caughtClick: { field: HTMLElement; until: number } | null = null;
let lastTouchEndAt = -Infinity;
let tapFocusTouch: { id: number; x: number; y: number } | null = null;
let lastTouchTarget: EventTarget | null = null;
let iosKeyboard: { inset: number; settled: boolean; applied: number } | null = null;
let iosForecast = 0;
let iosForecastMissed = false;
let iosClosing = false;
let iosKeyboardTimer: ReturnType<typeof setTimeout> | null = null;
let pageRaise: { field: HTMLElement; by: number; page: string; release: () => void } | null = null;
let pageRaiseTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (!uiState.isModalOpen) return null;
    const view = keyboardVisibleViewport();
    if (view || !isNativeAndroid() || !uiState.keyboardOpen) return view;
    const top = Math.round(window.visualViewport?.offsetTop ?? 0);
    const height = Math.round(window.innerHeight);
    return Number.isFinite(top) && top > 0 && Number.isFinite(height) && height > 0 ? { top, height } : null;
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

function bezierPoint(p1: number, p2: number, s: number): number {
    const r = 1 - s;
    return 3 * p1 * s * r * r + 3 * p2 * s * s * r + s * s * s;
}

function bezierSlope(p1: number, p2: number, s: number): number {
    const r = 1 - s;
    return 3 * p1 * r * r + 6 * (p2 - p1) * s * r + 3 * (1 - p2) * s * s;
}

function bezierParam(x1: number, x2: number, x: number): number {
    let lo = 0;
    let hi = 1;
    let s = x;
    for (let i = 0; i < 24; i++) {
        const err = bezierPoint(x1, x2, s) - x;
        if (Math.abs(err) < 1e-5) return s;
        if (err > 0) hi = s;
        else lo = s;
        const slope = bezierSlope(x1, x2, s);
        const next = slope > 1e-6 ? s - err / slope : NaN;
        s = next > lo && next < hi ? next : (lo + hi) / 2;
    }
    return s;
}

export function glideCurveAt(curve: GlideCurve, t: number): { progress: number; slope: number } {
    const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
    const s = bezierParam(curve[0], curve[2], x);
    const dx = bezierSlope(curve[0], curve[2], s);
    return { progress: bezierPoint(curve[1], curve[3], s), slope: dx > 1e-6 ? bezierSlope(curve[1], curve[3], s) / dx : 0 };
}

export function glideCurveFrom(base: GlideCurve, from: number, velocity: number | null, duration: number): GlideCurve {
    if (velocity === null) return base;
    const slope = -velocity * duration / from;
    const lift = Number.isFinite(slope) ? Math.min(1, Math.max(0, slope * base[0])) : base[1];
    return [base[0], lift, base[2], base[3]];
}

function glideMotion(glide: ModalGlide): { offset: number; velocity: number } {
    const time = Number(glide.anim.currentTime);
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    if (t >= glide.duration) return { offset: 0, velocity: 0 };
    const at = glideCurveAt(glide.curve, t / glide.duration);
    return { offset: glide.from * (1 - at.progress), velocity: -glide.from * at.slope / glide.duration };
}

function glideTiming(from: number, velocity: number | null): { duration: number; curve: GlideCurve } {
    const android = isAndroidDevice();
    const duration = android ? MODAL_GLIDE_ANDROID_MS : MODAL_GLIDE_MS;
    return { duration, curve: glideCurveFrom(android ? MODAL_GLIDE_ANDROID_CURVE : MODAL_GLIDE_CURVE, from, velocity, duration) };
}

function cardHasOtherAnimation(card: HTMLElement): boolean {
    if (typeof card.getAnimations !== 'function') return false;
    try {
        return card.getAnimations().some((a) => a.playState === 'running');
    } catch (e) {
        return false;
    }
}

function startGlide(el: HTMLElement, to: number, from: number, timing: { duration: number; curve: GlideCurve }, layer: boolean): ModalGlide | null {
    const options: KeyframeAnimationOptions = { duration: timing.duration, easing: 'cubic-bezier(' + timing.curve.map((n) => Math.round(n * 10000) / 10000).join(', ') + ')' };
    if (layer) options.pseudoElement = '::after';
    else if (cardHasOtherAnimation(el)) options.composite = 'add';
    let anim: Animation | null;
    try {
        anim = animateElement(el, [{ transform: 'translate3d(0,' + from + 'px,0)' }, { transform: 'translate3d(0,0,0)' }], options);
    } catch (e) {
        anim = null;
    }
    return anim ? { el, to, from, duration: timing.duration, curve: timing.curve, anim } : null;
}

function modalCardShownTop(card: HTMLElement): number {
    if (!modalRest || modalRest.card !== card) return NaN;
    return modalRest.top + (modalGlide && modalGlide.el === card ? glideMotion(modalGlide).offset : 0);
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

function stopLayerGlide(): void {
    const glide = layerGlide;
    layerGlide = null;
    if (!glide) return;
    try { glide.anim.cancel(); } catch (e) {}
}

function layerGlideSupported(): boolean {
    try {
        return typeof KeyframeEffect === 'function' && 'pseudoElement' in KeyframeEffect.prototype;
    } catch (e) {
        return false;
    }
}

function glideKeyboardLayer(card: ModalGlide | null): void {
    const id = topmostModal();
    const modal = id ? modalElement(id) : null;
    const height = modal ? uiState.modalViewportHeight : 0;
    const seen = keyboardLayer;
    keyboardLayer = modal ? { modal, height } : null;
    if (layerGlide && (!modal || !height || layerGlide.el !== modal)) stopLayerGlide();
    if (!modal || !height || !seen || seen.modal !== modal || Math.abs(seen.height - height) < 1) return;
    const running = layerGlide;
    const motion = running ? glideMotion(running) : null;
    stopLayerGlide();
    const from = Math.round(seen.height > 0 ? seen.height + (motion ? motion.offset : 0) - height : window.innerHeight - height);
    if (!(Math.abs(from) >= 2) || !modalMotionAllowed() || !layerGlideSupported()) return;
    const glide = startGlide(modal, height, from, card ? { duration: card.duration, curve: card.curve } : glideTiming(from, motion ? motion.velocity : null), true);
    layerGlide = glide;
    if (glide) glide.anim.onfinish = () => {
        if (layerGlide === glide) layerGlide = null;
    };
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

function glideModalCard(shown: number, animate: boolean): ModalGlide | null {
    const now = topmostModalCard();
    watchModalCard(now ? now.card : null);
    if (modalGlide && (!now || modalGlide.el !== now.card)) stopModalGlide();
    const to = now ? cardLayoutTop(now.card) - uiState.modalViewportTop : NaN;
    if (!now || !Number.isFinite(to)) {
        stopModalGlide();
        modalRest = null;
        return null;
    }
    const was = modalRest;
    modalRest = { card: now.card, top: to, width: window.innerWidth };
    if (modalGlide && Math.abs(modalGlide.to - to) < 1) return null;
    const running = modalGlide;
    const velocity = running ? glideMotion(running).velocity : null;
    stopModalGlide();
    if (!(animate || running) || !was || was.card !== now.card || was.width !== modalRest.width) return null;
    const from = Math.round(shown - to);
    if (!Number.isFinite(from) || Math.abs(from) < 2 || !modalMotionAllowed()) return null;
    const glide = startGlide(now.card, to, from, glideTiming(from, velocity), false);
    modalGlide = glide;
    if (glide) glide.anim.onfinish = () => {
        if (modalGlide === glide) modalGlide = null;
    };
    return glide;
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
    glideKeyboardLayer(glideModalCard(shown, true));
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
    if (isAndroidDevice()) return;
    const field = textEntryField(e.target);
    if (!field) {
        if (iosClosing && inputViewField(e.target)) {
            iosClosing = false;
            if (uiState.isModalOpen) measureModalKeyboard();
        }
        return;
    }
    if (touchesDown > 0) return;
    iosClosing = false;
    const tapped = performance.now() - lastTouchEndAt < NATIVE_TAP_FOCUS_MS;
    if (iosKeyboard || (tapped && lastTouchTarget === field)) forecastModalKeyboard(field);
}

function noteIOSFieldBlur(e: FocusEvent): void {
    if (isAndroidDevice() || !uiState.isModalOpen || !inputViewField(e.target) || inputViewField(e.relatedTarget)) return;
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
    const fit = uiState.modalKeyboardFit;
    const pan = top - uiState.modalViewportTop;
    if (pan && fit && isNativeAndroid() && uiState.keyboardOpen) {
        changed = setModalKeyboardFit({ ...fit, top: fit.top + pan, shift: fit.shift + pan });
    }
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

export function iosTapFieldOf(target: EventTarget | null): HTMLElement | null {
    const node = target as Element | null;
    if (!node || typeof node.closest !== 'function' || !usesIOSPanelHandoff()) return null;
    const label = node.closest('label') as HTMLLabelElement | null;
    for (const name of PAGE_TAP_FIELDS) {
        const field = elementOf(name);
        if (!field || node === field) continue;
        if (label && label.htmlFor && label.htmlFor === field.id) return field;
        const icon = node.closest('.icon');
        if (icon && field.parentElement && icon.parentElement === field.parentElement) return field;
    }
    const modal = label && label.htmlFor ? label.closest('.modal') : null;
    const control = modal ? (label!.control as HTMLElement | null) : null;
    return control && control !== node && modal!.contains(control) ? control : null;
}

function modalTapField(target: EventTarget | null): HTMLElement | null {
    const el = (iosTapFieldOf(target) || target) as HTMLInputElement | null;
    if (!el || typeof el.closest !== 'function' || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return null;
    if (!MODAL_TAP_TYPES.has(String(el.type || '').toLowerCase()) || el.disabled || el.readOnly) return null;
    if (document.activeElement === el && (el === modalTapFocused || keyboardVisibleViewport())) return null;
    const modal = el.closest('.modal') as HTMLElement | null;
    if (modal) return modal.id && modalIsOpen(modal.id) ? el : null;
    if (el.closest('.app-lock')) return securityState.appIsLocked && usesIOSPanelHandoff() && pageFieldStaysAboveKeyboard(el) ? el : null;
    return !uiState.isModalOpen && pageTapField(el) && (pageFieldStaysAboveKeyboard(el) || pageFieldRaiseFor(el) > 0) ? el : null;
}

function pageTapField(el: Element | null): boolean {
    return !!el && PAGE_TAP_FIELDS.some((name) => elementOf(name) === el);
}

function expectedKeyboardLine(el: HTMLElement, height: number): number {
    const seen = rememberedKeyboardInset(el);
    const phone = window.innerWidth < PAGE_TAP_PHONE_MAX_WIDTH && height > window.innerWidth;
    return height - (seen > 0 ? seen : Math.round(height * (phone ? PAGE_TAP_PHONE_KEYBOARD_RATIO : PAGE_TAP_KEYBOARD_RATIO)));
}

export function pageFieldStaysAboveKeyboard(el: HTMLElement): boolean {
    const height = window.innerHeight;
    if (!Number.isFinite(height) || height <= 0) return false;
    const box = el.getBoundingClientRect();
    return Number.isFinite(box.bottom) && box.height > 0 && box.top >= 0 && box.bottom + MODAL_KEYBOARD_GAP_PX <= expectedKeyboardLine(el, height);
}

function pageRaiseNeeded(el: HTMLElement, line: number): number {
    if (!usesIOSPanelHandoff() || window.innerWidth >= SEARCH_PULL_UP_MAX_WIDTH || uiState.isModalOpen) return 0;
    const pages = elementOf('appPages');
    const { side, main } = activePanelSections();
    if (!pages || !side || !main || !side.contains(el)) return 0;
    const box = el.getBoundingClientRect();
    const need = Math.ceil(box.bottom + MODAL_KEYBOARD_GAP_PX - line);
    if (!Number.isFinite(need) || need <= 0 || !(box.height > 0)) return 0;
    const top = pages.getBoundingClientRect().top;
    const scrolled = pages.scrollTop;
    const snapAt = main.getBoundingClientRect().top - top + scrolled;
    if (box.top - need < top + PAGE_RAISE_TOP_MARGIN_PX || need > pages.scrollHeight - pages.clientHeight - scrolled) return 0;
    return snapAt - (scrolled + need) > pages.clientHeight * PAGE_RAISE_SNAP_CLEAR_RATIO ? need : 0;
}

export function pageFieldRaiseFor(el: HTMLElement): number {
    const height = window.innerHeight;
    return Number.isFinite(height) && height > 0 ? pageRaiseNeeded(el, expectedKeyboardLine(el, height)) : 0;
}

function glidePageScroll(to: number): number {
    const pages = elementOf('appPages');
    if (!pages) return 0;
    const { side, main } = activePanelSections();
    const from = pages.scrollTop;
    const parts = [side, main].filter((el): el is HTMLElement => !!el).map((el) => ({ el, top: el.getBoundingClientRect().top }));
    setElementScrollTop(pages, to);
    const moved = pages.scrollTop - from;
    if (moved) parts.forEach((p) => panelGlideFrom(p.el, p.top, PANEL_SEARCH_GLIDE));
    return moved;
}

function holdPageSnap(): () => void {
    return beginPanelGlideSnapPause(PAGE_RAISE_HOLD_MAX_MS);
}

function extendPageSnapHold(): void {
    holdPageSnap()();
}

function raisePageField(field: HTMLElement, by: number): void {
    const pages = elementOf('appPages');
    if (!pages || !(by > 0)) return;
    const current = pageRaise && pageRaise.field === field ? pageRaise : null;
    const release = current ? current.release : holdPageSnap();
    const moved = glidePageScroll(pages.scrollTop + by);
    if (moved > 0) extendPageSnapHold();
    if (moved <= 0 && !current) {
        release();
        return;
    }
    pageRaise = { field, by: (current ? current.by : 0) + Math.max(0, moved), page: uiState.currentAppPage, release };
}

function clearPageRaiseTimer(): void {
    if (pageRaiseTimer !== null) clearTimeout(pageRaiseTimer);
    pageRaiseTimer = null;
}

function dropPageRaise(): void {
    const raise = pageRaise;
    pageRaise = null;
    clearPageRaiseTimer();
    if (raise) raise.release();
}

function lowerPageField(): void {
    const raise = pageRaise;
    pageRaise = null;
    clearPageRaiseTimer();
    if (!raise) return;
    const pages = elementOf('appPages');
    const sections = activePanelSections();
    if (pages && raise.page === uiState.currentAppPage && sections.side && !panelIsCollapsed(sections.panel)) {
        glidePageScroll(Math.max(0, pages.scrollTop - raise.by));
    }
    raise.release();
}

function notePageFieldBlur(e: FocusEvent): void {
    if (pageRaise && e.target === pageRaise.field) lowerPageField();
}

function settlePageRaise(): void {
    pageRaiseTimer = null;
    const field = document.activeElement as HTMLElement | null;
    const view = pageTapField(field) ? keyboardVisibleViewport() : null;
    if (!field || !view) return;
    raisePageField(field, pageRaiseNeeded(field, view.top + view.height));
}

function notePageKeyboardResize(): void {
    if (!usesIOSPanelHandoff() || !pageTapField(document.activeElement)) return;
    clearPageRaiseTimer();
    pageRaiseTimer = setTimeout(settlePageRaise, IOS_KEYBOARD_SETTLE_MS);
}

export function settleDocumentScroll(): void {
    if (usesIOSPanelHandoff() && (softKeyboardShown() || textEntryField(document.activeElement))) return;
    scrollWindowToTop();
}

function noteTouchesDown(e: TouchEvent): void {
    touchesDown = e.touches ? e.touches.length : 0;
    const first = e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : null;
    if (e.type === 'touchstart') tapFocusTouch = first ? { id: first.identifier, x: first.clientX, y: first.clientY } : null;
    if (e.type !== 'touchend' && e.type !== 'touchcancel') return;
    if (e.type === 'touchcancel' || touchLeftTap(e)) tapFocusTouch = null;
    lastTouchEndAt = performance.now();
    lastTouchTarget = e.type === 'touchend' && e.changedTouches && e.changedTouches.length ? e.changedTouches[0].target : null;
}

function touchLeftTap(e: TouchEvent): boolean {
    const start = tapFocusTouch;
    const list = e.changedTouches;
    if (!start || !list) return false;
    for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t && t.identifier === start.id) return Math.abs(t.clientX - start.x) > TAP_FOCUS_MOVE_MAX_PX || Math.abs(t.clientY - start.y) > TAP_FOCUS_MOVE_MAX_PX;
    }
    return false;
}

function textEntryField(target: EventTarget | null): HTMLElement | null {
    const el = target as HTMLInputElement | null;
    if (!el || typeof el.closest !== 'function' || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return null;
    return MODAL_TAP_TYPES.has(String(el.type || '').toLowerCase()) && !el.disabled && !el.readOnly ? el : null;
}

function inputViewField(target: EventTarget | null): HTMLElement | null {
    const text = textEntryField(target);
    if (text) return text;
    const el = target as HTMLInputElement | HTMLSelectElement | null;
    if (!el || typeof el.closest !== 'function') return null;
    if (el.tagName === 'SELECT') return el;
    return el.tagName === 'INPUT' && PICKER_INPUT_TYPES.has(String(el.type || '').toLowerCase()) && !(el as HTMLInputElement).readOnly ? el : null;
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
    const tapFocus = !!tapFocusTouch && (touchesDown > 0 || performance.now() - lastTouchEndAt < NATIVE_TAP_FOCUS_MS);
    tapFocusTouch = null;
    if (tapFocus || touchesDown > 0 || !usesIOSPanelHandoff()) return;
    const field = inputViewField(e.target);
    const view = field ? keyboardVisibleViewport() : null;
    if (!field || !view || document.activeElement !== field || !keyboardFocusStaysInView(field, view)) return;
    focusElementWithoutScroll(field);
}

export function noteModalTouchStart(e: TouchEvent): void {
    noteTouchesDown(e);
    modalTap = null;
    caughtClick = null;
    if (modalFocusRefused) return;
    const ios = usesIOSPanelHandoff();
    if (!ios && !isAndroidDevice()) return;
    const field = modalTapField(e.target);
    if (!field || !e.touches || e.touches.length !== 1) return;
    if (!ios && ((field.closest('.modal') && !isNativeAndroid()) || (document.activeElement === field && uiState.keyboardOpen))) return;
    const t = e.touches[0];
    modalTap = { id: t.identifier, x: t.clientX, y: t.clientY, at: e.timeStamp, field };
}

export function forgetModalTap(e?: TouchEvent): void {
    modalTap = null;
    if (e) noteTouchesDown(e);
}

function forgetModalTapFocus(): void {
    modalTapFocused = null;
}

function forgetIOSTapFocus(): void {
    if (usesIOSPanelHandoff()) modalTapFocused = null;
}

export function focusModalFieldWithoutScroll(e: TouchEvent): void {
    noteTouchesDown(e);
    const tap = modalTap;
    modalTap = null;
    if (!tap || modalTapField(e.target) !== tap.field || !tapEndedInPlace(e, tap, MODAL_TAP_SLOP_PX, MODAL_TAP_MAX_MS)) return;
    e.preventDefault();
    focusCaughtField(tap.field);
}

function focusCaughtField(field: HTMLElement): void {
    if (document.activeElement === field) blurActiveElement();
    if (!focusElementWithoutScroll(field)) {
        modalFocusRefused = true;
        return;
    }
    modalTapFocused = field;
    if (usesIOSPanelHandoff()) caughtClick = { field, until: performance.now() + CAUGHT_CLICK_MS };
    else if (field.closest('.modal')) revealFocusedModalField();
    if (pageTapField(field)) raisePageField(field, pageFieldRaiseFor(field));
}

function syntheticTapClick(e: MouseEvent): boolean {
    return !e.defaultPrevented && e.button === 0 && touchesDown === 0 && performance.now() - lastTouchEndAt <= CAUGHT_CLICK_MS && usesIOSPanelHandoff();
}

function focusSyntheticTapField(e: MouseEvent): void {
    if (!syntheticTapClick(e) || catchIOSSearchSyntheticTap(e) || modalFocusRefused) return;
    const field = modalTapField(e.target);
    if (!field) return;
    e.preventDefault();
    focusCaughtField(field);
}

export function appLockPinFocusOptions(): FocusOptions | undefined {
    commitNow();
    const pin = elementOf('appLockPinInput');
    return pin && usesIOSPanelHandoff() && pageFieldStaysAboveKeyboard(pin) ? { preventScroll: true } : undefined;
}

function swallowCaughtClick(e: Event): void {
    const caught = caughtClick;
    if (!caught) return;
    if (performance.now() > caught.until || document.activeElement !== caught.field) {
        caughtClick = null;
        return;
    }
    const target = e.target as Node | null;
    if (!target || (target !== caught.field && !caught.field.contains(target) && iosTapFieldOf(target) !== caught.field)) return;
    e.preventDefault();
    if (e.type === 'click') caughtClick = null;
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
    stopLayerGlide();
    modalRest = null;
    keyboardLayer = null;
    modalWatched = null;
    touchesDown = 0;
    caughtClick = null;
    dropPageRaise();
    lastTouchEndAt = -Infinity;
    tapFocusTouch = null;
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
    scope.listen(window, 'blur', forgetIOSTapFocus);
    scope.listen(document, 'focus', keepKeyboardFocusInPlace, { capture: true });
    scope.listen(document, 'focusin', noteIOSFieldFocus, { capture: true });
    scope.listen(document, 'focusout', noteIOSFieldBlur, { capture: true });
    scope.listen(document, 'focusout', notePageFieldBlur, { capture: true });
    scope.listen(document, 'mousedown', swallowCaughtClick, { capture: true });
    scope.listen(document, 'click', swallowCaughtClick, { capture: true });
    scope.listen(document, 'mousedown', focusSyntheticTapField, { capture: true });
    scope.onDispose(() => {
        endKeyboardSession();
        resetIOSKeyboard();
        stopModalGlide();
        stopLayerGlide();
        if (modalResizeObserver) modalResizeObserver.disconnect();
        modalResizeObserver = null;
        modalRest = null;
        keyboardLayer = null;
        modalWatched = null;
        caughtClick = null;
        dropPageRaise();
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
    scope.listen(vv, 'resize', notePageKeyboardResize);
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
