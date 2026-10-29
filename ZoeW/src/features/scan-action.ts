import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, firebaseState, scanState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { latinDigits, normalizeStoredPhone } from '../core/text';
import { getFormattedClockTime, getFormattedDate, safeFocusScanner } from '../core/timezone';
import { applyBarcodeCloseState, barcodeEntriesOf, generateUniqueId, normalizeBarcodesOf } from '../domain/barcode';
import { addRevenueToDailyAndMonthlyRecord, correctRevenueLedgerToActual, revertRevenueLedgerDelta, ledgerCompanionState, ledgerDeltaCompanion } from '../domain/ledger';
import { claimBarcodeInRegistry, isBarcodeAlreadyUsed, releaseBarcodesInRegistry, releaseLateBarcodeClaim } from '../domain/registry';
import { armLookupFocus, attemptAutoLookup, clearLookupStatus, fillEmptyLookupFields, lookupAnswersHeldWhileSaving, takeHeldLookupAnswer } from './auto-lookup';
import { handleLockerScan } from './locker-assign';
import { readRestoreServerNode } from './restore';
import { warmZtoLookupProxyNow } from './lookup-api';
import { getLookupApiConfig } from './lookup-config';
import { handleRemoveScan } from './scan-remove';
import { updateRecentPhonesList } from '../services/db-listeners';
import { mergeBarcodeIntoHistoryItem, playBeep, saveSingleHistoryItemToFirebase } from '../services/history-write';
import { withTimeout } from '../services/network';
import { probeDatabaseLiveness } from '../services/connection';
import { finishPendingScan, notePendingScan, pendingScanIsCurrent, preparePendingScan, releasePendingScan, settlePendingScanRelease } from '../services/scan-pending';
import { TX_OUTCOME_MAX_GAP_MS, TX_ROOT_READ_TIMEOUT_MS } from '../services/tx-outcome';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { recalcItemMoneyFromBarcodes, rejectScanAndRefocus } from '../ui/modal-stack';
import { showToast } from '../ui/toast';

export const SCAN_MONEY_MAX = 100000;

