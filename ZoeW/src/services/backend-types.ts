import type { DeletedParcelRow, ParcelRow } from '../domain/parcel';
import type { CollectedDayView, LedgerBucketView, PickupDayView, PickupResetAppliedReceipt, PickupResetContext } from '../domain/statistics';

export interface BackendConfig {
    apiKey?: string;
    authDomain?: string;
    databaseURL?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    measurementId?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
    loginDomain?: string;
}

export interface BackendApp {
    readonly name: string;
    readonly options: BackendConfig;
}

export interface BackendTokenResult {
    token: string;
    claims: Record<string, unknown>;
    authTime: string;
    issuedAtTime: string;
    expirationTime: string;
    signInProvider: string | null;
    signInSecondFactor: string | null;
}

export interface BackendUser {
    readonly uid: string;
    readonly email: string | null;
    getIdToken(forceRefresh?: boolean): Promise<string>;
    getIdTokenResult?(forceRefresh?: boolean): Promise<BackendTokenResult>;
}

export interface BackendAccount {
    tenant_id: string;
    tenant_name?: string;
    branch_code?: string;
    username?: string;
    status?: 'active' | 'expired' | 'revoked';
    expires_at?: string;
}

export interface BackendAuth {
    readonly app: BackendApp;
    currentUser: BackendUser | null;
    readonly _account?: BackendAccount | null;
    readonly _accountUnverified?: boolean;
    readonly _transport?: BackendTransport;
}

export interface BackendTransport {
    rpc<T = unknown>(name: string, args: Record<string, unknown>, timeoutMs?: number,
        options?: { observational?: boolean; current?: () => boolean; deadline?: number; signal?: AbortSignal }): Promise<T>;
}

export interface BackendEvidenceAuth {
    currentUser: unknown;
    _account: unknown;
    _transport: BackendTransport;
}

export interface BackendRecoveryState {
    blocked: number;
    recovering: boolean;
    pending: number;
}

export interface BackendDatabaseFeatures {
    readonly app?: BackendApp;
    readonly _sb?: boolean;
    recoveryState?(): BackendRecoveryState;
    retryWriteRecovery?(): Promise<unknown>;
    discardPendingWrites?(): Promise<{ count: number; paths: string[]; failed?: number }>;
}

export type BackendDatabase = BackendDatabaseFeatures & ({ readonly app: BackendApp } | { readonly _sb: true });

export interface BackendReference<T = unknown> {
    readonly key: string | null;
    readonly parent: BackendReference | null;
    readonly root: BackendReference;
    readonly __valueType?: T;
    toString(): string;
}

export interface BackendSnapshot<T = unknown> {
    readonly key: string | null;
    readonly ref: BackendReference<T> | null;
    readonly serverClockSample?: unknown;
    val(): T | null;
    exists(): boolean;
    child(path: string): BackendSnapshot;
    hasChild(path: string): boolean;
    hasChildren(): boolean;
    forEach(callback: (child: BackendSnapshot) => boolean | void): boolean;
}

export interface BackendTransactionResult<T = unknown> {
    committed: boolean;
    snapshot: BackendSnapshot<T>;
    txOutcome?: 'applied' | 'not-applied' | 'unknown';
    txProven?: boolean;
}

export interface BackendPickupResetRequest {
    tenant: string;
    actorUid: string;
    context: PickupResetContext;
    attemptId: string;
    casText: string;
}

export interface BackendPickupResetResult {
    committed: boolean;
    snapshot?: BackendSnapshot;
    pickupReset?: PickupResetAppliedReceipt | null;
    txOutcome?: 'applied' | 'not-applied' | 'unknown';
}

export interface BackendFunctionResponse {
    status: number;
    body: Record<string, unknown>;
}

export interface BackendFinalization {
    token?: string;
}

type BackendIndex<T, Key extends string> = T extends null | undefined ? never : T extends readonly (infer Item)[]
    ? Key extends `${number}` ? Item : Key extends keyof T ? T[Key] : unknown
    : Key extends keyof T ? T[Key] : unknown;

export type BackendChildValue<T, Path extends string> = Path extends `${infer Key}/${infer Rest}`
    ? BackendChildValue<BackendIndex<T, Key>, Rest> : NonNullable<BackendIndex<T, Path>>;

type BackendRowPathValue<Row, Path extends string> = Path extends `${string}/${infer Rest}` ? BackendChildValue<Row, Rest> : Row;

export type BackendKnownPath =
    | 'zoew_scan_history_cod_dod' | `zoew_scan_history_cod_dod/${string}`
    | 'zoew_recently_deleted_cod_dod' | `zoew_recently_deleted_cod_dod/${string}`
    | 'zoew_daily_revenue_cod_dod' | `zoew_daily_revenue_cod_dod/${string}`
    | 'zoew_monthly_revenue_cod_dod' | `zoew_monthly_revenue_cod_dod/${string}`
    | 'zoew_daily_pickup_cod_dod' | `zoew_daily_pickup_cod_dod/${string}`
    | 'zoew_daily_collected_cod_dod' | `zoew_daily_collected_cod_dod/${string}`
    | `zoew_clear_history_finalizations/${string}` | `zoew_restore_finalizations/${string}`
    | 'zoew_settings/exchange_rate' | '.info/connected' | '.info/serverTimeOffset';

