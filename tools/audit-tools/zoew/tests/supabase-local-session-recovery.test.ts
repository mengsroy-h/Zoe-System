import { webcrypto } from 'node:crypto';
import { pickupResetAttemptId, pickupResetBoundReceipt, pickupResetCasOf, pickupResetReceiptMatches } from '../../../../ZoeW/src/domain/pickup-reset-proof';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSupabaseSdk, docsCacheScope } from '../../../../ZoeW/src/services/supabase-sdk';
import { ledgerCompanionCopyState, ledgerCompanionState, ledgerDeltaCompanion, ledgerDeltaIntent, ledgerJournalUpdate, ledgerJournalWitness, ledgerOpRing, ledgerTagged } from '../../../../ZoeW/src/domain/ledger';
import { SbNetworkError } from '../../../../ZoeW/src/services/supabase-rtdb';
import { createLocalWriteJournal } from '../../../../ZoeW/src/services/write-journal';
import { withConnectionOwnership, connectionFlowSnapshot } from '../../../../ZoeW/src/services/connection-flow';
import { setupAuthListener, logoutApp, performLogin } from '../../../../ZoeW/src/features/auth';
import { firebaseState, dataState, uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { loginBackendScope } from '../../../../ZoeW/src/features/login-memory';
import { localAuthSessionCurrent, localLogoutIntent } from '../../../../ZoeW/src/services/local-logout-intent';
import { detachDatabaseListeners, resetDbListenerHealthState } from '../../../../ZoeW/src/services/db-listeners';
import { SB_AUTH_STORAGE_KEY, SB_AUTH_OWNER_KEY } from '../../../../ZoeW/src/services/supabase-transport';

const UID = 'logout-recovery-probe-user', TENANT = 'logout-recovery-probe-tenant';
const TOPIC = 'zoe:' + TENANT;
const turn = async () => { for (let n = 0; n < 120; n++) await Promise.resolve(); };
vi.mock('../../../../ZoeW/src/features/license', async original => ({ ...await original<any>(), proceedAfterLogin: vi.fn(async () => false) }));
const labs: any[] = [];
let serial = 0;
const until = async (check: () => boolean) => { for (let n = 0; n < 400 && !check(); n++) { await turn(); await vi.advanceTimersByTimeAsync(1); } expect(check()).toBe(true); };
beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear();
    firebaseState.authGeneration++;
    Object.assign(firebaseState, { sessionExpiryCheck: 'live', authLoginOperation: null,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseInitialized: true,
        isDatabaseConnected: true, dbListenersFailed: false });
    viewState.backendKind = 'supabase'; viewState.loginBusy = false;
    dataState.scanHistory = []; dataState.deletedItems = []; uiState.modalDisplay = {}; uiState.toasts = [];
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('crypto', webcrypto);
});
afterEach(async () => {
    firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null;
    if (firebaseState.authRecoveryTimeout) clearTimeout(firebaseState.authRecoveryTimeout);
    firebaseState.authRecoveryTimeout = null;
    detachDatabaseListeners(); resetDbListenerHealthState();
    for (const lab of labs.splice(0)) await lab.sdk.deleteApp(lab.app);
    await turn(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

function fixture() {
    const config = { supabaseUrl: 'https://logout-probe-' + (++serial) + '.supabase.co', supabaseKey: 'sb_publishable_fixture' };
    const now = Math.floor(Date.now() / 1000), token = ['eyJhbGciOiJub25lIn0', btoa(JSON.stringify({ sub: UID, iat: now, exp: now + 3600, amr: [{ timestamp: now }] })), 'fixture'].join('.');
    const saved = { access_token: token, refresh_token: 'synthetic-retained-refresh', user: { id: UID, email: 'probe@users.zoew.invalid' } };
    localStorage.setItem(SB_AUTH_OWNER_KEY, config.supabaseUrl);
    localStorage.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(saved));
    localStorage.setItem('zoew_firebase_config', JSON.stringify(config));
    const journal = createLocalWriteJournal(localStorage);
    let seq = 0;
    const rows: any[] = [], sent: any[] = [], errors: string[] = [];
    const values = new Map<string, any>();
    const receipts = new Map<string, any>();
    const effects: string[] = [];
    let beforePull: (() => Promise<void>) | null = null;
    let beforeReply: (() => Promise<void>) | null = null;
    let logins = 0;
    let beforeHash: (() => Promise<void>) | null = null;
    const calls: string[] = [];
    let writeFailure: SbNetworkError | null = null;
    const open = (phase: string, listen = true) => {
        const transport = {
            url: config.supabaseUrl,
            restoreSession: async () => {
                const s = JSON.parse(localStorage.getItem(SB_AUTH_STORAGE_KEY)!);
                return { accessToken: s.access_token, user: s.user };
            },
            readAccount: () => ({ uid: UID, row: { tenant_id: TENANT, status: 'active' } }),
            writeAccount() {}, onSession: () => () => {}, onForeignSession: () => () => {}, close() {},
            subscribe: () => () => {}, ping: async () => true, accessToken: async () => token,
            signIn: async () => { logins++; return { accessToken: token, user: saved.user }; }, setPersistence() {},
            signOut: async () => { throw new SbNetworkError('HTTP 503; persisted SDK session removal refused'); },
            rpc: async (fn: string, args: any) => {
                calls.push(fn);
                if (fn === 'my_account') return [{ tenant_id: TENANT, status: 'active' }];
                if (fn === 'zoe_now') return Date.now();
                if (fn === 'zoe_pull') {
                    if (beforePull) await beforePull();
                    return { seq, head: seq, more: false, reset: args.p_since === 0, tenant: TENANT, now: Date.now(), rows };
                }
                if (fn === 'zoe_write_v2') {
                    expect(args.p_expected_tenant).toBe(TENANT);
                    sent.push({ phase, operationId: args.p_op_id, operations: structuredClone(args.p_ops),
                        locallyBlocked: localLogoutIntent.blocked('sb:' + config.supabaseUrl, UID),
                        accepted: localAuthSessionCurrent(firebaseState.auth, loginBackendScope(), firebaseState.auth.currentUser),
                        appPhase: connectionFlowSnapshot().phase });
                    if (writeFailure) throw writeFailure;
                    const prior = receipts.get(args.p_op_id);
                    if (prior) {
                        if (beforeReply) await beforeReply();
                        return { ...prior, replayed: true, now: Date.now() };
                    }
                    const conflict = args.p_ops.find((op: any) => op.k === 'cas'
                        && JSON.stringify(values.get(op.p.join('/')) ?? null) !== JSON.stringify(op.x ?? null));
                    if (conflict) return { ok: false, conflict: true, now: Date.now(), value: values.get(conflict.p.join('/')) ?? null };
                    effects.push(args.p_op_id);
                    const docs = args.p_ops.map((op: any) => {
                        const key = op.p.join('/'); values.set(key, op.v);
                        const d = { r: op.p[0], k: op.p[1], v: op.v, s: ++seq }; rows.push(d); return d;
                    });
                    const reply = { ok: true, seq, docs, now: Date.now() };
                    receipts.set(args.p_op_id, reply);
                    if (beforeReply) await beforeReply();
                    return reply;
                }
                throw new Error('Unexpected fixture RPC: ' + fn);
            }
        };
        const sdk = withConnectionOwnership(createSupabaseSdk(() => transport, {
            onListenerError: (e: any) => errors.push(String(e.message || e)), onTenantChanged() {},
            onAccountBlocked() {}, docsCache: null, writeJournal: journal,
            ledgerCompanion: { state: ledgerCompanionState, copy: ledgerCompanionCopyState, witness: ledgerJournalWitness, update: ledgerJournalUpdate },
            pickupReset: { cas: pickupResetCasOf, receiptMatches: pickupResetReceiptMatches, boundReceipt: async (...args: any[]) => {
                if (beforeHash) await beforeHash();
                return (pickupResetBoundReceipt as any)(...args);
            } },
            dbOptions: { retryStepsMs: [5], pollFallbackMs: 600000 }
        }));
        const app = sdk.initializeApp(config), auth = sdk.getAuth(app), db = sdk.getDatabase(app);
        Object.assign(firebaseState, { firebaseConfig: config, fb: sdk, auth, db,
            sessionExpiryCheck: 'live', isInitializingFirebase: false, firebaseSdkUnavailable: false,
            isDatabaseConnected: true, isDatabaseInitialized: true });
        if (listen) setupAuthListener();
        const lab = { sdk, app, auth, db }; labs.push(lab); return lab;
    };
    return { config, journal, sent, values, errors, effects, calls, open,
        setBeforeHash: (hook: typeof beforeHash) => { beforeHash = hook; },
        setBeforePull: (hook: typeof beforePull) => { beforePull = hook; },
        setBeforeReply: (hook: typeof beforeReply) => { beforeReply = hook; },
        logins: () => logins,
        failWrites: (error: typeof writeFailure) => { writeFailure = error; },
        seed: (path: string, value: any) => {
            values.set(path, value); const [r, k] = path.split('/'); rows.push({ r, k, v: value, s: ++seq });
        } };
}

for (const mode of ['no-logout-control', 'crash-after-note', 'failed-server-signout'] as const) {
    it(mode + ': an old queued write is never replayed while durable local logout fences the restored SDK session', async () => {
        const f = fixture(), first = f.open('original');
        await until(() => first.db.isReady() && !!first.auth.currentUser);
        expect(localAuthSessionCurrent(first.auth, loginBackendScope(), first.auth.currentUser)).toBe(true);
        first.sdk.goOffline(first.db);
        const pending = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4300).catch(() => null);
        const scope = docsCacheScope(first.app, UID)!;
        await until(() => f.journal.list(scope, TOPIC).some((r: any) => r.stage === 'queued' && r.awaitingRecovery === false));
        const produced = structuredClone(f.journal.list(scope, TOPIC)[0]);
        expect(produced).toMatchObject({ writeProtocol: 2, stage: 'queued', sentAfter: 0, awaitingRecovery: false });
        expect(f.sent).toHaveLength(0);
        if (mode === 'crash-after-note') expect(localLogoutIntent.note(loginBackendScope(), UID)).toBe(true);
        if (mode === 'failed-server-signout') await logoutApp();
        firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null;
        await first.sdk.deleteApp(first.app); await turn(); await pending;
        expect(f.journal.list(scope, TOPIC)).toHaveLength(1);
        const retained = JSON.parse(localStorage.getItem(SB_AUTH_STORAGE_KEY)!);
        expect(retained.user.id).toBe(UID);
        const second = f.open('reloaded');
        await until(() => second.db.isReady()); await turn();
        const row = { mode, journalFromProduction: produced, sent: structuredClone(f.sent),
            serverValue: f.values.get('zoew_settings/exchange_rate') ?? null,
            localPhase: connectionFlowSnapshot().phase, accepted: localAuthSessionCurrent(second.auth, loginBackendScope(), second.auth.currentUser),
            remainingJournal: f.journal.list(scope, TOPIC), errors: f.errors };
        if (mode === 'no-logout-control') {
            expect(row.serverValue).toBe(4300); expect(row.sent).toHaveLength(1); expect(row.accepted).toBe(true);
        } else {
            expect(row.localPhase).toBe('signed-out'); expect(row.accepted).toBe(false);
            expect(row.sent, 'adapter background recovery must respect the persisted local logout before explicit re-login').toEqual([]);
            expect(row.serverValue).toBeNull();
            expect(f.journal.list(scope, TOPIC)).toEqual([produced]);
            expect(second.sdk.resumeAcceptedSession(second.auth)).toBe(false);
            second.sdk.goOnline(second.db); second.db.retryWriteRecovery().catch(() => {});
            await turn(); await vi.advanceTimersByTimeAsync(20);
            expect(f.sent).toEqual([]); expect(f.journal.list(scope, TOPIC)).toEqual([produced]);
            await performLogin('probe', 'synthetic-password', false, false);
            await until(() => f.sent.length === 1 && f.journal.list(scope, TOPIC).length === 0);
            expect(f.logins()).toBe(1); expect(f.effects).toHaveLength(1);
            expect(f.sent[0]).toMatchObject({ operationId: produced.opId, locallyBlocked: false, accepted: true });
            expect(f.values.get('zoew_settings/exchange_rate')).toBe(4300);
            await second.db.retryWriteRecovery(); await turn();
            expect(f.sent).toHaveLength(1); expect(f.effects).toHaveLength(1);
        }
    });
}

const latch = () => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
};

