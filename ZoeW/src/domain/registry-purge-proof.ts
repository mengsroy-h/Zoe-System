import { canonicalBarcodeRegistryKey } from './barcode-key';

export const REGISTRY_RELEASES_ROOT = 'zoew_registry_releases';
export const REGISTRY_PURGE_MAX_WRITES = 500;
export type RegistryPurgeReceipt = {
    v: 1; id: string; kind: 'scan' | 'legacy'; actorUid: string; releasedBy: string; scope: string;
    code: string; registryKey: string; birth: number; trashId: string; slot: string;
    deletedAt: number; rowBirth: number; rowCount: number;
};
export type RegistryPurgeIntent = { sourceId: string; receipts: RegistryPurgeReceipt[] };

const FIELDS = ['v', 'id', 'kind', 'actorUid', 'releasedBy', 'scope', 'code', 'registryKey', 'birth', 'trashId', 'slot', 'deletedAt', 'rowBirth', 'rowCount'];
const text = (value, maximum) => typeof value === 'string' && value.length > 0 && value.length <= maximum;
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum && value <= 9007199254740990;

export function registryPurgeReceiptValid(value: any): value is RegistryPurgeReceipt {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === FIELDS.length
        && FIELDS.every(key => Object.prototype.hasOwnProperty.call(value, key)) && value.v === 1
        && (value.kind === 'scan' ? /^scan_[a-f0-9]{32}$/.test(value.id) && integer(value.birth, 1)
            : value.kind === 'legacy' && /^release_[a-f0-9]{32}$/.test(value.id) && integer(value.birth) && value.actorUid === value.releasedBy)
        && text(value.actorUid, 2048) && text(value.releasedBy, 2048) && text(value.scope, 2048)
        && text(value.code, 256) && text(value.registryKey, 768) && value.registryKey === canonicalBarcodeRegistryKey(value.code)
        && text(value.trashId, 128) && /^[a-zA-Z0-9_-]+$/.test(value.trashId)
        && typeof value.slot === 'string' && /^(0|[1-9][0-9]{0,8})$/.test(value.slot)
        && integer(value.deletedAt, 1) && integer(value.rowBirth) && integer(value.rowCount);
}

export function registryPurgeReceiptMatches(expected: any, actual: any) {
    return registryPurgeReceiptValid(expected) && registryPurgeReceiptValid(actual) && FIELDS.every(key => expected[key] === actual[key]);
}

export function registryPurgeIntent(ops: any): RegistryPurgeIntent | null {
    if (!Array.isArray(ops) || ops.length < 3 || ops.length > REGISTRY_PURGE_MAX_WRITES || ops.length % 2 !== 1) return null;
    const entries = new Map<string, any>();
    for (const op of ops) {
        if (!op || typeof op !== 'object' || Array.isArray(op) || Object.keys(op).sort().join(',') !== 'k,p,v' || op.k !== 'set'
            || !Array.isArray(op.p) || !op.p.length || op.p.some(part => typeof part !== 'string' || !part || /[.#$\[\]\/]/.test(part))) return null;
        const path = op.p.join('/');
        if (entries.has(path)) return null;
        entries.set(path, op.v);
    }
    const sources = [...entries].filter(([path, value]) => path.startsWith('zoew_recently_deleted_cod_dod/') && path.split('/').length === 2 && value === null);
    if (sources.length !== 1) return null;
    const sourceId = sources[0][0].split('/')[1];
    const receipts = [...entries].filter(([path]) => path.startsWith(REGISTRY_RELEASES_ROOT + '/')).map(([path, value]) => ({ path, value }));
    if (!receipts.length || entries.size !== 1 + 2 * receipts.length || receipts.some(({ value }) => value?.rowCount !== receipts.length)) return null;
    const keys = new Set<string>(), slots = new Set<string>();
    const first = receipts[0].value;
    for (const { path, value } of receipts) {
        if (!registryPurgeReceiptValid(value) || path !== REGISTRY_RELEASES_ROOT + '/' + value.id || value.trashId !== sourceId
            || keys.has(value.registryKey) || slots.has(value.slot) || entries.get('zoew_barcode_registry/' + value.registryKey) !== null
            || !['releasedBy', 'scope', 'deletedAt', 'rowBirth', 'rowCount'].every(key => value[key] === first[key])) return null;
        keys.add(value.registryKey); slots.add(value.slot);
    }
    return { sourceId, receipts: receipts.map(({ value }) => value) };
}
