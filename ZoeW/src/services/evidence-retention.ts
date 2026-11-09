import { sessionVerificationRequired } from '../core/session-verification';
import { dataState, firebaseState } from '../core/state';
import { captureClockOperation, cleanupClockIsTrustworthy, getServerClockBounds } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { liveShopScope, shopScopePending } from '../core/shop-scope';
import { isValidKey, nameCompare } from '../core/rtdb-key';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY } from '../core/text';
import { REGISTRY_RELEASES_ROOT } from '../domain/registry-purge-proof';
import { SCAN_OPERATIONS_ROOT } from '../domain/scan-protocol';
import { TRASH_CONSUMPTIONS_ROOT } from '../domain/trash-generation';
import { connectionFlowSnapshot } from './connection-flow';
import { dbListenerViewIsStale } from './db-listeners';
import { dbOp } from './network';
import { txReadServerValue, txRestUrl } from './tx-outcome';

export const EVIDENCE_RETENTION_MS = 5184000000;
export const EVIDENCE_RETENTION_MARGIN_MS = 3600000;
export const EVIDENCE_SWEEP_BATCH = 50;
export const EVIDENCE_SWEEP_GAP_MS = 3600000;
export const EVIDENCE_SWEEP_CURSOR_KEY = 'zoew_evidence_sweep_cursor_v1';
export const EVIDENCE_ROOTS = [
    { root: SCAN_OPERATIONS_ROOT, field: 'birth' },
    { root: REGISTRY_RELEASES_ROOT, field: 'deletedAt' },
    { root: TRASH_CONSUMPTIONS_ROOT, field: 'deletedAt' }
];
const EVIDENCE_KEY_RE = /^[A-Za-z0-9_-]{1,128}$/;
export const evidenceSweep = { at: 0, running: false, owner: null as EvidenceOwner | null, cursors: {} as Record<string, string> };

type EvidenceOwner = { db: any; sdk: any; auth: any; authGeneration: number; uid: string; scope: string };

function evidenceClockCurrent() {
    return cleanupClockIsTrustworthy() && Number.isFinite(firebaseState.serverTimeOffsetMs) && getServerClockBounds() !== null;
}

export function evidenceCursorKey(scope: string, uid: string) {
    return EVIDENCE_SWEEP_CURSOR_KEY + ':' + encodeURIComponent(scope) + ':' + encodeURIComponent(uid);
}

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

function loadEvidenceCursors(owner: EvidenceOwner) {
    const cursors: Record<string, string> = {};
    try {
        const stored = JSON.parse(safeStoreGet(appLocalStore, evidenceCursorKey(owner.scope, owner.uid)) || 'null');
        if (stored?.v === 1 && stored.scope === owner.scope && stored.uid === owner.uid && stored.roots && typeof stored.roots === 'object') {
            for (const { root } of EVIDENCE_ROOTS) if (isValidKey(stored.roots[root])) cursors[root] = stored.roots[root];
        }
    } catch (e) {}
    return cursors;
}

function checkpointEvidence(owner: EvidenceOwner, root: string, after: string | null) {
    if (!evidenceOwnerCurrent(owner) || !evidenceClockCurrent()) return;
    if ((evidenceSweep.cursors[root] || null) === after) return;
    if (after) evidenceSweep.cursors[root] = after;
    else delete evidenceSweep.cursors[root];
    safeStoreSet(appLocalStore, evidenceCursorKey(owner.scope, owner.uid), JSON.stringify({ v: 1, scope: owner.scope, uid: owner.uid, roots: evidenceSweep.cursors }));
}

async function readEvidenceNode(owner: EvidenceOwner, path: string) {
    const ref = owner.sdk.ref(owner.db, path), url = txRestUrl(ref);
    const value = url ? await txReadServerValue(url, undefined, () => evidenceOwnerCurrent(owner)) : (await dbOp(owner.sdk.get(ref))).val();
    if (!evidenceOwnerCurrent(owner)) throw new Error('evidence:session');
    return value === undefined ? null : value;
}

