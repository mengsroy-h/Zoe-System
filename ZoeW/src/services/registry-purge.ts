import { firebaseState } from '../core/state';
import { liveShopScope } from '../core/shop-scope';
import { canonicalBarcodeRegistryKey } from '../domain/barcode-key';
import { barcodeEntriesOf } from '../domain/barcode';
import { REGISTRY_PURGE_MAX_WRITES, REGISTRY_RELEASES_ROOT, registryPurgeIntent, registryPurgeReceiptMatches, type RegistryPurgeReceipt } from '../domain/registry-purge-proof';
import { TRASH_CONSUMPTIONS_ROOT, trashConsumptionOf, trashGenerationOf, trashSourceUnconsumed } from '../domain/trash-generation';
import { SCAN_OPERATIONS_ROOT, scanOperationValid, scanRegistryOwned } from '../domain/scan-protocol';
import { dbOp } from './network';
import { rowOperationActive } from './row-operation-lock';
import { TX_ROOT_READ_TIMEOUT_MS, txReadServerValue, txRestUrl } from './tx-outcome';

const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum && value <= 9007199254740990;
const legacyNumber = value => value === undefined || value === null ? 0 : value;
const text = (value, maximum) => typeof value === 'string' && value.length > 0 && value.length <= maximum;

function sourceBasis(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source) || !integer(source.deletedAt, 1)
        || !integer(legacyNumber(source.createdAt)) || !integer(legacyNumber(source.count))
        || !source.barcodes || typeof source.barcodes !== 'object') return null;
    const generation = trashGenerationOf(source);
    if (generation === null) return null;
    const entries = [], keys = new Set(), intents = new Set();
    for (const slot of Object.keys(source.barcodes).sort((a, b) => Number(a) - Number(b))) {
        if (!/^(0|[1-9][0-9]{0,8})$/.test(slot)) return null;
        const barcode = source.barcodes[slot];
        if (barcode === null || barcode === undefined) continue;
        if (!barcode || typeof barcode !== 'object' || Array.isArray(barcode) || !text(barcode.code, 256)) return null;
        const registryKey = canonicalBarcodeRegistryKey(barcode.code);
        const scan = Object.prototype.hasOwnProperty.call(barcode, 'scanIntent');
        const birth = legacyNumber(barcode.createdAt);
        if (!text(registryKey, 768) || keys.has(registryKey) || !integer(birth, scan ? 1 : 0)
            || scan && (typeof barcode.scanIntent !== 'string' || !/^scan_[a-f0-9]{32}$/.test(barcode.scanIntent) || intents.has(barcode.scanIntent))) return null;
        keys.add(registryKey);
        if (scan) intents.add(barcode.scanIntent);
        entries.push({ slot, code: barcode.code, registryKey, birth, scanIntent: scan ? barcode.scanIntent : null });
    }
    if (!entries.length || source.count !== entries.length || 2 + 2 * entries.length > REGISTRY_PURGE_MAX_WRITES) return null;
    return { generation, deletedAt: source.deletedAt, rowBirth: legacyNumber(source.createdAt), rowCount: legacyNumber(source.count), scanDate: source.scanDate ?? null, entries };
}

function sourceIdentity(basis) {
    return basis && JSON.stringify({ ...basis, entries: basis.entries.map(({ slot: _slot, ...entry }) => entry).sort((left, right) => left.registryKey.localeCompare(right.registryKey)) });
}

function sourceHeld(source) {
    return rowOperationActive(source) || ['restoreClaim', 'restoreClaimId', 'restoreClaimToken', 'restoreAddedCodes', 'clearClaim'].some(key => source?.[key] !== undefined && source[key] !== null)
        || barcodeEntriesOf(source?.barcodes).some(({ barcode }) => ['trashClaim', 'trashClaimAt'].some(key => barcode?.[key] !== undefined && barcode[key] !== null));
}

