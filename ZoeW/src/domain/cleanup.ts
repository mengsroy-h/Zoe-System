import { dataState, firebaseState } from '../core/state';
import { cleanupClockIsTrustworthy, getServerNow } from '../core/clock';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { CLEANUP_JOURNAL_KEY } from '../core/storage-keys';
import { DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY } from '../core/text';
import { getFormattedDate } from '../core/timezone';
import { barcodeAbandonIsRipe, barcodeCloseIsRipe, itemAbandonRipeAt, barcodeEntriesOf, generateUniqueId, itemHasRestoreMarkers, normalizeBarcodeCloseStamps, normalizeBarcodesOf, parseTimestampFromId, stripHistoryOnlyMarkers } from './barcode';
import { runAutomaticCollectedCleanup } from './collected';
import { addRevenueToDailyAndMonthlyRecord, correctRevenueLedgerToActual } from './ledger';
import { repairPickupLedgerOnce } from './pickup';
import { collectItemBarcodes, flushPendingRegistryReleases, releaseBarcodesInRegistry } from './registry';
import { releaseStaleClearHistoryClaim } from '../features/clear-history';
import { activeRestoreClaims, cloneRestoreItem, isActiveRestoreClaim, releaseStaleRestoreClaimForPurge } from '../features/restore';
import { ABANDON_AGE_MS, EXPIRED_TRASH_RETENTION_MS, TRASH_RETENTION_MS, TRASH_WRITE_SLOW_NOTICE_MS, TWO_HOURS_MS } from '../features/session';
import { ztoAbandonCleanupIsHeld } from '../features/zto-status';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { purgeDeletedItemsQuietly, saveSingleDeletedItemToFirebase } from '../services/history-write';
import { LOCK_STALL_RELEASE_MS, armLateCommit, armLateWrite, dbOp, dbOpStalled, notifyIfSlow, retryAsync, settleLockWithin } from '../services/network';
import { recalcItemMoneyFromBarcodes } from '../ui/modal-stack';
import { showToast } from '../ui/toast';

export const cleanupInFlight = new Set();

export const staleRestoreMarkerSweeps = new Set();

export function trashRetentionMs(item) {
    return item && item.trashReason === 'expired' ? EXPIRED_TRASH_RETENTION_MS : TRASH_RETENTION_MS;
}

export function clearStaleRestoreMarkers(item) {
    if (!firebaseState.db || !firebaseState.fb || !item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) return;
    if (staleRestoreMarkerSweeps.has(item.id)) return;
    if (dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return;
    const sourceId = item.restoreClaimId;
    const sourceToken = item.restoreClaimToken;
    if (typeof sourceId === 'string' && activeRestoreClaims.has(sourceId)) return;
    const source = (typeof sourceId === 'string')
        ? dataState.deletedItems.find((entry) => entry && entry.id === sourceId)
        : null;
    if (source && isActiveRestoreClaim(source.restoreClaim)) return;
    staleRestoreMarkerSweeps.add(item.id);
    const release = () => { staleRestoreMarkerSweeps.delete(item.id); };
    const sourceRead = Promise.resolve().then(() => typeof sourceId === 'string' && /^[a-zA-Z0-9_-]+$/.test(sourceId)
        ? dbOp(firebaseState.fb.get(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${sourceId}`)))
        : null);
    sourceRead.then((snapshot) => {
        const currentSource = snapshot && snapshot.val();
        if (currentSource && isActiveRestoreClaim(currentSource.restoreClaim)) return;
        return dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${item.id}`), (currentItem) => {
            if (!currentItem) return currentItem;
            if (!itemHasRestoreMarkers(currentItem)) return;
            if (currentItem.restoreClaimId !== sourceId || currentItem.restoreClaimToken !== sourceToken) return;
            delete currentItem.restoreClaimId;
            delete currentItem.restoreClaimToken;
            return currentItem;
        }));
    }).then(release, (error) => {
        release();
        if (dbOpStalled(error)) return;
        console.error('Failed to clear stale restore markers for', item.id, error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: 'clearStaleRestoreMarkers', itemId: item.id });
    });
}

export function runAutomaticCleanupRules() {
    if (!cleanupClockIsTrustworthy()) return;
    const currentTime = getServerNow();

    dataState.scanHistory.forEach(item => {
        if (!item.id) return;
        if (item.clearClaim) {
            releaseStaleClearHistoryClaim(item);
            return;
        }
        if (itemHasRestoreMarkers(item)) {
            clearStaleRestoreMarkers(item);
            return;
        }
        let itemTimestamp = item.createdAt || parseTimestampFromId(item.id) || currentTime;

        if (!item.isClosed && (currentTime - itemTimestamp > ABANDON_AGE_MS) && (!Array.isArray(item.barcodes) || !item.barcodes.length || item.barcodes.some(b => barcodeAbandonIsRipe(b, itemTimestamp, currentTime))) && !ztoAbandonCleanupIsHeld(itemAbandonRipeAt(item, itemTimestamp, currentTime))) {
            claimAndCleanupItem(item.id, 'abandon');
            return;
        }

        if (item.isClosed && item.closedAt && (currentTime - item.closedAt > TWO_HOURS_MS)) {
            claimAndCleanupItem(item.id, 'close');
            return;
        }

        if (Array.isArray(item.barcodes) && item.barcodes.some(b => b && b.isClosed && (typeof b.closedAt !== 'number' || barcodeCloseIsRipe(b, currentTime)))) {
            claimAndCleanupItem(item.id, 'close');
        }
    });
}

