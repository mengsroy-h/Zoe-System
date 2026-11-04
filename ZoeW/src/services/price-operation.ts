import { dataState, firebaseState } from '../core/state';
import { viewState } from '../core/view-state';
import { liveShopScope, shopScopePending } from '../core/shop-scope';
import { elapsedSince } from '../core/elapsed';
import { DB_LISTENER_KEY_HISTORY } from '../core/text';
import { syncCollectedValueForBarcode } from '../domain/collected';
import { dbListenerViewIsStale } from './db-listeners';
import { dbOp, dbOpStalled } from './network';
import { monthlyRootMutation } from './scan-operation';
import { txReadServerValue, txRestUrl } from './tx-outcome';
import { movePriceOperation, priceOperationFromRow, priceOperationMarkerValid, priceOperationOwned, priceOperationProtocol, pricedRow, type PriceOperationHandle } from './row-operation-lock';
import { showToast } from '../ui/toast';

export const PRICE_LIVE_LOCK_PREFIX = 'zoew-price-live-';
export const PRICE_RESUME_GRACE_MS = 60 * 1000;
export const PRICE_EXIT_GRACE_MS = 10 * 60 * 1000;

export type PriceCommitVerdict = 'committed' | 'not-applied' | 'underflow' | 'unknown' | 'elsewhere';
export type PriceFinishVerdict = 'committed' | 'cancelled' | 'underflow' | 'pending' | 'elsewhere';

const PRICE_HISTORY_ROOT = 'zoew_scan_history_cod_dod';
export const livePriceTokens = new Set<string>();
export const priceOperationSeen = new Map<string, number>();

let priceResumeOwner = null;

async function readPriceNode(handle: PriceOperationHandle, current: () => boolean, path: string) {
    if (!current()) throw new Error('PRICE_OPERATION_SESSION');
    const ref = handle.sdk.ref(handle.db, path);
    const url = txRestUrl(ref);
    const value = url ? await txReadServerValue(url) : (await dbOp(handle.sdk.get(ref))).val();
    if (!current()) throw new Error('PRICE_OPERATION_SESSION');
    return value;
}

function priceCents(value) {
    return Math.round((parseFloat(value) || 0) * 100);
}

function incrementSafe(value, delta: number) {
    const stored = parseFloat(value) || 0;
    const wanted = priceCents(stored) + Math.round(delta * 100);
    return Number.isFinite(stored) && wanted >= 0 && Math.round((stored + delta) * 100) === wanted;
}

export async function commitPriceOperation(handle: PriceOperationHandle, current: () => boolean): Promise<PriceCommitVerdict> {
    const { priorCod, priorDod, wantCod, wantDod, scanDate, slot } = handle.marker;
    const codCents = priceCents(wantCod) - priceCents(priorCod);
    const dodCents = priceCents(wantDod) - priceCents(priorDod);
    const itemPath = PRICE_HISTORY_ROOT + '/' + handle.itemId;
    if (!codCents && !dodCents) {
        try {
            const moved = await movePriceOperation(handle, 'admitted', 'history');
            if (moved) return 'committed';
        } catch (error) {
            if (dbOpStalled(error) || error?.txOutcome === 'unknown') return 'unknown';
        }
        const row = await readPriceNode(handle, current, itemPath);
        if (priceOperationOwned(row, handle, 'history')) return 'committed';
        return priceOperationOwned(row, handle, 'admitted') ? 'not-applied' : 'elsewhere';
    }
    const before = await readPriceNode(handle, current, itemPath);
    if (priceOperationOwned(before, handle, 'history') || priceOperationOwned(before, handle, 'settled', 'committed')) return 'committed';
    if (!priceOperationOwned(before, handle, 'admitted')) return 'elsewhere';
    const codDiff = codCents / 100;
    const dodDiff = dodCents / 100;
    const buckets = ['zoew_daily_revenue_cod_dod/' + scanDate, 'zoew_monthly_revenue_cod_dod/' + scanDate.slice(0, 7)];
    const records = await Promise.all(buckets.map((path) => readPriceNode(handle, current, path)));
    if (records.some((record) => codCents && !incrementSafe(record?.codDollar, codDiff) || dodCents && !incrementSafe(record?.dodDollar, dodDiff))) return 'underflow';
    const priced = pricedRow(handle);
    const patch: Record<string, any> = {
        [itemPath + '/barcodes/' + slot + '/cod']: wantCod,
        [itemPath + '/barcodes/' + slot + '/dod']: wantDod,
        [itemPath + '/cod']: priced.cod,
        [itemPath + '/dod']: priced.dod,
        [itemPath + '/price']: priced.price,
        [itemPath + '/pricePending/phase']: 'history'
    };
    for (const bucket of buckets) {
        if (codCents) patch[bucket + '/codDollar'] = handle.sdk.increment(codDiff);
        if (dodCents) patch[bucket + '/dodDollar'] = handle.sdk.increment(dodDiff);
    }
    let failure = null;
    try {
        await monthlyRootMutation(handle.db, handle.sdk, current, () => dbOp(handle.sdk.update(handle.sdk.ref(handle.db), patch)));
    } catch (error) { failure = error || new Error('PRICE_COMMIT_FAILED'); }
    if (!current()) return 'unknown';
    let row;
    try { row = await readPriceNode(handle, current, itemPath); } catch (readError) { return 'unknown'; }
    if (priceOperationOwned(row, handle, 'history') || priceOperationOwned(row, handle, 'settled', 'committed')) return 'committed';
    if (!priceOperationOwned(row, handle, 'admitted')) return 'elsewhere';
    if (!failure || dbOpStalled(failure) || failure.txOutcome === 'unknown' || !/permission[_ ]denied/i.test(String(failure.code || failure.message || ''))) return 'unknown';
    return 'not-applied';
}

