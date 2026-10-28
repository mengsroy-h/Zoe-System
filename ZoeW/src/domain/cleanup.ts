import { dataState, firebaseState } from '../core/state';
import { cleanupClockIsTrustworthy, getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { CLEANUP_JOURNAL_KEY } from '../core/storage-keys';
import { DB_LISTENER_KEY_DAILY_REVENUE, DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY } from '../core/text';
import { getFormattedDate } from '../core/timezone';
import { stripTrashClaim, barcodeAbandonIsRipe, barcodeCloseIsRipe, barcodeReturnCounts, barcodeSignBasis, itemAbandonRipeAt, barcodeEntriesOf, ensureBarcodeArrayForItem, itemHasRestoreMarkers, normalizeBarcodesOf, parseTimestampFromId, stampTrashPolicy, stripHistoryOnlyMarkers } from './barcode';
import { collectedDayOfStamp, collectedMarksFor, collectedRetentionCutoffKey, collectedSettleHeld, markCollectedRevenue, reconcileCollectedHistory, runAutomaticCollectedCleanup } from './collected';
import { commitLedgerEventStep, ledgerDedOf, ledgerEventToken, ledgerRecordTokens } from './ledger';
import { commitPickupMarks, getPickupPhoneKey, pickupBarcodeKey, pickupCopyMarks, resumePickupIntents } from './pickup';
import { collectItemBarcodes, flushPendingRegistryReleases, releaseBarcodesInRegistry } from './registry';
import { releaseStaleClearHistoryClaim } from '../features/clear-history';
import { activeRestoreClaims, cloneRestoreItem, isActiveRestoreClaim, readRestoreServerNode, releaseStaleRestoreClaimForPurge, restoreAwaitsCancellation, restorePendingCode, resumeBlockedRestoreCancellations } from '../features/restore';
import { ABANDON_AGE_MS, RETURNED_TRASH_RETENTION_MS, TRASH_RETENTION_MS, TRASH_WRITE_SLOW_NOTICE_MS, TWO_HOURS_MS } from '../features/session';
import { ZTO_STATUS_TTL_MS, loadZtoPickupStatusOnce, ztoAbandonCleanupIsHeld, ztoAutoCloseEnabled, ztoPickupStatus } from '../features/zto-status';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { purgeDeletedItemsQuietly, saveSingleDeletedItemToFirebase } from '../services/history-write';
import { LOCK_STALL_RELEASE_MS, armLateCommit, armLateWrite, dbOp, dbOpStalled, notifyIfSlow, retryAsync, settleLockWithin } from '../services/network';
import { recalcItemMoneyFromBarcodes } from '../ui/modal-stack';
import { beginTrashClaim, claimTrashBarcodes, pendingTrashClaims, releaseLeftoverTrashClaims, trashClaimHeldByOther, trashClaimOwned } from './trash-claim';
import { showToast } from '../ui/toast';
import { liveShopScope, shopScope, shopScopePending } from '../core/shop-scope';
import { getManualZtoTrashMode, getShopZtoTrashMode } from '../features/lookup-config';
import { trashReasonOf } from '../features/trash';

export const cleanupInFlight = new Set();

export const cleanupOperationOwners = new Map();

export function beginCleanupOperation(id) {
    if (typeof id !== 'string' || !id) return null;
    const owner = { journal: new Map(), scope: cleanupJournalScope() };
    cleanupOperationOwners.set(id, owner);
    cleanupInFlight.add(id);
    return owner;
}

export function releaseCleanupOperation(id, owner, keepJournal = false) {
    if (!owner || !(owner.journal instanceof Map)) return;
    if (id && cleanupOperationOwners.get(id) === owner) {
        cleanupOperationOwners.delete(id);
        cleanupInFlight.delete(id);
    }
    if (!keepJournal) owner.journal.forEach((journalOwner, trashId) => releaseCleanupJournalLive(trashId, journalOwner, owner));
}

export const staleRestoreMarkerSweeps = new Set();

export function trashRetentionMs(item) {
    return item && item.trashReason === 'returned' ? RETURNED_TRASH_RETENTION_MS : TRASH_RETENTION_MS;
}

export function clearStaleRestoreMarkers(item) {
    const markerDb = firebaseState.db, markerApi = firebaseState.fb, markerGeneration = firebaseState.authGeneration;
    const markerCurrent = () => firebaseState.db === markerDb && firebaseState.authGeneration === markerGeneration;
    if (!markerDb || !markerApi || !item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) return;
    if (staleRestoreMarkerSweeps.has(item.id)) return;
    if (dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return;
    const sourceId = item.restoreClaimId;
    const sourceToken = item.restoreClaimToken;
    if (typeof sourceId === 'string' && activeRestoreClaims.has(sourceId)) return;
    const source = (typeof sourceId === 'string')
        ? dataState.deletedItems.find((entry) => entry && entry.id === sourceId)
        : null;
    if (source && source.restoreClaim) return;
    staleRestoreMarkerSweeps.add(item.id);
    const release = () => { staleRestoreMarkerSweeps.delete(item.id); };
    const sourceRead = Promise.resolve().then(() => markerCurrent() && typeof sourceId === 'string' && /^[a-zA-Z0-9_-]+$/.test(sourceId)
        ? dbOp(markerApi.get(markerApi.ref(markerDb, `zoew_recently_deleted_cod_dod/${sourceId}`)))
        : null);
    sourceRead.then((snapshot) => {
        if (!markerCurrent()) return;
        const currentSource = snapshot && snapshot.val();
        if (currentSource && currentSource.restoreClaim) return;
        return dbOp(markerApi.runTransaction(markerApi.ref(markerDb, `zoew_scan_history_cod_dod/${item.id}`), (currentItem) => {
            if (!markerCurrent()) return;
            if (!currentItem) return currentItem;
            if (!itemHasRestoreMarkers(currentItem)) return;
            if (currentItem.restoreClaimId !== sourceId || currentItem.restoreClaimToken !== sourceToken) return;
            delete currentItem.restoreClaimId;
            delete currentItem.restoreClaimToken;
            delete currentItem.restoreAddedCodes;
            return currentItem;
        }));
    }).then(release, (error) => {
        release();
        if (dbOpStalled(error)) return;
        console.error('Failed to clear stale restore markers for', item.id, error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: 'clearStaleRestoreMarkers', itemId: item.id });
    });
}

export const CLEANUP_SWEEP_BATCH = 8;

export const CLEANUP_SWEEP_YIELD_MS = 50;

export function runAutomaticCleanupRules(sweepLimit?: number) {
    if (!cleanupClockIsTrustworthy() || shopScopePending()) return;
    const mode = getShopZtoTrashMode();
    if (!mode) return;
    const currentTime = getServerNow();
    const visited = sweepLimit ? dataState.cleanupSweepVisited : null;
    let started = 0;

    for (const item of dataState.scanHistory) {
        if (!item.id || !Array.isArray(item.barcodes)) continue;
        if (visited) {
            if (visited.has(item.id)) continue;
            if (started >= sweepLimit) {
                scheduleCleanupSweepContinuation();
                return;
            }
            visited.add(item.id);
        }
        if (item.clearClaim) {
            releaseStaleClearHistoryClaim(item);
            continue;
        }
        if (itemHasRestoreMarkers(item)) {
            clearStaleRestoreMarkers(item);
            continue;
        }
        if (cleanupInFlight.has(item.id)) continue;
        const inFlight = cleanupInFlight.size;
        let itemTimestamp = item.createdAt || parseTimestampFromId(item.id) || currentTime;

        const signedHold = abandonZtoSignedHolds(item, itemTimestamp, currentTime);
        if (!item.isClosed && (currentTime - itemTimestamp > ABANDON_AGE_MS) && item.barcodes.some(b => barcodeAbandonIsRipe(b, itemTimestamp, currentTime) && !signedHold.has(b.code)) && !ztoAbandonCleanupIsHeld(itemAbandonRipeAt(item, itemTimestamp, currentTime))) {
            claimAndCleanupItem(item.id, 'abandon', signedHold.size ? { hold: Array.from(signedHold) } : undefined);
        } else if (item.barcodes.some(b => b && b.isClosed && (mode === 'local' && typeof b.closedAt !== 'number' || barcodeCloseIsRipe(b, currentTime, mode)))) {
            claimAndCleanupItem(item.id, 'close');
        }
        if (cleanupInFlight.size > inFlight) started++;
    }
    if (visited) visited.clear();
}

export function abandonZtoSignedHolds(item, itemTimestamp, currentTime) {
    const held = new Set();
    if (!item || item.isClosed || !Array.isArray(item.barcodes)) return held;
    loadZtoPickupStatusOnce();
    if (!ztoPickupStatus.size) return held;
    item.barcodes.forEach((b) => {
        if (!b || !barcodeAbandonIsRipe(b, itemTimestamp, currentTime)) return;
        const verdict = ztoPickupStatus.get(pickupBarcodeKey(b.code));
        if (verdict && verdict.closed === true && elapsedSince(verdict.at) <= ZTO_STATUS_TTL_MS
            && (Number(verdict.signedAt) || 0) >= barcodeSignBasis(b, item)) held.add(b.code);
    });
    return held.size && ztoAutoCloseEnabled() ? held : new Set();
}

export function scheduleCleanupSweepContinuation() {
    if (dataState.cleanupSweepTimer) return;
    dataState.cleanupSweepTimer = setTimeout(() => {
        dataState.cleanupSweepTimer = null;
        if (!firebaseState.db || !firebaseState.isDatabaseInitialized || firebaseState.dbListenersFailed) {
            dataState.cleanupSweepVisited.clear();
            return;
        }
        runAutomaticCleanupRules(CLEANUP_SWEEP_BATCH);
    }, CLEANUP_SWEEP_YIELD_MS);
}

export const CLEANUP_JOURNAL_MAX = 200;

export const CLEANUP_STAGE_MOVED = 'moved';

export const CLEANUP_STAGE_LEDGER = 'ledger';

export const CLEANUP_STAGE_FLIP = 'flip';

export const CLEANUP_STAGE_SLOT = 'slot';

export const CLEANUP_STAGE_UNDO = 'undo';

export const CLEANUP_STAGE_COLLECTED = 'collected';

export const CLEANUP_LEDGER_KEYED = 'keyed';

export const CLEANUP_LEDGER_RETRY_MAX = 10;

export const CLEANUP_DROP_REPORT_IDS_MAX = 10;

export const CLEANUP_NO_PRIOR = { d: [], m: [] };

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
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
        safeStoreRemove(appLocalStore, CLEANUP_JOURNAL_KEY);
        return;
    }
    try {
        safeStoreSet(appLocalStore, CLEANUP_JOURNAL_KEY, JSON.stringify(list));
    } catch (e) {}
}

