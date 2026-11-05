import { dataState, firebaseState } from '../core/state';
import { cleanupClockIsTrustworthy, getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { liveShopScope, shopScopePending } from '../core/shop-scope';
import { DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY } from '../core/text';
import { REGISTRY_RELEASES_ROOT } from '../domain/registry-purge-proof';
import { SCAN_OPERATIONS_ROOT } from '../domain/scan-protocol';
import { TRASH_CONSUMPTIONS_ROOT } from '../domain/trash-generation';
import { dbListenerViewIsStale } from './db-listeners';
import { dbOp } from './network';
import { txReadServerValue, txRestUrl } from './tx-outcome';

export const EVIDENCE_RETENTION_MS = 5184000000;
export const EVIDENCE_RETENTION_MARGIN_MS = 3600000;
export const EVIDENCE_SWEEP_BATCH = 50;
export const EVIDENCE_SWEEP_GAP_MS = 3600000;
export const EVIDENCE_ROOTS = [
    { root: SCAN_OPERATIONS_ROOT, field: 'birth' },
    { root: REGISTRY_RELEASES_ROOT, field: 'deletedAt' },
    { root: TRASH_CONSUMPTIONS_ROOT, field: 'deletedAt' }
];
const EVIDENCE_KEY_RE = /^[A-Za-z0-9_-]{1,128}$/;
export const evidenceSweep = { at: 0, running: false };

type EvidenceOwner = { db: any; sdk: any; auth: any; authGeneration: number; uid: string; scope: string };

function captureEvidenceOwner(): EvidenceOwner | null {
    const owner = { db: firebaseState.db, sdk: firebaseState.fb, auth: firebaseState.auth, authGeneration: firebaseState.authGeneration,
        uid: firebaseState.auth?.currentUser?.uid, scope: liveShopScope() };
    return owner.db && owner.sdk && typeof owner.uid === 'string' && owner.uid.length > 0 && typeof owner.scope === 'string' && owner.scope.length > 0 ? owner : null;
}

function evidenceOwnerCurrent(owner: EvidenceOwner) {
    return owner.db === firebaseState.db && owner.sdk === firebaseState.fb && owner.auth === firebaseState.auth
        && owner.authGeneration === firebaseState.authGeneration && owner.uid === firebaseState.auth?.currentUser?.uid
        && owner.scope === liveShopScope() && !shopScopePending();
}

async function readEvidenceNode(owner: EvidenceOwner, path: string) {
    const ref = owner.sdk.ref(owner.db, path), url = txRestUrl(ref);
    const value = url ? await txReadServerValue(url, undefined, () => evidenceOwnerCurrent(owner)) : (await dbOp(owner.sdk.get(ref))).val();
    if (!evidenceOwnerCurrent(owner)) throw new Error('evidence:session');
    return value === undefined ? null : value;
}

async function listEvidence(owner: EvidenceOwner, root: string, field: string, before: number): Promise<Array<[string, any]>> {
    let entries: Array<[string, any]> = [];
    if (owner.sdk.__supabase) {
        if (typeof owner.sdk.evidenceCandidates !== 'function') return [];
        const docs = await dbOp(owner.sdk.evidenceCandidates(owner.auth, root, before, EVIDENCE_SWEEP_BATCH));
        if (Array.isArray(docs)) entries = docs.filter(doc => doc && doc.r === root).map(doc => [doc.k, doc.v]);
    } else {
        const url = txRestUrl(owner.sdk.ref(owner.db, root));
        if (!url) return [];
        const query = new URL(url);
        query.searchParams.set('orderBy', JSON.stringify(field));
        query.searchParams.set('endAt', String(before));
        query.searchParams.set('limitToFirst', String(EVIDENCE_SWEEP_BATCH));
        const value = await txReadServerValue(query.toString(), undefined, () => evidenceOwnerCurrent(owner));
        if (value && typeof value === 'object' && !Array.isArray(value)) entries = Object.entries(value);
    }
    if (!evidenceOwnerCurrent(owner)) throw new Error('evidence:session');
    return entries.filter(([key, value]) => EVIDENCE_KEY_RE.test(key) && value && typeof value === 'object' && !Array.isArray(value)
        && Number.isFinite(value[field]) && value[field] < before).slice(0, EVIDENCE_SWEEP_BATCH);
}

function viewHolds(list, id: string) {
    return Array.isArray(list) && list.some(item => item && item.id === id);
}

async function registryHeldBy(owner: EvidenceOwner, registryKey, intent: string) {
    if (typeof registryKey !== 'string' || !registryKey) return true;
    const registry = await readEvidenceNode(owner, 'zoew_barcode_registry/' + registryKey);
    return !!registry && typeof registry === 'object' && registry.intent === intent;
}

export async function evidenceRetirable(owner: EvidenceOwner, root: string, key: string, value, before: number) {
    if (!EVIDENCE_KEY_RE.test(key) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (root === SCAN_OPERATIONS_ROOT) {
        if (value.id !== key || (value.phase !== 'committed' && value.phase !== 'cancelled') || !(value.birth < before)) return false;
        if (await readEvidenceNode(owner, 'zoew_scan_pending/' + key) !== null) return false;
        return !await registryHeldBy(owner, value.registryKey, key);
    }
    if (root === REGISTRY_RELEASES_ROOT) {
        if (!(value.deletedAt < before) || typeof value.trashId !== 'string' || !EVIDENCE_KEY_RE.test(value.trashId)) return false;
        if (viewHolds(dataState.deletedItems, value.trashId) || await readEvidenceNode(owner, 'zoew_recently_deleted_cod_dod/' + value.trashId) !== null) return false;
        return !await registryHeldBy(owner, value.registryKey, key);
    }
    if (root !== TRASH_CONSUMPTIONS_ROOT || !(value.deletedAt < before)) return false;
    if (viewHolds(dataState.scanHistory, key) || viewHolds(dataState.deletedItems, key)) return false;
    for (const holder of ['zoew_recently_deleted_cod_dod/', 'zoew_scan_history_cod_dod/', 'zoew_restore_finalizations/']) {
        if (await readEvidenceNode(owner, holder + key) !== null) return false;
    }
    return true;
}

async function retireEvidence(owner: EvidenceOwner, root: string, keys: string[]) {
    if (!keys.length || !evidenceOwnerCurrent(owner)) return 0;
    try {
        await dbOp(owner.sdk.update(owner.sdk.ref(owner.db), Object.fromEntries(keys.map(key => [root + '/' + key, null]))));
        return keys.length;
    } catch (error) {
        let removed = 0;
        for (const key of keys) {
            if (!evidenceOwnerCurrent(owner)) break;
            try {
                await dbOp(owner.sdk.update(owner.sdk.ref(owner.db), { [root + '/' + key]: null }));
                removed++;
            } catch (one) {}
        }
        return removed;
    }
}

export async function runEvidenceRetentionSweep() {
    if (evidenceSweep.running || elapsedSince(evidenceSweep.at) < EVIDENCE_SWEEP_GAP_MS) return 0;
    if (!firebaseState.isDatabaseInitialized || firebaseState.dbListenersFailed || !cleanupClockIsTrustworthy() || shopScopePending()) return 0;
    if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return 0;
    const owner = captureEvidenceOwner();
    if (!owner) return 0;
    evidenceSweep.running = true;
    evidenceSweep.at = Date.now();
    let removed = 0;
    try {
        const before = getServerNow() - EVIDENCE_RETENTION_MS - EVIDENCE_RETENTION_MARGIN_MS;
        for (const { root, field } of EVIDENCE_ROOTS) {
            if (!evidenceOwnerCurrent(owner) || !cleanupClockIsTrustworthy()) break;
            const keys: string[] = [];
            for (const [key, value] of await listEvidence(owner, root, field, before)) {
                if (!evidenceOwnerCurrent(owner)) break;
                if (await evidenceRetirable(owner, root, key, value, before)) keys.push(key);
            }
            removed += await retireEvidence(owner, root, keys);
        }
    } catch (error) {
    } finally {
        evidenceSweep.running = false;
    }
    return removed;
}
