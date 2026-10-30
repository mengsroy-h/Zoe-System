import { setModalDisplay } from '../core/modals';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { liveShopScope, shopScope } from '../core/shop-scope';
import { dataState, firebaseState, uiState } from '../core/state';
import { cleanupClockIsTrustworthy, getServerNow } from '../core/clock';
import { DB_LISTENER_KEY_DAILY_REVENUE, DB_LISTENER_KEY_DELETED, ZTO_RESTORE_FINAL_TEXT } from '../core/text';
import { getFormattedDate } from '../core/timezone';
import { barcodeEntriesOf, barcodeZtoSigned, generateUniqueId, itemHasRestoreMarkers, normalizeBarcodesOf } from '../domain/barcode';
import { reconcileCollectedHistory } from '../domain/collected';
import { getPickupPhoneKey, markPickupBarcodes, pickupBarcodeKey, pickupIntentTracker } from '../domain/pickup';
import { ledgerDedOf } from '../domain/ledger';
import { collectItemBarcodes, releaseBarcodesInRegistry } from '../domain/registry';
import { TRASH_WRITE_SLOW_NOTICE_MS } from './session';
import { openRecentlyDeletedModal, renderRecentlyDeleted, trashReasonDeducted } from './trash';
import { dbListenerViewIsStale, updateRecentPhonesList } from '../services/db-listeners';
import { deleteSingleDeletedItemFromFirebase } from '../services/history-write';
import { dbOp, notifyIfSlow } from '../services/network';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { rawSnapshotToItemList, recalcItemMoneyFromBarcodes } from '../ui/modal-stack';
import { showToast } from '../ui/toast';
import { trashRestoreBlockOf } from './zto-final-marks';
import { verifyZtoRestoreStatus } from './zto-restore-status';
import { txReadServerValue, txRestUrl } from '../services/tx-outcome';

export const RESTORE_CLAIM_LEASE_MS = 2 * 60 * 1000;
export const RESTORE_CLAIM_FUTURE_MS = 10 * 60 * 1000;

export const activeRestoreClaims = new Map();
export const restoreInFlight = new Set();
export const RESTORE_INTENTS_KEY = 'zoew_restore_intents_v1';