export const CLEANUP_JOURNAL_MAX = 200;

export const CLEANUP_STAGE_MOVED = 'moved';

export const CLEANUP_STAGE_LEDGER = 'ledger';

export const CLEANUP_STAGE_FLIP = 'flip';

export function readCleanupJournal() {
    try {
        const raw = safeStoreGet(appLocalStore, CLEANUP_JOURNAL_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(e => e && typeof e === 'object' && typeof e.id === 'string'
            && e.trashItem && typeof e.trashItem.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(e.trashItem.id));
    } catch (e) {
        return [];
    }
}

export function writeCleanupJournal(entries) {
    const list = Array.isArray(entries) ? entries.slice(-CLEANUP_JOURNAL_MAX) : [];
    if (!list.length) {
        safeStoreRemove(appLocalStore, CLEANUP_JOURNAL_KEY);
        return;
    }
    try {
        safeStoreSet(appLocalStore, CLEANUP_JOURNAL_KEY, JSON.stringify(list));
    } catch (e) {}
}

export function cleanupJournalScope() {
    try {
        const raw = safeStoreGet(appLocalStore, 'zoew_firebase_config');
        if (!raw) return '';
        const found = /databaseURL"?'?\s*:\s*["']([^"']+)["']/.exec(raw);
        if (found) return found[1];
        const supabase = /supabaseUrl"?'?\s*:\s*["']([^"']+)["']/.exec(raw);
        if (!supabase) return '';
        const tenant = firebaseState.fb && typeof firebaseState.fb.tenantScope === 'function' ? firebaseState.fb.tenantScope(firebaseState.auth) : '';
        return tenant ? supabase[1] + '#' + tenant : '';
    } catch (e) {
        return '';
    }
}

export function cleanupJournalScopeMismatch(entry) {
    if (!entry || typeof entry.scope !== 'string' || !entry.scope) return false;
    const scope = cleanupJournalScope();
    return !!scope && scope !== entry.scope;
}

export function noteCleanupJournalEntry(entry) {
    if (!entry || typeof entry.id !== 'string' || !entry.trashItem || typeof entry.trashItem.id !== 'string') return;
    const list = readCleanupJournal().filter(e => e.trashItem.id !== entry.trashItem.id);
    list.push(Object.assign({}, entry, { scope: cleanupJournalScope() }));
    writeCleanupJournal(list);
}

export function markCleanupJournalStage(trashId, stage) {
    const list = readCleanupJournal();
    let changed = false;
    list.forEach((e) => { if (e.trashItem.id === trashId && e.stage !== stage) { e.stage = stage; changed = true; } });
    if (changed) writeCleanupJournal(list);
}

export function clearCleanupJournalEntry(trashId) {
    const list = readCleanupJournal();
    const next = list.filter(e => e.trashItem.id !== trashId);
    if (next.length !== list.length) writeCleanupJournal(next);
}

export function cleanupTrashCodes(trashItem) {
    const codes = new Set();
    barcodeEntriesOf(trashItem && trashItem.barcodes).forEach(({ barcode }) => {
        if (barcode && barcode.code) codes.add(barcode.code);
    });
    return codes;
}

export function cleanupLedgerDeducted(status, cod, dod, count) {
    if (!status || status.stale) return false;
    if (status.ok) return true;
    const daily = status.daily;
    if (!daily || daily.unknown) return false;
    const cents = (n) => Math.round((parseFloat(n) || 0) * 100);
    return cents(daily.cod) === cents(-cod) && cents(daily.dod) === cents(-dod) && (parseFloat(daily.count) || 0) === -count;
}

