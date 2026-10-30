import { dataState, firebaseState } from '../core/state';
import { appLocalStore } from '../core/storage';
import { liveShopScope } from '../core/shop-scope';
import { getFormattedClockTime } from '../core/timezone';
import { applyBarcodeCloseState, barcodeEntriesOf, generateUniqueId, itemHasRestoreMarkers, normalizeBarcodesOf } from '../domain/barcode';
import { ledgerLatestMonths, ledgerOpRing, ledgerTokenSeen } from '../domain/ledger';
import { barcodeRegistryKey } from '../domain/registry';
import { SCAN_LEDGER_MAX_MONEY, SCAN_OPERATIONS_ROOT, SCAN_PENDING_ROOT, scanLedgerIncrementSafe, scanOperationSame, scanOperationValid, scanPendingMatches, scanStoredMoney,
    scanRegistryOwned, scanRegistryOwner, type ScanOperation } from '../domain/scan-protocol';
import { readRestoreServerNode } from '../features/restore';
import { recalcItemMoneyFromBarcodes } from '../ui/modal-stack';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { showToast } from '../ui/toast';
import { createScanEvidenceJournal } from './scan-evidence';
import { finishPendingScan, notePendingScan, pendingScanIsCurrent, pendingScanIsLive, pendingScanScope, releasePendingScan, warnPendingScans, type PendingScanHandle } from './scan-pending';
import { rowOperationActive } from './row-operation-lock';

const activeScans = new Map<string, PendingScanHandle>();
let recoveryOwner: any = null;

function operationOf(handle: PendingScanHandle): ScanOperation | null {
    const record = handle?.record;
    if (record?.v !== 2 || !pendingScanIsCurrent(handle)) return null;
    const actorUid = firebaseState.auth?.currentUser?.uid;
    const operation: ScanOperation = {
        v: 2, id: record.id, actorUid, scope: liveShopScope(), code: record.barcode, registryKey: barcodeRegistryKey(record.barcode),
        birth: record.createdAt, scanDate: record.scanDate, month: record.scanDate?.slice(0, 7), cod: record.cod, dod: record.dod,
        count: 1, monthToken: 'op_m' + record.id.slice(5), phase: 'admitted'
    } as ScanOperation;
    return scanOperationValid(operation) ? operation : null;
}

function operationCurrent(handle: PendingScanHandle, operation: ScanOperation) {
    return pendingScanIsCurrent(handle) && operation.actorUid === firebaseState.auth?.currentUser?.uid && operation.scope === liveShopScope();
}

async function readOperationNode(handle: PendingScanHandle, operation: ScanOperation, path: string) {
    if (!operationCurrent(handle, operation)) throw new Error('Scan operation owner changed');
    const value = await readRestoreServerNode(handle.sdk, handle.db, path);
    if (!operationCurrent(handle, operation)) throw new Error('Scan operation owner changed');
    return value;
}

function scanHeld(handle: PendingScanHandle) {
    try { notePendingScan(handle, 'hold'); } catch (e) {}
    return false;
}

function finishCancelledScan(handle: PendingScanHandle) {
    const done = finishPendingScan(handle, 'compensated-and-release-confirmed');
    if (done) showToast(`⚠️ (${handle.record.barcode}) មិនបានរក្សាទុក។ បានផ្ទៀងថាមិនបូកប្រាក់ និងចំនួនកញ្ចប់ — អាចពិនិត្យហើយសាកម្ដងទៀត។`);
    return done;
}

function validLedgerBucket(value) {
    return !!value && typeof value === 'object' && ['codDollar', 'dodDollar'].every(key => scanStoredMoney(value[key]) && value[key] <= SCAN_LEDGER_MAX_MONEY)
        && Number.isSafeInteger(value.totalCount) && value.totalCount >= 0 && value.totalCount < 9007199254740990;
}

