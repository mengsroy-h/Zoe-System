import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { normalizeFirebaseConfig, decodeSetupPayload } from '../src/features/config';
import { dataState, firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { pickupResetAttemptId, pickupResetBatchHash, pickupResetBoundReceipt, pickupResetCasText } from '../src/domain/pickup-reset-proof';
import { runPickupResetBatch, resumePickupResetOutcomes } from '../src/services/pickup-reset';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { withConnectionOwnership } from '../src/services/connection-flow';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';

const DAY = '2026-11-01', REALM = 'jwt-native-project', UID = 'compat-owner';
const URL = 'https://different-database-host.firebaseio.com';
const CONFIG = { apiKey: 'synthetic-api-key-not-a-secret', databaseURL: URL };
const BEFORE = { pickupRevision: 4, pickupResetEpoch: 2, packagesPickedUp: 2, pickedUpPhones: { P: 2 }, pickedUpBarcodes: { A: 'P', B: 'P' } };
const AFTER = { pickupRevision: 5, pickupResetEpoch: 3, packagesPickedUp: 0 };
const copy = value => structuredClone(value);
let sdk: any, raw: any, app: any, db: any, auth: any, server: any, fetches: any, ref: any;
const deferred = () => { let resolve: (value: any) => void; const promise = new Promise<any>(done => { resolve = done; }); return { promise, resolve: (value: any) => resolve(value) }; };
const journals = () => Object.keys(appLocalStore).filter(key => key.startsWith('zoew_pickup_reset_pending_v2:')).map(key => JSON.parse(appLocalStore.getItem(key)!));
async function request() {
    const batchId = 'config-compat-batch';
    const context = { v: 1, scope: URL, batchId, batchHash: await pickupResetBatchHash(REALM, URL, UID, batchId, [DAY]),
        dayId: batchId + ':' + DAY, day: DAY, nonce: 'config-compat-nonce' };
    const casText = pickupResetCasText(DAY, BEFORE, { ...AFTER, pickedUpPhones: null, pickedUpBarcodes: null });
    return { tenant: REALM, actorUid: UID, context, casText, attemptId: await pickupResetAttemptId(REALM, UID, context, casText) };
}
beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto); appLocalStore.clear(); dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear(); server = copy(BEFORE);
    const accepted = normalizeFirebaseConfig(JSON.stringify(CONFIG)); app = { options: accepted.config }; db = { app };
    auth = { app, currentUser: { uid: UID, getIdTokenResult: vi.fn(async () => ({ claims: { aud: REALM } })), getIdToken: vi.fn(async () => 'synthetic-read-token') } };
    raw = { getAuth: vi.fn(() => auth), getDatabase: vi.fn(() => db), ref: vi.fn((_db, path = '') => ({ path, toString: () => URL + '/' + path })),
        runTransaction: vi.fn(async (_ref, updater, options) => {
            expect(options).toEqual({ applyLocally: false }); const next = updater(copy(server));
            if (next === undefined) return { committed: false, snapshot: { val: () => copy(server) } };
            server = Object.fromEntries(Object.entries(copy(next)).filter(([, value]) => value !== null));
            return { committed: true, snapshot: { val: () => copy(server) } };
        }), get: vi.fn(async () => ({ val: () => copy(server) })), update: vi.fn(), set: vi.fn(), deleteApp: vi.fn(async () => {}) };
    sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app); ref = sdk.ref(db, 'zoew_daily_pickup_cod_dod/' + DAY);
    Object.assign(firebaseState, { fb: sdk, db, auth, authGeneration: firebaseState.authGeneration + 1, firebaseConfig: app.options,
        isInitializingFirebase: false, isDatabaseInitialized: true, isDatabaseConnected: true, firebaseSdkUnavailable: false,
        dbListenersFailed: false, authLoginOperation: null, sessionExpiryCheck: 'live' });
    dataState.dailyPickupData = { [DAY]: copy(BEFORE) }; dataState.pickupResetInFlight = false;
    dataState.dailyRevenueData = { [DAY]: { codDollar: 37, dodDollar: 5, totalCount: 11 } };
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(app.options));
    fetches = vi.fn(async (input: any) => {
        expect(new globalThis.URL(String(input)).origin).toBe(URL);
        return new Response(JSON.stringify(server), { status: 200 });
    }); vi.stubGlobal('fetch', fetches);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); appLocalStore.clear(); });

