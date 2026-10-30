import { rowOperationActive } from '../services/row-operation-lock';
import { dataState, firebaseState, ztoState } from '../core/state';
import { getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { shopScopePending } from '../core/shop-scope';
import { ZTO_SIGNED_REOPEN_TEXT } from '../core/text';
import { barcodeReturnBasis, barcodeSignBasis, barcodeZtoMisplaced, barcodeZtoReturned, barcodeZtoSentOut, barcodeZtoSigned, itemHasRestoreMarkers, normalizeBarcodesOf, stampTrashPolicy, trashZtoFinalBlock } from '../domain/barcode';
import { pickupBarcodeKey } from '../domain/pickup';
import { dbOp, dbOpStalled } from '../services/network';
import { showToast } from '../ui/toast';
import { captureZtoSession, loadZtoPickupStatusOnce, ztoPickupStatus } from './zto-status';
import { getShopZtoTrashMode } from './lookup-config';

export const ZTO_FINAL_SCHEDULE_MS = 2000;

export const ZTO_FINAL_SWEEP_BATCH = 20;

export const ZTO_FINAL_FAIL_RETRY_MS = 5 * 60 * 1000;

export const ZTO_FINAL_REFUSED_RETRY_MS = 30 * 60 * 1000;

export const ZTO_FINAL_RETURNED_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export const ZTO_FINAL_RETURNED_MAX = 2000;

export const ZTO_SIGNED_REOPEN_PART_TEXT = ' បើក barcode ដែលមិនទាន់ Sign តាម «កញ្ចប់សរុប»។';

export const ZTO_RESTORE_BLOCK_TEXT = {
    palm: '🔒 កញ្ចប់ដែលចូលធុងសំរាមក្នុងរបៀប ZTO Login មិនអាចស្តារបានទេ។',
    returned: '🔒 កញ្ចប់នេះ ZTO ស្កេនត្រឡប់រួច ហើយត្រូវត្រឡប់ទៅសាខាកណ្តាល — មិនអាចស្តារបានទេ។',
    signed: '🔒 កញ្ចប់នេះ Sign ក្នុង ZTO រួច — មិនអាចស្តារបានទេ។'
};

export const ztoReturnedEvidence = new Map();

export const ztoFinalFailedAt = new Map();

let ztoFinalRun: object | null = null;

function permissionRefused(e) {
    return /permission/i.test(String((e && (e.code || e.message)) || e));
}

export function barcodeVerdictSigned(barcode) {
    if (!barcode || !barcode.code) return false;
    loadZtoPickupStatusOnce();
    const verdict = ztoPickupStatus.get(pickupBarcodeKey(barcode.code));
    return !!verdict && verdict.closed === true;
}

export function barcodeSignedInZto(barcode) {
    return barcodeZtoSigned(barcode) || (!!barcode && barcode.isClosed === true && barcodeVerdictSigned(barcode));
}

export function itemReopenLockedByZto(item) {
    return !!item && item.isClosed === true && Array.isArray(item.barcodes) && item.barcodes.some((b) => barcodeSignedInZto(b));
}

export function explainZtoReopenLock(itemId?) {
    const item = dataState.scanHistory.find((i) => i.id === itemId);
    const open = item && Array.isArray(item.barcodes) && item.barcodes.some((b) => b && b.isClosed && !barcodeSignedInZto(b));
    showToast(ZTO_SIGNED_REOPEN_TEXT + (open ? ZTO_SIGNED_REOPEN_PART_TEXT : ''));
}

export function trashRestoreBlockOf(item, evidenceOnly?) {
    if (item && !evidenceOnly && getShopZtoTrashMode() === 'palm') return 'palm';
    const stamped = trashZtoFinalBlock(item);
    if (stamped && (stamped !== 'returned' || item.restoreBlocked === true)) return stamped;
    const barcodes = item && Array.isArray(item.barcodes) ? item.barcodes.filter(Boolean) : [];
    if (barcodes.some((b) => barcodeVerdictSigned(b))) return 'signed';
    if (trashItemLeftBranch(item)) return '';
    if (stamped) return stamped;
    if (!barcodes.length) return '';
    if (item.trashReason === 'returned' && barcodes.some((b) => {
        const evidence = ztoReturnedEvidence.get(pickupBarcodeKey(b.code));
        return !!evidence && evidence.kind === 'returned';
    })) return 'returned';
    return '';
}

export function barcodeZtoLeftKind(barcode) {
    if (!barcode) return '';
    const evidence = barcode.code ? ztoReturnedEvidence.get(pickupBarcodeKey(barcode.code)) : null;
    if (evidence && evidence.kind !== 'returned') return evidence.kind;
    if (barcodeZtoSentOut(barcode)) return 'sent';
    return barcodeZtoMisplaced(barcode) ? 'misplaced' : '';
}

export function barcodeMisplacedInZto(barcode) {
    return barcodeZtoLeftKind(barcode) === 'misplaced';
}

export function barcodeSentOutInZto(barcode) {
    return barcodeZtoLeftKind(barcode) === 'sent';
}

function trashReturnedEvery(item, test) {
    const barcodes = item && item.trashReason === 'returned' && Array.isArray(item.barcodes) ? item.barcodes.filter(Boolean) : [];
    return barcodes.length > 0 && barcodes.every(test);
}

export function trashItemMisplaced(item) {
    return trashReturnedEvery(item, barcodeMisplacedInZto);
}

export function trashItemSentOut(item) {
    return trashReturnedEvery(item, barcodeSentOutInZto);
}

export function trashItemLeftBranch(item) {
    return trashReturnedEvery(item, (b) => !!barcodeZtoLeftKind(b));
}

export function explainZtoRestoreBlock(reason) {
    showToast(ZTO_RESTORE_BLOCK_TEXT[reason] || ZTO_RESTORE_BLOCK_TEXT.signed);
}

export function pruneZtoReturnedEvidence() {
    const now = getServerNow();
    ztoReturnedEvidence.forEach((entry, key) => {
        const noted = typeof entry.noted === 'number' && isFinite(entry.noted) ? entry.noted : entry.at;
        if (!(now - noted <= ZTO_FINAL_RETURNED_TTL_MS)) ztoReturnedEvidence.delete(key);
    });
    while (ztoReturnedEvidence.size > ZTO_FINAL_RETURNED_MAX) {
        const oldest = ztoReturnedEvidence.keys().next();
        if (oldest.done) break;
        ztoReturnedEvidence.delete(oldest.value);
    }
}

export function noteZtoReturnedEvidence(code, at, kind = 'returned') {
    const key = pickupBarcodeKey(code);
    if (!key || typeof at !== 'number' || !isFinite(at) || at <= 0) return;
    ztoReturnedEvidence.delete(key);
    ztoReturnedEvidence.set(key, { at: at, noted: getServerNow(), kind: kind === 'misplaced' || kind === 'sent' || kind === 'left' ? kind : 'returned' });
    pruneZtoReturnedEvidence();
}

export function applyZtoFinalMarks(current, wanted, trash) {
    if (!current || typeof current !== 'object') return undefined;
    if (!trash && rowOperationActive(current)) return undefined;
    if (trash ? !!current.restoreClaim : (itemHasRestoreMarkers(current) || !!current.clearClaim)) return undefined;
    normalizeBarcodesOf(current);
    if (!Array.isArray(current.barcodes) || !current.barcodes.length) return undefined;
    let changed = false;
    current.barcodes.forEach((b) => {
        if (!b || typeof b !== 'object') return;
        const want = wanted[pickupBarcodeKey(b.code)];
        if (!want) return;
        if (want.signed && (trash || b.isClosed === true) && (!barcodeZtoSigned(b) || want.signedExact === true && b.ztoSignedExact !== true)
            && want.signed >= barcodeSignBasis(b, current)) {
            b.ztoSignedAt = want.signed;
            if (want.signedExact === true) b.ztoSignedExact = true;
            changed = true;
        }
        if (want.returned && trash && current.trashReason === 'returned' && !barcodeZtoReturned(b)
            && want.returned >= barcodeReturnBasis(b, current.createdAt)) {
            b.ztoReturnedAt = want.returned;
            changed = true;
        }
        if (want.misplaced && want.returned && trash && current.trashReason === 'returned' && !barcodeZtoMisplaced(b)
            && want.returned >= barcodeReturnBasis(b, current.createdAt)) {
            b.ztoMisplacedAt = want.returned;
            changed = true;
        }
        if (want.sentOut && trash && current.trashReason === 'returned' && !barcodeZtoSentOut(b)
            && want.sentOut >= barcodeReturnBasis(b, current.createdAt)) {
            b.ztoSentOutAt = want.sentOut;
            changed = true;
        }
    });
    if (trash && (current.trashMode === 'palm' || current.barcodes.some(barcodeZtoSigned)) && current.restoreBlocked !== true) {
        stampTrashPolicy(current, current.trashMode || 'local');
        changed = true;
    }
    return changed ? current : undefined;
}

export function collectZtoFinalTargets() {
    loadZtoPickupStatusOnce();
    pruneZtoReturnedEvidence();
    const signedAt = getServerNow();
    const out = [];
    const scan = (list, trash) => {
        (Array.isArray(list) ? list : []).forEach((item) => {
            if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || !Array.isArray(item.barcodes)) return;
            if (trash ? item.restoreClaim : (item.clearClaim || itemHasRestoreMarkers(item))) return;
            const path = (trash ? 'zoew_recently_deleted_cod_dod/' : 'zoew_scan_history_cod_dod/') + item.id;
            if (elapsedSince(ztoFinalFailedAt.get(path)) < ZTO_FINAL_FAIL_RETRY_MS) return;
            const wanted = {};
            let any = trash && item.restoreBlocked !== true && (item.trashMode === 'palm' || item.barcodes.some(barcodeZtoSigned));
            item.barcodes.forEach((b) => {
                const key = b && b.code ? pickupBarcodeKey(b.code) : '';
                if (!key) return;
                const want: { signed?: number; signedExact?: boolean; returned?: number; misplaced?: boolean; sentOut?: number } = {};
                const verdict = ztoPickupStatus.get(key);
                const needsSignTime = !barcodeZtoSigned(b) || verdict?.signedAtExact === true && b.ztoSignedExact !== true;
                if ((trash || b.isClosed === true) && needsSignTime && barcodeVerdictSigned(b)) {
                    const actual = verdict?.signedAt;
                    want.signed = Number.isFinite(actual) && actual > 0 && actual <= signedAt ? actual : signedAt;
                    if (verdict?.signedAtExact === true && want.signed === actual) want.signedExact = true;
                }
                const evidence = trash && item.trashReason === 'returned' ? ztoReturnedEvidence.get(key) : null;
                if (evidence && evidence.kind === 'sent') {
                    if (!barcodeZtoSentOut(b)) want.sentOut = evidence.at;
                } else if (evidence && evidence.kind !== 'left') {
                    const stampMisplaced = evidence.kind === 'misplaced' && !barcodeZtoMisplaced(b);
                    if (!barcodeZtoReturned(b) || stampMisplaced) {
                        want.returned = evidence.at;
                        if (stampMisplaced) want.misplaced = true;
                    }
                }
                if (!want.signed && !want.returned && !want.sentOut) return;
                wanted[key] = want;
                any = true;
            });
            if (any) out.push({ path: path, wanted: wanted, trash: trash });
        });
    };
    scan(dataState.scanHistory, false);
    scan(dataState.deletedItems, true);
    return out;
}

