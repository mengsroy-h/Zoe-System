import { dataState, firebaseState } from '../core/state';
import { appLocalStore } from '../core/storage';
import { liveShopScope, shopScopePending } from '../core/shop-scope';
import { getFormattedClockTime } from '../core/timezone';
import { applyBarcodeCloseState, barcodeEntriesOf, barcodeSignIdentity, generateUniqueId, itemHasRestoreMarkers, normalizeBarcodesOf } from '../domain/barcode';
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
import { persistZtoImportVerdict } from '../features/zto-status';
import { scanImportProofValid, SCAN_IMPORT_CACHE_TTL_MS } from './scan-import-proof';
import { rowOperationActive } from './row-operation-lock';
import { dbOp, DB_OP_TIMEOUT_MS } from './network';

const activeScans = new Map<string, PendingScanHandle>();
let recoveryOwner: any = null;
let recoveryCursor: any = null;
const recoveryAttempts = new Map<string, { handle: PendingScanHandle; promise: Promise<void> }>();

type ScanMonthWaiter = { handle: PendingScanHandle; operation: ScanOperation; action: () => Promise<any>;
    resolve: (value: any) => void; reject: (error: Error) => void; deadline: number; timer: ReturnType<typeof setTimeout> };
type ScanMonthQueue = { active: ScanMonthWaiter | null; waiting: ScanMonthWaiter[] };
const scanMonthQueues = new WeakMap<object, ScanMonthQueue>();

function scanMonthMutation<T>(handle: PendingScanHandle, operation: ScanOperation, action: () => Promise<T>): Promise<T> {
    if (handle.sdk.__supabase) return Promise.resolve().then(() => {
        if (!operationCurrent(handle, operation)) throw new Error('Scan operation owner changed');
        return action();
    });
    let queue = scanMonthQueues.get(handle.db);
    if (!queue) { queue = { active: null, waiting: [] }; scanMonthQueues.set(handle.db, queue); }
    const owner = queue;
    const drain = () => {
        if (owner.active) return;
        const next = owner.waiting.shift();
        if (!next) {
            if (scanMonthQueues.get(handle.db) === owner) scanMonthQueues.delete(handle.db);
            return;
        }
        if (performance.now() >= next.deadline || !operationCurrent(next.handle, next.operation)) {
            clearTimeout(next.timer); next.reject(new Error('Scan monthly mutation wait expired or owner changed')); drain(); return;
        }
        owner.active = next;
        Promise.resolve().then(() => {
            if (!operationCurrent(next.handle, next.operation)) throw new Error('Scan operation owner changed');
            return next.action();
        }).then(value => {
            if (!operationCurrent(next.handle, next.operation)) throw new Error('Scan operation owner changed');
            next.resolve(value);
        }).catch(error => next.reject(error)).finally(() => {
            clearTimeout(next.timer);
            if (owner.active === next) owner.active = null;
            drain();
        });
    };
    return new Promise<T>((resolve, reject) => {
        const waiter: ScanMonthWaiter = { handle, operation, action, resolve, reject, deadline: performance.now() + DB_OP_TIMEOUT_MS, timer: undefined as any };
        waiter.timer = setTimeout(() => {
            const index = owner.waiting.indexOf(waiter);
            if (index >= 0) owner.waiting.splice(index, 1);
            reject(new Error('Scan monthly mutation timed out'));
            if (!owner.active) drain();
        }, DB_OP_TIMEOUT_MS);
        owner.waiting.push(waiter); drain();
    });
}

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
    return !shopScopePending() && pendingScanIsCurrent(handle) && operation.actorUid === firebaseState.auth?.currentUser?.uid && operation.scope === liveShopScope();
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