async function queuedCrash(f: ReturnType<typeof fixture>) {
    const first = f.open('original');
    await until(() => first.db.isReady() && !!first.auth.currentUser);
    first.sdk.goOffline(first.db);
    const pending = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4300).catch(() => null);
    const scope = docsCacheScope(first.app, UID)!;
    await until(() => f.journal.list(scope, TOPIC).some(row => row.stage === 'queued' && row.awaitingRecovery === false));
    const row = structuredClone(f.journal.list(scope, TOPIC)[0]);
    firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null;
    await first.sdk.deleteApp(first.app); await turn(); await pending;
    return { scope, row };
}

it('a valid restored SDK identity cannot replay its production journal before the application accepts that identity', async () => {
    const f = fixture(), { scope, row } = await queuedCrash(f);
    const second = f.open('unaccepted-reload', false);
    await until(() => second.db.isReady() && !!second.auth.currentUser);
    expect(second.sdk.resumeAcceptedSession(second.auth)).toBe(false);
    expect(f.sent).toEqual([]); expect(f.effects).toEqual([]);
    expect(f.journal.list(scope, TOPIC)).toEqual([row]);
    setupAuthListener();
    await until(() => f.sent.length === 1 && f.journal.list(scope, TOPIC).length === 0);
    expect(f.sent[0]).toMatchObject({ operationId: row.opId, accepted: true, locallyBlocked: false });
    expect(f.effects).toEqual([row.opId]);
    await second.db.retryWriteRecovery();
    expect(f.sent).toHaveLength(1);
});