export function markCleanupTrashDeducted(trashItem) {
    const codes = cleanupTrashCodes(trashItem);
    let claimed = false;
    return firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${trashItem.id}`), (current) => {
        claimed = false;
        if (current === null || current === undefined) return null;
        if (typeof current !== 'object') return;
        if (current.restoreClaim && isActiveRestoreClaim(current.restoreClaim)) {
            claimed = true;
            return;
        }
        normalizeBarcodesOf(current);
        if (Array.isArray(current.barcodes)) {
            current.barcodes = current.barcodes.map((b) => (b && codes.has(b.code) ? { ...b, isDeducted: true } : b));
        }
        return current;
    }).then((result) => {
        if (claimed) return 'claimed';
        const value = result && result.committed && result.snapshot ? result.snapshot.val() : null;
        return value ? 'flipped' : 'gone';
    });
}

export function cleanupBarcodesBackInHistory(trashItem) {
    if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return null;
    const codes = cleanupTrashCodes(trashItem);
    if (!codes.size) return false;
    const since = (parseFloat(trashItem.deletedAt) || 0) - TWO_HOURS_MS;
    return dataState.scanHistory.some((item) => item && barcodeEntriesOf(item.barcodes).some(({ barcode }) => barcode
        && codes.has(barcode.code) && (parseFloat(barcode.restoredAt) || 0) >= since));
}

export async function applyCleanupRevenue(itemId, rev, sign) {
    const cod = sign * (parseFloat(rev.cod) || 0);
    const dod = sign * (parseFloat(rev.dod) || 0);
    const count = sign * (parseFloat(rev.count) || 0);
    const applied = addRevenueToDailyAndMonthlyRecord(rev.scanDate, cod, dod, count);
    try {
        return await correctRevenueLedgerToActual(rev.scanDate, applied, cod, dod, count);
    } catch (ledgerErr) {
        if (window.ZoeErrors) ZoeErrors.capture(ledgerErr, { zone: 'money', context: 'resumeInterruptedCleanups ledger', itemId });
        return null;
    }
}

export async function settleCleanupDeduction(itemId, trashItem, rev, decideGone) {
    let verdict;
    try {
        verdict = await retryAsync(() => dbOp(markCleanupTrashDeducted(trashItem)), 3, 1500);
    } catch (flipErr) {
        return false;
    }
    if (verdict === 'flipped') return true;
    if (verdict === 'claimed' || !decideGone) return false;
    if (dataState.deletedItems.some((t) => t && t.id === trashItem.id)) return false;
    const back = cleanupBarcodesBackInHistory(trashItem);
    if (back === null) return false;
    if (back && rev) await applyCleanupRevenue(itemId, rev, 1);
    return true;
}

export const cleanupJournalLive = new Map();

export const CLEANUP_LIVE_LOCK_PREFIX = 'zoew-cleanup-live-';

export const CLEANUP_OWNERSHIP_WAIT_MS = 3000;

export function cleanupLockManager() {
    try {
        const locks = typeof navigator !== 'undefined' && navigator ? navigator.locks : null;
        return locks && typeof locks.request === 'function' ? locks : null;
    } catch (e) {
        return null;
    }
}

export function markCleanupJournalLive(trashId) {
    if (typeof trashId !== 'string' || !trashId || cleanupJournalLive.has(trashId)) return;
    let release = null;
    const locks = cleanupLockManager();
    if (locks) {
        try {
            const held = new Promise((resolve) => { release = resolve; });
            const granted = locks.request(CLEANUP_LIVE_LOCK_PREFIX + trashId, () => held);
            if (granted && typeof granted.catch === 'function') granted.catch(() => {});
        } catch (e) {}
    }
    cleanupJournalLive.set(trashId, release);
}

export function releaseCleanupJournalLive(trashId) {
    const release = cleanupJournalLive.get(trashId);
    cleanupJournalLive.delete(trashId);
    if (typeof release === 'function') release();
}

export function withCleanupEntryOwnership(trashId, run) {
    if (cleanupJournalLive.has(trashId)) return Promise.resolve(false);
    const locks = cleanupLockManager();
    if (!locks) return Promise.resolve().then(run).then(() => true);
    return new Promise((resolve, reject) => {
        let phase = 'waiting';
        const start = () => {
            phase = 'running';
            return Promise.resolve().then(run).then(() => resolve(true), reject);
        };
        const timer = setTimeout(() => {
            if (phase !== 'waiting') return;
            phase = 'abandoned';
            resolve(false);
        }, CLEANUP_OWNERSHIP_WAIT_MS);
        const fallback = () => {
            if (phase !== 'waiting') return;
            clearTimeout(timer);
            start();
        };
        try {
            const request = locks.request(CLEANUP_LIVE_LOCK_PREFIX + trashId, { ifAvailable: true }, (lock) => {
                if (phase !== 'waiting') return undefined;
                clearTimeout(timer);
                if (!lock) {
                    phase = 'busy';
                    resolve(false);
                    return undefined;
                }
                return start();
            });
            if (request && typeof request.catch === 'function') request.catch(fallback);
        } catch (e) {
            fallback();
        }
    });
}

export async function resumeCleanupJournalEntry(trashId) {
    const entry = readCleanupJournal().find((e) => e.trashItem.id === trashId);
    if (!entry) return '';
    const trashItem = entry.trashItem;
    if (cleanupJournalScopeMismatch(entry)) {
        clearCleanupJournalEntry(trashItem.id);
        return '';
    }
    const rev = entry.revenue;
    if (entry.stage === CLEANUP_STAGE_FLIP) {
        if (!rev || await settleCleanupDeduction(entry.id, trashItem, rev, true)) clearCleanupJournalEntry(trashItem.id);
        return '';
    }
    let present = false;
    try {
        const snap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${trashItem.id}`)));
        present = snap.exists();
    } catch (readErr) {
        return '';
    }
    let outcome = '';
    if (!present) {
        if (entry.stage !== CLEANUP_STAGE_MOVED) {
            clearCleanupJournalEntry(trashItem.id);
            return rev ? 'unverified' : '';
        }
        const back = cleanupBarcodesBackInHistory(trashItem);
        if (back === null) return '';
        if (back) {
            const flaggedBeforeLedger = barcodeEntriesOf(trashItem.barcodes).some(({ barcode }) => barcode && barcode.isDeducted === true);
            if (rev && flaggedBeforeLedger) await applyCleanupRevenue(entry.id, rev, -1);
            clearCleanupJournalEntry(trashItem.id);
            return '';
        }
        try {
            await notifyIfSlow(retryAsync(() => dbOp(saveSingleDeletedItemToFirebase(trashItem)), 3, 1500),
                TRASH_WRITE_SLOW_NOTICE_MS,
                "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងបញ្ចប់ការសម្អាតដែលត្រូវរំខានពីមុន… សូមកុំបិទ App។");
            outcome = 'restored';
        } catch (writeErr) {
            return '';
        }
    }
    if (entry.stage === CLEANUP_STAGE_MOVED && rev) {
        markCleanupJournalStage(trashItem.id, CLEANUP_STAGE_LEDGER);
        const status = await applyCleanupRevenue(entry.id, rev, -1);
        if (cleanupLedgerDeducted(status, parseFloat(rev.cod) || 0, parseFloat(rev.dod) || 0, parseFloat(rev.count) || 0)) {
            markCleanupJournalStage(trashItem.id, CLEANUP_STAGE_FLIP);
            if (!(await settleCleanupDeduction(entry.id, trashItem, rev, false))) return outcome;
        }
    } else if (entry.stage === CLEANUP_STAGE_LEDGER && rev) {
        outcome = 'unverified';
    }
    clearCleanupJournalEntry(trashItem.id);
    return outcome;
}