export function cleanupJournalScope() {
    return liveShopScope();
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

export function cleanupJournalClaimMatches(entry, expectedTrash?, expectedScope?) {
    if (expectedScope !== undefined && entry.scope !== expectedScope) return false;
    if (!expectedTrash) return true;
    const stored = entry.trashItem;
    return stored.deletedAt === expectedTrash.deletedAt
        && cleanupPartialTrashId(entry.id, entry.reason, stored) === cleanupPartialTrashId(entry.id, entry.reason, expectedTrash);
}

export function markCleanupJournalStage(trashId, stage, expectedTrash?, expectedScope?) {
    const list = readCleanupJournal();
    let changed = false;
    list.forEach((e) => { if (e.trashItem.id === trashId && cleanupJournalClaimMatches(e, expectedTrash, expectedScope) && e.stage !== stage) { e.stage = stage; changed = true; } });
    if (changed) writeCleanupJournal(list);
}

export function patchCleanupJournalEntry(trashId, fields, expectedTrash?, expectedScope?) {
    const list = readCleanupJournal();
    let changed = false;
    list.forEach((e) => {
        if (e.trashItem.id !== trashId || !cleanupJournalClaimMatches(e, expectedTrash, expectedScope)) return;
        Object.assign(e, fields);
        changed = true;
    });
    if (changed) writeCleanupJournal(list);
    return changed;
}

export function noteCleanupLedgerTry(trashId, expectedTrash?, expectedScope?) {
    const entry = readCleanupJournal().find((e) => e.trashItem.id === trashId && cleanupJournalClaimMatches(e, expectedTrash, expectedScope));
    const tries = Math.min(CLEANUP_LEDGER_RETRY_MAX, (entry && typeof entry.tries === 'number' && isFinite(entry.tries) ? entry.tries : 0) + 1);
    patchCleanupJournalEntry(trashId, { tries }, expectedTrash, expectedScope);
    return tries;
}

export function clearCleanupJournalEntry(trashId, expectedTrash?, expectedScope?) {
    const list = readCleanupJournal();
    const next = list.filter(e => e.trashItem.id !== trashId || !cleanupJournalClaimMatches(e, expectedTrash, expectedScope));
    if (next.length !== list.length) writeCleanupJournal(next);
}

export function cleanupTrashCodes(trashItem) {
    const codes = new Set();
    barcodeEntriesOf(trashItem && trashItem.barcodes).forEach(({ barcode }) => {
        if (barcode && barcode.code) codes.add(barcode.code);
    });
    return codes;
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
        stampTrashPolicy(current, current.trashMode || 'local');
        return current;
    }).then((result) => {
        if (claimed) return 'claimed';
        const value = result && result.committed && result.snapshot ? result.snapshot.val() : null;
        return value ? 'flipped' : 'gone';
    });
}

export function cleanupBarcodesBackInHistory(trashItem, history = dataState.scanHistory) {
    if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return null;
    const codes = cleanupTrashCodes(trashItem);
    if (!codes.size) return false;
    const since = (parseFloat(trashItem.deletedAt) || 0) - TWO_HOURS_MS;
    return history.some((item) => item && barcodeEntriesOf(item.barcodes).some(({ barcode }) => barcode
        && codes.has(barcode.code) && (parseFloat(barcode.restoredAt) || 0) >= since));
}

export function cleanupScanDateOf(trashItem) {
    const at = trashItem && typeof trashItem.deletedAt === 'number' && isFinite(trashItem.deletedAt) ? trashItem.deletedAt : getServerNow();
    return (trashItem && trashItem.scanDate) || getFormattedDate(at);
}

export function cleanupEventAt(trashItem) {
    const at = trashItem ? trashItem.deletedAt : null;
    return typeof at === 'number' && isFinite(at) && at > 0 ? at : 0;
}

export function cleanupEventAmounts(rev) {
    return {
        cod: Math.round((parseFloat(rev && rev.cod) || 0) * 100) / 100,
        dod: Math.round((parseFloat(rev && rev.dod) || 0) * 100) / 100,
        count: parseFloat(rev && rev.count) || 0
    };
}

export async function cleanupLedgerPrior(scanDate) {
    const priorDb = firebaseState.db;
    const priorGeneration = firebaseState.authGeneration;
    const priorScope = shopScope();
    const api = firebaseState.fb;
    const records = await Promise.all([
        readRestoreServerNode(api, priorDb, `zoew_daily_revenue_cod_dod/${scanDate}`),
        readRestoreServerNode(api, priorDb, `zoew_monthly_revenue_cod_dod/${String(scanDate).substring(0, 7)}`)
    ]);
    if (firebaseState.db !== priorDb || firebaseState.authGeneration !== priorGeneration || shopScope() !== priorScope) throw new Error('CLEANUP_SESSION_CHANGED');
    return { d: ledgerRecordTokens(records[0]), m: ledgerRecordTokens(records[1]) };
}

export async function deductCleanupLedgerKeyed(trashItem, rev, prior) {
    const ledgerDb = firebaseState.db;
    const ledgerGeneration = firebaseState.authGeneration;
    const at = cleanupEventAt(trashItem);
    if (!at || !rev || !/^[a-zA-Z0-9_-]{1,64}$/.test(trashItem.id)) return 'refused';
    const amounts = cleanupEventAmounts(rev);
    const monthly: any = await commitLedgerEventStep('monthly', rev.scanDate, trashItem.id, at, 'deduct', amounts, prior ? prior.m : null);
    if (firebaseState.db !== ledgerDb || firebaseState.authGeneration !== ledgerGeneration) return 'stale';
    if (monthly.state === 'restored') return 'deducted';
    if (monthly.state !== 'applied' && monthly.state !== 'already') return monthly.state;
    const daily: any = await commitLedgerEventStep('daily', rev.scanDate, trashItem.id, at, 'deduct', amounts, prior ? prior.d : null);
    if (daily.state === 'applied' || daily.state === 'already' || daily.state === 'restored') return 'deducted';
    return daily.state === 'refused' ? 'failed' : daily.state;
}

export async function deductCleanupRevenue(itemId, trashItem, rev) {
    const priorDb = firebaseState.db;
    const priorGeneration = firebaseState.authGeneration;
    let prior;
    try {
        prior = await cleanupLedgerPrior(rev.scanDate);
        if (firebaseState.db !== priorDb || firebaseState.authGeneration !== priorGeneration) return 'stale';
        if (!patchCleanupJournalEntry(trashItem.id, { stage: CLEANUP_STAGE_LEDGER, ledger: CLEANUP_LEDGER_KEYED, prior }, trashItem)) return 'failed';
        const stored = readCleanupJournal().find(entry => entry.trashItem.id === trashItem.id);
        if (!stored || stored.stage !== CLEANUP_STAGE_LEDGER || stored.ledger !== CLEANUP_LEDGER_KEYED || JSON.stringify(stored.prior) !== JSON.stringify(prior)) return 'failed';
    } catch (priorError) {
        return firebaseState.db !== priorDb || firebaseState.authGeneration !== priorGeneration ? 'stale' : 'failed';
    }
    return deductCleanupLedgerKeyed(trashItem, rev, null);
}

