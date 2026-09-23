import { byId } from '../core/dom';
import { dataState, firebaseState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { getFormattedDate } from '../core/timezone';
import { generateUniqueId, normalizeBarcodesOf } from '../domain/barcode';
import { reconcileCollectedHistory } from '../domain/collected';
import { pickupBarcodeKey } from '../domain/pickup';
import { collectItemBarcodes, releaseBarcodesInRegistry } from '../domain/registry';
import { TRASH_WRITE_SLOW_NOTICE_MS } from './session';
import { openRecentlyDeletedModal, renderRecentlyDeleted } from './trash';
import { updateRecentPhonesList } from '../services/db-listeners';
import { deleteSingleDeletedItemFromFirebase } from '../services/history-write';
import { dbOp, notifyIfSlow } from '../services/network';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { recalcItemMoneyFromBarcodes } from '../ui/modal-stack';
import { showToast } from '../ui/toast';

export const RESTORE_CLAIM_LEASE_MS = 2 * 60 * 1000;

export const activeRestoreClaims = new Map();

export function cloneRestoreItem(item) {
    if (!item || typeof item !== 'object') return null;
    const cloned = { ...item, barcodes: Array.isArray(item.barcodes) ? item.barcodes.map(b => b && typeof b === 'object' ? { ...b } : b) : item.barcodes };
    normalizeBarcodesOf(cloned);
    return cloned;
}

export function isRestoreMergeTarget(target, itemToRestore) {
    return !!(target && !target.clearClaim && itemToRestore && itemToRestore.phone !== "គ្មានលេខ" && target.phone === itemToRestore.phone && Array.isArray(target.barcodes) && Array.isArray(itemToRestore.barcodes) && target.scanDate === itemToRestore.scanDate && !target.isClosed);
}

export async function findRestoreTargetId(itemToRestore) {
    if (!itemToRestore || !itemToRestore.id || !firebaseState.dbRefHistory || !firebaseState.fb) return itemToRestore && itemToRestore.id;
    try {
        const historySnap = await dbOp(firebaseState.fb.get(firebaseState.dbRefHistory));
        const history = historySnap && historySnap.val();
        if (!history || typeof history !== 'object') return itemToRestore.id;
        const existingClaim = itemToRestore.restoreClaim;
        const preparedTarget = existingClaim && history[existingClaim.targetId];
        if (preparedTarget && preparedTarget.restoreClaimId === itemToRestore.id && preparedTarget.restoreClaimToken === existingClaim.token) {
            return existingClaim.targetId;
        }
        const matchingId = Object.keys(history).find((id) => {
            const candidate = cloneRestoreItem(history[id]);
            return candidate && isRestoreMergeTarget(candidate, itemToRestore);
        });
        return matchingId || itemToRestore.id;
    } catch (e) {
        return itemToRestore.id;
    }
}

export function isActiveRestoreClaim(claim) {
    const claimedAt = claim && parseFloat(claim.claimedAt);
    const now = getServerNow();
    return !!(claim && typeof claim.token === 'string' && claim.token && isFinite(claimedAt) && claimedAt <= now && (now - claimedAt) < RESTORE_CLAIM_LEASE_MS);
}

export function generateRestoreClaimToken() {
    return 'restore_' + generateUniqueId() + '_' + Math.random().toString(36).slice(2);
}

export async function claimDeletedItemForRestore(id, token, targetId) {
    let claimedItem = null;
    let replacedClaim = null;
    let claimStatus = 'ALREADY_RESTORED';
    const trashRef = firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${id}`);
    const result = await dbOp(firebaseState.fb.runTransaction(trashRef, (currentItem) => {
        claimedItem = null;
        replacedClaim = null;
        claimStatus = 'ALREADY_RESTORED';
        if (!currentItem || typeof currentItem !== 'object') return;
        const existingClaim = currentItem.restoreClaim;
        if (existingClaim && existingClaim.token !== token && isActiveRestoreClaim(existingClaim)) {
            claimStatus = 'RESTORE_IN_PROGRESS';
            return;
        }
        if (existingClaim && existingClaim.token !== token) {
            replacedClaim = { token: existingClaim.token, targetId: existingClaim.targetId };
        }
        claimedItem = cloneRestoreItem(currentItem);
        delete claimedItem.restoreClaim;
        delete claimedItem.restoreClaimId;
        delete claimedItem.restoreClaimToken;
        if (!claimedItem.id) claimedItem.id = id;
        currentItem.restoreClaim = { token, claimedAt: getServerNow(), targetId };
        claimStatus = 'CLAIMED';
        return currentItem;
    }));
    if (!result || !result.committed || !claimedItem) throw new Error(claimStatus);
    return { item: claimedItem, replacedClaim };
}

export async function bindRestoreClaimTarget(id, token, targetId) {
    let bound = false;
    const result = await dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${id}`), (currentItem) => {
        bound = false;
        if (!currentItem || !currentItem.restoreClaim || currentItem.restoreClaim.token !== token) return;
        currentItem.restoreClaim = { token, claimedAt: getServerNow(), targetId };
        bound = true;
        return currentItem;
    }));
    if (!bound || !result || !result.committed) throw new Error('RESTORE_CLAIM_LOST');
}