async function admittedOperation(handle: PendingScanHandle, operation: ScanOperation) {
    const path = SCAN_OPERATIONS_ROOT + '/' + operation.id;
    let saved = await readOperationNode(handle, operation, path);
    if (saved === null) {
        const updates = { [path]: operation, [SCAN_PENDING_ROOT + '/' + operation.id]: operation.actorUid };
        try { await handle.sdk.update(handle.sdk.ref(handle.db), updates); } catch (e) {}
        saved = await readOperationNode(handle, operation, path);
    }
    return scanOperationSame(saved, operation, false) ? saved as ScanOperation : null;
}

export async function claimScanOperation(handle: PendingScanHandle, code: string) {
    const original = operationOf(handle);
    if (!original || original.code !== code) return 'unknown';
    activeScans.set(original.id, handle);
    try {
        const operation = await admittedOperation(handle, original);
        if (!operation || operation.phase === 'cancelled') return 'unknown';
        if (operation.phase === 'committed') return 'claimed';
        const ref = handle.sdk.ref(handle.db, 'zoew_barcode_registry/' + operation.registryKey);
        const updater: any = (value) => {
            if (!operationCurrent(handle, operation)) return;
            return value === null || scanRegistryOwned(value, operation) ? scanRegistryOwner(operation) : undefined;
        };
        updater.txOutcomeWitness = (value) => scanRegistryOwned(value, operation) ? 'applied' : null;
        const result = await handle.sdk.runTransaction(ref, updater, { applyLocally: false });
        if (!operationCurrent(handle, operation)) return 'unknown';
        const stored = await readOperationNode(handle, operation, 'zoew_barcode_registry/' + operation.registryKey);
        if (scanRegistryOwned(stored, operation)) return 'claimed';
        if (result?.committed === false && stored !== null) {
            await cancelScanOperation(handle);
            return 'taken';
        }
        return 'unknown';
    } catch (e) {
        return 'unknown';
    } finally {
        if (activeScans.get(original.id) === handle) activeScans.delete(original.id);
    }
}

export async function cancelScanOperation(handle: PendingScanHandle) {
    const original = operationOf(handle);
    if (!original) return false;
    try {
        const operation = await readOperationNode(handle, original, SCAN_OPERATIONS_ROOT + '/' + original.id);
        if (!scanOperationSame(operation, original, false)) return scanHeld(handle);
        if (operation.phase === 'committed') return finishPendingScan(handle, 'saved-and-ledger-confirmed');
        if (operation.phase === 'cancelled') return finishCancelledScan(handle);
        if (operation.targetId) {
            const row = await readOperationNode(handle, operation, 'zoew_scan_history_cod_dod/' + operation.targetId);
            if (row?.scanPending?.intent === operation.id) return scanHeld(handle);
        }
        const registryPath = 'zoew_barcode_registry/' + operation.registryKey;
        const registry = await readOperationNode(handle, operation, registryPath);
        const updates: any = {
            [SCAN_OPERATIONS_ROOT + '/' + operation.id]: { ...operation, phase: 'cancelled' },
            [SCAN_PENDING_ROOT + '/' + operation.id]: null
        };
        if (scanRegistryOwned(registry, operation)) updates[registryPath] = null;
        try { await handle.sdk.update(handle.sdk.ref(handle.db), updates); } catch (e) {}
        const saved = await readOperationNode(handle, operation, SCAN_OPERATIONS_ROOT + '/' + operation.id);
        if (!scanOperationSame(saved, operation) || saved.phase !== 'cancelled') return scanHeld(handle);
        return finishCancelledScan(handle);
    } catch (e) {
        return scanHeld(handle);
    }
}

