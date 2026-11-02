import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerPendingPaths } from '../src/core/text';
import { pickupResetAttemptId, pickupResetBatchHash, pickupResetCasText, pickupResetAppliedReceipt } from '../src/domain/pickup-reset-proof';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';

const DAY = '2026-11-01', TENANT = 'demo-owned-reset', UID = 'owned-reset-user';
const SCOPE = 'https://demo-owned-reset.firebaseio.com', PATH = 'zoew_daily_pickup_cod_dod/' + DAY;
const clone = value => structuredClone(value);
const basis = () => ({ packagesPickedUp: 1, pickedUpPhones: { before: 1 }, pickedUpBarcodes: { BEFORE: 'before' }, pickupRevision: 4, pickupResetEpoch: 2 });
const desired = () => ({ packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null, pickupRevision: 5, pickupResetEpoch: 3 });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
let sdk, raw, app, db, auth, ref, server, fetches;
async function request(tenant = TENANT, actorUid = UID) {
    const batchId = 'owned-original';
    const context = { v: 1, scope: SCOPE, batchId, batchHash: await pickupResetBatchHash(tenant, SCOPE, actorUid, batchId, [DAY]),
        dayId: batchId + ':' + DAY, day: DAY, nonce: 'owned-nonce' };
    const casText = pickupResetCasText(DAY, basis(), desired());
    return { tenant, actorUid, context, casText, attemptId: await pickupResetAttemptId(tenant, actorUid, context, casText) };
}
beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto); appLocalStore.clear(); dbListenerPendingPaths.clear(); server = basis();
    app = { options: { projectId: TENANT, databaseURL: SCOPE } }; db = { app };
    auth = { app, currentUser: { uid: UID, getIdTokenResult: vi.fn(async () => ({ claims: { aud: TENANT } })), getIdToken: vi.fn(async () => 'synthetic-read-token') } };
    raw = {
        getAuth: vi.fn(() => auth), getDatabase: vi.fn(() => db),
        ref: vi.fn((_db, path = '') => ({ path, toString: () => SCOPE + '/' + path })),
        runTransaction: vi.fn(async (_ref, updater, options) => {
            expect(options).toEqual({ applyLocally: false });
            const next = updater(clone(server));
            if (next === undefined) return { committed: false, snapshot: { val: () => clone(server) } };
            server = clone(next); const saved = clone(server);
            return { committed: true, snapshot: { val: () => clone(saved) } };
        }),
        update: vi.fn(), set: vi.fn(), deleteApp: vi.fn(async () => {})
    };
    sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app); ref = sdk.ref(db, PATH);
    firebaseState.authGeneration++; firebaseState.fb = sdk; firebaseState.db = db; firebaseState.auth = auth;
    firebaseState.firebaseConfig = app.options; firebaseState.isInitializingFirebase = false;
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.firebaseSdkUnavailable = false;
    firebaseState.dbListenersFailed = false; firebaseState.authLoginOperation = null; firebaseState.sessionExpiryCheck = 'live';
    firebaseState.serverTimeOffsetMs = 321; firebaseState.serverClockTrusted = false;
    dataState.dailyPickupData = { [DAY]: clone(server) };
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(app.options));
    fetches = vi.fn(async () => new Response(JSON.stringify(server), { status: 200, headers: { Date: 'Sun, 01 Nov 2037 00:00:00 GMT' } }));
    vi.stubGlobal('fetch', fetches);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); appLocalStore.clear(); });

