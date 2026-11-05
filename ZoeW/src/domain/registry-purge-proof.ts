import { canonicalBarcodeRegistryKey } from './barcode-key';
import { TRASH_CONSUMPTIONS_ROOT, purgeCertificateOf, trashConsumptionSame, type TrashConsumption } from './trash-generation';

export const REGISTRY_RELEASES_ROOT = 'zoew_registry_releases';
export const REGISTRY_PURGE_MAX_WRITES = 500;
export const REGISTRY_PURGE_MAX_BYTES = 4 * 1024 * 1024;
export const REGISTRY_PURGE_CONSUMPTION_MAX_BYTES = 1024 * 1024;
const TRASH_ROOT = 'zoew_recently_deleted_cod_dod';
export type RegistryPurgeReceipt = {
    v: 1 | 2; generation?: number; id: string; kind: 'scan' | 'legacy'; actorUid: string; releasedBy: string; scope: string;
    code: string; registryKey: string; birth: number; trashId: string; slot: string;
    deletedAt: number; rowBirth: number; rowCount: number;
};
export type RegistryPurgeIntent = { sourceId: string; receipts: RegistryPurgeReceipt[]; consumption?: TrashConsumption; shape: 'row' | 'slot'; fields?: string[] };

const FIELDS = ['v', 'id', 'kind', 'actorUid', 'releasedBy', 'scope', 'code', 'registryKey', 'birth', 'trashId', 'slot', 'deletedAt', 'rowBirth', 'rowCount'];
const text = (value, maximum) => typeof value === 'string' && value.length > 0 && value.length <= maximum;
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum && value <= 9007199254740990;

export function registryPurgeReceiptValid(value: any): value is RegistryPurgeReceipt {
    const fields = value?.v === 2 ? [...FIELDS, 'generation'] : FIELDS;
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === fields.length
        && fields.every(key => Object.prototype.hasOwnProperty.call(value, key)) && (value.v === 1 || value.v === 2 && integer(value.generation))
        && (value.kind === 'scan' ? /^scan_[a-f0-9]{32}$/.test(value.id) && integer(value.birth, 1)
            : value.kind === 'legacy' && /^release_[a-f0-9]{32}$/.test(value.id) && integer(value.birth) && value.actorUid === value.releasedBy)
        && text(value.actorUid, 2048) && text(value.releasedBy, 2048) && text(value.scope, 2048)
        && text(value.code, 256) && text(value.registryKey, 768) && value.registryKey === canonicalBarcodeRegistryKey(value.code)
        && text(value.trashId, 128) && /^[a-zA-Z0-9_-]+$/.test(value.trashId)
        && typeof value.slot === 'string' && /^(0|[1-9][0-9]{0,8})$/.test(value.slot)
        && integer(value.deletedAt, 1) && integer(value.rowBirth) && integer(value.rowCount);
}

export function registryPurgeReceiptMatches(expected: any, actual: any) {
    return registryPurgeReceiptValid(expected) && registryPurgeReceiptValid(actual) && [...FIELDS, ...(expected.v === 2 ? ['generation'] : [])].every(key => expected[key] === actual[key]);
}