async function prepareScanMonth(handle: PendingScanHandle, operation: ScanOperation) {
    const update: any = (current) => {
        if (!operationCurrent(handle, operation)) return;
        const months = current && typeof current === 'object' ? { ...current } : {};
        const prior = months[operation.month];
        if (prior !== undefined && prior !== null && !validLedgerBucket(prior)) return;
        months[operation.month] = prior || { codDollar: 0, dodDollar: 0, totalCount: 0 };
        const kept = ledgerLatestMonths(months);
        if (!Object.prototype.hasOwnProperty.call(kept, operation.month)) return;
        if (ledgerTokenSeen(kept[operation.month], operation.monthToken)) return current;
        kept[operation.month] = { ...kept[operation.month], op: operation.monthToken, ops: ledgerOpRing(kept[operation.month], operation.monthToken) };
        return kept;
    };
    update.txOutcomeWitness = (value) => ledgerTokenSeen(value?.[operation.month], operation.monthToken) ? 'applied' : null;
    await handle.sdk.runTransaction(handle.sdk.ref(handle.db, 'zoew_monthly_revenue_cod_dod'), update, { applyLocally: false });
    const bucket = await readOperationNode(handle, operation, 'zoew_monthly_revenue_cod_dod/' + operation.month);
    return validLedgerBucket(bucket) && ledgerTokenSeen(bucket, operation.monthToken);
}

function stagedScanRow(current, operation: ScanOperation, phone, locker, closedAt) {
    if (current && (rowOperationActive(current) || current.clearClaim || itemHasRestoreMarkers(current)
        || barcodeEntriesOf(current.barcodes).some(({ barcode }) => barcode?.trashClaim || barcode?.trashClaimAt))) return null;
    if (current && (current.scanDate !== operation.scanDate || current.phone !== phone || (current.isClosed === true) !== (closedAt > 0))) return null;
    const time = getFormattedClockTime(operation.birth) + ' (' + operation.scanDate + ')';
    const row = current ? JSON.parse(JSON.stringify(current)) : { id: operation.targetId, createdAt: operation.birth, phone, barcodes: [] };
    normalizeBarcodesOf(row);
    if (!Array.isArray(row.barcodes) || row.barcodes.some(barcode => barcode?.code === operation.code)) return null;
    const slot = String(row.barcodes.length);
    row.barcodes.push(applyBarcodeCloseState({ code: operation.code, scanIntent: operation.id, time, cod: operation.cod, dod: operation.dod, locker,
        isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: operation.birth }, closedAt > 0, closedAt));
    row.id = operation.targetId; row.count = row.barcodes.length; row.barcode = operation.code; row.time = time;
    row.scanDate = operation.scanDate; row.isCalled = false;
    row.isClosed = row.barcodes.every(barcode => barcode?.isClosed === true);
    if (row.isClosed) row.closedAt = row.barcodes.reduce((stamp, barcode) => Math.max(stamp, Number(barcode?.closedAt) || 0), 0);
    else delete row.closedAt;
    recalcItemMoneyFromBarcodes(row);
    row.scanPending = { intent: operation.id, actorUid: operation.actorUid, code: operation.code, birth: operation.birth, slot,
        payloadHash: operation.payloadHash };
    return row;
}

