import { modalIsOpen, setModalDisplay } from '../core/modals';
import { fieldValue, setFieldValue } from '../app/refs';
import { domText, viewState } from '../core/view-state';
import { dataState, firebaseState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { formatScanStamp, getFormattedDate } from '../core/timezone';
import { applyBarcodeCloseState, barcodeSignIdentity, barcodeZtoSigned, dropStaleRestoreMarkers, ensureBarcodeArrayForItem, itemHasRestoreMarkers, normalizeBarcodesOf, stampTrashPolicy, stripHistoryOnlyMarkers } from '../domain/barcode';
import { CLEANUP_STAGE_COLLECTED, CLEANUP_STAGE_FLIP, CLEANUP_STAGE_MOVED, cleanupInFlight, beginCleanupOperation, releaseCleanupOperation, clearCleanupJournalEntry, claimCleanupTrashSlot, deductCleanupRevenue, holdCleanupJournalLive, markCleanupJournalStage, patchCleanupJournalEntry, prepareCleanupClaim, remarkCleanupCollectedKept, restoreClaimedItemToScanHistory, settleCleanupDeduction } from '../domain/cleanup';
import { collectedMarksFor, holdCollectedSettle, markCollectedRevenue, reapplyPickupMarks, reconcileCollectedHistory, revertPickupMarks, syncCollectedValueForBarcode } from '../domain/collected';
import { addRevenueToDailyAndMonthlyRecord, correctRevenueLedgerToActual, revertRevenueLedgerDelta, ledgerDeltaCompanion } from '../domain/ledger';
import { getPickupPhoneKey, markPickupBarcodes, pickupBarcodeKey, pickupIntentTracker, reconstructPickupSet } from '../domain/pickup';
import { clearScannedRemovalInFlight } from './scan-remove';
import { TRASH_WRITE_SLOW_NOTICE_MS } from './session';
import { armLateCommit, dbOp, dbOpStalled, notifyIfSlow, retryAsync, viewListModalShowing } from '../services/network';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { recalcItemMoneyFromBarcodes } from '../ui/modal-stack';
import { showToast } from '../ui/toast';
import { RESTORE_IN_PROGRESS_CLOSE_TEXT, ZTO_SIGNED_REOPEN_TEXT } from '../core/text';
import { itemOriginOf, originLabel } from './barcode-origin';
import { barcodeSignedInZto } from './zto-final-marks';
import { getManualZtoTrashMode } from './lookup-config';

export function openViewListModal(id?) {
    uiState.activeParentItemId = id;
    const item = dataState.scanHistory.find(i => i.id === id);
    if (!item) return;

    viewState.listModalPhoneText = domText(item.phone);

    ensureBarcodeArrayForItem(item);

    uiState.viewListView = item.barcodes.map((b, idx) => {
        const itemCod = parseFloat(b.cod) || 0;
        const itemDod = parseFloat(b.dod) || 0;
        const isBcClosed = b.isClosed || false;
        const bcMoneyClass = isBcClosed ? 'money-collected' : 'money-pending';
        const bcCodRiel = Math.round(itemCod * dataState.exchangeRateRiel);
        const bcDodRiel = Math.round(itemDod * dataState.exchangeRateRiel);
        const hasCod = itemCod > 0;
        const hasDod = itemDod > 0;
        const money = [];
        let sum = null;
        if (hasCod && hasDod) {
            money.push({ cls: bcMoneyClass, kindDod: false, label: 'COD', dollars: itemCod.toFixed(2), riel: bcCodRiel.toLocaleString() });
            money.push({ cls: bcMoneyClass, kindDod: true, label: 'DOD', dollars: itemDod.toFixed(2), riel: bcDodRiel.toLocaleString() });
            sum = { cls: bcMoneyClass, dollars: (Math.round((itemCod + itemDod) * 100) / 100).toFixed(2), riel: (bcCodRiel + bcDodRiel).toLocaleString() };
        } else if (hasDod) {
            money.push({ cls: bcMoneyClass, kindDod: true, label: 'DOD', dollars: itemDod.toFixed(2), riel: bcDodRiel.toLocaleString() });
        } else {
            money.push({ cls: bcMoneyClass, kindDod: false, label: 'COD', dollars: itemCod.toFixed(2), riel: bcCodRiel.toLocaleString() });
        }
        return {
            itemId: item.id,
            code: b.code,
            index: idx + 1,
            locker: b.locker || 'N/A',
            time: b.time ? formatScanStamp(b.time) : null,
            origin: originLabel(itemOriginOf(item, b.code)).full,
            moneyClass: bcMoneyClass,
            money: money,
            sum: sum,
            closed: isBcClosed,
            signed: isBcClosed && barcodeSignedInZto(b)
        };
    });
    uiState.touch();

    openModalHelper('viewListModal');
}

export async function removeSingleBarcode(itemId, barcodeCode, _callSiteTag?: string) {
    if (cleanupInFlight.has(itemId)) return 'pending';
    const confirmedByScan = arguments[2] === 'scan-confirmed' && uiState.scanRemoveInFlight &&
        uiState.scanRemoveInFlight.itemId === itemId && uiState.scanRemoveInFlight.barcodeCode === barcodeCode;
    const confirmedScanToken = confirmedByScan ? uiState.scanRemoveInFlight.operationToken : null;
    if (!itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId)) {
        const idErr = new Error('Unsafe id during removeSingleBarcode');
        console.error(idErr.message, itemId);
        if (window.ZoeErrors) ZoeErrors.capture(idErr, { zone: 'money', context: 'removeSingleBarcode' });
        showToast("⚠️ ដកកញ្ចប់មិនបានជោគជ័យ! (ID មិនត្រឹមត្រូវ)");
        return 'failed';
    }
    const item = dataState.scanHistory.find(i => i.id === itemId);
    if (!item) {
        if (confirmedByScan) showToast(`⚠️ Barcode (${barcodeCode}) លែងមានក្នុងបញ្ជីទៀតហើយ — គ្មានអ្វីត្រូវបានដក។`);
        return 'missing';
    }
    ensureBarcodeArrayForItem(item);
    if (!item.barcodes) return 'missing';

    const bcIndex = item.barcodes.findIndex(b => b.code === barcodeCode);
    if (bcIndex === -1) {
        if (confirmedByScan) showToast(`⚠️ Barcode (${barcodeCode}) លែងមានក្នុងបញ្ជីទៀតហើយ — គ្មានអ្វីត្រូវបានដក។`);
        return 'missing';
    }

    if (!confirmedByScan && !confirm(`តើអ្នកពិតជាចង់ដកកញ្ចប់អីវ៉ាន់ (${barcodeCode}) នេះចេញពីការគ្រប់គ្រងមែនទេ? (ZTO Login ឬកញ្ចប់ Sign រួច៖ មិនអាចស្តារបាន។ កញ្ចប់ផ្សេងស្តារតាមគោលការណ៍ធុងសំរាម។)`)) return 'cancelled';

    const removeDb = firebaseState.db;
    const removeGeneration = firebaseState.authGeneration;
    const removeMode = getManualZtoTrashMode();
    const removeIsCurrent = () => firebaseState.db === removeDb && firebaseState.authGeneration === removeGeneration;
    const noteRemoveSessionSwitch = (trashId) => {
        if (trashId) { try { patchCleanupJournalEntry(trashId, { switchReported: true }); } catch (journalErr) {} }
        if (window.ZoeErrors) ZoeErrors.capture(new Error('Remove stopped after a database switch'), { zone: 'money', context: 'removeSingleBarcode session switch', itemId });
    };
    let claimedParent = null;
    let claimedBarcode = null;
    let claimedWhole = null;
    let restoreClaimBlocked = false;
    const removeUpdater = (currentItem) => {
        claimedParent = null;
        claimedBarcode = null;
        claimedWhole = null;
        restoreClaimBlocked = false;
        if (!currentItem) return currentItem;
        if (currentItem.clearClaim) return currentItem;
        if (itemHasRestoreMarkers(currentItem)) {
            restoreClaimBlocked = true;
            return;
        }
        ensureBarcodeArrayForItem(currentItem);
        if (!Array.isArray(currentItem.barcodes)) return currentItem;
        const idx = currentItem.barcodes.findIndex(b => b && b.code === barcodeCode);
        if (idx === -1) return currentItem;
        claimedParent = currentItem;
        claimedBarcode = currentItem.barcodes[idx];
        const kept = currentItem.barcodes.filter((b, i) => i !== idx);
        if (kept.length === 0) {
            claimedWhole = currentItem;
            return null;
        }
        const updated = { ...currentItem, barcodes: kept };
        updated.count = kept.length;
        recalcItemMoneyFromBarcodes(updated);
        updated.barcode = kept[0].code;
        updated.isClosed = kept.every(b => b.isClosed);
        if (updated.isClosed) {
            if (!updated.closedAt) updated.closedAt = getServerNow();
        } else {
            delete updated.closedAt;
        }
        return updated;
    };
    let preparedEntry = null;
    let removalTrash = null;
    let pendingRemoval = false;
    let operation = null;
    let collectedHold = null;
    const releaseRemoval = () => {
        releaseCleanupOperation(itemId, operation, true);
        if (collectedHold && removeIsCurrent()) {
            holdCleanupJournalLive([preparedEntry && preparedEntry.trashItem.id, removalTrash && removalTrash.id], collectedHold, removeIsCurrent, operation);
            return;
        }
        releaseCleanupOperation(null, operation);
    };
    const durableRemoveUpdater = (currentItem) => {
        if (!removeIsCurrent()) return;
        const next = removeUpdater(currentItem);
        if (claimedBarcode) preparedEntry = prepareCleanupClaim(itemId, 'remove', null, { ...claimedParent, barcodes: [claimedBarcode] }, removeMode, operation);
        return next;
    };
    const finishRemoval = async (result, late) => {
        if (!removeIsCurrent()) {
            if (claimedBarcode) noteRemoveSessionSwitch(preparedEntry && preparedEntry.trashItem.id);
            return 'stale';
        }
        if (!claimedBarcode) {
            if (preparedEntry) clearCleanupJournalEntry(preparedEntry.trashItem.id);
            refreshCurrentHistoryView();
            showToast("⚠️ កញ្ចប់នេះលែងមានក្នុងប្រព័ន្ធទៀតហើយ! គ្មានអ្វីត្រូវដកទេ។");
            return 'missing';
        }

        const committedItem = result.snapshot ? result.snapshot.val() : null;
        const localIdx = dataState.scanHistory.findIndex(i => i.id === itemId);
        if (claimedWhole) {
            if (localIdx !== -1) dataState.scanHistory.splice(localIdx, 1);
            if (!late || viewListModalShowing(itemId)) closeModal('viewListModal');
        } else if (localIdx !== -1 && committedItem) {
            dataState.scanHistory[localIdx] = { ...committedItem, id: itemId };
        }

        const removedBc = { ...claimedBarcode,
            cod: Math.round((parseFloat(claimedBarcode.cod) || 0) * 100) / 100,
            dod: Math.round((parseFloat(claimedBarcode.dod) || 0) * 100) / 100,
            isDeducted: claimedBarcode.isDeducted === true, isFromDeletion: false };
        const revenueScanDate = claimedParent.scanDate || getFormattedDate();

        const itemToTrash = stripHistoryOnlyMarkers({ ...claimedParent, barcodes: [removedBc], count: 1 });
        removalTrash = itemToTrash;
        itemToTrash.id = preparedEntry.trashItem.id;
        itemToTrash.deletedAt = preparedEntry.trashItem.deletedAt;
        itemToTrash.isFromDeletion = false;
        itemToTrash.trashReason = 'remove';
        stampTrashPolicy(itemToTrash, preparedEntry.trashItem.trashMode);
        itemToTrash.cod = parseFloat(removedBc.cod) || 0;
        itemToTrash.dod = parseFloat(removedBc.dod) || 0;
        itemToTrash.price = Math.round((itemToTrash.cod + itemToTrash.dod) * 100) / 100;
        itemToTrash.barcode = removedBc.code;
        itemToTrash.locker = removedBc.locker || "N/A";
        itemToTrash.time = removedBc.time || claimedParent.time;
        itemToTrash.isClosed = removedBc.isClosed || false;
        if (itemToTrash.isClosed) {
            itemToTrash.closedAt = claimedParent.closedAt || getServerNow();
        } else {
            delete itemToTrash.closedAt;
        }

        dataState.deletedItems.unshift(itemToTrash);
        if (!confirmedByScan && !claimedWhole && (!late || viewListModalShowing(itemId))) openViewListModal(itemId);
        refreshCurrentHistoryView();

        let trashSaved = false;
        let trashElsewhere = false;
        await notifyIfSlow(retryAsync(() => (removeIsCurrent() ? claimCleanupTrashSlot(itemToTrash, false, operation).then((owned) => { trashElsewhere = !owned; }) : Promise.reject(Object.assign(new Error('Remove session changed'), { noRetry: true }))), 4, 1500),
            TRASH_WRITE_SLOW_NOTICE_MS,
            `⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរក្សាទុកការដក (${barcodeCode})… សូមកុំបិទ App។`).then(() => {
            trashSaved = true;
        }).catch(async (trashErr) => {
            const staleIdx = dataState.deletedItems.findIndex(i => i.id === itemToTrash.id);
            if (staleIdx !== -1) dataState.deletedItems.splice(staleIdx, 1);
            console.error('Trash write permanently failed for removeSingleBarcode of', itemId, trashErr);
            if (!removeIsCurrent()) {
                noteRemoveSessionSwitch(itemToTrash.id);
                return;
            }
            if (window.ZoeErrors) ZoeErrors.capture(trashErr, { zone: 'money', context: 'removeSingleBarcode trash write failed after retries', itemId });
            let restoreOk = false;
            try {
                await restoreClaimedItemToScanHistory(itemId, claimedWhole, claimedWhole ? null : { ...claimedParent, barcodes: [claimedBarcode] });
                restoreOk = true;
                clearCleanupJournalEntry(itemToTrash.id);
            } catch (restoreErr) {
                console.error('Failed to restore barcode to scan history after trash write failure for', itemId, restoreErr);
                if (window.ZoeErrors) ZoeErrors.capture(restoreErr, { zone: 'money', context: 'removeSingleBarcode restore-after-trash-failure also failed', itemId });
                showToast('⚠️ បញ្ហាធ្ងន់ធ្ងរ៖ ទិន្នន័យកញ្ចប់ ' + barcodeCode + ' អាចនឹងបាត់! សូមប្រាប់ Admin ត្រួតពិនិត្យភ្លាមៗ');
            }
            if (restoreOk) {
                refreshCurrentHistoryView();
                showToast("⚠️ ការដកត្រូវបានបោះបង់ ហើយកញ្ចប់បានស្ដារមកក្នុងបញ្ជីវិញ។ ស្ថិតិកំពុងកែសម្រួលដោយស្វ័យប្រវត្តិ។");
            }
        });
        if (trashSaved) {
            if (!removeIsCurrent()) return 'stale';
            const collectedDrop = markCollectedRevenue(collectedMarksFor(claimedBarcode, false, claimedBarcode.closedAt));
            const collectedServer = collectedDrop && collectedDrop.server && typeof collectedDrop.server.then === 'function' ? collectedDrop.server : null;
            let collectedSaved = collectedServer ? undefined : true;
            if (collectedServer) collectedServer.then((saved) => { collectedSaved = saved; }, () => { collectedSaved = null; });
            if (trashElsewhere) { clearCleanupJournalEntry(itemToTrash.id); return 'missing'; }
            markCleanupJournalStage(itemToTrash.id, CLEANUP_STAGE_MOVED);
            if (!claimedBarcode.isDeducted) {
                const revenue = { scanDate: revenueScanDate, cod: itemToTrash.cod, dod: itemToTrash.dod, count: 1 };
                if (!late) showToast(`⏳ បានដកកញ្ចប់ (${barcodeCode}) — កំពុងផ្ទៀងផ្ទាត់ស្ថិតិប្រាក់…`);
                const deduction = await deductCleanupRevenue(itemId, itemToTrash, revenue);
                if (deduction !== 'deducted' || !removeIsCurrent()) return 'pending';
                markCleanupJournalStage(itemToTrash.id, CLEANUP_STAGE_FLIP);
                if (!(await settleCleanupDeduction(itemId, itemToTrash, revenue, false))) return 'pending';
            }
            if (collectedSaved === true) {
                clearCleanupJournalEntry(itemToTrash.id);
            } else {
                markCleanupJournalStage(itemToTrash.id, CLEANUP_STAGE_COLLECTED);
                if (collectedSaved === undefined) collectedHold = collectedServer.then(async (saved) => {
                    if (saved !== true) return;
                    if (await remarkCleanupCollectedKept(preparedEntry, removeIsCurrent, removeDb) === true && removeIsCurrent()) clearCleanupJournalEntry(itemToTrash.id);
                }, () => {});
            }
            showToast(late ? `✅ បណ្តាញត្រឡប់មកវិញ — បានដកកញ្ចប់ (${barcodeCode}) រួចរាល់!`
                : claimedBarcode.isDeducted ? '✅ បានដកកញ្ចប់អីវ៉ាន់រួចរាល់!' : '✅ បានដកកញ្ចប់អីវ៉ាន់ និងកាត់ប្រាក់ចេញពីស្ថិតិរួចរាល់!');
        }
        return trashSaved ? 'done' : 'failed';
    };
    try {
        operation = beginCleanupOperation(itemId);
        const removeTx = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${itemId}`), durableRemoveUpdater);
        let result;
        try {
            result = await dbOp(removeTx);
        } catch (txError) {
            if (dbOpStalled(txError)) {
                pendingRemoval = true;
                armLateCommit(removeTx, async (late) => {
                    try {
                        await finishRemoval(late, true);
                    } finally {
                        releaseRemoval();
                        if (confirmedScanToken) clearScannedRemovalInFlight(itemId, barcodeCode, confirmedScanToken);
                    }
                }, (lateErr) => {
                    try {
                        if (!removeIsCurrent()) return;
                        refreshCurrentHistoryView();
                        showToast(restoreClaimBlocked
                            ? "⏳ កញ្ចប់នេះកំពុងស្តារ — សូមរង់ចាំឲ្យចប់ រួចសាកដកម្តងទៀត។"
                            : `⚠️ ដកកញ្ចប់ (${barcodeCode}) មិនបានជោគជ័យ! គ្មានការដកដែលបានបញ្ជាក់ទេ — សូម Sync រួចសាកល្បងម្តងទៀត។`);
                        if (lateErr && window.ZoeErrors) ZoeErrors.capture(lateErr, { zone: 'money', context: 'removeSingleBarcode late transaction failed', itemId });
                    } finally {
                        releaseRemoval();
                        if (confirmedScanToken) clearScannedRemovalInFlight(itemId, barcodeCode, confirmedScanToken);
                    }
                }, 'removeSingleBarcode');
                showToast(`⏳ បណ្តាញឆ្លើយមិនចេញ — ការដក (${barcodeCode}) នឹងបញ្ចប់ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ។ សូមកុំដកម្ដងទៀត។`);
                return 'pending';
            }
            throw txError;
        }
        if (!result || !result.committed) {
            if (!removeIsCurrent()) { if (preparedEntry) noteRemoveSessionSwitch(preparedEntry.trashItem.id); return 'stale'; }
            if (restoreClaimBlocked) {
                showToast("⏳ កញ្ចប់នេះកំពុងស្តារ — សូមរង់ចាំឲ្យចប់ រួចសាកដកម្តងទៀត។");
                return 'failed';
            }
            throw new Error('Remove barcode transaction was not committed');
        }
        return await finishRemoval(result, false);
    } catch (e) {
        console.error("Error removing single barcode: ", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'money', context: "Error removing single barcode: " });
        refreshCurrentHistoryView();
        showToast(`⚠️ ដកកញ្ចប់ (${barcodeCode}) មិនបានជោគជ័យ! គ្មានការដកដែលបានបញ្ជាក់ទេ — សូម Sync រួចសាកល្បងម្តងទៀត។`);
        return 'failed';
    } finally {
        if (!pendingRemoval) releaseRemoval();
    }
}

export async function toggleIndividualBarcodeClose(itemId?, barcodeCode?) {
    const item = dataState.scanHistory.find(i => i.id === itemId);
    if (!item || !item.barcodes) return;

    let targetB = item.barcodes.find(b => b.code === barcodeCode);
    if (!targetB) return;
    const actionText = targetB.isClosed ? "បើក" : "បិទ";
    const desiredClosed = !targetB.isClosed;
    if (!confirm(`តើអ្នកប្រាកដជាចង់${actionText}ស្ថានភាពកញ្ចប់អីវ៉ាន់ (${targetB.code}) នេះមែនទេ?`)) return;
    return applyBarcodeCloseChange(itemId, barcodeCode, desiredClosed, {});
}

export async function applyBarcodeCloseChange(itemId, barcodeCode, desiredClosed, options) {
    const closeAuthGeneration = firebaseState.authGeneration;
    const closeDatabase = firebaseState.db;
    const closeIsCurrent = () => closeAuthGeneration === firebaseState.authGeneration && closeDatabase === firebaseState.db;
    const opts = options || {};
    const silent = opts.silent === true;
    const showModalAfterApply = opts.showModal !== false;
    const actionText = desiredClosed ? "បិទ" : "បើក";
    if (!firebaseState.db || !firebaseState.fb || !/^[a-zA-Z0-9_-]+$/.test(itemId)) {
        if (!silent) showToast(`⚠️ មិនទាន់ភ្ជាប់ Firebase ឬ ID មិនត្រឹមត្រូវ — ស្ថានភាព Barcode (${barcodeCode}) មិនត្រូវបានផ្លាស់ប្តូរ។`);
        return false;
    }

    const freshItem = dataState.scanHistory.find(i => i.id === itemId);
    const freshB = freshItem && freshItem.barcodes ? freshItem.barcodes.find(b => b.code === barcodeCode) : null;
    if (opts.expectedSignIdentity !== undefined && (!freshB || barcodeSignIdentity(freshItem, freshB) !== opts.expectedSignIdentity)) return false;
    if (!desiredClosed && barcodeZtoSigned(freshB)) {
        if (!silent) showToast(ZTO_SIGNED_REOPEN_TEXT);
        return false;
    }
    const previousState = freshItem && freshB
        ? { isClosed: freshB.isClosed, barcodeClosedAt: freshB.closedAt, itemIsClosed: freshItem.isClosed, itemClosedAt: freshItem.closedAt, itemCallMark: freshItem.callMark, itemCallMarkTime: freshItem.callMarkTime }
        : null;
    let pickupPhoneKey = null;
    let pickupScanDate = null;
    let pickupSeed = null;
    let pickupApplied = null;
    let serverApplied = false;
    let serverPickupMarks = null;
    let signedRefused = false;
    let restoreHeld = false;
    const pickupJournal = pickupIntentTracker(closeIsCurrent, itemId);
    const reconcilePickupDeltaWithServer = () => {
        if (!serverPickupMarks) return;
        pickupJournal.add(pickupScanDate, serverPickupMarks.map((mark) => mark.key));
        pickupApplied = reapplyPickupMarks(pickupApplied, serverPickupMarks, pickupScanDate, pickupSeed);
        pickupJournal.note(pickupApplied);
        refreshCurrentHistoryView();
    };
    if (freshItem && freshB) {
        pickupScanDate = freshItem.scanDate || getFormattedDate();
        pickupSeed = reconstructPickupSet(pickupScanDate);
        applyBarcodeCloseState(freshB, desiredClosed, getServerNow());
        const allClosedLocal = freshItem.barcodes.every(b => b.isClosed);
        freshItem.isClosed = allClosedLocal;
        if (allClosedLocal) freshItem.closedAt = getServerNow(); else delete freshItem.closedAt;
        if (desiredClosed) {
            delete freshItem.callMark;
            delete freshItem.callMarkTime;
        }

        pickupPhoneKey = getPickupPhoneKey(freshItem);
        const pickupKey = pickupBarcodeKey(barcodeCode);
        if (pickupKey) pickupJournal.add(pickupScanDate, [pickupKey]);
        pickupApplied = pickupKey ? markPickupBarcodes(pickupScanDate, [{ key: pickupKey, phoneKey: pickupPhoneKey, closed: desiredClosed }], pickupSeed) : null;
        pickupJournal.note(pickupApplied);

        if (showModalAfterApply) openViewListModal(itemId);
        refreshCurrentHistoryView();
    }

    const revertBarcodeCloseLocally = () => {
        if (!closeIsCurrent()) return;
        if (previousState) {
            const revertItem = dataState.scanHistory.find(i => i.id === itemId);
            const revertB = revertItem && revertItem.barcodes ? revertItem.barcodes.find(b => b.code === barcodeCode) : null;
            if (revertItem && revertB && (opts.expectedSignIdentity === undefined || barcodeSignIdentity(revertItem, revertB) === opts.expectedSignIdentity)) {
                revertB.isClosed = previousState.isClosed;
                if (previousState.barcodeClosedAt !== undefined) revertB.closedAt = previousState.barcodeClosedAt;
                else delete revertB.closedAt;
                revertItem.isClosed = previousState.itemIsClosed;
                if (previousState.itemClosedAt !== undefined) revertItem.closedAt = previousState.itemClosedAt;
                else delete revertItem.closedAt;
                if (previousState.itemCallMark !== undefined) revertItem.callMark = previousState.itemCallMark;
                else delete revertItem.callMark;
                if (previousState.itemCallMarkTime !== undefined) revertItem.callMarkTime = previousState.itemCallMarkTime;
                else delete revertItem.callMarkTime;
                if (viewListModalShowing(itemId)) openViewListModal(itemId);
                refreshCurrentHistoryView();
            }
        }
        if (pickupApplied) {
            const reverted = revertPickupMarks(pickupApplied, null, true);
            pickupJournal.note(reverted);
            pickupApplied = null;
        }
    };
    const settleBarcodeCloseOnce = async (barcodeCloseResult, late) => {
        if (!closeIsCurrent()) { pickupJournal.finish(); return false; }
        if (!serverApplied || !(barcodeCloseResult && barcodeCloseResult.committed)) {
            revertBarcodeCloseLocally();
            pickupJournal.finish();
            showToast(signedRefused ? ZTO_SIGNED_REOPEN_TEXT : restoreHeld ? RESTORE_IN_PROGRESS_CLOSE_TEXT : `⚠️ Barcode (${barcodeCode}) ត្រូវបានផ្លាស់ប្តូរ ឬលុបពីឧបករណ៍ផ្សេង — ស្ថានភាពថ្មីមិនត្រូវបានរក្សាទុក។`);
            return false;
        }
        reconcilePickupDeltaWithServer();
        const collectedSync = reconcileCollectedHistory(itemId, (serverPickupMarks || []).map((mark) => mark.key));
        pickupJournal.finish(collectedSync);
        const collectedSaved = await collectedSync;
        if (!closeIsCurrent()) return false;
        if (!silent && collectedSaved === true) showToast(late
            ? `✅ បណ្តាញត្រឡប់មកវិញ — បាន${actionText}ស្ថានភាព Barcode (${barcodeCode}) ក្នុង Firebase រួចរាល់!`
            : `✅ បាន${actionText}ស្ថានភាព Barcode (${barcodeCode}) ក្នុង Firebase រួចរាល់!`);
        return true;
    };
    const releaseSettle = desiredClosed ? holdCollectedSettle(itemId) : () => {};
    const healCollectedAfterFailure = (error) => {
        if (!error || error.txOutcome === 'not-applied' || !closeIsCurrent()) { releaseSettle(); return undefined; }
        const healed = reconcileCollectedHistory(itemId, [pickupBarcodeKey(barcodeCode)].filter(Boolean));
        void healed.finally(releaseSettle);
        return healed;
    };
    const settleBarcodeClose = (result, late) => settleBarcodeCloseOnce(result, late).finally(releaseSettle);
    let closeTx = null;
    try {
        closeTx = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${itemId}`), (currentItem) => {
            if (!closeIsCurrent()) return;
            serverApplied = false;
            serverPickupMarks = null;
            signedRefused = false;
            restoreHeld = false;
            if (!currentItem) return currentItem;
            if (currentItem.clearClaim) return;
            dropStaleRestoreMarkers(currentItem);
            if (itemHasRestoreMarkers(currentItem)) { restoreHeld = true; return; }
            normalizeBarcodesOf(currentItem);
            if (!currentItem.barcodes || !Array.isArray(currentItem.barcodes)) {
                currentItem.barcodes = [{
                    code: currentItem.barcode,
                    time: currentItem.time,
                    cod: parseFloat(currentItem.cod !== undefined ? currentItem.cod : currentItem.price) || 0,
                    dod: parseFloat(currentItem.dod) || 0,
                    locker: currentItem.locker || "N/A",
                    isClosed: currentItem.isClosed || false,
                    isDeducted: false,
                    isFromDeletion: false,
                    createdAt: currentItem.createdAt || getServerNow()
                }];
            }
            const b = currentItem.barcodes.find(bc => bc.code === barcodeCode);
            if (!b) return currentItem;
            if (opts.expectedSignIdentity !== undefined && barcodeSignIdentity(currentItem, b) !== opts.expectedSignIdentity) return;
            if (!desiredClosed && barcodeZtoSigned(b)) {
                signedRefused = true;
                return;
            }
            const stateUnchanged = !!b.isClosed === !!desiredClosed && (!desiredClosed || typeof b.closedAt === 'number');
            const itemWasClosed = currentItem.isClosed === true && typeof currentItem.closedAt === 'number';
            if (!stateUnchanged) applyBarcodeCloseState(b, desiredClosed, getServerNow());
            const serverPickupKey = pickupBarcodeKey(barcodeCode);
            serverPickupMarks = serverPickupKey ? [{ key: serverPickupKey, phoneKey: getPickupPhoneKey(currentItem), closed: desiredClosed }] : [];
            if (currentItem.scanDate) pickupScanDate = currentItem.scanDate;
            const allClosed = currentItem.barcodes.every(bc => bc.isClosed);
            currentItem.isClosed = allClosed;
            if (allClosed) {
                if (!(stateUnchanged && itemWasClosed)) currentItem.closedAt = getServerNow();
            } else delete currentItem.closedAt;
            if (desiredClosed) {
                delete currentItem.callMark;
                delete currentItem.callMarkTime;
            }
            serverApplied = true;
            return currentItem;
        });
        return settleBarcodeClose(await dbOp(closeTx), false);
    } catch (error) {
        if (!closeIsCurrent()) { releaseSettle(); pickupJournal.finish(); return false; }
        if (dbOpStalled(error) && armLateCommit(closeTx, (lateResult) => settleBarcodeClose(lateResult, true), (lateErr) => {
            if (!closeIsCurrent()) { releaseSettle(); pickupJournal.finish(); return; }
            revertBarcodeCloseLocally();
            pickupJournal.finish(healCollectedAfterFailure(lateErr));
            showToast(`⚠️ បរាជ័យក្នុងការ Save ស្ថានភាព (${barcodeCode}) ទៅ Firebase! ស្ថានភាពត្រូវបានត្រឡប់ដើមវិញ។`);
            if (lateErr && window.ZoeErrors) ZoeErrors.capture(lateErr, { zone: 'money', context: 'toggleIndividualBarcodeClose late transaction failed' });
        }, 'toggleIndividualBarcodeClose')) {
            showToast(`⏳ បណ្តាញឆ្លើយមិនចេញ — ស្ថានភាព (${barcodeCode}) នឹងធ្វើបច្ចុប្បន្នភាពពេលបណ្តាញត្រឡប់មកវិញ។`);
            return;
        }
        console.error("Error toggling barcode close: ", error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: "Error toggling barcode close: " });
        revertBarcodeCloseLocally();
        pickupJournal.finish(healCollectedAfterFailure(error));
        showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! ស្ថានភាពក្នុង App ត្រូវបានត្រឡប់ដើមវិញ។");
        return false;
    }
}