function parseRegistryPurgeIntent(ops: any): RegistryPurgeIntent | null {
    if (!Array.isArray(ops) || ops.length < 3) return null;
    const entries = new Map<string, any>();
    for (const op of ops) {
        if (!op || typeof op !== 'object' || Array.isArray(op) || Object.keys(op).sort().join(',') !== 'k,p,v' || op.k !== 'set'
            || !Array.isArray(op.p) || !op.p.length || op.p.some(part => typeof part !== 'string' || !part || /[.#$\[\]\/]/.test(part))) return null;
        const path = op.p.join('/');
        if (entries.has(path)) return null;
        entries.set(path, op.v);
    }
    const trash = [...entries].filter(([path]) => path.startsWith(TRASH_ROOT + '/')).map(([path, value]) => ({ parts: path.split('/'), value }));
    const rows = trash.filter(({ parts }) => parts.length === 2);
    const shape = rows.length ? 'row' : 'slot';
    const sourceId = trash[0]?.parts[1];
    const slotOps = new Set<string>(), fields: string[] = [];
    if (!trash.length || trash.some(({ parts, value }) => value !== null || parts[1] !== sourceId)) return null;
    if (shape === 'row') { if (trash.length !== 1) return null; }
    else for (const { parts } of trash) {
        if (parts.length === 4 && parts[2] === 'barcodes' && /^(0|[1-9][0-9]{0,8})$/.test(parts[3])) slotOps.add(parts[3]);
        else if (parts.length === 3 && parts[2] !== 'barcodes' && parts[2].length <= 768) fields.push(parts[2]);
        else return null;
    }
    const receipts = [...entries].filter(([path]) => path.startsWith(REGISTRY_RELEASES_ROOT + '/')).map(([path, value]) => ({ path, value }));
    if (!receipts.length || receipts.some(({ value }) => value?.rowCount !== receipts.length)) return null;
    const keys = new Set<string>(), slots = new Set<string>();
    const first = receipts[0].value;
    const consumption = entries.get(TRASH_CONSUMPTIONS_ROOT + '/' + sourceId);
    if (shape === 'slot' && (first?.v !== 2 || !fields.length || slotOps.size !== receipts.length)) return null;
    if (entries.size !== (shape === 'slot' ? 1 + fields.length + slotOps.size : first?.v === 2 ? 2 : 1) + 2 * receipts.length) return null;
    for (const { path, value } of receipts) {
        if (!registryPurgeReceiptValid(value) || path !== REGISTRY_RELEASES_ROOT + '/' + value.id || value.trashId !== sourceId
            || keys.has(value.registryKey) || slots.has(value.slot) || entries.get('zoew_barcode_registry/' + value.registryKey) !== null
            || shape === 'slot' && !slotOps.has(value.slot)
            || !['v', 'generation', 'releasedBy', 'scope', 'deletedAt', 'rowBirth', 'rowCount'].every(key => value[key] === first[key])) return null;
        keys.add(value.registryKey); slots.add(value.slot);
    }
    if (first.v === 2) {
        const expected = { v: 1, sourceId, generation: first.generation, kind: 'purge', actorUid: first.releasedBy, scope: first.scope,
            deletedAt: first.deletedAt, rowBirth: first.rowBirth, ...(shape === 'slot' ? purgeCertificateOf(receipts.map(({ value }) => value)) : {}) };
        if (!trashConsumptionSame(expected, consumption)) return null;
    }
    return { sourceId, receipts: receipts.map(({ value }) => value), ...(first.v === 2 ? { consumption } : {}), shape, ...(shape === 'slot' ? { fields } : {}) };
}

export function registryPurgeIntent(ops: any): RegistryPurgeIntent | null {
    if (!Array.isArray(ops) || ops.length > REGISTRY_PURGE_MAX_WRITES) return null;
    return parseRegistryPurgeIntent(ops);
}

const protocolText = (value: string) => {
    for (let index = 0; index < value.length; index++) {
        const unit = value.charCodeAt(index);
        if (unit === 0 || unit >= 0xdc00 && unit <= 0xdfff) return false;
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(++index);
            if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
        }
    }
    return true;
};

export function boundedRegistryPurgeIntent(ops: any): RegistryPurgeIntent | null {
    try {
        if (!Array.isArray(ops) || ops.length < 4) return null;
        const encoded = JSON.stringify(ops);
        if (encoded.length > REGISTRY_PURGE_MAX_BYTES || new TextEncoder().encode(encoded).byteLength > REGISTRY_PURGE_MAX_BYTES) return null;
        const intent = parseRegistryPurgeIntent(ops);
        if (!intent?.consumption || intent.receipts.some(receipt => receipt.v !== 2
            || Object.values(receipt).some(value => typeof value === 'string' && !protocolText(value)))) return null;
        return intent;
    } catch (error) { return null; }
}

function jsonbTextBytes(value): number {
    if (Array.isArray(value)) return 2 + value.reduce((sum, item) => sum + jsonbTextBytes(item), 0) + 2 * Math.max(0, value.length - 1);
    if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        return 2 + keys.reduce((sum, key) => sum + new TextEncoder().encode(JSON.stringify(key)).byteLength + 2 + jsonbTextBytes(value[key]), 0) + 2 * Math.max(0, keys.length - 1);
    }
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function slotRegistryPurgeIntent(ops: any): RegistryPurgeIntent | null {
    const intent = boundedRegistryPurgeIntent(ops);
    try {
        return intent?.shape === 'slot' && jsonbTextBytes(intent.consumption) <= REGISTRY_PURGE_CONSUMPTION_MAX_BYTES ? intent : null;
    } catch (error) { return null; }
}

export function registryPurgeRowOps(ops: any): any[] | null {
    const intent = boundedRegistryPurgeIntent(ops);
    if (!intent) return null;
    const copy = JSON.parse(JSON.stringify(ops));
    if (intent.shape === 'row') return copy;
    const consumption = { ...intent.consumption };
    delete consumption.first; delete consumption.members; delete consumption.keys;
    return [{ k: 'set', p: [TRASH_ROOT, intent.sourceId], v: null }, { k: 'set', p: [TRASH_CONSUMPTIONS_ROOT, intent.sourceId], v: consumption },
        ...copy.filter(op => op.p[0] === 'zoew_barcode_registry' || op.p[0] === REGISTRY_RELEASES_ROOT)];
}

export function registryPurgeBindingPreimage(ops: any): string | null {
    const intent = boundedRegistryPurgeIntent(ops);
    if (!intent) return null;
    const receipts = intent.receipts.slice().sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
    const first = receipts[0];
    return JSON.stringify(['zoew-registry-purge-v1', 2, intent.sourceId, first.generation, first.releasedBy, first.scope,
        first.deletedAt, first.rowBirth, first.rowCount, receipts.map(receipt => [receipt.id, receipt.kind, receipt.actorUid,
            receipt.code, receipt.registryKey, receipt.birth, receipt.slot])]);
}

export async function registryPurgeBindingHash(ops: any): Promise<string | null> {
    const preimage = registryPurgeBindingPreimage(ops);
    if (preimage === null) return null;
    try {
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(preimage));
        return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) { return null; }
}
