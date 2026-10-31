import { captureTrashGenerationOwner, trashGenerationOwnerCurrent } from '../services/trash-generation';
import { rowOperationActive } from '../services/row-operation-lock';
import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { domText, viewState } from '../core/view-state';
import { dataState, firebaseState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { RESTORE_IN_PROGRESS_CLOSE_TEXT, TRASH_FINAL_CONFIRM_NOTE, ZTO_SIGNED_REOPEN_TEXT, normalizeStoredPhone } from '../core/text';
import { getFormattedDate } from '../core/timezone';
import { applyBarcodeCloseState, barcodeEntriesOf, barcodeZtoSigned, itemHasRestoreMarkers, normalizeBarcodesOf, stampTrashPolicy, stripHistoryOnlyMarkers, trashEntryIsFinal } from '../domain/barcode';
import { getManualZtoTrashMode } from './lookup-config';
import { CLEANUP_STAGE_SLOT, cleanupAdmissionMatches, prepareCleanupTrashGeneration, cleanupInFlight, beginCleanupOperation, releaseCleanupOperation, clearCleanupJournalEntry, claimCleanupTrashSlot, markCleanupJournalLive, noteCleanupJournalEntry, patchCleanupJournalEntry, readCleanupJournal, restoreClaimedItemToScanHistory } from '../domain/cleanup';
import { healPickupKeysLeftRow, holdCollectedSettle, reapplyPickupMarks, reconcileCollectedHistory, revertPickupMarks } from '../domain/collected';
import { beginTrashClaim, claimTrashBarcodes, trashClaimOwned } from '../domain/trash-claim';
import { collectPickupMarks, getPickupPhoneKey, markPickupBarcodes, pickupBarcodeKey, pickupIntentTracker, preparePickupClose, failPickupClose } from '../domain/pickup';
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
    if (rowOperationActive(item)) { showToast('⏳ កញ្ចប់នេះកំពុងផ្ទៀងប្រាក់ — សូមរង់ចាំប្រតិបត្តិការបញ្ចប់។'); return; }
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
    if (rowOperationActive(item)) { showToast('⏳ កញ្ចប់នេះកំពុងផ្ទៀងប្រាក់ — សូមរង់ចាំប្រតិបត្តិការបញ្ចប់។'); return; }
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

export async function saveEditedPhone() {
    let newPhone = normalizeStoredPhone(fieldValue('editPhoneInput'));
    if (!newPhone) {
        newPhone = "គ្មានលេខ";
    }

    const item = dataState.scanHistory.find(i => i.id === uiState.editingItemId);
    if (rowOperationActive(item)) { showToast('⏳ កញ្ចប់នេះកំពុងផ្ទៀងប្រាក់ — សូមរង់ចាំប្រតិបត្តិការបញ្ចប់។'); return; }
    if (item) {
        if (!firebaseState.dbRefHistory || !firebaseState.db || !firebaseState.fb) {
            showToast('⚠️ មិនទាន់ភ្ជាប់ Firebase ទេ — លេខទូរស័ព្ទមិនត្រូវបានផ្លាស់ប្តូរ។');
            return Promise.resolve(false);
        }
        const phoneAuthGeneration = firebaseState.authGeneration;
        const phoneDatabase = firebaseState.db;
        const phoneSaveIsCurrent = () => phoneAuthGeneration === firebaseState.authGeneration && phoneDatabase === firebaseState.db;
        const phonePickupJournal = pickupIntentTracker(phoneSaveIsCurrent, item.id);
        const phonePickupKeys = collectPickupMarks(item).map((mark) => mark.key);
        const phonePickupContext = phonePickupKeys.length ? await phonePickupJournal.prepare(item.scanDate || getFormattedDate(), phonePickupKeys, true) : null;
        if (!phoneSaveIsCurrent() || phonePickupKeys.length && (!phonePickupContext || !phonePickupJournal.start())) { phonePickupJournal.release(); return false; }
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
        item.phone = newPhone;
        const nextPickupKey = getPickupPhoneKey(item);
        let pickupMoved = null;
        const closedPickupMarks = (source) => collectPickupMarks(source, undefined, nextPickupKey).filter((mark) => mark.closed);
        const applyPickupRefMove = (source) => {
            const marks = closedPickupMarks(source);
            if (!marks.length) return;
            pickupMoved = markPickupBarcodes(pickupDate, marks, true, phonePickupContext);
            phonePickupJournal.note(pickupMoved);
        };
        if (prevPickupKey !== nextPickupKey) applyPickupRefMove(item);
        const revertPickupRefMove = () => {
            if (!phoneSaveIsCurrent()) return;
            if (!pickupMoved) return;
            phonePickupJournal.note(revertPickupMarks(pickupMoved, null, true));
            pickupMoved = null;
        };
        let serverPickupSource = null;
        let serverPickupKey = null;
        const reconcilePickupRefWithServer = () => {
            if (!serverPickupSource || (prevPickupKey === nextPickupKey && serverPickupKey === nextPickupKey)) return;
            pickupMoved = reapplyPickupMarks(pickupMoved || { context: phonePickupContext }, closedPickupMarks(serverPickupSource), pickupDate, true);
            phonePickupJournal.note(pickupMoved);
        };
        const settlePhoneSave = async (saved) => {
            if (!phoneSaveIsCurrent()) { phonePickupJournal.release(); return; }
            if (saved) {
                phonePickupJournal.confirm([]);
                reconcilePickupRefWithServer();
                const pickupUnchanged = !pickupMoved && saved && typeof saved === 'object' && saved.id === item.id
                    && saved.scanDate === pickupDate && saved.phone === newPhone && Number.isFinite(saved.createdAt)
                    && saved.createdAt > 0 && saved.createdAt === item.createdAt && Array.isArray(saved.barcodes)
                    && saved.barcodes.length > 0 && closedPickupMarks(saved).length === 0;
                const pickupSaved = await phonePickupJournal.finish(pickupUnchanged ? true : undefined);
                if (phoneSaveIsCurrent()) showToast(pickupSaved ? '✅ កែប្រែលេខទូរស័ព្ទ និងរក្សាទុកទៅ Firebase រួចរាល់!' : '⏳ កែលេខទូរស័ព្ទរួច — ស្ថិតិយកនៅរង់ចាំផ្ទៀងផ្ទាត់។');
            } else {
                revertPickupRefMove();
                await phonePickupJournal.finish();
                updateRecentPhonesList();
                applyCurrentFilter();
            }
        };
        const phoneSavePromise = patchHistoryItemFields(item, patchFields, previousFields, (serverItem) => {
            serverPickupSource = serverItem;
            serverPickupKey = getPickupPhoneKey(serverItem);
        }, { onLateSettled: settlePhoneSave }).then(async (saved) => {
            if (!phoneSaveIsCurrent()) return false;
            if (saved !== 'pending') await settlePhoneSave(saved);
            return saved;
        }, async () => { revertPickupRefMove(); await phonePickupJournal.finish(); return false; }).catch((postErr) => {
            phonePickupJournal.release();
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
    if (rowOperationActive(item)) { showToast('⏳ កញ្ចប់នេះកំពុងផ្ទៀងប្រាក់ — សូមរង់ចាំប្រតិបត្តិការបញ្ចប់។'); return; }
    if (!item) return;
    const actionText = item.isClosed ? "បើក" : "បិទ";
    const desiredClosed = !item.isClosed;
    if (!confirm(`តើអ្នកប្រាកដជាចង់${actionText}បញ្ជីនេះមែនទេ?`)) return;
    if (!firebaseState.db || !firebaseState.fb || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        showToast('⚠️ មិនទាន់ភ្ជាប់ Firebase ឬ ID មិនត្រឹមត្រូវ — ស្ថានភាពបញ្ជីមិនត្រូវបានផ្លាស់ប្តូរ។');
        return false;
    }

    const freshItem = dataState.scanHistory.find(i => i.id === id);
    const closeKeys = freshItem ? collectPickupMarks(freshItem).map((mark) => mark.key) : [];
    const previousState = freshItem
        ? { isClosed: freshItem.isClosed, closedAt: freshItem.closedAt, callMark: freshItem.callMark, callMarkTime: freshItem.callMarkTime, barcodeStates: freshItem.barcodes ? freshItem.barcodes.map(b => b.isClosed) : null, barcodeCloseStamps: freshItem.barcodes ? freshItem.barcodes.map(b => b.closedAt) : null }
        : null;
    let pickupPhoneKey = null;
    let pickupScanDate = null;
    let pickupApplied = null;
    let serverApplied = false;
    let serverPickupMarks = null;
    let signedRefused = false;
    let restoreHeld = false;
    let basisHeld = false;
    const pickupJournal = pickupIntentTracker(closeIsCurrent, id);
    const pickupContext = await pickupJournal.prepare(freshItem?.scanDate || getFormattedDate(), closeKeys, false);
    if (!pickupContext || !closeIsCurrent() || !pickupJournal.startClose(freshItem, desiredClosed, true)) { pickupJournal.release(); return false; }
    const reconcilePickupDeltaWithServer = () => {
        if (!serverPickupMarks) return;
        if (!pickupJournal.add(pickupScanDate, serverPickupMarks.map((mark) => mark.key)) || !pickupJournal.confirm(serverPickupMarks.filter((mark) => mark.closed).map((mark) => mark.key))) return;
        pickupApplied = healPickupKeysLeftRow(id, reapplyPickupMarks(pickupApplied || { context: pickupContext }, serverPickupMarks, pickupScanDate, false, true));
        pickupJournal.note(pickupApplied);
        refreshCurrentHistoryView();
    };
    const closeChangeOf = (target) => {
        const barcodes = target.barcodes && Array.isArray(target.barcodes) ? target.barcodes : null;
        const changing = barcodes ? barcodes.filter(b => b && (!!b.isClosed !== desiredClosed || desiredClosed && typeof b.closedAt !== 'number')) : null;
        const itemUnchanged = !!target.isClosed === desiredClosed && (!desiredClosed || typeof target.closedAt === 'number') && (!changing || !changing.length);
        return { changing, itemUnchanged };
    };
    const applyWholeClose = (target, change) => {
        target.isClosed = desiredClosed;
        if (desiredClosed) {
            if (!change.itemUnchanged) target.closedAt = pickupJournal.closeTime();
            delete target.callMark;
            delete target.callMarkTime;
            if (change.changing) change.changing.forEach(b => applyBarcodeCloseState(b, true, pickupJournal.closeTime()));
        } else {
            delete target.closedAt;
            if (change.changing) change.changing.forEach(b => applyBarcodeCloseState(b, false));
        }
    };
    const localMarkedKeys = new Set();
    const wholeCloseMarks = (target, change, phoneKey, authoritative = false) => {
        if (!desiredClosed) return collectPickupMarks(target, false, phoneKey);
        if (!change.changing) return change.itemUnchanged && (authoritative || !localMarkedKeys.size) ? [] : collectPickupMarks(target, true, phoneKey);
        const marked = target.barcodes.filter(b => b && (change.changing.includes(b) || !authoritative && localMarkedKeys.has(pickupBarcodeKey(b.code))));
        return collectPickupMarks({ ...target, barcodes: marked }, true, phoneKey);
    };
    if (freshItem) {
        pickupScanDate = freshItem.scanDate || getFormattedDate();
        const localChange = closeChangeOf(freshItem);
        applyWholeClose(freshItem, localChange);

        pickupPhoneKey = getPickupPhoneKey(freshItem);
        const localMarks = wholeCloseMarks(freshItem, localChange, pickupPhoneKey);
        localMarks.forEach((mark) => localMarkedKeys.add(mark.key));
        pickupJournal.add(pickupScanDate, localMarks.map((mark) => mark.key));
        pickupApplied = markPickupBarcodes(pickupScanDate, localMarks, false, pickupContext);
        pickupJournal.note(pickupApplied);

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
            const reverted = revertPickupMarks(pickupApplied, null, true);
            pickupJournal.note(reverted);
            pickupApplied = null;
        }
    };
    const settleCloseOnce = async (closeResult, late) => {
        if (!closeIsCurrent()) { pickupJournal.finish(); return false; }
        const acknowledged = closeResult?.committed ? pickupJournal.acknowledgedClose(closeResult.snapshot?.val()) : undefined;
        if (!serverApplied || !(closeResult && closeResult.committed) || acknowledged === null) {
            if (acknowledged !== null && (!basisHeld || pickupJournal.originalCloseAborted(closeResult))) pickupJournal.cancel();
            revertCloseLocally();
            pickupJournal.finish();
            showToast(signedRefused ? ZTO_SIGNED_REOPEN_TEXT : restoreHeld ? RESTORE_IN_PROGRESS_CLOSE_TEXT : '⚠️ បញ្ជីនេះត្រូវបានផ្លាស់ប្តូរ ឬលុបពីឧបករណ៍ផ្សេង — ស្ថានភាពថ្មីមិនត្រូវបានរក្សាទុក។');
            return false;
        }
        if (acknowledged !== undefined) serverPickupMarks = acknowledged;
        reconcilePickupDeltaWithServer();
        const collectedSync = reconcileCollectedHistory(id, [...new Set([...closeKeys, ...(serverPickupMarks || []).map((mark) => mark.key)])]);
        const pickupSettled = pickupJournal.finish(collectedSync);
        const [collectedSaved, pickupSaved] = await Promise.all([collectedSync, pickupSettled]);
        if (!closeIsCurrent()) return false;
        if (collectedSaved === true && pickupSaved === true) showToast(late
            ? `✅ បណ្តាញត្រឡប់មកវិញ — បាន${actionText}ស្ថានភាពបញ្ជីក្នុង Firebase រួចរាល់!`
            : `✅ បាន${actionText}ស្ថានភាពបញ្ជីក្នុង Firebase រួចរាល់!`);
        if (pickupSaved !== true) showToast('⏳ ស្ថានភាពបានរក្សាទុក — ស្ថិតិយកនៅរង់ចាំផ្ទៀងផ្ទាត់។');
        return true;
    };
    const releaseSettle = desiredClosed ? holdCollectedSettle(id) : () => {};
    const healCollectedAfterFailure = (error) => {
        if (!error || error.txOutcome === 'not-applied' || !closeIsCurrent()) { releaseSettle(); return undefined; }
        const healed = reconcileCollectedHistory(id, closeKeys);
        void healed.finally(releaseSettle);
        return healed;
    };
    const settleClose = (result, late) => settleCloseOnce(result, late).finally(releaseSettle);
    let closeTx = null;
    try {
        closeTx = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`), (currentItem) => {
            if (!closeIsCurrent()) return;
            serverApplied = false;
            serverPickupMarks = null;
            signedRefused = false;
            basisHeld = false;
            if (rowOperationActive(currentItem)) { basisHeld = true; return; }
            const planned = pickupJournal.applyClose(currentItem);
            if (planned) {
                restoreHeld = !!planned.restoreHeld;
                signedRefused = !!planned.signed;
                if (planned.kind === 'conflict') { basisHeld = true; return; }
                serverPickupMarks = planned.marks;
                pickupScanDate = currentItem.scanDate;
                serverApplied = true;
                return planned.item;
            }
            ({ item: currentItem, restoreHeld } = preparePickupClose(currentItem, pickupContext.date));
            if (!currentItem) return currentItem;
            const serverBarcodes = (currentItem.barcodes && Array.isArray(currentItem.barcodes)) ? currentItem.barcodes : null;
            if (!desiredClosed && serverBarcodes && serverBarcodes.some(barcodeZtoSigned)) {
                signedRefused = true;
                return;
            }
            const previousBarcodes = barcodeEntriesOf(currentItem.barcodes).map(({ barcode }) => ({ ...barcode }));
            const serverChange = closeChangeOf(currentItem);
            serverPickupMarks = wholeCloseMarks(currentItem, serverChange, getPickupPhoneKey(currentItem), true);
            if (!pickupJournal.add(pickupContext.date, serverPickupMarks.map((mark) => mark.key))) return;
            if (currentItem.scanDate) pickupScanDate = currentItem.scanDate;
            applyWholeClose(currentItem, serverChange);
            pickupJournal.stampTransition(currentItem, previousBarcodes);
            serverApplied = true;
            return currentItem;
        });
        return settleClose(await dbOp(closeTx), false);
    } catch (error) {
        if (!closeIsCurrent()) { releaseSettle(); pickupJournal.finish(); return false; }
        if (dbOpStalled(error) && armLateCommit(closeTx, (lateResult) => settleClose(lateResult, true), (lateErr) => {
            if (!closeIsCurrent()) { releaseSettle(); pickupJournal.finish(); return; }
            revertCloseLocally();
            if (lateErr?.txOutcome === 'not-applied') pickupJournal.cancel();
            pickupJournal.finish(healCollectedAfterFailure(lateErr));
            showToast("⚠️ បរាជ័យក្នុងការ Save ស្ថានភាពបញ្ជីទៅ Firebase! ស្ថានភាពត្រូវបានត្រឡប់ដើមវិញ។");
            if (lateErr && window.ZoeErrors) ZoeErrors.capture(lateErr, { zone: 'money', context: 'toggleCloseStatus late transaction failed' });
        }, 'toggleCloseStatus')) {
            showToast("⏳ បណ្តាញឆ្លើយមិនចេញ — ស្ថានភាពបញ្ជីនឹងធ្វើបច្ចុប្បន្នភាពពេលបណ្តាញត្រឡប់មកវិញ។");
            return;
        }
        console.error("Error toggling close status: ", error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: "Error toggling close status: " });
        revertCloseLocally();
        return failPickupClose(pickupJournal, error, healCollectedAfterFailure);
    }
}

export async function deleteSingleItem(id, opts?) {
    if (cleanupInFlight.has(id)) return 'blocked';
    const quiet = !!(opts && opts.quiet);
    const say = (message) => { if (!quiet) showToast(message); };
    const index = dataState.scanHistory.findIndex(i => i.id === id);
    if (index === -1) return 'missing';
    if (rowOperationActive(dataState.scanHistory[index])) { showToast('⏳ កញ្ចប់នេះកំពុងផ្ទៀងប្រាក់ — សូមរង់ចាំប្រតិបត្តិការបញ្ចប់។'); return 'blocked'; }

    const finalNote = trashEntryIsFinal(getManualZtoTrashMode(), dataState.scanHistory[index]) ? TRASH_FINAL_CONFIRM_NOTE : '';
    if (!(opts && opts.confirmed) && !confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?${finalNote}`)) return 'cancelled';

    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        const idErr = new Error('Unsafe id during deleteSingleItem');
        console.error(idErr.message, id);
        if (window.ZoeErrors) ZoeErrors.capture(idErr, { zone: 'data', context: 'deleteSingleItem' });
        say("⚠️ លុបមិនបានជោគជ័យ! (ID មិនត្រឹមត្រូវ)");
        return 'failed';
    }

    const generationOwner = captureTrashGenerationOwner();
    const deleteDb = firebaseState.db;
    const deleteGeneration = firebaseState.authGeneration;
    const deleteMode = opts && ['palm', 'cookie', 'local'].includes(opts.trashMode) ? opts.trashMode : getManualZtoTrashMode();
    const deleteIsCurrent = () => trashGenerationOwnerCurrent(generationOwner) && firebaseState.db === deleteDb && firebaseState.authGeneration === deleteGeneration;
    const noteDeleteSessionSwitch = () => {
        try { patchCleanupJournalEntry(id, { switchReported: true }, preparedTrash, operation?.scope); } catch (journalErr) {}
        if (window.ZoeErrors) ZoeErrors.capture(new Error('Delete stopped after a database switch'), { zone: 'data', context: 'deleteSingleItem session switch', itemId: id });
    };
    let claimedWhole = null;
    let clearClaimBlocked = false;
    let restoreClaimBlocked = false;
    let claimBusy = false;
    let preparedTrash = null;
    let plannedSource = null;
    const trashClaim = beginTrashClaim(id);
    const claimToken = trashClaim.token;
    const settleClaim = trashClaim.settle;
    let pendingDelete = false;
    let operation = null;
    const releaseDelete = () => releaseCleanupOperation(id, operation);
    const deleteUpdater: any = (currentItem) => {
        if (!deleteIsCurrent()) return;
        claimedWhole = null;
        clearClaimBlocked = false;
        restoreClaimBlocked = false;
        claimBusy = false;
        if (!currentItem) return currentItem;
        if (rowOperationActive(currentItem)) { claimBusy = true; return; }
        if (currentItem.clearClaim) {
            clearClaimBlocked = true;
            return currentItem;
        }
        if (itemHasRestoreMarkers(currentItem)) {
            restoreClaimBlocked = true;
            return;
        }
        normalizeBarcodesOf(currentItem);
        const now = getServerNow();
        const list = barcodeEntriesOf(currentItem.barcodes).map(({ barcode }) => barcode);
        if (!list.every((b) => trashClaimOwned(b, claimToken, now))) {
            claimBusy = true;
            return;
        }
        if (!cleanupAdmissionMatches(plannedSource, currentItem)) { claimBusy = true; return; }
        claimedWhole = currentItem;
        return null;
    };
    deleteUpdater.txOutcomeWitness = (server) => (barcodeEntriesOf(server && server.barcodes)
        .some(({ barcode }) => barcode && barcode.trashClaim === claimToken) ? 'not-applied' : 'applied');
    const finishDelete = async (result, late) => {
        settleClaim(!!(result && result.committed && claimedWhole));
        if (!deleteIsCurrent()) {
            if (claimedWhole) noteDeleteSessionSwitch();
            return 'stale';
        }
        if (!claimedWhole) {
            if (preparedTrash) clearCleanupJournalEntry(preparedTrash.id, preparedTrash);
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

        const removed = stripHistoryOnlyMarkers({ ...claimedWhole, id: preparedTrash.id, trashGeneration: preparedTrash.trashGeneration });
        removed.deletedAt = preparedTrash ? preparedTrash.deletedAt : getServerNow();
        removed.isFromDeletion = true;
        removed.trashReason = 'delete';
        stampTrashPolicy(removed, preparedTrash?.trashMode || deleteMode);
        if (Array.isArray(removed.barcodes)) {
            removed.barcodes = removed.barcodes.map(b => ({ ...b, isFromDeletion: true }));
        }

        dataState.deletedItems.unshift(removed);
        refreshCurrentHistoryView();
        updateRecentPhonesList();

        let trashSaved = false;
        await notifyIfSlow(retryAsync(() => (deleteIsCurrent() ? claimCleanupTrashSlot(removed, false, operation, generationOwner) : Promise.reject(Object.assign(new Error('Delete session changed'), { noRetry: true }))), 4, 1500),
            TRASH_WRITE_SLOW_NOTICE_MS,
            "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរក្សាទុកការលុប… សូមកុំបិទ App។").then(() => {
            trashSaved = true;
        }).catch(async (trashErr) => {
            const staleIdx = dataState.deletedItems.findIndex(i => i.id === removed.id);
            if (staleIdx !== -1) dataState.deletedItems.splice(staleIdx, 1);
            console.error('Trash write permanently failed for deleteSingleItem of', id, trashErr);
            if (!deleteIsCurrent()) { noteDeleteSessionSwitch(); return; }
            if (trashErr?.message === 'TRASH_GENERATION_HOLD') { say('⏳ ការលុបកំពុងរង់ចាំការផ្ទៀងជំនាន់ធុងសំរាម។'); return; }
            if (window.ZoeErrors) ZoeErrors.capture(trashErr, { zone: 'data', context: 'deleteSingleItem trash write failed after retries', itemId: id });
            let restoreOk = false;
            try {
                await restoreClaimedItemToScanHistory(id, claimedWhole, null);
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
        clearCleanupJournalEntry(removed.id, removed);
        if (late) showToast("✅ បណ្តាញត្រឡប់មកវិញ — បានលុបទៅធុងសំរាមបណ្តោះអាសន្ន!");
        else say("✅ បានលុបទៅធុងសំរាមបណ្តោះអាសន្ន!");
        return 'deleted';
    };
    try {
        operation = beginCleanupOperation(id);
        await trashClaim.start();
        const claim: any = await claimTrashBarcodes(id, claimToken, (current) => barcodeEntriesOf(current.barcodes).map(({ barcode }) => barcode && barcode.code).filter(Boolean), true);
        if (!deleteIsCurrent()) return 'stale';
        if (claim.state !== 'idle' && (claim.state !== 'claimed' || claim.blocked)) {
            if (claim.state === 'none') {
                settleClaim(true);
                const goneIdx = dataState.scanHistory.findIndex(i => i.id === id);
                if (goneIdx !== -1) dataState.scanHistory.splice(goneIdx, 1);
                refreshCurrentHistoryView();
                updateRecentPhonesList();
                say("⚠️ ទិន្នន័យនេះត្រូវបានលុបដោយឧបករណ៍ផ្សេងរួចហើយ!");
                return 'missing';
            }
            refreshCurrentHistoryView();
            if (claim.state === 'busy' || claim.blocked) {
                say(claim.reason === 'restore'
                    ? "⏳ កញ្ចប់នេះកំពុងស្តារ — សូមរង់ចាំឲ្យចប់ រួចសាកលុបម្តងទៀត។"
                    : "⏳ ទិន្នន័យនេះកំពុងដំណើរការ (ស្តារ · ដក · សម្អាត · លុបជាក្រុម) — សូមរង់ចាំបន្តិច រួចសាកលុបម្តងទៀត។");
                return 'blocked';
            }
            say("⚠️ លុបមិនបានជោគជ័យ! សូមសាកល្បងម្តងទៀត។");
            return 'failed';
        }
        if (!claim.source || !generationOwner) return 'blocked';
        plannedSource = JSON.parse(JSON.stringify(claim.source));
        if (!await prepareCleanupTrashGeneration({ ...plannedSource, id, trashReason: 'delete' }, operation, generationOwner) || !deleteIsCurrent()) {
            if (deleteIsCurrent()) say('⏳ ការលុបកំពុងរង់ចាំការផ្ទៀងជំនាន់ធុងសំរាម។ សូម Sync រួចសាកម្ដងទៀត។');
            return deleteIsCurrent() ? 'blocked' : 'stale';
        }
        preparedTrash = stripHistoryOnlyMarkers({ ...plannedSource, id: operation.trashTargetId, trashGeneration: operation.trashGeneration,
            deletedAt: operation.deletedAt, isFromDeletion: true, trashReason: 'delete',
            barcodes: Array.isArray(plannedSource.barcodes) ? plannedSource.barcodes.map(barcode => ({ ...barcode, isFromDeletion: true })) : plannedSource.barcodes });
        stampTrashPolicy(preparedTrash, deleteMode);
        markCleanupJournalLive(preparedTrash.id, operation);
        noteCleanupJournalEntry({ id, reason: 'delete', journalId: operation.journalId, journalAt: getServerNow(), stage: CLEANUP_STAGE_SLOT, trashItem: preparedTrash, revenue: null });
        if (!readCleanupJournal().some(entry => entry.trashItem.id === preparedTrash.id && entry.trashItem.trashGeneration === preparedTrash.trashGeneration && entry.trashItem.deletedAt === preparedTrash.deletedAt)) throw new Error('write_journal_unavailable');
        const deleteTx = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`), deleteUpdater);
        let result;
        try {
            result = await dbOp(deleteTx);
        } catch (txError) {
            if (dbOpStalled(txError)) {
                pendingDelete = true;
                armLateCommit(deleteTx, async (late) => {
                    try { return await finishDelete(late, true); } finally { releaseDelete(); }
                }, (lateErr) => {
                    settleClaim(false);
                    releaseDelete();
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
            if (!deleteIsCurrent()) { if (preparedTrash) noteDeleteSessionSwitch(); return 'stale'; }
            if (restoreClaimBlocked) {
                say("⏳ កញ្ចប់នេះកំពុងស្តារ — សូមរង់ចាំឲ្យចប់ រួចសាកលុបម្តងទៀត។");
                return 'blocked';
            }
            if (claimBusy) {
                say("⏳ ទិន្នន័យនេះកំពុងដំណើរការ (ស្តារ · ដក · សម្អាត · លុបជាក្រុម) — សូមរង់ចាំបន្តិច រួចសាកលុបម្តងទៀត។");
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
    } finally {
        if (!pendingDelete) await settleClaim(false);
        if (!pendingDelete) releaseDelete();
    }
}