export function storedRestoreClaims() {
    try {
        const parsed = JSON.parse(safeStoreGet(appLocalStore, RESTORE_INTENTS_KEY) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) { return {}; }
}

export function saveRestoreClaim(id, claim) {
    const claims = storedRestoreClaims();
    if (claim) claims[id] = { ...claim, scope: liveShopScope() };
    else delete claims[id];
    if (!safeStoreSet(appLocalStore, RESTORE_INTENTS_KEY, JSON.stringify(claims))) throw new Error('write_journal_unavailable');
}

export function cloneRestoreItem(item) {
    if (!item || typeof item !== 'object') return null;
    const cloned = { ...item, barcodes: Array.isArray(item.barcodes) ? item.barcodes.map(b => b && typeof b === 'object' ? { ...b } : b) : item.barcodes };
    normalizeBarcodesOf(cloned);
    return cloned;
}

export function isRestoreMergeTarget(target, itemToRestore) {
    return !!(target && !target.clearClaim && itemToRestore && (!target.restoreClaimId || target.restoreClaimId === itemToRestore.id) && itemToRestore.phone !== "គ្មានលេខ" && target.phone === itemToRestore.phone && Array.isArray(target.barcodes) && Array.isArray(itemToRestore.barcodes) && target.scanDate === itemToRestore.scanDate && !target.isClosed);
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

export function restoreAddedCodesOf(item) {
    if (!item || typeof item.restoreAddedCodes !== 'string') return null;
    try {
        const codes = JSON.parse(item.restoreAddedCodes);
        return Array.isArray(codes) && codes.every(code => typeof code === 'string' && code.length > 0)
            && new Set(codes).size === codes.length ? codes : null;
    } catch (e) { return null; }
}

export function restorePendingCode(item, code) {
    if (!itemHasRestoreMarkers(item)) return false;
    const added = typeof item.restoreClaimToken === 'string' ? restoreAddedCodesOf(item) : null;
    return !added || added.includes(code);
}

export const restoreCancellationInFlight = new Set();
export const restoreRecoveryHolds = new Set();
export const RESTORE_ZTO_NEEDS_LOOKUP_TEXT = '⚠️ ហាងនេះប្រើ ZTO ៖ ស្តារពីឧបករណ៍ដែលភ្ជាប់ ZTO Lookup ដើម្បីផ្ទៀងស្ថានភាព Sign មុន។';
export const RESTORE_ZTO_UNCONFIRMED_TEXT = '⚠️ ZTO មិនអាចបញ្ជាក់ថាកញ្ចប់នេះមិនទាន់ Sign (ឧ. កញ្ចប់សាខាផ្សេង ឬ Function មិនទាន់កំណត់ស្ថានភាព Sign) — មិនស្តារដើម្បីការពារប្រាក់។';
export const RESTORE_SHOP_MODE_UNSYNCED_TEXT = '⏳ ការកំណត់ ZTO របស់ហាងមិនទាន់ Sync — សូមរង់ចាំបន្តិច ហើយស្តារម្តងទៀត។';
export function restoreLostCodesText(codes) {
    return '✅ បានស្តាររួច · Barcode ' + codes.length + ' (' + codes.slice(0, 5).join(', ') + (codes.length > 5 ? ' …' : '') + ') បានចេញពីជួរអតិថិជនមុនការស្តារចប់ ហើយមិនដាក់ចូលម្តងទៀតទេ។';
}
export const RESTORE_RECOVERY_REQUIRED_TEXT = '⚠️ ការស្តារនេះជាប់ (ទិន្នន័យការស្តារមិនត្រូវគ្នា) — បានរាយការណ៍ទៅអ្នកថែទាំ · កញ្ចប់នៅក្នុងធុងសំរាម មិនបូកប្រាក់វិញ។';

export async function cancelBlockedRestore(id, expectedToken?, opts?: { evidenceOnly?: boolean }) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || restoreCancellationInFlight.has(id)) return 'pending';
    const api = firebaseState.fb, cancelDb = firebaseState.db, generation = firebaseState.authGeneration, scope = shopScope();
    if (!api || !cancelDb) return 'pending';
    const current = () => firebaseState.db === cancelDb && firebaseState.authGeneration === generation && shopScope() === scope;
    let frozen = null, alreadyFrozen = false, rowWritten = false;
    restoreCancellationInFlight.add(id);
    try {
        const freeze = await dbOp(api.runTransaction(api.ref(cancelDb, `zoew_recently_deleted_cod_dod/${id}`), (item) => {
            frozen = null; alreadyFrozen = false;
            if (!current() || !item || expectedToken && item.restoreClaim?.token !== expectedToken) return;
            if (item.restoreBlocked !== true && !trashRestoreBlockOf(item, !!opts?.evidenceOnly)) return;
            if (opts?.evidenceOnly && item.restoreBlocked !== true && isActiveRestoreClaim(item.restoreClaim, RESTORE_CLAIM_FUTURE_MS)) return;
            frozen = cloneRestoreItem(item);
            if (item.restoreBlocked === true) { alreadyFrozen = true; return; }
            item.restoreBlocked = true;
            frozen = cloneRestoreItem(item);
            return item;
        }));
        if (!current() || !freeze?.committed && !alreadyFrozen || !frozen) return 'pending';
        const claim = frozen.restoreClaim;
        if (claim) {
            if (typeof claim.token !== 'string' || typeof claim.targetId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(claim.targetId)) return 'recovery-required';
            let settled = false, unproven = false, untouched = false;
            const cancelled = await dbOp(api.runTransaction(api.ref(cancelDb, `zoew_scan_history_cod_dod/${claim.targetId}`), (item) => {
                settled = false; unproven = false; untouched = false;
                if (!current()) return;
                if (!item || item.restoreClaimId !== id) { settled = true; untouched = true; return; }
                const added = typeof item.restoreClaimToken === 'string' ? restoreAddedCodesOf(item) : null;
                if (!added) { unproven = true; return; }
                const inserted = new Set(added);
                settled = true;
                return restoreRowWithout(item, (b) => inserted.has(b.code));
            }));
            rowWritten = !!cancelled?.committed;
            if (!current()) return 'pending';
            if (unproven) return 'recovery-required';
            if (!settled || !cancelled?.committed && !untouched) return 'pending';
            let released = false;
            const release = await dbOp(api.runTransaction(api.ref(cancelDb, `zoew_recently_deleted_cod_dod/${id}`), (item) => {
                released = false;
                if (!current() || !item || item.restoreBlocked !== true) return;
                if (!item.restoreClaim) { released = true; return item; }
                if (item.restoreClaim.token !== claim.token || item.restoreClaim.targetId !== claim.targetId) return;
                delete item.restoreClaim;
                released = true;
                return item;
            }));
            if (!current() || !release?.committed || !released) return 'pending';
        }
        const active = activeRestoreClaims.get(id);
        if (!active || !claim || active.token === claim.token) activeRestoreClaims.delete(id);
        const saved = storedRestoreClaims()[id];
        if (!saved || !claim || saved.token === claim.token) saveRestoreClaim(id, null);
        restoreRecoveryHolds.delete(id);
        return 'cancelled';
    } catch (error) {
        if (current() && window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: 'cancelBlockedRestore', itemId: id });
        return 'pending';
    } finally {
        restoreCancellationInFlight.delete(id);
        if (rowWritten && !current() && window.ZoeErrors) ZoeErrors.capture(new Error('Restore cancellation stopped after a session switch'), { zone: 'money', context: 'cancelBlockedRestore session switch', itemId: id });
    }
}

export async function readRestoreServerNode(api, readDb, path, budgetMs?) {
    const nodeRef = api.ref(readDb, path);
    const url = txRestUrl(nodeRef);
    if (url) return txReadServerValue(url, budgetMs);
    return (await dbOp(api.get(nodeRef))).val();
}

