import { dataState, firebaseState, uiState } from '../core/state';
import { HISTORY_PATCH_QUEUE_MAX, HISTORY_PATCH_RETRY_MAX, pendingHistoryPatches } from '../core/clock';
import { dropStaleRestoreMarkers, normalizeBarcodesOf } from '../domain/barcode';
import { dbOp, dbOpStalled } from './network';
import { transactionDisconnectPending } from './tx-outcome';
import { refreshCurrentHistoryView, scheduleHistoryViewRefresh } from '../ui/history-refresh';
import { showToast } from '../ui/toast';

export function mergeBarcodeIntoHistoryItem(id, mergeFn, fallbackItem) {
    if (!firebaseState.db || !firebaseState.fb || !id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        const err = new Error('Refusing to merge barcode into history item with missing/unsafe id');
        console.error(err.message, id);
        if (window.ZoeErrors) ZoeErrors.capture(err, { zone: 'data', context: 'mergeBarcodeIntoHistoryItem' });
        showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
        return Promise.reject(err);
    }
    return firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`), (currentItem) => {
        if (currentItem && currentItem.clearClaim) return;
        if (!currentItem) return fallbackItem;
        dropStaleRestoreMarkers(currentItem);
        return mergeFn(currentItem);
    }).then((result) => {
        if (!result || !result.committed) {
            throw new Error('Barcode merge transaction was not committed');
        }
        const committed = result.snapshot ? result.snapshot.val() : null;
        if (committed && !committed.id) committed.id = id;
        return committed;
    }).catch((error) => {
        console.error("Error merging barcode into history item: ", error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: "Error merging barcode into history item: " });
        showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
        throw error;
    });
}

export function saveSingleHistoryItemToFirebase(item) {
    if (!firebaseState.dbRefHistory || !firebaseState.db || !firebaseState.fb) return Promise.reject(new Error('History Firebase reference unavailable'));
    if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
        const err = new Error('Refusing to save history item with missing/unsafe id');
        console.error(err.message, item && item.id);
        if (window.ZoeErrors) ZoeErrors.capture(err, { zone: 'data', context: 'saveSingleHistoryItemToFirebase' });
        showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
        return Promise.reject(err);
    }
    return firebaseState.fb.update(firebaseState.dbRefHistory, { [item.id]: item }).catch((error) => {
        console.error("Error saving history item: ", error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: "Error saving history item: " });
        showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
        throw error;
    });
}

export function historyPatchErrorIsDisconnect(error) {
    if (!error) return false;
    const text = String((error && (error.message || error.code)) || error);
    return /disconnect|already deleted/i.test(text);
}

export function queueHistoryPatchRetry(itemId, fields, previousFields, successToast, preserveQueuedFields) {
    if (!itemId || !fields) return false;
    const existing = pendingHistoryPatches.get(itemId);
    if (existing) {
        if (existing.attempts >= HISTORY_PATCH_RETRY_MAX) return false;
        if (preserveQueuedFields) {
            existing.fields = Object.assign({}, fields, existing.fields);
            existing.previousFields = Object.assign({}, existing.previousFields || {}, previousFields || {});
        } else {
            Object.assign(existing.fields, fields);
            existing.previousFields = Object.assign({}, previousFields || {}, existing.previousFields || {});
        }
        if (successToast && !preserveQueuedFields) existing.successToast = successToast;
        return true;
    }
    if (pendingHistoryPatches.size >= HISTORY_PATCH_QUEUE_MAX) return false;
    pendingHistoryPatches.set(itemId, {
        fields: Object.assign({}, fields),
        previousFields: previousFields ? Object.assign({}, previousFields) : null,
        successToast: successToast || '',
        attempts: 0
    });
    return true;
}

export function flushPendingHistoryPatches() {
    if (dataState.historyPatchFlushInFlight) return;
    if (!pendingHistoryPatches.size) return;
    if (!firebaseState.dbRefHistory || !firebaseState.db || !firebaseState.fb) return;
    const flushAuthGeneration = firebaseState.authGeneration;
    const flushDatabase = firebaseState.db;
    const flushIsCurrent = () => flushAuthGeneration === firebaseState.authGeneration && flushDatabase === firebaseState.db;
    const entries = Array.from(pendingHistoryPatches.entries());
    pendingHistoryPatches.clear();
    dataState.historyPatchFlushInFlight = true;
    let settled = 0;
    const done = () => {
        if (!flushIsCurrent()) return;
        settled++;
        if (settled < entries.length) return;
        dataState.historyPatchFlushInFlight = false;
        scheduleHistoryViewRefresh();
    };
    const noteAttempt = (itemId, attempts) => {
        if (!flushIsCurrent()) return;
        const requeued = pendingHistoryPatches.get(itemId);
        if (requeued) requeued.attempts = attempts;
    };
    entries.forEach((pair) => {
        const itemId = pair[0];
        const entry = pair[1];
        const attempts = entry.attempts + 1;
        const target = dataState.scanHistory.find(i => i.id === itemId) || { id: itemId };
        let started = null;
        try {
            started = patchHistoryItemFields(target, entry.fields, entry.previousFields, null,
                { retryOnDisconnect: attempts < HISTORY_PATCH_RETRY_MAX, queuedSuccessToast: entry.successToast, preserveQueuedFields: true });
        } catch (e) {
            if (!flushIsCurrent()) return;
            if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'data', context: 'flushPendingHistoryPatches' });
            if (attempts < HISTORY_PATCH_RETRY_MAX) {
                queueHistoryPatchRetry(itemId, entry.fields, entry.previousFields, entry.successToast, true);
                noteAttempt(itemId, attempts);
            }
            done();
            return;
        }
        Promise.resolve(started).then((saved) => {
            if (!flushIsCurrent()) return;
            if (!saved || saved === 'queued') noteAttempt(itemId, attempts);
            else if (entry.successToast) showToast(entry.successToast);
            done();
        }, done);
    });
}

export function patchHistoryItemFields(item, fields, previousFields, onServerItem, opts?) {
    if (!firebaseState.dbRefHistory || !firebaseState.db || !firebaseState.fb) return Promise.resolve(false);
    if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
        const err = new Error('Refusing to patch history item with missing/unsafe id');
        console.error(err.message, item && item.id);
        if (window.ZoeErrors) ZoeErrors.capture(err, { zone: 'data', context: 'patchHistoryItemFields' });
        showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
        return Promise.resolve(false);
    }
    const patchAuthGeneration = firebaseState.authGeneration;
    const patchDatabase = firebaseState.db;
    const patchIsCurrent = () => patchAuthGeneration === firebaseState.authGeneration && patchDatabase === firebaseState.db;
    const revertLocalFields = () => {
        if (!previousFields) return;
        const revertItem = dataState.scanHistory.find(i => i.id === item.id);
        if (!revertItem) return;
        Object.keys(previousFields).forEach((key) => {
            if (previousFields[key] === undefined) delete revertItem[key];
            else revertItem[key] = previousFields[key];
        });
        refreshCurrentHistoryView();
    };
    const handlePatchFailure = (error) => {
        if (!patchIsCurrent()) return false;
        const cause = (dbOpStalled(error) && transactionDisconnectPending(patchTransaction)) || error;
        if (opts && opts.retryOnDisconnect && historyPatchErrorIsDisconnect(cause)
            && queueHistoryPatchRetry(item.id, fields, previousFields, opts.queuedSuccessToast, opts.preserveQueuedFields)) {
            return 'queued';
        }
        console.error("Error patching history item: ", error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: "Error patching history item: " });
        revertLocalFields();
        showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! ស្ថានភាពក្នុង App ត្រូវបានត្រឡប់ដើមវិញ។");
        return false;
    };
    let serverItemExisted = false;
    let patchTransaction;
    try {
        patchTransaction = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${item.id}`), (currentItem) => {
            if (!patchIsCurrent()) return;
            serverItemExisted = false;
            if (!currentItem) return currentItem;
            normalizeBarcodesOf(currentItem);
            if (currentItem.clearClaim) return;
            if (onServerItem) onServerItem(currentItem);
            Object.keys(fields).forEach((key) => {
                if (fields[key] === null) delete currentItem[key];
                else currentItem[key] = fields[key];
            });
            serverItemExisted = true;
            return currentItem;
        });
    } catch (error) {
        return Promise.resolve(handlePatchFailure(error));
    }
    return dbOp(patchTransaction).then((result) => {
        if (!patchIsCurrent()) return false;
        if (!serverItemExisted || !(result && result.committed)) {
            revertLocalFields();
            showToast("⚠️ ទិន្នន័យនេះលែងមានក្នុងប្រព័ន្ធ! ការកែប្រែមិនត្រូវបានរក្សាទុកទេ។");
            return false;
        }
        const committedItem = result.snapshot ? normalizeBarcodesOf(result.snapshot.val()) : null;
        if (committedItem && !committedItem.id) committedItem.id = item.id;
        return committedItem || true;
    }, handlePatchFailure);
}