it('owned native Reset uses registered auth/database/ref metadata and one fixed raw CAS with no generic journal', async () => {
    const original = await request(); const result = await sdk.executePickupReset(ref, original, () => true);
    expect(result.committed).toBe(true); expect(server).toEqual({ ...desired(), pickupResetApplied: result.pickupReset });
    expect(auth.currentUser.getIdTokenResult).toHaveBeenCalledTimes(1);
    expect(raw.runTransaction).toHaveBeenCalledTimes(1); expect(raw.update).not.toHaveBeenCalled(); expect(raw.set).not.toHaveBeenCalled();
    expect(Object.keys(appLocalStore).filter(key => key.startsWith('zoew_connection_writes_v1:'))).toEqual([]);
    expect(fetches).not.toHaveBeenCalled();
});
it('owned status reads exact proof while preserving newer pickup/view/clock and never executes', async () => {
    const original = await request();
    const proof = pickupResetAppliedReceipt(TENANT, UID, original.context, original.attemptId, original.casText, 'native-day');
    server = { ...desired(), pickupResetApplied: proof, pickupRevision: 6, packagesPickedUp: 1, pickedUpPhones: { newer: 1 }, pickedUpBarcodes: { AFTER: 'newer' } };
    dataState.dailyPickupData = { [DAY]: clone(server) }; const before = clone(dataState.dailyPickupData), physical = clone(server);
    expect(await sdk.pickupResetStatus(ref, original, () => true)).toEqual({ outcome: 'applied', pickupReset: proof });
    expect(server).toEqual(physical); expect(dataState.dailyPickupData).toEqual(before);
    expect(firebaseState.serverTimeOffsetMs).toBe(321); expect(firebaseState.serverClockTrusted).toBe(false);
    expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).toHaveBeenCalledTimes(1);
});
it.each(['executePickupReset', 'pickupResetStatus'])('owned %s rejects an unregistered same-URL ref before token/read/write', async method => {
    const unregistered = { path: PATH, toString: () => SCOPE + '/' + PATH };
    const operation = sdk[method](unregistered, await request(), () => true);
    if (method === 'executePickupReset') await expect(operation).rejects.toMatchObject({ txOutcome: 'not-applied' });
    else expect(await operation).toEqual({ outcome: 'unknown', pickupReset: null });
    expect(auth.currentUser.getIdTokenResult).not.toHaveBeenCalled(); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});
it.each(['actor', 'project'])('owned Reset rejects a fully bound foreign %s descriptor', async kind => {
    const original = await request(kind === 'project' ? 'foreign-project' : TENANT, kind === 'actor' ? 'foreign-user' : UID);
    await expect(sdk.executePickupReset(ref, original, () => true)).rejects.toMatchObject({ txOutcome: 'not-applied' });
    expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});
it.each(['executePickupReset', 'pickupResetStatus'])('owned %s rejects a foreign token audience without backend effects', async method => {
    auth.currentUser.getIdTokenResult.mockResolvedValueOnce({ claims: { aud: 'foreign-project' } });
    const operation = sdk[method](ref, await request(), () => true);
    if (method === 'executePickupReset') await expect(operation).rejects.toMatchObject({ txOutcome: 'not-applied' });
    else expect(await operation).toEqual({ outcome: 'unknown', pickupReset: null });
    expect(auth.currentUser.getIdTokenResult).toHaveBeenCalledTimes(1); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});
it('owned Reset refuses missing token realm evidence', async () => {
    delete auth.currentUser.getIdTokenResult;
    await expect(sdk.executePickupReset(ref, await request(), () => true)).rejects.toMatchObject({ txOutcome: 'not-applied' });
    expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});
it('owned Reset respects canWrite while status remains read-only available', async () => {
    const original = await request();
    server = { ...desired(), pickupResetApplied: pickupResetAppliedReceipt(TENANT, UID, original.context, original.attemptId, original.casText, 'native-day') };
    firebaseState.firebaseSdkUnavailable = true;
    await expect(sdk.executePickupReset(ref, original, () => true)).rejects.toMatchObject({ txOutcome: 'not-applied' });
    expect(raw.runTransaction).not.toHaveBeenCalled();
    expect(await sdk.pickupResetStatus(ref, original, () => true)).toMatchObject({ outcome: 'applied' });
    expect(fetches).toHaveBeenCalledTimes(1);
});
it('owned caller gate false prevents dispatch before any token request', async () => {
    await expect(sdk.executePickupReset(ref, await request(), () => false)).rejects.toMatchObject({ txOutcome: 'not-applied' });
    expect(auth.currentUser.getIdTokenResult).not.toHaveBeenCalled(); expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});
it.each(['session', 'caller'])('owned %s ending during synthetic token await never sends original CAS', async kind => {
    const token = deferred<any>(); let keep = true;
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => token.promise);
    const pending = sdk.executePickupReset(ref, await request(), () => keep);
    expect(auth.currentUser.getIdTokenResult).toHaveBeenCalledTimes(1);
    if (kind === 'session') firebaseState.authGeneration++; else keep = false;
    token.resolve({ claims: { aud: TENANT } });
    await expect(pending).rejects.toMatchObject({ txOutcome: 'not-applied' });
    expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});
