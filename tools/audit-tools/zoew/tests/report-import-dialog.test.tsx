import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyReportModal } from '../../../../ZoeW/src/app/components/modals/MonthlyReportModal';
import { SheetImportModal } from '../../../../ZoeW/src/app/components/modals/SheetImportModal';
import { securityState, uiState } from '../../../../ZoeW/src/core/state';
import { closeModal, openModalHelper } from '../../../../ZoeW/src/ui/modal';
import { listenModalFocusTrap } from '../../../../ZoeW/src/app/behaviors/modal-focus-trap';
import { createLifecycleScope } from '../../../../ZoeW/src/app/lifecycle/scope';
import { topmostModal } from '../../../../ZoeW/src/app/lifecycle/layers';
import { byId, mount, step, unmount } from './native/react-harness';

let scope: ReturnType<typeof createLifecycleScope>;

beforeEach(() => {
    uiState.modalStack = [];
    uiState.modalDisplay = {};
    uiState.isModalOpen = false;
    securityState.appIsLocked = false;
    mount(<><MonthlyReportModal /><SheetImportModal /></>);
    for (const el of document.querySelectorAll<HTMLElement>('input,select,textarea,button')) {
        el.getClientRects = () => [{ width: 10, height: 10 }] as unknown as DOMRectList;
    }
    scope = createLifecycleScope();
    listenModalFocusTrap(scope);
});

afterEach(() => {
    scope.dispose();
    unmount();
    uiState.modalStack = [];
    uiState.modalDisplay = {};
    uiState.isModalOpen = false;
});

describe('ផ្ទាំងរបាយការណ៍ និងនាំចូល ៖ ឈ្មោះសម្រាប់អ្នកអានអេក្រង់', () => {
    for (const id of ['monthlyReportModal', 'sheetImportModal']) {
        it(id + ' មានតួនាទី dialog និងឈ្មោះចំណងជើងនៅពេលបើកឡើងវិញ', () => {
            for (let attempt = 0; attempt < 2; attempt++) {
                step(() => openModalHelper(id));
                const dialog = byId(id);
                expect(dialog.getAttribute('role')).toBe('dialog');
                expect(dialog.getAttribute('aria-modal')).toBe('true');
                const titleId = dialog.getAttribute('aria-labelledby');
                expect(titleId).toBeTruthy();
                const title = document.getElementById(titleId!);
                expect(title).toBe(dialog.querySelector('h3'));
                expect(title!.textContent!.trim().length).toBeGreaterThan(5);
                expect(document.querySelectorAll('[id="' + titleId + '"]').length).toBe(1);
                step(() => closeModal(id));
                expect(dialog.style.display).toBe('none');
            }
        });
    }

    for (const order of [['monthlyReportModal', 'sheetImportModal'], ['sheetImportModal', 'monthlyReportModal']]) {
        it(order.join(' → ') + ' ៖ Tab ស្ថិតក្នុងផ្ទាំងខាងលើ និងមិនរុញ scroll', () => {
            step(() => openModalHelper(order[0]));
            step(() => openModalHelper(order[1]));
            expect(topmostModal()).toBe(order[1]);
            const lower = byId(order[0]);
            const upper = byId(order[1]);
            lower.scrollTop = 81;
            upper.scrollTop = 37;
            const first = upper.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),button:not([disabled])')!;
            const buttons = upper.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
            const last = buttons[buttons.length - 1];
            const focus = vi.spyOn(first, 'focus');
            step(() => last.focus());
            const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
            step(() => last.dispatchEvent(tab));
            expect(tab.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(first);
            expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
            const backTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
            step(() => first.dispatchEvent(backTab));
            expect(backTab.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(last);
            expect(lower.scrollTop).toBe(81);
            expect(upper.scrollTop).toBe(37);
            step(() => closeModal(order[1]));
            expect(topmostModal()).toBe(order[0]);
            const outside = document.createElement('button');
            document.body.append(outside);
            step(() => outside.focus());
            expect(lower.contains(document.activeElement)).toBe(true);
            outside.remove();
        });
    }
});