export function openEditBarcodePriceModal(itemId?, code?) {
    uiState.activeParentItemId = itemId;
    uiState.activeEditingBarcode = code;

    const item = dataState.scanHistory.find(i => i.id === itemId);
    if (!item) return;

    let barcodeList = item.barcodes || [{ code: item.barcode, cod: item.cod || 0, dod: item.dod || 0, isDeducted: false }];
    let targetB = barcodeList.find(b => b.code === code);
    let currentCod = targetB ? (parseFloat(targetB.cod) || 0) : 0;
    let currentDod = targetB ? (parseFloat(targetB.dod) || 0) : 0;

    viewState.editBcPcText = domText(code);
    setFieldValue('editBcCodInput', String(currentCod));
    setFieldValue('editBcDodInput', String(currentDod));

    setModalDisplay('viewListModal', 'none');
    openModalHelper('editBarcodePriceModal');
}

export function closeEditBarcodeModal() {
    closeModal('editBarcodePriceModal');
    if (uiState.activeParentItemId) {
        openViewListModal(uiState.activeParentItemId);
    }
}

export function saveEditedBarcodePrice() {

    let newCod = Math.round((parseFloat(fieldValue('editBcCodInput')) || 0) * 100) / 100;
    let newDod = Math.round((parseFloat(fieldValue('editBcDodInput')) || 0) * 100) / 100;
    if (!Number.isFinite(newCod) || newCod < 0) newCod = 0;
    if (!Number.isFinite(newDod) || newDod < 0) newDod = 0;

    const item = dataState.scanHistory.find(i => i.id === uiState.activeParentItemId);
    if (item) {
        if (!item.barcodes || !Array.isArray(item.barcodes)) {
            item.barcodes = [{ code: item.barcode, time: item.time, cod: parseFloat(item.cod) || 0, dod: parseFloat(item.dod) || 0, locker: item.locker || "N/A", isClosed: item.isClosed || false, isDeducted: false, isFromDeletion: false, createdAt: item.createdAt || getServerNow() }];
        }

        let targetB = item.barcodes.find(b => b.code === uiState.activeEditingBarcode);
        if (targetB) {
            let oldCod = parseFloat(targetB.cod) || 0;
            let oldDod = parseFloat(targetB.dod) || 0;

            let codDiff = (Math.round(newCod * 100) - Math.round(oldCod * 100)) / 100;
            let dodDiff = (Math.round(newDod * 100) - Math.round(oldDod * 100)) / 100;

            const editedItemId = item.id;
            const editedBarcodeCode = uiState.activeEditingBarcode;
            const editedAuthGeneration = firebaseState.authGeneration;
            const editedDatabase = firebaseState.db;
            const editIsCurrent = () => editedAuthGeneration === firebaseState.authGeneration && editedDatabase === firebaseState.db;
            let serverOldCod = null;
            let serverOldDod = null;
            let serverApplied = false;
            let restoreClaimBlocked = false;

            const applyEditedPriceTo = (target) => {
                serverApplied = false;
                serverOldCod = null;
                serverOldDod = null;
                normalizeBarcodesOf(target);
                if (!target.barcodes || !Array.isArray(target.barcodes)) {
                    target.barcodes = [{
                        code: target.barcode,
                        time: target.time,
                        cod: parseFloat(target.cod !== undefined ? target.cod : target.price) || 0,
                        dod: parseFloat(target.dod) || 0,
                        locker: target.locker || "N/A",
                        isClosed: target.isClosed || false,
                        isDeducted: false,
                        isFromDeletion: false,
                        createdAt: target.createdAt || getServerNow()
                    }];
                }
                const b = target.barcodes.find(bc => bc && bc.code === editedBarcodeCode);
                if (!b) return target;
                serverOldCod = parseFloat(b.cod) || 0;
                serverOldDod = parseFloat(b.dod) || 0;
                b.cod = newCod;
                b.dod = newDod;
                recalcItemMoneyFromBarcodes(target);
                serverApplied = true;
                return target;
            };

            applyEditedPriceTo(item);

            const revenueScanDate = item.scanDate || getFormattedDate();
            const revenueApplied = (codDiff !== 0 || dodDiff !== 0);
            let editRevenueApplied = null;
            if (revenueApplied) {
                editRevenueApplied = addRevenueToDailyAndMonthlyRecord(revenueScanDate, codDiff, dodDiff, 0, ledgerDeltaCompanion(editedItemId, editedBarcodeCode, newCod, newDod, oldCod, oldDod));
            }

            serverApplied = false;
            if (!firebaseState.db || !firebaseState.fb || !/^[a-zA-Z0-9_-]+$/.test(String(editedItemId || ''))) {
                revertRevenueLedgerDelta(editRevenueApplied);
                editRevenueApplied = null;
                targetB.cod = oldCod;
                targetB.dod = oldDod;
                recalcItemMoneyFromBarcodes(item);
                refreshCurrentHistoryView();
                closeModal('editBarcodePriceModal');
                openViewListModal(item.id);
                showToast("⚠️ មិនទាន់ភ្ជាប់ Firebase ទេ! ការកែទឹកប្រាក់មិនត្រូវបានរក្សាទុកទេ។");
                return;
            }
            const revertEditedPriceLocally = () => {
                const staleItem = dataState.scanHistory.find(i => i.id === editedItemId);
                const staleB = staleItem && Array.isArray(staleItem.barcodes)
                    ? staleItem.barcodes.find(b => b.code === editedBarcodeCode)
                    : null;
                if (!staleB) return;
                staleB.cod = oldCod;
                staleB.dod = oldDod;
                recalcItemMoneyFromBarcodes(staleItem);
                refreshCurrentHistoryView();
            };
            const undoEditedPriceRevenue = () => {
                revertRevenueLedgerDelta(editRevenueApplied);
                editRevenueApplied = null;
            };
            const settleEditedPrice = (result) => {
                if (!editIsCurrent()) return;
                const committed = !!(result && result.committed);
                if (!committed || !serverApplied) {
                    undoEditedPriceRevenue();
                    revertEditedPriceLocally();
                    showToast(restoreClaimBlocked
                        ? "⏳ កញ្ចប់នេះកំពុងស្តារ — សូមរង់ចាំឲ្យចប់ រួចសាកកែទឹកប្រាក់ម្តងទៀត។"
                        : committed
                        ? "⚠️ កញ្ចប់នេះលែងមានក្នុងប្រព័ន្ធទៀតហើយ! ទឹកប្រាក់មិនត្រូវបានកែទេ។"
                        : "⚠️ កែប្រែទឹកប្រាក់មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
                    return;
                }
                const collectedSync = syncCollectedValueForBarcode(editedItemId, editedBarcodeCode);
                const actualCodDiff = (Math.round(newCod * 100) - Math.round(serverOldCod * 100)) / 100;
                const actualDodDiff = (Math.round(newDod * 100) - Math.round(serverOldDod * 100)) / 100;
                Promise.all([correctRevenueLedgerToActual(revenueScanDate, editRevenueApplied, actualCodDiff, actualDodDiff, 0), collectedSync]).then(([status, collectedSaved]) => {
                    if (!editIsCurrent()) return;
                    if (status && status.ok && collectedSaved === 'pending') return;
                    if (status && status.ok && collectedSaved !== null) {
                        showToast("✅ បានកែប្រែទឹកប្រាក់តាមកញ្ចប់ជោគជ័យ!");
                        return;
                    }
                    const ledgerErr = new Error('Edited price revenue reconciliation did not commit');
                    if (window.ZoeErrors) ZoeErrors.capture(ledgerErr, { zone: 'money', context: 'saveEditedBarcodePrice ledger reconciliation', itemId: editedItemId });
                    showToast("⚠️ តម្លៃកញ្ចប់បានរក្សាទុក ប៉ុន្តែស្ថិតិប្រាក់មិនទាន់ Sync ពេញលេញទេ! សូមប្រាប់ Admin។");
                }, (ledgerErr) => {
                    if (!editIsCurrent()) return;
                    if (window.ZoeErrors) ZoeErrors.capture(ledgerErr, { zone: 'money', context: 'saveEditedBarcodePrice ledger reconciliation', itemId: editedItemId });
                    showToast("⚠️ តម្លៃកញ្ចប់បានរក្សាទុក ប៉ុន្តែស្ថិតិប្រាក់មិនទាន់ Sync ពេញលេញទេ! សូមប្រាប់ Admin។");
                });
                editRevenueApplied = null;
                showToast("⏳ តម្លៃកញ្ចប់បានរក្សាទុក — កំពុងផ្ទៀងផ្ទាត់ស្ថិតិប្រាក់…");
            };
            const failEditedPrice = (err) => {
                if (!editIsCurrent()) return;
                undoEditedPriceRevenue();
                revertEditedPriceLocally();
                refreshCurrentHistoryView();
                if (modalIsOpen('viewListModal')) openViewListModal(editedItemId);
                showToast("⚠️ កែប្រែទឹកប្រាក់មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
                if (err && window.ZoeErrors) ZoeErrors.capture(err, { zone: 'money', context: 'saveEditedBarcodePrice transaction failed' });
            };
            const priceTx = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${editedItemId}`), (currentItem) => {
                serverApplied = false;
                restoreClaimBlocked = false;
                if (!currentItem) return currentItem;
                if (currentItem.clearClaim) return;
                if (itemHasRestoreMarkers(currentItem)) {
                    restoreClaimBlocked = true;
                    return;
                }
                return applyEditedPriceTo(currentItem);
            });
            dbOp(priceTx).then(settleEditedPrice, (error) => {
                if (!editIsCurrent()) return;
                if (dbOpStalled(error) && armLateCommit(priceTx, settleEditedPrice, (lateErr, lateResult) => {
                    if (lateResult) { settleEditedPrice(lateResult); return; }
                    failEditedPrice(lateErr);
                }, 'saveEditedBarcodePrice')) {
                    showToast("⏳ បណ្តាញឆ្លើយមិនចេញ — ការកែទឹកប្រាក់នឹងបញ្ចប់ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ។ សូមកុំកែម្ដងទៀត។");
                    return;
                }
                failEditedPrice(error);
            }).catch((postErr) => {
                console.error('saveEditedBarcodePrice post-transaction handler failed: ', postErr);
                if (window.ZoeErrors) ZoeErrors.capture(postErr, { zone: 'money', context: 'saveEditedBarcodePrice post-transaction handler' });
            });
            refreshCurrentHistoryView();
        }

        closeModal('editBarcodePriceModal');
        openViewListModal(item.id);
    } else {
        closeModal('editBarcodePriceModal');
    }
}