async function phaseOf(handle: PriceOperationHandle, current: () => boolean) {
    const row = await readPriceNode(handle, current, PRICE_HISTORY_ROOT + '/' + handle.itemId);
    for (const [phase, outcome] of [['admitted'], ['history'], ['cancelling'], ['settled', 'committed'], ['settled', 'compensated']] as const) {
        if (priceOperationOwned(row, handle, phase as any, outcome as any)) return outcome ? phase + ':' + outcome : phase;
    }
    return 'elsewhere';
}

export async function finishPriceOperation(handle: PriceOperationHandle, current: () => boolean, phase?: string): Promise<PriceFinishVerdict> {
    let state = phase || await phaseOf(handle, current);
    let cancelVerdict: PriceFinishVerdict = 'cancelled';
    if (state === 'admitted') {
        const verdict = await commitPriceOperation(handle, current);
        if (!current()) return 'pending';
        if (verdict === 'committed') state = 'history';
        else if (verdict === 'unknown') return 'pending';
        else if (verdict === 'elsewhere') state = await phaseOf(handle, current);
        else {
            cancelVerdict = verdict === 'underflow' ? 'underflow' : 'cancelled';
            const cancelling = await movePriceOperation(handle, 'admitted', 'cancelling');
            if (!current()) return 'pending';
            state = cancelling ? 'cancelling' : await phaseOf(handle, current);
        }
    }
    if (state === 'cancelling') {
        const settled = await movePriceOperation(handle, 'cancelling', 'settled', 'compensated');
        if (!current()) return 'pending';
        return settled ? cancelVerdict : 'pending';
    }
    if (state === 'history') {
        const mirrored = await syncCollectedValueForBarcode(handle.itemId, handle.marker.code, current);
        if (!current() || mirrored !== true) return 'pending';
        const settled = await movePriceOperation(handle, 'history', 'settled', 'committed');
        if (!current()) return 'pending';
        return settled ? 'committed' : 'pending';
    }
    if (state === 'settled:committed') return 'committed';
    if (state === 'settled:compensated') return 'cancelled';
    return state === 'admitted' ? 'pending' : 'elsewhere';
}

export function withPriceOperationLock<T>(token: string, action: () => Promise<T>, ifAvailable = false): Promise<T | null> {
    const locks: any = typeof navigator !== 'undefined' ? (navigator as any).locks : null;
    const run = async () => {
        if (livePriceTokens.has(token)) return null;
        livePriceTokens.add(token);
        try { return await action(); } finally { livePriceTokens.delete(token); }
    };
    if (!locks || typeof locks.request !== 'function') return run();
    return Promise.resolve(locks.request(PRICE_LIVE_LOCK_PREFIX + token, ifAvailable ? { ifAvailable: true } : {}, (lock) => (lock ? run() : null)))
        .catch(() => run());
}

function priceOwner() {
    return { db: firebaseState.db, sdk: firebaseState.fb, generation: firebaseState.authGeneration, uid: firebaseState.auth?.currentUser?.uid, scope: liveShopScope() };
}

function priceOwnerCurrent(owner) {
    return !!owner && owner.db === firebaseState.db && owner.sdk === firebaseState.fb && owner.generation === firebaseState.authGeneration
        && owner.uid === firebaseState.auth?.currentUser?.uid && owner.scope === liveShopScope() && !shopScopePending();
}

export function ownPriceOperations() {
    const uid = firebaseState.auth?.currentUser?.uid;
    if (!uid) return [];
    return (Array.isArray(dataState.scanHistory) ? dataState.scanHistory : [])
        .filter((row) => row && typeof row.id === 'string' && priceOperationMarkerValid(row.pricePending) && row.pricePending.phase !== 'settled' && row.pricePending.actorUid === uid)
        .map((row) => ({ itemId: row.id, marker: row.pricePending, protocol: priceOperationProtocol(row.pricePending) }));
}