it('logout racing a delayed recovery pull blocks replay even if another tab already acknowledged the intent before its storage event', async () => {
    const f = fixture(), { scope, row } = await queuedCrash(f);
    const pull = latch(); f.setBeforePull(() => pull.promise);
    const second = f.open('delayed-pull');
    await until(() => localAuthSessionCurrent(second.auth, loginBackendScope(), second.auth.currentUser));
    const { createLocalLogoutIntentStore } = await import('../../../../ZoeW/src/services/local-logout-intent');
    const session = new Map<string, string>();
    const other = createLocalLogoutIntentStore(localStorage, {
        get length() { return session.size; }, key: (i: number) => [...session.keys()][i] ?? null,
        getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => { session.set(key, value); }
    });
    const loginScope = loginBackendScope();
    expect(other.note(loginScope, UID)).toBe(true);
    expect(other.acknowledge(loginScope, UID, other.capture(loginScope))).toBe(true);
    expect(localLogoutIntent.blocked(loginScope, UID)).toBe(false);
    expect(localAuthSessionCurrent(second.auth, loginScope, second.auth.currentUser)).toBe(false);
    pull.resolve(); f.setBeforePull(null);
    await until(() => second.db.isReady()); await turn();
    expect(f.sent).toEqual([]); expect(f.effects).toEqual([]);
    expect(f.journal.list(scope, TOPIC)).toEqual([row]);
    expect(second.sdk.resumeAcceptedSession(second.auth)).toBe(false);
    await performLogin('probe', 'synthetic-password', false, false);
    await until(() => f.journal.list(scope, TOPIC).length === 0);
    expect(f.effects).toEqual([row.opId]); expect(f.sent).toHaveLength(1);
});

