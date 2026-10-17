import { dataState, firebaseState } from '../core/state';
import { cleanupClockIsTrustworthy } from '../core/clock';
import { shopScopePending } from '../core/shop-scope';
import { ztoScanStampMillis } from '../core/timezone';
import { itemHasRestoreMarkers } from '../domain/barcode';
import { claimAndCleanupItem } from '../domain/cleanup';
import { pickupBarcodeKey } from '../domain/pickup';
import { ztoAutoCloseEnabled, ztoStatusFeatureConfig } from './zto-status';

export function ztoReturnedTargets(returned, dataToScan = dataState.scanHistory, signedCodes?) {
    const signed = new Set((Array.isArray(signedCodes) ? signedCodes : []).map((code) => pickupBarcodeKey(code)));
    const backAt = new Map();
    const list = Array.isArray(returned) ? returned : [];
    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        const key = entry && typeof entry.barcode === 'string' ? pickupBarcodeKey(entry.barcode) : '';
        const at = entry && typeof entry.at === 'string' ? ztoScanStampMillis(entry.at) : 0;
        if (!key || !at || signed.has(key)) continue;
        if (!backAt.has(key) || at > backAt.get(key)) backAt.set(key, at);
    }
    const out = [];
    if (!backAt.size || !Array.isArray(dataToScan)) return out;
    for (let i = 0; i < dataToScan.length; i++) {
        const item = dataToScan[i];
        if (!item || !item.id || item.clearClaim || itemHasRestoreMarkers(item) || !Array.isArray(item.barcodes)) continue;
        const codes = [];
        for (let j = 0; j < item.barcodes.length; j++) {
            const b = item.barcodes[j];
            if (!b || b.isClosed) continue;
            const at = backAt.get(pickupBarcodeKey(b.code));
            if (!at) continue;
            const since = Math.max(Number(b.createdAt) || Number(item.createdAt) || 0, Number(b.restoredAt) || 0);
            if (at >= since) codes.push(b.code);
        }
        if (codes.length) out.push({ itemId: String(item.id), codes });
    }
    return out;
}

export function removeReturnedZtoBarcodes(returned, dataToScan = dataState.scanHistory, signedCodes?) {
    if (!firebaseState.db || !ztoStatusFeatureConfig() || !ztoAutoCloseEnabled()) return 0;
    if (!cleanupClockIsTrustworthy() || shopScopePending()) return 0;
    const targets = ztoReturnedTargets(returned, dataToScan, signedCodes);
    let queued = 0;
    for (let i = 0; i < targets.length; i++) {
        claimAndCleanupItem(targets[i].itemId, 'abandon', { codes: targets[i].codes });
        queued += targets[i].codes.length;
    }
    return queued;
}