export function triggerScanAction(barcode) {
    if (uiState.isModalOpen) return;

    let cleanBarcode = latinDigits(String(barcode || '')).trim();
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
    scanState.pendingScanSession = { db: firebaseState.db, auth: firebaseState.authGeneration };
    scanState.phoneModalTyped = false;
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

export function notePhoneModalInput() {
    if (scanState.pendingBarcode) scanState.phoneModalTyped = true;
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
    const opened = scanState.pendingScanSession;
    if (opened && (opened.db !== firebaseState.db || opened.auth !== firebaseState.authGeneration)) {
        const code = scanState.pendingBarcode;
        scanState.pendingBarcode = '';
        scanState.pendingScanSession = null;
        rejectScanAndRefocus(`⚠️ ហាង ឬគណនីបានប្តូរ — កញ្ចប់ (${code}) មិនត្រូវបានរក្សាទុកទេ។ សូមស្កេនម្ដងទៀត។`);
        return;
    }
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

    const oversized = cod > SCAN_MONEY_MAX ? 'modalCodInput' : (dod > SCAN_MONEY_MAX ? 'modalDodInput' : null);
    if (oversized) {
        const label = oversized === 'modalCodInput' ? 'COD' : 'DOD';
        const amount = oversized === 'modalCodInput' ? cod : dod;
        showToast(`⚠️ ${label} $${amount} ធំខុសធម្មតា (លើស $${SCAN_MONEY_MAX}) — ប្រហែលជាលេខ Barcode ឬលេខទូរស័ព្ទចូលខុសប្រអប់។ មិនបានរក្សាទុកទេ ៖ សូមកែ ${label} ហើយចុច «យល់ព្រម» ម្ដងទៀត។`);
        focusField(oversized);
        return;
    }

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
    let scanEvidence = null;
    let claimStarted = false;
    try {
        scanEvidence = preparePendingScan(barcodeToSave, cod, dod, 0, 'interactive');
        notePendingScan(scanEvidence, 'claim-pending');
        claimStarted = true;
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
            finishPendingScan(scanEvidence, 'not-started');
            rejectScanAndRefocus(`⚠️ លេខ Barcode នេះ (${barcodeToSave}) ត្រូវបានបញ្ចូលរួចហើយ! (ប្រហែលមកពី device ផ្សេង) សូមស្កេនម្ដងទៀត។`);
            return;
        }

        if (claim !== 'claimed') {
            rejectScanAndRefocus(`⚠️ មិនអាចផ្ទៀងផ្ទាត់ថា (${barcodeToSave}) ស្ទួនឬអត់ទេ (ទិន្នន័យមិនទាន់មកដល់) — សូមរង់ចាំបន្តិច ហើយស្កេនម្ដងទៀត។`);
            return;
        }

        try { notePendingScan(scanEvidence, 'claimed'); }
        catch (error) {
            if (current() && pendingScanIsCurrent(scanEvidence)) error.scanSettlement = settlePendingScanRelease(scanEvidence, Promise.resolve(true), () => releaseBarcodesInRegistry([barcodeToSave]));
            throw error;
        }

        const rollbackFailedSave = (error?) => {
            if (!current()) return;
            if (claim === 'claimed' && !error?.scanReleaseHandled) releaseBarcodesInRegistry([barcodeToSave]);
            dropOptimisticBarcode(barcodeToSave);
            refreshCurrentHistoryView();
        };

        const savePromise = addOrUpdateEntry(barcodeToSave, phone, cod, dod, locker, scanEvidence.record.createdAt, 0, scanEvidence);
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
                    rollbackFailedSave(lateErr);
                    if (!lateErr?.scanSettlement) showToast(`⚠️ រក្សាទុក (${barcodeToSave}) បរាជ័យ! សូមស្កេនម្ដងទៀត។`);
                    if (window.ZoeErrors) ZoeErrors.capture(lateErr, { zone: 'data', context: 'savePhoneAndSave late write' });
                });
                closeModal('phoneModal');
                showToast(`⏳ កំពុងរក្សាទុក (${barcodeToSave})… សូមកុំស្កេនម្ដងទៀត។`);
                safeFocusScanner();
                return;
            }
            rollbackFailedSave(saveError);
            throw saveError;
        }

        const heldAnswer = takeHeldLookupAnswer(barcodeToSave);
        closeModal('phoneModal');
        showToast("✅ រក្សាទុកបានជោគជ័យ!");
        warnHeldLookupMoney(heldAnswer, barcodeToSave, cod, dod);
    } catch (e) {
        if (scanEvidence && !claimStarted) finishPendingScan(scanEvidence, 'not-started');
        if (!current()) return;
        if (e && e.scanSettlement) return;
        showToast(e && e.code === 'scan_evidence_unavailable'
            ? '⚠️ មិនអាចរក្សាទុកភស្តុតាងស្កេនក្នុងឧបករណ៍បាន។ សូមពិនិត្យទំហំផ្ទុក មុនសាកម្ដងទៀត។'
            : `⚠️ រក្សាទុកបរាជ័យ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងស្កេន (${barcodeToSave}) ម្ដងទៀត។`);
    } finally {
        releasePendingScan(scanEvidence);
        if (current()) {
            viewState.phoneModalBusy = false;
            warmZtoLookupProxyNow();
            const heldAnswer = takeHeldLookupAnswer(scanState.pendingBarcode);
            if (heldAnswer) fillEmptyLookupFields(heldAnswer.phone, heldAnswer.cod, heldAnswer.dod);
        }
    }
}

export const SCAN_SETTLE_READ_TRIES = 3;

export const SCAN_SETTLE_READ_GAP_MS = 1000;