export async function undoCleanupLedgerKeyed(trashItem, rev, prior, uprior) {
    const at = cleanupEventAt(trashItem);
    if (!at || !rev) return 'unknown';
    const daily: any = await commitLedgerEventStep('daily', rev.scanDate, trashItem.id, at, 'undo', null, prior.d);
    let amounts = null;
    let evidence = null;
    if (daily.state === 'applied') {
        amounts = daily.entry;
    } else if (daily.state === 'already') {
        if (!daily.undo) return 'done';
        amounts = daily.entry || cleanupEventAmounts(rev);
    } else if (daily.state === 'absent') {
        amounts = cleanupEventAmounts(rev);
        evidence = prior.m;
    } else {
        return daily.state === 'refused' ? 'failed' : daily.state;
    }
    const monthly: any = await commitLedgerEventStep('monthly', rev.scanDate, trashItem.id, at, 'undo', amounts, uprior ? uprior.m : null, evidence);
    if (monthly.state === 'applied' || monthly.state === 'already' || monthly.state === 'absent') return 'done';
    return monthly.state === 'refused' ? 'failed' : monthly.state;
}

export async function undoCleanupRevenue(entry) {
    const trashItem = entry.trashItem;
    const rev = entry.revenue;
    const rerun = entry.stage === CLEANUP_STAGE_UNDO;
    let uprior = entry.uprior || CLEANUP_NO_PRIOR;
    if (!rerun) {
        const priorDb = firebaseState.db;
        const priorGeneration = firebaseState.authGeneration;
        try {
            uprior = await cleanupLedgerPrior(rev.scanDate);
            if (firebaseState.db !== priorDb || firebaseState.authGeneration !== priorGeneration) return 'stale';
            if (!patchCleanupJournalEntry(trashItem.id, { stage: CLEANUP_STAGE_UNDO, uprior }, trashItem)) return 'failed';
            const stored = readCleanupJournal().find(candidate => candidate.trashItem.id === trashItem.id);
            if (!stored || stored.stage !== CLEANUP_STAGE_UNDO || JSON.stringify(stored.uprior) !== JSON.stringify(uprior)) return 'failed';
        } catch (priorError) {
            return firebaseState.db !== priorDb || firebaseState.authGeneration !== priorGeneration ? 'stale' : 'failed';
        }
    }
    return undoCleanupLedgerKeyed(trashItem, rev, entry.prior || CLEANUP_NO_PRIOR, rerun ? uprior : null);
}

export function cleanupLedgerResult(trashId, state, expectedTrash?, expectedScope?) {
    if (state === 'done' || state === 'deducted') {
        clearCleanupJournalEntry(trashId, expectedTrash, expectedScope);
        return '';
    }
    if (state === 'stale') return '';
    if (state !== 'unknown' && state !== 'refused' && noteCleanupLedgerTry(trashId, expectedTrash, expectedScope) < CLEANUP_LEDGER_RETRY_MAX) return '';
    const entry = readCleanupJournal().find(candidate => candidate.trashItem.id === trashId && cleanupJournalClaimMatches(candidate, expectedTrash, expectedScope));
    if (entry && entry.unverifiedReported === true) return '';
    patchCleanupJournalEntry(trashId, { unverifiedReported: true }, expectedTrash, expectedScope);
    return 'unverified';
}

export async function settleCleanupDeduction(itemId, trashItem, rev, decideGone, entry?) {
    const settleDb = firebaseState.db;
    const settleGeneration = firebaseState.authGeneration;
    const settleIsCurrent = () => firebaseState.db === settleDb && firebaseState.authGeneration === settleGeneration;
    let verdict;
    try {
        verdict = await retryAsync(() => (settleIsCurrent() ? dbOp(markCleanupTrashDeducted(trashItem)) : Promise.reject(Object.assign(new Error('Cleanup session changed'), { noRetry: true }))), 3, 1500);
    } catch (flipErr) {
        return false;
    }
    if (!settleIsCurrent()) return false;
    if (verdict === 'flipped') return true;
    if (verdict === 'claimed' || !decideGone) return false;
    if (dataState.deletedItems.some((t) => t && t.id === trashItem.id)) return false;
    const history = entry ? await cleanupHistoryForRecovery(entry.id, trashItem) : dataState.scanHistory;
    if (!history || !settleIsCurrent()) return false;
    const back = cleanupBarcodesBackInHistory(trashItem, history);
    if (back === null) return false;
    if (back && rev && entry) return undoCleanupRevenue(entry);
    return true;
}

export const CLEANUP_KEY_SWEEP_GRACE_MS = 10 * 60 * 1000;

export const CLEANUP_KEY_SWEEP_BATCH = 4;

export const cleanupKeySweepInFlight = new Set();

export function runCleanupLedgerKeySweep() {
    if (!firebaseState.db || !firebaseState.fb || !cleanupClockIsTrustworthy()) return;
    if (dbListenerViewIsStale(DB_LISTENER_KEY_DELETED) || dbListenerViewIsStale(DB_LISTENER_KEY_DAILY_REVENUE)) return;
    const now = getServerNow();
    const days = dataState.dailyRevenueData && typeof dataState.dailyRevenueData === 'object' ? dataState.dailyRevenueData : {};
    let journaled = [];
    try { journaled = readCleanupJournal().map((e) => e.trashItem.id); } catch (journalErr) {}
    let started = 0;
    for (const item of dataState.deletedItems) {
        if (started >= CLEANUP_KEY_SWEEP_BATCH) return;
        if (!item || typeof item.id !== 'string' || (item.trashReason !== 'returned' && item.trashReason !== 'remove')) continue;
        const at = cleanupEventAt(item);
        if (!at || now - at < CLEANUP_KEY_SWEEP_GRACE_MS) continue;
        if (journaled.indexOf(item.id) !== -1 || cleanupJournalLive.has(item.id) || cleanupKeySweepInFlight.has(item.id)) continue;
        if (item.restoreClaim && isActiveRestoreClaim(item.restoreClaim)) continue;
        if (!barcodeEntriesOf(item.barcodes).some(({ barcode }) => barcode && barcode.isDeducted !== true)) continue;
        const entry = ledgerDedOf(days[cleanupScanDateOf(item)], item.id);
        if (!entry || entry.at !== at || entry.back) continue;
        started++;
        cleanupKeySweepInFlight.add(item.id);
        const done = () => { cleanupKeySweepInFlight.delete(item.id); };
        dbOp(markCleanupTrashDeducted(item)).then(done, (flipErr) => {
            done();
            if (dbOpStalled(flipErr)) return;
            if (window.ZoeErrors) ZoeErrors.capture(flipErr, { zone: 'money', context: 'runCleanupLedgerKeySweep flip', itemId: item.id });
        });
    }
}

export function cleanupLedgerKeyOf(item) {
    if (!item || item.trashReason !== 'returned' || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id)) return null;
    const at = cleanupEventAt(item);
    const scanDate = cleanupScanDateOf(item);
    if (!at || typeof scanDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(scanDate)) return null;
    const days = dataState.dailyRevenueData && typeof dataState.dailyRevenueData === 'object' ? dataState.dailyRevenueData : {};
    const entry = ledgerDedOf(days[scanDate], item.id);
    return entry && entry.at === at ? { scanDate } : null;
}

export function releaseCleanupLedgerKeys(list) {
    const updates = {};
    (Array.isArray(list) ? list : []).forEach((candidate) => {
        if (candidate && candidate.ledgerKey) updates[`zoew_daily_revenue_cod_dod/${candidate.ledgerKey.scanDate}/ded/${candidate.id}`] = null;
    });
    if (!Object.keys(updates).length || !firebaseState.fb || !firebaseState.db) return Promise.resolve();
    return dbOp(Promise.resolve().then(() => firebaseState.fb.update(firebaseState.fb.ref(firebaseState.db), updates))).catch(() => {});
}

export async function cleanupHistoryForRecovery(sourceId, trashItem?, db?) {
    if (typeof sourceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(sourceId)) return null;
    const recoveryDatabase = db || firebaseState.db;
    const generation = firebaseState.authGeneration;
    const current = () => firebaseState.db === recoveryDatabase && firebaseState.authGeneration === generation;
    if (!current()) return null;
    try {
        const snap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(recoveryDatabase, `zoew_scan_history_cod_dod/${sourceId}`)));
        if (!current()) return null;
        const source = snap.exists() ? snap.val() : null;
        const fresh = new Map([[sourceId, source]]);
        if (trashItem && typeof trashItem.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(trashItem.id) && !trashSlotSharesClaim(source, trashItem)) {
            const finalSnap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(recoveryDatabase, `zoew_restore_finalizations/${trashItem.id}`)));
            if (!current()) return null;
            const targetId = finalSnap.exists() ? finalSnap.val()?.targetId : null;
            if (typeof targetId === 'string' && /^[a-zA-Z0-9_-]+$/.test(targetId)) {
                const target = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(recoveryDatabase, `zoew_scan_history_cod_dod/${targetId}`)));
                if (!current()) return null;
                fresh.set(targetId, target.exists() ? target.val() : null);
            }
        }
        const history = dataState.scanHistory.filter((item) => item && !fresh.has(item.id));
        fresh.forEach((value, id) => { if (value) history.push(Object.assign({}, value, { id })); });
        return history;
    } catch (readErr) {
        return null;
    }
}

