import { dataState, firebaseState } from '../core/state';
import { getServerNow } from '../core/clock';
import { generateUniqueId, stripHistoryOnlyMarkers } from '../domain/barcode';
import { deleteSingleItem } from './entry-ops';
import { getCurrentFilterLabel } from './export';
import { requestPinBeforeConfig } from './pin';
import { activeRestoreClaims, cloneRestoreItem } from './restore';
import { updateRecentPhonesList } from '../services/db-listeners';
import { dbOp, dbOpStalled } from '../services/network';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { CLEAR_HISTORY_CLAIM_LEASE_MS, activeClearHistoryClaims } from '../ui/history-render';
import { getFilteredDataByDate } from '../ui/more-menu';
import { showToast } from '../ui/toast';

export function resetClearHistoryOperationState() {
    dataState.clearHistoryInFlight = false;
    dataState.pickupResetInFlight = false;
    activeRestoreClaims.clear();
    activeClearHistoryClaims.clear();
}

export function isActiveClearHistoryClaim(claim) {
    const claimedAt = claim && parseFloat(claim.claimedAt);
    const now = getServerNow();
    return !!(claim && typeof claim.token === 'string' && claim.token && isFinite(claimedAt) && claimedAt <= now && (now - claimedAt) < CLEAR_HISTORY_CLAIM_LEASE_MS);
}

export const staleClearClaimSweeps = new Set();

export function releaseStaleClearHistoryClaim(item) {
    if (!firebaseState.db || !firebaseState.fb || !item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) return;
    if (!item.clearClaim || isActiveClearHistoryClaim(item.clearClaim)) return;
    if (activeClearHistoryClaims.has(item.id)) return;
    if (staleClearClaimSweeps.has(item.id)) return;
    staleClearClaimSweeps.add(item.id);
    const release = () => { staleClearClaimSweeps.delete(item.id); };
    dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${item.id}`), (currentItem) => {
        if (!currentItem || !currentItem.clearClaim) return;
        if (isActiveClearHistoryClaim(currentItem.clearClaim)) return;
        delete currentItem.clearClaim;
        return currentItem;
    })).then(release, (error) => {
        release();
        if (dbOpStalled(error)) return;
        console.error('Failed to release stale clear-history claim for', item.id, error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: 'releaseStaleClearHistoryClaim', itemId: item.id });
    });
}

export function generateClearHistoryClaimToken() {
    return 'clear_' + generateUniqueId() + '_' + Math.random().toString(36).slice(2);
}

export function buildClearHistoryTrashItem(item, id) {
    const trashItem = cloneRestoreItem(item);
    if (!trashItem) return null;
    trashItem.id = id;
    stripHistoryOnlyMarkers(trashItem);
    trashItem.deletedAt = getServerNow();
    trashItem.isFromDeletion = true;
    trashItem.trashReason = 'delete';
    if (Array.isArray(trashItem.barcodes)) {
        trashItem.barcodes = trashItem.barcodes.map((barcode) => ({ ...barcode, isFromDeletion: true }));
    }
    return trashItem;
}

export async function claimHistoryItemForClear(id, token) {
    let claimedItem = null;
    let status = 'CLEAR_HISTORY_MISSING';
    const itemRef = firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`);
    const result = await dbOp(firebaseState.fb.runTransaction(itemRef, (currentItem) => {
        claimedItem = null;
        status = 'CLEAR_HISTORY_MISSING';
        if (!currentItem || typeof currentItem !== 'object') return;
        if (currentItem.restoreClaimId || currentItem.restoreClaimToken) {
            status = 'RESTORE_IN_PROGRESS';
            return;
        }
        const existingClaim = currentItem.clearClaim;
        if (existingClaim && existingClaim.token !== token && isActiveClearHistoryClaim(existingClaim)) {
            status = 'CLEAR_HISTORY_IN_PROGRESS';
            return;
        }
        claimedItem = cloneRestoreItem(currentItem);
        if (!claimedItem) return;
        delete claimedItem.clearClaim;
        currentItem.clearClaim = { token, claimedAt: getServerNow() };
        status = 'CLEAR_HISTORY_CLAIMED';
        return currentItem;
    }));
    if (!result || !result.committed || !claimedItem) throw new Error(status);
    return claimedItem;
}

