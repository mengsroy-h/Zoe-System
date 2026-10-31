export const TRASH_CONSUMPTIONS_ROOT = 'zoew_trash_consumptions';
export const TRASH_GENERATION_MAX = 9007199254740990;
export type TrashConsumption = {
    v: 1; sourceId: string; generation: number; kind: 'restore' | 'purge'; actorUid: string;
    scope: string; deletedAt: number; rowBirth: number; token?: string; targetId?: string;
};

const COMMON = ['v', 'sourceId', 'generation', 'kind', 'actorUid', 'scope', 'deletedAt', 'rowBirth'];
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum && value <= TRASH_GENERATION_MAX;
const text = (value, maximum = 2048) => typeof value === 'string' && value.length > 0 && value.length <= maximum;
const id = value => text(value, 128) && /^[a-zA-Z0-9_-]+$/.test(value);

export function trashGenerationOf(item): number | null {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (!Object.prototype.hasOwnProperty.call(item, 'trashGeneration')) return 0;
    return integer(item.trashGeneration) ? item.trashGeneration : null;
}

export function trashConsumptionValid(value): value is TrashConsumption {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const fields = value.kind === 'restore' ? [...COMMON, 'token', 'targetId'] : COMMON;
    return Object.keys(value).length === fields.length && fields.every(key => Object.prototype.hasOwnProperty.call(value, key))
        && value.v === 1 && id(value.sourceId) && integer(value.generation) && text(value.actorUid) && text(value.scope)
        && integer(value.deletedAt, 1) && integer(value.rowBirth)
        && (value.kind === 'purge' || value.kind === 'restore' && text(value.token) && id(value.targetId));
}

export function trashConsumptionSame(expected, actual) {
    return trashConsumptionValid(expected) && trashConsumptionValid(actual)
        && Object.keys(expected).every(key => expected[key] === actual[key]) && Object.keys(expected).length === Object.keys(actual).length;
}

export function trashConsumptionOf(item, kind: 'restore' | 'purge', owner: { uid: string; scope: string }, token?: string, targetId?: string): TrashConsumption | null {
    const generation = trashGenerationOf(item);
    const rowBirth = item && Object.prototype.hasOwnProperty.call(item, 'createdAt') ? item.createdAt : 0;
    const value = { v: 1, sourceId: item?.id, generation, kind, actorUid: owner?.uid, scope: owner?.scope, deletedAt: item?.deletedAt, rowBirth,
        ...(kind === 'restore' ? { token, targetId } : {}) };
    return trashConsumptionValid(value) ? value : null;
}

export function trashSourceUnconsumed(item, receipt) {
    const generation = trashGenerationOf(item);
    if (generation === null || !id(item?.id)) return false;
    if (receipt === null) return generation === 0 || generation === 1;
    return trashConsumptionValid(receipt) && receipt.sourceId === item.id && receipt.generation < TRASH_GENERATION_MAX
        && generation === receipt.generation + 1;
}
