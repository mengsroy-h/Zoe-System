import type { BackendAccount, BackendApp, BackendAuth, BackendConfig, BackendDatabaseFeatures, BackendPersistence, BackendPickupResetRequest, BackendPickupResetResult, BackendReference, BackendSdk, BackendSnapshot, BackendTokenResult, BackendTransactionResult, BackendUser } from './backend-types';
import type { createSupabaseTransport } from './supabase-transport';

export interface SupabaseSession {
    accessToken: string;
    user: { id: string; email: string };
}

export interface SupabaseUser extends BackendUser {
    _session: SupabaseSession;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerData: unknown[];
    providerId: string;
}

export interface SupabaseAuth extends BackendAuth {
    app: SupabaseApp;
    currentUser: SupabaseUser | null;
    _transport: ReturnType<typeof createSupabaseTransport>;
    _listeners: Set<(user: SupabaseUser | null) => void>;
    _ready: boolean;
    _account: BackendAccount | null;
    _accountUnverified: boolean;
    _verifyAccount?: () => Promise<string | null>;
    _onChange?: (callback: (user: SupabaseUser | null) => void) => () => void;
    _signIn?: (email: string, password: string) => Promise<{ user: SupabaseUser; providerId: string; operationType: string }>;
    _signOut?: () => Promise<void>;
    _setPersistence?: (persistence: BackendPersistence) => Promise<void>;
    _close?: () => void;
}

export interface SupabaseReference<T = unknown> extends BackendReference<T> {
    _db: SupabaseDatabase;
    _path: string[];
    child(path: string): SupabaseReference;
    isEqual(other: SupabaseReference): boolean;
}

export interface SupabaseDatabase extends BackendDatabaseFeatures {
    readonly _sb: true;
    ref<T = unknown>(path?: string): SupabaseReference<T>;
    onValue<T>(reference: BackendReference<T>, callback: (snapshot: BackendSnapshot<T>) => void, onError?: (error: Error) => void): () => void;
    off(reference: BackendReference): void;
    get<T>(reference: BackendReference<T>): Promise<BackendSnapshot<T>>;
    getForHealth<T>(reference: BackendReference<T>, timeoutMs: number, current: () => boolean): Promise<BackendSnapshot<T>>;
    set<T>(reference: BackendReference<T>, value: NoInfer<T> | null): Promise<void>;
    update(reference: BackendReference, values: Record<string, unknown>): Promise<void>;
    runTransaction<T>(reference: BackendReference<T>, updater: (value: NoInfer<T> | null) => NoInfer<T> | null | undefined): Promise<BackendTransactionResult<T>>;
    executePickupReset(reference: BackendReference, request: BackendPickupResetRequest, current?: () => boolean): Promise<BackendPickupResetResult>;
    pickupResetStatus: NonNullable<BackendSdk['pickupResetStatus']>;
    goOnline(): void;
    goOffline(): void;
    setTenantTopic(topic: string | null): void;
    setAuthed(authed: boolean, scope?: string | null): void;
    resetForSignOut(): void;
    onBrowserOnline(): void;
    onBrowserOffline(): void;
    start(): void;
    close(reason: string): void;
    isReady(): boolean;
    resumeAcceptedSession(): boolean;
    snapshotState(): { cursor: number; docs: Record<string, unknown> };
}

export interface SupabaseApp extends BackendApp {
    options: BackendConfig;
    _transport: ReturnType<typeof createSupabaseTransport>;
    _db: SupabaseDatabase | null;
    _auth: SupabaseAuth | null;
    _tenantTopic: string | null;
    _unlisten?: (() => void) | null;
}

export interface SupabaseSdk extends BackendSdk {
    initializeApp(config: BackendConfig): SupabaseApp;
    getApps(): SupabaseApp[];
    getAuth(app: BackendApp): SupabaseAuth;
    getDatabase(app: BackendApp): SupabaseDatabase;
    getIdTokenResult(user: BackendUser): Promise<BackendTokenResult>;
}
