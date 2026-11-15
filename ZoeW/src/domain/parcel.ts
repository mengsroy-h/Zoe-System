export type PriceOperationPhase = 'admitted' | 'history' | 'cancelling' | 'settled';
export type PriceOperationOutcome = 'committed' | 'compensated';

export interface PriceOperationMarker {
    token: string;
    actorUid: string;
    code: string;
    slot: string;
    birth: number;
    rowBirth: number;
    scanDate: string;
    priorCod: number;
    priorDod: number;
    wantCod: number;
    wantDod: number;
    phase: PriceOperationPhase;
    outcome?: PriceOperationOutcome;
}

export interface ScanPendingMarker {
    intent: string;
    actorUid: string;
    code: string;
    birth: number;
    slot: string;
    payloadHash: string;
}

export interface PickupTransition {
    intent: string;
    actorUid: string;
    scope: string;
    scanDate: string;
    itemId: string;
    code: string;
    epoch: number;
    birth: number;
    restored: number;
    closed: boolean;
    closedAt: number;
    changes: number;
}

export interface ParcelBarcode {
    code?: string;
    cod?: number;
    dod?: number;
    locker?: string;
    isClosed?: boolean;
    isDeducted?: boolean;
    isFromDeletion?: boolean;
    time?: string;
    createdAt?: number;
    closedAt?: number;
    lockerUpdatedAt?: number;
    lockerUpdatedBy?: string;
    lockerRevision?: number;
    trashClaim?: string;
    trashClaimAt?: number;
    pickupTransition?: PickupTransition;
    restoredAt?: number;
    ztoSignedAt?: number;
    ztoReturnedAt?: number;
    ztoMisplacedAt?: number;
    ztoSentOutAt?: number;
    ztoSignedExact?: boolean;
    scanIntent?: string;
}

export interface ParcelRow {
    id?: string;
    cod?: number;
    dod?: number;
    price?: number;
    count?: number;
    phone?: string;
    barcode?: string;
    locker?: string;
    isClosed?: boolean;
    isCalled?: boolean;
    callMark?: string;
    callMarkTime?: number;
    createdAt?: number;
    closedAt?: number;
    scanDate?: string;
    time?: string;
    lockerUpdatedAt?: number;
    lockerUpdatedBy?: string;
    lockerRevision?: number;
    barcodes?: ParcelBarcode[];
    restoreClaimId?: string;
    restoreClaimToken?: string;
    restoreAddedCodes?: string;
    clearClaim?: { token: string; claimedAt: number; trashGeneration?: number; deletedAt?: number };
    origins?: Record<string, string>;
    scanPending?: Partial<ScanPendingMarker> & Record<string, unknown>;
    pricePending?: Partial<Omit<PriceOperationMarker, 'phase' | 'outcome'>> & { phase?: string; outcome?: string };
    restoredAt?: number;
}

export interface ParcelRestoreClaim {
    token: string;
    claimedAt: number;
    targetId?: string;
}

export type LegacyRestoreClaimString = string & { token?: never; claimedAt?: never; targetId?: never };
export type ParcelRestoreClaimView = Partial<ParcelRestoreClaim> | LegacyRestoreClaimString;

export interface DeletedParcelRow extends ParcelRow {
    deletedAt?: number;
    isFromDeletion?: boolean;
    trashReason?: string;
    restoreClaim?: ParcelRestoreClaimView;
    trashMode?: string;
    restoreBlocked?: boolean;
    trashGeneration?: number;
    restoreAttestationId?: string;
    restorePublication?: number;
    ztoTerminalDecision?: 'signed' | 'returned';
}