export async function clearRestoreFinalization(sourceId, token) {
    if (!sourceId || !token) return;
    await dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_restore_finalizations/${sourceId}`), (currentFinalization) => {
        if (!currentFinalization || currentFinalization.token !== token) return;
        return null;
    }));
}

export async function applyClaimedRestoreToHistory(targetId, sourceId, token, itemToRestore, applyRestoreMergeInto) {
    let targetChanged = false;
    let committedItem = null;
    const result = await dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${targetId}`), (currentItem) => {
        targetChanged = false;
        committedItem = null;
        if (currentItem) normalizeBarcodesOf(currentItem);
        if (currentItem && currentItem.clearClaim) {
            targetChanged = true;
            return;
        }
        const alreadyPrepared = currentItem && currentItem.restoreClaimId === sourceId;
        if (!alreadyPrepared && targetId !== itemToRestore.id && !isRestoreMergeTarget(currentItem, itemToRestore)) {
            targetChanged = true;
            return;
        }
        const target = currentItem ? applyRestoreMergeInto(currentItem) : cloneRestoreItem(itemToRestore);
        if (!target) return;
        target.id = targetId;
        target.restoreClaimId = sourceId;
        target.restoreClaimToken = token;
        committedItem = target;
        return target;
    }));
    if (targetChanged) return { targetChanged: true, item: null };
    if (!result || !result.committed || !committedItem) throw new Error('RESTORE_HISTORY_WRITE_FAILED');
    const snapshotItem = result.snapshot ? cloneRestoreItem(result.snapshot.val()) : committedItem;
    return { targetChanged: false, item: snapshotItem };
}

export function appendRestoreRevenueIncrements(updates, deltas) {
    const daily = {};
    const monthly = {};
    deltas.forEach((delta) => {
        const scanDate = delta.scanDate || getFormattedDate();
        const month = scanDate.substring(0, 7);
        if (!daily[scanDate]) daily[scanDate] = { cod: 0, dod: 0, count: 0 };
        if (!monthly[month]) monthly[month] = { cod: 0, dod: 0, count: 0 };
        daily[scanDate].cod += parseFloat(delta.cod) || 0;
        daily[scanDate].dod += parseFloat(delta.dod) || 0;
        daily[scanDate].count += parseFloat(delta.count) || 0;
        monthly[month].cod += parseFloat(delta.cod) || 0;
        monthly[month].dod += parseFloat(delta.dod) || 0;
        monthly[month].count += parseFloat(delta.count) || 0;
    });
    const append = (path, amount) => {
        const value = Math.round((parseFloat(amount) || 0) * 100) / 100;
        if (value) updates[path] = firebaseState.fb.increment(value);
    };
    Object.keys(daily).forEach((scanDate) => {
        const delta = daily[scanDate];
        append(`zoew_daily_revenue_cod_dod/${scanDate}/codDollar`, delta.cod);
        append(`zoew_daily_revenue_cod_dod/${scanDate}/dodDollar`, delta.dod);
        append(`zoew_daily_revenue_cod_dod/${scanDate}/totalCount`, delta.count);
    });
    Object.keys(monthly).forEach((month) => {
        const delta = monthly[month];
        append(`zoew_monthly_revenue_cod_dod/${month}/codDollar`, delta.cod);
        append(`zoew_monthly_revenue_cod_dod/${month}/dodDollar`, delta.dod);
        append(`zoew_monthly_revenue_cod_dod/${month}/totalCount`, delta.count);
    });
}

