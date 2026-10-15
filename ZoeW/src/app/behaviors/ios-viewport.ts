import { uiState } from '../../core/state';
import { scrollWindowToTop } from '../../platform/document-io';
import { isAndroidDevice } from '../../platform/native';
import { createLifecycleScope, type LifecycleScope } from '../lifecycle/scope';
import { elementOf, focusField, isFieldFocused, setElementScrollTop, type RefName } from '../refs';
import { KEYBOARD_MIN_INSET_PX } from './chrome-autohide';
import { ENTRY_SEARCH_FIELDS, entrySearchBlurred, entrySearchFieldFocused, entrySearchFocused, entrySearchMovesField } from './entry-search';
import { PANEL_GLIDE_HOLD_MAX_MS, PANEL_GLIDE_SNAP_GRACE_MS, PANEL_SEARCH_GLIDE, PANEL_SEARCH_GLIDE_MS, beginPanelGlideSnapPause, endPanelGlideSnapPause, panelGlideFrom } from './panel-motion';
import { activePanelSections, panelIsCollapsed, usesIOSPanelHandoff } from './panels';
import { glidePhoneSearchPulledUp } from './phone-search';

export const IOS_SEARCH_TAP_SLOP_PX = 10;
export const IOS_SEARCH_TAP_MAX_MS = 500;
const IOS_SEARCH_WIDE_MIN_PX = 992;
export const IOS_SEARCH_PULLDOWN_SETTLE_MS = PANEL_SEARCH_GLIDE_MS + PANEL_GLIDE_HOLD_MAX_MS + PANEL_GLIDE_SNAP_GRACE_MS + 200;
export const IOS_SEARCH_PULLDOWN_SNAP_PAUSE_MS = PANEL_SEARCH_GLIDE_MS + PANEL_GLIDE_HOLD_MAX_MS;

const IOS_SEARCH_FIELDS: readonly RefName[] = ['searchPhoneInput', ...ENTRY_SEARCH_FIELDS];

let searchTap: { id: number; x: number; y: number; at: number; field: RefName } | null = null;
let searchFocusRefused = false;
let keyboardPan: { id: number; x: number; y: number; block: boolean | null } | null = null;
let keyboardLocked = false;
let keyboardPanScope: LifecycleScope | null = null;
let searchPulledUp = false;
let pullDownSettleTimer: ReturnType<typeof setTimeout> | null = null;
let pullDownTouchSeen = false;
let listRoomObserver: ResizeObserver | null = null;

export function iosSearchDocumentLocked(): boolean {
    return (uiState.dataPanelSearchFocus || (panelIsCollapsed('entry') && entrySearchFieldFocused())) && usesIOSPanelHandoff();
}

function iosModalDocumentLocked(): boolean {
    return uiState.isModalOpen && usesIOSPanelHandoff();
}

export function iosModalKeyboardLocked(): boolean {
    return uiState.modalViewportHeight > 0 && usesIOSPanelHandoff();
}

function iosKeyboardPanLocked(): boolean {
    return iosModalKeyboardLocked() || (iosSearchDocumentLocked() && window.innerWidth < IOS_SEARCH_WIDE_MIN_PX);
}

export function restoreIOSDocumentScroll(): void {
    if (!iosSearchDocumentLocked() && !iosModalDocumentLocked()) return;
    if ((window.scrollY || 0) === 0) return;
    scrollWindowToTop();
}

export function listenIOSDocumentScroll(scope: LifecycleScope): void {
    scope.listen(window, 'scroll', restoreIOSDocumentScroll, { passive: true });
    if (window.visualViewport) scope.listen(window.visualViewport, 'scroll', restoreIOSDocumentScroll);
}

export function iosKeyboardInsetPx(): number {
    const viewport = window.visualViewport;
    if (!viewport || !iosSearchDocumentLocked() || window.innerWidth >= IOS_SEARCH_WIDE_MIN_PX) return 0;
    const inset = Math.round(window.innerHeight - viewport.height);
    return inset >= KEYBOARD_MIN_INSET_PX && Number.isFinite(inset) ? inset : 0;
}

function overflowsY(node: Element): boolean {
    return node.scrollHeight - node.clientHeight > 1;
}

export function measureIOSKeyboardListRoom(): void {
    const scroller = keyboardLocked ? activePanelSections().scroller : null;
    const fixed = !!scroller && !overflowsY(scroller);
    if (uiState.iosKeyboardListFixed !== fixed) uiState.iosKeyboardListFixed = fixed;
    const box = keyboardLocked && uiState.phoneSuggestOpen ? elementOf('phoneSuggestBox') : null;
    const suggestFixed = !!box && !overflowsY(box);
    if (uiState.iosKeyboardSuggestFixed !== suggestFixed) uiState.iosKeyboardSuggestFixed = suggestFixed;
}

