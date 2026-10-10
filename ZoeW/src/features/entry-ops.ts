import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { domText, viewState } from '../core/view-state';
import { dataState, firebaseState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { normalizeStoredPhone } from '../core/text';
import { getFormattedDate } from '../core/timezone';
import { applyBarcodeCloseState, dropStaleRestoreMarkers, itemHasRestoreMarkers, normalizeBarcodesOf, stripHistoryOnlyMarkers } from '../domain/barcode';
import { claimCleanupTrashSlot, restoreClaimedItemToScanHistory } from '../domain/cleanup';
import { reapplyPickupMarks, reconcileCollectedHistory, revertPickupMarks } from '../domain/collected';
import { collectPickupMarks, getPickupPhoneKey, markPickupBarcodes, reconstructPickupSet } from '../domain/pickup';
import { noteAppLockExcuse } from './app-lock';
import { applyCurrentFilter } from './monthly-report';
import { TRASH_WRITE_SLOW_NOTICE_MS } from './session';
import { updateRecentPhonesList } from '../services/db-listeners';
import { patchHistoryItemFields } from '../services/history-write';
import { armLateCommit, dbOp, dbOpStalled, notifyIfSlow, retryAsync } from '../services/network';
import { refreshCurrentHistoryView, scheduleHistoryViewRefresh } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export function handleCallAction(id?) {
    noteAppLockExcuse();
    const item = dataState.scanHistory.find(i => i.id === id);
    if (item) {
        const patchFields: any = { isCalled: true };
        const previousFields: any = { isCalled: item.isCalled };
        if (item.callMark === 'no-answer' || item.callMark === 'no-connect') {
            previousFields.callMarkTime = item.callMarkTime;
            item.callMarkTime = getServerNow();
            patchFields.callMarkTime = item.callMarkTime;
        }
        item.isCalled = true;
        patchHistoryItemFields(item, patchFields, previousFields, null, { retryOnDisconnect: true });
        scheduleHistoryViewRefresh();
    }
}

export function openCallMarkModal(id?) {
    uiState.markingItemId = id;
    const item = dataState.scanHistory.find(i => i.id === id);
    if (!item) return;

    viewState.callMarkPhoneText = domText(item.phone);

    openModalHelper('callMarkModal');
}

export function setCallMark(mark?) {
    const item = dataState.scanHistory.find(i => i.id === uiState.markingItemId);
    let savePromise = null;
    if (item) {
        if (!firebaseState.dbRefHistory || !firebaseState.db || !firebaseState.fb) {
            showToast('⚠️ មិនទាន់ភ្ជាប់ Firebase ទេ — ការសម្គាល់មិនត្រូវបានផ្លាស់ប្តូរ។');
            return Promise.resolve(false);
        }
        const prevCallMark = item.callMark;
        const prevCallMarkTime = item.callMarkTime;
        const committedToast = mark
            ? '✅ បានសម្គាល់ និងរក្សាទុកទៅ Firebase រួចរាល់!'
            : '✅ បានសម្អាតការសម្គាល់ពី Firebase រួចរាល់!';
        if (mark) {
            item.callMark = mark;
            item.callMarkTime = getServerNow();
            savePromise = patchHistoryItemFields(item, { callMark: mark, callMarkTime: item.callMarkTime }, { callMark: prevCallMark, callMarkTime: prevCallMarkTime }, null, { retryOnDisconnect: true, queuedSuccessToast: committedToast });
        } else {
            delete item.callMark;
            delete item.callMarkTime;
            savePromise = patchHistoryItemFields(item, { callMark: null, callMarkTime: null }, { callMark: prevCallMark, callMarkTime: prevCallMarkTime }, null, { retryOnDisconnect: true, queuedSuccessToast: committedToast });
        }
        refreshCurrentHistoryView();
    }
    closeModal('callMarkModal');
    if (!savePromise) return Promise.resolve(false);
    return Promise.resolve(savePromise).then((saved) => {
        if (saved === 'pending') return saved;
        if (saved === 'queued') {
            showToast('⏳ ការសម្គាល់បានចូលជួររង់ចាំ — នឹងរក្សាទុកទៅ Firebase ពេលបណ្តាញត្រឡប់មកវិញ។');
            return saved;
        }
        if (saved) showToast(mark ? '✅ បានសម្គាល់ និងរក្សាទុកទៅ Firebase រួចរាល់!' : '✅ បានសម្អាតការសម្គាល់ពី Firebase រួចរាល់!');
        return saved;
    });
}

export function openEditModal(id?) {
    uiState.editingItemId = id;
    const item = dataState.scanHistory.find(i => i.id === id);
    if(!item) return;

    viewState.editModalBarcodeText = domText(item.barcode);
    setFieldValue('editPhoneInput', item.phone === "គ្មានលេខ" ? "" : item.phone);

    openModalHelper('editPhoneModal');

    setTimeout(() => {
        focusField('editPhoneInput');
    }, 150);
}

export function saveEditedPhone() {
    let newPhone = normalizeStoredPhone(fieldValue('editPhoneInput'));
    if (!newPhone) {
        newPhone = "គ្មានលេខ";
    }

    const item = dataState.scanHistory.find(i => i.id === uiState.editingItemId);
    if (item) {
        if (!firebaseState.dbRefHistory || !firebaseState.db || !firebaseState.fb) {
            showToast('⚠️ មិនទាន់ភ្ជាប់ Firebase ទេ — លេខទូរស័ព្ទមិនត្រូវបានផ្លាស់ប្តូរ។');
            return Promise.resolve(false);
        }
        const phoneAuthGeneration = firebaseState.authGeneration;
        const phoneDatabase = firebaseState.db;
        const phoneSaveIsCurrent = () => phoneAuthGeneration === firebaseState.authGeneration && phoneDatabase === firebaseState.db;
        const prevPhone = item.phone;
        const patchFields: any = { phone: newPhone };
        const previousFields: any = { phone: prevPhone };
        if (newPhone !== prevPhone && item.callMark === 'wrong-number') {
            previousFields.callMark = item.callMark;
            previousFields.callMarkTime = item.callMarkTime;
            previousFields.isCalled = item.isCalled;
            delete item.callMark;
            delete item.callMarkTime;
            item.isCalled = false;
            patchFields.callMark = null;
            patchFields.callMarkTime = null;
            patchFields.isCalled = false;
        }
        const prevPickupKey = getPickupPhoneKey(item);
        const pickupDate = item.scanDate || getFormattedDate();
        const pickupSeed = reconstructPickupSet(pickupDate);
        item.phone = newPhone;
        const nextPickupKey = getPickupPhoneKey(item);
        let pickupMoved = null;
        const closedPickupMarks = (source) => collectPickupMarks(source, undefined, nextPickupKey).filter((mark) => mark.closed);
        const applyPickupRefMove = (source) => {
            const marks = closedPickupMarks(source);
            if (!marks.length) return;
            pickupMoved = markPickupBarcodes(pickupDate, marks, pickupSeed);
        };
        if (prevPickupKey !== nextPickupKey) applyPickupRefMove(item);
        const revertPickupRefMove = () => {
            if (!phoneSaveIsCurrent()) return;
            if (!pickupMoved) return;
            revertPickupMarks(pickupMoved);
            pickupMoved = null;
        };
        let serverPickupSource = null;
        const reconcilePickupRefWithServer = () => {
            if (!serverPickupSource || prevPickupKey === nextPickupKey) return;
            pickupMoved = reapplyPickupMarks(pickupMoved, closedPickupMarks(serverPickupSource), pickupDate, pickupSeed);
        };
        const settlePhoneSave = (saved) => {
            if (!phoneSaveIsCurrent()) return;
            if (saved) {
                reconcilePickupRefWithServer();
                showToast('✅ កែប្រែលេខទូរស័ព្ទ និងរក្សាទុកទៅ Firebase រួចរាល់!');
            } else {
                revertPickupRefMove();
                updateRecentPhonesList();
                applyCurrentFilter();
            }
        };
        const phoneSavePromise = patchHistoryItemFields(item, patchFields, previousFields, (serverItem) => {
            serverPickupSource = serverItem;
        }, { onLateSettled: settlePhoneSave }).then((saved) => {
            if (!phoneSaveIsCurrent()) return false;
            if (saved !== 'pending') settlePhoneSave(saved);
            return saved;
        }, revertPickupRefMove).catch((postErr) => {
            console.error('saveEditedPhone post-patch handler failed: ', postErr);
            if (window.ZoeErrors) ZoeErrors.capture(postErr, { zone: 'data', context: 'saveEditedPhone post-patch handler' });
            return false;
        });
        updateRecentPhonesList();
        setFieldValue('searchPhoneInput', '');
        applyCurrentFilter();
        closeModal('editPhoneModal');
        return phoneSavePromise;
    }

    closeModal('editPhoneModal');
    return Promise.resolve(false);
}

export async function toggleCloseStatus(id?) {
    const closeAuthGeneration = firebaseState.authGeneration;
    const closeDatabase = firebaseState.db;
    const closeIsCurrent = () => closeAuthGeneration === firebaseState.authGeneration && closeDatabase === firebaseState.db;
    const item = dataState.scanHistory.find(i => i.id === id);
    if (!item) return;
    const actionText = item.isClosed ? "បើក" : "បិទ";
    const desiredClosed = !item.isClosed;
    if (!confirm(`តើអ្នកប្រាកដជាចង់${actionText}បញ្ជីនេះមែនទេ?`)) return;
    if (!firebaseState.db || !firebaseState.fb || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        showToast('⚠️ មិនទាន់ភ្ជាប់ Firebase ឬ ID មិនត្រឹមត្រូវ — ស្ថានភាពបញ្ជីមិនត្រូវបានផ្លាស់ប្តូរ។');
        return false;
    }

    const freshItem = dataState.scanHistory.find(i => i.id === id);
    const previousState = freshItem
        ? { isClosed: freshItem.isClosed, closedAt: freshItem.closedAt, callMark: freshItem.callMark, callMarkTime: freshItem.callMarkTime, barcodeStates: freshItem.barcodes ? freshItem.barcodes.map(b => b.isClosed) : null, barcodeCloseStamps: freshItem.barcodes ? freshItem.barcodes.map(b => b.closedAt) : null }
        : null;
    let pickupPhoneKey = null;
    let pickupScanDate = null;
    let pickupSeed = null;
    let pickupApplied = null;
    let serverApplied = false;
    let serverPickupMarks = null;
    const reconcilePickupDeltaWithServer = () => {
        if (!serverPickupMarks) return;
        pickupApplied = reapplyPickupMarks(pickupApplied, serverPickupMarks, pickupScanDate, pickupSeed);
        refreshCurrentHistoryView();
    };
    if (freshItem) {
        pickupScanDate = freshItem.scanDate || getFormattedDate();
        pickupSeed = reconstructPickupSet(pickupScanDate);
        freshItem.isClosed = desiredClosed;
        if (desiredClosed) {
            freshItem.closedAt = getServerNow();
            delete freshItem.callMark;
            delete freshItem.callMarkTime;
            if (freshItem.barcodes && Array.isArray(freshItem.barcodes)) freshItem.barcodes.forEach(b => applyBarcodeCloseState(b, true, getServerNow()));
        } else {
            delete freshItem.closedAt;
            if (freshItem.barcodes && Array.isArray(freshItem.barcodes)) freshItem.barcodes.forEach(b => applyBarcodeCloseState(b, false));
        }

        pickupPhoneKey = getPickupPhoneKey(freshItem);
        pickupApplied = markPickupBarcodes(pickupScanDate, collectPickupMarks(freshItem, desiredClosed, pickupPhoneKey), pickupSeed);

        refreshCurrentHistoryView();
    }

    const revertCloseLocally = () => {
        if (!closeIsCurrent()) return;
        if (previousState) {
            const revertItem = dataState.scanHistory.find(i => i.id === id);
            if (revertItem) {
                revertItem.isClosed = previousState.isClosed;
                if (previousState.closedAt !== undefined) revertItem.closedAt = previousState.closedAt;
                else delete revertItem.closedAt;
                if (previousState.callMark !== undefined) revertItem.callMark = previousState.callMark;
                else delete revertItem.callMark;
                if (previousState.callMarkTime !== undefined) revertItem.callMarkTime = previousState.callMarkTime;
                else delete revertItem.callMarkTime;
                if (previousState.barcodeStates && revertItem.barcodes && Array.isArray(revertItem.barcodes)) {
                    revertItem.barcodes.forEach((b, i) => {
                        if (previousState.barcodeStates[i] === undefined) return;
                        b.isClosed = previousState.barcodeStates[i];
                        const stamp = previousState.barcodeCloseStamps ? previousState.barcodeCloseStamps[i] : undefined;
                        if (stamp !== undefined) b.closedAt = stamp;
                        else delete b.closedAt;
                    });
                }
                refreshCurrentHistoryView();
            }
        }
        if (pickupApplied) {
            revertPickupMarks(pickupApplied);
            pickupApplied = null;
        }
    };
    const settleClose = async (closeResult, late) => {
        if (!closeIsCurrent()) return false;
        if (!serverApplied || !(closeResult && closeResult.committed)) {
            revertCloseLocally();
            showToast('⚠️ បញ្ជីនេះត្រូវបានផ្លាស់ប្តូរ ឬលុបពីឧបករណ៍ផ្សេង — ស្ថានភាពថ្មីមិនត្រូវបានរក្សាទុក។');
            return false;
        }
        reconcilePickupDeltaWithServer();
        const collectedSaved = await reconcileCollectedHistory(id, (serverPickupMarks || []).map((mark) => mark.key));
        if (!closeIsCurrent()) return false;
        if (collectedSaved === true) showToast(late
            ? `✅ បណ្តាញត្រឡប់មកវិញ — បាន${actionText}ស្ថានភាពបញ្ជីក្នុង Firebase រួចរាល់!`
            : `✅ បាន${actionText}ស្ថានភាពបញ្ជីក្នុង Firebase រួចរាល់!`);
        return true;
    };
    let closeTx = null;
    try {
        closeTx = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`), (currentItem) => {
            if (!closeIsCurrent()) return;
            serverApplied = false;
            serverPickupMarks = null;
            if (!currentItem) return currentItem;
            if (currentItem.clearClaim) return;
            dropStaleRestoreMarkers(currentItem);
            normalizeBarcodesOf(currentItem);
            const serverBarcodes = (currentItem.barcodes && Array.isArray(currentItem.barcodes)) ? currentItem.barcodes : null;
            serverPickupMarks = collectPickupMarks(currentItem, desiredClosed, getPickupPhoneKey(currentItem));
            if (currentItem.scanDate) pickupScanDate = currentItem.scanDate;
            currentItem.isClosed = desiredClosed;
            if (desiredClosed) {
                currentItem.closedAt = getServerNow();
                delete currentItem.callMark;
                delete currentItem.callMarkTime;
                if (serverBarcodes) serverBarcodes.forEach(b => applyBarcodeCloseState(b, true, getServerNow()));
            } else {
                delete currentItem.closedAt;
                if (serverBarcodes) serverBarcodes.forEach(b => applyBarcodeCloseState(b, false));
            }
            serverApplied = true;
            return currentItem;
        });
        return settleClose(await dbOp(closeTx), false);
    } catch (error) {
        if (!closeIsCurrent()) return false;
        if (dbOpStalled(error) && armLateCommit(closeTx, (lateResult) => settleClose(lateResult, true), (lateErr) => {
            if (!closeIsCurrent()) return;
            revertCloseLocally();
            showToast("⚠️ បរាជ័យក្នុងការ Save ស្ថានភាពបញ្ជីទៅ Firebase! ស្ថានភាពត្រូវបានត្រឡប់ដើមវិញ។");
            if (lateErr && window.ZoeErrors) ZoeErrors.capture(lateErr, { zone: 'money', context: 'toggleCloseStatus late transaction failed' });
        }, 'toggleCloseStatus')) {
            showToast("⏳ បណ្តាញឆ្លើយមិនចេញ — ស្ថានភាពបញ្ជីនឹងធ្វើបច្ចុប្បន្នភាពពេលបណ្តាញត្រឡប់មកវិញ។");
            return;
        }
        console.error("Error toggling close status: ", error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: "Error toggling close status: " });
        revertCloseLocally();
        showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! ស្ថានភាពក្នុង App ត្រូវបានត្រឡប់ដើមវិញ។");
        return false;
    }
}

export async function deleteSingleItem(id, opts?) {
    const quiet = !!(opts && opts.quiet);
    const say = (message) => { if (!quiet) showToast(message); };
    const index = dataState.scanHistory.findIndex(i => i.id === id);
    if (index === -1) return 'missing';

    if (!(opts && opts.confirmed) && !confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?`)) return 'cancelled';

    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        const idErr = new Error('Unsafe id during deleteSingleItem');
        console.error(idErr.message, id);
        if (window.ZoeErrors) ZoeErrors.capture(idErr, { zone: 'data', context: 'deleteSingleItem' });
        say("⚠️ លុបមិនបានជោគជ័យ! (ID មិនត្រឹមត្រូវ)");
        return 'failed';
    }

    const deleteDb = firebaseState.db;
    const deleteGeneration = firebaseState.authGeneration;
    const deleteIsCurrent = () => firebaseState.db === deleteDb && firebaseState.authGeneration === deleteGeneration;
    let claimedWhole = null;
    let clearClaimBlocked = false;
    let restoreClaimBlocked = false;
    const deleteUpdater = (currentItem) => {
        claimedWhole = null;
        clearClaimBlocked = false;
        restoreClaimBlocked = false;
        if (!currentItem) return currentItem;
        if (currentItem.clearClaim) {
            clearClaimBlocked = true;
            return currentItem;
        }
        if (itemHasRestoreMarkers(currentItem)) {
            restoreClaimBlocked = true;
            return;
        }
        normalizeBarcodesOf(currentItem);
        claimedWhole = currentItem;
        return null;
    };
    const finishDelete = async (result, late) => {
        if (!deleteIsCurrent()) {
            if (claimedWhole && window.ZoeErrors) ZoeErrors.capture(new Error('Delete stopped after a database switch'), { zone: 'data', context: 'deleteSingleItem session switch', itemId: id });
            return 'stale';
        }
        if (!claimedWhole) {
            if (!clearClaimBlocked) {
                const staleIdx = dataState.scanHistory.findIndex(i => i.id === id);
                if (staleIdx !== -1) dataState.scanHistory.splice(staleIdx, 1);
            }
            refreshCurrentHistoryView();
            updateRecentPhonesList();
            say(clearClaimBlocked ? "⚠️ ធាតុនេះកំពុងត្រូវបានលុបជាក្រុមដោយសុវត្ថិភាព។ សូមរង់ចាំបន្តិច។" : "⚠️ ទិន្នន័យនេះត្រូវបានលុបដោយឧបករណ៍ផ្សេងរួចហើយ!");
            return clearClaimBlocked ? 'blocked' : 'missing';
        }

        const localIdx = dataState.scanHistory.findIndex(i => i.id === id);
        if (localIdx !== -1) dataState.scanHistory.splice(localIdx, 1);

        const removed = stripHistoryOnlyMarkers({ ...claimedWhole, id });
        removed.deletedAt = getServerNow();
        removed.isFromDeletion = true;
        removed.trashReason = 'delete';
        if (Array.isArray(removed.barcodes)) {
            removed.barcodes = removed.barcodes.map(b => ({ ...b, isFromDeletion: true }));
        }

        dataState.deletedItems.unshift(removed);
        refreshCurrentHistoryView();
        updateRecentPhonesList();

        let trashSaved = false;
        await notifyIfSlow(retryAsync(() => claimCleanupTrashSlot(removed), 4, 1500),
            TRASH_WRITE_SLOW_NOTICE_MS,
            "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរក្សាទុកការលុប… សូមកុំបិទ App។").then(() => {
            trashSaved = true;
        }).catch(async (trashErr) => {
            const staleIdx = dataState.deletedItems.findIndex(i => i.id === removed.id);
            if (staleIdx !== -1) dataState.deletedItems.splice(staleIdx, 1);
            console.error('Trash write permanently failed for deleteSingleItem of', id, trashErr);
            if (window.ZoeErrors) ZoeErrors.capture(trashErr, { zone: 'data', context: 'deleteSingleItem trash write failed after retries', itemId: id });
            if (!deleteIsCurrent()) return;
            let restoredItem = null;
            let restoreOk = false;
            try {
                const restoreResult = await restoreClaimedItemToScanHistory(id, claimedWhole, null);
                restoredItem = (restoreResult && restoreResult.snapshot) ? restoreResult.snapshot.val() : null;
                restoreOk = true;
            } catch (restoreErr) {
                console.error('Failed to restore item to scan history after trash write failure for', id, restoreErr);
                if (window.ZoeErrors) ZoeErrors.capture(restoreErr, { zone: 'data', context: 'deleteSingleItem restore-after-trash-failure also failed', itemId: id });
                showToast('⚠️ បញ្ហាធ្ងន់ធ្ងរ៖ ទិន្នន័យ ' + id + ' អាចនឹងបាត់! សូមប្រាប់ Admin ត្រួតពិនិត្យភ្លាមៗ');
            }
            if (restoreOk) {
                refreshCurrentHistoryView();
                updateRecentPhonesList();
                say("⚠️ លុបមិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
            }
        });
        if (!trashSaved) return 'failed';
        if (!deleteIsCurrent()) return 'stale';
        if (late) showToast("✅ បណ្តាញត្រឡប់មកវិញ — បានលុបទៅធុងសំរាមបណ្តោះអាសន្ន!");
        else say("✅ បានលុបទៅធុងសំរាមបណ្តោះអាសន្ន!");
        return 'deleted';
    };
    try {
        const deleteTx = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`), deleteUpdater);
        let result;
        try {
            result = await dbOp(deleteTx);
        } catch (txError) {
            if (dbOpStalled(txError)) {
                armLateCommit(deleteTx, (late) => finishDelete(late, true), (lateErr) => {
                    refreshCurrentHistoryView();
                    updateRecentPhonesList();
                    showToast(restoreClaimBlocked
                        ? "⏳ កញ្ចប់នេះកំពុងស្តារ — សូមរង់ចាំឲ្យចប់ រួចសាកលុបម្តងទៀត។"
                        : "⚠️ លុបមិនបានជោគជ័យ! សូមសាកល្បងម្តងទៀត។");
                    if (lateErr && window.ZoeErrors) ZoeErrors.capture(lateErr, { zone: 'data', context: 'deleteSingleItem late transaction failed', itemId: id });
                }, 'deleteSingleItem');
                say("⏳ បណ្តាញឆ្លើយមិនចេញ — ការលុបនឹងបញ្ចប់ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ។ សូមកុំលុបម្ដងទៀត។");
                return 'pending';
            }
            throw txError;
        }
        if (!result || !result.committed) {
            if (restoreClaimBlocked) {
                say("⏳ កញ្ចប់នេះកំពុងស្តារ — សូមរង់ចាំឲ្យចប់ រួចសាកលុបម្តងទៀត។");
                return 'blocked';
            }
            throw new Error('Delete item transaction was not committed');
        }
        return await finishDelete(result, false);
    } catch (e) {
        console.error("Error deleting single item: ", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'data', context: "Error deleting single item: " });
        refreshCurrentHistoryView();
        updateRecentPhonesList();
        say("⚠️ ការលុបមិនបានបញ្ចប់ទេ — មិនអាចបញ្ជាក់ថាទិន្នន័យបានផ្លាស់ប្តូរឡើយ។ សូមរង់ចាំ Sync រួចសាកល្បងម្តងទៀត។");
        return 'failed';
    }
}
