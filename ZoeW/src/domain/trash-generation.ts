export const TRASH_CONSUMPTIONS_ROOT = 'zoew_trash_consumptions';
export const TRASH_GENERATION_MAX = 9007199254740990;
export type PurgeMember = { o: number; id: string; p?: string; n?: string };
export type PurgeCertificate = { first: string; members: Record<string, PurgeMember>; keys: Record<string, string> };
export type TrashConsumption = {
    v: 1; sourceId: string; generation: number; kind: 'restore' | 'purge'; actorUid: string;
    scope: string; deletedAt: number; rowBirth: number; token?: string; targetId?: string;
} & Partial<PurgeCertificate>;

const COMMON = ['v', 'sourceId', 'generation', 'kind', 'actorUid', 'scope', 'deletedAt', 'rowBirth'];
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum && value <= TRASH_GENERATION_MAX;
const text = (value, maximum = 2048) => typeof value === 'string' && value.length > 0 && value.length <= maximum;
const id = value => text(value, 128) && /^[a-zA-Z0-9_-]+$/.test(value);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const CERTIFICATE = ['first', 'members', 'keys'];
const SLOT_RE = /^(0|[1-9][0-9]{0,8})$/;
const RELEASE_RE = /^(scan|release)_[a-f0-9]{32}$/;
const indexedMap = value => Array.isArray(value)
    ? Object.fromEntries(value.map((item, index) => [String(index), item]).filter(([, item]) => item !== null && item !== undefined)) : value;

function storedConsumption(value) {
    if (!plain(value) || value.kind !== 'purge' || !CERTIFICATE.some(key => Object.prototype.hasOwnProperty.call(value, key))) return value;
    const out = { ...value };
    if (Object.prototype.hasOwnProperty.call(out, 'members')) out.members = indexedMap(out.members);
    if (Object.prototype.hasOwnProperty.call(out, 'keys')) out.keys = indexedMap(out.keys);
    return out;
}

export function purgeCertificateOf(entries: Array<{ slot: string; id: string; registryKey: string }>): PurgeCertificate | null {
    if (!Array.isArray(entries) || !entries.length) return null;
    const ordered = entries.slice().sort((left, right) => Number(left.slot) - Number(right.slot));
    const members: Record<string, PurgeMember> = {}, keys: Record<string, string> = {};
    ordered.forEach((entry, index) => {
        members[entry.slot] = { o: index, id: entry.id, ...(index ? { p: ordered[index - 1].slot } : {}), ...(index < ordered.length - 1 ? { n: ordered[index + 1].slot } : {}) };
        keys[entry.registryKey] = entry.id;
    });
    const certificate = { first: ordered[0].slot, members, keys };
    return certificateValid(certificate) ? certificate : null;
}

function certificateValid(value) {
    if (!plain(value?.members) || !plain(value?.keys) || typeof value.first !== 'string') return false;
    const slots = Object.keys(value.members), keys = Object.keys(value.keys);
    if (!slots.length || slots.length !== keys.length || slots.some(slot => !SLOT_RE.test(slot))) return false;
    const ordered = slots.slice().sort((left, right) => Number(left) - Number(right)), ids = new Set<string>();
    for (let index = 0; index < ordered.length; index++) {
        const member = value.members[ordered[index]];
        const expected = ['o', 'id', ...(index ? ['p'] : []), ...(index < ordered.length - 1 ? ['n'] : [])];
        if (!plain(member) || Object.keys(member).length !== expected.length || !expected.every(key => Object.prototype.hasOwnProperty.call(member, key))
            || member.o !== index || typeof member.id !== 'string' || !RELEASE_RE.test(member.id) || ids.has(member.id)
            || index && member.p !== ordered[index - 1] || index < ordered.length - 1 && member.n !== ordered[index + 1]) return false;
        ids.add(member.id);
    }
    return value.first === ordered[0] && keys.every(key => text(key, 768) && ids.has(value.keys[key]))
        && new Set(keys.map(key => value.keys[key])).size === ids.size;
}

function sameJson(left, right) {
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right) || !plain(left) || !plain(right)) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameJson(left[key], right[key]));
}

export function trashGenerationOf(item): number | null {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (!Object.prototype.hasOwnProperty.call(item, 'trashGeneration')) return 0;
    return integer(item.trashGeneration) ? item.trashGeneration : null;
}

export function trashConsumptionValid(value): value is TrashConsumption {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    value = storedConsumption(value);
    const certified = value.kind === 'purge' && CERTIFICATE.some(key => Object.prototype.hasOwnProperty.call(value, key));
    const fields = value.kind === 'restore' ? [...COMMON, 'token', 'targetId'] : certified ? [...COMMON, ...CERTIFICATE] : COMMON;
    return Object.keys(value).length === fields.length && fields.every(key => Object.prototype.hasOwnProperty.call(value, key))
        && value.v === 1 && id(value.sourceId) && integer(value.generation) && text(value.actorUid) && text(value.scope)
        && integer(value.deletedAt, 1) && integer(value.rowBirth)
        && (value.kind === 'purge' && (!certified || certificateValid(value)) || value.kind === 'restore' && text(value.token) && id(value.targetId));
}

export function trashConsumptionSame(expected, actual) {
    return trashConsumptionValid(expected) && trashConsumptionValid(actual) && sameJson(storedConsumption(expected), storedConsumption(actual));
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