export async function resolveCleanupSlot(trashItem, sourceId?) {
    const slotDb = firebaseState.db;
    const slotGeneration = firebaseState.authGeneration;
    const slotIsCurrent = () => firebaseState.db === slotDb && firebaseState.authGeneration === slotGeneration;
    let existing = null;
    try {
        const snap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(slotDb, `zoew_recently_deleted_cod_dod/${trashItem.id}`)));
        existing = snap.exists() ? snap.val() : null;
    } catch (readErr) {
        return 'wait';
    }
    if (!slotIsCurrent()) return 'wait';
    if (existing && existing.deletedAt === trashItem.deletedAt) return 'ours';
    if (existing && trashSlotSharesClaim(existing, trashItem)) return 'elsewhere';
    if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return 'wait';
    let history = dataState.scanHistory;
    if (sourceId !== undefined) {
        history = await cleanupHistoryForRecovery(sourceId, trashItem, slotDb);
        if (!history || !slotIsCurrent()) return 'wait';
    }
    if (history.some((item) => item && trashSlotSharesClaim(item, trashItem))) return 'elsewhere';
    if (dataState.deletedItems.some((item) => item && item.id !== trashItem.id && trashSlotSharesClaim(item, trashItem))) return 'elsewhere';
    const back = cleanupBarcodesBackInHistory(trashItem, history);
    if (back === null) return 'wait';
    if (back) return 'elsewhere';
    try {
        const claimed = await retryAsync(() => (slotIsCurrent() ? claimCleanupTrashSlot(trashItem) : Promise.reject(Object.assign(new Error('Cleanup session changed'), { noRetry: true }))), 3, 1500);
        if (!slotIsCurrent()) return 'wait';
        return claimed ? 'claimed' : 'elsewhere';
    } catch (claimErr) {
        return 'wait';
    }
}

export function cleanupDropsMirror(entry) {
    return !!entry && (!!entry.revenue || entry.reason === 'remove' || entry.reason === 'abandon');
}

export async function cleanupCollectedKept(entry, isCurrent, db?) {
    const closed = cleanupDropsMirror(entry) ? barcodeEntriesOf(entry.trashItem.barcodes).map(({ barcode }) => barcode).filter((barcode) => barcode && barcode.isClosed && barcode.code) : [];
    const kept = new Map();
    if (!closed.length) return { closed, kept };
    if (!isCurrent() || !firebaseState.isDatabaseConnected) return null;
    const keptDb = db || firebaseState.db;
    if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return null;
    const history = await cleanupHistoryForRecovery(entry.id, entry.trashItem, keptDb);
    if (!history || !isCurrent()) return null;
    const wanted = new Set(closed.map((barcode) => barcode.code));
    history.forEach((item) => barcodeEntriesOf(item && item.barcodes).forEach(({ barcode }) => {
        if (barcode && wanted.has(barcode.code) && !kept.has(barcode.code) && !restorePendingCode(item, barcode.code)) kept.set(barcode.code, { id: item.id, trash: false, closed: !!barcode.isClosed });
    }));
    const holds = (item, code) => !!item && barcodeEntriesOf(item.barcodes).some(({ barcode }) => barcode && barcode.code === code);
    const keepsMark = (item, code) => {
        const reason = item ? trashReasonOf(item) : '';
        return (reason === 'pickup' || reason === 'delete')
            && barcodeEntriesOf(item.barcodes).some(({ barcode }) => barcode && barcode.code === code && barcode.isClosed && barcode.isDeducted !== true);
    };
    const copies = dataState.deletedItems.filter((item) => item && typeof item.id === 'string' && item.id !== entry.trashItem.id && /^[a-zA-Z0-9_-]+$/.test(item.id)
        && closed.some((barcode) => !kept.has(barcode.code) && holds(item, barcode.code)));
    try {
        for (const copy of copies) {
            const snap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(keptDb, `zoew_recently_deleted_cod_dod/${copy.id}`)));
            if (!isCurrent()) return null;
            const fresh = snap.exists() ? snap.val() : null;
            closed.forEach((barcode) => { if (!kept.has(barcode.code) && keepsMark(fresh, barcode.code)) kept.set(barcode.code, { id: copy.id, trash: true, closed: true }); });
        }
    } catch (readErr) {
        return null;
    }
    return { closed, kept };
}

export async function dropCleanupCollected(entry, isCurrent, db?) {
    const found = await cleanupCollectedKept(entry, isCurrent, db);
    if (!found || !isCurrent()) return false;
    const marks = [];
    found.closed.forEach((barcode) => { if (!found.kept.has(barcode.code)) marks.push(...collectedMarksFor(barcode, false, barcode.closedAt)); });
    const applied = marks.length ? markCollectedRevenue(marks, true) : null;
    const day = cleanupScanDateOf(entry.trashItem);
    const pickupMarks = found.closed.filter((barcode) => !(found.kept.get(barcode.code) || {}).closed)
        .map((barcode) => ({ key: pickupBarcodeKey(barcode.code), phoneKey: getPickupPhoneKey(entry.trashItem), closed: false }));
    const pickupDrop = pickupMarks.length ? commitPickupMarks(day, pickupMarks, false, true) : null;
    try {
        if (applied && await dbOp(applied.server) !== true) return 'refused';
        if (pickupDrop && await dbOp(pickupDrop) !== true) return 'refused';
    } catch (writeErr) {
        return false;
    }
    return remarkCleanupCollectedKept(entry, isCurrent, db, applied || pickupDrop ? null : found);
}

export async function remarkCleanupCollectedKept(entry, isCurrent, db?, known?) {
    const found = known || await cleanupCollectedKept(entry, isCurrent, db);
    if (!found) return false;
    const remarkDb = db || firebaseState.db;
    const holders = new Map();
    found.kept.forEach((holder, code) => {
        if (!holder || typeof holder.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(holder.id)) return;
        const holderPath = (holder.trash ? 'zoew_recently_deleted_cod_dod/' : 'zoew_scan_history_cod_dod/') + holder.id;
        if (!holders.has(holderPath)) holders.set(holderPath, { id: holder.id, trash: holder.trash, codes: [] });
        holders.get(holderPath).codes.push(code);
    });
    const cutoff = collectedRetentionCutoffKey(getServerNow());
    const pickupDays = new Map();
    try {
        for (const [holderPath, holder] of holders) {
            if (!isCurrent()) return false;
            const snap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(remarkDb, holderPath)));
            if (!isCurrent()) return false;
            const value = snap.exists() ? snap.val() : null;
            if (!value) return 'refused';
            const keys = [];
            const counted = pickupCopyMarks(value, holder.trash).filter((mark) => mark.closed);
            const pickupDay = /^[0-9-]+$/.test(String(value.scanDate || '')) ? value.scanDate : '';
            for (const code of holder.codes) {
                if (!holder.trash && restorePendingCode(value, code)) continue;
                const key = pickupBarcodeKey(code);
                const mark = pickupDay ? counted.find((candidate) => candidate.key === key) : null;
                if (mark) {
                    const picked = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(remarkDb, `zoew_daily_pickup_cod_dod/${pickupDay}/pickedUpBarcodes/${key}`)));
                    if (!isCurrent()) return false;
                    if (!picked.exists()) {
                        if (!pickupDays.has(pickupDay)) pickupDays.set(pickupDay, []);
                        pickupDays.get(pickupDay).push(mark);
                    }
                }
                const barcode = barcodeEntriesOf(value.barcodes).map((held) => held.barcode).find((candidate) => candidate && candidate.code === code);
                const day = barcode && barcode.isClosed && barcode.isDeducted !== true ? collectedDayOfStamp(barcode.closedAt) : '';
                if (!day || day < cutoff) continue;
                const leaf = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(remarkDb, `zoew_daily_collected_cod_dod/${day}/${key}`)));
                if (!isCurrent()) return false;
                if (!leaf.exists()) keys.push(key);
            }
            if (keys.length && await reconcileCollectedHistory(holder.id, keys, undefined, undefined, true) !== true) return 'refused';
        }
        for (const [pickupDay, marks] of pickupDays) {
            if (!isCurrent()) return false;
            if (await dbOp(commitPickupMarks(pickupDay, marks, false, true)) !== true) return isCurrent() ? 'refused' : false;
        }
    } catch (readErr) {
        return false;
    }
    return isCurrent();
}

export function cleanupStoredOutcome(entry) {
    return entry && (entry.outcome === 'restored' || entry.outcome === 'unverified') ? entry.outcome : '';
}

