import { dataState, firebaseState, scanState } from '../core/state';
import { REGISTRY_RELEASE_QUEUE_MAX, REGISTRY_RELEASE_RETRY_MAX, pendingRegistryReleases } from '../core/clock';
import { DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY } from '../core/text';
import { triggerScanAction } from '../features/scan-action';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { dbOp, retryAsync } from '../services/network';
import { decodeBarcodeFromCanvasManual } from '../services/scan-engine';
import { showToast } from '../ui/toast';

export function decodeBarcodeFromImageDataUrl(originalDataUrl) {
    if (!scanState.codeReader) return;
    const img = new Image();
    img.onload = async function () {
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const baseW = Math.round(img.naturalWidth * scale);
        const baseH = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        for (const deg of [0, 90, 270, 180]) {
            try {
                const swap = deg === 90 || deg === 270;
                canvas.width = swap ? baseH : baseW;
                canvas.height = swap ? baseW : baseH;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(deg * Math.PI / 180);
                ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                const text = await decodeBarcodeFromCanvasManual(scanState.codeReader, canvas);
                if (text) {
                    triggerScanAction(text);
                    return;
                }
            } catch (err) {
            }
        }
        showToast("⚠️ រកមិនឃើញ Barcode ក្នុងរូបភាពនេះទេ។ សូមសាកល្បងថតរូបឲ្យច្បាស់ ត្រង់ៗ និងជិត Barcode ជាងនេះ ឬប្រើកាមេរ៉ាស្កេនផ្ទាល់។");
    };
    img.onerror = function () {
        showToast("⚠️ រកមិនឃើញ Barcode ក្នុងរូបភាពនេះទេ។");
    };
    img.src = originalDataUrl;
}

export function isBarcodeAlreadyUsed(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return false;
    const matchesCode = (item) => {
        if (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.some(b => String(b.code || '').trim().toUpperCase() === normalized)) return true;
        return !!(item.barcode && String(item.barcode).trim().toUpperCase() === normalized);
    };
    return dataState.scanHistory.some(matchesCode) || dataState.deletedItems.some(matchesCode);
}

export function barcodeRegistryKey(code) {
    const normalized = String(code || '').trim().toUpperCase();
    return normalized.replace(/[.#$\[\]\/\x00-\x1F\x7F]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
}

export async function claimBarcodeInRegistry(code) {
    const key = barcodeRegistryKey(code);
    if (!firebaseState.db || !firebaseState.fb || !key) return 'unknown';
    try {
        const result = await firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_barcode_registry/${key}`), (current) => {
            if (current === null) return true;
            return;
        });
        return result.committed ? 'claimed' : 'taken';
    } catch (e) {
        return 'unknown';
    }
}

export function collectItemBarcodes(item) {
    if (!item) return [];
    if (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.length) {
        return item.barcodes.map(b => b && b.code).filter(Boolean);
    }
    return item.barcode ? [item.barcode] : [];
}

export function queueRegistryReleaseRetry(keys, attempts) {
    keys.forEach((key) => {
        const existing = pendingRegistryReleases.get(key);
        const nextAttempts = Math.max(attempts, existing ? existing.attempts : 0);
        if (nextAttempts >= REGISTRY_RELEASE_RETRY_MAX) return;
        if (!existing && pendingRegistryReleases.size >= REGISTRY_RELEASE_QUEUE_MAX) return;
        pendingRegistryReleases.set(key, { attempts: nextAttempts });
    });
}

export function releaseRegistryKeys(keys) {
    if (!firebaseState.db || !firebaseState.fb || !keys.length) return Promise.resolve(true);
    const updates = {};
    keys.forEach((key) => { updates[key] = null; });
    return dbOp(firebaseState.fb.update(firebaseState.fb.ref(firebaseState.db, 'zoew_barcode_registry'), updates)).then(() => true, () => false);
}

export function releaseLateBarcodeClaim(claimPromise, code) {
    if (!claimPromise || typeof claimPromise.then !== 'function') return false;
    claimPromise.then((lateClaim) => {
        if (lateClaim === 'claimed') releaseBarcodesInRegistry([code]);
    }, () => {});
    return true;
}

export function releaseBarcodesInRegistry(codes) {
    if (!firebaseState.db || !firebaseState.fb || !codes || !codes.length) return Promise.resolve();
    const keys = [];
    codes.forEach((code) => {
        const key = barcodeRegistryKey(code);
        if (key && keys.indexOf(key) === -1) keys.push(key);
    });
    if (!keys.length) return Promise.resolve();
    return retryAsync(() => releaseRegistryKeys(keys).then((done) => {
        if (!done) throw new Error('REGISTRY_RELEASE_FAILED');
        return true;
    }), 3, 1200).then(() => {
        keys.forEach((key) => pendingRegistryReleases.delete(key));
    }, () => {
        queueRegistryReleaseRetry(keys, 1);
    });
}

export function registryKeyIsOwned(key) {
    const owns = (item) => collectItemBarcodes(item).some((code) => barcodeRegistryKey(code) === key);
    return dataState.scanHistory.some(owns) || dataState.deletedItems.some(owns);
}

export function registryReleaseVerdict(key) {
    if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return 'defer';
    return registryKeyIsOwned(key) ? 'owned' : 'release';
}

export function flushPendingRegistryReleases() {
    if (dataState.registryReleaseFlushInFlight) return;
    if (!pendingRegistryReleases.size) return;
    if (!firebaseState.db || !firebaseState.fb) return;
    const entries = Array.from(pendingRegistryReleases.entries());
    pendingRegistryReleases.clear();
    const releasable = [];
    entries.forEach((pair) => {
        const verdict = registryReleaseVerdict(pair[0]);
        if (verdict === 'release') releasable.push(pair);
        else if (verdict === 'defer') pendingRegistryReleases.set(pair[0], { attempts: pair[1].attempts });
    });
    if (!releasable.length) return;
    dataState.registryReleaseFlushInFlight = true;
    const keys = releasable.map((pair) => pair[0]);
    const releaseFlushDone = () => { dataState.registryReleaseFlushInFlight = false; };
    releaseRegistryKeys(keys).then((done) => {
        if (!done) releasable.forEach((pair) => queueRegistryReleaseRetry([pair[0]], pair[1].attempts + 1));
    }, () => {
        releasable.forEach((pair) => queueRegistryReleaseRetry([pair[0]], pair[1].attempts + 1));
    }).then(releaseFlushDone, releaseFlushDone);
}