export async function resumeInterruptedCleanups() {
    if (dataState.cleanupResumeInFlight || !firebaseState.db || !firebaseState.fb || !firebaseState.dbRefDeleted) return;
    const list = readCleanupJournal();
    if (!list.length) return;
    dataState.cleanupResumeInFlight = true;
    let restored = 0;
    let unverified = 0;
    try {
        for (let i = 0; i < list.length; i++) {
            const trashId = list[i].trashItem.id;
            let outcome = '';
            const owned = await withCleanupEntryOwnership(trashId, async () => {
                outcome = await resumeCleanupJournalEntry(trashId);
            });
            if (!owned) continue;
            if (outcome === 'restored') restored++;
            else if (outcome === 'unverified') unverified++;
        }
    } catch (resumeErr) {
        console.error('resumeInterruptedCleanups failed', resumeErr);
        if (window.ZoeErrors) ZoeErrors.capture(resumeErr, { zone: 'money', context: 'resumeInterruptedCleanups' });
    } finally {
        dataState.cleanupResumeInFlight = false;
    }
    if (restored) showToast('✅ បញ្ចប់ការសម្អាតស្វ័យប្រវត្តិដែលត្រូវរំខានពីមុនវិញ ' + restored + ' កញ្ចប់។');
    if (unverified) {
        if (window.ZoeErrors) ZoeErrors.capture(new Error('Interrupted cleanup resumed with unverified ledger'), { zone: 'money', context: 'resumeInterruptedCleanups unverified', itemCount: unverified });
        showToast('⚠️ កញ្ចប់ត្រូវបានស្តារចូលធុងសំរាមវិញ ប៉ុន្តែស្ថិតិប្រាក់មិនអាចផ្ទៀងផ្ទាត់បានទេ! សូមប្រាប់ Admin ពិនិត្យ។');
    }
}