function watchIOSKeyboardListRoom(on: boolean): void {
    if (listRoomObserver) listRoomObserver.disconnect();
    listRoomObserver = null;
    const scroller = on ? activePanelSections().scroller : null;
    const box = on ? elementOf('phoneSuggestBox') : null;
    if ((scroller || box) && typeof ResizeObserver === 'function') {
        listRoomObserver = new ResizeObserver(measureIOSKeyboardListRoom);
        if (scroller) listRoomObserver.observe(scroller);
        if (scroller && scroller.firstElementChild) listRoomObserver.observe(scroller.firstElementChild);
        if (box) listRoomObserver.observe(box);
    }
    measureIOSKeyboardListRoom();
}

function armIOSKeyboardPanBlock(on: boolean): void {
    if (on === (keyboardPanScope !== null)) return;
    watchIOSKeyboardListRoom(on);
    if (!on) {
        keyboardPanScope!.dispose();
        keyboardPanScope = null;
        keyboardPan = null;
        return;
    }
    keyboardPanScope = createLifecycleScope();
    keyboardPanScope.listen(document, 'touchmove', blockIOSKeyboardPan, { capture: true, passive: false });
}

export function measureIOSKeyboardInset(): void {
    keyboardLocked = iosSearchDocumentLocked();
    armIOSKeyboardPanBlock(keyboardLocked || iosModalKeyboardLocked());
    const inset = iosKeyboardInsetPx();
    if (uiState.iosKeyboardInset !== inset) uiState.iosKeyboardInset = inset;
}

function verticalRoom(node: Element, down: boolean): boolean {
    if (!overflowsY(node)) return false;
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY !== 'auto' && overflowY !== 'scroll') return false;
    return down ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1;
}

function keyboardPanBlocked(target: EventTarget | null, down: boolean): boolean {
    let node: Element | null = target && (target as Node).nodeType === 1 ? (target as Element) : null;
    while (node) {
        if (verticalRoom(node, down)) return false;
        node = node.parentElement;
    }
    return true;
}

function iosSearchPulledUp(): boolean {
    return uiState.dataPanelSearchFocus && usesIOSPanelHandoff() && window.innerWidth < IOS_SEARCH_WIDE_MIN_PX;
}

function clearPullDownSettle(): void {
    if (pullDownSettleTimer !== null) clearTimeout(pullDownSettleTimer);
    pullDownSettleTimer = null;
}

export function restIOSSearchPullDown(): void {
    pullDownSettleTimer = null;
    if (pullDownTouchSeen || iosSearchPulledUp() || isFieldFocused('searchPhoneInput')) return;
    const pages = elementOf('appPages');
    if (!pages || !(pages.scrollTop > 0)) return;
    setElementScrollTop(pages, 0);
}

export function settleIOSSearchPullDown(): void {
    clearPullDownSettle();
    pullDownTouchSeen = false;
    const pages = elementOf('appPages');
    if (!pages) return;
    const gliders = [elementOf('dataSearchCard'), elementOf('dataMainSection')];
    const tops = gliders.map((el) => (el ? el.getBoundingClientRect().top : NaN));
    const releaseSnap = beginPanelGlideSnapPause(IOS_SEARCH_PULLDOWN_SNAP_PAUSE_MS);
    if (pages.scrollTop > 0) {
        setElementScrollTop(pages, 0);
        gliders.forEach((el, i) => panelGlideFrom(el, tops[i], PANEL_SEARCH_GLIDE));
    }
    releaseSnap();
    pullDownSettleTimer = setTimeout(restIOSSearchPullDown, IOS_SEARCH_PULLDOWN_SETTLE_MS);
}

function noteIOSSearchPullState(): void {
    const pulled = iosSearchPulledUp();
    if (pulled === searchPulledUp) return;
    searchPulledUp = pulled;
    if (pulled) clearPullDownSettle();
    else settleIOSSearchPullDown();
}

export function noteIOSKeyboardTouchStart(e: TouchEvent): void {
    keyboardPan = null;
    pullDownTouchSeen = true;
    if (pullDownSettleTimer !== null && uiState.panelGliding) endPanelGlideSnapPause();
    if (!e.touches || e.touches.length !== 1 || !iosKeyboardPanLocked()) return;
    const t = e.touches[0];
    keyboardPan = { id: t.identifier, x: t.clientX, y: t.clientY, block: null };
}