export async function purgeTrashWithRegistry(source): Promise<boolean> {
    const owner = { db: firebaseState.db, sdk: firebaseState.fb, generation: firebaseState.authGeneration,
        uid: firebaseState.auth?.currentUser?.uid, scope: liveShopScope() };
    const current = () => owner.db === firebaseState.db && owner.sdk === firebaseState.fb && owner.generation === firebaseState.authGeneration
        && owner.uid === firebaseState.auth?.currentUser?.uid && owner.scope === liveShopScope();
    if (!owner.db || !owner.sdk || !text(owner.uid, 2048) || !text(owner.scope, 2048) || !text(source?.id, 128) || !/^[a-zA-Z0-9_-]+$/.test(source.id)) return false;
    const sourceId = source.id;
    const read = async (path: string, root = false) => {
        if (!current()) throw new Error('REGISTRY_PURGE_SESSION');
        const ref = owner.sdk.ref(owner.db, path), url = txRestUrl(ref);
        const value = url ? await txReadServerValue(url, root ? TX_ROOT_READ_TIMEOUT_MS : undefined) : (await dbOp(owner.sdk.get(ref))).val();
        if (!current()) throw new Error('REGISTRY_PURGE_SESSION');
        return value;
    };
    try {
        const original = sourceBasis(source);
        if (!original) return false;
        const captured = sourceBasis(JSON.parse(JSON.stringify(source)));
        if (!captured || sourceIdentity(captured) !== sourceIdentity(original)) return false;
        const authoritative = await read('zoew_recently_deleted_cod_dod/' + sourceId);
        const basis = sourceBasis(authoritative);
        if (!current() || sourceHeld(authoritative) || !basis || sourceIdentity(basis) !== sourceIdentity(captured)) return false;
        const consumed = await read(TRASH_CONSUMPTIONS_ROOT + '/' + sourceId);
        const currentSource = { ...authoritative, id: sourceId };
        if (!current() || consumed !== null && consumed?.scope !== owner.scope || !trashSourceUnconsumed(currentSource, consumed)) return false;
        const consumption = trashConsumptionOf(currentSource, 'purge', { uid: owner.uid, scope: owner.scope });
        if (!consumption) return false;
        const receipts: RegistryPurgeReceipt[] = [];
        const operations = new Map();
        for (const entry of basis.entries) {
            let actorUid = owner.uid;
            if (entry.scanIntent) {
                const operation = await read(SCAN_OPERATIONS_ROOT + '/' + entry.scanIntent);
                if (!current() || !scanOperationValid(operation) || operation.phase !== 'committed' || operation.id !== entry.scanIntent || operation.scope !== owner.scope
                    || operation.code !== entry.code || operation.registryKey !== entry.registryKey || operation.birth !== entry.birth) return false;
                actorUid = operation.actorUid; operations.set(entry.scanIntent, operation);
            }
            receipts.push({ v: 2, generation: basis.generation, id: entry.scanIntent || 'release_' + crypto.randomUUID().replace(/-/g, ''), kind: entry.scanIntent ? 'scan' : 'legacy',
                actorUid, releasedBy: owner.uid, scope: owner.scope, code: entry.code, registryKey: entry.registryKey, birth: entry.birth,
                trashId: sourceId, slot: entry.slot, deletedAt: basis.deletedAt, rowBirth: basis.rowBirth, rowCount: basis.rowCount });
        }
        const updates: Record<string, any> = { ['zoew_recently_deleted_cod_dod/' + sourceId]: null, [TRASH_CONSUMPTIONS_ROOT + '/' + sourceId]: consumption };
        for (const receipt of receipts) {
            updates['zoew_barcode_registry/' + receipt.registryKey] = null;
            updates[REGISTRY_RELEASES_ROOT + '/' + receipt.id] = receipt;
        }
        if (!registryPurgeIntent(Object.entries(updates).map(([path, value]) => ({ k: 'set', p: path.split('/'), v: value })))) return false;
        const receiptState = async () => {
            const actual = await Promise.all(receipts.map(receipt => read(REGISTRY_RELEASES_ROOT + '/' + receipt.id)));
            return actual.every((value, index) => registryPurgeReceiptMatches(receipts[index], value)) ? 'done'
                : actual.every(value => value === null || value === undefined) ? 'empty' : 'hold';
        };
        const prior = await receiptState();
        if (!current()) return false;
        if (prior !== 'empty') return prior === 'done';
        const owners = await Promise.all(basis.entries.map(entry => read('zoew_barcode_registry/' + entry.registryKey)));
        if (!current() || owners.some((value, index) => basis.entries[index].scanIntent ? !scanRegistryOwned(value, operations.get(basis.entries[index].scanIntent)) : value !== true && value !== null && value !== undefined)) return false;
        const [history, trash] = await Promise.all([read('zoew_scan_history_cod_dod', true), read('zoew_recently_deleted_cod_dod', true)]);
        const wanted = new Set(basis.entries.map(entry => entry.registryKey));
        const otherHolder = (rows, inTrash) => {
            if (rows !== null && rows !== undefined && typeof rows !== 'object') return true;
            return Object.entries(rows || {}).some(([id, item]: [string, any]) => !(inTrash && id === sourceId)
                && barcodeEntriesOf(item?.barcodes).some(({ barcode }) => wanted.has(canonicalBarcodeRegistryKey(barcode?.code))));
        };
        if (otherHolder(history, false) || otherHolder(trash, true) || !current() || sourceHeld(trash?.[sourceId])
            || JSON.stringify(sourceBasis(trash?.[sourceId])) !== JSON.stringify(basis)) return false;
        try { await dbOp(owner.sdk.update(owner.sdk.ref(owner.db), updates)); } catch (error) {}
        if (!current()) return false;
        const settled = await receiptState();
        return current() && settled === 'done';
    } catch (error) { return false; }
}