export async function clearClearHistoryFinalization(id, token) {
    await dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_clear_history_finalizations/${id}`), (currentFinalization) => {
        if (!currentFinalization || currentFinalization.token !== token) return;
        return null;
    }));
}

export async function finalizeClaimedHistoryClear(id, token, trashItem) {
    const finalizeDb = firebaseState.db;
    const finalizeGeneration = firebaseState.authGeneration;
    const finalizeIsCurrent = () => firebaseState.db === finalizeDb && firebaseState.authGeneration === finalizeGeneration;
    const updates = {
        [`zoew_clear_history_finalizations/${id}`]: { token, finalizedAt: getServerNow() },
        [`zoew_recently_deleted_cod_dod/${id}`]: trashItem,
        [`zoew_scan_history_cod_dod/${id}`]: null
    };
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        if (!finalizeIsCurrent()) throw new Error('CLEAR_HISTORY_SESSION_SWITCHED');
        try {
            await dbOp(firebaseState.fb.update(firebaseState.fb.ref(firebaseState.db), updates));
            return;
        } catch (error) {
            lastError = error;
            let historySnapshot;
            let trashSnapshot;
            let finalizationSnapshot;
            try {
                [historySnapshot, trashSnapshot, finalizationSnapshot] = await dbOp(Promise.all([
                    firebaseState.fb.get(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`)),
                    firebaseState.fb.get(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${id}`)),
                    firebaseState.fb.get(firebaseState.fb.ref(firebaseState.db, `zoew_clear_history_finalizations/${id}`))
                ]));
            } catch (readError) {
                throw error;
            }
            if (!finalizeIsCurrent()) throw new Error('CLEAR_HISTORY_SESSION_SWITCHED');
            const finalization = finalizationSnapshot.exists() ? finalizationSnapshot.val() : null;
            if (!historySnapshot.exists() && trashSnapshot.exists() && finalization && finalization.token === token) return;
            const currentHistory = historySnapshot.exists() ? historySnapshot.val() : null;
            if (!currentHistory || !currentHistory.clearClaim || currentHistory.clearClaim.token !== token) {
                throw new Error('CLEAR_HISTORY_CLAIM_LOST');
            }
            if (trashSnapshot.exists()) throw new Error('CLEAR_HISTORY_SLOT_TAKEN');
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
        }
    }
    throw lastError || new Error('CLEAR_HISTORY_FINAL_WRITE_FAILED');
}

export async function releaseOwnClearHistoryClaim(id, token) {
    let released = false;
    const result = await dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`), (currentItem) => {
        released = false;
        if (!currentItem || !currentItem.clearClaim || currentItem.clearClaim.token !== token) return;
        delete currentItem.clearClaim;
        released = true;
        return currentItem;
    }));
    if (!result || !result.committed || !released) throw new Error('CLEAR_HISTORY_CLAIM_LOST');
}

export async function deleteBesideTakenTrashSlot(id, token) {
    const besideDb = firebaseState.db;
    const besideGeneration = firebaseState.authGeneration;
    await releaseOwnClearHistoryClaim(id, token);
    activeClearHistoryClaims.delete(id);
    if (firebaseState.db !== besideDb || firebaseState.authGeneration !== besideGeneration) throw new Error('CLEAR_HISTORY_SESSION_SWITCHED');
    const outcome = await deleteSingleItem(id, { confirmed: true, quiet: true });
    if (outcome === 'deleted') return;
    if (outcome === 'pending') throw new Error('CLEAR_HISTORY_DELETE_PENDING');
    if (outcome === 'blocked' || outcome === 'missing') throw new Error('CLEAR_HISTORY_IN_PROGRESS');
    throw new Error('CLEAR_HISTORY_DELETE_FAILED');
}

export function requestPinBeforeClearHistory() {
    requestPinBeforeConfig(clearHistory, 'clearHistory');
}

