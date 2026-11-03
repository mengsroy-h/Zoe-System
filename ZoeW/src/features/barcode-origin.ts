import { rowOperationActive } from '../services/row-operation-lock';
import { dataState, firebaseState, ztoState } from '../core/state';
import { barcodeSignIdentity, itemHasRestoreMarkers } from '../domain/barcode';
import { barcodeRegistryKey } from '../domain/registry';
import { dbOp } from '../services/network';
import { liveShopScope, shopScopePending } from '../core/shop-scope';
import { getFormattedClockTime } from '../core/timezone';
import { scanOperationValid, SCAN_OPERATIONS_ROOT } from '../domain/scan-protocol';
import { pendingScanIsCurrent } from '../services/scan-pending';
import { scanImportProofValid } from '../services/scan-import-proof';
import { readRestoreServerNode } from './restore';

export const ORIGIN_TEXT_MAX = 64;

const ORIGIN_CONTROL_RE = /[\u0000-\u001F\u007F]/g;

export function originText(raw) {
    if (typeof raw !== 'string') return '';
    return raw.replace(ORIGIN_CONTROL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, ORIGIN_TEXT_MAX).trim();
}

export const ORIGIN_COUNTRIES = [
    { site: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', flag: '🇨🇳', name: 'ចិន' },
    { site: 'Shopee SHPE', flag: '🇻🇳', name: 'វៀតណាម' }
];

export function originLabel(raw) {
    const text = originText(raw);
    if (!text) return { icon: '', name: '', short: '', full: '' };
    const key = text.toLowerCase();
    const country = ORIGIN_COUNTRIES.find((c) => c.site.toLowerCase() === key);
    if (!country) return { icon: '📍', name: text, short: '📍 ' + text, full: '📍 ' + text };
    const short = country.flag + ' ' + country.name;
    return { icon: country.flag, name: country.name, short: short, full: short + ' · ' + text };
}

export function itemOriginOf(item, code) {
    if (!item || !item.origins || typeof item.origins !== 'object' || Array.isArray(item.origins)) return '';
    const key = barcodeRegistryKey(code);
    return key ? originText(item.origins[key]) : '';
}

export function itemOriginSummary(item) {
    const counts = new Map();
    const barcodes = item && Array.isArray(item.barcodes) ? item.barcodes : [];
    for (let i = 0; i < barcodes.length; i++) {
        const b = barcodes[i];
        if (!b || b.isDeducted) continue;
        const text = itemOriginOf(item, b.code);
        if (text) counts.set(text, (counts.get(text) || 0) + 1);
    }
    if (!counts.size) return { icon: '', text: '', full: '', more: 0 };
    let best = '';
    let bestCount = 0;
    counts.forEach((n, text) => {
        if (n > bestCount) { best = text; bestCount = n; }
    });
    const label = originLabel(best);
    return { icon: label.icon, text: label.name, full: label.full, more: counts.size - 1 };
}

function historyItemOwning(code) {
    const key = barcodeRegistryKey(code);
    if (!key) return null;
    const list = dataState.scanHistory || [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || !item.id || !Array.isArray(item.barcodes)) continue;
        if (item.barcodes.some((b) => b && barcodeRegistryKey(b.code) === key)) return item;
    }
    return null;
}

export function barcodeOriginWrites(entries) {
    const writes = [];
    const seen = new Set();
    const list = Array.isArray(entries) ? entries : [];
    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        const text = originText(entry && entry.from);
        const key = barcodeRegistryKey(entry && entry.code);
        if (!text || !key || seen.has(key)) continue;
        const item = historyItemOwning(entry.code);
        if (rowOperationActive(item)) continue;
        if (!item || !/^[a-zA-Z0-9_-]+$/.test(item.id)) continue;
        if (itemOriginOf(item, entry.code) === text) continue;
        seen.add(key);
        writes.push({ itemId: item.id, key: key, text: text });
    }
    return writes;
}

export function applyBarcodeOrigins(current, wanted) {
    if (!current || typeof current !== 'object' || !Array.isArray(current.barcodes) || !current.barcodes.length) return undefined;
    if (rowOperationActive(current)) return undefined;
    if (itemHasRestoreMarkers(current) || current.clearClaim) return undefined;
    const present = new Set(current.barcodes.filter(Boolean).map((b) => barcodeRegistryKey(b.code)));
    const origins = current.origins && typeof current.origins === 'object' && !Array.isArray(current.origins) ? { ...current.origins } : {};
    let changed = false;
    Object.keys(wanted || {}).forEach((key) => {
        if (!present.has(key) || origins[key] === wanted[key]) return;
        origins[key] = wanted[key];
        changed = true;
    });
    if (!changed) return undefined;
    current.origins = origins;
    return current;
}

export type OriginSaveResult = { applied: number; unchanged: number; unresolved: number; unknown: number };

