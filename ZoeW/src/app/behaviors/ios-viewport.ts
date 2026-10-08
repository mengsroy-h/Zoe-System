import { uiState } from '../../core/state';
import { scrollWindowToTop } from '../../platform/document-io';
import type { LifecycleScope } from '../lifecycle/scope';
import { elementOf, focusField, isFieldFocused } from '../refs';
import { usesIOSPanelHandoff } from './panels';
import { setPhoneSearchPulledUp } from './phone-search';

export const IOS_SEARCH_TAP_SLOP_PX = 10;
export const IOS_SEARCH_TAP_MAX_MS = 500;
const IOS_SEARCH_WIDE_MIN_PX = 992;

let searchTap: { id: number; x: number; y: number; at: number } | null = null;
let searchFocusRefused = false;

export function restoreIOSDocumentScroll(): void {
    if (!uiState.dataPanelSearchFocus || !usesIOSPanelHandoff()) return;
    if ((window.scrollY || 0) === 0) return;
    scrollWindowToTop();
}

export function listenIOSDocumentScroll(scope: LifecycleScope): void {
    scope.listen(window, 'scroll', restoreIOSDocumentScroll, { passive: true });
    if (window.visualViewport) scope.listen(window.visualViewport, 'scroll', restoreIOSDocumentScroll);
}

function touchById(list: ArrayLike<Touch> | null | undefined, id: number): Touch | null {
    if (!list) return null;
    for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].identifier === id) return list[i];
    }
    return null;
}

function searchTapInput(target: EventTarget | null): HTMLInputElement | null {
    const input = elementOf<HTMLInputElement>('searchPhoneInput');
    if (!input || target !== input || input.disabled || input.readOnly) return null;
    return isFieldFocused('searchPhoneInput') ? null : input;
}

export function noteIOSSearchTouchStart(e: TouchEvent): void {
    searchTap = null;
    if (searchFocusRefused || !usesIOSPanelHandoff() || window.innerWidth >= IOS_SEARCH_WIDE_MIN_PX) return;
    if (!e.touches || e.touches.length !== 1 || !searchTapInput(e.target)) return;
    const t = e.touches[0];
    searchTap = { id: t.identifier, x: t.clientX, y: t.clientY, at: e.timeStamp };
}

export function forgetIOSSearchTap(): void {
    searchTap = null;
}

export function focusIOSSearchWithoutScroll(e: TouchEvent): void {
    const tap = searchTap;
    searchTap = null;
    if (!tap || !e.cancelable || (e.touches && e.touches.length) || !searchTapInput(e.target)) return;
    const t = touchById(e.changedTouches, tap.id);
    if (!t || Math.abs(t.clientX - tap.x) > IOS_SEARCH_TAP_SLOP_PX || Math.abs(t.clientY - tap.y) > IOS_SEARCH_TAP_SLOP_PX) return;
    if (!(e.timeStamp - tap.at <= IOS_SEARCH_TAP_MAX_MS)) return;
    e.preventDefault();
    setPhoneSearchPulledUp(true);
    focusField('searchPhoneInput', { preventScroll: true });
    if (isFieldFocused('searchPhoneInput')) return;
    searchFocusRefused = true;
    setPhoneSearchPulledUp(false);
}

export function listenIOSSearchFocus(scope: LifecycleScope): void {
    searchTap = null;
    searchFocusRefused = false;
    scope.listen(document, 'touchstart', noteIOSSearchTouchStart, { capture: true, passive: true });
    scope.listen(document, 'touchend', focusIOSSearchWithoutScroll, { capture: true, passive: false });
    scope.listen(document, 'touchcancel', forgetIOSSearchTap, { capture: true, passive: true });
}
