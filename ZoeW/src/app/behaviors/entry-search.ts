import { uiState } from '../../core/state';
import { commitNow } from '../flush';
import { elementOf, fieldValue, isFieldFocused, setElementScrollTop, type RefName } from '../refs';
import { panelGlideFrom } from './panel-motion';
import { panelIsCollapsed, setPanelCollapsed, syncHistoryExpandedLock } from './panels';

export const ENTRY_SEARCH_FIELDS: readonly RefName[] = ['entryListSearchInput', 'lockerListSearchInput'];

const ENTRY_SEARCH_WIDE_MIN_PX = 992;

let entrySearchCollapsed = false;

export function entrySearchFieldFocused(): boolean {
    return ENTRY_SEARCH_FIELDS.some((f) => isFieldFocused(f));
}

export function glideEntryPanelCollapsed(collapsed: boolean): boolean {
    const main = elementOf('entryMainSection');
    if (!main || !elementOf('entrySideSection') || panelIsCollapsed('entry') === collapsed) return false;
    commitNow();
    const before = main.getBoundingClientRect().top;
    setPanelCollapsed('entry', collapsed);
    syncHistoryExpandedLock();
    commitNow();
    if (!collapsed) setElementScrollTop(elementOf('appPages'), 0);
    panelGlideFrom(main, before);
    return true;
}

export function entrySearchFocused(): void {
    if (window.innerWidth >= ENTRY_SEARCH_WIDE_MIN_PX || uiState.currentAppPage !== 'entry') return;
    if (glideEntryPanelCollapsed(true)) entrySearchCollapsed = true;
}

export function entrySearchBlurred(): void {
    setTimeout(() => {
        if (!entrySearchCollapsed || entrySearchFieldFocused()) return;
        if (ENTRY_SEARCH_FIELDS.some((f) => fieldValue(f).trim())) return;
        entrySearchCollapsed = false;
        if (uiState.currentAppPage === 'entry') glideEntryPanelCollapsed(false);
        else setPanelCollapsed('entry', false);
    }, 150);
}