export function addOrUpdateEntry(barcode, phone, cod, dod, locker = "N/A", stampMs = 0, closedAtMs = 0, preparedScan?) {
    let savePromise;
    const stamp = Number(stampMs);
    const currentTimeMillis = isFinite(stamp) && stamp > 0 ? stamp : getServerNow();
    const closeStamp = Number(closedAtMs);
    const bornClosed = isFinite(closeStamp) && closeStamp > 0;
    const dateString = getFormattedDate(currentTimeMillis as any);

    const timeFormatted = getFormattedClockTime(currentTimeMillis);
    const timeString = `${timeFormatted} (${dateString})`;

    let existingIndex = -1;
    if (phone !== "គ្មានលេខ") {
        existingIndex = dataState.scanHistory.findIndex(item => item.phone === phone && item.scanDate === dateString && (bornClosed ? item.isClosed === true : !item.isClosed));
    }

    const targetItemId = existingIndex !== -1 ? dataState.scanHistory[existingIndex].id : generateUniqueId();
    let scanEvidence = preparedScan;
    let evidenceIdentityMatched = false;
    try {
        if (!scanEvidence) scanEvidence = preparePendingScan(barcode, cod, dod, currentTimeMillis);
        const identity = scanEvidence.record;
        if (identity.barcode !== barcode || identity.createdAt !== currentTimeMillis || identity.cod !== cod || identity.dod !== dod) throw new Error('Scan evidence identity changed');
        evidenceIdentityMatched = true;
        notePendingScan(scanEvidence, 'save-pending', targetItemId);
    } catch (error) {
        const failure: any = error instanceof Error ? error : new Error(String(error));
        failure.scanReleaseHandled = true;
        if (evidenceIdentityMatched && scanEvidence && scanEvidence.claimed && pendingScanIsCurrent(scanEvidence)) {
            failure.scanSettlement = settlePendingScanRelease(scanEvidence, Promise.resolve(true), () => releaseBarcodesInRegistry([barcode]));
        } else if (!preparedScan && scanEvidence && pendingScanIsCurrent(scanEvidence)) {
            finishPendingScan(scanEvidence, 'not-started');
        }
        releasePendingScan(scanEvidence);
        return Promise.reject(failure);
    }
    const scanRevenueApplied = addRevenueToDailyAndMonthlyRecord(dateString, cod, dod, 1, ledgerDeltaCompanion(targetItemId, barcode, cod, dod, undefined, undefined, currentTimeMillis));
    const scanIsCurrent = () => typeof scanRevenueApplied.isCurrent !== 'function' || scanRevenueApplied.isCurrent();
    const reconcileSavedScanRevenue = () => {
        if (!scanIsCurrent()) return Promise.resolve(false);
        return correctRevenueLedgerToActual(dateString, scanRevenueApplied, cod, dod, 1).then((status) => {
            if (!scanIsCurrent()) return false;
            if (status && status.ok) {
                finishPendingScan(scanEvidence, 'saved-and-ledger-confirmed');
                return true;
            }
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
        if (!err || typeof err !== 'object') err = new Error(String(err));
        const reversed = revertRevenueLedgerDelta(scanRevenueApplied);
        err.scanReleaseHandled = true;
        err.scanSettlement = settlePendingScanRelease(scanEvidence, reversed && reversed.compensation, () => releaseBarcodesInRegistry([barcode]));
        throw err;
    };
    const settleRejectedSave = (err, undoView) => {
        if (!scanIsCurrent()) throw err;
        if (!err || err.txOutcome !== 'unknown') {
            undoView();
            return revertRevenueOnSaveFailure(err);
        }
        const readApi = firebaseState.fb;
        const readDb = firebaseState.db;
        let otherLifecycleSeen = false;
        const scanCopyMoved = (budgetMs?) => Promise.all(['zoew_recently_deleted_cod_dod', 'zoew_scan_history_cod_dod']
            .map((root) => readRestoreServerNode(readApi, readDb, root, budgetMs)))
            .then((roots) => {
                let otherCopy = false;
                for (const root of roots) {
                    if (!root || typeof root !== 'object') continue;
                    for (const id of Object.keys(root)) for (const { barcode: b } of barcodeEntriesOf(root[id] && root[id].barcodes)) {
                        if (!b || b.code !== barcode) continue;
                        if (Number(b.createdAt) === currentTimeMillis) return 'moved';
                        otherCopy = true;
                        otherLifecycleSeen = true;
                    }
                }
                return otherCopy || otherLifecycleSeen ? 'unread' : 'absent';
            });
        const readScanOutcome = (budgetMs?) => Promise.resolve()
            .then(() => readRestoreServerNode(readApi, readDb, `zoew_scan_history_cod_dod/${targetItemId}`))
            .then((row) => {
                const state = ledgerCompanionState(row, ledgerDeltaCompanion(targetItemId, barcode, undefined, undefined, undefined, undefined, currentTimeMillis));
                if (state !== 'absent') return state;
                const otherCopy = barcodeEntriesOf(row && row.barcodes).some(({ barcode: b }) => b && b.code === barcode);
                if (otherCopy) otherLifecycleSeen = true;
                return scanCopyMoved(budgetMs).then((moved) => moved === 'absent' && otherCopy ? 'unread' : moved, () => 'unread');
            }, () => 'unread');
        const settleScanLater = (gap) => { setTimeout(() => {
            if (!scanIsCurrent()) return;
            if ((navigator.onLine as boolean) === false) { settleScanLater(SCAN_SETTLE_READ_GAP_MS); return; }
            readScanOutcome(TX_ROOT_READ_TIMEOUT_MS).then((state) => {
                if (!scanIsCurrent()) return;
                if (state === 'unread') { settleScanLater(Math.min(gap * 2, TX_OUTCOME_MAX_GAP_MS)); return; }
                if (state === 'absent') {
                    const reversed = revertRevenueLedgerDelta(scanRevenueApplied);
                    settlePendingScanRelease(scanEvidence, reversed && reversed.compensation, () => releaseBarcodesInRegistry([barcode]));
                    refreshCurrentHistoryView();
                    return;
                }
                reconcileSavedScanRevenue().then((saved) => { if (saved && scanIsCurrent()) showToast(`✅ (${barcode}) រក្សាទុកបានជោគជ័យ!`); });
            });
        }, gap); };
        const decideScanOutcome = (tries) => readScanOutcome().then((state) => {
            if (state !== 'unread' || tries <= 1 || !scanIsCurrent() || (navigator.onLine as boolean) === false) return state;
            return new Promise((resolve) => setTimeout(resolve, SCAN_SETTLE_READ_GAP_MS)).then(() => decideScanOutcome(tries - 1));
        });
        return decideScanOutcome(SCAN_SETTLE_READ_TRIES)
            .then((state): boolean | 'unknown' | Promise<boolean> => {
                if (!scanIsCurrent()) throw err;
                if (state === 'absent') {
                    undoView();
                    return revertRevenueOnSaveFailure(err);
                }
                if (state !== 'unread') return reconcileSavedScanRevenue();
                try { notePendingScan(scanEvidence, otherLifecycleSeen ? 'hold' : 'pending'); } catch (e) {}
                if (window.ZoeErrors) ZoeErrors.capture(err, { zone: 'money', context: 'addOrUpdateEntry save outcome unknown', barcode, itemId: targetItemId });
                showToast(`⏳ មិនទាន់ដឹងថា (${barcode}) បានរក្សាទុកឬអត់ទេ — App នឹងបង្ហាញតាម Server ពេលភ្ជាប់វិញ។ កុំស្កេនម្ដងទៀត។`);
                settleScanLater(SCAN_SETTLE_READ_GAP_MS);
                return 'unknown';
            });
    };

    if (existingIndex !== -1) {
        let item = dataState.scanHistory[existingIndex];
        const itemSnapshot = { ...item, barcodes: Array.isArray(item.barcodes) ? item.barcodes.map(b => ({ ...b })) : item.barcodes };
        let mergeAddedBarcode = false;

        const mergeScannedBarcodeInto = (target) => {
            mergeAddedBarcode = false;
            normalizeBarcodesOf(target);
            if (!Array.isArray(target.barcodes)) return undefined;

            if (!target.barcodes.some(b => b && b.code === barcode)) {
                mergeAddedBarcode = true;
                target.barcodes.push(applyBarcodeCloseState({
                    code: barcode,
                    time: timeString,
                    cod: cod,
                    dod: dod,
                    locker: locker,
                    isClosed: false,
                    isDeducted: false,
                    isFromDeletion: false,
                    createdAt: currentTimeMillis
                }, bornClosed, closeStamp));
            }

            target.count = target.barcodes.length;
            recalcItemMoneyFromBarcodes(target);
            target.barcode = barcode;
            target.time = timeString;
            target.scanDate = dateString;
            const allClosed = target.barcodes.length > 0 && target.barcodes.every(b => b && b.isClosed === true);
            const latestClose = allClosed ? target.barcodes.reduce((max, b) => Math.max(max, Number(b.closedAt) || 0), 0) : 0;
            target.isClosed = allClosed;
            if (latestClose > 0) target.closedAt = latestClose;
            else if (!allClosed) delete target.closedAt;
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
                    const reversed = revertRevenueLedgerDelta(scanRevenueApplied);
                    Promise.resolve(reversed && reversed.compensation).then((done) => {
                        if (done === true && scanIsCurrent()) finishPendingScan(scanEvidence, 'saved-and-ledger-confirmed');
                    });
                    showToast(`⚠️ លេខ Barcode នេះ (${barcode}) មានក្នុងប្រព័ន្ធរួចហើយ!`);
                    return null;
                }
                return reconcileSavedScanRevenue();
            }, (err) => settleRejectedSave(err, () => {
                    const revertIndex = dataState.scanHistory.findIndex(i => i.id === itemSnapshot.id);
                    if (revertIndex !== -1) dataState.scanHistory[revertIndex] = itemSnapshot;
                    refreshCurrentHistoryView();
                }));
    } else {
        let newItem: any = {
            id: targetItemId,
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
        savePromise = saveSingleHistoryItemToFirebase(newItem).then(() => reconcileSavedScanRevenue(), (err) => settleRejectedSave(err, () => {}));
    }

    updateRecentPhonesList();
    return savePromise.finally(() => releasePendingScan(scanEvidence));
}
