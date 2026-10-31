import { firebaseState } from '../core/state';
import { liveShopScope } from '../core/shop-scope';
import { TRASH_CONSUMPTIONS_ROOT, TRASH_GENERATION_MAX, trashConsumptionValid, type TrashConsumption } from '../domain/trash-generation';
import { dbOp } from './network';
import { txReadServerValue, txRestUrl } from './tx-outcome';

export type TrashGenerationOwner = {
    db: typeof firebaseState.db; sdk: typeof firebaseState.fb; authGeneration: number; uid: string; scope: string;
};

export function captureTrashGenerationOwner(): TrashGenerationOwner | null {
    const owner = { db: firebaseState.db, sdk: firebaseState.fb, authGeneration: firebaseState.authGeneration,
        uid: firebaseState.auth?.currentUser?.uid, scope: liveShopScope() };
    return owner.db && owner.sdk && typeof owner.uid === 'string' && owner.uid.length > 0 && owner.uid.length <= 2048
        && typeof owner.scope === 'string' && owner.scope.length > 0 && owner.scope.length <= 2048 ? owner : null;
}

export function trashGenerationOwnerCurrent(owner: TrashGenerationOwner) {
    return !!owner && owner.db === firebaseState.db && owner.sdk === firebaseState.fb && owner.authGeneration === firebaseState.authGeneration
        && owner.uid === firebaseState.auth?.currentUser?.uid && owner.scope === liveShopScope();
}

export async function readTrashConsumption(sourceId: string, owner: TrashGenerationOwner): Promise<{ ok: true; value: TrashConsumption | null } | { ok: false }> {
    if (!trashGenerationOwnerCurrent(owner) || typeof sourceId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(sourceId)) return { ok: false };
    try {
        const ref = owner.sdk.ref(owner.db, TRASH_CONSUMPTIONS_ROOT + '/' + sourceId), url = txRestUrl(ref);
        const value = url ? await txReadServerValue(url) : (await dbOp(owner.sdk.get(ref))).val();
        if (!trashGenerationOwnerCurrent(owner)) return { ok: false };
        if (value === null) return { ok: true, value: null };
        return trashConsumptionValid(value) && value.sourceId === sourceId && value.scope === owner.scope ? { ok: true, value } : { ok: false };
    } catch (error) { return { ok: false }; }
}

export async function allocateTrashGeneration(sourceId: string, owner: TrashGenerationOwner): Promise<number | null> {
    const result = await readTrashConsumption(sourceId, owner);
    if (!result.ok || !trashGenerationOwnerCurrent(owner)) return null;
    if (result.value === null) return 1;
    return result.value.generation < TRASH_GENERATION_MAX ? result.value.generation + 1 : null;
}