it('accepted config មានតែ apiKey/databaseURL អាច public Reset ដោយ realm ពី captured user aud', async () => {
    expect(normalizeFirebaseConfig(JSON.stringify(CONFIG)).config).toEqual(CONFIG);
    expect(decodeSetupPayload(btoa(JSON.stringify(CONFIG)))).toEqual(CONFIG);
    expect(app.options).not.toHaveProperty('projectId'); expect(typeof sdk.executePickupReset).toBe('function'); expect(typeof sdk.pickupResetStatus).toBe('function');
    const money = copy(dataState.dailyRevenueData), result = await runPickupResetBatch([DAY]);
    expect(result).toMatchObject({ status: 'complete', doneCount: 1 });
    expect(server).toMatchObject(AFTER); expect(server.pickupResetApplied).toMatchObject({ tenant: REALM, actorUid: UID, proof: 'native-day' });
    expect(journals()).toHaveLength(1); expect(journals()[0].tenant).toBe(REALM); expect(journals()[0].days[0].attempts[0].tenant).toBe(REALM);
    expect(raw.runTransaction).toHaveBeenCalledTimes(1); expect(raw.update).not.toHaveBeenCalled(); expect(raw.set).not.toHaveBeenCalled();
    expect(dataState.dailyRevenueData).toEqual(money);
});

it('owned method execute ពេល accepted config អត់ projectId ផ្ទៀង aud មុន fixed native CAS', async () => {
    const original = await request(), result = await sdk.executePickupReset(ref, original, () => true);
    expect(result.committed).toBe(true); expect(result.pickupReset).toEqual(await pickupResetBoundReceipt(REALM, UID, original.context, original.attemptId, original.casText, 'native-day'));
    expect(raw.runTransaction).toHaveBeenCalledTimes(1); expect(fetches).not.toHaveBeenCalled();
});

it('owned method status ពេល accepted config អត់ projectId អាចអាន original APPLIED ដោយគ្មាន effects', async () => {
    const original = await request(), proof = await pickupResetBoundReceipt(REALM, UID, original.context, original.attemptId, original.casText, 'native-day');
    server = { ...copy(AFTER), pickupResetApplied: proof };
    expect(await sdk.pickupResetStatus(ref, original, () => true)).toEqual({ outcome: 'applied', pickupReset: proof });
    expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).toHaveBeenCalledTimes(1); expect(server.pickupResetApplied).toEqual(proof);
});

it('original APPLIED status លើ unregistered ref នៅ UNKNOWN មិនមែន not-applied', async () => {
    const original = await request(); server = { ...copy(AFTER), pickupResetApplied: await pickupResetBoundReceipt(REALM, UID, original.context, original.attemptId, original.casText, 'native-day') };
    const foreign = { path: ref.path, toString: ref.toString }, outcome = await sdk.pickupResetStatus(foreign, original, () => true).catch((error: any) => error);
    expect(outcome).toEqual({ outcome: 'unknown', pickupReset: null }); expect(outcome.txOutcome).toBeUndefined();
    expect(auth.currentUser.getIdTokenResult).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled(); expect(raw.runTransaction).not.toHaveBeenCalled();
});

it.each([undefined, null, [], [REALM], 0, {}, '', ' ', 'two realms', 'bad\u0000realm', '\uD800'])('public fallback មិនទទួល aud malformed=%j មុន journal ឬ SDK dispatch', async aud => {
    auth.currentUser.getIdTokenResult.mockResolvedValue({ claims: { aud } });
    const result = await runPickupResetBatch([DAY]);
    expect(result).toMatchObject({ status: 'unavailable', doneCount: 0 }); expect(journals()).toEqual([]);
    expect(server).toEqual(BEFORE); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});

it.each(['user', 'auth', 'db', 'sdk', 'generation', 'scope', 'project-added', 'project-empty'])('public captured owner %s ផ្លាស់ពេល aud await មិនបង្ក journal ឬ effects', async change => {
    const entered = deferred(), token = deferred();
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => { entered.resolve(null); return token.promise; });
    const pending = runPickupResetBatch([DAY]); await entered.promise;
    if (change === 'user') auth.currentUser = { ...auth.currentUser };
    if (change === 'auth') firebaseState.auth = { ...auth };
    if (change === 'db') firebaseState.db = { app } as any;
    if (change === 'sdk') firebaseState.fb = { ...sdk };
    if (change === 'generation') firebaseState.authGeneration++;
    if (change === 'scope') app.options.databaseURL = 'https://changed-database.invalid';
    if (change === 'project-added') app.options.projectId = REALM;
    if (change === 'project-empty') app.options.projectId = '';
    token.resolve({ claims: { aud: REALM } });
    expect(await pending).toMatchObject({ status: 'unavailable', doneCount: 0 });
    expect(journals()).toEqual([]); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled(); expect(server).toEqual(BEFORE);
});