export function saveSingleDeletedItemToFirebase(item) {
    if (!firebaseState.dbRefDeleted || !firebaseState.db || !firebaseState.fb) return Promise.reject(new Error('Trash Firebase reference unavailable'));
    if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
        const err = new Error('Refusing to save deleted item with missing/unsafe id');
        console.error(err.message, item && item.id);
        if (window.ZoeErrors) ZoeErrors.capture(err, { zone: 'data', context: 'saveSingleDeletedItemToFirebase' });
        showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
        return Promise.reject(err);
    }
    return firebaseState.fb.update(firebaseState.dbRefDeleted, { [item.id]: item }).catch((error) => {
        console.error("Error saving deleted item: ", error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: "Error saving deleted item: " });
        showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!");
        throw error;
    });
}

export function deleteSingleDeletedItemFromFirebase(id) {
    if (!firebaseState.dbRefDeleted || !firebaseState.db || !firebaseState.fb) return Promise.reject(new Error('Trash Firebase reference unavailable'));
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        const err = new Error('Refusing to delete deleted item with missing/unsafe id');
        console.error(err.message, id);
        if (window.ZoeErrors) ZoeErrors.capture(err, { zone: 'data', context: 'deleteSingleDeletedItemFromFirebase' });
        showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
        return Promise.reject(err);
    }
    return firebaseState.fb.update(firebaseState.dbRefDeleted, { [id]: null }).catch((error) => {
        console.error("Error deleting deleted item: ", error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: "Error deleting deleted item: " });
        showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!");
        throw error;
    });
}

export function purgeDeletedItemsQuietly(ids) {
    if (!ids || !ids.length) return Promise.resolve();
    if (!firebaseState.dbRefDeleted || !firebaseState.db || !firebaseState.fb) return Promise.reject(new Error('Trash Firebase reference unavailable'));
    const updates = {};
    ids.forEach(id => {
        if (id && /^[a-zA-Z0-9_-]+$/.test(id)) updates[id] = null;
    });
    if (!Object.keys(updates).length) return Promise.resolve();
    return firebaseState.fb.update(firebaseState.dbRefDeleted, updates);
}

export function playBeep() {
    try {
        if (!uiState.globalAudioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                uiState.globalAudioCtx = new AudioContextClass();
            }
        }
        if (!uiState.globalAudioCtx) return;

        if (uiState.globalAudioCtx.state === 'suspended') {
            uiState.globalAudioCtx.resume().then(() => {
                executeBeepSound(uiState.globalAudioCtx);
            }).catch(() => {});
        } else if (uiState.globalAudioCtx.state === 'running') {
            executeBeepSound(uiState.globalAudioCtx);
        }
    } catch (e) {}
}

export function executeBeepSound(audioCtx) {
    try {
        if (audioCtx.state === 'closed') return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
}
