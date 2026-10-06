import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, firebaseState, scanState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { normalizeStoredPhone } from '../core/text';
import { getFormattedClockTime, getFormattedDate, safeFocusScanner } from '../core/timezone';
import { applyBarcodeCloseState, generateUniqueId, normalizeBarcodesOf } from '../domain/barcode';
import { addRevenueToDailyAndMonthlyRecord, correctRevenueLedgerToActual, revertRevenueLedgerDelta } from '../domain/ledger';
import { claimBarcodeInRegistry, isBarcodeAlreadyUsed, releaseBarcodesInRegistry, releaseLateBarcodeClaim } from '../domain/registry';
import { armLookupFocus, attemptAutoLookup, clearLookupStatus, fillEmptyLookupFields, lookupAnswersHeldWhileSaving, takeHeldLookupAnswer } from './auto-lookup';
import { handleLockerScan } from './locker-assign';
import { warmZtoLookupProxyNow } from './lookup-api';
import { getLookupApiConfig } from './lookup-config';
import { handleRemoveScan } from './scan-remove';
import { updateRecentPhonesList } from '../services/db-listeners';
import { mergeBarcodeIntoHistoryItem, playBeep, saveSingleHistoryItemToFirebase } from '../services/history-write';
import { withTimeout } from '../services/network';
import { probeDatabaseLiveness } from '../services/connection';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { recalcItemMoneyFromBarcodes, rejectScanAndRefocus } from '../ui/modal-stack';
import { showToast } from '../ui/toast';

export function triggerScanAction(barcode) {
    if (uiState.isModalOpen) return;

    let cleanBarcode = String(barcode || '').trim();
    if (!cleanBarcode) return;

    if (uiState.entryScanMode === 'locker') {
        handleLockerScan(cleanBarcode);
        return;
    }

    if (uiState.entryScanMode === 'remove') {
        handleRemoveScan(cleanBarcode);
        return;
    }

    if (isBarcodeAlreadyUsed(cleanBarcode)) {
        showToast(`⚠️ លេខ Barcode នេះ (${cleanBarcode}) មានក្នុងប្រព័ន្ធរួចហើយ!`);
        if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
        safeFocusScanner();
        return;
    }

    playBeep();
    if (navigator.vibrate) navigator.vibrate(150);

    scanState.pendingBarcode = cleanBarcode;
    viewState.modalBarcodeText = cleanBarcode;

    setFieldValue('modalPhoneInput', "");

    setFieldValue('modalLockerInput', uiState.lastEnteredLocker);

    setFieldValue('modalCodInput', "");
    setFieldValue('modalDodInput', "");

    clearLookupStatus();
    openModalHelper('phoneModal');
    const lookupPromise = attemptAutoLookup(cleanBarcode);

    const lookupCfg = getLookupApiConfig();
    if (!lookupCfg || !lookupCfg.enabled) {
        setTimeout(() => {
            focusField('modalPhoneInput');
        }, 150);
    } else {
        armLookupFocus('modalPhoneInput', cleanBarcode, lookupPromise);
    }
}

export function dropOptimisticBarcode(code) {
    if (!code) return;
    for (let i = dataState.scanHistory.length - 1; i >= 0; i--) {
        const item = dataState.scanHistory[i];
        if (!item || !Array.isArray(item.barcodes)) continue;
        const at = item.barcodes.findIndex((b) => b && b.code === code);
        if (at === -1) continue;
        item.barcodes.splice(at, 1);
        if (!item.barcodes.length) { dataState.scanHistory.splice(i, 1); return; }
        item.count = item.barcodes.length;
        recalcItemMoneyFromBarcodes(item);
        return;
    }
}

function heldLookupMoneyOf(value) {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return null;
    return n > 0 ? Math.round(n * 100) / 100 : 0;
}