it.each(['executePickupReset', 'pickupResetStatus'])('owned %s ផ្ទៀង token realm ស្រស់ម្ដងទៀត មិនយក cached fallback ជំនួស', async method => {
    const original = await request();
    server = method === 'pickupResetStatus' ? { ...copy(AFTER), pickupResetApplied: await pickupResetBoundReceipt(REALM, UID, original.context, original.attemptId, original.casText, 'native-day') } : copy(BEFORE);
    auth.currentUser.getIdTokenResult.mockResolvedValueOnce({ claims: { aud: REALM } }).mockResolvedValueOnce({ claims: { aud: 'foreign-project' } });
    const outcome = await sdk[method](ref, original, () => true).catch((error: any) => error);
    if (method === 'executePickupReset') expect(outcome).toMatchObject({ txOutcome: 'not-applied', noRetry: true });
    else { expect(outcome).toEqual({ outcome: 'unknown', pickupReset: null }); expect(outcome.txOutcome).toBeUndefined(); }
    expect(auth.currentUser.getIdTokenResult).toHaveBeenCalledTimes(2); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});

it.each(['executePickupReset', 'pickupResetStatus'])('owned %s ក្រោយ async fallback មិនអាចប្រើ owner/config ថ្មី', async method => {
    const original = await request(), entered = deferred(), token = deferred();
    server = { ...copy(AFTER), pickupResetApplied: await pickupResetBoundReceipt(REALM, UID, original.context, original.attemptId, original.casText, 'native-day') };
    const physical = copy(server);
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => { entered.resolve(null); return token.promise; });
    const pending = sdk[method](ref, original, () => true).catch((error: any) => error); await entered.promise;
    app.options.projectId = REALM; token.resolve({ claims: { aud: REALM } });
    const outcome = await pending;
    if (method === 'executePickupReset') expect(outcome).toMatchObject({ txOutcome: 'not-applied' });
    else { expect(outcome).toEqual({ outcome: 'unknown', pickupReset: null }); expect(outcome.txOutcome).toBeUndefined(); }
    expect(server).toEqual(physical); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});

it.each(['executePickupReset', 'pickupResetStatus'])('owned %s user object ដូច uid ផ្លាស់ពេល aud await មិនបញ្ជូន', async method => {
    const original = await request(), entered = deferred(), token = deferred();
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => { entered.resolve(null); return token.promise; });
    const pending = sdk[method](ref, original, () => true).catch((error: any) => error); await entered.promise;
    auth.currentUser = { ...auth.currentUser }; token.resolve({ claims: { aud: REALM } });
    const outcome = await pending;
    if (method === 'executePickupReset') expect(outcome).toMatchObject({ txOutcome: 'not-applied' });
    else expect(outcome).toEqual({ outcome: 'unknown', pickupReset: null });
    expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});

it.each([1, 2])('write gate expired ពេល token await លើក %i នៅ execute បិទមុន CAS', async awaitNumber => {
    const original = await request(), entered = deferred(), token = deferred();
    if (awaitNumber === 2) auth.currentUser.getIdTokenResult.mockResolvedValueOnce({ claims: { aud: REALM } });
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => { entered.resolve(null); return token.promise; });
    const pending = sdk.executePickupReset(ref, original, () => true).catch((error: any) => error); await entered.promise;
    firebaseState.sessionExpiryCheck = 'expired'; token.resolve({ claims: { aud: REALM } });
    expect(await pending).toMatchObject({ txOutcome: 'not-applied' }); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});

it('write gate expired មិនបិទ read-only original status នៅ fallback config', async () => {
    const original = await request(), entered = deferred(), token = deferred(), proof = await pickupResetBoundReceipt(REALM, UID, original.context, original.attemptId, original.casText, 'native-day');
    server = { ...copy(AFTER), pickupResetApplied: proof };
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => { entered.resolve(null); return token.promise; });
    const pending = sdk.pickupResetStatus(ref, original, () => true); await entered.promise;
    firebaseState.sessionExpiryCheck = 'expired'; token.resolve({ claims: { aud: REALM } });
    expect(await pending).toEqual({ outcome: 'applied', pickupReset: proof }); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).toHaveBeenCalledTimes(1);
});

