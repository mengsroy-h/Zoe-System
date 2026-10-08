import { commitNow } from '../app/flush';
import { elementSize, fieldValue, rectOfElement, setFieldValue } from '../app/refs';
import { dataState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { getZoneDateKey } from '../core/timezone';
import { sanitizeInput } from '../domain/barcode';
import { requestPinBeforeResetPickup } from '../domain/collected';
import { openViewListModal } from '../features/barcode-ops';
import { requestPinBeforeClearHistory } from '../features/clear-history';
import { deleteSingleItem, openEditModal } from '../features/entry-ops';
import { openExchangeRateModal } from '../features/exchange-rate';
import { getCurrentFilterLabel, openExportDataModal } from '../features/export';
import { applyCurrentFilter, openMonthlyReportModal } from '../features/monthly-report';
import { requestPinBeforeConfig } from '../features/pin';
import { openManualAdjustModal } from '../features/stats-modals';
import { openRecentlyDeletedModal } from '../features/trash';

const moreMenuOpening: { anchor: unknown; at: number } = { anchor: null, at: 0 };

export function closeGlobalMoreMenu() {
    moreMenuOpening.anchor = null;
    uiState.moreMenuOpen = false;
}

export function moreMenuAnchor(): unknown {
    return moreMenuOpening.anchor;
}

export function moreMenuOpenedAt(): number {
    return moreMenuOpening.at;
}

export function moreMenuExport() { openExportDataModal(); closeGlobalMoreMenu(); }

export function moreMenuMonthlyReport() { openMonthlyReportModal(); closeGlobalMoreMenu(); }

export function moreMenuManualAdjust() { requestPinBeforeConfig(openManualAdjustModal, 'manualAdjust'); closeGlobalMoreMenu(); }

export function moreMenuExchangeRate() { openExchangeRateModal(); closeGlobalMoreMenu(); }

export function moreMenuRecentlyDeleted() { openRecentlyDeletedModal(); closeGlobalMoreMenu(); }

export function moreMenuResetPickup() { requestPinBeforeResetPickup(); closeGlobalMoreMenu(); }

export function moreMenuClearHistory() { requestPinBeforeClearHistory(); closeGlobalMoreMenu(); }

export function moreMenuViewList(id?) { openViewListModal(id); closeGlobalMoreMenu(); }

export function moreMenuEditPhone(id?) { openEditModal(id); closeGlobalMoreMenu(); }

export function moreMenuDelete(id?) { deleteSingleItem(id); closeGlobalMoreMenu(); }

export function showGlobalMoreMenu(btn, event, items) {
    if (event) event.stopPropagation();
    const rect = rectOfElement(btn);
    if (!rect) return;
    moreMenuOpening.anchor = btn;
    moreMenuOpening.at = performance.now();
    uiState.moreMenuItems = items;
    uiState.moreMenuOpen = true;
    uiState.touch();
    positionMenuSafely('globalMoreMenu', rect);
}

export function positionMenuSafely(menuName, rect) {
    uiState.moreMenuPosition = { top: 0, left: 0 };
    const size = elementSize(menuName);
    const menuHeight = size.height;
    const menuWidth = size.width;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    let topPos = rect.bottom + 4;
    if (topPos + menuHeight > windowHeight - 10) {
        topPos = rect.top - menuHeight - 4;
    }
    if (topPos < 10) topPos = 10;

    let leftPos = rect.right - menuWidth;
    if (leftPos < 10) leftPos = 10;
    if (leftPos + menuWidth > windowWidth - 10) {
        leftPos = windowWidth - menuWidth - 10;
    }
    if (leftPos < 10) leftPos = 10;

    uiState.moreMenuPosition = { top: topPos, left: leftPos };
    commitNow();
}

export function toggleHeaderMoreDropdown(btn?, event?) {
    showGlobalMoreMenu(btn, event, [
        { label: '📤 Export Data', action: 'moreMenuExport' },
        { label: '📈 របាយការណ៍អាជីវកម្មប្រចាំខែ', action: 'moreMenuMonthlyReport' },
        { label: '✏️ កែទឹកប្រាក់/កញ្ចប់', action: 'moreMenuManualAdjust' },
        { label: '💱 អត្រាប្រាក់ (' + dataState.exchangeRateRiel + '៛)', action: 'moreMenuExchangeRate' },
        { label: '🗑️ ធុងសំរាម', action: 'moreMenuRecentlyDeleted' },
        { label: '♻️ Reset ចំនួនយករួច (' + getCurrentFilterLabel() + ')', action: 'moreMenuResetPickup' },
        { label: '❌ លុបទាំងអស់', action: 'moreMenuClearHistory', cls: 'delete-opt' }
    ]);
}

export function toggleMoreDropdown(btn?, event?, id?) {
    const item = dataState.scanHistory.find(i => i.id === id);
    const items = [];
    if (item && item.barcodes && item.barcodes.length > 0) {
        items.push({ label: '💵 កែតម្លៃកញ្ចប់', action: 'moreMenuViewList', args: [id] });
    }
    items.push({ label: '✏️ កែលេខទូរស័ព្ទ', action: 'moreMenuEditPhone', args: [id] });
    items.push({ label: '🗑️ លុប', action: 'moreMenuDelete', args: [id], cls: 'delete-opt' });
    showGlobalMoreMenu(btn, event, items);
}

export function filterDataByDate(mode?) {
    uiState.currentFilterMode = mode;
    uiState.customFilterDate = '';
    setFieldValue('customDateInput', '');

    applyCurrentFilter();
}

export function filterDataByCustomDate() {
    const val = fieldValue('customDateInput');
    if (!val) return;

    uiState.currentFilterMode = 'custom';
    uiState.customFilterDate = val;

    applyCurrentFilter();
}

export function getFilteredDataByDate() {
    const now = getServerNow();
    const todayStr = getZoneDateKey(now, 0);
    const yesterdayStr = getZoneDateKey(now, -1);
    const dayBeforeStr = getZoneDateKey(now, -2);

    if (uiState.currentFilterMode === 'today') {
        return dataState.scanHistory.filter(item => item.scanDate === todayStr);
    } else if (uiState.currentFilterMode === 'yesterday') {
        return dataState.scanHistory.filter(item => item.scanDate === yesterdayStr);
    } else if (uiState.currentFilterMode === 'dayBefore') {
        return dataState.scanHistory.filter(item => item.scanDate === dayBeforeStr);
    } else if (uiState.currentFilterMode === 'custom') {
        return dataState.scanHistory.filter(item => item.scanDate === uiState.customFilterDate);
    } else {
        return dataState.scanHistory;
    }
}