function notePriceOperationsStuck(operations) {
    const now = Date.now();
    const tokens = new Set<string>(operations.map((operation): string => operation.marker.token));
    for (const token of [...priceOperationSeen.keys()]) if (!tokens.has(token)) priceOperationSeen.delete(token);
    for (const token of tokens) if (!priceOperationSeen.has(token)) priceOperationSeen.set(token, now);
    viewState.priceOperationsStuck = operations.filter((operation) => operation.protocol === 'legacy'
        || elapsedSince(priceOperationSeen.get(operation.marker.token)) >= PRICE_EXIT_GRACE_MS).length;
}

export async function resumePriceOperations() {
    const owner = priceOwner();
    if (!owner.db || !owner.sdk || !owner.uid || !owner.scope || shopScopePending() || !firebaseState.isDatabaseConnected
        || dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || priceResumeOwner && priceOwnerCurrent(priceResumeOwner)) return;
    const recovery = typeof owner.sdk.recoveryState === 'function' ? owner.sdk.recoveryState(owner.db) : null;
    if (recovery && (recovery.recovering || recovery.blocked)) return;
    const operations = ownPriceOperations();
    notePriceOperationsStuck(operations);
    const due = operations.filter((operation) => operation.protocol === 'v2' && !livePriceTokens.has(operation.marker.token)
        && elapsedSince(priceOperationSeen.get(operation.marker.token)) >= PRICE_RESUME_GRACE_MS);
    if (!due.length) return;
    priceResumeOwner = owner;
    const current = () => priceOwnerCurrent(owner);
    try {
        for (const operation of due) {
            if (!current()) return;
            const verdict = await withPriceOperationLock(operation.marker.token, async () => {
                const row = await readPriceNode({ db: owner.db, sdk: owner.sdk } as any, current, PRICE_HISTORY_ROOT + '/' + operation.itemId);
                const handle = priceOperationFromRow(operation.itemId, row);
                if (!handle || handle.marker.token !== operation.marker.token || priceOperationProtocol(handle.marker) !== 'v2') return null;
                return finishPriceOperation(handle, current);
            }, true).catch(() => null);
            if (!current()) return;
            if (verdict === 'committed') showToast('✅ បានបញ្ចប់ការកែតម្លៃដែលនៅរង់ចាំ (' + operation.marker.code + ')');
            else if (verdict === 'cancelled' || verdict === 'underflow') showToast('⚠️ ការកែតម្លៃដែលនៅរង់ចាំ (' + operation.marker.code + ') មិនបានរក្សាទុក — តម្លៃកញ្ចប់ និងស្ថិតិប្រាក់នៅដដែល');
        }
    } finally {
        if (priceResumeOwner === owner) priceResumeOwner = null;
        if (current()) notePriceOperationsStuck(ownPriceOperations());
    }
}

export async function settleStuckPriceOperations() {
    const owner = priceOwner();
    const current = () => priceOwnerCurrent(owner);
    const operations = ownPriceOperations().filter((operation) => operation.protocol === 'legacy'
        || elapsedSince(priceOperationSeen.get(operation.marker.token)) >= PRICE_EXIT_GRACE_MS);
    const result = { settled: 0, kept: 0 };
    for (const operation of operations) {
        if (!current()) break;
        const verdict = await withPriceOperationLock(operation.marker.token, async () => {
            const row = await readPriceNode({ db: owner.db, sdk: owner.sdk } as any, current, PRICE_HISTORY_ROOT + '/' + operation.itemId);
            const handle = priceOperationFromRow(operation.itemId, row);
            if (!handle || handle.marker.token !== operation.marker.token) return null;
            const phase = row.pricePending.phase;
            const protocol = priceOperationProtocol(handle.marker);
            let done = null;
            if (protocol === 'v2') {
                const finished = await finishPriceOperation(handle, current, phase);
                done = finished === 'pending' || finished === 'elsewhere' ? null : finished;
            } else if (phase === 'history') {
                done = await movePriceOperation(handle, 'history', 'settled', 'committed') ? 'committed' : null;
            } else {
                const cancelling = phase === 'cancelling' || await movePriceOperation(handle, 'admitted', 'cancelling');
                done = cancelling && await movePriceOperation(handle, 'cancelling', 'settled', 'compensated') ? 'compensated' : null;
            }
            if (done && window.ZoeErrors) ZoeErrors.capture(new Error('Stuck price operation settled by the owner'), {
                zone: 'money', context: 'settleStuckPriceOperations', itemId: operation.itemId, token: operation.marker.token, phase, protocol, choice: done,
                code: operation.marker.code, scanDate: operation.marker.scanDate, priorCod: operation.marker.priorCod, priorDod: operation.marker.priorDod,
                wantCod: operation.marker.wantCod, wantDod: operation.marker.wantDod
            });
            return done;
        }, true).catch(() => null);
        if (verdict) result.settled++; else result.kept++;
    }
    if (current()) notePriceOperationsStuck(ownPriceOperations());
    return result;
}