it('explicit configured project មិន fallback ទៅ token project ដែលខុស', async () => {
    app.options.projectId = 'configured-project';
    const result = await runPickupResetBatch([DAY]);
    expect(result.doneCount).toBe(0); expect(server).toEqual(BEFORE); expect(raw.runTransaction).not.toHaveBeenCalled();
    expect(journals()).toHaveLength(1); expect(journals()[0].tenant).toBe('configured-project');
    expect(journals()[0].days[0].attempts[0]).toMatchObject({ tenant: 'configured-project', outcome: 'not-applied' });
});

it('owned fallback ចម្លង request មុន aud await ដោយ nonce/hash មិនប្ដូរ', async () => {
    const original = await request(), saved = copy(original), entered = deferred(), token = deferred();
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => { entered.resolve(null); return token.promise; });
    const pending = sdk.executePickupReset(ref, original, () => true); await entered.promise;
    original.context.nonce = 'caller-mutated'; original.casText = '{}'; token.resolve({ claims: { aud: REALM } });
    const result = await pending;
    expect(result.pickupReset).toMatchObject({ nonce: saved.context.nonce, attemptId: saved.attemptId }); expect(raw.runTransaction).toHaveBeenCalledTimes(1);
});

it('aud getter មួយ ត្រូវអានតែមួយក្នុង realm lookup នីមួយៗ', async () => {
    const original = await request(); let reads = 0;
    auth.currentUser.getIdTokenResult.mockResolvedValueOnce({ claims: { get aud() { reads++; return reads === 1 ? REALM : 'foreign-project'; } } });
    const result = await sdk.executePickupReset(ref, original, () => true);
    expect(result.committed).toBe(true); expect(reads).toBe(1); expect(raw.runTransaction).toHaveBeenCalledTimes(1);
});

it('manual recovery នៅ accepted no-project config អាន proof ដើម ដោយគ្មាន fresh Reset', async () => {
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: any, run: (lock: object) => any) => run({}) } });
    let deny = false;
    fetches.mockImplementation(async () => { if (deny) throw new Error('synthetic proof read unavailable'); return new Response(JSON.stringify(server), { status: 200 }); });
    raw.runTransaction.mockImplementationOnce(async (_ref: any, updater: any) => {
        server = Object.fromEntries(Object.entries(copy(updater(copy(server)))).filter(([, value]) => value !== null));
        deny = true; throw new Error('synthetic committed ACK lost');
    });
    const summary = await runPickupResetBatch([DAY]);
    expect(summary.doneCount).toBe(0); expect(journals()[0].days[0].attempts[0].outcome).toBe('pending');
    const id = journals()[0].days[0].attempts[0].attemptId, physical = copy(server); deny = false;
    expect(await resumePickupResetOutcomes()).toMatchObject({ checked: 1, resolved: 1, held: false });
    expect(journals()[0].days[0].attempts[0]).toMatchObject({ attemptId: id, outcome: 'applied' });
    expect(server).toEqual(physical); expect(raw.runTransaction).toHaveBeenCalledTimes(1);
});

it.each([undefined, [REALM], 'two realms'])('original APPLIED status ជាមួយ aud មិនអាចផ្ទៀង %j នៅ UNKNOWN មុន read', async aud => {
    const original = await request(), proof = await pickupResetBoundReceipt(REALM, UID, original.context, original.attemptId, original.casText, 'native-day');
    server = { ...copy(AFTER), pickupResetApplied: proof }; auth.currentUser.getIdTokenResult.mockResolvedValue({ claims: { aud } });
    const result = await sdk.pickupResetStatus(ref, original, () => true);
    expect(result).toEqual({ outcome: 'unknown', pickupReset: null }); expect(result.txOutcome).toBeUndefined();
    expect(server.pickupResetApplied).toEqual(proof); expect(fetches).not.toHaveBeenCalled(); expect(raw.runTransaction).not.toHaveBeenCalled();
});