export async function finishCleanupCollected(entry, outcome, isCurrent, db?) {
    if (!isCurrent()) return '';
    const trashId = entry.trashItem.id;
    if (!cleanupDropsMirror(entry)) {
        clearCleanupJournalEntry(trashId, entry.trashItem, entry.scope);
        return outcome;
    }
    patchCleanupJournalEntry(trashId, { stage: CLEANUP_STAGE_COLLECTED, outcome: outcome || '' }, entry.trashItem, entry.scope);
    if (!isCurrent()) return '';
    const dropped = await dropCleanupCollected(entry, isCurrent, db);
    if (!isCurrent()) return '';
    if (dropped === 'refused') {
        const tries = (typeof entry.collectedTries === 'number' && isFinite(entry.collectedTries) ? entry.collectedTries : 0) + 1;
        if (tries < CLEANUP_LEDGER_RETRY_MAX) {
            patchCleanupJournalEntry(trashId, { collectedTries: tries }, entry.trashItem, entry.scope);
            return '';
        }
        if (window.ZoeErrors) ZoeErrors.capture(new Error('Cleanup collected mirror write refused'), { zone: 'data', context: 'finishCleanupCollected', itemId: entry.id });
    } else if (dropped !== true) {
        return '';
    }
    clearCleanupJournalEntry(trashId, entry.trashItem, entry.scope);
    return outcome;
}

export const cleanupJournalLive = new Map();

export const cleanupResumeBarrier = { settled: Promise.resolve() };

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

export function markCleanupJournalLive(trashId, operation?) {
    if (typeof trashId !== 'string' || !trashId) return;
    const existing = cleanupJournalLive.get(trashId);
    if (existing) {
        if (existing.db === firebaseState.db && existing.generation === firebaseState.authGeneration) {
            if (operation) {
                existing.operations.add(operation);
                operation.journal.set(trashId, existing);
            }
            return;
        }
        releaseCleanupJournalLive(trashId, existing);
    }
    let release = null;
    let settled = Promise.resolve();
    const locks = cleanupLockManager();
    if (locks) {
        try {
            const held = new Promise((resolve) => { release = resolve; });
            const granted = locks.request(CLEANUP_LIVE_LOCK_PREFIX + trashId, () => held);
            settled = Promise.resolve(granted).then(() => {}, () => {});
        } catch (e) {}
    }
    cleanupJournalLive.set(trashId, { release, settled, db: firebaseState.db, generation: firebaseState.authGeneration, operations: new Set(operation ? [operation] : []) });
    if (operation) operation.journal.set(trashId, cleanupJournalLive.get(trashId));
}

export function releaseCleanupJournalLive(trashId, expectedOwner?, operation?) {
    const owner = cleanupJournalLive.get(trashId);
    if (!owner || expectedOwner && owner !== expectedOwner) return;
    if (operation) {
        owner.operations.delete(operation);
        if (owner.operations.size) return;
    }
    cleanupJournalLive.delete(trashId);
    if (typeof owner.release === 'function') owner.release();
    if (firebaseState.db !== owner.db || firebaseState.authGeneration !== owner.generation) return;
    const entry = readCleanupJournal().find((candidate) => candidate.trashItem.id === trashId);
    if (!entry || cleanupJournalScopeMismatch(entry)) return;
    void Promise.resolve(owner.settled).then(async () => {
        await cleanupResumeBarrier.settled;
        if (firebaseState.db !== owner.db || firebaseState.authGeneration !== owner.generation || cleanupJournalScopeMismatch(entry)) return;
        await resumeInterruptedCleanups();
    }).catch((error) => {
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: 'cleanup owner recovery handoff', itemId: entry.id });
    });
}

export function holdCleanupJournalLive(trashIds, pending, isCurrent, operation?) {
    const owners = [];
    new Set(trashIds || []).forEach((trashId) => {
        const owner = cleanupJournalLive.get(trashId);
        if (!owner) return;
        owner.hold = isCurrent;
        owners.push([trashId, owner]);
    });
    const release = () => owners.forEach(([trashId, owner]) => releaseCleanupJournalLive(trashId, owner, operation));
    if (!isCurrent()) {
        release();
        return;
    }
    void settleLockWithin(pending, LOCK_STALL_RELEASE_MS, 'cleanup live hold').then(release, release);
}

export function withCleanupEntryOwnership(trashId, run) {
    const live = cleanupJournalLive.get(trashId);
    if (live) {
        if (typeof live.hold !== 'function' || live.hold()) return Promise.resolve(false);
        releaseCleanupJournalLive(trashId, live);
        return settleLockWithin(live.settled, CLEANUP_OWNERSHIP_WAIT_MS, 'cleanup stale hold').then(() => withCleanupEntryOwnership(trashId, run));
    }
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
        clearCleanupJournalEntry(trashItem.id, trashItem, entry.scope);
        if (entry.switchReported === true) return '';
        const moneyUnproven = !!entry.revenue && entry.stage !== CLEANUP_STAGE_COLLECTED;
        return moneyUnproven || cleanupStoredOutcome(entry) === 'unverified' ? 'dropped-money' : 'dropped-data';
    }
    const priorMode = trashItem.trashMode;
    const priorBlocked = trashItem.restoreBlocked;
    stampTrashPolicy(trashItem, priorMode || 'local');
    if (priorMode !== trashItem.trashMode || priorBlocked !== trashItem.restoreBlocked) patchCleanupJournalEntry(trashId, { trashItem }, trashItem, entry.scope);
    const resumeDb = firebaseState.db;
    const resumeGeneration = firebaseState.authGeneration;
    const resumeIsCurrent = () => firebaseState.db === resumeDb && firebaseState.authGeneration === resumeGeneration;
    const rev = entry.revenue;
    let stage = entry.stage;
    const keyed = entry.ledger === CLEANUP_LEDGER_KEYED;
    if (stage === CLEANUP_STAGE_UNDO) return cleanupLedgerResult(trashItem.id, rev && keyed ? await undoCleanupRevenue(entry) : 'done', trashItem, entry.scope);
    if (stage === CLEANUP_STAGE_COLLECTED) return finishCleanupCollected(entry, cleanupStoredOutcome(entry), resumeIsCurrent, resumeDb);
    if (stage === CLEANUP_STAGE_FLIP) {
        const settled = rev ? await settleCleanupDeduction(entry.id, trashItem, rev, true, entry) : true;
        if (typeof settled === 'string') return cleanupLedgerResult(trashItem.id, settled, trashItem, entry.scope);
        if (settled) await finishCleanupCollected(entry, '', resumeIsCurrent, resumeDb);
        return '';
    }
    let outcome = '';
    if (stage === CLEANUP_STAGE_SLOT) {
        const slot = await resolveCleanupSlot(trashItem, entry.id);
        if (slot === 'wait' || !resumeIsCurrent()) return '';
        if (slot === 'elsewhere') {
            clearCleanupJournalEntry(trashItem.id, trashItem, entry.scope);
            return '';
        }
        markCleanupJournalStage(trashItem.id, CLEANUP_STAGE_MOVED, trashItem, entry.scope);
        stage = CLEANUP_STAGE_MOVED;
        if (slot === 'claimed') outcome = 'restored';
    }
    let present = false;
    try {
        const snap = await dbOp(firebaseState.fb.get(firebaseState.fb.ref(resumeDb, `zoew_recently_deleted_cod_dod/${trashItem.id}`)));
        present = snap.exists();
    } catch (readErr) {
        return '';
    }
    if (!resumeIsCurrent()) return '';
    if (!present) {
        const history = await cleanupHistoryForRecovery(entry.id, trashItem, resumeDb);
        if (!history || !resumeIsCurrent()) return '';
        const back = cleanupBarcodesBackInHistory(trashItem, history);
        if (back === null) return '';
        if (stage !== CLEANUP_STAGE_MOVED) {
            if (!keyed || !rev) return finishCleanupCollected(entry, rev ? 'unverified' : '', resumeIsCurrent, resumeDb);
            if (back) return cleanupLedgerResult(trashItem.id, await undoCleanupRevenue(entry), trashItem, entry.scope);
            const deduction = await deductCleanupLedgerKeyed(trashItem, rev, entry.prior || CLEANUP_NO_PRIOR);
            if (deduction === 'deducted') return finishCleanupCollected(entry, '', resumeIsCurrent, resumeDb);
            return cleanupLedgerResult(trashItem.id, deduction, trashItem, entry.scope);
        }
        if (back) {
            clearCleanupJournalEntry(trashItem.id, trashItem, entry.scope);
            return '';
        }
        try {
            await notifyIfSlow(retryAsync(() => (resumeIsCurrent() ? dbOp(saveSingleDeletedItemToFirebase(trashItem)) : Promise.reject(Object.assign(new Error('Cleanup session changed'), { noRetry: true }))), 3, 1500),
                TRASH_WRITE_SLOW_NOTICE_MS,
                "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងបញ្ចប់ការសម្អាតដែលត្រូវរំខានពីមុន… សូមកុំបិទ App។");
            outcome = 'restored';
        } catch (writeErr) {
            return '';
        }
        if (!resumeIsCurrent()) return '';
    }
    if (stage === CLEANUP_STAGE_MOVED && rev) {
        const deduction = await deductCleanupRevenue(entry.id, trashItem, rev);
        if (deduction === 'deducted') {
            markCleanupJournalStage(trashItem.id, CLEANUP_STAGE_FLIP, trashItem, entry.scope);
            if (!(await settleCleanupDeduction(entry.id, trashItem, rev, false))) return outcome;
        } else {
            return outcome;
        }
    } else if (stage === CLEANUP_STAGE_LEDGER && rev) {
        if (!keyed) {
            outcome = 'unverified';
        } else {
            const deduction = await deductCleanupLedgerKeyed(trashItem, rev, entry.prior || CLEANUP_NO_PRIOR);
            if (deduction !== 'deducted') return cleanupLedgerResult(trashItem.id, deduction, trashItem, entry.scope);
            markCleanupJournalStage(trashItem.id, CLEANUP_STAGE_FLIP, trashItem, entry.scope);
            if (!(await settleCleanupDeduction(entry.id, trashItem, rev, false))) return '';
            outcome = 'restored';
        }
    }
    return finishCleanupCollected(entry, outcome, resumeIsCurrent, resumeDb);
}

