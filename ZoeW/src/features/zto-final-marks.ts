import { dataState, firebaseState, ztoState } from '../core/state';
import { getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { shopScopePending } from '../core/shop-scope';
import { ZTO_SIGNED_REOPEN_TEXT } from '../core/text';
import { barcodeZtoMisplaced, barcodeZtoReturned, barcodeZtoSentOut, barcodeZtoSigned, itemHasRestoreMarkers, normalizeBarcodesOf, trashZtoFinalBlock } from '../domain/barcode';
import { pickupBarcodeKey } from '../domain/pickup';
import { dbOp, dbOpStalled } from '../services/network';
import { showToast } from '../ui/toast';
import { loadZtoPickupStatusOnce, ztoPickupStatus } from './zto-status';

export const ZTO_FINAL_SCHEDULE_MS = 2000;

export const ZTO_FINAL_SWEEP_BATCH = 20;

export const ZTO_FINAL_FAIL_RETRY_MS = 5 * 60 * 1000;

export const ZTO_FINAL_REFUSED_RETRY_MS = 30 * 60 * 1000;

export const ZTO_FINAL_RETURNED_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export const ZTO_FINAL_RETURNED_MAX = 2000;

export const ZTO_SIGNED_REOPEN_PART_TEXT = ' បើក barcode ដែលមិនទាន់ Sign តាម «កញ្ចប់សរុប»។';

export const ZTO_RESTORE_BLOCK_TEXT = {
    returned: '🔒 កញ្ចប់នេះ ZTO ស្កេនត្រឡប់រួច ហើយត្រូវត្រឡប់ទៅសាខាកណ្តាល — មិនអាចស្តារបានទេ។',
    signed: '🔒 កញ្ចប់នេះ Sign ក្នុង ZTO រួច — មិនអាចស្តារបានទេ។'
};

export const ztoReturnedEvidence = new Map();

export const ztoFinalFailedAt = new Map();

export const ztoMisplacedRefused: { db: unknown; at: number } = { db: null, at: 0 };

export const ztoSentOutRefused: { db: unknown; at: number } = { db: null, at: 0 };

const ZTO_LABEL_STAMPS = [
    { want: 'sentOut', refused: ztoSentOutRefused },
    { want: 'misplaced', refused: ztoMisplacedRefused }
];

function labelStampRefused(refused, db) {
    return !!db && refused.db === db && elapsedSince(refused.at) < ZTO_FINAL_REFUSED_RETRY_MS;
}

function withoutLabelStamp(wanted, field) {
    const out = {};
    let any = false;
    Object.keys(wanted).forEach((key) => {
        const want = { ...wanted[key] };
        delete want[field];
        if (!want.signed && !want.returned && !want.sentOut) return;
        out[key] = want;
        any = true;
    });
    return any ? out : null;
}

function wantsLabelStamp(wanted, field) {
    return Object.keys(wanted).some((key) => !!wanted[key][field]);
}

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

export function trashRestoreBlockOf(item) {
    if (trashItemLeftBranch(item)) return '';
    const stamped = trashZtoFinalBlock(item);
    if (stamped) return stamped;
    const barcodes = item && Array.isArray(item.barcodes) ? item.barcodes.filter(Boolean) : [];
    if (!barcodes.length) return '';
    if (item.trashReason === 'pickup' && barcodes.every((b) => barcodeSignedInZto(b))) return 'signed';
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
        if (!(now - entry.at <= ZTO_FINAL_RETURNED_TTL_MS)) ztoReturnedEvidence.delete(key);
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
    ztoReturnedEvidence.set(key, { at: at, kind: kind === 'misplaced' || kind === 'sent' || kind === 'left' ? kind : 'returned' });
    pruneZtoReturnedEvidence();
}

export function applyZtoFinalMarks(current, wanted, trash) {
    if (!current || typeof current !== 'object') return undefined;
    if (trash ? !!current.restoreClaim : (itemHasRestoreMarkers(current) || !!current.clearClaim)) return undefined;
    normalizeBarcodesOf(current);
    if (!Array.isArray(current.barcodes) || !current.barcodes.length) return undefined;
    let changed = false;
    current.barcodes.forEach((b) => {
        if (!b || typeof b !== 'object') return;
        const want = wanted[pickupBarcodeKey(b.code)];
        if (!want) return;
        if (want.signed && b.isClosed === true && !barcodeZtoSigned(b)) {
            b.ztoSignedAt = want.signed;
            changed = true;
        }
        if (want.returned && trash && current.trashReason === 'returned' && !barcodeZtoReturned(b)) {
            b.ztoReturnedAt = want.returned;
            changed = true;
        }
        if (want.misplaced && want.returned && trash && current.trashReason === 'returned' && !barcodeZtoMisplaced(b)) {
            b.ztoMisplacedAt = want.returned;
            changed = true;
        }
        if (want.sentOut && trash && current.trashReason === 'returned' && !barcodeZtoSentOut(b)) {
            b.ztoSentOutAt = want.sentOut;
            changed = true;
        }
    });
    return changed ? current : undefined;
}

export function collectZtoFinalTargets() {
    loadZtoPickupStatusOnce();
    pruneZtoReturnedEvidence();
    if (!ztoPickupStatus.size && !ztoReturnedEvidence.size) return [];
    const signedAt = getServerNow();
    const misplacedOff = labelStampRefused(ztoMisplacedRefused, firebaseState.db);
    const sentOff = labelStampRefused(ztoSentOutRefused, firebaseState.db);
    const out = [];
    const scan = (list, trash) => {
        (Array.isArray(list) ? list : []).forEach((item) => {
            if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || !Array.isArray(item.barcodes)) return;
            if (trash ? item.restoreClaim : (item.clearClaim || itemHasRestoreMarkers(item))) return;
            const path = (trash ? 'zoew_recently_deleted_cod_dod/' : 'zoew_scan_history_cod_dod/') + item.id;
            if (elapsedSince(ztoFinalFailedAt.get(path)) < ZTO_FINAL_FAIL_RETRY_MS) return;
            const wanted = {};
            let any = false;
            item.barcodes.forEach((b) => {
                const key = b && b.code ? pickupBarcodeKey(b.code) : '';
                if (!key) return;
                const want: { signed?: number; returned?: number; misplaced?: boolean; sentOut?: number } = {};
                if (b.isClosed === true && !barcodeZtoSigned(b) && barcodeVerdictSigned(b)) want.signed = signedAt;
                const evidence = trash && item.trashReason === 'returned' ? ztoReturnedEvidence.get(key) : null;
                if (evidence && evidence.kind === 'sent') {
                    if (!sentOff && !barcodeZtoSentOut(b)) want.sentOut = evidence.at;
                } else if (evidence && evidence.kind !== 'left') {
                    const stampMisplaced = evidence.kind === 'misplaced' && !misplacedOff && !barcodeZtoMisplaced(b);
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
    const sessionAtStart = firebaseState.authGeneration;
    const current = () => firebaseState.db === targetDb && firebaseState.authGeneration === sessionAtStart;
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
                (snapshotItem) => applyZtoFinalMarks(snapshotItem, wish, target.trash)), 'ZTO final mark write stalled');
            let wanted = target.wanted;
            try {
                while (wanted) {
                    try {
                        result = await write(wanted);
                        break;
                    } catch (e) {
                        const stamp = permissionRefused(e) ? ZTO_LABEL_STAMPS.find((s) => wantsLabelStamp(wanted, s.want)) : null;
                        if (!stamp || !current()) throw e;
                        stamp.refused.db = targetDb;
                        stamp.refused.at = Date.now();
                        wanted = withoutLabelStamp(wanted, stamp.want);
                    }
                }
            } catch (e) {
                if (!current()) return written;
                ztoFinalFailedAt.set(target.path, Date.now());
                if (dbOpStalled(e)) return written;
                if (permissionRefused(e)) refused++;
                continue;
            }
            if (!current()) return written;
            if (!wanted) tried--;
            if (result && result.committed) written++;
            else ztoFinalFailedAt.set(target.path, Date.now());
        }
        if (!written && refused && refused === tried) {
            ztoState.ztoFinalRefusedDb = targetDb;
            ztoState.ztoFinalRefusedAt = Date.now();
        }
        return written;
    } finally {
        ztoState.ztoFinalInFlight = false;
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
    clearTimeout(ztoState.ztoFinalTimer);
    ztoState.ztoFinalTimer = null;
    ztoState.ztoFinalRefusedDb = null;
    ztoState.ztoFinalRefusedAt = 0;
    ztoReturnedEvidence.clear();
    ztoFinalFailedAt.clear();
    ztoMisplacedRefused.db = null;
    ztoMisplacedRefused.at = 0;
    ztoSentOutRefused.db = null;
    ztoSentOutRefused.at = 0;
}