// The binding is created only from the original, live scan handle. Existing
// list rows have no such handle and remain explicitly unresolved.
export function makeFreshOriginEntry(code, from, handle, sessionCurrent) {
    const plain = { code, from };
    try {
        const record = handle?.record, uid = firebaseState.auth?.currentUser?.uid, scope = liveShopScope();
        if (typeof sessionCurrent !== 'function' || !sessionCurrent() || !pendingScanIsCurrent(handle) || shopScopePending()
            || record?.v !== 2 || record.barcode !== code || !/^scan_[a-f0-9]{32}$/.test(record.id)
            || !Number.isSafeInteger(record.createdAt) || record.createdAt <= 0 || !uid || !scope
            || record.scope !== JSON.stringify([scope, uid]) || !record.scanDate) return plain;
        const signIdentity = JSON.stringify([record.scanDate, record.createdAt,
            getFormattedClockTime(record.createdAt) + ' (' + record.scanDate + ')', null]);
        if (record.importProof !== undefined && (!scanImportProofValid(record.importProof) || record.importProof.identity !== signIdentity)) return plain;
        return { code, from, binding: Object.freeze({ id: record.id, code, birth: record.createdAt,
            cod: record.cod, dod: record.dod, scanDate: record.scanDate, signIdentity,
            uid, scope, recordScope: record.scope, db: handle.db, sdk: handle.sdk,
            auth: handle.auth, sessionCurrent }) };
    } catch (e) { return plain; }
}

function originOwnerCurrent(binding) {
    try { return !!binding && typeof binding.sessionCurrent === 'function' && binding.sessionCurrent()
        && binding.db === firebaseState.db && binding.sdk === firebaseState.fb && binding.auth === firebaseState.authGeneration
        && binding.uid === firebaseState.auth?.currentUser?.uid && binding.scope === liveShopScope() && !shopScopePending()
        && binding.recordScope === JSON.stringify([binding.scope, binding.uid]); } catch (e) { return false; }
}
function originMember(item, candidate) {
    if (!item || typeof item !== 'object' || !Array.isArray(item.barcodes) || rowOperationActive(item)
        || itemHasRestoreMarkers(item) || item.clearClaim
        || item.barcodes.some(b => b && (b.trashClaim != null || b.trashClaimAt != null))) return null;
    const matches = item.barcodes.filter(b => b && barcodeRegistryKey(b.code) === candidate.key);
    const barcode = matches.length === 1 ? matches[0] : null, b = candidate.binding;
    return barcode && barcode.isDeducted !== true && barcode.code === b.code && barcode.createdAt === b.birth && barcode.scanIntent === b.id
        && barcodeSignIdentity(item, barcode) === b.signIdentity ? barcode : null;
}
function sameOriginAttempt(a, b) {
    const x=a.binding, y=b.binding;
    return !!x && !!y && a.code === b.code && a.text === b.text
        && ['id','code','birth','uid','scope','recordScope','db','sdk','auth','cod','dod','scanDate','signIdentity']
            .every(k => x[k] === y[k]);
}
function originCandidateCurrent(candidate) {
    return candidate.ownerBindings.every(originOwnerCurrent);
}