it('a server commit followed by logout before its ACK preserves the unknown journal and replays the same receipt once after a fresh login', async () => {
    const f = fixture(), first = f.open('original');
    await until(() => first.db.isReady() && !!first.auth.currentUser);
    first.sdk.goOffline(first.db);
    const pending = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4300).catch(() => null);
    const scope = docsCacheScope(first.app, UID)!;
    await until(() => f.journal.list(scope, TOPIC).some(row => row.stage === 'queued' && row.awaitingRecovery === false));
    const row = structuredClone(f.journal.list(scope, TOPIC)[0]);
    const ack = latch(); f.setBeforeReply(() => ack.promise);
    first.sdk.goOnline(first.db);
    await until(() => f.sent.length === 1 && f.values.get('zoew_settings/exchange_rate') === 4300);
    expect(localLogoutIntent.note(loginBackendScope(), UID)).toBe(true);
    ack.resolve(); f.setBeforeReply(null);
    await until(() => f.journal.list(scope, TOPIC).some(row => row.uncertain === true));
    await vi.advanceTimersByTimeAsync(30);
    expect(f.sent).toHaveLength(1); expect(f.effects).toEqual([row.opId]);
    firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null;
    await first.sdk.deleteApp(first.app); await pending;
    const second = f.open('reloaded');
    await until(() => second.db.isReady()); await turn();
    expect(f.sent).toHaveLength(1); expect(f.journal.list(scope, TOPIC)).toHaveLength(1);
    await performLogin('probe', 'synthetic-password', false, false);
    await until(() => f.journal.list(scope, TOPIC).length === 0);
    expect(f.sent.map(send => send.operationId)).toEqual([row.opId, row.opId]);
    expect(f.effects).toEqual([row.opId]); expect(f.values.get('zoew_settings/exchange_rate')).toBe(4300);
});