export function restoreRowWithout(item, drop) {
    const next = cloneRestoreItem(item);
    next.barcodes = (Array.isArray(next.barcodes) ? next.barcodes : []).filter(b => b && !drop(b));
    delete next.restoreClaimId;
    delete next.restoreClaimToken;
    delete next.restoreAddedCodes;
    if (!next.barcodes.length) return null;
    next.count = next.barcodes.length;
    recalcItemMoneyFromBarcodes(next);
    next.barcode = next.barcodes[0].code;
    const closedStamps = next.barcodes.map(b => b.closedAt).filter(stamp => typeof stamp === 'number' && isFinite(stamp));
    next.isClosed = next.barcodes.every(b => !!b.isClosed);
    if (!next.isClosed) delete next.closedAt;
    else if (closedStamps.length) next.closedAt = Math.max(...closedStamps);
    return next;
}

let restoreRecoveryHoldScope = '';

export function restoreAwaitsCancellation(item) {
    if (!item?.restoreClaim) return false;
    if (item.restoreBlocked === true) return true;
    return cleanupClockIsTrustworthy() && !dbListenerViewIsStale(DB_LISTENER_KEY_DELETED) && !activeRestoreClaims.has(item.id)
        && !isActiveRestoreClaim(item.restoreClaim, RESTORE_CLAIM_FUTURE_MS) && !!trashRestoreBlockOf(item, true);
}

export async function resumeBlockedRestoreCancellations() {
    const recoveryDb = firebaseState.db, generation = firebaseState.authGeneration, scope = shopScope();
    const current = () => firebaseState.db === recoveryDb && firebaseState.authGeneration === generation && shopScope() === scope;
    const rows = dataState.deletedItems.filter(restoreAwaitsCancellation);
    if (restoreRecoveryHoldScope !== scope) {
        restoreRecoveryHolds.clear();
        restoreRecoveryHoldScope = scope;
    }
    const ids = new Set(rows.map(item => item.id));
    for (const id of restoreRecoveryHolds) if (!ids.has(id)) restoreRecoveryHolds.delete(id);
    for (const item of rows) {
        if (!current()) return;
        if (!restoreAwaitsCancellation(dataState.deletedItems.find(entry => entry?.id === item.id))) continue;
        const outcome = await cancelBlockedRestore(item.id, item.restoreClaim.token, { evidenceOnly: true });
        if (!current()) return;
        if (outcome === 'recovery-required' && !restoreRecoveryHolds.has(item.id)) {
            restoreRecoveryHolds.add(item.id);
            if (window.ZoeErrors) ZoeErrors.capture(new Error('Restore held: prepared row cannot be cancelled'), { zone: 'money', context: 'resumeBlockedRestoreCancellations', itemId: item.id, targetId: item.restoreClaim.targetId || '' });
            showToast(RESTORE_RECOVERY_REQUIRED_TEXT);
        }
    }
}

export async function rejectBlockedRestore(item, expectedToken?) {
    const block = trashRestoreBlockOf(item);
    if (!block) return;
    if (block === 'returned' && !expectedToken && !item.restoreClaim && item.restoreBlocked !== true) throw new Error('RESTORE_ZTO_FINAL');
    const outcome = await cancelBlockedRestore(item.id, expectedToken);
    if (outcome === 'recovery-required') throw new Error('RESTORE_RECOVERY_REQUIRED');
    if (outcome !== 'cancelled') throw new Error('RESTORE_CANCEL_PENDING');
    throw new Error('RESTORE_ZTO_FINAL');
}

export function isActiveRestoreClaim(claim, futureMs = 0) {
    const claimedAt = claim && parseFloat(claim.claimedAt);
    const now = getServerNow();
    return !!(claim && typeof claim.token === 'string' && claim.token && isFinite(claimedAt) && claimedAt <= now + futureMs && (now - claimedAt) < RESTORE_CLAIM_LEASE_MS);
}

export function generateRestoreClaimToken() {
    return 'restore_' + generateUniqueId() + '_' + Math.random().toString(36).slice(2);
}

