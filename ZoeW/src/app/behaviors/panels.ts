import { uiState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { commitNow } from '../flush';
import { elementOf, setElementScrollTop } from '../refs';

/**
 * ⛔ **តំបន់ហាមចូល** (`CLAUDE.md` ច្បាប់ ១១ ៖ PTR · ចលនាផ្ទាំង · ការរមូរ)។
 * តក្កវិជ្ជាដូច `app.js` ដើមបេះបិទ — ប្តូរតែ **របៀបប៉ះ DOM** ៖ ធាតុតាម ref
 * (`elementOf`) · class តាម state (`uiState.dataPanelCollapsed` …) ដែល
 * **ចុះ DOM ភ្លាម** (`commitNow()`) មុនការវាស់/រមូរ ដូចការប្តូរ class ផ្ទាល់។
 * `npm run logic:check` រាយរាល់ function ដែលខុសពីដើម ជាមួយហេតុផល។
 */

export type PanelKey = 'data' | 'entry';

/** `.page-side.collapsed` របស់ផ្ទាំងមួយ */
export function panelIsCollapsed(panel: PanelKey | null): boolean {
    if (panel === 'data') return uiState.dataPanelCollapsed;
    if (panel === 'entry') return uiState.entryPanelCollapsed;
    return false;
}

export function setPanelCollapsed(panel: PanelKey, collapsed: boolean): void {
    if (panel === 'data') uiState.dataPanelCollapsed = collapsed;
    else uiState.entryPanelCollapsed = collapsed;
}

/** `.page-side.search-focus` (មានតែផ្ទាំងទិន្នន័យ) */
export function panelHasSearchFocus(panel: PanelKey | null): boolean {
    return panel === 'data' && uiState.dataPanelSearchFocus;
}

export function activePanelSections() {
    if (uiState.currentAppPage === 'entry') {
        return {
            panel: 'entry' as PanelKey,
            side: elementOf('entrySideSection'),
            main: elementOf('entryMainSection'),
            scroller: entryScrollerInView()
        };
    }
    if (uiState.currentAppPage === 'data') {
        return {
            panel: 'data' as PanelKey,
            side: elementOf('dataSideSection'),
            main: elementOf('dataMainSection'),
            scroller: elementOf('tableResponsive')
        };
    }
    return { panel: null, side: null, main: null, scroller: null };
}

/** `#lockerPanel` បង្ហាញ ⇔ `viewState.entryModeShown === 'locker'` (JSX គូរ `hidden` ពីវា) */
export function entryScrollerInView() {
    const lockerVisible = viewState.entryModeShown === 'locker';
    return elementOf(lockerVisible ? 'lockerTableResponsive' : 'entryTableResponsive');
}

export function usesIOSPanelHandoff() {
    return window.navigator && window.navigator.standalone === true &&
        window.CSS && typeof window.CSS.supports === 'function' &&
        window.CSS.supports('-webkit-touch-callout', 'none');
}

export function syncHistoryExpandedLock() {
    const pages = elementOf('appPages');
    if (!pages) return;
    const sections = activePanelSections();
    const expanded = !!sections.side && panelIsCollapsed(sections.panel);
    const wasExpanded = uiState.historyExpanded;
    const iosUnlock = wasExpanded && !expanded && usesIOSPanelHandoff();
    if (expanded || iosUnlock) setElementScrollTop(pages, 0);
    uiState.historyExpanded = expanded;
    commitNow();
    if (expanded || iosUnlock) {
        setElementScrollTop(pages, 0);
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                if (uiState.historyExpanded !== expanded) return;
                setElementScrollTop(pages, 0);
                if (iosUnlock) {
                    requestAnimationFrame(() => {
                        if (!uiState.historyExpanded) setElementScrollTop(pages, 0);
                    });
                }
            });
        }
    }
}