export async function resumeInterruptedCleanups() {
    if (dataState.cleanupResumeInFlight || !firebaseState.db || !firebaseState.fb || !firebaseState.dbRefDeleted || shopScopePending()) return;
    const claimScope = liveShopScope();
    if (pendingTrashClaims(claimScope).length) {
        const claimDb = firebaseState.db;
        const claimGeneration = firebaseState.authGeneration;
        await releaseLeftoverTrashClaims(claimScope, () => firebaseState.db === claimDb && firebaseState.authGeneration === claimGeneration);
    }
    const list = readCleanupJournal();
    if (!list.length && !dataState.deletedItems.some(restoreAwaitsCancellation)) return;
    dataState.cleanupResumeInFlight = true;
    let finishResume = () => {};
    cleanupResumeBarrier.settled = new Promise<void>((resolve) => { finishResume = resolve; });
    let restored = 0;
    let unverified = 0;
    const drops = [{ zone: 'money', ids: [] }, { zone: 'data', ids: [] }];
    const reportDrops = () => drops.forEach((drop) => {
        const ids = drop.ids.splice(0);
        if (!ids.length || !window.ZoeErrors) return;
        ZoeErrors.capture(new Error('Cleanup journal entry dropped after shop change'), { zone: drop.zone, context: 'resumeCleanupJournalEntry scope mismatch', itemId: ids[0], itemCount: ids.length, itemIds: ids.slice(0, CLEANUP_DROP_REPORT_IDS_MAX).join(',') });
    });
    list.sort((a, b) => (cleanupJournalScopeMismatch(a) ? 0 : 1) - (cleanupJournalScopeMismatch(b) ? 0 : 1));
    try {
        await resumeBlockedRestoreCancellations();
        for (let i = 0; i < list.length; i++) {
            if (!cleanupJournalScopeMismatch(list[i])) reportDrops();
            const trashId = list[i].trashItem.id;
            let outcome = '';
            const owned = await withCleanupEntryOwnership(trashId, async () => {
                outcome = await resumeCleanupJournalEntry(trashId);
            });
            if (!owned) continue;
            if (outcome === 'restored') restored++;
            else if (outcome === 'unverified') unverified++;
            else if (outcome === 'dropped-money' || outcome === 'dropped-data') drops[outcome === 'dropped-money' ? 0 : 1].ids.push(list[i].id);
        }
    } catch (resumeErr) {
        console.error('resumeInterruptedCleanups failed', resumeErr);
        if (window.ZoeErrors) ZoeErrors.capture(resumeErr, { zone: 'money', context: 'resumeInterruptedCleanups' });
    } finally {
        dataState.cleanupResumeInFlight = false;
        finishResume();
    }
    reportDrops();
    if (restored) showToast('✅ បញ្ចប់ការសម្អាតស្វ័យប្រវត្តិដែលត្រូវរំខានពីមុនវិញ ' + restored + ' កញ្ចប់។');
    if (unverified) {
        if (window.ZoeErrors) ZoeErrors.capture(new Error('Interrupted cleanup resumed with unverified ledger'), { zone: 'money', context: 'resumeInterruptedCleanups unverified', itemCount: unverified });
        showToast('⚠️ កញ្ចប់ត្រូវបានស្តារចូលធុងសំរាមវិញ ប៉ុន្តែស្ថិតិប្រាក់មិនអាចផ្ទៀងផ្ទាត់បានទេ! សូមប្រាប់ Admin ពិនិត្យ។');
    }
}

export async function restoreClaimedItemToScanHistory(id, claimedWhole, claimedPartial) {
    const restoreDb = firebaseState.db;
    const restoreGeneration = firebaseState.authGeneration;
    const itemRef = firebaseState.fb.ref(restoreDb, `zoew_scan_history_cod_dod/${id}`);
    let clearClaimBlocked = false;
    return retryAsync(() => (firebaseState.db !== restoreDb || firebaseState.authGeneration !== restoreGeneration
        ? Promise.reject(Object.assign(new Error('Restore session changed'), { noRetry: true }))
        : dbOp(firebaseState.fb.runTransaction(itemRef, (currentItem) => {
        clearClaimBlocked = false;
        if (currentItem && currentItem.clearClaim) {
            clearClaimBlocked = true;
            return;
        }
        normalizeBarcodesOf(currentItem);
        if (claimedWhole && !currentItem) {
            const updated = cloneRestoreItem(claimedWhole);
            delete updated.restoreClaim;
            delete updated.restoreClaimId;
            delete updated.restoreClaimToken;
            delete updated.restoreAddedCodes;
            return updated;
        }
        const source = claimedWhole ? cloneRestoreItem(claimedWhole) : claimedPartial;
        if (claimedWhole) ensureBarcodeArrayForItem(source);
        const reclaimed = barcodeEntriesOf(source.barcodes).map(({ barcode }) => { const { isDeducted, ...rest } = barcode; return rest; });
        if (!reclaimed.length) return currentItem;
        const base = currentItem || { ...claimedPartial, barcodes: [] };
        if (!currentItem) {
            delete base.restoreClaim;
            delete base.restoreClaimId;
            delete base.restoreClaimToken;
            delete base.restoreAddedCodes;
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
    }))), 3, 1500).then((result) => {
        if (clearClaimBlocked || !result || !result.committed) throw new Error('CLEAR_HISTORY_IN_PROGRESS');
        return result;
    });
}

export function trashSlotSharesClaim(occupant, trashItem) {
    const codesOf = (item) => cleanupTrashCodes(item);
    const ours = codesOf(trashItem);
    if (!ours.size) return true;
    const theirs = codesOf(occupant);
    return Array.from(ours).some((code) => theirs.has(code));
}

export function claimCleanupTrashSlot(trashItem, moved?, operation?) {
    if (!firebaseState.db || !firebaseState.fb || !trashItem || !trashItem.id || !/^[a-zA-Z0-9_-]+$/.test(trashItem.id)) {
        return Promise.reject(new Error('Trash Firebase reference unavailable'));
    }
    const slotDb = firebaseState.db, slotApi = firebaseState.fb, slotGeneration = firebaseState.authGeneration;
    const slotCurrent = () => firebaseState.db === slotDb && firebaseState.authGeneration === slotGeneration;
    const liveOwner = cleanupJournalLive.get(trashItem.id);
    return slotApi.runTransaction(slotApi.ref(slotDb, `zoew_recently_deleted_cod_dod/${trashItem.id}`), (current) => (!slotCurrent() || current ? undefined : trashItem))
        .then((result) => {
            if (!slotCurrent()) return false;
            if (result && result.committed) return true;
            const existing = result && result.snapshot ? result.snapshot.val() : null;
            if (!existing) return false;
            if (existing.deletedAt === trashItem.deletedAt) return true;
            if (moved || trashSlotSharesClaim(existing, trashItem)) return false;
            const from = trashItem.id;
            const to = cleanupPartialTrashId(from, String(trashItem.trashReason) + '|slot', trashItem);
            if (!to || to === from || !/^[a-zA-Z0-9_-]{1,64}$/.test(to)) return false;
            trashItem.id = to;
            try {
                const entry = readCleanupJournal().find((e) => e.trashItem.id === from && cleanupJournalClaimMatches(e, trashItem));
                if (entry) {
                    noteCleanupJournalEntry(Object.assign({}, entry, { trashItem }));
                    clearCleanupJournalEntry(from, trashItem);
                }
            } catch (journalErr) {}
            if (liveOwner && cleanupJournalLive.get(from) === liveOwner) {
                releaseCleanupJournalLive(from, liveOwner, operation);
                markCleanupJournalLive(to, operation);
            }
            return claimCleanupTrashSlot(trashItem, true, operation);
        });
}

export function cleanupPartialTrashId(itemId, reason, claimedPartial) {
    const stamp = parseTimestampFromId(itemId) || parseFloat(claimedPartial && claimedPartial.createdAt) || 0;
    const parts = barcodeEntriesOf(claimedPartial && claimedPartial.barcodes)
        .map(({ barcode }) => [barcode.code, barcode.closedAt || '', barcode.restoredAt || ''].join(':'))
        .sort();
    return 'id_' + stamp + '_' + ledgerEventToken(itemId, String(reason) + '|' + parts.join(','), 'c').slice(4);
}

export function prepareCleanupClaim(id, reason, whole, partial, mode = getManualZtoTrashMode(), operation?) {
    const trashItem = cloneRestoreItem(partial || whole);
    trashItem.id = partial ? cleanupPartialTrashId(id, reason, partial) : id;
    trashItem.deletedAt = getServerNow();
    trashItem.isFromDeletion = reason === 'close';
    trashItem.trashReason = reason === 'abandon' ? 'returned' : reason === 'remove' ? 'remove' : 'pickup';
    if (Array.isArray(trashItem.barcodes)) {
        trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isFromDeletion: trashItem.isFromDeletion }));
        trashItem.count = trashItem.barcodes.length;
        recalcItemMoneyFromBarcodes(trashItem);
        trashItem.barcode = trashItem.barcodes[0]?.code || trashItem.barcode;
        trashItem.isClosed = trashItem.barcodes.length > 0 && trashItem.barcodes.every(b => b.isClosed);
    }
    stripHistoryOnlyMarkers(trashItem);
    stampTrashPolicy(trashItem, mode);
    const owedBarcodes = reason === 'remove' && Array.isArray(trashItem.barcodes) ? trashItem.barcodes.filter(b => b && b.isDeducted !== true) : null;
    const owed: any = owedBarcodes ? { barcodes: owedBarcodes, count: owedBarcodes.length } : trashItem;
    if (owedBarcodes) recalcItemMoneyFromBarcodes(owed);
    const deduct = reason === 'abandon' || (reason === 'remove' && owed.count !== 0);
    const entry = { id, reason, journalAt: getServerNow(), stage: CLEANUP_STAGE_SLOT, trashItem,
        revenue: deduct ? { scanDate: cleanupScanDateOf(trashItem), cod: owed.cod, dod: owed.dod, count: owed.count } : null };
    markCleanupJournalLive(trashItem.id, operation);
    const liveOwner = cleanupJournalLive.get(trashItem.id);
    noteCleanupJournalEntry(entry);
    if (!readCleanupJournal().some(e => e.trashItem.id === trashItem.id && e.trashItem.deletedAt === trashItem.deletedAt)) {
        releaseCleanupJournalLive(trashItem.id, liveOwner, operation);
        throw new Error('write_journal_unavailable');
    }
    return entry;
}


