import { dataState, firebaseState, uiState } from '../core/state';
import { viewState, type ScanRemoveTextId } from '../core/view-state';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { ENTRY_SCAN_MODE_KEY } from '../core/storage-keys';
import { DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY } from '../core/text';
import { safeFocusScanner } from '../core/timezone';
import { ensureBarcodeArrayForItem } from '../domain/barcode';
import { collectItemBarcodes } from '../domain/registry';
import { removeSingleBarcode } from './barcode-ops';
import { buildLockerBarcodeIndex, isValidLockerName, lockerCodeKey, openLockerPicker, updateActiveLockerLabel } from './locker';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { playBeep } from '../services/history-write';
import { LOCK_STALL_RELEASE_MS, settleLockWithin } from '../services/network';
import { renderEntryList, renderLockerList } from '../ui/entry-list';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export function findScannedRemovalTarget(code) {
    const key = lockerCodeKey(code);
    if (!key) return null;
    for (const item of dataState.scanHistory) {
        if (!item || !item.id) continue;
        const barcode = ensureBarcodeArrayForItem(item).find((entry) => entry && lockerCodeKey(entry.code) === key);
        if (barcode) return { itemId: item.id, barcodeCode: barcode.code, item, barcode };
    }
    return null;
}

export function findScannedRemovalTrash(code) {
    const key = lockerCodeKey(code);
    if (!key) return null;
    return dataState.deletedItems.find((item) => collectItemBarcodes(item).some((entry) => lockerCodeKey(entry) === key)) || null;
}

export function setScannedRemovalText(id: ScanRemoveTextId, value) {
    viewState.scanRemoveTexts = Object.assign({}, viewState.scanRemoveTexts, {
        [id]: String(value === null || value === undefined || value === '' ? '—' : value)
    });
}

export function refreshRemoveScanBanner() {
    viewState.removeScanDetail = uiState.scanRemoveInFlight
        ? `កំពុងដក Barcode ${uiState.scanRemoveInFlight.barcodeCode}… សូមកុំស្កេនស្ទួន។`
        : 'ស្កេន Barcode ហើយផ្ទៀងផ្ទាត់ព័ត៌មានមុនដក។';
}

export function clearScannedRemovalInFlight(itemId, barcodeCode, operationToken) {
    if (!uiState.scanRemoveInFlight) return;
    if (operationToken && uiState.scanRemoveInFlight.operationToken !== operationToken) return;
    if (itemId && uiState.scanRemoveInFlight.itemId !== itemId) return;
    if (barcodeCode && uiState.scanRemoveInFlight.barcodeCode !== barcodeCode) return;
    uiState.scanRemoveInFlight = null;
    refreshRemoveScanBanner();
    safeFocusScanner();
}

export function showScannedRemovalPreview(target) {
    const barcode = target.barcode || {};
    const item = target.item || {};
    uiState.pendingScannedRemoval = { itemId: target.itemId, barcodeCode: target.barcodeCode };
    const cod = parseFloat(barcode.cod) || 0;
    const dod = parseFloat(barcode.dod) || 0;
    setScannedRemovalText('scanRemoveBarcodeText', target.barcodeCode);
    setScannedRemovalText('scanRemovePhoneText', item.phone || 'គ្មានលេខ');
    setScannedRemovalText('scanRemoveLockerText', barcode.locker || item.locker || 'N/A');
    setScannedRemovalText('scanRemoveStateText', barcode.isClosed ? 'យករួច / បិទ' : 'មិនទាន់យក / បើក');
    setScannedRemovalText('scanRemoveCodText', `$${cod.toFixed(2)}`);
    setScannedRemovalText('scanRemoveDodText', `$${dod.toFixed(2)}`);
    playBeep();
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    openModalHelper('scanRemoveModal');
}

export function handleRemoveScan(code) {
    const key = lockerCodeKey(code);
    if (!key) return;
    if (uiState.scanRemoveInFlight) {
        const same = lockerCodeKey(uiState.scanRemoveInFlight.barcodeCode) === key;
        showToast(same
            ? `⏳ ការដក (${uiState.scanRemoveInFlight.barcodeCode}) កំពុងដំណើរការ — សូមកុំស្កេនស្ទួន។`
            : `⏳ សូមរង់ចាំការដក (${uiState.scanRemoveInFlight.barcodeCode}) ឲ្យចប់សិន។`);
        if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
        safeFocusScanner();
        return;
    }
    if (!firebaseState.db || !firebaseState.fb || !firebaseState.isDatabaseInitialized) {
        showToast('⚠️ ទិន្នន័យមិនទាន់ត្រៀមរួចទេ — សូមរង់ចាំ Firebase ភ្ជាប់ ហើយស្កេនម្តងទៀត។');
        safeFocusScanner();
        return;
    }
    const target = findScannedRemovalTarget(key);
    if (target) {
        showScannedRemovalPreview(target);
        return;
    }
    if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) {
        showToast(`⚠️ ទិន្នន័យមិនទាន់ Sync គ្រប់ — មិនអាចបញ្ជាក់ថា Barcode (${key}) នៅទីណាបានទេ។ សូមរង់ចាំ ហើយស្កេនម្តងទៀត។`);
        safeFocusScanner();
        return;
    }
    const trashed = findScannedRemovalTrash(key);
    if (trashed) {
        showToast(`ℹ️ Barcode (${key}) នៅក្នុងធុងសំរាមរួចហើយ — គ្មានការដក ឬកាត់ប្រាក់ស្ទួនទេ។`);
        safeFocusScanner();
        return;
    }
    showToast(`❌ រកមិនឃើញ Barcode (${key}) ក្នុងកញ្ចប់ដែលកំពុងគ្រប់គ្រងទេ — គ្មានអ្វីត្រូវបានដក។`);
    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
    safeFocusScanner();
}

export function cancelScannedRemoval() {
    uiState.pendingScannedRemoval = null;
    closeModal('scanRemoveModal');
}

export async function confirmScannedRemoval() {
    if (!uiState.pendingScannedRemoval || uiState.scanRemoveInFlight) return false;
    const job = uiState.pendingScannedRemoval;
    uiState.pendingScannedRemoval = null;
    const operationToken = {};
    uiState.scanRemoveInFlight = { itemId: job.itemId, barcodeCode: job.barcodeCode, operationToken };
    refreshRemoveScanBanner();
    closeModal('scanRemoveModal');
    let outcome;
    try {
        outcome = await settleLockWithin(
            removeSingleBarcode(job.itemId, job.barcodeCode, 'scan-confirmed'),
            LOCK_STALL_RELEASE_MS, 'confirmScannedRemoval');
        return outcome !== 'failed' && outcome !== 'missing';
    } finally {
        if (outcome !== 'pending') clearScannedRemovalInFlight(job.itemId, job.barcodeCode, operationToken);
    }
}

export function setEntryScanMode(mode?) {
    uiState.entryScanMode = mode === 'locker' ? 'locker' : (mode === 'remove' ? 'remove' : 'parcel');
    safeStoreSet(appLocalStore, ENTRY_SCAN_MODE_KEY, uiState.entryScanMode === 'remove' ? 'parcel' : uiState.entryScanMode);
    viewState.entryModeShown = uiState.entryScanMode;
    refreshRemoveScanBanner();
    if (uiState.entryScanMode !== 'locker') renderEntryList();
    if (uiState.entryScanMode === 'locker') {
        buildLockerBarcodeIndex();
        renderLockerList();
        updateActiveLockerLabel();
        if (!isValidLockerName(uiState.activeLocker)) openLockerPicker();
    }
    safeFocusScanner();
}