export async function finalizeScanOperation(handle: PendingScanHandle, operation: ScanOperation) {
    if (!scanOperationValid(operation) || operation.phase !== 'prepared' || !operation.targetId) return scanHeld(handle);
    try {
        const saved = await readOperationNode(handle, operation, SCAN_OPERATIONS_ROOT + '/' + operation.id);
        if (!scanOperationSame(saved, operation)) return scanHeld(handle);
        if (saved.phase === 'committed') return finishPendingScan(handle, 'saved-and-ledger-confirmed');
        if (saved.phase !== 'prepared') return scanHeld(handle);
        const [row, registry, month, daily] = await Promise.all([
            readOperationNode(handle, operation, 'zoew_scan_history_cod_dod/' + operation.targetId),
            readOperationNode(handle, operation, 'zoew_barcode_registry/' + operation.registryKey),
            readOperationNode(handle, operation, 'zoew_monthly_revenue_cod_dod/' + operation.month),
            readOperationNode(handle, operation, 'zoew_daily_revenue_cod_dod/' + operation.scanDate)
        ]);
        if (!scanPendingMatches(row, operation) || !scanRegistryOwned(registry, operation) || !validLedgerBucket(month)
            || !ledgerTokenSeen(month, operation.monthToken) || daily !== null && !validLedgerBucket(daily)) return scanHeld(handle);
        if (![daily, month].every(bucket => scanLedgerIncrementSafe(bucket?.codDollar || 0, operation.cod)
            && scanLedgerIncrementSafe(bucket?.dodDollar || 0, operation.dod))) return scanHeld(handle);
        const updates: any = {
            [SCAN_OPERATIONS_ROOT + '/' + operation.id]: { ...operation, phase: 'committed' },
            [SCAN_PENDING_ROOT + '/' + operation.id]: null,
            ['zoew_scan_history_cod_dod/' + operation.targetId + '/scanPending']: null,
            ['zoew_barcode_registry/' + operation.registryKey]: scanRegistryOwner(operation)
        };
        for (const root of ['zoew_daily_revenue_cod_dod/' + operation.scanDate, 'zoew_monthly_revenue_cod_dod/' + operation.month]) {
            updates[root + '/codDollar'] = handle.sdk.increment(operation.cod);
            updates[root + '/dodDollar'] = handle.sdk.increment(operation.dod);
            updates[root + '/totalCount'] = handle.sdk.increment(1);
        }
        try { await handle.sdk.update(handle.sdk.ref(handle.db), updates); } catch (e) {}
        const receipt = await readOperationNode(handle, operation, SCAN_OPERATIONS_ROOT + '/' + operation.id);
        if (!scanOperationSame(receipt, operation) || receipt.phase !== 'committed') return scanHeld(handle);
        const local = dataState.scanHistory.find(item => item.id === operation.targetId);
        if (local?.scanPending?.intent === operation.id) delete local.scanPending;
        return finishPendingScan(handle, 'saved-and-ledger-confirmed');
    } catch (e) {
        return scanHeld(handle);
    }
}

export async function saveScanOperation(handle: PendingScanHandle, phone, locker, closedAt = 0) {
    const original = operationOf(handle);
    if (!original) return 'unknown';
    activeScans.set(original.id, handle);
    try {
        const encoded = new TextEncoder().encode(JSON.stringify({ phone, locker, closedAt }));
        const digest = await crypto.subtle.digest('SHA-256', encoded);
        const payloadHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        let operation = await readOperationNode(handle, original, SCAN_OPERATIONS_ROOT + '/' + original.id);
        if (!scanOperationSame(operation, original, false)) { scanHeld(handle); return 'unknown'; }
        if (operation.phase === 'committed') return finishPendingScan(handle, 'saved-and-ledger-confirmed') || 'unknown';
        if (operation.phase === 'cancelled') return 'unknown';
        let preparedHere = false;
        if (operation.phase === 'admitted') {
            const existing = phone === 'គ្មានលេខ' ? null : dataState.scanHistory.find(item => item.phone === phone
                && item.scanDate === original.scanDate && (item.isClosed === true) === (closedAt > 0));
            if (rowOperationActive(existing)) { await cancelScanOperation(handle); return 'unknown'; }
            const prepared = { ...operation, phase: 'prepared', targetId: existing?.id || generateUniqueId(), payloadHash, phone, locker, closedAt };
            const update: any = value => operationCurrent(handle, original) && (value === null
                || scanOperationSame(value, original, false) && value.phase === 'admitted') ? prepared : undefined;
            update.txOutcomeWitness = value => scanOperationSame(value, prepared) && value.phase === 'prepared' ? 'applied' : null;
            const bound = await handle.sdk.runTransaction(handle.sdk.ref(handle.db, SCAN_OPERATIONS_ROOT + '/' + original.id), update, { applyLocally: false });
            preparedHere = bound?.committed === true && (bound.txOutcome !== 'applied' || bound.txProven === true);
            operation = await readOperationNode(handle, original, SCAN_OPERATIONS_ROOT + '/' + original.id);
        }
        if (!scanOperationValid(operation) || operation.phase !== 'prepared' || operation.payloadHash !== payloadHash) { scanHeld(handle); return 'unknown'; }
        notePendingScan(handle, 'save-pending', operation.targetId);
        const monthReady = preparedHere ? await prepareScanMonth(handle, operation)
            : ledgerTokenSeen(await readOperationNode(handle, operation, 'zoew_monthly_revenue_cod_dod/' + operation.month), operation.monthToken);
        if (!monthReady) { scanHeld(handle); return 'unknown'; }
        const stage: any = value => {
            if (!operationCurrent(handle, operation)) return;
            if (scanPendingMatches(value, operation)) return value;
            return stagedScanRow(value, operation, phone, locker, closedAt) || undefined;
        };
        stage.txOutcomeWitness = value => scanPendingMatches(value, operation) ? 'applied' : null;
        let result;
        try { result = await handle.sdk.runTransaction(handle.sdk.ref(handle.db, 'zoew_scan_history_cod_dod/' + operation.targetId), stage, { applyLocally: false }); }
        catch (e) {
            const row = await readOperationNode(handle, operation, 'zoew_scan_history_cod_dod/' + operation.targetId);
            if (!scanPendingMatches(row, operation)) {
                if (e?.txOutcome === 'not-applied' || /permission[_ ]denied/i.test(String(e?.code || e?.message))) await cancelScanOperation(handle);
                scanHeld(handle); return 'unknown';
            }
        }
        const row = await readOperationNode(handle, operation, 'zoew_scan_history_cod_dod/' + operation.targetId);
        if (!scanPendingMatches(row, operation)) {
            if (result?.committed === false) await cancelScanOperation(handle);
            return 'unknown';
        }
        const at = dataState.scanHistory.findIndex(item => item.id === operation.targetId);
        if (at >= 0) dataState.scanHistory[at] = row;
        else dataState.scanHistory.push(row);
        refreshCurrentHistoryView();
        return await finalizeScanOperation(handle, operation) || 'unknown';
    } catch (e) {
        scanHeld(handle);
        return 'unknown';
    } finally {
        if (activeScans.get(original.id) === handle) activeScans.delete(original.id);
        releasePendingScan(handle);
        warnPendingScans();
    }
}

