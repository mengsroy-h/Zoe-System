import { firebaseState } from '../core/state';
import { getServerNow } from '../core/clock';
import { liveShopScope } from '../core/shop-scope';
import { trashGenerationOf } from '../domain/trash-generation';
import { barcodeEntriesOf, barcodeReturnBasis } from '../domain/barcode';
import { pickupBarcodeKey } from '../domain/pickup';
import { dbOp, fetchWithTimeout } from '../services/network';
import { addZtoIdentityHeader, buildLookupRequestHeaders } from './lookup-api';
import { getLookupApiConfig, getZtoTrashMode } from './lookup-config';
import { getZtoPickupVerdict, setZtoPickupVerdict, ztoVerdictCandidate } from './zto-status';
import { ztoReturnedEvidence } from './zto-final-marks';

export const RESTORE_AUTH_TIMEOUT_MS = 48000;

export type RestorePolicy = { v: 1; mode: 'local' | 'palm' | 'cookie'; scope: string; branch: string; epoch: number };
export type RestoreProofOperation = { token: string; targetId: string; current: () => boolean; action?: 'authorize' | 'refresh' | 'rebind' | 'release' };
export type RestoreAuthorization = { kind: 'local' | 'allow' | 'released' | 'already_applied'; source?: any; attestationId?: string; expiresAt?: number; policy?: RestorePolicy };

function runtimeRestoreTerminal(item): boolean {
    return barcodeEntriesOf(item?.barcodes).some(({ barcode }) => {
        const basis = Math.max(barcodeReturnBasis(barcode, item.createdAt), Number(item.restoredAt) || 0);
        const verdict = getZtoPickupVerdict(barcode.code, ztoVerdictCandidate(item, barcode));
        if (verdict?.closed === true && (!(verdict.signedAt > 0) || verdict.signedAt >= basis)) return true;
        const returned = ztoReturnedEvidence.get(pickupBarcodeKey(barcode.code));
        return returned?.kind === 'returned' && returned.at >= basis
            && returned.at > Math.max(Number(barcode.ztoSentOutAt) || 0, Number(barcode.ztoMisplacedAt) || 0);
    });
}

export async function readRestorePolicy(isCurrent: () => boolean = () => true): Promise<RestorePolicy> {
    const api = firebaseState.fb, policyDatabase = firebaseState.db, policyAuth = firebaseState.auth, generation = firebaseState.authGeneration;
    const uid = policyAuth?.currentUser?.uid, scope = liveShopScope();
    const current = () => isCurrent() && api === firebaseState.fb && policyDatabase === firebaseState.db && policyAuth === firebaseState.auth
        && generation === firebaseState.authGeneration && uid === policyAuth?.currentUser?.uid && scope === liveShopScope();
    if (!api || !policyDatabase || !uid || !scope || !current()) throw new Error('RESTORE_SESSION_SWITCHED');
    let policy;
    try { policy = (await dbOp(api.get(api.ref(policyDatabase, 'zoew_restore_policy/shop')))).val(); }
    catch { throw new Error(current() ? 'RESTORE_SHOP_MODE_UNSYNCED' : 'RESTORE_SESSION_SWITCHED'); }
    if (!current()) throw new Error('RESTORE_SESSION_SWITCHED');
    if (!policy || typeof policy !== 'object' || Array.isArray(policy) || policy.v !== 1
        || !['local', 'palm', 'cookie'].includes(policy.mode) || policy.scope !== scope
        || typeof policy.branch !== 'string' || !(policy.mode === 'local' && policy.branch === '' || /^[A-Za-z0-9_-]{1,32}$/.test(policy.branch))
        || !Number.isSafeInteger(policy.epoch) || policy.epoch < 1 || policy.epoch > 9007199254740990) throw new Error('RESTORE_SHOP_MODE_UNSYNCED');
    return policy;
}