export function blockIOSKeyboardPan(e: TouchEvent): void {
    const pan = keyboardPan;
    if (!pan || !e.cancelable || !e.touches || e.touches.length !== 1) return;
    const t = touchById(e.touches, pan.id);
    if (!t) return;
    if (pan.block === null) {
        const dx = t.clientX - pan.x;
        const dy = t.clientY - pan.y;
        if (dx === 0 && dy === 0) return;
        const field = e.target as HTMLElement | null;
        const inField = !!field && (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') && !IOS_SEARCH_FIELDS.some((name) => elementOf(name) === field) &&
            !(iosModalKeyboardLocked() && typeof field.closest === 'function' && !!field.closest('.modal'));
        pan.block = Math.abs(dy) >= Math.abs(dx) && !inField && iosKeyboardPanLocked() && keyboardPanBlocked(e.target, dy > 0);
    }
    if (pan.block) e.preventDefault();
}

export function forgetIOSKeyboardTouch(): void {
    keyboardPan = null;
}

export function listenIOSKeyboard(scope: LifecycleScope): void {
    keyboardPan = null;
    keyboardLocked = false;
    searchPulledUp = false;
    pullDownTouchSeen = false;
    clearPullDownSettle();
    armIOSKeyboardPanBlock(false);
    if (!usesIOSPanelHandoff()) return;
    if (window.visualViewport) scope.listen(window.visualViewport, 'resize', measureIOSKeyboardInset);
    scope.onDispose(uiState.subscribe(() => {
        noteIOSSearchPullState();
        const searchLocked = iosSearchDocumentLocked();
        if (searchLocked === keyboardLocked && (searchLocked || iosModalKeyboardLocked()) === (keyboardPanScope !== null)) return;
        measureIOSKeyboardInset();
    }));
    scope.onDispose(() => { armIOSKeyboardPanBlock(false); clearPullDownSettle(); });
    scope.listen(document, 'touchstart', noteIOSKeyboardTouchStart, { capture: true, passive: true });
    scope.listen(document, 'touchend', forgetIOSKeyboardTouch, { capture: true, passive: true });
    scope.listen(document, 'touchcancel', forgetIOSKeyboardTouch, { capture: true, passive: true });
    searchPulledUp = iosSearchPulledUp();
    measureIOSKeyboardInset();
}

function touchById(list: ArrayLike<Touch> | null | undefined, id: number): Touch | null {
    if (!list) return null;
    for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].identifier === id) return list[i];
    }
    return null;
}

export function tapEndedInPlace(e: TouchEvent, tap: { id: number; x: number; y: number; at: number }, slopPx: number, maxMs: number): boolean {
    if (!e.cancelable || (e.touches && e.touches.length)) return false;
    const t = touchById(e.changedTouches, tap.id);
    if (!t || Math.abs(t.clientX - tap.x) > slopPx || Math.abs(t.clientY - tap.y) > slopPx) return false;
    return e.timeStamp - tap.at <= maxMs;
}

function searchTapField(target: EventTarget | null): RefName | null {
    if (!target) return null;
    for (const field of IOS_SEARCH_FIELDS) {
        const input = elementOf<HTMLInputElement>(field);
        if (!input || target !== input) continue;
        if (input.disabled || input.readOnly || isFieldFocused(field)) return null;
        if (field !== 'searchPhoneInput' && !entrySearchMovesField()) return null;
        return field;
    }
    return null;
}

export function noteIOSSearchTouchStart(e: TouchEvent): void {
    searchTap = null;
    if (searchFocusRefused || window.innerWidth >= IOS_SEARCH_WIDE_MIN_PX) return;
    const ios = usesIOSPanelHandoff();
    if (!ios && !isAndroidDevice()) return;
    const field = searchTapField(e.target);
    if (!e.touches || e.touches.length !== 1 || !field || (!ios && field === 'searchPhoneInput')) return;
    const t = e.touches[0];
    searchTap = { id: t.identifier, x: t.clientX, y: t.clientY, at: e.timeStamp, field };
}

export function forgetIOSSearchTap(): void {
    searchTap = null;
}

export function focusIOSSearchWithoutScroll(e: TouchEvent): void {
    const tap = searchTap;
    searchTap = null;
    if (!tap || searchTapField(e.target) !== tap.field || !tapEndedInPlace(e, tap, IOS_SEARCH_TAP_SLOP_PX, IOS_SEARCH_TAP_MAX_MS)) return;
    e.preventDefault();
    const phone = tap.field === 'searchPhoneInput';
    if (phone) glidePhoneSearchPulledUp(true);
    else entrySearchFocused();
    focusField(tap.field, { preventScroll: true });
    if (isFieldFocused(tap.field)) return;
    searchFocusRefused = true;
    if (phone) glidePhoneSearchPulledUp(false);
    else entrySearchBlurred();
}

export function listenIOSSearchFocus(scope: LifecycleScope): void {
    searchTap = null;
    searchFocusRefused = false;
    scope.listen(document, 'touchstart', noteIOSSearchTouchStart, { capture: true, passive: true });
    scope.listen(document, 'touchend', focusIOSSearchWithoutScroll, { capture: true, passive: false });
    scope.listen(document, 'touchcancel', forgetIOSSearchTap, { capture: true, passive: true });
}