export async function resumePendingScanOperations() {
    const scope = pendingScanScope();
    if (!scope || !firebaseState.db || !firebaseState.fb) return;
    if (recoveryOwner && recoveryOwner.db === firebaseState.db && recoveryOwner.sdk === firebaseState.fb
        && recoveryOwner.auth === firebaseState.authGeneration && recoveryOwner.scope === scope) return;
    const owner = { db: firebaseState.db, sdk: firebaseState.fb, auth: firebaseState.authGeneration, scope };
    recoveryOwner = owner;
    const current = () => owner.db === firebaseState.db && owner.sdk === firebaseState.fb
        && owner.auth === firebaseState.authGeneration && owner.scope === pendingScanScope();
    try {
        const journal = createScanEvidenceJournal(appLocalStore, 2);
        for (const record of journal.list(scope)) {
            if (!current()) return;
            if (record.corrupt || pendingScanIsCurrent(activeScans.get(record.id)) || pendingScanIsLive(record.id)) continue;
            const handle: PendingScanHandle = { record, db: owner.db, sdk: owner.sdk, auth: owner.auth };
            const base = operationOf(handle);
            if (!base) continue;
            try {
                const operation = await readOperationNode(handle, base, SCAN_OPERATIONS_ROOT + '/' + base.id);
                if (!scanOperationSame(operation, base, false)) { scanHeld(handle); continue; }
                if (operation.phase === 'committed') finishPendingScan(handle, 'saved-and-ledger-confirmed');
                else if (operation.phase === 'cancelled') finishCancelledScan(handle);
                else if (operation.phase === 'prepared') {
                    const row = await readOperationNode(handle, operation, 'zoew_scan_history_cod_dod/' + operation.targetId);
                    if (scanPendingMatches(row, operation)) await finalizeScanOperation(handle, operation);
                    else if (!row?.scanPending) await cancelScanOperation(handle);
                    else scanHeld(handle);
                } else await cancelScanOperation(handle);
            } catch (e) { scanHeld(handle); }
        }
    } finally {
        if (recoveryOwner === owner) recoveryOwner = null;
    }
}