export async function requestRestoreAuthorization(item, operation: RestoreProofOperation, policy?: RestorePolicy): Promise<RestoreAuthorization> {
    if (!operation || typeof operation.current !== 'function' || !operation.current()) throw new Error('RESTORE_SESSION_SWITCHED');
    const sourceId = item?.id, expectedGeneration = trashGenerationOf(item);
    if (typeof sourceId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(sourceId)
        || typeof operation.token !== 'string' || !operation.token || operation.token.length > 2048
        || typeof operation.targetId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(operation.targetId)
        || expectedGeneration === null) throw new Error('RESTORE_GENERATION_HOLD');
    const terminalAtStart = runtimeRestoreTerminal(item);
    policy = policy || await readRestorePolicy(operation.current);
    const mode = item.trashMode === 'palm' || item.trashMode === 'cookie' ? item.trashMode : policy.mode;
    if (mode === 'local') throw new Error('RESTORE_SHOP_MODE_UNSYNCED');
    if (getZtoTrashMode() !== mode) throw new Error('RESTORE_ZTO_NEEDS_LOOKUP');
    if (navigator.onLine === false) throw new Error('RESTORE_ZTO_UNVERIFIED');
    const cfg = getLookupApiConfig(), signature = JSON.stringify(cfg), scope = liveShopScope();
    const api = firebaseState.fb, proofDatabase = firebaseState.db;
    const current = () => operation.current() && api === firebaseState.fb && proofDatabase === firebaseState.db
        && scope === liveShopScope() && JSON.stringify(getLookupApiConfig()) === signature;
    let url;
    try {
        url = new URL(cfg.url, window.location.href);
        if (!/\/\.netlify\/functions\/zto-order-detail$/.test(url.pathname)) throw new Error();
        url.pathname = url.pathname.replace(/zto-order-detail$/, 'zto-restore-proof');
        url.search = '';
    } catch { throw new Error('RESTORE_ZTO_NEEDS_LOOKUP'); }
    const headers = await buildLookupRequestHeaders(cfg);
    await addZtoIdentityHeader(cfg, headers);
    headers['Content-Type'] = 'application/json';
    if (!current()) throw new Error('RESTORE_SESSION_SWITCHED');
    let out;
    try {
        out = await fetchWithTimeout(url.href, { method: 'POST', redirect: 'error', headers, body: JSON.stringify({ v: 1,
            action: operation.action || 'authorize', sourceId, token: operation.token, targetId: operation.targetId, expectedGeneration }) },
        RESTORE_AUTH_TIMEOUT_MS, 'ZTO restore authorization timed out', response => response.json().catch(() => null));
    } catch { throw new Error(current() ? 'RESTORE_ZTO_UNVERIFIED' : 'RESTORE_SESSION_SWITCHED'); }
    if (!current()) throw new Error('RESTORE_SESSION_SWITCHED');
    const body = out.body;
    if (!out.res.ok || !body || typeof body !== 'object' || body.v !== 1 || body.success !== true) {
        throw new Error(body?.code === 'ZTO_RESTORE_SOURCE_CHANGED' ? 'RESTORE_GENERATION_HOLD' : 'RESTORE_ZTO_UNCONFIRMED');
    }
    if (body.kind === 'already_applied') return { kind: 'already_applied' };
    if (!['allow', 'deny', 'released'].includes(body.kind)) throw new Error('RESTORE_ZTO_UNCONFIRMED');
    let source;
    try { source = (await dbOp(api.get(api.ref(proofDatabase, `zoew_recently_deleted_cod_dod/${sourceId}`)))).val(); }
    catch { throw new Error('RESTORE_ZTO_UNVERIFIED'); }
    if (!current()) throw new Error('RESTORE_SESSION_SWITCHED');
    if (!source || trashGenerationOf(source) !== expectedGeneration) throw new Error('RESTORE_GENERATION_HOLD');
    source = { ...source, id: sourceId };
    if (body.kind === 'released') {
        if (source.restoreAttestationId || source.restoreClaim?.token === operation.token) throw new Error('RESTORE_ZTO_UNCONFIRMED');
        return { kind: 'released', source };
    }
    if (body.kind === 'deny') {
        if (!['ZTO_RESTORE_TERMINAL_SIGNED', 'ZTO_RESTORE_TERMINAL_RETURNED'].includes(body.code)) throw new Error('RESTORE_ZTO_UNCONFIRMED');
        throw Object.assign(new Error('RESTORE_ZTO_FINAL'), { source,
        attestedTerminal: source.restoreAttestationId === body.attestationId && source.restoreClaim?.token === operation.token
            && source.restoreClaim?.targetId === operation.targetId });
    }
    if (typeof body.attestationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.attestationId)
        || source.restoreAttestationId !== body.attestationId || source.restoreClaim?.token !== operation.token
        || source.restoreClaim?.targetId !== operation.targetId) throw new Error('RESTORE_ZTO_UNCONFIRMED');
    if (!Number.isSafeInteger(body.expiresAt) || body.expiresAt <= getServerNow()) throw new Error('RESTORE_ZTO_UNCONFIRMED');
    if (terminalAtStart || runtimeRestoreTerminal(source)) throw Object.assign(new Error('RESTORE_ZTO_FINAL'), { source });
    for (const { barcode } of barcodeEntriesOf(source.barcodes)) setZtoPickupVerdict(barcode.code, false);
    return { kind: 'allow', source, attestationId: body.attestationId, expiresAt: body.expiresAt };
}

export async function verifyZtoRestoreStatus(item, operation?: RestoreProofOperation): Promise<RestoreAuthorization> {
    const policy = await readRestorePolicy(operation?.current);
    if (policy.mode === 'local' && item?.trashMode !== 'palm' && item?.trashMode !== 'cookie' && !item?.restoreAttestationId) {
        return { kind: 'local', policy };
    }
    if (!operation) throw new Error('RESTORE_ZTO_UNVERIFIED');
    return requestRestoreAuthorization(item, operation, policy);
}