it('owned request bytes are copied before token await and caller mutation cannot rebind nonce', async () => {
    const original = await request(), originalNonce = original.context.nonce, token = deferred<any>();
    auth.currentUser.getIdTokenResult.mockImplementationOnce(() => token.promise);
    const pending = sdk.executePickupReset(ref, original, () => true);
    original.context.nonce = 'caller-mutated'; token.resolve({ claims: { aud: TENANT } });
    const result = await pending;
    expect(result.pickupReset.nonce).toBe(originalNonce); expect(result.pickupReset.attemptId).toBe(original.attemptId);
    expect(raw.runTransaction).toHaveBeenCalledTimes(1);
});
it.each([false, true])('owned SDK false after proposed CAS requires actual read-only proof (proof=%s)', async present => {
    const original = await request();
    raw.runTransaction.mockImplementationOnce(async (_ref, updater) => {
        const proposal = updater(clone(server));
        if (present) server = clone(proposal);
        return { committed: false, snapshot: { val: () => clone(server) } };
    });
    const pending = sdk.executePickupReset(ref, original, () => true);
    if (present) { const result = await pending; expect(result.committed).toBe(true); expect(result.snapshot).toBeUndefined(); }
    else await expect(pending).rejects.toMatchObject({ txOutcome: 'unknown' });
    expect(raw.runTransaction).toHaveBeenCalledTimes(1); expect(fetches).toHaveBeenCalledTimes(1);
    expect(Object.keys(appLocalStore).filter(key => key.startsWith('zoew_connection_writes_v1:'))).toEqual([]);
});
it('owned ended-session ACK retains only original proof without stale snapshot/view/clock', async () => {
    const entered = deferred<void>(), release = deferred<void>();
    raw.runTransaction.mockImplementationOnce(async (_ref, updater) => {
        server = clone(updater(clone(server))); const saved = clone(server); entered.resolve(); await release.promise;
        return { committed: true, snapshot: { val: () => clone(saved) } };
    });
    const pending = sdk.executePickupReset(ref, await request(), () => true); await entered.promise;
    firebaseState.authGeneration++; const before = clone(dataState.dailyPickupData); release.resolve();
    const result = await pending;
    expect(result).toMatchObject({ committed: true, txOutcome: 'applied' }); expect(result.snapshot).toBeUndefined();
    expect(dataState.dailyPickupData).toEqual(before); expect(firebaseState.serverTimeOffsetMs).toBe(321); expect(firebaseState.serverClockTrusted).toBe(false);
    expect(fetches).not.toHaveBeenCalled(); expect(raw.runTransaction).toHaveBeenCalledTimes(1);
});
it('owned same-session caller cancellation after effect stays UNKNOWN with no returned snapshot', async () => {
    const entered = deferred<void>(), release = deferred<void>(); let keep = true;
    raw.runTransaction.mockImplementationOnce(async (_ref, updater) => {
        server = clone(updater(clone(server))); const saved = clone(server); entered.resolve(); await release.promise;
        return { committed: true, snapshot: { val: () => clone(saved) } };
    });
    const pending = sdk.executePickupReset(ref, await request(), () => keep); await entered.promise;
    keep = false; release.resolve();
    await expect(pending).rejects.toMatchObject({ txOutcome: 'unknown' });
    expect(fetches).not.toHaveBeenCalled(); expect(raw.runTransaction).toHaveBeenCalledTimes(1);
});
it('owned status cancellation during the separate REST-token await sends no read request', async () => {
    const entered = deferred<void>(), token = deferred<string>(); let keep = true;
    auth.currentUser.getIdToken.mockImplementationOnce(() => { entered.resolve(); return token.promise; });
    const pending = sdk.pickupResetStatus(ref, await request(), () => keep); await entered.promise;
    keep = false; token.resolve('synthetic-read-token');
    expect(await pending).toEqual({ outcome: 'unknown', pickupReset: null });
    expect(raw.runTransaction).not.toHaveBeenCalled(); expect(fetches).not.toHaveBeenCalled();
});