export async function finalizeClaimedRestore(sourceId, token, targetId, revenueDeltas) {
    const updates = {
        [`zoew_restore_finalizations/${sourceId}`]: { token, targetId, finalizedAt: getServerNow() },
        [`zoew_recently_deleted_cod_dod/${sourceId}`]: null,
        [`zoew_scan_history_cod_dod/${targetId}/restoreClaimId`]: null,
        [`zoew_scan_history_cod_dod/${targetId}/restoreClaimToken`]: null
    };
    appendRestoreRevenueIncrements(updates, revenueDeltas);
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await dbOp(firebaseState.fb.update(firebaseState.fb.ref(firebaseState.db), updates));
            return;
        } catch (error) {
            lastError = error;
            let trashSnapshot;
            try {
                trashSnapshot = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${sourceId}`)));
            } catch (readError) {
                throw error;
            }
            if (!trashSnapshot.exists()) return;
            const currentTrash = trashSnapshot.val();
            const currentClaim = currentTrash && currentTrash.restoreClaim;
            if (!currentClaim || currentClaim.token !== token || currentClaim.targetId !== targetId) throw new Error('RESTORE_CLAIM_LOST');
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
        }
    }
    throw lastError || new Error('RESTORE_FINAL_WRITE_FAILED');
}

export async function executeRestoreItem() {
    const restoredId = uiState.pendingRestoreId;
    if (!restoredId || !firebaseState.db || !firebaseState.fb || !firebaseState.dbRefDeleted) return;
    closeModal('restoreWarningModal');
    uiState.pendingRestoreId = null;
    try {
        const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
        if (!safeIdPattern.test(restoredId)) {
            throw new Error('Unsafe id during restore');
        }
        const existingClaim = activeRestoreClaims.get(restoredId);
        const token = existingClaim ? existingClaim.token : generateRestoreClaimToken();
        let targetId = existingClaim ? existingClaim.targetId : null;
        if (!targetId) {
            const previewSnap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${restoredId}`)));
            if (!previewSnap.exists()) throw new Error('ALREADY_RESTORED');
            const previewItem = cloneRestoreItem(previewSnap.val());
            if (!previewItem) throw new Error('ALREADY_RESTORED');
            targetId = await findRestoreTargetId(previewItem);
        }
        const claimed = await claimDeletedItemForRestore(restoredId, token, targetId);
        activeRestoreClaims.set(restoredId, { token, targetId });
        if (claimed.replacedClaim && safeIdPattern.test(claimed.replacedClaim.targetId) && claimed.replacedClaim.targetId !== targetId) {
            targetId = claimed.replacedClaim.targetId;
            await bindRestoreClaimTarget(restoredId, token, targetId);
            activeRestoreClaims.set(restoredId, { token, targetId });
        }

        let itemToRestore = claimed.item;
        const restoredWasRemoved = itemToRestore.isFromDeletion === false;
        delete itemToRestore.deletedAt;
        delete itemToRestore.isFromDeletion;
        delete itemToRestore.trashReason;
        delete itemToRestore.restoreClaim;
        delete itemToRestore.restoreClaimId;
        delete itemToRestore.restoreClaimToken;
        if (itemToRestore.isClosed) {
            itemToRestore.closedAt = getServerNow();
        } else {
            itemToRestore.createdAt = getServerNow();
        }

        const appliedRevenueDeltas = [];
        const revenueScanDate = itemToRestore.scanDate || getFormattedDate();
        if (itemToRestore.barcodes && Array.isArray(itemToRestore.barcodes)) {
            itemToRestore.barcodes.forEach((restoredBc) => {
                if (restoredBc.isDeducted) {
                    const targetCod = parseFloat(restoredBc.cod) || 0;
                    const targetDod = parseFloat(restoredBc.dod) || 0;
                    appliedRevenueDeltas.push({ scanDate: revenueScanDate, cod: targetCod, dod: targetDod, count: 1 });
                    restoredBc.isDeducted = false;
                }
                restoredBc.isFromDeletion = false;
                if (restoredBc.isClosed) restoredBc.closedAt = getServerNow();
                else {
                    delete restoredBc.closedAt;
                    restoredBc.restoredAt = getServerNow();
                }
            });
        } else if (restoredWasRemoved) {
            const legacyCod = parseFloat(itemToRestore.cod) || 0;
            const legacyDod = parseFloat(itemToRestore.dod) || 0;
            const legacyCount = parseFloat(itemToRestore.count) || 1;
            appliedRevenueDeltas.push({ scanDate: revenueScanDate, cod: legacyCod, dod: legacyDod, count: legacyCount });
        }

        const applyRestoreMergeInto = (target) => {
            if (!target.barcodes || !Array.isArray(target.barcodes)) target.barcodes = [];
            if (itemToRestore.barcodes && Array.isArray(itemToRestore.barcodes)) {
                itemToRestore.barcodes.forEach(restoredBc => {
                    const existing = target.barcodes.find(b => b && b.code === restoredBc.code);
                    if (!existing) target.barcodes.push({ ...restoredBc });
                    else if (target.restoreClaimId === restoredId && !restoredBc.isClosed) existing.restoredAt = restoredBc.restoredAt;
                });
            }
            target.count = target.barcodes.length;
            recalcItemMoneyFromBarcodes(target);
            target.isClosed = target.barcodes.length > 0 && target.barcodes.every(b => b.isClosed);
            if (target.isClosed) {
                target.closedAt = getServerNow();
            } else {
                delete target.closedAt;
            }
            if (itemToRestore.callMarkTime && (!target.callMarkTime || itemToRestore.callMarkTime > target.callMarkTime)) {
                target.isCalled = itemToRestore.isCalled;
                if (itemToRestore.callMark) target.callMark = itemToRestore.callMark;
                else delete target.callMark;
                target.callMarkTime = itemToRestore.callMarkTime;
            }
            return target;
        };

        let prepared = await applyClaimedRestoreToHistory(targetId, restoredId, token, itemToRestore, applyRestoreMergeInto);
        if (prepared.targetChanged && targetId !== itemToRestore.id) {
            targetId = itemToRestore.id;
            await bindRestoreClaimTarget(restoredId, token, targetId);
            activeRestoreClaims.set(restoredId, { token, targetId });
            prepared = await applyClaimedRestoreToHistory(targetId, restoredId, token, itemToRestore, applyRestoreMergeInto);
        }
        if (prepared.targetChanged || !prepared.item) throw new Error('RESTORE_TARGET_CHANGED');
        await finalizeClaimedRestore(restoredId, token, targetId, appliedRevenueDeltas);
        activeRestoreClaims.delete(restoredId);
        await clearRestoreFinalization(restoredId, token).catch(() => {});
        const finalSnap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${targetId}`)));
        const resultingLiveItem = finalSnap.exists() ? cloneRestoreItem(finalSnap.val()) : prepared.item;
        const restoredCollectedKeys = (Array.isArray(itemToRestore.barcodes) ? itemToRestore.barcodes : [])
            .map((restoredBc) => pickupBarcodeKey(restoredBc && restoredBc.code))
            .filter(Boolean);
        if (restoredCollectedKeys.length) {
            await reconcileCollectedHistory(targetId, restoredCollectedKeys).catch(() => null);
        }
        openRecentlyDeletedModal();
        refreshCurrentHistoryView();
        updateRecentPhonesList();
        showToast("✅ បានស្តារទិន្នន័យមកទីតាំងដើមវិញដោយសុវត្ថិភាព!");
    } catch (error) {
        const alreadyRestored = !!(error && (error.message === 'ALREADY_RESTORED' || error.message === 'RESTORE_CLAIM_LOST'));
        if (error && error.message === 'RESTORE_CLAIM_LOST') activeRestoreClaims.delete(restoredId);
        if (!alreadyRestored) {
            console.error("Restore failed: ", restoredId, error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: "Restore failed: " });
        }
        try {
            const [histSnap, delSnap] = await dbOp(Promise.all([firebaseState.fb.get(firebaseState.dbRefHistory), firebaseState.fb.get(firebaseState.dbRefDeleted)]));
            const histData = histSnap.val();
            dataState.scanHistory = histData ? Object.keys(histData).map(k => { const v = histData[k]; if (v && !v.id) v.id = k; return normalizeBarcodesOf(v); }).filter(Boolean) : [];
            const delData = delSnap.val();
            dataState.deletedItems = delData ? Object.keys(delData).map(k => { const v = delData[k]; if (v && !v.id) v.id = k; return normalizeBarcodesOf(v); }).filter(Boolean) : [];
        } catch (resyncError) {
            console.error("Resync after failed restore also failed: ", resyncError);
            if (window.ZoeErrors) ZoeErrors.capture(resyncError, { zone: 'money', context: "Resync after failed restore also failed: " });
        }
        if (alreadyRestored) {
            alert("⚠️ ទិន្នន័យនេះត្រូវបានស្តារ ឬលុបចោលរួចហើយពី device ផ្សេង! ស្ថានភាពត្រូវបានធ្វើបច្ចុប្បន្នភាពវិញ។");
        } else {
            alert("❌ ស្តារទិន្នន័យបរាជ័យ! ទិន្នន័យនៅរក្សាទុកដោយសុវត្ថិភាព ហើយអាចសាកល្បងម្តងទៀតបាន។\n\nមូលហេតុ: " + (error && error.message ? error.message : error));
        }
        openRecentlyDeletedModal();
        refreshCurrentHistoryView();
    }
}

export function promptPermanentDelete(id?) {
    uiState.pendingPermanentDeleteId = id;
    const recentlyModal = byId('recentlyDeletedModal');
    if (recentlyModal) recentlyModal.style.display = 'none';
    openModalHelper('permanentDeleteWarningModal');
}

export function cancelPermanentDelete() {
    uiState.pendingPermanentDeleteId = null;
    closeModal('permanentDeleteWarningModal');
    openRecentlyDeletedModal();
}

export async function releaseStaleRestoreClaimForPurge(id) {
    if (!firebaseState.db || !firebaseState.fb || !id || !/^[a-zA-Z0-9_-]+$/.test(id)) return;
    await dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${id}`), (currentItem) => {
        if (!currentItem || !currentItem.restoreClaim) return;
        if (isActiveRestoreClaim(currentItem.restoreClaim)) return;
        delete currentItem.restoreClaim;
        return currentItem;
    }));
}

export async function executePermanentDelete() {
    const id = uiState.pendingPermanentDeleteId;
    uiState.pendingPermanentDeleteId = null;
    closeModal('permanentDeleteWarningModal');
    if (!id) { openRecentlyDeletedModal(); return; }

    const index = dataState.deletedItems.findIndex(i => i.id === id);
    if (index === -1) { openRecentlyDeletedModal(); return; }

    const purgedItem = dataState.deletedItems.splice(index, 1)[0];
    renderRecentlyDeleted();
    openRecentlyDeletedModal();

    try {
        await releaseStaleRestoreClaimForPurge(id);
        await notifyIfSlow(deleteSingleDeletedItemFromFirebase(id), TRASH_WRITE_SLOW_NOTICE_MS,
            "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងលុបជាអចិន្ត្រៃយ៍… សូមកុំបិទ App។");
        releaseBarcodesInRegistry(collectItemBarcodes(purgedItem));
    } catch (e) {
        if (!dataState.deletedItems.some((i) => i && i.id === id)) {
            dataState.deletedItems.splice(Math.min(index, dataState.deletedItems.length), 0, purgedItem);
        }
        renderRecentlyDeleted();
        showToast("⚠️ លុបជាអចិន្ត្រៃយ៍មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
    }
}