async function finishCommittedScan(handle: PendingScanHandle, operation: ScanOperation) {
    const proof = handle.record.importProof;
    if (proof === undefined) return finishPendingScan(handle, 'saved-and-ledger-confirmed');
    if (!scanImportProofValid(proof) || operation.phase !== 'committed' || !operationCurrent(handle, operation)) return scanHeld(handle);
    const durable = createScanEvidenceJournal(appLocalStore, 2).list(handle.record.scope).find(row => row.id === handle.record.id);
    if (!durable || durable.corrupt || JSON.stringify(durable.importProof) !== JSON.stringify(proof)) return scanHeld(handle);
    const now = Date.now();
    if (proof.observedAt > now) return scanHeld(handle);
    if (now > proof.observedAt + SCAN_IMPORT_CACHE_TTL_MS) {
        const done = finishPendingScan(handle, 'saved-and-ledger-confirmed');
        if (done) showToast(`⚠️ (${operation.code}) បានផ្ទៀងការរក្សាទុក និងប្រាក់រួច។ ភស្តុតាង ZTO ចាស់ហួសរយៈរក្សា — ត្រូវពិនិត្យស្ថានភាព ZTO ថ្មី។`);
        return done;
    }
    const roots = await Promise.all(['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod'].map(path => readOperationNode(handle, operation, path)));
    const holders = roots.flatMap(root => Object.values(root || {}).flatMap((item: any) => barcodeEntriesOf(item?.barcodes)
        .filter(({ barcode }) => barcode?.code === operation.code).map(({ barcode }) => ({ item, barcode }))));
    if (holders.length !== 1) return scanHeld(handle);
    const { item, barcode } = holders[0];
    if (rowOperationActive(item) || ['clearClaim', 'restoreClaim', 'restoreClaimId', 'restoreClaimToken'].some(key => item[key] !== undefined && item[key] !== null)
        || ['trashClaim', 'trashClaimAt'].some(key => barcode[key] !== undefined && barcode[key] !== null)
        || barcode.isClosed !== true || barcode.scanIntent !== operation.id || barcode.createdAt !== operation.birth
        || barcodeSignIdentity(item, barcode) !== proof.identity) return scanHeld(handle);
    const binding = { v: 1, provider: proof.provider, scope: operation.scope, actorUid: operation.actorUid,
        intent: operation.id, code: operation.code, birth: operation.birth, identity: proof.identity };
    if (persistZtoImportVerdict(binding, proof) !== 'stored') return scanHeld(handle);
    return finishPendingScan(handle, 'saved-and-ledger-confirmed');
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
        if (operation.phase === 'committed') return await finishCommittedScan(handle, operation);
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
    await scanMonthMutation(handle, operation, () => handle.sdk.runTransaction(handle.sdk.ref(handle.db, 'zoew_monthly_revenue_cod_dod'), update, { applyLocally: false }));
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
        if (saved.phase === 'committed') return await finishCommittedScan(handle, saved);
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
        try { await scanMonthMutation(handle, operation, () => handle.sdk.update(handle.sdk.ref(handle.db), updates)); } catch (e) {}
        const receipt = await readOperationNode(handle, operation, SCAN_OPERATIONS_ROOT + '/' + operation.id);
        if (!scanOperationSame(receipt, operation) || receipt.phase !== 'committed') return scanHeld(handle);
        const local = dataState.scanHistory.find(item => item.id === operation.targetId);
        if (local?.scanPending?.intent === operation.id) delete local.scanPending;
        return await finishCommittedScan(handle, receipt);
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
        if (operation.phase === 'committed') return await finishCommittedScan(handle, operation) || 'unknown';
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
    for (const [id, attempt] of recoveryAttempts) {
        if (!pendingScanIsCurrent(attempt.handle)) recoveryAttempts.delete(id);
    }
    const scope = pendingScanScope();
    if (!scope || !firebaseState.db || !firebaseState.fb || shopScopePending()) return;
    const sameContext = owner => !!owner && owner.db === firebaseState.db && owner.sdk === firebaseState.fb
        && owner.auth === firebaseState.authGeneration && owner.scope === pendingScanScope() && !shopScopePending();
    if (sameContext(recoveryOwner)) return;
    const owner = { db: firebaseState.db, sdk: firebaseState.fb, auth: firebaseState.authGeneration, scope, active: true };
    recoveryOwner = owner;
    if (!sameContext(recoveryCursor)) recoveryCursor = { ...owner, id: null };
    const cursor = recoveryCursor;
    const current = () => owner.active && recoveryOwner === owner && sameContext(owner);
    const run = async () => {
        const journal = createScanEvidenceJournal(appLocalStore, 2);
        const records = journal.list(scope);
        const last = records.findIndex(record => record.id === cursor.id);
        if (last >= 0) records.push(...records.splice(0, last + 1));
        for (const record of records) {
            if (!current()) return;
            if (record.corrupt || pendingScanIsCurrent(activeScans.get(record.id)) || pendingScanIsLive(record.id)
                || pendingScanIsCurrent(recoveryAttempts.get(record.id)?.handle)) continue;
            const handle: PendingScanHandle = { record, db: owner.db, sdk: owner.sdk, auth: owner.auth };
            const base = operationOf(handle);
            if (!base) continue;
            cursor.id = record.id;
            const attempt = { handle, promise: null as Promise<void> };
            recoveryAttempts.set(record.id, attempt);
            attempt.promise = (async () => {
                try {
                    const operation = await readOperationNode(handle, base, SCAN_OPERATIONS_ROOT + '/' + base.id);
                    if (!scanOperationSame(operation, base, false)) { scanHeld(handle); return; }
                    if (operation.phase === 'committed') await finishCommittedScan(handle, operation);
                    else if (operation.phase === 'cancelled') finishCancelledScan(handle);
                    else if (operation.phase === 'prepared') {
                        const row = await readOperationNode(handle, operation, 'zoew_scan_history_cod_dod/' + operation.targetId);
                        if (scanPendingMatches(row, operation)) await finalizeScanOperation(handle, operation);
                        else if (!row?.scanPending) await cancelScanOperation(handle);
                        else scanHeld(handle);
                    } else await cancelScanOperation(handle);
                } catch (e) { scanHeld(handle); }
                finally {
                    if (recoveryAttempts.get(record.id) === attempt) recoveryAttempts.delete(record.id);
                }
            })();
            await attempt.promise;
        }
    };
    try { await dbOp(run()); } catch (e) {}
    finally {
        owner.active = false;
        if (recoveryOwner === owner) recoveryOwner = null;
    }
}