async function listEvidence(owner: EvidenceOwner, root: string, field: string, before: number) {
    let entries: Array<[string, any]> = [];
    const after = evidenceSweep.cursors[root] || null;
    if (owner.sdk.__supabase) {
        if (typeof owner.sdk.evidenceCandidates !== 'function') throw new Error('evidence:unavailable');
        const docs = await dbOp(owner.sdk.evidenceCandidates(owner.auth, root, before, EVIDENCE_SWEEP_BATCH, after));
        if (!Array.isArray(docs) || docs.length > EVIDENCE_SWEEP_BATCH || docs.some(doc => !doc || doc.r !== root || !isValidKey(doc.k))) throw new Error('evidence:page');
        entries = docs.map(doc => [doc.k, doc.v]);
    } else {
        const url = txRestUrl(owner.sdk.ref(owner.db, root));
        if (!url) throw new Error('evidence:unavailable');
        const query = new URL(url);
        query.searchParams.set('orderBy', JSON.stringify('$key'));
        if (after) query.searchParams.set('startAt', JSON.stringify(after));
        query.searchParams.set('limitToFirst', String(EVIDENCE_SWEEP_BATCH + (after ? 1 : 0)));
        const value = await txReadServerValue(query.toString(), undefined, () => evidenceOwnerCurrent(owner));
        if (value && typeof value === 'object') entries = Object.entries(value).filter(([key, child]) => isValidKey(key) && child !== null
            && (!after || nameCompare(key, after) > 0)).sort(([a], [b]) => nameCompare(a, b)).slice(0, EVIDENCE_SWEEP_BATCH);
        else if (value !== null) throw new Error('evidence:page');
    }
    if (!evidenceOwnerCurrent(owner)) throw new Error('evidence:session');
    return { after: entries.length === EVIDENCE_SWEEP_BATCH ? entries.at(-1)![0] : null,
        candidates: entries.filter(([key, value]) => EVIDENCE_KEY_RE.test(key) && value && typeof value === 'object' && !Array.isArray(value)
            && Number.isFinite(value[field]) && value[field] < before) };
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

async function retireEvidence(owner: EvidenceOwner, root: string, candidates: Array<{ key: string; at: number }>, clock: ReturnType<typeof captureClockOperation>) {
    const eligibleKeys = () => {
        const bounds = getServerClockBounds();
        if (!clock.current() || !bounds) throw new Error('evidence:clock');
        const before = bounds.lowerMs - EVIDENCE_RETENTION_MS - EVIDENCE_RETENTION_MARGIN_MS;
        return candidates.filter(candidate => candidate.at < before).map(candidate => candidate.key);
    };
    const keys = eligibleKeys();
    if (!evidenceOwnerCurrent(owner) || !evidenceClockCurrent() || sessionVerificationRequired()) throw new Error('evidence:session');
    if (!keys.length) return 0;
    try {
        await dbOp(owner.sdk.update(owner.sdk.ref(owner.db), Object.fromEntries(keys.map(key => [root + '/' + key, null]))));
        if (!evidenceOwnerCurrent(owner)) throw new Error('evidence:session');
        return keys.length;
    } catch (error) {
        if (!evidenceOwnerCurrent(owner) || !evidenceDeleteRefused(error)) throw error;
        let removed = 0;
        for (const key of keys) {
            if (!eligibleKeys().includes(key)) continue;
            if (!evidenceOwnerCurrent(owner) || !evidenceClockCurrent() || sessionVerificationRequired()) throw new Error('evidence:session');
            try {
                await dbOp(owner.sdk.update(owner.sdk.ref(owner.db), { [root + '/' + key]: null }));
                if (!evidenceOwnerCurrent(owner)) throw new Error('evidence:session');
                removed++;
            } catch (one) {
                if (!evidenceOwnerCurrent(owner) || !evidenceDeleteRefused(one)) throw one;
            }
        }
        return removed;
    }
}

function evidenceDeleteRefused(error) {
    return error?.code === 'PERMISSION_DENIED' || (error?.code === '42501' && error?.message === 'permission_denied');
}

export async function runEvidenceRetentionSweep() {
    if (evidenceSweep.running || sessionVerificationRequired()) return 0;
    if (!firebaseState.isDatabaseInitialized || firebaseState.dbListenersFailed || !evidenceClockCurrent() || shopScopePending()) return 0;
    if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return 0;
    const flow = connectionFlowSnapshot();
    if (flow.phase !== 'ready' || flow.pendingWrites > 0) return 0;
    const clock = captureClockOperation();
    const owner = captureEvidenceOwner();
    if (!owner) return 0;
    if (!evidenceSweep.owner || !evidenceOwnerCurrent(evidenceSweep.owner)) {
        evidenceSweep.owner = owner;
        evidenceSweep.cursors = loadEvidenceCursors(owner);
        evidenceSweep.at = 0;
    }
    if (elapsedSince(evidenceSweep.at) < EVIDENCE_SWEEP_GAP_MS) return 0;
    evidenceSweep.running = true;
    evidenceSweep.at = Date.now();
    let removed = 0;
    try {
        const bounds = getServerClockBounds();
        if (!bounds) return 0;
        const before = bounds.lowerMs - EVIDENCE_RETENTION_MS - EVIDENCE_RETENTION_MARGIN_MS;
        for (const { root, field } of EVIDENCE_ROOTS) {
            if (!evidenceOwnerCurrent(owner) || !evidenceClockCurrent()) break;
            try {
                const page = await listEvidence(owner, root, field, before);
                const candidates: Array<{ key: string; at: number }> = [];
                for (const [key, value] of page.candidates) {
                    if (!evidenceOwnerCurrent(owner) || !evidenceClockCurrent() || sessionVerificationRequired()) throw new Error('evidence:session');
                    if (await evidenceRetirable(owner, root, key, value, before)) candidates.push({ key, at: value[field] });
                }
                removed += await retireEvidence(owner, root, candidates, clock);
                checkpointEvidence(owner, root, page.after);
            } catch (error) {
            }
        }
    } finally {
        evidenceSweep.running = false;
    }
    return removed;
}