export async function restoreClaimedItemToScanHistory(id, claimedWhole, claimedPartial) {
    const itemRef = firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`);
    let clearClaimBlocked = false;
    return retryAsync(() => dbOp(firebaseState.fb.runTransaction(itemRef, (currentItem) => {
        clearClaimBlocked = false;
        if (currentItem && currentItem.clearClaim) {
            clearClaimBlocked = true;
            return;
        }
        normalizeBarcodesOf(currentItem);
        if (claimedWhole) {
            if (currentItem) return currentItem;
            const updated = cloneRestoreItem(claimedWhole);
            delete updated.restoreClaim;
            delete updated.restoreClaimId;
            delete updated.restoreClaimToken;
            return updated;
        }
        const reclaimed = barcodeEntriesOf(claimedPartial.barcodes).map(({ barcode }) => { const { isDeducted, ...rest } = barcode; return rest; });
        const base = currentItem || { ...claimedPartial, barcodes: [] };
        if (!currentItem) {
            delete base.restoreClaim;
            delete base.restoreClaimId;
            delete base.restoreClaimToken;
        }
        const existingCodes = new Set((base.barcodes || []).map(b => b.code));
        const merged = [...(base.barcodes || []), ...reclaimed.filter(b => !existingCodes.has(b.code))];
        const updated = { ...base, barcodes: merged };
        updated.count = merged.length;
        recalcItemMoneyFromBarcodes(updated);
        updated.barcode = merged[0] ? merged[0].code : updated.barcode;
        updated.isClosed = merged.length > 0 && merged.every(b => b.isClosed);
        if (updated.isClosed) {
            if (!updated.closedAt) updated.closedAt = getServerNow();
        } else {
            delete updated.closedAt;
        }
        return updated;
    })), 3, 1500).then((result) => {
        if (clearClaimBlocked || !result || !result.committed) throw new Error('CLEAR_HISTORY_IN_PROGRESS');
        return result;
    });
}

export const CLEANUP_FOREIGN_TRASH_WINDOW_MS = 15 * 60 * 1000;

export function claimCleanupTrashSlot(trashItem) {
    if (!firebaseState.db || !firebaseState.fb || !trashItem || !trashItem.id || !/^[a-zA-Z0-9_-]+$/.test(trashItem.id)) {
        return Promise.reject(new Error('Trash Firebase reference unavailable'));
    }
    return firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_recently_deleted_cod_dod/${trashItem.id}`), (current) => (current ? undefined : trashItem))
        .then((result) => !!(result && result.committed));
}

export async function cleanupClaimAccountedElsewhere(id, claimedPartial) {
    const codes = new Set(barcodeEntriesOf(claimedPartial && claimedPartial.barcodes).map(({ barcode }) => barcode.code));
    if (!codes.size) return 'unknown';
    const since = getServerNow() - CLEANUP_FOREIGN_TRASH_WINDOW_MS;
    const foreign = dataState.deletedItems.some((t) => t && (parseFloat(t.deletedAt) || 0) >= since && Array.isArray(t.barcodes)
        && t.barcodes.some((b) => b && codes.has(b.code)));
    return foreign ? 'elsewhere' : 'ours';
}