export type BackendPathValue<P extends BackendKnownPath> =
    P extends 'zoew_scan_history_cod_dod' ? Record<string, ParcelRow>
    : P extends `zoew_scan_history_cod_dod/${infer Path}` ? BackendRowPathValue<ParcelRow, Path>
    : P extends 'zoew_recently_deleted_cod_dod' ? Record<string, DeletedParcelRow>
    : P extends `zoew_recently_deleted_cod_dod/${infer Path}` ? BackendRowPathValue<DeletedParcelRow, Path>
    : P extends 'zoew_daily_revenue_cod_dod' | 'zoew_monthly_revenue_cod_dod' ? Partial<Record<string, LedgerBucketView>>
    : P extends `zoew_daily_revenue_cod_dod/${infer Path}` | `zoew_monthly_revenue_cod_dod/${infer Path}` ? BackendRowPathValue<LedgerBucketView, Path>
    : P extends 'zoew_daily_pickup_cod_dod' ? Partial<Record<string, PickupDayView>>
    : P extends `zoew_daily_pickup_cod_dod/${infer Path}` ? BackendRowPathValue<PickupDayView, Path>
    : P extends 'zoew_daily_collected_cod_dod' ? Partial<Record<string, CollectedDayView>>
    : P extends `zoew_daily_collected_cod_dod/${infer Path}` ? BackendRowPathValue<CollectedDayView, Path>
    : P extends `zoew_clear_history_finalizations/${infer Path}` | `zoew_restore_finalizations/${infer Path}` ? BackendRowPathValue<BackendFinalization, Path>
    : P extends '.info/connected' ? boolean : number;

export interface BackendSignInResult {
    user: BackendUser;
    providerId?: string;
    operationType?: string;
}

export interface BackendPersistence {
    readonly type: string;
}

export interface BackendSdk {
    readonly __supabase?: boolean;
    readonly __connectionOwned?: boolean;
    readonly __txOutcomeResolved?: boolean;
    readonly browserLocalPersistence: BackendPersistence;
    readonly browserSessionPersistence: BackendPersistence;
    initializeApp(config: BackendConfig): BackendApp;
    getApps(): BackendApp[];
    deleteApp(app: BackendApp): Promise<void>;
    getAuth(app: BackendApp): BackendAuth;
    onAuthStateChanged(auth: BackendAuth, callback: (user: BackendUser | null) => void): () => void;
    beforeAuthStateChanged?(auth: BackendAuth, callback: (user: BackendUser | null) => void | Promise<void>): () => void;
    signInWithEmailAndPassword(auth: BackendAuth, email: string, password: string): Promise<BackendSignInResult>;
    signOut(auth: BackendAuth): Promise<void>;
    setPersistence(auth: BackendAuth, persistence: BackendPersistence): Promise<void>;
    getIdTokenResult(user: BackendUser): Promise<BackendTokenResult>;
    getDatabase(app: BackendApp): BackendDatabase;
    ref<Path extends BackendKnownPath>(database: BackendDatabase, path: Path): BackendReference<BackendPathValue<Path>>;
    ref<T = unknown>(database: BackendDatabase, path?: string): BackendReference<T>;
    onValue<T>(reference: BackendReference<T>, callback: (snapshot: BackendSnapshot<T>) => void, onError?: (error: Error) => void): () => void;
    off(reference: BackendReference): void;
    get<T>(reference: BackendReference<T>): Promise<BackendSnapshot<T>>;
    getForHealth?<T>(reference: BackendReference<T>, timeoutMs: number, current: () => boolean, signal?: AbortSignal): Promise<BackendSnapshot<T>>;
    set<T>(reference: BackendReference<T>, value: NoInfer<T> | null): Promise<void>;
    update(reference: BackendReference, values: Record<string, unknown>): Promise<void>;
    runTransaction<T>(reference: BackendReference<T>, update: (current: NoInfer<T> | null) => NoInfer<T> | null | undefined,
        options?: { applyLocally?: boolean }): Promise<BackendTransactionResult<T>>;
    increment(delta: number): object;
    goOnline(database: BackendDatabase): void;
    goOffline(database: BackendDatabase): void;
    tenantScope?(auth: BackendAuth): string;
    accountOf?(auth: BackendAuth): BackendAccount | null;
    resumeAcceptedSession?(auth: BackendAuth): boolean;
    noteDevice?(auth: BackendAuth, metadata: { serial: string; model?: string; platform?: string }): Promise<boolean>;
    evidenceCandidates?(auth: BackendAuth | BackendEvidenceAuth | null, root: string, before: number, limit: number, after?: string | null): Promise<unknown[] | null>;
    registerAccount?(app: BackendApp, body: unknown): Promise<BackendFunctionResponse>;
    resetPassword?(app: BackendApp, body: unknown): Promise<BackendFunctionResponse>;
    setConnectionFlowReporter?(reporter: () => void): void;
    connectionEpoch?(reference: BackendReference): number | null;
    recoveryState?(database: BackendDatabase): BackendRecoveryState;
    retryWriteRecovery?(database: BackendDatabase): Promise<unknown>;
    discardPendingWrites?(database: BackendDatabase): Promise<{ count: number; paths: string[]; failed?: number }> | { count: number; paths: string[]; failed?: number };
    executePickupReset?(reference: BackendReference, request: BackendPickupResetRequest, current?: () => boolean): Promise<BackendPickupResetResult>;
    pickupResetStatus?(reference: BackendReference, request: BackendPickupResetRequest, current?: () => boolean): Promise<{ outcome: 'applied' | 'not-applied' | 'unknown'; pickupReset: PickupResetAppliedReceipt | null }>;
}
