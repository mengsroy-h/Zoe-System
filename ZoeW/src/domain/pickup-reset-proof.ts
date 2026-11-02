export const PICKUP_RESET_APPLIED_FIELD = 'pickupResetApplied';
const MAX = Number.MAX_SAFE_INTEGER - 1;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HASH = /^[a-f0-9]{64}$/;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names: string[]) => object(value) && Object.keys(value).length === names.length && names.every(key => own(value, key));
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum && value <= MAX;
const text = (value) => typeof value === 'string' && value.length > 0 && !/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
const hashText = value => typeof value === 'string' && HASH.test(value);

export type PickupResetContext = { v: 1; scope: string; batchId: string; batchHash: string; dayId: string; day: string; nonce: string };
export type PickupResetAppliedReceipt = { v: 1; outcome: 'applied'; proof: 'operation' | 'native-day'; tenant: string; actorUid: string;
    scope: string; batchId: string; batchHash: string; dayId: string; day: string; nonce: string; attemptId: string; intentHash: string;
    beforeRevision: number; beforeEpoch: number; afterRevision: number; afterEpoch: number };

export function pickupResetContextOf(value): PickupResetContext | null {
    return keys(value, ['v', 'scope', 'batchId', 'batchHash', 'dayId', 'day', 'nonce']) && value.v === 1
        && ['scope', 'batchId', 'dayId', 'day', 'nonce'].every(key => text(value[key])) && hashText(value.batchHash)
        && DATE.test(value.day) && value.dayId === value.batchId + ':' + value.day ? value : null;
}

export function pickupResetReceiptOf(value): PickupResetAppliedReceipt | null {
    if (!keys(value, ['v', 'outcome', 'proof', 'tenant', 'actorUid', 'scope', 'batchId', 'batchHash', 'dayId', 'day', 'nonce',
        'attemptId', 'intentHash', 'beforeRevision', 'beforeEpoch', 'afterRevision', 'afterEpoch']) || value.v !== 1
        || value.outcome !== 'applied' || !['operation', 'native-day'].includes(value.proof)
        || !['tenant', 'actorUid', 'scope', 'batchId', 'dayId', 'day', 'nonce'].every(key => text(value[key]))
        || !hashText(value.batchHash) || !hashText(value.attemptId) || value.intentHash !== value.attemptId
        || !DATE.test(value.day) || value.dayId !== value.batchId + ':' + value.day
        || !integer(value.beforeRevision) || !integer(value.beforeEpoch) || !integer(value.afterRevision, 1) || !integer(value.afterEpoch, 1)
        || value.beforeRevision === 0 && value.beforeEpoch !== 0
        || value.afterRevision !== value.beforeRevision + 1 || value.afterEpoch !== value.beforeEpoch + 1) return null;
    return value;
}

export function assertPickupResetApplied(record): PickupResetAppliedReceipt | undefined {
    if (!record || !own(record, PICKUP_RESET_APPLIED_FIELD)) return;
    const proof = pickupResetReceiptOf(record[PICKUP_RESET_APPLIED_FIELD]);
    if (!proof || !integer(record.pickupRevision, 1) || !integer(record.pickupResetEpoch)
        || proof.afterRevision > record.pickupRevision || proof.afterEpoch !== record.pickupResetEpoch) {
        throw new Error('PICKUP_RESET_PROOF_INVALID');
    }
    return proof;
}

export function preservePickupResetApplied(previous, next) {
    const proof = assertPickupResetApplied(previous);
    if (!proof) return next;
    if (!integer(next.pickupRevision, 1) || proof.afterRevision > next.pickupRevision || next.pickupResetEpoch !== proof.afterEpoch) {
        throw new Error('PICKUP_RESET_PROOF_INVALID');
    }
    return { ...next, [PICKUP_RESET_APPLIED_FIELD]: { ...proof } };
}

function jsonScalarsValid(value) {
    const queue = [value];
    while (queue.length) {
        const node = queue.pop();
        if (typeof node === 'string' ? !text(node) && node !== '' : typeof node === 'number' ? !Number.isFinite(node) : false) return false;
        if (node && typeof node === 'object') {
            for (const [key, child] of Object.entries(node)) {
                if (!text(key) && key !== '') return false;
                queue.push(child);
            }
        }
    }
    return true;
}