export async function claimAndCleanupItem(id, reason) {
    if (!firebaseState.db || !id || !/^[a-zA-Z0-9_-]+$/.test(id) || cleanupInFlight.has(id)) return;
    cleanupInFlight.add(id);

    let claimedWhole = null;
    let claimedPartial = null;
    let updatedRemainder = null;
    const cleanupUpdater = (currentItem) => {
        claimedWhole = null;
        claimedPartial = null;
        updatedRemainder = null;
        if (!currentItem) return currentItem;
        if (currentItem.clearClaim) return currentItem;
        if (itemHasRestoreMarkers(currentItem)) return;
        normalizeBarcodesOf(currentItem);
        const ts = currentItem.createdAt || parseTimestampFromId(id) || getServerNow();

        if (reason === 'abandon') {
            if (currentItem.isClosed || (getServerNow() - ts) <= ABANDON_AGE_MS) return currentItem;

            if (currentItem.barcodes && Array.isArray(currentItem.barcodes) && currentItem.barcodes.length) {
                const staleOpen = currentItem.barcodes.filter(b => barcodeAbandonIsRipe(b, ts, getServerNow()));
                const staleSet = new Set(staleOpen);
                const stillActive = currentItem.barcodes.filter(b => !staleSet.has(b));
                if (staleOpen.length === 0) return currentItem;

                if (stillActive.length === 0) {
                    claimedWhole = currentItem;
                    return null;
                }

                claimedPartial = { ...currentItem, barcodes: staleOpen };
                const updated = { ...currentItem, barcodes: stillActive };
                updated.count = stillActive.length;
                recalcItemMoneyFromBarcodes(updated);
                updated.barcode = stillActive[0].code;
                updated.isClosed = stillActive.every(b => b.isClosed);
                if (updated.isClosed) {
                    if (!updated.closedAt) updated.closedAt = getServerNow();
                } else {
                    delete updated.closedAt;
                }
                updatedRemainder = updated;
                return updated;
            }

            claimedWhole = currentItem;
            return null;
        } else {
            if (currentItem.barcodes && Array.isArray(currentItem.barcodes) && currentItem.barcodes.length) {
                const stamped = normalizeBarcodeCloseStamps(currentItem, getServerNow());
                const ripeClosed = currentItem.barcodes.filter(b => barcodeCloseIsRipe(b, getServerNow()));
                if (ripeClosed.length === 0) return stamped ? currentItem : undefined;

                const keptBarcodes = currentItem.barcodes.filter(b => !barcodeCloseIsRipe(b, getServerNow()));
                if (keptBarcodes.length === 0) {
                    claimedWhole = currentItem;
                    return null;
                }

                claimedPartial = { ...currentItem, barcodes: ripeClosed };
                const updated = { ...currentItem, barcodes: keptBarcodes };
                updated.count = keptBarcodes.length;
                recalcItemMoneyFromBarcodes(updated);
                updated.barcode = keptBarcodes[0].code;
                updated.isClosed = keptBarcodes.every(b => b.isClosed);
                if (updated.isClosed) {
                    if (!updated.closedAt) updated.closedAt = getServerNow();
                } else {
                    delete updated.closedAt;
                }
                updatedRemainder = updated;
                return updated;
            }

            if (!currentItem.isClosed || !currentItem.closedAt || (getServerNow() - currentItem.closedAt) <= TWO_HOURS_MS) return currentItem;
            claimedWhole = currentItem;
            return null;
        }
    };
    const finishCleanup = async (result) => {
        if (!result.committed || (!claimedWhole && !claimedPartial)) return;
        let trashSlotDecides = false;
        if (result.txOutcome === 'applied') {
            if (claimedWhole) {
                trashSlotDecides = true;
            } else {
                const owner = await cleanupClaimAccountedElsewhere(id, claimedPartial);
                if (owner !== 'ours') {
                    if (owner === 'unknown' && window.ZoeErrors) ZoeErrors.capture(new Error('Cleanup claim committed after disconnect but ownership unverified'), { zone: 'money', context: 'claimAndCleanupItem disconnect ownership', itemId: id, reason });
                    return;
                }
            }
        }

        let trashItem;
        let revenuePending = false;
        let revenueScanDate = null;
        let revenueCod = 0, revenueDod = 0, revenueCount = 0;
        if (claimedPartial) {
            const partialIsPickup = reason !== 'abandon';
            trashItem = { ...claimedPartial, id: generateUniqueId() };
            trashItem.barcodes = trashItem.barcodes.map(b => partialIsPickup ? ({ ...b, isFromDeletion: true }) : ({ ...b,
                cod: Math.round((parseFloat(b.cod) || 0) * 100) / 100,
                dod: Math.round((parseFloat(b.dod) || 0) * 100) / 100,
                isDeducted: false, isFromDeletion: false }));
            trashItem.count = trashItem.barcodes.length;
            recalcItemMoneyFromBarcodes(trashItem);
            trashItem.barcode = trashItem.barcodes[0].code;
            trashItem.deletedAt = getServerNow();
            if (partialIsPickup) {
                trashItem.isClosed = true;
                trashItem.closedAt = trashItem.barcodes.reduce((latest, b) => Math.max(latest, parseFloat(b.closedAt) || 0), 0) || getServerNow();
                trashItem.isFromDeletion = true;
                trashItem.trashReason = 'pickup';
            } else {
                trashItem.isClosed = false;
                delete trashItem.closedAt;
                trashItem.isFromDeletion = false;
                trashItem.trashReason = 'expired';
                revenueScanDate = trashItem.scanDate || getFormattedDate();
                revenueCod = trashItem.cod;
                revenueDod = trashItem.dod;
                revenueCount = trashItem.count;
                revenuePending = true;
            }
        } else {
            trashItem = { ...claimedWhole, id };
            trashItem.deletedAt = getServerNow();

            if (reason === 'abandon') {
                trashItem.isFromDeletion = false;
                trashItem.trashReason = 'expired';
                if (Array.isArray(trashItem.barcodes) && trashItem.barcodes.length) {
                    trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b,
                        cod: Math.round((parseFloat(b.cod) || 0) * 100) / 100,
                        dod: Math.round((parseFloat(b.dod) || 0) * 100) / 100,
                        isDeducted: false, isFromDeletion: false }));
                    recalcItemMoneyFromBarcodes(trashItem);
                }
                revenueScanDate = trashItem.scanDate || getFormattedDate();
                revenueCod = Math.round((parseFloat(trashItem.cod) || 0) * 100) / 100;
                revenueDod = Math.round((parseFloat(trashItem.dod) || 0) * 100) / 100;
                revenueCount = trashItem.barcodes && Array.isArray(trashItem.barcodes) ? trashItem.barcodes.length : (parseFloat(trashItem.count) || 1);
                revenuePending = true;
            } else {
                trashItem.isFromDeletion = true;
                trashItem.trashReason = 'pickup';
                if (trashItem.barcodes && Array.isArray(trashItem.barcodes)) {
                    trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isFromDeletion: true }));
                }
            }
        }

        stripHistoryOnlyMarkers(trashItem);

        try { markCleanupJournalLive(trashItem.id); } catch (liveErr) {}
        try {
            noteCleanupJournalEntry({
                id: id,
                reason: reason,
                journalAt: getServerNow(),
                stage: CLEANUP_STAGE_MOVED,
                trashItem: trashItem,
                revenue: revenuePending ? { scanDate: revenueScanDate, cod: revenueCod, dod: revenueDod, count: revenueCount } : null
            });
        } catch (journalErr) {
            console.error('Cleanup journal write failed', journalErr);
        }

        try {
            dataState.deletedItems.unshift(trashItem);
            let trashSaved = false;
            let trashElsewhere = false;
            const writeTrash = () => (trashSlotDecides
                ? claimCleanupTrashSlot(trashItem).then((claimed) => { trashElsewhere = !claimed; })
                : saveSingleDeletedItemToFirebase(trashItem));
            await notifyIfSlow(retryAsync(writeTrash, 4, 1500),
                TRASH_WRITE_SLOW_NOTICE_MS,
                "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរក្សាទុកការសម្អាតស្វ័យប្រវត្តិ… សូមកុំបិទ App។").then(() => {
                trashSaved = true;
            }).catch(async (trashErr) => {
                const staleIdx = dataState.deletedItems.findIndex(i => i.id === trashItem.id);
                if (staleIdx !== -1) dataState.deletedItems.splice(staleIdx, 1);
                console.error('Trash write permanently failed for automatic cleanup of', id, trashErr);
                if (window.ZoeErrors) ZoeErrors.capture(trashErr, { zone: 'money', context: 'claimAndCleanupItem trash write failed after retries', itemId: id, reason });

                try {
                    await restoreClaimedItemToScanHistory(id, claimedWhole, claimedPartial);
                    try { clearCleanupJournalEntry(trashItem.id); } catch (journalErr) {}
                } catch (restoreErr) {
                    console.error('Failed to restore item to scan history after trash write failure for', id, restoreErr);
                    if (window.ZoeErrors) ZoeErrors.capture(restoreErr, { zone: 'money', context: 'claimAndCleanupItem restore-after-trash-failure also failed', itemId: id, reason });
                    showToast('⚠️ បញ្ហាធ្ងន់ធ្ងរ៖ ទិន្នន័យកញ្ចប់ ' + id + ' អាចនឹងបាត់! សូមប្រាប់ Admin ត្រួតពិនិត្យភ្លាមៗ');
                }
            });
            if (!trashSaved) return;
            if (trashElsewhere) {
                const dupIdx = dataState.deletedItems.findIndex(i => i.id === trashItem.id);
                if (dupIdx !== -1) dataState.deletedItems.splice(dupIdx, 1);
                try { clearCleanupJournalEntry(trashItem.id); } catch (journalErr) {}
                return;
            }
            if (!revenuePending) {
                try { clearCleanupJournalEntry(trashItem.id); } catch (journalErr) {}
                return;
            }
            try { markCleanupJournalStage(trashItem.id, CLEANUP_STAGE_LEDGER); } catch (journalErr) {}
            const revenueApplied = addRevenueToDailyAndMonthlyRecord(revenueScanDate, -revenueCod, -revenueDod, -revenueCount);
            let ledgerStatus = null;
            try {
                const status = await correctRevenueLedgerToActual(revenueScanDate, revenueApplied,
                    -revenueCod, -revenueDod, -revenueCount);
                ledgerStatus = status;
                if (!status || (!status.ok && !status.stale)) {
                    const ledgerErr = new Error('Automatic cleanup revenue reconciliation did not commit');
                    if (window.ZoeErrors) ZoeErrors.capture(ledgerErr, { zone: 'money', context: 'claimAndCleanupItem ledger reconciliation', itemId: id, reason });
                    showToast('⚠️ ការសម្អាតបានរក្សាទុក ប៉ុន្តែស្ថិតិប្រាក់មិនទាន់ Sync ពេញលេញទេ! សូមប្រាប់ Admin។');
                }
            } catch (ledgerErr) {
                if (window.ZoeErrors) ZoeErrors.capture(ledgerErr, { zone: 'money', context: 'claimAndCleanupItem ledger reconciliation', itemId: id, reason });
            }
            if (cleanupLedgerDeducted(ledgerStatus, revenueCod, revenueDod, revenueCount)) {
                try { markCleanupJournalStage(trashItem.id, CLEANUP_STAGE_FLIP); } catch (journalErr) {}
                const settled = await settleCleanupDeduction(id, trashItem,
                    { scanDate: revenueScanDate, cod: revenueCod, dod: revenueDod, count: revenueCount }, false);
                if (!settled) return;
            }
            try { clearCleanupJournalEntry(trashItem.id); } catch (journalErr) {}
        } finally {
            try { releaseCleanupJournalLive(trashItem.id); } catch (liveErr) {}
        }
    };
    try {
        const cleanupTx = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`), cleanupUpdater);
        let result;
        try {
            result = await dbOp(cleanupTx);
        } catch (txError) {
            if (dbOpStalled(txError)) {
                armLateCommit(cleanupTx, finishCleanup, null, 'claimAndCleanupItem ' + reason);
                return;
            }
            throw txError;
        }
        await settleLockWithin(finishCleanup(result), LOCK_STALL_RELEASE_MS, 'claimAndCleanupItem ' + reason);
    } catch (e) {
        if (e && e.txOutcome === 'not-applied') {
            console.warn('Automatic cleanup transaction was not applied (disconnect) for', id);
        } else {
            console.error('Automatic cleanup transaction failed for', id, e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'money', context: 'Automatic cleanup transaction failed for' });
        }
    } finally {
        cleanupInFlight.delete(id);
    }
}

export async function runAutomaticDeletedCleanup() {
    if (dataState.deletedCleanupInFlight) return;
    if (!cleanupClockIsTrustworthy()) return;
    const currentTime = getServerNow();
    const candidates = [];

    dataState.deletedItems.forEach(item => {
        if (!item || !item.id) return;
        const deletedTime = item.deletedAt || currentTime;
        if (currentTime - deletedTime <= trashRetentionMs(item)) return;
        let staleClaim = false;
        if (item.restoreClaim) {
            if (isActiveRestoreClaim(item.restoreClaim)) return;
            if (activeRestoreClaims.has(item.id)) return;
            staleClaim = true;
        }
        candidates.push({ id: item.id, barcodes: collectItemBarcodes(item), staleClaim });
    });

    if (!candidates.length) return;

    dataState.deletedCleanupInFlight = true;
    try {
        const purgeable = [];
        for (const candidate of candidates) {
            if (candidate.staleClaim) {
                try {
                    await releaseStaleRestoreClaimForPurge(candidate.id);
                } catch (claimError) {
                    console.error('Failed to release stale restore claim before purge for', candidate.id, claimError);
                    if (window.ZoeErrors) ZoeErrors.capture(claimError, { zone: 'data', context: 'runAutomaticDeletedCleanup stale claim release', itemId: candidate.id });
                    continue;
                }
            }
            purgeable.push(candidate);
        }
        if (!purgeable.length) return;

        const applyPurged = (list) => {
            if (!list || !list.length) return Promise.resolve();
            const purgedSet = new Set(list.map((c) => c.id));
            dataState.deletedItems = dataState.deletedItems.filter(item => !purgedSet.has(item.id));
            let purgedBarcodes = [];
            list.forEach((candidate) => { purgedBarcodes = purgedBarcodes.concat(candidate.barcodes); });
            return releaseBarcodesInRegistry(purgedBarcodes);
        };

        let purged = purgeable;
        const batchWrite = purgeDeletedItemsQuietly(purgeable.map((c) => c.id));
        try {
            await dbOp(batchWrite);
        } catch (batchError) {
            if (dbOpStalled(batchError)) {
                armLateWrite(batchWrite, () => applyPurged(purgeable), null, 'purgeDeletedItems batch');
                return;
            }
            purged = [];
            let lastError = batchError;
            let stalled = false;
            for (const candidate of purgeable) {
                const singleWrite = purgeDeletedItemsQuietly([candidate.id]);
                try {
                    await dbOp(singleWrite);
                    purged.push(candidate);
                } catch (singleError) {
                    lastError = singleError;
                    if (dbOpStalled(singleError)) {
                        armLateWrite(singleWrite, () => applyPurged([candidate]), null, 'purgeDeletedItems single');
                        stalled = true;
                        break;
                    }
                }
            }
            if (!purged.length) {
                if (!stalled) {
                    console.error('Error purging deleted items: ', lastError);
                    if (window.ZoeErrors) ZoeErrors.capture(lastError, { zone: 'data', context: 'Error purging deleted items: ' });
                    showToast("⚠️ បរាជ័យក្នុងការលុបធុងសំរាមចាស់ចេញពី Firebase!");
                }
                return;
            }
        }

        await applyPurged(purged);
    } catch (e) {
        console.error('Automatic trash purge failed', e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'data', context: 'runAutomaticDeletedCleanup' });
    } finally {
        dataState.deletedCleanupInFlight = false;
    }
}

export function runScheduledCleanup() {
    if (!firebaseState.db || !firebaseState.isDatabaseInitialized || firebaseState.dbListenersFailed) return;
    flushPendingRegistryReleases();
    runAutomaticCleanupRules();
    runAutomaticDeletedCleanup();
    runAutomaticCollectedCleanup();
    repairPickupLedgerOnce();
}
