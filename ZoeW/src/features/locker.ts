import { viewState } from '../core/view-state';
import { fieldValue, setFieldValue } from '../app/refs';
import { dataState, uiState } from '../core/state';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { ACTIVE_LOCKER_KEY, ENTRY_SCAN_MODE_KEY, LOCKER_COUNT_KEY, LOCKER_PREFIX_KEY } from '../core/storage-keys';
import { safeFocusScanner } from '../core/timezone';
import { playBeep } from '../services/history-write';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export const LOCKER_COUNT_MIN = 1;

export const LOCKER_COUNT_MAX = 200;

export const LOCKER_COUNT_DEFAULT = 24;

export const ENTRY_LIST_MAX_ROWS = 200;

export const LOCKER_LIST_MAX_ROWS = 200;

export const DELETED_LIST_MAX_ROWS = 200;

export const TRASH_CODES_PREVIEW = 2;

export const expandedTrashGroups = new Set();

export function lockerCodeKey(code) {
    return String(code === null || code === undefined ? '' : code).trim().toUpperCase();
}

export function getLockerPrefix() {
    return safeStoreGet(appLocalStore, LOCKER_PREFIX_KEY) || 'ទូ';
}

export function clampLockerCount(raw) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || !n) return LOCKER_COUNT_DEFAULT;
    return Math.min(LOCKER_COUNT_MAX, Math.max(LOCKER_COUNT_MIN, n));
}

export function getLockerCount() {
    return clampLockerCount(safeStoreGet(appLocalStore, LOCKER_COUNT_KEY));
}

export function isValidLockerName(value) {
    const locker = String(value || '').trim();
    return locker.length > 0 && locker.length <= 64 && locker.toUpperCase() !== 'N/A';
}

export function buildLockerBarcodeIndex() {
    const idx = {};
    dataState.scanHistory.forEach((item) => {
        if (!item || !item.id) return;
        if (Array.isArray(item.barcodes) && item.barcodes.length) {
            item.barcodes.forEach((b, i) => {
                if (!b || typeof b !== 'object') return;
                const key = lockerCodeKey(b.code);
                if (key) idx[key] = { itemId: item.id, barcodeIdx: i, item };
            });
            return;
        }
        const legacyKey = lockerCodeKey(item.barcode);
        if (legacyKey) idx[legacyKey] = { itemId: item.id, barcodeIdx: null, item };
    });
    uiState.lockerBarcodeIndex = idx;
}

export function getEntryCurrentLocker(entry) {
    if (!entry) return null;
    const { barcodeIdx, item } = entry;
    if (barcodeIdx !== null) {
        const barcode = Array.isArray(item.barcodes) ? item.barcodes[barcodeIdx] : null;
        return (barcode && barcode.locker) || null;
    }
    return item.locker || null;
}

export function isEntryBarcodeClosed(entry) {
    if (!entry) return false;
    const { barcodeIdx, item } = entry;
    if (barcodeIdx !== null) {
        const barcode = Array.isArray(item.barcodes) ? item.barcodes[barcodeIdx] : null;
        return !!(barcode && barcode.isClosed);
    }
    return !!item.isClosed;
}

export function findLockerOccupant(locker, excludeCode, excludeItemId) {
    for (const code in uiState.lockerBarcodeIndex) {
        if (code === excludeCode) continue;
        const entry = uiState.lockerBarcodeIndex[code];
        if (excludeItemId && entry.itemId === excludeItemId) continue;
        if (isEntryBarcodeClosed(entry)) continue;
        if (getEntryCurrentLocker(entry) === locker) return { code, entry };
    }
    return null;
}

export function lockerSuccessFeedback() {
    playBeep();
    if (navigator.vibrate) navigator.vibrate(150);
}

export function lockerErrorFeedback() {
    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
}

export function openLockerSettingsModal() {
    setFieldValue('lockerPrefixInput', String(getLockerPrefix()));
    setFieldValue('lockerCountInput', String(getLockerCount()));
    openModalHelper('lockerSettingsModal');
}

export function saveLockerSettings() {
    const prefix = fieldValue('lockerPrefixInput').trim() || 'ទូ';
    const count = clampLockerCount(fieldValue('lockerCountInput'));
    const previousPrefix = getLockerPrefix();
    const previousCount = getLockerCount();
    const prefixSaved = safeStoreSet(appLocalStore, LOCKER_PREFIX_KEY, prefix);
    const countSaved = safeStoreSet(appLocalStore, LOCKER_COUNT_KEY, String(count));
    if (!prefixSaved || !countSaved) {
        if (prefixSaved) safeStoreSet(appLocalStore, LOCKER_PREFIX_KEY, previousPrefix);
        if (countSaved) safeStoreSet(appLocalStore, LOCKER_COUNT_KEY, String(previousCount));
        showToast('❌ រក្សាទុកការកំណត់ទូមិនបានពេញលេញទេ — សូមបិទ/បើក App ហើយពិនិត្យការកំណត់ឡើងវិញ។');
        return false;
    }
    closeModal('lockerSettingsModal');
    renderLockerGrid();
    showToast('✅ បានរក្សាទុកការកំណត់ទូ');
    return true;
}

export function renderLockerGrid() {
    const prefix = getLockerPrefix();
    const count = Math.min(LOCKER_COUNT_MAX, getLockerCount());
    const cells = [];
    for (let i = 1; i <= count; i++) cells.push(prefix + i);
    uiState.lockerGridView = { cells: cells, active: uiState.activeLocker };
    uiState.touch();
}

export function openLockerPicker() {
    if (!isValidLockerName(uiState.activeLocker)) {
        uiState.activeLocker = '';
        safeStoreRemove(appLocalStore, ACTIVE_LOCKER_KEY);
    }
    renderLockerGrid();
    openModalHelper('lockerPickerModal');
}

export function chooseLocker(val) {
    const locker = String(val || '').trim();
    if (!isValidLockerName(locker)) {
        showToast('⚠️ ទីតាំង Locker មិនត្រឹមត្រូវទេ។ សូមជ្រើសរើសទីតាំងពិតប្រាកដ។');
        return;
    }
    uiState.activeLocker = locker;
    safeStoreSet(appLocalStore, ACTIVE_LOCKER_KEY, locker);
    closeModal('lockerPickerModal');
    updateActiveLockerLabel();
    showToast(`📍 ទីតាំងបច្ចុប្បន្ន៖ ${locker}`);
    safeFocusScanner();
}

export function selectCustomLocker() {
    const val = fieldValue('customLockerInput').trim();
    if (!isValidLockerName(val)) {
        showToast('⚠️ សូមបញ្ចូលទីតាំងពិតប្រាកដ (មិនអាចជា N/A និងមិនលើស 64 តួអក្សរ)!');
        return;
    }
    setFieldValue('customLockerInput', '');
    chooseLocker(val);
}

export function updateActiveLockerLabel() {
    viewState.activeLockerLabel = uiState.activeLocker || '-';
}