export function pickupResetCasOf(casText) {
    if (typeof casText !== 'string') return null;
    try {
        const operation = JSON.parse(casText);
        if (!keys(operation, ['k', 'p', 'x', 'v']) || operation.k !== 'cas' || !Array.isArray(operation.p)
            || operation.p.length !== 2 || operation.p[0] !== 'zoew_daily_pickup_cod_dod' || typeof operation.p[1] !== 'string' || !DATE.test(operation.p[1])
            || operation.x !== null && !object(operation.x) || !jsonScalarsValid(operation)) return null;
        const before = operation.x;
        const legacy = before === null || before.pickupRevision === undefined && before.pickupResetEpoch === undefined;
        const beforeRevision = legacy ? 0 : before.pickupRevision, beforeEpoch = legacy ? 0 : before.pickupResetEpoch;
        if (!integer(beforeRevision, legacy ? 0 : 1) || !integer(beforeEpoch) || beforeRevision >= MAX || beforeEpoch >= MAX) return null;
        assertPickupResetApplied(before);
        const desired = operation.v;
        if (!keys(desired, ['pickupRevision', 'pickupResetEpoch', 'packagesPickedUp', 'pickedUpPhones', 'pickedUpBarcodes'])
            || desired.pickupRevision !== beforeRevision + 1 || desired.pickupResetEpoch !== beforeEpoch + 1
            || desired.packagesPickedUp !== 0 || desired.pickedUpPhones !== null || desired.pickedUpBarcodes !== null) return null;
        return { operation, day: operation.p[1], beforeRevision, beforeEpoch, afterRevision: desired.pickupRevision, afterEpoch: desired.pickupResetEpoch };
    } catch (error) { return null; }
}

export function pickupResetCasText(day, basis, desired): string | null {
    try {
        const encoded = JSON.stringify({ k: 'cas', p: ['zoew_daily_pickup_cod_dod', day], x: basis === undefined ? null : basis, v: desired });
        return pickupResetCasOf(encoded) ? encoded : null;
    } catch (error) { return null; }
}

export function pickupResetBatchPreimage(tenant, scope, actorUid, batchId, orderedDates): string | null {
    if (![tenant, scope, actorUid, batchId].every(text) || !Array.isArray(orderedDates) || !orderedDates.length
        || orderedDates.some(day => typeof day !== 'string' || !DATE.test(day)) || new Set(orderedDates).size !== orderedDates.length) return null;
    return JSON.stringify(['zoew-pickup-reset-batch-v1', 1, tenant, scope, actorUid, batchId, orderedDates]);
}

export function pickupResetAttemptPreimage(tenant, actorUid, context, casText): string | null {
    const bound = pickupResetContextOf(context), cas = pickupResetCasOf(casText);
    if (![tenant, actorUid].every(text) || !bound || !cas || cas.day !== bound.day) return null;
    return JSON.stringify(['zoew-pickup-reset-attempt-v1', 1, tenant, actorUid, bound.scope, bound.batchId, bound.batchHash,
        bound.dayId, bound.day, bound.nonce, casText]);
}

async function hash(preimage: string | null): Promise<string | null> {
    if (preimage === null) return null;
    try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(preimage));
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) { return null; }
}

export function pickupResetBatchHash(tenant, scope, actorUid, batchId, orderedDates): Promise<string | null> {
    return hash(pickupResetBatchPreimage(tenant, scope, actorUid, batchId, orderedDates));
}

export function pickupResetAttemptId(tenant, actorUid, context, casText): Promise<string | null> {
    return hash(pickupResetAttemptPreimage(tenant, actorUid, context, casText));
}

export function pickupResetAppliedReceipt(tenant, actorUid, context, attemptId, casText, proof: 'operation' | 'native-day'): PickupResetAppliedReceipt | null {
    const bound = pickupResetContextOf(context), cas = pickupResetCasOf(casText);
    if (![tenant, actorUid].every(text) || !bound || !cas || cas.day !== bound.day || !hashText(attemptId)) return null;
    return pickupResetReceiptOf({ v: 1, outcome: 'applied', proof, tenant, actorUid, scope: bound.scope, batchId: bound.batchId,
        batchHash: bound.batchHash, dayId: bound.dayId, day: bound.day, nonce: bound.nonce, attemptId, intentHash: attemptId,
        beforeRevision: cas.beforeRevision, beforeEpoch: cas.beforeEpoch, afterRevision: cas.afterRevision, afterEpoch: cas.afterEpoch });
}

export function pickupResetReceiptMatches(actual, expected): boolean {
    const left = pickupResetReceiptOf(actual), right = pickupResetReceiptOf(expected);
    return !!left && !!right && Object.keys(right).every(key => left[key] === right[key]);
}

export async function pickupResetBoundReceipt(tenant, actorUid, context, attemptId, casText, proof: 'operation' | 'native-day'): Promise<PickupResetAppliedReceipt | null> {
    const original = pickupResetContextOf(context);
    if (!original) return null;
    const snapshot = { ...original };
    if (await pickupResetAttemptId(tenant, actorUid, snapshot, casText) !== attemptId) return null;
    return pickupResetAppliedReceipt(tenant, actorUid, snapshot, attemptId, casText, proof);
}
