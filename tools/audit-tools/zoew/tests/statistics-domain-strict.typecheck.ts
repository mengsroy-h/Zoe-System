import type { CollectedAmount, CollectedAmountView, CollectedDayView, LedgerBucketView, LedgerDeduction,
    LedgerDeductionRecord, LedgerTotals, PickupDayView, PickupResetAppliedReceipt, PickupRestoreGuard } from '../../../../ZoeW/src/domain/statistics';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false;

export type LedgerAllowsAbsentLegacyFields = Assert<Record<string, never> extends LedgerBucketView ? true : false>;
export type LedgerRejectsTextMoney = Assert<{ codDollar: string } extends LedgerBucketView ? false : true>;
export type LedgerRejectsObjectCount = Assert<{ totalCount: object } extends LedgerBucketView ? false : true>;
export type MissingLedgerTotalStaysOptional = Assert<undefined extends LedgerBucketView['totalCount'] ? true : false>;
export type NormalizedLedgerTotalsAreComplete = Assert<{ codDollar: number } extends LedgerTotals ? false : true>;
export type LedgerDeductionRemainsUntrusted = Assert<IsUnknown<NonNullable<LedgerBucketView['ded']>[string]>>;
export type NormalizedDeductionHasBooleanFlags = Assert<LedgerDeduction['back'] extends boolean ? true : false>;
export type StoredDeductionDoesNotWriteFalse = Assert<{ at: number; cod: number; dod: number; count: number; back: false } extends LedgerDeductionRecord ? false : true>;
export type PickupAllowsLegacyCountsWithoutKeys = Assert<{ packagesPickedUp: number } extends PickupDayView ? true : false>;
export type PickupRejectsTextCount = Assert<{ packagesPickedUp: string } extends PickupDayView ? false : true>;
export type PickupRejectsBooleanOwners = Assert<{ pickedUpBarcodes: Record<string, true> } extends PickupDayView ? false : true>;
export type PickupProofStaysUntrusted = Assert<IsUnknown<PickupDayView['pickupResetApplied']>>;
export type RestoreProofStaysUntrusted = Assert<IsUnknown<PickupDayView['restoreGuard']>>;
export type ResetProofRequiresAllBindings = Assert<{ v: 1; outcome: 'applied' } extends PickupResetAppliedReceipt ? false : true>;
export type RestoreGuardRequiresTarget = Assert<Omit<PickupRestoreGuard, 'target'> extends PickupRestoreGuard ? false : true>;
export type CollectedAllowsLegacyPartialAmounts = Assert<{ c: number } extends CollectedAmountView ? true : false>;
export type CollectedRejectsTextMoney = Assert<{ c: string } extends CollectedAmountView ? false : true>;
export type NormalizedCollectedAmountIsComplete = Assert<{ c: number } extends CollectedAmount ? false : true>;
export type MissingCollectedEntryStaysOptional = Assert<undefined extends CollectedDayView[string] ? true : false>;

export const legacyLedger: LedgerBucketView = { codDollar: 0 };
export const legacyPickup: PickupDayView = { packagesPickedUp: 3, pickedUpPhones: { customer: 3 } };
export const resetPickup: PickupDayView = { packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null,
    pickupRevision: 2, pickupResetEpoch: 1, pickupResetApplied: { v: 'unverified' } };
export const partialCollected: CollectedDayView = { barcode: { c: 1.5 } };