it('Supabase owned proxy រក្សា tenant ដើម និង operation receipt ដោយមិនអាន native aud', async () => {
    const original = await request(), tenant = 'supabase-original-tenant', sbApp = { options: { supabaseUrl: 'https://compat-sb.invalid' } }, sbDb = { _sb: true };
    const nativeToken = vi.fn(async () => { throw new Error('Supabase must not use native realm fallback'); });
    const sbAuth = { app: sbApp, currentUser: { uid: UID, getIdTokenResult: nativeToken }, _account: { tenant_id: tenant } };
    const req = { ...original, tenant };
    req.attemptId = await pickupResetAttemptId(tenant, UID, req.context, req.casText);
    const proof = await pickupResetBoundReceipt(tenant, UID, req.context, req.attemptId, req.casText, 'operation');
    const execute = vi.fn(async (_ref, sent, current, owner) => { expect(current()).toBe(true); expect(sent).toEqual(req); expect(owner.tenant).toBe(tenant); return { committed: true, pickupReset: proof }; });
    const status = vi.fn(async (_ref, sent, current, owner) => { expect(current()).toBe(true); expect(sent).toEqual(req); expect(owner.tenant).toBe(tenant); return { outcome: 'applied', pickupReset: proof }; });
    const sbSdk = withConnectionOwnership({ __supabase: true, getAuth: () => sbAuth, getDatabase: () => sbDb, ref: (_db, path) => ({ path }),
        executePickupReset: execute, pickupResetStatus: status });
    sbSdk.getAuth(sbApp); sbSdk.getDatabase(sbApp); const sbRef = sbSdk.ref(sbDb, 'zoew_daily_pickup_cod_dod/' + DAY);
    firebaseState.auth = sbAuth as any; firebaseState.db = sbDb as any; firebaseState.fb = sbSdk;
    expect(await sbSdk.executePickupReset(sbRef, req, () => true)).toEqual({ committed: true, pickupReset: proof });
    expect(await sbSdk.pickupResetStatus(sbRef, req, () => true)).toEqual({ outcome: 'applied', pickupReset: proof });
    expect(execute).toHaveBeenCalledTimes(1); expect(status).toHaveBeenCalledTimes(1); expect(nativeToken).not.toHaveBeenCalled();
});

it('optional-project realm lookup ដែលមិនឆ្លើយ ត្រូវចប់តាម dbOp budget មុន journal ហើយ late reply មិនបង្ក effects', async () => {
    const token = deferred(), onApplied = vi.fn(); let settled = false, current = true, result;
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => token.promise);
    vi.useFakeTimers();
    const pending = runPickupResetBatch([DAY], () => current, onApplied).then(value => { settled = true; result = value; });
    try {
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS - 1); expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1); expect(settled).toBe(true);
        expect(result).toEqual({ status: 'unavailable', doneCount: 0, failedCount: 0 });
        expect(journals()).toEqual([]); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
        token.resolve({ claims: { aud: REALM } }); await pending; await Promise.resolve();
        expect(journals()).toEqual([]); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
        expect(server).toEqual(BEFORE); expect(onApplied).not.toHaveBeenCalled();
    } finally {
        if (!settled) current = false;
        token.resolve({ claims: { aud: REALM } }); await pending; vi.useRealTimers();
    }
});

it('optional-project recovery realm timeout រក្សា pending journal ដើម និងមិនអានឬសរសេរ Reset ពេល late reply', async () => {
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: any, run: (lock: object) => any) => run({}) } });
    let deny = false;
    fetches.mockImplementation(async () => { if (deny) throw new Error('synthetic proof read unavailable'); return new Response(JSON.stringify(server), { status: 200 }); });
    raw.runTransaction.mockImplementationOnce(async (_ref: any, updater: any) => {
        server = Object.fromEntries(Object.entries(copy(updater(copy(server)))).filter(([, value]) => value !== null));
        deny = true; throw new Error('synthetic committed ACK lost');
    });
    expect(await runPickupResetBatch([DAY])).toMatchObject({ status: 'hold', doneCount: 0 });
    expect(journals()[0].days[0].attempts[0].outcome).toBe('pending');
    const original = Object.fromEntries(Object.keys(appLocalStore).map(key => [key, appLocalStore.getItem(key)]));
    const physical = copy(server), reads = fetches.mock.calls.length, writes = raw.runTransaction.mock.calls.length, token = deferred();
    let settled = false, result;
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => token.promise); vi.useFakeTimers();
    const pending = resumePickupResetOutcomes().then(value => { settled = true; result = value; });
    try {
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS - 1); expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1); expect(settled).toBe(true);
        expect(result).toEqual({ checked: 0, resolved: 0, held: true });
        expect(Object.fromEntries(Object.keys(appLocalStore).map(key => [key, appLocalStore.getItem(key)]))).toEqual(original);
        token.resolve({ claims: { aud: REALM } }); await pending; await Promise.resolve();
        expect(Object.fromEntries(Object.keys(appLocalStore).map(key => [key, appLocalStore.getItem(key)]))).toEqual(original);
        expect(fetches).toHaveBeenCalledTimes(reads); expect(raw.runTransaction).toHaveBeenCalledTimes(writes); expect(server).toEqual(physical);
    } finally {
        if (!settled) firebaseState.authGeneration++;
        token.resolve({ claims: { aud: REALM } }); await pending; vi.useRealTimers();
    }
});