export async function claimDeletedItemForRestore(id, token, targetId) {
    let claimedItem = null;
    let replacedClaim = null;
    let claimStatus = 'ALREADY_RESTORED';
    let claimedTargetId = targetId;
    const trashRef = firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${id}`);
    const result = await dbOp(firebaseState.fb.runTransaction(trashRef, (currentItem) => {
        claimedItem = null;
        replacedClaim = null;
        claimStatus = 'ALREADY_RESTORED';
        if (!currentItem || typeof currentItem !== 'object') return;
        if (trashRestoreBlockOf(currentItem)) { claimStatus = 'RESTORE_ZTO_FINAL'; return; }
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
        claimedItem.id = id;
        claimedTargetId = existingClaim?.targetId || targetId;
        if (typeof claimedTargetId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(claimedTargetId)) { claimStatus = 'RESTORE_RECOVERY_REQUIRED'; return; }
        currentItem.restoreClaim = { token, claimedAt: getServerNow(), targetId: claimedTargetId };
        claimStatus = 'CLAIMED';
        return currentItem;
    }));
    if (!result || !result.committed || !claimedItem) throw new Error(claimStatus);
    return { item: claimedItem, replacedClaim, targetId: claimedTargetId };
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
    let lost = [];
    const result = await dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${targetId}`), (currentItem) => {
        targetChanged = false;
        committedItem = null;
        lost = [];
        if (currentItem) normalizeBarcodesOf(currentItem);
        if (currentItem && currentItem.clearClaim) {
            targetChanged = true;
            return;
        }
        const alreadyPrepared = currentItem && currentItem.restoreClaimId === sourceId;
        if (!alreadyPrepared && currentItem && !isRestoreMergeTarget(currentItem, itemToRestore)) {
            targetChanged = true;
            return;
        }
        const existingCodes = new Set((currentItem?.barcodes || []).map(b => b?.code));
        const newCodes = [...new Set((itemToRestore.barcodes || []).map(b => b?.code).filter(code => typeof code === 'string' && !existingCodes.has(code)))];
        if (alreadyPrepared) lost = newCodes;
        const added = alreadyPrepared ? restoreAddedCodesOf(currentItem) || [] : newCodes;
        const target = currentItem ? applyRestoreMergeInto(currentItem, added, !alreadyPrepared) : cloneRestoreItem(itemToRestore);
        if (!target) return;
        target.id = targetId;
        target.restoreClaimId = sourceId;
        target.restoreClaimToken = token;
        if (!alreadyPrepared) target.restoreAddedCodes = JSON.stringify(added);
        committedItem = target;
        return target;
    }));
    if (targetChanged) return { targetChanged: true, item: null, lost: [] };
    if (!result || !result.committed || !committedItem) throw new Error('RESTORE_HISTORY_WRITE_FAILED');
    const snapshotItem = result.snapshot ? cloneRestoreItem(result.snapshot.val()) : committedItem;
    return { targetChanged: false, item: snapshotItem, lost };
}

