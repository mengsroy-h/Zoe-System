import { canonicalBarcodeRegistryKey } from './barcode-key';
import { TRASH_CONSUMPTIONS_ROOT, trashConsumptionSame, type TrashConsumption } from './trash-generation';

export const REGISTRY_RELEASES_ROOT = 'zoew_registry_releases';
export const REGISTRY_PURGE_MAX_WRITES = 500;
export const REGISTRY_PURGE_MAX_BYTES = 4 * 1024 * 1024;
export type RegistryPurgeReceipt = {
    v: 1 | 2; generation?: number; id: string; kind: 'scan' | 'legacy'; actorUid: string; releasedBy: string; scope: string;
    code: string; registryKey: string; birth: number; trashId: string; slot: string;
    deletedAt: number; rowBirth: number; rowCount: number;
};
export type RegistryPurgeIntent = { sourceId: string; receipts: RegistryPurgeReceipt[]; consumption?: TrashConsumption };

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
    const sources = [...entries].filter(([path, value]) => path.startsWith('zoew_recently_deleted_cod_dod/') && path.split('/').length === 2 && value === null);
    if (sources.length !== 1) return null;
    const sourceId = sources[0][0].split('/')[1];
    const receipts = [...entries].filter(([path]) => path.startsWith(REGISTRY_RELEASES_ROOT + '/')).map(([path, value]) => ({ path, value }));
    if (!receipts.length || receipts.some(({ value }) => value?.rowCount !== receipts.length)) return null;
    const keys = new Set<string>(), slots = new Set<string>();
    const first = receipts[0].value;
    const consumption = entries.get(TRASH_CONSUMPTIONS_ROOT + '/' + sourceId);
    if (entries.size !== (first?.v === 2 ? 2 : 1) + 2 * receipts.length) return null;
    if (first?.v === 2 && !trashConsumptionSame({ v: 1, sourceId, generation: first.generation, kind: 'purge',
        actorUid: first.releasedBy, scope: first.scope, deletedAt: first.deletedAt, rowBirth: first.rowBirth }, consumption)) return null;
    for (const { path, value } of receipts) {
        if (!registryPurgeReceiptValid(value) || path !== REGISTRY_RELEASES_ROOT + '/' + value.id || value.trashId !== sourceId
            || keys.has(value.registryKey) || slots.has(value.slot) || entries.get('zoew_barcode_registry/' + value.registryKey) !== null
            || !['v', 'generation', 'releasedBy', 'scope', 'deletedAt', 'rowBirth', 'rowCount'].every(key => value[key] === first[key])) return null;
        keys.add(value.registryKey); slots.add(value.slot);
    }
    return { sourceId, receipts: receipts.map(({ value }) => value), ...(first.v === 2 ? { consumption } : {}) };
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