export async function clearHistory() {
    if (dataState.clearHistoryInFlight) return;
    const filterLabel = getCurrentFilterLabel();
    const clearedIds = getFilteredDataByDate().map(item => item.id).filter(Boolean);
    if (clearedIds.length === 0) {
        showToast(`⚠️ គ្មានទិន្នន័យក្នុងតម្រង «${filterLabel}» ដើម្បីលុបទេ។`);
        return;
    }
    if (!confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យក្នុងតម្រង «${filterLabel}» ចំនួន ${clearedIds.length} ធាតុមែនទេ? (ទិន្នន័យថ្ងៃផ្សេងមិនប៉ះពាល់ទេ)`)) return;
    const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!firebaseState.dbRefHistory || !firebaseState.dbRefDeleted || !firebaseState.db || !firebaseState.fb || clearedIds.some(id => !safeIdPattern.test(id))) {
        showToast("⚠️ មិនអាចលុបប្រវត្តិបានទេ! សូមពិនិត្យការតភ្ជាប់ Firebase ហើយសាកល្បងម្តងទៀត។");
        return;
    }

    dataState.clearHistoryInFlight = true;
    const clearDb = firebaseState.db;
    const clearGeneration = firebaseState.authGeneration;
    const clearIsCurrent = () => firebaseState.db === clearDb && firebaseState.authGeneration === clearGeneration;
    let clearedCount = 0;
    let blockedCount = 0;
    let failedCount = 0;
    let stalled = false;
    try {
        for (const id of clearedIds) {
            if (!clearIsCurrent()) return;
            const previous = activeClearHistoryClaims.get(id);
            const token = previous || generateClearHistoryClaimToken();
            try {
                const claimedItem = await claimHistoryItemForClear(id, token);
                if (!clearIsCurrent()) return;
                activeClearHistoryClaims.set(id, token);
                const trashItem = buildClearHistoryTrashItem(claimedItem, id);
                if (!trashItem) throw new Error('CLEAR_HISTORY_SOURCE_INVALID');
                try {
                    await finalizeClaimedHistoryClear(id, token, trashItem);
                } catch (finalErr) {
                    if (!finalErr || finalErr.message !== 'CLEAR_HISTORY_SLOT_TAKEN') throw finalErr;
                    await deleteBesideTakenTrashSlot(id, token);
                    clearedCount++;
                    continue;
                }
                activeClearHistoryClaims.delete(id);
                if (!clearIsCurrent()) return;
                await clearClearHistoryFinalization(id, token).catch(() => {});
                clearedCount++;
            } catch (error) {
                if (!clearIsCurrent()) return;
                const code = error && error.message;
                if (code === 'CLEAR_HISTORY_DELETE_PENDING') { stalled = true; break; }
                if (code === 'CLEAR_HISTORY_MISSING' || code === 'CLEAR_HISTORY_IN_PROGRESS' || code === 'RESTORE_IN_PROGRESS' || code === 'CLEAR_HISTORY_CLAIM_LOST') {
                    blockedCount++;
                } else {
                    failedCount++;
                    console.error('Error clearing history item:', id, error);
                    if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: 'Error clearing history item', itemId: id });
                    if (dbOpStalled(error)) { stalled = true; break; }
                }
            }
        }
        refreshCurrentHistoryView();
        updateRecentPhonesList();
        if (stalled) {
            showToast(clearedCount
                ? `⚠️ បណ្តាញឆ្លើយមិនចេញ — លុបបានតែ ${clearedCount} ធាតុ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។`
                : "⚠️ បណ្តាញឆ្លើយមិនចេញ — លុបមិនបានទេ។ ទិន្នន័យនៅរក្សាទុកដោយសុវត្ថិភាព។");
        } else if (clearedCount && !blockedCount && !failedCount) {
            showToast(`✅ បានលុបទិន្នន័យក្នុងតម្រង «${filterLabel}» ចំនួន ${clearedCount} ធាតុ!`);
        } else if (clearedCount) {
            showToast(`⚠️ បានលុប ${clearedCount} ធាតុ។ ធាតុខ្លះកំពុងត្រូវបានកែពីឧបករណ៍ផ្សេង ឬអាចសាកល្បងម្ដងទៀតបាន។`);
        } else if (blockedCount) {
            showToast("⚠️ ធាតុខ្លះត្រូវបានកែ ឬស្តារពីឧបករណ៍ផ្សេង។ សូមរង់ចាំបន្តិច ហើយសាកល្បងម្ដងទៀត។");
        } else {
            showToast(`⚠️ លុបទិន្នន័យក្នុងតម្រង «${filterLabel}» មិនបានជោគជ័យ! ទិន្នន័យនៅរក្សាទុកដោយសុវត្ថិភាព ហើយអាចសាកល្បងម្តងទៀតបាន។`);
        }
    } finally {
        dataState.clearHistoryInFlight = false;
    }
}