export async function saveBarcodeOrigins(entries): Promise<OriginSaveResult> {
    const result: OriginSaveResult = { applied: 0, unchanged: 0, unresolved: 0, unknown: 0 };
    const source = Array.isArray(entries) ? entries : [], byKey = new Map<string, any[]>();
    for (const entry of source) {
        const key = barcodeRegistryKey(entry?.code), text = originText(entry?.from);
        if (!key || !text) { result.unresolved++; continue; }
        const candidate = { key, code: entry.code, text, binding: entry.binding && { ...entry.binding } };
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push(candidate);
    }
    const groups = new Map<string, any[]>();
    let readsUnavailable = false;
    for (const [key, attempts] of byKey) {
        const first = attempts[0], b = first.binding;
        if (!b || attempts.some(a => !sameOriginAttempt(first, a)) || first.code !== b.code
            || !/^scan_[a-f0-9]{32}$/.test(b.id) || !Number.isSafeInteger(b.birth) || b.birth <= 0
            || typeof b.signIdentity !== 'string' || attempts.some(a => !originOwnerCurrent(a.binding))) { result.unresolved++; continue; }
        if (readsUnavailable || ztoState.ztoOriginRefusedDb === b.db) { result.unresolved++; continue; }
        const local = [...(dataState.scanHistory || []), ...(dataState.deletedItems || [])].flatMap(item =>
            Array.isArray(item?.barcodes) ? item.barcodes.filter(bc => bc && barcodeRegistryKey(bc.code) === key) : []);
        if (local.length > 1) { result.unresolved++; continue; }
        let op: any;
        try { op = await readRestoreServerNode(b.sdk, b.db, SCAN_OPERATIONS_ROOT + '/' + b.id); }
        catch (e) { result.unresolved++; readsUnavailable = true; continue; }
        if (!originOwnerCurrent(b) || !scanOperationValid(op) || op.phase !== 'committed'
            || op.id !== b.id || op.actorUid !== b.uid || op.scope !== b.scope || op.code !== b.code
            || op.registryKey !== key || op.birth !== b.birth || op.cod !== b.cod || op.dod !== b.dod || op.scanDate !== b.scanDate) {
            result.unresolved++; continue;
        }
        const candidate = { ...first, ownerBindings: attempts.map(a => a.binding), weight: 1, targetId: op.targetId };
        if (!groups.has(op.targetId!)) groups.set(op.targetId!, []);
        groups.get(op.targetId!)!.push(candidate);
    }
    let attempted = 0, refused = 0, writesUnavailable = false;
    for (const [targetId, group] of groups) {
        if (writesUnavailable) { result.unresolved += group.reduce((n, c) => n + c.weight, 0); continue; }
        if (group.some(candidate => !originCandidateCurrent(candidate))) {
            result.unresolved += group.reduce((n, c) => n + c.weight, 0); continue;
        }
        const sdk = group[0].binding.sdk, db = group[0].binding.db;
        let latest: Record<string, string> = {};
        const updater = snapshotItem => {
            latest = {};
            if (group.some(candidate => !originCandidateCurrent(candidate)) || !snapshotItem || snapshotItem.id !== targetId) return;
            if (snapshotItem.origins != null && (typeof snapshotItem.origins !== 'object' || Array.isArray(snapshotItem.origins))) {
                for (const candidate of group) latest[candidate.key] = 'unresolved';
                return;
            }
            let changed = false;
            const origins = snapshotItem.origins && typeof snapshotItem.origins === 'object' && !Array.isArray(snapshotItem.origins)
                ? { ...snapshotItem.origins } : {};
            for (const candidate of group) {
                if (!originMember(snapshotItem, candidate)) { latest[candidate.key] = 'unresolved'; continue; }
                if (origins[candidate.key] === candidate.text) { latest[candidate.key] = 'unchanged'; continue; }
                origins[candidate.key] = candidate.text; latest[candidate.key] = 'applied'; changed = true;
            }
            if (!changed) return;
            snapshotItem.origins = origins;
            return snapshotItem;
        };
        let tx: any;
        attempted++;
        try { tx = await dbOp(sdk.runTransaction(sdk.ref(db, 'zoew_scan_history_cod_dod/' + targetId), updater), 'Origin write stalled'); }
        catch (e) {
            if (/permission/i.test(String((e && (e.code || e.message)) || e))) refused++;
            else writesUnavailable = true;
            const count = group.reduce((n, c) => n + c.weight, 0);
            if (e && (e.txOutcome === 'not-applied' || e.nativeUnsent === true && e.txOutcome !== 'unknown')) result.unresolved += count;
            else result.unknown += count;
            continue;
        }
        if (group.some(candidate => !originCandidateCurrent(candidate))) {
            result.unknown += group.reduce((n, c) => n + c.weight, 0); continue;
        }
        if (!tx || tx.committed !== true && tx.committed !== false
            || tx.txOutcome !== undefined && (tx.txOutcome !== 'applied' || tx.txProven !== true)) {
            result.unknown += group.reduce((n, c) => n + c.weight, 0); continue;
        }
        let row: any;
        if (tx.committed === true) {
            try { row = tx.snapshot?.val(); } catch (e) { row = null; }
            if (!row) { result.unknown += group.reduce((n, c) => n + c.weight, 0); continue; }
        } else {
            try { row = await readRestoreServerNode(sdk, db, 'zoew_scan_history_cod_dod/' + targetId); }
            catch (e) { result.unresolved += group.reduce((n, c) => n + c.weight, 0); continue; }
            if (group.some(candidate => !originCandidateCurrent(candidate))) {
                result.unknown += group.reduce((n, c) => n + c.weight, 0); continue;
            }
        }
        for (const candidate of group) {
            const status = latest[candidate.key];
            if (!status || !originMember(row, candidate) || row.origins?.[candidate.key] !== candidate.text) {
                if (tx.committed === true && (status === 'applied' || !status)) result.unknown += candidate.weight;
                else result.unresolved += candidate.weight;
                continue;
            }
            if (tx.committed === true && status === 'applied') {
                result.applied++; result.unchanged += candidate.weight - 1;
            } else if (status === 'unchanged') result.unchanged += candidate.weight;
            else result.unresolved += candidate.weight;
        }
    }
    if (!result.applied && refused && refused === attempted && groups.size
        && [...groups.values()].every(group => group.every(originCandidateCurrent))) {
        ztoState.ztoOriginRefusedDb = [...groups.values()][0][0].binding.db;
    }
    return result;
}
