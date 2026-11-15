import { assertPickupResetApplied, pickupResetBatchPreimage, pickupResetCasOf, pickupResetContextOf,
    pickupResetReceiptOf, preservePickupResetApplied } from '../../../../ZoeW/src/domain/pickup-reset-proof';
import type { PickupResetAppliedReceipt, PickupResetContext } from '../../../../ZoeW/src/domain/pickup-reset-proof';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false;
type Cas = NonNullable<ReturnType<typeof pickupResetCasOf>>;

export type ContextInputIsUnknown = Assert<IsUnknown<Parameters<typeof pickupResetContextOf>[0]>>;
export type ReceiptInputIsUnknown = Assert<IsUnknown<Parameters<typeof pickupResetReceiptOf>[0]>>;
export type AppliedRecordInputIsUnknown = Assert<IsUnknown<Parameters<typeof assertPickupResetApplied>[0]>>;
export type CasInputIsUnknown = Assert<IsUnknown<Parameters<typeof pickupResetCasOf>[0]>>;
export type CasOperationIsNotAny = Assert<IsAny<Cas['operation']> extends false ? true : false>;
export type CasPathIsNotAny = Assert<IsAny<Cas['operation']['p']> extends false ? true : false>;
export type CasBasisIsNotAny = Assert<IsAny<Cas['operation']['x']> extends false ? true : false>;
export type CasBasisAllowsLegacyNull = Assert<null extends Cas['operation']['x'] ? true : false>;
export type CasRevisionIsNotAny = Assert<IsAny<Cas['beforeRevision']> extends false ? true : false>;
export type CasRevisionRejectsText = Assert<string extends Cas['beforeRevision'] ? false : true>;
export type CasDesiredRejectsText = Assert<string extends Cas['operation']['v']['pickupRevision'] ? false : true>;
export type ContextRejectsTextVersion = Assert<(Omit<PickupResetContext, 'v'> & { v: string }) extends PickupResetContext ? false : true>;
export type ReceiptRejectsUnknownOutcome = Assert<(Omit<PickupResetAppliedReceipt, 'outcome'> & { outcome: 'unknown' }) extends PickupResetAppliedReceipt ? false : true>;

export function unknownProofInput(value: unknown) {
    const context = pickupResetContextOf(value);
    if (context) {
        const canonical: PickupResetContext = context;
        const scope: string = canonical.scope;
        return scope;
    }
    return null;
}

export function actualResetContract(value: unknown) {
    const parsed = pickupResetCasOf(value);
    if (!parsed) return null;
    const root: 'zoew_daily_pickup_cod_dod' = parsed.operation.p[0];
    const date: string = parsed.operation.p[1];
    const afterRevision: number = parsed.operation.v.pickupRevision;
    if (parsed.operation.x) {
        const legacyRevision: number | undefined = parsed.operation.x.pickupRevision;
        return legacyRevision;
    }
    const proof = assertPickupResetApplied(parsed.operation.x);
    const preserved = preservePickupResetApplied(proof, { pickupRevision: afterRevision, pickupResetEpoch: parsed.afterEpoch });
    const revision: number = preserved.pickupRevision;
    return { root, date, revision, preimage: pickupResetBatchPreimage(value, value, value, value, value) };
}
