import { uiState } from '../../core/state';
import { scrollWindowToTop } from '../../platform/document-io';
import type { LifecycleScope } from '../lifecycle/scope';
import { usesIOSPanelHandoff } from './panels';

export function restoreIOSDocumentScroll(): void {
    if (!uiState.dataPanelSearchFocus || !usesIOSPanelHandoff()) return;
    if ((window.scrollY || 0) === 0) return;
    scrollWindowToTop();
}

export function listenIOSDocumentScroll(scope: LifecycleScope): void {
    scope.listen(window, 'scroll', restoreIOSDocumentScroll, { passive: true });
    if (window.visualViewport) scope.listen(window.visualViewport, 'scroll', restoreIOSDocumentScroll);
}