export async function syncZtoFinalMarks() {
    const api = firebaseState.fb;
    const targetDb = firebaseState.db;
    if (!api || !targetDb || typeof api.runTransaction !== 'function' || typeof api.ref !== 'function') return 0;
    if (ztoState.ztoFinalInFlight || shopScopePending()) return 0;
    if (ztoState.ztoFinalRefusedDb === targetDb && elapsedSince(ztoState.ztoFinalRefusedAt) < ZTO_FINAL_REFUSED_RETRY_MS) return 0;
    const targets = collectZtoFinalTargets().slice(0, ZTO_FINAL_SWEEP_BATCH);
    if (!targets.length) return 0;
    const session = captureZtoSession();
    const owner = {};
    ztoFinalRun = owner;
    const current = () => ztoFinalRun === owner && session.current();
    ztoState.ztoFinalInFlight = true;
    let written = 0;
    let refused = 0;
    let tried = 0;
    try {
        for (const target of targets) {
            if (!current()) return written;
            tried++;
            let result = null;
            const write = (wish) => dbOp(api.runTransaction(api.ref(targetDb, target.path),
                (snapshotItem) => current() ? applyZtoFinalMarks(snapshotItem, wish, target.trash) : undefined), 'ZTO final mark write stalled');
            try {
                result = await write(target.wanted);
            } catch (e) {
                if (!current()) return written;
                ztoFinalFailedAt.set(target.path, Date.now());
                if (dbOpStalled(e)) return written;
                if (permissionRefused(e)) refused++;
                continue;
            }
            if (!current()) return written;
            if (result && result.committed) written++;
            else ztoFinalFailedAt.set(target.path, Date.now());
        }
        if (!written && refused && refused === tried) {
            ztoState.ztoFinalRefusedDb = targetDb;
            ztoState.ztoFinalRefusedAt = Date.now();
        }
        return written;
    } finally {
        if (ztoFinalRun === owner) {
            ztoFinalRun = null;
            ztoState.ztoFinalInFlight = false;
        }
    }
}

export function scheduleZtoFinalMarks() {
    if (ztoState.ztoFinalTimer) return;
    ztoState.ztoFinalTimer = setTimeout(() => {
        ztoState.ztoFinalTimer = null;
        syncZtoFinalMarks().catch(() => 0);
    }, ZTO_FINAL_SCHEDULE_MS);
}

export function resetZtoFinalMarks() {
    ztoFinalRun = null;
    ztoState.ztoFinalInFlight = false;
    clearTimeout(ztoState.ztoFinalTimer);
    ztoState.ztoFinalTimer = null;
    ztoState.ztoFinalRefusedDb = null;
    ztoState.ztoFinalRefusedAt = 0;
    ztoReturnedEvidence.clear();
    ztoFinalFailedAt.clear();
}
