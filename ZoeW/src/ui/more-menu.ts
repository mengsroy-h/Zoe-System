import { renderNow } from '../app/flush';
import { byId } from '../core/dom';
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

export function dismissGlobalMoreMenuOutside(e) {
    if (e.target && e.target.closest) {
        if (e.target.closest('#globalMoreMenu')) return;
        if (e.type === 'click' && e.target.closest('.more-btn, .header-more-btn')) return;
    }
    closeGlobalMoreMenu();
}

export function closeGlobalMoreMenu() {
    const menu = byId('globalMoreMenu');
    if (menu) menu.classList.remove('show');
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
    const rect = btn.getBoundingClientRect();
    const menu = byId('globalMoreMenu');
    const container = byId('menuContentContainer');
    if(!menu || !container) return;
    uiState.moreMenuItems = items;
    uiState.touch();
    // ⛔ `positionMenuSafely()` **វាស់** ទទឹង/កម្ពស់របស់ម៉ឺនុយ ដើម្បីកុំ
    //    ឲ្យវាហៀរក្រៅអេក្រង់ ➜ ការវាស់មុនធាតុចុះ ផ្តល់ទំហំ **0** ➜ គ្មាន
    //    ការទាញចូលវិញ ➜ ម៉ឺនុយហៀរ។ វាស់បាន (parity:live) ៖ left 245px
    //    ធៀបនឹង 137px លើអេក្រង់ទូរស័ព្ទ ➜ ធាតុខាងក្នុងចុចមិនដល់។
    renderNow(uiState);
    menu.classList.add('show');
    positionMenuSafely(menu, rect);
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
    // ⛔ «កែតម្លៃកញ្ចប់» លេចតែពេលមាន barcode ពិត (ដូចដើម)
    if (item && item.barcodes && item.barcodes.length > 0) {
        items.push({ label: '💵 កែតម្លៃកញ្ចប់', action: 'moreMenuViewList', args: [id] });
    }
    items.push({ label: '✏️ កែលេខទូរស័ព្ទ', action: 'moreMenuEditPhone', args: [id] });
    items.push({ label: '🗑️ លុប', action: 'moreMenuDelete', args: [id], cls: 'delete-opt' });
    showGlobalMoreMenu(btn, event, items);
}

export function positionMenuSafely(menu, rect) {
    menu.style.top = '0px';
    menu.style.left = '0px';
    const menuHeight = menu.offsetHeight;
    const menuWidth = menu.offsetWidth;
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

    menu.style.top = topPos + 'px';
    menu.style.left = leftPos + 'px';
}

export function filterDataByDate(mode?) {
    uiState.currentFilterMode = mode;
    uiState.customFilterDate = '';
    const customDateInput = byId('customDateInput');
    if(customDateInput) customDateInput.value = '';

    document.querySelectorAll('.date-filter-btn').forEach(btn => btn.classList.remove('active'));
    if (mode === 'today') {
        const el = byId('btnFilterToday');
        if(el) el.classList.add('active');
    }
    if (mode === 'yesterday') {
        const el = byId('btnFilterYesterday');
        if(el) el.classList.add('active');
    }
    if (mode === 'dayBefore') {
        const el = byId('btnFilterDayBefore');
        if(el) el.classList.add('active');
    }
    if (mode === 'all') {
        const el = byId('btnFilterAll');
        if(el) el.classList.add('active');
    }

    applyCurrentFilter();
}

export function filterDataByCustomDate() {
    const customDateInput = byId('customDateInput');
    const val = customDateInput ? customDateInput.value : '';
    if (!val) return;

    uiState.currentFilterMode = 'custom';
    uiState.customFilterDate = val;
    document.querySelectorAll('.date-filter-btn').forEach(btn => btn.classList.remove('active'));

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
