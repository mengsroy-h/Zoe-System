export interface LedgerTotals {
    codDollar: number;
    dodDollar: number;
    totalCount: number;
}

export interface LedgerDelta {
    cod: number;
    dod: number;
    count: number;
}

export interface LedgerDeductionInput extends LedgerDelta {
    at: number;
    back?: boolean;
    undo?: boolean;
}

export interface LedgerDeduction extends LedgerDelta {
    at: number;
    back: boolean;
    undo: boolean;
}

export interface LedgerDeductionRecord extends LedgerDelta {
    at: number;
    back?: true;
    undo?: true;
}

export interface LedgerBucketView extends Partial<LedgerTotals> {
    op?: string;
    ops?: Record<string, number>;
    ded?: Record<string, unknown>;
}

export interface PickupDayView {
    packagesPickedUp?: number;
    pickedUpPhones?: Record<string, number> | null;
    pickedUpBarcodes?: Record<string, string> | null;
    pickupRevision?: number;
    pickupResetEpoch?: number;
    pickupResetApplied?: unknown;
    restoreGuard?: unknown;
}

export interface PickupMark {
    key: string;
    phoneKey: string | null;
    closed: boolean;
}

export interface CollectedAmountView {
    c?: number;
    d?: number;
}

export interface CollectedAmount {
    c: number;
    d: number;
}

export type CollectedDayView = Partial<Record<string, CollectedAmountView>>;

export interface CollectedMark {
    key: string;
    day: string;
    value: CollectedAmount | null;
}

export type CollectedMarkBatch = CollectedMark[] & { server: Promise<boolean | null> };

export type PickupResetContext = {
    v: 1;
    scope: string;
    batchId: string;
    batchHash: string;
    dayId: string;
    day: string;
    nonce: string;
};

export type PickupResetAppliedReceipt = {
    v: 1;
    outcome: 'applied';
    proof: 'operation' | 'native-day';
    tenant: string;
    actorUid: string;
    scope: string;
    batchId: string;
    batchHash: string;
    dayId: string;
    day: string;
    nonce: string;
    attemptId: string;
    intentHash: string;
    beforeRevision: number;
    beforeEpoch: number;
    afterRevision: number;
    afterEpoch: number;
};

export interface PickupRestoreGuard {
    v: 1;
    sourceId: string;
    token: string;
    targetId: string;
    finalizedAt: number;
    generation: number;
    deletedAt: number;
    rowBirth: number;
    actorUid: string;
    scope: string;
    phone: string;
    phoneKey: string;
    date: string;
    epoch: number;
    target: {
        slot: string;
        key: string;
        code: string;
        birth: number;
        restored: number;
        closedAt: number;
        scanIntent: string;
    };
}
