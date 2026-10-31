import { rowOperationActive } from '../services/row-operation-lock';
import { firebaseState } from '../core/state';
import { getServerNow } from '../core/clock';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { liveShopScope } from '../core/shop-scope';
import { barcodeEntriesOf, ensureBarcodeArrayForItem, itemHasRestoreMarkers, normalizeBarcodesOf, stripTrashClaim } from './barcode';
import { dbOp, dbOpStalled } from '../services/network';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { DB_LISTENER_KEY_HISTORY } from '../core/text';

export function trashClaimPolicy() {
    return { staleMs: 24 * 60 * 60 * 1000, refreshMs: 60 * 60 * 1000, futureMs: 10 * 60 * 1000, storeKey: 'zoew_trash_claims_v2', storeMax: 200 };
}

export function newTrashClaimToken() {
    return 'tc_' + Math.max(0, Math.floor(getServerNow())).toString(36) + '_' + Math.random().toString(36).slice(2, 12).padEnd(10, '0');
}

export function trashClaimAge(barcode, now) {
    const at = barcode && typeof barcode.trashClaimAt === 'number' && isFinite(barcode.trashClaimAt) ? barcode.trashClaimAt : 0;
    if (!at || at - now > trashClaimPolicy().futureMs) return Infinity;
    return Math.max(0, now - at);
}

export function trashClaimHeldByOther(barcode, token, now) {
    return !!barcode && typeof barcode.trashClaim === 'string' && barcode.trashClaim !== token
        && trashClaimAge(barcode, now) <= trashClaimPolicy().staleMs && !ownLeftoverTrashClaim(barcode.trashClaim);
}

export function ownLeftoverTrashClaim(claim) {
    return !liveTrashClaims.has(claim) && trashClaimRecords().some((r) => r.token === claim && r.page === trashClaimPage && r.scope === liveShopScope());
}

export function trashClaimOwned(barcode, token, now) {
    return !!barcode && !!token && barcode.trashClaim === token && trashClaimAge(barcode, now) <= trashClaimPolicy().refreshMs;
}

export function itemHasLiveTrashClaim(item, now, token?) {
    return barcodeEntriesOf(item && item.barcodes).some(({ barcode }) => trashClaimHeldByOther(barcode, token, now));
}

function trashClaimRecords() {
    try {
        const parsed = JSON.parse(safeStoreGet(appLocalStore, trashClaimPolicy().storeKey) || '[]');
        return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.itemId === 'string' && typeof r.token === 'string') : [];
    } catch (e) {
        return [];
    }
}

function writeTrashClaimRecords(records) {
    try {
        if (!records.length) return safeStoreRemove(appLocalStore, trashClaimPolicy().storeKey);
        return safeStoreSet(appLocalStore, trashClaimPolicy().storeKey, JSON.stringify(records.slice(-trashClaimPolicy().storeMax)));
    } catch (e) {
        return false;
    }
}

export function noteTrashClaim(itemId, token, locked = false) {
    const records = trashClaimRecords().filter((r) => r.token !== token);
    records.push({ itemId, token, scope: liveShopScope(), page: trashClaimPage, locked });
    return writeTrashClaimRecords(records);
}

export function forgetTrashClaim(token) {
    const records = trashClaimRecords();
    const kept = records.filter((r) => r.token !== token);
    if (kept.length !== records.length) writeTrashClaimRecords(kept);
}

export function pendingTrashClaims(scope) {
    return trashClaimRecords().filter((r) => r.scope === scope);
}

export const liveTrashClaims = new Set();
export const trashClaimPage = Math.random().toString(36).slice(2);

export function trashClaimOwner() {
    return { db: firebaseState.db, api: firebaseState.fb, generation: firebaseState.authGeneration, uid: firebaseState.auth?.currentUser?.uid, scope: liveShopScope() };
}

