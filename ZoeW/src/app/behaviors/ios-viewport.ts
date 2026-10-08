import { uiState } from '../../core/state';
import { scrollWindowToTop } from '../../platform/document-io';
import type { LifecycleScope } from '../lifecycle/scope';
import { elementOf, focusField, isFieldFocused, type RefName } from '../refs';
import { ENTRY_SEARCH_FIELDS, entrySearchBlurred, entrySearchFieldFocused, entrySearchFocused } from './entry-search';
import { usesIOSPanelHandoff } from './panels';
import { glidePhoneSearchPulledUp } from './phone-search';

export const IOS_SEARCH_TAP_SLOP_PX = 10;
export const IOS_SEARCH_TAP_MAX_MS = 500;
const IOS_SEARCH_WIDE_MIN_PX = 992;

const IOS_SEARCH_FIELDS: readonly RefName[] = ['searchPhoneInput', ...ENTRY_SEARCH_FIELDS];

let searchTap: { id: number; x: number; y: number; at: number; field: RefName } | null = null;
let searchFocusRefused = false;

export function restoreIOSDocumentScroll(): void {
    if (!(uiState.dataPanelSearchFocus || entrySearchFieldFocused()) || !usesIOSPanelHandoff()) return;
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

function searchTapField(target: EventTarget | null): RefName | null {
    if (!target) return null;
    for (const field of IOS_SEARCH_FIELDS) {
        const input = elementOf<HTMLInputElement>(field);
        if (!input || target !== input) continue;
        if (input.disabled || input.readOnly || isFieldFocused(field)) return null;
        return field;
    }
    return null;
}

export function noteIOSSearchTouchStart(e: TouchEvent): void {
    searchTap = null;
    if (searchFocusRefused || !usesIOSPanelHandoff() || window.innerWidth >= IOS_SEARCH_WIDE_MIN_PX) return;
    const field = searchTapField(e.target);
    if (!e.touches || e.touches.length !== 1 || !field) return;
    const t = e.touches[0];
    searchTap = { id: t.identifier, x: t.clientX, y: t.clientY, at: e.timeStamp, field };
}

export function forgetIOSSearchTap(): void {
    searchTap = null;
}

export function focusIOSSearchWithoutScroll(e: TouchEvent): void {
    const tap = searchTap;
    searchTap = null;
    if (!tap || !e.cancelable || (e.touches && e.touches.length) || searchTapField(e.target) !== tap.field) return;
    const t = touchById(e.changedTouches, tap.id);
    if (!t || Math.abs(t.clientX - tap.x) > IOS_SEARCH_TAP_SLOP_PX || Math.abs(t.clientY - tap.y) > IOS_SEARCH_TAP_SLOP_PX) return;
    if (!(e.timeStamp - tap.at <= IOS_SEARCH_TAP_MAX_MS)) return;
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