it('an old response after explicit re-login cannot erase the original unknown journal before the new admitted replay responds', async () => {
    const f = fixture(), first = f.open('original');
    await until(() => first.db.isReady() && !!first.auth.currentUser);
    const oldAck = latch(), newAck = latch(); let replies = 0;
    f.setBeforeReply(() => ++replies === 1 ? oldAck.promise : newAck.promise);
    let settled = false;
    const pending = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4300).finally(() => { settled = true; });
    const scope = docsCacheScope(first.app, UID)!;
    await until(() => f.sent.length === 1 && f.effects.length === 1);
    const operationId = f.sent[0].operationId;
    expect(localLogoutIntent.note(loginBackendScope(), UID)).toBe(true);
    await performLogin('probe', 'synthetic-password', false, false);
    expect(localAuthSessionCurrent(first.auth, loginBackendScope(), first.auth.currentUser)).toBe(true);
    expect(f.journal.list(scope, TOPIC)).toHaveLength(1);
    oldAck.resolve();
    await until(() => f.sent.length === 2);
    expect(settled).toBe(false); expect(f.journal.list(scope, TOPIC)).toHaveLength(1);
    expect(f.sent.map(send => send.operationId)).toEqual([operationId, operationId]);
    expect(f.effects).toEqual([operationId]);
    newAck.resolve(); await pending;
    expect(f.journal.list(scope, TOPIC)).toEqual([]); expect(f.effects).toEqual([operationId]);
});

it('logout defers a real uncertain revenue-companion journal and its financial follow-up until accepted re-login', async () => {
    const f = fixture(), day = '2026-11-14', ledgerPath = 'zoew_daily_revenue_cod_dod/' + day;
    f.seed(ledgerPath, { codDollar: 40, dodDollar: 0, totalCount: 2 });
    f.seed('zoew_scan_history_cod_dod/item1', { id: 'item1', phone: '012000111', scanDate: day,
        barcodes: [{ code: 'B1', cod: 15, dod: 0, isClosed: false, createdAt: 1 }] });
    const first = f.open('original');
    await until(() => first.db.isReady() && !!first.auth.currentUser);
    const intent = { ...ledgerDeltaIntent('daily', day, 5, 0, 0, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0, 1)), token: 'op_logout_companion' };
    const updater = Object.assign((value: any) => ledgerTagged({ ...value, codDollar: value.codDollar + 5 }, intent.token, ledgerOpRing(value, intent.token)),
        { connectionIntent: intent });
    f.failWrites(new SbNetworkError('synthetic commit outcome unavailable'));
    const pending = first.sdk.runTransaction(first.sdk.ref(first.db, ledgerPath), updater).catch(() => null);
    const scope = docsCacheScope(first.app, UID)!;
    await until(() => f.journal.list(scope, TOPIC).some(row => row.uncertain === true));
    const original = structuredClone(f.journal.list(scope, TOPIC)[0]);
    expect(original.intent).toMatchObject({ kind: 'revenue-delta', companion: { code: 'B1' }, token: intent.token });
    expect(f.effects).toEqual([]);
    expect(localLogoutIntent.note(loginBackendScope(), UID)).toBe(true);
    firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null;
    await first.sdk.deleteApp(first.app); await vi.advanceTimersByTimeAsync(10); await pending;
    f.failWrites(null); f.sent.length = 0;
    const second = f.open('reloaded'); await until(() => second.db.isReady()); await turn();
    expect(f.sent).toEqual([]); expect(f.effects).toEqual([]);
    expect(f.journal.list(scope, TOPIC)).toEqual([original]);
    expect(f.values.get(ledgerPath)).toMatchObject({ codDollar: 40, dodDollar: 0, totalCount: 2 });
    await performLogin('probe', 'synthetic-password', false, false);
    await until(() => f.journal.list(scope, TOPIC).length === 0);
    expect(f.effects).toHaveLength(1); expect(f.sent).toHaveLength(1);
    expect(f.sent[0]).toMatchObject({ locallyBlocked: false, accepted: true });
    expect(f.sent[0].operationId).not.toBe(original.opId);
    expect(f.values.get(ledgerPath)).toMatchObject({ codDollar: 45, dodDollar: 0, totalCount: 2 });
    await second.db.retryWriteRecovery(); await turn();
    expect(f.effects).toHaveLength(1); expect(f.values.get(ledgerPath).codDollar).toBe(45);
});