function trashClaimOwnerIsCurrent(owner) {
    return !!owner && !!owner.db && !!owner.api && firebaseState.db === owner.db && firebaseState.fb === owner.api && firebaseState.authGeneration === owner.generation
        && firebaseState.auth?.currentUser?.uid === owner.uid && liveShopScope() === owner.scope;
}

export function claimTrashBarcodes(itemId, token, pick, allowEmptySource = false) {
    const emptyBarcodes = value => value == null || typeof value === 'object' && Object.keys(value).length === 0;
    const owner = trashClaimOwner();
    if (!owner.api || !owner.db || !itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return Promise.resolve({ state: 'failed', codes: [] });
    const current = () => trashClaimOwnerIsCurrent(owner);
    let stamped = [];
    let blocked = false;
    let reason = '';
    let present = false;
    const updater: any = (item) => {
        stamped = [];
        blocked = false;
        reason = '';
        present = !!item && typeof item === 'object';
        if (!current()) return;
        if (allowEmptySource && item === null) return null;
        if (!present) return;
        const emptySource = allowEmptySource && !Array.isArray(item) && emptyBarcodes(item.barcodes);
        if (emptySource && item.clearClaim !== undefined) { blocked = true; reason = 'clear'; return; }
        if (rowOperationActive(item)) { blocked = true; reason = 'operation'; return; }
        if (item.clearClaim || itemHasRestoreMarkers(item)) {
            blocked = true;
            reason = item.clearClaim ? 'clear' : 'restore';
            return;
        }
        normalizeBarcodesOf(item);
        ensureBarcodeArrayForItem(item);
        const now = getServerNow();
        const wanted = new Set(pick(item, now) || []);
        barcodeEntriesOf(item.barcodes).forEach(({ barcode }) => {
            if (!barcode || !wanted.has(barcode.code)) return;
            if (trashClaimHeldByOther(barcode, token, now)) { blocked = true; reason = 'claim'; return; }
            if (trashClaimOwned(barcode, token, now)) { stamped.push(barcode.code); return; }
            barcode.trashClaim = token;
            barcode.trashClaimAt = now;
            stamped.push(barcode.code);
        });
        return stamped.length || emptySource && !wanted.size ? item : undefined;
    };
    updater.txOutcomeWitness = (server) => {
        const owned = new Set(barcodeEntriesOf(server && server.barcodes).filter(({ barcode }) => barcode && barcode.trashClaim === token).map(({ barcode }) => barcode.code));
        if (stamped.length && stamped.every((code) => owned.has(code))) return 'applied';
        return stamped.some((code) => owned.has(code)) ? 'unknown' : 'not-applied';
    };
    const tx = owner.api.runTransaction(owner.api.ref(owner.db, `zoew_scan_history_cod_dod/${itemId}`), updater);
    return dbOp(tx).then((result) => {
        if (!current()) return { state: 'stale', codes: [] };
        const committed = result && result.committed && result.snapshot ? result.snapshot.val() : null;
        const now = getServerNow();
        const codes = barcodeEntriesOf(committed && committed.barcodes).filter(({ barcode }) => trashClaimOwned(barcode, token, now)).map(({ barcode }) => barcode.code);
        if (codes.length) return { state: 'claimed', codes, blocked, reason, source: committed };
        if (blocked) return { state: 'busy', codes: [], reason };
        if (allowEmptySource && committed && typeof committed === 'object' && !Array.isArray(committed) && emptyBarcodes(committed.barcodes)) return { state: 'idle', codes: [], reason, source: committed };
        return { state: present ? 'idle' : 'none', codes: [], reason };
    }, (error) => {
        if (dbOpStalled(error)) Promise.resolve(tx).then((late) => { if (late && late.committed) void releaseTrashClaims(itemId, token, owner); }, () => {});
        return current() ? { state: 'failed', codes: [], error } : { state: 'stale', codes: [] };
    });
}

export function releaseTrashClaims(itemId, token, owner = trashClaimOwner(), staleOnly = false) {
    if (!trashClaimOwnerIsCurrent(owner) || !itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return Promise.resolve(false);
    let held = false;
    let blocked = false;
    const updater: any = (item) => {
        held = false;
        blocked = rowOperationActive(item);
        if (blocked) return;
        if (!trashClaimOwnerIsCurrent(owner) || !item || typeof item !== 'object') return;
        if (staleOnly && barcodeEntriesOf(item.barcodes).some(({ barcode }) => barcode?.trashClaim === token && trashClaimAge(barcode, getServerNow()) <= trashClaimPolicy().staleMs)) {
            held = true;
            return;
        }
        let changed = false;
        barcodeEntriesOf(item.barcodes).forEach(({ barcode }) => {
            if (barcode && barcode.trashClaim === token) { stripTrashClaim(barcode); changed = true; }
        });
        if (changed) return item;
        return item.clearClaim || itemHasRestoreMarkers(item) ? undefined : item;
    };
    updater.txOutcomeWitness = (server) => (barcodeEntriesOf(server && server.barcodes).some(({ barcode }) => barcode && barcode.trashClaim === token) ? 'not-applied' : 'applied');
    return dbOp(owner.api.runTransaction(owner.api.ref(owner.db, `zoew_scan_history_cod_dod/${itemId}`), updater))
        .then((result) => {
            if (!trashClaimOwnerIsCurrent(owner) || held || blocked) return false;
            if (!(result && result.committed) && dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY)) return false;
            forgetTrashClaim(token);
            return true;
        }, () => false);
}

export function beginTrashClaim(itemId) {
    const token = newTrashClaimToken();
    const owner = trashClaimOwner();
    let settled = false;
    let started = false;
    let releaseLock = () => {};
    return {
        token,
        async start() {
            liveTrashClaims.add(token);
            try {
                const locks = typeof navigator !== 'undefined' && navigator.locks;
                let locked = false;
                if (locks && typeof locks.request === 'function') {
                    const held = new Promise<void>((resolve) => { releaseLock = resolve; });
                    await dbOp(new Promise<void>((resolve, reject) => {
                        Promise.resolve(locks.request('zoew-trash-claim:' + token, () => {
                            locked = true;
                            resolve();
                            return held;
                        })).catch(reject);
                    }));
                }
                if (!trashClaimOwnerIsCurrent(owner)) throw new Error('TRASH_CLAIM_SESSION_SWITCHED');
                if (!noteTrashClaim(itemId, token, locked)) throw new Error('write_journal_unavailable');
                started = true;
            } catch (error) {
                liveTrashClaims.delete(token);
                releaseLock();
                throw error;
            }
        },
        settle(consumed) {
            if (settled) return Promise.resolve();
            settled = true;
            liveTrashClaims.delete(token);
            if (!started) { releaseLock(); return Promise.resolve(); }
            if (consumed) {
                forgetTrashClaim(token);
                releaseLock();
                return Promise.resolve();
            }
            return releaseTrashClaims(itemId, token, owner).then(() => {}).finally(releaseLock);
        }
    };
}

export async function releaseLeftoverTrashClaims(scope, isCurrent) {
    for (const record of pendingTrashClaims(scope)) {
        if (!isCurrent()) return;
        if (liveTrashClaims.has(record.token)) continue;
        const owner = trashClaimOwner();
        if (record.page === trashClaimPage) {
            await releaseTrashClaims(record.itemId, record.token, owner);
            continue;
        }
        try {
            const locks = typeof navigator !== 'undefined' && navigator.locks;
            if (record.locked === true && locks && typeof locks.request === 'function') {
                await dbOp(locks.request('zoew-trash-claim:' + record.token, { ifAvailable: true }, async (lock) => {
                    if (lock && isCurrent()) await releaseTrashClaims(record.itemId, record.token, owner);
                }));
            } else {
                await releaseTrashClaims(record.itemId, record.token, owner, true);
            }
        } catch (e) {}
    }
}