export function appendRestoreRevenueIncrements(updates, deltas) {
    const daily = {};
    const monthly = {};
    deltas.forEach((delta) => {
        const scanDate = delta.scanDate || getFormattedDate();
        const month = scanDate.substring(0, 7);
        if (!daily[scanDate]) daily[scanDate] = { cod: 0, dod: 0, count: 0 };
        if (!monthly[month]) monthly[month] = { cod: 0, dod: 0, count: 0 };
        if (delta.bucket !== 'monthly') {
            daily[scanDate].cod += parseFloat(delta.cod) || 0;
            daily[scanDate].dod += parseFloat(delta.dod) || 0;
            daily[scanDate].count += parseFloat(delta.count) || 0;
        }
        if (delta.bucket !== 'daily') {
            monthly[month].cod += parseFloat(delta.cod) || 0;
            monthly[month].dod += parseFloat(delta.dod) || 0;
            monthly[month].count += parseFloat(delta.count) || 0;
        }
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

export function restoreAwaitsLedgerView(item) {
    return !!item && (item.trashReason === 'returned' || item.trashReason === 'remove') && Array.isArray(item.barcodes) && item.barcodes.length > 0
        && !item.barcodes.some((b) => b && b.isDeducted) && dbListenerViewIsStale(DB_LISTENER_KEY_DAILY_REVENUE);
}

export async function restoreLedgerKeyFor(item, trashId, revenueDeltas) {
    const at = item ? item.deletedAt : null;
    const needsProof = !!item && (['returned', 'remove'].includes(item.trashReason) || item.isFromDeletion === false || item.deducted === true || barcodeEntriesOf(item.barcodes).some(({ barcode }) => barcode?.isDeducted));
    if (!item || !needsProof && !['returned', 'remove'].includes(item.trashReason)) return null;
    if (typeof at !== 'number' || !isFinite(at) || at <= 0) {
        if (needsProof) throw new Error('RESTORE_LEDGER_PROOF_REQUIRED');
        return null;
    }
    const scanDate = item.scanDate || getFormattedDate(new Date(at));
    if (typeof scanDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(scanDate) || !/^[a-zA-Z0-9_-]{1,64}$/.test(trashId)) {
        if (needsProof) throw new Error('RESTORE_LEDGER_PROOF_REQUIRED');
        return null;
    }
    const readDb = firebaseState.db;
    const generation = firebaseState.authGeneration;
    const api = firebaseState.fb;
    const paths = [`zoew_daily_revenue_cod_dod/${scanDate}`, `zoew_monthly_revenue_cod_dod/${scanDate.substring(0, 7)}`];
    const records = await Promise.all(paths.map(path => readRestoreServerNode(api, readDb, path)));
    if (firebaseState.db !== readDb || firebaseState.authGeneration !== generation) throw new Error('RESTORE_SESSION_SWITCHED');
    const entries = records.map(record => {
        const entry = ledgerDedOf(record, trashId);
        return entry && entry.at === at ? entry : null;
    });
    if (needsProof && entries.some(entry => !entry)) {
        const listed = barcodeEntriesOf(item.barcodes);
        const pending = listed.length > 0 && !listed.some(({ barcode }) => barcode?.isDeducted) && entries.every(entry => !entry);
        throw new Error(pending ? 'RESTORE_LEDGER_PENDING' : 'RESTORE_LEDGER_PROOF_REQUIRED');
    }
    if (!revenueDeltas.length && entries[0] && !entries[0].back) {
        revenueDeltas.push({ scanDate, cod: entries[0].cod, dod: entries[0].dod, count: entries[0].count });
    }
    const fallback = revenueDeltas.map(delta => ({ ...delta }));
    revenueDeltas.length = 0;
    const keys = [];
    ['daily', 'monthly'].forEach((bucket, i) => {
        const entry = entries[i];
        if (!entry) {
            fallback.forEach(delta => revenueDeltas.push({ ...delta, bucket }));
            return;
        }
        revenueDeltas.push({ scanDate, bucket, cod: entry.back ? 0 : entry.cod, dod: entry.back ? 0 : entry.dod, count: entry.back ? 0 : entry.count });
        keys.push({ path: `${paths[i]}/ded/${trashId}`, value: { at, cod: entry.cod, dod: entry.dod, count: entry.count, back: true, ...(entry.undo ? { undo: true } : {}) } });
    });
    return keys;
}

export async function finalizeClaimedRestore(sourceId, token, targetId, revenueDeltas, ledgerKey?, callPatch?, dropTarget?) {
    const target = `zoew_scan_history_cod_dod/${targetId}`;
    const updates = {
        [`zoew_restore_finalizations/${sourceId}`]: { token, targetId, finalizedAt: getServerNow() },
        [`zoew_recently_deleted_cod_dod/${sourceId}`]: null,
        ...(dropTarget ? { [target]: null } : { [`${target}/restoreClaimId`]: null, [`${target}/restoreClaimToken`]: null, [`${target}/restoreAddedCodes`]: null })
    };
    if (callPatch && !dropTarget) {
        for (const field of ['isCalled', 'callMark', 'callMarkTime']) {
            updates[`zoew_scan_history_cod_dod/${targetId}/${field}`] = callPatch[field];
        }
    }
    appendRestoreRevenueIncrements(updates, revenueDeltas);
    if (ledgerKey) (Array.isArray(ledgerKey) ? ledgerKey : [ledgerKey]).forEach(key => { updates[key.path] = key.value; });
    const finalizeDb = firebaseState.db;
    const finalizeGeneration = firebaseState.authGeneration;
    const stopIfSwitched = () => {
        if (firebaseState.db !== finalizeDb || firebaseState.authGeneration !== finalizeGeneration) throw new Error('RESTORE_SESSION_SWITCHED');
    };
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        stopIfSwitched();
        try {
            await dbOp(firebaseState.fb.update(firebaseState.fb.ref(finalizeDb), updates));
            return;
        } catch (error) {
            lastError = error;
            stopIfSwitched();
            let trashSnapshot;
            try {
                trashSnapshot = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(finalizeDb, `zoew_recently_deleted_cod_dod/${sourceId}`)));
            } catch (readError) {
                throw error;
            }
            stopIfSwitched();
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
    if (restoreInFlight.has(restoredId)) return;
    restoreInFlight.add(restoredId);
    closeModal('restoreWarningModal');
    uiState.pendingRestoreId = null;
    const restoreDb = firebaseState.db;
    const restoreGeneration = firebaseState.authGeneration;
    const restoreIsCurrent = () => firebaseState.db === restoreDb && firebaseState.authGeneration === restoreGeneration;
    const stopIfSwitched = () => {
        if (!restoreIsCurrent()) throw new Error('RESTORE_SESSION_SWITCHED');
    };
    let pickupJournal = null;
    let pickupContext = null;
    try {
        const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
        if (!safeIdPattern.test(restoredId)) {
            throw new Error('Unsafe id during restore');
        }
        const stored = storedRestoreClaims()[restoredId];
        const savedClaim = stored && stored.scope === liveShopScope() && typeof stored.token === 'string' && typeof stored.targetId === 'string' && safeIdPattern.test(stored.targetId) ? stored : null;
        const existingClaim = activeRestoreClaims.get(restoredId) || savedClaim;
        const token = existingClaim ? existingClaim.token : generateRestoreClaimToken();
        let targetId = existingClaim ? existingClaim.targetId : null;
        const previewSnap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${restoredId}`)));
        if (!previewSnap.exists()) throw new Error('ALREADY_RESTORED');
        const previewItem = cloneRestoreItem(previewSnap.val());
        if (!previewItem) throw new Error('ALREADY_RESTORED');
        previewItem.id = restoredId;
        stopIfSwitched();
        if (restoreAwaitsLedgerView(previewItem)) throw new Error('RESTORE_LEDGER_UNSYNCED');
        await rejectBlockedRestore(previewItem);
        try {
            await verifyZtoRestoreStatus(previewItem);
        } catch (error) {
            stopIfSwitched();
            if (error?.message === 'RESTORE_ZTO_FINAL') await rejectBlockedRestore(previewItem);
            throw error;
        }
        stopIfSwitched();
        await rejectBlockedRestore(previewItem);
        if (Array.isArray(previewItem.barcodes)) {
            await restoreLedgerKeyFor(previewItem, restoredId, []);
            stopIfSwitched();
        }
        if (!targetId) {
            targetId = await findRestoreTargetId(previewItem);
            stopIfSwitched();
        }
        const previewPickupKeys = trashReasonDeducted(previewItem) ? barcodeEntriesOf(previewItem.barcodes)
            .filter(({ barcode }) => barcode?.isClosed).map(({ barcode }) => pickupBarcodeKey(barcode.code)).filter(Boolean) : [];
        if (previewPickupKeys.length) {
            pickupJournal = pickupIntentTracker(restoreIsCurrent, targetId);
            pickupContext = await pickupJournal.prepare(previewItem.scanDate || getFormattedDate(), previewPickupKeys, false);
            if (!pickupContext || !pickupJournal.start()) throw new Error('PICKUP_ADMISSION_FAILED');
            stopIfSwitched();
        }
        saveRestoreClaim(restoredId, { token, targetId });
        const claimed = await claimDeletedItemForRestore(restoredId, token, targetId);
        stopIfSwitched();
        targetId = claimed.targetId;
        saveRestoreClaim(restoredId, { token, targetId });
        activeRestoreClaims.set(restoredId, { token, targetId });

        const claimedSource = cloneRestoreItem(claimed.item);
        let itemToRestore = claimed.item;
        await rejectBlockedRestore(itemToRestore, token);
        if (restoreAwaitsLedgerView(itemToRestore)) throw new Error('RESTORE_LEDGER_UNSYNCED');
        const restoredTrash = { trashReason: itemToRestore.trashReason, deletedAt: itemToRestore.deletedAt, scanDate: itemToRestore.scanDate, isFromDeletion: itemToRestore.isFromDeletion, deducted: barcodeEntriesOf(itemToRestore.barcodes).some(({ barcode }) => barcode?.isDeducted) };
        delete itemToRestore.deletedAt;
        delete itemToRestore.isFromDeletion;
        delete itemToRestore.trashReason;
        delete itemToRestore.trashMode;
        delete itemToRestore.restoreBlocked;
        delete itemToRestore.restoreClaim;
        delete itemToRestore.restoreClaimId;
        delete itemToRestore.restoreClaimToken;
        delete itemToRestore.restoreAddedCodes;
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
                delete restoredBc.pickupTransition;
                delete restoredBc.ztoReturnedAt;
                delete restoredBc.ztoMisplacedAt;
                delete restoredBc.ztoSentOutAt;
                if (restoredBc.isClosed) restoredBc.closedAt = getServerNow();
                else {
                    delete restoredBc.closedAt;
                    restoredBc.restoredAt = getServerNow();
                }
            });
        }

        const restoredLedgerKey = await restoreLedgerKeyFor(restoredTrash, restoredId, appliedRevenueDeltas);
        stopIfSwitched();
        const applyRestoreMergeInto = (target, addedCodes, insertMissing = true) => {
            if (!target.barcodes || !Array.isArray(target.barcodes)) target.barcodes = [];
            if (itemToRestore.barcodes && Array.isArray(itemToRestore.barcodes)) {
                itemToRestore.barcodes.forEach(restoredBc => {
                    const existing = target.barcodes.find(b => b && b.code === restoredBc.code);
                    if (!existing) { if (insertMissing) target.barcodes.push({ ...restoredBc }); }
                    else if (target.restoreClaimId === restoredId && addedCodes?.includes(restoredBc.code) && !restoredBc.isClosed) existing.restoredAt = restoredBc.restoredAt;
                });
            }
            target.count = target.barcodes.length;
            recalcItemMoneyFromBarcodes(target);
            return target;
        };

        let prepared = await applyClaimedRestoreToHistory(targetId, restoredId, token, itemToRestore, applyRestoreMergeInto);
        stopIfSwitched();
        if (prepared.targetChanged) {
            targetId = generateUniqueId();
            saveRestoreClaim(restoredId, { token, targetId });
            await bindRestoreClaimTarget(restoredId, token, targetId);
            stopIfSwitched();
            activeRestoreClaims.set(restoredId, { token, targetId });
            prepared = await applyClaimedRestoreToHistory(targetId, restoredId, token, itemToRestore, applyRestoreMergeInto);
            stopIfSwitched();
        }
        if (prepared.targetChanged || !prepared.item) throw new Error('RESTORE_TARGET_CHANGED');
        await rejectBlockedRestore(claimedSource, token);
        stopIfSwitched();
        const callPatch = itemToRestore.callMarkTime && (!prepared.item.callMarkTime || itemToRestore.callMarkTime > prepared.item.callMarkTime)
            ? { isCalled: itemToRestore.isCalled === true, callMark: itemToRestore.callMark || null, callMarkTime: itemToRestore.callMarkTime }
            : null;
        const lostCodes = new Set(prepared.lost || []);
        const pickupMarks = trashReasonDeducted(claimedSource)
            ? barcodeEntriesOf(itemToRestore.barcodes).map(({ barcode }) => barcode)
                .filter((barcode) => barcode && barcode.isClosed && !lostCodes.has(barcode.code) && pickupBarcodeKey(barcode.code))
                .map((barcode) => ({ key: pickupBarcodeKey(barcode.code), phoneKey: getPickupPhoneKey(prepared.item), closed: true }))
            : [];
        if (pickupJournal && !pickupJournal.setItem(targetId)) throw new Error('PICKUP_ADMISSION_FAILED');
        if (pickupMarks.length && (!pickupJournal || !pickupJournal.add(revenueScanDate, pickupMarks.map((mark) => mark.key)))) throw new Error('PICKUP_ADMISSION_FAILED');
        await finalizeClaimedRestore(restoredId, token, targetId, appliedRevenueDeltas, restoredLedgerKey, callPatch, lostCodes.size > 0 && !barcodeEntriesOf(prepared.item.barcodes).length);
        stopIfSwitched();
        if (pickupJournal && !pickupJournal.confirm(pickupMarks.map((mark) => mark.key))) throw new Error('PICKUP_ADMISSION_FAILED');
        if (pickupMarks.length) pickupJournal.note(markPickupBarcodes(revenueScanDate, pickupMarks, false, pickupContext));
        const pickupSaved = await (pickupJournal?.finish() || Promise.resolve(true));
        activeRestoreClaims.delete(restoredId);
        saveRestoreClaim(restoredId, null);
        await clearRestoreFinalization(restoredId, token).catch(() => {});
        stopIfSwitched();
        const restoredCollectedKeys = (Array.isArray(itemToRestore.barcodes) ? itemToRestore.barcodes : [])
            .filter((restoredBc) => restoredBc && !lostCodes.has(restoredBc.code))
            .map((restoredBc) => pickupBarcodeKey(restoredBc && restoredBc.code))
            .filter(Boolean);
        if (restoredCollectedKeys.length) {
            await reconcileCollectedHistory(targetId, restoredCollectedKeys).catch(() => null);
        }
        openRecentlyDeletedModal();
        refreshCurrentHistoryView();
        updateRecentPhonesList();
        if (lostCodes.size) {
            const lostList = [...lostCodes];
            if (window.ZoeErrors) ZoeErrors.capture(new Error('Restore finished without codes that left the prepared row'), { zone: 'money', context: 'executeRestoreItem lost codes', itemId: restoredId, targetId, lostCount: lostList.length, lostBarcodes: lostList.slice(0, 20).join(' · ') });
            showToast(restoreLostCodesText(lostList));
        } else showToast(pickupSaved ? "✅ បានស្តារទិន្នន័យមកទីតាំងដើមវិញដោយសុវត្ថិភាព!" : "⏳ ស្តារបញ្ជីរួច — ស្ថិតិយកនៅរង់ចាំផ្ទៀងផ្ទាត់។");
    } catch (error) {
        if (!restoreIsCurrent()) {
            if (window.ZoeErrors) ZoeErrors.capture(new Error('Restore stopped after a database switch'), { zone: 'money', context: 'executeRestoreItem session switch', itemId: restoredId });
            return;
        }
        if (error && (error.message === 'RESTORE_RECOVERY_REQUIRED' || error.message === 'RESTORE_CANCEL_PENDING')) {
            if (error.message === 'RESTORE_RECOVERY_REQUIRED' && window.ZoeErrors) ZoeErrors.capture(new Error('Restore held: prepared row cannot be completed'), { zone: 'money', context: 'executeRestoreItem held', itemId: restoredId });
            showToast(error.message === 'RESTORE_RECOVERY_REQUIRED' ? RESTORE_RECOVERY_REQUIRED_TEXT : '⏳ កំពុងបញ្ចប់ការបោះបង់ស្តារ។ សូមរង់ចាំ Sync។');
            openRecentlyDeletedModal();
            return;
        }
        if (error && error.message === 'RESTORE_ZTO_FINAL') {
            showToast(ZTO_RESTORE_FINAL_TEXT);
            openRecentlyDeletedModal();
            return;
        }
        if (error && error.message === 'RESTORE_ZTO_UNVERIFIED') {
            showToast('⚠️ មិនទាន់អាចផ្ទៀងផ្ទាត់ស្ថានភាព ZTO បាន។ សូមភ្ជាប់បណ្តាញ ហើយសាកស្តារម្តងទៀត។');
            openRecentlyDeletedModal();
            return;
        }
        if (error && error.message === 'RESTORE_ZTO_UNCONFIRMED') {
            showToast(RESTORE_ZTO_UNCONFIRMED_TEXT);
            openRecentlyDeletedModal();
            return;
        }
        if (error && error.message === 'RESTORE_ZTO_NEEDS_LOOKUP') {
            showToast(RESTORE_ZTO_NEEDS_LOOKUP_TEXT);
            openRecentlyDeletedModal();
            return;
        }
        if (error && error.message === 'RESTORE_SHOP_MODE_UNSYNCED') {
            showToast(RESTORE_SHOP_MODE_UNSYNCED_TEXT);
            openRecentlyDeletedModal();
            return;
        }
        if (error && error.message === 'RESTORE_LEDGER_PROOF_REQUIRED') {
            showToast('⚠️ មិនទាន់អាចស្តារបាន៖ ខ្វះភស្តុតាងប្រាក់ដែលបានដកតាមថ្ងៃ ឬខែ។ សូមឱ្យអ្នកថែទាំពិនិត្យទិន្នន័យ មិនបូកប្រាក់តាមការសន្មតទេ។');
            openRecentlyDeletedModal();
            return;
        }
        if (error && error.message === 'RESTORE_LEDGER_PENDING') {
            showToast('⏳ ការដកប្រាក់នៃកញ្ចប់នេះមិនទាន់បញ្ចប់នៅឧបករណ៍ដែលដក ឬសម្អាត — បើកឧបករណ៍នោះពេលមានបណ្តាញ រួចស្តារម្តងទៀត');
            openRecentlyDeletedModal();
            return;
        }
        if (error && error.message === 'RESTORE_LEDGER_UNSYNCED') {
            showToast('⏳ ស្ថិតិចំណូលមិនទាន់ Sync — សូមរង់ចាំបន្តិច ហើយស្តារម្តងទៀត');
            openRecentlyDeletedModal();
            return;
        }
        const alreadyRestored = !!(error && (error.message === 'ALREADY_RESTORED' || error.message === 'RESTORE_CLAIM_LOST'));
        if (alreadyRestored || error && error.message === 'RESTORE_IN_PROGRESS') {
            activeRestoreClaims.delete(restoredId);
            saveRestoreClaim(restoredId, null);
        }
        if (!alreadyRestored) {
            console.error("Restore failed: ", restoredId, error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: "Restore failed: " });
        }
        try {
            const historyBeforeRead = dataState.scanHistory;
            const deletedBeforeRead = dataState.deletedItems;
            const [histSnap, delSnap] = await dbOp(Promise.all([firebaseState.fb.get(firebaseState.dbRefHistory), firebaseState.fb.get(firebaseState.dbRefDeleted)]));
            if (!restoreIsCurrent()) return;
            if (dataState.scanHistory === historyBeforeRead) dataState.scanHistory = rawSnapshotToItemList(histSnap.val(), 'history').map(normalizeBarcodesOf);
            if (dataState.deletedItems === deletedBeforeRead) dataState.deletedItems = rawSnapshotToItemList(delSnap.val(), 'deleted').map(normalizeBarcodesOf);
        } catch (resyncError) {
            if (!restoreIsCurrent()) return;
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
    } finally {
        if (pickupJournal) pickupJournal.release();
        restoreInFlight.delete(restoredId);
    }
}

export function promptPermanentDelete(id?) {
    uiState.pendingPermanentDeleteId = id;
    setModalDisplay('recentlyDeletedModal', 'none');
    openModalHelper('permanentDeleteWarningModal');
}

export function cancelPermanentDelete() {
    uiState.pendingPermanentDeleteId = null;
    closeModal('permanentDeleteWarningModal');
    openRecentlyDeletedModal();
}

export async function releaseStaleRestoreClaimForPurge(id) {
    const purgeDb = firebaseState.db, api = firebaseState.fb, generation = firebaseState.authGeneration;
    if (!purgeDb || !api || !id || !/^[a-zA-Z0-9_-]+$/.test(id)) return false;
    const current = () => firebaseState.db === purgeDb && firebaseState.authGeneration === generation;
    const source = (await dbOp(api.get(api.ref(purgeDb, `zoew_recently_deleted_cod_dod/${id}`)))).val();
    if (!current()) return false;
    if (!source?.restoreClaim) return true;
    if (source.restoreBlocked === true || isActiveRestoreClaim(source.restoreClaim)) return false;
    const claim = source.restoreClaim;
    if (typeof claim.targetId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(claim.targetId)) return false;
    const target = (await dbOp(api.get(api.ref(purgeDb, `zoew_scan_history_cod_dod/${claim.targetId}`)))).val();
    if (!current() || target?.restoreClaimId === id) return false;
    let released = false;
    await dbOp(api.runTransaction(api.ref(purgeDb, `zoew_recently_deleted_cod_dod/${id}`), (currentItem) => {
        released = false;
        if (!current()) return;
        if (!currentItem?.restoreClaim) { released = true; return; }
        if (currentItem.restoreBlocked === true || isActiveRestoreClaim(currentItem.restoreClaim)) return;
        if (currentItem.restoreClaim.token !== claim.token || currentItem.restoreClaim.targetId !== claim.targetId) return;
        delete currentItem.restoreClaim;
        if (barcodeEntriesOf(currentItem.barcodes).some(({ barcode }) => barcodeZtoSigned(barcode))) currentItem.restoreBlocked = true;
        released = true;
        return currentItem;
    }));
    return current() && released;
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

    const purgeDb = firebaseState.db;
    const purgeGeneration = firebaseState.authGeneration;
    const purgeIsCurrent = () => firebaseState.db === purgeDb && firebaseState.authGeneration === purgeGeneration;
    try {
        await releaseStaleRestoreClaimForPurge(id);
        if (!purgeIsCurrent()) return;
        await notifyIfSlow(deleteSingleDeletedItemFromFirebase(id), TRASH_WRITE_SLOW_NOTICE_MS,
            "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងលុបជាអចិន្ត្រៃយ៍… សូមកុំបិទ App។");
        if (!purgeIsCurrent()) return;
        releaseBarcodesInRegistry(collectItemBarcodes(purgedItem));
    } catch (e) {
        if (!purgeIsCurrent()) return;
        if (!dataState.deletedItems.some((i) => i && i.id === id)) {
            dataState.deletedItems.splice(Math.min(index, dataState.deletedItems.length), 0, purgedItem);
        }
        renderRecentlyDeleted();
        showToast("⚠️ លុបជាអចិន្ត្រៃយ៍មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
    }
}