export async function claimAndCleanupItem(id, reason, opts?) {
    if (!firebaseState.db || !id || !/^[a-zA-Z0-9_-]+$/.test(id) || cleanupInFlight.has(id)) return;
    if (reason === 'close' && collectedSettleHeld(id)) return;
    let journalFull = false;
    try { journalFull = cleanupInFlight.size + readCleanupJournal().length >= CLEANUP_JOURNAL_MAX; } catch (journalErr) {}
    if (journalFull) return;
    const cleanupMode = reason === 'close' ? getShopZtoTrashMode() : getManualZtoTrashMode();
    if (!cleanupMode) return;
    const operation = beginCleanupOperation(id);
    const cleanupDb = firebaseState.db;
    const cleanupGeneration = firebaseState.authGeneration;
    const cleanupIsCurrent = () => firebaseState.db === cleanupDb && firebaseState.authGeneration === cleanupGeneration;
    const noteCleanupSessionSwitch = (step, trashId) => {
        if (trashId) { try { patchCleanupJournalEntry(trashId, { switchReported: true }, preparedEntry?.trashItem, operation.scope); } catch (journalErr) {} }
        if (window.ZoeErrors) ZoeErrors.capture(new Error('Cleanup stopped after a database switch'), { zone: 'money', context: 'claimAndCleanupItem session switch ' + step, itemId: id, reason });
    };

    let claimedWhole = null;
    let claimedPartial = null;
    const forced = reason === 'abandon' && opts && Array.isArray(opts.codes) ? new Set(opts.codes) : null;
    const forcedAt = forced && opts.returnedAt instanceof Map ? opts.returnedAt : null;
    const held = reason === 'abandon' && !forced && opts && Array.isArray(opts.hold) ? new Set(opts.hold) : null;
    const trashClaim = beginTrashClaim(id);
    const claimToken = trashClaim.token;
    let claimPhase = true;
    const claimable = (b) => (claimPhase ? !trashClaimHeldByOther(b, claimToken, getServerNow()) : trashClaimOwned(b, claimToken, getServerNow()));
    const cleanupUpdater = (currentItem) => {
        claimedWhole = null;
        claimedPartial = null;
        if (!currentItem) return currentItem;
        if (currentItem.clearClaim) return currentItem;
        if (itemHasRestoreMarkers(currentItem)) return;
        normalizeBarcodesOf(currentItem);
        const ts = currentItem.createdAt || parseTimestampFromId(id) || getServerNow();

        if (reason === 'abandon') {
            if (currentItem.isClosed || (!forced && (getServerNow() - ts) <= ABANDON_AGE_MS)) return currentItem;

            if (currentItem.barcodes && Array.isArray(currentItem.barcodes) && currentItem.barcodes.length) {
                const staleOpen = currentItem.barcodes.filter(b => (forced
                    ? !!b && !b.isClosed && forced.has(b.code) && (!forcedAt || barcodeReturnCounts(b, currentItem.createdAt, forcedAt.get(b.code)))
                    : barcodeAbandonIsRipe(b, ts, getServerNow()) && !(held && held.has(b.code))) && claimable(b));
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
                return updated;
            }

            return currentItem;
        } else {
            if (currentItem.barcodes && Array.isArray(currentItem.barcodes) && currentItem.barcodes.length) {
                const ripeClosed = currentItem.barcodes.filter(b => barcodeCloseIsRipe(b, getServerNow(), cleanupMode) && claimable(b));
                if (ripeClosed.length === 0) return undefined;

                const keptBarcodes = currentItem.barcodes.filter(b => !ripeClosed.includes(b));
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
                return updated;
            }

            return currentItem;
        }
    };
    let preparedEntry = null;
    let pendingCleanup = false;
    let cleanupFinishing = false;
    const releasePreparedClaim = () => releaseCleanupOperation(null, operation);
    let movedCodes = [];
    const settleClaim = trashClaim.settle;
    const durableCleanupUpdater: any = (currentItem) => {
        movedCodes = [];
        if (!cleanupIsCurrent()) { noteCleanupSessionSwitch('claim', preparedEntry && preparedEntry.trashItem.id); return; }
        if (getManualZtoTrashMode() !== cleanupMode) return;
        claimPhase = false;
        let next = cleanupUpdater(currentItem);
        const claimed = claimedWhole || claimedPartial;
        if (claimed) {
            barcodeEntriesOf(claimed.barcodes).forEach(({ barcode }) => { movedCodes.push(barcode.code); stripTrashClaim(barcode); });
            preparedEntry = prepareCleanupClaim(id, reason, claimedWhole, claimedPartial, cleanupMode, operation);
        }
        const kept = next === undefined ? currentItem : next;
        const ours = kept ? barcodeEntriesOf(kept.barcodes).filter(({ barcode }) => barcode && barcode.trashClaim === claimToken) : [];
        if (ours.length) {
            ours.forEach(({ barcode }) => stripTrashClaim(barcode));
            if (next === undefined) next = currentItem;
        }
        return next;
    };
    durableCleanupUpdater.txOutcomeWitness = (server) => (barcodeEntriesOf(server && server.barcodes)
        .some(({ barcode }) => barcode && barcode.trashClaim === claimToken && movedCodes.includes(barcode.code)) ? 'not-applied' : 'applied');
    const finishCleanup = async (result) => {
        if (!result.committed || (!claimedWhole && !claimedPartial)) {
            if (!cleanupIsCurrent()) return;
            if (preparedEntry) clearCleanupJournalEntry(preparedEntry.trashItem.id, preparedEntry.trashItem);
            return;
        }
        if (!cleanupIsCurrent()) {
            noteCleanupSessionSwitch('claim', preparedEntry && preparedEntry.trashItem.id);
            return;
        }

        let trashItem;
        let revenuePending = false;
        let revenueScanDate = null;
        let revenueCod = 0, revenueDod = 0, revenueCount = 0;
        if (claimedPartial) {
            const partialIsPickup = reason !== 'abandon';
            trashItem = { ...claimedPartial, id: cleanupPartialTrashId(id, reason, claimedPartial) };
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
                trashItem.trashReason = 'returned';
                revenueScanDate = cleanupScanDateOf(trashItem);
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
                trashItem.trashReason = 'returned';
                trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b,
                    cod: Math.round((parseFloat(b.cod) || 0) * 100) / 100,
                    dod: Math.round((parseFloat(b.dod) || 0) * 100) / 100,
                    isDeducted: false, isFromDeletion: false }));
                recalcItemMoneyFromBarcodes(trashItem);
                revenueScanDate = cleanupScanDateOf(trashItem);
                revenueCod = Math.round((parseFloat(trashItem.cod) || 0) * 100) / 100;
                revenueDod = Math.round((parseFloat(trashItem.dod) || 0) * 100) / 100;
                revenueCount = trashItem.barcodes.length;
                revenuePending = true;
            } else {
                trashItem.isFromDeletion = true;
                trashItem.trashReason = 'pickup';
                trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isFromDeletion: true }));
            }
        }

        stripHistoryOnlyMarkers(trashItem);
        if (preparedEntry) trashItem.deletedAt = preparedEntry.trashItem.deletedAt;
        stampTrashPolicy(trashItem, preparedEntry?.trashItem.trashMode || cleanupMode);

        try { markCleanupJournalLive(trashItem.id, operation); } catch (liveErr) {}
        try {
            noteCleanupJournalEntry({
                id: id,
                reason: reason,
                journalAt: getServerNow(),
                stage: CLEANUP_STAGE_SLOT,
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
            const writeTrash = () => (cleanupIsCurrent() ? claimCleanupTrashSlot(trashItem, false, operation) : Promise.reject(Object.assign(new Error('Cleanup session changed'), { noRetry: true })))
                .then((claimed) => { trashElsewhere = !claimed; });
            await notifyIfSlow(retryAsync(writeTrash, 4, 1500),
                TRASH_WRITE_SLOW_NOTICE_MS,
                "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរក្សាទុកការសម្អាតស្វ័យប្រវត្តិ… សូមកុំបិទ App។").then(() => {
                trashSaved = true;
            }).catch(async (trashErr) => {
                const staleIdx = dataState.deletedItems.findIndex(i => i.id === trashItem.id);
                if (staleIdx !== -1) dataState.deletedItems.splice(staleIdx, 1);
                console.error('Trash write permanently failed for automatic cleanup of', id, trashErr);
                if (!cleanupIsCurrent()) {
                    noteCleanupSessionSwitch('trash', trashItem.id);
                    return;
                }
                if (window.ZoeErrors) ZoeErrors.capture(trashErr, { zone: 'money', context: 'claimAndCleanupItem trash write failed after retries', itemId: id, reason });

                try {
                    await restoreClaimedItemToScanHistory(id, claimedWhole, claimedPartial);
                    try { clearCleanupJournalEntry(trashItem.id, trashItem); } catch (journalErr) {}
                } catch (restoreErr) {
                    console.error('Failed to restore item to scan history after trash write failure for', id, restoreErr);
                    if (window.ZoeErrors) ZoeErrors.capture(restoreErr, { zone: 'money', context: 'claimAndCleanupItem restore-after-trash-failure also failed', itemId: id, reason });
                    showToast('⚠️ បញ្ហាធ្ងន់ធ្ងរ៖ ទិន្នន័យកញ្ចប់ ' + id + ' អាចនឹងបាត់! សូមប្រាប់ Admin ត្រួតពិនិត្យភ្លាមៗ');
                }
            });
            if (!trashSaved) return;
            if (!cleanupIsCurrent()) {
                noteCleanupSessionSwitch('trash', trashItem.id);
                return;
            }
            if (trashElsewhere) {
                const dupIdx = dataState.deletedItems.findIndex(i => i.id === trashItem.id);
                if (dupIdx !== -1) dataState.deletedItems.splice(dupIdx, 1);
                try { clearCleanupJournalEntry(trashItem.id, trashItem); } catch (journalErr) {}
                return;
            }
            if (!revenuePending) {
                try { clearCleanupJournalEntry(trashItem.id, trashItem); } catch (journalErr) {}
                return;
            }
            const revenue = { scanDate: revenueScanDate, cod: revenueCod, dod: revenueDod, count: revenueCount };
            const deduction = await deductCleanupRevenue(id, trashItem, revenue);
            if (deduction === 'stale' || !cleanupIsCurrent()) {
                noteCleanupSessionSwitch('ledger', trashItem.id);
                return;
            }
            if (deduction === 'deducted') {
                try { markCleanupJournalStage(trashItem.id, CLEANUP_STAGE_FLIP, trashItem); } catch (journalErr) {}
                const settled = await settleCleanupDeduction(id, trashItem, revenue, false);
                if (!settled) return;
            } else {
                if (window.ZoeErrors) ZoeErrors.capture(new Error('Automatic cleanup revenue awaits confirmation'), { zone: 'money', context: 'claimAndCleanupItem ledger ' + deduction, itemId: id, reason });
                showToast('⏳ ការសម្អាតបានរក្សាទុក — ស្ថិតិប្រាក់នឹង Sync ស្វ័យប្រវត្តិ។');
                return;
            }
            try { clearCleanupJournalEntry(trashItem.id, trashItem); } catch (journalErr) {}
        } finally {
            try { releaseCleanupOperation(null, operation); } catch (liveErr) {}
        }
    };
    const finishDurableCleanup = async (result) => {
        cleanupFinishing = true;
        settleClaim(!!(result && result.committed));
        try { return await finishCleanup(result); } finally { releasePreparedClaim(); }
    };
    try {
        trashClaim.start();
        const claim: any = await claimTrashBarcodes(id, claimToken, (item) => {
            if (getManualZtoTrashMode() !== cleanupMode) return [];
            claimPhase = true;
            cleanupUpdater(JSON.parse(JSON.stringify(item)));
            const target = claimedWhole || claimedPartial;
            claimedWhole = null;
            claimedPartial = null;
            return target ? barcodeEntriesOf(target.barcodes).map(({ barcode }) => barcode.code) : [];
        });
        if (claim.state !== 'claimed' || !cleanupIsCurrent()) {
            if (claim.state === 'none' || claim.state === 'idle' || claim.state === 'busy') await settleClaim(true);
            return;
        }
        const cleanupTx = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${id}`), durableCleanupUpdater);
        let result;
        try {
            result = await dbOp(cleanupTx);
        } catch (txError) {
            if (dbOpStalled(txError)) {
                pendingCleanup = true;
                armLateCommit(cleanupTx, finishDurableCleanup, (lateErr) => {
                    if (lateErr && lateErr.txOutcome === 'not-applied' && preparedEntry && cleanupIsCurrent()) clearCleanupJournalEntry(preparedEntry.trashItem.id, preparedEntry.trashItem);
                    settleClaim(false);
                    releasePreparedClaim();
                }, 'claimAndCleanupItem ' + reason);
                return;
            }
            throw txError;
        }
        await settleLockWithin(finishDurableCleanup(result), LOCK_STALL_RELEASE_MS, 'claimAndCleanupItem ' + reason);
    } catch (e) {
        if (e && e.txOutcome === 'not-applied') {
            if (preparedEntry && cleanupIsCurrent()) clearCleanupJournalEntry(preparedEntry.trashItem.id, preparedEntry.trashItem);
            console.warn('Automatic cleanup transaction was not applied (disconnect) for', id);
        } else {
            console.error('Automatic cleanup transaction failed for', id, e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'money', context: 'Automatic cleanup transaction failed for' });
        }
    } finally {
        releaseCleanupOperation(id, operation, true);
        if (!pendingCleanup) await settleClaim(false);
        if (!pendingCleanup && !cleanupFinishing) releasePreparedClaim();
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
            if (item.restoreBlocked === true || isActiveRestoreClaim(item.restoreClaim)) return;
            if (activeRestoreClaims.has(item.id)) return;
            staleClaim = true;
        }
        candidates.push({ id: item.id, barcodes: collectItemBarcodes(item), staleClaim, ledgerKey: cleanupLedgerKeyOf(item) });
    });

    if (!candidates.length) return;

    dataState.deletedCleanupInFlight = true;
    const purgeDb = firebaseState.db;
    const purgeGeneration = firebaseState.authGeneration;
    const purgeIsCurrent = () => firebaseState.db === purgeDb && firebaseState.authGeneration === purgeGeneration;
    try {
        const purgeable = [];
        for (const candidate of candidates) {
            if (!purgeIsCurrent()) return;
            if (candidate.staleClaim) {
                try {
                    if (await releaseStaleRestoreClaimForPurge(candidate.id) === false) continue;
                } catch (claimError) {
                    console.error('Failed to release stale restore claim before purge for', candidate.id, claimError);
                    if (window.ZoeErrors) ZoeErrors.capture(claimError, { zone: 'data', context: 'runAutomaticDeletedCleanup stale claim release', itemId: candidate.id });
                    continue;
                }
            }
            purgeable.push(candidate);
        }
        if (!purgeable.length || !purgeIsCurrent()) return;

        const applyPurged = (list) => {
            if (!list || !list.length || !purgeIsCurrent()) return Promise.resolve();
            const purgedSet = new Set(list.map((c) => c.id));
            dataState.deletedItems = dataState.deletedItems.filter(item => !purgedSet.has(item.id));
            let purgedBarcodes = [];
            list.forEach((candidate) => { purgedBarcodes = purgedBarcodes.concat(candidate.barcodes); });
            return Promise.all([releaseBarcodesInRegistry(purgedBarcodes), releaseCleanupLedgerKeys(list)]);
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
                if (!purgeIsCurrent()) return;
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
    runAutomaticCleanupRules(CLEANUP_SWEEP_BATCH);
    runAutomaticDeletedCleanup();
    runCleanupLedgerKeySweep();
    runAutomaticCollectedCleanup();
    resumePickupIntents();
}