export function warnHeldLookupMoney(held, barcode, cod, dod) {
    if (!held) return false;
    const heldCod = heldLookupMoneyOf(held.cod);
    const heldDod = heldLookupMoneyOf(held.dod);
    if (!(heldCod > 0) && !(heldDod > 0)) return false;
    if ((heldCod === null || heldCod === cod) && (heldDod === null || heldDod === dod)) return false;
    const shown = (v) => (v === null ? '—' : String(v));
    showToast(`⚠️ ZTO បង្ហាញ COD ${shown(heldCod)} · DOD ${shown(heldDod)} — កញ្ចប់ (${barcode}) បានរក្សាទុកតាមតម្លៃដែលបានបញ្ចូល (COD ${cod} · DOD ${dod})។ កែទឹកប្រាក់បានតាម «កែតម្លៃកញ្ចប់»។`);
    return true;
}

export async function confirmPhone(isSkip = false) {
    if (viewState.phoneModalBusy) return;
    const operationDb = firebaseState.db;
    const operationAuth = firebaseState.authGeneration;
    const current = () => operationDb === firebaseState.db && operationAuth === firebaseState.authGeneration;
    let phone = isSkip ? "គ្មានលេខ" : normalizeStoredPhone(fieldValue('modalPhoneInput'));
    let rawLocker = fieldValue('modalLockerInput').trim();
    let locker = rawLocker;
    let cod = Math.round((parseFloat(fieldValue('modalCodInput')) || 0) * 100) / 100;
    let dod = Math.round((parseFloat(fieldValue('modalDodInput')) || 0) * 100) / 100;

    if (!Number.isFinite(cod) || cod < 0) cod = 0;
    if (!Number.isFinite(dod) || dod < 0) dod = 0;

    if (isSkip || !phone) {
        phone = "គ្មានលេខ";
    }
    if (!locker) {
        locker = "N/A";
    } else {
        uiState.lastEnteredLocker = rawLocker;
        safeStoreSet(appLocalStore, 'last_entered_locker', rawLocker);
    }

    const barcodeToSave = scanState.pendingBarcode;
    if (!barcodeToSave) {
        closeModal('phoneModal');
        showToast(`⚠️ សូមស្កេនម្ដងទៀត។`);
        return;
    }

    if (isBarcodeAlreadyUsed(barcodeToSave)) {
        rejectScanAndRefocus(`⚠️ លេខ Barcode នេះ (${barcodeToSave}) ត្រូវបានបញ្ចូលរួចហើយ! (ប្រហែលមកពី device ផ្សេង) សូមស្កេនម្ដងទៀត។`);
        return;
    }

    viewState.phoneModalBusy = true;
    lookupAnswersHeldWhileSaving.clear();

    try {
        const claimPromise = claimBarcodeInRegistry(barcodeToSave);
        let claim;
        try {
            claim = await withTimeout(claimPromise, 15000, 'Barcode claim timed out');
        } catch (claimError) {
            if (current()) releaseLateBarcodeClaim(claimPromise, barcodeToSave);
            probeDatabaseLiveness('claim');
            throw claimError;
        }
        if (!current()) return;
        if (claim === 'taken') {
            rejectScanAndRefocus(`⚠️ លេខ Barcode នេះ (${barcodeToSave}) ត្រូវបានបញ្ចូលរួចហើយ! (ប្រហែលមកពី device ផ្សេង) សូមស្កេនម្ដងទៀត។`);
            return;
        }

        if (claim !== 'claimed') {
            rejectScanAndRefocus(`⚠️ មិនអាចផ្ទៀងផ្ទាត់ថា (${barcodeToSave}) ស្ទួនឬអត់ទេ (ទិន្នន័យមិនទាន់មកដល់) — សូមរង់ចាំបន្តិច ហើយស្កេនម្ដងទៀត។`);
            return;
        }

        const rollbackFailedSave = () => {
            if (!current()) return;
            if (claim === 'claimed') releaseBarcodesInRegistry([barcodeToSave]);
            dropOptimisticBarcode(barcodeToSave);
            refreshCurrentHistoryView();
        };

        const savePromise = addOrUpdateEntry(barcodeToSave, phone, cod, dod, locker);
        try {
            const saveStatus = await withTimeout(savePromise, 15000, 'Save timed out');
            if (!current()) return;
            if (saveStatus !== true) {
                const heldAnswer = takeHeldLookupAnswer(barcodeToSave);
                closeModal('phoneModal');
                if (saveStatus === false) warnHeldLookupMoney(heldAnswer, barcodeToSave, cod, dod);
                return;
            }
        } catch (saveError) {
            if (!current()) return;
            if (saveError && saveError.message === 'Save timed out') {
                probeDatabaseLiveness('save');
                const heldAnswer = takeHeldLookupAnswer(barcodeToSave);
                savePromise.then((lateStatus) => {
                    if (!current()) return;
                    if (lateStatus === true) showToast(`✅ (${barcodeToSave}) រក្សាទុកបានជោគជ័យ!`);
                    if (lateStatus === true || lateStatus === false) warnHeldLookupMoney(heldAnswer, barcodeToSave, cod, dod);
                    refreshCurrentHistoryView();
                }, (lateErr) => {
                    if (!current()) return;
                    rollbackFailedSave();
                    showToast(`⚠️ រក្សាទុក (${barcodeToSave}) បរាជ័យ! សូមស្កេនម្ដងទៀត។`);
                    if (window.ZoeErrors) ZoeErrors.capture(lateErr, { zone: 'data', context: 'savePhoneAndSave late write' });
                });
                closeModal('phoneModal');
                showToast(`⏳ កំពុងរក្សាទុក (${barcodeToSave})… សូមកុំស្កេនម្ដងទៀត។`);
                safeFocusScanner();
                return;
            }
            rollbackFailedSave();
            throw saveError;
        }

        const heldAnswer = takeHeldLookupAnswer(barcodeToSave);
        closeModal('phoneModal');
        showToast("✅ រក្សាទុកបានជោគជ័យ!");
        warnHeldLookupMoney(heldAnswer, barcodeToSave, cod, dod);
    } catch (e) {
        if (!current()) return;
        showToast(`⚠️ រក្សាទុកបរាជ័យ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងស្កេន (${barcodeToSave}) ម្ដងទៀត។`);
    } finally {
        if (current()) {
            viewState.phoneModalBusy = false;
            warmZtoLookupProxyNow();
            const heldAnswer = takeHeldLookupAnswer(scanState.pendingBarcode);
            if (heldAnswer) fillEmptyLookupFields(heldAnswer.phone, heldAnswer.cod, heldAnswer.dod);
        }
    }
}

