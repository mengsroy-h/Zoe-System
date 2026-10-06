import { getServerNow } from '../core/clock';
import { DB_LISTENER_KEY_DELETED } from '../core/text';
import { clearStaleRestoreMarkers } from './cleanup';
import { ABANDON_AGE_MS, TWO_HOURS_MS } from '../features/session';
import { dbListenerViewIsStale } from '../services/db-listeners';

export function parseTimestampFromId(idStr) {
    if (!idStr) return null;
    let parts = idStr.split('_');
    if (parts.length >= 2 && !isNaN(parts[1])) {
        return Number(parts[1]);
    }
    return null;
}

export function generateUniqueId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export function barcodeEntriesOf(value) {
    if (Array.isArray(value)) {
        const out = [];
        value.forEach((b, i) => { if (b !== null && b !== undefined) out.push({ barcode: b, index: i }); });
        return out;
    }
    if (value && typeof value === 'object') {
        return Object.keys(value)
            .filter((k) => /^\d+$/.test(k))
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => ({ barcode: value[k], index: Number(k) }))
            .filter((e) => e.barcode !== null && e.barcode !== undefined);
    }
    return [];
}

export function normalizeBarcodesOf(item) {
    if (!item || typeof item !== 'object') return item;
    if (item.barcodes === null || item.barcodes === undefined) return item;
    const list = barcodeEntriesOf(item.barcodes)
        .filter((e) => e.barcode && typeof e.barcode === 'object')
        .map((e) => ({ ...e.barcode }));
    if (!list.length && !Array.isArray(item.barcodes)) {
        delete item.barcodes;
        return item;
    }
    item.barcodes = list;
    return item;
}

export function ensureBarcodeArrayForItem(item) {
    if (!item || typeof item !== 'object') return [];
    normalizeBarcodesOf(item);
    if (!Array.isArray(item.barcodes) && item.barcode) {
        const cod = parseFloat(item.cod !== undefined ? item.cod : item.price) || 0;
        const dod = parseFloat(item.dod) || 0;
        item.barcodes = [{
            code: item.barcode,
            time: item.time,
            cod: cod,
            dod: dod,
            locker: item.locker || "N/A",
            isClosed: item.isClosed || false,
            isDeducted: false,
            isFromDeletion: false,
            createdAt: item.createdAt || getServerNow()
        }];
    }
    return Array.isArray(item.barcodes) ? item.barcodes : [];
}

export function stripHistoryOnlyMarkers(item) {
    if (!item || typeof item !== 'object') return item;
    delete item.clearClaim;
    delete item.restoreClaim;
    delete item.restoreClaimId;
    delete item.restoreClaimToken;
    return item;
}

export function itemHasRestoreMarkers(item) {
    return !!(item && (item.restoreClaimId !== undefined || item.restoreClaimToken !== undefined));
}

export function dropStaleRestoreMarkers(currentItem) {
    if (!itemHasRestoreMarkers(currentItem)) return false;
    if (dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return false;
    clearStaleRestoreMarkers(currentItem);
    return false;
}

export function applyBarcodeCloseState(barcode, closed, at?) {
    if (!barcode || typeof barcode !== 'object') return barcode;
    barcode.isClosed = !!closed;
    if (closed) barcode.closedAt = at;
    else delete barcode.closedAt;
    return barcode;
}

export function barcodeCloseIsRipe(barcode, now) {
    return !!(barcode && barcode.isClosed && typeof barcode.closedAt === 'number' && (now - barcode.closedAt) > TWO_HOURS_MS);
}

export function barcodeAbandonBasis(barcode, parentCreatedAt) {
    const restoredAt = barcode && typeof barcode.restoredAt === 'number' && isFinite(barcode.restoredAt) && barcode.restoredAt >= 0 ? barcode.restoredAt : 0;
    return Math.max(parentCreatedAt, restoredAt);
}

export function barcodeAbandonIsRipe(barcode, parentCreatedAt, now) {
    if (!barcode || barcode.isClosed) return false;
    return now - barcodeAbandonBasis(barcode, parentCreatedAt) > ABANDON_AGE_MS;
}

export function itemAbandonRipeAt(item, parentCreatedAt, now) {
    const barcodes = item && Array.isArray(item.barcodes) ? item.barcodes : [];
    let latest = 0;
    for (let i = 0; i < barcodes.length; i++) {
        if (barcodeAbandonIsRipe(barcodes[i], parentCreatedAt, now)) latest = Math.max(latest, barcodeAbandonBasis(barcodes[i], parentCreatedAt) + ABANDON_AGE_MS);
    }
    return latest || parentCreatedAt + ABANDON_AGE_MS;
}

export function normalizeBarcodeCloseStamps(item, now) {
    if (!item || !Array.isArray(item.barcodes)) return false;
    let changed = false;
    item.barcodes.forEach((b) => {
        if (!b || typeof b !== 'object') return;
        if (b.isClosed) {
            if (typeof b.closedAt !== 'number') {
                b.closedAt = (typeof item.closedAt === 'number') ? item.closedAt : now;
                changed = true;
            }
        } else if (b.closedAt !== undefined) {
            delete b.closedAt;
            changed = true;
        }
    });
    return changed;
}

export function sanitizeInput(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