it('a discard waiting for a journal lock cannot revive after logout and a new accepted login in the same SDK', async () => {
    const f = fixture(), { scope, row } = await queuedCrash(f);
    const pull = latch(), lock = latch(); let claimRequested = false;
    f.setBeforePull(() => pull.promise);
    const second = f.open('reloaded');
    await until(() => localAuthSessionCurrent(second.auth, loginBackendScope(), second.auth.currentUser));
    vi.stubGlobal('navigator', { onLine: true, locks: { request: async (_name: string, options: any, callback: any) => {
        expect(options).toEqual({ ifAvailable: true }); claimRequested = true;
        await lock.promise; return callback({ name: 'synthetic-owned-journal-lock' });
    } } });
    try {
        const discarded = second.db.discardPendingWrites();
        await until(() => claimRequested);
        expect(localLogoutIntent.note(loginBackendScope(), UID)).toBe(true);
        await performLogin('probe', 'synthetic-password', false, false);
        expect(localAuthSessionCurrent(second.auth, loginBackendScope(), second.auth.currentUser)).toBe(true);
        lock.resolve();
        expect(await discarded).toMatchObject({ count: 0, failed: 1 });
        expect(f.journal.list(scope, TOPIC)).toEqual([row]);
        expect(f.sent).toEqual([]); expect(f.effects).toEqual([]);
    } finally { lock.resolve(); pull.resolve(); f.setBeforePull(null); }
});

it('pickup reset hashing cannot revive an old mutation after logout and a new accepted login', async () => {
    const f = fixture(), day = '2026-11-14';
    const before = { pickupRevision: 4, pickupResetEpoch: 2, packagesPickedUp: 3, pickedUpPhones: { p1: true }, pickedUpBarcodes: { B1: true } };
    const after = { pickupRevision: 5, pickupResetEpoch: 3, packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null };
    const path = 'zoew_daily_pickup_cod_dod/' + day;
    f.seed(path, before);
    const first = f.open('original'); await until(() => first.db.isReady() && !!first.auth.currentUser);
    const context = { v: 1, scope: f.config.supabaseUrl + '#' + TENANT, batchId: 'batch-one', batchHash: 'a'.repeat(64), dayId: 'batch-one:' + day, day, nonce: 'nonce' };
    const casText = JSON.stringify({ k: 'cas', p: path.split('/'), x: before, v: after });
    const request = { tenant: TENANT, actorUid: UID, context, attemptId: await pickupResetAttemptId(TENANT, UID, context, casText), casText };
    const hash = latch(); let hashing = false;
    f.setBeforeHash(() => { hashing = true; return hash.promise; });
    const pending = first.sdk.executePickupReset(first.sdk.ref(first.db, path), request).catch((error: any) => error);
    try {
        await until(() => hashing);
        expect(localLogoutIntent.note(loginBackendScope(), UID)).toBe(true);
        await performLogin('probe', 'synthetic-password', false, false);
        expect(localAuthSessionCurrent(first.auth, loginBackendScope(), first.auth.currentUser)).toBe(true);
        hash.resolve();
        expect(await pending).toMatchObject({ txOutcome: 'not-applied', noRetry: true });
        expect(f.calls.filter(fn => fn === 'zoe_pickup_reset_execute_v1')).toEqual([]);
        expect(f.values.get(path)).toEqual(before); expect(f.effects).toEqual([]);
    } finally { hash.resolve(); f.setBeforeHash(null); }
});