export function addOrUpdateEntry(barcode, phone, cod, dod, locker = "N/A", stampMs = 0, closedAtMs = 0) {
    let savePromise;
    const stamp = Number(stampMs);
    const currentTimeMillis = isFinite(stamp) && stamp > 0 ? stamp : getServerNow();
    const closeStamp = Number(closedAtMs);
    const bornClosed = isFinite(closeStamp) && closeStamp > 0;
    const dateString = getFormattedDate(currentTimeMillis as any);

    const timeFormatted = getFormattedClockTime(currentTimeMillis);
    const timeString = `${timeFormatted} (${dateString})`;

    let existingIndex = -1;
    if (phone !== "គ្មានលេខ" && !bornClosed) {
        existingIndex = dataState.scanHistory.findIndex(item => item.phone === phone && item.scanDate === dateString && !item.isClosed);
    }

    const scanRevenueApplied = addRevenueToDailyAndMonthlyRecord(dateString, cod, dod, 1);
    const scanIsCurrent = () => typeof scanRevenueApplied.isCurrent !== 'function' || scanRevenueApplied.isCurrent();
    const reconcileSavedScanRevenue = () => {
        if (!scanIsCurrent()) return Promise.resolve(false);
        return correctRevenueLedgerToActual(dateString, scanRevenueApplied, cod, dod, 1).then((status) => {
            if (!scanIsCurrent()) return false;
            if (status && status.ok) return true;
            const ledgerErr = new Error('Scanned parcel revenue reconciliation did not commit');
            if (window.ZoeErrors) ZoeErrors.capture(ledgerErr, { zone: 'money', context: 'addOrUpdateEntry ledger reconciliation', barcode });
            showToast(`⚠️ កញ្ចប់ (${barcode}) បានរក្សាទុក ប៉ុន្តែស្ថិតិប្រាក់មិនទាន់ Sync ពេញលេញទេ! សូមប្រាប់ Admin។`);
            return false;
        }, (ledgerErr) => {
            if (!scanIsCurrent()) return false;
            if (window.ZoeErrors) ZoeErrors.capture(ledgerErr, { zone: 'money', context: 'addOrUpdateEntry ledger reconciliation', barcode });
            showToast(`⚠️ កញ្ចប់ (${barcode}) បានរក្សាទុក ប៉ុន្តែស្ថិតិប្រាក់មិនទាន់ Sync ពេញលេញទេ! សូមប្រាប់ Admin។`);
            return false;
        });
    };
    const revertRevenueOnSaveFailure = (err) => {
        revertRevenueLedgerDelta(scanRevenueApplied);
        throw err;
    };

    if (existingIndex !== -1) {
        let item = dataState.scanHistory[existingIndex];
        const itemSnapshot = { ...item, barcodes: Array.isArray(item.barcodes) ? item.barcodes.map(b => ({ ...b })) : item.barcodes };
        let mergeAddedBarcode = false;

        const mergeScannedBarcodeInto = (target) => {
            mergeAddedBarcode = false;
            normalizeBarcodesOf(target);
            if (!target.barcodes || !Array.isArray(target.barcodes)) {
                let oldCod = parseFloat(target.cod !== undefined ? target.cod : target.price) || 0;
                let oldDod = parseFloat(target.dod) || 0;
                let oldCode = target.barcode || barcode;
                let oldTime = target.time || timeString;
                let oldIsClosed = target.isClosed || false;
                let oldLocker = target.locker || "N/A";
                target.barcodes = [{ code: oldCode, time: oldTime, cod: oldCod, dod: oldDod, locker: oldLocker, isClosed: oldIsClosed, isDeducted: false, isFromDeletion: false, createdAt: target.createdAt || currentTimeMillis }];
            }

            if (!target.barcodes.some(b => b && b.code === barcode)) {
                mergeAddedBarcode = true;
                target.barcodes.push({
                    code: barcode,
                    time: timeString,
                    cod: cod,
                    dod: dod,
                    locker: locker,
                    isClosed: false,
                    isDeducted: false,
                    isFromDeletion: false,
                    createdAt: currentTimeMillis
                });
            }

            target.count = target.barcodes.length;
            recalcItemMoneyFromBarcodes(target);
            target.barcode = barcode;
            target.time = timeString;
            target.scanDate = dateString;
            target.isClosed = false;
            delete target.closedAt;
            target.isCalled = false;
            return target;
        };

        mergeScannedBarcodeInto(item);

        dataState.scanHistory.splice(existingIndex, 1);
        dataState.scanHistory.push(item);
        savePromise = mergeBarcodeIntoHistoryItem(item.id, mergeScannedBarcodeInto, item)
            .then((committedItem) => {
                if (!scanIsCurrent()) return false;
                if (!mergeAddedBarcode) {
                    revertRevenueLedgerDelta(scanRevenueApplied);
                    showToast(`⚠️ លេខ Barcode នេះ (${barcode}) មានក្នុងប្រព័ន្ធរួចហើយ!`);
                    return null;
                }
                return reconcileSavedScanRevenue();
            }, (err) => {
                if (!scanIsCurrent()) throw err;
                const revertIndex = dataState.scanHistory.findIndex(i => i.id === itemSnapshot.id);
                if (revertIndex !== -1) dataState.scanHistory[revertIndex] = itemSnapshot;
                refreshCurrentHistoryView();
                return revertRevenueOnSaveFailure(err);
            });
    } else {
        let newItem: any = {
            id: generateUniqueId(),
            createdAt: currentTimeMillis,
            phone: phone,
            cod: cod,
            dod: dod,
            price: Math.round((cod + dod) * 100) / 100,
            count: 1,
            barcode: barcode,
            barcodes: [applyBarcodeCloseState({ code: barcode, time: timeString, cod: cod, dod: dod, locker: locker, isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: currentTimeMillis }, bornClosed, closeStamp)],
            time: timeString,
            scanDate: dateString,
            isClosed: bornClosed,
            isCalled: false
        };
        if (bornClosed) newItem.closedAt = closeStamp;

        dataState.scanHistory.push(newItem);
        savePromise = saveSingleHistoryItemToFirebase(newItem).then((savedItem) => {
            return reconcileSavedScanRevenue();
        }, revertRevenueOnSaveFailure);
    }

    updateRecentPhonesList();
    return savePromise;
}
